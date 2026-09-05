import unittest
from test_source_structure import run_node


class InsightBoxTests(unittest.TestCase):
    def test_company_font_and_palette_are_inherited(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {renderSlideHtml} from './skills/professional-slides/runtime/adapters/html.mjs';
for(const palette of ['mckinsey','bcg','bain']) {
 const deck=compileDeck({id:'company',palette,typography:{body:'Georgia',display:'Georgia',semibold:{family:'Georgia',nativeBold:true,effectiveWeight:700}},slides:[{id:'insight-test',composition:component({id:'insight',component:'insight',props:{variant:'primary',text:'The stronger operating result supports expansion only if cash generation can fund the required investment.'},frame:{x:60,y:200,width:1160,height:120}})}]},REGISTRY);
 const [surface,body]=deck.slides[0].nodes;
 assert.equal(body.style.fontFamily.value,'Georgia');assert.equal(body.style.bold,false);
 assert.equal(surface.style.fill.value,deck.manifest.tokens['color.componentPrimary'].value);
 assert.equal(body.style.color.value,deck.manifest.tokens['color.onPrimary'].value);
 const html=renderSlideHtml(deck.slides[0]);assert.ok(html.includes('Georgia'));assert.ok(html.includes('--component-primary'));
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_shared_surfaces_and_measured_copy(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('insight'), frame={x:60,y:500,width:1160,height:100};
const props={text:'Stronger operating margins support the growth case, but returns remain uncertain until the business can fund its investment needs.'};
for(const variant of Object.keys(owner.variants)) {
 const input={...props,variant}, layout=owner.measureContent({frame,props:input});
 const nodes=owner.render({id:'insight',frame,props:input}).nodes;
 assert.equal(nodes.filter(n=>n.type==='text').length,1); const surface=nodes[0],body=nodes.at(-1);
 assert.equal(body.style.bold,false); assert.equal(body.style.fontFamily.tokenId,'font.body');
 assert.equal(body.style.fontSize.tokenId,'type.body'); assert.equal(body.style.align,'center');
 assert.equal(body.frame.y+body.frame.height/2,frame.y+frame.height/2);
 assert.equal(body.frame.x,frame.x+24); assert.equal(body.style.wrap,false);
 assert.equal(body.style.color.tokenId,variant==='primary'?'color.onPrimary':'color.ink');
 assert.equal(surface.style.stroke,'none');
 if(variant==='dotted'){
  assert.equal(surface.style.fill,'none');const dots=nodes.filter(n=>n.role==='insight-border-dot');assert.ok(dots.length>10);
  assert.equal(new Set(dots.map(n=>JSON.stringify(n.frame))).size,dots.length);
  for(const dot of dots){assert.equal(dot.type,'ellipse');assert.equal(dot.style.fill.tokenId,'color.rule');assert.equal(dot.style.stroke,'none');assert.ok(dot.frame.width<=1);assert.ok(dot.frame.x>=frame.x&&dot.frame.x+dot.frame.width<=frame.x+frame.width);assert.ok(dot.frame.y>=frame.y&&dot.frame.y+dot.frame.height<=frame.y+frame.height);}
 }else assert.equal(nodes.length,2);
 assert.equal(layout.height,body.frame.height+32);
 assert.throws(()=>owner.render({id:'insight',frame:{...frame,height:20},props:input}),/never shrink/);
}
const withHeading=owner.render({id:'titled',frame:{...frame,height:180},props:{...props,heading:'The expansion condition',align:'left'}}).nodes;
assert.equal(withHeading.length,3);assert.equal(withHeading[1].role,'insight-heading');
assert.equal(withHeading[1].style.bold,true);assert.equal(withHeading[2].style.bold,false);
assert.equal(withHeading[2].frame.y-withHeading[1].frame.y-withHeading[1].frame.height,8);
assert.throws(()=>owner.render({id:'bad',frame,props:{...props,variant:'custom'}}),/Unknown/);
assert.throws(()=>owner.measureContent({frame,props:{text:''}}),/nonempty/);
assert.throws(()=>owner.measureContent({frame,props:{...props,align:'justify'}}),/alignment/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
