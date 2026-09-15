import unittest
from test_source_structure import run_node


class PhaseWorkstreamsTests(unittest.TestCase):
    def test_nested_relationships_and_shared_bands_survive_compile(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {renderPhaseWorkstreams,measurePhaseWorkstreams,PHASE_WORKSTREAM_TOKENS,PHASE_WORKSTREAM_VARIANTS} from './skills/professional-slides/runtime/phase-workstreams.mjs';
const props=structuredClone(PHASE_WORKSTREAM_VARIANTS['phase-workstreams'].props);
props.phases[0].products[0].additionalPlanned=true;
props.qualifiers=[{id:'additional',text:'* Additional planned products',appliesTo:'additionalPlanned'}];
const frame={x:60,y:150,width:1160,height:480};
const registry=new Map([['roadmap',{id:'roadmap',version:'1',category:'relationship',role:'roadmap',tokens:PHASE_WORKSTREAM_TOKENS,render:renderPhaseWorkstreams}]]);
const spec={density:'pre-read',slides:[{id:'phase',density:'pre-read',frame,composition:component({id:'phases',component:'roadmap',frame,props})}]};
const deck=compileDeck(spec,registry), nodes=deck.slides[0].nodes;
const byRole=r=>nodes.filter(n=>n.role===r);
assert.equal(byRole('roadmap-phase').length,2);
assert.equal(byRole('roadmap-workstream').length,4);
assert.equal(byRole('roadmap-activity').length,4);
assert.equal(byRole('roadmap-product').length,4);
assert.equal(byRole('roadmap-provider-label').length,2);
assert.ok(nodes.filter(n=>['roadmap-phase-surface','roadmap-product-surface','roadmap-leadership-surface'].includes(n.role)).every(n=>n.style.stroke==='none'));
assert.ok(byRole('roadmap-provider-key').every(n=>n.style.stroke.tokenId==='color.rule'));
const parent=byRole('roadmap-product').find(n=>n.data.sourceId==='prepare-product');
const child=byRole('roadmap-product').find(n=>n.data.sourceId==='prepare-child');
assert.equal(child.data.provider,'provider-b');
assert.equal(child.data.workstreamId,'prepare-design');
assert.ok(child.data.semantic.requires.includes(parent.id));
assert.ok(child.frame.x>parent.frame.x);
assert.ok(parent.text.endsWith('*'));
const leadership=byRole('roadmap-leadership-item')[0];
assert.deepEqual(leadership.data.phaseIds,['prepare','deliver']);
assert.ok(!leadership.data.workstreamId);
assert.equal(byRole('roadmap-recurring-product').length,1);
const activities=byRole('roadmap-activity');
assert.ok(activities.every(n=>n.frame.y===activities[0].frame.y));
assert.ok(nodes.every(n=>n.frame.x>=frame.x&&n.frame.x+n.frame.width<=frame.x+frame.width+.001&&n.frame.y+n.frame.height<=frame.y+frame.height+.001));
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_invalid_relationships_and_impossible_capacity_reject(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {renderPhaseWorkstreams,measurePhaseWorkstreams,PHASE_WORKSTREAM_VARIANTS} from './skills/professional-slides/runtime/phase-workstreams.mjs';
const base=PHASE_WORKSTREAM_VARIANTS['phase-workstreams'].props,frame={x:0,y:0,width:1160,height:480};
const check=mutate=>{const props=structuredClone(base);mutate(props);assert.throws(()=>measurePhaseWorkstreams({frame,props}));};
check(p=>p.phases[0].products[0].owner='unknown');
check(p=>p.phases[0].products[0].workstreamId='deliver-design');
check(p=>p.phases[0].products[0].children[0].workstreamId='prepare-engage');
check(p=>p.phases[0].products[0].additionalPlanned=true);
check(p=>p.leadershipBands[0].phaseIds=['unknown']);
check(p=>p.recurringProducts[0].phaseIds=['prepare','prepare']);
check(p=>p.phases[0].workstreams[0].activities[0].id=p.phases[0].id);
const props=structuredClone(base);delete props.phases[0].workstreams[0].activities[0].lead;props.phases[0].workstreams[0].activities[0].text='Complete evidence must be preserved. '.repeat(90);
const intrinsic=measurePhaseWorkstreams({frame:{width:frame.width},props});
assert.equal(intrinsic.height,intrinsic.requiredHeight);
assert.equal(intrinsic.fits,null);
const measured=measurePhaseWorkstreams({frame,props});
assert.equal(intrinsic.height,measured.requiredHeight);
assert.equal(measured.fits,false);
assert.throws(()=>renderPhaseWorkstreams({id:'too-dense',frame,props}),/requires .*px but has/);
const larger={...frame,height:measured.requiredHeight};
const rendered=renderPhaseWorkstreams({id:'complete',frame:larger,props});
assert.equal(rendered.nodes.find(n=>n.data.sourceId===props.phases[0].workstreams[0].activities[0].id).data.originalText,props.phases[0].workstreams[0].activities[0].text);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
