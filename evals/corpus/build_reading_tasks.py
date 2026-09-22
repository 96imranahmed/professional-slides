"""Build the reading-task reference bank the text contract compares pages with.

    python3 evals/corpus/build_reading_tasks.py

Each page's word floor is the lower quartile of the reference pages that share
its reading task. Those references were chosen by hand, five per task, and a
hand-picked five skews dense: a clean chart with a line of takeaway set at the
client median was refused as thin. This takes every client-project page the
vision pass judged (client-page-judgements.json), keyed by exhibit family and
by whether the page carries a commentary column, with the measured words and
the source file's hash. All of them, not a selection, so nobody picks sparse
references to lower a floor either. Pages whose text does not extract are left
out rather than carried as a zero-word baseline.
"""
from __future__ import annotations

import glob
import hashlib
import json
import os
from pathlib import Path

HERE = Path(__file__).parent
CORPUS = Path("/Users/imran/Desktop/Side Projects/professional-slides-corpus")
OUT = HERE.parents[1] / "skills" / "professional-slides" / "runtime" / "reading-tasks.json"

TASKS = {
    ("chart", False): "chart-led", ("chart", True): "chart-with-commentary",
    ("table", False): "table-led", ("table", True): "table-with-commentary",
    ("diagram", False): "diagram-led", ("diagram", True): "diagram-with-commentary",
    ("text", False): "text-page", ("text", True): "text-page",
    ("mixed", False): "mixed", ("mixed", True): "mixed",
}
COMMENTARY = {"chart-led": False, "table-led": False, "diagram-led": False,
              "chart-with-commentary": True, "table-with-commentary": True, "diagram-with-commentary": True}


def main() -> int:
    judged = json.loads((HERE / "client-page-judgements.json").read_text())
    measures = {m[0]: m for m in json.loads((HERE / "client-page-measures.json").read_text())}
    files = {os.path.basename(p): p for p in glob.glob(str(CORPUS / "**" / "*.pdf"), recursive=True)}
    hashes: dict[str, str] = {}
    bank: dict[str, list] = {}
    for j in judged:
        m = measures.get(j["page"])
        if not m or j.get("kind") != "content" or m[3] <= 0:
            continue
        task = TASKS.get((j["family"], bool(j["hasCommentary"])))
        if not task:
            continue
        path = files[os.path.basename(m[5])]
        if path not in hashes:
            hashes[path] = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        bank.setdefault(task, []).append({
            "reference": os.path.basename(path), "path": str(Path(path).relative_to(CORPUS)), "page": m[6],
            "sha256": hashes[path], "bodyWords": m[3], "totalWords": m[1], "judged": j.get("note")})
    out = {
        "$comment": (__doc__.strip().split("\n\n")[1].replace("\n", " ")
                     + " Method: pdftotext -layout; body words exclude the title and source lines."),
        "commentary": COMMENTARY,
        "tasks": {k: sorted(v, key=lambda s: s["bodyWords"]) for k, v in sorted(bank.items())},
    }
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    for k, v in sorted(bank.items()):
        words = sorted(s["bodyWords"] for s in v)
        print(f"{k:24s} n={len(v):3d}  q1={words[len(words)//4]:4d}  median={words[len(words)//2]:4d}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
