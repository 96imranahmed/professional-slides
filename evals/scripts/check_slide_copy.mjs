#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildCopyInventory,buildCopyPrompt,copyReviewSchema,copyHash,validateCopyReview,validateCopyReport,COPY_CHECK_VERSION} from '../../skills/professional-slides/runtime/copy-check.mjs';

const args=process.argv.slice(2), get=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const required=name=>{const v=get(name);if(!v || v.startsWith('--')) throw new Error(`Required ${name}`);return path.resolve(v);};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const reportPath=required('--report');
const model=get('--model') || 'gpt-5.6-luna';
let temp;
try {
  if (!['gpt-5.6-luna','gpt-5.6-terra'].includes(model)) throw new Error('Unsupported independent reviewer');
  const paths={pptx:required('--pptx'),scene:required('--scene'),contract:required('--contract'),checker:path.join(root,'skills/professional-slides/runtime/copy-check.mjs'),runner:fileURLToPath(import.meta.url)};
  async function readInputs(){return Object.fromEntries(await Promise.all(Object.entries(paths).map(async([k,p])=>[k,copyHash(await fs.readFile(p))])));}
  const scene=JSON.parse(await fs.readFile(paths.scene,'utf8')),contract=JSON.parse(await fs.readFile(paths.contract,'utf8'));
  const inventory=buildCopyInventory(scene,contract);
  // Optional subset is diagnostic; its report cannot pass an all-slide check.
  const selected=get('--slides')?.split(',').map(Number);
  if(selected){if(selected.some(n=>!inventory.slides.some(s=>s.slide===n)))throw new Error('Unknown slide');inventory.slides=inventory.slides.filter(s=>selected.includes(s.slide));}
  const renderDir=required('--render-dir');
  for(const slide of inventory.slides) paths[`render${slide.slide}`]=path.join(renderDir,`slide-${slide.slide}.png`);
  const inputs=await readInputs();
  inputs.inventory=copyHash(inventory);
  if(args.includes('--check')) {
    const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
    const errors=validateCopyReport(inventory,inputs,report);
    if(errors.length)throw new Error(errors.join('\n'));
    console.log(JSON.stringify({accepted:true,targets:report.judgement.items.length}));
  } else {
    temp=await fs.mkdtemp(path.join(os.tmpdir(),'slides-copy-'));
    const items=[];
    // Bounded batches preserve full slide context while keeping coverage auditable.
    for(let i=0;i<inventory.slides.length;i+=4){
      const batch={...inventory,slides:inventory.slides.slice(i,i+4)},targets=batch.slides.flatMap(s=>s.targets);
      if(!targets.length)continue;
      const schema=path.join(temp,`schema-${i}.json`),output=path.join(temp,`review-${i}.json`);
      await fs.writeFile(schema,JSON.stringify(copyReviewSchema(targets)));
      await new Promise((resolve,reject)=>{
        const child=spawn('codex',['exec','--model',model,'-c','model_reasoning_effort="high"','--sandbox','read-only','--ephemeral','--ignore-user-config','--ignore-rules','--skip-git-repo-check','--output-schema',schema,'--output-last-message',output,'--cd',temp,...batch.slides.flatMap(s=>['--image',paths[`render${s.slide}`]]),'-'],{stdio:['pipe','ignore','pipe']});
        let detail='';child.stderr.on('data',d=>{detail=(detail+d).slice(-3000);});
        const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Copy reviewer timed out'));},600000);
        child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`Copy reviewer failed (${code}): ${detail}`));});
        child.stdin.end(buildCopyPrompt(batch));
      });
      const answer=JSON.parse(await fs.readFile(output,'utf8'));
      if(!Array.isArray(answer.items))throw new Error('Malformed copy review');
      items.push(...answer.items);
      console.error(`Reviewed slides ${batch.slides.map(s=>s.slide).join(',')}`);
    }
    if(JSON.stringify(await readInputs())!==JSON.stringify(Object.fromEntries(Object.entries(inputs).filter(([k])=>k!=='inventory'))))throw new Error('Inputs changed during review');
    const judgement={items},errors=validateCopyReview(inventory,judgement);
    const report={version:COPY_CHECK_VERSION,model,inputs,accepted:errors.length===0,validationErrors:errors,judgement};
    await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({accepted:report.accepted,targets:items.length,errors}));
    if(errors.length)process.exitCode=1;
  }
} catch(error){
  console.error(error.message);process.exitCode=2;
  // Never leave an old accepted report after a failed fresh query.
  if(!args.includes('--check')){await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify({version:COPY_CHECK_VERSION,accepted:false,error:error.message})+'\n');}
} finally {if(temp)await fs.rm(temp,{recursive:true,force:true});}
