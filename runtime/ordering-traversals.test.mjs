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
