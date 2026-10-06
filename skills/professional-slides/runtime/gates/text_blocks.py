"""The one reading of a page's text blocks: a column-aware block is a run of lines in one column with no gap between them.

A text block is what a reader takes in as one unit - a bullet, a paragraph, a
chart's heading, a callout. Read as full-width rows (pdftotext -layout), two
columns that share rows merge into one block, so the same words read as
longer or shorter blocks with where a commentary column sits on its track,
and a band measured that way moves with layout. Read by column, it does not.

Lines are positioned: {x0, y0, x1, y1, text}, the boxes pdftotext -bbox-layout
prints for each line of a rendered PDF (pdf_lines) or the lines a composed
scene sets (density_profile.scene_lines). A line joins the block above it when
the two overlap across (`OVERLAP` of the narrower) and the space between them
is under `GAP` of the line's own height: a paragraph's leading is a fifth of a
line, the space between two points is half a line or more. Plain text is one
column, a blank line the gap between two blocks (as_lines), so a page written
as text reads as it always did.

The reference pages (evals/calibration/measure_text_form.py) and the rendered
deck (density_profile.py) are read by this one function.
"""
from __future__ import annotations

import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

# A line joins the block above it when the space between them is under this share of the line's height.
GAP = 0.7
# ... and the two overlap across by this share of the narrower.
OVERLAP = 0.3
NS = "{http://www.w3.org/1999/xhtml}"


def as_lines(text: str) -> list[dict]:
    """Plain text as positioned lines: one column, one unit a line, a blank line a gap."""
    out = []
    for at, line in enumerate(text.split("\n")):
        if line.strip():
            out.append({"x0": 0.0, "x1": 1000.0, "y0": float(at), "y1": at + 0.8, "text": line})
    return out


def pdf_lines(pdf: Path, first: int | None = None, last: int | None = None) -> list[list[dict]]:
    """Every page's positioned lines, in one pdftotext -bbox-layout run."""
    args = ["pdftotext", *(["-f", str(first)] if first else []), *(["-l", str(last)] if last else []), "-bbox-layout", str(pdf), "-"]
    out = subprocess.run(args, capture_output=True, text=True, check=True).stdout
    # A control character or a bare ampersand in a word is text to us and malformed XML to the parser.
    out = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", out)
    out = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;|#)", "&amp;", out)
    pages = []
    for page in ET.fromstring(out).iter(f"{NS}page"):
        lines = []
        for line in page.iter(f"{NS}line"):
            text = " ".join(word.text or "" for word in line.iter(f"{NS}word"))
            if text.strip():
                lines.append({"x0": float(line.get("xMin")), "y0": float(line.get("yMin")),
                              "x1": float(line.get("xMax")), "y1": float(line.get("yMax")), "text": text})
        pages.append(lines)
    return pages


def blocks(lines: list[dict]) -> list[list[dict]]:
    """The page's blocks, top to bottom, each its lines in reading order."""
    out = []
    for line in sorted(lines, key=lambda l: (l["y0"], l["x0"])):
        height = max(1e-6, line["y1"] - line["y0"])
        home = None
        for block in out:
            last = block[-1]
            across = min(line["x1"], max(l["x1"] for l in block)) - max(line["x0"], min(l["x0"] for l in block))
            narrower = min(line["x1"] - line["x0"], max(l["x1"] for l in block) - min(l["x0"] for l in block))
            gap = line["y0"] - last["y1"]
            if across > OVERLAP * narrower and -0.5 * height <= gap <= GAP * height:
                home = block
        if home is None:
            out.append([line])
        else:
            home.append(line)
    return sorted(out, key=lambda block: (block[0]["y0"], block[0]["x0"]))
