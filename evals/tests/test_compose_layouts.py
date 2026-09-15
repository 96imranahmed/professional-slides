"""deck/v3 composer layouts: cards, quadrants, compare, phase-table, rows,
metrics strip, hero fitness, stack/grid and side ratios."""
import unittest
from node_probe import run_node


class ComposeLayoutTests(unittest.TestCase):
    def test_aliases_and_layouts_resolve_to_components(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const cards=composeSlide({title:'T',exhibit:{type:'cards',items:[{icon:'target',title:'A',text:'a'},{icon:'rocket',title:'B',text:'b'}]}},0);
assert.equal(cards.items[0].leftover,'center','icon cards centre in the page');
assert.equal(find(cards.items,i=>i.component==='cards').size.height,'hug');
const header=composeSlide({title:'T',exhibit:{type:'cards',tone:'header',items:[{title:'A',points:['x']},{title:'B',points:['y']}]}},0);
assert.equal(header.items[0].component,'cards');assert.equal(header.items[0].size.height,'fill');
const swot=composeSlide({title:'T',exhibit:{type:'swot',strengths:['s'],weaknesses:['w'],opportunities:['o'],threats:['t']}},0);
assert.equal(swot.items[0].component,'quadrants');assert.deepEqual(swot.items[0].props.quadrants.map(q=>q.title),['Strengths','Weaknesses','Opportunities','Threats']);
const compare=composeSlide({title:'T',exhibit:{type:'compare',left:{heading:'Before',points:['a','b']},right:{heading:'After',points:['c']}}},0);
assert.equal(compare.items[0].component,'table');assert.equal(compare.items[0].props.rows.length,2);assert.equal(compare.items[0].props.treatment,'standard');
const phase=composeSlide({title:'T',exhibit:{type:'phase-table',phases:['1. Assess','2. Design'],rows:[{label:'Activities',cells:[['a'],['b']]},{label:'Duration',cells:['3 weeks','4 weeks']}]}},0);
assert.equal(phase.items[0].props.headerShape,'chevron');assert.equal(phase.items[0].props.rows[0][1].type,'bullets');assert.equal(phase.items[0].props.columns.length,3);
const rows=composeSlide({title:'T',rows:[{label:'Background',text:'x'},{label:'Solution',points:['y']}]},0);
assert.equal(rows.items[0].props.treatment,'categories');assert.equal(rows.items[0].props.rows[1][1].type,'bullets');
// Metrics strip above an exhibit; a thin chart becomes a column of tiles beside the points.
const metrics=composeSlide({title:'T',metrics:[{value:'$1B',label:'x'},{value:'12%',label:'y'}],exhibit:{type:'chart.column',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]}},0);
assert.equal(metrics.items[0].id,'s01-metrics');assert.equal(metrics.items[0].items.length,2);
const thin=composeSlide({title:'T',exhibit:{type:'chart.column',unit:'$k',categories:['$4,000','$5,500','$6,500'],series:[{name:'Rent',values:[48,66,78]}]},points:['p']},0);
const tiles=find(thin.items,i=>i.id==='s01-tiles');
assert.deepEqual(tiles.items.map(t=>t.props.value),['$48k','$66k','$78k']);
assert.ok(find(thin.items,i=>i.id==='s01-side'));
assert.equal(find(thin.items,i=>String(i.component||'').startsWith('chart.')),null);
// Side ratios: chart 2:1, table 3:2.
const chartSide=composeSlide({title:'T',exhibit:{type:'chart.bar',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]},points:['p']},0);
assert.deepEqual(chartSide.items[0].items.map(i=>i.size.width.fr),[2,1]);
const tableSide=composeSlide({title:'T',exhibit:{type:'table',columns:['A','B'],rows:[['x','y']]},points:['p']},0);
assert.deepEqual(tableSide.items[0].items.map(i=>i.size.width.fr),[3,2]);
// Auto-stack: two charts on one category set with points.
const stack=composeSlide({title:'T',exhibits:[{type:'chart.column',categories:['a','b'],series:[{name:'s',values:[1,2]}]},{type:'chart.line',categories:['a','b'],series:[{name:'m',values:[3,4]}]}],points:['p']},0);
assert.ok(find(stack.items,i=>i.id==='s01-stack'));
const grid=composeSlide({title:'T',arrange:'grid',exhibits:[1,2,3,4].map(n=>({type:'chart.column',categories:['a'],series:[{name:'s',values:[n]}]}))},0);
assert.ok(find(grid.items,i=>i.id==='s01-row-b'));
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_cards_share_one_header_height_and_metric_tiles_measure(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props={items:[{icon:'target',title:'Short',text:'One line.',points:['a']},{icon:'gear',title:'A much longer title that wraps onto a second line here',text:'Two.',points:['b']},{icon:'people',title:'Mid',text:'Three.',points:['c']}]};
const deck=compileDeck({slides:[{id:'c',composition:component({id:'cards',component:'cards',props,frame:{x:60,y:140,width:1160,height:400}})}]},REGISTRY);
const nodes=deck.slides[0].nodes;
const texts=nodes.filter(n=>n.role==='card-text');
assert.equal(new Set(texts.map(n=>n.frame.y)).size,1,'card bodies start level (row rule)');
assert.equal(nodes.filter(n=>n.role==='card-icon-glyph').length,3);
const metric=compileDeck({slides:[{id:'m',composition:component({id:'k',component:'metric',props:{value:'$2.1B',label:'Incremental profit',sublabel:'annual run rate',delta:'+0.9 vs plan',tone:'dark'},frame:{x:60,y:140,width:300,height:160}})}]},REGISTRY).slides[0].nodes;
assert.deepEqual(metric.map(n=>n.role),['metric-surface','metric-value','metric-label','metric-sublabel','metric-delta']);
assert.equal(metric[0].style.fill.tokenId,'color.componentPrimary');
assert.equal(metric[1].style.color.tokenId,'color.onPrimary');
const light=compileDeck({slides:[{id:'m2',composition:component({id:'k2',component:'metric',props:{value:'4%',label:'x',delta:'-2 pts'},frame:{x:60,y:140,width:300,height:160}})}]},REGISTRY).slides[0].nodes;
assert.equal(light.find(n=>n.role==='metric-delta').style.color.tokenId,'color.negative');
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


if __name__ == '__main__':
    unittest.main()
