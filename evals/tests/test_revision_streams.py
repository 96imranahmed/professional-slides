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
from judgement_oracle import answer_everything, reading_quantities

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

# What the benchmark deck's passages state, as a reader reads them.
QUANTITIES = [["network reached|clinics open|\"Total\"", "the network's clinics in FY26"], ["wholesale", "wholesale's share of sales"]]


def answered(work):
    """The revision in `work` with every question its compile asks answered: the numbers by the bench's reader."""
    _, done = answer_everything(NODE, work / "deck.pages.json", answer=reading_quantities(QUANTITIES))
    assert done.returncode == 0, done.stderr[-1500:]
    return work


PROBE = '''
import fs from 'node:fs';
import path from 'node:path';
import { authorDeck, readInsights } from './skills/professional-slides/runtime/author-deck.mjs';
import { readPagesFile } from './skills/professional-slides/runtime/pages-file.mjs';
import { loadJudgements, withJudgements } from './skills/professional-slides/runtime/judgements.mjs';
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
        between = last_json(done.stdout)["between"]
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
        between = [line for line in last_json(done.stdout)["between"] if line.startswith("NUMBERS_DISAGREE")]
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
        self.assertIn("WORDING_STALE [s02]", last_json(done.stdout)["advisories"])
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
const result = await withJudgements(await loadJudgements(dir, doc.deck?.id ?? 'deck'), () => authorDeck(doc, { baseDir: dir, insights, fit: false, fill: false }));
console.log(JSON.stringify([...result.blocking, ...result.advisories].filter((f) => f.code === 'NUMBER_STALE').map(brief)));
''')
        naming = [f for f in result if "s05" in f["pages"]]
        # The closing slide still says 158: found once, by the edit that names the old words, and not again from the composed page.
        self.assertEqual([(f["severity"], f["id"], f["pages"]) for f in naming], [("blocker", "s04", ["s04", "s05"])])
        self.assertIn('s05 still prints "158"', naming[0]["repair"])

        # With no text edit, the composed page's own change is what finds it: neither case falls between the two.
        work = answered(self.revise(lambda doc: self.compose(doc, NETWORK)))
        result = run_node(PROBE.replace("DIR", json.dumps(str(work))) + '''
const result = await withJudgements(await loadJudgements(dir, doc.deck?.id ?? 'deck'), () => authorDeck(doc, { baseDir: dir, insights, fit: false, fill: false }));
console.log(JSON.stringify([...result.blocking, ...result.advisories].filter((f) => f.code === 'NUMBER_STALE').map(brief)));
''')
        naming = [f for f in result if "s05" in f["pages"]]
        self.assertEqual([(f["severity"], f["pages"][0]) for f in naming], [("blocker", "s03")])
        self.assertIn("This revision changed 158 to 160 on s03", naming[0]["repair"])
        self.assertIn("`replace: [{ old, new }]` on a carried slide", naming[0]["repair"])


class ComposedPagesAloneTests(CarriedDeck):
    """On the benchmark's deck: what is read on the pages a revision composes, and what counts the slides it carries."""

    @staticmethod
    def donut(doc, values=(41, 27, 10, 22), **more):
        page = copy.deepcopy(DONUT)
        page["exhibit"]["values"] = list(values)
        page.update(more)
        doc["deck"]["density"] = "live-pitch"
        doc["pages"][next(at for at, old in enumerate(doc["pages"]) if old["id"] == "s07")] = page
        return page

    def test_a_number_changed_by_redrawing_a_page_is_found_on_the_carried_slide_that_still_states_it(self):
        def redraw(doc):
            page = self.donut(doc, values=(41, 27, 8, 24), title="Wholesale is now 24% of sales, three times delivery")
            page["points"] = ["Wholesale is 24% of sales, up from 16% in FY22, and it is the one channel that grows without a new lease",
                              "In store and takeaway together are 68% of sales, so the estate still carries the business",
                              "Delivery is the smallest channel at 8% and the only one that pays a commission to a platform"]
        work = answered(self.revise(redraw))
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 2)
        self.assertEqual([code for code, _ in self.refused(work)], ["NUMBER_STALE"])
        # The summary slide is carried, never compiled: what it states is the inventory's record of it.
        self.assertIn('s02 still states 22% - the same quantity, as a reader reads the two ("Wholesale is now 22% of sales")', done.stderr)

        def everywhere(doc):
            redraw(doc)
            self.page(doc, "s02")["replace"] = [{"old": "22%", "new": "24%"}]
        work = answered(self.revise(everywhere))
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 0, done.stderr[:1500])
        summary = last_json(done.stdout)
        self.assertFalse(any("NUMBER_STALE" in line for line in summary["advisories"]))
        # The delivery bars are held on the page the revision composed, and each line says the carried slides are not held to it.
        bars = [line for line in summary["standing"]["G"] if line.startswith("BAR_")]
        self.assertEqual(len(bars), 5)
        for line in bars:
            self.assertIn("read over the 1 page this revision composed; not held on the 7 slides it carries from the source deck", line)
        self.assertFalse(any(code.startswith("BAR_") for code in summary["revision"].get("notHeld", {})))
        # The share of exhibit kinds counts the slides carried, by what the inventory says each drew, and judges none of them.
        share = next(line for line in summary["standing"]["S"] if line.startswith("VARIETY_KIND_SHARE"))
        self.assertIn("chart.donut 1", share)
        self.assertIn("chart.stacked-column 1", share)
        self.assertIn("table 1", share)
        self.assertIn("2 of the deck's pages are kept as the source deck drew them, counted here and not judged", share)

    def test_findings_of_every_stream_are_judged_once_and_keep_their_order(self):
        def redraw(doc, version=None):
            page = self.donut(doc, values=(41, 27, 8, 24), title="Wholesale is now 24% of sales, three times delivery")
            # One thin point: the composed page answers for its own words too.
            page["points"] = ["Wholesale is 24% of sales"]
            if version:
                doc["deck"]["rulesVersion"] = version
        probe = '''
const result = await withJudgements(await loadJudgements(dir, doc.deck?.id ?? 'deck'), () => authorDeck(doc, { baseDir: dir, insights, fit: false, fill: false }));
console.log(JSON.stringify({ blocking: result.blocking.map((f) => [f.class, f.code]), stale: result.advisories.filter((f) => f.code === 'NUMBER_STALE').map(brief),
  notHeld: result.advisories.filter((f) => f.waived?.imported).map((f) => f.code) }));
'''
        now = run_node(PROBE.replace("DIR", json.dumps(str(answered(self.revise(redraw))))) + probe)
        classes = [cls for cls, _ in now["blocking"]]
        # Deck structure, then the page's own findings, then the aggregates: one order, whichever stream raised the finding.
        self.assertEqual(classes, sorted(classes, key="SPG".index))
        self.assertEqual(now["blocking"][0], ["S", "NUMBER_STALE"])
        self.assertIn("P", classes)
        # A rule that measures the deck is waived once, as the imported deck's; a build bar is not among them.
        self.assertTrue(now["notHeld"])
        self.assertFalse([code for code in now["notHeld"] if code.startswith("BAR_")])
        # Recorded under the rules before version 6, the same stale number still blocks: the rule judges only what this revision
        # changed, so no version excuses it (weight.json rules.always) - and a version below the import's is itself asked for its reason.
        older = run_node(PROBE.replace("DIR", json.dumps(str(answered(self.revise(lambda doc: redraw(doc, 5)))))) + probe)
        self.assertIn("NUMBER_STALE", [code for _, code in older["blocking"]])
        self.assertIn("REVISION_RULES_VERSION", [code for _, code in older["blocking"]])
        self.assertEqual(older["stale"], [])

    def test_a_proof_drawn_twice_is_reported_of_the_pages_the_revision_composed(self):
        def twice(doc):
            self.donut(doc)
            again = copy.deepcopy(DONUT)
            again.update(id="s07b", title="Delivery is the one channel that pays a platform for its sales")
            del again["sourceSlide"]
            doc["pages"].insert(next(at for at, page in enumerate(doc["pages"]) if page["id"] == "s07") + 1, again)
        work = self.revise(twice)
        result = run_node(PROBE.replace("DIR", json.dumps(str(work))) + '''
const result = await withJudgements(await loadJudgements(dir, doc.deck?.id ?? 'deck'), () => authorDeck(doc, { baseDir: dir, insights, fit: false, fill: false }));
console.log(JSON.stringify({ repeats: [...result.blocking, ...result.advisories].filter((f) => f.code === 'PROOF_REPEATS').map(brief), carried: result.spec.carried.map((c) => c.id) }));
''')
        self.assertEqual([(f["severity"], f["pages"]) for f in result["repeats"]], [("advisory", ["s07", "s07b"])])
        # No carried slide is named: its chart is the user's, and is never set beside a composed page as a repeated proof.
        self.assertFalse(set(result["carried"]) & {page for f in result["repeats"] for page in f["pages"]})

    def test_a_thin_composed_page_is_told_what_fills_it_and_no_carried_slide_is_measured(self):
        work = self.revise(lambda doc: self.donut(doc, points=["Wholesale is 22% of sales"]))
        result = run_node(PROBE.replace("DIR", json.dumps(str(work))) + '''
let composed = 0;
const result = await withJudgements(await loadJudgements(dir, doc.deck?.id ?? 'deck'), () => authorDeck(doc, { baseDir: dir, insights, fit: false }));
const filled = [...result.blocking, ...result.advisories].filter((f) => f.fills).map(brief);
console.log(JSON.stringify({ filled, composed: result.deck.slides.map((s) => s.sourceSlideId ?? s.id), carried: result.spec.carried.length }));
''')
        # The one page the runtime composed is measured, and told the length that fills it.
        self.assertEqual(result["composed"], ["s07"])
        self.assertEqual(result["carried"], 7)
        self.assertTrue(result["filled"], "the thin page was told nothing")
        self.assertEqual({f["id"] for f in result["filled"]}, {"s07"})
        self.assertTrue(any("words" in f["repair"] for f in result["filled"]))


# The one insight a composed page of the benchmark's deck brings for itself: the channel mix of slide 7, cited to a registry key.
CHANNEL_LOG = {"schema": "professional-slides.insights/v1", "insights": [{
    "id": "I1", "finding": "Wholesale is 22% of FY26 sales, more than twice delivery", "soWhat": "Wholesale is the channel that grows without a lease", "shape": "mix", "strength": "strong",
    "calculation": "channel sales over total sales", "sources": ["Harbour Coffee management accounts FY26"], "breadth": {"parts": 4},
    "measures": {"channel_share": {"unit": "%", "population": "FY26 sales", "period": "FY26", "members": ["In store", "Takeaway", "Delivery", "Wholesale"], "values": [41, 27, 10, 22], "cite": ["accounts"]}}}]}
ACCOUNTS = {"accounts": {"name": "Harbour Coffee management accounts FY26", "status": "company-reported"}}


class EvidenceAndFormOnACarryingRevisionTests(CarriedDeck):
    def bound(self, doc, page):
        """`page` given the channel log: its exhibit and its claim name the measure, and it keeps a typed source line."""
        doc["deck"]["density"] = "live-pitch"
        doc["sources"] = ACCOUNTS
        page["evidence"] = ["I1"]
        page["exhibit"]["basis"] = {"measures": ["I1/channel_share"], "role": "proof"}
        page["settles"] = {"kind": "share", "what": "Share of FY26 sales by channel", "measures": ["I1/channel_share"]}
        page["source"] = "Source: management accounts, FY22 to FY26"
        return page

    def logged(self, change):
        work = self.revise(change)
        (work / "deck.insights.json").write_text(json.dumps(CHANNEL_LOG))
        return work

    def test_a_page_composed_where_a_slide_stood_keeps_its_typed_source_line_and_an_added_page_does_not(self):
        # Redrawn in place under a source line the revision typed: slide 7 prints no such line, so it is the revision's own
        # and is refused as on a new deck. A page keeps only the line its slide already carried (test_revision_honest).
        def in_place(doc):
            doc["pages"][doc["pages"].index(self.page(doc, "s07"))] = self.bound(doc, copy.deepcopy(DONUT))
        work = self.logged(in_place)
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 2, done.stderr[:1500])
        self.assertIn(("SOURCE_UNCITED", "s07"), self.refused(work))

        # A page the revision adds has no slide's line to keep: it is the revision's own, and is held to the rule in full.
        def added(doc):
            page = self.bound(doc, copy.deepcopy(DONUT))
            page.update(id="mix", title="Wholesale is more than twice delivery, and grows without a lease")
            del page["sourceSlide"]
            doc["pages"].insert(doc["pages"].index(self.page(doc, "s07")) + 1, page)
        work = self.logged(added)
        done = self.author(work, "--check")
        self.assertEqual(done.returncode, 2)
        self.assertIn(("SOURCE_UNCITED", "mix"), self.refused(work))
        # Nothing is asked of a slide the revision carries: it is never compiled, so it has no citation to derive.
        self.assertEqual({page for _, page in self.refused(work)}, {"mix"})

    def test_a_page_the_revision_adds_is_planned_in_the_form_the_carried_slides_draw_and_they_are_counted_not_judged(self):
        def added(doc):
            doc["deck"]["density"] = "live-pitch"
            # The measure cites a registry key, which the bound exhibit will carry as its source: the plan compiles the page whole,
            # so the registry the full compile asks for is asked for here.
            doc["sources"] = {**doc.get("sources", {}), **ACCOUNTS}
            doc["pages"].insert(doc["pages"].index(self.page(doc, "s07")) + 1, {"id": "mix", "type": "composition", "evidence": ["I1"],
                "title": "Wholesale is more than twice delivery, and grows without a lease", "why": "Four channels of one year's sales are parts of a whole.",
                "settles": {"kind": "share", "what": "Share of FY26 sales by channel", "measures": ["I1/channel_share"]}})
        work = self.logged(added)
        done = self.author(work, "--plan")
        self.assertEqual(done.returncode, 0, done.stderr[:1500])
        plan = last_json(done.stdout)
        # Three forms carry the claim equally; the carried deck draws a pie (slide 7, as the inventory read it), so the new page is one.
        self.assertEqual(plan["plan"]["pages"], ["mix composition/pie/beside proposed"])
        self.assertEqual(plan["plan"]["fit"]["mix"]["by"], "convention")
        self.assertIn("pie chosen by the source deck's own way of drawing its like", done.stderr)
        # The carried slides' exhibits are counted in the share, by what each drew, and none of them is judged for its fit.
        share = next(line for line in plan["standing"]["S"] if line.startswith("VARIETY_KIND_SHARE"))
        self.assertIn("chart.pie 2, chart.stacked-column 1, table 1), of 4", share)
        self.assertIn("3 of the deck's pages are kept as the source deck drew them, counted here and not judged", share)
        unused = next(line for line in plan["standing"]["S"] if line.startswith("VARIETY_FIT_UNUSED"))
        self.assertIn("than another they could take 0;", unused)
        self.assertIn("3 of the deck's pages are kept as the source deck drew them, counted here and not judged", unused)
        # The plan is of the page the runtime composes: no carried slide is given a form.
        self.assertIn("Plan for deck.pages.json: 1 analytical pages", done.stderr)
        # Where the proposal stands is what the draft of it prints, carried slides counted the same way; and the page the
        # revision adds has no copy yet, so the plan prints the words-a-block rule and no number for it.
        self.assertIn("TEXT_FRAGMENTED is not read here: 1 of the 1 pages carry no copy yet", done.stderr)
        self.assertNotIn("estimated", plan["standing"])

        def taken(doc):
            added(doc)
            self.page(doc, "mix").update(form="pie", commentary="beside")
        work = self.logged(taken)
        planned = last_json(self.author(work, "--plan").stdout)["standing"]["S"]
        said = self.author(work, "--draft").stderr
        drafted = {line.strip().split(":")[0]: line.strip() for line in said[said.index("Where the deck stands"):].splitlines() if line.startswith("  ") and ": " in line}
        self.assertEqual([line for line in planned if drafted.get(line.split(":")[0]) != line], [])


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
import {{ revisionChanges, unheldLine }} from './skills/professional-slides/runtime/review-passes.mjs';
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
        doc = {"deck": {**self.authored["deck"], "id": "deck", "workflow": starter["deck"]["workflow"], "inventory": starter["deck"]["inventory"], "rulesVersion": starter["deck"]["rulesVersion"]}, "pages": pages}
        shutil.copytree(self.home / "own" / "assets", work / "assets", dirs_exist_ok=True)
        (work / "deck.pages.json").write_text(json.dumps(doc, indent=1))
        done = sh(NODE, RUNTIME / "author-deck.mjs", work / "deck.pages.json", "--draft")
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


@unittest.skipUnless(os.environ.get("PS_RUN_SLOW") == "1", "opt-in: set PS_RUN_SLOW=1 or pass --slow")
@unittest.skipUnless(NODE and HAS_PPTX and HAS_PILLOW and HAS_RENDERER, "needs Node.js, python-pptx, Pillow, LibreOffice (soffice) and pdftoppm")
class ReviewOfACarryingRevisionTests(unittest.TestCase):
    """The benchmark's exhibit swap, built: one page composed among seven carried slides, and what its review is shown and held to."""

    def test_the_floors_the_bars_and_the_post_review_pass_keep_to_the_page_the_revision_composed(self):
        with tempfile.TemporaryDirectory() as work:
            done = sh(NODE, BENCH / "run.mjs", "--task", "exhibit-swap", "--work", work)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr[-2000:])
            deck = Path(work) / "exhibit-swap"
            result = run_node(f"""
import fs from 'node:fs/promises'; import path from 'node:path';
import * as R from './skills/professional-slides/runtime/reviewer.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
import {{ deliverDeck }} from './skills/professional-slides/runtime/deliver-deck.mjs';
const dir = {json.dumps(str(deck))}, spec = path.join(dir, 'deck.deck.json'), out = path.join(dir, 'out');
const record = async () => JSON.parse(await fs.readFile(path.join(dir, '.reviews', 'deck', 'review-packet.json'), 'utf8'));
const pending = await deliverDeck(spec, out, {{ skipBuild: true, reviewer: 'packet' }});
const rec = await record();
const packet = JSON.parse(await fs.readFile(path.join(rec.staging, 'packet.json'), 'utf8'));
const ids = packet.slides.map((s) => s.id);
// The review sends the composed page's title back, in a finding that also names a slide the revision carried untouched.
// It lists a slide the revision did not change, so it says whose remedy it is: the changed page's own title can mend it (`aboutImported: false`), and it blocks.
const finding = {{ id: 'F1', scope: 'deck', slides: ['s02', 's07'], dimension: 'argument', code: 'UNSUPPORTED_CLAIM', severity: 'major', touches: ['title'], checkable: null, aboutImported: false,
  reason: 'The title of s07 says wholesale is more than twice delivery, and s02 still gives the mix without it.', repair: 'Rewrite the title of s07 to the one share the page shows, and state the same share on s02.' }};
const review = {{ pass: 1, verifies: null, accepted: false, summary: 'The changed page is sent back for its title.', rating: 6.5, binding: rec.binding, opened: ['s07'],
  provenance: {{ backend: 'subagent', model: 'fixture-reviewer', promptHash: rec.promptHash }},
  pages: [{{ slide: 's07', verdict: 'major', checks: Object.fromEntries(R.PAGE_DIMENSIONS.map((d) => [d, `checked ${{d}} on the page`])) }}], findings: [finding],
  completeness: R.DIMENSIONS.map((d) => d === 'argument' ? {{ dimension: d, result: 'findings', note: 'Filed the finding above.' }} : {{ dimension: d, result: 'clean', note: `Checked ${{d}} on the changed page and found nothing to raise.` }}),
  assessment: Object.fromEntries(R.ASSESSMENT_KEYS.map((k) => [k, `A sentence about ${{k}}.`])),
  density: {{ deck: 'The one composed page is the only page measured, and it is thin for its task.', pages: [{{ slide: 's07', verdict: 'too thin', reason: 'The page carries fewer words than its reading task asks for.' }}] }} }};
const file = path.join(dir, 'r1.json'); await fs.writeFile(file, JSON.stringify(review));
const rejected = await deliverDeck(spec, out, {{ skipBuild: true, reviewFile: file }});
const note = await fs.readFile(path.join(out, 'REJECTED.md'), 'utf8');
// With the composed page as it was there is nothing for a storyline pass to verify; once its title changes, one pass reads that page.
const idle = await S.prepareStoryline(spec, out);
const doc = JSON.parse(await fs.readFile(spec, 'utf8')), title = 'Wholesale is 22% of sales, the largest channel after the stores';
doc.slides = doc.slides.map((s) => (s.id === 's07' ? {{ ...s, title, pageType: {{ ...s.pageType, content: {{ ...s.pageType.content, claim: title }} }} }} : s));
await fs.writeFile(spec, JSON.stringify(doc));
const post = await S.prepareStoryline(spec, out);
const staged = JSON.parse(await fs.readFile(path.join(post.dir, 'packet.json'), 'utf8'));
// A later pass cannot file a finding on a carried slide alone.
const scope = {{ pass: 2, verifies: rec.binding, maxPasses: 3, mustInspect: ['s07'], changed: ['s07'], deleted: [], open: [], rejudge: [] }};
const alone = R.validateReview({{ pass: 2, verifies: rec.binding, accepted: false, summary: 'One slide of the deck as imported is weak.', rating: 7, binding: rec.binding, opened: ['s07'], pages: [], statuses: [],
  findings: [{{ ...finding, id: 'F9', scope: 'page', slides: ['s02'], basis: 'missed', justification: 'The earlier pass read only the changed page and so could not have seen this one.', evidence: 'Wholesale is now 22% of sales' }}] }}, ids, {{ scope, ledger: [], imported: ids.filter((id) => id !== 's07') }});
console.log(JSON.stringify({{ review: [pending.review.mode, pending.review.pages], carried: packet.slides.filter((s) => s.carried).map((s) => s.id), floors: Object.keys(packet.floors.pages), changed: packet.revision.changed,
  bars: [pending.bars.misses, pending.bars.notHeld], rejected: [rejected.rejectedAt, rejected.revision], imported: rejected.blockers.map((b) => [b.code, b.imported ?? null]),
  noted: note.includes("[About the imported deck: s02 is the user's page as imported, which this revision did not change."),
  idle: idle.status, post: [post.status, post.postReview], shown: staged.scope.postReview.findings.map((f) => f.pages), alone: alone.filter((e) => /as imported/.test(e)) }}));
""")
        carried = [f"s0{n}" for n in range(1, 9) if n != 7]
        # One review prompt, of the one page; the seven carried slides are context.
        self.assertEqual(result["review"], ["revision", 1])
        self.assertEqual(result["carried"], carried)
        self.assertEqual(result["changed"], ["s07"])
        # The floors a repair must stay inside are the composed page's: a carried slide is held to none, and is shown none.
        self.assertEqual(result["floors"], ["s07"])
        # Delivery read the build bars over the same page the compile did, refused nothing, and says where they are not held.
        self.assertEqual(result["bars"], [[], "read over the 1 page this revision composed; not held on the 7 slides it carries from the source deck, which are the user's own"])
        # The rejection says which of the finding's pages is the user's own; the post-review pass reads the composed page and no other.
        self.assertEqual(result["rejected"], ["review pass 1 of 3", {"changed": 1, "of": 8}])
        self.assertIn(["UNSUPPORTED_CLAIM", ["s02"]], result["imported"])
        self.assertTrue(result["noted"])
        self.assertEqual(result["idle"], "ready")
        self.assertEqual(result["post"], ["packet-written", {"reviewPass": 1, "pages": ["s07"]}])
        self.assertEqual(result["shown"], [["s07"]])
        self.assertEqual(len(result["alone"]), 1)
        self.assertIn("s02 is the user's page as imported, unchanged by this revision", result["alone"][0])


if __name__ == "__main__":
    unittest.main()
