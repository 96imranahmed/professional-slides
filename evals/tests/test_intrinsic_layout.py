import unittest

from test_source_structure import run_node


class IntrinsicLayoutTests(unittest.TestCase):
    def test_hugged_peer_sections_reserve_the_shared_wrapped_heading_band(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component,flow,grid,section} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const peer=(id,heading,rows)=>section({id,heading,padding:0,size:{height:'hug'},children:[component({id:id+'-table',component:'table',size:{height:'hug'},props:{variant:'open',columns:[{key:'name',label:'Option',type:'category'}],rows:Array.from({length:rows},(_,i)=>['Option '+(i+1)])}})]});
for(const kind of ['flow','grid']) for(const density of ['executive','pre-read']) {
 const children=[peer('a','Administrative support',4),peer('b','Teaching, research and public service',2),peer('c','University operations',3)];
 const peers=kind==='flow'?flow({id:'peers',direction:'row',size:{height:'hug'},gap:24,children}):grid({id:'peers',columns:[{fr:1},{fr:1},{fr:1}],rows:['hug'],size:{height:'hug'},columnGap:24,children:children.map((c,i)=>({...c,cell:{column:i,row:0}}))});
 const spec={slides:[{id:'nested',density,frame:{x:60,y:60,width:1000,height:600},composition:flow({id:'page',direction:'column',children:[peers]})}]};
 const original=JSON.stringify(spec),deck=compileDeck(spec,REGISTRY);
 assert.equal(JSON.stringify(spec),original,'Measurement must not mutate the author plan');
 const rules=deck.slides[0].nodes.filter(n=>n.role==='section-heading-rule');
 assert.equal(rules.length,3);assert.ok(rules.every(n=>Math.abs(n.frame.y-rules[0].frame.y)<.01));
 const tables=deck.slides[0].componentInstances.filter(c=>c.component==='table');
 assert.equal(tables.length,3);assert.ok(tables.every(t=>t.frame.y>rules[0].frame.y));
}
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])

    def test_nested_hug_measures_authored_copy_at_the_allocated_width(self):
        result = run_node("""
import { component, flow, grid, section, resolveLayout } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const list = (id, items) => component({id, component:'bullet-list', props:{variant:'body',items},size:{height:'hug'}});
const group = (id, items) => section({id,heading:'Enabling capabilities',size:{height:'hug'},children:[list(id+'-copy',items)]});
const short = ['Capture data.', 'Automate processes.'];
const root = flow({id:'two-groups',direction:'column',gap:16,children:[group('a',short),group('b',short)]});
const frame = {x:0,y:0,width:1000,height:450};
const placements=resolveLayout(root,frame,REGISTRY);
const rendered=REGISTRY.get('section').render({id:'a',frame:placements[0].frame,props:placements[0].node});
const nested=resolveLayout(flow({id:'copy',direction:'column',children:[list('body',short)]}),rendered.contentFrame,REGISTRY);
const measured=REGISTRY.get('bullet-list').measureContent({frame:rendered.contentFrame,props:{variant:'body',items:short}}).height;
const prose=['Compare the operating requirements across divisions before selecting a common service model.'];
const widths=[260,740];
const row=flow({id:'row',direction:'row',gap:0,children:widths.map((width,i)=>({...list('row-'+i,prose),size:{width,height:'hug'}}))});
const columns=grid({id:'grid',columns:widths,rows:['hug'],columnGap:0,children:widths.map((_,i)=>({...list('grid-'+i,prose),cell:{column:i,row:0}}))});
const rowFrames=resolveLayout(row,frame,REGISTRY).map(p=>p.frame);
const gridFrames=resolveLayout(columns,frame,REGISTRY).map(p=>p.frame);
console.log(JSON.stringify({heights:placements.map(p=>p.frame.height),inner:nested[0].frame.height,measured,rowFrames,gridFrames}));
""")
        self.assertLess(sum(result["heights"]), 300)
        self.assertAlmostEqual(result["inner"], result["measured"], places=2)
        self.assertGreater(result["rowFrames"][0]["height"], result["rowFrames"][1]["height"])
        self.assertEqual(result["gridFrames"][0]["height"], result["gridFrames"][1]["height"])
        self.assertAlmostEqual(result["gridFrames"][0]["height"], result["rowFrames"][0]["height"], places=2)

    def test_measured_content_still_rejects_a_real_overflow(self):
        result = run_node("""
import { component, flow, resolveLayout } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const root=flow({id:'long',direction:'column',children:[component({id:'copy',component:'bullet-list',size:{height:'hug'},props:{variant:'body',items:Array(10).fill('A developed observation preserves its evidence and the condition that changes the decision.')}})]});
let error=null;try{resolveLayout(root,{x:0,y:0,width:240,height:180},REGISTRY);}catch(e){error=e.message;}
console.log(JSON.stringify({error}));
""")
        self.assertIn("only 180px is available", result["error"])


if __name__ == "__main__":
    unittest.main()
