"""The suite runner: dependency preflight, parallel split, and a loud skip report.

A run under an interpreter without python-pptx used to skip the export tests
and still print OK. The runner now picks an interpreter that has the
requirements, says which, and ends with every skip listed; --strict turns a
skip into a failure, except the tests a user has to opt into (--slow).
--fast leaves out the heavy classes a checked-in list names, and one run at a
time holds the machine.
"""
from __future__ import annotations

import json
import os
import shutil
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


class FastTierTests(unittest.TestCase):
    """--fast leaves out the classes evals/heavy-tests.json lists, and nothing else.

    The full suite spent most of its CPU in some sixty classes - property sweeps and end-to-end authoring runs - so a run to
    iterate on leaves them out. The list is checked in and read by name, so a heavy class renamed or removed must not
    quietly slip back into the fast tier, nor a stale entry hide that the tier has grown."""

    def test_the_fast_tier_leaves_out_the_listed_classes_and_modules_and_keeps_the_rest(self):
        result = run_node('''
import {units,fastTier,heavyTests,parseArgs} from './evals/scripts/run_tests.mjs';
const u=units(['test_pages_parts','test_run_tests']);
console.log(JSON.stringify({u,fast:fastTier(u),byModule:fastTier(u,{test_pages_parts:'every class of the module'}),flag:parseArgs(['--fast']).fast,plain:parseArgs([]).fast,heavy:heavyTests()}));
''')
        self.assertTrue(result["flag"])
        self.assertFalse(result["plain"], "the default stays the full suite")
        listed = [unit for unit in result["u"] if unit in result["heavy"]]
        self.assertIn("test_pages_parts.AuthoringFromPartsTests", listed)
        self.assertEqual(result["fast"], [unit for unit in result["u"] if unit not in result["heavy"]])
        self.assertIn("test_pages_parts.PagesFileTests", result["fast"])
        self.assertIn("test_run_tests.FastTierTests", result["fast"])
        self.assertEqual(result["byModule"], [unit for unit in result["u"] if not unit.startswith("test_pages_parts.")])

    def test_every_heavy_entry_names_what_the_runner_schedules_and_says_why(self):
        result = run_node('''
import fs from 'node:fs';
import {units,heavyTests} from './evals/scripts/run_tests.mjs';
const modules=fs.readdirSync('./evals/tests').filter((f)=>/^test_.*\\.py$/.test(f)).map((f)=>f.replace(/\\.py$/,''));
console.log(JSON.stringify({units:units(modules),modules,heavy:heavyTests()}));
''')
        known = set(result["units"]) | set(result["modules"])
        self.assertEqual([key for key in result["heavy"] if key not in known], [], "heavy-tests.json names a class the runner does not schedule")
        self.assertEqual([key for key, why in result["heavy"].items() if not str(why).strip()], [], "an entry says why it is heavy")


class RunLockTests(unittest.TestCase):
    """One suite at a time: two full suites run together each took twice as long, so a second run waits for the first.

    A run killed before it removed its lock leaves its pid behind; that lock is taken over, or no run would start again."""

    def setUp(self):
        # A folder of this test's own, never the lock a real run takes.
        self.folder = Path(tempfile.mkdtemp(prefix="run-lock-"))
        self.addCleanup(shutil.rmtree, self.folder, ignore_errors=True)

    def test_a_lock_left_by_a_run_that_is_no_longer_running_is_taken_over(self):
        result = run_node(f'''
import fs from 'node:fs';
import {{ spawnSync }} from 'node:child_process';
import {{ takeLock }} from './evals/scripts/run_tests.mjs';
const file = {json.dumps(str(self.folder / "suite.lock"))};
// The pid of a process that has exited: what a killed run leaves in its lock.
const dead = spawnSync(process.execPath, ['-e', '']).pid;
fs.writeFileSync(file, `${{dead}}\\n`);
const said = [];
const release = await takeLock(file, {{ pid: 4242, say: (line) => said.push(line), poll: 20 }});
const held = fs.readFileSync(file, 'utf8').trim();
release();
console.log(JSON.stringify({{ dead, said, held, left: fs.existsSync(file), files: fs.readdirSync({json.dumps(str(self.folder))}) }}));
''')
        self.assertEqual(result["held"], "4242")
        self.assertEqual(len(result["said"]), 1)
        self.assertIn(f"pid {result['dead']} is not running", result["said"][0])
        self.assertFalse(result["left"], "the release removes the lock")
        self.assertEqual(result["files"], [], "nothing is left beside it")

    def test_a_second_run_waits_for_a_running_holder_saying_so_once(self):
        result = run_node(f'''
import fs from 'node:fs';
import {{ takeLock }} from './evals/scripts/run_tests.mjs';
const file = {json.dumps(str(self.folder / "suite.lock"))};
const first = await takeLock(file, {{ pid: process.pid, say: () => {{}} }});
const said = [];
let second = null;
const waiting = takeLock(file, {{ pid: 4243, say: (line) => said.push(line), poll: 20 }}).then((release) => {{ second = release; }});
await new Promise((resolve) => setTimeout(resolve, 200));
const waited = second === null, heldBy = fs.readFileSync(file, 'utf8').trim();
first();
await waiting;
const then = fs.readFileSync(file, 'utf8').trim();
second();
console.log(JSON.stringify({{ waited, heldBy, then, said, pid: process.pid }}));
''')
        self.assertTrue(result["waited"], "the second run does not start while the first holds the lock")
        self.assertEqual(result["heldBy"], str(result["pid"]))
        self.assertEqual(result["then"], "4243", "and takes it when the first lets go")
        self.assertEqual(len(result["said"]), 1, result["said"])
        self.assertIn(f"Another test run (pid {result['pid']}) is running", result["said"][0])


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

    def test_fast_runs_a_module_without_its_heavy_classes_and_says_how_many_it_left_out(self):
        if not NODE:
            self.skipTest("Node.js is not available")
        heavy = json.loads((ROOT / "evals" / "heavy-tests.json").read_text(encoding="utf-8"))["classes"]
        out = self.run_runner("--fast", "--pattern", "test_pages_parts.py", "--verbose")
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
        left = len([key for key in heavy if key.startswith("test_pages_parts.")])
        self.assertIn(f"--fast: {left} heavy class{'' if left == 1 else 'es'} not run (evals/heavy-tests.json)", out.stdout)
        self.assertIn("test_pages_parts.PagesFileTests", out.stderr)
        self.assertNotIn("test_pages_parts.AuthoringFromPartsTests", out.stderr)

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
