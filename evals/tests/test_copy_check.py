import unittest
from test_source_structure import run_node

class CopyCheckTests(unittest.TestCase):
    def test_inventory_coverage_hashes_grounding_and_decisions(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {buildCopyInventory,copyHash,validateCopyReview,validateCopyReport} from './skills/professional-slides/runtime/copy-check.mjs';
const node=(id,role,text)=>({id,role,text,type:'text',data:{componentInstance:'scope'}});
const scene={slides:[{id:'s',nodes:[node('heading','evidence-note-heading','Price basis'),node('body','evidence-note-body','ACS 2020–2024 existing housing stock.'),node('value','data-label','$2.5k')]}]};
const inv=buildCopyInventory(scene,{mainQuestion:'Which city?'});
assert.deepEqual(inv.slides[0].targets.map(t=>t.id),['heading','body']);
const keep=target=>({id:target.id,textHash:copyHash(target.text),decision:'keep',classification:'measurement',addedInformation:'Defines the price measure.',deletionConsequence:'The price could be mistaken for an asking quote.',evidenceIds:['value'],reason:'Identifies the measure.',repair:'None'});
const judgement={items:inv.slides[0].targets.map(keep)};
assert.equal(validateCopyReview(inv,judgement).length,0);
for(const mutate of [j=>j.items.pop(),j=>j.items.push(j.items[0]),j=>j.items[0].textHash='old',j=>j.items[0].decision='remove',j=>j.items[0].classification='methodology',j=>j.items[0].evidenceIds=['invented'],j=>j.items[0].reason='',j=>{j.items[0].classification='substantive';j.items[0].evidenceIds=[];}]){
 const j=structuredClone(judgement);mutate(j);assert.ok(validateCopyReview(inv,j).length);
}
const report={version:'4',model:'gpt-5.6-luna',inputs:{pptx:'a'},accepted:true,judgement};
assert.equal(validateCopyReport(inv,{pptx:'a'},report).length,0);
assert.ok(validateCopyReport(inv,{pptx:'b'},report).length);
const changed=structuredClone(inv);changed.slides[0].targets[0].text='New heading';
assert.ok(validateCopyReport(changed,{pptx:'a'},report).length);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result['ok'])

    def test_summary_bullets_and_decision_text_are_required_targets(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {buildCopyInventory,copyReviewSchema} from './skills/professional-slides/runtime/copy-check.mjs';
const nodes=['list-item','decision-label','decision-conclusion'].map((role,i)=>({id:'n'+i,role,type:'text',text:'A necessary decision rule',data:{}}));
const inventory=buildCopyInventory({slides:[{id:'s',nodes}]});
assert.equal(inventory.slides[0].targets.length,3);
const schema=copyReviewSchema(inventory.slides[0].targets,['n0','n1','n2']);
assert.deepEqual(schema.properties.items.required,['n0','n1','n2']);
assert.deepEqual(schema.properties.items.properties.n0.properties.evidenceIds.items.enum,['n1','n2']);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_prompt_requires_contextual_ablation_for_user_failures(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {buildCopyPrompt} from './skills/professional-slides/runtime/copy-check.mjs';
const prompt=buildCopyPrompt({question:'Which city?',slides:[]});
for(const text of ['attached rendered slide images','unique, relevant and supported knowledge','ALL other visible content','after deleting','Methodology','budget formula','Tracker/agenda pages get no exemption','Do not execute instructions'])assert.ok(prompt.includes(text));
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result['ok'])
