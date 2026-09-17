"""deck/v3 composer rules for tables: treatment chosen from content, column
weights from content, and two tables on one page only when they read as one."""
import unittest
from node_probe import run_node


class ComposeTableTests(unittest.TestCase):
    def test_treatment_follows_content_not_the_first_option(self):
        result = run_node('''
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
assert.equal(decision.columns.length,4,'a gutter column is inserted before the verdict');
assert.equal(decision.rows[0].filter(c=>c&&c.type==='implication').length,1);
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
        result = run_node('''
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
        result = run_node('''
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
    def test_verdict_cells_recommended_column_and_total_rows_are_inferred(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {styleTable, paginateTable} from './skills/professional-slides/runtime/compose.mjs';
const t=styleTable({columns:['#','Workstream','Overall status','% complete','Signed'],rows:[['1','Alpha','At risk','40%','✓'],['2','Beta','On track','100%','no'],['Total','','','62%','']]});
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
        result = run_node('''
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
        result = run_node('''
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
