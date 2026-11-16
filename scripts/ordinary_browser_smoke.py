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


def smoke(require_installed=False, aggregations=False, traversals=False):
    package = Path(pocket_python.__file__).resolve()
    if require_installed:
        assert not package.is_relative_to(ROOT), 'Requires an isolated installed distribution.'
    assert platform.python_version() == '3.14.7'
    feature = 'traversals' if traversals else 'aggregations' if aggregations else 'display'
    corpus_path = ROOT / f'tests/fixtures/interpreter/{"formatting" if feature == "display" else feature}.json'
    corpus = json.loads(corpus_path.read_bytes())
    example = (ROOT / f'examples/interpreter_{feature}.py').read_text(encoding='utf-8')
    expected = subprocess.check_output([sys.executable, '-I', '-S', '-c', example], text=True, timeout=10)
    if traversals:
        stages = {'LA198', 'LA201'}
        frame = 'apply at traversal-original.py:2'
        restart_source = 'print(list(enumerate(map(abs,filter(None,[-2,0,3])),1)),list(zip([1,2],[3,4],strict=True)))\n'
        restart_stdout = '[(1, 2), (2, 3)] [(1, 3), (2, 4)]\n'
        callbacks = [
            ('map', 'def apply(x):\n print("entered")\n while True: pass\nnext(map(apply,[1]))\n'),
            ('filter', 'def accept(x):\n print("entered")\n while True: pass\nnext(filter(accept,[1]))\n'),
            ('filter-truth', 'class Slow:\n def __bool__(self):\n  print("entered")\n  while True: pass\nnext(filter(None,[Slow()]))\n'),
            ('acquisition', 'class Slow:\n def __iter__(self):\n  print("entered")\n  while True: pass\nmap(abs,Slow())\n'),
            ('enumerate-index', 'class Slow:\n def __index__(self):\n  print("entered")\n  while True: pass\nenumerate([],Slow())\n'),
            ('zip-pull', 'class Slow:\n def __iter__(self): return self\n def __next__(self):\n  print("entered")\n  while True: pass\nnext(zip([1],Slow()))\n'),
            ('zip-strict', 'class Slow:\n def __bool__(self):\n  print("entered")\n  while True: pass\nzip(strict=Slow())\n'),
        ]
    elif aggregations:
        stage = 'LA195'
        frame = 'key at aggregation-original.py:2'
        restart_source = 'print(min([2,1]),max([2,1]),sum([1e16,1.,-1e16]))\n'
        restart_stdout = '1 2 1.0\n'
        callbacks = [
            ('key', 'def key(value):\n print("entered")\n while True: pass\nmin([1],key=key)\n'),
            ('comparison', 'class Slow:\n def __lt__(self,other):\n  print("entered")\n  while True: pass\nmin([Slow(),Slow()])\n'),
            ('addition', 'class Slow:\n def __add__(self,other):\n  print("entered")\n  while True: pass\nsum([1],Slow())\n'),
        ]
    else:
        stage = 'LA192'
        frame = '__repr__ at display-original.py:2'
        restart_source = 'print([1.5],-0.0,{"ready":True})\n'
        restart_stdout = "[1.5] -0.0 {'ready': True}\n"
        callbacks = [(name, 'class Slow:\n def __repr__(self):\n  print("entered")\n  while True: pass\nprint(' + expression + ')\n')
                     for name, expression in [('list-repr', '[Slow()]'), ('dict-key-repr', '{Slow(): [1.5]}')]]
    if not traversals:
        stages = {stage}
    checks = []
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        engine = read_interpreter(ROOT / 'runtime')
        selected = build_interpreter(EXAMPLE.write_source(root / 'source', source=example), engine,
                                     root / 'site/console', language_profile='classes-source/1')
        reduced = build_interpreter(EXAMPLE.write_source(root / 'core-source', source=restart_source),
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
                        if case['stage'] not in stages or case.get('modules'):
                            continue
                        run(case['source'], case['stdout'], case.get('error_type'))
                        if case['id'].endswith('original-dynamic-frame'):
                            assert frame in page.locator('#diagnostic').inner_text()
                        checks.append(case['id'])
                    for name, source in callbacks:
                        page.fill('#input', source)
                        page.click('#run')
                        page.wait_for_function("()=>document.querySelector('#result').textContent==='entered\\n'")
                        page.click('#stop')
                        page.wait_for_function("()=>document.querySelector('#status').textContent==='Stopped'")
                        page.click('#restart')
                        ready()
                        run(restart_source, restart_stdout)
                        checks.append('stop-' + name + '-callback-and-fresh-restart')
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
                    run(restart_source, restart_stdout)
                    checks.append('core-profile-update-offline-' + feature + '-and-old-cache-removal')
                    assert not errors, errors
                finally:
                    browser.close()
        finally:
            server.shutdown()
            thread.join()
            server.server_close()
    return {'schema_version': 1, 'suite': f'interpreter-ordinary-{feature}-offline/1',
            'installed_distribution_required': require_installed, 'package_origin': str(package),
            'corpus_sha256': hashlib.sha256(corpus_path.read_bytes()).hexdigest(),
            'engine_fingerprint': selected['engine']['fingerprint'], 'checks': checks,
            'summary': {'pass': len(checks), 'fail': 0}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-installed', action='store_true')
    parser.add_argument('--aggregations', action='store_true', help='Accept selection and accumulation programs.')
    parser.add_argument('--traversals', action='store_true', help='Accept lazy transformations and traversal reports.')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    if args.aggregations and args.traversals:
        parser.error('Select one ordinary source feature.')
    report = smoke(args.require_installed, args.aggregations, args.traversals)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['summary']))
