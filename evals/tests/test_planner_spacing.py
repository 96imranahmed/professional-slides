import unittest
from node_probe import run_node


class PlannerSpacingTests(unittest.TestCase):
    def test_heading_hug_uses_measured_lines_before_related_body_gap(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const group=(id,heading)=>({id,job:'Keep the heading with its evidence',layout:'flow.column',gap:'space.2',size:{width:'fill',height:'hug'},items:[
  {id:`${id}-head`,job:'Name the evidence',component:'section-heading',props:{heading,rule:false,semantic:{kind:'section-member',relatedTo:[`${id}-body`]}},size:{width:'fill',height:'hug'}},
  {id:`${id}-body`,job:'Develop the evidence',component:'bullet-list',props:{variant:'body',items:[`Evidence for ${id}`],semantic:{kind:'section-member',relatedTo:[`${id}-head`]}},size:{width:'fill',height:'hug'}}
]});
const result=planDeck({id:'heading-rhythm',slides:[{id:'rhythm',title:'Related evidence keeps its heading',density:'executive',layout:'flow.column',gap:'space.5',items:[group('single','Single-line heading'),group('multiple','First heading line\nSecond heading line')]}]});
const slide=result.deck.slides[0];
const heading=id=>slide.nodes.find(n=>n.id.endsWith(`${id}-head:heading`));
const body=id=>slide.nodes.find(n=>n.text===`Evidence for ${id}`);
for(const id of ['single','multiple']){
  const h=heading(id),b=body(id);
  assert.ok(h&&b);
  assert.equal(b.frame.y-h.frame.y-h.frame.height,slide.tokens['space.2'].value,'Hug must not retain invisible preferred-height padding');
}
assert.ok(heading('multiple').frame.height>heading('single').frame.height,'Explicit second line must increase intrinsic heading height');
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_nested_spacing_is_explicit_and_theme_bound(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {planSlide} from './skills/professional-slides/runtime/planner.mjs';
const item=i=>({id:`p${i}`,job:'Preserve evidence',component:'paragraph',props:{text:`Evidence ${i}`}});
const plan={id:'spacing',title:'Evidence supports the sequence',layout:'flow.column',gap:'space.3',items:[{id:'group',job:'Keep related evidence together',layout:'flow.column',gap:'space.2',items:[item(1),item(2)]},item(3)]};
const out=planSlide(plan).spec.composition;
assert.equal(out.gap.tokenId,'space.3');
assert.equal(out.children[0].composition.gap.tokenId,'space.2');
for(const gap of [8,'color.ink','space.unknown'])assert.throws(()=>planSlide({...plan,gap}),/canonical spacing token/);
assert.throws(()=>planSlide({...plan,layout:'grid'}),/only for row and column flows/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
