"""Answers to the questions the rules ask of the copy, for the tests.

A rule that turns on what a line means - a planning label, a caveat, what a
title counts - asks a question (runtime/judgements.mjs, gates/judgements.py)
and holds only where it is answered. A deck records the answers a model gave;
a test answers here, as the model would, so what the rule asks and what it does
with each answer are both tested, and nothing reaches a model.

    with answering({"planning-label": "planning-label"}) as asked:
        findings = run(page_gates.gate_planning_voice, 8, slide)
    asked  # every question put, as (kind, subject)

`answers` maps a kind to a verdict, a full answer, or a function of
(subject, context) returning either (None leaves the question unanswered).
"""

from __future__ import annotations

import contextlib
import json
import subprocess
import sys
from pathlib import Path

GATES = Path(__file__).resolve().parents[2] / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))
import judgements  # noqa: E402

JUDGE = GATES.parent / "judge.mjs"


@contextlib.contextmanager
def answering(answers):
    asked = []

    def oracle(kind, subject, context):
        asked.append((kind, subject))
        said = answers.get(kind)
        return said(subject, context) if callable(said) else said

    judgements.load(oracle=oracle)
    try:
        yield asked
    finally:
        judgements.unload()


# The verdict of each kind under which its rule refuses nothing: what a test's reader answers when the answer is not the point.
PASSING = {"column-judges": "states-facts", "prose-alternatives": "one-argument", "row-is-total": "not-total", "axis-measures-time": "not-time",
           "header-concludes": "concludes", "pill-states-status": "status", "heading-says-snapshots": "says-snapshots",
           "tiles-one-measure": "different-measures", "title-leads-with-gap": "finding", "title-count-only": "compares",
           "heading-states-result": "describes", "qualification-says-approximate": "approximate", "answer-contradicted": "consistent",
           "source-cites-pointer": "names-source", "planning-label": "content", "commentary-caveats": "no-caveats",
           "shares-in-words": "no-shares", "title-count-check": "agrees", "picture-shows": "shows", "file-is-logo": "logo"}


def _words(value):
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, dict):
        return [w for v in value.values() for w in _words(v)]
    if isinstance(value, list):
        return [w for v in value for w in _words(v)]
    return []


def passing(item) -> dict:
    """The answer under which the question's rule refuses nothing, quoting the subject where that verdict is quoted."""
    verdict = PASSING[item["kind"]]
    quoted = verdict in (judgements.KINDS[item["kind"]].get("quoteFor") or [])
    return {"verdict": verdict, "reason": "The fixture's reader answers each question so its rule passes.", **({"quote": _words(item["subject"])[0]} if quoted else {})}


def answer_everything(node, pages, *flags, rounds=6, answer=passing):
    """Run judge.mjs on a pages file and answer every packet it stages - each question with `answer(item)` - until it
    exits 0; returns the packets answered and the last run. A deck compiled after it holds every rule that reads copy."""
    root, packets = Path(pages).parent / "judgements", []
    run = lambda: subprocess.run([str(node), str(JUDGE), str(pages), *flags], capture_output=True, text=True, timeout=600)
    done, round_ = run(), 0
    while done.returncode == 3 and round_ < rounds:
        for folder in sorted(root.glob("packet-*")):
            packet = json.loads((folder / "packet.json").read_text())
            packets.append(packet)
            said = [{"key": item["key"], **answer(item)} for item in packet["items"]]
            (folder / "answer.json").write_text(json.dumps({"batch": packet["batch"], "judgements": said}))
        done, round_ = run(), round_ + 1
    return packets, done
