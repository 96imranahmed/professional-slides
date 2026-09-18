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
// Every connector runs the dashed rule through the disc, on a short centred
// insight as much as on a full-height column. A bare disc floating in an empty
// gutter reads as a stray mark; the rule is what makes it a connector.
const insight={title:'T',exhibit:chart,insight:'Lockers cost half what a post office visit costs.'};
assert.equal(marker(insight).props.variant,'divider-chevron');
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
assert.equal(heading.text,'Revenue by business line,');
assert.equal(unit.text,'$B');
assert.equal(unit.style.fontSize.tokenId,'type.heading');
assert.equal(heading.style.fontSize.tokenId,'type.heading');
assert.equal(unit.style.color.tokenId,'color.chartUnit');
assert.equal(unit.style.bold,false);
assert.ok(Math.abs(unit.frame.y-heading.frame.y)<2,'one line');
assert.ok(unit.frame.x>heading.frame.x+heading.data.textLayout.width-2,'the unit follows the measured heading');
// The stacked unit line belongs to the heading that carries no rule (the
// `unit` variant): under a ruled heading a second line pushes the rule down and
// no two panels in a row share it, so a ruled heading takes the unit inline.
const unruled={...props,variant:'unit'};
const stacked=title.render({id:'t',frame,props:unruled}).nodes.find(n=>n.role==='chart-unit');
assert.equal(title.render({id:'t',frame,props:unruled}).nodes.find(n=>n.role==='section-heading').text,props.heading);
assert.equal(stacked.style.fontSize.tokenId,'type.compact');
assert.ok(stacked.frame.y>heading.frame.y+10,'the stacked unit sits under the heading');
// The inline band is shorter than the stacked one, so peers can share it.
assert.ok(title.measureContent({frame,props:{...props,unitPlacement:'inline'}}).height<title.measureContent({frame,props:unruled}).height);
// A unit that will not fit beside its heading falls back to the compact line.
const long={heading:'Revenue by business line and geography across the group',unit:'$B, constant currency, excluding disposals',unitPlacement:'inline'};
const fallback=title.render({id:'t',frame:{x:0,y:0,width:420,height:110},props:long}).nodes.find(n=>n.role==='chart-unit');
assert.equal(fallback.style.fontSize.tokenId,'type.compact');
// Include the comma in the fit decision, and remove it when that forces stacking.
const required=unit.frame.x+unit.data.textLayout.width-frame.x;
const tight=title.render({id:'tight',frame:{...frame,width:required-1},props:{...props,unitPlacement:'inline'}}).nodes;
assert.equal(tight.find(n=>n.role==='chart-unit').data.chartUnitPlacement,'stacked');
assert.equal(tight.find(n=>n.role==='section-heading').text,props.heading);
const punctuated=title.render({id:'punctuated',frame,props:{...props,heading:props.heading+', ',unitPlacement:'inline'}}).nodes;
assert.equal(punctuated.find(n=>n.role==='section-heading').text,props.heading+',');
const alone=title.render({id:'alone',frame,props:{heading:props.heading,unitPlacement:'inline'}}).nodes;
assert.equal(alone.find(n=>n.role==='section-heading').text,props.heading);
// The composer asks for it on every architecture. A page's shape decides where
// things sit, never what they are, and peers in a row stay aligned because each
// band is now one line rather than two.
const side=composeSlide({title:'T',exhibit:{type:'chart.column',heading:'H',unit:'$B',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]},points:['p']},0);
assert.equal(side.items[0].items[0].props.unitPlacement,'inline');
const peers=composeSlide({title:'T',exhibits:[{type:'chart.column',heading:'A',unit:'$B',categories:['a','b','c'],series:[{name:'s',values:[1,2,3]}]},{type:'chart.bar',heading:'B',unit:'$B',categories:['a','b','c'],series:[{name:'t',values:[2,3,4]}]}]},0);
assert.equal(peers.items[0].items[0].props.unitPlacement,'inline');
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
// Every deck spreads its points down the column, airy included. White space
// *between* the points is what airy means; the same space pooled under the
// last one is an unfinished page. The gap opens to its cap and the list
// centres whatever the cap leaves over, so airy is the same block with air
// around and between it rather than a list hugging the top of its track.
assert.equal(list('full').props.distribute,true);
assert.equal(list('full').size.height,'fill');
assert.equal(list('balanced').props.distribute,true);
assert.equal(list('balanced').size.height,'fill');
assert.equal(list('airy').props.distribute,true);
assert.equal(list('airy').size.height,'fill');
// The deck plan carries the resolved fill so the gates can read it.
assert.equal(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',density:'pre-read',slides:[{title:'T',points}]}).fill,'full');
// Distribution opens the gaps to the cap and then centres what the cap leaves
// over, so the block sits in the middle of its track rather than hugging the
// top with every spare pixel banked under the last row. The first row moves
// down by exactly what the last row leaves at the foot.
const registry=createRegistry();
const frame={x:0,y:0,width:360,height:420};
const props={variant:'body',items:points};
const hugged=registry.get('bullet-list').render({id:'l',frame,props}).nodes.filter(n=>n.role==='list-item');
const spread=registry.get('bullet-list').render({id:'l',frame,props:{...props,distribute:true}}).nodes.filter(n=>n.role==='list-item');
assert.ok(spread[0].frame.y>hugged[0].frame.y,'the block no longer hugs the top');
assert.ok(spread.at(-1).frame.y>hugged.at(-1).frame.y+40,'and the rows still spread apart');
const top=spread[0].frame.y-frame.y;
const bottom=(frame.y+frame.height)-(spread.at(-1).frame.y+spread.at(-1).frame.height);
assert.ok(Math.abs(top-bottom)<=1,`the leftover is split top and bottom (${top} vs ${bottom})`);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
