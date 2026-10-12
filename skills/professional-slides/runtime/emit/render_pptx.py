#!/usr/bin/env python3
"""Saved-slide renderer: PPTX -> PDF (PowerPoint or LibreOffice) -> PNG per slide.

Usage: render_pptx.py deck.pptx out_dir [--dpi 96] [--montage] [--renderer auto|powerpoint|libreoffice]
       render_pptx.py --sheets out_dir
Writes out_dir/slide-N.png (N from 1), and with --montage the review sheets
(out_dir/montage.png and out_dir/spread-N.png). --sheets writes only the
sheets, from the slide PNGs already in out_dir, so a build can draw them while
its gates read the pages. Prints JSON with the list of files. This is the only
renderer; desktop PowerPoint is preferred on macOS and Windows, with LibreOffice
as the fallback and the Linux exporter. Set PROFESSIONAL_SLIDES_RENDERER to pin
a backend for builds and the doctor; explicit selections never fall back.

out_dir/render-cache.json keys each slide's render on the parts it is drawn
from (slide_keys) and names the renderer that drew it. Rendered again into the
same out_dir by the same renderer, only the slides with a new key are exported
again, as a sub-deck of the same file; every PNG and PDF page of an unchanged
slide is the last render's. The PDF, the PNGs and page-text.json are always the
whole deck, in its order.

Exit 0 when the deck rendered, 3 when the selected renderer or poppler is not installed
(the JSON then carries `skipped: true`, what is missing and how to install
it, so a build can finish unrendered and say so), 1 on a crash.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from renderer_backends import CHOICES, discover, powerpoint_pdf, soffice

# The canvas the gates measure (gates/ink.py): a 13.333 x 7.5 in slide at 96
# dpi. pdftoppm rounds the page to 1281 px wide at `-r 96`, and every gate
# then resampled every page back; the renders are scaled to the canvas instead.
CANVAS_W, CANVAS_H = 1280, 720
MISSING_EXIT = 3
def missing_tools(renderer: str | None = None) -> dict:
    """The same discovery and install advice used by the doctor's probe."""
    return discover(renderer)["missing"]


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


# Each slide's render is kept by what it is drawn from, so a rebuild after copy
# fixes renders only the slides that changed. On ba4 a fix round touched a
# handful of pages and every build sent all 102 slides through LibreOffice.
RENDER_CACHE = "render-cache.json"
RENDER_CACHE_SCHEMA = "professional-slides.render-cache/v1"
# The parts every slide is drawn through - the masters, layouts and theme, the
# embedded fonts, the table styles and the slide size: one changed, every
# slide renders again.
DESIGN_PART = re.compile(r"ppt/(slideMasters|slideLayouts|theme|fonts)/[^/]+|ppt/(presentation|presProps|tableStyles)\.xml")
SLIDE_LIST = re.compile(rb"<(?:\w+:)?sldIdLst\b.*?</(?:\w+:)?sldIdLst>|<(?:\w+:)?sldIdLst\b[^>]*/>", re.S)
REL = re.compile(rb"<Relationship\b[^>]*>")
ATTR = re.compile(rb'(\w+)="([^"]*)"')
# Past this share of changed slides a sub-deck saves too little to be worth a second document.
SUBDECK_SHARE_MAX = 0.5


def rels_of(z: zipfile.ZipFile, names: set, part: str) -> list:
    """[(Id, Type, target part or None, TargetMode target)] of `part`'s relationships, in Id order."""
    folder, base = part.rsplit("/", 1)
    rels = f"{folder}/_rels/{base}.rels"
    if rels not in names:
        return []
    out = []
    for tag in REL.findall(z.read(rels)):
        attrs = {k.decode(): v.decode() for k, v in ATTR.findall(tag)}
        target = attrs.get("Target", "")
        if attrs.get("TargetMode") == "External":
            out.append((attrs.get("Id", ""), attrs.get("Type", ""), None, target))
            continue
        resolved = os.path.normpath(target.lstrip("/") if target.startswith("/") else f"{folder}/{target}").replace(os.sep, "/")
        out.append((attrs.get("Id", ""), attrs.get("Type", ""), resolved, None))
    return sorted(out)


def slide_parts(z: zipfile.ZipFile, names: set) -> list:
    """The deck's slide parts in show order (presentation.xml's sldIdLst)."""
    by_id = {rid: target for rid, _, target, _ in rels_of(z, names, "ppt/presentation.xml")}
    listed = SLIDE_LIST.search(z.read("ppt/presentation.xml"))
    ids = re.findall(rb'r:id="([^"]+)"', listed.group(0)) if listed else []
    return [by_id[rid.decode()] for rid in ids if rid.decode() in by_id]


def slide_keys(pptx: Path, dpi: int) -> list:
    """One key per slide, in show order: the slide's own XML, the bytes of every
    part it links to (its pictures, charts and their workbooks, followed down),
    the layout it names, the design parts every slide shares and the canvas.
    It is read off the deck LibreOffice is given rather than the scene, so an
    emitter change keys as surely as a copy change; a part's name is not in it
    where its bytes are, so a picture renumbered by an earlier slide's change
    does not count as a change to this one."""
    with zipfile.ZipFile(pptx) as z:
        names = set(z.namelist())
        design = hashlib.sha256(f"{RENDER_CACHE_SCHEMA}|{dpi}".encode())
        for name in sorted(n for n in names if DESIGN_PART.fullmatch(n)):
            data = z.read(name)
            design.update(name.encode() + b"\0" + (SLIDE_LIST.sub(b"", data) if name == "ppt/presentation.xml" else data))
        shared = design.hexdigest()
        memo = {}

        def part_key(part, trail=()):
            if part in memo:
                return memo[part]
            h = hashlib.sha256(z.read(part) if part in names else b"missing")
            for rid, kind, target, external in rels_of(z, names, part):
                if kind.endswith("/notesSlide") or kind.endswith("/slide"):
                    continue
                if target is None:
                    h.update(f"|{rid}|{kind}|{external}".encode())
                elif DESIGN_PART.fullmatch(target) or target in trail:
                    h.update(f"|{rid}|{kind}|{target}".encode())
                else:
                    h.update(f"|{rid}|{kind}|".encode() + part_key(target, trail + (part,)).encode())
            memo[part] = h.hexdigest()
            return memo[part]

        return [hashlib.sha256(f"{shared}|{part_key(part)}".encode()).hexdigest()[:32] for part in slide_parts(z, names)]


def subdeck(pptx: Path, keep: list, out: Path) -> Path:
    """`pptx` with only the slides at the 0-based positions `keep` in its show:
    the slide list in presentation.xml cut, every other part as it is, so each
    kept slide is drawn through the same masters, layouts, theme and fonts."""
    with zipfile.ZipFile(pptx) as zin:
        names = set(zin.namelist())
        rid_of = {target: rid for rid, _, target, _ in rels_of(zin, names, "ppt/presentation.xml")}
        wanted = {rid_of[part] for i, part in enumerate(slide_parts(zin, names)) if i in set(keep)}
        presentation = zin.read("ppt/presentation.xml")

        def cut(match):
            whole = match.group(0)
            head = re.match(rb"<((?:\w+:)?sldIdLst)\b[^>]*>", whole)
            if whole.endswith(b"/>") and head.group(0) == whole:
                return whole
            entries = re.findall(rb"<(?:\w+:)?sldId\b[^>]*/>", whole)
            kept = [e for e in entries if re.search(rb'r:id="([^"]+)"', e).group(1).decode() in wanted]
            return head.group(0) + b"".join(kept) + b"</" + head.group(1) + b">"
        cut_xml = SLIDE_LIST.sub(cut, presentation, count=1)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                zout.writestr(item, cut_xml if item.filename == "ppt/presentation.xml" else zin.read(item.filename))
    return out


def held_renders(out_dir: Path, dpi: int, renderer: str) -> dict:
    """{key: (png, pdf, page index)} the last render in `out_dir` left, where its PDF and every PNG are still there and
    `renderer` drew them: a page PowerPoint drew is not spliced beside one LibreOffice drew (a cache from before the
    renderer was named was LibreOffice's)."""
    try:
        cache = json.loads((out_dir / RENDER_CACHE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(cache, dict) or cache.get("schema") != RENDER_CACHE_SCHEMA or cache.get("dpi") != dpi or cache.get("renderer", "libreoffice") != renderer:
        return {}
    pdf = out_dir / str(cache.get("pdf", ""))
    keys = cache.get("keys") or []
    if not pdf.is_file() or not all((out_dir / f"slide-{i + 1}.png").is_file() for i in range(len(keys))):
        return {}
    return {key: (out_dir / f"slide-{i + 1}.png", pdf, i) for i, key in enumerate(keys) if isinstance(key, str)}


def render_changed(deck: Path, keys: list, held: dict, out_dir: Path, saved_pdf: Path, dpi: int, td: Path, export) -> dict | None:
    """Render only the slides whose key the last render does not hold, as a
    sub-deck of the same file, and splice: each PNG and PDF page of an unchanged
    slide is the last render's, by its key. None where a whole render is the
    cheaper one (most slides changed, or nothing is held)."""
    changed = [i for i, key in enumerate(keys) if key not in held]
    if not held or len(changed) > SUBDECK_SHARE_MAX * len(keys):
        return None
    from pypdf import PdfReader, PdfWriter
    fresh_dir = td / "fresh"
    fresh_dir.mkdir()
    fresh_pdf = None
    if changed:
        fresh_pdf = export(subdeck(deck, changed, td / f"changed-{deck.name}"), td)
        rasterise(fresh_pdf, fresh_dir, dpi)
        slide_files(fresh_dir)
    stage = td / "stage"
    stage.mkdir()
    writer, readers = PdfWriter(), {}
    reader = lambda path: readers.setdefault(path, PdfReader(path))  # noqa: E731
    at = {i: n for n, i in enumerate(changed)}
    for i, key in enumerate(keys):
        if i in at:
            shutil.copyfile(fresh_dir / f"slide-{at[i] + 1}.png", stage / f"slide-{i + 1}.png")
            writer.add_page(reader(fresh_pdf).pages[at[i]])
        else:
            png, pdf, page = held[key]
            shutil.copyfile(png, stage / f"slide-{i + 1}.png")
            writer.add_page(reader(pdf).pages[page])
    spliced = td / "spliced.pdf"
    with open(spliced, "wb") as handle:
        writer.write(handle)
    for old in out_dir.glob("slide-*.png"):
        old.unlink()
    for png in stage.glob("slide-*.png"):
        shutil.move(str(png), out_dir / png.name)
    shutil.copyfile(spliced, saved_pdf)
    return {"rendered": len(changed), "reused": len(keys) - len(changed)}


def export_pdf(pptx: Path, directory: Path, discovery: dict) -> tuple[Path, str, list]:
    """Try the selected exporters in order; validate page coverage before use.

    Only auto may fall back. Every failed attempt has its own output folder
    and is recorded, so a stale or incomplete PDF never passes the gates.
    """
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError
    with zipfile.ZipFile(pptx) as package:
        root = ET.fromstring(package.read("ppt/presentation.xml"))
        count = len(root.findall("./{http://schemas.openxmlformats.org/presentationml/2006/main}sldIdLst/*"))
    warnings = []
    for backend in discovery["available"]:
        attempt = directory / backend["id"]
        attempt.mkdir(parents=True, exist_ok=True)
        try:
            pdf = powerpoint_pdf(pptx, attempt, backend) if backend["id"] == "powerpoint" else to_pdf(pptx, attempt)
            actual = len(PdfReader(pdf).pages)
            if actual != count:
                raise RuntimeError(f"PDF contains {actual} pages for {count} slides")
            return pdf, backend["id"], warnings
        except (OSError, RuntimeError, subprocess.SubprocessError, PdfReadError) as error:
            warnings.append({"renderer": backend["id"], "message": str(error)})
            if discovery["requested"] != "auto":
                raise
    raise RuntimeError("All available PDF exporters failed: " + "; ".join(f"{w['renderer']}: {w['message']}" for w in warnings))


def render(pptx: Path, out_dir: Path, dpi: int = 96, montage: bool = False, incremental: bool = True, renderer: str | None = None) -> dict:
    missing = missing_tools(renderer)
    if missing:
        return {"pptx": str(pptx), "skipped": True, "missing": sorted(missing), "install": list(missing.values()),
                "message": "The deck was not rendered: {} not installed. Install with: {}. Then build again; "
                           "until then the pixel gates and the review sheets are skipped.".format(
                               " and ".join(sorted(missing)), "; ".join(missing.values()))}
    discovery = discover(renderer)
    out_dir.mkdir(parents=True, exist_ok=True)
    saved_pdf = out_dir / (pptx.stem + ".pdf")
    with tempfile.TemporaryDirectory() as td:
        deck = shown(pptx, Path(td) / "shown")
        keys = slide_keys(deck, dpi)
        first, warnings, spliced = discovery["available"][0]["id"], [], None
        if incremental:
            # The changed slides go to the renderer that drew the held ones; where it fails, the whole deck is
            # rendered below as discovery allows (an explicit renderer's failure stands).
            pinned = {**discovery, "available": discovery["available"][:1]}
            (Path(td) / "changed").mkdir()
            try:
                spliced = render_changed(deck, keys, held_renders(out_dir, dpi, first), out_dir, saved_pdf, dpi, Path(td) / "changed",
                                         lambda sub, directory: export_pdf(sub, directory, pinned)[0])
            except (OSError, RuntimeError, subprocess.SubprocessError) as error:
                if discovery["requested"] != "auto":
                    raise
                warnings.append({"renderer": first, "message": str(error)})
        used = first
        if spliced is None:
            pdf, used, failed = export_pdf(deck, Path(td) / "whole", discovery)
            warnings += failed
            shutil.copyfile(pdf, saved_pdf)
            for old in out_dir.glob("slide-*.png"):
                old.unlink()
            rasterise(pdf, out_dir, dpi)
        files = slide_files(out_dir)
    (out_dir / RENDER_CACHE).write_text(json.dumps({"schema": RENDER_CACHE_SCHEMA, "dpi": dpi, "renderer": used, "pdf": saved_pdf.name, "keys": keys}))
    result = {"pptx": str(pptx), "pdf": str(saved_pdf), "renders": files, "dpi": dpi, "size": list(canvas_size(dpi)), "renderer": used,
              "rendererRequested": discovery["requested"], "rendererWarnings": warnings, "slides": spliced or {"rendered": len(keys), "reused": 0}}
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
    ap.add_argument("--renderer", choices=CHOICES, default=None)
    ap.add_argument("--sheets", metavar="OUT_DIR", default=None,
                    help="Write only the montage and spreads from the slide PNGs in OUT_DIR")
    a = ap.parse_args(argv)
    if a.sheets:
        print(json.dumps(sheets(Path(a.sheets))))
        return 0
    if not (a.pptx and a.out_dir):
        ap.error("the deck and the output directory are required")
    result = render(Path(a.pptx), Path(a.out_dir), a.dpi, montage=a.montage, renderer=a.renderer)
    print(json.dumps(result))
    if result.get("skipped"):
        print(result["message"], file=sys.stderr)
        return MISSING_EXIT
    return 0


if __name__ == "__main__":
    sys.exit(main())
