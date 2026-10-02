"""Which findings block: empty space past its bar, and the rules a deck predates.

A delivered fifty-page deck carried SCENE_VOID, COLUMN_VOID, DEAD_BAND and
INTERNAL_VOID on twelve pages, all advisory, all accepted; five of the six
pages its readers called empty were among them. The void findings are now
questions at mild values and block past the fill's `_block` bars
(weight.json geometryByFill), on the scene at authoring and on the render at
the build.

And a rule added today must not refuse a deck accepted yesterday: a deck
revised under `workflow: "existing_deck_revision"` that records an older
`rulesVersion` hears the rules introduced since as advisories.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import requires_python_package, run_node

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
CONTRACT = json.loads((ROOT / "skills" / "professional-slides" / "runtime" / "weight.json").read_text(encoding="utf-8"))

sys.path.insert(0, str(GATES))
import ink  # noqa: E402
import page_gates  # noqa: E402

FRAME = {"x": 72, "y": 162, "width": 1136, "height": 506}


def finding(code, measured):
    return {"slide": 2, "code": code, "measured": measured, "threshold": 0, "repair": "A repair sentence long enough to act on."}


def text(role, y, height, lines):
    line = " ".join(["measured"] * 8)  # a line of body measure, inside the CPL band
    body = " ".join([line] * lines)
    return {"type": "text", "role": role, "text": body, "frame": {"x": 72, "y": y, "width": 1136, "height": height},
            "style": {"align": "left", "valign": "top"},
            "data": {"textLayout": {"source": body, "lines": [line] * lines, "lineHeight": 20, "height": 20 * lines, "width": 900}}}


def page(ident, nodes):
    return {"id": ident, "contentFrame": dict(FRAME),
            "componentInstances": [{"id": "chrome", "component": "slide-chrome"}, {"id": f"{ident}-t", "component": "table", "frame": dict(FRAME)}],
            "nodes": [text("action-title", 58, 40, 1)] + nodes}


def half_empty(ident="half"):
    return page(ident, [text("paragraph", 162, 60, 3), text("paragraph", 608, 60, 3)])


def cover():
    return {"id": "cover", "componentInstances": [{"id": "cover", "component": "cover"}], "nodes": []}


class VoidSeverityTests(unittest.TestCase):
    def tearDown(self):
        page_gates.configure()
        page_gates.configure_rules()

    def severity(self, code, measured, fill="balanced"):
        page_gates.configure(fill)
        return page_gates.severity(finding(code, measured))["severity"]

    def test_a_mild_void_asks_and_a_deep_one_blocks(self):
        levels = CONTRACT["geometryByFill"]["balanced"]
        self.assertEqual(self.severity("INTERNAL_VOID", levels["internal_void_block"] - 0.005), "advisory")
        self.assertEqual(self.severity("INTERNAL_VOID", levels["internal_void_block"] + 0.005), "blocker")
        self.assertEqual(self.severity("DEAD_BAND", levels["dead_band_block"] - 0.01), "advisory")
        self.assertEqual(self.severity("DEAD_BAND", levels["dead_band_block"] + 0.01), "blocker")
        self.assertEqual(self.severity("COLUMN_VOID", {"band": levels["column_void_block"] - 0.01}), "advisory")
        self.assertEqual(self.severity("COLUMN_VOID", {"band": levels["column_void_block"] + 0.01}), "blocker")

    def test_a_scene_void_is_held_to_the_bar_of_the_band_it_measured(self):
        # 0.16 is past the internal-void and dead-band bars and under the column's.
        self.assertEqual(self.severity("SCENE_VOID", {"kind": "internal", "band": 0.16}), "blocker")
        self.assertEqual(self.severity("SCENE_VOID", {"kind": "dead", "band": 0.16}), "blocker")
        self.assertEqual(self.severity("SCENE_VOID", {"kind": "column", "band": 0.16}), "advisory")
        self.assertEqual(self.severity("SCENE_VOID", {"kind": "column", "band": 0.29}), "blocker")

    def test_a_charts_own_frame_keeps_its_air_as_a_question(self):
        # The smaller panel of a row on one scale leaves headroom above its
        # bars; a column of text that stops short is the defect.
        self.assertEqual(self.severity("COLUMN_VOID", {"band": 0.34, "plot": True}), "advisory")
        self.assertEqual(self.severity("SCENE_VOID", {"kind": "column", "band": 0.34, "plot": True}), "advisory")
        self.assertEqual(self.severity("SCENE_VOID", {"kind": "column", "band": 0.34}), "blocker")
        chart = {"x": 60, "y": 150, "width": 560, "height": 500}
        text_column = {"x": 640, "y": 150, "width": 560, "height": 500}
        slide = {"componentInstances": [{"component": "chart.column", "frame": chart}, {"component": "bullet-list", "frame": text_column}]}
        self.assertEqual([c["plot"] for c in page_gates.page_columns(slide)], [True, False])

    def test_the_bars_move_with_fill(self):
        # An airy deck leaves more air on purpose; its bars are higher.
        self.assertEqual(self.severity("INTERNAL_VOID", 0.2, "balanced"), "blocker")
        self.assertEqual(self.severity("INTERNAL_VOID", 0.2, "airy"), "advisory")
        for fill in ("full", "balanced", "airy"):
            levels = CONTRACT["geometryByFill"][fill]
            self.assertGreater(levels["internal_void_block"], levels["internal_void_max"], fill)
            self.assertGreater(levels["dead_band_block"], levels["dead_band_max"], fill)
            self.assertGreaterEqual(levels["column_void_block"], levels["column_void_max"], fill)

    def test_other_advisories_stay_advisory_and_blockers_block(self):
        self.assertEqual(self.severity("SCENE_INK", 0.01), "advisory")
        self.assertEqual(self.severity("THIN_PAGE", 1), "advisory")
        self.assertEqual(self.severity("CPL", 120), "blocker")

    def test_a_half_empty_page_is_refused_at_authoring(self):
        report = page_gates.run_gates({"slides": [cover(), half_empty()]})
        voids = [f for f in report["findings"] if f["code"] == "SCENE_VOID"]
        self.assertEqual(len(voids), 1)
        self.assertEqual(voids[0]["severity"], "blocker")
        self.assertEqual(voids[0]["measured"]["kind"], "internal")
        self.assertFalse(report["accepted"])


class RulesVersionTests(unittest.TestCase):
    def tearDown(self):
        page_gates.configure_rules()

    def test_a_revision_under_older_rules_hears_newer_ones_as_advisories(self):
        scene = {"slides": [cover(), half_empty()]}
        older = page_gates.run_gates(scene, deck={"workflow": "existing_deck_revision", "rulesVersion": 2})
        void = next(f for f in older["findings"] if f["code"] == "SCENE_VOID")
        self.assertEqual(void["severity"], "advisory")
        self.assertEqual(void["waived"], {"rulesVersion": 2, "introducedIn": 3})
        self.assertTrue(older["accepted"])
        self.assertIn("SCENE_VOID", older["waivedRules"])
        for deck in ({"workflow": "existing_deck_revision", "rulesVersion": CONTRACT["rulesVersion"]},
                     {"workflow": "new_deck", "rulesVersion": 1}, {"workflow": "existing_deck_revision"}, None):
            with self.subTest(deck=deck):
                report = page_gates.run_gates(scene, deck=deck)
                self.assertEqual(next(f for f in report["findings"] if f["code"] == "SCENE_VOID")["severity"], "blocker")

    def test_a_lowered_bar_is_new_only_between_the_old_bar_and_the_new(self):
        # Titles went from fourteen words to twelve and takeaways from three
        # lines to two: a revision under older rules is held to the old bar,
        # not waived past it.
        tightened = CONTRACT["rules"]["tightened"]
        self.assertEqual(tightened["TITLE_WORDS"]["before"], 14)
        self.assertEqual(page_gates.THRESHOLDS["title_words_max"], CONTRACT["plan"]["titleWords"]["max"])
        self.assertEqual(page_gates.TAKEAWAY_LINES_MAX, 2)
        cases = [("TITLE_WORDS", 13, "advisory"), ("TITLE_WORDS", 15, "blocker"), ("TAKEAWAY_LONG", 3, "advisory"), ("TAKEAWAY_LONG", 4, "blocker")]
        for code, measured, older in cases:
            with self.subTest(code=code, measured=measured):
                page_gates.configure_rules()
                self.assertEqual(page_gates.severity(finding(code, measured))["severity"], "blocker")
                page_gates.configure_rules({"workflow": "existing_deck_revision", "rulesVersion": 2})
                self.assertEqual(page_gates.severity(finding(code, measured))["severity"], older)

    def test_every_rule_names_a_version_after_the_first(self):
        introduced = CONTRACT["rules"]["introduced"]
        self.assertEqual(max(int(v) for v in introduced), CONTRACT["rulesVersion"])
        self.assertTrue(all(int(v) > 1 for v in introduced))
        rules = [rule for version in introduced.values() for rule in version]
        self.assertEqual(len(rules), len(set(rules)), "a rule is introduced once")

    def test_the_node_gates_waive_the_same_rules(self):
        result = run_node('''
import { waivedRules, applyRulesVersion, ruleIntroduced } from './skills/professional-slides/runtime/weight.mjs';
const findings = [{ code: 'VARIETY_EXHIBIT_MIX', severity: 'blocker' }, { code: 'VARIETY_PANELS', severity: 'blocker' },
  { code: 'CONTENT_ANSWER_UNCARRIED', rule: 'CONTENT_ANSWER_UNCARRIED.coverage', severity: 'blocking' },
  { code: 'CONTENT_ANSWER_UNCARRIED', severity: 'blocking' }, { code: 'VARIETY_TABLES', severity: 'blocker' }];
const deck = (rulesVersion, workflow = 'existing_deck_revision') => ({ workflow, rulesVersion });
const sev = (d) => applyRulesVersion(findings, d).map((f) => f.severity);
console.log(JSON.stringify({ v1: sev(deck(1)), v2: sev(deck(2)), v3: sev(deck(3)), fresh: sev(deck(1, 'new_deck')), none: sev({}),
  waived: [...waivedRules(deck(2))].sort(), mark: applyRulesVersion(findings, deck(1))[4].waived, old: ruleIntroduced('VARIETY_PANELS') }));
''')
        self.assertEqual(result["v1"], ["advisory", "blocker", "advisory", "blocking", "advisory"])
        self.assertEqual(result["v2"], ["advisory", "blocker", "advisory", "blocking", "blocker"])
        self.assertEqual(result["v3"], ["blocker", "blocker", "blocking", "blocking", "blocker"])
        self.assertEqual(result["fresh"], result["v3"])
        self.assertEqual(result["none"], result["v3"])
        # A deck recorded under version 2 predates every rule a later version introduced.
        self.assertEqual(result["waived"], sorted(rule for version, rules in CONTRACT["rules"]["introduced"].items() if int(version) > 2 for rule in rules))
        self.assertEqual(result["mark"], {"rulesVersion": 1, "introducedIn": 2})
        self.assertEqual(result["old"], 1)
        # The Python gates read the same map.
        self.assertEqual(set(page_gates.waived_rules({"workflow": "existing_deck_revision", "rulesVersion": 2})), set(result["waived"]))


class GateCliTests(unittest.TestCase):
    def test_one_run_writes_the_report_and_the_budget(self):
        # author-deck asked page_gates.py twice a run, once for each file.
        with tempfile.TemporaryDirectory() as tmp:
            scene = Path(tmp) / "scene.json"
            scene.write_text(json.dumps({"slides": [cover(), half_empty(), half_empty("p3")]}), encoding="utf-8")
            report, budget = Path(tmp) / "gates.json", Path(tmp) / "budget.json"
            run = subprocess.run([sys.executable, str(GATES / "page_gates.py"), str(scene), "--report", str(report),
                                  "--budget-report", str(budget), "--workflow", "existing_deck_revision", "--rules-version", "2"],
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            gates = json.loads(report.read_text(encoding="utf-8"))
            self.assertEqual(gates["rulesVersion"], 2)
            self.assertTrue(all(f["severity"] == "advisory" for f in gates["findings"] if f["code"] == "SCENE_VOID"))
            alone = subprocess.run([sys.executable, str(GATES / "page_gates.py"), str(scene), "--budget"], capture_output=True, text=True)
            self.assertEqual(json.loads(budget.read_text(encoding="utf-8")), json.loads(alone.stdout))
            strict = subprocess.run([sys.executable, str(GATES / "page_gates.py"), str(scene), "--report", str(report)], capture_output=True, text=True)
            self.assertEqual(strict.returncode, 2, strict.stderr)

    def test_the_thresholds_print_without_a_scene(self):
        run = subprocess.run([sys.executable, str(GATES / "page_gates.py"), "--thresholds-markdown"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertTrue(run.stdout.startswith("| Code | Threshold |"))
        self.assertIn("`INTERNAL_VOID` | blocks above", run.stdout)


@requires_python_package("PIL", "numpy")
class RenderReadOnceTests(unittest.TestCase):
    def test_each_render_is_decoded_once_and_at_the_canvas_size(self):
        from PIL import Image, ImageDraw
        with tempfile.TemporaryDirectory() as tmp:
            slides = [cover()] + [page(f"p{i}", [text("paragraph", y, 40, 2) for y in range(162, 668, 46)]) for i in range(3)]
            for number in range(1, len(slides) + 1):
                image = Image.new("RGB", (1281, 720), "white")  # a renderer that rounds up still reads on the canvas
                ImageDraw.Draw(image).rectangle([72, 162, 1208, 660], fill="#333333")
                image.save(Path(tmp) / f"slide-{number}.png")
            self.assertEqual(ink.load_grey(Path(tmp) / "slide-1.png").shape, (ink.CANVAS_H, ink.CANVAS_W))
            decoded = []
            original = page_gates.load_grey
            page_gates.load_grey = lambda path: decoded.append(path) or original(path)
            try:
                report = page_gates.run_gates({"slides": slides}, tmp)
            finally:
                page_gates.load_grey = original
            self.assertEqual(len(decoded), 3)  # one decode a content page, the cover none
            self.assertEqual(report["pixelGatesSkipped"], [])

    def test_a_page_of_dark_panels_is_measured_against_its_light_canvas(self):
        # Two dark panels covering most of a white page, white type in them: the
        # commonest grey is the panels', and read as the background it made
        # the page's own canvas and every mark on the panels read as empty.
        from PIL import Image, ImageDraw
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "slide-1.png"
            image = Image.new("RGB", (1280, 720), "#FFFFFF")
            draw = ImageDraw.Draw(image)
            draw.rectangle([60, 152, 440, 668], fill="#051C2C")
            draw.rectangle([456, 152, 1220, 668], fill="#051C2C")
            for y in range(180, 640, 24):
                draw.rectangle([90, y, 400, y + 10], fill="#FFFFFF")
            image.save(path)
            rows = ink.load_ink_rows(path)
            self.assertGreater(min(rows[160:660]), 300, "every row of the panels is occupied")
            findings = []
            page_gates.gate_ink_and_dead_band(2, rows, findings, ink.load_ink_rows(path, ink.SURFACE_LUMINANCE))
            self.assertNotIn("DEAD_BAND", [f["code"] for f in findings])

    def test_the_rows_and_the_matrix_agree_with_the_path_readers(self):
        from PIL import Image, ImageDraw
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "slide-1.png"
            image = Image.new("RGB", (1280, 720), "#FAF7F2")
            ImageDraw.Draw(image).rectangle([100, 200, 600, 400], fill="#222222")
            ImageDraw.Draw(image).rectangle([700, 200, 900, 400], fill="#F0EBE3")
            image.save(path)
            grey = ink.load_grey(path)
            self.assertEqual(ink.ink_rows(grey), ink.load_ink_rows(path))
            self.assertEqual(ink.ink_rows(grey, ink.SURFACE_LUMINANCE), ink.load_ink_rows(path, ink.SURFACE_LUMINANCE))
            self.assertTrue((ink.ink_matrix(grey, ink.SURFACE_LUMINANCE) == ink.load_ink_matrix(path, ink.SURFACE_LUMINANCE)).all())

    def test_the_ink_estimate_is_drawn_once_a_page(self):
        slides = [cover()] + [page(f"p{i}", [text("paragraph", 162, 40, 2)]) for i in range(14)]
        for slide in slides[1:]:
            slide["readingTask"] = "table-led"
        calls = []
        original = page_gates.scene_ink_estimate
        page_gates.scene_ink_estimate = lambda slide: calls.append(id(slide)) or original(slide)
        try:
            page_gates.run_gates({"slides": slides}, gates={"SCENE_INK", "DECK_INK"})
        finally:
            page_gates.scene_ink_estimate = original
        self.assertEqual(len(calls), len(set(calls)))
        self.assertEqual(len(calls), 14)


class CompileRulesVersionTests(unittest.TestCase):
    """A revision's pages are compiled under the rules the deck records: a
    compile refusal introduced since is an advisory on the page, as it is at
    every gate, and a bar a version lowered holds the revision to the old bar."""

    def compile(self, edit):
        return run_node(f'''
import {{ compilePage }} from './skills/professional-slides/runtime/page-types.mjs';
import {{ scaffoldPage }} from './skills/professional-slides/runtime/author-deck.mjs';
const base = scaffoldPage('lookup');
Object.assign(base, {{ title: 'Eastern costs a third more to run than the electric lines',
  why: 'A lookup page holds the measures a reader compares line by line', settles: {{ kind: 'structure', what: 'Line operating statistics for FY26' }},
  adds: 'The implication column says which line grows first and why' }});
const edit = {edit};
const page = edit(structuredClone(base));
const run = (rules) => {{ try {{ const s = compilePage(page, 0, {{ rules }}); return {{ ok: true, advisories: (s.pageType.advisories || []).map((a) => a.split(':')[0]) }}; }} catch (e) {{ return {{ ok: false, error: e.message.split(' - ')[0] }}; }} }};
const revision = (v) => ({{ workflow: 'existing_deck_revision', rulesVersion: v }});
console.log(JSON.stringify({{ now: run(null), v1: run(revision(1)), v2: run(revision(2)), v3: run(revision(3)), fresh: run({{ workflow: 'new_deck', rulesVersion: 1 }}) }}));
''')

    def test_a_table_rule_the_revision_predates_is_advice_on_the_page(self):
        # Two body rows (TABLE_TOO_SHORT, version 2) and a blank total (TOTAL_ROW_BLANK, version 2).
        result = self.compile("(p) => { const body = p.exhibit.rows.filter((r) => Array.isArray(r)); p.exhibit.rows = [...body.slice(0, 2), { style: 'total', cells: ['Total', '', '', '', '', '', ''] }]; return p; }")
        self.assertFalse(result["now"]["ok"])
        self.assertIn("TABLE_TOO_SHORT", result["now"]["error"])
        self.assertTrue(result["v1"]["ok"], result["v1"])
        self.assertIn("TABLE_TOO_SHORT", result["v1"]["advisories"])
        self.assertIn("TOTAL_ROW_BLANK", result["v1"]["advisories"], "the check reads on past a waived refusal")
        for held in ("v2", "v3", "fresh"):
            self.assertFalse(result[held]["ok"], held)

    def test_a_lowered_title_bar_holds_the_revision_to_the_old_bar(self):
        thirteen = self.compile("(p) => ({ ...p, title: 'The Eastern line costs a third more to run than the electric lines' })")
        self.assertFalse(thirteen["now"]["ok"])
        self.assertTrue(thirteen["v2"]["ok"])
        self.assertIn("TITLE_WORDS", thirteen["v2"]["advisories"])
        self.assertFalse(thirteen["v3"]["ok"])
        fifteen = self.compile("(p) => ({ ...p, title: 'The Eastern line costs a third more to run than the three electric lines do' })")
        self.assertFalse(fifteen["v2"]["ok"], "past the old bar the rule is as it always was")

    def test_a_chart_form_refusal_is_versioned_like_the_rest(self):
        result = self.compile("(p) => { p.exhibit.columns = p.exhibit.columns.map((c) => (c && c.implication ? { label: 'Depot plans', implication: true } : c)); return p; }")
        self.assertIn("GUTTER_UNEARNED", CONTRACT["rules"]["introduced"]["3"])
        self.assertFalse(result["now"]["ok"])
        self.assertTrue(result["v2"]["ok"])
        self.assertIn("GUTTER_UNEARNED", result["v2"]["advisories"])


class AuthoringRulesVersionTests(unittest.TestCase):
    """What authoring holds a revision to: a variety or content rule it
    predates is reported beside the findings, not among them, and a deck that
    records no rules version sends the page gates no version at all."""

    DECK = '''
import { authorDeck, scaffoldPage, sceneGateFindings } from './skills/professional-slides/runtime/author-deck.mjs';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = mkdtempSync(path.join(os.tmpdir(), 'rules-'));
const LINES = ['Eastern', 'Valley', 'Dales', 'Airport', 'Coast', 'Harbour', 'Moor', 'Canal', 'Minster', 'Pennine', 'Castle', 'Abbey', 'Market', 'Forest', 'River', 'Summit', 'Chapel', 'Bridge', 'Quarry', 'Beacon'];
const pages = LINES.map((line, i) => Object.assign(scaffoldPage('lookup', { id: `p${i}` }), {
  title: `The ${line} line runs ${i + 2} trains an hour at its busiest`,
  why: `A lookup of the ${line} line measures a reader compares`,
  settles: { kind: 'structure', what: `The ${line} line operating statistics for FY26` },
  adds: `The ${line} column says which line grows first and why` }));
const doc = (extra) => ({ deck: { schema: 'professional-slides.deck/v3', id: 'rules', brief: 'Which fleet should the operator lease next year?', answer: 'Lease battery trains for the coastal branches', ...extra }, pages });
const codes = (list) => list.map((f) => [f.code, f.severity ?? null]);
'''

    def test_a_revision_hears_the_contract_it_predates_as_advice(self):
        result = run_node(self.DECK + '''
const older = await authorDeck(doc({ workflow: 'existing_deck_revision', rulesVersion: 2 }), { baseDir: dir });
const fresh = await authorDeck(doc({}), { baseDir: dir });
console.log(JSON.stringify({ older: codes(older.findings), olderAdvice: codes(older.pageGateAdvisories), fresh: codes(fresh.findings) }));
''')
        self.assertIn(["VARIETY_EXHIBIT_MIX", "blocker"], result["fresh"])
        self.assertNotIn("VARIETY_EXHIBIT_MIX", [c for c, _ in result["older"]])
        self.assertIn(["VARIETY_EXHIBIT_MIX", "advisory"], result["olderAdvice"])
        self.assertTrue(all(s in ("blocker", "blocking", None) for _, s in result["older"]), result["older"])

    def test_a_deck_recording_no_version_sends_the_gates_none(self):
        result = run_node(self.DECK + '''
const deck = { slides: [{ id: 'p0', nodes: [], componentInstances: [] }] };
const withNull = sceneGateFindings(deck, process.env.RUNTIME_PYTHON || 'python3', { workflow: 'existing_deck_revision', rulesVersion: null });
console.log(JSON.stringify({ ran: withNull.ran, reason: withNull.reason ?? null }));
''')
        self.assertTrue(result["ran"], result["reason"])


if __name__ == "__main__":
    unittest.main()
