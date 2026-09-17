import unittest
from node_probe import run_node


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


class InlineEmphasisTests(unittest.TestCase):
    def test_mixed_metrics_wrap_once_and_reconstruct_complete_text(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {measureText,measureTextRuns} from './skills/professional-slides/runtime/text-layout.mjs';
const text='Review the complete evidence with the working team and preserve every condition.';
const options={fontSize:12,wrapWidthRatio:1};
assert.deepEqual({...measureTextRuns([{text,bold:false}],200,options),runs:undefined,sourceRuns:undefined},{...measureText(text,200,options),runs:undefined,sourceRuns:undefined});
const mixed=measureTextRuns([{text:'Review the complete evidence',bold:true},{text:' with the working team and preserve every condition.',bold:false}],180,options);
assert.equal(mixed.runs.map(r=>r.text).join(''),mixed.text);
assert.equal(mixed.lines.join(' ').replace(/\\s+/g,' '),text);
assert.ok(mixed.lines.length>2);
assert.ok(mixed.runs.some(r=>r.bold)&&mixed.runs.some(r=>!r.bold));
assert.equal(mixed.runs.filter(r=>r.bold).map(r=>r.text).join(' ').replace(/\\s+/g,' ').trim(),'Review the complete evidence');
assert.ok(mixed.width<=180);
assert.throws(()=>measureTextRuns([{text:'Invalid',bold:true,fontSize:8}],100),/boolean bold/);
assert.throws(()=>measureTextRuns([{text:'Unbreakableword',bold:true}],5),/Unbreakable/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_phase_emphasis_stays_one_semantic_text_node(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component,textPrimitive} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {PHASE_WORKSTREAM_VARIANTS} from './skills/professional-slides/runtime/phase-workstreams.mjs';
import {renderSlideHtml} from './skills/professional-slides/runtime/adapters/html.mjs';
const props=structuredClone(PHASE_WORKSTREAM_VARIANTS['phase-workstreams'].props),frame={x:60,y:140,width:1160,height:500};
const compile=p=>compileDeck({slides:[{id:'e',density:'pre-read',frame,composition:component({id:'phases',component:'roadmap',frame,props:p})}]},REGISTRY);
const deck=compile(props),nodes=deck.slides[0].nodes,activities=nodes.filter(n=>n.role==='roadmap-activity');
assert.equal(activities.length,4);
for(const n of activities){assert.ok(n.runs.length>1);assert.equal(n.runs.map(r=>r.text).join(''),n.text);assert.equal(n.style.fontSize.value,9);}
assert.ok(renderSlideHtml(deck.slides[0]).includes('font-weight:700'));
assert.ok(renderSlideHtml(deck.slides[0]).includes('font-weight:400'));
props.phases[0].workstreams[0].activities[0].lead='Unmatched prefix';
assert.throws(()=>compile(props),/exact complete-word text prefix/);
assert.throws(()=>textPrimitive({id:'bad',frame,text:'Hello',runs:[{text:'Different',bold:true}]}),/reconstruct/);
assert.throws(()=>textPrimitive({id:'bad',frame,text:'Hello',runs:[{text:'Hello',bold:true,color:'red'}]}),/only bold/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
