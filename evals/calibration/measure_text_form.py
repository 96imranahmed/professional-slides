#!/usr/bin/env python3
"""How strong decks shape a page's words, not just how many there are.

    PS_CALIBRATION_CORPUS=/path/to/set python3 evals/calibration/measure_text_form.py [--samples FILE]

The text contract measures volume: planned body words against a matched
reference median. A deck can pass it with one 200-word paragraph per page, and
one did - forty pages of a single prose block, which reads as an essay with
pictures. Strong decks do not look like that.

This measures the shape: how many separate text blocks a page carries and how
long each one is. A block is read by column, by the reading the density
profile applies to a rendered deck (runtime/gates/text_blocks.py): a run of
lines in one column with no gap between them. Read as full-width rows, two
columns that share rows merged into one block, so the band moved with where a
commentary column sat. Title, page-number and source/note lines are excluded
on the rule the word count uses.

The pages measured are listed in the set's root, in `text-form-pages.json`:
{"pages": [{"file": "<path relative to the root>", "pages": [21, 22, ...]}]}.
Of those, the band is taken over the pages that carry prose: sixty words or
more, at least one block of fifteen (density_profile.py prose_blocks, the
rule a deck's own prose pages are chosen by), where a page of labels alone is not.

The summary printed is the shape of `plan.textForm` in runtime/weight.json,
numbers only. --samples writes the per-page measurements, which name documents,
to a file of your choosing; keep it outside the repository.
"""
from __future__ import annotations

import argparse
import json
import statistics as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from corpus import corpus_root  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skills" / "professional-slides" / "runtime" / "gates"))

from density_profile import page_blocks, prose_blocks  # noqa: E402
from text_blocks import pdf_lines  # noqa: E402


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
        "longestBlock": {"median": st.median(longest), "q3": quart(longest, 2), "p90": round(st.quantiles(longest, n=10, method="inclusive")[8]), "max": max(longest)},
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
            # Read by column, the page's first line (its title) dropped.
            sizes = page_blocks(pdf_lines(pdf, page, page)[0])
            if prose_blocks(sizes):
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
