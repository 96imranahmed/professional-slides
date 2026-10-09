"""What a page shows of a measure, declared at the spine and held at layout.

The storyline critique is bound to which periods or members of each measure a
page shows and whether they are plotted, tabulated or stated as a figure. Two
things followed from binding that loosely:

- A table that names a measure was read by its headers alone: a bar cell
  drawn at 2 for a recorded 9, and FY19's numbers set under an "FY26" header,
  kept a ready critique.
- A spine laid out exactly as its pages file had it reopened pages, because a
  page not drawn yet is read as showing each measure whole in its natural
  class, and nothing said so before the critique was staged.

These tests hold both ends: a table is bound to the recorded numbers its cells
state and to every value it types, and a spine can say - and
is told to - what each page will show, so that laying it out to that view
reopens nothing while showing less still does.
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

TABLE = '''
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const log = [{ id: 'i', measures: { years: { unit: 'years', population: 'peers', period: '2025', members: ['A', 'B', 'C'], values: [5, 7, 9] } } }];
const M = S.recordedMeasures(log);
const page = (exhibit) => ({ id: 'p04', title: 'Terms differ across the three peers by years', pageType: { type: 'lookup', form: 'table', commentary: 'in-exhibit',
  content: { claim: 'c', settles: { kind: 'comparison', what: 'w', measures: ['i/years'] }, evidence: ['i'] }, dependencies: { exhibits: [{ measures: ['i/years'], role: 'proof' }] } }, exhibit });
const table = (rows, columns = ['Peer', 'Term', 'Bar']) => ({ type: 'table', columns, rows });
const read = (exhibit) => ({ hash: S.storylineBinding({ id: 'd', request: 'r', answer: 'a', slides: [page(exhibit)] }, M), page: S.storyStructure({ slides: [page(exhibit)] }, M)[0] });
const bar = (value) => ({ type: 'bar', value });
const rows = (c = ['C', '9 years', bar(9)]) => [['A', '5 years', bar(5)], ['B', '7 years', bar(7)], c];
'''

SPINE = '''
import fs from 'node:fs';
import { compileDeck, readInsights } from './skills/professional-slides/runtime/author-deck.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const dir = './evals/quality/fixtures/evidence';
const doc = () => JSON.parse(fs.readFileSync(dir + '/finance.pages.json', 'utf8'));
const insights = await readInsights(dir, 'finance', { alternatives: doc().deck.players });
const M = S.recordedMeasures([...insights.values()]);
const KEYS = ['id', 'kind', 'type', 'form', 'commentary', 'takeaway', 'why', 'title', 'settles', 'evidence', 'adds'];
const refs = (item) => [...(Array.isArray(item?.series) ? item.series.flatMap((s) => [].concat(s?.measure ?? [])) : []), ...(item?.measure !== undefined ? [item.measure] : [])].map((ref) => String(ref).split('@')[0]);
// An exhibit or a figure as a spine keeps its place: its `basis` alone, the measures a bound one names.
const stub = (item) => (item?.basis ? { basis: item.basis } : refs(item).length ? { basis: { measures: [...new Set(refs(item))], role: item.role ?? 'proof' } } : {});
// The spine of the fixture: every page with its spine keys and its exhibits and metrics as stubs; `views` gives a page's stubs their declared view.
const spine = (views = {}) => { const d = doc(); d.pages = d.pages.map((page) => (page.type ? { ...Object.fromEntries(KEYS.filter((k) => page[k] !== undefined).map((k) => [k, page[k]])),
  ...(page.exhibit ? { exhibit: { basis: { ...stub(page.exhibit).basis, ...(views[page.id] ?? {}) } } } : {}), ...(page.exhibits ? { exhibits: page.exhibits.map(stub) } : {}), ...(page.metrics ? { metrics: page.metrics.map(stub) } : {}) } : page)); return d; };
const hashes = (d, options) => { const compiled = compileDeck(d, { insights, partial: true, ...options }); return { errors: compiled.compileErrors, pages: S.storylinePageHashes(compiled.spec, M), structure: Object.fromEntries(S.storyStructure(compiled.spec, M).map((p) => [p.id, p])), spec: compiled.spec }; };
const full = hashes(doc());
const reopened = (d) => { const drafted = hashes(d, { draft: true }); return { errors: drafted.errors, moved: Object.keys(full.pages).filter((id) => full.pages[id] !== drafted.pages[id]), drafted }; };
const SUMMARY_VIEW = { as: 'table', labels: { from: 'FY25', to: 'FY26' }, members: ['Harbour'] };
'''


class TableBindingTests(unittest.TestCase):
    def test_a_table_is_bound_to_the_numbers_its_cells_state(self):
        result = run_node(TABLE + '''
const base = read(table(rows()));
console.log(JSON.stringify({ views: base.page.views, drawn: base.page.drawn ?? null,
  // A bar drawn at 2 beside the words "9 years": the values a table types are bound as themselves.
  barShort: read(table(rows(['C', '9 years', bar(2)]))),
  // A bar drawn at another member's value: 7 is recorded, for B, and this is C's row.
  barOther: read(table(rows(['C', '9 years', bar(7)]))),
  // The same table in text alone: nothing typed, so nothing but the view is bound - what a spine's stub can declare.
  text: read(table([['A', '5 years'], ['B', '7 years'], ['C', '9 years']], ['Peer', 'Term'])).page,
  textRestated: read(table([['A', '5 years'], ['B', '7 years'], ['C', '2 years']], ['Peer', 'Term'])).page.views,
  // Every cell of the row restated: nothing in C's row states its 9 any more.
  restated: read(table(rows(['C', '2 years', bar(2)]))),
  // Wording round the same numbers, and a header reworded: copy.
  reworded: read(table([['A', 'Five-year term (5)', bar(5)], ['B', '7 yrs', bar(7)], ['C', 'Longest, at 9 years', bar(9)]], ['Peer', 'Contract term', 'Length'])).hash === base.hash,
  // A row dropped: one member fewer than the critic read.
  dropped: read(table(rows().slice(0, 2))),
}));
''')
        self.assertEqual(result["views"], {"i/years": ['["table","all"]']})
        self.assertEqual(result["drawn"], [{"class": "table", "values": [5, 7, 9]}])
        self.assertTrue(result["reworded"])
        self.assertEqual(result["barShort"]["page"]["drawn"], [{"class": "table", "values": [5, 7, 2]}])
        self.assertEqual(result["barShort"]["page"]["views"], result["views"])  # the cell still says "9 years"
        self.assertEqual(result["barOther"]["page"]["drawn"], [{"class": "table", "values": [5, 7, 7]}])
        self.assertEqual(result["restated"]["page"]["views"], {"i/years": ['["table",["A","B"]]']})
        self.assertEqual([result["text"]["views"], "drawn" in result["text"]], [result["views"], False])
        self.assertEqual(result["textRestated"], {"i/years": ['["table",["A","B"]]']})  # a number printed in a cell is bound through the record
        self.assertEqual(result["dropped"]["page"]["views"], {"i/years": ['["table",["A","B"]]']})
        hashes = {result[name]["hash"] for name in ("barShort", "barOther", "restated", "dropped")}
        self.assertEqual(len(hashes), 4)

    def test_a_header_kept_over_other_numbers_shows_nothing_of_the_measure(self):
        # The summary table's FY26 column, its tokens pointed at FY19: the
        # header still says FY26 and no cell under it states an FY26 value.
        result = run_node(SPINE + '''
const swapped = doc(); const table = swapped.pages.find((p) => p.id === 'f0').exhibit;
for (const row of table.rows) row[2] = String(row[2]).replace(/@FY26/g, '@FY19');
const reworded = doc(); for (const row of reworded.pages.find((p) => p.id === 'f0').exhibit.rows) row[3] = String(row[3]).replace(/^Up /, 'Rose by ').replace(/^Down /, 'Fell by ');
const after = hashes(swapped), copy = hashes(reworded);
console.log(JSON.stringify({ errors: [after.errors, copy.errors], before: full.structure.f0.views['i-loans/loans'], after: after.structure.f0.views['i-loans/loans'],
  moved: Object.keys(full.pages).filter((id) => full.pages[id] !== after.pages[id]), copyMoved: Object.keys(full.pages).filter((id) => full.pages[id] !== copy.pages[id]) }));
''')
        self.assertEqual(result["errors"], [[], []])
        self.assertEqual(result["before"], ['["table",["FY25","FY26"]]'])
        self.assertEqual(result["after"], ['["table",["FY25"]]'])
        self.assertEqual(result["moved"], ["f0"])
        self.assertEqual(result["copyMoved"], [])


class SpineViewTests(unittest.TestCase):
    def test_a_spine_that_declares_its_views_lays_out_without_reopening_a_page(self):
        result = run_node(SPINE + '''
const bare = reopened(spine()), declared = reopened(spine({ f0: SUMMARY_VIEW }));
// Showing less than the critic read still reopens: the spine declares both years and the table is laid out with one.
const narrower = doc(); const table = narrower.pages.find((p) => p.id === 'f0').exhibit;
table.columns.splice(1, 1); for (const row of table.rows) row.splice(1, 1);
const laid = hashes(narrower);
console.log(JSON.stringify({ pages: Object.keys(full.pages).length, bare: [bare.errors, bare.moved], declared: [declared.errors, declared.moved],
  read: declared.drafted.structure.f0.views, drawn: full.structure.f0.views, less: [laid.errors, Object.keys(laid.pages).filter((id) => laid.pages[id] !== declared.drafted.pages[id])] }));
''')
        self.assertGreaterEqual(result["pages"], 7)
        # An undeclared spine is read as showing each measure plotted whole, which a summary's table cannot do: where the draft
        # used to pass that spine and the layout then moved the page, the draft now refuses the page and says what to declare.
        self.assertEqual(len(result["bare"][0]), 1)
        self.assertIn("f0: what the spine declares the page shows cannot be written into a summary page", result["bare"][0][0])
        self.assertIn("its `basis` declares no view of", result["bare"][0][0])
        self.assertEqual(result["declared"], [[], []])
        self.assertEqual(result["read"], result["drawn"])
        self.assertEqual(result["read"]["A-peers/margin"], ['["table",["Harbour"]]'])
        self.assertEqual(result["less"], [[], ["f0"]])

    def test_a_declared_view_is_read_as_the_drawn_exhibit_showing_it(self):
        result = run_node('''
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const log = [{ id: 'i', measures: { ocf: { unit: 'm', periods: ['Y1', 'Y2', 'Y3', 'Y4'], values: [58, 61, null, 66] }, rate: { unit: '%', period: 'Y4', value: 4.5 }, peers: { unit: 'm', members: ['A', 'B', 'C'], values: [3, 4, 5] } } }];
const M = S.recordedMeasures(log);
const page = (type, deps, shown = {}) => ({ id: 'p1', title: 't', pageType: { type, form: 'f', commentary: 'none', content: { claim: 'c', settles: { kind: 'rate', what: 'w', measures: ['i/ocf'] }, evidence: ['i'] }, dependencies: deps }, ...shown });
const views = (type, deps, shown) => S.storyStructure({ slides: [page(type, deps, shown)] }, M)[0].views;
const basis = (extra, measures = ['i/ocf']) => ({ measures, role: 'proof', ...extra });
console.log(JSON.stringify({
  none: views('trend', { exhibits: [basis({})] }, { exhibit: {} }),
  table: views('trend', { exhibits: [basis({ as: 'table' })] }, { exhibit: {} }),
  drawnTable: views('trend', { exhibits: [basis({})] }, { exhibit: { type: 'table', columns: ['Year', 'Cash'], rows: [['Y1', '58'], ['Y2', '61'], ['Y3', 'n/a'], ['Y4', '66']] } }),
  window: views('trend', { exhibits: [basis({ labels: { from: 'Y2' } })] }, { exhibit: {} }),
  drawnWindow: views('trend', { exhibits: [basis({})] }, { exhibit: { type: 'chart.line', categories: ['Y2', 'Y3', 'Y4'], series: [{ name: 'Cash', values: [61, null, 66] }] } }),
  list: views('trend', { exhibits: [basis({ as: 'chart', labels: ['Y4', 'Y1'] })] }, { exhibit: {} }),
  figure: views('numbers', { metrics: [basis({ labels: ['Y4'] })] }, { metrics: [{}] }),
  drawnFigure: views('numbers', { metrics: [basis({})] }, { metrics: [{ value: '66m', label: 'Cash' }] }),
  two: views('trend', { exhibits: [basis({ as: 'table', labels: { from: 'Y1', to: 'Y2' }, members: ['B'] }, ['i/ocf', 'i/peers', 'i/rate'])] }, { exhibit: {} }),
  each: views('trend', { exhibits: [basis({ labels: { 'i/ocf': ['Y4'], 'i/peers': { from: 'A', to: 'B' } } }, ['i/ocf', 'i/peers'])] }, { exhibit: {} }),
  // A drawn exhibit is read as drawn, whatever its basis still declares.
  drawnWins: views('trend', { exhibits: [basis({ as: 'table', labels: ['Y1'] })] }, { exhibit: { type: 'chart.line', categories: ['Y1', 'Y2', 'Y3', 'Y4'], series: [{ name: 'Cash', values: [58, 61, null, 66] }] } }),
  readings: S.spineReadings({ slides: [page('trend', { exhibits: [basis({ as: 'table', labels: ['Y1', 'Y2'] }), basis({}, ['i/peers'])] }, { exhibits: [{}, {}] })] }, M),
}));
''')
        self.assertEqual(result["none"], {"i/ocf": ['["chart","all"]']})
        # A table states numbers, so its whole is every period that holds one - the same reading a drawn table gets.
        self.assertEqual(result["table"], {"i/ocf": ['["table","all"]']})
        self.assertEqual(result["drawnTable"], result["table"])
        self.assertEqual(result["window"], {"i/ocf": ['["chart",["Y2","Y3","Y4"]]']})
        self.assertEqual(result["drawnWindow"], result["window"])
        self.assertEqual(result["list"], {"i/ocf": ['["chart",["Y1","Y4"]]']})
        self.assertEqual(result["figure"], {"i/ocf": ['["figure",["Y4"]]']})
        self.assertEqual(result["drawnFigure"], result["figure"])
        # A measure of one value is one number wherever the page prints it: it has one view, whatever exhibit carries it.
        self.assertEqual(result["two"], {"i/ocf": ['["table",["Y1","Y2"]]'], "i/peers": ['["table",["B"]]'], "i/rate": ['["figure"]']})
        self.assertEqual(result["each"], {"i/ocf": ['["chart",["Y4"]]'], "i/peers": ['["chart",["A","B"]]']})
        self.assertEqual(result["drawnWins"], {"i/ocf": ['["chart","all"]']})
        self.assertEqual(result["readings"], [{"id": "p1", "measures": [
            {"ref": "i/ocf", "declared": True, "views": [{"class": "table", "labels": ["Y1", "Y2"]}], "reading": "tabulated, 2 of its 4 periods: Y1, Y2"},
            {"ref": "i/peers", "declared": False, "views": [{"class": "chart", "labels": ["A", "B", "C"]}], "reading": "plotted, every one of its 3 members"}]}])

    def test_a_declared_view_that_is_not_one_is_refused(self):
        result = run_node(SPINE + '''
import { dependencyFindings } from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
const found = (view) => { const d = spine({ f0: view }); return dependencyFindings({ deck: d.deck, pages: d.pages }, insights).filter((f) => f.id === 'f0' && /basis\\.(as|labels|members)/.test(f.repair)).map((f) => [f.code, f.severity, f.repair]); };
console.log(JSON.stringify({ ok: found(SUMMARY_VIEW), kind: found({ as: 'pie' }), label: found({ as: 'table', labels: ['FY99'] }), window: found({ labels: { from: 'FY25', to: 'Q9' } }),
  shape: found({ labels: 'FY26' }), unnamed: found({ labels: { 'i-other/x': ['FY26'] } }), member: found({ members: ['Nowhere'] }) }));
''')
        self.assertEqual(result["ok"], [])
        self.assertEqual([f[:2] for f in result["kind"]], [["BASIS_UNKNOWN", "blocker"]])
        self.assertIn('"chart", "table", "figure"', result["kind"][0][2])
        for name, said in (("label", "names FY99"), ("window", "names Q9"), ("member", "names Nowhere")):
            self.assertEqual([f[:2] for f in result[name]], [["BASIS_AXIS", "blocker"]], name)
            self.assertIn(said, result[name][0][2])
        self.assertEqual([f[0] for f in result["shape"]], ["BASIS_AXIS"])
        self.assertEqual([f[0] for f in result["unnamed"]], ["BASIS_UNKNOWN"])

    def test_a_takeaways_page_is_the_same_kind_at_the_spine_and_laid_out(self):
        # The summary's form sets the page's kind, which the critique is bound to: a spine page without its items yet read
        # as a content page, and the same page with its items as a takeaways page - a "changed argument" nobody made.
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const page = { id: 'p9', type: 'summary', form: 'takeaways', commentary: 'none', title: 'Three findings carry the answer and one of them is new', why: 'The close restates the findings the answer rests on',
  settles: { kind: 'qualitative', what: 'the three findings of the deck' } };
const laid = compilePage({ ...page, items: [{ title: 'Growth outran funding', text: 'Lending grew faster than the deposits behind it in each of the last three years.' }, { title: 'Cash fell', text: 'Operating cash flow fell by a fifth in the latest year.' }, { title: 'Cover is thin', text: 'Liquid assets cover short liabilities by less than the floor requires.' }] }, 0, {});
// A draft is the one compile of the page completed: the spine's slide is the laid-out slide less what the layout adds.
const drafted = compileDeck({ deck: { id: 'd' }, pages: [page] }, { draft: true, partial: true });
const spine = drafted.spec.slides[0];
console.log(JSON.stringify({ spine: spine.kind ?? null, laid: laid.kind ?? null, pending: spine.pageType?.pending ?? null, items: spine.items ?? null, errors: drafted.compileErrors }));
''')
        self.assertEqual(result["laid"], "takeaways")
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["spine"], result["laid"])
        # The items the witness stood in for are not the author's: the spine's slide carries none, and says its content is pending.
        self.assertIsNone(result["items"])
        self.assertEqual(result["pending"], ["content"])


class SpineReadingReportTests(unittest.TestCase):
    """`--draft` and `--plan` say how the critique will read each page, before it is staged."""

    def run_cli(self, views, *flags):
        tmp = Path(tempfile.mkdtemp(prefix="spine-views-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        for name in ("finance.insights.json", "finance.analysis.json"):
            shutil.copy(FIXTURES / name, tmp / name)
        shutil.copytree(FIXTURES / "sources", tmp / "sources") if (FIXTURES / "sources").is_dir() else None
        doc = run_node(SPINE + f"console.log(JSON.stringify(spine({json.dumps(views)})));")
        (tmp / "finance.pages.json").write_text(json.dumps(doc))
        return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(tmp / "finance.pages.json"), *flags], capture_output=True, text=True)

    def test_a_draft_prints_how_each_undrawn_measure_will_be_read(self):
        run = self.run_cli({"f0": {"as": "table", "labels": {"from": "FY25", "to": "FY26"}, "members": ["Harbour"]}}, "--draft")
        self.assertEqual(run.returncode, 0, run.stderr[-2000:])
        summary = json.loads(run.stdout)
        by_page = {line.split(" ", 1)[0]: line for line in summary["readings"]}
        self.assertEqual(set(by_page), {"f0", "f1", "f2", "f3", "f4", "f5", "f6"})
        self.assertIn("i-loans/loans: read as plotted, every one of its 8 periods", by_page["f1"])
        self.assertIn("A-ocf/percent: read as stated as a figure", by_page["f2"])
        self.assertIn("A-cover/result: read as tabulated, 2 of its 8 periods: FY25, FY26 (declared)", by_page["f0"])
        # The human-readable report carries the same lines and says what to do about them.
        self.assertIn("How the storyline critique will read each measure a page shows and does not draw yet", run.stderr)
        self.assertIn("`as: \"chart\" | \"table\" | \"figure\"`", run.stderr)
        self.assertIn("  " + by_page["f1"], run.stderr)

    def test_a_stub_that_declares_no_view_a_page_of_its_type_can_show_is_refused_with_the_readings_beside_it(self):
        # The summary's stub declares no view, so it is read as plotting each measure whole - which no summary draws. The
        # draft used to pass this spine and the layout then changed what the critic had read; now the draft refuses the page,
        # and prints how the other pages will be read beside the refusal.
        run = self.run_cli({}, "--draft")
        self.assertEqual(run.returncode, 2, run.stderr[-2000:])
        self.assertIn("SPINE_UNDETERMINED [f0]", run.stderr)
        self.assertIn("its `basis` declares no view of", run.stderr)
        self.assertIn("so the critic is told the page shows each plotted", run.stderr)
        self.assertIn("f1 i-loans/loans: read as plotted, every one of its 8 periods", run.stderr)

    def test_a_declared_view_is_printed_as_declared(self):
        run = self.run_cli({"f0": {"as": "table", "labels": {"from": "FY25", "to": "FY26"}, "members": ["Harbour"]}}, "--draft")
        self.assertEqual(run.returncode, 0, run.stderr[-2000:])
        line = next(line for line in json.loads(run.stdout)["readings"] if line.startswith("f0 "))
        self.assertIn("A-cover/result: read as tabulated, 2 of its 8 periods: FY25, FY26 (declared)", line)
        self.assertIn("A-peers/margin: read as tabulated, 1 of its 8 members: Harbour (declared)", line)

    def test_a_plan_includes_each_page_s_reading(self):
        run = self.run_cli({"f0": {"as": "table", "labels": {"from": "FY25", "to": "FY26"}, "members": ["Harbour"]}}, "--plan")
        self.assertEqual(run.returncode, 0, run.stderr[-2000:])
        plan = json.loads(run.stdout)["plan"]
        self.assertEqual(len(plan["readings"]), 7)
        self.assertIn("i-loans/loans: read as plotted, every one of its 8 periods", next(line for line in plan["readings"] if line.startswith("f1 ")))
        self.assertIn("How the storyline critique will read each measure", run.stderr)

    def test_a_laid_out_page_is_not_listed(self):
        # Only what a page shows and does not draw is listed: a page whose exhibits draw its measures has no line.
        tmp = Path(tempfile.mkdtemp(prefix="spine-views-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
            shutil.copy(FIXTURES / name, tmp / name)
        run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(tmp / "finance.pages.json"), "--draft"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr[-2000:])
        listed = {line.split(" ", 1)[0] for line in json.loads(run.stdout).get("readings", [])}
        self.assertFalse(listed & {"f0", "f1", "f3", "f4", "f5", "f6"}, listed)


if __name__ == "__main__":
    unittest.main()
