#!/usr/bin/env python3
"""Rebuild the reading-task targets the text contract compares pages with.

    PS_CALIBRATION_CORPUS=/path/to/set python3 evals/calibration/build_reading_tasks.py [--out FILE]

Each page's word floor is the lower quartile of the calibration pages that share
its reading task. Every page the vision pass judged is used - not a selection,
so nobody picks sparse references to lower a floor, or dense ones to raise it -
keyed by exhibit family and by whether the page carries a commentary column.
Pages whose text does not extract are left out rather than counted as zero.

Inputs, in the set's root:
  page-judgements.json  the vision pass (rubric.md): a list of
                        {"page": key, "kind", "family", "hasCommentary"}
  page-measures.json    pdftotext -layout counts: a list of rows
                        [key, totalWords, _, bodyWords, ...]

The output is what runtime/reading-tasks.json holds: per task the quartiles of
body words and the median of total words, numbers only. Nothing in it names a
document. Without --out it prints to stdout; review the diff before writing it
over the runtime's copy.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from corpus import corpus_root  # noqa: E402

TASKS = {
    ("chart", False): "chart-led", ("chart", True): "chart-with-commentary",
    ("table", False): "table-led", ("table", True): "table-with-commentary",
    ("diagram", False): "diagram-led", ("diagram", True): "diagram-with-commentary",
    ("text", False): "text-page", ("text", True): "text-page",
    ("mixed", False): "mixed", ("mixed", True): "mixed",
}
# A page whose family the author has not settled reads against the three exhibit
# families together.
POOLED = {
    "exhibit-led": ("chart-led", "table-led", "diagram-led"),
    "exhibit-with-commentary": ("chart-with-commentary", "table-with-commentary", "diagram-with-commentary"),
}
COMMENTARY = {"chart-led": False, "table-led": False, "diagram-led": False, "exhibit-led": False,
              "chart-with-commentary": True, "table-with-commentary": True, "diagram-with-commentary": True,
              "exhibit-with-commentary": True, "mixed": None, "text-page": None}
COMMENT = ("Body-word targets by reading task: lower quartile, median and upper quartile of a well-made "
           "page doing that job. Body words exclude the title and source lines.")


def bank(judgements, measures):
    """Body and total words per reading task, from every judged content page."""
    by_key = {row[0]: row for row in measures}
    tasks: dict[str, list[tuple[float, float]]] = {}
    for judged in judgements:
        row = by_key.get(judged.get("page"))
        if not row or judged.get("kind") != "content" or row[3] <= 0:
            continue
        task = TASKS.get((judged.get("family"), bool(judged.get("hasCommentary"))))
        if task:
            tasks.setdefault(task, []).append((row[3], row[1]))
    for pooled, members in POOLED.items():
        rows = [pair for member in members for pair in tasks.get(member, [])]
        if rows:
            tasks[pooled] = rows
    return tasks


def targets(tasks):
    out = {}
    for task in sorted(tasks):
        body = [b for b, _ in tasks[task]]
        total = [t for _, t in tasks[task]]
        if len(body) < 2:
            continue
        q1, median, q3 = statistics.quantiles(body, n=4, method="inclusive")
        out[task] = {"commentary": COMMENTARY.get(task),
                     "bodyWords": {"q1": round(q1, 1), "median": round(median, 1), "q3": round(q3, 1)},
                     "totalWords": {"median": float(statistics.median(total))}}
    return {"$comment": COMMENT, "tasks": out}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=None, help="write here instead of stdout")
    args = parser.parse_args(argv)
    root = corpus_root()
    judgements = json.loads((root / "page-judgements.json").read_text(encoding="utf-8"))
    measures = json.loads((root / "page-measures.json").read_text(encoding="utf-8"))
    tasks = bank(judgements, measures)
    result = targets(tasks)
    text = json.dumps(result, indent=1) + "\n"
    if args.out:
        args.out.write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)
    for task, values in sorted(tasks.items()):
        print(f"{task:24s} n={len(values):3d}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
