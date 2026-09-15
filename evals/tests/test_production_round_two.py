import unittest
from test_source_structure import run_node

class ProductionRoundTwoTests(unittest.TestCase):
    def test_page_coverage_and_compact_review(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {buildCopyInventory,addPageReviewTargets,copyReviewSchema,expandCompactReview,validateCopyReview,copyHash} from './skills/professional-slides/runtime/copy-check.mjs';
const inventory=addPageReviewTargets(buildCopyInventory({slides:[{id:'image',nodes:[]}]}));
assert.equal(inventory.slides[0].targets.length,1);
assert.ok(validateCopyReview(inventory,{items:[]}).some(e=>e.includes('Unreviewed')));
const t=inventory.slides[0].targets[0],schema=copyReviewSchema([t],[],{compact:true});
assert.equal(schema.properties.items.properties[t.id].properties.addedInformation,undefined);
const item=expandCompactReview({id:t.id,textHash:copyHash(t.text),decision:'keep',classification:'navigation',severity:'none',code:'NONE',reason:'Image is readable',repair:'None',evidenceIds:[]});
assert.deepEqual(validateCopyReview(inventory,{items:[item]}),[]);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_dependency_image_and_complexity_batching(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {slideReviewKey,reviewBatches} from './skills/professional-slides/runtime/production-policy.mjs';
const s={id:'a'},dep={id:'b',renderHash:'first'},inv={slides:[s]};
assert.notEqual(slideReviewKey(inv,s,'image',{},[dep]),slideReviewKey(inv,s,'image',{},[{...dep,renderHash:'second'}]));
assert.equal(reviewBatches([{slide:{id:'a',objectCount:100}},{slide:{id:'b',objectCount:100}}],{maxSlides:4,maxBytes:6000}).length,2);
assert.equal(reviewBatches([{slide:s},{slide:s}],{maxSlides:4,maxBytes:48000}).length,1);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_typed_evidence_and_missing_visible_premise(self):
        result=run_node("""
import assert from 'node:assert/strict';import fs from 'node:fs';
import {validateEvidence,validateVisibleArguments} from './skills/professional-slides/runtime/argument-contract.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const spec=JSON.parse(fs.readFileSync('./skills/professional-slides/examples/decision-pre-read.json'));
validateEvidence(spec);const {deck}=planDeck(spec.deckPlan);validateVisibleArguments(spec,deck);
spec.deckPlan.slides[1].argument.bindings[0].text='A missing decisive premise';assert.throws(()=>validateVisibleArguments(spec,deck),/not visible/);
spec.comparisons=[{evidence:['options','demand']}];assert.throws(()=>validateEvidence(spec),/Incompatible/);spec.comparisons[0].qualification='Different measures, explicitly identified';validateEvidence(spec);
delete spec.evidence[0].basis.period;assert.throws(()=>validateEvidence(spec),/basis requires/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_compiled_slide_cache_preserves_scene_and_invalidates_local_edit(self):
        result=run_node("""
import assert from 'node:assert/strict';import fs from 'node:fs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const plan=JSON.parse(fs.readFileSync('./skills/professional-slides/examples/decision-pre-read.json')).deckPlan,slideCache=new Map();
const first=planDeck(plan,undefined,{slideCache});assert.equal(slideCache.size,3);
const second=planDeck(plan,undefined,{slideCache});assert.deepEqual(second,first);assert.equal(slideCache.size,3);
plan.slides[0].subtitle='Changed synthetic subtitle';planDeck(plan,undefined,{slideCache});assert.equal(slideCache.size,4);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_preflight_reuses_validated_compilation(self):
        result=run_node("""
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {buildDeck} from './skills/professional-slides/runtime/build-deck.mjs';
const out=await fs.mkdtemp(path.join(os.tmpdir(),'preflight-cache-'));try{
const spec='./skills/professional-slides/examples/decision-pre-read.json';const a=await buildDeck(spec,out,{preflight:true});const b=await buildDeck(spec,out,{preflight:true});assert.equal(a.timings.preparedCacheHit,false);assert.equal(b.timings.preparedCacheHit,true);
}finally{await fs.rm(out,{recursive:true,force:true});}console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_recipes_are_distinct_and_close_is_optional(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {composeRecipe,evidenceExplanationCandidates,selectComposition} from './skills/professional-slides/runtime/composition-recipes.mjs';
const exhibits=[{id:'a',job:'State evidence',component:'paragraph',props:{text:'Observed demand increased.'}},{id:'b',job:'State condition',component:'paragraph',props:{text:'Capacity remains limited.'}}];
const forms=['paired-evidence','trend-drivers','decision-economics'].map(id=>composeRecipe(id,{exhibits}));assert.equal(new Set(forms.map(JSON.stringify)).size,3);assert.ok(forms.every(f=>!JSON.stringify(f).includes('"insight"')));
const r=selectComposition({slide:{id:'comparison',title:'Capacity constrains growth'},candidates:[{id:'stack',composition:forms[1]}]});assert.ok(r.selected);assert.equal(evidenceExplanationCandidates({exhibits:[exhibits[0]],explanation:'Capacity constrains growth.'}).length,3);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_deadline_and_nontransient_failure_do_not_retry(self):
        result=run_node("""
import assert from 'node:assert/strict';import {runProcess} from './skills/professional-slides/runtime/process.mjs';
await assert.rejects(runProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:30}),/timed out/);
let retries=0;await assert.rejects(runProcess(process.execPath,['-e','process.exit(1)'],{retries:1,onRetry:()=>retries++}),/exited 1/);assert.equal(retries,0);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_measurements_bounded_and_calibration_requires_humans(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {measureText,clearTextMeasurementCache,textMeasurementCacheSize} from './skills/professional-slides/runtime/text-layout.mjs';
import {calibrateFindings} from './skills/professional-slides/runtime/benchmark.mjs';
clearTextMeasurementCache();const a=measureText('Useful evidence',500);assert.deepEqual(measureText('Useful evidence',500),a);assert.ok(textMeasurementCacheSize()>0);
assert.equal(calibrateFindings([]).status,'not-measured');assert.throws(()=>calibrateFindings([{id:'x',category:'facts',humanMaterial:true,reviewerMaterial:false}]),/human/);
const r=calibrateFindings([{id:'x',category:'facts',humanReviewer:'test-label',humanMaterial:true,reviewerMaterial:false}]);assert.equal(r.categories.facts.falseNegative,1);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_claim_proof_recipe_preserves_measured_inline_emphasis(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {composeRecipe} from './skills/professional-slides/runtime/composition-recipes.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const runs=[{text:'Demand rises. ',bold:true},{text:'Measured peak work exceeds normal capacity.',bold:false}];
const composition=composeRecipe('claim-proof',{groups:[{id:'claim',text:runs.map(r=>r.text).join(''),runs}]});
const {deck}=planDeck({id:'proof',slides:[{id:'s',title:'Peak demand exceeds capacity',...composition}]});
const n=deck.slides[0].nodes.find(n=>n.role==='paragraph');assert.ok(n.runs.some(r=>r.bold));assert.equal(n.runs.map(r=>r.text).join(''),n.text);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
