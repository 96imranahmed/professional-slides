"""Public submission generation, distinct from plugin runtime acceptance."""
from pathlib import Path
import importlib.util
import json
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'evals/scripts'))
from package_submission import build_submission, validate, verify


class SubmissionPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.output = Path(cls.tmp.name)
        cls.result = build_submission(ROOT, cls.output)
        cls.package = cls.output / 'professional-slides'

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_rebuild_and_archive_have_the_same_inventory(self):
        result = build_submission(ROOT, self.output)
        self.assertEqual(verify(self.package), [])
        with zipfile.ZipFile(result['archive']) as archive:
            self.assertIsNone(archive.testzip())
            for name in archive.namelist():
                relative = Path(name).relative_to('professional-slides')
                self.assertEqual(archive.read(name), (self.package / relative).read_bytes())

    def test_public_manifest_matches_source_and_keeps_unknown_fields_absent(self):
        data = json.loads((self.package / 'plugin.json').read_text())
        self.assertEqual(data, json.loads((ROOT / 'plugin.json').read_text()))
        self.assertEqual(data['version'], '0.0.1')
        interface = data['extensions']['com.openai']['interface']
        self.assertLessEqual(len(interface['longDescription']), 4000)
        self.assertLessEqual(len(interface['shortDescription']), 30)
        for field in ['privacyPolicyURL', 'termsOfServiceURL']:
            self.assertNotIn(field, interface)
        self.assertNotIn('countries', data['extensions']['com.openai']['publication'])
        self.assertNotIn('review', data['extensions']['com.openai'])

    def test_public_copy_has_standalone_readme_and_dependency_command(self):
        self.assertEqual((self.package / 'README.md').read_bytes(),
                         (ROOT / 'submission/README-DISTRIBUTION.md').read_bytes())
        self.assertNotIn('](evals/', (self.package / 'README.md').read_text())
        for excluded in ['.app.json', 'mcp.json', '.mcp.json', 'package.json', 'package-lock.json', 'evals', 'submission']:
            self.assertFalse((self.package / excluded).exists(), excluded)

    def test_app_bindings_are_refused_without_changing_the_source(self):
        path = self.package / 'plugin.json'
        original = path.read_bytes()
        source = (ROOT / 'plugin.json').read_bytes()
        try:
            data = json.loads(original)
            data['extensions']['com.openai']['apps'] = './.app.json'
            path.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, 'bindings'):
                validate(self.package)
            self.assertEqual((ROOT / 'plugin.json').read_bytes(), source)
        finally:
            path.write_bytes(original)

    def test_invalid_listing_is_refused(self):
        path = self.package / 'plugin.json'
        original = path.read_bytes()
        try:
            data = json.loads(original)
            data['extensions']['com.openai']['interface']['shortDescription'] = 'x' * 31
            path.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, 'shortDescription'):
                validate(self.package)
        finally:
            path.write_bytes(original)


if __name__ == '__main__':
    unittest.main()
