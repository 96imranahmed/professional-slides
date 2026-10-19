import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { readJson, writeJsonWhole, pythonBin } from "../cli.mjs";
import { runProcess, lastJson } from "../process.mjs";
import { authorDeck, readInsights } from "../author-deck.mjs";
import { buildDeck } from "../build-deck.mjs";
import { REFERENCE_SCHEMA, validateReference } from "../reference-page.mjs";
import { readPreferences, deckKeys, applyToDeck, reuseLine } from "../preferences.mjs";
import { storylineNeed, storylineDrift } from "./storyline.mjs";

export const runtime = fileURLToPath(new URL("../", import.meta.url));
export const packageRoot = fileURLToPath(new URL("../../../../", import.meta.url));
export const digest = value => crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
export const complete = (more = {}) => ({ schema: "professional-slides.result/v1", status: "complete", artifacts: [], findings: [], requiredInputs: [], ...more });
export const blocked = (code, message, more = {}) => complete({ status: "blocked", findings: [{ code, message }], ...more });
export const needed = (inputs, more = {}) => complete({ status: "needs-input", requiredInputs: inputs, ...more });
export async function python(script, args = []) {
  if(!process.env.RUNTIME_PYTHON){
    const {diagnose}=await import("../doctor.mjs");
    const report=await diagnose({render:false});
    if(!report.python.chosen)throw new Error(`Python dependencies are missing. ${report.install.join("; ")}`);
    process.env.RUNTIME_PYTHON=report.python.chosen;
  }
  return runProcess(pythonBin(), [path.join(runtime, script), ...args], { expect: [0, 2] });
}
export async function newWorkspace(dir, doc = null, { argument = null } = {}) {
  const root = path.resolve(dir);
  await fs.mkdir(root, { recursive: true });
  if (await readJson(path.join(root, "project.json"), { optional: true })) throw new Error(`Workspace already exists: ${root}`);
  const pages = "deck.pages.json";
  // Never overwrite an unrelated file in a nonempty task folder.
  await fs.writeFile(path.join(root, pages), JSON.stringify(doc || { deck: { schema: "professional-slides.deck/v3", id: "deck", contents: false }, pages: [] }, null, 2) + "\n", { flag: "wx" });
  // A workspace `init` starts is a new argument: its pages wait for an approved storyline (storyline.mjs).
  await writeJsonWhole(path.join(root, "project.json"), { schema: "professional-slides.project/v1", pages, ...(argument ? { argument } : {}) });
  return openWorkspace(root);
}
/** The user's stored design answers, written into a new deck's keys it does not set; the stored file is only read. */
export async function applyStoredPreferences(work) {
  let prefs;
  try { prefs = readPreferences(); } catch (e) { return { line: `Stored preferences were not applied: ${e.message}`, set: [] }; }
  const { document, set } = applyToDeck(work.doc, deckKeys(prefs));
  if (set.length) { work.doc = document; await writeJsonWhole(work.file, work.doc); }
  return { line: reuseLine(prefs), set };
}
export async function openWorkspace(dir) {
  if (!dir) throw new Error("A workspace path is required");
  const root = await fs.realpath(path.resolve(dir));
  const project = await readJson(path.join(root, "project.json"));
  if (project.schema !== "professional-slides.project/v1" || project.pages !== "deck.pages.json") throw new Error("Unsupported workspace manifest");
  const file = path.join(root, project.pages), doc = await readJson(file);
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(doc.deck?.id||""))throw new Error("Deck id must be a filename-safe identifier");
  return { root, file, project, doc };
}
export async function fingerprint(work) {
  const files = new Set([work.file]);
  for (const v of [work.doc.deck.inventory, work.doc.deck.template]) if (v) files.add(path.resolve(work.root, v));
  for(const page of work.doc.pages)for(const v of [page.reference,...(page.nodes||[]).filter(n=>n.kind==="image").map(n=>n.src)])if(v)files.add(path.resolve(work.root,v));
  if (work.doc.deck.inventory) {
    const inv = await readJson(path.resolve(work.root, work.doc.deck.inventory));
    if (inv.source?.copy) files.add(path.resolve(work.root, inv.source.copy));
  }
  // All workspace source assets and insight records count; derived builds never do.
  async function walk(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) await walk(f); else if (e.isFile()) files.add(f);
    }
  }
  for (const dir of ["assets", "sources"]) await walk(path.join(work.root, dir));
  for (const e of await fs.readdir(work.root)) if (e.endsWith(".insights.json")) files.add(path.join(work.root, e));
  return digest(await Promise.all([...files].sort().map(async f => [path.relative(work.root, f), digest(await fs.readFile(f))])));
}
export async function runtimeFingerprint() {
  const files=[];
  async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory()&&e.name!=="__pycache__")await walk(f);else if(e.isFile()&&/\.(mjs|py|json)$/.test(e.name))files.push(f);}}
  await walk(runtime);
  return digest(await Promise.all(files.sort().map(async f=>[path.relative(runtime,f),digest(await fs.readFile(f))])));
}
export function selectPage(doc, selector) {
  const list = doc.pages;
  let index = list.findIndex(p => p.id === selector);
  if (index < 0 && /^\d+$/.test(String(selector))) index = Number(selector) - 1;
  if (index < 0 || index >= list.length) throw new Error(`Unknown slide ${selector}`);
  return { page: list[index], index };
}
export function authoringInputs(work, selected = work.doc.pages) {
  return selected.flatMap(page => {
    if (page.type === "reference" && !page.nodes?.length) return [{ kind: "reference-page", page: page.id, source: path.resolve(work.root, page.reference), schema: REFERENCE_SCHEMA, target: work.file }];
    if (page.carry) return [];
    if (!page.type && !page.kind) return [{ kind: "page", page: page.id, evidence: page.draft || null, target: work.file, discover: "catalog --schema" }];
    return [];
  });
}
export async function inspectWorkspace(work, selector) {
  const selected = selector ? [selectPage(work.doc, selector).page] : work.doc.pages;
  const need = storylineNeed(work);
  const requiredInputs = [...(need ? [need] : []), ...authoringInputs(work, selected)];
  return complete({ status: requiredInputs.length ? "needs-input" : "complete", workspace: work.root, pagesFile: work.file,
    sourceHash: await fingerprint(work), deck: work.doc.deck, pages: selected, requiredInputs,
    ...(work.doc.deck.inventory ? { inventory: await readJson(path.resolve(work.root, work.doc.deck.inventory)) } : {}) });
}
export async function importSource(source, dir) {
  const file = path.resolve(source), ext = path.extname(file).toLowerCase();
  await fs.access(file);
  if (ext === ".pptx") {
    const root = path.resolve(dir);
    await fs.mkdir(root, { recursive: true });
    const existing = await fs.readdir(root);
    if (existing.length) throw new Error("Import destination must be empty");
    const result = await python("import-deck.py", [file, root, "--id", "deck", "--carry"]);
    if (result.code) return blocked("IMPORT_FAILED", result.stderr || result.stdout);
    await writeJsonWhole(path.join(root, "project.json"), { schema: "professional-slides.project/v1", pages: "deck.pages.json" });
    const work=await openWorkspace(root);
    const style=await python("import-template.py",[file,"--out",path.join(root,"source.house.json")]);
    if(style.code)return blocked("STYLE_IMPORT_FAILED",style.stderr||style.stdout);
    work.doc.deck.template="source.house.json";
    await writeJsonWhole(work.file,work.doc);
    return inspectWorkspace(work);
  }
  if (![".png", ".jpg", ".jpeg", ".pdf"].includes(ext)) throw new Error("Import accepts PPTX, PDF, PNG and JPEG");
  const work = await newWorkspace(dir);
  await fs.mkdir(path.join(work.root, "sources"));
  const saved = path.join(work.root, "sources", `reference${ext}`);
  await fs.copyFile(file, saved);
  let images;
  if (ext === ".pdf") {
    await runProcess("pdftoppm", ["-scale-to-x", "1280", "-scale-to-y", "-1", "-png", saved, path.join(work.root, "sources", "page")]);
    images = (await fs.readdir(path.join(work.root, "sources"))).filter(p => /^page-.*\.png$/.test(p)).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
  } else images = [path.basename(saved)];
  work.doc.pages = images.map((p, i) => ({ id: `reference-${i + 1}`, type: "reference", title: "", reference: `sources/${p}`, nodes: [], uncertainties: [] }));
  await writeJsonWhole(work.file, work.doc);
  return inspectWorkspace(work);
}

// Design-only edits compare semantic payloads, not layout field names. Unknown
// fields are preserved in the comparison, so a new capability cannot silently
// acquire permission to rewrite content.
const PRESENTATION = new Set(["form", "commentary", "tone", "pointsStyle", "pointsTone", "pointsAlign", "variant", "layout", "frame", "style"]);
export function contentSignature(value) {
  const clean = (x,at="") => Array.isArray(x) ? x.map((v,i)=>clean(v,`${at}[${i}]`)) : x && typeof x === "object"
    ? Object.fromEntries(Object.entries(x).filter(([k]) => !PRESENTATION.has(k) && k !== "limits" && !(k==="type" && /(?:^|\.)exhibits?(?:\[\d+\])?$/.test(at)))
      .sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k, clean(v,at?`${at}.${k}`:k)])) : x;
  return digest(clean(value));
}
export async function editWorkspace(work, patch) {
  if (!patch || !["content", "design"].includes(patch.scope) || !Array.isArray(patch.edits) || !patch.edits.length) throw new Error("Patch is { scope: content|design, edits: [{ page, value }] }; value replaces that complete page, or page='deck' replaces deck settings");
  const next = structuredClone(work.doc);
  for (const edit of patch.edits) {
    if (!edit.value || typeof edit.value !== "object" || Array.isArray(edit.value)) throw new Error("Every edit needs an object value");
    if (edit.page === "deck") {
      if (patch.scope === "design") {
        const allowed = new Set(["design", "palette", "typography", "chrome", "pageTemplate", "template", "fill", "tone", "variation", "tracker"]);
        for (const key of new Set([...Object.keys(next.deck), ...Object.keys(edit.value)])) if (!allowed.has(key) && JSON.stringify(next.deck[key]) !== JSON.stringify(edit.value[key])) throw new Error(`Design edit changes deck content: ${key}`);
      }
      next.deck = edit.value;
    } else {
      if (edit.page === "new") {
        if (patch.scope !== "content" || !edit.value.id || next.pages.some(p=>p.id===edit.value.id)) throw new Error("Adding a page requires content scope and a unique id");
        const need = storylineNeed(work);
        if (need) return needed([need], { message: "No page is written before the user approves the storyline." });
        next.pages.push(edit.value);
        continue;
      }
      const { page, index } = selectPage(next, String(edit.page));
      if (edit.value.id !== page.id) throw new Error("An edit must retain the page id");
      if (patch.scope === "design" && contentSignature(page) !== contentSignature(edit.value)) throw new Error(`Design edit changes content on ${page.id}`);
      if (page.sourceSlide && edit.value.sourceSlide !== page.sourceSlide) throw new Error("A revision edit must retain sourceSlide");
      next.pages[index] = edit.value;
    }
  }
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(next.deck?.id||""))throw new Error("Deck id must be a filename-safe identifier");
  for (const page of next.pages) if (page.type === "reference" && page.nodes?.length) validateReference(page);
  // Partially authored work is allowed; malformed edits are rejected before write.
  const { compileDeck } = await import("../author-deck.mjs");
  const compiled = compileDeck(next, { insights: await readInsights(work.root, next.deck.id), partial: true });
  if (compiled.compileErrors.length) return blocked("EDIT_INVALID", compiled.compileErrors.join("\n"));
  await writeJsonWhole(work.file, next);
  return inspectWorkspace(await openWorkspace(work.root));
}
// Findings the compile measures on one page's layout, before any render. The build stops on them instead of rendering
// a deck it will redo: the A350F deck's three half-empty pages were measured on the scene (SCENE_VOID), rendered anyway
// and reported as complete; a design edit that set a page's points aside (PAGE_ADJUSTED) dropped them without a word.
const STOP_BEFORE_RENDER = new Set(["SCENE_VOID", "PAGE_ADJUSTED"]);

/** A new argument's pages against its approved storyline: held when one is unapproved, or pages were added or dropped since. */
function argumentHeld(work) {
  const need = storylineNeed(work);
  if (need) return { held: needed([need]) };
  if (work.project?.argument !== "new") return { advisories: [] };
  const drift = storylineDrift(work);
  if (drift.missing.length || drift.added.length) return { held: needed([{ kind: "storyline-approval", code: "STORYLINE_PAGES_CHANGED", missing: drift.missing, added: drift.added,
    message: `The pages differ from the storyline the user approved${drift.added.length ? `; added: ${drift.added.join(", ")}` : ""}${drift.missing.length ? `; not written: ${drift.missing.join(", ")}` : ""}.`,
    ask: "Write the pages the user approved, or change the storyline to the pages the deck needs and show them the new version (`storyline WORK`)." }]) };
  return { advisories: drift.retitled.map((id) => ({ code: "STORYLINE_TITLE_CHANGED", id, severity: "advisory",
    repair: `${id}: its title is not the one the user approved; tell them when you deliver` })) };
}

/** Compile and lay out every page, with the page gates, and render nothing: `held` is the result to return when it stops. */
async function compileWorkspace(work, { python: py = pythonBin() } = {}) {
  const argument = argumentHeld(work);
  if (argument.held) return argument;
  const inputs = authoringInputs(work);
  if (inputs.length) return { held: needed(inputs) };
  if (!work.doc.pages.length) return { held: needed([{ kind: "pages", target: work.file, discover: "catalog --example" }]) };
  const authored = await authorDeck(work.doc, { baseDir: work.root, insights: await readInsights(work.root, work.doc.deck.id), python: py });
  const stops = authored.advisories.filter((f) => STOP_BEFORE_RENDER.has(f.code));
  const advisories = [...argument.advisories, ...authored.advisories.filter((f) => !STOP_BEFORE_RENDER.has(f.code))];
  if (authored.blocking.length || stops.length) return { held: complete({ status: "blocked", stage: "compile",
    message: "Stopped before the render: fix these pages in the pages file, then build again.", findings: [...authored.blocking, ...stops], advisories }) };
  return { authored, advisories };
}

/** `check WORK`: the compile and the page gates, without emitting or rendering anything. */
export async function checkWorkspace(work) {
  const compiled = await compileWorkspace(work);
  if (compiled.held) return compiled.held;
  return complete({ stage: "compile", message: "Every page composes and passes its layout checks; nothing was rendered.", advisories: compiled.advisories });
}

export async function buildWorkspace(work, out, { python: py = pythonBin() } = {}) {
  const compiled = await compileWorkspace(work, { python: py });
  if (compiled.held) return compiled.held;
  const { authored, advisories } = compiled;
  const spec = path.join(work.root, `${work.doc.deck.id}.deck.json`);
  await writeJsonWhole(spec, authored.spec);
  await buildDeck(spec, path.resolve(out), { python: py, render: true, source: { spec: authored.spec, baseDir: work.root } });
  const result = await readJson(path.join(path.resolve(out), "build-result.json"));
  const status = result.status === "built" ? "complete" : "blocked";
  const files = [];
  async function walk(dir) { for (const e of await fs.readdir(dir, { withFileTypes: true })) { const f = path.join(dir,e.name); if (e.isDirectory()) await walk(f); else if (/\.(pptx|pdf|png)$/.test(e.name)) files.push(f); } }
  await walk(path.resolve(out));
  const scene=await readJson(path.join(path.resolve(out),"scene.json"));
  const readback=await readJson(path.join(path.resolve(out),"readback.json"),{optional:true});
  const editability={schema:"professional-slides.editability/v1",scope:"composed pages",basis:"scene with saved-PPTX readback",
    pptxHash:digest(await fs.readFile(path.join(path.resolve(out),`${work.doc.deck.id}.pptx`))),
    readbackAccepted:readback?.accepted??null,textObjectsChecked:readback?.stats?.text_checked??0,nativeChartsChecked:readback?.stats?.charts_checked??0,
    pages:scene.slides.map(p=>({id:p.id,text:p.nodes.filter(n=>n.type==="text").length,images:p.nodes.filter(n=>n.type==="image").length,
      shapes:p.nodes.filter(n=>!["text","image"].includes(n.type)).length}))};
  const editabilityFile=path.join(path.resolve(out),"editability.json");
  await writeJsonWhole(editabilityFile,editability);
  files.push(editabilityFile);
  const comparisons=[];
  for(const page of work.doc.pages.filter(p=>p.type==="reference")){
    const i=scene.slides.findIndex(p=>p.id===page.id);
    const render=files.find(f=>f.endsWith(`/rendered/slide-${i+1}.png`));
    if(render)comparisons.push({label:page.id,note:"Source and editable PowerPoint",images:[{path:path.resolve(work.root,page.reference)},{path:render}]});
  }
  if(comparisons.length){
    const layout=path.join(path.resolve(out),"reconstruction-comparison.json"),image=path.join(path.resolve(out),"reconstruction-comparison.png");
    await writeJsonWhole(layout,{out:image,title:"Reference and reconstructed PowerPoint",header:false,tiles:comparisons});
    await runProcess(py,[path.join(runtime,"emit/contact_sheet.py"),layout]);
    files.push(image);
  }
  const uncertainties = work.doc.pages.flatMap(p => (p.uncertainties || []).map(message => ({ page: p.id, message })));
  return complete({ status, sourceHash: await fingerprint(work), artifacts: files, findings: result.blockers || [], advisories,
    checks: { mechanical: status === "complete" ? "passed" : "failed", rendering: result.status === "built-unrendered" ? "missing" : "ran", visual: "pending" },
    editability, uncertainties, result: path.join(path.resolve(out), "build-result.json") });
}
