"""A draft is the full compile of the spine, completed.

Three real authoring runs ended undelivered at the same place: a spine passed
its draft, the storyline critique reached `ready` on its last pass, and the
full compile then refused a fact the critique was bound to. Each time the draft
had read the page by other code than the compile: a bound exhibit with no
`type` on a page of panels and under a metric strip, a `basis` stub on a
matrix page, which carries no exhibit, a figure stub on a labelled-rows page,
a table whose row labels named another period than its stub declared, a
timeline read as another class of exhibit than the spine was.

So a draft has no reading of its own (spine-witness.mjs). Each spine page is
completed with placeholder copy and unbound content and put through the one
compile; the completed page is the spine's witness, and what the critique
would be bound to on the spine is what it would be bound to on the witness, or
the page is refused as undetermined. These tests hold that over a generated
grid - every worked form, every form the evidence fixtures' measures bind, and
the containers a page states figures in, each cut back to four spines - and
hold the particular pages the runs met.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"

SETUP = '''
import fs from 'node:fs';
import * as A from './skills/professional-slides/runtime/author-deck.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
import * as G from './skills/professional-slides/runtime/gates/gate_classes.mjs';
import { PAGE_TYPES } from './skills/professional-slides/runtime/page-types.mjs';
const dir = './evals/quality/fixtures/evidence';
const examples = A.workedExamples();
const read = (name) => JSON.parse(fs.readFileSync(`${dir}/${name}.pages.json`, 'utf8'));
const insightsOf = (name, doc) => A.readInsights(dir, name, { alternatives: (doc.deck.players || []).map((p) => (typeof p === 'string' ? p : p.name)) });
// A finding of the full compile that the copy, the layout and the fit do not mend: its repair writes a field the critique binds.
const boundOnly = (f) => f.class === 'P' && (['COMPILE', 'PAGE_DOES_NOT_COMPOSE'].includes(f.code) || G.repairOf(f).settledLater === null);
const measuresOf = (insights) => (insights ? S.recordedMeasures([...insights.values()]) : null);
'''

# The grid. `layouts` are laid-out pages: the worked page of every form (typed numbers, no insight log), a scaffold of every
# form bound to each insight of the four evidence fixtures whose measures fill it, and a labelled-rows page whose rows state
# figures and carry an exhibit. Each is cut back to its spine four ways and drafted; a spine that passes is laid out.
GRID = SETUP + '''
const EXCOPY = ['heading', 'caption', 'annotations', 'highlights', 'note', 'changeAnnotations', 'events', 'focusSeries'];
const bare = (ex) => { const out = structuredClone(ex); for (const key of EXCOPY) delete out[key]; return out; };
const refsIn = (node) => [...new Set([...JSON.stringify(node ?? null).matchAll(/"measure":"([^"@]+)(?:@[^"]*)?"|\\{\\{([^{}|@\\s]+\\/[^{}|@\\s]+)/g)].map((m) => m[1] ?? m[2]))];
const layouts = [];
for (const page of examples.pages.filter((p) => p.type)) layouts.push({ name: `typed ${page.type}/${page.form}`, group: 'typed', deck: examples.deck, base: './skills/professional-slides/examples', insights: null, page, kind: 'typed' });
for (const name of FIXTURE_NAMES) {
  const doc = read(name), insights = await insightsOf(name, doc), deck = { ...doc.deck };
  for (const [type, t] of Object.entries(PAGE_TYPES)) for (const form of Object.keys(t.forms)) for (const insight of insights.values()) {
    let report; try { report = A.scaffoldReport(type, { id: 'g1', form, insight }); } catch { continue; }
    if (!report.bound.length || report.typed.length || report.fallback) continue;
    layouts.push({ name: `bound ${type}/${form} ${name}:${insight.id}`, group: name, deck, sources: doc.sources, base: dir, insights, kind: 'bound',
      page: { ...report.page, title: 'Lending grew faster than the deposits that fund it did', why: 'The page type carries what the measures give a reader to read' } });
  }
  // The containers a page states figures in beside the scaffolds' strips, heroes and grids: a row block's metric and a block's exhibit.
  const single = [...insights.values()].flatMap((i) => Object.entries(i.measures ?? {}).filter(([, m]) => !m.periods && !m.members && typeof m.value === 'number').map(([key]) => ({ id: i.id, ref: `${i.id}/${key}` })));
  const series = [...insights.values()].flatMap((i) => Object.entries(i.measures ?? {}).filter(([, m]) => Array.isArray(m.periods) && m.periods.length >= 4).map(([key]) => ({ id: i.id, ref: `${i.id}/${key}` })));
  // Two row pages: three rows that each state a figure, and - a chart at the right of a row fits a page of two - a figure and a chart.
  if (single.length >= 3) {
    const rows = examples.pages.find((p) => p.form === 'labelled-rows');
    const wordsOf = (at) => ({ label: rows.blocks[at].label, points: rows.blocks[at].points.map((point) => String(point).replace(/[0-9][0-9.,]*%?/g, 'several')) });
    const figure = (x) => ({ metric: { measure: x.ref, format: '0.0', label: 'what the figure is' } });
    const rowPage = (key, used, blocks) => layouts.push({ name: `bound parallel/labelled-rows ${name}:${key}`, group: name, deck, sources: doc.sources, base: dir, insights, kind: 'bound',
      page: { id: 'g1', type: 'parallel', form: 'labelled-rows', commentary: 'in-exhibit', title: 'The figures carry the claim and each row says what one means', why: 'Parallel points, each with its own evidence at the right',
        adds: 'Each row says what the evidence at its right means for the claim', evidence: [...new Set(used.map((x) => x.id))], settles: { kind: 'comparison', what: 'the figures the rows state', measures: used.map((x) => x.ref) }, blocks } });
    rowPage('figures', single.slice(0, 3), single.slice(0, 3).map((x, at) => ({ ...wordsOf(at), ...figure(x) })));
    if (series[0]) rowPage('figure-and-chart', [single[0], series[0]], [{ ...wordsOf(0), ...figure(single[0]) },
      { ...wordsOf(1), exhibit: { type: 'chart.line', series: [{ measure: series[0].ref, name: 'Series' }], heading: 'What the series measures' } }]);
  }
}
const KEYS = ['id', 'type', 'form', 'commentary', 'why', 'title', 'settles', 'evidence', 'series'];
const CONTENT = ['metrics', 'kpi', 'blocks', 'rows', 'columns', 'photo', 'pictures', 'paragraphs', 'panel', 'text', 'accent', 'subtext', 'items', 'tag'];
// A laid-out page cut back to its spine: `drawn` keeps its exhibits and figures bare of copy; `declared` keeps each as a stub
// that states the view the laid-out page shows; `stubs` as a stub that names its measures alone; `none` keeps nothing.
function spineOf(layout, variant, records) {
  const page = layout.page, out = Object.fromEntries(KEYS.filter((key) => page[key] !== undefined).map((key) => [key, page[key]]));
  if (variant === 'drawn') { if (page.exhibit) out.exhibit = bare(page.exhibit); if (page.exhibits) out.exhibits = page.exhibits.map(bare);
    for (const key of CONTENT) if (page[key] !== undefined) out[key] = page[key]; return out; }
  if (variant === 'none') return out;
  // A figure - a strip's tile, a hero number, a row's metric - is declared by the one number it states; an exhibit by the view the
  // laid-out page shows of each measure in its own class, the figures beside it apart.
  const figures = [...(Array.isArray(page.metrics) ? page.metrics : []), page.kpi, ...(Array.isArray(page.blocks) ? page.blocks.map((b) => b.metric) : [])].filter(Boolean);
  const stated = new Set(figures.flatMap(refsIn));
  const viewOf = (ref) => { const views = (records.get(page.id)?.views?.[ref] ?? []).map((v) => JSON.parse(v)).filter((view, _, all) => !(stated.has(ref) && view[0] === 'figure' && all.length > 1)); return views.length === 1 ? views[0] : null; };
  const stub = (item) => { const refs = refsIn(item); if (!refs.length) return null;
    if (variant === 'stubs') return { basis: { measures: refs } };
    if (figures.includes(item)) { const [ref, label] = String(item.measure ?? '').split('@'); return item.measure === undefined ? null : { basis: { measures: [ref], ...(label !== undefined ? { labels: [label] } : {}) } }; }
    const views = refs.map((ref) => [ref, viewOf(ref)]); if (views.some(([, view]) => !view || (Array.isArray(view[1]) && !view[1].length))) return null;
    const classes = new Set(views.filter(([, view]) => view.length > 1).map(([, view]) => view[0]));
    if (classes.size > 1) return null;
    const labels = Object.fromEntries(views.filter(([, view]) => Array.isArray(view[1])).map(([ref, view]) => [ref, view[1]]));
    return { basis: { measures: refs, ...(classes.size ? { as: [...classes][0] } : {}), ...(Object.keys(labels).length ? { labels } : {}) } }; };
  let ok = true; const keep = (item) => { const made = stub(item); if (!made) ok = false; return made ?? {}; };
  if (page.exhibit) out.exhibit = keep(page.exhibit); if (page.exhibits) out.exhibits = page.exhibits.map(keep);
  if (Array.isArray(page.metrics)) out.metrics = page.metrics.map(keep); if (page.kpi) out.kpi = keep(page.kpi);
  // A row block's figure and its exhibit keep their places in the row, each as a stub: the containers a labelled-rows page states figures in.
  if (Array.isArray(page.blocks)) out.blocks = page.blocks.map((block) => ({ ...(block.metric ? { metric: keep(block.metric) } : {}), ...(block.exhibit ? { exhibit: { type: block.exhibit.type, ...keep(block.exhibit) } } : {}) }));
  return ok ? out : null;
}
const tally = {}, broken = [], refusals = {}, proved = new Set();
// The worked page a draft stands in for content from: the first of each form.
const firstOfForm = new Set();
const count = (key, n = 1) => { tally[key] = (tally[key] ?? 0) + n; };
const groups = new Map();
for (const layout of layouts) groups.set(layout.group, [...(groups.get(layout.group) ?? []), layout]);
// A deck at a time, twelve pages a deck: a run compiles, composes and gates its pages together, and the deck's own rules are not what is tested.
const chunks = [...groups.values()].flatMap((list) => Array.from({ length: Math.ceil(list.length / 12) }, (_, i) => list.slice(i * 12, (i + 1) * 12)));
for (const list of chunks) {
  const { deck, sources, base, insights, kind } = list[0], measures = measuresOf(insights);
  list.forEach((layout, at) => { const first = layout.kind === 'typed' && examples.pages.find((p) => p.type === layout.page.type && p.form === layout.page.form) === layout.page;
    layout.id = `g${at + 1}`; layout.page = { ...layout.page, id: layout.id }; if (first) firstOfForm.add(layout.page); });
  const docOf = (pages) => ({ deck, ...(sources ? { sources } : {}), pages });
  const hashes = (spec) => S.storylinePageHashes(spec, measures);
  const bad = (run, id) => run.blocking.filter(boundOnly).filter((f) => String(f.id) === id);
  const full = await A.authorDeck(docOf(list.map((l) => l.page)), { baseDir: base, insights, fit: false, fill: false });
  const records = new Map(S.storyStructure(full.spec, measures).map((p) => [p.id, p])), fullHash = hashes(full.spec);
  const usable = list.filter((l) => !bad(full, l.id).length && fullHash[l.id]);
  for (const variant of kind === 'typed' ? ['drawn', 'none'] : ['drawn', 'declared', 'stubs', 'none']) {
    const cut = usable.map((l) => ({ layout: l, spine: spineOf(l, variant, records) })).filter((item) => item.spine);
    const draft = await A.authorDeck(docOf(cut.map((item) => item.spine)), { baseDir: base, insights, draft: true, fit: false });
    const refused = new Map(draft.blocking.filter((f) => f.class === 'P' && f.id !== undefined).map((f) => [String(f.id), f.code]));
    const passed = cut.filter((item) => !refused.has(item.layout.id));
    count(`${kind}/${variant} refused`, cut.length - passed.length); count(`${kind}/${variant} passed`, passed.length);
    for (const item of cut) { const type = item.layout.page.type, key = `${kind}/${variant}/${refused.has(item.layout.id) ? 'refused' : 'passed'}`; (refusals[key] ??= {})[type] = ((refusals[key] ?? {})[type] ?? 0) + 1;
      // A typed page whose exhibits draw numbers, cut back to nothing: with no insight log the critique is bound to those numbers.
      if (kind === 'typed' && variant === 'none' && (records.get(item.layout.id)?.drawn ?? []).length && firstOfForm.has(item.layout.page)) count(refused.get(item.layout.id) === 'SPINE_UNDETERMINED' ? 'typed numbers undrawn: refused as undetermined' : 'typed numbers undrawn: PASSED'); }
    const before = hashes(draft.spec);
    // Its witness - the spine completed by the draft - compiled as any pages file is, with no draft about it.
    if (!draft.witness) { broken.push({ variant, group: list[0].group, witness: 'the draft built none' }); continue; }
    const laid = await A.authorDeck(draft.witness.doc, { baseDir: base, insights, fit: false, fill: false }), after = hashes(laid.spec);
    for (const { layout } of passed) {
      if (['declared', 'stubs'].includes(variant)) proved.add(layout);
      if (bad(laid, layout.id).length || after[layout.id] !== before[layout.id]) broken.push({ layout: layout.name, variant, witness: bad(laid, layout.id).map((f) => `${f.code}: ${String(f.repair).slice(0, 200)}`), sameBoundPage: after[layout.id] === before[layout.id] });
      // And the page the spine was cut from, where the spine says what that page shows.
      if (['drawn', 'declared'].includes(variant) && fullHash[layout.id] !== before[layout.id]) broken.push({ layout: layout.name, variant, laidOut: 'the page the spine was cut from is another bound page',
        before: JSON.stringify(S.storyStructure(draft.spec, measures).find((p) => p.id === layout.id)).slice(0, 500), after: JSON.stringify(records.get(layout.id)).slice(0, 500) });
    }
  }
}
// The containers the property was held over: counted from the layouts whose spine of stubs passed its draft and was laid out, not from the layouts generated.
const stubbed = [...proved];
const containers = { panels: stubbed.filter((l) => l.page.type === 'panels').length, strips: stubbed.filter((l) => Array.isArray(l.page.metrics)).length, heroes: stubbed.filter((l) => l.page.kpi).length,
  grids: stubbed.filter((l) => ['fact-grid', 'stat-list'].includes(l.page.form)).length, rowFigures: stubbed.filter((l) => Array.isArray(l.page.blocks) && l.page.blocks.every((b) => b.metric)).length,
  rowExhibits: stubbed.filter((l) => Array.isArray(l.page.blocks) && l.page.blocks.some((b) => b.exhibit)).length };
console.log(JSON.stringify({ layouts: layouts.length, forms: new Set(layouts.map((l) => `${l.page.type}/${l.page.form}`)).size, catalogue: Object.values(PAGE_TYPES).reduce((n, t) => n + Object.keys(t.forms).length, 0),
  boundTypes: [...new Set(layouts.filter((l) => l.kind === 'bound').map((l) => l.page.type))].sort(), containers, tally, refusals, broken }));
'''

# The fixtures of one log: a spine page added to the finance fixture, drafted and laid out.
CASES = SETUP + '''
const doc = read('finance'), insights = await insightsOf('finance', doc), measures = measuresOf(insights);
const withPage = (page) => ({ ...doc, pages: [...doc.pages, page] });
const draftOf = (page) => A.authorDeck(withPage(page), { baseDir: dir, insights, draft: true, fit: false });
const fullOf = (page) => A.authorDeck(withPage(page), { baseDir: dir, insights, fit: false, fill: false });
const refusedOf = (run, id = 'x1') => run.blocking.filter((f) => String(f.id) === id).map((f) => [f.code, String(f.repair)]);
const hashOf = (run, id = 'x1') => S.storylinePageHashes(run.spec, measures)[id];
const recordOf = (run, id = 'x1') => S.storyStructure(run.spec, measures).find((p) => p.id === id);
const base = (more) => ({ id: 'x1', why: 'The page type carries what the measures give a reader to read', title: 'Lending grew faster than the deposits that fund it did', ...more });
const LOANS = 'i-loans/loans', LIQUID = 'i-liquidity/liquid', SHORT = 'i-liquidity/short-liabilities';
'''


class GridTests(unittest.TestCase):
    """The property over the generated grid, run once for the class."""

    result = None

    @classmethod
    def setUpClass(cls):
        cls.result = run_node(GRID.replace("FIXTURE_NAMES", json.dumps(["finance", "public-ops", "product", "explainer"])))

    def test_the_grid_covers_every_form_and_the_containers_a_page_states_figures_in(self):
        result = self.result
        self.assertEqual(result["forms"], result["catalogue"])                 # every form of every page type, typed
        self.assertGreaterEqual(result["layouts"], 400)
        # The types whose exhibits the fixtures' measures fill, bound: charts of every family, tables, figures and panels.
        for name in ("trend", "ranking", "composition", "panels", "lookup", "scorecard", "numbers", "parallel"):
            self.assertIn(name, result["boundTypes"])
        for container, n in result["containers"].items():
            self.assertGreater(n, 0, container)
        # Each of the four spines is both passed and refused somewhere, so neither arm of the property is held vacuously.
        for cell in ("typed/drawn passed", "typed/none passed", "typed/none refused", "bound/drawn passed", "bound/declared passed", "bound/stubs passed", "bound/stubs refused", "bound/none passed", "bound/none refused"):
            self.assertGreater(result["tally"].get(cell, 0), 0, cell)
        self.assertGreaterEqual(result["tally"]["bound/declared passed"], 240)

    def test_a_spine_that_passes_its_draft_lays_out_to_the_same_bound_page_with_no_bound_refusal(self):
        # For every spine of the grid the draft passes: its witness, compiled as any pages file is, raises no finding whose
        # repair writes a bound field and is the same bound page; and so is the page the spine was cut from, where the spine
        # draws its exhibits or declares the view that page shows.
        self.assertEqual(self.result["broken"], [])

    def test_a_spine_drawn_or_declared_as_its_page_is_laid_out_is_never_refused(self):
        # The draft is not stricter than the compile where the spine says everything: a page that the full compile takes, cut
        # back to its exhibits without copy, or to stubs that state the view it shows, passes its draft.
        tally = self.result["tally"]
        self.assertEqual([tally.get("typed/drawn refused", 0), tally.get("bound/drawn refused", 0), tally.get("bound/declared refused", 0)], [0, 0, 0], self.result["refusals"])

    def test_a_typed_page_whose_exhibits_draw_numbers_is_refused_as_undetermined_until_they_are_drawn(self):
        # With no insight log the critique is bound to the numbers an exhibit plots. A spine that kept such a page with nothing
        # drawn passed its draft, and the exhibit drawn at layout was then a changed argument: every one is refused now.
        tally = self.result["tally"]
        self.assertEqual(tally.get("typed numbers undrawn: PASSED", 0), 0)
        self.assertGreaterEqual(tally["typed numbers undrawn: refused as undetermined"], 40)


class RunCasesTests(unittest.TestCase):
    """The pages three runs lost a ready critique on, as spines of a neutral fixture."""

    def test_a_bound_exhibit_with_no_type_is_refused_where_the_form_does_not_set_it(self):
        result = run_node(CASES + '''
const series = (ref, name) => ({ series: [{ measure: ref, name }] });
const panels = base({ type: 'panels', form: 'row', commentary: 'captions', evidence: ['i-liquidity'], settles: { kind: 'comparison', what: 'liquid assets and short-term liabilities at year end', measures: [LIQUID, SHORT], relation: { kind: 'separate', reason: 'each is read on its own scale before the gap between them' } },
  exhibits: [series(LIQUID, 'Liquid assets'), series(SHORT, 'Short-term liabilities')] });
const strip = base({ type: 'numbers', form: 'metric-strip', commentary: 'none', evidence: ['i-loans'], settles: { kind: 'rate', what: 'the loan book at year end', measures: [LOANS] },
  metrics: [{ measure: `${LOANS}@FY26`, format: '0', label: 'Loan book, FY26' }, { measure: 'A-loans/percent', format: '0.0%', label: 'Growth in seven years' }], exhibit: series(LOANS, 'Loans'), evidence: ['i-loans', 'A-loans'] });
const typed = (page) => ({ ...page, ...(page.exhibit ? { exhibit: { ...page.exhibit, type: 'chart.line' } } : {}), ...(page.exhibits ? { exhibits: page.exhibits.map((ex) => ({ ...ex, type: 'chart.line' })) } : {}) });
const out = {};
for (const [name, page] of [['panels', panels], ['strip', strip]]) { const untyped = await draftOf(page), named = await draftOf(typed(page));
  out[name] = { untyped: refusedOf(untyped), named: refusedOf(named).filter(([code]) => code !== 'COMPILE' || true), views: recordOf(named)?.views ?? null }; }
console.log(JSON.stringify(out));
''')
        for name in ("panels", "strip"):
            with self.subTest(page=name):
                codes = [code for code, _ in result[name]["untyped"]]
                self.assertEqual(codes, ["COMPILE"])
                repair = result[name]["untyped"][0][1]
                self.assertIn("no `type`", repair)
                self.assertIn("so name it", repair)
                # And what naming it would have the critic told: the chart its measures' axis takes, or a table.
                self.assertIn("over periods: `chart.line` or `chart.column` has the critic told", repair)
                self.assertIn("plotted, `table` tabulated", repair)
                self.assertIn("The storyline critique is bound to the page's type and to what it shows of each measure", repair)
                # Named, the same spine passes, and the critic is told the class the layout will draw.
                self.assertEqual([code for code, _ in result[name]["named"] if code in ("COMPILE", "SPINE_UNDETERMINED", "SPINE_UNDRAWABLE")], [])
                self.assertTrue(all(view.startswith('["chart"') or view == '["figure"]' or view.startswith('["figure"') for views in result[name]["views"].values() for view in views), result[name]["views"])

    def test_a_stub_on_a_page_type_that_carries_no_exhibit_is_refused_and_so_is_a_claim_nothing_on_it_can_prove(self):
        result = run_node(CASES + '''
const matrix = (more) => base({ type: 'matrix', form: 'findings-matrix', commentary: 'in-exhibit', evidence: ['i-loans'], ...more });
const stubbed = await draftOf(matrix({ settles: { kind: 'comparison', what: 'the loan book against its funding', measures: [LOANS] }, exhibit: { basis: { measures: [LOANS], as: 'table', labels: ['FY26'] } } }));
const claimed = await draftOf(matrix({ settles: { kind: 'comparison', what: 'the loan book against its funding', measures: [LOANS] } }));
const plain = await draftOf(matrix({ settles: { kind: 'qualitative', what: 'three findings about how the loan book is funded' } }));
console.log(JSON.stringify({ stubbed: refusedOf(stubbed), claimed: refusedOf(claimed), plain: refusedOf(plain) }));
''')
        self.assertEqual([code for code, _ in result["stubbed"]], ["SPINE_UNDETERMINED"])
        for said in ("a matrix page carries no exhibit", "its rows are its evidence", "Take the stub off", "lookup, scorecard, numbers"):
            self.assertIn(said, result["stubbed"][0][1])
        self.assertEqual([code for code, _ in result["claimed"]], ["PROOF_MISSING"])
        for said in ("a matrix page carries no exhibit and no figure", "Take the measures out of `settles`", "settle it before the critique"):
            self.assertIn(said, result["claimed"][0][1])
        self.assertEqual(result["plain"], [])

    def test_a_figure_stub_on_a_labelled_rows_page_is_refused_and_one_declared_in_its_rows_lays_out(self):
        result = run_node(CASES + '''
const rows = (more) => base({ type: 'parallel', form: 'labelled-rows', commentary: 'in-exhibit', evidence: ['A-loans', 'A-ocf', 'A-earn'], settles: { kind: 'comparison', what: 'growth in the loan book, cash flow and profit', measures: ['A-loans/percent', 'A-ocf/percent', 'A-earn/percent'] }, ...more });
const paged = await draftOf(rows({ exhibit: { basis: { measures: ['A-loans/percent', 'A-ocf/percent', 'A-earn/percent'], as: 'figure' } } }));
const inRows = rows({ blocks: ['A-loans/percent', 'A-ocf/percent', 'A-earn/percent'].map((ref) => ({ metric: { basis: { measures: [ref] } } })) });
const drafted = await draftOf(inRows);
// Laid out: each row given its label, its points and its figure by reference.
const laid = await fullOf(rows({ adds: 'Each row says what the figure at its right means for the claim', blocks: [['A-loans/percent', 'The loan book grew'], ['A-ocf/percent', 'Cash flow fell'], ['A-earn/percent', 'Profit rose']].map(([ref, label]) => ({ label,
  points: ['The figure at the right is the change over the seven years the record covers, from the first year to the last.', 'It is read beside the other two rows, which the same record gives for the same years and the same lender.'], metric: { measure: ref, format: '0.0%', label: 'change over seven years' } })) }));
// A view no form of the type holds: one measure's eight years as eight figures.
const many = await draftOf(rows({ evidence: ['i-loans'], settles: { kind: 'comparison', what: 'the loan book in each of eight years', measures: [LOANS] }, exhibit: { basis: { measures: [LOANS], as: 'figure' } } }));
console.log(JSON.stringify({ paged: refusedOf(paged), moved: paged.spec.slides.find((s) => s.id === 'x1')?.pageType.moved ?? null, many: refusedOf(many), drafted: refusedOf(drafted), same: hashOf(drafted) === hashOf(laid),
  laid: laid.blocking.filter(boundOnly).filter((f) => f.id === 'x1').map((f) => f.code), pending: drafted.spec.slides.find((s) => s.id === 'x1')?.pageType.pending }));
''')
        # Three single figures a form of the type does hold - as cards, with the figures in its exhibit - so the page can be laid
        # out without touching what the critique binds: the draft passes it and says which form, and why not the one declared.
        self.assertEqual(result["paged"], [])
        self.assertEqual(result["moved"]["form"], "labelled-rows")
        self.assertNotEqual(result["moved"]["to"].split("/")[0], "labelled-rows")
        self.assertIn("a labelled-rows page states its figures in its rows", result["moved"]["why"])
        self.assertIn("blocks: [{ metric: { basis:", result["moved"]["why"])
        # Eight years of one measure as figures is what no form of the type holds: refused, with the declaration that would.
        self.assertEqual([code for code, _ in result["many"]], ["SPINE_UNDETERMINED"])
        self.assertIn("a labelled-rows page states its figures in its rows", result["many"][0][1])
        self.assertEqual(result["drafted"], [])
        self.assertEqual(result["laid"], [])
        self.assertTrue(result["same"])
        self.assertEqual(result["pending"], ["content"])

    def test_a_row_states_its_figure_or_its_typed_exhibit_from_a_stub_and_the_stand_in_copy_refuses_nothing(self):
        # A run's spine, mended as the draft directed - each figure declared in its row - was refused again: the label the
        # draft stood in for the row ("Row 2") held a numeral, which the compile read as repeating the row's own figure. What the
        # completion writes is words alone. A row's exhibit declared by its type and a basis is written from the basis as a
        # page's own is; one with no type is the compile's refusal, with what each type would have the critic told.
        result = run_node(CASES + '''
const rows = (blocks, measures, evidence) => base({ type: 'parallel', form: 'labelled-rows', commentary: 'in-exhibit', evidence, settles: { kind: 'comparison', what: 'the figures the rows state', measures }, blocks });
const figure = (ref) => ({ metric: { basis: { measures: [ref] } } });
const whole = await draftOf(rows([figure('A-loans/percent'), figure('A-earn/change'), figure('A-ocf/percent')], ['A-loans/percent', 'A-earn/change', 'A-ocf/percent'], ['A-loans', 'A-earn', 'A-ocf']));
const chart = (type) => rows([figure('A-loans/percent'), { exhibit: { ...(type ? { type } : {}), basis: { measures: [LOANS] } } }], ['A-loans/percent', LOANS], ['A-loans', 'i-loans']);
const typed = await draftOf(chart('chart.line')), untyped = await draftOf(chart(null));
const laid = await fullOf({ ...chart('chart.line'), adds: 'Each row says what the evidence at its right means for the claim', blocks: [
  { label: 'The loan book grew', points: ['The figure at the right is the change over the seven years the record covers, from the first year to the last.', 'It is read beside the series in the row below, which the same record gives for the same years.'], metric: { measure: 'A-loans/percent', format: '0.0%', label: 'change over seven years' } },
  { label: 'Year by year', points: ['The series at the right is the loan book at each year end, in the unit the lender reports it in.', 'It rises in every year of the record, which is what the change in the row above adds up.'], exhibit: { type: 'chart.line', heading: 'Loan book at year end', series: [{ measure: LOANS, name: 'Loans' }] } }] });
console.log(JSON.stringify({ whole: refusedOf(whole), value: A.compileDeck(whole.witness.doc, { insights, partial: true }).spec.slides.find((s) => s.id === 'x1').blocks.map((b) => b.metric.value), typed: refusedOf(typed), untyped: refusedOf(untyped),
  same: hashOf(typed) === hashOf(laid), laid: laid.blocking.filter(boundOnly).filter((f) => f.id === 'x1').map((f) => f.code), views: recordOf(typed).views }));
''')
        self.assertEqual(result["whole"], [])
        self.assertTrue(any(str(value).rstrip("0").rstrip(".") == "2" for value in result["value"]), result["value"])   # the figure a "Row 2" would have repeated
        self.assertEqual(result["typed"], [])
        self.assertEqual(result["laid"], [])
        self.assertTrue(result["same"])
        self.assertEqual(result["views"]["i-loans/loans"], ['["chart","all"]'])
        self.assertEqual([code for code, _ in result["untyped"]], ["COMPILE"])
        self.assertIn("name the block exhibit's `type`", result["untyped"][0][1])
        self.assertIn("block 2's exhibit names i-loans/loans, over periods: `chart.line` or `chart.column` has the critic told it is plotted", result["untyped"][0][1])

    def test_a_page_whose_witness_stands_as_declared_is_not_said_to_have_moved(self):
        # A chart the author drew at the spine, bare, on a type that asks for a mark: its witness stands in the declared form and
        # placement with a mark the completion makes, which is copy. A draft listed such pages as "drawn in another form or
        # placement" - line/on-exhibit "does not hold the page; line/on-exhibit does".
        result = run_node(CASES + '''
const page = base({ type: 'trend', form: 'line', commentary: 'on-exhibit', evidence: ['i-loans'], settles: { kind: 'rate', what: 'the loan book at year end', measures: [LOANS] }, exhibit: { series: [{ measure: LOANS, name: 'Loans' }] } });
const drafted = await draftOf(page), slide = drafted.spec.slides.find((s) => s.id === 'x1');
console.log(JSON.stringify({ refused: refusedOf(drafted).filter(([code]) => code !== 'PROOF_REPEATS'), moved: slide.pageType.moved ?? null, pending: slide.pageType.pending, form: [slide.pageType.form, slide.pageType.commentary] }));
''')
        self.assertEqual(result["refused"], [])
        self.assertIsNone(result["moved"])
        self.assertEqual(result["form"], ["line", "on-exhibit"])
        self.assertEqual(result["pending"], ["copy"])

    def test_a_table_is_read_from_its_references_whatever_its_row_labels_say(self):
        # A stub declared one year of a measure tabulated; the table laid out printed that year by token, in a row whose label
        # named another year beside a number that happened to equal one of its values. Read by its headers and row labels the
        # table "showed" both years, which was a changed argument.
        result = run_node(CASES + '''
const lookup = (exhibit, more = {}) => base({ type: 'lookup', form: 'table', commentary: 'in-exhibit', evidence: ['i-liquidity', 'A-cushion'], settles: { kind: 'comparison', what: 'liquid assets, short-term liabilities and the cushion between them', measures: [LIQUID, SHORT, 'A-cushion/result'] }, exhibit, ...more });
const stub = lookup({ basis: { measures: [LIQUID, SHORT, 'A-cushion/result'], as: 'table', labels: { [LIQUID]: ['FY25', 'FY26'], [SHORT]: ['FY26'], 'A-cushion/result': ['FY26'] } } });
const drafted = await draftOf(stub);
const table = { type: 'table', columns: ['Case', 'Liquid assets', 'Short-term liabilities', 'Cushion', { label: 'What it means', implication: true }],
  rows: [['FY25, the year before', `{{${LIQUID}@FY25 | 0}}`, 'n/a', 'n/a', 'The starting point for the year the claim is about'],
    ['FY26, as reported', `{{${LIQUID}@FY26 | 0}}`, `{{${SHORT}@FY26 | 0}}`, `{{A-cushion/result@FY26 | 0}}`, 'Liquid assets still cover short-term liabilities'],
    ['FY26 against FY25', 'higher', 'n/a', 'n/a', 'The cushion is what the two leave between them']] };
const laid = await fullOf(lookup(table, { adds: 'The last column says what each row means for the claim' }));
// A token for a year the stub did not declare is another view, and is read as one.
const more = structuredClone(table); more.rows[0][2] = `{{${SHORT}@FY25 | 0}}`;
const wider = await fullOf(lookup(more, { adds: 'The last column says what each row means for the claim' }));
console.log(JSON.stringify({ drafted: refusedOf(drafted), views: recordOf(drafted).views, laidViews: recordOf(laid).views, same: hashOf(drafted) === hashOf(laid), laid: laid.blocking.filter(boundOnly).filter((f) => f.id === 'x1').map((f) => f.code),
  wider: [hashOf(wider) === hashOf(drafted), recordOf(wider).views[SHORT]] }));
''')
        self.assertEqual(result["drafted"], [])
        self.assertEqual(result["laid"], [])
        self.assertEqual(result["views"], result["laidViews"])
        self.assertTrue(result["same"])
        self.assertEqual(result["views"]["i-liquidity/short-liabilities"], ['["table",["FY26"]]'])
        self.assertEqual(result["wider"], [False, ['["table",["FY25","FY26"]]']])

    def test_a_single_value_is_one_view_whatever_exhibit_states_it(self):
        # A page whose claim is about two single values and whose exhibit is a diagram (the run's was a timeline), critiqued before
        # the diagram was written, read them as "stated as a figure"; laid out, the diagram that named them read as another class
        # of exhibit, and the page reopened.
        result = run_node(CASES + '''
const page = (more) => base({ type: 'mechanism', form: 'steps', commentary: 'below', evidence: ['A-loans', 'A-ocf'], settles: { kind: 'sequence', what: 'the steps by which the loan book outgrew its funding', measures: ['A-loans/percent', 'A-ocf/percent'] }, ...more });
const drafted = await draftOf(page({}));
const timeline = examples.pages.find((p) => p.type === 'mechanism' && p.form === 'steps');
const laid = await fullOf(page({ adds: timeline.adds, points: timeline.points, exhibit: { ...structuredClone(timeline.exhibit), basis: { measures: ['A-loans/percent', 'A-ocf/percent'], role: 'proof' } } }));
console.log(JSON.stringify({ drafted: refusedOf(drafted), views: recordOf(drafted).views, laidViews: recordOf(laid).views, same: hashOf(drafted) === hashOf(laid), laid: laid.blocking.filter(boundOnly).filter((f) => f.id === 'x1').map((f) => f.code) }));
''')
        self.assertEqual(result["drafted"], [])
        self.assertEqual(result["views"], {"A-loans/percent": ['["figure"]'], "A-ocf/percent": ['["figure"]']})
        self.assertEqual(result["laidViews"], result["views"])
        self.assertEqual(result["laid"], [])
        self.assertTrue(result["same"])


class DeferredListTests(unittest.TestCase):
    def test_what_a_draft_defers_is_one_closed_list_and_none_of_it_is_a_field_the_critique_binds(self):
        result = run_node(SETUP + '''
import { DEFERRED } from './skills/professional-slides/runtime/spine-witness.mjs';
const doc = read('finance'), insights = await insightsOf('finance', doc);
const KEYS = ['id', 'kind', 'type', 'form', 'commentary', 'why', 'title', 'settles', 'evidence'];
const spine = { ...doc, pages: doc.pages.map((page) => (page.type ? { ...Object.fromEntries(KEYS.filter((key) => page[key] !== undefined).map((key) => [key, page[key]])), ...(page.exhibit ? { exhibit: page.exhibit } : {}), ...(page.exhibits ? { exhibits: page.exhibits } : {}), ...(page.metrics ? { metrics: page.metrics } : {}) } : page)) };
const draft = await A.authorDeck(spine, { baseDir: dir, insights, draft: true, fit: false });
const deferred = draft.advisories.filter((f) => f.deferred);
console.log(JSON.stringify({ kinds: Object.keys(DEFERRED), bound: Object.keys(S.BOUND_FIELDS), settledBy: [...new Set(deferred.map((f) => f.settledBy))].sort(),
  boundDeferred: deferred.filter((f) => G.repairOf(f).settledLater === null).map((f) => f.code), blocking: draft.blocking.map((f) => f.code),
  pending: draft.spec.slides.filter((s) => s.pageType).map((s) => s.pageType.pending ?? []), placeholders: JSON.stringify(draft.spec).includes('the supplier added capacity'), marks: /\\u2063/.test(JSON.stringify(draft.spec)) }));
''')
        self.assertEqual(result["kinds"], ["copy", "content", "layout", "fit"])
        self.assertFalse(set(result["kinds"]) & set(result["bound"]))
        self.assertEqual(result["blocking"], [])
        self.assertTrue(set(result["settledBy"]) <= {"copy", "layout", "fit"}, result["settledBy"])
        self.assertEqual(result["boundDeferred"], [])
        # Every page had its copy stood in for, and nothing the draft wrote is in the deck it reports.
        self.assertGreaterEqual(sum("copy" in pending for pending in result["pending"]), 5, result["pending"])
        self.assertTrue(all(set(pending) <= {"copy", "content"} for pending in result["pending"]), result["pending"])
        self.assertFalse(result["placeholders"])
        self.assertFalse(result["marks"])


class RevisionDraftTests(unittest.TestCase):
    def test_a_revision_s_draft_proves_the_pages_it_composes_and_leaves_the_carried_slides_alone(self):
        # A point change: two slides carried as they are and one page composed. The draft completes and proves the composed
        # page alone; a carried slide is the user's own, has no witness, and is not held to anything a witness holds.
        result = run_node(SETUP + '''
const page = examples.pages.find((p) => p.type === 'trend' && p.form === 'line');
const KEYS = ['id', 'type', 'form', 'commentary', 'why', 'title', 'settles', 'evidence'];
const spine = { ...Object.fromEntries(KEYS.filter((key) => page[key] !== undefined).map((key) => [key, page[key]])), id: 's02', sourceSlide: 2 };
const deck = { ...examples.deck, id: 'rev', workflow: 'existing_deck_revision', rulesVersion: 5 };
const doc = (composed) => ({ deck, pages: [{ id: 's01', carry: true, sourceSlide: 1, draft: { title: 'A slide of the user\\'s own' } }, composed, { id: 's03', carry: true, sourceSlide: 3, draft: { title: 'Another slide of the user\\'s own' } }] });
const undrawn = A.compileDeck(doc(spine), { draft: true, partial: true });
const drawn = A.compileDeck(doc({ ...spine, exhibit: (({ heading, annotations, ...rest }) => rest)(page.exhibit) }), { draft: true, partial: true });
const records = S.storyStructure(drawn.spec);
console.log(JSON.stringify({ proved: [...drawn.witness.pages.keys()], carried: drawn.spec.carried?.map((entry) => entry.id), errors: drawn.compileErrors,
  undrawn: undrawn.failed.map((f) => [f.id, f.code ?? null]), undetermined: S.storyStructure(undrawn.spec).find((p) => p.id === 's02')?.drawn ?? null,
  kinds: records.map((p) => [p.id, p.kind]), pending: drawn.spec.slides.find((s) => s.id === 's02')?.pageType.pending }));
''')
        self.assertEqual(result["proved"], ["s02"])
        self.assertEqual(result["carried"], ["s01", "s03"])
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["kinds"], [["s01", "carried"], ["s02", "content"], ["s03", "carried"]])
        self.assertEqual(result["pending"], ["copy"])


class DraftCliTests(unittest.TestCase):
    def test_the_draft_refuses_an_untyped_bound_exhibit_and_the_plan_refuses_the_same(self):
        tmp = Path(tempfile.mkdtemp(prefix="spine-witness-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        for name in ("finance.insights.json", "finance.analysis.json"):
            shutil.copy(FIXTURES / name, tmp / name)
        doc = json.loads((FIXTURES / "finance.pages.json").read_text())
        doc["pages"].append({"id": "x1", "type": "numbers", "form": "metric-strip", "commentary": "none", "why": "Two figures carry the claim and the series they come from sits under them",
                             "title": "The loan book grew by more than half in seven years", "evidence": ["i-loans", "A-loans"], "settles": {"kind": "rate", "what": "the loan book at year end", "measures": ["i-loans/loans"]},
                             "metrics": [{"measure": "i-loans/loans@FY26", "format": "0", "label": "Loan book, FY26"}, {"measure": "A-loans/percent", "format": "0.0%", "label": "Growth in seven years"}],
                             "exhibit": {"series": [{"measure": "i-loans/loans", "name": "Loans"}]}})
        (tmp / "finance.pages.json").write_text(json.dumps(doc))
        run = lambda *flags: subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(tmp / "finance.pages.json"), *flags], capture_output=True, text=True)
        draft, plan = run("--draft"), run("--plan")
        self.assertEqual(draft.returncode, 2, draft.stderr[-1500:])
        self.assertIn("COMPILE [x1]", draft.stderr)
        self.assertIn("the exhibit has no `type`", draft.stderr)
        self.assertEqual(plan.returncode, 2, plan.stderr[-1500:])
        self.assertIn("x1", [item["id"] for item in json.loads(plan.stdout)["unlayable"]])
        # Named, both pass, and the draft says what it left to the full compile: the closed list.
        doc["pages"][-1]["exhibit"]["type"] = "chart.line"
        (tmp / "finance.pages.json").write_text(json.dumps(doc))
        draft, plan = run("--draft"), run("--plan")
        self.assertEqual(draft.returncode, 0, draft.stderr[-1500:])
        self.assertEqual(plan.returncode, 0, plan.stderr[-1500:])
        self.assertIn("A draft is the full compile of the spine completed with placeholder copy, and this is all it defers", draft.stderr)


if __name__ == "__main__":
    unittest.main()
