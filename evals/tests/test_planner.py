"""The planner (runtime/planner.mjs): what a slide plan may say, and how a row of panels lines up.

validateSlidePlan refuses redundant heading levels and malformed nesting, a
custom registry is honoured, and in a raw `flow.row` the panels share one
ground and one top whatever their headings say.
"""
import unittest

from node_probe import run_node


class PlanValidationTests(unittest.TestCase):
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

    def test_single_chart_has_one_analytical_heading_owner(self):
        """PR #4 review: a group heading over a single chart's own heading put two headings on one exhibit."""
        self.check_js("""
const chart={id:'assets',job:'compare segment assets',component:'chart.bar',props:{heading:'Managed assets, FY2012',unit:'$B',categories:['SMB','PLE'],series:[{name:'Assets',values:[.8,2.1]}]}};
const group={id:'segments',job:'show segment scale',heading:'Managed assets span commercial customers',items:[chart]};
const slide={id:'financing',title:'Financing serves distinct segments',items:[group]};
assert.throws(()=>validateSlidePlan(slide),/redundant heading levels/);
delete group.heading;
assert.doesNotThrow(()=>validateSlidePlan(slide));
group.heading='Commercial financing';
group.items.push({...chart,id:'other',props:{...chart.props,heading:'Originations, FY2012'}});
assert.doesNotThrow(()=>validateSlidePlan(slide));
""")

    def test_custom_registry_and_nested_empty_items(self):
        """PR #4 review: a custom registry was ignored and an empty or malformed nested item list slipped through."""
        self.check_js("""
const registry=new Map(REGISTRY);
registry.set('extension',{...REGISTRY.get('paragraph'),id:'extension'});
const slide={id:'slide',title:'Extension works',items:[{id:'group',job:'Explain',items:[{id:'evidence',job:'Support',component:'extension',props:{text:'Evidence supports action'}}]}]};
assert.ok(planDeck({id:'deck',slides:[slide]},registry).deck);
assert.throws(()=>planDeck({id:'deck',slides:[slide]}),/not registered/);
for(const items of [[],{},'bad']) {
 assert.throws(()=>validateSlidePlan({...slide,items:[{id:'group',job:'Explain',items}]}),/nested items/);
}
""")


class PanelRowTests(unittest.TestCase):
    """Panels in a row are drawn the same way and start on the same line."""

    def test_a_row_falls_back_to_one_ground_unless_every_panel_names_its_own(self):
        """Fifty-page read: a ground on one panel and not its neighbour read as an answer beside a footnote."""
        # A ground on one panel and nothing on its neighbour is the alternation;
        # a ground on each is the page saying which side it means.
        run_node('''
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const panel=(id,heading,treatment)=>({id,...(treatment?{treatment}:{}),heading,
  size:{width:{fr:1},height:'fill'},
  items:[{id:`${id}-table`,component:'table',props:{columns:['Trait','Reading'],
    rows:[['Method','Repeatable'],['Motive','Fixed']]}}]});
const row=(a,b)=>planDeck({id:'d',slides:[{id:'p',title:'Order and chaos are one page read twice',
  items:[{id:'row',layout:'flow.row',items:[a,b]}]}]}).deck.slides[0].nodes;
const tops=(nodes)=>nodes.filter(n=>n.role==='table-header-text'&&n.text==='Trait').map(n=>n.frame.y);
// One half names a ground, the other takes the default: the difference is an
// alternation and the row falls back to the open ground.
const drifted=row(panel('a','Batman: order','muted'),panel('b','Joker: chaos'));
assert.equal(drifted.filter(n=>n.role==='section-surface').length,0);
assert.equal(...tops(drifted).slice(0,2));
// Both halves name one: the page meant it, and the grounds hold.
const decided=row(panel('a','Batman: order','muted'),panel('b','Joker: chaos','open'));
assert.equal(decided.filter(n=>n.role==='section-surface').length,1,'the named ground is drawn');
const [left,right]=tops(decided);
assert.equal(left,right,'and the surface still starts its table where its peer starts one');
console.log('{}');
''')

    def test_a_ground_with_a_wrapped_heading_keeps_the_row_on_one_top(self):
        """Fifty-page read: a surface padded inward started its table a baseline unit above its neighbour, a whole line with a wrapped heading."""
        # The surface pads inward and inks no rule of its own, so its contents
        # used to start a baseline unit above its neighbour's - and a heading
        # that wrapped beside it opened the gap to a whole line.
        run_node('''
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const panel=(id,heading,treatment)=>({id,treatment,heading,size:{width:{fr:1},height:'fill'},
  items:[{id:`${id}-table`,component:'table',props:{columns:['Trait','Reading'],
    rows:[['Method','Repeatable'],['Motive','Fixed']]}}]});
const nodes=planDeck({id:'d',slides:[{id:'p',title:'Order and chaos are one page read twice',
  items:[{id:'row',layout:'flow.row',items:[
    panel('a','Batman keeps order by method and by the same answer every time','muted'),
    panel('b','Joker','open')]}]}]}).deck.slides[0].nodes;
const tops=nodes.filter(n=>n.role==='table-header-text'&&n.text==='Trait').map(n=>n.frame.y);
assert.equal(tops.length,2);
assert.equal(tops[0],tops[1],'a wrapped heading raises the band for both panels, not one');
console.log('{}');
''')

    def test_a_blank_band_beside_a_named_one_still_lines_the_two_up(self):
        """Fifty-page read: the blank band the row rule gives an unnamed panel inked a rule, and must still keep its height."""
        # The blank band is the row rule's doing, so it must keep its height:
        # drawing nothing is not the same as taking no space.
        run_node('''
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const panel=(id,heading)=>({id,heading,size:{width:{fr:1},height:'fill'},
  items:[{id:`${id}-table`,component:'table',props:{columns:['Trait','Reading'],
    rows:[['Method','Repeatable'],['Motive','Fixed']]}}]});
const nodes=planDeck({id:'d',slides:[{id:'p',title:'One panel is named and one is not',
  items:[{id:'row',layout:'flow.row',items:[panel('a','Batman: order'),panel('b',' ')]}]}]})
  .deck.slides[0].nodes;
assert.deepEqual(nodes.filter(n=>n.role==='section-heading').map(n=>n.text),['Batman: order']);
assert.equal(nodes.filter(n=>n.role==='section-heading-rule').length,1,'one heading, one rule');
const tops=nodes.filter(n=>n.role==='table-header-text'&&n.text==='Trait').map(n=>n.frame.y);
assert.equal(tops.length,2);
assert.equal(tops[0],tops[1],'the unnamed panel still starts where the named one does');
console.log('{}');
''')


if __name__ == "__main__":
    unittest.main()
