import unittest
from node_probe import run_node


class PageTemplateTests(unittest.TestCase):
    def test_wrapped_titles_share_one_content_top_and_clear_the_title(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {CHROME,token,tokenValue} from './skills/professional-slides/runtime/core.mjs';
const chrome=REGISTRY.get('slide-chrome'),frame={x:0,y:0,width:1280,height:720};
const render=title=>chrome.render({id:'page',frame,props:{title,source:'Source: Company data'}});
const single=render('Revenue growth accelerated');
const wrappedWithout=render('Revenue growth translated into faster operating income\\ngrowth');
const wrappedWith=chrome.render({id:'page',frame,props:{title:'Revenue growth translated into faster operating income\\ngrowth',titleVariant:'with-line',source:'Source: Company data'}});
const compact=chrome.render({id:'page',frame,props:{title:'Revenue growth accelerated',pageTemplate:{contentSpacing:'compact'},source:'Source: Company data'}});
assert.throws(()=>chrome.render({id:'bad',frame,props:{title:'Test',pageTemplate:{contentSpacing:'arbitrary'}}}),/contentSpacing/);
const clearance=tokenValue(token('space.5'));
const gapOf=r=>{const t=r.nodes.find(n=>n.role==='action-title');return r.contentFrame.y-t.frame.y-t.data.textLayout.height;};
// One content top for every page: a second title line eats the slack rather
// than pushing the content down, and contentSpacing does not move it either.
for(const r of [single,wrappedWithout,wrappedWith,compact]) {
 assert.equal(r.contentFrame.y,CHROME.bodyTop);
 assert.ok(gapOf(r)>=clearance);
}
assert.equal(wrappedWithout.nodes.find(n=>n.role==='action-title').data.textLayout.lines.length,2);
assert.deepEqual(wrappedWithout.contentFrame,wrappedWith.contentFrame);
console.log(JSON.stringify({accepted:true,singleGap:gapOf(single),wrappedGap:gapOf(wrappedWithout),contentTop:single.contentFrame.y}));
""")
        self.assertTrue(result["accepted"])
        self.assertEqual(result["contentTop"], 140)
        self.assertEqual(result["singleGap"], 60)
        self.assertEqual(result["wrappedGap"], 24)

    def test_footer_defaults_and_rule_variants_share_baseline(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:0,y:0,width:1280,height:720}, chrome=REGISTRY.get('slide-chrome');
const props={title:'Capacity unlocks growth',source:'Source: Company data',companyName:'Company Name',pageNumber:7};
for(const [rules,count] of [['none',0],['bottom',1],['top-and-bottom',2]]) {
 const r=chrome.render({id:'page',frame,props:{...props,pageTemplate:{rules}}});
 assert.equal(r.nodes.filter(n=>n.type==='line').length,count);
 const source=r.nodes.find(n=>n.role==='source-text'), company=r.nodes.find(n=>n.role==='footer-right'), number=r.nodes.find(n=>n.role==='page-number');
 assert.equal(source.frame.y,number.frame.y);assert.equal(company.frame.y,number.frame.y);
 assert.equal(source.frame.height,number.frame.height);
 assert.ok(source.frame.x+source.frame.width<company.frame.x);
 assert.ok(company.frame.x+company.frame.width<number.frame.x);
 assert.ok(r.contentFrame.y+r.contentFrame.height<source.frame.y);
}
const plain=chrome.render({id:'page',frame,props});
assert.ok(!plain.nodes.some(n=>n.type==='line'));
const separate=chrome.render({id:'page',frame,props:{...props,pageTemplate:{sourcePlacement:'separate'}}});
assert.ok(plain.contentFrame.height>separate.contentFrame.height);
assert.equal(plain.contentFrame.height,528);
assert.ok(!REGISTRY.get('source').render({id:'source',frame:{x:0,y:0,width:500,height:26},props:{text:'Source: Company data'}}).nodes.some(n=>n.type==='line'));
const divider=REGISTRY.get('section-divider').render({id:'divider',frame,props:{title:'Section A'}}).nodes;
assert.ok(!divider.some(n=>n.type==='line'));
for(const node of divider.filter(n=>n.type==='text')) assert.equal(node.style.lineHeight,node.data.textLayout.lineHeight);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_wrapped_sources_notes_and_invalid_input_fail_closed(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {pageTemplateLayout,resolvePageTemplate} from './skills/professional-slides/runtime/page-template.mjs';
const frame={x:0,y:0,width:1280,height:720};
const longSource='Source: Company operating data for the twelve months ended June 2026, customer research and team analysis of the regional growth outlook and delivery capacity by market. Values include analyst calculations based on the stated reporting perimeter.';
const r=pageTemplateLayout(frame,{source:longSource,companyName:'Company Name',pageNumber:7,note:'Note: Values are rounded.'});
const source=r.slots.find(n=>n.role==='source-text'),number=r.slots.find(n=>n.role==='page-number'),note=r.slots.find(n=>n.role==='footnote-text');
assert.ok(source.data.textLayout.lines.length>1);
assert.equal(source.frame.y+source.frame.height,number.frame.y+number.frame.height);
assert.ok(note.frame.y+note.frame.height<source.frame.y);
assert.ok(r.contentFrame.y+r.contentFrame.height<note.frame.y);
assert.throws(()=>resolvePageTemplate({rules:'sometimes'}),/rules/);
assert.throws(()=>resolvePageTemplate({branding:'left'}),/branding/);
assert.throws(()=>resolvePageTemplate({sourcePlacement:'overlay'}),/sourcePlacement/);
assert.throws(()=>resolvePageTemplate({branding:'top-right-logo'}),/requires/);
assert.throws(()=>pageTemplateLayout(frame,{source:'Source data',footerLeft:'Report'}),/left footer slot/);
assert.throws(()=>pageTemplateLayout(frame,{companyName:'Company '.repeat(100)}),/one footer line/);
assert.throws(()=>pageTemplateLayout(frame,{source:'Company '.repeat(500)}),/three footer lines/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_planner_inherits_page_template_and_reserves_brand_slot(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {renderSlideHtml} from './skills/professional-slides/runtime/adapters/html.mjs';
const slide={id:'growth',title:'Growth follows demand',source:'Source: Company data',items:[{id:'text',job:'State the constraint',component:'paragraph',props:{text:'Demand exceeds available capacity.'}}]};
const pageTemplate={rules:'bottom',branding:'top-right-logo',logo:{component:'paragraph',props:{text:'Company name'}}};
const {deck}=planDeck({id:'company',pageTemplate,slides:[slide,{...slide,id:'next'}]});
assert.deepEqual(deck.manifest.pageTemplate,{sourcePlacement:'inline',contentSpacing:'standard',...pageTemplate});
for(const [i,s] of deck.slides.entries()) {
 const title=s.nodes.find(n=>n.role==='action-title'),logo=s.componentInstances.find(n=>n.id.endsWith(':logo'));
 assert.ok(logo);assert.equal(logo.frame.x,1040);assert.equal(logo.frame.y,44);
 assert.ok(title.frame.x+title.frame.width<logo.frame.x);
 assert.equal(s.nodes.find(n=>n.role==='page-number').text,String(i+1));
 assert.equal(s.nodes.filter(n=>n.role==='source-text').length,1);
 assert.ok(!s.nodes.some(n=>n.role==='footer-right'||n.role==='source-rule'));
 assert.ok(renderSlideHtml(s).includes('Company name'));
 const body=s.componentInstances.find(n=>n.id==='text');assert.equal(body.frame.x,s.contentFrame.x);assert.equal(body.frame.width,s.contentFrame.width);assert.ok(body.frame.height<s.contentFrame.height);
}
const plain=planDeck({id:'plain',slides:[slide]}).deck;
assert.equal(plain.manifest.pageTemplate.rules,'none');
assert.ok(!plain.slides[0].nodes.some(n=>n.role==='footer-rule'));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_golden_covers_template_variants_and_modern_standard_chrome(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {buildGoldenSetDeck} from './skills/professional-slides/runtime/golden-set.mjs';
import {componentFixtureSpecs,componentVariantFixtureSpecs} from './skills/professional-slides/runtime/fixtures.mjs';
import {buildGoldenDeck} from './skills/professional-slides/runtime/golden-fixtures.mjs';
const variants=[...componentFixtureSpecs(),...componentVariantFixtureSpecs()].filter(n=>n.target==='page-template');assert.equal(variants.length,9);
assert.equal(variants.filter(n=>n.defaultVariant).length,1);
const {deck}=buildGoldenSetDeck();
for(const s of deck.slides.filter(s=>s.id.startsWith('golden-'))) {
 assert.ok(!s.nodes.some(n=>['footer-rule','header-rule','divider-rule'].includes(n.role)),s.id); // the title rule is the house style's, not the template's
 const source=s.nodes.find(n=>n.role==='source-text'),number=s.nodes.find(n=>n.role==='page-number');
 if(source&&number) assert.equal(source.frame.y,number.frame.y,s.id);
}
// Fidelity benchmarks preserve their explicitly selected source treatment.
assert.ok(buildGoldenDeck().deck.slides.some(s=>s.nodes.some(n=>n.role==='footer-rule')));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])
