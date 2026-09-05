import unittest
from test_source_structure import run_node


class FinancialChartRuntimeTests(unittest.TestCase):
    def test_chart_labels_annotations_legends_and_title_subtitles_use_body_size(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {TOKENS} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
assert.equal(TOKENS['type.chartLabel'].value,TOKENS['type.body'].value);
assert.equal(TOKENS['type.chartAnnotation'].value,TOKENS['type.body'].value);
const frame={x:60,y:150,width:1000,height:500};
const column=REGISTRY.get('chart.column');
const props={categories:['Current','Future'],series:[{name:'Actual',values:[80,150]},{name:'Plan',values:[72,140]}],dataLabels:true,annotations:[{series:'Actual',category:'Future',text:'Above plan'}],changeAnnotations:[]};
const nodes=column.render({id:'column',frame,props}).nodes;
assert.ok(nodes.filter(n=>n.role==='data-label').every(n=>n.style.fontSize.tokenId==='type.chartLabel'));
assert.ok(nodes.filter(n=>n.role==='legend-label').every(n=>n.style.fontSize.tokenId==='type.chartLabel'));
assert.ok(nodes.filter(n=>n.role==='annotation-text').every(n=>n.style.fontSize.tokenId==='type.chartAnnotation'));
assert.ok(nodes.filter(n=>n.role==='category-label').every(n=>n.style.fontSize.tokenId==='type.body'));
const waterfall=REGISTRY.get('chart.waterfall');
const change=waterfall.render({id:'waterfall',frame,props:{...waterfall.sample,...waterfall.examples['end-to-end-construction'].props}}).nodes;
assert.ok(change.filter(n=>n.role==='data-label').every(n=>n.style.fontSize.tokenId==='type.chartLabel'));
assert.ok(change.filter(n=>n.role==='annotation-text').every(n=>n.style.fontSize.tokenId==='type.chartAnnotation'));
const title=REGISTRY.get('chart-title').render({id:'title',frame:{x:60,y:60,width:800,height:90},props:{heading:'Performance',unit:'USD millions, 2026'}}).nodes;
assert.equal(title.find(n=>n.role==='chart-unit').style.fontSize.tokenId,'type.body');
const cover=REGISTRY.get('cover').render({id:'cover',frame:{x:0,y:0,width:1280,height:720},props:{title:'Strategy',subtitle:'Priorities for the planning cycle'}}).nodes;
assert.equal(cover.find(n=>n.role==='cover-subtitle').style.fontSize.tokenId,'type.body');
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_sparse_directly_labelled_charts_omit_value_axes_and_keep_body_sized_category_ticks(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:150,width:1000,height:500};
const column=REGISTRY.get('chart.column');
const sparse=column.render({id:'sparse',frame,props:{categories:['Revenue','Operating income'],series:[{name:'Q2 2025',values:[100,100]},{name:'Q2 2026',values:[124,130]}],dataLabels:true,annotations:[],highlights:[],referenceLines:[]}}).nodes;
assert.equal(sparse.filter(n=>n.role==='axis-label').length,0);
assert.equal(sparse.filter(n=>n.id.endsWith('y-axis')).length,0);
assert.equal(sparse.filter(n=>n.id.endsWith('x-axis')).length,1);
assert.ok(sparse.filter(n=>n.role==='category-label').every(n=>n.style.fontSize.tokenId==='type.body'));
const threshold=column.render({id:'threshold',frame,props:{categories:['A','B','C','D'],series:[{name:'Actual',values:[1,2,3,4]},{name:'Plan',values:[2,3,4,5]}],dataLabels:true,annotations:[],highlights:[],referenceLines:[]}}).nodes;
assert.equal(threshold.filter(n=>n.role==='axis-label').length,5);
assert.ok(threshold.filter(n=>n.role==='axis-label').every(n=>n.style.fontSize.tokenId==='type.body'));
const forced=column.render({id:'forced',frame,props:{categories:['A','B'],series:[{name:'Value',values:[1,2]}],dataLabels:true,showValueAxis:true,annotations:[],highlights:[],referenceLines:[]}}).nodes;
assert.equal(forced.filter(n=>n.role==='axis-label').length,5);
const horizontal=REGISTRY.get('chart.bar').render({id:'horizontal',frame,props:{categories:['A','B'],series:[{name:'Value',values:[1,2]}],dataLabels:true,annotations:[],highlights:[],referenceLines:[]}}).nodes;
assert.equal(horizontal.filter(n=>n.role==='axis-label').length,0);
assert.equal(horizontal.filter(n=>n.id.endsWith('x-axis')).length,0);
assert.equal(horizontal.filter(n=>n.id.endsWith('y-axis')).length,1);
const line=REGISTRY.get('chart.line').render({id:'line',frame,props:{categories:['Q1','Q2','Q3'],series:[{name:'Value',values:[1,2,3]}],dataLabels:true,annotations:[],highlights:[],referenceLines:[]}}).nodes;
assert.equal(line.filter(n=>n.role==='axis-label').length,0);
const waterfall=REGISTRY.get('chart.waterfall').render({id:'waterfall',frame,props:{categories:['Start','Change','End'],values:[10,5,15],totals:[0,2],annotations:[],highlights:[],referenceLines:[]}}).nodes;
assert.equal(waterfall.filter(n=>n.role==='axis-label').length,0);
assert.throws(()=>column.render({id:'bad',frame,props:{categories:['A'],series:[{name:'Value',values:[1]}],showValueAxis:false,gridlines:true}}),/gridlines require a visible value axis/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_scatter_quadrants_and_bubble_size_legend_are_theme_bound(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:150,width:1000,height:500};
const bubble=REGISTRY.get('chart.bubble');
const sizeProps={...bubble.sample,...bubble.examples['size-legend-top-right'].props};
const sizeSlide=compileDeck({palette:'mckinsey',slides:[{id:'bubble',frame,composition:component({id:'bubble',component:'chart.bubble',frame,props:sizeProps})}]},REGISTRY).slides[0];
const legendSwatches=sizeSlide.nodes.filter(n=>n.role==='legend-swatch');
const legendLabels=sizeSlide.nodes.filter(n=>n.role==='legend-label');
assert.equal(legendSwatches.length,1);
assert.equal(legendLabels.length,1);
const sizeLabel=legendLabels.find(n=>n.text==='Bubble area = relative magnitude');
const sizeMarker=legendSwatches.find(n=>n.data.categoryKey==='Bubble area = relative magnitude');
assert.ok(sizeLabel&&sizeMarker);
assert.equal(sizeMarker.type,'ellipse');
assert.equal(sizeMarker.style.fill.tokenId,'color.surfaceMuted');
assert.equal(sizeMarker.style.stroke.tokenId,'color.rule');
assert.equal(sizeMarker.frame.width,12);
assert.equal(sizeMarker.frame.height,12);
assert.equal(sizeMarker.data.placement,'top-right');
assert.ok(sizeLabel.frame.x+sizeLabel.frame.width<=frame.x+frame.width-16);
const focusProps={...bubble.sample,...bubble.examples['quadrant-focus-tint'].props};
const focus=bubble.render({id:'focus',frame,props:focusProps}).nodes;
const quadrants=focus.filter(n=>n.role==='chart-quadrant');
assert.equal(quadrants.length,1);
assert.equal(quadrants[0].data.quadrant,'topRight');
assert.equal(quadrants[0].style.fill.tokenId,'color.componentPrimaryTint');
assert.equal(focus.filter(n=>n.role==='chart-threshold-line').length,2);
assert.equal(focus.filter(n=>n.role==='chart-quadrant-title').length,4);
assert.ok(focus.indexOf(quadrants[0])<focus.findIndex(n=>n.role==='chart-marker'));
const scatter=REGISTRY.get('chart.scatter');
const alternating=scatter.render({id:'alternating',frame,props:{...scatter.sample,...scatter.examples['quadrant-alternating-tint'].props}}).nodes.filter(n=>n.role==='chart-quadrant');
assert.deepEqual(alternating.map(n=>n.data.quadrant),['topLeft','bottomRight']);
assert.ok(alternating.every(n=>n.style.fill.tokenId==='color.surfaceMuted'));
assert.throws(()=>scatter.render({id:'bad-size',frame,props:{...scatter.sample,sizeLegend:{label:'Magnitude'}}}),/Only bubble charts/);
assert.throws(()=>scatter.render({id:'bad-style',frame,props:{...scatter.sample,xMin:0,xMax:100,yMin:0,yMax:100,quadrants:{x:50,y:50,style:'gradient'}}}),/Unknown scatter quadrant style/);
assert.throws(()=>scatter.render({id:'bad-threshold',frame,props:{...scatter.sample,xMin:0,xMax:100,yMin:0,yMax:100,quadrants:{x:100,y:50}}}),/x threshold/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_change_annotations_are_shared_across_chart_families(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:150,width:1000,height:500};
const cases=[
  ['chart.column','a-vs-b-change','arrow'],
  ['chart.column','grouped-series-change','bracket'],
  ['chart.stacked-column','total-construction','construction'],
  ['chart.line','long-range-growth','bracket'],
  ['chart.waterfall','end-to-end-construction','construction']
];
for(const [id,example,style] of cases){
  const definition=REGISTRY.get(id),props={...definition.sample,...definition.examples[example].props};
  const nodes=definition.render({id:id+':'+example,frame,props}).nodes;
  const labels=nodes.filter(n=>n.role==='annotation-text'&&n.data.annotationStyle===style);
  const surfaces=nodes.filter(n=>n.role==='annotation-surface'&&n.data.annotationStyle===style);
  const leaders=nodes.filter(n=>n.role==='annotation-leader'&&n.data.annotationStyle===style);
  assert.ok(labels.length>0,id+' '+example+' needs labels');
  assert.equal(labels.length,surfaces.length,id+' '+example+' pairs every label and surface');
  assert.ok(leaders.length>=labels.length,id+' '+example+' attaches every annotation');
  assert.ok(surfaces.every(n=>n.style.fill.tokenId==='color.componentPrimary'));
  assert.ok(labels.every(n=>n.style.color.tokenId==='color.onPrimary'));
  if(style==='arrow'||style==='construction') {
    assert.equal(leaders.filter(n=>n.data.endArrow).length,labels.length);
    assert.ok(leaders.filter(n=>n.data.endArrow).every(n=>n.data.endArrowType==='triangle'));
    assert.ok(leaders.every(n=>n.style.lineWidth.tokenId==='line.standard'));
  }
  if(style==='bracket') assert.equal(leaders.filter(n=>n.data.endArrow).length,0);
}
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_annotation_rail_alignment_and_gridline_defaults(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:150,width:1000,height:500};
const column=REGISTRY.get('chart.column');
const base={categories:['2022','2023','2024'],series:[{name:'Measure',values:[42,55,71]}],dataLabels:true,annotations:[],highlights:[],referenceLines:[]};
const clean=column.render({id:'clean',frame,props:base}).nodes;
const ruled=column.render({id:'ruled',frame,props:{...base,gridlines:true}}).nodes;
assert.equal(clean.filter(n=>n.role==='chart-gridline').length,0);
assert.equal(ruled.filter(n=>n.role==='chart-gridline').length,5);
const rail=column.render({id:'rail',frame,props:{...base,annotationRail:{items:[{category:'2022',text:'Base'},{category:'2023',text:'+31%'},{category:'2024',text:'+29%'}]}}}).nodes;
const categoryLabels=rail.filter(n=>n.role==='category-label');
const railSurfaces=rail.filter(n=>n.role==='annotation-surface'&&n.data.annotationStyle==='rail');
assert.equal(railSurfaces.length,3);
for(const surface of railSurfaces){
  const label=categoryLabels.find(n=>n.text===surface.data.category);
  assert.ok(surface.frame.y>label.frame.y+label.frame.height);
  assert.ok(Math.abs((surface.frame.x+surface.frame.width/2)-(label.frame.x+label.frame.width/2))<0.001);
}
assert.throws(()=>REGISTRY.get('chart.bar').render({id:'bar',frame,props:{...base,annotationRail:{items:[{category:'2022',text:'Base'}]}}}),/horizontal category axis/);
assert.throws(()=>REGISTRY.get('chart.pie').render({id:'pie',frame,props:{labels:['A','B'],values:[60,40],changeAnnotations:[{start:'A',end:'B',text:'+20'}]}}),/do not support ordered change annotations/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_takeaway_callout_and_orthogonal_dot_annotation_treatments(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:150,width:1000,height:500};
const line=REGISTRY.get('chart.line');
const base={categories:['Q1','Q2','Q3','Q4'],series:[{name:'Measure',values:[22,31,48,55]}],yMax:60,dataLabels:false,legend:false,highlights:[],referenceLines:[]};
const takeaway=line.render({id:'takeaway',frame,props:{...base,annotations:[{category:'Q3',text:'Adoption accelerates',treatment:'takeaway-box'}]}}).nodes;
const takeawaySurface=takeaway.find(n=>n.role==='annotation-surface'&&n.data.annotationTreatment==='callout');
const takeawayText=takeaway.find(n=>n.role==='annotation-text'&&n.data.annotationTreatment==='callout');
assert.equal(takeawaySurface.style.fill.tokenId,'color.surface');
assert.equal(takeawaySurface.style.stroke.tokenId,'color.componentPrimary');
assert.equal(takeawayText.style.fontSize.tokenId,'type.chartAnnotation');
const callout=line.render({id:'callout',frame,props:{...base,annotations:[{category:'Q3',text:'Distinct evidence callout',treatment:'callout'}]}}).nodes;
const calloutSurface=callout.find(n=>n.role==='annotation-surface'&&n.data.annotationTreatment==='callout');
assert.equal(calloutSurface.style.fill.tokenId,'color.surface');
assert.equal(calloutSurface.style.stroke.tokenId,'color.componentPrimary');
const borderless=line.render({id:'borderless',frame,props:{...base,annotations:[{category:'Q3',text:'Borderless evidence',treatment:'callout',border:false}]}}).nodes;
assert.equal(borderless.find(n=>n.role==='annotation-surface').style.stroke,'none');
const straight=borderless.find(n=>n.role==='annotation-leader');
assert.equal(straight.data.x1,straight.data.x2);
assert.equal(straight.data.endArrow,true);
assert.equal(straight.data.endArrowType,'triangle');
const component=REGISTRY.get('chart-callout');
const compact=component.render({id:'compact',frame,props:{...component.sample,...component.variants.borderless.props}}).nodes;
assert.equal(compact.find(n=>n.role==='annotation-surface').style.stroke,'none');
const vertical=line.render({id:'vertical',frame,props:{...base,annotations:[{category:'Q3',text:'Launch creates an inflection',treatment:'orthogonal-dot',orientation:'vertical'}]}}).nodes;
const verticalLeader=vertical.find(n=>n.role==='annotation-leader'&&n.data.annotationTreatment==='orthogonal-dot');
const verticalDot=vertical.find(n=>n.role==='annotation-endpoint');
assert.equal(verticalLeader.data.x1,verticalLeader.data.x2);
assert.equal(verticalLeader.data.endArrow,false);
assert.equal(verticalLeader.data.endpoint,'dot');
assert.ok(Math.abs(verticalDot.frame.x+verticalDot.frame.width/2-verticalLeader.data.x2)<0.001);
assert.ok(Math.abs(verticalDot.frame.y+verticalDot.frame.height/2-verticalLeader.data.y2)<0.001);
const scatter=REGISTRY.get('chart.scatter');
const horizontal=scatter.render({id:'horizontal',frame,props:{...scatter.examples['orthogonal-dot-horizontal'].props}}).nodes;
const horizontalLeader=horizontal.find(n=>n.role==='annotation-leader'&&n.data.annotationTreatment==='orthogonal-dot');
assert.equal(horizontalLeader.data.y1,horizontalLeader.data.y2);
assert.equal(horizontalLeader.data.endArrow,false);
assert.equal(horizontal.filter(n=>n.role==='annotation-endpoint').length,1);
assert.throws(()=>line.render({id:'bad-treatment',frame,props:{...base,annotations:[{category:'Q3',text:'Bad',treatment:'speech'}]}}),/Unknown chart evidence annotation treatment/);
assert.throws(()=>line.render({id:'bad-orientation',frame,props:{...base,annotations:[{category:'Q3',text:'Bad',treatment:'orthogonal-dot',orientation:'diagonal'}]}}),/Unknown orthogonal chart annotation orientation/);
const cramped={categories:['Q1','Q2'],series:[{name:'Measure',values:[30,40]}],yMax:50,dataLabels:true,legend:false,highlights:[],referenceLines:[],annotations:[{category:'Q1',text:'No corridor',treatment:'orthogonal-dot',orientation:'horizontal',side:'left'}]};
assert.throws(()=>line.render({id:'cramped',frame:{x:60,y:150,width:390,height:360},props:cramped}),/insufficient clearance for a horizontal orthogonal-dot annotation/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_bar_highlights_and_two_mark_contrast_are_theme_bound(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {contrastRatio} from './skills/professional-slides/runtime/palettes.mjs';
const frame={x:60,y:160,width:760,height:420};
const slide=props=>({id:'chart',composition:component({id:'chart',component:'chart.column',frame,props})});
for(const palette of ['mckinsey','bcg','bain']) {
  const deck=compileDeck({palette,slides:[slide({categories:['Current','Future'],series:[{name:'Measure',values:[80,150]}]})]},REGISTRY);
  const marks=deck.slides[0].nodes.filter(n=>n.role==='chart-mark');
  assert.equal(marks.length,2);
  assert.equal(marks[0].style.fill.tokenId,'color.chartSeries1');
  const candidates=Array.from({length:5},(_,index)=>index+2);
  const expected=candidates.sort((a,b)=>contrastRatio(deck.tokens['color.chartSeries1'].value,deck.tokens[`color.chartSeries${b}`].value)-contrastRatio(deck.tokens['color.chartSeries1'].value,deck.tokens[`color.chartSeries${a}`].value))[0];
  assert.equal(marks[1].style.fill.tokenId,`color.chartSeries${expected}`);
  assert.notEqual(marks[0].style.fill.value,marks[1].style.fill.value);
}
const explicit=compileDeck({slides:[slide({categories:['Current','Future'],series:[{name:'Measure',values:[80,150]}],colorIndices:[1]})]},REGISTRY).slides[0].nodes.filter(n=>n.role==='chart-mark');
assert.deepEqual(explicit.map(n=>n.style.fill.tokenId),['color.chartSeries2','color.chartSeries2']);
const focused=compileDeck({palette:'bain',slides:[slide({categories:['A','B','C'],series:[{name:'Measure',values:[40,70,55]}],highlights:[{category:'B',style:'bar'}]})]},REGISTRY).slides[0].nodes.filter(n=>n.role==='chart-mark');
assert.deepEqual(focused.map(n=>n.style.fill.tokenId),['color.textSecondary','color.componentPrimary','color.textSecondary']);
assert.deepEqual(focused.map(n=>n.data.highlighted),[false,true,false]);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_region_highlight_styles_are_explicit_and_exclusive(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:160,width:760,height:420};
const base={categories:['A','B','C'],series:[{name:'Current',values:[40,70,55]},{name:'Future',values:[48,82,61]}],legend:false};
const render=highlight=>REGISTRY.get('chart.column').render({id:'chart',frame,props:{...base,highlights:[highlight]}}).nodes;
const box=render({category:'B',style:'region-box'}).find(n=>n.role==='chart-highlight');
assert.equal(box.style.fill,'none');
assert.equal(box.style.stroke.tokenId,'color.componentPrimary');
assert.equal(box.style.lineWidth.tokenId,'line.standard');
assert.equal(box.data.highlightStyle,'region-box');
const boxNodes=render({category:'B',style:'region-box'});
const boxMarks=boxNodes.filter(n=>n.role==='chart-mark'&&n.data.category==='B');
const boxLabel=boxNodes.find(n=>n.role==='category-label'&&n.text==='B');
assert.ok(box.frame.y<Math.min(...boxMarks.map(n=>n.frame.y)));
assert.ok(box.frame.y+box.frame.height>Math.max(...boxMarks.map(n=>n.frame.y+n.frame.height)));
assert.ok(boxLabel.frame.y>box.frame.y+box.frame.height);
const tint=render({category:'B',style:'region-tint'}).find(n=>n.role==='chart-highlight');
assert.equal(tint.style.fill.tokenId,'color.surfaceMuted');
assert.equal(tint.style.stroke,'none');
assert.equal(tint.data.highlightStyle,'region-tint');
assert.deepEqual(tint.frame,box.frame);
for (const style of ['region-box','region-tint']) {
  const nodes=REGISTRY.get('chart.bar').render({id:'bar',frame,props:{...base,highlights:[{category:'C',style}]}}).nodes;
  const highlight=nodes.find(n=>n.role==='chart-highlight');
  const marks=nodes.filter(n=>n.role==='chart-mark'&&n.data.category==='C');
  for (const mark of marks) {
    assert.ok(mark.frame.x-highlight.frame.x>=12);
    assert.ok(highlight.frame.x+highlight.frame.width-mark.frame.x-mark.frame.width>=12-1e-8);
    assert.ok(mark.frame.y-highlight.frame.y>=12);
    assert.ok(highlight.frame.y+highlight.frame.height-mark.frame.y-mark.frame.height>=12);
  }
  assert.notEqual(marks[0].style.fill.tokenId,marks[1].style.fill.tokenId);
  assert.notEqual(marks[1].style.fill.tokenId,'color.chartSeries2');
}
const legacy=render({category:'B'}).find(n=>n.role==='chart-highlight');
assert.equal(legacy.data.highlightStyle,'region-tint');
assert.throws(()=>render({category:'B',style:'bar'}),/exactly one series/);
assert.throws(()=>REGISTRY.get('chart.column').render({id:'bad',frame,props:{...base,highlights:[{category:'A'},{category:'B'}]}}),/one primary/);
assert.throws(()=>render({category:'B',style:'glow'}),/Unknown chart highlight style/);
assert.throws(()=>REGISTRY.get('chart.line').render({id:'line',frame,props:{categories:['A','B'],series:[{name:'Measure',values:[1,2]}],highlights:[{category:'B',style:'bar'}]}}),/single-bar highlight/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_axis_labels_preserve_fractional_tick_values(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const deck=compileDeck({slides:[{id:'fractional',composition:component({id:'chart',component:'chart.column',frame:{x:60,y:160,width:1160,height:480},props:{categories:['2025','2026'],series:[{name:'Revenue',values:[13.624,24.768]}],yMax:30,showValueAxis:true}})}]},REGISTRY);
assert.deepEqual(deck.slides[0].nodes.filter(n=>n.role==='axis-label').map(n=>n.text),['0','7.5','15','22.5','30']);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_negative_waterfall_uses_signed_domain_and_preserves_precision(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props={categories:['Operating cash','Capex','Free cash flow'],values:[39.069,-44.924,-5.855],totals:[0,2],yMin:-10,yMax:50,valueFormat:{decimals:1}};
const deck=compileDeck({slides:[{id:'cash',notes:'Source: source.example; signed cash reconciliation',composition:component({id:'chart',component:'chart.waterfall',frame:{x:60,y:160,width:1160,height:480},props})}]},REGISTRY);
const nodes=deck.slides[0].nodes,zero=nodes.find(n=>n.id.endsWith('zero-baseline'));
const close=nodes.find(n=>n.role==='chart-mark'&&n.id.endsWith('free-cash-flow'));
assert.ok(zero&&close);
assert.ok(Math.abs(close.frame.y-zero.frame.y)<0.001);
assert.ok(close.frame.height>0&&close.frame.y+close.frame.height<640);
assert.ok(nodes.some(n=>n.role==='data-label'&&n.text==='-5.9'));
assert.equal(props.values[2],-5.855);
assert.equal(deck.slides[0].notes,'Source: source.example; signed cash reconciliation');
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_line_direct_labels_replace_legend_and_stay_inside_frame(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck,component} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props=REGISTRY.get('chart.line').variants['direct-end-labels'].props;
const deck=compileDeck({slides:[{id:'cash',composition:component({id:'chart',component:'chart.line',frame:{x:60,y:160,width:1160,height:480},props})}]},REGISTRY);
const nodes=deck.slides[0].nodes,labels=nodes.filter(n=>n.role==='data-label');
assert.deepEqual(labels.map(n=>n.text),['Operating cash 39.1','Capex 44.9']);
assert.equal(nodes.filter(n=>n.role==='legend-label').length,0);
for(const label of labels) assert.ok(label.frame.x+label.frame.width<=1220);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_signed_bars_area_polygons_and_chart_contracts_are_geometry_safe(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:60,y:150,width:760,height:430};
const column=REGISTRY.get('chart.column').render({id:'signed',frame,props:{categories:['Loss','Gain'],series:[{name:'Measure',values:[-30,50]}],yMin:-40,yMax:60,gridlines:true}}).nodes;
const zero=column.find(node=>node.id.endsWith('zero-baseline'));
const loss=column.find(node=>node.role==='chart-mark'&&node.data.category==='Loss');
assert.ok(zero&&loss.frame.height>100);
assert.ok(Math.abs(loss.frame.y-zero.data.y1)<0.001);
const stacked=REGISTRY.get('chart.stacked-column').render({id:'diverging',frame,props:{categories:['Plan'],series:[{name:'Upside',values:[35]},{name:'Risk',values:[-22]}],yMin:-30,yMax:40,dataLabels:true}}).nodes;
const stackedMarks=stacked.filter(node=>node.role==='chart-mark');
assert.equal(stackedMarks.length,2);
assert.ok(stackedMarks.every(node=>node.frame.height>1));
assert.ok(stackedMarks[0].frame.y+stackedMarks[0].frame.height<=stackedMarks[1].frame.y+0.01||stackedMarks[1].frame.y+stackedMarks[1].frame.height<=stackedMarks[0].frame.y+0.01);
const horizontal=REGISTRY.get('chart.bar').render({id:'horizontal',frame,props:{categories:['Loss','Gain'],series:[{name:'Measure',values:[-30,50]}],yMin:-40,yMax:60,gridlines:true}}).nodes;
assert.equal(horizontal.filter(node=>node.role==='axis-label').length,5);
assert.equal(horizontal.filter(node=>node.role==='chart-gridline').length,5);
const area=REGISTRY.get('chart.area').render({id:'area',frame,props:{categories:['Q1','Q2','Q3'],series:[{name:'Demand',values:[10,24,18]}]}}).nodes.filter(node=>node.role==='chart-area');
assert.equal(area.length,1);
assert.equal(area[0].type,'shape');
assert.equal(area[0].data.geometry,'customPolygon');
assert.equal(area[0].data.paths[0].length,5);
for(const invalid of [
  {component:'chart.column',props:{categories:['A','B'],series:[{name:'Value',values:[1]}]}},
  {component:'chart.line',props:{categories:['A','B'],series:[{name:'Value',values:[1,2]}],yMin:3,yMax:1}},
  {component:'chart.waterfall',props:{categories:['A','B'],values:[1]}},
  {component:'chart.combo',props:{categories:['A','B'],series:[{name:'Bars',values:[1,2]},{name:'Line',values:[1]}]}}
]) assert.throws(()=>REGISTRY.get(invalid.component).render({id:'invalid',frame,props:invalid.props}));
const bubble=REGISTRY.get('chart.bubble').render({id:'bubble',frame,props:{points:[{name:'Small',x:10,y:10,size:1},{name:'Large',x:90,y:90,size:10000}],xMin:0,xMax:100,yMin:0,yMax:100}}).nodes;
const bubbles=bubble.filter(node=>node.role==='chart-marker');
assert.deepEqual(bubbles.map(node=>node.frame.width),[18,72]);
assert.ok(bubbles.every(node=>node.style.fill.tokenId==='color.chartSeries1'));
assert.throws(()=>REGISTRY.get('chart.scatter').render({id:'mixed',frame,props:{points:[{name:'A',x:1,y:1,series:'One'},{name:'B',x:2,y:2}]}}),/all declare a series/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])
