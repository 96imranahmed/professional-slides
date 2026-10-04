import unittest
from node_probe import run_node


class RelationshipNetworkTests(unittest.TestCase):
    def test_exact_reciprocity_and_content_clearance(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {relationshipNetwork,RELATIONSHIP_NETWORK_VARIANTS} from './skills/professional-slides/runtime/relationship-network.mjs';
const props=structuredClone(RELATIONSHIP_NETWORK_VARIANTS['hub-ring'].props);
props.nodes[1].body='A longer contribution that must wrap naturally while preserving the shared body role.';
const frame={x:60,y:120,width:1160,height:430},result=relationshipNetwork({id:'network',frame,props});
const nodes=new Map(result.nodes.map(n=>[n.id,n]));
const edges=result.nodes.filter(n=>n.role==='network-edge');
assert.equal(edges.length,props.edges.length);
assert.ok(edges.every(e=>e.data.startArrow&&e.data.endArrow));
for(const edge of edges){
 assert.deepEqual(edge.data.dependencies,[edge.data.from,edge.data.to]);
 for(const id of edge.data.dependencies)assert.equal(nodes.get(id).role,'network-node');
 const a=nodes.get(edge.data.from).frame,b=nodes.get(edge.data.to).frame;
 const outside=(x,y,r)=>x<r.x||x>r.x+r.width||y<r.y||y>r.y+r.height;
 assert.ok(outside(edge.data.x1,edge.data.y1,a));assert.ok(outside(edge.data.x2,edge.data.y2,b));
}
assert.ok(result.nodes.filter(n=>n.type==='text').every(n=>n.style.fontSize.tokenId==='type.body'));
assert.equal(result.nodes.filter(n=>n.role==='network-node-label'&&n.data.part==='body').length,props.nodes.length);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_rejects_invalid_topology_and_insufficient_space(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {relationshipNetwork,RELATIONSHIP_NETWORK_VARIANTS} from './skills/professional-slides/runtime/relationship-network.mjs';
const base=RELATIONSHIP_NETWORK_VARIANTS['hub-ring'].props;
const render=(props,frame={x:0,y:0,width:1160,height:430})=>relationshipNetwork({id:'network',frame,props});
for(const change of [p=>p.nodes[1].id=p.nodes[0].id,p=>p.centerId='missing',p=>p.ringOrder=['a','b','b','d'],p=>p.edges[0].to='missing',p=>p.edges[0].direction='both',p=>p.edges[0].relation='',p=>p.edges.push({...p.edges[0],id:'duplicate'}),p=>p.edges.push({id:'chord',from:'a',to:'c',direction:'none',relation:'relates-to'}),p=>p.edges[0].label='Unplaced text']){
 const props=structuredClone(base);change(props);assert.throws(()=>render(props),/Relationship network:/);
}
assert.throws(()=>render(base,{x:0,y:0,width:1160,height:100}),/frame is too short/);
const directed=structuredClone(RELATIONSHIP_NETWORK_VARIANTS['directed-spokes'].props),edges=render(directed).nodes.filter(n=>n.role==='network-edge');
assert.ok(edges.every(e=>!e.data.startArrow&&e.data.endArrow));
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_non_four_node_layout_preserves_declared_ring_order(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {relationshipNetwork} from './skills/professional-slides/runtime/relationship-network.mjs';
for(const count of [3,5,6]){
 const order=Array.from({length:count},(_,i)=>`p${i}`);
 const props={centerId:'hub',ringOrder:order,nodes:[{id:'hub',label:'Hub'},...order.map(id=>({id,label:id}))],edges:order.map(id=>({id:`edge-${id}`,from:'hub',to:id,direction:'none',relation:'associated-with'}))};
 const result=relationshipNetwork({id:'network',frame:{x:0,y:0,width:1160,height:600},props});
 assert.deepEqual(result.topology.ringOrder,order);
 assert.equal(result.nodes.filter(n=>n.role==='network-node').length,count+1);
 assert.ok(result.nodes.filter(n=>n.role==='network-edge').every(n=>!n.data.startArrow&&!n.data.endArrow));
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


class RelationshipLabelTests(unittest.TestCase):
    def test_wave_roadmap_measures_complete_rows_and_rejects_real_overflow(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('roadmap');
const props={variant:'wave-columns',items:[{heading:'Build the plan',range:'Weeks 1–7',activities:['Interview leadership and reconcile existing planning efforts.','Gather frontline ideas and identify stakeholders.','Test strategic choices against supported trade-offs.','Review the complete evidence with each strategy function.'],deliverables:['Draft objectives and a portfolio of initiatives.','Stakeholder map and listening-session findings.']},{heading:'Refine and communicate',range:'Weeks 8–10',activities:['Prioritize the portfolio.'],deliverables:['Draft strategic plan.']}]};
const frame={x:60,y:100,width:1100,height:500},layout=owner.measureIntrinsic({frame,props});
const nodes=owner.render({id:'waves',frame,props}).nodes;
const activities=nodes.filter(n=>n.role==='roadmap-activities'),deliverables=nodes.filter(n=>n.role==='roadmap-deliverables');
assert.equal(activities.length,2);assert.equal(deliverables.length,2);
assert.ok(deliverables.every(n=>n.frame.y>=Math.max(...activities.map(a=>a.frame.y+a.frame.height))+15.9));
// A frame taller than the natural height now opens the roadmap's rhythm
// (up to its ceiling) rather than drawing it at the top: the rows stay
// complete and inside the grown height, and a frame at the natural height
// draws exactly the natural layout.
assert.ok(deliverables.every(n=>n.frame.y+n.frame.height<=frame.y+Math.min(frame.height,owner.measureCeiling({frame,props}))+0.01));
const snug=owner.render({id:'snug',frame:{...frame,height:layout.height},props}).nodes.filter(n=>n.role==='roadmap-deliverables');
assert.ok(snug.every(n=>n.frame.y+n.frame.height<=frame.y+layout.height));
assert.ok(activities[0].text.includes('each strategy function'));
assert.throws(()=>owner.render({id:'short',frame:{...frame,height:layout.height-1},props}),/complete activity and deliverable rows need/);
assert.throws(()=>owner.render({id:'empty',frame,props:{variant:'wave-columns',items:[]}}),/at least one stage/);
const noRange=owner.render({id:'untimed',frame,props:{variant:'wave-columns',items:[{heading:'Review',activities:['Test the complete evidence.']}]}}).nodes;
assert.equal(noRange.filter(n=>n.role==='roadmap-range'||n.role==='roadmap-deliverables').length,0);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])

    def test_roadmap_bands_contain_and_do_not_overpaint_complete_labels(self):
        # Stages that carry their period are set as dated stages
        # (schedule-stages.mjs): each label inside its phase block, painted
        # over it, and the period drawn whole - in columns in a shallow frame
        # and in rows in a tall one. Bare labels keep the strip and its bands.
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const items=[{label:'Diagnose',period:'Five months'},{label:'Select',period:'1–2 months'},{label:'Design',period:'3–6 months'},{label:'Execute',period:'24–36 months'}];
const inside=(n,b)=>n.frame.x>=b.frame.x && n.frame.y>=b.frame.y && n.frame.x+n.frame.width<=b.frame.x+b.frame.width+0.01 && n.frame.y+n.frame.height<=b.frame.y+b.frame.height+0.01;
const drawn=(frame,props)=>{const {nodes}=REGISTRY.get('roadmap').render({id:'stages',frame,props});
  const labels=nodes.filter(n=>n.role==='roadmap-label'),blocks=nodes.filter(n=>n.role==='roadmap-phase-surface'),whens=nodes.filter(n=>n.role==='roadmap-when');
  return {labels:labels.map(n=>n.text),periods:whens.map(n=>n.text),blocks:blocks.length,contained:labels.every((n,i)=>inside(n,blocks[i])),paintOrder:labels.every((n,i)=>nodes.indexOf(n)>nodes.indexOf(blocks[i])),
    onFrame:nodes.every(n=>!n.frame||n.frame.y+(n.frame.height||0)<=frame.y+frame.height+0.01)};};
const strip=REGISTRY.get('roadmap').render({id:'strip',frame:{x:0,y:0,width:1160,height:215},props:{items:items.map(i=>i.label),active:1}}).nodes;
const stripLabels=strip.filter(n=>n.role==='process-label'),bands=strip.filter(n=>n.role==='roadmap-phase');
console.log(JSON.stringify({across:drawn({x:0,y:0,width:1160,height:120},{items,active:1}),down:drawn({x:0,y:0,width:1160,height:400},{items,active:1}),
  strip:{labels:stripLabels.length,contained:stripLabels.every((n,i)=>inside(n,bands[i])),paintOrder:stripLabels.every((n,i)=>strip.indexOf(n)>strip.indexOf(bands[i]))}}));
""")
        for name in ("across", "down"):
            with self.subTest(arrangement=name):
                drawn = result[name]
                self.assertEqual(drawn["labels"], ["Diagnose", "Select", "Design", "Execute"])
                self.assertEqual(drawn["blocks"], 4)
                self.assertTrue(drawn["contained"])
                self.assertTrue(drawn["paintOrder"])
                self.assertTrue(drawn["onFrame"])
                self.assertIn("24–36 months", drawn["periods"][3])
        self.assertEqual(result["strip"], {"labels": 4, "contained": True, "paintOrder": True})

    def test_process_detail_is_visible_and_overflow_rejects(self):
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const render=height=>REGISTRY.get('process').render({id:'steps',frame:{x:0,y:0,width:600,height},props:{items:[{label:'Assess',detail:'Confirm the operating constraints.'},{label:'Select',detail:'Choose the design priorities.'}]}});
let error=null;try{render(50);}catch(e){error=e.message;}
console.log(JSON.stringify({text:render(240).nodes.filter(n=>n.role==='process-label').map(n=>n.text),error}));
""")
        self.assertIn("Confirm the operating constraints.", result["text"][0])
        self.assertIn("complete label", result["error"])
