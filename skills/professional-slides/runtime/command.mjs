#!/usr/bin/env node
// Public CLI. Commands are described once for discovery, help and parsing.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCli, readJson, isMain } from "./cli.mjs";
import { PAGE_TYPES, pageSchema } from "./page-types.mjs";
import { formFields } from "./form-fields.mjs";
import { workedExamples } from "./author-deck.mjs";
import { referenceExample } from "./reference-page.mjs";
import { complete, blocked, needed, newWorkspace, openWorkspace, inspectWorkspace, importSource, editWorkspace, buildWorkspace, checkWorkspace, applyStoredPreferences, packageRoot } from "./public/workspace.mjs";
import { STORYLINE_SCHEMA, showStoryline, approveStoryline, scaffoldStoryline } from "./public/storyline.mjs";
import { makeOptions, applyCandidate } from "./public/candidates.mjs";
import { addInsights } from "./public/insights.mjs";
import { pictureCandidates } from "./public/pictures.mjs";
import { setPictureKey, clearPictureKey, keyStatus, keysPath } from "./picture-keys.mjs";
import { importStyle, buildStyle, HOUSE_SCHEMA } from "./public/styles.mjs";
import { checkEnvironment, setup, setupHome } from "./public/setup.mjs";

const flag = (type="string") => ({type});
export const COMMANDS = Object.freeze({
  setup: {args:0,usage:"setup --agent codex|claude|both [--scope user|project] [--renderer auto|powerpoint|libreoffice]",about:"Install a persistent agent skill and verify local rendering",flags:{agent:flag(),scope:flag(),renderer:flag()}},
  doctor: {args:0,usage:"doctor [--probe] [--renderer auto|powerpoint|libreoffice]",about:"Check local Office, Python and Poppler",flags:{probe:flag("boolean"),renderer:flag()}},
  init: {args:1,usage:"init WORK",about:"Start a new deck: its pages wait for an approved storyline",flags:{}},
  import: {args:1,usage:"import SOURCE --out WORK",about:"Keep a supplied deck, image or PDF and import its evidence",flags:{out:flag()}},
  storyline: {args:1,usage:"storyline WORK [--approve \"USER'S WORDS\" | --scaffold]",about:"Show the storyline for approval, record the user's reply, or write the approved pages",flags:{approve:flag(),scaffold:flag("boolean")}},
  inspect: {args:1,usage:"inspect WORK [--slide ID_OR_NUMBER]",about:"Read source pages, evidence and required authoring inputs",flags:{slide:flag()}},
  catalog: {args:0,usage:"catalog [--type TYPE[/FORM]|house|storyline|sources] [--schema|--example]",about:"Discover registered capabilities, schemas and examples",flags:{type:flag(),schema:flag("boolean"),example:flag("boolean")}},
  edit: {args:1,usage:"edit WORK --file PATCH.json",about:"Apply content or design scoped page replacements",flags:{file:flag()}},
  options: {args:1,usage:"options WORK --slide ID_OR_NUMBER [--count 3] [--design SYSTEM] [--style PROFILE] [--no-fetch]",about:"Render distinct, content-preserving slide alternatives",flags:{slide:flag(),count:flag(),design:flag(),style:flag(),"no-fetch":flag("boolean")}},
  apply: {args:1,usage:"apply WORK --candidate ID",about:"Apply the exact saved candidate after freshness checks",flags:{candidate:flag()}},
  insights: {args:1,usage:"insights WORK --add BATCH.json",about:"File one research batch as a part of the insight log, its sources beside it",flags:{add:flag()}},
  keys: {args:0,usage:"keys [--set PROVIDER | --clear PROVIDER]",about:"Show which picture libraries have a key, or set one (read from standard input) or clear it: pexels, unsplash, pixabay",flags:{set:flag(),clear:flag()}},
  pictures: {args:1,usage:"pictures WORK --candidates",about:"Find each planned picture's best three files across the picture libraries, on one sheet to look at before the build",flags:{candidates:flag("boolean")}},
  check: {args:1,usage:"check WORK",about:"Compile every page and run its layout checks, without rendering",flags:{}},
  build: {args:1,usage:"build WORK --out OUT [--page ID[,ID...]] [--no-fetch]",about:"Build and check the saved PowerPoint using local Office; --page builds and renders those pages alone to look at; --no-fetch looks up no logo, photograph or place",flags:{out:flag(),renderer:flag(),page:flag(),"no-fetch":flag("boolean")}},
  "style import": {args:1,usage:"style import SOURCE --out PROFILE.json",about:"Extract a named house profile without changing user defaults",flags:{out:flag()}},
  "style build": {args:1,usage:"style build PROFILE.json --out OUT [--no-fetch]",about:"Render editable style-guide and template slides",flags:{out:flag(),renderer:flag(),"no-fetch":flag("boolean")}},
});
export function commandHelp(name) {
  return name&&COMMANDS[name] ? `professional-slides ${COMMANDS[name].usage}\n${COMMANDS[name].about}\nAll commands accept --json and --help.`
    : `Professional Slides\nLocal PowerPoint or LibreOffice and Poppler are required.\n\n${Object.values(COMMANDS).map(c=>`  ${c.usage}\n    ${c.about}`).join("\n")}\n\n--json writes one structured result. Exit: 0 complete, 1 error, 2 blocked, 3 needs-input.`;
}
const required = (value,name) => {if(!value)throw new Error(`Missing --${name}`);return value;};
export async function execute(argv) {
  const args=[...argv];
  let command=args.shift();
  if(command==="style") command=`style ${args.shift()||""}`;
  if(!command||command==="--help"||command==="help")return complete({help:commandHelp(),commands:COMMANDS});
  const definition=COMMANDS[command];
  if(!definition)throw new Error(`Unknown command ${command}. Run professional-slides --help`);
  const {values:v,positionals:p}=parseCli(args,{...definition.flags,json:flag("boolean"),help:flag("boolean")},{usage:commandHelp(command),strict:true});
  if(v.help)return complete({help:commandHelp(command)});
  if(p.length!==definition.args)throw new Error(commandHelp(command));
  // The installation's own environment, else the one setup prepared in its home (an `npx` run from the package).
  const config=await readJson(path.join(packageRoot,"environment.json"),{optional:true})??await readJson(path.join(setupHome(),"environment.json"),{optional:true});
  if(!process.env.RUNTIME_PYTHON&&config?.python)process.env.RUNTIME_PYTHON=config.python;
  if(!process.env.PROFESSIONAL_SLIDES_RENDERER&&config?.renderer)process.env.PROFESSIONAL_SLIDES_RENDERER=config.renderer;
  if(v.renderer)process.env.PROFESSIONAL_SLIDES_RENDERER=v.renderer;
  const renderer=v.renderer||process.env.PROFESSIONAL_SLIDES_RENDERER||"auto";
  if(command==="setup")return setup(v);
  if(command==="keys"){
    if(v.set&&v.clear)throw new Error("Choose --set or --clear");
    // The key comes on standard input, never as an argument: it stays out of the shell's history and the transcript.
    if(v.set){const chunks=[];if(!process.stdin.isTTY)for await(const chunk of process.stdin)chunks.push(chunk);setPictureKey(v.set,Buffer.concat(chunks).toString("utf8"));}
    if(v.clear)clearPictureKey(v.clear);
    return complete({message:v.set?`Stored the ${v.set} key in ${keysPath()}.`:v.clear?`Cleared the ${v.clear} key.`:"Picture libraries with a key, and where it is read from:",pictureKeys:keyStatus()});
  }
  if(command==="doctor")return checkEnvironment({probe:v.probe,renderer});
  if(command==="catalog"){
    if(v.schema&&v.example)throw new Error("Choose --schema or --example");
    if(v.type==="house")return complete({schemaDefinition:HOUSE_SCHEMA});
    if(v.type==="storyline")return complete({schemaDefinition:STORYLINE_SCHEMA});
    // The sources registry a page cites by key: research batches carry it, `insights --add` files it beside their part.
    if(v.type==="sources")return complete({schemaDefinition:pageSchema().properties.sources});
    const [type,form]=(v.type||"").split("/");
    if(type&&!PAGE_TYPES[type])throw new Error(`Unknown type ${type}`);
    if(v.schema)return complete({schemaDefinition:form?formFields(type,form):pageSchema(type||null)});
    if(v.example){const examples=type==="reference"?[referenceExample()]:workedExamples().pages.filter(p=>(!type||p.type===type)&&(!form||p.form===form));return complete({examples});}
    // `reference` rebuilds a slide image; it is listed only when asked for by name.
    return complete({types:type?{[type]:PAGE_TYPES[type]}:Object.fromEntries(Object.entries(PAGE_TYPES).filter(([name])=>name!=="reference"))});
  }
  if(command==="init"){
    const work=await newWorkspace(p[0],null,{argument:"new"});
    const preferences=await applyStoredPreferences(work);
    return complete({...await inspectWorkspace(work),...(preferences.line?{preferences:preferences.line}:{})});
  }
  if(command==="import")return importSource(p[0],required(v.out,"out"));
  if(command==="style import")return importStyle(p[0],required(v.out,"out"));
  if(["build","options","style build"].includes(command)){
    const ready=await checkEnvironment({renderer});if(ready.status!=="complete")return ready;
  }
  const fetching=!v["no-fetch"];
  if(command==="style build")return buildStyle(p[0],required(v.out,"out"),{fetch:fetching});
  const work=await openWorkspace(p[0]);
  if(command==="inspect")return inspectWorkspace(work,v.slide);
  if(command==="storyline"){
    const results={complete,blocked,needed};
    if(v.approve!==undefined&&v.scaffold)throw new Error("Choose --approve or --scaffold");
    if(v.approve!==undefined)return approveStoryline(work,v.approve,results);
    return v.scaffold?scaffoldStoryline(work,results):showStoryline(work,results);
  }
  if(command==="insights")return addInsights(work,required(v.add,"add"),{complete,blocked});
  if(command==="pictures"){if(!v.candidates)throw new Error(commandHelp(command));return pictureCandidates(work,{complete});}
  if(command==="check")return checkWorkspace(work);
  if(command==="edit")return editWorkspace(work,await readJson(path.resolve(required(v.file,"file"))));
  if(command==="options")return makeOptions(work,required(v.slide,"slide"),{count:v.count===undefined?3:Number(v.count),design:v.design,style:v.style,fetch:fetching});
  if(command==="apply")return applyCandidate(work,required(v.candidate,"candidate"));
  if(command==="build")return buildWorkspace(work,required(v.out,"out"),{fetch:fetching,...(v.page?{only:new Set(String(v.page).split(",").map(s=>s.trim()).filter(Boolean))}:{})});
  throw new Error(`Unhandled command ${command}`);
}
export async function main(argv=process.argv.slice(2)) {
  let result;
  try{result=await execute(argv);}catch(e){result=complete({status:e.name==="RefusalError"?"blocked":"error",findings:[{code:e.code||"COMMAND_ERROR",message:e.message}]});}
  if(argv.includes("--json"))process.stdout.write(JSON.stringify(result,null,2)+"\n");
  else if(result.help)process.stdout.write(result.help+"\n");
  else{
    process.stdout.write(`${result.status}${result.message?`: ${result.message}`:""}\n`);
    for(const artifact of result.artifacts||[])process.stdout.write(`${artifact}\n`);
    // Messages meant for the user print as they read: the approval message above all.
    if(result.preferences)process.stdout.write(`${result.preferences}\n`);
    if(result.storyline)process.stdout.write(`\n${result.storyline}\n`);
    for(const input of result.requiredInputs||[])if(input.message)process.stdout.write(`\n${input.message}\n${input.ask?`\n${input.ask}\n`:""}`);
    if(result.findings?.length||result.advisories?.length||result.requiredInputs?.some(i=>!i.message)||result.environment||result.candidates||result.types||result.examples||result.schemaDefinition||result.pictureKeys)process.stdout.write(JSON.stringify(result,null,2)+"\n");
  }
  return {complete:0,error:1,blocked:2,"needs-input":3}[result.status]??1;
}
if(isMain(import.meta.url))process.exitCode=await main();
