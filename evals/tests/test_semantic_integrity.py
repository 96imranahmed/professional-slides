import unittest
from test_source_structure import run_node

class SemanticIntegrityTests(unittest.TestCase):
    def test_bar_axes_render_above_marks_in_both_orientations(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {compileDeck,absolute,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
for (const type of ['chart.column','chart.bar']) {
 for (const values of [[20,40],[-20,40]]) {
  const slide=compileDeck({id:'test',slides:[{id:'s',composition:absolute({id:'all',children:[component({id:'chart',component:type,props:{categories:['A','B'],series:[{name:'Value',values}],gridlines:true},frame:{x:60,y:100,width:900,height:450}})]})}]},REGISTRY).slides[0];
  const nodes=slide.nodes, marks=nodes.flatMap((n,i)=>n.role==='chart-mark'?[i]:[]), axes=nodes.flatMap((n,i)=>n.role==='chart-axis'?[i]:[]), grids=nodes.flatMap((n,i)=>n.role==='chart-gridline'?[i]:[]);
  assert.ok(marks.length && axes.length && grids.length);
  assert.ok(Math.min(...axes)>Math.max(...marks), 'Axes must paint above every bar');
  assert.ok(Math.max(...grids)<Math.min(...marks), 'Gridlines must remain behind bars');
 }
}
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_criticality_validator_rejects_mutated_layers_and_redundant_titles(self):
        result=run_node("""
import assert from 'node:assert/strict';
import {assertVisualCriticality} from './skills/professional-slides/runtime/semantic-integrity.mjs';
const node=(id,role,text,frame={x:0,y:0,width:100,height:100})=>({id,role,text,frame,type:role==='chart-mark'?'rect':'text',data:{componentInstance:'owner'}});
const axis=node('axis','chart-axis','',{x:0,y:100,width:100,height:0}),bar=node('bar','chart-mark','');
assert.doesNotThrow(()=>assertVisualCriticality([bar,axis]));
assert.throws(()=>assertVisualCriticality([axis,bar]),/BASELINE_LAYERING/);
for (const text of ['The comparison in five chapters','Our presentation across 4 sections']) assert.throws(()=>assertVisualCriticality([node('title','tracker-page-title',text)]),/TITLE_CRITICALITY/);
assert.doesNotThrow(()=>assertVisualCriticality([node('title','tracker-page-title','Careers and industries')]));
assert.throws(()=>assertVisualCriticality([node('title','insight-heading','Capacity constrains growth'),node('body','insight-body','Capacity constrains growth until the second factory opens.')]),/TITLE_CRITICALITY/);
assert.doesNotThrow(()=>assertVisualCriticality([node('body','insight-body','Capacity constrains growth until the second factory opens.')]));
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])

    def test_each_object_tag_and_dependency_survives_mutation(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {compileDeck,absolute,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {assertSemanticIntegrity} from './skills/professional-slides/runtime/semantic-integrity.mjs';
const children=[component({id:'takeaway',component:'insight',props:{text:'Growth supports investment.'},frame:{x:60,y:500,width:1000,height:100}}),component({id:'metric',component:'metric',props:{value:'42',label:'Active sites',delta:'+2'},frame:{x:60,y:100,width:240,height:180}}),component({id:'chart',component:'chart.column',props:{categories:['2024','2025'],series:[{name:'Sales',values:[20,40]}],changeAnnotations:[{start:'2024',end:'2025',style:'bracket',text:'+100%'}]},frame:{x:340,y:100,width:750,height:380}})];
const slide=compileDeck({id:'test',slides:[{id:'s',composition:absolute({id:'all',children})}]},REGISTRY).slides[0];
for(const node of slide.nodes){
 const copy=structuredClone(slide.nodes);delete copy.find(n=>n.id===node.id).data.semantic;
 assert.throws(()=>assertSemanticIntegrity(copy,slide.componentInstances),/Dangling/);
}
let checked=0;
for(const node of slide.nodes.filter(n=>n.data.semantic.requires.length)){
 for(const dep of node.data.semantic.requires){assert.throws(()=>assertSemanticIntegrity(slide.nodes.filter(n=>n.id!==dep),slide.componentInstances),/Dangling/);checked++;}
}
assert.ok(checked>10);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_detached_prose_and_fake_section_tags_fail(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {assertPlanRelationships} from './skills/professional-slides/runtime/semantic-integrity.mjs';
const evidence={id:'chart',component:'chart.line'};
const text={id:'takeaway',component:'paragraph',props:{text:'Trips increased.'},frame:{x:0,y:400,width:800,height:40}};
assert.throws(()=>assertPlanRelationships({items:[evidence,text]}),/Dangling/);
assert.throws(()=>assertPlanRelationships({items:[{id:'secondary',items:[evidence,text]}]}),/Dangling/);
assert.throws(()=>assertPlanRelationships({items:[evidence,{...text,props:{...text.props,semantic:{kind:'section-member',relatedTo:['missing']}}}]}),/Dangling/);
assert.doesNotThrow(()=>assertPlanRelationships({items:[evidence,{...text,component:'insight'}]}));
const heading={id:'heading',component:'section-heading',props:{text:'Network scope',semantic:{kind:'section-member',relatedTo:['takeaway']}},frame:{x:0,y:350,width:800,height:32}};
assert.throws(()=>assertPlanRelationships({items:[evidence,heading,{...text,props:{...text.props,semantic:{kind:'section-member',relatedTo:['heading']}}}]}),/Dangling/);
assert.doesNotThrow(()=>assertPlanRelationships({items:[evidence,{id:'note',component:'evidence-note',props:{heading:'Scope',text:'Matched period',semantic:{kind:'evidence-note',relatedTo:[evidence.id]}}}]}));
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_dimension_axis_and_missing_change_reject(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
import {validateSlidePlan} from './skills/professional-slides/runtime/planner.mjs';
const table={id:'t',frame:{x:0,y:0,width:800,height:300},props:{comparisonAxis:'rows',treatment:'dimensions',columns:[{label:'Criterion',type:'category'},{label:'NYC',type:'text'},{label:'SF',type:'text'}],rows:[['Rent','10','20']]}};
assert.throws(()=>renderTable(table),/Row dimensions/);
table.props.treatment='open';assert.doesNotThrow(()=>renderTable(table));
const plan={id:'p',title:'Sales grew',items:[{id:'c',job:'Compare sales',component:'chart.column',props:{changeIntent:'time',categories:['2024','2025'],series:[{name:'Sales',values:[20,40]}]}}]};
assert.throws(()=>validateSlidePlan(plan),/highlighted change annotation/);
plan.items[0].props.changeAnnotations=[{start:'2024',end:'2025',text:'+100%'}];assert.doesNotThrow(()=>validateSlidePlan(plan));
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_matched_comparison_rejects_type_period_and_scale_drift(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {assertEquivalentComparisons} from './skills/professional-slides/runtime/chart-group.mjs';
const chart={component:'chart.column',props:{categories:['2024','2025'],yMin:0,yMax:100,valueFormat:{decimals:1}}};
const props={comparison:{kind:'matched',unit:'units'},charts:[chart,structuredClone(chart)]};
assert.doesNotThrow(()=>assertEquivalentComparisons(props));
for(const mutate of [c=>c.component='chart.line',c=>c.props.categories=['2023','2025'],c=>c.props.yMax=200,c=>c.unit='percent']) {
 const broken=structuredClone(props);mutate(broken.charts[1]);assert.throws(()=>assertEquivalentComparisons(broken),/equivalent/);
}
assert.doesNotThrow(()=>assertEquivalentComparisons({charts:[chart,{component:'chart.line',props:{}}]}));
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_review_payload_keeps_values_and_hashes_binary_assets(self):
        import json
        from test_canonical_generation import validator
        source={"series":[1,2,3],"source":"https://example.com","media":{"dataUri":"data:image/png;base64,"+"A"*1100000,"alt":"City map"}}
        result=json.loads(validator.compact_review_payload(json.dumps(source)))
        self.assertEqual(result["series"],[1,2,3])
        self.assertEqual(result["media"]["alt"],"City map")
        self.assertEqual(len(result["media"]["dataUri"]["sha256"]),64)
        self.assertLess(len(json.dumps(result)),1000)
        polygon={"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]],"properties":{"source":"public boundary"}}
        result=json.loads(validator.compact_review_payload(json.dumps(polygon)))
        self.assertEqual(result["coordinates"]["vertices"],4)
        self.assertEqual(result["coordinates"]["bounds"],[0,0,1,1])
        self.assertEqual(result["properties"],polygon["properties"])

    def test_consistency_schema_uses_supported_subset(self):
        from test_canonical_generation import validator
        import json
        self.assertNotIn('uniqueItems', json.dumps(validator.CONSISTENCY_SCHEMA))

    def test_compact_numbers_keep_shared_magnitude_and_raw_values(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {formatValue} from './skills/professional-slides/runtime/charts.mjs';
const props={valueFormat:{compactUnit:'m'}};
assert.equal(formatValue(8300000,props),'8.3m');
assert.equal(formatValue(826079,props),'0.8m');
assert.equal(formatValue(-8300000,props),'-8.3m');
assert.throws(()=>formatValue(123,{valueFormat:{compactUnit:'invalid'}}),/compactUnit/);
assert.equal(formatValue(826079,{valueFormat:{decimals:0}}),'826079');
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_horizontal_common_scale_and_negative_zero_geometry(self):
        result=run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const render=values=>REGISTRY.get('chart.bar').render({id:'c',frame:{x:0,y:0,width:900,height:400},props:{categories:['A','B'],series:[{name:'s',values}],xMin:0,xMax:10,dataLabels:false}}).nodes;
const first=nodes=>nodes.find(n=>n.role==='chart-mark').frame.width;
assert.equal(first(render([2,4])),first(render([2,8])));
const nodes=REGISTRY.get('chart.bar').render({id:'n',frame:{x:0,y:0,width:900,height:400},props:{categories:['Motor vehicle theft','Burglary'],series:[{name:'s',values:[-44,-29]}],xMin:-50,xMax:0,valueFormat:{suffix:'%'}}}).nodes;
const axis=nodes.find(n=>n.id==='n:y-axis');
for(const mark of nodes.filter(n=>n.role==='chart-mark')) assert.ok(Math.abs(mark.frame.x+mark.frame.width-axis.frame.x)<.001);
const labels=nodes.filter(n=>n.role==='data-label');
const categories=nodes.filter(n=>n.role==='category-label');
for(const label of labels) for(const cat of categories) if(Math.abs(label.frame.y-cat.frame.y)<60) assert.ok(cat.frame.x+cat.frame.width<label.frame.x);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_tree_connectors_require_exact_endpoint_boxes(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {compileDeck,absolute,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {assertSemanticIntegrity} from './skills/professional-slides/runtime/semantic-integrity.mjs';
const slide=compileDeck({id:'tree',slides:[{id:'s',composition:absolute({id:'all',children:[component({id:'tree',component:'tree',props:REGISTRY.get('tree').sample,frame:{x:0,y:0,width:1100,height:500}})]})}]},REGISTRY).slides[0];
const links=slide.nodes.filter(n=>n.role==='decision-connector');assert.equal(links.length,6);
for(const link of links){assert.equal(link.data.semantic.requires.length,2);for(const id of link.data.semantic.requires) assert.throws(()=>assertSemanticIntegrity(slide.nodes.filter(n=>n.id!==id),slide.componentInstances),/Dangling/);}
console.log('{}');
''')

    def test_constant_rate_scenario_rejected_before_authoring(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {assertChartSelection} from './skills/professional-slides/runtime/planner.mjs';
const props={categories:['2025','2026','2027','2028'],series:[{values:[0,5,10,15]}]};
assert.throws(()=>assertChartSelection('chart.line',props),/endpoint bars/);
const selection={question:'Which endpoint is larger?',dataBasis:'constant-rate-scenario',reason:'Compare common endpoints',rejectedAlternative:'Line adds no observed temporal information'};
assert.throws(()=>assertChartSelection('chart.line',{...props,chartSelection:selection}),/bar\/column/);
assert.throws(()=>assertChartSelection('chart-group',{charts:[{component:'chart.line',props:{...props,chartSelection:selection}}]}),/bar\/column/);
assert.doesNotThrow(()=>assertChartSelection('chart.bar',{...props,chartSelection:selection}));
assert.doesNotThrow(()=>assertChartSelection('chart.line',{...props,chartSelection:{...selection,dataBasis:'observed',reason:'Source observations show a stable measured pace'}}));
console.log('{}');
''')
