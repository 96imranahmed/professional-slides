"""Behavioral regressions from PR #4: geometry, export selection and build safety."""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from node_probe import run_node, NODE, ROOT, requires_python_package
from test_page_gates import good_slide, page_gates

RUNTIME = ROOT / 'skills/professional-slides/runtime'

@requires_python_package('pptx')
class RuntimeReviewTests(unittest.TestCase):
    def test_custom_markers_resolve_feature_ids_without_country_aliases(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {mapNodes,CHOROPLETH_MAP_SAMPLE} from './skills/professional-slides/runtime/maps.mjs';
const geography=structuredClone(CHOROPLETH_MAP_SAMPLE.geography), frame={x:60,y:140,width:600,height:400};
const render=country=>mapNodes({id:'map',frame,props:{geography,markers:[{country,label:'Location'}]}});
for(const id of ['west','east']) assert.equal(render(id).filter(n=>n.role==='map-marker').length,1);
assert.throws(()=>render('USA'),/outside custom/);
delete geography.geojson.features[0].properties.labelPoint;
assert.throws(()=>render('west'),/no visible label point/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_rich_formats_and_named_scatter_preserve_scene_rendering(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
const frame={x:0,y:0,width:500,height:300}, props={categories:['A'],values:[1200000]};
for(const valueFormat of [{prefix:'$'},{suffix:'%'},{grouping:true},{sign:'always'},{compactUnit:'m'},'percent'])
 assert.equal(nativeChartSpec('chart.column',{...props,valueFormat},frame),null);
assert.ok(nativeChartSpec('chart.column',{...props,valueFormat:{decimals:2}},frame));
assert.equal(nativeChartSpec('chart.scatter',{points:[{x:1,y:2,name:'Alpha',series:'First'},{x:2,y:3,name:'Beta',series:'Second'}]},frame),null);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_cached_slide_respects_resolved_chrome(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {compileDeck} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const slideCache=new Map(),spec={slides:[{id:'one',chrome:{title:'Growth funds expansion'},composition:{nodeType:'component',id:'p',component:'paragraph',props:{text:'Evidence'},frame:{x:60,y:160,width:500,height:100}}}]};
const a=compileDeck(spec,REGISTRY,{slideCache});
const changed={...spec,chrome:{left:100,bodyTop:190}};
const b=compileDeck(changed,REGISTRY,{slideCache});
const fresh=compileDeck(changed,REGISTRY);
assert.deepEqual(b.slides,fresh.slides);
assert.notDeepEqual(a.slides[0].contentFrame,b.slides[0].contentFrame);
assert.equal(slideCache.size,2);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_styled_table_rows_participate_in_weight(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {splitTables} from './skills/professional-slides/runtime/compose.mjs';
const table={type:'table',treatment:'standard',columns:['Item','Value'],rows:[{style:'total',cells:['Total','10']}]};
assert.equal(splitTables({title:'Totals',exhibits:[table,table]}).length,1);
const heavy={...table,rows:[{style:'total',cells:['A'.repeat(70),'10']}]};
assert.equal(splitTables({title:'Totals',exhibits:[table,heavy]}).length,2);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_density_footnotes_and_missing_renders(self):
        slide=good_slide()
        slide['componentInstances']=[{'component':'slide-chrome'}]
        paragraph=next(n for n in slide['nodes'] if n['id']=='p')
        # 140 words: over `live-pitch` (127, the corpus p25) and under
        # `pre-read` (282, the corpus p75). It was 110 against a bare ceiling of
        # 100 - which sat below the corpus p25, so the gate taxed pages for
        # carrying what the reference decks carry.
        paragraph['data']['textLayout']['source']=' '.join(['word']*140)
        paragraph['text']=paragraph['data']['textLayout']['source']
        slide['density']='live-pitch'
        self.assertIn('WORDS',page_gates.run_gates({'slides':[slide]},gates={'WORDS'})['countsByCode'])
        self.assertNotIn('WORDS',page_gates.run_gates({'slides':[slide]},profile='pre-read',gates={'WORDS'})['countsByCode'])
        note=copy.deepcopy(paragraph);note['id']='note';note['role']='footnote-text'
        note['style']['fontSize']['value']=20
        slide['nodes']=[note]
        report=page_gates.run_gates({'slides':[slide]},gates={'WORDS','TYPE_RANGE'})
        self.assertNotIn('WORDS',report['countsByCode']);self.assertIn('TYPE_RANGE',report['countsByCode'])
        # The lexical-hedge half of this test went with `HEDGED_TITLE`: it
        # asserted that "Some growth creates value" hedges and "Awesome growth
        # creates value" does not, which is a claim about two words rather than
        # about whether a title commits to a finding.
        slide=good_slide()
        with tempfile.TemporaryDirectory() as directory:
            report=page_gates.run_gates({'slides':[slide,{'nodes':[],'componentInstances':[{'component':'cover'}]}]},directory,gates={'WORDS'})
            self.assertEqual(report['countsByCode']['MISSING_RENDER'],2)

    def test_coverage_blocks_build_and_delivery_and_python_option_is_used(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);spec=root/'spec.json';out=root/'out'
            spec.write_text(json.dumps({'schema':'professional-slides.deck/v3','id':'coverage','cover':{'title':'Decision'},'criteria':['housing'],'slides':[]}))
            command=[NODE,str(RUNTIME/'build-deck.mjs'),str(spec),str(out),'--python',sys.executable]
            # Explicit interpreter must win over an unusable default.
            env={**os.environ,'RUNTIME_PYTHON':'/does-not-exist'}
            pre=subprocess.run(command+['--preflight'],capture_output=True,text=True,env=env)
            self.assertEqual(pre.returncode,2,pre.stderr)
            self.assertEqual(json.loads(pre.stdout)['status'],'preflight-findings')
            build=subprocess.run(command+['--no-render'],capture_output=True,text=True,env=env)
            self.assertEqual(build.returncode,2,build.stderr)
            self.assertEqual(json.loads(build.stdout)['status'],'built-with-findings')
            report=json.loads((out/'preflight-gates.json').read_text())
            self.assertEqual(report['countsByCode']['MISSING_EVIDENCE'],1)
            review=root/'review.json';review.write_text(json.dumps({'accepted':True,'summary':'Accepted for the purpose of proving gates cannot be bypassed.','findings':[]}))
            delivered=subprocess.run([NODE,str(RUNTIME/'deliver-deck.mjs'),str(spec),str(out),'--skip-build','--review',str(review)],capture_output=True,text=True)
            self.assertEqual(delivered.returncode,2,delivered.stderr)
            self.assertFalse((out/'coverage-DELIVERED.pptx').exists())
            self.assertIn('MISSING_EVIDENCE',[x['code'] for x in json.loads(delivered.stdout)['blockers']])
            invalid=subprocess.run(command[:-2]+['--python'],capture_output=True,text=True)
            self.assertEqual(invalid.returncode,1)
            self.assertIn('--python requires an executable',invalid.stderr)

    def test_unsafe_ids_cannot_write_or_delete_outside_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);out=root/'out';out.mkdir()
            protected=root/'escape-DELIVERED.pptx';protected.write_text('keep')
            for value in ['../escape','/absolute','folder/file',r'folder\file']:
                spec=root/'spec.json';spec.write_text(json.dumps({'schema':'professional-slides.deck/v3','id':value,'slides':[]}))
                for command in ['build-deck.mjs','deliver-deck.mjs']:
                    result=subprocess.run([NODE,str(RUNTIME/command),str(spec),str(out)],capture_output=True,text=True)
                    self.assertEqual(result.returncode,1,result.stderr)
                    self.assertIn('safe filename',result.stderr)
                self.assertEqual(protected.read_text(),'keep')
                self.assertEqual(list(out.iterdir()),[])

    def test_shell_suite_returns_success_and_preserves_unit_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            stub=Path(directory)/'runner'
            stub.write_text('#!'+sys.executable+'\nimport os,sys\nif sys.argv[1:3] == ["-m","unittest"]: sys.exit(int(os.environ.get("TEST_SUITE_EXIT","0")))\nsys.exit(0)\n')
            stub.chmod(0o755)
            for code in [0,3]:
                result=subprocess.run(['bash',str(ROOT/'evals/run.sh')],env={**os.environ,'RUNTIME_NODE':str(stub),'RUNTIME_PYTHON':str(stub),'TEST_SUITE_EXIT':str(code)},capture_output=True,text=True)
                self.assertEqual(result.returncode,code,result.stderr)
                self.assertNotIn('unbound variable',result.stderr)
