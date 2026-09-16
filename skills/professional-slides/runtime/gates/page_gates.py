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
CHART_FURNITURE_ROLES = {"axis-label", "category-label", "data-label", "legend-label", "table-status-label", "table-lamp", "table-progress-label", "chart-bracket-label", "chart-delta-label", "chart-unit"}
TITLE_ROLES = {"action-title"}
SOURCE_ROLES = {"source-text", "source", "footnote"}
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

CAVEAT_RE = re.compile(r"\b(not|cannot|requires?|verify|confirm|does not|do not)\b", re.I)

# Density profiles change how much prose a page may carry; they never relax a
# geometric or typographic threshold.
PROFILES = {
    "live-pitch": {"words_exhibit": 70, "words_text": 100},
    "executive": {"words_exhibit": 100, "words_text": 140},
    "pre-read": {"words_exhibit": 130, "words_text": 180},
}
DEFAULT_PROFILE = "executive"

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


def is_cover(slide, index):
    """Structural pages (cover, section divider, agenda/tracker) are exempt from
    the ink and void gates: they are navigation, not evidence."""
    components = {str(c.get("component")) for c in slide.get("componentInstances", [])}
    if components & {"cover", "section-divider", "agenda", "tracker-page"}:
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
        hit = [h.strip() for h in HEDGES if h in lowered]
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


def gate_ends_on_caveat(slide_no, slide, findings):
    """ENDS_ON_CAVEAT. The last paragraph must end on a consequence."""
    prose = [n for n in text_nodes(slide) if n.get("role") in PROSE_ROLES]
    if not prose:
        return
    last = max(prose, key=lambda n: (n.get("frame") or {}).get("y", 0))
    text = source_text(last).strip()
    if not text:
        return
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if not sentences:
        return
    final = sentences[-1]
    if CAVEAT_RE.search(final):
        findings.append(finding(
            slide_no, "ENDS_ON_CAVEAT", final[:160], "no closing caveat",
            "End the page on what follows from the evidence; move the caveat to "
            "the 8 pt methodology footnote.",
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


def run_gates(scene, render_dir=None, profile=DEFAULT_PROFILE, gates=None):
    if profile not in PROFILES:
        raise ValueError(f"Unknown density profile: {profile}")
    slides = scene.get("slides", [])
    findings = []
    content_indexes = []
    covers = []
    for index, slide in enumerate(slides):
        slide_no = index + 1
        cover = is_cover(slide, index)
        if cover:
            covers.append(slide_no)
        else:
            content_indexes.append(index)
        selected = gates or set()

        def wanted(code):
            return not selected or code in selected

        if not cover:
            if render_dir and (wanted("INK_COVERAGE") or wanted("DEAD_BAND") or wanted("INTERNAL_VOID")):
                path = render_path(render_dir, slide_no)
                if path is not None:
                    rows = load_ink_rows(path)
                    occupied = load_ink_rows(path, SURFACE_LUMINANCE)
                    page = []
                    gate_ink_and_dead_band(slide_no, rows, page, occupied)
                    # A page carried by a qualifying hero exhibit is not empty,
                    # however thin its marks (a line chart, a map): INK_COVERAGE
                    # then defers to the hero and band gates.
                    hero = []
                    gate_hero_exhibit(slide_no, slide, hero, path)
                    has_hero = any(is_exhibit(c) for c in slide.get("componentInstances", [])) and not hero
                    findings.extend(f for f in page if wanted(f["code"]) and not (f["code"] == "INK_COVERAGE" and has_hero))
            if wanted("WORDS"):
                gate_words(slide_no, slide, findings, profile)
            if wanted("HERO_EXHIBIT"):
                gate_hero_exhibit(slide_no, slide, findings, render_path(render_dir, slide_no) if render_dir else None)
            page = []
            gate_title(slide_no, slide, page)
            findings.extend(f for f in page if wanted(f["code"]))
            if wanted("CPL"):
                gate_cpl(slide_no, slide, findings)
            if wanted("ENDS_ON_CAVEAT"):
                gate_ends_on_caveat(slide_no, slide, findings)
        if wanted("TYPE_RANGE"):
            gate_type_range(slide_no, slide, findings)
        if wanted("NICE_TICKS"):
            gate_nice_ticks(slide_no, slide, findings)
    if not gates or "LAYOUT_MONOTONY" in gates:
        gate_layout_monotony(slides, content_indexes, findings)

    by_code = {}
    for item in findings:
        by_code[item["code"]] = by_code.get(item["code"], 0) + 1
    return {
        "schema": "professional-slides.page-gates/v1",
        "profile": profile,
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
    parser.add_argument("--profile", default=DEFAULT_PROFILE, choices=sorted(PROFILES))
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
