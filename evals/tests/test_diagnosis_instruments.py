"""The instruments a diagnosis rests on: where an empty band came from, and how far a rating can be trusted.

A build was refused with sixteen blockers on seven pages. Fifteen of them were
empty bands, reported once by the scene's gate and again by the render's:
nine bands in all. Nothing said whether a band was the page's composition or
something lost in the export, so "the renderer left it empty" and "the page is
thin" could not be told apart; and a readback that passed - every shape saved
where the scene put it - was read as the layout being faithful, which it does
not say. The storyline's rating had moved 5, 4, 6.2 across three different
packets, which says nothing about the critic either way.

These cover the two instruments: each empty band listed once, with its origin
read by setting the scene's measure against the render's; and the critic's
rating measured on frozen packets - its repeat spread, and anchors with a
known defect planted.
"""
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, example_scene, requires_python_package, run_node

GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
QUALITY = ROOT / "evals" / "quality"

sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402


class VoidOriginTests(unittest.TestCase):
    def test_a_band_is_authored_lost_in_the_export_or_only_estimated(self):
        same = page_gates.void_origins(4, {"internalVoid": 0.19, "deadBand": 0.244}, {"internalVoid": 0.19, "deadBand": 0.243})
        self.assertEqual(same["bands"]["internal"], {"scene": 0.19, "render": 0.19, "origin": "authored"})
        self.assertEqual(same["bands"]["dead"]["origin"], "authored")
        # Both past the bar by different amounts is still the page as composed.
        both = page_gates.void_origins(4, {"internalVoid": 0.0, "deadBand": 0.20}, {"internalVoid": 0.0, "deadBand": 0.31})
        self.assertEqual(both["bands"]["dead"]["origin"], "authored")
        lost = page_gates.void_origins(4, {"internalVoid": 0.01, "deadBand": 0.02}, {"internalVoid": 0.19, "deadBand": 0.24})
        self.assertEqual({k: v["origin"] for k, v in lost["bands"].items()}, {"internal": "render", "dead": "render"})
        estimate = page_gates.void_origins(4, {"internalVoid": 0.21, "deadBand": 0.02}, {"internalVoid": 0.02, "deadBand": 0.03})
        self.assertEqual({k: v["origin"] for k, v in estimate["bands"].items()}, {"internal": "scene-estimate"})
        # Under the bar on both instruments there is no band to explain.
        self.assertEqual(page_gates.void_origins(4, {"internalVoid": 0.02, "deadBand": 0.03}, {"internalVoid": 0.03, "deadBand": 0.02})["bands"], {})

    def test_one_band_is_one_cause_however_many_gates_report_it(self):
        found = [
            {"slide": 2, "code": "DEAD_BAND", "measured": 0.1347, "severity": "blocker"},
            {"slide": 2, "code": "SCENE_VOID", "measured": {"kind": "dead", "band": 0.1319}, "severity": "blocker"},
            {"slide": 32, "code": "DEAD_BAND", "measured": 0.2431, "severity": "blocker"},
            {"slide": 32, "code": "INTERNAL_VOID", "measured": 0.1903, "severity": "blocker"},
            {"slide": 32, "code": "SCENE_VOID", "measured": {"kind": "internal", "band": 0.1917}, "severity": "advisory"},
            {"slide": 6, "code": "COLUMN_VOID", "measured": {"column": "right", "band": 0.30}, "severity": "blocker"},
            {"slide": 6, "code": "SCENE_VOID", "measured": {"kind": "column", "column": "right", "band": 0.29}, "severity": "blocker"},
            {"slide": 9, "code": "UNANNOTATED", "measured": 1, "severity": "advisory"},
        ]
        origins = [page_gates.void_origins(2, {"internalVoid": 0.03, "deadBand": 0.1319}, {"internalVoid": 0.03, "deadBand": 0.1347}),
                   page_gates.void_origins(32, {"internalVoid": 0.1917, "deadBand": 0.2444}, {"internalVoid": 0.1903, "deadBand": 0.2431})]
        marked, causes = page_gates.void_causes(found, origins)
        self.assertEqual(len(marked), len(found))  # every finding is kept: the measurements are independent evidence
        self.assertEqual([c["cause"] for c in causes], ["2:dead", "6:column:right", "32:dead", "32:internal"])
        self.assertEqual({c["cause"]: c["codes"] for c in causes}, {"2:dead": ["DEAD_BAND", "SCENE_VOID"], "6:column:right": ["COLUMN_VOID", "SCENE_VOID"],
                                                                    "32:dead": ["DEAD_BAND"], "32:internal": ["INTERNAL_VOID", "SCENE_VOID"]})
        self.assertEqual({c["cause"]: c.get("origin") for c in causes}, {"2:dead": "authored", "6:column:right": None, "32:dead": "authored", "32:internal": "authored"})
        self.assertTrue(all(c["severity"] == "blocker" for c in causes))  # the worst of the codes that report the band
        self.assertNotIn("cause", marked[-1])
        self.assertEqual([f.get("origin") for f in marked[:2]], ["authored", "authored"])

    def test_the_build_lists_one_blocker_a_band(self):
        result = run_node('''
import { buildOutcome } from './skills/professional-slides/runtime/build-deck.mjs';
const f = (code, slide, cause, extra = {}) => ({ code, slide, severity: 'blocker', measured: extra.measured ?? 0.2, cause, repair: 'Repair the band at its origin, not by stretching the page.', ...extra });
const out = buildOutcome({ readback: { accepted: true }, preflight: { passed: false, findings: [f('SCENE_VOID', 2, '2:dead', { measured: { kind: 'dead' } })] },
  gates: { passed: false, findings: [f('SCENE_VOID', 2, '2:dead', { measured: { kind: 'dead' }, origin: 'authored' }), f('DEAD_BAND', 2, '2:dead', { origin: 'authored' }), f('INTERNAL_VOID', 2, '2:internal'), f('TITLE_WORDS', 3, undefined)] } });
console.log(JSON.stringify({ status: out.status, blockers: out.blockers.map((b) => [b.code, b.slide, b.cause ?? null, b.codes ?? null, b.origin ?? null]) }));
''')
        self.assertEqual(result["status"], "built-with-blockers")
        self.assertEqual(result["blockers"], [["SCENE_VOID", 2, "2:dead", ["SCENE_VOID", "DEAD_BAND"], "authored"], ["INTERNAL_VOID", 2, "2:internal", ["INTERNAL_VOID"], None],
                                              ["TITLE_WORDS", 3, None, None, None]])


@requires_python_package("PIL", "numpy")
class RenderedOriginTests(unittest.TestCase):
    """The same page read off a render that shows what the scene draws, and off one that lost it."""

    def render(self, directory, slides, painted):
        from PIL import Image
        for number, slide in enumerate(slides, start=1):
            image = Image.new("L", (1280, 720), 255)
            if painted:
                pixels = image.load()
                for y, row in enumerate(page_gates.scene_mask(slide)):
                    for x, cell in enumerate(row):
                        if cell:
                            pixels[x, y] = 0
            image.save(Path(directory) / f"slide-{number}.png")

    def test_a_render_that_lost_what_the_scene_draws_is_named_as_drift(self):
        scene = copy.deepcopy(example_scene("nyc-or-sf"))
        scene["slides"] = scene["slides"][:4]
        with tempfile.TemporaryDirectory() as faithful, tempfile.TemporaryDirectory() as blank:
            self.render(faithful, scene["slides"], painted=True)
            self.render(blank, scene["slides"], painted=False)
            kept = page_gates.run_gates(scene, render_dir=faithful)
            lost = page_gates.run_gates(scene, render_dir=blank)
        self.assertNotIn("RENDER_DRIFT", {f["code"] for f in kept["findings"]})
        self.assertTrue(all(c.get("origin") in (None, "authored") for c in kept["voidCauses"]), kept["voidCauses"])
        drift = [f for f in lost["findings"] if f["code"] == "RENDER_DRIFT"]
        self.assertTrue(drift)
        self.assertEqual({f["severity"] for f in drift}, {"advisory"})  # it names where to look; the band itself is what blocks
        self.assertIn("The repair is the export's", drift[0]["repair"])
        blocked = [c for c in lost["voidCauses"] if c["kind"] == "dead" and c["slide"] == drift[0]["slide"]]
        self.assertEqual([c["origin"] for c in blocked], ["render"])
        self.assertIn("DEAD_BAND", blocked[0]["codes"])


class CriticCalibrationTests(unittest.TestCase):
    """The harness run end to end with a fake critic: no model is called."""

    def setUp(self):
        if not NODE:
            self.skipTest("Node.js is not available")
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.config = self.tmp / "config.json"
        self.config.write_text(json.dumps({"defaults": {"judge": "fake"}, "judges": {"fake": {"model": "fixture", "timeoutMinutes": 1,
                                           "command": [NODE, str(QUALITY / "fixtures" / "fake-critic.mjs"), "{prompt}"]}}}))

    def calibrate(self, *args, env=None):
        out = self.tmp / "result.json"
        run = subprocess.run([NODE, str(QUALITY / "critic-calibration.mjs"), "--config", str(self.config), "--out", str(out), *args],
                             capture_output=True, text=True, cwd=ROOT, env={**os.environ, **(env or {})})
        return run, (json.loads(out.read_text()) if out.exists() else None)

    def test_frozen_packets_repeated_give_the_spread_and_planted_anchors_the_order(self):
        anchors = "finance,finance:declined-answer,finance:comparison-cut,finance:context-off-claim,explainer,explainer:restated-page"
        run, result = self.calibrate("--repeats", "3", "--anchors", anchors)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertTrue(result["calibrated"])
        self.assertEqual(result["repeats"], 3)
        rows = {row["id"]: row for row in result["anchors"]}
        self.assertEqual(rows["finance"]["rating"], {"n": 3, "mean": 8, "sd": 0.2, "min": 7.8, "max": 8.2})  # one packet, three answers: the critic's own spread
        self.assertEqual(rows["finance"]["verdicts"], {"ready": 3})
        self.assertEqual(result["noiseFloor"], 0.2)
        self.assertIn("more than 0.2", result["reading"])
        for pair in result["pairs"]:
            self.assertTrue(pair["separated"], pair)  # below its clean deck by more than the spread
            self.assertEqual((pair["caught"], pair["saidRevise"]), (1, 1), pair)
        self.assertEqual(result["invalidAnswers"], 0)  # every answer is one the storyline loop would record

    def test_a_critic_that_misses_the_planted_defect_is_not_calibrated(self):
        run, result = self.calibrate("--repeats", "2", "--anchors", "finance,finance:declined-answer", env={"FAKE_CRITIC_BLIND": "1"})
        self.assertEqual(run.returncode, 2)
        self.assertFalse(result["calibrated"])
        pair = result["pairs"][0]
        self.assertEqual((pair["ordered"], pair["caught"], pair["saidRevise"]), (False, 0, 0))

    def test_a_gap_inside_the_spread_is_not_a_separation(self):
        result = run_node('''
import { calibration, anchors, PLANTED } from './evals/quality/critic-calibration.mjs';
const row = (id, planted, mean, sd, extra = {}) => ({ id, deck: id.split(':')[0], planted, valid: 3, invalid: [], rating: { n: 3, mean, sd, min: mean - sd, max: mean + sd }, ...extra });
const noisy = calibration([row('a', null, 7.2, 0.9), row('a:x', 'x', 6.8, 0.7, { caught: 1, saidRevise: 1 }), row('b', null, 8, 0.3)]);
const single = calibration([{ ...row('a', null, 8, 0), rating: { n: 1, mean: 8, sd: 0, min: 8, max: 8 } }]);
console.log(JSON.stringify({ noisy: [noisy.noiseFloor, noisy.pairs[0].gap, noisy.pairs[0].ordered, noisy.pairs[0].separated, noisy.calibrated], single: [single.noiseFloor, single.reading],
  anchors: anchors().length, clean: anchors().filter((a) => !a.planted).map((a) => a.id), planted: Object.keys(PLANTED) }));
''')
        # 0.4 lower on a critic whose answers spread by 0.9: ordered, and not evidence.
        self.assertEqual(result["noisy"], [0.7, 0.4, True, False, False])
        self.assertIsNone(result["single"][0])
        self.assertIn("--repeats 3", result["single"][1])
        self.assertEqual(result["clean"], ["explainer", "finance", "product", "public-ops"])
        self.assertEqual(result["planted"], ["declined-answer", "comparison-cut", "context-off-claim", "restated-page"])
        self.assertEqual(result["anchors"], 16)


if __name__ == "__main__":
    unittest.main()


@unittest.skipUnless(os.environ.get("PS_RUN_SLOW") == "1", "opt-in: set PS_RUN_SLOW=1 or pass --slow")
@unittest.skipUnless(NODE and shutil.which("soffice") and shutil.which("pdftoppm"), "needs Node.js, LibreOffice (soffice) and pdftoppm on PATH")
@requires_python_package("pptx", "PIL", "numpy")
class HeldOutBuildTests(unittest.TestCase):
    """A held-out deck with declared measures goes through the whole path: compile, emit, render, gates."""

    def test_the_finance_fixture_builds_and_its_dependencies_reach_the_deck(self):
        runtime = ROOT / "skills" / "professional-slides" / "runtime"
        with tempfile.TemporaryDirectory() as tmp:
            for file in (QUALITY / "fixtures" / "evidence").glob("finance.*"):
                shutil.copy(file, tmp)
            authored = subprocess.run([NODE, str(runtime / "author-deck.mjs"), os.path.join(tmp, "finance.pages.json")], capture_output=True, text=True, timeout=120)
            self.assertEqual(authored.returncode, 0, authored.stdout + authored.stderr)
            deck = json.loads(Path(tmp, "finance.deck.json").read_text())
            declared = [slide.get("pageType", {}).get("dependencies") for slide in deck["slides"]]
            self.assertTrue(all(declared), declared)
            self.assertEqual(len(json.loads(Path(tmp, "finance.analysis-results.json").read_text())["results"]), 5)
            out = os.path.join(tmp, "out")
            env = {**os.environ, "PROFESSIONAL_SLIDES_HOME": os.path.join(tmp, "home"), "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")}
            built = subprocess.run([NODE, str(runtime / "build-deck.mjs"), os.path.join(tmp, "finance.deck.json"), out, "--no-fetch"], cwd=ROOT, capture_output=True, text=True, env=env, timeout=300)
            result = json.loads(built.stdout.strip().splitlines()[0])
            self.assertEqual(result["status"], "built", built.stdout + built.stderr)
            gates = json.loads(Path(out, "gates.json").read_text())
            self.assertTrue(gates["accepted"])
            self.assertEqual(gates["voidCauses"], [])
