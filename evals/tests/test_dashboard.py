"""A dashboard: two to six headed exhibits on a grid of areas (page-types.mjs dashboardGrid, compose-arrangements.mjs exhibitDashboard).

A hero chart beside its satellites, a map beside a table, a strip of figures
over them: panels form `dashboard` places each exhibit in the area it names,
the tracks as wide and tall as their weights, and budgets the strip with the
grid. Every cell names what it shows; areas overlap nowhere.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const quarters = ['Q1 FY25', 'Q2 FY25', 'Q3 FY25', 'Q4 FY25', 'Q1 FY26', 'Q2 FY26', 'Q3 FY26', 'Q4 FY26'];
const hero = { type: 'chart.column', heading: 'Journeys by quarter', unit: 'million', categories: quarters, series: [{ name: 'Peak', values: [6.1, 6, 6.2, 5.9, 6.2, 6.1, 6.3, 6] }, { name: 'Off-peak', values: [5.4, 5.6, 5.5, 5.7, 5.9, 6.1, 6, 6.3] }], area: { column: 1, row: 1, rowSpan: 2 } };
const bars = { type: 'chart.bar', heading: 'Revenue growth', unit: '%', categories: ['Dales', 'Valley', 'City', 'Eastern', 'Coast'], series: [{ name: 'Growth', values: [9.1, 7.4, 5.2, 3.3, 0.8] }], area: { column: 2, row: 1 } };
const table = { type: 'table', heading: 'On time', columns: ['Line', 'On time', 'Change'], rows: [['Dales', '93.1%', '+2.0 pts'], ['Valley', '92.4%', '+1.6 pts'], ['City', '91.8%', '+0.9 pts'], ['Coast', '88.2%', '-0.4 pts']], area: { column: 2, row: 2 } };
const page = { id: 'd', type: 'panels', form: 'dashboard', commentary: 'none', takeaway: false, why: 'Four measures of one year read together at a glance',
  settles: { kind: 'comparison', what: 'journeys by quarter and revenue and punctuality by line' }, title: 'Off-peak growth carried FY26, led by the most punctual lines',
  metrics: [{ value: '48.2m', label: 'Journeys' }, { value: '£612m', label: 'Revenue' }, { value: '91.5%', label: 'On time' }],
  grid: { columns: [2, 1], rows: [1, 1.15] }, exhibits: [hero, bars, table], source: 'Source: illustrative' };
const compose = (pages) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: pages.map((p, i) => compilePage(p, i)) }, '.').deck.slides;
"""


class CompileTests(unittest.TestCase):
    def test_the_grid_places_each_exhibit_in_its_area(self):
        run_node(PRELUDE + """
const slide = compilePage(page);
assert.equal(slide.arrange, 'dashboard');
assert.deepEqual(slide.grid.columns, [2, 1]);
assert.deepEqual(slide.grid.areas[0], { column: 0, row: 0, columnSpan: 1, rowSpan: 2 });
// An exhibit with no area takes the next free cell in reading order.
const auto = compilePage({ ...page, metrics: undefined, grid: { columns: 2, rows: 2 }, exhibits: [hero, { ...bars, area: undefined }, { ...table, area: undefined }] });
assert.deepEqual(auto.grid.areas.slice(1), [{ column: 1, row: 0, columnSpan: 1, rowSpan: 1 }, { column: 1, row: 1, columnSpan: 1, rowSpan: 1 }]);
console.log('{}');
""")

    def test_a_board_that_cannot_be_read_is_refused(self):
        found = run_node(PRELUDE + """
console.log(JSON.stringify({
  overlap: error(() => compilePage({ ...page, exhibits: [hero, { ...bars, area: { column: 1, row: 1 } }, table] })),
  outside: error(() => compilePage({ ...page, exhibits: [hero, { ...bars, area: { column: 3, row: 1 } }, table] })),
  heading: error(() => compilePage({ ...page, exhibits: [hero, { ...bars, heading: undefined }, table] })),
  rows: error(() => compilePage({ ...page, grid: { columns: 2, rows: 3 } })),
  seven: error(() => compilePage({ ...page, metrics: undefined, grid: { columns: 4, rows: 2 }, exhibits: Array.from({ length: 7 }, (_, i) => ({ ...bars, area: undefined, heading: `Panel ${i}` })) })),
  full: error(() => compilePage({ ...page, metrics: undefined, grid: { columns: 2, rows: 1 }, exhibits: [{ ...hero, area: undefined }, { ...bars, area: undefined }, { ...table, area: undefined }] })),
  captions: error(() => compilePage({ ...page, commentary: 'captions' })),
}));
""")
        self.assertIn("overlaps another's", found["overlap"])
        self.assertIn("stays inside the 2 by 2 grid", found["outside"])
        self.assertIn("names what it shows", found["heading"])
        self.assertIn("holds 2 rows", found["rows"])
        self.assertIn("2 to 6 exhibits", found["seven"])
        self.assertIn("free cells", found["full"])
        self.assertIn("`commentary` is one of", found["captions"])


class ComposeTests(unittest.TestCase):
    def test_the_hero_spans_two_rows_under_the_strip_and_the_rail_stands_beside(self):
        run_node(PRELUDE + """
const rail = 'Off-peak journeys overtook the peak in the last quarter, and the two lines with half-hourly stations led both revenue and punctuality.';
const [slide] = compose([{ ...page, commentary: 'rail', rail, grid: { columns: [3, 2], rows: [1, 1.15] } }]);
const frameOf = (prefix) => slide.nodes.filter((n) => n.id.startsWith(prefix));
const box = (nodes) => { const xs = nodes.map((n) => n.frame); return { x: Math.min(...xs.map((f) => f.x)), y: Math.min(...xs.map((f) => f.y)), r: Math.max(...xs.map((f) => f.x + f.width)), b: Math.max(...xs.map((f) => f.y + f.height)) }; };
const strip = box(slide.nodes.filter((n) => String(n.id).includes('-metrics-')));
const heroBox = box(frameOf('d-d-exhibit-0')), barBox = box(frameOf('d-d-exhibit-1')), tableBox = box(frameOf('d-d-exhibit-2'));
assert.ok(heroBox.y > strip.b - 1, 'the board stands under the strip');
assert.ok(heroBox.b > tableBox.y + (tableBox.b - tableBox.y) / 2, 'the hero runs down into the second row');
assert.ok(barBox.b <= tableBox.y + 1, 'the satellites one above the other');
assert.ok(heroBox.r <= barBox.x + 1, 'the hero to their left');
const railNode = slide.nodes.find((n) => String(n.id).startsWith('d-d-rail'));
assert.ok(railNode && railNode.frame.x >= Math.max(barBox.r, tableBox.r) - 1, 'the rail at the right');
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
