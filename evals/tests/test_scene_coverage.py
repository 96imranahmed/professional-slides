"""The page gates' scene-level measures: one body-word counter, and how full a
page's body is before anything is rendered.

* One counter. The authoring compiler writes each composed page's body words
  on the scene as `planBodyWords`, counted as the text contract counts its
  plan. THIN_PAGE and the density report read that number when it is there,
  so authoring and the build cannot disagree about whether a page is thin;
  scenes without it keep the band count.
* SCENE_VOID. The render's INTERNAL_VOID and DEAD_BAND - one definition, one
  pair of thresholds - read off the rows the scene will draw: text by its
  glyph lines, a fill where it shows against the canvas, and a card by what it
  holds. The render's band gates only run at the build; this runs at
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
               "footerRatio", "internalVoid", "deadBand", "void"}


def bands(slide):
    return page_gates.void_bands(page_gates.scene_rows(slide))


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
        self.assertLess(bands(full_page())["internalVoid"], 0.05)
        found = []
        page_gates.gate_scene_void(1, full_page(), found)
        self.assertEqual(found, [])

    def test_a_half_empty_page_is_flagged_with_its_band(self):
        # Text ends at 380 (nine lines from 200), commentary starts at 608.
        found = []
        page_gates.gate_scene_void(1, half_empty_page(), found)
        self.assertEqual([f["code"] for f in found], ["SCENE_VOID"])
        # The gate reads glyphs, not line boxes: the band runs from the ninth
        # line's ink to the commentary's, a few pixels inside the frames.
        top, bottom = found[0]["measured"]["from"], found[0]["measured"]["to"]
        self.assertTrue(372 <= top <= 380 and 608 <= bottom <= 616, (top, bottom))
        self.assertEqual(found[0]["threshold"], page_gates.THRESHOLDS["internal_void_max"])
        self.assertIn(f"{top}-{bottom}", found[0]["repair"])

    def test_text_is_measured_by_its_lines_not_its_frame(self):
        # A frame sized for the body holding two lines of text is two lines of ink.
        page = content_page("p", [text("paragraph", 162, 506, lines=2)])
        self.assertGreater(bands(page)["deadBand"], 0.5)

    def test_a_card_is_read_by_what_it_holds(self):
        # The render counts a card surface as occupied; the scene reads its
        # interior, and three cards empty below their paragraph are a hole.
        found = []
        page_gates.gate_scene_void(1, empty_cards_page(), found)
        self.assertEqual([f["code"] for f in found], ["SCENE_VOID"])

    def test_a_panel_hugging_its_text_is_full(self):
        page = content_page("p", [rect("insight-surface", 162, 506)]
                            + [text("paragraph", y, 40, lines=2) for y in range(178, 640, 46)])
        self.assertLess(bands(page)["internalVoid"], page_gates.THRESHOLDS["internal_void_max"])

    def test_a_trailing_band_is_read_as_the_render_reads_it(self):
        # The render's DEAD_BAND bar, not a looser one of the scene's own: a
        # group that stops a line or two short of the footer passes, one that
        # leaves a quarter of the body under it is the band the build reports.
        for lines, flagged in ((23, False), (19, True)):
            trailing = content_page("t", [text("paragraph", 162, 20 * lines, lines=lines)])
            found = []
            page_gates.gate_scene_void(1, trailing, found)
            self.assertEqual(bool(found), flagged, lines)
            if flagged:
                self.assertEqual(found[0]["threshold"], page_gates.THRESHOLDS["dead_band_max"])
                self.assertEqual(found[0]["measured"]["to"], page_gates.FOOTER_TOP)

    def test_a_chart_the_scene_does_not_draw_is_read_by_its_frame(self):
        # A sketched chart (no marks in the scene) cannot be called empty; a
        # chart that carries its marks is read by them.
        page = content_page("p", [text("paragraph", 162, 40, lines=2), text("paragraph", 628, 40, lines=2)])
        page["componentInstances"].append({"id": "p-1", "component": "chart.column",
                                           "frame": {"x": 72, "y": 210, "width": 700, "height": 410}})
        self.assertLess(bands(page)["internalVoid"], 0.05)
        page["nodes"].append({"type": "rect", "role": "chart-mark", "frame": {"x": 100, "y": 580, "width": 40, "height": 40},
                              "style": {"fill": {"value": "#333333"}}})
        self.assertGreater(bands(page)["internalVoid"], 0.45)

    def test_furniture_is_not_the_body(self):
        # A footer line under an empty body does not close the band.
        page = content_page("p", [text("paragraph", 162, 60, lines=3), text("source-text", 660, 12)])
        self.assertGreater(bands(page)["deadBand"], 0.5)

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


CANVAS = "#FAF7F2"   # a cream page
TINT = "#F0EBE3"     # a tile on it, darker by more than the render's margin


def styled(node, **style):
    node["style"] = {**node.get("style", {}), **style}
    return node


def cream_page(ident, nodes):
    page = content_page(ident, nodes)
    page["nodes"][0] = text("action-title", 58, 80, words=8, lines=2)  # a two-line title, to y 138
    page["tokens"] = {"color.canvas": {"value": CANVAS}}
    return page


def tiles_page(ident="tiles", top=291):
    """Emirates p11: four number tiles, each a value and a short label at the top
    of a tall tinted box, floating mid-page beside three short points."""
    nodes = []
    for column in range(4):
        x = 72 + column * 191
        nodes.append(styled(rect("fact-tile", top, 259, x=x, width=175), fill={"value": TINT}))
        nodes.append(text("fact-value", top + 16, 44, x=x + 16, width=143, lines=1))
        nodes.append(text("fact-label", top + 64, 60, x=x + 16, width=143, lines=3))
    for index, y in enumerate((249, 369, 509)):
        nodes.append(text("list-item", y, 80 if index == 1 else 60, x=835, width=373, lines=4 if index == 1 else 3))
    return cream_page(ident, nodes)


class SceneMatchesRenderTests(unittest.TestCase):
    """SCENE_VOID is the render's INTERNAL_VOID and DEAD_BAND, drawn from the scene."""

    def pixel_codes(self, rows):
        found = []
        page_gates.gate_ink_and_dead_band(2, rows, found, rows)
        return {f["code"] for f in found} & {"INTERNAL_VOID", "DEAD_BAND"}

    def test_one_definition_serves_both(self):
        # The pixel gates, handed the rows the scene draws, report the band
        # SCENE_VOID reports, at the same bar.
        for page in (tiles_page(), full_page(), half_empty_page(), cream_page("c", [text("paragraph", 162, 480, lines=24)])):
            rows = page_gates.scene_rows(page)
            bands = page_gates.void_bands(rows)
            found = []
            page_gates.gate_scene_void(2, page, found)
            codes = self.pixel_codes(rows)
            self.assertEqual(bool(found), bool(codes), page["id"])
            if found:
                self.assertAlmostEqual(found[0]["measured"]["internalVoid"], round(bands["internalVoid"], 4))
                self.assertAlmostEqual(found[0]["measured"]["deadBand"], round(bands["deadBand"], 4))

    def test_void_bands_reads_rows_as_the_render_did(self):
        rows = [0] * page_gates.FOOTER_TOP
        for y in list(range(40, 138)) + list(range(260, 580)):
            rows[y] = 100
        rows[400] = page_gates.ROW_MIN  # a hairline crossing a band does not fill it
        bands = page_gates.void_bands(rows)
        self.assertEqual((bands["voidTop"], bands["voidBottom"]), (page_gates.VOID_TOP, 260))
        self.assertAlmostEqual(bands["internalVoid"], 120 / page_gates.CANVAS_H)
        self.assertEqual(bands["lastInk"], 579)
        self.assertAlmostEqual(bands["deadBand"], 80 / page_gates.CANVAS_H)

    def test_number_tiles_floating_mid_page_are_flagged(self):
        # The old frame measure passed this page and the build flagged it: the
        # air under the title is a hole, and so is the band under the points.
        found = []
        page_gates.gate_scene_void(2, tiles_page(), found)
        self.assertEqual([f["code"] for f in found], ["SCENE_VOID"])
        measured = found[0]["measured"]
        self.assertEqual(measured["from"], page_gates.VOID_TOP)
        self.assertGreater(measured["internalVoid"], page_gates.THRESHOLDS["internal_void_max"])
        self.assertGreater(measured["deadBand"], page_gates.THRESHOLDS["dead_band_max"])
        # The same tiles started under the title leave no hole there.
        self.assertLess(page_gates.void_bands(page_gates.scene_rows(tiles_page(top=170)))["internalVoid"],
                        page_gates.THRESHOLDS["internal_void_max"])

    def test_a_fill_counts_where_it_shows_against_the_canvas(self):
        # A band drawn in the canvas colour, or in white on a cream page, is
        # air in the render; a tinted one is surface.
        def page(fill):
            band = styled(rect("band", 300, 300), fill={"value": fill})
            return cream_page("b", [text("paragraph", 162, 60, lines=3), band, text("paragraph", 610, 40, lines=2)])
        for fill, flagged in ((CANVAS, True), ("#FFFFFF", True), (TINT, False), ("#221E1A", False)):
            found = []
            page_gates.gate_scene_void(2, page(fill), found)
            self.assertEqual(bool(found), flagged, fill)
        # An outline shows by its edges: three bordered boxes put six pixels
        # on every row they cross, which fills the row, as in the render.
        boxes = [styled(rect("frame", 240, 380, x=72 + i * 384, width=368), fill="none",
                        stroke={"value": "#8A8178"}, lineWidth={"value": 1}) for i in range(3)]
        rows = page_gates.scene_rows(cream_page("o", [text("paragraph", 162, 40, lines=2)] + boxes))
        self.assertEqual(rows[400], 6)
        self.assertEqual(rows[240], 3 * 368)

    def test_a_tinted_card_is_read_by_what_it_holds(self):
        # The render sees a tinted card as surface to its foot; the scene reads
        # it to the depth of its paragraph, so three cards empty below their
        # copy over a pinned takeaway are the hole they look like.
        nodes = []
        for column in range(3):
            x = 72 + column * 384
            nodes.append(styled(rect("card-surface", 162, 420, x=x, width=368), fill={"value": TINT}))
            nodes.append(text("card-text", 180, 100, x=x + 16, width=336, lines=5))
        nodes.append(text("takeaway", 600, 40, lines=2))
        found = []
        page_gates.gate_scene_void(2, cream_page("cards", nodes), found)
        self.assertEqual([f["code"] for f in found], ["SCENE_VOID"])
        self.assertGreater(found[0]["measured"]["internalVoid"], page_gates.THRESHOLDS["internal_void_max"])
        # Copy that fills its card fills the rows.
        nodes = [n for n in nodes if n["role"] != "card-text"]
        for column in range(3):
            nodes.append(text("card-text", 180, 400, x=72 + column * 384 + 16, width=336, lines=20))
        found = []
        page_gates.gate_scene_void(2, cream_page("cards", nodes), found)
        self.assertEqual(found, [])

    def test_an_arc_holding_its_labels_is_a_mark(self):
        # A radial bar's rings carry their labels inside their bounds; only a
        # box is a container, so the ring is drawn whole.
        ring = {"type": "shape", "role": "radial-arc", "frame": {"x": 206, "y": 164, "width": 472, "height": 472},
                "style": {"fill": {"value": "#16814B"}}}
        page = cream_page("r", [ring, text("radial-label", 172, 16, x=253, width=131, lines=1)])
        self.assertLess(page_gates.void_bands(page_gates.scene_rows(page))["deadBand"], page_gates.THRESHOLDS["dead_band_max"])

    def test_a_dark_page_reads_light_ink(self):
        surface = styled(rect("takeaways-surface", 0, 720, x=0, width=1280), fill={"value": "#221E1A"})
        words = styled(text("takeaways-item", 162, 480, lines=24), color={"value": "#FFFFFF"})
        rows = page_gates.scene_rows(cream_page("d", [surface, words]))
        self.assertGreater(rows[290], page_gates.ROW_MIN)
        self.assertLessEqual(rows[150], page_gates.ROW_MIN, "the surface itself is the page, not ink")


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
        self.assertEqual(first["ceiling"], page_gates.PROFILES["executive"]["words_exhibit"])  # no wordCeiling on the scene
        # The footer share is NOTE_HEAVY's: the band count, not the plan's.
        self.assertEqual(first["footer"], 10)
        self.assertAlmostEqual(first["footerRatio"], 10 / 40, places=3)
        self.assertTrue(budget[1]["void"])  # the page SCENE_VOID names
        self.assertFalse(budget[0]["void"] and budget[0]["internalVoid"] > page_gates.THRESHOLDS["internal_void_max"])

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
