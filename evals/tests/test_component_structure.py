"""Component structure and geometry probes against the live runtime.

Every test here compiles or renders real components and asserts on measured
frames, token bindings and rejection behaviour. The assertions about markdown,
prompts, package.json scripts and repository ownership that used to live here
were deleted in the verification revamp (item 16): they compared the system to
its own prose.
"""

import json
import re
import unittest
from pathlib import Path

from node_probe import NODE, REFERENCES, ROOT, RUNTIME, SKILL, read, run_node


class ComponentStructureTests(unittest.TestCase):
    def test_icon_markers_render_vectors_and_reject_unknown_names(self):
        result = run_node("""
import { iconMarker } from './skills/professional-slides/runtime/marks.mjs';
const props = {id:'icon',x:0,y:0,size:32,icon:'people'};
const glyph=iconMarker(props).find(n=>n.role==='icon-glyph');
let error=null;
try { iconMarker({...props,icon:'made-up-icon'}); } catch(e) { error=e.message; }
console.log(JSON.stringify({geometry:glyph.data.geometry,paths:glyph.data.paths.length,error}));
""")
        self.assertEqual(result['geometry'], 'iconPath')
        self.assertGreater(result['paths'], 0)
        self.assertIn('Unknown icon: made-up-icon', result['error'])

    def test_process_headings_are_authored_and_absent_headings_release_space(self):
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const frame={x:0,y:0,width:1000,height:320};
const render=items=>REGISTRY.get('chevron-process').render({id:'probe',frame,props:{items}}).nodes;
const items=[{label:'Supply',details:['Eligible artifacts']},{label:'Use',details:['Accepted requests']}];
const plain=render(items),dated=render(items.map((v,i)=>({...v,...(i===0?{heading:'September 2026'}:{})})));
const role=(nodes,r)=>nodes.filter(n=>n.role===r);
console.log(JSON.stringify({plainHeadings:role(plain,'process-heading'),datedHeadings:role(dated,'process-heading').map(n=>n.text),plainBands:role(plain,'process-band').map(n=>n.frame.y),datedBands:role(dated,'process-band').map(n=>n.frame.y),labels:role(plain,'process-label').map(n=>n.text)}));
""")
        self.assertEqual(result['plainHeadings'], [])
        self.assertEqual(result['datedHeadings'], ['September 2026'])
        self.assertEqual(result['plainBands'], [0, 0])
        self.assertEqual(result['datedBands'], [42, 42])
        self.assertEqual(result['labels'], ['Supply', 'Use'])

    def test_runtime_registry_fixtures_and_token_provenance_compile(self):
        result = run_node(
            """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { CHART_IDS } from './skills/professional-slides/runtime/charts.mjs';
import { buildFixtureDeck } from './skills/professional-slides/runtime/fixtures.mjs';
const { deck, fixtures } = buildFixtureDeck();
const visual = new Set(['fill','stroke','color','fontFamily','fontSize','lineWidth','radius']);
const missing = deck.slides.flatMap(slide => slide.nodes.flatMap(node => Object.entries(node.style || {})
  .filter(([key, value]) => visual.has(key) && value !== null && value !== 'none' && (!value || !value.tokenId || value.value === undefined))
  .map(([key]) => `${slide.id}:${node.id}:${key}`)));
console.log(JSON.stringify({
  registry: REGISTRY.size,
  components: [...REGISTRY.values()].filter(item => item.category !== 'chart').length,
  charts: CHART_IDS.length,
  fixtures: fixtures.length,
  layoutFixtures: fixtures.filter(item => item.kind === 'layout').length,
  componentBoards: fixtures.filter(item => item.kind === 'board').length,
  componentCoverage: fixtures.flatMap(item => item.coverage || []).length,
  expectedCoverage: [...REGISTRY.values()].reduce((sum, definition) => sum + (Object.keys(definition.variants || {}).length || 1), 0),
  slideCount: deck.slides.length,
  nodeCount: deck.slides.reduce((sum, slide) => sum + slide.nodes.length, 0),
  missing
}));
"""
        )
        # Ten figure families added from the corpus style inventory
        # (evals/corpus/styles): stat-list, flow, spectrum, layers, placement,
        # rank-flow, sankey, pictogram, arrow-rows and capsules.
        self.assertEqual(result["registry"], 99)
        self.assertEqual(result["components"], 73)
        self.assertEqual(result["charts"], 26)
        self.assertEqual(result["layoutFixtures"], 76)
        self.assertGreater(result["componentBoards"], 0)
        self.assertEqual(result["componentCoverage"], result["expectedCoverage"])
        self.assertEqual(result["slideCount"], result["fixtures"])
        self.assertLess(result["fixtures"], result["componentCoverage"] + result["layoutFixtures"])
        self.assertGreater(result["nodeCount"], 800)
        self.assertEqual(result["missing"], [])

    def test_golden_fixtures_cover_source_families_without_raster_or_fixed_page_taxonomy(self):
        result = run_node(
            """
import { buildGoldenDeck } from './skills/professional-slides/runtime/golden-fixtures.mjs';
const { deck, fixtures } = buildGoldenDeck();
const analytical = fixtures.filter(item => !['cover','section-divider'].includes(item.visualFamily));
const chrome = analytical.map(item => {
  const slide = deck.slides[item.slide - 1];
  const title = slide.nodes.find(node => node.role === 'title-rule');
  const text = slide.nodes.find(node => node.role === 'action-title');
  const footer = slide.nodes.find(node => node.role === 'footer-rule');
  return {title: title?.frame, textBottom: text.frame.y + text.data.textLayout.height, footer: footer?.frame};
});
console.log(JSON.stringify({
  slides: deck.slides.length,
  nodes: deck.slides.reduce((sum, slide) => sum + slide.nodes.length, 0),
  families: new Set(fixtures.map(item => item.visualFamily)).size,
  sources: fixtures.map(item => item.sourceSlide).filter(value => value !== null),
  allCapabilities: fixtures.every(item => item.capabilities.length > 0),
  imageNodes: deck.slides.flatMap(slide => slide.nodes).filter(node => node.type === 'image').length,
  fixedTaxonomy: JSON.stringify({deck, fixtures}).toLowerCase().includes('archetype'),
  chrome
}));
"""
        )
        self.assertEqual(result["slides"], 18)
        self.assertGreater(result["nodes"], 700)
        self.assertEqual(result["families"], 18)
        self.assertEqual(len(result["sources"]), len(set(result["sources"])))
        self.assertTrue(result["allCapabilities"])
        self.assertEqual(result["imageNodes"], 0)
        self.assertFalse(result["fixedTaxonomy"])
        for chrome in result["chrome"]:
            # The rule is anchored to the content, not hung under the title: a
            # fixed gap above the body, so the distance from rule to content
            # reads the same whether the title took one line or two. It never
            # rises above where the title leaves it.
            self.assertEqual(chrome["title"]["x"], 60)
            self.assertEqual(chrome["title"]["width"], 1160)
            self.assertGreaterEqual(chrome["title"]["y"], chrome["textBottom"] + 8)
            # y 680 -> 674: the footer band now keeps a third of the page's side
            # margin (FOOTER_EDGE_MARGIN_RATIO, 20px of 60) clear of the bottom
            # edge instead of the 14px CHROME.footerTop happened to leave, and
            # the rule rides with the row it closes. The band lifts as a whole,
            # so its distance to the footer text is unchanged, and the lift
            # comes out of the footer's own clearance: the content frame is the
            # same height it was.
            self.assertEqual(chrome["footer"], {"x": 60, "y": 674, "width": 1160, "height": 0})

    def test_cover_is_dark_by_default_with_a_lower_third_title_block(self):
        result = run_node("""
import assert from 'node:assert/strict';
import { compileDeck, component, TOKENS } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const frame = {x:0,y:0,width:1280,height:720};
const compile = (props, options={}) => compileDeck({...options,slides:[{id:'cover-test',frame,composition:component({id:'cover',component:'cover',frame,props})}]},REGISTRY);
// Default: dark full bleed, accent rule, title, subtitle, date; block bottom at 78% of the page.
const dark = compile({title:'Growth strategy',subtitle:'Priorities for the next planning cycle',date:'September 2026',logo:'Acme'});
const roles = dark.slides[0].nodes.map(n=>n.role);
assert.deepEqual(roles, ['cover-surface','cover-accent','cover-logo','cover-title','cover-subtitle','cover-date']);
const by = role => dark.slides[0].nodes.find(n=>n.role===role);
assert.equal(by('cover-surface').style.fill.tokenId,'color.ink');
assert.equal(by('cover-title').style.color.tokenId,'color.onPrimary');
assert.equal(by('cover-title').style.fontFamily.tokenId,'font.display');
assert.equal(by('cover-title').style.fontSize.tokenId,'type.deckTitle');
assert.equal(by('cover-subtitle').style.fontSize.tokenId,'type.heading');
assert.equal(by('cover-title').frame.x,60);
assert.equal(by('cover-logo').frame.y,44);
const date = by('cover-date');
assert.ok(Math.abs(date.frame.y+date.frame.height-720*0.78)<0.01,'block bottom anchors at 78%');
assert.equal(by('cover-subtitle').frame.y-by('cover-title').frame.y-by('cover-title').frame.height,TOKENS['space.5'].value);
// Light tone keeps ink on canvas with no surface.
const light = compile({title:'Growth strategy',subtitle:'Commercial priorities',variant:'plain'});
assert.deepEqual(light.slides[0].nodes.map(n=>n.role),['cover-accent','cover-title','cover-subtitle']);
assert.equal(light.slides[0].nodes[1].style.color.tokenId,'color.ink');
for (const subtitleValue of [undefined,'','   ']) assert.equal(compile({title:'Growth strategy',subtitle:subtitleValue}).slides[0].nodes.length,3);
const company = compile({title:'Growth strategy',subtitle:'Commercial priorities'},{palette:'bain',typography:{body:'Arial',display:'Georgia'}});
assert.equal(company.slides[0].nodes.find(n=>n.role==='cover-title').style.fontFamily.value,'Georgia');
assert.equal(company.slides[0].nodes.find(n=>n.role==='cover-subtitle').style.fontFamily.value,'Arial');
const wrapped = compile({title:'Growth strategy\\nfor the next cycle',subtitle:'Commercial priorities\\nand delivery milestones'});
assert.deepEqual(wrapped.slides[0].nodes.filter(n=>n.type==='text').map(n=>n.data.textLayout.lines.length),[2,2]);
for (const props of [{title:''},{title:42},{title:'A',subtitle:42},{title:'A',badge:'Extra label'},{title:'A\\nB\\nC\\nD'},{title:'A',subtitle:'B\\nC\\nD'}]) assert.throws(()=>compile(props));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_plain_cover_is_golden_but_not_an_obsolete_artwork_fidelity_target(self):
        result = run_node("""
import { buildGoldenDeck } from './skills/professional-slides/runtime/golden-fixtures.mjs';
const full = buildGoldenDeck(), reference = buildGoldenDeck({referenceOnly:true});
console.log(JSON.stringify({golden:full.fixtures.length, reference:reference.fixtures.length,
  cover:full.fixtures.find(f=>f.visualFamily==='cover'), sources:reference.fixtures.map(f=>f.sourceSlide),
  referenceFamilies:reference.fixtures.map(f=>f.visualFamily)}));
""")
        self.assertEqual(result["golden"], 18)
        self.assertEqual(result["reference"], 16)
        self.assertIsNone(result["cover"]["sourceSlide"])
        self.assertNotIn("cover", result["referenceFamilies"])
        self.assertNotIn("section-divider", result["referenceFamilies"])
        self.assertTrue(all(isinstance(value, int) for value in result["sources"]))

    def test_planner_selects_relationships_and_rejects_unprepared_content(self):
        result = run_node(
            """
import { planSlide } from './skills/professional-slides/runtime/planner.mjs';
const item = index => ({ id: `item-${index}`, job: `job ${index}`, component: 'paragraph', props: { text: `Point ${index}` } });
const layout = count => planSlide({ id: `slide-${count}`, title: 'The evidence supports action', items: Array.from({length: count}, (_, index) => item(index)) }).decision.layout;
const sequence = planSlide({ id: 'sequence', title: 'The work advances in order', items: [0,1,2].map(index => ({...item(index), relationship: 'sequence'})) }).decision.layout;
const overlay = planSlide({ id: 'overlay', title: 'The annotation explains the exhibit', items: [{...item(0), relationship: 'layer'}] }).decision.layout;
const absolute = planSlide({ id: 'absolute', title: 'The geometry carries the meaning', items: [{...item(0), frame: {x: 0, y: 0, width: 100, height: 100}}] }).decision.layout;
const split = planSlide({id:'split',title:'Examples clarify where the approach applies',layout:'section-split-50-50',items:[
 {id:'frame',job:'frame the question',items:[item(0)]},
 {id:'examples',job:'develop related examples',items:[item(1)]}
]});
let genericLabelRejected = false;
let genericSectionHeadingRejected = false;
try { planSlide({ id: 'bad-label', title: 'A title', items: [{...item(0), props: {title: 'Insight', text: 'Value'}}] }); } catch { genericLabelRejected = true; }
try { planSlide({ id: 'bad-heading', title: 'A title', items: [{...item(0), heading: 'Implication'}] }); } catch { genericSectionHeadingRejected = true; }
let invalidSplitRejected=false;try{planSlide({id:'bad-split',title:'A title',layout:'section-split-50-50',items:[item(0),item(1)]});}catch{invalidSplitRejected=true;}
console.log(JSON.stringify({one: layout(1), two: layout(2), four: layout(4), sequence, overlay, absolute, split:split.decision.layout,splitTreatments:split.spec.composition.children.map(child=>[child.treatment,child.edge,child.size.width.fr]),invalidSplitRejected,genericLabelRejected, genericSectionHeadingRejected}));
"""
        )
        self.assertEqual(result["one"], "flow.column")
        self.assertEqual(result["two"], "flow.row")
        self.assertEqual(result["four"], "grid")
        self.assertEqual(result["sequence"], "flow.row")
        self.assertEqual(result["overlay"], "overlay")
        self.assertEqual(result["absolute"], "absolute")
        self.assertEqual(result["split"], "section-split-50-50")
        self.assertEqual(result["splitTreatments"], [["open", "full-bleed", 1], ["muted", "full-bleed", 1]])
        self.assertTrue(result["invalidSplitRejected"])
        self.assertFalse(result["genericLabelRejected"])
        self.assertFalse(result["genericSectionHeadingRejected"])

    def test_preprocessor_resolves_all_size_modes_and_rejects_overflow(self):
        result = run_node(
            """
import { component, flow, absolute, grid, resolveLayout, section } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const sized = flow({id: 'sized', direction: 'row', gap: 16, children: [
  component({id: 'fixed', component: 'metric', size: {width: 100, height: 'fill'}}),
  component({id: 'hug', component: 'panel', size: {width: 'hug', height: 'fill'}}),
  component({id: 'percent', component: 'paragraph', size: {width: {percent: 0.2}, height: 'fill'}}),
  component({id: 'fraction', component: 'metric', size: {width: {fr: 1}, height: 'fill'}})
]});
const placements = resolveLayout(sized, {x: 0, y: 0, width: 1000, height: 300}, REGISTRY);
const nested = flow({id: 'outer', direction: 'row', gap: 16, children: [
  flow({id: 'intrinsic', direction: 'row', gap: 16, size: {width: 'hug', height: 'fill'}, children: [
    component({id: 'a', component: 'metric'}), component({id: 'b', component: 'metric'})
  ]}),
  component({id: 'remainder', component: 'paragraph', size: {width: 'fill', height: 'fill'}})
]});
const nestedPlacements = resolveLayout(nested, {x: 0, y: 0, width: 900, height: 300}, REGISTRY);
const sectionRoot = flow({id: 'section-row', direction: 'row', children: [section({id: 'section', heading: 'Constraint', size: {width: 'hug', height: 'fill'}, children: [component({id: 'copy', component: 'paragraph'})]}), component({id: 'rest', component: 'paragraph', size: {width: 'fill', height: 'fill'}})]});
const sectionPlacements = resolveLayout(sectionRoot, {x: 0, y: 0, width: 900, height: 300}, REGISTRY);
const gridRoot = flow({id: 'grid-row', direction: 'row', children: [grid({id: 'intrinsic-grid', columns:['hug','hug'], rows:['hug'], size:{width:'hug',height:'fill'}, children:[component({id:'grid-panel',component:'panel',cell:{column:0,row:0}}),component({id:'grid-metric',component:'metric',cell:{column:1,row:0}})]}), component({id:'grid-rest',component:'paragraph',size:{width:'fill',height:'fill'}})]});
const gridPlacements = resolveLayout(gridRoot, {x:0,y:0,width:900,height:300}, REGISTRY);
let overflowRejected = false;
let absoluteOverflowRejected = false;
let invalidSpanRejected = false;
try { resolveLayout(flow({id: 'overflow', children: [component({id: 'a', component: 'metric', size: {width: 600}}), component({id: 'b', component: 'metric', size: {width: 600}})]}), {x:0,y:0,width:1000,height:300}, REGISTRY); } catch { overflowRejected = true; }
try { resolveLayout(absolute({id: 'absolute', children: [component({id: 'a', component: 'metric', frame: {x:900,y:0,width:200,height:100}})]}), {x:0,y:0,width:1000,height:300}, REGISTRY); } catch { absoluteOverflowRejected = true; }
try { resolveLayout(grid({id: 'grid', columns:[{fr:1}], rows:[{fr:1}], children:[component({id:'a',component:'metric',cell:{column:0,row:0,columnSpan:2}})]}), {x:0,y:0,width:1000,height:300}, REGISTRY); } catch { invalidSpanRejected = true; }
console.log(JSON.stringify({
  widths: Object.fromEntries(placements.map(item => [item.node.id, item.frame.width])),
  widthTotal: placements.reduce((sum, item) => sum + item.frame.width, 0) + 48,
  nestedFirst: nestedPlacements.find(item => item.node.id === 'a').frame.width + nestedPlacements.find(item => item.node.id === 'b').frame.width + 16,
  sectionWidth: sectionPlacements.find(item => item.node.id === 'section').frame.width,
  gridWidth: gridPlacements.find(item => item.node.id === 'grid-panel').frame.width + gridPlacements.find(item => item.node.id === 'grid-metric').frame.width + 16,
  overflowRejected, absoluteOverflowRejected, invalidSpanRejected
}));
"""
        )
        self.assertAlmostEqual(result["widths"]["fixed"], 100)
        self.assertAlmostEqual(result["widths"]["hug"], 400)
        self.assertAlmostEqual(result["widths"]["percent"], 190.4)
        self.assertAlmostEqual(result["widths"]["fraction"], 261.6)
        self.assertAlmostEqual(result["widthTotal"], 1000)
        self.assertAlmostEqual(result["nestedFirst"], 496)
        # An "open" section carries no padding, so a hugging section is exactly
        # as wide as the paragraph it holds (520), not 520 + 2 x space.4.
        self.assertAlmostEqual(result["sectionWidth"], 520)
        self.assertAlmostEqual(result["gridWidth"], 656)
        self.assertTrue(result["overflowRejected"])
        self.assertTrue(result["absoluteOverflowRejected"])
        self.assertTrue(result["invalidSpanRejected"])

    def test_multiseries_analytical_charts_use_horizontal_top_legends(self):
        result = run_node(
            """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const frame = {x: 0, y: 0, width: 760, height: 420};
const ids = ['chart.column','chart.bar','chart.stacked-column','chart.stacked-bar','chart.line','chart.area','chart.combo'];
const props = {
  categories: ['A','B','C'],
  series: [{name: 'Actual', values: [2,3,5]}, {name: 'Plan', values: [3,4,6]}],
  annotations: [],
  highlights: [],
  referenceLines: []
};
const results = ids.map(id => {
  const nodes = REGISTRY.get(id).render({id, frame, props}).nodes;
  const swatches = nodes.filter(node => node.role === 'legend-swatch');
  const labels = nodes.filter(node => node.role === 'legend-label');
  const plotNodes = nodes.filter(node => ['chart-gridline','chart-mark','chart-line'].includes(node.role));
  const legendRows = new Set(swatches.map(node => Math.round(node.frame.y)));
  const top = Math.min(...swatches.map(node => node.frame.y));
  const plotTop = Math.min(...plotNodes.map(node => node.frame.y));
  const right = Math.max(...labels.map(node => node.frame.x + node.frame.width));
  return {id, swatches: swatches.length, labels: labels.length, rows: legendRows.size, top, plotTop, right};
});
const donut = REGISTRY.get('chart.donut').render({id: 'donut', frame, props: {labels: ['Category 1','Category 2','Category 3'], values: [40,35,25]}}).nodes;
const donutSwatches = donut.filter(node => node.role === 'legend-swatch');
const donutSegments = donut.filter(node => node.role === 'chart-segment');
console.log(JSON.stringify({
  results,
  donutLegend: {
    rows: new Set(donutSwatches.map(node => Math.round(node.frame.y))).size,
    types: [...new Set(donutSwatches.map(node => node.type))],
    left: Math.min(...donutSwatches.map(node => node.frame.x)),
    right: Math.max(...donut.filter(node => node.role === 'legend-label').map(node => node.frame.x + node.frame.width)),
    top: Math.min(...donutSwatches.map(node => node.frame.y)),
    chartTop: Math.min(...donutSegments.map(node => node.frame.y))
  }
}));
"""
        )
        for chart in result["results"]:
            self.assertEqual(chart["swatches"], 2, chart["id"])
            self.assertEqual(chart["labels"], 2, chart["id"])
            self.assertEqual(chart["rows"], 1, chart["id"])
            self.assertLess(chart["top"], chart["plotTop"], chart["id"])
            self.assertAlmostEqual(chart["right"], 744, places=3, msg=chart["id"])
        self.assertEqual(result["donutLegend"]["rows"], 1)
        self.assertEqual(result["donutLegend"]["types"], ["rect"])
        self.assertGreater(result["donutLegend"]["left"], 340)
        self.assertAlmostEqual(result["donutLegend"]["right"], 744)
        self.assertLess(result["donutLegend"]["top"], result["donutLegend"]["chartTop"])

    def test_title_variants_share_text_geometry_tokens_and_registry_contract(self):
        result = run_node(
            """
import assert from 'node:assert/strict';
import { REGISTRY, registryManifest } from './skills/professional-slides/runtime/registry.mjs';
import { compileDeck, component } from './skills/professional-slides/runtime/core.mjs';
import { componentFixtureSpecs, componentVariantFixtureSpecs } from './skills/professional-slides/runtime/fixtures.mjs';
const results = [];
for (const id of ['action-title','section-title','slide-chrome']) {
  const definition = REGISTRY.get(id), chrome = id === 'slide-chrome';
  const variantProp = chrome ? 'titleVariant' : 'variant', ruleProp = chrome ? 'titleRule' : 'rule';
  const frame = {x:0,y:0,...definition.preferredSize};
  const render = props => definition.render({id:'title',frame,props:{...definition.sample,...props}}).nodes;
  const withLine = render({[variantProp]:'with-line'}), withoutLine = render({[variantProp]:'without-line'});
  const title = withLine.find(n=>n.role==='action-title' || n.role==='section-title');
  assert.equal(title.style.lineHeight,title.data.textLayout.lineHeight);
  assert.equal(title.style.wrap,false);
  assert.deepEqual(render({}), withoutLine);
  assert.deepEqual(render({[ruleProp]:true}), withLine);
  assert.deepEqual(render({[ruleProp]:false}), withoutLine);
  const line = withLine.find(n=>n.role==='title-rule');
  // A standalone title hangs its rule 8px under the text. A chrome page moves it
  // to a fixed gap above the body instead, so the rule-to-content distance is
  // the same whether the title took one line or two - it used to be 52px and
  // 16px, the same band reading differently on every page.
  const gap = line.frame.y - title.frame.y - title.data.textLayout.height;
  if (id === 'slide-chrome') assert.ok(gap >= 8, `${id} rule sits at or below the title`);
  else assert.equal(gap, 8);
  const normalize = nodes => nodes.filter(n=>n.role!=='title-rule').map(({data,...node})=>node);
  assert.deepEqual(normalize(withLine), normalize(withoutLine));
  const spec = {id:'test',frame,composition:component({id:'title',component:id,props:{...definition.sample,[variantProp]:'without-line'},frame})};
  const deck = compileDeck({slides:[spec]}, REGISTRY);
  assert.equal(deck.manifest.slides[0].componentInstances[0].variant,'without-line');
  results.push({id,withLine:withLine.filter(n=>n.role==='title-rule').length,withoutLine:withoutLine.filter(n=>n.role==='title-rule').length});
}
const manifest = registryManifest().components.filter(c=>['action-title','section-title','slide-chrome'].includes(c.id));
const fixtures = [...componentFixtureSpecs(), ...componentVariantFixtureSpecs()].filter(c=>manifest.some(m=>m.id===c.target));
assert.deepEqual(fixtures.map(f=>`${f.target}:${f.variant}`).sort(), manifest.flatMap(c=>Object.keys(c.variants).map(v=>`${c.id}:${v}`)).sort());
console.log(JSON.stringify({results,variantCount:fixtures.length,defaults:manifest.map(c=>c.defaultVariant)}));
"""
        )
        for item in result["results"]:
            self.assertEqual(item["withLine"], 1)
            self.assertEqual(item["withoutLine"], 0)
        self.assertEqual(result["variantCount"], 6)
        self.assertEqual(result["defaults"], ["without-line"] * 3)

    def test_title_variant_planning_inheritance_chrome_and_invalid_inputs(self):
        result = run_node(
            """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { resolveTitleVariant, compileDeck, absolute } from './skills/professional-slides/runtime/core.mjs';
import { planDeck, validateSlidePlan } from './skills/professional-slides/runtime/planner.mjs';
for (const variant of ['unknown','',null,3,['with-line']]) assert.throws(()=>resolveTitleVariant({variant}), /Unknown title variant/);
for (const rule of ['false',null,0]) assert.throws(()=>resolveTitleVariant({rule}), /must be a boolean/);
assert.throws(()=>resolveTitleVariant({variant:'with-line',rule:false}), /conflicts/);
assert.throws(()=>resolveTitleVariant({variant:'without-line',rule:true}), /conflicts/);
assert.equal(resolveTitleVariant(),'without-line');
const titleDefinition = REGISTRY.get('action-title');
const multiline = titleDefinition.render({id:'wrapped',frame:{x:0,y:0,width:1000,height:128},props:{text:'Capacity limits growth\\nInvestment unlocks the next phase',variant:'without-line'}}).nodes[0];
assert.equal(multiline.data.textLayout.lines.length,2);
assert.equal(multiline.style.lineHeight,36);
const nearWidthLimit = REGISTRY.get('slide-chrome').render({id:'near-limit',frame:{x:0,y:0,width:1280,height:720},props:{title:'(Insert an action title stating the governing comparison)'}}).nodes.find(n=>n.role==='action-title');
assert.equal(nearWidthLimit.data.textLayout.lines.length,1);
assert.ok(nearWidthLimit.data.textLayout.width <= nearWidthLimit.frame.width);
assert.throws(()=>titleDefinition.render({id:'overflow',frame:{x:0,y:0,width:1000,height:20},props:{text:'Capacity limits growth'}}), /exceeds its allocated height/);
const plan = {id:'one',title:'Capacity limits growth',items:[{id:'copy',job:'Explain the constraint',component:'paragraph',props:{text:'Capacity limits growth'}}]};
assert.equal(planDeck({id:'default',slides:[plan]}).decisions[0].titleVariant,'house-style'); // the palette's style.titleRule decides
assert.throws(()=>validateSlidePlan({...plan,titleVariant:'unknown'}), /Unknown title variant/);
const {deck,decisions} = planDeck({id:'planned',titleVariant:'without-line',slides:[plan,{...plan,id:'two',titleVariant:'with-line'}]});
const counts = deck.slides.map(s=>s.nodes.filter(n=>n.role==='title-rule').length);
// Selecting the title variant must not move any body component.
assert.deepEqual(deck.slides[0].componentInstances.find(c=>c.id==='copy').frame,deck.slides[1].componentInstances.find(c=>c.id==='copy').frame);
const chrome = compileDeck({slides:[{id:'chrome',chrome:{title:'Capacity limits growth'},composition:absolute({id:'empty',children:[]})}]},REGISTRY);
const title = chrome.slides[0].nodes.find(n=>n.role==='action-title');
assert.equal(chrome.manifest.slides[0].componentInstances[0].variant,'without-line'); // default slide chrome stays open
assert.equal(chrome.manifest.slides[0].componentInstances[0].instanceId,title.data.componentInstance);
assert.ok(chrome.manifest.slides[0].componentInstances.every(instance=>typeof instance.instanceId==='string'&&instance.instanceId.length>0));
console.log(JSON.stringify({counts,decisions:decisions.map(d=>d.titleVariant),chromeRules:chrome.slides[0].nodes.filter(n=>n.role==='title-rule').length,footerRules:chrome.slides[0].nodes.filter(n=>n.role==='footer-rule').length,titleAnchor:[title.frame.x,title.frame.y]}));
"""
        )
        self.assertEqual(result["counts"], [0, 1])
        self.assertEqual(result["decisions"], ["without-line", "with-line"])
        self.assertEqual(result["chromeRules"], 0)  # default slide chrome stays open
        self.assertEqual(result["footerRules"], 0)
        self.assertEqual(result["titleAnchor"], [60, 44])

    def test_title_rule_follows_measured_text_not_allocated_box(self):
        result = run_node(
            """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const results = [];
for (const componentId of ['action-title','section-title']) {
  for (const text of ['Capacity limits growth','Capacity limits growth\\nInvest in delivery']) {
    const render = height => REGISTRY.get(componentId).render({id:'title',frame:{x:60,y:80,width:540,height},props:{text,variant:'with-line'}}).nodes;
    const nodes = render(140), enlarged = render(220);
    const title = nodes.find(n=>n.type==='text'), rule = nodes.find(n=>n.role==='title-rule');
    assert.equal(rule.frame.y,enlarged.find(n=>n.role==='title-rule').frame.y);
    assert.equal(rule.frame.y-title.frame.y-title.data.textLayout.height,8);
    assert.ok(rule.frame.y < 80+140);
    results.push(title.data.textLayout.lines.length);
  }
}
console.log(JSON.stringify(results));
"""
        )
        self.assertEqual(result, [1, 2, 1, 2])

    def test_section_heading_rejects_subtitle_at_every_entrypoint(self):
        result = run_node(
            """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { section, component, compileDeck } from './skills/professional-slides/runtime/core.mjs';
import { validateSlidePlan } from './skills/professional-slides/runtime/planner.mjs';
const errors = [];
const rejects = fn => { try { fn(); return false; } catch (error) { errors.push(error.message); return /do not support subtitle/.test(error.message); } };
const frame = {x:60,y:100,width:600,height:400};
const compile = composition => compileDeck({id:'test',slides:[{id:'one',frame,composition}]}, REGISTRY);
const leaf = {id:'copy',job:'Explain the constraint',component:'paragraph',props:{text:'Capacity limits growth'}};
const cases = [];
for (const subtitle of ['FY2026\\nActual', 'Other metadata', '', null, undefined]) {
  for (const componentId of ['section-heading', 'section', 'content-rail']) {
    // Reject even without heading text: no measurement or empty-render bypass.
    for (const heading of ['Description', undefined]) {
      const props = {heading,subtitle,items:['Capacity limits growth']};
      const definition = REGISTRY.get(componentId);
      cases.push(rejects(() => definition.render({id:'test',frame,props})));
      cases.push(rejects(() => definition.measureHeader({frame,props})));
      cases.push(rejects(() => compile(component({id:'test',component:componentId,props}))));
      cases.push(rejects(() => validateSlidePlan({id:'test',title:'Capacity limits growth',items:[{id:'test',job:'Group content',component:componentId,props}]})));
    }
  }
  cases.push(rejects(() => section({id:'group',subtitle})));
  cases.push(rejects(() => compile({...section({id:'group'}),subtitle})));
  cases.push(rejects(() => validateSlidePlan({id:'test',title:'Capacity limits growth',items:[{id:'group',job:'Group content',subtitle,items:[leaf]}]})));
}
console.log(JSON.stringify({total:cases.length,rejected:cases.filter(Boolean).length,errors}));
"""
        )
        self.assertEqual(result["total"], 135)
        self.assertEqual(result["rejected"], result["total"], result["errors"])

    def test_section_heading_has_only_full_width_text_and_optional_rule(self):
        result = run_node(
            """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { buildFixtureDeck } from './skills/professional-slides/runtime/fixtures.mjs';
const frame = {x:60,y:100,width:720,height:100};
const definition = REGISTRY.get('section-heading');
const render = rule => definition.render({id:'test',frame,props:{...definition.sample,rule}}).nodes;
const ruled = render(true), plain = render(false);
const deck = buildFixtureDeck().deck;
console.log(JSON.stringify({
  ruled:ruled.map(n=>n.role),plain:plain.map(n=>n.role),width:ruled[0].frame.width,
  subtitleNodes:deck.slides.flatMap(s=>s.nodes).filter(n=>n.role==='section-subtitle').length,
  cover:deck.slides.flatMap(s=>s.nodes).find(n=>n.role==='cover-subtitle')?.text
}));
"""
        )
        self.assertEqual(result["ruled"], ["section-heading", "section-heading-rule"])
        self.assertEqual(result["plain"], ["section-heading"])
        self.assertEqual(result["width"], 720)
        self.assertEqual(result["subtitleNodes"], 0)
        self.assertTrue(result["cover"])

    def test_chart_title_and_open_rail_share_one_heading_contract(self):
        result = run_node(
            """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const chart = REGISTRY.get('chart-title').render({
  id: 'chart-heading',
  frame: {x: 60, y: 188, width: 770, height: 76},
  props: {heading: 'Q2 2026 year-over-year Search growth', unit: '%'}
}).nodes;
// The row rule: the compiler hands every panel in a row the tallest header band,
// so the rules share one line. A ruled heading carries its unit inline - a
// second line under the heading would push its rule off the row's.
const band = REGISTRY.get('chart-title').measureHeader({frame: {x: 60, y: 188, width: 770, height: 76}, props: {heading: 'Q2 2026 year-over-year Search growth', unit: '%'}}).height;
const rail = REGISTRY.get('content-rail').render({
  id: 'takeaways',
  frame: {x: 840, y: 188, width: 380, height: 442},
  props: {heading: 'Key takeaways', treatment: 'open', dividerLeft: true, items: ['One', 'Two'], headerBandHeight: band}
}).nodes;
const select = nodes => ({
  heading: nodes.find(node => node.role === 'section-heading'),
  unit: nodes.find(node => node.role === 'chart-unit'),
  rule: nodes.find(node => node.role === 'section-heading-rule')
});
console.log(JSON.stringify({chart: select(chart), rail: select(rail)}));
"""
        )
        section = result["chart"]
        rail = result["rail"]
        self.assertAlmostEqual(section["heading"]["frame"]["y"], rail["heading"]["frame"]["y"], places=3, msg="both headings sit on the band's top line")
        self.assertAlmostEqual(section["heading"]["frame"]["y"], section["unit"]["frame"]["y"], delta=2, msg="a ruled heading carries its unit on the heading's line")
        self.assertGreater(section["unit"]["frame"]["x"], section["heading"]["frame"]["x"], "the unit follows the heading")
        self.assertLess(section["unit"]["frame"]["y"] + section["unit"]["frame"]["height"], rail["rule"]["frame"]["y"], "the heading band stays above the shared rule")
        self.assertEqual(section["heading"]["style"]["fontSize"], rail["heading"]["style"]["fontSize"])
        self.assertEqual(section["heading"]["style"]["color"], rail["heading"]["style"]["color"])
        self.assertEqual(section["rule"]["frame"]["y"], rail["rule"]["frame"]["y"])
        self.assertEqual(section["rule"]["style"]["stroke"], rail["rule"]["style"]["stroke"])

    def test_insight_rail_has_text_only_header_and_compact_content_driven_list(self):
        result = run_node(
            """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const frame = {x: 952, y: 184, width: 268, height: 420};
const props = {
  heading: 'Key takeaway',
  items: [
    'Short description and read-out takeaway',
    'Short description and read-out takeaway',
    'Short description and read-out takeaway'
  ]
};
const nodes = REGISTRY.get('content-rail').render({id: 'insight', frame, props}).nodes;
const items = nodes.filter(node => node.role === 'rail-item');
console.log(JSON.stringify({
  headingRules: nodes.filter(node => node.role === 'section-heading-rule').length,
  heading: nodes.find(node => node.role === 'section-heading'),
  itemYs: items.map(node => node.frame.y),
  itemHeights: items.map(node => node.frame.height),
  finalBottom: items.at(-1).frame.y + items.at(-1).frame.height,
  frameBottom: frame.y + frame.height
}));
"""
        )
        self.assertEqual(result["headingRules"], 0)
        self.assertEqual(result["heading"]["text"], "Key takeaway")
        self.assertEqual(result["itemHeights"], [40, 40, 40])
        self.assertEqual(
            [result["itemYs"][index + 1] - result["itemYs"][index] for index in range(2)],
            [52, 52],
        )
        self.assertGreater(result["frameBottom"] - result["finalBottom"], 100)

    def test_wrapped_headings_share_top_line_and_one_rule(self):
        result = run_node("""
import { buildFixtureDeck } from './skills/professional-slides/runtime/fixtures.mjs';
const slide = buildFixtureDeck().deck.slides.find(s => s.id === 'fixture-layout-wrapped-headings');
const headings = slide.nodes.filter(n => n.role === 'section-heading');
const rules = slide.nodes.filter(n => n.role === 'section-heading-rule');
console.log(JSON.stringify({counts: headings.map(n => n.data.textLayout.lines.length), tops: headings.map(n => n.frame.y), ruleYs: rules.map(n => n.frame.y), gaps: headings.map((n,i) => rules[i].frame.y-n.frame.y-n.frame.height), sizes: headings.map(n => n.style.fontSize.value), wraps: headings.map(n => n.style.wrap)}));
""")
        self.assertEqual(result["counts"], [1, 2, 3])
        # Row rule: every heading starts on the band's top line and every rule sits on one shared line.
        self.assertEqual(len(set(result["tops"])), 1)
        self.assertEqual(len(set(result["ruleYs"])), 1)
        self.assertEqual(result["gaps"][2], 4)
        self.assertTrue(all(gap >= 4 for gap in result["gaps"]))
        self.assertEqual(result["sizes"], [14, 14, 14])
        self.assertEqual(result["wraps"], [False, False, False])

    def test_reference_chart_and_open_rail_headers_remain_peers(self):
        result = run_node("""
import { buildGoldenDeck } from './skills/professional-slides/runtime/golden-fixtures.mjs';
const { deck } = buildGoldenDeck();
const peers = deck.slides.filter(s => s.componentInstances.some(c => c.component === 'content-rail') && s.nodes.filter(n => n.role === 'section-heading-rule').length === 2);
console.log(JSON.stringify(peers.map(s => ({id:s.id,ruleYs:[...new Set(s.nodes.filter(n=>n.role==='section-heading-rule').map(n=>n.frame.y))]}))));
""")
        self.assertEqual(len(result), 4)
        for slide in result:
            self.assertEqual(len(slide["ruleYs"]), 1, slide["id"])

    def test_unbreakable_heading_and_insufficient_annotation_space_reject(self):
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
let heading=false, chart=false;
try { REGISTRY.get('section-heading').render({id:'heading',frame:{x:0,y:0,width:30,height:52},props:{heading:'Unbreakable'}}); } catch {heading=true;}
try { REGISTRY.get('chart.column').render({id:'chart',frame:{x:0,y:0,width:500,height:180},props:REGISTRY.get('chart.column').sample}); } catch {chart=true;}
console.log(JSON.stringify({heading,chart}));
""")
        self.assertEqual(result, {"heading": True, "chart": True})

    def test_part_to_whole_labels_and_legends_share_segment_order(self):
        result = run_node(
            """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const props = {labels: ['Core', 'Growth', 'New'], values: [52, 31, 17]};
const nodes = REGISTRY.get('chart.donut').render({
  id: 'donut', frame: {x: 0, y: 0, width: 760, height: 420}, props
}).nodes;
const segments = nodes.filter(node => node.role === 'chart-segment');
const swatches = nodes.filter(node => node.role === 'legend-swatch');
const labels = nodes.filter(node => node.role === 'data-label');
const circle = segments[0].frame;
const cx = circle.x + circle.width / 2;
const cy = circle.y + circle.height / 2;
const distanceRatios = labels.map(node => {
  const x = node.frame.x + node.frame.width / 2;
  const y = node.frame.y + node.frame.height / 2;
  return Math.hypot(x - cx, y - cy) / circle.width;
});
const angleErrors = labels.map((node, index) => {
  const x = node.frame.x + node.frame.width / 2;
  const y = node.frame.y + node.frame.height / 2;
  const actual = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
  const expected = (segments[index].data.startAngle + segments[index].data.endAngle) / 2;
  return Math.abs(((actual - expected + 540) % 360) - 180);
});
console.log(JSON.stringify({
  paletteAligned: segments.every((node, index) => JSON.stringify(node.style.fill) === JSON.stringify(swatches[index].style.fill)),
  dataValues: segments.map(node => node.data.value),
  labelTexts: labels.map(node => node.text),
  distanceRatios,
  angleErrors
}));
"""
        )
        self.assertTrue(result["paletteAligned"])
        self.assertEqual(result["dataValues"], [52, 31, 17])
        self.assertEqual(result["labelTexts"], ["52%", "31%", "17%"])
        self.assertTrue(all(0.35 <= value <= 0.38 for value in result["distanceRatios"]))
        self.assertTrue(all(value < 0.001 for value in result["angleErrors"]))

    def test_combo_chart_has_one_axis_and_category_system(self):
        result = run_node(
            """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const nodes = REGISTRY.get('chart.combo').render({
  id: 'combo',
  frame: {x: 0, y: 0, width: 760, height: 420},
  props: {
    categories: ['A','B','C'],
    series: [{name: 'Actual', values: [20,30,40]}, {name: 'Plan', values: [22,32,42]}],
    annotations: [], highlights: [], referenceLines: []
  }
}).nodes;
const count = role => nodes.filter(node => node.role === role).length;
console.log(JSON.stringify({categories: count('category-label'), axes: count('chart-axis'), bars: count('chart-mark'), lines: count('chart-line'), markers: count('chart-marker')}));
"""
        )
        # Labelled marks need no value axis: one category axis, the values on the marks.
        self.assertEqual(result, {"categories": 3, "axes": 1, "bars": 3, "lines": 2, "markers": 3})

    def test_chart_annotations_are_attached_without_covering_the_target(self):
        result = run_node(
            """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const frame = {x: 0, y: 0, width: 760, height: 420};
const results = ['chart.line','chart.combo'].map(id => {
  const definition = REGISTRY.get(id);
  const nodes = definition.render({id, frame, props: definition.sample}).nodes;
  const surface = nodes.find(node => node.role === 'annotation-surface');
  const target = nodes.filter(node => node.role === 'chart-marker').sort((a,b) => b.frame.x - a.frame.x)[0];
  const point = {x: target.frame.x + target.frame.width / 2, y: target.frame.y + target.frame.height / 2};
  const covered = point.x >= surface.frame.x && point.x <= surface.frame.x + surface.frame.width && point.y >= surface.frame.y && point.y <= surface.frame.y + surface.frame.height;
  const overlay = nodes.indexOf(surface) > Math.max(...nodes.map((node, index) => ['chart-mark','chart-line','chart-marker'].includes(node.role) ? index : -1));
  return {id, covered, overlay};
});
const columnNodes = REGISTRY.get('chart.column').render({id: 'column', frame, props: {...REGISTRY.get('chart.column').sample, annotations:[{category:'2026',text:'Evidence'}]}}).nodes;
const referenceLabel = columnNodes.find(node => node.role === 'chart-reference-label');
const annotationSurface = columnNodes.find(node => node.role === 'annotation-surface');
const referenceOverlapsAnnotation = !(
  referenceLabel.frame.x + referenceLabel.frame.width <= annotationSurface.frame.x
  || annotationSurface.frame.x + annotationSurface.frame.width <= referenceLabel.frame.x
  || referenceLabel.frame.y + referenceLabel.frame.height <= annotationSurface.frame.y
  || annotationSurface.frame.y + annotationSurface.frame.height <= referenceLabel.frame.y
);
console.log(JSON.stringify({results, referenceOverlapsAnnotation}));
"""
        )
        for chart in result["results"]:
            self.assertFalse(chart["covered"], chart["id"])
            self.assertTrue(chart["overlay"], chart["id"])
        self.assertFalse(result["referenceOverlapsAnnotation"])

if __name__ == "__main__":
    unittest.main()
