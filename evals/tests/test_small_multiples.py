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
import { plottedValues } from './skills/professional-slides/runtime/evidence.mjs';
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
// The rest in the lead series, as a plain chart; the subject apart from them (outside a deck the toolkit's tokens: the accent).
assert.equal(fill('West'), 'color.chartSubject');
assert.equal(fill('North'), 'color.chartSeries1');
// The axis is labelled once, under the bottom row.
const labels = nodes.filter((n) => n.role === 'category-label' && n.data?.category === 'FY23');
const bottom = Math.max(...nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.y + n.frame.height));
assert.ok(labels.length >= 1 && labels.every((n) => n.frame.y >= bottom - 2));
console.log('{}');
""")

    def test_a_rank_runs_with_first_place_at_the_top(self):
        """pr07 drew BA's fall from 13th to 23rd in Skytrax's ranking as a rise: a trellis of ranks sets 1 at the top."""
        run_node(PRELUDE + """
const ranks = [{ label: 'Alpha', values: [13, 18, 23, 23], rank: true }, { label: 'Beta', values: [9, 6, 4, 3], rank: true }];
const nodes = render({ mark: 'line', categories: years, items: ranks });
const end = (item) => nodes.find((n) => n.role === 'chart-marker' && n.data.item === item && n.data.category === 'FY26').frame.y;
const first = (item) => nodes.find((n) => n.role === 'chart-line' && n.data.item === item).frame.y;
// Alpha fell from 13th to 23rd: its line ends lower than it starts; Beta climbed to 3rd: its ends higher.
assert.ok(end('Alpha') + 3.5 > first('Alpha'));
assert.ok(end('Beta') + 3.5 < first('Beta'));
assert.match(error(() => render({ mark: 'column', categories: years, items: ranks })), /RANK_FILLED/);
assert.match(error(() => render({ mark: 'line', categories: years, items: [ranks[0], { label: 'Gamma', values: [1, 2, 3, 4] }] })), /a trellis is one measure/);
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

    def test_an_own_scale_holds_the_charts_reference(self):
        # A chart-level reference outside a panel's values was ruled against that panel's own domain, far off the slide.
        run_node(PRELUDE + """
const small = regions.slice(0, 6).map((label, i) => ({ label, values: years.map((_, j) => 1 + ((i + j) % 3)) }));
const nodes = render({ mark: 'column', categories: years, items: small, scale: 'own', reference: 100 });
const lines = nodes.filter((n) => n.role === 'chart-reference-line');
assert.equal(lines.length, small.length);
for (const line of lines) {
  const marks = nodes.filter((n) => n.role === 'chart-mark' && n.data.item === line.data.item);
  const bottom = Math.max(...marks.map((n) => n.frame.y + n.frame.height));
  assert.equal(line.data.value, 100);
  assert.ok(line.frame.y >= frame.y && line.frame.y <= bottom, `${line.data.item}: the rule at ${line.frame.y} sits in its panel`);
}
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


STACKS = """
const parts = ['Season', 'Day', 'Advance'];
const stacked = regions.slice(0, 6).map((label, i) => ({ label, series: parts.map((name, k) => ({ name, values: years.map((_, j) => 2 + ((i + j + k) % 4)) })) }));
const donuts = regions.slice(0, 6).map((label, i) => ({ label, values: [3 + i, 4, 2 + (i % 3)] }));
const fills = (nodes, item) => nodes.filter((n) => n.role === 'chart-segment' && n.data.item === item).map((n) => [n.data.part, n.style.fill.tokenId]);
"""


class StackAndDonutTests(unittest.TestCase):
    """A stacked or a donut trellis: each panel the same parts, a part one colour in every panel, keyed once.

    A device audit found trellises of 100% stacked columns and of donuts on the
    calibration pages, and the trellis refused both marks; five such panels
    could only be drawn as a grid of four.
    """

    def test_every_panel_stacks_the_same_parts_in_one_colour_each(self):
        run_node(PRELUDE + STACKS + """
const nodes = render({ mark: 'stacked-column', categories: years, items: stacked, highlights: [{ category: 'East' }] });
// One colour a part, the same in every panel.
const colours = new Map();
for (const item of stacked) for (const [part, fill] of fills(nodes, item.label)) { if (colours.has(part)) assert.equal(colours.get(part), fill, part); colours.set(part, fill); }
assert.deepEqual([...colours.values()], ['color.chartSeries1', 'color.chartSeries2', 'color.chartSeries3']);
// Keyed once, over the trellis.
assert.deepEqual(nodes.filter((n) => n.role === 'legend-label').map((n) => n.text), parts);
const key = Math.max(...nodes.filter((n) => n.role === 'legend-label').map((n) => n.frame.y + n.frame.height));
assert.ok(nodes.filter((n) => n.role === 'chart-segment').every((n) => n.frame.y >= key), 'the key sits over the panels');
// One scale: equal totals stand equal heights in every panel.
const total = (item, j) => item.series.reduce((s, p) => s + p.values[j], 0);
const height = (label, j) => nodes.filter((n) => n.role === 'chart-segment' && n.data.item === label && n.data.category === years[j]).reduce((s, n) => s + n.frame.height, 0);
const [a, b] = [stacked[0], stacked[1]];
if (total(a, 0) === total(b, 0)) assert.ok(Math.abs(height(a.label, 0) - height(b.label, 0)) < 0.5);
assert.ok(Math.abs(height(a.label, 0) / height(a.label, 1) - total(a, 0) / total(a, 1)) < 0.01, 'heights stand in proportion to the totals');
// The subject's panel keeps its parts' colours, set on the accent's tint under an accent title.
assert.equal(nodes.filter((n) => n.role === 'chart-panel-highlight').map((n) => n.data.item).join(), 'East');
assert.equal(nodes.find((n) => n.data?.panelTitle && n.text === 'East').style.color.tokenId, 'color.chartSubject');
assert.deepEqual(fills(nodes, 'East').map(([, f]) => f), fills(nodes, 'North').map(([, f]) => f));
// Values print inside the segments that hold them.
assert.ok(nodes.some((n) => n.role === 'data-label' && n.data.placement === 'inside' && n.data.part === 'Season'));
console.log('{}');
""")

    def test_a_hundred_percent_stack_shares_each_category_out_of_its_total(self):
        run_node(PRELUDE + STACKS + """
import { percentStack } from './skills/professional-slides/runtime/compose-charts.mjs';
const nodes = render({ mark: 'stacked-bar', percent: true, categories: years, items: stacked });
// Every stack fills the plot's width: each is 100.
const widths = new Map();
for (const n of nodes.filter((n) => n.role === 'chart-segment')) { const k = `${n.data.item}|${n.data.category}`; widths.set(k, (widths.get(k) ?? 0) + n.frame.width); }
const all = [...widths.values()];
assert.ok(Math.max(...all) - Math.min(...all) < 0.5, 'every stack the same length');
// The shares, to one decimal by largest remainder, sum to exactly 100.
for (const item of stacked) for (const year of years) {
  const shares = nodes.filter((n) => n.role === 'chart-segment' && n.data.item === item.label && n.data.category === year).map((n) => n.data.value);
  assert.equal(Math.round(shares.reduce((a, b) => a + b, 0) * 10), 1000);
}
// The composer lets a trellis of stacks through with its unit said, where it refuses `percent` on a chart with no stack.
assert.equal(percentStack({ type: 'chart.small-multiples', mark: 'stacked-bar', percent: true, items: stacked }).unit, '% of total');
assert.throws(() => percentStack({ type: 'chart.line', percent: true }), /re-expresses a stack/);
console.log('{}');
""")

    def test_a_donut_trellis_keys_its_parts_and_prints_the_centre_share(self):
        run_node(PRELUDE + STACKS + """
const nodes = render({ mark: 'donut', categories: parts, items: donuts, centre: 'Day', highlights: [{ category: 'South' }] });
assert.equal(nodes.filter((n) => n.role === 'chart-segment').length, donuts.length * parts.length);
for (const item of donuts) assert.deepEqual(fills(nodes, item.label).map(([, f]) => f), ['color.chartSeries1', 'color.chartSeries2', 'color.chartSeries3']);
// One size of donut: each is a whole.
const sizes = new Set(nodes.filter((n) => n.role === 'chart-segment').map((n) => Math.round(n.frame.width)));
assert.equal(sizes.size, 1);
// The hole prints the centre part's share, not printed again on the ring.
const centre = nodes.filter((n) => n.role === 'chart-centre-value');
assert.equal(centre.length, donuts.length);
assert.equal(centre[0].text, `${Math.round(100 * 4 / 9)}%`);
assert.ok(!nodes.some((n) => n.role === 'data-label' && n.data.part === 'Day'));
// No axis: the parts are the key's.
assert.deepEqual(nodes.filter((n) => n.role === 'legend-label').map((n) => n.text), parts);
assert.ok(!nodes.some((n) => n.role === 'category-label' && n.data?.category !== undefined));
assert.equal(nodes.find((n) => n.role === 'chart-hole' && n.data.item === 'South').style.fill.tokenId, 'color.accentTint', 'the subject\\'s hole is its tint');
console.log('{}');
""")

    def test_what_a_stack_or_a_donut_cannot_draw_is_refused(self):
        found = run_node(PRELUDE + STACKS + """
const swap = stacked.map((item, i) => i === 2 ? { ...item, series: [item.series[1], item.series[0], item.series[2]] } : item);
const seven = stacked.map((item) => ({ ...item, series: Array.from({ length: 7 }, (_, k) => ({ name: `P${k}`, values: [1, 1, 1, 1] })) }));
console.log(JSON.stringify({
  parts: error(() => render({ mark: 'stacked-column', categories: years, items: swap })),
  negative: error(() => render({ mark: 'stacked-column', categories: years, items: stacked.map((item, i) => i ? item : { ...item, series: [{ ...item.series[0], values: [-1, 2, 3, 4] }, ...item.series.slice(1)] }) })),
  seven: error(() => render({ mark: 'stacked-column', categories: years, items: seven })),
  valuesOnStack: error(() => render({ mark: 'stacked-column', categories: years, items: items.slice(0, 6) })),
  focus: error(() => render({ mark: 'stacked-bar', categories: years, items: stacked.map((item, i) => i ? item : { ...item, focus: 'FY24' }) })),
  percentColumn: error(() => render({ mark: 'column', percent: true, categories: years, items })),
  percentDonut: error(() => render({ mark: 'donut', percent: true, categories: parts, items: donuts })),
  centreColumn: error(() => render({ mark: 'column', centre: 'FY24', categories: years, items })),
  centreUnknown: error(() => render({ mark: 'donut', centre: 'Weekly', categories: parts, items: donuts })),
  donutReference: error(() => render({ mark: 'donut', reference: 'average', categories: parts, items: donuts })),
  donutOwn: error(() => render({ mark: 'donut', scale: 'own', categories: parts, items: donuts })),
  donutEmpty: error(() => render({ mark: 'donut', categories: parts, items: donuts.map((item, i) => i ? item : { ...item, values: [5, 0, 0] }) })),
  donutSmall: error(() => render({ mark: 'donut', categories: parts, items: donuts }, { ...frame, height: 120 })),
}));
""")
        self.assertIn("same parts in the same order", found["parts"])
        self.assertIn("falls below zero", found["negative"])
        self.assertIn("2 to 6 parts", found["seven"])
        self.assertIn("carries `series", found["valuesOnStack"])
        self.assertIn("keeps one colour a part", found["focus"])
        self.assertIn("draws no stack", found["percentColumn"])
        self.assertIn("already a share", found["percentDonut"])
        self.assertIn("draws no donut", found["centreColumn"])
        self.assertIn("not one of the categories", found["centreUnknown"])
        self.assertIn("no scale to rule", found["donutReference"])
        self.assertIn("one scale already", found["donutOwn"])
        self.assertIn("two or more above 0", found["donutEmpty"])
        self.assertIn("too small to read", found["donutSmall"])

    def test_a_page_counts_every_part_of_every_stack(self):
        run_node(PRELUDE + STACKS + """
const page = { id: 'p', type: 'panels', form: 'small-multiples', commentary: 'below', takeaway: false,
  why: 'Six regions answer one question, and only a stack a year in each shows the mix moving',
  settles: { kind: 'comparison', what: 'journeys by ticket type and region, FY23 to FY26' }, adds: 'The points say why one region moved',
  title: 'Only the East moved its riders to day tickets', exhibit: { heading: 'Journeys by ticket type and region', unit: '%', mark: 'stacked-column', percent: true, categories: years, items: stacked },
  points: [{ lead: 'One region moved', text: 'The East moved a third of its riders to day tickets in three years.' }, { lead: 'Why', text: 'It was the only region recast to a train every twenty minutes.' }] };
const slide = compilePage(page);
assert.equal(slide.exhibit.type, 'chart.small-multiples');
assert.equal(plottedValues([slide.exhibit], { printed: true }), 6 * 3 * 4, 'a value a part a category a panel');
console.log('{}');
""")


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
assert.equal(plottedValues([slide.exhibit], { printed: true }), 32, 'every panel counts towards the evidence');
assert.ok(compilePage({ ...page, exhibit: { ...page.exhibit, items: items.slice(0, 4) } }), "four cuts are the writer's choice");
assert.throws(() => compilePage({ ...page, exhibit: undefined, exhibits: [page.exhibit, page.exhibit] }), /carries 1 exhibit/);
assert.throws(() => compilePage({ ...page, commentary: 'captions' }), /`commentary` is one of/);
console.log('{}');
""")

    def test_a_before_and_after_trellis_is_not_a_metric_pair(self):
        # Two shared categories across eight panels plot sixteen numbers; the panels check read the trellis as one series of two.
        run_node(PRELUDE + self.PAGE + """
const ends = ['FY23', 'FY26'], pairs = items.map((item) => ({ ...item, values: [item.values[0], item.values.at(-1)] }));
const slide = compilePage({ ...page, exhibit: { ...page.exhibit, categories: ends, items: pairs } });
assert.equal(slide.exhibit.type, 'chart.small-multiples');
assert.equal(plottedValues([slide.exhibit], { printed: true }), 16);
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
