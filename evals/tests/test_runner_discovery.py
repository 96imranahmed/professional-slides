"""Every test the suite holds is a test the suite's runner runs.

`node evals/scripts/run_tests.mjs` schedules test classes it finds by reading
the source, so that no module is imported to plan a run. A class it does not
find is not an error: its tests simply never run there, while the same module
passes under `python -m unittest`. A fixture class shared by several test
classes (`class StaleTextTests(CarriedDeck)`) was missed that way. This reads
every test module the way Python does and holds the runner to the same list.
"""
from __future__ import annotations

import ast
import unittest
from pathlib import Path

from node_probe import NODE, run_node

TESTS = Path(__file__).resolve().parent


@unittest.skipUnless(NODE, "needs Node.js")
class RunnerDiscoveryTests(unittest.TestCase):
    def test_every_class_that_holds_a_test_is_a_unit_the_runner_schedules(self):
        modules = sorted(path.stem for path in TESTS.glob("test_*.py"))
        scheduled = set(run_node(f'''
import {{ units }} from './evals/scripts/run_tests.mjs';
console.log(JSON.stringify(units({modules!r})));
'''))
        holding = []
        for name in modules:
            tree = ast.parse((TESTS / f"{name}.py").read_text(encoding="utf-8"))
            classes = [node for node in tree.body if isinstance(node, ast.ClassDef)]
            tested = [node.name for node in classes if any(isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) and item.name.startswith("test") for item in node.body)]
            holding.extend(f"{name}.{cls}" for cls in tested)
            # A module of test functions and no class is scheduled whole.
            if not classes:
                self.assertIn(name, scheduled)
        self.assertGreater(len(holding), 300)
        self.assertEqual(sorted(unit for unit in holding if unit not in scheduled), [])

    def test_a_class_is_found_through_a_fixture_class_of_its_own_module_or_another(self):
        result = run_node('''
import { units } from './evals/scripts/run_tests.mjs';
console.log(JSON.stringify(units(['test_revision_carry', 'test_revision_streams', 'test_pages_parts', 'test_runner_discovery'])));
''')
        # Through a fixture class declared in the module, through one imported from another module, and directly.
        for unit in ("test_revision_carry.StaleTextTests", "test_revision_carry.AssemblerTests", "test_revision_streams.OneStaleRuleTests",
                     "test_revision_streams.ComposedPagesAloneTests", "test_pages_parts.PagesFileTests", "test_runner_discovery.RunnerDiscoveryTests"):
            self.assertIn(unit, result)
        # A helper that is no test class is not scheduled as one.
        self.assertFalse([unit for unit in result if unit.split(".")[-1][:1].islower() and "." in unit])


if __name__ == "__main__":
    unittest.main()
