#!/usr/bin/env python3
"""Infer what can be read off a reference deck supplied as a PDF or screenshots.

    python3 runtime/infer-style.py reference.pdf [--pages 12]
    python3 runtime/infer-style.py page1.png page2.png ...

A PPTX or POTX goes through import-template.py, which reads the masters. A PDF
or a screenshot has no masters, so this reads the pixels: the canvas, the ink,
the chromatic colours by how much of the page they cover (the brand's primary
and accent are almost always the two most used), and the title treatment from
the top of each page - a full-width filled block, a tinted band, a rule across
it, or nothing. Everything it prints is a suggestion with the evidence behind
it; the tracker, the fonts and the density are left to the author's eye and
listed under `notInferred`, so the intake asks for them.
"""
from __future__ import annotations

import argparse
import colorsys
import json
import shutil
import subprocess
import tempfile
from collections import Counter
from pathlib import Path

from PIL import Image

WIDTH = 640  # pages are measured at this width; enough for a 1px rule at 1280


def pages_of(paths: list[Path], limit: int, work: Path) -> list[Image.Image]:
    images = []
    for path in paths:
        if path.suffix.lower() == ".pdf":
            if not shutil.which("pdftoppm"):
                raise SystemExit("pdftoppm (poppler) is needed to read a PDF; export the pages as PNG instead")
            subprocess.run(["pdftoppm", "-r", "48", "-png", "-l", str(limit), str(path), str(work / path.stem)], check=True, capture_output=True, timeout=300)
            images += [Image.open(p).convert("RGB") for p in sorted(work.glob(f"{path.stem}*.png"))]
        else:
            images.append(Image.open(path).convert("RGB"))
    return [im.resize((WIDTH, round(im.height * WIDTH / im.width))) for im in images[:limit]]


def hexed(rgb) -> str:
    return "#%02X%02X%02X" % tuple(rgb)


def quantised(rgb, step=8):
    return tuple(min(255, (c // step) * step + step // 2) for c in rgb)


def chroma(rgb) -> tuple[float, float]:
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    return s, l


def title_treatment(page: Image.Image, canvas) -> str | None:
    """The top quarter of a page: a filled full-width block, a tinted band, a
    rule across it, a short accent bar under the title, or open.

    Each row is read as runs of off-canvas pixels. A rule is one unbroken run
    over most of the width and at most a few pixels thick - which is what
    tells it from a table header band or two column headings' underlines
    side by side. A bar is one short, coloured run that type never makes."""
    top = page.crop((0, 0, page.width, page.height // 4))
    rows = []
    for y in range(top.height):
        row = [top.getpixel((x, y)) for x in range(0, top.width, 2)]
        off = [i for i, p in enumerate(row) if sum(abs(a - b) for a, b in zip(p, canvas)) > 30]
        unbroken = bool(off) and off[-1] - off[0] + 1 <= len(off) + 2
        tone = Counter(quantised(row[i]) for i in off).most_common(1)[0][0] if off else None
        rows.append((len(off) / len(row), unbroken, tone))
    filled = [tone for share, _, tone in rows if share > 0.9]
    if len(filled) > top.height * 0.35:
        return "block" if sum(Counter(filled).most_common(1)[0][0]) < 380 else "band"
    for y, (share, unbroken, _) in enumerate(rows):
        thick = 1
        while y + thick < len(rows) and rows[y + thick][0] > 0.6:
            thick += 1
        if share > 0.6 and unbroken and thick <= 3 and (y == 0 or rows[y - 1][0] < 0.5):
            return "full" if share > 0.95 else "rule"
    bars = [y for y, (share, unbroken, tone) in enumerate(rows) if 0.02 < share < 0.15 and unbroken and chroma(tone)[0] > 0.3]
    if len(bars) >= 2 and bars[-1] > top.height * 0.4:
        return "bar"
    return None


def infer(paths: list[Path], limit: int = 12) -> dict:
    with tempfile.TemporaryDirectory() as td:
        pages = pages_of(paths, limit, Path(td))
    if not pages:
        raise SystemExit("No pages to read")
    counts, modes = Counter(), []
    for page in pages:
        page_counts = Counter(quantised(p) for p in page.getdata())
        counts.update(page_counts)
        modes.append(page_counts.most_common(1)[0][0])
    total = sum(counts.values())
    # The canvas is the ground of the content pages. Covers and chapter pages
    # are often a colour field, and a short reference can hold as many of them
    # as content pages, so a light ground wins wherever one exists.
    light = [m for m in modes if chroma(m)[1] > 0.8]
    canvas = Counter(light or modes).most_common(1)[0][0]
    content = [p for p, m in zip(pages, modes) if sum(abs(a - b) for a, b in zip(m, canvas)) <= 24] or pages
    ink = min((c for c, n in counts.most_common(40)), key=lambda c: sum(c))
    near_canvas = lambda c: sum(abs(a - b) for a, b in zip(c, canvas)) <= 24
    chromatic = [(c, n / total) for c, n in counts.most_common() if not near_canvas(c) and chroma(c)[0] > 0.3 and 0.1 < chroma(c)[1] < 0.9]
    merged: list[list] = []
    for colour, share in chromatic:  # fold neighbours of one swatch together
        for group in merged:
            if sum((a - b) ** 2 for a, b in zip(colour, group[0])) < 900:
                group[1] += share
                break
        else:
            merged.append([colour, share])
    merged.sort(key=lambda g: -g[1])
    colours = [{"hex": hexed(c), "share": round(s, 4)} for c, s in merged[:6] if s > 0.0002]
    treatments = Counter(t for t in (title_treatment(p, canvas) for p in content) if t)
    observations = [f"Read {len(pages)} page(s); canvas {hexed(canvas)}, ink {hexed(ink)}"]
    suggested = {}
    if colours:
        # The accent is the next colour that is not a shade of the primary.
        primary = merged[0][0]
        accent = next((hexed(c) for c, s in merged[1:6] if s > 0.0002 and sum((a - b) ** 2 for a, b in zip(c, primary)) > 3000 and chroma(c)[0] > 0.4), None)
        suggested["brand"] = {"primary": colours[0]["hex"], **({"accent": accent} if accent else {})}
        listed = ", ".join("%s (%.1f%%)" % (c["hex"], c["share"] * 100) for c in colours[:3])
        observations.append(f"Most used colours: {listed}; suggested brand primary {colours[0]['hex']}" + (f", accent {accent}" if accent else ", no distinct accent"))
    else:
        observations.append("No strong colour on the pages; suggest the design system's own colours")
    if treatments:
        value, n = treatments.most_common(1)[0]
        suggested["titleRule"] = value
        observations.append(f"Title treatment reads as '{value}' on {n} of {len(content)} content page(s)")
    if max(canvas) - min(canvas) > 6 or sum(canvas) < 700:
        observations.append(f"The canvas {hexed(canvas)} is tinted: the editorial system's paper canvas is the nearest")
    return {"schema": "professional-slides.inferred-style/v1", "pages": len(pages), "canvas": hexed(canvas), "ink": hexed(ink),
            "colours": colours, "suggested": suggested, "observations": observations,
            "notInferred": ["design", "tracker", "surfaces", "density", "typography"]}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--pages", type=int, default=12)
    a = ap.parse_args(argv)
    print(json.dumps(infer(a.files, a.pages), indent=1))


if __name__ == "__main__":
    main()
