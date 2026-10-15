"""The page gates' scene-level measures: how full a page's body is before
anything is rendered (SCENE_VOID, advised), read off the rows the scene will
draw: text by its glyph lines, a fill where it shows against the canvas, and a
card by what it holds.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"

sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402

FRAME = {"x": 72, "y": 162, "width": 1136, "height": 506}
BUDGET_KEYS = {"slide", "id", "readingTask", "body", "floor", "ceiling", "footer",
               "footerRatio", "internalVoid", "deadBand", "void", "columnVoid", "line", "columns", "blocks"}


def bands(slide):
    return page_gates.scene_void(slide)[0]


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
    """Rows of text from the top of the body to its foot: a page the build's
    DECK_THIN_PAGES would pass too - its exhibit the body, its words over the floor."""
    page = content_page(ident, [text("paragraph", y, 40, lines=2) for y in range(162, 668, 46)], planBodyWords=200)
    page["componentInstances"][1]["frame"] = dict(FRAME)
    return page


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
        # Half the body empty is advised, never refused: an empty band is the author's to judge.
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

class DeckSceneVoidTests(unittest.TestCase):
    def deck(self, empty, full):
        return {"slides": [cover()] + [half_empty_page(f"e{i}") for i in range(empty)]
                + [full_page(f"f{i}") for i in range(full)]}

    def test_the_build_refuses_one_habit_once(self):
        # The build runs the gates on the scene before the render and again
        # after it. Both counts blocked, so one half-empty habit was listed
        # twice; with a render the render's count stands alone.
        result = run_node('''
import { buildOutcome } from './skills/professional-slides/runtime/build-deck.mjs';
const habit = (code) => ({ passed: false, findings: [{ code, severity: 'blocker', slide: null }] });
const rendered = buildOutcome({ preflight: habit('DECK_SCENE_VOID'), gates: habit('DECK_THIN_PAGES'), readback: { accepted: true } }, { render: true });
const scene = buildOutcome({ preflight: habit('DECK_SCENE_VOID'), readback: { accepted: true } }, { render: false });
console.log(JSON.stringify({ rendered: rendered.blockers.map((b) => b.code), scene: scene.blockers.map((b) => b.code) }));
''')
        self.assertEqual(result["rendered"], ["DECK_THIN_PAGES"])
        self.assertEqual(result["scene"], ["DECK_SCENE_VOID"])

    def test_a_few_half_empty_pages_do_not(self):
        report = page_gates.run_gates(self.deck(4, 10))
        self.assertNotIn("DECK_SCENE_VOID", {f["code"] for f in report["findings"]})

    def test_a_short_deck_does_not(self):
        report = page_gates.run_gates(self.deck(5, 4))
        self.assertNotIn("DECK_SCENE_VOID", {f["code"] for f in report["findings"]})

    def test_a_void_page_advises_and_a_deck_of_them_blocks(self):
        # Registration and documentation are held for every gate code at once
        # (test_weight_contract.GateVocabularyTests); this is the severity.
        self.assertIn("SCENE_VOID", page_gates.ADVISORY_CODES)
        self.assertNotIn("DECK_SCENE_VOID", page_gates.ADVISORY_CODES)


def instance(ident, component, x, y, width, height):
    return {"id": ident, "component": component, "frame": {"x": x, "y": y, "width": width, "height": height}}


def two_panel_page(ident="float", left_nodes=None, right_nodes=None, left="chart.waffle", right="chart.bar",
                   row_bottom=592):
    """Emirates p39's shape: two panels side by side, each headed, over a row of
    captions. The right panel is full; the left is whatever it is given."""
    height = row_bottom - 162
    nodes = []
    for x in (72, 648):
        nodes.append(text("section-heading", 162, 24, x=x, width=560, lines=1))
    nodes += left_nodes or []
    nodes += right_nodes if right_nodes is not None else [
        text("category-label", y, 60, x=656, width=540, lines=3) for y in range(210, row_bottom - 50, 66)]
    for x in (72, 648):
        nodes.append(text("insight-body", 616, 40, x=x + 16, width=528, lines=2))
    page = content_page(ident, nodes)
    page["componentInstances"] = [
        {"id": "chrome", "component": "slide-chrome", "frame": {"x": 0, "y": 0, "width": 1280, "height": 720}},
        instance(f"{ident}-a", left, 72, 162, 560, height), instance(f"{ident}-b", right, 648, 162, 560, height),
        instance(f"{ident}-c", "insight", 72, 604, 560, 64), instance(f"{ident}-d", "insight", 648, 604, 560, 64)]
    return page


def floating_waffle(ident="float"):
    """Two rows of dots and their labels in the middle of a 430px plot."""
    return two_panel_page(ident, left_nodes=[
        text("data-label", 360, 24, x=72, width=500, lines=1),
        styled(rect("chart-mark", 388, 52, x=84, width=400), fill={"value": "#333333"}),
        text("category-label", 452, 16, x=78, width=500, lines=1)])


def short_table_page(ident="table", rows=4):
    """Emirates p11: a number and three points down the left third, a table of
    a few rows in the right two thirds stopping well above the footer."""
    nodes = [text("metric-value", 190, 60, x=72, width=373, lines=1),
             text("metric-label", 255, 40, x=72, width=373, lines=2)]
    nodes += [text("list-item", y, 80, x=72, width=373, lines=4) for y in (356, 452, 548)]
    nodes.append(rect("table-header", 174, 44, x=461, width=747))
    nodes += [text("table-cell-text", 230 + r * 72, 20, x=473, width=700, lines=1) for r in range(rows)]
    page = content_page(ident, nodes)
    page["componentInstances"] = [
        {"id": "chrome", "component": "slide-chrome", "frame": {"x": 0, "y": 0, "width": 1280, "height": 720}},
        instance(f"{ident}-t", "table", 461, 174, 747, 494), instance(f"{ident}-m", "metric", 72, 190, 373, 150),
        instance(f"{ident}-l", "bullet-list", 72, 356, 373, 296)]
    for node in page["nodes"]:
        if node["role"] == "table-header":
            node["style"] = {"fill": {"value": "#221E1A"}}
    return page


class ColumnVoidTests(unittest.TestCase):
    """The band gates read whole rows, so a half-empty column was invisible
    while its neighbour was full. void_bands is now asked of each column too."""

    def test_columns_come_from_the_composers_regions(self):
        columns = page_gates.page_columns(floating_waffle())
        # The two panels split; the caption row under them is a strip, not a row of columns.
        self.assertEqual([(c["name"], c["x0"], c["x1"], c["top"], c["bottom"]) for c in columns],
                         [("left", 72, 632, 162, 592), ("right", 648, 1208, 162, 592)])
        table = page_gates.page_columns(short_table_page())
        self.assertEqual([(c["name"], c["x0"], c["x1"]) for c in table], [("left", 72, 445), ("right", 461, 1208)])
        # A page of one full-width exhibit has no columns; one without frames neither.
        self.assertEqual(page_gates.page_columns(half_empty_page()), [])
        wide = content_page("w", [])
        wide["componentInstances"].append(instance("w-1", "chart.column", 72, 162, 1136, 506))
        self.assertEqual(page_gates.page_columns(wide), [])

    def test_a_short_table_beside_a_full_column_is_named(self):
        found = []
        page_gates.gate_scene_void(2, short_table_page(), found)
        self.assertEqual([f["code"] for f in found], ["SCENE_VOID"])
        self.assertEqual(found[0]["measured"]["column"], "right")
        self.assertEqual(found[0]["threshold"], page_gates.THRESHOLDS["column_void_max"])
        self.assertEqual(found[0]["measured"]["to"], page_gates.FOOTER_TOP)

    def test_a_column_ending_a_little_short_passes(self):
        # A side column is allowed the tail a well-made page's right column
        # shows (column_void_max, a fifth of its height), not the page's
        # dead-band bar: six rows reach close enough to the foot.
        found = []
        page_gates.gate_scene_void(2, short_table_page(rows=6), found)
        self.assertEqual(found, [])
        # The same waffle grown to fill its plot passes.
        grown = two_panel_page("grown", left_nodes=[
            text("data-label", 200, 24, x=72, width=500, lines=1),
            styled(rect("chart-mark", 228, 280, x=84, width=400), fill={"value": "#333333"}),
            text("category-label", 520, 16, x=78, width=500, lines=1)])
        found = []
        page_gates.gate_scene_void(2, grown, found)
        self.assertEqual(found, [])

    def test_points_centred_beside_a_full_table_are_no_hole(self):
        """Spacebar timed run: two points centred beside a taller table were told to sit at the top of their column,
        which no page key does - the composer centres a column that does not fill its section, as the house asks."""
        def page(blocks):
            nodes = [text("table-cell-text", y, 20, x=84, width=700, lines=1) for y in range(170, 660, 48)]
            nodes += [text("list-item", y, 60, x=816, width=392, lines=3) for y in blocks]
            beside = content_page("beside", nodes)
            beside["componentInstances"] = [
                {"id": "chrome", "component": "slide-chrome", "frame": {"x": 0, "y": 0, "width": 1280, "height": 720}},
                instance("beside-t", "table", 72, 162, 728, 506), instance("beside-l", "bullet-list", 816, 162, 392, 506)]
            found = []
            page_gates.gate_scene_void(2, beside, found)
            return found
        self.assertEqual(page([345, 425]), [])
        # A gap inside the group is still a hole, and the repair names only what a page key does.
        found = page([262, 522])
        self.assertEqual([(f["code"], f["measured"]["column"]) for f in found], [("SCENE_VOID", "right")])
        self.assertGreater(found[0]["measured"]["from"], 262, "the band is the gap between the points, not their margin")
        self.assertNotIn("at the top", found[0]["repair"])
        self.assertIn('commentary: "below"', found[0]["repair"])

    def test_one_page_one_finding(self):
        # A page whose rows already fail is named by the page's band, once; the
        # columns are only asked when the page passes.
        page = half_empty_page()
        page["componentInstances"] += [instance("h-1", "table", 72, 162, 560, 506), instance("h-2", "table", 648, 162, 560, 506)]
        found = []
        page_gates.gate_scene_void(2, page, found)
        self.assertEqual(len(found), 1)
        self.assertNotIn("column", found[0]["measured"])

class HairlineTests(unittest.TestCase):
    """A hairline across a gap - a subsection rule, a divider - does not split
    the gap into two voids each under the bar, as ROW_MIN keeps a vertical
    rule from filling a row."""

    @staticmethod
    def rows(*marks):
        rows = [0] * page_gates.CANVAS_H
        for top, bottom, width in marks:
            rows[top:bottom] = [width] * (bottom - top)
        return rows

    def test_a_short_rule_in_a_gap_leaves_one_void(self):
        # Content to 329, a 16px rule on row 418, content again from 507: read
        # as content the rule leaves two halves of 89 and 88 rows, both under
        # internal_void_max; the gap is one band of 178, past the blocking bar.
        rows = self.rows((150, 329, 900), (418, 419, 16), (507, 640, 900))
        found = page_gates.void_bands(rows)
        self.assertEqual((found["voidTop"], found["voidBottom"]), (329, 507))
        self.assertGreater(found["internalVoid"], page_gates.THRESHOLDS["internal_void_max"])
        self.assertEqual(page_gates.filled_rows(rows)[418], False)

    def test_two_rows_are_a_hairline_and_three_are_content(self):
        two = page_gates.void_bands(self.rows((150, 329, 900), (418, 420, 900), (507, 640, 900)))
        three = page_gates.void_bands(self.rows((150, 329, 900), (418, 421, 900), (507, 640, 900)))
        self.assertEqual((two["voidTop"], two["voidBottom"]), (329, 507))
        self.assertEqual((three["voidTop"], three["voidBottom"]), (329, 418))

    def test_a_rule_touching_content_is_part_of_it(self):
        # A rule set directly under a block, with no empty row between, closes
        # the block rather than standing in the gap.
        found = page_gates.void_bands(self.rows((150, 329, 900), (329, 330, 16), (507, 640, 900)))
        self.assertEqual((found["voidTop"], found["voidBottom"]), (330, 507))

    def test_the_last_thing_drawn_still_ends_the_content(self):
        # A box's bottom edge under its text is where the page's content stops:
        # the trailing band starts under the edge, not under the text.
        found = page_gates.void_bands(self.rows((150, 560, 900), (579, 580, 1160)))
        self.assertEqual(found["lastInk"], 579)
        self.assertAlmostEqual(found["deadBand"], (page_gates.FOOTER_TOP - 1 - 579) / page_gates.CANVAS_H)
        self.assertEqual((found["voidTop"], found["voidBottom"]), (560, 579))

    def test_the_scene_reads_a_rule_in_a_gap_as_the_gap(self):
        rule = {"type": "line", "role": "section-rule", "frame": {"x": 72, "y": 418, "width": 16, "height": 0},
                "style": {"stroke": "#333333", "lineWidth": 1}}
        page = content_page("rule", [text("paragraph", 162, 160, lines=8), rule, text("paragraph", 507, 140, lines=7)])
        found = []
        page_gates.gate_scene_void(1, page, found)
        self.assertEqual([f["measured"]["kind"] for f in found], ["internal"])
        self.assertGreater(found[0]["measured"]["band"], page_gates.THRESHOLDS["internal_void_max"])


if __name__ == "__main__":
    unittest.main()
