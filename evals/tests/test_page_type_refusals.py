"""What a typed page refuses at compile (runtime/page-types.mjs compilePage).

Each refusal names the defect a reviewer found on a built page - a blank total,
a judgement column in words, dots where a line belongs, a strip repeating its
chart, scenarios set as paragraphs - and the repair, before anything is drawn.
Each test compiles the failing page and its passing neighbour.
"""
import re
import sys
import unittest

from node_probe import RUNTIME, run_node

sys.path.insert(0, str(RUNTIME / "gates"))
import page_gates  # noqa: E402

KIT = "./skills/professional-slides/runtime/page-types.mjs"

PAGE = """
const S = { kind: 'comparison', what: 'Company filings and press reports, 2025 to 2026' };
const base = { takeaway: false, why: 'The page compares the two firms on the same terms', settles: S, adds: 'The commentary names what the exhibit cannot: the terms behind each figure' };
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage, describeTypes } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const S = { kind: 'comparison', what: 'The operator annual reports' };
const base = { takeaway: false, why: 'The page type fits the claim this page makes', settles: S, adds: 'The commentary names the mechanism the exhibit cannot show' };
const compose = (pages) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: pages.map((p, i) => compilePage(p, i)) }, '.').deck.slides;
const error = (fn) => { try { fn(); return null; } catch (e) { return (e.pageErrors ?? [e.message]).join(' | '); } };
// The emphasised text of a composed page, runs joined across line breaks.
const lit = (slide) => slide.nodes.map((n) => (n.runs || []).map((r) => (r.text === '\\n' ? ' ' : r.accent || r.bold ? r.text.replace(/\\n/g, ' ') : ' | ')).join('')).join(' | ');
const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const regions = ['Europe', 'East Asia & Australasia', 'Americas', 'West Asia & Indian Ocean', 'Africa', 'Middle East'];
"""


class TableRefusalTests(unittest.TestCase):
    """One refusal for each table defect, read off the cells as they are drawn."""

    TABLES = '''
const table = (heading, rows) => ({ type: 'table', heading, columns: ['Measure', 'Value', 'Date'], rows });
const two = [['Revenue run rate', '>$2.5B', 'Feb 2026'], ['Enterprise share', 'More than half', 'Feb 2026']];
const three = [...two, ['Weekly users', 'n/a', 'Feb 2026']];
const stack = (exhibits) => ({ ...base, id: 't', type: 'panels', form: 'stack', commentary: 'none', title: 'Coding metrics cannot be reduced to one share', exhibits });
const players = [{ name: 'Northwind' }, { name: 'Southgate Labs', short: 'Southgate' }];
const lookup = (rows, extra = {}) => ({ ...base, id: 'l', type: 'lookup', form: 'table', commentary: 'none', title: 'The two firms split the criteria between them',
  exhibit: { columns: [{ label: 'Measure', type: 'category' }, 'First', 'Second'], rows }, ...extra });
const body = [['Consumer reach', 'Northwind', 'Southgate'], ['Enterprise seats', 'Southgate', 'Northwind'], ['Developer use', 'Northwind', 'Southgate']];
const opts = { players };
'''

    def test_a_blank_total_row_is_refused_and_a_measure_table_totals_only_what_sums(self):
        """Fifty-page review: four total rows were blank; a measure table totals only the columns that sum."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ styleTable }} from './evals/support/compose.mjs';
{PAGE}
const table = (rows) => ({{ id: 'p1', type: 'lookup', form: 'table', commentary: 'none', ...base, title: 'The two firms raised capital on different terms',
  exhibit: {{ columns: [{{ label: 'Instrument', type: 'category' }}, 'OpenAI', 'Anthropic'], rows }} }});
// Three body rows: a table long enough to keep, so its total is what is checked.
const body = [['Equity round', '$122B committed', '$65B Series H'], ['Credit line', '$4.7B undrawn', '$15B reported'], ['Compute deals', '$300B announced', '$50B announced']];
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

    def test_short_tables_and_twins_are_one_refusal_each(self):
        """Fifty-page review: two tables on different measures fired three refusals with one repair."""
        # Moved from test_pill_columns. Two tables with the same columns on
        # different measures fired COMPARISON_MEASURES_DIFFER, TABLE_TOO_SHORT
        # and TABLE_PANELS_MERGE with one repair; now one TABLE_PANELS_MERGE
        # names the measures (the expectation for `differ` changed with it).
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
{self.TABLES}
const first = table('First product', [['Revenue run rate', '>$2.5B', 'Feb 2026'], ['Enterprise share', '>50%', 'Feb 2026'], ['Paid seats', 'n/a', 'Feb 2026']]);
const second = table('Second product', [['Weekly users', '>5M', 'Jun 2026'], ['Knowledge-worker share of use', '~20%', 'Jun 2026'], ['Paid seats', 'n/a', 'Jun 2026']]);
const bars = (heading, unit) => ({{ type: 'chart.column', heading, unit, categories: ['2021', '2022', '2023', '2024', '2025'], series: [{{ name: 'x', values: [1, 2, 3, 4, 5] }}] }});
const panels = (a, b) => ({{ ...base, id: 'p', type: 'panels', form: 'row', commentary: 'none', title: 'Both firms grew, measured differently', exhibits: [a, b] }});
console.log(JSON.stringify({{
  short: error(() => compilePage({{ ...base, id: 's', type: 'lookup', form: 'table', commentary: 'none', title: 'Coding metrics cannot be reduced to one share', exhibit: table('First product', two) }})),
  twins: error(() => compilePage(stack([table('First product', three), table('Second product', three)]))),
  twinsShort: error(() => compilePage(stack([table('First product', two), table('Second product', two)]))),
  differ: error(() => compilePage(stack([first, second]))),
  ok: error(() => compilePage({{ ...base, id: 'o', type: 'lookup', form: 'table', commentary: 'none', title: 'Coding metrics cannot be reduced to one share', exhibit: {{ type: 'table', columns: ['Measure', 'First', 'Second', 'Date'], rows: [['Revenue run rate', '>$2.5B', 'n/a', 'Feb 2026'], ['Enterprise share', 'More than half', 'n/a', 'Feb 2026'], ['Weekly users', 'n/a', '>5M', 'Jun 2026']] }} }})),
  panels: error(() => compilePage(panels(bars('Northwind revenue', '$bn'), bars('Southgate weekly users', 'm users')), 0, opts)),
  samePanels: error(() => compilePage(panels(bars('Northwind revenue', '$bn'), bars('Southgate revenue', '$bn')), 0, opts)),
}}));
''')
        self.assertIn("TABLE_TOO_SHORT", result["short"])
        self.assertIn("TABLE_PANELS_MERGE", result["twins"])
        self.assertNotIn("different measures", result["twins"])
        self.assertIn("TABLE_PANELS_MERGE", result["twinsShort"])  # merged, a pair of two-row tables is one table
        self.assertIn("TABLE_PANELS_MERGE", result["differ"])
        self.assertIn("on different measures", result["differ"])
        self.assertIn("Weekly users", result["differ"])
        self.assertIsNone(result["ok"])
        self.assertIn("COMPARISON_MEASURES_DIFFER", result["panels"])  # a player's short name heads its panel
        self.assertNotIn("COMPARISON_MEASURES_DIFFER", result["samePanels"] or "")

    def test_tables_one_above_another_are_one_table(self):
        """Fifty-page review: two funding rounds stacked as tables compared nothing."""
        # Two funding rounds stacked, each "Measure | Disclosed value" on its
        # own measures, compared nothing; tables of different columns stacked
        # read no better. Side by side in a row, they are two panels.
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
{self.TABLES}
const round = (heading, rows) => ({{ type: 'table', heading, columns: ['Measure', 'Disclosed value'], rows }});
const march = round('Northwind March round', [['Committed capital', '$40B'], ['Post-money valuation', '$300B'], ['Undrawn credit', '$4B']]);
const may = round('Southgate May Series H', [['Round size', '$13B'], ['Post-money valuation', '$183B'], ['Included commitments', '$2B']]);
const terms = {{ type: 'table', heading: 'Terms', columns: ['Term', 'Northwind', 'Southgate'], rows: [['Lead investor', 'A', 'B'], ['Board seat', 'Yes', 'No'], ['Close', 'March', 'May']] }};
const chart = {{ type: 'chart.column', heading: 'Capital raised by year', unit: '$B', categories: ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], series: [{{ name: 'x', values: [1, 2, 3, 5, 8, 13, 21, 40] }}] }};
const panels = (form, exhibits) => ({{ ...base, id: 'k', type: 'panels', form, commentary: 'none', title: 'The two rounds were raised on different terms', exhibits }});
console.log(JSON.stringify({{
  rounds: error(() => compilePage(panels('stack', [march, may]))),
  stacked: error(() => compilePage(panels('stack', [march, terms]))),
  grid: error(() => compilePage(panels('grid', [march, chart, terms]))),
  row: error(() => compilePage(panels('row', [march, terms]))),
  withChart: error(() => compilePage(panels('row', [terms, chart]))),
}}));
''')
        self.assertIn("TABLE_PANELS_MERGE", result["rounds"])
        self.assertIn("on different measures", result["rounds"])
        # every measure either table names, once, and "n/a" where a member discloses none
        self.assertIn("Committed capital, Post-money valuation, Undrawn credit, Round size, Included commitments", result["rounds"])
        self.assertIn('"n/a"', result["rounds"])
        self.assertIn("TABLE_STACK", result["stacked"])
        self.assertIn("TABLE_STACK", result["grid"])  # a table in each row of the grid
        self.assertIsNone(result["row"])
        self.assertIsNone(result["withChart"])

    def test_cells_drawn_as_logos_are_read_as_their_players(self):
        """Fifty-page review: cells drawn as logos were read as blank, and a highlight on a player was looked for in its name."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
{self.TABLES}
const roster = (n) => ({{ ...base, id: 'r', type: 'profiles', form: 'logo-table', commentary: 'in-exhibit', title: 'Two carriers set the terms of the market',
  exhibit: {{ columns: [{{ label: '', type: 'logo' }}, 'Carrier', 'Fleet'], rows: [[{{ media: {{ alt: 'Northwind logo' }} }}, 'Northwind', '260'], [{{ media: {{ alt: 'Southgate logo' }} }}, 'Southgate', '140']].slice(0, n) }} }});
console.log(JSON.stringify({{
  logoTotal: error(() => compilePage(lookup([...body, ['Overall', 'Northwind', 'Southgate']]), 0, opts)),
  blankTotal: error(() => compilePage(lookup([...body, ['Overall', '', '-']]), 0, opts)),
  logoHighlight: error(() => compilePage(lookup(body, {{ title: 'Southgate leads on seats while Northwind leads on reach', highlight: 'Southgate' }}), 0, opts)),
  textCell: error(() => compilePage(lookup([[body[0][0], body[0][1], {{ text: 'Southgate', highlight: true }}], ...body.slice(1)], {{ highlight: 'Southgate' }}), 0, opts)),
  rosterTwo: error(() => compilePage(roster(2))), rosterOne: error(() => compilePage(roster(1))),
}}));
''')
        self.assertIsNone(result["logoTotal"])  # a total row of player marks is not blank
        self.assertIn("TOTAL_ROW_BLANK", result["blankTotal"])
        self.assertIn("drawn as Southgate Labs's logo", result["logoHighlight"])
        self.assertNotIn("only in the title", result["logoHighlight"])
        self.assertIsNone(result["textCell"])  # a cell with its own highlight stays text, and takes the accent
        self.assertIsNone(result["rosterTwo"])  # PLAYERS_UNMARKED sends a two-player deck here
        self.assertIn("TABLE_TOO_SHORT", result["rosterOne"])

    def test_the_shape_is_refused_before_the_cells(self):
        """Fifty-page review: a blank total fixed on a table too short to keep is work thrown away, so the shape is refused first."""
        # Only the first refusal is shown: a blank total fixed on a table too
        # short to keep, or an icon renamed on a page of the wrong form, is work thrown away.
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
{self.TABLES}
console.log(JSON.stringify({{
  shortAndBlank: error(() => compilePage(lookup([['Consumer reach', '12', '9'], ['Total', '', '']]))),
  formAndIcon: error(() => compilePage({{ ...lookup(body), form: 'grid', points: [{{ text: 'Reach is split', icon: 'nosuchicon' }}] }})),
}}));
''')
        self.assertIn("TABLE_TOO_SHORT", result["shortAndBlank"])
        self.assertIn("choose `form`", result["formAndIcon"])

    def test_a_judgement_column_in_words_is_refused_and_a_coded_one_compiles(self):
        """Fifty-page review: verdict tables were set in plain text."""
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

    def test_a_label_repeating_its_rows_figures_is_refused(self):
        """Rebuilt fifty-page deck: a row table's label repeated the figures in its rows."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
const table = (head, rows) => ({{ type: 'table', columns: [{{ label: 'Lab', type: 'category' }}, head], rows }});
const page = (labels) => ({{ id: 'r', type: 'parallel', form: 'labelled-rows', commentary: 'in-exhibit', takeaway: false, why: 'Each financing state sits beside its figures',
  settles: {{ kind: 'comparison', what: 'Dated funding and valuation states' }}, title: 'One lab raised more; the other took the higher mark',
  blocks: [{{ label: labels[0], points: ['The first lab closed its round in March.', 'The second announced its round in May.'], exhibit: table('Round, $B', [['First', '122'], ['Second', '65']]) }},
           {{ label: labels[1], points: ['The first priced its round in March.', 'The second priced a later round in May.'], exhibit: table('Post-money, $B', [['First', '852'], ['Second', '965']]) }}] }});
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
console.log(JSON.stringify({{ repeated: error(() => compilePage(page(['First $122B\\nSecond $65B', 'Post-money mark']))), named: error(() => compilePage(page(['Round size', 'Post-money mark']))) }}));
''')
        self.assertIn('repeats 122 and 65', result['repeated'])
        self.assertIsNone(result['named'])


class ChartRefusalTests(unittest.TestCase):
    """A chart page that would draw the wrong form, or say nothing to read a value by."""

    def test_a_column_chart_of_uneven_dates_is_refused_unless_they_are_snapshots(self):
        """Fifty-page review: uneven years drawn as evenly spaced columns."""
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

    def test_three_chosen_years_are_a_comparison_and_four_uneven_ones_are_refused(self):
        """Fifty-page review: the docs' example of an uneven axis was three columns, which the check leaves alone."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const trend = (categories) => ({{ id: 'p1', type: 'trend', form: 'column', commentary: 'on-exhibit', ...base, title: 'Revenue rose sixfold in five years',
  exhibit: {{ heading: 'Revenue, $B', categories, series: [{{ name: 'Rev', values: categories.map((_, i) => i + 1) }}, {{ name: 'Cost', values: categories.map((_, i) => i) }}],
    annotations: [{{ category: categories[1], text: 'The launch year doubled revenue as the new product reached every region' }}] }} }});
console.log(JSON.stringify({{ three: error(() => compilePage(trend(['2015', '2018', '2019']))), four: error(() => compilePage(trend(['2015', '2018', '2019', '2020']))) }}));
''')
        self.assertNotIn("TIME_AXIS_UNEVEN", result["three"] or "")
        self.assertIn("TIME_AXIS_UNEVEN", result["four"])

    def test_dots_over_time_and_formula_curves_are_refused_at_compile(self):
        """Fifty-page audit: a time series and formula curves drawn as loose dots."""
        result = run_node(f"""
import {{ compilePage }} from '{KIT}';
{PAGE}
const scatter = (exhibit) => ({{ ...base, id: 'p1', type: 'relationship', form: 'scatter', commentary: 'on-exhibit', title: 'The hurdle falls as contribution per task rises',
  exhibit: {{ heading: 'Hurdle', annotations: [{{ category: 'p3', text: 'At equal contribution the hurdle is half of all the paid tasks' }}], ...exhibit }} }});
const curve = [0.2, 0.5, 1, 1.5, 2, 3, 4, 5].map((x, i) => ({{ name: 'p' + i, x, y: Math.round(100 / (1 + x)) }}));
const cloud = [[1, 5], [2, 3], [3, 6], [4, 2], [5, 7], [6, 4], [7, 6], [8, 3]].map(([x, y], i) => ({{ name: 'p' + i, x, y }}));
console.log(JSON.stringify({{
  time: error(() => compilePage(scatter({{ xLabel: 'Months since Jan 2025', points: cloud }}))),
  curve: error(() => compilePage(scatter({{ xLabel: 'Contribution ratio', points: curve }}))),
  joined: error(() => compilePage(scatter({{ xLabel: 'Contribution ratio', points: curve, connect: true, referenceLines: [{{ value: 50, label: 'Equal share' }}] }}))),
  cloud: error(() => compilePage(scatter({{ xLabel: 'Contribution ratio', points: cloud }}))),
}}));
""")
        self.assertIn("trend drawn without its line", result["time"])
        self.assertIn("connect: true", result["curve"])
        for key in ("joined", "cloud"):
            self.assertNotIn("connect: true", result[key] or "")
            self.assertNotIn("without its line", result[key] or "")

    def test_value_labels_switched_off_on_a_few_marks_are_refused(self):
        """Fifty-page audit: a chart of a few marks with its value labels off left nothing to read a value by."""
        result = run_node(f"""
import {{ compilePage }} from '{KIT}';
{PAGE}
const trend = (extra) => ({{ ...base, id: 'p1', type: 'trend', form: 'column', commentary: 'on-exhibit', title: 'Revenue rose in every year of the run',
  exhibit: {{ heading: 'Revenue, $B', categories: ['2021', '2022', '2023', '2024'], series: [{{ name: 'A', values: [1, 2, 3, 4] }}, {{ name: 'B', values: [2, 2, 3, 3] }}],
    annotations: [{{ category: '2022', text: 'The launch year doubled revenue as the new product reached every region' }}], ...extra }} }});
console.log(JSON.stringify({{ off: error(() => compilePage(trend({{ dataLabels: false }}))), gridded: error(() => compilePage(trend({{ dataLabels: false, gridlines: true }}))) }}));
""")
        self.assertIn("nothing to read a value by", result["off"])
        self.assertNotIn("nothing to read a value by", result["gridded"] or "")

    def test_a_subtitle_that_restates_the_chart_heading_is_refused(self):
        """Fifty-six-page re-author: a subtitle restating the chart's heading passed."""
        result = run_node(PRELUDE + """
const page = (subtitle) => ({ ...base, id: 'p', type: 'trend', form: 'column', commentary: 'on-exhibit', title: 'Passengers recovered past their 2019 level by 2023', subtitle,
  exhibit: { heading: 'Airport passengers, 2019 to 2025', unit: 'million', categories: years, series: [{ name: 'Passengers', values: [89, 86, 26, 29, 66, 87, 92, 95] }],
    annotations: [{ category: '2020', text: 'Closure year: traffic fell by seventy percent' }, { category: '2025', text: 'A record year on the new schedule' }] } });
console.log(JSON.stringify({ restated: error(() => compilePage(page('Airport passengers 2019 to 2025, million'))), scope: error(() => compilePage(page('Calendar years; the hub operator\\'s own counts, all terminals'))) }));
""")
        self.assertIn("heading", result["restated"])
        self.assertIsNone(result["scope"])


class FigureRefusalTests(unittest.TestCase):
    """Figures set in boxes say different things, and colour by merit."""

    def test_one_measure_in_two_tiles_and_a_strip_repeating_its_chart_are_refused(self):
        """Fifty-page audit: one measure at two dates in two tiles, and a strip repeating what its chart printed."""
        result = run_node(f"""
import {{ compilePage }} from '{KIT}';
{PAGE}
const facts = (items) => ({{ ...base, id: 'p1', type: 'numbers', form: 'fact-grid', commentary: 'none', title: 'Claude retention improved over the year', exhibit: {{ items }} }});
const strip = (metrics) => ({{ ...base, id: 'p2', type: 'numbers', form: 'metric-strip', commentary: 'none', title: 'OpenAI pace rose through the year', metrics,
  exhibit: {{ type: 'chart.column', heading: 'Pace, $B', categories: ['2023', '2024', '2025', 'Mar 2026', 'Aug 2026'], series: [{{ name: 'Pace', values: [2, 6, 20, 24, 40] }}] }} }});
console.log(JSON.stringify({{
  dates: error(() => compilePage(facts([{{ value: '25.8%', label: 'Claude Jan 2025 cohort retained at six months' }}, {{ value: '45%', label: 'Claude Feb 2026 cohort retained at six months' }}, {{ value: '14pp', label: 'Gap to ChatGPT, latest' }}]))),
  distinct: error(() => compilePage(facts([{{ value: '$1B', label: 'Ads annualized run rate' }}, {{ value: '<200d', label: 'Time from launch to the milestone' }}, {{ value: '>1B', label: 'Weekly ChatGPT users' }}]))),
  repeated: error(() => compilePage(strip([{{ value: '~$2B', label: '2023 pace' }}, {{ value: '~$24B', label: 'March 2026 pace' }}, {{ value: '>$40B', label: 'August 2026 report' }}]))),
  added: error(() => compilePage(strip([{{ value: '12x', label: 'Growth, 2023 to March 2026' }}, {{ value: '+$16B', label: 'Added March to August' }}, {{ value: '2x', label: 'Over the 2025 pace' }}]))),
}}));
""")
        self.assertIn("one measure at two dates", result["dates"])
        self.assertNotIn("one measure at two dates", result["distinct"] or "")
        self.assertIn("the strip repeats", result["repeated"])
        self.assertNotIn("the strip repeats", result["added"] or "")

    def test_shares_of_one_measure_in_equal_tiles_are_advised(self):
        """Fifty-page review: shares of one measure set in same-size tiles."""
        # The chart prints other figures than the strip: a strip that repeats its
        # chart's labels is refused (test_one_measure_in_two_tiles_and_a_strip_repeating_its_chart_are_refused).
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const strip = (metrics) => compilePage({{ id: 'p1', type: 'numbers', form: 'metric-strip', commentary: 'none', ...base, title: 'Claude gained web share, but ChatGPT still drew six times its visits', metrics,
  exhibit: {{ type: 'chart.bar', heading: 'Web visit share, Aug 2026', unit: '%', categories: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], series: [{{ name: 's', values: [55, 10, 8, 7, 6, 5, 4, 3] }}] }} }}).pageType.advisories ?? [];
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

    def test_the_author_sets_it_on_a_typed_page_and_a_wrong_value_is_refused(self):
        """Rebuilt fifty-page deck: a rising cost was coloured as good news; the author sets which way is better."""
        result = run_node(f'''
import {{ compilePage, pageSchema }} from '{KIT}';
const page = (better) => ({{ id: 'n', type: 'numbers', form: 'metric-strip', commentary: 'none', why: 'The strip carries the change and the chart shows the path',
  settles: {{ kind: 'rate', what: 'Unit cost over eight years' }}, title: 'Unit cost fell by two fifths as volume doubled',
  metrics: [{{ value: '-40%', label: 'Unit cost since 2019', delta: '-40%', better }}, {{ value: '2.1x', label: 'Volume since 2019' }}],
  exhibit: {{ type: 'chart.line', categories: ['2019','2020','2021','2022','2023','2024','2025','2026'], series: [{{ name: 'Cost', values: [10, 9.4, 9, 8.1, 7.6, 7, 6.4, 6] }}],
    annotations: [{{ category: '2022', text: 'Second plant opens and the fixed cost is shared' }}] }} }});
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const schema = pageSchema('numbers');
console.log(JSON.stringify({{ down: compilePage(page('down')).metrics[0].better, wrong: error(() => compilePage(page('lower'))),
  schema: schema.properties.metrics.items.properties.better.enum, kpi: schema.properties.kpi.properties.better.enum }}));
''')
        self.assertEqual(result['down'], 'down')
        self.assertIn('`better` on metrics[0] is "lower"', result['wrong'])
        self.assertEqual(result['schema'], ['up', 'down'])
        self.assertEqual(result['kpi'], ['up', 'down'])


class MetricValueTests(unittest.TestCase):
    def test_a_metric_is_a_figure_not_a_word(self):
        """Hundred-page review: a strip of "Below plan", "Asia" and "Strikes", none of which the record held."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const chart = {{ type: 'chart.bar', heading: 'Web visit share, Aug 2026', unit: '%', categories: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], series: [{{ name: 's', values: [55, 10, 8, 7, 6, 5, 4, 3] }}] }};
const strip = (values) => ({{ ...base, id: 'n', type: 'numbers', form: 'metric-strip', commentary: 'none', title: 'Capacity stayed below plan as engines ran short',
  metrics: values.map((value, i) => ({{ value, label: ['Flying against plan', 'Region still below 2019', 'Earliest end of the squeeze'][i] }})), exhibit: chart }});
console.log(JSON.stringify({{
  words: error(() => compilePage(strip(['Below plan', '12%', '2030']))),
  counted: error(() => compilePage(strip(['Seven', '12%', '2030']))),
  figures: error(() => compilePage(strip(['-4%', '12%', '2030']))),
}}));
''')
        # METRIC_WORD_VALUE, a chart-form refusal: its code travels beside the message, as the others' do.
        self.assertIn('the metric "Below plan" ("Flying against plan") is a word where a figure belongs', result["words"])
        self.assertIn('the metric "Seven"', result["counted"], "a count is written in digits")
        self.assertIsNone(result["figures"], "a date and a percentage are figures")


class ProseRefusalTests(unittest.TestCase):
    def test_scenarios_as_paragraphs_are_refused_and_an_argument_is_not(self):
        """Fifty-page review: three scenarios written as paragraphs."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const words = (n, seed) => Array.from({{ length: n }}, (_, i) => ['buyers', 'retain', 'both', 'models', 'while', 'serving', 'costs', 'fall', 'faster', 'than', 'prices'][(i + seed) % 11]).join(' ') + '.';
const memo = (title, paragraphs) => ({{ id: 'p1', type: 'argument', form: 'sidebar', commentary: 'none', ...base, title, paragraphs, panel: {{ text: 'The base case is split leadership with a contested middle: models consolidate, applications fragment, and the clouds take the margin that neither of the other two keeps.' }} }});
const cards = {{ id: 'p2', type: 'parallel', form: 'cards', commentary: 'in-exhibit', ...base, title: 'Three market structures divide the value differently',
  exhibit: {{ items: [0, 1, 2].map((i) => ({{ title: 'Scenario ' + (i + 1), text: words(64, i) }})) }} }};
console.log(JSON.stringify({{
  scenarios: error(() => compilePage(memo('Three scenarios divide value across models, apps and clouds', [words(171, 0), words(62, 3), words(61, 5)]))),
  argument: error(() => compilePage(memo('The funding gap should be borrowed rather than cut', [0, 3, 5].map((seed) => ({{ lead: 'Costs fall faster than prices', text: words(58, seed) }}))))),
  short: error(() => compilePage(memo('Three scenarios divide value across models, apps and clouds', [40, 35, 30].map((n, i) => ({{ lead: 'Buyers retain both models', text: words(n, i * 3) }}))))),
  cards: error(() => compilePage(cards)),
}}));
''')
        self.assertIn("SCENARIO_PROSE", result["scenarios"])
        self.assertIn("171, 62, 61", result["scenarios"])
        self.assertIn("labelled-rows", result["scenarios"])
        self.assertIsNone(result["argument"])
        self.assertIsNone(result["short"])
        self.assertIn("SCENARIO_PROSE", result["cards"])

    def test_prose_is_signposted_by_leads_and_held_to_sixty_words_a_paragraph(self):
        """BA review: a sidebar and a memo of 65 to 95-word paragraphs with no
        heading or bold read as a wall of grey. Each paragraph of thirty words
        or more opens under a lead, none runs past sixty, and each is marked."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const words = (n, seed) => Array.from({{ length: n }}, (_, i) => ['buyers', 'retain', 'both', 'models', 'while', 'serving', 'costs', 'fall', 'faster', 'than', 'prices'][(i + seed) % 11]).join(' ') + '.';
const panel = {{ text: 'Borrow the gap in tranches against the milestones: fares repay it within the asset life even on the low case, and cutting to the grant gives up the journeys.' }};
const page = (paragraphs, extra = {{}}) => ({{ id: 'p1', type: 'argument', form: 'memo', commentary: 'none', ...base, title: 'The funding gap should be borrowed rather than cut', paragraphs, panel, ...extra }});
const led = (n, seed, extra = {{}}) => ({{ lead: 'Costs fall faster than prices', text: words(n, seed), ...extra }});
const ok = compilePage(page([
  led(50, 0),
  {{ lead: 'Revenue passes its old level', text: 'Fare revenue rose from £340m in FY20 to £512m in FY29 on the central case, the year the covenant is first tested, and repays the loan within the asset life.' }},
  led(40, 5, {{ highlight: 'serving costs' }}),
]));
console.log(JSON.stringify({{
  long: error(() => compilePage(page([words(80, 0), led(45, 3), words(66, 5)]))),
  bare: error(() => compilePage(page([words(45, 0), led(45, 3), words(31, 5)]))),
  wordy: error(() => compilePage(page([{{ lead: 'Costs fall faster than prices do in every one of the markets we studied', text: words(40, 0) }}, led(40, 3), led(40, 5)]))),
  lost: error(() => compilePage(page([led(40, 0), led(40, 3), led(40, 5, {{ highlight: 'margin squeeze' }})]))),
  short: error(() => compilePage(page([words(25, 0), led(45, 3), led(45, 5)]))),
  highlight: ok.highlight,
  paragraphs: ok.paragraphs,
}}));
''')
        self.assertIn("PROSE_PARAGRAPH_LONG", result["long"])
        self.assertIn("paragraphs 1 (80 words), 3 (66 words)", result["long"])
        self.assertIn("PROSE_UNSIGNPOSTED", result["bare"])
        self.assertIn("1 (45 words, no lead), 3 (31 words, no lead)", result["bare"])
        self.assertIn("a lead of 14 words", result["wordy"])
        self.assertIn('"margin squeeze" is not in its lead or its text', result["lost"])
        self.assertIsNone(result["short"], "a paragraph under thirty words may run without a lead")
        # The second paragraph is marked on the figure its range reaches, not the one it starts from.
        self.assertIn("£512m", result["highlight"])
        self.assertNotIn("£340m", result["highlight"])
        self.assertEqual(result["paragraphs"][1]["lead"], "Revenue passes its old level")

    def test_a_lead_is_drawn_as_a_bold_subheading_over_its_paragraph(self):
        """The lead sits on its own line above the prose, in bold, with the
        paragraph's figure in the accent - a column read by its leads first."""
        result = run_node(PRELUDE + """
const prose = [
  { lead: 'Revenue passes its old level', text: 'Fare revenue rose from £340m in FY20 to £512m in FY29 on the central case, the year the covenant is first tested, and repays the loan within the asset life.' },
  { lead: 'The real exposure is timing', text: 'A one-year slip in the power upgrade costs a year of payback and pushes fare revenue past the first covenant test, so the loan is drawn in tranches.' },
  { lead: "The loan is the board's instrument", text: 'Each tranche is released against a milestone, so a stalled lever cannot draw ahead of its evidence, and the board sees the cost of a slip in the month it happens.' },
];
const [slide] = compose([{ id: 'm1', type: 'argument', form: 'memo', commentary: 'none', ...base, title: 'The funding gap should be borrowed rather than cut', paragraphs: prose,
  panel: { kicker: 'The recommendation', text: 'Borrow the gap in tranches against the milestones: fares repay it within the asset life even on the low case, and cutting to the grant gives up the journeys.' } }]);
const leads = slide.nodes.filter((n) => n.role === 'paragraph-lead'), texts = slide.nodes.filter((n) => n.role === 'paragraph');
console.log(JSON.stringify({ leads: leads.map((n) => ({ text: n.text, bold: n.style.bold, y: n.frame.y, bottom: n.frame.y + n.frame.height })),
  texts: texts.map((n) => ({ y: n.frame.y, x: n.frame.x, lit: (n.runs || []).filter((r) => r.accent).map((r) => r.text.trim()) })), leadX: leads.map((n) => n.frame.x) }));
""")
        self.assertEqual([l["text"] for l in result["leads"]], ["Revenue passes its old level", "The real exposure is timing", "The loan is the board's instrument"])
        self.assertTrue(all(l["bold"] for l in result["leads"]))
        for lead, text in zip(result["leads"], result["texts"]):
            self.assertLessEqual(lead["bottom"], text["y"], "the lead sits above its paragraph")
            self.assertLess(text["y"] - lead["bottom"], 12, "and close over it, not floating")
        self.assertEqual(result["leadX"], [t["x"] for t in result["texts"]])
        # The figure the range reaches is lit in the first paragraph.
        self.assertIn("£512m", result["texts"][0]["lit"])

    def test_a_panel_beside_prose_alone_holds_more_than_a_sentence(self):
        """Fifty-page review: a twenty-word statement set a 700px column of tint that was mostly empty."""
        # A memo's panel takes the width the prose leaves - over half the page,
        # since prose that reaches the foot does so at a reading measure - and
        # a twenty-word statement set a 700px column of tint that was mostly
        # empty. It is refused at compile, its repair naming what to put there
        # rather than how many words to add; beside an exhibit or points the
        # panel keeps a third of the row and a sentence fills it.
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const prose = ['Today the two labs lead different things, and neither signal yet ranks overall task economics for a buyer.', 'A lasting lead needs retained paid tasks at positive contribution and cash coverage of compute obligations.'];
const short = 'One lab leads overall only when it clears the task and cash tests and leads both direct and enterprise demand.';
const kept = 'One lab leads overall only when it clears the task and cash tests - paid tasks retained at positive contribution, and cash covering compute obligations - and leads both direct and enterprise demand.';
const page = (form, panel, extra = {{}}) => ({{ id: 'p1', type: 'argument', form, commentary: 'none', ...base, title: 'Retained paid tasks and margin, not current leads, decide the long run', paragraphs: prose, panel: {{ kicker: 'The reversal test', text: panel }}, ...extra }});
console.log(JSON.stringify({{
  memo: error(() => compilePage(page('memo', short))),
  sidebar: error(() => compilePage(page('sidebar', short))),
  kept: error(() => compilePage(page('memo', kept))),
  beside: error(() => compilePage(page('sidebar', short, {{ points: ['OpenAI leads direct reach with a billion weekly users', 'Anthropic leads the Ramp paid panel, 43.8% to 39.8%'] }}))),
}}));
''')
        self.assertIn("20 words set a column of tint that is mostly empty", result["memo"])
        self.assertIn("the figures, the conditions, the decision and its cost", result["memo"])
        self.assertIn("mostly empty", result["sidebar"])
        self.assertIsNone(result["kept"])
        self.assertNotIn("mostly empty", result["beside"] or "")


class HighlightRefusalTests(unittest.TestCase):
    def test_a_phrase_the_page_draws_nowhere_is_refused_with_where_it_is(self):
        """Fifty-six-page re-author: a highlight the page drew nowhere compiled silently."""
        result = run_node(PRELUDE + """
const page = (highlight) => ({ ...base, id: 'p', type: 'trend', form: 'column', commentary: 'on-exhibit', title: 'Passengers recovered past their 2019 level by 2023',
  highlight, exhibit: { heading: 'Passengers', unit: 'million', categories: years, series: [{ name: 'Passengers', values: [89, 86, 26, 29, 66, 87, 92, 95] }],
    annotations: [{ category: '2020', text: 'Closure year: traffic fell by seventy percent' }, { category: '2025', text: 'A record year on the new schedule' }] } });
console.log(JSON.stringify({ title: error(() => compilePage(page('2019 level'))), callout: error(() => compilePage(page('record year'))), nowhere: error(() => compilePage(page('never written here'))) }));
""")
        self.assertIn("title", result["title"])
        self.assertIn("callout", result["callout"])
        self.assertIn("nowhere", result["nowhere"], "a page with no commentary text refuses any highlight")


class RefusalCatalogueTests(unittest.TestCase):
    """`--types` publishes exactly the refusals the compiler raises, and the deck's vocabulary registers them."""

    def test_every_published_refusal_is_one_a_page_raises(self):
        """Fifty-page review: new compile refusals have to reach the catalogue and the deck's vocabulary."""
        # One failing page per refusal, compiled: the code is read off the
        # message the author would see, not off the compiler's source. A rule
        # added to the catalogue fails here until a page here raises it.
        result = run_node(f'''
import {{ compilePage, describeTypes }} from '{KIT}';
import {{ VARIETY_CODES }} from './skills/professional-slides/runtime/gates/variety_gates.mjs';
import {{ AUTHORING_CODES }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ wordBudgetOf }} from './skills/professional-slides/runtime/derive-content.mjs';
{PAGE}
const said = (fn) => {{ try {{ const page = fn(); return (page.pageType?.advisories ?? []).join(' | '); }} catch (e) {{ return e.message; }} }};
const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const table = (heading, rows) => ({{ type: 'table', heading, columns: ['Measure', 'Value', 'Date'], rows }});
const three = [['Revenue run rate', '>$2.5B', 'Feb 2026'], ['Enterprise share', 'More than half', 'Feb 2026'], ['Weekly users', 'n/a', 'Feb 2026']];
const lookup = (columns, rows, extra = {{}}) => ({{ ...base, id: 'l', type: 'lookup', form: 'table', commentary: 'none', title: 'The two firms split the criteria between them', exhibit: {{ columns, rows }}, ...extra }});
const panels = (form, exhibits) => ({{ ...base, id: 'k', type: 'panels', form, commentary: 'none', title: 'The two firms grew on different terms', exhibits }});
const bars = (heading, unit) => ({{ type: 'chart.column', heading, unit, categories: ['2021', '2022', '2023', '2024', '2025'], series: [{{ name: 'x', values: [1, 2, 3, 4, 5] }}] }});
const terms = {{ type: 'table', heading: 'Terms', columns: ['Term', 'Northwind', 'Southgate'], rows: [['Lead investor', 'A', 'B'], ['Board seat', 'Yes', 'No'], ['Close', 'March', 'May']] }};
const column = (categories) => ({{ ...base, id: 'c', type: 'trend', form: 'column', commentary: 'on-exhibit', title: 'Revenue rose sixfold in five years',
  exhibit: {{ heading: 'Revenue, $B', categories, series: [{{ name: 'Rev', values: categories.map((_, i) => i + 1) }}, {{ name: 'Cost', values: categories.map((_, i) => i) }}],
    annotations: [{{ category: categories[1], text: 'The launch year doubled revenue as the new product reached every region' }}] }} }});
const line = (extra = {{}}) => ({{ ...base, id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', title: 'Revenue rose in every year of the run',
  exhibit: {{ heading: 'Revenue, $B', categories: years, series: [{{ name: 'A', values: [1, 2, 3, 4, 5, 6, 7, 8] }}],
    annotations: [{{ category: '2022', text: 'The launch year doubled revenue as the new product reached every region' }}] }}, ...extra }});
const words = (n, seed) => Array.from({{ length: n }}, (_, i) => ['buyers', 'retain', 'both', 'models', 'while', 'serving', 'costs', 'fall', 'faster', 'than', 'prices'][(i + seed) % 11]).join(' ') + '.';
const strip = {{ ...base, id: 'n', type: 'numbers', form: 'metric-strip', commentary: 'none', title: 'Claude gained web share, but ChatGPT still drew six times its visits',
  metrics: [{{ value: '9.6%', label: 'Claude web visit share, Aug 2026' }}, {{ value: '57%', label: 'ChatGPT web visit share, Aug 2026' }}],
  exhibit: {{ type: 'chart.bar', heading: 'Web visit share, Aug 2026', unit: '%', categories: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], series: [{{ name: 's', values: [55, 10, 8, 7, 6, 5, 4, 3] }}] }} }};
const map = {{ id: 'm', type: 'place', form: 'map', commentary: 'beside', points: ['A point.'], takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'Where the network runs is the claim',
  settles: {{ kind: 'structure', what: 'The operator route map' }}, title: 'The network is three cities', exhibit: {{ geography: 'europe', crop: 'fit',
    markers: [{{ label: 'Leeds', longitude: -1.55, latitude: 53.8 }}, {{ label: 'York', longitude: -1.08, latitude: 53.96 }}, {{ label: 'Hull', longitude: -0.34, latitude: 53.74 }}] }} }};
const raised = {{
  TABLE_TOO_SHORT: said(() => compilePage({{ ...lookup(['Measure', 'Value', 'Date'], three.slice(0, 2)), exhibit: table('First product', three.slice(0, 2)) }})),
  TABLE_PANELS_MERGE: said(() => compilePage(panels('stack', [table('First product', three), table('Second product', three)]))),
  TABLE_STACK: said(() => compilePage(panels('stack', [table('Northwind March round', three), terms]))),
  COMPARISON_MEASURES_DIFFER: said(() => compilePage(panels('row', [bars('Northwind revenue', '$bn'), bars('Southgate weekly users', 'm users')]), 0, {{ players: [{{ name: 'Northwind' }}, {{ name: 'Southgate Labs', short: 'Southgate' }}] }})),
  TOTAL_ROW_BLANK: said(() => compilePage(lookup([{{ label: 'Instrument', type: 'category' }}, 'OpenAI', 'Anthropic'], [...three.map(([a, b]) => [a, b, b]), ['Total', '', ' ']]))),
  TIME_AXIS_UNEVEN: said(() => compilePage(column(['2015', '2018', '2019', '2020', '2021']))),
  VERDICT_TABLE_PLAIN: said(() => compilePage(lookup([{{ label: 'Criterion', type: 'category' }}, 'Current edge', 'Reason'], [['Consumer reach', 'OpenAI', 'Weekly users'], ['Enterprise adoption', 'Anthropic', 'Ramp panel'], ['Coding', 'No verdict', 'Units differ']]))),
  SCENARIO_PROSE: said(() => compilePage({{ ...base, id: 'a', type: 'argument', form: 'sidebar', commentary: 'none', title: 'Three scenarios divide value across models, apps and clouds',
    paragraphs: [words(171, 0), words(62, 3), words(61, 5)], panel: {{ text: 'The base case is split leadership with a contested middle: models consolidate, applications fragment, and the clouds take the margin that neither of the other two keeps.' }} }})),
  PROSE_PARAGRAPH_LONG: said(() => compilePage({{ ...base, id: 'w', type: 'argument', form: 'sidebar', commentary: 'none', title: 'The funding gap should be borrowed rather than cut',
    paragraphs: [{{ lead: 'Costs fall faster than prices', text: words(75, 0) }}, words(20, 3)], panel: {{ text: 'Borrow the gap in tranches against the milestones: fares repay it within the asset life even on the low case, and cutting to the grant gives up the journeys.' }} }})),
  PROSE_UNSIGNPOSTED: said(() => compilePage({{ ...base, id: 'u', type: 'argument', form: 'sidebar', commentary: 'none', title: 'The funding gap should be borrowed rather than cut',
    paragraphs: [words(45, 0), words(40, 3)], panel: {{ text: 'Borrow the gap in tranches against the milestones: fares repay it within the asset life even on the low case, and cutting to the grant gives up the journeys.' }} }})),
  SHARES_IN_TILES: said(() => compilePage(strip)),
  MAP_COARSE: said(() => compilePage(map)),
  TITLE_WORDS: said(() => compilePage(line({{ title: 'Revenue rose in every single year of the long eight year run from twenty nineteen to twenty twenty six across all of the regions we serve' }}))),
  TAKEAWAY_LONG: said(() => compilePage(line({{ takeaway: Array.from({{ length: 90 }}, () => 'growth').join(' ') + '.' }}))),
}};
console.log(JSON.stringify({{ raised, types: describeTypes(), codes: [...Object.keys(VARIETY_CODES), ...Object.keys(AUTHORING_CODES)],
  summary: wordBudgetOf('text-page', {{ role: 'executive-summary' }}).ceiling }}));
''')
        for code, message in result["raised"].items():
            with self.subTest(code=code):
                self.assertIn(code, message or "", "the battery page no longer raises its refusal")
                self.assertIn(code, result["types"], "the catalogue does not publish a refusal the compiler raises")
        # The catalogue's rules, as `--types` prints them: "(CODE - repair)".
        # (A page-gate code the catalogue cites, HEADING_WRAPS, is the build's to raise.)
        published = set(re.findall(r"\(([A-Z][A-Z_]+) - ", result["types"])) - set(page_gates.GATE_CODES)
        self.assertTrue(published)
        self.assertEqual(published - set(result["raised"]), set(), "a published rule no page here raises")
        # Every compile refusal is in the deck's vocabulary but the title's and
        # the takeaway's, page-gate codes checked early.
        self.assertEqual(set(result["raised"]) - set(result["codes"]), {"TITLE_WORDS", "TAKEAWAY_LONG"})
        self.assertIn("leads, leader, winner, wins", result["types"])  # every verdict word the check reads
        self.assertIn(f"({result['summary']} body words)", result["types"])  # the summary ceiling the budget sets


if __name__ == "__main__":
    unittest.main()


class CatalogueCompletenessTests(unittest.TestCase):
    """The catalogue and the docs against the source, not against a chosen battery of pages."""

    def test_the_catalogue_publishes_every_refusal_the_compiler_raises(self):
        # Scraped from the source, so a refusal added to the compiler and left
        # out of the catalogue is caught without anyone writing a page for it.
        source = (RUNTIME / "page-types.mjs").read_text(encoding="utf-8")
        raised = set(re.findall(r"\$\{id\}: ([A-Z][A-Z_]+) - ", source)) | set(re.findall(r"`([A-Z][A-Z_]+): ", source))
        result = run_node(f'''
import {{ describeTypes }} from '{KIT}';
import {{ VARIETY_CODES }} from './skills/professional-slides/runtime/gates/variety_gates.mjs';
import {{ AUTHORING_CODES }} from './skills/professional-slides/runtime/author-deck.mjs';
console.log(JSON.stringify({{ types: describeTypes(), codes: [...Object.keys(VARIETY_CODES), ...Object.keys(AUTHORING_CODES)] }}));
''')
        self.assertTrue({"TOTAL_ROW_BLANK", "TABLE_PANELS_MERGE", "SHARES_IN_TILES", "MAP_COARSE", "POINT_UNMARKED", "TITLE_COUNT_ONLY"} <= raised)  # the patterns read the source
        for code in sorted(raised):
            self.assertIn(code, result["types"])
        # Every compile refusal is in the deck's vocabulary but the title's and the takeaway's, page-gate codes checked early.
        self.assertEqual(raised - set(result["codes"]), {"TITLE_WORDS", "TAKEAWAY_LONG"})

