import unittest
from test_source_structure import run_node


class CopyBudgetTests(unittest.TestCase):
    def test_long_analytical_titles_wrap_without_changing_type_role(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const make=(id,title)=>({id,title,density:'pre-read',items:[{id:'reason',job:'explain the evidence',component:'paragraph',props:{text:'The evidence supports this conclusion.'}}]});
const {deck}=planDeck({id:'titles',slides:[make('short','Executive summary'),make('long','The same analytical title family preserves its size as copy length increases')]});
const titles=deck.slides.map(s=>s.nodes.find(n=>n.role==='action-title'));
assert.equal(titles[0].style.fontSize.tokenId,'type.actionTitle');
assert.deepEqual(titles[0].style.fontSize,titles[1].style.fontSize);
assert.equal(titles[0].frame.y,titles[1].frame.y);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])

    def test_paragraph_rejects_non_text_payloads_before_export(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const plan = text => ({id:'prose',title:'A supported conclusion',density:'pre-read',items:[{id:'reason',job:'explain the inference',component:'paragraph',props:{text}}]});
const compile = text => planDeck({id:'prose-test',slides:[plan(text)]});
for (const text of [64,0,null,undefined,[],{},'', '  ']) assert.throws(()=>compile(text),/paragraph .*requires a non-empty text string/);
for (const text of ['The limit applies to the entire cohort.', '64']) assert.doesNotThrow(()=>compile(text));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])

    def test_override_is_explicit_scoped_and_still_enforced(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {validateSlidePlan,planSlide} from './skills/professional-slides/runtime/planner.mjs';
const plan={id:'summary',title:'Executive summary',density:'pre-read',layout:'flow.column',items:[{id:'case',job:'develop the decision case',component:'paragraph',props:{text:Array(98).fill('word').join(' ')}}]};
assert.throws(()=>validateSlidePlan(plan),/permits 85/);
const approved={...plan,copyBudget:{maxWordsPerSlide:160,rationale:'Reference-led standalone narrative'}};
assert.deepEqual(planSlide(approved).decision.content,{countedWords:100,budget:160,density:{requested:'pre-read',required:'live-pitch',resolved:'pre-read',reasons:[]},defaultBudget:85,overrideRationale:'Reference-led standalone narrative'});
assert.equal(plan.density,'pre-read');
assert.equal(plan.copyBudget,undefined);
assert.throws(()=>validateSlidePlan(plan),/permits 85/);
assert.throws(()=>validateSlidePlan({...approved,copyBudget:{...approved.copyBudget,maxWordsPerSlide:99}}),/permits 99/);
const complete={...approved,title:'Decision title',source:'Source: Company filing',note:'Note: Values rounded',notes:'Presenter context',tracker:{title:'Agenda',items:[{id:'1',label:'Decision'}]},items:[{...approved.items[0],heading:'Evidence heading'}]};
assert.equal(validateSlidePlan(complete).countedWords,113);
for(const override of [null,[],{}, {maxWordsPerSlide:160}, {maxWordsPerSlide:160,rationale:' '}, {maxWordsPerSlide:0,rationale:'reason'}, {maxWordsPerSlide:1.5,rationale:'reason'}, {maxWordsPerSlide:'160',rationale:'reason'}, {maxWordsPerSlide:160,rationale:'reason',fontSize:8}]) assert.throws(()=>validateSlidePlan({...plan,copyBudget:override}),/copyBudget/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])
