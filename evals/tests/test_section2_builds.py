"""Slide types the catalogue was missing or held in part.

A trend line on a scatter (promised in the chart reference and dropped
unseen), a bridge read down the page, value badges on a map, eras over a
schedule, a sparkline in a table cell, several markers on a spectrum, nested
circles for a market and the parts of it, and a Venn of two or three sets.
"""
import math
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const render = (id, props, frame = { x: 60, y: 140, width: 1160, height: 420 }) => { const out = REGISTRY.get(id).render({ id: 'x', frame, props }); return Array.isArray(out) ? out : out.nodes; };
"""


class ChartTests(unittest.TestCase):
    def test_a_scatter_fits_its_trend_line_and_says_its_basis(self):
        run_node(PRELUDE + """
const points = [[1, 3], [2, 5], [3, 7], [4, 9], [5, 11], [6, 13.5]].map(([x, y], i) => ({ name: `P${i}`, x, y }));
const nodes = render('chart.scatter', { points, trendLine: { method: 'linear' } });
const line = nodes.find((n) => n.role === 'chart-trend-line'), label = nodes.find((n) => n.data?.trendLine);
assert.ok(Math.abs(line.data.slope - 2.07) < 0.05, 'the least-squares slope');
assert.equal(label.text, `Linear fit, R² = ${line.data.r2.toFixed(2)}`);
assert.ok(line.data.r2 > 0.99 && line.data.r2 <= 1, 'R² of a near-straight sample');
assert.ok(nodes.indexOf(line) < nodes.findIndex((n) => n.role === 'chart-marker'), 'drawn behind the points');
assert.match(error(() => render('chart.scatter', { points: points.slice(0, 4), trendLine: { method: 'linear' } })), /5 or more/);
assert.match(error(() => render('chart.scatter', { points, trendLine: { method: 'loess' } })), /least-squares/);
assert.match(error(() => render('chart.column', { categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }], trendLine: { method: 'linear' } })), /does not draw a fitted trend line/);
console.log('{}');
""")

    def test_a_bridge_reads_down_the_page(self):
        run_node(PRELUDE + """
const props = { orientation: 'horizontal', categories: ['FY25', 'Leisure journeys', 'Season tickets', 'Fares rise', 'FY26'], values: [588, 31, -14, 18, 623], totals: [0, 4] };
const nodes = render('chart.waterfall', props);
const bars = nodes.filter((n) => n.role === 'chart-mark');
assert.equal(bars.length, 5);
assert.ok(bars.every((bar, i) => !i || bar.frame.y > bars[i - 1].frame.y), 'a step a row, down the page');
const fall = bars[2], fallLabel = nodes.find((n) => n.role === 'data-label' && n.data.category === 'Season tickets');
assert.ok(fallLabel.frame.x + fallLabel.frame.width <= fall.frame.x + 1, 'a fall is named before its left end');
assert.ok(nodes.some((n) => n.role === 'chart-axis-break'), 'totals far above their steps are cut');
assert.ok(nodes.filter((n) => n.role === 'chart-connector').every((n) => n.frame.width < 0.5), 'connectors drop straight down');
assert.match(error(() => render('chart.waterfall', { ...props, annotations: [{ category: 'FY26', text: 'Up 6%' }] })), /notes in the page's commentary/);
console.log('{}');
""")


class FigureTests(unittest.TestCase):
    def test_map_badges_print_their_value_at_one_size(self):
        run_node(PRELUDE + """
const markers = [{ label: 'London', longitude: -0.128, latitude: 51.507, value: 0.82, display: '0.82m', style: 'badge' }, { label: 'Newcastle', longitude: -1.618, latitude: 54.978, value: 0.31, display: '0.31m', style: 'badge' }];
const nodes = render('map', { geography: 'country:GBR', markers, sizeLegend: { label: 'Visitors, m' } });
const discs = nodes.filter((n) => n.data?.badge);
assert.equal(new Set(discs.map((n) => Math.round(n.frame.width))).size, 1, 'one size: the figure carries the value');
assert.deepEqual(nodes.filter((n) => n.role === 'map-marker-value').map((n) => n.text).sort(), ['0.31m', '0.82m']);
assert.ok(!nodes.some((n) => /size-legend/.test(n.id)), 'no size key for badges');
assert.match(error(() => render('map', { geography: 'country:GBR', markers: [markers[0], { ...markers[1], style: undefined }], sizeLegend: { label: 'x' } })), /all badges .* or none/);
console.log('{}');
""")

    def test_eras_run_over_the_columns_or_head_the_rows(self):
        run_node(PRELUDE + """
const items = ['FY21', 'FY23', 'FY25', 'FY27'].map((date, i) => ({ date, label: `Stage ${i + 1}`, text: 'What happens at this stage, in a sentence.' }));
const eras = [{ label: 'First franchise', from: 0, to: 1 }, { label: 'Extension', from: 'Stage 3', to: 'Stage 4' }];
const across = render('timeline', { items, eras, orientation: 'across' });
const label = across.find((n) => n.role === 'timeline-era'), first = across.find((n) => n.role === 'timeline-when' || n.role === 'timeline-label');
assert.ok(label.frame.y < first.frame.y, 'the era row stands over the stages');
const down = render('timeline', { items, eras, orientation: 'down' }, { x: 60, y: 140, width: 1160, height: 480 });
assert.deepEqual(down.filter((n) => n.role === 'timeline-era').map((n) => n.text), ['First franchise', 'Extension']);
assert.match(error(() => render('timeline', { items, eras: [{ label: 'A', from: 0, to: 2 }, { label: 'B', from: 1, to: 3 }] })), /overlaps the era before it/);
console.log('{}');
""")

    def test_a_sparkline_cell_draws_its_row_and_names_its_last_figure(self):
        run_node(PRELUDE + """
const nodes = render('table', { columns: ['Line', { label: 'Journeys FY19-FY26', type: 'sparkline' }], rows: [['City', { type: 'sparkline', values: [38, 22, 30, 41], text: '41' }], ['Dales', { type: 'sparkline', values: [20, 12, 18, 32], text: '32' }]] }, { x: 60, y: 140, width: 700, height: 200 });
assert.equal(nodes.filter((n) => n.role === 'table-sparkline').length, 6);
assert.deepEqual(nodes.filter((n) => n.role === 'table-sparkline-label').map((n) => n.text), ['41', '32']);
assert.match(error(() => render('table', { columns: ['Line', 'Trend'], rows: [['City', { type: 'sparkline', values: [1, 2] }]] })), /three to 24 numbers/);
console.log('{}');
""")

    def test_a_spectrum_places_several_markers_on_each_row(self):
        run_node(PRELUDE + """
const markers = [{ id: 'now', label: 'Today' }, { id: 'plan', label: 'After the plan' }];
const items = [{ left: 'Peak-first', right: 'All-day', values: { now: 0.25, plan: 0.7 } }, { left: 'Hourly', right: 'Turn up and go', values: { now: 0.35, plan: 0.65 } }];
const nodes = render('spectrum', { markers, items });
assert.equal(nodes.filter((n) => n.role === 'spectrum-key-dot').length, 2);
assert.equal(nodes.filter((n) => n.role === 'spectrum-marker').length, 4);
assert.match(error(() => render('spectrum', { markers, items: [{ ...items[0], values: { now: 0.2 } }, items[1]] })), /every marker/);
assert.match(error(() => render('spectrum', { markers, segments: 5, items })), /continuous spectrum/);
console.log('{}');
""")

    def test_nested_circles_are_area_true_and_nested(self):
        circles = run_node(PRELUDE + """
const nodes = render('nested-circles', { items: [{ label: 'Market', value: 1200, display: '£1.2bn' }, { label: 'Served', value: 300, display: '£300m' }] });
const discs = nodes.filter((n) => n.role === 'nested-circle');
assert.match(error(() => render('nested-circles', { items: [{ label: 'Market', value: 100 }, { label: 'Served', value: 120 }] })), /at most 100/);
console.log(JSON.stringify({ widths: discs.map((n) => n.frame.width), bottoms: discs.map((n) => n.frame.y + n.frame.height) }));
""")
        self.assertAlmostEqual(circles["widths"][1] / circles["widths"][0], math.sqrt(300 / 1200), places=3)
        self.assertAlmostEqual(circles["bottoms"][0], circles["bottoms"][1], places=3)

    def test_a_venn_names_each_overlap_in_its_own_lens(self):
        run_node(PRELUDE + """
const sets = [{ id: 'a', label: 'Walkers' }, { id: 'b', label: 'Older passengers' }, { id: 'c', label: 'Families' }];
const nodes = render('venn', { sets, overlaps: [{ sets: ['a', 'b', 'c'], label: 'Later trains' }, { sets: ['a', 'c'], label: 'Group returns' }] });
const circle = (id) => { const f = nodes.find((n) => n.data?.set === id).frame; return { x: f.x + f.width / 2, y: f.y + f.height / 2, r: f.width / 2 }; };
const centre = (n) => ({ x: n.frame.x + n.frame.width / 2, y: n.frame.y + n.frame.height / 2 });
const inside = (p, c) => Math.hypot(p.x - c.x, p.y - c.y) < c.r;
const pair = centre(nodes.find((n) => n.text === 'Group returns')), all = centre(nodes.find((n) => n.text === 'Later trains'));
assert.ok(inside(pair, circle('a')) && inside(pair, circle('c')) && !inside(pair, circle('b')), 'a pair is named where only the pair meets');
assert.ok(['a', 'b', 'c'].every((id) => inside(all, circle(id))), 'the three are named where all three meet');
assert.ok(nodes.filter((n) => n.role === 'venn-set').every((n) => n.style.opacity < 1), 'the sets are translucent');
assert.match(error(() => render('venn', { sets, overlaps: [{ sets: ['a', 'z'], label: 'x' }] })), /names two or more of the sets/);
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
