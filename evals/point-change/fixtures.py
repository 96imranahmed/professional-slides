#!/usr/bin/env python3
"""The decks the point-change benchmark revises, made here: nothing binary is committed.

    python3 evals/point-change/fixtures.py <dir> [--fixture user|notations|own]

    user   a deck this skill did not build, written with python-pptx the way
           a user's deck is: a title slide, topic titles, bullets on the
           template's placeholders, a native stacked column chart, a native
           table, a picture, a native pie, speaker notes, and a footer and a
           page number set as plain text boxes. One figure - FY26 revenue,
           £12.4m - stands on three slides (in the summary's text, in the
           table's total row, and in the closing slide), which is what a
           number change has to follow.
    notations  the user's deck with the same figure said the ways a deck says
           one figure: "£12.4m" in the summary and the close, 12.4 in the
           table's total under "Revenue (£m)", "£12.4 million" in the
           priorities, and "£12.4m" again in the speaker's notes of the
           flagship slide - and, on the summary, numbers that hold its digits
           inside longer ones ("£12.45", "£12.4" a kilo), which an edit of the
           figure must not reach.
    own    a deck this skill built: 22 analytical pages of the worked example
           (examples/page-types.pages.json) in four sections, compiled and
           built to a PPTX without rendering.

Prints one JSON line a fixture: { fixture, pptx, slides }.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / "skills" / "professional-slides"
RUNTIME = SKILL / "runtime"
EXAMPLES = SKILL / "examples"
NODE = os.environ.get("RUNTIME_NODE") or shutil.which("node")

REVENUE = {"categories": ["FY22", "FY23", "FY24", "FY25", "FY26"], "Cafes": [6.1, 6.9, 7.8, 8.6, 9.7], "Wholesale": [1.2, 1.5, 1.9, 2.3, 2.7]}
REGIONS = [["Region", "Stores", "Revenue (£m)", "Like-for-like growth", "Margin"],
           ["North", "14", "3.9", "6.2%", "14.1%"], ["Midlands", "9", "2.2", "4.8%", "11.9%"], ["South", "12", "3.6", "9.4%", "16.3%"],
           ["London", "7", "2.7", "11.0%", "9.8%"], ["Total", "42", "12.4", "7.9%", "13.4%"]]
CHANNELS = {"labels": ["In store", "Takeaway", "Delivery", "Wholesale"], "values": [41, 27, 10, 22]}
FOOTER = "Harbour Coffee | Board pre-read | Confidential"
USER_FILE = "Harbour Coffee FY26 review.pptx"


# What the `notations` deck says beside the user's deck: the figure in other words and in the notes, and longer numbers that hold its digits.
NOTATIONS = {"summary": "A kilo of coffee landed at £12.45 in FY26, against £12.4 the year before",
             "priorities": "Hold FY27 revenue above the £12.4 million of FY26",
             "notes": "Say that the flagship opened in the year revenue reached £12.4m."}


def build_user(work: Path, notations: bool = False) -> Path:
    """A user's deck of eight slides, written with python-pptx: placeholders, native charts and a native table."""
    from pptx import Presentation
    from pptx.chart.data import CategoryChartData
    from pptx.enum.chart import XL_CHART_TYPE
    from pptx.util import Inches, Pt
    from PIL import Image, ImageDraw

    work.mkdir(parents=True, exist_ok=True)
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    title_layout, bullets_layout, title_only = prs.slide_layouts[0], prs.slide_layouts[1], prs.slide_layouts[5]

    def footer(slide, number):
        slide.shapes.add_textbox(Inches(0.5), Inches(7.0), Inches(6), Inches(0.3)).text_frame.text = FOOTER
        slide.shapes.add_textbox(Inches(12.3), Inches(7.0), Inches(0.6), Inches(0.3)).text_frame.text = str(number)

    def bullets(title, lines, number, notes=None):
        slide = prs.slides.add_slide(bullets_layout)
        slide.shapes.title.text = title
        frame = slide.placeholders[1].text_frame
        for at, line in enumerate(lines):
            text, level = (line, 0) if isinstance(line, str) else line
            paragraph = frame.paragraphs[0] if at == 0 else frame.add_paragraph()
            paragraph.text, paragraph.level = text, level
        footer(slide, number)
        if notes:
            slide.notes_slide.notes_text_frame.text = notes

    cover = prs.slides.add_slide(title_layout)
    cover.shapes.title.text = "Harbour Coffee: FY26 review"
    cover.placeholders[1].text = "Board pre-read, March 2026"

    bullets("Summary", [
        "Revenue reached £12.4m in FY26, up 14% on FY25",
        "42 stores trade across four regions; the South grew fastest like for like at 9.4%",
        "Group margin held at 13.4% despite a 9.8% margin in London",
        "Wholesale is now 22% of sales, from 16% in FY22",
        "We recommend opening six stores in the South in FY27 and pausing London",
        *([NOTATIONS["summary"]] if notations else []),
    ], 2, notes="Open with the recommendation: six stores in the South, pause London.")

    chart_slide = prs.slides.add_slide(title_only)
    chart_slide.shapes.title.text = "Revenue by year"
    data = CategoryChartData()
    data.categories = REVENUE["categories"]
    data.add_series("Cafes", REVENUE["Cafes"])
    data.add_series("Wholesale", REVENUE["Wholesale"])
    chart_slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_STACKED, Inches(0.8), Inches(1.5), Inches(8), Inches(5), data)
    note = chart_slide.shapes.add_textbox(Inches(9.2), Inches(2), Inches(3.6), Inches(3))
    note.text_frame.text = "Revenue has doubled since FY22"
    note.text_frame.add_paragraph().text = "Wholesale grew from £1.2m to £2.7m"
    note.text_frame.add_paragraph().text = "Source: management accounts, FY22 to FY26"
    footer(chart_slide, 3)

    table_slide = prs.slides.add_slide(title_only)
    table_slide.shapes.title.text = "Store performance by region"
    table = table_slide.shapes.add_table(len(REGIONS), len(REGIONS[0]), Inches(0.8), Inches(1.6), Inches(11.5), Inches(3.6)).table
    for r, row in enumerate(REGIONS):
        for c, cell in enumerate(row):
            table.cell(r, c).text = cell
    comment = table_slide.shapes.add_textbox(Inches(0.8), Inches(5.6), Inches(11.5), Inches(1))
    comment.text_frame.text = "London has the fastest growth and the thinnest margin: rents took 31% of its revenue in FY26"
    footer(table_slide, 4)

    picture_slide = prs.slides.add_slide(title_only)
    picture_slide.shapes.title.text = "The Quayside flagship"
    image = Image.new("RGB", (800, 500), (62, 84, 96))
    draw = ImageDraw.Draw(image)
    draw.rectangle([60, 260, 740, 470], fill=(196, 164, 120))
    draw.rectangle([120, 120, 360, 260], fill=(230, 222, 204))
    image.save(work / "flagship.png")
    picture_slide.shapes.add_picture(str(work / "flagship.png"), Inches(0.8), Inches(1.5), width=Inches(6.4))
    words = picture_slide.shapes.add_textbox(Inches(7.6), Inches(1.6), Inches(5), Inches(4))
    words.text_frame.text = "Opened in March 2026 on the Quayside"
    words.text_frame.add_paragraph().text = "It took £41k a week in its first month, twice the estate average"
    words.text_frame.add_paragraph().text = "A third of its sales are after 5pm"
    footer(picture_slide, 5)
    if notations:
        picture_slide.notes_slide.notes_text_frame.text = NOTATIONS["notes"]

    bullets("Priorities for FY27", [
        "Open six stores in the South", ("Two each in Bristol, Bath and Exeter", 1), ("Payback inside 30 months at the South's 16.3% margin", 1),
        "Pause new stores in London", ("Renegotiate the three leases that end in FY27", 1),
        "Grow wholesale to a quarter of sales", ("Sign two regional grocers", 1),
        *([NOTATIONS["priorities"]] if notations else []),
    ], 6)

    pie_slide = prs.slides.add_slide(title_only)
    pie_slide.shapes.title.text = "Sales mix by channel"
    mix = CategoryChartData()
    mix.categories = CHANNELS["labels"]
    mix.add_series("Share of FY26 sales, %", CHANNELS["values"])
    pie_slide.shapes.add_chart(XL_CHART_TYPE.PIE, Inches(0.8), Inches(1.5), Inches(6), Inches(5), mix)
    aside = pie_slide.shapes.add_textbox(Inches(7.4), Inches(2), Inches(5), Inches(3))
    aside.text_frame.text = "Wholesale is 22% of sales"
    aside.text_frame.add_paragraph().text = "Delivery is the smallest channel at 10%"
    footer(pie_slide, 7)

    bullets("Next steps", [
        "Board approves the six-store plan for the South in April, on FY26 revenue of £12.4m",
        "Property team shortlists sites in Bristol, Bath and Exeter by June",
        "Finance reports the London lease options in May",
        "See slide 4 for the regional performance behind the plan",
    ], 8)

    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    for piece in paragraph.runs:
                        piece.font.size = piece.font.size or Pt(18)
    path = work / USER_FILE
    prs.save(path)
    return path


# The worked example's pages the `own` deck keeps: 22 analytical pages in four sections that meet every deck rule.
OWN_PAGES = ["p01", "s1", "p03b", "p04", "p06", "p06b", "p07c", "p08", "s2", "p09", "p12", "p13b", "p14", "s3", "p16", "p16b", "p17", "p19",
             "p20", "p22b", "s4", "p23", "p21", "p25", "p27", "p28"]


def build_own(work: Path) -> Path:
    """A deck this skill built, from the worked example: compiled and built in `work`, unrendered."""
    work.mkdir(parents=True, exist_ok=True)
    doc = json.loads((EXAMPLES / "page-types.pages.json").read_text(encoding="utf-8"))
    by_id = {page["id"]: page for page in doc["pages"]}
    shutil.copytree(EXAMPLES / "assets", work / "assets", dirs_exist_ok=True)
    (work / "northvale.pages.json").write_text(json.dumps({"deck": {**doc["deck"], "id": "northvale"}, "pages": [by_id[key] for key in OWN_PAGES]}, indent=1), encoding="utf-8")
    for command in ([NODE, RUNTIME / "author-deck.mjs", work / "northvale.pages.json"], [NODE, RUNTIME / "build-deck.mjs", work / "northvale.deck.json", work / "out", "--no-render"]):
        done = subprocess.run([str(part) for part in command], capture_output=True, text=True)
        if done.returncode != 0:
            raise RuntimeError(f"{' '.join(str(part) for part in command)} exited {done.returncode}:\n{done.stderr[-3000:]}")
    return work / "out" / "northvale.pptx"


def build_notations(work: Path) -> Path:
    return build_user(work, notations=True)


FIXTURES = {"user": build_user, "notations": build_notations, "own": build_own}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("work", type=Path)
    parser.add_argument("--fixture", choices=sorted(FIXTURES), action="append")
    args = parser.parse_args(argv)
    from pptx import Presentation
    for name in args.fixture or sorted(FIXTURES):
        pptx = FIXTURES[name](args.work / name)
        print(json.dumps({"fixture": name, "pptx": str(pptx), "slides": len(Presentation(str(pptx)).slides)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
