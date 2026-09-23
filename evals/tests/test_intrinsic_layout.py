import unittest

from node_probe import run_node


class IntrinsicLayoutTests(unittest.TestCase):
    def test_declared_peer_table_rows_preserve_copy_scales_and_case_centres(self):
        run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component,flow} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
const alignment={group:'cases',keys:['a','b','c']};
assert.deepEqual(styleTable({columns:['Case'],rows:[['Alpha'],['Beta'],['All mixtures']],rowAlignment:alignment}).rowAlignment,alignment);
const scale={type:'bars',label:'Units',unit:'units',min:0,max:5,series:['Amount']};
const labels=['Alpha','Beta','All mixtures'];
const explanation=['A retained local condition that needs several measured lines at the intended body size.','The separate route bound and direction remain explicit for this case.','Every permitted mixture conserves the total; this construction does not establish an approved operating policy.'];
const make=(width,aligned=true)=>({slides:[{id:'s',frame:{x:60,y:100,width,height:450},composition:flow({id:'pair',direction:'row',gap:24,children:[
 component({id:'amounts',component:'table',size:{width:'fill',height:'fill'},props:{columns:['Case','Amount'],rows:labels.map((x,i)=>[x,{type:'bars',values:[i+2],scale:'units'}]),scales:{units:scale},fillHeight:true,...(aligned?{rowAlignment:alignment}:{})}}),
 component({id:'proof',component:'table',size:{width:'fill',height:'fill'},props:{columns:['Case','Conservation and governing condition'],rows:labels.map((x,i)=>[x,explanation[i]]),fillHeight:true,...(aligned?{rowAlignment:alignment}:{})}})
]})}]});
for(const width of [1000,1160]) {
 const spec=make(width),before=JSON.stringify(spec),nodes=compileDeck(spec,REGISTRY).slides[0].nodes;
 assert.equal(JSON.stringify(spec),before);
 const plain=compileDeck(make(width,false),REGISTRY).slides[0].nodes;
 for(let row=0;row<3;row++) {
  const cells=nodes.filter(n=>n.role==='table-cell-text'&&n.data.row===row&&n.data.column===0);
  assert.equal(cells.length,2);
  assert.ok(Math.abs(cells[0].frame.y+cells[0].frame.height/2-cells[1].frame.y-cells[1].frame.height/2)<.01);
 }
 for(const n of nodes.filter(n=>n.role==='table-bar')) {
  const original=plain.find(p=>p.id===n.id);assert.equal(n.frame.x,original.frame.x);assert.equal(n.frame.width,original.frame.width);assert.deepEqual(n.data.domain,original.data.domain);
 }
 for(const n of nodes.filter(n=>n.role==='table-cell-text')) {
  const original=plain.find(p=>p.id===n.id);assert.equal(n.data.textLayout.source,original.data.textLayout.source);assert.deepEqual(n.style.fontSize,original.style.fontSize);assert.equal(n.data.fitStep,undefined);
  assert.ok(n.frame.y+n.frame.height<=550.01);
 }
 const bad=make(width);bad.slides[0].composition.children[1].props.rowAlignment={group:'cases',keys:['b','a','c']};
 assert.throws(()=>compileDeck(bad,REGISTRY),/identical ordered row keys/);
 const duplicate=make(width);duplicate.slides[0].composition.children[1].props.rowAlignment={group:'cases',keys:['a','a','c']};
 assert.throws(()=>compileDeck(duplicate,REGISTRY),/unique key per row/);
 const single=make(width);delete single.slides[0].composition.children[1].props.rowAlignment;
 assert.throws(()=>compileDeck(single,REGISTRY),/at least two peers/);
 const short=make(width);short.slides[0].frame.height=120;
 assert.throws(()=>compileDeck(short,REGISTRY),/allocated|available/);
}
console.log(JSON.stringify({accepted:true}));
""")

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
const rootStart = flow({id:'two-groups',direction:'column',gap:16,children:[group('a',short),group('b',short)]});
const rootFilled = flow({id:'two-groups',direction:'column',gap:16,leftover:'distribute',children:[group('a',short),group('b',short)]});
const root = rootStart;
const frame = {x:0,y:0,width:1000,height:450};
const placements=resolveLayout(root,frame,REGISTRY);
const filled=resolveLayout(rootFilled,frame,REGISTRY).map(p=>p.frame);
const lastBottom=Math.max(...filled.map(f=>f.y+f.height));
const voidShare=(frame.y+frame.height-lastBottom)/frame.height;
const rendered=REGISTRY.get('section').render({id:'a',frame:placements[0].frame,props:placements[0].node});
const nested=resolveLayout(flow({id:'copy',direction:'column',children:[list('body',short)]}),rendered.contentFrame,REGISTRY);
const measured=REGISTRY.get('bullet-list').measureContent({frame:rendered.contentFrame,props:{variant:'body',items:short}}).height;
const prose=['Compare the operating requirements across divisions before selecting a common service model.'];
const widths=[260,740];
const row=flow({id:'row',direction:'row',gap:0,children:widths.map((width,i)=>({...list('row-'+i,prose),size:{width,height:'hug'}}))});
const columns=grid({id:'grid',columns:widths,rows:['hug'],columnGap:0,children:widths.map((_,i)=>({...list('grid-'+i,prose),cell:{column:i,row:0}}))});
const rowFrames=resolveLayout(row,frame,REGISTRY).map(p=>p.frame);
const gridFrames=resolveLayout(columns,frame,REGISTRY).map(p=>p.frame);
console.log(JSON.stringify({heights:placements.map(p=>p.frame.height),voidShare,inner:nested[0].frame.height,measured,rowFrames,gridFrames}));
""")
        # The page must not end in a void: with a leftover policy the hugged
        # groups reach the bottom of their frame. The deleted assertion here
        # required the opposite - two sections under 300 of 450 px.
        self.assertLessEqual(result["voidShare"], 0.08)
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
