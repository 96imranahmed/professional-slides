import unittest

from test_source_structure import run_node


class RelationshipLabelTests(unittest.TestCase):
    def test_wave_roadmap_measures_complete_rows_and_rejects_real_overflow(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('roadmap');
const props={variant:'wave-columns',items:[{heading:'Build the plan',range:'Weeks 1–7',activities:['Interview leadership and reconcile existing planning efforts.','Gather frontline ideas and identify stakeholders.','Test strategic choices against supported trade-offs.','Review the complete evidence with each strategy function.'],deliverables:['Draft objectives and a portfolio of initiatives.','Stakeholder map and listening-session findings.']},{heading:'Refine and communicate',range:'Weeks 8–10',activities:['Prioritize the portfolio.'],deliverables:['Draft strategic plan.']}]};
const frame={x:60,y:100,width:1100,height:500},layout=owner.measureIntrinsic({frame,props});
const nodes=owner.render({id:'waves',frame,props}).nodes;
const activities=nodes.filter(n=>n.role==='roadmap-activities'),deliverables=nodes.filter(n=>n.role==='roadmap-deliverables');
assert.equal(activities.length,2);assert.equal(deliverables.length,2);
assert.ok(deliverables.every(n=>n.frame.y>=Math.max(...activities.map(a=>a.frame.y+a.frame.height))+15.9));
assert.ok(deliverables.every(n=>n.frame.y+n.frame.height<=frame.y+layout.height));
assert.ok(activities[0].text.includes('each strategy function'));
assert.throws(()=>owner.render({id:'short',frame:{...frame,height:layout.height-1},props}),/complete activity and deliverable rows need/);
assert.throws(()=>owner.render({id:'empty',frame,props:{variant:'wave-columns',items:[]}}),/at least one stage/);
const noRange=owner.render({id:'untimed',frame,props:{variant:'wave-columns',items:[{heading:'Review',activities:['Test the complete evidence.']}]}}).nodes;
assert.equal(noRange.filter(n=>n.role==='roadmap-range'||n.role==='roadmap-deliverables').length,0);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])

    def test_roadmap_bands_contain_and_do_not_overpaint_complete_labels(self):
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const items=[{label:'Diagnose',period:'Five months'},{label:'Select',period:'1–2 months'},{label:'Design',period:'3–6 months'},{label:'Execute',period:'24–36 months'}];
const {nodes}=REGISTRY.get('roadmap').render({id:'stages',frame:{x:0,y:0,width:1160,height:215},props:{items,active:1}});
const labels=nodes.filter(n=>n.role==='process-label'),bands=nodes.filter(n=>n.role==='roadmap-phase');
console.log(JSON.stringify({text:labels.map(n=>n.text),contained:labels.every((n,i)=>n.frame.x>=bands[i].frame.x && n.frame.y>=bands[i].frame.y && n.frame.x+n.frame.width<=bands[i].frame.x+bands[i].frame.width && n.frame.y+n.frame.height<=bands[i].frame.y+bands[i].frame.height),paintOrder:labels.every((n,i)=>nodes.indexOf(n)>nodes.indexOf(bands[i]))}));
""")
        self.assertTrue(result["contained"])
        self.assertTrue(result["paintOrder"])
        self.assertIn("24–36 months", result["text"][3])

    def test_process_detail_is_visible_and_overflow_rejects(self):
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const render=height=>REGISTRY.get('process').render({id:'steps',frame:{x:0,y:0,width:600,height},props:{items:[{label:'Assess',detail:'Confirm the operating constraints.'},{label:'Select',detail:'Choose the design priorities.'}]}});
let error=null;try{render(50);}catch(e){error=e.message;}
console.log(JSON.stringify({text:render(240).nodes.filter(n=>n.role==='process-label').map(n=>n.text),error}));
""")
        self.assertIn("Confirm the operating constraints.", result["text"][0])
        self.assertIn("complete label", result["error"])


if __name__ == "__main__":
    unittest.main()
