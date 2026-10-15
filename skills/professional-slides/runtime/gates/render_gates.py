"""The page's own gates: the render's ink and band gates, the band and column
geometry the scene's coverage measures with the same definition, and the
gates that read the page's title, type, measure, words and pictures.

Each gate takes the page's number, the scene slide and the findings list, and
appends what it finds.
"""

from __future__ import annotations

import base64
import io
import math
import re

from PIL import Image

from gate_config import (
    BODY_ROLES,
    CHART_FURNITURE_ROLES,
    DEFAULT_PROFILE,
    FOOTER_TOP,
    PHOTO_MIN_AREA,
    SOURCE_ROLES,
    TABLE_TEXT_ROLES,
    THRESHOLDS,
    TITLE_ROLES,
    TYPE_RANGES,
    finding,
    font_size,
    lines_of,
    source_text,
    text_nodes,
)
# Reading the renders lives in its own module: it shares none of the gate
# vocabulary and is the only part that needs Pillow and numpy.
from ink import CANVAS_H
# One definition of a word, the text contract's.
from text_stats import word_count


def column_repair(column):
    # Only what a page key does: where a group sits in its column and how wide the column is are the composer's.
    return ("The {} column is empty from y {} to {} while the page beside it is full. Give the height to what "
            "can use it - the exhibit at its frame's size, a table with the rows or treated column it was given "
            "the height for - or set the commentary under a short exhibit (`commentary: \"below\"`). Do not "
            "stretch rows or pad text to cover the band.").format(
                column["name"], column["from"], column["to"])


# --- gates -----------------------------------------------------------------


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
    floating mid-plot, a gap between two blocks - is held to
    `internal_void_max`. A column that simply stops short is held to
    `column_void_max`, the tail of the right-column band on well-made pages:
    held to the page's dead band, a third of good side columns would fail.

    A group of text or figures centred in its column (anchored) is set there
    on purpose: a column that does not fill its section is centred on the
    exhibit beside it, the house rule the composer follows
    (compose-arrangements.mjs besideRow). Its margins are no hole, and the
    advice to set it at the top asked for what no page key does: the Spacebar
    run met it on five pages. A gap inside the group is still read, and a
    chart's plot is not a group: air in it is the chart's size or headroom.

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
        if id(column) not in read_with_row and not column["plot"] and anchored(rows, top, bottom):
            first = next(y for y in range(top, bottom) if rows[y] > ROW_MIN)
            bands = void_bands(rows, first, bands["lastInk"] + 1, scale)
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


def gate_title(slide_no, slide, findings):
    """TITLE_LINES. COVER_EXEMPT. The action title holds its band's lines."""
    for node in text_nodes(slide):
        if node.get("role") not in TITLE_ROLES:
            continue
        lines = lines_of(node)
        side = (node.get("data") or {}).get("titlePlacement") == "side"
        most = THRESHOLDS["side_title_lines_max" if side else "title_lines_max"]
        if len(lines) > most:
            findings.append(finding(
                slide_no, "TITLE_LINES", len(lines), most,
                f"Cut the action title to {most} lines down its panel: state the finding, drop the setup clause." if side
                else "Cut the action title to two lines: state the finding, drop the setup clause.",
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


# A picture is taken for a screenshot when its four commonest exact colours cover this share of it: an interface's fills and
# page repeat exactly, a photograph's pixels almost never do. It is refused drawn under SCREENSHOT_SCALE of its own width,
# where a retina capture's 28-pixel type falls under six.
SCREENSHOT_FLAT = 0.4
SCREENSHOT_SCALE = 0.2


def _flat_share(image):
    """The share of `image` its four commonest exact colours cover, read on a nearest-neighbour sample."""
    width, height = image.size
    sample = image.convert("RGB").resize((160, max(1, round(160 * height / max(1, width)))), Image.NEAREST)
    colours = sorted(sample.getcolors(sample.width * sample.height) or [], reverse=True)
    return sum(count for count, _ in colours[:4]) / max(1, sample.width * sample.height)


def gate_picture_unreadable(slide_no, slide, findings):
    """PICTURE_UNREADABLE. A screenshot drawn too small for its text to be read.

    A photograph is seen, and reads as a thumbnail; a screenshot is read, and its type shrinks with it. The Spacebar deck
    set six 2,400-pixel app captures in 379 by 114-pixel slots of a picture strip, each drawn at 4% of its own width, its
    labels under a pixel high, and every gate passed it.
    """
    for node in slide.get("nodes", []):
        if node.get("type") != "image" or str(node.get("role") or "") != "image":
            continue
        uri = str((node.get("data") or {}).get("dataUri") or "")
        if not uri.startswith("data:image/"):
            continue
        try:
            image = Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1])))
            image.load()
        except Exception:  # noqa: BLE001 - a picture the gate cannot decode is the emitter's to refuse
            continue
        frame = node.get("frame") or {}
        width, height = image.size
        fit = (node.get("style") or {}).get("fit") or (node.get("data") or {}).get("fit") or "contain"
        ratios = (frame.get("width", 0) / max(1, width), frame.get("height", 0) / max(1, height))
        scale = max(ratios) if fit == "cover" else min(ratios)
        if scale >= SCREENSHOT_SCALE or _flat_share(image) < SCREENSHOT_FLAT:
            continue
        findings.append(finding(
            slide_no, "PICTURE_UNREADABLE",
            {"node": node.get("id"), "pixels": [width, height], "drawn": [round(width * scale), round(height * scale)], "scale": round(scale, 3)},
            f"a screenshot drawn at {SCREENSHOT_SCALE:.0%} of its width or more",
            f"This screenshot is drawn {round(width * scale)} pixels wide, {scale:.0%} of its own {width}, so its text cannot be "
            "read. Show fewer at a size that reads - one beside its point (picture-hero) or two (picture-pair) - crop it to "
            "the part the page is about, or say in words what it shows.",
        ))


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
    # empty logo or flag slot beside a category, and a table's beside a row's
    # label or a column's.
    empty = [n for n in slide.get("nodes", [])
             if (str(n.get("role") or "") == "image-frame"
                 and (n.get("frame") or {}).get("width", 0) * (n.get("frame") or {}).get("height", 0) >= PHOTO_MIN_AREA)
             or str(n.get("role") or "") in ("table-photo-placeholder", "category-logo-placeholder",
                                             "table-logo-placeholder", "table-header-logo-placeholder")]
    if not empty:
        return
    findings.append(finding(
        slide_no, "UNSOURCED_PICTURE", len(empty), 0,
        "This page draws {} picture frame{} with no picture in {}. Writing a picture as `alt` with no "
        "`path` is how a page gets laid out before its photographs are cleared, and it is not how a deck "
        "is delivered. The build fetches logos from Wikipedia, and photographs, illustrations and flags from "
        "Wikimedia Commons; one still empty found nothing: give it a `search` (or a player's `wikipedia` title) "
        "that names it better, supply the file as `path` (a flag as assets/flags/<code>.png), or drop the "
        "picture and give the page the icons, the exhibit or the width instead.".format(
            len(empty), "" if len(empty) == 1 else "s", "it" if len(empty) == 1 else "them"),
    ))


