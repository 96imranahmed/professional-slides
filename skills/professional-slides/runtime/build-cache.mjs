import fs from 'node:fs/promises';
import path from 'node:path';
import {digest} from './production-policy.mjs';
export async function readCache(file){try{const {hash,value}=JSON.parse(await fs.readFile(file,'utf8'));return digest(value)===hash?value:null;}catch{return null;}}
export async function writeCache(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+`.${process.pid}.tmp`;await fs.writeFile(temp,JSON.stringify({hash:digest(value),value}));await fs.rename(temp,file);}
export async function inputFingerprint(spec,base,runtimeSha,{resourcesOnly=false}={}){
  const files={};
  async function walk(value){if(Array.isArray(value))return Promise.all(value.map(walk));if(value&&typeof value==='object')return Promise.all(Object.values(value).map(walk));if(typeof value!=='string'||value.length>2048)return;const p=path.resolve(base,value);try{const stat=await fs.stat(p);if(stat.isFile())files[p]=digest(await fs.readFile(p));}catch{}}
  await walk(spec);
  const fonts={};for(const dir of ['/System/Library/Fonts','/Library/Fonts',path.join(process.env.HOME||'', 'Library/Fonts')])try{for(const name of await fs.readdir(dir)){const stat=await fs.stat(path.join(dir,name));fonts[path.join(dir,name)]=[stat.size,stat.mtimeMs];}}catch{}
  return digest({spec:resourcesOnly?undefined:spec,files,fonts,runtimeSha,node:process.version,modules:process.env.RUNTIME_NODE_MODULES});
}
export async function artifactRecord(directory){
  const files={};
  async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||['build-result.json','delivery.json','repair-history.json','review.json','hard-review.json','provenance-review.json'].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else files[path.relative(directory,p)]=digest(await fs.readFile(p));}}
  await walk(directory);return files;
}
export async function verifyArtifacts(directory,files){if(!files||!Object.keys(files).length)return false;for(const [rel,hash] of Object.entries(files)){const p=path.resolve(directory,rel);if(!p.startsWith(path.resolve(directory)+path.sep))return false;try{if(digest(await fs.readFile(p))!==hash)return false;}catch{return false;}}return true;}
