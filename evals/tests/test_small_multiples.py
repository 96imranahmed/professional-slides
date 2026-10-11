"""Small multiples: five to twelve small charts of one kind on one scale (runtime/chart-small-multiples.mjs).

Panels stop at four; a trellis carries the rest. Every panel draws the same
mark over the same axis, on one domain unless told otherwise, the subject's
panel in the accent, each panel's average named, and the axis labelled once.
As a page it is `panels` form `small-multiples`: one exhibit, set as a chart
is, graded the best fit for five or more cuts.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { carrierOf, boundKeys } from './skills/professional-slides/runtime/claim-fit.mjs';
const frame = { x: 60, y: 160, width: 1160, height: 480 };
const chart = REGISTRY.get('chart.small-multiples');
const render = (props, f = frame) => chart.render({ id: 'c', frame: f, props }).nodes;
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const years = ['FY23', 'FY24', 'FY25', 'FY26'];
const regions = ['North', 'South', 'East', 'West', 'Central', 'Coast', 'Fens', 'Moors'];
const items = regions.map((label, i) => ({ label, values: years.map((_, j) => 10 + i + j * (i % 3)) }));
"""


class TrellisTests(unittest.TestCase):
    def test_every_panel_draws_one_mark_on_one_scale(self):
        run_node(PRELUDE + """
const nodes = render({ mark: 'column', categories: years, items, highlights: [{ category: 'West' }] });
const titles = nodes.filter((n) => n.data?.panelTitle).map((n) => n.text);
assert.deepEqual(titles, regions);
const column = (item, year) => nodes.find((n) => n.role === 'chart-mark' && n.data.item === item && n.data.category === year).frame;
// One domain: equal values stand equal heights wherever they are.
const equal = [];
for (const a of items) for (const b of items) for (const [i, y] of years.entries()) for (const [j, z] of years.entries()) if (a !== b && a.values[i] === b.values[j]) equal.push([a.label, y, b.label, z]);
assert.ok(equal.length);
for (const [a, y, b, z] of equal) assert.ok(Math.abs(column(a, y).height - column(b, z).height) < 0.5, `${a} ${y} and ${b} ${z}`);
const fill = (item) => nodes.find((n) => n.role === 'chart-mark' && n.data.item === item).style.fill.tokenId;
assert.equal(fill('West'), 'color.accent');
assert.equal(fill('North'), 'color.componentPrimary');
// The axis is labelled once, under the bottom row.
const labels = nodes.filter((n) => n.role === 'category-label' && n.data?.category === 'FY23');
const bottom = Math.max(...nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.y + n.frame.height));
assert.ok(labels.length >= 1 && labels.every((n) => n.frame.y >= bottom - 2));
console.log('{}');
""")

    def test_own_scales_and_averages(self):
        run_node(PRELUDE + """
const nodes = render({ mark: 'line', categories: years, items, scale: 'own', reference: 'average' });
const refs = nodes.filter((n) => n.role === 'chart-reference-label');
assert.equal(refs.length, items.length, 'each panel names its own average');
assert.ok(refs.every((n) => n.text.startsWith('Ø')));
const mean = items[0].values.reduce((a, b) => a + b, 0) / items[0].values.length;
assert.equal(nodes.find((n) => n.role === 'chart-reference-line' && n.data.item === 'North').data.value, mean);
console.log('{}');
""")

    def test_a_grid_read_both_ways_takes_its_headers(self):
        run_node(PRELUDE + """
const nodes = render({ mark: 'column', categories: years, items: items.slice(0, 6), rowLabels: ['North', 'South'], columnLabels: ['Season', 'Flexi', 'Anytime'] });
assert.deepEqual(nodes.filter((n) => n.data?.header === 'column').map((n) => n.text), ['Season', 'Flexi', 'Anytime']);
assert.deepEqual(nodes.filter((n) => n.data?.header === 'row').map((n) => n.text), ['North', 'South']);
assert.equal(nodes.filter((n) => n.data?.panelTitle).length, 0, 'the headers stand in for the titles');
console.log('{}');
""")

    def test_a_trellis_that_cannot_be_read_is_refused(self):
        found = run_node(PRELUDE + """
const many = Array.from({ length: 13 }, (_, i) => ({ label: `P${i}`, values: [1, 2, 3, 4] }));
console.log(JSON.stringify({
  many: error(() => render({ categories: years, items: many })),
  length: error(() => render({ categories: years, items: [{ label: 'A', values: [1, 2] }, ...items.slice(1)] })),
  grid: error(() => render({ categories: years, items, rowLabels: ['a', 'b'], columnLabels: ['x', 'y', 'z'] })),
  small: error(() => render({ mark: 'bar', categories: regions, items: items.map((i) => ({ ...i, values: regions.map(() => 1) })) }, { ...frame, height: 200 })),
  every: error(() => render({ categories: years, items: items.slice(0, 2), highlights: [{ category: 'North' }, { category: 'South' }] })),
}));
""")
        self.assertIn("2 to 12 panels", found["many"])
        self.assertIn("one value a category", found["length"])
        self.assertIn("reading order", found["grid"])
        self.assertIn("too small to read", found["small"])
        self.assertIn("marks none", found["every"])


class PageTests(unittest.TestCase):
    PAGE = """
const page = { id: 'p', type: 'panels', form: 'small-multiples', commentary: 'beside', takeaway: false,
  why: 'Eight regions answer one question, and only a panel each shows which moved',
  settles: { kind: 'comparison', what: 'journeys by region, FY23 to FY26' }, adds: 'The points say why the West moved and the rest did not',
  title: 'Only the West grew in every year of the four', exhibit: { heading: 'Journeys by region', unit: 'm', mark: 'column', categories: years, items, highlights: [{ category: 'West' }] },
  points: [{ lead: 'One region moved', text: 'The West grew every year, by 1.5 million a year, while the others held level.' }, { lead: 'The timetable', text: 'It was the only region recast, and its trains did not change.' }] };
"""

    def test_the_form_is_one_trellis_set_as_a_chart_is(self):
        run_node(PRELUDE + self.PAGE + """
const slide = compilePage(page);
assert.equal(slide.exhibit.type, 'chart.small-multiples');
assert.equal(slide.layout, 'exhibit-left');
assert.equal(slide.arrange, undefined, 'not a row of panels');
assert.equal(slide.pageType.values, 32, 'every panel counts towards the evidence');
assert.throws(() => compilePage({ ...page, exhibit: { ...page.exhibit, items: items.slice(0, 4) } }), /five or more cuts/);
assert.throws(() => compilePage({ ...page, exhibit: undefined, exhibits: [page.exhibit, page.exhibit] }), /carries 1 exhibit/);
assert.throws(() => compilePage({ ...page, commentary: 'captions' }), /choose `commentary`/);
console.log('{}');
""")

    def test_it_carries_many_cuts_where_rows_and_grids_stop(self):
        run_node(PRELUDE + """
const row = carrierOf('panels', 'small-multiples');
assert.equal(row.carries.cuts({ cuts: 8 }), 2, 'the best fit for eight cuts');
assert.equal(row.carries.cuts({ cuts: 3 }), 0);
assert.equal(carrierOf('panels', 'row').needs({ cuts: 8 }) !== null, true, 'a row cannot take eight');
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
