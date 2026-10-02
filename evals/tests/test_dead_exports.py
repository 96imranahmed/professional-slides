"""An export nothing imports and its own module never uses is code nothing runs.

`evals/scripts/dead_exports.mjs` finds them, and `npm run check:syntax` fails
on one. These tests hold the finder to what it claims on a small tree, and
the runtime to having none.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from node_probe import run_node


def finder(root: str) -> list:
    return run_node(f"""
import {{ deadExports }} from './evals/scripts/dead_exports.mjs';
console.log(JSON.stringify(deadExports({json.dumps(root)}).map((d) => `${{d.file.split('/').pop()}}:${{d.name}}`).sort()));
""")


class DeadExportTests(unittest.TestCase):
    def test_the_finder_reads_imports_the_way_the_repository_writes_them(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runtime = root / "skills" / "professional-slides" / "runtime"
            runtime.mkdir(parents=True)
            (root / "evals" / "tests").mkdir(parents=True)
            (runtime / "a.mjs").write_text(
                "export const imported = 1;\n"
                "export const dead = 2;\n"
                "export const internal = 3;\n"
                "export const spread = [4];\n"
                "export const probed = 5;\n"
                "export const templated = 6;\n"
                "const local = internal + [...spread].length;\n"
                "export { local };\n", encoding="utf-8")
            (runtime / "b.mjs").write_text(
                'import { imported } from "./a.mjs";\n'
                'import { unused } from "./c.mjs";\n'
                "export { unused };\n"
                'export { imported as passed } from "./a.mjs";\n'
                "export const b = imported;\n", encoding="utf-8")
            (runtime / "c.mjs").write_text("export const unused = 7;\n", encoding="utf-8")
            # A test's probes: one by path, one through a specifier the test interpolates.
            (root / "evals" / "tests" / "test_probe.py").write_text(
                "PROBE = '''\nimport { probed } from './skills/professional-slides/runtime/a.mjs';\n"
                "import { b } from './skills/professional-slides/runtime/b.mjs';\n'''\n"
                "TEMPLATED = f'''\nimport {{ templated }} from '{KIT}';\n'''\n", encoding="utf-8")
            self.assertEqual(finder(str(root)), ["a.mjs:dead", "a.mjs:local", "b.mjs:passed", "b.mjs:unused"])

    def test_the_runtime_has_no_dead_export(self):
        self.assertEqual(finder(str(Path(__file__).resolve().parents[2])), [])


if __name__ == "__main__":
    unittest.main()
