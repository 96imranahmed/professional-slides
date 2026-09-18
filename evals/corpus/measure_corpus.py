#!/usr/bin/env python3
"""Measure a corpus of published client decks, and write what it measures.

Every threshold in `runtime/weight.json` used to be calibrated on the four decks
under `examples/`, which this repository also wrote. That is a circle: the floors
said a page should look like the pages the composer already made. This script
breaks it by pointing the same instruments at 670 published PDFs from twelve
firms, so a floor can be argued from a percentile of real pages instead.

Three passes, deliberately unequal in cost:

  words   pdftotext -bbox over every PDF. Word counts, ten y-bands, numeric
          tokens (`NUMERIC_TOKEN` copied verbatim from page_gates.py, so a
          corpus count and a gate count mean the same thing). Minutes.
  pixels  pdftoppm to the same 1280x720 canvas page_gates.py reads, with the
          same luminance cuts, over a sample. Answers the only question that
          matters about a geometric floor: what share of published pages fail
          it. Tens of minutes.
  sample  extract the sampled pages as images for a vision pass. Family, craft
          and title judgements cannot be read off geometry; `rubric.md` has the
          questions and `page-judgements.json` the answers.

Usage:
    python3 measure_corpus.py words  <corpus-root> <out.jsonl>
    python3 measure_corpus.py pixels <corpus-root> <words.jsonl> <out.jsonl> [seconds]
    python3 measure_corpus.py sample <corpus-root> <pixels.jsonl> <out-dir>

The corpus root holds `index.csv` (listing_id, firm, category, status, format,
pages, local_path, duplicate) and a `documents/` tree. Rows that did not
download, are not PDFs, or are flagged duplicates are skipped everywhere.
"""
from __future__ import annotations

import csv
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# Copied from runtime/gates/page_gates.py. If that regex moves, move this one.
NUMERIC_TOKEN = re.compile(r"^[-−+(]?[$€£]?\d[\d,.]*[%×xkmbn]*\)?$", re.I)
CANVAS_W, CANVAS_H = 1280, 720
INK_LUMINANCE, SURFACE_LUMINANCE, FOOTER_TOP, BODY_TOP = 235, 250, 660, 140

PAGE_RE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
WORD_RE = re.compile(
    r'<word xMin="([\d.eE+-]+)" yMin="([\d.eE+-]+)" '
    r'xMax="([\d.eE+-]+)" yMax="([\d.eE+-]+)">(.*?)</word>', re.S)
ENTITIES = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'"}

# Prose reports and market overviews are excluded from every derived figure, per
# the admission rule in evals/client-deck-benchmark.md: presentation-format work
# for an identifiable client or decision, not general industry publications.
REPORT_CATEGORIES = {
    "Industry reports/market overviews",
    "McKinsey Global Institute reports (McKinsey’s business and economics research arm)",
}


def unescape(text):
    for key, value in ENTITIES.items():
        text = text.replace(key, value)
    return text


def index_rows(root):
    with open(Path(root) / "index.csv", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            if row["status"] != "downloaded" or row["format"] != "pdf":
                continue
            if row["duplicate"] == "yes":
                continue
            yield row


def is_deck(record):
    """A landscape presentation, not a portrait document."""
    pages = record["pages"]
    if not pages:
        return False
    landscape = sum(1 for p in pages if p["w"] > p["h"])
    return landscape / len(pages) >= 0.7


def analytical(record):
    """The pages a floor should be argued from: covers, dividers, back matter and
    portrait pages excluded, exactly as runtime/weight.json says its sample was."""
    if not is_deck(record) or record["category"] in REPORT_CATEGORIES:
        return []
    last = len(record["pages"])
    out = []
    for page in record["pages"]:
        if page["w"] <= page["h"] or page["p"] in (1, last) or page["words"] < 20:
            continue
        if sum(page["bands"][:2]) == page["words"]:
            continue            # a title with nothing under it is a divider
        out.append(page)
    return out


# ---------------------------------------------------------------- words


def measure_words(pdf, timeout=45):
    try:
        xml = subprocess.run(["pdftotext", "-bbox", str(pdf), "-"], capture_output=True,
                             text=True, timeout=timeout, errors="replace").stdout
    except subprocess.TimeoutExpired:
        return None
    pages = []
    for n, match in enumerate(PAGE_RE.finditer(xml), start=1):
        width, height = float(match.group(1)), float(match.group(2))
        if not width or not height:
            continue
        bands, numeric_bands = [0] * 10, [0] * 10
        words = numeric = chars = 0
        for word in WORD_RE.finditer(match.group(3)):
            text = unescape(word.group(5)).strip()
            if not text:
                continue
            words += 1
            chars += len(text)
            middle = (float(word.group(2)) + float(word.group(4))) / 2.0 / height
            band = min(9, max(0, int(middle * 10)))
            bands[band] += 1
            if NUMERIC_TOKEN.match(text):
                numeric += 1
                numeric_bands[band] += 1
        pages.append({"p": n, "w": round(width, 1), "h": round(height, 1), "words": words,
                      "numeric": numeric, "chars": chars, "bands": bands,
                      "numericBands": numeric_bands})
    return pages


def run_words(root, out):
    out = Path(out)
    done = set()
    if out.exists():
        for line in out.open(encoding="utf-8"):
            try:
                done.add(json.loads(line)["doc"])
            except ValueError:
                pass
    todo = [r for r in index_rows(root) if r["local_path"] not in done]
    with out.open("a", encoding="utf-8") as handle:
        for i, row in enumerate(todo, start=1):
            pdf = Path(root) / row["local_path"]
            if not pdf.exists():
                continue
            pages = measure_words(pdf)
            handle.write(json.dumps({
                "doc": row["local_path"], "firm": row["firm"], "category": row["category"],
                "title": row["title"], "declaredPages": row["pages"],
                "pages": pages or [], "timedOut": pages is None}) + "\n")
            handle.flush()
            if i % 25 == 0:
                print(f"{i}/{len(todo)}", flush=True)
    print("words: done", len(todo), flush=True)


# ---------------------------------------------------------------- pixels


def measure_pixels(pdf, page, tmp):
    """The page as page_gates.py would see it: ink, dead band, internal void,
    column void, and the tinted-surface share the void gates read."""
    import numpy as np
    from PIL import Image

    prefix = str(Path(tmp) / "pg")
    subprocess.run(["pdftoppm", "-png", "-r", "0", "-f", str(page), "-l", str(page),
                    "-scale-to-x", str(CANVAS_W), "-scale-to-y", str(CANVAS_H),
                    str(pdf), prefix], capture_output=True, timeout=60)
    rendered = sorted(Path(tmp).glob("pg*.png"))
    if not rendered:
        return None
    with Image.open(rendered[0]) as image:
        grey = image.convert("L")
        if grey.size != (CANVAS_W, CANVAS_H):
            grey = grey.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
        array = np.asarray(grey)
    for path in rendered:
        path.unlink()

    ink = array < INK_LUMINANCE
    occupied = array < SURFACE_LUMINANCE
    occupied_rows = occupied.sum(axis=1)

    last = None
    for y in range(FOOTER_TOP - 1, -1, -1):
        if occupied_rows[y] > 2:
            last = y
            break
    dead = 1.0 if last is None else (FOOTER_TOP - 1 - last) / float(CANVAS_H)

    longest = run = 0
    for y in range(BODY_TOP, (last if last is not None else BODY_TOP) + 1):
        if occupied_rows[y] > 2:
            run = 0
        else:
            run += 1
            longest = max(longest, run)

    column = occupied[BODY_TOP:FOOTER_TOP, int(CANVAS_W * 0.60):]
    filled = [y for y in range(column.shape[0]) if column[y].sum() > 2]
    column_void = 1.0 if not filled else (column.shape[0] - 1 - filled[-1]) / float(CANVAS_H)

    return {"ink": round(float(ink[:FOOTER_TOP].sum()) / (CANVAS_W * CANVAS_H), 4),
            "surface": round(float(occupied[:FOOTER_TOP].sum()) / (CANVAS_W * CANVAS_H), 4),
            "deadBand": round(dead, 4),
            "internalVoid": round(longest / float(CANVAS_H), 4),
            "columnVoid": round(column_void, 4)}


def pixel_sample(words_path, per_deck=5, seed=20260918):
    rng = random.Random(seed)
    picked = []
    for line in Path(words_path).open(encoding="utf-8"):
        record = json.loads(line)
        pages = analytical(record)
        if not pages:
            continue
        for page in rng.sample(pages, min(per_deck, len(pages))):
            picked.append({"doc": record["doc"], "firm": record["firm"], "page": page["p"],
                           "words": page["words"], "numeric": page["numeric"],
                           "bands": page["bands"]})
    rng.shuffle(picked)
    return picked


def run_pixels(root, words_path, out, budget=140):
    out = Path(out)
    picked = pixel_sample(words_path)
    done = set()
    if out.exists():
        for line in out.open(encoding="utf-8"):
            try:
                record = json.loads(line)
                done.add((record["doc"], record["page"]))
            except ValueError:
                pass
    started = time.time()
    count = 0
    with out.open("a", encoding="utf-8") as handle, tempfile.TemporaryDirectory() as tmp:
        for record in picked:
            if (record["doc"], record["page"]) in done:
                continue
            if time.time() - started > budget:
                break
            try:
                measured = measure_pixels(Path(root) / record["doc"], record["page"], tmp)
            except Exception:                                   # a PDF the renderer refuses
                measured = None
            handle.write(json.dumps(dict(record, **(measured or {"failed": True}))) + "\n")
            handle.flush()
            count += 1
    print(f"pixels: {count} this run, {len(done) + count} of {len(picked)}", flush=True)


# ---------------------------------------------------------------- sample


def run_sample(root, pixels_path, out_dir, want=264, seed=4242):
    """One page per deck, rendered for the vision pass. Written as a single PDF
    because the images usually have to cross a machine boundary to be looked at."""
    from PIL import Image

    from collections import defaultdict
    by_deck = defaultdict(list)
    for line in Path(pixels_path).open(encoding="utf-8"):
        record = json.loads(line)
        if not record.get("failed"):
            by_deck[record["doc"]].append(record)
    rng = random.Random(seed)
    decks = sorted(by_deck)
    rng.shuffle(decks)
    picked = [rng.choice(by_deck[d]) for d in decks][:want]
    picked.sort(key=lambda r: (r["firm"], r["doc"], r["page"]))
    for i, record in enumerate(picked, start=1):
        record["sheet"] = i

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "sample.json").write_text(json.dumps(picked, indent=1), encoding="utf-8")
    images = []
    with tempfile.TemporaryDirectory() as tmp:
        for record in picked:
            prefix = str(Path(tmp) / f"s{record['sheet']:03d}")
            subprocess.run(["pdftoppm", "-png", "-f", str(record["page"]),
                            "-l", str(record["page"]), "-scale-to-x", "1600",
                            "-scale-to-y", "-1", str(Path(root) / record["doc"]), prefix],
                           capture_output=True, timeout=60)
            rendered = sorted(Path(tmp).glob(f"s{record['sheet']:03d}*.png"))
            if rendered:
                images.append(Image.open(rendered[0]).convert("RGB"))
        if images:
            images[0].save(out_dir / "sample.pdf", save_all=True,
                           append_images=images[1:], quality=80, optimize=True)
    print(f"sample: {len(images)} pages -> {out_dir / 'sample.pdf'}", flush=True)


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    command = argv[1]
    if command == "words":
        run_words(argv[2], argv[3])
    elif command == "pixels":
        run_pixels(argv[2], argv[3], argv[4], float(argv[5]) if len(argv) > 5 else 140)
    elif command == "sample":
        run_sample(argv[2], argv[3], argv[4])
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
