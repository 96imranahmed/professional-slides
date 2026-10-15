"""What every page gate shares: the role and component vocabularies, the
thresholds, the gate code vocabulary and the scene readers the gates use.
"""

from __future__ import annotations

import re

from ink import CANVAS_H, CANVAS_W

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


# Table text is a lookup value, so it may be set one step below body type when
# the table is dense; prose may not.
TABLE_TEXT_ROLES = {"table-cell-text", "table-cell", "table-header-text"}


# The pages the build writes: the picture credits and the source limits, and their continuation pages.
GENERATED_PAGE = re.compile(r"^(?:picture-credits|source-limits)(?:-\d+)?$")
# Navigation, not evidence: the cover, dividers, agendas and trackers, and the closing takeaways and statement pages.
STRUCTURAL_COMPONENTS = {"cover", "section-divider", "agenda", "tracker-page", "takeaways", "statement"}
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

# The density profiles a page is set at (`density` on the scene). An appendix page is set smaller on purpose.
PROFILES = {"live-pitch", "executive", "pre-read", "appendix"}
DEFAULT_PROFILE = "executive"

THRESHOLDS = {
    "title_lines_max": 2,
    # A title set down a side panel (registry-chrome.mjs SIDE_TITLE) wraps in a
    # column a quarter of the page wide: the same fifteen words take five or six
    # lines there.
    "side_title_lines_max": 7,
    # The share of the page's body an empty band may run to before it is advised (SCENE_VOID) - a gap between two
    # blocks, a trailing band under the content, a band of one column - and before the render's band is drift.
    "internal_void_max": 0.13,
    "dead_band_max": 0.08,
    "column_void_max": 0.2,
}


# --- helpers ---------------------------------------------------------------


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


def is_cover(slide, index):
    """Structural pages (cover, section divider, agenda/tracker) are exempt from
    the ink and void gates: they are navigation, not evidence."""
    components = {str(c.get("component")) for c in slide.get("componentInstances", [])}
    return bool(components & STRUCTURAL_COMPONENTS) or (index == 0 and "slide-chrome" not in components)


# --- the gate vocabulary ---------------------------------------------------
#
# Every code a gate can emit, with the one line that says what it is about. A
# test holds the codes the gates' source emits to it.
GATE_CODES = {
    "TITLE_LINES": "an action title over its band's lines",
    "HEADING_WRAPS": "an exhibit heading that wraps where it should set on one line",
    "TYPE_RANGE": "type set outside the approved range for its role",
    "GROUND_CONTRAST": "type, or every mark of an exhibit, the scene sets where it cannot be read on its ground",
    "RENDER_CONTRAST": "type the scene sets legibly that the render shows lost on its ground",
    "UNSOURCED_PICTURE": "a picture frame drawn empty because its file was never cleared",
    "PICTURE_UNREADABLE": "a screenshot drawn too small for its text to be read",
    "UNSCALED_FIGURE": "a figure drawn to a scale its own printed numbers contradict",
    "AREA_BASELINE": "a filled area whose baseline is not zero, so its fill overstates every change",
    "MISSING_RENDER": "a page the gates could not measure because it did not render",
    "RENDER_DRIFT": "the render shows an empty band the scene does not draw: something the scene holds did not reach the page",
    # Advised, never refused: an empty band is the author's to judge.
    "SCENE_VOID": "a band of the page's body, measured on the scene, that nothing crosses",
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


