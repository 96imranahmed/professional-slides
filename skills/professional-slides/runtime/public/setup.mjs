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

/** Where setup keeps installations, the Python environment and environment.json: the CLI reads it from here too. */
export const setupHome = () => process.env.PROFESSIONAL_SLIDES_HOME || path.join(os.homedir(), ".professional-slides");

/** What a skill link already at `target` is: nothing, this setup's own link (to `install` or an older installation), or someone else's. */
export async function ownerOf(target, install, base) {
  const previous = await fs.lstat(target).catch((e) => (e.code === "ENOENT" ? null : Promise.reject(e)));
  if (!previous) return "free";
  if (!previous.isSymbolicLink()) return "foreign";
  // A link left by a deleted installation dangles: read where it points rather than resolving it.
  const pointed = path.resolve(path.dirname(target), await fs.readlink(target));
  const real = await fs.realpath(pointed).catch(() => pointed);
  const installations = path.join(await fs.realpath(base).catch(() => base), "installations");
  if (real === path.join(await fs.realpath(install).catch(() => install), "skills/professional-slides")) return "current";
  const relative = path.relative(installations, real);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? "ours" : "foreign";
}

export async function setup({agent,scope="user",renderer="auto"}={}) {
  if(!["codex","claude","both"].includes(agent))throw new Error("setup requires --agent codex|claude|both");
  if(!["user","project"].includes(scope))throw new Error("scope must be user or project");
  const base=scope==="project"?path.join(process.cwd(),".professional-slides"):setupHome();
  const pkg=await readJson(path.join(packageRoot,"package.json"));
  const distribution=await readJson(path.join(packageRoot,"distribution.json"));
  const files=[];
  async function collect(relative){const full=path.join(packageRoot,relative),stat=await fs.stat(full);if(stat.isDirectory()){for(const e of await fs.readdir(full))if(!["__pycache__"].includes(e))await collect(path.join(relative,e));}else files.push(relative);}
  for(const rel of [...distribution.files,...distribution.roots])await collect(rel);
  const hash=digest(await Promise.all(files.sort().map(async f=>[f,digest(await fs.readFile(path.join(packageRoot,f)))])));
  const install=path.join(base,"installations",`${pkg.version}-${hash.slice(0,12)}`);
  // Every agent's skill folder is checked before anything is copied, installed or rendered: a skill this setup does not
  // own is refused up front, and no agent is linked when another is refused.
  const agents=agent==="both"?["codex","claude"]:[agent];
  const targets=agents.map(name=>path.join(scope==="user"?os.homedir():process.cwd(),name==="codex"?".agents/skills/professional-slides":".claude/skills/professional-slides"));
  const owners=await Promise.all(targets.map(target=>ownerOf(target,install,base)));
  const foreign=targets.filter((_,i)=>owners[i]==="foreign");
  if(foreign.length)return blocked("INSTALLATION_CONFLICT",`Existing skill at ${foreign.join(" and ")} is not owned by this setup; preserve or remove it explicitly.`);
  await fs.mkdir(install,{recursive:true});
  for(const file of files){const target=path.join(install,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(packageRoot,file),target);}
  const report=await diagnose({renderer});
  // An environment of the skill's own, not the system Python's: pip brings it to requirements.txt on every setup, so a
  // requirement added later is installed, and a run that finds them met changes nothing.
  const py=report.python.chosen||report.python.candidates.find(c=>c.version)?.command||"python3";
  const venv=path.join(base,"python"), executable=path.join(venv,process.platform==="win32"?"Scripts/python.exe":"bin/python");
  try{await fs.access(executable);}catch{
    const made=await runProcess(py,["-m","venv",venv],{expect:[0,1]});
    if(made.code)return blocked("PYTHON_VENV_FAILED",`${py} could not create a virtual environment${process.platform==="linux"?" (on Debian or Ubuntu, install python3-venv)":""}: ${made.stderr||made.stdout}`);
  }
  await runProcess(executable,["-m","pip","install","--quiet","-r",path.join(install,"requirements.txt")]);
  process.env.RUNTIME_PYTHON=executable;
  process.env.PROFESSIONAL_SLIDES_RENDERER=renderer;
  const ready=await checkEnvironment({probe:true,renderer});
  if(ready.status!=="complete")return ready;
  // The installed skill reads its own copy; `npx professional-slides` from the package reads the one in the setup home.
  for(const dir of [install,base])await writeJsonWhole(path.join(dir,"environment.json"),{python:executable,renderer});
  const destinations=[];
  for(const [i,target] of targets.entries()){
    if(owners[i]==="current"){destinations.push(target);continue;}
    await fs.mkdir(path.dirname(target),{recursive:true});
    if(owners[i]==="ours")await fs.unlink(target);
    await fs.symlink(path.join(install,"skills/professional-slides"),target,process.platform==="win32"?"junction":"dir");
    destinations.push(target);
  }
  return complete({artifacts:destinations,installation:install,version:pkg.version,probe:"passed",message:"Invoke $professional-slides in Codex or /professional-slides in Claude Code. The skill runs its persistent bundled CLI; no global npm install is needed."});
}
