"""Measure a built deck page by page and set it beside a reference census.

A deck that passes every gate can still read thinner, emptier or more uniform
than the decks it is meant to stand beside, and that difference shows by
laying two PDFs side by side and counting. This makes the count repeatable:

    python3 evals/scripts/reference_census.py deck.pdf \
        [--scene out/scene.json] [--pages deck.pages.json] [--deck deck.deck.json] \
        [--reference other.pdf | --reference census.json] [--out report.json]

From the rendered PDF, every page: words and numeric tokens on the text layer,
ink coverage of the body, grid cells the body occupies, the tallest empty band
across the body, and whether a rule sits under the title. From the scene
(pages matched by position) or the pages file (matched by slide id): exhibits
per content page, the share that are one exhibit beside a text column, pages
with two or more exhibits, plotted values per chart page, titles whose last
line is one to three words, and whether pages carry a subtitle or a title rule.

Every per-page statistic is taken over the analytical pages only, as the gates
define them (page_gates.analytical): the cover, section dividers, agendas,
closing takeaways and the build's generated pages (the picture credits) are
left out - told apart by the scene, or guessed from the render without one. A scanned reference cannot be
told apart and is measured whole; the printed notes say which applied.

Plotted values are the compiler's: with the compiled deck spec (`--deck`, or
the `<id>.deck.json` beside `--pages`), the chart pages are those whose
`pageType.chart` is set - the chart page types and panels carrying a chart -
and each counts `pageType.values`, the number `author-deck.mjs` reports as
`plotted`. Without it, the pages file's authored series or the scene's marks
are counted, which can disagree with the compiler.

`--reference` takes another PDF (measured the same way) or a census JSON: this
script's own `--out`, or a bare list of per-page rows with `words`, `nums`,
`ink` and `occ`. A reference with no text layer (a scan) reports its word
counts as unavailable rather than as zero. `evals/reference_census.json` is a
numbers-only census of a sample of strong consulting pages to pass as
`--reference`; the sample itself lives outside the repository.

Rendering uses PyMuPDF when it is installed and poppler's pdftoppm/pdftotext
otherwise; numpy and Pillow are required either way. The pixel measures keep
the parameters the first comparison used (a 200 px render for ink and grid, a
300 px render for empty bands), so numbers from either backend are comparable
with a census taken before this script existed.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# What a page is and what a title rule looks like are the skill's own
# definitions, read from its runtime rather than kept here as copies that
# drift: page_gates.analytical (weight.json analyticalPage) says which pages
# the per-page statistics count, and infer-style.py's title_rule is the
# detector the style inference reads a reference page with.
RUNTIME = Path(__file__).resolve().parents[2] / "skills" / "professional-slides" / "runtime"
sys.path.insert(0, str(RUNTIME / "gates"))
from page_gates import analytical  # noqa: E402
from text_stats import printed_words, word_count  # noqa: E402
_infer = importlib.util.spec_from_file_location("infer_style", RUNTIME / "infer-style.py")
infer_style = importlib.util.module_from_spec(_infer)
_infer.loader.exec_module(infer_style)

INK_DELTA = 25            # grey levels from the page background that count as ink
CENSUS_WIDTH = 200        # px; ink and occupied-grid render
BAND_WIDTH = 300          # px; empty-band render
RULE_WIDTH = 1200         # px; a hairline rule survives only a fine render
GRID = 20                 # body split into GRID x GRID cells
EMPTY_BAND_LIMIT = 0.15   # an empty band taller than this share of the body is a hole
EXHIBIT_COMPONENTS = {"table"}
EXHIBIT_CATEGORIES = {"chart", "relationship"}
TEXT_COMPONENTS = {"bullet-list", "paragraph", "insight", "side-statement", "stat-list", "cards"}


# ---------------------------------------------------------------- rendering

def _backend():
    try:
        import fitz  # noqa: F401
        return "pymupdf"
    except ImportError:
        pass
    if shutil.which("pdftoppm") and shutil.which("pdftotext"):
        return "poppler"
    raise SystemExit("reference_census needs PyMuPDF, or poppler's pdftoppm and pdftotext")


class PdfPages:
    """Per-page text and grey renders at a given pixel width, from either backend."""

    def __init__(self, path: Path):
        import numpy  # noqa: F401  (fail early with a clear import error)
        self.path, self.backend = Path(path), _backend()
        self._renders: dict[int, list] = {}
        if self.backend == "pymupdf":
            import fitz
            # Tagged PDFs from the office renderer trip structure-tree warnings
            # on every page; they say nothing about what is drawn.
            fitz.TOOLS.mupdf_display_errors(False)
            self.doc = fitz.open(str(self.path))
            self.count = len(self.doc)
            self.texts = [page.get_text() for page in self.doc]
        else:
            text = subprocess.run(["pdftotext", "-enc", "UTF-8", str(self.path), "-"],
                                  check=True, capture_output=True).stdout.decode("utf-8", "replace")
            # pdftotext ends every page with a form feed, the last one included.
            self.texts = text.split("\f")[:-1] if text.endswith("\f") else text.split("\f")
            self.count = len(self.texts)

    def grey(self, width: int):
        if width in self._renders:
            return self._renders[width]
        import numpy as np
        out = []
        if self.backend == "pymupdf":
            import fitz
            for page in self.doc:
                zoom = width / page.rect.width
                pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csGRAY)
                out.append(np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width))
        else:
            from PIL import Image
            with tempfile.TemporaryDirectory() as tmp:
                subprocess.run(["pdftoppm", "-gray", "-scale-to-x", str(width), "-scale-to-y", "-1",
                                str(self.path), str(Path(tmp) / "p")], check=True, capture_output=True)
                for file in sorted(Path(tmp).glob("p-*.pgm"), key=lambda f: int(f.stem.split("-")[-1])):
                    out.append(np.asarray(Image.open(file).convert("L")))
        self._renders[width] = out
        return out


# ------------------------------------------------------------ page measures

def _ink(image):
    import numpy as np
    grey = image.astype(int)
    return np.abs(grey - int(np.median(grey))) > INK_DELTA


def ink_and_grid(image) -> tuple[float, float]:
    """Ink share of the body (15-92% of the height) and share of grid cells with any ink."""
    mask = _ink(image)
    height = mask.shape[0]
    body = mask[int(height * 0.15):int(height * 0.92), :]
    ch, cw = body.shape[0] // GRID, body.shape[1] // GRID
    cells = [body[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw].mean() > 0.005
             for r in range(GRID) for c in range(GRID)] if ch and cw else []
    return round(float(body.mean()), 3), round(sum(cells) / len(cells), 2) if cells else 0.0


def empty_band(image) -> float:
    """Tallest run of blank rows across the body (17-90% of the height), as a share of it."""
    mask = _ink(image)
    height = mask.shape[0]
    rows = mask[int(height * 0.17):int(height * 0.90)].mean(1) > 0.002
    best = run = 0
    for inked in rows:
        run = 0 if inked else run + 1
        best = max(best, run)
    return round(best / len(rows), 2) if len(rows) else 0.0


def title_rule(image) -> bool:
    """A rule under the title on this render: the skill's own detector
    (infer-style.py title_rule), read on the render's ink."""
    return infer_style.title_rule(_ink(image).tolist(), image.shape[0]) is not None


def measure_pdf(path: Path) -> list[dict]:
    pdf = PdfPages(path)
    census, band, rule = pdf.grey(CENSUS_WIDTH), pdf.grey(BAND_WIDTH), pdf.grey(RULE_WIDTH)
    has_text = any(printed_words(text) for text in pdf.texts)
    rows = []
    for index in range(pdf.count):
        text = pdf.texts[index] if index < len(pdf.texts) else ""
        words = printed_words(text)
        ink, occ = ink_and_grid(census[index])
        rows.append({
            # Read by analytical_by_render and dropped before the report.
            "_credits": bool(re.search(r"\b(?:picture|photo|image) credits\b", text, re.I)),
            "page": index + 1,
            "words": len(words) if has_text else None,
            "nums": sum(1 for w in words if re.search(r"\d", w)) if has_text else None,
            "ink": ink, "occ": occ,
            "emptyBand": empty_band(band[index]),
            "titleRule": title_rule(rule[index]),
        })
    return rows


# ------------------------------------------------------- structure measures

def _plotted(exhibit) -> int:
    """How many numbers a chart exhibit plots, read off its authored data."""
    if not isinstance(exhibit, dict):
        return 0
    count = sum(len(s.get("values") or []) + len(s.get("points") or []) for s in exhibit.get("series") or [] if isinstance(s, dict))
    count += len(exhibit.get("values") or []) + len(exhibit.get("points") or [])
    count += len(exhibit.get("low") or []) + len(exhibit.get("high") or [])
    count += sum(1 for item in exhibit.get("items") or [] if isinstance(item, dict) and "value" in item)
    return count


def _is_chart(exhibit) -> bool:
    if not isinstance(exhibit, dict):
        return False
    kind = str(exhibit.get("type") or "")
    if kind:
        return kind.startswith("chart.")
    return any(key in exhibit for key in ("series", "values", "items", "low"))


def pages_file_values(pages_path: Path) -> dict[str, int]:
    """Plotted values per chart page, keyed by page id, from a deck pages file.

    The fallback when no compiled deck spec is found: it counts the authored
    series, which is not the compiler's count (a table's numeric cells, a
    waffle's parts, a box's five figures) - see compiled_pages."""
    data = json.loads(Path(pages_path).read_text())
    pages = data.get("pages", data.get("slides", [])) if isinstance(data, dict) else data
    out = {}
    for page in pages:
        exhibits = [page.get("exhibit")] if page.get("exhibit") else list(page.get("exhibits") or [])
        charts = [e for e in exhibits if _is_chart(e)]
        if charts and page.get("id"):
            out[page["id"]] = sum(_plotted(e) for e in charts)
    return out


def compiled_pages(path: Path) -> dict | None:
    """What the compiler recorded for each page of a compiled deck spec
    (`<id>.deck.json`, written by author-deck.mjs): the plotted values of its
    chart pages.

    The chart pages are the compiler's: every page whose `pageType.chart` is
    set - the chart types (trend, ranking, composition, relationship, bridge)
    and panels carrying a chart - with `pageType.values`, the count the author
    sees as `plotted` and EVIDENCE_DEPTH gates. Counting the scene's marks or
    the authored series gave 14 on a deck the compiler put at 20; read from
    here, both report one number. None when the file carries no page types."""
    data = json.loads(Path(path).read_text())
    slides = [*(data.get("slides") or []), *(data.get("appendix") or [])] if isinstance(data, dict) else []
    if not any(isinstance(s, dict) and s.get("pageType") for s in slides):
        return None
    return {"values": {slide.get("id"): slide["pageType"]["values"] for slide in slides
                       if (slide.get("pageType") or {}).get("chart") and isinstance(slide["pageType"].get("values"), (int, float))}}


def find_compiled(pages_path: Path | None, deck_path: Path | None) -> dict | None:
    """The compiled deck spec: `--deck`, the `--pages` file itself when it is
    one, or the `<id>.deck.json` author-deck.mjs writes beside the pages file."""
    for candidate in (deck_path, pages_path,
                      pages_path and pages_path.with_name(pages_path.name.replace(".pages.json", ".deck.json"))):
        if candidate and Path(candidate).is_file():
            found = compiled_pages(Path(candidate))
            if found is not None:
                return found
    return None


def analytical_by_render(rows: list[dict]) -> list[bool] | None:
    """A guess at which rendered pages carry the argument, for a deck with no
    scene: the first page is the cover, a page naming its picture credits is
    generated, and a page of under 25 words is a divider. A scan has no text
    layer, so its pages cannot be told apart: None."""
    if all(r.get("words") is None for r in rows):
        return None
    return [i > 0 and not r.get("_credits") and (r.get("words") or 0) >= 25 for i, r in enumerate(rows)]


def _beside(a, b) -> bool:
    """Two frames sit side by side: little horizontal overlap, real vertical overlap."""
    x_overlap = min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"])
    y_overlap = min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"])
    return x_overlap < 0.1 * min(a["width"], b["width"]) and y_overlap > 0.3 * min(a["height"], b["height"])


def scene_structure(scene_path: Path, plotted_by_id: dict[str, int] | None, compiled: dict | None = None) -> list[dict]:
    scene = json.loads(Path(scene_path).read_text())
    rows = []
    for index, slide in enumerate(scene.get("slides", [])):
        instances = slide.get("componentInstances") or []
        nodes = slide.get("nodes") or []
        titles = [n for n in nodes if n.get("role") == "action-title"]
        # Only the pages that carry the argument are measured - the gates'
        # analytical pages: the cover, section dividers, agendas, the closing
        # takeaways and the generated credits page are furniture, and counted
        # they put a deck's empty-band share at 18% when its analytical pages ran at 6%.
        source = slide.get("sourceSlideId") or slide.get("id")
        row = {"id": slide.get("id"), "content": analytical(slide, index)}
        if row["content"]:
            exhibits = [i for i in instances if i.get("category") in EXHIBIT_CATEGORIES or i.get("component") in EXHIBIT_COMPONENTS]
            texts = [i for i in instances if i.get("component") in TEXT_COMPONENTS]
            charts = [i for i in exhibits if i.get("category") == "chart"]
            lines = (((titles[0].get("data") or {}).get("textLayout") or {}).get("lines") or str(titles[0].get("text") or "").split("\n")) if titles else [""]
            chrome = next((i for i in instances if i.get("component") == "slide-chrome"), {})
            row.update({
                "exhibits": len(exhibits),
                "exhibitBesideColumn": len(exhibits) == 1 and any(_beside(exhibits[0]["frame"], t["frame"]) for t in texts if t.get("frame")),
                "chart": bool(charts),
                "titleLines": len(lines),
                "shortLastLine": len(lines) > 1 and 1 <= word_count(lines[-1]) <= 3,
                "subtitle": any("subtitle" in str(n.get("role")) and not str(n.get("role")).startswith(("cover", "divider")) for n in nodes),
                "sceneRule": any(n.get("role") in ("title-rule", "action-title-rule") for n in nodes) or "with-line" in str(chrome.get("variant", "")),
            })
            if compiled is not None:
                # The compiler's chart pages and counts, so the census and
                # the author's summary agree.
                row["chart"] = source in compiled["values"]
                if row["chart"]:
                    row["plotted"] = compiled["values"][source]
            elif charts:
                if plotted_by_id is not None and slide.get("id") in plotted_by_id:
                    row["plotted"] = plotted_by_id[slide["id"]]
                else:
                    # No pages file: count what the scene drew - a mark per bar,
                    # else a label per point, else one more point than segments.
                    ids = {c.get("instanceId") for c in charts}
                    mine = [n for n in nodes if (n.get("data") or {}).get("componentInstance") in ids]
                    count = lambda role: sum(1 for n in mine if n.get("role") == role)  # noqa: E731
                    row["plotted"] = count("chart-mark") or count("data-label") or (count("chart-line") + 1 if count("chart-line") else 0)
        rows.append(row)
    return rows


# ------------------------------------------------------------------ summary

def _spread(values, middle="upper"):
    """Median, quartiles and mean. `middle="mean"` takes an even count's
    median as the mean of its two middle values, as the compiler does
    (variety_gates.mjs evidenceDepth), so a compiler count reads the same here."""
    values = sorted(v for v in values if v is not None)
    if not values:
        return None
    n = len(values)
    median = values[n // 2] if n % 2 or middle == "upper" else (values[n // 2 - 1] + values[n // 2]) / 2
    median = int(median) if middle == "mean" and isinstance(median, float) and median.is_integer() else median
    return {"median": median, "p25": values[n // 4], "p75": values[(3 * n) // 4],
            "mean": round(sum(values) / n, 2), "n": n}


def _share(flags):
    flags = [bool(f) for f in flags if f is not None]
    return {"share": round(sum(flags) / len(flags), 2), "n": len(flags)} if flags else None


def summarize(pdf_rows: list[dict] | None, structure: list[dict] | None = None, compiled: dict | None = None) -> dict:
    summary = {}
    # Rows marked by the scene or the render heuristic count only when they
    # carry the argument; unmarked rows (a scan) all count.
    if pdf_rows and any("analytical" in r for r in pdf_rows):
        pdf_rows = [r for r in pdf_rows if r.get("analytical", True)]
    if pdf_rows:
        # A scan has no text layer; its word counts are unknown, not zero.
        if all(r.get("words") in (None, 0) for r in pdf_rows) and all(r.get("nums") in (None, 0) for r in pdf_rows):
            pdf_rows = [{**r, "words": None, "nums": None} for r in pdf_rows]
        for key in ("words", "nums", "ink", "occ", "emptyBand"):
            summary[key] = _spread(r.get(key) for r in pdf_rows)
        summary["emptyBandOver15"] = _share(r["emptyBand"] > EMPTY_BAND_LIMIT for r in pdf_rows if r.get("emptyBand") is not None)
        summary["titleRule"] = _share(r.get("titleRule") for r in pdf_rows)
    if structure:
        content = [r for r in structure if r.get("content")]
        summary["contentPages"] = len(content)
        summary["exhibitsPerPage"] = _spread(r["exhibits"] for r in content)
        summary["twoPlusExhibits"] = _share(r["exhibits"] >= 2 for r in content)
        summary["exhibitBesideColumn"] = _share(r["exhibitBesideColumn"] for r in content)
        summary["plottedPerChartPage"] = _spread(r.get("plotted") for r in content if r.get("chart"))
        wrapped = [r for r in content if r["titleLines"] > 1]
        summary["shortTitleLastLine"] = _share(r["shortLastLine"] for r in wrapped)
        summary["subtitle"] = _share(r["subtitle"] for r in content)
        summary["sceneTitleRule"] = _share(r["sceneRule"] for r in content)
    if compiled is not None:
        # Every chart page the compiler counted, appendix included, as the
        # author's summary counts them.
        summary["plottedPerChartPage"] = _spread(compiled["values"].values(), middle="mean")
    return {k: v for k, v in summary.items() if v is not None}


def mark_analytical(rows: list[dict], structure: list[dict] | None) -> str:
    """Mark each rendered page as analytical or not, and say how it was told."""
    if structure and len(structure) == len(rows):
        for row, page in zip(rows, structure):
            row["analytical"] = bool(page.get("content"))
        return "scene"
    flags = analytical_by_render(rows)
    if flags is None:
        return "none"
    for row, flag in zip(rows, flags):
        row["analytical"] = flag
    return "render"


FILTER_NOTES = {
    "scene": "analytical pages only; the cover, dividers, agendas and generated pages are left out, read from the scene",
    "render": "analytical pages only, guessed from the render: the first page, pages under 25 words and a credits page are left out",
    "none": "every page as measured; a scan has no text layer, so structural pages cannot be told apart",
    "summary": "as measured when the census was taken",
}


def load_reference(path: Path) -> dict:
    if Path(path).suffix.lower() == ".pdf":
        rows = measure_pdf(path)
        how = mark_analytical(rows, None)
        return {**summarize(rows), "pagesMeasured": how}
    data = json.loads(Path(path).read_text())
    if isinstance(data, dict) and "summary" in data:
        return {**data["summary"], "pagesMeasured": data["summary"].get("pagesMeasured", "summary")}
    if isinstance(data, list):  # bare per-page rows
        rows = [{"emptyBand": None, **row} for row in data]
        return {**summarize(rows), "pagesMeasured": "none"}
    raise SystemExit("--reference must be a PDF, a census JSON with a summary, or a list of page rows")


# -------------------------------------------------------------------- table

ROWS = [
    ("Words per page (median)", "words", "median"),
    ("Numeric tokens per page (median)", "nums", "median"),
    ("Body ink coverage (median)", "ink", "median"),
    ("Occupied grid cells (median)", "occ", "median"),
    ("Pages with empty band > 15% of body", "emptyBandOver15", "share"),
    ("Title rule, measured on the render", "titleRule", "share"),
    ("Content pages", "contentPages", None),
    ("Exhibits per content page (mean)", "exhibitsPerPage", "mean"),
    ("Pages with 2+ exhibits", "twoPlusExhibits", "share"),
    ("One exhibit beside a text column", "exhibitBesideColumn", "share"),
    ("Plotted values per chart page (median)", "plottedPerChartPage", "median"),
    ("Wrapped titles with a 1-3 word last line", "shortTitleLastLine", "share"),
    ("Pages with a subtitle", "subtitle", "share"),
    ("Title rule, from the scene", "sceneTitleRule", "share"),
]


def _cell(summary: dict | None, key: str, field: str | None) -> str:
    if not summary or summary.get(key) is None:
        return "-"
    value = summary[key] if field is None else summary[key].get(field)
    if value is None:
        return "-"
    return f"{value:.0%}" if field == "share" else str(value)


def table(deck: dict, reference: dict | None) -> str:
    header = ["Measure", "Deck"] + (["Reference"] if reference is not None else [])
    body = [[label, _cell(deck, key, field)] + ([_cell(reference, key, field)] if reference is not None else [])
            for label, key, field in ROWS if deck.get(key) is not None or (reference or {}).get(key) is not None]
    widths = [max(len(r[i]) for r in [header, *body]) for i in range(len(header))]
    line = lambda r: "  ".join(c.ljust(w) if i == 0 else c.rjust(w) for i, (c, w) in enumerate(zip(r, widths)))  # noqa: E731
    notes = [f"{name}: {FILTER_NOTES[side['pagesMeasured']]}." for name, side in (("Deck", deck), ("Reference", reference))
             if side and side.get("pagesMeasured") in FILTER_NOTES]
    if deck.get("plottedFrom"):
        notes.append(f"Plotted values: {deck['plottedFrom']}.")
    return "\n".join([line(header), line(["-" * w for w in widths]), *map(line, body), *([""] + notes if notes else [])])


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--scene", type=Path)
    parser.add_argument("--pages", type=Path)
    parser.add_argument("--deck", type=Path, help="the compiled deck spec (<id>.deck.json); found beside --pages when omitted")
    parser.add_argument("--reference", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    pdf_rows = measure_pdf(args.pdf)
    compiled = find_compiled(args.pages, args.deck)
    plotted = pages_file_values(args.pages) if args.pages and compiled is None else None
    structure = scene_structure(args.scene, plotted, compiled) if args.scene else None
    if structure and len(structure) == len(pdf_rows):
        for pdf_row, scene_row in zip(pdf_rows, structure):
            pdf_row.update({k: v for k, v in scene_row.items() if k != "content"}, content=scene_row["content"])
    how = mark_analytical(pdf_rows, structure)
    summary = {**summarize(pdf_rows, structure, compiled), "pagesMeasured": how,
               "analyticalPages": sum(1 for r in pdf_rows if r.get("analytical", True))}
    if plotted is not None and not structure:
        summary["plottedPerChartPage"] = _spread(plotted.values())
    summary["plottedFrom"] = ("the compiler's count (pageType.values) on its chart pages" if compiled is not None
                              else "the authored series in the pages file" if plotted is not None
                              else "the marks the scene draws" if structure else None)
    summary = {k: v for k, v in summary.items() if v is not None}
    for row in pdf_rows:
        row.pop("_credits", None)
    reference = load_reference(args.reference) if args.reference else None
    report = {"schema": "professional-slides.reference-census/v1", "pages": len(pdf_rows),
              "summary": summary, **({"reference": reference} if reference is not None else {}), "perPage": pdf_rows}
    if args.out:
        args.out.write_text(json.dumps(report, indent=1) + "\n")
    print(table(summary, reference))
    return 0


if __name__ == "__main__":
    sys.exit(main())
