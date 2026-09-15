import { token, tokenValue, textPrimitive, linePrimitive, ellipsePrimitive, shapePrimitive, stableId } from './core.mjs';
import { measureText } from './text-layout.mjs';

export const SCHEDULE_TOKENS = ['font.body','type.body','type.heading','type.compact','type.source','color.ink','color.textSecondary','color.componentPrimary','color.surface','color.rule','line.hairline','line.standard','space.1','space.2','space.3','space.4','icon.small'];
const t = token;
const gap = () => tokenValue(t('space.2'));
function scheduleGap(props) {
  check(props.spacing===undefined||['normal','tight'].includes(props.spacing),'unknown spacing');
  return props.spacing==='tight'?tokenValue(t('space.1')):gap();
}
const metrics = (text,width,size='type.body',bold=false) => measureText(text,width,{fontFamily:tokenValue(t('font.body')),fontSize:tokenValue(t(size)),bold});
const check = (ok,message) => { if (!ok) throw new Error(`Schedule: ${message}`); };
function labelRole(props) {
  check(props.labelTreatment===undefined||['standard','prominent'].includes(props.labelTreatment),'unknown label treatment');
  return props.labelTreatment==='prominent'?'type.heading':'type.body';
}
const requiredText=(value,name)=>check(typeof value==='string'&&value.trim(),`${name} requires nonempty text`);
function keyed(records,name,seen=new Set()) {
  check(Array.isArray(records),`${name} must be an array`);
  return new Map(records.map(record=>{
    check(record && typeof record.id==='string' && record.id.trim() && !seen.has(record.id),`${name} requires unique nonempty IDs`);
    seen.add(record.id);return [record.id,record];
  }));
}
function writer(id,frame,defaultSize='type.body') {
  const nodes=[];
  check(frame&&['x','y','width','height'].every(key=>Number.isFinite(frame[key]))&&frame.width>0&&frame.height>0,'invalid frame');
  const text=(key,value,x,y,width,{size=defaultSize,bold=false,role='schedule-label',align='left',dependencies=[],data={}}={})=>{
    requiredText(value,key);check(Number.isFinite(width)&&width>0,'text width must be positive');
    const m=metrics(value,width,size,bold);
    nodes.push(textPrimitive({id:stableId(id,key),role,frame:{x,y,width,height:m.height},text:m.text,style:{fontFamily:t('font.body'),fontSize:t(size),color:t('color.ink'),bold,align,valign:'top',lineHeight:m.lineHeight,wrap:false},data:{...data,textLayout:m,dependencies:dependencies.map(key=>stableId(id,key))}}));
    return m.height;
  };
  const line=(key,x1,y1,x2,y2,role='schedule-rule',dependencies=[])=>nodes.push(linePrimitive({id:stableId(id,key),role,x1,y1,x2,y2,style:{stroke:t('color.rule'),lineWidth:t('line.hairline')},data:{dependencies:dependencies.map(key=>stableId(id,key))}}));
  const marker=(key,x,y,symbol,dependencies=[])=>{
    const size=tokenValue(t('icon.small'));
    const input={id:stableId(id,key),role:'schedule-event',frame:{x:x-size/2,y:y-size/2,width:size,height:size},style:{fill:symbol==='open-circle'?'none':t('color.componentPrimary'),stroke:t('color.componentPrimary'),lineWidth:t('line.standard')},data:{dependencies:dependencies.map(key=>stableId(id,key))}};
    nodes.push(symbol==='open-circle'?ellipsePrimitive(input):shapePrimitive({...input,geometry:'triangle'}));
  };
  const finish=()=>{
    check(new Set(nodes.map(n=>n.id)).size===nodes.length,'generated IDs collide; use distinct record IDs');
    const known=new Set(nodes.map(n=>n.id));
    for(const n of nodes)check((n.data?.dependencies||[]).every(key=>known.has(key)),`${n.id} has a missing dependency`);
    for(const node of nodes) check(node.frame.x>=frame.x-.1&&node.frame.y>=frame.y-.1&&node.frame.x+node.frame.width<=frame.x+frame.width+.1&&node.frame.y+node.frame.height<=frame.y+frame.height+.1,`${node.id} exceeds allocated frame; enlarge the composition`);
    return {nodes,height:Math.max(0,...nodes.map(n=>n.frame.y+n.frame.height-frame.y))};
  };
  return {nodes,text,line,marker,finish};
}
function qualifiers(w,props,y,frame,known) {
  for(const q of keyed(props.qualifiers||[],'qualifiers',known).values()) {
    const references=q.relatedTo??q.appliesTo??[];
    check(Array.isArray(references)&&references.every(key=>known.has(key)),'qualifiers require exact known references');
    y+=w.text(q.id,q.text,frame.x,y,frame.width,{size:'type.source',dependencies:references})+scheduleGap(props)/2;
  }
  return y;
}

export function timeGrid(input) {
  const {id,frame,props}=input, size=labelRole(props), g=scheduleGap(props), w=writer(id,frame,size), seen=new Set(['axis']);
  check(props.axis?.kind==='periods'&&typeof props.axis.precision==='string'&&props.axis.precision.trim(),'time-grid requires declared period precision');
  const periods=keyed(props.axis.periods,'periods',seen), lanes=keyed(props.lanes,'lanes',seen), bands=keyed(props.bands||[],'bands',seen), kinds=keyed(props.eventKinds,'event kinds',seen);
  check(periods.size>0&&lanes.size>0,'periods and lanes cannot be empty');
  check(kinds.size>0,'event kinds cannot be empty');
  for(const kind of kinds.values()){check(['triangle','open-circle'].includes(kind.symbol),'unknown event symbol');requiredText(kind.label,'event kind');}
  const labelWidth=props.labelWidth??frame.width*.25;
  check(Number.isFinite(labelWidth)&&labelWidth>0&&labelWidth<frame.width/2,'invalid lane label width');
  const left=frame.x+labelWidth+g, cell=(frame.width-labelWidth-g)/periods.size;
  const keys=[...periods.keys()], index=key=>{check(periods.has(key),`unknown period ${key}`);return keys.indexOf(key);};
  let y=frame.y;
  check(cell>g+tokenValue(t('icon.small')),'period cells are too narrow');
  const axisLabel=props.axis.label??`${props.axis.precision}${props.axis.year?` · ${props.axis.year}`:''}`;
  const axisHeight=Math.max(metrics(axisLabel,labelWidth,size,true).height,...[...periods.values()].map(p=>metrics([p.label,p.startLabel].filter(Boolean).join('\n'),cell-g,size,true).height));
  w.text('axis',axisLabel,frame.x,y,labelWidth,{bold:true});
  for(const [i,p] of [...periods.values()].entries()) w.text(p.id,[p.label,p.startLabel].filter(Boolean).join('\n'),left+i*cell,y,cell-g,{bold:true,dependencies:['axis']});
  y+=axisHeight+g;
  for(const band of bands.values()) {
    const items=keyed(band.items,`band ${band.id}`,seen), occupied=new Set();
    let height=metrics(band.label,labelWidth,size,true).height;
    for(const item of items.values()) {
      const start=index(item.periodId), span=item.labelSpanPeriodCount??1;
      check(Number.isInteger(span)&&span>0&&start+span<=keys.length,'invalid text span');
      check(span===1||typeof item.spanPurpose==='string'&&item.spanPurpose.trim(),'text span requires explicit non-duration purpose');
      for(let k=start;k<start+span;k++){check(!occupied.has(k),'band text spans overlap');occupied.add(k);}
      height=Math.max(height,metrics(item.text,span*cell-g,size).height);
      w.text(item.id,item.text,left+start*cell,y,span*cell-g,{dependencies:[band.id,item.periodId],data:{periodId:item.periodId,labelSpanPeriodCount:span,spanPurpose:item.spanPurpose??null}});
    }
    w.text(band.id,band.label,frame.x,y,labelWidth,{bold:true,dependencies:['axis']});
    y+=height+g;w.line(`${band.id}-rule`,frame.x,y,left+keys.length*cell,y);y+=g;
  }
  for(const lane of lanes.values()) {
    const events=keyed(lane.events,`events in ${lane.id}`,seen), label=[lane.identifier,lane.label].filter(Boolean).join('  ');
    const height=Math.max(metrics(label,labelWidth,size).height,tokenValue(t('icon.small')))+g;
    w.text(lane.id,label,frame.x,y+g/2,labelWidth,{dependencies:['axis']});
    const cells=new Map();
    for(const event of events.values()) {
      index(event.periodId);check(kinds.has(event.kind),'unknown event kind');
      const cellEvents=cells.get(event.periodId)||[];cellEvents.push(event);cells.set(event.periodId,cellEvents);
    }
    for(const [periodId,events] of cells) {
      const size=tokenValue(t('icon.small')), spacing=size+g/2;
      check(events.length*spacing<=cell-g,'simultaneous symbols exceed period width');
      for(const [i,event] of events.entries()) {
        check(event.label===undefined,'labelled grid events require an agenda band');
        w.marker(event.id,left+(index(periodId)+.5)*cell+(i-(events.length-1)/2)*spacing,y+height/2,kinds.get(event.kind).symbol,[lane.id,periodId,event.kind]);
      }
    }
    y+=height;w.line(`${lane.id}-rule`,frame.x,y,left+keys.length*cell,y);y+=g/2;
  }
  y+=g;let x=left;
  let legendHeight=0;
  for(const kind of kinds.values()) {
    const symbolSize=tokenValue(t('icon.small')), m=metrics(kind.label,frame.width,size), width=m.width+g;
    legendHeight=Math.max(legendHeight,m.height,symbolSize);
    w.marker(`${kind.id}-symbol`,x+symbolSize/2,y+symbolSize/2,kind.symbol,[kind.id]);
    w.text(kind.id,kind.label,x+symbolSize+g,y,width,{dependencies:['axis']});x+=symbolSize+width+g*3;
  }
  y+=legendHeight+g;
  qualifiers(w,props,y,frame,seen);
  return w.finish();
}

const dateValue=value=>{
  check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'dates require ISO day precision');
  const parsed=Date.parse(`${value}T00:00:00Z`);
  check(Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===value,'invalid date');return parsed/86400000;
};
export function datedLanes({id,frame,props}) {
  check(props.dateTreatment===undefined||['source','body'].includes(props.dateTreatment),'unknown date treatment');
  const dateSize=props.dateTreatment==='body'?'type.body':'type.source';
  const size=labelRole(props), w=writer(id,frame,size),g=scheduleGap(props),seen=new Set(['axis']);
  check(props.axis?.kind==='date'&&props.axis.scale==='elapsed-days'&&props.axis.precision==='day','dated-lanes requires explicit elapsed-days scale');
  check(Array.isArray(props.axis.domain)&&props.axis.domain.length===2,'date domain requires two endpoints');
  const [start,end]=props.axis.domain.map(dateValue);check(end>start,'date domain must increase');
  const lanes=keyed(props.lanes,'lanes',seen),events=keyed(props.events,'events',seen);
  check(lanes.size>0,'lanes cannot be empty');
  const labelWidth=props.labelWidth??frame.width*.2,left=frame.x+labelWidth+g,right=frame.x+frame.width;
  check(Number.isFinite(labelWidth)&&labelWidth>0&&labelWidth<frame.width/2,'invalid lane label width');
  const markerSize=tokenValue(t('icon.small')),domainLeft=left+markerSize/2,domainRight=right-markerSize/2;
  const xDate=date=>{const day=dateValue(date);check(day>=start&&day<=end,'event outside date domain');return domainLeft+(day-start)/(end-start)*(domainRight-domainLeft);};
  for(const e of events.values()){
    check(lanes.has(e.laneId),'unknown event lane');requiredText(e.label,'event');xDate(e.date);
    for(const field of ['duration','location','qualification'])if(e[field]!==undefined)requiredText(e[field],field);
  }
  const relationships=props.relationships||[];
  check(Array.isArray(relationships),'relationships must be an array');
  for(const r of relationships) check(events.has(r.from)&&events.has(r.to)&&r.from!==r.to&&typeof r.kind==='string'&&r.kind&&typeof r.basis==='string'&&r.basis,'relationships require exact distinct event endpoints and a basis');
  const laneKeys=[...lanes.keys()], paired=relationships.length>0;
  if(paired) for(const r of relationships) check(events.get(r.from).laneId===laneKeys[1]&&events.get(r.to).laneId===laneKeys[0],'relationship routing requires the first two adjacent lanes, with refinement below approval');
  let y=frame.y+w.text('axis',props.axis.label??`${props.axis.domain[0]} – ${props.axis.domain[1]} · elapsed days`,left,frame.y,right-left,{size:'type.source'})+g;
  const anchors=new Map();
  for(const [laneIndex,lane] of [...lanes.values()].entries()) {
    const label=[lane.label,lane.responsibility,lane.roleQualification].filter(Boolean).join('\n');
    const laneTop=y, above=paired&&laneIndex===0;
    const laneEvents=[...events.values()].filter(e=>e.laneId===lane.id).sort((a,b)=>dateValue(a.date)-dateValue(b.date));
    const boxes=laneEvents.map(e=>{
      const labelSpan=e.labelWidth??props.eventLabelWidth??(right-left)/Math.max(2,laneEvents.length);
      check(Number.isFinite(labelSpan)&&labelSpan>g&&labelSpan<=right-left,'invalid event label width');
      const text=[e.label,[e.duration,e.location,e.qualification].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
      const width=labelSpan-g,m=metrics(text,width,size),date=metrics(e.date,width,dateSize);
      return {e,text,width,height:m.height+date.height+g/2,dateHeight:date.height,x:Math.max(left,xDate(e.date)-width/2)};
    });
    // Pack ordered labels together; event markers retain their exact elapsed-day positions.
    for(let i=1;i<boxes.length;i++) boxes[i].x=Math.max(boxes[i].x,boxes[i-1].x+boxes[i-1].width+g);
    for(let i=boxes.length-1;i>=0;i--) boxes[i].x=Math.min(boxes[i].x,i===boxes.length-1?right-boxes[i].width:boxes[i+1].x-g-boxes[i].width);
    check(boxes.every(b=>b.x>=left),'event labels cannot fit together; enlarge the chart or reduce label width');
    const textHeight=Math.max(0,...boxes.map(b=>b.height));
    const railY=above?y+textHeight+g+markerSize/2:y+markerSize/2;
    const textY=above?y:railY+markerSize/2+g;
    w.text(lane.id,label,frame.x,y,labelWidth,{bold:true,dependencies:['axis']});
    if(laneEvents.length)w.line(`${lane.id}-rail`,domainLeft,railY,domainRight,railY,'schedule-rail',[lane.id]);
    for(const b of boxes) {
      const x=xDate(b.e.date);anchors.set(b.e.id,{x,y:railY});
      w.marker(b.e.id,x,railY,'open-circle',[lane.id,`${b.e.id}-text`]);
      w.text(`${b.e.id}-date`,b.e.date,b.x,textY,b.width,{size:dateSize,align:x+markerSize/2>=b.x+b.width-g?'right':'left',dependencies:[b.e.id]});
      w.text(`${b.e.id}-text`,b.text,b.x,textY+b.dateHeight+g/2,b.width,{align:x+markerSize/2>=b.x+b.width-g?'right':'left',dependencies:[b.e.id]});
      const stemY=above?railY-markerSize/2:railY+markerSize/2;
      const textEdge=above?textY+textHeight+g/2:textY-g/2;
      // Ordered labels and monotone endpoint routing stay in the empty strip
      // between text and rail, never through a shorter neighbour's label.
      w.line(`${b.e.id}-stem`,x,stemY,Math.max(b.x,Math.min(x,b.x+b.width)),textEdge,'schedule-stem',[b.e.id]);
    }
    let bottom=laneEvents.length?(above?railY+markerSize/2:textY+textHeight):y;
    if(lane.continuousActivity) {
      const activity=lane.continuousActivity;
      keyed([activity],'continuous activity',seen);
      check(activity.extent==='visible planning horizon'&&activity.extentQualification,'continuous activity requires a qualified visual horizon');
      bottom+=w.text(activity.id,activity.label,left,bottom,right-left,{dependencies:[lane.id]});
      bottom+=g;
      w.line(`${activity.id}-horizon`,domainLeft,bottom,domainRight,bottom,'schedule-rail',[lane.id,activity.id]);
      bottom+=w.text(`${activity.id}-qualification`,activity.extentQualification,left,bottom+g/2,right-left,{size:'type.source',dependencies:[activity.id]})+g;
    }
    y=Math.max(bottom,laneTop+metrics(label,labelWidth,size,true).height)+g;
    if(above)y+=tokenValue(t('space.4'));
  }
  for(const [i,r] of relationships.entries()) {
    const a=anchors.get(r.from),b=anchors.get(r.to);
    const node=linePrimitive({id:stableId(id,`relationship-${i}`),role:'schedule-relationship',x1:a.x,y1:a.y-markerSize/2,x2:b.x,y2:b.y+markerSize/2,style:{stroke:t('color.componentPrimary'),lineWidth:t('line.standard')},data:{endArrow:true,endArrowType:'triangle',kind:r.kind,basis:r.basis,dependencies:[stableId(id,r.from),stableId(id,r.to)]}});
    w.nodes.push(node);
  }
  qualifiers(w,props,y,frame,seen);
  return w.finish();
}

export const SCHEDULE_VARIANTS={
  'time-grid':{preferredSize:{width:1160,height:570},props:{labelTreatment:'prominent',axis:{kind:'periods',precision:'week',periods:[1,2,3,4].map(i=>({id:`w${i}`,label:`Week ${i}`}))},bands:[{id:'agenda',label:'Decisions',items:[{id:'scope',periodId:'w1',text:'Confirm scope',labelSpanPeriodCount:2,spanPurpose:'Text wrapping only'},{id:'approval',periodId:'w3',text:'Approve release'}]}],lanes:[{id:'spec',label:'Specification',events:[{id:'review',periodId:'w2',kind:'meeting'},{id:'spec-ready',periodId:'w2',kind:'document'}]},{id:'release',label:'Release package',events:[{id:'ready',periodId:'w4',kind:'document'}]}],eventKinds:[{id:'document',label:'Document',symbol:'triangle'},{id:'meeting',label:'Meeting',symbol:'open-circle'}]}},
  'dated-lanes':{preferredSize:{width:1160,height:570},props:{labelTreatment:'prominent',axis:{kind:'date',scale:'elapsed-days',precision:'day',domain:['2026-01-01','2026-03-01']},lanes:[{id:'reviewers',label:'Review board',responsibility:'Approves'},{id:'team',label:'Working team',responsibility:'Develops',continuousActivity:{id:'draft',label:'Weekly design review',extent:'visible planning horizon',extentQualification:'Ongoing contribution; endpoints are not start or completion dates'}}],events:[{id:'scope',laneId:'reviewers',date:'2026-01-07',label:'Approve scope'},{id:'launch',laneId:'reviewers',date:'2026-02-23',label:'Release decision',qualification:'Provisional date'}]}}
};
