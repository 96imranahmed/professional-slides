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
        # A band only the render shows is the export's when text the scene holds is missing from the render ...
        gone = [{"node": "n1", "text": "A paragraph the render does not show", "box": [80, 300, 400, 60]}]
        lost = page_gates.void_origins(4, {"internalVoid": 0.01, "deadBand": 0.02}, {"internalVoid": 0.19, "deadBand": 0.24}, gone)
        self.assertEqual({k: v["origin"] for k, v in lost["bands"].items()}, {"internal": "render", "dead": "render"})
        self.assertEqual(lost["lost"], gone)
        # ... and air inside something the scene counts as drawn when everything reached the page.
        inside = page_gates.void_origins(4, {"internalVoid": 0.01, "deadBand": 0.02}, {"internalVoid": 0.19, "deadBand": 0.24})
        self.assertEqual({k: v["origin"] for k, v in inside["bands"].items()}, {"internal": "inside-object", "dead": "inside-object"})
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
        """`painted`: True draws everything the scene does, "text" only its text, False nothing."""
        from PIL import Image, ImageDraw
        for number, slide in enumerate(slides, start=1):
            image = Image.new("L", (1280, 720), 255)
            if painted is True:
                pixels = image.load()
                for y, row in enumerate(page_gates.scene_mask(slide)):
                    for x, cell in enumerate(row):
                        if cell:
                            pixels[x, y] = 0
            elif painted == "text":
                draw = ImageDraw.Draw(image)
                for _, (x, y, w, h) in page_gates.scene_text_boxes(slide):
                    draw.rectangle([x, y, x + w, y + h], fill=0)
            image.save(Path(directory) / f"slide-{number}.png")

    def test_a_render_that_lost_what_the_scene_draws_is_named_as_drift(self):
        scene = copy.deepcopy(example_scene("nyc-or-sf"))
        scene["slides"] = scene["slides"][:4]
        with tempfile.TemporaryDirectory() as faithful, tempfile.TemporaryDirectory() as blank, tempfile.TemporaryDirectory() as hollow:
            self.render(faithful, scene["slides"], painted=True)
            self.render(blank, scene["slides"], painted=False)
            self.render(hollow, scene["slides"], painted="text")
            kept = page_gates.run_gates(scene, render_dir=faithful)
            lost = page_gates.run_gates(scene, render_dir=blank)
            aired = page_gates.run_gates(scene, render_dir=hollow)
        # Every run of text reached the page: whatever air the render shows is not the export's.
        self.assertNotIn("RENDER_DRIFT", {f["code"] for f in aired["findings"]})
        self.assertNotIn("render", {c.get("origin") for c in aired["voidCauses"]})
        self.assertNotIn("RENDER_DRIFT", {f["code"] for f in kept["findings"]})
        self.assertTrue(all(c.get("origin") in (None, "authored") for c in kept["voidCauses"]), kept["voidCauses"])
        drift = [f for f in lost["findings"] if f["code"] == "RENDER_DRIFT"]
        self.assertTrue(drift)
        self.assertEqual({f["severity"] for f in drift}, {"advisory"})  # it names where to look; the band itself is what blocks
        self.assertIn("The repair is the export's", drift[0]["repair"])
        self.assertTrue(drift[0]["measured"]["lost"])  # it names the text that is missing
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
            self.assertEqual((pair["cleanFiled"], pair["discriminated"]), (0, True), pair)  # and its check quiet on the clean deck
        self.assertEqual(result["invalidAnswers"], 0)  # every answer is one the storyline loop would record

    def test_a_critic_that_misses_the_planted_defect_is_not_calibrated(self):
        run, result = self.calibrate("--repeats", "2", "--anchors", "finance,finance:declined-answer", env={"FAKE_CRITIC_BLIND": "1"})
        self.assertEqual(run.returncode, 2)
        self.assertFalse(result["calibrated"])
        pair = result["pairs"][0]
        self.assertEqual((pair["ordered"], pair["caught"], pair["saidRevise"]), (False, 0, 0))

    def test_a_full_size_anchor_is_measured_for_form_and_a_users_anchor_for_its_verdict(self):
        # A user's two decks, one they consider ready and one they do not; the fake critic passes both.
        anchors = self.tmp / "anchors"
        for name, expect in (("good", "ready"), ("bad", "revise")):
            (anchors / name).mkdir(parents=True)
            for file in (QUALITY / "fixtures" / "evidence").glob("finance.*"):
                shutil.copy(file, anchors / name)
            (anchors / name / "anchor.json").write_text(json.dumps({"deck": "finance.pages.json", "expect": expect, "about": f"a deck its owner would call {expect}", **({"rating": 8.5} if name == "good" else {})}))
        listed = subprocess.run([NODE, str(QUALITY / "critic-calibration.mjs"), "--list", "--anchor-dir", str(anchors)], capture_output=True, text=True, cwd=ROOT)
        self.assertIn("showcase:restated-page", listed.stdout)
        self.assertIn("clean, full size, no expected verdict", listed.stdout)
        self.assertIn("user/bad", listed.stdout)
        chosen = "showcase,showcase:declined-answer,showcase:restated-page,user/good,user/bad"
        run, result = self.calibrate("--repeats", "3", "--anchors", chosen, "--anchor-dir", str(anchors), env={"FAKE_CRITIC_INVALID": "2"})
        rows = {row["id"]: row for row in result["anchors"]}
        # The worked example at full size: about fifty pages, with no verdict expected of it - a critic that sent it back would not be wrong.
        self.assertGreaterEqual(rows["showcase"]["pages"], 45)
        self.assertNotIn("expect", rows["showcase"])
        self.assertTrue(all(row["valid"] == 2 and len(row["invalid"]) == 1 for row in rows.values()), rows)
        # Form is counted apart: a third of the answers failed validation, and the plants are still read off the valid ones.
        self.assertEqual(result["form"]["answers"], 15)
        self.assertEqual(result["form"]["invalid"], 5)
        self.assertEqual(result["form"]["rules"][0]["count"], 5)
        self.assertIn("completeness", result["form"]["rules"][0]["rule"])
        for pair in result["pairs"]:
            self.assertEqual((pair["measured"], pair["separated"], pair["caught"], pair["saidRevise"]), (True, True, 1, 1), pair)
        self.assertEqual({a["anchor"]: (a["expect"], a["agreed"]) for a in result["anchored"]}, {"user/good": ("ready", 1), "user/bad": ("revise", 0)})
        self.assertEqual(result["ratingAnchors"]["ready"]["n"], 1)
        # A rating a person recorded for a deck is printed beside the critic's.
        self.assertEqual({a["anchor"]: a.get("human") for a in result["anchored"]}, {"user/good": 8.5, "user/bad": None})
        self.assertIn("against a recorded 8.5", run.stdout)
        # Verdict and defects caught lead the report; rating separation follows and decides nothing.
        self.assertEqual(result["primary"], {"verdict": {"met": 3, "of": 4}, "caught": {"met": 2, "of": 2}, "cleanQuiet": {"met": 2, "of": 2}, "discriminated": {"met": 2, "of": 2}})
        self.assertLess(run.stdout.index("primary - verdicts as expected: 3 of 4; planted defects caught: 2 of 2"), run.stdout.index("secondary - ratings separated"))
        # The critic passed a deck its owner expects sent back: not calibrated, whatever the plants say.
        self.assertEqual((result["verdict"], run.returncode), ("not calibrated", 2))
        self.assertIn("form: 5 of 15 answers failed validation", run.stdout)
        # An anchor folder that does not say what verdict it expects is refused, not run.
        (anchors / "bad" / "anchor.json").write_text(json.dumps({"deck": "finance.pages.json"}))
        refused = subprocess.run([NODE, str(QUALITY / "critic-calibration.mjs"), "--list", "--anchor-dir", str(anchors)], capture_output=True, text=True, cwd=ROOT)
        self.assertEqual(refused.returncode, 1)
        self.assertIn('"expect": "ready" or "revise"', refused.stderr)

    def test_an_anchor_that_returns_no_valid_answer_is_not_measured_rather_than_failed(self):
        run, result = self.calibrate("--repeats", "1", "--anchors", "finance,finance:declined-answer", env={"FAKE_CRITIC_INVALID": "1"})
        self.assertEqual(result["form"]["invalid"], 2)
        self.assertEqual((result["verdict"], result["unmeasured"], result["calibrated"]), ("not measured", ["finance:declined-answer"], False))
        self.assertIn("NOT MEASURED", run.stdout)

    def test_the_judge_is_given_the_schema_inline_or_as_a_path_as_its_command_asks(self):
        # A CLI that takes the schema itself refuses a path: the benchmark's judge command failed this way.
        command = lambda placeholder: [NODE, str(QUALITY / "fixtures" / "fake-critic.mjs"), "{prompt}", "--json-schema", placeholder]
        outcomes = {}
        for name, placeholder, extra in (("inline", "{schemaJson}", {}), ("path", "{schemaPath}", {}), ("default", "{schema}", {}), ("asPath", "{schema}", {"schemaAs": "path"})):
            self.config.write_text(json.dumps({"defaults": {"judge": "fake"}, "judges": {"fake": {"model": "fixture", "timeoutMinutes": 1, "command": command(placeholder), **extra}}}))
            run, result = self.calibrate("--repeats", "1", "--anchors", "finance", env={"FAKE_CRITIC_NEEDS_SCHEMA": "1"})
            outcomes[name] = (result["anchors"][0]["valid"], "is not valid JSON" in run.stdout)
        self.assertEqual(outcomes, {"inline": (1, False), "path": (0, True), "default": (1, False), "asPath": (0, True)})
        shipped = json.loads((QUALITY / "config.json").read_text())["judges"]["claude"]["command"]
        self.assertEqual(shipped[shipped.index("--json-schema") + 1], "{schemaJson}")
        result = run_node('''
import { schemaVars } from './evals/quality/lib.mjs';
import path from 'node:path';
const file = path.resolve('evals/quality/judge-schema.json');
const inline = schemaVars({}, { file }), asPath = schemaVars({ schemaAs: 'path' }, { file }), text = schemaVars({ schemaAs: 'path' }, { text: '{ "type": "object" }' });
console.log(JSON.stringify({ inline: [JSON.parse(inline.schemaJson).type, inline.schema === inline.schemaJson, inline.schemaPath === file, inline.schemaJson.includes('\\n')], asPath: asPath.schema === file, text: [text.schema, text.schemaPath] }));
''')
        self.assertEqual(result["inline"], ["object", True, True, False])
        self.assertTrue(result["asPath"])
        self.assertEqual(result["text"], ['{"type":"object"}', ""])  # no file to point at: the schema goes inline

    def test_calibrated_is_discrimination_and_neither_a_rating_gap_nor_a_catch_alone(self):
        result = run_node('''
import { calibration, anchors, PLANTED } from './evals/quality/critic-calibration.mjs';
const row = (id, planted, mean, sd, extra = {}) => ({ id, deck: id.split(':')[0], planted, answers: 3, valid: 3, invalid: [], rating: { n: 3, mean, sd, min: mean - sd, max: mean + sd },
  verdicts: planted ? { revise: 3 } : { ready: 3 }, ...(planted ? {} : { saidReady: 1, unplanted: { x: 0, y: 0 } }), ...extra });
const told = { caught: 1, saidRevise: 1 };
const noisy = calibration([row('a', null, 7.2, 0.9), row('a:x', 'x', 6.8, 0.7, told), row('b', null, 8, 0.3)]);
const single = calibration([{ ...row('a', null, 8, 0), rating: { n: 1, mean: 8, sd: 0, min: 8, max: 8 } }]);
const missed = calibration([row('a', null, 7.2, 0.2), row('a:x', 'x', 5.1, 0.2, { caught: 0, saidRevise: 1 })]);
// Ratings that separate by five points, every plant caught and sent back - by a critic that files the same check on the clean deck.
const indiscriminate = calibration([row('a', null, 9, 0.1, { unplanted: { x: 1, y: 0 } }), row('a:x', 'x', 4, 0.1, told), row('a:y', 'y', 4, 0.1, told)]);
const sometimes = calibration([row('a', null, 8, 0.1, { unplanted: { x: 0.33, y: 0 } }), row('a:x', 'x', 5, 0.1, told)]);
// Every deck rated 5 and sent back, every plant "caught": the critic an earlier measure called calibrated.
const flat = (id, planted) => row(id, planted, 5, 0, { verdicts: { revise: 3 }, ...(planted ? told : { saidReady: 0, unplanted: { x: 1, y: 1 } }) });
const everything = calibration([flat('a', null), flat('a:x', 'x'), flat('a:y', 'y'), flat('b', null), flat('b:x', 'x')]);
// And one that sends every deck back for something no plant is caught on: the pairs are told apart, the verdict tells nothing.
const harsh = (id, planted) => row(id, planted, 5, 0, { verdicts: { revise: 3 }, ...(planted ? told : { saidReady: 0, unplanted: { x: 0, y: 0 } }) });
const always = calibration([harsh('a', null), harsh('a:x', 'x')]);
// A clean row that does not say how the planted check fared on it measures nothing.
const { unplanted: _none, ...bare } = row('a', null, 8, 0.1);
const unknown = calibration([bare, row('a:x', 'x', 5, 0.1, told)]);
const brief = (c) => [c.calibrated, c.verdict, c.primary.discriminated, c.primary.cleanQuiet];
console.log(JSON.stringify({ noisy: [noisy.noiseFloor, noisy.pairs[0].gap, noisy.pairs[0].ordered, noisy.pairs[0].separated, noisy.pairs[0].discriminated, noisy.calibrated], primary: noisy.primary, secondary: noisy.ratingSeparation,
  missed: [missed.pairs[0].separated, missed.primary.caught, missed.calibrated], single: [single.noiseFloor, single.reading],
  indiscriminate: [...brief(indiscriminate), indiscriminate.ratingSeparation.met, indiscriminate.pairs.map((p) => [p.anchor, p.cleanFiled, p.discriminated]), indiscriminate.why],
  sometimes: brief(sometimes), everything: [...brief(everything), everything.sendsEverythingBack, everything.why.length], always: [...brief(always), always.sendsEverythingBack, always.why],
  unknown: [unknown.calibrated, unknown.verdict, unknown.unmeasured], cleanVerdict: [noisy.cleanVerdict.measured, noisy.cleanVerdict.decks, noisy.cleanVerdict.passed, everything.cleanVerdict.sentBack],
  anchors: anchors().length, clean: anchors().filter((a) => !a.planted).map((a) => a.id), expects: anchors().filter((a) => a.expect).length, planted: Object.keys(PLANTED) }));
''')
        # 0.4 lower on a critic whose answers spread by 0.9: ordered, and not evidence. The rating is the secondary measure:
        # the critic sent the planted deck back, caught the plant, and left the planted check quiet on the clean deck - told apart.
        self.assertEqual(result["noisy"], [0.7, 0.4, True, False, True, True])
        self.assertEqual(result["primary"], {"verdict": {"met": 1, "of": 1}, "caught": {"met": 1, "of": 1}, "cleanQuiet": {"met": 1, "of": 1}, "discriminated": {"met": 1, "of": 1}})
        self.assertEqual(result["secondary"], {"met": 0, "of": 1, "ordered": 1})
        # And the converse: ratings that separate do not make up for a plant that was not caught.
        self.assertEqual(result["missed"], [True, {"met": 0, "of": 1}, False])
        # Nor for a check that fires on the clean deck as on the planted one: both pairs separated by five points, one of two told apart.
        calibrated, verdict, discriminated, quiet, separated, pairs, why = result["indiscriminate"]
        self.assertEqual([calibrated, verdict, discriminated, quiet, separated], [False, "not calibrated", {"met": 1, "of": 2}, {"met": 1, "of": 2}, 2])
        self.assertEqual(pairs, [["a:x", 1, False], ["a:y", 0, True]])
        self.assertIn("the planted check fires on the clean deck too", why[0])
        self.assertIn("a:x (clean 1)", why[0])
        # One clean answer in three is enough: the catch on the planted deck is then not evidence the critic saw the plant.
        self.assertEqual(result["sometimes"][:2], [False, "not calibrated"])
        # A critic that sends every deck back and files under every check catches every plant and is not calibrated.
        self.assertEqual(result["everything"], [False, "not calibrated", {"met": 0, "of": 3}, {"met": 0, "of": 3}, True, 2])
        # One that sends every deck back for a check of its own is not either, though each pair is told apart.
        self.assertEqual(result["always"][:5], [False, "not calibrated", {"met": 1, "of": 1}, {"met": 1, "of": 1}, True])
        self.assertEqual(result["always"][5], ["every answer on every deck said revise: a verdict that never changes tells nothing apart"])
        # A pair whose clean side does not say is not measured, never passed.
        self.assertEqual(result["unknown"], [False, "not measured", ["a:x"]])
        # The clean fixture decks are twins for their plants and carry no expected verdict: what was said of them is reported, not measured.
        self.assertEqual(result["cleanVerdict"], [False, 2, ["a", "b"], ["a", "b"]])
        self.assertEqual(result["expects"], 0)
        self.assertIsNone(result["single"][0])
        self.assertIn("--repeats 3", result["single"][1])
        self.assertEqual(result["clean"], ["explainer", "finance", "product", "public-ops"])
        self.assertEqual(result["planted"], ["declined-answer", "comparison-cut", "context-off-claim", "restated-page"])
        self.assertEqual(result["anchors"], 16)

    def test_a_critic_that_sends_every_deck_back_is_not_calibrated_end_to_end(self):
        anchors = "finance,finance:declined-answer,finance:comparison-cut,explainer,explainer:restated-page"
        # Files a major under every check a plant is caught on, on every deck: every plant "caught", every planted deck sent back.
        run, result = self.calibrate("--repeats", "2", "--anchors", anchors, env={"FAKE_CRITIC_SENDS_BACK": "every-check"})
        self.assertEqual((run.returncode, result["calibrated"], result["verdict"]), (2, False, "not calibrated"))
        self.assertEqual((result["primary"]["caught"], result["primary"]["verdict"]), ({"met": 3, "of": 3}, {"met": 3, "of": 3}))
        self.assertEqual((result["primary"]["cleanQuiet"], result["primary"]["discriminated"]), ({"met": 0, "of": 3}, {"met": 0, "of": 3}))
        self.assertTrue(result["sendsEverythingBack"])
        self.assertIn("NOT calibrated - the planted check fires on the clean deck too", run.stdout)
        self.assertIn("NOT told apart: caught 1; revise 1; the same check on the clean deck 1", run.stdout)
        rows = {row["id"]: row for row in result["anchors"]}
        self.assertEqual(rows["finance"]["unplanted"], {"declined-answer": 1, "comparison-cut": 1, "context-off-claim": 1, "restated-page": 1})
        # Sends every deck back for an item of its own: each pair told apart, the verdict never changes - not calibrated.
        run, result = self.calibrate("--repeats", "2", "--anchors", anchors, env={"FAKE_CRITIC_SENDS_BACK": "numbers"})
        self.assertEqual((run.returncode, result["calibrated"]), (2, False))
        self.assertEqual(result["primary"]["discriminated"], {"met": 3, "of": 3})
        self.assertEqual(result["cleanVerdict"]["sentBack"], ["explainer", "finance"])
        self.assertIn("every answer on every deck said revise", run.stdout)
        # The careful critic on the same anchors: told apart on every pair, the clean decks passed and their verdict still not measured.
        run, result = self.calibrate("--repeats", "2", "--anchors", anchors)
        self.assertEqual((run.returncode, result["calibrated"], result["why"]), (0, True, []))
        self.assertEqual((result["primary"]["discriminated"], result["cleanVerdict"]["measured"], result["cleanVerdict"]["passed"]), ({"met": 3, "of": 3}, False, ["explainer", "finance"]))
        self.assertIn("clean fixture decks - verdict not measured", run.stdout)
        # A planted deck measured without its clean twin is not measured: there is nothing to tell it apart from.
        run, result = self.calibrate("--repeats", "1", "--anchors", "finance:declined-answer")
        self.assertEqual((result["verdict"], result["unmeasured"], run.returncode), ("not measured", ["finance:declined-answer"], 2))

    def test_the_readme_says_what_the_recorded_run_of_the_real_critic_shows(self):
        # The README cited a real critic's result no file in the repo held, and drew from it that a catch is calibration.
        record = json.loads((QUALITY / "calibration" / "storyline-critic.json").read_text(encoding="utf-8"))
        readme = " ".join((QUALITY / "README.md").read_text(encoding="utf-8").split())
        primary = record["primary"]
        self.assertEqual((record["verdict"], record["calibrated"]), ("not calibrated", False))
        self.assertEqual((primary["caught"], primary["verdict"]), ({"met": 7, "of": 7}, {"met": 7, "of": 7}))
        self.assertEqual((primary["cleanQuiet"], primary["discriminated"]), ({"met": 2, "of": 7}, {"met": 2, "of": 7}))
        told = sorted(pair["anchor"] for pair in record["pairs"] if pair["discriminated"])
        self.assertEqual(told, ["explainer:restated-page", "product:restated-page"])
        self.assertEqual(record["unmeasured"], ["showcase:declined-answer"])
        self.assertEqual((record["form"]["answers"], record["form"]["invalid"], record["run"]["calls"]), (39, 7, 39))
        self.assertEqual(record["cleanVerdict"]["sentBack"], ["finance", "product", "public-ops", "showcase"])
        # A summary: counts, shares and ids, and nothing a critic wrote.
        self.assertTrue(all(isinstance(row["invalid"], int) for row in record["anchors"]))
        self.assertNotRegex(json.dumps(record), r"problem|\bfix\b|summary\"")
        for said in ("`calibration/storyline-critic.json`", "39 calls", "7 of 7 measured pairs caught, 7 of 7 sent back", "in 5 of those 7 pairs", "so 2 of 7 pairs discriminate",
                     "7 of the 39 answers failed validation", "the critic's verdict is not evidence of calibration", "**What calibrated means: discrimination.**", "twins, not anchors"):
            self.assertIn(said, readme)
        # And the measure the record was scored by is the one this checkout holds: its pairs say what the harness's own rows say.
        result = run_node('''
import fs from 'node:fs';
import { calibration } from './evals/quality/critic-calibration.mjs';
const record = JSON.parse(fs.readFileSync('./evals/quality/calibration/storyline-critic.json', 'utf8'));
const again = calibration(record.anchors.map((row) => ({ ...row, invalid: Array.from({ length: row.invalid }, () => ['form']) })));
console.log(JSON.stringify({ verdict: again.verdict, primary: again.primary, pairs: again.pairs.map((p) => [p.anchor, p.cleanFiled, p.discriminated]), recorded: record.pairs.map((p) => [p.anchor, p.cleanFiled, p.discriminated]), why: again.why.length, unmeasured: again.unmeasured }));
''')
        self.assertEqual((result["verdict"], result["primary"], result["unmeasured"]), (record["verdict"], record["primary"], record["unmeasured"]))
        self.assertEqual(result["pairs"], result["recorded"])

    def test_calls_run_in_parallel_and_kept_answers_are_scored_again_without_a_critic(self):
        anchors = "finance,finance:declined-answer,explainer,explainer:restated-page"
        raw = self.tmp / "raw"
        serial, one = self.calibrate("--repeats", "3", "--anchors", anchors)
        parallel, four = self.calibrate("--repeats", "3", "--anchors", anchors, "--parallel", "4", "--raw", str(raw))
        self.assertEqual((serial.returncode, parallel.returncode), (0, 0), parallel.stdout + parallel.stderr)
        # The same answers in the same order, whichever call returned first: each anchor's repeats are read by their number.
        self.assertEqual(four["anchors"], one["anchors"])
        self.assertEqual(four["pairs"], one["pairs"])
        # Every answer is kept as the critic returned it, with the packet it answered.
        kept = sorted(file.name for file in raw.iterdir())
        self.assertEqual(len([name for name in kept if name.endswith(".stdout.json")]), 12)
        self.assertEqual([name for name in kept if name.startswith("finance_declined-answer.")],
                         ["finance_declined-answer.packet.json", "finance_declined-answer.prompt.md", "finance_declined-answer.run1.stdout.json", "finance_declined-answer.run2.stdout.json", "finance_declined-answer.run3.stdout.json", "finance_declined-answer.schema.json"])
        # Scored again from what was kept, with a judge that cannot be called: the same rows, and the result says where they came from.
        self.config.write_text(json.dumps({"defaults": {"judge": "none"}, "judges": {"none": {"model": "fixture", "command": ["/nonexistent/critic", "{prompt}"]}}}))
        again, scored = self.calibrate("--from-raw", str(raw), "--anchors", anchors)
        self.assertEqual(again.returncode, 0, again.stdout + again.stderr)
        self.assertEqual((scored["anchors"], scored["calibrated"], scored["scoredFrom"]), (one["anchors"], True, "the answers an earlier run kept"))
        empty = self.calibrate("--from-raw", str(self.tmp), "--anchors", "product")[0]
        self.assertEqual(empty.returncode, 1)
        self.assertIn("holds no packet", empty.stderr)
        refused = self.calibrate("--raw", str(raw), "--from-raw", str(raw))[0]
        self.assertIn("one or the other", refused.stderr)



if __name__ == "__main__":
    unittest.main()


@unittest.skipUnless(os.environ.get("PS_RUN_SLOW") == "1", "opt-in: set PS_RUN_SLOW=1 or pass --slow")
@unittest.skipUnless(NODE and shutil.which("soffice") and shutil.which("pdftoppm"), "needs Node.js, LibreOffice (soffice) and pdftoppm on PATH")
@requires_python_package("pptx", "PIL", "numpy")
class HeldOutBuildTests(unittest.TestCase):
    """A fixture deck with declared measures goes through the whole path: compile, emit, render, gates."""

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
            self.assertEqual(len(json.loads(Path(tmp, "finance.analysis-results.json").read_text())["results"]), 10)
            out = os.path.join(tmp, "out")
            env = {**os.environ, "PROFESSIONAL_SLIDES_HOME": os.path.join(tmp, "home"), "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")}
            built = subprocess.run([NODE, str(runtime / "build-deck.mjs"), os.path.join(tmp, "finance.deck.json"), out, "--no-fetch"], cwd=ROOT, capture_output=True, text=True, env=env, timeout=300)
            result = json.loads(built.stdout.strip().splitlines()[0])
            self.assertEqual(result["status"], "built", built.stdout + built.stderr)
            gates = json.loads(Path(out, "gates.json").read_text())
            self.assertTrue(gates["accepted"])
            self.assertEqual(gates["voidCauses"], [])
