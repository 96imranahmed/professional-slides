import unittest
from node_probe import run_node


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
