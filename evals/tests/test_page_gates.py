"""The deterministic page gates, measured against a real deck and its render.

Two halves:

* Defects. Each gate must fire on a page that carries its defect, with the
  right code and a repair sentence; the shipped NYC/SF example is the base deck.
* A synthetic good page. A slide built to satisfy every threshold must produce
  no findings at all, so the gates are falsifiable rather than always-on.
"""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"

sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402

from node_probe import requires_python_package, example_scene, example_scene_file  # noqa: E402

# The three gates that read the renders need Pillow (see requirements.txt).
# Everything else in this file works off the scene.
needs_pixels = requires_python_package('PIL')


def load_scene():
    # The shipped NYC/SF example, compiled; a copy so a test can mutate it.
    import copy
    return copy.deepcopy(example_scene("nyc-or-sf"))


def codes(report):
    return {f["code"] for f in report["findings"]}


def slides_with(report, code):
    return sorted({f["slide"] for f in report["findings"] if f["code"] == code and f["slide"]})


# The synthetic fixtures below measure geometry and typography. Density is a
# separate contract (see test_deck_shape.py), so these scenes switch its floors
# off rather than padding a fixture page to 95 words.
WEIGHT_OFF = {"pageWords": 0, "columnFill": 0, "plotSpan": 0, "pointWords": 0, "tableFill": 0, "elements": 1}


class EvidenceMultiplicityTests(unittest.TestCase):
    def test_area_and_label_counts_preserve_review_findings_without_forcing_filler(self):
        from test_deck_shape import page, deck
        process = page(1, ['chevron-process'])
        process['contentFrame'] = {'x': 60, 'y': 152, 'width': 1160, 'height': 516}
        process['componentInstances'] = [{'component': 'chevron-process', 'frame':
            {'x': 60, 'y': 294, 'width': 1160, 'height': 172}}]
        chart = page(2, ['chart.line'])
        report = page_gates.run_gates(deck([process, chart], fill='full'),
            gates={'HERO_EXHIBIT', 'NUMBERS_ON_MARKS'})
        self.assertTrue(report['accepted'])
        self.assertTrue({'HERO_EXHIBIT', 'NUMBERS_ON_MARKS'} <= codes(report))
        self.assertTrue(all(f['severity'] == 'advisory' for f in report['findings']))
        # Typography remains an independent blocking contract.
        invalid = good_slide()
        invalid['nodes'][0]['style']['fontSize']['value'] = 100
        report = page_gates.run_gates({'slides': [invalid]}, gates={'TYPE_RANGE'})
        self.assertFalse(report['accepted'])

    def test_summary_and_single_exhibit_counts_do_not_waive_missing_argument(self):
        from test_deck_shape import page, deck
        gates = {"THIN_EVIDENCE", "MISSING_ARGUMENT"}
        summary = {**page(1, ['points']), 'role': 'executive-summary'}
        bridge = page(2, ['chart.waterfall'])
        report = page_gates.run_gates(deck([summary, bridge], fill='full'), gates=gates)
        self.assertTrue(report['accepted'])
        self.assertEqual([f['measured'] for f in report['findings']], [0, 1])
        self.assertTrue(all(f['severity'] == 'advisory' for f in report['findings']))
        empty_comparison = page(3, ['image-frame', 'image-frame'], photos=2, texts=['London', 'New York'])
        report = page_gates.run_gates(deck([empty_comparison], fill='full'), gates=gates)
        self.assertFalse(report['accepted'])
        self.assertTrue(any(f['code'] == 'MISSING_ARGUMENT' and f['severity'] == 'blocker' for f in report['findings']))


def good_slide():
    """A page that satisfies every gate: one hero exhibit, tight prose, a title."""

    def text(node_id, role, size, lines, x=60, y=200, width=560, height=40):
        joined = " ".join(lines)
        return {
            "type": "text", "id": node_id, "role": role,
            "frame": {"x": x, "y": y, "width": width, "height": height},
            "style": {"fontSize": {"value": size}},
            "text": "\n".join(lines),
            "data": {"textLayout": {"source": joined, "lines": lines}},
        }

    return {
        "id": "s02",
        "contentFrame": {"x": 60, "y": 162, "width": 1160, "height": 506},
        "nodes": [
            text("t", "action-title", 24, ["Jefferson clears the reading bar that Alvarado misses"],
                 y=48, width=1160, height=60),
            text("p", "paragraph", 12, [
                "Jefferson reaches the state reading standard in every measured grade,",
                "and Alvarado trails it by nine points in the two grades that matter.",
                "That gap decides the shortlist before any visit is scheduled.",
            ], x=700, y=200, width=520, height=90),
            # The commentary runs down the chart's height: three lines at the
            # top of a column beside a 440px chart is the half-empty column
            # SCENE_VOID reads by column.
            text("p2", "paragraph", 12, [
                "The nine points are the whole of the difference between them,",
                "and neither school moved by more than two points in three years.",
            ], x=700, y=330, width=520, height=60),
            text("p3", "paragraph", 12, [
                "So the reading bar settles the order and the visits settle the fit,",
                "which is the sequence the shortlist memo asks the panel to follow.",
            ], x=700, y=450, width=520, height=60),
            text("a1", "axis-label", 10, ["0"], x=60, y=600, width=40, height=14),
            text("a2", "axis-label", 10, ["25"], x=60, y=500, width=40, height=14),
            text("a3", "axis-label", 10, ["50"], x=60, y=400, width=40, height=14),
            text("src", "source-text", 8, ["Source: NY State Education Department, 2025."],
                 y=676, width=900, height=20),
            text("pn", "page-number", 8, ["2"], x=1200, y=676, width=40, height=20),
        ],
        "componentInstances": [
            {"id": "chrome", "instanceId": "s02:chrome", "component": "slide-chrome",
             "frame": {"x": 0, "y": 0, "width": 1280, "height": 720}},
            {"id": "s02-0", "instanceId": "s02:s02-0", "component": "chart.column",
             "frame": {"x": 60, "y": 178, "width": 600, "height": 440}},
            {"id": "s02-1", "instanceId": "s02:s02-1", "component": "paragraph",
             "frame": {"x": 700, "y": 190, "width": 520, "height": 330}},
        ],
    }


class SelectedSectionNavigationTests(unittest.TestCase):
    def slides(self):
        return [{"nodes": [{"type": "text", "role": "tracker-compact-label",
                            "text": "Origins" if i < 6 else "Adaptations",
                            "data": {"trackerId": "sections", "sectionId": "a" if i < 6 else "b", "selected": True}}]}
                for i in range(12)]

    def findings(self, slides):
        findings = []
        page_gates.gate_deck_structure(slides, list(range(len(slides))), findings)
        return findings

    def test_selected_sections_do_not_require_extra_divider_pages(self):
        self.assertEqual(self.findings(self.slides()), [])

    def test_opening_summary_does_not_select_a_body_section(self):
        slides = [{"role": "executive-summary", "nodes": []}] + self.slides()
        self.assertEqual(self.findings(slides), [])
        slides[4]["nodes"] = []
        self.assertTrue(self.findings(slides))

    def test_pill_labels_supply_the_same_selected_navigation(self):
        slides = self.slides()
        for slide in slides:
            slide["nodes"][0]["role"] = "tracker-pill-label"
        self.assertEqual(self.findings(slides), [])
        slides[3]["nodes"][0]["data"]["selected"] = False
        self.assertTrue(self.findings(slides))

    def test_missing_selected_page_still_fails(self):
        slides = self.slides()
        slides[3]["nodes"] = []
        self.assertTrue(self.findings(slides))

    def test_one_section_or_unselected_labels_do_not_supply_navigation(self):
        for change in ({"sectionId": "a"}, {"selected": False}, {"trackerId": ""}):
            with self.subTest(change=change):
                slides = self.slides()
                for slide in slides:
                    slide["nodes"][0]["data"].update(change)
                self.assertTrue(self.findings(slides))

    def test_inconsistent_tracker_ids_do_not_form_one_navigation(self):
        slides = self.slides()
        slides[0]["nodes"][0]["data"]["trackerId"] = "other"
        self.assertTrue(self.findings(slides))


class SyntheticGoodPageTests(unittest.TestCase):
    def test_a_page_that_meets_every_threshold_produces_no_findings(self):
        scene = {"slides": [{"id": "s01", "nodes": [], "componentInstances": [
            {"id": "cover", "component": "cover", "frame": {"x": 0, "y": 0, "width": 1280, "height": 720}}]},
            good_slide()], "weight": WEIGHT_OFF}
        report = page_gates.run_gates(scene, render_dir=None)
        self.assertEqual(report["findings"], [], json.dumps(report["findings"], indent=1))
        self.assertTrue(report["accepted"])

    def test_every_gate_is_falsifiable_on_the_same_page(self):
        """Break one thing at a time; each break must raise exactly its own code."""
        base = good_slide()

        def scene_with(mutate):
            slide = copy.deepcopy(base)
            mutate(slide)
            return {"slides": [slide], "weight": WEIGHT_OFF}

        def node(slide, node_id):
            return next(n for n in slide["nodes"] if n["id"] == node_id)

        def set_title(slide, text_value, lines=None):
            title = node(slide, "t")
            lines = lines or [text_value]
            title["text"] = "\n".join(lines)
            title["data"]["textLayout"] = {"source": text_value, "lines": lines}

        cases = {
            "TITLE_LINES": lambda s: set_title(s, "a b", ["a", "b", "c"]),
            "TITLE_WORDS": lambda s: set_title(s, " ".join(f"word{i}" for i in range(20))),
            "TYPE_RANGE": lambda s: node(s, "p")["style"].update({"fontSize": {"value": 18}}),
            "CPL": lambda s: node(s, "p")["data"]["textLayout"].update(
                {"lines": ["x" * 120, "y" * 110], "source": "x" * 120}),
            "NICE_TICKS": lambda s: node(s, "a2")["data"]["textLayout"].update(
                {"lines": ["14.025"], "source": "14.025"}),
            "HERO_EXHIBIT": lambda s: s["componentInstances"][1]["frame"].update(
                {"width": 300, "height": 200}),
            "WORDS": lambda s: node(s, "p")["data"]["textLayout"].update(
                {"source": " ".join(["evidence"] * 200),
                 "lines": [" ".join(["evidence"] * 40)] * 5}),
        }
        for code, mutate in cases.items():
            with self.subTest(code=code):
                report = page_gates.run_gates(scene_with(mutate), render_dir=None)
                self.assertIn(code, codes(report), f"{code} did not fire")

    def test_every_finding_carries_a_repair_sentence(self):
        scene = load_scene()
        report = page_gates.run_gates(scene, render_dir=None)
        self.assertTrue(report["findings"])
        for item in report["findings"]:
            self.assertEqual(
                sorted(item), ["code", "measured", "repair", "severity", "slide", "threshold"])
            self.assertGreaterEqual(len(item["repair"]), 40, item)
            self.assertIn(" ", item["repair"].strip())

    def test_evidence_can_end_with_a_qualification_without_a_conclusion_strip(self):
        slide = good_slide()
        paragraph = next(n for n in slide["nodes"] if n["id"] == "p")
        lines = [
            "Jefferson reaches the reading standard in every measured grade.",
            "Alvarado does not reach it in either of the two relevant grades.",
        ]
        paragraph["text"] = "\n".join(lines)
        paragraph["data"]["textLayout"] = {"source": " ".join(lines), "lines": lines}
        # This fixture measures geometry, not density: the weight floors are
        # off so a deliberately minimal page does not trip them.
        report = page_gates.run_gates({"slides": [slide], "weight": WEIGHT_OFF}, render_dir=None)
        self.assertTrue(report["accepted"], report["findings"])




class TextPageInkFloorTests(unittest.TestCase):
    """A page of type is held to the ink its own words produce.

    `ink_min` is calibrated on pages with an exhibit: the careful sample's ink
    first quartile is 0.121 over 137 analytical slides, and the balanced floor
    of 0.115 sits just under it. A page of body type cannot reach that at any
    honest length. Rendering text pages from 93 to 185 words gives a straight
    line at 0.00052 ink per word, so 0.115 needs about 220 words of body against
    a reference body of 128 - the floor was not a high bar for those pages, it
    was an impossible one, and an executive summary of five findings, four
    metrics and a takeaway measured 0.096 and was reported as "mostly empty".

    The floor for those pages is now the ink their own `pageWords` produces, so
    the two gates agree by construction and a genuinely thin text page still
    fails both.
    """

    def test_the_floor_follows_the_deck_word_floor(self):
        page_gates.configure("balanced")
        floor = page_gates.text_page_ink_floor()
        words = page_gates.WEIGHT["pageWords"]
        self.assertAlmostEqual(floor, 0.00052 * 0.9 * words, places=6)
        # Well under the exhibit floor, and reachable by a page at its word floor:
        # 95 words measured 0.0556 against this.
        self.assertLess(floor, page_gates.THRESHOLDS["ink_min"])
        self.assertLess(floor, 0.0556)

    def test_a_denser_deck_asks_a_text_page_for_more_ink(self):
        page_gates.configure("full")
        full = page_gates.text_page_ink_floor()
        page_gates.configure("balanced")
        balanced = page_gates.text_page_ink_floor()
        self.assertGreater(full, balanced)

    def test_a_text_page_at_its_word_floor_passes_and_a_thin_one_fails(self):
        page_gates.configure("balanced")
        floor = page_gates.text_page_ink_floor()
        canvas = float(page_gates.CANVAS_W * page_gates.CANVAS_H)

        def rows_for(fraction):
            rows = [0] * page_gates.CANVAS_H
            per = int(fraction * canvas) // page_gates.FOOTER_TOP
            for y in range(page_gates.FOOTER_TOP):
                rows[y] = per
            return rows

        # 0.0556 is what a rendered 95-word text page actually measured.
        findings = []
        page_gates.gate_ink_and_dead_band(2, rows_for(0.0556), findings, text_page=True)
        self.assertNotIn("INK_COVERAGE", [f["code"] for f in findings])
        # A third of the word floor is a page that asserts and does not show.
        findings = []
        page_gates.gate_ink_and_dead_band(2, rows_for(0.018), findings, text_page=True)
        ink = [f for f in findings if f["code"] == "INK_COVERAGE"]
        self.assertEqual(len(ink), 1)
        self.assertAlmostEqual(ink[0]["threshold"], round(floor, 4), places=4)
        self.assertIn("word floor", ink[0]["repair"])



class ShapeConstraintTests(unittest.TestCase):
    """PAGE_SHAPE_FLAT says which of the two causes it found.

    A deck can be flat because its pages name an explicit `layout`, which is
    fixable by deleting a line, or because its pages carry one exhibit and no
    commentary, which leaves the composer one viable shape and is not a layout
    problem at all. Told the wrong one, an author goes looking for a shape that
    does not exist - the Marvel rebuild ran 23 of 31 pages that way.
    """

    def setUp(self):
        self.scene = load_scene()

    def test_a_closing_line_under_the_exhibit_is_not_commentary(self):
        # Every shape has room for a full-width band at the foot, so a page
        # with one exhibit and a so-what still has one shape to take.
        exhibit = {"component": "chart.bar", "frame": {"x": 60, "y": 160, "width": 1160, "height": 380}}
        under = {"component": "insight", "frame": {"x": 60, "y": 560, "width": 1160, "height": 60}}
        beside = {"component": "bullet-list", "frame": {"x": 820, "y": 180, "width": 400, "height": 300}}
        self.assertTrue(page_gates.shape_constrained({"componentInstances": [exhibit, under]}))
        self.assertFalse(page_gates.shape_constrained({"componentInstances": [exhibit, beside]}))

    def test_two_exhibits_are_never_constrained(self):
        pair = [{"component": "chart.bar", "frame": {"x": 60, "y": 160, "width": 560, "height": 380}},
                {"component": "chart.line", "frame": {"x": 660, "y": 160, "width": 560, "height": 380}}]
        self.assertFalse(page_gates.shape_constrained({"componentInstances": pair}))

    def test_the_finding_names_the_constrained_pages(self):
        page_gates.configure("balanced")
        exhibit = {"component": "table", "frame": {"x": 60, "y": 160, "width": 1160, "height": 380}}
        flat = [{"componentInstances": [exhibit]} for _ in range(12)]
        findings = []
        page_gates.gate_page_shape_flat(flat, list(range(12)), findings, "balanced")
        self.assertEqual(len(findings), 1)
        measured = findings[0]["measured"]
        self.assertEqual(len(measured["constrainedPages"]), 12)
        self.assertIn("evidence relationship", findings[0]["repair"])
        self.assertIn("adding boxes", findings[0]["repair"])


class ProfileTests(unittest.TestCase):
    def test_density_profiles_only_move_the_word_budget(self):
        scene = load_scene()
        counts = {}
        for profile in ("live-pitch", "executive", "pre-read"):
            report = page_gates.run_gates(scene, render_dir=None, profile=profile)
            counts[profile] = report["countsByCode"]
        self.assertGreater(counts["live-pitch"].get("WORDS", 0), counts["pre-read"].get("WORDS", 0))
        for code in ("TYPE_RANGE", "CPL", "HERO_EXHIBIT"):
            self.assertEqual(counts["live-pitch"].get(code), counts["pre-read"].get(code))

    def test_an_unknown_profile_is_refused(self):
        with self.assertRaises(ValueError):
            page_gates.run_gates({"slides": []}, profile="dense")


class CliTests(unittest.TestCase):
    def test_cli_exits_two_and_writes_a_machine_readable_report(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "gates.json"
            # A known defect: one action title set at 40pt, far past its range.
            scene = load_scene()
            title = next(n for sl in scene["slides"] for n in sl["nodes"] if n.get("role") == "action-title")
            title["style"]["fontSize"] = {**title["style"]["fontSize"], "value": 40}
            scene_path = Path(tmp) / "scene.json"
            scene_path.write_text(json.dumps(scene))
            result = subprocess.run(
                [sys.executable, str(GATES / "page_gates.py"), str(scene_path),
                 "--report", str(out), "--profile", "executive"],
                capture_output=True, text=True, cwd=str(ROOT))
            self.assertEqual(result.returncode, 2, result.stderr)
            report = json.loads(out.read_text())
            self.assertFalse(report["accepted"])
            self.assertIn("TYPE_RANGE", report["countsByCode"])
            self.assertIn("page gates: REJECTED", result.stderr)

    def test_cli_exits_zero_on_a_clean_deck(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            scene = Path(tmp) / "scene.json"
            scene.write_text(json.dumps({"slides": [good_slide()], "weight": WEIGHT_OFF}))
            result = subprocess.run(
                [sys.executable, str(GATES / "page_gates.py"), str(scene)],
                capture_output=True, text=True, cwd=str(ROOT))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
