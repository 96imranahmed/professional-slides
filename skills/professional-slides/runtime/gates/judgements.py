"""Judgements the page gates read: what a rule needs read, not counted.

The gates that turn on what a line means - a planning label, a caveat, a share
stated in words, what a title counts - ask a question of a kind
(judgement-kinds.json) and hold only where it is answered. The answers are the
deck's recorded judgements (<id>.judgements.json, judgements.mjs), read here
under the key judgements.mjs computes: the kind, its version, the subject and
the context, hashed from the same canonical text. A question with no recorded
answer does not hold; it is listed in the report's `judgementsNeeded`, which
the compile adds to the deck's pending questions for `judge.mjs` to stage.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

KINDS = json.loads((Path(__file__).resolve().parent.parent / "judgement-kinds.json").read_text(encoding="utf-8"))["kinds"]

_VERDICTS: dict = {}
_PENDING: dict = {}
_ACTIVE = False
_ORACLE = None
# While page_gates gates one page for its page cache: every question the page
# asked, in order, with the answer it was given, so a later run can read the
# page from the cache only while each answer still stands (replay).
_ASKED = None


def canonical(value) -> str:
    """The text a key is hashed from, as judgements.mjs canonical writes it: keys sorted, no space, nothing escaped that JSON leaves."""
    if isinstance(value, bool) or value is None:
        return json.dumps(value)
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical(v) for v in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(f"{json.dumps(str(k), ensure_ascii=False)}:{canonical(value[k])}" for k in sorted(value)) + "}"
    return json.dumps(value, ensure_ascii=False)


def judgement_key(kind: str, subject, context=None) -> str:
    spec = KINDS.get(kind)
    if not spec:
        raise ValueError(f"Unknown judgement kind: {kind}")
    return hashlib.sha256(canonical([kind, spec["version"], subject, context]).encode("utf-8")).hexdigest()[:24]


def load(path=None, oracle=None) -> None:
    """Read the deck's recorded judgements; with no file, every question is pending. A test passes `oracle`, which answers
    `(kind, subject, context)` with a verdict, an answer or None in place of the file."""
    global _ACTIVE, _ORACLE
    _VERDICTS.clear()
    _PENDING.clear()
    _ACTIVE = True
    _ORACLE = oracle
    if path and Path(path).exists():
        _VERDICTS.update((json.loads(Path(path).read_text(encoding="utf-8")) or {}).get("verdicts") or {})


def judged(kind: str, subject, context=None, where=None, beside=None):
    """The recorded answer to the question, or None - and the question listed as pending - where none is recorded.
    `beside` is shown to the reader with the question and not keyed (judgements.mjs judged): a neighbour edited since
    leaves the answer standing."""
    key = judgement_key(kind, subject, context)
    if not _ACTIVE:
        return None
    said = _ORACLE(kind, subject, context) if _ORACLE else None
    if said:
        return {"verdict": said} if isinstance(said, str) else said
    if _ASKED is not None:
        _ASKED.append({"key": key, "kind": kind, "subject": subject, "context": context, "where": where,
                       "known": key in _VERDICTS, "said": _VERDICTS.get(key), **({"beside": beside} if beside is not None else {})})
    if key in _VERDICTS:
        return _VERDICTS[key]
    entry = _PENDING.setdefault(key, {"kind": kind, "subject": subject, "context": context, "where": [], **({"beside": beside} if beside is not None else {})})
    if where is not None and str(where) not in entry["where"]:
        entry["where"].append(str(where))
    return None


def verdict_of(kind: str, subject, context=None, where=None):
    """The recorded verdict alone, or None."""
    said = judged(kind, subject, context, where)
    return said.get("verdict") if said else None


def needed() -> list:
    """The questions met with no recorded answer, for the report."""
    return list(_PENDING.values())


def recording(on: bool = True) -> list:
    """Start recording the questions asked (`on`), or stop; returns those recorded since the last start."""
    global _ASKED
    asked, _ASKED = _ASKED or [], ([] if on else None)
    return asked


def answerable() -> bool:
    """Whether a page's questions can be recorded and asked again: the recorded judgements are read, and no test oracle
    answers in their place (an oracle's answers are not the file's, so no cached page is read under one)."""
    return _ACTIVE and _ORACLE is None


def replay(asked: list) -> bool:
    """Ask again what a cached page asked (`recording`): False, asking nothing, where a recorded answer has changed since -
    a question answered or its answer revised - so the page is gated again; else True, with each question still
    unanswered pending again with where it was met, as asking it would have left it."""
    if any((q["key"] in _VERDICTS) != q["known"] or (q["known"] and _VERDICTS[q["key"]] != q["said"]) for q in asked):
        return False
    for q in asked:
        if not q["known"]:
            # A line's page is replayed with it: the reader is shown the commentary the question was asked beside.
            entry = _PENDING.setdefault(q["key"], {"kind": q["kind"], "subject": q["subject"], "context": q["context"], "where": [],
                                                   **({"beside": q["beside"]} if q.get("beside") is not None else {})})
            if q["where"] is not None and str(q["where"]) not in entry["where"]:
                entry["where"].append(str(q["where"]))
    return True


def unload() -> None:
    """Stop reading judgements: every question is unasked again."""
    global _ACTIVE, _ORACLE
    _VERDICTS.clear()
    _PENDING.clear()
    _ACTIVE = False
    _ORACLE = None
