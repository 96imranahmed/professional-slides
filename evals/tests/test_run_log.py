"""`--log` says what it counts, and counts the plan runs beside the compiles.

A run's own command log held 86 runtime commands where `--log` reported 29
runs: the log counts compile runs, and three `--plan` runs that exited 2 - runs
of the same tool, refused - were not in it at all. A plan is now logged under
its own mode and counted beside the compile runs, and the count says what it
is a count of and what it leaves out.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"


class RunLogTests(unittest.TestCase):
    def test_plan_runs_are_counted_beside_the_compile_runs(self):
        result = run_node('''
import { runCost, PLAN_MODE } from './skills/professional-slides/runtime/run-log.mjs';
const finding = (code, id) => ({ code, class: 'P', ...(id ? { id } : {}), message: 'm' });
const runs = [{ run: 1, v: 2, mode: PLAN_MODE, pages: 9, ok: false, findings: [finding('VARIETY_PANELS'), finding('SPINE_UNFIT', 's2')] }, { run: 2, v: 2, mode: PLAN_MODE, pages: 9, ok: true, findings: [] },
  { run: 3, v: 2, mode: 'draft', pages: 9, ok: false, findings: [finding('SPINE_UNFIT', 's2')] }, { run: 4, v: 2, mode: 'draft', pages: 9, ok: true, findings: [] }, { run: 5, v: 2, mode: 'check', pages: 9, ok: true, findings: [] }];
console.log(JSON.stringify({ cost: runCost(runs), none: runCost([]), mode: PLAN_MODE }));
''')
        cost = result["cost"]
        # `runs` stays the count of compile runs; the plans are beside it, with what they were refused for.
        self.assertEqual([cost["runs"], cost["clean"], cost["refused"]], [3, 2, 1])
        self.assertEqual(cost["modes"], {"draft": {"runs": 2, "refused": 1}, "check": {"runs": 1, "refused": 0}})
        self.assertEqual(cost["plans"], {"runs": 2, "refused": 1, "refusedFor": ["VARIETY_PANELS", "SPINE_UNFIT"]})
        self.assertEqual(cost["refusalsByCode"], {"SPINE_UNFIT": {"findings": 1, "runs": 1}})
        # It says what it counts and what it does not.
        for said in ("compile the deck", "plan it", "Not counted", "--scaffold", "storyline.mjs", "build-deck.mjs"):
            self.assertIn(said, cost["counted"])
        self.assertEqual([result["none"]["runs"], result["none"]["plans"]], [0, {"runs": 0, "refused": 0}])
        self.assertEqual(result["mode"], "plan")

    def test_a_refused_plan_is_logged_with_what_refused_it(self):
        tmp = Path(tempfile.mkdtemp(prefix="run-log-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        for name in ("finance.insights.json", "finance.analysis.json"):
            shutil.copy(FIXTURES / name, tmp / name)
        doc = json.loads((FIXTURES / "finance.pages.json").read_text())
        pages = doc["pages"]
        # Sections round the fixture's pages, one with a title no divider holds.
        long_title = "Funding: lending grows faster than the deposits that fund it across every branch region and every product line"
        doc["pages"] = [pages[0], {"id": "s1", "kind": "section", "title": "Growth"}, *pages[1:3], {"id": "s2", "kind": "section", "title": long_title}, *pages[3:5],
                        {"id": "s3", "kind": "section", "title": "Cover"}, *pages[5:]]
        (tmp / "finance.pages.json").write_text(json.dumps(doc))
        author = lambda *flags: subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(tmp / "finance.pages.json"), *flags], capture_output=True, text=True)  # noqa: E731
        plan = author("--plan")
        self.assertEqual(plan.returncode, 2, plan.stderr[-1500:])
        draft = author("--draft")
        self.assertEqual(draft.returncode, 2, draft.stderr[-1500:])
        logged = [json.loads(line) for line in (tmp / "finance.author-log.jsonl").read_text().splitlines()]
        self.assertEqual([(entry["run"], entry["mode"], entry["ok"]) for entry in logged], [(1, "plan", False), (2, "draft", False)])
        self.assertEqual([(f["code"], f["id"]) for f in logged[0]["findings"]], [("SPINE_UNFIT", "s2")])
        cost = json.loads(author("--log").stdout)
        self.assertEqual([cost["runs"], cost["refused"], cost["plans"]], [1, 1, {"runs": 1, "refused": 1, "refusedFor": ["SPINE_UNFIT"]}])
        self.assertIn("Not counted", cost["counted"])
        # The catalogue commands and `--log` itself add nothing to the log.
        author("--limits")
        self.assertEqual(len((tmp / "finance.author-log.jsonl").read_text().splitlines()), 2)


if __name__ == "__main__":
    unittest.main()
