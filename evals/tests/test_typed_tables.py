import unittest
from test_source_structure import run_node


class TypedTableTests(unittest.TestCase):
    def test_variant_coverage_fonts_and_determinism(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {TABLE_VARIANTS} from './skills/professional-slides/runtime/table-fixtures.mjs';
import {CELL_TYPES} from './skills/professional-slides/runtime/tables.mjs';
const seen=new Set();
for(const palette of ['mckinsey','bcg','bain']) for(const [variant,fixture] of Object.entries(TABLE_VARIANTS)) {
 const props={...REGISTRY.get('table').sample,...fixture.props,variant};
 const spec={id:'table',palette,typography:{body:'Georgia',display:'Georgia',semibold:{family:'Georgia',nativeBold:true,effectiveWeight:700}},slides:[{id:'page',composition:component({id:'table',component:'table',props,frame:{x:60,y:40,width:1160,height:632}})}]};
 const deck=compileDeck(spec,REGISTRY);assert.deepEqual(compileDeck(spec,REGISTRY),deck);
 for(const node of deck.slides[0].nodes){
  if(node.data.cellType)seen.add(node.data.cellType);
  if(node.role==='table-cell'&&node.data.cellType==='category'){
   assert.equal(node.style.fill.tokenId,'color.componentPrimary');
   assert.equal(node.style.fill.value,{mckinsey:'#051C2C',bcg:'#197A56',bain:'#CB2027'}[palette]);
  }
  if(node.type==='text'){assert.equal(node.style.fontFamily.value,'Georgia');assert.ok([12,14].includes(node.style.fontSize.value));assert.equal(node.style.wrap,false);}
 }
}
assert.deepEqual([...seen].sort(),[...CELL_TYPES].sort());
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_measured_rows_spans_and_columns(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {measureTable,renderTable} from './skills/professional-slides/runtime/tables.mjs';
const props={columns:[{label:'Area',type:'category',width:{px:180}},{label:'Detail',width:2},{label:'Effect',width:1}],rows:[[{text:'A',rowSpan:2},'Short statement.','Limited.'],[null,{type:'bullets',items:['This substantive sentence needs several lines in its allocated cell and must set the row height.','This second bullet explains the condition for proceeding.']},'Requires review.']]};
const frame={x:0,y:0,width:900,height:600},m=measureTable({frame,props});
assert.equal(m.widths[0],180);assert.equal(m.widths[1],480);assert.ok(m.heights[1]>m.heights[0]);
const nodes=renderTable({id:'t',frame,props}).nodes;
const category=nodes.find(n=>n.role==='table-cell'&&n.data.column===0);
assert.equal(category.frame.height,m.heights[0]+m.heights[1]-8);
assert.equal(nodes.filter(n=>n.data.column===0&&n.role==='table-cell-text').length,1);
assert.throws(()=>measureTable({frame:{...frame,height:30},props}),/content needs/);
assert.throws(()=>measureTable({frame,props:{...props,columnWidths:[.2,.3,.2]}}),/summing to one/);
const bad=structuredClone(props);bad.rows[1][0]='overlap';assert.throws(()=>measureTable({frame,props:bad}),/span collides/);
const narrow=structuredClone(props);narrow.columns[0].width={px:8};assert.throws(()=>measureTable({frame,props:narrow}),/minimum/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_scale_validation_and_native_geometry(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
import {TABLE_VARIANTS} from './skills/professional-slides/runtime/table-fixtures.mjs';
const frame={x:0,y:0,width:1160,height:632};
for(const variant of ['bar-columns','heatmap-1-10','grouped-hypotheses','numbered-sections','implication-columns']){
 const props=structuredClone(TABLE_VARIANTS[variant].props),nodes=renderTable({id:'t',frame,props}).nodes;
 assert.ok(nodes.every(n=>['text','rect','line','ellipse','wedge'].includes(n.type)));
 if(variant==='bar-columns'){
  const bars=nodes.filter(n=>n.role==='table-bar'),first=bars[0];
  for(const n of bars)assert.ok(Math.abs(n.frame.width-n.data.value*first.frame.width/first.data.value)<0.0001);
  const circles=nodes.filter(n=>n.role==='table-number-circle'),values=nodes.filter(n=>n.role==='table-number-value');
  assert.equal(circles.length,6);assert.equal(values.length,6);
  assert.equal(circles.filter(n=>n.frame.width===n.frame.height).length,3);
  assert.equal(circles.filter(n=>n.data.numberDisplay==='oval'&&n.frame.width>n.frame.height*2).length,3);
  const labels=nodes.filter(n=>n.role==='table-cell-text'&&n.data.cellType==='bars');
  const bodyText=nodes.find(n=>n.role==='table-cell-text'&&n.data.cellType==='bullets');
  assert.ok(labels.every(n=>n.style.fontSize.tokenId===bodyText.style.fontSize.tokenId));
  assert.notEqual(bars[1].style.fill.tokenId,'color.chartSeries2');
  const swatches=nodes.filter(n=>n.role==='table-legend-swatch');
  assert.deepEqual(swatches.map(n=>n.style.fill.tokenId),bars.slice(0,2).map(n=>n.style.fill.tokenId));
  assert.ok(values.every(n=>n.style.fontSize.tokenId==='type.compact'||n.style.fontSize.tokenId==='type.body'));
  props.rows[0][2].values[0]=601;assert.throws(()=>renderTable({id:'bad',frame,props}),/shared domain/);
 }else if(variant==='heatmap-1-10'){
  const swatches=nodes.filter(n=>n.id.includes('legend-swatch'));
  assert.equal(swatches.length,10);assert.equal(new Set(swatches.map(n=>n.style.fill.value)).size,10);
  props.rows[0][1].value=11;assert.throws(()=>renderTable({id:'bad',frame,props}),/outside/);
 }else if(variant==='grouped-hypotheses'){
  assert.ok(nodes.some(n=>n.role==='table-binary-mark'));assert.ok(nodes.some(n=>n.type==='wedge'));
  delete props.scales.confirmation.test;assert.throws(()=>renderTable({id:'bad',frame,props}),/confirmation test/);
 }else if(variant==='numbered-sections'){
  const markers=nodes.filter(n=>n.role==='table-section-marker'),numbers=nodes.filter(n=>n.role==='table-section-number');
  assert.equal(markers.length,2);assert.equal(numbers.length,2);
  for(const marker of markers){
   const category=nodes.find(n=>n.role==='table-cell'&&n.data.row===marker.data.row&&n.data.column===marker.data.column);
   assert.equal(marker.data.placement,'top-center');
   assert.ok(Math.abs(marker.frame.x+marker.frame.width/2-(category.frame.x+category.frame.width/2))<.01);
   assert.ok(marker.frame.y<category.frame.y&&marker.frame.y+marker.frame.height>category.frame.y);
  }
  props.rows[2][0].sectionNumber=1;assert.throws(()=>renderTable({id:'bad',frame,props}),/unique/);
  props.rows[2][0].sectionNumber=2;props.rows[2][1]={type:'text',text:'(Insert hypothesis)',sectionNumber:3};assert.throws(()=>renderTable({id:'bad',frame,props}),/category cells/);
 }else{
  const arrows=nodes.filter(n=>n.role==='table-implication');
  assert.equal(arrows.length,9);assert.ok(arrows.every(n=>!n.data.endArrow&&n.data.relation==='implies'));
	  assert.equal(arrows.filter(n=>n.data.arrowPart===0).length,3);
	  assert.equal(arrows.filter(n=>n.type==='ellipse'&&n.data.arrowVariant==='disc-chevron').length,3);
	  assert.ok(arrows.filter(n=>n.type==='line').every(n=>['color.ink','color.onPrimary'].includes(n.style.stroke.tokenId)));
	  const rowRules=nodes.filter(n=>n.role==='table-rule'&&n.data.rule==='row');
	  assert.equal(rowRules.length,6);assert.ok(rowRules.every(n=>n.data.column!==2));
	  delete props.columns[2].relation;assert.throws(()=>renderTable({id:'bad',frame,props}),/relation: implies/);
 }
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_arbitrary_cardinality_and_optional_number_circles(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {measureTable,renderTable} from './skills/professional-slides/runtime/tables.mjs';
const make=(rowCount,columnCount)=>({
 columns:Array.from({length:columnCount},(_,column)=>({id:`c${column}`,label:`Column ${column+1}`,type:column===0?'category':column===columnCount-1?'number':'text',...(column===columnCount-1?{align:'center'}:{})})),
 rows:Array.from({length:rowCount},(_,row)=>Array.from({length:columnCount},(_,column)=>column===0?`Row ${row+1}`:column===columnCount-1?`${row+4}%`:`Value ${row+1}.${column+1}`))
});
const frame={x:0,y:0,width:1160,height:632};
for(const [rows,columns] of [[2,2],[8,6],[12,3]]){
 const props=make(rows,columns),measurement=measureTable({frame,props}),nodes=renderTable({id:`t-${rows}-${columns}`,frame,props}).nodes;
 assert.equal(measurement.rows.length,rows);assert.equal(measurement.columns.length,columns);
 assert.equal(measurement.density,rows>10||columns>6?'dense':rows>5||columns>4?'compact':'body');
 assert.equal(nodes.filter(node=>node.role==='table-number-circle').length,rows);
 assert.equal(nodes.filter(node=>node.role==='table-number-value').length,rows);
}
const plain=make(4,4);plain.columns.at(-1).numberDisplay='plain';
const plainNodes=renderTable({id:'plain',frame,props:plain}).nodes;
assert.equal(plainNodes.filter(node=>node.role==='table-number-circle').length,0);
assert.equal(plainNodes.filter(node=>node.role==='table-cell-text'&&node.data.cellType==='number').length,4);
const invalid=make(2,2);invalid.columns[1].numberDisplay='hexagon';assert.throws(()=>renderTable({id:'bad',frame,props:invalid}),/numberDisplay/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_binary_confirmation_defaults_to_compact_symbol_only_and_keeps_labelled_variant(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {TOKENS} from './skills/professional-slides/runtime/core.mjs';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
import {TABLE_VARIANTS} from './skills/professional-slides/runtime/table-fixtures.mjs';
const frame={x:0,y:0,width:1160,height:632};
const compact=renderTable({id:'compact',frame,props:structuredClone(TABLE_VARIANTS['grouped-hypotheses'].props)}).nodes;
const labelled=renderTable({id:'labelled',frame,props:structuredClone(TABLE_VARIANTS['grouped-hypotheses-labelled'].props)}).nodes;
assert.equal(TOKENS['icon.small'].value,16);assert.equal(TOKENS['icon.small'].cssVar,'--icon-sm');
const compactMarks=compact.filter(n=>n.role==='table-binary-mark');
assert.ok(compactMarks.length>0);assert.ok(compactMarks.every(n=>n.style.lineWidth.tokenId==='line.hairline'));
const groups=new Map();for(const mark of compactMarks){const key=`${mark.data.row}:${mark.data.column}`;groups.set(key,[...(groups.get(key)??[]),mark]);}
for(const group of groups.values()){
 const xs=group.flatMap(n=>[n.data.x1,n.data.x2]),ys=group.flatMap(n=>[n.data.y1,n.data.y2]);
 assert.ok(Math.max(...xs)-Math.min(...xs)<=16);assert.ok(Math.max(...ys)-Math.min(...ys)<=16);
}
assert.equal(compact.filter(n=>n.role==='table-cell-text'&&n.data.column===2).length,0);
assert.equal(labelled.filter(n=>n.role==='table-cell-text'&&n.data.column===2).length,4);
assert.ok(labelled.filter(n=>n.role==='table-binary-mark').every(n=>n.data.labelDisplay==='state'));
const invalid=structuredClone(TABLE_VARIANTS['grouped-hypotheses'].props);invalid.scales.confirmation.labelDisplay='verbose';
assert.throws(()=>renderTable({id:'invalid',frame,props:invalid}),/labelDisplay/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
