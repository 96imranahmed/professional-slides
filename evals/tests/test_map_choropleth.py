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


class AnnotatedMapTests(unittest.TestCase):
    """The map as the page, not as a picture beside one.

    The label lane has always carried the feature's name and nothing else, so a
    page whose subject was five named places had to put the sentences in a
    column next to a contextual photograph and leave the reader to match them
    up. With a note per region the map carries the boundary, the value and what
    it means, keyed by a leader to the region it is about.
    """

    def test_a_region_note_travels_to_its_lane(self):
        run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {CHOROPLETH_MAP_SAMPLE} from './skills/professional-slides/runtime/maps.mjs';
const map=REGISTRY.get('map'), frame={x:0,y:0,width:1160,height:480};
const withNotes=structuredClone(CHOROPLETH_MAP_SAMPLE);
withNotes.choropleth.values[0].note='Rent at 62% of the eastern figure, and a shorter commute.';
withNotes.choropleth.values[1].note='Pay is 34% higher and the tax bill takes a third of it back.';
const nodes=map.render({id:'m',frame,props:withNotes}).nodes;
const notes=nodes.filter(n=>n.role==='map-note');
assert.equal(notes.length,2,'one note per region');
assert.ok(notes.every(n=>n.style.wrap===true),'a sentence wraps; a name does not');
assert.ok(notes.every(n=>n.data.featureId),'each note is keyed to its region');
// The name goes bold once it is heading a sentence rather than standing alone.
const labels=nodes.filter(n=>n.role==='map-label');
assert.ok(labels.every(n=>n.style.bold===true));
// Each note sits under its own label, in the same lane.
for (const note of notes) {
  const label=labels.find(l=>l.data.featureId===note.data.featureId);
  assert.equal(note.frame.x,label.frame.x);
  assert.ok(note.frame.y>=label.frame.y+label.frame.height);
}
// A leader still runs from the region to the lane.
assert.ok(nodes.filter(n=>n.role==='map-label-leader').length>=2);

// Without notes nothing changes: names only, unbolded, and a narrower lane.
const bare=map.render({id:'m',frame,props:CHOROPLETH_MAP_SAMPLE}).nodes;
assert.equal(bare.filter(n=>n.role==='map-note').length,0);
assert.ok(bare.filter(n=>n.role==='map-label').every(n=>!n.style.bold));
const laneOf=(ns)=>ns.find(n=>n.role==='map-label').frame.width;
assert.ok(laneOf(nodes)>laneOf(bare),'the lane widens to hold a sentence');

// A note has to be a sentence, not an empty string.
const blank=structuredClone(CHOROPLETH_MAP_SAMPLE);
blank.choropleth.values[0].note='   ';
assert.throws(()=>map.render({id:'m',frame,props:blank}),/sentence about that region/);
console.log(JSON.stringify({ok:true}));
''')
