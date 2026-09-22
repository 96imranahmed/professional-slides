"""Build the Slideworks library inside the corpus, from the corpus's own index.

    python3 evals/corpus/build_slideworks_library.py

The Slideworks collection - McKinsey, BCG and Bain decks listed by
slideworks.io - used to be consolidated under the repository's output folder,
which is working space and was cleared with it. The documents themselves were
never only there: every listing is a row of the corpus index.csv, and every
downloaded deck is a PDF in the corpus under its firm. This makes that
collection a first-class part of the corpus rather than a copy somewhere else:

  slideworks/README.md       what it is, where the files are, how to rebuild
  slideworks/coverage.csv    every listing, its status, and where its file is
  slideworks/missing.csv     the listings with no usable download, and why
  slideworks/documents.json  the unique documents on disk, hashed and counted
  slideworks/index.html      a browsable table of the library
  slideworks/decks/<firm>/   links to the canonical PDFs, not copies

The canonical file stays where the corpus keeps it; the library links to it,
so there is one copy of every deck and one index that says where it is.
"""
from __future__ import annotations

import csv
import html
import json
import os
from collections import Counter
from pathlib import Path

CORPUS = Path("/Users/imran/Desktop/Side Projects/professional-slides-corpus")
LIB = CORPUS / "slideworks"
FIRM_DIR = {"McKinsey": "mckinsey", "BCG": "bcg", "Bain": "bain"}


def main() -> int:
    with open(CORPUS / "index.csv", encoding="utf-8-sig") as handle:
        rows = [r for r in csv.DictReader(handle) if r["source"].startswith("slideworks")]
    LIB.mkdir(exist_ok=True)
    fields = ["listing_id", "firm", "deck_type", "category", "title", "source_url", "status", "format",
              "pages", "sha256", "corpus_path", "library_path", "duplicate", "note"]
    coverage, missing, documents = [], [], {}
    for r in rows:
        path = r["local_path"]
        on_disk = bool(path) and (CORPUS / path).is_file()
        lib_path = ""
        if on_disk:
            firm = FIRM_DIR.get(r["firm"], r["firm"].lower())
            link = LIB / "decks" / firm / Path(path).name
            link.parent.mkdir(parents=True, exist_ok=True)
            target = os.path.relpath(CORPUS / path, link.parent)
            if link.is_symlink() or link.exists():
                link.unlink()
            link.symlink_to(target)
            lib_path = str(link.relative_to(CORPUS))
            if r["duplicate"] != "yes":
                documents.setdefault(r["sha256"], {"sha256": r["sha256"], "firm": r["firm"], "title": r["title"],
                                                    "format": r["format"], "pages": int(r["pages"] or 0),
                                                    "corpus_path": path, "library_path": lib_path, "listings": []})
            if r["sha256"] in documents:
                documents[r["sha256"]]["listings"].append(r["listing_id"])
        row = {k: r.get(k, "") for k in fields}
        row.update(corpus_path=path if on_disk else "", library_path=lib_path,
                   status=r["status"] if on_disk else ("unavailable" if r["status"] != "downloaded" else "missing-file"))
        coverage.append(row)
        if not on_disk:
            missing.append(row)
    for name, data in (("coverage.csv", coverage), ("missing.csv", missing)):
        with open(LIB / name, "w", newline="", encoding="utf-8") as handle:
            w = csv.DictWriter(handle, fieldnames=fields); w.writeheader(); w.writerows(data)
    (LIB / "documents.json").write_text(json.dumps(sorted(documents.values(), key=lambda d: (d["firm"], d["title"])), indent=1, ensure_ascii=False) + "\n")

    by_firm = Counter(r["firm"] for r in coverage)
    have = Counter(r["firm"] for r in coverage if r["corpus_path"])
    pages = sum(d["pages"] for d in documents.values())
    summary = "\n".join(f"| {f} | {by_firm[f]} | {have[f]} | {by_firm[f] - have[f]} |" for f in sorted(by_firm))
    (LIB / "README.md").write_text(f"""# Slideworks library

McKinsey, BCG and Bain decks listed by slideworks.io, held as part of this corpus.
Every listing is also a row of `../index.csv` (source `slideworks-*`); every
downloaded deck is a PDF in the corpus under its firm, and `decks/<firm>/` links
to it rather than copying it. Rebuild with
`python3 evals/corpus/build_slideworks_library.py` in the professional-slides
repository.

| Firm | Listings | On disk | Missing |
| --- | --- | --- | --- |
{summary}

{len(documents)} unique documents on disk, {pages:,} pages. `missing.csv` lists
the listings with no usable download and the reason recorded when retrieval
failed; they were not retried when the library was rebuilt.

| File | Holds |
| --- | --- |
| `coverage.csv` | Every listing: status, pages, hash, corpus path and library path |
| `missing.csv` | The listings with no file, with the recorded reason |
| `documents.json` | Unique documents on disk, with every listing that points at each |
| `index.html` | A browsable table of the library |
| `decks/<firm>/` | Links to the canonical PDFs |

The skill's evaluations read the collection through `../index.csv`; the design
style inventory (`evals/corpus/styles`) samples 300 of its pages.
""", encoding="utf-8")

    cells = "".join(
        f"<tr><td>{html.escape(r['firm'])}</td><td>{html.escape(r['category'])}</td>"
        f"<td>{'<a href=\"' + html.escape(r['library_path'].replace('slideworks/', '', 1)) + '\">' if r['library_path'] else ''}"
        f"{html.escape(r['title'])}{'</a>' if r['library_path'] else ''}</td>"
        f"<td>{r['pages'] or ''}</td><td>{html.escape(r['status'])}</td></tr>" for r in coverage)
    (LIB / "index.html").write_text(
        "<!doctype html><html lang=en><head><meta charset=utf-8><title>Slideworks library</title>"
        "<style>body{font:14px/1.4 Arial,sans-serif;margin:24px;color:#17202a}table{border-collapse:collapse;width:100%}"
        "td,th{border-bottom:1px solid #e4e7ec;padding:6px 8px;text-align:left}th{background:#f2f4f7}</style></head><body>"
        f"<h1>Slideworks library</h1><p>{len(coverage)} listings, {len(documents)} documents on disk, {pages:,} pages.</p>"
        "<table><tr><th>Firm</th><th>Category</th><th>Title</th><th>Pages</th><th>Status</th></tr>" + cells + "</table></body></html>",
        encoding="utf-8")
    print(f"{len(coverage)} listings, {len(documents)} documents on disk, {len(missing)} missing, {pages:,} pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
