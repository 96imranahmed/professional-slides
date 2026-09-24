#!/usr/bin/env node
// Author a deck through its page types.
//
//   node runtime/author-deck.mjs --types                 the page-type catalogue, as the author reads it
//   node runtime/author-deck.mjs --schema                the JSON Schema for a pages file
//   node runtime/author-deck.mjs <id>.pages.json         compile to <id>.deck.json and <id>.plan.json
//   node runtime/author-deck.mjs <id>.pages.json --check compile and gate, write nothing
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
import { compilePage, describeTypes, pageSchema, structureOf, architectureOf } from "./page-types.mjs";
import { varietyFindings } from "./gates/variety_gates.mjs";
import { SLIDE_KEYS, budgetFindings } from "./compose.mjs";

/** The plan's thin pages by id, for the variety contract. */
export function thinPages(spec) {
  return budgetFindings(spec).filter((f) => f.code === "THIN_PLAN" && f.slide)
    .map((f) => ({ id: spec.slides[f.slide - 1]?.id, words: f.measured, floor: f.threshold })).filter((f) => f.id);
}

/** Compile a pages document into a deck spec. Throws on the first impossible page, with the choice to make. */
export function compileDeck(doc) {
  if (!doc || typeof doc !== "object" || !doc.deck || !Array.isArray(doc.pages)) throw new Error("A pages file is { deck: {...}, pages: [...] }");
  if (doc.deck.slides || doc.deck.appendix) throw new Error("`deck` carries the deck-level keys only; the pages go in `pages` and `appendix`");
  const errors = [];
  const compile = (list, offset = 0) => list.map((page, i) => {
    try { return compilePage(page, offset + i); } catch (error) { errors.push(error.message); return null; }
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
  return { spec, findings: varietyFindings(spec, { structureOf, thin: thinPages(spec) }) };
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

const report = (findings) => findings.map((f) => `  ${f.code}  ${JSON.stringify(f.measured)}\n    ${f.repair}`).join("\n");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--types")) { console.log(describeTypes()); process.exit(0); }
  if (args.includes("--schema")) { console.log(JSON.stringify(pageSchema(), null, 2)); process.exit(0); }
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) { console.error("Usage: author-deck.mjs <id>.pages.json [--check] | --types | --schema"); process.exit(1); }
  const doc = JSON.parse(await fs.readFile(path.resolve(file), "utf8"));
  let compiled;
  try { compiled = compileDeck(doc); } catch (error) { console.error(error.message); process.exit(2); }
  const { spec, findings } = compiled;
  if (findings.length) {
    console.error(`The deck breaks the variety contract; nothing was written. Revisit these choices in ${path.basename(file)}:\n${report(findings)}`);
    process.exit(2);
  }
  const content = spec.slides.filter((s) => s.pageType);
  const mix = (key) => Object.fromEntries([...content.reduce((m, s) => m.set(s.pageType[key], (m.get(s.pageType[key]) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
  if (args.includes("--check")) { console.log(JSON.stringify({ ok: true, pages: content.length, types: mix("type"), commentary: mix("commentary") }, null, 1)); process.exit(0); }
  const dir = path.dirname(path.resolve(file));
  const stem = spec.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  await fs.writeFile(path.join(dir, `${stem}.deck.json`), JSON.stringify(spec, null, 1) + "\n");
  await fs.writeFile(path.join(dir, `${stem}.plan.json`), JSON.stringify(planOf(spec), null, 1) + "\n");
  console.log(JSON.stringify({ deck: `${stem}.deck.json`, plan: `${stem}.plan.json`, pages: content.length, types: mix("type"), commentary: mix("commentary"),
    closes: content.filter((s) => s.pageType.takeaway).length }, null, 1));
}
