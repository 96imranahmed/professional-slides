"""The suite runner: dependency preflight, parallel split, and a loud skip report.

A run under an interpreter without python-pptx used to skip the export tests
and still print OK. The runner now picks an interpreter that has the
requirements, says which, and ends with every skip listed; --strict turns a
skip into a failure, except the tests a user has to opt into (--slow).
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, run_node

RUNNER = ROOT / "evals" / "scripts" / "run_tests.mjs"


class RunnerUnitTests(unittest.TestCase):
    def test_requirements_are_read_by_import_name(self):
        result = run_node('''
import {requiredModules} from './evals/scripts/run_tests.mjs';
console.log(JSON.stringify(requiredModules()));
''')
        self.assertEqual(result, ["pptx", "lxml", "PIL", "numpy", "pypdf"])

    def test_the_preflight_prefers_an_interpreter_with_everything(self):
        result = run_node('''
import {preflight} from './evals/scripts/run_tests.mjs';
const has=preflight(['json','re']);
const lacks=preflight(['json','no_such_module_for_the_preflight']);
console.log(JSON.stringify({has:has.chosen.missing,lacks:lacks.chosen.missing,checked:lacks.checked.length}));
''')
        self.assertEqual(result["has"], [])
        self.assertEqual(result["lacks"], ["no_such_module_for_the_preflight"])
        self.assertGreaterEqual(result["checked"], 1, "every candidate that runs is asked before settling")

    def test_every_test_class_is_a_unit_and_the_slowest_go_first(self):
        result = run_node('''
import {units,schedule} from './evals/scripts/run_tests.mjs';
const u=units(['test_run_tests','test_plugin_distribution']);
// Every other class a second, so the order does not hang on these modules' other classes.
const timings={...Object.fromEntries(u.map((unit)=>[unit,1])),'test_plugin_distribution.ShippedPackageTests':9,'test_run_tests.RunnerUnitTests':0.1};
console.log(JSON.stringify({u,s:schedule(u,timings)}));
''')
        self.assertIn("test_run_tests.RunnerUnitTests", result["u"])
        self.assertIn("test_plugin_distribution.ShippedPackageTests", result["u"])
        self.assertNotIn("test_plugin_distribution.RealPackage", result["u"], "a mixin is not a test class")
        self.assertEqual(result["s"][0], "test_plugin_distribution.ShippedPackageTests")
        self.assertEqual(result["s"][-1], "test_run_tests.RunnerUnitTests")

    def test_skips_are_listed_loudly_and_strict_fails_on_them(self):
        result = run_node('''
import {report} from './evals/scripts/run_tests.mjs';
const base={testsRun:3,failures:[],errors:[],expectedFailures:0,unexpectedSuccesses:[],seconds:1};
const results=[{...base,module:'a',skipped:[{id:'a.T.test_x',reason:'needs pptx (python3 -m pip install -r requirements.txt)'}]},
  {...base,module:'b',skipped:[{id:'b.T.test_slow',reason:'opt-in: set PS_RUN_SLOW=1 or pass --slow'}]}];
const loose=report(results,{seconds:2,jobs:2,modules:2,python:'py',strict:false});
const strict=report(results,{seconds:2,jobs:2,modules:2,python:'py',strict:true});
const optInOnly=report([results[1]],{seconds:2,jobs:1,modules:1,python:'py',strict:true});
const failing=report([{...base,module:'c',skipped:[],failures:[{id:'c.T.test_y',traceback:'AssertionError: no'}]}],{seconds:1,jobs:1,modules:1,python:'py',strict:false});
console.log(JSON.stringify({loose,strict,optInOnly,failing}));
''')
        self.assertFalse(result["loose"]["failed"])
        self.assertIn("SKIPPED", result["loose"]["text"])
        self.assertIn("a.T.test_x", result["loose"]["text"])
        self.assertIn("1 opt-in test not run", result["loose"]["text"])
        self.assertTrue(result["strict"]["failed"])
        self.assertFalse(result["optInOnly"]["failed"], "a test the user did not ask for is not a missing dependency")
        self.assertTrue(result["failing"]["failed"])
        self.assertIn("FAIL: c.T.test_y", result["failing"]["text"])


class RunnerCommandTests(unittest.TestCase):
    def run_runner(self, *args):
        env = {k: v for k, v in os.environ.items() if k != "PS_RESULT_FD"}
        return subprocess.run([NODE, str(RUNNER), *args], cwd=ROOT, capture_output=True, text=True, env=env, timeout=300)

    def test_a_parallel_run_reports_what_it_ran(self):
        if not NODE:
            self.skipTest("Node.js is not available")
        out = self.run_runner("--pattern", "test_nice_ticks.py", "--jobs", "2")
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
        self.assertRegex(out.stdout, r"Ran \d+ tests from 1 modules in [\d.]+s across \d process")
        self.assertTrue(out.stdout.rstrip().endswith("OK") or "OK (" in out.stdout)

    def test_serial_is_one_process(self):
        if not NODE:
            self.skipTest("Node.js is not available")
        out = self.run_runner("--pattern", "test_nice_ticks.py", "--serial")
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
        self.assertIn("across 1 process ", out.stdout)

    def test_unknown_flags_print_the_usage(self):
        if not NODE:
            self.skipTest("Node.js is not available")
        out = self.run_runner("--jobs", "0")
        self.assertNotEqual(out.returncode, 0)
        self.assertIn("Usage: run_tests.mjs", out.stderr)


class RunnerUsageTests(unittest.TestCase):
    def cli(self, *args):
        return subprocess.run([NODE, *map(str, args)], capture_output=True, text=True,
                              env={**os.environ, 'RUNTIME_PYTHON': sys.executable}, cwd=ROOT, timeout=120)

    def test_removed_dependency_route_has_explicit_usage_error(self):
        """PR #4 follow-up: a removed --dependencies flag crashed with MODULE_NOT_FOUND instead of printing the usage."""
        result = self.cli(ROOT / 'evals/scripts/run_tests.mjs', '--dependencies')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Usage: run_tests.mjs', result.stderr)
        self.assertNotIn('MODULE_NOT_FOUND', result.stderr)


class ShellSuiteTests(unittest.TestCase):
    def test_shell_suite_returns_success_and_preserves_unit_failure(self):
        """PR #4 review: evals/run.sh hid a unit failure's exit code and tripped on an unbound variable."""
        with tempfile.TemporaryDirectory() as directory:
            stub=Path(directory)/'runner'
            stub.write_text('#!'+sys.executable+'\nimport os,sys\nif sys.argv[1:3] == ["-m","unittest"]: sys.exit(int(os.environ.get("TEST_SUITE_EXIT","0")))\nsys.exit(0)\n')
            stub.chmod(0o755)
            for code in [0,3]:
                result=subprocess.run(['bash',str(ROOT/'evals/run.sh')],env={**os.environ,'RUNTIME_NODE':str(stub),'RUNTIME_PYTHON':str(stub),'TEST_SUITE_EXIT':str(code)},capture_output=True,text=True)
                self.assertEqual(result.returncode,code,result.stderr)
                self.assertNotIn('unbound variable',result.stderr)


if __name__ == "__main__":
    unittest.main()
