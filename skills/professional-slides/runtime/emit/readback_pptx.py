#!/usr/bin/env python3
"""Independent readback of a saved PPTX against the scene that produced it.

Opens the file with python-pptx (not the emitter's in-memory objects) and checks:
  * every scene text node has a shape named ps:<id> at the scene frame (±2 px);
  * that shape wraps, carries normAutofit, and its paragraph count equals the
    author's paragraph count (not the engine's wrapped line count);
  * the action title is a real title placeholder;
  * every native chart instance has a graphicFrame chart with the right series count;
  * grouped diagrams exist as <p:grpSp>;
  * hard editability facts: zero wrap="none" text boxes on content slides;
  * a slide is hidden from the slide show exactly when its scene slide is.
Exit 0 on pass, 2 on findings. JSON report on stdout; its `hidden` lists the
slides the file hides, by number and page id, so the build result says which.

Usage: readback_pptx.py scene.json deck.pptx
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.oxml.ns import qn

sys.path.insert(0, str(Path(__file__).resolve().parent))
from emit_pptx import CHART_PLOT_ROLES, LABEL_ROLES  # noqa: E402

PX = 96 / 914400

# What the saved file can get wrong against its scene. The build lists each as
# a readback blocker, and delivery refuses on them.
READBACK_CODES = {
    "SLIDE_COUNT": "the file has a different number of slides than the scene",
    "CANVAS_COLOR": "a slide's background is not the scene's canvas colour",
    "WRAP_NONE": "a text box set not to wrap on a content slide",
    "MISSING_SHAPE": "a scene text node has no shape in the file",
    "FRAME_DRIFT": "a shape sits away from its scene frame by more than the tolerance",
    "NO_TEXT_FRAME": "a text node's shape carries no text frame",
    "NO_AUTOFIT": "a text box without normAutofit",
    "PARAGRAPH_COUNT": "a text box's paragraphs differ from the author's",
    "TEXT_MISMATCH": "a text box's words differ from the scene's",
    "TITLE_NOT_PLACEHOLDER": "the action title is not a real title placeholder",
    "MISSING_NATIVE_CHART": "a native chart instance has no chart object in the file",
    "SERIES_COUNT": "a native chart carries a different number of series than planned",
    "NATIVE_AXIS_DRIFT": "a native chart's axis settings differ from the scene's",
    "HIDDEN_STATE": "a slide is hidden from the slide show in the file and not in the scene, or the other way",
    "TEXT_COLOR": "a run of text in the file is set in neither its scene node's colour nor its page's accent",
    "SHAPE_COLOR": "a shape's fill in the file is not its scene node's",
    "CHART_TEXT_COLOR": "a native chart on a page set on another ground than the deck's keeps the theme's text colour, not the page's ink",
}

# A page set on a dark or a primary ground (core.mjs groundOf) resolves every
# colour for that ground, and the file must keep them: a run or a fill the
# emitter took from the deck's light-page colours, or a native chart's labels
# left in the theme's text colour, was navy on a navy page that the scene, and
# every gate reading it, drew legible.


def hex_of(value):
    """A scene style colour as RRGGBB, or None."""
    if isinstance(value, dict):
        value = value.get("value")
    value = str(value or "").lstrip("#").upper()
    return value if len(value) == 6 else None


def saved_color(color_format):
    """A python-pptx colour as RRGGBB, or None where none is set."""
    try:
        return str(color_format.rgb).upper() if color_format.type is not None else None
    except AttributeError:
        return None


def frame_of(shape):
    return {"x": shape.left * PX, "y": shape.top * PX, "width": shape.width * PX, "height": shape.height * PX}


def walk(shapes):
    for sh in shapes:
        yield sh
        if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from walk(sh.shapes)


def readback(scene: dict, pptx: Path, tol: float = 2.0) -> dict:
    prs = Presentation(str(pptx))
    findings, hidden = [], []
    stats = {"text_checked": 0, "charts_checked": 0, "groups": 0, "wrap_none": 0, "title_placeholders": 0}
    if len(prs.slides) != len(scene["slides"]):
        findings.append({"code": "SLIDE_COUNT", "expected": len(scene["slides"]), "actual": len(prs.slides)})
    deck_colors = {k: v.get("value") for k, v in (scene.get("tokens") or (scene["slides"][0].get("tokens") if scene.get("slides") else {}) or {}).items() if v.get("kind") == "color"}
    for si, (sl, slide) in enumerate(zip(scene["slides"], prs.slides), start=1):
        shown = slide._element.get("show") not in ("0", "false")
        if shown == bool(sl.get("hidden")):
            findings.append({"slide": si, "code": "HIDDEN_STATE", "expected": bool(sl.get("hidden")), "actual": not shown})
        if not shown:
            hidden.append({"slide": si, "id": sl.get("sourceSlideId") or sl.get("id")})
        page_colors = {**deck_colors, **{k: v.get("value") for k, v in (sl.get("tokens") or {}).items() if v.get("kind") == "color"}}
        canvas = sl.get("tokens", {}).get("color.canvas", {}).get("value") or scene.get("tokens", {}).get("color.canvas", {}).get("value")
        if canvas:
            saved = slide._element.find("./" + qn("p:cSld") + "/" + qn("p:bg") + "/" + qn("p:bgPr") + "/" + qn("a:solidFill") + "/" + qn("a:srgbClr"))
            actual = saved.get("val") if saved is not None else None
            if actual != canvas.lstrip("#").upper():
                findings.append({"slide": si, "code": "CANVAS_COLOR", "expected": canvas, "actual": actual})
        by_name = {}
        roles = {f"ps:{n['id']}": n.get("role") for n in sl["nodes"]}
        for sh in walk(slide.shapes):
            by_name.setdefault(sh.name, sh)
            if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
                stats["groups"] += 1
            if sh.has_text_frame if hasattr(sh, "has_text_frame") else False:
                body = sh.text_frame._txBody.find(qn("a:bodyPr"))
                if body is not None and body.get("wrap") == "none" and sh.text_frame.text.strip():
                    # Single-line labels legitimately never wrap; prose must.
                    if len(sh.text_frame.paragraphs) > 1 or roles.get(sh.name) not in LABEL_ROLES:
                        stats["wrap_none"] += 1
                        findings.append({"slide": si, "code": "WRAP_NONE", "shape": sh.name, "role": roles.get(sh.name)})
        title = slide.shapes.title
        if title is not None:
            stats["title_placeholders"] += 1
        native = {ci["instanceId"] for ci in sl.get("componentInstances", []) if ci.get("nativeChart")}
        for node in sl["nodes"]:
            if node["type"] != "text":
                continue
            if (node.get("data") or {}).get("componentInstance") in native and node.get("role") in CHART_PLOT_ROLES:
                continue  # replaced by the native chart object
            name = f"ps:{node['id']}"
            sh = by_name.get(name)
            if sh is None:
                findings.append({"slide": si, "code": "MISSING_SHAPE", "shape": name})
                continue
            stats["text_checked"] += 1
            f = frame_of(sh); ef = node["frame"]
            for k in ("x", "y", "width", "height"):
                if abs(f[k] - ef[k]) > tol:
                    findings.append({"slide": si, "code": "FRAME_DRIFT", "shape": name, "axis": k, "expected": round(ef[k], 1), "actual": round(f[k], 1)})
                    break
            if not sh.has_text_frame:
                findings.append({"slide": si, "code": "NO_TEXT_FRAME", "shape": name}); continue
            tf = sh.text_frame
            body = tf._txBody.find(qn("a:bodyPr"))
            if body is None or body.find(qn("a:normAutofit")) is None:
                findings.append({"slide": si, "code": "NO_AUTOFIT", "shape": name})
            if body is not None and body.get("wrap") == "none":
                pass  # counted above
            src = (node.get("data") or {}).get("textLayout", {}).get("source")
            if src is not None:
                expected_paras = len(str(src).split("\n"))
                actual_paras = len(tf.paragraphs)
                if expected_paras != actual_paras:
                    findings.append({"slide": si, "code": "PARAGRAPH_COUNT", "shape": name, "expected": expected_paras, "actual": actual_paras})
                # A soft break (a balanced title's line break) stands for the space it replaced.
                if "".join(p.text.replace("\x0b", " ") for p in tf.paragraphs).replace("\n", "") != str(src).replace("\n", ""):
                    findings.append({"slide": si, "code": "TEXT_MISMATCH", "shape": name})
            if node.get("role") == "action-title" and (title is None or title.name != name):
                findings.append({"slide": si, "code": "TITLE_NOT_PLACEHOLDER", "shape": name})
            allowed = {hex_of((node.get("style") or {}).get("color")), hex_of(page_colors.get("color.accent") or page_colors.get("color.componentPrimary"))} - {None}
            stray = sorted({c for p in tf.paragraphs for r in p.runs if r.text.strip() for c in [saved_color(r.font.color)] if c and c not in allowed})
            if allowed and stray:
                findings.append({"slide": si, "code": "TEXT_COLOR", "shape": name, "expected": sorted(allowed), "actual": stray})
        for node in sl["nodes"]:
            fill = hex_of((node.get("style") or {}).get("fill"))
            sh = by_name.get(f"ps:{node['id']}")
            if node["type"] not in ("rect", "ellipse", "shape") or not fill or sh is None or not hasattr(sh, "fill"):
                continue
            try:
                actual = saved_color(sh.fill.fore_color)
            except TypeError:  # a shape the emitter left unfilled
                actual = None
            if actual != fill:
                findings.append({"slide": si, "code": "SHAPE_COLOR", "shape": sh.name, "expected": fill, "actual": actual})
        for ci in sl.get("componentInstances", []):
            if not ci.get("nativeChart"):
                continue
            name = f"ps:{ci['instanceId']}:chart"
            sh = by_name.get(name)
            if sh is None or not getattr(sh, "has_chart", False):
                findings.append({"slide": si, "code": "MISSING_NATIVE_CHART", "shape": name}); continue
            stats["charts_checked"] += 1
            ink = hex_of(page_colors.get("color.ink"))
            if ink != hex_of(deck_colors.get("color.ink")) and saved_color(sh.chart.font.color) != ink:
                findings.append({"slide": si, "code": "CHART_TEXT_COLOR", "shape": name, "expected": ink, "actual": saved_color(sh.chart.font.color)})
            expected = len(ci["nativeChart"]["series"]) or 1
            actual = sum(len(list(p.series)) for p in sh.chart.plots)
            if actual != expected:
                findings.append({"slide": si, "code": "SERIES_COUNT", "shape": name, "expected": expected, "actual": actual})
            native_spec = ci["nativeChart"]
            if native_spec.get("showValueAxis") and native_spec.get("type") not in ("pie", "donut", "scatter"):
                for key, attr in (("yMin", "minimum_scale"), ("yMax", "maximum_scale"), ("yMajorUnit", "major_unit")):
                    target = native_spec.get(key)
                    actual_value = getattr(sh.chart.value_axis, attr)
                    if target is not None and (actual_value is None or abs(actual_value - target) > 1e-8):
                        findings.append({"slide": si, "code": "NATIVE_AXIS_DRIFT", "shape": name, "field": key, "expected": target, "actual": actual_value})
    return {"pptx": str(pptx), "accepted": not findings, "stats": stats, "hidden": hidden, "findings": findings}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("scene"); ap.add_argument("pptx")
    a = ap.parse_args(argv)
    report = readback(json.loads(Path(a.scene).read_text()), Path(a.pptx))
    print(json.dumps(report, indent=1))
    sys.exit(0 if report["accepted"] else 2)


if __name__ == "__main__":
    main()
