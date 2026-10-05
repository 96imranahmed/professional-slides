"""Charts as drawn: runtime/charts.mjs and the chart furniture beside it.

Axes and fitted domains, keys and legends (legends.mjs), pie and donut labels,
the combo's second scale, label thinning on a long distribution, scatters,
charts grouped in panels (chart-group.mjs), category notes and logo marks.
Every test renders the component and reads the nodes it drew.
"""
import unittest

from node_probe import run_node

RUNTIME = "./skills/professional-slides/runtime"

PAGE = """
const S = { kind: 'comparison', what: 'Company filings and press reports, 2025 to 2026' };
const base = { takeaway: false, why: 'The page compares the two firms on the same terms', settles: S, adds: 'The commentary names what the exhibit cannot: the terms behind each figure' };
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage, describeTypes } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const S = { kind: 'comparison', what: 'The operator annual reports' };
const base = { takeaway: false, why: 'The page type fits the claim this page makes', settles: S, adds: 'The commentary names the mechanism the exhibit cannot show' };
const compose = (pages) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: pages.map((p, i) => compilePage(p, i)) }, '.').deck.slides;
const error = (fn) => { try { fn(); return null; } catch (e) { return (e.pageErrors ?? [e.message]).join(' | '); } };
// The emphasised text of a composed page, runs joined across line breaks.
const lit = (slide) => slide.nodes.map((n) => (n.runs || []).map((r) => (r.text === '\\n' ? ' ' : r.accent || r.bold ? r.text.replace(/\\n/g, ' ') : ' | ')).join('')).join(' | ');
const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const regions = ['Europe', 'East Asia & Australasia', 'Americas', 'West Asia & Indian Ocean', 'Africa', 'Middle East'];
"""

QATAR = """{heading:'Qatar airline passengers',unit:'million',categories:['FY24','FY25','FY26','FY27','FY28','FY29'],
 series:[{name:'Passengers',values:[40,43.1,41.8,45.3,49.1,53.2]}],forecastFrom:'FY27'}"""


class AxisTests(unittest.TestCase):
    """A value axis holds its data, and a fitted domain leaves no dead band."""

    def check_js(self, script):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {planDeck,validateSlidePlan} from './skills/professional-slides/runtime/planner.mjs';
import {legendNodes} from './skills/professional-slides/runtime/legends.mjs';
const frame={x:0,y:0,width:1000,height:500};
const render=(id,props,box=frame)=>REGISTRY.get(id).render({id:'review',frame:box,props}).nodes;
""" + script + "\nconsole.log(JSON.stringify({accepted:true}));")
        self.assertTrue(result['accepted'])

    def test_auto_bounds_respect_data_and_constant_series(self):
        """PR #4 review: an auto-fitted axis has to contain its data, stay on the data's side of zero and not collapse on a constant series."""
        self.check_js("""
for(const values of [[100,110],[-110,-100],[0.2,0.4],[100,100]]) {
 const nodes=render('chart.line',{categories:['A','B'],series:[{name:'Revenue',values}],showValueAxis:true});
 const ticks=nodes.filter(n=>n.role==='axis-label').map(n=>Number(n.text));
 assert.ok(Math.min(...ticks)<=Math.min(...values));
 assert.ok(Math.max(...ticks)>=Math.max(...values));
 assert.ok(Math.max(...ticks)>Math.min(...ticks));
 if(values[0]>0) assert.ok(Math.min(...ticks)>0);
 if(values[0]<0) assert.ok(Math.max(...ticks)<0);
}
const bars=render('chart.column',{categories:['A','B'],series:[{name:'Value',values:[100,110]}],showValueAxis:true});
assert.ok(bars.some(n=>n.role==='axis-label' && Number(n.text)===0));
""")

    def test_negative_waterfall_labels_follow_endpoints(self):
        """PR #4 review: a falling waterfall step's label belongs below the bar's end and above its category tick."""
        self.check_js("""
const nodes=render('chart.waterfall',{categories:['Start','Drop','Total'],values:[100,-120,-20],totals:[0,2]});
for(const category of ['Drop','Total']) {
 const bar=nodes.find(n=>n.role==='chart-mark' && n.id.endsWith(category.toLowerCase()));
 const label=nodes.find(n=>n.role==='data-label' && n.id.endsWith(category.toLowerCase()));
 const tick=nodes.find(n=>n.role==='category-label' && n.text===category);
 assert.ok(label.frame.y>=bar.frame.y+bar.frame.height);
 assert.ok(label.frame.y+label.frame.height<=tick.frame.y);
}
""")

    def test_a_fitted_line_domain_does_not_stack_headroom_over_a_peak_line(self):
        """Worked example: tick headroom stacked on a reference line's room left a quarter of the plot empty above the peak line."""
        # A line with no value axis is fitted to its data, a quarter of its span
        # past the top: room for a reference line's label. The 15% the tick
        # ladder needs, added on top of it, left a quarter of the plot empty
        # above the peak line (the worked example's journeys page).
        result = run_node(f"""
import {{REGISTRY}} from './skills/professional-slides/runtime/registry.mjs';
const frame={{x:60,y:152,width:1160,height:516}};
const props={{categories:['FY17','FY18','FY19','FY20','FY21','FY22','FY23','FY24','FY25','FY26'],
  series:[{{name:'Journeys',values:[47.2,49,51.8,52.4,14.9,31.6,42.8,46.1,47.5,48.3]}}],referenceLines:[{{value:52.4,label:'FY20 peak 52.4m'}}],dataLabels:true}};
const nodes=REGISTRY.get('chart.line').render({{id:'c',frame,props}}).nodes;
const line=nodes.find(n=>n.role==='chart-reference-line');
const label=nodes.find(n=>n.role==='chart-reference-label');
const lows=nodes.filter(n=>n.role==='chart-marker'||n.role==='chart-mark').map(n=>n.frame.y+n.frame.height);
console.log(JSON.stringify({{line:line.frame.y,label:label.frame,top:frame.y,floor:Math.max(...lows)}}));
""")
        span = result["floor"] - result["top"]
        self.assertLess(result["line"] - result["top"], 0.3 * span, "the peak line sits near the top of the plot")
        self.assertGreater(result["label"]["y"], result["top"], "its label still has room above it")


class LegendAndKeyTests(unittest.TestCase):
    """A colour on a chart is named where the reader looks for it."""

    def check_js(self, script):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {planDeck,validateSlidePlan} from './skills/professional-slides/runtime/planner.mjs';
import {legendNodes} from './skills/professional-slides/runtime/legends.mjs';
const frame={x:0,y:0,width:1000,height:500};
const render=(id,props,box=frame)=>REGISTRY.get(id).render({id:'review',frame:box,props}).nodes;
""" + script + "\nconsole.log(JSON.stringify({accepted:true}));")
        self.assertTrue(result['accepted'])

    def test_line_legend_uses_plot_colors_and_narrow_frames_reject(self):
        """PR #4 review: a line or area legend's swatches took default colours rather than the plot's, and direct labels squeezed into a narrow frame."""
        self.check_js("""
for(const id of ['chart.line','chart.area']) {
 const props={categories:['A','B'],series:[{name:'One',values:[100,110]},{name:'Two',values:[105,108]}],colorIndices:[3,5]};
 const nodes=render(id,props);
 assert.deepEqual(nodes.filter(n=>n.role==='legend-swatch').map(n=>n.style.fill.tokenId),['color.chartSeries4','color.chartSeries6']);
 assert.throws(()=>render(id,{...props,directLabels:'end'},{...frame,width:300}),/plot width/);
}
""")

    def test_state_legend_cues_and_invalid_states(self):
        """PR #4 review: a state legend's five states must draw five distinct cues, and a misspelt state is refused."""
        self.check_js("""
const states=['actual','forecast','target','scenario','missing'];
const nodes=legendNodes({id:'legend',frame,props:{variant:'state',items:states.map(state=>({label:state,state,colorIndex:0}))}});
const signatures=nodes.filter(n=>n.role==='legend-swatch').map(n=>JSON.stringify([n.kind,n.geometry,n.style.fill,n.style.dash]));
assert.equal(new Set(signatures).size,5);
assert.throws(()=>legendNodes({id:'legend',frame,props:{variant:'state',items:[{label:'Typo',state:'forcast'}]}}),/State legend/);
""")

    def test_forecast_columns_are_keyed_and_divided(self):
        """Emirates deck: grey forecast columns carried no key, so nothing said what grey meant."""
        result = run_node(f"""
import {{REGISTRY}} from './skills/professional-slides/runtime/registry.mjs';
const frame={{x:72,y:162,width:1136,height:431}};
const render=extra=>REGISTRY.get('chart.column').render({{id:'c',frame,props:{{...{QATAR},legend:false,...extra}}}}).nodes;
const summary=nodes=>({{legend:nodes.filter(n=>n.role==='legend-label').map(n=>n.text),
  swatches:nodes.filter(n=>n.role==='legend-swatch').map(n=>n.style.fill.tokenId),
  divider:nodes.find(n=>n.role==='chart-forecast-divider')?.data,
  marks:nodes.filter(n=>n.role==='chart-mark').map(n=>n.frame)}});
console.log(JSON.stringify({{plain:summary(render({{}})),named:summary(render({{forecastLabel:'Required path'}})),off:summary(render({{forecastKey:false}}))}}));
""")
        plain = result['plain']
        # The composer's `legend: false` (no series list) does not remove the key.
        self.assertEqual(plain['legend'], ['Actual', 'Forecast'])
        self.assertEqual(plain['swatches'][1], 'color.chartSeries6')
        self.assertEqual(result['named']['legend'], ['Actual', 'Required path'])
        self.assertEqual(result['off']['legend'], [])
        # The dashed boundary sits between FY26 and FY27, clear of both columns.
        divider, marks = plain['divider'], plain['marks']
        self.assertEqual(divider['x1'], divider['x2'])
        self.assertGreater(divider['x1'], marks[2]['x'] + marks[2]['width'])
        self.assertLess(divider['x1'], marks[3]['x'])
        # Dropping the key keeps the non-colour cue.
        self.assertIsNotNone(result['off']['divider'])


class PieLabelTests(unittest.TestCase):
    def test_labels_take_their_measured_width_and_a_thin_slice_goes_outside(self):
        """Emirates deck: a pie's labels wrapped "75.8" one character a line in a fixed 64px box."""
        result = run_node("""
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
const frame={x:72,y:200,width:673,height:370};
const pie=REGISTRY.get('chart.pie').render({id:'p',frame,props:{labels:['International','Domestic'],values:[75.8,65.1]}}).nodes;
const donutProps={labels:['Core','Growth','New'],values:[90,6,4]};
const donut=REGISTRY.get('chart.donut').render({id:'d',frame,props:donutProps}).nodes;
const labels=nodes=>nodes.filter(n=>n.role==='data-label').map(n=>({text:n.text,placement:n.data.placement,frame:n.frame}));
const circle=donut.find(n=>n.role==='chart-segment').frame;
console.log(JSON.stringify({pie:labels(pie),donut:labels(donut),circle,
  native:nativeChartSpec('chart.donut',donutProps,frame,donut)}));
""")
        self.assertEqual([l['text'] for l in result['pie']], ['54%', '46%'])
        self.assertTrue(all(l['placement'] == 'inside' for l in result['pie']))
        # The frame is the text's width plus a margin, not a fixed 64px box.
        for label in result['pie']:
            self.assertLess(label['frame']['width'], 64)
            self.assertGreater(label['frame']['width'], label['frame']['height'])
        outside = [l for l in result['donut'] if l['placement'] == 'outside']
        self.assertEqual([l['text'] for l in outside], ['6%', '4%'])
        c = result['circle']
        for label in outside:
            f = label['frame']
            cx, cy = f['x'] + f['width'] / 2, f['y'] + f['height'] / 2
            self.assertGreater(((cx - c['x'] - c['width'] / 2) ** 2 + (cy - c['y'] - c['height'] / 2) ** 2) ** 0.5, c['width'] / 2)
        # An outside share is placed against the drawn circle, so it stays drawn.
        self.assertIsNone(result['native'])


class ComboLineTests(unittest.TestCase):
    def test_a_second_scale_line_drawn_flat_is_refused_for_panels(self):
        """Fifty-six-page re-author: a combo's second-scale line was drawn flat under two banded callouts."""
        result = run_node(PRELUDE + """
const props = (extra) => ({ categories: ['FY17','FY18','FY19','FY20','FY21','FY22','FY23','FY24','FY25','FY26'],
  series: [{ name: 'Capital expenditure', values: [12.6, 8.5, 13.4, 11.9, 5, 7.4, 5.3, 8, 13.8, 17.5] }, { name: 'Average fleet age', values: [5.2, 5.7, 6.1, 6.8, 7.3, 8.2, 9.1, 10.1, 10.7, 10.8] }],
  secondaryUnit: ' yrs', highlights: [], referenceLines: [], annotations: [], ...extra });
const render = (p) => { try { return REGISTRY.get('chart.combo').render({ id: 'c', frame: { x: 0, y: 0, width: 760, height: 430 }, props: p }).nodes; } catch (e) { return e.message; } };
// Two callouts in their band above the plot (`calloutBand: 'band'`) take the height the line's band needs.
const squeezed = render(props({ secondaryAxis: true, calloutBand: 'band', annotations: [{ category: 'FY23', text: 'Capex trough of AED5.3bn' }, { category: 'FY26', text: 'AED17.5bn, the highest in ten years' }] }));
const roomy = render(props({ secondaryAxis: true }));
const rise = (nodes) => { const ys = nodes.filter((n) => n.role === 'chart-marker').map((n) => n.frame.y); return Math.max(...ys) - Math.min(...ys); };
console.log(JSON.stringify({ squeezed, roomyRise: rise(roomy) }));
""")
        self.assertIsInstance(result["squeezed"], str)
        self.assertIn("panels", result["squeezed"])
        self.assertGreaterEqual(result["roomyRise"], 48)

    def test_a_word_unit_on_the_second_scale_is_set_off_by_a_space(self):
        result = run_node(PRELUDE + """
const props = (secondaryUnit) => ({ categories: ['2019','2020','2021','2022','2023','2024'], secondaryAxis: true, secondaryUnit, dataLabels: true,
  series: [{ name: 'Asking rent', values: [3457, 3236, 3033, 4062, 4287, 4328] }, { name: 'Listings', values: [18017, 26846, 21336, 13273, 16559, 15994] }],
  highlights: [], referenceLines: [], annotations: [] });
const texts = (unit) => REGISTRY.get('chart.combo').render({ id: 'c', frame: { x: 0, y: 0, width: 760, height: 430 }, props: props(unit) }).nodes.map((n) => n.text).filter(Boolean);
console.log(JSON.stringify({ word: texts('listings'), symbol: texts('%') }));
""")
        self.assertTrue(any(t.endswith(" listings") for t in result["word"]), result["word"])
        self.assertFalse(any(t.endswith("0listings") for t in result["word"]))
        self.assertFalse(any(t.endswith(" %") for t in result["symbol"]))


class LabelThinningTests(unittest.TestCase):
    def test_a_distribution_names_every_member_at_8pt_before_it_thins_and_always_the_called_out(self):
        """Fifty-six-page re-author: a long distribution's label thinning was learnt from errors; it names every member at 8pt first and always the called-out ones."""
        result = run_node(PRELUDE + """
import { nativeChartSpec } from './skills/professional-slides/runtime/core.mjs';
const field = (n, extra = {}) => { const categories = Array.from({ length: n }, (_, i) => 'Op' + String(i + 1).padStart(2, '0'));
  const props = { categories, series: [{ name: 'V', values: categories.map((_, i) => 200 - i * 3) }], highlights: [{ category: 'Op20' }], annotations: [], referenceLines: [], ...extra };
  const frame = { x: 0, y: 0, width: 760, height: 440 };
  const nodes = REGISTRY.get('chart.bar').render({ id: 'd', frame, props }).nodes;
  return { nodes, props, frame }; };
const labels = ({ nodes }) => nodes.filter((n) => n.role === 'category-label');
const small = field(32), thin = field(40, { annotations: [{ category: 'Op33', text: 'The one new entrant' }] });
const spec = nativeChartSpec('chart.bar', small.props, small.frame, small.nodes);
console.log(JSON.stringify({ small: labels(small).length, size: labels(small)[0].style.fontSize.value, thin: labels(thin).map((n) => n.text), labelPt: spec && spec.labelPt }));
""")
        self.assertEqual(result["small"], 32)
        self.assertEqual(result["size"], 8)
        self.assertLess(len(result["thin"]), 40)
        self.assertIn("Op33", result["thin"], "the member a callout names keeps its name")
        self.assertIn("Op20", result["thin"])
        self.assertEqual(result["labelPt"], 8)


class ScatterTests(unittest.TestCase):
    def test_a_scatter_coloured_by_series_is_keyed_or_refused(self):
        """Fifty-page audit: dots coloured by series carried no key."""
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
import {{ toDeckPlan }} from './evals/support/compose.mjs';
import {{ planDeck }} from '{RUNTIME}/planner.mjs';
{PAGE}
const points = [['a', 1, 3, 'East'], ['b', 2, 5, 'East'], ['c', 3, 2, 'West'], ['d', 4, 6, 'West'], ['e', 5, 4, 'East']].map(([name, x, y, series]) => ({{ name, x, y, series }}));
const deck = planDeck(toDeckPlan({{ schema: 'professional-slides.deck/v3', id: 'd', tracker: false, slides: [{{ id: 's', title: 'Two regions sit apart', layout: 'exhibit-full', exhibit: {{ type: 'chart.scatter', heading: 'Cost and margin', points }} }}] }}, '.')).deck;
const frame = {{ x: 0, y: 0, width: 800, height: 420 }};
const render = (props) => REGISTRY.get('chart.scatter').render({{ id: 'c', frame, props: {{ annotations: [], highlights: [], referenceLines: [], ...props }} }}).nodes;
const connected = render({{ points, legend: false, connect: true, referenceLines: [{{ value: 4, label: 'Break-even' }}] }});
console.log(JSON.stringify({{ legend: deck.slides[0].nodes.filter((n) => n.role === 'legend-label').map((n) => n.text),
  unkeyed: error(() => render({{ points, legend: false }})),
  lines: connected.filter((n) => n.role === 'chart-line').length, ends: connected.filter((n) => n.data?.labelKind === 'series-end').map((n) => n.text),
  reference: connected.filter((n) => n.role === 'chart-reference-line').length }}));
""")
        self.assertEqual(sorted(result["legend"]), ["East", "West"])
        self.assertIn("names none of them", result["unkeyed"])
        self.assertEqual(result["lines"], 3)
        self.assertEqual(sorted(result["ends"]), ["East", "West"])
        self.assertGreaterEqual(result["reference"], 1)

    def test_a_scatter_y_title_is_its_texts_width(self):
        """Fifty-page audit: a scatter's rotated y title took a slot far wider than its text."""
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
const points = [1, 2, 3, 4, 5].map((x) => ({{ name: 'p' + x, x, y: x * x % 7 }}));
const nodes = REGISTRY.get('chart.scatter').render({{ id: 'c', frame: {{ x: 0, y: 0, width: 800, height: 420 }}, props: {{ points, yLabel: 'Share, %', xLabel: 'Ratio', annotations: [], highlights: [], referenceLines: [] }} }}).nodes;
console.log(JSON.stringify(nodes.find((n) => n.role === 'axis-title' && n.data.axis === 'y').frame.width));
""")
        self.assertLess(result, 120)


class PanelChartTests(unittest.TestCase):
    """Charts drawn in segments or as a group keep what each part says."""

    def test_three_segments_have_distinct_matching_bands(self):
        """Variant review: three segments drew bands that repeated a colour and marks that did not match their band."""
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('chart.column'),props=structuredClone(owner.examples['segment-implications'].props);
props.segments=[0,1,2].map(i=>({id:`s${i}`,label:`Group ${String.fromCharCode(65+i)}`,categories:props.categories.slice(i*2,i*2+2),heading:'Delivery implication',items:['Prioritize the next release.']}));
const nodes=owner.render({id:'segments',frame:{x:0,y:0,width:1160,height:540},props}).nodes;
const bands=nodes.filter(n=>n.role==='segment-header-band');
assert.equal(bands.length,3);assert.equal(new Set(bands.map(n=>n.style.fill.tokenId)).size,3);
props.segments.forEach((s,i)=>{const marks=nodes.filter(n=>n.data?.segmentId===s.id&&n.style?.fill);assert.ok(marks.length);for(const mark of marks)assert.equal(mark.style.fill.tokenId,bands[i].style.fill.tokenId);});
console.log('{}');
""")

    def test_independent_part_charts_keep_category_labels(self):
        """Variant review: part-to-whole charts in a group lost their category labels, and the group mutated its input props."""
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
for(const component of ['chart.pie','chart.donut'])for(const settings of [{legend:false},{variant:'shared-legend'}])for(const legendMode of [undefined,'independent']){
 const props={legendMode,charts:[{component,props:{labels:['Core','Growth'],values:[60,40],...settings}},{component:'chart.scatter',props:REGISTRY.get('chart.scatter').sample}]};
 const before=JSON.stringify(props),nodes=REGISTRY.get('chart-group').render({id:'mixed',frame:{x:0,y:0,width:1160,height:570},props}).nodes;
 for(const label of ['Core','Growth'])assert.ok(nodes.some(n=>n.role==='category-label'&&n.text===label));
 assert.equal(JSON.stringify(props),before);
}
console.log('{}');
""")


class BarNoteTests(unittest.TestCase):
    def test_long_bar_notes_move_to_a_column_instead_of_overlapping(self):
        """62-page deck: long notes on bars overlapped their category names."""
        result = run_node('''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const cats = ['Riyadh Air','IndiGo','Akasa Air','Breeze Airways','STARLUX','Norse Atlantic','Etihad Airways','Emirates','Qatar Airways'];
const props = { categories: cats, series: [{ name: 'Orders', values: [124,100,72,60,17,0,0,0,0] }], categoryNotes: cats.map((_, i) => i % 2 ? '28 months, leased at first' : '39 months to service') };
const nodes = REGISTRY.get('chart.bar').render({ id: 'c', frame: { x: 0, y: 0, width: 1160, height: 240 }, props }).nodes;
const notes = nodes.filter(n => n.role === 'category-note'), labels = nodes.filter(n => n.role === 'category-label');
const overlap = (a, b) => a.frame.x < b.frame.x + b.frame.width && b.frame.x < a.frame.x + a.frame.width && a.frame.y < b.frame.y + b.frame.height && b.frame.y < a.frame.y + a.frame.height;
console.log(JSON.stringify({ column: notes.every(n => n.data.column), clash: notes.some(n => labels.some(l => overlap(n, l))) || notes.some((n, i) => notes.some((m, j) => i !== j && overlap(n, m))) }));
''')
        self.assertTrue(result['column'])
        self.assertFalse(result['clash'])


class LogoFrameTests(unittest.TestCase):
    def test_logos_share_a_visual_area_instead_of_fitting_the_box(self):
        """62-page deck: a wordmark filled its box while a square mark became a speck beside it."""
        result = run_node('''
import { logoFrame } from './skills/professional-slides/runtime/charts.mjs';
const box = { x: 0, y: 0, width: 64, height: 32 }, area = 64 * 24 * 0.6;
const wide = logoFrame(box, 960, 200, { area, align: 'right' }), square = logoFrame(box, 400, 400, { area, align: 'right' }), tall = logoFrame(box, 300, 600, { area });
console.log(JSON.stringify({ wide, square, tall, ratio: (square.width * square.height) / (wide.width * wide.height) }));
''')
        self.assertLessEqual(result['wide']['width'], 64)
        self.assertAlmostEqual(result['wide']['x'] + result['wide']['width'], 64, places=3)  # hugs the bar
        self.assertGreater(result['ratio'], 0.9)  # a square mark gets as much ink as a wordmark
        self.assertLessEqual(result['tall']['height'], 32)


if __name__ == "__main__":
    unittest.main()


class LollipopNegativeTests(unittest.TestCase):
    def test_a_negative_value_is_labelled_left_of_its_dot_clear_of_the_stem_and_the_names(self):
        result = run_node(PRELUDE + """
const props = { categories: ['A','B','C','D','E','F','G','H'], series: [{ name: 'Change', values: [12, 8, 4, 1, -3, -9, -15, -25] }], highlights: [{ category: 'H' }], annotations: [], referenceLines: [] };
const nodes = REGISTRY.get('chart.lollipop').render({ id: 'l', frame: { x: 0, y: 0, width: 760, height: 430 }, props }).nodes;
const dot = (c) => nodes.find((n) => n.id.includes('dot') && n.data.category === c).frame;
const name = (c) => nodes.find((n) => n.role === 'category-label' && n.text === c).frame;
console.log(JSON.stringify(nodes.filter((n) => n.role === 'data-label').map((n) => ({ c: n.data.category, v: Number(n.text),
  left: n.frame.x + n.frame.width <= dot(n.data.category).x, right: n.frame.x >= dot(n.data.category).x + dot(n.data.category).width, clear: n.frame.x >= name(n.data.category).x + name(n.data.category).width }))));
""")
        for label in result:
            self.assertTrue(label["left"] if label["v"] < 0 else label["right"], label)
            self.assertTrue(label["clear"], label)


class ComboLabelPlacementTests(unittest.TestCase):
    def test_a_line_label_moves_under_its_point_when_the_steep_segment_before_it_runs_through_the_box_above(self):
        result = run_node(PRELUDE + """
const props = { categories: ['2019','2020','2021','2022','2023','2024','1H2025'], secondaryAxis: true, dataLabels: true,
  series: [{ name: 'Cap rate', values: [3.98, 4.58, 4.56, 4.36, 5.24, 6.23, 6.62] }, { name: 'Price per unit', values: [758217, 490607, 452380, 525856, 510046, 441514, 441957] }],
  valueFormat: { decimals: 1, suffix: '%' }, secondaryValueFormat: { prefix: '$', compactUnit: 'k', decimals: 0 }, highlights: [], referenceLines: [], annotations: [] };
const nodes = REGISTRY.get('chart.combo').render({ id: 'c', frame: { x: 0, y: 0, width: 760, height: 430 }, props }).nodes;
const label = (c) => nodes.find((n) => n.role === 'data-label' && n.data?.series === 'Price per unit' && n.data.category === c).frame;
const point = (c) => nodes.find((n) => n.role === 'chart-marker' && n.id === `c:point:price-per-unit:${c}`);
console.log(JSON.stringify({ first: label('2019').y, second: label('2020').y, point2020: point('2020')?.frame?.y ?? null }));
""")
        # 2019 tops the line, so its label sits above; 2020 sits under the steep fall from it, so its label goes under the point.
        self.assertIsNotNone(result["point2020"])
        self.assertGreater(result["second"], result["point2020"])
