"""A short group sits at the top of its region; an exhibit takes its column.

The band gates read by column now, and on a fifty-page deck they named the
composer's own habit: a group shorter than its region was centred in it, so the
region carried a band of air above the group as tall as the one below. Eight
commentary columns centred beside their charts, a waffle's two rows of dots in
the middle of a 430px plot, a number and its points floated in their column,
fact tiles grown by a third and centred, three paragraphs centred beside a
full-height panel. The principle now: an exhibit takes the space its column
gives it (a waffle's dots grow to a cap, fact tiles in two rows fill the
frame), and a short group starts at the top of its region, the width or height
it cannot use going to the neighbour that can (a short commentary column
narrows so the chart beside it widens). `pointsAlign: "middle"` still centres
when the author asks.

Also: four points under an exhibit were four 270px columns and failed CPL;
they run two by two.
"""
import json
import sys
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "skills" / "professional-slides" / "runtime" / "gates"))
import page_gates  # noqa: E402


class WaffleTests(unittest.TestCase):
    def test_the_dots_grow_and_the_block_starts_under_the_heading(self):
        result = run_node(r"""
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry=createRegistry();
const props={heading:'Outstations by region',categories:['Asia','Europe','Middle East','Africa'],series:[{name:'n',values:[7,4,2,1]}]};
const frame={x:72,y:162,width:560,height:430};
const nodes=registry.get('chart.waffle').render({id:'w',frame,props}).nodes;
const dots=nodes.filter(n=>n.role==='chart-mark');
const counts=nodes.filter(n=>n.role==='data-label');
const labels=nodes.filter(n=>n.role==='category-label');
console.log(JSON.stringify({cell:dots[0].frame.width,dotsTop:Math.min(...dots.map(n=>n.frame.y)),countTop:Math.min(...counts.map(n=>n.frame.y)),
  labelsBottom:Math.max(...labels.map(n=>n.frame.y+n.frame.height)),dots:dots.length,
  ceiling:registry.get('chart.waffle').measureCeiling({frame,props}),
  wide:registry.get('chart.waffle').render({id:'w',frame:{...frame,height:260},props}).nodes.filter(n=>n.role==='chart-mark')[0].frame.width}));
""")
        self.assertEqual(result["dots"], 14)
        # The old block was four columns of 21px dots whatever the plot's height.
        self.assertGreater(result["cell"], 30)
        self.assertLessEqual(result["cell"], 48, "the dot stops growing at its cap")
        # Under the heading: the counts sit at the plot's top, not a third of the way down it.
        self.assertLess(result["countTop"], 162 + 90)
        # What the block leaves is one band at its foot, and the ceiling says where it ends.
        self.assertLess(result["ceiling"], 430)
        self.assertAlmostEqual(result["ceiling"], result["labelsBottom"] - 162, delta=12)
        # A short plot still fits: the dots shrink to it.
        self.assertLess(result["wide"], result["cell"])

    def test_a_waffle_does_not_take_its_neighbours_callout_band(self):
        result = run_node(r"""
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const waffle={type:'chart.waffle',heading:'Outstations',unit:'outstations',categories:['Asia','Europe'],series:[{name:'n',values:[7,4]}],caption:'Seven of the eleven listed outstations are in Asia, the rest in Europe.'};
const bar={type:'chart.bar',heading:'Destinations',unit:'destinations',categories:['a','b','c'],series:[{name:'n',values:[14,100,152]}],
  annotations:[{category:'b',text:'A goal, not an in-service outcome'}],caption:'Fourteen outstations are about a seventh of the goal for the decade.'};
const page=composeSlide({title:'T',layout:'two-up',exhibits:[waffle,bar]},0);
const w=find(page.items,i=>i.component==='chart.waffle'), b=find(page.items,i=>i.component==='chart.bar');
console.log(JSON.stringify({waffle:w.props.plotTopInset??null,bar:b.props.plotTopInset??null}));
""")
        self.assertIsNone(result["waffle"], "a plot with no axis has no baseline to share")
        self.assertIsNotNone(result["bar"])


class FactGridTests(unittest.TestCase):
    PROBE = r"""
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry=createRegistry();
const items=[{value:'32.5m',label:'Abu Dhabi passengers',text:'Against about 45m of terminal capacity',gauge:0.72},
  {value:'~12.5m',label:'Abu Dhabi headroom',text:'Room for growth without a new terminal'},
  {value:'54.3m',label:'Doha passengers',text:'Against more than 65m of capacity',gauge:0.84},
  {value:'>10.7m',label:'Doha headroom',text:'Room for part of the new deliveries'}];
const grid=registry.get('fact-grid');
const tiles=(frame,props)=>grid.render({id:'g',frame,props}).nodes.filter(n=>n.role==='fact-tile').map(n=>n.frame);
const box=(frame,props)=>{const t=tiles(frame,props);return {n:t.length,top:Math.min(...t.map(f=>f.y)),bottom:Math.max(...t.map(f=>f.y+f.height)),
  rows:new Set(t.map(f=>Math.round(f.y))).size};};
const out={};
out.twoByTwo=box({x:72,y:174,width:819,height:494},{items,columns:2});
out.defaultBeside=box({x:72,y:174,width:819,height:494},{items});
out.oneRow=box({x:72,y:174,width:1136,height:494},{items,columns:4});
out.oneRowNatural=grid.measureContent({frame:{x:72,y:174,width:1136,height:494},props:{items,columns:4}}).height;
out.ceilingRow=grid.measureCeiling({frame:{x:72,y:174,width:1136,height:494},props:{items,columns:4}});
out.ceilingGrid=grid.measureCeiling({frame:{x:72,y:174,width:819,height:494},props:{items,columns:2}});
try { grid.render({id:'g',frame:{x:72,y:174,width:819,height:494},props:{items,columns:5}}); out.bad='accepted'; } catch (e) { out.bad=e.message; }
const gauge=grid.render({id:'g',frame:{x:72,y:174,width:819,height:494},props:{items,columns:2}}).nodes.filter(n=>n.role==='fact-gauge-track');
const firstTile=tiles({x:72,y:174,width:819,height:494},{items,columns:2})[0];
out.gaugeOnFoot=gauge[0].frame.y+gauge[0].frame.height>firstTile.y+firstTile.height-24;
console.log(JSON.stringify(out));
"""

    def test_two_rows_fill_the_frame_and_one_row_starts_at_the_top(self):
        result = run_node(self.PROBE)
        # Four tiles two by two take the whole frame, top to foot.
        self.assertEqual(result["twoByTwo"]["rows"], 2)
        self.assertAlmostEqual(result["twoByTwo"]["top"], 174, delta=0.5)
        self.assertAlmostEqual(result["twoByTwo"]["bottom"], 668, delta=0.5)
        # Beside commentary, four tiles in a tall frame wrap to two rows and fill it.
        self.assertEqual(result["defaultBeside"]["rows"], 2)
        self.assertAlmostEqual(result["defaultBeside"]["bottom"], 668, delta=0.5)
        # An author's single row grows by a third at most, from the top, and says so.
        self.assertEqual(result["oneRow"]["rows"], 1)
        self.assertAlmostEqual(result["oneRow"]["top"], 174, delta=0.5)
        self.assertAlmostEqual(result["oneRow"]["bottom"] - 174, result["oneRowNatural"] * 1.35, delta=1)
        self.assertAlmostEqual(result["ceilingRow"], result["oneRowNatural"] * 1.35, delta=1)
        self.assertIsNone(result["ceilingGrid"])
        self.assertIn("columns", result["bad"])
        self.assertTrue(result["gaugeOnFoot"], "the gauge stays on the tile's foot when the tile grows")

    def test_the_options_are_published(self):
        result = run_node(r"""
import {describeTypes} from './skills/professional-slides/runtime/page-types.mjs';
console.log(JSON.stringify({text:describeTypes()}));
""")
        text = result["text"]
        capacities = next(line for line in text.splitlines() if line.startswith("Capacities:"))
        self.assertIn("`columns`", capacities)
        self.assertIn("`gauge`", capacities)
        self.assertIn("two by two", capacities)
        self.assertIn("items, columns (fact-grid)", text)


class CommentaryBelowTests(unittest.TestCase):
    def test_four_points_below_run_two_by_two_and_read_as_prose(self):
        scene = run_node(r"""
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const sentence='The regional shock fell on demand faster than on seats, so fuller aircraft could not rescue the margin this year.';
const points=['Demand fell first','A global hit too','Every hub model','Cash is the buffer'].map((lead)=>({lead,text:sentence}));
const exhibit={type:'chart.column',heading:'Traffic change',unit:'%',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]};
const {deck}=planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',tracker:false,
  slides:[{id:'s',title:'Four findings under one chart read two by two',layout:'exhibit-top',exhibit,points}]}));
console.log(JSON.stringify(deck));
""")
        slide = scene["slides"][0]
        paragraphs = [n for n in slide["nodes"] if n.get("role") in ("paragraph", "body") and n.get("frame")]
        self.assertEqual(len(paragraphs), 4)
        self.assertEqual(len({round(n["frame"]["y"]) for n in paragraphs}), 2, "two rows")
        self.assertEqual(len({round(n["frame"]["x"]) for n in paragraphs}), 2, "two columns")
        # Reading order runs along each row.
        ordered = sorted(paragraphs, key=lambda n: (round(n["frame"]["y"]), n["frame"]["x"]))
        self.assertLess(ordered[0]["frame"]["x"], ordered[1]["frame"]["x"])
        found = []
        page_gates.gate_cpl(1, slide, found)
        self.assertEqual(found, [], "no column too narrow for prose")


class TopOfRegionTests(unittest.TestCase):
    def test_short_groups_start_at_the_top_of_their_region(self):
        result = run_node(r"""
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const table={type:'table',columns:['Measure','Value'],rows:[['Cash','54.9'],['Debt','56.2']]};
const chart={type:'chart.column',categories:['a','b','c'],series:[{name:'s',values:[1,2,3]}]};
const hero=composeSlide({title:'T',layout:'hero-number',kpi:{value:'0.98x',label:'cash against debt'},points:[{lead:'Not additive',text:'A stock and a flow.'}],exhibit:table},0);
const sidebar=composeSlide({title:'T',layout:'sidebar',panel:{text:'The countercase is product, not scale.'},paragraphs:['One paragraph of reasoning.','And a second.']},0);
const beside=composeSlide({title:'T',layout:'exhibit-left',pointsHeading:false,exhibit:chart,points:['One short point','And a second']},0);
const middle=composeSlide({title:'T',layout:'exhibit-left',pointsHeading:false,pointsAlign:'middle',exhibit:chart,points:['One short point']},0);
const text=composeSlide({title:'T',layout:'text',points:['First finding.','Second finding.']},0);
console.log(JSON.stringify({
  hero:find(hero.items,i=>i.id==='s01-side').leftover??null,
  sidebar:find(sidebar.items,i=>i.id==='s01-document').leftover??null,
  beside:find(beside.items,i=>i.id==='s01-side').leftover??null,
  besideList:find(beside.items,i=>i.id==='s01-points').props.centre,
  middle:find(middle.items,i=>i.id==='s01-side').leftover??null,
  text:text.items.find(i=>i.component==='bullet-list').props.centre}));
""")
        self.assertIsNone(result["hero"], "the number and its points start level with the exhibit")
        self.assertIsNone(result["sidebar"], "the copy starts level with the panel")
        self.assertIsNone(result["beside"])
        self.assertIs(result["besideList"], False)
        self.assertEqual(result["middle"], "center", "the author can still ask for the middle")
        self.assertIs(result["text"], False)


class NaturalSizeFigureTests(unittest.TestCase):
    def test_a_staircase_starts_under_the_title_with_its_points_under_it(self):
        result = run_node(r"""
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const exhibit={type:'steps',items:['A relationship','A choice','A consequence'].map((label)=>({label,text:'A sentence of supporting detail that runs to about two lines at this width.'}))};
const {deck}=planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',tracker:false,slides:[{id:'s',title:'Three steps from relationship to consequence',
  layout:'exhibit-full',exhibit,points:['The first reading of the staircase.','The second reading of it.']}]}));
const frame=(c)=>deck.slides[0].componentInstances.find(i=>i.component===c).frame;
console.log(JSON.stringify({steps:frame('steps'),points:frame('bullet-list')}));
""")
        steps, points = result["steps"], result["points"]
        self.assertLess(steps["y"], 170, "the figure starts under the title, not centred in the body")
        gap = points["y"] - (steps["y"] + steps["height"])
        self.assertTrue(0 <= gap <= 24, f"the points follow the figure directly ({gap}px)")


if __name__ == "__main__":
    unittest.main()
