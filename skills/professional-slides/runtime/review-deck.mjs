#!/usr/bin/env node
import {outcomeSchema,outcomePrompt,validateOutcome} from './outcome-contract.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildCopyInventory,buildCopyPrompt,copyReviewSchema,copyHash,validateCopyReview,validateCopyReport,COPY_CHECK_VERSION,addPageReviewTargets,expandCompactReview} from './copy-check.mjs';

import {slideReviewKey,reviewPacket,mapBounded,createReviewLimiter,POLICY,REVIEWER,reviewBatches,createTimingReport} from './production-policy.mjs';
import {runProcess} from './process.mjs';
const timing=createTimingReport('review');
const args=process.argv.slice(2), get=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const required=name=>{const v=get(name);if(!v || v.startsWith('--')) throw new Error(`Required ${name}`);return path.resolve(v);};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const reportPath=required('--report');
const model=get('--model') || REVIEWER.defaultModel;
const reasoningEffort=get('--reasoning-effort') || REVIEWER.defaultReasoningEffort;
let temp;
try {
  if (!REVIEWER.models.includes(model)) throw new Error('Unsupported independent reviewer');
  if (!REVIEWER.reasoningEfforts.includes(reasoningEffort)) throw new Error('Unsupported reasoning effort');
  const paths={outcomeChecker:path.join(root,'skills/professional-slides/runtime/outcome-contract.mjs'),policy:path.join(root,'skills/professional-slides/references/evaluation/rules.json'),policyImplementation:path.join(root,'skills/professional-slides/runtime/production-policy.mjs'),pptx:required('--pptx'),scene:required('--scene'),contract:required('--contract'),checker:path.join(root,'skills/professional-slides/runtime/copy-check.mjs'),runner:fileURLToPath(import.meta.url)};
  async function readInputs(){return Object.fromEntries(await Promise.all(Object.entries(paths).map(async([k,p])=>[k,copyHash(await fs.readFile(p))])));}
  const [scene,contract]=await timing.time('input-read',async()=>Promise.all([paths.scene,paths.contract].map(async p=>JSON.parse(await fs.readFile(p,'utf8')))));
  let sourceEvidence=(contract.copyEvidence||[]).map(e=>({...e,slides:contract.slides.flatMap((s,i)=>s.argument?.evidence?.includes(e.id)?[i+1]:[])}));
  await timing.time('source-ingestion',async()=>{for(const e of sourceEvidence.filter(e=>e.kind==='source')){
    const sourcePath=path.resolve(path.dirname(paths.contract),e.provenance.path);
    const bytes=await fs.readFile(sourcePath);
    if(copyHash(bytes)!==e.provenance.sha256)throw new Error(`${e.id}: source extract hash mismatch`);
    e.sourceExtract=bytes.toString('utf8');
    paths[`evidence:${e.id}`]=sourcePath;
  }});
  if(contract.copySources!==undefined && !Array.isArray(contract.copySources))throw new Error('copySources must be an array');
  if(contract.copySources?.length){
    const reader=path.join(root,'skills/professional-slides/runtime/read_copy_sources.py');
    const bundled=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
    const python=process.env.RUNTIME_PYTHON || (existsSync(bundled)?bundled:'python3');
    const result=JSON.parse(execFileSync(python,[reader],{input:JSON.stringify({records:contract.copySources,base:path.dirname(paths.contract),slideCount:scene.slides.length}),encoding:'utf8',maxBuffer:16*1024*1024}));
    sourceEvidence.push(...result.sources);
    Object.assign(paths,result.paths,{sourceReader:reader});
  }
  const inventory=addPageReviewTargets(buildCopyInventory(scene,contract,sourceEvidence));
  inventory.slides.forEach((s,i)=>{s.objectCount=scene.slides[i].nodes.length;});
  const allSlides=[...inventory.slides];
  // Optional subset is diagnostic; its report cannot pass an all-slide check.
  const selected=get('--slides')?.split(',').map(Number);
  if(selected){if(selected.some(n=>!inventory.slides.some(s=>s.slide===n)))throw new Error('Unknown slide');inventory.slides=inventory.slides.filter(s=>selected.includes(s.slide));}
  const renderDir=required('--render-dir');
  for(const slide of allSlides) paths[`render${slide.slide}`]=path.join(renderDir,`slide-${slide.slide}.png`);
  const receiptPath=get('--receipt');
  if(receiptPath)paths.receipt=path.resolve(receiptPath);
  const montagePath=path.join(path.dirname(paths.scene),'montage.png');
  if(existsSync(montagePath))paths.montage=montagePath;
  const inputs=await timing.time('input-hashing',readInputs);
  if(receiptPath){
    const receipt=JSON.parse(await fs.readFile(paths.receipt,'utf8'));
    if(receipt.candidate?.sha256!==inputs.pptx || !Array.isArray(receipt.renders))throw new Error('Receipt does not bind candidate and renders');
    for(const slide of inventory.slides)if(receipt.renders.find(r=>r.slide===slide.slide)?.sha256!==inputs[`render${slide.slide}`])throw new Error('Render does not match canonical candidate');
  }
  if(sourceEvidence.some(record=>record.source?.sha256 && inputs[record.id]!==record.source.sha256))throw new Error('Copy source changed during extraction');
  inputs.inventory=copyHash(inventory);
  if(args.includes('--check')) {
    const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
    const errors=validateCopyReport(inventory,inputs,report);
    if(!selected)errors.push(...validateOutcome(report.outcome,allSlides.map(s=>s.id)));
    if(report.model!==model || (report.reasoningEffort || 'high')!==reasoningEffort) errors.push('Cached copy reviewer settings do not match the requested model and reasoning effort');
    if(errors.length)throw new Error(errors.join('\n'));
    console.log(JSON.stringify({accepted:true,targets:report.judgement.items.length}));
  } else {
    temp=await fs.mkdtemp(path.join(os.tmpdir(),'slides-copy-'));
    const cacheDir=path.resolve(get('--cache-dir') || path.join(path.dirname(reportPath),'.review-cache'));
    await fs.mkdir(cacheDir,{recursive:true});
    const settings={model,reasoningEffort,checker:inputs.checker,runner:inputs.runner};
    const entries=new Map();let cacheHits=0,modelCalls=0;
    const pending=[];const packetStats=[];const limit=createReviewLimiter(Number(get('--concurrency')||POLICY.concurrency));
    for(const slide of inventory.slides) {
      const dependencySlides=(slide.dependencies||[]).map(id=>{const peer=allSlides.find(s=>s.id===id);if(!peer)throw new Error(`Unknown review dependency ${id}`);return {...peer,renderHash:inputs[`render${peer.slide}`]};});
      const key=slideReviewKey(inventory,slide,inputs[`render${slide.slide}`],settings,dependencySlides);
      let cached;try{cached=JSON.parse(await fs.readFile(path.join(cacheDir,key+'.json'),'utf8'));}catch{}
      const packet=reviewPacket(inventory,[slide]);
      if(cached?.key===key && validateCopyReview(packet,{items:cached.items}).every(e=>e.startsWith('MATERIAL '))){entries.set(slide.id,{key,items:cached.items});cacheHits++;}
      else pending.push({slide,key,dependencySlides});
    }
    const size=Number(get('--batch-size')||POLICY.batchSize);
    if(!Number.isInteger(size)||size<1||size>8)throw new Error('Batch size must be 1..8');
    const batches=reviewBatches(pending,{maxSlides:size,maxBytes:Number(get('--batch-bytes')||48000)});
    const localReview=()=>timing.time('local-review',()=>mapBounded(batches,(records,i)=>limit(async()=>{
      const batch=reviewPacket(inventory,records.map(r=>r.slide));
      batch.dependencyContext=[...new Map(records.flatMap(r=>r.dependencySlides).map(s=>[s.id,s])).values()];
      const targets=batch.slides.flatMap(s=>s.targets);
      if(!targets.length){for(const record of records)entries.set(record.slide.id,{key:record.key,items:[]});return;}
      const schema=path.join(temp,`schema-${i}.json`),output=path.join(temp,`review-${i}.json`);
      await fs.writeFile(schema,JSON.stringify(copyReviewSchema(targets,batch.slides.flatMap(s=>[...s.context,...s.sourceEvidence].map(t=>t.id)),{compact:true,evidenceByTarget:Object.fromEntries(batch.slides.flatMap(s=>s.targets.map(t=>[t.id,[...s.context,...s.sourceEvidence].map(e=>e.id)])))})));
      const imageSlides=[...new Map([...batch.slides,...batch.dependencyContext].map(s=>[s.id,s])).values()];
      batch.imageOrder=imageSlides.map(s=>({id:s.id,slide:s.slide}));
      let validationErrors=[],reviewEntries;
      for(let attempt=0;attempt<2;attempt++){
        const prompt=await timing.time('packet-construction',async()=>buildCopyPrompt(batch)+(attempt?'\nThe previous response had invalid schema, coverage or evidence identifiers. Return a complete corrected review using only the supplied schema. Errors: '+validationErrors.join('; '):''));
        packetStats.push({slides:batch.slides.map(s=>s.id),bytes:Buffer.byteLength(prompt),attempt});modelCalls++;
        await timing.time(`local-batch-${i}-attempt-${attempt}`,()=>runProcess('codex',['exec','--model',model,'-c',`model_reasoning_effort="${reasoningEffort}"`,'--sandbox','read-only','--ephemeral','--ignore-user-config','--ignore-rules','--skip-git-repo-check','--output-schema',schema,'--output-last-message',output,'--cd',temp,...imageSlides.flatMap(s=>['--image',paths[`render${s.slide}`]]),'-'],{input:prompt,timeoutMs:Number(get('--timeout-ms')||POLICY.timeoutMs),retries:1,onRetry:()=>{modelCalls++;}}));
        try {
          const answer=JSON.parse(await fs.readFile(output,'utf8'));
          const expected=new Set(targets.map(t=>t.id));
          if(!answer.items||Array.isArray(answer.items)||typeof answer.items!=='object'||Object.keys(answer.items).some(id=>!expected.has(id))||targets.some(t=>!Object.hasOwn(answer.items,t.id)))throw new Error('Incomplete or malformed copy review');
          reviewEntries=records.map(record=>({key:record.key,slide:record.slide,items:record.slide.targets.map(t=>({...expandCompactReview(answer.items[t.id]),id:t.id,textHash:copyHash(t.text)}))}));
          validationErrors=reviewEntries.flatMap(entry=>validateCopyReview(reviewPacket(inventory,[entry.slide]),{items:entry.items})).filter(e=>!e.startsWith('MATERIAL '));
        }catch(e){validationErrors=[e.message];}
        if(!validationErrors.length)break;
      }
      if(validationErrors.length)throw new Error('REVIEW_RESPONSE_INVALID: '+validationErrors.join('; '));
      for(const {key,slide,items}of reviewEntries){const entry={key,items};entries.set(slide.id,entry);await fs.writeFile(path.join(cacheDir,key+'.json'),JSON.stringify(entry));}
      console.error(`Reviewed slides ${batch.slides.map(s=>s.slide).join(',')}`);
    }),Number(get('--concurrency')||POLICY.concurrency)));
    let outcome;
    const globalReview=()=>timing.time('whole-deck-review',()=>limit(async()=>{if(!selected){
      const outcomeKey=copyHash({inputs,settings,allSlides});
      const outcomeCache=path.join(cacheDir,`outcome-${outcomeKey}.json`);
      let saved;try{saved=JSON.parse(await fs.readFile(outcomeCache,'utf8'));}catch{}
      if(saved?.key===outcomeKey&&validateOutcome(saved.result,allSlides.map(s=>s.id)).every(e=>e.startsWith('MATERIAL '))){outcome=saved.result;cacheHits++;}
      else{
        const schema=path.join(temp,'outcome-schema.json'),output=path.join(temp,'outcome.json');
        await fs.writeFile(schema,JSON.stringify(outcomeSchema));
        let responseError;
        for(let attempt=1;attempt<=2;attempt++){
          const prompt=await timing.time('packet-construction',async()=>outcomePrompt({...inventory,slides:allSlides})+(responseError?`\nThe previous response was malformed: ${responseError}. Return a complete corrected response using only permitted IDs.`:''));
          packetStats.push({kind:'whole-deck',attempt,bytes:Buffer.byteLength(prompt)});modelCalls++;
          await timing.time(`whole-deck-attempt-${attempt}`,()=>runProcess('codex',['exec','--model',model,'-c',`model_reasoning_effort="${reasoningEffort}"`,'--sandbox','read-only','--ephemeral','--ignore-user-config','--ignore-rules','--skip-git-repo-check','--output-schema',schema,'--output-last-message',output,'--cd',temp,...(paths.montage?['--image',paths.montage]:[]),'-'],{input:prompt,timeoutMs:Number(get('--timeout-ms')||POLICY.timeoutMs),retries:1,onRetry:()=>{modelCalls++;}}));
          try{
            outcome=JSON.parse(await fs.readFile(output,'utf8'));
            const malformed=validateOutcome(outcome,allSlides.map(s=>s.id)).filter(e=>!e.startsWith('MATERIAL '));
            if(malformed.length)throw new Error(malformed.join('\n'));
            responseError=undefined;break;
          }catch(error){responseError=error.message;}
        }
        if(responseError)throw new Error(`REVIEW_RESPONSE_INVALID: ${responseError}`);
        await fs.writeFile(outcomeCache,JSON.stringify({key:outcomeKey,result:outcome}));
      }
    }}));
    const completed=await Promise.allSettled([globalReview(),localReview()]);
    const failed=completed.find(r=>r.status==='rejected');if(failed)throw failed.reason;
    const results=inventory.slides.map(s=>entries.get(s.id)?.items || []);
    const items=results.flatMap(r=>r || []);
    if(JSON.stringify(await readInputs())!==JSON.stringify(Object.fromEntries(Object.entries(inputs).filter(([k])=>k!=='inventory'))))throw new Error('Inputs changed during review');
    const judgement={items},errors=validateCopyReview(inventory,judgement);
    if(!selected)errors.push(...validateOutcome(outcome,allSlides.map(s=>s.id)));
    const report={version:COPY_CHECK_VERSION,model,reasoningEffort,inputs,outcome,accepted:errors.length===0,validationErrors:errors,judgement,slideEntries:Object.fromEntries(entries),timings:timing.finish({cacheHits,cacheMisses:pending.map(s=>s.slide.id),modelCalls,packetStats,slides:inventory.slides.length})};
    await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({accepted:report.accepted,targets:items.length,errors}));
    if(errors.length)process.exitCode=1;
  }
} catch(error){
  console.error(error.message);process.exitCode=2;
  // Never leave an old accepted report after a failed fresh query.
  if(!args.includes('--check')){await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify({version:COPY_CHECK_VERSION,accepted:false,error:error.message})+'\n');}
} finally {if(temp)await fs.rm(temp,{recursive:true,force:true});}
