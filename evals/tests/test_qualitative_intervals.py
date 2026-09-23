import unittest
from node_probe import run_node


class QualitativeIntervalsTests(unittest.TestCase):
    def test_keyed_interval_and_approximate_scalar_preserve_basis(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {normalizeChangeAnnotations,normalizeAnnotationRail,renderChangeAnnotations,chartAnnotationBands} from './skills/professional-slides/runtime/chart-annotations.mjs';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const interval={style:'interval-label',start:'Forecast',end:'Base',text:'Forecast reset',basis:'approximate-source-readings',qualification:'Approximate source levels'};
const props={changeAnnotations:[interval]};
const pointMap=new Map([['category:Forecast',{x:200,y:180}],['category:Base',{x:400,y:280}]]);
const nodes=renderChangeAnnotations({id:'interval',plot:{x:100,y:140,width:600,height:300},props,pointMap});
assert.equal(nodes.filter(n=>n.type==='ellipse').length,0);
assert.equal(nodes.filter(n=>n.type==='text').length,1);
assert.equal(nodes.find(n=>n.type==='text').text,'Forecast reset');
assert.ok(nodes.every(n=>n.data.start.category==='Forecast'&&n.data.end.category==='Base'));
assert.ok(nodes.find(n=>n.data.annotationPart==='span').data.endArrow);
assert.ok(nodes.find(n=>n.type==='text').data.textLayout.lines.length);
const frame={x:60,y:140,width:900,height:480};
const deck=compileDeck({slides:[{id:'semantic',composition:component({id:'chart',component:'chart.column',frame,props:{categories:['Forecast','Base'],series:[{name:'Value',values:[80,40]}],...props}})}]},REGISTRY);
const label=deck.slides[0].nodes.find(n=>n.data.annotationStyle==='interval-label'&&n.type==='text');

const visible={changeAnnotations:[{...interval,showQualification:true}]};
assert.ok(renderChangeAnnotations({id:'visible',plot:{x:100,y:140,width:600,height:300},props:visible,pointMap}).find(n=>n.type==='text').text.includes('Approximate source levels'));
assert.ok(chartAnnotationBands(visible).top>=chartAnnotationBands(props).top);
assert.throws(()=>normalizeChangeAnnotations({changeAnnotations:[{...interval,basis:undefined}]}),/basis/);
assert.throws(()=>normalizeChangeAnnotations({changeAnnotations:[{...interval,qualification:'precise'}]}),/Approximate/);
assert.throws(()=>normalizeChangeAnnotations({changeAnnotations:[{...interval,style:'bracket'}]}),/numeric/);
assert.throws(()=>renderChangeAnnotations({id:'bad',plot:{x:100,y:140,width:600,height:300},props:{changeAnnotations:[{...interval,end:'missing'}]},pointMap}),/unknown category/);
for(const text of ['~50,000','≈ 12.5%','~$4.2M','N/A'])assert.equal(normalizeAnnotationRail({annotationRail:{items:[{category:'A',text}]}}).rows[0].items[0].text,text);
for(const text of ['about 50,000','~50,000 jobs','~~50','~N/A','50 / 20','~50–60'])assert.throws(()=>normalizeAnnotationRail({annotationRail:{items:[{category:'A',text}]}}),/numeric/);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
