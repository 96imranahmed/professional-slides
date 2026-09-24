"""The page gates' scene-level measures: one body-word counter, and how full a
page's body is before anything is rendered.

* One counter. The authoring compiler writes each composed page's body words
  on the scene as `planBodyWords`, counted as the text contract counts its
  plan. THIN_PAGE and the density report read that number when it is there,
  so authoring and the build cannot disagree about whether a page is thin;
  scenes without it keep the band count.
* SCENE_VOID. A band of the body that nothing crosses, measured on node
  frames: a roadmap with its lower half blank, cards empty below their
  paragraph. The render's band gates only run at the build; this runs at
  authoring. DECK_SCENE_VOID blocks the habit, in the shape of
  DECK_THIN_PAGES.
* `--budget`. Each content page's body, floor, ceiling, footer and fill, for
  the author to write to - the same numbers the gates read.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"

sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402

FRAME = {"x": 72, "y": 162, "width": 1136, "height": 506}
BUDGET_KEYS = {"slide", "id", "readingTask", "body", "floor", "ceiling", "footer",
               "footerRatio", "occupied", "largestEmptyBand"}


def text(role, y, height, words=12, x=72, width=1136, lines=None):
    body = " ".join(["word"] * words)
    node = {"type": "text", "role": role, "text": body,
            "frame": {"x": x, "y": y, "width": width, "height": height},
            "style": {"align": "left", "valign": "top"}}
    if lines is not None:
        node["data"] = {"textLayout": {"source": body, "lines": ["word"] * lines,
                                       "lineHeight": 20, "height": 20 * lines, "width": width * 0.8}}
    return node


def rect(role, y, height, x=72, width=1136):
    return {"type": "rect", "role": role, "frame": {"x": x, "y": y, "width": width, "height": height}}


def content_page(ident, nodes, **extra):
    return {"id": ident, "contentFrame": dict(FRAME),
            "componentInstances": [{"id": "chrome", "component": "slide-chrome"},
                                   {"id": f"{ident}-0", "component": "table"}],
            "nodes": [text("action-title", 58, 40, words=8)] + nodes, **extra}


def full_page(ident="full"):
    """Rows of text from the top of the body to its foot."""
    return content_page(ident, [text("paragraph", y, 40, lines=2) for y in range(162, 668, 46)])


def half_empty_page(ident="half"):
    """A roadmap's phases at the top, commentary pinned to the foot, nothing between."""
    return content_page(ident, [
        rect("roadmap-phase", 162, 30),
        text("paragraph", 200, 180, lines=9),
        text("paragraph", 608, 60, lines=3),
    ])


def empty_cards_page(ident="cards"):
    """Three cards drawn to the full body, each with one paragraph at its top."""
    nodes = []
    for column in range(3):
        x = 72 + column * 384
        nodes.append(rect("card-surface", 162, 506, x=x, width=368))
        nodes.append(text("card-text", 180, 100, x=x + 16, width=336, lines=5))
    return content_page(ident, nodes)


def cover():
    return {"id": "cover", "componentInstances": [{"id": "cover", "component": "cover"}], "nodes": []}


class UnifiedCounterTests(unittest.TestCase):
    def test_plan_body_words_override_the_band_count(self):
        slide = content_page("p", [text("paragraph", 200, 100, words=30)], readingTask="table-led")
        self.assertEqual(page_gates.body_words(slide), 30)
        slide["planBodyWords"] = 250
        self.assertEqual(page_gates.body_words(slide), 250)

    def test_thin_page_reads_the_plan_count(self):
        # Thirty words on the page by the band count, under any floor. The
        # compiler counted the page's exhibit text and made it 250: the floor
        # reads that, so authoring and the build agree.
        slide = content_page("p", [text("paragraph", 200, 100, words=30)], readingTask="table-led")
        floor = page_gates.READING_TASK_FLOORS["table-led"]
        found = []
        page_gates.gate_thin_page(1, slide, found)
        self.assertEqual([(f["code"], f["measured"], f["threshold"]) for f in found], [("THIN_PAGE", 30, floor)])
        slide["planBodyWords"] = 250
        found = []
        page_gates.gate_thin_page(1, slide, found)
        self.assertEqual(found, [])
        slide["planBodyWords"] = floor - 1
        found = []
        page_gates.gate_thin_page(1, slide, found)
        self.assertEqual([(f["code"], f["measured"]) for f in found], [("THIN_PAGE", floor - 1)])

    def test_a_scene_without_the_plan_count_keeps_the_band_count(self):
        slide = content_page("p", [text("paragraph", 200, 100, words=41), text("source-text", 679, 12, words=9)])
        self.assertEqual(page_gates.body_words(slide), page_gates.body_bands(slide)[0])
        self.assertEqual(page_gates.body_words(slide), 41)
        for bad in (None, "250", True, -3):
            slide["planBodyWords"] = bad
            self.assertEqual(page_gates.body_words(slide), 41, bad)

    def test_the_density_report_reads_the_same_counter(self):
        scene = {"slides": [cover(), content_page("p", [text("paragraph", 200, 100, words=30)], planBodyWords=222)]}
        report = page_gates.run_gates(scene)
        self.assertEqual(report["density"]["bodyWords"]["median"], 222)


class SceneVoidTests(unittest.TestCase):
    def test_a_full_page_has_no_band(self):
        coverage = page_gates.scene_coverage(full_page())
        self.assertLess(coverage["largestEmptyBand"], 0.05)
        self.assertGreater(coverage["occupied"], 0.5)
        found = []
        page_gates.gate_scene_void(1, full_page(), found)
        self.assertEqual(found, [])

    def test_a_half_empty_page_is_flagged_with_its_band(self):
        coverage = page_gates.scene_coverage(half_empty_page())
        # Text ends at 380 (nine lines from 200), commentary starts at 608.
        self.assertEqual((coverage["internalTop"], coverage["internalBottom"]), (380, 608))
        self.assertAlmostEqual(coverage["internalBand"], 228 / 506, places=2)
        self.assertEqual(coverage["largestEmptyBand"], coverage["internalBand"])
        found = []
        page_gates.gate_scene_void(1, half_empty_page(), found)
        self.assertEqual([f["code"] for f in found], ["SCENE_VOID"])
        self.assertEqual((found[0]["measured"]["from"], found[0]["measured"]["to"]), (380, 608))
        self.assertIn("380-608", found[0]["repair"])

    def test_text_is_measured_by_its_lines_not_its_frame(self):
        # A frame sized for the body holding two lines of text is two lines of ink.
        page = content_page("p", [text("paragraph", 162, 506, lines=2)])
        self.assertAlmostEqual(page_gates.scene_coverage(page)["edgeBand"], (506 - 40) / 506, places=2)

    def test_a_card_is_read_by_what_it_holds(self):
        # The render counts a card surface as occupied; the scene reads its
        # interior, and three cards empty below their paragraph are a hole.
        coverage = page_gates.scene_coverage(empty_cards_page())
        self.assertGreater(coverage["largestEmptyBand"], 0.5)
        found = []
        page_gates.gate_scene_void(1, empty_cards_page(), found)
        self.assertEqual([f["code"] for f in found], ["SCENE_VOID"])

    def test_a_panel_hugging_its_text_is_full(self):
        page = content_page("p", [rect("insight-surface", 162, 506)]
                            + [text("paragraph", y, 40, lines=2) for y in range(178, 640, 46)])
        self.assertLess(page_gates.scene_coverage(page)["largestEmptyBand"], 0.05)

    def test_a_short_trailing_band_is_not_a_hole(self):
        # A complete group that ends a quarter of the body early reads as
        # finished; the same band between two blocks does not.
        trailing = content_page("t", [text("paragraph", 162, 380, lines=19)])
        found = []
        page_gates.gate_scene_void(1, trailing, found)
        self.assertEqual(found, [])
        self.assertGreater(page_gates.scene_coverage(trailing)["edgeBand"], page_gates.SCENE_THRESHOLDS["internal_band_max"])

    def test_a_chart_the_scene_does_not_draw_is_read_by_its_frame(self):
        # A sketched chart (no marks in the scene) cannot be called empty; a
        # chart that carries its marks is read by them.
        page = content_page("p", [text("paragraph", 162, 40, lines=2), text("paragraph", 628, 40, lines=2)])
        page["componentInstances"].append({"id": "p-1", "component": "chart.column",
                                           "frame": {"x": 72, "y": 210, "width": 700, "height": 410}})
        self.assertLess(page_gates.scene_coverage(page)["internalBand"], 0.05)
        page["nodes"].append({"type": "rect", "role": "chart-mark", "frame": {"x": 100, "y": 580, "width": 40, "height": 40}})
        self.assertGreater(page_gates.scene_coverage(page)["internalBand"], 0.5)

    def test_furniture_is_not_the_body(self):
        # A footer line under an empty body does not close the band.
        page = content_page("p", [text("paragraph", 162, 60, lines=3), text("source-text", 660, 12)])
        self.assertGreater(page_gates.scene_coverage(page)["edgeBand"], 0.8)

    def test_scene_void_runs_without_renders_and_skips_structural_pages(self):
        scene = {"slides": [cover(), half_empty_page("a"),
                            {"id": "divider", "componentInstances": [{"id": "d", "component": "section-divider"}],
                             "contentFrame": dict(FRAME), "nodes": []},
                            {"id": "picture-credits", "contentFrame": dict(FRAME), "nodes": []}]}
        report = page_gates.run_gates(scene)
        voids = [f for f in report["findings"] if f["code"] == "SCENE_VOID"]
        self.assertEqual([f["slide"] for f in voids], [2])
        self.assertEqual(voids[0]["severity"], "advisory")
        self.assertNotIn("DECK_SCENE_VOID", report["countsByCode"])


class DeckSceneVoidTests(unittest.TestCase):
    def deck(self, empty, full):
        return {"slides": [cover()] + [half_empty_page(f"e{i}") for i in range(empty)]
                + [full_page(f"f{i}") for i in range(full)]}

    def test_a_third_of_the_deck_half_empty_blocks(self):
        report = page_gates.run_gates(self.deck(5, 9))
        deck = [f for f in report["findings"] if f["code"] == "DECK_SCENE_VOID"]
        self.assertEqual(len(deck), 1)
        self.assertEqual(deck[0]["measured"], 5)
        self.assertEqual(deck[0]["severity"], "blocker")
        self.assertFalse(report["accepted"])

    def test_a_few_half_empty_pages_do_not(self):
        report = page_gates.run_gates(self.deck(4, 10))
        self.assertNotIn("DECK_SCENE_VOID", {f["code"] for f in report["findings"]})

    def test_a_short_deck_does_not(self):
        report = page_gates.run_gates(self.deck(5, 4))
        self.assertNotIn("DECK_SCENE_VOID", {f["code"] for f in report["findings"]})

    def test_only_the_deck_gate_still_counts_the_pages(self):
        report = page_gates.run_gates(self.deck(5, 9), gates={"DECK_SCENE_VOID"})
        self.assertEqual([f["code"] for f in report["findings"]], ["DECK_SCENE_VOID"])

    def test_the_codes_are_registered(self):
        self.assertIn("SCENE_VOID", page_gates.GATE_CODES)
        self.assertIn("DECK_SCENE_VOID", page_gates.GATE_CODES)
        self.assertIn("SCENE_VOID", page_gates.ADVISORY_CODES)
        self.assertNotIn("DECK_SCENE_VOID", page_gates.ADVISORY_CODES)
        self.assertLessEqual({"SCENE_VOID", "DECK_SCENE_VOID"}, page_gates.emitted_codes())


class BudgetTests(unittest.TestCase):
    def scene(self):
        page = content_page("p2", [text("paragraph", 200, 100, words=30), text("source-text", 679, 12, words=10)],
                            readingTask="table-led", planBodyWords=140)
        return {"slides": [cover(), page, half_empty_page("p3")]}

    def test_budget_keys_and_values(self):
        budget = page_gates.page_budget(self.scene())
        self.assertEqual([row["id"] for row in budget], ["p2", "p3"], "the cover carries no budget")
        for row in budget:
            self.assertEqual(set(row), BUDGET_KEYS)
        first = budget[0]
        self.assertEqual(first["slide"], 2)
        self.assertEqual(first["readingTask"], "table-led")
        self.assertEqual(first["body"], 140)
        self.assertEqual(first["floor"], page_gates.READING_TASK_FLOORS["table-led"])
        self.assertEqual(first["ceiling"], page_gates.PROFILES["executive"]["words_exhibit"])
        # The footer share is NOTE_HEAVY's: the band count, not the plan's.
        self.assertEqual(first["footer"], 10)
        self.assertAlmostEqual(first["footerRatio"], 10 / 40, places=3)
        self.assertGreater(budget[1]["largestEmptyBand"], page_gates.SCENE_THRESHOLDS["internal_band_max"])

    def test_the_cli_writes_the_budget(self):
        with tempfile.TemporaryDirectory() as tmp:
            scene_path = Path(tmp) / "scene.json"
            scene_path.write_text(json.dumps(self.scene()), encoding="utf-8")
            out = Path(tmp) / "budget.json"
            run = subprocess.run([sys.executable, str(GATES / "page_gates.py"), str(scene_path), "--budget",
                                  "--report", str(out)], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            budget = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual([set(row) for row in budget], [BUDGET_KEYS, BUDGET_KEYS])
            run = subprocess.run([sys.executable, str(GATES / "page_gates.py"), str(scene_path), "--budget"],
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(json.loads(run.stdout), budget)


if __name__ == "__main__":
    unittest.main()
