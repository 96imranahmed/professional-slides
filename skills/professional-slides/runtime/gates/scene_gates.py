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
import sys
from pathlib import Path

from gate_config import FOOTER_TOP, THRESHOLDS, finding, font_size, layout_of, source_text, text_nodes
from ink import CANVAS_W, SURFACE_LUMINANCE
from render_gates import VOID_TOP, column_bands, column_repair, scene_column_rows, void_bands
# The same measure estimated from the scene, so it runs at authoring, and the
# scene's colours read the one way both scene measures read them.
from scene_ink import GLYPH_BAND, SHAPE_TYPES, canvas_of, color_of, grey_of, ground_at
from text_stats import word_count
# What a title counts is read, not matched (judgements.py).

# WCAG contrast, the one definition the scene and the emitter read (emit/color.py).
sys.path.insert(1, str(Path(__file__).resolve().parent.parent / "emit"))
from color import contrast  # noqa: E402


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


# Type and marks read against what they are set on (scene_ink.ground_at): the
# page's canvas, or the band, panel or bar under them. The palette holds its ink
# and primary to its canvas (palettes.mjs CANVAS_CONTRAST), and a page set on a
# dark or a primary ground takes colours derived for that ground (groundTokens);
# but a palette written with a dark canvas over the house's light-page series
# drew a chart navy on navy, and every gate passed it. The bars are where type
# and marks are lost, not WCAG's: the quietest type the runtime sets on its own
# light page - a comparator's label in the rule grey, white on a pale series -
# reads at 2.8:1, so `text` stops short of it; an exhibit is lost when none of
# its marks reads at the palette's floor for a mark (2:1).
GROUND_CONTRAST = {"text": 2.5, "marks": 2.0}
GROUND_MARK_ROLES = frozenset({"chart-mark", "chart-line", "chart-marker", "chart-segment", "table-bar"})


def ground_contrast(slide):
    """What the page sets that is lost on its ground: each run of type that
    reads under GROUND_CONTRAST `text` against what it sits on, and each exhibit
    none of whose marks reads at `marks`, as [{kind, ratio, color, ground, role,
    text | instance}], the least legible first."""
    nodes = [n for n in slide.get("nodes", []) if n.get("frame")]
    canvas = canvas_of(slide)
    lost, marks = [], {}
    for index, node in enumerate(nodes):
        style, frame = node.get("style") or {}, node["frame"]
        if node.get("type") == "text":
            color = color_of(style.get("color"))
            if not color or not word_count(source_text(node)):
                continue
            x, y, w, h = _text_box(node)
            ground = ground_at(nodes, index, x + w / 2, y + h / 2, canvas)
            if ground and contrast(color, ground) < GROUND_CONTRAST["text"]:
                lost.append({"kind": "text", "ratio": round(contrast(color, ground), 2), "color": color, "ground": ground,
                             "role": node.get("role"), "text": " ".join(source_text(node).split())[:60], **_token(style.get("color"))})
        elif node.get("role") in GROUND_MARK_ROLES:
            color = color_of(style.get("stroke") if node.get("type") == "line" else style.get("fill")) or color_of(style.get("stroke"))
            ground = ground_at(nodes, index, float(frame.get("x") or 0) + float(frame.get("width") or 0) / 2,
                               float(frame.get("y") or 0) + float(frame.get("height") or 0) / 2, canvas)
            if not color or not ground:
                continue
            instance = (node.get("data") or {}).get("componentInstance") or node.get("id")
            record = {"kind": "marks", "ratio": round(contrast(color, ground), 2), "color": color, "ground": ground,
                      "role": node.get("role"), "instance": instance,
                      **_token(style.get("stroke") if node.get("type") == "line" else style.get("fill") or style.get("stroke"))}
            if instance not in marks or record["ratio"] > marks[instance]["ratio"]:
                marks[instance] = record
    lost += [record for record in marks.values() if record["ratio"] < GROUND_CONTRAST["marks"]]
    return sorted(lost, key=lambda record: record["ratio"])


def _token(value):
    """The palette token a style colour is drawn from, as {"token": id}, where the scene names one."""
    token = value.get("tokenId") if isinstance(value, dict) else None
    return {"token": token} if isinstance(token, str) and token else {}


def _reading(color, ground, bar):
    """The nearest colour to `color` that reads at `bar` on `ground`, as (hex,
    ratio): mixed toward black or white, whichever the ground stands further
    from, a twentieth at a time; None where even the pole does not."""
    pole = "#000000" if contrast("#000000", ground) >= contrast("#FFFFFF", ground) else "#FFFFFF"
    a = [int(color[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(pole[i:i + 2], 16) for i in (1, 3, 5)]
    for step in range(1, 21):
        mixed = "#" + "".join("{:02X}".format(round(x + (y - x) * step / 20)) for x, y in zip(a, b))
        if contrast(mixed, ground) >= bar + 0.05:
            return mixed, round(contrast(mixed, ground), 2)
    return None


def gate_ground_contrast(slide_no, slide, findings):
    """GROUND_CONTRAST. Type, or an exhibit's marks, set where they cannot be
    read: under GROUND_CONTRAST on the ground they sit on. One finding a page,
    naming the least legible and how many more, the bar it is under, and the
    key to change: where it sits on the page's own canvas, dark under colours
    drawn for a light page, the palette's `color.canvas` and `tone`, which
    derives the colours for the ground; elsewhere the palette token the type
    or the marks are drawn in, with the nearest colour that reads there."""
    lost = ground_contrast(slide)
    if not lost:
        return
    worst = lost[0]
    bar = GROUND_CONTRAST[worst["kind"]]
    what = ('Type "{}" ({})'.format(worst["text"], worst["role"]) if worst["kind"] == "text"
            else "Every mark of {}".format(worst["instance"]))
    more = " and {} more like it".format(len(lost) - 1) if len(lost) > 1 else ""
    said = "{} reads at {}:1 on its ground ({} on {}){}, under the {}:1 {} {} held to.".format(
        what, worst["ratio"], worst["color"], worst["ground"], more, bar, "type" if worst["kind"] == "text" else "an exhibit's marks",
        "is" if worst["kind"] == "text" else "are")
    canvas, toned = canvas_of(slide), slide.get("ground") in ("dark", "primary")
    if worst["ground"] == canvas and not toned and grey_of(canvas) < 128:
        # A palette's dark canvas under the colours a light page is drawn in: the deck's tone derives them for the ground.
        field = 'deck.palette.colors["color.canvas"]'
        repair = (" The page's ground is `{}`, {}, a dark canvas under colours drawn for a light page: take `color.canvas` out of "
                  "`deck.palette.colors` and set `deck.tone` to \"dark\" (or the page's `tone` to \"dark\" for this page alone), which "
                  "derives every colour for that ground from the palette.").format(field, canvas)
    else:
        token, nearest = worst.get("token"), _reading(worst["color"], worst["ground"], bar)
        field = 'deck.palette.colors["{}"]'.format(token) if token else None
        fix = "{} ({}:1 on {})".format(nearest[0], nearest[1], worst["ground"]) if nearest else "a colour further from {}".format(worst["ground"])
        repair = (" {} drawn in {}: set {} to {}, the nearest colour that reads there - every page drawing that token takes it - or set "
                  "the page on a ground with `tone` (\"dark\" or \"primary\", on the deck or the page), which derives every colour for "
                  "it.").format("The type is" if worst["kind"] == "text" else "The marks are", "`{}`".format(token) if token else worst["color"],
                                "`{}`".format(field) if field else "its colour", fix)
    findings.append(finding(slide_no, "GROUND_CONTRAST", {**worst, "count": len(lost), **({"field": field} if field else {})}, bar, said + repair))


# A figure that draws a baseline or an axis has said it is a plot, and a plot's
# marks are read as sizes. `steps`, `funnel`, `process` and the rest draw equal
# blocks on purpose - they say order, not magnitude - which is right until the
# author prints quantities on them.
FIGURE_GROUND = re.compile(r"^([a-z]+)-(baseline|axis|rail)$")
# A quantity is a number and what it counts or measures: the symbol or the word
# written after it ("126 minutes", "40%", "12 stores"). Numbers read in one
# unit are compared; the unit is read as written, a plural's "s" aside.
QUANTITY = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(%|[^\W\d_]+)")


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
                unit = match.group(2).lower()
                values.setdefault(unit[:-1] if len(unit) > 2 and unit.endswith("s") else unit, []).append(float(match.group(1).replace(",", "")))
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


def gate_area_baseline(slide_no, slide, findings):
    """AREA_BASELINE. A filled area whose baseline is not zero.

    An area encodes each value as the area between it and the baseline, so a
    fill drawn down to a floor near the series' low makes a doubling look like
    a five-fold rise: the BA retest's jet fuel line was filled to about USD 1.45
    a gallon and its low-cost share to about 29%. The chart renderers fill from
    zero or not at all (chart-line.mjs, charts-extra.mjs); this reads the scene
    they drew, so a fill from any other floor - a new renderer's, a hand-drawn
    one - is refused wherever it comes from.
    """
    for node in slide.get("nodes", []):
        if str(node.get("role") or "") != "chart-area":
            continue
        data = node.get("data") or {}
        base = data.get("baselineValue")
        if not isinstance(base, (int, float)) or isinstance(base, bool) or base == 0:
            continue
        findings.append(finding(
            slide_no, "AREA_BASELINE",
            {"node": node.get("id"), "series": data.get("series"), "baselineValue": base},
            "an area filled from zero",
            f"The area under {data.get('series') or 'a series'} is filled down to {base:g}, not to zero, so its "
            "filled height overstates every change. Start the value scale at zero (drop a yMin above zero), or "
            "draw the series as a line, which reads its change off its own scale.",
        ))


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
        # The composer measures what of the heading fits its line (registry-chart-title.mjs): the cut to make, exactly.
        fits = measure.get("fits") if isinstance(measure.get("fits"), dict) else None
        room = (f": its first {fits['words']} word{'' if fits['words'] == 1 else 's'} ({fits['characters']} characters) fit, "
                f"so a heading of {fits['characters']} characters or fewer, in words like these, sets on one line" if fits
                else f", about {int(len(text) * available / width)} characters" if width and available else "")
        fit = (f" is {width}px on one line; this frame gives its heading {available}px{room}" if width and available else " wraps")
        if measure.get("reason") == "unit":
            repair = (f"\"{text}\"{fit}. The unit is a phrase, so it cannot sit beside the heading: make it a unit "
                      "(\"$k\", \"% y/y\") and move the basis (\"published base-salary band\") into the note under the page.")
        else:
            repair = (f"\"{text}\"{fit}. Shorten the heading to the measure, the population and the period; "
                      "a qualification belongs in the note. The unit is not the cause - it moves under the heading when it does not fit beside it.")
        findings.append(finding(slide_no, "HEADING_WRAPS", text[:90], "one line", repair))


