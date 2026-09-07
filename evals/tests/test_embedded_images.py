import unittest
from test_source_structure import run_node


class EmbeddedImageTests(unittest.TestCase):
    def test_image_component_embeds_rectangular_assets_and_rejects_missing_provenance(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { compileDeck, component } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { renderSlideHtml } from './skills/professional-slides/runtime/adapters/html.mjs';
const frame={x:0,y:0,width:400,height:200};
const render=props=>compileDeck({slides:[{id:'photo',frame,composition:component({id:'image',component:'image-frame',frame,props})}]},REGISTRY).slides[0];
const props={dataUri:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',alt:'Film still',authorization:'User supplied image'};
const slide=render(props), node=slide.nodes.find(n=>n.type==='image');
assert.equal(node.data.dataUri,props.dataUri);
assert.equal(node.data.circular,false);
assert.equal(node.frame.width,400);
const html=renderSlideHtml(slide);
assert.ok(html.includes('preserveAspectRatio="none"'));
assert.ok(!html.includes('<clipPath'));
assert.throws(()=>render({...props,authorization:''}),/authorization/);
assert.throws(()=>render({...props,dataUri:'https://example.com/image.png'}),/embedded/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])
