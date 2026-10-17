#!/usr/bin/env python3
"""The page gates: what is wrong on a page, read off its composed scene and,
where the question is optical, its rendered PNG.

    page_gates.py scene.json [render_dir/] [--report out.json] [--profile executive|pre-read|live-pitch|appendix]
                  [--only CODE,CODE]

Every check is about one page: its title runs past its lines (TITLE_LINES), an
exhibit heading wraps (HEADING_WRAPS), type is set off the scale (TYPE_RANGE)
or cannot be read on its ground (GROUND_CONTRAST, and RENDER_CONTRAST on the
render), a picture frame ships empty (UNSOURCED_PICTURE), a figure prints a
scale it does not name (UNSCALED_FIGURE), an area chart does not stand on zero
(AREA_BASELINE), a page did not render (MISSING_RENDER) or the render lost what
the scene drew (RENDER_DRIFT). A band of the page left empty is advised, never
refused (SCENE_VOID).

Exit 0 when nothing blocks, 2 when a finding blocks, 1 on a crash. Each
finding is {slide, code, measured, threshold, repair, severity}.

Conventions
-----------
* The canvas is 1280x720, the size the renderer writes. A render of another
  size is resampled to it, so a threshold never moves with the renderer.
* Ink is a pixel with luminance < 235 on the greyscale render.
* The footer band is y > 660: page numbers and sources live there.
* The cover slide (a slide carrying a `cover` component instance, or slide 1
  when no instance says otherwise) is held to the type and contrast gates only.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# The gate modules, re-exported so `import page_gates` reaches every gate, threshold and helper.
import gate_config  # noqa: E402
import render_gates  # noqa: E402
import scene_gates  # noqa: E402
from gate_config import *  # noqa: E402,F401,F403
from render_gates import *  # noqa: E402,F401,F403
from scene_gates import *  # noqa: E402,F401,F403
from gate_config import CANVAS_H, CANVAS_W, DEFAULT_PROFILE, FOOTER_TOP, GATE_CODES, GENERATED_PAGE, PROFILES, THRESHOLDS, finding, is_cover  # noqa: E402
from render_gates import gate_picture_unreadable, gate_title, gate_type_range, gate_unsourced_picture, source_text, void_bands, without_title_rule  # noqa: E402
from scene_gates import (GROUND_CONTRAST, _text_box, contrast, gate_area_baseline, gate_ground_contrast, gate_heading_wraps,  # noqa: E402
                         gate_scene_void, gate_unscaled_figure, scene_text_boxes, scene_void)
from ink import SURFACE_LUMINANCE, grey_contrast, ink_matrix, ink_rows, load_grey, render_path  # noqa: E402
from scene_ink import NATIVE_PLOT_ROLES, canvas_of, color_of, dark_ground, ground_at  # noqa: E402

GATE_MODULES = (gate_config, render_gates, scene_gates)
# The one advisory: an empty band of a page is the author's to judge.
ADVISORY_CODES = {"SCENE_VOID"}


def emitted_codes():
    """The codes the gates can emit, read from their own source: a code a gate emits that GATE_CODES does not hold, or
    one GATE_CODES holds that no gate emits, is drift, and the eval suite fails on either."""
    paths = [Path(m.__file__) for m in GATE_MODULES] + [Path(__file__)]
    source = "".join(path.resolve().read_text(encoding="utf-8") for path in paths)
    return set(re.findall(r'finding\(\s*\n?\s*\w+,\s*"([A-Z_]+)"', source)) | {"MISSING_RENDER"}


def lost_text(slide, grey):
    """The text the scene draws that the render does not show where the scene
    put it: [{node, text, box}]. `grey` is the decoded render (load_grey). A
    text box with no dark pixel in it on the render is text missing from the
    page - a shape not emitted, a font the renderer could not set - or drawn
    somewhere else, as when the renderer lays a native chart out differently
    from the scene. Text on a dark fill, or with other ink across its box,
    cannot be told this way and is not reported."""
    if grey is None:
        return []
    ink = ink_matrix(grey, dark=dark_ground(slide))
    lost = []
    for node, (x, y, w, h) in scene_text_boxes(slide):
        x0, x1 = max(0, int(x) - 1), min(CANVAS_W, int(x + w) + 2)
        y0, y1 = max(0, int(y) - 1), min(FOOTER_TOP, int(y + h) + 2)
        if x1 - x0 < 4 or y1 - y0 < 4:
            continue
        if not ink[y0:y1, x0:x1].any():
            lost.append({"node": node.get("id"), "text": " ".join(str(source_text(node)).split())[:60], "box": [x0, y0, x1 - x0, y1 - y0]})
    return lost


# The render read the way the scene is (scene_gates.ground_contrast): each run
# of type the scene sets legibly on its ground, measured in the box the scene
# put it in - the box's commonest grey for the ground, its most distant pixel for
# the type, each read as the grey it is (ink.grey_contrast). On 3,406 runs of type
# across every worked page the measure kept within a few tenths of the scene's
# own ratio, and the least legible read 2.48:1. Type the render shows under
# RENDER_CONTRAST_MIN did not reach the page legibly whatever the scene drew: the
# file's background is not the scene's ground, or its type kept a light page's
# colour. A native chart's own labels are laid out by the renderer, and are read
# back from the file instead (readback_pptx.py CHART_TEXT_COLOR).
RENDER_CONTRAST_MIN = 1.5


def render_contrast(slide, grey):
    """The type the scene sets legibly that the render shows under
    RENDER_CONTRAST_MIN on its ground: [{node, role, text, ratio, scene}],
    the least legible first."""
    if grey is None:
        return []
    import numpy as np

    natives = {c.get("instanceId") for c in slide.get("componentInstances") or [] if c.get("nativeChart")}
    nodes = [n for n in slide.get("nodes", []) if n.get("frame")]
    canvas, lost = canvas_of(slide), []
    for index, node in enumerate(nodes):
        if node.get("type") != "text" or not source_text(node).strip():
            continue
        if node.get("role") in NATIVE_PLOT_ROLES and (node.get("data") or {}).get("componentInstance") in natives:
            continue
        color = color_of((node.get("style") or {}).get("color"))
        x, y, w, h = _text_box(node)
        ground = ground_at(nodes, index, x + w / 2, y + h / 2, canvas)
        if not color or not ground or contrast(color, ground) < GROUND_CONTRAST["text"]:
            continue  # unreadable in the scene already: GROUND_CONTRAST's to report
        x0, x1 = max(0, int(x) - 1), min(CANVAS_W, int(x + w) + 2)
        y0, y1 = max(0, int(y) - 1), min(CANVAS_H, int(y + h) + 2)
        if x1 - x0 < 4 or y1 - y0 < 4:
            continue
        box = grey[y0:y1, x0:x1].astype(int)
        levels, counts = np.unique(box, return_counts=True)
        background = int(levels[counts.argmax()])
        ratio = grey_contrast(background, int(box.flat[np.abs(box - background).argmax()]))
        if ratio < RENDER_CONTRAST_MIN:
            lost.append({"node": node.get("id"), "role": node.get("role"), "text": " ".join(source_text(node).split())[:60],
                         "ratio": round(ratio, 2), "scene": round(contrast(color, ground), 2)})
    return sorted(lost, key=lambda item: item["ratio"])


def gate_render_contrast(slide_no, slide, grey, findings):
    """RENDER_CONTRAST. Type the scene sets legibly on its ground that the
    render shows lost on it (render_contrast). One finding a page."""
    lost = render_contrast(slide, grey)
    if not lost:
        return
    worst = lost[0]
    findings.append(finding(
        slide_no, "RENDER_CONTRAST", {**worst, "count": len(lost)}, RENDER_CONTRAST_MIN,
        "The scene sets \"{}\" ({}) at {}:1 on its ground and the render shows it at {}:1{}: the file does not draw "
        "the page the scene does. Read the build's readback for the slide - its background (CANVAS_COLOR) and the "
        "colour of its type (TEXT_COLOR) - and repair the export; no change to the page's content closes it.".format(
            worst["text"], worst["role"], worst["scene"], worst["ratio"],
            ", with {} more runs like it".format(len(lost) - 1) if len(lost) > 1 else ""),
    ))


# How far a band measured on the render may sit from the same band measured on
# the scene before the two disagree: the scene's mask is an estimate of what will
# be drawn and the render a count of ink, so a few rows either way is the
# instruments, not the page.
VOID_AGREEMENT = 0.04
VOID_KINDS = {"internal": ("internalVoid", "internal_void_max"), "dead": ("deadBand", "dead_band_max")}


def gate_render_drift(slide_no, slide, grey, findings):
    """RENDER_DRIFT. The render shows an empty band the scene does not draw, and
    text the scene holds has no ink where the scene put it (lost_text): what
    the scene drew did not reach the page. The repair is the export's."""
    rows = ink_rows(grey, dark=dark_ground(slide))
    if rows is None:
        return
    surface = ink_matrix(grey, SURFACE_LUMINANCE, dark_ground(slide))
    render_bands = void_bands((surface.sum(axis=1).tolist() or without_title_rule(rows, slide))[:FOOTER_TOP])
    scene_bands = scene_void(slide)[0]
    missing = lost_text(slide, grey)
    if not missing:
        return
    drifted = {}
    for kind, (key, bar) in VOID_KINDS.items():
        scene, render = scene_bands[key], render_bands[key]
        # Past the bar on both, the band is the page's own composition; drift is a band only the render shows.
        if render > THRESHOLDS[bar] and scene <= THRESHOLDS[bar] and render - scene > VOID_AGREEMENT:
            drifted[kind] = {"scene": round(scene, 4), "render": round(render, 4)}
    if not drifted:
        return
    findings.append(finding(
        slide_no, "RENDER_DRIFT", {"bands": drifted, "lost": missing}, VOID_AGREEMENT,
        "The render shows an empty band the scene does not draw, and %d run%s of text the scene holds %s "
        "no ink in the render where the scene put %s (%s): missing, or drawn elsewhere - a shape not emitted, "
        "a font the renderer could not set, a native chart laid out differently. Compare the page's render "
        "with its scene. The repair is the export's; adding or stretching content on the page will not "
        "close it." % (len(missing), "" if len(missing) == 1 else "s", "has" if len(missing) == 1 else "have",
                       "it" if len(missing) == 1 else "them", "; ".join('"%s"' % item["text"] for item in missing[:3]))))


def run_gates(scene, render_dir=None, profile=None, gates=None):
    """The gate report for `scene`, its pixel gates read off `render_dir`. `gates` limits the report to those codes."""
    if profile is not None and profile not in PROFILES:
        raise ValueError(f"Unknown density profile: {profile}")
    wanted = (lambda code: code in gates) if gates else (lambda code: True)
    slides = scene.get("slides", [])
    found = []
    for index, slide in enumerate(slides):
        slide_no = index + 1
        page_profile = profile or slide.get("density") or DEFAULT_PROFILE
        if page_profile not in PROFILES:
            raise ValueError(f"Unknown density profile: {page_profile}")
        path = render_path(render_dir, slide_no) if render_dir else None
        if render_dir and path is None:
            found.append(finding(slide_no, "MISSING_RENDER", "absent", "one PNG per slide", "Render every slide before running page gates."))
        # The picture-credits page is written by the runtime, a list of attributions: no gate has anything to say to it.
        if GENERATED_PAGE.match(str(slide.get("id") or "")):
            continue
        grey = load_grey(path) if path is not None else None
        if not is_cover(slide, index):
            gate_title(slide_no, slide, found)
            gate_heading_wraps(slide_no, slide, found)
            gate_unsourced_picture(slide_no, slide, found)
            gate_picture_unreadable(slide_no, slide, found)
            gate_unscaled_figure(slide_no, slide, found)
            gate_area_baseline(slide_no, slide, found)
            gate_scene_void(slide_no, slide, found)
            if grey is not None:
                gate_render_contrast(slide_no, slide, grey, found)
                gate_render_drift(slide_no, slide, grey, found)
        # Type off the scale and type lost on its ground, on every page: a cover or a divider set on a ground is read too.
        gate_ground_contrast(slide_no, slide, found)
        gate_type_range(slide_no, slide, found, page_profile)
    findings = [{**f, "severity": "advisory" if f["code"] in ADVISORY_CODES else "blocker"} for f in found if wanted(f["code"])]
    counts = {}
    for f in findings:
        counts[f["code"]] = counts.get(f["code"], 0) + 1
    return {
        "schema": "professional-slides.page-gates/v2",
        "profile": profile,
        "slides": len(slides),
        "accepted": not any(f["severity"] == "blocker" for f in findings),
        "countsByCode": dict(sorted(counts.items())),
        "findings": findings,
    }


def load_scene(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(data, report):
    text = json.dumps(data, indent=2)
    if report:
        Path(report).write_text(text + "\n", encoding="utf-8")
    else:
        sys.stdout.write(text + "\n")


def main(argv=None):
    parser = argparse.ArgumentParser(description="The page gates")
    parser.add_argument("scene")
    parser.add_argument("render_dir", nargs="?", default=None, help="Directory of slide-N.png renders; the pixel gates are skipped without it")
    parser.add_argument("--report", default=None)
    parser.add_argument("--profile", default=None, choices=sorted(PROFILES))
    parser.add_argument("--only", default=None, help="Comma-separated gate codes to report")
    args = parser.parse_args(argv)
    gates = {c.strip() for c in args.only.split(",")} if args.only else None
    unknown = sorted((gates or set()) - set(GATE_CODES))
    if unknown:
        parser.error(f"not a gate code: {', '.join(unknown)}")
    report = run_gates(load_scene(args.scene), args.render_dir, args.profile, gates)
    write_json(report, args.report)
    counts = ", ".join(f"{k}={v}" for k, v in report["countsByCode"].items()) or "none"
    print(f"page gates: {'accepted' if report['accepted'] else 'REJECTED'} | {counts}", file=sys.stderr)
    return 0 if report["accepted"] else 2


if __name__ == "__main__":
    sys.exit(main())
