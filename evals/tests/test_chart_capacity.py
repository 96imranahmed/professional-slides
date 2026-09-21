import unittest
from node_probe import run_node


class ChartCapacityTests(unittest.TestCase):

    def test_native_line_distinguishes_endpoint_and_intermediate_values(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:120,width:1160,height:450};
for(const dataLabels of [true,false]){
 const props={categories:['0','12','24','36'],series:[{name:'Monthly support',values:[0,6,12,18]}],endLabels:true,dataLabels,valueFormat:{decimals:1}};
 const nodes=REGISTRY.get('chart.line').render({id:'line',frame,props}).nodes;
 const spec=nativeChartSpec('chart.line',props,frame,nodes);
 assert.equal(spec.pointDataLabels,dataLabels);assert.equal(spec.endLabels,true);
 assert.equal(nodes.find(n=>n.data?.labelKind==='series-end').text,'Monthly support 18.0');
}
console.log('{}');
""")

    def test_dumbbell_values_have_separate_gutters_from_category_labels(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {dumbbellLayout,dumbbellChart} from './skills/professional-slides/runtime/charts-extra.mjs';
const frame={x:60,y:120,width:1160,height:450};
for (const factor of [1,1000000]) {
 const props={categories:['$3,000 rent','$4,500 rent','$8,000 rent'],series:[{name:'Annual',values:[200.2,228.6,303.1].map(v=>v*factor)},{name:'Three years',values:[204.5,233.7,308.1].map(v=>v*factor)}],valueFormat:{decimals:1}};
 const nodes=dumbbellChart({id:'d',frame,props});const layout=dumbbellLayout(frame,props);
 for(const category of props.categories){
  const cat=nodes.find(n=>n.role==='category-label'&&n.text===category);
  const values=nodes.filter(n=>n.role==='data-label'&&n.data.category===category);
  for(const label of values){assert.ok(label.frame.x>=cat.frame.x+cat.frame.width+6);assert.ok(label.frame.x+label.frame.width<=frame.x+frame.width);}
 }
 const marks=nodes.filter(n=>n.role==='chart-mark');
 const span=Math.max(...marks.map(n=>n.frame.x))-Math.min(...marks.map(n=>n.frame.x));
 assert.ok(span/layout.plot.width>.6,'directly labelled values use the available comparison width');
 const explicit=dumbbellLayout(frame,{...props,xMin:0,xMax:400*factor});assert.equal(explicit.bounds.min,0);assert.equal(explicit.bounds.max,400*factor);
}
console.log('{}');
""")

    def test_external_stack_labels_and_leaders_remain_one_editable_render(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
const frame={x:0,y:0,width:800,height:400};
const props={categories:['London','New York'],series:[{name:'Housing',values:[2750,3462]},{name:'Transport',values:[220,123]},{name:'Other',values:[1975,1977]}],dataLabels:true};
const nodes=REGISTRY.get('chart.stacked-column').render({id:'stack',frame,props}).nodes;
const external=nodes.filter(n=>n.role==='data-label'&&n.data?.external);
assert.ok(external.length>0);
assert.equal(nodes.filter(n=>n.role==='data-label-leader').length,external.length);
assert.equal(nativeChartSpec('chart.stacked-column',props,frame,nodes),null);
const simple={categories:['A','B'],series:[{name:'First',values:[50,50]},{name:'Second',values:[50,50]}],dataLabels:true};
const plain=REGISTRY.get('chart.stacked-column').render({id:'plain',frame,props:simple}).nodes;
assert.ok(nativeChartSpec('chart.stacked-column',simple,frame,plain));
console.log('{}');
""")

    def test_outside_reference_labels_reserve_gutter_and_unsupported_charts_reject(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:120,width:600,height:400};
const props={categories:['A','B'],series:[{name:'Measure',values:[20,30]}],dataLabels:false,yMin:0,yMax:50,referenceLines:[{value:40,label:'Comparison reference',placement:'outside-end'}]};
const nodes=REGISTRY.get('chart.column').render({id:'column',frame,props}).nodes;
const line=nodes.find(n=>n.role==='chart-reference-line'),label=nodes.find(n=>n.role==='chart-reference-label');
assert.ok(label.frame.x>line.frame.x+line.frame.width);
assert.ok(label.frame.x+label.frame.width<=frame.x+frame.width);
assert.ok(Math.abs(label.frame.y+label.frame.height/2-line.frame.y)<.001);
assert.equal(label.text.replaceAll('\n',' '),'Comparison reference');
assert.equal(label.frame.height,label.data.textLayout.height);
for(const name of ['chart.line','chart.area'])assert.throws(()=>REGISTRY.get(name).render({id:'unsupported',frame,props}),/outside|Outside/);
assert.throws(()=>REGISTRY.get('chart.column').render({id:'bad',frame,props:{...props,referenceLines:[{value:40,label:'Reference',placement:'unknown'}]}}),/placement/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_wrapped_external_stack_labels_preserve_scale_height_and_uniform_widths(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {measureText} from './skills/professional-slides/runtime/text-layout.mjs';
const frame={x:60,y:120,width:1160,height:510};
const props={categories:['A','B','C','D','E'],series:[{name:'Small',values:[1,1,1,1,1]},{name:'Other',values:[19,22,30,32,35]}],yMin:0,yMax:40,dataLabels:true,secondaryLabels:[{category:'E',series:'Small',value:296000,unit:'workers',valueFormat:{compactUnit:'k',decimals:0}}]};
const nodes=REGISTRY.get('chart.stacked-column').render({id:'stack',frame,props}).nodes;
const marks=nodes.filter(n=>n.role==='chart-mark'),labels=nodes.filter(n=>n.role==='data-label');
assert.equal(new Set(marks.map(n=>n.frame.width)).size,1);
const small=marks.find(n=>n.data.category==='E'&&n.data.series==='Small'),large=marks.find(n=>n.data.category==='E'&&n.data.series==='Other');
assert.ok(Math.abs(small.frame.height/large.frame.height-1/35)<.00001);
const attached=labels.find(n=>n.data.category==='E'&&n.data.series==='Small');
assert.equal(attached.text.replaceAll('\n',' '),'1 296k workers');
assert.ok(attached.data.external);assert.ok(attached.text.split('\n').length>=2);
const measured=measureText(attached.text,attached.frame.width,{fontFamily:attached.style.fontFamily.value,fontSize:attached.style.fontSize.value,bold:true});
assert.ok(attached.frame.height>=measured.height);
const axis=nodes.find(n=>n.id==='stack:x-axis').frame,span=axis.width/5;
for(const label of labels.filter(n=>n.data.external)){
 const i=props.categories.indexOf(label.data.category);
 assert.ok(label.frame.x>=axis.x+i*span&&label.frame.x+label.frame.width<=axis.x+(i+1)*span+.001);
 assert.ok(label.frame.y+label.frame.height<=axis.y+.001);
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_live_pitch_rail_uses_measured_height_and_full_category_lane(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {TOKENS,resolveDensityTokens} from './skills/professional-slides/runtime/core.mjs';
import {withDesignTokens} from './skills/professional-slides/runtime/design-context.mjs';
import {measureText} from './skills/professional-slides/runtime/text-layout.mjs';
withDesignTokens(resolveDensityTokens(TOKENS,'live-pitch'),()=>{
 const frame={x:60,y:120,width:1160,height:510},categories=['A','B','C','D','E'];
 const props={categories,series:[{name:'Small',values:[1,1,1,1,1]},{name:'Other',values:[19,22,30,32,35]}],yMin:0,yMax:40,dataLabels:true,annotationRail:{items:categories.map(category=>({category,text:'123,456,789,000'}))}};
 const nodes=REGISTRY.get('chart.stacked-column').render({id:'rail',frame,props}).nodes;
 const badges=nodes.filter(n=>n.role==='annotation-surface');
 for(const [i,n] of badges.entries()){
  const mark=nodes.find(m=>m.role==='chart-mark'&&m.data.category===n.data.category);
  assert.ok(Math.abs(n.frame.x+n.frame.width/2-mark.frame.x-mark.frame.width/2)<.001,'Expanded pill must align with its actual mark');
  assert.ok(n.frame.x>=frame.x&&n.frame.x+n.frame.width<=frame.x+frame.width,'Expanded pills must remain within the exhibit');
  if(i)assert.ok(badges[i-1].frame.x+badges[i-1].frame.width<n.frame.x,'Adjacent expanded pills must remain separated');
 }
 for(const n of nodes.filter(n=>n.role==='annotation-text')){
  const m=measureText(n.text,n.frame.width,{fontFamily:n.style.fontFamily.value,fontSize:n.style.fontSize.value,bold:true});
  assert.ok(n.frame.height>=m.height);
  assert.ok(n.frame.y+n.frame.height<=frame.y+frame.height);
 }
});
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_compact_chrome_keeps_measured_title_and_footer_clearances(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const chrome=REGISTRY.get('slide-chrome'),frame={x:0,y:0,width:1280,height:720};
for(const title of ['A short title','The complete evidence supports a longer decision title that needs a second line to remain legible']){
 const base={title,source:'Source: measured evidence',pageNumber:1};
 const normal=chrome.render({id:'normal',frame,props:base});
 const compact=chrome.render({id:'compact',frame,props:{...base,pageTemplate:{contentSpacing:'compact'}}});
 const heading=compact.nodes.find(n=>n.role==='action-title');
 assert.ok(compact.contentFrame.y>=heading.frame.y+heading.data.textLayout.height);
 assert.equal(compact.contentFrame.y,normal.contentFrame.y);
 assert.equal(compact.contentFrame.y+compact.contentFrame.height,normal.contentFrame.y+normal.contentFrame.height);
 assert.equal(heading.style.fontSize.value,normal.nodes.find(n=>n.role==='action-title').style.fontSize.value);
}
assert.throws(()=>chrome.render({id:'bad',frame,props:{title:'Title',pageTemplate:{contentSpacing:'tiny'}}}),/contentSpacing/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_parenthetical_counts_and_measured_category_bands(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:100,width:1160,height:540};
const props={heading:'Workers moving between categories',categories:['Country A','Country B','Country C','Country D','Country E'],series:[{name:'Midpoint',values:[19,12,10,8,9]},{name:'Additional',values:[27,22,23,24,20]}],yMin:0,yMax:50,dataLabels:true,valueFormat:{suffix:'%',decimals:0},secondaryLabelStyle:'parenthetical',secondaryUnit:'workers',secondaryLabels:[{category:'Country E',series:'Midpoint',value:296000,unit:'workers',valueFormat:{compactUnit:'k',decimals:0}}]};
const d=REGISTRY.get('chart.stacked-column'),nodes=d.render({id:'counts',frame,props}).nodes;
assert.ok(nodes.some(n=>n.text==='9% (296k)'&&!n.data.external));
assert.throws(()=>d.render({id:'bad',frame,props:{...props,heading:'Transition share'}}),/shared unit/);
assert.throws(()=>d.render({id:'bad',frame,props:{...props,secondaryUnit:'people'}}),/shared unit/);
const grouped=d.render({id:'groups',frame,props:{...props,categoryGroups:[{id:'peers',label:'Comparable peers',categories:['Country A','Country B']}],annotationRail:{items:props.categories.map(category=>({category,text:'123'}))}}}).nodes;
const label=grouped.find(n=>n.role==='category-group-label'),rail=grouped.find(n=>n.role==='annotation-surface');
assert.ok(rail.frame.y>label.frame.y+label.frame.height);
assert.deepEqual(label.data.dependencies,['groups:category:country-a','groups:category:country-b']);
const externalProps={categories:['First place','Second place','Third place','Fourth place'],series:[{name:'Small',values:[2,4,6,8]},{name:'Large',values:[98,96,94,92]}],yMin:0,yMax:100,dataLabels:true,valueFormat:{suffix:'%'},categoryGroups:[{id:'first-pair',label:'First pair',categories:['First place','Second place']}],annotationRail:{items:['First place','Second place','Third place','Fourth place'].map(category=>({category,text:'123'}))}};
const external=d.render({id:'external',frame,props:externalProps}).nodes;
assert.ok(external.some(n=>n.data.external));
const center=n=>n.frame.x+n.frame.width/2;
for(const category of externalProps.categories){
 const mark=external.find(n=>n.role==='chart-mark'&&n.data.category===category);
 const categoryLabel=external.find(n=>n.role==='category-label'&&n.data.category===category);
 const badge=external.find(n=>n.role==='annotation-surface'&&n.data.category===category);
 assert.ok(Math.abs(center(mark)-center(categoryLabel))<.01,'External gutter must preserve category alignment with the actual mark');
 assert.ok(Math.abs(center(mark)-center(badge))<.01,'Metric rows must share the actual mark center');
 assert.ok(categoryLabel.data.textLayout.lines.length);
}
const pairLabel=external.find(n=>n.role==='category-group-label');
const pairMarks=external.filter(n=>n.role==='chart-mark'&&n.data.series==='Small').slice(0,2);
assert.ok(Math.abs(center(pairLabel)-(center(pairMarks[0])+center(pairMarks[1]))/2)<.01);
assert.ok(pairLabel.data.textLayout.lines.length);

assert.throws(()=>d.render({id:'bad',frame,props:{...props,categoryGroups:[{id:'bad',label:'Invalid',categories:['Country A','Country C']}]}}),/contiguous/);
const bars=REGISTRY.get('chart.column').render({id:'reference',frame,props:{categories:['Original clean','Forecast applied','Base forecast substituted','Lost synergies applied','Later costs and multiples'],series:[{name:'Value',values:[25.5,24.5,12.5,10,9]}],yMin:0,yMax:30,dataLabels:true,referenceLines:[{value:10.1,label:'10.1',placement:'outside-end'}]}}).nodes;
const axis=bars.find(n=>n.id==='reference:x-axis');
for(const n of bars.filter(n=>n.role==='category-label'))assert.ok(n.frame.y>axis.frame.y);
for(const line of bars.filter(n=>n.role==='chart-reference-line'))for(const n of bars.filter(n=>n.role==='data-label'))assert.ok(line.frame.y<n.frame.y||line.frame.y>n.frame.y+n.frame.height);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


class SparseLineTests(unittest.TestCase):
    def test_irregular_numeric_distances_disjoint_coverage_and_dependencies(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('chart.line'),props=structuredClone(owner.examples['numeric-sparse-observations'].props);
const nodes=owner.render({id:'sparse',frame:{x:0,y:0,width:1160,height:480},props}).nodes;
const marks=nodes.filter(n=>n.role==='chart-marker');
const key=(s,k)=>marks.find(n=>n.data.series===s&&n.data.pointKey===k);
const x=n=>n.frame.x+n.frame.width/2;
assert.ok(Math.abs((x(key('Historical','turn'))-x(key('Historical','start')))/(x(key('Historical','boundary'))-x(key('Historical','start')))-5/18)<.00001);
assert.equal(marks.length,7);
const lines=nodes.filter(n=>n.role==='chart-line');assert.equal(lines.length,4);
const ids=new Set(marks.map(n=>n.id));for(const line of lines){assert.deepEqual(line.data.dependencies,[line.data.from,line.data.to]);assert.ok(line.data.dependencies.every(id=>ids.has(id)));}
assert.ok(!lines.some(n=>n.data.from===key('Historical','turn').id&&n.data.to===key('Historical','resume').id));
assert.ok(!lines.some(n=>n.data.from===key('Historical','boundary').id&&n.data.to===key('Scenario','boundary').id));
const label=nodes.find(n=>n.role==='data-label');assert.deepEqual(label.data.dependencies,[key('Scenario','peak').id]);
assert.ok(nodes.some(n=>n.role==='chart-status-boundary'&&n.data.xValue===2018));
assert.ok(nodes.filter(n=>n.role==='category-label').every(n=>n.data.textLayout));
props.annotations=[{series:'Scenario',category:'wrong-key',text:'Unsupported'}];
assert.throws(()=>owner.render({id:'bad-anchor',frame:{x:0,y:0,width:1160,height:700},props}),/unknown category/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_rejects_ambiguous_or_invalid_sparse_contracts_and_keeps_legacy_strict(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('chart.line'),base=owner.examples['numeric-sparse-observations'].props;
const render=p=>owner.render({id:'probe',frame:{x:0,y:0,width:1160,height:480},props:p});
for(const change of [p=>delete p.gapPolicy,p=>p.categories=['a'],p=>p.xAxis.unit='',p=>p.series[0].unit='USD',p=>p.series[0].points[0].xUnit='month',p=>p.series[0].points[0].y=null,p=>p.series[0].points.push(null),p=>p.series[0].points[1].key='start',p=>p.series[0].points[1].x=1999,p=>p.series[0].points[1].x=2000,p=>p.series[0].points[3].x=2019,p=>p.series[1].status='before',p=>p.gapPolicy='connect-observations',p=>p.series[0].values=[1,2],p=>p.xAxis.ticks[1].value=2000]){
 const props=structuredClone(base);change(props);assert.throws(()=>render(props),/Sparse line:/);
}
assert.throws(()=>render({categories:['A','B'],series:[{name:'Value',values:[1,null]}]}),/finite/);
assert.throws(()=>REGISTRY.get('chart.area').render({id:'area',frame:{x:0,y:0,width:1160,height:480},props:base}),/chart.line only/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
