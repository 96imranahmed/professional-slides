"""deck/v3 composer layouts: cards, quadrants, compare, phase-table, rows,
metrics strip, hero fitness, stack/grid and side ratios."""
import unittest
from node_probe import run_node


class ComposeLayoutTests(unittest.TestCase):
    def test_single_bottom_implication_runs_the_exhibit_width_without_widening_peers(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const text='The model retains the same service boundary. Additional capacity changes one constraint but does not establish permission, funding or readiness. Those conditions must be verified together before the later commitment.';
const build=count=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'bottom',tracker:false,slides:[{id:'s',title:'One implication uses the region below its evidence',layout:'exhibit-top',pointsHeading:false,exhibit:{type:'table',columns:['Case','Value'],rows:[['A',10],['B',20]]},points:Array.from({length:count},(_,i)=>({lead:`Finding ${i+1}`,text}))}]})).deck;
const one=build(1),two=build(2),three=build(3);
const paragraphs=deck=>deck.slides[0].nodes.filter(n=>n.role==='paragraph');
const rows=deck=>deck.slides[0].nodes.filter(n=>String(n.role).startsWith('table-'));
const span=deck=>{const r=rows(deck);return [Math.min(...r.map(n=>n.frame.x)),Math.max(...r.map(n=>n.frame.x+n.frame.width))];};
// One implication takes the track of the exhibit it is read off, left edge to
// left edge, rather than hugging its own measure in the middle of the region.
const a=paragraphs(one);assert.equal(a.length,1);
const [left,right]=span(one);
assert.ok(Math.abs(a[0].frame.x-left)<1,`paragraph starts at ${a[0].frame.x}, exhibit at ${left}`);
assert.ok(a[0].frame.x+a[0].frame.width>=right-1,`paragraph ends at ${a[0].frame.x+a[0].frame.width}, exhibit at ${right}`);
assert.equal(a[0].text.split(/\s+/).join(' '),text);
for(const [d,count,max] of [[two,2,580],[three,3,390]]){
 const p=paragraphs(d);assert.equal(p.length,count);assert.ok(p.every(n=>n.frame.width<max));assert.equal(new Set(p.map(n=>n.frame.width)).size,1);
 assert.ok(p.every(n=>n.text.split(/\s+/).join(' ')===text));assert.ok(p.every(n=>n.style.fontSize.tokenId===a[0].style.fontSize.tokenId));
}
console.log('{}');
''')

    def test_a_short_text_page_uses_its_body_track_without_losing_content(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const points=['The first finding establishes the premise.','The second finding explains its consequence.'];
const page=composeSlide({title:'Two findings support the decision',layout:'text',points},0);
const list=page.items.find(i=>i.component==='bullet-list');
assert.equal(list.size.height,'fill');
assert.equal(list.props.distribute,true);
assert.equal(list.props.centre,false);
const rendered=createRegistry().get('bullet-list').render({id:'summary',frame:{x:60,y:140,width:1160,height:500},props:list.props}).nodes.filter(n=>n.type==='text');
const top=Math.min(...rendered.map(n=>n.frame.y));
// A sparse sole list opens its gaps and starts under the title: centred, it
// carried a band of air above its first point as tall as the one below.
assert.ok(Math.abs(top-140)<3,'a sparse sole list starts at the top of its track');
assert.deepEqual(list.props.items,points);
const shared=composeSlide({title:'Two findings support the decision',layout:'text',points,paragraphs:['An authored qualification remains alongside the findings.']},0);
assert.equal(shared.items.find(i=>i.component==='bullet-list').size.height,'hug');
assert.ok(shared.items.some(i=>i.component==='paragraph'));
console.log(JSON.stringify({ok:true}));
''')

    def test_aliases_and_layouts_resolve_to_components(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const cards=composeSlide({title:'T',exhibit:{type:'cards',items:[{icon:'target',title:'A',text:'a'},{icon:'rocket',title:'B',text:'b'}]}},0);
// Icon cards hug their copy at the top of the body; centred, they carried as
// much air above the row as below it.
assert.equal(find(cards.items,i=>i.component==='cards').props.valign,undefined,'icon cards start at the top of the page');
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
// Authored metrics form a strip; small charts retain their quantitative encoding.
const metrics=composeSlide({title:'T',metrics:[{value:'$1B',label:'x'},{value:'12%',label:'y'}],exhibit:{type:'chart.column',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]}},0);
assert.equal(metrics.items[0].id,'s01-metrics');assert.equal(metrics.items[0].items.length,2);
const thin=composeSlide({title:'T',exhibit:{type:'chart.column',unit:'$k',categories:['$4,000','$5,500','$6,500'],series:[{name:'Rent',values:[48,66,78]}]},points:['p']},0);
const retained=find(thin.items,i=>i.component==='chart.column');
assert.deepEqual(retained.props.series[0].values,[48,66,78]);
assert.equal(retained.props.unit,'$k');
assert.ok(find(thin.items,i=>i.id==='s01-side'));
assert.equal(find(thin.items,i=>i.component==='metric'),null);
// Side ratios: chart 2:1, table 3:2.
const chartSide=composeSlide({title:'T',exhibit:{type:'chart.bar',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]},points:['p']},0);
// The implication chevron sits between the exhibit and its consequences, and
// the column's width is negotiated against what it holds: a column that does
// not run four fifths down its track narrows - beside a chart down to the
// width a line of prose needs (280px, fr 0.71), beside a table by a fifth at
// most - and one that does keeps its ratio.
const fr=(page)=>page.items[0].items.map(i=>i.component==='connector'?'connector':i.size.width.fr);
const [chartFr,sideFr]=fr(chartSide);
assert.equal(chartFr,2);assert.ok(sideFr<1&&sideFr>=0.71,`one short point narrows its column (${sideFr})`);
const deepPoints=['Wealth nearly doubled on advisory fees while lending margins compressed across the book','Corporate slipped as the rate cycle ran and the book lost a fifth of its contribution','Retail held flat as deposit growth offset the fee decline in a falling market'];
// A table's column starts at 3:2 and is measured the same way: the wider the
// track, the more it has to carry to keep it.
const tableSide=composeSlide({title:'T',exhibit:{type:'table',columns:['A','B'],rows:[['x','y']]},points:deepPoints},0);
assert.ok(fr(tableSide)[1]<2&&fr(tableSide)[1]>=1.6,`three sentences do not fill a 3:2 track (${fr(tableSide)[1]})`);
const tableSideFull=composeSlide({title:'T',exhibit:{type:'table',columns:['A','B'],rows:[['x','y']]},points:[...deepPoints,...deepPoints,...deepPoints]},0);
assert.deepEqual(fr(tableSideFull),[3,2]);
// Auto-stack: two charts on one category set with points.
const stack=composeSlide({title:'T',exhibits:[{type:'chart.column',categories:['a','b'],series:[{name:'s',values:[1,2]}]},{type:'chart.line',categories:['a','b'],series:[{name:'m',values:[3,4]}]}],points:['p']},0);
assert.ok(find(stack.items,i=>i.id==='s01-stack'));
const grid=composeSlide({title:'T',arrange:'grid',exhibits:[1,2,3,4].map(n=>({type:'chart.column',categories:['a'],series:[{name:'s',values:[n]}]}))},0);
assert.ok(find(grid.items,i=>i.id==='s01-row-b'));
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_cards_share_one_header_height_and_metric_tiles_measure(self):
        result = run_node(r'''
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


class ChartRuleTests(unittest.TestCase):
    def test_highlight_from_title_cagr_badge_range_and_value_table(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
// Highlight the answer: the title names Hoboken, so Hoboken's bar takes the accent.
const bar=composeSlide({title:'Hoboken is the safest of the four',exhibit:{type:'chart.bar',categories:['Hoboken','San Francisco','Berkeley','New York City'],series:[{name:'v',values:[189,587,639,571]}]}},0);
const chart=find(bar.items,i=>i.component==='chart.bar');
assert.deepEqual(chart.props.highlights ?? [],[],'title text does not choose a chart focus');
const spec=nativeChartSpec('chart.bar',chart.props,{x:0,y:0,width:700,height:400});
assert.deepEqual(spec.highlightIndices,[]);
// A CAGR becomes the growth arrow with its rate in the bubble (years from the
// category names); forecast shading is passed to the native chart when no
// annotation forces shapes.
const col=composeSlide({title:'T',exhibit:{type:'chart.column',heading:'Market',unit:'$B',categories:['2023','2024','2025','2026E'],series:[{name:'m',values:[90,100,121,146.41]}],forecastFrom:'2026E',cagr:{from:'2024',to:'2026E'}}},0);
const c=find(col.items,i=>i.component==='chart.column');
assert.equal(c.props.badge,undefined);
assert.deepEqual(c.props.changeAnnotations,[{start:'2024',end:'2026E',style:'arrow',text:'+21% p.a.'}]);
const plain=composeSlide({title:'T',exhibit:{type:'chart.column',heading:'Market',unit:'$B',categories:['2023','2024','2025','2026E'],series:[{name:'m',values:[90,100,121,146.41]}],forecastFrom:'2026E',change:false}},0);
assert.equal(nativeChartSpec('chart.column',find(plain.items,i=>i.component==='chart.column').props,{x:0,y:0,width:700,height:400}).forecastIndex,3);
const nodes=REGISTRY.get('chart.column').render({id:'c',frame:{x:0,y:0,width:700,height:400},props:c.props}).nodes;
assert.ok(nodes.some(n=>n.role==='annotation-text'&&n.text==='+21% p.a.'));
assert.equal(nodes.find(n=>n.role==='chart-mark'&&n.data.category==='2026E').style.fill.tokenId,'color.chartSeries6');
// Explicit requests select full-period and paired-series changes; unrequested rankings stay neutral.
const grow=composeSlide({title:'T',exhibit:{type:'chart.line',heading:'Sales',unit:'$m',change:true,categories:['2021','2022','2023','2024'],series:[{name:'s',values:[50,60,70,75]}]}},0);
assert.deepEqual(find(grow.items,i=>i.component==='chart.line').props.changeAnnotations,[{start:'2021',end:'2024',style:'end-bubble',text:'+50%'}]);
const gap=composeSlide({title:'Schools beat their peers by 10 points',exhibit:{type:'chart.column',heading:'Share',unit:'%',change:true,categories:['English','Math'],series:[{name:'School',values:[89,90]},{name:'Peers',values:[79,80]}]}},0);
assert.deepEqual(find(gap.items,i=>i.component==='chart.column').props.changeAnnotations.map(a=>a.text),['+10 pp','+10 pp']);
const rank=composeSlide({title:'T',exhibit:{type:'chart.bar',heading:'Share',unit:'%',categories:['A','B','C','D'],series:[{name:'s',values:[1,2,3,4]}]}},0);
assert.equal(find(rank.items,i=>i.component==='chart.bar').props.changeAnnotations,undefined);
assert.equal(nodes.find(n=>n.role==='chart-unit').text,'$B');
// Range chart: floating bars with both ends labelled; native spec carries low/high.
const range=REGISTRY.get('chart.range').render({id:'r',frame:{x:0,y:0,width:700,height:400},props:{categories:['A','B'],low:[300,350],high:[380,460]}}).nodes;
assert.equal(range.filter(n=>n.role==='chart-mark').length,2);
assert.deepEqual(range.filter(n=>n.role==='data-label').map(n=>n.text),['300','380','350','460']);
// The band's ends are labelled outside it, in ink, which a native stacked bar
// cannot do - so the range chart is assembled as shapes.
assert.equal(nativeChartSpec('chart.range',{categories:['A','B'],low:[300,350],high:[380,460]},{x:0,y:0,width:700,height:400}),null);
// A value table under the chart stacks a compact table below it.
const vt=composeSlide({title:'T',exhibit:{type:'chart.column',categories:['a','b'],series:[{name:'m',values:[1,2]}],dataTable:[{label:'Target',values:[4,4]}]}},0); // a data table keeps its chart, thin or not
assert.ok(find(vt.items,i=>i.id==='s01-stack'));
const table=find(vt.items,i=>i.component==='table');assert.equal(table.props.columns.length,3);assert.equal(table.size.height,'hug');
// Lines with several series use end labels, no legend, no per-point labels.
const line=composeSlide({title:'T',exhibit:{type:'chart.line',categories:['a','b'],series:[{name:'x',values:[1,2]},{name:'y',values:[2,3]}]}},0);
const lp=find(line.items,i=>i.component==='chart.line').props;
assert.equal(lp.endLabels,true);assert.equal(lp.legend,false);assert.equal(lp.dataLabels,false);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


class TextPageColumnTests(unittest.TestCase):
    """Five findings in two columns are one list, numbered one to five.

    A text page with more than four points splits them into two columns. The
    split built two independent lists: each restarted its numbering at 1, so the
    executive summary's five findings read as "1 2 3" beside "1 2" - two
    unrelated sets rather than one ranked argument. The split also dropped the
    page's `pointsStyle` on the floor, because neither half was handed it.
    """

    def test_a_split_list_keeps_one_run_of_numbers_and_the_page_style(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const points = ['one','two','three','four','five'].map((n, i) => ({lead: `Finding ${n}`, text: `what the ${n} finding rests on, in a sentence long enough to wrap`}));
// `layout: "text"` is what the executive-summary shape sets; points with
// leads and no layout become a ledger table instead, which is a different page.
const page = composeSlide({id:'s01', layout:'text', title:'Five findings, and the one that decides it', pointsStyle:'numbered', points}, 0);
const row = page.items.find((item) => item.id === 's01-row');
assert.ok(row, 'five points split into two columns');
const [left, right] = row.items;
// One run of numbers across the two columns.
assert.deepEqual(left.props.items.map((i) => i.number), [1, 2, 3]);
assert.deepEqual(right.props.items.map((i) => i.number), [4, 5]);
// Both halves are the style the page asked for.
assert.equal(left.props.marker, 'number');
assert.equal(right.props.marker, 'number');
// The columns own the track rather than hugging the top of the page.
assert.equal(row.size.height, 'fill');
// A style that is not numbered does not acquire numbers it never asked for.
const ruled = composeSlide({id:'s02', layout:'text', title:'Five findings, and the one that decides it', pointsStyle:'ruled', points}, 1);
const ruledRow = ruled.items.find((item) => item.id === 's02-row');
assert.equal(ruledRow.items[0].props.marker, 'rule');
assert.ok(ruledRow.items[1].props.items.every((i) => i.number === undefined));
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_a_page_reads_in_one_grammar(self):
        """A figure beside a table asks for two kinds of reading at once.

        Two tables side by side are peers, and so are two charts and a chart
        beside a table: each is read by finding a value in one and comparing it
        with a value in the other. A staircase, a cycle or a framework is not
        read that way at all - it carries its argument in its shape. Set one
        beside a table and the page has a join down the middle where the first
        kind of reading ends and the second begins.
        """
        result = run_node(r'''
import assert from 'node:assert/strict';
import {splitReadingModes} from './skills/professional-slides/runtime/compose.mjs';
const steps={type:'steps',items:[{label:'Introduce',text:'Earn attachment'},{label:'Connect',text:'Carry it forward'},{label:'Pay off',text:'Spend it'}]};
const table={type:'table',columns:['Model','Reward','Cost'],rows:[['Connected','Accumulation','Homework'],['Standalone','Concentration','Reintroduction']]};
const chart={type:'chart.column',categories:['a','b'],series:[{name:'s',values:[1,2]}]};
const page=(exhibits,extra={})=>({id:'s01',title:'A title that states the finding',exhibits,points:['one','two'],...extra});

// A figure and a table split; the commentary stays with the first page.
const split=splitReadingModes(page([steps,table]));
assert.equal(split.length,2);
assert.deepEqual(split.map(p=>p.exhibit.type),['steps','table']);
assert.ok(split.every(p=>p.exhibits===undefined));
assert.match(split[0].title,/\(1\/2\)$/);
assert.deepEqual(split.map(p=>p.id),['s01-1','s01-2']);
assert.ok(split[0].points&&split[1].points===undefined);

// Peers stay on one page: two tables, two charts, a chart beside a table.
for (const pair of [[table,table],[chart,chart],[chart,table]])
  assert.equal(splitReadingModes(page(pair)).length,1,`${pair.map(e=>e.type)} are peers`);

// `metrics` is a measured exhibit, not a figure: tiles beside a chart are peers.
assert.equal(splitReadingModes(page([{type:'metrics',items:[{value:'4',label:'x'}]},chart])).length,1);

// An explicit arrangement is the author overriding this on purpose.
assert.equal(splitReadingModes(page([steps,table],{arrange:'row'})).length,1);
assert.equal(splitReadingModes(page([steps,table],{layout:'two-up'})).length,1);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])
