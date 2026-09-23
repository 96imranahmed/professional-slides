"""The density profile: a built deck's words measured the way the corpus was.

    python3 density_profile.py deck.pdf scene.json [content.json] --report density-profile.json

The text contract checks what the dot-dash plans to say, and its word floor is
hard. What it cannot see is whether the rendered page reads at the density of
the client pages it is set against: a deck can clear every floor with one long
paragraph a page, or with commentary padded to reach the floor, and a deck
measured on its plan alone once reported a median of 75 body words a page and
a longest block of 52 while its rendered pages read nothing like either.

So this reads the rendered PDF with the extraction the corpus used
(evals/corpus/measure_text_form.py and build_reading_tasks.py): pdftotext
-layout one page at a time, the first non-empty line dropped as the title,
page numbers and Source/Note lines dropped, a block being a run of non-empty
lines between blank ones, blocks under three words dropped as labels. It
writes, for the deck and for each analytic page, the numbers the client pages
were measured on beside the client targets, and flags every page outside the
target band.

The profile does not pass or fail anything. It is the input to the review's
density pass (references/taste-review.md), where a reader looks at each
flagged page and judges whether its density is right for the job it does -
a flag is a question, and a padded page that clears the floor is the case it
exists to catch.
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
from page_gates import is_cover  # noqa: E402
TEXT_FORM = json.loads((HERE.parent / "weight.json").read_text())["plan"]["textForm"]
SOURCE_LINE = re.compile(r"^\s*(source|sources|note|notes|footnote)\b[:\s]", re.I)
PAGE_NUMBER = re.compile(r"^\s*\d{1,3}\s*$")
# Pages the corpus measures exclude covers, dividers and contents; so does this,
# by the planned task and by the page gates' own test for a structural page.
STRUCTURAL_TASKS = {"cover", "structural"}


def words(line: str) -> int:
    return len([w for w in re.split(r"\s+", line.strip()) if re.search(r"[A-Za-z0-9]", w)])


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", str(text)).strip()


def strip_header(lines: list[str], header: set[str] | None) -> list[str]:
    """Remove the title. The corpus drops a page's first line, which is its
    title on a client page. A generated page often carries a section kicker
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


def page_blocks(text: str, header: set[str] | None = None) -> list[int]:
    """Words per text block, the title, page numbers and source lines removed."""
    kept = []
    for line in strip_header(text.split("\n"), header):
        if not line.strip():
            kept.append("")
            continue
        if PAGE_NUMBER.match(line) or SOURCE_LINE.match(line):
            continue
        kept.append(line)
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


def body_words(text: str, header: set[str] | None = None) -> int:
    """Body words as the reading-task bank counts them: every word but the title and source lines."""
    lines = [l for l in strip_header(text.split("\n"), header) if l.strip() and not PAGE_NUMBER.match(l)]
    return max(0, sum(words(l) for l in lines) - sum(words(l) for l in lines if SOURCE_LINE.match(l)))


HEADER_ROLES = ("action-title", "tracker-compact-label", "tracker-label", "kicker")


def header_lines(slide: dict) -> set[str]:
    """The page's title and kicker, line by line as they were set."""
    out = set()
    for node in slide.get("nodes", []):
        if node.get("type") == "text" and str(node.get("role", "")) in HEADER_ROLES:
            out |= {squash(line) for line in str(node.get("text", "")).split("\n") if line.strip()}
    return out


def extract(pdf: Path, page: int) -> str:
    return subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(pdf), "-"],
                          capture_output=True, text=True, check=True).stdout


def quartiles(values: list[float]) -> tuple[float, float, float]:
    if len(values) < 2:
        v = float(values[0]) if values else 0.0
        return v, v, v
    q = st.quantiles(values, n=4, method="inclusive")
    return q[0], st.median(values), q[2]


# The per-task client targets, shipped as numbers (runtime/reading-tasks.json).
TASK_TARGETS = json.loads((Path(__file__).resolve().parents[1] / "reading-tasks.json").read_text())["tasks"]


def band(value, low, high) -> str:
    return "below" if value < low else "above" if value > high else "within"


def prose_task(task) -> bool:
    return bool(task) and ("commentary" in task or task in ("text-page", "mixed"))


def profile(pdf: Path, scene: dict, content: dict | None) -> dict:
    planned = {p["id"]: p for p in (content or {}).get("pages", []) if "id" in p}
    pages = []
    for index, slide in enumerate(scene["slides"], 1):
        pid = slide.get("sourceSlideId") or slide.get("id")
        plan = planned.get(pid) or planned.get(slide.get("id")) or {}
        reference = plan.get("textReference") or {}
        task = reference.get("task")
        if task in STRUCTURAL_TASKS or is_cover(slide, index - 1):
            continue
        text = extract(pdf, index)
        header = header_lines(slide) or None
        blocks = page_blocks(text, header)
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
                entry["flags"].append(f"thin for its task: {body} body words against the client pages' {round(q1)} to {round(q3)}")
            elif position == "above":
                entry["flags"].append(f"dense for its task: {body} body words against the client pages' {round(q1)} to {round(q3)}")
        if entry["longestBlock"] > TEXT_FORM["longestBlockMax"]:
            entry["flags"].append(f"a block of {entry['longestBlock']} words; three client pages in four keep every block under {round(TEXT_FORM['longestBlockMax'])}")
        if entry["blocks"] > TEXT_FORM["blocksPerPage"]["max"] - 2:
            entry["flags"].append(f"{entry['blocks']} text blocks; client pages carry {TEXT_FORM['blocksPerPage']['q1']:.0f} to {TEXT_FORM['blocksPerPage']['q3']:.0f}")
        if blocks and entry["blocks"] >= 2 and entry["wordsPerBlock"] > TEXT_FORM["wordsPerBlock"]["q3"]:
            entry["flags"].append(f"blocks average {entry['wordsPerBlock']} words; client blocks run {TEXT_FORM['wordsPerBlock']['q1']} to {TEXT_FORM['wordsPerBlock']['q3']}")
        pages.append(entry)

    # The text-form benchmark was measured on client pages that carry prose:
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
        # Each page against the client pages doing its job: 1.0 is the task median.
        "bodyWordsVsTaskMedian": compare("ratio", ratios, 1.0, 0.75, 1.25),
        "singleBlockShare": {"measured": round(single, 3), "target": TEXT_FORM["singleBlockPagesMax"],
                             "position": "above" if single > TEXT_FORM["singleBlockPagesMax"] else "within"},
    }
    deck["outsideBand"] = sorted(k for k, v in deck.items() if isinstance(v, dict) and v.get("position") in ("above", "below"))
    return {
        "schema": "professional-slides.density-profile/v1",
        "$comment": ("Rendered pages measured with the corpus's own extraction; targets from weight.json plan.textForm "
                     "and each page's textReference. Flags are questions for the review's density pass, not failures."),
        "deck": deck,
        "flaggedPages": [p["id"] for p in pages if p["flags"]],
        "pages": pages,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("scene")
    ap.add_argument("content", nargs="?")
    ap.add_argument("--report", required=True)
    a = ap.parse_args()
    scene = json.loads(Path(a.scene).read_text())
    content = json.loads(Path(a.content).read_text()) if a.content and Path(a.content).is_file() else None
    result = profile(Path(a.pdf), scene, content)
    Path(a.report).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"analyticPages": result["deck"]["analyticPages"], "flagged": len(result["flaggedPages"]),
                      "outsideBand": result["deck"]["outsideBand"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
