#!/usr/bin/env python3
"""Deterministic page gates (revamp item 11).

Nothing in the runtime measured ink, dead band, type range, layout diversity,
cpl, title lines or hero-exhibit area; the verification layer was precise about
JSON fields and blind to the page. These gates measure the page - the resolved
scene geometry and, where the question is optical, the rendered PNG - and block
before any model is consulted.

    page_gates.py scene.json render_dir/ [--report out.json]
                  [--profile executive|pre-read|live-pitch]

Exit 0 when every gate passes, 2 when there are findings, 1 on a crash.
Each finding is {slide, code, measured, threshold, repair}.

Conventions
-----------
* The canvas is 1280x720. A render of a different size is resampled to it, so
  LibreOffice's 1281px width does not shift a threshold.
* Ink is a pixel with luminance < 235 on the greyscale render.
* The footer band is y > 660: page numbers and sources live there and must not
  be counted as content ink or as the end of the content column.
* The cover slide (a slide carrying a `cover` component instance, or slide 1
  when no instance says otherwise) is exempt from the gates marked COVER_EXEMPT.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import re
import sys
from pathlib import Path
from typing import NamedTuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nice_ticks import is_nice_tick, nice_axis, parse_number  # noqa: E402

# The weight contract and the corpus it is calibrated against. One file, read
# here and by runtime/weight.mjs, so a floor cannot move in the composer
# without moving in the finding that reports it.
CONTRACT = json.loads((Path(__file__).resolve().parent.parent / "weight.json").read_text(encoding="utf-8"))

CANVAS_W, CANVAS_H = 1280, 720
NUMERIC_TOKEN = re.compile(r"^[-−+(]?[$€£]?\d[\d,.]*[%×xkmbn]*\)?$", re.I)
INK_LUMINANCE = 235
SURFACE_LUMINANCE = 250
FOOTER_TOP = 660

# --- role vocabulary -------------------------------------------------------

BODY_ROLES = {
    "paragraph", "body", "body-text", "list-item", "bullet",
    "table-cell-text", "table-cell", "table-header-text",
    "insight-body", "insight-heading", "evidence-note-text",
}
CHART_FURNITURE_ROLES = {"axis-label", "axis-title", "category-label", "data-label", "legend-label", "table-status-label", "table-lamp", "table-progress-label", "table-trend-glyph", "chart-bracket-label", "chart-delta-label", "chart-period-label", "chart-event-label", "chart-unit"}
TITLE_ROLES = {"action-title"}
SOURCE_ROLES = {"source-text", "source", "footnote", "footnote-text"}
NON_BODY_ROLES = SOURCE_ROLES | CHART_FURNITURE_ROLES | TITLE_ROLES | {
    "page-number", "notes", "tracker-label", "chart-unit",
    "cover-title", "cover-subtitle", "section-title",
    "tracker-compact-label", "tracker-compact-marker-label", "category-note",
    "chart-heading", "chart-title", "metric-value", "metric-label", "metric-sublabel",
}
PROSE_ROLES = {"paragraph", "body", "body-text"}
# Table text is a lookup value, so it may be set one step below body type when
# the table is dense; prose may not.
TABLE_TEXT_ROLES = {"table-cell-text", "table-cell", "table-header-text"}

# Components that count as an exhibit for HERO_EXHIBIT.
EXHIBIT_COMPONENTS = {
    "table", "comparison-table", "heatmap", "trend-rows", "insight-tree-table",
    "image-frame", "map", "matrix", "chart-group", "relationship-network",
    "quote-cluster", "icon-trends", "logo-collage", "funnel", "tree",
    # diagram families: they carry the page the way a chart does
    "cards", "quadrants", "cycle", "steps", "people", "logos", "framework", "gantt",
    "process", "chevron-process", "timeline", "roadmap", "organization", "journey",
}

# Families a page can belong to. A deck that is all one family reads as one page
# repeated, whatever the titles say.
DATA_COMPONENTS = {
    "table", "comparison-table", "heatmap", "trend-rows", "insight-tree-table",
    "matrix", "chart-group", "metric", "funnel", "gantt",
}
# A sentence that says what the page means. Captions inside a panel are not one.
ARGUMENT_COMPONENTS = {"insight", "callout", "bullet-list", "evidence-note", "status-list"}
# Pages carried by pictures rather than measurement.
QUALITATIVE_COMPONENTS = {"image-frame", "logos", "logo-collage", "people", "quote-cluster", "icon-trends"}
STRUCTURE_COMPONENTS = {"section-divider", "agenda", "tracker-page", "statement", "takeaways"}
# A photograph, not an icon, a logo mark or a spot image: the reference pages
# carry a small image on about half their pages (median 0.5% of the page), and
# those are marks, not decoration. A photograph covers 3% of the canvas and up.
PHOTO_MIN_AREA = 0.03 * CANVAS_W * CANVAS_H
# "1939 • Marvel Comics #1": a bullet doing the work of a comma, a bracket or a
# second line. Only a line that starts with one is a list marker.
# A space on at least one side: "1939 • Marvel Comics #1" is a separator, the
# interpunct in a unit ("kW·h") is part of the word.

TYPE_RANGES = {
    "body": (10.0, 14.0),
    # A table set dense carries its cells at 9 pt. The reference decks run
    # twenty- and thirty-row tables at that size rather than splitting them, and
    # a cell is a lookup value, not prose.
    "table-dense": (9.0, 14.0),
    "chart-furniture": (8.0, 11.0),
    "action-title": (20.0, 26.0),
    "source": (7.0, 9.0),
}

# How full the deck means to read (`fill` on the spec, carried on the scene).
# Emptiness is right for a live-pitch deck and wrong for a pre-read, so the
# three geometric thresholds move with it; nothing else does.
# Ink is calibrated against the corpus, not against taste: 2,125 rendered pages
# of published client decks run a median ink share of 0.191, a first quartile of
# 0.112 and a tenth percentile of 0.077. A document-weight page floors at the
# quartile, a balanced page at the tenth percentile, an airy page below both.
# The ladder that ran 0.14 / 0.115 failed 36% and 26% of published pages.
FILL_LEVELS = CONTRACT["geometryByFill"]
# The reference corpus, measured three ways by evals/corpus/measure_corpus.py.
# `slides` is the pixel sample: 2,125 pages from 426 published decks rendered
# onto this same 1280x720 canvas. `corpus` is the wide text sample, 16,334
# analytical pages. `judged` is a vision pass over 264 pages, one per deck.
REFERENCE_PAGE = CONTRACT["reference"]["slides"]
REFERENCE_JUDGED = CONTRACT["reference"]["judged"]
# Ink a page of body type puts on the canvas per word, measured by rendering
# text pages and reading the coverage back off the PNG. It sets the ink floor
# for a page with no exhibit, where the exhibit-calibrated floor is unreachable.
INK_PER_WORD = CONTRACT["inkPerWord"]
# How much relief a photograph buys a page's word floor. See the contract note:
# the floor follows the body the picture leaves, and stops following it here.
PICTURE = CONTRACT["picture"]
DEFAULT_FILL = CONTRACT["defaultFill"]

# What a page of this deck is expected to carry. The deck's `weight` (its own,
# or the one a template's house profile measured) is carried on the scene, and
# these are the fallbacks by fill level. Every number is a floor, never a
# ceiling — the ceiling on prose is WORDS, and density is only a defect when
# the content is not.
WEIGHT_BY_FILL = CONTRACT["byFill"]
# The wide corpus: 1,832 pages of page text, median 196 words, quartiles 127 and
# 282. The floors sit below that on purpose.
REFERENCE_PAGE_WORDS = CONTRACT["reference"]["corpus"]
# The careful sample, split into the page's three bands: what a reference
# analytical slide carries where.
REFERENCE_PAGE_BANDS = dict(REFERENCE_PAGE["bands"], pages=REFERENCE_PAGE["pages"])

# Density profiles change how much prose a page may carry; they never relax a
# geometric or typographic threshold.
#
# Derived from the corpus rather than chosen. These were eight bare numbers -
# 70/100, 100/140, 160/220, 200/280 - in a file where every neighbouring
# threshold cites what it was measured against, and they sat *below* what the
# reference decks carry: `executive` capped a text page at 140 words while the
# 1,832-page corpus runs a median of 196 and the 137-slide sample a median of
# 185. A ceiling under the median of the work you are imitating is not a
# ceiling, it is a tax.
#
# A page whose evidence is an exhibit spends its area on the exhibit, so its
# prose ceiling is the measured body band; a page whose evidence *is* its prose
# may run to the corpus figure for its density.
_BODY_BAND = REFERENCE_PAGE["bands"]["body"]          # 128 words, measured band by band
PROFILES = {
    # Read from a stage: the body band cut back, and the corpus's own lower quartile.
    "live-pitch": {"words_exhibit": round(_BODY_BAND * 0.6), "words_text": REFERENCE_PAGE_WORDS["p25"]},
    # The default, and the corpus at its middle.
    "executive": {"words_exhibit": _BODY_BAND, "words_text": REFERENCE_PAGE_WORDS["median"]},
    # Read at a desk: the corpus's upper quartile.
    "pre-read": {"words_exhibit": round(_BODY_BAND * 1.4), "words_text": REFERENCE_PAGE_WORDS["p75"]},
    # Source-rich support behind the story, set in the smallest approved type:
    # it carries more words in the same frame, by design.
    "appendix": {"words_exhibit": round(_BODY_BAND * 1.75), "words_text": round(REFERENCE_PAGE_WORDS["p75"] * 1.25)},
}
DEFAULT_PROFILE = "executive"

# Which stacked row of the page a component sits in, for `page_architecture`.
# This was a bare `// 120` deciding what counts as the same row - and the
# thresholds it feeds (`shapes_per_ten_min`, `shape_share_max`) cite the corpus,
# so a measured bar was sitting on an invented measurement. A page stacks at
# most six bands of content between its title and its footer, so the band is the
# canvas divided by six; the value is unchanged and now says where it comes from.
ARCH_BAND = CANVAS_H // 6
WEIGHT = dict(WEIGHT_BY_FILL[DEFAULT_FILL])

THRESHOLDS = {
    "ink_min": 0.077,  # the corpus's tenth percentile over 2,125 rendered pages; waived when a qualifying hero exhibit carries the page (a line chart is ink-light by nature)
    "dead_band_max": 0.08,       # fires on 6% of published pages; the corpus p90 is 0.049
    "internal_void_max": 0.13,   # 94px of nothing between two content blocks; the corpus p90 is 0.069
    "exhibit_ink_min": 0.02,     # a hero frame must carry ink, not just area (a line chart sits near 2-3%, a 12pt table near 5-6%)
    "title_lines_max": 2,
    "title_words_max": 14,
    "cpl_min": 35,
    "cpl_max": 90,
    "hero_area_min": 0.40,
    "monotony_max": 0.35,
    "column_void_max": 1.0,
    "image_pages_max": 0.30,   # photographs on more than three pages in ten
    "photo_area_min": 0.03,    # a photograph covers 3% of the page; smaller images are marks (logos, icons, spot art)
    "image_run_max": 2,        # consecutive analytical pages carrying photographs
    "data_pages_min": 0.45,    # pages whose evidence is a chart, a table or measured tiles
    "families_min": 3,         # distinct page families in a deck of ten pages or more
    "sections_from": 12,       # analytical pages beyond which a deck needs sections and a tracker
    "deck_shape_from": 8,      # analytical pages beyond which a deck needs a heavy page among the light ones
    "shape_variety_from": 10,   # analytical pages beyond which the deck needs more than one page architecture
    "shapes_per_ten_min": 3.0,  # distinct architectures per ten pages (the reference decks run about five)
    "shape_share_max": 0.40,    # share of pages on the commonest architecture (the reference median is 0.23)
    "front_matter_from": 12,    # analytical pages beyond which a deck needs a contents page and an opening summary
    "column_run_max": 4,        # consecutive pages whose commentary column may share one device    # share of pages on the commonest architecture (the reference median is 0.23)
    # What the page says. Calibrated on the four example decks, which are the
    # only corpus in the repository - `--report` prints the measured value
    # beside the floor so the number can be argued with.
    "restatement_max": 0.55,    # share of the commentary's own content words already in the exhibit (corpus median 0.25-0.36, p90 0.47)
    "restatement_words_min": 12,  # below this the overlap is noise, not a pattern
    "caveats_max": 2,           # caveat lines per page; the reference decks run at most two, the deck that failed ran three plus a table row plus a note
    "schema_repeat_max": 3,     # pages that may open their table with the same column headers (the deck that failed ran fourteen)
    "schema_from": 6,           # tables in a deck before schema repetition is worth reporting
}


# --- helpers ---------------------------------------------------------------


def load_scene(path):
    raw = Path(path).read_bytes()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


def text_nodes(slide):
    return [n for n in slide.get("nodes", []) if n.get("type") == "text"]


def font_size(node):
    style = node.get("style") or {}
    size = (style.get("fontSize") or {})
    value = size.get("value") if isinstance(size, dict) else size
    return float(value) if isinstance(value, (int, float)) else None


def layout_of(node):
    return ((node.get("data") or {}).get("textLayout") or {})


def lines_of(node):
    lines = layout_of(node).get("lines")
    if isinstance(lines, list) and lines:
        return [str(line) for line in lines]
    text = node.get("text")
    return str(text).split("\n") if isinstance(text, str) and text else []


def source_text(node):
    layout = layout_of(node)
    for key in ("source", "text"):
        if isinstance(layout.get(key), str) and layout[key].strip():
            return layout[key]
    return str(node.get("text") or "")


def word_count(text):
    return len([w for w in re.split(r"\s+", str(text).strip()) if w])


def top_level_instances(slide):
    """Instances placed directly on the page, not nested inside a section.

    Instance ids are hierarchical below the slide id (`s02-0`, `s02-0-1`,
    `s02-0-1-0`), so a single index after the slide id is a page-level row.
    Page chrome and the cover carry bare ids and are not layout content.
    """
    slide_id = str(slide.get("id") or "")
    out = []
    for instance in slide.get("componentInstances", []):
        ident = str(instance.get("id") or "")
        if ident in ("chrome", "cover", "page-template"):
            continue
        if slide_id and ident.startswith(slide_id + "-"):
            if "-" in ident[len(slide_id) + 1:]:
                continue
            out.append(instance)
        elif "-" not in ident:
            out.append(instance)
    return out


def is_exhibit(instance):
    component = str(instance.get("component") or "")
    return component.startswith("chart.") or component in EXHIBIT_COMPONENTS


def all_components(slide):
    """Every component on the page, nested ones included, minus page chrome."""
    return [str(c.get("component")) for c in slide.get("componentInstances", [])
            if str(c.get("id") or "") not in ("chrome", "cover", "page-template")]


def photo_nodes(slide):
    """Photographs on the page: image primitives big enough to be pictures."""
    out = []
    for node in slide.get("nodes", []):
        if node.get("type") != "image":
            continue
        frame = node.get("frame") or {}
        if float(frame.get("width") or 0) * float(frame.get("height") or 0) >= PHOTO_MIN_AREA:
            out.append(node)
    return out


def page_family(slide):
    """What carries the page: a chart, a table, photographs, a diagram, measured
    tiles or words. Finer than the layout signature and coarser than the
    component list, which is the grain a reader notices flicking through."""
    components = all_components(slide)
    if any(c.startswith("chart.") for c in components):
        return "chart"
    if any(c in {"table", "comparison-table", "heatmap", "trend-rows", "insight-tree-table"} for c in components):
        return "table"
    if photo_nodes(slide):
        return "image"
    if any(c in EXHIBIT_COMPONENTS and c not in QUALITATIVE_COMPONENTS for c in components):
        return "diagram"
    if any(c in QUALITATIVE_COMPONENTS for c in components):
        return "image"
    if "metric" in components:
        return "metrics"
    return "text"


def is_cover(slide, index):
    """Structural pages (cover, section divider, agenda/tracker) are exempt from
    the ink and void gates: they are navigation, not evidence."""
    components = {str(c.get("component")) for c in slide.get("componentInstances", [])}
    if components & {"cover", "section-divider", "agenda", "tracker-page", "takeaways", "statement"}:
        return True
    if components & {"slide-chrome", "section-divider"}:
        return False
    return index == 0


def content_frame(slide):
    frame = slide.get("contentFrame")
    if isinstance(frame, dict) and frame.get("width") and frame.get("height"):
        return frame
    return {"x": 60, "y": 162, "width": 1160, "height": 506}


# --- the gate vocabulary ---------------------------------------------------
#
# Every code a gate can emit, with the one line that says what it is about. The
# docs used to name codes that had been renamed (TITLE_TOO_LONG for what is now
# TITLE_WORDS) and to omit codes that existed, because there was no list to
# check against. This is the list, and a test holds the documentation to it.
GATE_CODES = {
    "INK_COVERAGE": "the content area carries too little ink to read as a page",
    "DEAD_BAND": "a trailing band of nothing under the content",
    "INTERNAL_VOID": "a gap between two content blocks the page does nothing with",
    "COLUMN_VOID": "the right column stops well above the footer",
    "TITLE_LINES": "an action title over two lines",
    "TITLE_WORDS": "an action title past the word budget",
    "TYPE_RANGE": "type set outside the approved range for its role",
    "CPL": "a measure too narrow or too wide to read",
    "WORDS": "prose doing the work an exhibit should do",
    "HERO_EXHIBIT": "an analytical page with no dominant exhibit carrying ink",
    "LAYOUT_MONOTONY": "one layout signature across most of the deck",
    "PAGE_VARIETY": "too few page families across the deck",
    "PAGE_SHAPE_FLAT": "the deck is built from too few page architectures",
    "COLUMN_MONOTONY": "the commentary column is marked the same way page after page",
    "NO_CONTENTS": "a sectioned deck that never says what its sections are",
    "NO_SUMMARY": "a deck that opens with evidence instead of with its answer",
    "EVIDENCE_MIX": "too few analytical pages carry a measured exhibit",
    "IMAGE_BUDGET": "photographs on too many analytical pages",
    "IMAGE_RUN": "photographs on too many consecutive pages",
    "MISSING_ARGUMENT": "a picture or comparison page with no argument on it",
    "METRIC_STACK": "one number parked above a table instead of beside it",
    "NO_SECTIONS": "a long deck with no sections and no tracker",
    "HEADING_WRAPS": "a heading that wraps where it should fit",
    "THIN_PAGE": "the page body carries less than the deck's weight contract",
    "NOTE_HEAVY": "the footer is carrying the page",
    "THIN_COLUMN": "the commentary column stops short of its track",
    "POINT_DEPTH": "points that are labels rather than findings",
    "PLOT_SPAN": "marks spanning too little of the exhibit frame",
    "THIN_TABLE": "a table using too little of the page's row budget",
    "THIN_EVIDENCE": "fewer evidence elements than the deck said it would carry",
    "NUMBERS_ON_MARKS": "marks carrying no printed value",
    "UNANNOTATED": "a plot with no bracket, flag, change bubble or base",
    "NICE_TICKS": "an axis on numbers a reader would not choose",
    "DECK_FLAT": "no page in the deck carries the detail",
    "MISSING_RENDER": "a page the gates could not measure because it did not render",
    "UNSOURCED_PICTURE": "a picture frame drawn empty because its file was never cleared",
    # What the page says, rather than how it is drawn. Every gate above this
    # line measures geometry or typography, which is how a 50-page deck reached
    # a reader carrying twenty-eight pages that open "Interpretation:", fifty-nine
    # caveat lines, eighteen tables on two invented schemas, one chart, and seven
    # comparison tables whose two columns say the same thing in the same words.
    # It cleared every gate the repository owned.
    "TWIN_CELLS": "a comparison table whose compared columns say the same thing",
    "RESTATEMENT": "commentary that repeats the exhibit instead of reading it",
    "PLANNING_VOICE": "planning language left on the page",
    "CAVEAT_HEAVY": "a page spending more of itself on limits than on findings",
    "TABLE_SCHEMA_FLAT": "the same table invented over and over across the deck",
    "CONTRADICTED_SHARE": "a percentage in the prose the page's own counts do not give",
}

# Findings raised before the page is rendered: the composer's plan-time budget
# and the deck's coverage check. They are not gates, but they share the shape.
COMPOSE_CODES = {
    "THIN_PLAN": "what the page will carry falls under the floor, before it is built",
    "MISSING_EVIDENCE": "a ranked criterion with no comparative exhibit",
}


def emitted_codes():
    """The codes this module can actually emit, read from its own source.

    A gate that emits a code missing from GATE_CODES, or a code documented
    there that no gate emits, is drift; the eval suite fails on either.
    """
    source = Path(__file__).resolve().read_text(encoding="utf-8")
    return set(re.findall(r'finding\(\s*\n?\s*\w+,\s*"([A-Z_]+)"', source)) | {"MISSING_RENDER"}


def finding(slide_no, code, measured, threshold, repair):
    if code not in GATE_CODES:
        raise KeyError(f"{code} is not in the gate vocabulary; add it to GATE_CODES with the line that says what it is about")
    return {
        "slide": slide_no,
        "code": code,
        "measured": measured,
        "threshold": threshold,
        "repair": repair,
    }


# --- image measurement -----------------------------------------------------


def load_ink_matrix(path, luminance=INK_LUMINANCE):
    """The 1280x720 ink mask as a numpy array (rows x columns of booleans), or
    None when numpy is not installed. Column-aware gates need the grid; the
    row gates take its row sums."""
    try:
        import numpy as np
    except ImportError:
        return None
    from PIL import Image

    with Image.open(path) as image:
        grey = image.convert("L")
        if grey.size != (CANVAS_W, CANVAS_H):
            grey = grey.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
        return np.asarray(grey) < luminance


def load_ink_rows(path, luminance=INK_LUMINANCE):
    """Return rows[y] = count of pixels darker than `luminance` on that row of the
    1280x720 canvas. Ink uses INK_LUMINANCE; occupancy (for the dead-band and
    void gates) uses SURFACE_LUMINANCE so a tinted card or band counts as
    designed space rather than emptiness."""
    from PIL import Image

    with Image.open(path) as image:
        grey = image.convert("L")
        if grey.size != (CANVAS_W, CANVAS_H):
            grey = grey.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
        try:
            import numpy as np

            return (np.asarray(grey) < luminance).sum(axis=1).tolist()
        except ImportError:
            pass
        mask = grey.point(lambda p: 255 if p < luminance else 0, mode="L")
        return [
            int(sum(mask.crop((0, y, CANVAS_W, y + 1)).histogram()[1:]))
            for y in range(CANVAS_H)
        ]


def gate_column_void(slide_no, matrix, findings):
    """COLUMN_VOID. A page whose deck asks to read full must not leave a column
    empty below its content: a side column that stops halfway down is the
    commonest way a page reads empty while the page-wide bands stay inside
    their thresholds. Runs only for `fill: "full"` decks, and only where
    numpy is available to slice the render."""
    if matrix is None:
        return
    body_top = 140
    # The composed side column starts at 62% of the width (a 2:1 chart page) and
    # at 60% for a 3:2 table page; take the wider of the two so a narrow column
    # is measured whole.
    for name, x0 in (("side", int(CANVAS_W * 0.60)),):
        column = matrix[body_top:FOOTER_TOP, x0:CANVAS_W]
        rows = column.sum(axis=1)
        if not rows.any():
            continue  # a page with nothing in that column is a full-width page
        last = max(y for y, value in enumerate(rows) if value > 2)
        band = (len(rows) - 1 - last) / float(CANVAS_H)
        if band > THRESHOLDS["column_void_max"]:
            findings.append(finding(
                slide_no, "COLUMN_VOID", round(band, 4), THRESHOLDS["column_void_max"],
                "The right column stops well above the footer on a deck that reads "
                "full. Add points, a kpi or a callout, or set the deck's fill to "
                "balanced.",
            ))


def render_path(render_dir, slide_number):
    directory = Path(render_dir)
    for pattern in (f"slide-{slide_number}.png", f"slide-{slide_number:02d}.png",
                    f"slide{slide_number}.png", f"{slide_number}.png"):
        candidate = directory / pattern
        if candidate.is_file():
            return candidate
    return None


# --- gates -----------------------------------------------------------------


def text_page_ink_floor():
    """The ink a page of type alone must show: what its required words produce.

    `ink_min` is calibrated on pages with an exhibit - the careful sample's ink
    first quartile is 0.121 over 137 analytical slides, and the balanced floor
    of 0.115 sits just under it. A page of body type cannot reach that at any
    honest length: rendering text pages from 93 to 185 words gives a straight
    line at 0.00052 ink per word, so 0.115 would need about 220 words of body
    against a reference body of 128. The floor was not a high bar for those
    pages, it was an impossible one.

    So a text page is held to the ink its own word floor produces, which makes
    the two gates agree by construction: whatever `pageWords` the deck's weight
    contract sets, this follows it. A text page at the word floor passes with
    room; one carrying a third of it still fails here as well as at THIN_PAGE.
    """
    return INK_PER_WORD["value"] * INK_PER_WORD["tolerance"] * (WEIGHT.get("pageWords") or 0)


def gate_ink_and_dead_band(slide_no, rows, findings, occupied=None, text_page=False):
    """INK_COVERAGE and DEAD_BAND. COVER_EXEMPT. Needs the render.
    `rows` counts ink; `occupied` (default: rows) counts designed surfaces too.
    `text_page` holds a page with no exhibit to the type floor instead."""
    ink = sum(rows[:FOOTER_TOP])
    content_rows = (occupied or rows)[:FOOTER_TOP]
    fraction = ink / float(CANVAS_W * CANVAS_H)
    floor = min(text_page_ink_floor(), THRESHOLDS["ink_min"]) if text_page else THRESHOLDS["ink_min"]
    if fraction < floor:
        findings.append(finding(
            slide_no, "INK_COVERAGE", round(fraction, 4), round(floor, 4),
            "The page carries less type than its own word floor would put on it. "
            "Add the evidence the title claims - points that run to a sentence "
            "each, a kpi or metrics row where the story has a number."
            if text_page else
            "The page is mostly empty. Give the hero exhibit the leftover height "
            "(leftover: fill) or add the evidence the title claims.",
        ))
    # A row counts as content once it carries more than a hairline of ink.
    last_ink = None
    for y in range(FOOTER_TOP - 1, -1, -1):
        if content_rows[y] > 3:
            last_ink = y
            break
    if last_ink is None:
        band = 1.0
    else:
        band = (FOOTER_TOP - 1 - last_ink) / float(CANVAS_H)
    if band > THRESHOLDS["dead_band_max"]:
        findings.append(finding(
            slide_no, "DEAD_BAND", round(band, 4), THRESHOLDS["dead_band_max"],
            "A trailing empty band sits above the footer. Set the page body to "
            "distribute or let the exhibit fill the remaining track.",
        ))
    # INTERNAL_VOID: the largest empty band *between* content rows below the title.
    # A takeaway pinned to the bottom with nothing above it is as empty as a trailing band.
    body_top = 140
    run, longest = 0, 0
    for y in range(body_top, (last_ink if last_ink is not None else body_top) + 1):
        if content_rows[y] > 3:
            run = 0
        else:
            run += 1
            longest = max(longest, run)
    void = longest / float(CANVAS_H)
    if void > THRESHOLDS["internal_void_max"]:
        findings.append(finding(
            slide_no, "INTERNAL_VOID", round(void, 4), THRESHOLDS["internal_void_max"],
            "An empty band sits inside the page. Merge this page with a neighbour, "
            "give the exhibit more to show, or let it fill the track.",
        ))


def gate_title(slide_no, slide, findings):
    """TITLE_LINES, TITLE_WORDS. COVER_EXEMPT.

    Whether a title *commits to a finding* was a nine-entry word list
    ("some ", "may ", "could ", "offers a", "is not a ranking") applied to
    every title in every deck. It was a log of four offending titles, not a
    lexicon, and it failed "Three of five markets could fund the build from
    cash" - a committed finding. A title that hedges is a real defect and a
    word list cannot see it; the taste review reads the titles and says so.
    """
    for node in text_nodes(slide):
        if node.get("role") not in TITLE_ROLES:
            continue
        lines = lines_of(node)
        if len(lines) > THRESHOLDS["title_lines_max"]:
            findings.append(finding(
                slide_no, "TITLE_LINES", len(lines), THRESHOLDS["title_lines_max"],
                "Cut the action title to two lines: state the finding, drop the setup clause.",
            ))
        # A continuation marker "(2/3)" on a split page is not part of the claim.
        text = re.sub(r"\s*\(\d+/\d+\)\s*$", "", source_text(node))
        words = word_count(text)
        if words > THRESHOLDS["title_words_max"]:
            findings.append(finding(
                slide_no, "TITLE_WORDS", words, THRESHOLDS["title_words_max"],
                "Rewrite the title as a claim of at most 14 words.",
            ))


def gate_type_range(slide_no, slide, findings, profile=DEFAULT_PROFILE):
    """TYPE_RANGE across body, chart furniture, title and source roles. An
    appendix page is set smaller on purpose - the corpus runs its model grids and
    source tables at 8 pt - so its table cells and chart furniture floor a point
    lower than a page that sits in the story."""
    relax = 1.0 if profile == "appendix" else 0.0
    for node in text_nodes(slide):
        role = node.get("role")
        size = font_size(node)
        if size is None:
            continue
        if role in TABLE_TEXT_ROLES:
            band = "table-dense"
        elif role in BODY_ROLES:
            band = "body"
        elif role == "chart-unit" and (node.get("data") or {}).get("chartUnitPlacement") == "inline":
            # The inline unit sits on the heading's line at the heading's size,
            # told apart from the measure by colour alone; it is heading type,
            # not chart furniture.
            band = "body"
        elif role in CHART_FURNITURE_ROLES:
            band = "chart-furniture"
        elif role in TITLE_ROLES:
            band = "action-title"
        elif role in SOURCE_ROLES:
            band = "source"
        else:
            continue
        low, high = TYPE_RANGES[band]
        if band in ("table-dense", "chart-furniture"):
            low -= relax
        if size < low - 1e-6 or size > high + 1e-6:
            findings.append(finding(
                slide_no, "TYPE_RANGE", {"role": role, "pt": round(size, 2)}, [low, high],
                f"Snap {role} to the modular scale inside {low}-{high} pt.",
            ))


def gate_cpl(slide_no, slide, findings):
    """CPL. Measure is the longest laid-out line of a prose node."""
    for node in text_nodes(slide):
        if node.get("role") not in PROSE_ROLES:
            continue
        lines = lines_of(node)
        if not lines:
            continue
        longest = max(len(line) for line in lines)
        if longest > THRESHOLDS["cpl_max"]:
            findings.append(finding(
                slide_no, "CPL", longest, THRESHOLDS["cpl_max"],
                "The measure is too wide to track. Cap the paragraph at ~90 characters "
                "per line or split it into columns.",
            ))
        elif len(lines) > 1 and longest < THRESHOLDS["cpl_min"]:
            # Only a wrapped paragraph can be too narrow; a one-line note cannot.
            findings.append(finding(
                slide_no, "CPL", longest, THRESHOLDS["cpl_min"],
                "The column is too narrow for prose. Widen it to at least 35 "
                "characters per line or make the text a label.",
            ))


def gate_words(slide_no, slide, findings, profile):
    """WORDS. COVER_EXEMPT. Body prose only: no source, page number, notes — and no
    table cells, which are structured evidence rather than prose (dense is fine)."""
    total = 0
    for node in text_nodes(slide):
        role = node.get("role")
        # Text inside structured exhibits (tables, cards, steps, gantt bars, network
        # nodes, framework pillars) is evidence in cells, not prose.
        if role in NON_BODY_ROLES or role is None or role.startswith(("table-", "card-", "step-", "gantt-", "network-", "framework-", "quadrant-", "cycle-", "people-", "profile-", "agenda-")):
            continue
        total += word_count(source_text(node))
    has_exhibit = any(is_exhibit(c) for c in slide.get("componentInstances", []))
    limit = PROFILES[profile]["words_exhibit" if has_exhibit else "words_text"]
    if total > limit:
        findings.append(finding(
            slide_no, "WORDS", total, limit,
            "Cut the page to its claim, its evidence and its consequence; "
            "move the rest to the notes.",
        ))


def _inside(inner, outer):
    a, b = inner.get("frame") or {}, outer.get("frame") or {}
    return (a.get("x", 0) >= b.get("x", 0) - 1 and a.get("y", 0) >= b.get("y", 0) - 1
            and a.get("x", 0) + a.get("width", 0) <= b.get("x", 0) + b.get("width", 0) + 1
            and a.get("y", 0) + a.get("height", 0) <= b.get("y", 0) + b.get("height", 0) + 1)


def gate_hero_exhibit(slide_no, slide, findings, image=None):
    """HERO_EXHIBIT. Only applies to pages that carry an exhibit at all. With the render,
    also requires the hero frame to carry ink (a thin strip in a big frame is not a hero)."""
    exhibits = [c for c in slide.get("componentInstances", []) if is_exhibit(c)]
    if not exhibits:
        return
    # A row of peer panels is one exhibit for this purpose: measure the section that
    # holds them when two or more exhibits sit side by side inside it.
    for sec in (c for c in slide.get("componentInstances", []) if c.get("component") == "section"):
        inside = [e for e in exhibits if _inside(e, sec)]
        if len(inside) >= 2:
            exhibits = [sec] + [e for e in exhibits if e not in inside]
            break
    if image is not None:
        big = max(exhibits, key=lambda c: float((c.get("frame") or {}).get("width", 0)) * float((c.get("frame") or {}).get("height", 0)))
        f = big.get("frame") or {}
        try:
            from PIL import Image
            import numpy as np
            with Image.open(image) as im:
                a = np.asarray(im.convert("L"))
            x0, y0 = int(max(0, f["x"])), int(max(0, f["y"]))
            x1, y1 = int(min(CANVAS_W, f["x"] + f["width"])), int(min(CANVAS_H, f["y"] + f["height"]))
            if x1 > x0 and y1 > y0:
                # Occupancy, not ink: a map's land or a card's tint carries the frame.
                density = float((a[y0:y1, x0:x1] < SURFACE_LUMINANCE).mean())
                if density < THRESHOLDS["exhibit_ink_min"]:
                    findings.append(finding(
                        slide_no, "HERO_EXHIBIT", round(density, 4), THRESHOLDS["exhibit_ink_min"],
                        "The hero frame is mostly empty. Use an exhibit that fills it "
                        "(a table or chart with the page's numbers) or shrink the frame and add content.",
                    ))
        except Exception:
            pass
    frame = content_frame(slide)
    area = float(frame["width"]) * float(frame["height"])
    if area <= 0:
        return
    largest = max(
        float((c.get("frame") or {}).get("width", 0)) * float((c.get("frame") or {}).get("height", 0))
        for c in exhibits
    )
    share = largest / area
    if share < THRESHOLDS["hero_area_min"]:
        findings.append(finding(
            slide_no, "HERO_EXHIBIT", round(share, 4), THRESHOLDS["hero_area_min"],
            "Promote the exhibit to the page's hero: give it the fill track and "
            "let the prose hug.",
        ))


def axis_groups(slide):
    """Axis tick labels grouped by the axis that owns them.

    A chart with two quantitative dimensions - a scatter, a bubble - carries two
    axes, and its x ticks are not a continuation of its y ticks: read together
    they are always "uneven steps", which is a finding about nothing. The
    renderer marks each tick with the axis it belongs to, and an untagged chart
    has one axis, so `(instance, axis)` is the group.

    Axis *titles* carry the role `axis-title` and are not ticks.
    """
    groups = {}
    for node in text_nodes(slide):
        if node.get("role") != "axis-label":
            continue
        data = node.get("data") or {}
        owner = data.get("componentInstance") or "axis"
        groups.setdefault(f"{owner}:{data.get('axis') or 'value'}", []).append(node)
    return groups


def gate_nice_ticks(slide_no, slide, findings):
    """NICE_TICKS. The unit is the axis, not the single label.

    A step off the 1/2/2.5/5 ladder fails the whole axis, which is what the
    12.4 / 14.025 / 15.65 / 17.275 / 18.9 axis in the audited deck was.
    """
    for owner, nodes in sorted(axis_groups(slide).items()):
        labels = [source_text(node) for node in nodes]
        values = [parse_number(label) for label in labels]
        numeric = [v for v in values if v is not None]
        if not numeric:
            continue
        ok, detail = nice_axis(numeric)
        if ok:
            continue
        findings.append(finding(
            slide_no, "NICE_TICKS",
            {"axis": owner, "labels": labels, "reason": detail.get("reason")},
            "1 / 2 / 2.5 / 5 x 10^n",
            "Round the axis domain outward to whole ladder steps instead of "
            "interpolating the data extrema.",
        ))


def page_text_words(slide):
    """Every word printed on the page: title, labels, table cells, footnotes.
    The same thing `pdftotext` counts, so our pages can be compared with the
    reference decks rather than with our own idea of a page."""
    bands = page_bands(slide)
    return bands.body + bands.footer + bands.title_band


# The bands of the page. Measured over 137 analytical reference slides, their
# title band carries 20 words, their body 128 and their footer 19; ours carried
# 14 / 87 / 33. The gap is the body, and the footer is the one band where we
# were ahead - which is exactly what a floor counting all page text rewards.
BODY_TOP = 0.18
BODY_BOTTOM = 0.88
FOOTER_ROLES = SOURCE_ROLES | {"page-number", "footer-right", "footer-left", "notes"}
TITLE_BAND_ROLES = {"kicker", "page-tag", "page-tag-pill", "tracker-label", "tracker-pill-label",
                    "tracker-compact-label", "tracker-compact-marker-label", "action-subtitle"}


class PageText(NamedTuple):
    """One page's text, split into the three bands.

    `page_text_words` and `body_bands` used to walk the page and classify its
    nodes separately, which is two answers to one question and two places to
    change when the role vocabulary moves. This is the one measurement; both
    read it."""
    text_nodes: list
    body: int
    footer: int
    title_band: int


def page_bands(slide):
    """Split the page's words into its three bands, by role first and position
    second, so a note dropped in the body still counts as a note and a label
    near the footer still counts as body."""
    nodes = [n for n in slide.get("nodes", []) if n.get("type") == "text"]
    body = footer = band = 0
    for node in nodes:
        words = word_count(source_text(node))
        if not words:
            continue
        role = str(node.get("role") or "")
        # Role decides first - a note dropped in the body is still a note, a
        # label near the footer is still evidence - and position only settles
        # the roles that can sit anywhere. A node with no frame is body text:
        # the fixtures carry no geometry and the page gates still read them.
        if role in FOOTER_ROLES:
            footer += words
            continue
        if role in TITLE_ROLES or role in TITLE_BAND_ROLES:
            band += words
            continue
        frame = node.get("frame") or {}
        top = float(frame.get("y", 0)) / CANVAS_H if frame.get("height") else None
        if top is None:
            body += words
        elif top > BODY_BOTTOM:
            footer += words
        elif top < BODY_TOP:
            band += words
        else:
            body += words
    return PageText(nodes, body, footer, band)


def body_bands(slide):
    """(body words, footer words, title-band words) for one page."""
    bands = page_bands(slide)
    return bands.body, bands.footer, bands.title_band


def side_columns(slide):
    """The commentary columns on the page, as the composer names them."""
    out = []
    for instance in slide.get("componentInstances", []):
        ident = str(instance.get("id") or "")
        if ident.endswith("-side") and (instance.get("frame") or {}).get("height"):
            out.append(instance)
    return out


def nodes_inside(slide, frame, predicate=None):
    out = []
    for node in slide.get("nodes", []):
        f = node.get("frame") or {}
        if not f:
            continue
        cx, cy = f.get("x", 0) + f.get("width", 0) / 2, f.get("y", 0) + f.get("height", 0) / 2
        if not (frame.get("x", 0) - 1 <= cx <= frame.get("x", 0) + frame.get("width", 0) + 1):
            continue
        if not (frame.get("y", 0) - 1 <= cy <= frame.get("y", 0) + frame.get("height", 0) + 1):
            continue
        if predicate is None or predicate(node):
            out.append(node)
    return out


def thin_remedy(where="The page"):
    """The one repair for a page carrying less than the deck said it would.

    THIN_PAGE reports it on the rendered page, THIN_PLAN reports it from the
    spec before the page exists and DECK_FLAT reports it across the deck. They
    are three moments of one shortfall, so they give one answer; an author who
    acts on the plan-time message has acted on the render-time one too.
    """
    return (
        f"{where} is under-carrying where it matters. The floor counts the "
        "body alone - the title, the source and the notes do not stand in "
        "for evidence. Deepen the exhibit: more categories or rows, a "
        "derived column (rank, share, change), a value on every mark, a "
        "second line in the measure cell, the second cut of the same "
        "measure, and points that run to a sentence each. Reference client "
        f"pages carry {REFERENCE_PAGE_BANDS['body']} words in the body."
    )


def gate_findings(gate, *args):
    """What one gate would report, without reporting it.

    A gate that defers to another has to ask that other gate what it found -
    INK_COVERAGE defers to the hero exhibit and to the word floor - and asking
    means running it into a list of its own.
    """
    out = []
    gate(*args, out)
    return out


def picture_share(slide):
    """How much of the page's body a photograph is holding.

    A picture page substitutes the picture for the words - the reader is looking
    at the subject rather than reading about it - so the type has only the body
    beside or beneath the frame to fill. The floor follows that geometry, which
    is the same move `inkPerWord` makes for a page of type alone, rather than a
    second word floor nobody measured. It is capped by the contract, so growing
    a photograph cannot buy a page out of carrying an argument.
    """
    frame = content_frame(slide)
    area = float(frame.get("width") or 0) * float(frame.get("height") or 0)
    if area <= 0:
        return 0.0
    covered = 0.0
    for node in slide.get("nodes", []):
        # A picture that has not been sourced yet draws as its empty frame, and
        # that frame holds the same body the photograph will. Counting only the
        # ones with a file would make the plan-time floor and the rendered floor
        # disagree about the same page, which is the disagreement THIN_PLAN
        # exists to avoid.
        if node.get("type") != "image" and str(node.get("role") or "") != "image-frame":
            continue
        box = node.get("frame") or {}
        box_area = float(box.get("width") or 0) * float(box.get("height") or 0)
        if box_area >= PHOTO_MIN_AREA:
            covered += box_area
    return min(covered / area, PICTURE["shareMax"])


def gate_unsourced_picture(slide_no, slide, findings):
    """UNSOURCED_PICTURE. A frame standing in for a photograph nobody supplied.

    A picture written without a `path` composes as its empty frame carrying its
    alt line, which is the right behaviour: a page can be laid out, measured and
    gated before its pictures are cleared, and the gap is visible on the page
    rather than invisible in the plan.

    What was missing was the other end of that. A cold run planned a
    `picture-pair` of two servicing centres, wrote both as uncleared, and the
    deck passed every gate while shipping two grey boxes - because the frame
    counts as a picture everywhere a picture is counted. The placeholder is for
    work in progress; this is what stops it reaching a reader.
    """
    empty = [n for n in slide.get("nodes", [])
             if str(n.get("role") or "") == "image-frame"
             and (n.get("frame") or {}).get("width", 0) * (n.get("frame") or {}).get("height", 0) >= PHOTO_MIN_AREA]
    if not empty:
        return
    findings.append(finding(
        slide_no, "UNSOURCED_PICTURE", len(empty), 0,
        "This page draws {} picture frame{} with no picture in {}. Writing a picture as `alt` with no "
        "`path` is how a page gets laid out before its photographs are cleared, and it is not how a deck "
        "is delivered: source the file and give it a `path`, or drop the picture and give the page the "
        "icons, the exhibit or the width instead.".format(
            len(empty), "" if len(empty) == 1 else "s", "it" if len(empty) == 1 else "them"),
    ))


def gate_thin_page(slide_no, slide, findings):
    """THIN_PAGE. A content page carrying less than the deck's weight floor of
    page text. Not a style rule: a reader who gets three bullets and a chart has
    been handed the analysis to do themselves."""
    floor = WEIGHT.get("pageWords") or 0
    if floor <= 0:
        return
    floor = int(round(floor * (1.0 - picture_share(slide))))
    if floor <= 0:
        return
    body, footer, _band = body_bands(slide)
    if body < floor:
        findings.append(finding(slide_no, "THIN_PAGE", body, floor, thin_remedy()))
        return
    # A page that clears the floor on the strength of its notes has padded the
    # wrong band: the reference footer is 19 words against a 128-word body.
    if footer and body and footer > 0.3 * (body + footer):
        findings.append(finding(
            slide_no, "NOTE_HEAVY", {"body": body, "footer": footer},
            "a footer under a third of the page's text",
            "The notes are carrying the page. Put the qualification on the "
            "number it qualifies with a footnote marker, keep the block to two "
            "to four numbered lines, and give the body the words instead.",
        ))


def gate_thin_column(slide_no, slide, findings):
    """THIN_COLUMN and POINT_DEPTH. The commentary column is a track the page
    paid for: it reaches the bottom of the exhibit beside it, and its points
    carry a sentence rather than a label."""
    floor = WEIGHT.get("columnFill") or 0
    depth = WEIGHT.get("pointWords") or 0
    for column in side_columns(slide):
        frame = column.get("frame") or {}
        height = float(frame.get("height") or 0)
        if height < 120:
            continue
        # A toned panel fills its own surface; what matters is the text in it.
        content = nodes_inside(slide, frame, lambda n: n.get("type") in ("text", "image") or str(n.get("role") or "") in ("list-marker", "list-icon"))
        if not content:
            continue
        bottom = max((n["frame"].get("y", 0) + n["frame"].get("height", 0)) for n in content)
        reach = (bottom - frame.get("y", 0)) / height
        if floor > 0 and reach < floor:
            findings.append(finding(
                slide_no, "THIN_COLUMN", round(reach, 3), floor,
                "The commentary column stops early. Give it the content the page "
                "already implies — a lead and a sentence per point, the number "
                "the chart proves as a `kpi`, the consequence as `soWhat` — or "
                "let the exhibit have the width.",
            ))
        if depth <= 0:
            continue
        items = [n for n in content if str(n.get("role") or "") in ("list-item", "list-lead")]
        if len(items) >= 2:
            words = sum(word_count(source_text(n)) for n in items)
            leads = len([n for n in items if str(n.get("role")) == "list-lead"])
            bodies = max(1, len(items) - leads)
            mean = words / float(bodies)
            if mean < depth:
                findings.append(finding(
                    slide_no, "POINT_DEPTH", round(mean, 1), depth,
                    "The points are labels, not findings. Write each as a lead "
                    "and a sentence: what the evidence says, and what follows "
                    "from it for the decision.",
                ))


def gate_plot_span(slide_no, slide, findings):
    """PLOT_SPAN. The marks should span the exhibit frame they were given. A bar
    chart whose bars cross half its box is a page that paid for an exhibit and
    printed a diagram."""
    floor = WEIGHT.get("plotSpan") or 0
    if floor <= 0:
        return
    for instance in slide.get("componentInstances", []):
        component = str(instance.get("component") or "")
        if component not in ("chart.column", "chart.bar", "chart.stacked-column", "chart.stacked-bar"):
            continue
        frame = instance.get("frame") or {}
        marks = nodes_inside(slide, frame, lambda n: str(n.get("role") or "") == "chart-mark")
        if len(marks) < 2:
            continue
        # A chart that brackets periods, flags events or carries a growth arrow
        # spends that band on content, not on air: those bands are ink.
        annotated = nodes_inside(slide, frame, lambda n: str(n.get("role") or "") in (
            "chart-period-label", "chart-event-label", "chart-annotation",
            "chart-annotation-label", "chart-bracket-label", "chart-callout",
            "chart-change-label", "chart-delta-label", "annotation-text",
            "annotation-surface", "chart-badge"))
        if annotated:
            continue
        # Peers in a row share one plot frame: when the annotated panel reserves
        # a band for its growth arrows, the panel beside it reserves the same
        # band so their baselines coincide. That band is the row's, not this
        # chart's failure to fill.
        peer_annotated = False
        for other in slide.get("componentInstances", []):
            if other is instance or not str(other.get("component") or "").startswith("chart."):
                continue
            other_frame = other.get("frame") or {}
            if abs(float(other_frame.get("y") or 0) - float(frame.get("y") or 0)) > 8:
                continue
            if abs(float(other_frame.get("height") or 0) - float(frame.get("height") or 0)) > 8:
                continue
            if nodes_inside(slide, other_frame, lambda n: str(n.get("role") or "") in (
                    "chart-period-label", "chart-event-label", "chart-annotation",
                    "chart-annotation-label", "chart-bracket-label", "chart-callout",
                    "chart-change-label", "chart-delta-label", "annotation-text",
                    "annotation-surface", "chart-badge")):
                peer_annotated = True
                break
        if peer_annotated:
            continue
        def span_of(instance_frame, horizontal_axis):
            instance_marks = nodes_inside(slide, instance_frame, lambda n: str(n.get("role") or "") == "chart-mark")
            if len(instance_marks) < 2:
                return None
            if horizontal_axis:
                lo = min(m["frame"].get("x", 0) for m in instance_marks)
                hi = max(m["frame"].get("x", 0) + m["frame"].get("width", 0) for m in instance_marks)
                return (hi - lo) / max(1.0, float(instance_frame.get("width") or 1))
            lo = min(m["frame"].get("y", 0) for m in instance_marks)
            hi = max(m["frame"].get("y", 0) + m["frame"].get("height", 0) for m in instance_marks)
            return (hi - lo) / max(1.0, float(instance_frame.get("height") or 1))

        horizontal = component in ("chart.bar", "chart.stacked-bar")
        span = span_of(frame, horizontal)
        if span is None:
            continue
        # Small multiples share one value scale, so the panel holding the
        # smaller series fills less of its frame by design: the panel that
        # carries the scale proves it is honest.
        peer_filled = False
        for other in slide.get("componentInstances", []):
            if other is instance or not str(other.get("component") or "") == component:
                continue
            other_frame = other.get("frame") or {}
            if abs(float(other_frame.get("y") or 0) - float(frame.get("y") or 0)) > 8:
                continue
            if abs(float(other_frame.get("height") or 0) - float(frame.get("height") or 0)) > 8:
                continue
            other_span = span_of(other_frame, horizontal)
            if other_span is not None and other_span >= floor:
                peer_filled = True
                break
        if peer_filled:
            continue
        if span < floor:
            findings.append(finding(
                slide_no, "PLOT_SPAN", round(span, 3), floor,
                "The marks use a fraction of the exhibit. Tighten the value "
                "scale, drop the reserved annotation band if nothing annotates, "
                "widen the bars for few categories, or give the freed width back "
                "to the commentary column.",
            ))
            return


def gate_thin_table(slide_no, slide, findings):
    """THIN_TABLE. A table using a fraction of the page's row budget is a table
    that stopped at the summary level."""
    floor = WEIGHT.get("tableFill") or 0
    if floor <= 0:
        return
    for instance in top_level_instances(slide):
        if str(instance.get("component") or "") != "table":
            continue
        frame = instance.get("frame") or {}
        height = float(frame.get("height") or 0)
        if height < 200:
            continue
        rows = nodes_inside(slide, frame, lambda n: str(n.get("role") or "") in ("table-row-rule", "table-cell-text", "table-cell"))
        if not rows:
            continue
        bottom = max((n["frame"].get("y", 0) + n["frame"].get("height", 0)) for n in rows)
        used = (bottom - frame.get("y", 0)) / height
        if used < floor:
            findings.append(finding(
                slide_no, "THIN_TABLE", round(used, 3), floor,
                "The table uses a fraction of the page it was given. Bring the "
                "next level of detail — the rows behind the summary, the column "
                "that shows the basis — or make the table a strip and put the "
                "freed height into the argument.",
            ))
            return


def gate_numbers_on_marks(slide_no, slide, findings):
    """NUMBERS_ON_MARKS. An exhibit page prints its numbers. A chart whose values
    live on an axis makes the reader do arithmetic to quote it."""
    if not WEIGHT.get("pageWords"):
        return  # an airy deck speaks its numbers aloud; the page need not print them
    charts = [c for c in slide.get("componentInstances", []) if str(c.get("component") or "").startswith("chart.")]
    if not charts:
        return
    labels = [n for n in text_nodes(slide) if str(n.get("role") or "") == "data-label"]
    numeric = [n for n in labels if re.search(r"\d", source_text(n))]
    marks = [n for n in slide.get("nodes", []) if str(n.get("role") or "") == "chart-mark"]
    # While the marks are countable, every one of them carries its value: ten
    # labelled bars is ten blocks of evidence, and it is what lets the axis go.
    wanted = len(marks) if 0 < len(marks) <= 12 else 3
    if len(numeric) >= wanted:
        return
    findings.append(finding(
        slide_no, "NUMBERS_ON_MARKS", len(numeric), wanted,
        "Print the values on the marks (`dataLabels`), or label the endpoints "
        "and the decisive category. The numbers are the evidence; an axis is a "
        "lookup table. While a chart has twelve marks or fewer, every mark "
        "carries its number.",
    ))


ANNOTATION_ROLES = {
    "chart-period-label", "chart-event-label", "chart-annotation", "chart-annotation-label",
    "chart-bracket-label", "chart-callout", "chart-change-label", "chart-delta-label",
    "annotation-text", "annotation-surface", "chart-badge", "chart-reference-label",
    "chart-period-divider", "category-note",
}


def gate_unannotated(slide_no, slide, findings):
    """UNANNOTATED. A reference chart says what happened on the chart: a bracket
    over the periods, a flag at the event, the change in a bubble, a note under
    the category. A plot with nothing but marks hands the reading back to the
    reader, and it is a page of marks where theirs is a page of evidence."""
    if not WEIGHT.get("pageWords"):
        return
    # Only the charts that have somewhere to put an annotation: a waffle, a
    # bubble grid or a treemap has no plot band to bracket, and asking for one
    # would be asking for a page that cannot be built.
    annotatable = {"chart.column", "chart.bar", "chart.stacked-column", "chart.stacked-bar",
                   "chart.line", "chart.area", "chart.stacked-area", "chart.combo",
                   "chart.range", "chart.waterfall", "chart.scatter", "chart.bubble"}
    charts = [c for c in slide.get("componentInstances", []) if str(c.get("component") or "") in annotatable]
    if not charts:
        return
    marks = [n for n in slide.get("nodes", []) if str(n.get("role") or "") == "chart-mark"]
    # Two marks are a comparison and still want the change said on them; the
    # reference decks annotate almost every plot, and one chart in forty was
    # what this deck actually carried.
    if len(marks) < 2:
        return
    annotated = [n for n in slide.get("nodes", []) if str(n.get("role") or "") in ANNOTATION_ROLES]
    if annotated:
        return
    findings.append(finding(
        slide_no, "UNANNOTATED", 0, "one annotation on the chart",
        "Say it on the chart: `periods` brackets the runs, `events` flags the "
        "date, `change` or `cagr` carries the movement in a bubble, "
        "`categoryNotes` names the base under each category, and `annotations` "
        "puts the observation beside the mark it is about.",
    ))


def gate_heading_wraps(slide_no, slide, findings):
    """HEADING_WRAPS. The exhibit banner is one line: the measure, the population
    and the period, with the unit inline after it. Two lines means the heading is
    carrying a qualification that belongs in the note, or a unit written as a
    sentence ("$k, published base-salary band" rather than "$k")."""
    for node in text_nodes(slide):
        data = node.get("data") or {}
        if not data.get("headingWrapped"):
            continue
        findings.append(finding(
            slide_no, "HEADING_WRAPS", source_text(node)[:90], "one line",
            "Shorten the heading to the measure, the population and the period, "
            "and make the unit a unit: \"Published annual pay for PM roles at AI "
            "labs\" with unit \"$k\", and the basis (\"published base-salary "
            "band\") in the note under the page.",
        ))


def gate_thin_evidence(slide_no, slide, findings):
    """THIN_EVIDENCE. A deck that reads as a document (a pre-read, an appendix,
    anything the weight contract sets to two elements) puts more than one piece
    of evidence on a page: the chart and the table behind it, the chart and the
    measured tiles, the two cuts of the same measure."""
    wanted = int(WEIGHT.get("elements") or 1)
    if wanted < 2:
        return
    instances = [c for c in slide.get("componentInstances", [])
                 if str(c.get("id") or "") not in ("chrome", "cover", "page-template")]
    elements = len([c for c in instances if is_exhibit(c)])
    if any(str(c.get("component") or "") == "metric" for c in instances):
        elements += 1
    if elements >= wanted:
        return
    findings.append(finding(
        slide_no, "THIN_EVIDENCE", elements, wanted,
        "One exhibit on a page of a document-weight deck. Add the second piece "
        "the argument already implies - the table behind the chart, the same "
        "measure on another cut, a strip of measured tiles - or merge this page "
        "with its neighbour.",
    ))


def gate_missing_argument(slide_no, slide, findings):
    """MISSING_ARGUMENT. A page of photographs, or a two-sided comparison, with
    no sentence that says what it means. A caption names what you are looking at;
    it does not tell the reader that one side beats the other, or why that
    matters. Data pages are exempt: their title and their marks carry the claim."""
    components = all_components(slide)
    if any(c.startswith("chart.") for c in components) or any(c in DATA_COMPONENTS for c in components):
        return
    exhibits = [c for c in top_level_instances(slide) if is_exhibit(c)]
    photos = photo_nodes(slide)
    comparison = len(exhibits) == 2
    if not photos and not comparison:
        return
    if any(c in ARGUMENT_COMPONENTS for c in components):
        return
    findings.append(finding(
        slide_no, "MISSING_ARGUMENT",
        {"photos": len(photos), "panels": len(exhibits)},
        "one insight, so-what or points column",
        "Say what the page proves: add `soWhat` (or `insight`, or three `points`) "
        "that names which side wins on this criterion and what follows. On a "
        "comparison page the reader must leave knowing the verdict, not the "
        "exhibits.",
    ))


# --- what the page says ----------------------------------------------------
#
# Everything above measures how a page is drawn. These five measure whether it
# says anything, and they exist because a 50-page deck cleared every one of the
# others while carrying twenty-eight pages headed "Interpretation:", one chart,
# and seven comparison tables whose two columns held identical sentences.

# The roles a page's own sentences are drawn under. `paragraph-text` and
# `body-text` were in this set and neither exists: the renderer draws a
# paragraph under the role `paragraph` (registry.mjs). So every gate reading
# this set - RESTATEMENT, PLANNING_VOICE, CAVEAT_HEAVY, CONTRADICTED_SHARE -
# was blind to every paragraph in every deck. Two role vocabularies for one
# node, one of them invented.
COMMENTARY_ROLES = {"list-item", "list-lead", "insight-body", "paragraph",
                    "panel-caption", "callout-text", "callout-lead", "statement-text"}
EXHIBIT_TEXT_ROLES = {"table-cell-text", "table-header-text", "table-group-text",
                      "data-label", "category-label", "category-note", "annotation-text",
                      "legend-label", "chart-unit", "metric-value", "metric-label",
                      "card-title", "card-text", "node-label", "node-text",
                      "step-title", "step-text", "phase-label", "table-status-label"}
# Words that carry no argument, so two sentences sharing them share nothing.
STOPWORDS = frozenset("""a an the and or but of to in on for with as is are was were be been being
it its this that these those not no do does did can could may might will would should from by at
into than then so such other their them they our we you your also more most each per over under
between within has have had who whom which what when where how there here both either neither
about across after before during through while because since although however therefore""".split())
CAVEAT_RE = re.compile(
    r"(\bdoes not\b|\bdo not\b|\bis not\b|\bare not\b|\bcannot\b|\bnot a\b|\bno[t]? (?:establish|imply|prove|measure|rank)\b"
    r"|\brather than a\b|\blimit of inference\b|\bboundary\b|\bnot an? (?:exact|equivalence|estimate|ranking|verdict)\b)", re.I)
# "Education does not decide the city; it decides the neighborhood" is a finding
# in contrastive form, not a caveat. The negation sets up the positive clause
# that follows it, and counting it as a hedge punishes the sharpest sentence on
# the page - which it did, on a reference deck, the first time this gate ran.
CONTRAST_RE = re.compile(r"(;\s*it\b|,\s*it\b|\bbut\b|\brather,|\binstead\b|\bwhat it does\b|\bit is\b)", re.I)
# Planning language: the vocabulary of the dot-dash, which belongs in the plan.
PLANNING_PREFIX_RE = re.compile(
    r"^\s*(interpretation|takeaway|key insight|insight|implication|so what|dash|dot|note that|read this as|"
    r"caveat|limitation|evidence state|inference limit|editorial stance)\s*[:—-]", re.I)


def content_words(text):
    return {w for w in re.findall(r"[a-z][a-z']+", str(text).lower())
            if w not in STOPWORDS and len(w) > 3}


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

    The page that named this ran, forty times: a sentence restating the exhibit,
    a sentence beginning "Interpretation:", and a caveat. Its commentary reused
    three-quarters of its own content words from the table beside it. A
    commentary column is there to say what the exhibit does not - what follows,
    what it costs, what to do - and a gate can tell the difference, because
    restatement reuses the exhibit's vocabulary and a finding brings its own.
    """
    commentary, exhibit = page_voices(slide)
    if not commentary or not exhibit:
        return
    said, shown = content_words(" ".join(commentary)), content_words(" ".join(exhibit))
    if len(said) < THRESHOLDS["restatement_words_min"] or len(shown) < THRESHOLDS["restatement_words_min"]:
        return
    share = len(said & shown) / len(said)
    if share <= THRESHOLDS["restatement_max"]:
        return
    findings.append(finding(
        slide_no, "RESTATEMENT", round(share, 2), THRESHOLDS["restatement_max"],
        "The commentary is built from the exhibit's own words, so the reader learns "
        "nothing by reading it. Say what the exhibit cannot: what follows from the "
        "number, what it costs, which option it settles, what would change it. If "
        "the only honest sentence is the one already in the table, the page does "
        "not need a commentary column.",
    ))


def gate_planning_voice(slide_no, slide, findings):
    """PLANNING_VOICE. `Interpretation:`, `Takeaway:` — the dot-dash on the page.

    The skill has always said to keep planning language out of the rendered deck.
    It had never checked, and a deck reached a reader with twenty-eight of its
    fifty pages opening a sentence with the literal word "Interpretation:".
    """
    offenders = []
    for node in text_nodes(slide):
        role = str(node.get("role") or "")
        if role not in COMMENTARY_ROLES and role != "insight-body":
            continue
        for line in lines_of(node):
            hit = PLANNING_PREFIX_RE.match(line)
            if hit and line.strip()[:70] not in offenders:
                offenders.append(line.strip()[:70])
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

    Scope discipline is a virtue and this is not an argument against it. But one
    page ran three caveat lines in its commentary, a fourth as the table's last
    row ("Comparison boundary"), and a fifth in the note - saying five times that
    two dates do not settle which film is better. One caveat is a boundary; five
    is the page.
    """
    commentary, _ = page_voices(slide)
    lines = [ln for text in commentary for ln in str(text).split("\n") if ln.strip()]
    hits = [ln.strip()[:70] for ln in lines if CAVEAT_RE.search(ln) and not CONTRAST_RE.search(ln)]
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

    Found by reading, not by any gate: an "Avengers | Justice League" table whose
    two columns carried word-for-word identical text in all four rows, on a page
    titled "Avengers and Justice League connect heroes with independent
    identities". Six more pages in the same deck did it in at least one row. It
    is the cheapest defect in this file to detect and the most expensive to
    leave in: a comparison that compares nothing.
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


WORD_SHARES = {"half": 0.5, "a third": 1 / 3, "one third": 1 / 3, "two thirds": 2 / 3,
               "a quarter": 0.25, "three quarters": 0.75, "a fifth": 0.2, "two fifths": 0.4,
               "three fifths": 0.6, "four fifths": 0.8, "two in five": 0.4, "three in five": 0.6,
               "four in five": 0.8, "one in five": 0.2, "one in four": 0.25, "three in four": 0.75,
               "one in three": 1 / 3, "two in three": 2 / 3, "one in two": 0.5}
OF_COUNT_RE = re.compile(r"\b(\d{1,4})\s+of\s+(\d{1,4})\b")
PERCENT_RE = re.compile(r"(\d{1,3}(?:\.\d)?)\s?%")


def gate_contradicted_share(slide_no, slide, findings):
    """CONTRADICTED_SHARE. A percentage the page's own counts do not give.

    Found on a *reference* deck, by a reader rather than by anything here. A
    page printed four rings - 80% have access, 52% require guidelines, 38% limit
    tools, 12% have no access - over a bar chart labelled "17 of 33", "12 of 33",
    "4 of 33". 17 + 12 = 29 of 33 is 88%, and the page's own 12% is what makes
    80% provably wrong: 100 - 12 = 88. Two bullets beside it were wrong the same
    way, one claiming two thirds where the chart gave 17 of 33.

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
    stated, bad = [], []
    for node in text_nodes(slide):
        role = str(node.get("role") or "")
        if role not in COMMENTARY_ROLES and role not in {"metric-value", "metric-label", "insight-body"}:
            continue
        text = source_text(node)
        for raw in PERCENT_RE.findall(text):
            stated.append((f"{raw}%", round(float(raw))))
        lowered = " " + text.lower()
        for phrase, fraction in WORD_SHARES.items():
            if f" {phrase} " in lowered or lowered.rstrip().endswith(" " + phrase):
                stated.append((phrase, round(100 * fraction)))
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
    blunter: are they the same table? A 50-page deck opened fourteen of its
    tables with the column header `Dimension` and four more with
    `Element | Story mechanism` - two schemas over eighteen pages, each a
    label column and two columns of sentences. Every one of them passed, because
    nothing compared a table on one page with the table on the next.
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
    if len(schemas) == 0 or sum(len(v) for v in schemas.values()) < THRESHOLDS["schema_from"]:
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


def gate_metric_stack(slide_no, slide, findings):
    """METRIC_STACK. One or two big numbers parked above a table read as two
    pages glued together: the number floats in air and the table starts again
    below it. A number that the table proves belongs beside it."""
    instances = top_level_instances(slide)
    if any(str(c.get("component") or "").startswith("chart.") for c in instances):
        return
    rows = []
    for instance in sorted(instances, key=lambda c: (c.get("frame") or {}).get("y", 0)):
        component = str(instance.get("component") or "")
        frame = instance.get("frame") or {}
        if component == "metric":
            if rows and rows[-1]["kind"] == "metric" and abs(rows[-1]["y"] - frame.get("y", 0)) < 8:
                rows[-1]["count"] += 1
                continue
            rows.append({"kind": "metric", "y": frame.get("y", 0), "count": 1})
        elif component in {"table", "comparison-table", "trend-rows"}:
            rows.append({"kind": "table", "y": frame.get("y", 0), "count": 1})
    for first, second in zip(rows, rows[1:]):
        if first["kind"] == "metric" and second["kind"] == "table" and first["count"] <= 2:
            findings.append(finding(
                slide_no, "METRIC_STACK", {"tiles": first["count"]},
                "three tiles in a strip, or the number beside the table",
                "Move the number beside its evidence — `kpi: { value, label }` in "
                "the side column with the table as the hero — or give the strip "
                "three tiles so it reads as a row of measures rather than one "
                "figure floating over a table.",
            ))
            return


def gate_image_budget(slides, analytical, findings):
    """IMAGE_BUDGET and IMAGE_RUN, deck level. Photographs illustrate; they do
    not argue. A deck where most pages are pictures has stopped making a case,
    and a run of them reads as a gallery."""
    total = len(analytical)
    if total < 6:
        return
    flags = [bool(photo_nodes(slides[index])) for index in analytical]
    pages = [analytical[i] + 1 for i, has in enumerate(flags) if has]
    share = len(pages) / float(total)
    if share > THRESHOLDS["image_pages_max"]:
        findings.append(finding(
            None, "IMAGE_BUDGET", {"imagePages": pages, "share": round(share, 4)},
            THRESHOLDS["image_pages_max"],
            "Cut the photographs to the pages where the picture is the evidence "
            "(a cover, a divider, one product shot). Replace the rest with the "
            "measure the page is really about: a chart, a table, a framework.",
        ))
    run, longest, member = 0, 0, []
    best = []
    for i, has in enumerate(flags):
        if has:
            run += 1
            member.append(analytical[i] + 1)
            if run > longest:
                longest, best = run, list(member)
        else:
            run, member = 0, []
    if longest > THRESHOLDS["image_run_max"]:
        findings.append(finding(
            None, "IMAGE_RUN", {"slides": best, "run": longest}, THRESHOLDS["image_run_max"],
            "Break the run: put a chart, a table or a framework page between "
            "picture pages so the deck keeps arguing between illustrations.",
        ))


def gate_evidence_mix(slides, analytical, findings):
    """EVIDENCE_MIX and PAGE_VARIETY, deck level. Most pages should carry
    measurement, and a deck of any length should be built from more than one
    kind of page."""
    total = len(analytical)
    if total < 8:
        return
    families = [page_family(slides[index]) for index in analytical]
    data = sum(1 for family in families if family in ("chart", "table", "metrics"))
    share = data / float(total)
    if share < THRESHOLDS["data_pages_min"]:
        findings.append(finding(
            None, "EVIDENCE_MIX",
            {"dataPages": data, "pages": total, "share": round(share, 4)},
            THRESHOLDS["data_pages_min"],
            "Under half the pages carry a measurement. Convert the qualitative "
            "pages the argument leans on into evidence: a scorecard, a ranked "
            "bar, a table of the criteria — whatever lets the reader check the "
            "claim instead of taking it.",
        ))
    if total >= 10 and len(set(families)) < THRESHOLDS["families_min"]:
        findings.append(finding(
            None, "PAGE_VARIETY",
            {"families": sorted(set(families)), "pages": total}, THRESHOLDS["families_min"],
            "Every page is built the same way. Mix the register: a scorecard, a "
            "hero chart, a two-column comparison and a framework page answer "
            "different questions and should not look alike.",
        ))


def gate_deck_structure(slides, analytical, findings):
    """NO_SECTIONS, deck level. Past a dozen pages the reader needs to know where
    they are: sections, and a tracker that says which one is open."""
    if len(analytical) < THRESHOLDS["sections_from"]:
        return
    components = {component for slide in slides for component in all_components(slide)}
    roles = {str(node.get("role")) for slide in slides for node in slide.get("nodes", [])}
    # A section can begin on an analytical page. A stable, selected section
    # label on every analytical page is navigation too; requiring extra divider
    # pages rejects a valid fixed-length deck with a contents page and tracker.
    selected_by_page = []
    for index in analytical:
        selected_by_page.append({
            (str(node["data"]["trackerId"]), str(node["data"]["sectionId"]))
            for node in slides[index].get("nodes", [])
            if str(node.get("role", "")).startswith("tracker-")
            and node.get("data", {}).get("selected") is True
            and node.get("data", {}).get("trackerId")
            and node.get("data", {}).get("sectionId")
            and source_text(node).strip()
        })
    tracked_sections = False
    tracker_ids = {tracker_id for page in selected_by_page for tracker_id, _ in page}
    for tracker_id in tracker_ids:
        states = [{section_id for tid, section_id in page if tid == tracker_id}
                  for page in selected_by_page]
        if all(len(state) == 1 for state in states) and len(set.union(*states)) >= 2:
            tracked_sections = True
            break
    sections = "section-divider" in components or tracked_sections
    tracker = bool(components & {"agenda", "tracker-page"}) or bool(roles & {
        "tracker-label", "tracker-compact-label", "tracker-compact-marker-label",
    })
    if sections and tracker:
        return
    findings.append(finding(
        None, "NO_SECTIONS",
        {"pages": len(analytical), "sections": sections, "tracker": tracker},
        "sections and a tracker",
        "Group the pages into two to five sections (`kind: \"section\"`), and let "
        "the reader track them: `agenda: true` repeats the contents page before "
        "each section with the current one tinted, `sectionTabs: true` puts the "
        "section pills above every title.",
    ))


def gate_deck_front_matter(slides, analytical, findings, fill):
    """NO_CONTENTS and NO_SUMMARY, deck level.

    A long sectioned deck says what it covers before it starts, and an
    analytical deck opens with the answer. The reviewed deck had section tabs on
    every page and no contents page anywhere - a one-line consequence of the
    contents and the tracker having been one setting - and its summary page was
    assembled by hand because nothing said to write one.
    """
    # A catalogue declares itself airy: it has no argument to summarise and no
    # sections to announce, so neither page is missing from it.
    if fill == "airy" or len(analytical) < THRESHOLDS["front_matter_from"]:
        return
    kinds = [str(s.get("kind") or "") for s in slides]
    if "divider" in kinds and not any(
        any(str(c.get("component") or "") == "agenda" for c in s.get("componentInstances", []))
        for s in slides
    ):
        findings.append(finding(
            None, "NO_CONTENTS", 0, "a contents page",
            "The deck has sections and never says what they are. Set "
            "`contents: true` (the default once a deck has two sections); it is "
            "independent of `tracker`, so the page and the section pills can "
            "both be on.",
        ))
    # The first analytical page carries the answer: measured tiles over a short
    # ledger of findings, which is what `shape: "executive-summary"` builds.
    first = slides[analytical[0]] if analytical else None
    if first is not None:
        metrics = sum(1 for c in first.get("componentInstances", []) if str(c.get("component") or "") == "metric")
        if metrics < 2:
            findings.append(finding(
                None, "NO_SUMMARY", metrics, "an opening summary page",
                "The deck starts with evidence instead of with its answer. Give "
                "it a first page that states the finding: `shape: "
                "\"executive-summary\"` with the measures in `metrics` and the "
                "two to five findings that carry them in `points`.",
            ))


def gate_deck_shape(slides, analytical, findings, fill):
    """DECK_FLAT, deck level. The reference client decks do not carry the same
    page twice: their page text runs from 104 words at the lower quintile to 278
    at the upper, and two pages in five carry 200 words or more. A deck whose
    pages all weigh the same has not decided which pages matter - and the way to
    fix it is a page that carries the detail (a findings matrix, a deep measure
    table), not a sentence added to every page."""
    if fill == "airy" or len(analytical) < THRESHOLDS["deck_shape_from"]:
        return
    counts = sorted(page_text_words(slides[index]) for index in analytical)
    if not counts:
        return
    middle = len(counts) // 2
    median = counts[middle] if len(counts) % 2 else (counts[middle - 1] + counts[middle]) / 2
    top = counts[int(round(0.8 * (len(counts) - 1)))]
    heavy = sum(1 for value in counts if value >= REFERENCE_PAGE_WORDS["p75"])
    if heavy or (median and top / median >= 1.35):
        return
    findings.append(finding(
        None, "DECK_FLAT",
        {"median": median, "p80": top, "heaviest": counts[-1], "pagesAtReferenceP75": heavy},
        f"one page in the deck at {REFERENCE_PAGE_WORDS['p75']}+ words, or a p80 a third above the median",
        "Every page carries the same weight, which reads as a deck with no "
        "detail behind it. Give the argument its heavy page: set `shape` to "
        "`findings-matrix` (rows against two or three columns of bulleted "
        "findings) or to `measure-table` (measures grouped under their units, "
        "with the basis in numbered notes). "
        + thin_remedy("That page"),
    ))


def layout_signature(slide):
    """Sorted multiset of top-level component ids plus the row/column shape."""
    instances = [c for c in top_level_instances(slide)]
    if not instances:
        return None
    rows = []
    for instance in sorted(instances, key=lambda c: ((c.get("frame") or {}).get("y", 0),
                                                     (c.get("frame") or {}).get("x", 0))):
        frame = instance.get("frame") or {}
        y, height = float(frame.get("y", 0)), float(frame.get("height", 0))
        placed = False
        for row in rows:
            ry, rh = row["y"], row["height"]
            overlap = min(y + height, ry + rh) - max(y, ry)
            if overlap > 0.5 * min(height, rh):
                row["members"].append(instance)
                row["y"] = min(ry, y)
                row["height"] = max(ry + rh, y + height) - row["y"]
                placed = True
                break
        if not placed:
            rows.append({"y": y, "height": height, "members": [instance]})
    # A section is described by what it holds: two charts side by side and a chart
    # beside a table are different pages even though both are one row of two panels.
    def inside(inner, outer):
        a, b = inner.get("frame") or {}, outer.get("frame") or {}
        return (a.get("x", 0) >= b.get("x", 0) - 1 and a.get("y", 0) >= b.get("y", 0) - 1
                and a.get("x", 0) + a.get("width", 0) <= b.get("x", 0) + b.get("width", 0) + 1
                and a.get("y", 0) + a.get("height", 0) <= b.get("y", 0) + b.get("height", 0) + 1)
    def describe(c):
        comp = str(c.get("component"))
        if comp != "section":
            return comp
        inner = sorted(str(k.get("component")) for k in slide.get("componentInstances", []) if k is not c and is_exhibit(k) and inside(k, c))
        return "section(" + ",".join(inner) + ")" if inner else "section"
    components = sorted(describe(c) for c in instances)
    shape = "x".join(str(len(row["members"])) for row in rows)
    return f"{'+'.join(components)}|{shape}"


def shape_constrained(slide):
    """A page with nothing to arrange.

    One exhibit and no commentary leaves the composer one viable shape, and it
    should: there is no second block on the page to put anywhere. A deck of
    these pages is flat because of what its pages carry, not because of how
    they are laid out, and telling its author to vary the layout sends them
    looking for a shape that does not exist. This is how the flatness finding
    tells the two cases apart.
    """
    instances = [c for c in top_level_instances(slide) if is_exhibit(c)]
    if len(instances) != 1:
        return False
    exhibit = instances[0]
    frame = exhibit.get("frame") or {}
    bottom = float(frame.get("y", 0)) + float(frame.get("height", 0))
    # Commentary is a text block the shape has to find room for: a points
    # column, a paragraph, a callout, a metrics strip, an insight beside the
    # exhibit. A closing line *under* the exhibit is not - every shape has room
    # for a full-width band at the foot, so a page carrying one exhibit and a
    # so-what still has exactly one shape to take.
    commentary = {"bullet-list", "paragraph", "callout", "insight", "metric", "metrics", "takeaways"}
    for instance in top_level_instances(slide):
        if instance is exhibit:
            continue
        if str(instance.get("component") or "") not in commentary:
            continue
        other = instance.get("frame") or {}
        if float(other.get("y", 0)) < bottom - 1:
            return False
    return True


def page_architecture(slide):
    """The page's shape with the exhibit types abstracted away.

    `layout_signature` names the components, so a bar chart beside a column of
    points and a line chart beside a column of points are two signatures - and a
    deck can run 69% of its pages on one architecture while LAYOUT_MONOTONY sees
    nothing. This is the coarser reading: what the page is *made of* (a measured
    exhibit, a table, a diagram, a picture, text) and how those blocks are
    arranged, which is what a reader sees from across the room.
    """
    family = {
        "chart": "measure", "table": "table", "rows": "table", "compare": "table",
        "phase-table": "table", "metric": "measure", "image-frame": "picture",
        "bullet-list": "text", "paragraph": "text", "insight": "text", "callout": "text",
    }

    def kind(component):
        name = str(component or "")
        if name.startswith("chart."):
            return "measure"
        for prefix, value in family.items():
            if name == prefix:
                return value
        return "diagram"

    # Read the actual exhibit and commentary leaves, not section containers.
    # Filtering to exhibits alone erased the text from chart-plus-commentary
    # layouts and falsely classified every one as a lone chart.
    commentary = {"bullet-list", "paragraph", "insight", "callout", "metric", "metrics"}
    instances = [c for c in slide.get("componentInstances", [])
                 if is_exhibit(c) or c.get("component") in commentary]
    if not instances:
        return None
    rows = {}
    for instance in instances:
        frame = instance.get("frame") or {}
        band = int(float(frame.get("y", 0)) // ARCH_BAND)
        rows.setdefault(band, []).append(kind(instance.get("component")))
    shape = ";".join(
        "+".join(sorted(members)) for _, members in sorted(rows.items())
    )
    return shape


def column_shape(slide):
    """How this page marks its commentary column, read off the drawn nodes.

    A numbered disc, a letter, an icon, a hairline or nothing: the device the
    reader sees. Five consecutive pages of numbered discs is the defect the
    review caught, and no page-level gate could see it because each page was
    otherwise different.
    """
    roles = {str(n.get("role") or "") for n in slide.get("nodes", []) if n.get("type") in ("text", "rect", "ellipse", "path")}
    if "list-icon-glyph" in roles or "list-icon" in roles:
        return "icon"
    if "list-marker-label" in roles:
        return "numbered"
    if "list-rule" in roles:
        return "ruled"
    if "list-marker" in roles:
        return "bulleted"
    if "list-lead" in roles or "list-item" in roles:
        return "prose"
    return None


def gate_column_monotony(slides, content_indexes, findings):
    """COLUMN_MONOTONY, deck level.

    Four or more consecutive analytical pages whose commentary column uses the
    same device. The reference decks mark a column with icons, an accent lead
    phrase, a hairline or nothing at all, and reserve the numbered disc for an
    ordered ledger; a deck that reaches for one device every time reads as one
    page repeated even when its exhibits differ.
    """
    # The defect is a distinctive device used page after page - a numbered
    # disc, an icon, a letter. The house bullet and unmarked prose are the
    # absence of a device rather than an overused one, so a run of those is not
    # what this gate is about; THIN_COLUMN and POINT_DEPTH cover thin columns.
    marked = {"numbered", "icon", "lettered"}
    run, start, previous = 0, None, None
    worst = None
    for index in content_indexes:
        shape = column_shape(slides[index])
        if shape not in marked:
            shape = None
        if shape and shape == previous:
            run += 1
        else:
            run, start = 1, index
        previous = shape
        if shape and run >= THRESHOLDS["column_run_max"] and (worst is None or run > worst[0]):
            worst = (run, shape, start)
    if not worst:
        return
    run, shape, start = worst
    findings.append(finding(
        None, "COLUMN_MONOTONY", {"shape": shape, "run": run, "from": start + 1},
        f"at most {THRESHOLDS['column_run_max'] - 1} consecutive pages marked the same way",
        "The commentary column reaches for one device page after page. Set "
        "`pointsStyle` on some of these pages, or drop it and let the composer "
        "rotate: icon-lead (an icon and the lead running into the sentence in "
        "the accent), ruled (a hairline between items), prose (a bold lead and "
        "its paragraph), lettered (options rather than steps). The numbered "
        "disc belongs on an ordered ledger.",
    ))


def gate_page_shape_flat(slides, content_indexes, findings, fill):
    """PAGE_SHAPE_FLAT, deck level.

    Measured over the reference client decks, a deck runs about five distinct
    page architectures per ten analytical pages and never lets one architecture
    past a quarter of them. A deck built before the composer scored its shapes
    ran 1.3 per ten with 69% on one, which no page-level gate could see.
    """
    # A catalogue declares itself airy: every page there exists to show one
    # encoding, so one architecture repeated is the point, not the defect.
    if fill == "airy":
        return
    shapes = [page_architecture(slides[i]) for i in content_indexes]
    shapes = [s for s in shapes if s]
    if len(shapes) < THRESHOLDS["shape_variety_from"]:
        return
    counts = {}
    for shape in shapes:
        counts[shape] = counts.get(shape, 0) + 1
    # Measure local variety in ten-page windows. Dividing the global number
    # of shapes by total length penalized a varied 50-page deck solely for
    # being longer than a ten-page deck using the same repertoire.
    window = min(10, len(shapes))
    per_ten = sum(len(set(shapes[i:i + window])) * 10.0 / window
                  for i in range(len(shapes) - window + 1)) / (len(shapes) - window + 1)
    top_shape, top_count = max(counts.items(), key=lambda kv: kv[1])
    top_share = top_count / float(len(shapes))
    if per_ten >= THRESHOLDS["shapes_per_ten_min"] and top_share <= THRESHOLDS["shape_share_max"]:
        return
    # Which pages had a choice to make. A page carrying one exhibit and no
    # commentary has one viable shape, so a deck built from those is flat for a
    # reason no layout change can reach - and the remedy has to say so, with the
    # pages named, or the author goes looking for a shape that does not exist.
    constrained = [content_indexes[i] + 1 for i, slide in enumerate(slides[j] for j in content_indexes)
                   if page_architecture(slide) and shape_constrained(slide)]
    constrained_share = len(constrained) / float(len(shapes))
    if constrained_share >= 0.5:
        remedy = (
            f"{len(constrained)} of {len(shapes)} pages carry one exhibit and no "
            "commentary, which leaves the composer one shape to choose from - so "
            "the deck is flat because of what its pages hold, not how they are "
            "laid out, and no layout change will reach it. Give those pages what "
            "a reference page carries: two to four points of commentary beside "
            "or beneath the exhibit, a kpi where the story has a number, a "
            "second cut of the same data. The shapes follow the content. Pages: "
            + ", ".join(str(n) for n in constrained[:20])
            + ("…" if len(constrained) > 20 else "")
        )
    else:
        remedy = (
            "The deck is built from too few page shapes, so it reads as one page "
            "repeated. Reference client decks run about five architectures per "
            "ten pages: an exhibit with its commentary beside it, the same "
            "exhibit full width with the commentary in columns beneath, two "
            "exhibits contrasted, one hero number with its proof, a full-bleed "
            "table. Drop any explicit `layout` on these pages and let the "
            "composer choose, which rotates through the shapes that fit."
        )
    findings.append(finding(
        None, "PAGE_SHAPE_FLAT",
        {"shapesPerTen": round(per_ten, 1), "commonest": top_shape,
         "commonestShare": round(top_share, 2), "pages": len(shapes),
         "constrainedPages": constrained},
        f"{THRESHOLDS['shapes_per_ten_min']} distinct architectures per ten pages, none past {int(THRESHOLDS['shape_share_max'] * 100)}%",
        remedy,
    ))


def gate_layout_monotony(slides, content_indexes, findings):
    """LAYOUT_MONOTONY, deck level. No signature over 40% of content slides."""
    counts = {}
    for index in content_indexes:
        signature = layout_signature(slides[index])
        if signature is None:
            continue
        counts.setdefault(signature, []).append(index + 1)
    total = sum(len(v) for v in counts.values())
    if total < 3:
        return
    for signature, members in sorted(counts.items(), key=lambda kv: -len(kv[1])):
        share = len(members) / float(total)
        if share > THRESHOLDS["monotony_max"]:
            findings.append(finding(
                None, "LAYOUT_MONOTONY",
                {"signature": signature, "slides": members, "share": round(share, 4)},
                THRESHOLDS["monotony_max"],
                "Vary the page architecture: a scorecard, a full-bleed exhibit and "
                "a two-column comparison cannot all be the same frame.",
            ))


# --- driver ----------------------------------------------------------------


def configure(fill=None, declared=None):
    """Set the module's thresholds and weight floors for one deck.

    The geometric thresholds move with the deck's fill level and the word floors
    come from its weight contract - its own, or the one a template's house
    profile measured, falling back to the fill level's. Several gates read both,
    and one (the text page's ink floor) is derived from them, so this is the one
    place either is set.
    """
    fill = fill or DEFAULT_FILL
    if fill not in FILL_LEVELS:
        raise ValueError(f"Unknown fill level: {fill}")
    THRESHOLDS.update(FILL_LEVELS[fill])
    WEIGHT.clear()
    WEIGHT.update(WEIGHT_BY_FILL.get(fill, WEIGHT_BY_FILL[DEFAULT_FILL]))
    if isinstance(declared, dict):
        for key, value in declared.items():
            if key in WEIGHT and isinstance(value, (int, float)):
                WEIGHT[key] = value
    return fill


def run_gates(scene, render_dir=None, profile=None, gates=None):
    if profile is not None and profile not in PROFILES:
        raise ValueError(f"Unknown density profile: {profile}")
    fill = configure(scene.get("fill"), scene.get("weight"))
    slides = scene.get("slides", [])
    findings = []
    content_indexes = []
    covers = []
    for index, slide in enumerate(slides):
        slide_no = index + 1
        if render_dir and render_path(render_dir, slide_no) is None:
            findings.append(finding(slide_no, "MISSING_RENDER", "absent", "one PNG per slide", "Render every slide before running page gates."))
        slide_profile = profile or slide.get("density") or DEFAULT_PROFILE
        if slide_profile not in PROFILES:
            raise ValueError(f"Unknown density profile: {slide_profile}")
        cover = is_cover(slide, index)
        if cover:
            covers.append(slide_no)
        else:
            content_indexes.append(index)
        selected = gates or set()

        def wanted(code):
            return not selected or code in selected

        if not cover:
            if render_dir and (wanted("INK_COVERAGE") or wanted("DEAD_BAND") or wanted("INTERNAL_VOID") or wanted("COLUMN_VOID")):
                path = render_path(render_dir, slide_no)
                if path is not None:
                    rows = load_ink_rows(path)
                    occupied = load_ink_rows(path, SURFACE_LUMINANCE)
                    page = []
                    # A page with no exhibit is held to the type floor: the ink
                    # its own word floor puts on the canvas, not the ink a chart
                    # page shows.
                    text_page = not any(is_exhibit(c) for c in slide.get("componentInstances", []))
                    gate_ink_and_dead_band(slide_no, rows, page, occupied, text_page=text_page)
                    if THRESHOLDS["column_void_max"] < 1.0 and wanted("COLUMN_VOID"):
                        gate_column_void(slide_no, load_ink_matrix(path, SURFACE_LUMINANCE), page)
                    # A page carried by a qualifying hero exhibit is not empty,
                    # however thin its marks (a line chart, a map): INK_COVERAGE
                    # then defers to the hero and band gates.
                    hero = []
                    gate_hero_exhibit(slide_no, slide, hero, path)
                    has_exhibit = any(is_exhibit(c) for c in slide.get("componentInstances", []))
                    has_hero = has_exhibit and not hero
                    findings.extend(f for f in page if wanted(f["code"])
                                    and not (f["code"] == "INK_COVERAGE" and has_hero))
            if wanted("WORDS"):
                gate_words(slide_no, slide, findings, slide_profile)
            if wanted("HERO_EXHIBIT"):
                gate_hero_exhibit(slide_no, slide, findings, render_path(render_dir, slide_no) if render_dir else None)
            page = []
            gate_title(slide_no, slide, page)
            findings.extend(f for f in page if wanted(f["code"]))
            if wanted("CPL"):
                gate_cpl(slide_no, slide, findings)
            if wanted("MISSING_ARGUMENT"):
                gate_missing_argument(slide_no, slide, findings)
            if wanted("THIN_PAGE"):
                gate_thin_page(slide_no, slide, findings)
            if wanted("UNSOURCED_PICTURE"):
                gate_unsourced_picture(slide_no, slide, findings)
            if wanted("THIN_COLUMN") or wanted("POINT_DEPTH"):
                page = []
                gate_thin_column(slide_no, slide, page)
                findings.extend(f for f in page if wanted(f["code"]))
            if wanted("PLOT_SPAN"):
                gate_plot_span(slide_no, slide, findings)
            if wanted("THIN_TABLE"):
                gate_thin_table(slide_no, slide, findings)
            if wanted("NUMBERS_ON_MARKS"):
                gate_numbers_on_marks(slide_no, slide, findings)
            if wanted("UNANNOTATED"):
                gate_unannotated(slide_no, slide, findings)
            if wanted("THIN_EVIDENCE"):
                gate_thin_evidence(slide_no, slide, findings)
            if wanted("HEADING_WRAPS"):
                gate_heading_wraps(slide_no, slide, findings)
            if wanted("METRIC_STACK"):
                gate_metric_stack(slide_no, slide, findings)
            if wanted("RESTATEMENT"):
                gate_restatement(slide_no, slide, findings)
            if wanted("CAVEAT_HEAVY"):
                gate_caveat_heavy(slide_no, slide, findings)
            if wanted("TWIN_CELLS"):
                gate_twin_cells(slide_no, slide, findings)
            if wanted("CONTRADICTED_SHARE"):
                gate_contradicted_share(slide_no, slide, findings)
        if wanted("PLANNING_VOICE"):
            gate_planning_voice(slide_no, slide, findings)
        if wanted("TYPE_RANGE"):
            gate_type_range(slide_no, slide, findings, slide_profile)
        if wanted("NICE_TICKS"):
            gate_nice_ticks(slide_no, slide, findings)
    if not gates or "LAYOUT_MONOTONY" in gates:
        gate_layout_monotony(slides, content_indexes, findings)
    if not gates or gates & {"IMAGE_BUDGET", "IMAGE_RUN"}:
        gate_image_budget(slides, content_indexes, findings)
    if not gates or gates & {"EVIDENCE_MIX", "PAGE_VARIETY"}:
        gate_evidence_mix(slides, content_indexes, findings)
    if not gates or "NO_SECTIONS" in gates:
        gate_deck_structure(slides, content_indexes, findings)
    if not gates or "NO_CONTENTS" in gates or "NO_SUMMARY" in gates:
        gate_deck_front_matter(slides, content_indexes, findings, fill)
    if not gates or "DECK_FLAT" in gates:
        gate_deck_shape(slides, content_indexes, findings, fill)
    if not gates or "PAGE_SHAPE_FLAT" in gates:
        gate_page_shape_flat(slides, content_indexes, findings, fill)
    if not gates or "COLUMN_MONOTONY" in gates:
        gate_column_monotony(slides, content_indexes, findings)
    if not gates or "TABLE_SCHEMA_FLAT" in gates:
        gate_table_schema_flat(slides, content_indexes, findings)

    # A density report beside the findings: the numbers this review is about, so
    # a regression shows up as a number rather than as a screenshot.
    measured_words, measured_columns, measured_spans, measured_footers = [], [], [], []
    for index in content_indexes:
        slide = slides[index]
        body_words, footer_words, _band_words = body_bands(slide)
        measured_words.append(body_words)
        measured_footers.append(footer_words)
        for column in side_columns(slide):
            frame = column.get("frame") or {}
            height = float(frame.get("height") or 0)
            content = nodes_inside(slide, frame, lambda n: n.get("type") in ("text", "image"))
            if height >= 120 and content:
                bottom = max((n["frame"].get("y", 0) + n["frame"].get("height", 0)) for n in content)
                measured_columns.append((bottom - frame.get("y", 0)) / height)
        for instance in slide.get("componentInstances", []):
            component = str(instance.get("component") or "")
            if component not in ("chart.column", "chart.bar", "chart.stacked-column", "chart.stacked-bar"):
                continue
            frame = instance.get("frame") or {}
            marks = nodes_inside(slide, frame, lambda n: str(n.get("role") or "") == "chart-mark")
            if len(marks) < 2:
                continue
            if component in ("chart.bar", "chart.stacked-bar"):
                low = min(m["frame"].get("x", 0) for m in marks)
                high = max(m["frame"].get("x", 0) + m["frame"].get("width", 0) for m in marks)
                measured_spans.append((high - low) / max(1.0, float(frame.get("width") or 1)))
            else:
                low = min(m["frame"].get("y", 0) for m in marks)
                high = max(m["frame"].get("y", 0) + m["frame"].get("height", 0) for m in marks)
                measured_spans.append((high - low) / max(1.0, float(frame.get("height") or 1)))

    def median(values):
        if not values:
            return None
        ordered = sorted(values)
        middle = len(ordered) // 2
        value = ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2
        return round(value, 3)

    density = {
        "bodyWords": {"median": median(measured_words), "min": min(measured_words) if measured_words else None,
                      "floor": WEIGHT.get("pageWords"), "referenceMedian": REFERENCE_PAGE_BANDS["body"]},
        "footerWords": {"median": median(measured_footers), "referenceMedian": REFERENCE_PAGE_BANDS["footer"]},
        "columnFill": {"median": median(measured_columns), "floor": WEIGHT.get("columnFill"), "columns": len(measured_columns)},
        "plotSpan": {"median": median(measured_spans), "floor": WEIGHT.get("plotSpan"), "charts": len(measured_spans)},
    }

    by_code = {}
    for item in findings:
        by_code[item["code"]] = by_code.get(item["code"], 0) + 1
    return {
        "schema": "professional-slides.page-gates/v1",
        "profile": profile,
        "fill": fill,
        "weight": dict(WEIGHT),
        "density": density,
        "slides": len(slides),
        "coverSlides": covers,
        "contentSlides": len(content_indexes),
        "accepted": not findings,
        "countsByCode": dict(sorted(by_code.items())),
        "findings": findings,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Deterministic page gates")
    parser.add_argument("scene")
    parser.add_argument("render_dir", nargs="?", default=None,
                        help="Directory of slide-N.png renders; ink gates are skipped without it")
    parser.add_argument("--report", default=None)
    parser.add_argument("--profile", default=None, choices=sorted(PROFILES))
    parser.add_argument("--only", default=None, help="Comma-separated gate codes to run")
    args = parser.parse_args(argv)

    scene = load_scene(args.scene)
    gates = {c.strip() for c in args.only.split(",")} if args.only else None
    report = run_gates(scene, args.render_dir, args.profile, gates)
    if args.report:
        out = Path(args.report)
        tmp = out.with_suffix(out.suffix + ".tmp")
        tmp.write_text(json.dumps(report, indent=1), encoding="utf-8")
        os.replace(tmp, out)
    else:
        print(json.dumps(report, indent=1))
    counts = ", ".join(f"{k}={v}" for k, v in report["countsByCode"].items()) or "none"
    print(f"page gates: {'accepted' if report['accepted'] else 'REJECTED'} | {counts}", file=sys.stderr)
    return 0 if report["accepted"] else 2


if __name__ == "__main__":
    sys.exit(main())
