import test from 'node:test';
import assert from 'node:assert/strict';
import {runSourceRequest} from './source-request.mjs';
import {compileSourceModules} from './source-modules.mjs';
import {ModuleSession} from './module-session.mjs';
import {Execution} from './functions.mjs';
import {ValueRuntime} from './values.mjs';
import {reprReal} from './numeric.mjs';

const unit = source => ({name: 'app', source, imports: [], package: false, notice: 'Synthetic formatting notice'});
const profile = {languageProfile: 'classes-source/1'};
const run = (source, options = {}, memoryLimits = undefined) => runSourceRequest({modules: [unit(source)], compileOptions: profile, options, memoryLimits});
const closed = result => { for (const key of ['bytes','objects','roots','frames','external']) assert.equal(result.closed[key], 0); };

test('float display preserves shortest digits, Python thresholds and signed special values', async () => {
  for (const [value, expected] of [[-0, '-0.0'], [1e-5, '1e-05'], [1e-4, '0.0001'],
    [1e15, '1000000000000000.0'], [1e16, '1e+16'], [1e23, '1e+23'],
    [Number.MIN_VALUE, '5e-324'], [Number.MAX_VALUE, '1.7976931348623157e+308'],
    [Infinity, 'inf'], [-Infinity, '-inf'], [NaN, 'nan']]) assert.equal(reprReal(value), expected);
  for (const languageProfile of ['core-source/1', 'classes-source/1']) {
    const result = await runSourceRequest({modules: [unit('print(1.5,-0.0,repr(1e-5),str(1e16))\n')], compileOptions: {languageProfile}});
    assert.equal(result.stdout, '1.5 -0.0 1e-05 1e+16\n'); assert.equal(result.error, undefined); closed(result);
  }
  let polls = 0;
  assert.throws(() => reprReal(1.7976931348623157e308, () => { if (++polls > 2) throw Error('cancelled'); }), /cancelled/);
});

test('primitive repr stays in the core profile and expanded strings obey the value limit', async () => {
  const result = await runSourceRequest({modules: [unit('s="A😀"\nprint(repr(s),str(s) is s,len(str()),repr(-9007199254740993))\n')]});
  assert.equal(result.error, undefined, JSON.stringify(result.error));
  assert.equal(result.stdout, "'A😀' True 0 -9007199254740993\n"); closed(result);
  const values = new ValueRuntime();
  assert.throws(() => values.repr(values.string(Array(20000).fill(0))), {code: 'BUDGET'});
  assert.equal(values.text(values.repr(values.float(1.5))), '1.5');
});

test('callback and invalid-result errors retain their caller and Python source frames', async () => {
  const failed = await run('class A:\n def __str__(self):\n  return 1//0\nprint("start",A())\n');
  assert.equal(failed.error.type, 'ZeroDivisionError'); assert.equal(failed.stdout, 'start ');
  assert.deepEqual(failed.error.traceback.map(f => [f.function,f.location.span[0]]), [['<module>',4],['__str__',3]]); closed(failed);
  const invalid = await run('class A:\n def __repr__(self): return 7\nrepr(A())\n');
  assert.equal(invalid.error.type, 'TypeError');
  assert.deepEqual(invalid.error.traceback.map(f => [f.function,f.location.span[0]]), [['<module>',3]]); closed(invalid);
});

test('repr optional lookup is distinct from str binding and callback-body AttributeError', async () => {
  for (const slot of ['__repr__','__str__']) {
    const body = await run('class A:\n def '+slot+'(self): raise AttributeError("body")\n'+(slot==='__repr__'?'repr':'str')+'(A())\n');
    assert.equal(body.error.type, 'AttributeError'); assert.equal(body.error.message, 'body'); closed(body);
  }
  const fallback = await run('class A:\n @property\n def __repr__(self): raise AttributeError("binding")\nrepr(A())\n');
  assert.equal(fallback.error.code, 'UNSUPPORTED'); closed(fallback);
  const binding = await run('class A:\n def __repr__(self): return "unused"\n @property\n def __str__(self): raise AttributeError("binding")\nstr(A())\n');
  assert.equal(binding.error.type, 'AttributeError'); assert.equal(binding.error.message, 'binding'); closed(binding);
});

test('Python recursion and native formatting redirects remain depth-bounded', async () => {
  for (const source of [
    'class A:\n def __repr__(self): return repr(self)\nrepr(A())\n',
    'class A:\n def __str__(self): return str(self)\nstr(A())\n',
    'class A:\n __repr__=property(repr)\nrepr(A())\n',
    'class A:\n __str__=property(str)\nstr(A())\n',
    'class A:\n __str__=property(print)\nprint(A())\n'
  ]) {
    const result = await run(source, {maxDepth: 8, maxSteps: 100000, maxWork: 20000000});
    assert.equal(result.error.type, 'RecursionError', JSON.stringify(result.error)); closed(result);
  }
  const wrappers = await run('def render(): return "value"\nwrapped=render\ni=0\nwhile i<80:\n wrapped=staticmethod(wrapped)\n i+=1\nclass A:\n __repr__=wrapped\nprint(repr(A()))\n', {maxDepth: 8, maxWork: 20000000});
  assert.equal(wrappers.error, undefined, JSON.stringify(wrappers.error)); assert.equal(wrappers.stdout, 'value\n'); closed(wrappers);
});

test('formatting bindings and bodies obey work, instruction and cancellation limits', async () => {
  for (const declaration of ['def __str__(self):','@property\n def __str__(self):']) {
    const source = 'class A:\n '+declaration+'\n  print("entered")\n  while True: pass\nprint("prefix",A())\n';
    for (const options of [{maxSteps: 500}, {maxSteps: 100000, maxWork: 50000}]) {
      const result = await run(source, options); assert.equal(result.error.code, 'BUDGET'); assert.equal(result.stdout, 'prefix entered\n'); closed(result);
    }
    let polls = 0;
    const cancelled = await run(source, {shouldCancel: () => ++polls > 100000});
    assert.equal(cancelled.error.code, 'CANCELLED'); assert.equal(cancelled.stdout, 'prefix entered\n'); closed(cancelled);
  }
});

test('callback OOM and aggregate output limits release pending print arguments', async () => {
  const source = 'class A:\n @property\n def __str__(self):\n  print("entered")\n  held=[]\n  while True: held.append([1,2,3])\nprint("prefix",A(),[7])\n';
  const oom = await run(source, {maxSteps: 100000, maxWork: 20000000}, {maxBytes: 32000});
  assert.equal(oom.error.code, 'OOM'); assert.equal(oom.stdout, 'prefix entered\n'); closed(oom);
  const output = await run('class A:\n def __str__(self):\n  while True: print("1234567890")\nprint("prefix",A())\n', {maxSteps: 100000, maxWork: 20000000});
  assert.equal(output.error.code, 'BUDGET'); assert.match(output.error.message, /output/i); closed(output);
});

test('paused print bindings keep their graph rooted and support close or cancellation', async () => {
  const source = 'class A:\n def __init__(self): self.text="value"\n @property\n def __str__(self):\n  print("entered")\n  held=[self.text]\n  def render(): return held[0]\n  return render\nprint("prefix",A(),"last")\n';
  const {registry} = await compileSourceModules([unit(source)], profile);
  try {
    for (const mode of ['finish','close','cancel']) {
      const session = new ModuleSession(registry); let cancel = false, output = '', pauses = 0;
      session.context.begin({shouldCancel: () => cancel}, text => { output += text; });
      const execution = Execution.modules(session.context);
      try {
        while (execution.state !== 'completed') {
          const snapshot = execution.advance();
          if (execution.state === 'paused') { session.memory.collect([], {cleanup: true}); pauses++; }
          if (snapshot.frames.some(f => f.completion === 'invoke') && output === 'prefix entered\n' && mode !== 'finish') {
            if (mode === 'cancel') { cancel = true; assert.throws(() => execution.advance(), {code: 'CANCELLED'}); }
            break;
          }
        }
        assert.ok(pauses > 10);
        assert.equal(output, mode === 'finish' ? 'prefix entered\nvalue last\n' : 'prefix entered\n');
      } finally { execution.close(); execution.close(); session.context.finish(); session.close(); }
      closed({closed: session.stats()});
    }
  } finally { registry.close(); }
});
