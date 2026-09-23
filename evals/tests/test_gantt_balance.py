"""Sparse schedules stay balanced without changing their time geometry."""
import unittest
from node_probe import run_node


class GanttBalanceTests(unittest.TestCase):
    def test_sparse_schedule_centres_with_its_optional_today_caption(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {ganttNodes} from './skills/professional-slides/runtime/gantt.mjs';
const frame={x:60,y:140,width:1100,height:500};
const base={periods:['09:00','09:30','10:00','10:30'],rows:[{label:'First',from:0,to:2,text:'One hour'},{label:'Second',from:2,to:4,text:'One hour'}]};
for (const props of [base,{...base,today:2}]) {
 const nodes=ganttNodes({id:'schedule',frame,props});
 const top=Math.min(...nodes.map(n=>n.frame.y));
 const bottom=Math.max(...nodes.map(n=>n.frame.y+n.frame.height));
 assert.ok(top>frame.y+50,'spare height is not left entirely below the schedule');
 assert.ok(Math.abs((top-frame.y)-(frame.y+frame.height-bottom))<1,'header, rows and optional caption centre as one group');
 const short=ganttNodes({id:'short',frame:{...frame,height:300},props});
 const a=nodes.filter(n=>n.role==='gantt-bar'),b=short.filter(n=>n.role==='gantt-bar');
 assert.deepEqual(a.map(n=>[n.frame.x,n.frame.width]),b.map(n=>[n.frame.x,n.frame.width]),'vertical placement cannot change dates or durations');
}
console.log('{}');
""")

    def test_parent_aligns_schedule_and_table_without_changing_time_or_width_shares(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const schedule={type:'gantt',periods:['0','1','2','3'],rows:[{label:'Prepare',from:0,to:1},{label:'Run',from:1,to:4}]};
const table={type:'table',columns:['Stage','Minutes'],rows:[['Prepare','10'],['Run','30']]};
const make=(exhibits)=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'align',slides:[{id:'s',title:'Preparation precedes the shared operating period',arrange:'row',pairedWeights:[2,1],exhibits}]})).deck.slides[0];
const aligned=make([schedule,table]);
const gantt=aligned.componentInstances.find(c=>c.component==='gantt'),lookup=aligned.componentInstances.find(c=>c.component==='table');
assert.ok(Math.abs(gantt.anchors.headerTop-lookup.anchors.headerTop)<10,'headed peers share visible top guides');
assert.ok(gantt.frame.width>lookup.frame.width*1.9,'explicit width shares survive the alignment decision');
const explicit=make([{...schedule,valign:'middle'},table]);
const old=explicit.nodes.filter(n=>n.role==='gantt-bar'),now=aligned.nodes.filter(n=>n.role==='gantt-bar');
assert.deepEqual(now.map(n=>[n.frame.x,n.frame.width]),old.map(n=>[n.frame.x,n.frame.width]),'alignment does not change time geometry');
assert.ok(explicit.componentInstances.find(c=>c.component==='gantt').occupiedFrame.y>gantt.occupiedFrame.y,'explicit independent centering remains available');
console.log('{}');
""")
