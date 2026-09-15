import unittest
from node_probe import run_node


class ChoroplethTests(unittest.TestCase):
    def test_feature_values_and_external_labels_share_quantitative_legend(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {CHOROPLETH_MAP_SAMPLE} from './skills/professional-slides/runtime/maps.mjs';
const props=structuredClone(CHOROPLETH_MAP_SAMPLE),frame={x:60,y:140,width:600,height:400};
const compile=p=>compileDeck({slides:[{id:'map',frame,composition:component({id:'regions',component:'map',frame,props:p})}]},REGISTRY).slides[0].nodes;
const nodes=compile(props),land=nodes.filter(n=>n.role==='map-land'),labels=nodes.filter(n=>n.role==='map-label');
assert.equal(land.length,2);assert.equal(labels.length,2);
assert.ok(land.every(n=>n.type==='shape'&&n.data.geometry==='customPolygon'&&n.data.paths.length&&n.data.sourceSha256==='0'.repeat(64)));
assert.deepEqual(land.map(n=>n.data.value),[-2,8]);
assert.deepEqual(land.map(n=>n.style.fill.tokenId),['color.heat.red-white-green.0','color.heat.red-white-green.10']);
assert.equal(nodes.filter(n=>n.role==='legend-swatch').length,11);
assert.deepEqual(nodes.filter(n=>n.role==='legend-label').map(n=>n.text),['-2.0%','8.0%']);
for(const n of nodes)assert.ok(n.frame.x>=frame.x-.01&&n.frame.y>=frame.y-.01&&n.frame.x+n.frame.width<=frame.x+frame.width+.01&&n.frame.y+n.frame.height<=frame.y+frame.height+.01,n.id);
assert.ok(labels.every(n=>n.data.textLayout.lines.length&&n.data.labelPoint.length===2));
let bad=structuredClone(props);bad.choropleth.values.pop();assert.throws(()=>compile(bad),/every feature/);
bad=structuredClone(props);bad.choropleth.values[1].featureId='west';assert.throws(()=>compile(bad),/unique known/);
bad=structuredClone(props);bad.choropleth.values[1].value=9;assert.throws(()=>compile(bad),/outside/);
bad=structuredClone(props);bad.choropleth.scale.domain=[1,1];assert.throws(()=>compile(bad),/increasing/);
bad=structuredClone(props);bad.geography.geojson.features[0].properties.labelPoint=undefined;assert.throws(()=>compile(bad),/labelPoint/);
bad=structuredClone(props);bad.highlightCountries=['west'];assert.throws(()=>compile(bad),/cannot combine/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_quantitative_legend_uses_domain_and_rejects_impossible_fit(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {legendNodes,QUANTITATIVE_LEGEND_SAMPLE} from './skills/professional-slides/runtime/legends.mjs';
const frame={x:20,y:30,width:300,height:64};
const nodes=legendNodes({id:'scale',frame,props:QUANTITATIVE_LEGEND_SAMPLE});
const bins=nodes.filter(n=>n.role==='legend-swatch');
assert.equal(bins.reduce((sum,n)=>sum+n.frame.width,0),300);
assert.equal(bins[0].frame.width,15);assert.equal(bins[10].frame.width,15);
assert.ok(nodes.filter(n=>n.type==='text').every(n=>n.data.textLayout.lines.length===1));
assert.throws(()=>legendNodes({id:'small',frame:{...frame,width:40},props:QUANTITATIVE_LEGEND_SAMPLE}),/fit|Unbreakable/);
assert.throws(()=>legendNodes({id:'bad',frame,props:{...QUANTITATIVE_LEGEND_SAMPLE,placement:'right'}}),/top placement/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_relative_level_scale_has_visible_midpoint_and_explicit_low_high(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {CHOROPLETH_MAP_SAMPLE} from './skills/professional-slides/runtime/maps.mjs';
import {normalizeQuantitativeScale} from './skills/professional-slides/runtime/legends.mjs';
const props=structuredClone(CHOROPLETH_MAP_SAMPLE),frame={x:60,y:140,width:600,height:400};
props.choropleth.scale={domain:[-2,8],unit:'%',palette:'red-yellow-green',semantics:'relative-level'};
props.choropleth.values[0].value=3;
const nodes=compileDeck({slides:[{id:'relative',composition:component({id:'regions',component:'map',frame,props})}]},REGISTRY).slides[0].nodes;
const middle=nodes.find(n=>n.role==='map-land'&&n.data.featureId==='west');
assert.equal(middle.style.fill.tokenId,'color.heat.red-yellow-green.5');
assert.equal(middle.style.fill.value,'#F4E76E');
assert.equal(middle.style.stroke.tokenId,'color.rule');
assert.equal(middle.data.scaleSemantics,'relative-level');
assert.deepEqual(nodes.filter(n=>n.role==='legend-label').map(n=>n.text),['Low -2.0%','High 8.0%']);
assert.ok(nodes.filter(n=>n.role==='legend-swatch').every(n=>n.data.scaleSemantics==='relative-level'));
assert.throws(()=>normalizeQuantitativeScale({...props.choropleth.scale,semantics:undefined}),/relative-level/);
assert.throws(()=>normalizeQuantitativeScale({...props.choropleth.scale,semantics:'sign'}),/semantics/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
