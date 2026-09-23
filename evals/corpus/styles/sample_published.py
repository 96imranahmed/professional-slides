"""A second sample: published and infographic decks, for styles client work lacks.

    python3 evals/corpus/styles/sample_published.py > evals/corpus/styles/sample-published.json

The first inventory (sample.json) drew most of its pages from published
thought leadership already, but in proportion to the whole corpus. This one
draws only from the thought-piece decks - the infographic-heavy reports,
surveys and outlooks firms publish - skipping every page the first sample
took, at most three pages a document, so styles that appear in published work
and rarely in client decks get their own chance to be found.
"""
from __future__ import annotations

import csv
import json
import os
import random
import sys
from pathlib import Path

CORPUS = Path("/Users/imran/Desktop/Side Projects/professional-slides-corpus")
HERE = Path(__file__).parent
SEED, WANT, PER_DOC = 20260923, 200, 3


def main() -> int:
    taken = {(p["path"], p["page"]) for p in json.loads((HERE / "sample.json").read_text())["pages"]}
    rng = random.Random(SEED)
    pool = []
    with open(CORPUS / "index.csv", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            path = row["local_path"]
            if row["deck_type"] != "thought-pieces" or row["duplicate"] == "yes" or not path:
                continue
            if row["format"].lower() != "pdf" or not row["pages"] or not (CORPUS / path).is_file():
                continue
            pages = int(row["pages"])
            if pages < 5:
                continue
            free = [p for p in range(2, pages) if (path, p) not in taken]
            for page in rng.sample(free, min(PER_DOC, len(free))):
                pool.append({"listing": row["listing_id"], "firm": row["firm"], "deckType": row["deck_type"],
                             "title": row["title"], "path": path, "sha256": row["sha256"], "page": page})
    chosen = rng.sample(pool, WANT)
    for n, entry in enumerate(chosen, 401):
        entry["n"] = n
    print(json.dumps({"$comment": __doc__.strip().splitlines()[0], "seed": SEED, "perDocument": PER_DOC,
                      "pages": chosen}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
