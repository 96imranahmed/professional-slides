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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nice_ticks import is_nice_tick, nice_axis, parse_number  # noqa: E402

CANVAS_W, CANVAS_H = 1280, 720
INK_LUMINANCE = 235
SURFACE_LUMINANCE = 250
FOOTER_TOP = 660

# --- role vocabulary -------------------------------------------------------

BODY_ROLES = {
    "paragraph", "body", "body-text", "list-item", "bullet",
    "table-cell-text", "table-cell", "table-header-text",
    "insight-body", "insight-heading", "evidence-note-text",
}
CHART_FURNITURE_ROLES = {"axis-label", "category-label", "data-label", "legend-label", "table-status-label", "table-lamp", "table-progress-label", "table-trend-glyph", "chart-bracket-label", "chart-delta-label", "chart-period-label", "chart-event-label", "chart-unit"}
TITLE_ROLES = {"action-title"}
SOURCE_ROLES = {"source-text", "source", "footnote", "footnote-text"}
NON_BODY_ROLES = SOURCE_ROLES | CHART_FURNITURE_ROLES | TITLE_ROLES | {
    "page-number", "notes", "tracker-label", "chart-unit",
    "cover-title", "cover-subtitle", "section-title",
}
PROSE_ROLES = {"paragraph", "body", "body-text"}

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
# A photograph, not an icon, a logo mark or a rule: 120 x 100 px and up.
PHOTO_MIN_AREA = 12000
# "1939 • Marvel Comics #1": a bullet doing the work of a comma, a bracket or a
# second line. Only a line that starts with one is a list marker.
# A space on at least one side: "1939 • Marvel Comics #1" is a separator, the
# interpunct in a unit ("kW·h") is part of the word.
DOT_SEPARATOR_RE = re.compile(
    r"\S(?:[ \t]+[•·∙‧・][ \t]*|[ \t]*[•·∙‧・][ \t]+)\S"
)

TYPE_RANGES = {
    "body": (10.0, 14.0),
    "chart-furniture": (8.0, 11.0),
    "action-title": (20.0, 26.0),
    "source": (7.0, 9.0),
}

HEDGES = (
    "looks plausible", "some ", "may ", "might ", "could ",
    "distinct combinations", "offers a", "requires verification",
    "is not a ranking",
)

# Density profiles change how much prose a page may carry; they never relax a
# geometric or typographic threshold.
PROFILES = {
    "live-pitch": {"words_exhibit": 70, "words_text": 100},
    "executive": {"words_exhibit": 100, "words_text": 140},
    "pre-read": {"words_exhibit": 130, "words_text": 180},
    # Source-rich support behind the story, set in the smallest approved type:
    # it carries more words in the same frame, by design.
    "appendix": {"words_exhibit": 160, "words_text": 220},
}
DEFAULT_PROFILE = "executive"

# How full the deck means to read (`fill` on the spec, carried on the scene).
# Emptiness is right for a live-pitch deck and wrong for a pre-read, so the
# three geometric thresholds move with it; nothing else does.
FILL_LEVELS = {
    "full": {"ink_min": 0.10, "dead_band_max": 0.06, "internal_void_max": 0.16, "column_void_max": 0.20},
    "balanced": {"ink_min": 0.08, "dead_band_max": 0.08, "internal_void_max": 0.22, "column_void_max": 1.0},
    "airy": {"ink_min": 0.04, "dead_band_max": 0.14, "internal_void_max": 0.32, "column_void_max": 1.0},
}
DEFAULT_FILL = "balanced"

# What a page of this deck is expected to carry. Mirrors runtime/weight.mjs: the
# deck's `weight` (its own, or the one a template's house profile measured) is
# carried on the scene, and these are the fallbacks by fill level. Every number
# is a floor, never a ceiling — the ceiling on prose is WORDS, and density is
# only a defect when the content is not.
WEIGHT_BY_FILL = {
    "full": {"pageWords": 130, "columnFill": 0.68, "plotSpan": 0.60, "pointWords": 10, "tableFill": 0.55, "elements": 2},
    "balanced": {"pageWords": 95, "columnFill": 0.55, "plotSpan": 0.52, "pointWords": 8, "tableFill": 0.45, "elements": 1},
    "airy": {"pageWords": 0, "columnFill": 0.0, "plotSpan": 0.0, "pointWords": 0, "tableFill": 0.0, "elements": 1},
}
# 1,832 pages of published McKinsey, BCG and Bain client decks: median 196 words
# of page text, quartiles 127 and 282. The floors sit below that on purpose.
REFERENCE_PAGE_WORDS = {"p25": 127, "median": 196, "p75": 282, "pages": 1832}
WEIGHT = dict(WEIGHT_BY_FILL[DEFAULT_FILL])

THRESHOLDS = {
    "ink_min": 0.08,   # a 12pt text page with 120 words sits near 9%; waived when a qualifying hero exhibit carries the page (a line chart is ink-light by nature)
    "dead_band_max": 0.08,
    "internal_void_max": 0.22,   # 158px of nothing between two content blocks; a centred icon row keeps its air
    "exhibit_ink_min": 0.02,     # a hero frame must carry ink, not just area (a line chart sits near 2-3%, a 12pt table near 5-6%)
    "title_lines_max": 2,
    "title_words_max": 14,
    "cpl_min": 35,
    "cpl_max": 90,
    "hero_area_min": 0.40,
    "monotony_max": 0.35,
    "column_void_max": 1.0,
    "image_pages_max": 0.30,   # photographs on more than three pages in ten
    "image_run_max": 2,        # consecutive analytical pages carrying photographs
    "data_pages_min": 0.45,    # pages whose evidence is a chart, a table or measured tiles
    "families_min": 3,         # distinct page families in a deck of ten pages or more
    "sections_from": 12,       # analytical pages beyond which a deck needs sections and a tracker
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


def finding(slide_no, code, measured, threshold, repair):
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


def gate_ink_and_dead_band(slide_no, rows, findings, occupied=None):
    """INK_COVERAGE and DEAD_BAND. COVER_EXEMPT. Needs the render.
    `rows` counts ink; `occupied` (default: rows) counts designed surfaces too."""
    ink = sum(rows[:FOOTER_TOP])
    content_rows = (occupied or rows)[:FOOTER_TOP]
    fraction = ink / float(CANVAS_W * CANVAS_H)
    if fraction < THRESHOLDS["ink_min"]:
        findings.append(finding(
            slide_no, "INK_COVERAGE", round(fraction, 4), THRESHOLDS["ink_min"],
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
    """TITLE_LINES, TITLE_WORDS, HEDGED_TITLE. COVER_EXEMPT."""
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
        lowered = " " + text.lower()
        hit = [h.strip() for h in HEDGES if re.search(r"\b" + re.escape(h.strip()).replace(r"\ ", r"\s+") + r"\b", lowered)]
        if hit:
            findings.append(finding(
                slide_no, "HEDGED_TITLE", hit, list(h.strip() for h in HEDGES),
                "Replace the hedge with the finding and its consequence; "
                "move the uncertainty to the methodology footnote.",
            ))


def gate_type_range(slide_no, slide, findings):
    """TYPE_RANGE across body, chart furniture, title and source roles."""
    for node in text_nodes(slide):
        role = node.get("role")
        size = font_size(node)
        if size is None:
            continue
        if role in BODY_ROLES:
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
    """Axis labels grouped by the chart instance that owns them."""
    groups = {}
    for node in text_nodes(slide):
        if node.get("role") != "axis-label":
            continue
        owner = (node.get("data") or {}).get("componentInstance") or "axis"
        groups.setdefault(owner, []).append(node)
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
    total = 0
    for node in text_nodes(slide):
        total += word_count(source_text(node))
    return total


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


def gate_thin_page(slide_no, slide, findings):
    """THIN_PAGE. A content page carrying less than the deck's weight floor of
    page text. Not a style rule: a reader who gets three bullets and a chart has
    been handed the analysis to do themselves."""
    floor = WEIGHT.get("pageWords") or 0
    if floor <= 0:
        return
    words = page_text_words(slide)
    if words >= floor:
        return
    findings.append(finding(
        slide_no, "THIN_PAGE", words, floor,
        "The page is under-carrying. Deepen it where the evidence is: more "
        "categories or rows on the exhibit, the second cut of the same measure, "
        "labels on the marks, a footnote that states the basis, and points that "
        "run to a sentence each. Reference client pages carry a median of "
        f"{REFERENCE_PAGE_WORDS['median']} words of page text.",
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
        horizontal = component in ("chart.bar", "chart.stacked-bar")
        if horizontal:
            low = min(m["frame"].get("x", 0) for m in marks)
            high = max(m["frame"].get("x", 0) + m["frame"].get("width", 0) for m in marks)
            span = (high - low) / max(1.0, float(frame.get("width") or 1))
        else:
            low = min(m["frame"].get("y", 0) for m in marks)
            high = max(m["frame"].get("y", 0) + m["frame"].get("height", 0) for m in marks)
            span = (high - low) / max(1.0, float(frame.get("height") or 1))
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
    if len(numeric) >= 3:
        return
    findings.append(finding(
        slide_no, "NUMBERS_ON_MARKS", len(numeric), 3,
        "Print the values on the marks (`dataLabels`), or label the endpoints "
        "and the decisive category. The numbers are the evidence; an axis is a "
        "lookup table.",
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
    instances = top_level_instances(slide)
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


def gate_dot_separators(slide_no, slide, findings):
    """DOT_SEPARATOR. A bullet joining two labels — "1939 • Marvel Comics #1",
    "SUPERMAN • Hope" — is a tic, not a structure. The house writes the qualifier
    in brackets, on the second line, or as a column of its own."""
    offenders = []
    for node in text_nodes(slide):
        for line in lines_of(node):
            if DOT_SEPARATOR_RE.search(line) and line.strip() not in offenders:
                offenders.append(line.strip()[:80])
    for text in offenders[:3]:
        findings.append(finding(
            slide_no, "DOT_SEPARATOR", text, "no bullet between two labels",
            "Drop the bullet: write \"Marvel Comics #1 (1939)\", or give the year "
            "its own eyebrow line or column. Bullets start list items; they do "
            "not join words.",
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
    sections = "section-divider" in components
    tracker = bool(components & {"agenda", "tracker-page"}) or "tracker-label" in roles
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


def run_gates(scene, render_dir=None, profile=None, gates=None):
    if profile is not None and profile not in PROFILES:
        raise ValueError(f"Unknown density profile: {profile}")
    fill = scene.get("fill") or DEFAULT_FILL
    if fill not in FILL_LEVELS:
        raise ValueError(f"Unknown fill level: {fill}")
    THRESHOLDS.update(FILL_LEVELS[fill])
    # The deck's weight contract: its own, or the one a template's house profile
    # measured, falling back to the fill level's floors.
    WEIGHT.clear()
    WEIGHT.update(WEIGHT_BY_FILL.get(fill, WEIGHT_BY_FILL[DEFAULT_FILL]))
    declared = scene.get("weight")
    if isinstance(declared, dict):
        for key, value in declared.items():
            if key in WEIGHT and isinstance(value, (int, float)):
                WEIGHT[key] = value
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
                    gate_ink_and_dead_band(slide_no, rows, page, occupied)
                    if THRESHOLDS["column_void_max"] < 1.0 and wanted("COLUMN_VOID"):
                        gate_column_void(slide_no, load_ink_matrix(path, SURFACE_LUMINANCE), page)
                    # A page carried by a qualifying hero exhibit is not empty,
                    # however thin its marks (a line chart, a map): INK_COVERAGE
                    # then defers to the hero and band gates.
                    hero = []
                    gate_hero_exhibit(slide_no, slide, hero, path)
                    has_hero = any(is_exhibit(c) for c in slide.get("componentInstances", [])) and not hero
                    findings.extend(f for f in page if wanted(f["code"]) and not (f["code"] == "INK_COVERAGE" and has_hero))
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
            if wanted("THIN_EVIDENCE"):
                gate_thin_evidence(slide_no, slide, findings)
            if wanted("HEADING_WRAPS"):
                gate_heading_wraps(slide_no, slide, findings)
            if wanted("METRIC_STACK"):
                gate_metric_stack(slide_no, slide, findings)
        if wanted("DOT_SEPARATOR"):
            gate_dot_separators(slide_no, slide, findings)
        if wanted("TYPE_RANGE"):
            gate_type_range(slide_no, slide, findings)
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

    # A density report beside the findings: the numbers this review is about, so
    # a regression shows up as a number rather than as a screenshot.
    measured_words, measured_columns, measured_spans = [], [], []
    for index in content_indexes:
        slide = slides[index]
        measured_words.append(page_text_words(slide))
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
        "pageWords": {"median": median(measured_words), "min": min(measured_words) if measured_words else None,
                      "floor": WEIGHT.get("pageWords"), "referenceMedian": REFERENCE_PAGE_WORDS["median"]},
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
