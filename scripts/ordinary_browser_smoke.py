"""Accept ordinary source programs through an installed offline console."""

import argparse
from functools import partial
import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
from threading import Thread

from playwright.sync_api import sync_playwright
import pocket_python
from pocket_python.interpreter import build_interpreter, read_interpreter
from interpreter_browser_smoke import EXAMPLE, Handler, Server

ROOT = Path(__file__).resolve().parents[1]


def smoke(require_installed=False):
    package = Path(pocket_python.__file__).resolve()
    if require_installed:
        assert not package.is_relative_to(ROOT), 'Requires an isolated installed distribution.'
    assert platform.python_version() == '3.14.7'
    corpus_path = ROOT / 'tests/fixtures/interpreter/formatting.json'
    corpus = json.loads(corpus_path.read_bytes())
    example = (ROOT / 'examples/interpreter_display.py').read_text(encoding='utf-8')
    expected = subprocess.check_output([sys.executable, '-I', '-S', '-c', example], text=True, timeout=10)
    checks = []
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        engine = read_interpreter(ROOT / 'runtime')
        selected = build_interpreter(EXAMPLE.write_source(root / 'source', source=example), engine,
                                     root / 'site/console', language_profile='classes-source/1')
        reduced = build_interpreter(EXAMPLE.write_source(root / 'core-source', source='print([1.5])\n'),
                                    engine, root / 'reduced')
        server = Server(('127.0.0.1', 0), partial(Handler, directory=str(root / 'site')))
        server.paths = []
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://127.0.0.1:{server.server_port}/console/'
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch()
                try:
                    context = browser.new_context()
                    page = context.new_page()
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))

                    def ready():
                        page.wait_for_function("()=>document.querySelector('#status').textContent==='Ready'")

                    def run(source, stdout, error=None):
                        page.fill('#input', source)
                        page.click('#run')
                        page.wait_for_function("()=>document.querySelector('#status').textContent!=='Running…'")
                        status = page.locator('#status').inner_text()
                        assert status.startswith(error + ':') if error else status == 'Completed', (status, source)
                        assert page.locator('#result').inner_text() == stdout, source

                    page.goto(url)
                    ready()
                    page.wait_for_function("()=>document.querySelector('#offline').textContent==='Offline ready on this device'")
                    context.set_offline(True)
                    page.reload()
                    ready()
                    run(example, expected)
                    checks.append('report-example-after-offline-reload')
                    for case in corpus['cases']:
                        if case['stage'] != 'LA192' or case.get('modules'):
                            continue
                        run(case['source'], case['stdout'], case.get('error_type'))
                        if case['id'] == 'display-original-dynamic-frame':
                            assert '__repr__ at display-original.py:2' in page.locator('#diagnostic').inner_text()
                        checks.append(case['id'])
                    for expression in ['[Slow()]', '{Slow(): [1.5]}']:
                        source = 'class Slow:\n def __repr__(self):\n  print("entered")\n  while True: pass\nprint(' + expression + ')\n'
                        page.fill('#input', source)
                        page.click('#run')
                        page.wait_for_function("()=>document.querySelector('#result').textContent==='entered\\n'")
                        page.click('#stop')
                        page.wait_for_function("()=>document.querySelector('#status').textContent==='Stopped'")
                        page.click('#restart')
                        ready()
                        run('print([1.5],-0.0,{"ready":True})\n', "[1.5] -0.0 {'ready': True}\n")
                        checks.append('stop-repr-callback-and-fresh-restart-' + str(len(checks)))
                    context.set_offline(False)
                    shutil.rmtree(root / 'site/console')
                    shutil.copytree(root / 'reduced', root / 'site/console')
                    page.evaluate('async()=>{await(await navigator.serviceWorker.getRegistration()).update()}')
                    page.wait_for_function("()=>document.querySelector('#offline').textContent.startsWith('Update ready.')")
                    run(example, expected)
                    page.close()
                    probe = context.new_page()
                    old = 'pocket-python:' + url + ':' + selected['cache_version']
                    new = 'pocket-python:' + url + ':' + reduced['cache_version']
                    probe.goto(url.replace('/console/', '/missing'))
                    probe.wait_for_function('async({old,next})=>{const keys=await caches.keys();return !keys.includes(old)&&keys.includes(next)}',
                                            arg={'old': old, 'next': new})
                    probe.close()
                    context.set_offline(True)
                    page = context.new_page()
                    page.goto(url)
                    ready()
                    run('print([1.5],(1,),{"a":2})\n', "[1.5] (1,) {'a': 2}\n")
                    checks.append('core-profile-update-offline-display-and-old-cache-removal')
                    assert not errors, errors
                finally:
                    browser.close()
        finally:
            server.shutdown()
            thread.join()
            server.server_close()
    return {'schema_version': 1, 'suite': 'interpreter-ordinary-display-offline/1',
            'installed_distribution_required': require_installed, 'package_origin': str(package),
            'corpus_sha256': hashlib.sha256(corpus_path.read_bytes()).hexdigest(),
            'engine_fingerprint': selected['engine']['fingerprint'], 'checks': checks,
            'summary': {'pass': len(checks), 'fail': 0}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-installed', action='store_true')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    report = smoke(args.require_installed)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['summary']))
