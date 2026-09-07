import unittest
from test_source_structure import run_node


class BodyBulletTests(unittest.TestCase):
    def test_body_variant_is_measured_theme_bound_and_never_distributed(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('bullet-list'),frame={x:0,y:0,width:440,height:300};
const props={variant:'body',items:['Demand has strengthened, but additional capacity is needed before the business can convert it into growth.','Proceed only after the required capacity is available.']};
const measured=owner.measureContent({frame,props}),nodes=owner.render({id:'body',frame,props}).nodes;
assert.equal(nodes.filter(n=>n.role==='list-item').length,2);
const [a,b]=nodes.filter(n=>n.role==='list-item');
assert.equal(a.style.fontSize.tokenId,'type.body');assert.equal(a.style.fontFamily.tokenId,'font.body');
assert.equal(a.frame.x,b.frame.x);assert.equal(b.frame.y-a.frame.y-a.frame.height,8);
assert.equal(b.frame.y+b.frame.height,measured.height);
assert.deepEqual(owner.render({id:'body',frame:{...frame,height:600},props}).nodes,nodes);
assert.throws(()=>owner.render({id:'body',frame:{...frame,height:30},props}),/never shrink/);
assert.throws(()=>owner.render({id:'body',frame,props:{...props,variant:'tiny'}}),/Unknown/);
assert.throws(()=>owner.measureContent({frame,props:{variant:'body',items:[]}}),/nonempty/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
