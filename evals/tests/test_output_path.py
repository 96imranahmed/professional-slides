"""Where a build may write, and what it may call its files.

runtime/output-path.mjs refuses an output directory inside the installed
plugin (through a symlink too) while a developer checkout keeps its output/;
runtime/artifact-path.mjs refuses a deck id that is not a safe filename, so no
id can write or delete outside the output directory.
"""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, requires_python_package, run_node

_spec = importlib.util.spec_from_file_location('package_plugin', ROOT / 'evals/scripts/package_plugin.py')
packager = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(packager)


class OutputDirectoryTests(unittest.TestCase):
    def test_developer_output_exception_and_symlink_escape(self):
        """PR #4 follow-up: a checkout's output/ is writable, but a symlink out of it into the skill is not."""
        run_node('''
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {assertOutputDirectory} from './skills/professional-slides/runtime/output-path.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'output-guard-'));
try {
 await fs.mkdir(path.join(root,'.git'));
 await fs.mkdir(path.join(root,'output'));
 assert.equal(await assertOutputDirectory(path.join(root,'output/task'),root),path.join(await fs.realpath(root),'output/task'));
 await fs.symlink(root,path.join(root,'output/escape'));
 await assert.rejects(assertOutputDirectory(path.join(root,'output/escape/skills/new'),root),/read-only/);
 await assert.rejects(assertOutputDirectory(path.join(root,'skills/new'),root),/read-only/);
} finally {await fs.rm(root,{recursive:true,force:true});}
console.log(JSON.stringify({ok:true}));
''')


class ArtifactNameTests(unittest.TestCase):
    def test_unsafe_ids_cannot_write_or_delete_outside_output(self):
        """PR #4 review: a deck id of "../escape" could write or delete outside the output directory."""
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);out=root/'out';out.mkdir()
            protected=root/'escape-DELIVERED.pptx';protected.write_text('keep')
            for value in ['../escape','/absolute','folder/file',r'folder\file']:
                spec=root/'spec.json';spec.write_text(json.dumps({'schema':'professional-slides.deck/v3','id':value,'slides':[]}))
                for command in ['build-deck.mjs','deliver-deck.mjs']:
                    result=subprocess.run([NODE,str(RUNTIME/command),str(spec),str(out)],capture_output=True,text=True)
                    self.assertEqual(result.returncode,1,result.stderr)
                    self.assertIn('safe filename',result.stderr)
                self.assertEqual(protected.read_text(),'keep')
                self.assertEqual(list(out.iterdir()),[])


@requires_python_package('pptx')
class PackagedPluginOutputTests(unittest.TestCase):
    """The packaged plugin builds its examples and keeps its own tree read-only."""

    def cli(self, *args):
        return subprocess.run([NODE, *map(str, args)], capture_output=True, text=True,
                              env={**os.environ, 'RUNTIME_PYTHON': sys.executable}, cwd=ROOT, timeout=120)

    def test_package_compiles_examples_and_rejects_plugin_local_outputs(self):
        """PR #4 follow-up: an installed plugin let build and deliver write inside the plugin, and through a symlink to it."""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            package = root / 'plugin'
            packager.package(ROOT, package)
            skill = package / 'skills/professional-slides'
            image = skill / 'examples/assets/hills.jpg'
            self.assertEqual(image.read_bytes(), (ROOT / 'skills/professional-slides/examples/assets/hills.jpg').read_bytes())
            manifest = json.loads((package / 'package-manifest.json').read_text())
            self.assertIn('skills/professional-slides/examples/assets/hills.jpg', manifest['files'])
            # The package is the skill alone; the development scripts stay here.
            self.assertFalse([f for f in manifest['files'] if f.startswith('evals/')])
            for example in ['house-style', 'nyc-or-sf']:
                result = self.cli(ROOT / 'evals/scripts/compile_scene.mjs',
                                  skill / f'examples/{example}.deck.json', root / f'{example}.scene.json')
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertGreater(len(json.loads((root / f'{example}.scene.json').read_text())['slides']), 1)
            spec = root / 'spec.json'
            spec.write_text(json.dumps({'schema': 'professional-slides.deck/v3', 'id': 'safe', 'cover': {'title': 'Decision'}, 'slides': []}))
            alias = root / 'alias'
            alias.symlink_to(package, target_is_directory=True)
            dangling = root / 'dangling'
            dangling.symlink_to(package / 'new-output', target_is_directory=True)
            for output in [package, package / 'new-output', alias / 'nested/output', dangling / 'nested']:
                for command in ['build-deck.mjs', 'deliver-deck.mjs']:
                    result = self.cli(skill / f'runtime/{command}', spec, output, '--preflight')
                    self.assertEqual(result.returncode, 1, result.stderr)
                    self.assertIn('Plugin files are read-only', result.stderr)
            self.assertFalse((package / 'new-output').exists())
            self.assertFalse((package / 'nested').exists())
            self.assertFalse((package / 'scene.json').exists())
            # A writable installation must retain existing reports and deliveries.
            (package / 'scene.json').write_text('keep scene')
            (package / 'safe-DELIVERED.pptx').write_text('keep delivery')
            for command in ['build-deck.mjs', 'deliver-deck.mjs']:
                self.cli(skill / f'runtime/{command}', spec, alias)
            self.assertEqual((package / 'scene.json').read_text(), 'keep scene')
            self.assertEqual((package / 'safe-DELIVERED.pptx').read_text(), 'keep delivery')
            result = self.cli(skill / 'runtime/build-deck.mjs', spec, root / 'external', '--preflight')
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
