"""Devices drawn from the published-report sample (evals/corpus/styles, pages 401-600).

Two hundred pages of the firms' infographic and thought-leadership reports were
classified against the 85 client-deck styles. All but three fitted; those three
were radial bars, and the pages carried five devices the charts could not set:
delta pills over columns, icons or logos on a category axis, a growth column at
the end of a line chart and a discrete assessment scale. Each is checked here
for what the reader relies on, not for pixels.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from node_probe import run_node  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skills/professional-slides/runtime/gates"))
import page_gates  # noqa: E402

REG = "import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';\n"


class RadialBarsTests(unittest.TestCase):
    def test_rings_sweep_in_proportion_and_labels_sit_on_their_own_ring(self):
        result = run_node(REG + """
const frame={x:0,y:0,width:900,height:420};
const nodes=REGISTRY.get('radial-bars').render({id:'r',frame,props:{items:[{label:'First share',value:90},{label:'Second share',value:45},{label:'Third share',value:10,highlight:true}]}}).nodes;
const arcs=nodes.filter(n=>n.role==='radial-arc'), tracks=nodes.filter(n=>n.role==='radial-track');
const values=nodes.filter(n=>n.role==='radial-value'), labels=nodes.filter(n=>n.role==='radial-label');
const centre=arcs[0].frame.x+arcs[0].frame.width/2;
console.log(JSON.stringify({arcs:arcs.length,tracks:tracks.length,values:values.map(n=>n.text),
  leftOfCentre:[...values,...labels].every(n=>n.frame.x+n.frame.width<=centre+0.01),
  rowsDescend:values.every((n,i)=>i===0||n.frame.y>values[i-1].frame.y),
  highlight:arcs.map(a=>a.style.fill)}));
""")
        self.assertEqual(result["arcs"], 3)
        self.assertEqual(result["tracks"], 3)
        self.assertEqual(result["values"], ["90%", "45%", "10%"])
        self.assertTrue(result["leftOfCentre"])
        self.assertTrue(result["rowsDescend"])
        self.assertNotEqual(result["highlight"][2], result["highlight"][0])

    def test_a_value_beyond_the_scale_and_a_label_too_long_for_its_ring_are_refused(self):
        result = run_node(REG + """
const frame={x:0,y:0,width:640,height:420};
const fail=props=>{try{REGISTRY.get('radial-bars').render({id:'r',frame,props});return null;}catch(e){return e.message;}};
console.log(JSON.stringify({over:fail({items:[{label:'A',value:120},{label:'B',value:40}]}),
  long:fail({items:Array.from({length:6},(_, i)=>({label:'A label that runs on for many words and cannot possibly fit on the narrow band a sixth ring gets '+i,value:50}))})}));
""")
        self.assertIn("between 0 and 100", result["over"])
        self.assertIn("shorten it", result["long"])


class SegmentedScaleTests(unittest.TestCase):
    def test_each_row_fills_the_one_segment_it_sits_on(self):
        result = run_node(REG + """
const frame={x:0,y:0,width:1160,height:380};
const nodes=REGISTRY.get('spectrum').render({id:'s',frame,props:{segments:5,scale:['Very low','Low','Medium','High','Very high'],
  items:[{left:'A',level:5},{left:'B',level:2},{left:'C',level:1}]}}).nodes;
const levels=nodes.filter(n=>n.role==='spectrum-level').map(n=>n.data.level);
console.log(JSON.stringify({levels,segments:nodes.filter(n=>n.role==='spectrum-segment').length,
  scale:nodes.filter(n=>n.role==='spectrum-scale').map(n=>n.text),sliders:nodes.filter(n=>n.role==='spectrum-marker').length}));
""")
        self.assertEqual(result["levels"], [5, 2, 1])
        self.assertEqual(result["segments"], 12)
        self.assertEqual(result["scale"], ["Very low", "Low", "Medium", "High", "Very high"])
        self.assertEqual(result["sliders"], 0)

    def test_a_level_off_the_scale_is_refused(self):
        result = run_node(REG + """
try{REGISTRY.get('spectrum').render({id:'s',frame:{x:0,y:0,width:1160,height:380},props:{segments:4,items:[{left:'A',level:5},{left:'B',level:1}]}});console.log(JSON.stringify({error:null}));}
catch(e){console.log(JSON.stringify({error:e.message}));}
""")
        self.assertIn("segment from 1 to 4", result["error"])


class ChartDeviceTests(unittest.TestCase):
    def test_column_deltas_sit_in_a_band_above_the_plot_over_their_columns(self):
        result = run_node(REG + """
const nodes=REGISTRY.get('chart.column').render({id:'c',frame:{x:0,y:0,width:760,height:420},props:{categories:['A','B','C'],series:[{name:'S',values:[50,30,20]}],deltas:[4,-2,9],deltasLabel:'Change vs. 2020'}}).nodes;
const marks=nodes.filter(n=>n.role==='chart-mark'), labels=nodes.filter(n=>n.role==='data-label');
const pills=nodes.filter(n=>n.role==='chart-delta');
const top=Math.min(...labels.map(n=>n.frame.y));
const centred=pills.every((p,i)=>Math.abs((p.frame.x+p.frame.width/2)-(marks[i].frame.x+marks[i].frame.width/2))<3);
console.log(JSON.stringify({pills:pills.length,above:pills.every(p=>p.frame.y+p.frame.height<=top),centred,
  texts:nodes.filter(n=>n.role==='chart-delta-label'&&!n.data.deltasHeading).map(n=>n.text),
  heading:nodes.filter(n=>n.data?.deltasHeading).map(n=>n.text)}));
""")
        self.assertEqual(result["pills"], 3)
        self.assertTrue(result["above"])
        self.assertTrue(result["centred"])
        self.assertEqual(result["texts"], ["+4", "−2", "+9"])
        self.assertEqual(result["heading"], ["Change vs. 2020"])

    def test_category_icons_sit_under_columns_and_between_label_and_bar(self):
        result = run_node(REG + """
import { nativeChartSpec } from './skills/professional-slides/runtime/core.mjs';
const props={categories:['Mail','Maps'],series:[{name:'S',values:[5,3]}],categoryIcons:{Mail:'mail',Maps:'map-pin'}};
const col=REGISTRY.get('chart.column').render({id:'c',frame:{x:0,y:0,width:760,height:420},props}).nodes;
const bar=REGISTRY.get('chart.bar').render({id:'b',frame:{x:0,y:0,width:760,height:420},props}).nodes;
const glyphs=n=>n.filter(x=>x.role==='category-icon-glyph');
const axisY=Math.max(...col.filter(n=>n.role==='chart-mark').map(n=>n.frame.y+n.frame.height));
const colLabel=col.find(n=>n.role==='category-label');
const barLabel=bar.find(n=>n.role==='category-label'), barMark=bar.find(n=>n.role==='chart-mark');
const g=glyphs(bar)[0];
let error=null; try{REGISTRY.get('chart.column').render({id:'c',frame:{x:0,y:0,width:760,height:420},props:{...props,categoryIcons:{Mail:'no-such-icon'}}});}catch(e){error=e.message;}
const slot=REGISTRY.get('chart.column').render({id:'c',frame:{x:0,y:0,width:760,height:420},props:{...props,categoryIcons:{Mail:{image:{alt:'Brand logo'}}}}}).nodes;
console.log(JSON.stringify({colIcons:glyphs(col).map(n=>n.data.icon),
  colBelowAxis:glyphs(col).every(n=>n.frame.y>=axisY), colAboveLabel:glyphs(col)[0].frame.y+glyphs(col)[0].frame.height<=colLabel.frame.y,
  barBetween:g.frame.x>=barLabel.frame.x+barLabel.frame.width-0.5&&g.frame.x+g.frame.width<=barMark.frame.x,
  error, placeholder:slot.filter(n=>n.role==='category-logo-placeholder').length, native:nativeChartSpec('chart.column',props,{x:0,y:0,width:760,height:420})}));
""")
        self.assertEqual(result["colIcons"], ["mail", "map-pin"])
        self.assertTrue(result["colBelowAxis"])
        self.assertTrue(result["colAboveLabel"])
        self.assertTrue(result["barBetween"])
        self.assertIn("Unknown category icon", result["error"])
        self.assertEqual(result["placeholder"], 1)
        self.assertIsNone(result["native"])

    def test_series_growth_sets_each_lines_rate_after_its_end_label(self):
        result = run_node(REG + """
const props={categories:['2020','2030'],series:[{name:'Fast',values:[100,200]},{name:'Slow',values:[100,110]}],directLabels:'end',seriesGrowth:{from:'2020',to:'2030'}};
const nodes=REGISTRY.get('chart.line').render({id:'l',frame:{x:0,y:0,width:900,height:420},props}).nodes;
const ends=nodes.filter(n=>n.data?.labelKind==='series-end');
const rows=nodes.filter(n=>n.data?.growth);
let error=null; try{REGISTRY.get('chart.line').render({id:'l',frame:{x:0,y:0,width:900,height:420},props:{...props,directLabels:undefined}});}catch(e){error=e.message;}
console.log(JSON.stringify({rates:rows.map(n=>n.text),heading:nodes.find(n=>n.data?.growthHeading)?.text,
  level:rows.every(r=>ends.some(e=>Math.abs(e.frame.y-r.frame.y)<0.5)), after:rows.every(r=>ends.every(e=>r.frame.x>e.frame.x)), error}));
""")
        self.assertEqual(result["rates"], ["+7.2%", "+1.0%"])
        self.assertEqual(result["heading"], "CAGR 2020–30")
        self.assertTrue(result["level"])
        self.assertTrue(result["after"])
        self.assertIn("end labels", result["error"])

    def test_an_empty_logo_slot_holds_the_deck_like_an_empty_photo(self):
        slide = {"nodes": [{"role": "category-logo-placeholder", "frame": {"x": 0, "y": 0, "width": 22, "height": 22}}]}
        findings = []
        page_gates.gate_unsourced_picture(3, slide, findings)
        self.assertEqual([f["code"] for f in findings], ["UNSOURCED_PICTURE"])


class MarkedPointsTests(unittest.TestCase):
    def test_a_page_that_asks_for_icons_keeps_them_after_a_side_column_page(self):
        result = run_node("""
import { toDeckPlan } from './skills/professional-slides/runtime/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const ex={type:'chart.bar',heading:'Impact',unit:'pp',categories:['A','B','C'],series:[{name:'S',values:[4,3,2]}]};
const pts=[{icon:'money',lead:'One',text:'First point.'},{icon:'shield',lead:'Two',text:'Second point.'},{icon:'growth',lead:'Three',text:'Third point.'}];
const spec={schema:'professional-slides.deck/v3',id:'x',cover:{title:'x'},slides:[
  {title:'The first page leads with its side column of icons',pointsStyle:'icon-lead',exhibit:ex,points:pts,source:'x'},
  {title:'The second page asks for framed icons and must keep them',pointsStyle:'icon-framed',exhibit:ex,points:pts,source:'x'}]};
const {deck}=planDeck(toDeckPlan(spec,'.'));
console.log(JSON.stringify({icons:deck.slides.at(-1).nodes.filter(n=>n.role==='list-icon-glyph').map(n=>n.data.icon)}));
""")
        self.assertEqual(result["icons"], ["money", "shield", "growth"])


if __name__ == "__main__":
    unittest.main()
