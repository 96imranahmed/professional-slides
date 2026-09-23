#!/usr/bin/env python3
"""Vendor-neutral slide renderer: PPTX -> PDF (LibreOffice headless) -> PNG per slide.

Usage: render_pptx.py deck.pptx out_dir [--dpi 96] [--montage]
Writes out_dir/slide-N.png (N from 1) and, with --montage, out_dir/montage.png.
Returns JSON with the list of files. This is the only renderer; it runs anywhere LibreOffice does.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


def soffice() -> str:
    for name in ("soffice", "libreoffice"):
        p = shutil.which(name)
        if p:
            return p
    for p in ("/Applications/LibreOffice.app/Contents/MacOS/soffice", "/usr/lib/libreoffice/program/soffice"):
        if Path(p).exists():
            return p
    raise SystemExit("LibreOffice (soffice) not found; install it or configure another renderer")


# LibreOffice on macOS does not enumerate /System/Library/Fonts/Supplemental,
# where Georgia, Palatino and most Office serifs live, so a deck titled in
# Georgia rendered in a Hebrew fallback whose PDF text read "The\x02 t\x02st".
# LibreOffice does load every font in its profile's user/fonts folder, so the
# private profile is given links to the machine's installed font folders.
FONT_DIRS = [Path("/System/Library/Fonts/Supplemental"), Path("/Library/Fonts"), Path.home() / "Library" / "Fonts"]


def expose_fonts(profile: Path) -> int:
    target = profile / "user" / "fonts"
    target.mkdir(parents=True, exist_ok=True)
    linked = 0
    for folder in FONT_DIRS:
        if not folder.is_dir():
            continue
        for font in folder.iterdir():
            if font.suffix.lower() in (".ttf", ".otf", ".ttc") and not (target / font.name).exists():
                try:
                    (target / font.name).symlink_to(font)
                    linked += 1
                except OSError:
                    pass
    return linked


def rasterise(pdf: Path, out_dir: Path, dpi: int) -> None:
    """PDF pages to PNGs, one pdftoppm per block of pages across the machine's
    cores. A fifty-page deck took 6.7s on one core and 1.2s on eight; the
    pages are independent, so nothing is shared but the source PDF."""
    from pypdf import PdfReader
    pages = len(PdfReader(pdf).pages)
    workers = max(1, min(os.cpu_count() or 1, 8, pages))
    size = -(-pages // workers)
    blocks = [(first, min(pages, first + size - 1)) for first in range(1, pages + 1, size)]
    def run(block):
        first, last = block
        subprocess.run(["pdftoppm", "-r", str(dpi), "-png", "-f", str(first), "-l", str(last), str(pdf), str(out_dir / "slide")],
                       check=True, capture_output=True, timeout=300)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(run, blocks))


def render(pptx: Path, out_dir: Path, dpi: int = 96, montage: bool = False) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        profile = Path(td) / "profile"
        if sys.platform == "darwin":
            expose_fonts(profile)
        cmd = [soffice(), "--headless", "--norestore", f"-env:UserInstallation=file://{profile}",
               "--convert-to", "pdf", "--outdir", td, str(pptx)]
        subprocess.run(cmd, check=True, capture_output=True, timeout=300)
        pdf = Path(td) / (pptx.stem + ".pdf")
        if not pdf.exists():
            raise SystemExit(f"PDF conversion produced nothing for {pptx}")
        saved_pdf = out_dir / (pptx.stem + ".pdf")
        shutil.copyfile(pdf, saved_pdf)
        for old in out_dir.glob("slide-*.png"):
            old.unlink()
        rasterise(pdf, out_dir, dpi)
        # pdftoppm zero-pads: slide-01.png … normalise to slide-1.png
        files = []
        for p in sorted(out_dir.glob("slide-*.png")):
            n = int(p.stem.split("-")[1])
            target = out_dir / f"slide-{n}.png"
            if p != target:
                p.rename(target)
            files.append(str(target))
        files.sort(key=lambda s: int(Path(s).stem.split("-")[1]))
    result = {"pptx": str(pptx), "pdf": str(saved_pdf), "renders": files, "dpi": dpi, "renderer": "libreoffice"}
    from pypdf import PdfReader
    text_path = out_dir / "page-text.json"
    text_path.write_text(json.dumps([page.extract_text() or "" for page in PdfReader(saved_pdf).pages], ensure_ascii=False))
    result["pageText"] = str(text_path)
    if montage and files:
        from PIL import Image
        thumbs = [Image.open(f) for f in files]
        w, h = thumbs[0].size
        cols = 4
        rows = (len(thumbs) + cols - 1) // cols
        tw, th = w // 2, h // 2
        sheet = Image.new("RGB", (cols * tw + (cols + 1) * 12, rows * th + (rows + 1) * 12), "#DDDDDD")
        for i, im in enumerate(thumbs):
            r, c = divmod(i, cols)
            sheet.paste(im.resize((tw, th)), (12 + c * (tw + 12), 12 + r * (th + 12)))
        mp = out_dir / "montage.png"
        sheet.save(mp)
        result["montage"] = str(mp)
        # Spreads: the same pages at reading size, four to a sheet.
        #
        # The montage is the whole deck at half size on one image, which is how
        # a fifty-page deck gets looked at and nothing gets found. Every defect
        # this repository has caught by eye was caught at reading size in groups
        # of four, and half a line of misalignment is one pixel on a montage. So
        # the render also writes spreads, and burns each page's number into its
        # corner so a review can cite what it saw.
        result["spreads"] = write_spreads(files, out_dir)
    return result


SPREAD_COLUMNS = 2
SPREAD_ROWS = 2
SPREAD_GUTTER = 16


def write_spreads(files, out_dir: Path) -> list:
    from PIL import Image, ImageDraw
    for old in out_dir.glob("spread-*.png"):
        old.unlink()
    per = SPREAD_COLUMNS * SPREAD_ROWS
    written = []
    for index in range(0, len(files), per):
        group = files[index:index + per]
        pages = [Image.open(f) for f in group]
        w, h = pages[0].size
        rows = (len(pages) + SPREAD_COLUMNS - 1) // SPREAD_COLUMNS
        sheet = Image.new("RGB", (SPREAD_COLUMNS * w + (SPREAD_COLUMNS + 1) * SPREAD_GUTTER,
                                  rows * h + (rows + 1) * SPREAD_GUTTER), "#C8CCD0")
        draw = ImageDraw.Draw(sheet)
        for i, im in enumerate(pages):
            r, c = divmod(i, SPREAD_COLUMNS)
            x = SPREAD_GUTTER + c * (w + SPREAD_GUTTER)
            y = SPREAD_GUTTER + r * (h + SPREAD_GUTTER)
            sheet.paste(im, (x, y))
            number = Path(group[i]).stem.split("-")[1]
            draw.rectangle([x, y, x + 46, y + 22], fill="#0B1F33")
            draw.text((x + 8, y + 6), f"p{number}", fill="#FFFFFF")
        target = out_dir / f"spread-{index // per + 1}.png"
        sheet.save(target)
        written.append(str(target))
    return written


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("pptx"); ap.add_argument("out_dir")
    ap.add_argument("--dpi", type=int, default=96)
    ap.add_argument("--montage", action="store_true")
    a = ap.parse_args(argv)
    print(json.dumps(render(Path(a.pptx), Path(a.out_dir), a.dpi, a.montage)))


if __name__ == "__main__":
    main()
