#!/usr/bin/env node
import {verifyResearchSources} from './outcome-contract.mjs';
import fs from 'node:fs/promises';
import {configureRuntime} from './environment.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDeckSpec,deriveArtifacts} from './deck-spec.mjs';
import {planDeck} from './planner.mjs';
import {writeCanonicalDeckPlan,canonicalRuntimeSourceState} from './generation.mjs';
import {assertOutputDirectory} from './output-path.mjs';
import {createTimingReport,digest} from './production-policy.mjs';
import {readCache,writeCache,inputFingerprint,artifactRecord,verifyArtifacts} from './build-cache.mjs';
import {runProcess} from './process.mjs';
const runtime=path.dirname(fileURLToPath(import.meta.url));
export async function buildDeck(specPath,outputDirectory,{preflight=false,timeoutMs=180000}={}) {
  const {RUNTIME_PYTHON:python}=configureRuntime();
  const timing=createTimingReport(preflight?'preflight':'fresh-build');
  const spec=validateDeckSpec(JSON.parse(await fs.readFile(specPath,'utf8')));
  await verifyResearchSources(spec,path.dirname(path.resolve(specPath)));
  const directory=await assertOutputDirectory(outputDirectory);await fs.mkdir(directory,{recursive:true});
  const runtimeSha=(await canonicalRuntimeSourceState()).sha256;
  const key=await inputFingerprint(spec,path.dirname(path.resolve(specPath)),runtimeSha);
  const environmentKey=await inputFingerprint(spec,path.dirname(path.resolve(specPath)),runtimeSha,{resourcesOnly:true});
  const cacheDir=path.join(directory,'.build-cache'),cachePath=path.join(cacheDir,'build.json');
  const previous=await readCache(cachePath);
  if(!preflight&&previous?.key===key&&await verifyArtifacts(directory,previous.files))return {...previous.result,reusedBuild:true,timings:timing.finish({buildCacheHits:1})};
  await timing.time('story-contract',()=>runProcess(python,['-c','import json,sys;sys.path.insert(0,sys.argv[1]);from validate_pptx import validate_production_story; errors=validate_production_story(json.load(sys.stdin));print("\\n".join(errors),file=sys.stderr);sys.exit(bool(errors))',runtime],{input:JSON.stringify(spec),timeoutMs}));
  let prepared=await readCache(path.join(cacheDir,key+'.json'));
  const preparedCacheHit=!!prepared;
  const slideRecord=await readCache(path.join(cacheDir,'slides.json'));
  const slideCache=new Map(slideRecord?.environmentKey===environmentKey?slideRecord.entries:[]);
  const oldKeys=new Set(slideCache.keys());
  if(!prepared)prepared={...await timing.time('plan-compile-preflight',async()=>planDeck(spec.deckPlan,undefined,{slideCache})),planHash:digest(spec.deckPlan),runtimeSha};
  if(prepared.planHash!==digest(spec.deckPlan)||prepared.runtimeSha!==runtimeSha)throw new Error('Stale prepared plan');
  const artifacts=deriveArtifacts(spec,prepared.deck,prepared.decisions);
  for(const e of artifacts['contract.json'].copyEvidence.filter(e=>e.kind==='source')){
    const bytes=await fs.readFile(path.resolve(path.dirname(path.resolve(specPath)),e.provenance.path));
    const relative=path.join('source-evidence',e.provenance.sha256+'.txt');
    await fs.mkdir(path.join(directory,'source-evidence'),{recursive:true});
    await fs.writeFile(path.join(directory,relative),bytes);
    e.provenance={...e.provenance,path:relative};
  }
  for(const [name,value] of Object.entries(artifacts))await fs.writeFile(path.join(directory,name),JSON.stringify(value,null,2)+'\n');
  await fs.writeFile(path.join(directory,'deck-spec.json'),JSON.stringify(spec,null,2)+'\n');
  await writeCache(path.join(cacheDir,key+'.json'),prepared);
  await writeCache(path.join(cacheDir,'slides.json'),{environmentKey,entries:[...slideCache].slice(-256)});
  let generated;
  if(!preflight)generated=await timing.time('generate',()=>writeCanonicalDeckPlan({deckPlan:spec.deckPlan,prepared,outputDirectory:directory,fileStem:spec.deckPlan.id,authoringScriptPath:fileURLToPath(import.meta.url)}));
  const timings=timing.finish({preparedCacheHit,compiledSlides:slideCache.size-oldKeys.size});
  await fs.writeFile(path.join(directory,'build-timings.json'),JSON.stringify(timings,null,2)+'\n');
  const result={status:preflight?'preflight-passed':'generated-needs-review',outputDirectory:directory,pptxPath:generated?.pptxPath,renderDirectory:generated?.renderDirectory,reusedBuild:false,timings};
  if(!preflight)await writeCache(cachePath,{key,result,files:await artifactRecord(directory)});
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);if(args.length<2)throw new Error('Usage: build-deck.mjs spec.json output-directory [--preflight]');
  const result=await buildDeck(path.resolve(args[0]),path.resolve(args[1]),{preflight:args.includes('--preflight')});
  await fs.writeFile(path.join(result.outputDirectory,'build-result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}
