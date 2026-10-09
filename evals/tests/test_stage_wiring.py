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

import functools
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, authored_example, requires_python_package, run_node

EXAMPLES = ROOT / "skills" / "professional-slides" / "examples"
BUILD = ROOT / "skills" / "professional-slides" / "runtime" / "build-deck.mjs"
# The interpreter `requires_python_package` asked, so a build that runs is a
# build whose emitter can import python-pptx.
PYTHON = os.environ.get("RUNTIME_PYTHON") or sys.executable


@functools.lru_cache(maxsize=None)
def user_base(python: str) -> str | None:
    """Where `python` keeps user-installed packages, asked under the real HOME."""
    probe = subprocess.run([python, "-c", "import site; print(site.getuserbase())"],
                           capture_output=True, text=True)
    return probe.stdout.strip() or None if probe.returncode == 0 else None


def build(spec: Path, out: Path):
    # HOME is a scratch directory so stored design preferences cannot reach the
    # build; PYTHONUSERBASE keeps a `pip install --user` python-pptx importable.
    home = out.parent / "home"
    home.mkdir(parents=True, exist_ok=True)
    env = {"PATH": "/usr/bin:/bin:/usr/local/bin", "HOME": str(home),
           "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")}
    base = user_base(PYTHON)
    if base:
        env["PYTHONUSERBASE"] = base
    result = subprocess.run(
        [NODE, str(BUILD), str(spec), str(out), "--no-render", "--python", PYTHON],
        cwd=ROOT, capture_output=True, text=True, env=env)
    return result


class StageFixture:
    """A scratch copy of an example deck for a full build to run against."""

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


# A full build runs the emitter, so it needs python-pptx (requirements.txt).
# Each class runs its own builds, so the parallel runner can share them out.
@requires_python_package('pptx')
class StageWiringTests(StageFixture, unittest.TestCase):
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


@requires_python_package('pptx')
class StagePlanWiringTests(StageFixture, unittest.TestCase):
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


def example_content_plans():
    """The content plans shipped beside a deck spec, and the one author-deck.mjs writes for the worked example."""
    return sorted(EXAMPLES.glob("*.content.json")) + [authored_example("page-types") / "page-types.content.json"]


class ExampleContentPlanTests(unittest.TestCase):
    """The worked example is a real deck, not a fixture."""

    def test_historical_example_content_plans_pass_explicit_legacy_audit(self):
        plans = example_content_plans()
        self.assertTrue(plans, "at least one example deck carries its content stage")
        for plan in plans:
            with self.subTest(plan=plan.name):
                # A plan that predates the text contract is audited without it.
                report = run_node(f"""
import {{ readFileSync }} from 'node:fs';
import {{ runContentGates }} from './skills/professional-slides/runtime/gates/content_gates.mjs';
console.log(JSON.stringify(runContentGates(JSON.parse(readFileSync({json.dumps(str(plan))}, 'utf8')), {{ required: false }})));
""")
                self.assertTrue(report["accepted"], report["countsByCode"])
                # A content plan whose pages settle nothing countable is the
                # failure this stage exists for; an example must not model it.
                self.assertLessEqual(report["statistics"]["kinds"]["qualitative"] / report["pages"], 0.34)

    def test_the_content_plan_matches_its_deck_page_for_page(self):
        """A plan that has drifted from its deck teaches the wrong thing."""
        for plan_path in example_content_plans():
            with self.subTest(plan=plan_path.name):
                name = plan_path.name.replace(".content.json", "")
                deck = json.loads((plan_path.parent / f"{name}.deck.json").read_text(encoding="utf-8"))
                plan = json.loads(plan_path.read_text(encoding="utf-8"))
                if plan.get("derivedFrom") == "pages":
                    # Derived by author-deck.mjs: every page of the deck, cover and
                    # sections included, as the build's stage contract requires.
                    pages = ([{"title": deck["cover"]["title"]}] if deck.get("cover") else []) + deck["slides"] + deck.get("appendix", [])
                    titles = [str(s.get("title", s.get("text", ""))) for s in pages]
                else:
                    titles = [str(s.get("title", "")) for s in deck["slides"]
                              if s.get("kind") in (None, "content")]
                self.assertEqual(len(plan["pages"]), len(titles))
                for page, title in zip(plan["pages"], titles):
                    self.assertEqual(page["claim"], title)


if __name__ == "__main__":
    unittest.main()
