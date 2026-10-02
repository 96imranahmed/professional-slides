#!/usr/bin/env python3
"""Vendor-neutral slide renderer: PPTX -> PDF (LibreOffice headless) -> PNG per slide.

Usage: render_pptx.py deck.pptx out_dir [--dpi 96] [--montage]
       render_pptx.py --sheets out_dir
Writes out_dir/slide-N.png (N from 1), and with --montage the review sheets
(out_dir/montage.png and out_dir/spread-N.png). --sheets writes only the
sheets, from the slide PNGs already in out_dir, so a build can draw them while
its gates read the pages. Prints JSON with the list of files. This is the only
renderer; it runs anywhere LibreOffice does.

Exit 0 when the deck rendered, 3 when LibreOffice or poppler is not installed
(the JSON then carries `skipped: true`, what is missing and how to install
it, so a build can finish unrendered and say so), 1 on a crash.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# The canvas the gates measure (gates/ink.py): a 13.333 x 7.5 in slide at 96
# dpi. pdftoppm rounds the page to 1281 px wide at `-r 96`, and every gate
# then resampled every page back; the renders are scaled to the canvas instead.
CANVAS_W, CANVAS_H = 1280, 720
MISSING_EXIT = 3
SOFFICE_PATHS = ("/Applications/LibreOffice.app/Contents/MacOS/soffice", "/usr/lib/libreoffice/program/soffice")


def soffice() -> str | None:
    for name in ("soffice", "libreoffice"):
        p = shutil.which(name)
        if p:
            return p
    for p in SOFFICE_PATHS:
        if Path(p).exists():
            return p
    return None


def missing_tools() -> dict:
    """{tool: install line} for each renderer tool this machine lacks."""
    mac, windows = sys.platform == "darwin", sys.platform.startswith("win")
    missing = {}
    if soffice() is None:
        missing["soffice"] = ("brew install --cask libreoffice" if mac else
                              "winget install TheDocumentFoundation.LibreOffice" if windows else
                              "sudo apt-get install -y libreoffice-impress")
    if shutil.which("pdftoppm") is None:
        missing["pdftoppm"] = ("brew install poppler" if mac else "choco install poppler" if windows else
                               "sudo apt-get install -y poppler-utils")
    return missing


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


@contextlib.contextmanager
def lo_profile(scratch: Path):
    """The LibreOffice profile one conversion runs in.

    Building a profile is most of what LibreOffice's first run of a process
    costs, so one is kept between renders under the temp directory, and a
    conversion holds an exclusive lock on it while it runs. A render that
    finds it held - a second build running beside this one - builds a private
    profile in its scratch directory instead of waiting, so parallel builds
    never share one. Yields (profile, shared)."""
    try:
        import fcntl
        root = Path(os.environ.get("PROFESSIONAL_SLIDES_LO_PROFILE") or Path(tempfile.gettempdir()) / f"professional-slides-libreoffice-{os.getuid()}")
        root.mkdir(parents=True, exist_ok=True)
        lock = open(root / ".lock", "w")
    except (ImportError, AttributeError, OSError):
        yield scratch / "profile", False
        return
    try:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            yield scratch / "profile", False
            return
        try:
            yield root / "profile", True
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)
    finally:
        lock.close()


def convert(pptx: Path, outdir: Path, profile: Path) -> Path:
    if sys.platform == "darwin":
        expose_fonts(profile)
    cmd = [soffice(), "--headless", "--norestore", f"-env:UserInstallation={profile.resolve().as_uri()}",
           "--convert-to", "pdf", "--outdir", str(outdir), str(pptx)]
    subprocess.run(cmd, check=True, capture_output=True, timeout=300)
    pdf = outdir / (pptx.stem + ".pdf")
    if not pdf.exists():
        raise RuntimeError(f"PDF conversion produced nothing for {pptx}")
    return pdf


# A slide part, and the show="0" (or "false") on its root element that hides
# it from the slide show.
SLIDE_PART = re.compile(r"ppt/slides/slide\d+\.xml")
HIDDEN_ROOT = re.compile(rb"(<(?:\w+:)?sld\b[^>]*?)\s+show=\"(?:0|false)\"")


def shown(pptx: Path, td: Path) -> Path:
    """The deck with every slide shown, for the render. LibreOffice leaves a
    hidden slide out of the PDF, which would set every later page against the
    scene slide before it; a hidden slide is still a page of the deck, so it
    is rendered, gated and reviewed in its place. The deck itself is never
    changed: a deck that hides a slide is copied into `td` (same name) with
    the flag cleared, and any other deck is rendered as it is."""
    with zipfile.ZipFile(pptx) as zin:
        cleared = {}
        for item in zin.infolist():
            if SLIDE_PART.fullmatch(item.filename):
                data = zin.read(item.filename)
                shown_data = HIDDEN_ROOT.sub(rb"\1", data, count=1)
                if shown_data != data:
                    cleared[item.filename] = shown_data
        if not cleared:
            return pptx
        td.mkdir(parents=True, exist_ok=True)
        copy = td / pptx.name
        with zipfile.ZipFile(copy, "w") as zout:
            for item in zin.infolist():
                zout.writestr(item, cleared[item.filename] if item.filename in cleared else zin.read(item.filename))
    return copy


def to_pdf(pptx: Path, td: Path) -> Path:
    """The deck as a PDF in `td`. A kept profile that fails the conversion is
    discarded and the conversion run once more in a fresh private one: a
    LibreOffice killed mid-write can leave a profile it cannot start from."""
    with lo_profile(td) as (profile, shared):
        try:
            return convert(pptx, td, profile)
        except (subprocess.CalledProcessError, RuntimeError):
            if not shared:
                raise
            shutil.rmtree(profile, ignore_errors=True)
    return convert(pptx, td, td / "fresh-profile")


def canvas_size(dpi: int) -> tuple[int, int]:
    """The PNG size for `dpi`: the gates' canvas at 96, scaled in proportion otherwise."""
    return round(CANVAS_W * dpi / 96), round(CANVAS_H * dpi / 96)


def rasterise(pdf: Path, out_dir: Path, dpi: int) -> None:
    """PDF pages to PNGs, one pdftoppm per block of pages across the machine's
    cores. A fifty-page deck took 6.7s on one core and 1.2s on eight; the
    pages are independent, so nothing is shared but the source PDF. Each page
    is scaled to exactly canvas_size(dpi)."""
    from pypdf import PdfReader
    pages = len(PdfReader(pdf).pages)
    workers = max(1, min(os.cpu_count() or 1, 8, pages))
    size = -(-pages // workers)
    blocks = [(first, min(pages, first + size - 1)) for first in range(1, pages + 1, size)]
    width, height = canvas_size(dpi)

    def run(block):
        first, last = block
        subprocess.run(["pdftoppm", "-scale-to-x", str(width), "-scale-to-y", str(height), "-png",
                        "-f", str(first), "-l", str(last), str(pdf), str(out_dir / "slide")],
                       check=True, capture_output=True, timeout=300)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(run, blocks))


def page_texts(pdf: Path) -> list:
    """Each page's text, for the export audit. pdftotext spaces words by where
    they sit on the page; pypdf joins separate text objects with nothing
    between them, so a bar's value beside the next bar's label reads back as
    "235777-9" and a label drawn correctly is reported lost. pypdf remains the
    fallback where poppler is
    missing. `-raw` keeps the content stream's order and a line-end hyphen as
    drawn: the default mode rejoins "like-for-" / "like" as "like-forlike"."""
    if shutil.which("pdftotext"):
        run = subprocess.run(["pdftotext", "-raw", "-enc", "UTF-8", str(pdf), "-"], capture_output=True, timeout=300)
        if run.returncode == 0:
            pages = run.stdout.decode("utf-8", "replace").split("\f")
            from pypdf import PdfReader
            count = len(PdfReader(pdf).pages)
            if len(pages) >= count:
                return pages[:count]
    from pypdf import PdfReader
    return [page.extract_text() or "" for page in PdfReader(pdf).pages]


def slide_files(out_dir: Path) -> list:
    """The rendered pages in page order, pdftoppm's zero-padded names (slide-01.png) normalised to slide-1.png."""
    files = []
    for p in out_dir.glob("slide-*.png"):
        target = out_dir / f"slide-{int(p.stem.split('-')[1])}.png"
        if p != target:
            p.rename(target)
        files.append(str(target))
    return sorted(files, key=lambda s: int(Path(s).stem.split("-")[1]))


def render(pptx: Path, out_dir: Path, dpi: int = 96, montage: bool = False) -> dict:
    missing = missing_tools()
    if missing:
        return {"pptx": str(pptx), "skipped": True, "missing": sorted(missing), "install": list(missing.values()),
                "message": "The deck was not rendered: {} not installed. Install with: {}. Then build again; "
                           "until then the pixel gates and the review sheets are skipped.".format(
                               " and ".join(sorted(missing)), "; ".join(missing.values()))}
    out_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        pdf = to_pdf(shown(pptx, Path(td) / "shown"), Path(td))
        saved_pdf = out_dir / (pptx.stem + ".pdf")
        shutil.copyfile(pdf, saved_pdf)
        for old in out_dir.glob("slide-*.png"):
            old.unlink()
        rasterise(pdf, out_dir, dpi)
        files = slide_files(out_dir)
    result = {"pptx": str(pptx), "pdf": str(saved_pdf), "renders": files, "dpi": dpi, "size": list(canvas_size(dpi)), "renderer": "libreoffice"}
    text_path = out_dir / "page-text.json"
    text_path.write_text(json.dumps(page_texts(saved_pdf), ensure_ascii=False))
    result["pageText"] = str(text_path)
    if montage and files:
        result.update(sheets(out_dir, files))
    return result


def sheets(out_dir: Path, files: list | None = None) -> dict:
    """The review sheets: the montage and the spreads, from the slide PNGs."""
    files = files if files is not None else slide_files(out_dir)
    if not files:
        return {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        montage = pool.submit(write_montage, files, out_dir)
        spreads = pool.submit(write_spreads, files, out_dir)
        return {"montage": montage.result(), "spreads": spreads.result()}


# A review sheet is read once and thrown away; the fast end of zlib writes it
# in a fraction of the time for a somewhat larger file.
SHEET_COMPRESSION = 1


def write_montage(files, out_dir: Path) -> str:
    """The whole deck at half size, four to a row, on one image."""
    from PIL import Image
    thumbs = []
    for f in files:
        with Image.open(f) as im:
            thumbs.append(im.convert("RGB").reduce(2))
    tw, th = thumbs[0].size
    cols = 4
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw + (cols + 1) * 12, rows * th + (rows + 1) * 12), "#DDDDDD")
    for i, im in enumerate(thumbs):
        r, c = divmod(i, cols)
        sheet.paste(im, (12 + c * (tw + 12), 12 + r * (th + 12)))
    mp = out_dir / "montage.png"
    sheet.save(mp, compress_level=SHEET_COMPRESSION)
    return str(mp)


SPREAD_COLUMNS = 2
SPREAD_ROWS = 2
SPREAD_GUTTER = 16


def write_spreads(files, out_dir: Path) -> list:
    """The pages at reading size, four to a sheet, each page's number burnt
    into its corner.

    The montage is the whole deck at half size on one image, which is how a
    fifty-page deck gets looked at and nothing gets found. A defect shows at
    reading size in groups of four, where half a line of misalignment is one
    pixel on a montage; the number lets a review cite what it saw."""
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
            im.close()
            number = Path(group[i]).stem.split("-")[1]
            draw.rectangle([x, y, x + 46, y + 22], fill="#0B1F33")
            draw.text((x + 8, y + 6), f"p{number}", fill="#FFFFFF")
        target = out_dir / f"spread-{index // per + 1}.png"
        sheet.save(target, compress_level=SHEET_COMPRESSION)
        written.append(str(target))
    return written


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("pptx", nargs="?")
    ap.add_argument("out_dir", nargs="?")
    ap.add_argument("--dpi", type=int, default=96)
    ap.add_argument("--montage", action="store_true")
    ap.add_argument("--sheets", metavar="OUT_DIR", default=None,
                    help="Write only the montage and spreads from the slide PNGs in OUT_DIR")
    a = ap.parse_args(argv)
    if a.sheets:
        print(json.dumps(sheets(Path(a.sheets))))
        return 0
    if not (a.pptx and a.out_dir):
        ap.error("the deck and the output directory are required")
    result = render(Path(a.pptx), Path(a.out_dir), a.dpi, a.montage)
    print(json.dumps(result))
    if result.get("skipped"):
        print(result["message"], file=sys.stderr)
        return MISSING_EXIT
    return 0


if __name__ == "__main__":
    sys.exit(main())
