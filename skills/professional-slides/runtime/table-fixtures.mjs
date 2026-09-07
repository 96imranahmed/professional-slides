// Representative contracts, not a taxonomy for selecting business slide layouts.
const size={width:1160,height:580};
const bullets=(...items)=>({type:'bullets',items});
const category=text=>({type:'category',text});
const text=(label,width,type='text')=>({label,width,type});
const rating={type:'harvey',label:'Strategic fit',min:0,max:4,anchors:{0:'None',1:'Limited',2:'Mixed',3:'Strong',4:'Complete'}};
const binary={type:'binary',label:'Confirmation',test:'The available evidence supports the stated hypothesis',labelDisplay:'none',states:{yes:'Supported',no:'Not supported',missing:'Not assessed'}};
const trends={columns:[text('Trend',.18,'category'),text('Description',.53),text('Examples',.29)],rows:[
  ['(Insert trend 1)',bullets('(Insert supporting point 1)','(Insert supporting point 2)'),'(Insert example)'],
  ['(Insert trend 2)',bullets('(Insert supporting point 1)','(Insert supporting point 2)'),'(Insert example)'],
  ['(Insert trend 3)',bullets('(Insert supporting point 1)','(Insert supporting point 2)'),'(Insert example)']
]};
const groups={columns:[text('Area',.2,'category'),text('Hypothesis',.5,'highlight'),text('Confirmation',.18,'binary'),text('Fit',.12,'harvey')],scales:{confirmation:binary,fit:rating},rows:[
 [{...category('(Insert area 1)'),rowSpan:2},'(Insert hypothesis 1.1)',{value:'yes',scale:'confirmation'},{value:3,scale:'fit'}],
 [null,'(Insert hypothesis 1.2)',{value:'no',scale:'confirmation'},{value:1,scale:'fit'}],
 [{...category('(Insert area 2)'),rowSpan:2},'(Insert hypothesis 2.1)',{value:'yes',scale:'confirmation'},{value:4,scale:'fit'}],
 [null,'(Insert hypothesis 2.2)',{value:'missing',scale:'confirmation'},{value:'missing',scale:'fit'}]
]};
const labelledGroups={...groups,scales:{...groups.scales,confirmation:{...binary,labelDisplay:'state'}}};
const competitorBars={columns:[text('Competitor',.16,'category'),text('Positioning',.32),{...text('Revenue and profit',.28,'bars'),scale:'economics'},{...text('Growth',.12,'number'),align:'center'},{...text('Margin',.12,'number'),numberDisplay:'oval',align:'center'}],scales:{economics:{type:'bars',label:'Revenue and operating profit',min:0,max:600,unit:'USD millions',series:['Revenue','Operating profit']}},rows:[
 ['Company A',bullets('(Insert positioning point 1)','(Insert positioning point 2)'),{values:[501,76]},'8%','15%'],
 ['Company B',bullets('(Insert positioning point 1)','(Insert positioning point 2)'),{values:[347,55]},'12%','16%'],
 ['Company C',bullets('(Insert positioning point 1)','(Insert positioning point 2)'),{values:[289,45]},'6%','16%']
]};
export const TABLE_VARIANTS={
 standard:{props:{treatment:'standard'}},
 open:{props:{treatment:'open'}},
 'plain-rows':{preferredSize:size,props:{...trends,columns:trends.columns.map(c=>({...c,type:'text'})),rowStyle:'plain'}},
 'accented-rows':{preferredSize:size,props:{...trends,columns:trends.columns.map(c=>({...c,type:'text'})),rowStyle:'accented'}},
 'category-bullets':{preferredSize:size,props:trends},
 'grouped-hypotheses':{preferredSize:size,props:groups},
 'grouped-hypotheses-labelled':{preferredSize:size,props:labelledGroups},
 'numbered-sections':{preferredSize:size,props:{...groups,rows:[
  [{...category('(Insert area 1)'),rowSpan:2,sectionNumber:1},'(Insert hypothesis 1.1)',{value:'yes',scale:'confirmation'},{value:3,scale:'fit'}],
  [null,'(Insert hypothesis 1.2)',{value:'no',scale:'confirmation'},{value:1,scale:'fit'}],
  [{...category('(Insert area 2)'),rowSpan:2,sectionNumber:2},'(Insert hypothesis 2.1)',{value:'yes',scale:'confirmation'},{value:4,scale:'fit'}],
  [null,'(Insert hypothesis 2.2)',{value:'missing',scale:'confirmation'},{value:'missing',scale:'fit'}]
 ]}},
 'grouped-text':{preferredSize:size,props:{columns:[text('Area',.2,'category'),text('Hypothesis',.8,'highlight')],rows:groups.rows.map(row=>row.slice(0,2))}},
 'rating-scale':{preferredSize:size,props:{columns:[text('Option',.3,'category'),{...text('Strategic fit',.25,'harvey'),scale:'fit'},text('Interpretation',.45)],scales:{fit:rating},rows:Array.from({length:5},(_,i)=>[`Option ${String.fromCharCode(65+i)}`,{value:i},['No requirements are satisfied.','Only a limited part of the requirements is satisfied.','The option meets some requirements but has material gaps.','Most requirements are satisfied with manageable gaps.','All defined requirements are satisfied.'][i]])}},
 'options-as-columns':{preferredSize:size,props:{columns:[text('Criterion',.2,'category'),text('Option A',.4),text('Option B',.4)],scales:{fit:rating},rows:[
  ['Approach','(Insert option A description)','(Insert option B description)'],
  ['Advantages',bullets('(Insert advantage 1)','(Insert advantage 2)'),bullets('(Insert advantage 1)','(Insert advantage 2)')],
  ['Trade-offs',bullets('(Insert trade-off 1)','(Insert trade-off 2)'),bullets('(Insert trade-off 1)','(Insert trade-off 2)')],
  ['Strategic fit',{type:'harvey',value:2,scale:'fit'},{type:'harvey',value:3,scale:'fit'}]
 ]}},
 'bar-columns':{preferredSize:size,props:competitorBars},
 'bar-columns-plain-numbers':{preferredSize:size,props:{...competitorBars,columns:competitorBars.columns.map(column=>column.type==='number'?{...column,numberDisplay:'plain',align:'right'}:column)}},
 'variable-cardinality':{preferredSize:size,props:{columns:[text('Market',.2,'category'),text('Signal',.24),{...text('Growth',.12,'number'),align:'center'},{...text('Share',.12,'number'),numberDisplay:'plain',align:'right'},text('Evidence',.2),text('Owner',.12)],rows:Array.from({length:8},(_,index)=>[
  `(Insert market ${index+1})`,`(Insert signal ${index+1})`,`${6+index}%`,`${18+index}%`,`(Insert evidence ${index+1})`,`(Insert owner ${index+1})`
 ])}},
 'heatmap-1-10':{preferredSize:size,props:{columns:[text('Capability',.32,'category'),{...text('Current',.2,'heatmap'),scale:'maturity'},{...text('Target',.2,'heatmap'),scale:'maturity'},text('Development priority',.28)],scales:{maturity:{type:'heatmap',label:'Maturity',min:1,max:10,palette:'theme-sequential',anchors:{1:'Not established',5:'Repeatable',10:'Fully embedded'}}},rows:[['(Insert capability 1)',{value:4},{value:8},'(Insert development priority)'],['(Insert capability 2)',{value:7},{value:9},'(Insert development priority)'],['(Insert capability 3)',{value:'missing'},{value:7},'(Insert development priority)']]}},
 'heatmap-diverging':{preferredSize:size,props:{columns:[text('Area',.4),{...text('Net effect',.2,'heatmap'),scale:'effect'},text('Interpretation',.4)],scales:{effect:{type:'heatmap',label:'Net effect',min:1,max:5,midpoint:3,palette:'red-white-green',anchors:{1:'Adverse',3:'Neutral',5:'Favorable'}}},rows:[['(Insert area 1)',{value:5},'(Insert interpretation)'],['(Insert area 2)',{value:1},'(Insert interpretation)'],['(Insert area 3)',{value:3},'(Insert interpretation)'],['(Insert excluded area)',{value:'na'},'(Insert exclusion rationale)']]}},
 'heatmap-adverse':{preferredSize:size,props:{columns:[text('Area',.4),{...text('Concern level',.2,'heatmap'),scale:'concern'},text('Interpretation',.4)],scales:{concern:{type:'heatmap',label:'Concern level',min:1,max:5,palette:'red-white',anchors:{1:'Material concern',5:'No identified concern'}}},rows:[['(Insert area 1)',{value:1},'(Insert interpretation)'],['(Insert area 2)',{value:5},'(Insert interpretation)'],['(Insert area 3)',{value:'missing'},'(Insert evidence gap)']]}},
 'implication-columns':{preferredSize:size,props:{columns:[text('Area',.2,'category'),text('Observed condition',.36),{label:'',width:{px:60},type:'implication',relation:'implies'},text('Implication',.44)],rows:[
 ['Area A',bullets('(Insert observed condition 1)','(Insert observed condition 2)'),{},'(Insert implication)'],
 ['Area B',bullets('(Insert observed condition 1)','(Insert observed condition 2)'),{},'(Insert implication)'],
 ['Area C',bullets('(Insert observed condition 1)','(Insert observed condition 2)'),{},'(Insert implication)']
 ]}}
};
