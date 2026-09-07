import unittest

from test_source_structure import run_node


class ReviewRegressionTests(unittest.TestCase):
    def test_callout_directions_collision_and_bar_endpoints(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {renderEvidenceAnnotations} from './skills/professional-slides/runtime/chart-annotations.mjs';
const frame={x:40,y:40,width:760,height:420}, d=REGISTRY.get('chart-callout');
for(const direction of ['left','right','up','down']) {
  const nodes=d.render({id:'c',frame,props:{text:'Evidence',direction,border:false}}).nodes;
  const l=nodes.find(n=>n.role==='annotation-leader').data;
  assert.equal(nodes.find(n=>n.role==='annotation-surface').style.stroke,'none');
  assert.ok(direction==='left'?l.x2<l.x1:direction==='right'?l.x2>l.x1:direction==='up'?l.y2<l.y1:l.y2>l.y1);
}
assert.throws(()=>d.render({id:'bad',frame,props:{text:'Evidence',direction:'diagonal'}}));
assert.throws(()=>d.render({id:'bad',frame,props:{text:'Evidence',border:'no'}}));
assert.throws(()=>renderEvidenceAnnotations({id:'cross',plot:{x:0,y:120,width:760,height:300},props:{annotations:[{category:'A',text:'Evidence'}]},pointMap:new Map([['value:A',{x:300,y:350}]]),obstacles:[{role:'chart-mark',frame:{x:280,y:160,width:40,height:100}}]}),/clearance/);
const chart=REGISTRY.get('chart.column');
const nodes=chart.render({id:'bars',frame,props:{...chart.sample,dataLabels:false,referenceLines:[],annotations:[{category:'2026',text:'Evidence'}]}}).nodes;
const mark=nodes.find(n=>n.role==='chart-mark'&&n.data.category==='2026');
const leader=nodes.find(n=>n.role==='annotation-leader').data;
assert.ok(Math.abs(leader.x2-mark.frame.x-mark.frame.width)<.001);
assert.ok(Math.abs(leader.y2-mark.frame.y)<.001);
console.log(JSON.stringify({accepted:true}));
""")

    def test_map_crops_and_invalid_fraction_rejection(self):
        run_node("""
import assert from 'node:assert/strict';
import {resolveGeography,mapNodes} from './skills/professional-slides/runtime/maps.mjs';
const fiji=resolveGeography('country:FJI');
assert.ok(fiji.bounds[2]-fiji.bounds[0]<10);
const frame={x:40,y:40,width:600,height:360};
assert.ok(mapNodes({id:'fiji',frame,props:{geography:'country:FJI',markers:[{country:'FJI',fraction:.5}]}}).some(n=>n.role==='map-marker-fill'));
for(const fraction of ['bad',NaN,Infinity,-.1,1.1,null]) assert.throws(()=>mapNodes({id:'bad',frame,props:{markers:[{x:.5,y:.5,fraction}]}}),/fraction/);
console.log(JSON.stringify({accepted:true}));
""")

    def test_quotes_preserve_text_and_native_portraits(self):
        run_node("""
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {resolveQuoteClusterVariant} from './skills/professional-slides/runtime/quote-cluster.mjs';
import {renderSlideHtml} from './skills/professional-slides/runtime/adapters/html.mjs';
import {writePptx} from './skills/professional-slides/runtime/adapters/pptxgenjs.mjs';
const require=createRequire(import.meta.url),JSZip=require(require.resolve('jszip',{paths:[process.env.RUNTIME_NODE_MODULES]}));
const frame={x:60,y:150,width:1160,height:480},d=REGISTRY.get('quote-cluster');
const base={treatment:'contained',quotes:[{quote:'Exact evidence',attribution:'Name',detail:'Role'}]};
for(const field of ['quote','attribution','detail']) assert.throws(()=>d.render({id:'bad',frame,props:{...base,quotes:[{...base.quotes[0],[field]:{bad:true}}]}}),/text/);
assert.notEqual(resolveQuoteClusterVariant({...base,attributionAlign:'left'}),resolveQuoteClusterVariant({...base,attributionAlign:'right'}));
assert.ok(!d.render({id:'empty',frame,props:{...base,avatar:true}}).nodes.some(n=>n.role==='quote-avatar'));
const portrait={dataUri:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',alt:'Test portrait',authorization:'Synthetic test fixture'};
const props={...base,avatar:true,quotes:[{...base.quotes[0],portrait}]};
const deck=compileDeck({slides:[{id:'portrait',frame,composition:component({id:'quote',component:'quote-cluster',frame,props})}]},REGISTRY);
assert.ok(deck.slides[0].nodes.some(n=>n.type==='image'));
assert.ok(renderSlideHtml(deck.slides[0]).includes(portrait.dataUri));
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'quote-portrait-test-'));
try {
  const file=path.join(directory,'portrait.pptx');await writePptx(deck,file);
  const zip=await JSZip.loadAsync(await fs.readFile(file));
  const xml=await zip.file('ppt/slides/slide1.xml').async('string');
  assert.ok(xml.includes('<p:pic>'));assert.ok(xml.includes('prst="ellipse"'));
} finally {await fs.rm(directory,{recursive:true,force:true});}
console.log(JSON.stringify({accepted:true}));
""")

    def test_typed_comparison_and_wrapping_body_sized_legends(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {renderTable,measureTable} from './skills/professional-slides/runtime/tables.mjs';
const frame={x:0,y:0,width:400,height:1600};
const nodes=REGISTRY.get('comparison-table').render({id:'c',frame,props:{columns:['Metric','Value'],rows:[{cells:['Growth',{type:'number',value:8}]}],selectedColumn:1}}).nodes;
assert.ok(nodes.some(n=>n.text==='8'));assert.ok(!nodes.some(n=>n.text==='[object Object]'));
const props={density:'body',columns:[{label:'Metric',type:'bars',scale:'s'}],rows:[[{values:[1,2,3]}]],scales:{s:{type:'bars',label:'Revenue',unit:'USD',min:0,max:4,series:['Enterprise revenue','Consumer revenue','Other revenue']}}};
const m=measureTable({frame,props});assert.ok(m.legends[0].entries.at(-1).y>0);
const result=renderTable({id:'t',frame,props});
assert.ok(result.nodes.filter(n=>n.role==='table-legend').every(n=>n.style.fontSize.tokenId==='type.body'));
console.log(JSON.stringify({accepted:true}));
""")

    def test_stepped_horizons_reject_curve_only_properties(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const d=REGISTRY.get('chart.horizons'),frame={x:60,y:150,width:1160,height:480};
for(const variant of ['stepped','stepped-minimal']) for(const [key,value] of [['start',0],['end',1],['colorIndex',2]]) {
 const props={variant,horizons:[{id:'a',label:'Core',[key]:value},{id:'b',label:'Growth'}]};
 assert.throws(()=>d.render({id:'bad',frame,props}),/only in curves/);
}
console.log(JSON.stringify({accepted:true}));
""")

    def test_render_integrity_checks_both_files(self):
        run_node("""
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {hashRenderFiles,verifyRenderFiles} from './evals/scripts/render_integrity.mjs';
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'render-integrity-'));
try {
 const fixtures=[{htmlRender:'html.png',pptxRender:'pptx.png'}];
 await fs.writeFile(path.join(directory,'html.png'),'html');await fs.writeFile(path.join(directory,'pptx.png'),'pptx');
 const hashes=await hashRenderFiles(directory,fixtures);await verifyRenderFiles(directory,fixtures,hashes);
 await fs.writeFile(path.join(directory,'pptx.png'),'changed');await assert.rejects(()=>verifyRenderFiles(directory,fixtures,hashes),/hash mismatch/);
 await fs.unlink(path.join(directory,'html.png'));await assert.rejects(()=>verifyRenderFiles(directory,fixtures,hashes));
} finally {await fs.rm(directory,{recursive:true,force:true});}
console.log(JSON.stringify({accepted:true}));
""")

    def test_signatures_are_recomputed_and_required_for_saved_reports(self):
        run_node("""
import assert from 'node:assert/strict';
import {goldenSetSpecs,auditGoldenCoverage} from './skills/professional-slides/runtime/golden-set.mjs';
const specs=goldenSetSpecs();assert.ok(auditGoldenCoverage(specs).accepted);
assert.ok(!auditGoldenCoverage(specs,{requireSignatures:true}).accepted);
const altered=structuredClone(specs);const item=altered.find(spec=>spec.coverage?.length).coverage[0];item.visualSignature='forged';
assert.ok(auditGoldenCoverage(altered).mismatchedVisualSignatures.length);
console.log(JSON.stringify({accepted:true}));
""")
