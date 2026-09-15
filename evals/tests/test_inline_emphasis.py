import unittest
from node_probe import run_node


class InlineEmphasisTests(unittest.TestCase):
    def test_mixed_metrics_wrap_once_and_reconstruct_complete_text(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {measureText,measureTextRuns} from './skills/professional-slides/runtime/text-layout.mjs';
const text='Review the complete evidence with the working team and preserve every condition.';
const options={fontSize:12,wrapWidthRatio:1};
assert.deepEqual({...measureTextRuns([{text,bold:false}],200,options),runs:undefined,sourceRuns:undefined},{...measureText(text,200,options),runs:undefined,sourceRuns:undefined});
const mixed=measureTextRuns([{text:'Review the complete evidence',bold:true},{text:' with the working team and preserve every condition.',bold:false}],180,options);
assert.equal(mixed.runs.map(r=>r.text).join(''),mixed.text);
assert.equal(mixed.lines.join(' ').replace(/\\s+/g,' '),text);
assert.ok(mixed.lines.length>2);
assert.ok(mixed.runs.some(r=>r.bold)&&mixed.runs.some(r=>!r.bold));
assert.equal(mixed.runs.filter(r=>r.bold).map(r=>r.text).join(' ').replace(/\\s+/g,' ').trim(),'Review the complete evidence');
assert.ok(mixed.width<=180);
assert.throws(()=>measureTextRuns([{text:'Invalid',bold:true,fontSize:8}],100),/boolean bold only/);
assert.throws(()=>measureTextRuns([{text:'Unbreakableword',bold:true}],5),/Unbreakable/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_phase_emphasis_stays_one_semantic_text_node(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component,textPrimitive} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {PHASE_WORKSTREAM_VARIANTS} from './skills/professional-slides/runtime/phase-workstreams.mjs';
import {renderSlideHtml} from './skills/professional-slides/runtime/adapters/html.mjs';
const props=structuredClone(PHASE_WORKSTREAM_VARIANTS['phase-workstreams'].props),frame={x:60,y:140,width:1160,height:500};
const compile=p=>compileDeck({slides:[{id:'e',density:'pre-read',frame,composition:component({id:'phases',component:'roadmap',frame,props:p})}]},REGISTRY);
const deck=compile(props),nodes=deck.slides[0].nodes,activities=nodes.filter(n=>n.role==='roadmap-activity');
assert.equal(activities.length,4);
for(const n of activities){assert.ok(n.runs.length>1);assert.equal(n.runs.map(r=>r.text).join(''),n.text);assert.equal(n.style.fontSize.value,9);}
assert.ok(renderSlideHtml(deck.slides[0]).includes('font-weight:700'));
assert.ok(renderSlideHtml(deck.slides[0]).includes('font-weight:400'));
props.phases[0].workstreams[0].activities[0].lead='Unmatched prefix';
assert.throws(()=>compile(props),/exact complete-word text prefix/);
assert.throws(()=>textPrimitive({id:'bad',frame,text:'Hello',runs:[{text:'Different',bold:true}]}),/reconstruct/);
assert.throws(()=>textPrimitive({id:'bad',frame,text:'Hello',runs:[{text:'Hello',bold:true,color:'red'}]}),/only bold/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

