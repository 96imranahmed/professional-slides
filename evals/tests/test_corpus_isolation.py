"""The skill never reaches for the calibration corpus.

An installed copy of the skill opened client decks from the developer's corpus
folder: the text contract required every page to cite corpus pages by file,
page and hash, the atlas cited decks by name and page and said to "search the
available corpus", and the plugin package shipped the page records. The
targets now ship as numbers only, and nothing shipped names a document.
"""
import json
import re
import tempfile
import unittest
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / 'skills' / 'professional-slides'
spec = importlib.util.spec_from_file_location('package_plugin', ROOT / 'evals/scripts/package_plugin.py')
package_plugin = importlib.util.module_from_spec(spec); spec.loader.exec_module(package_plugin)

# Anything that tells a reader of the shipped plugin that a corpus exists, where
# its numbers came from, or which documents were in it.
LEAKS = re.compile(r"corpus|/Users/|client[- ]?(?:deck|page|work|project|engagement)s?\b"
                   r"|published (?:deck|work|page|report|slideshow)s?\b|thought leadership|vision pass|calibration sample"
                   r"|[a-z]+-[a-z0-9-]+-(?:19|20)\d\d\.pdf|\b(?:mckinsey|bcg|bain|deloitte|l\.e\.k|oliver wyman)\b", re.I)
TEXT = {'.md', '.mjs', '.js', '.py', '.json', '.jsonl', '.yaml', '.yml', '.toml', '.txt', '.svg', '.sh', '.csv'}
# evals/ never ships, but it is shared with the repository: it may talk about
# calibration, never say where the set lives or which documents are in it.
MACHINE_PATH = re.compile(r"/Users/[A-Za-z0-9._-]|/home/[a-z]|[A-Z]:\\\\Users|/private/var/|/var/folders/")
DOCUMENT_NAME = re.compile(r"[a-z]+-[a-z0-9-]+-(?:19|20)\d\d\.pdf", re.I)
FIRMS = re.compile(r"\b(?:mckinsey|bcg|bain|deloitte|accenture|kearney|booz|kpmg|pwc|l\.e\.k|oliver wyman)\b", re.I)
# The directories that describe the calibration set or record runs against it.
# Specimens and their decks are about their own subjects and may name anyone.
CALIBRATION_FACING = ('evals/calibration', 'evals/quality', 'evals/client-deck-benchmark.md', 'evals/README.md')


def evals_text_files():
    for path in sorted((ROOT / 'evals').rglob('*')):
        rel = path.relative_to(ROOT).as_posix()
        if not path.is_file() or path.suffix not in TEXT or '__pycache__' in rel or rel.startswith('evals/quality/runs/'):
            continue
        if path.name == Path(__file__).name:  # this file spells the patterns out
            continue
        yield rel, path


class CorpusIsolationTests(unittest.TestCase):
    def test_shipped_task_targets_are_numbers_only(self):
        tasks = json.loads((SKILL / 'runtime' / 'reading-tasks.json').read_text())['tasks']
        for name, task in tasks.items():
            self.assertEqual(set(task), {'commentary', 'bodyWords', 'totalWords'}, name)
            self.assertLessEqual(task['bodyWords']['q1'], task['bodyWords']['median'])

    def test_nothing_in_the_package_mentions_the_corpus(self):
        # Scan the real package, not the source tree: it is what gets shared.
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'pkg'
            package_plugin.package(ROOT, dest)
            offenders = []
            for path in dest.rglob('*'):
                if path.is_file() and path.suffix in TEXT:
                    for i, line in enumerate(path.read_text(encoding='utf-8', errors='ignore').splitlines(), 1):
                        if LEAKS.search(line):
                            offenders.append(f'{path.relative_to(dest)}:{i}: {LEAKS.search(line).group(0)}')
        self.assertEqual(offenders, [], '\n'.join(offenders[:40]))

    def test_evals_name_no_machine_path_and_no_calibration_document(self):
        offenders = []
        for rel, path in evals_text_files():
            for i, line in enumerate(path.read_text(encoding='utf-8', errors='ignore').splitlines(), 1):
                for pattern in (MACHINE_PATH, DOCUMENT_NAME):
                    if pattern.search(line):
                        offenders.append(f'{rel}:{i}: {pattern.search(line).group(0)}')
                if rel.startswith(CALIBRATION_FACING) and FIRMS.search(line):
                    offenders.append(f'{rel}:{i}: {FIRMS.search(line).group(0)}')
        self.assertEqual(offenders, [], '\n'.join(offenders[:40]))

    def test_the_calibration_tools_find_the_set_through_the_environment(self):
        for path in sorted((ROOT / 'evals' / 'calibration').glob('*.py')):
            text = path.read_text(encoding='utf-8')
            if 'corpus_root' in text and path.name != 'corpus.py':
                self.assertIn('from corpus import corpus_root', text, path.name)
        self.assertIn('PS_CALIBRATION_CORPUS', (ROOT / 'evals' / 'calibration' / 'corpus.py').read_text())
        # No data file that could name the set's documents sits beside the tools.
        data = [p.name for p in (ROOT / 'evals' / 'calibration').rglob('*') if p.suffix in {'.json', '.jsonl', '.csv'}]
        self.assertEqual(data, [])

    def test_the_package_is_the_skill_alone(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'pkg'
            package_plugin.package(ROOT, dest)
            files = json.loads((dest / 'package-manifest.json').read_text())['files']
            self.assertFalse([f for f in files if f.startswith('evals/')])
            self.assertIn('skills/professional-slides/runtime/reading-tasks.json', files)

    def test_a_page_names_its_task_and_is_held_to_its_numbers(self):
        from node_probe import run_node
        result = run_node('''
import { checkTextPlan } from './skills/professional-slides/runtime/text-contract.mjs';
const page = (task) => ({ n: 1, id: 'p', textPlan: [{ id: 't', role: 'title', text: 'A title' }, { id: 'b', role: 'body', text: 'word '.repeat(20) }], textReference: { task } });
const run = (task) => checkTextPlan({ textContract: 'complete', pages: [page(task)] }).findings.map(f => f.code);
console.log(JSON.stringify({ none: run(undefined), thin: run('chart-with-commentary'), led: run('chart-led') }));
''')
        self.assertEqual(result['none'], ['TEXT_REFERENCE_MISSING'])
        self.assertIn('TEXT_COVERAGE_LOW', result['thin'])
        self.assertIn('TEXT_COVERAGE_LOW', result['led'])


if __name__ == '__main__':
    unittest.main()
