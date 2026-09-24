#!/usr/bin/env node
// Author a deck through its page types.
//
//   node runtime/author-deck.mjs --types                 the page-type catalogue, as the author reads it
//   node runtime/author-deck.mjs --schema                the JSON Schema for a pages file
//   node runtime/author-deck.mjs --example <type>        the worked example page(s) of a type
//   node runtime/author-deck.mjs <id>.pages.json --log   what the author runs so far found, and what recurred
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
import { compilePage, describeTypes, pageSchema, structureOf, architectureOf, SHAPES, breadthProblem } from "./page-types.mjs";
import { deriveContent } from "./derive-content.mjs";
import { runContentGates } from "./gates/content_gates.mjs";
import { varietyFindings, evidenceDepth } from "./gates/variety_gates.mjs";
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
  // Pages that fail to compose are set aside and reported; the rest are still
  // composed and checked, so one broken page does not hide every other finding.
  try { const result = composeAll(copy, baseDir, { partial: true }); return { deck: result.deck, pageErrors: result.pageErrors ?? [] }; }
  catch (error) { return { error: `the deck does not compose - ${error.message}`, pageErrors: error.pageErrors }; }
}

/**
 * Compile a pages document into a deck spec. Throws with every impossible
 * page and the choice to make - or, `partial`, leaves those pages out and
 * returns their errors as `compileErrors`, so the pages that do compile are
 * still composed, gated and budgeted in the same run. One page that did not
 * compile used to hide every other finding, and every budget line with them.
 */
export function compileDeck(doc, { insights = null, draft = false, partial = false } = {}) {
  if (!doc || typeof doc !== "object" || !doc.deck || !Array.isArray(doc.pages)) throw new Error("A pages file is { deck: {...}, pages: [...] }");
  if (doc.deck.slides || doc.deck.appendix) throw new Error("`deck` carries the deck-level keys only; the pages go in `pages` and `appendix`");
  const errors = [];
  const compile = (list, offset = 0) => list.map((page, i) => {
    let slide;
    try { slide = compilePage(page, offset + i, { insights, draft }); } catch (error) { errors.push(error.message); return null; }
    // Every key checked now, on every page, rather than one at a time by the build.
    const unknown = Object.keys(slide).filter((key) => !(key in SLIDE_KEYS));
    if (!unknown.length) return slide;
    errors.push(`${slide.id ?? `page ${offset + i + 1}`}: unknown page key${unknown.length === 1 ? "" : "s"} ${unknown.map((k) => `\`${k}\``).join(", ")} - a key the composer does not read (an exhibit's own props go inside the exhibit)`);
    return null;
  });
  const slides = compile(doc.pages).filter(Boolean);
  const appendix = compile(doc.appendix || [], doc.pages.length).filter(Boolean);
  if (partial) {
    const spec = { ...doc.deck, slides, ...(appendix.length ? { appendix } : {}) };
    return { spec, findings: varietyFindings(spec, { structureOf }), compileErrors: errors };
  }
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
 * can carry (page-types.mjs TYPE_SHAPES), and how wide that data is (`breadth`
 * or `data`), which a chart-bearing shape must be to carry a page at all.
 */
export async function readInsights(baseDir, stem) {
  const raw = await fs.readFile(path.join(baseDir, `${stem}.insights.json`), "utf8").catch(() => null);
  if (raw === null) return null;
  const items = JSON.parse(raw).insights || [];
  const unshaped = items.filter((item) => !SHAPES[item.shape]).map((item) => item.id ?? "?");
  if (unshaped.length) throw new Error(`The insight log records no data shape for ${unshaped.join(", ")}: give each insight a \`shape\` - one of ${Object.keys(SHAPES).join(", ")} - so the pages can be checked against the evidence they rest on`);
  // A shape is only as good as its breadth: a four-year "series" or a
  // three-member "peer set" becomes a chart page too thin to argue anything.
  // Every narrow insight is named at once, before a page rests on it.
  const narrow = items.map(breadthProblem).filter(Boolean);
  if (narrow.length) throw new Error(`The insight log's data is too narrow for ${narrow.length} insight${narrow.length === 1 ? "" : "s"}:\n- ${narrow.join("\n- ")}`);
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
    if (run.error || ![0, 2].includes(run.status)) return { findings: [], advisories: [], budget: [], ran: false };
    const report = JSON.parse(readFileSync(out, "utf8"));
    const withId = (f) => { const slide = f.slide ? deck.slides[f.slide - 1] : null; return { ...f, id: slide ? slide.sourceSlideId ?? slide.id : undefined }; };
    // Each page's budget as the build measures it: words against its floor and
    // ceiling, the footer's share, how much of the body it fills. Printed before
    // the author edits, so a fix does not push the page across a line unseen.
    const budgetOut = path.join(dir, "budget.json");
    const budgetRun = spawnSync(python, [fileURLToPath(new URL("./gates/page_gates.py", import.meta.url)), scene, "--budget", "--report", budgetOut], { encoding: "utf8" });
    const budget = !budgetRun.error && [0, 2].includes(budgetRun.status) ? (() => { try { const b = JSON.parse(readFileSync(budgetOut, "utf8")); return Array.isArray(b) ? b : b.budget ?? b.pages ?? []; } catch { return []; } })() : [];
    // Advisories are listed in the summary: a thin page the build will note
    // should be seen by the author first.
    return { ran: true, budget, findings: (report.findings || []).filter((f) => f.severity === "blocker").map(withId),
      advisories: (report.findings || []).filter((f) => f.severity !== "blocker" && f.slide).map(withId) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** Compile, compose in memory, and gate the composed pages: what the CLI runs. */
export async function authorDeck(doc, { baseDir, insights = null, draft = false } = {}) {
  const { spec, compileErrors } = compileDeck(doc, { insights, draft, partial: true });
  const composed = await composeForAuthoring(spec, baseDir);
  if (composed.error) { const error = new Error([...compileErrors, composed.error].join("\n- ")); error.pageErrors = [...compileErrors, ...(composed.pageErrors ?? [composed.error])]; throw error; }
  const pageId = (message) => message.match(/^(?:Cannot render )?([^:\s]+):/)?.[1];
  // A page that did not compile is left out of everything after; the variety
  // contract reads the pages that did, so it is re-read once they all do.
  const failed = [...compileErrors.map((message) => ({ code: "COMPILE", id: pageId(message), repair: message })),
    ...(composed.pageErrors || []).map((message) => ({ code: "PAGE_DOES_NOT_COMPOSE", id: pageId(message), repair: message }))];
  const failedIds = new Set(failed.map((f) => f.id).filter(Boolean));
  const scene = sceneGateFindings(composed.deck);
  // A draft has no copy yet, so the page gates - words, tables, footers - are
  // reported there, not enforced; the structure rules hold either way.
  return { spec, deck: composed.deck, failedIds, compiled: !compileErrors.length, findings: [...failed, ...varietyFindings(spec, { structureOf }), ...(draft ? [] : scene.findings)],
    pageGateAdvisories: [...(draft ? scene.findings : []), ...scene.advisories], pageGatesRan: scene.ran, budget: scene.budget ?? [] };
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
        : t.type === "statement" && t.form === "statement" ? "text" : t.type === "numbers" && !ex ? "metrics" : ex?.type === "chart-group" && ex.aligned ? "chart.bar" : ex?.type ?? "text";
      Object.assign(record, {
        exhibit, architecture: architectureOf(slide), why: t.why, pageType: `${t.type}/${t.form}`, commentary: t.commentary,
        treatment: t.type === "scorecard" ? t.form : ex?.type === "table" ? (ex.treatment ?? "standard") : undefined,
        annotation: (ex?.annotations || []).length ? "callout" : (ex?.highlights || []).length ? "highlight" : "none",
        anchors: [...(slide.points || []).filter((p) => p && typeof p === "object" && p.icon).map((p) => ({ icon: p.icon })),
          ...(slide.photo ? [{ photo: slide.photo.alt ?? "photo" }] : []), ...(slide.pictures || []).map((p) => ({ photo: p.alt ?? p.label ?? "photo" }))],
        highlight: slide.highlight, insight: t.takeaway ? "rule" : t.commentary === "so-what-bar" ? "band" : "none",
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
  // Every run is logged beside the pages file. A finding that comes back run
  // after run is the cost this tool exists to cut: it names a limit the author
  // could not see or a message that did not say what to do, and belongs in the
  // skill as a published budget or a better check (taste-review.md).
  const logPath = path.join(dir, `${stem}.author-log.jsonl`);
  const runs = (await fs.readFile(logPath, "utf8").catch(() => "")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  if (args.includes("--log")) {
    const seen = new Map();
    for (const run of runs) for (const f of run.findings) { const key = `${f.code}${f.id ? ` [${f.id}]` : ""}`; seen.set(key, (seen.get(key) || 0) + 1); }
    console.log(JSON.stringify({ runs: runs.length, clean: runs.filter((r) => r.ok).length, recurring: Object.fromEntries([...seen].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])) }, null, 1));
    process.exit(0);
  }
  const log = async (entry) => fs.appendFile(logPath, JSON.stringify({ at: new Date().toISOString(), run: runs.length + 1, mode: args.includes("--draft") ? "draft" : "full", ...entry }) + "\n");
  // One run reports everything: every page that cannot compile or compose,
  // then every rule of the variety contract and of the content plan the deck
  // breaks. The author fixes them together and runs it again.
  let compiled;
  try { compiled = await authorDeck(doc, { baseDir: dir, insights: await readInsights(dir, stem), draft: args.includes("--draft") }); }
  catch (error) {
    await log({ ok: false, findings: (error.pageErrors ?? [error.message]).map((message) => ({ code: "COMPILE", id: message.split(":")[0], message })) });
    console.error(error.message); process.exit(2);
  }
  const { spec, deck, findings, pageGateAdvisories = [], failedIds = new Set(), budget = [] } = compiled;
  // One line per analytical page: body words against floor and ceiling, the
  // footer's share, and any band of the page the render will call empty (the
  // build's INTERNAL_VOID and DEAD_BAND, measured on the scene); "!" marks a
  // line to act on. A bare "fills 22%" with no bar beside it was read past.
  const ledger = budget.filter((b) => b.floor).map((b) => {
    const flag = b.body < b.floor || (b.ceiling && b.body > b.ceiling) || (b.footerRatio ?? 0) > 0.3 || b.void ? "! " : "  ";
    // A column's band is named with its column: the page's rows pass, so a
    // bare "empty band" would send the author looking across the whole page.
    const band = !b.void ? "" : b.columnVoid
      ? `, empty band in the ${b.columnVoid.column} column ${b.columnVoid.to - b.columnVoid.from}px (y ${b.columnVoid.from}-${b.columnVoid.to})`
      : `, empty ${b.internalVoid >= b.deadBand ? "band inside the body" : "band under the body"} ${Math.round(Math.max(b.internalVoid, b.deadBand) * 720)}px`;
    return `${flag}${String(b.id ?? b.slide).padEnd(6)} ${String(b.readingTask ?? "").padEnd(24)} ${b.body} words (floor ${Math.round(b.floor)}${b.ceiling ? `, ceiling ${b.ceiling}` : ""})` +
      `${b.footer ? `, footer ${Math.round((b.footerRatio ?? 0) * 100)}%` : ""}${band}`;
  });
  const content = deriveContent(spec, deck);
  // A page that did not compose has no text to plan; its composition error is its finding.
  const contentReport = runContentGates({ ...content, pages: content.pages.filter((p) => !failedIds.has(p.id)) }, { required: true });
  // A draft is the title spine with its page types: the pages can still be
  // short of words, and the content plan is written but marked a draft.
  const draft = args.includes("--draft");
  const WORDS = new Set(["TEXT_COVERAGE_LOW", "TEXT_PLAN_INCOMPLETE"]);
  const blocking = [...findings, ...(contentReport.findings || []).filter((f) => (f.severity === "blocker" || f.severity === "blocking") && !(draft && WORDS.has(f.code)))];
  // The message is kept, so `--log` can say which limit keeps coming back.
  await log({ ok: !blocking.length, findings: blocking.map((f) => ({ code: f.code, ...(f.id ?? f.page ? { id: String(f.id ?? f.page) } : {}), ...(f.repair ?? f.reason ? { message: String(f.repair ?? f.reason).slice(0, 300) } : {}) })) });
  if (blocking.length) {
    console.error(`The deck is not ready; nothing was written. ${blocking.length} finding${blocking.length === 1 ? "" : "s"} to fix in ${path.basename(file)}:\n${report(blocking)}${ledger.length ? `\n\nPage budgets:\n${ledger.join("\n")}` : ""}`);
    process.exit(2);
  }
  const typed = spec.slides.filter((s) => s.pageType);
  const mix = (key) => Object.fromEntries([...typed.reduce((m, s) => m.set(s.pageType[key], (m.get(s.pageType[key]) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
  // What the chart pages plot, against strong decks' ~22 a page: the numbers
  // behind EVIDENCE_DEPTH, printed on every run so a thin deck is seen before it is gated.
  const depth = evidenceDepth([...spec.slides, ...(spec.appendix || [])]);
  const summary = { ...(draft ? { draft: true } : {}), pages: typed.length, types: mix("type"), commentary: mix("commentary"), closes: typed.filter((s) => s.pageType.takeaway || s.pageType.commentary === "so-what-bar").length,
    plotted: { chartPages: depth.chartPages, median: depth.median, range: [depth.min, depth.max], thinnest: depth.thinnest, strongDecks: "about 22 a chart page, the middle half 10 to 48" },
    advisories: [...(contentReport.findings || []).filter((f) => !["blocker", "blocking"].includes(f.severity) || (draft && WORDS.has(f.code))), ...pageGateAdvisories]
      .map((f) => `${f.code}${f.id ? ` [${f.id}]` : ""}`)
      .concat(typed.flatMap((s) => (s.pageType.advisories || []).map((a) => `${a.split(":")[0]} [${s.id}]: ${a.slice(a.indexOf(":") + 2)}`))) };
  if (draft) content.textContract = "draft";
  if (ledger.length && (args.includes("--check") || draft)) console.error(`Page budgets:\n${ledger.join("\n")}\n`);
  if (args.includes("--check")) { console.log(JSON.stringify({ ok: true, ...summary }, null, 1)); process.exit(0); }
  await fs.writeFile(path.join(dir, `${stem}.deck.json`), JSON.stringify(spec, null, 1) + "\n");
  await fs.writeFile(path.join(dir, `${stem}.plan.json`), JSON.stringify(planOf(spec), null, 1) + "\n");
  await fs.writeFile(path.join(dir, `${stem}.content.json`), JSON.stringify(content, null, 1) + "\n");
  console.log(JSON.stringify({ deck: `${stem}.deck.json`, plan: `${stem}.plan.json`, content: `${stem}.content.json`, ...summary }, null, 1));
}
