import unittest
from test_source_structure import run_node


class ContentVariantTests(unittest.TestCase):
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

    def test_embedded_media_gate_rejects_missing_or_unplanned_payloads(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {auditEmbeddedMedia} from './evals/scripts/media_integrity.mjs';
const a=Buffer.from('declared image'),b=Buffer.from('unexpected image');
assert.equal(auditEmbeddedMedia([a],[a,a]).accepted,true);
assert.equal(auditEmbeddedMedia([a],[]).accepted,false);
assert.equal(auditEmbeddedMedia([a],[a,b]).accepted,false);
assert.equal(auditEmbeddedMedia([],[]).accepted,true);
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
