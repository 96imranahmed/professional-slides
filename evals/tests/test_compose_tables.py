"""deck/v3 composer rules for tables: treatment chosen from content, column
weights from content, and two tables on one page only when they read as one."""
import unittest
from node_probe import run_node

AUTHOR = "./skills/professional-slides/runtime/author-deck.mjs"

PAGE = """
const S = { kind: 'comparison', what: 'Company filings and press reports, 2025 to 2026' };
const base = { takeaway: false, why: 'The page compares the two firms on the same terms', settles: S, adds: 'The commentary names what the exhibit cannot: the terms behind each figure' };
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""

PLANNED = '''
import {{ toDeckPlan }} from './evals/support/compose.mjs';
import {{ planDeck }} from './skills/professional-slides/runtime/planner.mjs';
const plan = (slides) => planDeck(toDeckPlan({{ schema: 'professional-slides.deck/v3', id: 'd', slides }})).deck;
'''


class ComposeTableTests(unittest.TestCase):
    def test_bar_focus_survives_composition_without_changing_scale_or_peer_marks(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {styleTable,toDeckPlan} from './evals/support/compose.mjs';
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
import {toDeckPlan} from './evals/support/compose.mjs';
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
import {styleTable,toDeckPlan} from './evals/support/compose.mjs';
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
import {styleTable,toDeckPlan} from './evals/support/compose.mjs';
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
import {styleTable} from './evals/support/compose.mjs';
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
import {splitTables} from './evals/support/compose.mjs';
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
import {styleTable,toDeckPlan} from './evals/support/compose.mjs';
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
import {styleTable, paginateTable} from './evals/support/compose.mjs';
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
assert.deepEqual(bands.map(n=>n.data.rowStyle),['total']);
assert.ok(bands.every(n=>n.frame.width>frame.width-12&&n.frame.x===frame.x),'row bands run the full table width');
// A group row is a subheading on one heavier rule across the table, not a band.
const groupRule=nodes.find(n=>n.role==='table-group-rule');
assert.equal(groupRule.data.row,1);assert.equal(groupRule.frame.x,frame.x);assert.ok(groupRule.frame.width>frame.width-12);
assert.equal(groupRule.style.lineWidth.tokenId,'line.standard');
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
import {styleTable} from './evals/support/compose.mjs';
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
import {styleTable} from './evals/support/compose.mjs';
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
import {styleTable} from './evals/support/compose.mjs';
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
// A bound or an approximation is a figure written as more than a point: its
// bar is drawn for what it says (an approximation as its bar, a lower bound
// left open), the figure kept as written; a table its author treated is left
// as treated.
const approx=styleTable({columns:['Firm',{label:'Revenue',unit:'$B'}],rows:[['A','~5'],['B','>2'],['C','1']]});
assert.deepEqual(approx.rows.map(r=>[r[1].type,r[1].values[0],r[1].bound,r[1].labels[0]]),[['bars',5,'approx','~5'],['bars',2,'lower','>2'],['bars',1,undefined,'1']]);
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
import {styleTable} from './evals/support/compose.mjs';
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

    def test_devices_that_say_nothing_about_the_figures_leave_them_their_treatment(self):
        # The shared definition (gates/table-treatments.json): an implication
        # gutter, banding and a value pill are not treatments, so a measure
        # table with a "What it means" column still takes its bars. A device
        # the definition names - here a highlighted row - is the table's own.
        run_node(r"""
import assert from 'node:assert/strict';
import {styleTable} from './evals/support/compose.mjs';
const rows=[['Eastern','14.6','Electrify first'],['Valley','11.2','Extend the sidings'],['Dales','9.1','Grows first']];
const columns=['Line',{label:'Journeys',unit:'million'},{label:'What it means',implication:true}];
const gutter=styleTable({columns,rows});
assert.equal(gutter.columns[1].type,'bars','bars beside the implication gutter');
assert.ok(gutter.columns.some(c=>c.type==='implication'));
assert.equal(styleTable({columns,rows,zebra:true}).columns[1].type,'bars','banding is not a treatment');
const accented=styleTable({columns,rows,highlightRow:'Dales'});
assert.notEqual(accented.columns[1].type,'bars','an accented row is the treatment the author chose');
console.log('{}');
""")

    def test_a_derived_rank_reads_the_figures_under_their_bars(self):
        # The bars are drawn before the rank is derived; read as text the bar
        # cells were empty and every row ranked first.
        result = run_node(r"""
import {styleTable} from './evals/support/compose.mjs';
const last=(t)=>t.rows.map(r=>(Array.isArray(r)?r:r.cells).at(-1));
const authored=styleTable({columns:['Company',{label:'Deal size',unit:'$m',bar:true}],rows:[['A','300'],['B','450'],['C','149']],derive:['rank'],deriveFrom:'Deal size'});
const inferred=styleTable({columns:['Company',{label:'Deal size',unit:'$m'}],rows:[['A','300'],['B','450'],['C','149']],derive:['rank','share']});
console.log(JSON.stringify({authored:last(authored),inferred:inferred.rows.map(r=>(Array.isArray(r)?r:r.cells).slice(-2)),bars:inferred.columns[1].type}));
""")
        self.assertEqual(result["authored"], ["2", "1", "3"])
        self.assertEqual(result["bars"], "bars")
        self.assertEqual(result["inferred"], [["2", "33"], ["1", "50"], ["3", "17"]])

    def test_a_figure_written_as_a_bound_a_range_or_missing_is_drawn_for_what_it_says(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import {styleTable, quantity} from './evals/support/compose.mjs';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
// What a cell says: exact, approximate, bounded, a range, or none of those.
assert.deepEqual(quantity('$4,500–5,600'),{value:5600,low:4500,mark:'$|',bound:'range'});
assert.deepEqual(quantity('3-5%'),{value:5,low:3,mark:'|%',bound:'range'});
assert.equal(quantity('500+').bound,'lower');
assert.equal(quantity('at least $40B').bound,'lower');
assert.equal(quantity('<5%').bound,'upper');
assert.equal(quantity('c. 40%').bound,'approx');
assert.equal(quantity('$3-£5'),null,'two currencies are not one range');
assert.equal(quantity('5-3'),null,'a range runs low to high');
assert.equal(quantity('Company, March'),null);
const table=styleTable({columns:['Product',{label:'Revenue run rate',unit:'$B'},'Basis'],
  rows:[['Code','>$2.5B','Company'],['Chat','~$1.2B','Estimate'],['API','$0.8B','Company'],['Agents','<$0.5B','Press'],['Ads','n/a','Not disclosed']]});
const cells=table.rows.map(r=>r[1]);
assert.deepEqual(cells.slice(0,4).map(c=>[c.type,c.values[0],c.bound]),[['bars',2.5,'lower'],['bars',1.2,'approx'],['bars',0.8,undefined],['bars',0.5,'upper']]);
assert.deepEqual(cells[4],{type:'text',text:'n/a',align:'right'},'a missing figure keeps its words, with no bar');
assert.deepEqual(cells.slice(0,4).map(c=>c.labels[0]),['>$2.5B','~$1.2B','$0.8B','<$0.5B']);
assert.ok(table.scales['revenue-run-rate-bar'].max>=2.75,'a lower bound keeps room to open past its end');
// A heat matrix colours a cell at its figure: a bounded column is not one.
const heat=styleTable({columns:['Region','2023','2024','2025'],rows:[['North','12%','14%','>19%'],['South','8%','9%','11%'],['East','21%','24%','30%']]});
assert.notEqual(heat.rows[0][1].type,'heatmap');
// An author's bar column reads a range as its span and refuses one it cannot read.
const rent=styleTable({columns:['Listing',{label:'Rent',unit:'$ a month',bar:true}],rows:[['A','$3,600'],['B','$4,400'],['Range','$4,500–5,600']]});
assert.deepEqual([rent.rows[2][1].bound,rent.rows[2][1].low,rent.rows[2][1].values[0]],['range',4500,5600]);
assert.throws(()=>styleTable({columns:['Listing',{label:'Rent',unit:'$',bar:true}],rows:[['A','$3,600 to $4,000 or so'],['B','2']]}),/numeric cells/);
// Drawn: a lower bound is its bar and an open end; an upper bound and a range
// are a span with no point claimed inside it; the missing figure draws nothing.
const nodes=renderTable({id:'t',frame:{x:0,y:0,width:1160,height:420},props:table}).nodes;
const rows=(role)=>nodes.filter(n=>n.role===role).map(n=>n.data.row);
assert.deepEqual(rows('table-bar'),[0,1,2]);
assert.deepEqual(rows('table-bar-open'),[0]);
assert.ok(nodes.find(n=>n.role==='table-bar-open').data.endArrow);
assert.deepEqual(rows('table-bar-range'),[3]);
const span=renderTable({id:'r',frame:{x:0,y:0,width:900,height:300},props:rent}).nodes.find(n=>n.role==='table-bar-range');
const bars=renderTable({id:'r',frame:{x:0,y:0,width:900,height:300},props:rent}).nodes.filter(n=>n.role==='table-bar');
assert.ok(span.frame.x>bars[0].frame.x+10,'the range starts at its low end, not at zero');
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result["ok"])

    def test_inferred_bars_give_way_to_heat_in_a_narrow_panel(self):
        # Where the bars do not fit, the column keeps its figures and takes the
        # treatment that needs no width - heat, keyless because every cell
        # prints its figure - rather than going back to a plain column.
        result = run_node(r"""
import {styleTable} from './evals/support/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props=styleTable({columns:['Line','Revenue, $','Basis of the estimate and its period'],rows:[['A','1,250,000.50','Company filing for the year to March, audited'],['B','980,250.25','Press report of the private metric, unaudited'],['C','1,105,750.75','Analyst estimate from the round memo, unaudited']]});
const nodes=(width)=>REGISTRY.get('table').render({id:'t',frame:{x:0,y:0,width,height:400},props}).nodes;
const narrow=nodes(320);
console.log(JSON.stringify({wide:nodes(900).some(n=>n.role==='table-bar'),narrow:narrow.some(n=>n.role==='table-bar'),
  heat:narrow.filter(n=>n.role==='table-cell'&&n.data?.cellType==='heatmap').length,key:narrow.some(n=>/^table-legend/.test(n.role)),
  figures:narrow.filter(n=>n.role==='table-cell-text'&&n.data?.column===1).map(n=>n.text)}));
""")
        self.assertTrue(result["wide"])
        self.assertFalse(result["narrow"])
        self.assertEqual(result["heat"], 3)
        self.assertFalse(result["key"])
        self.assertEqual(result["figures"], ["1,250,000.50", "980,250.25", "1,105,750.75"])

    def test_a_range_the_bars_cannot_hold_marks_the_row_the_title_ranks(self):
        # The rent table of a half-width panel: its bars are too cramped, and a
        # shade cannot state "$4,500-5,600". The title says "cheapest", and one
        # row's figure is the least whatever the range, so that row is accented;
        # a title that ranks nothing leaves the figures as written.
        result = run_node(r"""
import {toDeckPlan} from './evals/support/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const table={type:'table',panelHeading:'Two-bedroom asks',columns:[{label:'Listing',type:'text'},{label:'Size',unit:'bath / sq ft',type:'text'},{label:'Rent',unit:'$ a month',align:'right'}],
  rows:[['332 Jefferson #415','1 bath / 1,000 sq ft','$3,600'],['300 Newark #4F','2 bath / 1,150 sq ft','$4,400'],['Park Slope range','900-1,000 sq ft','$4,500-5,600']]};
const chart={type:'chart.column',heading:'Share meeting NJ standards',unit:'%',categories:['ELA','Math'],series:[{name:'Connors',values:[73,65]},{name:'District',values:[75,67]}]};
const page=(title)=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',slides:[{id:'s',title,exhibits:[chart,JSON.parse(JSON.stringify(table))]}]})).deck.slides[0].nodes;
const accented=(nodes)=>nodes.filter(n=>n.role==='table-row-band'&&n.data?.rowStyle==='accented').map(n=>n.data.row);
const ranked=page('Hoboken is the midtown fallback: cheapest and safest, with a weaker school');
const plain=page('Hoboken is the midtown fallback, with a weaker school');
console.log(JSON.stringify({ranked:accented(ranked),bars:ranked.some(n=>n.role.startsWith('table-bar')),plain:accented(plain)}));
""")
        self.assertEqual(result["ranked"], [0])
        self.assertFalse(result["bars"])
        self.assertEqual(result["plain"], [])

    def test_inferred_bars_give_way_where_their_width_would_overflow_the_frame(self):
        # A row block's table has a fixed height: the width the bars take made
        # the names beside them wrap past it, and the page refused to compose.
        result = run_node(r"""
import {styleTable} from './evals/support/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props=styleTable({columns:[{label:'Lab',type:'category'},'Post-money, $B'],rows:[['OpenAI, March round','852'],['Anthropic, May round','965']]});
const at=(width,height)=>{ try { const nodes=REGISTRY.get('table').render({id:'t',frame:{x:0,y:0,width,height},props}).nodes;
  return nodes.some(n=>n.role==='table-bar') ? 'bars' : nodes.some(n=>n.data?.cellType==='heatmap') ? 'heat' : 'plain'; } catch (e) { return e.message.slice(0,40); } };
console.log(JSON.stringify({roomy:at(300,160),tight:at(300,100)}));
""")
        self.assertEqual(result["roomy"], "bars")
        self.assertEqual(result["tight"], "heat", "the figures keep a treatment rather than the page refusing")

    def test_cards_wrap_into_a_grid(self):
        run_node(r'''
import assert from 'node:assert/strict';
import {composeSlide} from './evals/support/compose.mjs';
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


class FindingsMatrixMarkTests(unittest.TestCase):
    def test_a_matrix_headed_by_players_carries_their_marks_and_an_accented_row(self):
        # A findings matrix compares the declared players column by column:
        # its headers take the players' marks as a table's do (the matrix's
        # own columns were never read, so they stayed names), and the row the
        # argument turns on is banded in the accent.
        result = run_node(r"""
import assert from 'node:assert/strict';
import {compilePage} from './skills/professional-slides/runtime/page-types.mjs';
import {toDeckPlan} from './evals/support/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import {TABLE_VARIANTS} from './skills/professional-slides/runtime/table-fixtures.mjs';
const page={id:'m',type:'matrix',form:'findings-matrix',commentary:'in-exhibit',takeaway:false,
  why:'Each lever is set against both labs, finding by finding',settles:{kind:'comparison',what:'services commitments of the two labs'},
  title:'Both labs build services channels; one puts a sum on it',
  columns:['Services lever','Anthropic','OpenAI route'],
  rows:[{label:'Partner programme',cells:['A network launched in March to move pilots into workflows','A lab set up to drive enterprise adoption']},
        {label:'Committed support',cells:['$100 million of initial support this year','No sum published for partner support'],style:'accented'},
        {label:'Integrators',cells:['A plan to certify 30,000 professionals','Integrators engaged for training and deployment']}],
  source:'Illustrative'};
const slide=compilePage(page,0,{players:[{name:'Anthropic'},{name:'OpenAI'}]});
const alts=slide.columns.map(c=>typeof c==='string'?null:c.logo?.alt??null);
// Logos on disk replace the placeholders, as the build fills them.
const media=TABLE_VARIANTS['category-logo-comparison'].props.rows[0][1].media;
slide.columns=slide.columns.map(c=>typeof c==='string'?c:{...c,logo:media});
const scene=planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',slides:[slide]})).deck.slides[0];
const roles=scene.nodes.map(n=>n.role);
const band=scene.nodes.find(n=>n.role==='table-row-band'&&n.data?.rowStyle==='accented');
let refused=null; try { toDeckPlan({schema:'professional-slides.deck/v3',id:'d',slides:[{...slide,rows:slide.rows.map((r,i)=>i?r:{...r,style:'total'})}]}); } catch (e) { refused=e.message; }
console.log(JSON.stringify({alts,logos:roles.filter(r=>r==='table-header-logo').length,band:band?.data?.row??null,refused}));
""")
        self.assertEqual(result["alts"], [None, "Anthropic logo", "OpenAI logo"], "the row-label header carries no mark")
        self.assertEqual(result["logos"], 2)
        self.assertEqual(result["band"], 1)
        self.assertIn("accented", result["refused"] or "")

    def test_a_heat_key_names_missing_states_only_where_a_cell_is_missing(self):
        result = run_node(r"""
import {styleTable} from './evals/support/compose.mjs';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
const key=(rows)=>{ const props=styleTable({columns:['Rent',{label:'$305k',unit:'%'},{label:'$385k',unit:'%'},{label:'$460k',unit:'%'}],rows});
  return renderTable({id:'t',frame:{x:0,y:0,width:900,height:400},props}).nodes.filter(n=>n.role==='table-legend').map(n=>n.text).join(' '); };
const full=key([['$4,000','15.7','12.5','10.4'],['$5,500','21.6','17.1','14.3'],['$6,500','25.6','20.3','17.0']]);
const scales={h:{type:'heatmap',label:'Score',min:1,max:5,anchors:{1:'Low',5:'High'},palette:'theme-sequential'}};
const gap=renderTable({id:'g',frame:{x:0,y:0,width:900,height:400},props:styleTable({scales,columns:['Firm','Score'],rows:[['A',{type:'heatmap',value:2,scale:'h'}],['B',{type:'heatmap',value:'missing',scale:'h'}],['C',{type:'heatmap',value:5,scale:'h'}]]})}).nodes.filter(n=>n.role==='table-legend').map(n=>n.text).join(' ');
console.log(JSON.stringify({full,gap}));
""")
        self.assertEqual(result["full"], "10.4% 25.6%", "a ramp from the least figure to the greatest, in their units")
        self.assertNotIn("Missing", result["full"], "no cell is missing, so the key does not define the state")
        self.assertIn("Missing = Not available", result["gap"])

    def test_a_heat_key_reads_in_the_figures_units_and_may_be_dropped(self):
        # "$305k, $385k, $460k (%): 1 = 10.4; 5 = 25.6" over swatches numbered
        # one to five read as a second scale the table does not have. The key
        # is a ramp from the least figure to the greatest, in their units; and
        # since every cell prints its figure, the author may drop it.
        result = run_node(r"""
import {styleTable} from './evals/support/compose.mjs';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
const table={columns:['Monthly rent',{label:'$305k',unit:'%'},{label:'$385k',unit:'%'},{label:'$460k',unit:'%'}],rows:[['$4,000','15.7','12.5','10.4'],['$5,500','21.6','17.1','14.3'],['$6,500','25.6','20.3','17.0']]};
const draw=(extra)=>renderTable({id:'t',frame:{x:0,y:0,width:560,height:400},props:styleTable({...table,...extra})}).nodes;
const keyed=draw({}), dropped=draw({legend:false});
const ramp=keyed.filter(n=>n.role==='table-legend-swatch'&&n.data?.heatStep!==undefined).map(n=>n.data.heatStep);
console.log(JSON.stringify({texts:keyed.filter(n=>n.role==='table-legend').map(n=>n.text),ramp,numbered:keyed.some(n=>n.role==='table-cell-text'&&/^[1-5]$/.test(n.text)),
  dropped:dropped.filter(n=>/^table-legend/.test(n.role)).length,heat:dropped.filter(n=>n.data?.cellType==='heatmap'&&n.role==='table-cell').length}));
""")
        self.assertEqual(result["texts"], ["10.4%", "25.6%"])
        self.assertEqual(result["ramp"], [1, 2, 3, 4, 5])
        self.assertFalse(result["numbered"], "no swatch carries a step number")
        self.assertEqual(result["dropped"], 0)
        self.assertEqual(result["heat"], 9, "the cells keep their shades without the key")


class CardLogoTests(unittest.TestCase):
    def test_a_card_about_a_recognisable_subject_draws_its_logo(self):
        # A card's `logo` satisfied PROFILE_UNPICTURED and was then dropped by
        # the renderer, so a product page showed generic icons. An embedded mark
        # takes the icon's slot at one visual area; a mark with no file yet
        # keeps the icon.
        result = run_node(r"""
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {TABLE_VARIANTS} from './skills/professional-slides/runtime/table-fixtures.mjs';
const [wide, other] = [TABLE_VARIANTS['category-logo-comparison'].props.rows[0][1].media, TABLE_VARIANTS['category-logo-comparison'].props.rows[1][1].media];
const card = (title, extra) => ({ title, icon: 'people', text: 'A product the page compares on its published measure.', ...extra });
const render = (items) => REGISTRY.get('cards').render({ id: 'c', frame: { x: 0, y: 0, width: 1160, height: 420 }, props: { tone: 'outline', items } }).nodes;
const marked = render([card('First', { logo: wide }), card('Second', { logo: other })]);
const pending = render([card('First', { logo: { alt: 'First logo' } }), card('Second')]);
const logos = marked.filter((n) => n.role === 'card-logo').map((n) => n.frame.width * n.frame.height);
console.log(JSON.stringify({ logos: logos.length, icons: marked.filter((n) => n.role.startsWith('card-icon')).length,
  ratio: Math.max(...logos) / Math.min(...logos), pendingIcons: new Set(pending.filter((n) => n.role.startsWith('card-icon')).map((n) => n.id.split(':')[0])).size }));
""")
        self.assertEqual(result["logos"], 2)
        self.assertEqual(result["icons"], 0, "the mark replaces the icon")
        self.assertLess(result["ratio"], 1.3, "two marks of different shapes read at one weight")
        self.assertGreaterEqual(result["pendingIcons"], 1, "a mark with no file keeps the icon")


class RatingColumnTests(unittest.TestCase):
    """"Open" is not zero, and a column that says so is still a rating."""

    def test_a_rating_column_survives_a_minority_of_honest_unknowns(self):
        """First cold run: two honest "Open" cells in twelve kept a rating column plain text, so the ten rated rows lost their scale."""
        # The brief asked for exactly this: ten markets rated on a four-point
        # scale and two with no local data, which had to "stay visible as open
        # rather than being scored as zero". Every cell had to be a scale word,
        # so the column stayed plain text and the ten that were rated lost their
        # scale - the deck's densest table drew no treatment at all.
        run_node('''
import assert from 'node:assert/strict';
import {styleTable as rawStyleTable} from './evals/support/compose.mjs';
const readiness={type:'harvey',label:'Data readiness',min:0,max:4,anchors:{0:'None',1:'Weak',2:'Partial',3:'Strong',4:'Full'}};
const styleTable=ex=>rawStyleTable({...ex,scales:{readiness},columns:ex.columns.map((c,i)=>i===1?{...(typeof c==='string'?{label:c}:c),scale:'readiness'}:c)});
const markets=['Netherlands','Ireland','Sweden','Poland','Germany','France','Spain','Italy','Portugal','Czechia','Romania','Greece'];
const ratings=['Full','Full','Full','Strong','Strong','Partial','Strong','Partial','Partial','Weak','Open','Open'];
const ex={columns:['Market',{label:'Data readiness',unit:'four-point assessment'},'Cost to serve'],
  rows:markets.map((m,i)=>[m,ratings[i],String(20+i)])};
const out=styleTable(ex);
const cells=out.rows.map(r=>r[1]);
assert.equal(cells.filter(c=>c&&c.type==='harvey').length,10);
// The two unknowns keep the word the author wrote, beside the discs.
assert.deepEqual(cells.slice(10).map(c=>c.text),['Open','Open']);
assert.equal(out.rows[0][1].value,4); assert.equal(out.rows[9][1].value,1);
assert.equal(out.scales.readiness.anchors['4'],'Full','the disc prints its anchor word, not "4/4"');
console.log('{}');
''')

    def test_a_column_of_mostly_unknowns_is_not_a_rating(self):
        """First cold run: only known anchors become marks; a column mostly unknown stays words."""
        run_node('''
import assert from 'node:assert/strict';
import {styleTable as rawStyleTable} from './evals/support/compose.mjs';
const readiness={type:'harvey',label:'Data readiness',min:0,max:4,anchors:{0:'None',1:'Weak',2:'Partial',3:'Strong',4:'Full'}};
const styleTable=ex=>rawStyleTable({...ex,scales:{readiness},columns:ex.columns.map((c,i)=>i===1?{...(typeof c==='string'?{label:c}:c),scale:'readiness'}:c)});
const rows=[['A','Full','1'],['B','Open','2'],['C','Open','3'],['D','N/A','4'],['E','Strong','5'],['F','TBD','6']];
const out=styleTable({columns:['Market',{label:'Data readiness'},'Cost'],rows});
assert.equal(out.rows.filter(r=>r[1].type==='harvey').length,2,'only known authored anchors become marks');
console.log('{}');
''')


class ImplicationGutterTests(unittest.TestCase):
    """At five rows or more the gutter is one device, not a mark on a row."""

    def test_a_long_table_draws_the_gutter_once_down_its_own_column(self):
        """First cold run: a single chevron on the France row of a twelve-market scorecard read as a verdict on France."""
        # On the twelve-market scorecard the single chevron landed on the
        # France row and read as a verdict on France.
        run_node('''
import assert from 'node:assert/strict';
import {styleTable} from './evals/support/compose.mjs';
// Prizes that do not add up: a closing row equal to the sum of the rows above
// is a total, which an implication gutter no longer stops the composer reading.
const rows=Array.from({length:12},(_,i)=>[`Market ${i+1}`,`${10+i}`,`Wave ${i%3+1}`]);
const long=styleTable({columns:['Market','Prize',{label:'Decision',implication:true}],rows});
const at=long.columns.findIndex(c=>c.type==='implication');
assert.equal(long.columns[at].divider,true);
assert.ok(long.rows.every(r=>r[at].draw===false),'no row carries its own chevron');
// Four rows or fewer, the eye follows each line across and every row keeps one.
const short=styleTable({columns:['Market','Prize',{label:'Decision',implication:true}],rows:rows.slice(0,4)});
const shortAt=short.columns.findIndex(c=>c.type==='implication');
assert.equal(short.columns[shortAt].divider,undefined);
assert.ok(short.rows.every(r=>r[shortAt].draw===undefined));
console.log('{}');
''')


class TableRowDeviceTests(unittest.TestCase):
    def test_a_verdict_beside_stripes_and_groups_is_one_highlight_on_rows_that_read_across(self):
        """A seven-group peer table drew every "What it means" cell as a grey box
        over the stripes beside one highlighted row, split its row rules at the
        implication gutter, and set its group subheadings in the stripes' grey."""
        run_node('''
import assert from 'node:assert/strict';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
import {styleTable} from './evals/support/compose.mjs';
const frame={x:60,y:140,width:1160,height:420};
const group=(text)=>({style:'group',cells:[{type:'text',text},'','','','']});
const row=(n)=>[`Group ${n}`,`Airlines ${n}`,`${100+n}`,`${n}.5`,`Reads ${n} across`];
const ex=styleTable({columns:['Group','Airlines',{label:'Fleet',unit:'aircraft'},{label:'Value',unit:'$bn'},{label:'What it means for BA',implication:true}],
  rows:[group('Network groups'),row(1),row(2),row(3),group('Challengers'),row(4),row(5),row(6),row(7)],highlightRow:1});
const nodes=renderTable({id:'t',frame,props:{...ex,zebra:true}}).nodes;
// One highlight: the highlighted row's band; no verdict cell is boxed.
assert.equal(nodes.filter(n=>n.role==='table-cell').length,0,'no verdict cell takes its own tint');
assert.equal(nodes.filter(n=>n.role==='table-row-band').length,1);
// Stripes and rules cross the gutter: every stripe runs the table's width.
const stripes=nodes.filter(n=>n.role==='table-zebra-band');
assert.ok(stripes.length>0&&stripes.every(n=>n.frame.x===frame.x&&n.frame.width>frame.width-12));
const rules=renderTable({id:'r',frame,props:{...ex,zebra:false}}).nodes.filter(n=>n.role==='table-rule'&&n.data.rule==='row');
assert.ok(rules.length>=5&&rules.every(n=>n.frame.x===frame.x&&n.frame.width>frame.width-12),'row rules are not split at the gutter');
// Stripes restart under each subheading: the first row of a group is white.
const stripedRows=stripes.map(n=>n.data.row);
assert.ok(!stripedRows.includes(5),'the first challenger opens on a white row');
assert.ok(stripedRows.includes(6));
assert.equal(nodes.filter(n=>n.role==='table-group-rule').length,2);
const label=nodes.find(n=>n.role==='table-cell-text'&&n.text==='Challengers');
assert.equal(label.style.bold,true);
// A plain verdict table with nothing else running down its rows keeps the tint.
const plain=renderTable({id:'p',frame,props:{...styleTable({columns:['Option','Cost','Verdict'],rows:[['A','1','Pick this'],['B','2','Not this']]}),zebra:false}}).nodes;
assert.equal(plain.filter(n=>n.role==='table-cell').length,2);
console.log('{}');
''')


class TableSplitTests(unittest.TestCase):
    def test_styled_table_rows_participate_in_weight(self):
        """PR #4 review: styled total rows were left out of the weight that decides when tables split."""
        result=run_node('''
import assert from 'node:assert/strict';
import {splitTables} from './evals/support/compose.mjs';
const table={type:'table',treatment:'standard',columns:['Item','Value'],rows:[{style:'total',cells:['Total','10']}]};
assert.equal(splitTables({title:'Totals',exhibits:[table,table]}).length,1);
const heavy={...table,rows:[{style:'total',cells:['A'.repeat(70),'10']}]};
assert.equal(splitTables({title:'Totals',exhibits:[table,heavy]}).length,2);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


class MeasureTableTests(unittest.TestCase):
    def test_a_measure_table_of_text_composes_without_a_total_row(self):
        """Fifty-page review: the measure-table preset asked every table for a total, and four came out blank."""
        # The four blank total rows came from the measure-table preset, which
        # asked every table for a total; composed, a text table now has none.
        result = run_node(f'''
import {{ compileDeck }} from '{AUTHOR}';
import {{ composeAll }} from './skills/professional-slides/runtime/compose-all.mjs';
{PAGE}
const measure = (id, columns, rows) => ({{ id, type: 'lookup', form: 'measure-table', commentary: 'none', ...base, title: 'Controls and volumes differ between the two platforms', exhibit: {{ columns, rows }} }});
const pages = [measure('t1', [{{ label: 'Control', type: 'category' }}, 'OpenAI', 'Anthropic'], [['Residency', 'US only', 'Varies by route'], ['Retention', 'Not eligible', 'Eligible routes'], ['Partners', 'AWS, Azure', 'AWS, Google, Azure']]),
  measure('t2', [{{ label: 'Line', type: 'category' }}, 'Journeys (m)', 'Train-km (m)'], [['Eastern', '14.2', '3.1'], ['Dales', '9.8', '2.2'], ['Valley', '8.1', '1.9']])];
const {{ deck }} = composeAll(compileDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages }}).spec, '.');
const cells = (id) => deck.slides.find((s) => s.id === id).nodes.filter((n) => n.role === 'table-cell-text').map((n) => n.text);
console.log(JSON.stringify({{ text: cells('t1').includes('Total'), counts: cells('t2').slice(-3) }}));
''')
        self.assertFalse(result["text"])
        self.assertEqual(result["counts"], ["Total", "32.1", "7.2"])


class RowTableTests(unittest.TestCase):
    def test_row_tables_on_one_page_share_a_treatment(self):
        """Rebuilt fifty-page deck: one page's row tables mixed in-cell bars with plain figures and stepped their type apart."""
        result = run_node(PLANNED.format() + '''
const block = (label, head, rows) => ({ label, points: ['A point that says what the row shows and why it matters here.', 'A second point with the qualification.'],
  exhibit: { type: 'table', columns: [{ label: head, type: 'category' }, 'Count'], rows } });
const deck = plan([{ id: 's', title: 'Three measures of the account base', layout: 'labelled-rows', blocks: [
  block('Large accounts', 'Accounts above $1M', [['Two years earlier', '~12'], ['February 2026', '>500']]),
  block('Enterprise breadth', 'Fortune 10', [['Customers', '8'], ['Not disclosed', '2']]),
  block('Coding dollars', 'Claude Code', [['Revenue', '2,500'], ['Enterprise share', '50']]) ] }]);
const sizes = (d) => [...new Set(d.slides[0].nodes.filter((n) => ['table-cell-text', 'table-header-text'].includes(n.role)).map((n) => n.style.fontSize.value))];
// A unit line under one table's header costs it the height, and its type steps down: the page's tables step together.
const units = plan([{ id: 't', title: 'Three measures of the account base', layout: 'labelled-rows', blocks: [
  block('Large accounts', 'Accounts above $1M', [['Two years earlier', '~12'], ['February 2026', '>500']]),
  { ...block('Enterprise breadth', 'Fortune 10', []), exhibit: { type: 'table', columns: [{ label: 'Fortune 10', type: 'category' }, { label: 'Companies', unit: 'of 10' }], rows: [['Claude customers', '8'], ['Not disclosed as customers', '2']] } },
  block('Coding dollars', 'Claude Code', [['Annualized revenue', '>$2.5B'], ['Share from enterprises', '>50%']]) ] }]);
console.log(JSON.stringify({ bars: deck.slides[0].nodes.filter((n) => n.role === 'table-bar').length, sizes: sizes(deck), unitSizes: sizes(units) }));
''')
        # Two tables of exact figures could take bars; the bounds in the first cannot, so none does.
        self.assertEqual(result['bars'], 0)
        # And one type size across the page's tables.
        self.assertEqual(len(result['sizes']), 1)
        self.assertEqual(len(result['unitSizes']), 1)
