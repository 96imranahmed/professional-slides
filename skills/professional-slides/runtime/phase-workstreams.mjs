import { linePrimitive, rectPrimitive, stableId, textPrimitive, token, tokenValue } from './core.mjs';
import { measureText, measureTextRuns } from './text-layout.mjs';

export const PHASE_WORKSTREAM_TOKENS = Object.freeze(['font.body', 'type.heading', 'type.compact', 'color.ink', 'color.textSecondary', 'color.componentPrimary', 'color.componentPrimaryTint', 'color.surface', 'color.surfaceMuted', 'color.rule', 'space.1', 'space.2', 'space.3', 'line.hairline']);
export const PHASE_WORKSTREAM_VARIANTS = Object.freeze({
  'phase-workstreams': { preferredSize: { width: 1160, height: 480 }, props: {
    variant: 'phase-workstreams',
    phases: ['prepare', 'deliver'].map((id, i) => ({ id, label: `(Insert phase ${i + 1})`, period: '(Insert approximate period)', workstreams: ['design', 'engage'].map((key, j) => ({ id: `${id}-${key}`, label: `(Insert workstream ${j + 1})`, activities: [{ id: `${id}-${key}-activity`, text: '(Insert activity) and (insert supporting detail).', lead: '(Insert activity)' }] })), products: [{ id: `${id}-product`, label: '(Insert product)', workstreamId: `${id}-design`, owner: 'provider-a', children: [{ id: `${id}-child`, label: '(Insert nested product)', owner: 'provider-b' }] }] })),
    leadershipBands: [{ id: 'leadership', label: '(Insert leadership forum)', phaseIds: ['prepare', 'deliver'], items: [{ id: 'decision', text: '(Insert leadership decision)' }] }],
    recurringProducts: [{ id: 'recurring', label: '(Insert recurring product)', phaseIds: ['prepare', 'deliver'] }],
    owners: [{ id: 'provider-a', label: '(Insert provider A)' }, { id: 'provider-b', label: '(Insert provider B)' }]
  } }
});

const requiredText = (value, context) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Phase-workstreams ${context} requires text`);
  return value;
};
function normalize(props) {
  if (!Array.isArray(props.phases) || !props.phases.length) throw new Error('Phase-workstreams requires phases');
  const ids = new Set();
  const identify = (item, context) => {
    requiredText(item?.id, `${context} id`);
    if (ids.has(item.id)) throw new Error(`Duplicate phase-workstreams id: ${item.id}`);
    ids.add(item.id);
    return item;
  };
  const owners = props.owners ?? [];
  if (owners.length > 2) throw new Error('Phase-workstreams supports at most two explicitly keyed product providers');
  owners.forEach(o => { identify(o, 'owner'); requiredText(o.label, 'owner label'); });
  const phases = props.phases.map(phase => {
    identify(phase, 'phase'); requiredText(phase.label, 'phase label');
    if (phase.period !== undefined) requiredText(phase.period, 'phase period');
    if (!Array.isArray(phase.workstreams) || !phase.workstreams.length) throw new Error('Each phase requires workstreams');
    const workstreams = phase.workstreams.map(ws => {
      identify(ws, 'workstream'); requiredText(ws.label, 'workstream label');
      if (!Array.isArray(ws.activities)) throw new Error('Workstream requires an activities array');
      ws.activities.forEach(a => {
        identify(a, 'activity'); requiredText(a.text, 'activity');
        if (a.lead !== undefined && (typeof a.lead !== 'string' || !a.lead.trim() || !a.text.startsWith(a.lead) || a.lead !== a.lead.trim() || /\n/.test(a.lead) || (a.lead.length < a.text.length && /[\p{L}\p{N}]/u.test(a.text[a.lead.length]) && /[\p{L}\p{N}]/u.test(a.lead.at(-1))))) throw new Error(`Activity ${a.id} lead must be an exact complete-word text prefix`);
      });
      return ws;
    });
    const products = phase.products ?? [];
    function product(p, parent) {
      identify(p, 'product'); requiredText(p.label, 'product label');
      const owner = p.owner ?? parent?.owner;
      if (owner && !owners.some(o => o.id === owner)) throw new Error(`Unknown product provider: ${owner}`);
      const workstreamId = p.workstreamId ?? parent?.workstreamId;
      if (!workstreams.some(ws => ws.id === workstreamId)) throw new Error(`Product ${p.id} requires a workstream in phase ${phase.id}`);
      if (parent && workstreamId !== parent.workstreamId) throw new Error(`Nested product ${p.id} cannot change parent workstream`);
      if (p.additionalPlanned !== undefined && typeof p.additionalPlanned !== 'boolean') throw new Error('additionalPlanned must be boolean');
      return { ...p, owner, workstreamId, children: (p.children ?? []).map(c => product(c, { owner, workstreamId })) };
    }
    return { ...phase, workstreams, products: products.map(p => product(p)) };
  });
  const phaseIds = phases.map(p => p.id);
  function scoped(record, kind) {
    identify(record, kind); requiredText(record.label, `${kind} label`);
    if (!Array.isArray(record.phaseIds) || !record.phaseIds.length || new Set(record.phaseIds).size !== record.phaseIds.length || record.phaseIds.some(id => !phaseIds.includes(id))) throw new Error(`${kind} ${record.id} requires distinct visible phase IDs`);
    const indices = record.phaseIds.map(id => phaseIds.indexOf(id)).sort((a,b) => a-b);
    if (indices.at(-1) - indices[0] + 1 !== indices.length) throw new Error(`${kind} ${record.id} cannot span non-contiguous phases`);
    return { ...record, start: indices[0], end: indices.at(-1) };
  }
  const leadershipBands = (props.leadershipBands ?? []).map(b => {
    const band = scoped(b, 'leadership');
    if (!Array.isArray(b.items) || !b.items.length) throw new Error('Leadership band requires items');
    b.items.forEach(item => { identify(item, 'leadership item'); requiredText(item.text, 'leadership item'); });
    return band;
  });
  const recurringProducts = (props.recurringProducts ?? []).map(p => scoped(p, 'recurring product'));
  const qualifiers = props.qualifiers ?? [];
  qualifiers.forEach(q => { identify(q, 'qualifier'); requiredText(q.text, 'qualifier'); });
  const anyAdditional = p => p.additionalPlanned || p.children.some(anyAdditional);
  if (phases.some(p => p.products.some(anyAdditional)) && !qualifiers.some(q => q.appliesTo === 'additionalPlanned')) throw new Error('Additional planned products require an explicit qualifier');
  return { phases, owners, leadershipBands, recurringProducts, qualifiers };
}

/** Measure the complete hierarchy without shrinking type or discarding records. */
export function measurePhaseWorkstreams({ frame, props }) {
  if (!(frame?.width > 0) || (frame.height !== undefined && !(frame.height > 0))) throw new Error('Phase-workstreams requires a positive frame');
  const model = normalize(props);
  const pad = tokenValue('space.1'), gap = tokenValue('space.1'), inset = tokenValue('space.2');
  const itemGap = 0, productPad = 0, bulletWidth = tokenValue('space.3');
  const body = token('type.compact'), heading = token('type.heading');
  const measure = (text, width, bold = false, size = body) => measureText(text, width, { fontFamily: tokenValue('font.body'), fontSize: tokenValue(size), bold, wrapWidthRatio: 1 });
  const bulletLayout = measure('•', bulletWidth);
  const phaseWidth = frame.width / model.phases.length;
  const columns = [];
  model.phases.forEach((phase, pi) => {
    const weights = phase.workstreams.map(ws => props.workstreamWeights?.[ws.id] ?? 1);
    if (weights.some(w => !Number.isFinite(w) || w <= 0)) throw new Error('Workstream width weights must be positive');
    let x = pi * phaseWidth;
    phase.workstreams.forEach((ws, wi) => {
      const width = phaseWidth * weights[wi] / weights.reduce((a,b) => a+b, 0);
      columns.push({ phase, ws, x, width, innerWidth: width - 2 * inset }); x += width;
    });
  });
  const phaseLayouts = model.phases.map(p => measure([p.label, p.period].filter(Boolean).join(' · '), phaseWidth - 2 * inset, true, heading));
  const phaseHeight = Math.max(...phaseLayouts.map(m => m.height)) + 2 * pad;
  const workstreamHeight = Math.max(...columns.map(c => measure(c.ws.label, c.innerWidth, true).height)) + 2 * pad;
  const flatten = (products, depth = 0, parentId = null) => products.flatMap(p => [{ ...p, depth, parentId }, ...flatten(p.children, depth + 1, p.id)]);
  for (const c of columns) {
    c.heading = measure(c.ws.label, c.innerWidth, true);
    c.activities = c.ws.activities.map(a => ({ ...a, layout: a.lead === undefined ? measure(a.text, c.innerWidth - bulletWidth) : measureTextRuns([{text:a.lead,bold:true},{text:a.text.slice(a.lead.length),bold:false}], c.innerWidth - bulletWidth, {fontFamily:tokenValue('font.body'),fontSize:tokenValue(body),wrapWidthRatio:1}) }));
    c.products = flatten(c.phase.products.filter(p => p.workstreamId === c.ws.id)).map(p => ({ ...p, layout: measure(`${p.label}${p.additionalPlanned ? '*' : ''}`, c.innerWidth - p.depth * inset - 2 * productPad) }));
  }
  const stackHeight = entries => entries.reduce((h,a) => h + a.layout.height, 0) + Math.max(0, entries.length - 1) * itemGap;
  const activitiesHeight = Math.max(0, ...columns.map(c => stackHeight(c.activities))) + 2 * pad;
  // Leadership items share a scope band, not an implied assignment to a workstream or date.
  const leadership = model.leadershipBands.map(b => {
    const width = (b.end - b.start + 1) * phaseWidth;
    const labelLayout = measure(b.label, width - 2 * inset, true);
    const itemWidth = (width - 2 * inset - (b.items.length - 1) * inset) / b.items.length;
    const items = b.items.map(item => ({ ...item, layout: measure(item.text, itemWidth) }));
    return { ...b, x: b.start * phaseWidth, width, labelLayout, itemWidth, items, height: 2 * pad + labelLayout.height + gap + Math.max(...items.map(i => i.layout.height)) };
  });
  function packSpans(items) {
    const rows = [];
    for (const item of items) {
      let row = rows.find(r => r.items.every(other => item.end < other.start || item.start > other.end));
      if (!row) { row = { items: [], height: 0 }; rows.push(row); }
      row.items.push(item); row.height = Math.max(row.height, item.height);
    }
    let y = 0; for (const row of rows) { for (const item of row.items) item.y = y; y += row.height; }
    return y;
  }
  const leadershipHeight = packSpans(leadership);
  const legendText = ['Products', ...model.owners.map(o => o.label)];
  const legendWidths = legendText.map(t => measure(t, frame.width, true).width + 3 * inset);
  if (legendWidths.reduce((a,b) => a+b, 0) > frame.width) throw new Error('Product provider legend exceeds the phase-workstreams frame');
  const productsHeadingHeight = measure('Products', frame.width, true).height + 2 * pad;
  const productsHeight = Math.max(0, ...columns.map(c => c.products.reduce((h,p) => h + p.layout.height + 2 * productPad, 0) + Math.max(0,c.products.length-1)*itemGap)) + 2 * pad;
  // Co-scoped recurring products are peer labels across the complete parent span.
  const groups = new Map();
  for (const p of model.recurringProducts) {
    const key = `${p.start}:${p.end}`;
    if (!groups.has(key)) groups.set(key, { start: p.start, end: p.end, items: [] });
    groups.get(key).items.push(p);
  }
  const recurring = [...groups.values()].map(g => {
    const width = (g.end-g.start+1)*phaseWidth;
    const itemWidth = (width - 2*inset - (g.items.length-1)*inset)/g.items.length;
    const items = g.items.map(p => ({ ...p, layout: measure(p.label, itemWidth) }));
    return { ...g, x: g.start*phaseWidth, width, itemWidth, items, height: Math.max(...items.map(i=>i.layout.height))+2*pad };
  });
  const recurringHeight = packSpans(recurring);
  const qualifierLayouts = model.qualifiers.map(q => ({ ...q, layout: measure(q.text, frame.width - 2 * inset) }));
  const qualifiersHeight = qualifierLayouts.reduce((h,q) => h+q.layout.height+gap,0);
  const heights = { phase: phaseHeight, workstreams: workstreamHeight, activities: activitiesHeight, leadership: leadershipHeight, productsHeading: productsHeadingHeight, products: productsHeight, recurring: recurringHeight, qualifiers: qualifiersHeight };
  let requiredHeight = 0; const bands = {};
  for (const [name,height] of Object.entries(heights)) { bands[name] = { y: requiredHeight, height }; requiredHeight += height; }
  return { ...model, columns, phaseLayouts, phaseWidth, leadership, recurring, qualifierLayouts, legendWidths, bands, height: requiredHeight, requiredHeight, availableHeight: frame.height ?? null, fits: frame.height === undefined ? null : requiredHeight <= frame.height, bodyFontSize: tokenValue(body), headingFontSize: tokenValue(heading), pad, gap, inset, itemGap, productPad, bulletWidth, bulletLayout };
}

export function renderPhaseWorkstreams({ id, frame, props }) {
  if (!(frame?.height > 0)) throw new Error('Phase-workstreams render requires a positive frame height');
  const m = measurePhaseWorkstreams({ frame, props });
  if (!m.fits) throw new Error(`Phase-workstreams ${id} requires ${m.requiredHeight}px but has ${frame.height}px; enlarge the frame or revise the approved composition`);
  const nodes = [], nid = (...parts) => stableId(id, ...parts);
  const data = (record, dependencies = []) => ({ sourceId: record?.id, sourceText: record?.sourceText, phaseIds: record?.phaseIds, placementBasis: record?.placementBasis, sourceAwareBasis: record?.sourceAwareBasis, sourcePhaseIds: record?.sourcePhaseIds, dependencies });
  function text(key, role, textValue, x, y, width, layout, extra = {}, bold = false, size = 'type.compact') {
    nodes.push(textPrimitive({ id: nid(key), role, frame: { x: frame.x+x, y: frame.y+y, width, height: layout.height }, text: layout.text, ...(layout.runs ? {runs:layout.runs} : {}), style: { fontFamily: token('font.body'), fontSize: token(size), color: token('color.ink'), bold, lineHeight: layout.lineHeight, wrap: false, valign: 'top' }, data: { ...extra, originalText: textValue, textLayout: layout } }));
  }
  function surface(key, role, x,y,width,height,fill,extra) { nodes.push(rectPrimitive({ id: nid(key), role, frame: { x: frame.x+x,y:frame.y+y,width,height }, style: { fill: token(fill), stroke: 'none', ...(role === 'roadmap-provider-key' ? {stroke: token('color.rule'), lineWidth: token('line.hairline')} : {}) }, data: extra })); }
  for (const [pi,p] of m.phases.entries()) {
    const key = `phase-${p.id}`;
    surface(`${key}-surface`, 'roadmap-phase-surface', pi*m.phaseWidth, 0, m.phaseWidth, m.bands.phase.height, 'color.componentPrimaryTint', data(p,[nid(key)]));
    text(key,'roadmap-phase',[p.label,p.period].filter(Boolean).join(' · '),pi*m.phaseWidth+m.inset,m.pad,m.phaseWidth-2*m.inset,m.phaseLayouts[pi],data(p,[nid(`${key}-surface`)]),true,'type.heading');
  }
  for (const c of m.columns) {
    const wsKey = `workstream-${c.ws.id}`, phaseKey = nid(`phase-${c.phase.id}`);
    text(wsKey,'roadmap-workstream',c.ws.label,c.x+m.inset,m.bands.workstreams.y+m.pad,c.innerWidth,c.heading,{...data(c.ws,[phaseKey]),phaseId:c.phase.id},true);
    let y = m.bands.activities.y+m.pad;
    for(const a of c.activities) {
      text(`activity-bullet-${a.id}`,'roadmap-activity-bullet','•',c.x+m.inset,y,m.bulletWidth,m.bulletLayout,{activityId:a.id,dependencies:[nid(`activity-${a.id}`)]});
      text(`activity-${a.id}`,'roadmap-activity',a.text,c.x+m.inset+m.bulletWidth,y,c.innerWidth-m.bulletWidth,a.layout,{...data(a,[nid(wsKey)]),phaseId:c.phase.id,workstreamId:c.ws.id}); y+=a.layout.height+m.itemGap; }
    y=m.bands.products.y+m.pad;
    for(const p of c.products) {
      const x=c.x+m.inset+p.depth*m.inset, width=c.innerWidth-p.depth*m.inset;
      const ownerIndex=m.owners.findIndex(o=>o.id===p.owner), key=`product-${p.id}`;
      const dependencies=[nid(wsKey),nid(p.parentId ? `product-${p.parentId}` : 'products-heading'),...(p.owner?[nid(`provider-${p.owner}`)]:[]),...(p.additionalPlanned?m.qualifiers.filter(q=>q.appliesTo==='additionalPlanned').map(q=>nid(`qualifier-${q.id}`)):[])];
      const extra={...data(p,dependencies),phaseId:c.phase.id,workstreamId:p.workstreamId,provider:p.owner,parentProductId:p.parentId,additionalPlanned:p.additionalPlanned===true,ownerQualification:p.ownerQualification};
      surface(`${key}-surface`,'roadmap-product-surface',x,y,width,p.layout.height+2*m.productPad,ownerIndex===1?'color.surfaceMuted':'color.surface',{...extra,dependencies:[nid(key)]});
      text(key,'roadmap-product',p.label,x+m.productPad,y+m.productPad,width-2*m.productPad,p.layout,{...extra,dependencies:[...dependencies,nid(`${key}-surface`)]}); y+=p.layout.height+2*m.productPad+m.itemGap;
    }
  }
  for(const b of m.leadership) {
    const y=m.bands.leadership.y+b.y;
    const key=`leadership-${b.id}`, dependencies=b.phaseIds.map(pid=>nid(`phase-${pid}`));
    surface(`${key}-surface`,'roadmap-leadership-surface',b.x,y,b.width,b.height,'color.surfaceMuted',data(b,[nid(key)]));
    text(key,'roadmap-leadership-label',b.label,b.x+m.inset,y+m.pad,b.width-2*m.inset,b.labelLayout,data(b,dependencies),true);
    b.items.forEach((item,i)=>text(`leadership-item-${item.id}`,'roadmap-leadership-item',item.text,b.x+m.inset+i*(b.itemWidth+m.inset),y+m.pad+b.labelLayout.height+m.gap,b.itemWidth,item.layout,{...data(item,[nid(key)]),phaseIds:b.phaseIds,placementBasis:b.placementBasis}));
  }
  let legendX=m.inset;
  ['Products',...m.owners.map(o=>o.label)].forEach((label,i)=>{
    const key=i===0?'products-heading':`provider-${m.owners[i-1].id}`;
    const layout=measureText(label,m.legendWidths[i],{fontFamily:tokenValue('font.body'),fontSize:tokenValue('type.compact'),bold:true,wrapWidthRatio:1});
    if(i) surface(`${key}-swatch`,'roadmap-provider-key',legendX,m.bands.productsHeading.y+m.pad,m.inset,layout.height,i===2?'color.surfaceMuted':'color.surface',{dependencies:[nid(key)]});
    text(key,i?'roadmap-provider-label':'roadmap-products-label',label,legendX+(i?m.inset+m.pad:0),m.bands.productsHeading.y+m.pad,m.legendWidths[i]-(i?m.inset+m.pad:0),layout,i?data(m.owners[i-1]):{},true);
    legendX+=m.legendWidths[i];
  });
  for(const group of m.recurring) group.items.forEach((item,i)=>text(`recurring-${item.id}`,'roadmap-recurring-product',item.label,group.x+m.inset+i*(group.itemWidth+m.inset),m.bands.recurring.y+group.y+m.pad,group.itemWidth,item.layout,data(item,item.phaseIds.map(pid=>nid(`phase-${pid}`)))));
  let qy=m.bands.qualifiers.y;
  for(const q of m.qualifierLayouts) {text(`qualifier-${q.id}`,'roadmap-product-qualifier',q.text,m.inset,qy,frame.width-2*m.inset,q.layout,data(q)); qy+=q.layout.height+m.gap;}
  for (const name of ['activities','leadership','productsHeading','recurring']) if(m.bands[name].height) nodes.push(linePrimitive({id:nid('band-rule',name),role:'roadmap-band-rule',x1:frame.x,y1:frame.y+m.bands[name].y,x2:frame.x+frame.width,y2:frame.y+m.bands[name].y,style:{stroke:token('color.rule'),lineWidth:token('line.hairline')},data:{dependencies:nodes.filter(n=>n.type==='text').map(n=>n.id)}}));
  return { nodes };
}
