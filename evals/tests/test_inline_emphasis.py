import unittest
from test_source_structure import run_node


class InlineEmphasisTests(unittest.TestCase):
    def test_mixed_metrics_wrap_once_and_reconstruct_complete_text(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {measureText,measureTextRuns} from './skills/professional-slides/runtime/text-layout.mjs';
const text='Review the complete evidence with the working team and preserve every condition.';
const options={fontSize:12,wrapWidthRatio:1};
assert.deepEqual({...measureTextRuns([{text,bold:false}],200,options),runs:undefined},{...measureText(text,200,options),runs:undefined});
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
for(const n of activities){assert.ok(n.runs.length>1);assert.equal(n.runs.map(r=>r.text).join(''),n.text);assert.equal(n.style.fontSize.value,10.8);assert.ok(n.data.semantic.requires.length);}
assert.ok(renderSlideHtml(deck.slides[0]).includes('font-weight:700'));
assert.ok(renderSlideHtml(deck.slides[0]).includes('font-weight:400'));
props.phases[0].workstreams[0].activities[0].lead='Unmatched prefix';
assert.throws(()=>compile(props),/exact complete-word text prefix/);
assert.throws(()=>textPrimitive({id:'bad',frame,text:'Hello',runs:[{text:'Different',bold:true}]}),/reconstruct/);
assert.throws(()=>textPrimitive({id:'bad',frame,text:'Hello',runs:[{text:'Hello',bold:true,color:'red'}]}),/only bold/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_native_and_html_runs_preserve_single_textbox_lines(self):
        result = run_node("""
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {compileDeck,component,textPrimitive,linePrimitive,token} from './skills/professional-slides/runtime/core.mjs';
import {measureTextRuns} from './skills/professional-slides/runtime/text-layout.mjs';
import {renderSlideHtml} from './skills/professional-slides/runtime/adapters/html.mjs';
import {writePptx} from './skills/professional-slides/runtime/adapters/pptxgenjs.mjs';
const layout=measureTextRuns([{text:'Review evidence',bold:true},{text:' & preserve every supplied condition with the team.',bold:false}],200,{fontSize:12,wrapWidthRatio:1});
const frame={x:60,y:100,width:200,height:layout.height+24};
const registry=new Map([['sample',{id:'sample',version:'1',role:'text',category:'shared',tokens:['font.body','type.compact','color.ink','line.standard'],render:({id,frame})=>({nodes:[textPrimitive({id,frame:{...frame,height:layout.height},text:layout.text,runs:layout.runs,style:{fontFamily:token('font.body'),fontSize:token('type.compact'),color:token('color.ink'),bold:true,lineHeight:layout.lineHeight,wrap:false,valign:'top'}}),linePrimitive({id:`${id}-bidirectional`,x1:frame.x,y1:frame.y+layout.height+12,x2:frame.x+frame.width,y2:frame.y+layout.height+12,style:{stroke:token('color.ink'),lineWidth:token('line.standard')},data:{startArrow:true,endArrow:true,startArrowType:'triangle',endArrowType:'triangle',dependencies:[id]}})]})}]]);
const deck=compileDeck({slides:[{id:'sample',frame,composition:component({id:'mixed',component:'sample',frame})}]},registry);
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ps-emphasis-'));
try {
const file=path.join(directory,'runs.pptx');await writePptx(deck,file);
const require=createRequire(import.meta.url);let resolved;try{resolved=require.resolve('jszip',{paths:[process.env.RUNTIME_NODE_MODULES]});}catch{resolved=path.join(process.env.RUNTIME_NODE_MODULES,'pptxgenjs/node_modules/jszip/lib/index.js');}
const zip=await require(resolved).loadAsync(await fs.readFile(file));const xml=await zip.file('ppt/slides/slide1.xml').async('string');
const unescape=s=>s.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'");
const textboxes=[...xml.matchAll(/<p:sp>.*?<p:txBody>(.*?)<\\/p:txBody>.*?<\\/p:sp>/gs)];
assert.equal(textboxes.length,1);
const lines=[...textboxes[0][1].matchAll(/<a:p>(.*?)<\\/a:p>/gs)].map(m=>[...m[1].matchAll(/<a:t>(.*?)<\\/a:t>/gs)].map(t=>unescape(t[1])).join(''));
assert.deepEqual(lines,layout.lines);
// OOXML omits b for normal runs. Resolve any paragraph default first and
// compare every non-whitespace character's effective emphasis. The textbox
// deliberately requests bold by default, so false runs must override it.
const boldValue=(attributes,fallback=false)=>{const value=attributes?.match(/(?:^|\\s)b="([^"]+)"/)?.[1];return value===undefined?fallback:value==='1'||value==='true';};
const actualStyles=[...textboxes[0][1].matchAll(/<a:p>(.*?)<\\/a:p>/gs)].flatMap(p=>{
 const inherited=boldValue(p[1].match(/<a:defRPr([^>]*)>/)?.[1]);
 return [...p[1].matchAll(/<a:r>(.*?)<\\/a:r>/gs)].flatMap(r=>{
  const bold=boldValue(r[1].match(/<a:rPr([^>]*)>/)?.[1],inherited);
  return [...unescape([...r[1].matchAll(/<a:t>(.*?)<\\/a:t>/gs)].map(t=>t[1]).join(''))].filter(char=>char.trim()).map(char=>({char,bold}));
 });
});
const expectedStyles=layout.runs.flatMap(r=>[...r.text].filter(char=>char.trim()).map(char=>({char,bold:r.bold})));
assert.deepEqual(actualStyles,expectedStyles);
assert.ok(actualStyles.some(r=>r.bold)&&actualStyles.some(r=>!r.bold));
assert.match(xml,/<a:headEnd[^>]*type="triangle"/);assert.match(xml,/<a:tailEnd[^>]*type="triangle"/);
const html=renderSlideHtml(deck.slides[0]);const body=html.match(/<div class="text-node"[^>]*><span>(.*?)<\\/span><\\/div>/s)[1];
assert.equal(unescape(body.replace(/<[^>]+>/g,'')),layout.text);
assert.ok(html.includes('marker-start="url(#arrowhead-start)"'));assert.ok(html.includes('marker-end="url(#arrowhead)"'));
assert.equal(deck.slides[0].nodes.filter(n=>n.type==='text').length,1);
assert.equal(deck.slides[0].nodes.length,2);
} finally {await fs.rm(directory,{recursive:true,force:true});}
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
