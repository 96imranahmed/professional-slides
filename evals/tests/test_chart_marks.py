"""Marks set against groups of bars and single labels (runtime/chart-marks.mjs, chart-decorations.mjs).

A bracket sums a run of categories or gives its share of the whole, computed
from the plotted values; an average marker sets a value on the axis with no
line through the marks; a label said as a range or an approximation marks its
bar as an estimate; a ring circles the label a page turns on; a bar chart's
rows are grouped under a bracketed label; and growth columns run for several
periods side by side.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { nativeChartSpec } from './skills/professional-slides/runtime/core.mjs';
const frame = { x: 40, y: 60, width: 760, height: 420 };
const render = (kind, props) => REGISTRY.get(kind).render({ id: 'c', frame, props }).nodes;
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const stations = { categories: ['Central', 'Harbour', 'Airport', 'Northgate', 'Riverside', 'Old Town', 'Parkway', 'Westfield', 'Market'],
  series: [{ name: 'Journeys', values: [9.8, 7.4, 5.6, 4.1, 3.6, 3.2, 2.9, 2.4, 1.9] }] };
const capex = { categories: ['FY24', 'FY25', 'FY26', 'FY27', 'FY28', 'FY29', 'FY30', 'FY31'], series: [{ name: 'Capex', values: [42, 45, 48, 96, 140, 135, 60, 52] }] };
"""


class GroupBracketTests(unittest.TestCase):
    def test_a_bar_chart_brackets_its_rows_with_their_share_past_every_value(self):
        run_node(PRELUDE + """
const nodes = render('chart.bar', { ...stations, groupBrackets: [{ categories: ['Central', 'Harbour', 'Airport'], value: 'share', label: 'of all journeys' }] });
const label = nodes.find((n) => n.role === 'chart-bracket-label');
// 9.8 + 7.4 + 5.6 = 22.8 of 40.9: the figure is computed from the bars, not typed.
assert.equal(label.text, '56% of all journeys');
const spine = nodes.find((n) => n.role === 'chart-bracket' && n.id.endsWith('spine'));
const values = nodes.filter((n) => n.role === 'data-label');
assert.ok(values.every((v) => v.frame.x + v.frame.width <= spine.data.x1), 'the bracket stands right of every value label');
const rows = ['Central', 'Airport'].map((c) => nodes.find((n) => n.role === 'chart-mark' && n.data.category === c).frame);
assert.ok(spine.data.y1 <= rows[0].y + 2 && spine.data.y2 >= rows[1].y + rows[1].height - 2, 'and spans its rows');
assert.equal(nativeChartSpec('chart.bar', { ...stations, groupBrackets: [{ categories: ['Central', 'Harbour'] }] }, frame, nodes), null);
console.log('{}');
""")

    def test_a_column_chart_brackets_its_run_over_its_tallest_label(self):
        run_node(PRELUDE + """
const nodes = render('chart.column', { ...capex, groupBrackets: [{ categories: ['FY27', 'FY28', 'FY29'], label: 'electrification' }] });
const label = nodes.find((n) => n.role === 'chart-bracket-label');
assert.equal(label.text, '371 electrification');
for (const value of nodes.filter((n) => n.role === 'data-label')) assert.ok(!overlaps(label.frame, value.frame), `the bracket's text clears ${value.text}`);
const spine = nodes.find((n) => n.role === 'chart-bracket' && n.id.endsWith('spine'));
const tallest = nodes.find((n) => n.role === 'data-label' && n.text === '140').frame;
assert.ok(spine.data.y1 < tallest.y, 'over the tallest label in its run');
console.log('{}');
""")

    def test_brackets_that_are_not_a_run_or_say_nothing_are_refused(self):
        found = run_node(PRELUDE + """
console.log(JSON.stringify({
  gap: error(() => render('chart.bar', { ...stations, groupBrackets: [{ categories: ['Central', 'Airport'] }] })),
  overlap: error(() => render('chart.bar', { ...stations, groupBrackets: [{ categories: ['Central', 'Harbour'] }, { categories: ['Harbour', 'Airport'] }] })),
  all: error(() => render('chart.bar', { ...stations, groupBrackets: [{ categories: stations.categories }] })),
  silent: error(() => render('chart.bar', { ...stations, groupBrackets: [{ categories: ['Central', 'Harbour'], value: 'none' }] })),
  line: error(() => render('chart.line', { ...capex, groupBrackets: [{ categories: ['FY27', 'FY28'] }] })),
}));
""")
        self.assertIn("sit together on the axis", found["gap"])
        self.assertIn("overlaps another bracket", found["overlap"])
        self.assertIn("every category", found["all"])
        self.assertIn("prints nothing", found["silent"])
        self.assertIn("does not draw group brackets", found["line"])


class MarkerTests(unittest.TestCase):
    def test_an_average_is_a_triangle_under_the_bars_with_no_line_across_them(self):
        run_node(PRELUDE + """
const nodes = render('chart.bar', { ...stations, referenceLines: [{ value: 4.54, style: 'marker' }] });
assert.equal(nodes.filter((n) => n.role === 'chart-reference-line').length, 0, 'no line through the bars');
const glyph = nodes.find((n) => n.role === 'chart-reference-marker'), label = nodes.find((n) => n.role === 'chart-reference-label');
assert.equal(label.text, 'Ø 4.5');
const bottom = Math.max(...nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.y + n.frame.height));
assert.ok(glyph.frame.y > bottom && label.frame.y + label.frame.height <= frame.y + frame.height, 'under the bars, inside the chart');
console.log('{}');
""")

    def test_on_columns_and_lines_the_marker_stands_at_the_plots_right(self):
        run_node(PRELUDE + """
for (const kind of ['chart.column', 'chart.line']) {
  const nodes = render(kind, { ...capex, referenceLines: [{ value: 77, style: 'marker', label: 'Avg 77' }] });
  const glyph = nodes.find((n) => n.role === 'chart-reference-marker'), label = nodes.find((n) => n.role === 'chart-reference-label');
  const right = Math.max(...nodes.filter((n) => ['chart-mark', 'chart-marker', 'data-label'].includes(n.role)).map((n) => n.frame.x + n.frame.width));
  assert.ok(glyph.frame.x >= right - 1, `${kind}: right of every mark and value`);
  assert.ok(label.frame.x + label.frame.width <= frame.x + frame.width + 1, `${kind}: inside the chart`);
}
assert.match(error(() => render('chart.scatter', { points: [1, 2, 3, 4, 5].map((k) => ({ name: `P${k}`, x: k, y: k * 2 })), referenceLines: [{ value: 4, style: 'marker' }] })), /average marker/);
console.log('{}');
""")


class ValueLabelTests(unittest.TestCase):
    def test_a_range_or_an_approximation_marks_its_bar_as_an_estimate(self):
        run_node(PRELUDE + """
const nodes = render('chart.column', { ...capex, valueLabels: [{ category: 'FY30', display: '55-65' }, { category: 'FY31', display: '~52' }, { category: 'FY28', ring: true }] });
const label = (c) => nodes.find((n) => n.role === 'data-label' && n.data.category === c);
assert.equal(label('FY30').text, '55-65');
assert.equal(label('FY30').data.value, 60, 'the plotted value is kept beside what it prints');
const mark = (c) => nodes.find((n) => n.role === 'chart-mark' && n.data.category === c);
assert.equal(mark('FY30').data.state, 'estimate');
assert.ok(mark('FY30').style.opacity < 1 && !(mark('FY29').style.opacity < 1), 'drawn lighter, as an assumption is');
const ring = nodes.find((n) => n.role === 'chart-label-ring');
assert.equal(ring.data.category, 'FY28');
const ink = label('FY28').frame;
assert.ok(ring.frame.x < ink.x + ink.width / 2 && ring.frame.x + ring.frame.width > ink.x + ink.width / 2, 'round its label');
console.log('{}');
""")

    def test_an_override_that_names_nothing_is_refused(self):
        found = run_node(PRELUDE + """
console.log(JSON.stringify({
  unknown: error(() => render('chart.column', { ...capex, valueLabels: [{ category: 'FY40', display: '1' }] })),
  empty: error(() => render('chart.column', { ...capex, valueLabels: [{ category: 'FY30' }] })),
  long: error(() => render('chart.column', { ...capex, valueLabels: [{ category: 'FY30', display: 'between 55 and 65 million' }] })),
}));
""")
        self.assertIn("names a category", found["unknown"])
        self.assertIn("changes nothing", found["empty"])
        self.assertIn("12 characters", found["long"])


class BarGroupTests(unittest.TestCase):
    def test_a_bar_chart_groups_its_rows_under_bracketed_labels(self):
        run_node(PRELUDE + """
const nodes = render('chart.bar', { ...stations, categoryGroups: [{ id: 'core', label: 'City core', categories: ['Central', 'Harbour', 'Airport'] }, { id: 'out', label: 'Suburbs', categories: ['Northgate', 'Riverside', 'Old Town', 'Parkway', 'Westfield', 'Market'] }] });
const labels = nodes.filter((n) => n.role === 'category-group-label');
assert.deepEqual(labels.map((n) => n.text), ['City core', 'Suburbs']);
const names = nodes.filter((n) => n.role === 'category-label');
for (const label of labels) for (const name of names) assert.ok(!overlaps(label.frame, name.frame), `${label.text} clears ${name.text}`);
assert.ok(labels.every((l) => l.frame.x >= frame.x), 'inside the chart');
const row = (c) => nodes.find((n) => n.role === 'chart-mark' && n.data.category === c).frame;
const mid = labels[0].frame.y + labels[0].frame.height / 2;
assert.ok(mid > row('Central').y && mid < row('Airport').y + row('Airport').height, 'centred on its run');
console.log('{}');
""")


class GrowthColumnTests(unittest.TestCase):
    def test_growth_runs_for_two_periods_in_two_columns(self):
        run_node(PRELUDE + """
const tickets = { categories: ['FY16', 'FY19', 'FY22', 'FY26'], series: [{ name: 'Season', values: [20, 21, 15, 11] }, { name: 'Flexi', values: [2, 4, 10, 16] }, { name: 'Anytime', values: [14, 15, 17, 19] }] };
const nodes = render('chart.stacked-column', { ...tickets, segmentGrowth: [{ from: 'FY16', to: 'FY19' }, { from: 'FY19', to: 'FY26' }] });
const headings = nodes.filter((n) => n.data?.growthHeading);
assert.equal(headings.length, 2);
assert.ok(headings[1].frame.x >= headings[0].frame.x + headings[0].frame.width, 'side by side');
const flexi = nodes.filter((n) => n.data?.series === 'Flexi' && n.data?.growth).map((n) => n.text);
assert.deepEqual(flexi, ['+100.0%', '+300%']);
assert.match(error(() => render('chart.stacked-column', { ...tickets, segmentGrowth: [1, 2, 3, 4].map(() => ({ from: 'FY16', to: 'FY19' })) })), /up to 3/);
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
