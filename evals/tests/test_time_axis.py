"""Periods on a time axis (runtime/time-axis.mjs): read once, spaced by time, labelled as months.

One recogniser reads a category as a period for the compiler, the chart and the
craft floor alike; uneven dates are spaced by the time between them; ISO
months print as months and tick by the quarter.
"""
import unittest

from node_probe import run_node

RUNTIME = "./skills/professional-slides/runtime"

KIT = "./skills/professional-slides/runtime/page-types.mjs"

TIME = "./skills/professional-slides/runtime/time-axis.mjs"

PAGE = """
const S = { kind: 'comparison', what: 'Company filings and press reports, 2025 to 2026' };
const base = { takeaway: false, why: 'The page compares the two firms on the same terms', settles: S, adds: 'The commentary names what the exhibit cannot: the terms behind each figure' };
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""


class PeriodTests(unittest.TestCase):
    def test_period_labels_parse_only_where_unambiguous(self):
        """Fifty-page review: an irregular monthly series was drawn at equal spacing; periods are parsed only where they are unambiguous."""
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

    def test_one_period_recogniser_reads_a_trend_axis(self):
        """Fifty-page review: the compiler took "H3 2024" for a period while the craft floor kept its own copy of the pattern."""
        # The compiler took "H3 2024" for a period; the craft floor kept its own copy of the pattern.
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ isPeriodLabel }} from '{TIME}';
import {{ trendChart }} from './skills/professional-slides/runtime/gates/craft_gates.mjs';
{PAGE}
const trend = (categories) => ({{ id: 'p1', type: 'trend', form: 'column', commentary: 'on-exhibit', ...base, title: 'Revenue rose in every period of the run',
  exhibit: {{ heading: 'Revenue, $B', categories, series: [{{ name: 'Rev', values: categories.map((_, i) => i + 1) }}, {{ name: 'Cost', values: categories.map((_, i) => i) }}],
    annotations: [{{ category: categories[1], text: 'The launch doubled revenue as the new product reached every region' }}] }} }});
const halves = ['H1 2024', 'H2 2024', 'H3 2024', 'H4 2024'];
console.log(JSON.stringify({{
  periods: ['2025', 'FY25', 'FY25 LTM', '2024 YTD', '2020-24', 'FY20-FY24', 'FY2024-25', 'Q1', '2H', 'Q1-Q3 2025', 'Jan-Mar', 'September', 'FY26 (est.)'].filter((c) => !isPeriodLabel(c)),
  members: ['H3 2024', 'H4', 'Q5', 'Northern', 'Mayor', '10-12', 'Plan', 'Leeds to York'].filter(isPeriodLabel),
  halves: error(() => compilePage(trend(halves))), quarters: error(() => compilePage(trend(['Q1', 'Q2', 'Q3', 'Q4']))),
  qualified: error(() => compilePage(trend(['FY22', 'FY23', 'FY24', 'FY25 LTM']))),
  craft: [trendChart({{ type: 'chart.line', categories: halves }}), trendChart({{ type: 'chart.line', categories: ['2020-21', '2021-22', '2022-23', '2023-24'] }})],
}}));
''')
        self.assertEqual(result["periods"], [])
        self.assertEqual(result["members"], [])
        self.assertIn("four or more periods", result["halves"])
        self.assertIsNone(result["quarters"])
        self.assertIsNone(result["qualified"])
        self.assertEqual(result["craft"], [False, True])

    def test_iso_months_read_as_months_and_tick_by_the_quarter(self):
        """Fifty-page audit: ISO month ticks ("2025-08") on a monthly line."""
        result = run_node(f"""
import {{ readablePeriod, monthlyLabelStep }} from '{RUNTIME}/time-axis.mjs';
import {{ compilePage }} from '{KIT}';
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
{PAGE}
const months = Array.from({{ length: 13 }}, (_, i) => {{ const t = 2025 * 12 + 7 + i; return `${{Math.floor(t / 12)}}-${{String(t % 12 + 1).padStart(2, '0')}}`; }});
const page = compilePage({{ ...base, id: 'p1', type: 'trend', form: 'line', commentary: 'on-exhibit', title: 'Anthropic passed OpenAI in purchase incidence by May',
  exhibit: {{ heading: 'Share of firms, %', categories: months, series: [{{ name: 'A', values: months.map((_, i) => 16 + i * 2) }}, {{ name: 'B', values: months.map(() => 40) }}],
    annotations: [{{ category: '2026-05', text: 'The first month the challenger led the incumbent in the panel' }}] }} }});
const nodes = REGISTRY.get('chart.line').render({{ id: 'c', frame: {{ x: 0, y: 0, width: 800, height: 400 }}, props: {{ highlights: [], referenceLines: [], ...page.exhibit }} }}).nodes;
console.log(JSON.stringify({{ one: readablePeriod('2025-08'), step: monthlyLabelStep(months), first: page.exhibit.categories[0], callout: page.exhibit.annotations[0].category,
  ticks: nodes.filter((n) => n.role === 'category-label').map((n) => n.text) }}));
""")
        self.assertEqual(result["one"], "Aug 25")
        self.assertEqual(result["step"], 3)
        self.assertEqual(result["first"], "Aug 25")
        self.assertEqual(result["callout"], "May 26")
        self.assertEqual(result["ticks"], ["Aug 25", "Nov 25", "Feb 26", "May 26", "Aug 26"])


class TimeSpacingTests(unittest.TestCase):
    def test_a_line_spaces_uneven_dates_by_time_and_stays_drawn(self):
        """Fifty-page review: an irregular monthly series was drawn at equal spacing, steepening the growth."""
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


if __name__ == "__main__":
    unittest.main()
