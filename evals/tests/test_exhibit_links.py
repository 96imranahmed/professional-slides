"""Marks drawn between two exhibits: a breakout's fan and a spread's bracket.

A bar, column or segment fans out to the panel that splits it (panels form
`breakout`), and the gap between a mark in one panel and a mark in the next
is bracketed and named (`spread` on a row). Both are read off where the
charts drew their marks, so the link is placed after everything else on the
slide, and both refuse a path that would cross another mark or its figure.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { sceneCollisions } from './skills/professional-slides/runtime/validate-overlap.mjs';
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const scene = (page) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: [compilePage(page)] }, '.').deck.slides[0];
const base = { type: 'panels', commentary: 'below', takeaway: false, adds: 'The points say what the split rests on',
  points: [{ lead: 'Leisure first', text: 'Leisure returns earn £21m of the Dales line, most of it at weekends.' }, { lead: 'Seasons are small', text: 'Season tickets bring £6m, a fifth of the line.' }],
  source: 'Source: illustrative data; synthetic' };
const overview = { type: 'chart.column', heading: 'Revenue by line, FY26', unit: '£m', categories: ['City', 'Valley', 'Eastern', 'Coast', 'Dales'], series: [{ name: 'Revenue', values: [41, 33, 27, 19, 32] }] };
const detail = { type: 'chart.stacked-column', heading: 'Dales line revenue by ticket, FY26', unit: '£m', categories: ['Dales'], series: [{ name: 'Leisure return', values: [21] }, { name: 'Season', values: [6] }, { name: 'Single', values: [5] }] };
const breakout = (from) => ({ ...base, id: 'b', form: 'breakout', why: 'The board sees the network and what one line is made of',
  settles: { kind: 'share', what: 'revenue by line and the Dales line by ticket' }, title: 'The Dales line earns 21% of revenue, two-thirds of it from leisure returns',
  exhibits: [structuredClone(overview), structuredClone(detail)], breakout: { from, to: 1 } });
"""


class BreakoutTests(unittest.TestCase):
    def test_the_fan_opens_from_the_mark_to_the_enlarged_split(self):
        run_node(PRELUDE + """
const slide = scene(breakout({ exhibit: 0, category: 'Dales' }));
const fan = slide.nodes.filter((n) => n.role === 'exhibit-link-line');
assert.equal(fan.length, 2);
const dales = slide.nodes.find((n) => n.role === 'chart-mark' && n.data.category === 'Dales' && n.data.series === 'Revenue');
const [top, bottom] = fan;
assert.ok(Math.abs(top.frame.x - (dales.frame.x + dales.frame.width)) < 1 && Math.abs(top.frame.y + top.frame.height - dales.frame.y) < 1, 'the fan leaves from the mark');
const split = slide.nodes.filter((n) => n.role === 'chart-mark' && n.data.category === 'Dales' && n.data.series !== 'Revenue');
assert.ok(Math.min(...split.map((n) => n.frame.y)) < dales.frame.y, 'on its own scale the split stands taller than the mark, so the fan opens');
assert.ok(dales.data.highlighted, 'the mark broken out is lit');
assert.deepEqual(sceneCollisions(slide).filter((f) => f.roles?.includes('exhibit-link-line')), []);
console.log('{}');
""")

    def test_a_fan_that_would_cross_the_overview_is_refused(self):
        run_node(PRELUDE + """
assert.match(error(() => scene(breakout({ exhibit: 0, category: 'Valley' }))), /would cross the mark for "(Eastern|Coast|Dales)"/);
assert.match(error(() => compilePage(breakout({ exhibit: 0, category: 'Moors' }))), /one of exhibit 0's categories/);
assert.match(error(() => compilePage({ ...breakout({ exhibit: 0, category: 'Dales' }), breakout: undefined })), /names the mark it splits/);
const row = { ...breakout({ exhibit: 0, category: 'Dales' }), form: 'row' };
assert.match(error(() => compilePage(row)), /belongs to panels form "breakout"/);
console.log('{}');
""")


class SpreadTests(unittest.TestCase):
    def test_the_gap_is_bracketed_in_the_gutter_and_named(self):
        run_node(PRELUDE + """
const page = { ...base, id: 's', form: 'row', why: 'The board sees the cost today and after the plan',
  settles: { kind: 'comparison', what: 'cost per train-km at three operators, today and after the plan' }, title: 'The plan cuts Northvale cost per train-km by £2.10, level with Westmoor',
  exhibits: [{ type: 'chart.column', heading: 'Cost per train-km, FY26', unit: '£', categories: ['Westmoor', 'Southfield', 'Eastbrook', 'Northvale'], series: [{ name: 'Cost', values: [11.2, 11.6, 12.0, 13.4] }] },
    { type: 'chart.column', heading: 'Cost per train-km after the plan', unit: '£', categories: ['Northvale', 'Westmoor', 'Southfield', 'Eastbrook'], series: [{ name: 'Cost', values: [11.3, 11.2, 11.6, 12.0] }] }],
  spread: { from: { exhibit: 0, category: 'Northvale' }, to: { exhibit: 1, category: 'Northvale' }, label: '−£2.10' } };
const slide = scene(page);
const lines = slide.nodes.filter((n) => n.role === 'exhibit-link-line'), label = slide.nodes.find((n) => n.role === 'exhibit-link-label');
assert.equal(lines.length, 3);
assert.equal(label.text, '−£2.10');
const bracket = lines.find((n) => n.data.endArrow);
const marks = slide.nodes.filter((n) => n.role === 'chart-mark');
const leftPanelRight = Math.max(...marks.filter((n) => n.data.category === 'Northvale' && n.frame.x < 640).map((n) => n.frame.x + n.frame.width));
const rightPanelLeft = Math.min(...marks.filter((n) => n.frame.x > 640).map((n) => n.frame.x));
assert.ok(bracket.frame.x > leftPanelRight && bracket.frame.x < rightPanelLeft, 'the bracket stands in the gutter');
assert.deepEqual(sceneCollisions(slide).filter((f) => f.roles?.some((r) => r.startsWith('exhibit-link'))), []);
const crossing = { ...page, spread: { ...page.spread, to: { exhibit: 1, category: 'Eastbrook' } } };
assert.match(error(() => scene(crossing)), /leader would cross/);
assert.match(error(() => compilePage({ ...page, form: 'grid', exhibits: [...page.exhibits, page.exhibits[0]] })), /panels form "row"/);
console.log('{}');
""")


class SceneOrderTests(unittest.TestCase):
    def test_a_component_that_reads_the_scene_is_placed_last(self):
        run_node(PRELUDE + """
const slide = scene(breakout({ exhibit: 0, category: 'Dales' }));
const order = slide.componentInstances.map((c) => c.component);
assert.equal(order.at(-1), 'exhibit-link');
assert.deepEqual(REGISTRY.get('exhibit-link').render({ id: 'l', frame: { x: 0, y: 0, width: 100, height: 100 }, props: REGISTRY.get('exhibit-link').sample }).nodes, []);
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
