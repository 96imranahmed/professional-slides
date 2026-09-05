import unittest
from test_source_structure import run_node


class GoldenSetTests(unittest.TestCase):
    def test_gallery_groups_related_layers_without_hiding_fixtures(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { goldenSetSpecs, goldenGalleryGroups } from './skills/professional-slides/runtime/golden-set.mjs';
const specs=goldenSetSpecs(),groups=goldenGalleryGroups(specs);
const ids=groups.flatMap(g=>g.fixtures.map(f=>f.id));
assert.deepEqual([...ids].sort(),specs.map(f=>f.id).sort());
assert.equal(new Set(ids).size,specs.length);
for(const [id,targets] of [['page-shell',['slide-chrome','page-template']],['section-container',['section','section-heading']],['titles',['action-title','section-title']]]) {
 const group=groups.find(g=>g.id===id);
 assert.ok(group.description);
 assert.deepEqual([...new Set(group.fixtures.map(f=>f.target))].sort(),targets.sort());
 for(const target of targets) assert.ok(group.fixtures.some(f=>f.target===target&&(f.coverage||[]).some(item=>item.target===target)));
}
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_section_divider_modes_rule_variants_and_generic_copy(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { compileDeck, component } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { buildGoldenSetDeck } from './skills/professional-slides/runtime/golden-set.mjs';
import { contrastRatio } from './skills/professional-slides/runtime/palettes.mjs';
const definition=REGISTRY.get('section-divider'),frame={x:0,y:0,width:1280,height:720};
assert.equal(Object.keys(definition.variants).length,12);
assert.equal(definition.defaultVariant,'plain-dark-none');
for(const palette of ['mckinsey']) {
 const {deck,fixtures}=buildGoldenSetDeck({palette});
 const variants=fixtures.filter(f=>f.target==='section-divider').map(f=>({fixture:f,slide:deck.slides[f.slide-1]}));
 assert.equal(variants.length,12);
 const textFrames={};
 for(const {fixture,slide} of variants) {
  const title=slide.nodes.find(n=>n.role==='divider-title'), number=slide.nodes.find(n=>n.role==='divider-number');
  assert.equal(title.text,'(Insert section title)');
  assert.equal(title.style.fontFamily.tokenId,'font.display');
  assert.equal(title.style.fontSize.tokenId,'type.deckTitle');
  assert.equal(title.frame.y+title.frame.height/2,360);
  const style=fixture.variant.startsWith('numbered-')?'numbered':'plain';
  const dark=fixture.variant.includes('-dark-');
  if(textFrames[style]) assert.deepEqual(title.frame,textFrames[style]);textFrames[style]=title.frame;
  assert.equal(Boolean(number),style==='numbered');
  if(number){assert.equal(number.text,'1');assert.equal(number.style.fontSize.tokenId,'type.sectionNumber');assert.equal(number.style.color.tokenId,dark?'color.onPrimary':'color.componentPrimary');}
  const surface=slide.nodes.find(n=>n.role==='divider-surface');
  assert.ok(contrastRatio(title.style.color.value,surface.style.fill.value)>=4.5);
  assert.equal(title.style.color.tokenId,dark?'color.onPrimary':'color.ink');
  assert.equal(surface.style.fill.tokenId,dark?'color.ink':'color.canvas');
  assert.equal(slide.nodes.filter(n=>n.type==='line').length,fixture.variant.endsWith('-none')?0:fixture.variant.includes('-top-and-bottom')?2:1);
 }
 const standard=deck.slides.find(s=>s.id==='golden-divider');
 assert.deepEqual(standard.nodes.filter(n=>n.role==='divider-title').map(n=>n.text),['(Insert section title)']);
 assert.ok(!standard.nodes.some(n=>['divider-number','divider-orientation'].includes(n.role)));
}
for(const props of [{title:''},{title:42},{title:'A',mode:'sepia'},{title:'A',style:'numbered'},{title:'A',style:'poster'},{title:'A',subtitle:'B'},{title:'A',number:'1'},{title:'A',orientation:'B'},{title:'A',dividerRule:true},{title:'A',pageTemplate:{rules:'sometimes'}},{title:'A\\nB\\nC'}]) assert.throws(()=>definition.render({id:'bad',frame,props}));
const company=compileDeck({palette:'bain',typography:{display:'Georgia'},pageTemplate:{rules:'bottom'},slides:[{id:'divider',frame,composition:component({id:'divider',component:'section-divider',frame,props:{title:'Section A',mode:'light',companyName:'Company',pageNumber:2}})}]},REGISTRY);
assert.equal(company.slides[0].nodes.find(n=>n.role==='divider-title').style.fontFamily.value,'Georgia');
assert.equal(company.slides[0].nodes.filter(n=>n.role==='footer-rule').length,1);
const furniture=company.slides[0].nodes.filter(n=>['footer-right','page-number'].includes(n.role));
assert.equal(furniture.length,2);assert.equal(furniture[0].frame.y,furniture[1].frame.y);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_template_copy_and_guidance_contract(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { buildGoldenSetDeck, goldenSetSpecs } from './skills/professional-slides/runtime/golden-set.mjs';
import { REGISTRY, registryManifest } from './skills/professional-slides/runtime/registry.mjs';
const specs=goldenSetSpecs(), {deck}=buildGoldenSetDeck();
const hasGuidance=spec=>['Guidance','Use when:','Why:','Action title:'].every(label=>(spec.notes||'').includes(label));
const standards=specs.filter(spec=>spec.kind==='standard');
const chartFixtures=specs.filter(spec=>['chart','variant','board'].includes(spec.kind)&&REGISTRY.get(spec.target)?.category==='chart');
const guidedExamples=specs.filter(spec=>spec.example&&(REGISTRY.get(spec.target)?.category==='chart'||spec.target==='chart-group'));
const hasSquare=text=>String(text||'').includes(String.fromCharCode(91))||String(text||'').includes(String.fromCharCode(93));
assert.equal(standards.length,25);
assert.ok(guidedExamples.length>=10);
assert.ok(standards.every(hasGuidance));
assert.ok(chartFixtures.every(hasGuidance));
assert.ok(guidedExamples.every(hasGuidance));
for(const slide of deck.slides) {
  assert.equal(hasSquare(slide.notes),false);
  for(const node of slide.nodes||[]) if(typeof node.text==='string') assert.equal(hasSquare(node.text),false);
}
const textFor=id=>deck.slides.find(slide=>slide.id===id).nodes.map(node=>node.text).filter(Boolean);
assert.ok(textFor('golden-divider').includes('(Insert section title)'));
assert.ok(textFor('golden-rollout').includes('(We plan to roll-out across Y years)'));
assert.ok(textFor('golden-text').includes('(Insert section title)'));
const manifestCharts=registryManifest().components.filter(component=>component.category==='chart');
assert.ok(chartFixtures.length<manifestCharts.reduce((count,component)=>count+Math.max(1,Object.keys(component.variants||{}).length),0));
assert.ok(manifestCharts.every(component=>component.guidance?.useWhen&&component.guidance?.why&&component.guidance?.actionTitle));
const group=registryManifest().components.find(component=>component.id==='chart-group');
assert.ok(group.guidance?.useWhen&&group.guidance?.why&&group.guidance?.actionTitle);
console.log(JSON.stringify({accepted:true,slides:deck.slides.length,standards:standards.length,chartFixtures:chartFixtures.length,guidedExamples:guidedExamples.length,manifestCharts:manifestCharts.length}));
""")
        self.assertTrue(result["accepted"])
        self.assertEqual(result["standards"], 25)

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
import { TOKENS } from './skills/professional-slides/runtime/core.mjs';
const title=REGISTRY.get('chart-title'),frame={x:60,y:180,width:500,height:90};
const plain=title.render({id:'title',frame,props:{heading:'Current mix'}}).nodes;
const unit=title.render({id:'title',frame,props:{heading:'Current mix',unit:'Revenue share, %'}}).nodes;
assert.equal(plain.filter(n=>n.role==='section-heading-rule').length,1);
assert.equal(unit.filter(n=>n.role==='section-heading-rule').length,0);
assert.equal(unit.find(n=>n.role==='chart-unit').style.color.tokenId,'color.chartUnit');
assert.equal(unit.find(n=>n.role==='chart-unit').style.bold,false);
assert.equal(unit.find(n=>n.role==='chart-unit').style.fontSize.tokenId,'type.body');
assert.equal(TOKENS['type.chartLabel'].value,TOKENS['type.body'].value);
assert.equal(TOKENS['type.chartAnnotation'].value,TOKENS['type.body'].value);
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
assert.ok(legend.every(n=>n.style.fontSize.tokenId==='type.chartLabel'));
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
import { GOLDEN_PALETTES } from './skills/professional-slides/runtime/palettes.mjs';
import { TOKENS, THEME_SLOT_TOKENS, compileDeck, component } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { renderSlideHtml } from './skills/professional-slides/runtime/adapters/html.mjs';
const original=JSON.stringify(TOKENS), definition=REGISTRY.get('table');
const spec={id:'palette-probe',frame:{x:0,y:0,width:1280,height:720},composition:component({id:'table',component:'table',frame:{x:60,y:150,width:1160,height:420},props:definition.sample})};
const decks=['mckinsey','bcg','bain'].map(palette=>compileDeck({id:`probe-${palette}`,palette,slides:[spec]},REGISTRY));
assert.equal(JSON.stringify(TOKENS),original);
assert.equal(new Set(decks.map(d=>d.manifest.tokens['color.componentPrimary'].value)).size,3);
assert.equal(new Set(decks.map(d=>d.manifest.designHash)).size,3);
for(const deck of decks) for(const slide of deck.slides) {
  const html=renderSlideHtml(slide);
  for(const token of Object.values(slide.tokens)) assert.ok(html.includes(`${token.cssVar}:${token.value}`));
  for(const node of slide.nodes) for(const style of Object.values(node.style)) if(style?.tokenId) assert.equal(style.value,slide.tokens[style.tokenId].value);
  for(const token of Object.values(slide.tokens)) if(token.themeSlot) assert.equal(token.value,slide.tokens[THEME_SLOT_TOKENS[token.themeSlot]].value);
}
assert.throws(()=>compileDeck({palette:'unknown',slides:[]},REGISTRY),/Unknown palette/);
assert.throws(()=>compileDeck({slides:[{palette:'bain'}]},REGISTRY),/palette/i);
assert.deepEqual(GOLDEN_PALETTES,['mckinsey']);
const golden=buildGoldenSetDeck();
console.log(JSON.stringify({palettes:decks.map(d=>d.palette.id),goldenPalettes:GOLDEN_PALETTES,slides:golden.deck.slides.length}));
""")
        self.assertEqual(result["palettes"], ["mckinsey", "bcg", "bain"])
        self.assertEqual(result["goldenPalettes"], ["mckinsey"])

    def test_registry_drives_complete_nonduplicated_golden_coverage(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { goldenSetSpecs, auditGoldenCoverage } from './skills/professional-slides/runtime/golden-set.mjs';
import { componentVariantFixtureSpecs } from './skills/professional-slides/runtime/fixtures.mjs';
const specs=goldenSetSpecs(), audit=auditGoldenCoverage(specs);
assert.ok(audit.accepted);
assert.ok(!auditGoldenCoverage(specs.slice(1)).accepted);
assert.ok(!auditGoldenCoverage([...specs,specs[0]]).accepted);
assert.ok(!auditGoldenCoverage([...specs,{id:'unknown'}]).accepted);
const coverage=specs.flatMap(spec=>spec.coverage||[]);
for(const definition of REGISTRY.values()) {
  const variants=Object.keys(definition.variants||{});
  if(!variants.length) assert.equal(coverage.filter(item=>item.target===definition.id&&item.variant===null).length,1);
  for(const variant of variants) assert.equal(coverage.filter(item=>item.target===definition.id&&item.variant===variant).length,1);
}
assert.ok(componentVariantFixtureSpecs().every(f=>!f.defaultVariant));
assert.equal(audit.variants,audit.variantSlides+audit.omittedDefaultDuplicates);
assert.ok(audit.componentSlides<audit.components+audit.variantSlides);
assert.deepEqual(audit.duplicateVisualBranches,[]);
assert.ok(audit.slides<=180);
console.log(JSON.stringify(audit));
""")
        self.assertEqual(result["components"], 60)
        self.assertEqual(result["standards"], 25)

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

    def test_paired_chart_group_can_use_one_quiet_divider(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const definition=REGISTRY.get('chart-group'),frame={x:60,y:180,width:1160,height:460};
const plain=definition.render({id:'plain',frame,props:definition.sample}).nodes;
assert.equal(plain.filter(n=>n.role==='chart-group-divider').length,0);
const nodes=definition.render({id:'divided',frame,props:{...definition.sample,divider:true}}).nodes;
const divider=nodes.find(n=>n.role==='chart-group-divider');
assert.ok(divider);
assert.equal(divider.frame.x,frame.x+frame.width/2);
assert.equal(divider.frame.width,0);
assert.equal(divider.style.stroke.tokenId,'color.rule');
assert.equal(divider.style.lineWidth.tokenId,'line.hairline');
assert.ok(divider.frame.y>frame.y&&divider.frame.y+divider.frame.height<frame.y+frame.height-32);
assert.throws(()=>definition.render({id:'bad',frame,props:{...definition.variants.triple.props,divider:true}}),/paired chart group/);
assert.throws(()=>definition.render({id:'bad',frame,props:{...definition.sample,divider:'yes'}}),/boolean/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])
