"""Bands behind a chart's marks and intervals round a line (runtime/chart-bands.mjs).

A band is a range the chart is read against - a target range, a run of years,
the cluster a scatter is about - so it sits behind the marks, its value range
is in the domain, and its label lands where it names the band without
touching a mark. An interval is the envelope a forecast or a scenario runs in,
nested and lighter as it widens. Each test renders the chart and reads where
the band, its label and the marks went.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { nativeChartSpec } from './skills/professional-slides/runtime/core.mjs';
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const frame = { x: 40, y: 60, width: 760, height: 420 };
const render = (kind, props) => REGISTRY.get(kind).render({ id: 'c', frame, props }).nodes;
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const years = ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'];
const punctual = { categories: years, series: [{ name: 'On time', values: [84.2, 86.1, 90.3, 85.7, 87.9, 91.2, 92.0, 91.5] }] };
"""


class ValueBandTests(unittest.TestCase):
    def test_a_target_range_sits_behind_the_columns_inside_the_domain(self):
        run_node(PRELUDE + """
const nodes = render('chart.column', { ...punctual, bands: [{ from: 90, to: 95, label: 'Target range 90-95%' }] });
const band = nodes.find((n) => n.role === 'chart-band');
const first = nodes.findIndex((n) => n.role === 'chart-mark');
assert.ok(band, 'the band is drawn');
assert.ok(nodes.indexOf(band) < first, 'behind the marks');
// 95 is above every value: the domain reaches it, so the band is drawn whole and not clipped at the top.
assert.ok(band.frame.height > 10);
const label = nodes.find((n) => n.role === 'chart-band-label');
assert.equal(label.text, 'Target range 90-95%');
for (const other of nodes.filter((n) => ['chart-mark', 'data-label', 'category-label'].includes(n.role))) assert.ok(!overlaps(label.frame, other.frame), `the label clears ${other.role} ${other.text ?? ''}`);
console.log('{}');
""")

    def test_a_bar_chart_names_its_range_over_the_bars_inside_its_frame(self):
        run_node(PRELUDE + """
const props = { categories: ['Coast', 'Valley', 'Dales', 'Airport', 'Eastern', 'Northern', 'Lakes', 'Borders'], series: [{ name: 'Cost', values: [14.2, 15.1, 15.8, 16.9, 17.6, 18.4, 19.9, 21.3] }] };
const plain = render('chart.bar', props), banded = render('chart.bar', { ...props, bands: [{ from: 14, to: 16, label: 'Plan range' }] });
const label = banded.find((n) => n.role === 'chart-band-label'), band = banded.find((n) => n.role === 'chart-band');
assert.ok(label.frame.y >= frame.y, 'the label stays inside the chart frame');
assert.ok(label.frame.y + label.frame.height <= band.frame.y, 'over the bars the band spans');
// The row the label takes is reserved: the plot starts lower than an unbanded chart's.
const top = (nodes) => Math.min(...nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.y));
assert.ok(top(banded) > top(plain));
console.log('{}');
""")


class CategoryBandTests(unittest.TestCase):
    def test_a_run_of_columns_is_boxed_and_named_over_the_plot(self):
        run_node(PRELUDE + """
const nodes = render('chart.column', { ...punctual, bands: [{ from: 'FY24', to: 'FY26', label: 'New timetable', style: 'box' }] });
const edges = nodes.filter((n) => n.role === 'chart-band-edge' && n.id.includes('band-edge'));
assert.equal(edges.length, 4, 'a dashed box is four editable rules');
assert.ok(edges.every((n) => n.style.dash === 'dash'));
const marks = (c) => nodes.find((n) => n.role === 'chart-mark' && n.data.category === c).frame;
const left = Math.min(...edges.map((n) => n.data.x1)), right = Math.max(...edges.map((n) => n.data.x2));
assert.ok(left < marks('FY24').x && right > marks('FY26').x + marks('FY26').width, 'the box holds its columns');
assert.ok(left > marks('FY23').x + marks('FY23').width, 'and not the one before');
const label = nodes.find((n) => n.role === 'chart-band-label');
const plotTop = Math.min(...edges.map((n) => n.frame.y));
assert.ok(label.frame.y + label.frame.height <= plotTop, 'the run is named over the plot');
console.log('{}');
""")

    def test_a_shaded_period_on_a_line_spans_halfway_to_its_neighbours(self):
        run_node(PRELUDE + """
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const nodes = render('chart.line', { categories: months, series: [{ name: 'Journeys', values: [0.92, 0.95, 0.97, 0.64, 0.61, 0.96, 0.99, 0.98] }], bands: [{ from: 'Apr', to: 'May', label: 'Strike' }] });
const band = nodes.find((n) => n.role === 'chart-band');
const x = (c) => nodes.find((n) => n.role === 'chart-marker' && n.id.endsWith(`:${c.toLowerCase()}`)).frame;
const mid = (r) => r.x + r.width / 2;
assert.ok(Math.abs(band.frame.x - (mid(x('Mar')) + mid(x('Apr'))) / 2) < 1.5);
assert.ok(Math.abs(band.frame.x + band.frame.width - (mid(x('May')) + mid(x('Jun'))) / 2) < 1.5);
console.log('{}');
""")

    def test_a_labelled_run_and_a_period_bracket_are_one_or_the_other(self):
        message = run_node(PRELUDE + """
console.log(JSON.stringify({ message: error(() => render('chart.column', { ...punctual, periods: [{ from: 'FY19', to: 'FY21', label: 'Before' }], bands: [{ from: 'FY24', to: 'FY26', label: 'After' }] })) }));
""")["message"]
        self.assertIn("periods", message)


class RingTests(unittest.TestCase):
    def test_a_ring_holds_its_points_and_their_names_inside_the_plot(self):
        run_node(PRELUDE + """
const points = [['Coast', 14.2, 93], ['Valley', 15.1, 92], ['Dales', 15.8, 91], ['Airport', 16.9, 88], ['Eastern', 17.6, 86], ['Northern', 18.4, 84], ['Lakes', 19.9, 85], ['Borders', 21.3, 82]].map(([name, x, y]) => ({ name, x, y }));
const nodes = render('chart.scatter', { points, xLabel: 'Cost', yLabel: 'On time', bands: [{ points: ['Coast', 'Valley', 'Dales'], label: 'Electric lines' }] });
const ring = nodes.find((n) => n.role === 'chart-band-ring');
const inside = (x, y) => ((x - ring.frame.x - ring.frame.width / 2) / (ring.frame.width / 2)) ** 2 + ((y - ring.frame.y - ring.frame.height / 2) / (ring.frame.height / 2)) ** 2 <= 1.03;
for (const name of ['Coast', 'Valley', 'Dales']) {
  const dot = nodes.find((n) => n.role === 'chart-marker' && n.id.endsWith(`:${name.toLowerCase()}`)).frame;
  assert.ok(inside(dot.x + dot.width / 2, dot.y + dot.height / 2), `${name} is inside the ring`);
}
const axis = nodes.filter((n) => n.role === 'chart-axis-label' || (n.role === 'axis-label'));
for (const label of nodes.filter((n) => n.type === 'text' && /^(8|9)\\d$/.test(String(n.text)))) assert.ok(!overlaps(label.frame, ring.frame), `the ring crosses no tick label (${label.text})`);
console.log('{}');
""")


class RefusalTests(unittest.TestCase):
    def test_bands_that_mark_nothing_or_cannot_be_drawn_are_refused(self):
        found = run_node(PRELUDE + """
const out = {
  every: error(() => render('chart.column', { ...punctual, bands: [{ from: 'FY19', to: 'FY26' }] })),
  four: error(() => render('chart.column', { ...punctual, bands: [1, 2, 3, 4].map((k) => ({ from: k, to: k + 1 })) })),
  backwards: error(() => render('chart.column', { ...punctual, bands: [{ from: 95, to: 90 }] })),
  unknown: error(() => render('chart.column', { ...punctual, bands: [{ from: 'FY18', to: 'FY20' }] })),
  ellipse: error(() => render('chart.column', { ...punctual, bands: [{ from: 'FY24', to: 'FY26', style: 'ellipse' }] })),
  pie: error(() => render('chart.pie', { labels: ['A', 'B', 'C'], values: [50, 30, 20], bands: [{ from: 10, to: 20 }] })),
};
console.log(JSON.stringify(out));
""")
        self.assertIn("marks none", found["every"])
        self.assertIn("3 bands at most", found["four"])
        self.assertIn("from` < `to`", found["backwards"])
        self.assertIn("two of the chart's categories", found["unknown"])
        self.assertIn("named points", found["ellipse"])
        self.assertIn("does not draw bands", found["pie"])

    def test_a_banded_chart_is_drawn_not_native(self):
        run_node(PRELUDE + """
assert.ok(nativeChartSpec('chart.column', punctual, frame, render('chart.column', punctual)), 'a bare column chart is native');
const banded = { ...punctual, bands: [{ from: 90, to: 95 }] };
assert.equal(nativeChartSpec('chart.column', banded, frame, render('chart.column', banded)), null);
console.log('{}');
""")


class PageTests(unittest.TestCase):
    def test_a_labelled_target_range_marks_a_chart_on_its_own(self):
        run_node(PRELUDE + """
const page = { id: 'p', type: 'trend', form: 'column', commentary: 'on-exhibit', takeaway: false, why: 'One measure over eight years against its target range',
  settles: { kind: 'rate', what: 'punctuality against the target band' }, adds: 'The band says which years met the target, which the bars do not',
  title: 'Punctuality has sat inside the target range for three years running',
  exhibit: { heading: 'Trains on time', unit: '%', ...punctual, bands: [{ from: 90, to: 95, label: 'Target range' }] } };
const slide = compilePage(page);
assert.equal(slide.exhibit.bands.length, 1);
// Unlabelled, a band names no figure: the page still needs a mark that says one.
assert.throws(() => compilePage({ ...page, exhibit: { ...page.exhibit, bands: [{ from: 90, to: 95 }] } }), /mark it with a number/);
// A month written as an ISO key is renamed in the band as on the axis.
const monthly = compilePage({ ...page, exhibit: { heading: 'Trains on time', unit: '%', categories: ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08'], series: punctual.series,
  bands: [{ from: 90, to: 95, label: 'Target range' }, { from: '2025-06', to: '2025-08', style: 'box' }] } });
assert.equal(monthly.exhibit.bands[1].from, 'Jun 25');
console.log('{}');
""")


class IntervalTests(unittest.TestCase):
    FAN = """
const cats = ['FY24', 'FY25', 'FY26', 'FY27', 'FY28', 'FY29', 'FY30', 'FY31'];
const fan = { categories: cats, series: [{ name: 'Journeys', values: [45, 47, 48, 50.5, 53, 55.5, 58, 60.5], assumedFrom: 'FY27' }],
  intervals: [
    { low: [null, null, 48, 49.5, 51, 52.5, 54, 55.5], high: [null, null, 48, 51.5, 55, 58.5, 62, 65.5], label: '50% of outcomes' },
    { low: [null, null, 48, 48, 48.5, 49, 49.5, 50], high: [null, null, 48, 53, 57.5, 62, 66.5, 71], label: '90% of outcomes' }] };
"""

    def test_a_fan_is_nested_under_its_line_the_widest_palest(self):
        run_node(PRELUDE + self.FAN + """
const nodes = render('chart.line', fan);
const shapes = nodes.filter((n) => n.role === 'chart-interval');
assert.equal(shapes.length, 2);
assert.ok(nodes.indexOf(shapes[1]) < nodes.findIndex((n) => n.role === 'chart-line'), 'under the line');
assert.equal(shapes[0].data.label, '90% of outcomes', 'the widest is drawn first');
assert.ok(shapes[0].style.opacity < shapes[1].style.opacity, 'and palest');
// The fan's top, 71, is on the scale: no part of the envelope leaves the plot.
assert.ok(shapes[0].data.paths[0].every(([x, y]) => y >= -0.001 && y <= 1.001));
const labels = nodes.filter((n) => n.role === 'chart-band-label');
assert.equal(labels.length, 2);
const values = nodes.filter((n) => n.role === 'data-label');
for (const label of labels) for (const value of values) assert.ok(!overlaps(label.frame, value.frame), `${label.text} clears ${value.text}`);
console.log('{}');
""")

    def test_an_interval_that_cannot_be_drawn_round_a_line_is_refused(self):
        found = run_node(PRELUDE + self.FAN + """
const gap = { ...fan, intervals: [{ low: [null, 46, null, 49, 50, 51, 52, 53], high: [null, 48, null, 52, 55, 58, 61, 64] }] };
const short = { ...fan, intervals: [{ low: [1, 2, 3], high: [2, 3, 4] }] };
const crossed = { ...fan, intervals: [{ low: [null, null, 48, 55, 51, 52, 53, 54], high: [null, null, 48, 51, 55, 58, 61, 64] }] };
console.log(JSON.stringify({ gap: error(() => render('chart.line', gap)), short: error(() => render('chart.line', short)),
  crossed: error(() => render('chart.line', crossed)), area: error(() => render('chart.area', fan)),
  column: error(() => render('chart.column', fan)), native: nativeChartSpec('chart.line', fan, frame, render('chart.line', fan)) }));
""")
        self.assertIn("unbroken", found["gap"])
        self.assertIn("one value a category", found["short"])
        self.assertIn("at or under its", found["crossed"])
        self.assertIn("does not draw intervals", found["area"])
        self.assertIn("does not draw intervals", found["column"])
        self.assertIsNone(found["native"])


if __name__ == "__main__":
    unittest.main()
