import test from 'node:test';
import assert from 'node:assert/strict';
import {runSourceRequest} from './source-request.mjs';
import {compileSourceModules} from './source-modules.mjs';
import {ModuleSession} from './module-session.mjs';
import {Execution} from './functions.mjs';

const unit = source => ({name: 'app', source, imports: [], package: false, notice: 'Synthetic aggregation fixture'});
const profile = {languageProfile: 'classes-source/1'};
const run = (source, options = {}, memoryLimits = undefined) => runSourceRequest({modules: [unit(source)], compileOptions: profile, options, memoryLimits});
const closed = result => { for (const key of ['bytes','objects','roots','frames','external']) assert.equal(result.closed[key], 0); };

test('min/max preserve first ties and evaluate each key once in input order', async () => {
  const result = await run('a=[1]\nb=[2]\ndef key(x):\n print(x[0])\n return 0\nprint(min([a,b],key=key) is a,max(a,b,key=key) is a)\n');
  assert.equal(result.stdout, '1\n2\n1\n2\nTrue True\n'); assert.equal(result.error, undefined); closed(result);
});

test('selection exhausts only iterator StopIteration and retains callback failures', async () => {
  const result = await run('def key(x): raise StopIteration("key")\nmin([1],key=key,default=7)\n');
  assert.equal(result.error.type, 'StopIteration'); assert.equal(result.error.message, 'key'); closed(result);
  const empty = await run('sentinel=[]\nprint(min([],key=1,default=sentinel) is sentinel)\n');
  assert.equal(empty.stdout, 'True\n'); closed(empty);
});

test('selection callbacks and primitive iteration share cancellation and work budgets', async () => {
  for (const [source, options] of [
    ['min(range(10**100))\n', {maxWork: 5000}],
    ['def key(x):\n print("entered")\n while True: pass\nmax([1],key=key)\n', {maxSteps: 400}],
  ]) {
    const result = await run(source, options); assert.equal(result.error.code, 'BUDGET'); closed(result);
  }
  let polls = 0;
  const cancelled = await run('min(range(1000000))\n', {shouldCancel: () => ++polls > 200});
  assert.equal(cancelled.error.code, 'CANCELLED'); closed(cancelled);
});

test('parked selection roots the iterator, candidate, best value and callback graph', async () => {
  const source = 'class Truth:\n def __bool__(self):\n  print("truth")\n  return True\nclass Key:\n def __lt__(self,other): return Truth()\ndef key(value): return Key()\na=[1]\nb=[2]\nprint(min([a,b],key=key) is b)\n';
  const {registry} = await compileSourceModules([unit(source)], profile);
  try {
    for (const mode of ['finish','close','cancel']) {
      const session = new ModuleSession(registry); let cancelled = false, output = '', pauses = 0;
      session.context.begin({maxWork: 20000000, shouldCancel: () => cancelled}, text => { output += text; });
      const execution = Execution.modules(session.context);
      try {
        while (execution.state !== 'completed') {
          const snapshot = execution.advance();
          if (execution.state === 'paused') { session.memory.collect([], {cleanup: true}); pauses++; }
          if (snapshot.frames.some(f => f.completion === 'protocol-result') && output === 'truth\n' && mode !== 'finish') {
            if (mode === 'cancel') { cancelled = true; assert.throws(() => execution.advance(), {code: 'CANCELLED'}); }
            break;
          }
        }
        assert.ok(pauses > 10); assert.equal(output, mode === 'finish' ? 'truth\nTrue\n' : 'truth\n');
      } finally { execution.close(); session.context.finish(); session.close(); }
      closed({closed: session.stats()});
    }
  } finally { registry.close(); }
});
