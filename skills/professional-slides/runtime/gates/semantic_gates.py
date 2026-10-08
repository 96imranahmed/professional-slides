"""What the page says, rather than how it is drawn.

The other gates measure geometry and typography. These measure whether the
commentary says anything the exhibit does not: restatement, planning
language left on the page, caveats that outweigh the findings, comparison
tables whose columns say the same thing, shares the page's own counts do not
give, and one table schema invented over and over across the deck.
"""

from __future__ import annotations

import re

from gate_config import THRESHOLDS, finding, source_text, standing, text_nodes
# Two sentences share what they say in their content words (stopwords.json).
from text_stats import content_words
# What a line means - a planning label, a caveat, a share stated in words - is read, not matched (judgements.py).
from judgements import judged


# The roles a page's own sentences are drawn under, as the renderer names them
# (registry.mjs draws a paragraph under `paragraph`): every gate here reads
# the commentary through this set.
# A callout is not commentary. It is a reading note fixed to the exhibit - a
# legend, a basis, a "read this as" - so it shares the exhibit's vocabulary by
# design, and counted as the page's own sentences a chart legend would read
# as a restatement of the chart. The commentary column is what the page says for
# itself: its points, its paragraphs, its insight - and the finding set under
# a panel as a caption (`insight-caption`), which is the page's sentence about
# that panel, not a label on it.
COMMENTARY_ROLES = {"list-item", "list-lead", "insight-body", "paragraph", "paragraph-lead",
                    "panel-caption", "insight-caption", "statement-text"}
EXHIBIT_TEXT_ROLES = {"table-cell-text", "table-header-text", "table-group-text",
                      "data-label", "category-label", "category-note", "annotation-text",
                      "legend-label", "chart-unit", "metric-value", "metric-label",
                      "card-title", "card-text", "node-label", "node-text",
                      "step-title", "step-text", "phase-label", "table-status-label"}
# A line that opens on a short label set off by a colon or a dash: whether the
# label is planning language ("Interpretation:", "So what -") or the line's
# content ("Revenue: up 4%") is read (planning-label).
LABELLED_RE = re.compile(r"^\s*(?:[^\W\d_][\w'’]*\s+){0,3}[^\W\d_][\w'’]*\s*(?::|—|–|\s-\s)")


def page_voices(slide):
    """The page's two voices: what the exhibit says, and what is said about it."""
    commentary, exhibit = [], []
    for node in text_nodes(slide):
        role = str(node.get("role") or "")
        text = source_text(node)
        if not text.strip():
            continue
        if role in COMMENTARY_ROLES:
            commentary.append(text)
        elif role in EXHIBIT_TEXT_ROLES:
            exhibit.append(text)
    return commentary, exhibit


def gate_restatement(slide_no, slide, findings):
    """RESTATEMENT. The commentary reads the exhibit back to the reader.

    A commentary column is there to say what the exhibit does not - what follows,
    what it costs, what to do - and a gate can tell the difference, because
    restatement reuses the exhibit's vocabulary and a finding brings its own.
    """
    commentary, exhibit = page_voices(slide)
    if not commentary or not exhibit:
        return
    # A chart's member and series names are what the commentary is about, not
    # what it says: "Africa grew fastest" has to name Africa. Counted as the
    # exhibit's vocabulary, a six-region chart's names ("Europe", "East Asia",
    # "Middle East") would make a caption naming two regions half restatement.
    names = content_words(" ".join(source_text(n) for n in text_nodes(slide) if n.get("role") in ("category-label", "legend-label")))
    shown = content_words(" ".join(exhibit)) - names
    if len(shown) < THRESHOLDS["restatement_words_min"]:
        return
    # The column is measured pooled, and each block on its own below.
    said = content_words(" ".join(commentary)) - names
    share = len(said & shown) / len(said) if said else 0.0
    quoted = " ".join(commentary)[:70]
    pooled = len(said) >= THRESHOLDS["restatement_words_min"] and share > THRESHOLDS["restatement_max"]
    # Pooled, a column dilutes itself: three blocks that say something new and
    # one that reads the table back average out under the threshold, and the
    # page ships with the one block a reader stops at. A block is read on its
    # own, so it is also measured on its own, against a higher bar.
    blocks = [(block, content_words(block) - names) for block in commentary]
    measurable = [(block, words) for block, words in blocks
                  if len(words) >= THRESHOLDS["restatement_block_words_min"]]
    worst = max(measurable, key=lambda entry: len(entry[1] & shown) / len(entry[1]), default=None)
    if worst and len(worst[1] & shown) / len(worst[1]) > THRESHOLDS["restatement_block_max"] and not pooled:
        share, quoted, said = len(worst[1] & shown) / len(worst[1]), worst[0][:70], worst[1]
    elif not pooled:
        return
    # A callout's words are the exhibit's (it is fixed to a mark), so a caption
    # that says what a callout says reads as a restatement though only the chart
    # changed. When the callout is what tips it, say so.
    callouts = [source_text(n) for n in text_nodes(slide) if n.get("role") == "annotation-text" and source_text(n).strip()]
    unmarked = content_words(" ".join(t for t in exhibit if t not in callouts)) - names
    by_callout = bool(callouts) and bool(said) and len(said & unmarked) / len(said) <= THRESHOLDS["restatement_max"]
    findings.append(finding(
        slide_no, "RESTATEMENT", {"share": round(share, 2), "block": quoted, **({"callout": callouts[0][:70]} if by_callout else {})}, THRESHOLDS["restatement_max"],
        (f"The commentary repeats the chart's callout (\"{callouts[0][:60]}\"): the callout is read as part of "
         "the exhibit, so a caption or point saying the same finding reads it back. Let the callout carry the "
         "figure and the commentary say what follows from it - or drop the callout." if by_callout else
         "The commentary is built from the exhibit's own words, so the reader learns "
         "nothing by reading it. Say what the exhibit cannot: what follows from the "
         "number, what it costs, which option it settles, what would change it. If "
         "the only honest sentence is the one already in the table, the page does "
         "not need a commentary column."),
    ))


def gate_planning_voice(slide_no, slide, findings):
    """PLANNING_VOICE. `Interpretation:`, `Takeaway:` — the dot-dash on the page.

    Planning language belongs in the plan, not the rendered deck: a sentence
    that opens "Interpretation:" tells the reader which column of the dot-dash
    they are reading. A line that opens on a short label is asked whether the
    label is planning language (planning-label).
    """
    offenders = []
    for node in text_nodes(slide):
        role = str(node.get("role") or "")
        if role not in COMMENTARY_ROLES and role != "insight-body":
            continue
        for line in str(source_text(node)).split("\n"):
            line = line.strip()
            if not LABELLED_RE.match(line) or line[:70] in offenders:
                continue
            said = judged("planning-label", line, None, slide_no)
            if said and said.get("verdict") == "planning-label":
                offenders.append(line[:70])
    for text in offenders[:3]:
        findings.append(finding(
            slide_no, "PLANNING_VOICE", text, "no planning label on the page",
            "Delete the label and keep the sentence. \"Interpretation: the team can "
            "generate drama before a villain arrives\" is a finding once the first "
            "word goes; with it, the page is telling the reader which column of the "
            "dot-dash they are reading.",
        ))


def gate_caveat_heavy(slide_no, slide, findings):
    """CAVEAT_HEAVY. A page that spends itself on what it does not establish.

    Scope discipline is a virtue and this is not an argument against it. But a
    page that says five times - in its commentary, a table row and its note -
    that its evidence does not settle the question is spent on the saying. One
    caveat is a boundary; five is the page.
    """
    commentary, _ = page_voices(slide)
    lines = [ln.strip() for text in commentary for ln in str(text).split("\n") if ln.strip()]
    if len(lines) <= THRESHOLDS["caveats_max"]:
        return
    # Which lines state a limit rather than a finding is read (commentary-caveats): "Education does not decide the city; it
    # decides the neighborhood" is a finding in contrastive form, which a count of negations punished as a hedge.
    said = judged("commentary-caveats", [{"id": f"l{at + 1}", "text": line} for at, line in enumerate(lines)], None, slide_no)
    if not said or said.get("verdict") != "some-caveats":
        return
    picked = {str(i) for i in said.get("caveats") or []}
    hits = [line[:70] for at, line in enumerate(lines) if f"l{at + 1}" in picked]
    if len(hits) <= THRESHOLDS["caveats_max"]:
        return
    findings.append(finding(
        slide_no, "CAVEAT_HEAVY", {"caveats": len(hits), "of": len(lines), "first": hits[:3]},
        THRESHOLDS["caveats_max"],
        "Keep one statement of what this evidence does not settle, in the note or "
        "the insight, and give the commentary back to what it does settle. A page "
        "that qualifies itself three times reads as a page with nothing to say.",
    ))


def gate_twin_cells(slide_no, slide, findings):
    """TWIN_CELLS. A comparison table whose compared columns are identical.

    An "Avengers | Justice League" table whose two columns carry word-for-word
    the same text compares nothing. It is the cheapest defect here to detect
    and the most expensive to leave in.
    """
    cells = {}
    for node in text_nodes(slide):
        if str(node.get("role") or "") != "table-cell-text":
            continue
        data = node.get("data") or {}
        row, column = data.get("row"), data.get("column")
        if row is None or column is None:
            continue
        cells[(int(row), int(column))] = source_text(node).strip()
    if not cells:
        return
    columns = sorted({c for _, c in cells})
    if len(columns) < 3:                       # a label column and one measure is not a comparison
        return
    twins = []
    for row in sorted({r for r, _ in cells}):
        values = [(c, cells.get((row, c), "")) for c in columns[1:]]
        seen = {}
        for c, text in values:
            key = re.sub(r"\s+", " ", text).strip().lower()
            if len(key) < 12:
                continue
            if key in seen:
                twins.append({"row": row, "columns": [seen[key], c], "text": text[:60]})
            seen[key] = c
    # One twinned row is a fact about the data, not a defect: a funnel table
    # whose "Owner" row gives customer success two consecutive stages is correct,
    # and the example decks contain exactly that. A comparison stops comparing
    # when it happens twice and across a good share of the table.
    rows = len({r for r, _ in cells})
    if len(twins) < 2 or not rows or len(twins) / rows < 0.4:
        return
    findings.append(finding(
        slide_no, "TWIN_CELLS", {"rows": len(twins), "of": rows, "examples": twins[:3]}, 0,
        "Two columns of this table say the same thing in the same words, so the row "
        "compares nothing. Either the row is a shared premise - move it into the "
        "title, the insight or a note above the table - or the comparison is real "
        "and has not been written yet. A table is the answer only when the cells differ.",
    ))


OF_COUNT_RE = re.compile(r"\b(\d{1,4})\s+of\s+(\d{1,4})\b")
PERCENT_RE = re.compile(r"(\d{1,3}(?:\.\d)?)\s?%")


def gate_contradicted_share(slide_no, slide, findings):
    """CONTRADICTED_SHARE. A percentage the page's own counts do not give.

    A page printing "80% have access" and "12% have no access" over a bar chart
    labelled "17 of 33", "12 of 33" and "4 of 33" contradicts itself: 17 + 12
    = 29 of 33 is 88%, and so is 100 - 12.

    Where a page states its counts as "N of M" it has published its own
    denominator, so every share on that page must be some subset of those counts
    over M. That is the whole rule, and it is exact: no tolerance beyond the
    rounding the page itself does.
    """
    counts, denominators = [], set()
    for node in text_nodes(slide):
        for value, total in OF_COUNT_RE.findall(source_text(node)):
            counts.append(int(value))
            denominators.add(int(total))
    # One published denominator, or the page is not making this claim about itself.
    if len(denominators) != 1 or len(counts) < 2:
        return
    total = denominators.pop()
    if total <= 0:
        return
    counts = sorted(set(counts))
    reachable = {0}
    for count in counts:
        reachable |= {r + count for r in list(reachable) if r + count <= total}
    # A share is honest when some subset of the page's own counts rounds to it.
    ok = {round(100 * r / total) for r in reachable}
    stated, bad, said = [], [], []
    for node in text_nodes(slide):
        role = str(node.get("role") or "")
        if role not in COMMENTARY_ROLES and role not in {"metric-value", "metric-label", "insight-body"}:
            continue
        text = source_text(node)
        for raw in PERCENT_RE.findall(text):
            stated.append((f"{raw}%", round(float(raw))))
        if str(text).strip():
            said.append(str(text).strip())
    # A share stated in words - "half", "two in three" - is read off the lines with the fraction it states (shares-in-words).
    read = judged("shares-in-words", [{"id": f"l{at + 1}", "text": line} for at, line in enumerate(said)], None, slide_no) if said else None
    if read and read.get("verdict") == "states-shares":
        for share in read.get("shares") or []:
            if isinstance(share, dict) and isinstance(share.get("share"), (int, float)):
                stated.append((str(share.get("phrase")), round(100 * share["share"])))
    # The page's own resolution is one count: with 33 institutions, one of them
    # is three percentage points, and a share inside that is the author rounding
    # or a second question over the same base rather than a contradiction. Eight
    # points out on a base of 33 is not rounding - it is a different number.
    unit = 100 / total
    for label, value in stated:
        if not any(abs(value - candidate) <= unit for candidate in ok):
            bad.append({"said": label, "nearest": min(ok, key=lambda c: abs(c - value))})
    if not bad:
        return
    findings.append(finding(
        slide_no, "CONTRADICTED_SHARE",
        {"claimed": bad[:4], "counts": counts, "of": total},
        f"a subset of {counts} over {total}",
        "This page publishes its own denominator and then states a share it does "
        "not give. Recompute every percentage from the counts on the page and "
        "print the derivation in the note, or drop the counts if the shares come "
        "from a different base - a reader who can do the arithmetic will, and "
        "one number that does not reconcile costs the page every other number on it.",
    ))


def gate_table_schema_flat(slides, content_indexes, findings):
    """TABLE_SCHEMA_FLAT, deck level. The same table, invented over and over.

    `TABLE_MONOTONY` asks whether tables carry a treatment. This asks something
    blunter: are they the same table? Eighteen tables on two schemas - a label
    column and two columns of sentences under `Dimension` - each pass alone;
    only a table read against the tables on the other pages shows the schema
    came first and the evidence was poured into it.
    """
    schemas = {}
    for index in content_indexes:
        slide = slides[index]
        headers = {}
        for node in text_nodes(slide):
            if str(node.get("role") or "") != "table-header-text":
                continue
            column = (node.get("data") or {}).get("column")
            if column is None:
                continue
            headers[int(column)] = re.sub(r"\s+", " ", source_text(node)).strip().lower()
        if len(headers) < 2:
            continue
        key = " | ".join(headers[c] for c in sorted(headers) if headers[c])
        if key:
            schemas.setdefault(key, []).append(index + 1)
    tables = sum(len(v) for v in schemas.values())
    commonest = max(schemas.values(), key=len) if schemas else []
    standing("TABLE_SCHEMA_FLAT", "tables opening on the same column headers", len(commonest), THRESHOLDS["schema_repeat_max"], "max",
             unit="tables", applies=tables >= THRESHOLDS["schema_from"], pages=list(commonest))
    if len(schemas) == 0 or tables < THRESHOLDS["schema_from"]:
        return
    for key, pages in sorted(schemas.items(), key=lambda kv: -len(kv[1])):
        if len(pages) <= THRESHOLDS["schema_repeat_max"]:
            continue
        findings.append(finding(
            None, "TABLE_SCHEMA_FLAT",
            {"headers": key[:70], "pages": pages[:12], "count": len(pages),
             "tables": sum(len(v) for v in schemas.values())},
            THRESHOLDS["schema_repeat_max"],
            f"{len(pages)} tables in this deck open with the same columns. A schema "
            "reused that often is not a schema, it is a container the content was "
            "poured into: the columns came first and the evidence was written to fit "
            "them. Ask what each page's evidence actually is - a ranking, a "
            "sequence, a set of named categories, a scored comparison - and let the "
            "table's columns come from that, or let the page stop being a table.",
        ))
