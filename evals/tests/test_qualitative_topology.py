import unittest
from node_probe import run_node


class QualitativeTopologyTests(unittest.TestCase):
    def test_qualitative_states_have_native_schematic_geometry_without_quantities(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {renderQualitativeFunnel,measureQualitativeFunnel,QUALITATIVE_FUNNEL_SAMPLE} from './skills/professional-slides/runtime/qualitative-topology.mjs';
const props=structuredClone(QUALITATIVE_FUNNEL_SAMPLE),frame={x:60,y:120,width:1160,height:600};
const rendered=renderQualitativeFunnel({id:'funnel',frame,props});
const states=rendered.nodes.filter(n=>n.role==='funnel-stage');
assert.equal(states.length,3);
assert.ok(states.every(n=>n.type==='shape'&&n.data.geometry==='customPolygon'&&n.data.schematic&&n.data.basis==='qualitative-selection'));
assert.ok(states[0].frame.width>states[1].frame.width&&states[1].frame.width>states[2].frame.width);
assert.ok(!states.some(n=>'value' in n.data||'count' in n.data));
assert.deepEqual(rendered.nodes.filter(n=>n.role==='funnel-label').map(n=>n.data.stageId),props.stages.map(s=>s.id));
assert.ok(rendered.nodes.find(n=>n.role==='funnel-outcome').frame.y>states.at(-1).frame.y+states.at(-1).frame.height);
assert.ok(rendered.nodes.filter(n=>n.type==='text').every(n=>n.style.wrap===false&&n.data.textLayout.text===n.text));
assert.throws(()=>measureQualitativeFunnel({frame:{...frame,height:50},props}),/requires/);
for(const bad of [{...props,basis:'measured'},{...props,denominator:100},{...props,stages:props.stages.map(s=>({...s,value:1}))}])assert.throws(()=>measureQualitativeFunnel({frame,props:bad}));
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_phase_hierarchy_preserves_parent_children_and_unscaled_duration_strings(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {renderPhaseHierarchy,measurePhaseHierarchy,PHASE_HIERARCHY_SAMPLE} from './skills/professional-slides/runtime/qualitative-topology.mjs';
const props=structuredClone(PHASE_HIERARCHY_SAMPLE),frame={x:60,y:120,width:1160,height:600};
props.phases.forEach((p,i)=>p.duration=['5 months','1–2 months','3–6 months','24–36 months'][i]);
const rendered=renderPhaseHierarchy({id:'phases',frame,props}),parents=rendered.nodes.filter(n=>n.data.semantic?.kind==='programme-phase'),children=rendered.nodes.filter(n=>n.data.semantic?.kind==='phase-substage');
assert.equal(parents.length,4);assert.equal(children.length,3);
assert.equal(new Set(parents.map(n=>n.frame.width)).size,1);
assert.equal(new Set(parents.map(n=>n.frame.y)).size,1);
assert.ok(parents.every(n=>n.data.schematic&&n.data.durationBasis==='source-text-not-geometric'));
assert.deepEqual(rendered.nodes.filter(n=>n.role==='phase-duration').map(n=>n.text),props.phases.map(p=>p.duration));
assert.ok(children.every(n=>n.data.semantic.relatedTo.includes(parents[0].id)&&n.frame.y>parents[0].frame.y));
const expansion=rendered.nodes.find(n=>n.data.semantic?.kind==='phase-expansion');
assert.ok(expansion.data.semantic.relatedTo.includes(parents[0].id));
assert.ok(children.every(n=>expansion.data.semantic.relatedTo.includes(n.id)));
assert.equal(rendered.nodes.find(n=>n.role==='phase-annotation').data.phaseId,'deliver');
assert.ok(rendered.nodes.filter(n=>n.type==='text').every(n=>n.style.wrap===false&&n.data.textLayout.text===n.text));
assert.throws(()=>measurePhaseHierarchy({frame,props:{...props,expandedPhaseId:'unknown'}}),/keyed/);
assert.throws(()=>measurePhaseHierarchy({frame:{...frame,height:40},props}),/requires/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_registered_variants_compile_at_density_without_changing_legacy_defaults(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {QUALITATIVE_FUNNEL_SAMPLE,PHASE_HIERARCHY_SAMPLE} from './skills/professional-slides/runtime/qualitative-topology.mjs';
const registry=createRegistry();
assert.equal(registry.get('funnel').resolveVariant({}),'quantitative');
assert.equal(registry.get('timeline').resolveVariant({}),'process');
const frame={x:60,y:120,width:1160,height:550};
for(const [name,props]of [['funnel',QUALITATIVE_FUNNEL_SAMPLE],['timeline',PHASE_HIERARCHY_SAMPLE]]){
 const deck=compileDeck({density:'live-pitch',slides:[{id:name,frame,composition:component({id:'topology',component:name,frame,props})}]},registry);
 const nodes=deck.slides[0].nodes;
 assert.ok(nodes.every(n=>n.frame.x>=frame.x-.01&&n.frame.x+n.frame.width<=frame.x+frame.width+.01&&n.frame.y+n.frame.height<=frame.y+frame.height+.01));
 assert.ok(nodes.filter(n=>n.type==='text').every(n=>['type.heading','type.body'].includes(n.style.fontSize.tokenId)));
}
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
