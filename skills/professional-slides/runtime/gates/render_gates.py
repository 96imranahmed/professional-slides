"""The page's own gates: the render's ink and band gates, the band and column
geometry the scene's coverage measures with the same definition, and the
gates that read the page's title, type, measure, words and pictures.

Each gate takes the page's number, the scene slide and the findings list, and
appends what it finds.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import NamedTuple

from gate_config import (
    BODY_ROLES, CHART_FURNITURE_ROLES, DEFAULT_PROFILE, FOOTER_TOP, INK_PER_WORD, LIST_PROSE_ROLES,
    NON_BODY_ROLES, PHOTO_MIN_AREA, PICTURE, PROFILES, PROSE_ROLES, SOURCE_ROLES, TABLE_TEXT_ROLES,
    THRESHOLDS, TITLE_ROLES, TYPE_RANGES, WEIGHT, content_frame, finding, font_size, is_exhibit,
    lines_of, source_text, text_nodes,
)
# Reading the renders lives in its own module: it shares none of the gate
# vocabulary and is the only part that needs Pillow and numpy.
from ink import CANVAS_H, CANVAS_W, SURFACE_LUMINANCE, load_grey, relative
from nice_ticks import nice_axis, parse_number
# One definition of a word, the text contract's.
from text_stats import word_count


def gate_column_void(slide_no, slide, matrix, findings):
    """COLUMN_VOID. INTERNAL_VOID and DEAD_BAND by column (column_bands), on
    the render. Only asked where the page-wide bands pass: a band across the
    whole page is already its own finding, and one hole is one finding.
    Every column the page splits into is read, at every fill. Needs numpy to
    slice the render."""
    if matrix is None:
        return
    page = void_bands(matrix.sum(axis=1).tolist())
    if page["internalVoid"] > THRESHOLDS["internal_void_max"] or page["deadBand"] > THRESHOLDS["dead_band_max"]:
        return
    column = column_bands(slide, render_column_rows(matrix))
    if column is None:
        return
    findings.append(finding(
        slide_no, "COLUMN_VOID",
        {"column": column["name"], "band": round(column["band"], 4), "from": column["from"], "to": column["to"],
         "internalVoid": round(column["internalVoid"], 4), "deadBand": round(column["deadBand"], 4),
         **({"plot": True} if column.get("plot") else {})},
        column["threshold"],
        column_repair(column),
    ))


def column_repair(column):
    return ("The {} column is empty from y {} to {} while the page beside it is full. Set the group at the top "
            "of its column and give the height to what can use it - the exhibit at its frame's size, the "
            "commentary moved under a short exhibit, a table with the rows or treated column it was given the "
            "height for - or narrow the column. Do not stretch rows or pad text to cover the band.").format(
                column["name"], column["from"], column["to"])


# --- gates -----------------------------------------------------------------


def text_page_ink_floor():
    """The ink a page of type alone must show: what its required words produce.

    `ink_min` is set on pages with an exhibit - a well-made analytical slide's
    ink first quartile is 0.121, and the balanced floor
    of 0.115 sits just under it. A page of body type cannot reach that at any
    honest length: rendering text pages from 93 to 185 words gives a straight
    line at 0.00052 ink per word, so 0.115 would need about 220 words of body
    against a benchmark body of 128.

    So a text page is held to the ink its own word floor produces, which makes
    the two gates agree by construction: whatever `pageWords` the deck's weight
    contract sets, this follows it. A text page at the word floor passes with
    room; one carrying a third of it still fails here as well as at THIN_PAGE.
    """
    return INK_PER_WORD["value"] * INK_PER_WORD["tolerance"] * (WEIGHT.get("pageWords") or 0)


# Where the body starts for INTERNAL_VOID: just under a two-line title. A run
# that starts here is the air between the title and the first block.
VOID_TOP = 140
# A row counts as content once it carries more than a hairline: a column rule
# or a vertical connector running through an empty band does not fill it.
ROW_MIN = 3
# A run of occupied rows this short with empty rows either side is a hairline
# across the band - a subsection rule, a divider - and does not split it
# either: a short rule in the middle of a gap leaves the gap one void, not two
# halves each under the bar. The last thing drawn still ends the content, a
# box's bottom edge included, so the trailing band starts under it.
HAIRLINE_ROWS = 2


def filled_rows(rows):
    """Which canvas rows carry content: more than ROW_MIN occupied pixels,
    and not a hairline (HAIRLINE_ROWS or fewer such rows between empty ones)."""
    filled = [value > ROW_MIN for value in rows]
    y = 0
    while y < len(filled):
        if not filled[y]:
            y += 1
            continue
        end = y
        while end < len(filled) and filled[end]:
            end += 1
        if end - y <= HAIRLINE_ROWS and y > 0 and end < len(filled):
            filled[y:end] = [False] * (end - y)
        y = end
    return filled


def void_bands(rows, top=VOID_TOP, bottom=FOOTER_TOP, scale=CANVAS_H):
    """DEAD_BAND and INTERNAL_VOID's one definition, read off `rows[y]`, the
    occupied pixels on each canvas row. The render's gates pass the rows of the
    PNG; SCENE_VOID passes the rows the scene will draw (scene_rows), so the
    author hears at authoring the bands the build will report.

    `deadBand` is the trailing band from the last occupied row to the footer;
    `internalVoid` the tallest empty run between VOID_TOP and that row - a
    takeaway pinned to the bottom with nothing above it is as empty as a
    trailing band, and so is a strip of air under the title. Both are shares
    of the canvas height; `voidTop`/`voidBottom` place the run.

    A column is measured by the same definition over its own region: `top`
    and `bottom` bound it, and `scale` is what the shares are taken of
    (column_bands sets it so a column as tall as the body is held to the
    page's own bar in pixels). Inside the content a row is occupied as
    `filled_rows` reads it, so a hairline across a band does not split it."""
    last_ink = next((y for y in range(bottom - 1, top - 1, -1) if rows[y] > ROW_MIN), None)
    dead = (bottom - 1 - (top - 1 if last_ink is None else last_ink)) / float(scale)
    filled = filled_rows(rows)
    run, longest, where = 0, 0, (None, None)
    for y in range(top, top + 1 if last_ink is None else last_ink):
        if filled[y]:
            run = 0
        else:
            run += 1
            if run > longest:
                longest, where = run, (y + 1 - run, y + 1)
    return {"deadBand": dead, "internalVoid": longest / float(scale), "lastInk": last_ink,
            "voidTop": where[0], "voidBottom": where[1]}


# A region narrower or shorter than this is a strip - a caption row, a tile's
# label - not a column a reader sees as half empty.
COLUMN_MIN_WIDTH = 160
COLUMN_MIN_HEIGHT = 120


def page_columns(slide):
    """The page's columns, read off the composer's own regions: the frames of
    its component instances, grouped into rows (frames that share any height)
    and each row into columns (frames that share any width). A row that splits
    gives one region per column, from the row's top to its foot; a page with
    no split gives none, and the page-wide bands are the whole measure.

    The band gates read whole rows of the canvas, so they call a column empty
    only when its neighbour is too: a waffle floating in a tall plot beside a
    filled bar chart, or a short table beside a full column of points, leaves
    no whole row empty. The columns are read on their own for that."""
    boxes = []
    for instance in slide.get("componentInstances", []):
        component = str(instance.get("component") or "")
        if component in ("slide-chrome", "section"):
            continue
        frame = instance.get("frame") or {}
        x, y = float(frame.get("x") or 0), float(frame.get("y") or 0)
        width, height = float(frame.get("width") or 0), float(frame.get("height") or 0)
        top, bottom = max(y, VOID_TOP), min(y + height, FOOTER_TOP)
        if width > 0 and bottom > top:
            boxes.append((x, top, x + width, bottom, component))

    def spans(items, low, high):
        # Boxes whose [low, high] extents overlap, merged: [start, end, members].
        out = []
        for item in sorted(items, key=lambda b: b[low]):
            if out and item[low] < out[-1][1] - 1:
                out[-1][1] = max(out[-1][1], item[high])
                out[-1][2].append(item)
            else:
                out.append([item[low], item[high], [item]])
        return out

    columns = []
    for top, bottom, members in spans(boxes, 1, 3):
        split = spans(members, 0, 2)
        if bottom - top < COLUMN_MIN_HEIGHT or len(split) < 2:
            continue
        names = {2: ("left", "right"), 3: ("left", "middle", "right")}.get(len(split))
        # Every cell of the row, strips included, so column_bands can ask
        # whether a neighbour is a block drawn the row's full height.
        cells = [(int(math.floor(x0)), int(math.ceil(x1))) for x0, x1, _ in split]
        for index, (x0, x1, held) in enumerate(split):
            if x1 - x0 >= COLUMN_MIN_WIDTH:
                columns.append({"name": names[index] if names else f"column {index + 1} of {len(split)}",
                                "x0": int(math.floor(x0)), "x1": int(math.ceil(x1)),
                                "top": int(math.floor(top)), "bottom": int(math.ceil(bottom)),
                                "neighbours": [cell for at, cell in enumerate(cells) if at != index],
                                # A column that is a chart's own frame: its air may be
                                # the plot's headroom (plot_column).
                                "plot": all(PLOT_COMPONENT.match(box[4]) for box in held)})
    return columns


# The components whose frame is a plot. A hole inside one may be the scale's
# headroom - the smaller panel of a row on one scale, short bars under the
# tallest's axis - as often as a chart floating in a frame too tall for it, so
# a column void there stays a question however deep (severity); a hole in a
# column of text, numbers or cards blocks past its bar.
PLOT_COMPONENT = re.compile(r"^(chart\.|chart-group$)")


# A block is solid when its cell is drawn across this share of its width on
# this share of its rows: a filled label block, not a chart with a gridline.
SOLID_WIDTH, SOLID_ROWS = 0.85, 0.95


def solid_cell(rows, x0, x1, top, bottom):
    """Whether the cell between x0 and x1 is a filled block from `top` to
    `bottom`. `rows` is column_rows(x0, x1)."""
    need = SOLID_WIDTH * (x1 - x0)
    full = sum(1 for y in range(top, bottom) if rows[y] >= need)
    return full >= SOLID_ROWS * (bottom - top)


def anchored(rows, top, bottom):
    """Whether a column's ink sits centred on its row: the air above it and
    the air below within a quarter of each other (or 12px, the scene's and
    the render's disagreement on where a glyph starts, with room)."""
    inked = [y for y in range(top, bottom) if rows[y] > ROW_MIN]
    if not inked:
        return False
    above, below = inked[0] - top, bottom - 1 - inked[-1]
    return abs(above - below) <= max(12, 0.25 * (above + below))


def column_bands(slide, column_rows):
    """The page's emptiest column by void_bands, or None when every column is
    within the bars. `column_rows(x0, x1)` gives the occupied pixels on each
    canvas row between x0 and x1 - the render's matrix or the scene's mask.

    Same definition, relative to the column's height: the share is taken of
    the column scaled as the body is to the canvas, so a column as tall as the
    body is held to the page's own bar in pixels and a column in a shorter row
    to the same share of its own height. A hole inside the column - a waffle
    floating mid-plot, points centred with air above and below - is held to
    `internal_void_max`. A column that simply stops short is held to
    `column_void_max`, the tail of the right-column band on well-made pages:
    held to the page's dead band, a third of good side columns would fail.

    One cell is read with its row rather than as a region of its own: one
    centred beside a filled block drawn the row's full height. That is a
    labelled row - a label block down the left, its bullets and its number
    centred against it - and the block fills every line of the row, so the
    row reads full across and the air above and below the centred bullets is
    the row's margin, not a hole. Measured as its own region, every short
    labelled row would read as a hole. So the row's centred cells are measured together - the
    number beside the bullets reads with the bullets, as the row is read -
    and held to the page's bars in pixels, not to the row's height: a single
    line centred in a 400px row still fails."""
    columns = page_columns(slide)
    rows_of = {id(column): column_rows(column["x0"], column["x1"]) for column in columns}
    together = {}
    for column in columns:
        top, bottom, rows = column["top"], column["bottom"], rows_of[id(column)]
        if anchored(rows, top, bottom) and any(solid_cell(column_rows(x0, x1), x0, x1, top, bottom)
                                               for x0, x1 in column.get("neighbours", [])):
            together.setdefault((top, bottom), []).append(column)
    read_with_row = {id(c): [sum(values) for values in zip(*(rows_of[id(m)] for m in members))]
                     for members in together.values() for c in members}
    worst = None
    for column in columns:
        top, bottom = column["top"], column["bottom"]
        rows = read_with_row.get(id(column), rows_of[id(column)])
        scale = CANVAS_H if id(column) in read_with_row else (bottom - top) * CANVAS_H / float(FOOTER_TOP - VOID_TOP)
        bands = void_bands(rows, top, bottom, scale)
        if bands["lastInk"] is None:
            continue  # nothing drawn there at all: an unmeasured frame, not a half-empty one
        hole = bands["internalVoid"] / THRESHOLDS["internal_void_max"]
        short = bands["deadBand"] / THRESHOLDS["column_void_max"]
        over = max(hole, short)
        if over > 1 and (worst is None or over > worst["over"]):
            internal = hole >= short
            worst = {**column, "over": over, "internalVoid": bands["internalVoid"], "deadBand": bands["deadBand"],
                     "band": bands["internalVoid"] if internal else bands["deadBand"],
                     "threshold": THRESHOLDS["internal_void_max" if internal else "column_void_max"],
                     "from": bands["voidTop"] if internal else bands["lastInk"] + 1,
                     "to": bands["voidBottom"] if internal else bottom}
    return worst


def scene_column_rows(mask):
    """column_bands' reader for the scene: the mask scene_mask draws."""
    return lambda x0, x1: [row[x0:x1].count(1) for row in mask]


def render_column_rows(matrix):
    """column_bands' reader for the render: the occupied matrix of the PNG."""
    return lambda x0, x1: matrix[:, x0:x1].sum(axis=1).tolist()


def without_title_rule(rows, slide):
    """`rows` less the ink the title rule draws. The rule is page furniture:
    a 1,160px hairline is a tenth of a point of ink share that says nothing
    about the body, and counting it let a thin page lean on its frame. It
    still counts where the page is read for holes (the scene's mask draws
    it too), so a rule never opens a void under the title."""
    rows = list(rows)
    for node in slide.get("nodes", []):
        if node.get("role") != "title-rule":
            continue
        data = node.get("data") or {}
        width = abs(float(data.get("x2", 0)) - float(data.get("x1", 0)))
        stroke = (node.get("style") or {}).get("lineWidth")
        stroke = float(stroke.get("value", 1) if isinstance(stroke, dict) else stroke or 1)
        y = float(data.get("y1", (node.get("frame") or {}).get("y", 0)))
        # Antialiasing spreads a hairline over the rows either side.
        for row in range(int(math.floor(y - stroke / 2)) - 1, int(math.ceil(y + stroke / 2)) + 1):
            if 0 <= row < len(rows):
                rows[row] = max(0, rows[row] - width)
    return rows


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
    bands = void_bands(content_rows)
    band, void = bands["deadBand"], bands["internalVoid"]
    if band > THRESHOLDS["dead_band_max"]:
        findings.append(finding(
            slide_no, "DEAD_BAND", round(band, 4), THRESHOLDS["dead_band_max"],
            "Review the trailing empty band against the intended reading group. "
            "Restore any missing explanation, then align or centre the complete "
            "group when appropriate. Do not stretch rows or add content merely "
            "to occupy the band.",
        ))
    if void > THRESHOLDS["internal_void_max"]:
        findings.append(finding(
            slide_no, "INTERNAL_VOID", round(void, 4), THRESHOLDS["internal_void_max"],
            "An empty band sits inside the page. Merge this page with a neighbour, "
            "give the exhibit more to show, or let it fill the track.",
        ))


def gate_title(slide_no, slide, findings):
    """TITLE_LINES, TITLE_WORDS. COVER_EXEMPT.

    Whether a title *commits to a finding* is not measured here. A list of
    hedging words ("may", "could") fails committed findings - "Three of five
    markets could fund the build from cash" - and misses real hedges. A title
    that hedges is a real defect and a word list cannot see it; the taste
    review reads the titles and says so.
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
                f"Rewrite the title as a claim of at most {THRESHOLDS['title_words_max']} words.",
            ))


def gate_type_range(slide_no, slide, findings, profile=DEFAULT_PROFILE):
    """TYPE_RANGE across body, chart furniture, title and source roles. An
    appendix page is set smaller on purpose - a strong deck runs its model grids
    and source tables at 8 pt - so its table cells and chart furniture floor a point
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
    """CPL. Measure is the longest laid-out line of a prose node.

    A point is prose too, when it is too wide: points below a row of panels
    ran one list across the body at about 150 characters a line and CPL, reading
    paragraphs only, passed it. Only the wide end is read for list items - a
    short bullet in a card is a label, not a narrow column of prose."""
    for node in text_nodes(slide):
        role = node.get("role")
        if role not in PROSE_ROLES and role not in LIST_PROSE_ROLES:
            continue
        lines = lines_of(node)
        if not lines:
            continue
        longest = max(len(line) for line in lines)
        if role in LIST_PROSE_ROLES:
            if longest > THRESHOLDS["cpl_max"]:
                findings.append(finding(
                    slide_no, "CPL", longest, THRESHOLDS["cpl_max"],
                    "The points run too wide to track. Set them in columns (points below a row of panels run "
                    "under each panel, or up to three across) or beside the exhibit.",
                ))
            continue
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


# A takeaway band says the reading once. The skill's own example decks set
# theirs at a median of 18 words and never past 32, which is one line and a
# half at the band's measure. A band of four lines is a paragraph set in bold
# on a tint, and it competes with the exhibit it was meant to summarise.
TAKEAWAY_ROLES = {"insight-body"}
TAKEAWAY_LINES_MAX = 2


def gate_takeaway_long(slide_no, slide, findings):
    """TAKEAWAY_LONG. A takeaway band that sets past two lines: the reading
    said once. A revision under rules before version 3 is held to three lines
    (weight.json rules.tightened)."""
    for node in text_nodes(slide):
        if node.get("role") not in TAKEAWAY_ROLES:
            continue
        lines = lines_of(node)
        if len(lines) > TAKEAWAY_LINES_MAX:
            findings.append(finding(
                slide_no, "TAKEAWAY_LONG", len(lines), TAKEAWAY_LINES_MAX,
                "Say the reading once, in a line or two. Method, provenance and "
                "qualification belong in the note under the exhibit; a second "
                "argument belongs in a commentary column. If the page cannot reach "
                "its word floor without a long band, check that its text reference "
                "is an exhibit-led page rather than one with a commentary column.",
            ))


def words_limit(slide, profile):
    """The WORDS ceiling for one page. A page composed from a page type carries
    its own (`wordCeiling`: its reading task's outlier fence, on the same body
    count as its floor - derive-content.mjs wordBudgetOf). Otherwise the exhibit
    page's prose budget when an exhibit carries it, the benchmark page's when
    its evidence is its prose. The ceiling follows the reading task because a
    chart page with commentary and a table page carry different medians."""
    own = slide.get("wordCeiling")
    if isinstance(own, (int, float)) and not isinstance(own, bool) and own > 0:
        return int(own)
    has_exhibit = any(is_exhibit(c) for c in slide.get("componentInstances", []))
    return PROFILES[profile]["words_exhibit" if has_exhibit else "words_text"]


def gate_words(slide_no, slide, findings, profile):
    """WORDS. COVER_EXEMPT. Body prose only: no source, page number, notes — and no
    table cells, which are structured evidence rather than prose (dense is fine)."""
    if slide.get("wordCeiling"):
        # The page's own ceiling is on the page's own count.
        total = body_words(slide)
        limit = words_limit(slide, profile)
        if total > limit:
            summary = slide.get("role") == "executive-summary"
            findings.append(finding(
                slide_no, "WORDS", total, limit,
                "An executive summary is read first and in full, so it is held to "
                "the upper quartile of text pages: keep each point to its finding "
                "and the number that proves it, and leave the qualifications to the "
                "pages that carry the evidence. The ceiling is on every word of the "
                "body, the cells of its table with its points: a table of long cells "
                "leaves the points no room, so keep each cell to a call of a few words." if summary else
                "Above the fence for pages doing this job: cut the page to its "
                "claim, its evidence and its consequence, or split it in two.",
            ))
        return
    total = 0
    for node in text_nodes(slide):
        role = node.get("role")
        # Text inside structured exhibits (tables, cards, steps, gantt bars, network
        # nodes, framework pillars) is evidence in cells, not prose.
        if role in NON_BODY_ROLES or role is None or role.startswith(("table-", "card-", "step-", "gantt-", "network-", "framework-", "quadrant-", "cycle-", "people-", "profile-", "agenda-")):
            continue
        total += word_count(source_text(node))
    limit = words_limit(slide, profile)
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
    """HERO_EXHIBIT. Only applies to pages that carry an exhibit at all. With the render
    (its path, or the grey array load_grey decoded), also requires the hero frame to
    carry ink (a thin strip in a big frame is not a hero)."""
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
    big = max(exhibits, key=lambda c: float((c.get("frame") or {}).get("width", 0)) * float((c.get("frame") or {}).get("height", 0)))
    # A photograph fills its frame by being one: occupancy counts pixels darker
    # than the page, and a light cabin or a sky reads as empty, so a picture's
    # frame is not held to it.
    if image is not None and big.get("component") not in ("image-frame", "device-frame"):
        f = big.get("frame") or {}
        try:
            import numpy as np
            a = image if hasattr(image, "shape") else load_grey(image)
            x0, y0 = int(max(0, f["x"])), int(max(0, f["y"]))
            x1, y1 = int(min(CANVAS_W, f["x"] + f["width"])), int(min(CANVAS_H, f["y"] + f["height"]))
            if x1 > x0 and y1 > y0:
                # Occupancy, not ink: a map's land or a card's tint carries the frame.
                density = float((a[y0:y1, x0:x1] < relative(np.bincount(a.ravel(), minlength=256).tolist(), SURFACE_LUMINANCE)).mean())
                if density < THRESHOLDS["exhibit_ink_min"]:
                    findings.append(finding(
                        slide_no, "HERO_EXHIBIT", round(density, 4), THRESHOLDS["exhibit_ink_min"],
                        "Inspect the exhibit at reading size for a clear finding and complete "
                        "evidence. Low occupancy alone does not require more content.",
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

    A step off the 1/2/2.5/5 ladder fails the whole axis: 12.4 / 14.025 /
    15.65 / 17.275 / 18.9 steps by 1.625, the mark of interpolated extrema.
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
    The same thing `pdftotext` counts, so a page is compared with the
    benchmark rather than with the runtime's own idea of a page."""
    bands = page_bands(slide)
    return bands.body + bands.footer + bands.title_band


# The bands of the page. A well-made analytical slide's title band carries 20
# words, its body 128 and its footer 19. A floor counting all page text is met
# by padding the footer; the body is where a thin page is thin.
BODY_TOP = 0.18
BODY_BOTTOM = 0.88
FOOTER_ROLES = SOURCE_ROLES | {"page-number", "footer-right", "footer-left", "notes"}
TITLE_BAND_ROLES = {"kicker", "page-tag", "page-tag-pill", "tracker-label", "tracker-pill-label",
                    "tracker-compact-label", "tracker-compact-marker-label", "action-subtitle"}
# A chart's own labels are its evidence wherever the plot ends: a chart that
# takes the body's full height sets its category labels under the 88% line,
# and counted by position they would make a chart page "footer-heavy".
CHART_LABEL_ROLES = {"category-label", "category-note", "axis-label", "axis-title", "data-label"}


class PageText(NamedTuple):
    """One page's text, split into the three bands: the one measurement
    `page_text_words` and `body_bands` both read, so the role vocabulary is
    classified in one place."""
    text_nodes: list
    body: int
    footer: int
    title_band: int


TAKEAWAY_ROLE = re.compile(r"^(insight|takeaway|so-?what|closing)")


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
        # The page's closing takeaway sits low on the page but is its
        # conclusion, not a note: counted by position it made a short page
        # with a takeaway line "footer-heavy" and pushed the line off.
        if TAKEAWAY_ROLE.match(role) or role in CHART_LABEL_ROLES:
            body += words
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


def body_words(slide):
    """The page's body words, as the floor reads them: the authoring
    compiler's count when the scene carries it, this module's own otherwise.

    Both count words one way (text_stats.py, text-contract.mjs textWords).
    What they count differs: the text contract counts a page's text plan by
    block role (body, exhibit and qualification, notes excluded), and
    `page_bands` counts the composed page by node role and position - a
    footnote is qualification to one and footer to the other. So the compiler
    writes its count on the scene slide as `planBodyWords`, and every floor
    reads that one number: a page cannot clear the floor at authoring and fall
    under it at the build. A scene without it (a fixture carries no plan)
    falls back to the band count.
    """
    planned = slide.get("planBodyWords")
    if isinstance(planned, (int, float)) and not isinstance(planned, bool) and planned >= 0:
        return int(planned)
    return body_bands(slide)[0]


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
    """Benchmark density is diagnostic; the complete-copy contract owns matched coverage."""
    return (
        f"{where} falls below the deck-wide body-word diagnostic. Compare its "
        "complete text plan with the matched reference reading task and retain "
        "the same coverage findings through composition and export. Name any "
        "missing evidence, mechanism, qualification or decision consequence "
        "before revising the dot-dash. Do not add rows, columns, labels or "
        "repeated commentary solely to raise the count; a specific coverage "
        "exception remains subject to reader review."
    )


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
        # disagree about the same page, which is the disagreement the one counter
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

    The frame counts as a picture everywhere a picture is counted, so without
    this a deck passes every gate while shipping grey boxes. The placeholder is
    for work in progress; this is what stops it reaching a reader.
    """
    # A table's photo slot is a thumbnail, well under the size floor that keeps
    # an icon-sized frame out of this count - but it is still a photograph
    # nobody supplied, so it is counted whatever its size. So is a chart's
    # empty logo or flag slot beside a category.
    empty = [n for n in slide.get("nodes", [])
             if (str(n.get("role") or "") == "image-frame"
                 and (n.get("frame") or {}).get("width", 0) * (n.get("frame") or {}).get("height", 0) >= PHOTO_MIN_AREA)
             or str(n.get("role") or "") in ("table-photo-placeholder", "category-logo-placeholder")]
    if not empty:
        return
    findings.append(finding(
        slide_no, "UNSOURCED_PICTURE", len(empty), 0,
        "This page draws {} picture frame{} with no picture in {}. Writing a picture as `alt` with no "
        "`path` is how a page gets laid out before its photographs are cleared, and it is not how a deck "
        "is delivered. The build fetches logos from Wikipedia and photographs from Wikimedia Commons; "
        "one still empty found nothing: give it a `search` (or a player's `wikipedia` title) that names it "
        "better, supply the file as `path`, or drop the picture and give the page the icons, the exhibit "
        "or the width instead.".format(
            len(empty), "" if len(empty) == 1 else "s", "it" if len(empty) == 1 else "them"),
    ))


READING_TASK_FLOORS = {task: spec["bodyWords"]["q1"] for task, spec in json.loads(
    (Path(__file__).resolve().parent.parent / "reading-tasks.json").read_text(encoding="utf-8"))["tasks"].items()}


def body_floor(slide):
    """The body-word floor one page is held to: the page's own `wordFloor` when
    its composition set one (the one the text contract holds it to), else its
    reading task's lower quartile (the deck's `pageWords` when the page carries
    no task), cut by the share of the body a photograph holds."""
    own = slide.get("wordFloor")
    if isinstance(own, (int, float)) and not isinstance(own, bool) and own >= 0:
        return int(own)
    task_floor = READING_TASK_FLOORS.get(slide.get("readingTask") or "")
    floor = task_floor if task_floor is not None else (WEIGHT.get("pageWords") or 0)
    if floor <= 0:
        return 0
    return max(0, int(round(floor * (1.0 - picture_share(slide)))))


# The footer may carry under a third of the page's text.
NOTE_HEAVY_SHARE = 0.3


def footer_share(slide):
    """(body, footer, footer / (body + footer)) as NOTE_HEAVY reads them.

    This one stays on the band count, not the plan's: it asks which band of
    the page the words sit in, and the plan counts a numbered footnote as
    qualification in the body - measured that way a page could never be
    footer-heavy on the strength of its footnotes, which is the case the gate
    is for. The footer is the footer as drawn, whoever wrote it: a citation
    the runtime derived from the source registry counts like one the author
    typed, and the runtime fits its own line to the room this bar leaves
    (core.mjs compileSlide, derive-content.mjs citationRoomOf). The ratio is
    None on a page with no words in either band."""
    body, footer, _band = body_bands(slide)
    if not footer and not body:
        return body, footer, None
    return body, footer, footer / float(body + footer)


def gate_thin_page(slide_no, slide, findings):
    """THIN_PAGE. Advisory body-word diagnostic, alongside matched text coverage.

    A page composed from a page type carries its reading task, and is held to
    that task's lower quartile - the same floor the text contract applies. A
    chart carrying its own callouts reads at 42 words; a table with commentary
    at 149, and one flat floor for both would fail the first and pass the
    second.
    """
    floor = body_floor(slide)
    if floor <= 0:
        return
    body = body_words(slide)
    if body < floor:
        findings.append(finding(slide_no, "THIN_PAGE", body, floor, thin_remedy()))
    # Both are reported in one run, so a thin page that is also footer-heavy
    # is fixed in one round.
    # A page that clears the floor on the strength of its notes has padded the
    # wrong band: the reference footer is 19 words against a 128-word body.
    body, footer, ratio = footer_share(slide)
    if footer and body and ratio > NOTE_HEAVY_SHARE:
        findings.append(finding(
            slide_no, "NOTE_HEAVY", {"body": body, "footer": footer},
            "a footer under a third of the page's text",
            "The notes are carrying the page. Put the qualification on the "
            "number it qualifies with a footnote marker, keep the block to two "
            "to four numbered lines, and give the body the words instead.",
        ))
