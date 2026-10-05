"""The density profile: a built deck's words measured as a reader meets them.

    python3 density_profile.py deck.pdf scene.json [content.json] --report density-profile.json

The text contract checks what the dot-dash plans to say, and its word floor is
hard. What it cannot see is whether the rendered page reads at the density of
the targets it is set against: a deck can clear every floor with one long
paragraph a page, or with commentary padded to reach the floor, and a plan's
counts need not describe the pages it renders.

So this reads the rendered PDF itself: pdftotext -layout over the whole
document, split into pages at its form feeds, the first non-empty line
dropped as the title, page numbers and Source/Note lines dropped, a block
being a run of non-empty lines between blank ones, blocks under three words
dropped as labels. That is how the targets were measured on the reference
decks' PDFs, and a page here is measured the same way: a chart's heading,
unit, axis rows, category and data labels and legend are counted as the
blocks pdftotext sets them in, because the reference pages' were. One thing
is taken out, by the role of the scene node that drew it: the runtime's own
section tracker, a strip repeated on every page that a reference page does
not carry. It writes, for the deck and for each analytic page, these
numbers beside the skill's targets, and flags every page outside the target
band.

A page's flags are questions: the input to the review's density pass
(references/taste-review.md), where a reader looks at each flagged page and
judges whether its density is right for the job it does - a padded page that
clears the floor is the case it exists to catch. One deck-level measure
blocks: the median words a block across the prose pages, once the deck has
weight.json deckLength.density of them (TEXT_FRAGMENTED). Five blocks of
twenty-five words a page is copy broken into labels whatever each page's
reviewer says about it, and a deck of it is refused at the build.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics as st
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from gate_config import CONTRACT, is_cover, is_tracker, waived_rules  # noqa: E402
from text_stats import printed_words  # noqa: E402
TEXT_FORM = CONTRACT["plan"]["textForm"]
DECK_LENGTH = CONTRACT["deckLength"]

DENSITY_CODES = {
    "TEXT_FRAGMENTED": "the deck's prose pages set their words in blocks whose median size is outside the middle half of the reference pages' (weight.json plan.textForm)",
}
SOURCE_LINE = re.compile(r"^\s*(source|sources|note|notes|footnote)\b[:\s]", re.I)
PAGE_NUMBER = re.compile(r"^\s*\d{1,3}\s*$")
# The targets exclude covers, dividers and contents; so does this, by the
# planned task and by the page gates' own test for a structural page.
STRUCTURAL_TASKS = {"cover", "structural"}


def words(line: str) -> int:
    """Printed words: a bullet or a dash pdftotext sets as its own token is
    not one (text_stats.py)."""
    return len(printed_words(line))


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", str(text)).strip()


def strip_header(lines: list[str], header: set[str] | None) -> list[str]:
    """Remove the title. The plain rule drops a page's first line, which is
    its title on a well-made page. A generated page often carries a section kicker
    above the title, and the first-line rule then dropped the kicker and
    counted the title as body. Given the page's own title and kicker lines,
    those are removed instead; without them the first-line rule stands."""
    if header:
        return [l for l in lines if not (l.strip() and squash(l) in header)]
    out, seen = [], False
    for line in lines:
        if line.strip() and not seen and not PAGE_NUMBER.match(line) and not SOURCE_LINE.match(line):
            seen = True
            continue
        out.append(line)
    return out


def furniture_runs(slide: dict) -> set[tuple[str, ...]]:
    """The runtime's section tracker as the page sets it, each printed line as
    its words (gate_config.is_tracker): the one thing on our pages that the
    reference pages the band was measured on do not carry."""
    runs = set()
    for node in slide.get("nodes", []):
        if node.get("type") == "text" and is_tracker(node):
            runs |= {tuple(line.split()) for line in str(node.get("text", "")).split("\n") if line.strip()}
    return runs


def is_furniture_run(tokens: list[str], runs: set[tuple[str, ...]]) -> bool:
    """Whether `tokens` are tracker furniture and nothing else: its labels or
    marker numbers set one after another ("1 2 3 4 5 6 7")."""
    longest = max((len(run) for run in runs), default=0)
    reach = {0}
    for start in range(len(tokens)):
        if start in reach:
            reach |= {start + n for n in range(1, min(longest, len(tokens) - start) + 1) if tuple(tokens[start:start + n]) in runs}
    return bool(tokens) and len(tokens) in reach


def without_furniture(line: str, runs: set[tuple[str, ...]] | None) -> str:
    """The line with the tracker taken out: empty when the whole line is the
    tracker; otherwise the line less the stretches of it (pdftotext sets
    separate text boxes on one row wide apart) that are a tracker label. A
    bare marker number beside other text stays: on a shared row it could as
    well be an axis value or a cell, which the measure counts."""
    if not runs or not line.strip():
        return line
    if is_furniture_run(line.split(), runs):
        return ""
    stretches = re.split(r"\s{2,}", line.strip())
    kept = [part for part in stretches if not (re.search(r"[^\W\d_]", part) and is_furniture_run(part.split(), runs))]
    return line if len(kept) == len(stretches) else "  ".join(kept)


def page_blocks(text: str, header: set[str] | None = None, furniture: set[tuple[str, ...]] | None = None) -> list[int]:
    """Words per text block, the title, page numbers and source lines removed,
    and with them the tracker the runtime set (`furniture`, the page's
    `furniture_runs`). Everything else pdftotext reads on the page is counted
    as the reference pages' was: a chart's heading, its axis row and its
    labels are blocks where they run to three words. The tracker is taken out
    of the run it stood in and the run is left whole."""
    kept = []
    for line in strip_header(text.split("\n"), header):
        if not line.strip():
            kept.append("")
            continue
        if PAGE_NUMBER.match(line) or SOURCE_LINE.match(line):
            continue
        rest = without_furniture(line, furniture)
        if rest.strip():
            kept.append(rest)
    out, run = [], 0
    for line in kept:
        if line.strip():
            run += words(line)
        elif run:
            out.append(run)
            run = 0
    if run:
        out.append(run)
    return [n for n in out if n >= 3]


# The same reading on a composed scene, before anything is rendered.
#
# pdftotext sets every text box on the page's rows and leaves a blank line
# where the page has a band with no text on it; a block is a run of rows with
# no blank line between them. On the scene the rows are the lines of the text
# nodes, each at the height it is set at, and two consecutive rows are one
# block while the gap between them is under SCENE_ROW_GAP - the gap at which
# pdftotext starts a new block on our rendered pages, set between a body
# line's pitch and the space the composer leaves between two points. Measured
# against the rendered profile of two finished decks (about a hundred pages),
# the half of the pages nearest came within a word, and each deck's median
# within four: an estimate of where the render will stand, never the measure.
SCENE_ROW_GAP = 26.0
# How far the scene's estimate of a deck's median stood from the rendered one on those decks, in words a block.
SCENE_TOLERANCE = 4.0
# Two lines within this of each other are one printed row (a label and the value beside it).
SCENE_ROW_JOIN = 4.0


def scene_text_nodes(node, out=None):
    out = [] if out is None else out
    if isinstance(node, dict):
        if node.get("type") == "text":
            out.append(node)
        for value in node.values():
            scene_text_nodes(value, out)
    elif isinstance(node, list):
        for value in node:
            scene_text_nodes(value, out)
    return out


def scene_blocks(slide: dict) -> list[int]:
    """Words per text block as `page_blocks` will read the rendered page,
    estimated from the composed scene: the title, its kicker, the tracker, the
    page number and the source and note lines left out, as there."""
    raw = []
    for node in scene_text_nodes(slide.get("nodes", [])):
        if str(node.get("role", "")) in HEADER_ROLES or is_tracker(node):
            continue
        frame = node.get("frame") or {}
        lines = str(node.get("text", "")).split("\n")
        set_height = ((node.get("data") or {}).get("textLayout") or {}).get("lineHeight")
        height = set_height or (frame.get("height", 0) / max(1, len(lines)))
        # A node set by the composer starts at its frame's top; a label with no layout sits in the middle of its frame.
        top = frame.get("y", 0) if set_height else frame.get("y", 0) + (frame.get("height", 0) - height * len(lines)) / 2
        raw.extend((top + (i + 0.5) * height, frame.get("x", 0), line) for i, line in enumerate(lines) if line.strip())
    rows = []
    for y, x, line in sorted(raw):
        if rows and y - rows[-1][0] <= SCENE_ROW_JOIN:
            rows[-1][1].append((x, line))
        else:
            rows.append([y, [(x, line)]])
    out, run, last = [], 0, None
    for y, parts in rows:
        line = "  ".join(text for _, text in sorted(parts))
        if PAGE_NUMBER.match(line) or SOURCE_LINE.match(line):
            continue
        if last is not None and y - last > SCENE_ROW_GAP and run:
            out.append(run)
            run = 0
        run += words(line)
        last = y
    if run:
        out.append(run)
    return [n for n in out if n >= 3]


def scene_fragmentation(scene: dict) -> dict:
    """Where the deck will stand on TEXT_FRAGMENTED, estimated from the scene
    (scene_blocks): `pages`, each content page's blocks and words a block with
    whether its reading task is prose, and `standings`, the deck's estimated
    median against the band - marked `estimated`, and never blocking: the rule
    is the render's to measure."""
    pages = []
    for index, slide in enumerate(scene.get("slides", [])):
        if is_cover(slide, index) or re.match(r"^(agenda-\d+|(?:picture-credits|source-limits)(?:-\d+)?)$", str(slide.get("id") or "")):
            continue
        task = slide.get("readingTask")
        if task in STRUCTURAL_TASKS or not task:
            continue
        blocks = scene_blocks(slide)
        pages.append({"slide": index + 1, "id": slide.get("sourceSlideId") or slide.get("id"), "task": task, "prose": prose_task(task), "blocks": len(blocks),
                      "wordsPerBlock": round(sum(blocks) / len(blocks), 1) if blocks else 0})
    prose = [p for p in pages if p["blocks"] and p["prose"]]
    if not prose:
        return {"pages": pages, "standings": []}
    value = round(st.median([p["wordsPerBlock"] for p in prose]), 1)
    low, high = TEXT_FORM["wordsPerBlock"]["q1"], TEXT_FORM["wordsPerBlock"]["q3"]
    each = {str(p["slide"]): p["wordsPerBlock"] for p in prose}
    return {"pages": pages, "standings": [
        {"code": "TEXT_FRAGMENTED", "key": key, "what": "median words a block on the prose pages", "value": value, "bar": bar, "side": side, "unit": "words",
         "applies": len(prose) >= DECK_LENGTH["density"], "blocks": False, "estimated": True, "tolerance": SCENE_TOLERANCE, "each": each}
        for key, bar, side in (("floor", low, "min"), ("ceiling", high, "max"))]}


def body_words(text: str, header: set[str] | None = None) -> int:
    """Body words as the reading-task bank counts them: every word but the title and source lines."""
    lines = [l for l in strip_header(text.split("\n"), header) if l.strip() and not PAGE_NUMBER.match(l)]
    return max(0, sum(words(l) for l in lines) - sum(words(l) for l in lines if SOURCE_LINE.match(l)))


# The standfirst is the title's own line (planRole in derive-content.mjs), so
# the rendered count drops it with the title rather than reading it as body.
HEADER_ROLES = ("action-title", "action-subtitle", "tracker-compact-label", "tracker-label", "kicker")


def header_lines(slide: dict) -> set[str]:
    """The page's title and kicker, line by line as they were set."""
    out = set()
    for node in slide.get("nodes", []):
        if node.get("type") == "text" and str(node.get("role", "")) in HEADER_ROLES:
            out |= {squash(line) for line in str(node.get("text", "")).split("\n") if line.strip()}
    return out


def extract(pdf: Path) -> list[str]:
    """Every page's text, in one pdftotext run split at its form feeds: one
    run a page costs a second a page for the same text."""
    text = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True, check=True).stdout
    return text.split("\f")


def quartiles(values: list[float]) -> tuple[float, float, float]:
    if len(values) < 2:
        v = float(values[0]) if values else 0.0
        return v, v, v
    q = st.quantiles(values, n=4, method="inclusive")
    return q[0], st.median(values), q[2]


# The per-task targets, shipped as numbers (runtime/reading-tasks.json).
TASK_TARGETS = json.loads((Path(__file__).resolve().parents[1] / "reading-tasks.json").read_text())["tasks"]


def band(value, low, high) -> str:
    return "below" if value < low else "above" if value > high else "within"


def prose_task(task) -> bool:
    return bool(task) and ("commentary" in task or task in ("text-page", "mixed"))


def profile(pdf: Path, scene: dict, content: dict | None, rules: dict | None = None) -> dict:
    """The profile of the rendered `pdf`. `rules` ({workflow, rulesVersion})
    says which rules the deck predates (gate_config.waived_rules)."""
    planned = {p["id"]: p for p in (content or {}).get("pages", []) if "id" in p}
    texts = extract(pdf)
    pages = []
    for index, slide in enumerate(scene["slides"], 1):
        pid = slide.get("sourceSlideId") or slide.get("id")
        plan = planned.get(pid) or planned.get(slide.get("id")) or {}
        reference = plan.get("textReference") or {}
        task = reference.get("task")
        # Generated pages - the contents pages composition inserts and the
        # picture credits, split or not - carry no reading task of their own.
        if task in STRUCTURAL_TASKS or is_cover(slide, index - 1) or re.match(r"^(agenda-\d+|(?:picture-credits|source-limits)(?:-\d+)?)$", str(slide.get("id") or "")):
            continue
        text = texts[index - 1] if index - 1 < len(texts) else ""
        header = header_lines(slide) or None
        blocks = page_blocks(text, header, furniture_runs(slide))
        body = body_words(text, header)
        entry = {"page": index, "id": slide.get("id"), "task": task, "bodyWords": body,
                 "blocks": len(blocks), "wordsPerBlock": round(sum(blocks) / len(blocks), 1) if blocks else 0,
                 "longestBlock": max(blocks) if blocks else 0, "blockSizes": blocks, "flags": []}
        target = TASK_TARGETS.get(task, {}).get("bodyWords")
        if target:
            q1, median, q3 = target["q1"], target["median"], target["q3"]
            entry["target"] = {"bodyWordsQ1": round(q1), "bodyWordsMedian": round(median), "bodyWordsQ3": round(q3)}
            entry["bodyWordsVsTaskMedian"] = round(body / median, 2) if median else None
            position = band(body, q1, q3)
            if position == "below":
                entry["flags"].append(f"thin for its task: {body} body words against a target of {round(q1)} to {round(q3)}")
            elif position == "above":
                entry["flags"].append(f"dense for its task: {body} body words against a target of {round(q1)} to {round(q3)}")
        if entry["longestBlock"] > TEXT_FORM["longestBlockMax"]:
            entry["flags"].append(f"a block of {entry['longestBlock']} words; three strong pages in four keep every block under {round(TEXT_FORM['longestBlockMax'])}")
        if entry["blocks"] > TEXT_FORM["blocksPerPage"]["max"] - 2:
            entry["flags"].append(f"{entry['blocks']} text blocks; strong pages carry {TEXT_FORM['blocksPerPage']['q1']:.0f} to {TEXT_FORM['blocksPerPage']['q3']:.0f}")
        if blocks and entry["blocks"] >= 2 and entry["wordsPerBlock"] > TEXT_FORM["wordsPerBlock"]["q3"]:
            entry["flags"].append(f"blocks average {entry['wordsPerBlock']} words; strong pages' blocks run {TEXT_FORM['wordsPerBlock']['q1']} to {TEXT_FORM['wordsPerBlock']['q3']}")
        pages.append(entry)

    # The text-form benchmark describes pages that carry prose:
    # charts with commentary, comparison tables and developed synthesis. A
    # chart-led page's only blocks are its bar and axis labels, so setting all
    # analytic pages against it read a deck of developed 52-word points as 19
    # words a block. The deck comparison uses the same population; pages led by
    # their exhibit alone are summarised beside it.
    prose = [p for p in pages if p["blocks"] and prose_task(p["task"])]
    led = [p for p in pages if p["blocks"] and not prose_task(p["task"])]
    measured = prose or [p for p in pages if p["blocks"]]

    def compare(name, values, target, low, high):
        if not values:
            return {"measured": None, "target": target, "band": [low, high], "position": "unmeasured"}
        value = round(st.median(values), 1)
        return {"measured": value, "target": target, "band": [low, high], "position": band(value, low, high)}

    # Body words are compared per task, so every analytic page counts here.
    ratios = [p["bodyWordsVsTaskMedian"] for p in pages if p.get("bodyWordsVsTaskMedian") is not None]
    single = sum(1 for p in measured if p["blocks"] == 1) / len(measured) if measured else 0
    deck = {
        "analyticPages": len(pages),
        "comparedPages": len(measured),
        "exhibitLed": {"pages": len(led), "blocksPerPage": st.median([p["blocks"] for p in led]) if led else None,
                       "wordsPerBlock": round(st.median([p["wordsPerBlock"] for p in led]), 1) if led else None,
                       "note": "pages led by their exhibit alone; their blocks are labels, so they are not set against the text-form benchmark"},
        "blocksPerPage": compare("blocksPerPage", [p["blocks"] for p in measured], TEXT_FORM["blocksPerPage"]["median"],
                                 TEXT_FORM["blocksPerPage"]["q1"], TEXT_FORM["blocksPerPage"]["q3"]),
        "wordsPerBlock": compare("wordsPerBlock", [p["wordsPerBlock"] for p in measured], TEXT_FORM["wordsPerBlock"]["median"],
                                 TEXT_FORM["wordsPerBlock"]["q1"], TEXT_FORM["wordsPerBlock"]["q3"]),
        "longestBlock": compare("longestBlock", [p["longestBlock"] for p in measured], TEXT_FORM["longestBlock"]["median"],
                                0, TEXT_FORM["longestBlock"]["q3"]),
        # Each page against the target for its job: 1.0 is the task median.
        "bodyWordsVsTaskMedian": compare("ratio", ratios, 1.0, 0.75, 1.25),
        "singleBlockShare": {"measured": round(single, 3), "target": TEXT_FORM["singleBlockPagesMax"],
                             "position": "above" if single > TEXT_FORM["singleBlockPagesMax"] else "within"},
    }
    deck["outsideBand"] = sorted(k for k, v in deck.items() if isinstance(v, dict) and v.get("position") in ("above", "below"))
    findings = fragmentation(deck["wordsPerBlock"], prose)
    waived = waived_rules(rules or {})
    findings = [{**f, "severity": "advisory", "waived": {"rulesVersion": (rules or {}).get("rulesVersion"), "introducedIn": waived[f["code"]]}}
                if f["code"] in waived else f for f in findings]
    # Where the deck stands against the band, broken or not, in the record
    # every deck-level rule writes (gate_config.standing), with each prose
    # page's own figure: the author's check prints it (author-deck.mjs --render).
    words, limits = deck["wordsPerBlock"], deck["wordsPerBlock"]["band"]
    each = {str(p["id"]): p["wordsPerBlock"] for p in prose}
    standings = [{"code": "TEXT_FRAGMENTED", "key": key, "what": "median words a block on the prose pages", "value": words["measured"] or 0, "bar": bar,
                  "side": side, "unit": "words", "applies": len(prose) >= DECK_LENGTH["density"], "blocks": "TEXT_FRAGMENTED" not in waived, "each": each}
                 for key, bar, side in (("floor", limits[0], "min"), ("ceiling", limits[1], "max"))]
    return {
        "schema": "professional-slides.density-profile/v1",
        "$comment": ("Rendered pages measured with pdftotext -layout; targets from weight.json plan.textForm "
                     "and each page's textReference. A page's flags are questions for the review's density pass; "
                     "`findings` holds the deck-level measure that blocks."),
        "deck": deck,
        "accepted": not any(f["severity"] == "blocker" for f in findings),
        "findings": findings,
        "standings": standings,
        "flaggedPages": [p["id"] for p in pages if p["flags"]],
        "pages": pages,
    }


def fragmentation(words_per_block: dict, prose: list) -> list:
    """TEXT_FRAGMENTED: the prose pages' median words a block outside the
    wordsPerBlock band, read once the deck has deckLength.density prose pages.
    Measured on prose pages only - a chart-led page's blocks are its labels."""
    if len(prose) < DECK_LENGTH["density"] or words_per_block.get("position") not in ("above", "below"):
        return []
    low, high = words_per_block["band"]
    below = words_per_block["position"] == "below"
    worst = sorted(prose, key=lambda p: p["wordsPerBlock"], reverse=not below)[:6]
    return [{
        "code": "TEXT_FRAGMENTED", "severity": "blocker", "slide": None,
        "measured": {"wordsPerBlock": words_per_block["measured"], "pages": len(prose), "direction": words_per_block["position"],
                     "worst": [{"page": p["page"], "id": p["id"], "wordsPerBlock": p["wordsPerBlock"], "blocks": p["blocks"]} for p in worst]},
        "threshold": [low, high],
        "repair": ("The prose pages set a median of {} words a block, where strong pages' blocks run {} to {}. {}"
                   .format(words_per_block["measured"], low, high,
                           "The copy is broken into labels: merge the fragments on each page into the developed points they "
                           "belong to - a finding, its evidence and what follows - rather than a line a fact. Start with "
                           + ", ".join(str(p["id"]) for p in worst) + "."
                           if below else
                           "The copy is set as slabs: break each page's argument into its points, one finding and its "
                           "evidence each. Start with " + ", ".join(str(p["id"]) for p in worst) + ".")),
    }]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("scene")
    ap.add_argument("content", nargs="?")
    ap.add_argument("--report", required=True)
    ap.add_argument("--workflow", default=None)
    ap.add_argument("--rules-version", default=None, type=float)
    a = ap.parse_args()
    scene = json.loads(Path(a.scene).read_text())
    content = json.loads(Path(a.content).read_text()) if a.content and Path(a.content).is_file() else None
    result = profile(Path(a.pdf), scene, content, {"workflow": a.workflow, "rulesVersion": a.rules_version})
    Path(a.report).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"analyticPages": result["deck"]["analyticPages"], "flagged": len(result["flaggedPages"]),
                      "outsideBand": result["deck"]["outsideBand"], "accepted": result["accepted"],
                      "blockers": [f["code"] for f in result["findings"] if f["severity"] == "blocker"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
