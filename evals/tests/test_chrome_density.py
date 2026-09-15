import unittest
from node_probe import run_node


class ChromeDensityTests(unittest.TestCase):
    def test_page_furniture_is_stable_while_evidence_density_changes(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component,TOKENS} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const densities=['pre-read','executive','live-pitch'];
const deck=compileDeck({pageTemplate:{rules:'none',branding:'none',contentSpacing:'compact'},slides:densities.map((density,i)=>({id:`density-${i}`,density,chrome:{title:'A stable analytical title',source:'Source: supplied evidence'},composition:component({id:'body',component:'paragraph',props:{text:'Evidence remains at its intended reading density.'}})}))},REGISTRY);
const roles=['action-title','source-text','page-number'];
for(const role of roles){const peers=deck.slides.map(s=>s.nodes.find(n=>n.role===role));assert.ok(peers.every(Boolean));assert.ok(peers.every(n=>n.style.fontSize.value===peers[0].style.fontSize.value));assert.ok(peers.every(n=>n.frame.y===peers[0].frame.y));}
assert.equal(deck.slides[0].nodes.find(n=>n.role==='action-title').style.fontSize.value,TOKENS['type.actionTitle'].value);
assert.deepEqual(deck.slides[0].contentFrame,deck.slides[2].contentFrame);
const evidence=deck.slides.map(s=>s.nodes.find(n=>n.text==='Evidence remains at its intended reading density.').style.fontSize.value);
assert.ok(evidence[0]<evidence[1]&&evidence[1]<evidence[2]);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_standalone_chrome_component_uses_deck_type(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component,TOKENS} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:0,y:0,width:1280,height:720};
const deck=compileDeck({slides:[{id:'standalone',density:'pre-read',frame,composition:component({id:'chrome',component:'slide-chrome',frame,props:{title:'A stable title',source:'Source: fixture'}})}]},REGISTRY);
const title=deck.slides[0].nodes.find(n=>n.role==='action-title');assert.equal(title.style.fontSize.value,TOKENS['type.actionTitle'].value);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
