import unittest
from test_source_structure import run_node


class PlannerFullTrackerTests(unittest.TestCase):
    def test_full_tracker_has_one_selected_title_and_no_analytical_chrome(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const slide={id:'chapter',kind:'tracker',title:'Commercial outlook',pageNumber:3,trackerPage:{trackerId:'sections',items:[{id:'A',label:'Market context'},{id:'B',label:'Commercial outlook'},{id:'C',label:'Next steps'}],selectedId:'B',layout:'sequential-circles',mode:'light'}};
const {deck,decisions}=planDeck({id:'navigation',slides:[slide]});
assert.equal(deck.slides[0].nodes.filter(n=>n.text===slide.title).length,1);
assert.equal(deck.slides[0].nodes.filter(n=>n.role==='action-title').length,0);
assert.equal(deck.slides[0].nodes.find(n=>n.role==='page-number').text,'3');
assert.equal(decisions[0].kind,'tracker');
assert.throws(()=>planDeck({id:'bad',slides:[{...slide,title:'Unmatched chapter'}]}),/selected chapter label/);
assert.throws(()=>planDeck({id:'bad',slides:[{...slide,items:[]}]}),/trackerPage/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
