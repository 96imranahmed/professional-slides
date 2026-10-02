#!/usr/bin/env python3
"""How strong decks shape a page's words, not just how many there are.

    PS_CALIBRATION_CORPUS=/path/to/set python3 evals/calibration/measure_text_form.py [--samples FILE]

The text contract measures volume: planned body words against a matched
reference median. A deck can pass it with one 200-word paragraph per page, and
one did - forty pages of a single prose block, which reads as an essay with
pictures. Strong decks do not look like that.

This measures the shape: how many separate text blocks a page carries and how
long each one is. A "block" is a run of consecutive non-empty lines separated
from its neighbours by a blank line, which is what pdftotext -layout leaves
between bullets and paragraphs. Title and source/note lines are excluded on the
same rule the word count uses.

The pages measured are listed in the set's root, in `text-form-pages.json`:
{"pages": [{"file": "<path relative to the root>", "pages": [21, 22, ...]}]} -
analytic pages (chart with commentary, comparison tables, developed synthesis),
never covers, dividers or contents.

The summary printed is the shape of `plan.textForm` in runtime/weight.json,
numbers only. --samples writes the per-page measurements, which name documents,
to a file of your choosing; keep it outside the repository.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics as st
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from corpus import corpus_root  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skills" / "professional-slides" / "runtime" / "gates"))
from text_stats import printed_words  # noqa: E402

SOURCE_LINE = re.compile(r"^\s*(source|sources|note|notes|footnote)\b[:\s]", re.I)
PAGE_NUMBER = re.compile(r"^\s*\d{1,3}\s*$")


def words(line: str) -> int:
    """Printed words, as the density profile counts a rendered page (text_stats.py)."""
    return len(printed_words(line))


def block_sizes(text: str) -> list[int]:
    """Words per text block in one page of pdftotext -layout output."""
    seen_title = False
    kept: list[str] = []
    for line in text.split("\n"):
        if not line.strip():
            kept.append("")
            continue
        if PAGE_NUMBER.match(line) or SOURCE_LINE.match(line):
            continue
        if not seen_title:
            seen_title = True
            continue
        kept.append(line)
    out, run = [], 0
    for line in kept:
        if line.strip():
            run += words(line)
        elif run:
            out.append(run)
            run = 0
    if run:
        out.append(run)
    # A block of one or two words is a label or an axis tick, not a text block.
    return [n for n in out if n >= 3]


def page_text(pdf: Path, page: int) -> str:
    return subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(pdf), "-"],
                          capture_output=True, text=True).stdout


def summarise(per_page: list[dict]) -> dict:
    counts = [p["blocks"] for p in per_page]
    per_block = [p["wordsPerBlock"] for p in per_page]
    longest = [p["longestBlock"] for p in per_page]
    quart = lambda values, at: round(st.quantiles(values, n=4, method="inclusive")[at], 1)  # noqa: E731
    return {
        "pagesMeasured": len(per_page),
        "blocksPerPage": {"median": st.median(counts), "q1": quart(counts, 0), "q3": quart(counts, 2),
                          "min": min(counts), "max": max(counts)},
        "wordsPerBlock": {"median": st.median(per_block), "q1": quart(per_block, 0), "q3": quart(per_block, 2)},
        "longestBlock": {"median": st.median(longest), "q3": quart(longest, 2), "max": max(longest)},
        "singleBlockPages": round(sum(1 for c in counts if c == 1) / len(counts), 3),
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--samples", type=Path, default=None, help="write per-page measurements here (names documents)")
    args = parser.parse_args(argv)
    root = corpus_root()
    listing = json.loads((root / "text-form-pages.json").read_text(encoding="utf-8"))
    per_page = []
    for entry in listing["pages"]:
        pdf = root / entry["file"]
        if not pdf.is_file():
            print(f"missing: {entry['file']}", file=sys.stderr)
            return 1
        for page in entry["pages"]:
            sizes = block_sizes(page_text(pdf, page))
            if sizes:
                per_page.append({"file": entry["file"], "page": page, "blocks": len(sizes), "bodyWords": sum(sizes),
                                 "wordsPerBlock": round(sum(sizes) / len(sizes), 1), "longestBlock": max(sizes)})
    if not per_page:
        print("no page produced a text block", file=sys.stderr)
        return 1
    if args.samples:
        args.samples.write_text(json.dumps(per_page, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(summarise(per_page), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
