"""What a typed page refuses at compile, and what it adjusts (runtime/page-types.mjs compilePage).

A page is refused only where it cannot be drawn as written: a total row with
nothing in it, a polarity that names no direction. What the compiler can set
right itself - a highlight that lands nowhere - it sets aside, and the page's
advisories say so (PAGE_ADJUSTED).
"""
import unittest

from node_probe import run_node

KIT = "./skills/professional-slides/runtime/page-types.mjs"

PAGE = """
const base = { takeaway: false };
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
const base = { takeaway: false };
const compose = (pages) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: pages.map((p, i) => compilePage(p, i)) }, '.').deck.slides;
const error = (fn) => { try { fn(); return null; } catch (e) { return (e.pageErrors ?? [e.message]).join(' | '); } };
const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
"""


class TotalRowTests(unittest.TestCase):
    def test_a_total_row_left_blank_is_refused_and_a_measure_table_totals_only_what_sums(self):
        """Fifty-page review: four total rows were blank; a measure table totals only the columns that sum."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ styleTable }} from './evals/support/compose.mjs';
{PAGE}
const table = (rows) => ({{ id: 'p1', type: 'lookup', form: 'table', commentary: 'none', ...base, title: 'The two firms raised capital on different terms',
  exhibit: {{ columns: [{{ label: 'Instrument', type: 'category' }}, 'OpenAI', 'Anthropic'], rows }} }});
const body = [['Equity round', '$122B committed', '$65B Series H'], ['Credit line', '$4.7B undrawn', '$15B reported'], ['Compute deals', '$300B announced', '$50B announced']];
const text = {{ columns: ['Control', 'OpenAI', 'Anthropic'], rows: [['Residency', 'US only', 'Varies'], ['Retention', 'Not eligible', 'Eligible'], ['Audit logs', 'Enterprise tier', 'All tiers']] }};
const counts = {{ columns: ['Route', 'Flights', 'Seats'], rows: [['A', '12', '2400'], ['B', '8', '1600'], ['C', '6', '1200']] }};
const rows = (ex) => ex.rows.map((row) => (Array.isArray(row) ? row : row.cells).map((c) => String(c?.text ?? c)));
console.log(JSON.stringify({{
  styled: error(() => compilePage(table([...body, {{ style: 'total', cells: ['All', '-', '-'] }}]))),
  labelled: error(() => compilePage(table([...body, ['Total', '', ' ']]))),
  filled: error(() => compilePage(table([...body, {{ style: 'total', cells: ['Total', '$126.7B', '$80B'] }}]))),
  autoText: rows(styleTable({{ ...text, total: 'auto' }})).length,
  autoCounts: rows(styleTable({{ ...counts, total: 'auto' }})).at(-1),
  forced: error(() => styleTable({{ ...text, total: true }})),
}}));
''')
        self.assertIn("TOTAL_ROW_BLANK", result["styled"])
        self.assertIn("give it its total", result["styled"])
        # A row is a total where it is styled as one; a blank row labelled "Total" is the writer's, as a group heading is.
        self.assertIsNone(result["labelled"])
        self.assertIsNone(result["filled"])
        # The measure-table preset's total is added only where a column sums.
        self.assertEqual(result["autoText"], 3)
        self.assertEqual(result["autoCounts"], ["Total", "26", "5,200"])
        self.assertIn("TOTAL_ROW_BLANK", result["forced"])

    def test_cells_drawn_as_logos_are_read_as_their_players(self):
        """Fifty-page review: cells drawn as logos were read as blank, and a highlight on a player was looked for in its name."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const players = [{{ name: 'Northwind' }}, {{ name: 'Southgate Labs', short: 'Southgate' }}];
const lookup = (rows, extra = {{}}) => ({{ ...base, id: 'l', type: 'lookup', form: 'table', commentary: 'none', title: 'The two firms split the criteria between them',
  exhibit: {{ columns: [{{ label: 'Measure', type: 'category' }}, 'First', 'Second'], rows }}, ...extra }});
const body = [['Consumer reach', 'Northwind', 'Southgate'], ['Enterprise seats', 'Southgate', 'Northwind'], ['Developer use', 'Northwind', 'Southgate']];
const roster = (n) => ({{ ...base, id: 'r', type: 'profiles', form: 'logo-table', commentary: 'in-exhibit', title: 'Two carriers set the terms of the market',
  exhibit: {{ columns: [{{ label: '', type: 'logo' }}, 'Carrier', 'Fleet'], rows: [[{{ media: {{ alt: 'Northwind logo' }} }}, 'Northwind', '260'], [{{ media: {{ alt: 'Southgate logo' }} }}, 'Southgate', '140']].slice(0, n) }} }});
console.log(JSON.stringify({{
  logoTotal: error(() => compilePage(lookup([...body, {{ style: 'total', cells: ['Overall', 'Northwind', 'Southgate'] }}]), 0, {{ players }})),
  blankTotal: error(() => compilePage(lookup([...body, {{ style: 'total', cells: ['Overall', '', '-'] }}]), 0, {{ players }})),
  logoHighlight: compilePage(lookup(body, {{ title: 'Southgate leads on seats while Northwind leads on reach', highlight: 'Southgate' }}), 0, {{ players }}).pageType.advisories ?? [],
  textCell: error(() => compilePage(lookup([[body[0][0], body[0][1], {{ text: 'Southgate', highlight: true }}], ...body.slice(1)], {{ highlight: 'Southgate' }}), 0, {{ players }})),
  rosterOne: error(() => compilePage(roster(1))),
}}));
''')
        self.assertIsNone(result["logoTotal"])  # a total row of player marks is not blank
        self.assertIn("TOTAL_ROW_BLANK", result["blankTotal"])
        # A highlight on a name the table draws as a logo lands nowhere: it is set aside, and the page says so.
        self.assertTrue(any('highlight "Southgate" set aside' in note for note in result["logoHighlight"]), result["logoHighlight"])
        self.assertIsNone(result["textCell"])  # a cell with its own highlight stays text, and takes the accent
        self.assertIsNone(result["rosterOne"])  # one row is the writer's choice


class ChartTests(unittest.TestCase):
    def test_columns_over_uneven_dates_compile_however_the_axis_is_broken(self):
        """Fifty-page review: uneven years drawn as evenly spaced columns. The runtime spaces them by time, or breaks
        the axis after every long gap (test_axis_breaks.py), so no page is refused for it."""
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
{PAGE}
const trend = (categories) => ({{ id: 'p1', type: 'trend', form: 'column', commentary: 'on-exhibit', ...base, title: 'Revenue rose sixfold in five years',
  exhibit: {{ heading: 'Revenue, $B', categories, series: [{{ name: 'Rev', values: categories.map((_, i) => i + 1) }}, {{ name: 'Cost', values: categories.map((_, i) => i) }}],
    annotations: [{{ category: categories[1], text: 'The launch year doubled revenue as the new product reached every region' }}] }} }});
const broken = (page, at) => ({{ ...page, exhibit: {{ ...page.exhibit, categoryBreaks: at }} }});
console.log(JSON.stringify({{
  spaced: error(() => compilePage(trend(['2015', '2018', '2019', '2020', '2021']))),
  partial: error(() => compilePage(broken(trend(['2015', '2018', '2019', '2020', '2022']), ['2015']))),
}}));
''')
        self.assertEqual(result, {"spaced": None, "partial": None})

    def test_the_author_sets_which_way_is_better_and_a_wrong_value_is_refused(self):
        """Rebuilt fifty-page deck: a rising cost was coloured as good news; the author sets which way is better."""
        result = run_node(f'''
import {{ compilePage, pageSchema }} from '{KIT}';
const page = (better) => ({{ id: 'n', type: 'numbers', form: 'metric-strip', commentary: 'none', title: 'Unit cost fell by two fifths as volume doubled',
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


class ProseTests(unittest.TestCase):
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
        # The first paragraph is lit on its own figure.
        self.assertIn("£340m", result["texts"][0]["lit"])


class HighlightTests(unittest.TestCase):
    def test_a_phrase_the_page_draws_nowhere_is_set_aside_and_said(self):
        """Fifty-six-page re-author: a highlight the page drew nowhere compiled silently. Now it is set aside, and said."""
        result = run_node(PRELUDE + """
const page = (highlight) => ({ ...base, id: 'p', type: 'trend', form: 'column', commentary: 'on-exhibit', title: 'Passengers recovered past their 2019 level by 2023',
  highlight, exhibit: { heading: 'Passengers', unit: 'million', categories: years, series: [{ name: 'Passengers', values: [89, 86, 26, 29, 66, 87, 92, 95] }],
    annotations: [{ category: '2020', text: 'Closure year: traffic fell by seventy percent' }, { category: '2025', text: 'A record year on the new schedule' }] } });
const said = (highlight) => { const slide = compilePage(page(highlight)); return { highlight: slide.highlight ?? null, advisories: slide.pageType.advisories ?? [] }; };
console.log(JSON.stringify({ title: said('2019 level'), nowhere: said('never written here') }));
""")
        for case in ("title", "nowhere"):
            with self.subTest(case=case):
                self.assertIsNone(result[case]["highlight"])
                self.assertTrue(any("set aside" in note and "nowhere an accent is drawn" in note for note in result[case]["advisories"]), result[case]["advisories"])



class ExhibitOrderTests(unittest.TestCase):
    def test_a_trend_over_members_rather_than_periods_is_refused(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const page = (categories) => ({ id: 'p', type: 'trend', form: 'column', title: 'Online is a fifth of sales', commentary: 'on-exhibit', source: 'Source: test',
  exhibit: { heading: 'Online share', unit: '%', categories, series: [{ name: 'Share', values: categories.map((_, i) => 10 + i * 5) }] } });
let refused = null;
try { compilePage(page(['Region A, 2025', 'All regions, 2024', 'Region B to Region C, 2024'])); } catch (e) { refused = e.message; }
compilePage(page(['End 2021', 'End 2022', 'End 2023']));
console.log(JSON.stringify({ refused }));
''')
        self.assertTrue(result["refused"].startswith("TREND_NOT_TIME"))

    def test_a_ranking_is_set_largest_first_unless_its_order_is_given(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const page = (more = {}) => ({ id: 'p', type: 'ranking', form: 'bar', title: 'Alpha carries the most', commentary: 'on-exhibit', source: 'Source: test',
  exhibit: { heading: 'Share of routes', unit: '%', categories: ['Bravo', 'Charlie', 'Alpha', 'Delta'], series: [{ name: 'Share', values: [21.5, 7.4, 23.4, 1.9] }],
    categoryNotes: ['b', 'c', 'a', 'd'], ...more } });
const ex = (slide) => slide.exhibit ?? slide.exhibits?.[0];
const sorted = ex(compilePage(page())), given = ex(compilePage(page({ order: 'given' })));
console.log(JSON.stringify({ sorted: sorted.categories, notes: sorted.categoryNotes, given: given.categories }));
''')
        self.assertEqual(result["sorted"], ["Alpha", "Bravo", "Charlie", "Delta"])
        self.assertEqual(result["notes"], ["a", "b", "c", "d"])
        self.assertEqual(result["given"], ["Bravo", "Charlie", "Alpha", "Delta"])

    def test_a_heading_that_repeats_its_unit_is_refused_and_a_measure_named_by_its_unit_is_not(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const page = (heading, unit) => ({ id: 'p', type: 'ranking', form: 'bar', title: 'Model A costs a fifth less', commentary: 'on-exhibit', source: 'Source: test',
  exhibit: { heading, unit, categories: ['Model A', 'Model B', 'Model C'], series: [{ name: 'Cost', values: [80, 93, 100] }] } });
let refused = null;
try { compilePage(page('Cost of the same job, Model C = 100', 'index (Model C = 100)')); } catch (e) { refused = e.message; }
compilePage(page('Peak trains per hour on the main line', 'trains'));
console.log(JSON.stringify({ refused }));
''')
        self.assertTrue(result["refused"].startswith("HEADING_REPEATS_UNIT"))


if __name__ == "__main__":
    unittest.main()
