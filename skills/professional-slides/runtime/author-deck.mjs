#!/usr/bin/env node
// Compile a pages file into the deck the build composes.
//
//   node runtime/author-deck.mjs <id>.pages.json            compile, check every page and write <id>.deck.json
//   node runtime/author-deck.mjs <id>.pages.json --check    the same checks; nothing is written
//        --render                                           with --check: the deck emitted and rendered by the build's own
//                                                           stages in a temporary folder, its findings filed with the rest
//                                                           and each page's image kept in out/check/ to look at
//        --page <id>[,<id>...]                              with --check: those pages' findings (and only they rendered)
//        --fetch-assets                                     fetch the planned logos, flags, photographs and illustrations
//                                                           into assets/ first, so the check composes the pages with them
//   node runtime/author-deck.mjs --types                    the page types and their forms
//   node runtime/author-deck.mjs --schema [<type>[/<form>] | <exhibit kind> | kinds | deck]
//                                                           the fields a page, a form, an exhibit kind or the deck takes
//   node runtime/author-deck.mjs [<id>.pages.json] --limits [<type>[/<form>]]
//                                                           every countable limit, under the deck's density
//   node runtime/author-deck.mjs --icons                    the icon names a page can ask for
//   node runtime/author-deck.mjs [<id>.pages.json] --example <type>[/<form>]
//   node runtime/author-deck.mjs [<id>.pages.json] --scaffold <type>[/<form>] [--id <page-id>]
//                                                           a worked page to copy the shape of, closed by its limits
//
// Each page names its type and form (page-types.mjs), and its numbers are written by reference to the insight log's
// measures where the deck has one (bind.mjs). Every finding is about a page or about the numbers: a page that does not
// compile, compose or fit, text that overlaps, a reference that does not bind, two pages that print different values of
// one thing, a revision's carried slide that cannot be carried. A deck with none is written; a deck with any is not, and
// every finding is listed in the one run. A revision of an imported deck carries its untouched slides as they are
// (revision.mjs). Exit 0 when the deck is written or a check is clean, 2 when a finding blocks, 1 on a usage error.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isMain, parseCli, pythonBin, readJson, readJsonSync, runCli, UsageError, writeJson } from "./cli.mjs";
import { compilePage, describeTypes, pageSchema, PAGE_TYPES } from "./page-types.mjs";
import { SLIDE_KEYS } from "./compose-page.mjs";
import { composeAll } from "./compose-all.mjs";
import { autoFillLogos } from "./fetch-logos.mjs";
import { autoFillFlags } from "./fetch-flags.mjs";
import { autoFillPictures } from "./fetch-pictures.mjs";
import { autoFillPlaces } from "./fetch-places.mjs";
import { assetFindings, assetNotice } from "./asset-needs.mjs";
import { carriedEntries, carriedFindings, carriedProblem, isCarried, revisionChanges, revisionLine, revisionRecordFindings, revisionStatement, stampKept, unheldLine, withImportedCredits } from "./revision.mjs";
import { ICONS, ICON_NAMES, ICON_ALIASES } from "./icons.mjs";
import { deckLimits, pageLimits } from "./limits.mjs";
import { comparesTooLittle } from "./chart-sense.mjs";
import { readPagesFile, withParts, compiledFrom, staleCompile } from "./pages-file.mjs";
import { exhibitKinds, formFields, kindFields, unreadKeys } from "./form-fields.mjs";
import { sceneDesignFindings } from "./validate-overlap.mjs";
import { insightLogRefusal, measureConflicts, measureRegistry, readInsightLog } from "./measures.mjs";
import { metricsOf, primaryCitations, requiredCitations, untracedFindings } from "./page-numbers.mjs";
import { consistencyFindings } from "./gates/consistency_gates.mjs";
import { buildDeck } from "./build-deck.mjs";
import { isRefusal } from "./errors.mjs";
import { bindDeck, withPlaceholders } from "./bind.mjs";
import { deckKeyProblems, deckSchema } from "./deck-keys.mjs";
import { logSources, registryProblems } from "./sources-registry.mjs";

export { registryProblems } from "./sources-registry.mjs";

export const REVISION = "existing_deck_revision";

const isBlocker = (f) => f.severity === "blocker" || f.severity === "blocking";
const idOfMessage = (message) => String(message).match(/^(?:Cannot render )?([^:\s]+):/)?.[1];
// An imported slide still carrying its old copy, not yet given a type or carried as it is.
const unmapped = (page) => page && typeof page === "object" && page.draft !== undefined && !page.type && !page.kind;
const idAt = (page, index) => String(page?.id ?? `page-${index + 1}`);

/**
 * The deck composed in memory, as the build will compose it: logos, flags,
 * photographs and places filled from what is already on disk (nothing is
 * fetched). Every page that fails to compose is reported in the same run
 * (compose-all.mjs), and the rest are composed and checked. `slideCache` is
 * the composer's memory of the deck's slides (openComposeCache).
 */
export async function composeForAuthoring(spec, baseDir, { slideCache = null } = {}) {
  const copy = structuredClone(spec);
  await autoFillLogos(copy, baseDir, { hint: copy.playersHint, fetchMissing: false });
  await autoFillFlags(copy, baseDir, { fetchMissing: false });
  await autoFillPictures(copy, baseDir, { fetchMissing: false });
  await autoFillPlaces(copy, baseDir, { fetchMissing: false });
  try { const result = composeAll(copy, baseDir, { partial: true, slideCache }); return { deck: result.deck, pageErrors: result.pageErrors ?? [], tableSplits: result.tableSplits ?? [] }; }
  catch (error) { return { error: `the deck does not compose - ${error.message}`, pageErrors: error.pageErrors }; }
}

/**
 * A page as the compiler reads it, with each exhibit's and each figure's
 * `basis` set aside: the measures the runtime bound it to are a record, not a
 * prop the composer draws. A page that cites no source takes its citation
 * from the measures it plots and the ones its tokens print (`printed`), where
 * they carry one.
 */
export function withoutDependencies(pageIn, registry = new Map(), printed = []) {
  if (!pageIn || typeof pageIn !== "object" || !pageIn.type) return { page: pageIn, dependencies: null };
  const page = structuredClone(pageIn);
  const take = (item) => { if (!item || typeof item !== "object" || item.basis === undefined) return null; const { basis } = item; delete item.basis; return basis; };
  const declared = { exhibits: [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object").map(take),
    blocks: (Array.isArray(page.blocks) ? page.blocks : []).map((block) => take(block?.exhibit)),
    metrics: metricsOf(page).map(take) };
  let claim = null;
  if (page.settles && typeof page.settles === "object" && page.settles.kind === undefined && page.settles.what === undefined && (page.settles.measures || page.settles.relation)) { claim = page.settles; delete page.settles; }
  const any = claim || Object.values(declared).some((list) => list.some(Boolean));
  if (page.source === undefined && registry.size) { const keys = requiredCitations(pageIn, registry, [...printed]); if (keys.length) page.source = keys; }
  return { page, dependencies: any ? { declared: Object.fromEntries(Object.entries(declared).filter(([, list]) => list.some(Boolean))), claim } : null };
}

/**
 * The pages file compiled to the deck the build reads: every page through
 * its type (page-types.mjs compilePage), its references bound first
 * (bind.mjs). `partial` returns what compiled with every refusal beside it
 * (`compileErrors`, `bindingFindings`, `failed` with each page's place and
 * message, `unmapped` for a revision's slides still to map); otherwise any
 * refusal throws, with every page's message in `pageErrors`.
 */
export function compileDeck(docIn, { insights = null, partial = false } = {}) {
  if (!docIn || typeof docIn !== "object" || !docIn.deck || !Array.isArray(docIn.pages)) throw new Error("A pages file is { deck: {...}, pages: [...] }");
  if (docIn.deck.slides || docIn.deck.appendix) throw new Error("`deck` carries the deck-level keys only; the pages go in `pages` and `appendix`");
  const registry = registryProblems(docIn.sources);
  if (registry.length) throw new Error(`The \`sources\` registry is not valid:\n- ${registry.join("\n- ")}`);
  const keyed = deckKeyProblems(docIn.deck);
  if (keyed.length) throw new Error(`The deck-level keys of \`deck\` are not valid:\n- ${keyed.join("\n- ")}`);
  const measured = measureRegistry(insights);
  const binding = bindDeck(docIn, insights);
  const doc = binding.doc;
  const revision = doc.deck.workflow === REVISION;
  const errors = [], waiting = [], refusals = new Map();
  const refuse = (index, message, more = {}) => { errors.push(message); refusals.set(index, { message, ...more }); return null; };
  const compile = (list, offset = 0) => list.map((page, i) => {
    const index = offset + i, id = idAt(page, index);
    // A carried slide is the user's own, copied by the build as it is: only its form as a carried page is checked here.
    if (isCarried(page)) {
      const problem = offset ? `${page.id ?? `page ${index + 1}`}: a carried slide keeps its place in the deck, among \`pages\`; the appendix holds pages the runtime composes` : carriedProblem(page, { revision });
      return problem ? refuse(index, problem) : null;
    }
    if (unmapped(page)) {
      if (revision) { waiting.push(page.id ?? `page ${index + 1}`); return null; }
      return refuse(index, `${page.id ?? `page ${index + 1}`}: \`draft\` is an imported slide's old copy, which only a revision (\`workflow: "${REVISION}"\`) carries; give the page its \`type\` and write its copy`);
    }
    const options = { insights, players: doc.deck.players, sources: doc.sources, rules: doc.deck };
    if (binding.bound.failed.has(id)) {
      // A page left out for a reference that does not bind is compiled for its own refusals, with its numbers stood in for.
      const stand = withPlaceholders(binding.bound.attempted.get(page) ?? page);
      try { compilePage(withoutDependencies(stand, measured).page, index, { ...options, spineOnly: /"measure"\s*:/.test(JSON.stringify(stand)) }); } catch (error) { refuse(index, error.message); }
      return null;
    }
    const { page: authored } = withoutDependencies(page, measured, binding.bound.printed.get(page));
    let slide;
    try { slide = compilePage(authored, index, { ...options, ...(measured.size ? { sourcePrimary: primaryCitations(page, measured) } : {}) }); }
    catch (error) { return refuse(index, error.message, { stage: error.stage ?? null, ...(error.code ? { code: error.code } : {}) }); }
    const unknown = Object.keys(slide).filter((key) => !(key in SLIDE_KEYS));
    if (unknown.length) return refuse(index, `${slide.id ?? `page ${index + 1}`}: unknown page key${unknown.length === 1 ? "" : "s"} ${unknown.map((k) => `\`${k}\``).join(", ")} - a key the composer does not read (an exhibit's own props go inside the exhibit)`);
    return slide;
  });
  const compiled = [...compile(doc.pages), ...compile(doc.appendix || [], doc.pages.length)];
  const slides = compiled.slice(0, doc.pages.length).filter(Boolean), appendix = compiled.slice(doc.pages.length).filter(Boolean);
  const pages = [...doc.pages, ...(doc.appendix || [])];
  const carried = revision ? carriedEntries(doc.pages, { skip: (page, index) => isCarried(page) && refusals.has(index) }) : [];
  const spec = { ...doc.deck, ...(doc.sources ? { sources: doc.sources } : {}), slides, ...(appendix.length ? { appendix } : {}), ...(carried.length ? { carried } : {}) };
  const failed = compiled.flatMap((slide, index) => (slide || (revision && unmapped(pages[index]) && !refusals.has(index)) ? [] : [
    ...(refusals.has(index) ? [{ index, id: idAt(pages[index], index), ...refusals.get(index), page: pages[index] }] : []),
    ...(binding.bound.failed.has(idAt(pages[index], index)) ? [{ index, id: idAt(pages[index], index), unbound: true, page: pages[index] }] : [])]));
  if (partial) return { spec, bindingFindings: binding.findings, compileErrors: errors, failed, unmapped: waiting };
  errors.push(...binding.findings.map((f) => f.repair));
  if (errors.length) {
    const error = new Error(`${errors.length} page${errors.length === 1 ? "" : "s"} could not be compiled:\n- ${errors.join("\n- ")}`);
    error.pageErrors = errors;
    throw error;
  }
  return { spec, unmapped: waiting };
}

/**
 * The insight log beside the pages file (`<stem>.insights.json`, its parts
 * spliced in), as a Map by id, with the log's own conflicts (`conflicts`):
 * null where the deck has none. A log the measures cannot be read from is
 * refused (measures.mjs insightLogRefusal).
 */
export async function readInsights(baseDir, stem) {
  const log = await readInsightLog(baseDir, stem);
  if (log === null) return null;
  const items = log.insights || [];
  const refusal = insightLogRefusal(items);
  if (refusal) throw new Error(refusal);
  const map = new Map(items.map((item) => [item.id, item]));
  map.conflicts = conflictFindings(items);
  return map;
}

/**
 * One measure recorded twice (measures.mjs measureConflicts): two records that
 * hold different numbers block - a page would rest on whichever the author
 * happened to name - and two that agree, or differ only in rounding, are an
 * advisory to keep one.
 */
function conflictFindings(items) {
  const where = (c, i) => `${c.refs[i]}${c.where[i] ? ` (${c.where[i]})` : ""}`;
  const cells = (c) => c.at.slice(0, 4).map((cell) => `${cell.label}: ${cell.values[0]} against ${cell.values[1]}`).join("; ") + (c.at.length > 4 ? "; ..." : "");
  const conflicts = measureConflicts(items);
  const apart = conflicts.filter((c) => c.kind === "contradiction"), agreeing = conflicts.filter((c) => c.kind !== "contradiction");
  const insightsOf = (list) => [...new Set(list.flatMap((c) => c.refs.map((ref) => ref.split("/")[0])))];
  return [
    ...(apart.length ? [{ code: "MEASURES_CONFLICT", severity: "blocker", pages: insightsOf(apart), measured: { conflicting: apart.map((c) => c.refs) },
      repair: `The insight log records ${apart.length === 1 ? "a measure" : `${apart.length} measures`} twice with different numbers - one name, population and unit, at one period or member: ${apart.map((c) => `${where(c, 0)} and ${where(c, 1)} (${cells(c)})`).join("; ")}. Keep the record its source prints, and delete or rename the other` }] : []),
    ...(agreeing.length ? [{ code: "MEASURES_CONFLICT", severity: "advisory", pages: insightsOf(agreeing), measured: { repeated: agreeing.map((c) => c.refs) },
      repair: `The insight log records ${agreeing.length === 1 ? "a measure" : `${agreeing.length} measures`} twice: ${agreeing.map((c) => `${where(c, 0)} and ${where(c, 1)}${c.kind === "precision" ? ` at different precision (${cells(c)})` : ""}`).join("; ")}. Keep one record and name it on every page` }] : []),
  ];
}

/**
 * The build's own page gates (gates/page_gates.py), run on the composed deck:
 * the checks the build makes before it renders, so none surprises the author
 * there. `{ ran, findings, advisories }`, each finding with its page's id;
 * `ran: false` with the reason where Python or the gates could not run.
 */
export function sceneGateFindings(deck, python = pythonBin()) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "author-gates-"));
  try {
    const scene = path.join(dir, "scene.json"), out = path.join(dir, "gates.json");
    // The deck's asset manifest is no gate's to read, and half the scene.
    writeFileSync(scene, JSON.stringify({ ...deck, manifest: undefined }));
    const run = spawnSync(python, [fileURLToPath(new URL("./gates/page_gates.py", import.meta.url)), scene, "--report", out], { encoding: "utf8" });
    if (run.error || ![0, 2].includes(run.status) || !existsSync(out))
      return { ran: false, findings: [], advisories: [], reason: String(run.error?.message ?? run.stderr ?? `exit ${run.status}`).trim().split("\n").slice(-3).join(" ") || `exit ${run.status}` };
    const report = readJsonSync(out);
    const withId = (f) => { const slide = f.slide ? deck.slides[f.slide - 1] : null; return { ...f, id: slide ? slide.sourceSlideId ?? slide.id : undefined }; };
    return { ran: true, findings: (report.findings || []).filter(isBlocker).map(withId), advisories: (report.findings || []).filter((f) => !isBlocker(f) && f.slide).map(withId) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/**
 * Every finding on the deck, from one run: the pages that do not compile,
 * bind or compose, what the page gates and the scene's design checks say of
 * the composed pages, what the pages print between them (consistency_gates.mjs),
 * the insight log's conflicts and untraced numbers, a revision's carried
 * slides, and what the build would fetch. `{ spec, blocking, advisories,
 * composed, complete, ... }`. `pages` (a set of ids) keeps the findings that
 * name one of those pages; the deck is still compiled and composed whole.
 */
export async function authorDeck(docIn, { baseDir = null, insights = null, pages = null, composeCache = null, python = pythonBin() } = {}) {
  // A revision is read beside the inventory of the deck it was imported from: a picture the user's own deck embedded is
  // credited to that deck, and the slides it carries are checked against the slides the inventory holds (revision.mjs).
  const imported = docIn?.deck?.workflow === REVISION && typeof docIn.deck.inventory === "string" && baseDir ? readJsonSync(path.resolve(baseDir, docIn.deck.inventory), { optional: true }) : null;
  const doc = imported ? withImportedCredits(docIn, imported) : docIn;
  const { spec, bindingFindings, failed, unmapped: waiting } = compileDeck(doc, { insights, partial: true });
  stampKept(spec, imported);
  const composed = await composeForAuthoring(spec, baseDir, { slideCache: composeCache });
  const found = [];
  const add = (list) => found.push(...list);
  add(failed.filter((f) => !f.unbound).map(({ id, message, code }) => ({ code: code ?? "COMPILE", id: idOfMessage(message) ?? id, severity: "blocker", repair: message })));
  add(unreadExhibitKeys(doc));
  add(bindingFindings);
  add(twoValueFindings(spec, composed.deck));
  for (const slide of [...(spec.slides || []), ...(spec.appendix || [])]) for (const note of slide?.pageType?.advisories ?? [])
    add([{ code: "PAGE_ADJUSTED", id: String(slide.id), severity: "advisory", repair: `${slide.id}: ${String(note).replace(/^PAGE_ADJUSTED:\s*/, "")}` }]);
  // A chart refused for what it shows says so by its own code (chart-sense.mjs, chart-line.mjs): the page composes, its chart compares nothing.
  const composeCode = (message) => String(message).match(/(?:^|: )(NO_COMPARISON|SERIES_FLAT|ONE_COMPARISON|AREA_BASELINE|RANK_FILLED): /)?.[1] ?? "PAGE_DOES_NOT_COMPOSE";
  const composing = (composed.pageErrors ?? (composed.error ? [composed.error] : [])).map((message) => ({ code: composeCode(message), id: idOfMessage(message), severity: "blocker", repair: message }));
  add(composing);
  // A page the composer drew as two slides or more: a table past the rows a page holds is continued, its title marked.
  const splitInto = new Map();
  for (const slide of composed.deck?.slides ?? []) if (slide.sourceSlideId) splitInto.set(String(slide.sourceSlideId), (splitInto.get(String(slide.sourceSlideId)) ?? 0) + 1);
  for (const [id, count] of splitInto) if (count > 1) add([{ code: "PAGE_SPLITS", severity: "advisory", id, measured: { slides: count },
    repair: `${id} is drawn as ${count} slides: its table runs past the rows one page holds, so it is continued with its header repeated. Cut it to the rows the claim compares, or keep it whole on purpose` }]);
  if (waiting.length) add([{ code: "REVISION_UNMAPPED", severity: "blocker", pages: waiting,
    repair: `${waiting.length} imported slide${waiting.length === 1 ? " carries" : "s carry"} only their old copy (${waiting.join(", ")}): keep each as it is - \`carry: true\` beside its \`draft\`, and the build copies the slide from the source deck - or give it its \`type\` and write its copy` }]);
  if (spec.workflow === REVISION && spec.inventory && baseDir && !existsSync(path.resolve(baseDir, String(spec.inventory))))
    add([{ code: "REVISION_INVENTORY_MISSING", severity: "blocker", repair: `The deck records its source inventory as "${spec.inventory}", which is not beside the pages file; run runtime/import-deck.py again or correct the path` }]);
  add([...(baseDir ? carriedFindings(spec, imported, baseDir) : []), ...revisionRecordFindings(spec)]);
  add(insights?.conflicts ?? []);
  // A number typed on a page that no measure of the log holds: advised, with the token that prints the recorded one.
  if (insights) add(untracedFindings(doc, insights));
  const revised = imported ? revisionChanges(spec, imported) : null;
  add(consistencyFindings(doc, insights, { spec, inventory: imported, changed: revised?.content ?? null }));
  const gates = composed.deck ? sceneGateFindings(composed.deck, python) : { ran: false, findings: [], advisories: [], reason: composed.error };
  add(withFormLever([...gates.findings, ...gates.advisories], doc));
  if (composed.deck) add(sceneDesignFindings(composed.deck));
  const assets = baseDir ? await assetFindings(spec, baseDir) : { statement: null, findings: [] };
  add(assets.findings);
  const about = (f) => [f.id, ...(f.pages || [])].filter((id) => id !== undefined && id !== null).map(String);
  const held = pages ? found.filter((f) => about(f).some((id) => pages.has(id))) : found;
  const listed = withParts(docIn, held);
  const complete = Boolean(composed.deck) && !failed.length && !(composed.pageErrors ?? []).length;
  // The pages that did not compile, bind or compose.
  const failedIds = new Set([...failed, ...composing].map((f) => f.id).filter((id) => id !== undefined && id !== null).map(String));
  return { spec, deck: composed.deck ?? null, composed, complete, failed, failedIds, blocking: listed.filter(isBlocker), advisories: listed.filter((f) => !isBlocker(f)),
    gates: { ran: gates.ran, reason: gates.reason ?? null }, assets: assets.statement, revision: revisionStatement(spec, imported), readAsChanged: revised };
}

/**
 * A page whose one chart draws two values in one series across the page, with no insight column beside it and no change
 * marked between them (chart-sense.mjs comparesTooLittle): refused before the render. Beside its column, as one of a
 * page's panels, or with the change between them drawn and labelled, two bars hold their place. The width is read off
 * the composed page - what the reader will see - not the placement asked for: the composer may set a short column under
 * the chart.
 */
const TWO_VALUE_CHARTS = new Set(["chart.bar", "chart.column", "chart.lollipop"]);
const SHARED_WIDTH = 0.75;
function twoValueFindings(spec, scene) {
  return [...(spec.slides || []), ...(spec.appendix || [])].flatMap((slide) => {
    const chart = slide?.exhibit;
    if (!chart || !TWO_VALUE_CHARTS.has(chart.type) || !Array.isArray(chart.categories) || !Array.isArray(chart.series)) return [];
    const drawn = scene?.slides?.find((s) => String(s.id) === String(slide.id));
    const frame = drawn?.componentInstances?.find((c) => c.id === `${slide.id}-exhibit`)?.frame;
    const body = drawn?.contentFrame;
    const shared = frame && body ? frame.width <= body.width * SHARED_WIDTH : ["exhibit-left", "exhibit-right", "sidebar"].includes(slide.layout);
    const changed = Boolean(chart.cagr) || (Array.isArray(chart.changeAnnotations) && chart.changeAnnotations.length > 0);
    const little = comparesTooLittle({ members: chart.categories.length, series: chart.series.length, shared, changed });
    return little ? [{ code: "NO_COMPARISON", id: String(slide.id), severity: "blocker", repair: `${slide.id}: ${little}` }] : [];
  });
}

/**
 * An empty band on a page whose form sets its items in rows of a count it publishes (`columns`: cards, tiles, panels a
 * row) is first that count's to close: the run that built the Spacebar deck spent three of its four rounds on the
 * generic advice before it found `columns`, which only `--schema parallel/cards` named.
 */
function withFormLever(found, doc) {
  const byId = new Map([...(doc.pages || []), ...(doc.appendix || [])].filter((page) => page?.id !== undefined && PAGE_TYPES[page.type]).map((page) => [String(page.id), page]));
  return found.map((f) => {
    const page = f.code === "SCENE_VOID" ? byId.get(String(f.id)) : null;
    if (!page) return f;
    const form = page.form ?? Object.keys(PAGE_TYPES[page.type].forms)[0];
    let count;
    try { count = formFields(page.type, form).exhibit?.columns; } catch { return f; }
    if (typeof count !== "string" || !/^(int|\d+-\d+)\b/.test(count)) return f;
    const set = page.exhibit?.columns === undefined ? "it is set by the runtime" : `it is ${page.exhibit.columns}`;
    return { ...f, repair: `On a ${page.type}/${form} page the band is closed first by \`exhibit.columns\` (${count.replace(/^int - /, "")}; ${set}): fewer a row stand taller and take the height, more a row take the width. ${f.repair}` };
  });
}

/**
 * An exhibit key nothing reads (form-fields.mjs unreadKeys), refused: read past, it was dropped without a word - the BA
 * deck's `marks: { referenceLines }` lost its reference line, and `peers` and `omits` said nothing on 34 exhibits.
 */
function unreadExhibitKeys(doc) {
  const out = [];
  for (const page of [...(doc.pages || []), ...(doc.appendix || [])]) {
    if (!page || typeof page !== "object" || !PAGE_TYPES[page.type]) continue;
    const form = page.form ?? Object.keys(PAGE_TYPES[page.type].forms)[0];
    // A labelled-rows block's exhibit names its own type, as one of `exhibits` does.
    const exhibits = [...(page.exhibit ? [[page.exhibit, "exhibit"]] : []), ...(page.exhibits || []).map((ex, i) => [ex, `exhibits[${i}]`]),
      ...(Array.isArray(page.blocks) ? page.blocks : []).map((block, i) => [block?.exhibit, `blocks[${i}].exhibit`]).filter(([ex]) => ex)];
    for (const [exhibit, where] of exhibits) {
      const typed = where !== "exhibit" || exhibit?.type !== undefined;
      for (const { key, kind } of unreadKeys(exhibit, typed ? { kind: exhibit?.type } : { type: page.type, form })) {
        const hint = key === "marks" ? ` - a mark is written at the exhibit's top level (\`referenceLines\`, \`annotations\`, ...), not under \`marks\`, which only groups them in \`--schema\``
          : ` - nothing reads it: \`node runtime/author-deck.mjs --schema ${kind}\` lists every field ${kind} reads, and a note of your own goes under a key that begins with \`$\``;
        out.push({ code: "EXHIBIT_KEY_UNREAD", id: String(page.id), severity: "blocker", repair: `${page.id}: \`${where}.${key}\` is no field of ${kind}${hint}` });
      }
    }
  }
  return out;
}

const COMPOSE_CACHE_SCHEMA = "professional-slides.compose-cache/v2";
const digest = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 24);

/** The runtime's files by name, size and modification time: a cache entry is read only under the code that wrote it. */
function runtimeStamp() {
  const runtime = path.dirname(fileURLToPath(import.meta.url));
  return [runtime, path.join(runtime, "gates")].flatMap((dir) => readdirSync(dir).filter((name) => /\.(mjs|py|json)$/.test(name)).sort().map((name) => { const at = statSync(path.join(dir, name)); return `${name}:${at.size}:${Math.round(at.mtimeMs)}`; }));
}

/** Every file under `dir` by path, size and modification time - a JSON file by its content - and none where it does not exist. */
function folderStamp(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map(String).sort().map((name) => {
    const file = path.join(dir, name), at = statSync(file);
    return !at.isFile() ? name : name.endsWith(".json") ? `${name}:${digest(readFileSync(file, "utf8"))}` : `${name}:${at.size}:${Math.round(at.mtimeMs)}`;
  });
}

/**
 * The composer's memory, `<id>.compose-cache.json` beside the pages file: each
 * slide the deck's composition compiled (core.mjs compileSlideAsWritten keys
 * it by the slide as planned, its place and the deck's tokens), under a key
 * that also holds the runtime's files, the deck's own keys and the files under
 * assets/. A check that edits one page of a hundred composes that page alone.
 * Safe to delete.
 */
async function openComposeCache(file, { doc, baseDir }) {
  const stored = await readJson(file, { optional: true }).catch(() => null);
  const before = stored?.schema === COMPOSE_CACHE_SCHEMA && stored.slides && typeof stored.slides === "object" ? stored.slides : {};
  const context = digest([runtimeStamp(), folderStamp(path.join(baseDir, "assets")), doc.deck ?? null]);
  const keyOf = (key) => digest([context, key]);
  const used = new Map();
  let fresh = 0;
  const held = (at) => used.get(at) ?? before[at] ?? null;
  return {
    has: (key) => held(keyOf(key)) !== null,
    get: (key) => { const at = keyOf(key), slide = held(at); used.set(at, slide); return slide; },
    set: (key, slide) => { used.set(keyOf(key), slide); fresh += 1; },
    // Written whole and renamed in only when something was composed, so a run that read every slide writes nothing.
    async save() {
      if (!fresh) return;
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ schema: COMPOSE_CACHE_SCHEMA, note: "The composer's slides (author-deck.mjs). Safe to delete.", slides: Object.fromEntries(used) }));
      await fs.rename(tmp, file);
    },
  };
}

/**
 * The deck emitted and rendered by the build's own stages in a temporary
 * folder, and what the build says of it. Each rendered page is kept in
 * out/check/<page id>.png beside the pages file, to look at; nothing else is
 * written there, and nothing is fetched. `named` renders those pages alone.
 */
async function renderCheck(authored, { dir, stem, named }) {
  if (!authored.complete) return { ran: false, reason: "not every page compiled and composed; the render is of the deck as the build will build it" };
  const work = mkdtempSync(path.join(os.tmpdir(), "author-render-"));
  try {
    let result;
    try { result = await buildDeck(path.join(dir, `${stem}.deck.json`), path.join(work, "out"), { fetchLogos: false, only: named, source: { spec: authored.spec, baseDir: dir } }); }
    catch (error) {
      if (!isRefusal(error)) throw error;
      return { ran: false, reason: `the build refuses the deck before it renders (${error.code})`, blockers: [{ code: error.code, severity: "blocker", repair: error.message }], advisories: [] };
    }
    const scene = readJsonSync(result.scenePath);
    const idOf = (slide) => { const page = scene.slides[Number(slide) - 1]; return page ? page.sourceSlideId ?? page.id : undefined; };
    const blockers = result.blockers.map((b) => ({ code: b.code, ...((b.id ?? idOf(b.slide)) !== undefined ? { id: b.id ?? idOf(b.slide) } : {}), severity: "blocker", source: b.source,
      repair: b.repair ?? (b.text ? `"${b.text}"` : `the build's ${b.source} blocked the deck`) }));
    const advisories = (result.gates?.findings ?? []).filter((f) => !isBlocker(f)).map((f) => ({ ...f, ...(typeof f.slide === "number" && idOf(f.slide) ? { id: idOf(f.slide) } : {}) }));
    // Each page's image under its id; a page drawn as two slides or more is <id>-2.png and on.
    let saved = null;
    if (result.render?.renders?.length) {
      saved = path.join(dir, "out", "check");
      rmSync(saved, { recursive: true, force: true });
      mkdirSync(saved, { recursive: true });
      const seen = new Map();
      result.render.renders.forEach((file, at) => {
        const id = idOf(at + 1) ?? `slide-${at + 1}`, n = (seen.get(id) ?? 0) + 1;
        seen.set(id, n);
        copyFileSync(file, path.join(saved, `${id}${n > 1 ? `-${n}` : ""}.png`));
      });
    }
    return { ran: Boolean(result.gates), reason: result.renderSkipped ?? null, slides: result.slides, timings: result.timings, blockers, advisories, saved };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

/** The planned logos, flags, photographs and illustrations fetched now into assets/, as the build fetches them. */
async function fetchAssets(doc, { insights, baseDir }) {
  const { spec } = compileDeck(doc, { insights, partial: true });
  const copy = structuredClone(spec);
  const logos = await autoFillLogos(copy, baseDir, { hint: copy.playersHint, fetchMissing: true }).catch((error) => ({ failed: [error.message] }));
  const flags = await autoFillFlags(copy, baseDir, { fetchMissing: true }).catch((error) => ({ failed: [error.message] }));
  const pictures = await autoFillPictures(copy, baseDir, { fetchMissing: true }).catch((error) => ({ failed: [error.message] }));
  const failedTo = [...(logos?.failed ?? []), ...(flags?.failed ?? []), ...(pictures?.failed ?? [])];
  const count = (n, word) => `${n ?? 0} ${word}${n === 1 ? "" : "s"}`;
  return `Assets fetched into assets/: ${count(logos?.fetched?.length, "logo")}, ${count(flags?.fetched?.length, "flag")} and ${count(pictures?.filled, "picture")} placed${failedTo.length ? `; not fetched: ${failedTo.slice(0, 6).join("; ")}${failedTo.length > 6 ? "; ..." : ""}` : ""}.`;
}

/** The sources registry the research recorded beside the insight log's parts, for a pages file with none of its own; null otherwise. */
export async function loggedSources(doc, dir, stem) {
  if (doc?.sources !== undefined) return null;
  return readInsightLog(dir, stem).then((log) => logSources(dir, log)).catch(() => null);
}

const EXAMPLE_FILES = ["../examples/page-types.pages.json", "../examples/page-forms.pages.json", "../examples/reference.pages.json"].map((file) => new URL(file, import.meta.url));

/** Every worked page, the worked deck's first, with the deck-level keys of that deck. */
export function workedExamples() {
  const files = EXAMPLE_FILES.map((file) => readJsonSync(file));
  return { deck: files[0].deck, pages: files.flatMap((file) => [...file.pages, ...(file.appendix || [])]) };
}

/**
 * A page of `type` to fill in, `{ page, form }`: the worked example of the
 * type's first form (or of `form`), with a fresh id and prompts where the
 * page's own title and source go. It compiles as it stands.
 */
export function scaffoldReport(type, { id = "p00", form = null, example = workedExamples() } = {}) {
  if (!PAGE_TYPES[type]) throw new Error(`No page type "${type}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  if (form && !Object.hasOwn(PAGE_TYPES[type].forms, form)) throw new Error(`No form "${form}" of a ${type} page; one of ${Object.keys(PAGE_TYPES[type].forms).join(", ")}`);
  const source = example.pages.find((p) => p.type === type && (!form || p.form === form));
  if (!source) throw new Error(`No worked example of "${type}${form ? `/${form}` : ""}" to scaffold from`);
  const page = structuredClone(source);
  Object.assign(page, { id, title: "(Action title: the finding and its comparator)" });
  delete page.subtitle;
  if (typeof page.source === "string") page.source = "(publisher, title, date)";
  return { page, form: source.form };
}
/** A page of `type` that compiles, as `--scaffold` prints it, without the limits block. */
export const scaffoldPage = (type, options = {}) => scaffoldReport(type, options).page;

/**
 * A page as `--scaffold` and `--example` print it: its JSON, closed by a
 * `limits` block - every countable limit the page is held to, one a line -
 * which the compiler reads past, so the page pasted whole compiles.
 */
function withLimits(page, density) {
  const limits = pageLimits(page.type, page.form, { commentary: page.commentary, density });
  const block = Object.entries(limits).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(",\n");
  return JSON.stringify(page, null, 1).replace(/\n}$/, `,\n "limits": {\n${block}\n }\n}`);
}

/** The catalogue commands - --types, --schema, --limits, --icons, --example, --scaffold - each answered with its exit code; undefined when none was asked for. */
async function catalogueCommand(values, file, say) {
  if (values.types) { say(describeTypes()); return 0; }
  if (values.schema !== undefined) {
    if (values.schema === "deck") { say(JSON.stringify(deckSchema(), null, 2)); return 0; }
    if (values.schema === "kinds") { say(JSON.stringify(exhibitKinds(), null, 1)); return 0; }
    if (values.schema.includes("/")) {
      const [type, form] = values.schema.split("/");
      try { say(JSON.stringify(formFields(type, form), null, 1)); return 0; } catch (error) { console.error(error.message); return 1; }
    }
    if (values.schema && !PAGE_TYPES[values.schema] && kindFields(values.schema)) { say(JSON.stringify(kindFields(values.schema), null, 1)); return 0; }
    try { say(JSON.stringify({ ...pageSchema(values.schema || null), ...(values.schema ? { "x-limits": pageLimits(values.schema) } : {}) }, null, 2)); return 0; }
    catch (error) { console.error(`${error.message}; or <type>/<form> for the fields a form reads, an exhibit kind (\`--schema kinds\` lists them), or deck`); return 1; }
  }
  // The limits a page is held to are those of the deck it is written for: a live pitch's are not a pre-read's.
  const scoped = file && (values.limits !== undefined || values.scaffold !== undefined || values.example !== undefined) ? await readPagesFile(file) : null;
  const density = scoped?.deck?.density;
  if (values.limits !== undefined) {
    const [type, form] = values.limits.split("/");
    try { say(JSON.stringify(type ? pageLimits(type, form, { density }) : deckLimits({ density }), null, 1)); return 0; } catch (error) { console.error(error.message); return 1; }
  }
  if (values.icons) {
    const aliases = Object.entries(ICON_ALIASES).reduce((m, [alias, icon]) => m.set(icon, [...(m.get(icon) || []), alias]), new Map());
    say(ICON_NAMES.map((name) => `${name.padEnd(12)} ${ICONS[name].label}${aliases.has(name) ? ` (also: ${aliases.get(name).join(", ")})` : ""}`).join("\n"));
    return 0;
  }
  if (values.example !== undefined) {
    // `<type>/<form>` prints that form's worked page, `<type>` one page a form, and a worked page's id that page: one JSON
    // value on the output, the other worked pages of the form named on the error stream. Every variant printed in full ran a
    // lookup table to six pages and 676 lines.
    const example = workedExamples();
    const byId = example.pages.find((p) => p.id === values.example);
    const [type, form] = byId ? [byId.type, byId.form] : values.example.split("/");
    const all = byId ? [byId] : example.pages.filter((p) => p.type === type && (!form || p.form === form));
    const worked = byId ? all : all.filter((p, at) => all.findIndex((q) => q.form === p.form) === at);
    if (!worked.length) {
      const forms = [...new Set(example.pages.filter((p) => p.type === type).map((p) => p.form))];
      console.error(form && forms.length ? `No worked example of "${type}/${form}"; ${type}'s worked forms: ${forms.join(", ")}`
        : `No worked example of "${type}"; types: ${[...new Set(example.pages.map((p) => p.type).filter(Boolean))].join(", ")}`);
      return 1;
    }
    say(form || byId ? withLimits(worked[0], density) : `[\n${worked.map((page) => withLimits(page, density).replace(/^/gm, " ")).join(",\n")}\n]`);
    // The notes follow the page: read through one pipe, the error stream ran ahead of the page still being written.
    await new Promise((resolve) => process.stdout.write("", resolve));
    const others = all.filter((p) => !worked.includes(p));
    if (others.length) console.error(`Other worked pages: ${others.map((p) => `${p.id} (${p.form}${p.exhibit?.columns ? ", " + p.exhibit.columns.length + " columns" : ""})`).join(", ")} - \`--example <id>\` prints one.`);
    // A worked example types its numbers, having no insight log to draw them from; a deck that has one names the measure instead.
    if (worked.some((p) => p.exhibit || p.exhibits || p.metrics || p.kpi)) console.error("With measures in the insight log, write the numbers by reference: an exhibit's `series: [{ measure: \"<insight id>/<measure>\", name }]`, a figure's `measure`, or a `{{<insight id>/<measure>@<period or member> | 0.0}}` token in the copy.");
    return 0;
  }
  if (values.scaffold !== undefined) {
    const [type, form] = String(values.scaffold).split("/");
    let page;
    try { page = scaffoldReport(type, { id: values.id ?? "p00", form: form || null }).page; } catch (error) { console.error(error.message); return 1; }
    say(withLimits(page, density));
    return 0;
  }
  return undefined;
}

/** The findings as the author reads them: a block a finding, the code and the page it names over what to do. */
function findingsText(findings) {
  return findings.map((f) => {
    const where = f.id !== undefined && f.id !== null ? `${f.id}${f.part ? ` in ${f.part}` : ""}` : (f.pages || []).slice(0, 8).join(", ");
    return `  ${f.code}${where ? ` [${where}]` : ""}\n    ${String(f.repair ?? f.message ?? f.text ?? "").replace(/\n/g, "\n    ")}`;
  }).join("\n");
}

/** The advisories, a line each: what the author may act on, none of it holding the deck back. */
function advisoryLines(advisories) {
  return advisories.map((f) => {
    const ids = [...new Set([f.id, ...(f.pages || [])].filter((id) => id !== undefined && id !== null).map(String))];
    return `  ${f.code}${ids.length ? ` [${ids.slice(0, 8).join(", ")}${ids.length > 8 ? ", ..." : ""}]` : ""}: ${String(f.repair ?? f.message ?? "").replace(/\s+/g, " ")}`;
  }).join("\n");
}

/**
 * What a run that writes no deck.json says of the one on disk: whether it is
 * these pages, older pages the build refuses (DECK_OLDER_THAN_PAGES), a deck
 * that records no pages, or none.
 */
async function deckOnDisk({ dir, stem }) {
  const onDisk = await readJson(path.join(dir, `${stem}.deck.json`), { optional: true }).catch(() => null);
  return !onDisk ? "missing" : !onDisk.compiledFrom ? "unrecorded" : staleCompile(onDisk, dir) ? "stale" : "current";
}

const USAGE = "Usage: author-deck.mjs <id>.pages.json [--check [--render] [--page <id>[,<id>...]]] [--fetch-assets] | --types | --schema [<type>[/<form>] | kinds | deck] | [<id>.pages.json] --limits [<type>[/<form>]] | --icons | [<id>.pages.json] --example <type>[/<form>] | <worked-page-id> | [<id>.pages.json] --scaffold <type>[/<form>] [--id <page-id>]";

async function main(argv) {
  const { values, positionals: [file] } = parseCli(argv, { types: { type: "boolean" }, schema: { type: "string", bare: "" }, icons: { type: "boolean" }, limits: { type: "string", bare: "" },
    example: { type: "string", bare: "" }, scaffold: { type: "string" }, id: { type: "string" }, check: { type: "boolean" }, render: { type: "boolean" },
    page: { type: "string", valueName: "one or more page ids, comma-separated" }, "fetch-assets": { type: "boolean" } }, { usage: USAGE });
  const say = (text) => process.stdout.write(`${text}\n`);
  const listed = await catalogueCommand(values, file, say);
  if (listed !== undefined) return listed;
  if (!file) throw new UsageError(USAGE);
  if (values.render && !values.check) throw new UsageError(`--render renders a check: --check --render\n${USAGE}`);
  let doc;
  try { doc = await readPagesFile(file); } catch (error) { console.error(error.message); return 2; }
  const dir = path.dirname(path.resolve(file));
  const stem = doc.deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  const named = values.page === undefined ? null : new Set(String(values.page).split(",").map((id) => id.trim()).filter(Boolean));
  const known = new Set([...doc.pages, ...(doc.appendix || [])].map((page, index) => idAt(page, index)));
  const strangers = [...(named ?? [])].filter((id) => !known.has(id));
  if (named && (!named.size || strangers.length)) { console.error(named.size ? `No page ${strangers.map((id) => `"${id}"`).join(", ")} in ${path.basename(file)}; its pages are ${[...known].join(", ")}` : "--page names one or more page ids, comma-separated"); return 1; }
  if (named && !values.check) throw new UsageError(`--page checks those pages: --check --page <id>[,<id>...]\n${USAGE}`);
  // A pages file with no `sources` registry reads the one the research recorded beside the insight log's parts.
  if (doc.sources === undefined) {
    const logged = await loggedSources(doc, dir, stem);
    if (logged?.problems.length) { console.error(`The insight log's sources files cannot be read as the deck's registry:\n- ${logged.problems.join("\n- ")}`); return 2; }
    if (logged) doc.sources = logged.registry;
  }
  let insights, authored;
  const composeCache = named ? null : await openComposeCache(path.join(dir, `${stem}.compose-cache.json`), { doc, baseDir: dir });
  try {
    insights = await readInsights(dir, stem);
    if (values["fetch-assets"]) console.error(await fetchAssets(doc, { insights, baseDir: dir }));
    authored = await authorDeck(doc, { baseDir: dir, insights, pages: named, composeCache });
  } catch (error) { console.error(error.message); return 2; }
  await composeCache?.save();
  const notice = (text) => { if (text) console.error(`${text}\n`); };
  if (authored.revision) notice(revisionLine(authored.revision));
  notice(unheldLine(authored.readAsChanged));
  if (authored.assets) notice(assetNotice(authored.assets));
  if (!authored.gates.ran) notice(`The page gates did not run: ${authored.gates.reason || "no reason given"} (the build runs them; \`node runtime/doctor.mjs\` finds a Python that can).`);
  const rendered = values.render ? await renderCheck(authored, { dir, stem, named }) : null;
  const blocking = [...authored.blocking, ...withParts(doc, rendered?.blockers ?? [])];
  const advisories = [...authored.advisories, ...withParts(doc, rendered?.advisories ?? [])];
  if (rendered) notice(rendered.ran ? `Rendered ${rendered.slides} slide${rendered.slides === 1 ? "" : "s"} with the build's stages in ${Math.round((rendered.timings?.wallMs ?? 0) / 100) / 10}s${rendered.saved ? `; each page's image is in ${path.relative(process.cwd(), rendered.saved) || rendered.saved}` : ""}.` : `Not rendered: ${rendered.reason}.`);
  if (advisories.length) notice(`Advisories (${advisories.length}; none holds the deck back):\n${advisoryLines(advisories)}`);
  const pagesOf = (spec) => spec.slides.length + (spec.appendix || []).length;
  if (blocking.length) {
    console.error(`${named ? "These pages are" : "The deck is"} not ready; nothing was written. ${blocking.length} finding${blocking.length === 1 ? "" : "s"} to fix in ${path.basename(file)}:\n${findingsText(blocking)}`);
    const onDisk = named ? null : await deckOnDisk({ dir, stem });
    if (onDisk === "stale") console.error(`\nThe ${stem}.deck.json on disk was compiled from older pages; the build refuses it (DECK_OLDER_THAN_PAGES) until a compile of these pages passes.`);
    return 2;
  }
  const counted = advisories.reduce((byCode, f) => ({ ...byCode, [f.code]: (byCode[f.code] ?? 0) + 1 }), {});
  const revision = authored.revision ? { ...authored.revision, ...(authored.readAsChanged?.unheld?.length ? { readAsChanged: authored.readAsChanged.unheld } : {}) } : null;
  const summary = { pages: pagesOf(authored.spec), advisories: counted, ...(authored.assets ? { assets: authored.assets } : {}), ...(revision ? { revision } : {}),
    ...(rendered?.saved ? { images: path.relative(dir, rendered.saved) } : {}) };
  if (values.check) {
    notice(`No ${stem}.deck.json was written: --check writes nothing. \`node runtime/author-deck.mjs ${path.basename(file)}\` writes it.`);
    say(JSON.stringify({ ok: true, ...summary, deckJson: { written: false, onDisk: await deckOnDisk({ dir, stem }) } }, null, 1));
    return 0;
  }
  // The pages file and parts it was compiled from, by hash: the build refuses this deck.json once they change (DECK_OLDER_THAN_PAGES).
  const spec = { ...authored.spec, compiledFrom: compiledFrom(doc) };
  await writeJson(path.join(dir, `${stem}.deck.json`), spec);
  say(JSON.stringify({ deck: `${stem}.deck.json`, ...summary }, null, 1));
  return 0;
}

if (isMain(import.meta.url)) runCli(main);
