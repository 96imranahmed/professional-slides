import unittest

from node_probe import run_node


class StackedNarrativeTests(unittest.TestCase):
    def test_stacked_examples_expose_top_right_legends(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:0,y:0,width:760,height:420};
for(const id of ['chart.stacked-column','chart.stacked-bar']){
  const owner=REGISTRY.get(id),example=owner.examples['legend-top-right'];
  assert.ok(example);
  const nodes=owner.render({id,frame,props:{...owner.sample,...example.props}}).nodes;
  const swatches=nodes.filter(node=>node.role==='legend-swatch');
  const labels=nodes.filter(node=>node.role==='legend-label');
  const marks=nodes.filter(node=>node.role==='chart-mark');
  assert.equal(swatches.length,3);assert.equal(labels.length,3);
  assert.equal(new Set(swatches.map(node=>Math.round(node.frame.y))).size,1);
  assert.ok(Math.max(...labels.map(node=>node.frame.x+node.frame.width))<=frame.x+frame.width-16+.01);
  assert.ok(Math.max(...swatches.map(node=>node.frame.y+node.frame.height))<Math.min(...marks.map(node=>node.frame.y)));
}
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_narrative_rail_reuses_stack_colours_and_canonical_implication_arrow(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck} from './skills/professional-slides/runtime/core.mjs';
import {goldenFixtureSpecs} from './skills/professional-slides/runtime/golden-fixtures.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const spec=goldenFixtureSpecs().find(item=>item.id==='golden-stacked-and-narrative');
const slide=compileDeck({id:'narrative',palette:'mckinsey',slides:[spec]},REGISTRY).slides[0];
const panels=slide.nodes.filter(node=>node.role==='panel-surface'&&node.data.seriesKey);
const marks=slide.nodes.filter(node=>node.role==='chart-mark');
assert.equal(panels.length,3);
for(const panel of panels){
  const peers=marks.filter(mark=>mark.data.seriesKey===panel.data.seriesKey);
  assert.ok(peers.length>0);
  assert.ok(peers.every(mark=>mark.data.colorIndex===panel.data.colorIndex));
  assert.ok(peers.every(mark=>mark.style.fill.tokenId===panel.style.fill.tokenId));
}
const disc=slide.nodes.find(node=>node.role==='relationship-disc'&&node.data.relation==='implies');
assert.ok(disc);assert.equal(disc.data.arrowVariant,'disc-chevron');
assert.equal(slide.nodes.filter(node=>node.role==='relationship-chevron'&&node.data.relation==='implies').length,2);
assert.equal(slide.nodes.filter(node=>node.role==='connector-label').length,0);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])


if __name__ == '__main__':
    unittest.main()


class StackLabelTests(unittest.TestCase):
    def test_totals_secondary_units_and_small_segments(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const chart=REGISTRY.get('chart.stacked-column');
const frame={x:60,y:120,width:1160,height:510};
const props={categories:['A','B','C','D','E'],series:[{name:'Midpoint',values:[19,12,10,8,9]},{name:'Additional',values:[27,22,23,24,20]}],yMin:0,yMax:50,dataLabels:true,valueFormat:{suffix:'%',decimals:0},stackTotals:[46,34,33,32,29].map((value,i)=>({category:['A','B','C','D','E'][i],value})),secondaryLabels:[{category:'E',series:'Midpoint',value:296000,unit:'workers',valueFormat:{compactUnit:'k',decimals:0}},{category:'E',series:'Additional',value:635000,unit:'workers',valueFormat:{compactUnit:'k',decimals:0}},{category:'E',anchor:'stack-total',value:931000,unit:'workers',valueFormat:{compactUnit:'k',decimals:0}}]};
const nodes=chart.render({id:'counts',frame,props}).nodes;
assert.equal(nodes.filter(n=>n.data?.anchor==='stack-total').length,5);
for(const text of ['9%\n296k workers','20%\n635k workers','29%\n931k workers'])assert.ok(nodes.some(n=>n.text===text),text);
const text=nodes.filter(n=>n.role==='data-label');
for(const n of text)assert.ok(n.frame.y>=frame.y&&n.frame.y+n.frame.height<=frame.y+frame.height);
const small={categories:['Late','Midpoint','Early'],series:[{name:'Adopted',values:[2,21,41]},{name:'Remaining',values:[39,39,38]}],stackTotals:[41,60,79].map((value,i)=>({category:['Late','Midpoint','Early'][i],value})),dataLabels:true,yMin:0,yMax:80,valueFormat:{suffix:'%',decimals:0}};
const result=chart.render({id:'small',frame,props:small}).nodes;
assert.ok(result.some(n=>n.text==='2%'&&n.data.external));
const marks=result.filter(n=>n.role==='chart-mark');
const two=marks.find(n=>n.data.category==='Late'&&n.data.series==='Adopted');
const thirtyNine=marks.find(n=>n.data.category==='Late'&&n.data.series==='Remaining');
assert.ok(Math.abs(two.frame.height/thirtyNine.frame.height-2/39)<.0001);
assert.throws(()=>chart.render({id:'bad',frame,props:{...props,stackTotals:[{category:'A',value:47}]}}),/reconcile/);
assert.doesNotThrow(()=>chart.render({id:'rounded',frame,props:{...props,secondaryLabels:[],stackTotals:[{category:'A',value:47,roundingTolerance:1,roundingReason:'Independently rounded source total'}]}}));
for(const secondary of [{category:'Z',series:'Midpoint',value:1,unit:'workers'},{category:'A',series:'Unknown',value:1,unit:'workers'},{category:'A',series:'Midpoint',anchor:'stack-total',value:1,unit:'workers'}])assert.throws(()=>chart.render({id:'bad',frame,props:{...props,secondaryLabels:[secondary]}}));
assert.throws(()=>REGISTRY.get('chart.column').render({id:'bad',frame,props}),/nonnegative stacked/);
assert.throws(()=>chart.render({id:'bad',frame,props:{...props,dataLabels:false}}),/visible data labels/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
