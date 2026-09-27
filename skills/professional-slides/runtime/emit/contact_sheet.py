#!/usr/bin/env python3
"""Lay rendered pages out as one labelled contact sheet.

Usage: contact_sheet.py layout.json

layout.json: { "out", "title", "subtitle", "header": bool,
               "tiles": [{ "label", "note", "images": [{ "path", "crop"?: [x0, y0, x1, y1] }] }] }

Each tile is a caption - the exact deck value in bold, what it means beside
it - over its pages. A header sheet (trackers, title treatments) shows a
page thumbnail beside its header band at reading size, because the thing
being chosen is a few pixels tall on a whole page. The sheet is saved as a
256-colour PNG (see `reduce`): flat page colours survive exactly and the file
is a third the size.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BACKGROUND, BORDER, INK, MUTED = "#EEF0F2", "#C4C9CE", "#111418", "#555B61"
MARGIN, GAP, MAX_WIDTH = 32, 16, 1760
FACES = {
    "bold": ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"],
    "regular": ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"],
    "mono": ["/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Supplemental/Courier New Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", "C:/Windows/Fonts/consolab.ttf"],
}


def face(kind: str, size: int):
    for candidate in FACES[kind]:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size, index=1 if candidate.endswith("Menlo.ttc") else 0)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def fit(image: Image.Image, width: int) -> Image.Image:
    return image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)


def tile_images(tile: dict, header: bool) -> list:
    """The tile's pages, scaled: a header sheet pairs a 360px thumbnail with its band at 1280px."""
    images = []
    for spec in tile["images"]:
        image = Image.open(spec["path"]).convert("RGB")
        if spec.get("crop"):
            images.append(fit(image.crop(tuple(spec["crop"])), 1280))
        else:
            images.append(image)
    if header:
        return [fit(im, 1280) if i == 0 else fit(im, 356) for i, im in enumerate(images)][::-1]
    width = min(800, (MAX_WIDTH - GAP * (len(images) - 1)) // len(images))
    return [fit(im, width) for im in images]


def reduce(sheet: Image.Image) -> Image.Image:
    """256 colours, keeping every flat page colour exact.

    A plain median cut merged a small bright accent (a tracker pill, a
    highlighted phrase) into a duller neighbour, and an octree mapped a light
    title band to white: on a sheet for choosing colours both are lies. The
    palette is the sheet's most used exact colours - fills, tints, type - with
    the rest from a median cut for the anti-aliased edges between them. The
    mapping is an exact nearest match; Pillow's own palette mapping rounds
    through a colour cache and moved a pure red by twenty levels."""
    # Most used first, skipping a colour within a few levels of one already
    # kept: otherwise fifty near-identical greys take the places a small
    # accent (a tracker pill) needs.
    exact = []
    for count, colour in sorted(sheet.getcolors(sheet.width * sheet.height), reverse=True):
        if count < 24 or len(exact) == 200:
            break
        if all(sum((a - b) ** 2 for a, b in zip(colour, kept)) > 64 for kept in exact):
            exact.append(colour)
    edges = sheet.quantize(colors=256 - len(exact), method=Image.Quantize.MEDIANCUT).getpalette()[:(256 - len(exact)) * 3]
    palette = np.array(exact + [tuple(edges[i:i + 3]) for i in range(0, len(edges), 3)], dtype=np.int32)
    pixels = np.asarray(sheet, dtype=np.int32).reshape(-1, 3)
    colours, inverse = np.unique(pixels, axis=0, return_inverse=True)
    nearest = np.empty(len(colours), dtype=np.uint8)
    for start in range(0, len(colours), 4096):
        block = colours[start:start + 4096]
        nearest[start:start + 4096] = ((block[:, None, :] - palette[None, :, :]) ** 2).sum(axis=2).argmin(axis=1)
    out = Image.fromarray(nearest[inverse.reshape(-1)].reshape(sheet.height, sheet.width), "P")
    out.putpalette([int(c) for c in palette.reshape(-1)] + [0] * (768 - palette.size))
    return out


def main(argv=None):
    layout = json.loads(Path((argv or sys.argv[1:])[0]).read_text())
    header = bool(layout.get("header"))
    title_font, sub_font, label_font, note_font = face("bold", 30), face("regular", 18), face("mono", 22), face("regular", 19)
    rows = []
    for tile in layout["tiles"]:
        images = tile_images(tile, header)
        rows.append((tile, images, sum(im.width for im in images) + GAP * (len(images) - 1), max(im.height for im in images)))
    width = MARGIN * 2 + max(row[2] for row in rows)
    caption = 34
    height = MARGIN + 44 + 30 + GAP + sum(caption + row[3] + GAP * 2 for row in rows) + MARGIN
    sheet = Image.new("RGB", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    draw.text((MARGIN, MARGIN), layout["title"], font=title_font, fill=INK)
    draw.text((MARGIN, MARGIN + 44), layout.get("subtitle", ""), font=sub_font, fill=MUTED)
    y = MARGIN + 44 + 30 + GAP * 2
    for tile, images, _, row_height in rows:
        draw.text((MARGIN, y), tile["label"], font=label_font, fill=INK)
        label_width = draw.textlength(tile["label"], font=label_font)
        if tile.get("note"):
            draw.text((MARGIN + label_width + 18, y + 3), tile["note"], font=note_font, fill=MUTED)
        y += caption
        x = MARGIN
        for image in images:
            sheet.paste(image, (x, y))
            draw.rectangle([x - 1, y - 1, x + image.width, y + image.height], outline=BORDER)
            x += image.width + GAP
        y += row_height + GAP * 2
    out = Path(layout["out"])
    out.parent.mkdir(parents=True, exist_ok=True)
    reduce(sheet).save(out, optimize=True)
    print(json.dumps({"out": str(out), "width": width, "height": height, "tiles": len(rows)}))


if __name__ == "__main__":
    main()
