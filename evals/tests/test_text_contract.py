import unittest
import json
import subprocess
import tempfile
from pathlib import Path
from node_probe import run_node, NODE, ROOT

class TextContractTests(unittest.TestCase):
    def test_dot_dash_cli_requires_complete_copy_by_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'historical.content.json'
            p.write_text(json.dumps({'question':'What governs this decision?','answer':'The decision depends on a clearly specified constraint','pages':[{'id':'s','claim':'The decision depends on a clearly specified constraint','settles':{'kind':'comparison','what':'Two defined alternatives'},'adds':None,'highlight':None}]}))
            command=[NODE,str(ROOT/'skills/professional-slides/runtime/gates/content_gates.mjs'),str(p),'--json']
            result=subprocess.run(command,capture_output=True,text=True)
            self.assertEqual(result.returncode,2)
            self.assertIn('TEXT_PLAN_INCOMPLETE',json.loads(result.stdout)['countsByCode'])
            legacy=subprocess.run(command+['--legacy'],capture_output=True,text=True)
            self.assertEqual(legacy.returncode,0)
            self.assertEqual(json.loads(legacy.stdout)['textCoverage']['state'],'legacy-unverified')

    def test_complete_copy_reference_coverage_and_loss_persist(self):
        result=run_node(r'''
import assert from 'node:assert/strict';
import {checkTextPlan,auditTextPlan,auditExportText,normalizeText} from './skills/professional-slides/runtime/text-contract.mjs';
import {runContentGates} from './skills/professional-slides/runtime/gates/content_gates.mjs';
import {validateStageContract} from './skills/professional-slides/runtime/build-deck.mjs';
const summary={id:'answer',role:'executive-summary',title:'Authorize the bounded preparation work under the specified condition'};
const spec={workflow:'new_deck',cover:{title:'Decision brief'},slides:[summary]};
const stages={content:{textContract:'complete',pages:[{id:'cover',claim:'Decision brief'},{id:'answer',claim:summary.title}]},plan:{pages:[{id:'cover',title:'Decision brief'},{id:'answer',title:summary.title}]}};
assert.doesNotThrow(()=>validateStageContract(spec,stages));
const missingCover=structuredClone(stages);missingCover.content.pages.shift();
assert.throws(()=>validateStageContract(spec,missingCover),/missing or has a changed title for cover/);
assert.equal(normalizeText('net-\ndemand'), 'net-demand');
assert.notEqual(normalizeText('net demand'), 'net-demand');
const page={id:'case',n:1,claim:'The first approval releases preparation subject to explicit constraints',settles:{kind:'comparison',what:'Two defined alternatives'},adds:null,highlight:null,textPlan:[{id:'title',role:'title',text:'The first approval releases preparation subject to explicit constraints'},{id:'reason',role:'body',text:'Preparation preserves an option but does not authorize construction. '+'The retained option keeps the approval path open while the gating permission is sought, '.repeat(3)+'and nothing is committed until then.'},{id:'data',role:'exhibit',text:'$31m'},{id:'source',role:'source',text:'Source: Designed fixture'}],textReference:{task:'chart-led'}};
const content={textContract:'complete',pages:[page]};
assert.ok(checkTextPlan(content).accepted);
assert.equal(checkTextPlan(content).scores[0].textCoverageScore,Math.round(58/55*100)); // 58 body words against the chart-led median of 55
const thin=structuredClone(content);thin.pages[0].textPlan[1].text='Prepare now.';
assert.ok(runContentGates(thin).findings.some(f=>f.code==='TEXT_COVERAGE_LOW'&&f.severity==='blocking'));
thin.pages[0].textReference.rationale='The retained comparison identifies the full commitment and the sole gating permission; the reference also explains an unrelated mechanism.';
// The floor is hard: a rationale explains a short page, it does not release it.
assert.ok(runContentGates(thin).findings.some(f=>f.code==='TEXT_COVERAGE_LOW'&&f.severity==='blocking'));
assert.ok(!runContentGates(thin).findings.some(f=>f.code==='TEXT_COVERAGE_EXCEPTION'));
const missing=structuredClone(content);delete missing.pages[0].textPlan;
assert.ok(!checkTextPlan(missing).accepted);
const legacy={pages:[{...page,textPlan:undefined,textReference:undefined}]};
assert.equal(checkTextPlan(legacy).state,'legacy-unverified');
assert.ok(!checkTextPlan(legacy,{required:true}).accepted);
const scene={slides:[{id:'case',nodes:page.textPlan.map(b=>({type:'text',role:b.role,text:b.text}))}]};
assert.ok(auditTextPlan(content,scene).accepted);
const split={slides:[{...scene.slides[0],id:'case-1',sourceSlideId:'case'},{...scene.slides[0],id:'case-2',sourceSlideId:'case'}]};
assert.ok(auditTextPlan(content,split).findings.some(f=>f.code==='TEXT_PLAN_PAGINATION'));
const lost=structuredClone(scene);lost.slides[0].nodes.splice(1,1);
assert.ok(auditTextPlan(content,lost).findings.some(f=>f.code==='TEXT_PLAN_LOST'));
const added=structuredClone(scene);added.slides[0].nodes.push({type:'text',role:'list-item',text:'Unplanned conclusion'});
assert.ok(auditTextPlan(content,added).findings.some(f=>f.code==='TEXT_UNPLANNED'));
assert.ok(auditExportText(content,scene,[page.textPlan.map(b=>b.text).join('\n')]).accepted);
assert.ok(auditExportText(content,scene,['$31m']).findings.some(f=>f.code==='TEXT_EXPORT_LOST'));
assert.deepEqual(auditExportText(content,scene,[page.textPlan.map(b=>b.text).join('\n')]).scores,checkTextPlan(content).scores);
const duplicate=structuredClone(content);duplicate.pages[0].textPlan.push({id:'again',role:'exhibit',text:'$31m'});
assert.ok(auditTextPlan(duplicate,scene).findings.some(f=>f.code==='TEXT_PLAN_LOST'));
// Furniture is excluded only from the density score, never from all-text retention.
const shell=structuredClone(content);
shell.pages[0].textPlan.push({id:'footer',role:'furniture',text:'Board pre-read'},{id:'page',role:'furniture',text:'01'});
const withShell=structuredClone(scene);
withShell.slides[0].nodes.push({type:'text',role:'footer-right',text:'Board pre-read'},{type:'text',role:'page-number',text:'01'});
assert.ok(auditTextPlan(shell,withShell).accepted);
assert.deepEqual(checkTextPlan(shell).scores,checkTextPlan(content).scores);
assert.ok(auditTextPlan(shell,scene).findings.some(f=>f.code==='TEXT_PLAN_LOST'));
assert.ok(auditTextPlan(content,withShell).findings.some(f=>f.code==='TEXT_UNPLANNED'));
const exported=shell.pages[0].textPlan.map(b=>b.text).join('\n');
assert.ok(auditExportText(shell,withShell,[exported]).accepted);
assert.ok(auditExportText(shell,withShell,[page.textPlan.map(b=>b.text).join('\n')]).findings.some(f=>f.code==='TEXT_EXPORT_LOST'));
assert.ok(auditExportText(shell,withShell,[exported+'\nUnplanned status']).findings.some(f=>f.code==='TEXT_EXPORT_UNPLANNED'));
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result['ok'])

    def test_category_total_preserves_label_and_value_hierarchy(self):
        result=run_node(r'''
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const draw = props => compileDeck({palette:'midnight',slides:[{id:'table',composition:component({id:'table',component:'table',props})}]},REGISTRY).slides[0].nodes;
const props={treatment:'categories',columns:[{label:'Customer group',type:'category'},'Accounts','Added revenue'],rows:[['Protected','20,000','$0m'],{style:'total',cells:['Total','120,000','$10.8m']}]};
const nodes=draw(props);
const band=nodes.find(n=>n.role==='table-row-band'&&n.data.row===1);
assert.equal(band.style.fill.tokenId,'color.surfaceMuted');
const label=nodes.find(n=>n.role==='table-cell'&&n.data.row===1&&n.data.column===0);
assert.equal(label.style.fill.tokenId,'color.accent');
assert.ok(!nodes.some(n=>n.role==='table-cell'&&n.data.row===1&&n.data.column>0));
const text=nodes.filter(n=>n.role==='table-cell-text'&&n.data.row===1);
assert.equal(text[0].style.color.tokenId,'color.onPrimary');
assert.ok(text.slice(1).every(n=>n.style.color.tokenId!=='color.onPrimary'));
const ordinary=draw({...props,treatment:'standard',columns:['Item','Accounts','Revenue']});
assert.equal(ordinary.find(n=>n.role==='table-row-band'&&n.data.row===1).style.fill.tokenId,'color.componentPrimary');
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result['ok'])
