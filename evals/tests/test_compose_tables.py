"""deck/v3 composer rules for tables: treatment chosen from content, column
weights from content, and two tables on one page only when they read as one."""
import unittest
from node_probe import run_node


class ComposeTableTests(unittest.TestCase):
    def test_bar_focus_survives_composition_without_changing_scale_or_peer_marks(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {styleTable,toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
import {contrastRatio} from './skills/professional-slides/runtime/palettes.mjs';
const table={type:'table',treatment:'open',columns:['Record',{label:'Change',unit:'units',bar:true}],rows:[['Large','8'],['Subject',{text:'-4',markFocus:true}],['Zero',{text:'0',markFocus:true}]]};
const spec=exhibit=>({schema:'professional-slides.deck/v3',id:'focus',tracker:false,slides:[{id:'s',title:'The named subject falls while the larger peer rises',layout:'exhibit-full',exhibit}]});
const get=exhibit=>planDeck(toDeckPlan(spec(exhibit))).deck.slides[0].nodes;
const nodes=get(table), plain=structuredClone(table);plain.rows[1][1].markFocus=false;plain.rows[2][1].markFocus=false;
const before=get(plain), bars=nodes.filter(n=>n.role==='table-bar'), oldBars=before.filter(n=>n.role==='table-bar');
assert.deepEqual(bars.map(n=>n.frame),oldBars.map(n=>n.frame),'focus must preserve signed geometry and shared units');
assert.equal(bars[0].style.fill.tokenId,oldBars[0].style.fill.tokenId,'unselected maximum remains neutral');
assert.equal(bars[1].style.fill.tokenId,'color.accent');assert.equal(bars[1].data.markFocus,true);
assert.deepEqual(nodes.filter(n=>['table-cell','table-row-band'].includes(n.role)),before.filter(n=>['table-cell','table-row-band'].includes(n.role)),'mark focus adds no background');
const labels=nodes.filter(n=>n.role==='table-cell-text'&&n.data.cellType==='bars');
assert.ok(labels.some(n=>n.text==='0'&&n.data.markFocus),'zero retains its focus label without fabricating a bar');
const tokens=planDeck(toDeckPlan(spec(table))).deck.tokens;
assert.ok(contrastRatio(tokens[labels.find(n=>n.text==='-4').style.color.tokenId].value,tokens['color.surfaceMuted'].value)>=4.5);
const typed=styleTable(table);const focused=(Array.isArray(typed.rows[1])?typed.rows[1]:typed.rows[1].cells)[1];assert.equal(focused.markFocus,true);
const scale=typed.scales[focused.scale];
const multi=structuredClone(typed);multi.scales[focused.scale]={...scale,series:['Current','Prior']};multi.rows=typed.rows.map((row)=>({cells:(Array.isArray(row)?row:row.cells).map((cell,i)=>i===1?{...cell,values:[cell.values[0],cell.values[0]]}:cell)}));
assert.throws(()=>renderTable({id:'multi',frame:{x:0,y:0,width:1160,height:500},props:multi}),/markFocus requires one series/);
const invalid=structuredClone(table);invalid.rows[1][1].markFocus='yes';assert.throws(()=>get(invalid),/markFocus must be boolean/);
console.log('{}');
''')

    def test_explicit_peer_tables_keep_their_semantic_treatments(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const records={type:'table',columns:['Record','Content'],rows:[['Q01','Customer request'],['Q02','Source excerpt']]};
const categories={type:'table',treatment:'categories',columns:[{label:'Evidence class',type:'category'},'Condition'],rows:[['Access','Scoped fields'],['Commitment','No invented approval']]};
for(const layout of ['two-up','two-up-contrast']) for(const reverse of [false,true]) {
 const exhibits=structuredClone(reverse?[categories,records]:[records,categories]);
 const spec={schema:'professional-slides.deck/v3',id:'peer',tracker:false,slides:[{id:'s',title:'Records and evidence classes have different roles',layout,exhibits}]};
 const result=planDeck(toDeckPlan(spec));
 const nodes=result.deck.slides[0].nodes;
 const categoryFills=nodes.filter(n=>n.role==='table-cell'&&n.data?.cellType==='category');
 assert.equal(categoryFills.length,2,'every authored category cell keeps its fill');
 assert.ok(categoryFills.every(n=>n.style.fill),'category cells remain visible surfaces');
 assert.ok(categoryFills.every(n=>reverse?n.frame.x<640:n.frame.x>640),'treatment follows the table when the pair is reversed');
 const recordFills=nodes.filter(n=>n.role==='table-cell'&&n.data?.column===0&&n.data?.cellType==='text');
 assert.equal(recordFills.length,0,'record identifiers do not inherit category fills');
}
console.log('{}');
''')

    def test_clock_times_and_decimal_labels_are_not_sequence_numbers(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {styleTable,toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
for (const labels of [['09:05 · Probe','09:12 · Replay'],['1.1 Component','1.2 Component']]) {
 const table={columns:['Probe','Evidence'],rows:labels.map(label=>[label,'Version record'])};
 const styled=styleTable(table);
 assert.equal(styled.treatment,'open');
 assert.deepEqual(styled.rows.map(row=>row[0]),labels);
 assert.doesNotThrow(()=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'test',slides:[{id:'s',title:'Propagation needs an answer probe',layout:'exhibit-full',exhibit:{type:'table',...table}}]})));
}
const stages=styleTable({columns:['Probe','Evidence'],rows:[['1: Inspect','Record'],['2: Replay','Result']]});
assert.equal(stages.treatment,'categories');
assert.equal(stages.rows[1][0].sectionNumber,2);
console.log('{}');
''')

    def test_automatic_treatments_preserve_styled_rows_and_totals(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {styleTable,toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const decision={columns:['Work package','Hours','Decision output'],rows:[
 ['Review',10,'Independent ratings'],{style:'accented',cells:['Adjudication',1.5,'Ruling']},['Total',11.5,'Review package']]};
const styled=styleTable(decision);
assert.equal(styled.rows[1].style,'accented');
assert.equal(styled.rows[1].cells[2].text,'Ruling');
assert.equal(styled.rows[2].style,'total');
assert.equal(styled.rows[2].cells[1],11.5);
const stages=styleTable({columns:['Stage','Evidence'],rows:[{style:'accented',cells:['Inspect','Record']},['Total','One record']]});
assert.equal(stages.rows[0].cells[0].text,'Inspect');
assert.equal(stages.rows[1].cells[0],'Total');
assert.equal(stages.rows[1].style,'total');
const statuses=styleTable({columns:['Item','Verdict'],rows:[{style:'accented',cells:['Probe','✓']}]});
assert.equal(statuses.rows[0].cells[1].type,'check');
assert.equal(statuses.rows[0].cells[1].value,'yes');
const result=planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'t',tracker:false,slides:[{id:'s',title:'Independent review includes adjudication',layout:'exhibit-full',exhibit:{type:'table',...decision}}]}));
const texts=result.deck.slides[0].nodes.map(n=>n.text || '');
assert.ok(texts.some(t=>String(t).includes('Review package')));
console.log('{}');
''')

    def test_treatment_follows_content_not_the_first_option(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
const stages=styleTable({columns:['Stage','When','Decision at that point'],rows:[['Move alone','Year 1','Rent small'],['Partner joins','Year 2','Re-size']]});
assert.equal(stages.treatment,'categories');
assert.deepEqual(stages.rows.map(r=>r[0].sectionNumber),[1,2]);
assert.equal(stages.rows[0][0].text,'Move alone');
const numbered=styleTable({columns:['Item','Note'],rows:[['1 · First','a'],['2 · Second','b']]});
assert.equal(numbered.treatment,'categories');assert.equal(numbered.rows[1][0].text,'Second');assert.equal(numbered.rows[1][0].sectionNumber,2);
// A last column that names the conclusion - "Then decide", "Verdict", "So
// what" - is the implication drawn from the columns before it, so it gets the
// gutter of chevrons rather than one more cell shaped exactly like the
// evidence. Under three columns a gutter has nothing to separate and the
// conclusion keeps the tint instead.
const decision=styleTable({columns:['Visit','Verify','Then decide'],rows:[['NYC','Seats','Lead option']]});
assert.equal(decision.treatment,'standard');
assert.equal(decision.columns.length,3,'a verdict alone does not invent an inference gutter');
assert.equal(decision.rows[0].filter(c=>c&&c.type==='implication').length,0);
const twoColumn=styleTable({columns:['Option','Verdict'],rows:[['A','Pick this'],['B','Not this']]});
assert.equal(twoColumn.rows[0][1].type,'highlight');
const scorecard=styleTable({columns:['Gate','A','B','C'],rows:[['School','x','y','z']]});
assert.equal(scorecard.treatment,'standard');
const listing=styleTable({columns:['Listing','Size','Rent'],rows:[['332 Jefferson','1 bath','$3,600']]});
assert.equal(listing.treatment,'open');assert.equal(listing.variant,'plain');
// Column weights follow the longest content, so a "Year 1" column stays narrow.
// "Decision at that point" is a verdict, so a gutter sits before it and the
// measured columns are the ones either side of it.
const w=stages.columns.map(c=>c.width), last=w.length-1;
assert.ok(w[1]<w[0]&&w[0]<w[last],`weights ${w}`);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_two_tables_share_a_page_only_when_they_read_as_one_design(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {splitTables} from './skills/professional-slides/runtime/compose.mjs';
const light=(cols,rows)=>({type:'table',columns:cols,rows});
const stages=light(['Stage','When'],[['Move alone','Year 1'],['Partner joins','Year 2']]);
const visits=light(['Visit','Then decide'],[['NYC','Lead option'],['SF','Only if']]);
const listing=light(['Listing','Rent'],[['332 Jefferson','$3,600'],['300 Newark','$4,400']]);
const sizes=light(['Size','Rent'],[['1 bath','$3,600'],['2 bath','$4,400']]);
// Same treatment, both light: one page.
assert.equal(splitTables({title:'T',exhibits:[listing,sizes]}).length,1);
// Different treatments: one page per table, title marked, so-what on every page, points on the first.
const pages=splitTables({id:'seq',title:'Rent for stage one',exhibits:[stages,visits],points:['a'],soWhat:'Do it'});
assert.equal(pages.length,2);
assert.deepEqual(pages.map(p=>p.title),['Rent for stage one (1/2)','Rent for stage one (2/2)']);
assert.deepEqual(pages.map(p=>p.id),['seq-1','seq-2']);
assert.ok(pages.every(p=>p.exhibit&&!p.exhibits&&p.soWhat==='Do it'));
assert.deepEqual(pages.map(p=>p.points),[['a'],undefined]);
// Heavy tables split even when the treatments match.
const heavy=light(['Listing','Rent'],[['x'.repeat(70),'$1']]);
assert.equal(splitTables({title:'T',exhibits:[listing,heavy]}).length,2);
// An explicit layout is respected.
assert.equal(splitTables({title:'T',layout:'two-up',exhibits:[stages,visits]}).length,1);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_stretched_rows_centre_every_cell(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
const props={variant:'standard',treatment:'categories',fillHeight:true,columns:[{label:'Stage',type:'category'},{label:'Decision',type:'text'}],rows:[[{type:'category',text:'Move alone',sectionNumber:1},'Rent small'],[{type:'category',text:'Partner joins',sectionNumber:2},'Re-size']]};
const nodes=renderTable({id:'t',frame:{x:60,y:140,width:1160,height:480},props}).nodes;
for(const row of [0,1]){
 const texts=nodes.filter(n=>n.role==='table-cell-text'&&n.data.row===row);
 const centres=texts.map(n=>n.frame.y+n.frame.height/2);
 assert.ok(Math.abs(centres[0]-centres[1])<.01,'category label and value share a centre line');
 const marker=nodes.find(n=>n.role==='table-section-marker'&&n.data.row===row);
 assert.ok(Math.abs(marker.frame.y+marker.frame.height/2-centres[0])<.01,'marker sits on that line');
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


if __name__ == '__main__':
    unittest.main()


class StatusTableTests(unittest.TestCase):
    def test_observed_use_and_signed_changes_remain_neutral_without_a_verdict(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {styleTable,toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const ex={type:'table',columns:['Agent','Used draft?','Cost change'],rows:[['Control','Yes','+20%'],['Offer','No','-15%']]};
const styled=styleTable(ex);
assert.deepEqual(styled.rows,ex.rows);
const {deck}=planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'neutral',slides:[{id:'s',title:'Actual use does not identify the assigned arm',layout:'exhibit-full',exhibit:ex}]}));
assert.ok(!deck.slides[0].nodes.some(n=>n.role==='table-check'));
const explicit=styleTable({columns:['Case','Verdict','Cost change'],rows:[['A',{type:'check',value:'no'},{type:'text',text:'+20%',tone:'negative'}]]});
assert.equal(explicit.rows[0][1].type,'check');
assert.equal(explicit.rows[0][2].tone,'negative');
console.log('{}');
''')

    def test_verdict_cells_recommended_column_and_total_rows_are_inferred(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {styleTable, paginateTable} from './skills/professional-slides/runtime/compose.mjs';
const t=styleTable({columns:['#','Workstream','Overall status','% complete','Signed'],rows:[['1','Alpha','At risk','40%','✓'],['2','Beta','On track','100%',{type:'check',value:'no'}],['Total','','','62%','']]});
assert.equal(t.rows[0][0].sectionNumber,1);assert.equal(t.rows[0][0].surface,'plain');
assert.deepEqual(t.rows[0][2],{type:'rag',value:'at-risk',text:'At risk'});
assert.deepEqual(t.rows[0][3],{type:'progress',value:40});
assert.deepEqual(t.rows[0][4],{type:'check',value:'yes'});
assert.deepEqual(t.rows[1][4],{type:'check',value:'no'});
assert.equal(t.rows[2].style,'total');
const o=styleTable({recommended:'SystemMax',columns:['Criterion','Option A','SystemMax'],rows:[['Fit','✓','✓']]});
assert.equal(o.highlightColumn,2);
assert.throws(()=>styleTable({recommended:'Nope',columns:['A','B'],rows:[['x','y']]}),/recommended/);
// The density ladder comes before the split: fourteen short rows beside a
// points column are one page set compact or dense, not two pages of seven.
const rows=(n)=>Array.from({length:n},(_,i)=>[`Row ${i+1}`,'x']);
const one=paginateTable({id:'long',title:'Fourteen rows',exhibit:{type:'table',columns:['A','B'],rows:rows(14)},points:['p']});
assert.equal(one.length,1);
assert.ok(['compact','dense'].includes(one[0].exhibit.density),'the table steps down a density instead of splitting');
// Past what the page can hold at its densest, it paginates with the header
// repeated, the title marked and the points on the first page only.
const pages=paginateTable({id:'long',title:'Many rows',exhibit:{type:'table',columns:['A','B'],rows:rows(60)},points:['p']});
assert.ok(pages.length>=2);
assert.deepEqual(pages.map(p=>p.title.replace(/\(\d+\/\d+\)/,'(n/n)'))[0],'Many rows (n/n)');
assert.equal(pages[0].points[0],'p');assert.equal(pages[1].points,undefined);
assert.ok(pages.every(p=>p.exhibit.density==='dense'));
assert.equal(paginateTable({title:'t',exhibit:{type:'table',columns:['A','B'],rows:rows(8)}}).length,1);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_status_cells_render_pills_lamps_bars_and_bands(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
const frame={x:60,y:140,width:1160,height:400};
const props={variant:'standard',treatment:'standard',highlightColumn:1,columns:[{label:'Stream'},{label:'Status',type:'rag'},{label:'Health',type:'lights'},{label:'Done',type:'progress'},{label:'Gate',type:'dot'},{label:'OK',type:'check'}],
 rows:[['Alpha',{value:'at-risk'},{value:'red'},{value:40},{value:true},{value:'yes'}],{style:'group',cells:['Wave two','','','','','']},['Beta',{value:'on-track'},{value:'green'},{value:80},{value:false},{value:'no'}],{style:'total',cells:['All',{value:'behind'},{value:'amber'},{value:60},{value:true},{value:'no'}]}]};
const nodes=renderTable({id:'s',frame,props}).nodes;
const roles=nodes.map(n=>n.role);
assert.equal(roles.filter(r=>r==='table-status-pill').length,3);
assert.equal(roles.filter(r=>r==='table-lamp').length,9);
assert.equal(roles.filter(r=>r==='table-progress-fill').length,3);
assert.equal(roles.filter(r=>r==='table-dot').length,3);
assert.equal(roles.filter(r=>r==='table-check').length,3);
const bands=nodes.filter(n=>n.role==='table-row-band');
assert.deepEqual(bands.map(n=>n.data.rowStyle),['group','total']);
assert.ok(bands.every(n=>n.frame.width>frame.width-12&&n.frame.x===frame.x),'row bands run the full table width');
const column=nodes.find(n=>n.role==='table-column-band');assert.equal(column.data.column,1);
const pill=nodes.find(n=>n.role==='table-status-pill');assert.equal(pill.style.fill.tokenId,'color.negative');assert.equal(pill.style.radius.tokenId,'radius.round');
const lit=nodes.filter(n=>n.role==='table-lamp'&&n.data.lit);assert.deepEqual(lit.map(n=>n.data.lamp),['red','green','amber']);
const fill=nodes.find(n=>n.role==='table-progress-fill'),track=nodes.find(n=>n.role==='table-progress-track');
assert.ok(Math.abs(fill.frame.width/track.frame.width-0.4)<0.001);
// Group rows leave their continuation cells empty and bold their label.
const groupLabel=nodes.find(n=>n.role==='table-cell-text'&&n.text==='Wave two');assert.equal(groupLabel.style.bold,true);
assert.throws(()=>renderTable({id:'bad',frame,props:{...props,rows:[['A',{value:'purple'},{value:'red'},{value:1},{value:true},{value:'yes'}]]}}),/rag cells/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


class BarColumnTests(unittest.TestCase):
    """`bar: true` makes the in-cell bar chart reachable.

    The `bars` cell type has existed the whole time and no deck used one,
    because writing it by hand meant declaring a scale record (min, max, unit,
    label, series) and then `{type: "bars", values: [41], scale: "share"}` in
    every row. The column's own numbers say all of that. This is the same shape
    as `heat: true` and `bubble: true`: a flag on the column, cells written by
    the composer.
    """

    def test_a_bar_column_derives_its_shared_scale_and_keeps_the_figures(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
const table = styleTable({type:'table',
  columns:[{label:'Segment'},{label:'Revenue',unit:'$m'},{label:'Growth to 2027',unit:'% p.a.',bar:true}],
  rows:[['Enterprise','1,240','11.2'],['Mid-market','780','6.4'],['Regulated','560','14.8']]});
// One scale for the column, zero to a round number above its largest value, so
// the bars are proportional to the measure rather than to each other.
const scale = table.scales['growth-to-2027-bar'];
assert.equal(scale.type,'bars');
assert.equal(scale.min,0);
assert.equal(scale.max,15);
assert.equal(scale.unit,'% p.a.');
assert.deepEqual(scale.series,['Growth to 2027']);
// The bar is drawn from the number; the label beside it is what was written.
// House rounding would print 14.8 as 15, and a page cannot say 14.8 in its
// takeaway and 15 in the table the takeaway is drawn from.
const cells = table.rows.map((r) => (Array.isArray(r) ? r : r.cells)[2]);
assert.deepEqual(cells.map((c) => c.values[0]), [11.2, 6.4, 14.8]);
assert.deepEqual(cells.map((c) => c.labels[0]), ['11.2','6.4','14.8']);
assert.ok(cells.every((c) => c.scale === 'growth-to-2027-bar'));
// A negative value opens the scale below zero rather than clipping.
const signed = styleTable({type:'table',columns:[{label:'Team'},{label:'Change',unit:'days',bar:true}],
  rows:[['Payments','-6.2'],['Ledger','0.4']]});
assert.ok(signed.scales['change-bar'].min < 0);
// What the column needs, and what it refuses.
assert.throws(()=>styleTable({type:'table',columns:[{label:'Growth',bar:true}],rows:[['1']]}),/needs a unit/);
assert.throws(()=>styleTable({type:'table',columns:[{label:'Growth',unit:'%',bar:true}],rows:[['soon']]}),/numeric cells/);
assert.throws(()=>styleTable({type:'table',columns:[{label:'Growth',unit:'%',bar:true,heat:true}],rows:[['1']]}),/more than one treatment/);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])


class InferredTreatmentTests(unittest.TestCase):
    """Treatments the composer reads off the content.

    Across ten tables in a generated 50-page deck, not one column carried any
    treatment. The commonest reason is that the content arrives as words -
    "High", "Partial", "None" - which compose as a third column of text. They
    are not text: they are a four-point scale, and a scale drawn as a filled
    disc is compared by looking rather than by reading five words to find the
    one that differs.
    """

    def test_rating_words_on_one_ordinal_scale_are_drawn_as_harvey_balls(self):
        # The words are the scale: every cell one word of one ordinal ladder
        # draws its ball, with the word kept beside it. An authored rubric
        # still wins, and words from no one scale stay words.
        run_node(r"""
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
const columns=['Function','Recognition','Owner'];
const rows=[['Finance','Full','A'],['Operations','Strong','B'],['Sales','Partial','C']];
const inferred=styleTable({columns,rows});
assert.deepEqual(inferred.rows.map(r=>r[1].type),['harvey','harvey','harvey']);
assert.deepEqual(inferred.rows.map(r=>r[1].value),[4,3,2]);
const scale=inferred.scales[inferred.rows[0][1].scale];
assert.equal(scale.label,'Recognition');
assert.deepEqual([scale.anchors[2],scale.anchors[3],scale.anchors[4]],['Partial','Strong','Full']);
const lmh=styleTable({columns:['Option','Risk'],rows:[['A','Low'],['B','High'],['C','Moderate']]});
assert.deepEqual(lmh.rows.map(r=>r[1].value),[1,3,2]);
assert.equal(lmh.scales[lmh.rows[0][1].scale].anchors[2],'Moderate','the anchor is the word the author wrote');
const mixed=styleTable({columns,rows:[['Finance','Full','A'],['Operations','High','B'],['Sales','Partial','C']]});
assert.equal(mixed.rows[1][1],'High','two ladders in one column are not one scale');
const rated=styleTable({columns:['Function',{label:'Readiness',scale:'r'},'Owner'],rows,
 scales:{r:{type:'harvey',label:'Readiness',min:0,max:4,anchors:{0:'None',1:'Weak',2:'Partial',3:'Strong',4:'Full'}}}});
assert.deepEqual(rated.rows.map(r=>r[1].value),[4,3,2]);
assert.equal(rated.rows[0][1].scale,'r');
console.log('{}');
""")

    def test_figures_take_the_treatment_their_shape_supports(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
// A matrix: three columns of exact figures in one unit share one heat scale,
// each cell keeping its figure.
const matrix=styleTable({columns:['Region','2023','2024','2025'],rows:[['North','12%','14%','19%'],['South','8%','9%','11%'],['East','21%','24%','30%']]});
assert.deepEqual(matrix.rows[2].slice(1).map(c=>[c.type,c.figure,c.value]),[['heatmap','21%',3],['heatmap','24%',4],['heatmap','30%',5]]);
assert.equal(new Set(matrix.rows.flatMap(r=>r.slice(1).map(c=>c.scale))).size,1);
// A measure: the first column of figures with a unit carries bars.
const measure=styleTable({columns:['Model','Score','Cost / task'],rows:[['Opus','58','$5.98'],['Fable','53','$7.63'],['Astra','53','$3.26'],['Sol','48','$1.06']]});
assert.equal(measure.columns[1].type,'text','a score with no unit is a length without a measure');
assert.equal(measure.columns[2].type,'bars');
assert.deepEqual(measure.rows.map(r=>r[2].labels[0]),['$5.98','$7.63','$3.26','$1.06']);
// A closing row that adds up the rows above it is the total band.
const total=styleTable({columns:['Line',{label:'Journeys',unit:'million'},{label:'Punctuality',unit:'%'}],
  rows:[['East','14.6','86.1'],['Valley','11.2','89.4'],['Dales','9.1','90.2'],['Airport','7.9','91.5'],['Network','42.8','89.0']]});
assert.equal(total.rows.at(-1).style,'total');
const notTotal=styleTable({columns:['Line',{label:'Journeys',unit:'million'}],rows:[['East','14.6'],['Valley','11.2'],['Dales','9.1'],['Airport','7.9'],['Coast','5.5']]});
assert.notEqual(notTotal.rows.at(-1).style,'total');
// A bound or an approximation is not a figure a bar can stand for; a table
// its author treated is left as treated.
const approx=styleTable({columns:['Firm',{label:'Revenue',unit:'$B'}],rows:[['A','~5'],['B','>2'],['C','1']]});
assert.deepEqual(approx.rows.map(r=>r[1]),['~5','>2','1']);
const authored=styleTable({columns:['Region',{label:'Share',unit:'%',heat:true},'Growth'],rows:[['North','3','12'],['South','2','8'],['East','5','21']],zebra:false});
assert.deepEqual(authored.rows.map(r=>r[2]),['12','8','21']);
// Presence answered under a header that asks: a filled or empty dot.
const presence=styleTable({columns:['Vendor','Has an API?'],rows:[['A','Yes'],['B','No'],['C','Yes']]});
assert.deepEqual(presence.rows.map(r=>[r[1].type,r[1].value]),[['dot',true],['dot',false],['dot',true]]);
console.log('{}');
""")

    def test_a_labelled_table_of_figures_takes_its_bars_and_keeps_its_total(self):
        run_node(r"""
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
// A filled label column styles the names, not the figures beside them.
const pair=styleTable({columns:[{label:'Lab',type:'category'},'Committed round'],rows:[['OpenAI','$122B'],['Anthropic','$65B']]});
assert.equal(pair.columns[1].type,'bars');
assert.equal(pair.columns[1].unit,'$B','the currency and its scale are one unit');
assert.deepEqual(pair.rows.map(r=>r[1].labels[0]),['$122B','$65B']);
// Two rows of a wider table are a record, not a pair of figures.
const record=styleTable({columns:['Place','Rent','Change'],rows:[['A','£2640.00','1250%'],['B','£2000.50','1000%']]});
assert.equal(record.rows[0][1],'£2,640.00');
// A measure table's computed total stays a figure in its band, not a bar off the scale.
const measure=styleTable({total:'auto',columns:[{label:'Line',type:'category'},'Journeys (m)','Train-km (m)'],rows:[['Eastern','14.2','3.1'],['Dales','9.8','2.2'],['Valley','8.1','1.9']]});
assert.equal(measure.columns[1].type,'bars');
assert.deepEqual(measure.rows.at(-1),{style:'total',cells:['Total',{type:'text',text:'32.1'},'7.2']});
// Four-figure values keep their separators beside their bars.
const big=styleTable({columns:[{label:'City',type:'category'},'Rent, £'],rows:[['A','2640'],['B','2000'],['C','1500']]});
assert.deepEqual(big.rows.map(r=>r[1].labels[0]),['2,640','2,000','1,500']);
console.log('{}');
""")

    def test_inferred_bars_give_way_to_figures_in_a_narrow_panel(self):
        result = run_node(r"""
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props=styleTable({columns:['Line','Revenue, $','Basis of the estimate and its period'],rows:[['A','1,250,000.50','Company filing for the year to March, audited'],['B','980,250.25','Press report of the private metric, unaudited'],['C','1,105,750.75','Analyst estimate from the round memo, unaudited']]});
const nodes=(width)=>REGISTRY.get('table').render({id:'t',frame:{x:0,y:0,width,height:400},props}).nodes;
console.log(JSON.stringify({wide:nodes(900).some(n=>n.role==='table-bar'),narrow:nodes(320).some(n=>n.role==='table-bar'),
  figures:nodes(320).filter(n=>n.role==='table-cell-text'&&n.data?.column===1).map(n=>n.text)}));
""")
        self.assertTrue(result["wide"])
        self.assertFalse(result["narrow"])
        self.assertEqual(result["figures"], ["1,250,000.50", "980,250.25", "1,105,750.75"])

    def test_inferred_bars_give_way_where_their_width_would_overflow_the_frame(self):
        # A row block's table has a fixed height: the width the bars take made
        # the names beside them wrap past it, and the page refused to compose.
        result = run_node(r"""
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props=styleTable({columns:[{label:'Lab',type:'category'},'Post-money, $B'],rows:[['OpenAI, March round','852'],['Anthropic, May round','965']]});
const at=(width,height)=>{ try { return REGISTRY.get('table').render({id:'t',frame:{x:0,y:0,width,height},props}).nodes.some(n=>n.role==='table-bar'); } catch (e) { return e.message.slice(0,40); } };
console.log(JSON.stringify({roomy:at(240,160),tight:at(240,100)}));
""")
        self.assertTrue(result["roomy"])
        self.assertIs(result["tight"], False, "the figures stay as text rather than the page refusing")

    def test_cards_wrap_into_a_grid(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const items=[...Array(6)].map((_,i)=>({icon:'target',title:`Card ${i}`,text:'A line about it.'}));
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const grid=composeSlide({title:'A title that states the finding here',exhibit:{type:'cards',tone:'plain',items,columns:3}},0);
const block=find(grid.items,i=>i.id==='s01-exhibit');
assert.equal(block.layout,'flow.column');
assert.equal(block.items.length,2,'six cards at three a row is two rows');
assert.ok(block.items.every(r=>r.component==='cards'&&r.props.items.length===3));
assert.equal(block.items[0].props.columns,undefined,'the row does not re-wrap itself');
// A row that fits stays one row.
const row=composeSlide({title:'A title that states the finding here',exhibit:{type:'cards',tone:'plain',items:items.slice(0,3),columns:3}},0);
assert.equal(find(row.items,i=>i.id==='s01-exhibit').component,'cards');

// Icons and point count do not substitute cards for an authored list.
const page=(n)=>composeSlide({title:'A title that states the finding here',
  points:[...Array(n)].map((_,i)=>({icon:'gear',lead:`Thing ${i}`,text:'What it means in a sentence.'}))},0);
for (const n of [2,3,5,7]) {
  const composed=page(n);
  const leaves=item=>item.component?[item]:(item.items||[]).flatMap(leaves);
  const components=composed.items.flatMap(leaves);
  assert.ok(components.every(item=>item.component==='bullet-list'));
  assert.deepEqual(components.flatMap(item=>item.props.items).map(item=>item.lead),
    Array.from({length:n},(_,i)=>`Thing ${i}`));
}
console.log(JSON.stringify({ok:true}));
''')
