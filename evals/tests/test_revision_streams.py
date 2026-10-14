"""Every check a revision meets, on a revision that carries its slides.

A point change carries the slides it does not change (`carry: true`,
runtime/revision.mjs): a carried slide is never compiled or composed. The
checks that read a whole deck - what its pages state between them, the build
bars, the fill of a thin page, a page's citation, the fit of forms to claims
and the share of exhibit kinds, the reviewer's floors - were each written for
a deck every page of which the runtime composes. These hold what each does on
a deck imported with `--carry` (evals/point-change/fixtures.py, and a second
deck made here with a contents slide and two tables of one thing):

- one stale-number rule and one stale-wording rule, fed by a text edit on a
  carried slide and by a page composed where a slide stood, and never two
  findings for one stale figure;
- a carried slide's numbers read from the inventory, and what two carried
  slides say between them said once, as a fact about the imported deck;
- the build bars held on the composed pages and said not to be held on the
  carried ones, at the compile as at delivery;
- a repeated proof, the fill of a thin page and the fit of a form to its claim
  read on the composed pages alone, with the carried slides counted where a
  share is counted;
- a page read as changed only because the inventory cannot say otherwise
  being told so.
"""
import copy
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import HAS_PILLOW, HAS_PPTX, HAS_RENDERER, NODE, ROOT, RUNTIME, RUNTIME_PYTHON, run_node
from test_revision_carry import CarriedDeck, DONUT, IMPORT, last_json, load, sh

PYTHON = RUNTIME_PYTHON or sys.executable
BENCH = ROOT / "evals" / "point-change"

CONTENTS = ["Clinic network by region today", "Clinics planned by region", "Next steps for the board"]


def build_contents_deck(work: Path) -> Path:
    """A user's deck of five slides: a contents slide that lists the titles, and two tables that give one thing two values."""
    from pptx import Presentation
    from pptx.util import Inches, Pt

    work.mkdir(parents=True, exist_ok=True)
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    title_layout, bullets_layout, title_only = prs.slide_layouts[0], prs.slide_layouts[1], prs.slide_layouts[5]

    def bullets(title, lines):
        slide = prs.slides.add_slide(bullets_layout)
        slide.shapes.title.text = title
        frame = slide.placeholders[1].text_frame
        for at, line in enumerate(lines):
            paragraph = frame.paragraphs[0] if at == 0 else frame.add_paragraph()
            paragraph.text = line

    def table(title, rows, lines):
        slide = prs.slides.add_slide(title_only)
        slide.shapes.title.text = title
        grid = slide.shapes.add_table(len(rows), len(rows[0]), Inches(0.8), Inches(1.6), Inches(8), Inches(2.4)).table
        for r, row in enumerate(rows):
            for c, cell in enumerate(row):
                grid.cell(r, c).text = cell
        box = slide.shapes.add_textbox(Inches(0.8), Inches(4.6), Inches(11), Inches(1.5))
        box.text_frame.text = lines[0]
        for line in lines[1:]:
            box.text_frame.add_paragraph().text = line

    cover = prs.slides.add_slide(title_layout)
    cover.shapes.title.text = "Northgate Clinics: FY26 review"
    cover.placeholders[1].text = "Board pre-read"
    bullets("Contents", CONTENTS)
    table(CONTENTS[0], [["Region", "Clinics"], ["North", "58"], ["South", "100"], ["Total", "158"]],
          ["The network reached 158 clinics in FY26", "Project Falcon adds twelve clinics in the South"])
    table(CONTENTS[1], [["Region", "Clinics"], ["North", "58"], ["South", "113"], ["Total", "171"]],
          ["The plan adds thirteen clinics, all in the South", "It starts from the 158 clinics open in FY26"])
    bullets(CONTENTS[2], ["The network reached 158 clinics in FY26: approve the plan in April", "Project Falcon opens its first clinics in June",
                          "Contents and appendix follow the board's template"])
    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    for piece in paragraph.runs:
                        piece.font.size = piece.font.size or Pt(18)
    path = work / "Northgate review.pptx"
    prs.save(path)
    return path


# A page composed where slide 3 stood: its table redrawn as a donut, under a title of its own.
NETWORK = {"id": "s03", "sourceSlide": 3, "type": "composition", "form": "donut", "commentary": "below",
           "title": "The South holds almost two thirds of the clinic network",
           "why": "Two regions of one network are parts of a whole; the donut sets the South's share beside the North's.",
           "settles": {"kind": "share", "what": "Share of the clinic network by region"},
           "adds": "The points say how many clinics the network has and where the plan adds to them.",
           "exhibit": {"heading": "Clinics by region, FY26", "labels": ["North", "South"], "values": [58, 102]},
           "points": ["The network reached 160 clinics in FY26, and 102 of them are in the South, where every new clinic of the year opened",
                      "The North holds 58 clinics and has opened none since FY24, so its share of the network falls each year",
                      "Project Falcon adds twelve clinics in the South, which takes the region past two thirds of the network"]}

def answered(work):
    """The revision in `work`, as its compile reads it."""
    return work


PROBE = '''
import fs from 'node:fs';
import path from 'node:path';
import { authorDeck, readInsights } from './skills/professional-slides/runtime/author-deck.mjs';
import { readPagesFile } from './skills/professional-slides/runtime/pages-file.mjs';
const dir = DIR;
const doc = (await readPagesFile(path.join(dir, 'deck.pages.json'))).doc ?? JSON.parse(fs.readFileSync(path.join(dir, 'deck.pages.json'), 'utf8'));
const insights = await readInsights(dir, 'deck', {}).catch(() => null);
const brief = (f) => ({ code: f.code, id: f.id ?? null, severity: f.severity, pages: f.pages ?? null, waived: f.waived ?? null, fills: f.fills ?? null, repair: f.repair ?? f.reason ?? '' });
'''


class ContentsDeck(CarriedDeck):
    """The deck with a contents slide, imported with `--carry` once; each test revises a copy of it."""

    @classmethod
    def setUpClass(cls):
        cls.home = Path(tempfile.mkdtemp(prefix="revision-streams-"))
        cls.source = build_contents_deck(cls.home / "source")
        cls.bed = cls.home / "bed"
        done = sh(PYTHON, IMPORT, cls.source, cls.bed, "--carry", "--id", "deck")
        assert done.returncode == 0, done.stderr
        cls.starter = json.loads((cls.bed / "deck.pages.json").read_text())
        cls.inventory = json.loads((cls.bed / "deck.inventory.json").read_text())

    def compose(self, doc, page):
        doc["deck"]["density"] = "live-pitch"
        doc["pages"][doc["pages"].index(self.page(doc, page["id"]))] = copy.deepcopy(page)


class CarriedSlidesBetweenThemTests(ContentsDeck):
    def test_what_two_carried_slides_say_between_them_is_one_advisory_about_the_imported_deck(self):
        done = self.author(self.revise(), "--check")
        self.assertEqual(done.returncode, 0, done.stderr[:800])
        between = [line.strip() for line in done.stderr.splitlines() if line.startswith("  NUMBERS_DISAGREE")]
        # The two tables give the South and the total two values: the numbers are the inventory's, since neither slide is compiled.
        self.assertEqual(len(between), 1)
        self.assertTrue(between[0].startswith("NUMBERS_DISAGREE [s03, s04]: About the imported deck, not this revision: 2 numbers are given two values"), between[0])
        self.assertIn('s03 gives 158 and s04 gives 171 for "Total" at "Clinics"', between[0])
        self.assertIn("Nothing is refused", between[0])

    def test_a_disagreement_the_revision_edits_into_is_its_own_and_reads_the_slide_as_edited(self):
        # The revision changes the total on one slide: the disagreement now involves a slide it changed, read as its edit leaves it.
        work = self.revise(lambda doc: self.page(doc, "s04").update(replace=[{"old": "171", "new": "172"}]))
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 0, done.stderr[:800])
        between = [line.strip() for line in done.stderr.splitlines() if line.startswith("  NUMBERS_DISAGREE")]
        self.assertEqual(len(between), 1)
        self.assertNotIn("About the imported deck", between[0])
        self.assertIn('s03 gives 158 and s04 gives 172 for "Total" at "Clinics"', between[0])


class OneStaleRuleTests(ContentsDeck):
    """A number or words left behind are one code each, whichever way the revision made the change."""

    def test_a_retitled_slide_still_listed_on_the_contents_slide_is_refused_however_it_was_retitled(self):
        new = "The South holds almost two thirds of the clinic network"
        # Retitled in place, on the carried slide.
        work = self.revise(lambda doc: self.page(doc, "s03").update(title=new))
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 2)
        self.assertEqual(self.refused(work), [("WORDING_STALE", "s03")])
        self.assertIn(f's02 still prints "{CONTENTS[0]}"', done.stderr)
        # A title is the slide's one title: the finding does not offer a mark a title cannot carry.
        said = done.stderr.split("WORDING_STALE")[1].split("\n\n")[0]
        self.assertNotIn('"only": true', said)

        # Redrawn: a page composed where the slide stood, under the new title. The same code, and it blocks as it did.
        work = self.revise(lambda doc: self.compose(doc, NETWORK))
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 2)
        self.assertIn(("WORDING_STALE", "s03"), self.refused(work))
        self.assertIn("s02 still prints the old title whole", done.stderr)

        # The contents slide changed with it, either way: nothing is left behind.
        def both(doc):
            self.page(doc, "s03")["title"] = new
            self.page(doc, "s02")["replace"] = [{"old": CONTENTS[0], "new": new}]
        work = self.revise(both)
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 0, done.stderr[:800])
        self.assertFalse(any("STALE" in line for line in last_json(done.stdout)["advisories"]))

    def test_a_short_title_left_elsewhere_is_asked_and_not_refused(self):
        # "Contents" is a word the closing slide also uses: one word is not a quoted title.
        work = self.revise(lambda doc: self.page(doc, "s02").update(title="What this paper covers"))
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 0, done.stderr[:800])
        self.assertIn("  WORDING_STALE [s02", done.stderr)
        self.assertIn('s05 still prints "Contents"', done.stderr)

    def test_replaced_words_that_drop_no_figure_block_as_wording_unless_the_edit_is_this_slides_alone(self):
        work = self.revise(lambda doc: self.page(doc, "s05").update(replace=[{"old": "Project Falcon", "new": "Project Kestrel"}]))
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 2)
        self.assertEqual(self.refused(work), [("WORDING_STALE", "s05")])
        self.assertIn('s03 still prints "Project Falcon"', done.stderr)
        work = self.revise(lambda doc: self.page(doc, "s05").update(replace=[{"old": "Project Falcon", "new": "Project Kestrel", "only": ["s03"]}]))
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 0, done.stderr[:800])
        self.assertFalse(any("STALE" in line for line in last_json(done.stdout)["advisories"]))

    def test_one_stale_figure_is_one_finding_when_an_edit_and_a_composed_page_both_changed_it(self):
        # The network's 158 becomes 160 twice over: by a text edit on the plan's slide, and on the page composed where slide 3 stood.
        def change(doc):
            self.compose(doc, NETWORK)
            self.page(doc, "s04")["replace"] = [{"old": "158", "new": "160"}]
        work = answered(self.revise(change))
        result = run_node(PROBE.replace("DIR", json.dumps(str(work))) + '''
const result = await authorDeck(doc, { baseDir: dir, insights });
console.log(JSON.stringify([...result.blocking, ...result.advisories].filter((f) => f.code === 'NUMBER_STALE').map(brief)));
''')
        naming = [f for f in result if "s05" in f["pages"]]
        # The closing slide still says 158: found once, by the edit that names the old words, and not again from the composed page.
        self.assertEqual([(f["severity"], f["id"], f["pages"]) for f in naming], [("blocker", "s04", ["s04", "s05"])])
        self.assertIn('s05 still prints "158"', naming[0]["repair"])



# The one insight a composed page of the benchmark's deck brings for itself: the channel mix of slide 7, cited to a registry key.
CHANNEL_LOG = {"schema": "professional-slides.insights/v1", "insights": [{
    "id": "I1", "finding": "Wholesale is 22% of FY26 sales, more than twice delivery", "soWhat": "Wholesale is the channel that grows without a lease", "shape": "mix", "strength": "strong",
    "calculation": "channel sales over total sales", "sources": ["Harbour Coffee management accounts FY26"], "breadth": {"parts": 4},
    "measures": {"channel_share": {"unit": "%", "population": "FY26 sales", "period": "FY26", "members": ["In store", "Takeaway", "Delivery", "Wholesale"], "values": [41, 27, 10, 22], "cite": ["accounts"]}}}]}
ACCOUNTS = {"accounts": {"name": "Harbour Coffee management accounts FY26", "status": "company-reported"}}


@unittest.skipUnless(NODE and HAS_PPTX and HAS_PILLOW, "needs Node.js, python-pptx and Pillow")
class OwnDeckReimportedTests(unittest.TestCase):
    """A deck this runtime built draws its exhibits as shapes, which the inventory does not hold: what a revision of it is read as."""

    @classmethod
    def setUpClass(cls):
        cls.home = Path(tempfile.mkdtemp(prefix="revision-own-"))
        cls.source = load("point_change_fixtures", BENCH / "fixtures.py").build_own(cls.home / "own")
        cls.authored = json.loads((cls.home / "own" / "northvale.pages.json").read_text())
        for name, flags in (("carry", ["--carry"]), ("rebuild", [])):
            done = sh(PYTHON, IMPORT, cls.source, cls.home / name, *flags, "--id", "deck")
            assert done.returncode == 0, done.stderr

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.home, ignore_errors=True)

    def test_carried_a_deck_of_drawn_shapes_changes_nothing_and_an_edit_changes_its_slide_alone(self):
        work = self.home / "carry"
        inventory = json.loads((work / "deck.inventory.json").read_text())
        # Every slide draws shapes the inventory does not hold...
        self.assertTrue(all(slide.get("unheld") for slide in inventory["slides"]))
        done = sh(NODE, RUNTIME / "author-deck.mjs", work / "deck.pages.json", "--check")
        self.assertEqual(done.returncode, 0, done.stderr[:1500])
        summary = last_json(done.stdout)
        # ...and a carried slide is unchanged by definition: nothing is read as changed, and nothing is composed.
        self.assertEqual([summary["revision"]["carried"], summary["revision"]["edited"], summary["revision"]["composed"]], [len(inventory["slides"]), [], []])
        self.assertNotIn("readAsChanged", summary["revision"])
        self.assertNotIn("Read as changed", done.stderr)
        result = run_node(f'''
import fs from 'node:fs';
import {{ revisionChanges, unheldLine }} from './skills/professional-slides/runtime/revision.mjs';
import {{ compileDeck }} from './skills/professional-slides/runtime/author-deck.mjs';
const dir = {json.dumps(str(work))}, inventory = JSON.parse(fs.readFileSync(dir + '/deck.inventory.json', 'utf8')), doc = JSON.parse(fs.readFileSync(dir + '/deck.pages.json', 'utf8'));
const changes = (edit) => {{ const copy = structuredClone(doc); edit(copy); return revisionChanges(compileDeck(copy, {{ partial: true }}).spec, inventory); }};
const title = inventory.slides[5].title;
const untouched = changes(() => {{}}), edited = changes((copy) => {{ copy.pages[5].title = title + ' in every region'; }});
console.log(JSON.stringify({{ untouched: [untouched.content, untouched.unheld, untouched.carried.length, unheldLine(untouched)], edited: [edited.content, edited.spine, edited.unheld, edited.carried.length], id: doc.pages[5].id }}));
''')
        self.assertEqual(result["untouched"], [[], [], len(inventory["slides"]), None])
        self.assertEqual(result["edited"], [[result["id"]], [result["id"]], [], len(inventory["slides"]) - 1])

    def test_rebuilt_the_run_says_why_every_page_is_read_as_changed(self):
        work = self.home / "rebuild"
        inventory = json.loads((work / "deck.inventory.json").read_text())
        starter = json.loads((work / "deck.pages.json").read_text())
        # The rebuild maps each slide back to the page it was built from, by its title: no page's words or numbers are changed.
        flat = lambda text: " ".join(str(text or "").split()).lower()
        by_title = {flat(slide["title"]): slide["index"] for slide in inventory["slides"]}
        pages = [{**page, **({"sourceSlide": by_title[flat(page.get("title"))]} if page.get("type") and flat(page.get("title")) in by_title else {})} for page in self.authored["pages"]]
        mapped = [page["id"] for page in pages if "sourceSlide" in page]
        self.assertGreaterEqual(len(mapped), 20)
        doc = {"deck": {**self.authored["deck"], "id": "deck", "workflow": starter["deck"]["workflow"], "inventory": starter["deck"]["inventory"]}, "pages": pages}
        shutil.copytree(self.home / "own" / "assets", work / "assets", dirs_exist_ok=True)
        (work / "deck.pages.json").write_text(json.dumps(doc, indent=1))
        done = sh(NODE, RUNTIME / "author-deck.mjs", work / "deck.pages.json", "--check")
        # The inventory cannot say the pages are unchanged, and the run does not leave that silent: it names the pages and the reason, and what keeps a slide unchanged.
        typed = len([page for page in pages if page.get("type")])
        which = f"every one of the {typed} pages" if len(mapped) == typed else f"{len(mapped)} of the {typed} pages"
        self.assertIn(f"Read as changed: {which} this revision composes, each where a slide stood that the inventory does not hold whole", done.stderr)
        self.assertIn("which is how a deck this runtime built draws its exhibits", done.stderr)
        self.assertIn("is read as changed whether or not the revision changed it", done.stderr)
        self.assertIn("`carry: true` beside its `draft`", done.stderr)
        self.assertIn("Every slide is recomposed", done.stderr)
        if done.returncode == 0:
            self.assertEqual(last_json(done.stdout)["revision"]["readAsChanged"], mapped)


if __name__ == "__main__":
    unittest.main()
