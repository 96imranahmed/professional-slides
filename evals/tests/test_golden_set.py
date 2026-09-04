import unittest
from test_source_structure import run_node


class GoldenSetTests(unittest.TestCase):
    def test_pptx_package_has_no_phantom_masters_and_preserves_font_roles(self):
        result = run_node("""
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { compileDeck,component } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { writePptx } from './skills/professional-slides/runtime/adapters/pptxgenjs.mjs';
const require=createRequire(import.meta.url),JSZip=require(require.resolve('jszip',{paths:[process.env.RUNTIME_NODE_MODULES]}));
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ps-golden-package-test-'));
try {
 const frame={x:60,y:80,width:1100,height:150};
 const deck=compileDeck({typography:{display:'Georgia'},slides:[1,2,3].map(i=>({id:`slide-${i}`,composition:component({id:`title-${i}`,component:'action-title',frame,props:{text:'Operating model'}})}))},REGISTRY);
 const file=path.join(directory,'test.pptx');await writePptx(deck,file);
 const zip=await JSZip.loadAsync(await fs.readFile(file));
 const xml=await zip.file('[Content_Types].xml').async('string');
 for(const match of xml.matchAll(/<Override[^>]*PartName="([^\"]+)"/g)) assert.ok(zip.file(match[1].slice(1)),match[1]);
 const theme=await zip.file('ppt/theme/theme1.xml').async('string');
 assert.ok(theme.includes('<a:majorFont><a:latin typeface="Georgia"'));
 assert.ok(theme.includes('<a:minorFont><a:latin typeface="Arial"'));
 console.log(JSON.stringify({accepted:true}));
} finally { await fs.rm(directory,{recursive:true,force:true}); }
""")
        self.assertTrue(result["accepted"])

    def test_graph_title_owner_and_unit_variant(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const title=REGISTRY.get('chart-title'),frame={x:60,y:180,width:500,height:90};
const plain=title.render({id:'title',frame,props:{heading:'Current mix'}}).nodes;
const unit=title.render({id:'title',frame,props:{heading:'Current mix',unit:'Revenue share, %'}}).nodes;
assert.equal(plain.filter(n=>n.role==='section-heading-rule').length,1);
assert.equal(unit.filter(n=>n.role==='section-heading-rule').length,0);
assert.equal(unit.find(n=>n.role==='chart-unit').style.color.tokenId,'color.chartUnit');
assert.equal(unit.find(n=>n.role==='chart-unit').style.bold,false);
assert.deepEqual(plain[0].style,unit[0].style);
assert.deepEqual(plain[0].frame,unit[0].frame);
assert.throws(()=>title.render({id:'title',frame,props:{heading:'Mix',variant:'unit'}}),/unit/);
const chart=REGISTRY.get('chart.pie').render({id:'pie',frame:{x:0,y:0,width:800,height:500},props:{labels:['A','B'],values:[40,60],heading:'Current mix',unit:'%'}}).nodes;
assert.equal(chart.filter(n=>n.role==='chart-unit').length,1);
assert.equal(chart.filter(n=>n.role==='section-heading-rule').length,0);
const group=REGISTRY.get('chart-group'), nodes=group.render({id:'group',frame:{x:0,y:0,width:1160,height:460},props:group.sample}).nodes;
assert.equal(nodes.filter(n=>n.role==='section-heading-rule').length,2);
assert.equal(new Set(nodes.filter(n=>n.role==='section-heading-rule').map(n=>n.frame.y)).size,1);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_semibold_is_a_company_font_role_and_does_not_leak_across_decks(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { compileDeck,component,TOKENS,tokenValue,token } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { renderSlideHtml } from './skills/professional-slides/runtime/adapters/html.mjs';
const spec={id:'pie',frame:{x:0,y:0,width:1280,height:720},composition:component({id:'pie',component:'chart.pie',frame:{x:100,y:150,width:1000,height:450},props:{labels:['Current','New'],values:[60,40],variant:'outside-labels'}})};
const first=compileDeck({slides:[spec]},REGISTRY);
const company=compileDeck({typography:{body:'Georgia',semibold:{family:'Georgia',nativeBold:true,effectiveWeight:700}},slides:[spec]},REGISTRY);
for(const deck of [first,company]) {
 const labels=deck.slides[0].nodes.filter(n=>n.data.directAnnotation);
 assert.ok(labels.every(n=>n.style.fontWeight.value===600));
 assert.ok(labels.every(n=>n.style.fontFamily.value===deck.typography.body));
 assert.equal(deck.typography.fallbacks[0].effectiveWeight,700);
 assert.ok(renderSlideHtml(deck.slides[0]).includes('font-weight:700'));
}
assert.equal(tokenValue(token('font.body')),'Arial');
assert.equal(TOKENS['font.body'].value,'Arial');
assert.throws(()=>compileDeck({typography:{body:'Georgia'},slides:[spec]},REGISTRY),/semibold/);
const legend=REGISTRY.get('legend').render({id:'key',frame:{x:0,y:0,width:300,height:40},props:{items:['A','B']}}).nodes.filter(n=>n.role==='legend-label');
assert.ok(legend.every(n=>!n.style.fontWeight&&!n.style.bold));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_chart_inputs_never_inherit_demo_annotations_or_targets(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const nodes=REGISTRY.get('chart.column').render({id:'real-data',frame:{x:0,y:0,width:700,height:420},props:{categories:['A','B'],series:[{name:'Sales',values:[10,20]}]}}).nodes;
assert.ok(!nodes.some(n=>['annotation-text','chart-highlight','chart-reference-line'].includes(n.role)));
assert.ok(!nodes.some(n=>String(n.text).includes('2025')||String(n.text).includes('Target')));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_palette_isolation_and_html_native_token_inheritance(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { buildGoldenSetDeck } from './skills/professional-slides/runtime/golden-set.mjs';
import { TOKENS, THEME_SLOT_TOKENS, compileDeck } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { renderSlideHtml } from './skills/professional-slides/runtime/adapters/html.mjs';
const original=JSON.stringify(TOKENS), decks=['mckinsey','bcg','bain'].map(palette=>buildGoldenSetDeck({palette}).deck);
assert.equal(JSON.stringify(TOKENS),original);
assert.equal(new Set(decks.map(d=>d.manifest.tokens['color.componentPrimary'].value)).size,3);
assert.equal(new Set(decks.map(d=>d.manifest.designHash)).size,3);
for(const deck of decks) for(const slide of deck.slides) {
  const html=renderSlideHtml(slide);
  for(const token of Object.values(deck.manifest.tokens)) assert.ok(html.includes(`${token.cssVar}:${token.value}`));
  for(const node of slide.nodes) for(const style of Object.values(node.style)) if(style?.tokenId) assert.equal(style.value,deck.manifest.tokens[style.tokenId].value);
  for(const token of Object.values(deck.manifest.tokens)) if(token.themeSlot) assert.equal(token.value,deck.manifest.tokens[THEME_SLOT_TOKENS[token.themeSlot]].value);
}
assert.throws(()=>compileDeck({palette:'unknown',slides:[]},REGISTRY),/Unknown palette/);
assert.throws(()=>compileDeck({slides:[{palette:'bain'}]},REGISTRY),/palette/i);
console.log(JSON.stringify({palettes:decks.map(d=>d.palette.id),slides:decks[0].slides.length}));
""")
        self.assertEqual(result, {"palettes": ["mckinsey", "bcg", "bain"], "slides": 153})

    def test_registry_drives_complete_nonduplicated_golden_coverage(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { goldenSetSpecs, auditGoldenCoverage } from './skills/professional-slides/runtime/golden-set.mjs';
const specs=goldenSetSpecs(), audit=auditGoldenCoverage(specs);
assert.ok(audit.accepted);
assert.ok(!auditGoldenCoverage(specs.slice(1)).accepted);
assert.ok(!auditGoldenCoverage([...specs,specs[0]]).accepted);
assert.ok(!auditGoldenCoverage([...specs,{id:'unknown'}]).accepted);
for(const definition of REGISTRY.values()) {
  assert.equal(specs.filter(f=>f.target===definition.id&&['component','chart'].includes(f.kind)).length,1);
  for(const variant of Object.keys(definition.variants||{})) assert.equal(specs.filter(f=>f.target===definition.id&&f.variant===variant).length,1);
}
console.log(JSON.stringify(audit));
""")
        self.assertEqual(result["components"], 56)
        self.assertEqual(result["variants"], 61)
        self.assertEqual(result["standards"], 18)

    def test_pie_variants_are_centered_and_category_labels_do_not_duplicate_legend(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const frame={x:100,y:80,width:800,height:480}, props={labels:['Core','Growth','New','Other'],values:[25,25,25,25]};
for(const id of ['chart.pie','chart.donut']) for(const variant of ['legend-top-right','outside-labels','shared-legend']) {
 const nodes=REGISTRY.get(id).render({id:'plot',frame,props:{...props,variant}}).nodes;
 const plot=nodes.find(n=>n.role==='chart-segment').frame, labels=nodes.filter(n=>n.role==='legend-label');
 assert.equal(plot.x+plot.width/2,frame.x+frame.width/2);
 assert.equal(plot.y+plot.height/2,frame.y+frame.height/2+(variant==='legend-top-right'?24:0));
 assert.equal(labels.length,variant==='legend-top-right'?4:0);
 assert.equal(nodes.filter(n=>n.role==='category-label').length,variant==='outside-labels'?4:0);
 if(labels.length) { assert.equal(new Set(labels.map(n=>n.frame.y)).size,1); assert.ok(Math.abs(labels.at(-1).frame.x+labels.at(-1).frame.width-(frame.x+frame.width-16))<0.01); }
}
for(const bad of [{values:[-1,2,3,4]},{labels:['A','A','B','C']},{variant:'made-up'},{variant:'legend-top-right',legend:false}]) assert.throws(()=>REGISTRY.get('chart.pie').render({id:'bad',frame,props:{...props,...bad}}));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_small_slice_percentages_fail_before_rendering(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:160,width:800,height:480};
for(const id of ['chart.pie','chart.donut']) for(const variant of ['legend-top-right','outside-labels','shared-legend']) {
  const definition=REGISTRY.get(id);
  for(const values of [[99,1],[99.9,0.1]]) assert.throws(()=>definition.render({id:'small',frame,props:{labels:['Main','Small'],values,variant}}),/does not fit its slice/);
  const nodes=definition.render({id:'normal',frame,props:{labels:['Core','Growth','New'],values:[52,31,17],variant}}).nodes;
  assert.equal(nodes.filter(n=>n.role==='data-label').length,3);
  assert.throws(()=>definition.render({id:'tiny',frame:{...frame,width:160,height:160},props:{labels:['A','B'],values:[50,50],variant}}),/does not fit|do not fit/);
}
const group=REGISTRY.get('chart-group');
assert.throws(()=>group.render({id:'group',frame,props:{charts:group.sample.charts.map(chart=>({...chart,props:{labels:['Main','Small'],values:[99,1]}}))}}),/does not fit its slice/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_shared_legend_center_and_stable_category_mapping(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const d=REGISTRY.get('chart-group'), frame={x:60,y:180,width:1160,height:460};
const nodes=d.render({id:'group',frame,props:d.sample}).nodes;
const legend=nodes.filter(n=>n.role==='legend-label'||n.role==='legend-swatch');
assert.equal(legend.length,6);
const left=Math.min(...legend.map(n=>n.frame.x)),right=Math.max(...legend.map(n=>n.frame.x+n.frame.width));
assert.ok(Math.abs((left+right)/2-(frame.x+frame.width/2))<0.01);
assert.ok(legend.every(n=>n.frame.y>=frame.y+frame.height-32));
const segments=nodes.filter(n=>n.role==='chart-segment');
for(const key of ['Core','Growth','New']) assert.equal(new Set(segments.filter(n=>n.data.categoryKey===key).map(n=>n.style.fill.tokenId)).size,1);
assert.throws(()=>d.render({id:'bad',frame,props:{...d.sample,categoryKeys:['Core','Growth','Unused']}}),/Shared legend/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])
