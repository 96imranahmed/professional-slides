import unittest

from test_source_structure import run_node


class HorizonsChartTests(unittest.TestCase):
    def test_horizons_owner_exposes_curve_and_stepped_density_variants(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {HORIZONS_SAMPLE} from './skills/professional-slides/runtime/horizons.mjs';

const owner=REGISTRY.get('chart.horizons');
assert.ok(owner);
assert.equal(owner.defaultVariant,'curves');
assert.deepEqual(Object.keys(owner.variants),['curves','stepped','stepped-minimal']);
const frame={x:60,y:150,width:1160,height:460};
const render=variant=>owner.render({id:`horizons-${variant}`,frame,props:{...structuredClone(HORIZONS_SAMPLE),...structuredClone(owner.variants[variant].props||{}),variant}}).nodes;

const curves=render('curves');
const axes=curves.filter(node=>node.role==='horizon-axis');
assert.equal(axes.length,2);
assert.ok(axes.every(node=>node.type==='line'&&node.data.endArrow===true&&node.data.endArrowType==='triangle'));
assert.equal(curves.filter(node=>node.role==='horizon-curve').length,54);
assert.deepEqual([...new Set(curves.filter(node=>node.role==='horizon-curve').map(node=>node.data.horizonId))],['horizon-1','horizon-2','horizon-3']);
assert.equal(curves.filter(node=>node.role==='horizon-label').length,3);
assert.equal(curves.filter(node=>node.role==='horizon-title').length,3);
assert.equal(curves.filter(node=>node.role==='horizon-description').length,3);
assert.ok(curves.every(node=>node.type!=='image'));

const stepped=render('stepped');
assert.equal(stepped.filter(node=>node.role==='horizon-step-line').length,3);
assert.equal(stepped.filter(node=>node.role==='horizon-axis').length,0);
assert.equal(stepped.filter(node=>node.role==='horizon-detail-label').length,3);
assert.equal(stepped.filter(node=>node.role==='horizon-detail-value').length,3);
assert.equal(stepped.filter(node=>node.role==='horizon-description').length,3);
assert.ok(stepped.filter(node=>node.role==='horizon-step-line').every(node=>node.style.stroke.tokenId==='color.componentPrimary'));

const minimal=render('stepped-minimal');
assert.equal(minimal.filter(node=>node.role==='horizon-step-line').length,3);
assert.equal(minimal.filter(node=>node.role==='horizon-detail-label'||node.role==='horizon-detail-value').length,0);
assert.equal(minimal.filter(node=>node.role==='horizon-summary').length,3);
assert.ok([...curves,...stepped,...minimal].filter(node=>node.type==='text').every(node=>node.data.textLayout&&node.style.wrap===false));

const compact=Array.from({length:9},(_,index)=>({id:`h${index+1}`,label:`H${index+1}`,title:`Stage ${index+1}`,summary:`Focus ${index+1}`}));
assert.doesNotThrow(()=>owner.render({id:'extended',frame,props:{variant:'stepped-minimal',horizons:compact}}));
for(const props of [
  {horizons:[{id:'h1',label:'H1'}]},
  {variant:'unknown',horizons:HORIZONS_SAMPLE.horizons},
  {variant:'curves',horizons:Array.from({length:6},(_,index)=>({id:`h${index}`,label:`H${index}`}))},
  {variant:'stepped',horizons:[{id:'h1',label:'H1'},{id:'h1',label:'H2'}]},
  {variant:'curves',horizons:[{id:'h1',label:'H1',start:0.8,end:0.4},{id:'h2',label:'H2'}]},
  {variant:'curves',horizons:[{id:'h1',label:'H1',timeframe:'Soon'},{id:'h2',label:'H2'}]},
  {variant:'stepped',xLabel:'Time',horizons:[{id:'h1',label:'H1'},{id:'h2',label:'H2'}]},
  {variant:'stepped-minimal',horizons:[{id:'h1',label:'H1',details:[{label:'Focus',value:'Core'}]},{id:'h2',label:'H2'}]}
]) assert.throws(()=>owner.render({id:'invalid',frame,props}));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])


if __name__ == "__main__":
    unittest.main()
