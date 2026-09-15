import {assertDesignContracts} from './outcome-contract.mjs';
import {validateEvidence,validateVisibleArguments,argumentProposals,validateNarrative} from './argument-contract.mjs';
import {assessArgument,digest,POLICY_VERSION} from './production-policy.mjs';

export const DECK_SPEC_SCHEMA='professional-slides.deck-spec/v1';
export function validateDeckSpec(spec) {
  if(![DECK_SPEC_SCHEMA,'professional-slides.deck-spec/v2'].includes(spec?.schema)||!spec.deckPlan?.id||!spec.deckPlan.slides?.length)throw new Error('Expected deck-spec/v1 with populated deckPlan');
  const ids=new Set();
  for(const slide of spec.deckPlan.slides){
    if(!slide.id||ids.has(slide.id))throw new Error('Slide IDs must be unique');ids.add(slide.id);
    const failures=assessArgument(slide).filter(f=>f.severity==='major');
    if(failures.length)throw new Error(`${slide.id}: ${failures.map(f=>f.observation).join('; ')}`);
    if(!['cover','tracker','navigation','reference'].includes(slide.kind)&&!slide.argument)throw new Error(`${slide.id}: argument inventory required`);
  }
  for(const slide of spec.deckPlan.slides)for(const id of slide.dependsOn||[])if(!ids.has(id)||id===slide.id)throw new Error(`${slide.id}: invalid dependency ${id}`);
  const sources=new Map((spec.evidence||[]).map(s=>[s.id,s]));
  if(sources.size!==(spec.evidence||[]).length)throw new Error('Duplicate evidence IDs');
  for(const e of sources.values())if(!e.id||!e.text||!e.source||!e.basis)throw new Error('Evidence requires id, text, source and basis');
  for(const slide of spec.deckPlan.slides)for(const id of slide.argument?.evidence||[])if(!sources.has(id))throw new Error(`${slide.id}: unknown evidence ${id}`);
  if(spec.schema.endsWith("/v2"))validateEvidence(spec);
  validateNarrative(spec);
  return spec;
}
export function deriveArtifacts(spec,deck,decisions) {
  validateDeckSpec(spec);
  validateVisibleArguments(spec,deck);
  assertDesignContracts(spec,deck);
  const {deckPlan}=spec;
  const colors=new Set(['000000','FFFFFF']),sizes=new Set(),fonts=new Set();
  for(const ts of [deck.tokens,...deck.slides.map(s=>s.tokens)])for(const [k,{value:v}] of Object.entries(ts)){
    if(k.startsWith('color.')&&typeof v==='string'&&/^#[\da-f]{6}$/i.test(v))colors.add(v.slice(1).toUpperCase());
    if(k.startsWith('type.')&&typeof v==='number'){sizes.add(v);sizes.add(v*.75);}
    if(k.startsWith('font.')&&typeof v==='string')fonts.add(v);
  }
  const contract={...spec.context,mainQuestion:spec.context?.mainQuestion||'',governingAnswer:spec.context?.governingAnswer||'',slides:deckPlan.slides.map((s,i)=>({...s,slide:i+1,pageType:s.kind||'analytical',communicationJob:s.argument?.question})),copyEvidence:structuredClone(spec.evidence||[]),specSha256:digest(spec)};
  const acceptance={schemaVersion:1,deck:{slideCount:deck.slides.length,slideSizeEmu:{width:12192000,height:6858000},titles:deckPlan.slides.map(s=>s.title.replace(/\s+/g,' ').trim()),requireTheme:true,requireSlideLayout:true,requireSlideMaster:true},copy:{enforceBudgets:false,forbiddenCharacters:['—'],maxTitleWords:14,maxWordsPerSlide:130,maxWordsPerTextShape:60,maxParagraphsPerTextShape:8,excludedShapeNamePatterns:['source','footnote','page-number'],slideOverrides:Object.fromEntries(deckPlan.slides.flatMap((s,i)=>s.copyBudget?[[String(i+1),{maxWordsPerSlide:s.copyBudget.maxWordsPerSlide}]]:[]))},theme:{allowedFonts:[...fonts],allowedColors:[...colors],allowedSchemeColors:['dk1','lt1','dk2','lt2','tx1','tx2','bg1','bg2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink','phClr'],allowedFontSizesPt:[...sizes],minimumFontSizePt:Math.min(...sizes),fontSizeTolerancePt:.05},roles:deck.slides.flatMap((s,i)=>s.nodes.filter(n=>n.type==="text").map(n=>({id:`${i+1}:${n.id}`,shapeNamePattern:"^ps:"+n.id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"$",slides:[i+1],requiredCountPerSlide:1,fontFamilies:[n.style.fontFamily?.value||n.style.fontFamily||"Arial"],fontSizesPt:[(n.style.fontSize?.value||n.style.fontSize)],fontSizeTolerancePt:.05})))};
  return {'argument-proposals.json':argumentProposals(spec),'contract.json':contract,'powerpoint-acceptance.json':acceptance,'theme-manifest.json':{palette:deck.palette,typography:deck.typography,tokens:deck.tokens,policy:POLICY_VERSION},'treatment-ledger.json':{slides:decisions},'story-plan.json':deckPlan,'preflight.json':{accepted:true,slides:decisions,specSha256:digest(spec)}};
}
