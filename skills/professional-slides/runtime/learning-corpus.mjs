#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from './production-policy.mjs';
export async function validateCorpus(manifest,base){
  const errors=[],ids=new Set(),splits=new Map();
  if(!Array.isArray(manifest?.examples)||!manifest.examples.length)return {accepted:false,errors:['No curated examples supplied']};
  for(const e of manifest.examples){
    if(!e.id||ids.has(e.id))errors.push('Missing or duplicate example ID');ids.add(e.id);
    if(!e.authorization?.trim()||!e.deckId||!['synthetic','human-approved'].includes(e.origin)||!['train','validation','test'].includes(e.split))errors.push(`${e.id}: missing authorization, origin, split or deck ID`);
    if(splits.has(e.deckId)&&splits.get(e.deckId)!==e.split)errors.push(`${e.id}: deck leaks across splits`);splits.set(e.deckId,e.split);
    if(e.origin==='human-approved'&&(!e.humanDecision?.reviewer||!e.humanDecision?.reason||e.humanDecision?.accepted!==true))errors.push(`${e.id}: missing human approval`);
    if(e.origin==='synthetic'&&e.humanDecision)errors.push(`${e.id}: synthetic fixture cannot impersonate human approval`);
    const artifacts=[e.brief,e.evidence,e.specification,...(e.renders||[])];
    if(!e.renders?.length)errors.push(`${e.id}: missing renders`);
    for(const a of artifacts){if(!a?.path||!a.sha256){errors.push(`${e.id}: missing artifact hash`);continue;}try{if(digest(await fs.readFile(path.resolve(base,a.path)))!==a.sha256)errors.push(`${e.id}: stale ${a.path}`);}catch{errors.push(`${e.id}: missing ${a.path}`);}}
  }
  return {accepted:!errors.length,examples:manifest.examples.length,errors};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const p=path.resolve(process.argv[2]),report=await validateCorpus(JSON.parse(await fs.readFile(p,'utf8')),path.dirname(p));console.log(JSON.stringify(report,null,2));if(!report.accepted)process.exitCode=1;}
