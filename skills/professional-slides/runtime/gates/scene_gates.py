"""Gates read off the composed scene, so they run at authoring as well as at
the build.

How full the page's body is, read off the scene rather than off the render
(scene_rows, measured by void_bands as the render's rows are). The pixel
gates (INK_COVERAGE, DEAD_BAND, INTERNAL_VOID) only run at the build, which is
the most expensive place to learn that a page is half empty. The composed
scene carries every frame the render will draw, so the question can be asked
at authoring, where the answer is still cheap. The page's estimated ink, its
columns, tables and charts, and the composition of its exhibits are read
here the same way.
"""

from __future__ import annotations

import math
import re

from gate_config import (
    ARGUMENT_COMPONENTS, DATA_COMPONENTS, DECK_HABIT, FOOTER_TOP, GENERATED_PAGE, SOURCE_ROLES,
    THRESHOLDS, TITLE_ROLES, WEIGHT, all_components, finding, font_size, is_cover, is_exhibit,
    layout_of, photo_nodes, source_text, text_nodes, top_level_instances,
)
from ink import CANVAS_W, SURFACE_LUMINANCE
from render_gates import (
    VOID_TOP, column_bands, column_repair, nodes_inside, scene_column_rows, side_columns, void_bands,
)
# The same measure estimated from the scene, so it runs at authoring, and the
# scene's colours read the one way both scene measures read them.
from scene_ink import GLYPH_BAND, SHAPE_TYPES, canvas_of, color_of, grey_of
from scene_ink import estimate as scene_ink_estimate
from text_stats import TITLE_STOPWORDS, word_count


# A shape that holds text is a container: a card, a panel, a tile, a table
# header cell. Its frame is designed space, not content - a card drawn to the
# height of its row with one short paragraph at the top reads as an empty box,
# and counting the box as filled would pass it. So a
# container's interior is measured by what is inside it. A mark is never a
# container, whatever sits on it: a column carrying its value label is data,
# and so is a step's solid column carrying its step.
SCENE_MARK_ROLE = re.compile(r"^(chart-|map-|table-(bar|bubble|progress|rating|check|trend|implication|status)|"
                             r"metric-ring|gantt-(bar|milestone)|legend-|spectrum-|fact-gauge|matrix-point|step-column)")


def _text_box(node):
    """A text node's ink box: its measured lines, placed by its alignment,
    rather than the frame the composer allowed it. A one-line paragraph in a
    frame sized for five is one line of ink."""
    frame = node.get("frame") or {}
    x, y = float(frame.get("x") or 0), float(frame.get("y") or 0)
    width, height = float(frame.get("width") or 0), float(frame.get("height") or 0)
    layout = layout_of(node)
    style = node.get("style") or {}
    ink_w = layout.get("width") if isinstance(layout.get("width"), (int, float)) else None
    ink_h = layout.get("height") if isinstance(layout.get("height"), (int, float)) else None
    if ink_h is None and isinstance(layout.get("lines"), list) and isinstance(layout.get("lineHeight"), (int, float)):
        ink_h = len(layout["lines"]) * layout["lineHeight"]
    if ink_w is not None and 0 < ink_w < width:
        align = str(style.get("align") or "left")
        x += (width - ink_w) / 2 if align == "center" else (width - ink_w) if align == "right" else 0
        width = ink_w
    if ink_h is not None and 0 < ink_h < height:
        valign = str(style.get("valign") or "top")
        y += (height - ink_h) / 2 if valign in ("mid", "middle", "center") else (height - ink_h) if valign == "bottom" else 0
        height = ink_h
    return x, y, width, height


def scene_rows(slide):
    """The occupied pixels on each canvas row above the footer, drawn from the
    scene the way the render's void gates read the PNG (scene_mask)."""
    return [row.count(1) for row in scene_mask(slide)]


def scene_mask(slide):
    """The canvas above the footer as rows of occupied (1) and empty (0)
    pixels, drawn from the scene the way the render's void gates read the PNG.
    scene_rows counts it by row; column_bands slices it by column.

    Node boxes are not what the render sees: a number tile's box where the
    render sees a value and a label, a staircase's frame where it sees three
    steps. So this draws what is drawn: text by its
    measured lines and each line by its glyph band (GLYPH_BAND of the face
    centred on its line); a shape by its fill when
    the fill shows against the canvas and by its outline when only the stroke
    does; a rule by its stroke. What shows is the render's test,
    SURFACE_LUMINANCE held at its distance from this page's canvas
    (ink.relative), so a white card on a cream page is air and a tinted one is
    surface, as they are in the PNG. Title and tracker are drawn too: the
    render sees them, and the band under a title is the page's first hole.

    One thing the render cannot read and this does: the inside of a container.
    A card or tile drawn to the height of its row with one short paragraph at
    the top shows as surface in the PNG, and counting it filled is how three
    cards empty below their paragraphs passed. A box that holds text is drawn
    to the depth its contents reach, plus the padding it keeps above them, and
    its bottom edge where it is drawn.
    """
    nodes = [n for n in slide.get("nodes", []) if n.get("frame")]
    background = grey_of(canvas_of(slide))
    margin = 255 - SURFACE_LUMINANCE
    rows = [bytearray(CANVAS_W) for _ in range(FOOTER_TOP)]

    def shows(value, opacity=1.0):
        color = color_of(value)
        if color is None:
            return False
        opacity = opacity if isinstance(opacity, (int, float)) else 1.0
        grey = background + (grey_of(color) - background) * opacity
        # Darker than the page by the render's margin; on a dark page, where
        # the render's darker-than test sees nothing, lighter.
        return grey < background - margin if background >= 128 else grey > background + margin

    def paint(x, y, w, h):
        x0, x1 = max(0, int(math.floor(x))), min(CANVAS_W, int(math.ceil(x + w)))
        y0, y1 = max(0, int(math.floor(y))), min(FOOTER_TOP, int(math.ceil(y + h)))
        if x0 >= x1 or y0 >= y1:
            return
        span = b"\x01" * (x1 - x0)
        for row in rows[y0:y1]:
            row[x0:x1] = span

    def number(value, default=0.0):
        if isinstance(value, dict):
            value = value.get("value")
        return float(value) if isinstance(value, (int, float)) else default

    def inside(box, outer):
        bx, by, bw, bh = box
        x, y, w, h = outer
        return x - 1 <= bx + bw / 2 <= x + w + 1 and y - 1 <= by + bh / 2 <= y + h + 1 and w * h > bw * bh

    # What each node draws, and where: (node, box, kind) with text by its ink box.
    drawn = []
    for node in nodes:
        kind, style, frame = node.get("type"), node.get("style") or {}, node["frame"]
        box = (float(frame.get("x") or 0), float(frame.get("y") or 0),
               float(frame.get("width") or 0), float(frame.get("height") or 0))
        opacity = style.get("opacity", 1.0)
        if kind == "text":
            if word_count(source_text(node)) and shows(style.get("color") or "#000000", opacity):
                drawn.append((node, _text_box(node), "text"))
        elif kind == "image":
            drawn.append((node, box, "image"))
        elif kind == "line":
            if shows(style.get("stroke"), opacity):
                drawn.append((node, box, "line"))
        elif kind in SHAPE_TYPES:
            if shows(style.get("fill"), opacity):
                drawn.append((node, box, "fill"))
            elif style.get("stroke") != "none" and shows(style.get("stroke"), opacity):
                drawn.append((node, box, "outline"))

    texts = [box for _, box, kind in drawn if kind == "text"]
    for node, (x, y, w, h), kind in drawn:
        style = node.get("style") or {}
        stroke = max(1.0, number(style.get("lineWidth"), 1.0))
        if kind == "text":
            layout = layout_of(node)
            if not isinstance(layout.get("lines"), list):
                paint(x, y, w, h)  # unmeasured: the frame is all there is to go on
                continue
            lines = max(1, len(layout["lines"]))
            pitch = number(layout.get("lineHeight"), number(style.get("lineHeight"), h / lines))
            face = min(pitch, (font_size(node) or 12) * 4 / 3)
            for index in range(lines):
                top = y + index * pitch + (pitch - face) / 2
                if top >= y + h:
                    break
                paint(x, top + face * GLYPH_BAND[0], w, face * (GLYPH_BAND[1] - GLYPH_BAND[0]))
        elif kind == "image":
            paint(x, y, w, h)
        elif kind == "line":
            # Row by row a slanted rule crosses width/height pixels plus its
            # stroke whichever way it leans, so its box is walked a row at a time.
            if h < 1 or w < 1:
                paint(x - (stroke / 2 if w < 1 else 0), y - (stroke / 2 if h < 1 else 0), max(w, stroke), max(h, stroke))
            else:
                step = w / h
                for dy in range(int(math.ceil(h))):
                    paint(x + dy * step, y + dy, step + stroke, 1)
        else:
            depth = h
            # Only a box contains: an arc or a wedge with its labels inside
            # its bounds (a radial bar's rings) is a mark, drawn whole.
            if (node.get("type") == "rect" and not SCENE_MARK_ROLE.match(str(node.get("role") or ""))
                    and any(inside(t, (x, y, w, h)) for t in texts)):
                held = [b for other, b, _ in drawn if other is not node and inside(b, (x, y, w, h))]
                top, bottom = min(b[1] for b in held), max(b[1] + b[3] for b in held)
                depth = min(h, (bottom - y) + max(0.0, top - y))
            if kind == "fill":
                paint(x, y, w, depth)
            else:
                for edge in ((x, y, w, stroke), (x, y + h - stroke, w, stroke),
                             (x, y, stroke, depth), (x + w - stroke, y, stroke, depth)):
                    paint(*edge)

    # A chart whose marks the scene does not carry - labels alone, a sketched
    # scene - is read by its frame: the render will draw it there.
    marks = [b for _, b, kind in drawn if kind != "text"]
    for instance in slide.get("componentInstances", []):
        frame = instance.get("frame") or {}
        if not str(instance.get("component") or "").startswith("chart.") or not frame.get("height"):
            continue
        box = (float(frame.get("x") or 0), float(frame.get("y") or 0),
               float(frame.get("width") or 0), float(frame.get("height") or 0))
        if not any(inside(b, box) for b in marks):
            paint(*box)
    return rows


def scene_text_boxes(slide):
    """The text the scene draws in the page's own ink, each with the box its
    glyphs take: [(node, (x, y, w, h))]. What a render is checked against node
    by node (page_gates.lost_text): a run of text the scene holds and the
    render shows nothing of did not reach the page."""
    background = grey_of(canvas_of(slide))
    margin = 255 - SURFACE_LUMINANCE
    out = []
    for node in slide.get("nodes", []):
        if node.get("type") != "text" or not node.get("frame") or not word_count(source_text(node)):
            continue
        style = node.get("style") or {}
        color = color_of(style.get("color") or "#000000")
        opacity = style.get("opacity", 1.0)
        opacity = opacity if isinstance(opacity, (int, float)) else 1.0
        if color is None:
            continue
        grey = background + (grey_of(color) - background) * opacity
        if grey < background - margin if background >= 128 else grey > background + margin:
            out.append((node, _text_box(node)))
    return out


def scene_void(slide, mask=None):
    """The band of the page's body the scene leaves empty: (bands, void).

    The one decision SCENE_VOID and the author's budget line (page_budget)
    both read, so a "!" on the budget and the advisory are the same finding.
    The page's rows are asked first (void_bands against THRESHOLDS
    `internal_void_max`, `dead_band_max`); where they pass, its columns
    (column_bands, the render's COLUMN_VOID). `void` is None, the page's band
    {kind, band, from, to, threshold}, or the column's (column_bands' record,
    with `column` its name). `kind` - internal, dead or column - names the
    render gate the band stands for, and so the bar it blocks at (severity).
    `mask` is scene_mask(slide) when the caller has it.
    """
    mask = scene_mask(slide) if mask is None else mask
    bands = void_bands([row.count(1) for row in mask])
    if bands["internalVoid"] > THRESHOLDS["internal_void_max"]:
        return bands, {"kind": "internal", "band": bands["internalVoid"], "from": bands["voidTop"], "to": bands["voidBottom"], "threshold": THRESHOLDS["internal_void_max"]}
    if bands["deadBand"] > THRESHOLDS["dead_band_max"]:
        top = bands["lastInk"] + 1 if bands["lastInk"] is not None else VOID_TOP
        return bands, {"kind": "dead", "band": bands["deadBand"], "from": top, "to": FOOTER_TOP, "threshold": THRESHOLDS["dead_band_max"]}
    column = column_bands(slide, scene_column_rows(mask))
    return bands, ({**column, "kind": "column", "column": column["name"]} if column else None)


def gate_scene_void(slide_no, slide, findings):
    """SCENE_VOID. The render's INTERNAL_VOID and DEAD_BAND, read off the
    composed scene so the author hears them before the build.

    One definition (void_bands) and one set of thresholds (THRESHOLDS
    `internal_void_max`, `dead_band_max`) serve both: the pixel gates count the
    PNG's rows, this counts the rows the scene will draw (scene_rows), so the
    two name the same pages give or take a band a pixel either side of the bar
    and the inside of a card, which the render cannot see. Like the render's gates it
    is a question at mild values - a chart that wants air, a sparse group
    centred on purpose - and blocks past the fill's `_block` bar for the band
    it measured (severity); across the deck the habit blocks too
    (gate_deck_empty_pages).

    Where the page's rows pass, its columns are asked the same question: the
    finding names the column, and it stays one finding for the page, so the
    deck count reads a half-empty column as the half-empty page it is.
    """
    bands, void = scene_void(slide)
    if void is None:
        return
    measured = {"kind": void["kind"], "band": round(void["band"], 4), "from": void["from"], "to": void["to"],
                "internalVoid": round(bands["internalVoid"], 4), "deadBand": round(bands["deadBand"], 4)}
    if "column" in void:
        measured.update(column=void["column"], columnInternalVoid=round(void["internalVoid"], 4), columnDeadBand=round(void["deadBand"], 4),
                        **({"plot": True} if void.get("plot") else {}))
    findings.append(finding(
        slide_no, "SCENE_VOID", measured, void["threshold"],
        column_repair(void) if "column" in void else
        "A band of the page (y {}-{}) carries nothing. Give the exhibit the height - the phases or rows "
        "with their detail, the chart at the frame's size - size tiles and cards to what they hold, start "
        "the body under the title rather than centring it in air, set the commentary beside the exhibit "
        "rather than under a strip of air, or merge the page with a neighbour. Do not stretch rows or pad "
        "text to cover the band.".format(void["from"], void["to"]),
    ))


# How much of its body a page inks, estimated from the scene (scene_ink.py):
# the rendered measure strong analytical decks sit at a median of about 0.26
# on, where a deck drawn as type on the canvas with hairlines sat at 0.18 with
# the same words. `page_floor` is where a page with an exhibit reads light at
# a glance: about half the lower quartile of strong pages (0.195), the level
# of the lightest pages two real decks drew - a lone thin line, a table of text
# on the page colour, white cards on cream measured 0.06-0.09. `deck_median`
# is the level under which the deck as a whole reads light. Both advisory: the
# estimate is fitted (R^2 0.90, mean error 0.017 a page), and the repair is a
# construction, not a number to hit.
SCENE_INK_THRESHOLDS = {"page_floor": 0.10, "deck_median": 0.20}
SCENE_INK_REPAIR = (
    "Give the exhibit its weight rather than adding words: keep the house surfaces on (a filled table "
    "header and label column, filled cards, a lone line's markers and area, filled phase blocks - "
    "style.tableHeader, style.tableLabels, style.cards, style.marks, style.timeline; no `headerBand: false`), "
    "set loose rows of text as a table or cards, or pair a lone chart with a second exhibit that carries "
    "its breakdown.")


def analytical(slide, index):
    """A page that argues: it carries an action title or a reading task and is
    neither a cover nor a structural or generated page. The one definition
    (weight.json analyticalPage) the census and the review's statistics count too."""
    argues = bool(slide.get("readingTask")) or any(n.get("role") == "action-title" for n in slide.get("nodes", []))
    return argues and not is_cover(slide, index) and not GENERATED_PAGE.match(str(slide.get("id") or ""))


def gate_scene_ink(slide_no, slide, findings, ink=None):
    """SCENE_INK. Advisory. A page with an exhibit whose scene will ink less
    of its body than SCENE_INK_THRESHOLDS `page_floor` - the rendered measure,
    estimated before the render (scene_ink.estimate). A page of prose is left
    to its word floor: its weight is its words, and asking it for ink is
    asking for padding. `ink` is the page's estimate when the caller has it."""
    if not any(is_exhibit(c) for c in slide.get("componentInstances", [])):
        return
    ink = scene_ink_estimate(slide) if ink is None else ink
    if ink >= SCENE_INK_THRESHOLDS["page_floor"]:
        return
    findings.append(finding(
        slide_no, "SCENE_INK", ink, SCENE_INK_THRESHOLDS["page_floor"],
        "The page will ink about {:.0%} of its body; a page with an exhibit reads light under {:.0%}. {}".format(
            ink, SCENE_INK_THRESHOLDS["page_floor"], SCENE_INK_REPAIR),
    ))


def gate_deck_ink(slides, content_indexes, findings, estimate=scene_ink_estimate):
    """DECK_INK. Advisory. The median analytical page's estimated ink against
    SCENE_INK_THRESHOLDS `deck_median`: one light page can be right, a light
    deck is a construction habit. Advisory rather than blocking, because the
    remedy is a design choice the author makes page by page, and a bar that
    blocks invites fills drawn to pass it. `estimate` reads one page's ink."""
    inks = [estimate(slides[index]) for index in content_indexes if analytical(slides[index], index)]
    if len(inks) < DECK_HABIT["from"]:
        return
    median = sorted(inks)[len(inks) // 2]
    if median >= SCENE_INK_THRESHOLDS["deck_median"]:
        return
    findings.append(finding(
        None, "DECK_INK", round(median, 3), SCENE_INK_THRESHOLDS["deck_median"],
        "The median analytical page will ink about {:.0%} of its body; strong decks carry about 26% with the "
        "same words. Fix the construction across the deck, not the copy: {}".format(median, SCENE_INK_REPAIR),
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
                "Inspect whether the commentary develops a useful consequence. "
                "Center a complete sparse group or give its space to evidence; "
                "add material only when a specific premise is missing.",
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
            "annotation-surface", "chart-badge", "chart-reference-label"))
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
                    "annotation-surface", "chart-badge", "chart-reference-label")):
                peer_annotated = True
                break
        if peer_annotated:
            continue
        # The marks are read with their names and values: a bar chart spends
        # its width on the members' names and its values' gutters, which are
        # the chart's own content, not air. Read on the bars alone, a change
        # chart of six regions ("West Asia & Indian Ocean") with a bar below
        # zero spanned 0.48 of its panel with every value on a tight scale, and
        # nothing the author could tighten; what the gate is for - a loose
        # scale, an empty reserved band - still leaves the span short.
        def span_of(instance_frame, horizontal_axis):
            instance_marks = nodes_inside(slide, instance_frame, lambda n: str(n.get("role") or "") == "chart-mark")
            if len(instance_marks) < 2:
                return None
            inked = instance_marks + nodes_inside(slide, instance_frame, lambda n: str(n.get("role") or "") in ("data-label", "category-label"))
            if horizontal_axis:
                lo = min(m["frame"].get("x", 0) for m in inked)
                hi = max(m["frame"].get("x", 0) + m["frame"].get("width", 0) for m in inked)
                return (hi - lo) / max(1.0, float(instance_frame.get("width") or 1))
            lo = min(m["frame"].get("y", 0) for m in inked)
            hi = max(m["frame"].get("y", 0) + m["frame"].get("height", 0) for m in inked)
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
    # A chart over its own data table (the model page) prints its figures in
    # the table, one under each category, and leaves its marks unlabelled so
    # each figure is printed once: the table's figures are the chart's.
    labels = [n for n in text_nodes(slide) if str(n.get("role") or "") == "data-label"
              or (str(n.get("role") or "") == "table-cell-text" and (n.get("data") or {}).get("chartData") is True)]
    numeric = [n for n in labels if re.search(r"\d", source_text(n))]
    marks = [n for n in slide.get("nodes", []) if str(n.get("role") or "") == "chart-mark"]
    # While the marks are countable, every one of them carries its value: ten
    # labelled bars is ten blocks of evidence, and it is what lets the axis go.
    wanted = len(marks) if 0 < len(marks) <= 12 else 3
    if len(numeric) >= wanted:
        return
    findings.append(finding(
        slide_no, "NUMBERS_ON_MARKS", len(numeric), wanted,
        "Inspect whether values needed for the claim are readable through direct "
        "labels, a quantitative axis or anchored annotations. Label decisive "
        "values; a raw mark count does not require labelling every observation.",
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
    # Two or more marks provide an opportunity for a useful local comparison.
    # An advisory count cannot establish that a further annotation is needed.
    if len(marks) < 2:
        return
    annotated = [n for n in slide.get("nodes", []) if str(n.get("role") or "") in ANNOTATION_ROLES]
    if annotated:
        return
    findings.append(finding(
        slide_no, "UNANNOTATED", 0, "one annotation on the chart",
        "Check whether a decisive comparator, event or scope condition is "
        "missing at its relevant mark. If so, add a supported local annotation. "
        "A chart whose values, labels and title already establish the claim "
        "does not need a redundant callout to satisfy this count.",
    ))


# A figure that draws a baseline or an axis has said it is a plot, and a plot's
# marks are read as sizes. `steps`, `funnel`, `process` and the rest draw equal
# blocks on purpose - they say order, not magnitude - which is right until the
# author prints quantities on them.
FIGURE_GROUND = re.compile(r"^([a-z]+)-(baseline|axis|rail)$")
QUANTITY = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(min(?:ute)?s?|hours?|hrs?|days?|weeks?|months?|years?"
                      r"|%|bn|m|k|pts?|points?|films?|people|staff|sites?|stores?)\b", re.I)


def gate_unscaled_figure(slide_no, slide, findings):
    """UNSCALED_FIGURE. Equal blocks under an axis, with unequal numbers on them.

    A five-step staircase inside a plot frame with a baseline, its blocks all
    one height, labelled 126, 143, 136, 148 and 330 minutes, draws the
    330-minute payoff the size of the 126-minute opener. The figure's geometry
    contradicts its own labels, and a reader who notices reads every other
    figure in the deck twice.

    The answer is not to scale a staircase: a staircase says sequence. It is to
    take the quantities off it and draw them where size means something, or to
    drop the plot furniture so the figure stops claiming to be one.
    """
    nodes = slide.get("nodes", [])
    families = {m.group(1) for m in (FIGURE_GROUND.match(str(n.get("role") or "")) for n in nodes) if m}
    for family in sorted(families):
        blocks = [n for n in nodes if str(n.get("role") or "") == f"{family}-block" and n.get("type") != "text"]
        if len(blocks) < 3:
            continue
        sizes = {(round((n.get("frame") or {}).get("width", 0)), round((n.get("frame") or {}).get("height", 0)))
                 for n in blocks}
        if len(sizes) > 1:
            continue  # the figure draws its marks to something
        values = {}
        for node in nodes:
            role = str(node.get("role") or "")
            if not role.startswith(f"{family}-") or node.get("type") != "text":
                continue
            match = QUANTITY.search(source_text(node))
            if match:
                values.setdefault(match.group(2).lower(), []).append(float(match.group(1).replace(",", "")))
        for unit, found in values.items():
            if len(found) < 3 or min(found) <= 0:
                continue
            if max(found) / min(found) < 1.5:
                continue
            findings.append(finding(
                slide_no, "UNSCALED_FIGURE",
                {"figure": family, "blocks": len(blocks), "values": sorted(found)[:6], "unit": unit},
                f"{max(found):g} drawn larger than {min(found):g}",
                f"This figure draws {len(blocks)} blocks at one size and prints {min(found):g} on one and "
                f"{max(found):g} on another, under its own baseline. A reader reads size as quantity, so the "
                "page says two different things at once. Either take the quantities off the figure and let it "
                "say what it is for - the order of the steps - and draw the numbers as a chart beside it, or "
                "use a chart here instead: this figure cannot draw them.",
            ))
            break


# "Three of four", "five of the six": a title that counts is a title a reader
# checks, in about a second, against the thing underneath it.
NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
                "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12}
COUNT_CLAIM = re.compile(
    r"\b(?P<part>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s+"
    r"of\s+(?:the\s+)?(?P<whole>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\b", re.I)


def _count_word(text):
    lowered = str(text).lower()
    return NUMBER_WORDS.get(lowered, int(lowered) if lowered.isdigit() else None)


def gate_title_count(slide_no, slide, findings):
    """TITLE_COUNT. The title counts, and the page shows a different number.

    "Three of four common tastes point at DC" over a 2x2 whose four panels end
    DC, Marvel, DC, Marvel says three where the page shows two. A reader counts
    to two in one second and stops trusting every other number in the deck.

    Only a title that names both parts of a count is measured, and only against
    a set of peers the page actually draws - four panel headings, six rows, ten
    cards. Where the named thing appears in none of them there is nothing to
    count and the page passes.
    """
    title = ""
    for node in text_nodes(slide):
        if str(node.get("role") or "") == "action-title":
            title = source_text(node)
            break
    if not title:
        return
    claim = COUNT_CLAIM.search(title)
    if not claim:
        return
    part, whole = _count_word(claim.group("part")), _count_word(claim.group("whole"))
    if not part or not whole or part > whole or whole < 2 or whole > 12:
        return
    # The named thing: a capitalised word the title uses that is not its first.
    words = re.findall(r"[A-Za-z][\w'’-]*", title)
    terms = [word for word in words[1:] if word[0].isupper() and word.lower() not in TITLE_STOPWORDS]
    if not terms:
        return
    groups = {}
    for node in text_nodes(slide):
        role = str(node.get("role") or "")
        if role in TITLE_ROLES or role in SOURCE_ROLES:
            continue
        groups.setdefault(role, []).append(source_text(node))
    for term in terms:
        for role, texts in groups.items():
            if len(texts) != whole:
                continue
            found = sum(1 for text in texts if re.search(rf"\b{re.escape(term)}\b", text))
            if not found or found == part:
                continue
            findings.append(finding(
                slide_no, "TITLE_COUNT", {"title": title[:70], "term": term, "counted": found, "of": whole},
                part,
                f"The title says {claim.group(0)} and the page draws {found} of {whole} carrying "
                f"\"{term}\". A reader checks a count like this without meaning to, in about a second, and a "
                "title its own exhibit contradicts costs the page every other number on it. Count it off "
                "the exhibit and rewrite whichever is wrong.",
            ))
            return


def gate_heading_wraps(slide_no, slide, findings):
    """HEADING_WRAPS. The exhibit banner is one line: the measure, the population
    and the period, with the unit inline after it. Two lines means the heading is
    carrying a qualification that belongs in the note, or a unit written as a
    sentence ("$k, published base-salary band" rather than "$k").

    A short unit that will not fit beside a one-line heading is not reported:
    the runtime sets it under the heading. The finding carries what was
    measured - the text, its width on one line and the width the frame gives
    it - so the author cuts the right words by the right amount."""
    for node in text_nodes(slide):
        data = node.get("data") or {}
        wrapped = data.get("headingWrapped")
        if not wrapped:
            continue
        measure = wrapped if isinstance(wrapped, dict) else {}
        text = str(measure.get("text") or source_text(node))
        width, available = measure.get("width"), measure.get("available")
        fit = (f" is {width}px on one line; this frame gives its heading {available}px, "
               f"about {int(len(text) * available / width)} characters" if width and available else " wraps")
        if measure.get("reason") == "unit":
            repair = (f"\"{text}\"{fit}. The unit is a phrase, so it cannot sit beside the heading: make it a unit "
                      "(\"$k\", \"% y/y\") and move the basis (\"published base-salary band\") into the note under the page.")
        else:
            repair = (f"\"{text}\"{fit}. Shorten the heading to the measure, the population and the period; "
                      "a qualification belongs in the note. The unit is not the cause - it moves under the heading when it does not fit beside it.")
        findings.append(finding(slide_no, "HEADING_WRAPS", text[:90], "one line", repair))


def gate_thin_evidence(slide_no, slide, findings):
    """Report exhibit multiplicity for semantic review, not as a proof quota.

    One bridge can reconcile six quantities; one table can develop several
    premises. Conversely, two empty comparisons do not establish an argument.
    """
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
        "Review whether the title's promised evidence is developed on this page. "
        "Name any missing premise and repair its existing exhibit or content. "
        "A complete standalone exhibit or developed synthesis needs no extra "
        "component solely to meet this count.",
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
        "State the missing interpretation or decision consequence in the "
        "existing argument region, using `soWhat`, `insight` or developed "
        "`points` as appropriate. Explain the comparison's result without "
        "inventing a winner or adding a fixed number of commentary blocks.",
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
