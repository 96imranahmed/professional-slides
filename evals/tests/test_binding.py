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

FIXTURES = ROOT / "evals" / "tests" / "fixtures" / "evidence"
AUTHOR = ROOT / "skills" / "professional-slides" / "runtime" / "author-deck.mjs"

# A log on a subject of its own: five series for one company, a peer set and a few single values.
LOG = '''
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
const insights = new Map(recorded.map((i) => [i.id, i]));
const page = (o = {}) => ({ id: 'p1', type: 'trend', form: 'line', commentary: 'so-what-bar', title: 'Cash rose every year while debt fell by half',
  why: 'The movement over time is the claim, so the series is drawn', evidence: ['i-bal', 'i-peers'],
  settles: { kind: 'rate', what: 'cash and debt at each year end', measures: ['i-bal/cash'] }, bar: 'The balance sheet has room for one more year of investment at this pace', ...o });
const deckOf = (...pages) => ({ deck: { schema: 'professional-slides.deck/v3', id: 'probe', workflow: 'new_deck', request: 'How has the balance sheet moved?' },
  sources: { 'annual-report': { name: 'Annual report 2026', status: 'illustrative' }, regulator: { name: 'Regulator returns 2026', status: 'illustrative' } }, pages });
const bind = (p) => { const out = bindDeck(deckOf(p), insights); return { page: out.doc.pages[0], findings: out.findings }; };
const exhibitOf = (ex, o) => bind(page({ exhibit: ex, ...o })).page.exhibit;
const problems = (p) => bind(p).findings.map((f) => f.repair);
const codes = (p) => dependencyFindings(deckOf(p), insights).map((f) => f.code);
// What the trace finds: a title's number no record holds is refused (TITLE_NUMBER_UNTRACED), any other advised (NUMBER_UNTRACED).
const advised = (p) => dependencyFindings(deckOf(p), insights).flatMap((f) => f.code === 'NUMBER_UNTRACED' ? f.measured : f.code === 'TITLE_NUMBER_UNTRACED' ? f.measured.map((shown) => `title: ${shown}`) : []);
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

    def test_a_waterfall_bound_to_one_measure_stands_its_opening_and_closing_totals_on_the_axis(self):
        """Spacebar run: a bridge bound to its measure drew the opening and closing totals as two more floating steps,
        and only `totals` typed by hand set them on the axis. The first and last members of a bridge are its totals."""
        result = run_node(LOG + '''
insights.set('i-bridge', { ...graded, id: 'i-bridge', shape: 'fact', sources: ['sources/c.csv'], cite: ['annual-report'], measures: {
  walk: { unit: 'GBP m', population: 'the company', period: 'FY25 to FY26', members: ['FY25 profit', 'Volume', 'Price', 'Costs', 'FY26 profit'], values: [40, 6, 3, -4, 45] } } });
const bridge = (ex) => exhibitOf({ heading: 'Profit, FY25 to FY26', measure: 'i-bridge/walk', ...ex }, { type: 'bridge', form: 'waterfall', evidence: ['i-bridge'],
  settles: { kind: 'composition', what: 'what moved profit between the years', measures: ['i-bridge/walk'] } });
console.log(JSON.stringify({ bound: bridge({}), kept: bridge({ totals: [0] }).totals }));
''')
        self.assertEqual(result["bound"]["categories"], ["FY25 profit", "Volume", "Price", "Costs", "FY26 profit"])
        self.assertEqual(result["bound"]["values"], [40, 6, 3, -4, 45])
        self.assertEqual(result["bound"]["totals"], [0, 4])
        self.assertEqual(result["kept"], [0])  # totals the page names are its own

    def test_a_trellis_of_stacks_is_written_by_hand_and_a_donut_trellis_binds(self):
        # A stacked panel draws several parts, and a measure a panel fills one: written as single-value panels the stacked
        # mark would refuse them with no word of why. A donut's panel is one measure shared out over its members.
        result = run_node(LOG + '''
const panels = { type: 'panels', form: 'small-multiples', commentary: 'below' };
console.log(JSON.stringify({
  stacked: problems(page({ ...panels, exhibit: { heading: 'Cash and debt', mark: 'stacked-column', series: [{ measure: 'i-bal/cash' }, { measure: 'i-bal/debt' }] } })),
  donut: exhibitOf({ heading: 'Cash and debt by year', mark: 'donut', series: [{ measure: 'i-bal/cash', name: 'Cash' }, { measure: 'i-bal/debt', name: 'Debt' }] }, panels),
}));
''')
        self.assertEqual(len(result["stacked"]), 1)
        self.assertIn("trellis of stacks", result["stacked"][0])
        self.assertEqual([item["label"] for item in result["donut"]["items"]], ["Cash", "Debt"])
        self.assertEqual(result["donut"]["categories"], ["FY21", "FY22", "FY23", "FY24", "FY25", "FY26"])
        self.assertEqual(result["donut"]["items"][0]["values"], [15, 21, 37, 43, 50, 55])

    def test_a_reference_that_cannot_be_bound_is_one_finding_and_the_page_is_not_compiled(self):
        result = run_node(LOG + '''
import { compileDeck, authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const cash = { heading: 'Cash and debt', series: [{ measure: 'i-bal/cash', name: 'Cash' }, { measure: 'i-bal/debt', name: 'Debt' }], highlights: [{ category: 'FY26' }] };
const broken = page({ evidence: ['i-bal'], title: 'Margins of {{i-peers/margin@Alpha}} and {{i-peers/margin@Beta}} against {{i-peers/margin@Delta}}', exhibit: cash });
const good = page({ id: 'p2', exhibit: cash });
const partial = compileDeck(deckOf(broken, good), { insights, partial: true });
let thrown = null; try { compileDeck(deckOf(broken), { insights }); } catch (error) { thrown = error.message; }
const run = await authorDeck(deckOf(broken, good), { baseDir: process.cwd(), insights });
console.log(JSON.stringify({
  unknown: problems(page({ exhibit: { heading: 'Cash', series: [{ measure: 'i-bal/cahs', name: 'Cash' }] } })), bare: problems(page({ exhibit: { heading: 'Cash', series: [{ measure: 'cash' }] } })),
  noLog: bindDeck(deckOf(page({ exhibit: cash })), null).findings.map((f) => f.repair),
  unrested: problems(broken), found: dependencyFindings(deckOf(broken), insights).map((f) => [f.code, f.id, f.severity, f.measured]),
  partial: [partial.spec.slides.map((s) => s.id), partial.compileErrors, partial.bindingFindings.map((f) => f.code)], thrown,
  authored: [[...run.blocking, ...run.advisories].map((f) => `${f.code} ${f.id ?? ''}`.trim()), [...run.failedIds]],
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
        # The page is left out of the compile, the rest of the deck compiles, and the finding is the binding's.
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
  [-21.43, '0.0% | abs'], [null, '0.0'], [5.4, '0.00x'], [3, '00'], [3, '0 | twice'], [26.685, '£0.00'], [-1.005, '0.00'], [0.125, '']].map(([value, format]) => print(value, format))));
''')
        self.assertEqual(result[:13], ["-21.4%", "+4.3%", "CHF 1.3bn", "57%", "-0.9%", "0.0%", "1,750", "US$1,234,567.5", "54.9", "648", "21.4%", "n/a", "5.40x"])
        self.assertTrue(result[13].startswith("refused") and result[14].startswith("refused"))
        # A half rounds up on the digits the record states, where the binary double would round it down.
        self.assertEqual(result[15:], ["£26.69", "-1.01", "0.1"])

    def test_metrics_and_tokens_are_written_from_the_measures_they_name(self):
        result = run_node(LOG + '''
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
import { plottedValues } from './skills/professional-slides/runtime/evidence.mjs';
const cash = { heading: 'Cash', series: [{ measure: 'i-bal/cash', name: 'Cash' }] };
const strip = page({ type: 'numbers', form: 'metric-strip', commentary: 'none', bar: undefined, title: 'Cash reached {{i-bal/cash@FY26}} million across {{i-bal/sites@FY26 | 0}} sites',
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
        self.assertEqual(result["title"], "Cash reached 55 million across 52 sites")
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
        self.assertEqual(result["GBP 1.2bn"], ["GBP 1.2bn:measure"])  # an ISO code set apart by a space is the figure's currency
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
  recorded: say({ title: 'Cash reached 55 million from 15 million as debt fell to GBP 56m', bar: 'Revenue of CHF1.3bn leaves a rate of -0.9%, or 35% of staff cost' }),
  wrong: say({ title: 'Cash reached 57 million from 15.5 million', subtitle: 'Revenue CHF1.4bn, a rate of +0.9%', bar: 'Debt fell 42.7% to 56 million over the five years' }),
  labels: say({ title: 'In FY26 and 2026 the 500X and M25 fleets, 8 branches and the 15th of 30 options held', bar: 'From 20 September 2026 the Q3 plan covers 2024-25 routes on a 5-year view' }),
  // A percentage is not matched against money, nor money against a percentage: 20% is not Alpha's profit of 20, and 15m is not its margin of 15%.
  units: advised({ ...page({ exhibit: undefined, settles: undefined, title: 'Profit rose 20% to 15m' }), evidence: ['i-peers'] }),
  ratio: say({ title: 'Staff cost per head is 35% of the peer level' }),
  unrested: advised(page({ exhibit: cash, evidence: ['i-bal'], title: 'Alpha earns a margin of 15.0% on its routes' })),
  fields: advised(page({ exhibit: { ...cash, caption: 'Cash rose to 99.5 million over the five years shown', annotations: [{ category: 'FY26', text: 'Up 77.7% on the year before' }] }, points: ['A first point with 3.3x leverage in it.', { lead: 'A lead', text: 'and its text at 44.4%' }], takeaway: 'It closes at 66.6 million' })),
  cells: advised(page({ type: 'lookup', form: 'table', evidence: ['i-peers'], settles: { kind: 'comparison', what: 'carrier margins', measures: ['i-peers/margin'] }, exhibit: { type: 'table', columns: ['Carrier', 'Margin', 'Note'],
    rows: [['Alpha', '15%', 'ahead'], ['Beta', 9, 'Line 2 of 3'], { cells: ['Delta', { text: '22%' }, '21 points'] }], basis: { measures: ['i-peers/margin'] } } })),
  // A typed metric with a basis is already held to its measure: it is refused there, and not reported twice.
  metric: dependencyFindings(deckOf(page({ type: 'numbers', form: 'metric-strip', metrics: [{ value: '-9.9%', label: 'Rate', sublabel: 'against 7.7% a year earlier', basis: { measures: ['i-bal/rate'] } }, { value: '12.5%', label: 'No basis' }], exhibit: cash })), insights).map((f) => [f.code, f.measured]),
  tokens: say({ title: 'Cash reached {{i-bal/cash@FY26 | 0.0}} million, or {{i-bal/perHead | 0%| x100}} of 99.9 million' }),
  qualitative: advised({ ...page({ exhibit: undefined, settles: undefined, type: 'argument', form: 'memo', title: 'A judgement with 12.5% in it' }), evidence: [] }) }));
''')
        # A title's number no record holds is refused where it is written, not advised.
        self.assertEqual(result["finding"], [["TITLE_NUMBER_UNTRACED", "p1", "blocker", ["56.5 million"]]])
        self.assertIn("the title states 56.5 million", result["repair"])
        self.assertIn("{{<insight id>/<measure>@<period or member> | 0.0}}", result["repair"])
        self.assertEqual(result["recorded"], [])  # recorded values in any dress: scaled, signed, with a currency, a ratio as a percentage
        self.assertEqual(result["wrong"], ["title: 57 million", "title: 15.5 million", "bar: 42.7%", "subtitle: CHF1.4bn", "subtitle: +0.9%"])
        self.assertEqual(result["labels"], [])  # years, periods, dates, model names, ordinals and counts of things are not measurements
        self.assertEqual(result["units"], ["title: 20%", "title: 15m"])
        self.assertEqual(result["ratio"], [])
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
  errors: compiled.compileErrors,
  leaked: JSON.stringify(compiled.spec.slides.map((s) => ({ ...s, pageType: null }))).includes('"basis"'), values: compiled.spec.slides.map((s) => s.blocks.map((b) => b.metric.value)),
  item: codes(grid([item('55m', 'cash', { measures: ['i-bal/cash'] }), item('25m', 'the floor')])), itemWrong: codes(grid([item('65m', 'cash', { measures: ['i-bal/cash'] }), item('25m', 'the floor')])),
  noItemBasis: codes(grid([item('55m', 'cash'), item('25m', 'the floor')])), itemStripped: [JSON.stringify(stripped.page).includes('"basis"'), stripped.dependencies.declared.metrics.length] }));
''')
        self.assertEqual(result["typed"], [])  # was PROOF_MISSING: the row's metric was not read
        self.assertEqual(result["bound"], [])
        self.assertEqual(result["bare"], ["PROOF_MISSING"])  # a row metric that names no measure proves nothing
        self.assertEqual(result["wrong"], ["BASIS_VALUES"])  # and one that names a measure is held to it
        self.assertEqual(result["errors"], [])
        self.assertFalse(result["leaked"])  # `basis` is the author's statement, not a prop the composer draws
        self.assertEqual(result["values"], [["55m", "56m"], ["55m", "56m"]])
        self.assertEqual(result["item"], [])
        self.assertEqual(result["itemWrong"], ["BASIS_VALUES"])
        self.assertEqual(result["noItemBasis"], ["PROOF_MISSING"])
        self.assertEqual(result["itemStripped"], [False, 1])


class RecordReadingTests(unittest.TestCase):
    """What a page's figures print against the record itself, read off the references and the recorded values."""

    def test_a_number_printed_past_the_records_precision_is_advised_with_the_format_that_keeps_it(self):
        """BA retest: the OAG seat shares were recorded as 34, 16 and 14 and printed 34.0% - a precision nobody measured -
        because the writer brief offered `| 0.0` for every token."""
        result = run_node(LOG + '''
const advice = (p) => dependencyFindings(deckOf(p), insights).filter((f) => f.code === 'PRECISION_UNRECORDED').map((f) => [f.severity, f.measured, f.repair]);
const titled = (title) => advice(page({ title }));
const metric = (measure, format) => advice(page({ type: 'numbers', form: 'metric-strip', commentary: 'none', bar: undefined, metrics: [{ measure, format, label: 'A figure' }], exhibit: { heading: 'Cash', series: [{ measure: 'i-bal/cash', name: 'Cash' }] } }));
console.log(JSON.stringify({
  whole: titled('Cash rose to {{i-bal/cash@FY26 | 0.0}} million while debt fell'), kept: titled('Cash rose to {{i-bal/cash@FY26 | 0}} million while debt fell'),
  // The most places any recorded value carries: 0.04 among the swings carries two, so a swing of 4.3 at one place is the record's.
  swing: titled('The swing reached {{i-bal/swing@FY21 | 0.0}} million'), unpatterned: titled('Cash rose to {{i-bal/cash@FY26}} million while debt fell'),
  figure: metric('i-bal/cash@FY26', 'GBP 0.0m'), scaled: metric('i-bal/perHead', '0.00% | x100'), scaledKept: metric('i-bal/perHead', '0.0% | x100') }));
''')
        [(severity, measured, repair)] = result["whole"]
        self.assertEqual(severity, "advisory")
        self.assertEqual(measured, ['i-bal/cash@FY26: "0"'])
        self.assertIn("the token {{i-bal/cash@FY26 | 0.0}} in `title` prints 55.0 where i-bal/cash@FY26 records 55: write \"0\"", repair)
        self.assertEqual(result["kept"], [])
        self.assertEqual(result["swing"], [])
        self.assertEqual(result["unpatterned"], [], "a token with no pattern prints no more places than its value has")
        self.assertEqual(result["figure"][0][1], ['i-bal/cash@FY26: "GBP 0m"'])
        # A ratio printed as a percentage carries the places its record has once scaled: 0.349 is 34.9%.
        self.assertEqual(result["scaled"][0][1], ['i-bal/perHead: "0.0% | x100"'])
        self.assertEqual(result["scaledKept"], [])

if __name__ == "__main__":
    unittest.main()
