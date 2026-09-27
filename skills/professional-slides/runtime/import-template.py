#!/usr/bin/env python3
"""Infer a house profile from a template deck.

    python3 runtime/import-template.py template.pptx [--out house.json] [--base midnight]

Reads the theme (colour scheme, major and minor fonts), the slide size, the
master and layout placeholders (title, body, footer, slide number, logo), and
the content slides (shape counts, words, type sizes, chart and table use) and
writes a `professional-slides.house/v1` profile the deck spec applies with
`"template": "house.json"`:

    palette      a `{ base, colors }` overlay: ink, primary, accent, tints,
                 chart series, muted surface, house style tokens
    typography   display and body faces (installed faces only; the theme's
                 face is reported when it is not)
    chrome       left / right margins, title top, body top, footer top in px
                 on the 1280 x 720 page
    pageTemplate footer rules and company name when the template carries them
    density      executive | pre-read | live-pitch, from words per slide
    observations what was read and what was guessed, for the author
    stats        the measurements behind the guesses

Colours come from the theme first; when the theme is stock Office (the
4472C4 blues) the most used solid fills on the content slides take over.
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import statistics
import subprocess
import sys
from pathlib import Path

try:
    from pptx import Presentation
    from pptx.util import Emu
except ImportError:  # pragma: no cover
    sys.exit("python-pptx is required: pip install python-pptx")

from lxml import etree

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
PAGE_W, PAGE_H = 1280, 720
OFFICE_STOCK = {"4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "44546A", "E7E6E6"}
STYLE_KEYS = ["style.titleWeight", "style.titleRule", "style.titleRuleLength", "style.tagPlacement", "style.chartHeading", "style.listMarker", "style.tableRows", "style.labelWeight", "style.titleLead"]


def hex6(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip().lstrip("#").upper()
    return value if re.fullmatch(r"[0-9A-F]{6}", value) else None


def luminance(hex_color: str) -> float:
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def saturation(hex_color: str) -> float:
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hi, lo = max(r, g, b), min(r, g, b)
    return 0 if hi == 0 else (hi - lo) / hi


def mix(hex_color: str, with_white: float) -> str:
    """Tint toward white: with_white = 0.85 keeps 15% of the colour."""
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    t = lambda c: round(c + (255 - c) * with_white)
    return f"#{t(r):02X}{t(g):02X}{t(b):02X}"


def theme_part(prs):
    """The first slide master's theme part XML root."""
    master = prs.slide_masters[0]
    for rel in master.part.rels.values():
        if rel.reltype.endswith("/theme"):
            return etree.fromstring(rel.target_part.blob)
    return None


def read_theme(root):
    colors, fonts = {}, {}
    if root is None:
        return colors, fonts
    scheme = root.find(".//a:clrScheme", NS)
    if scheme is not None:
        for child in scheme:
            tag = etree.QName(child).localname
            srgb = child.find("a:srgbClr", NS)
            sys_clr = child.find("a:sysClr", NS)
            value = srgb.get("val") if srgb is not None else (sys_clr.get("lastClr") if sys_clr is not None else None)
            if hex6(value):
                colors[tag] = hex6(value)
    font_scheme = root.find(".//a:fontScheme", NS)
    if font_scheme is not None:
        for which in ("majorFont", "minorFont"):
            latin = font_scheme.find(f"a:{which}/a:latin", NS)
            if latin is not None and latin.get("typeface"):
                fonts[which] = latin.get("typeface")
    return colors, fonts


def installed_fonts() -> set[str]:
    try:
        out = subprocess.run(["fc-list", ":", "family"], capture_output=True, text=True, timeout=20).stdout
    except Exception:
        return set()
    families = set()
    for line in out.splitlines():
        for fam in line.split(","):
            families.add(fam.strip().lower())
    return families


def px(emu: int, scale: float) -> float:
    return round(emu / 914400 * 96 * scale, 1)


def placeholder_kind(shape) -> str | None:
    try:
        if shape.is_placeholder:
            return str(shape.placeholder_format.type).split(".")[-1].split(" ")[0].lower()
    except Exception:
        return None
    return None


def text_of(shape) -> str:
    try:
        return shape.text_frame.text if shape.has_text_frame else ""
    except Exception:
        return ""


def run_sizes(shape) -> list[float]:
    sizes = []
    try:
        if not shape.has_text_frame:
            return sizes
        for paragraph in shape.text_frame.paragraphs:
            for run in paragraph.runs:
                if run.font.size is not None:
                    sizes.append(run.font.size.pt)
    except Exception:
        pass
    return sizes


def run_bold(shape) -> bool | None:
    try:
        for paragraph in shape.text_frame.paragraphs:
            for run in paragraph.runs:
                if run.font.bold is not None:
                    return bool(run.font.bold)
    except Exception:
        pass
    return None


def solid_fill_hex(shape) -> str | None:
    try:
        fill = shape.fill
        if fill.type == 1:  # MSO_FILL.SOLID
            color = fill.fore_color
            if color.type is not None and str(color.type).endswith("RGB (1)") or getattr(color, "rgb", None) is not None:
                return hex6(str(color.rgb))
    except Exception:
        pass
    # Fall back to the XML: a:solidFill/a:srgbClr on the shape properties.
    try:
        el = shape._element
        srgb = el.find(".//p:spPr/a:solidFill/a:srgbClr", NS)
        if srgb is not None:
            return hex6(srgb.get("val"))
    except Exception:
        pass
    return None


def walk(shapes):
    """Every shape on the slide, group members included: a house that draws its
    labels inside groups still carries those words on the page."""
    for shape in shapes:
        yield shape
        if getattr(shape, "shape_type", None) is not None and "GROUP" in str(shape.shape_type):
            try:
                yield from walk(shape.shapes)
            except Exception:
                continue


# A 32 x 18 grid over the 1280 x 720 page; the body starts below the title band.
GRID = 40
GRID_COLUMNS, GRID_ROWS = 32, 18
BODY_ROW = 4


def analyse(path: Path, base: str) -> dict:
    prs = Presentation(str(path))
    scale_x = PAGE_W / (prs.slide_width / 914400 * 96)
    scale_y = PAGE_H / (prs.slide_height / 914400 * 96)
    observations: list[str] = []
    theme_colors, theme_fonts = read_theme(theme_part(prs))

    # --- master and layouts: placeholders, footer, logo ------------------
    master = prs.slide_masters[0]
    title_frames, body_frames, footer_frames, number_frames, logo_frames, master_lines, master_bands = [], [], [], [], [], [], []
    company = None
    title_style_bold = None
    master_shapes = list(master.shapes) + [s for layout in master.slide_layouts for s in layout.shapes]
    for shape in master_shapes:
        kind = placeholder_kind(shape)
        frame = (px(shape.left or 0, scale_x), px(shape.top or 0, scale_y), px(shape.width or 0, scale_x), px(shape.height or 0, scale_y))
        if kind in ("title", "center_title", "ctrtitle"):
            title_frames.append(frame)
            if title_style_bold is None:
                title_style_bold = run_bold(shape)
        elif kind in ("body", "obj", "object", "subtitle"):
            body_frames.append(frame)
        elif kind in ("footer", "ftr"):
            footer_frames.append(frame)
            if not company and text_of(shape).strip():
                company = text_of(shape).strip()
        elif kind in ("slide_number", "sldnum"):
            number_frames.append(frame)
        elif shape.shape_type is not None and "PICTURE" in str(shape.shape_type):
            logo_frames.append(frame)
        elif shape.shape_type is not None and ("LINE" in str(shape.shape_type) or "CONNECTOR" in str(shape.shape_type)):
            master_lines.append(frame)
        elif shape.shape_type is not None and "AUTO_SHAPE" in str(shape.shape_type) and solid_fill_hex(shape):
            master_bands.append((frame, solid_fill_hex(shape)))
    # The master's title style (lstStyle) may set bold or size without runs.
    try:
        tstyle = master._element.find(".//p:titleStyle/a:lvl1pPr/a:defRPr", NS)
        if tstyle is not None and title_style_bold is None and tstyle.get("b") is not None:
            title_style_bold = tstyle.get("b") == "1"
    except Exception:
        pass

    # --- content slides ----------------------------------------------------
    slides = list(prs.slides)
    words, shapes_per_slide, charts, tables, pictures = [], [], 0, 0, 0
    # How much of each page's body the house actually covers: the union of the
    # shape boxes below the title band, on a coarse grid. A house whose pages are
    # two thirds covered expects a deck that fills its columns.
    coverage = []
    title_sizes, body_sizes, fills = [], [], collections.Counter()
    slide_titles = []
    slide_title_frames, slide_body_frames = [], []
    footer_texts = collections.Counter()
    for slide in slides:
        count = 0
        slide_words = 0
        covered = set()
        for shape in walk(slide.shapes):
            count += 1
            kind = placeholder_kind(shape)
            # Footer copy repeated on most pages (a document title, a company
            # name) sits in the bottom tenth of the page.
            if shape.top is not None and px(shape.top, scale_y) > PAGE_H * 0.9:
                ft = text_of(shape).strip()
                if ft and not re.fullmatch(r"[\d\s|/–-]+", ft) and len(ft) < 80:
                    footer_texts[ft] += 1
            if kind in ("title", "center_title", "ctrtitle") and shape.width and shape.top is not None and px(shape.top, scale_y) < PAGE_H * 0.35:
                slide_title_frames.append((px(shape.left or 0, scale_x), px(shape.top, scale_y), px(shape.width, scale_x), px(shape.height or 0, scale_y)))
            elif kind in ("body", "obj", "object") and shape.width and shape.top is not None:
                slide_body_frames.append((px(shape.left or 0, scale_x), px(shape.top, scale_y), px(shape.width, scale_x), px(shape.height or 0, scale_y)))
            if getattr(shape, "has_chart", False) and shape.has_chart:
                charts += 1
            if getattr(shape, "has_table", False) and shape.has_table:
                tables += 1
            if shape.shape_type is not None and "PICTURE" in str(shape.shape_type):
                pictures += 1
            text = text_of(shape)
            if text.strip():
                slide_words += len(text.split())
            if kind in ("title", "center_title", "ctrtitle"):
                title_sizes.extend(run_sizes(shape))
                if text.strip():
                    slide_titles.append(text.strip())
            elif text.strip():
                body_sizes.extend(run_sizes(shape))
            text_for_coverage = text_of(shape)
            text = text_for_coverage
            grouping = shape.shape_type is not None and "GROUP" in str(shape.shape_type)
            carries = bool(text.strip()) or getattr(shape, "has_chart", False) or getattr(shape, "has_table", False) or (shape.shape_type is not None and "PICTURE" in str(shape.shape_type)) or solid_fill_hex(shape)
            if shape.width and shape.height and shape.top is not None and carries and not grouping:
                x0, y0 = px(shape.left or 0, scale_x), px(shape.top, scale_y)
                x1, y1 = x0 + px(shape.width, scale_x), y0 + px(shape.height, scale_y)
                if (x1 - x0) * (y1 - y0) > PAGE_W * PAGE_H * 0.55:
                    x1 = x0  # a background or a full-page frame is not coverage
                for gx in range(max(0, int(x0 // GRID)), min(GRID_COLUMNS, int(x1 // GRID) + 1)):
                    for gy in range(max(BODY_ROW, int(y0 // GRID)), min(GRID_ROWS, int(y1 // GRID) + 1)):
                        covered.add((gx, gy))
            fill = solid_fill_hex(shape)
            if fill and fill not in ("FFFFFF", "000000") and luminance(fill) < 0.85:
                fills[fill] += 1
            if getattr(shape, "has_chart", False) and shape.has_chart:
                try:
                    for series in shape.chart.plots[0].series:
                        srgb = series._element.find(".//a:solidFill/a:srgbClr", NS)
                        if srgb is not None and hex6(srgb.get("val")):
                            fills[hex6(srgb.get("val"))] += 2
                except Exception:
                    pass
        shapes_per_slide.append(count)
        words.append(slide_words)
        body_cells = GRID_COLUMNS * (GRID_ROWS - BODY_ROW)
        if body_cells and count:
            coverage.append(len(covered) / float(body_cells))

    # --- colours -----------------------------------------------------------
    dk1, dk2 = theme_colors.get("dk1", "000000"), theme_colors.get("dk2")
    accents = [theme_colors.get(f"accent{i}") for i in range(1, 7)]
    accents = [a for a in accents if a]
    stock = all(a in OFFICE_STOCK for a in accents) if accents else True
    top_fills = [c for c, _ in fills.most_common(8)]
    brand = [c for c in top_fills if saturation(c) > 0.25 or luminance(c) < 0.15]
    if stock and brand:
        observations.append(f"Theme accents are stock Office; brand colours taken from the most used fills: {', '.join('#' + c for c in brand[:4])}")
        accents = brand[:6] or accents
    # Ink: the theme's dk2 when it is a saturated brand dark (navy, forest
    # green), else dk1 (black or the house grey). Primary: accent1 when it is a
    # brand dark, else the darkest saturated fill in use, else the ink.
    # Accent: the most used saturated fill that is not the primary (the bright
    # green, the electric blue), else accent2.
    sat_dark = lambda c: luminance(c) < 0.25 and saturation(c) > 0.3
    ink = dk2 if dk2 and sat_dark(dk2) and luminance(dk2) < 0.12 else dk1
    dark_fills = [c for c in top_fills if sat_dark(c)]
    saturated_accents = [a for a in accents if saturation(a) > 0.3]
    if accents and sat_dark(accents[0]):
        primary = accents[0]
    elif dark_fills:
        primary = dark_fills[0]
        observations.append(f"Primary taken from the most used dark fill #{primary}")
    elif saturated_accents:
        primary = saturated_accents[0]
    else:
        primary = ink if ink != "000000" else "051C2C"
    bright_fills = [c for c in top_fills if saturation(c) > 0.3 and 0.05 < luminance(c) < 0.6 and c != primary]
    accent = bright_fills[0] if bright_fills else next((a for a in saturated_accents if a != primary), primary)
    if bright_fills and accents and accent not in accents:
        observations.append(f"Accent taken from the most used bright fill #{accent}")
    series = []
    for c in [primary, *accents]:
        if c not in series and luminance(c) < 0.9:
            series.append(c)
    series = (series + ["7A7A7A", "C9C9C9", "9FB3C8", "5B7C99", "D9D9D9"])[:6]
    lt2 = theme_colors.get("lt2")
    muted = lt2 if lt2 and luminance(lt2) > 0.85 else "F2F2F2"
    if contrast(ink, "FFFFFF") < 4.5:
        observations.append(f"Ink #{ink} is too light for text on white; falling back to #051C2C")
        ink = "051C2C"
    colors = {
        "color.ink": f"#{ink}",
        "color.componentPrimary": f"#{primary}",
        "color.componentPrimaryTint": mix(primary, 0.88),
        "color.accent": f"#{accent}",
        "color.accentTint": mix(accent, 0.86),
        "color.surfaceMuted": f"#{muted}",
        **{f"color.chartSeries{i + 1}": f"#{c}" for i, c in enumerate(series)},
    }

    # --- fonts ---------------------------------------------------------------
    installed = installed_fonts()
    major, minor = theme_fonts.get("majorFont"), theme_fonts.get("minorFont")
    def usable(face):
        # Arial is the runtime's default and always has metrics (Liberation Sans stands in).
        return bool(face) and not face.startswith("+") and (face.lower() == "arial" or face.lower() in installed)
    typography = {}
    body = minor if usable(minor) else "Arial"
    display = major if usable(major) else body
    if minor and not usable(minor):
        observations.append(f"Body face '{minor}' is not installed; Arial used (install it or set typography.body)")
    if major and not usable(major):
        observations.append(f"Display face '{major}' is not installed; {display} used")
    typography = {"body": body, "display": display, "semibold": {"family": body, "nativeBold": True, "effectiveWeight": 700}}

    # --- chrome ----------------------------------------------------------------
    chrome = {}
    # The slides' own title placeholders say where titles really sit; the
    # master's are the fallback (cover and section layouts are excluded by the
    # 35%-of-page-height cut above).
    if slide_title_frames:
        title_frames = slide_title_frames
    if slide_body_frames:
        body_frames = slide_body_frames
    if title_frames:
        tf = statistics.median([f[0] for f in title_frames]), statistics.median([f[1] for f in title_frames]), statistics.median([f[2] for f in title_frames])
        left = round(tf[0]); right = round(PAGE_W - tf[0] - tf[2])
        chrome["left"] = max(24, min(160, left))
        chrome["right"] = max(24, min(160, right))
        chrome["titleTop"] = max(16, min(120, round(tf[1])))
    if body_frames:
        body_top = round(statistics.median([f[1] for f in body_frames]))
        chrome["bodyTop"] = max(chrome.get("titleTop", 44) + 48, min(220, body_top))
    footer_tops = [f[1] for f in footer_frames + number_frames]
    if footer_tops:
        chrome["footerTop"] = max(chrome.get("bodyTop", 140) + 220, min(700, round(min(footer_tops))))
    if not chrome:
        observations.append("No title or body placeholders on the master; the built-in margins apply")

    # --- house style guesses -------------------------------------------------
    style = {}
    if title_style_bold is not None:
        style["style.titleWeight"] = "bold" if title_style_bold else "regular"
    title_bottom = (title_frames[0][1] + title_frames[0][3]) if title_frames else None
    if title_bottom is not None:
        rules = [l for l in master_lines if abs(l[1] - title_bottom) < 24 and l[2] > PAGE_W * 0.5]
        if rules:
            style["style.titleRule"] = "rule"
            style["style.titleRuleLength"] = "full" if max(l[2] for l in rules) >= PAGE_W * 0.95 else "content"
        elif any(b[0][1] <= 4 and b[0][3] >= title_bottom - 8 and b[0][2] >= PAGE_W * 0.9 for b in master_bands):
            style["style.titleRule"] = "band"
        else:
            # The built-in palettes draw a rule; a master that has none keeps its page open.
            style["style.titleRule"] = "none"
    if display != body:
        observations.append(f"Titles set in {display}, body in {body}")

    # --- density -------------------------------------------------------------
    median_words = statistics.median(words) if words else 0
    median_shapes = statistics.median(shapes_per_slide) if shapes_per_slide else 0
    if median_words >= 90 or median_shapes >= 18:
        density = "pre-read"
    elif median_words >= 35 or median_shapes >= 8:
        density = "executive"
    else:
        density = "live-pitch"
    complexity = "high" if median_shapes >= 18 else "medium" if median_shapes >= 8 else "low"

    # --- weight: how full this house's pages read ----------------------------
    # The template is the house's own answer to "how much does a page carry".
    # Measured here and written into the profile, it becomes the floor every
    # page of a deck built on this template is held to, so one template drives
    # layout, palette, chrome AND density consistently.
    body_coverage = statistics.median(coverage) if coverage else 0.0
    fill = "full" if (median_words >= 90 or body_coverage >= 0.62) else "airy" if (median_words < 35 and body_coverage < 0.38) else "balanced"
    base_weight = {
        "full": {"pageWords": 130, "columnFill": 0.68, "plotSpan": 0.60, "pointWords": 10, "tableFill": 0.55, "elements": 2},
        "balanced": {"pageWords": 95, "columnFill": 0.55, "plotSpan": 0.52, "pointWords": 8, "tableFill": 0.45, "elements": 1},
        "airy": {"pageWords": 0, "columnFill": 0.0, "plotSpan": 0.0, "pointWords": 0, "tableFill": 0.0, "elements": 1},
    }[fill]
    weight = dict(base_weight)
    if median_words:
        # A floor at 70% of the template's own median: the house's pages are the
        # target, and a page well under them is thin *for this house*.
        weight["pageWords"] = int(round(max(40, min(260, median_words * 0.7))))
    if body_coverage:
        weight["columnFill"] = round(max(0.30, min(0.80, body_coverage * 0.85)), 2)
    if median_shapes:
        weight["elements"] = 2 if median_shapes >= 12 else 1
    observations.append(
        f"Weight measured from the template: median {median_words:.0f} words and {median_shapes:.0f} shapes a slide, "
        f"body coverage {body_coverage:.0%} - pages of a deck on this template are held to {weight['pageWords']} words "
        f"and a {weight['columnFill']:.0%} column, at fill '{fill}'"
    )

    # --- nearest design system ------------------------------------------------
    # The house's colours, faces and margins are copied exactly; the design
    # system supplies what a master cannot show - how the takeaway, the
    # commentary, the cover and the chapter pages are built. Pick the one whose
    # frame the template already resembles, and say why.
    serif = bool(re.search(r"georgia|times|garamond|serif|baskerville|caslon|minion|cambria|palatino", str(display), re.I)) and display != body
    chart_share = (charts / len(slides)) if slides else 0
    if style.get("style.titleRule") == "band" and density == "live-pitch":
        design, why = "keynote", "a full-width title band on a template that carries few words a page"
    elif density == "live-pitch":
        design, why = "keynote", f"a presented template: median {median_words:.0f} words a slide"
    elif serif and style.get("style.titleWeight") == "regular":
        design, why = "editorial", f"regular-weight serif titles ({display})"
    elif chart_share >= 0.5 and style.get("style.titleWeight", "bold") == "bold":
        design, why = "journal", f"chart-led pages ({chart_share:.0%} of slides carry a chart) under bold titles"
    else:
        design, why = "consulting", "an analytical house template with sans titles over evidence and commentary"
    observations.append(f"Nearest design system: {design} ({why}); the house colours, faces and margins override it")

    page_template = {}
    if not company and footer_texts:
        text, n = footer_texts.most_common(1)[0]
        if n >= max(2, len(slides) // 2):
            company = text
    if master_lines and any(abs(l[1] - PAGE_H * 0.94) < 24 for l in master_lines):
        page_template["rules"] = "bottom"
    if logo_frames:
        observations.append("The master carries a logo picture; register it as the deck's logo asset to reproduce it")

    profile = {
        "schema": "professional-slides.house/v1",
        "source": str(path.name),
        "palette": {"base": base, "id": re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-") or "template", "label": path.stem, "colors": {**colors, **style}},
        "typography": typography,
        "design": design,
        **({"chrome": chrome} if chrome else {}),
        **({"pageTemplate": page_template} if page_template else {}),
        **({"footer": company} if company else {}),
        "density": density,
        "fill": fill,
        "weight": weight,
        "complexity": complexity,
        "observations": observations,
        "stats": {
            "slides": len(slides), "slideSize": [round(prs.slide_width / 914400, 2), round(prs.slide_height / 914400, 2)],
            "medianWordsPerSlide": median_words, "medianShapesPerSlide": median_shapes,
            "medianBodyCoverage": round(body_coverage, 3),
            "charts": charts, "tables": tables, "pictures": pictures,
            "titleSizesPt": sorted(set(title_sizes))[:6], "bodySizesPt": sorted(set(body_sizes))[:8],
            "themeColors": theme_colors, "themeFonts": theme_fonts, "topFills": [f"#{c}" for c in top_fills],
            "sampleTitles": slide_titles[:5],
        },
    }
    return profile


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("template", help="the .pptx to read")
    parser.add_argument("--out", help="where to write the house profile (default: <template>.house.json)")
    parser.add_argument("--base", default="midnight", help="the built-in palette the overlay starts from")
    args = parser.parse_args()
    path = Path(args.template)
    if not path.exists():
        sys.exit(f"No such template: {path}")
    profile = analyse(path, args.base)
    out = Path(args.out) if args.out else path.with_suffix(".house.json")
    out.write_text(json.dumps(profile, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({"status": "written", "profile": str(out), "palette": profile["palette"]["colors"], "typography": profile["typography"], "chrome": profile.get("chrome"), "density": profile["density"], "fill": profile["fill"], "weight": profile["weight"], "observations": profile["observations"]}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
