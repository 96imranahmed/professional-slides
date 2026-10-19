import fs from "node:fs/promises";
import path from "node:path";
import { PAGE_TYPES } from "../page-types.mjs";
import { DESIGN_NAMES } from "../design-systems.mjs";
import { readJson, writeJsonWhole, pythonBin } from "../cli.mjs";
import { runProcess } from "../process.mjs";
import { authorDeck, readInsights } from "../author-deck.mjs";
import { buildWorkspace, renderedSlide, fingerprint, runtimeFingerprint, selectPage, contentSignature, digest, complete, needed, blocked, runtime } from "./workspace.mjs";

// What an option's own page must not carry: a refusal, or a finding the build stops on before the render.
const HELD = new Set(["SCENE_VOID", "PAGE_ADJUSTED"]);

/**
 * The deck an option is drawn in. A design or a style is the deck's, so it restyles every page the deck composes;
 * carried slides keep their own look, copied as they are. A style's profile is copied into the workspace (`styles/`), so
 * the deck never points outside it, and the deck's own palette, faces and frame give way to the profile's.
 */
async function optionDeck(work, { design, style }) {
  const deck = structuredClone(work.doc.deck);
  if (style) {
    const file = path.join("styles", path.basename(style));
    await fs.mkdir(path.join(work.root, "styles"), { recursive: true });
    if (path.resolve(style) !== path.join(work.root, file)) await fs.copyFile(path.resolve(style), path.join(work.root, file));
    for (const key of ["design", "palette", "typography", "chrome", "pageTemplate", "fill"]) delete deck[key];
    deck.template = file;
  }
  if (design) { deck.design = design; delete deck.chrome; }
  return deck;
}

export async function makeOptions(work, selector, { count = 3, design, style, fetch = true } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error("count must be an integer from 1 to 8");
  if (design && !DESIGN_NAMES.includes(design)) throw new Error(`Unknown design ${design}`);
  const { page, index } = selectPage(work.doc, String(selector));
  if (page.carry || !page.type || page.type === "reference") return needed([{ kind: "page", page: page.id, evidence: page.draft || page,
    target: work.file, message: "Map the selected slide to a catalogue page type, retaining its words, data, citations, id and sourceSlide. Then request options." }]);
  const setId = `set-${(await fingerprint(work)).slice(0,12)}-${digest({ page: page.id, design, style }).slice(0,8)}`;
  const dir = path.join(work.root, "candidates", setId);
  await fs.mkdir(dir, { recursive: true });
  const deck = design || style ? await optionDeck(work, { design, style }) : work.doc.deck;
  const restyled = design || style ? work.doc.pages.filter((p) => !p.carry && p.id !== page.id).map((p) => p.id) : [];
  const insights = await readInsights(work.root, work.doc.deck.id);
  const definition = PAGE_TYPES[page.type], built = [], rejected = [], seen = new Set();
  const current = page.form || Object.keys(definition.forms)[0];
  const forms = [current, ...Object.keys(definition.forms).filter(f=>f!==current)];
  const placements = [page.commentary, ...definition.commentary].filter((x,i,a)=>a.indexOf(x)===i);
  const own = (f) => String(f.id) === String(page.id);
  // No synthetic filler: each combination comes from this type's registry and must pass the same compile, page gates
  // and saved-file checks as a real build. Only the option's page is emitted and rendered.
  for (const form of forms) {
    for (const commentary of placements.length ? placements : [undefined]) {
      if (built.length >= count) break;
      const value = { ...structuredClone(page), form, ...(commentary ? { commentary } : {}) };
      for (const exhibit of [value.exhibit,...(value.exhibits||[])].filter(Boolean))
        if(exhibit.type === definition.forms[current]) exhibit.type=definition.forms[form];
      if (contentSignature(value) !== contentSignature(page)) throw new Error("Candidate changed content");
      const doc = { ...structuredClone(work.doc), deck: structuredClone(deck) };
      doc.pages[index] = value;
      const candidateId = `${setId}-${String(built.length + 1).padStart(2,"0")}`;
      const out = path.join(dir, candidateId);
      let authored;
      try { authored = await authorDeck(doc, { baseDir: work.root, insights, python: pythonBin() }); }
      catch (e) { rejected.push({ form, commentary, reason: e.message }); continue; }
      // Findings on other pages are the deck's, not this option's.
      const held = [...authored.blocking.filter(own), ...authored.advisories.filter((f) => own(f) && HELD.has(f.code))];
      if (held.length) { rejected.push({ form, commentary, findings: held }); continue; }
      const shape = authored.deck?.slides.find(p=>p.id===page.id);
      const signature = digest(shape?.nodes.map(n=>({ type:n.type, role:n.role, frame:n.frame, text:n.text })) || []);
      if (seen.has(signature)) continue;
      let result;
      try { result = await buildWorkspace(work, out, { doc, authored, only: new Set([String(page.id)]), specPath: path.join(dir, `${candidateId}.deck.json`), fetch }); }
      catch (e) { rejected.push({ form, commentary, reason: e.message }); continue; }
      if (result.status !== "complete") { rejected.push({ form, commentary, findings: result.findings }); continue; }
      seen.add(signature);
      const image = renderedSlide(out, await readJson(path.join(out, "scene.json")), page.id);
      if (!image || !await fs.access(image).then(() => true, () => false)) throw new Error("Build returned no rendered image for the selected slide");
      const pptx = result.artifacts.find((f) => f.endsWith(".pptx"));
      built.push({ id: candidateId, form, commentary, image, pptx, value, out });
    }
    if (built.length >= count) break;
  }
  if (!built.length) return blocked("NO_VALID_CANDIDATES", "No compatible alternatives passed. Inspect the findings and author another supported form.", { rejected });
  // Taken once every option is built: a build that fetched a logo or a picture into assets/ changed the workspace.
  const sourceHash = await fingerprint(work), runtimeHash = await runtimeFingerprint();
  const candidates = [];
  for (const c of built) {
    const record = { schema: "professional-slides.candidate/v2", id: c.id, sourceHash, sourcePage: page.id, contentHash: contentSignature(page),
      page: c.value, ...(design || style ? { deck, restyled } : {}), image: c.image, pptx: c.pptx, runtimeHash,
      dependenciesHash: await fingerprint({ ...work, doc: { ...work.doc, deck } }), imageHash: digest(await fs.readFile(c.image)), pptxHash: digest(await fs.readFile(c.pptx)) };
    const saved = path.join(c.out, "candidate.json");
    await writeJsonWhole(saved, record);
    candidates.push({ id: c.id, form: c.form, commentary: c.commentary, image: c.image, pptx: c.pptx, record: saved, recordHash: digest(record) });
  }
  const sheet = path.join(dir,"comparison.png"), layout = path.join(dir,"contact-sheet.json");
  await writeJsonWhole(layout, { out: sheet, title: page.title, subtitle: "Editable alternatives using the source slide's content", header: false,
    tiles: candidates.map(c=>({ label:c.id, note:`${c.form}${c.commentary ? ` / ${c.commentary}` : ""}`,images:[{path:c.image}] })) });
  await runProcess(pythonBin(), [path.join(runtime,"emit/contact_sheet.py"),layout]);
  await writeJsonWhole(path.join(dir,"candidates.json"), { sourceHash, candidates });
  return complete({ artifacts:[sheet,...candidates.flatMap(c=>[c.image,c.pptx])], candidates, requested:count, produced:candidates.length, rejected,
    ...(restyled.length ? { restyled, message: `A design or style is the deck's: applying it also restyles ${restyled.join(", ")}; their words and data stay as they are.` } : {}),
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
  // Only the option's page, and the deck's design where the option set one, change: every other page stays as written.
  const next = structuredClone(work.doc);
  next.pages[selectPage(next, record.sourcePage).index] = record.page;
  if (record.deck) next.deck = record.deck;
  if(record.runtimeHash!==await runtimeFingerprint()||record.dependenciesHash!==await fingerprint({...work,doc:{...work.doc,deck:next.deck}}))return blocked("CANDIDATE_STALE","The runtime or a candidate dependency changed. Generate fresh options.");
  if(record.imageHash!==digest(await fs.readFile(record.image))||record.pptxHash!==digest(await fs.readFile(record.pptx)))return blocked("CANDIDATE_CHANGED","The rendered preview or saved PowerPoint changed. Generate fresh options.");
  await writeJsonWhole(work.file, next);
  return complete({ candidate:id, artifacts:[work.file,record.image], ...(record.restyled?.length ? { restyled: record.restyled } : {}),
    message:`Candidate applied${record.restyled?.length ? `; the deck's design changed, restyling ${record.restyled.join(", ")}` : ""}. Build to emit the revised deck.` });
}
