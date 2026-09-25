"""Semantic choices survive layout changes and reviews bind to what was seen."""
import unittest
from node_probe import run_node

class SemanticDesignTests(unittest.TestCase):
    def test_banded_table_bar_keeps_its_label_and_boundary_visible(self):
        run_node("""
import assert from 'node:assert/strict';
import {composeDeck} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import {contrastRatio} from './skills/professional-slides/runtime/palettes.mjs';
for (const palette of ['midnight','evergreen','crimson']) {
 const spec={schema:'professional-slides.deck/v3',id:'banded-bars',palette,contents:false,slides:[
  {id:'comparison',title:'The total reconciles to both groups',exhibit:{type:'table',columns:['Group',{label:'Gross',unit:'$m',bar:true}],rows:[['Alpha',40],['Beta',60],{style:'total',cells:['Total',100]}]}}
 ]};
 const scene=planDeck(composeDeck(spec)).deck.slides[0];
 const bar=scene.nodes.find(n=>n.role==='table-bar'&&n.data?.row===2);
 const value=scene.nodes.find(n=>n.role==='table-cell-text'&&n.data?.row===2&&n.data?.column===1);
 assert.ok(bar&&value,'the total retains the mark and its numeric label');
 const surface=scene.tokens['color.componentPrimary'].value;
 assert.ok(contrastRatio(value.style.color.value,surface)>=4.5,`${palette} total label`);
 assert.ok(Math.max(contrastRatio(bar.style.fill.value,surface),contrastRatio(bar.style.stroke.value,surface))>=3,`${palette} total bar boundary`);
 const first=scene.nodes.find(n=>n.role==='table-bar'&&n.data?.row===0);
 assert.equal(first.style.fill.value,bar.style.fill.value,'row band does not change series identity');
}
console.log('{}');
""")

    def test_style_variants_keep_status_and_focus_contrast(self):
        run_node("""
import assert from 'node:assert/strict';
import {composeDeck} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import {contrastRatio} from './skills/professional-slides/runtime/palettes.mjs';
for(const palette of ['midnight','evergreen','crimson']) {
 const spec={schema:'professional-slides.deck/v3',id:'contrast',palette,contents:false,slides:[
 {id:'status',title:'The two groups have different outcomes',exhibit:{type:'chart.stacked-column',categories:['A','B'],series:[{name:'Cleared',values:[8,4]},{name:'Missed',values:[2,6]}]}},
 {id:'focus',title:'Core contributes half of the total',exhibit:{type:'chart.treemap',items:[{label:'Core',value:50},{label:'Other',value:30},{label:'Remaining',value:20}],highlights:[{category:'Core'}]}},
 {id:'wrap',title:'Change the next work when your preference changes, not when a publisher resets',points:['Choose by the experience you want.']}
 ]};
 const scene=planDeck(composeDeck(spec)).deck;
 const nodes=scene.slides[0].nodes;
 for(const label of nodes.filter(n=>n.role==='data-label'&&n.data?.series)) {
  const mark=nodes.find(n=>n.role==='chart-mark'&&n.data.series===label.data.series&&n.data.category===label.data.category);
  assert.ok(contrastRatio(mark.style.fill.value,label.style.color.value)>=4.5,`${palette} ${label.data.series}`);
 }
 const tokens=scene.slides[0].tokens;
 assert.equal(tokens['style.chartHeading'].value,'text','presets keep a plain heading with inline units');
 assert.ok(contrastRatio(tokens['color.accent'].value,tokens['color.canvas'].value)>=4.5);
 assert.ok(contrastRatio(tokens['color.accent'].value,tokens['color.onPrimary'].value)>=4.5);
 const tiles=scene.slides[1].nodes.filter(n=>n.role==='chart-mark');
 assert.equal(tiles.find(n=>n.data.label==='Core').style.fill.tokenId,'color.accent');
 assert.ok(tiles.filter(n=>n.data.label!=='Core').every(n=>n.style.fill.tokenId==='color.chartComparator'));
 const title=scene.slides[2].nodes.find(n=>n.role==='action-title');
 assert.equal(title.data.textLayout.source,spec.slides[2].title);
 assert.ok(title.data.textLayout.lines.length<=2);
 if(title.data.textLayout.lines.length===2) assert.ok(title.data.textLayout.lines[1].trim().split(/\\s+/).length>1);
}
console.log('{}');
""")

    def test_category_cells_and_property_local_metadata(self):
        run_node("""
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const rows=[['Best picture','1','1'],['Acting','0','2']];
const a=styleTable({columns:['Award class','A','B'],rows:structuredClone(rows)});
const b=styleTable({columns:['Award class',{label:'A',unit:'wins'},'B'],rows:structuredClone(rows)});
assert.equal(a.treatment,b.treatment);assert.equal(a.variant,b.variant);
assert.equal(a.rows[0][2],'1','last numeric column has no automatic bubble');
const category=styleTable({columns:[{label:'Award class',type:'category'},'A','B'],rows});
const nodes=REGISTRY.get('table').render({id:'t',frame:{x:0,y:0,width:900,height:320},props:category}).nodes;
const label=nodes.find(n=>n.type==='text'&&n.text==='Best picture');
assert.ok(label,'category label survives rendering');
assert.equal(category.treatment,'categories');assert.equal(category.variant,'standard');
assert.ok(!category.rows.some(r=>r[0]?.sectionNumber),'unordered taxonomy gets no ordinal marker');
console.log('{}');
""")

    def test_focus_and_references_survive_unrelated_insertions(self):
        run_node("""
import assert from 'node:assert/strict';
import {composeDeck} from './skills/professional-slides/runtime/compose.mjs';
const target={id:'ranking',title:'Alpha leads the comparison',exhibit:{type:'chart.bar',categories:['Alpha','Beta','Gamma','Delta','Epsilon'],series:[{name:'Value',values:[10,5,4,3,2]}]},points:[{lead:'Implication',text:'Choose the size that meets the stated need.'}]};
const reference={id:'source',title:'The figures have a traceable basis',points:['See {{page:ranking}} for the comparison.']};
const spec={schema:'professional-slides.deck/v3',id:'x',slides:[target,reference],contents:false};
const one=composeDeck(spec),two=composeDeck({...spec,slides:[{id:'extra',title:'An unrelated context page',points:['Context only.']},target,reference]});
const findChart=items=>{for(const i of items){if(i.component==='chart.bar')return i;const v=i.items&&findChart(i.items);if(v)return v;}};
for(const deck of [one,two]){const chart=findChart(deck.slides.find(s=>s.id==='ranking').items);assert.deepEqual(chart.props.highlights??[],[]);}
assert.ok(JSON.stringify(one.slides.at(-1)).includes('See 1 for'));
assert.ok(JSON.stringify(two.slides.at(-1)).includes('See 2 for'));
console.log('{}');
""")

    def test_references_survive_splitting_then_pagination(self):
        run_node("""
import assert from 'node:assert/strict';
import {composeDeck} from './skills/professional-slides/runtime/compose.mjs';
const table={type:'table',columns:['Item','Value'],rows:Array.from({length:40},(_,i)=>[`Item ${i}`,String(i)])};
const deck=composeDeck({schema:'professional-slides.deck/v3',id:'nested',contents:false,slides:[
 {id:'long',title:'Both samples have a traceable basis',exhibits:[table,structuredClone(table)]},
 {id:'reference',title:'Inspect both samples',points:['See {{page:long}} for all records.']}
]});
const pages=deck.slides.length-1;
assert.ok(pages>2,'both initial tables need continuation pages');
assert.ok(JSON.stringify(deck.slides.at(-1)).includes(`See 1–${pages} for all records.`));
console.log('{}');
""")

    def test_unordered_findings_do_not_acquire_markers_from_neighbours(self):
        run_node("""
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const slide={title:'Two findings explain the choice',layout:'exhibit-left',exhibit:{type:'chart.bar',categories:['A','B','C','D'],series:[{name:'Value',values:[4,3,2,1]}]},points:[{lead:'Scope',text:'The sample has a stated boundary.'},{lead:'Decision',text:'Use the measured basis for this choice.'}]};
const lists=item=>[...(item.component==='bullet-list'?[item]:[]),...(item.items||[]).flatMap(lists)];
for(const history of [[],['prose'],['numbered','ruled','icon-lead']]) {
 const page=composeSlide(slide,0,undefined,'balanced',1,[],history);
 const points=page.items.flatMap(lists);
 assert.ok(points.length);assert.ok(points.every(p=>p.props.marker==='none'));
}
console.log('{}');
""")

    def test_summary_role_does_not_require_metric_tiles(self):
        run_node("""
import assert from 'node:assert/strict';
import {composeDeck} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const plan=composeDeck({schema:'professional-slides.deck/v3',id:'summary',contents:false,slides:[{id:'answer',shape:'executive-summary',title:'A focused opening answers the reader’s question',points:[{lead:'Answer',text:'Choose the supported option under the stated condition.'},{lead:'Consequence',text:'Begin with the reversible step and evaluate its result.'}]}]});
assert.equal(plan.slides[0].role,'executive-summary');
assert.equal(planDeck(plan).deck.slides[0].role,'executive-summary');
console.log('{}');
""")

    def test_a_review_cannot_survive_a_changed_render(self):
        run_node("""
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {reviewBinding,validateReviewBinding} from './skills/professional-slides/runtime/reviewer.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'review-binding-'));
try{await fs.mkdir(path.join(dir,'rendered'));await fs.writeFile(path.join(dir,'scene.json'),JSON.stringify({slides:[{id:'a'}]}));await fs.writeFile(path.join(dir,'deck.pptx'),'editable');await fs.writeFile(path.join(dir,'build-result.json'),JSON.stringify({pptxPath:path.join(dir,'deck.pptx')}));await fs.writeFile(path.join(dir,'rendered/slide-1.png'),'pixels');
const review={binding:await reviewBinding(dir),inspectedSlides:['a'],rating:7};
assert.deepEqual(await validateReviewBinding(review,dir,['a']),[]);
await fs.writeFile(path.join(dir,'rendered/slide-1.png'),'different pixels');
assert.ok((await validateReviewBinding(review,dir,['a'])).length);
}finally{await fs.rm(dir,{recursive:true,force:true});}
console.log('{}');
""")

    def test_new_deck_contract_rejects_stale_titles_and_missing_summary(self):
        run_node("""
import assert from 'node:assert/strict';
import {validateStageContract} from './skills/professional-slides/runtime/build-deck.mjs';
const summary={id:'answer',shape:'executive-summary',title:'Choose the supported option under the stated condition'};
const evidence={id:'proof',title:'The evidence supports this choice on a common basis'};
const spec={workflow:'new_deck',slides:[summary,evidence]};
const stages={content:{pages:spec.slides.map(s=>({id:s.id,claim:s.title}))},plan:{pages:spec.slides.map(s=>({id:s.id,title:s.title}))}};
assert.doesNotThrow(()=>validateStageContract(spec,stages));
const changed=structuredClone(stages);changed.plan.pages[1].title='A stale plan';
assert.throws(()=>validateStageContract(spec,changed),/changed title/);
const missing=structuredClone(stages);missing.content.pages.pop();
assert.throws(()=>validateStageContract(spec,missing),/missing/);
assert.throws(()=>validateStageContract({...spec,slides:[evidence,summary]},stages),/opening executive summary/);
assert.doesNotThrow(()=>validateStageContract({...spec,workflow:'existing_deck_revision'},{}));
console.log('{}');
""")

    def test_automatic_cards_do_not_discard_authored_phrase_focus(self):
        run_node("""
import assert from 'node:assert/strict';
import {composeDeck} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const deck=composeDeck({schema:'professional-slides.deck/v3',id:'focus',contents:false,slides:[{id:'focused',title:'Three observations support the next step',highlight:'reversible first step',points:[{lead:'Decision',text:'A reversible first step preserves the next choice.'},{lead:'Evidence',text:'The measured comparison puts both options on a common basis.'},{lead:'Review',text:'Observe the result before committing further resources.'}]}]});
const scene=planDeck(deck).deck;
const accents=scene.slides[0].nodes.flatMap(n=>n.runs||[]).filter(r=>r.accent).map(r=>r.text).join('');
assert.ok(accents.includes('reversible first step'));
console.log('{}');
""")

    def test_combo_rates_keep_precision_and_clear_the_secondary_line(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const nodes=REGISTRY.get('chart.combo').render({id:'rates',frame:{x:0,y:0,width:760,height:490},props:{categories:['A','B','C','D'],series:[{name:'Cadence',values:[2,3,3.3,2]},{name:'Gross',values:[888,1298,724,665]}],secondaryAxis:true,secondaryUnit:'$m',valueFormat:{decimals:1},secondaryValueFormat:{decimals:0}}}).nodes;
const label=nodes.find(n=>n.role==='data-label'&&n.data?.series==='Cadence'&&n.data?.category==='C');
assert.equal(label.text,'3.3');
const lineMarks=nodes.filter(n=>n.role==='chart-marker');
assert.ok(lineMarks.every(n=>n.frame.y+n.frame.height<label.frame.y),'secondary marks stay above the primary label field');
assert.equal(nodes.find(n=>n.role==='data-label'&&n.data?.series==='Gross'&&n.data?.category==='C').text,'$724m');
for(const secondaryUnit of ['$m',undefined]) {
 const explicit=REGISTRY.get('chart.combo').render({id:'format',frame:{x:0,y:0,width:760,height:490},props:{categories:['A','B'],series:[{name:'Rate',values:[2,3]},{name:'Gross',values:[1234,2345]}],secondaryAxis:true,secondaryUnit,valueFormat:{decimals:1,prefix:'PRIMARY'},secondaryValueFormat:{decimals:0,prefix:'~',suffix:' units',grouping:false}}}).nodes;
 assert.equal(explicit.find(n=>n.role==='data-label'&&n.data?.series==='Gross'&&n.data?.category==='A').text,'~1234 units');
}
console.log('{}');
""")

    def test_repeated_membership_is_not_a_filled_category(self):
        run_node("""
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
assert.throws(()=>styleTable({columns:[{label:'Publisher',type:'category'},'Title'],rows:[['DC','One'],['DC','Two']]}),/repeats/);
assert.doesNotThrow(()=>styleTable({columns:['Publisher','Title'],rows:[['DC','One'],['DC','Two']]}));
const repeated={columns:[{label:'Publisher',type:'category',surface:'plain'},'Title'],rows:[['DC','One'],['DC','Two']]};
assert.doesNotThrow(()=>styleTable(repeated),'plain category labels may repeat');
assert.throws(()=>styleTable({...repeated,rows:[[{text:'DC',surface:'primary'},'One'],[{text:'DC',surface:'primary'},'Two']]}),/repeats/);
assert.doesNotThrow(()=>styleTable({...repeated,columns:[{label:'Publisher',type:'category'},'Title'],treatment:'dimensions'}));
console.log('{}');
""")

    def test_filled_category_validation_precedes_pagination(self):
        run_node("""
import assert from 'node:assert/strict';
import {paginateTable} from './skills/professional-slides/runtime/compose.mjs';
const rows=Array.from({length:40},(_,i)=>[`Class ${i}`,'Evidence']);
rows.at(-1)[0]=rows[0][0];
assert.throws(()=>paginateTable({id:'taxonomy',title:'Distinct categories',exhibit:{type:'table',columns:[{label:'Class',type:'category'},'Evidence'],rows}}),/repeats/);
console.log('{}');
""")

    def test_status_colours_are_text_only_and_charts_keep_palette(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const chart=REGISTRY.get('chart.stacked-column'),frame={x:0,y:0,width:900,height:450};
const props={categories:['A','B'],series:[{name:'Cleared',values:[8,4]},{name:'Missed',values:[2,6]}]};
const nodes=chart.render({id:'states',frame,props}).nodes;
for(const [name,index] of [['Cleared',1],['Missed',2]]) {
 const marks=nodes.filter(n=>n.role==='chart-mark'&&n.data?.series===name);
 assert.equal(marks.length,2);assert.ok(marks.every(n=>n.style.fill.tokenId===`color.chartSeries${index}`));
}
assert.ok(nodes.filter(n=>n.role==='legend-swatch').every(n=>n.style.fill.tokenId.startsWith('color.chartSeries')));
assert.throws(()=>chart.render({id:'bad',frame,props:{...props,series:props.series.map((s,i)=>({...s,tone:i?'negative':'positive'}))}}),/short text labels/);
const table=REGISTRY.get('table').render({id:'verdicts',frame,props:{columns:['Outcome'],rows:[[{type:'text',text:'Cleared',tone:'positive'}],[{type:'text',text:'Missed',tone:'negative'}]]}}).nodes;
for(const [word,tone] of [['Cleared','positive'],['Missed','negative']]) assert.equal(table.find(n=>n.text===word).style.color.tokenId,`color.${tone}`);
const waterfall=REGISTRY.get('chart.waterfall');
const bridge=waterfall.render({id:'bridge',frame,props:{categories:['Open','Down','Close'],values:[10,-4,6],totals:[0,2]}}).nodes;
assert.ok(bridge.filter(n=>n.role==='chart-mark').every(n=>!['color.positive','color.negative'].includes(n.style.fill.tokenId)));
console.log('{}');
""")

    def test_continuation_scale_survives_header_footnote_markers(self):
        run_node("""
import assert from 'node:assert/strict';
import {barScales,styleTable,changeFromContent,composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const whole={columns:['Film',{label:'Multiple',unit:'x budget',bar:true}],rows:[['A','7.2'],['B','2.4']]};
const scales=barScales(whole);
const page=styleTable({...whole,columns:['Film',{label:'Multiple¹',unit:'x budget',bar:true}],rows:[['B','2.4']],scales});
assert.equal(page.scales['multiple-bar'].max,7.5);assert.equal(page.rows[0][1].scale,'multiple-bar');
assert.equal(changeFromContent({type:'chart.column',categories:['2019','2020','2021'],series:[{name:'A',values:[2,3,2]}]},'A grew').changeAnnotations,undefined);
assert.throws(()=>composeSlide({title:'Evidence must survive',layout:'text',exhibit:{type:'table',columns:['A','B'],rows:[['One','Two']]}},0),/cannot discard/);
console.log('{}');
""")

    def test_decision_nodes_keep_hierarchy_and_visible_connection_ports(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const nodes=REGISTRY.get('organization').render({id:'decision',frame:{x:0,y:0,width:900,height:500},props:{nodes:[{id:'a',label:'Choose a work',x:.3,y:0,width:.4,height:.2},{id:'b',label:'The named work',detail:'The preference it serves',x:0,y:.5,width:.3,height:.4}],connectors:[{from:'a',to:'b'}]}}).nodes;
assert.ok(nodes.some(n=>n.role==='node-text'&&n.data.textLayout.source==='The preference it serves'));
const lines=nodes.filter(n=>n.role==='tree-connector');const last=lines.at(-1);
assert.equal(last.data.x1,last.data.x2);assert.equal(last.data.y2,250);assert.ok(last.data.y1<last.data.y2);
console.log('{}');
""")

    def test_continuation_preserves_physical_units_and_unordered_matrix(self):
        run_node("""
import assert from 'node:assert/strict';
import {paginateTable,styleTable,composeSlide} from './skills/professional-slides/runtime/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const slide={id:'t',title:'A measured comparison',layout:'exhibit-full',exhibit:{type:'table',density:'compact',columns:['Item',{label:'Multiple',unit:'x budget',bar:true}],rows:Array.from({length:24},(_,i)=>[i<12?'Short':'A much longer item label',i<12?'300':'1,200.0'])}};
const pages=paginateTable(slide);assert.ok(pages.length>1);assert.deepEqual(pages[0].exhibit.columns,pages.at(-1).exhibit.columns);
const units=pages.map((p,i)=>{const nodes=REGISTRY.get('table').render({id:`t${i}`,frame:{x:0,y:0,width:1000,height:500},props:styleTable(p.exhibit)}).nodes;const n=nodes.find(n=>n.role==='table-bar');return n.frame.width/n.data.value;});
assert.ok(Math.max(...units)-Math.min(...units)<0.001);
const matrix=composeSlide({title:'A distinct measure has evidence',shape:'findings-matrix',columns:['Measure','Proof'],rows:[{label:'A',cells:[{text:'Evidence'}]}]},0);assert.ok(!JSON.stringify(matrix).includes('sectionNumber'));
console.log('{}');
""")

    def test_peer_bars_share_pixels_per_unit_and_native_bars_start_at_zero(self):
        run_node("""
import assert from 'node:assert/strict';
import {composeDeck} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const panel=(categories,values)=>({type:'chart.bar',heading:'Scores',unit:'points',categories,series:[{name:'Score',values}],yMax:100});
const spec={schema:'professional-slides.deck/v3',id:'peers',contents:false,slides:[
{id:'paired',title:'Two matched panels preserve comparable lengths',layout:'two-up',exhibits:[panel(['Short','Other'],[94,87]),panel(['A much longer category name','Another long label'],[90,81])]},
{id:'single',title:'Positive magnitudes start at zero',layout:'exhibit-full',exhibit:panel(['A','B'],[94,87])}]};
const deck=planDeck(composeDeck(spec)).deck;
const bars=deck.slides[0].nodes.filter(n=>n.role==='chart-mark');
const find=k=>bars.find(n=>n.data.category===k);
assert.ok(Math.abs(find('Short').frame.width/94-find('A much longer category name').frame.width/90)<0.02);
assert.ok(!deck.slides[0].componentInstances.some(c=>c.nativeChart),'peers retain exact editable geometry');
assert.equal(deck.slides[1].componentInstances.find(c=>c.nativeChart).nativeChart.yMin,0);
console.log('{}');
""")

    def test_line_series_identity_survives_disabling_endpoint_labels(self):
        run_node("""
import assert from 'node:assert/strict';
import {composeDeck} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const deck=planDeck(composeDeck({schema:'professional-slides.deck/v3',id:'lines',contents:false,slides:[{id:'line',title:'Two series remain identifiable',layout:'exhibit-full',exhibit:{type:'chart.line',heading:'Observed outcomes',unit:'units',native:false,endLabels:false,directLabels:false,categories:['A','B','C'],series:[{name:'First population',values:[1,2,3]},{name:'Second population',values:[3,1,2]}]}}]})).deck;
for(const name of ['First population','Second population']) assert.ok(deck.slides[0].nodes.some(n=>n.text===name));
console.log('{}');
""")

    def test_endpoint_name_owns_the_last_value(self):
        run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const nodes=REGISTRY.get('chart.line').render({id:'trend',frame:{x:0,y:0,width:1160,height:440},props:{categories:['A','B','C'],series:[{name:'Population',values:[2,4,3]}],dataLabels:true,endLabels:true}}).nodes;
const labels=nodes.filter(n=>n.role==='data-label');
assert.ok(labels.some(n=>n.text==='Population 3'));
assert.ok(!labels.some(n=>n.text==='3'),'the final value appears with the series name only');
assert.ok(labels.some(n=>n.text==='4'),'intermediate values remain visible');
console.log('{}');
""")

    def test_explicit_peer_table_geometry_survives_style_compilation(self):
        run_node("""
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const scales={'length-bar':{type:'bars',label:'Length',unit:'issues',series:['Length'],min:0,max:140,labelTexts:['4','75','48','133']}};
const make=rows=>styleTable({columns:['Work',{label:'Length',unit:'issues',bar:true},'Context'],columnWidths:[.45,.30,.25],scales,rows});
const tables=[make([['Short',4,'None'],['Another',75,'None']]),make([['A much longer work name',48,'Moderate'],['Other',133,'None']])];
const units=tables.map((props,i)=>{assert.deepEqual(props.columnWidths,[.45,.30,.25]);const nodes=REGISTRY.get('table').render({id:`peer${i}`,frame:{x:0,y:0,width:572,height:460},props}).nodes;const mark=nodes.find(n=>n.role==='table-bar');return mark.frame.width/mark.data.value;});
assert.ok(Math.abs(units[0]-units[1])<0.001,'matching domain and explicit column geometry preserve units');
console.log('{}');
""")

    def test_explicit_domain_uses_readable_tick_intervals_without_extra_headroom(self):
        run_node("""
import assert from 'node:assert/strict';
import {axes} from './skills/professional-slides/runtime/charts.mjs';
const frame={x:100,y:100,width:600,height:300};
const labels=(max)=>axes('a',frame,0,max).filter(n=>n.role==='axis-label').map(n=>n.text);
assert.deepEqual(labels(6),['0','2','4','6']);
assert.deepEqual(labels(100),['0','25','50','75','100']);
console.log('{}');
""")
