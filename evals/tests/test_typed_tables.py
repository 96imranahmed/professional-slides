import unittest
from node_probe import run_node


class TypedTableTests(unittest.TestCase):
    def test_category_hierarchy_and_equal_height_logo_column(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
import {TABLE_VARIANTS} from './skills/professional-slides/runtime/table-fixtures.mjs';
const props=TABLE_VARIANTS['category-logo-comparison'].props;
const frame={x:60,y:60,width:1160,height:580};
const nodes=renderTable({id:'logos',frame,props}).nodes;
const logos=nodes.filter(n=>n.role==='table-logo');
assert.equal(logos.length,2);
assert.equal(logos[0].frame.height,logos[1].frame.height);
assert.notEqual(logos[0].frame.width,logos[1].frame.width);
for(const n of logos) assert.ok(Math.abs(n.frame.width/n.frame.height-n.data.width/n.data.height)<1e-3);
const surfaces=nodes.filter(n=>n.role==='table-cell');
assert.ok(surfaces.some(n=>n.data.cellType==='category'&&n.style.fill.tokenId==='color.componentPrimary'));
assert.ok(!nodes.some(n=>n.role==='table-header-cell'&&n.type==='rect'));
assert.throws(()=>renderTable({id:'too-wide',frame,props:{...props,columns:props.columns.map((c,i)=>i===1?{...c,label:'ID'}:c),columnWidths:[.4,.05,.55]}}),/Logo column|narrow|does not fit/);
assert.throws(()=>renderTable({id:'no-category',frame,props:{...props,columns:props.columns.map(c=>({...c,type:'text'})),rows:[['A','B','C']]}}),/Category hierarchy/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result['accepted'])

    def test_signed_bars_share_origin_and_tight_spacing_preserves_body_type(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {renderTable,measureTable} from './skills/professional-slides/runtime/tables.mjs';
const props={rowSpacing:'tight',columns:[{label:'Region',type:'text',width:.4},{label:'Net employment, %',type:'bars',scale:'net',width:.6}],scales:{net:{type:'bars',label:'Net employment',unit:'%',min:-20,max:20,series:['Net'],legend:false}},rows:Array.from({length:17},(_,i)=>[`Region ${i+1}`,{values:[i-8]}])};
const frame={x:60,y:60,width:1160,height:580};
const tight=measureTable({frame,props});
assert.ok(tight.height<580);
assert.throws(()=>measureTable({frame,props:{...props,rowSpacing:'normal'}}),/content needs/);
const nodes=renderTable({id:'net',frame,props}).nodes;
assert.ok(nodes.filter(n=>n.role==='table-cell-text').every(n=>n.style.fontSize.tokenId==='type.body'));
const bars=nodes.filter(n=>n.role==='table-bar'),axes=nodes.filter(n=>n.role==='table-bar-axis');
assert.equal(bars.length,16);assert.equal(axes.length,17);
assert.ok(bars.every(n=>n.data.zeroX===bars[0].data.zeroX));
for(const bar of bars){assert.ok(Math.abs(bar.frame.width/Math.abs(bar.data.value)-bars[0].frame.width/8)<.001);assert.deepEqual(bar.data.domain,[-20,20]);if(bar.data.value<0)assert.ok(Math.abs(bar.frame.x+bar.frame.width-bar.data.zeroX)<.001);else assert.equal(bar.frame.x,bar.data.zeroX);}
const labels=nodes.filter(n=>n.role==='table-cell-text'&&n.data.cellType==='bars');
assert.ok(labels.some(n=>n.text==='0'));assert.ok(labels.some(n=>n.text==='-8'));
assert.ok(!nodes.some(n=>n.role==='table-legend'));
const formatted=renderTable({id:'formatted',frame,props:{...props,scales:{net:{...props.scales.net,valueFormat:{decimals:1,sign:'always',suffix:'%'}}}}}).nodes;
const copy=formatted.filter(n=>n.role==='table-cell-text'&&n.data.cellType==='bars').map(n=>n.text);
assert.ok(copy.includes('+8.0%'));assert.ok(copy.includes('-8.0%'));assert.ok(copy.includes('0.0%'));
assert.deepEqual(formatted.filter(n=>n.role==='table-bar').map(n=>n.data.value),bars.map(n=>n.data.value));
assert.throws(()=>renderTable({id:'bad',frame,props:{...props,scales:{net:{...props.scales.net,valueFormat:{sign:'approximate'}}}}}),/sign must/);

for(const bounds of [{min:1,max:20},{min:-20,max:-1},{min:0,max:0}])assert.throws(()=>renderTable({id:'bad',frame,props:{...props,scales:{net:{...props.scales.net,...bounds}}}}),/containing zero/);
assert.throws(()=>renderTable({id:'bad',frame,props:{...props,columns:[props.columns[0],{...props.columns[1],label:'Net'}]}}),/unit visible/);
assert.throws(()=>measureTable({frame,props:{...props,rowSpacing:'tiny'}}),/rowSpacing/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_shared_bar_scale_keeps_physical_units_across_unequal_columns(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {renderTable} from './skills/professional-slides/runtime/tables.mjs';
const props={columns:[{label:'Lost, jobs',type:'bars',scale:'jobs',width:.45},{label:'Gained, jobs',type:'bars',scale:'jobs',width:.55}],scales:{jobs:{type:'bars',label:'Employment',unit:'jobs',min:0,max:200000,series:['Jobs'],legend:false}},rows:[[{values:[7]},{values:[200000]}],[{values:[100]},{values:[100]}]]};
const nodes=renderTable({id:'shared',frame:{x:0,y:0,width:1160,height:580},props}).nodes;
const bars=nodes.filter(n=>n.role==='table-bar');
const equal=bars.filter(n=>n.data.value===100);
assert.equal(equal.length,2);
assert.ok(Math.abs(equal[0].frame.width-equal[1].frame.width)<.001);
const full=bars.find(n=>n.data.value===200000);
assert.ok(bars.every(n=>Math.abs(n.frame.width-full.frame.width*n.data.value/200000)<.001));
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_case_markers_sit_left_and_numeric_rows_align(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
for(const pageDensity of ['executive','pre-read','appendix']) for(const surface of ['plain','primary']) {
 const props={treatment:'dimensions',comparisonAxis:'columns',columns:[{key:'case',label:'Adoption case',width:.26,type:'category'},{key:'trend',label:'Trend',width:.18,type:'number',numberDisplay:'plain',align:'right'},{key:'step',label:'Step-up',width:.18,type:'number',numberDisplay:'plain',align:'right'},{key:'new',label:'New occupations',width:.20,type:'number',numberDisplay:'plain',align:'right'},{key:'total',label:'Total gained',width:.18,type:'number',numberDisplay:'plain',align:'right'}],rows:[[{text:'Late (2%)',sectionNumber:1,surface},'0.7','0.2','0.2','1.0'],[{text:'Midpoint (21%)',sectionNumber:2,surface},'0.5','0.1','0.2','0.9'],[{text:'Early (41%)',sectionNumber:3,surface},'0.4','0.1','0.2','0.7']]};
 const deck=compileDeck({slides:[{id:'cases',density:pageDensity,composition:component({id:'table',component:'table',props})}]},REGISTRY);
 const nodes=deck.slides[0].nodes;
 for(const marker of nodes.filter(n=>n.role==='table-section-marker')) {
  const cells=nodes.filter(n=>n.role==='table-cell-text'&&n.data.row===marker.data.row);
  const label=cells.find(n=>n.data.column===0);
  for(const cell of cells) assert.ok(Math.abs(cell.frame.y+cell.frame.height/2-label.frame.y-label.frame.height/2)<.01,'Scenario and values must share a vertical center');
  // The marker sits at the left of the cell on the label's centre line on every surface.
  assert.equal(marker.data.placement,'inline-start');
  assert.ok(label.frame.x>=marker.frame.x+marker.frame.width+3.9,'Marker needs measured label clearance');
  assert.ok(Math.abs(marker.frame.y+marker.frame.height/2-label.frame.y-label.frame.height/2)<.01);
  const number=nodes.find(n=>n.role==='table-section-number'&&n.data.row===marker.data.row);
  if(surface==='primary'){assert.equal(marker.style.fill.tokenId,'color.onPrimary');assert.equal(number.style.color.tokenId,'color.componentPrimary');}
  else {assert.equal(marker.style.fill.tokenId,'color.componentPrimary');assert.equal(number.style.color.tokenId,'color.onPrimary');}
 }
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_headerless_table_has_no_empty_header_band_or_rule(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {renderTable,measureTable} from './skills/professional-slides/runtime/tables.mjs';
const frame={x:60,y:60,width:500,height:300};
const base={density:'compact',columns:[{key:'case',label:'',type:'category'}],rows:[[{type:'category',text:'Finance',sectionNumber:1}]]};
for(const treatment of ['open','standard','dimensions']) {
 const props={...base,treatment};
 const measured=measureTable({frame,props}),nodes=renderTable({id:'no-header',frame,props}).nodes;
 assert.equal(measured.headerHeight,0);
 assert.ok(!nodes.some(n=>n.role==='table-header-text'||n.role==='table-header-cell'||n.id.includes('header-rule')));
 const labelled=measureTable({frame,props:{...props,columns:[{...props.columns[0],label:'Option'}]}});
 assert.equal(labelled.height-measured.height,labelled.headerHeight);
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_numbered_categories_keep_the_marker_left_and_centred_at_every_density(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
for(const pageDensity of ['executive','pre-read','appendix']) for(const density of ['body','compact','dense']) {
 const props={variant:'open',density,columns:[{key:'case',label:'Option',type:'category'},{key:'value',label:'Evidence',type:'text'}],rows:[[{type:'category',text:'Finance',sectionNumber:1},'Shared services'],[{type:'category',text:'Research',sectionNumber:2,rowSpan:2},'Capacity'],[null,'Compliance']]};
 const deck=compileDeck({slides:[{id:'clearance',density:pageDensity,composition:component({id:'cases',component:'table',props,frame:{x:60,y:60,width:1160,height:600}})}]},REGISTRY);
 const nodes=deck.slides[0].nodes;
 // The clearance is one space.1 step, and space tokens now scale with the page
 // density (4px at executive, 3px at appendix), so read it off the slide.
 const clearance=deck.slides[0].tokens['space.1'].value;
 for(const marker of nodes.filter(n=>n.role==='table-section-marker')) {
  const text=nodes.find(n=>n.role==='table-cell-text'&&n.data.row===marker.data.row&&n.data.column===marker.data.column);
  assert.ok(text.frame.x >= marker.frame.x+marker.frame.width+clearance-0.1, `${pageDensity}/${density}: marker overlaps category text`);
  const cell=nodes.find(n=>n.role==='table-cell'&&n.data.row===marker.data.row&&n.data.column===marker.data.column);
  assert.ok(Math.abs(marker.frame.y+marker.frame.height/2-(cell.frame.y+cell.frame.height/2))<.01, `${pageDensity}/${density}: marker is not centred on its cell`);
 }
}
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_variant_coverage_fonts_and_determinism(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {TABLE_VARIANTS} from './skills/professional-slides/runtime/table-fixtures.mjs';
import {CELL_TYPES} from './skills/professional-slides/runtime/tables.mjs';
const seen=new Set();
for(const palette of ['midnight','evergreen','crimson']) for(const [variant,fixture] of Object.entries(TABLE_VARIANTS)) {
 const props={...REGISTRY.get('table').sample,...fixture.props,variant};
 const spec={id:'table',palette,typography:{body:'Georgia',display:'Georgia',semibold:{family:'Georgia',nativeBold:true,effectiveWeight:700}},slides:[{id:'page',composition:component({id:'table',component:'table',props,frame:{x:60,y:40,width:1160,height:632}})}]};
 const deck=compileDeck(spec,REGISTRY);assert.deepEqual(compileDeck(spec,REGISTRY),deck);
 for(const node of deck.slides[0].nodes){
  if(node.data.cellType)seen.add(node.data.cellType);
  if(node.role==='table-cell'&&node.data.cellType==='category'){
   assert.equal(node.style.fill.tokenId,'color.componentPrimary');
   assert.equal(node.style.fill.value,{midnight:'#051C2C',evergreen:'#0E7A5E',crimson:'#CC0000'}[palette]);
  }
  if(node.type==='text'){assert.equal(node.style.fontFamily.value,'Georgia');assert.ok([9,10,12].includes(node.style.fontSize.value),'status labels sit at the label size');assert.equal(node.style.wrap,false);}
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
  const marks=nodes.filter(n=>n.role==='table-binary-mark');assert.ok(marks.length);assert.ok(marks.every(n=>n.style.lineWidth.tokenId==='line.standard'));assert.ok(nodes.some(n=>n.type==='wedge'));
  const rule=nodes.find(n=>n.role==='table-rule');assert.ok(marks.every(n=>n.style.lineWidth.value>rule.style.lineWidth.value));
  delete props.scales.confirmation.test;assert.throws(()=>renderTable({id:'bad',frame,props}),/confirmation test/);
 }else if(variant==='numbered-sections'){
  const markers=nodes.filter(n=>n.role==='table-section-marker'),numbers=nodes.filter(n=>n.role==='table-section-number');
  assert.equal(markers.length,2);assert.equal(numbers.length,2);
  for(const marker of markers){
   const category=nodes.find(n=>n.role==='table-cell'&&n.data.row===marker.data.row&&n.data.column===marker.data.column);
   assert.equal(marker.data.placement,'inline-start');
   assert.ok(marker.frame.x>category.frame.x&&marker.frame.x<category.frame.x+category.frame.width/3,'marker sits at the left of its category box');
   assert.ok(Math.abs(marker.frame.y+marker.frame.height/2-(category.frame.y+category.frame.height/2))<.01,'marker is centred on its category box');
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
	  assert.equal(rowRules.length,4);assert.ok(rowRules.every(n=>n.data.column!==2)); // one rule per side of the gutter per row boundary, not one per column
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
 const props={...make(rows,columns),density:rows>10||columns>6?'dense':rows>5||columns>4?'compact':'body'},measurement=measureTable({frame,props}),nodes=renderTable({id:`t-${rows}-${columns}`,frame,props}).nodes;
 assert.equal(measurement.rows.length,rows);assert.equal(measurement.columns.length,columns);
 assert.equal(measurement.density,props.density);
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
assert.ok(compactMarks.length>0);assert.ok(compactMarks.every(n=>n.style.lineWidth.tokenId==='line.standard'));
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


class ValueFormatGroupingTests(unittest.TestCase):
    def test_grouping_preserves_sign_precision_and_compact_scaling(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {formatValue} from './skills/professional-slides/runtime/value-format.mjs';
assert.equal(formatValue(12345.678901,{valueFormat:{grouping:true,decimals:6,prefix:'$'}}),'$12,345.678901');
assert.equal(formatValue(-12345.6,{valueFormat:{grouping:true,decimals:2}}),'-12,345.60');
assert.equal(formatValue(12345,{valueFormat:{grouping:true,decimals:0,sign:'always'}}),'+12,345');
assert.equal(formatValue(12345,{valueFormat:{decimals:0}}),'12345');
assert.equal(formatValue(1234500,{valueFormat:{grouping:true,compactUnit:'k',decimals:1}}),'1,234.5k');
assert.throws(()=>formatValue(10,{valueFormat:{grouping:'yes'}}),/must be boolean/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
