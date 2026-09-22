"""Render the sampled pages into numbered contact sheets for classification.

    RUNTIME_PYTHON=/tmp/psvenv/bin/python evals/corpus/styles/contact_sheets.py <out-dir>

Each sheet holds twenty pages in a five-by-four grid, each stamped with its
sample number so a classification can be traced back to the page it is about.
Renders are thumbnails, not evidence: they are enough to name a page's design
style and are kept outside the repository.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CORPUS = Path("/Users/imran/Desktop/Side Projects/professional-slides-corpus")
HERE = Path(__file__).parent
COLS, ROWS, CELL_W, CELL_H = 5, 4, 480, 300


def render(entry, out: Path) -> Path | None:
    target = out / "pages" / f"{entry['n']:03d}"
    png = target.with_suffix(".png")
    if png.exists():
        return png
    target.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(["pdftoppm", "-f", str(entry["page"]), "-l", str(entry["page"]),
                             "-png", "-scale-to", "960", "-singlefile",
                             str(CORPUS / entry["path"]), str(target)],
                            capture_output=True, timeout=60)
    return png if result.returncode == 0 and png.exists() else None


def main() -> int:
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    pages = json.loads((HERE / "sample.json").read_text())["pages"]
    font = ImageFont.load_default(size=28)
    failed = []
    per = COLS * ROWS
    for sheet in range(0, len(pages), per):
        canvas = Image.new("RGB", (COLS * CELL_W, ROWS * CELL_H), "white")
        draw = ImageDraw.Draw(canvas)
        for i, entry in enumerate(pages[sheet:sheet + per]):
            x, y = (i % COLS) * CELL_W, (i // COLS) * CELL_H
            png = render(entry, out)
            if png is None:
                failed.append(entry["n"])
                draw.text((x + 10, y + 10), f"{entry['n']} FAILED", fill="red", font=font)
                continue
            thumb = Image.open(png).convert("RGB")
            thumb.thumbnail((CELL_W - 8, CELL_H - 8))
            canvas.paste(thumb, (x + 4, y + 4))
            draw.rectangle([x + 4, y + 4, x + 64, y + 38], fill="black")
            draw.text((x + 8, y + 6), str(entry["n"]), fill="yellow", font=font)
            draw.rectangle([x + 2, y + 2, x + CELL_W - 2, y + CELL_H - 2], outline="#999")
        canvas.save(out / f"sheet-{sheet // per + 1:02d}.png")
    print(json.dumps({"sheets": (len(pages) + per - 1) // per, "failed": failed}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
