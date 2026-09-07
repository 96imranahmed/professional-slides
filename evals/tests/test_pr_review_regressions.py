import unittest
from test_source_structure import run_node


class ReviewRegressionTests(unittest.TestCase):
    def check_js(self, script):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {planDeck,validateSlidePlan} from './skills/professional-slides/runtime/planner.mjs';
import {legendNodes} from './skills/professional-slides/runtime/legends.mjs';
const frame={x:0,y:0,width:1000,height:500};
const render=(id,props,box=frame)=>REGISTRY.get(id).render({id:'review',frame:box,props}).nodes;
""" + script + "\nconsole.log(JSON.stringify({accepted:true}));")
        self.assertTrue(result['accepted'])

    def test_auto_bounds_respect_data_and_constant_series(self):
        self.check_js("""
for(const values of [[100,110],[-110,-100],[0.2,0.4],[100,100]]) {
 const nodes=render('chart.line',{categories:['A','B'],series:[{name:'Revenue',values}]});
 const ticks=nodes.filter(n=>n.role==='axis-label').map(n=>Number(n.text));
 assert.ok(Math.min(...ticks)<=Math.min(...values));
 assert.ok(Math.max(...ticks)>=Math.max(...values));
 assert.ok(Math.max(...ticks)>Math.min(...ticks));
 if(values[0]>0) assert.ok(Math.min(...ticks)>0);
 if(values[0]<0) assert.ok(Math.max(...ticks)<0);
}
const bars=render('chart.column',{categories:['A','B'],series:[{name:'Value',values:[100,110]}],showValueAxis:true});
assert.ok(bars.some(n=>n.role==='axis-label' && Number(n.text)===0));
""")

    def test_negative_waterfall_labels_follow_endpoints(self):
        self.check_js("""
const nodes=render('chart.waterfall',{categories:['Start','Drop','Total'],values:[100,-120,-20],totals:[0,2]});
for(const category of ['Drop','Total']) {
 const bar=nodes.find(n=>n.role==='chart-mark' && n.id.endsWith(category.toLowerCase()));
 const label=nodes.find(n=>n.role==='data-label' && n.id.endsWith(category.toLowerCase()));
 const tick=nodes.find(n=>n.role==='category-label' && n.text===category);
 assert.ok(label.frame.y>=bar.frame.y+bar.frame.height);
 assert.ok(label.frame.y+label.frame.height<=tick.frame.y);
}
""")

    def test_line_legend_uses_plot_colors_and_narrow_frames_reject(self):
        self.check_js("""
for(const id of ['chart.line','chart.area']) {
 const props={categories:['A','B'],series:[{name:'One',values:[100,110]},{name:'Two',values:[105,108]}],colorIndices:[3,5]};
 const nodes=render(id,props);
 assert.deepEqual(nodes.filter(n=>n.role==='legend-swatch').map(n=>n.style.fill.tokenId),['color.chartSeries4','color.chartSeries6']);
 assert.throws(()=>render(id,{...props,directLabels:'end'},{...frame,width:300}),/plot width/);
}
""")

    def test_custom_registry_and_nested_empty_items(self):
        self.check_js("""
const registry=new Map(REGISTRY);
registry.set('extension',{...REGISTRY.get('paragraph'),id:'extension'});
const slide={id:'slide',title:'Extension works',items:[{id:'group',job:'Explain',items:[{id:'evidence',job:'Support',component:'extension',props:{text:'Evidence supports action'}}]}]};
assert.ok(planDeck({id:'deck',slides:[slide]},registry).deck);
assert.throws(()=>planDeck({id:'deck',slides:[slide]}),/not registered/);
for(const items of [[],{},'bad']) {
 assert.throws(()=>validateSlidePlan({...slide,items:[{id:'group',job:'Explain',items}]}),/nested items/);
}
""")

    def test_state_legend_cues_and_invalid_states(self):
        self.check_js("""
const states=['actual','forecast','target','scenario','missing'];
const nodes=legendNodes({id:'legend',frame,props:{variant:'state',items:states.map(state=>({label:state,state,colorIndex:0}))}});
const signatures=nodes.filter(n=>n.role==='legend-swatch').map(n=>JSON.stringify([n.kind,n.geometry,n.style.fill,n.style.dash]));
assert.equal(new Set(signatures).size,5);
assert.throws(()=>legendNodes({id:'legend',frame,props:{variant:'state',items:[{label:'Typo',state:'forcast'}]}}),/State legend/);
""")

    def test_matrix_axes_and_proportional_funnel(self):
        self.check_js("""
const sample=REGISTRY.get('matrix').sample;
const nodes=render('matrix',sample);
assert.equal(nodes.filter(n=>n.role==='matrix-axis-label').length,2);
assert.throws(()=>render('matrix',{points:sample.points}),/xAxis/);
const stages=render('funnel',{stages:[{label:'Start',value:100},{label:'Half',value:50},{label:'None',value:0}]});
const marks=stages.filter(n=>n.role==='funnel-stage');
assert.equal(marks.length,2);
assert.equal(marks[1].frame.width/marks[0].frame.width,0.5);
assert.equal(stages.filter(n=>n.role==='funnel-label').length,3);
""")
