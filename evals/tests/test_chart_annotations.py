"""Callouts, leaders and reference-line labels on a chart (runtime/chart-annotations.mjs).

A callout is the size of what it says, its leader lands on the mark it is
about, it takes free space in the plot before it takes a band off it, and a
reference label that cannot sit inside moves outside rather than throwing.
Each test renders the chart and reads where the boxes, leaders and labels went.
"""
import unittest

from node_probe import run_node

KIT = "./skills/professional-slides/runtime/page-types.mjs"

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


class CalloutBoxTests(unittest.TestCase):
    """A callout is the size of what it says and points where it is told to."""

    def test_a_short_note_gets_a_box_its_own_size(self):
        """First cold run: "$46m, 11-month filing" sat in a 260x56 box, two and a half times its text."""
        # "$46m, 11-month filing" arrived in a 260x56 rectangle - two and a half
        # times its own text, with the leader dropping out of the empty half.
        run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const chart=REGISTRY.get('chart.column');
const box=text=>{
  const nodes=chart.render({id:'bars',frame:{x:40,y:40,width:760,height:420},
    props:{...chart.sample,dataLabels:false,referenceLines:[],annotations:[{category:'2026',text}]}}).nodes;
  return nodes.find(n=>n.role==='annotation-surface').frame;
};
const LONG='The only route to a month-12 launch runs through a month-one filing';
const short=box('$46m'), medium=box('$46m, 11-month filing'), long=box(LONG);
assert.ok(short.width<medium.width,'the box follows the text');
assert.ok(medium.width<long.width);
assert.ok(long.width<=260,'260 is the width it wraps at, and the widest it gets');
assert.ok(short.height<long.height,'and two lines are taller than one');
assert.ok(short.height>=32,'while a two-word note is still a box, not a stamp');
assert.ok(medium.width<200,'the defect: a one-line note in a 260px rectangle');
// The foot stays where the leader expects it, whatever the box's height.
assert.ok(Math.abs((short.y+short.height)-(long.y+long.height))<1);
console.log('{}');
''')

    def test_callout_directions_collision_and_bar_endpoints(self):
        """Review regression: a callout's direction, border and leader end, and a band leader crossing another mark, resolved rather than thrown."""
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {renderEvidenceAnnotations} from './skills/professional-slides/runtime/chart-annotations.mjs';
const frame={x:40,y:40,width:760,height:420}, d=REGISTRY.get('chart-callout');
for(const direction of ['left','right','up','down']) {
  const nodes=d.render({id:'c',frame,props:{text:'Evidence',direction,border:false}}).nodes;
  const l=nodes.find(n=>n.role==='annotation-leader').data;
  assert.equal(nodes.find(n=>n.role==='annotation-surface').style.stroke,'none');
  assert.ok(direction==='left'?l.x2<l.x1:direction==='right'?l.x2>l.x1:direction==='up'?l.y2<l.y1:l.y2>l.y1);
}
assert.throws(()=>d.render({id:'bad',frame,props:{text:'Evidence',direction:'diagonal'}}));
assert.throws(()=>d.render({id:'bad',frame,props:{text:'Evidence',border:'no'}}));
// A band leader that would cross another mark is a conflict the chart
// resolves (it used to throw "insufficient clearance"): the box moves beside
// its point, and neither box nor leader touches the mark in the way.
const crossed=renderEvidenceAnnotations({id:'cross',plot:{x:0,y:120,width:760,height:300},props:{annotations:[{category:'A',text:'Evidence'}]},pointMap:new Map([['value:A',{x:300,y:350}]]),obstacles:[{role:'chart-mark',frame:{x:280,y:160,width:40,height:100}}]}).placements[0];
assert.equal(crossed.placement,'beside');
assert.ok(crossed.frame.y>260&&Math.min(crossed.leader.y1,crossed.leader.y2)>260);
const chart=REGISTRY.get('chart.column');
const nodes=chart.render({id:'bars',frame,props:{...chart.sample,dataLabels:false,referenceLines:[],annotations:[{category:'2026',text:'Evidence'}]}}).nodes;
const mark=nodes.find(n=>n.role==='chart-mark'&&n.data.category==='2026');
const leader=nodes.find(n=>n.role==='annotation-leader').data;
// The leader lands on the column's top-centre. It used to land on the right
// edge (`leaderX`), which on a row of columns pointed at the gap between two
// bars; with no value label on the column the dot sits on the top itself.
assert.ok(Math.abs(leader.x2-mark.frame.x-mark.frame.width/2)<.001);
assert.ok(Math.abs(leader.y2-mark.frame.y)<.001);
console.log(JSON.stringify({accepted:true}));
""")

    def test_the_refusal_and_the_redraws_say_the_measured_capacity(self):
        """Rebuilt fifty-page deck: three places told an author a callout's length from a number nobody measured."""
        result = run_node(f'''
import {{ compilePage, calloutCapacity, describeTypes }} from '{KIT}';
import {{ countInWords }} from './skills/professional-slides/runtime/chart-annotations.mjs';
import {{ REDRAWS }} from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const long = 'Traffic fell to a fifth of its level when the whole network was grounded for the spring and summer';
let refusal = null;
try {{ compilePage({{ id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, adds: 'The callout names the mechanism the exhibit cannot show',
  why: 'The break is the claim here', settles: {{ kind: 'rate', what: 'The evidence recorded for this page' }}, title: 'Traffic fell and recovered',
  exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], annotations: [{{ category: '2020', text: long }}] }} }}); }}
catch (e) {{ refusal = e.message; }}
const n = calloutCapacity();
console.log(JSON.stringify({{ n, words: countInWords(n), refusal, redraw: REDRAWS.find((r) => r.holding === 'notes on particular marks').choice,
  types: describeTypes().includes(`a chart callout holds about ${{n}} words`) }}));
''')
        self.assertGreater(result['n'], 4)
        self.assertIn(f"a callout holds about {result['words']} words", result['refusal'])
        self.assertIn(f"about {result['words']} words each", result['redraw'])
        self.assertTrue(result['types'])
        self.assertNotIn('about twelve words', result['refusal'] + result['redraw'])


class LeaderTests(unittest.TestCase):
    """A leader ends on its mark: a column's top centre, a bar's end, a line's dot."""

    def test_leader_lands_on_the_column_top_centre_and_the_bar_end_centre(self):
        """Emirates deck: callout leaders landed on a column's right edge, pointing at the gap between bars."""
        result = run_node("""
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:72,y:180,width:1136,height:460};
const render=(type,props)=>REGISTRY.get(type).render({id:'c',frame,props}).nodes;
const column=render('chart.column',{heading:'Mix',unit:'%',categories:['Europe','E Asia','Americas','Africa'],series:[{name:'Share',values:[31,28,16,8]}],annotations:[{category:'E Asia',text:'Europe and East Asia together: 59%'}]});
const bar=render('chart.bar',{heading:'Mix',unit:'%',categories:['Europe','E Asia','Americas'],series:[{name:'Share',values:[31,28,16]}],annotations:[{category:'Europe',text:'The largest region'}]});
const pick=(nodes,category)=>({mark:nodes.find(n=>n.role==='chart-mark'&&n.data.category===category).frame,
  label:nodes.find(n=>n.role==='data-label'&&n.data.category===category).frame,
  leader:nodes.find(n=>n.role==='annotation-leader').data});
console.log(JSON.stringify({column:pick(column,'E Asia'),bar:pick(bar,'Europe')}));
""")
        column, bar = result['column'], result['bar']
        # Top-centre of the column, stopping above its value label rather than
        # striking through the number.
        self.assertAlmostEqual(column['leader']['x2'], column['mark']['x'] + column['mark']['width'] / 2, places=3)
        self.assertLess(column['leader']['y2'], column['label']['y'] + column['label']['height'] / 2)
        self.assertGreater(column['leader']['y2'], column['label']['y'] - 16)
        # End-centre of a horizontal bar.
        self.assertAlmostEqual(bar['leader']['x2'], bar['mark']['x'] + bar['mark']['width'], places=3)
        self.assertAlmostEqual(bar['leader']['y2'], bar['mark']['y'] + bar['mark']['height'] / 2, places=3)

    def test_a_leader_onto_a_crossing_point_shares_its_band(self):
        """Emirates deck: two callouts that met nowhere sat in two bands because a leader's corridor caught the rival's marker."""
        # Two callouts over different months met nowhere across the plot, yet
        # sat in two stacked bands: packed into one, the taller plot set the
        # May point a point and a half above its rival's, and the leader's
        # corridor - run three pixels past its own mark - caught the rival's
        # marker and refused the shared band. The leader ends under its dot.
        result = run_node("""
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props={heading:'Share of Ramp businesses purchasing each vendor',unit:'% of panel firms',
  categories:['Aug 25','Sep 25','Oct 25','Nov 25','Dec 25','Jan 26','Feb 26','Mar 26','Apr 26','May 26','Jun 26','Jul 26','Aug 26'],
  series:[{name:'Anthropic',values:[16.2,16.6,17.2,17.9,18.4,21.7,27.5,34.1,38.6,41,42.4,43.4,43.8]},{name:'OpenAI',values:[41,41.2,40.9,41.4,41.2,41.1,41.2,40.3,39.6,39.5,39.5,39.7,39.8]}],
  yMin:0,yMax:50,endLabels:true,dataLabels:false,
  annotations:[{category:'May 26',series:'Anthropic',text:'First monthly crossover in May, after a climb from 16.2%'},{category:'Jan 26',series:'OpenAI',text:'OpenAI holds near 40% of panel firms all year'}]};
const nodes=REGISTRY.get('chart.line').render({id:'c',frame:{x:60,y:182,width:1160,height:486},props}).nodes;
const boxes=nodes.filter(n=>n.role==='annotation-surface').map(n=>n.frame);
const leaders=nodes.filter(n=>n.role==='annotation-leader').map(n=>n.data);
const may=nodes.find(n=>n.role==='chart-marker'&&n.data?.series==='Anthropic'&&n.data?.category==='May 26')?.frame;
console.log(JSON.stringify({tops:boxes.map(b=>b.y),leaders,may}));
""")
        self.assertEqual(len(set(result["tops"])), 1, "both callouts in one band")
        self.assertEqual(len(result["tops"]), 2)


class CalloutPlacementTests(unittest.TestCase):
    """A callout takes free space in the plot before it takes a band from it."""

    def test_a_callout_on_either_bar_panel_leaves_no_empty_band(self):
        """Fifty-six-page re-author: a callout on either of two six-bar panels left an empty band over the other, and the longest bar's had no position."""
        result = run_node(PRELUDE + """
const page = (left, right) => ({ ...base, id: 'p', type: 'panels', form: 'row', commentary: 'captions', title: 'Revenue grew fastest where the network is smallest',
  exhibits: [{ type: 'chart.bar', heading: 'Revenue', unit: 'AED bn', categories: regions, series: [{ name: 'Revenue', values: [39.6, 35.7, 21, 12.5, 10.9, 9] }], highlights: [{ category: 'Europe' }], annotations: left, caption: 'The two long-haul regions earn well over half of all the revenue' },
             { type: 'chart.bar', heading: 'Change', unit: '%', categories: regions, series: [{ name: 'Change', values: [3.1, 3.2, -3.2, 1.1, 9.7, 2.7] }], annotations: right, caption: 'Africa grew fastest and the Americas were the one fall of the year' }] });
const [plain, long, negative] = compose([page([], []), page([{ category: 'Europe', text: 'Largest region for a decade' }], []), page([], [{ category: 'Americas', text: 'The only region that shrank' }])]);
const tops = (s) => [0, 1].map((i) => Math.min(...s.nodes.filter((n) => n.role === 'chart-mark' && n.id.includes(`exhibit-${i}:`)).map((n) => n.frame.y)));
const note = (s) => s.nodes.find((n) => n.role === 'annotation-text');
const bar = (s, i, c) => s.nodes.find((n) => n.role === 'chart-mark' && n.id.includes(`exhibit-${i}:`) && n.data.category === c).frame;
console.log(JSON.stringify({ plain: tops(plain), long: tops(long), negative: tops(negative), longNote: note(long).frame, europe: bar(long, 0, 'Europe'),
  negNote: note(negative).frame, americas: bar(negative, 1, 'Americas') }));
""")
        # No band reserved over either plot: the bars start where they do with no callout.
        self.assertEqual(result["long"], result["plain"])
        self.assertEqual(result["negative"], result["plain"])
        note, europe = result["longNote"], result["europe"]
        self.assertGreaterEqual(note["x"], europe["x"])
        self.assertLessEqual(note["x"] + note["width"], europe["x"] + europe["width"] + 0.5, "set inside the longest bar")
        self.assertGreaterEqual(note["y"], europe["y"])
        neg, americas = result["negNote"], result["americas"]
        self.assertGreater(neg["x"], americas["x"] + americas["width"], "past the axis, in the bar's own row")
        self.assertLess(abs((neg["y"] + neg["height"] / 2) - (americas["y"] + americas["height"] / 2)), americas["height"])

    def test_a_chart_with_width_to_spare_keeps_the_boxed_rail(self):
        """Fifty-six-page re-author: a chart with width to spare keeps its boxed callout rail."""
        result = run_node(PRELUDE + """
const props = { heading: 'Mix', unit: '%', categories: ['Europe', 'E Asia', 'Americas', 'Africa'], series: [{ name: 'Share', values: [95, 96, 97, 99] }],
  annotations: [{ category: 'Americas', text: 'Americas now the second largest market by revenue' }], highlights: [], referenceLines: [] };
const nodes = REGISTRY.get('chart.bar').render({ id: 'c', frame: { x: 72, y: 180, width: 700, height: 460 }, props }).nodes;
console.log(JSON.stringify({ boxed: nodes.some((n) => n.role === 'annotation-surface'), placement: nodes.find((n) => n.role === 'annotation-text').data.evidencePlacement }));
""")
        self.assertTrue(result["boxed"])
        self.assertEqual(result["placement"], "rail")

    def test_a_callout_takes_free_space_in_the_plot_before_a_band(self):
        """Fifty-six-page re-author: callouts over short pandemic columns took a band off the plot when the plot had room above them."""
        result = run_node(PRELUDE + """
const categories = ['FY17','FY18','FY19','FY20','FY21','FY22','FY23','FY24','FY25','FY26'];
const props = (annotations, extra = {}) => ({ categories, series: [{ name: 'Passengers', values: [56, 58, 59, 56, 7, 20, 44, 52, 54, 53] }], highlights: [], referenceLines: [], annotations, ...extra });
const frame = { x: 72, y: 150, width: 1136, height: 440 };
const render = (p) => REGISTRY.get('chart.column').render({ id: 'c', frame, props: p }).nodes;
const notes = [{ category: 'FY21', text: 'Closure: 7m' }, { category: 'FY22', text: 'Reopening: 20m' }];
const tallest = (nodes) => Math.max(...nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.height));
const plain = render(props([])), inPlot = render(props(notes)), banded = render(props(notes, { calloutBand: 'band' }));
const boxes = inPlot.filter((n) => n.role === 'annotation-surface');
const marks = inPlot.filter((n) => n.role === 'chart-mark').map((n) => n.frame);
const meet = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
console.log(JSON.stringify({ plain: tallest(plain), inPlot: tallest(inPlot), banded: tallest(banded), placements: boxes.map((b) => b.data.evidencePlacement),
  clear: boxes.every((b) => marks.every((m) => !meet(b.frame, m))) }));
""")
        self.assertEqual(result["placements"], ["beside", "beside"], "above the short pandemic columns, in the plot")
        self.assertAlmostEqual(result["inPlot"], result["plain"], delta=0.5, msg="the plot keeps its height")
        self.assertLess(result["banded"], result["plain"] - 40, "a band would have taken it")
        self.assertTrue(result["clear"])

    def test_a_dumbbell_and_a_lollipop_draw_the_callouts_authored_on_them(self):
        """Fifty-six-page re-author: a dumbbell and a lollipop dropped their callouts without a word."""
        # Both charts set their marks by category without the shared chart
        # decorations, so a callout authored on them was dropped without a word
        # and the page lost its commentary. The dumbbell's subject row is drawn
        # bold with its change in the accent.
        result = run_node(PRELUDE + """
const frame = { x: 60, y: 160, width: 1160, height: 500 };
const render = (type, props) => REGISTRY.get(type).render({ id: 'c', frame, props }).nodes;
const dumbbell = render('chart.dumbbell', { categories: ['North', 'South', 'East', 'West', 'Centre'],
  series: [{ name: '2024', values: [20, 25, 30, 28, 22] }, { name: '2025', values: [42, 31, 38, 33, 30] }],
  annotations: [{ category: 'North', series: '2025', text: 'Field sales doubled here after the spring campaign' }], highlights: [{ category: 'North' }] });
const lollipop = render('chart.lollipop', { categories: ['Portland', 'Washington', 'Seattle', 'Boston'], series: [{ name: 'Share', values: [5.2, 4.0, 3.7, 2.5] }],
  annotations: [{ category: 'Boston', text: 'Winter cuts the share by half' }] });
const inside = (n) => n.frame.x >= frame.x - 1 && n.frame.x + n.frame.width <= frame.x + frame.width + 1;
const boxes = (nodes) => nodes.filter((n) => n.role === 'annotation-surface');
const north = dumbbell.filter((n) => n.data?.category === 'North' && n.data?.highlighted).map((n) => n.role).sort();
console.log(JSON.stringify({ dumbbell: boxes(dumbbell).length, lollipop: boxes(lollipop).length, inside: [...boxes(dumbbell), ...boxes(lollipop)].every(inside),
  north, bold: dumbbell.find((n) => n.role === 'category-label' && n.text === 'North').style.bold }));
""")
        self.assertEqual(result["dumbbell"], 1)
        self.assertEqual(result["lollipop"], 1)
        self.assertTrue(result["inside"])
        self.assertEqual(result["north"], ["chart-line", "chart-mark", "chart-mark"])
        self.assertTrue(result["bold"])

    def test_callouts_that_do_not_meet_across_share_one_band(self):
        """Fifty-six-page re-author: two notes over far-apart years took a band each, 176px off a plot one band served."""
        # Two notes over years far apart were stacked one band each, 176px off
        # a plot that one 88px band served; notes whose boxes meet still stack.
        result = run_node(PRELUDE + """
const categories = ['FY26', 'FY27', 'FY28', 'FY29', 'FY30', 'FY31'];
const props = (annotations) => ({ categories, series: [{ name: 'Train-km', values: [18.2, 18.9, 19.8, 20.7, 21.4, 21.9] }], highlights: [], referenceLines: [], annotations, calloutBand: 'band' });
const frame = { x: 60, y: 272, width: 1160, height: 396 };
const render = (p) => REGISTRY.get('chart.column').render({ id: 'c', frame, props: p }).nodes;
const apart = render(props([{ category: 'FY28', text: 'Dales and Valley off-peak services added' }, { category: 'FY31', text: 'Electric trains replace diesel on the Eastern line' }]));
const near = render(props([{ category: 'FY28', text: 'Dales and Valley off-peak services added' }, { category: 'FY29', text: 'Electric trains replace diesel on the Eastern line' }]));
const one = render(props([{ category: 'FY28', text: 'Dales and Valley off-peak services added' }]));
const boxes = (nodes) => nodes.filter((n) => n.role === 'annotation-surface').map((n) => ({ y: n.frame.y + n.frame.height, placement: n.data.evidencePlacement }));
const tallest = (nodes) => Math.max(...nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.height));
console.log(JSON.stringify({ apart: boxes(apart), near: boxes(near), heights: { apart: tallest(apart), near: tallest(near), one: tallest(one) } }));
""")
        self.assertEqual([b["placement"] for b in result["apart"]], ["band", "band"])
        self.assertEqual(result["apart"][0]["y"], result["apart"][1]["y"], "one band holds both")
        self.assertAlmostEqual(result["heights"]["apart"], result["heights"]["one"], delta=0.5, msg="the plot loses one band, not two")
        self.assertNotEqual(result["near"][0]["y"], result["near"][1]["y"], "boxes that meet across keep a band each")
        self.assertGreater(result["heights"]["apart"], result["heights"]["near"] + 40)


class ReferenceLabelTests(unittest.TestCase):
    def test_a_crowded_reference_label_moves_outside_instead_of_throwing(self):
        """Emirates deck: a reference label crowded by callouts threw instead of moving outside the plot."""
        # The two callouts sit on neighbouring years, so their boxes meet across
        # and stack in two bands (callouts that do not meet share one band and
        # leave the label room inside): the plot is short and the label crowded.
        result = run_node(f"""
import {{REGISTRY}} from './skills/professional-slides/runtime/registry.mjs';
const frame={{x:72,y:162,width:1136,height:431}};
const props={{...{QATAR},referenceLines:[{{value:53.2,label:'Emirates FY26: 53.2m'}}],
  annotations:[{{category:'FY26',text:'The latest year fell about 3%, well below the required path'}},{{category:'FY27',text:'Illustrative path: about 8.4% a year'}}]}};
const nodes=REGISTRY.get('chart.column').render({{id:'c',frame,props}}).nodes;
const label=nodes.find(n=>n.role==='chart-reference-label').frame;
const right=Math.max(...nodes.filter(n=>n.role==='chart-mark').map(n=>n.frame.x+n.frame.width));
const line=nodes.find(n=>n.role==='chart-reference-line').data;
let explicit=null;
try {{ REGISTRY.get('chart.column').render({{id:'c',frame,props:{{...props,referenceLines:[{{...props.referenceLines[0],placement:'inside'}}]}}}}); }} catch (error) {{ explicit=error.message; }}
console.log(JSON.stringify({{label,right,lineEnd:line.x2,explicit}}));
""")
        # Outside the plot, in the right gutter, not over the marks.
        self.assertGreater(result['label']['x'], result['lineEnd'])
        self.assertGreater(result['label']['x'], result['right'])
        # An author who asked for inside keeps the error, now naming the way out.
        self.assertIn('No collision-free reference-line label position', result['explicit'])
        self.assertIn('outside-end', result['explicit'])


if __name__ == "__main__":
    unittest.main()
