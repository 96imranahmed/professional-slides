"""Icons over headings: a chart panel's heading (`headingIcon`) and a table column's header (`headerIcon`).

A device audit found strong pages setting an icon over each column or chart
panel heading, as cards already set one over their titles, while a chart's
heading took a text badge only and a table header a player's logo. The icon
stands in the heading band, so peers sharing the band keep their headings and
rules level, and every label of a table's header sits on one line under it.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { renderTable } from './skills/professional-slides/runtime/tables.mjs';
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const frame = { x: 60, y: 160, width: 360, height: 420 };
const chart = (props) => REGISTRY.get('chart.column').render({ id: 'c', frame, props: { categories: ['FY24', 'FY25', 'FY26'], series: [{ name: 'On time', values: [81, 86, 92] }], ...props } }).nodes;
const header = (props) => REGISTRY.get('chart.column').measureHeader({ frame, props: { categories: ['FY24'], series: [], ...props } });
const table = (columns, extra = {}) => renderTable({ id: 't', frame: { x: 60, y: 160, width: 1160, height: 420 }, props: { columns, rows: [['Dales', '12', '1'], ['Valley', '46', '3']], ...extra } }).nodes;
"""


class ChartHeadingIconTests(unittest.TestCase):
    def test_an_icon_stands_over_the_heading_inside_its_band(self):
        run_node(PRELUDE + """
const plain = chart({ heading: 'Trains on time', unit: '%' });
const iconed = chart({ heading: 'Trains on time', unit: '%', headingIcon: 'clock' });
const glyph = iconed.find((n) => n.role === 'chart-heading-icon-glyph');
const ring = iconed.find((n) => n.role === 'chart-heading-icon-ring');
const heading = iconed.find((n) => n.role === 'section-heading');
assert.equal(glyph.data.icon, 'clock');
assert.ok(ring, 'a card\\'s outline icon: a ring round the glyph');
assert.equal(ring.frame.x, heading.frame.x, 'set at the heading\\'s left edge');
assert.ok(ring.frame.y + ring.frame.height <= heading.frame.y, 'over the heading');
// The band grows by the icon, so the plot below starts lower and a peer sharing the band keeps its rule level.
const top = (nodes) => Math.min(...nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.y));
assert.ok(header({ heading: 'Trains on time', headingIcon: 'clock' }).height > header({ heading: 'Trains on time' }).height);
const rule = (nodes) => nodes.find((n) => n.role === 'section-heading-rule').y1 ?? nodes.find((n) => n.role === 'section-heading-rule').frame.y;
assert.ok(rule(iconed) > rule(plain));
console.log('{}');
""")

    def test_what_an_icon_cannot_stand_over_is_refused(self):
        found = run_node(PRELUDE + """
const page = { id: 'p', type: 'panels', form: 'row', commentary: 'below', takeaway: false,
  why: 'Three measures answer one question, a panel each', settles: { kind: 'comparison', what: 'three measures, FY24 to FY26' }, adds: 'The points say which moved first',
  title: 'The line ran on time, emptier and richer', points: [{ lead: 'First', text: 'Punctuality rose from 81% to 92% in two years.' }, { lead: 'Then', text: 'Crowding fell as the peak spread out.' }],
  exhibits: ['clock', 'people'].map((icon, i) => ({ type: 'chart.column', heading: ['Trains on time', 'Trains over capacity'][i], headingIcon: icon, unit: '%', categories: ['FY22', 'FY23', 'FY24', 'FY25', 'FY26'], series: [{ name: 'Share', values: [80 - i * 55, 80 - i * 55, 81 - i * 60, 86 - i * 70, 92 - i * 80] }], highlights: [{ category: 'FY26' }] })) };
const slide = compilePage(page);
console.log(JSON.stringify({
  compiled: slide.exhibits.map((ex) => ex.headingIcon),
  mixed: error(() => compilePage({ ...page, exhibits: [page.exhibits[0], { ...page.exhibits[1], headingIcon: undefined }] })),
  unknown: error(() => compilePage({ ...page, exhibits: page.exhibits.map((ex) => ({ ...ex, headingIcon: 'locomotive' })) })),
  headless: error(() => chart({ headingIcon: 'clock' })),
  unknownRender: error(() => chart({ heading: 'Trains on time', headingIcon: 'locomotive' })),
}));
""")
        self.assertEqual(found["compiled"], ["clock", "people"])
        self.assertIn("every one carries an icon or none does", found["mixed"])
        self.assertIn("Unknown heading icon: locomotive", found["unknown"])
        self.assertIn("--icons", found["unknown"])
        self.assertIn("has none", found["headless"])
        self.assertIn("Unknown chart heading icon", found["unknownRender"])

    def test_a_table_exhibit_is_told_where_its_icons_go(self):
        found = run_node(PRELUDE + """
const page = { id: 'p', type: 'lookup', form: 'table', commentary: 'in-exhibit', takeaway: false,
  why: 'The reader looks up an option and reads across', settles: { kind: 'structure', what: 'cost and time of two options' }, adds: 'Nothing',
  title: 'Two options compared', exhibit: { headingIcon: 'money', columns: ['Option', 'Cost, £m', 'Years'], rows: [['Dales', '12', '1'], ['Valley', '46', '3']] } };
console.log(JSON.stringify({ table: error(() => compilePage(page)) }));
""")
        self.assertIn("columns[].headerIcon", found["table"])


class TableHeaderIconTests(unittest.TestCase):
    def test_every_label_sits_on_one_line_under_the_icons(self):
        run_node(PRELUDE + """
const columns = ['Option', { label: 'Cost, £m', headerIcon: 'money', align: 'right' }, { label: 'Years', headerIcon: 'clock' }];
const nodes = table(columns);
const icons = nodes.filter((n) => n.role === 'table-header-icon-glyph');
assert.deepEqual(icons.map((n) => n.data.icon), ['money', 'clock']);
assert.ok(!nodes.some((n) => n.role === 'table-header-icon-ring'), 'the glyph alone, as a table header is lighter than a card');
const labels = nodes.filter((n) => n.role === 'table-header-text');
assert.equal(new Set(labels.map((n) => n.frame.y)).size, 1, 'one baseline, the column with no icon included');
assert.ok(icons.every((n) => n.frame.y + n.frame.height <= labels[0].frame.y));
// A right-aligned column sets its icon at the right, over its figures.
const cost = labels.find((n) => n.text === 'Cost, £m'), money = icons[0];
assert.ok(Math.abs((money.frame.x + money.frame.width) - (cost.frame.x + cost.frame.width)) < 8);
// The header is taller by the icon's band than the same table without icons.
const head = (ns) => Math.min(...ns.filter((n) => n.role === 'table-header-text').map((n) => n.frame.y));
assert.ok(head(nodes) > head(table(['Option', 'Cost, £m', 'Years'])));
console.log('{}');
""")

    def test_a_filled_header_reverses_its_icons(self):
        run_node(PRELUDE + """
const columns = ['Option', { label: 'Cost, £m', headerIcon: 'money' }, 'Years'];
const glyph = (extra) => table(columns, extra).find((n) => n.role === 'table-header-icon-glyph');
assert.equal(glyph({ treatment: 'standard' }).style.stroke.tokenId, 'color.onPrimary', 'white on the filled band');
assert.equal(glyph({ headerBand: false }).style.stroke.tokenId, 'color.componentPrimary', 'the primary over an open header');
console.log('{}');
""")

    def test_what_a_header_cannot_carry_is_refused(self):
        found = run_node(PRELUDE + """
console.log(JSON.stringify({
  unknown: error(() => table(['Option', { label: 'Cost, £m', headerIcon: 'coins' }, 'Years'])),
  unlabelled: error(() => table(['Option', { label: '', headerIcon: 'money' }, 'Years'])),
  chevron: error(() => table(['Option', { label: 'Cost, £m', headerIcon: 'money' }, 'Years'], { headerShape: 'chevron' })),
}));
""")
        self.assertIn("Unknown column header icon: coins", found["unknown"])
        self.assertIn("has none", found["unlabelled"])
        self.assertIn("chevron header has no room", found["chevron"])


if __name__ == "__main__":
    unittest.main()
