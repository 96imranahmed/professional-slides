import unittest
from node_probe import run_node


class ContentVariantTests(unittest.TestCase):
    def test_exhibit_commentary_does_not_change_with_its_neighbours(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const page=(id,n=2)=>({id,title:'Capacity serves the defined workload under fixed assumptions',layout:'exhibit-top',pointsHeading:false,pointsStyle:'prose',
 exhibit:{type:'chart.bar',heading:'Service capacity',unit:'hours',categories:['Baseline','Scenario'],series:[{name:'Capacity',values:[100,120]}]},
 points:Array.from({length:n},(_,i)=>({lead:`Finding ${i+1}`,text:'Review the workload boundary before expanding the deployment.'}))});
const build=slides=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'t',tracker:false,slides})).deck.slides;
const alone=build([page('target')])[0];
const after=build([page('prior'),page('target'),page('single',1)]);
assert.deepEqual(after[1].nodes.filter(n=>n.id.includes('target-col-')).map(n=>[n.id,n.text]),alone.nodes.filter(n=>n.id.includes('target-col-')).map(n=>[n.id,n.text]));
assert.ok(after[1].nodes.some(n=>n.id.includes('target-col-')));
assert.ok(!after.some(s=>s.nodes.some(n=>n.id.includes('below-cards'))));
assert.doesNotThrow(()=>build([page('single',1)]));
console.log('{}');
''')

    def test_custom_geography_preserves_provenance_and_rejects_invalid_rings(self):
        run_node(r'''
import assert from 'node:assert/strict';
import { importGeography } from './skills/professional-slides/runtime/import-geography.mjs';
import { resolveGeography } from './skills/professional-slides/runtime/maps.mjs';
const bytes=Buffer.from(JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{code:'district',name:'Test district'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]}));
const config={id:'test',title:'Test geometry',url:'https://example.org/map.geojson',license:'Test fixture',idProperty:'code'};
const result=importGeography(bytes,config), resolved=resolveGeography(result);
assert.equal(resolved.countries[0].id,'district');
assert.equal(resolved.countries[0].source.sha256,result.source.sha256);
const bad=structuredClone(result);bad.geojson.features[0].geometry.coordinates[0].pop();
assert.throws(()=>resolveGeography(bad),/closed/);
const duplicate=structuredClone(result);duplicate.geojson.features.push(duplicate.geojson.features[0]);
assert.throws(()=>resolveGeography(duplicate),/unique/);
const projected=structuredClone(result);projected.geojson.crs={type:'name'};
assert.throws(()=>resolveGeography(projected),/Reproject/);
console.log('{}');
''')

    def test_layout_contracts_preserve_comparison_identity(self):
        run_node(r'''
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { MEDIA_SAMPLE,mediaNode } from './skills/professional-slides/runtime/media.mjs';
const frame={x:0,y:0,width:1160,height:570};
const group=REGISTRY.get('chart-group'), gp=group.variants['four-way'].props;
const nodes=group.render({id:'four',frame,props:gp}).nodes;
assert.equal(new Set(nodes.filter(n=>n.data.childChart).map(n=>n.data.childChart)).size,4);
const tree=REGISTRY.get('tree'),tp={variant:'decision-conclusions',...tree.variants['decision-conclusions'].props};
assert.equal(tree.render({id:'tree',frame,props:tp}).nodes.filter(n=>n.role==='decision-conclusion').length,1);
assert.equal(tree.defaultVariant,'decision-conclusions');
assert.throws(()=>tree.render({id:'flat',frame,props:{root:'Pass?',children:['No','Yes']}}),/requires/);
assert.throws(()=>tree.render({id:'flat',frame,props:{variant:'standard',root:'Pass?',children:['No','Yes']}}),/multiple levels/);
const boxes=tree.render({id:'levels',frame,props:tree.sample}).nodes.filter(n=>n.role==='decision-box');
assert.equal(new Set(boxes.map(n=>n.frame.y)).size,3);
const bad=structuredClone(tp);bad.branches[1].conclusions[0].id='a1';
assert.throws(()=>tree.render({id:'bad',frame,props:bad}),/unique/);
const chart=REGISTRY.get('chart.column'), cp=chart.examples['segment-implications'].props;
const output=chart.render({id:'segments',frame,props:cp}).nodes;
assert.equal(output.filter(n=>n.role==='chart-mark'&&n.data.segmentId==='focus').length,4);
assert.equal(output.filter(n=>n.role==='segment-header-band').length,2);
const wrong=structuredClone(cp);wrong.segments[0].categories.reverse();
assert.throws(()=>chart.render({id:'bad',frame,props:wrong}),/partition/);
const image=mediaNode({id:'image',frame:{x:0,y:0,width:400,height:200},props:MEDIA_SAMPLE});
assert.equal(image.frame.width,image.frame.height);
assert.equal(image.frame.x,100);
assert.throws(()=>mediaNode({id:'bad',frame,props:{...MEDIA_SAMPLE,authorization:''}}),/authorization/);
console.log('{}');
''')

    def test_four_way_accepts_mixed_charts_and_omits_single_key_legend(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('chart-group'),frame={x:0,y:0,width:1160,height:570};
const single=owner.render({id:'one-key',frame,props:owner.variants['four-way'].props}).nodes;
assert.equal(single.filter(n=>n.role==='legend-label'||n.role==='legend-swatch').length,0);
const mixed=owner.render({id:'mixed',frame:{...frame,height:620},props:owner.examples['four-way-mixed'].props}).nodes;
assert.equal(new Set(mixed.filter(n=>n.data.childChart).map(n=>n.data.childChart)).size,4);
assert.ok(mixed.some(n=>n.role==='chart-mark'));
const trends=REGISTRY.get('icon-trends');
const images=trends.render({id:'images',frame,props:{variant:'image-columns',...trends.variants['image-columns'].props}}).nodes;
assert.equal(images.filter(n=>n.role==='trend-media').length,4);
assert.ok(images.filter(n=>n.role==='trend-media').every(n=>n.frame.width>200));
assert.equal(images.filter(n=>n.type==='text').length,8);
console.log('{}');
''')

    def test_logo_collage_uses_small_grid_or_radial_marks_and_prepared_treatments(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const c=REGISTRY.get('logo-collage'),frame={x:0,y:0,width:1160,height:400};
const render=props=>c.render({id:'logos',frame,props:{...c.sample,...props}}).nodes;
const gray=render({}),color=render({variant:'color'}),radial=render({layout:'radial'});
assert.equal(new Set(gray.map(n=>n.frame.y)).size,2);
assert.ok(gray.every(n=>n.frame.width<=80&&n.frame.height<=80));
assert.ok(radial.every(n=>n.frame.width<=80));
assert.ok(new Set(radial.map(n=>Math.round(n.frame.y))).size>1);
assert.notEqual(gray[1].data.dataUri,color[1].data.dataUri);
assert.throws(()=>render({columns:4}),/multiple logo grid rows/);
assert.throws(()=>render({variant:'theme'}),/Unknown logo treatment/);
assert.throws(()=>render({items:[{id:'missing'}]}),/prepared logo media/);
console.log('{}');
""")

    def test_area_collage_preserves_mixed_aspects_and_rejects_bad_cells(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const c=REGISTRY.get('logo-collage'),frame={x:0,y:0,width:1160,height:400},props=c.examples['area-color'].props;
const nodes=c.render({id:'area',frame,props}).nodes;
assert.equal(nodes.length,8);
assert.ok(nodes.some(n=>n.frame.width/n.frame.height>2));
assert.ok(nodes.every(n=>n.frame.width<=280&&n.frame.height<=96));
assert.ok(Math.max(...nodes.map(n=>n.frame.x+n.frame.width))-Math.min(...nodes.map(n=>n.frame.x))>900);
const bad=structuredClone(props);bad.items[1].cell=bad.items[0].cell;
assert.throws(()=>c.render({id:'bad',frame,props:bad}),/overlap/);
bad.items[1].cell={x:-1,y:0,width:.1,height:.1};
assert.throws(()=>c.render({id:'bad',frame,props:bad}),/normalized rectangle/);
console.log('{}');
""")

    def test_icon_columns_center_actual_content_and_tracker_uses_name(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('icon-trends'),frame={x:0,y:0,width:1160,height:570};
const nodes=owner.render({id:'center',frame,props:owner.sample}).nodes;
const top=Math.min(...nodes.map(n=>n.frame.y)), bottom=Math.max(...nodes.map(n=>n.frame.y+n.frame.height));
assert.ok(top>0);assert.ok(Math.abs(top-(570-bottom))<1);
const label=REGISTRY.get('tracker-label');
const rendered=label.render({id:'name',frame:{x:0,y:0,width:1000,height:40},props:{...label.sample,construction:'compact-label'}}).nodes;
assert.equal(rendered.length,1);
assert.equal(rendered[0].text,label.sample.items.find(i=>i.id===label.sample.selectedId).label);
console.log('{}');
''')


class BodyBulletTests(unittest.TestCase):
    def test_body_variant_is_measured_theme_bound_and_never_distributed(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('bullet-list'),frame={x:0,y:0,width:440,height:300};
const props={variant:'body',items:['Demand has strengthened, but additional capacity is needed before the business can convert it into growth.','Proceed only after the required capacity is available.']};
const measured=owner.measureContent({frame,props}),nodes=owner.render({id:'body',frame,props}).nodes;
assert.equal(nodes.filter(n=>n.role==='list-item').length,2);
const [a,b]=nodes.filter(n=>n.role==='list-item');
assert.equal(a.style.fontSize.tokenId,'type.body');assert.equal(a.style.fontFamily.tokenId,'font.body');
assert.equal(a.frame.x,b.frame.x);assert.equal(b.frame.y-a.frame.y-a.frame.height,8);
assert.equal(b.frame.y+b.frame.height,measured.height);
assert.deepEqual(owner.render({id:'body',frame:{...frame,height:600},props}).nodes,nodes);
assert.throws(()=>owner.render({id:'body',frame,props:{...props,variant:'tiny'}}),/Unknown/);
assert.throws(()=>owner.measureContent({frame,props:{variant:'body',items:[]}}),/nonempty/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


class StaircaseRiseTests(unittest.TestCase):
    """A staircase is a shape, not a way of spending height.

    The rise stretched to fill whatever frame it was given: three steps in a
    470px body produced a 191px rise for a 44px tread, so the page read as three
    small islands with a hundred and fifty pixels of nothing between them and
    the whole top-left corner empty. It now rises by about what a tread and its
    text need, and the figure centres in the leftover rather than smearing it
    between every step.
    """

    def test_the_rise_is_capped_and_the_figure_centres(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry = createRegistry();
const items = ['A relationship', 'A choice', 'A consequence'].map((label) => ({
  label, text: 'A sentence of supporting detail that runs to about two lines at this width.' }));
const measure = (height) => {
  const frame = {x: 60, y: 140, width: 1160, height};
  const nodes = registry.get('steps').render({id: 's', frame, props: {items}}).nodes;
  const treads = nodes.filter((n) => n.role === 'step-block').map((n) => n.frame.y).sort((a, b) => a - b);
  const top = Math.min(...nodes.map((n) => (n.frame ? n.frame.y : Infinity)));
  const bottom = Math.max(...nodes.map((n) => (n.frame ? n.frame.y + (n.frame.height || 0) : 0)));
  return {rise: treads[1] - treads[0], above: top - frame.y, below: frame.y + height - bottom};
};
const tall = measure(470), short = measure(300);
// The rise no longer tracks the frame: a page half again as tall does not make
// the staircase half again as loose.
assert.ok(tall.rise < 110, `rise ${tall.rise} should stay compact in a tall frame`);
assert.ok(tall.rise / short.rise < 1.6, `rise grew ${short.rise} -> ${tall.rise} with the frame`);
// And the leftover is shared top and bottom rather than dumped in one place.
assert.ok(Math.abs(tall.above - tall.below) < 40, `unbalanced: ${tall.above} above, ${tall.below} below`);
console.log(JSON.stringify({ok: true}));
''')
        self.assertTrue(result["ok"])
