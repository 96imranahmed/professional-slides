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
    def test_package_excludes_generated_private_and_dependency_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, dest = Path(tmp)/'source', Path(tmp)/'package'
            for name in ['.codex-plugin/plugin.json','skills/demo/SKILL.md','evals/scripts/check.py', 'output/private.pptx','tmp/input.json','deliverables/report.json','.context-engine.toml','node_modules/pkg/package.json','skills/demo/__pycache__/x.py','skills/demo/output/data.json']:
                p=source/name; p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{}')
            packager.package(source,dest)
            files=json.loads((dest/'package-manifest.json').read_text())['files']
            self.assertEqual(set(files),{'.codex-plugin/plugin.json','skills/demo/SKILL.md','evals/scripts/check.py'})
            self.assertFalse((dest/'output').exists())
            packager.package(source,dest)

    def test_package_rejects_unowned_destination_and_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            source,dest=Path(tmp)/'source',Path(tmp)/'dest'
            source.mkdir();dest.mkdir();(dest/'keep').write_text('keep')
            with self.assertRaises(ValueError):packager.package(source,dest)
            self.assertEqual((dest/'keep').read_text(),'keep')
            (source/'skills').mkdir();(source/'skills/leak.md').symlink_to(dest/'keep')
            with self.assertRaises(ValueError):packager.package(source,Path(tmp)/'new')

    def test_output_guard_blocks_plugin_and_symlink_bypass(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);plugin=base/'plugin';plugin.mkdir();outside=base/'work';outside.mkdir()
            (outside/'alias').symlink_to(plugin,target_is_directory=True)
            script=f'''import {{assertOutputDirectory}} from {json.dumps((ROOT/'skills/professional-slides/runtime/output-path.mjs').as_uri())};
import assert from 'node:assert/strict';
const plugin={json.dumps(str(plugin))};
await assert.rejects(assertOutputDirectory(plugin+'/output/deck',plugin), /read-only/);
await assert.rejects(assertOutputDirectory({json.dumps(str(outside/'alias/deck'))},plugin), /read-only/);
await assertOutputDirectory({json.dumps(str(outside/'output/deck'))},plugin);
'''
            r=subprocess.run([os.environ.get('RUNTIME_NODE','node'),'--input-type=module','-e',script],capture_output=True,text=True)
            self.assertEqual(r.returncode,0,r.stderr)
            self.assertFalse((plugin/'output').exists())
