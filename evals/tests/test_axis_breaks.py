"""A broken value axis and a broken category axis (runtime/chart-categorical.mjs).

An outlier ten times its neighbours flattens every other bar; `valueBreak`
cuts the run of the axis between them, draws a slanted gap across each mark
that crosses the cut and keeps every value printed. `categoryBreaks` marks
periods that are not adjacent with a "//" on the category axis, which tells
the reader the columns skip as plainly as a heading would.
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
const lines = { categories: ['Airport', 'Coast', 'Valley', 'Dales', 'Eastern', 'Northern', 'Lakes', 'Borders'], series: [{ name: 'Journeys', values: [412, 48, 44, 39, 35, 31, 27, 22] }] };
const height = (nodes, c) => nodes.find((n) => n.role === 'chart-mark' && n.data.category === c).frame.height;
"""


class ValueBreakTests(unittest.TestCase):
    def test_the_cut_gives_the_rest_their_height_and_keeps_the_values(self):
        run_node(PRELUDE + """
const plain = render('chart.column', lines), broken = render('chart.column', { ...lines, valueBreak: { from: 70, to: 380 } });
assert.ok(height(broken, 'Coast') > height(plain, 'Coast') * 3, 'the rest of the field is no longer flat');
assert.ok(height(broken, 'Airport') > height(broken, 'Coast'), 'the outlier is still the tallest');
const cuts = broken.filter((n) => n.role === 'chart-break');
assert.equal(cuts.length, 1, 'one mark crosses the cut');
assert.equal(cuts[0].data.category, 'Airport');
const airport = broken.find((n) => n.role === 'chart-mark' && n.data.category === 'Airport').frame;
assert.ok(cuts[0].frame.x <= airport.x && cuts[0].frame.x + cuts[0].frame.width >= airport.x + airport.width, 'the gap runs right across the mark');
assert.ok(broken.some((n) => n.role === 'data-label' && n.text === '412'), 'the true value is printed');
assert.equal(nativeChartSpec('chart.column', { ...lines, valueBreak: { from: 70, to: 380 } }, frame, broken), null);
console.log('{}');
""")

    def test_an_explicit_top_is_cut_with_the_marks(self):
        # A yMax past the cut was set against the compressed marks unchanged, which flattened them as if nothing were cut.
        run_node(PRELUDE + """
const cut = { from: 70, to: 380 }, auto = render('chart.column', { ...lines, valueBreak: cut }), topped = render('chart.column', { ...lines, valueBreak: cut, yMax: 420 });
assert.ok(height(topped, 'Coast') > height(auto, 'Coast') * 0.8, `the rest keep their height under a set top (${height(topped, 'Coast')} against ${height(auto, 'Coast')})`);
assert.ok(height(topped, 'Airport') < height(auto, 'Airport'), 'the room over the outlier is the room the top asks for');
const bars = render('chart.bar', { ...lines, valueBreak: cut, xMax: 420 }), width = (c) => bars.find((n) => n.role === 'chart-mark' && n.data.category === c).frame.width;
assert.ok(width('Coast') > width('Airport') / 3, "a bar chart's top is cut the same way");
console.log('{}');
""")

    def test_a_break_inside_a_stack_cuts_the_segment_that_crosses_it(self):
        run_node(PRELUDE + """
const costs = { categories: ['Airport', 'Coast', 'Valley', 'Dales', 'Eastern'], series: [{ name: 'Track', values: [310, 22, 20, 19, 18] }, { name: 'Staff', values: [40, 14, 13, 12, 12] }, { name: 'Energy', values: [12, 8, 7, 7, 9] }] };
const nodes = render('chart.stacked-bar', { ...costs, valueBreak: { from: 60, to: 280 } });
const cuts = nodes.filter((n) => n.role === 'chart-break');
assert.deepEqual(cuts.map((n) => [n.data.category, n.data.series]), [['Airport', 'Track']]);
console.log('{}');
""")

    def test_a_cut_that_breaks_nothing_or_hides_a_value_is_refused(self):
        found = run_node(PRELUDE + """
console.log(JSON.stringify({
  inside: error(() => render('chart.column', { ...lines, valueBreak: { from: 40, to: 380 } })),
  none: error(() => render('chart.column', { ...lines, valueBreak: { from: 450, to: 500 } })),
  axis: error(() => render('chart.column', { ...lines, valueBreak: { from: 70, to: 380 }, showValueAxis: true })),
  order: error(() => render('chart.column', { ...lines, valueBreak: { from: 380, to: 70 } })),
  reference: error(() => render('chart.column', { ...lines, valueBreak: { from: 70, to: 380 }, referenceLines: [{ value: 400, label: 'Peak' }] })),
  line: error(() => render('chart.line', { categories: ['FY23', 'FY24', 'FY25', 'FY26'], series: [{ name: 'x', values: [1, 2, 30, 4] }], valueBreak: { from: 5, to: 25 } })),
}));
""")
        self.assertIn("inside the cut", found["inside"])
        self.assertIn("no mark crosses", found["none"])
        self.assertIn("cannot be read off a scale", found["axis"])
        self.assertIn("0 < from < to", found["order"])
        self.assertIn("keep references under the cut", found["reference"])
        self.assertIn("does not draw a broken value axis", found["line"])


class CategoryBreakTests(unittest.TestCase):
    def test_chosen_years_broken_at_each_gap_pass_the_uneven_axis_rule(self):
        run_node(PRELUDE + """
const page = { id: 'p', type: 'trend', form: 'column', commentary: 'on-exhibit', takeaway: false, why: 'Journeys at chosen years, the gaps between them marked',
  settles: { kind: 'rate', what: 'annual journeys at FY10, FY19 and FY22 to FY26' }, adds: 'The change arrow gives the rate the columns imply',
  title: 'Journeys in FY26 are twice FY10s and a fifth above FY19s',
  exhibit: { categories: ['FY10', 'FY15', 'FY19', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'],
    series: [{ name: 'Journeys', values: [24, 33, 40, 42, 45, 46, 47, 48] }], change: { from: 'FY10', to: 'FY26' } } };
assert.doesNotThrow(() => compilePage(page), 'unmarked, the columns are drawn where the dates fall (chart-categorical.mjs rowLabelling)');
assert.throws(() => compilePage({ ...page, exhibit: { ...page.exhibit, categoryBreaks: ['FY10', 'FY15'] } }), /TIME_AXIS_UNEVEN/, 'one gap left unmarked still does');
const slide = compilePage({ ...page, exhibit: { ...page.exhibit, categoryBreaks: ['FY10', 'FY15', 'FY19'] } });
const nodes = render('chart.column', { ...slide.exhibit, change: undefined });
assert.equal(nodes.filter((n) => n.role === 'chart-break-mark').length, 6, 'two strokes a break');
const mark = (c) => nodes.find((n) => n.role === 'chart-mark' && n.data.category === c).frame;
const glyph = nodes.find((n) => n.role === 'chart-break' && n.data.after === 'FY10').frame;
assert.ok(glyph.x > mark('FY10').x + mark('FY10').width && glyph.x + glyph.width < mark('FY15').x, 'between the two columns');
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
