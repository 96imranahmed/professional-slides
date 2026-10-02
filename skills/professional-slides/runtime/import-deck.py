#!/usr/bin/env python3
"""Turn an existing deck into an inventory and a starter pages file.

    python3 runtime/import-deck.py deck.pptx out-dir/ [--id <id>] [--force]

The existing-deck workflow (`workflow: "existing_deck_revision"`) starts here.
The .pptx is read, never written: its bytes are hashed and parsed in memory.
Three things land in out-dir:

    <id>.inventory.json  every slide by stable id (s01, s02, ...): layout,
                         hidden flag, title, subtitle, body paragraphs with
                         their indent levels in reading order (where the slide
                         shows them, through turned and mirrored groups), table
                         cells, chart series and values, pictures with the size
                         and turn they show at, and speaker notes
    <id>.pages.json      the starter: a deck/v3 head that names the inventory,
                         a cover when slide 1 is a shown title slide, and one
                         page per remaining slide carrying its old copy as
                         `draft` and, when the slide was hidden, `hidden: true`
    assets/<id>/         the pictures, as s01-1.png, s01-2.jpg, ... (one folder
                         per imported deck, so two decks never share a name)

The starter does not compile as written, by design. Each page's `draft` is the
slide's old copy; the author maps every page, by its stable id, to a page type
(`type`, `form`, `commentary`, `title`, `exhibit`, ...) and revises its claims
before author-deck.mjs compiles it, keeping the page's `hidden` (or setting it
false to show the slide again). The inventory keeps the full data (table
cells, chart values) to copy into exhibits.

A starter holds the author's revisions, so it is never overwritten: when
<id>.pages.json exists the import refuses (exit 2) unless --force is given.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import sys
from pathlib import Path

try:
    from pptx import Presentation
    from pptx.enum.shapes import PP_PLACEHOLDER
    from pptx.shapes.group import GroupShape
    from pptx.shapes.picture import Picture
except ImportError:  # pragma: no cover
    sys.exit("python-pptx is required: pip install python-pptx")

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
}
EMU_PER_PX = 9525  # 914400 EMU an inch at 96 px an inch
INVENTORY_SCHEMA = "professional-slides.inventory/v1"
DECK_SCHEMA = "professional-slides.deck/v3"
TITLES = {"TITLE", "CENTER_TITLE", "VERTICAL_TITLE"}
CHROME = {"DATE", "FOOTER", "SLIDE_NUMBER", "HEADER"}  # page furniture, not copy
EXTENSIONS = {
    "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/gif": "gif",
    "image/bmp": "bmp", "image/tiff": "tiff", "image/svg+xml": "svg",
    "image/x-emf": "emf", "image/x-wmf": "wmf", "image/webp": "webp",
}
# A placement carries a shape's own coordinates onto the slide, as the affine
# (a, b, c, d, e, f): slide x = a * x + c * y + e, slide y = b * x + d * y + f.
IDENTITY = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


class Refusal(Exception):
    """An input the import will not act on; main() reports it and exits 2."""


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "deck"


def deck_id(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", value):
        raise argparse.ArgumentTypeError(f"'{value}' is not a usable id: letters, digits, '.', '_' and '-' only")
    return value


def px(emu: float) -> int:
    return round(emu / EMU_PER_PX)


def clean(text: str | None) -> str:
    """Text as the author will revise it: soft line breaks read as spaces."""
    return (text or "").replace("\x0b", " ").strip()


def joined(text_frame) -> str | None:
    """A title or subtitle frame as one line: its paragraphs joined by spaces."""
    parts = [clean(p.text) for p in text_frame.paragraphs]
    return " ".join(p for p in parts if p) or None


def reason(error: Exception) -> str:
    return f"{type(error).__name__}: {error}" if str(error) else type(error).__name__


def placeholder_kind(shape) -> str | None:
    try:
        return shape.placeholder_format.type.name if shape.is_placeholder else None
    except Exception:
        return None


def then(outer: tuple, inner: tuple) -> tuple:
    """The placement that applies `inner`, then `outer`."""
    a1, b1, c1, d1, e1, f1 = outer
    a2, b2, c2, d2, e2, f2 = inner
    return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)


def turned(xfrm, left: float, top: float, width: float, height: float) -> tuple:
    """A frame's own flips and rotation, both about its centre: flipH and flipV
    mirror it, then `rot` (60,000ths of a degree, clockwise) turns it."""
    if xfrm is None:
        return IDENTITY
    theta = math.radians(int(xfrm.get("rot", 0)) / 60000)
    fx = -1.0 if xfrm.get("flipH") in ("1", "true") else 1.0
    fy = -1.0 if xfrm.get("flipV") in ("1", "true") else 1.0
    a, b, c, d = math.cos(theta) * fx, math.sin(theta) * fx, -math.sin(theta) * fy, math.cos(theta) * fy
    cx, cy = left + width / 2, top + height / 2
    return (a, b, c, d, cx - a * cx - c * cy, cy - b * cx - d * cy)


def child_placement(placement: tuple, group) -> tuple:
    """The placement of a group's members: the group's child frame (chOff,
    chExt) stretched onto its own frame (off, ext), then the group's flips and
    rotation about that frame's centre, then wherever the group itself sits."""
    xfrm = group._element.find("p:grpSpPr/a:xfrm", NS)
    if xfrm is None:
        return placement
    def pair(tag, first, second):
        el = xfrm.find(f"a:{tag}", NS)
        return None if el is None else (int(el.get(first, 0)), int(el.get(second, 0)))
    off, ext, ch_off, ch_ext = pair("off", "x", "y"), pair("ext", "cx", "cy"), pair("chOff", "x", "y"), pair("chExt", "cx", "cy")
    if None in (off, ext, ch_off, ch_ext):
        return placement
    sx = ext[0] / ch_ext[0] if ch_ext[0] else 1.0
    sy = ext[1] / ch_ext[1] if ch_ext[1] else 1.0
    stretch = (sx, 0.0, 0.0, sy, off[0] - ch_off[0] * sx, off[1] - ch_off[1] * sy)
    return then(placement, then(turned(xfrm, off[0], off[1], ext[0], ext[1]), stretch))


def displayed(shape, placement: tuple) -> tuple:
    """Where the slide shows a leaf shape: (frame, rotation, mirrored). The
    frame (left, top, width, height, slide EMU) is the axis-aligned box its
    turned corners cover; the rotation is how far its upright edge is turned
    clockwise, in degrees, net of every group's mirrors; mirrored is whether an
    odd number of flips shows it reversed, read as a left-right flip."""
    left, top, width, height = shape.left or 0, shape.top or 0, shape.width or 0, shape.height or 0
    element = shape._element
    own = element.find("p:spPr/a:xfrm", NS)
    m = then(placement, turned(own if own is not None else element.find("p:xfrm", NS), left, top, width, height))
    corners = [(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]) for x in (left, left + width) for y in (top, top + height)]
    xs, ys = [x for x, _ in corners], [y for _, y in corners]
    # A left-right flip leaves the upright edge where it was, so its direction
    # is the turn whether or not the shape is mirrored.
    rotation = round(math.degrees(math.atan2(-m[2], m[3])), 2) % 360
    return (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)), int(rotation) if rotation.is_integer() else rotation, m[0] * m[3] - m[1] * m[2] < 0


def walk(shapes, placement=IDENTITY):
    """Every leaf shape on the slide, group members included, with where the
    slide shows it (displayed)."""
    for shape in shapes:
        if isinstance(shape, GroupShape):
            yield from walk(shape.shapes, child_placement(placement, shape))
            continue
        yield (shape, *displayed(shape, placement))


def reading_order(slide) -> list:
    """The slide's leaf shapes top to bottom, then left to right, by where the
    slide shows them."""
    return sorted(walk(slide.shapes), key=lambda item: (item[1][1], item[1][0]))


def read_table(shape) -> dict:
    table = shape.table
    cells = [[clean(cell.text) for cell in row.cells] for row in table.rows]
    return {"rows": len(table.rows), "cols": len(table.columns), "cells": cells}


def number(value):
    if value is None:
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def plot_tag(chart) -> str | None:
    """The first plot's XML tag (barChart, radarChart, ...) for a chart type
    python-pptx does not name."""
    area = chart._chartSpace.find("c:chart/c:plotArea", NS)
    for child in area if area is not None else []:
        tag = child.tag.split("}")[-1]
        if tag.endswith("Chart"):
            return tag
    return None


def category_labels(plot) -> list:
    """The leaf category labels by index; a category left empty in the
    workbook has no point and reads as None."""
    categories = plot.categories
    labels = [None] * len(categories)
    for position, category in enumerate(categories):
        pt = getattr(category, "_pt", None)
        index = int(pt.get("idx")) if pt is not None and pt.get("idx") is not None else position
        if 0 <= index < len(labels):
            labels[index] = str(category)
    return labels


def read_chart(shape) -> dict:
    """What can be read of a chart. A part that cannot be read is left empty
    and the failure is recorded under `unreadable`."""
    record = {"type": None, "title": None, "categories": [], "series": []}
    problems = []
    try:
        chart = shape.chart
    except Exception as error:
        return {**record, "unreadable": f"chart: {reason(error)}"}
    try:
        record["type"] = chart.chart_type.name
    except Exception:
        try:
            record["type"] = plot_tag(chart)
        except Exception as error:
            problems.append(f"type: {reason(error)}")
    try:
        if chart.has_title and chart.chart_title.has_text_frame:
            record["title"] = joined(chart.chart_title.text_frame)
    except Exception as error:
        problems.append(f"title: {reason(error)}")
    try:
        if len(chart.plots):
            record["categories"] = category_labels(chart.plots[0])
    except Exception as error:
        problems.append(f"categories: {reason(error)}")
    try:
        count = len(chart.series)
    except Exception as error:
        problems.append(f"series: {reason(error)}")
        count = 0
    for i in range(count):
        entry = {"name": None, "values": []}
        try:
            series = chart.series[i]
            entry["name"] = clean(series.name) or None
            entry["values"] = [number(v) for v in series.values]
        except Exception as error:
            problems.append(f"series {i + 1}: {reason(error)}")
        record["series"].append(entry)
    if problems:
        record["unreadable"] = "; ".join(problems)
    return record


def read_picture(shape, frame, rotation, mirrored: bool, name: str, assets: Path) -> dict:
    """Write the picture to assets/ and record how the slide shows it: the box
    it covers, its turn and, when it shows reversed, that it is mirrored. The
    file is the image as stored, unturned."""
    alt = None
    try:
        props = shape._element.find(".//p:cNvPr", NS)
        alt = clean(props.get("descr")) or clean(props.get("name")) or None
    except Exception:
        pass
    record = {"file": None, "width": px(frame[2]), "height": px(frame[3]), "rotation": rotation, **({"mirrored": True} if mirrored else {}), "alt": alt}
    try:
        image = shape.image
        ext = EXTENSIONS.get(image.content_type, image.ext)
        path = assets / f"{name}.{ext}"
        assets.mkdir(parents=True, exist_ok=True)
        path.write_bytes(image.blob)
        record["file"] = path.relative_to(assets.parent.parent).as_posix()
    except Exception as error:
        record["unreadable"] = reason(error)
    return record


def read_notes(slide) -> str | None:
    try:
        if not slide.has_notes_slide:
            return None
        frame = slide.notes_slide.notes_text_frame
        return None if frame is None else clean(frame.text) or None
    except Exception:
        return None


def read_slide(slide, index: int, sid: str, assets: Path) -> dict:
    record = {
        "index": index, "id": sid, "layout": None, "hidden": slide._element.get("show") in ("0", "false"),
        "title": None, "subtitle": None, "paragraphs": [], "tables": [], "charts": [], "pictures": [], "notes": read_notes(slide),
    }
    try:
        record["layout"] = slide.slide_layout.name
    except Exception:
        pass
    for shape, frame, rotation, mirrored in reading_order(slide):
        if isinstance(shape, Picture):
            record["pictures"].append(read_picture(shape, frame, rotation, mirrored, f"{sid}-{len(record['pictures']) + 1}", assets))
        elif getattr(shape, "has_chart", False):
            record["charts"].append(read_chart(shape))
        elif getattr(shape, "has_table", False):
            record["tables"].append(read_table(shape))
        elif getattr(shape, "has_text_frame", False):
            kind = placeholder_kind(shape)
            if kind in CHROME:
                continue
            if kind in TITLES or kind == "SUBTITLE":
                key = "title" if kind in TITLES else "subtitle"
                text = joined(shape.text_frame)
                if record[key] is None:
                    record[key] = text
                    continue
            for paragraph in shape.text_frame.paragraphs:
                text = clean(paragraph.text)
                if text:
                    record["paragraphs"].append({"text": text, "level": paragraph.level})
    return record


def looks_like_cover(slide: dict) -> bool:
    """Slide 1 is taken as the cover when it has a title and either sits on a
    title layout (not a content, comparison or title-only one) or carries a
    subtitle and nothing else."""
    if not slide["title"]:
        return False
    layout = (slide["layout"] or "").lower()
    title_layout = "title" in layout and not re.search(r"content|(?<![a-z])(?:and|only)(?![a-z])", layout)
    bare = slide["subtitle"] is not None and not (slide["paragraphs"] or slide["tables"] or slide["charts"])
    return title_layout or bare


def draft_of(slide: dict) -> dict:
    """The slide's old copy for the author to revise; empty parts are left out."""
    draft = {
        "subtitle": slide["subtitle"],
        "text": ["  " * p["level"] + p["text"] for p in slide["paragraphs"]],
        "tables": [{"rows": t["rows"], "cols": t["cols"]} for t in slide["tables"]],
        "charts": [{"type": c["type"], "categories": len(c["categories"]), "series": [s["name"] for s in c["series"]]} for c in slide["charts"]],
        "pictures": [p["file"] for p in slide["pictures"] if p["file"]],
        "notes": slide["notes"],
    }
    return {key: value for key, value in draft.items() if value not in (None, [], "")}


def starter(identifier: str, inventory_name: str, slides: list) -> dict:
    """The deck head and a page per slide. A hidden slide's page carries
    `hidden: true` beside its draft, not in it: mapping the page to a type
    replaces the draft, and the flag must outlive it so the rebuilt slide stays
    out of the slide show. A cover cannot be hidden, so a hidden title slide
    stays a page."""
    deck = {"schema": DECK_SCHEMA, "id": identifier, "workflow": "existing_deck_revision", "inventory": inventory_name, "request": ""}
    body = slides
    if slides and looks_like_cover(slides[0]) and not slides[0]["hidden"]:
        first = slides[0]
        deck["cover"] = {"title": first["title"], **({"subtitle": first["subtitle"]} if first["subtitle"] else {})}
        body = slides[1:]
    pages = [{"id": s["id"], "sourceSlide": s["index"], "title": s["title"] or "", **({"hidden": True} if s["hidden"] else {}), "draft": draft_of(s)} for s in body]
    return {"deck": deck, "pages": pages}


def open_deck(path: Path):
    if not path.is_file():
        raise Refusal(f"No such deck: {path}")
    try:
        data = path.read_bytes()
    except OSError as error:
        raise Refusal(f"Cannot read {path}: {error.strerror or error}")
    try:
        return Presentation(io.BytesIO(data)), hashlib.sha256(data).hexdigest()
    except Exception as error:
        raise Refusal(f"{path.name} is not a PowerPoint deck (.pptx): {reason(error)}")


def import_deck(path: Path, out: Path, identifier: str, force: bool = False) -> dict:
    prs, digest = open_deck(path)
    inventory_path, pages_path = out / f"{identifier}.inventory.json", out / f"{identifier}.pages.json"
    if pages_path.exists() and not force:
        raise Refusal(f"{pages_path} already exists and may hold revisions; pass --force to overwrite it with a fresh starter")
    out.mkdir(parents=True, exist_ok=True)
    width = 3 if len(prs.slides) > 99 else 2
    slides = [read_slide(slide, i, f"s{i:0{width}d}", out / "assets" / identifier) for i, slide in enumerate(prs.slides, 1)]
    inventory = {
        "schema": INVENTORY_SCHEMA, "id": identifier,
        "source": {"file": path.name, "sha256": digest},
        "slideSize": {"width": px(prs.slide_width or 0), "height": px(prs.slide_height or 0)},
        "slides": slides,
    }
    inventory_path.write_text(json.dumps(inventory, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    pages_path.write_text(json.dumps(starter(identifier, inventory_path.name, slides), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return {
        "inventory": str(inventory_path), "pages": str(pages_path), "slides": len(slides),
        "pictures": sum(len(s["pictures"]) for s in slides), "charts": sum(len(s["charts"]) for s in slides),
        "tables": sum(len(s["tables"]) for s in slides),
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("deck", type=Path, help="the .pptx to read")
    parser.add_argument("out", type=Path, help="the folder for the inventory, the starter pages and assets/")
    parser.add_argument("--id", type=deck_id, help="the deck id (default: a slug of the file name)")
    parser.add_argument("--force", action="store_true", help="overwrite an existing starter pages file")
    args = parser.parse_args(argv)
    try:
        summary = import_deck(args.deck, args.out, args.id or slug(args.deck.stem), args.force)
    except Refusal as refusal:
        print(refusal, file=sys.stderr)
        return 2
    print(json.dumps(summary, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
