"""The page gates' scene-level measures: how full a page's body is before
anything is rendered, read off the rows the scene will draw: text by its glyph
lines, a fill where it shows against the canvas, and a card by what it holds.
No gate reports the band any more (how full a page reads is the layout
engine's to weigh); the render's drift check compares it with the render's.
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


def half_empty_page(ident="half"):
    """A roadmap's phases at the top, commentary pinned to the foot, nothing between."""
    return content_page(ident, [
        rect("roadmap-phase", 162, 30),
        text("paragraph", 200, 180, lines=9),
        text("paragraph", 608, 60, lines=3),
    ])


class SceneVoidTests(unittest.TestCase):
    def test_text_is_measured_by_its_lines_not_its_frame(self):
        # A frame sized for the body holding two lines of text is two lines of ink.
        page = content_page("p", [text("paragraph", 162, 506, lines=2)])
        self.assertGreater(bands(page)["deadBand"], 0.5)

    def test_a_panel_hugging_its_text_is_full(self):
        page = content_page("p", [rect("insight-surface", 162, 506)]
                            + [text("paragraph", y, 40, lines=2) for y in range(178, 640, 46)])
        self.assertLess(bands(page)["internalVoid"], page_gates.THRESHOLDS["internal_void_max"])

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
    """The scene's bands are measured as the render's are: one definition (void_bands) over either's rows."""

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


if __name__ == "__main__":
    unittest.main()
