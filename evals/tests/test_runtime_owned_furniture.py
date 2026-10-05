"""What the runtime derives or draws as furniture, the runtime fits.

A fifty-page run was refused twelve times for `NOTE_HEAVY` on footers the
runtime itself had written from the source registry, once because such a
footer ran past three lines, once because the contents style its own variation
drew could not hold seven sections, and its copy was measured for
fragmentation with the runtime's tracker strip counted as a text block.

The principle these tests hold: a citation written from registry keys is
fitted by the runtime - to the footer's lines and to the words the footer has
room for under the note bar - so it is not what refuses a page; `NOTE_HEAVY`
counts the footer as drawn, whoever wrote it, exactly as it did before the
runtime wrote citations; the contents page takes the style its sections fit,
and a style the author named that cannot is refused where the deck is
authored; the tracker is not the author's text. No bar on author-written content
moves: a typed footer is still counted and still held to its lines, a note
beside a derived citation is counted in full, and the fragmentation band is
read on pages measured as the reference pages were - chart headings, legends,
axis rows and data labels counted, since the band counted them.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest import mock

from node_probe import ROOT, run_node

GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))
import density_profile  # noqa: E402
import gate_config  # noqa: E402
import render_gates  # noqa: E402

LONG = "Northvale Rail annual report and accounts for the financial year FY{n}, operating statistics annex"

CITE = '''
import fs from 'node:fs';
import { compileDeck, composeForAuthoring, sceneGateFindings, registryProblems } from './skills/professional-slides/runtime/author-deck.mjs';
import { pageBandsOf, NOTE_SHARE_MAX } from './skills/professional-slides/runtime/derive-content.mjs';
const dir = './skills/professional-slides/examples';
const example = JSON.parse(fs.readFileSync(dir + '/page-types.pages.json', 'utf8'));
const chart = example.pages.find((p) => p.type === 'trend' && p.form === 'line');
// A page with a long body, whose footer has room for a long citation: the line limit is what binds on it.
const wordy = example.pages.find((p) => p.type === 'profiles' && p.form === 'people');
async function page(source, sources, { base = chart, note } = {}) {
  const { spec } = compileDeck({ deck: { ...example.deck }, ...(sources ? { sources } : {}), pages: [{ ...base, source, ...(note ? { note } : {}) }] });
  const composed = await composeForAuthoring(spec, dir);
  const slide = composed.deck?.slides.find((s) => s.id === base.id);
  const node = slide?.nodes.find((n) => n.role === 'source-text');
  const gates = composed.deck ? sceneGateFindings(composed.deck, undefined, spec) : null;
  const budget = gates?.budget.find((b) => b.id === base.id);
  return { error: composed.error ?? null, pageErrors: composed.pageErrors ?? [], text: node?.text ?? null, lines: node?.data.textLayout.lines.length ?? null, derived: node?.data.derived === true,
    notes: slide?.notes ?? null, compiledSource: spec.slides[0].source, forms: spec.slides[0].sourceForms ?? null, bands: slide ? pageBandsOf(slide) : null, share: NOTE_SHARE_MAX,
    footer: budget?.footer, body: budget?.body, codes: gates ? [...gates.findings, ...gates.advisories].filter((f) => f.id === base.id).map((f) => f.code) : [] };
}
'''


def registry(n, short=False):
    return {f"s{i}": {"name": LONG.format(n=20 + i), "status": "company-reported", **({"short": f"Annual report FY{20 + i}"} if short else {})} for i in range(n)}


class DerivedCitationTests(unittest.TestCase):
    def probe(self, n, short=False, typed=None, wordy=False, note=None, sources=None):
        sources = registry(n, short) if sources is None else sources
        source = json.dumps(typed) if typed is not None else json.dumps(list(sources))
        options = "{ " + ("base: wordy, " if wordy else "") + (f"note: {json.dumps(note)}" if note else "") + " }"
        return run_node(CITE + f"console.log(JSON.stringify(await page({source}, {json.dumps(sources)}, {options})));")

    def assertWithinTheBar(self, result):
        self.assertNotIn("NOTE_HEAVY", result["codes"])
        self.assertLessEqual(result["footer"] / (result["footer"] + result["body"]), render_gates.NOTE_HEAVY_SHARE)

    def test_a_citation_that_fits_is_set_in_full(self):
        result = self.probe(2, wordy=True)
        self.assertEqual(result["pageErrors"], [])
        self.assertTrue(result["derived"])
        self.assertEqual(result["text"].replace("\n", " "), result["compiledSource"])
        self.assertIn("(company-reported)", result["text"])
        self.assertEqual(result["notes"], "")  # nothing was left out, so nothing is added to the notes
        self.assertWithinTheBar(result)

    def test_many_sources_are_fitted_and_never_refuse_the_page(self):
        # Eight long names run to five footer lines in full; before, the page
        # failed to compose ("Source exceeds three footer lines").
        result = self.probe(8, wordy=True)
        self.assertIsNone(result["error"])
        self.assertEqual(result["pageErrors"], [])
        self.assertLessEqual(result["lines"], 3)
        self.assertRegex(result["text"].replace("\n", " "), r"\+\d more in the notes$")
        self.assertTrue(result["text"].startswith("Sources: Northvale Rail annual report"))
        # Whatever the footer leaves out is kept whole in the speaker notes.
        for year in range(20, 28):
            self.assertIn(f"FY{year}", result["notes"])
        self.assertIn("(company-reported)", result["notes"])
        self.assertWithinTheBar(result)

    def test_short_names_are_used_before_sources_are_counted(self):
        result = self.probe(8, short=True, wordy=True)
        text = result["text"].replace("\n", " ")
        self.assertLessEqual(result["lines"], 3)
        self.assertNotIn("more in the notes", text)
        for year in range(20, 28):
            self.assertIn(f"Annual report FY{year}", text)
        self.assertIn("operating statistics annex", result["notes"])  # the full names stay in the notes
        self.assertWithinTheBar(result)

    def test_the_forms_run_from_fullest_to_the_count_alone(self):
        result = self.probe(4, short=True)
        forms = result["forms"]
        self.assertEqual(forms[0], result["compiledSource"])
        named = [form.count("FY2") for form in forms]
        self.assertEqual(named, sorted(named, reverse=True), forms)  # each form names no more sources than the one before
        self.assertIn("Annual report FY20 (company-reported)", forms[1])  # short names, statuses kept
        self.assertNotIn("(company-reported)", forms[2])                 # then the statuses dropped
        self.assertEqual(forms[-1], "Sources: 4 records, listed in the notes")

    def test_the_footer_as_drawn_counts_and_a_derived_citation_is_fitted_under_the_bar(self):
        # A chart page's body is some fifty words, so its footer has room for
        # about twenty. Eight long registry names would put far more there: the
        # runtime sets the fullest form of its own line that has room, and the
        # words it draws are counted like any others.
        derived = self.probe(8)
        typed = self.probe(0, typed="Source: " + "; ".join(LONG.format(n=20 + i) for i in range(4)))
        self.assertEqual(derived["body"], typed["body"])
        self.assertTrue(derived["derived"])
        drawn = len(derived["text"].split())
        self.assertGreater(drawn, 0)
        self.assertGreaterEqual(derived["footer"], drawn)  # the derived line is in the count
        self.assertEqual(derived["bands"]["footer"], derived["footer"])
        self.assertWithinTheBar(derived)
        for year in range(20, 28):  # and nothing it left out is lost
            self.assertIn(f"FY{year}", derived["notes"])
        self.assertIn("NOTE_HEAVY", typed["codes"])
        self.assertGreater(typed["footer"], 40)

    def test_the_fullest_form_with_room_is_the_one_drawn(self):
        # With short names the same page names as many sources as it has room
        # for before it counts the rest; every fuller form would pass the bar.
        result = self.probe(8, short=True)
        text = result["text"].replace("\n", " ")
        self.assertIn(text, result["forms"])
        self.assertIn("Annual report FY20", text)
        room = int(result["body"] * result["share"] / (1 - result["share"]) + 1e-9) - (result["footer"] - len(text.split()))
        self.assertLessEqual(len(text.split()), room)
        for fuller in result["forms"][:result["forms"].index(text)]:
            self.assertGreater(len(fuller.split()), room, fuller)
        self.assertWithinTheBar(result)

    def test_caveats_written_into_the_registry_are_not_drawn_past_the_bar(self):
        # Four caveats of fourteen to sixteen words as four registry names, and
        # six eight-word `short`s, each put fifty to seventy words in a footer
        # that was marked derived and not counted.
        caveats = ["Figures exclude the wholesale book and the two branches sold in March of this year",
                   "Liquidity is stated before the regulatory haircut which management estimates removes a fifth of liquid assets",
                   "Peer numbers are taken from unaudited half-year releases and restated to the calendar year by us",
                   "Every comparison on this page should therefore be read as indicative only and not as audited"]
        names = self.probe(0, sources={"report": {"name": "Northvale Rail annual report 2026"}, **{f"c{i}": {"name": text} for i, text in enumerate(caveats)}})
        words = " ".join(caveats).split()
        shorts = self.probe(0, sources={"report": {"name": "Northvale Rail annual report 2026"},
                                        **{f"s{i}": {"name": " ".join(words[i * 8:i * 8 + 8]), "short": " ".join(words[i * 8:i * 8 + 8])} for i in range(6)}})
        for result in (names, shorts):
            self.assertEqual(result["pageErrors"], [])
            self.assertWithinTheBar(result)
            self.assertLess(len(result["text"].split()), 30)
            self.assertNotIn("indicative only", result["text"])

    def test_a_note_beside_a_derived_citation_is_counted_and_not_shortened(self):
        # The runtime shortens only its own line: the citation falls back to
        # the count alone, the author's note is drawn whole, and the page is
        # still refused for the note.
        note = "Note: " + " ".join(["figures exclude the wholesale book and the branches sold in March;"] * 3)
        result = self.probe(2, note=note)
        self.assertEqual(result["text"], "Sources: 2 records, listed in the notes")
        self.assertIn("NOTE_HEAVY", result["codes"])
        self.assertGreaterEqual(result["footer"], len(note.split()))

    def test_a_typed_citation_past_three_lines_is_still_refused(self):
        typed = self.probe(0, typed="Source: " + "; ".join(LONG.format(n=20 + i) for i in range(8)))
        self.assertTrue(any("Source exceeds three footer lines" in message for message in typed["pageErrors"] + [typed["error"] or ""]))

    def test_the_registry_takes_a_short_name_and_names_the_source_it_refuses(self):
        result = run_node(CITE + '''
console.log(JSON.stringify({ ok: registryProblems({ a: { name: 'Annual report', short: 'AR', url: 'https://example.org', status: 'audited' } }),
  bad: registryProblems({ reports: { name: 'Annual report', short: 7 } }), unknown: registryProblems({ reports: { name: 'Annual report', publisher: 'x' } }),
  written: (() => { try { compileDeck({ deck: { ...example.deck }, sources: { a: { name: 'A' } }, pages: [{ ...chart, source: ['a'], sourceForms: ['x'] }] }); return null; } catch (error) { return error.message; } })() }));
''')
        self.assertEqual(result["ok"], [])
        self.assertEqual(result["bad"], ['source "reports": `short` is text'])
        self.assertIn("{ name, short, url, status }", result["unknown"][0])
        self.assertIn("written by the compiler", result["written"])

    def test_the_page_gate_counts_a_derived_source_like_a_typed_one(self):
        def slide(derived):
            source = {"type": "text", "role": "source-text", "text": "Source: " + " ".join(["word"] * 30), "data": {"derived": True} if derived else {}}
            return {"nodes": [{"type": "text", "role": "paragraph", "text": " ".join(["word"] * 42)}, source,
                              {"type": "text", "role": "footnote-text", "text": "Note: three words"}]}
        for derived in (False, True):
            body, footer, ratio = render_gates.footer_share(slide(derived))
            self.assertEqual((body, footer), (42, 34))
            self.assertGreater(ratio, render_gates.NOTE_HEAVY_SHARE)
            findings = []
            with mock.patch.object(render_gates, "body_floor", return_value=1):
                render_gates.gate_thin_page(1, slide(derived), findings)
            self.assertIn("NOTE_HEAVY", [f["code"] for f in findings])

    def test_the_runtime_counts_a_page_as_the_note_gate_does(self):
        # The fit reads the page with the gate's bands (derive-content.mjs
        # pageBandsOf, render_gates.page_bands): one count, held equal on every
        # page of the example deck.
        result = run_node(CITE + '''
const { spec } = compileDeck(example);
const composed = await composeForAuthoring(spec, dir);
console.log(JSON.stringify({ share: NOTE_SHARE_MAX, slides: composed.deck.slides.map((slide) => ({ nodes: slide.nodes.filter((n) => n.type === 'text'), bands: pageBandsOf(slide) })) }));
''')
        self.assertEqual(result["share"], render_gates.NOTE_HEAVY_SHARE)
        self.assertGreater(len(result["slides"]), 30)
        for slide in result["slides"]:
            bands = render_gates.page_bands(slide)
            self.assertEqual((slide["bands"]["body"], slide["bands"]["footer"], slide["bands"]["titleBand"]), (bands.body, bands.footer, bands.title_band))


CONTENTS = '''
import fs from 'node:fs';
import { compileDeck, composeForAuthoring } from './skills/professional-slides/runtime/author-deck.mjs';
import { variationChoices } from './skills/professional-slides/runtime/design-systems.mjs';
import { AGENDA_LIMITS } from './skills/professional-slides/runtime/panels.mjs';
const dir = './skills/professional-slides/examples';
const example = JSON.parse(fs.readFileSync(dir + '/page-types.pages.json', 'utf8'));
const chart = example.pages.find((p) => p.type === 'trend' && p.form === 'line');
// A variation seed whose draw sets the contents page in columns.
const columnsSeed = Array.from({ length: 200 }, (_, i) => `seed-${i}`).find((seed) => variationChoices(seed).agendaStyle === 'columns');
async function deck(sections, deckKeys = {}, summary = null) {
  const pages = Array.from({ length: sections }, (_, i) => [{ kind: 'section', id: `s${i}`, title: `Part ${i + 1}`, ...(summary ? { summary } : {}) }, { ...chart, id: `p${i}` }]).flat();
  const { spec, spineFindings } = compileDeck({ deck: { ...example.deck, workflow: undefined, rulesVersion: undefined, ...deckKeys }, pages });
  const composed = await composeForAuthoring(spec, dir);
  const agenda = composed.deck?.slides.find((s) => s.id === 'agenda-1');
  return { unfit: spineFindings.filter((f) => f.code === 'CONTENTS_UNFIT').map((f) => ({ severity: f.severity, measured: f.measured, repair: f.repair })),
    pageErrors: (composed.pageErrors ?? []).filter((m) => /agenda/.test(m)), error: composed.error ?? null,
    style: agenda?.componentInstances.find((c) => c.component === 'agenda')?.variant ?? null,
    details: agenda ? agenda.nodes.filter((n) => n.role === 'agenda-detail').length : null, labels: agenda ? agenda.nodes.filter((n) => n.role === 'agenda-label').length : null };
}
'''


class ContentsPageTests(unittest.TestCase):
    def test_a_drawn_style_gives_way_to_the_one_the_sections_fit(self):
        result = run_node(CONTENTS + '''
console.log(JSON.stringify({ seed: columnsSeed, limits: AGENDA_LIMITS, six: await deck(AGENDA_LIMITS.columns.max, { variation: columnsSeed }), seven: await deck(AGENDA_LIMITS.columns.max + 1, { variation: columnsSeed }) }));
''')
        self.assertTrue(result["seed"], "no variation seed draws the columned contents page")
        self.assertEqual(result["six"]["style"], "columns")
        # Seven sections under the same draw: the list, not a refusal at composition.
        self.assertEqual(result["seven"]["style"], "list")
        self.assertEqual(result["seven"]["pageErrors"], [])
        self.assertEqual(result["seven"]["unfit"], [])
        self.assertEqual(result["seven"]["labels"], result["limits"]["columns"]["max"] + 1)

    def test_a_named_style_that_cannot_fit_is_refused_at_compile(self):
        result = run_node(CONTENTS + '''
console.log(JSON.stringify({ limits: AGENDA_LIMITS, fits: await deck(AGENDA_LIMITS.columns.max, { agendaStyle: 'columns' }), over: await deck(AGENDA_LIMITS.columns.max + 1, { agendaStyle: 'columns' }),
  many: await deck(AGENDA_LIMITS.list.max + 1), most: await deck(AGENDA_LIMITS.list.max), hidden: await deck(AGENDA_LIMITS.list.max + 1, { contents: false }) }));
''')
        limits = result["limits"]
        self.assertEqual(result["fits"]["unfit"], [])
        self.assertEqual(result["fits"]["style"], "columns")  # the author's style wins where it fits
        [finding] = result["over"]["unfit"]
        self.assertEqual(finding["severity"], "blocker")
        self.assertEqual(finding["measured"], {"sections": limits["columns"]["max"] + 1, "style": "columns", "holds": [limits["columns"]["min"], limits["columns"]["max"]]})
        self.assertIn("Remove `agendaStyle`", finding["repair"])
        self.assertEqual(result["over"]["pageErrors"], [])  # and the page still composes, as the list
        # Past what any style holds, the deck is told so where it is authored.
        [finding] = result["many"]["unfit"]
        self.assertEqual(finding["measured"]["style"], "list")
        self.assertEqual(result["most"]["unfit"], [])
        self.assertEqual(result["hidden"]["unfit"], [])  # no contents page, nothing to hold

    def test_the_repair_applied_literally_clears_it(self):
        # "Remove `agendaStyle` - the runtime then sets the list".
        result = run_node(CONTENTS + '''
console.log(JSON.stringify({ removed: await deck(AGENDA_LIMITS.columns.max + 1, {}) }));
''')
        self.assertEqual(result["removed"]["unfit"], [])
        self.assertEqual(result["removed"]["style"], "list")
        self.assertEqual(result["removed"]["pageErrors"], [])

    def test_a_list_too_tall_with_its_summaries_drops_them_rather_than_failing(self):
        long = "A long summary of what this section covers, running to several lines so that ten of them cannot fit one page, and then some more words to be sure."
        result = run_node(CONTENTS + f'''
console.log(JSON.stringify({{ few: await deck(3, {{}}, {json.dumps(long)}), ten: await deck(10, {{}}, {json.dumps(long)}) }}));
''')
        self.assertEqual(result["few"]["details"], 3)
        self.assertEqual(result["ten"]["pageErrors"], [])
        self.assertEqual(result["ten"]["details"], 0)
        self.assertEqual(result["ten"]["labels"], 10)


def text(role, value, owner=None):
    return {"type": "text", "role": role, "text": value, "data": {"componentInstance": owner} if owner else {}}


class FurnitureTests(unittest.TestCase):
    """The fragmentation profile measures a page as the band was measured, less the runtime's tracker."""

    SLIDE = {"id": "p1", "componentInstances": [{"id": "chrome", "component": "slide-chrome"}, {"id": "p1-exhibit", "component": "chart.line"},
                                                 {"id": "p1-points", "component": "bullet-list"}],
             "nodes": [text("action-title", "Journeys recovered and then stalled"), text("tracker-number", "1"), text("tracker-number", "2"), text("tracker-number", "3"),
                       text("tracker-label", "Where ridership stands"),
                       text("section-heading", "Passenger journeys, fiscal years,", "p1:p1-exhibit"), text("chart-unit", "million", "p1:p1-exhibit"),
                       text("axis-label", "60"), text("axis-label", "40"), text("category-label", "FY24"), text("category-label", "FY25"), text("category-label", "FY26"),
                       text("legend-label", "Journeys"), text("data-label", "Peak 52.4"), text("annotation-text", "Growth slowed to under two percent", "p1:p1-exhibit"),
                       text("section-heading", "What the stall means", "p1:p1-points"), text("page-number", "07"), text("footer-right", "Northvale Rail")]}
    PAGE = "\n".join([
        "1 2 3", "", "Journeys recovered and then stalled", "",
        "Passenger journeys, fiscal years, million", "",
        "60                                         Peak 52.4",
        "40              Growth slowed to under two percent",
        "",
        "FY24      FY25      FY26", "", "Journeys", "",
        "What the stall means",
        "The peak is full on every line and the off-peak is half empty, so growth has",
        "to come between the peaks until the electric trains arrive.",
        "",
        "Northvale Rail                                         07", ""])

    def test_only_the_tracker_is_furniture(self):
        verdict = {(n["role"], n["text"]): gate_config.is_tracker(n) for n in self.SLIDE["nodes"]}
        for key in [("tracker-number", "1"), ("tracker-label", "Where ridership stands")]:
            self.assertTrue(verdict[key], key)
        # A chart's heading, unit, axes, labels and legend are counted, as they were on the reference pages the band was measured on;
        # so are the page's footer, a callout, a heading over the points, the title and a table's cells.
        for key in [("chart-unit", "million"), ("axis-label", "60"), ("category-label", "FY24"), ("legend-label", "Journeys"), ("data-label", "Peak 52.4"),
                    ("section-heading", "Passenger journeys, fiscal years,"), ("page-number", "07"), ("footer-right", "Northvale Rail"),
                    ("annotation-text", "Growth slowed to under two percent"), ("section-heading", "What the stall means"), ("action-title", "Journeys recovered and then stalled")]:
            self.assertFalse(verdict[key], key)
        self.assertFalse(gate_config.is_tracker(text("table-status-label", "At risk")))
        self.assertFalse(gate_config.is_tracker(text("table-cell-text", "14.6")))

    def test_a_page_is_measured_as_the_band_was_less_the_tracker(self):
        # The band (weight.json plan.textForm) was measured on reference PDFs with pdftotext, which reads a chart's heading
        # and its axis row as text like any other. Taking those out of our pages measured them against a band that had
        # counted them: the same copy read about ten words a block larger, and the floor was that much lower.
        header = density_profile.header_lines(self.SLIDE)
        plain = density_profile.page_blocks(self.PAGE, header)
        measured = density_profile.page_blocks(self.PAGE, header, density_profile.furniture_runs(self.SLIDE))
        # As pdftotext reads it: the tracker strip, the chart heading, the two rows of the plot, the category row, the commentary, the footer.
        self.assertEqual(plain, [3, 5, 10, 3, 30, 3])
        # Measured: the same blocks, less the tracker strip alone.
        self.assertEqual(measured, [5, 10, 3, 30, 3])

    def test_a_tracker_label_on_a_shared_line_is_taken_out_and_the_copy_kept(self):
        runs = density_profile.furniture_runs(self.SLIDE)
        self.assertEqual(density_profile.without_furniture("1 2 3", runs), "")
        self.assertEqual(density_profile.without_furniture("Where ridership stands", runs), "")
        self.assertEqual(density_profile.without_furniture("Where ridership stands                 Growth slowed to under two percent", runs), "Growth slowed to under two percent")
        # What a chart draws stays, and so does a bare number on a shared row, which could as well be an axis value.
        self.assertEqual(density_profile.without_furniture("FY24      FY25      FY26", runs), "FY24      FY25      FY26")
        self.assertEqual(density_profile.without_furniture("2              Growth slowed to under two percent", runs), "2              Growth slowed to under two percent")
        self.assertEqual(density_profile.without_furniture("In section 2 the peak was full", runs), "In section 2 the peak was full")

    def test_a_tracker_label_level_with_a_paragraph_does_not_cut_it(self):
        slide = {"id": "p", "componentInstances": [], "nodes": [text("tracker-label", "Demand")]}
        page = "\n".join(["Title", "", "The first line of a paragraph that runs", "                                              Demand", "on to its second line here.", ""])
        self.assertEqual(density_profile.page_blocks(page, {"Title"}, density_profile.furniture_runs(slide)), [14])

    def test_chart_scaffolding_counts_toward_the_measure_as_it_did_in_the_calibration(self):
        # Ten prose pages, each a chart whose heading and axis row pdftotext sets as two short blocks beside two developed points of
        # fifty words: 12, 6, 50 and 50 words a block, a page mean of 29.5, under the band's floor of 41.3. With the chart's
        # scaffolding left out the same pages read 50 words a block and passed.
        pages = 10
        chart = [text("section-heading", "Passenger journeys by fiscal year and by line, in millions of journeys", "x:ex"), text("category-label", "FY21"), text("category-label", "FY22"),
                 text("category-label", "FY23"), text("category-label", "FY24"), text("category-label", "FY25"), text("category-label", "FY26")]
        slides = [{"id": "cover", "componentInstances": [{"component": "cover"}], "nodes": []}] + [
            {"id": f"p{i}", "componentInstances": [{"id": "ex", "component": "chart.line"}], "nodes": [text("action-title", f"Title {i}"), *chart]} for i in range(pages)]
        content = {"pages": [{"id": f"p{i}", "textReference": {"task": "chart-with-commentary"}} for i in range(pages)]}
        page = "\n\n".join(["Title {i}", "Passenger journeys by fiscal year and by line, in millions of journeys", "FY21 FY22 FY23 FY24 FY25 FY26"] + [" ".join(["copy"] * 50)] * 2) + "\n"
        with mock.patch.object(density_profile, "extract", return_value=[""] + [page.format(i=i) for i in range(pages)]):
            report = density_profile.profile(Path("deck.pdf"), {"slides": slides}, content, None)
        self.assertEqual(report["pages"][0]["blockSizes"], [12, 6, 50, 50])
        self.assertEqual(report["deck"]["wordsPerBlock"]["measured"], 29.5)
        self.assertEqual([f["code"] for f in report["findings"]], ["TEXT_FRAGMENTED"])
        self.assertFalse(report["accepted"])

    def test_the_band_is_the_one_it_was_and_fragments_still_block(self):
        form = density_profile.TEXT_FORM["wordsPerBlock"]
        self.assertEqual((form["q1"], form["q3"]), (41.3, 86.5))
        pages = 10
        slides = [{"id": "cover", "componentInstances": [{"component": "cover"}], "nodes": []}] + [
            {"id": f"p{i}", "componentInstances": [{"component": "slide-chrome"}], "nodes": [text("action-title", f"Title {i}"), text("axis-label", "word")]} for i in range(pages)]
        content = {"pages": [{"id": f"p{i}", "textReference": {"task": "chart-with-commentary"}} for i in range(pages)]}
        fragment = "\n\n".join([f"Title {{i}}"] + [" ".join(["copy"] * 25)] * 5) + "\n"
        texts = [""] + [fragment.format(i=i) for i in range(pages)]
        with mock.patch.object(density_profile, "extract", return_value=texts):
            report = density_profile.profile(Path("deck.pdf"), {"slides": slides}, content, None)
        self.assertFalse(report["accepted"])
        self.assertEqual(report["findings"][0]["code"], "TEXT_FRAGMENTED")
        self.assertEqual(report["findings"][0]["threshold"], [41.3, 86.5])


if __name__ == "__main__":
    unittest.main()


class SharedShortNameTests(unittest.TestCase):
    def test_articles_of_one_publisher_are_named_once_in_the_short_forms(self):
        result = run_node('''
import { citationForms } from './skills/professional-slides/runtime/page-types.mjs';
const reg = { a: { name: 'Commercial Observer, first article (2026)', short: 'Commercial Observer' }, b: { name: 'Commercial Observer, second article (2026)', short: 'Commercial Observer' }, c: { name: 'Bisnow, an article', short: 'Bisnow' } };
console.log(JSON.stringify(citationForms(['a', 'b', 'c'], reg)));
''')
        self.assertIn("first article", result[0])        # the fullest form names each source
        self.assertIn("second article", result[0])
        self.assertEqual(result[1], "Sources: Commercial Observer; Bisnow")  # a short form says the publisher once
        self.assertEqual(result[-1], "Sources: 3 records, listed in the notes")
