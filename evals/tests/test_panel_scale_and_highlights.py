"""Six gaps found by re-authoring a fifty-six-page deck through its page types.

Each one either failed a page the author had written reasonably, or passed it
looking wrong:

- Two bar panels in the same unit crashed with "x-axis bounds must contain
  every plotted value": the shared scale was taken from one panel, and a
  negative bar fell outside it.
- A highlighted member of a horizontal bar chart was a pale band behind a dark
  bar, so the subject of a forty-member ranking was hard to find.
- A callout on one panel reserved the same band over its neighbours, which in
  another unit stood empty and were flagged.
- A distribution could not take a callout at its subject at all.
- Three callouts on a bridge failed "give the chart more height", which an
  author cannot do.
- Three ten-period charts in a row failed on plot width and on "FY17" being
  wider than its column.

Each test builds the case that failed and reads the composed scene.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage, describeTypes } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { nativeChartSpec } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const S = { kind: 'comparison', what: 'The operator annual reports' };
const base = { takeaway: false, why: 'The page type fits the claim this page makes', settles: S };
const compose = (pages) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: pages.map((p, i) => compilePage(p, i)) }, '.').deck.slides;
const error = (fn) => { try { fn(); return null; } catch (e) { return (e.pageErrors ?? [e.message]).join(' | '); } };
const years = ['FY17','FY18','FY19','FY20','FY21','FY22','FY23','FY24','FY25','FY26'];
const marksOf = (nodes, i) => nodes.filter((n) => n.role === 'chart-mark' && n.id.includes(`exhibit-${i}:`));
const caption = (i) => `Panel ${i} shows how the line changed across the ten years of the run`;
"""


class SharedScaleTests(unittest.TestCase):
    def test_bar_panels_in_one_unit_share_a_scale_that_holds_every_value(self):
        # A column in another unit beside two bar panels in "% y/y" with
        # negative bars: the bars were pinned to a zero minimum and crashed.
        result = run_node(PRELUDE + """
const bars = (heading, values, extra = {}) => ({ type: 'chart.bar', heading, unit: '% y/y', categories: ['North', 'South', 'East', 'West', 'Coast'], series: [{ name: 'Change', values }], caption: caption(heading), ...extra });
const page = { ...base, id: 'p', type: 'panels', form: 'row', commentary: 'captions', title: 'Service fell hardest on the coast line while the north grew',
  exhibits: [{ type: 'chart.column', heading: 'Journeys by quarter', unit: 'million', categories: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Journeys', values: [23.5, 22.5, 18.5, 13.0] }], caption: caption('journeys') },
    bars('Train-km, September', [11.1, -0.6, -2.1, -9.9, -18.3]),
    bars('Seats, September', [9.8, 7.4, 1.8, -6.8, -15.2], { referenceLines: [{ value: 12, label: 'Plan' }] })] };
const [slide] = compose([page]);
const scale = (i) => { const m = marksOf(slide.nodes, i); const east = m.find((n) => n.data.category === 'North'); const west = m.find((n) => n.data.category === 'Coast');
  return { perUnit: east.frame.width / (i === 1 ? 11.1 : 9.8), coastPerUnit: west.frame.width / (i === 1 ? 18.3 : 15.2) }; };
console.log(JSON.stringify({ one: scale(1), two: scale(2) }));
""")
        # One pixel scale across the two bar panels, negatives and the
        # reference line included.
        self.assertAlmostEqual(result['one']['perUnit'], result['two']['perUnit'], delta=0.05)
        self.assertAlmostEqual(result['one']['coastPerUnit'], result['two']['coastPerUnit'], delta=0.05)


class HighlightTests(unittest.TestCase):
    def test_a_highlighted_bar_is_drawn_in_the_accent_everywhere(self):
        result = run_node(PRELUDE + """
const members = Array.from({ length: 40 }, (_, i) => 'Op' + String(i + 1).padStart(2, '0'));
const distribution = { ...base, id: 'd', type: 'ranking', form: 'distribution', commentary: 'rail', rail: 'The subject sits thirty-first of forty, in the lower quartile of the field on connections.',
  title: 'The subject sits thirty-first of forty operators on connections', exhibit: { heading: 'Connections index', categories: members,
    series: [{ name: 'Index', values: members.map((_, i) => 265 - i * 4) }], highlights: [{ category: 'Op31' }] } };
const aligned = { ...base, id: 'a', type: 'ranking', form: 'aligned-bars', commentary: 'below', points: ['The subject earns the widest margin.', 'It fills the fewest seats.'],
  highlight: ['widest margin', 'fewest seats'], title: 'The subject earns the widest margin on the emptiest trains of eight',
  exhibit: { categories: members.slice(0, 8), highlights: [{ category: 'Op02' }], series: [
    { name: 'Margin', unit: '%', values: [20, 15, 12, 10, 9, 8, 6, 5] },
    { name: 'Load factor', unit: '%', values: [85, 78, 83, 86, 85, 88, 87, 82] },
    { name: 'Journeys', unit: 'million', values: [22, 53, 93, 122, 29, 43, 22, 42] }] } };
const [d, a] = compose([distribution, aligned]);
const accent = (n) => n.style?.fill?.tokenId === 'color.accent';
const lit = d.nodes.filter((n) => n.role === 'chart-mark' && accent(n)).map((n) => n.data.category);
const bands = d.nodes.filter((n) => n.role === 'chart-highlight').length + a.nodes.filter((n) => n.role === 'chart-highlight').length;
const litAligned = a.nodes.filter((n) => n.role === 'chart-mark' && accent(n)).map((n) => n.data.category);
// Forty rows ten pixels apart: labelled every other row at full height, the subject always.
const labels = d.nodes.filter((n) => n.role === 'category-label');
const values = d.nodes.filter((n) => n.role === 'data-label');
// Two fleet types on one bar chart are both lit, and the native chart says so.
const props = { categories: ['A', 'B', 'C', 'D', 'E'], series: [{ name: 'On order', values: [235, 54, 35, 35, 8] }], highlights: [{ category: 'A' }, { category: 'C' }], annotations: [], referenceLines: [] };
const frame = { x: 0, y: 0, width: 560, height: 360 };
const nodes = REGISTRY.get('chart.bar').render({ id: 'b', frame, props }).nodes;
const spec = nativeChartSpec('chart.bar', props, frame, nodes);
const bar = d.nodes.find((n) => n.role === 'chart-mark' && n.data.category === 'Op31');
const distSpec = nativeChartSpec('chart.bar', { ...distribution.exhibit, annotations: [], referenceLines: [] }, d.nodes.find((n) => n.role === 'chart-mark').frame, d.nodes);
console.log(JSON.stringify({ lit, bands, litAligned, labels: labels.map((n) => n.text), labelHeights: labels.map((n) => n.frame.height), values: values.length,
  twoLit: nodes.filter((n) => n.role === 'chart-mark' && accent(n)).map((n) => n.data.category), native: spec && spec.highlightIndices,
  hiddenCategories: distSpec?.hiddenCategoryIndices ?? null, hiddenLabels: distSpec?.hiddenLabelIndices ?? null }));
""")
        self.assertEqual(result['lit'], ['Op31'])
        self.assertEqual(result['bands'], 0, 'the pale band is gone; the bar carries the highlight')
        self.assertEqual(result['litAligned'], ['Op02'] * 3, 'lit in every column')
        self.assertIn('Op31', result['labels'])
        self.assertLess(len(result['labels']), 40)
        self.assertGreaterEqual(len(result['labels']), 18)
        self.assertTrue(all(h >= 12 for h in result['labelHeights']), 'labels set at a full line, not squeezed into a 7px row')
        self.assertEqual(result['values'], len(result['labels']))
        self.assertEqual(result['twoLit'], ['A', 'C'])
        self.assertEqual(result['native'], [0, 2])
        # The native chart blanks the names and values the scene left out, never the subject's.
        self.assertIsNotNone(result['hiddenCategories'])
        self.assertNotIn(30, result['hiddenCategories'])
        self.assertEqual(result['hiddenCategories'], result['hiddenLabels'])


class CalloutBandTests(unittest.TestCase):
    def test_a_callout_on_one_panel_leaves_its_neighbour_in_another_unit_alone(self):
        result = run_node(PRELUDE + """
const column = (heading, unit, values, annotations = []) => ({ type: 'chart.column', heading, unit, categories: years, series: [{ name: heading, values }], annotations, caption: caption(heading) });
const page = (unit) => ({ ...base, id: 'p' + unit.length, type: 'panels', form: 'row', commentary: 'captions', title: 'Journeys and train-km both remain below their FY19 peaks',
  exhibits: [column('Journeys', 'million', [56, 58, 59, 56, 7, 20, 44, 52, 54, 53], [{ category: 'FY21', text: '6.6m in the closure year' }]),
    column('Train-km', unit, [368, 377, 391, 367, 64, 160, 284, 345, 360, 356])] });
const [other, same] = compose([page('bn'), page('million')]);
const top = (slide, i) => Math.min(...marksOf(slide.nodes, i).map((n) => n.frame.y));
const base_ = (slide, i) => Math.max(...marksOf(slide.nodes, i).map((n) => n.frame.y + n.frame.height));
const perUnit = (slide, i, v) => { const m = marksOf(slide.nodes, i).find((n) => n.data.category === 'FY19'); return m.frame.height / v; };
console.log(JSON.stringify({ otherTops: [top(other, 0), top(other, 1)], otherBases: [base_(other, 0), base_(other, 1)],
  samePerUnit: [perUnit(same, 0, 59), perUnit(same, 1, 391)], sameBases: [base_(same, 0), base_(same, 1)] }));
""")
        # Another unit: the plain panel's plot rises into the band the callout
        # needed on its neighbour; the baselines still meet.
        self.assertLess(result['otherTops'][1], result['otherTops'][0] - 40)
        self.assertEqual(result['otherBases'][0], result['otherBases'][1])
        # One unit, one scale: the band stays shared so a unit is one height.
        self.assertAlmostEqual(result['samePerUnit'][0], result['samePerUnit'][1], delta=0.01)
        self.assertEqual(result['sameBases'][0], result['sameBases'][1])

    def test_a_distribution_takes_one_callout_beside_its_subject(self):
        result = run_node(PRELUDE + """
const members = Array.from({ length: 40 }, (_, i) => 'Op' + String(i + 1).padStart(2, '0'));
const page = (subject, annotations) => ({ ...base, id: 'd' + subject, type: 'ranking', form: 'distribution', commentary: 'beside', points: ['The subject fell sixteen places in a year.', 'It still leads its region.'],
  highlight: ['sixteen places', 'leads its region'], title: 'The subject fell to thirty-first of forty but still leads its region',
  exhibit: { heading: 'Connections index', categories: members, series: [{ name: 'Index', values: members.map((_, i) => 265 - i * 4) }], highlights: [{ category: subject }], annotations } });
const note = (c) => [{ category: c, text: 'Down from fifteenth a year earlier' }];
const slides = compose(['Op01', 'Op31', 'Op40'].map((c) => page(c, note(c))));
const boxes = slides.map((s) => { const box = s.nodes.find((n) => n.role === 'annotation-surface');
  const clash = s.nodes.filter((n) => n.role === 'chart-mark').some((m) => !(box.frame.x + box.frame.width <= m.frame.x || m.frame.x + m.frame.width <= box.frame.x || box.frame.y + box.frame.height <= m.frame.y || m.frame.y + m.frame.height <= box.frame.y));
  return { clash }; });
console.log(JSON.stringify({ boxes, second: error(() => compilePage(page('Op31', [...note('Op31'), { category: 'Op01', text: 'The field leader' }]))) }));
""")
        self.assertEqual(result['boxes'], [{'clash': False}] * 3)
        self.assertIn('a distribution carries one callout', result['second'])


class BridgeCalloutTests(unittest.TestCase):
    def test_three_callouts_on_a_bridge_beside_a_rail_render_and_below_takes_two(self):
        result = run_node(PRELUDE + """
const notes = [{ category: 'Fares', text: 'Yield and volume lifted fare income by 2.9m' },
  { category: 'Staff', text: 'Staff costs up 11% as headcount reached 5,900' }, { category: 'Other costs', text: 'Access, energy and leasing charges rose' }];
const page = (commentary, annotations, extra) => ({ ...base, id: 'b' + commentary + annotations.length, type: 'bridge', form: 'waterfall', commentary, ...extra,
  title: 'Operating profit rose only GBP0.5m this year as staff and other costs absorbed the gains',
  exhibit: { heading: 'Operating profit, FY25 to FY26', unit: 'm', categories: ['FY25', 'Fares', 'Energy', 'Depreciation', 'Staff', 'Other costs', 'FY26'],
    values: [22197, 2915, 1374, 1602, -2129, -3237, 22722], totals: [0, 6], annotations } });
const rail = { rail: 'Fares, cheaper energy and longer train lives added 5.9m; staff and other costs took 5.4m of it, and staff costs will recur.' };
const below = { points: ['Fares and energy added 5.9m this year.', 'Staff and other costs took 5.4m of it.'], highlight: ['5.9m', '5.4m'] };
const [r] = compose([page('rail', notes, rail)]);
const [b] = compose([page('below', notes.slice(0, 2), below)]);
console.log(JSON.stringify({ rail: r.nodes.filter((n) => n.role === 'annotation-surface').length, below: b.nodes.filter((n) => n.role === 'annotation-surface').length,
  three: error(() => compilePage(page('below', notes, below))) }));
""")
        self.assertEqual(result['rail'], 3)
        self.assertEqual(result['below'], 2)
        self.assertIn('carries 2 callouts at most', result['three'])

    def test_three_callouts_keep_the_band_on_a_bridge_beside_a_column(self):
        # The bridge as it sits beside a rail under a two-line title: 747px by
        # 516. It failed "give the chart more height" (the endpoint label row
        # was taken after the frame had compacted its bands), and a little
        # shorter the third callout failed its neighbour by two pixels of
        # compact-band gap and went to a rail that squeezed "Revenue" out.
        result = run_node(PRELUDE + """
const props = { heading: 'Operating profit, FY25 to FY26', unit: 'million', categories: ['FY25', 'Revenue', 'Energy', 'Depreciation', 'Employees', 'All other costs', 'FY26'],
  values: [22197, 2915, 1374, 1602, -2129, -3237, 22722], totals: [0, 6], annotations: [
  { category: 'Revenue', text: 'Yield and volume lifted revenue 2.9m' }, { category: 'Employees', text: 'Staff costs up 11% as headcount reached 5,900' },
  { category: 'All other costs', text: 'Access, energy and leasing charges rose' }] };
const out = {};
for (const height of [516, 440]) {
  const nodes = REGISTRY.get('chart.waterfall').render({ id: 'w', frame: { x: 461, y: 152, width: 747, height }, props }).nodes;
  const boxes = nodes.filter((n) => n.role === 'annotation-surface');
  out[height] = boxes.map((n) => n.data.evidencePlacement);
  for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) assert.ok(a.frame.y + a.frame.height <= b.frame.y || b.frame.y + b.frame.height <= a.frame.y || a.frame.x + a.frame.width <= b.frame.x || b.frame.x + b.frame.width <= a.frame.x);
}
console.log(JSON.stringify(out));
""")
        self.assertEqual(result, {'516': ['band'] * 3, '440': ['band'] * 3})


class PanelWidthTests(unittest.TestCase):
    def test_three_ten_period_panels_fit_a_row_and_label_the_same_periods_natively(self):
        result = run_node(PRELUDE + """
const line = (heading, a, b) => ({ type: 'chart.line', heading, unit: '%', categories: years, series: [{ name: heading + ' actual', values: a }, { name: heading + ' plan', values: b }], caption: caption(heading) });
const up = years.map((_, i) => 60 + i), down = years.map((_, i) => 66 - i);
const sequence = { ...base, id: 's', type: 'panels', form: 'sequence', commentary: 'captions', title: 'Fares outgrew cost, cutting the breakeven load from 66% to 54%',
  exhibits: [line('Yield', up, down), line('Load', up, down), line('Margin', up, down)] };
const column = (heading, values) => ({ type: 'chart.column', heading, unit: 'million', categories: years, series: [{ name: heading, values }], caption: caption(heading) });
const row = { ...base, id: 'r', type: 'panels', form: 'row', commentary: 'captions', title: 'Journeys, seats and freight all remain below their FY19 peaks',
  exhibits: [column('Journeys', up), column('Seats', down), column('Freight', up)] };
const [s, r] = compose([sequence, row]);
const labels = (slide) => slide.nodes.filter((n) => n.role === 'category-label').map((n) => n.text);
const legends = s.nodes.filter((n) => n.role === 'legend-label').length;
// The native chart prints the periods the scene printed.
const props = { categories: years, series: [{ name: 'a', values: up }, { name: 'b', values: down }], legend: true, endLabels: false, highlights: [], annotations: [], referenceLines: [] };
const frame = { x: 0, y: 0, width: 332, height: 300 };
const nodes = REGISTRY.get('chart.line').render({ id: 'l', frame, props }).nodes;
const spec = nativeChartSpec('chart.line', props, frame, nodes);
const named = ['Northern', 'Southern', 'Atlantic', 'Pacifica', 'Midlands', 'Highland', 'Lowlands', 'Eastward', 'Westward', 'Frontier'];
const namedRow = { ...row, id: 'n', exhibits: row.exhibits.map((ex) => ({ ...ex, categories: named })) };
console.log(JSON.stringify({ sequence: labels(s), row: labels(r), legends, hidden: spec.hiddenCategoryIndices, drawn: nodes.filter((n) => n.role === 'category-label').map((n) => n.text),
  named: error(() => compose([namedRow])), catalogue: describeTypes() }));
""")
        self.assertEqual(result['sequence'], ['FY17', 'FY20', 'FY23', 'FY26'] * 3)
        self.assertEqual(result['row'], ['FY17', 'FY20', 'FY23', 'FY26'] * 3)
        self.assertEqual(result['legends'], 6, 'series named in a legend over each narrow panel, not at the line ends')
        self.assertEqual(result['drawn'], ['FY17', 'FY20', 'FY23', 'FY26'])
        self.assertEqual(result['hidden'], [1, 2, 4, 5, 7, 8])
        # Names are never dropped; the refusal says what a panel holds.
        self.assertIn('Column names are wider than their columns', result['named'])
        self.assertIn('holds about', result['named'])
        self.assertRegex(result['catalogue'], r'a column panel holds about \d+ named columns .* in a row of two, \d+ in a row of three and \d+ in a row of four')


class NativeChartAgreementTests(unittest.TestCase):
    def test_the_native_chart_prints_the_labels_and_accent_the_scene_drew(self):
        # A ten-year line thinned to four periods came out of PowerPoint with
        # all ten, and a forty-row ranking with all forty values over one
        # another; the export audit read them as text the page never planned.
        try:
            import pptx  # noqa: F401
        except ImportError:
            self.skipTest("python-pptx is not installed")
        import json
        import subprocess
        import sys
        import tempfile
        from pathlib import Path
        from node_probe import RUNTIME
        from pptx import Presentation
        scene = run_node("""
import { toDeckPlan } from './skills/professional-slides/runtime/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const members = Array.from({ length: 40 }, (_, i) => 'Op' + String(i + 1).padStart(2, '0'));
const years = ['FY17','FY18','FY19','FY20','FY21','FY22','FY23','FY24','FY25','FY26'];
const spec = { schema: 'professional-slides.deck/v3', id: 'n', cover: { title: 'x' }, slides: [
  { title: 'The subject sits thirty-first of forty operators on connections', layout: 'exhibit-full',
    exhibit: { type: 'chart.bar', heading: 'Connections index', categories: members, series: [{ name: 'Index', values: members.map((_, i) => 265 - i * 4) }], highlights: [{ category: 'Op31' }] } },
  { title: 'Load factor held while the breakeven fell', layout: 'two-up',
    exhibits: ['Eastern line', 'Western line', 'Coast line'].map((heading, k) => ({ type: 'chart.line', heading, unit: '%', categories: years, legend: true, endLabels: false,
      series: [{ name: 'Actual', values: years.map((_, i) => 60 + i + k) }, { name: 'Breakeven', values: years.map((_, i) => 66 - i) }] })) }] };
console.log(JSON.stringify(planDeck(toDeckPlan(spec, '.')).deck));
""")
        with tempfile.TemporaryDirectory() as tmp:
            scene_path, pptx_path = Path(tmp) / "scene.json", Path(tmp) / "n.pptx"
            scene_path.write_text(json.dumps(scene))
            subprocess.run([sys.executable, str(RUNTIME / "emit" / "emit_pptx.py"), str(scene_path), str(pptx_path)],
                           check=True, capture_output=True)
            slides = Presentation(pptx_path).slides
            ranking = next(s.chart for s in slides[-2].shapes if s.has_chart)
            # A blank category is written as an empty <c:v/>; python-pptx reads it back as "None".
            shown = lambda chart: [c for c in chart.plots[0].categories if c not in ("", "None")]
            names = shown(ranking)
            drawn = [n["text"] for n in scene["slides"][-2]["nodes"] if n["role"] == "category-label"]
            self.assertEqual(names, drawn)
            self.assertIn("Op31", drawn)
            xml = ranking._chartSpace.xml
            self.assertGreaterEqual(xml.count('<c:delete val="1"/>'), 40 - len(drawn), 'the values the scene left out are deleted')
            lines = [s.chart for s in slides[-1].shapes if s.has_chart]
            for chart in lines:
                self.assertEqual(shown(chart), ["FY17", "FY20", "FY23", "FY26"])


if __name__ == '__main__':
    unittest.main()
