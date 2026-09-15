"""Exercise synthesis relationships through existing planner and HTML primitives."""
import unittest
from test_source_structure import run_node


PRELUDE = r'''
import assert from 'node:assert/strict';
import {planDeck, planSlide} from './skills/professional-slides/runtime/planner.mjs';
import {token} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {renderSlideHtml} from './skills/professional-slides/runtime/adapters/html.mjs';
const hug={width:'fill',height:'hug'};
const text=(id,value,size=hug)=>({id,job:'Preserve the authored claim or qualification',component:'paragraph',props:{text:value},size});
const group=(id,items,layout='flow.column',size=hug)=>({id,job:'Keep dependent evidence together',layout,gap:'space.2',padding:0,size,items});
const page=(id,items,layout='flow.column')=>({id,title:'The evidence supports a qualified choice',density:'pre-read',layout,...(layout==='auto'?{}:{gap:'space.4'}),copyBudget:{maxWordsPerSlide:300,rationale:'Develop the complete relationship at the family density'},items});
function compile(slides){
 const input={id:'synthesis-probes',pageTemplate:{rules:'none',branding:'none',contentSpacing:'compact'},slides};
 const before=JSON.stringify(input),out=planDeck(input);
 assert.equal(JSON.stringify(input),before,'Planning must not mutate authored evidence');
 for(const slide of out.deck.slides){
  const html=renderSlideHtml(slide),ids=new Set();
  for(const node of slide.nodes){
   assert.ok(!ids.has(node.id),'Semantic node IDs remain unique');ids.add(node.id);
   assert.ok(html.includes(`data-node-id="${node.id}"`),'HTML preserves each semantic node');
   assert.ok(Object.values(node.frame).every(Number.isFinite),'Geometry must be finite');
  }
  for(const instance of slide.componentInstances.filter(i=>i.component!=='slide-chrome')){
   const f=instance.frame,b=slide.contentFrame;
   assert.ok(f.x>=b.x-.01 && f.y>=b.y-.01 && f.x+f.width<=b.x+b.width+.01 && f.y+f.height<=b.y+b.height+.01,`Content fits: ${instance.id}`);
  }
  assert.ok(!slide.componentInstances.some(i=>i.component==='insight-box'),'No close is synthesized when none was authored');
 }
 return out;
}
const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();
const node=(s,value)=>{const n=s.nodes.find(n=>normalize(n.text)===normalize(value));assert.ok(n,`Exact text retained: ${value}`);return n;};
const instance=(s,id)=>{const c=s.componentInstances.find(c=>c.id===id || c.id.endsWith(':'+id));assert.ok(c,`Component retained: ${id}`);return c;};
'''


class SynthesisCompositionTests(unittest.TestCase):
    def test_label_body_rows_keep_shared_tracks_and_content_driven_heights(self):
        result = run_node(PRELUDE + r'''
const short='Demand recovered.';
const long='Supply remains constrained while qualified providers complete service testing. The proposed capacity is conditional on those tests and must not be presented as available capacity.';
const row=(id,label,body)=>group(id,[text(id+'-label',label,{width:200,height:'hug'}),text(id+'-body',body)],'flow.row');
const s=compile([page('rows',[row('demand','Demand',short),row('supply','Supply',long)])]).deck.slides[0];
const a=node(s,short),b=node(s,long),la=node(s,'Demand'),lb=node(s,'Supply');
assert.equal(a.frame.x,b.frame.x);assert.equal(la.frame.x,lb.frame.x);
assert.ok(a.frame.x>=la.frame.x+la.frame.width);
assert.ok(b.frame.y>=a.frame.y+a.frame.height);
assert.ok(b.frame.height>a.frame.height,'Longer evidence gets measured height without shrinking');
assert.equal(a.style.fontSize.value,b.style.fontSize.value);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result['ok'])

    def test_parallel_domains_and_ordered_sequence_keep_distinct_layout_decisions(self):
        result = run_node(PRELUDE + r'''
const peers=['Demand','Supply','Funding','Delivery'].map((v,i)=>text('peer-'+i,v));
const sequential=peers.map((v,i)=>({...v,id:'stage-'+i,relationship:'sequence'}));
assert.equal(planSlide(page('peers',peers,'auto')).decision.layout,'grid');
assert.equal(planSlide(page('sequence',sequential,'auto')).decision.layout,'flow.row');
const out=compile([page('peers',peers,'auto'),page('sequence',sequential,'auto')]);
const p=out.deck.slides[0],s=out.deck.slides[1];
assert.ok(node(p,'Funding').frame.y>node(p,'Demand').frame.y,'Peer grid retains two rows');
const ordered=['Demand','Supply','Funding','Delivery'].map(v=>node(s,v));
assert.ok(ordered.every(n=>n.frame.y===ordered[0].frame.y));
assert.ok(ordered.every((n,i)=>!i||n.frame.x>ordered[i-1].frame.x));
assert.ok(!s.nodes.some(n=>n.role.includes('arrow')),'Reading order must not invent causality');
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result['ok'])

    def test_nested_claims_preserve_proof_and_unapproved_options(self):
        result = run_node(PRELUDE + r'''
const claim='Capacity could improve without reducing service quality.';
const proof='The pilot reduced repeat handling in two teams.';
const condition='Subject to validation across the remaining teams.';
const alternatives=['Retain local scheduling.','Test shared scheduling.'];
const branch=group('branch',[text('claim',claim),group('support',[text('proof',proof),text('condition',condition),{id:'options',job:'Compare unapproved alternatives',component:'bullet-list',size:hug,props:{variant:'body',items:alternatives}}])]);
branch.items[1].padding={left:token('space.3')};
const out=compile([page('nested',[branch])]),s=out.deck.slides[0];
for(const value of [claim,proof,condition,...alternatives])node(s,value);
assert.ok(node(s,proof).frame.y>node(s,claim).frame.y);
assert.ok(node(s,proof).frame.x>node(s,claim).frame.x,'Supporting evidence is visibly subordinate');
assert.ok(node(s,condition).frame.y>node(s,proof).frame.y);
assert.equal(planSlide(page('nested',[branch])).spec.composition.children[0].composition.children[1].id,'support');
assert.equal(s.componentInstances.filter(i=>i.component==='bullet-list').length,1,'Options stay one measured list');
assert.ok(!s.nodes.some(n=>/approved|authorized/i.test(n.text||'')),'Exploration does not become authorization');
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result['ok'])

    def test_exhibit_led_continuation_uses_matrix_then_chart_without_added_prose(self):
        result = run_node(PRELUDE + r'''
const matrix={id:'matrix',job:'Synthesize qualitative readiness by dimension',component:'table',props:{variant:'open',columns:[{key:'dimension',label:'Dimension',type:'category'},{key:'assessment',label:'Readiness',type:'text'},{key:'basis',label:'Basis',type:'text'}],rows:[['Supply','Pilot only','Two providers tested'],['Demand','Established','Recurring requests observed'],['Policy','Unresolved','Approval conditions remain open']]}};
const chart={id:'impact',job:'Compare reported impact without deriving a verdict',component:'chart.column',props:{heading:'Reported service volume',unit:'Cases',categories:['Earlier','Current'],series:[{name:'Cases',values:[12,18]}]}};
const out=compile([page('summary-readiness',[matrix]),page('summary-impact',[chart])]);
assert.deepEqual(out.deck.slides.map(s=>s.id),['summary-readiness','summary-impact']);
const [a,b]=out.deck.slides;
assert.equal(a.componentInstances.filter(i=>i.component==='table').length,1);
assert.equal(b.componentInstances.filter(i=>i.component==='chart.column').length,1);
assert.ok(!a.componentInstances.some(i=>['paragraph','bullet-list'].includes(i.component)));
assert.ok(!b.componentInstances.some(i=>['paragraph','bullet-list'].includes(i.component)));
for(const value of ['Pilot only','Two providers tested','Approval conditions remain open'])node(a,value);
assert.equal(node(a,'The evidence supports a qualified choice').style.fontSize.value,node(b,'The evidence supports a qualified choice').style.fontSize.value);
assert.ok(!a.nodes.some(n=>n.role==='chart-bar'),'Qualitative states must not acquire numeric marks');
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result['ok'])


if __name__ == '__main__':
    unittest.main()
