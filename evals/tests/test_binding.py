"""Numbers by reference: bound exhibits, bound figures, tokens, and the trace of what is still typed.

The evidence contract first had the author type an exhibit's numbers again
beside a `basis` and then checked the copy against the record. In a real run
that check was most of the refusals - a unit worded differently, a value
rounded, a period outside the measure - an indexed trend and a
recorded-plus-scenario line could not pass at all, and the numbers typed into
sentences, metrics and table cells were not read. These cover the repair: a
page names the measure and the runtime writes the number (bind.mjs); what is
still typed is traced to the measures the page rests on; and a metric on a
labelled row counts as proof like any other.
"""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"
AUTHOR = ROOT / "skills" / "professional-slides" / "runtime" / "author-deck.mjs"

# A log on a subject of its own: five series for one company, a peer set, a few single values, and three analyses.
LOG = '''
import { runAnalyses, analysisInsights } from './skills/professional-slides/runtime/analysis.mjs';
import { bindDeck } from './skills/professional-slides/runtime/bind.mjs';
import { dependencyFindings } from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
const FY = ['FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'];
const graded = { finding: 'a finding', calculation: 'a calculation', soWhat: 'It bears on the decision at hand', strength: 'strong' };
const one = (unit, value) => ({ unit, population: 'the company', period: 'FY26', value });
const recorded = [
  { ...graded, id: 'i-bal', shape: 'series', sources: ['sources/a.csv'], cite: ['annual-report'], measures: {
      cash: { unit: 'GBP m', population: 'the company', periods: FY, values: [15, 21, 37, 43, 50, 55] },
      debt: { unit: 'GBP m', population: 'the company', periods: FY, values: [108, 96, 82, 68, 58, 56] },
      staff: { unit: 'people', population: 'the company', periods: FY, values: [900, 950, 990, 1010, 1040, 1100] },
      sites: { unit: 'sites', population: 'the company', periods: FY, values: [40, 41, 44, 44, 47, 52] },
      swing: { unit: 'GBP m', population: 'the company', periods: FY, values: [4.3, -21.4, -0.86, 2.2, 0.04, 9.1] },
      floor: one('GBP m', 25), rate: one('%', -0.86), revenue: one('CHF m', 1300), perHead: one('ratio', 0.349), margin: one('GBP m', 3.4) } },
  { ...graded, id: 'i-peers', shape: 'fact', sources: ['sources/b.csv'], cite: ['regulator'], measures: {
      profit: { unit: 'GBP m', population: 'four couriers', period: 'latest year', members: ['Alpha', 'Beta', 'Gamma'], values: [20, 3, null], unavailable: { Gamma: 'reports in another currency' } },
      margin: { unit: '%', population: 'four couriers', period: 'latest year', members: ['Alpha', 'Beta', 'Delta'], values: [15, 8, 21] } } }];
const { results } = runAnalyses({ analyses: [
  { id: 'A-path', op: 'scenario', inputs: ['i-bal/cash'], method: 'linear', horizon: ['FY27', 'FY28', 'FY29'], assumptions: [{ name: 'annual cash use', value: -12, rationale: 'the disruption year repeats without recovery' }] },
  { id: 'A-index', op: 'index', inputs: ['i-bal/cash', 'i-bal/staff', 'i-bal/debt', 'i-bal/sites'] },
  { id: 'A-net', op: 'gap', inputs: ['i-bal/debt', 'i-bal/cash'] },
].map((a) => ({ soWhat: 'It changes what the answer can claim', strength: 'strong', ...a })) }, recorded);
const insights = new Map([...recorded, ...analysisInsights(results)].map((i) => [i.id, i]));
const page = (o = {}) => ({ id: 'p1', type: 'trend', form: 'line', commentary: 'so-what-bar', title: 'Cash rose every year while debt fell by half',
  why: 'The movement over time is the claim, so the series is drawn', evidence: ['i-bal', 'A-path', 'A-index', 'A-net', 'i-peers'],
  settles: { kind: 'rate', what: 'cash and debt at each year end', measures: ['i-bal/cash'] }, bar: 'The balance sheet has room for one more year of investment at this pace', ...o });
const deckOf = (...pages) => ({ deck: { schema: 'professional-slides.deck/v3', id: 'probe', workflow: 'new_deck', request: 'How has the balance sheet moved?' },
  sources: { 'annual-report': { name: 'Annual report 2026', status: 'illustrative' }, regulator: { name: 'Regulator returns 2026', status: 'illustrative' } }, pages });
const bind = (p) => { const out = bindDeck(deckOf(p), insights); return { page: out.doc.pages[0], findings: out.findings }; };
const exhibitOf = (ex, o) => bind(page({ exhibit: ex, ...o })).page.exhibit;
const problems = (p) => bind(p).findings.map((f) => f.repair);
const codes = (p) => dependencyFindings(deckOf(p), insights).map((f) => f.code);
const advised = (p) => dependencyFindings(deckOf(p), insights).filter((f) => f.code === 'NUMBER_UNTRACED').flatMap((f) => f.measured);
'''


class BoundExhibitTests(unittest.TestCase):
    def test_a_bound_exhibit_takes_its_axis_values_unit_and_basis_from_its_measures(self):
        result = run_node(LOG + '''
console.log(JSON.stringify({
  line: exhibitOf({ type: 'chart.line', heading: 'Cash and debt', series: [{ measure: 'i-bal/cash', name: 'Cash' }, { measure: 'i-bal/debt' }], role: 'proof' }),
  range: exhibitOf({ heading: 'Cash', series: [{ measure: 'i-bal/cash', name: 'Cash' }], select: { from: 'FY23', to: 'FY25' } }).categories,
  listed: exhibitOf({ heading: 'Cash', series: [{ measure: 'i-bal/cash', name: 'Cash' }], select: { periods: ['FY26', 'FY22'] } }),
  context: exhibitOf({ heading: 'Debt', series: [{ measure: 'i-bal/debt', name: 'Debt' }], basis: { role: 'context', relevance: 'It shows what the cash was not spent on' } }).basis,
  ranked: exhibitOf({ heading: 'Margin', series: [{ measure: 'i-peers/margin', name: 'Margin' }], select: { order: 'descending' } }, { type: 'ranking', form: 'bar' }),
  chosen: exhibitOf({ heading: 'Margin', series: [{ measure: 'i-peers/margin', name: 'Margin' }], select: { members: ['Delta', 'Alpha'] } }, { type: 'ranking', form: 'bar' }),
  shared: exhibitOf({ heading: 'Profit and margin', series: [{ measure: 'i-peers/margin', name: 'Margin' }], select: { members: ['Alpha', 'Beta'] } }, { type: 'ranking', form: 'bar' }).categories,
  donut: exhibitOf({ heading: 'Margin by carrier', measure: 'i-peers/margin' }, { type: 'composition', form: 'donut' }),
  rule: exhibitOf({ heading: 'Cash against the floor', series: [{ measure: 'i-bal/cash', name: 'Cash' }, { measure: 'i-bal/floor', name: 'Floor' }] }).series[1].values,
  untouched: (() => { const typed = page({ exhibit: { heading: 'Cash', unit: 'GBP m', categories: FY, series: [{ name: 'Cash', values: [15, 21, 37, 43, 50, 55] }], basis: { measures: ['i-bal/cash'] } } }); return bindDeck(deckOf(typed), insights).doc.pages[0] === typed; })() }));
''')
        self.assertEqual(result["line"], {"type": "chart.line", "heading": "Cash and debt", "unit": "GBP m", "categories": ["FY21", "FY22", "FY23", "FY24", "FY25", "FY26"],
                                          "series": [{"name": "Cash", "values": [15, 21, 37, 43, 50, 55]}, {"name": "debt", "values": [108, 96, 82, 68, 58, 56]}],
                                          # What the runtime wrote is exactly what the exhibit shows of each measure: the periods are recorded on its basis, marked as the runtime's.
                                          "basis": {"measures": ["i-bal/cash", "i-bal/debt"], "role": "proof", "labels": {"i-bal/cash": ["FY21", "FY22", "FY23", "FY24", "FY25", "FY26"], "i-bal/debt": ["FY21", "FY22", "FY23", "FY24", "FY25", "FY26"]}, "bound": True}})
        self.assertEqual(result["range"], ["FY23", "FY24", "FY25"])
        # Time keeps its order whatever order the periods are listed in.
        self.assertEqual([result["listed"]["categories"], result["listed"]["series"][0]["values"]], [["FY22", "FY26"], [21, 55]])
        self.assertEqual(result["context"], {"measures": ["i-bal/debt"], "role": "context", "relevance": "It shows what the cash was not spent on", "labels": {"i-bal/debt": ["FY21", "FY22", "FY23", "FY24", "FY25", "FY26"]}, "bound": True})
        self.assertEqual([result["ranked"]["categories"], result["ranked"]["series"][0]["values"], result["ranked"]["unit"]], [["Delta", "Alpha", "Beta"], [21, 15, 8], "%"])
        self.assertEqual([result["chosen"]["categories"], result["chosen"]["series"][0]["values"]], [["Delta", "Alpha"], [21, 15]])
        self.assertEqual(result["shared"], ["Alpha", "Beta"])
        # A donut names its slices in `labels`; one measure named on the exhibit is its one list of values.
        self.assertEqual([result["donut"]["labels"], result["donut"]["values"], result["donut"]["unit"], result["donut"]["basis"]["measures"]], [["Alpha", "Beta", "Delta"], [15, 8, 21], "%", ["i-peers/margin"]])
        self.assertEqual(result["rule"], [25] * 6)  # a measure of one value is a rule across the plot
        self.assertTrue(result["untouched"])  # a page that binds nothing is the author's own object

    def test_a_recorded_series_and_a_scenario_are_one_line_with_the_assumed_run_marked(self):
        result = run_node(LOG + '''
import { compileDeck, composeForAuthoring } from './skills/professional-slides/runtime/author-deck.mjs';
const joined = { heading: 'Cash, recorded and assumed', series: [{ measure: ['i-bal/cash', 'A-path/path'], name: 'Cash' }, { measure: 'i-bal/floor', name: 'Floor' }] };
const p = page({ settles: { kind: 'rate', what: 'cash at each year end, then carried forward', measures: ['i-bal/cash', 'A-path/path'] }, exhibit: joined });
const { spec, compileErrors, bindingFindings } = compileDeck(deckOf(p), { insights, partial: true });
const composed = await composeForAuthoring(spec, process.cwd());
// The same line typed by hand, as the first contract asked: one series over two measures matched neither.
const typed = page({ settles: p.settles, exhibit: { heading: 'Cash', unit: 'GBP m', categories: [...FY, 'FY27', 'FY28', 'FY29'], series: [{ name: 'Cash', values: [15, 21, 37, 43, 50, 55, 43, 31, 19] }], basis: { measures: ['i-bal/cash', 'A-path/path'] } } });
console.log(JSON.stringify({ exhibit: exhibitOf(joined), compiled: [compileErrors, bindingFindings, composed.error ?? null, composed.pageErrors], slide: spec.slides[0].exhibit.periods, source: spec.slides[0].source,
  gate: codes(p), typed: codes(typed),
  alone: exhibitOf({ heading: 'Cash under the assumption', series: [{ measure: 'A-path/path', name: 'Cash' }] }).periods,
  ownMark: exhibitOf({ ...joined, type: 'chart.column', series: joined.series.slice(0, 1), forecastFrom: 'FY27' }),
  wrongMark: problems(page({ exhibit: { ...joined, forecastFrom: 'FY25' } })),
  units: problems(page({ exhibit: { heading: 'Cash and staff', series: [{ measure: ['i-bal/cash', 'i-bal/staff'], name: 'x' }] } })),
  members: problems(page({ exhibit: { heading: 'Margin', series: [{ measure: ['i-peers/margin', 'i-peers/profit'], name: 'x' }] } })) }));
''')
        ex = result["exhibit"]
        self.assertEqual(ex["categories"], ["FY21", "FY22", "FY23", "FY24", "FY25", "FY26", "FY27", "FY28", "FY29"])
        # FY26 is in both: the record is kept, not the assumption that starts from it.
        self.assertEqual(ex["series"][0]["values"], [15, 21, 37, 43, 50, 55, 43, 31, 19])
        self.assertEqual(ex["periods"], [{"from": "FY21", "to": "FY26", "label": "Recorded"}, {"from": "FY27", "to": "FY29", "label": "Assumed"}])
        self.assertEqual(ex["basis"]["measures"], ["i-bal/cash", "A-path/path", "i-bal/floor"])
        self.assertEqual(result["compiled"], [[], [], None, []])  # it compiles and composes from references alone
        self.assertEqual(result["slide"], ex["periods"])  # the bracket reaches the page
        self.assertEqual(result["source"], "Source: Annual report 2026 (illustrative)")
        self.assertEqual(result["gate"], [])
        self.assertEqual(result["typed"], ["BASIS_VALUES"])
        # A path drawn alone starts at the recorded value it was carried from: that period is the record, and the run after it the
        # assumption (a stabilised-income path bracketed its recorded 2024 base as "Assumed").
        self.assertEqual(result["alone"], [{"from": "FY26", "to": "FY26", "label": "Recorded"}, {"from": "FY27", "to": "FY29", "label": "Assumed"}])
        # An exhibit that marks the run itself keeps its own mark, where it starts at the first assumed period.
        self.assertEqual([result["ownMark"].get("forecastFrom"), "periods" in result["ownMark"]], ["FY27", False])
        self.assertIn("start it at FY27", result["wrongMark"][0])
        self.assertIn("one line is one unit", result["units"][0])
        self.assertIn("do not run over periods", result["members"][0])

    def test_an_indexed_trend_compiles_from_references_alone(self):
        result = run_node(LOG + '''
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const names = ['cash', 'staff', 'debt', 'sites'];
const indexed = (series, more = {}) => page({ form: 'indexed', settles: { kind: 'rate', what: 'four measures rebased to their first year', measures: names.map((n) => `A-index/${n}`), relation: { kind: 'index' } },
  exhibit: { heading: 'Growth since FY21', subject: 'cash', series, ...more } });
const computed = indexed(names.map((n) => ({ measure: `A-index/${n}`, name: n })));
const raw = indexed(names.map((n) => ({ measure: `i-bal/${n}`, name: n })), { indexBase: 'FY22' });
const compiled = (p) => { const { spec, compileErrors, bindingFindings } = compileDeck(deckOf(p), { insights, partial: true }); const ex = spec.slides[0]?.exhibit;
  return { errors: [...compileErrors, ...bindingFindings.map((f) => f.repair)], unit: ex?.unit, cash: ex?.series[0].values, focus: ex?.focusSeries, leaked: JSON.stringify(spec.slides).includes('"measure"') }; };
// What the first contract refused: raw values under an index unit, and an index basis under raw values.
const typedRaw = indexed(names.map((n) => ({ name: n, values: insights.get('i-bal').measures[n].values })), { unit: 'index, FY21 = 100', categories: FY, indexBase: 'FY21', basis: { measures: names.map((n) => `i-bal/${n}`) } });
console.log(JSON.stringify({ computed: compiled(computed), raw: compiled(raw), gates: [codes(computed), codes(raw)], typedRaw: codes(typedRaw),
  base: insights.get('A-index').measures.cash.base,
  noBase: problems(indexed(names.map((n) => ({ measure: `i-bal/${n}`, name: n })))), twoBases: problems(indexed(names.map((n) => ({ measure: `A-index/${n}`, name: n })), { indexBase: 'FY23' })),
  mixed: problems(indexed([{ measure: 'A-index/cash' }, { measure: 'i-bal/staff' }, { measure: 'i-bal/debt' }, { measure: 'i-bal/sites' }])),
  unitTyped: problems(indexed(names.map((n) => ({ measure: `i-bal/${n}`, name: n })), { indexBase: 'FY22', unit: 'GBP m' })) }));
''')
        # An index analysis's measures carry their base: nothing is typed, and the compiler's rebasing leaves them as they are.
        self.assertEqual(result["base"], "FY21")
        self.assertEqual(result["computed"], {"errors": [], "unit": "index, FY21 = 100", "cash": [100, 140, 246.7, 286.7, 333.3, 366.7], "focus": "cash", "leaked": False})
        # Raw series in four units, rebased by the runtime at the period the page names.
        self.assertEqual(result["raw"], {"errors": [], "unit": "Index, FY22 = 100", "cash": [71.4, 100, 176.2, 204.8, 238.1, 261.9], "focus": "cash", "leaked": False})
        self.assertEqual(result["gates"], [[], []])
        self.assertIn("BASIS_UNIT", result["typedRaw"])
        self.assertIn("say the `indexBase` period", result["noBase"][0])
        self.assertIn("leave `indexBase` out", result["twoBases"][0])
        self.assertIn("some are raw series, some already indexed", result["mixed"][0])
        self.assertIn("leave `unit` out", result["unitTyped"][0])

    def test_a_reference_that_cannot_be_bound_is_one_finding_and_the_page_is_not_compiled(self):
        result = run_node(LOG + '''
import { compileDeck, authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const cash = { heading: 'Cash and debt', series: [{ measure: 'i-bal/cash', name: 'Cash' }, { measure: 'i-bal/debt', name: 'Debt' }], highlights: [{ category: 'FY26' }] };
const broken = page({ evidence: ['i-bal'], title: 'Margins of {{i-peers/margin@Alpha}} and {{i-peers/margin@Beta}} against {{i-peers/margin@Delta}}', exhibit: cash });
const good = page({ id: 'p2', exhibit: cash });
const partial = compileDeck(deckOf(broken, good), { insights, partial: true });
let thrown = null; try { compileDeck(deckOf(broken), { insights }); } catch (error) { thrown = error.message; }
const run = await authorDeck(deckOf(broken, good), { baseDir: process.cwd(), insights, draft: true });
console.log(JSON.stringify({
  unknown: problems(page({ exhibit: { heading: 'Cash', series: [{ measure: 'i-bal/cahs', name: 'Cash' }] } })), bare: problems(page({ exhibit: { heading: 'Cash', series: [{ measure: 'cash' }] } })),
  noLog: bindDeck(deckOf(page({ exhibit: cash })), null).findings.map((f) => f.repair),
  unrested: problems(broken), found: dependencyFindings(deckOf(broken), insights).map((f) => [f.code, f.id, f.severity, f.measured]),
  partial: [partial.spec.slides.map((s) => s.id), partial.compileErrors, partial.bindingFindings.map((f) => f.code)], thrown,
  authored: [run.findings.map((f) => `${f.code} ${f.id ?? ''}`.trim()), [...run.failedIds]],
  typedBeside: problems(page({ exhibit: { ...cash, categories: FY } })), typedSeries: problems(page({ exhibit: { heading: 'Cash', series: [cash.series[0], { name: 'Target', values: [1, 2, 3, 4, 5, 6] }] } })),
  mixedSeries: codes(page({ exhibit: { heading: 'Cash', series: [cash.series[0], { name: 'Target', values: [1, 2, 3, 4, 5, 6] }] } })),
  basisBeside: problems(page({ exhibit: { ...cash, basis: { measures: ['i-bal/debt'] } } })), unit: problems(page({ exhibit: { ...cash, unit: 'USD m' } })), sameUnit: problems(page({ exhibit: { ...cash, unit: 'gbp m.' } })),
  units: problems(page({ exhibit: { heading: 'Cash and staff', series: [{ measure: 'i-bal/cash' }, { measure: 'i-bal/staff' }] } })),
  axes: problems(page({ exhibit: { heading: 'Cash and margin', series: [{ measure: 'i-bal/cash' }, { measure: 'i-peers/margin' }] } })),
  onlyOne: problems(page({ exhibit: { heading: 'Floor', series: [{ measure: 'i-bal/floor' }] } })),
  select: [problems(page({ exhibit: { ...cash, select: { from: 'FY19' } } })), problems(page({ exhibit: { ...cash, select: { members: ['Alpha'] } } })), problems(page({ exhibit: { ...cash, select: { from: 'FY25', to: 'FY22' } } }))],
  token: [problems(page({ title: 'Cash reached {{i-bal/cash}} million' })), problems(page({ title: 'Cash reached {{i-bal/cash@FY31}} million' })), problems(page({ title: 'The floor is {{i-bal/floor@FY26}}' })),
    problems(page({ title: 'Cash reached {{i-bal/cash@FY26 | GBP zero}}' })), problems(page({ title: 'Cash reached {{i-bal/cash@FY26 | 0 | /7}}' }))],
  figure: problems(page({ type: 'numbers', form: 'metric-strip', metrics: [{ measure: 'i-bal/rate', value: '-0.9%', label: 'Rate' }], exhibit: cash })) }));
''')
        self.assertIn('names "i-bal/cahs", which the insight log\'s measures do not hold', result["unknown"][0])
        self.assertIn("a measure is named `<insight id>/<measure>`", result["bare"][0])
        self.assertIn("no insight log with measures is beside the pages file", result["noLog"][0])
        # Three tokens of one insight the page does not rest on: one finding, naming the insight and the count.
        self.assertEqual(len(result["unrested"]), 1)
        self.assertIn("names a measure of i-peers, which the page does not name in `evidence`", result["unrested"][0])
        self.assertIn("and 2 more references on the page with the same fault", result["unrested"][0])
        self.assertEqual(result["found"], [["BINDING_UNRESOLVED", "p1", "blocker", ["i-peers/margin"]]])  # and nothing else about the page: it has no numbers to hold yet
        # The page is left out of the compile, the rest of the deck compiles, and the finding is the binding's - in a draft too.
        self.assertEqual(result["partial"], [["p2"], [], ["BINDING_UNRESOLVED"]])
        self.assertIn("1 page could not be compiled", result["thrown"])
        self.assertIn("i-peers", result["thrown"])
        self.assertEqual([code for code in result["authored"][0] if code.endswith("p1")], ["BINDING_UNRESOLVED p1"])
        self.assertIn("p1", result["authored"][1])
        self.assertIn("leaves that out", result["typedBeside"][0])
        self.assertIn("every series of a bound exhibit is { measure, name }", result["typedSeries"][0])
        self.assertEqual(result["mixedSeries"], ["BINDING_UNRESOLVED"])  # a typed series cannot ride unchecked beside a bound one
        self.assertIn("keep only `role` and `relevance`", result["basisBeside"][0])
        self.assertIn('types its unit as "USD m"', result["unit"][0])
        self.assertEqual(result["sameUnit"], [])  # the recorded unit, worded as units are compared
        self.assertIn("one scale is one unit", result["units"][0])
        self.assertIn("one axis is one or the other", result["axes"][0])
        self.assertIn("one number is a metric", result["onlyOne"][0])
        self.assertIn("asks for FY19", result["select"][0][0])
        self.assertIn("`select` over periods takes `from` and `to`, or `periods`", result["select"][1][0])
        self.assertIn("no run of the periods", result["select"][2][0])
        self.assertIn("say which one - `i-bal/cash@FY26`", result["token"][0][0])
        self.assertIn('at "FY31", which it does not run over', result["token"][1][0])
        self.assertIn("write i-bal/floor alone", result["token"][2][0])
        self.assertIn("has no number in it", result["token"][3][0])
        self.assertIn("a power of ten", result["token"][4][0])
        self.assertIn("leave `value` out", result["figure"][0])


class FigureAndTokenTests(unittest.TestCase):
    def test_a_number_is_printed_in_the_format_the_page_states(self):
        result = run_node('''
import { readFormat, renderValue } from './skills/professional-slides/runtime/bind.mjs';
const print = (value, format) => { const read = readFormat(format); return typeof read === 'string' ? `refused: ${read}` : renderValue(value, read); };
console.log(JSON.stringify([[-21.428, '+0.0%'], [4.255, '+0.0%'], [1251, 'CHF 0.0bn | /1000'], [0.57, '0% | x100'], [-0.86, '0.0%'], [-0.04, '+0.0%'], [1750, '0,0'], [1234567.5, 'US$0,0.0'], [54.93, ''], [648, undefined],
  [-21.43, '0.0% | abs'], [null, '0.0'], [5.4, '0.00x'], [3, '00'], [3, '0 | twice']].map(([value, format]) => print(value, format))));
''')
        self.assertEqual(result[:13], ["-21.4%", "+4.3%", "CHF 1.3bn", "57%", "-0.9%", "0.0%", "1,750", "US$1,234,567.5", "54.9", "648", "21.4%", "n/a", "5.40x"])
        self.assertTrue(result[13].startswith("refused") and result[14].startswith("refused"))

    def test_metrics_and_tokens_are_written_from_the_measures_they_name(self):
        result = run_node(LOG + '''
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
import { plottedValues } from './skills/professional-slides/runtime/evidence.mjs';
const cash = { heading: 'Cash', series: [{ measure: 'i-bal/cash', name: 'Cash' }] };
const strip = page({ type: 'numbers', form: 'metric-strip', commentary: 'none', bar: undefined, title: 'Cash reached {{i-bal/cash@FY26}} million as net debt fell to {{A-net/result@FY26 | 0}} million',
  subtitle: 'Revenue {{i-bal/revenue | CHF0.0bn | /1000}}; rate {{i-bal/rate | +0.0%}}',
  metrics: [{ measure: 'i-bal/rate', format: '+0.0%', label: 'Rate' }, { measure: 'i-bal/debt@FY26', format: 'GBP 0m', label: 'Debt', role: 'context', relevance: 'It is what the cash is set against' },
    { value: '{{i-bal/revenue | CHF0.0bn | /1000}}', label: 'Revenue' }, { value: '21', label: 'Typed', sublabel: 'from {{i-bal/cash@FY21}}' }],
  exhibit: { ...cash, caption: 'Cash rose from {{i-bal/cash@FY21}} to {{i-bal/cash@FY26}} million over five years of retained earnings' } });
const bound = bind(strip).page;
const table = (rows, more = {}) => page({ type: 'lookup', form: 'table', commentary: 'none', bar: undefined, settles: { kind: 'comparison', what: 'carrier profit and margin', measures: ['i-peers/profit', 'i-peers/margin'] },
  exhibit: { type: 'table', columns: ['Carrier', 'Profit', 'Margin'], rows, ...more } });
const tokens = table([['Alpha', '{{i-peers/profit@Alpha | 0m}}', '{{i-peers/margin@Alpha | 0%}}'], ['Beta', '{{i-peers/profit@Beta | 0m}}', '{{i-peers/margin@Beta | 0%}}'], ['Gamma', '{{i-peers/profit@Gamma | 0m}}', 'n/a']]);
const mixed = table([['Alpha', '{{i-peers/profit@Alpha | 0m}}', '15%'], ['Beta', '{{i-peers/profit@Beta | 0m}}', '8%']]);
const grid = page({ type: 'numbers', form: 'fact-grid', commentary: 'none', bar: undefined, exhibit: { columns: 2, items: [{ measure: 'i-bal/cash@FY26', format: '0m', label: 'cash at the year end' }, { measure: 'i-bal/floor', format: '0m', label: 'the floor the board holds' }] } });
const hero = page({ type: 'numbers', form: 'hero-number', kpi: { measure: 'i-bal/cash@FY26', format: 'GBP 0m', label: 'cash at the year end' }, exhibit: cash });
const cited = compileDeck(deckOf(page({ title: 'Cash rose every year while Alpha earned {{i-peers/margin@Alpha | 0%}}', exhibit: { heading: 'Cash and debt', series: [{ measure: 'i-bal/cash', name: 'Cash' }, { measure: 'i-bal/debt', name: 'Debt' }], highlights: [{ category: 'FY26' }] } })), { insights, partial: true });
console.log(JSON.stringify({ title: bound.title, subtitle: bound.subtitle, metrics: bound.metrics, caption: bound.exhibit.caption, gate: codes(strip),
  table: [bind(tokens).page.exhibit.rows, bind(tokens).page.exhibit.basis, codes(tokens)], mixed: [bind(mixed).page.exhibit.basis ?? null, codes(mixed)],
  mixedWithBasis: codes(table(mixed.exhibit.rows, { basis: { measures: ['i-peers/profit', 'i-peers/margin'] } })),
  judged: [codes(table([['Alpha', '{{i-peers/profit@Alpha | 0m}}', { type: 'harvey', value: 4 }], ['Beta', '{{i-peers/profit@Beta | 0m}}', { type: 'rag', value: 'red' }]], { columns: ['Carrier', 'Profit', { label: 'Readiness', type: 'harvey' }] })).filter((code) => code === 'BASIS_MISSING'),
    plottedValues({ type: 'table', columns: ['Carrier', 'Profit', 'Readiness'], rows: [['Alpha', '20m', { type: 'harvey', value: 4 }], ['Beta', '3m', { type: 'harvey', value: 1 }]] }),
    plottedValues({ type: 'stat-list', items: [{ value: '29%' }, { value: 15.3 }, { value: 'n/a' }] }, { printed: true })],
  grid: [bind(grid).page.exhibit.items.map((item) => item.value), bind(grid).page.exhibit.basis, codes(grid)], hero: [bind(hero).page.kpi, codes(hero)],
  cited: cited.spec.slides[0]?.source ?? cited.compileErrors }));
''')
        self.assertEqual(result["title"], "Cash reached 55 million as net debt fell to 1 million")
        self.assertEqual(result["subtitle"], "Revenue CHF1.3bn; rate -0.9%")
        self.assertEqual(result["metrics"][0], {"label": "Rate", "value": "-0.9%", "basis": {"measures": ["i-bal/rate"], "role": "proof", "bound": True}})
        self.assertEqual(result["metrics"][1], {"label": "Debt", "value": "GBP 56m", "basis": {"measures": ["i-bal/debt"], "role": "context", "relevance": "It is what the cash is set against", "labels": {"i-bal/debt": ["FY26"]}, "bound": True}})
        # A metric whose value is a token states that measure; a token in its sublabel is commentary and gives it no basis.
        self.assertEqual(result["metrics"][2], {"value": "CHF1.3bn", "label": "Revenue", "basis": {"measures": ["i-bal/revenue"], "role": "proof", "bound": True}})
        self.assertEqual(result["metrics"][3], {"value": "21", "label": "Typed", "sublabel": "from 15"})
        self.assertEqual(result["caption"], "Cash rose from 15 to 55 million over five years of retained earnings")
        self.assertEqual(result["gate"], [])
        # A table whose every number is a token has said what it shows; an undisclosed value prints as n/a.
        self.assertEqual(result["table"], [[["Alpha", "20m", "15%"], ["Beta", "3m", "8%"], ["Gamma", "n/a", "n/a"]], {"measures": ["i-peers/profit", "i-peers/margin"], "role": "proof", "labels": {"i-peers/profit": ["Alpha", "Beta", "Gamma"], "i-peers/margin": ["Alpha", "Beta"]}, "bound": True}, []])
        # One that also types numbers says which measures those are.
        self.assertEqual(result["mixed"], [None, ["BASIS_MISSING", "PROOF_MISSING"]])
        self.assertEqual(result["mixedWithBasis"], [])
        # A scorecard's judged cells - Harvey balls, RAG states - are grades no measure holds: beside tokens they type nothing.
        # For the evidence floor, a figure bound and printed ("29%") is read as a number as a typed one is; "n/a" is not.
        self.assertEqual(result["judged"], [[], 2, 2])
        self.assertEqual(result["grid"], [["55m", "25m"], {"measures": ["i-bal/cash", "i-bal/floor"], "role": "proof", "labels": {"i-bal/cash": ["FY26"]}, "bound": True}, []])
        self.assertEqual(result["hero"], [{"label": "cash at the year end", "value": "GBP 55m", "basis": {"measures": ["i-bal/cash"], "role": "proof", "labels": {"i-bal/cash": ["FY26"]}, "bound": True}}, []])
        # A number printed through a token is cited to the record it came from, beside what the exhibit plots.
        self.assertEqual(result["cited"], "Sources: Annual report 2026 (illustrative); Regulator returns 2026 (illustrative)")


class TraceTests(unittest.TestCase):
    def test_text_is_read_for_measurements_and_not_for_labels(self):
        result = run_node('''
import { printedNumbers } from './skills/professional-slides/runtime/printed-numbers.mjs';
const read = (text) => printedNumbers(text).map((x) => `${x.shown}:${x.kind}`);
console.log(JSON.stringify(Object.fromEntries(['CHF1.3bn in FY26, up 4.3% on 500X routes', 'US$4.3bn and \\u00a3390m against SEK7.8bn', 'GBP 1.2bn', '+900% (FY25: 47)', 'FY26', 'Q3 2024', '4.3pp at 2.9x',
  '130 911 and 30 500-4, with 50 options', 'FY2025-26 and 2024-25 on the M25-1000 and M25b', 'ranked 15th in 2026, up from 17th', 'First flight on 20 September 2026', 'between 90-104 and 10\\u201348',
  '1,750 onward cities', '49 million and 62 percent', 'a 5-year plan at 3.5%', '24/7 from 20:30', '8 branches on 4K screens and 500s', 'COVID-19 and category-2', 'fell \\u22120.9% to 12.2 minutes', 'USD12 or $5M'].map((text) => [text, read(text)]))));
''')
        self.assertEqual(result["CHF1.3bn in FY26, up 4.3% on 500X routes"], ["CHF1.3bn:measure", "4.3%:measure"])
        self.assertEqual(result["US$4.3bn and £390m against SEK7.8bn"], ["US$4.3bn:measure", "£390m:measure", "SEK7.8bn:measure"])
        self.assertEqual(result["GBP 1.2bn"], ["1.2bn:measure"])
        self.assertEqual(result["+900% (FY25: 47)"], ["+900%:measure", "47:integer"])
        self.assertEqual([result["FY26"], result["Q3 2024"]], [[], ["2024:period"]])
        self.assertEqual(result["4.3pp at 2.9x"], ["4.3pp:measure", "2.9x:measure"])
        # A model number is indistinguishable from a count; both are bare whole numbers, and neither is read as a measurement.
        self.assertEqual(result["130 911 and 30 500-4, with 50 options"], ["130:integer", "911:integer", "30:integer", "50:integer"])
        self.assertEqual(result["FY2025-26 and 2024-25 on the M25-1000 and M25b"], [])
        self.assertEqual(result["ranked 15th in 2026, up from 17th"], ["2026:period"])
        self.assertEqual(result["First flight on 20 September 2026"], ["20:period", "2026:period"])
        self.assertEqual(result["between 90-104 and 10–48"], ["90:integer", "104:integer", "10:integer", "48:integer"])  # a range is two numbers
        self.assertEqual(result["1,750 onward cities"], ["1,750:measure"])
        self.assertEqual(result["49 million and 62 percent"], ["49 million:measure", "62 percent:measure"])
        self.assertEqual(result["a 5-year plan at 3.5%"], ["5:integer", "3.5%:measure"])
        self.assertEqual(result["24/7 from 20:30"], [])
        self.assertEqual(result["8 branches on 4K screens and 500s"], ["8:integer"])
        self.assertEqual(result["COVID-19 and category-2"], [])
        self.assertEqual(result["fell −0.9% to 12.2 minutes"], ["−0.9%:measure", "12.2:measure"])
        self.assertEqual(result["USD12 or $5M"], ["$5M:measure"])  # a letter code needs a decimal, a separator or a scale to be money

    def test_a_typed_number_no_measure_holds_is_reported_with_its_page_and_field(self):
        result = run_node(LOG + '''
const cash = { heading: 'Cash', series: [{ measure: 'i-bal/cash', name: 'Cash' }] };
const say = (o) => advised(page({ exhibit: cash, ...o }));
const all = dependencyFindings(deckOf(page({ exhibit: cash, title: 'Cash reached 56.5 million' })), insights);
console.log(JSON.stringify({ finding: all.map((f) => [f.code, f.id, f.severity, f.measured]), repair: all[0].repair,
  recorded: say({ title: 'Cash reached 55 million from 15 million as debt fell to GBP 56m', bar: 'Net debt of 1 million and revenue of CHF1.3bn leave a rate of -0.9%, or 35% of staff cost' }),
  wrong: say({ title: 'Cash reached 57 million from 15.5 million', subtitle: 'Revenue CHF1.4bn, a rate of +0.9%', bar: 'Net debt fell 42.7% to 1 million over the five years' }),
  labels: say({ title: 'In FY26 and 2026 the 500X and M25 fleets, 8 branches and the 15th of 30 options held', bar: 'From 20 September 2026 the Q3 plan covers 2024-25 routes on a 5-year view' }),
  // A percentage is not matched against money, nor money against a percentage: 20% is not Alpha's profit of 20, and 15m is not its margin of 15%.
  units: advised({ ...page({ exhibit: undefined, settles: undefined, title: 'Profit rose 20% to 15m' }), evidence: ['i-peers'] }),
  ratio: say({ title: 'Staff cost per head is 35% of the peer level' }),
  assumption: say({ title: 'Cash use of 12.0 million a year is assumed' }),
  lineage: advised(page({ exhibit: cash, evidence: ['A-net'], settles: undefined, type: 'argument', form: 'memo', title: 'Net debt fell as cash reached 55.0 million' })),
  unrested: advised(page({ exhibit: cash, evidence: ['i-bal'], title: 'Alpha earns a margin of 15.0% on its routes' })),
  fields: advised(page({ exhibit: { ...cash, caption: 'Cash rose to 99.5 million over the five years shown', annotations: [{ category: 'FY26', text: 'Up 77.7% on the year before' }] }, points: ['A first point with 3.3x leverage in it.', { lead: 'A lead', text: 'and its text at 44.4%' }], takeaway: 'It closes at 66.6 million' })),
  cells: advised(page({ type: 'lookup', form: 'table', evidence: ['i-peers'], settles: { kind: 'comparison', what: 'carrier margins', measures: ['i-peers/margin'] }, exhibit: { type: 'table', columns: ['Carrier', 'Margin', 'Note'],
    rows: [['Alpha', '15%', 'ahead'], ['Beta', 9, 'Line 2 of 3'], { cells: ['Delta', { text: '22%' }, '21 points'] }], basis: { measures: ['i-peers/margin'] } } })),
  // A typed metric with a basis is already held to its measure: it is refused there, and not reported twice.
  metric: dependencyFindings(deckOf(page({ type: 'numbers', form: 'metric-strip', metrics: [{ value: '-9.9%', label: 'Rate', sublabel: 'against 7.7% a year earlier', basis: { measures: ['i-bal/rate'] } }, { value: '12.5%', label: 'No basis' }], exhibit: cash })), insights).map((f) => [f.code, f.measured]),
  tokens: say({ title: 'Cash reached {{i-bal/cash@FY26 | 0.0}} million, or {{i-bal/perHead | 0%| x100}} of 99.9 million' }),
  qualitative: advised({ ...page({ exhibit: undefined, settles: undefined, type: 'argument', form: 'memo', title: 'A judgement with 12.5% in it' }), evidence: [] }) }));
''')
        self.assertEqual(result["finding"], [["NUMBER_UNTRACED", "p1", "advisory", ["title: 56.5 million"]]])
        self.assertIn("56.5 million in `title`", result["repair"])
        self.assertIn("{{<insight id>/<measure>@<period or member> | 0.0}}", result["repair"])
        self.assertEqual(result["recorded"], [])  # recorded values in any dress: scaled, signed, with a currency, a ratio as a percentage
        self.assertEqual(result["wrong"], ["title: 57 million", "title: 15.5 million", "bar: 42.7%", "subtitle: CHF1.4bn", "subtitle: +0.9%"])
        self.assertEqual(result["labels"], [])  # years, periods, dates, model names, ordinals and counts of things are not measurements
        self.assertEqual(result["units"], ["title: 20%", "title: 15m"])
        self.assertEqual(result["ratio"], [])
        self.assertEqual(result["assumption"], [])  # a stated assumption of an analysis the page rests on
        self.assertEqual(result["lineage"], [])  # a value of the records an analysis was computed from
        self.assertEqual(result["unrested"], ["title: 15.0%"])  # recorded, by an insight this page does not rest on
        self.assertEqual(result["fields"], ["exhibit.caption: 99.5 million", "exhibit.annotations[0].text: 77.7%", "points[0]: 3.3x", "points[1].text: 44.4%", "takeaway: 66.6 million"])
        # Every figure cell of a table is read, typed as text or as a number; a row's name and a count in a note are not.
        self.assertEqual(result["cells"], ["exhibit.rows[1][1]: 9", "exhibit.rows[2][1]: 22%"])
        self.assertEqual(result["metric"], [["NUMBER_UNTRACED", ["metrics[0].sublabel: 7.7%", "metrics[1].value: 12.5%"]], ["BASIS_VALUES", {"printed": "-9.9%", "recorded": [-0.86]}]])
        self.assertEqual(result["tokens"], ["title: 99.9 million"])  # what the runtime wrote is not traced; what is typed beside it is
        self.assertEqual(result["qualitative"], [])  # a page that rests on no measured insight has nothing to be traced to

    def test_a_printed_number_states_a_record_at_the_precision_the_page_prints(self):
        result = run_node(LOG + '''
import { matches } from './skills/professional-slides/runtime/printed-numbers.mjs';
const cash = { heading: 'Cash', series: [{ measure: 'i-bal/cash', name: 'Cash' }] };
const metric = (value, ref) => codes(page({ type: 'numbers', form: 'metric-strip', commentary: 'none', bar: undefined, metrics: [{ value, label: 'A figure', basis: { measures: [ref] } }], exhibit: cash }));
const plotted = (values) => codes(page({ settles: { kind: 'rate', what: 'the yearly swing', measures: ['i-bal/swing'] }, exhibit: { heading: 'Swing', unit: 'GBP m', categories: FY, series: [{ name: 'Swing', values }], basis: { measures: ['i-bal/swing'] } } }));
const cells = (cell) => codes(page({ type: 'lookup', form: 'table', commentary: 'none', bar: undefined, settles: { kind: 'count', what: 'revenue', measures: ['i-bal/revenue'] },
  exhibit: { type: 'table', columns: ['Measure', 'FY26'], rows: [['Revenue', cell]], basis: { measures: ['i-bal/revenue'] } } })).filter((code) => code !== 'NUMBER_UNTRACED');
console.log(JSON.stringify({
  // -0.86% printed to one decimal place: refused by two significant figures, which the first contract asked of every number.
  percent: Object.fromEntries(['-0.9%', '-0.86%', '-1%', '+0.9%', '-0.8%'].map((v) => [v, metric(v, 'i-bal/rate')])),
  // Outside a percentage, two significant figures stand: 0.349 is not 0.3, and 3.4 is not 3.
  ratio: Object.fromEntries(['0.35', '0.3', '0.349'].map((v) => [v, metric(v, 'i-bal/perHead')])), whole: Object.fromEntries(['3.4m', '3m'].map((v) => [v, metric(v, 'i-bal/margin')])),
  // A letter before the digits: read as a number, so a right one passes and a wrong one is refused - in a metric and in a cell alike.
  prefixed: Object.fromEntries(['CHF1.3bn', 'CHF1,300m', 'CHF1.4bn', 'CHF 1.3bn'].map((v) => [v, metric(v, 'i-bal/revenue')])), cells: Object.fromEntries(['CHF1.3bn', 'CHF1.4bn'].map((v) => [v, cells(v)])),
  // A small value in a series keeps two significant figures of its own, whatever the size of its neighbours: -0.86 beside -21.4 is not -0.9, and 0.04 is not 0.0.
  series: { exact: plotted([4.3, -21.4, -0.86, 2.2, 0.04, 9.1]), printed: plotted([4.3, -21.4, -0.9, 2.2, 0.0, 9.1]), whole: plotted([4, -21, -1, 2, 0, 9]), wrong: plotted([4.3, -21.4, -1.9, 2.2, 0.0, 9.1]) },
  rule: [matches(55, 54.9), matches(54.9, 54.93), matches(3, 3.4), matches(3, 3.04), matches(-0.9, -0.86), matches(-0.9, -0.86, { percent: true }), matches(0.0, 0.04, { decimals: 1, scale: 21.4 }), matches(0.3, 0.349, { scale: 0.438 })] }));
''')
        self.assertEqual(result["percent"], {"-0.9%": [], "-0.86%": [], "-1%": ["BASIS_VALUES"], "+0.9%": ["BASIS_VALUES"], "-0.8%": ["BASIS_VALUES"]})
        self.assertEqual(result["ratio"], {"0.35": [], "0.3": ["BASIS_VALUES"], "0.349": []})
        self.assertEqual(result["whole"], {"3.4m": [], "3m": ["BASIS_VALUES"]})
        self.assertEqual(result["prefixed"], {"CHF1.3bn": [], "CHF1,300m": [], "CHF1.4bn": ["BASIS_VALUES"], "CHF 1.3bn": []})
        self.assertEqual(result["cells"], {"CHF1.3bn": [], "CHF1.4bn": ["BASIS_VALUES"]})
        self.assertEqual(result["series"], {"exact": [], "printed": ["BASIS_VALUES"], "whole": ["BASIS_VALUES"], "wrong": ["BASIS_VALUES"]})
        # The last two were once passed "on the series' scale"; nothing but the value's own two figures, and a percentage's one decimal place, is read now.
        self.assertEqual(result["rule"], [True, True, False, True, False, True, False, False])


class RowMetricTests(unittest.TestCase):
    def test_a_metric_on_a_labelled_row_and_a_fact_grid_item_count_as_proof(self):
        result = run_node(LOG + '''
import { compileDeck, withoutDependencies } from './skills/professional-slides/runtime/author-deck.mjs';
const block = (label, metric) => ({ label, points: [`${label} moved in each of the five years to the latest year end.`, 'The movement came from retained earnings rather than new borrowing.'], ...(metric ? { metric } : {}) });
const rows = (cash, debt) => ({ id: 'p1', type: 'parallel', form: 'labelled-rows', commentary: 'in-exhibit', title: 'Cash and debt moved in opposite directions over five years',
  why: 'Two balances, each a row with its own facts and one number', evidence: ['i-bal'],
  settles: { kind: 'comparison', what: 'cash and debt at FY26', measures: ['i-bal/cash', 'i-bal/debt'], relation: { kind: 'separate', reason: 'Each balance is looked up on its own by the treasury team' } },
  blocks: [block('Cash', cash), block('Debt', debt)] });
const typed = rows({ value: '55m', label: 'cash at FY26', basis: { measures: ['i-bal/cash'] } }, { value: '56m', label: 'debt at FY26', basis: { measures: ['i-bal/debt'] } });
const bound = rows({ measure: 'i-bal/cash@FY26', format: '0m', label: 'cash at FY26' }, { measure: 'i-bal/debt@FY26', format: '0m', label: 'debt at FY26' });
const bare = rows({ value: '55m', label: 'cash at FY26' }, { value: '56m', label: 'debt at FY26' });
const wrong = rows({ value: '65m', label: 'cash at FY26', basis: { measures: ['i-bal/cash'] } }, { value: '56m', label: 'debt at FY26', basis: { measures: ['i-bal/debt'] } });
const grid = (items) => ({ id: 'p1', type: 'numbers', form: 'fact-grid', commentary: 'none', title: 'Cash stands at more than twice the floor', why: 'Two counts that each need their own sentence', evidence: ['i-bal'],
  settles: { kind: 'count', what: 'cash and the floor', measures: ['i-bal/cash', 'i-bal/floor'] }, exhibit: { columns: 2, items } });
const item = (value, label, basis) => ({ value, label, text: 'What the number measures, in a sentence of its own', ...(basis ? { basis } : {}) });
const compiled = compileDeck(deckOf(typed, { ...bound, id: 'p2' }), { insights, partial: true });
const stripped = withoutDependencies(grid([item('55m', 'cash', { measures: ['i-bal/cash'] }), item('25m', 'the floor')]));
console.log(JSON.stringify({ typed: codes(typed), bound: codes(bound), bare: codes(bare), wrong: codes(wrong),
  errors: compiled.compileErrors, kept: compiled.spec.slides.map((s) => s.pageType.dependencies.metrics.map((b) => b.measures)),
  leaked: JSON.stringify(compiled.spec.slides.map((s) => ({ ...s, pageType: null }))).includes('"basis"'), values: compiled.spec.slides.map((s) => s.blocks.map((b) => b.metric.value)),
  item: codes(grid([item('55m', 'cash', { measures: ['i-bal/cash'] }), item('25m', 'the floor')])), itemWrong: codes(grid([item('65m', 'cash', { measures: ['i-bal/cash'] }), item('25m', 'the floor')])),
  noItemBasis: codes(grid([item('55m', 'cash'), item('25m', 'the floor')])), itemStripped: [JSON.stringify(stripped.page).includes('"basis"'), stripped.dependencies.declared.metrics.length] }));
''')
        self.assertEqual(result["typed"], [])  # was PROOF_MISSING: the row's metric was not read
        self.assertEqual(result["bound"], [])
        self.assertEqual(result["bare"], ["PROOF_MISSING"])  # a row metric that names no measure proves nothing
        self.assertEqual(result["wrong"], ["BASIS_VALUES"])  # and one that names a measure is held to it
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["kept"], [[["i-bal/cash"], ["i-bal/debt"]], [["i-bal/cash"], ["i-bal/debt"]]])
        self.assertFalse(result["leaked"])  # `basis` is the author's statement, not a prop the composer draws
        self.assertEqual(result["values"], [["55m", "56m"], ["55m", "56m"]])
        self.assertEqual(result["item"], [])
        self.assertEqual(result["itemWrong"], ["BASIS_VALUES"])
        self.assertEqual(result["noItemBasis"], ["PROOF_MISSING"])
        self.assertEqual(result["itemStripped"], [False, 1])


class AuthoringSurfaceTests(unittest.TestCase):
    """What the author meets at the command line: a scaffold already bound, one finding for a bad reference, and the list of untraced numbers."""

    def author(self, tmp, *args):
        return subprocess.run([NODE, str(AUTHOR), str(Path(tmp) / "finance.pages.json"), *args], capture_output=True, text=True, timeout=180)

    def stage(self, tmp, mutate=None):
        for file in FIXTURES.glob("finance.*"):
            (Path(tmp) / file.name).write_text(file.read_text(encoding="utf-8"), encoding="utf-8")
        if mutate:
            path = Path(tmp) / "finance.pages.json"
            doc = json.loads(path.read_text(encoding="utf-8"))
            mutate({page["id"]: page for page in doc["pages"]})
            path.write_text(json.dumps(doc), encoding="utf-8")

    def test_a_scaffold_from_an_insight_names_its_measures(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.stage(tmp)
            trend = self.author(tmp, "--scaffold", "trend", "--evidence", "i-liquidity", "--id", "f9")
            self.assertEqual(trend.returncode, 0, trend.stderr)  # it is bound and compiled before it is printed
            page = json.loads(trend.stdout)
            self.assertEqual(page["exhibit"]["series"], [{"measure": "i-liquidity/liquid", "name": "liquid"}, {"measure": "i-liquidity/short-liabilities", "name": "short-liabilities"}])
            self.assertFalse({"categories", "unit", "values"} & set(page["exhibit"]))
            self.assertEqual(page["settles"], {"measures": ["i-liquidity/liquid", "i-liquidity/short-liabilities"]})
            self.assertNotIn("source", page)  # the citation is written from the measures
            # A form asked for is the form given: the figure is bound, and the chart the insight has no series for is said to be the example's.
            hero = self.author(tmp, "--scaffold", "numbers/hero-number", "--evidence", "A-ocf")
            numbers = json.loads(hero.stdout)
            self.assertEqual(numbers["kpi"]["measure"], "A-ocf/change")
            self.assertIn("values", numbers["exhibit"]["series"][0])  # no series in the insight: the example's chart stays, to be replaced
            self.assertIn("Still the worked example's own numbers, to replace: `exhibit`", hero.stderr)

    def test_a_scaffold_binds_wherever_the_insight_has_measures_its_exhibit_can_take_and_says_when_it_fell_back(self):
        # A run asked for seven scaffolds from its insights and mostly got the worked example back, unbound and unexplained:
        # a bridge, a table, a page of panels, a grid of figures and a mix of one measure all fell back in silence. A scaffold
        # binds a table by token, panels a measure each, a bridge as one measure, and takes the form of the type the measures
        # fill; where nothing binds it says so, and why.
        result = run_node('''
import { scaffoldReport } from './skills/professional-slides/runtime/author-deck.mjs';
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const members = ['North', 'South', 'East', 'West', 'Centre', 'Coast'];
const insights = {
  bridge: { id: 'i-bridge', shape: 'bridge', breadth: { steps: 3 }, finding: 'f', soWhat: 's', strength: 'strong', measures: { effect: { unit: 'GBP m', population: 'the company, effect on profit', period: 'FY25 to FY26', members: ['FY25 profit', 'Revenue', 'Fuel', 'Staff', 'FY26 profit'], values: [200, 40, 15, -25, 230] } } },
  pair: { id: 'i-pair', shape: 'mix', breadth: { parts: 6 }, finding: 'f', soWhat: 's', strength: 'strong', measures: { served: { unit: 'depots', population: 'depots in service', period: 'FY26', members, values: [12, 9, 7, 6, 4, 3] },
    planned: { unit: 'depots', population: 'depots planned', period: 'FY26', members, values: [3, 5, 2, 6, 1, 2] } } },
  facts: { id: 'i-facts', shape: 'fact', finding: 'f', soWhat: 's', strength: 'supporting', measures: { vans: { unit: 'vans', population: 'the fleet', period: 'FY26', value: 410 }, drivers: { unit: 'people', population: 'drivers', period: 'FY26', value: 620 },
    depots: { unit: 'depots', population: 'the network', period: 'FY26', value: 41 }, routes: { unit: 'routes', population: 'the network', period: 'FY26', value: 180 } } },
  roster: { id: 'i-roster', shape: 'roster', finding: 'f', soWhat: 's', strength: 'supporting', measures: { vans: { unit: 'vans', population: 'the couriers', period: 'FY26', members, values: [12, 9, 7, 6, 4, 3] } } },
  mix: { id: 'i-mix', shape: 'mix', breadth: { parts: 6 }, finding: 'f', soWhat: 's', strength: 'strong', measures: { share: { unit: '%', population: 'revenue by region', period: 'FY26', members, values: [31, 28, 16, 10, 8, 7] } } },
};
const of = (type, insight, form) => { const report = scaffoldReport(type, { id: 'p9', insight, form });
  // What is printed binds and compiles against the insight's own log.
  const compiled = compileDeck({ deck: { id: 'd', design: 'consulting' }, pages: [report.page] }, { insights: new Map([[insight.id, insight]]), partial: true });
  return { form: report.form, bound: report.bound, typed: report.typed, fallback: report.fallback, passed: (report.passed ?? []).map((item) => item.form), page: report.page, fit: report.fit ?? null,
    compiles: compiled.compileErrors.length === 0 && compiled.bindingFindings.length === 0 }; };
console.log(JSON.stringify({ bridge: of('bridge', insights.bridge), panels: of('panels', insights.pair), lookup: of('lookup', insights.pair), numbers: of('numbers', insights.facts),
  hero: of('numbers', insights.facts, 'hero-number'), composition: of('composition', insights.mix), scorecard: of('scorecard', insights.roster), harvey: of('scorecard', insights.roster, 'harvey') }));
''')
        bridge = result["bridge"]
        self.assertEqual([bridge["bound"], bridge["typed"], bridge["compiles"]], [["i-bridge/effect"], [], True])
        self.assertEqual({key: bridge["page"]["exhibit"][key] for key in ("measure", "totals")}, {"measure": "i-bridge/effect", "totals": [0, 4]})
        self.assertFalse({"categories", "values"} & set(bridge["page"]["exhibit"]))
        # Panels take a measure each, and the worked example's own panels are gone.
        panels = result["panels"]
        self.assertEqual([[s["measure"] for s in ex["series"]] for ex in panels["page"]["exhibits"]], [["i-pair/served"], ["i-pair/planned"]])
        self.assertEqual([panels["typed"], panels["compiles"]], [[], True])
        # A table prints each measure by token, a member a row.
        lookup = result["lookup"]
        self.assertEqual(lookup["bound"], ["i-pair/served", "i-pair/planned"])
        self.assertEqual(lookup["page"]["exhibit"]["rows"][0][:3], ["North", "{{i-pair/served@North | 0.0}}", "{{i-pair/planned@North | 0.0}}"])
        self.assertEqual([lookup["typed"], lookup["compiles"]], [[], True])
        # Single values fill a grid or a list of figures, not the chart under a hero number: the forms that carry four figures
        # are read from the measures (claim-fit.mjs), one of them is taken, and the other is named as fitting as well.
        numbers = result["numbers"]
        self.assertIn(numbers["form"], ("fact-grid", "stat-list"))
        self.assertEqual(numbers["fit"]["task"], "figures")
        self.assertEqual({numbers["form"], *numbers["fit"]["equal"]}, {"fact-grid", "stat-list"})
        self.assertEqual([numbers["typed"], numbers["compiles"]], [[], True])
        self.assertTrue(all("measure" in item for item in numbers["page"]["exhibit"]["items"]))
        # Asked for by form, the hero number is given, and what still holds the example's numbers is listed.
        self.assertEqual([result["hero"]["form"], result["hero"]["typed"]], ["hero-number", ["exhibit"]])
        self.assertEqual(result["hero"]["page"]["kpi"]["measure"], "i-facts/vans")
        # One measure over six parts fills a form that takes six, not the type's first.
        self.assertEqual([result["composition"]["typed"], result["composition"]["compiles"], result["composition"]["bound"]], [[], True, ["i-mix/share"]])
        self.assertNotEqual(result["composition"]["form"], "stacked-column")
        # A scorecard of a recorded measure over members binds it, a token a cell under a coded column.
        scorecard = result["scorecard"]
        self.assertEqual([scorecard["form"], scorecard["bound"], scorecard["typed"], scorecard["compiles"]], ["bars", ["i-roster/vans"], [], True])
        self.assertTrue(scorecard["page"]["exhibit"]["columns"][1]["bar"])
        self.assertEqual(scorecard["page"]["exhibit"]["rows"][0][:2], ["North", "{{i-roster/vans@North | 0.0}}"])
        # A form whose cells are a judgement takes no measure: the page is the worked example, and says so and why.
        harvey = result["harvey"]
        self.assertEqual(harvey["bound"], [])
        self.assertEqual(len(harvey["fallback"]), 1)
        self.assertIn("code a judgement, which no measure records", harvey["fallback"][0])
        self.assertIn("--scaffold lookup --evidence i-roster", harvey["fallback"][0])

    def test_the_scaffold_command_says_what_it_bound_and_why_it_fell_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.stage(tmp)
            bound = self.author(tmp, "--scaffold", "trend", "--evidence", "i-liquidity")
            self.assertIn("Bound to i-liquidity: trend/line names i-liquidity/liquid, i-liquidity/short-liabilities, and the runtime writes the numbers.", bound.stderr)
            # A scorecard of recorded measures binds them in a form that codes magnitudes; a judged form, asked for by name, does not.
            coded = self.author(tmp, "--scaffold", "scorecard", "--evidence", "i-peers")
            self.assertIn("Bound to i-peers: scorecard/", coded.stderr)
            self.assertIn("{{i-peers/margin@Harbour | 0.0}}", coded.stdout)
            fallback = self.author(tmp, "--scaffold", "scorecard/harvey", "--evidence", "i-peers")
            self.assertEqual(fallback.returncode, 0, fallback.stderr)
            self.assertIn("Not bound to i-peers: the page printed is the worked example of scorecard/harvey with the insight named as `evidence`, and its numbers are the example's own.", fallback.stderr)
            self.assertIn("Why:", fallback.stderr)
            table = self.author(tmp, "--scaffold", "lookup", "--evidence", "i-peers")
            self.assertIn("{{i-peers/margin@Harbour | 0.0}}", table.stdout)
            self.assertIn("Bound to i-peers: lookup/", table.stderr)
            self.assertEqual(self.author(tmp, "--scaffold", "trend/nothing", "--evidence", "i-liquidity").returncode, 1)

    def test_a_bad_reference_refuses_the_run_once_and_untraced_numbers_are_listed(self):
        with tempfile.TemporaryDirectory() as tmp:
            def retitle(pages):
                pages["f3"]["title"] = "The liquidity cushion narrowed from 43.5 million to 8 million"
                pages["f0"]["exhibit"]["rows"][6][1] = "64.5%"
            self.stage(tmp, retitle)
            checked = self.author(tmp, "--check")
            self.assertEqual(checked.returncode, 0, checked.stderr)  # advice, not a refusal
            summary = json.loads(checked.stdout)
            self.assertEqual(summary["untracedNumbers"], {"f0": ["exhibit.rows[6][1]: 64.5%"], "f3": ["title: 43.5 million"]})
            self.assertIn("NUMBER_UNTRACED [f3]", summary["advisories"])

            def unbind(pages):
                pages["f3"]["exhibit"]["series"][0]["measure"] = "i-liquidity/liquidity"
                pages["f1"]["title"] = "Loans grew {{A-loans/percent | 0%}} to {{i-loans/loans@FY27}} million"
            self.stage(tmp, unbind)
            refused = self.author(tmp, "--check")
            self.assertEqual(refused.returncode, 2)
            self.assertIn("2 findings to fix", refused.stderr)
            self.assertIn("BINDING_UNRESOLVED [f3]", refused.stderr)
            self.assertIn('names "i-liquidity/liquidity", which the insight log\'s measures do not hold', refused.stderr)
            self.assertIn("BINDING_UNRESOLVED [f1]", refused.stderr)
            self.assertNotIn("COMPILE", refused.stderr)  # the page's finding is the binding's, not a second one about its missing values


if __name__ == "__main__":
    unittest.main()
