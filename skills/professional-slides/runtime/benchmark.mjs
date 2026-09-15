#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function summarizeRuns(records,budgets={}){
  if(!Array.isArray(records)||!records.length)throw new Error('Benchmark requires measured runs');
  const modes={};
  for(const r of records){if(!r.id||!['fresh-build','revision'].includes(r.mode)||!Number.isFinite(r.totalMs)||r.totalMs<0||typeof r.accepted!=='boolean')throw new Error('Invalid benchmark run');(modes[r.mode]??=[]).push(r);}
  const result={};
  for(const [mode,runs] of Object.entries(modes)){
    const times=runs.map(r=>r.totalMs).sort((a,b)=>a-b),percentile=p=>times[Math.max(0,Math.ceil(p*times.length)-1)];
    const labelled=runs.filter(r=>typeof r.humanMaterialDefect==='boolean'&&typeof r.reviewerMaterialDefect==='boolean');
    result[mode]={runs:runs.length,medianMs:percentile(.5),p95Ms:percentile(.95),qualityFailures:runs.filter(r=>!r.accepted).length,modelCalls:runs.reduce((n,r)=>n+(r.modelCalls||0),0),cacheHits:runs.reduce((n,r)=>n+(r.cacheHits||0),0),budgetMs:budgets[mode]??null,budgetStatus:budgets[mode]===undefined?'unconfigured':percentile(.95)<=budgets[mode]?'within':'exceeded',calibration:!labelled.length?'not-measured':{labelled:labelled.length,falsePositive:labelled.filter(r=>!r.humanMaterialDefect&&r.reviewerMaterialDefect).length,falseNegative:labelled.filter(r=>r.humanMaterialDefect&&!r.reviewerMaterialDefect).length}};
  }
  return {schema:'professional-slides.benchmark/v1',modes:result};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const input=JSON.parse(await fs.readFile(process.argv[2],'utf8'));console.log(JSON.stringify(summarizeRuns(input.runs,input.budgets),null,2));}

/** Only explicit, attributed human labels enter calibration. Missing labels stay missing. */
export function calibrateFindings(records){
  const categories={};
  for(const r of records){if(!r.id||!r.category||!r.humanReviewer||typeof r.humanMaterial!=='boolean'||typeof r.reviewerMaterial!=='boolean')throw new Error('Calibration requires attributed human labels');const c=categories[r.category]??={count:0,falsePositive:0,falseNegative:0,truePositive:0,trueNegative:0};c.count++;c[r.humanMaterial?(r.reviewerMaterial?'truePositive':'falseNegative'):(r.reviewerMaterial?'falsePositive':'trueNegative')]++;}
  for(const c of Object.values(categories)){c.precision=c.truePositive+c.falsePositive?c.truePositive/(c.truePositive+c.falsePositive):null;c.recall=c.truePositive+c.falseNegative?c.truePositive/(c.truePositive+c.falseNegative):null;}
  return {status:records.length?'measured':'not-measured',categories};
}
