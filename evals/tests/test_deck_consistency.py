"""What the deck's pages say between them is checked as data (gates/consistency_gates.mjs).

A review of a rendered deck found, by reading, what the runtime held the
numbers to find first: two counts of one estate that disagreed between neighbouring
pages, one entity's count differing across ten pages with no note, and two
pages plotting the same series on the same frame. These hold the checks: a
number two pages state of one measure agrees, or the finding names both pages
and both records; a page that shows nothing its neighbour did not is named
with it, and blocks only where the two are one page twice; and a revision -
which usually has no insight log - is read against the deck it was imported
from, so a number it changes on one page and leaves standing on another is
found from the inventory and the changed pages alone.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, RUNTIME_PYTHON, requires_python_package, run_node

PYTHON = RUNTIME_PYTHON or sys.executable
FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"

LOG = '''
import { consistencyFindings } from './skills/professional-slides/runtime/gates/consistency_gates.mjs';
import { compileDeck, authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
import { dependencyNotes } from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
import { applyRulesVersion } from './skills/professional-slides/runtime/weight.mjs';
const NETWORKS = ['Aster', 'Boreal', 'Cinder', 'Dune', 'Ember', 'Fjord', 'Gale', 'Heron'];
const FY = ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'];
const graded = { finding: 'a finding', calculation: 'a calculation', soWhat: 'It bears on the decision at hand', strength: 'strong', sources: ['sources/a.csv'] };
const items = [
  { ...graded, id: 'i1', shape: 'peer-set', measures: { sites: { unit: 'clinics', population: 'Eight networks', period: 'September 2026', members: NETWORKS, values: [312, 284, 171, 12, 77, 95, 131, 88] } } },
  // The same networks as each reports itself: one number differs.
  { ...graded, id: 'i2', shape: 'peer-set', sources: ['sources/networks.csv'], measures: { clinics_reported: { unit: 'clinics', population: 'Eight networks, as each reports', period: 'latest reported', members: NETWORKS, values: [312, 305, 171, 12, 77, 95, 131, 88] } } },
  // One network's own count, a year older.
  { ...graded, id: 'i3', shape: 'point', measures: { cinder_clinics: { unit: 'clinics', population: 'Cinder, sites (about)', period: 'September 2025', value: 158 } } },
  { ...graded, id: 'i4', shape: 'series', measures: { visits: { unit: 'visits m', population: 'Aster', periods: FY, values: [31.4, 33.8, 24.1, 29.7, 38.5, 44.2, 47.32, 48.6] },
      rival: { unit: 'visits m', population: 'Boreal', periods: FY, values: [18.2, 19.9, 14.6, 17.3, 22.8, 27.5, 30.4, 29.1] }, test: { unit: 'visits m', population: 'the plan', period: 'FY26', value: 50, standard: true } } },
  // The first record again, one number changed: one measure recorded twice.
  { ...graded, id: 'i5', shape: 'peer-set', cite: ['tables'], measures: { sites: { unit: 'clinics', population: 'Eight networks', period: 'September 2026', members: NETWORKS, values: [312, 284, 176, 12, 77, 95, 131, 88] } } },
];
const insights = new Map(items.map((i) => [i.id, i]));
const rank = (id, measure, more = {}) => ({ id, type: 'ranking', form: 'bar', commentary: 'so-what-bar', why: 'The whole set on one measure, the subject marked', evidence: [measure.split('/')[0]],
  title: `Aster runs the largest estate of the eight networks, page ${id}`, bar: 'The estate gap is what the entrant has to close before it can match the coverage',
  settles: { kind: 'rank', what: 'clinics open', measures: [measure] }, exhibit: { heading: 'Clinics open', series: [{ measure, name: 'Sites' }], highlights: [{ category: 'Aster' }] }, ...more });
const trend = (id, series, more = {}) => ({ id, type: 'trend', form: 'line', commentary: 'so-what-bar', why: 'The movement over time is the claim, so the series is drawn', evidence: ['i4'],
  title: `Aster saw more visits every year, page ${id}`, bar: 'The growth has slowed to a crawl, which is what the plan has to explain first',
  settles: { kind: 'rate', what: 'visits a year', measures: series.map((s) => s.measure) }, exhibit: { heading: 'Visits', series, highlights: [{ category: 'FY26' }] }, ...more });
const table = (id, rows) => ({ id, type: 'lookup', form: 'table', commentary: 'none', why: 'Measures a reader looks up and compares', evidence: ['i1'], title: `Eight networks by the clinics each has open, page ${id}`,
  settles: { kind: 'count', what: 'clinics open', measures: ['i1/sites'] }, exhibit: { type: 'table', columns: ['Network', 'Sites'], rows, basis: { measures: ['i1/sites'], role: 'proof' } } });
const brief = (list) => list.map((f) => ({ code: f.code, severity: f.severity, pages: f.pages, rule: f.rule ?? null, measured: f.measured ?? null, repair: f.repair }));
const find = (pages, options = {}, log = insights, deck = {}) => brief(consistencyFindings({ deck: { workflow: 'new_deck', ...deck }, pages }, log, options));
const both = [{ measure: 'i4/visits', name: 'Aster' }, { measure: 'i4/rival', name: 'Boreal' }];
const DECK = { schema: 'professional-slides.deck/v3', id: 'probe', workflow: 'new_deck', request: 'How have visits moved?' };
const repeats = (pages, deck = {}, options = {}) => { const compiled = compileDeck({ deck: { ...DECK, ...deck }, pages }, { insights, partial: true });
  return { errors: compiled.compileErrors, found: brief(applyRulesVersion(consistencyFindings({ deck: { ...DECK, ...deck }, pages }, insights, { spec: compiled.spec, ...options }), { ...DECK, ...deck }).filter((f) => f.code === 'PROOF_REPEATS')) }; };
'''


class NumbersAgreeTests(unittest.TestCase):
    def test_two_records_of_one_measure_stated_on_two_pages_block_with_both_pages_and_both_records(self):
        result = run_node(LOG + '''
console.log(JSON.stringify({ conflict: find([rank('p1', 'i1/sites'), rank('p2', 'i5/sites')]), alone: find([rank('p1', 'i1/sites')]) }));
''')
        self.assertEqual(result["alone"], [])
        self.assertEqual(len(result["conflict"]), 1, result["conflict"])
        finding = result["conflict"][0]
        self.assertEqual([finding["code"], finding["severity"], finding["pages"]], ["NUMBERS_DISAGREE", "blocker", ["p1", "p2"]])
        self.assertEqual(finding["measured"]["measures"], ["i1/sites", "i5/sites"])
        self.assertEqual(finding["measured"]["values"], [171, 176])
        # Both pages and both sources: the citation a record carries, or the files behind it.
        self.assertEqual(finding["measured"]["sources"], [["sources/a.csv"], ["tables"]])
        self.assertIn("p1 states 171 (i1/sites@Cinder, from sources/a.csv) and p2 states 176 (i5/sites@Cinder, from tables) for one measure", finding["repair"])

    def test_one_quantity_under_two_measures_is_reported_with_both_pages_and_never_refused(self):
        result = run_node(LOG + '''
const strip = (id, metrics) => ({ ...rank(id, 'i1/sites', { evidence: ['i1', 'i3'] }), type: 'numbers', form: 'metric-strip', commentary: 'none', bar: undefined, metrics,
  exhibit: { heading: 'Clinics open', series: [{ measure: 'i1/sites', name: 'Sites' }], select: { members: ['Aster', 'Boreal', 'Dune', 'Ember'] } } });
console.log(JSON.stringify({
  // Two measures over the same members that agree at seven of eight: one measure recorded twice.
  twin: find([rank('p1', 'i1/sites'), rank('p2', 'i2/clinics_reported')]),
  // A page that prints both numbers has reconciled them, and the pair is left alone.
  reconciled: find([rank('p1', 'i1/sites', { subtitle: 'Estate tables; Boreal reports 305 clinics itself' }), rank('p2', 'i2/clinics_reported')]),
  // An entity's own record against its row in the peer set, by a bound figure and by a count typed in a sentence.
  entity: find([rank('p1', 'i1/sites'), strip('p3', [{ measure: 'i3/cinder_clinics', format: '0', label: 'Cinder clinics' }, { measure: 'i1/sites@Aster', format: '0', label: 'Aster clinics' }])]),
  counted: find([rank('p1', 'i1/sites'), { ...strip('p3', [{ measure: 'i1/sites@Aster', format: '0', label: 'Aster clinics' }, { measure: 'i1/sites@Boreal', format: '0', label: 'Boreal clinics' }]), note: 'Cinder ran about 158 clinics a year earlier.' }]),
  // A bare count with no unit states nothing: it is a name or a count as often as a measurement.
  bare: find([rank('p1', 'i1/sites'), { ...strip('p3', [{ measure: 'i1/sites@Aster', format: '0', label: 'Aster clinics' }, { measure: 'i1/sites@Boreal', format: '0', label: 'Boreal clinics' }]), note: 'Room 158 was the first to reopen.' }]) }));
''')
        twin = result["twin"]
        self.assertEqual([[f["code"], f["severity"], f["pages"]] for f in twin], [["NUMBERS_DISAGREE", "advisory", ["p1", "p2"]]])
        self.assertEqual(twin[0]["measured"], {"kind": "twin", "cells": ["i1/sites@Boreal", "i2/clinics_reported@Boreal"], "values": [284, 305], "sources": [["sources/a.csv"], ["sources/networks.csv"]]})
        self.assertIn("p1 states 284 (i1/sites@Boreal, September 2026, from sources/a.csv) and p2 states 305 (i2/clinics_reported@Boreal, latest reported, from sources/networks.csv)", twin[0]["repair"])
        self.assertEqual(result["reconciled"], [])
        for case in ("entity", "counted"):
            with self.subTest(case=case):
                found = result[case]
                self.assertEqual([[f["code"], f["severity"], f["pages"]] for f in found], [["NUMBERS_DISAGREE", "advisory", ["p3", "p1"]]], found)
                self.assertEqual(found[0]["measured"]["values"], [158, 171])
                self.assertIn("one quantity for Cinder", found[0]["repair"])
        self.assertEqual(result["bare"], [])

    def test_a_typed_table_that_gives_another_number_for_the_measure_another_page_draws_blocks(self):
        result = run_node(LOG + '''
const rows = (cinder) => [['Aster', '312'], ['Boreal', '284'], ['Cinder', cinder], ['Dune', '12']];
console.log(JSON.stringify({ apart: find([rank('p1', 'i1/sites'), table('p2', rows('166'))]), same: find([rank('p1', 'i1/sites'), table('p2', rows('171'))]),
  // With no measure named the names are all that says two exhibits show one thing: advised, never refused.
  loose: find([{ ...rank('p1', 'i1/sites'), evidence: undefined, exhibit: { heading: 'Clinics', unit: 'clinics', categories: NETWORKS, series: [{ name: 'Sites', values: [312, 284, 171, 12, 77, 95, 131, 88] }] } },
    { ...rank('p2', 'i1/sites'), evidence: undefined, exhibit: { heading: 'Clinics', unit: 'clinics', categories: NETWORKS, series: [{ name: 'Sites', values: [312, 284, 166, 12, 77, 95, 131, 88] }] } }], {}, null) }));
''')
        self.assertEqual(result["same"], [])
        self.assertEqual([[f["code"], f["severity"], f["pages"]] for f in result["apart"]], [["NUMBERS_DISAGREE", "blocker", ["p1", "p2"]]])
        self.assertIn('p1 gives 171 and p2 gives 166 for "Sites" at "Cinder", and both exhibits say they show i1/sites', result["apart"][0]["repair"])
        self.assertEqual([[f["code"], f["severity"], f["pages"]] for f in result["loose"]], [["NUMBERS_DISAGREE", "advisory", ["p1", "p2"]]])

    def test_one_value_printed_at_two_precisions_on_two_pages_is_advised(self):
        result = run_node(LOG + '''
const titled = (id, format) => trend(id, [{ measure: 'i4/visits', name: 'Aster' }], { title: `Aster saw {{i4/visits@FY25 | ${format}}} million visits, page ${id}` });
console.log(JSON.stringify({ apart: find([titled('p1', '0.0'), titled('p2', '0')]), same: find([titled('p1', '0.0'), titled('p2', '0.0')]) }));
''')
        self.assertEqual(result["same"], [])
        self.assertEqual([[f["code"], f["severity"], f["pages"]] for f in result["apart"]], [["NUMBER_FORMATS_DIFFER", "advisory", ["p1", "p2"]]])
        self.assertIn('i4/visits@FY25 is "47.3" on p1 and "47" on p2', result["apart"][0]["repair"])

    def test_the_compile_reports_a_disagreement_and_refuses_a_contradiction(self):
        result = run_node(LOG + '''
const run = async (pages) => { const r = await authorDeck({ deck: DECK, pages }, { baseDir: '.', insights, fit: false, fill: false });
  const of = (list) => list.filter((f) => f.code === 'NUMBERS_DISAGREE').map((f) => [f.severity, f.class, f.pages]);
  return { blocking: of(r.blocking), advisories: of(r.advisories) }; };
console.log(JSON.stringify({ twin: await run([rank('p1', 'i1/sites'), rank('p2', 'i2/clinics_reported')]), conflict: await run([rank('p1', 'i1/sites'), rank('p2', 'i5/sites')]) }));
''')
        self.assertEqual(result["twin"], {"blocking": [], "advisories": [["advisory", "S", ["p1", "p2"]]]})
        self.assertEqual(result["conflict"]["blocking"], [["blocker", "S", ["p1", "p2"]]])


class RepeatedProofTests(unittest.TestCase):
    def test_a_page_that_replots_its_neighbour_is_named_with_it_and_only_one_page_twice_blocks(self):
        result = run_node(LOG + '''
const aster = [{ measure: 'i4/visits', name: 'Aster' }];
console.log(JSON.stringify({
  identical: repeats([trend('p1', both), trend('p2', both)]),
  // The same views under a claim about fewer measures: shown whole again, but not the same page.
  whole: repeats([trend('p1', both), trend('p2', aster)]),
  partial: repeats([trend('p1', aster), trend('p2', both)]),
  // Another window of the series, and a threshold drawn on both pages, are not repeats.
  window: repeats([trend('p1', both), trend('p2', both, { exhibit: { heading: 'Visits', series: both, select: { from: 'FY22', to: 'FY26' }, highlights: [{ category: 'FY26' }] } })]),
  threshold: repeats([trend('p1', [...aster, { measure: 'i4/test', name: 'Plan test' }]), trend('p2', [{ measure: 'i4/rival', name: 'Boreal' }, { measure: 'i4/test', name: 'Plan test' }])]),
  // A whole repeat is found against any earlier page, not only the one before.
  earlier: repeats([trend('p1', both), rank('p2', 'i1/sites'), trend('p3', aster)]),
  // A revision recorded under the rules before this one hears it as an advisory.
  older: repeats([trend('p1', both), trend('p2', both)], { workflow: 'existing_deck_revision', rulesVersion: 5 }) }));
''')
        for case in result.values():
            self.assertEqual(case["errors"], [])
        identical = result["identical"]["found"]
        self.assertEqual([[f["severity"], f["rule"], f["pages"]] for f in identical], [["blocker", "PROOF_REPEATS.identical", ["p1", "p2"]]])
        self.assertIn("p2 is p1 a second time", identical[0]["repair"])
        self.assertIn("Merge them into one page", identical[0]["repair"])
        self.assertIn("select: { from, to }", identical[0]["repair"])
        whole = result["whole"]["found"]
        self.assertEqual([[f["severity"], f["rule"], f["pages"], f["measured"]] for f in whole], [["advisory", None, ["p1", "p2"], {"repeated": ["i4/visits"], "whole": True}]])
        self.assertIn("p2 shows nothing else as proof", whole[0]["repair"])
        partial = result["partial"]["found"]
        self.assertEqual([[f["severity"], f["pages"], f["measured"]] for f in partial], [["advisory", ["p1", "p2"], {"repeated": ["i4/visits"], "whole": False}]])
        self.assertIn("beside i4/rival", partial[0]["repair"])
        self.assertEqual(result["window"]["found"], [])
        self.assertEqual(result["threshold"]["found"], [])
        self.assertEqual([[f["severity"], f["pages"]] for f in result["earlier"]["found"]], [["advisory", ["p1", "p3"]]])
        self.assertIn("p1, earlier in the deck,", result["earlier"]["found"][0]["repair"])
        self.assertEqual([[f["severity"], f["rule"]] for f in result["older"]["found"]], [["advisory", "PROOF_REPEATS.identical"]])

    def test_the_overlap_is_recorded_on_the_page_for_the_critic_and_the_reviewer(self):
        result = run_node(LOG + '''
const r = await authorDeck({ deck: DECK, pages: [trend('p1', both), trend('p2', [{ measure: 'i4/visits', name: 'Aster' }])] }, { baseDir: '.', insights, fit: false, fill: false, draft: true });
const settles = r.spec.slides.find((s) => s.id === 'p2').pageType.content.settles;
console.log(JSON.stringify({ stated: settles.stated?.repeats ?? null, notes: dependencyNotes({ bases: [], settles }), first: r.spec.slides.find((s) => s.id === 'p1').pageType.content.settles.stated?.repeats ?? null,
  findings: [...r.blocking, ...r.advisories].filter((f) => f.code === 'PROOF_REPEATS').map((f) => [f.severity, f.class, f.id]) }));
''')
        self.assertEqual(result["stated"], [{"page": "p1", "measures": ["i4/visits"], "whole": True}])
        self.assertIsNone(result["first"])
        self.assertEqual(result["notes"], ["plots i4/visits over the same periods or members as p1 does, and shows nothing else as proof: judge whether this page proves something p1 does not"])
        # A draft reads the spine, and the overlap is on the spine: the critic is told before the pages are laid out.
        self.assertEqual(result["findings"], [["advisory", "S", "p2"]])

    def test_on_a_revision_only_an_overlap_with_a_changed_page_is_reported(self):
        result = run_node(LOG + '''
const pages = [trend('p1', both), trend('p2', both), rank('p3', 'i1/sites'), trend('p4', [{ measure: 'i4/visits', name: 'Aster' }])];
const revision = { workflow: 'existing_deck_revision' };
console.log(JSON.stringify({ untouched: repeats(pages, revision, { changed: ['p3'] }).found.map((f) => f.pages), changed: repeats(pages, revision, { changed: ['p4'] }).found.map((f) => f.pages),
  whole: repeats(pages, {}, {}).found.map((f) => f.pages) }));
''')
        self.assertEqual(result["whole"], [["p1", "p2"], ["p1", "p4"]])
        self.assertEqual(result["untouched"], [])
        self.assertEqual(result["changed"], [["p1", "p4"]])


REVISION = '''
import fs from 'node:fs';
import path from 'node:path';
import { authorDeck, readInsights } from './skills/professional-slides/runtime/author-deck.mjs';
import { bindDeck } from './skills/professional-slides/runtime/bind.mjs';
import { revisionChanges, readInventory } from './skills/professional-slides/runtime/review-passes.mjs';
const dir = DIR;
const doc = JSON.parse(fs.readFileSync(path.join(dir, 'finance.pages.json'), 'utf8'));
const inventory = JSON.parse(fs.readFileSync(path.join(dir, 'rev', 'finance.inventory.json'), 'utf8'));
// The built deck's own pages typed out, as a revision with no insight log holds them: every number written, nothing bound.
const written = bindDeck(doc, await readInsights(dir, 'finance', {})).doc;
const strip = (value) => (Array.isArray(value) ? value.map(strip) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => !['basis', 'evidence', 'role'].includes(key)).map(([key, v]) => [key, key === 'settles' ? { kind: v.kind, what: v.what } : strip(v)])) : value);
const { players: _players, ...deck } = doc.deck;
const base = { deck: { ...deck, workflow: 'existing_deck_revision', inventory: 'finance.inventory.json' }, sources: doc.sources,
  pages: written.pages.map((page) => ({ ...strip(page), sourceSlide: inventory.slides.find((slide) => slide.title === page.title).index })) };
const page = (d, id) => d.pages.find((p) => p.id === id);
const revised = async (mutate) => { const d = structuredClone(base); mutate?.(d);
  const r = await authorDeck(d, { baseDir: path.join(dir, 'rev'), fit: false });
  const of = (list) => list.filter((f) => /^(NUMBERS_DISAGREE|NUMBER_STALE|NUMBER_FORMATS_DIFFER|WORDING_STALE|PROOF_REPEATS|BAR_.*)$/.test(f.code)).map((f) => ({ code: f.code, severity: f.severity, pages: f.pages ?? null, measured: f.measured ?? null, repair: f.repair }));
  return { doc: d, changed: revisionChanges(r.spec, inventory), blocking: of(r.blocking), advisories: of(r.advisories), refused: r.blocking.map((f) => f.code) }; };
// The one number a point change moves: operating cash flow in FY26, in the chart, its caption and the figure above it.
const cashFlow = (d) => { const f2 = page(d, 'f2'); f2.exhibit.series[0].values[7] = 61; f2.exhibit.caption = f2.exhibit.caption.replace('66 million', '61 million'); f2.metrics[1].sublabel = '84 to 61'; };
'''


@requires_python_package("pptx")
class StaleNumberTests(unittest.TestCase):
    """A point change to an imported deck: a deck built by build-deck.mjs from the finance example, imported by
    import-deck.py, and revised on one page."""

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        cls.dir = Path(cls._tmp.name)
        for file in FIXTURES.glob("finance.*"):
            shutil.copy(file, cls.dir / file.name)
        pages = cls.dir / "finance.pages.json"
        doc = json.loads(pages.read_text(encoding="utf-8"))
        doc["deck"]["assets"] = {"fetch": "none", "reason": "The fixture is built with no network, so the players are introduced by name."}
        pages.write_text(json.dumps(doc), encoding="utf-8")
        run = lambda *args: subprocess.run([*map(str, args)], capture_output=True, text=True, cwd=ROOT, timeout=600)
        compiled = run(NODE, RUNTIME / "author-deck.mjs", pages)
        assert compiled.returncode == 0, compiled.stderr[-2000:]
        built = run(NODE, RUNTIME / "build-deck.mjs", cls.dir / "finance.deck.json", cls.dir / "out", "--no-render")
        assert (cls.dir / "out" / "finance.pptx").exists(), built.stderr[-2000:]
        imported = run(PYTHON, RUNTIME / "import-deck.py", cls.dir / "out" / "finance.pptx", cls.dir / "rev")
        assert imported.returncode == 0, imported.stderr[-2000:]
        cls.probe = REVISION.replace("DIR", json.dumps(str(cls.dir)))

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_a_number_changed_on_one_page_and_left_standing_on_another_is_found_from_the_inventory(self):
        result = run_node(self.probe + '''
const same = await revised(), changed = await revised(cashFlow);
// The same change made on the summary's table too: nothing is left stale.
const both = await revised((d) => { cashFlow(d); const row = page(d, 'f0').exhibit.rows.find((r) => r[0] === 'Operating cash flow'); row[2] = '61m'; });
console.log(JSON.stringify({ log: fs.existsSync(path.join(dir, 'rev', 'finance.insights.json')), same: { blocking: same.blocking, advisories: same.advisories, refused: same.refused },
  changed: { pages: changed.changed.content, blocking: changed.blocking }, both: [...both.blocking, ...both.advisories].filter((f) => f.code === 'NUMBER_STALE') }));
''')
        # The revision has no insight log: everything below is read from the inventory and the pages.
        self.assertFalse(result["log"])
        # Imported and unchanged, the deck raises nothing: no page is refused for what the user made.
        self.assertEqual(result["same"], {"blocking": [], "advisories": [], "refused": []})
        self.assertIn("f2", result["changed"]["pages"])
        stale = [f for f in result["changed"]["blocking"] if f["code"] == "NUMBER_STALE"]
        self.assertEqual(len(stale), 1, result["changed"]["blocking"])
        self.assertEqual([stale[0]["severity"], stale[0]["pages"]], ["blocker", ["f2", "f0"]])
        self.assertEqual([stale[0]["measured"]["was"], stale[0]["measured"]["now"]], [66, 61])
        # Both pages, both wordings: the page that changed with what it said before, and the page that still says it.
        self.assertIn('This revision changed 66 million to 61 million on f2 ("Operating cash flow fell to 61 million in FY26"; the slide said "Operating cash flow fell to 66 million in FY26")', stale[0]["repair"])
        self.assertIn('f0 still states 66m of the same thing ("Operating cash flow" under "FY26")', stale[0]["repair"])
        # It is the one finding the change raises: the chart's 66 at FY22, which the page still plots, is not read as the old value.
        self.assertEqual([f["code"] for f in result["changed"]["blocking"]], ["NUMBER_STALE"])
        self.assertEqual(result["both"], [])

    def test_a_number_said_of_the_same_thing_in_other_words_blocks_and_the_same_digits_alone_are_advised(self):
        result = run_node(self.probe + '''
// Profit after tax restated on its own page: the caption names no year, and the summary's row of it is the same thing.
const restated = await revised((d) => { const f2 = page(d, 'f2'); f2.exhibit.caption = f2.exhibit.caption.replace('rose to 49 million', 'rose to 52 million'); f2.metrics[0].sublabel = '47 to 52'; });
// The growth figure replaced by the level: the slide's "+4.3%" stood alone, so only its digits can be looked for.
const dropped = await revised((d) => { page(d, 'f2').metrics[0] = { value: '49', label: 'Profit after tax, GBP m', sublabel: 'up from 47' }; });
const stale = (r) => [...r.blocking, ...r.advisories].filter((f) => f.code === 'NUMBER_STALE').map((f) => [f.severity, f.pages, f.repair]);
console.log(JSON.stringify({ restated: stale(restated), dropped: stale(dropped), refused: dropped.refused }));
''')
        restated = result["restated"]
        self.assertEqual([[severity, pages] for severity, pages, _ in restated], [["blocker", ["f2", "f0"]]], restated)
        self.assertIn("changed 49 million to 52 million on f2", restated[0][2])
        self.assertIn('f0 still states 49m of the same thing ("Profit after tax" under "FY26")', restated[0][2])
        # A number the page stopped printing that had no label: said as a question, never refused.
        dropped = result["dropped"]
        self.assertEqual([[severity, pages] for severity, pages, _ in dropped], [["advisory", ["f2", "f0"]]], dropped)
        self.assertIn("f2 no longer states +4.3%", dropped[0][2])
        self.assertIn("Nothing but the digits says these are the figure the revision changed", dropped[0][2])
        self.assertEqual(result["refused"], [])

    def test_a_name_changed_on_one_page_and_kept_on_another_is_advised(self):
        result = run_node(self.probe + '''
const renamed = await revised((d) => { const f5 = page(d, 'f5'); f5.title = f5.title.replace('Harbour', 'Haven'); f5.bar = f5.bar.replace('Harbour', 'Haven'); f5.exhibit.categories = f5.exhibit.categories.map((c) => (c === 'Harbour' ? 'Haven' : c)); f5.exhibit.highlights = [{ category: 'Haven' }]; });
console.log(JSON.stringify({ pages: renamed.changed.content, wording: [...renamed.blocking, ...renamed.advisories].filter((f) => f.code === 'WORDING_STALE').map((f) => [f.severity, f.pages, f.repair]), refused: renamed.refused }));
''')
        self.assertIn("f5", result["pages"])
        self.assertEqual(result["refused"], [])
        self.assertEqual([[severity, pages] for severity, pages, _ in result["wording"]], [["advisory", ["f5", "f0"]]])
        self.assertIn('f0 still says "Harbour", which this page now writes "Haven"', result["wording"][0][2])

    def test_the_cli_refuses_the_point_change_that_leaves_the_deck_inconsistent(self):
        probe = run_node(self.probe + '''
const d = structuredClone(base); cashFlow(d);
fs.writeFileSync(path.join(dir, 'rev', 'finance.pages.json'), JSON.stringify(d));
console.log(JSON.stringify({ written: true }));
''')
        self.assertTrue(probe["written"])
        run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(self.dir / "rev" / "finance.pages.json"), "--check"], capture_output=True, text=True, cwd=ROOT, timeout=600)
        self.assertEqual(run.returncode, 2, run.stderr[:600])
        findings = run.stderr.split("Where the deck stands")[0]
        self.assertIn("NUMBER_STALE", findings)
        self.assertIn("f0 still states 66m of the same thing", findings)
        # One finding to fix: the point change is refused for what it left inconsistent, and for nothing else about the deck.
        self.assertIn("1 finding to fix", findings)


class RevisionScopeTests(unittest.TestCase):
    def test_what_the_untouched_pages_say_between_them_is_one_advisory_about_the_imported_deck(self):
        result = run_node(LOG + '''
const chart = (id, cinder, sourceSlide) => ({ ...rank(id, 'i1/sites'), evidence: undefined, sourceSlide, exhibit: { heading: 'Clinics', unit: 'clinics', categories: NETWORKS, series: [{ name: 'Sites', values: [312, 284, cinder, 12, 77, 95, 131, 88] }] } });
const slide = (index, cinder) => ({ index, id: `s0${index}`, title: `Aster runs the largest estate of the eight networks, page p${index}`, paragraphs: [], tables: [], pictures: [],
  charts: [{ type: 'BAR_CLUSTERED', title: 'Clinics', categories: NETWORKS, series: [{ name: 'Sites', values: [312, 284, cinder, 12, 77, 95, 131, 88] }] }] });
const inventory = { slides: [slide(1, 171), slide(2, 166), slide(3, 171)] };
const pages = [chart('p1', 171, 1), chart('p2', 166, 2), chart('p3', 171, 3)];
const revision = { workflow: 'existing_deck_revision' };
const run = (list, changed) => find(list, { inventory, changed }, null, revision).map((f) => [f.code, f.severity, f.pages, f.repair]);
console.log(JSON.stringify({ untouched: run(pages, []), stale: run([pages[0], pages[1], chart('p3', 163, 3)], ['p3']),
  // An imported slide still carrying its old copy is read from the inventory.
  unmapped: run([{ id: 's01', sourceSlide: 1, title: 'x', draft: { text: [] } }, pages[1], chart('p3', 163, 3)], ['p3']) }));
''')
        self.assertEqual([f[:3] for f in result["untouched"]], [["NUMBERS_DISAGREE", "advisory", ["p1", "p2"]]])
        self.assertTrue(result["untouched"][0][3].startswith("About the imported deck, not this revision: 1 number is given two values"))
        self.assertIn("Nothing is refused", result["untouched"][0][3])
        for case, other in (("stale", "p1"), ("unmapped", "s01")):
            with self.subTest(case=case):
                stale = [f for f in result[case] if f[0] == "NUMBER_STALE"]
                self.assertEqual([f[:3] for f in stale], [["NUMBER_STALE", "blocker", ["p3", other]]], result[case])
                self.assertIn(f'This revision changed "Sites" at "Cinder" on p3 from 171 to 163, and {other} still prints 171 under the same names', stale[0][3])


    def test_a_number_in_a_sentence_is_matched_by_what_it_is_said_of(self):
        result = run_node(LOG + '''
const memo = (id, sourceSlide, text) => ({ id, sourceSlide, type: 'argument', form: 'memo', commentary: 'none', why: 'A reasoned case in prose beside the claim it argues', settles: { kind: 'qualitative', what: 'the estate each network runs' },
  title: `What the estate counts say about the entrant, page ${id}`, panel: { text: 'The entrant is small today' }, paragraphs: [text] });
const slide = (index, text) => ({ index, id: `s0${index}`, title: `What the estate counts say about the entrant, page p${index}`, paragraphs: [{ text: 'The entrant is small today', level: 0 }, { text, level: 0 }], tables: [], charts: [], pictures: [] });
const WAS = 'Cinder operates an estate of 158 clinics today, which is the base its plans are read against.';
const inventory = (second) => ({ slides: [slide(1, WAS), slide(2, second)] });
const run = (now, second) => find([memo('p1', 1, now), memo('p2', 2, second)], { inventory: inventory(second), changed: ['p1'] }, null, { workflow: 'existing_deck_revision' }).filter((f) => f.code === 'NUMBER_STALE').map((f) => [f.severity, f.pages, f.repair]);
const NOW = WAS.replace('158', '171');
console.log(JSON.stringify({
  // The same label in fewer words: every word of it stands in the changed sentence.
  same: run(NOW, 'The Cinder estate is 158 clinics.'),
  // Another sentence about the same thing, in words of its own: alike, which is asked and not refused.
  alike: run(NOW, 'The estate of 158 clinics at Cinder is a third of what the leader runs.'),
  // The same count of another thing, and the same digits counting something else, are not the figure that changed.
  other: run(NOW, 'Boreal closed 158 clinics over the decade, more than any rival.'),
  towns: run(NOW, 'Cinder serves 158 towns with the estate it has.'),
  // The sentence dropped, nothing in its place: the same thing still stated elsewhere is a question, not a refusal.
  dropped: run('Cinder operates the third largest estate today, which is the base its plans are read against.', 'The Cinder estate is 158 clinics.'),
  unchanged: run(WAS, 'The Cinder estate is 158 clinics.') }));
''')
        self.assertEqual([[severity, pages] for severity, pages, _ in result["same"]], [["blocker", ["p1", "p2"]]], result["same"])
        self.assertIn("This revision changed 158 to 171 on p1", result["same"][0][2])
        self.assertIn('p2 still states 158 of the same thing ("The Cinder estate is 158 clinics")', result["same"][0][2])
        self.assertEqual([[severity, pages] for severity, pages, _ in result["alike"]], [["advisory", ["p1", "p2"]]], result["alike"])
        self.assertIn("p1 no longer states 158 (now 171)", result["alike"][0][2])
        self.assertIn("The words around them are alike, which is not enough to say they are one figure", result["alike"][0][2])
        self.assertEqual(result["other"], [])
        self.assertEqual(result["towns"], [])
        self.assertEqual([[severity, pages] for severity, pages, _ in result["dropped"]], [["advisory", ["p1", "p2"]]], result["dropped"])
        self.assertIn("p1 no longer states 158, which the slide it was imported from did", result["dropped"][0][2])
        self.assertEqual(result["unchanged"], [])


if __name__ == "__main__":
    unittest.main()
