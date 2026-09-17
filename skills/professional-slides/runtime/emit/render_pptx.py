#!/usr/bin/env python3
"""Vendor-neutral slide renderer: PPTX -> PDF (LibreOffice headless) -> PNG per slide.

Usage: render_pptx.py deck.pptx out_dir [--dpi 96] [--montage]
Writes out_dir/slide-N.png (N from 1) and, with --montage, out_dir/montage.png.
Returns JSON with the list of files. This is the only renderer; it runs anywhere LibreOffice does.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
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


def render(pptx: Path, out_dir: Path, dpi: int = 96, montage: bool = False) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        profile = Path(td) / "profile"
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
        subprocess.run(["pdftoppm", "-r", str(dpi), "-png", str(pdf), str(out_dir / "slide")], check=True, capture_output=True, timeout=300)
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
    return result


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("pptx"); ap.add_argument("out_dir")
    ap.add_argument("--dpi", type=int, default=96)
    ap.add_argument("--montage", action="store_true")
    a = ap.parse_args(argv)
    print(json.dumps(render(Path(a.pptx), Path(a.out_dir), a.dpi, a.montage)))


if __name__ == "__main__":
    main()
