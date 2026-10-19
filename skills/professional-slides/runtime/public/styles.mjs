import fs from "node:fs/promises";
import path from "node:path";
import { readJson, writeJsonWhole } from "../cli.mjs";
import { readSite } from "../site-design.mjs";
import { identityColors } from "../design-systems.mjs";
import { deckKeys } from "../preferences.mjs";
import { workedExamples } from "../author-deck.mjs";
import { newWorkspace, openWorkspace, buildWorkspace, python, complete, blocked, needed } from "./workspace.mjs";

export const HOUSE_SCHEMA = { type:"object",required:["schema","design","palette","typography"],properties:{
  schema:{const:"professional-slides.house/v1"},design:{enum:["consulting","editorial","journal","keynote"]},
  palette:{type:"object",description:"{ base: midnight|evergreen|crimson|graphite, colors: { color.componentPrimary: #RRGGBB, ... } }; primary/accent shorthand is expanded to semantic tokens"},
  typography:{type:"object",description:"{ body: font family, display: font family }"},chrome:{type:"object"},pageTemplate:{type:"object"},
  footer:{type:"string"},density:{type:"string"},fill:{type:"string"},observations:{type:"array"},unresolved:{type:"array"}
} };
function validateHouse(profile) {
  if(profile.palette?.colors?.primary){
    const {primary,accent,...rest}=profile.palette.colors;
    profile.palette.colors={...identityColors({primary,...(accent?{accent}:{})}),...rest};
  }
  const missing = HOUSE_SCHEMA.required.filter(k=>profile[k]===undefined);
  if (profile.schema !== "professional-slides.house/v1") throw new Error("Expected professional-slides.house/v1");
  if (missing.length || profile.unresolved?.length) return [...missing,...(profile.unresolved||[])];
  if (!HOUSE_SCHEMA.properties.design.enum.includes(profile.design)) throw new Error("Unknown house design");
  if (!profile.palette || !profile.typography || typeof profile.typography.body !== "string" || typeof profile.typography.display !== "string") throw new Error("A house profile needs a palette and body/display typography");
  return [];
}
export async function importStyle(source, output) {
  const out = path.resolve(output);
  await fs.mkdir(path.dirname(out),{recursive:true});
  let profile;
  if (/^https?:\/\//i.test(source)) {
    const site=await readSite(source), keys=deckKeys({colours:"brand",brand:site.brand,typography:site.typography});
    // Website extraction proposes only what it observed; it cannot infer a
    // company's slide hierarchy or silently change the saved user profile.
    profile={schema:"professional-slides.house/v1",source, ...keys,
      ...(site.brand?{palette:{base:"midnight",colors:{primary:site.brand.primary,...(site.brand.accent?{accent:site.brand.accent}:{})}}}:{}),
      observations:[JSON.stringify(site.evidence)],unresolved:["design",...(!site.brand?["palette"]:[]),...(!keys.typography?["typography"]:[])]};
  } else {
    const file=path.resolve(source), ext=path.extname(file).toLowerCase();
    if (ext===".json") profile=await readJson(file);
    else if ([".pptx",".potx"].includes(ext)) {
      const result=await python("import-template.py",[file,"--out",out]);
      if(result.code) return blocked("STYLE_IMPORT_FAILED",result.stderr||result.stdout);
      profile=await readJson(out);
    } else if ([".png",".jpg",".jpeg",".pdf"].includes(ext)) {
      const result=await python("infer-style.py",[file]);
      if(result.code) return blocked("STYLE_IMPORT_FAILED",result.stderr||result.stdout);
      const inferred=JSON.parse(result.stdout), keys=deckKeys({...inferred.suggested,colours:inferred.suggested.brand?"brand":"system"});
      profile={schema:"professional-slides.house/v1",source:file,...keys,
        ...(inferred.suggested.brand?{palette:{base:"midnight",colors:{primary:inferred.suggested.brand.primary,...(inferred.suggested.brand.accent?{accent:inferred.suggested.brand.accent}:{})}}}:{}),
        observations:inferred.observations,unresolved:["design","typography",...(!inferred.suggested.brand?["palette"]:[])]};
    } else throw new Error("Style import accepts a house JSON, PPTX, POTX, PDF, PNG, JPEG or website URL");
  }
  const missing=validateHouse(profile);
  await writeJsonWhole(out,profile);
  return complete({status:missing.length?"needs-input":"complete",artifacts:[out],profile,
    requiredInputs:missing.length?[{kind:"house-profile",target:out,fields:missing,schema:HOUSE_SCHEMA,message:"Fill these fields and remove resolved entries from unresolved; no user defaults were changed."}]:[]});
}
export async function buildStyle(file,out) {
  const profile=await readJson(path.resolve(file)), missing=validateHouse(profile);
  if(missing.length) return needed([{kind:"house-profile",target:path.resolve(file),fields:missing,schema:HOUSE_SCHEMA}]);
  const root=path.resolve(out);
  await fs.mkdir(root,{recursive:true});
  const saved=path.join(root,"brand.house.json");
  await writeJsonWhole(saved,profile);
  const examples=workedExamples();
  const choices=[["trend","line"],["ranking","bar"],["lookup","table"],["parallel","cards"],["statement","statement"]];
  const pages=choices.map(([type,form])=>examples.pages.find(p=>p.type===type&&p.form===form)).filter(Boolean).map((p,i)=>({...structuredClone(p),id:`brand-${i+1}`}));
  const doc={deck:{schema:"professional-slides.deck/v3",id:"brand-template",contents:false,template:saved},pages};
  const owned = async (dir,document) => {
    if(await fs.stat(path.join(dir,"project.json")).catch(()=>null)){
      const existing=await openWorkspace(dir);
      if(existing.doc.deck.id!==document.deck.id)throw new Error("Brand build destination contains another document");
      await writeJsonWhole(existing.file,document);
      return {...existing,doc:document};
    }
    return newWorkspace(dir,document);
  };
  const work=await owned(path.join(root,"template-source"),doc);
  const built=await buildWorkspace(work,path.join(root,"template"));
  if(built.status!=="complete")return built;
  const scene=await readJson(path.join(root,"template","scene.json"));
  const tokenRows=["type.actionTitle","type.body","type.compact"].filter(k=>scene.tokens[k]).map(k=>[k,`${scene.tokens[k].value} pt`, "Shared runtime typography"]);
  const colourRows=Object.entries(profile.palette.colors||{}).filter(([k])=>k.startsWith("color.")).slice(0,8).map(([k,v])=>[k.replace("color.",""),String(v),"Semantic brand colour"]);
  const guide={deck:{schema:"professional-slides.deck/v3",id:"brand-style-guide",contents:false,template:saved},pages:[{
    id:"style-guide",type:"lookup",form:"table",title:"The house style carries through every page",commentary:"in-exhibit",
    exhibit:{columns:["Role","Setting","Use"],rows:[
      ["Display face",profile.typography.display,"Titles and large statements"],["Body face",profile.typography.body,"Evidence and supporting copy"],
      ["Design system",profile.design,`Density: ${profile.density||"executive"}`],...tokenRows,...colourRows
    ]},source:"Brand profile supplied by the user; shared runtime tokens"
  }]};
  const guideWork=await owned(path.join(root,"style-guide-source"),guide);
  const guideBuild=await buildWorkspace(guideWork,path.join(root,"style-guide"));
  if(guideBuild.status!=="complete")return guideBuild;
  return complete({artifacts:[saved,...built.artifacts,...guideBuild.artifacts],checks:{mechanical:"passed",visual:"pending"},message:"Editable template slides, not a POTX with masters. Synthetic example data is labelled in the slides."});
}
