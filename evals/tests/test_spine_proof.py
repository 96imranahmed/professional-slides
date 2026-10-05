"""A draft refuses everything whose repair changes what the critique binds.

A real run reached a storyline critique that was `ready`, laid the deck out,
and then met two refusals whose repair changed a bound fact: a bound bar chart
named a measure with an undisclosed member, which no chart draws (the repair,
plotting five of six members, changed the bound view), and two panels of one
unit drawn apart with no relation declared (the repair changed the bound
`settles`). Both had been listed by the draft, among forty harmless "no copy
yet" lines, as "enforced by the full compile". The pass cap was spent and the
deck could not be delivered.

So what a draft leaves to the full compile is decided by what the repair
writes. Every finding code says it (gates/gate_classes.mjs REPAIRS) in three
words - copy, layout, fit - and in the names of the fields the storyline
binding reads (storyline.mjs BOUND_FIELDS). A finding whose every repair
writes a bound field blocks in a draft; one a proof decides - an exhibit the
spine fully determines composed with placeholder copy, a structure rule
against the plan's allocation of forms - blocks where the proof says only a
bound field mends it. These tests hold the split to the binding, hold the
proofs to the cases the run met, and hold the property that follows: a spine
that passes its draft is laid out by adding copy, layout and unbound content,
and the full compile then raises nothing whose repair changes a bound field.
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
import os from 'node:os';
import path from 'node:path';
import { authorDeck, compileDeck, readInsights, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { REPAIRS, SETTLED_LATER, GATE_CLASSES, repairOf } from './skills/professional-slides/runtime/gates/gate_classes.mjs';
import { BOUND_FIELDS, storylineBinding, recordedMeasures } from './skills/professional-slides/runtime/storyline.mjs';
const dir = './evals/quality/fixtures/evidence';
const read = (name) => JSON.parse(fs.readFileSync(`${dir}/${name}.pages.json`, 'utf8'));
const playersOf = (doc) => (doc.deck.players || []).map((p) => (typeof p === 'string' ? p : p.name));
// A fixture's evidence staged in a scratch folder, its insight log or its analysis plan changed on the way.
const staged = [];
const stage = (name, { log = (x) => x, plan = (x) => x } = {}) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-proof-'));
  staged.push(tmp);
  for (const [part, change] of [['insights', log], ['analysis', plan]]) { const file = `${dir}/${name}.${part}.json`;
    if (fs.existsSync(file)) fs.writeFileSync(`${tmp}/${name}.${part}.json`, JSON.stringify(change(JSON.parse(fs.readFileSync(file, 'utf8'))))); }
  return tmp;
};
const done = () => { for (const tmp of staged) fs.rmSync(tmp, { recursive: true, force: true }); };
const insightsOf = (name, doc, where = dir) => readInsights(where, name, { alternatives: playersOf(doc) });
// What the critique is not bound to on an exhibit: its words and its marks.
const COPY = ['heading', 'caption', 'annotations', 'highlights', 'note', 'changeAnnotations', 'events'];
const bare = (ex) => { if (!ex || typeof ex !== 'object') return ex; const out = structuredClone(ex); for (const key of COPY) delete out[key]; return out; };
const KEYS = ['id', 'kind', 'type', 'form', 'commentary', 'why', 'title', 'settles', 'evidence', 'adds', 'series', 'summary'];
// A laid-out page cut back to its spine: its choices, its claim and what it rests on, with its exhibits and figures kept
// bare (`exhibits`), declared by a `basis` stub where they carry one (`stubs`), or left out (`none`).
const refsOf = (item) => [...(Array.isArray(item?.series) ? item.series.flatMap((s) => [].concat(s?.measure ?? [])) : []), ...(item?.measure !== undefined ? [item.measure] : [])].map((ref) => String(ref).split('@')[0]);
const stubOf = (item) => (item?.basis ? { basis: item.basis } : refsOf(item).length ? { basis: { measures: [...new Set(refsOf(item))] } } : {});
const spineOf = (page, mode = 'exhibits') => { if (!page.type) return page;
  const out = Object.fromEntries(KEYS.filter((key) => page[key] !== undefined).map((key) => [key, page[key]]));
  const kept = mode === 'exhibits' ? bare : mode === 'stubs' ? stubOf : null;
  if (kept) { if (page.exhibit) out.exhibit = kept(page.exhibit); if (page.exhibits) out.exhibits = page.exhibits.map(kept);
    if (mode === 'exhibits') for (const key of ['metrics', 'kpi', 'blocks', 'rows', 'photo', 'pictures']) if (page[key] !== undefined) out[key] = page[key]; }
  return out; };
const spine = (doc, mode) => ({ ...doc, pages: doc.pages.map((page) => spineOf(page, mode)), ...(doc.appendix ? { appendix: doc.appendix.map((page) => spineOf(page, mode)) } : {}) });
const draftOf = (doc, insights, where = dir) => authorDeck(doc, { baseDir: where, insights, draft: true, fit: false });
const fullOf = (doc, insights, where = dir) => authorDeck(doc, { baseDir: where, insights, draft: false, fit: false });
const said = (f) => [f.code, String(f.id ?? ''), f.class];
const page = (doc, id) => [...doc.pages, ...(doc.appendix || [])].find((p) => p.id === id);
'''

# The run's two pages, on the finance fixture: a bound chart of a peer set with an undisclosed member, and two panels of one
# unit drawn apart. `nulled` takes one member's value out of the record, with the reason the record gives.
CASES = SETUP + '''
const nulled = (member = 'Northgate') => ({ log: (log) => { const m = log.insights.find((i) => i.id === 'i-peers').measures['loan-growth']; const at = m.members.indexOf(member);
  m.values[at] = null; m.unavailable = { [member]: 'reports loan growth only for the group' }; return log; } });
const peers = (exhibit, more = {}) => ({ id: 'f7', type: 'ranking', form: 'bar', commentary: 'so-what-bar', title: 'Harbour grew its loan book faster than six of seven regional peers',
  why: 'The peer set ranked on one measure shows where Harbour stands', evidence: ['i-peers'], settles: { kind: 'rank', what: 'loan growth across eight credit unions, FY26', measures: ['i-peers/loan-growth'] },
  ...(exhibit ? { exhibit } : {}), ...more });
// The same set on two measures, each a column of bars: with one member left out it still plots enough to be a chart page.
const BOTH = [{ measure: 'i-peers/loan-growth', name: 'Loan growth' }, { measure: 'i-peers/margin', name: 'Net interest margin' }];
const two = (exhibit, more = {}) => ({ ...peers(exhibit, more), form: 'aligned-bars', commentary: 'below', settles: { kind: 'rank', what: 'loan growth and margin across eight credit unions, FY26', measures: ['i-peers/loan-growth', 'i-peers/margin'],
  relation: { kind: 'separate', reason: 'growth and margin are different percentages, read side by side for the same lenders' } } });
const withPage = (extra) => { const doc = spine(read('finance')); doc.pages = [...doc.pages, extra]; return doc; };
'''


class UndrawableExhibitTests(unittest.TestCase):
    def test_a_bound_chart_with_an_undisclosed_member_is_refused_in_a_draft_with_the_bound_repair(self):
        result = run_node(CASES + '''
const where = stage('finance', nulled());
const doc = withPage(two({ series: BOTH }));
const insights = await insightsOf('finance', doc, where);
const draft = await draftOf(doc, insights, where);
const refused = draft.blocking.filter((f) => f.id === 'f7');
// The repair it names is taken: the disclosed members, selected on the bound exhibit.
const members = insights.get('i-peers').measures['loan-growth'].members.filter((name) => name !== 'Northgate');
const mended = withPage(two({ series: BOTH, select: { members } }));
const after = await draftOf(mended, insights, where);
// Laid out as the spine stood, the full compile refuses the page: the refusal the draft now makes first.
const copy = { adds: 'The points say which lenders grow faster than they earn, which the bars leave to the reader', points: ['Harbour grew its loan book by 7.8% in FY26, faster than six of the seven peers that report, on a margin of 2.9% that sits in the middle of the set.',
  'Dunmore grew fastest on the thinnest margin of the eight, so growth and margin do not move together across the set.'] };
const full = await fullOf(withPage(two({ series: BOTH, highlights: [{ category: 'Harbour' }] }, copy)), insights, where);
const laidOut = await fullOf(withPage(two({ series: BOTH, select: { members }, highlights: [{ category: 'Harbour' }] }, copy)), insights, where);
console.log(JSON.stringify({ refused: refused.map(said), measured: refused[0]?.measured, repair: refused[0]?.repair, touches: refused[0] ? repairOf(refused[0]) : null,
  after: after.blocking.filter((f) => f.id === 'f7').map(said), deferred: draft.advisories.filter((f) => f.id === 'f7' && f.deferred).map((f) => [f.code, f.settledBy]),
  full: full.blocking.filter((f) => f.id === 'f7').map((f) => f.code), laidOut: laidOut.blocking.filter((f) => f.id === 'f7' && repairOf(f).settledLater === null).map((f) => f.code) }));
done();
''')
        self.assertEqual(result["refused"], [["SPINE_UNDRAWABLE", "f7", "P"]])
        self.assertEqual(result["measured"]["undisclosed"], ["Northgate"])
        self.assertEqual(result["measured"]["measures"], ["i-peers/loan-growth"])   # the measure with the gap, of the two the exhibit plots
        self.assertIsNone(result["touches"]["settledLater"])            # nothing the copy, the layout or the fit mends
        for said in ("No chart draws a missing value", "reports loan growth only for the group", "select: { members: [", "The storyline critique is bound", 'as: "table"'):
            self.assertIn(said, result["repair"])
        self.assertNotIn('"Northgate"]', result["repair"].split("select:")[1].split("}")[0])   # the members it lists are the disclosed ones
        self.assertEqual(result["after"], [])
        self.assertIn("PAGE_DOES_NOT_COMPOSE", result["full"])
        self.assertEqual(result["laidOut"], [])    # and laid out to the mended spine, nothing bound is left to refuse

    def test_a_view_declared_by_a_stub_or_read_whole_is_proven_drawable_too(self):
        result = run_node(CASES + '''
const where = stage('finance', nulled());
const insights = await insightsOf('finance', read('finance'), where);
const blocked = async (extra) => (await draftOf(withPage(extra), insights, where)).blocking.filter((f) => f.id === 'f7').map((f) => [f.code, f.measured?.measure ?? null, String(f.repair)]);
const members = insights.get('i-peers').measures['loan-growth'].members.filter((name) => name !== 'Northgate');
console.log(JSON.stringify({
  // Nothing drawn and nothing declared: the measure is read as plotted whole, which no chart can draw.
  whole: await blocked(peers(null)),
  // A stub that names the measure and no view is read the same way; one that declares it plotted says so.
  stub: await blocked(peers({ basis: { measures: ['i-peers/loan-growth'] } })),
  plotted: await blocked(peers({ basis: { measures: ['i-peers/loan-growth'], as: 'chart' } })),
  // A stub that names the disclosed members, and one that declares a table: both can be laid out.
  named: await blocked(two({ basis: { measures: ['i-peers/loan-growth', 'i-peers/margin'], members } })),
  table: await blocked({ ...peers({ basis: { measures: ['i-peers/loan-growth'], as: 'table' } }), type: 'lookup', form: 'table', commentary: 'in-exhibit' }) }));
done();
''')
        for case in ("whole", "stub", "plotted"):
            self.assertEqual([f[:2] for f in result[case]], [["SPINE_UNDRAWABLE", "i-peers/loan-growth"]], case)
            self.assertIn('"select": { "members": [', result[case][0][2])
            self.assertIn('"as": "table"', result[case][0][2])
        self.assertIn("read as plotted whole", result["whole"][0][2])
        self.assertIn("read as plotted whole", result["stub"][0][2])
        self.assertIn("its `basis` declares it plotted", result["plotted"][0][2])
        self.assertEqual(result["named"], [])
        self.assertEqual(result["table"], [])

    def test_a_type_no_form_of_which_holds_the_bound_exhibit_is_refused_and_one_another_form_holds_is_the_layouts(self):
        result = run_node(CASES + '''
const doc = read('finance'), insights = await insightsOf('finance', doc);
// A trend page bound to a peer set: a trend runs over periods, under every form.
const trend = { ...peers({ series: [{ measure: 'i-peers/loan-growth', name: 'Loan growth' }] }), type: 'trend', form: 'line', title: 'Loan growth has risen across the eight credit unions' };
insights.get('i-peers').shape = 'series';   // so the spine's own shape rule does not refuse the page first
const a = (await draftOf(withPage(trend), insights)).blocking.filter((f) => f.id === 'f7');
// A composition bound to eight parts as a donut: the donut holds five, and another form of the type holds eight.
insights.get('i-peers').shape = 'mix';
const donut = { ...peers({ measure: 'i-peers/margin' }), type: 'composition', form: 'donut', commentary: 'so-what-bar', settles: { kind: 'share', what: 'margin across eight credit unions', measures: ['i-peers/margin'] } };
const run = await draftOf(withPage(donut), insights);
console.log(JSON.stringify({ trend: a.map(said), repair: a[0]?.repair ?? null, donut: run.blocking.filter((f) => f.id === 'f7').map(said),
  waits: run.spec.slides.find((s) => s.id === 'f7')?.pageType.moved ?? null }));
''')
        self.assertEqual(result["trend"], [["SPINE_UNDRAWABLE", "f7", "P"]])
        self.assertIn("No form of a trend page holds the exhibit the spine draws here", result["repair"])
        self.assertIn("bound to the page's type and to what it shows of each measure", result["repair"])
        self.assertEqual(result["donut"], [])          # another form of the type holds it: the layout's to choose
        # and the draft says which step of the compile refused the form as declared, and which form holds the page
        self.assertEqual([result["waits"]["form"], result["waits"]["stage"]], ["donut", "evidence"])
        self.assertTrue(result["waits"]["to"].split("/")[0] in ("stacked-bar", "stacked-column", "marimekko", "waffle", "treemap", "pie"), result["waits"])

    def test_a_typed_chart_with_a_value_missing_is_refused_at_the_spine_as_a_bound_one_is(self):
        # The worked trend line with one value taken out, cut back to its spine: no chart draws a missing value, so the draft
        # refuses the page as it refuses a bound chart whose record leaves a member undisclosed. (That every worked form cut
        # back to its spine passes its draft and lays out to the same bound page is held by test_spine_witness GridTests.)
        result = run_node(SETUP + '''
const examples = workedExamples();
const trend = structuredClone(examples.pages.find((p) => p.type === 'trend' && p.form === 'line')); trend.exhibit.series[0].values[2] = null;
const holed = await authorDeck({ deck: examples.deck, pages: [spineOf(trend)] }, { baseDir: './skills/professional-slides/examples', draft: true, fit: false });
console.log(JSON.stringify({ holed: holed.blocking.filter((f) => f.class === 'P').map((f) => [f.code, f.measured?.undisclosed ?? null]) }));
''')
        self.assertEqual([code for code, _ in result["holed"]], ["SPINE_UNDRAWABLE"])
        self.assertEqual(len(result["holed"][0][1]), 1)


class DependencyInADraftTests(unittest.TestCase):
    def test_the_dependency_contract_blocks_in_a_draft_wherever_the_page_declares_enough(self):
        result = run_node(SETUP + '''
const doc = read('public-ops'), insights = await insightsOf('public-ops', doc);
const of = async (change, mode = 'exhibits') => { const d = spine(read('public-ops'), mode); change(d);
  const run = await draftOf(d, insights); return { blocking: run.blocking.filter((f) => f.class === 'P').map((f) => `${f.code} ${f.id}`), deferred: run.advisories.filter((f) => f.deferred && f.class === 'P').map((f) => `${f.code} ${f.id} ${f.settledBy}`) }; };
console.log(JSON.stringify({
  asWritten: await of(() => {}),
  // Two measures of the claim in one unit, drawn apart, with the relation taken off.
  relation: await of((d) => { delete page(d, 'o3').settles.relation; }),
  relationStubbed: await of((d) => { delete page(d, 'o3').settles.relation; }, 'stubs'),
  // A context exhibit that does not say why it is there; an exhibit offered as proof of another claim; a claim with no measures.
  context: await of((d) => { page(d, 'o3').exhibits[0].basis = { ...page(d, 'o3').exhibits[0].basis, role: 'context' }; }),
  offClaim: await of((d) => { page(d, 'o1').settles.measures = ['o-demand/calls']; page(d, 'o1').evidence = [...page(d, 'o1').evidence, 'o-demand']; }),
  noClaim: await of((d) => { delete page(d, 'o1').settles.measures; }),
  // A page whose exhibits are not drawn yet: nothing proving the claim is not decided, and waits.
  bare: await of(() => {}, 'none'),
  uncited: await of((d) => { page(d, 'o1').source = 'Ambulance service board papers, 2024'; }) }));
''')
        self.assertEqual(result["asWritten"]["blocking"], [])
        self.assertEqual(result["relation"]["blocking"], ["RELATION_UNDECLARED o3"])
        # Cut to stubs, the summary's table of tokens declares no view of what it shows, which no summary draws whole (test_spine_views).
        self.assertEqual(result["relationStubbed"]["blocking"], ["SPINE_UNDETERMINED o0", "RELATION_UNDECLARED o3"])
        self.assertIn("CONTEXT_UNEXPLAINED o3", result["context"]["blocking"])
        self.assertIn("PROOF_OFF_CLAIM o1", result["offClaim"]["blocking"])
        self.assertEqual(result["noClaim"]["blocking"], ["CLAIM_MEASURES_MISSING o1"])
        # The executive summary is the page that declares its exhibit at the spine (SummaryFillTests); every other page waits.
        self.assertEqual(result["bare"]["blocking"], ["SPINE_UNFILLED o0"])
        self.assertTrue(all(line.endswith(" layout") for line in result["bare"]["deferred"] if line.startswith("PROOF_MISSING")), result["bare"]["deferred"])
        # A citation is the copy's: it waits, and says so.
        self.assertEqual(result["uncited"]["blocking"], [])
        self.assertIn("SOURCE_UNCITED o1 copy", result["uncited"]["deferred"])


class RepairRegistryTests(unittest.TestCase):
    def test_every_code_says_what_its_repair_writes_in_the_bindings_own_fields(self):
        result = run_node(SETUP + '''
console.log(JSON.stringify({ classes: GATE_CLASSES, repairs: REPAIRS, later: Object.keys(SETTLED_LATER), bound: Object.keys(BOUND_FIELDS) }));
''')
        words = set(result["later"]) | set(result["bound"])
        self.assertEqual(result["later"], ["copy", "layout", "fit"])
        for code, cls in result["classes"].items():
            if cls == "R":
                self.assertNotIn(code, result["repairs"])
                continue
            with self.subTest(code=code):
                self.assertTrue(result["repairs"].get(code), f"{code} lists no repair in gates/gate_classes.mjs")
                self.assertFalse(set(result["repairs"][code]) - words, f"{code} names a repair that is neither copy, layout, fit nor a field of the binding")
        # The findings the run met after `ready`, and the dependency contract's on declared facts, are the binding's.
        for code in ("RELATION_UNDECLARED", "RELATION_SPLIT", "PROOF_MISSING", "PROOF_OFF_CLAIM", "CONTEXT_UNEXPLAINED", "CLAIM_MEASURES_MISSING", "BASIS_MISSING",
                     "BASIS_UNKNOWN", "BASIS_UNIT", "BASIS_AXIS", "BASIS_VALUES", "BINDING_UNRESOLVED", "SPINE_UNFIT", "SPINE_UNDRAWABLE", "SPINE_UNFILLED", "NO_SUMMARY", "VARIETY_TYPE_SHARE"):
            self.assertFalse(set(result["repairs"][code]) & set(result["later"]), code)
        for code in ("TEXT_COVERAGE_LOW", "SCENE_VOID", "WORDS", "SOURCE_UNCITED", "CRAFT_NO_ICONS", "TEXT_FRAGMENTED"):
            self.assertFalse(set(result["repairs"][code]) & set(result["bound"]), code)

    def test_the_field_list_is_the_bindings_every_bound_field_moves_it_and_the_layouts_do_not(self):
        result = run_node(SETUP + '''
const base = read('finance'), insights = await insightsOf('finance', base);
const measures = (log) => recordedMeasures([...log.values()]);
const bindingOf = (doc, log = insights) => storylineBinding(compileDeck(doc, { insights: log, partial: true }).spec, measures(log));
const moved = (change, log = insights) => { const doc = read('finance'); change(doc); return bindingOf(doc, log) !== bindingOf(read('finance')); };
const where = stage('finance', { log: (log) => { log.insights.find((i) => i.id === 'i-liquidity').measures.liquid.values[7] += 1; return log; } });
const changedLog = await insightsOf('finance', base, where);
console.log(JSON.stringify({ fields: Object.keys(BOUND_FIELDS),
  bound: {
    request: moved((d) => { d.deck.request = `${d.deck.request} Say which lender is safest.`; }),
    answer: moved((d) => { d.deck.answer = `${d.deck.answer} The board should act this year.`; }),
    pages: moved((d) => { d.pages = [d.pages[0], d.pages[2], d.pages[1], ...d.pages.slice(3)]; }),
    title: moved((d) => { page(d, 'f3').title = 'Liquid assets now cover short-term liabilities by a narrow margin'; }),
    type: moved((d) => { Object.assign(page(d, 'f5'), { type: 'lookup', form: 'table', commentary: 'in-exhibit' }); delete page(d, 'f5').bar; }),
    settles: moved((d) => { page(d, 'f3').settles.what = 'the cushion between liquid assets and short-term liabilities'; }),
    evidence: moved((d) => { page(d, 'f3').evidence = [...page(d, 'f3').evidence, 'i-loans']; }),
    basis: moved((d) => { page(d, 'f4').exhibits[1].basis = { ...page(d, 'f4').exhibits[1].basis, role: 'proof' }; }),
    view: moved((d) => { page(d, 'f3').exhibit.select = { from: 'FY22' }; }),
    record: bindingOf(read('finance'), changedLog) !== bindingOf(read('finance')) },
  layout: {
    form: moved((d) => { const p = page(d, 'f5'); p.form = 'bars'; for (const c of p.exhibit.columns.filter((c) => c.heat)) { delete c.heat; c.bar = true; } }),
    commentary: moved((d) => { const p = page(d, 'f3'); p.commentary = 'rail'; p.rail = p.bar; delete p.bar; }),
    heading: moved((d) => { page(d, 'f3').exhibit.heading = 'Liquid assets and short-term liabilities at year end'; }),
    bar: moved((d) => { page(d, 'f3').bar = 'The cushion has narrowed for three years and the board should rebuild it before lending grows again.'; }),
    why: moved((d) => { page(d, 'f3').why = 'Two lines closing on each other show a cushion narrowing'; }),
    design: moved((d) => { d.deck.design = 'editorial'; }) } }));
done();
''')
        self.assertEqual(sorted(result["bound"]), sorted(result["fields"]))            # every field of the list is moved here
        self.assertEqual({field for field, moved in result["bound"].items() if not moved}, set())
        self.assertEqual({field for field, moved in result["layout"].items() if moved}, set())


class DraftPropertyTests(unittest.TestCase):
    def test_a_spine_that_passes_its_draft_meets_no_later_refusal_whose_repair_changes_a_bound_field(self):
        # Over the evidence fixtures, each as written and under the changes a spine can carry into its layout unseen: a value
        # the record does not disclose, a relation left out, a context exhibit with no relevance, a claim with no measures, a
        # type its evidence cannot be drawn as. The spine is the laid-out deck cut back to what the critique binds; the laid-out
        # deck is that spine with only copy, marks and layout added. Wherever the full compile refuses a page for something
        # the copy, the layout and the fit do not mend, the draft has refused that page first.
        result = run_node(SETUP + '''
const firstBound = (doc, pick) => [...doc.pages].map((p) => [p, [p.exhibit, ...(p.exhibits || [])].filter(Boolean).find(pick)]).find(([, ex]) => ex);
const seriesRefs = (ex) => (Array.isArray(ex?.series) ? ex.series.flatMap((s) => [].concat(s?.measure ?? [])) : []).map(String);
const MUTATIONS = {
  none: () => ({}),
  undisclosed: (doc) => { const hit = firstBound(doc, (ex) => seriesRefs(ex).length && !ex.select); if (!hit) return null;
    const [id, name] = seriesRefs(hit[1])[0].split('/');
    return { log: (log) => { const item = log.insights.find((i) => i.id === id); if (!item?.measures?.[name]) return log; const m = item.measures[name], axis = m.periods ?? m.members;
      m.values[1] = null; m.unavailable = { [axis[1]]: 'not disclosed for this period' }; return log; }, needs: (log) => Boolean(log.insights.find((i) => i.id === id)?.measures?.[name]) }; },
  relation: (doc) => { const p = doc.pages.find((q) => q.settles?.relation && (q.exhibits || []).length >= 2); if (!p) return null; return { doc: (d) => { delete page(d, p.id).settles.relation; } }; },
  context: (doc) => { const p = doc.pages.find((q) => (q.exhibits || []).some((ex) => ex.basis)); if (!p) return null;
    return { doc: (d) => { const ex = page(d, p.id).exhibits.find((e) => e.basis); ex.basis = { ...ex.basis, role: 'context' }; delete ex.basis.relevance; } }; },
  claim: (doc) => { const p = doc.pages.find((q) => q.settles?.measures && (q.exhibit?.basis || seriesRefs(q.exhibit).length)); if (!p) return null; return { doc: (d) => { delete page(d, p.id).settles.measures; delete page(d, p.id).settles.relation; } }; },
  // A page retyped as a trend over a peer set (the log's shape set so on the read log: the spine's shape rule is not what is tested).
  typed: (doc) => { const p = doc.pages.find((q) => q.type === 'ranking' && q.exhibit); if (!p) return null; return { doc: (d) => { Object.assign(page(d, p.id), { type: 'trend', form: 'line' }); },
    read: (insights) => { for (const item of insights.values()) if (['peer-set', 'roster'].includes(item.shape)) item.shape = 'series'; } }; },
};
const boundOnly = (f) => f.id !== undefined && f.class === 'P' && (['PAGE_DOES_NOT_COMPOSE', 'COMPILE'].includes(f.code) || repairOf(f).settledLater === null);
const cases = [], broken = [];
for (const name of ['finance', 'public-ops', 'product', 'explainer']) for (const [label, mutate] of Object.entries(MUTATIONS)) {
  const change = mutate(read(name));
  if (!change) continue;
  const where = stage(name, { log: change.log ?? ((x) => x) });
  const laid = read(name); change.doc?.(laid);
  let insights;
  try { insights = await insightsOf(name, laid, where); change.read?.(insights); } catch (error) { cases.push({ name, label, skipped: error.message.slice(0, 80) }); continue; }
  for (const mode of ['exhibits', 'stubs']) {
    const full = await fullOf(laid, insights, where), draft = await draftOf(spine(laid, mode), insights, where);
    const later = [...new Set(full.blocking.filter(boundOnly).map((f) => String(f.id)))], first = new Set(draft.blocking.filter((f) => f.id !== undefined).map((f) => String(f.id)));
    // A stub declares what an exhibit shows and not what it plots: what only the drawn numbers decide is the drawn spine's to be held to.
    const missed = later.filter((id) => !first.has(id) && !(mode === 'stubs' && full.blocking.filter((f) => String(f.id) === id).every((f) => ['BASIS_VALUES', 'BASIS_UNIT', 'COMPILE', 'PAGE_DOES_NOT_COMPOSE'].includes(f.code) || !boundOnly(f))));
    cases.push({ name, label, mode, later, draft: [...first] });
    if (missed.length) broken.push({ name, label, mode, missed, full: full.blocking.filter((f) => missed.includes(String(f.id))).map((f) => f.code) });
    // And as written, the draft holds nothing against a page the full compile takes.
    if (label === 'none' && mode === 'exhibits') { const false_ = draft.blocking.filter((f) => f.class === 'P' && !full.blocking.some((g) => String(g.id) === String(f.id))); if (false_.length) broken.push({ name, label, falselyRefused: false_.map(said) }); }
  }
}
console.log(JSON.stringify({ cases: cases.length, mutated: cases.filter((c) => c.label !== 'none' && c.later?.length).length, labels: [...new Set(cases.filter((c) => c.later?.length).map((c) => c.label))], broken }));
done();
''')
        self.assertEqual(result["broken"], [])
        self.assertGreaterEqual(result["cases"], 20)
        # The changes do make the full compile refuse a page for a bound fact: the property is not held vacuously.
        self.assertGreaterEqual(result["mutated"], 8)
        for label in ("undisclosed", "relation", "context", "claim", "typed"):
            self.assertIn(label, result["labels"])


class SummaryFillTests(unittest.TestCase):
    def test_an_executive_summary_declares_the_exhibit_it_needs_at_the_spine(self):
        result = run_node(SETUP + '''
import { deckLimits } from './skills/professional-slides/runtime/limits.mjs';
const doc = read('finance'), insights = await insightsOf('finance', doc);
const summary = (change) => { const d = spine(read('finance')); change(page(d, 'f0')); return d; };
const of = async (d) => (await draftOf(d, insights)).blocking.filter((f) => f.id === 'f0').map((f) => [f.code, f.measured, String(f.repair)]);
const text = await of(summary((p) => { delete p.exhibit; }));
// A revision recorded before the rule that holds a page to its empty bands hears it as advice.
const old = summary((p) => { delete p.exhibit; }); Object.assign(old.deck, { workflow: 'existing_deck_revision', rulesVersion: 2 });
const revision = await draftOf(old, insights);
const VIEW = { measures: ['i-loans/loans', 'i-earn/pat', 'i-cash/ocf', 'i-liquidity/liquid', 'i-liquidity/short-liabilities', 'A-cover/result'], as: 'table', labels: { from: 'FY25', to: 'FY26' } };
// The summary's word ceiling as the author is told it (`--limits`, derive-content.mjs wordBudgetOf).
console.log(JSON.stringify({ ceiling: deckLimits().executiveSummary.bodyWords.max, text, table: await of(summary(() => {})), stubbed: await of(summary((p) => { p.exhibit = {}; })), declared: await of(summary((p) => { p.exhibit = { basis: VIEW }; })),
  thin: await of(summary((p) => { p.exhibit.rows = p.exhibit.rows.slice(0, 3); })),
  revision: [revision.blocking.filter((f) => f.code === 'SPINE_UNFILLED').length, revision.advisories.filter((f) => f.code === 'SPINE_UNFILLED').map((f) => f.waived?.introducedIn)] }));
''')
        self.assertEqual([code for code, _, _ in result["text"]], ["SPINE_UNFILLED"])
        code, measured, repair = result["text"][0]
        self.assertEqual(measured["exhibits"], 0)
        self.assertGreater(result["ceiling"], 0)
        self.assertEqual(measured["ceiling"], result["ceiling"])
        for said in ("cannot fill its page on text alone", f"{result['ceiling']} body words", "Its answer table is part of the spine", '"type": "table"', "reopens it"):
            self.assertIn(said, repair)
        self.assertEqual(result["table"], [])       # the summary with its table declared fills the page
        # A place kept for the exhibit that says nothing of what it will show leaves the claim's measures read as plotted whole, which
        # no summary draws: the draft used to pass that and the layout then changed what the critic had read. It is refused now.
        self.assertEqual([code for code, _, _ in result["stubbed"]], ["SPINE_UNDETERMINED"])
        self.assertIn("so the critic is told the page shows each plotted", result["stubbed"][0][2])
        self.assertEqual(result["declared"], [])    # a stub that declares the view the table will show: drawn in the witness, nothing refused
        thin = {code: repair for code, _, repair in result["thin"]}
        self.assertIn("Give the exhibit the rows the answer needs", thin["SPINE_UNFILLED"])
        self.assertEqual(result["revision"][0], 0)
        self.assertEqual(len(result["revision"][1]), 1)


class DraftCliTests(unittest.TestCase):
    """`--draft` and `--plan` as an author runs them."""

    def stage(self, expression):
        tmp = Path(tempfile.mkdtemp(prefix="spine-proof-cli-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        files = run_node(CASES + f"const where = stage('finance', nulled()); const doc = {expression};\n"
                         "console.log(JSON.stringify({ doc, insights: fs.readFileSync(`${where}/finance.insights.json`, 'utf8'), analysis: fs.readFileSync(`${where}/finance.analysis.json`, 'utf8') })); done();")
        (tmp / "finance.pages.json").write_text(json.dumps(files["doc"]))
        (tmp / "finance.insights.json").write_text(files["insights"])
        (tmp / "finance.analysis.json").write_text(files["analysis"])
        return tmp / "finance.pages.json"

    def run_cli(self, pages, *flags):
        return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(pages), *flags], capture_output=True, text=True)

    def test_the_draft_and_the_plan_refuse_the_same_bound_facts(self):
        # One spine, two pages the layout cannot finish: a bound chart of a peer set with a member the record does not disclose
        # (f7), and a bound exhibit under a metric strip with no `type`, which the form does not set (x1).
        untyped = {"id": "x1", "type": "numbers", "form": "metric-strip", "commentary": "none", "why": "Two figures carry the claim and the series they come from sits under them",
                   "title": "The loan book grew by more than half in seven years", "evidence": ["i-loans", "A-loans"], "settles": {"kind": "rate", "what": "the loan book at year end", "measures": ["i-loans/loans"]},
                   "metrics": [{"measure": "i-loans/loans@FY26", "format": "0", "label": "Loan book, FY26"}, {"measure": "A-loans/percent", "format": "0.0%", "label": "Growth in seven years"}],
                   "exhibit": {"series": [{"measure": "i-loans/loans", "name": "Loans"}]}}
        pages = self.stage(f"(() => {{ const d = withPage(two({{ series: BOTH }})); d.pages.push({json.dumps(untyped)}); return d; }})()")
        draft, plan = self.run_cli(pages, "--draft"), self.run_cli(pages, "--plan")
        self.assertEqual(draft.returncode, 2, draft.stderr[-1500:])
        self.assertIn("SPINE_UNDRAWABLE [f7]", draft.stderr)
        self.assertIn("COMPILE [x1]", draft.stderr)
        self.assertIn("the exhibit has no `type`", draft.stderr)
        self.assertEqual(plan.returncode, 2, plan.stderr[-1500:])
        self.assertEqual(sorted((item["code"], item["id"]) for item in json.loads(plan.stdout)["unlayable"]), [("COMPILE", "x1"), ("SPINE_UNDRAWABLE", "f7")])
        self.assertIn("the draft of this proposal refuses", plan.stderr)

    def test_what_a_draft_leaves_to_the_full_compile_is_grouped_and_is_only_copy_layout_or_fit(self):
        members = ["Harbour", "Millrace", "Castlefield", "Dunmore", "Eastbank", "Ferrybridge", "Greyfriars"]
        pages = self.stage("withPage(two({ series: BOTH, select: { members: " + json.dumps(members) + " } }))")
        draft = self.run_cli(pages, "--draft")
        self.assertEqual(draft.returncode, 0, draft.stderr[-2500:])
        summary = json.loads(draft.stdout)
        deferred = summary["deferred"]
        # One line for each of the copy, the layout and the fit that settles something, a count a code.
        self.assertTrue(all(line.startswith(("settled by the copy: ", "settled by the layout: ", "settled by the fit: ")) for line in deferred), deferred)
        self.assertTrue(all(line.endswith("(enforced by the full compile)") for line in deferred))
        copy = next(line for line in deferred if line.startswith("settled by the copy"))
        # The pages a draft stood in for: their copy and unbound content are the full compile's, and no page is said not to compose for want of copy.
        self.assertRegex(copy, r"pages whose copy or unbound content is not written yet x\d+ \(f0, f1, ")
        self.assertNotIn("PAGE_DOES_NOT_COMPOSE", " ".join(deferred))
        # Nothing the draft defers is a fact the critique binds, and no other advisory is marked as enforced later.
        for code in ("RELATION_UNDECLARED", "PROOF_OFF_CLAIM", "CONTEXT_UNEXPLAINED", "CLAIM_MEASURES_MISSING", "BASIS_", "SPINE_", "VARIETY_TYPE"):
            self.assertFalse(any(code in line for line in deferred), code)
        self.assertFalse(any("enforced by the full compile" in line for line in summary["advisories"]))
        self.assertIn("Left to the full compile - what the copy, the layout or the fit settles", draft.stderr)
        self.assertIn("A draft is the full compile of the spine completed with placeholder copy, and this is all it defers", draft.stderr)


if __name__ == "__main__":
    unittest.main()
