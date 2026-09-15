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
