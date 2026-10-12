#!/usr/bin/env python3
"""Deterministic page gates.

These gates measure the page - the resolved scene geometry and, where the
question is optical, the rendered PNG - and block before any model is
consulted: ink, dead band, type range, layout diversity, cpl, title lines,
hero-exhibit area and the rest of GATE_CODES.

    page_gates.py scene.json render_dir/ [--report out.json] [--budget-report budget.json]
                  [--profile executive|pre-read|live-pitch]
                  [--workflow existing_deck_revision --rules-version N]
    page_gates.py scene.json [...] --page-cache cache.json   (no render: unchanged pages read from the cache)
    page_gates.py scene.json --budget [--report budget.json]
    page_gates.py --thresholds-markdown

Exit 0 when nothing blocks, 2 when a finding blocks, 1 on a crash. Each
finding is {slide, code, measured, threshold, repair, severity}; a void past
its blocking bar also carries `blockAbove`, and a rule the deck predates
(`--rules-version`, weight.json rules) is reported as an advisory with `waived`.
`--budget-report` writes the author's page budget from the same run.

The gates live in modules by what they read, and this module runs them and
re-exports their names, so `import page_gates` reaches every gate, threshold
and helper:

    gate_config     the weight contract, thresholds, vocabularies, severity
    render_gates    the render's ink and band gates, and the page's own type,
                    title, measure and word gates
    scene_gates     coverage, ink and composition read off the composed scene
    semantic_gates  what the page says
    deck_gates      the deck read as a whole

Conventions
-----------
* The canvas is 1280x720, the size the renderer writes. A render of another
  size is resampled to it, so a threshold never moves with the renderer.
* Ink is a pixel with luminance < 235 on the greyscale render.
* The footer band is y > 660: page numbers and sources live there and must not
  be counted as content ink or as the end of the content column.
* The cover slide (a slide carrying a `cover` component instance, or slide 1
  when no instance says otherwise) is exempt from the gates marked COVER_EXEMPT.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# The gate modules, re-exported so `import page_gates` reaches every gate,
# threshold and helper.
import deck_gates  # noqa: E402
import gate_config  # noqa: E402
import render_gates  # noqa: E402
import scene_gates  # noqa: E402
import semantic_gates  # noqa: E402
import judgements  # noqa: E402
from gate_config import *  # noqa: E402,F401,F403
from render_gates import *  # noqa: E402,F401,F403
from scene_gates import *  # noqa: E402,F401,F403
from semantic_gates import *  # noqa: E402,F401,F403
from deck_gates import *  # noqa: E402,F401,F403
# The driver reads the renders and the scene's ink through these names, so a
# caller can substitute either for a run.
from ink import grey_contrast, ink_matrix, ink_rows, load_grey, load_ink_matrix, load_ink_rows, render_path  # noqa: E402
from scene_ink import NATIVE_PLOT_ROLES, canvas_of, color_of, dark_ground, ground_at, estimate as scene_ink_estimate  # noqa: E402
from scene_gates import GROUND_CONTRAST, _text_box, contrast  # noqa: E402
from density_profile import prose_blocks, scene_blocks, scene_fragmentation  # noqa: E402

GATE_MODULES = (gate_config, render_gates, scene_gates, semantic_gates, deck_gates)


def emitted_codes():
    """The codes the gates can actually emit, read from their own source.

    A gate that emits a code missing from GATE_CODES, or a code documented
    there that no gate emits, is drift; the eval suite fails on either.
    """
    paths = [Path(m.__file__) for m in GATE_MODULES] + [Path(__file__)]
    source = "".join(path.resolve().read_text(encoding="utf-8") for path in paths)
    return set(re.findall(r'finding\(\s*\n?\s*\w+,\s*"([A-Z_]+)"', source)) | {"MISSING_RENDER"} | {code for code, _ in DECK_EMPTY.values()}


# --- driver ----------------------------------------------------------------


class GateRun:
    """One run of the gates: which codes it reports, and what it has found.

    `gates` limits the report to those codes (every code when empty). A gate
    whose findings the deck count reads still runs for the count when its code
    is not reported (`habit`)."""

    def __init__(self, gates=None):
        self.selected = gates or set()
        self.findings = []
        # Every page's empty-page findings, for the deck count (gate_deck_empty_pages)
        # whether or not the run reports them: each gate it counts runs once a page.
        self.empties = []
        self.habit = self.wanted("DECK_THIN_PAGES") or self.wanted("DECK_SCENE_VOID")
        # Slides whose renders could not be measured because Pillow is absent. The
        # report names them rather than quietly returning a pass for gates that
        # never ran.
        self.skipped_pixel_gates = set()
        # SCENE_INK and DECK_INK read the same estimate; it is drawn once a page.
        self.inks = {}
        # Each rendered page's bands as the scene draws them and as the render
        # shows them (void_origins): what says whether an empty band was
        # authored or appeared in the export.
        self.origins = []

    def wanted(self, code):
        return not self.selected or code in self.selected

    def report(self, found):
        """Keep the findings in `found` whose codes this run reports."""
        self.findings.extend(f for f in found if self.wanted(f["code"]))

    def ink_of(self, slide):
        key = id(slide)
        if key not in self.inks:
            self.inks[key] = scene_ink_estimate(slide)
        return self.inks[key]


PAGE_CACHE_SCHEMA = "professional-slides.page-gate-cache/v1"
# The pages a cache file keeps beyond those its latest run read: the
# alternatives a fit search weighed and the page as it stood an edit ago, so
# a writer who undoes an edit, or a search that weighs the same alternative
# again, is not gated afresh - and few enough that reading the file costs a
# fraction of gating one page.
PAGE_CACHE_SPARE = 300


def rules_digest():
    """The gates' own source and every contract they read, hashed: a page is
    read from the cache only under the rules that gated it."""
    here = Path(__file__).resolve().parent
    digest = hashlib.sha256()
    for path in sorted([*here.glob("*.py"), *here.glob("*.json"), *here.parent.glob("*.json"), here.parent / "emit" / "emit_pptx.py"]):
        digest.update(path.name.encode("utf-8") + b"\0" + path.read_bytes())
    return digest.hexdigest()


class PageCache:
    """Each page's own gate results from earlier runs, by what decides them.

    A page's findings, the questions it asked, its empty-page findings for the
    deck count, its estimated ink, its text blocks and its budget depend on
    its scene, its place (a first page may be a cover) and the deck's settings
    and rules, and on nothing else in the deck. A writer's page check changes
    one page of a hundred, and the gates took 3.3s to read all of them again:
    a page whose key is held is read from the file instead. Every deck-level
    gate, standing and count is still read over every page, so the report is
    the one a run without the cache writes. A cached page is read only while
    each judgement it asked has the answer it had (judgements.replay)."""

    def __init__(self, path, context):
        self.path = Path(path)
        self.context = context
        try:
            stored = json.loads(self.path.read_text(encoding="utf-8"))
            entries = stored.get("entries") if isinstance(stored, dict) and stored.get("schema") == PAGE_CACHE_SCHEMA else None
        except (OSError, ValueError):
            entries = None
        self.entries = entries if isinstance(entries, dict) else {}
        # This run's records, by key, and each slide's key by its object.
        self.used, self.keys = {}, {}
        self.fresh = 0

    def key(self, slide_no, slide):
        if id(slide) not in self.keys:
            text = json.dumps(slide, separators=(",", ":"), ensure_ascii=False)
            self.keys[id(slide)] = hashlib.sha256(f"{self.context}|{slide_no}|{text}".encode("utf-8")).hexdigest()[:32]
        return self.keys[id(slide)]

    def replay(self, run, slide_no, slide):
        """Add the page's cached findings to `run`, as gating it would: False where none is held."""
        key = self.key(slide_no, slide)
        record = self.entries.get(key)
        if not isinstance(record, dict) or not judgements.replay(record.get("asked", [])):
            return False
        run.findings.extend(record["findings"])
        run.empties.extend(record["empties"])
        if record.get("ink") is not None:
            run.inks[id(slide)] = record["ink"]
        self.used[key] = record
        return True

    def start(self, run):
        """Mark where the page's own findings begin, and record its questions."""
        judgements.recording(True)
        return len(run.findings), len(run.empties)

    def keep(self, run, slide_no, slide, mark):
        """The page's findings since `mark`, copied as they stand: a later gate never sees the cached ones change."""
        asked = judgements.recording(False)
        self.used[self.key(slide_no, slide)] = json.loads(json.dumps(
            {"findings": run.findings[mark[0]:], "empties": run.empties[mark[1]:], "asked": asked}))
        self.fresh += 1

    def inked(self, run, slides):
        """Each page's estimated ink, once the deck's gates have read it."""
        for slide in slides:
            record = self.used.get(self.keys.get(id(slide)))
            if record is not None and id(slide) in run.inks and record.get("ink") is None:
                record["ink"] = run.inks[id(slide)]
                self.fresh += 1

    def record_of(self, slide):
        return self.used.get(self.keys.get(id(slide)))

    def blocks(self, slide):
        """scene_blocks, read from the page's record where it holds them."""
        record = self.record_of(slide)
        if record is None:
            return scene_blocks(slide)
        if "blocks" not in record:
            record["blocks"] = scene_blocks(slide)
            self.fresh += 1
        return record["blocks"]

    def budget(self, slide, measure):
        """The page's budget line, read from its record where it holds it, else `measure()`."""
        record = self.record_of(slide)
        if record is None:
            return measure()
        if "budget" not in record:
            record["budget"] = json.loads(json.dumps(measure()))
            self.fresh += 1
        return record["budget"]

    def save(self):
        """Write this run's records first, then the rest the file held, to PAGE_CACHE_SPARE more: the file never
        grows past what a run and its neighbours read. Written whole and renamed in, so a reader never sees half."""
        if not self.fresh:
            return
        kept = dict(self.used)
        for key, record in self.entries.items():
            if len(kept) >= len(self.used) + PAGE_CACHE_SPARE:
                break
            kept.setdefault(key, record)
        tmp = self.path.with_name(f"{self.path.name}.{os.getpid()}.tmp")
        try:
            tmp.write_text(json.dumps({"schema": PAGE_CACHE_SCHEMA, "entries": kept}, separators=(",", ":")), encoding="utf-8")
            os.replace(tmp, self.path)
        except OSError:
            # A cache that cannot be written costs the next run its time, never its answer.
            tmp.unlink(missing_ok=True)


def page_cache_context(scene, profile=None, gates=None, deck=None):
    """What every page's results rest on beyond its own scene: the rules, the deck's fill, weight and rules version,
    the density profile and the codes reported."""
    rules = deck if deck is not None else scene
    return hashlib.sha256(json.dumps([rules_digest(), scene.get("fill"), scene.get("weight"), profile, sorted(gates or []),
                                      (rules or {}).get("workflow"), (rules or {}).get("rulesVersion")], default=str).encode("utf-8")).hexdigest()


def run_gates(scene, render_dir=None, profile=None, gates=None, deck=None, cache=None):
    """The gate report for `scene`, its pixel gates read off `render_dir`.
    `deck` ({workflow, rulesVersion}, by default the scene's own) says which
    rules the deck predates (configure_rules). `cache` (PageCache) holds each
    page's own results from earlier runs: a page found there is not gated
    again, and the deck's gates read every page either way. A render is
    measured afresh, so a run with one reads no cache."""
    if render_dir or not judgements.answerable():
        cache = None
    if profile is not None and profile not in PROFILES:
        raise ValueError(f"Unknown density profile: {profile}")
    fill = configure(scene.get("fill"), scene.get("weight"))
    configure_rules(deck if deck is not None else scene)
    STANDINGS.clear()
    slides = scene.get("slides", [])
    run = GateRun(gates)
    content_indexes = []
    covers = []
    for index, slide in enumerate(slides):
        slide_no = index + 1
        if render_dir and render_path(render_dir, slide_no) is None:
            run.findings.append(finding(slide_no, "MISSING_RENDER", "absent", "one PNG per slide", "Render every slide before running page gates."))
        slide_profile = profile or slide.get("density") or DEFAULT_PROFILE
        if slide_profile not in PROFILES:
            raise ValueError(f"Unknown density profile: {slide_profile}")
        # The picture-credits page is written by the runtime, not argued: it
        # is a list of attributions and no page gate has anything to say to it.
        if GENERATED_PAGE.match(str(slide.get("id") or "")):
            continue
        cover = is_cover(slide, index)
        if cover:
            covers.append(slide_no)
        else:
            content_indexes.append(index)
        if cache is not None and cache.replay(run, slide_no, slide):
            continue
        mark = cache.start(run) if cache is not None else None
        if not cover:
            # The render decoded once a content page; every pixel gate reads this array.
            path = render_path(render_dir, slide_no) if render_dir else None
            grey = load_grey(path) if path is not None else None
            empty_page_gates(run, slide_no, slide, render_dir, grey)
            content_page_gates(run, slide_no, index, slide, slide_profile)
            if run.wanted("RENDER_CONTRAST"):
                gate_render_contrast(slide_no, slide, grey, run.findings)
        # Type and marks lost on their ground, on every page: a cover or a divider set on a ground is read on it too.
        if run.wanted("GROUND_CONTRAST"):
            gate_ground_contrast(slide_no, slide, run.findings)
        if run.wanted("PLANNING_VOICE"):
            gate_planning_voice(slide_no, slide, run.findings)
        if run.wanted("TYPE_RANGE"):
            gate_type_range(slide_no, slide, run.findings, slide_profile)
        if run.wanted("NICE_TICKS"):
            gate_nice_ticks(slide_no, slide, run.findings)
        if cache is not None:
            cache.keep(run, slide_no, slide, mark)
    deck_level_gates(run, slides, content_indexes, fill, rendered=bool(render_dir) and not run.skipped_pixel_gates)
    if cache is not None:
        cache.inked(run, slides)

    by_code = {}
    for item in run.findings:
        by_code[item["code"]] = by_code.get(item["code"], 0) + 1
    reported, causes = void_causes([{**f, **severity(f)} for f in run.findings], run.origins)
    return {
        "schema": "professional-slides.page-gates/v1",
        "profile": profile,
        "fill": fill,
        "weight": dict(WEIGHT),
        "density": density_report(slides, content_indexes),
        "slides": len(slides),
        "pixelGatesSkipped": sorted(run.skipped_pixel_gates),
        "coverSlides": covers,
        "contentSlides": len(content_indexes),
        **({"rulesVersion": RULES_OF_DECK.get("rulesVersion"), "waivedRules": sorted(WAIVED)} if WAIVED else {}),
        "accepted": not any(f["severity"] == "blocker" for f in reported),
        "countsByCode": dict(sorted(by_code.items())),
        # Each empty band once, however many instruments reported it, and on a rendered page where it came from.
        "voidCauses": causes,
        "findings": reported,
        # Where the deck stands against every deck-level rule, broken or not (gate_config.standing). The one rule only a
        # render measures on the page's text - the words a block (density_profile.py) - is estimated from the scene
        # until there is a render, and says so.
        "standings": [*STANDINGS, *([] if render_dir else scene_fragmentation(scene, cache.blocks if cache is not None else scene_blocks)["standings"])],
        # Each content page's architecture as PAGE_SHAPE_FLAT reads it, for the author's deck-structure report.
        "architectures": [{"slide": index + 1, "id": slides[index].get("sourceSlideId") or slides[index].get("id"),
                           "architecture": page_architecture(slides[index])} for index in content_indexes],
    }


# How far a band measured on the render may sit from the same band measured
# on the scene before the two disagree. The scene's mask is an estimate of
# what will be drawn (scene_gates.scene_mask) and the render a count of ink, so
# a few rows either way is the instruments, not the page.
VOID_AGREEMENT = 0.04
VOID_KINDS = {"internal": ("internalVoid", "internal_void_max"), "dead": ("deadBand", "dead_band_max")}
VOID_KIND_OF = {"INTERNAL_VOID": "internal", "DEAD_BAND": "dead", "COLUMN_VOID": "column"}


def lost_text(slide, grey):
    """The text the scene draws that the render does not show where the scene
    put it: [{node, text, box}]. `grey` is the decoded render (load_grey). A
    text box with no dark pixel in it on the render is text that is missing
    from the page - a shape not emitted, a font the renderer could not set -
    or drawn somewhere else, as when the renderer lays a native chart out
    differently from the scene. Either way the render is not the scene. Text
    on a dark fill, or with other ink across its box, cannot be told this way
    and is not reported."""
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
# own ratio, and the least legible read 2.48:1 (a numeral the scene sets at
# 3:1). Type the render shows under RENDER_CONTRAST_MIN did not reach the page
# legibly whatever the scene drew: the file's background is not the scene's
# ground, or its type kept a light page's colour. A native chart's own labels are
# laid out by the renderer, not where the scene put them, and are read back from
# the file instead (readback_pptx.py CHART_TEXT_COLOR).
RENDER_CONTRAST_MIN = 1.5


def render_contrast(slide, grey):
    """The type the scene sets legibly that the render shows under
    RENDER_CONTRAST_MIN on its ground: [{node, role, text, ratio, scene}],
    the least legible first. `grey` is the decoded render (load_grey)."""
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


def void_origins(slide_no, scene_bands, render_bands, lost=()):
    """Where each empty band of a rendered page comes from: `{slide, bands}`,
    `bands` one record a kind (internal, dead) whose scene or render measure is
    past its bar - `{scene, render, origin}`. `lost` is the scene's text the
    render does not show (lost_text).

    `authored`: the scene draws the band and the render shows it. The page was
    composed that way, so the repair is the page's - its content or its
    composition - and stretching what is drawn would only move the band.
    `inside-object`: the render shows a band the scene's estimate does not,
    and everything the scene holds reached the page. The air is inside
    something the scene counts as drawn - a chart whose marks sit in a corner
    of its plot, a card deeper than its text - so it is authored too, and the
    repair is that object's size or content.
    `render`: the render shows a band the scene does not, and text the scene
    holds is not where the scene put it in the render (`lost`): missing, or
    laid out differently by the renderer. The repair is the export's.
    `scene-estimate`: the scene's estimate shows a band the render does not.
    The page as rendered is not empty there; the scene finding is the estimate
    reading a drawn surface as blank.
    """
    bands = {}
    for kind, (key, bar) in VOID_KINDS.items():
        scene, render = scene_bands[key], render_bands[key]
        if max(scene, render) <= THRESHOLDS[bar]:
            continue
        origin = ("authored" if abs(render - scene) <= VOID_AGREEMENT or min(scene, render) > THRESHOLDS[bar]
                  else ("render" if lost else "inside-object") if render > scene else "scene-estimate")
        bands[kind] = {"scene": round(scene, 4), "render": round(render, 4), "origin": origin}
    return {"slide": slide_no, "bands": bands, **({"lost": list(lost)} if lost else {})}


def void_causes(findings, origins):
    """The void findings grouped by what they measure: `(findings, causes)`.

    The scene's gate and the render's gates read one band with two instruments
    (gate_scene_void), so a half-empty page is reported two or three times - a
    count that reads as that many defects. Every finding is kept, with the
    `cause` it shares (`<slide>:<kind>`) and, on a rendered page, its `origin`
    (void_origins); `causes` lists each band once, with the codes that report
    it and the worst of their severities.
    """
    by_slide = {o["slide"]: o["bands"] for o in origins}
    marked, causes = [], {}
    for f in findings:
        kind = VOID_KIND_OF.get(f["code"]) or (f["measured"].get("kind") if f["code"] == "SCENE_VOID" and isinstance(f.get("measured"), dict) else None)
        if kind is None:
            marked.append(f)
            continue
        column = f["measured"].get("column") if isinstance(f.get("measured"), dict) else None
        key = "{}:{}".format(f["slide"], "column:{}".format(column) if kind == "column" else kind)
        origin = (by_slide.get(f["slide"], {}).get(kind) or {}).get("origin")
        marked.append({**f, "cause": key, **({"origin": origin} if origin else {})})
        cause = causes.setdefault(key, {"cause": key, "slide": f["slide"], "kind": kind, "codes": [], "severity": "advisory",
                                         **({"column": column} if column else {}), **(by_slide.get(f["slide"], {}).get(kind) or {})})
        cause["codes"].append(f["code"])
        if f.get("severity") == "blocker":
            cause["severity"] = "blocker"
    return marked, sorted(causes.values(), key=lambda c: (c["slide"], c["kind"]))


def empty_page_gates(run, slide_no, slide, render_dir, grey=None):
    """The findings that say a content page is thin or half empty: HERO_EXHIBIT,
    the render's pixel gates when there is a render, THIN_PAGE and SCENE_VOID.
    Each runs once a page; the deck count reads them all (`run.empties`).
    `grey` is the page's render as run_gates decoded it, once."""
    path = render_path(render_dir, slide_no) if render_dir else None
    if grey is None and path is not None:
        grey = load_grey(path)
    # HERO_EXHIBIT once a page: its own finding, the deck count's, and
    # INK_COVERAGE's deference to a hero below.
    empty = []
    gate_hero_exhibit(slide_no, slide, empty, grey if grey is not None else path)
    if path is not None and (run.habit or any(run.wanted(c) for c in ("INK_COVERAGE", "DEAD_BAND", "INTERNAL_VOID", "COLUMN_VOID"))):
        dark = dark_ground(slide)
        rows = ink_rows(grey, dark=dark) if grey is not None else load_ink_rows(path, dark=dark)
        # No Pillow, no pixels: the renders cannot be measured, so the
        # pixel gates report nothing and the scene gates below still run.
        if rows is None:
            run.skipped_pixel_gates.add(slide_no)
        else:
            measured = {}
            empty += pixel_gates(slide_no, slide, path, grey, rows, empty, measured)
            origin = void_origins(slide_no, scene_void(slide)[0], measured["bands"], lost_text(slide, grey))
            run.origins.append(origin)
            drifted = {kind: band for kind, band in origin["bands"].items() if band["origin"] == "render"}
            if drifted and run.wanted("RENDER_DRIFT"):
                missing = origin["lost"]
                run.findings.append(finding(
                    slide_no, "RENDER_DRIFT", {"bands": drifted, "lost": missing}, VOID_AGREEMENT,
                    "The render shows an empty band the scene does not draw, and %d run%s of text the scene holds %s "
                    "no ink in the render where the scene put %s (%s): missing, or drawn elsewhere - a shape not emitted, "
                    "a font the renderer could not set, a native chart laid out differently. Compare the page's render "
                    "with its scene. The repair is the export's; adding or stretching content on the page will not "
                    "close it." % (len(missing), "" if len(missing) == 1 else "s", "has" if len(missing) == 1 else "have",
                                   "it" if len(missing) == 1 else "them",
                                   "; ".join('"%s"' % item["text"] for item in missing[:3]))))
    if run.wanted("THIN_PAGE") or run.habit:
        gate_thin_page(slide_no, slide, empty)
    if run.wanted("SCENE_VOID") or run.habit:
        gate_scene_void(slide_no, slide, empty)
    run.empties += empty
    run.report(empty)


def pixel_gates(slide_no, slide, path, grey, rows, hero, measured=None):
    """INK_COVERAGE, DEAD_BAND, INTERNAL_VOID and COLUMN_VOID off the render.
    `rows` is its ink by row, `grey` the decoded render (None when only `path`
    can be read), `hero` the page's HERO_EXHIBIT findings. `measured`, when
    given, takes the render's `bands` (void_bands) for the scene to be set
    against (void_origins)."""
    # A page with no exhibit is held to the type floor: the ink its own word
    # floor puts on the canvas, not the ink a chart page shows.
    text_page = not any(is_exhibit(c) for c in slide.get("componentInstances", []))
    pixels = []
    dark = dark_ground(slide)
    surface = ink_matrix(grey, SURFACE_LUMINANCE, dark) if grey is not None else None
    occupied = surface.sum(axis=1).tolist() if surface is not None else load_ink_rows(path, SURFACE_LUMINANCE, dark)
    inked = without_title_rule(rows, slide)
    if measured is not None:
        measured["bands"] = void_bands((occupied or inked)[:FOOTER_TOP])
    gate_ink_and_dead_band(slide_no, inked, pixels, occupied, text_page=text_page)
    gate_column_void(slide_no, slide, surface if surface is not None else load_ink_matrix(path, SURFACE_LUMINANCE, dark), pixels)
    # A page carried by a qualifying hero exhibit is not empty, however thin
    # its marks (a line chart, a map): INK_COVERAGE then defers to the hero
    # and band gates.
    has_hero = not text_page and not any(f["code"] == "HERO_EXHIBIT" for f in hero)
    return [f for f in pixels if not (f["code"] == "INK_COVERAGE" and has_hero)]


def content_page_gates(run, slide_no, index, slide, slide_profile):
    """The page gates a content page answers after its empty-page findings, in
    report order."""
    findings, wanted = run.findings, run.wanted
    if wanted("WORDS"):
        gate_words(slide_no, slide, findings, slide_profile)
    page = []
    gate_title(slide_no, slide, page)
    run.report(page)
    if wanted("CPL"):
        gate_cpl(slide_no, slide, findings)
    if wanted("TAKEAWAY_LONG"):
        gate_takeaway_long(slide_no, slide, findings)
    if wanted("MISSING_ARGUMENT"):
        gate_missing_argument(slide_no, slide, findings)
    if wanted("SCENE_INK") and analytical(slide, index):
        gate_scene_ink(slide_no, slide, findings, run.ink_of(slide))
    if wanted("UNSOURCED_PICTURE"):
        gate_unsourced_picture(slide_no, slide, findings)
    if wanted("UNSCALED_FIGURE"):
        gate_unscaled_figure(slide_no, slide, findings)
    if wanted("TITLE_COUNT"):
        gate_title_count(slide_no, slide, findings)
    if wanted("THIN_COLUMN") or wanted("POINT_DEPTH"):
        page = []
        gate_thin_column(slide_no, slide, page)
        run.report(page)
    if wanted("PLOT_SPAN"):
        gate_plot_span(slide_no, slide, findings)
    if wanted("THIN_TABLE"):
        gate_thin_table(slide_no, slide, findings)
    if wanted("NUMBERS_ON_MARKS"):
        gate_numbers_on_marks(slide_no, slide, findings)
    if wanted("UNANNOTATED"):
        gate_unannotated(slide_no, slide, findings)
    if wanted("THIN_EVIDENCE"):
        gate_thin_evidence(slide_no, slide, findings)
    if wanted("HEADING_WRAPS"):
        gate_heading_wraps(slide_no, slide, findings)
    if wanted("METRIC_STACK"):
        gate_metric_stack(slide_no, slide, findings)
    if wanted("RESTATEMENT"):
        gate_restatement(slide_no, slide, findings)
    if wanted("CAVEAT_HEAVY"):
        gate_caveat_heavy(slide_no, slide, findings)
    if wanted("TWIN_CELLS"):
        gate_twin_cells(slide_no, slide, findings)
    if wanted("CONTRADICTED_SHARE"):
        gate_contradicted_share(slide_no, slide, findings)


def deck_level_gates(run, slides, content_indexes, fill, rendered):
    """The deck gates over the content pages, then the half-empty habit (on
    the render when `rendered`, else on the scene) and the deck's ink."""
    findings, wanted = run.findings, run.wanted
    if wanted("LAYOUT_MONOTONY"):
        gate_layout_monotony(slides, content_indexes, findings)
    if wanted("IMAGE_BUDGET") or wanted("IMAGE_RUN"):
        gate_image_budget(slides, content_indexes, findings)
    if wanted("EVIDENCE_MIX") or wanted("PAGE_VARIETY"):
        gate_evidence_mix(slides, content_indexes, findings)
    if wanted("DECK_CRAFT"):
        gate_deck_craft(slides, content_indexes, findings)
    if wanted("DECK_VOCABULARY"):
        gate_deck_vocabulary(slides, content_indexes, findings)
    if wanted("NO_SECTIONS"):
        gate_deck_structure(slides, content_indexes, findings)
    if wanted("NO_CONTENTS") or wanted("NO_SUMMARY"):
        gate_deck_front_matter(slides, content_indexes, findings, fill)
    if wanted("DECK_FLAT"):
        gate_deck_shape(slides, content_indexes, findings, fill)
    if wanted("PAGE_SHAPE_FLAT"):
        gate_page_shape_flat(slides, content_indexes, findings, fill)
    if wanted("COLUMN_MONOTONY"):
        gate_column_monotony(slides, content_indexes, findings)
    if wanted("TABLE_SCHEMA_FLAT"):
        gate_table_schema_flat(slides, content_indexes, findings)
    if run.habit:
        deck = []
        gate_deck_empty_pages(content_indexes, deck, rendered=rendered, counted=run.empties)
        run.report(deck)
    if wanted("DECK_INK"):
        gate_deck_ink(slides, content_indexes, findings, run.ink_of)


def median(values):
    """The median of `values` to three places, None for none."""
    if not values:
        return None
    ordered = sorted(values)
    middle = len(ordered) // 2
    value = ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2
    return round(value, 3)


def density_report(slides, content_indexes):
    """The density numbers beside the findings: the page's body and footer
    words, its commentary column's reach and its bar charts' span, so a
    regression shows up as a number rather than as a screenshot."""
    measured_words, measured_columns, measured_spans, measured_footers = [], [], [], []
    for index in content_indexes:
        slide = slides[index]
        _body, footer_words, _band_words = body_bands(slide)
        measured_words.append(body_words(slide))
        measured_footers.append(footer_words)
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
    return {
        "bodyWords": {"median": median(measured_words), "min": min(measured_words) if measured_words else None,
                      "floor": WEIGHT.get("pageWords"), "referenceMedian": REFERENCE_PAGE_BANDS["body"]},
        "footerWords": {"median": median(measured_footers), "referenceMedian": REFERENCE_PAGE_BANDS["footer"]},
        "columnFill": {"median": median(measured_columns), "floor": WEIGHT.get("columnFill"), "columns": len(measured_columns)},
        "plotSpan": {"median": median(measured_spans), "floor": WEIGHT.get("plotSpan"), "charts": len(measured_spans)},
    }


# A body line where a page sets none: 12pt on the 4px baseline grid.
BODY_LINE = 20


def body_line(slide):
    """The height of one line of the page's body text, read off its prose and
    bullets, so room is counted in the lines the author writes."""
    heights = [float((layout_of(n)).get("lineHeight") or 0) for n in text_nodes(slide)
               if n.get("role") in ("paragraph", "body", "body-text", "list-item", "bullet")]
    heights = [h for h in heights if h > 0]
    return int(max(set(heights), key=heights.count)) if heights else BODY_LINE


def column_room(slide, mask, line):
    """The room left at the foot of each of the page's columns (page_columns),
    measured on the scene: the pixels under the column's last drawn row, and
    how many lines of body text they hold. A hero number with points beside a
    table went from a band left empty under its column, to a column over its
    height, to an empty column the other side, one point at a time; the room
    in each column, in lines, is what lets one edit land."""
    rows_of = scene_column_rows(mask)
    texts = [n["frame"] for n in text_nodes(slide) if n.get("role") in BODY_ROLES and isinstance(n.get("frame"), dict)]
    out = []
    for column in page_columns(slide):
        rows, top, bottom = rows_of(column["x0"], column["x1"]), column["top"], column["bottom"]
        last = next((y for y in range(bottom - 1, top - 1, -1) if rows[y] > ROW_MIN), None)
        if last is None:
            continue
        free = max(0, bottom - 1 - last)
        # Lines are a column's to take only where it sets text: a chart's air
        # is its plot's, not room for a point.
        writes = any(column["x0"] <= f.get("x", 0) + f.get("width", 0) / 2 <= column["x1"]
                     and top <= f.get("y", 0) + f.get("height", 0) / 2 <= bottom for f in texts)
        out.append({"column": column["name"], "free": free, "lines": int(free // line), "text": writes})
    return out


def page_budget(scene, profile=None, cache=None):
    """Each content page's word and space budget, for the author to write to.

    The gates say what a page got wrong after it is composed; the author needs
    the same numbers before, as a budget: the body the page carries against
    the floor its reading task sets and the ceiling WORDS holds it to, the
    footer's share of its text, and how much of its body the composed scene
    fills. Every number is the one the gates read - the unified body count,
    `body_floor`, `words_limit`, `footer_share`, `void_bands` - so the
    budget and the findings cannot disagree. Covers, structural and generated
    pages carry no budget and are left out; `slide` is the page's position in
    the deck.
    """
    if profile is not None and profile not in PROFILES:
        raise ValueError(f"Unknown density profile: {profile}")
    configure(scene.get("fill"), scene.get("weight"))
    out = []
    for index, slide in enumerate(scene.get("slides", [])):
        if GENERATED_PAGE.match(str(slide.get("id") or "")) or is_cover(slide, index):
            continue
        slide_profile = profile or slide.get("density") or DEFAULT_PROFILE
        if slide_profile not in PROFILES:
            raise ValueError(f"Unknown density profile: {slide_profile}")
        # A page an earlier run measured, under the same rules and in the same place, is read from the cache.
        out.append(cache.budget(slide, lambda: page_budget_line(index, slide, slide_profile, cache)) if cache is not None
                   else page_budget_line(index, slide, slide_profile))
    return out


def page_budget_line(index, slide, slide_profile, cache=None):
    """One content page's budget (page_budget), `index` its place in the deck."""
    _band_body, footer, ratio = footer_share(slide)
    mask = scene_mask(slide)
    bands, void = scene_void(slide, mask)
    column = void if void and "column" in void else None
    line = body_line(slide)
    # The page's text blocks as the render will read them, estimated from the scene (density_profile.scene_blocks):
    # what the page adds to the deck's median words a block (TEXT_FRAGMENTED), and whether it carries prose.
    blocks = cache.blocks(slide) if cache is not None else scene_blocks(slide)
    return {
        "slide": index + 1,
        "id": slide.get("id"),
        "readingTask": slide.get("readingTask"),
        "blocks": {"count": len(blocks), "wordsPerBlock": round(sum(blocks) / len(blocks), 1) if blocks else 0, "prose": prose_blocks(blocks)},
        "body": body_words(slide),
        "floor": body_floor(slide),
        "ceiling": words_limit(slide, slide_profile),
        "footer": footer,
        "footerRatio": round(ratio, 3) if ratio is not None else 0.0,
        # SCENE_VOID's own decision (scene_void), so a "!" on the budget
        # line and the advisory are the same finding.
        "internalVoid": round(bands["internalVoid"], 3),
        "deadBand": round(bands["deadBand"], 3),
        "void": void is not None,
        # A column's band the page's rows cannot see (column_bands, which
        # SCENE_VOID also reads): which column, its share of the column's
        # own height, and where it runs.
        "columnVoid": {"column": column["name"], "band": round(column["band"], 3),
                       "from": column["from"], "to": column["to"]} if column else None,
        # The room at the foot of each column, and the height of a body
        # line to count it in (column_room).
        "line": line,
        "columns": column_room(slide, mask, line),
    }


def _share(value):
    """A share as the threshold table prints it: 0.118 -> 11.8%, 0.2 -> 20%."""
    return "{}%".format(("%.1f" % (value * 100)).rstrip("0").rstrip("."))


def thresholds_markdown():
    """The gate thresholds as the evaluation reference prints them, read from
    the values the gates apply (weight.json and THRESHOLDS), so the table in
    references/evaluation/index.md is this output and cannot drift from it.

        page_gates.py --thresholds-markdown
    """
    CRAFT = CONTRACT["plan"]["craft"]
    fills = [fill for fill in ("full", "balanced", "airy") if fill in FILL_LEVELS]
    level = {fill: {**FILL_LEVELS[fill]} for fill in fills}
    weight = {fill: WEIGHT_BY_FILL[fill] for fill in fills}
    text_floor = {fill: min(INK_PER_WORD["value"] * INK_PER_WORD["tolerance"] * weight[fill]["pageWords"], level[fill]["ink_min"]) for fill in fills}
    by_fill = [
        ("INK_COVERAGE", "ink share of the content area, a page with an exhibit, at least", lambda f: _share(level[f]["ink_min"])),
        ("INK_COVERAGE", "the same, a page with no exhibit: the ink its word floor puts on the page", lambda f: _share(round(text_floor[f], 3))),
        ("DEAD_BAND", "trailing empty band under the content, advisory above", lambda f: _share(level[f]["dead_band_max"])),
        ("DEAD_BAND", "blocks above", lambda f: _share(level[f]["dead_band_block"])),
        ("INTERNAL_VOID", "empty band between two content blocks, advisory above", lambda f: _share(level[f]["internal_void_max"])),
        ("INTERNAL_VOID", "blocks above", lambda f: _share(level[f]["internal_void_block"])),
        ("COLUMN_VOID", "a column that stops short of its row, advisory above (a hole inside one: INTERNAL_VOID's bar)", lambda f: _share(level[f]["column_void_max"])),
        ("COLUMN_VOID", "blocks above", lambda f: _share(level[f]["column_void_block"])),
        ("THIN_PAGE", "body words, at least (`weight.pageWords`)", lambda f: str(weight[f]["pageWords"])),
        ("THIN_COLUMN", "share of its track the commentary column reaches (`weight.columnFill`)", lambda f: _share(weight[f]["columnFill"])),
        ("POINT_DEPTH", "mean words per point (`weight.pointWords`)", lambda f: str(weight[f]["pointWords"])),
        ("PLOT_SPAN", "share of the exhibit frame the marks span (`weight.plotSpan`)", lambda f: _share(weight[f]["plotSpan"])),
        ("THIN_TABLE", "share of the page's row budget a table uses (`weight.tableFill`)", lambda f: _share(weight[f]["tableFill"])),
        ("THIN_EVIDENCE", "evidence elements on an analytical page (`weight.elements`)", lambda f: str(weight[f]["elements"])),
    ]
    profiles = [name for name in ("live-pitch", "executive", "pre-read", "appendix") if name in PROFILES]
    fixed = [
        ("TITLE_LINES", "action title lines, at most", str(THRESHOLDS["title_lines_max"])),
        ("TITLE_LINES", "side title lines down its panel, at most", str(THRESHOLDS["side_title_lines_max"])),
        ("TITLE_WORDS", "action title words, at most", str(THRESHOLDS["title_words_max"])),
        ("TYPE_RANGE", "point sizes by role", "; ".join("{} {:g}-{:g}".format(role, low, high) for role, (low, high) in TYPE_RANGES.items())),
        ("CPL", "characters per line of prose", "{}-{}".format(THRESHOLDS["cpl_min"], THRESHOLDS["cpl_max"])),
        ("TAKEAWAY_LONG", "takeaway band lines, at most", str(TAKEAWAY_LINES_MAX)),
        ("HERO_EXHIBIT", "largest exhibit's share of the content area, at least; ink in its frame, at least",
         "{}; {}".format(_share(THRESHOLDS["hero_area_min"]), _share(THRESHOLDS["exhibit_ink_min"]))),
        ("NOTE_HEAVY", "footer's share of the page's text, at most", _share(NOTE_HEAVY_SHARE)),
        ("LAYOUT_MONOTONY", "content pages on one layout signature, at most", _share(THRESHOLDS["monotony_max"])),
        ("EVIDENCE_MIX", "analytical pages carrying a chart, a table or measured tiles, at least (from {} pages)".format(DECK_LENGTH["evidenceMix"]),
         _share(THRESHOLDS["data_pages_min"])),
        ("PAGE_VARIETY", "page families, at least (from {} pages)".format(DECK_LENGTH["pageVariety"]), str(THRESHOLDS["families_min"])),
        ("IMAGE_BUDGET", "analytical pages carrying a photograph, at most", _share(THRESHOLDS["image_pages_max"])),
        ("IMAGE_RUN", "consecutive analytical pages carrying photographs, at most", str(THRESHOLDS["image_run_max"])),
        ("NO_SECTIONS", "analytical pages from which a deck needs sections and a tracker", str(THRESHOLDS["sections_from"])),
        ("NO_CONTENTS", "analytical pages from which a sectioned deck needs a contents page", str(THRESHOLDS["front_matter_from"])),
        ("NO_SUMMARY", "analytical pages from which a deck opens on its executive summary", str(THRESHOLDS["front_matter_from"])),
        ("DECK_FLAT", "analytical pages from which one page must carry the detail", str(THRESHOLDS["deck_shape_from"])),
        ("PAGE_SHAPE_FLAT", "from {} analytical pages: architectures per ten pages, at least; the commonest's share, at most".format(THRESHOLDS["shape_variety_from"]),
         "{:g}; {}".format(THRESHOLDS["shapes_per_ten_min"], _share(THRESHOLDS["shape_share_max"]))),
        ("COLUMN_MONOTONY", "consecutive pages whose commentary column shares one device, at most", str(THRESHOLDS["column_run_max"] - 1)),
        ("CAVEAT_HEAVY", "caveat lines a page, at most", str(THRESHOLDS["caveats_max"])),
        ("TABLE_SCHEMA_FLAT", "tables opening on the same headers, at most (from {} tables)".format(THRESHOLDS["schema_from"]), str(THRESHOLDS["schema_repeat_max"])),
        ("DECK_CRAFT", "advisory rates across analytical pages (from {} pages), at least: a phrase emphasised; a source line; drawn marks a page; "
         "tables treated; charts annotated".format(CRAFT["from"]["min"]),
         "{}; {}; {}; {}; {}".format(_share(CRAFT["highlightedPhrase"]["min"]), _share(CRAFT["sourceLine"]["min"]), CRAFT["marksPerPage"]["min"],
                                     _share(CRAFT["tableTreated"]["min"]), _share(CRAFT["chartAnnotated"]["min"]))),
        ("DECK_CRAFT", "and at most: one table device's share of the tables (from {} tables); pages drawing a mark between exhibit and commentary (from {})".format(
            CRAFT["tableDevice"]["from"], CRAFT["drawnBridge"]["from"]),
         "{}; {}".format(_share(CRAFT["tableDevice"]["shareMax"]), _share(CRAFT["drawnBridge"]["shareMax"]))),
        ("DECK_VOCABULARY", "device families drawn, at least (from {} analytical pages)".format(CRAFT["vocabulary"]["from"]), str(CRAFT["vocabulary"]["familiesMin"])),
        ("SCENE_INK", "estimated ink share of the body, a page with an exhibit, advisory under", _share(SCENE_INK_THRESHOLDS["page_floor"])),
        ("DECK_INK", "median analytical page's estimated ink, advisory under (from {} pages)".format(DECK_HABIT["from"]), _share(SCENE_INK_THRESHOLDS["deck_median"])),
        ("DECK_THIN_PAGES", "content pages with a thin or half-empty finding, blocks at (and at least {} pages, from {})".format(DECK_HABIT["pages_min"], DECK_HABIT["from"]),
         _share(DECK_HABIT["share"])),
        ("DECK_SCENE_VOID", "the same count on the scene before the render", _share(DECK_HABIT["share"])),
    ]
    lines = ["| Code | Threshold | {} |".format(" | ".join("`{}`".format(f) for f in fills)),
             "| --- | --- | {} |".format(" | ".join("---" for _ in fills))]
    lines += ["| `{}` | {} | {} |".format(code, what, " | ".join(value(f) for f in fills)) for code, what, value in by_fill]
    lines += ["", "| Code | Body words, at most, on a page not composed from a page type | {} |".format(" | ".join("`{}`".format(p) for p in profiles)),
              "| --- | --- | {} |".format(" | ".join("---" for _ in profiles))]
    lines += ["| `WORDS` | {} | {} |".format(what, " | ".join(str(PROFILES[p][key]) for p in profiles))
              for what, key in (("a page whose evidence is an exhibit", "words_exhibit"), ("a page of type", "words_text"))]
    lines += ["", "| Code | Threshold | Value |", "| --- | --- | --- |"]
    lines += ["| `{}` | {} | {} |".format(code, what, value) for code, what, value in fixed]
    return "\n".join(lines) + "\n"


def write_json(data, report):
    """`data` to `report` atomically, or to stdout when there is no report."""
    if not report:
        print(json.dumps(data, indent=1))
        return
    out = Path(report)
    tmp = out.with_suffix(out.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=1), encoding="utf-8")
    os.replace(tmp, out)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Deterministic page gates")
    parser.add_argument("scene", nargs="?")
    parser.add_argument("render_dir", nargs="?", default=None,
                        help="Directory of slide-N.png renders; ink gates are skipped without it")
    parser.add_argument("--report", default=None)
    parser.add_argument("--profile", default=None, choices=sorted(PROFILES))
    parser.add_argument("--only", default=None, help="Comma-separated gate codes to run")
    parser.add_argument("--budget", action="store_true",
                        help="Write each content page's budget (body, floor, ceiling, footer, internalVoid, "
                             "deadBand, void, and each column's room in lines) instead of the gate report")
    parser.add_argument("--budget-report", default=None,
                        help="Also write the budget to this file, from the same run as the gate report")
    parser.add_argument("--workflow", default=None, help="The deck's workflow (with --rules-version: the rules it predates)")
    parser.add_argument("--rules-version", default=None, type=float, help="The rules version the deck records")
    parser.add_argument("--thresholds-markdown", action="store_true",
                        help="Print the gate thresholds as the evaluation reference's table and exit")
    parser.add_argument("--judgements", default=None,
                        help="The deck's recorded judgements (<id>.judgements.json): the gates that read a line's meaning hold "
                             "only where it is answered, and list what is not in the report's `judgementsNeeded`")
    parser.add_argument("--page-cache", default=None,
                        help="A file of each page's own results from earlier runs (PageCache): a page whose scene, place and "
                             "rules are unchanged is read from it rather than gated again, and the deck's gates still read "
                             "every page. Written back after the run; safe to delete; never read with a render")
    args = parser.parse_args(argv)

    if args.thresholds_markdown:
        sys.stdout.write(thresholds_markdown())
        return 0
    if not args.scene:
        parser.error("the scene is required")
    scene = load_scene(args.scene)
    if args.budget:
        write_json(page_budget(scene, args.profile), args.report)
        return 0
    gates = {c.strip() for c in args.only.split(",")} if args.only else None
    deck = {"workflow": args.workflow, "rulesVersion": args.rules_version} if args.workflow or args.rules_version is not None else None
    judgements.load(args.judgements)
    cache = PageCache(args.page_cache, page_cache_context(scene, args.profile, gates, deck)) if args.page_cache and not args.render_dir else None
    report = run_gates(scene, args.render_dir, args.profile, gates, deck, cache)
    report["judgementsNeeded"] = judgements.needed()
    write_json(report, args.report)
    if args.budget_report:
        write_json(page_budget(scene, args.profile, cache), args.budget_report)
    if cache is not None:
        cache.save()
    counts = ", ".join(f"{k}={v}" for k, v in report["countsByCode"].items()) or "none"
    print(f"page gates: {'accepted' if report['accepted'] else 'REJECTED'} | {counts}", file=sys.stderr)
    return 0 if report["accepted"] else 2


if __name__ == "__main__":
    sys.exit(main())
