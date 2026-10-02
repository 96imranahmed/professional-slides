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

GRID_W = 200                                # the rendered measure's width
GRID_H = 113                                # 720 * 200 / 1280, rounded as the renderer rounds it
SCALE = GRID_W / CANVAS_W
BODY = (0.15, 0.92)                         # the body band the rendered measure reads
INK_DELTA = 25                              # grey levels from the page's median that count
# Where a line's ink sits in the face centred on its line: from about the cap
# height to the descenders. Fitted on 213 rendered pages of five decks, it puts
# the scene's last row of ink within two pixels of the PNG's on average.
GLYPH_BAND = (0.15, 0.9)
TEXT_COVERAGE = 0.29                        # fitted: see the module docstring
BOLD_WEIGHT = 1.2                           # fitted: a bold stroke against a regular one
GLYPH_SPREAD = 0.9                          # fitted: how unevenly a line's strokes fall across cells
HAIRLINE_WEIGHT = 0.5                       # fitted: a one-pixel rule as the render antialiases it
NATIVE_WEIGHT = 0.8                         # fitted: a native chart's plot as the renderer draws it


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
# Four cells of a line's band take four shares of its coverage, from one that
# a stroke fills to one it all but misses, so higher contrast lights more of
# the band: white type on a dark page reads almost whole, grey type on a tint
# reads in patches, as the render reads them.
GLYPH_STEPS = ((1.0, -1 / 3), (1 / 3, -1.0))
SHAPE_TYPES = {"rect", "ellipse", "shape", "wedge"}
# A shape with no outline to fill covers part of its box, spread evenly: map
# land drawn without its paths a little under half (coasts, seas between), an
# icon glyph a fifth. Discs, sectors, chevrons and polygons are filled as drawn.
SHAPE_SHARE = ((re.compile(r"^map-"), 0.45), (re.compile(r"glyph"), 0.2))


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


class _Grid:
    def __init__(self, background):
        self.cells = [[background] * GRID_W for _ in range(GRID_H)]

    def paint(self, x, y, w, h, grey, alpha=1.0, spread=0.0):
        """Paint the canvas box (x, y, w, h) in `grey`, each cell by the share of
        it the box covers times `alpha`: a hairline covers a sixth of a cell and
        barely moves it, as it barely moves the render.

        A line of type passes `spread`: the cells of each two-by-two block take
        `alpha` stepped by GLYPH_STEPS times it, so the band averages `alpha`
        while some of its cells cross the ink threshold and some do not, as the
        render's cells do where a stroke lands in one and misses the next.
        Painted evenly, a band flipped whole: grey type on a tint just under the
        threshold counted none of its cells (a fact grid estimated at 2% that
        rendered at 10%), and just over it all of them."""
        if w <= 0 or h <= 0 or alpha <= 0:
            return
        gx0, gx1 = x * SCALE, (x + w) * SCALE
        gy0, gy1 = y * SCALE, (y + h) * SCALE
        for row in range(max(0, int(gy0)), min(GRID_H, int(math.ceil(gy1)))):
            cy = min(gy1, row + 1) - max(gy0, row)
            if cy <= 0:
                continue
            line = self.cells[row]
            for col in range(max(0, int(gx0)), min(GRID_W, int(math.ceil(gx1)))):
                cx = min(gx1, col + 1) - max(gx0, col)
                if cx <= 0:
                    continue
                share = alpha * (1 + GLYPH_STEPS[row % 2][col % 2] * spread) if spread else alpha
                cover = min(1.0, cx * cy * share)
                line[col] += (grey - line[col]) * cover

    def stroke(self, x1, y1, x2, y2, width, grey, alpha=1.0):
        """A rule of `width` from (x1, y1) to (x2, y2), walked a canvas cell's
        worth at a time across its longer extent."""
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy)
        if length < 0.5:
            self.paint(x1 - width / 2, y1 - width / 2, width, width, grey, alpha)
            return
        if abs(dx) >= abs(dy):
            thick = width * length / abs(dx) if dx else width
            steps = max(1, int(math.ceil(abs(dx) * SCALE)))
            for i in range(steps):
                a, b = i / steps, (i + 1) / steps
                xa, xb = x1 + dx * a, x1 + dx * b
                yc = y1 + dy * (a + b) / 2
                self.paint(min(xa, xb), yc - thick / 2, abs(xb - xa), thick, grey, alpha)
        else:
            thick = width * length / abs(dy)
            steps = max(1, int(math.ceil(abs(dy) * SCALE)))
            for i in range(steps):
                a, b = i / steps, (i + 1) / steps
                ya, yb = y1 + dy * a, y1 + dy * b
                xc = x1 + dx * (a + b) / 2
                self.paint(xc - thick / 2, min(ya, yb), thick, abs(yb - ya), grey, alpha)

    def polygon(self, rings, grey, alpha=1.0):
        """Fill canvas polygons (even-odd across `rings`), each cell by the share
        of four sample points inside them."""
        points = [p for ring in rings for p in ring]
        if not points:
            return
        xs, ys = [p[0] * SCALE for p in points], [p[1] * SCALE for p in points]
        edges = [((x0 * SCALE, y0 * SCALE), (x1 * SCALE, y1 * SCALE))
                 for ring in rings for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1])]

        def inside(px, py):
            hit = False
            for (x0, y0), (x1, y1) in edges:
                if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
                    hit = not hit
            return hit

        for row in range(max(0, int(min(ys))), min(GRID_H, int(math.ceil(max(ys))))):
            line = self.cells[row]
            for col in range(max(0, int(min(xs))), min(GRID_W, int(math.ceil(max(xs))))):
                cover = sum(inside(col + dx, row + dy) for dx in (0.25, 0.75) for dy in (0.25, 0.75)) / 4 * alpha
                if cover:
                    line[col] += (grey - line[col]) * min(1.0, cover)

    def share(self, delta=INK_DELTA):
        cells = sorted(v for row in self.cells for v in row)
        median = cells[len(cells) // 2]
        top, bottom = int(GRID_H * BODY[0]), int(GRID_H * BODY[1])
        body = [v for row in self.cells[top:bottom] for v in row]
        return sum(1 for v in body if abs(v - median) > delta) / len(body) if body else 0.0


def _layout(node):
    return ((node.get("data") or {}).get("textLayout") or {})


def _text(grid, node, coverage, bold_weight, spread=0.0):
    style, frame = node.get("style") or {}, node.get("frame") or {}
    color = color_of(style.get("color")) or "#000000"
    if not str(node.get("text") or _layout(node).get("text") or "").strip():
        return
    x, y = _number(frame.get("x")), _number(frame.get("y"))
    width, height = _number(frame.get("width")), _number(frame.get("height"))
    size = _number(style.get("fontSize"), 12.0)
    layout = _layout(node)
    lines = layout.get("lines") if isinstance(layout.get("lines"), list) else None
    pitch = _number(layout.get("lineHeight"), _number(style.get("lineHeight"), size * 4 / 3 * 1.2))
    if not lines:
        lines = [str(node.get("text"))] * max(1, int(round(height / pitch))) if pitch else [str(node.get("text"))]
    lines = [str(line) for line in lines]
    ink_width = _number(layout.get("width"), width) or width
    ink_width = min(ink_width, width) if width else ink_width
    ink_height = len(lines) * pitch
    valign, align = str(style.get("valign") or "top"), str(style.get("align") or "left")
    if 0 < ink_height < height:
        y += (height - ink_height) / 2 if valign in ("mid", "middle", "center") else (height - ink_height) if valign == "bottom" else 0
    longest = max((len(line) for line in lines), default=0) or 1
    face = min(pitch, size * 4 / 3)
    bold = bool(style.get("bold")) or _number(style.get("fontWeight"), 400) >= 600
    alpha = coverage * (bold_weight if bold else 1.0) * _number(style.get("opacity"), 1.0)
    grey = grey_of(color)
    for index, line in enumerate(lines):
        if not line.strip():
            continue
        line_width = ink_width * len(line) / longest
        left = x + ((width - line_width) / 2 if align == "center" else (width - line_width) if align == "right" else 0)
        top = y + index * pitch + (pitch - face) / 2 + face * GLYPH_BAND[0]
        grid.paint(left, top, line_width, face * (GLYPH_BAND[1] - GLYPH_BAND[0]), grey, alpha, spread)


def _polygon_rings(node, x, y, w, h):
    """A custom polygon's rings on the canvas (a country, the area under a
    line), from the paths it carries normalised to its frame; None when it
    carries none, and the shape is read by the share of its box instead."""
    paths = (node.get("data") or {}).get("paths")
    if node.get("type") != "shape" or not isinstance(paths, list) or not paths:
        return None
    rings = []
    for path in paths:
        if not isinstance(path, list) or len(path) < 3:
            return None
        try:
            rings.append([(x + float(p[0]) * w, y + float(p[1]) * h) for p in path])
        except (TypeError, ValueError, IndexError):
            return None
    return rings


def _outline_rings(node, x, y, w, h):
    """The outline of a disc, a sector, a chevron or a diamond on the canvas.
    Spreading a shape's share of its box evenly over the box made a large disc
    or chevron a pale wash under the ink threshold where the render sees a
    solid fill, so these are filled as the shapes they are."""
    kind, geometry = node.get("type"), str(node.get("geometry") or "")
    cx, cy, rx, ry = x + w / 2, y + h / 2, w / 2, h / 2
    if kind in ("ellipse", "wedge"):
        data = node.get("data") or {}
        start = _number(node.get("startAngle"), _number(data.get("startAngle"), 0.0)) if kind == "wedge" else 0.0
        end = _number(node.get("endAngle"), _number(data.get("endAngle"), 360.0)) if kind == "wedge" else 360.0
        sweep = end - start if end > start else end - start + 360
        steps = max(4, int(32 * sweep / 360))
        arc = [(cx + rx * math.cos(math.radians(start + sweep * k / steps)), cy + ry * math.sin(math.radians(start + sweep * k / steps)))
               for k in range(steps + 1)]
        return [arc if sweep >= 359.9 else [(cx, cy)] + arc]
    if geometry == "chevron":
        d = min(h / 2, w / 3)
        return [[(x, y), (x + w - d, y), (x + w, cy), (x + w - d, y + h), (x, y + h), (x + d, cy)]]
    if geometry == "diamond":
        return [[(cx, y), (x + w, cy), (cx, y + h), (x, cy)]]
    return None


def _shape_share(node):
    """The share of its box a shape with no outline to fill covers."""
    role = str(node.get("role") or "")
    if node.get("type") == "shape":
        for pattern, share in SHAPE_SHARE:
            if pattern.search(role):
                return share
    return 1.0


def estimate(slide, coverage=TEXT_COVERAGE, bold_weight=BOLD_WEIGHT, spread=GLYPH_SPREAD, hairline=HAIRLINE_WEIGHT, native=NATIVE_WEIGHT):
    """The share of the page's body the render will read as ink, estimated
    from its scene (see the module docstring)."""
    nodes = [n for n in slide.get("nodes", []) if n.get("frame")]
    grid = _Grid(grey_of(canvas_of(slide)))
    # A chart the deck exports as a native chart object is drawn by the
    # renderer, not from these nodes: its plot keeps the scene's marks and
    # labels but sets them lighter, and a page of two native line charts read
    # 0.11 here and 0.08 on the render.
    natives = {c.get("instanceId") for c in slide.get("componentInstances") or [] if c.get("nativeChart")}
    for node in nodes:
        kind, style, frame = node.get("type"), node.get("style") or {}, node["frame"]
        x, y = _number(frame.get("x")), _number(frame.get("y"))
        w, h = _number(frame.get("width")), _number(frame.get("height"))
        drawn = native if natives and node.get("role") in NATIVE_PLOT_ROLES and (node.get("data") or {}).get("componentInstance") in natives else 1.0
        opacity = _number(style.get("opacity"), 1.0) * drawn
        if kind == "text":
            _text(grid, node, coverage * drawn, bold_weight, spread)
        elif kind == "image":
            # A photograph or a logo differs from the page almost everywhere.
            grid.paint(x, y, w, h, 110.0, opacity)
        elif kind == "line":
            color = color_of(style.get("stroke"))
            if not color:
                continue
            data = node.get("data") or {}
            ends = [data.get(k) for k in ("x1", "y1", "x2", "y2")]
            x1, y1, x2, y2 = ends if all(isinstance(v, (int, float)) for v in ends) else (x, y, x + w, y + h)
            dashed = style.get("dash") not in (None, "none", "solid")
            width = max(0.75, _number(style.get("lineWidth"), 1.0))
            grid.stroke(x1, y1, x2, y2, width, grey_of(color), opacity * (0.55 if dashed else 1.0) * (hairline if width <= 1 else 1.0))
        elif kind in SHAPE_TYPES:
            share = _shape_share(node)
            fill, stroke = color_of(style.get("fill")), color_of(style.get("stroke"))
            width = max(0.75, _number(style.get("lineWidth"), 1.0))
            rings = (_polygon_rings(node, x, y, w, h) or _outline_rings(node, x, y, w, h)) if fill else None
            if rings:
                grid.polygon(rings, grey_of(fill), opacity)
            elif fill:
                grid.paint(x, y, w, h, grey_of(fill), share * opacity)
            if stroke and style.get("stroke") != "none":
                if kind == "shape" and not fill:
                    grid.stroke(x, y + h, x + w, y, width, grey_of(stroke), opacity)
                elif kind == "rect":
                    for edge in ((x, y, w, width), (x, y + h - width, w, width), (x, y, width, h), (x + w - width, y, width, h)):
                        grid.paint(*edge, grey_of(stroke), opacity)
                elif w * h > 0:
                    ring = min(1.0, math.pi * (w + h) / 2 * width / (w * h))
                    grid.paint(x, y, w, h, grey_of(stroke), ring * opacity * (1 if not fill else 0.3))
    return round(grid.share(), 3)
