import unittest
from test_source_structure import run_node

class ProductionWorkflowTests(unittest.TestCase):
    def test_material_severity_and_bounded_repairs(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {repairDecision,blocksRelease,mapBounded} from './skills/professional-slides/runtime/production-policy.mjs';
const minor={code:'EDITORIAL',severity:'minor'}, major={code:'MISSING_ARGUMENT',severity:'major'};
assert.equal(blocksRelease(minor),false);assert.equal(blocksRelease(major),true);
assert.equal(repairDecision([minor],2).action,'settle');
assert.equal(repairDecision([major],1).action,'repair');
assert.equal(repairDecision([major],2).action,'report-material-defect');
let active=0,max=0;
const values=await mapBounded([1,2,3,4],async n=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return n*2;},2);
assert.deepEqual(values,[2,4,6,8]);assert.equal(max,2);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_cache_invalidates_only_supplied_dependencies(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {slideReviewKey} from './skills/professional-slides/runtime/production-policy.mjs';
const a={id:'a',pageKind:'analytical',context:[{text:'A'}]},b={id:'b',pageKind:'analytical',context:[{text:'B'}]};
const inv={question:'Choose',slides:[a,b],outline:[{title:'A'},{title:'B'}]};
const key=slideReviewKey(inv,a,'image-a',{model:'x'});
const changed={...inv,slides:[a,{...b,context:[{text:'C'}]}],outline:[{title:'A'},{title:'C'}]};
assert.equal(key,slideReviewKey(changed,a,'image-a',{model:'x'}));
assert.notEqual(key,slideReviewKey(inv,a,'new-image',{model:'x'}));
assert.notEqual(key,slideReviewKey(inv,a,'image-a',{model:'y'}));
assert.notEqual(slideReviewKey(inv,a,'image-a',{},[b]),slideReviewKey(inv,a,'image-a',{},[changed.slides[1]]));
assert.notEqual(slideReviewKey(inv,{...a,pageKind:'navigation'},'a',{}),slideReviewKey(changed,{...a,pageKind:'navigation'},'a',{}));
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_sparsity_is_missing_reasoning_not_word_quota(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {assessArgument,sceneVisibleWords} from './skills/professional-slides/runtime/production-policy.mjs';
import {validateSlidePlan,planDeck} from './skills/professional-slides/runtime/planner.mjs';
assert.deepEqual(assessArgument({kind:'cover'}),[]);
assert.equal(assessArgument({argument:{question:'Which?',answer:'A',evidence:[]}})[0].code,'MISSING_ARGUMENT');
assert.deepEqual(assessArgument({argument:{question:'Which?',answer:'A',evidence:['e'],interpretation:'A meets the capacity requirement.'}}),[]);
const plan={id:'p',title:'A supported finding',notes:'metadata '.repeat(500),items:[{id:'text',job:'Explain',component:'paragraph',props:{text:'evidence '.repeat(100),chartSelection:{question:'metadata '.repeat(500),reason:'test',rejectedAlternative:'test',dataBasis:'test'}}}]};
const report=validateSlidePlan(plan);assert.ok(report.countedWords<110);assert.ok(report.advisory.length);
assert.throws(()=>planDeck({id:'limited',slides:[{...plan,copyBudget:{maxWordsPerSlide:50,rationale:'User cap'}}]}),/visible copy exceeds explicit budget 50/);
assert.equal(sceneVisibleWords({nodes:[{type:'text',role:'paragraph',text:'Visible words'},{type:'text',role:'source-text',text:'Source footer'}],notes:'notes '.repeat(100)}),2);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_explanation_dependencies_and_conditional_annotations(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {assertPlanRelationships} from './skills/professional-slides/runtime/semantic-integrity.mjs';
import {validateSlidePlan,planDeck} from './skills/professional-slides/runtime/planner.mjs';
const chart={id:'c',job:'Compare',component:'chart.column',props:{changeIntent:'time',changePresentation:'direct-labels',categories:['2024','2025'],series:[{name:'Sales',values:[20,40]}]}};
const prose={id:'p',component:'paragraph',job:'Explain',props:{text:'The increase doubles the requirement.',semantic:{kind:'explanation',relatedTo:['c']}}};
assert.doesNotThrow(()=>assertPlanRelationships({items:[chart,prose]}));
assert.throws(()=>assertPlanRelationships({items:[chart,{...prose,props:{...prose.props,semantic:{kind:'explanation',relatedTo:['missing']}}}]}),/dependencies/);
assert.doesNotThrow(()=>validateSlidePlan({id:'s',title:'Sales increased',items:[chart]}));
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_supported_synthesis_advisory_and_material_reviews(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {buildCopyInventory,copyHash,validateCopyReview} from './skills/professional-slides/runtime/copy-check.mjs';
const inv=buildCopyInventory({slides:[{id:'s',nodes:[{id:'p',type:'text',role:'paragraph',text:'A meets capacity',data:{}},{id:'v',type:'text',role:'data-label',text:'100',data:{}}]}]});
const item={id:'p',textHash:copyHash('A meets capacity'),decision:'keep',classification:'synthesis',severity:'none',code:'NONE',addedInformation:'Capacity fit',deletionConsequence:'Lose consequence',evidenceIds:['v'],reason:'Supported',repair:'None'};
assert.deepEqual(validateCopyReview(inv,{items:[item]}),[]);
assert.deepEqual(validateCopyReview(inv,{items:[{...item,decision:'rewrite',severity:'minor',code:'EDITORIAL'}]}),[]);
assert.ok(validateCopyReview(inv,{items:[{...item,severity:'major',code:'UNSUPPORTED_CLAIM',decision:'rewrite'}]}).some(e=>e.includes('MATERIAL')));
assert.ok(validateCopyReview(inv,{items:[{...item,evidenceIds:[]}]}).some(e=>e.includes('Ungrounded')));
assert.ok(validateCopyReview(inv,{items:[]}).some(e=>e.includes('Unreviewed')));
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_declarative_spec_and_recipe_require_real_evidence(self):
        result=run_node("""
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateDeckSpec,deriveArtifacts} from './skills/professional-slides/runtime/deck-spec.mjs';
import {retrieveRecipes,composeRecipe} from './skills/professional-slides/runtime/composition-recipes.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const spec=JSON.parse(fs.readFileSync('./skills/professional-slides/examples/decision-pre-read.json'));
validateDeckSpec(spec);const {deck,decisions}=planDeck(spec.deckPlan);const artifacts=deriveArtifacts(spec,deck,decisions);
assert.equal(artifacts['powerpoint-acceptance.json'].deck.slideCount,3);
assert.equal(artifacts['powerpoint-acceptance.json'].copy.enforceBudgets,false);
assert.ok(decisions[1].visibleWords>85);
const bad=structuredClone(spec);bad.evidence=[];assert.throws(()=>validateDeckSpec(bad),/unknown evidence/);
assert.equal(retrieveRecipes({question:'comparison'})[0].id,'paired-evidence');
assert.throws(()=>composeRecipe('paired-evidence',{exhibits:[]}),/supplied exhibits/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_benchmark_does_not_invent_human_results(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {summarizeRuns} from './skills/professional-slides/runtime/benchmark.mjs';
const rows=[{id:'a',mode:'fresh-build',totalMs:100,accepted:true},{id:'b',mode:'fresh-build',totalMs:300,accepted:false}];
const r=summarizeRuns(rows,{'fresh-build':200}).modes['fresh-build'];
assert.equal(r.p95Ms,300);assert.equal(r.qualityFailures,1);assert.equal(r.calibration,'not-measured');assert.equal(r.budgetStatus,'exceeded');
assert.throws(()=>summarizeRuns([]),/measured runs/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
