import unittest

from node_probe import run_node


class ReviewRegressionTests(unittest.TestCase):
    def test_callout_directions_collision_and_bar_endpoints(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {renderEvidenceAnnotations} from './skills/professional-slides/runtime/chart-annotations.mjs';
const frame={x:40,y:40,width:760,height:420}, d=REGISTRY.get('chart-callout');
for(const direction of ['left','right','up','down']) {
  const nodes=d.render({id:'c',frame,props:{text:'Evidence',direction,border:false}}).nodes;
  const l=nodes.find(n=>n.role==='annotation-leader').data;
  assert.equal(nodes.find(n=>n.role==='annotation-surface').style.stroke,'none');
  assert.ok(direction==='left'?l.x2<l.x1:direction==='right'?l.x2>l.x1:direction==='up'?l.y2<l.y1:l.y2>l.y1);
}
assert.throws(()=>d.render({id:'bad',frame,props:{text:'Evidence',direction:'diagonal'}}));
assert.throws(()=>d.render({id:'bad',frame,props:{text:'Evidence',border:'no'}}));
assert.throws(()=>renderEvidenceAnnotations({id:'cross',plot:{x:0,y:120,width:760,height:300},props:{annotations:[{category:'A',text:'Evidence'}]},pointMap:new Map([['value:A',{x:300,y:350}]]),obstacles:[{role:'chart-mark',frame:{x:280,y:160,width:40,height:100}}]}),/clearance/);
const chart=REGISTRY.get('chart.column');
const nodes=chart.render({id:'bars',frame,props:{...chart.sample,dataLabels:false,referenceLines:[],annotations:[{category:'2026',text:'Evidence'}]}}).nodes;
const mark=nodes.find(n=>n.role==='chart-mark'&&n.data.category==='2026');
const leader=nodes.find(n=>n.role==='annotation-leader').data;
assert.ok(Math.abs(leader.x2-mark.frame.x-mark.frame.width)<.001);
assert.ok(Math.abs(leader.y2-mark.frame.y)<.001);
console.log(JSON.stringify({accepted:true}));
""")

    def test_map_crops_and_invalid_fraction_rejection(self):
        run_node("""
import assert from 'node:assert/strict';
import {resolveGeography,mapNodes} from './skills/professional-slides/runtime/maps.mjs';
const fiji=resolveGeography('country:FJI');
assert.ok(fiji.bounds[2]-fiji.bounds[0]<10);
const frame={x:40,y:40,width:600,height:360};
assert.ok(mapNodes({id:'fiji',frame,props:{geography:'country:FJI',markers:[{country:'FJI',fraction:.5}]}}).some(n=>n.role==='map-marker-fill'));
for(const fraction of ['bad',NaN,Infinity,-.1,1.1,null]) assert.throws(()=>mapNodes({id:'bad',frame,props:{markers:[{x:.5,y:.5,fraction}]}}),/fraction/);
console.log(JSON.stringify({accepted:true}));
""")

    def test_typed_comparison_and_wrapping_body_sized_legends(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {renderTable,measureTable} from './skills/professional-slides/runtime/tables.mjs';
const frame={x:0,y:0,width:400,height:1600};
const nodes=REGISTRY.get('comparison-table').render({id:'c',frame,props:{columns:['Metric','Value'],rows:[{cells:['Growth',{type:'number',value:8}]}],selectedColumn:1}}).nodes;
assert.ok(nodes.some(n=>n.text==='8'));assert.ok(!nodes.some(n=>n.text==='[object Object]'));
const props={density:'body',columns:[{label:'Metric',type:'bars',scale:'s'}],rows:[[{values:[1,2,3]}]],scales:{s:{type:'bars',label:'Revenue',unit:'USD',min:0,max:4,series:['Enterprise revenue','Consumer revenue','Other revenue']}}};
const m=measureTable({frame,props});assert.ok(m.legends[0].entries.at(-1).y>0);
const result=renderTable({id:'t',frame,props});
assert.ok(result.nodes.filter(n=>n.role==='table-legend').every(n=>n.style.fontSize.tokenId==='type.body'));
console.log(JSON.stringify({accepted:true}));
""")

    def test_stepped_horizons_reject_curve_only_properties(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const d=REGISTRY.get('chart.horizons'),frame={x:60,y:150,width:1160,height:480};
for(const variant of ['stepped','stepped-minimal']) for(const [key,value] of [['start',0],['end',1],['colorIndex',2]]) {
 const props={variant,horizons:[{id:'a',label:'Core',[key]:value},{id:'b',label:'Growth'}]};
 assert.throws(()=>d.render({id:'bad',frame,props}),/only in curves/);
}
console.log(JSON.stringify({accepted:true}));
""")


class BeautificationPassTests(unittest.TestCase):
    """The pass a threshold cannot make.

    Every other check in the skill is a number. This one is a look, and it is
    the only thing that catches a deck which clears every number and still reads
    as dry - which is exactly what a generated 50-page deck did. The reviewer
    cannot be asked whether a deck "feels varied"; it has to be handed what the
    deck is made of, beside what a reference deck carries.
    """

    def test_the_packet_carries_what_the_deck_is_made_of(self):
        run_node('''
import assert from 'node:assert/strict';
import {designStatistics, CODES, reviewPrompt} from './skills/professional-slides/runtime/reviewer.mjs';
const page=(components,roles)=>({id:'s',nodes:[{role:'action-title',type:'text',text:'A finding'},
  ...roles.map(r=>({role:r,type:'rect'}))],componentInstances:components.map(c=>({component:c}))});
const scene={slides:[
  page(['table'],['table-rating-track','table-cell']),
  page(['table'],['table-cell']),
  page(['chart.column'],['chart-bracket']),
  page(['chart.bar'],['chart-mark']),
]};
const s=designStatistics(scene);
assert.equal(s.contentPages,4);
assert.equal(s.tables,2); assert.equal(s.tablesTreated,0.5);
assert.equal(s.charts,2); assert.equal(s.chartsAnnotated,0.5);
assert.equal(s.distinctExhibits,3);
assert.equal(s.exhibitVarietyPerTen,7.5);
assert.ok(s.drawingsPerPage>0,'drawn elements are counted, not just chart marks');
assert.ok(s.reference.drawingsPerPage===32,'and set beside what a published page carries');
assert.ok(s.reference.tablesTreated===0.89&&s.reference.chartsAnnotated===0.63,'measured, not guessed');
// A slide with no action title is chrome, not a page to judge.
assert.equal(designStatistics({slides:[{id:'c',nodes:[{role:'cover-title',type:'text'}],componentInstances:[]}]}).contentPages,0);

// The beautification codes exist and the prompt actually asks the questions.
for (const code of ['NO_VISUAL_ANCHOR','UNANNOTATED_PLOT','TABLE_MONOTONY','MIXED_GRAMMAR','DECORATION','NARROW_REPERTOIRE'])
  assert.ok(CODES[code],`${code} is a reviewable code`);
const prompt=reviewPrompt({statistics:s,titles:[],slides:[],codes:CODES,schema:{},montage:'m'});
assert.match(prompt,/VISUAL REVIEW/);
assert.match(prompt,/NARROW_REPERTOIRE/);
assert.ok(prompt.includes('"exhibitVarietyPerTen": 7.5'),'candidate diagnostics reach the reviewer');
assert.ok(!prompt.includes('"reference"') && !prompt.includes('7.1 to 8.3'),'historical aggregates are not presented as reference targets');
assert.match(prompt,/Inspect every original page at full size, every spread/);
assert.match(prompt,/If the user supplied reference decks/);assert.match(prompt,/never search the machine/);
assert.match(prompt,/peer status summaries/);
assert.ok(prompt.includes('references/taste-review.md'));
// Reviewer subprocesses inherit arbitrary authoring directories; guidance is package-relative.
const {mkdtempSync,existsSync,rmSync}=await import('node:fs');
const {tmpdir}=await import('node:os');
const {join,isAbsolute}=await import('node:path');
const previousCwd=process.cwd(), temporary=mkdtempSync(join(tmpdir(),'review-portable-'));
try {
  process.chdir(temporary);
  const portable=reviewPrompt({statistics:s,titles:[],slides:[],codes:CODES,schema:{},montage:'m'});
  const paths=portable.split('Read these skill files before assessing: ')[1].split('. The taste-review')[0].split(', ');
  assert.equal(paths.length,3);
  assert.ok(paths.every(p=>isAbsolute(p)&&existsSync(p)),'all actual guide files resolve from an unrelated cwd');
} finally {process.chdir(previousCwd);rmSync(temporary,{recursive:true,force:true});}
assert.match(prompt,/most deletable page/);
console.log(JSON.stringify({ok:true}));
''')
