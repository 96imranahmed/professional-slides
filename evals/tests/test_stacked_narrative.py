import unittest

from test_source_structure import run_node


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
