#!/usr/bin/env node
import fs from 'node:fs/promises';
import {configureRuntime} from './environment.mjs';
import path from 'node:path';
import {assertOutputDirectory} from './output-path.mjs';
import {fileURLToPath} from 'node:url';
import {createTimingReport,digest,repairDecision,POLICY,REVIEWER} from './production-policy.mjs';
import {runProcess} from './process.mjs';
const runtime=path.dirname(fileURLToPath(import.meta.url));
export async function deliverDeck(specPath,output,options={}){
  const {RUNTIME_PYTHON:python,RUNTIME_NODE:node}=configureRuntime();
  const {model=REVIEWER.defaultModel,reasoningEffort=REVIEWER.defaultReasoningEffort,batchSize=POLICY.batchSize,concurrency=POLICY.concurrency,batchBytes=48000,timeoutMs=POLICY.timeoutMs,fresh=false,materialDefect}=options;
  if(!REVIEWER.models.includes(model)||!REVIEWER.reasoningEfforts.includes(reasoningEffort)||!Number.isInteger(batchSize)||batchSize<1||batchSize>8||!Number.isInteger(concurrency)||concurrency<1||concurrency>8||!Number.isFinite(batchBytes)||batchBytes<1000||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('Invalid delivery settings');
  const timing=createTimingReport('delivery'),directory=await assertOutputDirectory(output);
  await fs.mkdir(directory,{recursive:true});
  // Only explicit, named run caches are cleared. Source inputs are never deleted.
  if(fresh)for(const name of ['.build-cache','.review-cache','repair-history.json'])await fs.rm(path.join(directory,name),{recursive:true,force:true});
  const reportPath=path.join(directory,'delivery.json'),historyPath=path.join(directory,'repair-history.json');
  let history;try{history=JSON.parse(await fs.readFile(historyPath,'utf8'));}catch{history={runs:[]};}
  await fs.writeFile(reportPath,JSON.stringify({accepted:false,status:'running'})+'\n');
  try{
    const build=await timing.time('build',async()=>{await runProcess(node,[path.join(runtime,'build-deck.mjs'),path.resolve(specPath),directory],{timeoutMs});return JSON.parse(await fs.readFile(path.join(directory,'build-result.json'),'utf8'));});
    const settings={model,reasoningEffort,batchSize,concurrency,batchBytes,timeoutMs};
    const specHash=digest(await fs.readFile(specPath));
    const unresolved=history.runs.at(-1);
    if(unresolved?.decision?.action==='report-material-defect'&&unresolved.specHash!==specHash&&!materialDefect)throw new Error('Repair budget exhausted; name the unresolved material defect with --material-defect before another changed candidate review');
    await timing.time('deterministic-checks',()=>Promise.all([
      runProcess(python,[path.join(runtime,'validate_pptx.py'),'hard',build.pptxPath,'--manifest',path.join(directory,'powerpoint-acceptance.json'),'--report',path.join(directory,'hard-review.json')],{timeoutMs}),
      runProcess(python,[path.join(runtime,'validate_pptx.py'),'provenance',build.pptxPath,'--receipt',path.join(directory,'canonical-generation-receipt.json'),'--generation-script',path.join(runtime,'build-deck.mjs'),'--require-planning','--report',path.join(directory,'provenance-review.json')],{timeoutMs})
    ]));
    let reviewError;
    try{await timing.time('coordinated-review',async()=>runProcess(node,[path.join(runtime,'review-deck.mjs'),'--pptx',build.pptxPath,'--receipt',path.join(directory,'canonical-generation-receipt.json'),'--scene',path.join(directory,'scene.json'),'--contract',path.join(directory,'contract.json'),'--render-dir',build.renderDirectory,'--report',path.join(directory,'review.json'),...Object.entries({'model':model,'reasoning-effort':reasoningEffort,'batch-size':batchSize,'concurrency':concurrency,'batch-bytes':batchBytes,'timeout-ms':timeoutMs}).flatMap(([k,v])=>['--'+k,String(v)])],{timeoutMs:timeoutMs*Math.max(1,Math.ceil(JSON.parse(await fs.readFile(path.join(directory,'scene.json'),'utf8')).slides.length/concurrency))*2}));}catch(e){reviewError=e;}
    const review=JSON.parse(await fs.readFile(path.join(directory,'review.json'),'utf8'));
    const passes=history.runs.filter(r=>r.modelCalls>0).length+(review.timings?.modelCalls>0?1:0);
    const decision=repairDecision([...(review.judgement?.items||[]),...(review.outcome?.findings||[])],passes);
    history.runs.push({specHash,settings,materialDefect:materialDefect||null,modelCalls:review.timings?.modelCalls||0,decision,accepted:review.accepted===true});
    await fs.writeFile(historyPath,JSON.stringify(history,null,2)+'\n');
    if(reviewError||!review.accepted)throw reviewError||new Error('Review rejected');
    const report={accepted:true,candidateSha256:digest(await fs.readFile(build.pptxPath)),reusedBuild:build.reusedBuild,timings:timing.finish(),review:'review.json',note:'Automated checks accepted; inspect montage before user delivery.'};
    await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');return report;
  }catch(error){await fs.writeFile(reportPath,JSON.stringify({accepted:false,error:error.message,timings:timing.finish()},null,2)+'\n');throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [spec,out,...args]=process.argv.slice(2),get=k=>{const i=args.indexOf('--'+k);return i<0?undefined:args[i+1];};if(!spec||!out)throw new Error('Usage: deliver-deck.mjs spec.json output-directory [--fresh] [--model name] [--reasoning-effort effort] [--batch-size n] [--concurrency n] [--timeout-ms n] [--material-defect reason]');
  const options={fresh:args.includes('--fresh'),materialDefect:get('material-defect')};for(const [flag,key] of [['model','model'],['reasoning-effort','reasoningEffort'],['batch-size','batchSize'],['concurrency','concurrency'],['batch-bytes','batchBytes'],['timeout-ms','timeoutMs']])if(get(flag)!==undefined)options[key]=['model','reasoningEffort'].includes(key)?get(flag):Number(get(flag));
  console.log(JSON.stringify(await deliverDeck(path.resolve(spec),path.resolve(out),options)));
}
