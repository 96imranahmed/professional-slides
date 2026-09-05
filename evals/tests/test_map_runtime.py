import unittest

from test_source_structure import run_node


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
assert.ok(highlighted.filter(node=>!node.data.highlighted).every(node=>node.style.fill.tokenId==='color.surfaceMuted'));
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

    def test_html_and_powerpoint_adapters_preserve_native_country_geometry(self):
        result = run_node("""
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {renderSlideHtml} from './skills/professional-slides/runtime/adapters/html.mjs';
import {writePptx} from './skills/professional-slides/runtime/adapters/pptxgenjs.mjs';
const frame={x:60,y:140,width:1160,height:470};
const deck=compileDeck({slides:[{id:'usa-map',composition:component({id:'map',component:'map',frame,props:{geography:'USA',markers:[],highlightCountries:['USA']}})}]},REGISTRY);
const html=renderSlideHtml(deck.slides[0]);
assert.match(html,/<path[^>]*data-role="map-land"/);
assert.ok(!html.includes('<img'));
const require=createRequire(import.meta.url),JSZip=require(require.resolve('jszip',{paths:[process.env.RUNTIME_NODE_MODULES]}));
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ps-map-test-'));
try {
  const file=path.join(directory,'map.pptx');
  await writePptx(deck,file);
  const zip=await JSZip.loadAsync(await fs.readFile(file));
  const xml=await zip.file('ppt/slides/slide1.xml').async('string');
  assert.ok(xml.includes('<a:custGeom>'));
  assert.ok(xml.includes('ps:usa-map-map:land:usa'));
  assert.ok(!xml.includes('<p:pic>'));
} finally { await fs.rm(directory,{recursive:true,force:true}); }
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_map_documentation_records_source_scale_aliases_and_analysis_caveats(self):
        result = run_node("""
import assert from 'node:assert/strict';
import fs from 'node:fs';
const docs=fs.readFileSync('./skills/professional-slides/references/components/maps.md','utf8');
for(const term of ['Natural Earth','1:110m','1:50m','Bahrain','public domain','US, USA','MENA','APAC','EMEA','country:ISO','analytical taxonomies','editable native']) assert.ok(docs.includes(term),term);
const importer=fs.readFileSync('./evals/scripts/import_natural_earth_maps.mjs','utf8');
assert.ok(importer.includes('sha256'));
assert.ok(importer.includes('ca96624a56bd078437bca8184e78163e5039ad19'));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])


if __name__ == "__main__":
    unittest.main()
