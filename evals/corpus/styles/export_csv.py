"""Write the page-by-page style classification into the corpus as a CSV.

    python3 evals/corpus/styles/export_csv.py

One row per classified page, beside the corpus's own index.csv, so a page can
be found from its style and a style traced to its pages. `skill_status` is
`claimed` until the style's probe page composes, then `verified`; a style the
skill cannot draw is `missing`. `sample` says which draw the page came from:
`corpus` (pages 1-400: 300 from the Slideworks decks and 100 from the rest of
the corpus, most of it published work either way) or `published` (401-600,
thought-piece reports only, none of the pages the first draw took).
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

HERE = Path(__file__).parent
CORPUS = Path("/Users/imran/Desktop/Side Projects/professional-slides-corpus")

sample = {str(p["n"]): p for name in ("sample.json", "sample-published.json")
          for p in json.loads((HERE / name).read_text())["pages"]}
client = json.loads((HERE / "classified.json").read_text())
published = {n: v for n, v in json.loads((HERE / "classified-published.json").read_text()).items() if not n.startswith("$")}
classified = {**client, **published}
vocab = json.loads((HERE / "styles.json").read_text())
capability = json.loads((HERE / "capability.json").read_text())["styles"]
probe_path = HERE / "probe-results.json"
verified = json.loads(probe_path.read_text()) if probe_path.exists() else {}

out = CORPUS / "style-classification.csv"
with open(out, "w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    writer.writerow(["sample", "sample_n", "listing_id", "firm", "deck_type", "deck_title", "local_path", "page",
                     "sha256", "family", "style", "style_description", "devices",
                     "skill_status", "skill_component"])
    for n, entry in sorted(classified.items(), key=lambda kv: int(kv[0])):
        page, style = sample[n], entry["style"]
        via = capability.get(style)
        if style == "S-other":
            status = "not-a-style"
        elif not via:
            status = "missing"
        else:
            status = "verified" if verified.get(style) is True else "claimed"
        writer.writerow(["published" if n in published else "corpus", n, page["listing"], page["firm"], page["deckType"], page["title"], page["path"],
                         page["page"], page["sha256"], vocab["families"].get(style[0], ""), style,
                         vocab["styles"].get(style, "Blank or placeholder page"),
                         "; ".join(entry["devices"]), status, via or ""])
print(f"{out}: {len(classified)} rows")
