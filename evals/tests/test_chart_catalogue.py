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


if __name__ == "__main__":
    unittest.main()
