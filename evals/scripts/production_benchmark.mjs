#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import {configureRuntime} from '../../skills/professional-slides/runtime/environment.mjs';
configureRuntime();
const [manifestPath,output]=process.argv.slice(2);if(!manifestPath||!output)throw new Error('Usage: production_benchmark.mjs manifest.json output-directory');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));await fs.mkdir(output,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),results=[],blindKey=[];
// Arms run frozen, supplied inputs. This measures runtime behavior, not independent author quality.
for(const item of manifest.cases){const bytes=await fs.readFile(item.input),input=JSON.parse(bytes);for(const arm of manifest.arms){const label=randomBytes(6).toString('hex'),root=path.resolve(arm.root),start=performance.now();let result;
  try{if(item.kind==='deck-plan'){const {planDeck}=await import(pathToFileURL(path.join(root,'skills/professional-slides/runtime/planner.mjs')));const planned=planDeck(input);result={accepted:true,slides:planned.deck.slides.length};}
  else{const {deliverDeck}=await import(pathToFileURL(path.join(root,'skills/professional-slides/runtime/deliver-deck.mjs')));result=await deliverDeck(path.resolve(item.input),path.resolve(output,label),manifest.options||{});}
  }catch(error){result={accepted:false,error:error.message};}
  results.push({id:label,case:item.id,inputSha256:hash(bytes),origin:item.origin||'supplied-input',mode:item.kind==='deck-plan'?'compile-regression':'delivery',totalMs:Math.round(performance.now()-start),...result});blindKey.push({id:label,arm:arm.id,root});
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify({runs:results,humanPreference:'not-measured',independentAuthorQuality:'not-measured'},null,2));await fs.writeFile(path.join(output,'private-arm-key.json'),JSON.stringify(blindKey,null,2));
}}
console.log(JSON.stringify({cases:manifest.cases.length,runs:results.length,failures:results.filter(r=>!r.accepted).length,output}));
