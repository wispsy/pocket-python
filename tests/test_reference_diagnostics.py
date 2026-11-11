import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


with patch.object(sys, "path", [str(Path(__file__).resolve().parents[1] / "runtime"), *sys.path]):
    import check_classes


class ReferenceDiagnosticsTests(unittest.TestCase):
    def test_case_partitions_are_complete_disjoint_ordered_and_reject_empty_slices(self):
        cases = list(range(11))
        parts = [check_classes.case_partition(cases, index, 4) for index in range(1, 5)]
        self.assertEqual(parts, [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7]])
        self.assertCountEqual([case for part in parts for case in part], cases)
        self.assertEqual(check_classes.case_partition(cases), cases)
        for index, count in [(0, 4), (5, 4), (1, 0), (1, 12), (True, 4), (1, 1.5)]:
            with self.subTest(index=index, count=count), self.assertRaises(ValueError):
                check_classes.case_partition(cases, index, count)

    def test_partition_caches_coexist_reuse_and_validate_the_same_selected_cases(self):
        corpus = {'profile': 'classes-source/1', 'cases': [
            {'id': f'case-{index}', 'stage': 'C1', 'source': 'pass', 'stdout': ''} for index in range(5)]}
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path, cache = root / 'corpus.json', root / 'cache'
            path.write_text(json.dumps(corpus), encoding='utf-8')
            with patch.object(check_classes, 'reference_case', return_value={'ok': True, 'stdout': ''}) as reference:
                first = check_classes.cached_references(path, cache, 1, 2)
                second = check_classes.cached_references(path, cache, 2, 2)
                self.assertEqual([case['id'] for case in first['cases']], ['case-0', 'case-2', 'case-4'])
                self.assertEqual([case['id'] for case in second['cases']], ['case-1', 'case-3'])
                self.assertEqual(second['case_partition'], {'index': 2, 'count': 2, 'selected': 2, 'total': 5})
                self.assertTrue(check_classes.cached_references(path, cache, 1, 2)['reference_cache']['hit'])
                self.assertTrue(check_classes.cached_references(path, cache, 2, 2)['reference_cache']['hit'])
                self.assertEqual(reference.call_count, 5)
                self.assertFalse(check_classes.cached_references(path, cache, 1, 3)['reference_cache']['hit'])
                self.assertFalse(check_classes.cached_references(path, cache)['reference_cache']['hit'])
                self.assertEqual(len(list(cache.glob('*.json'))), 4)
                corpus['cases'][0]['stage'] = 'changed'
                path.write_text(json.dumps(corpus), encoding='utf-8')
                self.assertFalse(check_classes.cached_references(path, cache, 1, 2)['reference_cache']['hit'])
                self.assertFalse(check_classes.cached_references(path, cache, 2, 2)['reference_cache']['hit'])
                self.assertEqual(len(list(cache.glob('*.json'))), 4)

    def test_source_and_oracle_requests_use_the_identical_partition(self):
        corpus = {'profile': 'classes-source/1', 'cases': [
            {'id': f'case-{index}', 'stage': 'C1', 'source': 'pass', 'stdout': ''} for index in range(5)]}
        def source_response(command, *, input, **options):
            requests = json.loads(input)
            self.assertEqual([row['id'] for row in requests], ['case-1', 'case-3'])
            return json.dumps({'host': 'test-node', 'results': [
                {'id': row['id'], 'ok': True, 'stdout': ''} for row in requests]})
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / 'corpus.json'
            path.write_text(json.dumps(corpus), encoding='utf-8')
            with patch.dict(check_classes.os.environ, {'POCKET_PYTHON_REFERENCE_CACHE': str(root / 'cache')}), \
                    patch.object(check_classes, 'reference_case', return_value={'ok': True, 'stdout': ''}), \
                    patch.object(check_classes.subprocess, 'check_output', side_effect=source_response):
                report = check_classes.check('node', corpus_path=path, case_shard=2, case_shards=2)
        self.assertEqual(report['summary'], {'pass': 2, 'fail': 0})
        self.assertEqual(report['reference_summary'], {'pass': 2, 'fail': 0})
        self.assertEqual(report['corpus_cases'], 5)
        self.assertEqual(report['source_cases'], 2)
        self.assertEqual(report['case_partition'], {'index': 2, 'count': 2, 'selected': 2, 'total': 5})

    def test_cache_reuses_success_and_invalidates_corpus_python_and_harness(self):
        corpus = {'profile': 'classes-source/1', 'cases': [
            {'id': 'one', 'stage': 'C1', 'source': 'print(7)', 'stdout': '7\n'}]}
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path, cache = root / 'corpus.json', root / 'cache'
            path.write_text(json.dumps(corpus), encoding='utf-8')
            with patch.object(check_classes, 'reference_case', return_value={'ok': True, 'stdout': '7\n'}) as reference:
                first = check_classes.cached_references(path, cache)
                second = check_classes.cached_references(path, cache)
                self.assertFalse(first['reference_cache']['hit'])
                self.assertTrue(second['reference_cache']['hit'])
                self.assertEqual(first['cases'], second['cases'])
                self.assertEqual(reference.call_count, 1)
                # Metadata and expectation changes also invalidate the whole corpus.
                corpus['cases'][0]['stage'] = 'C2'
                path.write_text(json.dumps(corpus), encoding='utf-8')
                self.assertFalse(check_classes.cached_references(path, cache)['reference_cache']['hit'])
                with patch.object(check_classes.sys, 'version', sys.version.replace(sys.version.split()[0], '9.9.9', 1)):
                    self.assertFalse(check_classes.cached_references(path, cache)['reference_cache']['hit'])
                with patch.object(check_classes.platform, 'platform', return_value='another host'):
                    self.assertFalse(check_classes.cached_references(path, cache)['reference_cache']['hit'])
                original = Path.read_bytes
                def changed_harness(file):
                    data = original(file)
                    return data + b'\n# changed reference' if file.name == 'check_functions.py' else data
                with patch.object(Path, 'read_bytes', changed_harness):
                    self.assertFalse(check_classes.cached_references(path, cache)['reference_cache']['hit'])
                self.assertEqual(reference.call_count, 5)
                self.assertEqual(len(list(cache.glob('*.json'))), 1)

    def test_damaged_cache_is_recomputed_and_failed_reports_are_not_saved(self):
        corpus = {'profile': 'classes-source/1', 'cases': [
            {'id': 'one', 'stage': 'C1', 'source': 'print(7)', 'stdout': '7\n'}]}
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path, cache = root / 'corpus.json', root / 'cache'
            path.write_text(json.dumps(corpus), encoding='utf-8')
            with patch.object(check_classes, 'reference_case', return_value={'ok': True, 'stdout': '7\n'}) as reference:
                check_classes.cached_references(path, cache)
                saved_path, = cache.glob('*.json')
                for damaged in ('{truncated', 'null', '{}'):
                    saved_path.write_text(damaged, encoding='utf-8')
                    self.assertFalse(check_classes.cached_references(path, cache)['reference_cache']['hit'])
                saved = json.loads(saved_path.read_bytes())
                saved['report']['cases'][0]['reference']['stdout'] = 'tampered\n'
                saved_path.write_text(json.dumps(saved), encoding='utf-8')
                self.assertFalse(check_classes.cached_references(path, cache)['reference_cache']['hit'])
                self.assertEqual(reference.call_count, 5)
                # Reference-only validation always executes the oracle afresh.
                check_classes.references(path)
                self.assertEqual(reference.call_count, 6)
            saved_path.unlink()
            with patch.object(check_classes, 'reference_case', return_value={'ok': True, 'stdout': 'wrong\n'}):
                self.assertEqual(check_classes.cached_references(path, cache)['summary']['fail'], 1)
            self.assertFalse(list(cache.iterdir()))

    def test_failed_process_identifies_the_case_and_preserves_the_cause(self):
        corpus = {"profile": "classes-source/1", "cases": [{"id": "failing-input", "stage": "test", "source": "pass"}]}
        for failure, detail in [(subprocess.CalledProcessError(-11, ["reference"]), "exit -11"),
                                (subprocess.TimeoutExpired(["reference"], 5), "timeout after 5s")]:
            with self.subTest(detail=detail), tempfile.TemporaryDirectory() as temporary:
                path = Path(temporary) / "corpus.json"
                path.write_text(json.dumps(corpus), encoding="utf-8")
                with patch.object(check_classes, "reference_case", side_effect=failure):
                    with self.assertRaisesRegex(RuntimeError, "failing-input.*" + detail) as raised:
                        check_classes.references(path)
                self.assertIs(raised.exception.__cause__, failure)

    def test_qualified_crashes_are_reported_without_reference_execution(self):
        boundary = {"id": "crashing-input", "owner": "#124", "classification": "retained-divergence", "boundary": "native crash"}
        corpus = {"profile": "classes-source/1", "cases": [], "reference_boundaries": [boundary]}
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "corpus.json"
            path.write_text(json.dumps(corpus), encoding="utf-8")
            with patch.object(check_classes, "reference_case") as reference:
                report = check_classes.references(path)
            reference.assert_not_called()
        self.assertEqual(report["reference_qualifications"], [boundary])
        self.assertEqual(report["summary"], {"pass": 0, "fail": 0})
