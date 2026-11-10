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
    const result = await runSourceRequest({modules: [{...unit(item.source), imports: item.imports ?? []},
      ...(item.modules ?? []).map(module => ({...unit(module.source), ...module}))], compileOptions: {languageProfile},
      options: {maxSteps: 50000, maxWork: 20000000}});
    if (corpus.implemented_stages.includes(item.stage)) {
      assert.equal(result.stdout, item.stdout, JSON.stringify(result.error));
      assert.equal(result.error?.type, item.error_type, JSON.stringify(result.error));
    } else assert.equal(result.error?.code, 'UNSUPPORTED');
    closed(result.closed);
  });

async function lifetime(source, expected) {
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
      if (mode === 'finish') assert.equal(stdout, expected);
    } finally { execution.close(); session.context.finish(); session.close(); }
    closed(session.stats());
  } } finally { registry.close(); }
}

test('dynamic syntax fields retain cyclic filename owners through collection and interruption', async () => {
  const source = 'class Name(str): pass\nfilename=Name("original.py")\ntry: compile("雪=",filename,"exec")\nexcept SyntaxError as error: e=error\nfilename.error=e\ne.args=()\nfilename=None\nprint("entered")\nprint(e.filename.error is e,e.msg,e.offset,repr(e._metadata[2]))\n';
  await lifetime(source, "entered\nTrue invalid syntax 3 '雪=\\n'\n");
});

for (const item of corpus.cases.filter(item => item.id.endsWith('owner-cycle')))
  test(item.id + ' survives collection, cancellation and close', async () => lifetime(item.source, item.stdout));

for (const [source, mode] of [
  ...['if', 'if True:\nvalue=7', 'return 7', 'nonlocal x', 'def f(x,x): pass', 'if True', 'del f()', '[a,1]=value', '[雪,*b,*c]=value', 'def f(a=1,b): pass', 'lambda *,**a: 1', 'f(a=1,2)', 'f(x for x in y,1)', 'f(a=1,a=2)', 'f(a=1,2,**d,*x)', 'f(a=x for x in y)', 'class C(a=1,B): pass', 'class C(a=1,a=2): pass', 'try: pass', 'try: pass\nexcept: pass\nexcept E: pass'].map(source => [source, 'exec']),
  ['x=1\nx=2', 'single'],
  ['from 雪 import 鳥,', 'exec'], ['import 雪 as 鳥.羽', 'exec'],
  ['[雪,鳥 for 羽 in 空]', 'exec'], ['{**雪 for 羽 in 空}', 'exec'],
  ['{雪:鳥,羽}', 'exec'], ['{雪:*鳥}', 'exec'],
  ['[雪 for 鳥 羽]', 'exec'], ['{雪:鳥 for 羽 in 空 if}', 'exec'],
  ['{雪,**鳥}', 'exec'], ['{雪:鳥,羽:空 for 海 in 山}', 'exec'],
  ['for 雪 鳥: pass', 'exec'], ['for 雪 in : pass', 'exec'],
  ['雪 if 鳥', 'exec'], ['雪 if 鳥 else', 'exec'],
  ['if else: pass', 'exec'], ['雪 if else 鳥', 'exec'],
  ['lambda 雪: else', 'exec'], ['lambda 雪 鳥: 1', 'exec'],
  ['~else', 'exec'], ['雪 and else', 'exec'],
]) test('retained ' + JSON.stringify(source) + ' payloads share allocation limits', async () => {
  const result = await runSourceRequest({modules: [unit('held=[]\nprint("ready")\nwhile True:\n try: compile(' + JSON.stringify(source) + ',"selected.py",' + JSON.stringify(mode) + ')\n except SyntaxError as e: held.append(e)\n')],
    compileOptions: {languageProfile: corpus.profile}, memoryLimits: {maxBytes: 100000}, options: {maxSteps: 50000, maxWork: 20000000}});
  assert.equal(result.stdout, 'ready\n'); assert.equal(result.error?.code, 'OOM', JSON.stringify(result.error)); closed(result.closed);
});

for (const [id, filename] of [['generated-syntax-original-dynamic-failure', 'syntax-payload-original.py'],
  ['generated-binding-original-dynamic-failure', 'binding-payload-original.py'],
  ['generated-target-original-dynamic-failure', 'target-payload-original.py'],
  ['generated-unpacking-original-dynamic-failure', 'unpacking-payload-original.py'],
  ['generated-signature-original-dynamic-failure', 'signature-payload-original.py'],
  ['generated-callgrammar-original-dynamic-failure', 'callgrammar-payload-original.py'],
  ['generated-keyword-original-dynamic-failure', 'keyword-payload-original.py'],
  ['generated-interactive-original-dynamic-failure', 'interactive-payload-original.py'],
  ['generated-mixedcall-original-dynamic-failure', 'mixedcall-payload-original.py'],
  ['generated-keywordgenerator-original-dynamic-failure', 'keywordgenerator-payload-original.py'],
  ['generated-classgrammar-original-dynamic-failure', 'classgrammar-payload-original.py'],
  ['generated-classkeyword-original-dynamic-failure', 'classkeyword-payload-original.py'],
  ['generated-trygrammar-original-dynamic-failure', 'trygrammar-payload-original.py'],
  ['generated-handlerorder-original-dynamic-failure', 'handlerorder-payload-original.py'],
  ['generated-importgrammar-original-dynamic-failure', 'importgrammar-payload-original.py'],
  ['generated-importalias-original-dynamic-failure', 'importalias-payload-original.py'],
  ['generated-compelements-original-dynamic-failure', 'compelements-payload-original.py'],
  ['generated-compunpack-original-dynamic-failure', 'compunpack-payload-original.py'],
  ['generated-dictmissing-original-dynamic-failure', 'dictmissing-payload-original.py'],
  ['generated-dictstarred-original-dynamic-failure', 'dictstarred-payload-original.py'],
  ['generated-compin-original-dynamic-failure', 'compin-payload-original.py'],
  ['generated-compclause-original-dynamic-failure', 'compclause-payload-original.py'],
  ['generated-mixeddisplay-original-dynamic-failure', 'mixeddisplay-payload-original.py'],
  ['generated-dictentries-original-dynamic-failure', 'dictentries-payload-original.py'],
  ['generated-forheader-original-dynamic-failure', 'forheader-payload-original.py'],
  ['generated-headeroperand-original-dynamic-failure', 'headeroperand-payload-original.py'],
  ['generated-conditionalelse-original-dynamic-failure', 'conditionalelse-payload-original.py'],
  ['generated-conditionalalternative-original-dynamic-failure', 'conditionalalternative-payload-original.py'],
  ['generated-headerstart-original-dynamic-failure', 'headerstart-payload-original.py'],
  ['generated-conditionaltest-original-dynamic-failure', 'conditionaltest-payload-original.py'],
  ['generated-lambdabody-original-dynamic-failure', 'lambdabody-payload-original.py'],
  ['generated-lambdaseparator-original-dynamic-failure', 'lambdaseparator-payload-original.py'],
  ['generated-unaryoperand-original-dynamic-failure', 'unaryoperand-payload-original.py'],
  ['generated-booleanoperand-original-dynamic-failure', 'booleanoperand-payload-original.py']])
test(id + ' keeps the original dynamic call frames', async () => {
  const item = corpus.cases.find(item => item.id === id);
  const result = await runSourceRequest({modules: [unit(item.source)], compileOptions: {languageProfile: corpus.profile}});
  assert.equal(result.error?.type, 'SyntaxError');
  assert.deepEqual(result.error.traceback.map(frame => [frame.function, frame.location.filename, frame.location.span[0]]),
    [['<module>', 'sources/app.py', 1], ['<module>', filename, 6], ['fail', filename, 2]]);
  closed(result.closed);
});
