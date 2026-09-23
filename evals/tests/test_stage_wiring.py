"""A gate nobody runs is not a gate.

`plan_gates.mjs` and `content_gates.mjs` measure the two things that made a
50-page deck unreadable — one chart in fifty pages, commentary planned as a
second reading of the exhibit — and for weeks a `grep` for either returned one
hit outside the gate file itself: a sentence in a reference document. Neither was
wired into `build-deck.mjs`, `evals/run.sh` or the reviewer.

So the build looks for `<stem>.content.json` and `<stem>.plan.json` beside the
spec, runs whichever it finds, and records `absent` for whichever it does not.
The absent case is the point: a build with no content plan is allowed, but its
output says the stage did not happen, which is the difference between a stage
that was skipped and a stage that does not exist.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, requires_python_package

EXAMPLES = ROOT / "skills" / "professional-slides" / "examples"
BUILD = ROOT / "skills" / "professional-slides" / "runtime" / "build-deck.mjs"


def build(spec: Path, out: Path):
    result = subprocess.run(
        [NODE, str(BUILD), str(spec), str(out), "--no-render", "--python", sys.executable],
        cwd=ROOT, capture_output=True, text=True,
        env={"PATH": "/usr/bin:/bin:/usr/local/bin", "HOME": "/tmp",
             "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")})
    return result


# A full build runs the emitter, so it needs python-pptx (requirements.txt).
@requires_python_package('pptx')
class StageWiringTests(unittest.TestCase):
    def setUp(self):
        if not NODE:
            self.skipTest("Node.js is not available")
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def stage_spec(self, name, content=None, plan=None):
        """A copy of an example deck, with whatever stage files we want beside it."""
        work = self.tmp / "examples"
        work.mkdir(parents=True, exist_ok=True)
        shutil.copytree(EXAMPLES / "assets", work / "assets", dirs_exist_ok=True)
        shutil.copy(EXAMPLES / f"{name}.deck.json", work / f"{name}.deck.json")
        if content is not None:
            (work / f"{name}.content.json").write_text(json.dumps(content), encoding="utf-8")
        if plan is not None:
            (work / f"{name}.plan.json").write_text(json.dumps(plan), encoding="utf-8")
        return work / f"{name}.deck.json"

    def test_a_build_with_no_stage_files_says_the_stages_are_absent(self):
        """Allowed, and recorded. Silence is what let the gates go unrun."""
        spec = self.stage_spec("house-style")
        out = self.tmp / "out" / "output"
        result = build(spec, out)
        self.assertEqual(result.returncode, 0, result.stderr[-800:])
        stages = json.loads((out / "build-result.json").read_text())["stages"]
        self.assertEqual(stages["content"]["state"], "absent")
        self.assertEqual(stages["plan"]["state"], "absent")
        self.assertTrue(stages["content"]["expectedAt"].endswith("house-style.content.json"))

    def test_a_content_plan_beside_the_spec_is_gated_and_reported(self):
        spec = self.stage_spec("house-style", content=json.loads(
            (EXAMPLES / "nyc-or-sf.content.json").read_text(encoding="utf-8")))
        out = self.tmp / "out" / "output"
        result = build(spec, out)
        self.assertEqual(result.returncode, 0, result.stderr[-800:])
        stages = json.loads((out / "build-result.json").read_text())["stages"]
        self.assertEqual(stages["content"]["state"], "accepted")
        report = json.loads((out / "content-gates.json").read_text())
        self.assertTrue(report["accepted"])
        self.assertEqual(report["statistics"]["kinds"]["qualitative"], 0)

    def test_a_content_plan_that_fails_stops_the_build(self):
        """Before a page is drawn, which is the whole reason for the stage."""
        bad = {"schema": "professional-slides.content/v1", "id": "x",
               "pages": [{"n": i, "claim": "Origins",
                          "settles": {"kind": "qualitative", "what": "a premise"},
                          "adds": "", "highlight": ""} for i in range(1, 11)]}
        spec = self.stage_spec("house-style", content=bad)
        out = self.tmp / "out" / "output"
        result = build(spec, out)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("content gates rejected", result.stderr)
        report = json.loads((out / "content-gates.json").read_text())
        self.assertIn("CONTENT_UNMEASURED", report["countsByCode"])
        self.assertIn("CONTENT_NO_CLAIM", report["countsByCode"])
        # The deck is not built: the stage runs before anything is composed.
        self.assertFalse((out / "scene.json").exists())

    def test_a_plan_beside_the_spec_is_gated_too(self):
        bad = {"schema": "professional-slides.plan/v1", "id": "x",
               "pages": [{"n": i, "title": "A page that states something measurable",
                          "exhibit": "table", "architecture": "exhibit-full"}
                         for i in range(1, 13)]}
        spec = self.stage_spec("house-style", plan=bad)
        out = self.tmp / "out" / "output"
        result = build(spec, out)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("plan gates rejected", result.stderr)
        self.assertIn("PLAN_EXHIBIT_VARIETY", json.loads((out / "plan-gates.json").read_text())["countsByCode"])


class ExampleContentPlanTests(unittest.TestCase):
    """The worked example is a real deck, not a fixture."""

    def test_historical_example_content_plans_pass_explicit_legacy_audit(self):
        plans = sorted(EXAMPLES.glob("*.content.json"))
        self.assertTrue(plans, "at least one example deck carries its content stage")
        for plan in plans:
            with self.subTest(plan=plan.name):
                out = subprocess.run(
                    [NODE, str(ROOT / "skills" / "professional-slides" / "runtime" / "gates" / "content_gates.mjs"),
                     str(plan), "--json", "--legacy"], cwd=ROOT, capture_output=True, text=True)
                self.assertEqual(out.returncode, 0, out.stdout[-600:])
                report = json.loads(out.stdout)
                self.assertTrue(report["accepted"])
                # A content plan whose pages settle nothing countable is the
                # failure this stage exists for; an example must not model it.
                self.assertLessEqual(report["statistics"]["kinds"]["qualitative"] / report["pages"], 0.34)

    def test_the_content_plan_matches_its_deck_page_for_page(self):
        """A plan that has drifted from its deck teaches the wrong thing."""
        for plan_path in sorted(EXAMPLES.glob("*.content.json")):
            with self.subTest(plan=plan_path.name):
                name = plan_path.name.replace(".content.json", "")
                deck = json.loads((EXAMPLES / f"{name}.deck.json").read_text(encoding="utf-8"))
                plan = json.loads(plan_path.read_text(encoding="utf-8"))
                titles = [str(s.get("title", "")) for s in deck["slides"]
                          if s.get("kind") in (None, "content")]
                self.assertEqual(len(plan["pages"]), len(titles))
                for page, title in zip(plan["pages"], titles):
                    self.assertEqual(page["claim"], title)


if __name__ == "__main__":
    unittest.main()
