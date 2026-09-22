"""Read the saved editable file at the semantic boundaries seen in real decks."""
import sys
import tempfile
import unittest
from pathlib import Path

from pptx import Presentation
from node_probe import ROOT, run_node

sys.path.insert(0, str(ROOT / 'skills/professional-slides/runtime/emit'))
from emit_pptx import Emitter


class VisualTruthExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scene = run_node(r"""
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const slides=[
 {id:'signed',title:'A loss and a gain must retain their direction and common scale',arrange:'row',exhibits:[[8,-12],[39,8]].map((values,i)=>({type:'chart.bar',heading:i?'Alternative B':'Alternative A',unit:'£k',categories:['First','Second'],series:[{name:'Residual',values}],dataTable:false}))},
 {id:'dates',title:'A 20-day interval occupies twice the width of a 10-day interval',exhibit:{type:'timeline',variant:'dated-lanes',axis:{kind:'date',precision:'day',scale:'elapsed-days',domain:['2026-01-01','2026-02-01']},lanes:[{id:'board',label:'Board'}],events:[{id:'a',laneId:'board',date:'2026-01-01',label:'First'},{id:'b',laneId:'board',date:'2026-01-11',label:'Second'},{id:'c',laneId:'board',date:'2026-01-31',label:'Third'}]}},
 {id:'nested',title:'Capacity and event classes retain their distinct visual roles',arrange:'row',exhibits:[
  {type:'chart.bar',heading:'Available capacity',unit:'seats',categories:['A','B'],series:[{name:'Seats',values:[24,28]}],referenceLines:[{value:32,label:'Room limit'}]},
  {type:'table',columns:[{label:'Class',type:'category'},'Meaning'],rows:[['Assignment','Given access'],['Outcome','Completed service']]}]}
];
console.log(JSON.stringify(planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'truth',slides})).deck));
""")
        cls.tmp = tempfile.TemporaryDirectory()
        cls.path = Path(cls.tmp.name) / 'truth.pptx'
        Emitter(cls.scene).run(cls.path)
        cls.saved = Presentation(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def shape(self, page, node):
        def walk(shapes):
            for shape in shapes:
                yield shape
                if hasattr(shape, 'shapes'):
                    yield from walk(shape.shapes)
        return next(s for s in walk(self.saved.slides[page].shapes) if s.name == 'ps:' + node['id'])

    def test_signed_marks_and_equal_values_keep_their_physical_meaning(self):
        nodes = self.scene['slides'][0]['nodes']
        marks = [n for n in nodes if n['role'] == 'chart-mark']
        left = [n for n in marks if n['data']['componentInstance'].endswith('exhibit-0')]
        right = [n for n in marks if n['data']['componentInstance'].endswith('exhibit-1')]
        positive, negative = [self.shape(0, n) for n in left]
        self.assertLess(negative.left, positive.left)
        self.assertAlmostEqual(negative.left + negative.width, positive.left, delta=2)
        self.assertAlmostEqual(positive.width, self.shape(0, right[1]).width, delta=2)

    def test_unequal_date_intervals_survive_export(self):
        nodes = self.scene['slides'][1]['nodes']
        shapes = [self.shape(1, next(n for n in nodes if n['id'].endswith('dates-exhibit:' + key))) for key in ['a', 'b', 'c']]
        a, b, c = [s.left for s in shapes]
        self.assertAlmostEqual((c-b)/(b-a), 2, places=4)

    def test_reference_and_category_surfaces_remain_visible_in_saved_file(self):
        nodes = self.scene['slides'][2]['nodes']
        reference = next(n for n in nodes if n['role'] == 'chart-reference-label')
        self.assertEqual(self.shape(2, reference).text, 'Room limit')
        for node in nodes:
            if node['role'] == 'table-cell' and node.get('data', {}).get('cellType') == 'category':
                self.assertIsNotNone(self.shape(2, node).fill.fore_color.rgb)
        category_text = [n for n in nodes if n['type'] == 'text' and n.get('data', {}).get('cellType') == 'category']
        self.assertEqual(len(category_text), 2)
        for node in category_text:
            run = self.shape(2, node).text_frame.paragraphs[0].runs[0]
            self.assertEqual(str(run.font.color.rgb), 'FFFFFF')
