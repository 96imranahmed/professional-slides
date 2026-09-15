/** Contracts bind author-supplied meaning to actual emitted objects, never inferred facts. */
const text=value=>typeof value==='string'&&value.trim();
export function validateEvidence(spec){
  for(const e of spec.evidence||[]){const b=e.basis;if(!b||typeof b!=='object'||!['unit','period','population','status'].every(k=>text(b[k])))throw new Error(`${e.id}: evidence basis requires unit, period, population, status`);if(!['observed','estimated','assumed','target','potential','qualitative'].includes(b.status))throw new Error(`${e.id}: invalid evidence status`);}
  const evidence=new Map((spec.evidence||[]).map(e=>[e.id,e]));
  for(const c of spec.comparisons||[]){if(!Array.isArray(c.evidence)||c.evidence.length<2)throw new Error('Comparison requires at least two evidence records');const records=c.evidence.map(id=>{if(!evidence.has(id))throw new Error(`Unknown comparison evidence ${id}`);return evidence.get(id);});const differences=['unit','period','population','status','grossNet','recurrence'].filter(k=>new Set(records.map(r=>r.basis[k]??null)).size>1);if(differences.length&&!text(c.qualification))throw new Error(`Incompatible comparison (${differences.join(', ')}): explicit qualification required`);}
}
const normalized=s=>String(s).replace(/\s+/g,' ').trim();
export function validateVisibleArguments(spec,deck){
  const strict=spec.schema.endsWith('/v2');
  for(const [i,plan] of spec.deckPlan.slides.entries()){
    const slide=deck.slides[i],instances=new Map(slide.componentInstances.map(c=>[c.id,c]));
    const nodesFor=id=>slide.nodes.filter(n=>n.id===id||n.data?.componentInstance===instances.get(id)?.instanceId||n.data?.componentAncestors?.includes(instances.get(id)?.instanceId));
    const bindings=plan.argument?.bindings||[];
    if(strict&&plan.argument&&!bindings.length)throw new Error(`${plan.id}: visible premise bindings required`);
    for(const binding of bindings){if(!text(binding.text)||!binding.visibleIds?.length||!binding.evidenceIds?.length)throw new Error(`${plan.id}: incomplete premise binding`);for(const id of binding.evidenceIds)if(!plan.argument.evidence.includes(id))throw new Error(`${plan.id}: binding references unmapped evidence ${id}`);const nodes=binding.visibleIds.flatMap(nodesFor);if(binding.visibleIds.some(id=>!nodesFor(id).length))throw new Error(`${plan.id}: bound visible object missing`);if(!normalized(nodes.filter(n=>n.type==='text').map(n=>n.text).join(' ')).includes(normalized(binding.text)))throw new Error(`${plan.id}: premise is not visible: ${binding.text}`);}
    for(const relation of plan.relationships||[]){
      if(!['parent-child','aligned-evidence','shared-axis'].includes(relation.kind))throw new Error('Unknown relationship kind');
      const ids=[relation.parent,...(relation.children||[])],records=ids.map(id=>instances.get(id));
      if(records.some(r=>!r)||records.length<2)throw new Error(`${plan.id}: unresolved relationship members`);
      if(relation.kind==='parent-child'&&relation.children.some(id=>!nodesFor(id).some(n=>n.data?.componentAncestors?.includes(records[0].instanceId))))throw new Error(`${plan.id}: lost parent-child containment`);
      if(relation.kind==='aligned-evidence'&&records.some(r=>Math.abs(r.frame.y-records[0].frame.y)>2))throw new Error(`${plan.id}: evidence row lost alignment`);
      if(relation.kind==='shared-axis'&&records.some(r=>Math.abs(r.frame.x-records[0].frame.x)>2||Math.abs(r.frame.width-records[0].frame.width)>2))throw new Error(`${plan.id}: shared comparison axis lost alignment`);
    }
  }
}
export function argumentProposals(spec){
  return spec.deckPlan.slides.filter(s=>s.argument).map(s=>{const a=s.argument,peer=spec.deckPlan.slides.find(p=>p.id!==s.id&&(p.argument?.question===a.question||(a.decisionConsequence&&p.argument?.decisionConsequence===a.decisionConsequence)));return {slide:s.id,action:a.disposition==='retain'?'retain':peer?'merge':'deepen',target:peer?.id||null,evidence:[...a.evidence],reason:a.disposition==='retain'?a.rationale||'Record why deliberate simplicity serves the page.':peer?'Shared question; review combined evidence before changing the approved plan.':'Check that bound premises explain the conclusion.',missingBindings:a.evidence.filter(id=>!(a.bindings||[]).some(b=>b.evidenceIds?.includes(id))),applied:false};});
}

/** Validate declared continuity without rejecting legacy specs that omit it. */
export function validateNarrative(spec) {
  const slides=spec.deckPlan.slides,positions=new Map(slides.map((s,i)=>[s.id,i]));
  for(const [i,s]of slides.entries()){
    const a=s.argument;if(!a)continue;
    if(['buildsOn','newContribution','decisionConsequence'].some(k=>a[k]!==undefined)){
      if(!Array.isArray(a.buildsOn)||new Set(a.buildsOn).size!==a.buildsOn.length||a.buildsOn.some(id=>!positions.has(id)||positions.get(id)>=i))throw new Error(`${s.id}: continuity must reference preceding slides`);
      if(!text(a.newContribution)||!text(a.decisionConsequence))throw new Error(`${s.id}: continuity needs new contribution and decision consequence`);
    }
  }
  const ids=new Set();
  for(const claim of spec.context?.claimLedger||[]){
    if(!text(claim.id)||ids.has(claim.id)||!text(claim.statement)||!positions.has(claim.proofSlide)||!Array.isArray(claim.summarySlides||[])||(claim.summarySlides||[]).some(id=>!positions.has(id)||id===claim.proofSlide))throw new Error('Invalid claim proof/summary ownership');
    ids.add(claim.id);
  }
}

/** One section map supplies all overview and selected-state tracker props. */
export function trackerStates(sectionMap,{trackerId='sections',layout='sequential-circles',mode='light'}={}) {
  if(!Array.isArray(sectionMap)||!sectionMap.length||new Set(sectionMap.map(s=>s.id)).size!==sectionMap.length||sectionMap.some(s=>!text(s.id)||!text(s.label)))throw new Error('Tracker section map needs unique IDs and labels');
  const items=sectionMap.map(({id,label})=>({id,label}));
  return {overview:{trackerId,items:structuredClone(items),layout,mode},sections:sectionMap.map(s=>({trackerId,items:structuredClone(items),selectedId:s.id,layout,mode}))};
}
