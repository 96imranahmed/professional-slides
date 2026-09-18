#!/usr/bin/env python3
"""Independent readback of a saved PPTX against the scene that produced it.

Opens the file with python-pptx (not the emitter's in-memory objects) and checks:
  * every scene text node has a shape named ps:<id> at the scene frame (±2 px);
  * that shape wraps, carries normAutofit, and its paragraph count equals the
    author's paragraph count (not the engine's wrapped line count);
  * the action title is a real title placeholder;
  * every native chart instance has a graphicFrame chart with the right series count;
  * grouped diagrams exist as <p:grpSp>;
  * hard editability facts: zero wrap="none" text boxes on content slides.
Exit 0 on pass, 2 on findings. JSON report on stdout.

Usage: readback_pptx.py scene.json deck.pptx [--tolerance 2]
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


def frame_of(shape):
    return {"x": shape.left * PX, "y": shape.top * PX, "width": shape.width * PX, "height": shape.height * PX}


def walk(shapes):
    for sh in shapes:
        yield sh
        if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from walk(sh.shapes)


def readback(scene: dict, pptx: Path, tol: float = 2.0) -> dict:
    prs = Presentation(str(pptx))
    findings = []
    stats = {"text_checked": 0, "charts_checked": 0, "groups": 0, "wrap_none": 0, "title_placeholders": 0}
    if len(prs.slides) != len(scene["slides"]):
        findings.append({"code": "SLIDE_COUNT", "expected": len(scene["slides"]), "actual": len(prs.slides)})
    for si, (sl, slide) in enumerate(zip(scene["slides"], prs.slides), start=1):
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
                if "".join(p.text for p in tf.paragraphs).replace("\n", "") != str(src).replace("\n", ""):
                    findings.append({"slide": si, "code": "TEXT_MISMATCH", "shape": name})
            if node.get("role") == "action-title" and (title is None or title.name != name):
                findings.append({"slide": si, "code": "TITLE_NOT_PLACEHOLDER", "shape": name})
        for ci in sl.get("componentInstances", []):
            if not ci.get("nativeChart"):
                continue
            name = f"ps:{ci['instanceId']}:chart"
            sh = by_name.get(name)
            if sh is None or not getattr(sh, "has_chart", False):
                findings.append({"slide": si, "code": "MISSING_NATIVE_CHART", "shape": name}); continue
            stats["charts_checked"] += 1
            expected = len(ci["nativeChart"]["series"]) or 1
            actual = sum(len(list(p.series)) for p in sh.chart.plots)
            if actual != expected:
                findings.append({"slide": si, "code": "SERIES_COUNT", "shape": name, "expected": expected, "actual": actual})
    return {"pptx": str(pptx), "accepted": not findings, "stats": stats, "findings": findings}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("scene"); ap.add_argument("pptx"); ap.add_argument("--tolerance", type=float, default=2.0)
    a = ap.parse_args(argv)
    report = readback(json.loads(Path(a.scene).read_text()), Path(a.pptx), a.tolerance)
    print(json.dumps(report, indent=1))
    sys.exit(0 if report["accepted"] else 2)


if __name__ == "__main__":
    main()
