import unittest

from test_source_structure import run_node


class TemplateSequenceTests(unittest.TestCase):
    def test_repeated_slide_template_locks_structure_and_allows_content(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {instantiateSlideTemplate,planDeck} from './skills/professional-slides/runtime/planner.mjs';
const base={title:'(Insert action title)',layout:'grid',density:'pre-read',copyBudget:{maxWordsPerSlide:140,rationale:'Two stable regions with variable content'},items:[
 {id:'context',job:'frame the case',heading:'(Insert context heading)',items:[{id:'context-copy',job:'develop the context',component:'paragraph',props:{text:'(Insert context)'}}]},
 {id:'evidence',job:'show the evidence',heading:'(Insert evidence heading)',items:[{id:'evidence-copy',job:'develop the evidence',component:'bullet-list',props:{variant:'body',items:['(Insert evidence 1)','(Insert evidence 2)']}}]}
]};
const plans=instantiateSlideTemplate({id:'cases',template:base,instances:[1,2,3].map(index=>({id:`case-${index}`,title:`(Insert case ${index} action title)`,itemContent:{'context-copy':{props:{text:`(Insert context ${index})`}},'evidence-copy':{props:{items:[`(Insert evidence ${index}.1)`,`(Insert evidence ${index}.2)`]}}}}))});
const {deck}=planDeck({id:'sequence',slides:plans});
assert.equal(deck.templateSequences.length,1);assert.equal(deck.templateSequences[0].total,3);
assert.equal(new Set(deck.slides.map(slide=>slide.template.structuralHash)).size,1);
assert.deepEqual(deck.slides.map(slide=>slide.template.index),[1,2,3]);
assert.equal(deck.manifest.templateSequences[0].id,'cases');
const drift=structuredClone(plans);drift[1].itemContent=undefined;drift[1].items[1].items[0].props.variant='compact';
assert.throws(()=>planDeck({id:'drift',slides:drift}),/changed layout, component frames or variants/);
assert.throws(()=>planDeck({id:'gap',slides:[plans[0],{...plans[0],id:'other',template:undefined},plans[1],plans[2]]}),/must remain contiguous/);
assert.throws(()=>instantiateSlideTemplate({id:'bad',template:base,instances:[{id:'one',title:'One',layout:'absolute'},{id:'two',title:'Two'}]}),/may change only/);
console.log(JSON.stringify({accepted:true,slides:deck.slides.length,hash:deck.slides[0].template.structuralHash}));
''')
        self.assertTrue(result['accepted'])
        self.assertEqual(result['slides'], 3)
        self.assertEqual(len(result['hash']), 64)
