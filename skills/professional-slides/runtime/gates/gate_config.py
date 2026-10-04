"""What every page gate shares: the weight contract and the thresholds read
from it, the role and component vocabularies, the gate code vocabulary and
its severity rules, and the scene readers the gates use.

`configure` and `configure_rules` set the thresholds, the weight floors and
the waived rules for one deck. They update THRESHOLDS, WEIGHT, WAIVED and
RULES_OF_DECK in place, so a module that imported those names reads the
deck's values.
"""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

from ink import CANVAS_H, CANVAS_W

# The weight contract and the benchmark figures it is set against. One file, read
# here and by runtime/weight.mjs, so a floor cannot move in the composer
# without moving in the finding that reports it.
CONTRACT = json.loads((Path(__file__).resolve().parent.parent / "weight.json").read_text(encoding="utf-8"))

NUMERIC_TOKEN = re.compile(r"^[-−+(]?[$€£]?\d[\d,.]*[%×xkmbn]*\)?$", re.I)
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
    "cover-title", "cover-subtitle", "section-title", "action-subtitle", "kicker",
    "tracker-compact-label", "tracker-compact-marker-label", "category-note",
    "chart-heading", "chart-title", "metric-value", "metric-label", "metric-sublabel",
}
# The one piece of text on a page that a reference deck's pages do not carry:
# the runtime's section tracker, a strip of section labels or marker numbers
# repeated on every page. The text-form band (weight.json plan.textForm) was
# measured on reference PDFs as pdftotext reads them - chart headings, units,
# axis rows, category and data labels and legends included, since a PDF's text
# does not say which words are a chart's - so the measure of our pages
# (density_profile.py) takes out the tracker and nothing else. Taking the
# chart's scaffolding out too raised our pages' median words a block by about
# ten against a band that had counted it, which lowered the floor by as much.
def is_tracker(node):
    """Whether a text node is the runtime's section tracker."""
    return str(node.get("role") or "").startswith("tracker")


PROSE_ROLES = {"paragraph", "body", "body-text"}
LIST_PROSE_ROLES = {"list-item"}
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
# The picture credits, and its continuation pages when a long list paginates.
GENERATED_PAGE = re.compile(CONTRACT["analyticalPage"]["generated"])
# Navigation, not evidence (weight.json analyticalPage): the cover, dividers,
# agendas and trackers, and the closing takeaways and statement pages.
STRUCTURAL_COMPONENTS = set(CONTRACT["analyticalPage"]["structuralComponents"])
# A photograph, not an icon, a logo mark or a spot image: a well-made deck
# carries a small image on about half their pages (median 0.5% of the page), and
# those are marks, not decoration. A photograph covers 3% of the canvas and up.
PHOTO_MIN_AREA = 0.03 * CANVAS_W * CANVAS_H

TYPE_RANGES = {
    "body": (10.0, 14.0),
    # A strong deck runs twenty- and thirty-row tables small rather than
    # splitting them, and a cell is a lookup value, not prose. The floor is the
    # densest rung the composer actually has: `compact` sets cells at
    # type.compact, 9 pt, and `dense` at type.label, 8.5. A floor above the last
    # rung leaves a table the density ladder pushed there nowhere to go.
    "table-dense": (8.5, 14.0),
    "chart-furniture": (8.0, 11.0),
    "action-title": (20.0, 26.0),
    "source": (7.0, 9.0),
}

# How full the deck means to read (`fill` on the spec, carried on the scene).
# Emptiness is right for a live-pitch deck and wrong for a pre-read, so the
# three geometric thresholds move with it; nothing else does.
# Ink is set against a benchmark, not against taste: well-made pages run a
# median ink share of 0.191, a first quartile of 0.112 and a tenth percentile
# of 0.077. A document-weight page floors at the quartile, a balanced page at
# the tenth percentile, an airy page below both.
FILL_LEVELS = CONTRACT["geometryByFill"]
# The benchmark figures, three views of a well-made page. `slides` holds the
# pixel and band figures on this same 1280x720 canvas, `benchmark` the page-text
# word counts, and `judged` the rates at which a deck emphasises, sources and
# annotates.
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
# How long a deck must be before each deck-wide rule reads it.
DECK_LENGTH = CONTRACT["deckLength"]

# What a page of this deck is expected to carry. The deck's `weight` (its own,
# or the one a template's house profile measured) is carried on the scene, and
# these are the fallbacks by fill level. Every number is a floor, never a
# ceiling — the ceiling on prose is WORDS, and density is only a defect when
# the content is not.
WEIGHT_BY_FILL = CONTRACT["byFill"]
# Page text on a well-made analytical page (weight.json reference.benchmark).
# The floors sit below that on purpose.
REFERENCE_PAGE_WORDS = CONTRACT["reference"]["benchmark"]
# The same page split into its three bands: what a well-made analytical slide
# carries where.
REFERENCE_PAGE_BANDS = dict(REFERENCE_PAGE["bands"])

# Density profiles change how much prose a page may carry; they never relax a
# geometric or typographic threshold.
#
# Derived from the benchmark rather than chosen: a well-made page runs a median
# of 196 words of page text (185 on an analytical slide), and a ceiling under
# the median of the work the deck imitates is not a ceiling, it is a tax.
#
# A page whose evidence is an exhibit spends its area on the exhibit, so its
# prose ceiling is the measured body band; a page whose evidence *is* its prose
# may run to the benchmark figure for its density.
_BODY_BAND = REFERENCE_PAGE["bands"]["body"]          # the reference body band, measured band by band
PROFILES = {
    # Read from a stage: the body band cut back, and the benchmark's lower quartile.
    "live-pitch": {"words_exhibit": round(_BODY_BAND * 0.6), "words_text": REFERENCE_PAGE_WORDS["p25"]},
    # The default, and the benchmark at its middle.
    "executive": {"words_exhibit": _BODY_BAND, "words_text": REFERENCE_PAGE_WORDS["median"]},
    # Read at a desk: the benchmark's upper quartile.
    "pre-read": {"words_exhibit": round(_BODY_BAND * 1.4), "words_text": REFERENCE_PAGE_WORDS["p75"]},
    # Source-rich support behind the story, set in the smallest approved type:
    # it carries more words in the same frame, by design.
    "appendix": {"words_exhibit": round(_BODY_BAND * 1.75), "words_text": round(REFERENCE_PAGE_WORDS["p75"] * 1.25)},
}
DEFAULT_PROFILE = "executive"

# Which stacked row of the page a component sits in, for `page_architecture`.
# A page stacks at most six bands of content between its title and its footer,
# so the band is the canvas divided by six.
ARCH_BAND = CANVAS_H // 6
WEIGHT = dict(WEIGHT_BY_FILL[DEFAULT_FILL])

THRESHOLDS = {
    # The geometric bars move with fill (configure): ink_min, dead_band_max,
    # internal_void_max, column_void_max and their `_block` bars, read from
    # weight.json geometryByFill. The default fill's are set here. ink_min is
    # waived when a qualifying hero exhibit carries the page (a line chart is
    # ink-light by nature).
    **FILL_LEVELS[DEFAULT_FILL],
    "exhibit_ink_min": 0.02,     # a hero frame must carry ink, not just area (a line chart sits near 2-3%, a 12pt table near 5-6%)
    "title_lines_max": 2,
    "title_words_max": CONTRACT["plan"]["titleWords"]["max"],  # the compiler refuses past it too (page-types.mjs)
    "cpl_min": 35,
    "cpl_max": 90,
    "hero_area_min": 0.40,
    "monotony_max": 0.35,
    "image_pages_max": 0.30,   # photographs on more than three pages in ten
    "photo_area_min": 0.03,    # a photograph covers 3% of the page; smaller images are marks (logos, icons, spot art)
    "image_run_max": 2,        # consecutive analytical pages carrying photographs
    "data_pages_min": 0.45,    # pages whose evidence is a chart, a table or measured tiles
    "families_min": 3,         # distinct page families in a deck of ten pages or more
    # Analytical pages before each deck-wide rule reads the deck (weight.json deckLength).
    "sections_from": DECK_LENGTH["sections"],          # a deck needs sections and a tracker
    "deck_shape_from": DECK_LENGTH["deckShape"],       # a deck needs a heavy page among the light ones
    "shape_variety_from": DECK_LENGTH["shapeVariety"],  # the deck needs more than one page architecture
    "shapes_per_ten_min": 3.0,  # distinct architectures per ten pages (a strong deck runs about five)
    "shape_share_max": 0.40,    # share of pages on the commonest architecture (a strong deck's median is 0.23)
    "front_matter_from": DECK_LENGTH["frontMatter"],  # a deck needs a contents page and an opening summary
    "column_run_max": 4,        # consecutive pages whose commentary column may share one device
    # What the page says. Set on the four example decks in the repository -
    # `--report` prints the measured value beside the floor so the number can
    # be argued with.
    # Share of the commentary's own content words already printed in the exhibit
    # beside it. Strong commentary runs a median of 0.25-0.36 and a p90 of 0.47;
    # at 0.47 it flags the worst tenth, which is what a gate about a tail is for.
    "restatement_max": 0.47,
    "restatement_words_min": 12,  # below this the overlap is noise, not a pattern
    # One block is read on its own, so it is judged on its own, and a sentence
    # is shorter than a column: six content words is a sentence with something
    # in it. The bar is higher than the column's, because a short sentence that
    # names two categories shares their words by naming them - "asset
    # valuations and public debt sit mid-table and moved little" is a reading,
    # not a restatement, and runs 0.57 on a well-made page. Past two thirds
    # there is nothing left in the sentence that the exhibit did not supply.
    "restatement_block_words_min": 6,
    "restatement_block_max": 0.66,
    # DECK_CRAFT's own floors are not here: they live beside the observations
    # they rest on, in `weight.json` under `plan.craft`, read through CONTRACT,
    # and `test_weight_contract` holds them to that one home.
    #
    # Commentary on most pages is not a defect, so nothing caps commentary
    # columns per page; commentary that says the exhibit again is, and
    # RESTATEMENT measures exactly that. One question, one instrument.
    "caveats_max": 2,           # caveat lines per page; a strong deck runs at most two
    "schema_repeat_max": 3,     # pages that may open their table with the same column headers
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
    return bool(components & STRUCTURAL_COMPONENTS) or (index == 0 and "slide-chrome" not in components)


def content_frame(slide):
    frame = slide.get("contentFrame")
    if isinstance(frame, dict) and frame.get("width") and frame.get("height"):
        return frame
    return {"x": 60, "y": 162, "width": 1160, "height": 506}


# --- the gate vocabulary ---------------------------------------------------
#
# Every code a gate can emit, with the one line that says what it is about. A
# test holds the documentation, and the codes the gates' source emits, to it.
GATE_CODES = {
    "INK_COVERAGE": "the content area carries too little ink to read as a page",
    "DEAD_BAND": "a trailing band of nothing under the content",
    "INTERNAL_VOID": "a gap between two content blocks the page does nothing with",
    "COLUMN_VOID": "a column of the page leaves a band empty that the page-wide bands cannot see",
    "TITLE_LINES": "an action title over two lines",
    "TITLE_WORDS": "an action title past the word budget",
    "TYPE_RANGE": "type set outside the approved range for its role",
    "CPL": "a measure too narrow or too wide to read",
    "TAKEAWAY_LONG": "a takeaway band set past two lines, which makes it a paragraph",
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
    "THIN_EVIDENCE": "fewer exhibit instances than the density reference",
    "NUMBERS_ON_MARKS": "marks carrying no printed value",
    "UNANNOTATED": "a plot with no bracket, flag, change bubble or base",
    "NICE_TICKS": "an axis on numbers a reader would not choose",
    "DECK_FLAT": "no page in the deck carries the detail",
    "MISSING_RENDER": "a page the gates could not measure because it did not render",
    "UNSOURCED_PICTURE": "a picture frame drawn empty because its file was never cleared",
    # What the page says, rather than how it is drawn (semantic_gates.py), and
    # what the deck does across its pages. Every gate above this line measures
    # geometry or typography, and a deck can clear all of them while saying
    # nothing its exhibits do not.
    "TWIN_CELLS": "a comparison table whose compared columns say the same thing",
    "RESTATEMENT": "commentary that repeats the exhibit instead of reading it",
    "PLANNING_VOICE": "planning language left on the page",
    "CAVEAT_HEAVY": "a page spending more of itself on limits than on findings",
    "TABLE_SCHEMA_FLAT": "the same table invented over and over across the deck",
    "CONTRADICTED_SHARE": "a percentage in the prose the page's own counts do not give",
    "DECK_CRAFT": "the deck emphasises, sources or comments at a rate strong decks do not",
    "DECK_VOCABULARY": "the deck draws a couple of devices and leaves the rest of the vocabulary unused",
    "UNSCALED_FIGURE": "a figure drawn to a scale its own printed numbers contradict",
    "TITLE_COUNT": "the title states a count the page's own exhibit does not show",
    "DECK_THIN_PAGES": "nearly a third or more of the deck's pages are thin or half empty",
    # Read off the composed scene, so they run at authoring as well as at the
    # build: the render's band gates only run once there is a render.
    "SCENE_VOID": "a band of the page's body, measured on the scene, that nothing crosses",
    "RENDER_DRIFT": "the render shows an empty band the scene does not draw: something the scene holds did not reach the page",
    "DECK_SCENE_VOID": "nearly a third or more of the deck's pages leave a band of their body empty",
    # The page's visual weight, estimated from the scene (scene_ink.py).
    "SCENE_INK": "a page with an exhibit that will ink too little of its body to read as weighted at a glance",
    "DECK_INK": "the deck's median analytical page will ink too little of its body",
}

# Distribution and furniture statistics prompt human review; they do not
# establish a defect without the page's semantic task and visual context. The
# void codes among them block past their bars (VOID_BLOCK, severity).
ADVISORY_CODES = {
    "INK_COVERAGE", "THIN_PAGE", "DECK_FLAT", "DECK_CRAFT", "DECK_VOCABULARY", "EVIDENCE_MIX", "PAGE_VARIETY",
    "DEAD_BAND", "INTERNAL_VOID", "UNANNOTATED", "LAYOUT_MONOTONY",
    "COLUMN_MONOTONY", "TABLE_SCHEMA_FLAT", "IMAGE_BUDGET", "IMAGE_RUN",
    "THIN_EVIDENCE", "HERO_EXHIBIT", "COLUMN_VOID", "THIN_COLUMN", "NUMBERS_ON_MARKS",
    "SCENE_VOID", "SCENE_INK", "DECK_INK", "RENDER_DRIFT",
}

# The void findings are questions at mild values and block past the fill's
# `_block` bars (weight.json geometryByFill): a band that deep is empty space
# no reading of the page explains. A SCENE_VOID is held to the bar of the band
# it measured (`kind`), so the scene and the render block the same page.
VOID_BLOCK = {"INTERNAL_VOID": "internal_void_block", "DEAD_BAND": "dead_band_block", "COLUMN_VOID": "column_void_block"}
SCENE_VOID_BLOCK = {"internal": "internal_void_block", "dead": "dead_band_block", "column": "column_void_block"}

# Which rules each rules version introduced (weight.json rules). A deck revised
# under the revision workflow that records an older version hears the rules
# introduced after it as advisories; `configure_rules` sets them for one deck.
RULES = CONTRACT["rules"]
RULES_VERSION = CONTRACT["rulesVersion"]
WAIVED = {}
RULES_OF_DECK = {}


def waived_rules(deck):
    """{rule: version introduced} for the rules `deck` ({workflow, rulesVersion}) predates."""
    try:
        version = float((deck or {}).get("rulesVersion"))
    except (TypeError, ValueError):
        return {}
    if (deck or {}).get("workflow") != RULES["revisionWorkflow"] or version >= RULES_VERSION:
        return {}
    return {rule: int(v) for v, rules in RULES["introduced"].items() if int(v) > version for rule in rules}


def configure_rules(deck=None):
    WAIVED.clear()
    WAIVED.update(waived_rules(deck))
    RULES_OF_DECK.clear()
    RULES_OF_DECK.update({k: (deck or {}).get(k) for k in ("workflow", "rulesVersion")})


def void_bar(item):
    """The `_block` bar a void finding is held to, or None for any other
    finding and for a column that is a chart's own frame (PLOT_COMPONENT)."""
    code, measured = item["code"], item.get("measured")
    if isinstance(measured, dict) and measured.get("plot"):
        return None
    key = VOID_BLOCK.get(code) or (SCENE_VOID_BLOCK.get(measured.get("kind")) if code == "SCENE_VOID" and isinstance(measured, dict) else None)
    return THRESHOLDS.get(key) if key else None


def rule_of(item):
    """The rule a finding breaks: its code, or `CODE.tightened` when it falls
    between a bar a rules version lowered and the bar before (rules.tightened)."""
    tightened = RULES.get("tightened", {}).get(item["code"])
    measured = item.get("measured")
    if tightened and isinstance(measured, (int, float)) and not isinstance(measured, bool) and measured <= tightened["before"]:
        return item["code"] + ".tightened"
    return item["code"]


def severity(item):
    """`blocker` or `advisory`, with the rules version that waived a blocker."""
    band = item["measured"].get("band") if isinstance(item.get("measured"), dict) else item.get("measured")
    bar = void_bar(item)
    blocks = item["code"] not in ADVISORY_CODES or (bar is not None and isinstance(band, (int, float)) and band > bar)
    rule = rule_of(item)
    waived = WAIVED.get(rule) or WAIVED.get(item["code"])
    if blocks and waived:
        return {"severity": "advisory", "waived": {"rulesVersion": RULES_OF_DECK.get("rulesVersion"), "introducedIn": waived}}
    return {"severity": "blocker" if blocks else "advisory", **({"blockAbove": bar} if bar is not None and blocks else {})}


# Findings raised before the page is rendered: the composer's plan-time budget
# and the deck's coverage check. They are not gates, but they share the shape.
COMPOSE_CODES = {
    "MISSING_EVIDENCE": "a ranked criterion with no comparative exhibit",
    "EVALUATION_TOO_SHORT": "a deck marked as a skill evaluation composes fewer than fifty pages",
}


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


# Where the deck stands against each deck-level rule, recorded on every run
# whether or not the rule is broken: a deck-level refusal should never be the
# first time its rule is mentioned, so the author's report prints the value,
# the bar and the room left (author-deck.mjs). `run_gates` clears the list
# and writes it into the report as `standings`.
STANDINGS = []


# How PAGE_SHAPE_FLAT counts a rail, said on its standing line: one claim beside the exhibit is a close, not commentary
# (deck-structure.mjs says the same on the line it prints before a deck composes; a test holds the two to one sentence).
RAIL_AS_CLOSE = ("a rail, a so-what bar and a takeaway are one claim each and leave a page evidence-only; "
                 "points, paragraphs, captions and cards make it evidence-with-commentary")


def standing(code, what, value, bar, side, count=None, of=None, unit=None, applies=True, pages=None, each=None, key=None, note=None):
    """Record the deck's standing against the rule `code`.

    `note` says how the rule reads a page where its name does not (printed
    at the end of the standing's line). `what` names the quantity; `value` is held to `bar` on `side` ("max": at
    most, "min": at least). A share carries its `count` of `of` pages, so the
    room left is counted in pages. `applies` is False while the deck is too
    short for the rule to be read. `pages` are the slides counted, and `each`
    maps a slide number to its own contribution to a measured aggregate."""
    if code not in GATE_CODES:
        raise KeyError(f"{code} is not in the gate vocabulary")
    STANDINGS.append({k: v for k, v in {
        "code": code, "key": key, "what": what, "value": value, "bar": bar, "side": side, "count": count, "of": of,
        "unit": unit, "applies": bool(applies), "blocks": code not in ADVISORY_CODES, "pages": pages, "each": each, "note": note,
    }.items() if v is not None})


# The half-empty page, counted across the deck. Each finding it counts is
# advisory, because on one page it can be the right call: a quiet statement, a
# chart that wants air. Across the deck it is not: a review reading the
# argument accepts a page at a time what the deck, counted, shows as a habit.
# Nearly a third of the pages flagged is a habit, and the habit blocks: at
# least `pages_min` of `from` or more content pages, a `share` of them.
DECK_HABIT = {"from": DECK_LENGTH["emptyHabit"], "pages_min": 5, "share": 0.30}
