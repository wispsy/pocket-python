import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runSourceRequest} from './source-request.mjs';
import {compileSourceModules} from './source-modules.mjs';
import {ModuleSession} from './module-session.mjs';
import {Execution} from './functions.mjs';

const corpus = JSON.parse(readFileSync(new URL('../tests/fixtures/interpreter/syntax-errors.json', import.meta.url)));
const unit = source => ({name: 'app', source, imports: [], package: false, notice: 'Synthetic syntax failure fixture'});
const closed = stats => { for (const key of ['bytes', 'objects', 'roots', 'frames', 'external']) assert.equal(stats[key], 0, key); };
for (const item of corpus.cases) for (const languageProfile of item.profiles ?? [corpus.profile])
  test(languageProfile + ': ' + item.id, async () => {
    const result = await runSourceRequest({modules: [unit(item.source)], compileOptions: {languageProfile}});
    if (corpus.implemented_stages.includes(item.stage)) {
      assert.equal(result.stdout, item.stdout, JSON.stringify(result.error));
      assert.equal(result.error?.type, item.error_type, JSON.stringify(result.error));
    } else assert.equal(result.error?.code, 'UNSUPPORTED');
    closed(result.closed);
  });

test('dynamic syntax fields retain cyclic filename owners through collection and interruption', async () => {
  const source = 'class Name(str): pass\nfilename=Name("original.py")\ntry: compile("雪=",filename,"exec")\nexcept SyntaxError as error: e=error\nfilename.error=e\ne.args=()\nfilename=None\nprint("entered")\nprint(e.filename.error is e,e.msg,e.offset,repr(e._metadata[2]))\n';
  const {registry} = await compileSourceModules([unit(source)], {languageProfile: corpus.profile});
  try { for (const mode of ['finish', 'cancel', 'close']) {
    const session = new ModuleSession(registry); let stdout = '', cancel = false, reached = false;
    session.context.begin({shouldCancel: () => cancel}, text => { stdout += text; });
    const execution = Execution.modules(session.context);
    try {
      while (execution.state !== 'completed') {
        execution.advance(); if (execution.state === 'paused') execution.park();
        session.memory.collect([], {cleanup: true});
        if (!reached && stdout === 'entered\n' && execution.state === 'parked') {
          reached = true;
          if (mode === 'cancel') { cancel = true; assert.throws(() => execution.advance(), {code: 'CANCELLED'}); break; }
          if (mode === 'close') break;
        }
      }
      assert.ok(reached);
      if (mode === 'finish') assert.equal(stdout, "entered\nTrue invalid syntax 3 '雪=\\n'\n");
    } finally { execution.close(); session.context.finish(); session.close(); }
    closed(session.stats());
  } } finally { registry.close(); }
});

test('retained generated syntax payloads share allocation limits', async () => {
  const result = await runSourceRequest({modules: [unit('held=[]\nprint("ready")\nwhile True:\n try: compile("if","selected.py","exec")\n except SyntaxError as e: held.append(e)\n')],
    compileOptions: {languageProfile: corpus.profile}, memoryLimits: {maxBytes: 100000}, options: {maxSteps: 50000, maxWork: 20000000}});
  assert.equal(result.stdout, 'ready\n'); assert.equal(result.error?.code, 'OOM', JSON.stringify(result.error)); closed(result.closed);
});
