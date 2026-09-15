#!/usr/bin/env python3
"""Reconstruct a gate-readable scene from a saved .pptx.

The page gates measure a resolved scene plus its render. A deck built by an
older pipeline has no scene on disk, so this reads the PPTX back with
python-pptx and rebuilds the minimum the gates need: text nodes with a role, a
frame in canvas pixels, a font size in points, and the laid-out lines. It is
deliberately independent of the runtime that wrote the file - the only contract
it relies on is the `ps:<instance>:<role>` shape-naming convention.

    pptx_scene_probe.py deck.pptx scene-out.json

Role names are the writer's own suffixes, mapped onto the scene role vocabulary
the gates use.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Emu

CANVAS_W, CANVAS_H = 1280, 720

ROLE_MAP = {
    "title": "action-title",
    "subtitle": "cover-subtitle",
    "text": "paragraph",
    "heading": "section-heading",
    "source": "source-text",
    "page-number": "page-number",
    "cell-text": "table-cell-text",
    "header-text": "table-header-text",
    "value-label": "data-label",
    "category": "category-label",
    "label": "legend-label",
    "key": "legend-swatch",
    "unit": "chart-unit",
    "axis-label": "axis-label",
    "y-axis-label": "axis-label",
    "image": "image",
}

# Instance role suffixes that identify what kind of component an instance is.
CHART_MARKERS = {"series", "value-label", "category", "x-axis", "y-axis", "unit"}
TABLE_MARKERS = {"cell-text", "header-text"}


def px(emu, total_emu, total_px):
    return float(Emu(emu)) / float(total_emu) * total_px


def instance_root(instance_id, slide_id):
    """`s06-s06-0-0-heading` -> `s06-0-0`; page chrome keeps its own name."""
    if instance_id.startswith(slide_id + "-"):
        rest = instance_id[len(slide_id) + 1:]
    else:
        rest = instance_id
    if rest in ("chrome", "cover"):
        return rest
    match = re.match(r"^(" + re.escape(slide_id) + r"-\d+)", rest)
    return match.group(1) if match else rest


def probe(path):
    presentation = Presentation(str(path))
    total_w, total_h = presentation.slide_width, presentation.slide_height
    slides = []
    for index, slide in enumerate(presentation.slides):
        slide_id = f"s{index + 1:02d}"
        nodes = []
        instances = {}

        def visit(shapes):
            for shape in shapes:
                if shape.shape_type == 6:  # group
                    visit(shape.shapes)
                    continue
                name = shape.name or ""
                if not name.startswith("ps:"):
                    continue
                parts = name[3:].split(":")
                instance_id = parts[0]
                suffix = parts[1] if len(parts) > 1 else ""
                root = instance_root(instance_id, slide_id)
                frame = {
                    "x": px(shape.left or 0, total_w, CANVAS_W),
                    "y": px(shape.top or 0, total_h, CANVAS_H),
                    "width": px(shape.width or 0, total_w, CANVAS_W),
                    "height": px(shape.height or 0, total_h, CANVAS_H),
                }
                bucket = instances.setdefault(root, {"suffixes": set(), "frames": []})
                bucket["suffixes"].add(suffix)
                bucket["frames"].append(frame)
                role = ROLE_MAP.get(suffix)
                if role is None or not getattr(shape, "has_text_frame", False):
                    continue
                paragraphs = [p.text for p in shape.text_frame.paragraphs]
                lines = [p for p in paragraphs if p != ""] or paragraphs
                size = None
                for paragraph in shape.text_frame.paragraphs:
                    for run in paragraph.runs:
                        if run.font.size is not None:
                            size = run.font.size.pt
                            break
                    if size is None and paragraph.font.size is not None:
                        size = paragraph.font.size.pt
                    if size is not None:
                        break
                nodes.append({
                    "type": "text",
                    "id": name,
                    "role": role,
                    "frame": frame,
                    "style": {"fontSize": {"value": size}} if size is not None else {},
                    "text": "\n".join(lines),
                    "data": {"textLayout": {"source": " ".join(lines), "lines": lines}},
                })

        visit(slide.shapes)

        component_instances = []
        for root, bucket in instances.items():
            if root in ("chrome",):
                component_instances.append({"id": "chrome", "component": "slide-chrome",
                                            "frame": {"x": 0, "y": 0, "width": CANVAS_W, "height": CANVAS_H}})
                continue
            if root in ("cover",):
                component_instances.append({"id": "cover", "component": "cover",
                                            "frame": {"x": 0, "y": 0, "width": CANVAS_W, "height": CANVAS_H}})
                continue
            suffixes = bucket["suffixes"]
            if suffixes & TABLE_MARKERS:
                component = "table"
            elif suffixes & CHART_MARKERS:
                component = "chart.column"
            elif suffixes == {"image"}:
                component = "image-frame"
            elif suffixes & {"text"}:
                component = "paragraph"
            else:
                component = "section"
            xs = [f["x"] for f in bucket["frames"]]
            ys = [f["y"] for f in bucket["frames"]]
            x2 = [f["x"] + f["width"] for f in bucket["frames"]]
            y2 = [f["y"] + f["height"] for f in bucket["frames"]]
            component_instances.append({
                "id": root, "component": component,
                "frame": {"x": min(xs), "y": min(ys), "width": max(x2) - min(xs), "height": max(y2) - min(ys)},
            })
        slides.append({
            "id": slide_id,
            "nodes": nodes,
            "componentInstances": component_instances,
            "contentFrame": {"x": 60, "y": 162, "width": 1160, "height": 506},
        })
    return {"schema": "professional-slides.scene-probe/v1", "source": str(path), "slides": slides}


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("pptx")
    parser.add_argument("out")
    args = parser.parse_args(argv)
    scene = probe(Path(args.pptx))
    Path(args.out).write_text(json.dumps(scene), encoding="utf-8")
    print(json.dumps({"out": args.out, "slides": len(scene["slides"]),
                      "nodes": sum(len(s["nodes"]) for s in scene["slides"])}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
