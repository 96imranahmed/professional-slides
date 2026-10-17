"""How much ink a page will carry, estimated from the composed scene.

The rendered measure of a page's visual weight - the share of its body that
reads darker than the page at a glance - only exists once the deck is built,
and the build is the most expensive place to learn that a table drawn as text
on the page colour, a lone thin line across an empty plot or white cards on a
cream page leave the page light. The scene carries everything the render will
draw, so the same number can be estimated while the author can still choose a
filled table header, a tinted card or a second exhibit.

The estimate repeats the rendered measure in miniature. The page is painted
onto a grid of the size that measure reads (200 px across, where a line of body
type is a two-pixel smear and a hairline disappears), each node by the area it
covers in each cell and the grey it paints: a fill as drawn (a disc, a sector,
a chevron or a polygon by its outline), a rule or an outline by its stroke
along its length, a picture whole, and a line of type as a band across the
glyphs' height and the line's measured width, painted at `TEXT_COVERAGE` of
its colour on average - unevenly across its cells (`GLYPH_SPREAD`), since a
stroke lands in one cell and misses the next. A cell counts as ink when its
grey sits more than `INK_DELTA` levels from the page's median grey, as the
rendered measure counts it; the estimate is the share of body cells that do.

Five numbers are fitted, by grid search against the rendered measure:
`TEXT_COVERAGE`, `BOLD_WEIGHT`, `GLYPH_SPREAD`, `HAIRLINE_WEIGHT` (a one-pixel
rule, which the render antialiases to a pale line) and `NATIVE_WEIGHT` (the
plot of a chart exported as a native chart object, which the renderer draws
lighter than the scene). A line of type painted evenly would flip whole
across the threshold as a band of grey type on a tint, so the spread and the
two weights are fitted too. Fitted on 227 content pages of eight built decks
and checked on the worked example, which the fit did not see
(evaluation/index.md#ink-estimate records both). Everything else is
geometry the scene already states.

Nothing here needs Pillow or numpy: the grid is 22,600 cells. What the scene
says about colour - a style colour, its grey on the render, the page's canvas,
where a line's glyphs sit - is read here once and imported by scene_gates.py,
whose scene mask draws the same page for the void gates.
"""
from __future__ import annotations

import ast
import math
import re
from pathlib import Path

from ink import CANVAS_W, CANVAS_H

# Where a line's ink sits in the face centred on its line: from about the cap
# height to the descenders. Fitted on 213 rendered pages of five decks, it puts
# the scene's last row of ink within two pixels of the PNG's on average.
GLYPH_BAND = (0.15, 0.9)


def chart_plot_roles():
    """The roles a native chart object replaces: the emitter's CHART_PLOT_ROLES,
    read from its source because importing it would need python-pptx. A copy
    of the list here lost eleven of its roles as the emitter grew."""
    source = (Path(__file__).resolve().parent.parent / "emit" / "emit_pptx.py").read_text(encoding="utf-8")
    assignment = next(node for node in ast.parse(source).body if isinstance(node, ast.Assign)
                      and any(getattr(target, "id", None) == "CHART_PLOT_ROLES" for target in node.targets))
    return frozenset(ast.literal_eval(assignment.value))


# The native plot, drawn lighter by the renderer (NATIVE_WEIGHT). Of the roles
# the copy had lost, only a donut's hole occurs inside a native chart; lightened
# with the rest of the plot it moved the estimate 0.01-0.03 toward the render
# on each of the seven donut pages of 1,836 built pages, and on the 184
# native-chart pages with a render the best NATIVE_WEIGHT stayed 0.8
# (evaluation/index.md#ink-estimate).
NATIVE_PLOT_ROLES = chart_plot_roles()
SHAPE_TYPES = {"rect", "ellipse", "shape", "wedge"}


def color_of(value):
    """A style colour as #RRGGBB, or None for none, transparent or a gradient."""
    if isinstance(value, dict):
        value = value.get("value")
    if not isinstance(value, str) or not re.match(r"^#[0-9a-fA-F]{6}$", value.strip()):
        return None
    return value.strip()


def grey_of(color):
    """The luminance Pillow's "L" conversion gives the colour on the render."""
    r, g, b = (int(color[i:i + 2], 16) for i in (1, 3, 5))
    return r * 299 / 1000 + g * 587 / 1000 + b * 114 / 1000


def _number(value, default=0.0):
    if isinstance(value, dict):
        value = value.get("value")
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else default


def canvas_of(slide):
    """The page's background: its canvas token, or a surface drawn over the
    whole canvas, as the render's commonest grey would say."""
    canvas = color_of((slide.get("tokens") or {}).get("color.canvas")) or "#FFFFFF"
    for node in slide.get("nodes", []):
        frame, fill = node.get("frame") or {}, color_of((node.get("style") or {}).get("fill"))
        if node.get("type") in SHAPE_TYPES and fill and _number(frame.get("width")) >= CANVAS_W and _number(frame.get("height")) >= CANVAS_H:
            canvas = fill
    return canvas


def _holds(node, x, y):
    """Whether the point (x, y) falls on what `node` paints: its box, the disc
    of an ellipse, the sector of a wedge (angles in degrees, clockwise from
    three o'clock, as the scene draws them)."""
    frame = node.get("frame") or {}
    left, top = _number(frame.get("x")), _number(frame.get("y"))
    width, height = _number(frame.get("width")), _number(frame.get("height"))
    if not (left <= x <= left + width and top <= y <= top + height):
        return False
    if node.get("type") in ("ellipse", "wedge") and width > 0 and height > 0:
        dx, dy = (x - left - width / 2) / (width / 2), (y - top - height / 2) / (height / 2)
        if dx * dx + dy * dy > 1:
            return False
        data = node.get("data") or {}
        start, end = data.get("startAngle"), data.get("endAngle")
        if node.get("type") == "wedge" and isinstance(start, (int, float)) and isinstance(end, (int, float)) and end - start < 360:
            return (math.degrees(math.atan2(dy, dx)) - start) % 360 <= (end - start) % 360
    return True


def ground_at(nodes, index, x, y, canvas):
    """The colour under the point (x, y) of what `nodes[index]` is drawn on:
    the topmost filled shape drawn before it that covers the point, else the
    page's canvas. None over a picture, whose colour the scene does not know."""
    for node in reversed(nodes[:index]):
        if not node.get("frame") or not _holds(node, x, y):
            continue
        if node.get("type") == "image":
            return None
        if node.get("type") in SHAPE_TYPES:
            style = node.get("style") or {}
            fill, opacity = color_of(style.get("fill")), _number(style.get("opacity"), 1.0)
            if fill and opacity >= 0.99:
                return fill
    return canvas


def dark_ground(slide):
    """Whether the page is set on a dark ground: its own canvas token is dark,
    as on a page whose `tone` is dark or primary (core.mjs groundOf). The render's
    marks are then lighter than the page (ink.marked). A light page that paints
    a navy panel over the whole of itself - a divider, a dark cover - keeps its
    light canvas and is read as it always was."""
    canvas = color_of((slide.get("tokens") or {}).get("color.canvas"))
    return bool(canvas) and grey_of(canvas) < 128


