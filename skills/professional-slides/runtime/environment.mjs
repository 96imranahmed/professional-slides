import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
/** Resolve once, before expensive work; caller-provided runtime paths win. */
export function configureRuntime({presentation=false}={}){
  const base=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies');
  const defaults={RUNTIME_NODE:path.join(base,'node/bin/node'),RUNTIME_NODE_MODULES:path.join(base,'node/node_modules'),RUNTIME_PYTHON:path.join(base,'python/bin/python3')};
  if(presentation&&!process.env.PRESENTATION_SKILL_DIR){
    const root=path.join(os.homedir(),'.codex/plugins/cache/openai-primary-runtime/presentations');
    const versions=fs.existsSync(root)?fs.readdirSync(root).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})):[];
    defaults.PRESENTATION_SKILL_DIR=versions.map(v=>path.join(root,v,'skills/presentations')).find(p=>fs.existsSync(path.join(p,'container_tools/render_slides.py')));
  }
  for(const [key,fallback] of Object.entries(defaults)){const value=process.env[key]||fallback;if(!value||!fs.existsSync(value))throw new Error(`${key} is unavailable; load workspace dependencies before building`);process.env[key]=value;}
  return Object.fromEntries(Object.keys(defaults).map(k=>[k,process.env[k]]));
}
