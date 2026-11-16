import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runSourceRequest} from './source-request.mjs';
import {compileSourceModules} from './source-modules.mjs';
import {ModuleSession} from './module-session.mjs';
import {Execution} from './functions.mjs';

const unit = source => ({name: 'app', source, imports: [], package: false, notice: 'Synthetic ordering fixture'});
const profile = {languageProfile: 'classes-source/1'};
const run = (source, options = {}, memoryLimits) => runSourceRequest({modules: [unit(source)], compileOptions: profile, options, memoryLimits});
const closed = result => { for (const key of ['bytes', 'objects', 'roots', 'frames', 'external']) assert.equal(result.closed[key], 0, key); };
const corpus = JSON.parse(readFileSync(new URL('../tests/fixtures/interpreter/ordering-traversals.json', import.meta.url)));
for (const item of corpus.cases.filter(item => corpus.implemented_stages.includes(item.stage))) {
  test('ordering source: ' + item.id, async () => {
    const result = await runSourceRequest({modules: [{...unit(item.source), imports: item.imports ?? []},
      ...(item.modules ?? []).map(module => ({...module, notice: 'Synthetic ordering helper'}))],
      compileOptions: profile, options: {maxWork: 20000000}});
    assert.equal(result.error?.type, item.error_type, JSON.stringify(result.error));
    assert.equal(result.stdout, item.stdout ?? '');
    closed(result);
  });
}

async function parked(source, expected, marker) {
  const {registry} = await compileSourceModules([unit(source)], profile);
  try {
    for (const mode of ['finish', 'close', 'cancel']) {
      const session = new ModuleSession(registry); let cancelled = false, output = '', entered = false;
      session.context.begin({maxWork: 20000000, shouldCancel: () => cancelled}, text => { output += text; });
      const execution = Execution.modules(session.context);
      try {
        while (execution.state !== 'completed') {
          execution.advance();
          if (execution.state === 'paused') session.memory.collect([], {cleanup: true});
          if (output === marker) {
            entered = true;
            if (mode === 'cancel') { cancelled = true; assert.throws(() => execution.advance(), {code: 'CANCELLED'}); break; }
            if (mode === 'close') break;
          }
        }
        assert.ok(entered);
        assert.equal(output, mode === 'finish' ? expected : marker);
      } finally { execution.close(); session.context.finish(); session.close(); }
      closed({closed: session.stats()});
    }
  } finally { registry.close(); }
}

test('reverse acquisition and pulls retain temporary owners while parked', async () => {
  await parked('class S:\n def __init__(self): self.items=[[7]]\n def __len__(self):\n  print("length")\n  return 1\n def __getitem__(self,i):\n  print("item")\n  return self.items[i]\nprint(next(reversed(S())))\n', 'length\nitem\n[7]\n', 'length\n');
  await parked('class S:\n def __init__(self): self.items=[[7]]\n def __len__(self): return 1\n def __getitem__(self,i):\n  print("item")\n  return self.items[i]\nprint(next(reversed(S())))\n', 'item\n[7]\n', 'item\n');
});

test('reverse callbacks share work, cancellation and actual allocation limits', async () => {
  const limited = await run('class S:\n def __len__(self):\n  while True: pass\n def __getitem__(self,i): return i\nreversed(S())\n', {maxWork: 3000});
  assert.equal(limited.error.code, 'BUDGET'); closed(limited);
  let polls = 0;
  const cancelled = await run('sum(reversed(range(10**100)))\n', {shouldCancel: () => ++polls > 100});
  assert.equal(cancelled.error.code, 'CANCELLED'); closed(cancelled);
  const oom = await run('class S:\n def __len__(self): return 1\n def __getitem__(self,i):\n  print("entered")\n  held=[]\n  while True: held.append([1,2,3])\nnext(reversed(S()))\n',
    {maxSteps: 100000, maxWork: 20000000}, {maxBytes: 80000});
  assert.equal(oom.error.code, 'OOM'); assert.equal(oom.stdout, 'entered\n'); closed(oom);
});

test('constructor hints keep sources and acquired iterators rooted through suspension', async () => {
  await parked('class S:\n def __init__(self): self.items=[[7]]\n def __iter__(self): return iter(self.items)\n def __length_hint__(self):\n  print("hint")\n  return 1\nprint(list(S()))\n', 'hint\n[[7]]\n', 'hint\n');
  const limited = await run('class S:\n def __iter__(self): return iter([])\n def __length_hint__(self):\n  while True: pass\nlist(S())\n', {maxWork: 3000});
  assert.equal(limited.error.code, 'BUDGET'); closed(limited);
  const excessive = await run('class S:\n def __iter__(self): return iter([])\n def __length_hint__(self): return 2**60\nlist(S())\n');
  assert.equal(excessive.error.code, 'BUDGET'); closed(excessive);
});

test('extension, display, call and unpack hints survive parked collection and teardown', async () => {
  const source = 'class S:\n def __init__(self): self.items=[[7]]\n def __iter__(self): return iter(self.items)\n def __length_hint__(self):\n  print("hint")\n  return 1\n';
  await parked(source + 'a=[0]\na.extend(S())\nprint(a)\n', 'hint\n[0, [7]]\n', 'hint\n');
  await parked(source + 'print([0,*S()])\n', 'hint\n[0, [7]]\n', 'hint\n');
  await parked(source + 'def f(*args): print(args)\nf(0,*S())\n', 'hint\n(0, [7])\n', 'hint\n');
  await parked('class S:\n def __init__(self): self.i=0;self.items=[[7],[8]]\n def __iter__(self): return self\n def __next__(self):\n  if self.i==2:raise StopIteration\n  self.i+=1\n  return self.items[self.i-1]\n def __length_hint__(self):\n  print("hint")\n  return 1\na,*b=S()\nprint(a,b)\n', 'hint\n[7] [[8]]\n', 'hint\n');
});

test('hint allocation failures and nested hints retain shared limits', async () => {
  const oom = await run('class S:\n def __iter__(self): return iter([7])\n def __length_hint__(self):\n  print("entered")\n  held=[]\n  while True: held.append([1,2,3])\nlist(S())\n', {maxWork: 20000000}, {maxBytes: 80000});
  assert.equal(oom.error.code, 'OOM'); assert.equal(oom.stdout, 'entered\n'); closed(oom);
  const nested = await run('class S:\n def __iter__(self): return iter([])\n def __length_hint__(self): return len(list(S()))\nlist(S())\n', {maxDepth: 32, maxWork: 20000000});
  assert.equal(nested.error.type, 'RecursionError'); closed(nested);
});
