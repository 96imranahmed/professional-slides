import hashlib
import importlib.util
import json
import re
import struct
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('package_plugin', ROOT/'evals/scripts/package_plugin.py')
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)

MANIFESTS = ('plugin.json', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json')
# Loads every shipped runtime Python module from the staged package, each
# with its own directory first on sys.path as when it runs, and prints the
# files its runtime imports resolved to. A module whose third-party package
# is not installed here is reported as skipped rather than as a failure.
PY_IMPORTS = '''
import importlib.util, json, sys
from pathlib import Path
runtime = Path(sys.argv[1])
loaded, skipped = {}, {}
for path in sorted(runtime.rglob("*.py")):
    sys.path.insert(0, str(path.parent))
    name = "shipped_" + path.stem.replace("-", "_")
    spec = importlib.util.spec_from_file_location(name, path)
    try:
        spec.loader.exec_module(importlib.util.module_from_spec(spec))
        loaded[str(path.relative_to(runtime))] = True
    except (ImportError, SystemExit) as error:
        if getattr(error, "name", None) in {"pptx", "PIL", "numpy", "lxml", "pypdf"} or isinstance(error, SystemExit):
            skipped[str(path.relative_to(runtime))] = str(error)
        else:
            raise
    sys.path.remove(str(path.parent))
files = sorted({str(Path(m.__file__).resolve()) for m in list(sys.modules.values()) if getattr(m, "__file__", None)})
print(json.dumps({"loaded": sorted(loaded), "skipped": skipped, "files": files}))
'''

# Static imports and literal asset reads relative to the module doing them.
IMPORT = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}/[^'"]+)\1""")
ASSET_URL = re.compile(r"""new URL\(\s*(['"])(\.{1,2}/[^'"$]+)\1\s*,\s*import\.meta\.url\s*\)""")


def write_manifests(source):
    for name in MANIFESTS:
        (source/name).parent.mkdir(parents=True, exist_ok=True)
        (source/name).write_text('{}')


class RealPackage:
    """The package built from this checkout, once per test class, into a temp dir."""

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        cls.dest = Path(cls._tmp.name)/'pkg'
        packager.package(ROOT, cls.dest)
        cls.files = json.loads((cls.dest/'package-manifest.json').read_text())['files']

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()


class PluginDistributionTests(unittest.TestCase):
    def test_portable_manifest_matches_codex_compatibility_manifest(self):
        portable = json.loads((ROOT/'plugin.json').read_text())
        compatibility = json.loads((ROOT/'.codex-plugin/plugin.json').read_text())
        self.assertEqual(portable['$schema'], 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')
        for key in ('name', 'version', 'description', 'author'):
            self.assertEqual(portable[key], compatibility[key])
        self.assertEqual(portable['extensions']['com.openai']['interface'], compatibility['interface'])

    def test_claude_code_manifest_matches_the_others(self):
        claude = json.loads((ROOT/'.claude-plugin/plugin.json').read_text())
        compatibility = json.loads((ROOT/'.codex-plugin/plugin.json').read_text())
        for key in ('name', 'version', 'description', 'author'):
            self.assertEqual(claude[key], compatibility[key], key)
        self.assertRegex(claude['name'], r'^[a-z0-9]+(-[a-z0-9]+)*$', 'Claude Code plugin names are kebab-case')

    def test_no_manifest_claims_google_slides_output(self):
        # The runtime writes PPTX. Google Slides is an import the user verifies
        # separately (references/tools/production.md), not an output format.
        for name in MANIFESTS:
            data = json.loads((ROOT/name).read_text())
            with self.subTest(manifest=name):
                self.assertNotIn('Google Slides', data['description'])
                interface = data.get('interface') or data.get('extensions', {}).get('com.openai', {}).get('interface')
                for capability in (interface or {}).get('capabilities', []):
                    self.assertNotRegex(capability, r'(?i)(PowerPoint and Google Slides|Google Slides (authoring|decks|output))')

    def test_package_preserves_icon_bytes_and_excludes_non_asset_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, dest = Path(tmp)/'source', Path(tmp)/'package'
            source.mkdir()
            write_manifests(source)
            (source/'assets').mkdir()
            icon = b'\x89PNG\r\n\x1a\nicon-fixture'
            (source/'assets/icon.png').write_bytes(icon)
            (source/'assets/private.txt').write_text('excluded')
            skill_assets = source/'skills/professional-slides/assets'
            skill_assets.mkdir(parents=True)
            (skill_assets/'map.png').write_bytes(icon)
            (skill_assets/'LICENSE').write_text('Asset license')
            packager.package(source, dest)
            self.assertEqual((dest/'assets/icon.png').read_bytes(), icon)
            self.assertFalse((dest/'assets/private.txt').exists())
            self.assertEqual((dest/'skills/professional-slides/assets/map.png').read_bytes(), icon)
            self.assertEqual((dest/'skills/professional-slides/assets/LICENSE').read_text(), 'Asset license')

    def test_package_excludes_generated_private_and_dependency_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, dest = Path(tmp)/'source', Path(tmp)/'package'
            for name in [*MANIFESTS, 'skills/demo/SKILL.md', 'evals/scripts/check.py', 'output/private.pptx',
                         'tmp/input.json', 'deliverables/report.json', '.context-engine.toml', 'package.json',
                         'package-lock.json', 'node_modules/pkg/package.json', 'skills/demo/__pycache__/x.py',
                         'skills/demo/runtime/__pycache__/x.py', 'skills/demo/output/data.json',
                         'skills/demo/outputs/data.json', 'skills/demo/dist/package.json', 'skills/demo/notes.txt']:
                p=source/name; p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{}')
            packager.package(source,dest)
            files=json.loads((dest/'package-manifest.json').read_text())['files']
            # Development tooling under evals/ and the Node dev manifest never ship.
            self.assertEqual(set(files),{*MANIFESTS,'skills/demo/SKILL.md'})
            self.assertFalse((dest/'output').exists())
            packager.package(source,dest)

    def test_the_allowlist_admits_the_skill_and_refuses_what_only_the_suite_uses(self):
        ships = lambda rel: packager.shipped(packager.PurePosixPath(rel))
        for rel in ['requirements.txt', 'README.md', 'assets/icon.png', 'skills/s/SKILL.md', 'skills/s/agents/openai.yaml',
                    'skills/s/references/charts.md', 'skills/s/references/evaluation/rules.json',
                    'skills/s/runtime/compose-deck.mjs', 'skills/s/runtime/gates/page_gates.py',
                    'skills/s/runtime/fonts/arial-metrics.json', 'skills/s/runtime/README.md',
                    'skills/s/examples/page-types.pages.json', 'skills/s/examples/assets/hills.jpg',
                    'skills/s/assets/simple-icons/LICENSE.md', 'skills/s/assets/lucide/LICENSE',
                    'skills/s/assets/design-options/options.json',
                    # The build runs the scene design checks, so the overlap module ships with what it imports.
                    'skills/s/runtime/validate-overlap.mjs', 'skills/s/runtime/text-layout.mjs']:
            self.assertTrue(ships(rel), rel)
        for rel in ['package.json', 'package-lock.json', 'evals/run.sh', 'evals/support/compose.mjs', 'assets/notes/icon.png',
                    'skills/s/runtime/gates/.gitignore', 'skills/s/examples/page-types.author-log.jsonl',
                    'skills/s/examples/gallery-acceptance.deck.json', 'skills/s/examples/assets/notes.txt',
                    'skills/s/scratch/x.mjs', 'skills/s/.DS_Store']:
            self.assertFalse(ships(rel), rel)

    def test_checkout_package_survives_artifact_cleanup(self):
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)/'source'
            (source/'.git').mkdir(parents=True)
            write_manifests(source)
            output = source/'output'
            output.mkdir()
            (output/'artifact.json').write_text('{}')
            dest = source/'dist/professional-slides'
            packager.package(source, dest)
            shutil.rmtree(output)
            self.assertTrue((dest/'.codex-plugin/plugin.json').is_file())
            self.assertTrue((dest/'.claude-plugin/plugin.json').is_file())
            packager.package(source, dest)
            with self.assertRaises(ValueError):
                packager.package(source, source/'output/package')
            (source/'.git').rmdir()
            with self.assertRaises(ValueError):
                packager.package(source, dest)

    def test_a_source_without_every_manifest_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)/'source'
            source.mkdir()
            write_manifests(source)
            (source/'.claude-plugin/plugin.json').unlink()
            with self.assertRaisesRegex(ValueError, 'claude-plugin'):
                packager.package(source, Path(tmp)/'pkg')

    def test_a_staged_package_is_not_edited_by_hand(self):
        """A staged package is a build output, and its manifest records a hash per file.

        The version sits in the source manifests and the packager copies them,
        so a staged copy can only disagree with its manifest when someone edits
        it by hand - which is exactly what happened once, when a version bump
        was applied to the staged copy instead of to the source followed by a
        rebuild. `package_plugin.py --verify` is the same check on `dist/`.
        """
        with tempfile.TemporaryDirectory() as tmp:
            source, dest = Path(tmp)/'source', Path(tmp)/'pkg'
            write_manifests(source)
            (source/'skills/demo').mkdir(parents=True)
            (source/'skills/demo/SKILL.md').write_text('# Demo\n')
            packager.package(source, dest)
            self.assertEqual(packager.verify(dest), [])
            (dest/'.codex-plugin/plugin.json').write_text('{"version": "0.0.2"}')
            (dest/'skills/demo/extra.md').write_text('added by hand')
            (dest/'skills/demo/SKILL.md').unlink()
            self.assertEqual(packager.verify(dest), ['.codex-plugin/plugin.json', 'skills/demo/SKILL.md (missing)',
                                                     'skills/demo/extra.md (unrecorded)'])

    def test_package_rejects_unowned_destination_and_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            source,dest=Path(tmp)/'source',Path(tmp)/'dest'
            source.mkdir();dest.mkdir();(dest/'keep').write_text('keep')
            with self.assertRaises(ValueError):packager.package(source,dest)
            self.assertEqual((dest/'keep').read_text(),'keep')
            write_manifests(source)
            (source/'skills').mkdir();(source/'skills/leak.md').symlink_to(dest/'keep')
            (source/'skills/s').mkdir();(source/'skills/s/SKILL.md').symlink_to(dest/'keep')
            with self.assertRaises(ValueError):packager.package(source,Path(tmp)/'new')


class ShippedPackageTests(RealPackage, unittest.TestCase):
    """The package this checkout builds, rather than a fixture of one."""

    def test_it_carries_every_manifest_the_readme_and_the_python_requirements(self):
        for name in (*MANIFESTS, 'README.md', 'requirements.txt', 'assets/icon.png',
                     'skills/professional-slides/SKILL.md'):
            self.assertIn(name, self.files)
        self.assertNotIn('package.json', self.files, 'the dev manifest names devDependencies and scripts into evals/')
        self.assertIn('python-pptx', (self.dest/'requirements.txt').read_text())

    def test_it_leaves_out_what_only_the_suite_uses(self):
        self.assertNotIn('skills/professional-slides/examples/gallery-acceptance.deck.json', self.files)
        self.assertFalse([f for f in self.files if f.endswith('.jsonl') or '__pycache__' in f])
        self.assertFalse([f for f in self.files if f.startswith(('evals/', 'output/', 'dist/', 'node_modules/'))])

    def test_every_shipped_module_resolves_its_imports_and_assets_inside_the_package(self):
        """A shipped module that imports what does not ship (the suite's evals/support/) fails here."""
        unresolved = []
        for rel in self.files:
            if not rel.endswith('.mjs'):
                continue
            path = self.dest/rel
            text = path.read_text(encoding='utf-8')
            for pattern in (IMPORT, ASSET_URL):
                for match in pattern.finditer(text):
                    target = (path.parent/match.group(2)).resolve()
                    if not target.exists():
                        unresolved.append(f'{rel}: {match.group(2)}')
        self.assertEqual(unresolved, [], '\n'.join(unresolved))

    def test_every_shipped_python_module_resolves_its_imports_inside_the_package(self):
        runtime = self.dest/'skills/professional-slides/runtime'
        run = subprocess.run([sys.executable, '-c', PY_IMPORTS, str(runtime)], capture_output=True, text=True,
                             cwd=self.dest, timeout=120, env={'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'})
        self.assertEqual(run.returncode, 0, run.stderr)
        result = json.loads(run.stdout)
        # The page gates, the density profile and the shared word module need nothing outside the stdlib.
        for rel in ('gates/page_gates.py', 'gates/gate_config.py', 'gates/text_stats.py', 'gates/density_profile.py',
                    'gates/nice_ticks.py', 'emit/color.py'):
            self.assertIn(rel, result['loaded'])
        checkout = str((ROOT/'skills').resolve())
        self.assertEqual([f for f in result['files'] if f.startswith(checkout)], [],
                         'a shipped module imported a file from the checkout instead of the package')
        staged = [f for f in result['files'] if f.startswith(str(runtime.resolve()))]
        for module in ('gate_config.py', 'render_gates.py', 'scene_gates.py', 'semantic_gates.py', 'deck_gates.py', 'text_stats.py'):
            self.assertTrue(any(f.endswith('/gates/' + module) for f in staged), module)

    def test_the_icon_is_sized_for_a_listing(self):
        data = (self.dest/'assets/icon.png').read_bytes()
        self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
        width, height = struct.unpack('>II', data[16:24])
        self.assertEqual((width, height), (512, 512))
        self.assertLess(len(data), 400_000)

    def test_the_manifest_records_every_file_it_copied(self):
        self.assertEqual(packager.verify(self.dest), [])
        for rel, entry in self.files.items():
            source = ROOT/rel
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), entry['sha256'], rel)


if __name__ == '__main__':
    unittest.main()
