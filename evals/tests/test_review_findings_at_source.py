"""Defects a whole-deck review found, refused where the page is written.

A review of a fifty-page deck found blank total rows, an irregular monthly
series drawn at equal spacing, verdict tables in plain text, two named players
with no logo anywhere near the front, an executive summary half as long again
as a dense one, three scenarios written as paragraphs, sixteen pages of one
table construction, and shares of one measure in same-size tiles. Each is now a
compile refusal, a runtime resolution or a deck-level finding at authoring, so
the next review does not have to find it again.
"""
import unittest

from node_probe import run_node

KIT = "./skills/professional-slides/runtime/page-types.mjs"
AUTHOR = "./skills/professional-slides/runtime/author-deck.mjs"
TIME = "./skills/professional-slides/runtime/time-axis.mjs"

PAGE = """
const S = { kind: 'comparison', what: 'Company filings and press reports, 2025 to 2026' };
const base = { takeaway: false, why: 'The page compares the two firms on the same terms', settles: S };
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""


class TotalRowTests(unittest.TestCase):
    def test_a_blank_total_row_is_refused_and_a_measure_table_totals_only_what_sums(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ styleTable }} from './skills/professional-slides/runtime/compose.mjs';
{PAGE}
const table = (rows) => ({{ id: 'p1', type: 'lookup', form: 'table', commentary: 'none', ...base, title: 'The two firms raised capital on different terms',
  exhibit: {{ columns: [{{ label: 'Instrument', type: 'category' }}, 'OpenAI', 'Anthropic'], rows }} }});
const body = [['Equity round', '$122B committed', '$65B Series H'], ['Credit line', '$4.7B undrawn', '$15B reported']];
const matrix = {{ id: 'p2', type: 'matrix', form: 'findings-matrix', commentary: 'in-exhibit', ...base, title: 'The capital call splits between access and structure',
  columns: ['Question', 'Evidence', 'Limit'], rows: [{{ label: 'Largest raise', cells: ['OpenAI, $122B', 'Different schedules'] }}, {{ label: 'Overall', cells: [' ', '-'] }}] }};
const text = {{ columns: ['Control', 'OpenAI', 'Anthropic'], rows: [['Residency', 'US only', 'Varies'], ['Retention', 'Not eligible', 'Eligible'], ['Audit logs', 'Enterprise tier', 'All tiers']] }};
const counts = {{ columns: ['Route', 'Flights', 'Seats'], rows: [['A', '12', '2400'], ['B', '8', '1600'], ['C', '6', '1200']] }};
const rows = (ex) => ex.rows.map((row) => (Array.isArray(row) ? row : row.cells).map((c) => String(c?.text ?? c)));
console.log(JSON.stringify({{
  blank: error(() => compilePage(table([...body, ['Total', '', ' ']]))),
  styled: error(() => compilePage(table([...body, {{ style: 'total', cells: ['All', '-', '-'] }}]))),
  filled: error(() => compilePage(table([...body, ['Total', '$126.7B', '$80B']]))),
  matrix: error(() => compilePage(matrix)),
  autoText: rows(styleTable({{ ...text, total: 'auto' }})).length,
  autoCounts: rows(styleTable({{ ...counts, total: 'auto' }})).at(-1),
  forced: error(() => styleTable({{ ...text, total: true }})),
}}));
''')
        self.assertIn("TOTAL_ROW_BLANK", result["blank"])
        self.assertIn("carries its computed total", result["blank"])
        self.assertIn("TOTAL_ROW_BLANK", result["styled"])
        self.assertIsNone(result["filled"])
        self.assertIn("TOTAL_ROW_BLANK", result["matrix"])
        # The measure-table preset's total is added only where a column sums.
        self.assertEqual(result["autoText"], 3)
        self.assertEqual(result["autoCounts"], ["Total", "26", "5,200"])
        self.assertIn("TOTAL_ROW_BLANK", result["forced"])

    def test_a_measure_table_of_text_composes_without_a_total_row(self):
        # The four blank total rows came from the measure-table preset, which
        # asked every table for a total; composed, a text table now has none.
        result = run_node(f'''
import {{ compileDeck }} from '{AUTHOR}';
import {{ composeAll }} from './skills/professional-slides/runtime/compose-all.mjs';
{PAGE}
const measure = (id, columns, rows) => ({{ id, type: 'lookup', form: 'measure-table', commentary: 'none', ...base, title: 'Controls and volumes differ between the two platforms', exhibit: {{ columns, rows }} }});
const pages = [measure('t1', [{{ label: 'Control', type: 'category' }}, 'OpenAI', 'Anthropic'], [['Residency', 'US only', 'Varies by route'], ['Retention', 'Not eligible', 'Eligible routes'], ['Partners', 'AWS, Azure', 'AWS, Google, Azure']]),
  measure('t2', [{{ label: 'Line', type: 'category' }}, 'Journeys (m)', 'Train-km (m)'], [['Eastern', '14.2', '3.1'], ['Dales', '9.8', '2.2'], ['Valley', '8.1', '1.9']])];
const {{ deck }} = composeAll(compileDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages }}).spec, '.');
const cells = (id) => deck.slides.find((s) => s.id === id).nodes.filter((n) => n.role === 'table-cell-text').map((n) => n.text);
console.log(JSON.stringify({{ text: cells('t1').includes('Total'), counts: cells('t2').slice(-3) }}));
''')
        self.assertFalse(result["text"])
        self.assertEqual(result["counts"], ["Total", "32.1", "7.2"])


class TimeAxisTests(unittest.TestCase):
    def test_period_labels_parse_only_where_unambiguous(self):
        result = run_node(f'''
import {{ parsePeriod, timePositions }} from '{TIME}';
const kinds = ['2025', '2025E', 'FY25', '2019-20', 'Q1 2025', '1Q25', '2025 Q3', 'H1 2025', 'Jan 2025', "Jan '25", 'Jan-25', '2025-01', 'Mar', 'LTM', '2025 YTD', 'Q5 2025', 'Northern']
  .map((c) => parsePeriod(c)?.kind ?? null);
console.log(JSON.stringify({{ kinds,
  gaps: timePositions(['2015', '2018', '2019', '2020']), even: timePositions(['2019', '2020', '2021', '2022']),
  wrap: timePositions(['Nov', 'Dec', 'Feb', 'Mar']), mixed: timePositions(['2019', 'Q1 2020', 'Q2 2020']), backwards: timePositions(['2021', '2019', '2020']) }}));
''')
        self.assertEqual(result["kinds"], ["year", "year", "year", "year", "quarter", "quarter", "quarter", "half", "month", "month", "month", "month", "bare-month", None, None, None, None])
        self.assertEqual(result["gaps"], [0, 0.6, 0.8, 1])
        self.assertIsNone(result["even"])  # even gaps keep their slots
        self.assertEqual(result["wrap"], [0, 0.25, 0.75, 1])
        self.assertIsNone(result["mixed"])
        self.assertIsNone(result["backwards"])

    def test_a_line_spaces_uneven_dates_by_time_and_stays_drawn(self):
        result = run_node('''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { nativeChartSpec } from './skills/professional-slides/runtime/core.mjs';
const categories = ['Jan 25', 'Mar 25', 'Jun 25', 'Aug 25', 'Oct 25', 'Dec 25', 'Feb 26', 'Apr 26', 'May 26', 'Jul 26'];
const frame = { x: 60, y: 160, width: 700, height: 420 };
const draw = (id, cats) => {
  const props = { heading: 'Run rate', unit: '$B', categories: cats, series: [{ name: 'Run rate', values: [1, 1.4, 3, 5, 7, 9, 14, 30, 47, 65].slice(0, cats.length) }], highlights: [], annotations: [], referenceLines: [] };
  const out = REGISTRY.get(id).render({ id: 't', frame, props });
  const nodes = Array.isArray(out) ? out : out.nodes;
  const xs = nodes.filter((n) => n.role === 'chart-marker').map((n) => n.frame.x + n.frame.width / 2);
  const labels = nodes.filter((n) => n.role === 'category-label').map((n) => n.frame);
  return { xs, labels, native: nativeChartSpec(id, props, frame, nodes) !== null };
};
const spaced = draw('chart.line', categories), even = draw('chart.line', ['2019', '2020', '2021', '2022', '2023', '2024']), area = draw('chart.area', categories);
const step = (xs) => xs.slice(1).map((x, i) => Math.round(x - xs[i]));
const overlap = spaced.labels.some((a, i) => spaced.labels.slice(i + 1).some((b) => a.x < b.x + b.width && b.x < a.x + a.width));
console.log(JSON.stringify({ spaced: step(spaced.xs), even: step(even.xs), area: step(area.xs), labels: spaced.labels.length, overlap, native: [spaced.native, even.native, area.native] }));
''')
        steps = result["spaced"]
        # Two months apart is twice one month apart: Jan-Mar against Apr-May.
        self.assertAlmostEqual(steps[0] / steps[7], 2, delta=0.1)
        self.assertAlmostEqual(steps[1] / steps[7], 3, delta=0.1)
        self.assertEqual(len(set(result["even"])), 1)  # an even series keeps equal slots
        self.assertEqual(result["area"], steps)
        self.assertGreaterEqual(result["labels"], 4)
        self.assertFalse(result["overlap"])
        # PowerPoint's category axis would respace them, so those stay drawn.
        self.assertEqual(result["native"], [False, True, False])

    def test_a_column_chart_of_uneven_dates_is_refused_unless_they_are_snapshots(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const trend = (categories, heading = 'Revenue, $B') => ({{ id: 'p1', type: 'trend', form: 'column', commentary: 'on-exhibit', ...base, title: 'Revenue rose sixfold in five years',
  exhibit: {{ heading, categories, series: [{{ name: 'Rev', values: categories.map((_, i) => i + 1) }}, {{ name: 'Cost', values: categories.map((_, i) => i) }}],
    annotations: [{{ category: categories[1], text: 'The launch year doubled revenue as the new product reached every region' }}] }} }});
console.log(JSON.stringify({{
  uneven: error(() => compilePage(trend(['2015', '2018', '2019', '2020', '2021']))),
  snapshots: error(() => compilePage(trend(['2015', '2018', '2019', '2020', '2021'], 'Revenue in selected years, $B'))),
  even: error(() => compilePage(trend(['2017', '2018', '2019', '2020', '2021']))),
}}));
''')
        self.assertIn("TIME_AXIS_UNEVEN", result["uneven"])
        self.assertIn("1-3 years apart", result["uneven"])
        self.assertIsNone(result["snapshots"])
        self.assertIsNone(result["even"])


class VerdictTableTests(unittest.TestCase):
    def test_a_judgement_column_in_words_is_refused_and_a_coded_one_compiles(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const lookup = (column, cells) => ({{ id: 'p1', type: 'lookup', form: 'table', commentary: 'none', ...base, title: 'The near-term commercial call is split between the two firms',
  exhibit: {{ columns: [{{ label: 'Criterion', type: 'category' }}, column, 'Reason'], rows: [['Consumer reach', cells[0], 'Over a billion weekly users'], ['Enterprise adoption', cells[1], 'Ramp panel, narrow lead'], ['Coding', cells[2], 'Units differ']] }} }});
const matrix = {{ id: 'p2', type: 'matrix', form: 'findings-matrix', commentary: 'in-exhibit', ...base, title: 'The model race is a portfolio of workloads, not a leaderboard',
  columns: ['Workload', 'Current signal / Winner call', 'Caveat'], rows: [
    {{ label: 'Composite', cells: ['Opus 5.5 at 58 | Anthropic', 'One configuration'] }}, {{ label: 'Coding cost', cells: ['Astra 40% lower | OpenAI', 'Task mix varies'] }},
    {{ label: 'Terminal', cells: ['Near parity | No durable gap', 'Harness matters'] }}] }};
console.log(JSON.stringify({{
  edge: error(() => compilePage(lookup('Current edge', ['OpenAI', 'Anthropic', 'No verdict']))),
  confidence: error(() => compilePage(lookup('Confidence', ['High', 'Medium', 'Low']))),
  coded: error(() => compilePage(lookup({{ label: 'Status', type: 'rag' }}, [{{ type: 'rag', value: 'on-track' }}, {{ type: 'rag', value: 'behind' }}, {{ type: 'rag', value: 'at-risk' }}]))),
  words: error(() => compilePage(lookup('Status', ['On track', 'Behind', 'At risk']))),
  numbers: error(() => compilePage(lookup('Score', ['72', '64%', '8.1']))),
  prose: error(() => compilePage(lookup('Status', ['Approved in the EU and pending in the US', 'Filed in March with a decision due in the autumn', 'Not yet filed anywhere this year']))),
  matrix: error(() => compilePage(matrix)),
}}));
''')
        self.assertIn("VERDICT_TABLE_PLAIN", result["edge"])
        self.assertIn('"Current edge"', result["edge"])
        self.assertIn("scorecard", result["edge"])
        self.assertIn("VERDICT_TABLE_PLAIN", result["confidence"])
        self.assertIsNone(result["coded"])
        self.assertIsNone(result["words"])  # words the composer codes as status pills
        self.assertIsNone(result["numbers"])  # a score in numbers is a measure
        self.assertIsNone(result["prose"])  # a status described is not a verdict
        self.assertIn('"Winner call"', result["matrix"])


class ProseTests(unittest.TestCase):
    def test_scenarios_as_paragraphs_are_refused_and_an_argument_is_not(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const words = (n, seed) => Array.from({{ length: n }}, (_, i) => ['buyers', 'retain', 'both', 'models', 'while', 'serving', 'costs', 'fall', 'faster', 'than', 'prices'][(i + seed) % 11]).join(' ') + '.';
const memo = (title, paragraphs) => ({{ id: 'p1', type: 'argument', form: 'sidebar', commentary: 'none', ...base, title, paragraphs, panel: {{ text: 'The base case is split leadership with a contested middle.' }} }});
const cards = {{ id: 'p2', type: 'parallel', form: 'cards', commentary: 'in-exhibit', ...base, title: 'Three market structures divide the value differently',
  exhibit: {{ items: [0, 1, 2].map((i) => ({{ title: 'Scenario ' + (i + 1), text: words(64, i) }})) }} }};
console.log(JSON.stringify({{
  scenarios: error(() => compilePage(memo('Three scenarios divide value across models, apps and clouds', [words(171, 0), words(62, 3), words(61, 5)]))),
  argument: error(() => compilePage(memo('The funding gap should be borrowed rather than cut', [words(70, 0), words(66, 3), words(64, 5)]))),
  short: error(() => compilePage(memo('Three scenarios divide value across models, apps and clouds', [words(40, 0), words(35, 3), words(30, 5)]))),
  cards: error(() => compilePage(cards)),
}}));
''')
        self.assertIn("SCENARIO_PROSE", result["scenarios"])
        self.assertIn("171, 62, 61", result["scenarios"])
        self.assertIn("labelled-rows", result["scenarios"])
        self.assertIsNone(result["argument"])
        self.assertIsNone(result["short"])
        self.assertIn("SCENARIO_PROSE", result["cards"])

    def test_the_summary_ceiling_and_the_block_a_reader_meets(self):
        result = run_node('''
import { wordBudgetOf } from './skills/professional-slides/runtime/derive-content.mjs';
import { checkTextPlan } from './skills/professional-slides/runtime/text-contract.mjs';
const w = (n) => Array.from({ length: n }, () => 'word').join(' ');
const page = (textPlan) => ({ pages: [{ id: 'p1', n: 1, textReference: { task: 'chart-with-commentary' }, textPlan }] });
const long = (plan) => checkTextPlan(page(plan), { required: true }).findings.some((f) => f.code === 'TEXT_BLOCK_TOO_LONG');
console.log(JSON.stringify({
  summary: wordBudgetOf('text-page', { role: 'executive-summary' }).ceiling, text: wordBudgetOf('text-page', {}).ceiling,
  leadAndItem: long([{ id: 'x:points:lead:0', role: 'body', text: w(40) }, { id: 'x:points:item:0', role: 'body', text: w(131) }, { id: 'x:points:item:1', role: 'body', text: w(30) }]),
  twoPoints: long([{ id: 'x:points:item:0', role: 'body', text: w(100) }, { id: 'x:points:item:1', role: 'body', text: w(100) }]),
  card: long([{ id: 'x:card-text:0', role: 'exhibit', text: w(160) }]),
}));
''')
        self.assertEqual(result["summary"], 204)  # the text page's upper quartile
        self.assertEqual(result["text"], 329)  # other text pages keep the fence
        self.assertTrue(result["leadAndItem"])
        self.assertFalse(result["twoPoints"])
        self.assertTrue(result["card"])


class DeckTests(unittest.TestCase):
    def deck(self, extra):
        return run_node(f'''
import {{ compileDeck }} from '{AUTHOR}';
{PAGE}
const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const chart = {{ type: 'trend', form: 'line', commentary: 'on-exhibit', exhibit: {{ categories: years, series: [{{ name: 'x', values: [1, 2, 3, 4, 5, 6, 7, 8] }}, {{ name: 'y', values: [2, 3, 4, 5, 6, 7, 8, 9] }}],
  annotations: [{{ category: '2021', text: 'The turn came when grounded capacity returned to the network' }}] }} }};
const table = {{ type: 'lookup', form: 'table', commentary: 'none', exhibit: {{ columns: [{{ label: 'Item', type: 'category' }}, 'OpenAI', 'Anthropic'], rows: [['A', 'x', 'y'], ['B', 'x', 'y'], ['C', 'x', 'y']] }} }};
const coded = {{ type: 'scorecard', form: 'harvey', commentary: 'in-exhibit', exhibit: {{ columns: ['Option', {{ label: 'Fit', type: 'harvey' }}], rows: [['A', {{ type: 'harvey', value: 2 }}], ['B', {{ type: 'harvey', value: 3 }}], ['C', {{ type: 'harvey', value: 1 }}]] }} }};
const logos = {{ type: 'profiles', form: 'logo-table', commentary: 'in-exhibit', exhibit: {{ columns: [{{ label: '', type: 'logo' }}, 'Firm', 'Users'],
  rows: [[{{ media: {{ alt: 'OpenAI logo' }} }}, 'OpenAI', '1bn'], [{{ media: {{ alt: 'Anthropic logo' }} }}, 'Anthropic', 'n/a'], [{{ media: {{ alt: 'Google logo' }} }}, 'Google', 'n/a']] }} }};
const cards = {{ type: 'profiles', form: 'cards', commentary: 'none', exhibit: {{ items: [{{ title: 'ChatGPT', text: 'The consumer assistant' }}, {{ title: 'Claude', text: 'The enterprise assistant' }}] }} }};
const make = (kinds, titles = []) => kinds.map((k, i) => ({{ id: 'c' + i, ...base, title: titles[i] ?? 'Finding number ' + i + ' of the deck', ...structuredClone(k) }}));
{extra}
''')

    def test_table_monotony_is_found_in_a_window_and_a_mixed_deck_passes(self):
        result = self.deck('''
const run = [chart, table, table, table, chart, table, table, table, chart, chart, coded, chart];
const mixed = [chart, table, chart, coded, table, chart, coded, table, chart, coded, table, chart];
const find = (kinds) => compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'd' }, pages: make(kinds) }).findings.find((f) => f.code === 'VARIETY_TABLES') ?? null;
console.log(JSON.stringify({ run: find(run), mixed: find(mixed) }));
''')
        self.assertEqual(result["run"]["measured"]["pages"], 6)
        self.assertEqual(result["run"]["measured"]["construction"], "filled first column · text cells · short · open foot")
        self.assertIn("bridge", result["run"]["repair"])
        self.assertIsNone(result["mixed"])

    def test_named_players_need_their_marks_early(self):
        result = self.deck('''
const kinds = [chart, coded, chart, coded, chart, coded, chart, coded, chart, coded, chart, coded];
const players = [{ name: 'OpenAI' }, { name: 'Anthropic' }];
const codes = (deck, pages) => compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'd', ...deck }, pages }).findings.filter((f) => ['PLAYERS_UNMARKED', 'PROFILE_UNPICTURED'].includes(f.code));
const titled = make(kinds, kinds.map((_, i) => i % 2 ? 'OpenAI leads reach on measure ' + i : 'Anthropic leads spend on measure ' + i));
console.log(JSON.stringify({
  declared: codes({ players }, make(kinds)).map((f) => f.code),
  introduced: codes({ players }, make([chart, logos, ...kinds.slice(2)])).map((f) => f.code),
  late: codes({ players }, make([...kinds.slice(0, 6), logos, ...kinds.slice(7)])).map((f) => f.code),
  titles: codes({}, titled).map((f) => f.measured.players ?? f.code),
  unnamed: codes({}, make(kinds)).length,
  cards: codes({ players }, make([chart, logos, cards, ...kinds.slice(3)])).map((f) => f.code),
}));
''')
        self.assertEqual(result["declared"], ["PLAYERS_UNMARKED"])
        self.assertEqual(result["introduced"], [])
        self.assertEqual(result["late"], ["PLAYERS_UNMARKED"])
        self.assertEqual(sorted(result["titles"][0]), ["Anthropic", "OpenAI"])
        self.assertEqual(result["unnamed"], 0)
        self.assertEqual(result["cards"], ["PROFILE_UNPICTURED"])

    def test_shares_of_one_measure_in_equal_tiles_are_advised(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const strip = (metrics) => compilePage({{ id: 'p1', type: 'numbers', form: 'metric-strip', commentary: 'none', ...base, title: 'Claude gained web share, but ChatGPT still drew six times its visits', metrics,
  exhibit: {{ type: 'chart.bar', heading: 'Web visit share, Aug 2026', unit: '%', categories: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], series: [{{ name: 's', values: [57, 9.6, 8, 7, 6, 5, 4, 3] }}] }} }}).pageType.advisories ?? [];
console.log(JSON.stringify({{
  same: strip([{{ value: '9.6%', label: 'Claude web visit share, Aug 2026' }}, {{ value: '57%', label: 'ChatGPT web visit share, Aug 2026' }}]),
  close: strip([{{ value: '41%', label: 'Claude web visit share, Aug 2026' }}, {{ value: '57%', label: 'ChatGPT web visit share, Aug 2026' }}]),
  different: strip([{{ value: '2%', label: 'Churn in the first month' }}, {{ value: '78%', label: 'Gross margin after inference' }}]),
}}));
''')
        self.assertEqual(len(result["same"]), 1)
        self.assertTrue(result["same"][0].startswith("SHARES_IN_TILES"))
        self.assertIn("one 0-100% scale", result["same"][0])
        self.assertEqual(result["close"], [])
        self.assertEqual(result["different"], [])


if __name__ == "__main__":
    unittest.main()
