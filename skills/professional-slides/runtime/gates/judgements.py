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


def judged(kind: str, subject, context=None, where=None):
    """The recorded answer to the question, or None - and the question listed as pending - where none is recorded."""
    key = judgement_key(kind, subject, context)
    if not _ACTIVE:
        return None
    said = _ORACLE(kind, subject, context) if _ORACLE else None
    if said:
        return {"verdict": said} if isinstance(said, str) else said
    if key in _VERDICTS:
        return _VERDICTS[key]
    entry = _PENDING.setdefault(key, {"kind": kind, "subject": subject, "context": context, "where": []})
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


def unload() -> None:
    """Stop reading judgements: every question is unasked again."""
    global _ACTIVE, _ORACLE
    _VERDICTS.clear()
    _PENDING.clear()
    _ACTIVE = False
    _ORACLE = None
