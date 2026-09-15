import {planDeck} from './planner.mjs';
// Recipes consume supplied content and preserve relationships; no generated facts.
export const RECIPES=Object.freeze([
  {id:'paired-evidence',questions:['comparison','trade-off'],density:['executive','pre-read'],description:'Linked exhibits with optional integrated or detached synthesis.'},
  {id:'evidence-explanation',questions:['drivers','interpretation','recommendation'],density:['executive','pre-read'],description:'Evidence and developed explanatory prose.'},
  {id:'trend-drivers',questions:['trend','drivers'],density:['pre-read'],description:'Trend above aligned driver evidence.'},
  {id:'decision-economics',questions:['recommendation','sensitivity'],density:['pre-read','appendix'],description:'Decision terms above sensitivity evidence and conditions.'},
  {id:'label-prose',questions:['synthesis','diagnosis'],density:['pre-read'],description:'Ordered category and developed prose rows.'},
  {id:'parallel-domains',questions:['synthesis','comparison'],density:['pre-read'],description:'Independent domains in parallel columns.'},
  {id:'claim-proof',questions:['synthesis','explanation'],density:['executive','pre-read'],description:'Developed paragraphs with inline claim/proof emphasis.'},
  {id:'evidence-matrix',questions:['diagnosis','options'],density:['pre-read'],description:'One existing qualitative or quantitative matrix as the synthesis.'}
]);
export function retrieveRecipes({question,density='pre-read'}){return RECIPES.map(r=>({...r,score:(r.questions.includes(question)?2:0)+(r.density.includes(density)?1:0)})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));}
function optionalClose(items,insight){return insight?.trim()?[...items,{id:'synthesis',job:'Connect evidence to its consequence',component:'insight',props:{text:insight}}]:items;}
export function composeRecipe(id,{exhibits=[],explanation,insight,groups=[],weight=1}){
  if(!RECIPES.some(r=>r.id===id))throw new Error('Unknown recipe');
  if(id==='label-prose'||id==='parallel-domains'||id==='claim-proof'){
    if(!groups.length||groups.some(g=>!g.id||!g.text?.trim()))throw new Error('Source composition requires complete supplied groups');
    if(id==='label-prose'&&groups.some(g=>!g.label?.trim()))throw new Error('Label/prose rows require a distinct supplied label');
    const blocks=groups.map(g=>id==='label-prose'?{id:g.id,job:'Keep category beside its explanation',layout:'flow.row',items:[{id:g.id+'-label',job:'Identify the category',component:'paragraph',weight:1,props:{text:g.label||g.text}},{id:g.id+'-proof',job:'Develop the category evidence',component:'paragraph',weight:3,props:{text:g.text}}]}:{id:g.id,job:'Develop the supplied claim and proof',component:'paragraph',props:{text:g.text,...(g.runs?{runs:g.runs}:{})}});
    return {layout:id==='parallel-domains'?'flow.row':'flow.column',items:optionalClose(blocks,insight)};
  }
  if(!Array.isArray(exhibits)||!exhibits.length)throw new Error('Recipe requires actual supplied exhibits');
  if(id==='evidence-matrix'){if(exhibits.length!==1)throw new Error('Matrix recipe requires one complete exhibit');return {layout:'flow.column',items:optionalClose(exhibits,insight)};}
  if(id==='evidence-explanation'){
    if(exhibits.length!==1||!explanation?.trim()||!(weight>0))throw new Error('Evidence explanation requires one exhibit and developed prose');
    return {layout:'flow.row',items:[{...exhibits[0],weight},{id:'interpretation',job:'Explain the evidence and its consequence',component:'paragraph',props:{text:explanation,semantic:{kind:'explanation',relatedTo:[exhibits[0].id]}},weight:1}]};
  }
  if(exhibits.length!==2)throw new Error('Composite recipe requires two supplied exhibits');
  if(id==='paired-evidence')return {layout:'flow.column',items:optionalClose([{id:'evidence-pair',job:'Compare linked evidence',layout:'flow.row',items:exhibits,size:{width:'fill',height:'fill'}}],insight)};
  if(id==='trend-drivers')return {layout:'flow.column',items:optionalClose(exhibits.map((e,i)=>({...e,weight:i?1:2})),insight)};
  return {layout:'flow.column',items:optionalClose(exhibits.map((e,i)=>({...e,size:{width:'fill',height:i?'fill':'hug'}})),insight)};
}
/** Compile a bounded candidate set at the requested type size; return proposals, not silent plan edits. */
export function selectComposition({slide,deckContext={},candidates,maxCandidates=6}){
  if(!Array.isArray(candidates)||!candidates.length||candidates.length>maxCandidates||maxCandidates>6)throw new Error('Supply one to six bounded compositions');
  const results=candidates.map((candidate,index)=>{try{
    const plan={...slide,...candidate.composition};const {deck}=planDeck({...deckContext,id:'composition-probe',slides:[plan]});
    const page=deck.slides[0],text=page.nodes.filter(n=>n.type==='text'&&!/source|footnote|page-number/.test(n.role||''));
    const smallest=Math.min(...text.map(n=>n.style.fontSize?.value||n.style.fontSize||0));
    const occupied=page.componentInstances.filter(c=>c.id!=='chrome').reduce((n,c)=>n+c.frame.width*c.frame.height,0);
    const score=smallest*10-Math.abs(1-Math.min(1,occupied/(page.contentFrame.width*page.contentFrame.height)))*10-page.componentInstances.length*.1;
    return {id:candidate.id||String(index),accepted:true,score,composition:candidate.composition,metrics:{smallestTextPt:smallest,components:page.componentInstances.length}};
  }catch(error){return {id:candidate.id||String(index),accepted:false,error:error.message};}});
  const ranked=results.filter(r=>r.accepted).sort((a,b)=>b.score-a.score);return {selected:ranked[0]||null,candidates:results,applied:false};
}
export function evidenceExplanationCandidates(input){return [1,2,.5].map(weight=>({id:`evidence-prose-${weight}`,composition:composeRecipe('evidence-explanation',{...input,weight})}));}
