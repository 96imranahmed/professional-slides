"""Gates that read the deck as a whole: its photographs, craft rates, device
vocabulary, evidence mix, structure and front matter, the weight of its
pages, the variety of its page architectures and commentary columns, and the
half-empty page counted as a habit.

Each gate takes the slides, the indexes of the pages it reads and the
findings list, and appends deck findings (slide None).
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import NamedTuple, Optional

from gate_config import (
    CONTRACT, DECK_HABIT, DECK_LENGTH, REFERENCE_JUDGED, REFERENCE_PAGE, REFERENCE_PAGE_WORDS,
    SOURCE_ROLES, THRESHOLDS, all_components, finding, is_exhibit, page_family, photo_nodes,
    source_text, top_level_instances,
)
from render_gates import page_text_words, thin_remedy
from semantic_gates import COMMENTARY_ROLES


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


# The roles that say a chart was marked; build-bars.mjs reads the same list.
ANNOTATED_ROLE = re.compile(r"^(annotation-|chart-(bracket|delta|event-|highlight|reference|band|callout|change))")
TABLE_COMPONENTS = {"table", "comparison-table", "heatmap", "trend-rows"}
# What makes a table treated, one definition for the three treated-table
# shares (table-treatments.json; build-bars.mjs reads the same file).
TABLE_TREATMENTS = json.loads((Path(__file__).resolve().parent / "table-treatments.json").read_text(encoding="utf-8"))["treatments"]
TREATED_PREFIXES = tuple(p for t in TABLE_TREATMENTS.values() for p in t.get("rolePrefixes", []))
TREATED_CELLS = frozenset(c for t in TABLE_TREATMENTS.values() for c in t.get("cellTypes", []))
TREATED_BANDS = frozenset(b for t in TABLE_TREATMENTS.values() for b in t.get("rowBands", []))
# The devices an author chooses for a table, for which one a deck reaches for
# most: the treatments, and the implication gutter, a value pill, a
# highlighted column, a numbered or photographed row. Banding is not one.
TABLE_DEVICE_ROLE = re.compile(r"^table-(bubble|bar|rating-|implication|column-band|harvey"
                               r"|status-pill|number-circle|lamp|dot|check|progress-"
                               r"|cell-icon|section-marker|section-number|(header-)?logo$|photo$)")


def page_roles(slide):
    return {str(n.get("role") or "") for n in slide.get("nodes", [])}


def exhibit_area(instance):
    frame = instance.get("frame") or {}
    return float(frame.get("width") or 0) * float(frame.get("height") or 0)


def charts_and_tables(slide):
    return [c for c in slide.get("componentInstances", [])
            if str(c.get("component") or "").startswith("chart.")
            or str(c.get("component") or "") in TABLE_COMPONENTS]


# A row block's small table is the row's evidence beside its bullets, not a
# table the page is built on: TABLE_TOO_SHORT exempts it (page-types.mjs
# TABLE_ROWS), and the treated share does not count it. A table is in a row
# block when its nodes descend from a `<page>-block-<n>` section, and small
# under ROW_BLOCK_TABLE_ROWS body rows, a total or group row not being one.
# build-bars.mjs rowBlockSmallTable is the same test.
ROW_BLOCK_TABLE_ROWS = 3
ROW_BLOCK = re.compile(r"-block-\d+$")


def row_block_small_table(slide, instance):
    key = instance.get("instanceId") or instance.get("id")
    nodes = [n for n in slide.get("nodes", []) if (n.get("data") or {}).get("componentInstance") == key]
    if not any(ROW_BLOCK.search(str(a)) for n in nodes for a in (n.get("data") or {}).get("componentAncestors") or []):
        return False
    rows = {(n.get("data") or {}).get("row") for n in nodes}
    banded = {(n.get("data") or {}).get("row") for n in nodes
              if n.get("role") == "table-row-band" and (n.get("data") or {}).get("rowStyle") in ("total", "group")}
    body = len({r for r in rows - banded if isinstance(r, int)})
    return 0 < body < ROW_BLOCK_TABLE_ROWS


def counted_tables(slide):
    """The page's tables a treated share counts: every one but a row block's
    small table (build-bars.mjs countedTables)."""
    return [c for c in slide.get("componentInstances", [])
            if str(c.get("component") or "") in TABLE_COMPONENTS and not row_block_small_table(slide, c)]


def table_nodes(slide, instance):
    """The nodes a table draws: those naming it as their instance. A node that
    names no instance belongs to every table on its page."""
    keys = {instance.get("instanceId"), instance.get("id")} - {None}
    return [n for n in slide.get("nodes", [])
            if (n.get("data") or {}).get("componentInstance") in keys or not (n.get("data") or {}).get("componentInstance")]


def treats(node):
    """Whether `node` is one of a table's treatments (table-treatments.json)."""
    role, data = str(node.get("role") or ""), node.get("data") or {}
    return (role.startswith(TREATED_PREFIXES) or data.get("cellType") in TREATED_CELLS
            or (role == "table-row-band" and data.get("rowStyle") in TREATED_BANDS))


def table_treated(slide, instance):
    return any(treats(n) for n in table_nodes(slide, instance))


def carried_by(pages, test):
    """Pages *carried by* this kind of exhibit, which is what the chart rate
    counts: an exhibit counts only when it is the biggest one on its page, so
    a small exhibit beside a bigger one is read as its furniture."""
    out = []
    for slide in pages:
        exhibits = charts_and_tables(slide)
        if not exhibits:
            continue
        biggest = max(exhibits, key=exhibit_area)
        if test(str(biggest.get("component") or "")):
            out.append(slide)
    return out


def marked_share(carriers, pattern, recoloured=False):
    """The share of `carriers` drawing a role `pattern` matches, or None."""
    if not carriers:
        return None

    def marked(slide):
        if any(pattern.match(r) for r in page_roles(slide)):
            return True
        # A recoloured category is the commonest mark of all and draws no
        # node of its own: the bar keeps its role and carries `highlighted`.
        return recoloured and any((n.get("data") or {}).get("highlighted")
                                  for n in slide.get("nodes", []))
    return sum(1 for s in carriers if marked(s)) / float(len(carriers))


# The mark in the gutter between an exhibit and the commentary read off it.
# Every page that sets those two side by side has to join them, and the
# strong decks do it in words far more often than they draw it: a named
# heading ("As a result of..."), a headed panel ("Key facts" against
# "Perspectives"), a closing band, or nothing at all. Drawing it is the
# emphatic option and it is spent on the pages where the inference is the
# work. A deck that draws it on every such page has made the reader stop
# seeing it - and the pages where it was earned no longer stand out.
def joins_commentary(slide):
    return bool(charts_and_tables(slide)) and bool(page_roles(slide) & COMMENTARY_ROLES)


def gutter_mark(slide):
    """The device drawn between the page's exhibit and its commentary, or None."""
    for node in slide.get("nodes", []):
        if "-implication" not in str(node.get("id") or ""):
            continue
        data = node.get("data") or {}
        if data.get("arrowVariant"):
            return str(data["arrowVariant"])
        if str(node.get("role") or "") == "relationship-divider":
            return "divider-chevron" if data.get("relation") == "implies" else "rule"
    return None


def commonest_table_device(tables):
    """The commonest chosen device's share of `tables` ((slide, instance)
    pairs), or None.

    Treated is not the same as varied. A deck can carry a device on every
    table and still read as one table repeated, because the device is the
    same one. The vocabulary is wide - a gutter, a tinted conclusion, filled
    category cells, banded rows, status pills, harvey balls, in-cell bars - and
    a deck that uses one of them everywhere has chosen once. Banding is not a
    choice: a grid past five rows bands itself so the reader keeps their place,
    and strong decks band nearly everything. What counts here is the device the
    author chose - the gutter, the pills, the balls, the bars, the filled
    category cells."""
    chosen = []
    for slide, instance in tables:
        roles = {str(n.get("role") or "") for n in table_nodes(slide, instance)}
        chosen.extend(sorted({TABLE_DEVICE_ROLE.match(r).group(0) for r in roles if TABLE_DEVICE_ROLE.match(r)}))
    return max(Counter(chosen).values()) / float(len(tables)) if chosen and tables else None


class CraftRates(NamedTuple):
    """What a deck does over its analytical pages, as DECK_CRAFT reads it."""
    highlighted: float           # pages emphasising a phrase
    sourced: float               # pages carrying a source line
    marks: float                 # drawn primitives that are not type, per page
    tables: list                 # the counted tables, as (slide, instance)
    treated: Optional[float]     # of those, the share carrying a treatment
    annotated: Optional[float]   # pages carried by a chart that marks its finding
    commonest: Optional[float]   # the commonest chosen table device's share
    joined: list                 # pages setting an exhibit against commentary
    inferences: list             # the gutter marks those pages draw
    drawn: Optional[float]       # the share of them drawing one


def craft_rates(pages):
    total = len(pages)

    def share(test):
        return sum(1 for slide in pages if test(slide)) / float(total)

    # Every counted table on a page that argues (weight.json analyticalPage),
    # as build-bars.mjs designStatistics counts them.
    argued = [s for s in pages if s.get("readingTask") or any(n.get("role") == "action-title" for n in s.get("nodes", []))]
    tables = [(slide, c) for slide in argued for c in counted_tables(slide)]
    joined = [s for s in pages if joins_commentary(s)]
    inferences = [d for d in (gutter_mark(s) for s in joined) if d]
    return CraftRates(
        highlighted=share(lambda s: any(
            n.get("runs") and any(r.get("accent") or r.get("bold") for r in n["runs"])
            for n in s.get("nodes", []))),
        sourced=share(lambda s: bool(page_roles(s) & SOURCE_ROLES)),
        marks=sum(len([n for n in s.get("nodes", []) if n.get("type") != "text"]) for s in pages) / float(total),
        tables=tables,
        treated=sum(1 for slide, c in tables if table_treated(slide, c)) / float(len(tables)) if tables else None,
        annotated=marked_share(carried_by(pages, lambda c: c.startswith("chart.")), ANNOTATED_ROLE, recoloured=True),
        commonest=commonest_table_device(tables),
        joined=joined,
        inferences=inferences,
        drawn=len(inferences) / float(len(joined)) if joined else None,
    )


def craft_shortfalls(rates, want, craft):
    """One sentence for each rate on the wrong side of its bar."""
    target = REFERENCE_JUDGED
    short = []
    if rates.highlighted < want["highlight"]:
        short.append(
            f"a phrase is emphasised on {rates.highlighted:.0%} of pages against {target['highlightedPhrase']:.0%} in "
            "strong decks. Review whether the decisive comparison needs emphasis; neutral is valid")
    if rates.sourced < want["source"]:
        short.append(
            f"only {rates.sourced:.0%} of pages carry a source against {target['sourceLine']:.0%}. A measured page "
            "says where the measure came from")
    if rates.treated is not None and rates.treated < want["tablesTreated"]:
        short.append(
            f"{rates.treated:.0%} of the tables carry a treatment against {craft['tableTreated']['observed']:.0%} in "
            f"strong decks. Review the {len(rates.tables)} tables by their reading task; do not add treatment for its frequency")
    if rates.annotated is not None and rates.annotated < want["chartsAnnotated"]:
        short.append(
            f"{rates.annotated:.0%} of the charts carry a mark that states the finding against "
            f"{craft['chartAnnotated']['observed']:.0%} in strong decks. A bracket between the two series the "
            "title compares may help, as may a reference line at a real target; use neither without a content reason")
    if (rates.commonest is not None and len(rates.tables) >= craft["tableDevice"]["from"]
            and rates.commonest > want["commonestTableDevice"]):
        short.append(
            f"{rates.commonest:.0%} of the {len(rates.tables)} tables carry the same device. A treatment repeated on every "
            "table can be right for the same task. Review whether each use expresses its category, sequence or inference")
    if (rates.drawn is not None and len(rates.joined) >= craft["drawnBridge"]["from"]
            and rates.drawn > want["drawnBridges"]):
        commonest_bridge = Counter(rates.inferences).most_common(1)[0]
        short.append(
            f"{rates.drawn:.0%} of the {len(rates.joined)} pages that set an exhibit against its commentary draw a mark "
            f"in the gutter, {commonest_bridge[1]} of them the same one ({commonest_bridge[0]}). Strong "
            "decks carry that relation in the commentary's heading, in a headed panel, in a closing band or in "
            "nothing at all, and draw it on the few pages where the inference is the page's work. Review which "
            "of these pages is actually asserting an inference and let the words join the rest")
    if rates.marks < want["marksPerPage"]:
        short.append(
            f"{rates.marks:.0f} drawn elements a page against a benchmark median of {REFERENCE_PAGE['drawings']}. A page "
            "of rules and paragraphs is what a reader feels before reading a word")
    return short


def gate_deck_craft(slides, analytical, findings):
    """DECK_CRAFT. What the deck does, over its own pages, against what strong
    decks do over theirs.

    The other deck-level gates count shapes - how many families, how many
    architectures, how flat the word distribution is. None of them can see
    what a reader notices first, and each is a share of pages rather than a
    property of one:

      highlight   a phrase set in the accent inside a sentence. Strong decks do
                  this on half their pages and on seven pages of type in ten.
      source      the line that says where the numbers came from. 0.67 in a
                  strong deck; a page without one is a page a reader cannot check.
      marks       drawn primitives that are not type, per page. A strong deck
                  runs a median of 32 and a first quartile of 11.
      treated     tables carrying a device beyond a plain grid. Every one in a
                  strong deck - a plain grid is the exception.
      annotated   charts carrying a mark that states the finding. 0.80 in a
                  strong deck. The build holds the deck to these floors
                  whether or not a plan file exists.
      device      the commonest chosen table device's share of the tables.
      bridges     pages drawing a mark between an exhibit and its commentary.

    One finding for the deck, so the report says what the deck is like rather
    than repeating one complaint per page.
    """
    craft = CONTRACT["plan"]["craft"]
    if len(analytical) < craft["from"]["min"]:
        return
    rates = craft_rates([slides[i] for i in analytical])
    measured = {"highlight": round(rates.highlighted, 3), "source": round(rates.sourced, 3),
                "marksPerPage": round(rates.marks, 1),
                "tablesTreated": None if rates.treated is None else round(rates.treated, 3),
                "chartsAnnotated": None if rates.annotated is None else round(rates.annotated, 3),
                "commonestTableDevice": None if rates.commonest is None else round(rates.commonest, 3),
                "drawnBridges": None if rates.drawn is None else round(rates.drawn, 3)}
    want = {"highlight": craft["highlightedPhrase"]["min"], "source": craft["sourceLine"]["min"],
            "marksPerPage": craft["marksPerPage"]["min"],
            "tablesTreated": craft["tableTreated"]["min"], "chartsAnnotated": craft["chartAnnotated"]["min"],
            "commonestTableDevice": craft["tableDevice"]["shareMax"],
            "drawnBridges": craft["drawnBridge"]["shareMax"]}
    short = craft_shortfalls(rates, want, craft)
    if not short:
        return
    findings.append(finding(
        None, "DECK_CRAFT", measured, want,
        "Differences from the benchmark rates, for visual review, not decoration targets: " + "; ".join(short) + ".",
    ))


# What the deck actually drew, by device family.
#
# Each entry is a family of marks answering one job, and the roles the runtime
# uses when it draws one. Measured on the composed scene rather than on the
# plan, because a plan can record a treatment the page never renders.
# Verified against a scene composed from the gallery deck, which exercises the
# whole vocabulary. The marker helpers suffix the role they are given
# (`iconMarker` emits `<role>-ring` and `<role>-glyph`), so these match a prefix
# rather than a whole role.
DEVICE_FAMILIES = {
    # iconMarker suffixes the role it is given, so a component's own icon role
    # ("capsule-icon", "placement-icon") arrives as "capsule-icon-glyph".
    "icon": re.compile(r"^(?:(?:icon|list-icon|card-icon|table-cell-icon)(?:-|$)|.*-icon-(?:glyph|ring)$|pictogram-figure)"),
    # A table's photo cell counts once it holds a photograph; its empty slot is
    # UNSOURCED_PICTURE's business, not a picture drawn.
    "picture": re.compile(r"^(?:(?:image|image-frame|cover-image|divider-image|statement-image|takeaways-image)(?:-|$)|table-photo$)"),
    "score": re.compile(r"^table-(harvey|rating)"),
    "valuePill": re.compile(r"^table-bubble"),
    "cellBar": re.compile(r"^(table-bar|gantt-bar)"),
    "heat": re.compile(r"^table-heat"),
    "state": re.compile(r"^(table-status|status-marker|status-cue|status-label|chart-status)"),
    "growth": re.compile(r"^(chart-growth|chart-delta|chart-cagr|metric-delta|growth-)"),
    "reference": re.compile(r"^chart-reference"),
    "annotation": re.compile(r"^(annotation-|chart-annotation|chart-callout)"),
}


def gate_deck_vocabulary(slides, analytical, findings):
    """DECK_VOCABULARY. Which of the available devices the deck ever drew.

    Every other deck-level gate asks whether the pages vary in shape. This asks
    whether the marks on them vary at all: a long deck that never draws an
    icon, a rating, a value pill, a photograph or a growth annotation passes
    page by page and reads as one page reprinted.
    """
    rule = CONTRACT["plan"]["craft"]["vocabulary"]
    if len(analytical) < rule["from"]:
        return
    pages = [slides[index] for index in analytical]
    present = {n.get("role") or "" for slide in pages for n in slide.get("nodes", [])}
    used = sorted(name for name, pattern in DEVICE_FAMILIES.items()
                  if any(pattern.match(role) for role in present))
    absent = sorted(set(DEVICE_FAMILIES) - set(used))
    if len(used) >= rule["familiesMin"]:
        return
    findings.append(finding(
        None, "DECK_VOCABULARY",
        {"families": len(used), "of": len(DEVICE_FAMILIES), "used": used, "absent": absent,
         "pages": len(pages)},
        rule["familiesMin"],
        f"The deck draws {len(used)} of {len(DEVICE_FAMILIES)} device families across {len(pages)} pages; "
        f"absent: {', '.join(absent)}. These are not decoration quotas and no page should acquire a rating "
        "to satisfy one. But a deck this long that never draws an icon beside a named category, a value pill "
        "on a count, a rating on a score, a reference line on a threshold or a photograph of its subject has "
        "not chosen between them. Find the pages whose evidence is a score, a count, a named set or something "
        "worth showing.",
    ))


def gate_evidence_mix(slides, analytical, findings):
    """EVIDENCE_MIX and PAGE_VARIETY, deck level. Most pages should carry
    measurement, and a deck of any length should be built from more than one
    kind of page."""
    total = len(analytical)
    if total < DECK_LENGTH["evidenceMix"]:
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
    if total >= DECK_LENGTH["pageVariety"] and len(set(families)) < THRESHOLDS["families_min"]:
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
        # The executive summary precedes the section argument and has no
        # selected section. Require navigation on every governed body page.
        if slides[index].get("role") == "executive-summary":
            continue
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
        "tracker-label", "tracker-pill-label", "tracker-compact-label", "tracker-compact-marker-label",
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
    analytical deck opens with the answer. Section tabs on every page are not a
    contents page: the contents and the tracker are separate settings.
    """
    # Density does not exempt a long analytical deck from its opening answer.
    if len(analytical) < THRESHOLDS["front_matter_from"]:
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
    first = slides[analytical[0]] if analytical else None
    summary_indices = [i for i, slide in enumerate(slides) if slide.get("role") == "executive-summary"]
    first_section = next((i for i, slide in enumerate(slides) if slide.get("kind") == "divider"), len(slides))
    if first is not None and (first.get("role") != "executive-summary" or not summary_indices or summary_indices[0] > first_section):
        findings.append(finding(None, "NO_SUMMARY", len(summary_indices), "an opening executive summary",
            'Put the answer, its proof, consequence and action before the first section; declare role: "executive-summary". Metrics are optional and do not establish the role.'))


def gate_deck_shape(slides, analytical, findings, fill):
    """DECK_FLAT, deck level. A strong deck does not carry the same page
    twice: its page text runs from 104 words at the lower quintile to 278
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


# The figures a page can be carried by on their own, by component id: a page
# of one of them is its own architecture.
DIAGRAM_COMPONENTS = frozenset({
    "steps", "cycle", "journey", "timeline", "process", "chevron-process", "flow", "roadmap", "tree",
    "organization", "matrix", "quadrants", "chart.horizons", "gantt", "relationship-network",
})


def page_architecture(slide):
    """Count evidence relationships, not chart types or decorative variants.

    Two/three commentary columns, cards/prose, and an optional closing insight
    are the same architecture. Relative geometry survives subtitle removal and
    density changes, where absolute y bands would not.
    """
    instances = slide.get("componentInstances", [])
    evidence = [c for c in instances if str(c.get("component", "")).startswith("chart.")
                or c.get("component") in {"table", "rows", "compare", "phase-table"}]
    # Count the entire evidence region before naming its constituent devices.
    # Two exhibits or a standalone diagram can carry the same detached prose
    # arrangement as one chart; component count must not hide that repetition.
    # A diagram that draws as a chart (`chart.horizons`) is one exhibit, not two.
    evidence += [c for c in instances if c.get("component") in DIAGRAM_COMPONENTS and not any(c is e for e in evidence)]
    comments = [c for c in instances if c.get("component") in {"paragraph", "bullet-list", "cards", "callout"}]
    metrics = [c for c in instances if c.get("component") in {"metric", "metrics"}]
    def box(c):
        f = c.get("frame") or {}
        return tuple(float(f.get(k, 0)) for k in ("x", "y", "width", "height"))
    if evidence:
        boxes = [box(c) for c in evidence]
        x, y = min(b[0] for b in boxes), min(b[1] for b in boxes)
        w = max(b[0] + b[2] for b in boxes) - x
        h = max(b[1] + b[3] for b in boxes) - y
        if any(box(c)[1] + box(c)[3] <= y + 4 for c in metrics):
            return "metrics-over-evidence"
        if any(box(c)[0] >= x + w - 4 or box(c)[0] + box(c)[2] <= x + 4 for c in metrics):
            return "hero-number-with-evidence"
        if any((box(c)[0] >= x + w - 4 or box(c)[0] + box(c)[2] <= x + 4)
               and box(c)[1] < y + h and box(c)[1] + box(c)[3] > y for c in comments):
            return "evidence-with-commentary"
        if any(box(c)[1] >= y + h - 4 for c in comments):
            return "evidence-with-commentary"
    if len(evidence) == 1:
        if evidence[0].get("component") in DIAGRAM_COMPONENTS:
            return evidence[0]["component"]
        # A standalone bridge makes a base-to-result reconciliation visible.
        # This is a different reading task, not another category-chart style.
        # Commentary composites above remain normalized together.
        if evidence[0].get("component") == "chart.waterfall":
            return "reconciliation"
        return "evidence-only"
    if len(evidence) > 1:
        if len(evidence) > 2:
            return "evidence-grid"
        first, second = sorted(evidence, key=lambda c: box(c)[1])
        return "evidence-stack" if box(second)[1] >= box(first)[1] + box(first)[3] - 4 else "paired-evidence"
    components = {str(c.get("component", "")) for c in instances}
    if "image-frame" in components:
        return "picture-led"
    if "cards" in components:
        return "card-grid"
    if metrics:
        return "metrics-with-text"
    diagrams = sorted(components & DIAGRAM_COMPONENTS)
    return "+".join(diagrams) if diagrams else ("text" if comments else None)


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
    same device. A strong deck marks a column with icons, an accent lead
    phrase, a hairline or nothing at all, and reserves the numbered disc for an
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

    A strong deck runs about five distinct page architectures per ten
    analytical pages and never lets one architecture past a quarter of them,
    which no page-level gate can see.
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
    # Measure local variety in ten-page windows, so a long deck is not held to
    # more architectures than a ten-page deck with the same repertoire.
    window = min(10, len(shapes))
    per_ten = sum(len(set(shapes[i:i + window])) * 10.0 / window
                  for i in range(len(shapes) - window + 1)) / (len(shapes) - window + 1)
    top_shape, top_count = max(counts.items(), key=lambda kv: kv[1])
    top_share = top_count / float(len(shapes))
    if per_ten >= THRESHOLDS["shapes_per_ten_min"] and top_share <= THRESHOLDS["shape_share_max"]:
        return
    constrained = [i + 1 for i in content_indexes if shape_constrained(slides[i])]
    remedy = (
        "The same evidence relationship dominates the deck. Two or three commentary columns, "
        "cards versus prose, lateral versus lower prose, and an optional insight strip count as one architecture. "
        "Return to slide design: consider paired evidence on a shared basis, aligned small multiples, "
        "a reconciled bridge, a metric with its proof, a sequence or an integrated comparison. "
        "Select from the actual argument and reference examples; adding boxes, mirroring panels "
        "or deleting necessary evidence does not repair repetition."
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


# What the habit counts: the render's empty-page findings once the renders were
# measured (DECK_THIN_PAGES), the scene's own before that (DECK_SCENE_VOID, at
# authoring). One count, on what the run can see, so one half-empty habit is
# refused once.
EMPTY_PAGE_CODES = {"THIN_PAGE", "HERO_EXHIBIT", "INK_COVERAGE", "INTERNAL_VOID", "DEAD_BAND", "COLUMN_VOID"}
SCENE_EMPTY_CODES = {"SCENE_VOID", "THIN_PAGE", "HERO_EXHIBIT"}
DECK_EMPTY = {True: ("DECK_THIN_PAGES", EMPTY_PAGE_CODES), False: ("DECK_SCENE_VOID", SCENE_EMPTY_CODES)}


def gate_deck_empty_pages(content_indexes, findings, rendered, counted=None):
    """DECK_THIN_PAGES (rendered) or DECK_SCENE_VOID (scene only): the pages
    `counted` (by default `findings`) flags half empty, against DECK_HABIT."""
    code, codes = DECK_EMPTY[bool(rendered)]
    pages = len(content_indexes)
    flagged = sorted({f["slide"] for f in (findings if counted is None else counted) if f.get("code") in codes and f.get("slide")})
    if pages < DECK_HABIT["from"] or len(flagged) < DECK_HABIT["pages_min"] or len(flagged) / pages < DECK_HABIT["share"]:
        return
    findings.append(finding(
        None, code, len(flagged), max(DECK_HABIT["pages_min"], round(pages * DECK_HABIT["share"])),
        "{} of {} content pages are thin or leave a band of their body empty (pages {}). Fix the pattern, not each "
        "page: give the exhibit the page (a wider chart with its annotation, a table with a treated column and the "
        "numbers the commentary quotes), give cards and phases the detail their boxes were drawn for, set commentary "
        "beside the exhibit rather than in a band under it, move a figure that only needs a strip to a page that "
        "shares it, or merge two half pages into one full one.".format(len(flagged), pages, ", ".join(str(n) for n in flagged[:20])),
    ))
