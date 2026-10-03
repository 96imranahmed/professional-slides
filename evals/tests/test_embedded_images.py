import unittest
from node_probe import run_node


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


class BitmapDimensionTests(unittest.TestCase):
    def test_media_checks_actual_png_and_jpeg_dimensions(self):
        """Variant review: an image's declared size was trusted over its PNG or JPEG header."""
        run_node("""
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {MEDIA_SAMPLE,mediaNode,bitmapDimensions} from './skills/professional-slides/runtime/media.mjs';
const require=createRequire(process.env.RUNTIME_NODE_MODULES+'/package.json'),sharp=require('sharp');
const jpeg=await sharp({create:{width:40,height:20,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
for(const props of [MEDIA_SAMPLE,{...MEDIA_SAMPLE,dataUri:'data:image/jpeg;base64,'+jpeg.toString('base64'),width:40,height:20}]){
 assert.deepEqual(bitmapDimensions(props.dataUri),{width:props.width,height:props.height});
 const render=p=>mediaNode({id:'media',frame:{x:0,y:0,width:400,height:400},props:p});
 render(props);assert.throws(()=>render({...props,width:props.width+1}),/bitmap header/);assert.throws(()=>render({...props,height:props.height+1}),/bitmap header/);
}
assert.throws(()=>bitmapDimensions('data:image/png;base64,iVBORw0KGgo='));
assert.throws(()=>bitmapDimensions('data:image/jpeg;base64,/9g='));console.log('{}');
""")
