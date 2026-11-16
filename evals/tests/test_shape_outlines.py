"""A named shape is the same outline in the HTML page and in the PowerPoint file.

A scene node names its geometry and two emitters draw it. They used to draw it
from two hand-kept lists - polygon points for HTML, an Office preset for
PowerPoint - and `test_geometry_parity` only checked that both lists knew the
same names. The outlines themselves disagreed: a preset notchedRightArrow's
shaft is half its height, a preset hexagon's slant is a share of the shorter
side, so a label that sat inside the shape in HTML ran out of it in PowerPoint
and no test said so.

Both emitters now draw from one table (emit/shape-outlines.json), and this test
holds what they finally write to each other rather than trusting the table: it
emits one slide through the real HTML emitter and the real PPTX emitter, reads
each shape's outline back - the SVG element from the page, the custom geometry
or the preset and its adjustments from the saved file - and fails where the two
boundaries part by more than a third of a percent of the shape's shorter side.
A preset's path is computed from its PresentationML definition (ECMA-376
presetShapeDefinitions), so a preset the table keeps is proved to be the
scene's polygon at every frame tried, and a preset this file holds no
definition for fails until someone writes the proof.
"""

from __future__ import annotations

import json
import math
import re
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import RUNTIME, requires_python_package, run_node

sys.path.insert(0, str(RUNTIME / "emit"))
try:
    from pptx import Presentation
    from pptx.oxml.ns import qn
    from emit_pptx import Emitter
except ImportError:  # pragma: no cover - exercised only without python-pptx
    Presentation = qn = Emitter = None

TABLE = json.loads((RUNTIME / "emit" / "shape-outlines.json").read_text(encoding="utf-8"))
EMU = 914400 / 96
# Wide, landscape, square and tall: a preset whose handle is a share of the
# shorter side matches a fraction-of-width polygon at one of these and not the rest.
FRAMES = [(40, 30, 360, 60), (40, 120, 200, 120), (300, 120, 90, 90), (460, 110, 60, 180)]
TURNS = [{"flipH": True}, {"flipV": True}, {"rotate": 30}, {"flipV": True, "rotate": 30}]
# The boundaries may part by this share of the shorter side: enough for an arc
# written as short chords, far less than any outline that is a different shape.
TOLERANCE = 0.003


def probe_nodes() -> list[dict]:
    """One node per geometry and frame, plus turned and flipped ones: everything a shape node can ask an emitter to draw."""
    nodes = []
    def add(kind, frame, style=None, data=None, type="shape"):
        x, y, width, height = frame
        nodes.append({"id": f"n{len(nodes)}", "type": type, "role": "shape", "kind": kind,
                      "frame": {"x": x, "y": y, "width": width, "height": height},
                      "style": {"fill": "#000000", **(style or {})}, "data": data or {}})
    for frame in FRAMES:
        for geometry in TABLE["outlines"]:
            add(geometry, frame, data={"geometry": geometry})
        add("rect", frame, data={"geometry": "rect"})
        add("rect node", frame, type="rect")
        add("rounded rect node", frame, style={"radius": 8}, type="rect")
        add("rect node, radius past half the side", frame, style={"radius": 400}, type="rect")
        add("ellipse node", frame, type="ellipse")
        add("wedge node", frame, data={"startAngle": -90, "endAngle": 140}, type="wedge")
        add("quoteCallout", frame, data={"geometry": "quoteCallout", "bodyRatio": 0.84, "caretCenterRatio": 0.3, "caretWidthRatio": 0.12})
        add("quoteCallout, rounded", frame, data={"geometry": "quoteCallout", "bodyRatio": 0.8, "caretCenterRatio": 0.6, "caretWidthRatio": 0.1, "cornerRadiusRatio": 0.1})
        add("customPolygon", frame, data={"geometry": "customPolygon", "paths": [[[0, 0], [1, 0.2], [0.6, 1]], [[0, 0.6], [0.3, 1], [0, 1]]]})
    for turn in TURNS:
        for geometry in ("rightArrow", "snip1Rect", "chevron"):
            add(f"{geometry} {turn}", FRAMES[1], style=turn, data={"geometry": geometry})
    return nodes


# ------------------------------------------------------------------ the HTML page

def _arc(p0, p1, radius, large, sweep, steps=96):
    """An SVG circular arc as chords (the wedge's only curve; its radii are equal)."""
    (x0, y0), (x1, y1) = p0, p1
    mx, my, dx, dy = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    half = math.hypot(dx, dy) / 2
    radius = max(radius, half)
    back = math.sqrt(max(0.0, radius * radius - half * half))
    side = 1 if large != sweep else -1
    cx, cy = mx - side * back * dy / (2 * half), my + side * back * dx / (2 * half)
    a0, a1 = math.atan2(y0 - cy, x0 - cx), math.atan2(y1 - cy, x1 - cx)
    if sweep and a1 < a0: a1 += 2 * math.pi
    if not sweep and a1 > a0: a1 -= 2 * math.pi
    return [(cx + radius * math.cos(a0 + (a1 - a0) * i / steps), cy + radius * math.sin(a0 + (a1 - a0) * i / steps)) for i in range(1, steps + 1)]


def _path(d: str) -> list[list[tuple]]:
    tokens = re.findall(r"[MLQAZ]|-?\d*\.?\d+(?:e-?\d+)?|NaN", d)
    paths, i = [], 0
    number = lambda: float(tokens[i])
    while i < len(tokens):
        command = tokens[i]; i += 1
        if command == "M":
            paths.append([(float(tokens[i]), float(tokens[i + 1]))]); i += 2
        elif command == "L":
            paths[-1].append((float(tokens[i]), float(tokens[i + 1]))); i += 2
        elif command == "Q":
            (x0, y0), (cx, cy), (x1, y1) = paths[-1][-1], (float(tokens[i]), float(tokens[i + 1])), (float(tokens[i + 2]), float(tokens[i + 3])); i += 4
            paths[-1] += [((1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1) for t in (k / 24 for k in range(1, 25))]
        elif command == "A":
            radius, large, sweep, end = float(tokens[i]), tokens[i + 3] == "1", tokens[i + 4] == "1", (float(tokens[i + 5]), float(tokens[i + 6])); i += 7
            paths[-1] += _arc(paths[-1][-1], end, radius, large, sweep)
        elif command != "Z":
            raise AssertionError(f"the HTML emitter wrote a path this test cannot read: {d}")
    return paths


def _ellipse(cx, cy, rx, ry, steps=360):
    return [(cx + rx * math.cos(2 * math.pi * i / steps), cy + ry * math.sin(2 * math.pi * i / steps)) for i in range(steps)]


def _rounded(x, y, width, height, radius, steps=24):
    if radius <= 0:
        return [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    out = []
    for cx, cy, start in ((x + width - radius, y + radius, -90), (x + width - radius, y + height - radius, 0), (x + radius, y + height - radius, 90), (x + radius, y + radius, 180)):
        out += [(cx + radius * math.cos(math.radians(start + 90 * i / steps)), cy + radius * math.sin(math.radians(start + 90 * i / steps))) for i in range(steps + 1)]
    return out


def _svg_transform(text: str, paths):
    """An SVG transform list, applied last entry first."""
    for name, args in reversed(re.findall(r"(\w+)\(([^)]*)\)", text or "")):
        a = [float(v) for v in args.split()]
        if name == "translate": move = lambda x, y: (x + a[0], y + a[1])
        elif name == "scale": move = lambda x, y: (x * a[0], y * a[1])
        elif name == "rotate":
            cos, sin = math.cos(math.radians(a[0])), math.sin(math.radians(a[0]))
            move = lambda x, y: (a[1] + (x - a[1]) * cos - (y - a[2]) * sin, a[2] + (x - a[1]) * sin + (y - a[2]) * cos)
        else: raise AssertionError(f"unread SVG transform {name}")
        paths = [[move(x, y) for x, y in path] for path in paths]
    return paths


def html_outlines(nodes) -> dict:
    """Each node's outline as the HTML page draws it, in scene px."""
    slide = {"id": "s", "nodes": [{k: v for k, v in node.items() if k != "kind"} for node in nodes]}
    html = run_node(f"""
import {{ renderSlideHtml }} from './evals/support/html.mjs';
console.log(JSON.stringify(renderSlideHtml({json.dumps(slide)})));
""")
    out = {}
    for tag, node_id, rest in re.findall(r'<(polygon|path|rect|ellipse) data-node-id="([^"]+)"([^>]*)/>', html):
        at = dict(re.findall(r'([\w-]+)="([^"]*)"', rest))
        if tag == "polygon": paths = [[tuple(float(v) for v in pair.split(",")) for pair in at["points"].split()]]
        elif tag == "path": paths = _path(at["d"])
        elif tag == "rect": paths = [_rounded(float(at["x"]), float(at["y"]), float(at["width"]), float(at["height"]), float(at.get("rx", 0)))]
        else: paths = [_ellipse(float(at["cx"]), float(at["cy"]), float(at["rx"]), float(at["ry"]))]
        out[node_id] = _svg_transform(at.get("transform"), paths)
    return out


# ------------------------------------------------------------- the PowerPoint file

def _pin(low, value, high):
    return max(low, min(value, high))


def preset_path(prst: str, adjustments: dict, width: float, height: float):
    """A preset's outline in its own box, from its PresentationML definition. One the table keeps must be defined here."""
    w, h, ss = width, height, min(width, height)
    adj = lambda default, name="adj": adjustments.get(name, default)
    if prst == "rect":
        return [(0, 0), (w, 0), (w, h), (0, h)]
    if prst == "roundRect":  # a = pin 0 adj 50000; the corner radius is ss*a/100000
        return _rounded(0, 0, w, h, ss * _pin(0, adj(16667), 50000) / 100000)
    if prst == "ellipse":
        return _ellipse(w / 2, h / 2, w / 2, h / 2)
    if prst == "triangle":  # the apex is at w*adj/100000 along the top
        return [(0, h), (w * _pin(0, adj(50000), 100000) / 100000, 0), (w, h)]
    if prst == "rtTriangle":
        return [(0, h), (0, 0), (w, h)]
    if prst == "diamond":
        return [(0, h / 2), (w / 2, 0), (w, h / 2), (w / 2, h)]
    if prst == "chevron":  # maxAdj = 100000*w/ss; x1 = ss*a/100000; x2 = r - x1
        x1 = ss * _pin(0, adj(50000), 100000 * w / ss) / 100000
        return [(0, 0), (w - x1, 0), (w, h / 2), (w - x1, h), (0, h), (x1, h / 2)]
    raise AssertionError(
        f'the PPTX emitter drew a preset "{prst}" this test holds no definition for: add its path from the PresentationML '
        "preset definitions here (the proof that it is the scene's outline), or take it out of shape-outlines.json `presets` "
        "so it is written as a freeform of the outline")


def pptx_outlines(nodes, emitter=None) -> dict:
    """Each node's outline as the saved PowerPoint file states it, in scene px."""
    scene = {"typography": {"body": "Arial", "display": "Arial"}, "tokens": {}, "slides": [{"id": "s", "tokens": {}, "nodes": [{k: v for k, v in node.items() if k != "kind"} for node in nodes]}]}
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "shapes.pptx"
        (emitter or Emitter)(scene).run(path)
        for shape in Presentation(path).slides[0].shapes:
            if not shape.name.startswith("ps:"):
                continue
            sp = shape._element.spPr
            xfrm = sp.find(qn("a:xfrm"))
            off, ext = xfrm.find(qn("a:off")), xfrm.find(qn("a:ext"))
            x, y, width, height = (int(off.get("x")) / EMU, int(off.get("y")) / EMU, int(ext.get("cx")) / EMU, int(ext.get("cy")) / EMU)
            preset, custom = sp.find(qn("a:prstGeom")), sp.find(qn("a:custGeom"))
            if preset is not None:
                adjustments = {gd.get("name"): float(gd.get("fmla").split()[1]) for gd in preset.iter(qn("a:gd"))}
                paths = [preset_path(preset.get("prst"), adjustments, width, height)]
            else:
                paths = []
                for sub in custom.iter(qn("a:path")):
                    sx, sy = width / float(sub.get("w")), height / float(sub.get("h"))
                    for step in sub:
                        point = step.find(qn("a:pt"))
                        if step.tag == qn("a:moveTo"): paths.append([])
                        if point is not None: paths[-1].append((float(point.get("x")) * sx, float(point.get("y")) * sy))
            # A shape is flipped in its own box, then turned about its centre.
            cx, cy, turn = width / 2, height / 2, math.radians(int(xfrm.get("rot") or 0) / 60000)
            fx, fy = (-1 if xfrm.get("flipH") == "1" else 1), (-1 if xfrm.get("flipV") == "1" else 1)
            def place(px, py):
                px, py = (px - cx) * fx, (py - cy) * fy
                return x + cx + px * math.cos(turn) - py * math.sin(turn), y + cy + px * math.sin(turn) + py * math.cos(turn)
            out[shape.name[3:]] = [[place(px, py) for px, py in sub] for sub in paths]
    return out


# ------------------------------------------------------------------- comparison

def _edges(paths):
    return [(path[i], path[(i + 1) % len(path)]) for path in paths for i in range(len(path))]


def _to_edge(point, edge):
    (px, py), ((ax, ay), (bx, by)) = point, edge
    dx, dy = bx - ax, by - ay
    t = 0 if not (dx or dy) else _pin(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 1)
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def _one_way(source, target):
    reach, edges = 0.0, _edges(target)
    for (ax, ay), (bx, by) in _edges(source):
        for k in range(9):  # along the edge as well as at its ends: a long side can leave an outline its corners are on
            point = (ax + (bx - ax) * k / 8, ay + (by - ay) * k / 8)
            reach = max(reach, min(_to_edge(point, edge) for edge in edges))
    return reach


def parting(a, b) -> float:
    """How far, in px, the boundary of either outline strays from the other's."""
    return max(_one_way(a, b), _one_way(b, a))


def divergences(nodes, emitter=None) -> list[str]:
    html, pptx = html_outlines(nodes), pptx_outlines(nodes, emitter)
    found = []
    for node in nodes:
        frame = node["frame"]
        size = f'{frame["width"]}x{frame["height"]}'
        if node["id"] not in html or node["id"] not in pptx:
            found.append(f'{node["kind"]} at {size}: not drawn in {"HTML" if node["id"] not in html else "PowerPoint"}')
            continue
        if any(math.isnan(v) for path in html[node["id"]] for point in path for v in point):
            found.append(f'{node["kind"]} at {size}: the HTML path is not a number, so a browser draws nothing')
            continue
        apart, allowed = parting(html[node["id"]], pptx[node["id"]]), max(0.05, TOLERANCE * min(frame["width"], frame["height"]))
        if apart > allowed:
            found.append(f'{node["kind"]} at {size}: the outlines part by {apart:.2f}px (allowed {allowed:.2f}px)')
    return found


@requires_python_package("pptx")
class ShapeOutlineTests(unittest.TestCase):
    def test_every_geometry_is_one_outline_in_both_outputs(self):
        self.assertEqual(divergences(probe_nodes()), [],
                         "a shape is one outline in the HTML page and another in the PowerPoint file; both must draw "
                         "emit/shape-outlines.json (a preset only where its path is that outline)")

    def test_a_preset_that_is_not_the_outline_is_caught(self):
        """The defect itself, put back: PowerPoint's own arrows and a chevron with its handle moved."""
        class Presets(Emitter):
            PRESETS = {**Emitter.PRESETS, "chevron": {"prst": "chevron", "adjustments": [0.3]}}
        nodes = [node for node in probe_nodes() if node["kind"] == "chevron"]
        self.assertEqual(len(divergences(nodes, Presets)), len(nodes), "a chevron drawn at another inset passed as the same outline")
        class Unproved(Emitter):
            PRESETS = {**Emitter.PRESETS, "notchedRightArrow": {"prst": "notchedRightArrow", "adjustments": []}}
        with self.assertRaisesRegex(AssertionError, "holds no definition"):
            divergences([node for node in probe_nodes() if node["kind"] == "notchedRightArrow"], Unproved)

    def test_a_small_difference_in_outline_is_caught(self):
        """PowerPoint's regular pentagon against the scene's: shoulders at 0.382 not 0.38, feet at 0.191 not 0.18."""
        scene = [[(x * 200, y * 120) for x, y in TABLE["outlines"]["pentagon"]]]
        office = [[(0.5 * 200, 0), (200, 0.382 * 120), (0.809 * 200, 120), (0.191 * 200, 120), (0, 0.382 * 120)]]
        self.assertGreater(parting(scene, office), TOLERANCE * 120)
        self.assertLess(parting(scene, scene), 1e-9)

    def test_every_preset_is_a_table_outline(self):
        self.assertEqual(set(TABLE["presets"]) - set(TABLE["outlines"]), set(), "a preset with no outline to be held to")

    def test_an_unknown_geometry_is_refused_not_drawn_as_a_rectangle(self):
        node = {"id": "n", "type": "shape", "role": "shape", "kind": "x", "frame": {"x": 0, "y": 0, "width": 80, "height": 40},
                "style": {"fill": "#000000"}, "data": {"geometry": "noSuchShape"}}
        with self.assertRaisesRegex(ValueError, "noSuchShape"):
            pptx_outlines([node])


if __name__ == "__main__":
    unittest.main()
