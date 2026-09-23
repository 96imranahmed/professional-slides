"""Build the reading-task bank, and the per-task targets the runtime ships.

    python3 evals/corpus/build_reading_tasks.py            from the corpus
    python3 evals/corpus/build_reading_tasks.py --distil   from reading-task-bank.json

Two outputs, and only the second leaves this repository. The bank
(evals/corpus/reading-task-bank.json) lists every judged client page with its
file, page and hash: development evidence, never shipped. The runtime file
(skills/professional-slides/runtime/reading-tasks.json) holds each task's
quartiles and nothing that names a document, so a deck is held to the client
pages' numbers without the skill ever reading, searching for or citing them.

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
BANK = HERE / "reading-task-bank.json"
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


def quantile(values, q):
    a = sorted(values)
    i = (len(a) - 1) * q
    lo = int(i)
    hi = min(lo + 1, len(a) - 1)
    return round(a[lo] + (a[hi] - a[lo]) * (i - lo), 1)


def stats(samples):
    body = [s["bodyWords"] for s in samples]
    total = [s["totalWords"] for s in samples]
    return {"bodyWords": {"q1": quantile(body, .25), "median": quantile(body, .5), "q3": quantile(body, .75)},
            "totalWords": {"median": quantile(total, .5)}}


def distil(bank: dict) -> dict:
    """Per-task targets, plus the two pooled tasks older plans name."""
    tasks = {task: {"commentary": bank["commentary"].get(task), **stats(samples)} for task, samples in bank["tasks"].items()}
    pooled = {"exhibit-with-commentary": True, "exhibit-led": False}
    for name, commentary in pooled.items():
        samples = [s for task, rows in bank["tasks"].items() if bank["commentary"].get(task) is commentary for s in rows]
        tasks[name] = {"commentary": commentary, **stats(samples)}
    # Shipped with a public plugin: the targets, nothing about their source.
    return {"$comment": ("Body-word targets by reading task: lower quartile, median and upper quartile of a well-made page doing "
                         "that job. Body words exclude the title and source lines."),
            "tasks": dict(sorted(tasks.items()))}


def main() -> int:
    import sys
    if "--distil" in sys.argv:
        OUT.write_text(json.dumps(distil(json.loads(BANK.read_text())), indent=1) + "\n")
        return 0
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
    BANK.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    OUT.write_text(json.dumps(distil(out), indent=1) + "\n")
    for k, v in sorted(bank.items()):
        words = sorted(s["bodyWords"] for s in v)
        print(f"{k:24s} n={len(v):3d}  q1={words[len(words)//4]:4d}  median={words[len(words)//2]:4d}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
