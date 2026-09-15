"""Regression checks for narrative contracts and bounded review preparation."""
import unittest
from test_source_structure import run_node

class SkillAmendmentTests(unittest.TestCase):
    def test_local_cache_scope_and_actual_dependencies(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {slideReviewKey} from './skills/professional-slides/runtime/production-policy.mjs';
const s={id:'a',sourceEvidence:[{id:'e',sourceExtract:'Original',slides:['a']}]};
const inv={question:'Choose',governingAnswer:'One',outline:['a','b'],claimLedger:[],slides:[s]};
const key=(i=inv,t=s,d=[])=>slideReviewKey(i,t,'image',{},d);
assert.equal(key(),key({...inv,governingAnswer:'Two',claimLedger:[{id:'new'}],synthesisGroups:['new']}));
assert.equal(key(),key(inv,{...s,sourceEvidence:[{...s.sourceEvidence[0],slides:['a','b']}]}));
assert.notEqual(key(),key(inv,{...s,sourceEvidence:[{...s.sourceEvidence[0],sourceExtract:'Changed'}]}));
assert.notEqual(key(),key({...inv,originalBrief:'Changed brief'}));
assert.notEqual(key(inv,s,[{id:'b',renderHash:'1'}]),key(inv,s,[{id:'b',renderHash:'2'}]));
const nav={...s,pageKind:'tracker'};assert.notEqual(key(inv,nav),key({...inv,outline:['b','a']},nav));
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_evidence_deduplication_and_target_specific_schema(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {deduplicateReviewEvidence} from './skills/professional-slides/runtime/production-policy.mjs';
import {copyReviewSchema,buildCopyInventory} from './skills/professional-slides/runtime/copy-check.mjs';
const e={id:'e',sourceExtract:'Unique exact evidence'},s={id:'a',sourceEvidence:[e]},packet={slides:[s,{...s,id:'b'}],dependencyContext:[s]};
const inventory=buildCopyInventory({slides:[{id:'a',nodes:[]},{id:'b',nodes:[]}]},{slides:[{id:'a'},{id:'b',dependsOn:['a'],argument:{buildsOn:['a']}}]});assert.deepEqual(inventory.slides[1].dependencies,['a']);
const before=JSON.stringify(packet),packed=deduplicateReviewEvidence(packet);
assert.equal(JSON.stringify(packed).split('Unique exact evidence').length,2);assert.equal(JSON.stringify(packet),before);
assert.deepEqual(packed.slides[1].sourceEvidenceIds,['e']);assert.deepEqual(packed.dependencyContext[0].sourceEvidenceIds,['e']);
assert.throws(()=>deduplicateReviewEvidence({slides:[s,{id:'b',sourceEvidence:[{...e,sourceExtract:'Different'}]}]}),/Conflicting/);
const schema=copyReviewSchema([{id:'a',text:'A'},{id:'b',text:'B'}],['a','b','e'],{evidenceByTarget:{a:['a','e'],b:[]}});
assert.deepEqual(schema.properties.items.properties.a.properties.evidenceIds.items.enum,['e']);
assert.equal(schema.properties.items.properties.b.properties.evidenceIds.maxItems,0);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_shared_concurrency_and_failure_release(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {createReviewLimiter} from './skills/professional-slides/runtime/production-policy.mjs';
const limit=createReviewLimiter(2);let active=0,peak=0,started=0;let unblock;
const barrier=new Promise(r=>unblock=r);
const tasks=Array.from({length:5},(_,i)=>limit(async()=>{active++;started++;peak=Math.max(peak,active);if(started===2)unblock();try{await barrier;if(i===0)throw new Error('Expected');return i;}finally{active--;}}));
const results=await Promise.allSettled(tasks);assert.equal(peak,2);assert.equal(active,0);assert.equal(started,5);assert.equal(results.filter(r=>r.status==='rejected').length,1);
assert.equal(await limit(async()=>42),42);assert.throws(()=>createReviewLimiter(9),/Concurrency/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_continuity_claim_ownership_and_generated_trackers(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {validateNarrative,trackerStates} from './skills/professional-slides/runtime/argument-contract.mjs';
const spec={deckPlan:{slides:[{id:'a'},{id:'b',argument:{buildsOn:['a'],newContribution:'Compare the shortlisted places',decisionConsequence:'Choose a visit order'}}]},context:{claimLedger:[{id:'c',statement:'Claim',proofSlide:'b',summarySlides:['a']}]}};
validateNarrative(spec);spec.deckPlan.slides[1].argument.buildsOn=['b'];assert.throws(()=>validateNarrative(spec),/preceding/);spec.deckPlan.slides[1].argument.buildsOn=['missing'];assert.throws(()=>validateNarrative(spec),/preceding/);spec.deckPlan.slides[1].argument.buildsOn=['a'];
spec.context.claimLedger.push({...spec.context.claimLedger[0]});assert.throws(()=>validateNarrative(spec),/ownership/);
const sections=[{id:'work',label:'Work'},{id:'home',label:'Home'}],states=trackerStates(sections);
assert.equal(states.overview.selectedId,undefined);assert.equal(states.sections[1].selectedId,'home');assert.deepEqual(states.sections[0].items,states.overview.items);
states.sections[0].items[0].label='Changed';assert.equal(states.overview.items[0].label,'Work');
assert.equal(trackerStates([...sections].reverse()).overview.items[0].id,'home');assert.throws(()=>trackerStates([sections[0],sections[0]]),/unique/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
