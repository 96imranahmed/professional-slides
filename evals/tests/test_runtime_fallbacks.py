"""Layout conflicts the runtime resolves itself instead of throwing.

Each case here used to fail the build with an error that sent the author
(usually an agent) round another treatment, which often failed in turn. The
chart now applies the fallback a designer would and renders; each test renders
the previously failing case and reads the geometry to show the fallback was
taken and nothing collides. Genuine author errors keep their throw, and the
last test of each group checks the message names the fix.
"""
import unittest

from node_probe import RUNTIME, run_node


PRELUDE = """
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {measureText} from './skills/professional-slides/runtime/text-layout.mjs';
// A text node's inked box: bar value labels sit in 50px frames around 20px of figures.
const ink=n=>{ if(n.type!=='text') return n.frame; const m=measureText(n.text,1000,{fontFamily:n.style.fontFamily?.value??'Arial',fontSize:n.style.fontSize?.value??14,bold:n.style.bold,wrapWidthRatio:1});
  const x=n.style.align==='left'?n.frame.x:n.style.align==='right'?n.frame.x+n.frame.width-m.width:n.frame.x+(n.frame.width-m.width)/2;
  return {x,y:n.frame.y+(n.frame.height-m.height)/2,width:m.width,height:m.height}; };
const render=(type,props,frame={x:72,y:180,width:1136,height:460})=>REGISTRY.get(type).render({id:'c',frame,props}).nodes;
const meet=(a,b,pad=0)=>!(a.x+a.width+pad<=b.x||b.x+b.width+pad<=a.x||a.y+a.height+pad<=b.y||b.y+b.height+pad<=a.y);
const inside=(a,b)=>a.x>=b.x-0.5&&a.y>=b.y-0.5&&a.x+a.width<=b.x+b.width+0.5&&a.y+a.height<=b.y+b.height+0.5;
const within=(frame,nodes)=>nodes.every(n=>inside(n.frame,frame));
"""

BARS = "{heading:'Mix',unit:'%',categories:['Europe','E Asia','Americas','Africa'],series:[{name:'Share',values:[95,60,40,20]}]}"


class EvidenceCalloutFallbackTests(unittest.TestCase):
    def test_a_callout_on_a_long_bar_moves_beside_it_and_releases_its_band(self):
        result = run_node(PRELUDE + f"""
const base={BARS};
const plain=render('chart.bar',base);
const nodes=render('chart.bar',{{...base,annotations:[{{category:'E Asia',text:'East Asia is closing the gap fastest'}}]}});
const box=nodes.find(n=>n.role==='annotation-surface');
const bar=nodes.find(n=>n.role==='chart-mark'&&n.data.category==='E Asia').frame;
const label=nodes.find(n=>n.role==='data-label'&&n.data.category==='E Asia').frame;
const leader=nodes.find(n=>n.role==='annotation-leader').data;
// Beside its bar, level with it, past the value label.
assert.equal(box.data.evidencePlacement,'beside');
assert.ok(box.frame.y<bar.y+bar.height&&box.frame.y+box.frame.height>bar.y,'level with its bar');
assert.ok(box.frame.x>bar.x+bar.width,'beyond the bar end');
// Nothing under the box or the leader but the leader's own end.
for(const n of nodes.filter(n=>['chart-mark','data-label','category-label'].includes(n.role))) assert.ok(!meet(box.frame,ink(n)),`box clear of ${{n.id}}`);
assert.ok(Math.min(leader.x1,leader.x2)>=bar.x+bar.width,'the leader never crosses a bar');
// The band reserved above the plot was released: the bars sit where they do with no callout.
const top=ns=>Math.min(...ns.filter(n=>n.role==='chart-mark').map(n=>n.frame.y));
assert.ok(Math.abs(top(nodes)-top(plain))<1,'no empty band above the plot');
console.log(JSON.stringify({{ok:true}}));
""")
        self.assertTrue(result['ok'])

    def test_an_orthogonal_box_that_would_land_on_the_value_label_moves_past_it(self):
        result = run_node(PRELUDE + f"""
const nodes=render('chart.bar',{{...{BARS},annotations:[{{category:'E Asia',text:'Europe leads by a wide margin',treatment:'orthogonal-dot',orientation:'horizontal'}}]}});
const box=nodes.find(n=>n.role==='annotation-surface');
for(const n of nodes.filter(n=>['chart-mark','data-label'].includes(n.role))) assert.ok(!meet(box.frame,ink(n)));
console.log(JSON.stringify({{placement:box.data.evidencePlacement}}));
""")
        self.assertEqual(result['placement'], 'beside')

    def test_a_callout_with_no_room_in_the_plot_takes_a_right_hand_rail(self):
        result = run_node(PRELUDE + """
const frame={x:72,y:180,width:700,height:460};
const base={heading:'Mix',unit:'%',categories:['Europe','E Asia','Americas','Africa'],series:[{name:'Share',values:[95,96,97,99]}]};
const plain=render('chart.bar',base,frame);
const nodes=render('chart.bar',{...base,annotations:[{category:'Americas',text:'Americas now the second largest market by revenue'}]},frame);
const box=nodes.find(n=>n.role==='annotation-surface');
const right=ns=>Math.max(...ns.filter(n=>n.role==='chart-mark').map(n=>n.frame.x+n.frame.width));
assert.ok(inside(box.frame,frame),'the rail is inside the chart frame');
assert.ok(right(nodes)<right(plain)-100,'the plot gave up width for the rail');
for(const n of nodes.filter(n=>['chart-mark','data-label'].includes(n.role))) assert.ok(!meet(box.frame,ink(n)));
console.log(JSON.stringify({placement:box.data.evidencePlacement}));
""")
        self.assertEqual(result['placement'], 'rail')

    def test_two_callouts_in_a_short_chart_close_their_bands_up(self):
        result = run_node(PRELUDE + """
const frame={x:72,y:180,width:900,height:300};
const props={categories:['FY24','FY25','FY26','FY27'],series:[{name:'Passengers',values:[40,43,42,49]}],
  annotations:[{category:'FY26',text:'Dip on capacity'},{category:'FY27',text:'Recovery'}]};
const nodes=render('chart.column',props,frame);
const boxes=nodes.filter(n=>n.role==='annotation-surface').map(n=>n.frame);
const marks=nodes.filter(n=>n.role==='chart-mark').map(n=>n.frame);
const plotTop=Math.min(...marks.map(m=>m.y)), baseline=Math.max(...marks.map(m=>m.y+m.height));
assert.equal(boxes.length,2);
assert.ok(!meet(boxes[0],boxes[1]),'compact bands still stack');
assert.ok(boxes.every(b=>b.y>=frame.y),'inside the frame');
for(const n of nodes.filter(n=>n.role==='data-label')) for(const b of boxes) assert.ok(!meet(b,n.frame));
// The full 88px bands would have left under 100px; compact bands keep the minimum.
assert.ok(baseline-Math.min(...boxes.map(b=>b.y+b.height))>=100);
// A frame too short even for compact bands still fails, naming the height to add.
let message='';
try { render('chart.column',props,{...frame,height:200}); } catch (error) { message=error.message; }
console.log(JSON.stringify({message}));
""")
        self.assertIn('insufficient plot height', result['message'])
        self.assertIn('more height', result['message'])


class ReferenceLineValueLabelTests(unittest.TestCase):
    def test_labels_crossed_by_a_reference_line_stay_on_their_columns(self):
        result = run_node(PRELUDE + """
const nodes=render('chart.column',{heading:'Mix',unit:'%',categories:['A','B','C','D','E'],series:[{name:'Share',values:[30,50,45,20,46.5]}],referenceLines:[{value:47,label:'Target'}]});
const lines=nodes.filter(n=>n.role==='chart-reference-line');
const out=[];
for(const label of nodes.filter(n=>n.role==='data-label')){
  const mark=nodes.find(n=>n.role==='chart-mark'&&n.data.category===label.data.category).frame;
  // Attached: inside the column's top, or no more than 14px above it.
  const gap=mark.y-(label.frame.y+label.frame.height);
  assert.ok(label.data.placement==='inside'?inside(label.frame,mark):gap<=14,`${label.data.category} stays on its column (${gap}px)`);
  for(const line of lines) assert.ok(!meet({x:line.frame.x,y:line.frame.y-1,width:line.frame.width,height:2},{x:label.frame.x+label.frame.width/2-10,y:label.frame.y+4,width:20,height:label.frame.height-8}),`no reference line through ${label.data.category}`);
  out.push([label.data.category,label.data.placement??'above']);
}
console.log(JSON.stringify({placements:Object.fromEntries(out)}));
""")
        # 45 and 46.5 sit just under the 47 line: their labels go inside the column top.
        self.assertEqual(result['placements']['C'], 'inside')
        self.assertEqual(result['placements']['E'], 'inside')
        self.assertEqual(result['placements']['B'], 'above')

    def test_a_short_column_under_the_line_keeps_its_label_and_the_line_breaks(self):
        result = run_node(PRELUDE + """
const nodes=render('chart.column',{categories:['A','B','C','D'],series:[{name:'Share',values:[3,50,2.6,20]}],yMin:0,yMax:60,referenceLines:[{value:4.2,label:'Floor'}]});
const label=nodes.find(n=>n.role==='data-label'&&n.data.category==='C');
const mark=nodes.find(n=>n.role==='chart-mark'&&n.data.category==='C').frame;
const lines=nodes.filter(n=>n.role==='chart-reference-line');
assert.ok(mark.y-(label.frame.y+label.frame.height)<=14,'label stays on its column');
console.log(JSON.stringify({segments:lines.length,gap:label.data.referenceGap===true||label.data.referenceNudge!==undefined}));
""")
        self.assertTrue(result['gap'])


class InsightOverflowTests(unittest.TestCase):
    def test_a_caption_box_a_few_pixels_short_closes_its_padding(self):
        result = run_node(PRELUDE + """
const insight=REGISTRY.get('insight');
const props={text:'Premium cabins carry most of the margin on long-haul routes out of Dubai',variant:'neutral',align:'center'};
const frame={x:60,y:400,width:520,height:0};
const needed=insight.measureContent({frame:{...frame,height:1000},props}).height;
const short={...frame,height:needed-2};
const nodes=insight.render({id:'i',frame:short,props}).nodes;
const text=nodes.find(n=>n.role==='insight-body');
assert.ok(inside(text.frame,short),'the sentence stays inside its 2px-short box');
let message='';
try { insight.render({id:'i',frame:{...frame,height:needed-30},props}); } catch (error) { message=error.message; }
console.log(JSON.stringify({message}));
""")
        self.assertIn('more height or shorten the sentence', result['message'])


class PartToWholeFallbackTests(unittest.TestCase):
    def test_thin_slices_in_a_small_pie_label_outside_with_leaders_or_in_the_key(self):
        result = run_node(PRELUDE + """
const out={};
for(const type of ['chart.pie','chart.donut']){
  const frame={x:72,y:200,width:300,height:260};
  const nodes=render(type,{labels:['Alpha','Beta','Gamma','Delta','Epsilon'],values:[60,30,5,3,2]},frame);
  const labels=nodes.filter(n=>n.role==='data-label');
  const legend=nodes.filter(n=>n.role==='legend-label').map(n=>n.text);
  for(let i=0;i<labels.length;i++) for(let j=i+1;j<labels.length;j++) assert.ok(!meet(labels[i].frame,labels[j].frame));
  assert.ok(within(frame,labels),'every label inside the frame');
  // Every slice is labelled somewhere: on the chart or in its key entry.
  const shown=new Set([...labels.map(n=>n.data.categoryKey),...legend.filter(t=>/%$/.test(t)).map(t=>t.replace(/ \\S+%$/,''))]);
  assert.equal(shown.size,5);
  out[type]={outside:labels.filter(n=>n.data.placement==='outside').length,leaders:nodes.filter(n=>n.role==='data-label-leader').length};
}
// A slice under half a percent prints as <1%, not 0% and not an error.
const tiny=render('chart.pie',{labels:['Alpha','Beta'],values:[99.8,0.2]},{x:72,y:200,width:500,height:380});
out.tiny=tiny.filter(n=>n.role==='data-label').map(n=>n.text);
console.log(JSON.stringify(out));
""")
        self.assertGreater(result['chart.pie']['outside'], 0)
        self.assertGreater(result['chart.pie']['leaders'], 0)
        self.assertIn('<1%', result['tiny'])

    def test_crowded_names_on_the_outside_labels_variant_stack_apart(self):
        result = run_node(PRELUDE + """
const nodes=render('chart.pie',{labels:['Alpha','Beta','Gamma','Delta'],values:[80,15,3,2],variant:'outside-labels'},{x:72,y:200,width:700,height:400});
const names=nodes.filter(n=>n.role==='category-label');
for(let i=0;i<names.length;i++) for(let j=i+1;j<names.length;j++) assert.ok(!meet(names[i].frame,names[j].frame));
console.log(JSON.stringify({texts:names.map(n=>n.text)}));
""")
        # Percentages that fit neither slice nor rim join their names.
        self.assertTrue(any(text.endswith('%') for text in result['texts']))

    def test_a_treemap_tile_too_small_for_its_word_is_numbered_and_keyed(self):
        result = run_node(PRELUDE + """
const frame={x:72,y:200,width:500,height:320};
const nodes=render('chart.treemap',{items:[{label:'Internationalisation',value:80},{label:'Telecommunications',value:3},{label:'Banking',value:2},{label:'Retail',value:30},{label:'Energy',value:12}]},frame);
const key=nodes.find(n=>n.id==='c:key');
const tiles=nodes.filter(n=>n.role==='chart-mark');
assert.ok(inside(key.frame,frame));
for(const t of tiles) assert.ok(!meet(t.frame,key.frame));
console.log(JSON.stringify({keyed:key.data.keyedItems,numbers:nodes.filter(n=>n.data?.keyNumber).length}));
""")
        self.assertIn('Telecommunications', result['keyed'])
        self.assertGreater(result['numbers'], 0)


class LabelFallbackTests(unittest.TestCase):
    def test_a_scatter_cluster_labels_with_leaders_and_an_impossible_one_names_the_fix(self):
        result = run_node(PRELUDE + """
const frame={x:72,y:180,width:700,height:420};
const points=[['Acme',50,50],['Bolt',53,51],['Core',51,54],['Dyna',48,53],['Echo',50.5,47],['Flux',54,48],['Gear',47,49]].map(([name,x,y])=>({name,x,y}));
const nodes=render('chart.scatter',{points,xMin:0,xMax:100,yMin:0,yMax:100},frame);
const labels=nodes.filter(n=>n.role==='data-label'), markers=nodes.filter(n=>n.role==='chart-marker');
for(const l of labels){ for(const m of markers) assert.ok(!meet(l.frame,m.frame)); for(const o of labels) if(o!==l) assert.ok(!meet(l.frame,o.frame)); }
let message='';
const packed=[['A',50,50],['B',52,51],['C',51,53],['D',49,52],['E',50.5,49],['F',52.5,49.5],['G',48.5,50.5],['H',51.5,51.5]].map(([name,x,y])=>({name,x,y}));
try { render('chart.scatter',{points:packed,xMin:0,xMax:100,yMin:0,yMax:100},frame); } catch (error) { message=error.message; }
console.log(JSON.stringify({leaders:nodes.filter(n=>n.role==='data-label-leader').length,message}));
""")
        self.assertGreater(result['leaders'], 0)
        self.assertIn('showLabel: false', result['message'])

    def test_a_thin_stacked_bar_segment_prints_its_value_beside_the_bar(self):
        result = run_node(PRELUDE + """
const nodes=render('chart.stacked-bar',{categories:['Segment A','Segment B','Segment C'],series:[{name:'Core',values:[45,35,25]},{name:'Growth',values:[2,40,45]},{name:'New',values:[20,1.5,30]}],dataLabels:true},{x:72,y:180,width:800,height:360});
const outside=nodes.filter(n=>n.role==='data-label'&&n.data.outside);
for(const l of outside) for(const m of nodes.filter(n=>n.role==='chart-mark')) assert.ok(!meet(l.frame,m.frame));
console.log(JSON.stringify({outside:outside.map(n=>n.text)}));
""")
        self.assertEqual(sorted(result['outside']), ['1.5', '2.0'])

    def test_an_arrow_too_short_for_its_bubble_becomes_a_bracket(self):
        result = run_node(PRELUDE + """
const nodes=render('chart.column',{categories:['A','B','C','D','E','F'],series:[{name:'V',values:[40,42,44,46,48,50]}],dataLabels:true,changeAnnotations:[{start:'A',end:'B',text:'+5%'}]},{x:72,y:180,width:500,height:400});
console.log(JSON.stringify({parts:nodes.filter(n=>n.role==='annotation-leader').map(n=>n.data.annotationPart)}));
""")
        self.assertIn('span', result['parts'])


class ForwardTestFallbackTests(unittest.TestCase):
    """Failures a parallel forward test found, resolved in the same way."""

    def test_a_stacked_callout_without_a_series_points_at_the_stack(self):
        result = run_node(PRELUDE + """
const props={categories:['FY26','FY27','FY28','FY29'],series:[{name:'Core',values:[30,32,35,38]},{name:'Growth',values:[12,20,30,36]}],annotations:[{category:'FY29',text:'Growth doubles'}]};
const nodes=render('chart.stacked-column',props,{x:72,y:180,width:800,height:440});
const top=Math.min(...nodes.filter(n=>n.role==='chart-mark'&&n.data.category==='FY29').map(n=>n.frame.y));
const leader=nodes.find(n=>n.role==='annotation-leader').data;
let message='';
try { render('chart.stacked-column',{...props,annotations:[{category:'FY30',text:'x'}]},{x:72,y:180,width:800,height:440}); } catch (error) { message=error.message; }
console.log(JSON.stringify({gap:top-leader.y2,message}));
""")
        # The leader ends at the top of the stack (above its total, if printed).
        self.assertGreaterEqual(result['gap'], 0)
        self.assertLess(result['gap'], 30)
        self.assertIn('use one of: FY26', result['message'])

    def test_a_long_focus_label_on_a_scatter_takes_its_measured_width(self):
        result = run_node(PRELUDE + """
const nodes=render('chart.scatter',{points:[{name:'Scarborough',x:20,y:30},{name:'Middlesbrough',x:60,y:70},{name:'York',x:40,y:50}],focus:['Scarborough','Middlesbrough'],xMin:0,xMax:100,yMin:0,yMax:100},{x:72,y:180,width:700,height:420});
const label=nodes.find(n=>n.role==='data-label'&&n.text==='Middlesbrough');
console.log(JSON.stringify({width:label.frame.width,bold:label.style.bold}));
""")
        self.assertTrue(result['bold'])
        self.assertGreater(result['width'], 96)

    def test_a_total_row_leaves_the_implication_and_verdict_cells_blank(self):
        result = run_node(PRELUDE + """
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
const frame={x:60,y:100,width:1100,height:500};
const styled=styleTable({type:'table',columns:['Market','Revenue',{label:'Verdict',implication:true}],rows:[['A','10','Go'],['B','20','Hold'],['C','30','Go']],total:true});
const nodes=renderTable({id:'t',frame,props:styled}).nodes;
console.log(JSON.stringify({texts:nodes.filter(n=>n.type==='text').map(n=>n.text)}));
""")
        self.assertIn('Total', result['texts'])
        self.assertIn('60', result['texts'])

    def test_a_group_band_over_one_narrow_column_widens_it(self):
        result = run_node(PRELUDE + """
import {measureTable} from './skills/professional-slides/runtime/tables.mjs';
const frame={x:60,y:100,width:700,height:500};
const m=measureTable({frame,props:{columns:[{label:'Market'},{label:'Score',group:'Performance',width:0.08},{label:'Notes'}],rows:[['A','10','x'],['B','20','y']]}});
const needed=measureText('Performance',1000,{fontFamily:'Arial',fontSize:14,bold:true,wrapWidthRatio:1}).width;
console.log(JSON.stringify({width:m.widths[1],needed,total:m.widths.reduce((a,b)=>a+b,0)}));
""")
        self.assertGreater(result['width'], result['needed'])
        self.assertAlmostEqual(result['total'], 700, places=3)

    def test_a_regional_network_crops_to_its_own_extent(self):
        result = run_node(PRELUDE + """
import {mapNodes} from './skills/professional-slides/runtime/maps.mjs';
const frame={x:72,y:160,width:760,height:480};
const markers=[{id:'lds',label:'Leeds',longitude:-1.55,latitude:53.8,hub:true},{id:'yrk',label:'York',longitude:-1.08,latitude:53.96},{id:'hul',label:'Hull',longitude:-0.33,latitude:53.74},{id:'scb',label:'Scarborough',longitude:-0.4,latitude:54.28},{id:'mcr',label:'Manchester',longitude:-2.24,latitude:53.48},{id:'shf',label:'Sheffield',longitude:-1.47,latitude:53.38},{id:'hgt',label:'Harrogate',longitude:-1.54,latitude:53.99},{id:'bfd',label:'Bradford',longitude:-1.75,latitude:53.79}];
const nodes=mapNodes({id:'m',frame,props:{geography:'world',crop:'fit',markers,routes:markers.slice(1).map(m=>({from:'lds',to:m.id}))}});
const dots=nodes.filter(n=>n.role==='map-marker').map(n=>n.frame);
const labels=nodes.filter(n=>n.role==='map-label').map(n=>n.frame);
for(const l of labels){ assert.ok(inside(l,frame),'no label clipped'); for(const d of dots) assert.ok(!meet(l,d)); for(const o of labels) if(o!==l) assert.ok(!meet(l,o)); }
for(let i=0;i<dots.length;i++) for(let j=i+1;j<dots.length;j++) assert.ok(!meet(dots[i],dots[j]),'markers apart');
const xs=dots.map(d=>d.x);
console.log(JSON.stringify({spread:(Math.max(...xs)-Math.min(...xs))/frame.width,routes:nodes.filter(n=>n.role==='map-route').length}));
""")
        # Spread across the frame, not a cluster at the scale of Europe; every route drawn.
        self.assertGreater(result['spread'], 0.3)
        self.assertEqual(result['routes'], 7)


if __name__ == "__main__":
    unittest.main()


class OpenIssueFixes(unittest.TestCase):
    def test_inside_bar_callout_compact_peer_bands_and_takeaway_is_body(self):
        result = run_node('''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { chartFrame } from './skills/professional-slides/runtime/charts.mjs';
const props = { categories: ['Alpha', 'Beta', 'Gamma'], series: [{ name: 'x', values: [100, 99, 98] }], annotations: [{ category: 'Beta', text: 'Short note here' }] };
const nodes = REGISTRY.get('chart.bar').render({ id: 'c', frame: { x: 0, y: 0, width: 520, height: 330 }, props }).nodes;
const box = nodes.find((n) => n.role === 'annotation-surface');
const bar = nodes.find((n) => n.role === 'chart-mark' && n.data.category === 'Beta');
const within = box.frame.x >= bar.frame.x && box.frame.y >= bar.frame.y && box.frame.x + box.frame.width <= bar.frame.x + bar.frame.width && box.frame.y + box.frame.height <= bar.frame.y + bar.frame.height;
// A peer given the row's compact band closes its callout bands to share the top line.
const annotations = [{ category: 'A', text: 'One note' }, { category: 'B', text: 'Another note' }];
const own = chartFrame({ x: 0, y: 0, width: 500, height: 600 }, { annotations });
const peer = chartFrame({ x: 0, y: 0, width: 500, height: 600 }, { annotations, topInset: 150 });
console.log(JSON.stringify({ placement: box.data.evidencePlacement, within, leader: nodes.some((n) => n.role === 'annotation-leader' && n.data.evidenceIndex === box.data.evidenceIndex),
  ownTop: own.y, peerTop: peer.y, compact: peer.evidenceCompact === true }));
''')
        self.assertEqual(result['placement'], 'inside')
        self.assertTrue(result['within'])
        self.assertFalse(result['leader'])  # a callout on its own bar needs no leader
        self.assertGreater(result['ownTop'], 150)  # full bands alone overrun the row's band
        self.assertEqual(result['peerTop'], 150)
        self.assertTrue(result['compact'])

    def test_a_takeaway_line_is_body_not_footer(self):
        import sys
        sys.path.insert(0, str(RUNTIME / 'gates'))
        import page_gates
        slide = {'nodes': [
            {'type': 'text', 'role': 'paragraph', 'text': ' '.join(['word'] * 30), 'frame': {'x': 80, 'y': 200, 'width': 800, 'height': 100}},
            {'type': 'text', 'role': 'insight-body', 'text': ' '.join(['close'] * 20), 'frame': {'x': 80, 'y': 640, 'width': 800, 'height': 20}}]}
        body, footer, _ = page_gates.body_bands(slide)
        self.assertEqual((body, footer), (50, 0))

