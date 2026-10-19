import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { diagnose } from "../doctor.mjs";
import { readJson, writeJsonWhole, pythonBin } from "../cli.mjs";
import { runProcess } from "../process.mjs";
import { complete, blocked, packageRoot, runtime, digest, python } from "./workspace.mjs";

export async function checkEnvironment({probe=false,renderer="auto"}={}) {
  if(!["auto","powerpoint","libreoffice"].includes(renderer))throw new Error("renderer must be auto, powerpoint or libreoffice");
  const report=await diagnose({renderer});
  if(!report.ready)return blocked("ENVIRONMENT_NOT_READY","Install local PowerPoint or LibreOffice and Poppler, plus the missing Node/Python dependencies.",{environment:report});
  if(!process.env.RUNTIME_PYTHON)process.env.RUNTIME_PYTHON=report.python.chosen;
  if(probe){
    const tmp=await fs.mkdtemp(path.join(os.tmpdir(),"professional-slides-probe-"));
    try{
      const {buildDeck}=await import("../build-deck.mjs");
      const result=await buildDeck(null,tmp,{source:{spec:{schema:"professional-slides.deck/v3",id:"probe",contents:false,slides:[{id:"probe",kind:"statement",title:"Renderer check",text:"Local PowerPoint rendering works"}]},baseDir:tmp},python:pythonBin(),render:true});
      if(result.status!=="built")return blocked("RENDER_PROBE_FAILED","The installed Office application could not complete a rendered build.",{environment:report,probe:result});
    }catch(e){return blocked("RENDER_PROBE_FAILED",e.message,{environment:report});}
    finally{await fs.rm(tmp,{recursive:true,force:true});}
  }
  return complete({environment:report,probe:probe?"passed":"not-run"});
}

export async function setup({agent,scope="user",renderer="auto"}={}) {
  if(!["codex","claude","both"].includes(agent))throw new Error("setup requires --agent codex|claude|both");
  if(!["user","project"].includes(scope))throw new Error("scope must be user or project");
  const home=process.env.PROFESSIONAL_SLIDES_HOME||path.join(os.homedir(),".professional-slides");
  const base=scope==="project"?path.join(process.cwd(),".professional-slides"):home;
  const pkg=await readJson(path.join(packageRoot,"package.json"));
  const distribution=await readJson(path.join(packageRoot,"distribution.json"));
  const files=[];
  async function collect(relative){const full=path.join(packageRoot,relative),stat=await fs.stat(full);if(stat.isDirectory()){for(const e of await fs.readdir(full))if(!["__pycache__"].includes(e))await collect(path.join(relative,e));}else files.push(relative);}
  for(const rel of [...distribution.files,...distribution.roots])await collect(rel);
  const hash=digest(await Promise.all(files.sort().map(async f=>[f,digest(await fs.readFile(path.join(packageRoot,f)))])));
  const install=path.join(base,"installations",`${pkg.version}-${hash.slice(0,12)}`);
  await fs.mkdir(install,{recursive:true});
  for(const file of files){const target=path.join(install,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(packageRoot,file),target);}
  let report=await diagnose({renderer});
  // Prepare a task-owned venv rather than pip-installing into the system Python.
  const py=report.python.chosen||report.python.candidates.find(c=>c.version)?.command||"python3";
  const venv=path.join(base,"python"), executable=path.join(venv,process.platform==="win32"?"Scripts/python.exe":"bin/python");
  try{await fs.access(executable);}catch{await runProcess(py,["-m","venv","--system-site-packages",venv]);}
  const imports=await runProcess(executable,["-c","import pptx,lxml,PIL,numpy,pypdf"],{expect:[0,1]});
  if(imports.code)await runProcess(executable,["-m","pip","install","-r",path.join(install,"requirements.txt")]);
  process.env.RUNTIME_PYTHON=executable;
  process.env.PROFESSIONAL_SLIDES_RENDERER=renderer;
  const ready=await checkEnvironment({probe:true,renderer});
  if(ready.status!=="complete")return ready;
  await writeJsonWhole(path.join(install,"environment.json"),{python:executable,renderer});
  const agents=agent==="both"?["codex","claude"]:[agent], destinations=[];
  for(const name of agents){
    const target=path.join(scope==="user"?os.homedir():process.cwd(),name==="codex"?".agents/skills/professional-slides":".claude/skills/professional-slides");
    await fs.mkdir(path.dirname(target),{recursive:true});
    const previous=await fs.lstat(target).catch(e=>e.code==="ENOENT"?null:Promise.reject(e));
    if(previous){
      const real=await fs.realpath(target);
      if(real===path.join(install,"skills/professional-slides")){destinations.push(target);continue;}
      const relative=path.relative(path.join(base,"installations"),real);
      if(!previous.isSymbolicLink()||relative.startsWith("..")||path.isAbsolute(relative))return blocked("INSTALLATION_CONFLICT",`Existing skill at ${target} is not owned by this setup; preserve or remove it explicitly.`);
      await fs.unlink(target);
    }
    await fs.symlink(path.join(install,"skills/professional-slides"),target,process.platform==="win32"?"junction":"dir");
    destinations.push(target);
  }
  return complete({artifacts:destinations,installation:install,version:pkg.version,probe:"passed",message:"Invoke $professional-slides in Codex or /professional-slides in Claude Code. The skill runs its persistent bundled CLI; no global npm install is needed."});
}
