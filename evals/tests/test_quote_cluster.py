import unittest

from test_source_structure import run_node


class QuoteClusterTests(unittest.TestCase):
    def test_quote_cluster_is_the_single_runtime_owner(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const definition=REGISTRY.get('quote-cluster');
assert.ok(definition);
assert.equal(REGISTRY.has('quote'),false);
assert.equal(definition.defaultVariant,'three-speech-bubble-staggered-full');
assert.equal(Object.keys(definition.variants).length,11);
assert.equal(definition.resolveVariant(definition.sample),definition.defaultVariant);
assert.deepEqual(Object.keys(definition.variants).map(key=>definition.resolveVariant({...definition.sample,...definition.variants[key].props})),Object.keys(definition.variants));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_original_speech_bubble_is_staggered_and_theme_bound(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { compileDeck, component } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { renderSlideHtml } from './skills/professional-slides/runtime/adapters/html.mjs';
const definition=REGISTRY.get('quote-cluster');
const deck=compileDeck({palette:'mckinsey',slides:[{id:'quotes',frame:{x:60,y:150,width:1160,height:480},composition:component({id:'cluster',component:'quote-cluster',frame:{x:60,y:150,width:1160,height:480},props:definition.sample})}]},REGISTRY);
const slide=deck.slides[0],surfaces=slide.nodes.filter(node=>node.role==='quote-surface'),marks=slide.nodes.filter(node=>node.role==='quote-mark'),attributions=slide.nodes.filter(node=>node.role==='quote-attribution');
assert.equal(surfaces.length,3);
assert.ok(surfaces.every(node=>node.type==='shape'&&node.data.geometry==='snip1Rect'&&node.style.flipV===true));
assert.equal(marks.length,3);
assert.ok(marks.every(node=>node.id.endsWith('mark-open')&&node.style.color.tokenId==='color.componentPrimary'&&node.style.color.value==='#051C2C'));
assert.ok(attributions.every(node=>node.style.align==='left'));
for (const attribution of attributions) {
  const surface=surfaces.find(n=>n.data.quoteIndex===attribution.data.quoteIndex);
  assert.ok(attribution.frame.x+attribution.frame.width<=surface.frame.x+surface.frame.width*0.88);
}
assert.ok(surfaces[0].frame.y<surfaces[1].frame.y&&surfaces[1].frame.y<surfaces[2].frame.y);
assert.ok(surfaces[0].frame.x<surfaces[1].frame.x&&surfaces[2].frame.x>surfaces[0].frame.x&&surfaces[2].frame.x<surfaces[1].frame.x);
const html=renderSlideHtml(slide);
assert.ok(html.includes('scale(1 -1)'));
console.log(JSON.stringify({accepted:true,nodes:slide.nodes.length}));
""")
        self.assertTrue(result["accepted"])

    def test_count_placement_treatment_and_avatar_axes_render_independently(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { compileDeck, component } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const d=REGISTRY.get('quote-cluster'),frame={x:60,y:150,width:1160,height:480};
const render=props=>compileDeck({slides:[{id:'q',frame,composition:component({id:'cluster',component:'quote-cluster',frame,props})}]},REGISTRY).slides[0];
const contained=render(d.variants['three-contained-grid-full'].props);
assert.equal(contained.nodes.filter(n=>n.role==='quote-surface').length,3);
assert.equal(contained.nodes.filter(n=>n.id.endsWith('mark-close')).length,3);
assert.ok(contained.nodes.filter(n=>['quote-attribution','quote-detail'].includes(n.role)).every(n=>n.style.align==='right'));
const callout=render(d.variants['two-callout-grid-full-below-center'].props);
assert.equal(callout.nodes.filter(n=>n.role==='quote-caret').length,0);
assert.equal(callout.nodes.filter(n=>n.role==='quote-surface'&&n.data.geometry==='quoteCallout').length,2);
const sectionFrame={x:660,y:150,width:560,height:460};
const section=compileDeck({slides:[{id:'s',frame:sectionFrame,composition:component({id:'cluster',component:'quote-cluster',frame:sectionFrame,props:d.variants['two-contained-grid-section'].props})}]},REGISTRY).slides[0];
const sectionSurfaces=section.nodes.filter(n=>n.role==='quote-surface');
assert.equal(sectionSurfaces.length,2);
assert.equal(sectionSurfaces[0].frame.x,sectionSurfaces[1].frame.x);
assert.ok(sectionSurfaces[0].frame.y<sectionSurfaces[1].frame.y);
const avatars=render(d.variants['five-contained-grid-full-avatar'].props);
assert.equal(avatars.nodes.filter(n=>n.role==='quote-avatar').length,5);
assert.deepEqual(avatars.nodes.filter(n=>n.role==='quote-avatar-label').map(n=>n.text),['1','2','3','4','5']);
for(const attribution of avatars.nodes.filter(n=>n.role==='quote-attribution')) {
  const avatar=avatars.nodes.find(n=>n.role==='quote-avatar'&&n.data.quoteIndex===attribution.data.quoteIndex);
  assert.ok(avatar.frame.x+avatar.frame.width<attribution.frame.x);
  const initials=avatars.nodes.find(n=>n.role==='quote-avatar-label'&&n.data.quoteIndex===attribution.data.quoteIndex);
  assert.ok(Math.abs(initials.frame.y+initials.frame.height/2-avatar.frame.y-avatar.frame.height/2)<.001);
  const surface=avatars.nodes.find(n=>n.role==='quote-surface'&&n.data.quoteIndex===attribution.data.quoteIndex);
  const detail=avatars.nodes.find(n=>n.role==='quote-detail'&&n.data.quoteIndex===attribution.data.quoteIndex);
  assert.ok(avatar.frame.y>surface.frame.y+surface.frame.height);
  assert.equal(attribution.frame.y,avatar.frame.y);
  assert.ok(detail.frame.y>attribution.frame.y);
  assert.equal(detail.frame.x,attribution.frame.x);
  assert.equal(attribution.style.align,'left');
}
for(const bad of [
  {quotes:[]},
  {quotes:Array.from({length:6},()=>({quote:'A',attribution:'B'}))},
  {quotes:[{quote:'A',attribution:''}]},
  {quotes:[{quote:'A',attribution:'B'}],arrangement:'staggered'},
  {quotes:Array.from({length:4},()=>({quote:'A',attribution:'B'})),placement:'section'}
]) assert.throws(()=>render(bad));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_one_up_quote_is_larger_and_callout_attribution_tracks_its_caret(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { compileDeck, component } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const d=REGISTRY.get('quote-cluster'),frame={x:60,y:150,width:1160,height:480};
const render=props=>compileDeck({palette:'mckinsey',slides:[{id:'q',frame,composition:component({id:'cluster',component:'quote-cluster',frame,props})}]},REGISTRY).slides[0].nodes;
const contained=render(d.variants['one-contained-grid-full'].props);
const surface=contained.find(n=>n.role==='quote-surface'),body=contained.find(n=>n.role==='quote-body'),marks=contained.filter(n=>n.role==='quote-mark');
assert.equal(surface.frame.width,980);assert.equal(surface.frame.height,440);
assert.equal(body.style.fontSize.tokenId,'type.sectionTitle');assert.equal(body.style.fontSize.value,24);
assert.equal(marks.length,2);assert.ok(marks.every(n=>n.style.fontSize.tokenId==='type.quoteMarkHero'&&n.style.fontSize.value===76&&n.frame.height===116));
assert.ok(body.frame.x>marks[0].frame.x+marks[0].frame.width);
assert.ok(body.frame.x+body.frame.width<marks[1].frame.x);
const center=render(d.variants['one-callout-grid-full-below-center'].props),left=render(d.variants['one-callout-grid-full-below-left'].props);
const centerSurface=center.find(n=>n.role==='quote-surface'),centerAttribution=center.find(n=>n.role==='quote-attribution');
const leftSurface=left.find(n=>n.role==='quote-surface'),leftAttribution=left.find(n=>n.role==='quote-attribution');
assert.equal(centerAttribution.style.align,'center');assert.equal(leftAttribution.style.align,'left');
assert.ok(centerAttribution.frame.y>=centerSurface.frame.y+centerSurface.frame.height);
assert.ok(leftAttribution.frame.y>=leftSurface.frame.y+leftSurface.frame.height);
assert.equal(centerSurface.data.geometry,'quoteCallout');assert.equal(leftSurface.data.geometry,'quoteCallout');
assert.ok(Math.abs(centerSurface.data.caretCenterRatio-0.5)<1e-9);
assert.ok(leftSurface.data.caretCenterRatio<centerSurface.data.caretCenterRatio);
assert.equal(leftAttribution.frame.x,leftSurface.frame.x+16);
assert.ok(body.frame.y>=marks[0].frame.y+marks[0].frame.height-8);
assert.equal(centerAttribution.data.attributionPlacement,'below-center');assert.equal(leftAttribution.data.attributionPlacement,'below-left');
for(const bad of [
  {...d.variants['one-contained-grid-full'].props,attributionPlacement:'below-left'},
  {...d.variants['one-callout-grid-full-below-center'].props,attributionAlign:'left'},
  {...d.variants['one-callout-grid-full-below-left'].props,attributionAlign:'center'}
]) assert.throws(()=>render(bad));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])


if __name__ == "__main__":
    unittest.main()
