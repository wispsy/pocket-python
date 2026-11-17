import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runSourceRequest} from './source-request.mjs';
import {compileSourceModules} from './source-modules.mjs';
import {ModuleSession} from './module-session.mjs';
import {Execution} from './functions.mjs';

const unit = source => ({name: 'app', source, imports: [], package: false, notice: 'Synthetic traversal fixture'});
const profile = {languageProfile: 'classes-source/1'};
const run = (source, options = {}, memoryLimits = undefined) => runSourceRequest({modules: [unit(source)], compileOptions: profile, options, memoryLimits});
const closed = result => { for (const key of ['bytes', 'objects', 'roots', 'frames', 'external']) assert.equal(result.closed[key], 0, key); };
const corpus = JSON.parse(readFileSync(new URL('../tests/fixtures/interpreter/traversals.json', import.meta.url)));
for (const item of corpus.cases.filter(item => corpus.implemented_stages.includes(item.stage))) {
  test('traversal source: ' + item.id, async () => {
    const result = await runSourceRequest({modules: [{...unit(item.source), imports: item.imports ?? []},
      ...(item.modules ?? []).map(module => ({...module, notice: 'Synthetic traversal helper'}))],
      compileOptions: profile, options: {maxWork: 20000000}});
    assert.equal(result.stdout, item.stdout ?? '');
    assert.equal(result.error?.type, item.error_type, JSON.stringify(result.error));
    if (item.error_frames) assert.deepEqual(result.error.traceback.map(frame => ({function: frame.function, line: frame.location.span[0]})), item.error_frames);
    if (item.id.endsWith('original-dynamic-frame')) assert.deepEqual(result.error.traceback.map(frame =>
      [frame.function, frame.location.filename, frame.location.span[0]]), [['<module>', 'sources/app.py', 2], ['apply', 'traversal-original.py', 2]]);
    closed(result);
  });
}

test('map shares work, cancellation and callback allocation budgets', async () => {
  const limited = await run('sum(map(abs,range(10**100)))\n', {maxWork: 5000});
  assert.equal(limited.error.code, 'BUDGET'); closed(limited);
  let polls = 0;
  const cancelled = await run('sum(map(abs,range(100000)))\n', {shouldCancel: () => ++polls > 200});
  assert.equal(cancelled.error.code, 'CANCELLED'); closed(cancelled);
  const oom = await run('def f(x):\n print("entered")\n held=[]\n while True: held.append([1,2,3])\nnext(map(f,[1]))\n',
    {maxSteps: 100000, maxWork: 20000000}, {maxBytes: 80000});
  assert.equal(oom.error.code, 'OOM'); assert.equal(oom.stdout, 'entered\n'); closed(oom);
});

async function parked(source, expected, marker) {
  const {registry} = await compileSourceModules([unit(source)], profile);
  try {
    for (const mode of ['finish', 'close', 'cancel']) {
      const session = new ModuleSession(registry); let cancelled = false, output = '', pauses = 0, entered = false;
      session.context.begin({maxWork: 20000000, shouldCancel: () => cancelled}, text => { output += text; });
      const execution = Execution.modules(session.context);
      try {
        while (execution.state !== 'completed') {
          execution.advance();
          if (execution.state === 'paused') { session.memory.collect([], {cleanup: true}); pauses++; }
          if (output === marker) {
            entered = true;
            if (mode === 'cancel') { cancelled = true; assert.throws(() => execution.advance(), {code: 'CANCELLED'}); break; }
            if (mode === 'close') break;
          }
        }
        assert.ok(entered); assert.ok(pauses > 10);
        assert.equal(output, mode === 'finish' ? expected : marker);
      } finally { execution.close(); session.context.finish(); session.close(); }
      closed({closed: session.stats()});
    }
  } finally { registry.close(); }
}

test('parked map retains temporary callable owners and partially gathered tuples', async () => {
  await parked('class A:\n def __init__(self): self.data=[7]\n def apply(self,a,b):\n  print("entered")\n  return self.data[0]+a[0]+b[0]\nprint(next(map(A().apply,[[1]],[[2]])))\n', 'entered\n10\n', 'entered\n');
  await parked('class I:\n def __iter__(self): return self\n def __next__(self):\n  print("pull")\n  return [2]\nprint(next(map(lambda a,b:a[0]+b[0],[[1]],I())))\n', 'pull\n3\n', 'pull\n');
});

test('filter bounds rejection scans and retains candidates through owned truth', async () => {
  const result = await run('next(filter(lambda x:False,range(10**100)))\n', {maxWork: 5000});
  assert.equal(result.error.code, 'BUDGET'); closed(result);
  await parked('class V:\n def __bool__(self):\n  print("truth")\n  held=[1,2,3]\n  return True\na=V()\nprint(next(filter(None,[a])) is a)\n', 'truth\nTrue\n', 'truth\n');
  await parked('class P:\n def __init__(self): self.data=[7]\n def test(self,x):\n  print("predicate")\n  return self.data[0]>x\nprint(list(filter(P().test,[1])))\n', 'predicate\n[1]\n', 'predicate\n');
});

test('parked enumerate roots the start converter and source without losing large counters', async () => {
  await parked('class Start:\n def __index__(self):\n  print("index")\n  return 2**100\nprint(list(enumerate([7],Start())))\n', 'index\n[(1267650600228229401496703205376, 7)]\n', 'index\n');
  await parked('class I:\n def __iter__(self): return self\n def __next__(self):\n  print("pull")\n  return [7]\nprint(next(enumerate(I(),2**100)))\n', 'pull\n(1267650600228229401496703205376, [7])\n', 'pull\n');
});

test('zip roots earlier tuple elements while a later source or strict probe is parked', async () => {
  await parked('class I:\n def __iter__(self): return self\n def __next__(self):\n  print("pull")\n  return [2]\nprint(next(zip([[1]],I())))\n', 'pull\n([1], [2])\n', 'pull\n');
  await parked('class I:\n def __iter__(self): return self\n def __next__(self):\n  print("probe")\n  return 1\ntry: next(zip([],I(),strict=True))\nexcept ValueError as e: print(str(e))\n', 'probe\nzip() argument 2 is longer than argument 1\n', 'probe\n');
});

test('native rejection scans release candidates and nested lazy chains honor depth limits', async () => {
  const scan = await run('print(list(filter(None,map(list,[()]*1000))))\n',
    {maxSteps: 100000, maxWork: 20000000}, {maxBytes: 80000});
  assert.equal(scan.error, undefined, JSON.stringify(scan.error)); assert.equal(scan.stdout, '[]\n'); closed(scan);
  const nested = await run('i=iter([1])\nfor n in range(80): i=map(abs,i)\nnext(i)\n', {maxDepth: 64, maxWork: 20000000});
  assert.equal(nested.error.type, 'RecursionError'); closed(nested);
});

test('core lazy membership uses owned advancement and unadopted native subclasses refuse explicitly', async () => {
  const source = 'print(2 in map(abs,[-1,-2]),(1,3) in zip([1,2],[3,4]))\n';
  const result = await runSourceRequest({modules: [unit(source)], compileOptions: {languageProfile: 'core-source/1'}});
  assert.equal(result.error, undefined, JSON.stringify(result.error)); assert.equal(result.stdout, 'True True\n'); closed(result);
  for (const name of ['map', 'filter', 'enumerate', 'zip']) {
    const refused = await run('class Derived(' + name + '): pass\n');
    assert.equal(refused.error.code, 'UNSUPPORTED'); closed(refused);
  }
});
