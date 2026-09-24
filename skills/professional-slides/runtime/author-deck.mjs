#!/usr/bin/env node
// Author a deck through its page types.
//
//   node runtime/author-deck.mjs --types                 the page-type catalogue, as the author reads it
//   node runtime/author-deck.mjs --schema                the JSON Schema for a pages file
//   node runtime/author-deck.mjs --example <type>        the worked example page(s) of a type
//   node runtime/author-deck.mjs <id>.pages.json         compile to <id>.deck.json and <id>.plan.json
//   node runtime/author-deck.mjs <id>.pages.json --check compile and gate, write nothing
//   node runtime/author-deck.mjs <id>.pages.json --draft the title spine and page types only: the content plan's
//                                                        word floors are reported, not enforced, so the storyline
//                                                        critique can read the spine before the copy is written
//
// A pages file is `{ deck: { ...deck-level keys }, pages: [...], appendix?: [...] }`.
// Every analytical page names its `type` and makes that type's choices -
// `form`, `commentary`, `takeaway` - and says `why`; structural pages are
// `{ kind: "section" | "agenda", ... }`. The compiler writes each page's
// structure from its choices (page-types.mjs), then reads the whole deck
// against the variety contract (gates/variety_gates.mjs). A deck that breaks
// the contract is not written: the findings say which choices to revisit, and
// the author revisits them in the pages file, where they are cheap to change.
//
// The plan record the build gates is derived here too, from the same choices,
// so the plan describes the deck that exists rather than the one intended.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { compilePage, describeTypes, pageSchema, structureOf, architectureOf, SHAPES } from "./page-types.mjs";
import { deriveContent } from "./derive-content.mjs";
import { runContentGates } from "./gates/content_gates.mjs";
import { varietyFindings } from "./gates/variety_gates.mjs";
import { SLIDE_KEYS } from "./compose.mjs";
import { composeAll } from "./compose-all.mjs";
import { autoFillLogos } from "./fetch-logos.mjs";
import { autoFillPictures } from "./fetch-pictures.mjs";
import { autoFillPlaces } from "./fetch-places.mjs";

/**
 * The deck composed in memory, as the build will compose it: logos,
 * photographs and places filled from what is already on disk (nothing is
 * fetched while authoring). Every page that fails to compose is reported in
 * the same run (compose-all.mjs), and the composed pages are what the content
 * plan's text and word floors are read from, so the author sees the numbers
 * the build will see.
 */
export async function composeForAuthoring(spec, baseDir) {
  const copy = structuredClone(spec);
  await autoFillLogos(copy, baseDir, { hint: copy.playersHint, fetchMissing: false });
  await autoFillPictures(copy, baseDir, { fetchMissing: false });
  await autoFillPlaces(copy, baseDir, { fetchMissing: false });
  try { return { deck: composeAll(copy, baseDir).deck }; }
  catch (error) { return { error: `the deck does not compose - ${error.message}`, pageErrors: error.pageErrors }; }
}

/**
 * Compile a pages document into a deck spec. Throws with every impossible
 * page and the choice to make. The thin-page rule reads the plan's word
 * estimate; `authorDeck` composes the deck and reads the composed pages.
 */
export function compileDeck(doc, { insights = null, draft = false } = {}) {
  if (!doc || typeof doc !== "object" || !doc.deck || !Array.isArray(doc.pages)) throw new Error("A pages file is { deck: {...}, pages: [...] }");
  if (doc.deck.slides || doc.deck.appendix) throw new Error("`deck` carries the deck-level keys only; the pages go in `pages` and `appendix`");
  const errors = [];
  const compile = (list, offset = 0) => list.map((page, i) => {
    try { return compilePage(page, offset + i, { insights, draft }); } catch (error) { errors.push(error.message); return null; }
  });
  const slides = compile(doc.pages);
  const appendix = compile(doc.appendix || [], doc.pages.length);
  // Every key checked now, on every page, rather than one at a time by the build.
  [...slides, ...appendix].forEach((slide, i) => {
    if (!slide) return;
    const unknown = Object.keys(slide).filter((key) => !(key in SLIDE_KEYS));
    if (unknown.length) errors.push(`${slide.id ?? `page ${i + 1}`}: unknown page key${unknown.length === 1 ? "" : "s"} ${unknown.map((k) => `\`${k}\``).join(", ")} - a key the composer does not read (an exhibit's own props go inside the exhibit)`);
  });
  if (errors.length) {
    const error = new Error(`${errors.length} page${errors.length === 1 ? "" : "s"} could not be compiled:\n- ${errors.join("\n- ")}`);
    error.pageErrors = errors;
    throw error;
  }
  const spec = { ...doc.deck, slides, ...(appendix.length ? { appendix } : {}) };
  return { spec, findings: varietyFindings(spec, { structureOf }) };
}

/**
 * The insight log beside the pages file, keyed by id, or null. Each insight
 * records the `shape` of the data behind it, which decides the page types it
 * can carry (page-types.mjs TYPE_SHAPES).
 */
export async function readInsights(baseDir, stem) {
  const raw = await fs.readFile(path.join(baseDir, `${stem}.insights.json`), "utf8").catch(() => null);
  if (raw === null) return null;
  const items = JSON.parse(raw).insights || [];
  const unshaped = items.filter((item) => !SHAPES[item.shape]).map((item) => item.id ?? "?");
  if (unshaped.length) throw new Error(`The insight log records no data shape for ${unshaped.join(", ")}: give each insight a \`shape\` - one of ${Object.keys(SHAPES).join(", ")} - so the pages can be checked against the evidence they rest on`);
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * The build's own page gates, run on the composed deck: title length, word
 * ceilings, missing arguments, footer-heavy pages, flat shapes - every check
 * the build makes before it renders. Run here they cannot surprise the author
 * at the build; only the rendered page's empty space is left for the build to
 * find. Blocking findings only; without Python they are left to the build.
 */
export function sceneGateFindings(deck, python = process.env.RUNTIME_PYTHON || "python3") {
  const dir = mkdtempSync(path.join(os.tmpdir(), "author-gates-"));
  try {
    const scene = path.join(dir, "scene.json"), out = path.join(dir, "gates.json");
    writeFileSync(scene, JSON.stringify(deck));
    const run = spawnSync(python, [fileURLToPath(new URL("./gates/page_gates.py", import.meta.url)), scene, "--report", out], { encoding: "utf8" });
    if (run.error || ![0, 2].includes(run.status)) return { findings: [], ran: false };
    const report = JSON.parse(readFileSync(out, "utf8"));
    return { ran: true, findings: (report.findings || []).filter((f) => f.severity === "blocker").map((f) => {
      const slide = f.slide ? deck.slides[f.slide - 1] : null;
      return { ...f, id: slide ? slide.sourceSlideId ?? slide.id : undefined };
    }) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** Compile, compose in memory, and gate the composed pages: what the CLI runs. */
export async function authorDeck(doc, { baseDir, insights = null, draft = false } = {}) {
  const { spec } = compileDeck(doc, { insights, draft });
  const composed = await composeForAuthoring(spec, baseDir);
  if (composed.error) { const error = new Error(composed.error); error.pageErrors = composed.pageErrors ?? [composed.error]; throw error; }
  const scene = sceneGateFindings(composed.deck);
  // A draft has no copy yet, so the page gates - words, tables, footers - are
  // reported there, not enforced; the structure rules hold either way.
  return { spec, deck: composed.deck, findings: [...varietyFindings(spec, { structureOf }), ...(draft ? [] : scene.findings)],
    pageGateAdvisories: draft ? scene.findings : [], pageGatesRan: scene.ran };
}

/** The plan record (plan_gates.mjs) implied by the compiled deck. */
export function planOf(spec) {
  const pages = [];
  if (spec.cover) pages.push({ id: "cover", n: 1, kind: "cover", title: spec.cover.title, exhibit: spec.cover.image ? "image" : "text", architecture: spec.cover.image ? "picture-led" : "text", why: "The deck's cover" });
  for (const slide of [...spec.slides, ...(spec.appendix || [])]) {
    const t = slide.pageType;
    const ex = slide.exhibit ?? slide.exhibits?.[0];
    const record = { id: slide.id, n: pages.length + 1, title: slide.title };
    if (slide.kind && !t) Object.assign(record, { kind: slide.kind, exhibit: "text", architecture: "text", why: "Section structure" });
    else {
      const exhibit = t.type === "panels" ? "paired" : t.type === "matrix" ? "rows" : t.type === "picture" ? t.form : t.type === "argument" ? "text"
        : t.type === "statement" && t.form === "statement" ? "text" : t.type === "numbers" && !ex ? "metrics" : ex?.type ?? "text";
      Object.assign(record, {
        exhibit, architecture: architectureOf(slide), why: t.why, pageType: `${t.type}/${t.form}`, commentary: t.commentary,
        treatment: t.type === "scorecard" ? t.form : ex?.type === "table" ? (ex.treatment ?? "standard") : undefined,
        annotation: (ex?.annotations || []).length ? "callout" : (ex?.highlights || []).length ? "highlight" : "none",
        anchors: [...(slide.points || []).filter((p) => p && typeof p === "object" && p.icon).map((p) => ({ icon: p.icon })),
          ...(slide.photo ? [{ photo: slide.photo.alt ?? "photo" }] : []), ...(slide.pictures || []).map((p) => ({ photo: p.alt ?? p.label ?? "photo" }))],
        highlight: slide.highlight, insight: t.takeaway ? "rule" : "none",
        ...(t.series ? { series: t.series } : {}),
      });
    }
    pages.push(record);
  }
  return { schema: "professional-slides.plan/v1", id: spec.id, design: spec.design, pages };
}

const report = (findings) => findings.map((f) => `  ${f.code}${f.id || f.page ? ` [${f.id ?? f.page}]` : ""}${f.measured !== undefined ? `  ${JSON.stringify(f.measured)}` : ""}\n    ${f.repair ?? f.reason ?? ""}`).join("\n");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--types")) { console.log(describeTypes()); process.exit(0); }
  if (args.includes("--schema")) { console.log(JSON.stringify(pageSchema(), null, 2)); process.exit(0); }
  // The worked example of one type, to copy the shape of rather than learn it from errors.
  if (args.includes("--example")) {
    const type = args[args.indexOf("--example") + 1];
    const example = JSON.parse(await fs.readFile(new URL("../examples/page-types.pages.json", import.meta.url), "utf8"));
    const pages = [...example.pages, ...(example.appendix || [])].filter((p) => p.type === type);
    if (!pages.length) { console.error(`No worked example of "${type}"; types: ${[...new Set(example.pages.map((p) => p.type).filter(Boolean))].join(", ")}`); process.exit(1); }
    console.log(JSON.stringify(pages, null, 1)); process.exit(0);
  }
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) { console.error("Usage: author-deck.mjs <id>.pages.json [--check] | --types | --schema"); process.exit(1); }
  const doc = JSON.parse(await fs.readFile(path.resolve(file), "utf8"));
  const dir = path.dirname(path.resolve(file));
  const stem = doc.deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  // One run reports everything: every page that cannot compile or compose,
  // then every rule of the variety contract and of the content plan the deck
  // breaks. The author fixes them together and runs it again.
  let compiled;
  try { compiled = await authorDeck(doc, { baseDir: dir, insights: await readInsights(dir, stem), draft: args.includes("--draft") }); }
  catch (error) { console.error(error.message); process.exit(2); }
  const { spec, deck, findings, pageGateAdvisories = [] } = compiled;
  const content = deriveContent(spec, deck);
  const contentReport = runContentGates(content, { required: true });
  // A draft is the title spine with its page types: the pages can still be
  // short of words, and the content plan is written but marked a draft.
  const draft = args.includes("--draft");
  const WORDS = new Set(["TEXT_COVERAGE_LOW", "TEXT_PLAN_INCOMPLETE"]);
  const blocking = [...findings, ...(contentReport.findings || []).filter((f) => (f.severity === "blocker" || f.severity === "blocking") && !(draft && WORDS.has(f.code)))];
  if (blocking.length) {
    console.error(`The deck is not ready; nothing was written. ${blocking.length} finding${blocking.length === 1 ? "" : "s"} to fix in ${path.basename(file)}:\n${report(blocking)}`);
    process.exit(2);
  }
  const typed = spec.slides.filter((s) => s.pageType);
  const mix = (key) => Object.fromEntries([...typed.reduce((m, s) => m.set(s.pageType[key], (m.get(s.pageType[key]) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
  const summary = { ...(draft ? { draft: true } : {}), pages: typed.length, types: mix("type"), commentary: mix("commentary"), closes: typed.filter((s) => s.pageType.takeaway).length,
    advisories: [...(contentReport.findings || []).filter((f) => !["blocker", "blocking"].includes(f.severity) || (draft && WORDS.has(f.code))), ...pageGateAdvisories]
      .map((f) => `${f.code}${f.id ? ` [${f.id}]` : ""}`)
      .concat(typed.flatMap((s) => (s.pageType.advisories || []).map((a) => `${a.split(":")[0]} [${s.id}]: ${a.slice(a.indexOf(":") + 2)}`))) };
  if (draft) content.textContract = "draft";
  if (args.includes("--check")) { console.log(JSON.stringify({ ok: true, ...summary }, null, 1)); process.exit(0); }
  await fs.writeFile(path.join(dir, `${stem}.deck.json`), JSON.stringify(spec, null, 1) + "\n");
  await fs.writeFile(path.join(dir, `${stem}.plan.json`), JSON.stringify(planOf(spec), null, 1) + "\n");
  await fs.writeFile(path.join(dir, `${stem}.content.json`), JSON.stringify(content, null, 1) + "\n");
  console.log(JSON.stringify({ deck: `${stem}.deck.json`, plan: `${stem}.plan.json`, content: `${stem}.content.json`, ...summary }, null, 1));
}
