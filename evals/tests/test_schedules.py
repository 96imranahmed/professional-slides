import unittest
from test_source_structure import run_node


class ScheduleTests(unittest.TestCase):
    def test_date_body_role_and_terminal_alignment_preserve_exact_date_point(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {datedLanes,SCHEDULE_VARIANTS} from './skills/professional-slides/runtime/schedules.mjs';
import {TOKENS,resolveDensityTokens} from './skills/professional-slides/runtime/core.mjs';
import {withDesignTokens} from './skills/professional-slides/runtime/design-context.mjs';
const props={...structuredClone(SCHEDULE_VARIANTS['dated-lanes'].props),dateTreatment:'body',spacing:'tight'};
props.events=[{id:'terminal',laneId:'reviewers',date:props.axis.domain[1],label:'Final review',duration:'30 minutes'}];
const frame={x:60,y:120,width:1160,height:570};
withDesignTokens(resolveDensityTokens(TOKENS,'live-pitch'),()=>{
const result=datedLanes({id:'schedule',frame,props}),nodes=result.nodes;
const date=nodes.find(n=>n.id==='schedule:terminal-date'),body=nodes.find(n=>n.id==='schedule:terminal-text'),marker=nodes.find(n=>n.id==='schedule:terminal');
assert.equal(date.style.fontSize.tokenId,'type.body');assert.equal(date.style.fontSize.value,16.1);
assert.equal(date.text,props.axis.domain[1]);assert.equal(date.style.align,'right');assert.equal(body.style.align,'right');
const source=datedLanes({id:'schedule',frame,props:{...props,dateTreatment:'source'}});
assert.ok(result.height>source.height);
assert.equal(source.nodes.find(n=>n.id==='schedule:terminal').frame.x,marker.frame.x);
assert.throws(()=>datedLanes({id:'bad',frame,props:{...props,dateTreatment:'tiny'}}),/unknown date treatment/);
});
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_period_precision_simultaneous_events_and_rejections(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const d=REGISTRY.get('timeline'), frame={x:60,y:120,width:1160,height:570};
const props={...structuredClone(d.variants['time-grid'].props),variant:'time-grid'};
const render=p=>d.render({id:'schedule',frame,props:p}).nodes;
const nodes=render(props), a=nodes.find(n=>n.id==='schedule:review'), b=nodes.find(n=>n.id==='schedule:spec-ready');
assert.equal(a.frame.y,b.frame.y);assert.notEqual(a.frame.x,b.frame.x);
assert.ok(a.data.dependencies.includes('schedule:w2'));
for(const mutate of [p=>p.lanes[0].events[0].periodId='missing',p=>p.lanes[0].events[0].kind='unknown',p=>p.axis.periods[1].id='w1',p=>p.bands[0].items[1].periodId='w2',p=>p.bands[0].items[0].spanPurpose='',p=>p.qualifiers=[{id:'bad',text:'x',relatedTo:['unknown']}]]) {
 const p=structuredClone(props);mutate(p);assert.throws(()=>render(p));
}
assert.throws(()=>d.render({id:'small',frame:{...frame,height:60},props}),/allocated frame/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_dates_use_elapsed_time_and_preserve_attached_details(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const d=REGISTRY.get('timeline'),frame={x:60,y:120,width:1160,height:570};
const props={...structuredClone(d.variants['dated-lanes'].props),variant:'dated-lanes'};
props.events=[{id:'a',laneId:'reviewers',date:'2026-01-01',label:'First'},{id:'b',laneId:'reviewers',date:'2026-01-11',label:'Second',duration:'30 minutes',location:'London',qualification:'Tentative'},{id:'c',laneId:'reviewers',date:'2026-01-31',label:'Third'}];
const render=p=>d.render({id:'schedule',frame,props:p}).nodes;
const nodes=render(props), x=id=>nodes.find(n=>n.id===`schedule:${id}`).frame.x;
assert.ok(Math.abs((x('c')-x('b'))/(x('b')-x('a'))-2)<.001);
const copy=nodes.find(n=>n.id==='schedule:b-text').text;
for(const word of ['Tentative','London','30 minutes']) assert.ok(copy.replaceAll('\n',' ').includes(word));
for(const mutate of [p=>p.events[0].date='2026-02-30',p=>p.events[0].date='2025-12-31',p=>p.events[0].laneId='missing',p=>p.axis.scale='ordinal',p=>p.relationships=[{from:'a',to:'missing',kind:'approval',basis:'explicit'}],p=>p.lanes[1].continuousActivity.extentQualification='']) {
 const p=structuredClone(props);mutate(p);assert.throws(()=>render(p));
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_prominent_spacing_and_axis_capacity_preserve_type_and_structure(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {timeGrid,SCHEDULE_VARIANTS} from './skills/professional-slides/runtime/schedules.mjs';
import {TOKENS,resolveDensityTokens} from './skills/professional-slides/runtime/core.mjs';
import {withDesignTokens} from './skills/professional-slides/runtime/design-context.mjs';
const frame={x:60,y:120,width:1160,height:800};
const props={...structuredClone(SCHEDULE_VARIANTS['time-grid'].props),labelTreatment:'prominent',labelWidth:150};
props.axis.label='Planning weeks and decision dates across the programme';
withDesignTokens(resolveDensityTokens(TOKENS,'executive'),()=>{
 const normal=timeGrid({id:'grid',frame,props}),tight=timeGrid({id:'grid',frame,props:{...props,spacing:'tight'}});
 assert.ok(tight.height<normal.height);
 const axis=tight.nodes.find(n=>n.id==='grid:axis'),agenda=tight.nodes.find(n=>n.id==='grid:agenda');
 assert.ok(agenda.frame.y>=axis.frame.y+axis.frame.height,'A tall axis label must reserve its full height');
 for(const n of tight.nodes.filter(n=>n.type==='text'))assert.equal(n.style.fontSize.tokenId,'type.heading');
 const span=tight.nodes.find(n=>n.id==='grid:scope');assert.equal(span.data.labelSpanPeriodCount,2);assert.equal(span.data.periodId,'w1');
 assert.ok(span.data.spanPurpose.includes('wrapping'));
 for(const mutate of [p=>p.labelTreatment='tiny',p=>p.spacing='cramped',p=>p.eventKinds[0].label='',p=>p.qualifiers=[{id:'axis',text:'Duplicate',relatedTo:[]}],p=>p.lanes[0].id='agenda-rule']) {
  const p=structuredClone(props);mutate(p);assert.throws(()=>timeGrid({id:'grid',frame,props:p}));
 }
});
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_packed_dated_labels_keep_stems_outside_all_text(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {datedLanes} from './skills/professional-slides/runtime/schedules.mjs';
import {TOKENS,resolveDensityTokens} from './skills/professional-slides/runtime/core.mjs';
import {withDesignTokens} from './skills/professional-slides/runtime/design-context.mjs';
const frame={x:60,y:120,width:1160,height:700};
const props={labelTreatment:'prominent',spacing:'tight',labelWidth:120,axis:{kind:'date',precision:'day',scale:'elapsed-days',domain:['2026-01-01','2026-03-01']},lanes:[{id:'approval',label:'Board'},{id:'review',label:'Team'}],events:[{id:'a',laneId:'approval',date:'2026-01-03',label:'Confirm strategic objectives and outcomes',labelWidth:300},{id:'b',laneId:'approval',date:'2026-01-05',label:'Approve',labelWidth:180},{id:'c',laneId:'review',date:'2026-01-01',label:'Refine strategic objectives and outcomes',labelWidth:300},{id:'d',laneId:'review',date:'2026-01-04',label:'Review',labelWidth:180}],relationships:[{from:'c',to:'a',kind:'refines',basis:'Declared dependency'},{from:'d',to:'b',kind:'refines',basis:'Declared dependency'}]};
withDesignTokens(resolveDensityTokens(TOKENS,'live-pitch'),()=>{
 const {nodes}=datedLanes({id:'dates',frame,props});
 const text=nodes.filter(n=>n.type==='text'),stems=nodes.filter(n=>n.role==='schedule-stem');
 for(const stem of stems)for(const box of text){
  const a=stem.frame,b=box.frame;
  assert.ok(a.x+a.width<=b.x||a.x>=b.x+b.width||a.y+a.height<=b.y||a.y>=b.y+b.height,'Stem must occupy a text-free corridor');
 }
 assert.equal(nodes.find(n=>n.id==='dates:a-text').style.fontSize.tokenId,'type.heading');
 assert.equal(nodes.find(n=>n.id==='dates:a-date').style.fontSize.tokenId,'type.source');
 const rail=nodes.find(n=>n.id==='dates:approval-rail').frame;
 for(const edge of nodes.filter(n=>n.role==='schedule-relationship'))assert.ok(edge.frame.y>=rail.y,'Relationships stay below approval text');
 for(const mutate of [p=>p.events[0].labelWidth=0,p=>p.events[0].duration=30,p=>p.events[1].id='a-text',p=>p.events.forEach(e=>e.labelWidth=900)]){
  const p=structuredClone(props);mutate(p);assert.throws(()=>datedLanes({id:'dates',frame,props:p}));
 }
});
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
