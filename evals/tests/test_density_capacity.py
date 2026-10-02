import unittest

from node_probe import run_node


class DensityCapacityTests(unittest.TestCase):
    def test_explicit_family_density_survives_cardinality_but_not_real_overflow(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props={columns:[{label:'Provider',type:'category'},{label:'Arrangement',type:'text'}],rows:Array.from({length:9},(_,i)=>[`Provider ${i+1}`,'Captive'])};
const plan={id:'readable',title:'Providers retain their own financing channel',density:'executive',layout:'absolute',copyBudget:{maxWordsPerSlide:100,rationale:'Nine short provider records'},items:[{id:'providers',job:'Compare financing arrangements',component:'table',props,frame:{x:0,y:0,width:1160,height:500}}]};
const output=planDeck({id:'providers',slides:[plan]},REGISTRY);
const slide=output.deck.slides[0],text=slide.nodes.filter(n=>n.role==='table-cell-text');
assert.equal(slide.density,'executive');
assert.ok(text.length>=18);assert.ok(text.every(n=>n.style.fontSize.tokenId==='type.body'));
const tooShort=structuredClone(plan);tooShort.items[0].frame.height=180;
assert.throws(()=>planDeck({id:'overflow',slides:[tooShort]},REGISTRY),/table|fit|height/i);
const compact=structuredClone(plan);compact.items[0].props.density='compact';
const compactSlide=planDeck({id:'compact',slides:[compact]},REGISTRY).deck.slides[0];
assert.equal(compactSlide.density,'executive');
assert.ok(compactSlide.nodes.filter(n=>n.role==='table-cell-text').every(n=>n.style.fontSize.tokenId==='type.compact'));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])

    def test_extended_trees_keep_the_pages_size_and_charts_step_only_their_labels(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import {planDeck,planSlide,resolveSlideDensity} from './skills/professional-slides/runtime/planner.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {INSIGHT_TREE_TABLE_FOUR_BRANCH_SAMPLE} from './skills/professional-slides/runtime/insight-tree-table.mjs';

const item=(component,props)=>({id:'exhibit',job:'show the extended evidence',component,props,frame:{x:0,y:0,width:1160,height:490}});
const treePlan={id:'tree-density',title:'Branches converge on one implication',layout:'absolute',copyBudget:{maxWordsPerSlide:160,rationale:'Capacity fixture'},items:[item('insight-tree-table',structuredClone(INSIGHT_TREE_TABLE_FOUR_BRANCH_SAMPLE))]};
const tree=planSlide(treePlan);
// A heavy hierarchy fits by its layout: the page keeps the deck's one body
// size, and the recommendation stays on record with its reason.
assert.equal(tree.spec.density,'executive');
assert.equal(tree.decision.density.requested,'executive');
assert.equal(tree.decision.density.recommended,'pre-read');
assert.equal(tree.decision.density.reasons[0].component,'insight-tree-table');

const chartProps={categories:Array.from({length:9},(_,i)=>`Period ${i+1}`),series:[{name:'Measure',values:Array.from({length:9},(_,i)=>i+1)}]};
// A chart's marks step its own labels down, one step at most; the page's prose keeps the page's size.
const chartOnly=(plan)=>{const d=resolveSlideDensity(plan);return [d.resolved,d.chart];};
assert.deepEqual(chartOnly({id:'chart-density',items:[item('chart.column',chartProps)]}),['executive','pre-read']);
assert.deepEqual(chartOnly({id:'chart-appendix',items:[item('chart.column',{...chartProps,categories:Array.from({length:13},(_,i)=>String(i+1)),series:[{name:'Measure',values:Array.from({length:13},(_,i)=>i+1)}]})]}),['executive','pre-read']);
assert.deepEqual(chartOnly({id:'pre-read-appendix',density:'pre-read',items:[item('chart.column',{...chartProps,categories:Array.from({length:13},(_,i)=>String(i+1)),series:[{name:'Measure',values:Array.from({length:13},(_,i)=>i+1)}]})]}),['pre-read','appendix']);
// Tables step their own type and paginate; they never lower the page density.
assert.equal(resolveSlideDensity({id:'table-density',items:[item('table',{columns:['A','B','C'],rows:Array.from({length:6},(_,i)=>[`Row ${i+1}`,'A','B'])})]}).resolved,'executive');
assert.equal(resolveSlideDensity({id:'table-appendix',items:[item('table',{columns:['A','B','C'],rows:Array.from({length:9},(_,i)=>[`Row ${i+1}`,'A','B'])})]}).resolved,'executive');
assert.equal(resolveSlideDensity({id:'wide-table-appendix',items:[item('table',{columns:Array.from({length:7},(_,i)=>`Column ${i+1}`),rows:[Array.from({length:7},(_,i)=>`Value ${i+1}`)]})]}).resolved,'executive');
assert.deepEqual(chartOnly({id:'ordinary-chart',items:[item('chart.line',{categories:Array.from({length:8},(_,i)=>String(i+1)),series:[{name:'Measure',values:Array(8).fill(1)}]})]}),['executive','executive']);
assert.deepEqual(chartOnly({id:'grouped-chart',items:[item('chart.column',{categories:Array.from({length:5},(_,i)=>String(i+1)),series:[{name:'Actual',values:Array(5).fill(1)},{name:'Plan',values:Array(5).fill(2)}]})]}),['executive','pre-read']);
assert.deepEqual(chartOnly({id:'dense-grouped-chart',items:[item('chart.column',{categories:Array.from({length:7},(_,i)=>String(i+1)),series:[{name:'Actual',values:Array(7).fill(1)},{name:'Plan',values:Array(7).fill(2)}]})]}),['executive','pre-read']);
assert.deepEqual(chartOnly({id:'extended-horizons',items:[item('chart.horizons',{variant:'stepped-minimal',horizons:Array.from({length:9},(_,i)=>({id:`h${i+1}`,label:`H${i+1}`,title:`Stage ${i+1}`}))})]}),['executive','pre-read']);
assert.throws(()=>resolveSlideDensity({id:'bad-density',density:'tiny',items:[]}),/Unknown density profile/);

const deck=planDeck({id:'density-deck',slides:[treePlan]},REGISTRY).deck;
const slide=deck.slides[0];
assert.equal(slide.density,'executive');
assert.equal(slide.tokens['type.body'].value,12);
assert.equal(slide.tokens['type.actionTitle'].value,24);
assert.ok(slide.nodes.filter(node=>node.role==='node-label'||node.role==='insight-tree-insight-text'||node.role==='insight-tree-implication-text').every(node=>node.style.fontSize.value===12));
assert.equal(slide.nodes.find(node=>node.role==='action-title').style.fontSize.value,24);
assert.equal(slide.nodes.filter(node=>node.role==='tree-node'&&node.data.depth===1).length,4);
assert.equal(slide.nodes.filter(node=>node.role==='tree-node'&&node.data.depth===2).length,7);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_one_body_size_across_a_deck(self):
        # A shape preset set its page a size smaller: the executive summary's
        # points came out at 11pt beside 12pt on every other page. The deck's
        # density is its one body size; a typed page cannot set its own.
        result = run_node(r"""
import {composeAll} from './skills/professional-slides/runtime/compose-all.mjs';
import {compilePage} from './skills/professional-slides/runtime/page-types.mjs';
import {scaffoldPage} from './skills/professional-slides/runtime/author-deck.mjs';
const points=Array.from({length:4},(_,i)=>({lead:`Finding ${i+1}.`,text:'A developed statement with its evidence and what follows from it for the decision in front of the board.'}));
const spec={schema:'professional-slides.deck/v3',id:'one-size',slides:[
  {id:'s1',title:'The answer the deck argues, stated in one line',shape:'executive-summary',points},
  {id:'s2',title:'A second page makes its point in prose',points:points.slice(0,3)}]};
const {deck}=composeAll(spec,'.');
const sizes=[...new Set(deck.slides.flatMap(s=>s.nodes.filter(n=>n.role==='list-item').map(n=>n.style.fontSize.value)))];
let refused=null; try { compilePage({...scaffoldPage('numbers'),density:'pre-read'},0); } catch (e) { refused=e.message; }
console.log(JSON.stringify({sizes,refused}));
""")
        self.assertEqual(result["sizes"], [12])
        self.assertIn("`density` is the deck's", result["refused"])


if __name__ == "__main__":
    unittest.main()
