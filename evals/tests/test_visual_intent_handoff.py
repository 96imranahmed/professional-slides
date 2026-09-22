"""Explicit visual choices survive composition; plain counterparts remain valid."""
import unittest
from node_probe import run_node


class VisualIntentHandoffTests(unittest.TestCase):
    def test_nested_categories_icons_and_reference_labels_cannot_silently_disappear(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import {auditContent} from './skills/professional-slides/runtime/content-audit.mjs';
const spec={schema:'professional-slides.deck/v3',id:'handoff',slides:[
 {id:'records',title:'Records and event classes have different meanings',arrange:'row',exhibits:[
  {type:'table',columns:['Record','Value'],rows:[['R1','A'],['R2','B']]},
  {type:'table',columns:[{label:'Class',type:'category'},'Meaning'],rows:[['Assignment','Given access'],['Outcome','Completed service']]}]},
 {id:'concepts',title:'Four concepts define the proposed evaluation',pointsStyle:'icon-lead',points:[
  {lead:'Population:',text:'Compare the assigned cohort.',icon:'people'},
  {lead:'Analysis:',text:'Retain the named denominator.',icon:'chart-bar'}]},
 {id:'limit',title:'The current capacity stays below the proposed limit',exhibit:{type:'chart.bar',heading:'Available capacity',unit:'seats',categories:['A','B'],series:[{name:'Seats',values:[24,28]}],referenceLines:[{value:32,label:'Room limit'}]}}
]};
const scene=planDeck(toDeckPlan(spec)).deck;
assert.equal(auditContent(spec,scene).accepted,true);
for (const [kind,remove] of [
 ['icon',n=>n.role==='list-icon-glyph'],
 ['category',n=>n.role==='table-cell'&&n.data.cellType==='category'],
 ['reference-label',n=>n.role==='chart-reference-label']]) {
 const broken=structuredClone(scene);broken.slides.forEach(s=>s.nodes=s.nodes.filter(n=>!remove(n)));
 assert.ok(auditContent(spec,broken).findings.some(f=>f.kind===kind),`lost ${kind} must reject`);
}
const plain=structuredClone(spec);plain.slides[1].pointsStyle='prose';
assert.equal(auditContent(plain,planDeck(toDeckPlan(plain)).deck).accepted,true,'prose metadata must not demand icons');
const plainCategory=structuredClone(spec);
plainCategory.slides[0].exhibits[1].columns[0].surface='plain';
assert.equal(auditContent(plainCategory,planDeck(toDeckPlan(plainCategory)).deck).accepted,true,'explicit plain categories remain valid');
console.log('{}');
""")
