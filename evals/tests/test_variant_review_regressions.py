"""Behavioral regressions for geometry, provenance, and lost chart content."""
import unittest
from test_source_structure import run_node


class ReviewRegressions(unittest.TestCase):
    def test_decision_tree_minimum_frame_separates_conclusion(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('tree');
const render=height=>owner.render({id:'tree',frame:{x:0,y:0,width:1160,height},props:owner.sample}).nodes;
for(const h of [419,420,439]) assert.throws(()=>render(h),/height|440|frame|space/i);
const nodes=render(440), conclusion=nodes.find(n=>n.role==='decision-conclusion-surface');
for(const box of nodes.filter(n=>n.role==='decision-box')) assert.ok(box.frame.y+box.frame.height<=conclusion.frame.y);
console.log('{}');
""")

    def test_custom_polygons_accept_altitude_and_preserve_holes(self):
        run_node("""
import assert from 'node:assert/strict';
import {resolveGeography} from './skills/professional-slides/runtime/maps.mjs';
const square=(x,y,s)=>[[x,y,10],[x+s,y,10],[x+s,y+s,10],[x,y+s,10],[x,y,10]];
const outer=square(0,0,10),hole=square(2,2,2);
for(const geometry of [{type:'Polygon',coordinates:[outer,hole]},{type:'MultiPolygon',coordinates:[[outer,hole],[square(20,0,10),square(22,2,2)]]}]) {
 const input={id:'region',title:'Region',source:{url:'https://example.com/region',license:'Test',sha256:'a'.repeat(64)},geojson:{type:'FeatureCollection',features:[{type:'Feature',id:'region',geometry}]}};
 const original=JSON.stringify(input),rings=resolveGeography(input).countries[0].polygons;
 const area=r=>r.slice(1).reduce((s,p,i)=>s+r[i][0]*p[1]-p[0]*r[i][1],0);
 rings.forEach((ring,i)=>{assert.ok(i%2 ? area(ring)<0 : area(ring)>0);assert.ok(ring.every(p=>p.length===2));});
 assert.equal(JSON.stringify(input),original);
}
console.log('{}');
""")

    def test_three_segments_have_distinct_matching_bands(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const owner=REGISTRY.get('chart.column'),props=structuredClone(owner.examples['segment-implications'].props);
props.segments=[0,1,2].map(i=>({id:`s${i}`,label:`Group ${String.fromCharCode(65+i)}`,categories:props.categories.slice(i*2,i*2+2),heading:'Delivery implication',items:['Prioritize the next release.']}));
const nodes=owner.render({id:'segments',frame:{x:0,y:0,width:1160,height:540},props}).nodes;
const bands=nodes.filter(n=>n.role==='segment-header-band');
assert.equal(bands.length,3);assert.equal(new Set(bands.map(n=>n.style.fill.tokenId)).size,3);
props.segments.forEach((s,i)=>{const marks=nodes.filter(n=>n.data?.segmentId===s.id&&n.style?.fill);assert.ok(marks.length);for(const mark of marks)assert.equal(mark.style.fill.tokenId,bands[i].style.fill.tokenId);});
console.log('{}');
""")

    def test_stepped_bands_retain_optional_summary(self):
        run_node("""
import assert from 'node:assert/strict';
import {renderHorizons,HORIZONS_VARIANTS} from './skills/professional-slides/runtime/horizons.mjs';
const props=structuredClone(HORIZONS_VARIANTS['stepped-bands'].props);props.variant='stepped-bands';props.horizons[0].summary='Retain this summary.';
const nodes=renderHorizons({id:'horizons',frame:{x:0,y:0,width:1160,height:600},props});
assert.ok(nodes.some(n=>n.text?.includes('Retain this summary.')));console.log('{}');
""")

    def test_independent_part_charts_keep_category_labels(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
for(const component of ['chart.pie','chart.donut'])for(const settings of [{legend:false},{variant:'shared-legend'}])for(const legendMode of [undefined,'independent']){
 const props={legendMode,charts:[{component,props:{labels:['Core','Growth'],values:[60,40],...settings}},{component:'chart.scatter',props:REGISTRY.get('chart.scatter').sample}]};
 const before=JSON.stringify(props),nodes=REGISTRY.get('chart-group').render({id:'mixed',frame:{x:0,y:0,width:1160,height:570},props}).nodes;
 for(const label of ['Core','Growth'])assert.ok(nodes.some(n=>n.role==='category-label'&&n.text===label));
 assert.equal(JSON.stringify(props),before);
}
console.log('{}');
""")

    def test_media_checks_actual_png_and_jpeg_dimensions(self):
        run_node("""
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {MEDIA_SAMPLE,mediaNode,bitmapDimensions} from './skills/professional-slides/runtime/media.mjs';
const require=createRequire(process.env.RUNTIME_NODE_MODULES+'/package.json'),sharp=require('sharp');
const jpeg=await sharp({create:{width:40,height:20,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
for(const props of [MEDIA_SAMPLE,{...MEDIA_SAMPLE,dataUri:'data:image/jpeg;base64,'+jpeg.toString('base64'),width:40,height:20}]){
 assert.deepEqual(bitmapDimensions(props.dataUri),{width:props.width,height:props.height});
 const render=p=>mediaNode({id:'media',frame:{x:0,y:0,width:400,height:400},props:p});
 render(props);assert.throws(()=>render({...props,width:props.width+1}),/bitmap header/);assert.throws(()=>render({...props,height:props.height+1}),/bitmap header/);
}
assert.throws(()=>bitmapDimensions('data:image/png;base64,iVBORw0KGgo='));
assert.throws(()=>bitmapDimensions('data:image/jpeg;base64,/9g='));console.log('{}');
""")

    def test_geography_cli_preserves_exact_source_and_existing_files(self):
        run_node("""
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const raw=Buffer.from('  '+JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',id:'test',geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]})+'\\n');
const server=http.createServer((req,res)=>res.end(raw));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'geography-review-'));
try{
 const config=path.join(dir,'config.json'),output=path.join(dir,'region.json');
 await fs.writeFile(config,JSON.stringify({id:'test',title:'Test',url:`http://127.0.0.1:${server.address().port}/region`,license:'Test'}));
 const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['evals/scripts/import_geography.mjs',config,output],{stdio:'ignore'});child.on('error',reject);child.on('exit',resolve);});
 assert.equal(await run(),0);const source=await fs.readFile(output+'.source.geojson'),normalized=await fs.readFile(output);
 assert.deepEqual(source,raw);assert.equal(JSON.parse(normalized).source.sha256,createHash('sha256').update(source).digest('hex'));
 assert.notEqual(await run(),0);assert.deepEqual(await fs.readFile(output),normalized);assert.deepEqual(await fs.readFile(output+'.source.geojson'),source);
 await fs.unlink(output+'.source.geojson');assert.notEqual(await run(),0);assert.deepEqual(await fs.readFile(output),normalized);await assert.rejects(fs.access(output+'.source.geojson'));
}finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
console.log('{}');
""")
