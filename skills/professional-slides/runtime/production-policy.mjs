import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const registry=JSON.parse(readFileSync(new URL('../references/evaluation/rules.json',import.meta.url),'utf8'));
export const POLICY_VERSION = 'production/'+registry.version+'/'+createHash('sha256').update(JSON.stringify(registry)).digest('hex');
export const POLICY = Object.freeze(registry.execution);
export const REVIEWER = Object.freeze(registry.reviewer);
export const MATERIAL_CODES = new Set(registry.materialCodes);
export function stableJson(value) {
  if(Array.isArray(value)) return '['+value.map(stableJson).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const digest = value => createHash('sha256').update(Buffer.isBuffer(value)?value:stableJson(value)).digest('hex');
export const blocksRelease = finding => ['major','blocker'].includes(finding?.severity) && MATERIAL_CODES.has(finding?.code);
export function repairDecision(findings, completedPasses=1) {
  const blockers=findings.filter(blocksRelease);
  return {action:!blockers.length?'settle':completedPasses<POLICY.reviewPasses?'repair':'report-material-defect', blockers, advisory:findings.filter(f=>!blocksRelease(f))};
}
export async function mapBounded(items, fn, concurrency=POLICY.concurrency) {
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8) throw new Error('Concurrency must be 1..8');
  const results=new Array(items.length);let next=0,failed=false;
  const workers=await Promise.allSettled(Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while(!failed && next<items.length){const i=next++;try{results[i]=await fn(items[i],i);}catch(e){failed=true;throw e;}}
  }));
  const failure=workers.find(r=>r.status==='rejected');if(failure)throw failure.reason;
  return results;
}
export function createTimingReport(mode='fresh-build') {
  const start=performance.now(),stages=[];
  return {async time(name,fn){const t=performance.now();try{return await fn();}finally{stages.push({name,ms:Math.round(performance.now()-t)});}},finish(extra={}){return {schema:'professional-slides.timings/v1',mode,stages,totalMs:Math.round(performance.now()-start),...extra};}};
}
// Cache every input that is actually supplied to the reviewer, including visual
// evidence and neighbouring arguments when the slide explicitly depends on them.
function localSlide(slide) {
  return {...slide,sourceEvidence:(slide.sourceEvidence||[]).map(({slides,...record})=>record)};
}
export function slideReviewKey(inventory,slide,imageHash,settings,dependencySlides=[]) {
  return digest({policy:POLICY_VERSION,packet:reviewPacket(inventory,[slide]),imageHash,settings,dependencySlides:dependencySlides.map(localSlide)});
}
export function reviewPacket(inventory,slides) {
  const navigation=slides.some(s=>['navigation','tracker','cover'].includes(s.pageKind));
  const ids=new Set(slides.flatMap(s=>(s.sourceEvidence||[]).map(e=>e.id)));
  return {version:inventory.version,originalBrief:inventory.originalBrief,authorRequirements:inventory.authorRequirements,
    question:inventory.question,outline:navigation?inventory.outline:undefined,
    researchRequirements:(inventory.researchRequirements||[]).filter(r=>r.evidence?.some(id=>ids.has(id))),
    slides:slides.map(localSlide)};
}
// Source bytes occur once per packet; each slide retains explicit source IDs.
export function deduplicateReviewEvidence(packet) {
  const sources=new Map();
  function pack(slide){const {sourceEvidence=[],...rest}=slide;
    for(const source of sourceEvidence){const {slides,...record}=source;const prior=sources.get(record.id);if(prior&&digest(prior)!==digest(record))throw new Error(`Conflicting review evidence ${record.id}`);sources.set(record.id,record);}
    return {...rest,sourceEvidenceIds:sourceEvidence.map(e=>e.id)};
  }
  const slides=packet.slides.map(pack),dependencyContext=packet.dependencyContext?.map(pack);
  return {...packet,slides,...(dependencyContext?{dependencyContext}:{}),evidenceCatalog:[...sources.values()]};
}
// One limiter is shared by local batches and whole-deck review.
export function createReviewLimiter(concurrency=POLICY.concurrency) {
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw new Error('Concurrency must be 1..8');
  let active=0;const queue=[];
  function drain(){while(active<concurrency&&queue.length){const {fn,resolve,reject}=queue.shift();active++;Promise.resolve().then(fn).then(resolve,reject).finally(()=>{active--;drain();});}}
  return fn=>new Promise((resolve,reject)=>{queue.push({fn,resolve,reject});drain();});
}
export function sceneVisibleWords(slide) {
  return (slide.nodes||[]).filter(n=>n.type==='text'&&!/source|footnote|page-number/.test(n.role||'')).reduce((sum,n)=>sum+String(n.text||'').trim().split(/\s+/).filter(Boolean).length,0);
}
export function assessArgument(slide) {
  if(['cover','tracker','navigation','reference'].includes(slide.kind))return [];
  const a=slide.argument;
  if(!a)return [{code:'ARGUMENT_UNDECLARED',severity:'minor',observation:'No structured question/evidence/interpretation inventory',repair:'Declare the analytical question and source-linked evidence before layout.'}];
  const missing=['question','answer','interpretation'].filter(k=>!a[k]?.trim());
  if(!Array.isArray(a.evidence)||!a.evidence.length)missing.push('evidence');
  if(missing.length)return [{code:'MISSING_ARGUMENT',severity:'major',observation:`Missing ${missing.join(', ')}`,repair:'Deepen from supplied evidence or merge with the related page.'}];
  if(a.disposition==='retain'&&!a.rationale?.trim())return [{code:'DENSITY_RATIONALE',severity:'minor',observation:'Deliberately simple page has no reason',repair:'Explain the narrative purpose or merge the page.'}];
  return [];
}

export function reviewBatches(records,{maxSlides=POLICY.batchSize,maxBytes=48000}={}) {
  if(!Number.isInteger(maxSlides)||maxSlides<1||maxSlides>8||!Number.isFinite(maxBytes)||maxBytes<1000)throw new Error('Invalid review batch budget');
  const batches=[];let batch=[],bytes=0;
  for(const r of records){const cost=Buffer.byteLength(JSON.stringify(r))+1200+(r.slide.objectCount||0)*40;if(batch.length&&(batch.length>=maxSlides||bytes+cost>maxBytes)){batches.push(batch);batch=[];bytes=0;}batch.push(r);bytes+=cost;}
  if(batch.length)batches.push(batch);return batches;
}
