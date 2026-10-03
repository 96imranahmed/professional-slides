#!/usr/bin/env node
// Author a deck through its page types.
//
//   node runtime/author-deck.mjs --types                 the page-type catalogue, as the author reads it
//   node runtime/author-deck.mjs --schema [type]         the JSON Schema for a pages file, or for one type's page
//   node runtime/author-deck.mjs --icons                 the icon names a page can ask for, with their aliases
//   node runtime/author-deck.mjs --example <type>[/<form>]  the worked example page(s) of a type, or of one form
//   node runtime/author-deck.mjs [<id>.pages.json] --scaffold <type> [--evidence <insight-id>] [--id <page-id>]
//                                                        a page of that type that compiles, to fill in; with an
//                                                        insight, its data in the exhibit and its id as `evidence`
//   node runtime/author-deck.mjs <id>.pages.json --log   what the author runs so far found, and what recurred
//   node runtime/author-deck.mjs <id>.pages.json         compile to <id>.deck.json and <id>.plan.json; warns when
//                                                        the storyline gate in out/ (or --out <dir>) is not ready
//   node runtime/author-deck.mjs <id>.pages.json --check compile and gate, write nothing
//   node runtime/author-deck.mjs <id>.pages.json --repair-relation <page-id>
//                                                        the one exhibit that sets a page's split measures on one
//                                                        scale, built from the page's own exhibits, to paste in
//   node runtime/author-deck.mjs <id>.pages.json --draft the spine only - titles, claims, page types, the insights
//                                                        each page rests on, the request - for the storyline
//                                                        critique; exhibit data, copy, word floors and the variety
//                                                        contract are reported, not enforced, until the full compile
//
// A pages file is `{ deck: { ...deck-level keys }, sources?: { key: { name, url, status } }, pages: [...], appendix?: [...] }`.
// Every analytical page names its `type` and makes that type's choices -
// `form` and `commentary` - and says `why`; structural pages are
// `{ kind: "section" | "agenda", ... }`. The compiler writes each page's
// structure from its choices (page-types.mjs), then reads the whole deck
// against the variety contract (gates/variety_gates.mjs). A deck that breaks
// the contract is not written: the findings say which choices to revisit, and
// the author revisits them in the pages file, where they are cheap to change.
//
// A revision (`workflow: "existing_deck_revision"`) starts from the pages file
// runtime/import-deck.py writes from the user's PPTX: each imported slide keeps
// its stable id and carries its old copy as `draft` until it is mapped to a
// page type. The deck records the inventory it was imported from.
//
// The plan record the build gates is derived here too, from the same choices,
// so the plan describes the deck that exists rather than the one intended.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UsageError, isMain, parseCli, pythonBin, readJson, readJsonSync, runCli, writeJson } from "./cli.mjs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { SHAPES, TYPE_SHAPES, breadthProblem } from "./evidence.mjs";
import { compilePage, describeTypes, pageSchema, structureOf, drawnOf, architectureOf, PAGE_TYPES,
  typesForShape, titleGap, dataKeys } from "./page-types.mjs";
import { deriveContent, wordBudgetOf } from "./derive-content.mjs";
import { textWords } from "./text-contract.mjs";
import { runContentGates } from "./gates/content_gates.mjs";
import { varietyFindings, evidenceDepth, structureMix, typeSequence, VARIETY } from "./gates/variety_gates.mjs";
import { SLIDE_KEYS } from "./compose.mjs";
import { composeAll } from "./compose-all.mjs";
import { autoFillLogos } from "./fetch-logos.mjs";
import { autoFillPictures } from "./fetch-pictures.mjs";
import { autoFillPlaces } from "./fetch-places.mjs";
import { storylineWarning, insightGradeProblems, unsupportedPillars } from "./storyline.mjs";
import { deckStatementFindings } from "./review-passes.mjs";
import { ICONS, ICON_NAMES, ICON_ALIASES } from "./icons.mjs";
import * as WEIGHT from "./weight.mjs";
import { sceneDesignFindings } from "./validate-overlap.mjs";
import { hasMeasures, measureProblems, measureRegistry, unmeasuredInsights } from "./measures.mjs";
import { alternativesOf, analysisInsights, analysisLine, readAnalysis, ANALYSIS_OPS } from "./analysis.mjs";
import { dependencyFindings, relationRepair, requiredCitations } from "./gates/dependency_gates.mjs";

export const REVISION = "existing_deck_revision";

/** The codes authoring raises beyond the variety contract's and the page gates', each with what it is about. */
export const AUTHORING_CODES = Object.freeze({
  TITLE_GAP_SHARE: "too many titles state what the evidence cannot settle instead of the way it leans",
  GENERATOR_SIGNATURE: "one value of a page field written the same on most pages, stamped rather than chosen",
  PILLAR_UNSUPPORTED: "a section whose pages rest on no strong insight",
  REVISION_UNMAPPED: "an imported slide still carrying only its old copy, not yet given a page type",
  REVISION_INVENTORY_MISSING: "a revision's source inventory is not beside its pages file",
  MEASURES_MISSING: "an insight whose evidence is numbers records no `measures`, so nothing can be computed from it or checked against it",
  ANALYSIS_REQUIRED: "a deck that compares declared players has no computed comparison of them on common measures",
  ANALYSIS_UNRESTED: "a computed analysis that no page rests on",
  // Advisories, raised by the page-type compiler (page-types.mjs) and listed in the author's summary.
  TITLE_COUNT_ONLY: "a title that states a count with no comparator or consequence",
  POINT_UNMARKED: "a commentary point with no figure to mark and no highlighted phrase",
});
// The content plan's rules on the copy, which a draft reports and the full compile holds.
const COPY_CODES = /^TEXT_|^CONTENT_(?:ADDS_NOTHING|NO_HIGHLIGHT)$/;

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

/** Every problem with the pages file's `sources` registry, as sentences. */
export function registryProblems(sources) {
  if (sources === undefined) return [];
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return ["`sources` is a registry - { key: { name, url, status } }"];
  return Object.entries(sources).flatMap(([key, entry]) => {
    if (!entry || typeof entry !== "object" || typeof entry.name !== "string" || !entry.name.trim()) return [`source "${key}" needs its \`name\` - the publisher and title as the citation prints them`];
    const extra = Object.keys(entry).filter((k) => !["name", "url", "status"].includes(k));
    return [...(extra.length ? [`source "${key}": unknown key${extra.length === 1 ? "" : "s"} ${extra.join(", ")} - a source is { name, url, status }`] : []),
      ...["url", "status"].filter((k) => entry[k] !== undefined && typeof entry[k] !== "string").map((k) => `source "${k}": \`${k}\` is text`)];
  });
}

/** A page still carrying an imported slide's old copy, not yet given a page type. */
const unmapped = (page) => page && typeof page === "object" && page.draft !== undefined && !page.type && !page.kind;

/**
 * Compile a pages document into a deck spec. Throws with every impossible
 * page and the choice to make - or, `partial`, leaves those pages out and
 * returns their errors as `compileErrors`, so the pages that do compile are
 * still composed, gated and budgeted in the same run: one page that does not
 * compile hides no other finding and no budget line.
 *
 * `draft` compiles the spine: a page whose exhibit or copy is not ready is
 * compiled with that refusal recorded (`pageType.deferred`), and only the
 * spine's own rules refuse it. `spineFindings` are the deck-level rules on
 * the spine - the request, the titles, the insights, generated metadata -
 * which hold in a draft as in a full compile; `findings` are the variety
 * contract's.
 */
export function compileDeck(doc, { insights = null, draft = false, partial = false } = {}) {
  if (!doc || typeof doc !== "object" || !doc.deck || !Array.isArray(doc.pages)) throw new Error("A pages file is { deck: {...}, pages: [...] }");
  if (doc.deck.slides || doc.deck.appendix) throw new Error("`deck` carries the deck-level keys only; the pages go in `pages` and `appendix`");
  const registry = registryProblems(doc.sources);
  if (registry.length) throw new Error(`The \`sources\` registry is not valid:\n- ${registry.join("\n- ")}`);
  // The deck-level fields the reviews read may sit beside `deck` as well as on it.
  const deckKeys = Object.fromEntries(["request", "waivers", "rulesVersion"].filter((key) => doc[key] !== undefined && doc.deck[key] === undefined).map((key) => [key, doc[key]]));
  doc = { ...doc, deck: { ...doc.deck, ...deckKeys } };
  const revision = doc.deck.workflow === REVISION;
  const errors = [], waiting = [];
  const measured = measureRegistry(insights);
  const compile = (list, offset = 0) => list.map((page, i) => {
    if (unmapped(page)) {
      if (revision) { waiting.push(page.id ?? `page ${offset + i + 1}`); return null; }
      errors.push(`${page.id ?? `page ${offset + i + 1}`}: \`draft\` is an imported slide's old copy, which only a revision (\`workflow: "${REVISION}"\`) carries; give the page its \`type\` and write its copy`);
      return null;
    }
    let slide;
    const { page: authored, dependencies } = withoutDependencies(page, measured);
    try { slide = compilePage(authored, offset + i, { insights, draft, spine: draft, players: doc.deck.players, sources: doc.sources, rules: doc.deck }); } catch (error) { errors.push(error.message); return null; }
    if (dependencies && slide.pageType) {
      slide.pageType.dependencies = dependencies.declared;
      if (dependencies.claim && slide.pageType.content?.settles) slide.pageType.content.settles = { ...slide.pageType.content.settles, ...dependencies.claim };
    }
    // Every key checked now, on every page, rather than one at a time by the build.
    const unknown = Object.keys(slide).filter((key) => !(key in SLIDE_KEYS));
    if (!unknown.length) return slide;
    errors.push(`${slide.id ?? `page ${offset + i + 1}`}: unknown page key${unknown.length === 1 ? "" : "s"} ${unknown.map((k) => `\`${k}\``).join(", ")} - a key the composer does not read (an exhibit's own props go inside the exhibit)`);
    return null;
  });
  const slides = compile(doc.pages).filter(Boolean);
  const appendix = compile(doc.appendix || [], doc.pages.length).filter(Boolean);
  const spec = { ...doc.deck, ...(doc.sources ? { sources: doc.sources } : {}),
    // The rules the deck was authored under; a revised deck keeps the version it records.
    ...(doc.deck.rulesVersion === undefined && WEIGHT.RULES_VERSION !== undefined ? { rulesVersion: WEIGHT.RULES_VERSION } : {}),
    slides, ...(appendix.length ? { appendix } : {}) };
  // A revision recorded under an older rules version hears the spine rules introduced since as advisories.
  const spineFindings = [...WEIGHT.applyRulesVersion(deckSpineFindings(doc, insights), doc.deck), ...(waiting.length ? [{ code: "REVISION_UNMAPPED", severity: draft ? "advisory" : "blocker", pages: waiting,
    repair: `${waiting.length} imported slide${waiting.length === 1 ? " carries" : "s carry"} only their old copy (${waiting.join(", ")}): map each to a page type by its stable id - \`type\`, \`form\`, \`commentary\`, \`why\` and the exhibit its evidence needs (\`--scaffold <type>\` prints one; the inventory holds the slide's table cells and chart values) - or delete it from \`pages\` to drop the slide` }] : [])];
  if (partial) return { spec, findings: varietyFindings(spec, { structureOf, drawnOf }), spineFindings, compileErrors: errors, unmapped: waiting };
  if (errors.length) {
    const error = new Error(`${errors.length} page${errors.length === 1 ? "" : "s"} could not be compiled:\n- ${errors.join("\n- ")}`);
    error.pageErrors = errors;
    throw error;
  }
  return { spec, findings: varietyFindings(spec, { structureOf, drawnOf }), spineFindings, unmapped: waiting };
}

/**
 * A page as the compiler reads it, with its dependency declarations set
 * aside: each exhibit's and metric's `basis` (gates/dependency_gates.mjs) is
 * the author's statement about the evidence, not a prop the composer draws.
 * `declared` is what the page's record keeps - the storyline critique is
 * bound to it - and `claim` the measures and relation of a `settles` written
 * without its kind, which the insights then supply. A page that cites no
 * source takes its citation from the measures it plots, where they carry one.
 */
export function withoutDependencies(pageIn, registry = new Map()) {
  if (!pageIn || typeof pageIn !== "object" || !pageIn.type) return { page: pageIn, dependencies: null };
  const page = structuredClone(pageIn);
  const take = (item) => { if (!item || typeof item !== "object" || item.basis === undefined) return null; const { basis } = item; delete item.basis; return basis; };
  const declared = { exhibits: [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object").map(take),
    blocks: (Array.isArray(page.blocks) ? page.blocks : []).map((block) => take(block?.exhibit)),
    metrics: [...(Array.isArray(page.metrics) ? page.metrics : []), ...(page.kpi && typeof page.kpi === "object" ? [page.kpi] : [])].map(take) };
  let claim = null;
  if (page.settles && typeof page.settles === "object" && page.settles.kind === undefined && page.settles.what === undefined && (page.settles.measures || page.settles.relation)) { claim = page.settles; delete page.settles; }
  const any = claim || Object.values(declared).some((list) => list.some(Boolean));
  if (page.source === undefined && registry.size) { const keys = requiredCitations(pageIn, registry); if (keys.length) page.source = keys; }
  return { page, dependencies: any ? { declared: Object.fromEntries(Object.entries(declared).filter(([, list]) => list.some(Boolean))), claim } : null };
}

// Metadata written the same on most pages is stamped by a loop, not chosen by
// reading the page, and says nothing true about any one of them.
const SIGNATURE_FIELDS = ["why", "settles", "adds", "takeaway", "subtitle", "rail", "bar"];
export const SIGNATURE_SHARE = 0.6;
const SIGNATURE_FROM = 8;
// A title that states a gap is allowed on at most this share of the analytical
// pages; past it the deck is declining to answer (storylining.md).
export const TITLE_GAP_SHARE = 0.15;

/**
 * The deck-level rules on the spine, which hold in a draft: the user's request
 * on a new deck, the waivers' form, titles that lead with a gap, metadata
 * stamped across pages, and a pillar with no strong insight under it.
 */
export function deckSpineFindings(doc, insights = null) {
  const deck = doc.deck;
  // The request and the waivers are the deck's statements the reviews rest on,
  // checked here by the same definition the storyline and delivery use.
  const out = deckStatementFindings(deck);
  const typed = [...doc.pages, ...(doc.appendix || [])].filter((p) => p && typeof p === "object" && p.type);
  const gaps = typed.map((p) => ({ id: p.id, title: String(p.title ?? ""), gap: titleGap(p.title) })).filter((p) => p.gap);
  const allowed = Math.max(1, Math.floor(TITLE_GAP_SHARE * typed.length));
  if (gaps.length > allowed)
    out.push({ code: "TITLE_GAP_SHARE", severity: "blocker", measured: { gapTitles: gaps.length, of: typed.length }, pages: gaps.map((g) => g.id),
      repair: `${gaps.length} of ${typed.length} titles state what the evidence cannot settle rather than what it shows (at most ${allowed}): ${gaps.map((g) => `${g.id} "${g.gap}"`).join(", ")}. ` +
        "Lead each title with the finding - the way the evidence leans, with its magnitude - and move the limitation to the `subtitle` or a note. A sub-question the evidence cannot rank gets a directional lean with its confidence and the evidence that would reverse it; \"cannot rank\" is allowed once in the deck, naming the decisive missing evidence (references/storylining.md#answer-under-uncertainty)" });
  if (typed.length >= SIGNATURE_FROM) {
    const stamped = [];
    for (const field of SIGNATURE_FIELDS) {
      const counts = new Map();
      for (const page of typed) {
        const value = page[field];
        const text = typeof value === "string" ? value.trim() : value && typeof value === "object" ? JSON.stringify(value) : null;
        if (!text || (typeof value === "string" && textWords(text) < 3)) continue;
        counts.set(text, (counts.get(text) || 0) + 1);
      }
      const [value, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (n > SIGNATURE_SHARE * typed.length) stamped.push(`\`${field}\` is ${JSON.stringify(value.length > 70 ? `${value.slice(0, 67)}...` : value)} on ${n} of ${typed.length} pages`);
    }
    if (stamped.length) out.push({ code: "GENERATOR_SIGNATURE", severity: "blocker", measured: stamped,
      repair: `${stamped.join("; ")}. A value written the same on most pages was stamped, not chosen, and says nothing true about any one page: write each page's own, or leave the field out where it is optional (\`takeaway\`, \`adds\` on a page without commentary, \`settles\` where \`evidence\` derives it)` });
  }
  if (insights) {
    // A number-bearing insight records its measures: the runtime computes from
    // them (analysis.mjs) and holds each exhibit to them (dependency_gates.mjs).
    const unmeasured = unmeasuredInsights(insights);
    if (unmeasured.length) out.push({ code: "MEASURES_MISSING", severity: "blocker", pages: unmeasured,
      repair: `${unmeasured.length} insight${unmeasured.length === 1 ? " records" : "s record"} numbers only as a sentence (${unmeasured.join(", ")}): give each its \`measures\` - { name: { unit, population, periods | members | period, values | value } } - the numbers its \`calculation\` describes, as data. A sentence cannot be joined to another record, subtracted from one, or checked against the chart drawn from it (references/storylining.md#extract-the-insights-before-the-titles)` });
    const alternatives = alternativesOf(deck);
    const results = insights.analysis?.results ?? [];
    if (alternatives.length >= 2 && hasMeasures(insights)) {
      // A player is placed when a compared measure holds its number, or records why it has none;
      // a row of "not in this record" is a player the comparison never looked at.
      const placed = (r, name) => r.table.columns.some((c) => c.cells[name] && (c.cells[name].value !== null || c.cells[name].unavailable !== "not in this record"));
      const common = (r) => r.table.columns.some((c) => alternatives.filter((name) => c.cells[name]?.value !== null && c.cells[name]?.value !== undefined).length >= 2);
      const covers = (r) => r.op === "compare" && r.status !== "unavailable" && alternatives.every((name) => placed(r, name)) && common(r);
      if (!results.some(covers)) out.push({ code: "ANALYSIS_REQUIRED", severity: "blocker", measured: { players: alternatives, compared: results.filter((r) => r.op === "compare").map((r) => r.id), unplaced: [...new Set(results.filter((r) => r.op === "compare" && r.status !== "unavailable").flatMap((r) => alternatives.filter((name) => !placed(r, name))))] },
        repair: `The deck declares ${alternatives.length} players to compare (${alternatives.join(", ")}) and no computed analysis sets them all on common measures. Before the outline, write \`<id>.analysis.json\` with a \`compare\` over the measures the answer turns on - ${ANALYSIS_OPS.compare.does} - and run \`node runtime/analysis.mjs <id>.pages.json\`: each player is a member of a compared measure, with its number or with null and the reason in \`unavailable\` (a disclosed gap is a finding), at least two of them have a number on one measure, and the result says who leads under each priority. Pages then rest on the result by its id (references/storylining.md#run-the-analyses-before-the-outline)` });
    }
    const named = new Set([...doc.pages, ...(doc.appendix || [])].flatMap((p) => (Array.isArray(p?.evidence) ? p.evidence : [])));
    const unrested = results.filter((r) => r.status !== "unavailable" && !named.has(r.id)).map((r) => r.id);
    if (unrested.length) out.push({ code: "ANALYSIS_UNRESTED", severity: "advisory", pages: unrested,
      repair: `${unrested.join(", ")} ${unrested.length === 1 ? "was" : "were"} computed and no page names ${unrested.length === 1 ? "it" : "them"} in \`evidence\`: an analysis with no page is either cut or missing its page` });
    const entry = (page, appendix = false) => ({ kind: page?.kind === "section" ? "section" : page?.type ? "content" : "other", appendix,
      title: String(page?.title ?? page?.id ?? "section"), evidence: Array.isArray(page?.evidence) ? page.evidence : [] });
    const weak = unsupportedPillars([...doc.pages.map((p) => entry(p)), ...(doc.appendix || []).map((p) => entry(p, true))], insights);
    if (weak.length) out.push({ code: "PILLAR_UNSUPPORTED", severity: "blocker", pages: weak.map((p) => p.title),
      repair: `${weak.map((p) => `"${p.title}"`).join(", ")} rest${weak.length === 1 ? "s" : ""} on no \`strong\` insight: a pillar of the answer carries at least one finding that is specific, decisive and sourced. Find it (a missing analysis, not a new sentence), or merge the section into the pillar it supports` });
  }
  return out;
}

/**
 * The insight log beside the pages file, keyed by id, or null. Each insight
 * records the `shape` of the data behind it, which decides the page types it
 * can carry (page-types.mjs TYPE_SHAPES), and how wide that data is (`breadth`
 * or `data`), which a chart-bearing shape must be to carry a page at all; its
 * `strength` (strong, supporting or context) and its `soWhat` - what follows
 * for the decision - which is what makes a measurement a finding.
 */
export async function readInsights(baseDir, stem, { alternatives = [] } = {}) {
  const log = await readJson(path.join(baseDir, `${stem}.insights.json`), { optional: true });
  if (log === null) return null;
  const items = log.insights || [];
  const measured = items.flatMap(measureProblems);
  if (measured.length) throw new Error(`The insight log's measures are not valid:\n- ${measured.join("\n- ")}`);
  const unshaped = items.filter((item) => !SHAPES[item.shape]).map((item) => item.id ?? "?");
  if (unshaped.length) throw new Error(`The insight log records no data shape for ${unshaped.join(", ")}: give each insight a \`shape\` - one of ${Object.keys(SHAPES).join(", ")} - so the pages can be checked against the evidence they rest on`);
  const graded = items.flatMap(insightGradeProblems);
  if (graded.length) throw new Error(`The insight log's findings are not graded:\n- ${graded.join("\n- ")}`);
  // A shape is only as good as its breadth: a four-year "series" or a
  // three-member "peer set" becomes a chart page too thin to argue anything.
  // Every narrow insight is named at once, before a page rests on it.
  const narrow = items.map(breadthProblem).filter(Boolean);
  if (narrow.length) throw new Error(`The insight log's data is too narrow for ${narrow.length} insight${narrow.length === 1 ? "" : "s"}:\n- ${narrow.join("\n- ")}`);
  // The analyses the author asked for, run now over the log's measures: their
  // results join the log as derived insights a page can rest on, and are kept
  // on the map (`analysis`) for the spine rules and the summary.
  const analysis = await readAnalysis(baseDir, stem, log, { alternatives });
  if (analysis.problems.length) throw new Error(`The analysis plan (${stem}.analysis.json) is not valid:\n- ${analysis.problems.join("\n- ")}`);
  const derived = analysisInsights(analysis.results);
  const clash = derived.filter((d) => items.some((item) => item.id === d.id)).map((d) => d.id);
  if (clash.length) throw new Error(`The analysis plan reuses insight ids (${clash.join(", ")}): give each analysis an id of its own`);
  const map = new Map([...items, ...derived].map((item) => [item.id, item]));
  map.analysis = { plan: analysis.plan, results: analysis.results };
  return map;
}

/** For each insight, the page types its data shape can carry. */
export function insightTypes(insights) {
  const open = typesForShape(null).open;
  return Object.fromEntries([...(insights?.values() ?? [])].map((item) => [`${item.id} (${item.shape})`, typesForShape(item.shape).asking.join(", ") || `only the types that ask for no shape (${open.join(", ")})`]));
}

/**
 * The build's own page gates, run on the composed deck in one pass: title
 * length, word ceilings, missing arguments, footer-heavy pages, flat shapes -
 * every check the build makes before it renders - with each page's budget
 * from the same run. Run here they cannot surprise the author at the build;
 * only the rendered page's empty space is left for the build to find.
 * Blocking findings and advisories; `ran: false` with the reason when Python
 * or the gates could not run, which the CLI says aloud.
 */
export function sceneGateFindings(deck, python = pythonBin(), spec = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "author-gates-"));
  try {
    const scene = path.join(dir, "scene.json"), out = path.join(dir, "gates.json"), budgetOut = path.join(dir, "budget.json");
    writeFileSync(scene, JSON.stringify(deck));
    // A deck that records no version (absent, or null) is held to the current rules, so no flag is sent.
    const rules = [...(spec.workflow ? ["--workflow", String(spec.workflow)] : []), ...(spec.rulesVersion !== undefined && spec.rulesVersion !== null ? ["--rules-version", String(spec.rulesVersion)] : [])];
    const run = spawnSync(python, [fileURLToPath(new URL("./gates/page_gates.py", import.meta.url)), scene, "--report", out, "--budget-report", budgetOut, ...rules], { encoding: "utf8" });
    if (run.error || ![0, 2].includes(run.status) || !existsSync(out))
      return { findings: [], advisories: [], budget: [], ran: false, reason: String(run.error?.message ?? run.stderr ?? `exit ${run.status}`).trim().split("\n").slice(-3).join(" ") || `exit ${run.status}` };
    const report = readJsonSync(out);
    const withId = (f) => { const slide = f.slide ? deck.slides[f.slide - 1] : null; return { ...f, id: slide ? slide.sourceSlideId ?? slide.id : undefined }; };
    // Each page's budget as the build measures it: words against its floor and
    // ceiling, the footer's share, how much of the body it fills. Printed before
    // the author edits, so a fix does not push the page across a line unseen.
    const budget = (() => { const b = readJsonSync(budgetOut, { optional: true }) ?? []; return Array.isArray(b) ? b : b.budget ?? b.pages ?? []; })();
    // Advisories are listed in the summary: a thin page the build will note
    // should be seen by the author first.
    // DECK_INK is the one deck-level advisory read here: the deck's weight is
    // a construction habit, and the author can still change it page by page.
    return { ran: true, budget, findings: (report.findings || []).filter((f) => f.severity === "blocker").map(withId),
      advisories: (report.findings || []).filter((f) => f.severity !== "blocker" && (f.slide || f.code === "DECK_INK")).map(withId) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/**
 * Compile, compose in memory, and gate the composed pages: what the CLI runs.
 * A draft is the spine: its compile and spine findings block, and everything
 * the copy settles - composition, the variety contract, the page gates - is
 * reported beside it.
 */
export async function authorDeck(doc, { baseDir, insights = null, draft = false } = {}) {
  const { spec, compileErrors, spineFindings, unmapped: waiting } = compileDeck(doc, { insights, draft, partial: true });
  const composed = await composeForAuthoring(spec, baseDir);
  if (composed.error && !draft) { const error = new Error([...compileErrors, composed.error].join("\n- ")); error.pageErrors = [...compileErrors, ...(composed.pageErrors ?? [composed.error])]; throw error; }
  const pageId = (message) => message.match(/^(?:Cannot render )?([^:\s]+):/)?.[1];
  // A page that did not compile is left out of everything after; the variety
  // contract reads the pages that did, so it is re-read once they all do.
  const compiled = compileErrors.map((message) => ({ code: "COMPILE", id: pageId(message), repair: message }));
  const composing = (composed.pageErrors || []).map((message) => ({ code: "PAGE_DOES_NOT_COMPOSE", id: pageId(message), repair: message }));
  const failedIds = new Set([...compiled, ...composing].map((f) => f.id).filter(Boolean));
  const inventory = spec.workflow === REVISION && spec.inventory && baseDir && !existsSync(path.resolve(baseDir, String(spec.inventory)))
    ? [{ code: "REVISION_INVENTORY_MISSING", repair: `The deck records its source inventory as "${spec.inventory}", which is not beside the pages file; run runtime/import-deck.py again or correct the path` }] : [];
  const scene = composed.deck ? sceneGateFindings(composed.deck, undefined, spec) : { findings: [], advisories: [], budget: [], ran: false, reason: composed.error };
  // The build's scene design checks - a label a line runs through, a numeral
  // on its rule, a scatter with no key - read on the scene composed here, so
  // the author meets them at the page rather than at the build.
  const design = composed.deck ? WEIGHT.applyRulesVersion(sceneDesignFindings(composed.deck), spec) : [];
  scene.findings = [...scene.findings, ...design.filter((f) => f.severity === "blocker")];
  scene.advisories = [...scene.advisories, ...design.filter((f) => f.severity !== "blocker")];
  // A rule the deck predates (a revision under an older rules version) comes
  // back from the contract as an advisory, and is reported, not enforced.
  const contract = varietyFindings(spec, { structureOf, drawnOf });
  const variety = contract.filter((f) => f.severity === "blocker"), varietyAdvisories = contract.filter((f) => f.severity !== "blocker");
  const spine = spineFindings.filter((f) => f.severity !== "advisory");
  // What each claim and exhibit rests on, held to the measures it names
  // (gates/dependency_gates.mjs): enforced with the copy, since a draft's
  // exhibits are not yet written.
  const depends = insights ? WEIGHT.applyRulesVersion(dependencyFindings(doc, insights), spec) : [];
  const dependencies = depends.filter((f) => f.severity === "blocker"), dependencyAdvisories = depends.filter((f) => f.severity !== "blocker");
  return { spec, deck: composed.deck ?? { slides: [] }, failedIds, compiled: !compileErrors.length, unmapped: waiting,
    findings: [...compiled, ...spine, ...inventory, ...(draft ? [] : [...dependencies, ...composing, ...variety, ...scene.findings])],
    // A draft has no copy yet: what the copy settles is reported, not enforced.
    pageGateAdvisories: [...(draft ? [...dependencies, ...composing, ...variety, ...scene.findings] : []), ...dependencyAdvisories, ...varietyAdvisories, ...spineFindings.filter((f) => f.severity === "advisory"), ...scene.advisories],
    pageGatesRan: scene.ran, pageGatesError: scene.ran ? null : scene.reason, budget: scene.budget ?? [] };
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
        ...(t.series ? { series: t.series } : {}), ...(t.sourceSlide !== undefined ? { sourceSlide: t.sourceSlide } : {}),
      });
    }
    pages.push(record);
  }
  return { schema: "professional-slides.plan/v1", id: spec.id, design: spec.design, ...(spec.workflow ? { workflow: spec.workflow } : {}),
    ...(spec.inventory ? { inventory: spec.inventory } : {}), pages };
}

const EXAMPLES = new URL("../examples/page-types.pages.json", import.meta.url);

/**
 * A page of `type` that compiles, to fill in: the worked example's shape and
 * data, with a fresh id and prompts where the page's own claim goes. With an
 * insight, the page names it as its `evidence` (which settles the claim) and
 * takes its `data` into the exhibit where the form reads it.
 */
export function scaffoldPage(type, { id = "p00", insight = null, example = readJsonSync(EXAMPLES) } = {}) {
  if (!PAGE_TYPES[type]) throw new Error(`No page type "${type}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  const source = [...example.pages, ...(example.appendix || [])].find((p) => p.type === type);
  if (!source) throw new Error(`No worked example of "${type}" to scaffold from`);
  const page = structuredClone(source);
  Object.assign(page, { id, title: "(Action title: the finding and its comparator)", why: `(Why a ${type} page: ${PAGE_TYPES[type].task})` });
  delete page.subtitle;
  if (typeof page.source === "string") page.source = "(publisher, title, date)";
  if (page.settles) page.settles = { kind: page.settles.kind, what: "(What settles the claim: the data, its basis and its period)" };
  if (typeof page.adds === "string") page.adds = "(What the commentary says that the exhibit cannot)";
  if (insight) {
    const needs = TYPE_SHAPES[type];
    if (needs && !needs.includes(insight.shape))
      throw new Error(`${insight.id} is shaped as ${insight.shape}, which a ${type} page cannot rest on (it needs ${needs.join(" or ")}); ${insight.shape} carries ${typesForShape(insight.shape).asking.join(", ") || "only the types that ask for no shape"}`);
    page.evidence = [insight.id];
    delete page.settles;
    const ex = page.exhibit;
    const data = insight.data && typeof insight.data === "object" ? insight.data : null;
    if (ex && data) {
      const reads = dataKeys(`${ex.type ?? ""}`, { type, form: page.form });
      for (const key of Object.keys(data)) if (key in ex || reads.includes(key)) ex[key] = structuredClone(data[key]);
      // Marks that named the example's categories are moved to the insight's.
      const categories = Array.isArray(ex.categories) ? ex.categories.map(String) : null;
      if (categories?.length) for (const list of [ex.annotations, ex.highlights]) for (const mark of list || []) if (mark && typeof mark === "object" && mark.category !== undefined && !categories.includes(String(mark.category))) mark.category = categories.at(-1);
    }
  }
  return page;
}

const report = (findings) => findings.map((f) => `  ${f.code}${f.id || f.page ? ` [${f.id ?? f.page}]` : ""}${f.measured !== undefined ? `  ${JSON.stringify(f.measured)}` : ""}\n    ${f.repair ?? f.reason ?? ""}`).join("\n");

const USAGE = "Usage: author-deck.mjs <id>.pages.json [--check | --draft | --log | --repair-relation <page-id>] | --types | --schema [type] | --example <type> | --scaffold <type> [--evidence <insight-id>]";

/** The CLI. Returns the exit code. */
async function main(argv) {
  const { values, positionals: [file] } = parseCli(argv, { types: { type: "boolean" }, schema: { type: "string", bare: "" }, icons: { type: "boolean" },
    example: { type: "string", bare: "" }, scaffold: { type: "string" }, evidence: { type: "string" }, id: { type: "string" }, out: { type: "string" },
    log: { type: "boolean" }, check: { type: "boolean" }, draft: { type: "boolean" }, "repair-relation": { type: "string", valueName: "a page id" } }, { usage: USAGE });
  const say = (text) => process.stdout.write(`${text}\n`);
  if (values.types) { say(describeTypes()); return 0; }
  if (values.schema !== undefined) {
    try { say(JSON.stringify(pageSchema(values.schema || null), null, 2)); return 0; } catch (error) { console.error(error.message); return 1; }
  }
  // The icon vocabulary, and the other words each name answers to.
  if (values.icons) {
    const aliases = Object.entries(ICON_ALIASES).reduce((m, [alias, icon]) => m.set(icon, [...(m.get(icon) || []), alias]), new Map());
    say(ICON_NAMES.map((name) => `${name.padEnd(12)} ${ICONS[name].label}${aliases.has(name) ? ` (also: ${aliases.get(name).join(", ")})` : ""}`).join("\n"));
    return 0;
  }
  // The worked example of one type, to copy the shape of rather than learn it from errors.
  if (values.example !== undefined) {
    // `<type>` prints every worked page of the type; `<type>/<form>` the page of one form.
    const [type, form] = values.example.split("/");
    const example = readJsonSync(EXAMPLES);
    const pages = [...example.pages, ...(example.appendix || [])].filter((p) => p.type === type && (!form || p.form === form));
    if (!pages.length) {
      const forms = [...new Set([...example.pages, ...(example.appendix || [])].filter((p) => p.type === type).map((p) => p.form))];
      console.error(form && forms.length ? `No worked example of "${type}/${form}"; ${type}'s worked forms: ${forms.join(", ")}`
        : `No worked example of "${type}"; types: ${[...new Set(example.pages.map((p) => p.type).filter(Boolean))].join(", ")}`);
      return 1;
    }
    say(JSON.stringify(pages, null, 1)); return 0;
  }
  if (values.scaffold !== undefined) {
    const type = values.scaffold, evidence = values.evidence;
    let insight = null;
    if (evidence) {
      const dir = file ? path.dirname(path.resolve(file)) : process.cwd();
      const stem = file ? ((await readJson(path.resolve(file))).deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "")) : null;
      const log = stem ? await readInsights(dir, stem).catch((error) => { console.error(error.message); return null; }) : null;
      insight = log?.get(evidence) ?? { id: evidence };
      if (!log?.get(evidence)) console.error(`${evidence} is not in ${stem ? `${stem}.insights.json` : "an insight log (name the pages file to read the log beside it)"}; the scaffold names it as its evidence without its data`);
    }
    let page;
    try { page = scaffoldPage(type, { id: values.id ?? "p00", insight }); } catch (error) { console.error(error.message); return 1; }
    say(JSON.stringify(page, null, 1));
    try { compilePage(page, 0, { insights: insight?.shape ? new Map([[insight.id, insight]]) : null }); }
    catch (error) { console.error(`The scaffold does not compile yet: ${error.message}`); return 2; }
    return 0;
  }
  if (!file) throw new UsageError(USAGE);
  const doc = await readJson(path.resolve(file));
  const dir = path.dirname(path.resolve(file));
  const stem = doc.deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  // Every run is logged beside the pages file. A finding that comes back run
  // after run is the cost this tool exists to cut: it names a limit the author
  // could not see or a message that did not say what to do, and belongs in the
  // skill as a published budget or a better check (taste-review.md).
  const logPath = path.join(dir, `${stem}.author-log.jsonl`);
  const runs = (await fs.readFile(logPath, "utf8").catch(() => "")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  // The one exhibit that shows a page's split measures on one basis, built
  // from the page's own exhibits and checked to keep every number they plot.
  if (values["repair-relation"] !== undefined) {
    const page = [...doc.pages, ...(doc.appendix || [])].find((p) => p?.id === values["repair-relation"]);
    if (!page) { console.error(`No page "${values["repair-relation"]}" in ${path.basename(file)}`); return 1; }
    const repair = relationRepair(page, await readInsights(dir, stem, { alternatives: alternativesOf(doc.deck) }));
    if (!repair) { console.error(`${page.id}: no two measures of its claim, in one unit, are drawn in separate exhibits whose series this can merge`); return 2; }
    say(JSON.stringify(repair, null, 1));
    return 0;
  }
  if (values.log) {
    const seen = new Map();
    for (const run of runs) for (const f of run.findings) { const key = `${f.code}${f.id ? ` [${f.id}]` : ""}`; seen.set(key, (seen.get(key) || 0) + 1); }
    say(JSON.stringify({ runs: runs.length, clean: runs.filter((r) => r.ok).length, recurring: Object.fromEntries([...seen].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])) }, null, 1));
    return 0;
  }
  const draft = Boolean(values.draft);
  const log = async (entry) => fs.appendFile(logPath, JSON.stringify({ at: new Date().toISOString(), run: runs.length + 1, mode: draft ? "draft" : "full", ...entry }) + "\n");
  // One run reports everything: every page that cannot compile or compose,
  // then every rule of the variety contract and of the content plan the deck
  // breaks. The author fixes them together and runs it again.
  let compiled, insights = null;
  try { insights = await readInsights(dir, stem, { alternatives: alternativesOf(doc.deck) }); compiled = await authorDeck(doc, { baseDir: dir, insights, draft }); }
  catch (error) {
    await log({ ok: false, findings: (error.pageErrors ?? [error.message]).map((message) => ({ code: "COMPILE", id: message.split(":")[0], message })) });
    console.error(error.message); return 2;
  }
  const { spec, deck, findings, pageGateAdvisories = [], failedIds = new Set(), budget = [], pageGatesRan, pageGatesError } = compiled;
  // The page gates are the build's; when they cannot run here the author is
  // told so, rather than handed a clean run that checked nothing.
  if (!pageGatesRan) console.error(`page gates did not run: ${pageGatesError || "no reason given"}\n  (the build runs them; \`node runtime/doctor.mjs\` finds a Python that can)\n`);
  // One line per analytical page: body words against floor and ceiling, the
  // footer's share, and any band of the page the render will call empty (the
  // build's INTERNAL_VOID and DEAD_BAND, measured on the scene); "!" marks a
  // line to act on. A number with no bar beside it is read past.
  // A page the scene says will read light (SCENE_INK) carries its estimated
  // ink on its line, only then: the number is a prompt to give the exhibit its
  // surfaces, not a target to write toward.
  const light = new Map(pageGateAdvisories.filter((f) => f.code === "SCENE_INK" && f.id).map((f) => [String(f.id), f]));
  const ledger = budget.filter((b) => b.floor).map((b) => {
    const ink = light.get(String(b.id ?? ""));
    const mark = b.body < b.floor || (b.ceiling && b.body > b.ceiling) || (b.footerRatio ?? 0) > 0.3 || b.void || ink ? "! " : "  ";
    // A column's band is named with its column: the page's rows pass, so a
    // bare "empty band" would send the author looking across the whole page.
    const band = !b.void ? "" : b.columnVoid
      ? `, empty band in the ${b.columnVoid.column} column ${b.columnVoid.to - b.columnVoid.from}px (y ${b.columnVoid.from}-${b.columnVoid.to})${b.line ? ` ≈ ${Math.floor((b.columnVoid.to - b.columnVoid.from) / b.line)} lines` : ""}`
      : `, empty ${b.internalVoid >= b.deadBand ? "band inside the body" : "band under the body"} ${Math.round(Math.max(b.internalVoid, b.deadBand) * 720)}px` +
        (b.line ? ` ≈ ${Math.floor(Math.max(b.internalVoid, b.deadBand) * 720 / b.line)} lines` : "");
    // The room at the foot of each column, in lines of body text: a column
    // page filled by trial swings from empty to over to empty a point at a
    // time. Printed when some column has a line to give.
    const written = (b.columns || []).filter((c) => c.text);
    const room = written.some((c) => c.lines >= 1)
      ? `, room: ${written.map((c) => `${c.column} ${c.lines >= 1 ? `${c.free}px ≈ ${c.lines} line${c.lines === 1 ? "" : "s"}` : "full"}`).join(", ")}` : "";
    // The floor the page would carry with its commentary placed the other way:
    // points beside or below make it a page read with its commentary
    // (derive-content.mjs readingTaskOf), which sets a higher floor.
    const other = String(b.readingTask ?? "").match(/^(.+)-(led|with-commentary)$/);
    const alt = other && wordBudgetOf(`${other[1]}-${other[2] === "led" ? "with-commentary" : "led"}`, null, spec.density);
    const moved = alt ? `; ${other[2] === "led" ? "with points beside or below" : "with no points (rail, captions, callouts)"} floor ${alt.floor}` : "";
    return `${mark}${String(b.id ?? b.slide).padEnd(6)} ${String(b.readingTask ?? "").padEnd(24)} ${b.body} words (floor ${Math.round(b.floor)}${b.ceiling ? `, ceiling ${b.ceiling}` : ""}${moved})` +
      `${b.footer ? `, footer ${Math.round((b.footerRatio ?? 0) * 100)}%` : ""}${band}${room}` +
      `${ink ? `, light: ink ~${(ink.measured * 100).toFixed(1)}% of the body (floor ${Math.round(ink.threshold * 100)}%) - keep the house surfaces on, set loose text as a table or cards, or pair the lone chart; not more words` : ""}`;
  });
  const content = deriveContent(spec, deck);
  // A page that did not compose has no text to plan; its composition error is its finding.
  // The deck's workflow and rules version decide which content rules it predates.
  const contentReport = runContentGates({ ...content, pages: content.pages.filter((p) => !failedIds.has(p.id)) }, { required: true, deck: spec });
  // A draft is the spine: the content plan's rules on claims and the answer
  // hold, and its rules on the copy - words, blocks, what the commentary adds -
  // are reported rather than enforced.
  const held = (f) => (f.severity === "blocker" || f.severity === "blocking") && !(draft && COPY_CODES.test(f.code));
  const blocking = [...findings, ...(contentReport.findings || []).filter(held)];
  // The message is kept, so `--log` can say which limit keeps coming back.
  await log({ ok: !blocking.length, findings: blocking.map((f) => ({ code: f.code, ...(f.id ?? f.page ? { id: String(f.id ?? f.page) } : {}), ...(f.repair ?? f.reason ? { message: String(f.repair ?? f.reason).slice(0, 300) } : {}) })) });
  if (blocking.length) {
    console.error(`The deck is not ready; nothing was written. ${blocking.length} finding${blocking.length === 1 ? "" : "s"} to fix in ${path.basename(file)}:\n${report(blocking)}${ledger.length ? `\n\nPage budgets:\n${ledger.join("\n")}` : ""}`);
    return 2;
  }
  const typed = spec.slides.filter((s) => s.pageType);
  const mix = (key) => Object.fromEntries([...typed.reduce((m, s) => m.set(s.pageType[key], (m.get(s.pageType[key]) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
  // What the chart pages plot, against strong decks' ~22 a page: the numbers
  // behind EVIDENCE_DEPTH, printed on every run so a thin deck is seen before it is gated.
  const depth = evidenceDepth([...spec.slides, ...(spec.appendix || [])]);
  // The types in page order (VARIETY_TYPE_RUN blocks past two in a row).
  const sequence = typeSequence(typed);
  // The deck as drawn: every skeleton and how often, and the two shares the
  // contract holds (VARIETY_PANELS, VARIETY_COLUMN), printed on every run so a
  // deck drifting toward one exhibit and a column is seen before it is gated.
  const drawn = structureMix([...spec.slides, ...(spec.appendix || [])], { drawnOf });
  const pct = (x) => `${Math.round(x * 100)}%`;
  const summary = { ...(draft ? { draft: true } : {}), pages: typed.length, types: mix("type"), sequence, commentary: mix("commentary"), closes: typed.filter((s) => s.pageType.takeaway || s.pageType.commentary === "so-what-bar").length,
    structure: { twoPlusExhibits: `${drawn.multi.pages} of ${drawn.pages} (${pct(drawn.multi.share)}; floor ${pct(VARIETY.multiShareMin)}, strong decks a quarter to a third)`,
      exhibitBesideColumn: `${drawn.column.pages} of ${drawn.pages} (${pct(drawn.column.share)}; cap ${pct(VARIETY.columnShareMax)}, strong decks about one in eight)${drawn.column.pages ? `: ${drawn.column.ids.join(", ")}` : ""}`,
      skeletons: drawn.skeletons },
    plotted: { chartPages: depth.chartPages, median: depth.median, range: [depth.min, depth.max], thinnest: depth.thinnest, strongDecks: "about 22 a chart page, the middle half 10 to 48" },
    // Which types each insight's data can carry: chosen here, before a page is written against the wrong shape.
    ...(insights && (draft || values.check) ? { insightTypes: insightTypes(insights) } : {}),
    // What the runtime computed from the log's measures, and what it could not: each line a result a page can rest on by its id.
    ...(insights?.analysis?.results?.length ? { analyses: insights.analysis.results.map(analysisLine) } : {}),
    ...(pageGatesRan ? {} : { pageGates: `did not run: ${pageGatesError || "no reason given"}` }),
    advisories: [...(contentReport.findings || []).filter((f) => !held(f)), ...pageGateAdvisories]
      .map((f) => `${f.code}${f.id ? ` [${f.id}]` : ""}`)
      .concat(typed.flatMap((s) => (s.pageType.advisories || []).map((a) => `${a.split(":")[0]} [${s.id}]: ${a.slice(a.indexOf(":") + 2)}`))) };
  if (draft) content.textContract = "draft";
  if (ledger.length && (values.check || draft)) console.error(`Page budgets:\n${ledger.join("\n")}\n`);
  if (values.check) { say(JSON.stringify({ ok: true, ...summary }, null, 1)); return 0; }
  await writeJson(path.join(dir, `${stem}.deck.json`), spec);
  await writeJson(path.join(dir, `${stem}.plan.json`), planOf(spec));
  await writeJson(path.join(dir, `${stem}.content.json`), content);
  if (insights?.analysis?.plan) await writeJson(path.join(dir, `${stem}.analysis-results.json`), { schema: "professional-slides.analysis-results/v1", id: stem, results: insights.analysis.results });
  say(JSON.stringify({ deck: `${stem}.deck.json`, plan: `${stem}.plan.json`, content: `${stem}.content.json`, ...summary }, null, 1));
  // The full copy belongs after the storyline gate: said on every full compile
  // while the gate is not ready (out/ beside the pages file, or --out), never enforced here.
  if (!draft) {
    const story = await storylineWarning(spec, path.resolve(values.out ?? path.join(dir, "out")), { deckPath: path.join(dir, `${stem}.deck.json`) });
    if (story) console.error(story);
  }
  return 0;
}

if (isMain(import.meta.url)) runCli(main);
