import fs from "node:fs/promises";
import path from "node:path";
import { PAGE_TYPES } from "../page-types.mjs";
import { DESIGN_NAMES } from "../design-systems.mjs";
import { readJson, writeJsonWhole, pythonBin } from "../cli.mjs";
import { runProcess } from "../process.mjs";
import { authorDeck, readInsights } from "../author-deck.mjs";
import { buildWorkspace, fingerprint, runtimeFingerprint, selectPage, contentSignature, digest, complete, needed, blocked, python, runtime } from "./workspace.mjs";

export async function makeOptions(work, selector, { count = 3, design, style } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error("count must be an integer from 1 to 8");
  if (design && !DESIGN_NAMES.includes(design)) throw new Error(`Unknown design ${design}`);
  const { page, index } = selectPage(work.doc, String(selector));
  if (page.carry || !page.type || page.type === "reference") return needed([{ kind: "page", page: page.id, evidence: page.draft || page,
    target: work.file, message: "Map the selected slide to a catalogue page type, retaining its words, data, citations, id and sourceSlide. Then request options." }]);
  const sourceHash = await fingerprint(work);
  const runtimeHash = await runtimeFingerprint();
  const setId = `set-${sourceHash.slice(0,12)}-${digest({ page: page.id, design, style }).slice(0,8)}`;
  const dir = path.join(work.root, "candidates", setId);
  await fs.mkdir(dir, { recursive: true });
  let baseline = work.doc;
  let targetIndex = index;
  // Re-style only this page: every other slide is carried from an exact baseline,
  // never recompiled under the proposed deck-level palette or design.
  if (design || style) {
    const baseOut = path.join(dir, "baseline-build");
    const built = await buildWorkspace(work, baseOut);
    if (built.status !== "complete") return built;
    const source = path.join(baseOut, `${work.doc.deck.id}.pptx`);
    const imported = path.join(dir, "baseline");
    try { await fs.access(path.join(imported,"base.pages.json")); }
    catch { const r = await python("import-deck.py", [source, imported, "--id", "base", "--carry"]); if (r.code) return blocked("IMPORT_FAILED", r.stderr || r.stdout); }
    baseline = await readJson(path.join(imported,"base.pages.json"));
    const inv = await readJson(path.join(imported,"base.inventory.json"));
    inv.source.copy = path.join(imported,"base.source.pptx");
    await writeJsonWhole(path.join(imported,"base.inventory.json"), inv);
    baseline.deck.inventory = path.join(imported,"base.inventory.json");
    const matches = baseline.pages.map((p,i) => p.title === page.title ? i : -1).filter(i=>i>=0);
    if (matches.length !== 1) return blocked("SLIDE_MAPPING_AMBIGUOUS", "A style change needs one uniquely titled target slide in the rendered baseline");
    targetIndex = matches[0];
    for (const key of ["design","palette","typography","chrome","pageTemplate","density","fill","footer"]) if (work.doc.deck[key] !== undefined) baseline.deck[key] = work.doc.deck[key];
    baseline.deck.id = work.doc.deck.id;
    if(work.doc.deck.template){
      const house=await readJson(path.resolve(work.root,work.doc.deck.template));
      if(!baseline.deck.palette&&house.palette)baseline.deck.palette=house.palette;
      if(!baseline.deck.typography&&house.typography)baseline.deck.typography=house.typography;
    }
    if (design) { baseline.deck.design = design; delete baseline.deck.chrome; }
    if (style) baseline.deck.template = path.resolve(style);
  }
  const definition = PAGE_TYPES[page.type], candidates = [], rejected = [], seen = new Set();
  const current = page.form || Object.keys(definition.forms)[0];
  const forms = [current, ...Object.keys(definition.forms).filter(f=>f!==current)];
  const placements = [page.commentary, ...definition.commentary].filter((x,i,a)=>a.indexOf(x)===i);
  // No synthetic filler: each combination comes from this type's registry and
  // must survive the exact same authoring and saved-file checks as a real build.
  for (const form of forms) {
    for (const commentary of placements.length ? placements : [undefined]) {
      if (candidates.length >= count) break;
      const value = { ...structuredClone(page), form, ...(commentary ? { commentary } : {}) };
      for (const exhibit of [value.exhibit,...(value.exhibits||[])].filter(Boolean))
        if(exhibit.type === definition.forms[current]) exhibit.type=definition.forms[form];
      if (contentSignature(value) !== contentSignature(page)) throw new Error("Candidate changed content");
      const doc = structuredClone(baseline);
      if (design || style) value.sourceSlide = doc.pages[targetIndex].sourceSlide;
      doc.pages[targetIndex] = value;
      const candidateId = `${setId}-${String(candidates.length + 1).padStart(2,"0")}`;
      const out = path.join(dir, candidateId);
      let authored;
      try { authored = await authorDeck(doc, { baseDir: work.root, insights: await readInsights(work.root, work.doc.deck.id), python: pythonBin() }); }
      catch (e) { rejected.push({ form, commentary, reason: e.message }); continue; }
      if (authored.blocking.length || authored.advisories.some(f=>f.code === "PAGE_ADJUSTED")) { rejected.push({ form, commentary, findings: [...authored.blocking,...authored.advisories] }); continue; }
      const shape = authored.deck?.slides.find(p=>p.id===page.id);
      const signature = digest(shape?.nodes.map(n=>({ type:n.type, role:n.role, frame:n.frame, text:n.text })) || []);
      if (seen.has(signature)) continue;
      const result = await buildWorkspace({ ...work, doc }, out);
      if (result.status !== "complete") { rejected.push({ form, commentary, findings: result.findings }); continue; }
      seen.add(signature);
      const image = result.artifacts.find(f=>f.endsWith(`/deck/slide-${targetIndex+1}.png`))
        || result.artifacts.find(f=>f.endsWith(`/rendered/slide-${targetIndex+1}.png`));
      if (!image) throw new Error("Build returned no rendered image for the selected slide");
      await fs.access(image);
      const saved = path.join(out, "candidate.json");
      const record = { schema: "professional-slides.candidate/v1", id: candidateId, sourceHash, sourcePage: page.id,
        contentHash: contentSignature(page), doc, image, pptx: path.join(out, `${doc.deck.id}.pptx`), runtimeHash,
        dependenciesHash:await fingerprint({...work,doc}),imageHash:digest(await fs.readFile(image)),
        pptxHash:digest(await fs.readFile(path.join(out,`${doc.deck.id}.pptx`))) };
      await writeJsonWhole(saved, record);
      candidates.push({ id: candidateId, form, commentary, image, pptx: record.pptx, record: saved, recordHash: digest(record) });
    }
    if (candidates.length >= count) break;
  }
  if (!candidates.length) return blocked("NO_VALID_CANDIDATES", "No compatible alternatives passed. Inspect the findings and author another supported form.", { rejected });
  const sheet = path.join(dir,"comparison.png"), layout = path.join(dir,"contact-sheet.json");
  await writeJsonWhole(layout, { out: sheet, title: page.title, subtitle: "Editable alternatives using the source slide's content", header: false,
    tiles: candidates.map(c=>({ label:c.id, note:`${c.form}${c.commentary ? ` / ${c.commentary}` : ""}`,images:[{path:c.image}] })) });
  await runProcess(pythonBin(), [path.join(runtime,"emit/contact_sheet.py"),layout]);
  await writeJsonWhole(path.join(dir,"candidates.json"), { sourceHash, candidates });
  return complete({ artifacts:[sheet,...candidates.flatMap(c=>[c.image,c.pptx])], candidates, requested:count, produced:candidates.length, rejected,
    findings: candidates.length<count ? [{code:"FEWER_VALID_OPTIONS",message:`Only ${candidates.length} distinct options passed; no duplicates added.`}] : [] });
}
export async function applyCandidate(work, id) {
  if (!/^set-[a-f0-9]{12}-[a-f0-9]{8}-\d{2}$/.test(id)) throw new Error("Use the exact candidate id returned by options");
  const setId = id.replace(/-\d{2}$/, ""), dir = path.join(work.root,"candidates",setId);
  const manifest = await readJson(path.join(dir,"candidates.json"));
  const entry = manifest.candidates.find(c=>c.id===id);
  if (!entry) throw new Error("Candidate is not in its manifest");
  const record = await readJson(path.join(dir,id,"candidate.json"));
  if (record.sourceHash !== await fingerprint(work)) return blocked("CANDIDATE_STALE", "The source changed after these options were generated. Generate new options.");
  if (digest(record)!==entry.recordHash || record.contentHash !== contentSignature(selectPage(work.doc,record.sourcePage).page)) return blocked("CANDIDATE_CHANGED", "The candidate no longer matches its saved preview");
  if(record.runtimeHash!==await runtimeFingerprint()||record.dependenciesHash!==await fingerprint({...work,doc:record.doc}))return blocked("CANDIDATE_STALE","The runtime or a candidate dependency changed. Generate fresh options.");
  if(record.imageHash!==digest(await fs.readFile(record.image))||record.pptxHash!==digest(await fs.readFile(record.pptx)))return blocked("CANDIDATE_CHANGED","The rendered preview or saved PowerPoint changed. Generate fresh options.");
  await writeJsonWhole(work.file, record.doc);
  return complete({ candidate:id, artifacts:[work.file,record.image], message:"Candidate applied. Build to emit the revised deck." });
}
