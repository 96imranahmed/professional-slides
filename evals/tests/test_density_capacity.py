import unittest

from test_source_structure import run_node


class DensityCapacityTests(unittest.TestCase):
    def test_extended_charts_tables_and_trees_promote_the_complete_page(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import {planDeck,planSlide,resolveSlideDensity} from './skills/professional-slides/runtime/planner.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {INSIGHT_TREE_TABLE_FOUR_BRANCH_SAMPLE} from './skills/professional-slides/runtime/insight-tree-table.mjs';

const item=(component,props)=>({id:'exhibit',job:'show the extended evidence',component,props,frame:{x:0,y:0,width:1160,height:490}});
const treePlan={id:'tree-density',title:'Branches converge on one implication',layout:'absolute',copyBudget:{maxWordsPerSlide:160,rationale:'Capacity fixture'},items:[item('insight-tree-table',structuredClone(INSIGHT_TREE_TABLE_FOUR_BRANCH_SAMPLE))]};
const tree=planSlide(treePlan);
assert.equal(tree.spec.density,'pre-read');
assert.equal(tree.decision.density.requested,'executive');
assert.equal(tree.decision.density.required,'pre-read');
assert.equal(tree.decision.density.reasons[0].component,'insight-tree-table');

const chartProps={categories:Array.from({length:9},(_,i)=>`Period ${i+1}`),series:[{name:'Measure',values:Array.from({length:9},(_,i)=>i+1)}]};
assert.equal(resolveSlideDensity({id:'chart-density',items:[item('chart.column',chartProps)]}).resolved,'pre-read');
assert.equal(resolveSlideDensity({id:'chart-appendix',items:[item('chart.column',{...chartProps,categories:Array.from({length:13},(_,i)=>String(i+1)),series:[{name:'Measure',values:Array.from({length:13},(_,i)=>i+1)}]})]}).resolved,'appendix');
assert.equal(resolveSlideDensity({id:'table-density',items:[item('table',{columns:['A','B','C'],rows:Array.from({length:6},(_,i)=>[`Row ${i+1}`,'A','B'])})]}).resolved,'pre-read');
assert.equal(resolveSlideDensity({id:'table-appendix',items:[item('table',{columns:['A','B','C'],rows:Array.from({length:9},(_,i)=>[`Row ${i+1}`,'A','B'])})]}).resolved,'appendix');
assert.equal(resolveSlideDensity({id:'wide-table-appendix',items:[item('table',{columns:Array.from({length:7},(_,i)=>`Column ${i+1}`),rows:[Array.from({length:7},(_,i)=>`Value ${i+1}`)]})]}).resolved,'appendix');
assert.equal(resolveSlideDensity({id:'ordinary-chart',items:[item('chart.line',{categories:Array.from({length:8},(_,i)=>String(i+1)),series:[{name:'Measure',values:Array(8).fill(1)}]})]}).resolved,'executive');
assert.equal(resolveSlideDensity({id:'grouped-chart',items:[item('chart.column',{categories:Array.from({length:5},(_,i)=>String(i+1)),series:[{name:'Actual',values:Array(5).fill(1)},{name:'Plan',values:Array(5).fill(2)}]})]}).resolved,'pre-read');
assert.equal(resolveSlideDensity({id:'dense-grouped-chart',items:[item('chart.column',{categories:Array.from({length:7},(_,i)=>String(i+1)),series:[{name:'Actual',values:Array(7).fill(1)},{name:'Plan',values:Array(7).fill(2)}]})]}).resolved,'appendix');
assert.equal(resolveSlideDensity({id:'extended-horizons',items:[item('chart.horizons',{variant:'stepped-minimal',horizons:Array.from({length:9},(_,i)=>({id:`h${i+1}`,label:`H${i+1}`,title:`Stage ${i+1}`}))})]}).resolved,'pre-read');
assert.throws(()=>resolveSlideDensity({id:'bad-density',density:'tiny',items:[]}),/Unknown density profile/);

const deck=planDeck({id:'density-deck',slides:[treePlan]},REGISTRY).deck;
const slide=deck.slides[0];
assert.equal(slide.density,'pre-read');
assert.equal(slide.tokens['type.body'].value,12.6);
assert.equal(slide.tokens['type.chartLabel'].value,12.6);
assert.equal(slide.tokens['type.actionTitle'].value,27);
assert.ok(slide.nodes.filter(node=>node.role==='node-label'||node.role==='insight-tree-insight-text'||node.role==='insight-tree-implication-text').every(node=>node.style.fontSize.value===12.6));
assert.equal(slide.nodes.find(node=>node.role==='action-title').style.fontSize.value,27);
assert.equal(slide.nodes.filter(node=>node.role==='tree-node'&&node.data.depth===1).length,4);
assert.equal(slide.nodes.filter(node=>node.role==='tree-node'&&node.data.depth===2).length,7);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])


if __name__ == "__main__":
    unittest.main()
