"""Maps (runtime/maps.mjs): geographies and crops, markers and routes, size legends,
and the geography importer (evals/scripts/import_geography.mjs).
"""
import unittest

from node_probe import run_node


class MapRuntimeTests(unittest.TestCase):
    def test_standard_geographies_aliases_and_country_crops_resolve(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {MAP_PRESET_IDS,resolveGeography} from './skills/professional-slides/runtime/maps.mjs';
const required=['world','usa','usa-contiguous','north-america','south-america','latin-america','americas','europe','mena','middle-east','gcc','africa','sub-saharan-africa','asia','asia-pacific','oceania','emea','united-kingdom','canada','brazil','china','india','australia','japan'];
assert.deepEqual([...MAP_PRESET_IDS].sort(),[...required].sort());
for(const input of ['US','USA','U.S.','U.S.A.','United States']) assert.equal(resolveGeography(input).id,'usa');
assert.equal(resolveGeography('Europe').id,'europe');
assert.equal(resolveGeography('MENA').id,'mena');
assert.equal(resolveGeography('APAC').id,'asia-pacific');
assert.equal(resolveGeography('EMEA').id,'emea');
assert.equal(resolveGeography('LAC').id,'latin-america');
assert.equal(resolveGeography('SSA').id,'sub-saharan-africa');
assert.equal(resolveGeography('UK').id,'united-kingdom');
const germany=resolveGeography('country:DEU');
assert.equal(germany.id,'country:DEU');
assert.deepEqual(germany.countries.map(country=>country.id),['DEU']);
assert.equal(resolveGeography('country:Germany').id,'country:DEU');
assert.throws(()=>resolveGeography('Atlantis'),/Unknown map geography/);
assert.throws(()=>resolveGeography('country:Atlantis'),/Unknown Natural Earth country/);
console.log(JSON.stringify({accepted:true,presets:MAP_PRESET_IDS.length}));
""")
        self.assertEqual(result, {"accepted": True, "presets": 24})

    def test_real_country_shapes_regions_highlights_and_source_provenance(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {mapNodes,NATURAL_EARTH_SOURCE,resolveGeography} from './skills/professional-slides/runtime/maps.mjs';
const frame={x:60,y:140,width:1160,height:470};
const render=(geography,extra={})=>mapNodes({id:'map',frame,props:{geography,markers:[],...extra}});
const world=render('world');
assert.equal(world.length,177);
assert.ok(world.every(node=>node.type==='shape'&&node.role==='map-land'&&node.data.geometry==='customPolygon'));
assert.equal(new Set(world.map(node=>node.data.countryId)).size,world.length);
assert.ok(!world.some(node=>node.data.countryId==='ATA'));
assert.ok(world.every(node=>node.data.source===NATURAL_EARTH_SOURCE.name));
assert.ok(world.every(node=>node.data.sourceCommit===NATURAL_EARTH_SOURCE.commit));
assert.equal(NATURAL_EARTH_SOURCE.sha256,'6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f');
assert.equal(NATURAL_EARTH_SOURCE.supplements[0].sha256,'3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb');
const usa=render('USA');
assert.deepEqual(usa.map(node=>node.data.countryId),['USA']);
const europe=new Set(resolveGeography('Europe').countries.map(country=>country.id));
assert.ok(['DEU','FRA','GBR','ITA','TUR','CYP'].every(id=>europe.has(id)));
assert.ok(!europe.has('USA')&&!europe.has('CHN'));
const mena=new Set(resolveGeography('MENA').countries.map(country=>country.id));
assert.ok(['BHR','SAU','EGY','MAR','ISR','IRN'].every(id=>mena.has(id)));
assert.ok(!mena.has('USA')&&!mena.has('DEU'));
assert.deepEqual(resolveGeography('GCC').countries.map(country=>country.id).sort(),['ARE','BHR','KWT','OMN','QAT','SAU']);
const southAfrica=world.find(node=>node.data.countryId==='ZAF');
assert.ok(southAfrica.data.paths.length>1);
const highlighted=render('world',{highlightCountries:['USA','Germany','CHN']});
assert.deepEqual(highlighted.filter(node=>node.data.highlighted).map(node=>node.data.countryId).sort(),['CHN','DEU','USA']);
assert.ok(highlighted.filter(node=>node.data.highlighted).every(node=>node.style.fill.tokenId==='color.componentPrimary'));
assert.ok(highlighted.filter(node=>!node.data.highlighted).every(node=>node.style.fill.tokenId==='color.surfaceTint'));
assert.throws(()=>render('Europe',{highlightCountries:['USA']}),/outside europe/);
console.log(JSON.stringify({accepted:true,world:world.length,europe:europe.size,mena:mena.size}));
""")
        self.assertEqual(result, {"accepted": True, "world": 177, "europe": 41, "mena": 23})

    def test_country_anchored_and_crop_relative_markers_share_the_existing_api(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {mapNodes} from './skills/professional-slides/runtime/maps.mjs';
const frame={x:60,y:140,width:1160,height:470};
const nodes=mapNodes({id:'europe-map',frame,props:{geography:'Europe',markers:[
  {country:'GBR',label:'United Kingdom',fraction:1},
  {x:0.7,y:0.55,label:'Priority cluster',fraction:0.5}
]}});
assert.equal(nodes.filter(node=>node.role==='map-marker').length,2);
assert.equal(nodes.filter(node=>node.role==='map-marker-fill').length,2);
assert.deepEqual(nodes.filter(node=>node.role==='map-label').map(node=>node.text),['United Kingdom','Priority cluster']);
assert.ok(nodes.filter(node=>node.role==='map-marker').every(node=>node.data.geography==='europe'));
assert.throws(()=>mapNodes({id:'bad',frame,props:{geography:'Europe',markers:[{country:'USA'}]}}),/outside europe/);
assert.throws(()=>mapNodes({id:'bad',frame,props:{geography:'Europe',markers:[{x:2,y:0.5}]}}),/unit x and y/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])


class MarkerTests(unittest.TestCase):
    def test_custom_markers_resolve_feature_ids_without_country_aliases(self):
        """PR #4 review: a custom geography's markers fell back to country aliases."""
        result = run_node('''
import assert from 'node:assert/strict';
import {mapNodes,CHOROPLETH_MAP_SAMPLE} from './skills/professional-slides/runtime/maps.mjs';
const geography=structuredClone(CHOROPLETH_MAP_SAMPLE.geography), frame={x:60,y:140,width:600,height:400};
const render=country=>mapNodes({id:'map',frame,props:{geography,markers:[{country,label:'Location'}]}});
for(const id of ['west','east']) assert.equal(render(id).filter(n=>n.role==='map-marker').length,1);
assert.throws(()=>render('USA'),/outside custom/);
delete geography.geojson.features[0].properties.labelPoint;
assert.throws(()=>render('west'),/no visible label point/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_map_crops_and_invalid_fraction_rejection(self):
        """Review regression: Fiji cropped to the antimeridian, and an invalid marker fraction was drawn."""
        run_node("""
import assert from 'node:assert/strict';
import {resolveGeography,mapNodes} from './skills/professional-slides/runtime/maps.mjs';
const fiji=resolveGeography('country:FJI');
assert.ok(fiji.bounds[2]-fiji.bounds[0]<10);
const frame={x:40,y:40,width:600,height:360};
assert.ok(mapNodes({id:'fiji',frame,props:{geography:'country:FJI',markers:[{country:'FJI',fraction:.5}]}}).some(n=>n.role==='map-marker-fill'));
for(const fraction of ['bad',NaN,Infinity,-.1,1.1,null]) assert.throws(()=>mapNodes({id:'bad',frame,props:{markers:[{x:.5,y:.5,fraction}]}}),/fraction/);
console.log(JSON.stringify({accepted:true}));
""")


class CustomGeographyTests(unittest.TestCase):
    def test_custom_polygons_accept_altitude_and_preserve_holes(self):
        """Variant review: custom polygons with altitude were refused, holes were filled and the input was mutated."""
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


class CityCropTests(unittest.TestCase):
    def test_a_city_network_is_cropped_to_its_markers_not_to_a_degree_around_them(self):
        """A run's ten Manhattan buildings drew as a cluster at the foot of the whole island: the crop's floor was a degree."""
        result = run_node("""
import {mapNodes} from './skills/professional-slides/runtime/maps.mjs';
// A city 0.12 by 0.25 degrees, split into a north and a south district.
const ring=(w,s,e,n)=>[[w,s],[e,s],[e,n],[w,n],[w,s]];
const feature=(id,box)=>({type:'Feature',id,properties:{name:id,labelPoint:[(box[0]+box[2])/2,(box[1]+box[3])/2]},geometry:{type:'Polygon',coordinates:[ring(...box)]}});
const geography={id:'city',title:'City',source:{url:'https://example.com/city',license:'Test',sha256:'a'.repeat(64)},
  geojson:{type:'FeatureCollection',features:[feature('north',[-74.02,40.80,-73.90,40.95]),feature('south',[-74.02,40.70,-73.90,40.80])]}};
const markers=[{label:'One',longitude:-74.00,latitude:40.71},{label:'Two',longitude:-73.98,latitude:40.75},{label:'Three',longitude:-73.97,latitude:40.74}];
const frame={x:0,y:0,width:900,height:440};
const south=(props)=>mapNodes({id:'m',frame,props:{geography,markers,...props}}).filter(n=>n.role==='map-land'&&n.id.includes('south'))[0].frame.height;
console.log(JSON.stringify({fit:south({crop:'fit'}),whole:south({})}));
""")
        # Fitted to the three buildings, the district they stand in is drawn larger than it is on the whole city.
        self.assertGreater(result["fit"], 1.3 * result["whole"])


class GeographyImportTests(unittest.TestCase):
    def test_geography_cli_preserves_exact_source_and_existing_files(self):
        """Variant review: the geography importer rewrote its source bytes and overwrote existing files."""
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


class RouteMapTests(unittest.TestCase):
    def test_cities_routes_and_crop(self):
        """62-page deck: 34px discs on country centres with twelve countries filled, and no routes."""
        result = run_node('''
import { mapNodes } from './skills/professional-slides/runtime/maps.mjs';
const frame = { x: 0, y: 0, width: 800, height: 450 };
const markers = [{ id: 'ruh', label: 'Riyadh', longitude: 46.7, latitude: 24.7, hub: true }, { id: 'lhr', label: 'London', longitude: -0.45, latitude: 51.5 }, { id: 'bom', label: 'Mumbai', longitude: 72.9, latitude: 19.1 }];
const nodes = mapNodes({ id: 'm', frame, props: { geography: 'world', crop: 'fit', markers, routes: [{ from: 'ruh', to: 'lhr' }, { from: 'ruh', to: 'bom', status: 'planned' }] } });
let refused = null;
try { mapNodes({ id: 'm', frame, props: { geography: 'world', markers: [{ country: 'IND', label: 'Mumbai' }] } }); } catch (e) { refused = e.message; }
const dot = nodes.find(n => n.role === 'map-marker' && !n.data.hub);
const routes = nodes.filter(n => n.role === 'map-route');
const land = nodes.filter(n => n.role === 'map-land');
console.log(JSON.stringify({ dot: dot.frame.width, routes: routes.length, dashes: routes[1].data.paths.length, solid: routes[0].data.paths.length,
  land: land.length, refused, labels: nodes.filter(n => n.role === 'map-label').length }));
''')
        self.assertEqual(result['dot'], 10)
        self.assertEqual(result['routes'], 2)
        self.assertEqual(result['solid'], 1)
        self.assertGreater(result['dashes'], 4)
        self.assertLess(result['land'], 120)  # cropped to the network, not every country
        self.assertIn('longitude and latitude', result['refused'])
        self.assertEqual(result['labels'], 3)


class SizeLegendTests(unittest.TestCase):
    def test_valued_markers_need_a_legend_and_it_scales_by_area(self):
        """62-page deck: valued markers carried no size key, and diameter scaled by value rather than area."""
        result = run_node('''
import { mapNodes, valueDiameter } from './skills/professional-slides/runtime/maps.mjs';
const frame = { x: 0, y: 0, width: 800, height: 450 };
const markers = [{ id: 'a', label: 'Riyadh', longitude: 46.7, latitude: 24.7, hub: true }, { id: 'b', label: 'Shanghai', longitude: 121.5, latitude: 31.2, value: 25 }, { id: 'c', label: 'Warsaw', longitude: 21, latitude: 52.2, value: 2 }];
let refused = null; try { mapNodes({ id: 'm', frame, props: { geography: 'world', crop: 'fit', markers } }); } catch (e) { refused = e.message; }
const out = {};
for (const style of ['row', 'stacked']) out[style] = mapNodes({ id: 'm', frame, props: { geography: 'world', crop: 'fit', markers, sizeLegend: { label: 'City population, m', style } } }).filter(n => n.role === 'map-size-legend-circle').length;
console.log(JSON.stringify({ refused, ratio: (valueDiameter(25, 25) / valueDiameter(6.25, 25)), ...out }));
''')
        self.assertIn('sizeLegend.label', result['refused'])
        self.assertAlmostEqual(result['ratio'], 2.0, places=3)  # a quarter of the value, half the diameter
        self.assertGreaterEqual(result['row'], 2)
        self.assertEqual(result['row'], result['stacked'])


if __name__ == "__main__":
    unittest.main()
