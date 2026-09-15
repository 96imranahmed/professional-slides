import unittest
from node_probe import run_node


class ChartCapacityTests(unittest.TestCase):
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
