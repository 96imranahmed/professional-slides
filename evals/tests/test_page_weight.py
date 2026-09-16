"""How a page carries its weight: the implication marker between evidence and
meaning, a side column that can be a centred insight, the chart heading's inline
unit, and the deck's `fill` level."""
import unittest
from node_probe import run_node


class PageWeightTests(unittest.TestCase):
    def test_implication_marker_and_insight_column(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry=createRegistry();
const chart={type:'chart.bar',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]};
const row=(slide)=>composeSlide(slide,0).items.find(i=>i.id==='s01-row');
const marker=(slide)=>row(slide).items.find(i=>i.component==='connector');
// A headed column runs the body's height, so the marker is the dashed divider.
assert.equal(marker({title:'T',exhibit:chart,points:['p','q']}).props.variant,'divider-chevron');
// A toned panel is full bleed too, heading or not.
assert.equal(marker({title:'T',exhibit:chart,pointsTone:'muted',pointsHeading:false,points:['p']}).props.variant,'divider-chevron');
// A short centred insight needs no divider: the disc alone joins the two halves.
const insight={title:'T',exhibit:chart,insight:'Lockers cost half what a post office visit costs.'};
assert.equal(marker(insight).props.variant,'disc-chevron');
const side=row(insight).items.find(i=>i.id==='s01-side');
assert.equal(side.heading,undefined,'an insight column carries no filler heading');
assert.equal(side.leftover,'center');
assert.equal(side.items[0].component,'insight');
assert.equal(side.items[0].props.variant,'tonal');
// `insight` as an object keeps its heading; `implication: false` drops the marker.
assert.equal(row({title:'T',exhibit:chart,insight:{heading:'So what',text:'x'}}).items.find(i=>i.id==='s01-side').items[0].props.heading,'So what');
assert.equal(marker({title:'T',exhibit:chart,points:['p'],implication:false}),undefined);
// A kpi alone also earns a column; a column with nothing in it is refused.
assert.ok(row({title:'T',exhibit:chart,kpi:{value:'80%',label:'x'}}));
// The divider draws two dashed segments with the disc between them.
const nodes=registry.get('connector').render({id:'c',frame:{x:0,y:0,width:44,height:400},props:{variant:'divider-chevron'}}).nodes;
const rules=nodes.filter(n=>n.role==='relationship-divider');
assert.equal(rules.length,2);
assert.ok(rules.every(n=>n.style.dash==='dash'));
assert.ok(rules[0].data.y2<200&&rules[1].data.y1>200,'the rule breaks around the disc');
assert.equal(nodes.filter(n=>n.role==='relationship-disc').length,1);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_inline_chart_unit(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const registry=createRegistry();
const title=registry.get('chart-title');
const props={heading:'Revenue by business line',unit:'$B'};
const frame={x:0,y:0,width:700,height:90};
// Inline: one band, the unit on the heading's line at the heading's size, grey.
const inline=title.render({id:'t',frame,props:{...props,unitPlacement:'inline'}}).nodes;
const heading=inline.find(n=>n.role==='section-heading'), unit=inline.find(n=>n.role==='chart-unit');
assert.equal(unit.style.fontSize.tokenId,'type.heading');
assert.equal(heading.style.fontSize.tokenId,'type.heading');
assert.equal(unit.style.color.tokenId,'color.chartUnit');
assert.equal(unit.style.bold,false);
assert.ok(Math.abs(unit.frame.y-heading.frame.y)<2,'one line');
assert.ok(unit.frame.x>heading.frame.x+heading.data.textLayout.width-2,'the unit follows the measured heading');
const stacked=title.render({id:'t',frame,props}).nodes.find(n=>n.role==='chart-unit');
assert.equal(stacked.style.fontSize.tokenId,'type.compact');
assert.ok(stacked.frame.y>heading.frame.y+10,'the stacked unit sits under the heading');
// The inline band is shorter than the stacked one, so peers can share it.
assert.ok(title.measureContent({frame,props:{...props,unitPlacement:'inline'}}).height<title.measureContent({frame,props}).height);
// A unit that will not fit beside its heading falls back to the compact line.
const long={heading:'Revenue by business line and geography across the group',unit:'$B, constant currency, excluding disposals',unitPlacement:'inline'};
const fallback=title.render({id:'t',frame:{x:0,y:0,width:420,height:110},props:long}).nodes.find(n=>n.role==='chart-unit');
assert.equal(fallback.style.fontSize.tokenId,'type.compact');
// The composer asks for it beside a text column and on a full-width chart, and
// leaves peers in a row alone so their two-line bands align.
const side=composeSlide({title:'T',exhibit:{type:'chart.column',heading:'H',unit:'$B',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]},points:['p']},0);
assert.equal(side.items[0].items[0].props.unitPlacement,'inline');
const peers=composeSlide({title:'T',exhibits:[{type:'chart.column',heading:'A',unit:'$B',categories:['a','b','c'],series:[{name:'s',values:[1,2,3]}]},{type:'chart.bar',heading:'B',unit:'$B',categories:['a','b','c'],series:[{name:'t',values:[2,3,4]}]}]},0);
assert.equal(peers.items[0].items[0].props.unitPlacement,undefined);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_fill_levels(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {resolveFill,composeSlide,toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
// The fill follows the density unless the deck names one.
assert.equal(resolveFill({}),'balanced');
assert.equal(resolveFill({density:'pre-read'}),'full');
assert.equal(resolveFill({density:'live-pitch'}),'airy');
assert.equal(resolveFill({density:'live-pitch',fill:'full'}),'full');
assert.throws(()=>resolveFill({fill:'packed'}),/Unknown fill/);
const chart={type:'chart.bar',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]};
const points=['one','two','three'];
const list=(fill)=>composeSlide({title:'T',exhibit:chart,points},0,undefined,fill).items.find(i=>i.id==='s01-row').items.find(i=>i.id==='s01-side').items[0];
// A full page spreads its points down the column; a balanced one hugs the top.
assert.equal(list('full').props.distribute,true);
assert.equal(list('full').size.height,'fill');
assert.equal(list('balanced').props.distribute,undefined);
assert.equal(list('balanced').size.height,'hug');
// The deck plan carries the resolved fill so the gates can read it.
assert.equal(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',density:'pre-read',slides:[{title:'T',points}]}).fill,'full');
// Distribution spreads the rows without moving the first one.
const registry=createRegistry();
const frame={x:0,y:0,width:360,height:420};
const props={variant:'body',items:points};
const hugged=registry.get('bullet-list').render({id:'l',frame,props}).nodes.filter(n=>n.role==='list-item');
const spread=registry.get('bullet-list').render({id:'l',frame,props:{...props,distribute:true}}).nodes.filter(n=>n.role==='list-item');
assert.equal(hugged[0].frame.y,spread[0].frame.y);
assert.ok(spread.at(-1).frame.y>hugged.at(-1).frame.y+40);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
