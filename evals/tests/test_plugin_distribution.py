import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('package_plugin', ROOT/'evals/scripts/package_plugin.py')
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)

class PluginDistributionTests(unittest.TestCase):
    def test_package_preserves_icon_bytes_and_excludes_non_asset_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, dest = Path(tmp)/'source', Path(tmp)/'package'
            (source/'.codex-plugin').mkdir(parents=True)
            (source/'.codex-plugin/plugin.json').write_text('{}')
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
            for name in ['.codex-plugin/plugin.json','skills/demo/SKILL.md','evals/scripts/check.py', 'output/private.pptx','tmp/input.json','deliverables/report.json','.context-engine.toml','node_modules/pkg/package.json','skills/demo/__pycache__/x.py','skills/demo/output/data.json','skills/demo/outputs/data.json','skills/demo/dist/package.json']:
                p=source/name; p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{}')
            packager.package(source,dest)
            files=json.loads((dest/'package-manifest.json').read_text())['files']
            self.assertEqual(set(files),{'.codex-plugin/plugin.json','skills/demo/SKILL.md','evals/scripts/check.py'})
            self.assertFalse((dest/'output').exists())
            packager.package(source,dest)

    def test_checkout_package_survives_artifact_cleanup(self):
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)/'source'
            (source/'.git').mkdir(parents=True)
            (source/'.codex-plugin').mkdir()
            (source/'.codex-plugin/plugin.json').write_text('{}')
            output = source/'output'
            output.mkdir()
            (output/'artifact.json').write_text('{}')
            dest = source/'dist/professional-slides'
            packager.package(source, dest)
            shutil.rmtree(output)
            self.assertTrue((dest/'.codex-plugin/plugin.json').is_file())
            packager.package(source, dest)
            with self.assertRaises(ValueError):
                packager.package(source, source/'output/package')
            (source/'.git').rmdir()
            with self.assertRaises(ValueError):
                packager.package(source, dest)

    def test_package_rejects_unowned_destination_and_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            source,dest=Path(tmp)/'source',Path(tmp)/'dest'
            source.mkdir();dest.mkdir();(dest/'keep').write_text('keep')
            with self.assertRaises(ValueError):packager.package(source,dest)
            self.assertEqual((dest/'keep').read_text(),'keep')
            (source/'skills').mkdir();(source/'skills/leak.md').symlink_to(dest/'keep')
            with self.assertRaises(ValueError):packager.package(source,Path(tmp)/'new')
