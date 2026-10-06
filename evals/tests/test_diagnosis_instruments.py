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
            self.assertEqual(pair["separated"], pair["blocking"], pair)  # a blocking plant is rated below its clean deck by more than the spread; a cut is not
            self.assertEqual((pair["hit"], pair["falseAlarm"], pair["discriminated"]), (1, 0, True), pair)  # found at its place, quiet there on the twin
        # A page repeated is a cut, not a reason to send the deck back; the blocking plants are sent back.
        self.assertEqual({p["anchor"]: (p["blocking"], p["saidRevise"]) for p in result["pairs"]}["explainer:restated-page"], (False, 0))
        self.assertEqual(result["primary"]["cleanPassed"], {"met": 2, "of": 2})
        self.assertEqual(result["invalidAnswers"], 0)  # every answer is one the storyline loop would record

    def test_a_critic_that_misses_the_planted_defect_is_not_calibrated(self):
        run, result = self.calibrate("--repeats", "2", "--anchors", "finance,finance:declined-answer", env={"FAKE_CRITIC_BLIND": "1"})
        self.assertEqual(run.returncode, 2)
        self.assertFalse(result["calibrated"])
        pair = result["pairs"][0]
        self.assertEqual((pair["hit"], pair["saidRevise"], pair["discriminated"]), (0, 0, False))

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
        self.assertIn("clean, full size", listed.stdout)
        self.assertIn("user/bad", listed.stdout)
        chosen = "showcase,showcase:declined-answer,showcase:restated-page,user/good,user/bad"
        run, result = self.calibrate("--repeats", "3", "--anchors", chosen, "--anchor-dir", str(anchors), env={"FAKE_CRITIC_INVALID": "2"})
        rows = {row["id"]: row for row in result["anchors"]}
        # The worked example at full size: about fifty pages, a clean deck the critic should pass.
        self.assertGreaterEqual(rows["showcase"]["pages"], 45)
        self.assertNotIn("expect", rows["showcase"])
        self.assertTrue(all(row["valid"] == 2 and len(row["invalid"]) == 1 for row in rows.values()), rows)
        # Form is counted apart: a third of the answers failed validation, and the plants are still read off the valid ones.
        self.assertEqual(result["form"]["answers"], 15)
        self.assertEqual(result["form"]["invalid"], 5)
        self.assertEqual(result["form"]["rules"][0]["count"], 5)
        self.assertIn("answerParts", result["form"]["rules"][0]["rule"])
        for pair in result["pairs"]:
            self.assertEqual((pair["measured"], pair["hit"], pair["falseAlarm"]), (True, 1, 0), pair)
        self.assertEqual({a["anchor"]: (a["expect"], a["agreed"]) for a in result["anchored"]}, {"user/good": ("ready", 1), "user/bad": ("revise", 0)})
        self.assertEqual(result["ratingAnchors"]["ready"]["n"], 1)
        # A rating a person recorded for a deck is printed beside the critic's.
        self.assertEqual({a["anchor"]: a.get("human") for a in result["anchored"]}, {"user/good": 8.5, "user/bad": None})
        self.assertIn("against a recorded 8.5", run.stdout)
        self.assertEqual(result["primary"], {"discriminated": {"met": 2, "of": 2}, "caught": {"met": 2, "of": 2}, "quietOnTwin": {"met": 2, "of": 2}, "cleanPassed": {"met": 0, "of": 0}, "expected": {"met": 1, "of": 2}})
        # The worked example is reported and not held to a pass: it shows page types, not an argument.
        self.assertIn("clean (reported, not held to a pass)", run.stdout)
        self.assertLess(run.stdout.index("primary - told apart 2 of 2; clean decks passed 0 of 0; expected verdicts 1 of 2"), run.stdout.index("secondary - ratings separated"))
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

    def test_calibrated_is_discrimination_at_the_plants_place_and_clean_decks_passed(self):
        result = run_node('''
import { calibration, anchors, PLANTED } from './evals/quality/critic-calibration.mjs';
const row = (id, planted, mean, sd, extra = {}) => ({ id, deck: id.split(':')[0], planted, answers: 3, valid: 3, invalid: [], rating: { n: 3, mean, sd, min: mean - sd, max: mean + sd },
  blocking: { mean: planted ? 1 : 0 }, verdicts: planted ? { revise: 3 } : { ready: 3 }, ...(planted ? {} : { saidReady: 1, unplanted: { 'declined-answer': 0, 'context-off-claim': 0 } }), ...extra });
const told = { caught: 1, saidRevise: 1 };
const noisy = calibration([row('a', null, 7.2, 0.9), row('a:declined-answer', 'declined-answer', 6.8, 0.7, told), row('b', null, 8, 0.3)]);
const single = calibration([{ ...row('a', null, 8, 0), rating: { n: 1, mean: 8, sd: 0, min: 8, max: 8 } }]);
const missed = calibration([row('a', null, 7.2, 0.2), row('a:declined-answer', 'declined-answer', 5.1, 0.2, { caught: 0, saidRevise: 1 })]);
// Ratings five points apart and every plant found - by a critic that finds the same thing at the same place on the clean deck.
const indiscriminate = calibration([row('a', null, 9, 0.1, { unplanted: { 'declined-answer': 1, 'context-off-claim': 0 } }), row('a:declined-answer', 'declined-answer', 4, 0.1, told), row('a:context-off-claim', 'context-off-claim', 4, 0.1, told)]);
// A critic that tells every plant apart and sends the clean decks back: the failure the user saw.
const harsh = calibration([row('a', null, 5, 0, { verdicts: { revise: 3 }, saidReady: 0 }), row('a:declined-answer', 'declined-answer', 4, 0, told)]);
// A blocking plant found but its deck not sent back is not told apart.
const lenient = calibration([row('a', null, 8, 0.1), row('a:declined-answer', 'declined-answer', 7, 0.1, { caught: 1, saidRevise: 0 })]);
// A clean row that does not say how the plant's test fared on it measures nothing.
const { unplanted: _none, ...bare } = row('a', null, 8, 0.1);
const unknown = calibration([bare, row('a:declined-answer', 'declined-answer', 5, 0.1, told)]);
const brief = (c) => [c.calibrated, c.verdict, c.primary.discriminated, c.primary.cleanPassed];
console.log(JSON.stringify({ noisy: [noisy.noiseFloor, noisy.pairs[0].gap, noisy.pairs[0].separated, noisy.pairs[0].discriminated, noisy.calibrated], primary: noisy.primary, secondary: noisy.ratingSeparation,
  missed: [missed.pairs[0].separated, missed.primary.caught, missed.calibrated], single: [single.noiseFloor, single.reading],
  indiscriminate: [...brief(indiscriminate), indiscriminate.pairs.map((p) => [p.anchor, p.falseAlarm, p.discriminated]), indiscriminate.why],
  harsh: [...brief(harsh), harsh.why], lenient: brief(lenient), unknown: [unknown.calibrated, unknown.verdict, unknown.unmeasured],
  anchors: anchors().length, clean: anchors().filter((a) => !a.planted).map((a) => a.id), planted: Object.keys(PLANTED), blocking: Object.values(PLANTED).map((p) => p.blocking) }));
''')
        # 0.4 lower on a critic whose answers spread by 0.9: not separated, and it decides nothing - the plant was found, quiet on the twin, sent back.
        self.assertEqual(result["noisy"], [0.7, 0.4, False, True, True])
        self.assertEqual(result["primary"], {"discriminated": {"met": 1, "of": 1}, "caught": {"met": 1, "of": 1}, "quietOnTwin": {"met": 1, "of": 1}, "cleanPassed": {"met": 2, "of": 2}, "expected": {"met": 0, "of": 0}})
        self.assertEqual(result["secondary"], {"met": 0, "of": 1, "ordered": 1})
        self.assertEqual(result["missed"], [True, {"met": 0, "of": 1}, False])
        calibrated, verdict, discriminated, passed, pairs, why = result["indiscriminate"]
        self.assertEqual([calibrated, verdict, discriminated, passed], [False, "not calibrated", {"met": 1, "of": 2}, {"met": 1, "of": 1}])
        self.assertEqual(pairs, [["a:declined-answer", 1, False], ["a:context-off-claim", 0, True]])
        self.assertIn("not told apart: a:declined-answer (found 1, on the twin 1", why[0])
        # Every plant told apart, and the clean deck sent back: not calibrated, and said why.
        self.assertEqual(result["harsh"][:4], [False, "not calibrated", {"met": 1, "of": 1}, {"met": 0, "of": 1}])
        self.assertIn("a clean deck was sent back: a (passed 0)", result["harsh"][4][0])
        self.assertEqual(result["lenient"][:3], [False, "not calibrated", {"met": 0, "of": 1}])
        self.assertEqual(result["unknown"], [False, "not measured", ["a:declined-answer"]])
        self.assertIsNone(result["single"][0])
        self.assertIn("--repeats 3", result["single"][1])
        self.assertEqual(result["clean"], ["explainer", "finance", "product", "public-ops"])
        self.assertEqual(result["planted"], ["declined-answer", "comparison-cut", "context-off-claim", "restated-page"])
        self.assertEqual(result["blocking"], [True, True, True, False])
        # Four clean decks and eleven plants: context-off-claim is not planted on product, whose one typed chart would be moved onto its own page.
        self.assertEqual(result["anchors"], 15)

    def test_a_plant_is_caught_by_what_an_item_opens_on_and_a_plant_that_moves_nothing_is_refused(self):
        result = run_node("""
import { PLANTED } from './evals/quality/critic-calibration.mjs';
const cut = PLANTED['comparison-cut'], doc = { deck: { players: ['Harbour', 'Dunmore', 'Eastbank'] } };
const answer = (text) => ({ missingAnalyses: [{ severity: 'major', analysis: text }] });
const caught = (text) => cut.caught(answer(text), cut.at(doc));
const one = { deck: { id: 'one' }, pages: [{ id: 'p1', exhibit: { basis: { measures: ['i/a'] }, series: [{ name: 'A', values: [1, 2] }] } }] };
let refused = null; try { PLANTED['context-off-claim'].plant(structuredClone(one)); } catch (error) { refused = error.message; }
console.log(JSON.stringify({ sizing: caught('Size and time the term funding. Show the headroom in pounds. Show the funding that brings cover to the next-thinnest peer.'),
  missing: caught('No page sets Harbour against its peers. The answer ranks it all the same.'), rival: caught('The answer rests on no page. It sets Harbour against Dunmore on cover.'), refused }));
""")
        # An item that sizes a gap and names a peer in its third sentence is not the missing comparison; one that opens on it is.
        self.assertEqual([result["sizing"], result["missing"], result["rival"]], [False, True, True])
        self.assertIn("needs two pages with typed charts", result["refused"])

    def test_a_critic_that_sends_every_deck_back_is_not_calibrated_end_to_end(self):
        anchors = "finance,finance:declined-answer,finance:comparison-cut,explainer,explainer:restated-page"
        # Files a major under every check a plant is caught on, on every deck: every plant found, and found on the clean decks too.
        run, result = self.calibrate("--repeats", "2", "--anchors", anchors, env={"FAKE_CRITIC_SENDS_BACK": "every-check"})
        self.assertEqual((run.returncode, result["calibrated"], result["verdict"]), (2, False, "not calibrated"))
        self.assertEqual((result["primary"]["caught"], result["primary"]["discriminated"], result["primary"]["cleanPassed"]), ({"met": 3, "of": 3}, {"met": 0, "of": 3}, {"met": 0, "of": 2}))
        self.assertIn("NOT told apart: found at its place 1; the same test on the clean twin 1", run.stdout)
        rows = {row["id"]: row for row in result["anchors"]}
        self.assertEqual(rows["finance"]["unplanted"], {"declined-answer": 1, "comparison-cut": 1, "context-off-claim": 1, "restated-page": 1})
        # Sends every deck back for an item of its own: each pair told apart, the clean decks sent back - not calibrated.
        run, result = self.calibrate("--repeats", "2", "--anchors", anchors, env={"FAKE_CRITIC_SENDS_BACK": "numbers"})
        self.assertEqual((run.returncode, result["calibrated"]), (2, False))
        self.assertEqual(result["primary"]["discriminated"], {"met": 3, "of": 3})
        self.assertEqual(result["primary"]["cleanPassed"], {"met": 0, "of": 2})
        self.assertIn("a clean deck was sent back", run.stdout)
        # The careful critic on the same anchors: told apart on every pair, the clean decks passed.
        run, result = self.calibrate("--repeats", "2", "--anchors", anchors)
        self.assertEqual((run.returncode, result["calibrated"], result["why"]), (0, True, []))
        self.assertEqual((result["primary"]["discriminated"], result["primary"]["cleanPassed"]), ({"met": 3, "of": 3}, {"met": 2, "of": 2}))
        # A planted deck measured without its clean twin is not measured: there is nothing to tell it apart from.
        run, result = self.calibrate("--repeats", "1", "--anchors", "finance:declined-answer")
        self.assertEqual((result["verdict"], result["unmeasured"], run.returncode), ("not measured", ["finance:declined-answer"], 2))

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
        self.assertIn("one of them", refused.stderr)



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
            self.assertEqual(len(json.loads(Path(tmp, "finance.analysis-results.json").read_text())["results"]), 11)
            out = os.path.join(tmp, "out")
            env = {**os.environ, "PROFESSIONAL_SLIDES_HOME": os.path.join(tmp, "home"), "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")}
            built = subprocess.run([NODE, str(runtime / "build-deck.mjs"), os.path.join(tmp, "finance.deck.json"), out, "--no-fetch"], cwd=ROOT, capture_output=True, text=True, env=env, timeout=300)
            result = json.loads(built.stdout.strip().splitlines()[0])
            self.assertEqual(result["status"], "built", built.stdout + built.stderr)
            gates = json.loads(Path(out, "gates.json").read_text())
            self.assertTrue(gates["accepted"])
            self.assertEqual(gates["voidCauses"], [])
