"""The wider chart catalogue (runtime/charts-extra.mjs): every chart renders its
sample, answers a width-driven measurement, validates its data shape, and is
drawn rather than native."""
import unittest
from node_probe import run_node


class ChartCatalogueTests(unittest.TestCase):
    def test_every_extra_chart_renders_measures_and_validates(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
import {EXTRA_CHARTS} from './skills/professional-slides/runtime/charts-extra.mjs';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
const registry=createRegistry();
const frame={x:0,y:0,width:760,height:420};
const counts={};
for(const chart of EXTRA_CHARTS){
  const def=registry.get(chart.id);
  assert.ok(def,chart.id);
  const nodes=def.render({id:'c',frame,props:def.sample}).nodes;
  assert.ok(nodes.length>4,chart.id);
  assert.ok(nodes.every(n=>n.frame.x>=frame.x-1&&n.frame.x+n.frame.width<=frame.x+frame.width+1),`${chart.id} stays inside its frame`);
  const narrow=def.measureContent({frame:{x:0,y:0,width:400},props:def.sample}).height, wide=def.measureContent({frame:{x:0,y:0,width:1100},props:def.sample}).height;
  assert.ok(wide>narrow,`${chart.id} measures from its width`);
  assert.equal(nativeChartSpec(chart.id,def.sample,frame),null,`${chart.id} is drawn`);
  counts[chart.id]=nodes.filter(n=>n.role==='chart-mark').length;
}
assert.equal(counts['chart.lollipop'],6);assert.equal(counts['chart.dumbbell'],10);assert.equal(counts['chart.treemap'],6);assert.equal(counts['chart.boxplot'],4);
// Data-shape guards.
const r=(id,props)=>registry.get(id).render({id:'c',frame,props}).nodes;
assert.throws(()=>r('chart.slope',{categories:['a'],series:[{name:'s',values:[1]}]}),/two to four/);
assert.throws(()=>r('chart.dumbbell',{categories:['a'],series:[{name:'s',values:[1]}]}),/2 series/);
assert.throws(()=>r('chart.bullet',{categories:['a'],series:[{name:'s',values:[1]}],targets:[]}),/target/);
assert.throws(()=>r('chart.treemap',{items:[{label:'a',value:1}]}),/two to twenty/);
assert.throws(()=>r('chart.radar',{categories:['a','b'],series:[{name:'s',values:[1,2]}]}),/three to eight/);
assert.throws(()=>r('chart.boxplot',{categories:['a'],boxes:[{min:5,q1:1,median:2,q3:3,max:4}]}),/ordered/);
assert.throws(()=>r('chart.stacked-area',{categories:['a','b'],series:[{name:'s',values:[1,-2]},{name:'t',values:[1,2]}]}),/non-negative/);
assert.throws(()=>r('chart.sparklines',{items:[{label:'a',values:[1]}]}),/two to twelve/);
// Slope end labels separate when series finish close together.
const slope=r('chart.slope',{categories:['2019','2024'],series:[{name:'A',values:[10,20]},{name:'B',values:[12,20.2]}]});
const ends=slope.filter(n=>n.id.includes('end-label')).map(n=>n.frame.y).sort((a,b)=>a-b);
assert.ok(ends[1]-ends[0]>=20);
// Bullet marks met targets in the primary and misses in ink.
const bullet=r('chart.bullet',{categories:['a','b'],series:[{name:'s',values:[9,4]}],targets:[8,8]});
assert.deepEqual(bullet.filter(n=>n.role==='chart-mark').map(n=>n.data.met),[true,false]);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])


class NegativeBarTests(unittest.TestCase):
    """A bar chart with a negative value is drawn, not emitted natively.

    PowerPoint hangs a horizontal bar chart's category axis off the zero line.
    All-positive bars put zero at the left, where the runtime reserved the label
    gutter, and the two agree by accident. Add one negative value and zero moves
    right: PowerPoint prints "Payments" on top of the Payments bar while the
    gutter the runtime measured sits empty. The gallery page that cut cycle
    times rendered exactly that - five of six category labels invisible - and
    nothing failed, because the scene was right and only the native chart was
    wrong.
    """

    def test_a_negative_value_takes_a_horizontal_bar_chart_off_the_native_path(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
const frame={x:0,y:0,width:760,height:420};
const cats=['Payments','Identity','Ledger'];
const of=(id,values)=>nativeChartSpec(id,{categories:cats,series:[{name:'Change',values}]},frame);
// All positive: the axis sits where the gutter is, and native is fine.
assert.ok(of('chart.bar',[6.2,5.1,0.4]),'an all-positive bar chart stays native');
// One negative, and the axis moves under the labels.
assert.equal(of('chart.bar',[-6.2,-5.1,0.4]),null,'a negative bar chart is drawn');
assert.equal(of('chart.stacked-bar',[-1,2,3]),null,'a negative stacked bar is drawn');
// Native column renders can lose the negative direction as well as the sign.
assert.equal(of('chart.column',[-6.2,5.1,0.4]),null,'a negative column preserves its signed scene');
// `values` instead of `series` is the same chart written another way.
assert.equal(nativeChartSpec('chart.bar',{categories:cats,values:[-1,2,3]},frame),null);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])


class DecorationTests(unittest.TestCase):
    """Nothing an author asks a chart to mark is dropped unseen.

    A callout on a stacked area, a marimekko or a slope chart passed every
    check and drew nothing: the shared decorations (charts.mjs withDecorations)
    were wired into some charts and not others, and a chart that ignored a prop
    rendered exactly as if it had not been written. Every chart now declares the
    marks it draws (CHART_DECORATIONS); this walks the registry and asks each
    chart for each mark. An authored mark must change the render or be refused -
    a render identical to the plain chart is the silent drop.
    """

    def test_every_chart_draws_or_refuses_every_authored_mark(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
import {CHART_IDS, CHART_DECORATIONS} from './skills/professional-slides/runtime/charts.mjs';
const registry=createRegistry();
const MARKS=Object.keys(CHART_DECORATIONS);
// Candidate marks built from a chart's own sample, naming its own members:
// a category or point or tile, a series, a value inside the data's range.
function candidates(sample){
  const members=[...(sample.categories||[]),...(sample.points||[]).map(p=>p.name),...(sample.labels||[]),...(sample.items||[]).map(i=>i.label),...(sample.rows||[])].map(String);
  const series=(sample.series||[]).map(s=>s.name);
  const values=[...(sample.series||[]).flatMap(s=>s.values),...(sample.values||[]).flat(),...(sample.low||[]),...(sample.high||[])].filter(Number.isFinite);
  const mid=values.length?Math.round((Math.min(...values)+Math.max(...values))/2):1;
  const first=members[0], last=members.at(-1), second=members[1]??first;
  const names=[second,...series];
  return {
    annotations:[[{category:last,text:'A note on this mark'}],...series.map(s=>[{category:last,series:s,text:'A note on this mark'}])],
    referenceLines:[[{value:mid,label:'Target'}]],
    highlights:names.map(n=>[{category:n}]),
    focus:names.map(n=>[n]),
    focusSeries:(series.length?series:[second]).filter(s=>s!==undefined),
    changeAnnotations:[[{start:first,end:last,style:'arrow',text:'+10%'}]],
    annotationRail:[[{category:first,text:'+4'}]],
    periods:[[{from:first,to:second,label:'Phase one'}]],
    events:[[{at:second,label:'Launch'}]],
    pointHighlights:[[{category:first}]],
  };
}
const MARK_KEYS=['annotations','highlights','referenceLines','focusSeries','focus','changeAnnotations','pointHighlights','periods','events','annotationRail'];
const report=[];
for(const id of CHART_IDS){
  const def=registry.get(id);
  assert.ok(def.decorations,`${id} declares the marks it draws`);
  const {draws,refuses}=def.decorations;
  assert.ok([...draws,...refuses].every(k=>MARKS.includes(k)),`${id} declares known marks`);
  const frame={x:0,y:0,...def.preferredSize};
  const base={...def.sample};for(const k of MARK_KEYS)delete base[k];
  const plain=JSON.stringify(def.render({id:'c',frame,props:base}).nodes);
  const tries=candidates(def.sample);
  for(const key of MARKS){
    let drawn=0;
    for(const value of tries[key]){
      let nodes=null;
      try{nodes=JSON.stringify(def.render({id:'c',frame,props:{...base,[key]:value}}).nodes);}catch(error){continue;}
      assert.notEqual(nodes,plain,`${id}: ${key} ${JSON.stringify(value)} was accepted and drew nothing`);
      drawn+=1;
    }
    // A mark a chart draws can still be refused for what it names (a single
    // series has no subject series); one it does not draw is always refused.
    if(!draws.includes(key))assert.equal(drawn,0,`${id} draws ${key} without declaring it`);
    report.push(`${id}:${key}:${drawn?'drawn':'refused'}`);
  }
}
// The three charts that dropped callouts now draw them, as boxes on the plot.
for(const id of ['chart.slope','chart.stacked-area','chart.marimekko']){
  const def=registry.get(id),frame={x:0,y:0,...def.preferredSize};
  const series=def.sample.series.at(-1).name,category=def.sample.categories.at(-1);
  const nodes=def.render({id:'c',frame,props:{...def.sample,annotations:[{category,series,text:'A note on this mark'}]}}).nodes;
  assert.ok(nodes.some(n=>n.role==='annotation-text'&&n.text.includes('A note')),`${id} draws its callout`);
}
const slope=registry.get('chart.slope');
assert.ok(slope.render({id:'c',frame:{x:0,y:0,width:760,height:420},props:{...slope.sample,referenceLines:[{value:25,label:'Average'}]}}).nodes.some(n=>n.role==='chart-reference-line'),'a slope draws its reference line');
// A mark a chart does not draw is refused naming the charts that do.
assert.throws(()=>registry.get('chart.pie').render({id:'c',frame:{x:0,y:0,width:760,height:420},props:{...registry.get('chart.pie').sample,annotations:[{category:'Direct',text:'Most of it'}]}}),
  /a pie chart does not draw callouts .`annotations`..*dropped unseen.*column/);
assert.throws(()=>registry.get('chart.stacked-area').render({id:'c',frame:{x:0,y:0,width:760,height:420},props:{...registry.get('chart.stacked-area').sample,referenceLines:[{value:3000,label:'Plan'}]}}),/hide a reference line/);
console.log(JSON.stringify({ok:true,report}));
''')
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
