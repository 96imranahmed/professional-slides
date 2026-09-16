"""Furniture from the 2020–25 firm decks (output/slideworks-library): toned side
panels, photo strips, period bands and event flags, highlighted rows and
line-budget pagination, unit charts, stat-row tones, the takeaways page and
the column agenda."""
import unittest
from node_probe import run_node


class SlideworksPassTests(unittest.TestCase):
    def test_side_panel_tones_and_photo_strips(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const find=(items,pred)=>{for(const it of items||[]){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const chart={type:'chart.bar',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]};
// A dark side panel is a section with the dark treatment and an inverse list.
const dark=composeSlide({title:'T',exhibit:chart,pointsTone:'dark',pointsHeading:'Key insights',points:['p','q']},0);
const side=find(dark.items,i=>i.id==='s01-side');
assert.equal(side.treatment,'dark');assert.equal(side.heading,'Key insights');
assert.equal(find(side.items,i=>i.component==='bullet-list').props.tone,'inverse');
// Muted and tint panels keep ink text; pointsHeading:false drops the heading; middle centres.
const muted=composeSlide({title:'T',exhibit:chart,pointsTone:'muted',pointsHeading:false,pointsAlign:'middle',points:['p']},0);
const ms=find(muted.items,i=>i.id==='s01-side');
assert.equal(ms.treatment,'muted');assert.equal(ms.heading,undefined);assert.equal(ms.leftover,'center');
assert.equal(find(ms.items,i=>i.component==='bullet-list').props.tone,undefined);
assert.throws(()=>composeSlide({title:'T',exhibit:chart,pointsTone:'neon',points:['p']},0),/pointsTone/);
// An open column with an unheaded exhibit still centres as before.
const open=composeSlide({title:'T',exhibit:chart,points:['p']},0);
assert.equal(find(open.items,i=>i.id==='s01-side').treatment,'open');
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_periods_events_and_change_rules(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {normalizePeriods,normalizeEvents,periodBandHeight} from './skills/professional-slides/runtime/charts.mjs';
import {changeFromContent} from './skills/professional-slides/runtime/compose.mjs';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
const cats=['2019','2020','2021','2022'];
assert.deepEqual(normalizePeriods({periods:[{from:'2019',to:'2020',label:'Boom'},{from:'2021',to:'2022',label:'Bust'}]},cats).map(p=>[p.from,p.to]),[[0,1],[2,3]]);
assert.throws(()=>normalizePeriods({periods:[{from:'2021',to:'2019',label:'x'}]},cats),/in order/);
assert.throws(()=>normalizeEvents({events:[{at:'2030',label:'x'}]},cats),/chart category/);
assert.equal(periodBandHeight({},cats),0);
assert.ok(periodBandHeight({periods:[{from:'2019',to:'2020',label:'Boom'}]},cats)>0);
assert.ok(periodBandHeight({events:[{at:'2020',label:'Lockdown'}]},cats)>0);
// Charts with periods or events are drawn, never native.
assert.equal(nativeChartSpec('chart.column',{categories:cats,series:[{name:'s',values:[1,2,3,4]}],periods:[{from:'2019',to:'2020',label:'Boom'}]},{x:0,y:0,width:600,height:400}),null);
// Implied growth: a trending series takes its arrow; a peaked series does not; adjacent columns take a bracket.
const trend=changeFromContent({type:'chart.column',categories:cats,series:[{name:'s',values:[10,12,15,18]}]},'T');
assert.equal(trend.changeAnnotations[0].style,'arrow');
const peaked=changeFromContent({type:'chart.line',categories:['Feb 1','Feb 8','Feb 15','Feb 22'],series:[{name:'s',values:[1,900,300,60]}]},'T');
assert.equal(peaked.changeAnnotations,undefined);
const adjacent=changeFromContent({type:'chart.column',categories:cats,series:[{name:'s',values:[10,12,15,9]}],change:{from:'2021',to:'2022'}},'T');
assert.equal(adjacent.changeAnnotations[0].style,'bracket');
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_highlight_row_and_line_budget_pagination(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {styleTable,paginateTable} from './skills/professional-slides/runtime/compose.mjs';
const rows=Array.from({length:12},(_,i)=>[`City ${i+1}`,String(100-i),String(i+1)]);
const styled=styleTable({type:'table',columns:['City','Delay','Rank'],rows,highlightRow:'City 3'});
assert.equal(styled.rows[2].style,'accented');
assert.throws(()=>styleTable({type:'table',columns:['City','Delay'],rows,highlightRow:'Nowhere'}),/highlightRow/);
// Twelve one-line rows stay on one page; the highlighted row travels with its page when a table does split.
assert.equal(paginateTable({title:'T',exhibit:{type:'table',columns:['City','Delay','Rank'],rows,highlightRow:'City 3'}}).length,1);
const long=Array.from({length:24},(_,i)=>[`City ${i+1}`,'x'.repeat(90),String(i+1)]);
const pages=paginateTable({title:'T',exhibit:{type:'table',columns:['City','Text','Rank'],rows:long,highlightRow:'City 20'}});
assert.ok(pages.length>1);
const holder=pages.filter(p=>p.exhibit.highlightRow!==undefined);
assert.equal(holder.length,1);
assert.ok(holder[0].exhibit.rows.some(r=>r[0]==='City 20'));
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_unit_chart_metric_tones_takeaways_and_column_agenda(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
import {composeSlide,agendaPages} from './skills/professional-slides/runtime/compose.mjs';
const registry=createRegistry();
const frame={x:0,y:0,width:600,height:360};
// Unit chart: one dot per count, a grey remainder for percent blocks.
const waffle=registry.get('chart.waffle');
const counts=waffle.render({id:'w',frame,props:{categories:['A','B'],series:[{name:'n',values:[16,5]}]}}).nodes;
assert.equal(counts.filter(n=>n.role==='chart-mark').length,21);
const percent=waffle.render({id:'w',frame,props:{categories:['A'],series:[{name:'n',values:[38]}],percent:true}}).nodes;
assert.equal(percent.filter(n=>n.role==='chart-mark').length,38);assert.equal(percent.filter(n=>n.role==='chart-unit-empty').length,62);
assert.throws(()=>waffle.render({id:'w',frame,props:{categories:['A'],series:[{name:'n',values:[2.5]}]}}),/integers/);
assert.ok(waffle.measureContent({frame,props:{categories:['A','B'],series:[{name:'n',values:[16,5]}]}}).height>0);
// Metric tones: ink tiles and ruled stats; metricsTone flows to every tile.
const metric=registry.get('metric');
const ink=metric.render({id:'m',frame:{x:0,y:0,width:240,height:120},props:{value:'1.6x',label:'Volatility',tone:'ink'}}).nodes;
assert.ok(ink.some(n=>n.role==='metric-surface'));
const rule=metric.render({id:'m',frame:{x:0,y:0,width:240,height:120},props:{value:'443',label:'Consultants',tone:'rule'}}).nodes;
assert.ok(rule.some(n=>n.role==='metric-rule'));assert.equal(rule.find(n=>n.role==='metric-value').style.align,'left');
assert.throws(()=>metric.render({id:'m',frame:{x:0,y:0,width:240,height:120},props:{value:'1',tone:'neon'}}),/metric tone/);
const strip=composeSlide({title:'T',metrics:[{value:'51',label:'Partners'},{value:'443',label:'Consultants'}],metricsTone:'rule',points:['p','q','r']},0);
assert.deepEqual(strip.items[0].items.map(i=>i.props.tone),['rule','rule']);
// Takeaways: a structural closing page, two to five messages.
const takeaways=registry.get('takeaways');
const page={x:0,y:0,width:1280,height:720};
const nodes=takeaways.render({id:'k',frame:page,props:{items:['One','Two','Three']}}).nodes;
assert.equal(nodes.filter(n=>n.role==='takeaways-numeral').length,3);
assert.throws(()=>takeaways.render({id:'k',frame:page,props:{items:['One']}}),/two to five/);
const closing=composeSlide({kind:'takeaways',points:['a','b']},0);
assert.equal(closing.kind,'takeaways');assert.deepEqual(closing.items,['a','b']);
// Column agenda: numerals on one line, the active section in the accent.
const agenda=registry.get('agenda');
const cols=agenda.render({id:'a',frame:{x:0,y:0,width:1160,height:420},props:{variant:'columns',items:[{label:'One'},{label:'Two',detail:'d'},{label:'Three'}],active:1}}).nodes;
const numerals=cols.filter(n=>n.role==='agenda-number');
assert.deepEqual(numerals.map(n=>n.text),['01','02','03']);
assert.equal(new Set(numerals.map(n=>n.frame.y)).size,1);
const pages=agendaPages([{kind:'section',title:'A'},{title:'x'},{kind:'section',title:'B'}],'once','columns');
assert.equal(pages[0].style,'columns');
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_paired_bars_bubble_grid_and_segment_growth(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
import {composeSlide,changeFromContent} from './skills/professional-slides/runtime/compose.mjs';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
const registry=createRegistry();
// Paired bars: one panel per series, the later panels without category labels, drawn not native.
const paired=composeSlide({title:'T',exhibit:{type:'chart.bar',paired:true,categories:['a','b','c'],series:[{name:'Share of commuters',values:[1,2,3]},{name:'Share of residents',values:[4,5,6]}]},points:['p']},0);
const panels=paired.items.find(i=>i.id==='s01-row').items;
assert.equal(panels.length,2);
assert.equal(panels[0].props.heading,'Share of commuters');assert.equal(panels[0].props.categoryLabels,undefined);
assert.equal(panels[1].props.categoryLabels,false);assert.equal(panels[1].props.native,false);
assert.ok(panels[0].size.width.fr>panels[1].size.width.fr,'the labelled panel takes the label column');
assert.throws(()=>composeSlide({title:'T',exhibit:{type:'chart.bar',paired:true,categories:['a'],series:[{name:'s',values:[1]}]}},0),/two or three/);
const bar=registry.get('chart.bar');
const nodes=bar.render({id:'b',frame:{x:0,y:0,width:500,height:300},props:{categories:['a','b'],series:[{name:'s',values:[1,2]}],categoryLabels:false,dataLabels:true}}).nodes;
assert.equal(nodes.filter(n=>n.role==='category-label').length,0);
assert.equal(nativeChartSpec('chart.bar',{categories:['a'],series:[{name:'s',values:[1]}],categoryLabels:false},{x:0,y:0,width:600,height:400}),null);
// Bubble grid: one bubble per nonzero cell, values printed, shape validated.
const grid=registry.get('chart.bubble-grid');
const g=grid.render({id:'g',frame:{x:0,y:0,width:700,height:400},props:{rows:['R1','R2'],columns:['C1','C2','C3'],values:[[30,9,0],[15,12,6]]}}).nodes;
assert.equal(g.filter(n=>n.role==='chart-mark').length,5);
assert.equal(g.filter(n=>n.role==='data-label').length,6);
assert.throws(()=>grid.render({id:'g',frame:{x:0,y:0,width:700,height:400},props:{rows:['R1'],columns:['C1','C2'],values:[[1]]}}),/shape/);
// Segment growth: a CAGR per segment beside the last stack; no implied arrow beside it.
const stack=registry.get('chart.stacked-column');
const sg=stack.render({id:'s',frame:{x:0,y:0,width:700,height:400},props:{categories:['2021','2022','2023'],series:[{name:'A',values:[42,37,30]},{name:'B',values:[9,9,3]}],segmentGrowth:{from:'2021',to:'2023'},dataLabels:true}}).nodes;
const growth=sg.filter(n=>n.data?.growth);
assert.equal(growth.length,2);assert.equal(growth[0].text,'−15%');
assert.ok(sg.some(n=>n.data?.growthHeading&&n.text==='CAGR 2021–23'));
assert.throws(()=>stack.render({id:'s',frame:{x:0,y:0,width:700,height:400},props:{categories:['2021','2022'],series:[{name:'A',values:[1,2]}],segmentGrowth:{from:'2022',to:'2021'}}}),/in order/);
const noArrow=changeFromContent({type:'chart.stacked-column',categories:['2021','2022','2023'],series:[{name:'A',values:[42,37,30]}],segmentGrowth:{from:'2021',to:'2023'}},'T');
assert.equal(noArrow.changeAnnotations,undefined);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
