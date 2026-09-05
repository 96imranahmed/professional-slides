import unittest

from test_source_structure import run_node


class InsightTreeTableTests(unittest.TestCase):
    def test_branching_contract_and_aligned_implication_rows(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const definition=REGISTRY.get('insight-tree-table');
const frame={x:60,y:150,width:1160,height:500};
const nodes=definition.render({id:'tree-table',frame,props:structuredClone(definition.sample)}).nodes;
assert.equal(definition.category,'relationship');
assert.equal(definition.guidance.useWhen.includes('branches'),true);
assert.equal(nodes.filter(node=>node.role==='tree-root').length,1);
assert.equal(nodes.filter(node=>node.role==='tree-node').length,7);
assert.equal(nodes.filter(node=>node.role==='insight-tree-insight-surface').length,5);
assert.equal(nodes.filter(node=>node.role==='insight-tree-implication-surface').length,5);
assert.equal(nodes.filter(node=>node.role==='relationship-disc').length,5);
assert.equal(nodes.filter(node=>node.role==='relationship-arrow').length,5);
assert.ok(nodes.filter(node=>node.role==='relationship-arrow').every(node=>node.data.endArrow&&node.data.endArrowType==='triangle'));
assert.equal(new Set(nodes.map(node=>node.id)).size,nodes.length);
const leaves=nodes.filter(node=>node.role==='tree-node'&&node.data.depth===2);
for(const leaf of leaves){
 const row=leaf.data.row;
 const insight=nodes.find(node=>node.role==='insight-tree-insight-surface'&&node.data.row===row);
 const implication=nodes.find(node=>node.role==='insight-tree-implication-surface'&&node.data.row===row);
 const disc=nodes.find(node=>node.role==='relationship-disc'&&node.data.row===row);
 const arrow=nodes.find(node=>node.role==='relationship-arrow'&&node.data.row===row);
 const center=node=>node.frame.y+node.frame.height/2;
 assert.ok(Math.abs(center(leaf)-center(insight))<.01);
 assert.ok(Math.abs(center(insight)-center(implication))<.01);
 assert.ok(Math.abs(center(disc)-center(leaf))<.01);
 assert.ok(Math.abs(arrow.data.y1-center(leaf))<.01);
}
assert.ok(nodes.filter(node=>node.role.endsWith('-surface')).every(node=>node.style.fill.tokenId==='color.surfaceMuted'));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_open_rows_and_invalid_tree_inputs(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const definition=REGISTRY.get('insight-tree-table'),frame={x:60,y:150,width:1160,height:500};
const sample=structuredClone(definition.sample);sample.rowTreatment='open';
const nodes=definition.render({id:'open',frame,props:sample}).nodes;
assert.ok(nodes.filter(node=>node.role.endsWith('-surface')).every(node=>node.style.fill.tokenId==='color.surface'));
for(const mutate of [
 props=>{props.branches=[];},
 props=>{props.branches[0].leaves=[];},
 props=>{props.branches[0].leaves[0].id=props.root.id;},
 props=>{props.branches[0].leaves[0].implications=[];},
 props=>{props.rowTreatment='striped';}
]){
 const props=structuredClone(definition.sample);mutate(props);
 assert.throws(()=>definition.render({id:'bad',frame,props}));
}
assert.throws(()=>definition.render({id:'short',frame:{...frame,height:180},props:definition.sample}),/vertical space/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])


if __name__ == "__main__":
    unittest.main()
