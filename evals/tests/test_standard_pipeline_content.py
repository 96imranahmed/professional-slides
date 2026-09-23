"""Real deck regressions: content must survive the standard pipeline."""
import sys
import unittest
from pathlib import Path
from node_probe import run_node
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'skills/professional-slides/runtime/gates'))
import page_gates

class StandardPipelineContentTests(unittest.TestCase):
    def test_explicit_layouts_preserve_prose_and_audit_detects_loss(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import {auditContent} from './skills/professional-slides/runtime/content-audit.mjs';
const exhibit={type:'table',columns:['Category','Evidence'],rows:[['First','Observed'],['Second','Reported']]};
for(const layout of ['exhibit-full','split-tone','two-up','exhibit-left','exhibit-top']) {
 const slide={title:'Evidence supports a conditional decision',layout,points:[{lead:'Condition',text:'Keep this specific commentary in the exported page.'},{text:'Retain a second authored finding too.'}]};
 if(['two-up','split-tone'].includes(layout)) slide.exhibits=[structuredClone(exhibit),structuredClone(exhibit)];else slide.exhibit=structuredClone(exhibit);
 const spec={schema:'professional-slides.deck/v3',id:'regression',slides:[slide]};
 const {deck}=planDeck(toDeckPlan(spec));
 assert.equal(auditContent(spec,deck).accepted,true,layout);
 const broken=structuredClone(deck);broken.slides.forEach(s=>s.nodes=s.nodes.filter(n=>!String(n.text).includes('specific commentary')));
 assert.equal(auditContent(spec,broken).accepted,false,layout+' catches missing prose');
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_zero_stack_segment_has_no_impossible_label(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const nodes=REGISTRY.get('chart.stacked-bar').render({id:'journey',frame:{x:60,y:160,width:1160,height:450},props:{categories:['Direct','Transfer'],series:[{name:'Ride',values:[24,20]},{name:'Transfer',values:[0,7]}],dataLabels:true}}).nodes;
assert.ok(!nodes.some(n=>n.role==='data-label'&&n.data.category==='Direct'&&n.data.series==='Transfer'));
assert.ok(nodes.some(n=>n.role==='data-label'&&n.data.category==='Transfer'&&n.text==='7'));
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_compact_tracker_counts_as_navigation(self):
        slides=[{'componentInstances':[{'component':'section-divider'}], 'nodes':[{'role':'tracker-compact-label'}]} for _ in range(15)]
        findings=[]
        page_gates.gate_deck_structure(slides, list(range(15)), findings)
        self.assertEqual(findings,[])

    def test_architecture_includes_commentary_and_is_length_independent(self):
        def page(k):
            blocks=[{'component':k,'frame':{'x':60,'y':160,'width':720,'height':420}}]
            if k=='chart.bar':blocks.append({'component':'bullet-list','frame':{'x':820,'y':160,'width':400,'height':420}})
            return {'componentInstances':blocks}
        repertoire=[page(k) for k in ['chart.bar','table','image-frame','steps']]
        self.assertEqual('evidence-with-commentary',page_gates.page_architecture(repertoire[0]))
        for count in [12,48]:
            slides=(repertoire*12)[:count];findings=[]
            page_gates.gate_page_shape_flat(slides,list(range(count)),findings,'balanced')
            self.assertEqual(findings,[],str(count))
        findings=[]
        page_gates.gate_page_shape_flat([repertoire[1]]*48,list(range(48)),findings,'balanced')
        self.assertTrue(findings)

    def test_chart_basis_and_tracker_are_not_body_prose(self):
        slide={'nodes':[{'type':'text','role':role,'text':'word '*110} for role in ['category-note','tracker-compact-label']], 'componentInstances':[{'component':'chart.column'}]}
        findings=[]
        page_gates.gate_words(1,slide,findings,'executive')
        self.assertEqual(findings,[])

    def test_grouping_preserves_units_precision_and_explicit_highlight_intent(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {styleTable,composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const table=styleTable({type:'table',columns:['Place','Rent','Change'],rows:[['A','£2640.00','1250%'],['B','£2000.50','1000%']]});
assert.equal(table.rows[0][1],'£2,640.00');assert.equal(table.rows[1][1],'£2,000.50');assert.equal(table.rows[0][2],'1,250%');
const slide=composeSlide({title:'DCEU remains a smaller cohort',layout:'exhibit-full',exhibit:{type:'chart.column',categories:['MCU','DCEU'],series:[{name:'Count',values:[37,15]}],highlights:[]}},0);
assert.deepEqual(slide.items[0].props.highlights,[]);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])
