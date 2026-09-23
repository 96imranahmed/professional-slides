"""How client decks shape a page's words, not just how many there are.

The text contract measures volume: planned body words against a matched
reference median. A deck can pass it with one 200-word paragraph per page, and
one did - forty pages of a single prose block, which reads as an essay with
pictures. The corpus does not look like that.

This measures the shape: how many separate text blocks a page carries and how
long each one is. A "block" is a run of consecutive non-empty lines separated
from its neighbours by a blank line, which is what pdftotext -layout leaves
between bullets and paragraphs. Title and source/note lines are excluded on the
same rule the word count uses.

    python3 evals/corpus/measure_text_form.py > evals/corpus/text-form.json

The result feeds `plan.textForm` in weight.json, so the gate compares a deck
with measured work rather than with a number somebody chose.
"""
from __future__ import annotations

import json
import re
import statistics as st
import subprocess
import sys
from pathlib import Path

CORPUS = Path("/Users/imran/Desktop/Side Projects/professional-slides-corpus")
SOURCE_LINE = re.compile(r"^\s*(source|sources|note|notes|footnote)\b[:\s]", re.I)
PAGE_NUMBER = re.compile(r"^\s*\d{1,3}\s*$")

# Analytic pages from client-project decks: chart-with-commentary, comparison
# tables and developed synthesis. Covers, dividers and contents are excluded
# because their shape is not what this measures.
PAGES = [
    ("real-client-decks/l-e-k-consulting/international-comparison-of-australias-freight-and-supply-chain-performance.pdf",
     [21, 22, 23, 24, 25, 26, 31, 32, 36]),
    ("real-client-decks/bain-and-company/bain-syracuse-university-diagnostic-report-2014.pdf",
     [10, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]),
    ("real-client-decks/boston-consulting-group/bcg-reshaping-nycha-support-functions-bcg-engagement-key-findings-and-recommendations-2012.pdf",
     [23, 24, 25, 26, 34, 35, 36]),
    ("real-client-decks/oliver-wyman/assessing-the-impact-of-big-tech-on-venture-investment.pdf",
     [22, 23]),
    ("real-client-decks/mckinsey-and-company/mckinsey-purdue-high-impact-interventions-to-rapidly-address-market-access-challenges-2017.pdf",
     [25, 26, 27, 28, 30, 31]),
]


def words(line: str) -> int:
    return len([w for w in re.split(r"\s+", line.strip()) if re.search(r"[A-Za-z0-9]", w)])


def blocks(pdf: Path, page: int) -> list[int]:
    """Words per text block on the page, excluding title and source lines."""
    raw = subprocess.run(
        ["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(pdf), "-"],
        capture_output=True, text=True).stdout
    lines = raw.split("\n")
    # Drop the title (first non-empty line), page numbers and source lines.
    seen_title = False
    kept: list[str] = []
    for line in lines:
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


def main() -> int:
    per_page = []
    for relative, pages in PAGES:
        pdf = CORPUS / relative
        if not pdf.is_file():
            print(f"missing: {relative}", file=sys.stderr)
            return 1
        for page in pages:
            sizes = blocks(pdf, page)
            if not sizes:
                continue
            per_page.append({
                "reference": pdf.name, "page": page,
                "blocks": len(sizes), "bodyWords": sum(sizes),
                "wordsPerBlock": round(sum(sizes) / len(sizes), 1),
                "longestBlock": max(sizes),
            })
    counts = [p["blocks"] for p in per_page]
    per_block = [p["wordsPerBlock"] for p in per_page]
    longest = [p["longestBlock"] for p in per_page]
    quart = lambda values, at: round(st.quantiles(values, n=4, method="inclusive")[at], 1)
    summary = {
        "$comment": (
            "How client decks shape a page's words. Measured over analytic pages of "
            f"{len(PAGES)} client-project decks with pdftotext -layout; a block is a run of "
            "consecutive non-empty lines, title and source lines excluded, blocks under three "
            "words dropped as labels."
        ),
        "pages": len(per_page),
        "blocksPerPage": {"median": st.median(counts), "q1": quart(counts, 0), "q3": quart(counts, 2),
                          "min": min(counts), "max": max(counts)},
        "wordsPerBlock": {"median": st.median(per_block), "q1": quart(per_block, 0), "q3": quart(per_block, 2)},
        "longestBlock": {"median": st.median(longest), "q3": quart(longest, 2), "max": max(longest)},
        "singleBlockPages": sum(1 for c in counts if c == 1),
        "samples": per_page,
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
