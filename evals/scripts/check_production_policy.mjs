#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('skills/professional-slides');
const registryPath=path.join(root,'references/evaluation/rules.json');
const registry=JSON.parse(await fs.readFile(registryPath,'utf8'));
const ids=new Set(),errors=[];
for(const rule of registry.rules){
  if(!rule.id||ids.has(rule.id))errors.push('Duplicate or absent rule ID');ids.add(rule.id);
  for(const key of ['owner','rationale','positive','negative'])if(!rule[key]?.trim())errors.push(`${rule.id}: missing ${key}`);
  if(!['material','advisory'].includes(rule.severity))errors.push(`${rule.id}: invalid severity`);
  if(rule.owner)try{await fs.access(path.resolve(path.dirname(registryPath),rule.owner));}catch{errors.push(`${rule.id}: missing owner`);}
}
const owners=['SKILL.md','references/components/copy.md','references/components/insight-box.md','references/design/index.md','references/evaluation/index.md','runtime/copy-check.mjs','references/tools/production.md','references/tools/powerpoint/rendering.md'];
const contradictions=[/any non-keep blocks/i,/any failed item blocks/i,/any recap.*blocks release/i,/singular design goal is to avoid slide noise/i,/never add a recap/i,/never recap content/i];
for(const name of owners){const text=await fs.readFile(path.join(root,name),'utf8');for(const pattern of contradictions)if(pattern.test(text))errors.push(`${name}: superseded instruction ${pattern}`);}
// Schema, prompt and validator share the same runtime policy values.
const {copyReviewSchema,buildCopyPrompt}=await import('../../skills/professional-slides/runtime/copy-check.mjs');
const schema=copyReviewSchema([{id:'probe'}]).properties.items.properties.probe.properties;
if(JSON.stringify(schema.code.enum)!==JSON.stringify(['NONE','EDITORIAL',...registry.materialCodes]))errors.push('Review schema material codes drifted');
for(const code of registry.materialCodes)if(!buildCopyPrompt({slides:[]}).includes(code))errors.push(`Prompt missing material code ${code}`);
if(!registry.reviewer.models.includes(registry.reviewer.defaultModel)||!registry.reviewer.reasoningEfforts.includes(registry.reviewer.defaultReasoningEffort))errors.push('Reviewer default outside allowed options');
const guide=await fs.readFile(path.join(root,'references/evaluation/index.md'),'utf8');
if(/accepted per-slide visual report|accepted cross-slide consistency report|Major defects include.*generic copy/.test(guide))errors.push('Legacy production gates reintroduced');
console.log(JSON.stringify({accepted:!errors.length,rules:ids.size,owners:owners.length,errors}));
if(errors.length)process.exitCode=1;
