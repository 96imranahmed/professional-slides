import { token, tokenValue, textPrimitive, rectPrimitive, ellipsePrimitive, linePrimitive, stableId } from './core.mjs';
import { measureText } from './text-layout.mjs';

export const RELATIONSHIP_NETWORK_TOKENS = Object.freeze(['font.body','type.body','color.ink','color.componentPrimary','color.surface','color.surfaceMuted','color.rule','line.standard','line.hairline','space.1','space.2','space.3','space.4','color.accent','color.onPrimary','radius.round','radius.none']);
const t=token, v=id=>tokenValue(t(id));
const check=(condition,message)=>{if(!condition)throw new Error(`Relationship network: ${message}`);};
const required=(value,name)=>check(typeof value==='string'&&value.trim(),`${name} requires nonempty text`);
const overlap=(a,b,gap=0)=>a.x < b.x+b.width+gap && a.x+a.width+gap > b.x && a.y < b.y+b.height+gap && a.y+a.height+gap > b.y;
const center=frame=>({x:frame.x+frame.width/2,y:frame.y+frame.height/2});
function measure(value,width,bold=false){return measureText(value,width,{fontFamily:v('font.body'),fontSize:v('type.body'),bold});}
function normalize(props){
 check(props.variant===undefined||['hub-ring','directed-spokes'].includes(props.variant),'unsupported variant');
 check(Array.isArray(props.nodes)&&props.nodes.length>=4&&props.nodes.length<=7,'hub-ring needs a center and three to six perimeter nodes');
 const ids=new Set(),nodes=new Map();
 for(const node of props.nodes){required(node?.id,'node id');check(!ids.has(node.id),'duplicate node or edge ID');ids.add(node.id);required(node.label,'node label');if(node.body!==undefined)required(node.body,'node body');nodes.set(node.id,node);}
 check(nodes.has(props.centerId),'centerId must reference an exact node');
 check(Array.isArray(props.ringOrder)&&props.ringOrder.length===nodes.size-1&&new Set(props.ringOrder).size===props.ringOrder.length,'ringOrder must include every perimeter node exactly once');
 check(props.ringOrder.every(id=>nodes.has(id)&&id!==props.centerId),'ringOrder contains an unknown node or center');
 check(Array.isArray(props.edges)&&props.edges.length>0,'explicit edges are required; layout does not invent relationships');
 const seen=new Set(),degree=new Map([...nodes.keys()].map(id=>[id,0]));
 for(const edge of props.edges){
  required(edge?.id,'edge id');check(!ids.has(edge.id),'duplicate node or edge ID');ids.add(edge.id);
  check(nodes.has(edge.from)&&nodes.has(edge.to),'edge endpoints must reference exact node IDs');check(edge.from!==edge.to,'self edges are unsupported');
  check(['forward','bidirectional','none'].includes(edge.direction),'edge direction must be forward, bidirectional or none');
  required(edge.relation,'edge relation');
  check(edge.label===undefined,'visible edge labels are unsupported; include necessary relationship wording in node content or use another composition');
  const key=[edge.from,edge.to].sort().join('|');check(!seen.has(key),'duplicate endpoint pair; use one bidirectional edge for reciprocal relations');seen.add(key);
  const fromIndex=props.ringOrder.indexOf(edge.from),toIndex=props.ringOrder.indexOf(edge.to);
  const neighbor=Math.abs(fromIndex-toIndex)===1||Math.abs(fromIndex-toIndex)===props.ringOrder.length-1;
  check(edge.from===props.centerId||edge.to===props.centerId||neighbor,'hub-ring supports spokes and adjacent perimeter edges; a cross-ring chord requires another topology');
  degree.set(edge.from,degree.get(edge.from)+1);degree.set(edge.to,degree.get(edge.to)+1);
 }
 if(props.variant==='directed-spokes')check(props.edges.every(edge=>edge.from===props.centerId&&edge.direction==='forward'),'directed-spokes requires forward edges from the center');
 check([...degree.values()].every(count=>count>0),'every displayed node must participate in an explicit edge');
 return {nodes,edges:props.edges,centerId:props.centerId,ringOrder:props.ringOrder};
}
function framesFor(model,frame){
 const g=v('space.2'),pad=v('space.3'),n=model.ringOrder.length;
 const width=frame.width*(n===4?.27:n>=5?.23:.27),centerWidth=frame.width*.26;
 const measured=new Map([...model.nodes].map(([id,node])=>{
  const w=id===model.centerId?centerWidth:width,inner=w-pad*2;
  check(inner>0,'node text width is exhausted');
  const heading=measure(node.label,inner,true),body=node.body?measure(node.body,inner):null;
  const height=pad*2+heading.height+(body?g+body.height:0);
  return [id,{heading,body,width:w,height:id===model.centerId?Math.max(height,pad*4+heading.height+(body?g+body.height:0)):height}];
 }));
 const maxHeight=Math.max(...model.ringOrder.map(id=>measured.get(id).height));
 const centerHeight=measured.get(model.centerId).height;
 check(frame.height>=maxHeight*2+g*4,'frame is too short for measured perimeter content');
 const locations=new Map([[model.centerId,{x:frame.x+(frame.width-centerWidth)/2,y:frame.y+(frame.height-centerHeight)/2,width:centerWidth,height:centerHeight}]]);
 model.ringOrder.forEach((id,index)=>{
  const m=measured.get(id);let x,y;
  if(n===4){
   const left=index===0||index===3,top=index<2;
   x=frame.x+(left?0:frame.width-m.width);y=frame.y+(top?0:frame.height-m.height);
  }else{
   const angle=-Math.PI/2+2*Math.PI*index/n;
   x=frame.x+frame.width/2+Math.cos(angle)*(frame.width-width)/2-m.width/2;
   y=frame.y+frame.height/2+Math.sin(angle)*(frame.height-maxHeight)/2-m.height/2;
  }
  locations.set(id,{x,y,width:m.width,height:m.height});
 });
 const records=[...locations];
 for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++)check(!overlap(records[i][1],records[j][1],g*2),`measured nodes ${records[i][0]} and ${records[j][0]} leave no connector clearance; enlarge the frame or revise content`);
 return {locations,measured};
}
function endpoint(rect,toward,gap){
 const c=center(rect),dx=toward.x-c.x,dy=toward.y-c.y;
 const scale=Math.min(dx===0?Infinity:rect.width/2/Math.abs(dx),dy===0?Infinity:rect.height/2/Math.abs(dy));
 const length=Math.hypot(dx,dy);check(length>0,'coincident node centers');
 return {x:c.x+dx*scale+dx/length*gap,y:c.y+dy*scale+dy/length*gap};
}
function segmentIntersectsRect(a,b,rect){
 // Liang-Barsky clipping: reject lines passing through unrelated content boxes.
 const dx=b.x-a.x,dy=b.y-a.y;let low=0,high=1;
 for(const [p,q]of [[-dx,a.x-rect.x],[dx,rect.x+rect.width-a.x],[-dy,a.y-rect.y],[dy,rect.y+rect.height-a.y]]){
  if(Math.abs(p)<1e-8){if(q<0)return false;continue;}
  const ratio=q/p;if(p<0)low=Math.max(low,ratio);else high=Math.min(high,ratio);if(low>high)return false;
 }
 return low<=high;
}
export function relationshipNetwork({id,frame,props}){
 check(frame&&['x','y','width','height'].every(k=>Number.isFinite(frame[k]))&&frame.width>0&&frame.height>0,'invalid frame');
 const model=normalize(props),{locations,measured}=framesFor(model,frame),nodes=[],pad=v('space.3'),g=v('space.2');
 const nodeKey=key=>stableId(id,'node',key),headingKey=key=>stableId(nodeKey(key),'heading');
 for(const edge of model.edges){
  const from=locations.get(edge.from),to=locations.get(edge.to),a=endpoint(from,center(to),g),b=endpoint(to,center(from),g);
  check(Math.hypot(b.x-a.x,b.y-a.y)>=g*2,`edge ${edge.id} has no clear connector length`);
  for(const [key,rect]of locations)if(key!==edge.from&&key!==edge.to)check(!segmentIntersectsRect(a,b,{x:rect.x-g,y:rect.y-g,width:rect.width+g*2,height:rect.height+g*2}),`edge ${edge.id} crosses unrelated node ${key}; revise topology or enlarge composition`);
  nodes.push(linePrimitive({id:stableId(id,'edge',edge.id),role:'network-edge',x1:a.x,y1:a.y,x2:b.x,y2:b.y,style:{stroke:t('color.rule'),lineWidth:t('line.standard')},data:{edgeId:edge.id,from:nodeKey(edge.from),to:nodeKey(edge.to),relation:edge.relation,direction:edge.direction,dependencies:[nodeKey(edge.from),nodeKey(edge.to)],startArrow:edge.direction==='bidirectional',startArrowType:'triangle',endArrow:edge.direction!=='none',endArrowType:'triangle'}}));
 }
 for(const [key,node]of model.nodes){
  const box=locations.get(key),m=measured.get(key),isCenter=key===model.centerId;
  // The centre is a filled navy ellipse; perimeter nodes are filled boxes,
  // navy by default, accent when the node says `tone: "accent"`, outline
  // when `tone: "outline"`, so a model like the 7S can separate hard from soft.
  const tone=isCenter?'primary':(node.tone??'primary');
  const fill=tone==='accent'?t('color.accent'):tone==='outline'?t('color.surface'):t('color.componentPrimary');
  const onFill=tone==='outline'?t('color.ink'):t('color.onPrimary');
  const shapeStyle={fill,stroke:tone==='outline'?t('color.componentPrimary'):'none',lineWidth:t('line.standard'),radius:t(isCenter?'radius.round':'radius.none')};
  const nodeData={nodeId:key,position:isCenter?'center':'perimeter',ringIndex:model.ringOrder.indexOf(key),dependencies:[headingKey(key)],tone};
  nodes.push(isCenter?ellipsePrimitive({id:nodeKey(key),role:'network-node',frame:box,style:shapeStyle,data:nodeData}):rectPrimitive({id:nodeKey(key),role:'network-node',frame:box,style:shapeStyle,data:nodeData}));
  const block=m.heading.height+(m.body?g+m.body.height:0), top=box.y+(box.height-block)/2;
  const text=(suffix,layout,y,bold)=>textPrimitive({id:stableId(nodeKey(key),suffix),role:'network-node-label',frame:{x:box.x+pad,y,width:box.width-pad*2,height:layout.height},text:layout.text,style:{fontFamily:t('font.body'),fontSize:t('type.body'),color:onFill,bold,align:'center',valign:'top',lineHeight:layout.lineHeight,wrap:false},data:{nodeId:key,part:bold?'heading':'body',textLayout:layout,dependencies:[nodeKey(key)]}});
  nodes.push(text('heading',m.heading,top,true));
  if(m.body)nodes.push(text('body',m.body,top+m.heading.height+g,false));
 }
 check(new Set(nodes.map(node=>node.id)).size===nodes.length,'generated semantic IDs collide');
 for(const node of nodes)check(node.frame.x>=frame.x-.1&&node.frame.y>=frame.y-.1&&node.frame.x+node.frame.width<=frame.x+frame.width+.1&&node.frame.y+node.frame.height<=frame.y+frame.height+.1,`${node.id} exceeds allocated frame`);
 return {nodes,height:frame.height,topology:{centerId:model.centerId,ringOrder:[...model.ringOrder],edges:model.edges.map(({id,from,to,direction,relation})=>({id,from,to,direction,relation}))}};
}
const neutralNodes=[{id:'coordinator',label:'(Insert coordinating role)',body:'(Insert distinct contribution)'},...['a','b','c','d'].map(key=>({id:key,label:`(Insert participant ${key.toUpperCase()})`,body:'(Insert distinct contribution)'}))];
const neutralSpokes=['a','b','c','d'].map(key=>({id:`coordinator-${key}`,from:'coordinator',to:key,direction:'bidirectional',relation:'coordinates-with'}));
export const RELATIONSHIP_NETWORK_VARIANTS=Object.freeze({
 'hub-ring':{preferredSize:{width:1160,height:430},props:{variant:'hub-ring',centerId:'coordinator',ringOrder:['a','b','c','d'],nodes:neutralNodes,edges:[...neutralSpokes,...['a','b','c','d'].map((key,i)=>({id:`perimeter-${key}`,from:key,to:['b','c','d','a'][i],direction:'bidirectional',relation:'coordinates-with'}))]}},
 'directed-spokes':{preferredSize:{width:1160,height:430},props:{variant:'directed-spokes',centerId:'coordinator',ringOrder:['a','b','c','d'],nodes:neutralNodes,edges:neutralSpokes.map(edge=>({...edge,direction:'forward',relation:'provides-to'}))}}
});

export function registerRelationshipNetwork(registry){
 registry.set('relationship-network',{
  id:'relationship-network',version:'1.0.0',category:'relationship',role:'relationship-network',
  tokens:[...RELATIONSHIP_NETWORK_TOKENS],preferredSize:{width:1160,height:430},
  sample:RELATIONSHIP_NETWORK_VARIANTS['hub-ring'].props,variants:RELATIONSHIP_NETWORK_VARIANTS,
  defaultVariant:'hub-ring',variantProp:'variant',resolveVariant:(props={})=>{const variant=props.variant??'hub-ring';check(Object.hasOwn(RELATIONSHIP_NETWORK_VARIANTS,variant),'unsupported variant');return variant;},
  guidance:{useWhen:'a bounded set of participants has source-supported reciprocal or directed coordination relationships',why:'exact node and edge IDs preserve connectivity without implying reporting authority or chronology',actionTitle:'state the coordination relationship or distinct participant contribution supported by the evidence'},
  render:relationshipNetwork
 });
 return registry;
}
