"""Draw a reproducible sample of corpus pages for the design-style inventory.

    python3 evals/corpus/styles/sample_pages.py > evals/corpus/styles/sample.json

Three hundred pages from the Slideworks decks (McKinsey, BCG and Bain client
and published work, the collection the skill was asked to cover) and one
hundred from the rest of the corpus, at most four pages from any one document
so a two-hundred-page report cannot set the style mix on its own. First and
last pages are skipped: covers and back matter are a style each, and the
sample should spend its pages on the ones that vary.
"""
from __future__ import annotations

import csv
import json
import os
import random
import sys
from pathlib import Path

CORPUS = Path("/Users/imran/Desktop/Side Projects/professional-slides-corpus")
SEED = 20260922
PER_DOC = 4
QUOTA = {"slideworks": 300, "other": 100}


def documents():
    with open(CORPUS / "index.csv", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            # Paths in the index are relative to the corpus root.
            path = str(CORPUS / row["local_path"]) if row["local_path"] else ""
            if row["duplicate"] == "yes" or not path or not os.path.exists(path):
                continue
            if row["format"].lower() != "pdf" or not row["pages"]:
                continue
            pages = int(row["pages"])
            if pages < 4:
                continue
            pool = "slideworks" if row["source"].startswith("slideworks") else "other"
            yield pool, row, pages


def main() -> int:
    rng = random.Random(SEED)
    by_pool = {"slideworks": [], "other": []}
    for pool, row, pages in documents():
        picks = rng.sample(range(2, pages), min(PER_DOC, pages - 2))
        by_pool[pool] += [(row, page) for page in picks]
    sample = []
    for pool, want in QUOTA.items():
        chosen = rng.sample(by_pool[pool], min(want, len(by_pool[pool])))
        for row, page in chosen:
            sample.append({"pool": pool, "listing": row["listing_id"], "firm": row["firm"],
                           "deckType": row["deck_type"], "title": row["title"],
                           "path": row["local_path"], "sha256": row["sha256"], "page": page})
    rng.shuffle(sample)
    for n, entry in enumerate(sample, 1):
        entry["n"] = n
    print(json.dumps({"$comment": __doc__.strip().splitlines()[0], "seed": SEED,
                      "perDocument": PER_DOC, "quota": QUOTA, "pages": sample}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
