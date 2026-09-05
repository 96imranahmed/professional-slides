import unittest
from test_source_structure import run_node


class SectionBoundaryTests(unittest.TestCase):
    def test_variants_geometry_tokens_and_failure_boundaries(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {compileDeck,TOKENS} from './skills/professional-slides/runtime/core.mjs';
import {componentFixtureSpecs,componentVariantFixtureSpecs,layoutFixtureSpecs} from './skills/professional-slides/runtime/fixtures.mjs';
const owner=REGISTRY.get('section-boundary'),frame={x:760,y:150,width:54,height:484};
assert.equal(owner.resolveVariant({}),'related');
assert.throws(()=>owner.render({id:'x',frame,props:{variant:'causal'}}),/Unknown/);
assert.throws(()=>owner.render({id:'x',frame:{...frame,width:20},props:{variant:'inference'}}),/needs room/);
assert.throws(()=>owner.render({id:'x',frame:{...frame,height:35},props:{variant:'inference'}}),/needs room/);
const related=owner.render({id:'x',frame,props:{}}).nodes;
assert.equal(related.length,1);assert.equal(related[0].style.dash,'dash');
const inference=owner.render({id:'x',frame,props:{variant:'inference'}}).nodes;
assert.equal(inference.length,5);assert.ok(inference.every(n=>n.type!=='text'));
const disc=inference.find(n=>n.role==='relationship-disc');
assert.equal(disc.frame.width,TOKENS['icon.medium'].value);assert.equal(disc.frame.width,24);
assert.equal(TOKENS['icon.medium'].cssVar,'--icon-md');
assert.equal(disc.frame.x+disc.frame.width/2,787);assert.equal(disc.frame.y+disc.frame.height/2,392);
assert.ok(inference[0].frame.y+inference[0].frame.height<disc.frame.y);
assert.ok(inference[1].frame.y>disc.frame.y+disc.frame.height);
const specs=[...componentFixtureSpecs(),...componentVariantFixtureSpecs()].filter(s=>s.target==='section-boundary');
assert.equal(specs.length,3);
assert.equal(specs.filter(s=>s.defaultVariant).length,1);
for(const palette of ['mckinsey','bcg','bain']) {
 const d=compileDeck({id:'boundary',palette,slides:specs},REGISTRY);
 const n=d.slides.flatMap(s=>s.nodes).find(n=>n.role==='relationship-disc');
 assert.equal(n.style.fill.value,d.manifest.tokens['color.componentPrimary'].value);
}
const panel=layoutFixtureSpecs().find(s=>s.id==='fixture-layout-context-panel');
const d=compileDeck({id:'panel',slides:[panel]},REGISTRY),nodes=d.slides[0].nodes;
const headings=nodes.filter(n=>n.role==='section-heading'),body=nodes.filter(n=>n.role==='paragraph');
assert.equal(headings.length,3);assert.equal(new Set(headings.map(n=>n.style.fontSize.value)).size,1);
assert.equal(body.length,3);assert.equal(new Set(body.map(n=>n.style.fontSize.value)).size,1);
assert.equal(body[0].style.fontSize.value,d.manifest.tokens['type.body'].value);
assert.equal(nodes.filter(n=>n.role==='subsection-rule').length,2);
assert.equal(nodes.filter(n=>n.role==='section-heading-rule').length,0);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_marker_layers_do_not_exempt_foreign_objects_or_text(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {textPrimitive,token} from './skills/professional-slides/runtime/core.mjs';
import {renderSlideHtml} from './skills/professional-slides/runtime/adapters/html.mjs';
import {auditSlideOverlaps} from './skills/professional-slides/runtime/validate-overlap.mjs';
const require=createRequire(import.meta.url),{chromium}=require(require.resolve('playwright',{paths:[process.env.RUNTIME_NODE_MODULES]}));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER_PATH}),page=await browser.newPage({viewport:{width:1280,height:720}});
const nodes=REGISTRY.get('section-boundary').render({id:'boundary',frame:{x:760,y:150,width:54,height:484},props:{variant:'inference'}}).nodes;
nodes.forEach(n=>n.data.componentInstance='boundary');
async function audit(nodes){const slide={id:'test',nodes};await page.setContent(renderSlideHtml(slide));return auditSlideOverlaps(page,slide);}
assert.equal((await audit(nodes)).accepted,true);
const text=textPrimitive({id:'bad-text',frame:{x:772,y:380,width:90,height:30},text:'Collision',style:{fontFamily:token('font.body'),fontSize:token('type.body'),color:token('color.ink')}});
assert.equal((await audit([...nodes,text])).accepted,false);
const foreign=structuredClone(nodes.find(n=>n.role==='relationship-chevron'));foreign.id='foreign';foreign.data.componentInstance='other';
assert.equal((await audit([...nodes,foreign])).accepted,false);
await browser.close();console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


if __name__ == '__main__':
    unittest.main()
