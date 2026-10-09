"""A page that carries too little or too much is told the length that fills it, measured (fill-guidance.mjs).

An empty band was the commonest refusal of a real run - eighteen findings over
seven compiles - and "write more" does not say how much. A page of prose
beside its panel was already told the words that fill its column
(test_prose_fill.py). These hold the same statement for the other common
kinds: points beside a chart and under an exhibit, a table and a findings
matrix by their rows, the bullets of labelled rows, an executive summary. The
range is read off the composer - the page composed again with its own content
run shorter and longer - and each test writes content to the stated range and
composes the deck again: no empty band, no shortfall against the word floor,
nothing over the ceiling.
"""
from __future__ import annotations

import unittest

from node_probe import run_node

DECK = '''
import fs from 'node:fs';
import { authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
import { fillGuidance, fillLevers, FILL } from './skills/professional-slides/runtime/fill-guidance.mjs';
const BASE = './skills/professional-slides/examples';
const whole = JSON.parse(fs.readFileSync(`${BASE}/page-types.pages.json`, 'utf8'));
// The worked deck's sections with the pages these tests read: each page is measured in the deck it is then composed in.
const KEPT = new Set(['p01', 'p07b', 'p08', 'p11', 'p13', 'p23', 'p24', 'p24b', 'p25', 'p26']);
const worked = { ...whole, pages: whole.pages.filter((p) => p.kind || KEPT.has(p.id)) };
const words = (text) => String(text).trim().split(/\\s+/);
// A text's own words run to `n`: what an author writing to a stated length does with the page's own subject.
const runTo = (text, n) => `${Array.from({ length: n }, (_, i) => words(text)[i % words(text).length]).join(' ').replace(/[.,;:!?]+$/, '')}.`;
const page = (doc, id) => [...doc.pages, ...(doc.appendix || [])].find((p) => p.id === id);
const pointLists = (p) => [...(Array.isArray(p.points) ? [p.points] : []), ...(p.blocks || []).map((b) => b.points).filter(Array.isArray)];
const setPoints = (p, n) => { delete p.highlight; for (const list of pointLists(p)) list.forEach((point, i) => { if (typeof point === 'string') list[i] = runTo(point, n); else { point.text = runTo(point.text, n); delete point.highlight; } }); };
const holder = (p) => (p.exhibit?.rows ? p.exhibit : p);
const setRows = (p, n) => { const h = holder(p); h.rows = Array.from({ length: n }, (_, i) => structuredClone(h.rows[i % h.rows.length])); };
const FILLS = ['SCENE_VOID', 'TEXT_COVERAGE_LOW', 'WORDS'];
// The deck with one page changed, and what the compile says of how much that page carries.
const run = async (id, mutate, options = {}) => { const doc = structuredClone(worked); mutate(page(doc, id), doc);
  const result = await authorDeck(doc, { baseDir: BASE, fit: false, fitPages: new Set([id]), ...options });
  const found = [...result.blocking, ...result.advisories].filter((f) => String(f.id) === id);
  return { codes: found.filter((f) => f.severity !== 'advisory' && [...FILLS, 'PAGE_DOES_NOT_COMPOSE', 'COMPILE'].includes(f.code)).map((f) => f.code), fills: found.find((f) => FILLS.includes(f.code) && f.fills)?.fills ?? null,
    repair: (({ repair, reason } = {}) => repair ?? reason ?? null)(found.find((f) => FILLS.includes(f.code) && f.fills)),
    // The statement is on every finding of the page it answers, one text for all of them.
    said: found.filter((f) => FILLS.includes(f.code)).map((f) => [f.code, Boolean(f.fills)]) }; };
// A stated range met at its two ends.
const meets = async (id, lever, range, set, prepare = () => {}) => { const at = [...new Set([range.min, range.max])];
  return Promise.all(at.map(async (n) => [n, (await run(id, (p) => { prepare(p); set(p, n); })).codes])); };
'''


class PointsTests(unittest.TestCase):
    def test_points_beside_a_chart_and_under_an_exhibit_are_told_the_words_each_that_fill_the_page(self):
        result = run_node(DECK + '''
const out = {};
// p07b: three points beside a distribution. p24: three points under a row of profiles. p23: two points under a gantt.
for (const id of ['p07b', 'p24', 'p23']) {
  const short = await run(id, (p) => setPoints(p, 6));
  out[id] = { short: short.codes, fills: short.fills, repair: short.repair, met: short.fills?.points?.min ? await meets(id, 'points', short.fills.points, setPoints) : null };
}
console.log(JSON.stringify(out));
''')
        for page, placed, count in (("p07b", "beside its exhibit", 3), ("p24", "under its exhibit", 3), ("p23", "under its exhibit", 2)):
            with self.subTest(page=page):
                case = result[page]
                self.assertTrue(case["short"], "six words a point should leave the page short")
                points = case["fills"]["points"]
                self.assertEqual([points["count"], points["average"], points["placed"]], [count, 6, placed])
                self.assertLess(6, points["min"])
                self.assertLess(points["min"], points["max"])
                # The finding says the range, each and in all, and the length the points run to now.
                self.assertIn(f"Its {count} points {placed} fill the page at {points['min']} to {points['max']} words each ({points['min'] * count} to {points['max'] * count} in all)", case["repair"])
                self.assertIn("they average 6", case["repair"])
                # Written to the range - at both its ends - the page is neither short nor over.
                self.assertEqual([codes for _, codes in case["met"]], [[], []], case["met"])

    def test_labelled_rows_are_told_the_words_a_bullet_that_fill_them(self):
        result = run_node(DECK + '''
const short = await run('p24b', (p) => setPoints(p, 6));
console.log(JSON.stringify({ short: short.codes, fills: short.fills, repair: short.repair, met: short.fills?.points?.min ? await meets('p24b', 'points', short.fills.points, setPoints) : null }));
''')
        self.assertTrue(result["short"])
        points = result["fills"]["points"]
        self.assertEqual(points["placed"], "in its labelled rows")
        self.assertIn(f"points in its labelled rows fill the page at {points['min']} to {points['max']} words each", result["repair"])
        self.assertEqual([codes for _, codes in result["met"]], [[], []], result["met"])

    def test_the_statement_answers_the_empty_band_and_the_word_floor_alike(self):
        result = run_node(DECK + '''
// Six words a point leave p11 with a band empty and under its floor; p23 only under its floor.
const beside = await run('p11', (p) => setPoints(p, 6)), under = await run('p23', (p) => setPoints(p, 6));
console.log(JSON.stringify({ beside: beside.said, under: under.said, unmeasured: (await run('p11', (p) => setPoints(p, 6), { fill: false })).said }));
''')
        self.assertEqual(sorted(result["beside"]), [["SCENE_VOID", True], ["TEXT_COVERAGE_LOW", True]])
        self.assertEqual(result["under"], [["TEXT_COVERAGE_LOW", True]])
        # The measurement is the compile's own step, and a caller that composes the deck for something else can leave it out.
        self.assertEqual(sorted(result["unmeasured"]), [["SCENE_VOID", False], ["TEXT_COVERAGE_LOW", False]])


class RowsTests(unittest.TestCase):
    def test_a_table_and_a_findings_matrix_are_told_the_rows_that_fill_the_frame(self):
        result = run_node(DECK + '''
const out = {};
// p08: a lookup table. p25: a scorecard. p13: a matrix of findings, whose rows are the page's own.
for (const id of ['p08', 'p25', 'p13']) {
  const short = await run(id, (p) => setRows(p, 3));
  out[id] = { short: short.codes, fills: short.fills, repair: short.repair, met: short.fills?.rows?.min ? await meets(id, 'rows', short.fills.rows, setRows) : null };
}
console.log(JSON.stringify(out));
''')
        for page, of in (("p08", "table"), ("p25", "table"), ("p13", "matrix")):
            with self.subTest(page=page):
                case = result[page]
                self.assertIn("SCENE_VOID", case["short"])
                rows = case["fills"]["rows"]
                self.assertEqual([rows["count"], rows["of"]], [3, of])
                self.assertLess(3, rows["min"])
                self.assertLess(rows["min"], rows["max"])
                self.assertIn(f"Its {of} fills the frame at {rows['min']} to {rows['max']} rows at the row height it is drawn at", case["repair"])
                self.assertIn("it has 3", case["repair"])
                self.assertNotIn("points", case["fills"])
                self.assertEqual([codes for _, codes in case["met"]], [[], []], case["met"])


class SummaryTests(unittest.TestCase):
    def test_an_executive_summary_is_told_how_narrow_its_window_is_and_what_no_length_of_text_fills(self):
        result = run_node(DECK + '''
// The worked summary: three points and a table of five rows.
const short = await run('p01', (p) => setPoints(p, 8));
const met = short.fills?.points?.min ? await meets('p01', 'points', short.fills.points, setPoints) : null;
// Two points: inside the summary's ceiling of body words no length of them reaches the foot, and no number of rows does it for them.
const two = (p) => { p.points = p.points.slice(0, 2); };
const few = await run('p01', (p) => { two(p); setPoints(p, 8); });
// What the statement says is so: the two points at their longest, and the table at its longest, each still leave the page short.
const longest = await run('p01', (p) => { two(p); setPoints(p, few.fills.points.tried.at(-1)); }, { fill: false });
const deepest = await run('p01', (p) => { two(p); setPoints(p, 8); setRows(p, few.fills.rows.tried.at(-1)); }, { fill: false });
console.log(JSON.stringify({ short: { codes: short.codes, fills: short.fills, repair: short.repair, met }, few: { codes: few.codes, fills: few.fills, repair: few.repair, longest: longest.codes, deepest: deepest.codes } }));
''')
        short, few = result["short"], result["few"]
        self.assertIn("SCENE_VOID", short["codes"])
        points = short["fills"]["points"]
        # A summary's three points fill it over a few words only, and the statement says how few rather than a range that is not there.
        self.assertTrue(points["narrow"])
        self.assertLessEqual(points["max"] - points["min"], 8)
        self.assertIn(f"fill the page only between {points['min']} and {points['max']} words each, a window so narrow that a line more or less turns it", short["repair"])
        # Where the words fill the page the table is not measured: one statement, about the lever that works.
        self.assertNotIn("rows", short["fills"])
        self.assertEqual([codes for _, codes in short["met"]], [[], []], short["met"])
        self.assertTrue(few["codes"])
        self.assertIsNone(few["fills"]["points"]["min"])
        self.assertIn("No length of its 2 points on the page fills the page inside its ceiling of 204 body words", few["repair"])
        self.assertIn("Text alone does not fill this page", few["repair"])
        self.assertIsNone(few["fills"]["rows"]["min"])
        self.assertIn("Nor does its table on its own", few["repair"])
        self.assertTrue(few["longest"])
        self.assertTrue(few["deepest"])

    def test_where_text_cannot_fill_the_page_the_exhibit_that_does_is_named_with_its_rows(self):
        result = run_node(DECK + '''
// A stand-in composer for a summary whose ceiling stops its points short of the foot: under 40 words a point a band stands
// empty, from 40 it is over its ceiling, and its table fills the frame from seven rows to nine.
const summary = page(worked, 'p01');
const target = { id: 'p01', page: summary, index: 0, appendix: false, base: new Set(), ceiling: 204, exhibit: 'its table' };
const of = (slide) => { const [, lever, at] = String(slide.id).match(/--fill-(points|rows)-(?:lean-|full-)?(\\d+)$/); return [lever, Number(at)]; };
const found = await fillGuidance([target], { compile: (p) => ({ id: p.id }), compose: async (body) => ({ deck: { slides: body.map((b) => b.slide) } }),
  pageGates: (slides) => ({ ran: true, findings: slides.flatMap((slide, i) => { const [lever, n] = of(slide);
    return lever === 'points' ? [{ slide: i + 1, code: n < 40 ? 'SCENE_VOID' : 'WORDS', severity: 'blocker' }] : n < 7 ? [{ slide: i + 1, code: 'SCENE_VOID', severity: 'blocker' }] : n > 9 ? [{ slide: i + 1, code: 'WORDS', severity: 'blocker' }] : []; }) }) });
console.log(JSON.stringify({ rows: summary.exhibit.rows.length, ...found.get('p01') }));
''')
        self.assertIsNone(result["points"]["min"])
        self.assertEqual([result["rows"]["min"], result["rows"]["max"]], [7, 9])
        self.assertIn("No length of its 3 points on the page fills the page inside its ceiling of 204 body words", result["text"])
        self.assertIn("Text alone does not fill this page. The exhibit fills it: its table fills the frame at 7 to 9 rows at the row height it is drawn at", result["text"])


class MeasurementTests(unittest.TestCase):
    def test_a_page_with_nothing_to_lengthen_is_told_its_exhibit_fills_it_and_nothing_is_measured(self):
        result = run_node(DECK + '''
const strip = page(worked, 'p26');
let composed = 0;
const found = await fillGuidance([{ id: 'p26', page: strip, index: 0, appendix: false, base: new Set(), ceiling: 219, exhibit: '"Journeys by time of travel"' }],
  { compile: () => { throw new Error('nothing to compile'); }, compose: async () => { composed += 1; return { deck: null }; }, pageGates: () => ({ ran: true, findings: [] }) });
console.log(JSON.stringify({ levers: fillLevers(strip), metrics: strip.metrics.length, composed, said: found.get('p26') }));
''')
        self.assertEqual(result["levers"], {"points": None, "rows": None})
        self.assertEqual(result["composed"], 0)
        self.assertEqual(result["said"]["text"], f"This page has no points and no table whose length fills a band: the strip of {result['metrics']} figures takes its own height and what fills it is the exhibit, "
                         '"Journeys by time of travel" - give it the height (another form or placement of the page, listed below where one passes) or more of the evidence in it.')

    def test_a_range_is_only_lengths_that_were_composed_and_passed_and_the_cost_is_bounded(self):
        result = run_node(DECK + '''
// A stand-in composer: a page fills from 30 to 50 words a point, is short under that and over past it.
const target = { id: 'p07b', page: page(worked, 'p07b'), index: 0, appendix: false, base: new Set(), ceiling: 219, exhibit: null };
const calls = { compose: 0, gates: 0, variants: 0 };
const lengthOf = (slide) => Number(String(slide.id).split('-').at(-1));  // `<id>--fill-points-<lean|full>-<n>`
const found = await fillGuidance([target], { compile: (p) => ({ id: p.id }), compose: async (body) => { calls.compose += 1; calls.variants += body.length; return { deck: { slides: body.map((b) => b.slide) } }; },
  pageGates: (slides) => { calls.gates += 1; return { ran: true, findings: slides.flatMap((slide, i) => { const n = lengthOf(slide); return n < 30 ? [{ slide: i + 1, code: 'SCENE_VOID', severity: 'blocker' }] : n > 50 ? [{ slide: i + 1, code: 'WORDS', severity: 'blocker' }] : []; }) }; } });
const points = found.get('p07b').points;
console.log(JSON.stringify({ points, calls, first: FILL.pointWords, pages: FILL.pages }));
''')
        points = result["points"]
        # The stated range sits inside the lengths that passed, a line's worth of words in from each end.
        self.assertGreater(points["min"], 30)
        self.assertLess(points["max"], 50)
        self.assertTrue(all(30 <= n <= 50 for n in points["tried"] if points["min"] <= n <= points["max"]))
        # The second reading closes in on the two turns, so the margin is all that is given up.
        self.assertLessEqual(points["min"] - 30, 3 + 3)
        self.assertLessEqual(50 - points["max"], 4 + 5)
        self.assertEqual([points["short"] < 30, points["over"] > 50], [True, True])
        # Two compositions and two gate runs for the lever, however many lengths are tried; each length in two wordings.
        self.assertEqual([result["calls"]["compose"], result["calls"]["gates"]], [2, 2])
        self.assertLessEqual(result["calls"]["variants"], 2 * (len(result["first"]) + 2 * 3))


class RevisionTests(unittest.TestCase):
    def test_a_revision_is_measured_on_the_page_it_changed_and_not_on_the_pages_it_left(self):
        result = run_node(DECK + '''
import os from 'node:os';
import path from 'node:path';
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
import { revisionChanges } from './skills/professional-slides/runtime/review-passes.mjs';
// Two imported slides, each a chart or a diagram beside three thin points. The revision redraws the second as a cycle
// diagram, which its slide was not; the first it leaves as the slide was, thin points and all.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fill-revision-'));
const pages = ['p07b', 'p11'].map((id, i) => { const p = structuredClone(page(worked, id)); setPoints(p, 6); return { ...p, sourceSlide: i + 1 }; });
const doc = { deck: { ...worked.deck, workflow: 'existing_deck_revision', inventory: 'deck.inventory.json', request: undefined }, pages };
// The inventory holds what each slide said - every word and number of the page as compiled - and that each drew one bar chart.
const QUIET = new Set(['id', 'pageType', 'sourceSlide', 'alt', 'layout', 'arrange', 'shape', 'kind', 'type', 'source', 'highlight', 'icon', 'style', 'frame', 'crop', 'variant', 'treatment', 'path', 'title']);
const said = (value, out = []) => { if (typeof value === 'string' || typeof value === 'number') out.push(String(value)); else if (Array.isArray(value)) value.forEach((v) => said(v, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) if (!QUIET.has(k)) said(v, out); return out; };
const spec = compileDeck(doc, { partial: true }).spec;
const inventory = { schema: 'professional-slides.inventory/v1', id: 'deck', slides: spec.slides.map((slide, i) => ({ index: i + 1, id: `s0${i + 1}`, title: slide.title, paragraphs: [{ text: said({ ...slide, title: undefined }).join(' '), level: 0 }],
  tables: [], charts: [{ type: 'BAR_CLUSTERED', title: null, categories: [], series: [] }], pictures: [] })) };
fs.writeFileSync(path.join(dir, 'deck.inventory.json'), JSON.stringify(inventory));
const result = await authorDeck(doc, { baseDir: dir, fit: false });
const of = (id) => [...result.blocking, ...result.advisories].filter((f) => String(f.id) === id && FILLS.includes(f.code)).map((f) => [f.code, Boolean(f.fills)]);
fs.rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify({ changed: revisionChanges(result.spec, inventory).content, kept: of('p07b'), revised: of('p11') }));
''')
        self.assertEqual(result["changed"], ["p11"])
        # The changed page is told what fills it; the page the revision left is not composed a dozen times to say the same of the user's own slide.
        self.assertTrue(result["revised"])
        self.assertTrue(all(measured for _, measured in result["revised"]), result["revised"])
        self.assertTrue(result["kept"])
        self.assertFalse(any(measured for _, measured in result["kept"]), result["kept"])


if __name__ == "__main__":
    unittest.main()
