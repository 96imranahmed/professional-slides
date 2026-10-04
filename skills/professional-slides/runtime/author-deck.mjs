#!/usr/bin/env node
// Author a deck through its page types.
//
//   node runtime/author-deck.mjs --types                 the page-type catalogue, as the author reads it
//   node runtime/author-deck.mjs --schema [type]         the JSON Schema for a pages file, or for one type's page
//                                                        (with the type's countable limits as `x-limits`)
//   node runtime/author-deck.mjs --schema deck           the deck-level keys `deck` takes: each with its type and
//                                                        what it is for; the compile refuses a key not listed
//   node runtime/author-deck.mjs [<id>.pages.json] --limits [<type>[/<form>]]
//                                                        every countable limit, before a page is written: the
//                                                        deck's, or one type's or form's (under the deck's density,
//                                                        a section title as the deck's own dividers hold it)
//   node runtime/author-deck.mjs --icons                 the icon names a page can ask for, with their aliases
//   node runtime/author-deck.mjs --example <type>[/<form>]  the worked example page(s) of a type, or of one form
//   node runtime/author-deck.mjs [<id>.pages.json] --scaffold <type>[/<form>] [--evidence <insight-id>] [--id <page-id>]
//                                                        a page of that type that compiles, to fill in; with an
//                                                        insight, its measures named in the exhibit, its table's
//                                                        cells or its figures (the runtime writes the numbers) and
//                                                        its id as `evidence` - in the form asked for, or the first
//                                                        form the measures fill; it says what it bound, and where it
//                                                        fell back to the worked example, why;
//                                                        its `limits` block is the limits the page is held to
//   node runtime/author-deck.mjs <id>.pages.json --log   what the compile and plan runs so far found, and what recurred
//                                                        (it says what it counts: no other command is logged)
//   node runtime/author-deck.mjs <id>.pages.json         compile to <id>.deck.json and <id>.plan.json; warns when
//                                                        the storyline gate in out/ (or --out <dir>) is not ready
//   node runtime/author-deck.mjs <id>.pages.json --check compile and gate; no deck is written (like every run it adds a
//                                                        line to <id>.author-log.jsonl and may update the fit search's
//                                                        cache, <id>.author-cache.json: both are safe to delete)
//   node runtime/author-deck.mjs <id>.pages.json --check --render
//                                                        the final check before the build: the deck is emitted and
//                                                        rendered in a temporary folder by the build's own stages and
//                                                        the render's gates are reported with the rest, so the build
//                                                        finds nothing this did not (nothing is fetched)
//   node runtime/author-deck.mjs <id>.pages.json --page <id>[,<id>...]  (with --check or --draft)
//                                                        the whole deck compiled as context, and what those pages
//                                                        answer for: every blocking finding that names one of them
//                                                        or that one of them counts towards, their part in each deck
//                                                        aggregate (the craft rates among them), and where the deck
//                                                        stands; no deck is written; with --render, renders only them
//   node runtime/author-deck.mjs <id>.pages.json --plan  before the pages are written: the spine's structure rules on
//                                                        what its pages declare, and a form and commentary placement
//                                                        for each page that satisfies them as far as that goes - a
//                                                        page whose exhibits are not written yet is estimated, and
//                                                        marked (a `basis` stub is read as the exhibit it declares);
//                                                        a declared form is kept and only its placement proposed;
//                                                        refuses a title the critique binds that does not fit and an
//                                                        exhibit the spine determines that cannot be drawn; prints a
//                                                        proposal, and writes nothing but its line of the run log
//   node runtime/author-deck.mjs <id>.pages.json --repair-relation <page-id>
//                                                        the one exhibit that sets a page's split measures on one
//                                                        scale, built from the page's own exhibits, to paste in
//   node runtime/author-deck.mjs <id>.pages.json --draft the spine - titles, claims, page types, the insights each
//                                                        page rests on, the request - for the storyline critique.
//                                                        It refuses every finding whose repair changes what the
//                                                        critique binds, and reports, grouped and last, what the
//                                                        copy, the layout or the fit settles. Every title the
//                                                        critique binds is composed where the deck's design sets it,
//                                                        and every exhibit the spine determines is drawn with
//                                                        placeholder copy: one that does not fit is refused here
//
// A pages file is `{ deck: { ...deck-level keys }, sources?: { key: { name, url, status } }, pages: [...], appendix?: [...] }`.
// Every run reports its findings in class order (gates/gate_classes.mjs) -
// the deck's structure, then each page, then the deck's aggregates - and
// prints where the deck stands against every structure and aggregate rule.
// The alternatives the fit search composed are remembered beside the pages
// file in `<id>.author-cache.json`, keyed by the page as written and what
// around it decides its layout; the file is safe to delete, and an entry
// whose key does not match is never used. It is written by every run that
// searched, `--check` and `--page` runs included.
//
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
import { createHash } from "node:crypto";
import os from "node:os";
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { SHAPES, TYPE_SHAPES, breadthProblem, plottedValues } from "./evidence.mjs";
import { compilePage, declaredSlide, describeTypes, pageSchema, structureOf, drawnOf, architectureOf, PAGE_TYPES,
  typesForShape, titleGap, dataKeys, undrawnExhibit, withChoice } from "./page-types.mjs";
import { deriveContent, wordBudgetOf } from "./derive-content.mjs";
import { textWords } from "./text-contract.mjs";
import { runContentGates } from "./gates/content_gates.mjs";
import { varietyFindings, evidenceDepth, structureMix, typeSequence, VARIETY } from "./gates/variety_gates.mjs";
import { SLIDE_KEYS } from "./compose-page.mjs";
import { composeAll } from "./compose-all.mjs";
import { autoFillLogos } from "./fetch-logos.mjs";
import { autoFillPictures } from "./fetch-pictures.mjs";
import { autoFillPlaces } from "./fetch-places.mjs";
import { assetFindings, assetNotice, assetsDeclaration, suppliedPictures } from "./asset-needs.mjs";
import { storylineWarning, insightGradeProblems, unsupportedPillars, recordedMeasures, spineReadings, BOUND_FIELDS } from "./storyline.mjs";
import { deckStatementFindings } from "./review-passes.mjs";
import { ICONS, ICON_NAMES, ICON_ALIASES } from "./icons.mjs";
import { AGENDA_LIMITS } from "./panels.mjs";
import { deckLimits, pageLimits } from "./limits.mjs";
import { SOURCE_TITLE_WORDS } from "./page-template.mjs";
import { readPagesFile, withParts } from "./pages-file.mjs";
import * as WEIGHT from "./weight.mjs";
import { sceneDesignFindings } from "./validate-overlap.mjs";
import { axisOf, hasMeasures, isPercentUnit, measureConflicts, measureProblems, measureRegistry, normalUnit, readInsightLog, unmeasuredInsights, valuesOf } from "./measures.mjs";
import { decimalsNeeded } from "./printed-numbers.mjs";
import { alternativesOf, analysisInsights, analysisLine, catalogueHint, readAnalysis, ANALYSIS_OPS } from "./analysis.mjs";
import { dependencyFindings, metricsOf, relationRepair, requiredCitations } from "./gates/dependency_gates.mjs";
import { craftFindings, sceneStatistics } from "./gates/craft_gates.mjs";
import { LAYOUT_CODES, REPAIRS, SETTLED_LATER, classOf, repairOf } from "./gates/gate_classes.mjs";
import { allocateStructure, declaredArchitecture, declaredStructure, evidenceExhibits, freeChoices, shapeStructure, stubsOf } from "./deck-structure.mjs";
import { FIT, fitSearch } from "./fit-search.mjs";
import { briefOf, contributions, contributorsOf, findingsText, inClassOrder, pagesOf, readStandings, standingText } from "./deck-report.mjs";
import { EVALUATION_MIN_PAGES, buildDeck, validateStageContract } from "./build-deck.mjs";
import { contentsProblem, contentsRoom, coverageFindings } from "./compose-deck.mjs";
import { resolveFill } from "./compose-points.mjs";
import { proseFill } from "./compose-text-pages.mjs";
import { auditContent } from "./content-audit.mjs";
import { isRefusal } from "./errors.mjs";
import { rendererInstalled } from "./doctor.mjs";
import { bindDeck, withPlaceholders } from "./bind.mjs";
import { PLAN_MODE, RUN_LOG_VERSION, readRunLog, runCost } from "./run-log.mjs";
import { sectionTitleRoom, spineFitFindings } from "./spine-fit.mjs";
import { spineExhibitFindings, withPlaceholderCopy } from "./spine-exhibits.mjs";
import { deckKeyProblems, deckSchema } from "./deck-keys.mjs";

export const REVISION = "existing_deck_revision";

/** The codes authoring raises beyond the variety contract's and the page gates', each with what it is about. */
export const AUTHORING_CODES = Object.freeze({
  TITLE_GAP_SHARE: "too many titles state what the evidence cannot settle instead of the way it leans",
  GENERATOR_SIGNATURE: "one value of a page field written the same on most pages, stamped rather than chosen",
  PILLAR_UNSUPPORTED: "a section whose pages rest on no strong insight",
  REVISION_UNMAPPED: "an imported slide still carrying only its old copy, not yet given a page type",
  REVISION_INVENTORY_MISSING: "a revision's source inventory is not beside its pages file",
  CONTENTS_UNFIT: "the contents page cannot hold the deck's sections in the style the deck names, or in any",
  MEASURES_MISSING: "an insight whose evidence is numbers records no `measures`, so nothing can be computed from it or checked against it",
  ANALYSIS_REQUIRED: "a deck that compares declared players has no computed comparison of them on common measures",
  ANALYSIS_UNRESTED: "a computed analysis that no page rests on",
  MEASURES_CONFLICT: "one measure recorded twice in the insight log - blocking where the two records hold different numbers, advisory where they agree",
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
    const extra = Object.keys(entry).filter((k) => !["name", "short", "url", "status"].includes(k));
    // A name is a title and a status a label: each is held to the length of what it is, so a registry entry cannot carry a page's caveats.
    const kind = { name: "its title - the publisher, the publication and its year -", short: "its title in brief", status: "the kind of record it is (\"audited\", \"company-reported\") -" };
    const wordy = Object.entries(SOURCE_TITLE_WORDS).filter(([k, max]) => typeof entry[k] === "string" && textWords(entry[k]) > max)
      .map(([k, max]) => `source "${key}": \`${k}\` runs to ${textWords(entry[k])} words, and a source's \`${k}\` is ${kind[k]} in ${max} words or fewer. A caveat, a scope or a method is a note, not a source: write it in the page's \`note\`, where it is counted (NOTE_HEAVY) and fitted to the footer`);
    return [...(extra.length ? [`source "${key}": unknown key${extra.length === 1 ? "" : "s"} ${extra.join(", ")} - a source is { name, short, url, status }`] : []),
      ...["short", "url", "status"].filter((k) => entry[k] !== undefined && typeof entry[k] !== "string").map((k) => `source "${key}": \`${k}\` is text`), ...wordy];
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
 *
 * References are bound first (bind.mjs): an exhibit, a metric or a token that
 * names a measure is written out from the insight log, so everything below
 * compiles an ordinary typed page. A page with a reference that cannot be
 * bound is left out and named in `bindingFindings`, in a draft as in the full
 * compile: a wrong reference is as cheap to fix before the critique as after.
 * What the compiler can check of such a page without the missing numbers is
 * checked in the same run, so mending the reference reveals no refusal this
 * run could have reported: with every token standing for a number the page is
 * compiled whole, and where an exhibit or a metric is still unfilled its
 * spine is - its choices, its `why`, its title, what settles it.
 */
export function compileDeck(doc, { insights = null, draft = false, partial = false } = {}) {
  if (!doc || typeof doc !== "object" || !doc.deck || !Array.isArray(doc.pages)) throw new Error("A pages file is { deck: {...}, pages: [...] }");
  if (doc.deck.slides || doc.deck.appendix) throw new Error("`deck` carries the deck-level keys only; the pages go in `pages` and `appendix`");
  const registry = registryProblems(doc.sources);
  if (registry.length) throw new Error(`The \`sources\` registry is not valid:\n- ${registry.join("\n- ")}`);
  // Every deck-level key is one the runtime reads, of the kind it reads it as (deck-keys.mjs): said here, in one message, rather than by whichever stage first trips on it.
  const keyed = deckKeyProblems(doc.deck);
  if (keyed.length) throw new Error(`The deck-level keys of \`deck\` are not valid:\n- ${keyed.join("\n- ")}`);
  // The deck-level fields the reviews read may sit beside `deck` as well as on it.
  const deckKeys = Object.fromEntries(["request", "waivers", "rulesVersion"].filter((key) => doc[key] !== undefined && doc.deck[key] === undefined).map((key) => [key, doc[key]]));
  const binding = bindDeck({ ...doc, deck: { ...doc.deck, ...deckKeys } }, insights);
  doc = binding.doc;
  const revision = doc.deck.workflow === REVISION;
  const errors = [], waiting = [], refusals = new Map();
  const measured = measureRegistry(insights);
  const refuse = (index, message) => { errors.push(message); refusals.set(index, message); return null; };
  const compile = (list, offset = 0) => list.map((page, i) => {
    const index = offset + i;
    if (unmapped(page)) {
      if (revision) { waiting.push(page.id ?? `page ${index + 1}`); return null; }
      return refuse(index, `${page.id ?? `page ${index + 1}`}: \`draft\` is an imported slide's old copy, which only a revision (\`workflow: "${REVISION}"\`) carries; give the page its \`type\` and write its copy`);
    }
    const options = { insights, players: doc.deck.players, sources: doc.sources, rules: doc.deck };
    if (binding.bound.failed.has(page?.id ?? `page-${index + 1}`)) {
      // The page is left out for its binding; what does not wait on the missing numbers is compiled now, for its refusal alone.
      const stand = withPlaceholders(binding.bound.attempted.get(page) ?? page);
      const unfilled = /"measure"\s*:/.test(JSON.stringify(stand));
      try { compilePage(withoutDependencies(stand, measured).page, index, { ...options, draft: draft || unfilled, spine: draft || unfilled }); } catch (error) { refuse(index, error.message); }
      return null;
    }
    let slide;
    const { page: authored, dependencies } = withoutDependencies(page, measured, binding.bound.printed.get(page));
    try { slide = compilePage(authored, index, { ...options, draft, spine: draft }); } catch (error) { return refuse(index, error.message); }
    if (dependencies && slide.pageType) {
      slide.pageType.dependencies = dependencies.declared;
      if (dependencies.claim && slide.pageType.content?.settles) slide.pageType.content.settles = { ...slide.pageType.content.settles, ...dependencies.claim };
    }
    // What the binding recorded of the page - the assumed measures it shows, the values it prints without their sign - is kept
    // with what settles the claim, where the critic's and the reviewer's notes read it (gates/dependency_gates.mjs dependencyNotes).
    const assumed = binding.bound.assumed.get(page), unsigned = binding.bound.unsigned.get(page);
    if ((assumed || unsigned) && slide.pageType?.content?.settles) slide.pageType.content.settles = { ...slide.pageType.content.settles, stated: { ...(assumed ? { assumed } : {}), ...(unsigned ? { unsigned } : {}) } };
    // Every key checked now, on every page, rather than one at a time by the build.
    const unknown = Object.keys(slide).filter((key) => !(key in SLIDE_KEYS));
    if (!unknown.length) return slide;
    return refuse(index, `${slide.id ?? `page ${index + 1}`}: unknown page key${unknown.length === 1 ? "" : "s"} ${unknown.map((k) => `\`${k}\``).join(", ")} - a key the composer does not read (an exhibit's own props go inside the exhibit)`);
  });
  const compiled = [...compile(doc.pages), ...compile(doc.appendix || [], doc.pages.length)];
  const slides = compiled.slice(0, doc.pages.length).filter(Boolean), appendix = compiled.slice(doc.pages.length).filter(Boolean);
  // Each page that did not compile, with its place and its refusal, for the caller to stand in for. A page left out for a
  // reference that does not bind is listed as unbound - its refusal is the binding's finding - and again with its compile
  // refusal where what could be checked of it without the binding was refused too.
  const authored = [...doc.pages, ...(doc.appendix || [])];
  const idAt = (index) => authored[index]?.id ?? `page-${index + 1}`;
  // `page` is the page as the binding left it - its bound exhibits written out - which is what stands in for it (withStandIns).
  const failed = compiled.flatMap((slide, index) => (slide || (revision && unmapped(authored[index])) ? [] : [
    ...(refusals.has(index) ? [{ index, id: idAt(index), message: refusals.get(index), page: authored[index] }] : []),
    ...(binding.bound.failed.has(idAt(index)) ? [{ index, id: idAt(index), unbound: true, page: authored[index] }] : [])]));
  const spec = { ...doc.deck, ...(doc.sources ? { sources: doc.sources } : {}),
    // The rules the deck was authored under; a revised deck keeps the version it records.
    ...(doc.deck.rulesVersion === undefined && WEIGHT.RULES_VERSION !== undefined ? { rulesVersion: WEIGHT.RULES_VERSION } : {}),
    slides, ...(appendix.length ? { appendix } : {}) };
  // A revision recorded under an older rules version hears the spine rules introduced since as advisories.
  const spineFindings = [...WEIGHT.applyRulesVersion(deckSpineFindings(doc, insights), doc.deck), ...(waiting.length ? [{ code: "REVISION_UNMAPPED", severity: draft ? "advisory" : "blocker", pages: waiting,
    repair: `${waiting.length} imported slide${waiting.length === 1 ? " carries" : "s carry"} only their old copy (${waiting.join(", ")}): map each to a page type by its stable id - \`type\`, \`form\`, \`commentary\`, \`why\` and the exhibit its evidence needs (\`--scaffold <type>\` prints one; the inventory holds the slide's table cells and chart values) - or delete it from \`pages\` to drop the slide` }] : [])];
  if (partial) return { spec, findings: varietyFindings(spec, { structureOf, drawnOf }), spineFindings, bindingFindings: binding.findings, compileErrors: errors, failed, unmapped: waiting };
  errors.push(...binding.findings.map((f) => f.repair));
  if (errors.length) {
    const error = new Error(`${errors.length} page${errors.length === 1 ? "" : "s"} could not be compiled:\n- ${errors.join("\n- ")}`);
    error.pageErrors = errors;
    throw error;
  }
  return { spec, findings: varietyFindings(spec, { structureOf, drawnOf }), spineFindings, unmapped: waiting };
}

/**
 * A page as the compiler reads it, with its dependency declarations set
 * aside: each exhibit's and each figure's `basis` (gates/dependency_gates.mjs)
 * - a strip's metrics, a hero's `kpi`, a row block's `metric`, a fact-grid
 * item - is the author's statement about the evidence, not a prop the composer
 * draws.
 * `declared` is what the page's record keeps - the storyline critique is
 * bound to it - and `claim` the measures and relation of a `settles` written
 * without its kind, which the insights then supply. A page that cites no
 * source takes its citation from the measures it plots and the ones its
 * tokens print (`printed`), where they carry one.
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
  // The contents page is the runtime's to fit, except against a style the
  // author named: that is refused here, before a page is composed.
  const contents = contentsProblem({ ...deck, slides: doc.pages, appendix: doc.appendix });
  if (contents) out.push({ code: "CONTENTS_UNFIT", severity: "blocker", measured: { sections: contents.sections, style: contents.style, holds: [contents.min, contents.max] },
    repair: contents.style === "columns"
      ? `The deck names \`agendaStyle: "columns"\` and has ${contents.sections} sections${doc.appendix?.length ? " (the appendix divider is one)" : ""}; the column contents page holds ${contents.min} to ${contents.max}. Remove \`agendaStyle\` - the runtime then sets the list, which holds up to ${AGENDA_LIMITS.list.max} - or merge sections`
      : `The deck has ${contents.sections} sections${doc.appendix?.length ? " (the appendix divider is one)" : ""} and the contents page lists at most ${contents.max}. Merge sections - a deck reads in two to five - or set \`contents: false\` on \`deck\`` });
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
    out.push(...(insights.conflicts ?? []));
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
  // A log extracted by several workers is assembled from its parts here (`include`), an id recorded twice refused with both places.
  const log = await readInsightLog(baseDir, stem);
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
  map.conflicts = conflictFindings(items);
  return map;
}

/**
 * One measure recorded twice (measures.mjs measureConflicts), as findings on
 * the spine: two records that hold different numbers block - a page would
 * rest on whichever the author happened to name - and two that agree, or
 * differ only in rounding, are an advisory to keep one.
 */
function conflictFindings(items) {
  const where = (c, i) => `${c.refs[i]}${c.where[i] ? ` (${c.where[i]})` : ""}`;
  const cells = (c) => c.at.slice(0, 4).map((cell) => `${cell.label}: ${cell.values[0]} against ${cell.values[1]}`).join("; ") + (c.at.length > 4 ? "; ..." : "");
  const conflicts = measureConflicts(items);
  const apart = conflicts.filter((c) => c.kind === "contradiction"), agreeing = conflicts.filter((c) => c.kind !== "contradiction");
  return [
    ...(apart.length ? [{ code: "MEASURES_CONFLICT", severity: "blocker", pages: [...new Set(apart.flatMap((c) => c.refs.map((ref) => ref.split("/")[0])))], measured: { conflicting: apart.map((c) => c.refs) },
      repair: `The insight log records ${apart.length === 1 ? "a measure" : `${apart.length} measures`} twice with different numbers - one name, population and unit, at one period or member: ${apart.map((c) => `${where(c, 0)} and ${where(c, 1)} (${cells(c)})`).join(" | ")}. Go back to the source and keep the number it gives, in one of the two records (delete the measure from the other, or correct it); where the two are different quantities, say so in the measure's \`population\` or its name, so they are no longer read as one` }] : []),
    ...(agreeing.length ? [{ code: "MEASURES_CONFLICT", severity: "advisory", pages: [...new Set(agreeing.flatMap((c) => c.refs.map((ref) => ref.split("/")[0])))], measured: { repeated: agreeing.map((c) => c.refs) },
      repair: `The insight log records ${agreeing.length === 1 ? "a measure" : `${agreeing.length} measures`} twice: ${agreeing.map((c) => `${where(c, 0)} and ${where(c, 1)}${c.kind === "precision" ? ` at different precision (${cells(c)})` : ""}`).join(" | ")}. Keep one record of each and name it wherever the other was named: two records of one number drift apart at the next edit` }] : []),
  ];
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
      return { findings: [], advisories: [], all: [], standings: [], architectures: [], budget: [], ran: false, reason: String(run.error?.message ?? run.stderr ?? `exit ${run.status}`).trim().split("\n").slice(-3).join(" ") || `exit ${run.status}` };
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
    // `all` is every finding with its page id, `standings` where the deck
    // stands against each deck-level rule and `architectures` each page's
    // architecture as PAGE_SHAPE_FLAT reads it: the author's report files them by class.
    return { ran: true, budget, findings: (report.findings || []).filter((f) => f.severity === "blocker").map(withId),
      advisories: (report.findings || []).filter((f) => f.severity !== "blocker" && (f.slide || f.code === "DECK_INK")).map(withId),
      all: (report.findings || []).map(withId), standings: report.standings ?? [], architectures: report.architectures ?? [] };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// The band TEXT_FRAGMENTED holds the prose pages' median words a block to (weight.json plan.textForm), and the pages it is read from.
const BLOCK_BAND = Object.freeze({ low: WEIGHT.PLAN.textForm.wordsPerBlock.q1, high: WEIGHT.PLAN.textForm.wordsPerBlock.q3, from: WEIGHT.DECK_LENGTH.density });
const median = (values) => { const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
/** How far a median words a block stands outside the band: 0 inside it. */
const outside = (value) => (value < BLOCK_BAND.low ? BLOCK_BAND.low - value : value > BLOCK_BAND.high ? value - BLOCK_BAND.high : 0);

/**
 * The deck's estimated median words a block over its prose pages
 * (gates/density_profile.py scene_blocks, read off each page's budget), from
 * `[{ id, blocks: { count, wordsPerBlock, prose } }]`; null while fewer prose
 * pages carry text than the rule is read from.
 */
function blockMedian(rows) {
  const prose = rows.filter((row) => row.blocks?.prose && row.blocks.count > 0);
  return prose.length >= BLOCK_BAND.from ? Math.round(median(prose.map((row) => row.blocks.wordsPerBlock)) * 10) / 10 : null;
}

/**
 * What swapping page `id` for an arrangement whose text sets in `blocks` does
 * to the deck's estimated median words a block, as phrases: one where the
 * swap takes the median out of its band, or further out than it stands.
 */
function fragmentationShift(budget, id, blocks) {
  const rows = budget.map((row) => ({ id: String(row.id ?? ""), blocks: row.blocks }));
  const before = blockMedian(rows), after = blockMedian([...rows.filter((row) => row.id !== String(id)), { id: String(id), blocks }]);
  if (after === null || outside(after) === 0 || (before !== null && outside(after) <= outside(before))) return [];
  return [`would take the deck's median words a block ${after < BLOCK_BAND.low ? "under" : "over"} its band - an estimated ${after} against ${BLOCK_BAND.low} to ${BLOCK_BAND.high}${before === null ? "" : `, from ${before}`} (TEXT_FRAGMENTED, measured on the render): this page would set ${blocks.count} block${blocks.count === 1 ? "" : "s"} of ${blocks.wordsPerBlock} words`];
}

/**
 * The compiled deck with each page that did not compile stood in for by its
 * declared choices (page-types.mjs declaredSlide), in page order: what the
 * deck's structure rules are read from, so a page that fails to compile
 * still counts as the type, form and placement it declares. `declared` lists
 * the stand-ins.
 */
function withStandIns(doc, spec, failed, insights) {
  const missing = new Set(failed.map((f) => f.index));
  // A page that did not compile is stood in for as the binding wrote it: an exhibit that names its measures stands in with the values it will plot.
  const written = new Map(failed.filter((f) => f.page).map((f) => [f.index, f.page]));
  const revision = doc.deck.workflow === REVISION, declared = [], undrawn = [];
  const standFor = (page, index) => declaredSlide(page, index, { exhibitType: evidenceExhibits(page, insights), players: doc.deck.players, stubs: stubsOf(page, insights) });
  // A spine page compiled for a draft with no exhibit drawn yet - its exhibits declared by `basis` stubs, or not written at
  // all - is read for the structure rules as its choices declare it, the way a plan reads it: the exhibits its form draws,
  // each stub as the exhibit it declares. Its record of the claim is kept; an undrawn exhibit is never one that plots nothing.
  const shapeOf = (slide, page, index) => {
    const own = [page?.exhibit, ...(Array.isArray(page?.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object");
    if (!slide?.pageType?.deferred || !own.every(undrawnExhibit)) return slide;
    const stand = standFor(page, index);
    if (!stand) return slide;
    undrawn.push(String(stand.id));
    const { declared: _stoodIn, ...record } = stand.pageType;
    return { ...stand, pageType: { ...record, content: slide.pageType.content, ...(slide.pageType.dependencies ? { dependencies: slide.pageType.dependencies } : {}) } };
  };
  const shapes = new Map();
  const rebuild = (pages, compiled, offset) => {
    const queue = [...compiled];
    return pages.flatMap((page, i) => {
      if (!missing.has(offset + i)) {
        if (revision && unmapped(page)) return [];
        const [slide] = queue.splice(0, 1);
        if (slide) shapes.set(slide, shapeOf(slide, page, offset + i));
        return slide ? [slide] : [];
      }
      const stand = standFor(written.get(offset + i) ?? page, offset + i);
      if (!stand) return [];
      // A page that names its insights is settled by them (page-types.mjs spineOf).
      const lead = (stand.pageType.content.evidence || []).map((key) => insights?.get(key)).find(Boolean);
      if (!stand.pageType.content.settles && lead) stand.pageType.content.settles = { kind: SHAPES[lead.shape]?.kind ?? "qualitative", what: String(lead.finding ?? "") };
      declared.push(String(stand.id));
      return [stand];
    });
  };
  const slides = rebuild(doc.pages, spec.slides, 0), appendix = rebuild(doc.appendix || [], spec.appendix || [], doc.pages.length);
  const shaped = (list) => list.map((slide) => shapes.get(slide) ?? slide);
  return { structural: { ...spec, slides, ...(appendix.length ? { appendix } : {}) }, declared,
    // `shaped`: the same deck with each undrawn spine page (`undrawn`) read as its choices declare it - what the structure rules are read from.
    shaped: { ...spec, slides: shaped(slides), ...(appendix.length ? { appendix: shaped(appendix) } : {}) }, undrawn };
}

const isBlocker = (f) => f.severity === "blocker" || f.severity === "blocking";

// What a draft may leave to the full compile is what is mended without writing a field the storyline critique is bound to
// (storyline.mjs BOUND_FIELDS): every code says what its repair can write (gates/gate_classes.mjs REPAIRS), and one that can
// be mended by the copy, the layout or the fit waits; the rest block. `boundOnly` is a code's repairs with those three taken out.
const boundOnly = (code) => (REPAIRS[code] ?? []).filter((kind) => Object.hasOwn(BOUND_FIELDS, kind));
const waitsFor = (f) => repairOf(f).settledLater;

/**
 * The page a spine compile is given: one page as the deck's compile reads it
 * (compileDeck), its dependency declarations set aside. Throws its refusal.
 */
const compilerOf = (doc, insights) => { const measured = measureRegistry(insights);
  return (page, index, { draft = false } = {}) => compilePage(withoutDependencies(page, measured).page, index, { insights, players: doc.deck.players, sources: doc.sources, rules: doc.deck, draft }); };

/**
 * The spine's structure rules as an allocation of forms and placements reads
 * them (deck-structure.mjs allocateStructure): a page that compiles as written
 * is read as the compile reads it, the rest from their declared choices. What
 * it leaves unsatisfied no form or placement mends - only another page type,
 * another page or other evidence, all of which the critique is bound to.
 */
function structurePlan(doc, insights) {
  let compiled = new Map();
  try { const { spec } = compileDeck(doc, { insights, partial: true }); compiled = new Map([...spec.slides, ...(spec.appendix || [])].filter((slide) => slide.pageType).map((slide) => [String(slide.id), slide])); }
  catch { compiled = new Map(); }
  return allocateStructure(doc, { insights, planOf, compiled });
}

/**
 * Does a page have its exhibits drawn: at least one exhibit or figure with
 * something in it, and none still a stub. Whether anything on a page proves
 * its claim (PROOF_MISSING) is decided only then - until it is, the claim's
 * measures count as shown, and an exhibit that proves them is the layout's to add.
 */
function exhibitsDrawn(page) {
  const own = [page?.exhibit, ...(Array.isArray(page?.exhibits) ? page.exhibits : []), ...(Array.isArray(page?.blocks) ? page.blocks.map((block) => block?.exhibit) : [])].filter((ex) => ex && typeof ex === "object");
  const figures = metricsOf(page ?? {});
  return (own.length > 0 || figures.length > 0) && !own.some(undrawnExhibit);
}

/**
 * The dependency contract's findings as a spine is held to them: every one
 * that is decided by what the page declares. Nothing proving a claim is not
 * decided while an exhibit of the page is still to be drawn.
 */
function spineDependencies(doc, insights, deck) {
  if (!insights) return [];
  const pages = new Map([...doc.pages, ...(doc.appendix || [])].map((page, index) => [String(page?.id ?? `page-${index + 1}`), page]));
  return WEIGHT.applyRulesVersion(dependencyFindings(doc, insights).filter((f) => f.code !== "BINDING_UNRESOLVED"), deck)
    .map((f) => (f.code === "PROOF_MISSING" && !exhibitsDrawn(pages.get(String(f.id))) ? { ...f, touches: ["layout"], undecided: "the page's exhibits are not all drawn yet" } : f));
}
// The craft floors that count what the build fetches rather than what the pages say.
const FETCHED_AT_BUILD = new Set(["CRAFT_PLAYERS_UNINTRODUCED"]);
const idOfMessage = (message) => String(message).match(/^(?:Cannot render )?([^:\s]+):/)?.[1];
// A deck opens on its answer: the first analytical page is the executive summary, ahead of the first section.
const opensOnSummary = (spec) => { const first = spec.slides.find((s) => s.pageType || s.kind === "section" || s.kind === "divider"); return first?.pageType?.type === "summary" && first.pageType.form === "executive-summary"; };

/**
 * The content plan of `structural` as composed in `deck`, and its gates'
 * findings by page id. A page with no composition has no text to hold to a
 * floor (`uncomposed`), and one that did not compile is answered by its
 * compile refusal alone (`uncompiled`); the rules on the claims the pages
 * make between them read every page, stand-ins included.
 */
function contentFindings(structural, deck, spec, { uncomposed = new Set(), uncompiled = new Set() } = {}) {
  const content = deriveContent(structural, deck ?? { slides: [] });
  // A page with no composition is marked for the content gates (`uncomposed`): it has no text to hold to a plan, and where it is the opening page only its title can carry the answer.
  const report = runContentGates(content, { required: true, deck: spec, uncomposed: new Set([...uncomposed, ...uncompiled]) });
  const idOf = new Map(content.pages.map((page) => [page.n, page.id]));
  // A finding that sets pages against each other (a claim two pages both prove) names every one of them, by id.
  const named = (f) => (Array.isArray(f.measured?.pages) ? f.measured.pages.map((n) => (typeof n === "number" ? idOf.get(n) : n)).filter((id) => typeof id === "string") : []);
  const findings = (report.findings || []).map((f) => ({ ...f, ...(f.page !== null && f.page !== undefined ? { id: f.id ?? idOf.get(f.page) } : {}), ...(named(f).length ? { pages: named(f) } : {}) }))
    .filter((f) => !(f.id !== undefined && classOf(f.code) === "P" && (uncompiled.has(String(f.id)) || (uncomposed.has(String(f.id)) && /^TEXT_/.test(f.code)))));
  return { content, report, findings };
}

/** The page-local findings a composed deck answers beyond the page gates: what each exhibit rests on, the scene's design checks, the copy, and what composition kept. */
function localFindings({ doc, structural, deck, spec, insights, uncomposed, uncompiled }) {
  // A reference that could not be bound is reported by the compile, which left its page out (compileDeck `bindingFindings`).
  const depends = spineDependencies(doc, insights, spec);
  const design = deck ? WEIGHT.applyRulesVersion(sceneDesignFindings(deck), spec) : [];
  const { findings: copy, content, report } = contentFindings(structural, deck, spec, { uncomposed, uncompiled });
  // An explicit visual choice or authored commentary that did not survive composition: the build refuses it (CONTENT_LOST).
  const byTitle = new Map([...structural.slides, ...(structural.appendix || [])].map((slide) => [String(slide.title ?? "").normalize("NFKC").replace(/\s+/g, " ").trim(), slide.id]));
  const kept = deck ? auditContent(spec, deck).findings.map((f) => ({ ...f, id: byTitle.get(f.title), severity: "blocker",
    repair: f.code === "MISSING_AUTHORED_CONTENT" ? `The composed page does not carry this authored text: "${String(f.text).slice(0, 120)}". Its form or commentary placement has no place for it: move it to a field the page draws, or choose the placement that draws it`
      : `The page asks for a ${f.kind} ("${f.value}") that its composition does not draw; the build refuses a page that drops an explicit choice. Remove the choice, or choose the form that draws it` }))
    .filter((f) => f.id !== undefined && !uncomposed.has(String(f.id)) && !uncompiled.has(String(f.id))) : [];
  return { depends, design, copy, kept, content, report };
}

/**
 * Compile, compose in memory, and gate: what the CLI runs, and what it
 * reports in class order (gates/gate_classes.mjs).
 *
 * Deck structure (S) is read first and on every run, from the compiled pages
 * and, for a page that did not compile, from its declared choices; a page
 * that failed to compile or compose still gets every check that does not
 * need its composition, and the deck's aggregates (G) are read from the
 * pages that composed. So fixing what one run reports reveals nothing that
 * run could have reported, except where the run says so: a page with a bound
 * exhibit that cannot be filled has only its spine compiled, a page that does
 * not compose has no layout findings yet, and an aggregate read on the pages
 * that composed (`partial`) can change when a missing page comes in. A page
 * with a blocking layout finding has its
 * type's other forms and placements tried for it (fit-search.mjs; `fitPages`
 * keeps the search to those pages, `fitCache` remembers its verdicts). Every
 * structure and aggregate rule says where the deck stands (`standings`).
 *
 * A draft is the spine: its compile and spine findings block, and everything
 * the copy settles - composition, the variety contract, the page gates - is
 * reported beside it. `findings` and `pageGateAdvisories` are what blocks and
 * what advises, the content plan's findings apart (`contentReport`);
 * `blocking` and `advisories` hold every finding with its class.
 */
export async function authorDeck(doc, { baseDir, insights = null, draft = false, fit = !draft, fitCap = FIT.perPage, fitCache = null, fitPages = null } = {}) {
  const { spec, spineFindings, bindingFindings, unmapped: waiting, failed } = compileDeck(doc, { insights, draft, partial: true });
  const authoredIds = new Set([...doc.pages, ...(doc.appendix || [])].map((page, index) => String(page?.id ?? `page-${index + 1}`)));
  const { structural, declared, shaped, undrawn } = withStandIns(doc, spec, failed, insights);
  const composed = await composeForAuthoring(spec, baseDir);
  // A page whose references could not be bound (bind.mjs) is left out as one that did not compile is, and stood in for
  // by its declared choices; its finding is the binding's, in a draft as in the full compile.
  const compiled = failed.filter((f) => !f.unbound).map(({ id, message }) => ({ code: "COMPILE", id: idOfMessage(message) ?? id, severity: "blocker", repair: message }));
  const unbound = new Set(failed.filter((f) => f.unbound).map((f) => String(f.id)));
  const composing = (composed.pageErrors ?? (composed.error ? [composed.error] : [])).map((message) => ({ code: "PAGE_DOES_NOT_COMPOSE", id: idOfMessage(message), severity: "blocker", repair: message }));
  // Every title the critique binds, composed where this deck's design sets it (spine-fit.mjs): held on every run, a draft's
  // among them, so a spine that passes its draft meets no later refusal whose repair is to change a title. A divider or
  // a contents page that does not compose for its title is reported once, by this finding, which says the room it has.
  const unfit = spineFitFindings(structural, baseDir);
  // What the spine says each page shows, proven drawable, and its summary proven to fill (spine-exhibits.mjs): a draft's proof,
  // since the full compile composes the pages themselves. With the titles, it is what makes a spine that passes its draft
  // one the layout can finish without touching anything the critique is bound to.
  const undrawable = draft ? WEIGHT.applyRulesVersion(spineExhibitFindings(doc, { spec, insights, baseDir, compile: compilerOf(doc, insights), sceneGates: (deck) => sceneGateFindings(deck, undefined, spec) }), spec) : [];
  const structuralIds = new Set([...structural.slides, ...(structural.appendix || [])].filter((slide) => !slide.pageType).map((slide) => String(slide.id)));
  const unfitIds = new Set(unfit.map((f) => String(f.id)));
  const composingShown = composing.filter((f) => !(unfitIds.has(String(f.id)) && (structuralIds.has(String(f.id)) || !authoredIds.has(String(f.id)))));
  const uncompiled = new Set([...compiled.map((f) => String(f.id)), ...unbound]), uncomposed = new Set(composing.map((f) => f.id).filter(Boolean).map(String));
  const failedIds = new Set([...compiled, ...bindingFindings, ...composing].map((f) => f.id).filter(Boolean));
  // Every page compiled and composed: the composed deck is the whole deck, and what the gates say of it stands.
  const complete = Boolean(composed.deck) && !compiled.length && !unbound.size && !composing.length;
  const inventory = spec.workflow === REVISION && spec.inventory && baseDir && !existsSync(path.resolve(baseDir, String(spec.inventory)))
    ? [{ code: "REVISION_INVENTORY_MISSING", severity: "blocker", repair: `The deck records its source inventory as "${spec.inventory}", which is not beside the pages file; run runtime/import-deck.py again or correct the path` }] : [];
  const scene = composed.deck ? sceneGateFindings(composed.deck, undefined, spec)
    : { findings: [], advisories: [], all: [], standings: [], architectures: [], budget: [], ran: false, reason: composed.error };
  const sceneId = (slide) => { const page = composed.deck?.slides[Number(slide) - 1]; return page ? page.sourceSlideId ?? page.id : null; };
  const standIn = [declared.length ? `${declared.join(", ")} did not compile` : null, undrawn.length ? `${undrawn.length} page${undrawn.length === 1 ? " is" : "s are"} not drawn yet and read as declared` : null].filter(Boolean).join("; ") || null;
  const partial = complete ? null : `measured on the ${composed.deck ? new Set(composed.deck.slides.map((slide) => slide.sourceSlideId ?? slide.id)).size : 0} pages that composed`;

  // --- S: the deck's structure, on every page ------------------------------
  // The variety contract and the plan record's gates, read off the compiled
  // pages and the stand-ins; a rule the deck predates (a revision under an
  // older rules version) comes back as an advisory.
  const structure = declaredStructure(shaped, { planOf });
  // The plan record's advisories rest on the families a plan declares; here the compiled pages are read directly
  // and the contract's own rules say the same things exactly, so only what the plan gates refuse is reported.
  structure.findings = structure.findings.filter((f) => !/^PLAN_/.test(f.code) || isBlocker(f));
  const typed = [...shaped.slides, ...(shaped.appendix || [])].filter((slide) => slide.pageType);
  // The page's architecture as the gates measured it, or as its choices declare it where it did not compose.
  const measuredShape = new Map();
  for (const item of scene.architectures) measuredShape.set(String(item.id), [...(measuredShape.get(String(item.id)) || []), item.architecture]);
  const shapesWith = (swap = null) => typed.flatMap((slide) => (swap?.id === String(slide.id) ? [declaredArchitecture(swap.slide)] : measuredShape.get(String(slide.id)) ?? [declaredArchitecture(slide)])
    .map((architecture) => ({ id: slide.id, architecture })));
  const airy = resolveFill(spec) === "airy";
  // PAGE_SHAPE_FLAT and NO_SUMMARY are the page gates' while every page composed. With a page missing they
  // are read here from the declared choices, so the page's absence neither hides nor invents one.
  // The gates name pages by their place in the scene; the report names them by id.
  const named = (key) => sceneId(key) ?? key;
  // A page of prose beside its panel that stands part empty, or runs past its word ceiling, is told the words of prose that
  // fill the column it is set in - read off the measurement that set it (compose-text-pages.mjs proseFill) - with the words it has.
  const appendixIds = new Set((spec.appendix || []).map((slide) => String(slide.id)));
  const proseSlides = new Map([...spec.slides, ...(spec.appendix || [])].filter((slide) => slide.pageType).map((slide) => [String(slide.id), slide]));
  const withProseFill = (f) => {
    if (!["SCENE_VOID", "WORDS"].includes(f.code) || !proseSlides.has(String(f.id))) return f;
    const slide = proseSlides.get(String(f.id)), budget = (scene.budget ?? []).find((b) => String(b.id ?? "") === String(f.id));
    const prose = (slide.paragraphs || []).reduce((sum, text) => sum + textWords(text), 0);
    // What the word ceiling leaves the prose: the page's other body words - its panel - count toward it too.
    const beside = budget ? Math.max(0, budget.body - prose) : 0, ceiling = budget?.ceiling ? Math.floor(budget.ceiling) - beside : undefined;
    const fill = proseFill(slide, slide.density ?? (appendixIds.has(String(f.id)) ? "appendix" : spec.density), ceiling && ceiling > 0 ? ceiling : undefined);
    if (!fill) return f;
    const range = fill.min < fill.max ? `${fill.min} to ${fill.max} words of prose fill the column it is set in` : `about ${fill.max} words of prose fill the column it is set in`;
    return { ...f, fills: { prose: fill.words, min: fill.min, max: fill.max, ...(beside ? { panel: beside } : {}) },
      repair: `${f.repair ?? ""} This page is prose beside its panel: ${range}${ceiling ? ` (the page's ceiling of ${Math.floor(budget.ceiling)} body words less the ${beside} beside the prose)` : ""}; the prose runs to ${fill.words}. Write to that length - the composer sets the column's width to it - rather than a few words at a time`.trim() };
  };
  // A title over its lines is one finding a page. Where the page composed and the page gates hold it (TITLE_LINES), theirs is
  // kept and given the room the spine's measure found; a draft, which holds the spine alone, keeps the spine's (SPINE_UNFIT).
  const overLines = new Map(unfit.filter((f) => f.measured?.lines !== undefined).map((f) => [String(f.id), f]));
  const gated = new Set(scene.all.filter((f) => f.code === "TITLE_LINES" && isBlocker(f) && overLines.has(String(f.id))).map((f) => String(f.id)));
  const unfitShown = draft ? unfit : unfit.filter((f) => !gated.has(String(f.id)));
  const withTitleRoom = (f) => { const room = f.code === "TITLE_LINES" ? overLines.get(String(f.id))?.measured.fits : null;
    return room ? { ...f, fits: room, repair: `${f.repair ?? ""} ${room.words ? `Its first ${room.words} words (${room.characters} characters) fit the two lines` : "Not even its first word fits the two lines"} in this deck's title band; the storyline critique is bound to the title, so a change sends the page back to it`.trim() } : f; };
  let gateFindings = scene.all.filter((f) => !(draft && f.code === "TITLE_LINES" && overLines.has(String(f.id)))).map(withProseFill).map(withTitleRoom), gateStandings = scene.standings.map((st) => ({ ...st, ...(st.pages ? { pages: st.pages.map(named) } : {}),
    ...(st.each ? { each: Object.fromEntries(Object.entries(st.each).map(([key, value]) => [named(key), value])) } : {}) }));
  const provisionalShape = complete && scene.ran ? { findings: [], standings: [] } : shapeStructure(shapesWith(), { airy });
  if (!(complete && scene.ran)) {
    const opens = opensOnSummary(structural), long = typed.length >= WEIGHT.DECK_LENGTH.frontMatter;
    gateFindings = gateFindings.filter((f) => f.code !== "PAGE_SHAPE_FLAT" && !(f.code === "NO_SUMMARY" && opens));
    gateStandings = [...gateStandings.filter((st) => st.code !== "PAGE_SHAPE_FLAT" && st.code !== "NO_SUMMARY"),
      { code: "NO_SUMMARY", what: "an opening executive summary", value: opens ? 1 : 0, bar: 1, side: "min", unit: "present", applies: long, blocks: true }];
    if (!scene.ran && !opens && long) provisionalShape.findings.push({ code: "NO_SUMMARY", severity: "blocker", measured: 0, threshold: "an opening executive summary",
      repair: "The deck's first analytical page is not its executive summary. Open on the answer, its proof, the consequence and the action: a `summary` page, form `executive-summary`, ahead of the first section" });
  }
  // What the build checks of the stages before it composes: the stage contract of a new deck, an evaluation's length, the brief's ranked criteria.
  const local = localFindings({ doc, structural, deck: composed.deck, spec, insights, uncomposed, uncompiled });
  const stages = [];
  try { validateStageContract(structural, { content: local.content, plan: planOf(structural) }); }
  catch (error) { if (!isRefusal(error)) throw error; stages.push({ code: error.code, severity: "blocker", repair: `${error.message} - the build refuses the deck here. Give every page a unique \`id\`, and open the deck on a \`summary\` page (form \`executive-summary\`) ahead of its first section` }); }
  const standings = [];
  if (spec.purpose === "evaluation") {
    // Each page still to compose will add at least a slide.
    const slides = (composed.deck?.slides.length ?? 0) + new Set([...uncompiled, ...uncomposed]).size;
    standings.push({ code: "EVALUATION_TOO_SHORT", what: "pages the deck composes, cover and appendix included", value: slides, bar: EVALUATION_MIN_PAGES, side: "min", unit: "pages", applies: true, blocks: true });
    if (slides < EVALUATION_MIN_PAGES) stages.push({ code: "EVALUATION_TOO_SHORT", severity: "blocker", measured: slides, threshold: EVALUATION_MIN_PAGES,
      repair: `An evaluation deck renders at least ${EVALUATION_MIN_PAGES} pages, cover and appendix included; this one composes ${slides}. Widen the evidence, not the repetition, or drop \`purpose: "evaluation"\` for a diagnostic` });
  }
  stages.push(...coverageFindings(structural).map((f) => ({ ...f, slide: undefined, severity: "blocker" })));
  // The sections the contents page lists, against what its style holds (deckSpineFindings).
  const contents = contentsRoom({ ...doc.deck, slides: doc.pages, appendix: doc.appendix });
  if (contents) standings.push({ code: "CONTENTS_UNFIT", what: `sections on the contents page (${contents.style === "columns" ? "the column style the deck names" : "a list"})`, value: contents.sections, bar: contents.max, side: "max", unit: "sections", applies: true, blocks: true });
  // The titles that lead with a gap, against the share the spine allows (deckSpineFindings).
  const titled = [...doc.pages, ...(doc.appendix || [])].filter((page) => page && typeof page === "object" && page.type);
  if (titled.length) { const gaps = titled.filter((page) => titleGap(page.title));
    standings.push({ code: "TITLE_GAP_SHARE", what: "titles stating what the evidence cannot settle", value: gaps.length, bar: Math.max(1, Math.floor(TITLE_GAP_SHARE * titled.length)), side: "max", unit: "pages", applies: true, blocks: true, pages: gaps.map((page) => page.id) }); }

  // --- G: the deck's aggregates, on the pages that composed ----------------
  // The compile fetches nothing, so a floor on what the build fetches - the players' logos, planned by name in
  // the pages (PLAYERS_UNMARKED holds that) and drawn once their files are on disk - is not yet decided here:
  // it is reported, and blocks at the render, where the deck is built as a build that does not fetch builds it.
  // A deck that declares it is built without the network (asset-needs.mjs) has nothing left to wait for: the
  // build fetches nothing either, so the floor is decided here as the build decides it - an advisory once every
  // player is named on a page, a blocker for a player named nowhere.
  const awaitsFetch = assetsDeclaration(spec).fetch !== "none";
  const craft = craftFindings(structural, composed.deck ?? { slides: [] }, { standings, picturesSupplied: baseDir ? await suppliedPictures(baseDir) : 0 })
    .map((f) => (awaitsFetch && FETCHED_AT_BUILD.has(f.code) && isBlocker(f) ? { ...f, severity: "advisory", pending: "decided when the build fetches the logos the pages plan; the compile does not fetch" } : f));
  if (awaitsFetch) for (const st of standings) if (FETCHED_AT_BUILD.has(st.code)) st.blocks = false;
  // What the build would fetch and the deck's folder does not hold, said at the compile - a draft too - with the choices (asset-needs.mjs).
  const assets = baseDir ? await assetFindings(spec, baseDir) : { statement: null, findings: [] };

  // --- every finding, with its class and, for a draft, whether it is held yet
  const classed = (list, more = {}) => list.map((f) => ({ ...f, ...more, class: classOf(f.code) }));
  const gathered = [
    ...classed(compiled), ...classed(bindingFindings), ...classed(composingShown), ...classed(unfitShown), ...classed(undrawable), ...classed(spineFindings), ...classed(inventory),
    ...classed(structure.findings).map((f) => (f.class === "S" && standIn ? { ...f, provisional: standIn } : f)),
    ...classed(provisionalShape.findings, { provisional: standIn ?? "not every page composed" }), ...classed(stages),
    ...classed(local.depends), ...classed(local.design), ...classed(local.kept), ...classed(gateFindings), ...classed(craft), ...classed(assets.findings),
  // An aggregate read while pages are missing is read from the pages that composed, and says so.
  ].map((f) => (f.class === "G" && partial ? { ...f, partial } : f));
  const copy = classed(local.copy);
  // A draft is the spine, and the storyline critique is then bound to it. So a draft holds everything whose repair writes a
  // field the critique binds (gates/gate_classes.mjs REPAIRS, storyline.mjs BOUND_FIELDS): compile refusals, the spine's own
  // rules, the content plan's rules on claims, the dependency contract on what each page declares, a structure rule no
  // allocation of forms and placements satisfies. What the copy, the layout or the fit settles is reported, and enforced by the full compile.
  const unmet = new Map((draft ? structurePlan(doc, insights).unsatisfied : []).map((u) => [u.code, u]));
  const NO_ALLOCATION = "No allocation of forms and commentary placements satisfies this rule (`--plan` prints the closest one found): what mends it is another page type, another page, or other evidence on a page - which the storyline critique is bound to, so settle it before the critique";
  // A structure or aggregate rule the layout can usually mend is the spine's where the plan's allocation cannot satisfy it.
  const settled = gathered.map((f) => (draft && isBlocker(f) && waitsFor(f) && boundOnly(f.code).length && unmet.has(f.code) ? { ...f, touches: boundOnly(f.code), repair: `${f.repair ?? ""} ${NO_ALLOCATION}`.trim() } : f));
  // One the draft's own reading does not raise, and the allocation still leaves broken, is said too: the plan and the draft refuse the same spines.
  for (const [code, u] of unmet) if (!settled.some((f) => f.code === code && isBlocker(f)))
    settled.push({ ...(u.finding ?? { code, severity: "blocker" }), code, severity: "blocker", class: classOf(code), touches: boundOnly(code).length ? boundOnly(code) : ["pages"],
      repair: `${u.standing ? `${readStandings([u.standing])[0].line}. ` : u.finding?.repair ? `${u.finding.repair} ` : ""}${NO_ALLOCATION}` });
  const spineCodes = new Set([...compiled, ...bindingFindings, ...unfit, ...undrawable, ...spineFindings, ...inventory].map((f) => f.code));
  const holds = (f) => isBlocker(f) && (!draft || spineCodes.has(f.code) || !waitsFor(f));
  const copyHolds = (f) => isBlocker(f) && !(draft && COPY_CODES.test(f.code));
  const findings = settled.filter(holds);

  // --- the fit search: other forms and placements for a page that does not fit
  const authored = new Map([...doc.pages, ...(doc.appendix || [])].map((page, index) => [String(page?.id ?? `page-${index + 1}`), { page, index }]));
  // `fitPages` keeps the search to the pages a page run reports.
  const misfit = [...new Set([...findings, ...copy.filter(copyHolds)].filter((f) => f.class === "P" && LAYOUT_CODES.has(f.code) && f.id !== undefined && authored.has(String(f.id)) && !uncompiled.has(String(f.id))).map((f) => String(f.id)))]
    .filter((id) => !fitPages || fitPages.has(id));
  let fits = new Map();
  if (fit && misfit.length && typed.length) {
    const baseline = new Set([...structure.findings, ...provisionalShape.findings, ...(complete && scene.ran ? scene.all.filter((f) => f.code === "PAGE_SHAPE_FLAT") : [])].filter((f) => isBlocker(f) && classOf(f.code) === "S").map((f) => f.code));
    const compileOne = (page, index) => { const one = compileDeck({ ...doc, pages: [page], appendix: [] }, { insights, partial: true }); const refused = one.bindingFindings[0]?.repair ?? one.compileErrors[0]; if (refused) throw new Error(refused); return { ...one.spec.slides[0], id: one.spec.slides[0].id ?? `page-${index + 1}` }; };
    const alone = new Map();
    const swapped = (id, slide) => { const swap = (list) => (list || []).map((s) => (String(s.id) === id ? slide : s)); return { ...structural, slides: swap(structural.slides), ...(structural.appendix ? { appendix: swap(structural.appendix) } : {}) }; };
    fits = await fitSearch(misfit.map((id) => ({ id, ...authored.get(id) })), {
      spec, deck: composed.deck, perPage: fitCap,
      // An alternative is compiled from the page as written, references and all: a form its measures cannot fill is refused here as a form its typed data cannot.
      compile: compileOne,
      compose: (variant) => composeForAuthoring(variant, baseDir),
      // One page compiled and composed on its own, as text: the slide without its record (what the page says of itself is not drawn), and the nodes of the page.
      drawn: async (page, index) => {
        const key = JSON.stringify(page);
        if (!alone.has(key)) alone.set(key, (async () => {
          let slide;
          try { slide = compileOne(page, index); } catch { return { slide: null, scene: null }; }
          const { pageType: _record, ...shown } = slide;
          const one = await composeForAuthoring({ ...spec, slides: [slide], appendix: undefined }, baseDir);
          return { slide: JSON.stringify(shown), scene: one.deck && !(one.pageErrors || []).length ? JSON.stringify(one.deck.slides.map((s) => s.nodes)) : null };
        })());
        return alone.get(key);
      },
      pageGates: (deck) => { const gated = sceneGateFindings(deck, undefined, spec); return { ran: gated.ran, findings: gated.all, budget: gated.budget }; },
      // The deck's median words a block with the page swapped, estimated from the scene (TEXT_FRAGMENTED): an alternative that takes it out of its band, or further out, is not proposed.
      aggregate: (id, blocks) => fragmentationShift(scene.budget ?? [], id, blocks),
      localFindings: (variant, deck, pages) => { const swap = (list) => (list || []).map((page) => pages.get(String(page?.id)) ?? page);
        const found = localFindings({ doc: { ...doc, pages: swap(doc.pages), appendix: swap(doc.appendix) }, structural: variant, deck, spec: variant, insights, uncomposed: new Set(), uncompiled: new Set() });
        return [...found.depends, ...found.design, ...found.kept, ...found.copy].filter((f) => f.id !== undefined && classOf(f.code) === "P"); },
      // The structure rules a swap would newly break: the contract and the plan's gates on the swapped deck, and the page's architecture in PAGE_SHAPE_FLAT.
      structure: (id, slide) => { const after = [...declaredStructure(swapped(id, slide), { planOf }).findings, ...shapeStructure(shapesWith({ id, slide }), { airy }).findings];
        return [...new Set(after.filter((f) => isBlocker(f) && classOf(f.code) === "S" && !baseline.has(f.code)).map((f) => f.code))]; },
      brief: briefOf,
      known: (target) => fitCache?.get(target) ?? null, learned: (target, verdicts) => fitCache?.set(target, verdicts),
    });
  }
  const withFit = (f) => (f.class === "P" && LAYOUT_CODES.has(f.code) && fits.has(String(f.id)) ? { ...f, alternatives: fits.get(String(f.id)) } : f);

  // --- where the deck stands against every structure and aggregate rule ----
  const read = readStandings([...structure.standings, ...provisionalShape.standings, ...gateStandings, ...standings, ...(local.report.standings || []),
    // The two aggregates only a render measures are named, so their rules are met here first; the words a block are
    // estimated from the scene where the page gates ran (gates/density_profile.py scene_fragmentation), and marked so.
    ...["DECK_THIN_PAGES", "TEXT_FRAGMENTED"].filter((code) => !gateStandings.some((st) => st.code === code)).map((code) => ({ code, what: code === "TEXT_FRAGMENTED" ? "median words a block on the prose pages" : "pages the render shows thin or half empty", unmeasured: "measured on the render (--check --render)" }))],
    { provisional: standIn, partial });
  const order = [...doc.pages, ...(doc.appendix || [])].map((page, index) => String(page?.id ?? `page-${index + 1}`));
  const blocking = inClassOrder([...findings, ...copy.filter(copyHolds)].map(withFit), order);
  // What a draft leaves to the full compile says which of the copy, the layout and the fit settles it.
  const advisories = inClassOrder([...settled.filter((f) => !holds(f)), ...copy.filter((f) => !copyHolds(f))].map((f) => (draft && isBlocker(f) ? { ...f, deferred: true, settledBy: waitsFor(f) ?? "copy" } : f)), order);
  // Each composed page's own counts of what the craft rates read over the deck (sceneStatistics), by page id: what a page run reports of its part in them.
  const parts = {};
  for (const slide of composed.deck?.slides ?? []) {
    const id = String(slide.sourceSlideId ?? slide.id), own = sceneStatistics({ slides: [slide] });
    parts[id] = Object.fromEntries(Object.entries(own).filter(([, n]) => typeof n === "number").map(([key, n]) => [key, (parts[id]?.[key] ?? 0) + n]));
  }
  return { spec, deck: composed.deck ?? { slides: [] }, failedIds, compiled: !compiled.length, complete, unmapped: waiting, declared, assets: assets.statement, parts,
    findings: findings.map(withFit),
    // A draft has no copy yet: what the copy settles is reported, not enforced.
    pageGateAdvisories: settled.filter((f) => !holds(f)),
    pageGatesRan: scene.ran, pageGatesError: scene.ran ? null : scene.reason, budget: scene.budget ?? [],
    content: local.content, contentReport: local.report, blocking, advisories, standings: read, order, fits };
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

// The worked pages `--example` and `--scaffold` print: the worked deck, which
// uses every type, then one standing-alone page for each form the deck does
// not draw. Between them every form in the catalogue has a page.
const EXAMPLE_FILES = ["../examples/page-types.pages.json", "../examples/page-forms.pages.json"].map((file) => new URL(file, import.meta.url));

/** Every worked page, the worked deck's first, with the deck-level keys of that deck. */
export function workedExamples() {
  const files = EXAMPLE_FILES.map((file) => readJsonSync(file));
  return { deck: files[0].deck, pages: files.flatMap((file) => [...file.pages, ...(file.appendix || [])]) };
}

/**
 * A page of `type` that compiles, to fill in: the worked example's shape and
 * data, with a fresh id and prompts where the page's own claim goes (see
 * scaffoldReport, which also says how far the page is bound to an insight).
 */
export const scaffoldPage = (type, options = {}) => scaffoldReport(type, options).page;

/** A worked page as a scaffold starts from it: a fresh id, and prompts where the page's own claim, source and reasons go. */
function scaffoldBase(source, type, id) {
  const page = structuredClone(source);
  Object.assign(page, { id, title: "(Action title: the finding and its comparator)", why: `(Why a ${type} page: ${PAGE_TYPES[type].task})` });
  delete page.subtitle;
  if (typeof page.source === "string") page.source = "(publisher, title, date)";
  if (page.settles) page.settles = { kind: page.settles.kind, what: "(What settles the claim: the data, its basis and its period)" };
  if (typeof page.adds === "string") page.adds = "(What the commentary says that the exhibit cannot)";
  return page;
}

// What of a page still carries typed numbers: an exhibit or a figure that names no measure and prints no token.
const refersTo = (node) => /"measure"\s*:|\{\{/.test(JSON.stringify(node ?? null));
function typedParts(page) {
  const exhibits = [["exhibit", page.exhibit], ...(Array.isArray(page.exhibits) ? page.exhibits.map((ex, i) => [`exhibits[${i}]`, ex]) : [])].filter(([, ex]) => ex && typeof ex === "object");
  const numeric = (ex) => plottedValues(ex) > 0 || (Array.isArray(ex.rows) && /\d/.test(JSON.stringify(ex.rows))) || (Array.isArray(ex.items) && ex.items.some((item) => /\d/.test(String(item?.value ?? ""))));
  return [...exhibits.filter(([, ex]) => !refersTo(ex) && numeric(ex)).map(([at]) => at),
    ...(Array.isArray(page.metrics) ? page.metrics.map((m, i) => [`metrics[${i}]`, m]) : []).filter(([, m]) => m && !refersTo(m)).map(([at]) => at), ...(page.kpi && !refersTo(page.kpi) ? ["kpi"] : [])];
}

/**
 * A scaffold of `type`, and how far it is bound: `{ page, bound, form, typed,
 * fallback }`. With no insight it is the worked example of the type's first
 * form (or of `form`), to copy the shape of.
 *
 * With an insight the page names it as its `evidence` (which settles the
 * claim), and an insight that records measures is bound, not copied: the
 * exhibit's series, its table's cells, its figures and the page's metrics
 * name the measures and the runtime writes the numbers (bind.mjs). The form is
 * the one asked for, otherwise the first of the type's forms the insight's
 * measures fill completely - a mix of one measure fills a donut, not a
 * stacked column; eight single values fill a fact grid, not the chart under a
 * hero number - then the first they fill in part (`typed` lists what still
 * holds the worked example's numbers). `bound` lists the measures named.
 * Where no form of the type takes the measures, the page is the worked
 * example with the insight named - its `data` copied in where the form reads
 * it - and `fallback` says why, form by form. A page bound to the author's
 * insight carries none of the worked example's own words about its own
 * subject: the exhibit's heading, caption and callouts, and the page's
 * commentary, are prompts to write (the commentary keeps the example's where
 * prompts would not compile).
 */
export function scaffoldReport(type, { id = "p00", form = null, insight = null, example = workedExamples() } = {}) {
  if (!PAGE_TYPES[type]) throw new Error(`No page type "${type}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  const worked = example.pages.filter((p) => p.type === type);
  if (form && !Object.hasOwn(PAGE_TYPES[type].forms, form)) throw new Error(`No form "${form}" of a ${type} page; one of ${Object.keys(PAGE_TYPES[type].forms).join(", ")}`);
  // The first worked page of each form, in the catalogue's order of pages.
  const sources = worked.filter((p, at) => (!form || p.form === form) && worked.findIndex((other) => other.form === p.form) === at);
  if (!sources.length) throw new Error(`No worked example of "${type}${form ? `/${form}` : ""}" to scaffold from`);
  if (!insight) return { page: scaffoldBase(sources[0], type, id), bound: [], form: sources[0].form, typed: [], fallback: null };
  const needs = TYPE_SHAPES[type];
  if (needs && !needs.includes(insight.shape))
    throw new Error(`${insight.id} is shaped as ${insight.shape}, which a ${type} page cannot rest on (it needs ${needs.join(" or ")}); ${insight.shape} carries ${typesForShape(insight.shape).asking.join(", ") || "only the types that ask for no shape"}`);
  const measured = insight.measures && typeof insight.measures === "object" && Object.keys(insight.measures).length > 0;
  const attempts = !measured ? [] : sources.map((source) => {
    const named = { ...scaffoldBase(source, type, id), evidence: [insight.id] };
    delete named.settles;
    const { claimed, why } = bindScaffold(named, insight);
    if (!claimed.length) return { form: source.form, page: null, why: why ?? "the form's exhibit takes no measure" };
    // The page with prompts for its commentary too, where that still compiles; else with the example's commentary under the bound exhibit.
    let refusal = null;
    const page = [promptedCommentary(named), named].find((candidate) => { refusal = scaffoldRefusal(candidate, insight); return !refusal; }) ?? null;
    if (!page) return { form: source.form, page: null, why: `bound to ${claimed.join(", ")}, it does not compile (${String(refusal).replace(`${id}: `, "").slice(0, 200)})` };
    page.settles = { measures: claimed };
    if ((insight.cite || []).length) delete page.source;
    return { form: source.form, page, claimed, typed: typedParts(page) };
  });
  const taken = attempts.find((a) => a.page && !a.typed.length) ?? attempts.find((a) => a.page);
  if (taken) return { page: taken.page, bound: taken.claimed, form: taken.form, typed: taken.typed, fallback: null,
    passed: attempts.slice(0, attempts.indexOf(taken)).map((a) => ({ form: a.form, why: a.page ? `it leaves ${a.typed.join(", ")} holding the worked example's numbers` : a.why })) };
  // Nothing binds: the worked example, with the insight named and its `data` copied in where the form reads it.
  const page = { ...scaffoldBase(sources[0], type, id), evidence: [insight.id] };
  delete page.settles;
  const ex = page.exhibit, data = insight.data && typeof insight.data === "object" ? insight.data : null;
  if (ex && data) {
    const reads = dataKeys(`${ex.type ?? ""}`, { type, form: page.form });
    for (const key of Object.keys(data)) if (key in ex || reads.includes(key)) ex[key] = structuredClone(data[key]);
    // Marks that named the example's categories are moved to the insight's.
    const categories = Array.isArray(ex.categories) ? ex.categories.map(String) : null;
    if (categories?.length) for (const list of [ex.annotations, ex.highlights]) for (const mark of list || []) if (mark && typeof mark === "object" && mark.category !== undefined && !categories.includes(String(mark.category))) mark.category = categories.at(-1);
  }
  return { page, bound: [], form: page.form, typed: typedParts(page),
    // One line a reason, with the forms it holds for.
    fallback: measured ? [...attempts.reduce((byWhy, a) => byWhy.set(a.why, [...(byWhy.get(a.why) ?? []), a.form]), new Map())].map(([why, forms]) => `${forms.join(", ")}: ${why}`)
      : [`${insight.id} records no \`measures\`${data ? "; its `data` is copied into the exhibit" : ""}`] };
}

/** Why a scaffold that names an insight's measures does not bind and compile, or null where it does: a form the measures cannot fill is passed over. */
// Said with the executive summary's worked page and scaffold: its exhibit is part of what the critique reads, so it is declared
// with the spine and not added at the layout, where it would change the bound argument.
const SUMMARY_AT_SPINE = "An executive summary's exhibit - the answer table, or `metrics` - is part of the spine: words alone do not fill the page inside its ceiling, so write it before the critique, its cells the calls in words or numbers by reference, and `--draft` proves the page fills (SPINE_UNFILLED); a `basis` stub declares it too, and is proven once its rows are written.";

function scaffoldRefusal(page, insight) {
  const log = new Map([[insight.id, insight]]);
  const written = bindDeck({ pages: [page] }, log);
  if (written.findings.length) return written.findings[0].repair;
  try { compilePage(withoutDependencies(written.doc.pages[0]).page, 0, { insights: insight.shape ? log : null }); return null; } catch (error) { return error.message; }
}

// The worked example's words about its own subject, as prompts: what a scaffold bound to the author's insight says in their place.
const PROMPTS = Object.freeze({ heading: "(Exhibit heading: what is measured, for whom, in which unit)", caption: "(Caption: what the exhibit shows that the title claims)",
  annotation: "(What happened here, and why it matters)", point: "(A point: what the reader should take from the exhibit, with its number written by reference)",
  lead: "(Its lead)", line: "(The one implication the page closes on, in a sentence of ten words or more)", cell: "(What this row means for the claim)", text: "(What the figure says for the claim)" });

/** A bound exhibit with prompts where the example's heading, caption and callouts stood. */
function promptExhibit(ex) {
  if (typeof ex.heading === "string") ex.heading = PROMPTS.heading;
  if (typeof ex.caption === "string") ex.caption = PROMPTS.caption;
  for (const mark of Array.isArray(ex.annotations) ? ex.annotations : []) if (mark && typeof mark === "object" && typeof mark.text === "string") mark.text = PROMPTS.annotation;
}

/** A copy of a scaffold with prompts where the example's commentary stood: its points, its closing line, its rail; the phrases it highlighted go with them. */
function promptedCommentary(pageIn) {
  const page = structuredClone(pageIn);
  if (Array.isArray(page.points)) page.points = page.points.map((point) => (point && typeof point === "object" ? { ...point, ...(point.lead !== undefined ? { lead: PROMPTS.lead } : {}), text: PROMPTS.point } : PROMPTS.point));
  for (const key of ["bar", "rail"]) if (typeof page[key] === "string") page[key] = PROMPTS.line;
  if (typeof page.takeaway === "string") page.takeaway = PROMPTS.line;
  delete page.highlight;
  return page;
}

// The most measures a scaffolded table sets side by side, and the most rows it writes.
const SCAFFOLD_TABLE = Object.freeze({ measures: 5, rows: 12 });

/**
 * A scaffold's exhibits and figures named after the insight's measures, in
 * place: `claimed`, the measures the page now rests its claim on - none where
 * the insight records nothing the page's exhibits can take, and then `why`.
 *
 *   a chart of series       the measures over one axis in one unit (every unit
 *                           on an indexed trend, or as aligned bars)
 *   several charts          one measure each, in turn (a page of panels)
 *   a bridge                the one measure whose members are its opening
 *                           total, its steps and its closing total
 *   a pie or a donut        the one measure whose members are the slices
 *   a lookup table          a token a cell: the members down the side and a
 *                           measure a column, or a measure a row over the periods
 *   a fact grid, stat list  a figure an item, each naming its measure
 *   metrics, a hero figure  each naming its measure
 */
function bindScaffold(page, insight) {
  const measures = Object.entries(insight.measures && typeof insight.measures === "object" ? insight.measures : {}).map(([name, m]) => ({ ref: `${insight.id}/${name}`, name, m, axis: axisOf(m) }));
  const claimed = [], reasons = [];
  const series = measures.filter((x) => x.axis.kind !== "scalar");
  // A figure's format keeps the number it prints (bind.mjs): one decimal place, or as many as the value needs.
  const formatOf = (x, at = -1) => { const value = valuesOf(x.m).at(at); return `0.${"0".repeat(Math.max(1, typeof value === "number" ? decimalsNeeded(value, { percent: isPercentUnit(x.m.unit) }) : 1))}`; };
  // One scale is one axis and one unit: the first measure's, and every other that shares both. An indexed trend takes every
  // series, whatever its unit, rebased; aligned bars give each measure a column and a unit of its own, four at most.
  const indexed = page.type === "trend" && page.form === "indexed", aligned = page.type === "ranking" && page.form === "aligned-bars";
  const shares = (x) => x.axis.labels.some((label) => series[0].axis.labels.includes(label));
  const together = series.filter((x) => x.axis.kind === series[0].axis.kind && shares(x) && (indexed || aligned || normalUnit(x.m.unit) === normalUnit(series[0].m.unit))).slice(0, aligned ? 4 : undefined);
  const charts = [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object");
  const bindChart = (ex, drawn) => {
    const last = drawn[0].axis.labels.at(-1);
    for (const list of [ex.annotations, ex.highlights]) for (const mark of list || []) if (mark && typeof mark === "object" && mark.category !== undefined) mark.category = last;
    for (const key of ["categories", "labels", "values", "unit", "referenceLines", "forecastFrom", "periods", "totals", "focusSeries", "max", "targets", "ranges"]) delete ex[key];
    if (Array.isArray(ex.series)) {
      ex.series = drawn.map((x) => ({ measure: x.ref, name: x.name }));
      if (indexed) { if (drawn.some((x) => x.m.base !== undefined)) delete ex.indexBase; else ex.indexBase = drawn[0].axis.labels[0]; ex.subject = drawn[0].name; }
    } else ex.measure = drawn[0].ref;
    claimed.push(...(Array.isArray(ex.series) ? drawn : drawn.slice(0, 1)).map((x) => x.ref));
    promptExhibit(ex);
  };
  charts.forEach((ex, at) => {
    const bridge = Array.isArray(ex.values) && Array.isArray(ex.categories) && Array.isArray(ex.totals);
    const slices = Array.isArray(ex.values) && Array.isArray(ex.labels);
    // A profiles page introduces the players by their marks: its exhibit is not a measure drawn.
    if (page.type === "profiles") reasons.push("a profiles page introduces the players by their marks, and its exhibit takes no measure: write each player's numbers into its cells by reference");
    else if (Array.isArray(ex.series) || slices) {
      // One exhibit takes the measures that share a scale; several take one each, in turn, and a panel past the last measure is dropped while the page keeps two.
      const drawn = charts.length > 1 ? series.slice(at, at + 1) : together;
      if (drawn.length) bindChart(ex, drawn);
      else reasons.push(charts.length > 1 ? `panel ${at + 1} has no measure left to plot (the insight records ${series.length} over periods or members)` : "the insight records no measure over periods or members for the chart to plot");
    } else if (bridge) {
      // A bridge is one measure over its members: the opening total, each step, the closing total.
      const whole = series.find((x) => x.axis.kind === "members" && x.axis.labels.length >= 3);
      if (whole) { bindChart(ex, [whole]); ex.totals = [0, whole.axis.labels.length - 1]; }
      else reasons.push("a bridge is one measure whose members are its opening total, its steps and its closing total, and the insight records none over three or more members");
    } else if (Array.isArray(ex.rows) && Array.isArray(ex.columns) && page.type === "lookup") {
      const table = tokenTable(measures, formatOf, ex.columns.some((c) => c && typeof c === "object" && c.implication));
      if (table) { for (const key of ["total", "highlightRow"]) delete ex[key]; Object.assign(ex, { columns: table.columns, rows: table.rows }); claimed.push(...table.refs); promptExhibit(ex); }
      else reasons.push("the insight records no measure a table can set out");
    } else if (Array.isArray(ex.rows) && Array.isArray(ex.columns)) {
      reasons.push(`the table of a ${page.type} page codes a judgement a cell, which no measure records; the measures' numbers set out side by side are a lookup page (\`--scaffold lookup --evidence ${insight.id}\`)`);
    } else if (Array.isArray(ex.items) && page.type === "numbers") {
      const shown = (measures.filter((x) => x.axis.kind === "scalar").length ? measures.filter((x) => x.axis.kind === "scalar") : measures).slice(0, Math.max(ex.items.length, 2));
      const keeps = new Set(ex.items.flatMap((item) => Object.keys(item ?? {})));
      if (shown.length >= 2) { ex.items = shown.map((x) => ({ measure: x.axis.kind === "scalar" ? x.ref : `${x.ref}@${x.axis.labels.at(-1)}`, format: formatOf(x), ...(keeps.has("label") ? { label: `(${x.name}: what the number is)` } : {}), text: PROMPTS.text })); claimed.push(...shown.map((x) => x.ref)); }
      else reasons.push("a grid or list of figures takes two or more numbers, and the insight records one");
    }
  });
  if (charts.length > 1) {
    // The panels the insight's measures filled are kept; one still holding the example's numbers goes where the page keeps enough without it.
    const bound = (page.exhibits || []).filter(refersTo), [lo] = Array.isArray(PAGE_TYPES[page.type].exhibits) ? PAGE_TYPES[page.type].exhibits : [PAGE_TYPES[page.type].exhibits];
    if (bound.length >= Math.max(lo, 1) && bound.length < page.exhibits.length) page.exhibits = bound;
  }
  const figure = (x) => ({ measure: x.axis.kind === "scalar" ? x.ref : `${x.ref}@${x.axis.labels.at(-1)}`, format: formatOf(x), label: `(${x.name}: what the number is)` });
  const single = measures.filter((x) => x.axis.kind === "scalar");
  const printed = single.length ? single : measures;
  if (Array.isArray(page.metrics) && printed.length) { page.metrics = printed.slice(0, page.metrics.length).map(figure); claimed.push(...printed.slice(0, page.metrics.length).map((x) => x.ref)); }
  if (page.kpi && typeof page.kpi === "object" && printed.length) { page.kpi = figure(printed[0]); claimed.push(printed[0].ref); }
  return { claimed: [...new Set(claimed)], why: reasons[0] ?? (charts.length || page.metrics || page.kpi ? null : `a ${page.type}/${page.form} page carries no exhibit or figure that takes a measure`) };
}

/**
 * A table that prints an insight's measures by reference, a token a cell:
 * the members down the side and a measure a column, where the measures run
 * over members; a measure a row over its periods otherwise; a row a single
 * value where they are all that. `{ columns, rows, refs }`, or null where
 * there is no measure, or too few rows to make a table.
 */
function tokenTable(measures, formatOf, implication) {
  const close = implication ? [{ label: "What it means", implication: true }] : [], cell = implication ? [PROMPTS.cell] : [];
  const over = (kind) => measures.filter((x) => x.axis.kind === kind);
  const token = (x, label, at) => (typeof valuesOf(x.m)[at] === "number" ? `{{${x.ref}${label === null ? "" : `@${label}`} | ${formatOf(x, at)}}}` : "n/a");
  const headed = (x) => ({ label: x.name, ...(typeof x.m.unit === "string" && x.m.unit.trim() ? { unit: x.m.unit } : {}) });
  const members = over("members");
  if (members.length) {
    // The measures that run over the first one's members, side by side.
    const labels = members[0].axis.labels, shown = members.filter((x) => x.axis.labels.some((label) => labels.includes(label))).slice(0, SCAFFOLD_TABLE.measures);
    const rows = labels.slice(0, SCAFFOLD_TABLE.rows).map((label) => [label, ...shown.map((x) => (x.axis.labels.includes(label) ? token(x, label, x.axis.labels.indexOf(label)) : "n/a")), ...cell]);
    return rows.length >= 3 ? { columns: ["(What the rows are)", ...shown.map(headed), ...close], rows, refs: shown.map((x) => x.ref) } : null;
  }
  const periods = over("periods");
  if (periods.length) {
    const labels = periods[0].axis.labels.slice(-6), shown = periods.slice(0, SCAFFOLD_TABLE.rows);
    const rows = shown.map((x) => [`${x.name}${typeof x.m.unit === "string" && x.m.unit.trim() ? `, ${x.m.unit}` : ""}`, ...labels.map((label) => (x.axis.labels.includes(label) ? token(x, label, x.axis.labels.indexOf(label)) : "n/a")), ...cell]);
    return rows.length >= 3 ? { columns: ["(What the rows are)", ...labels, ...close], rows, refs: shown.map((x) => x.ref) } : null;
  }
  const single = over("scalar").slice(0, SCAFFOLD_TABLE.rows);
  return single.length >= 3 ? { columns: ["(What the rows are)", "Value", ...close], rows: single.map((x) => [`${x.name}${typeof x.m.unit === "string" && x.m.unit.trim() ? `, ${x.m.unit}` : ""}`, token(x, null, 0), ...cell]), refs: single.map((x) => x.ref) } : null;
}

// The craft rates read over the deck's exhibits, by what each counts in a page's own statistics (gates/craft_gates.mjs sceneStatistics).
const CRAFT_RATES = Object.freeze({
  CRAFT_CHARTS_BARE: { of: "charts", done: "chartsAnnotated", noun: "chart page", verb: "marking something on the plot" },
  CRAFT_TABLES_PLAIN: { of: "tables", done: "tablesTreated", noun: "table", verb: "carrying a treatment" },
});

const USAGE = "Usage: author-deck.mjs <id>.pages.json [--check [--render] | --draft | --plan | --log | --repair-relation <page-id>] [--page <id>[,<id>...]] [--fit-cap <n>] | --types | --schema [type | deck] | --limits [<type>[/<form>]] | --example <type>[/<form>] | --scaffold <type>[/<form>] [--evidence <insight-id>]";

const digest = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 24);
const CACHE_SCHEMA = "professional-slides.author-cache/v1";

/**
 * The fit search's memory, `<id>.author-cache.json` beside the pages file:
 * for each page searched, the verdict on every alternative composed for it.
 * A page's entry is used only when its key matches - the page as written,
 * the two pages before it (the composer varies a page's devices against its
 * neighbours), the deck's own keys, its sources, its sections, the insight
 * log, the cap, and the runtime's files - so an edit to any of them searches
 * again. The file holds nothing else and is safe to delete.
 */
async function openFitCache(file, { doc, insights, fitCap }) {
  const stored = await readJson(file, { optional: true }).catch(() => null);
  const before = stored?.schema === CACHE_SCHEMA && stored.fits && typeof stored.fits === "object" ? stored.fits : {};
  const runtime = path.dirname(fileURLToPath(import.meta.url));
  const stamp = [runtime, path.join(runtime, "gates")].flatMap((dir) => readdirSync(dir).filter((name) => /\.(mjs|py|json)$/.test(name)).sort().map((name) => { const at = statSync(path.join(dir, name)); return `${name}:${at.size}:${Math.round(at.mtimeMs)}`; }));
  const pages = [...doc.pages, ...(doc.appendix || [])];
  const context = digest([doc.deck, doc.sources ?? null, pages.filter((page) => page?.kind).map((page) => [page.kind, page.title]), insights ? [...insights.values()] : null, insights?.analysis?.results ?? null, fitCap, stamp]);
  const keyOf = (target) => digest([context, pages[target.index - 2] ?? null, pages[target.index - 1] ?? null, target.page]);
  // An entry outlives the run that wrote it only while its page is still in the deck; its key is checked whenever it is read.
  const ids = new Set(pages.map((page, index) => String(page?.id ?? `page-${index + 1}`)));
  const after = Object.fromEntries(Object.entries(before).filter(([id, entry]) => ids.has(id) && entry && typeof entry.key === "string" && Array.isArray(entry.verdicts)));
  return {
    get(target) { const hit = after[target.id]; return hit && hit.key === keyOf(target) ? hit.verdicts : null; },
    set(target, verdicts) { after[target.id] = { key: keyOf(target), verdicts }; },
    async save() { if (JSON.stringify(after) !== JSON.stringify(before)) await (Object.keys(after).length ? writeJson(file, { schema: CACHE_SCHEMA, note: "The fit search's verdicts (author-deck.mjs). Safe to delete.", fits: after }) : fs.rm(file, { force: true })); },
  };
}

/**
 * The deck emitted and rendered by the build's own stages, in a temporary
 * folder, and what the build would say of it: its blockers, the render
 * gates' advisories, and where the rendered deck stands. Nothing is fetched,
 * and nothing is written beside the pages file. `named` renders those pages
 * alone, and then only what the build says of a page is read.
 */
async function renderCheck(compiled, { dir, stem, named }) {
  if (!compiled.complete) return { ran: false, reason: "not every page compiled and composed; the render is of the deck as the build will build it" };
  const work = mkdtempSync(path.join(os.tmpdir(), "author-render-"));
  try {
    let result;
    try { result = await buildDeck(path.join(dir, `${stem}.deck.json`), path.join(work, "out"), { fetchLogos: false, only: named, source: { spec: compiled.spec, baseDir: dir, content: compiled.content, plan: planOf(compiled.spec) } }); }
    catch (error) {
      if (!isRefusal(error)) throw error;
      return { ran: false, reason: `the build refuses the deck before it renders (${error.code})`, blockers: [{ code: error.code, severity: "blocker", repair: error.message, class: classOf(error.code) }], advisories: [], standings: [] };
    }
    const scene = readJsonSync(result.scenePath);
    const idOf = (slide) => { const page = scene.slides[Number(slide) - 1]; return page ? page.sourceSlideId ?? page.id : undefined; };
    const local = (list) => (named ? list.filter((f) => f.class === "P") : list);
    const blockers = local(result.blockers.map((b) => ({ code: b.code, ...(b.id ?? (b.slide !== undefined && b.slide !== null ? idOf(b.slide) : undefined) ? { id: b.id ?? idOf(b.slide) } : {}), severity: "blocker", source: b.source,
      ...(b.codes ? { codes: b.codes } : {}), ...(b.origin ? { origin: b.origin } : {}), class: classOf(b.code),
      repair: (b.repair ?? (b.text ? `"${b.text}"` : `the build's ${b.source} blocked the deck`)) +
        (FETCHED_AT_BUILD.has(b.code) && assetsDeclaration(compiled.spec).fetch !== "none" ? " (This check fetches nothing, as a build with --no-fetch does: put the files in assets/logos/, or build with the network, and the logos the pages plan are drawn.)" : "") })));
    const advisories = local((result.gates?.findings ?? result.preflight?.findings ?? []).filter((f) => ["advisory", "info"].includes(f.severity))
      .map((f) => ({ ...f, ...(typeof f.slide === "number" && idOf(f.slide) ? { id: idOf(f.slide) } : {}), class: classOf(f.code) })));
    const profile = result.densityProfile?.report ? readJsonSync(result.densityProfile.report, { optional: true }) : null;
    const numbered = (st) => ({ ...st, ...(st.pages ? { pages: st.pages.map(idOf) } : {}), ...(st.each ? { each: Object.fromEntries(Object.entries(st.each).map(([key, value]) => [idOf(key) ?? key, value])) } : {}) });
    return { ran: Boolean(result.gates), reason: result.renderSkipped ?? null, status: result.status, slides: result.slides, timings: result.timings, blockers, advisories,
      standings: named || !result.gates ? [] : [...(result.gates.standings ?? []).map(numbered), ...(profile?.standings ?? [])] };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

/**
 * The text blocks each page of a spine would set under each choice a plan
 * can take for it, estimated before any copy exists: the page with
 * placeholder copy at a developed length (spine-exhibits.mjs
 * withPlaceholderCopy) is compiled, composed and read by the page budget
 * (gates/density_profile.py scene_blocks). Returns `blocksOf(page, choice)`,
 * null for a page that does not compile or compose so - one whose exhibits
 * are not written yet, mostly - which then says nothing of the deck's median.
 */
async function placementBlocks(doc, { insights, baseDir }) {
  const pages = [...doc.pages, ...(doc.appendix || [])];
  const keyOf = (page, choice) => `${page.id}|${choice.form}|${choice.commentary}`;
  // Each page as bound: an exhibit that names its measures written out, so the placeholder copy can mark a period or member of it.
  const written = bindDeck(doc, insights).doc, bound = [...written.pages, ...(written.appendix || [])];
  const candidates = pages.flatMap((page, index) => freeChoices(page).map((choice) => ({ page: bound[index] ?? page, index, choice })));
  const slides = [];
  let deck = null;
  for (const [at, { page, index, choice }] of candidates.entries()) {
    try {
      const one = compileDeck({ ...doc, pages: [withPlaceholderCopy({ ...page, ...choice })], appendix: [] }, { insights, partial: true });
      deck ??= one.spec;
      if (one.spec.slides[0]) slides.push({ ...one.spec.slides[0], id: `c${at}`, key: keyOf(page, choice), index });
    } catch { /* a page that does not compile under this choice has no estimate */ }
  }
  const found = new Map();
  if (slides.length) {
    const keys = new Map(slides.map((slide) => [slide.id, slide.key]));
    const composed = await composeForAuthoring({ ...deck, slides: slides.map(({ key: _key, index: _index, ...slide }) => slide), appendix: undefined }, baseDir);
    const gated = composed.deck ? sceneGateFindings(composed.deck, undefined, deck) : { budget: [] };
    for (const row of gated.budget ?? []) { const key = keys.get(String(row.id ?? "")); if (key && row.blocks && !found.has(key)) found.set(key, row.blocks); }
  }
  return (page, choice) => found.get(keyOf(page, choice)) ?? null;
}

/**
 * The alternatives the fit search passed, rendered: under `--check --render`
 * an alternative is called verified only once the build's own stages have
 * rendered it. Each page's passing alternatives are rendered a round at a
 * time - round n swaps every such page for its nth passing alternative in one
 * deck, and only those pages are rendered - and each is then marked
 * `rendered`, or moved to the alternatives that fail with what the render's
 * gates refused. Where a round cannot be rendered (another page of the deck
 * does not compose, no renderer) its alternatives stay passes of the scene
 * checks, and say why they were not rendered.
 */
async function verifyFitsOnRender(compiled, { doc, dir, stem, insights }) {
  const authored = new Map([...doc.pages, ...(doc.appendix || [])].map((page, index) => [String(page?.id ?? `page-${index + 1}`), { page, index }]));
  const waiting = [...compiled.fits].filter(([id, fit]) => fit.pass.length && authored.has(id));
  const rounds = Math.max(0, ...waiting.map(([, fit]) => fit.pass.length));
  for (let round = 0; round < rounds; round += 1) {
    const swaps = new Map();
    for (const [id, fit] of waiting) {
      const alt = fit.pass[round];
      if (!alt) continue;
      const { page, index } = authored.get(id);
      const one = compileDeck({ ...doc, pages: [withChoice(page, alt.form, alt.commentary)], appendix: [] }, { insights, partial: true });
      if (one.spec.slides[0]) swaps.set(id, { alt, fit, slide: { ...one.spec.slides[0], id: one.spec.slides[0].id ?? `page-${index + 1}` } });
    }
    if (!swaps.size) continue;
    const swap = (list) => (list || []).map((slide) => swaps.get(String(slide.id))?.slide ?? slide);
    const spec = { ...compiled.spec, slides: swap(compiled.spec.slides), ...(compiled.spec.appendix ? { appendix: swap(compiled.spec.appendix) } : {}) };
    const composed = await composeForAuthoring(spec, dir);
    const whole = Boolean(composed.deck) && !(composed.pageErrors ?? []).length;
    const rendered = whole ? await renderCheck({ complete: true, spec, content: deriveContent(spec, composed.deck) }, { dir, stem, named: new Set(swaps.keys()) })
      : { ran: false, reason: "another page of the deck does not compose, and the build renders the deck whole" };
    for (const [id, { alt, fit }] of swaps) {
      if (!rendered.ran) { alt.unrendered = rendered.reason; continue; }
      const refused = rendered.blockers.filter((f) => String(f.id ?? "") === id);
      if (!refused.length) { alt.rendered = true; continue; }
      fit.pass = fit.pass.map((item) => (item === alt ? null : item));
      fit.fail.push({ form: alt.form, commentary: alt.commentary, remaining: [`passes the scene checks, and the render refuses it: ${[...new Set(refused.map((f) => f.code))].join(", ")}`] });
    }
  }
  for (const [, fit] of waiting) fit.pass = fit.pass.filter(Boolean);
}

/** `--plan`: the spine's structure rules on its declared types, and an allocation of form and placement that satisfies them. Returns the exit code. */
async function planCommand(doc, { dir, stem, file, say, refusal = [] }) {
  let insights = null;
  try { insights = await readInsights(dir, stem, { alternatives: alternativesOf(doc.deck) }); } catch (error) { refusal.push({ code: "COMPILE", message: String(error.message).slice(0, 300) }); console.error(error.message); return 2; }
  const typed = [...doc.pages, ...(doc.appendix || [])].filter((page) => page && typeof page === "object" && !page.kind);
  // A plan is read from a spine: each analytical page says what it is, what it claims and what it rests on.
  const thin = typed.flatMap((page, at) => { const lacks = [!page.id && "id", !(typeof page.title === "string" && page.title.trim()) && "title", !PAGE_TYPES[page.type] && "type",
    insights && TYPE_SHAPES[page.type] && !(Array.isArray(page.evidence) && page.evidence.length) && "evidence"].filter(Boolean);
    return lacks.length ? [`${page.id ?? `page ${at + 1}`}: needs its ${lacks.map((key) => `\`${key}\``).join(", ")}`] : []; });
  if (thin.length) refusal.push({ code: "COMPILE", message: `${thin.length} page${thin.length === 1 ? "" : "s"} of the spine lack an id, a title, a type or evidence` });
  if (thin.length) { console.error(`A plan is made from a spine whose pages each carry an id, a title, a type (one of ${Object.keys(PAGE_TYPES).join(", ")}) and the insights they rest on. ${thin.length} page${thin.length === 1 ? " does" : "s do"} not in ${path.basename(file)}:\n- ${thin.join("\n- ")}`); return 2; }
  // A type the evidence cannot carry is said here, before a form is planned for it.
  const unshaped = insights ? typed.flatMap((page) => { const needs = TYPE_SHAPES[page.type], shapes = (page.evidence || []).map((key) => insights.get(key)?.shape).filter(Boolean);
    return needs && shapes.length && !shapes.some((shape) => needs.includes(shape)) ? [`${page.id}: a ${page.type} page needs evidence shaped as ${needs.join(" or ")}; its insights are ${[...new Set(shapes)].join(", ")} (which carry ${[...new Set(shapes.flatMap((shape) => typesForShape(shape).asking))].join(", ") || "only the types that ask for no shape"})`] : []; }) : [];
  // A page that compiles as written is read as the compile reads it; the rest are read from their declared choices.
  let compiled = new Map();
  try { const { spec } = compileDeck(doc, { insights, partial: true }); compiled = new Map([...spec.slides, ...(spec.appendix || [])].filter((slide) => slide.pageType).map((slide) => [String(slide.id), slide])); }
  catch { compiled = new Map(); }
  // What the critique will read of each page as the spine stands: part of what the plan proposes, since the layout is held to it.
  // The titles the critique will be bound to are composed where the deck's design sets them (spine-fit.mjs), as a draft composes them.
  // And what the spine says each page shows is proven drawable, with the dependency contract on what the pages declare
  // (spine-exhibits.mjs, spineDependencies): everything a draft refuses of the bound facts, the plan refuses too.
  let readings = [], unfit = [], unlayable = [];
  try {
    const spine = compileDeck(doc, { insights, draft: true, partial: true });
    readings = readingLines(spine.spec, insights);
    unfit = spineFitFindings(withStandIns(doc, spine.spec, spine.failed, insights).structural, dir);
    unlayable = [...WEIGHT.applyRulesVersion(spineExhibitFindings(doc, { spec: spine.spec, insights, baseDir: dir, compile: compilerOf(doc, insights), sceneGates: (deck) => sceneGateFindings(deck, undefined, spine.spec) }), spine.spec),
      ...spineDependencies(doc, insights, spine.spec)].filter((f) => isBlocker(f) && !waitsFor(f));
  } catch { readings = []; }
  // Where a placement would leave the deck on the one rule read off the rendered text: estimated from each page composed with placeholder copy.
  let blocksOf = null;
  try { blocksOf = await placementBlocks(doc, { insights, baseDir: dir }); } catch { blocksOf = null; }
  const plan = allocateStructure(doc, { insights, planOf, compiled, blocksOf });
  const estimated = plan.pages.filter((page) => page.estimated).map((page) => String(page.id));
  const fragments = readStandings(plan.structure.standings.filter((st) => st.estimated));
  const read = (structure) => readStandings(structure.standings.filter((st) => classOf(st.code) === "S"));
  const blockers = (structure) => inClassOrder(structure.findings.filter((f) => isBlocker(f) && classOf(f.code) === "S"));
  const count = (source) => plan.pages.filter((page) => page.source === source).length;
  const declared = plan.pages.every((page) => !["proposed", "placed"].includes(page.source)) ? { blocking: blockers(plan.declared).map((f) => f.code), standing: read(plan.declared).map((st) => st.line) } : null;
  const lines = [
    `Plan for ${path.basename(file)}: ${plan.pages.length} analytical pages; ${count("declared")} keep the form and placement they declare, ${count("placed")} keep the form they declare and are given a placement, ${count("proposed")} are given both, ${count("changed")} would change.`,
    ...(estimated.length ? [`${estimated.length} page${estimated.length === 1 ? " has" : "s have"} no exhibit written yet whose kind the form sets (${estimated.join(", ")}): ${estimated.length === 1 ? "its exhibits are" : "their exhibits are"} estimated from the measures and insights ${estimated.length === 1 ? "it names" : "they name"}, and marked below. What the rules say of ${estimated.length === 1 ? "it" : "them"} is a reading of that estimate, read again from the exhibits once they are written.`] : []),
    ...(declared ? [declared.blocking.length ? `As declared${estimated.length ? ", on that estimate," : ","} the deck's structure rules ${estimated.length ? "would refuse" : "refuse"} it: ${[...new Set(declared.blocking)].join(", ")}.`
      : `As declared${estimated.length ? ", on that estimate," : ","} the deck satisfies its structure rules.`] : ["Not every page declares a form and a placement, so the structure rules are read on the proposal."]),
    ...(unshaped.length ? ["", "Types the evidence cannot carry (choose another type, or find the data):", ...unshaped.map((line) => `  ${line}`)] : []),
    "", plan.satisfied ? `Proposed allocation (satisfies every structure rule${estimated.length ? " as far as the pages declare their exhibits" : ""}; nothing was written - copy the choices you take into the pages file):`
      : `No allocation of forms and placements satisfies ${plan.unsatisfied.map((u) => u.code).join(", ")}${plan.capped ? ` within the search's budget (${plan.steps} changes, ${plan.evaluations} readings of the structure)` : ""}; the closest found:`,
    ...plan.pages.map((page) => `  ${String(page.id).padEnd(8)} ${page.type.padEnd(13)} form ${String(page.form).padEnd(18)} commentary ${String(page.commentary).padEnd(12)} ${page.source === "placed" ? "form declared, placement proposed" : page.source}${page.was ? ` (declared ${page.was.form}${page.was.commentary ? `/${page.was.commentary}` : ""})` : ""}${page.estimated ? " - exhibit estimated" : ""}` +
      (page.reads ? ` - taken to meet a structure rule; this form reads ${page.reads.join(", ")}: check the evidence holds it` : "")),
    ...(estimated.length && plan.pages.some((page) => page.source === "changed") ? ["  A change to a declared choice above mends a rule that is broken on the estimate: write the estimated pages' exhibits (or give each its `type`) and run --plan again before taking it."] : []),
    ...(plan.unsatisfied.length ? ["", "Unsatisfied:", ...plan.unsatisfied.map((u) => `  ${u.standing ? readStandings([u.standing])[0].line : `${u.code}: ${u.finding.repair}`}` +
      (u.fixedByTypes ? "\n    The page types alone break this rule: no form or placement can meet it. Change a page's `type`, or mark a deliberate run with a shared `series`." : "")) ] : []),
    ...(unfit.length ? ["", `${unfit.length} title${unfit.length === 1 ? "" : "s"} the storyline critique will be bound to ${unfit.length === 1 ? "does" : "do"} not fit where this deck draws ${unfit.length === 1 ? "it" : "them"} (SPINE_UNFIT; the plan is refused until ${unfit.length === 1 ? "it does" : "they do"}):`, ...unfit.map((f) => `  ${f.repair}`)] : []),
    ...(unlayable.length ? ["", `${unlayable.length} thing${unlayable.length === 1 ? "" : "s"} the storyline critique will be bound to cannot be laid out as the spine declares ${unlayable.length === 1 ? "it" : "them"} (the plan is refused until ${unlayable.length === 1 ? "it is" : "they are"} mended; \`--draft\` refuses the same):`,
      ...inClassOrder(unlayable, typed.map((page) => String(page.id))).map((f) => `  ${f.code} [${f.id}] ${f.repair}`)] : []),
    ...(readings.length ? ["", `${READINGS_NOTE}:`, ...readings.map((line) => `  ${line}`)] : []),
    "", "Where the proposed deck stands (structure rules; the aggregates are measured once pages compose):", ...read(plan.structure).map((st) => `  ${st.line}`),
    ...(fragments.length ? ["", "Estimated, from each page that composes with placeholder copy under its placement - three points of 56 words where it takes points, a chart's own labels counted as the render counts them:",
      ...fragments.map((st) => `  ${st.line}${["over", "short"].includes(st.state) && st.each ? ` | pages ${st.side === "min" ? "under" : "over"} the bar at their placement: ${Object.entries(st.each).filter(([, value]) => (st.side === "min" ? value < st.bar : value > st.bar)).map(([id, value]) => `${id} (${value})`).join(", ")}` : ""}`),
      "  The free choices were steered away from placements that take this median out of its band; no declared choice was changed for it."] : []),
    "", "The plan reads what each page declares: a page that compiles is read as the compile reads it, and a declared form sets its exhibit's kind where the form does. Only what is absent is estimated - the exhibits of a page that has none yet and whose form leaves their kind to the author (panels take two), from the measures its claim names and the shape of its evidence - and such a page is marked. So the plan satisfies the structure rules as far as the declared descriptors go: a rule that counts exhibit kinds can still be met or broken by the exhibits those pages are given, and every compile reads the pages as written again. Where a proposed form asks more of the data than the evidence holds, declare the form it can carry and run --plan again: declared choices are kept and the rest re-allocated. A form built for particular data (an indexed trend, a distribution, small multiples, aligned bars, a diagram other than the type's first) is proposed only where no other allocation meets a rule, and is marked with the data it reads.",
  ];
  console.error(lines.join("\n"));
  // One page a line: `id type/form/commentary source`, the choices to copy into the pages file.
  say(JSON.stringify({ plan: { satisfied: plan.satisfied, ...(plan.capped ? { capped: true } : {}), unsatisfied: plan.unsatisfied.map((u) => ({ code: u.code, fixedByTypes: u.fixedByTypes })),
    pages: plan.pages.map((page) => `${page.id} ${page.type}/${page.form}/${page.commentary} ${page.source}${page.was ? ` (declared ${page.was.form}${page.was.commentary ? `/${page.was.commentary}` : ""})` : ""}${page.reads ? " (reads its own data)" : ""}${page.estimated ? " (exhibit estimated)" : ""}`), ...(estimated.length ? { estimated } : {}), ...(readings.length ? { readings } : {}) },
    ...(declared ? { declared } : {}), ...(unshaped.length ? { evidence: unshaped } : {}), ...(unfit.length ? { unfit: unfit.map((f) => ({ code: f.code, id: f.id, measured: f.measured, repair: f.repair })) } : {}),
    ...(unlayable.length ? { unlayable: unlayable.map((f) => ({ code: f.code, id: f.id, measured: f.measured, repair: f.repair })) } : {}),
    search: { steps: plan.steps, evaluations: plan.evaluations }, standing: { S: read(plan.structure).map((st) => st.line), ...(fragments.length ? { estimated: fragments.map((st) => st.line) } : {}) } }, null, 1));
  // What the run was refused for, as the author log keeps it.
  refusal.push(...plan.unsatisfied.map((u) => ({ code: u.code, class: classOf(u.code), message: String(u.standing ? readStandings([u.standing])[0].line : u.finding.repair).slice(0, 300) })),
    ...[...unfit, ...unlayable].map((f) => ({ code: f.code, class: classOf(f.code), id: String(f.id), message: String(f.repair).slice(0, 300) })));
  return plan.satisfied && !unfit.length && !unlayable.length ? 0 : 2;
}

/** The CLI. Returns the exit code. */
async function main(argv) {
  const { values, positionals: [file] } = parseCli(argv, { types: { type: "boolean" }, schema: { type: "string", bare: "" }, icons: { type: "boolean" }, limits: { type: "string", bare: "" },
    example: { type: "string", bare: "" }, scaffold: { type: "string" }, evidence: { type: "string" }, id: { type: "string" }, out: { type: "string" },
    log: { type: "boolean" }, check: { type: "boolean" }, draft: { type: "boolean" }, "repair-relation": { type: "string", valueName: "a page id" },
    page: { type: "string", valueName: "one or more page ids, comma-separated" }, render: { type: "boolean" }, plan: { type: "boolean" }, "fit-cap": { type: "string", valueName: "a number of alternatives" } }, { usage: USAGE });
  const say = (text) => process.stdout.write(`${text}\n`);
  const listed = await catalogueCommand(values, file, say);
  if (listed !== undefined) return listed;
  if (!file) throw new UsageError(USAGE);
  // The pages file with its parts spliced in (pages-file.mjs): sections authored in separate files are one deck here.
  // A pages file or a part that cannot be read is said in a line, as every other refusal of the file is.
  let doc;
  try { doc = await readPagesFile(file); } catch (error) { console.error(error.message); return 2; }
  const dir = path.dirname(path.resolve(file));
  const stem = doc.deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  // Every run is logged beside the pages file. A finding that comes back run
  // after run is the cost this tool exists to cut: it names a limit the author
  // could not see or a message that did not say what to do, and belongs in the
  // skill as a published budget or a better check (taste-review.md).
  const logPath = path.join(dir, `${stem}.author-log.jsonl`);
  const runs = readRunLog(logPath);
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
  if (values.log) { say(JSON.stringify(runCost(runs), null, 1)); return 0; }
  if (!doc || typeof doc !== "object" || !doc.deck || !Array.isArray(doc.pages)) { console.error("A pages file is { deck: {...}, pages: [...] }"); return 2; }
  if (values.plan) {
    // A plan is logged as a compile is: it is a run of this tool that can be refused, and its cost is part of the deck's.
    const refusal = [];
    const code = await planCommand(doc, { dir, stem, file, say, refusal });
    await fs.appendFile(logPath, JSON.stringify({ at: new Date().toISOString(), run: runs.length + 1, v: RUN_LOG_VERSION, mode: PLAN_MODE, pages: doc.pages.length + (doc.appendix || []).length, ok: code === 0, findings: refusal }) + "\n");
    return code;
  }
  const draft = Boolean(values.draft);
  // The pages a page run reports: the deck is compiled whole as their context, and nothing is written.
  const named = values.page === undefined ? null : new Set(String(values.page).split(",").map((id) => id.trim()).filter(Boolean));
  const known = new Set([...doc.pages, ...(doc.appendix || [])].map((page, index) => String(page?.id ?? `page-${index + 1}`)));
  const strangers = [...(named ?? [])].filter((id) => !known.has(id));
  if (named && (!named.size || strangers.length)) { console.error(named.size ? `No page ${strangers.map((id) => `"${id}"`).join(", ")} in ${path.basename(file)}; its pages are ${[...known].join(", ")}` : "--page names one or more page ids, comma-separated"); return 1; }
  const fitCap = values["fit-cap"] === undefined ? FIT.perPage : Number(values["fit-cap"]);
  if (!Number.isInteger(fitCap) || fitCap < 0) { console.error("--fit-cap is the most alternatives the fit search composes for a page: a whole number, 0 to switch the search off"); return 1; }
  // Each entry says which run it was - a draft, a check, a full compile, or a page run (`--page`, with the pages it named) - whether it
  // rendered, and how many pages the file held, so the cost of a deck is counted, not remembered.
  const log = async (entry) => fs.appendFile(logPath, JSON.stringify({ at: new Date().toISOString(), run: runs.length + 1, v: RUN_LOG_VERSION, mode: named ? "page" : draft ? "draft" : values.check ? "check" : "full",
    pages: doc.pages.length + (doc.appendix || []).length, ...(named ? { named: [...named] } : {}), ...(values.render ? { render: true } : {}), ...entry }) + "\n");
  // One run reports everything it can: the deck's structure on every page,
  // every page that cannot compile or compose with the checks that do not
  // need its composition, and the deck's aggregates on the pages that
  // composed. The author fixes them together and runs it again.
  let compiled, insights = null;
  try {
    insights = await readInsights(dir, stem, { alternatives: alternativesOf(doc.deck) });
    const fitCache = await openFitCache(path.join(dir, `${stem}.author-cache.json`), { doc, insights, fitCap });
    compiled = await authorDeck(doc, { baseDir: dir, insights, draft, fit: !draft && fitCap > 0, fitCap, fitCache, fitPages: named });
    await fitCache.save();
  } catch (error) {
    await log({ ok: false, findings: (error.pageErrors ?? [error.message]).map((message) => ({ code: "COMPILE", id: message.split(":")[0], message })) });
    console.error(error.message); return 2;
  }
  const { spec, pageGateAdvisories = [], budget = [], pageGatesRan, pageGatesError, content, order } = compiled;
  // The deck's network needs, on every run that has any, refused or not: read here, they are decided before the build.
  if (compiled.assets) console.error(`${assetNotice(compiled.assets)}\n`);
  // The page gates are the build's; when they cannot run here the author is
  // told so, rather than handed a clean run that checked nothing.
  if (!pageGatesRan) console.error(`page gates did not run: ${pageGatesError || "no reason given"}\n  (the build runs them; \`node runtime/doctor.mjs\` finds a Python that can)\n`);
  // The final check renders: the build's own stages, in a temporary folder, with their findings filed with the rest.
  const rendered = values.render && !draft ? await renderCheck(compiled, { dir, stem, named }) : null;
  // The alternatives the fit search passed are verified on the render too, so nothing is called verified that was not rendered.
  if (values.render && !draft && compiled.fits?.size) await verifyFitsOnRender(compiled, { doc, dir, stem, insights });
  if (values.render && draft) console.error("--render is for the full check: a draft has no copy to render\n");
  const keyOf = (f) => `${f.code}|${f.id ?? ""}`;
  const merge = (ours, theirs) => { const seen = new Set(ours.map(keyOf)); return inClassOrder([...ours, ...theirs.filter((f) => !seen.has(keyOf(f)) && seen.add(keyOf(f)))], order); };
  // A finding on a page that came from a part names the part file to edit (pages-file.mjs).
  const everything = withParts(doc, merge(compiled.blocking, rendered?.blockers ?? [])), advice = withParts(doc, merge(compiled.advisories, rendered?.advisories ?? []));
  // What the render measured replaces what the scene estimated of the same rule.
  const measured = new Set((rendered?.standings ?? []).map((st) => st.code));
  const standings = rendered?.standings?.length ? readStandings([...compiled.standings.filter((st) => !measured.has(st.code) && !(st.code === "DECK_SCENE_VOID" && measured.has("DECK_THIN_PAGES"))), ...rendered.standings]) : compiled.standings;
  // A page run answers for its pages: every blocking finding that names one of them - a claim two pages share names both -
  // and every aggregate one of them is counted in on the wrong side: a page holding a bare chart answers for the deck's bare charts.
  const about = (f) => (f.class === "G" ? contributorsOf(f, standings, { parts: compiled.parts, rates: CRAFT_RATES }) : pagesOf(f)).some((id) => named.has(id));
  const blocking = named ? everything.filter(about) : everything;
  const beyond = named ? everything.filter((f) => f.class === "S" && !about(f)) : [];
  const aggregatesBeyond = named ? everything.filter((f) => f.class === "G" && !about(f)) : [];
  const ledger = pageBudgetLedger(budget.filter((b) => !named || named.has(String(b.id ?? ""))), pageGateAdvisories, spec);
  const standing = { S: standings.filter((st) => st.class === "S").map((st) => st.line), G: standings.filter((st) => st.class === "G").map((st) => st.line) };
  const share = named ? contributions(standings, [...named], { parts: compiled.parts, rates: CRAFT_RATES }) : null;
  const tail = [
    ...(beyond.length ? [`Deck structure findings these pages are not named in (not counted in this run's exit code; the whole-deck run holds them):\n${findingsText(beyond, order)}`] : []),
    ...(aggregatesBeyond.length ? [`Deck aggregate findings these pages are not counted in (not counted in this run's exit code; the whole-deck run holds them):\n${findingsText(aggregatesBeyond, order)}`] : []),
    ...(share ? [`Each page's part in the deck's aggregates:\n${Object.entries(share).map(([id, lines]) => `  ${id}: ${lines.length ? lines.join("\n    ") : "counted in no aggregate out of its band"}`).join("\n")}`] : []),
    `Where the deck stands:\n${standingText(standings)}`,
    ...(draft && deferredLines(spec, advice).length ? [`Left to the full compile - what the copy, the layout or the fit settles, none of it a fact the storyline critique is bound to (a count a code):\n${deferredLines(spec, advice).map((line) => `  ${line}`).join("\n")}`] : []),
    ...(draft && readingLines(spec, insights).length ? [`${READINGS_NOTE}:\n${readingLines(spec, insights).map((line) => `  ${line}`).join("\n")}`] : []),
    ...(rendered ? [rendered.ran ? `Rendered ${rendered.slides} slide${rendered.slides === 1 ? "" : "s"} with the build's stages in ${Math.round((rendered.timings?.wallMs ?? 0) / 100) / 10}s: ${rendered.blockers.length ? `${rendered.blockers.length} blocker${rendered.blockers.length === 1 ? "" : "s"} the build would report` : "the build would report no blocker"}${named ? " on these pages (the deck's aggregates are measured by the whole-deck render)" : ""}.`
      : `Not rendered: ${rendered.reason}.`] : []),
    // The page budgets go with a check, a draft and a refusal: what the author edits against.
    ...(ledger.length && (values.check || draft || named || blocking.length) ? [`Page budgets:\n${ledger.join("\n")}`] : []),
  ].join("\n\n");
  // The message is kept, so `--log` can say which limit keeps coming back.
  await log({ ok: !blocking.length, findings: blocking.map((f) => ({ code: f.code, class: f.class, ...(f.id ?? f.page ? { id: String(f.id ?? f.page) } : {}), ...(f.repair ?? f.reason ? { message: String(f.repair ?? f.reason).slice(0, 300) } : {}) })) });
  if (blocking.length) {
    const counts = ["S", "P", "G"].map((cls) => [cls, blocking.filter((f) => f.class === cls).length]).filter(([, n]) => n).map(([cls, n]) => `${cls} ${n}`).join(", ");
    console.error(`The deck is not ready; nothing was written. ${blocking.length} finding${blocking.length === 1 ? "" : "s"} to fix in ${path.basename(file)} (${counts}):\n${findingsText(blocking, order)}\n\n${tail}`);
    return 2;
  }
  // A page run's summary lists its own pages' advisories - the typed numbers no measure holds among them - beside the deck's.
  const shown = named ? advice.filter((f) => f.class !== "P" || about(f)) : advice;
  const summary = { ...deckSummary({ values, draft, insights, spec, advisories: shown, pageGatesRan, pageGatesError }), ...(compiled.assets ? { assets: compiled.assets } : {}), standing,
    ...(share ? { pages: share } : {}), ...(beyond.length ? { structureElsewhere: beyond.map((f) => f.code) } : {}), ...(aggregatesBeyond.length ? { aggregatesElsewhere: aggregatesBeyond.map((f) => f.code) } : {}),
    ...(rendered ? { render: rendered.ran ? { slides: rendered.slides, seconds: Math.round((rendered.timings?.wallMs ?? 0) / 100) / 10, blockers: rendered.blockers.length } : { skipped: rendered.reason } } : {}) };
  if (draft) content.textContract = "draft";
  console.error(`${tail}\n`);
  if (values.check || named) {
    // Once a deck passes the scene's checks, the render is the one instrument left: said where a renderer is installed.
    if (!values.render && !draft && !named && rendererInstalled()) console.error("A renderer is installed: make the final check before the build with `--check --render`, which renders the deck with the build's own stages and reports what only the render shows.\n");
    say(JSON.stringify({ ok: true, ...summary }, null, 1)); return 0;
  }
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

/**
 * A page as `--scaffold` and `--example` print it: its JSON, closed by a
 * `limits` block - every countable limit the page is held to, one limit a
 * line - which the compiler reads past, so the page pasted whole compiles.
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
    // The deck-level keys, from the table the compile holds `deck` to.
    if (values.schema === "deck") { say(JSON.stringify(deckSchema(), null, 2)); return 0; }
    // One type's schema carries that type's countable limits, form by form.
    try { say(JSON.stringify({ ...pageSchema(values.schema || null), ...(values.schema ? { "x-limits": pageLimits(values.schema) } : {}) }, null, 2)); return 0; } catch (error) { console.error(error.message); return 1; }
  }
  // The limits a page is held to are those of the deck it is written for: a
  // live pitch's word floors are a quarter of a pre-read's.
  const scoped = file && (values.limits !== undefined || values.scaffold !== undefined || values.example !== undefined) ? await readPagesFile(file) : null;
  const density = scoped?.deck?.density;
  if (values.limits !== undefined) {
    const [type, form] = values.limits.split("/");
    // The deck's own dividers are measured where a pages file is named: its sections, under its design and tracker.
    const sections = scoped?.deck && Array.isArray(scoped.pages) ? scoped.pages.map((page, index) => [page, index]).filter(([page]) => page && typeof page === "object" && !page.type && page.kind === "section").map(([page, index]) => compilePage(page, index)) : null;
    try { say(JSON.stringify(type ? pageLimits(type, form, { density }) : deckLimits({ density, ...(sections ? { sectionTitle: sectionTitleRoom({ ...scoped.deck, slides: sections, ...(Array.isArray(scoped.appendix) && scoped.appendix.length ? { appendix: scoped.appendix.filter((page) => page && typeof page === "object") } : {}) }, path.dirname(path.resolve(file))) } : {}) }), null, 1)); return 0; } catch (error) { console.error(error.message); return 1; }
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
    const example = workedExamples();
    const pages = example.pages.filter((p) => p.type === type && (!form || p.form === form));
    if (!pages.length) {
      const forms = [...new Set(example.pages.filter((p) => p.type === type).map((p) => p.form))];
      console.error(form && forms.length ? `No worked example of "${type}/${form}"; ${type}'s worked forms: ${forms.join(", ")}`
        : `No worked example of "${type}"; types: ${[...new Set(example.pages.map((p) => p.type).filter(Boolean))].join(", ")}`);
      return 1;
    }
    say(`[\n${pages.map((page) => withLimits(page, density).replace(/^/gm, " ")).join(",\n")}\n]`);
    if (pages.some((p) => p.form === "executive-summary")) console.error(SUMMARY_AT_SPINE);
    // A worked example types its numbers, having no insight log to draw them from; a deck that has one names the measure instead.
    if (pages.some((p) => p.exhibit || p.exhibits || p.metrics || p.kpi)) console.error(`With measures in the insight log, write the numbers by reference, not by hand: \`--scaffold ${type} --evidence <insight-id>\` prints this page bound to an insight (references/page-types.md#the-evidence-contract).`);
    return 0;
  }
  if (values.scaffold !== undefined) {
    // `<type>` takes the first of the type's forms an insight's measures fill; `<type>/<form>` asks for one form.
    const [type, form] = String(values.scaffold).split("/"), evidence = values.evidence;
    let insight = null;
    if (evidence) {
      const dir = file ? path.dirname(path.resolve(file)) : process.cwd();
      const stem = file ? ((await readPagesFile(file)).deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "")) : null;
      const log = stem ? await readInsights(dir, stem).catch((error) => { console.error(error.message); return null; }) : null;
      insight = log?.get(evidence) ?? { id: evidence };
      if (!log?.get(evidence)) console.error(`${evidence} is not in ${stem ? `${stem}.insights.json` : "an insight log (name the pages file to read the log beside it)"}; the scaffold names it as its evidence without its data`);
    }
    let page, report;
    try { report = scaffoldReport(type, { id: values.id ?? "p00", form: form || null, insight }); page = report.page; } catch (error) { console.error(error.message); return 1; }
    say(withLimits(page, density));
    if (page.form === "executive-summary") console.error(SUMMARY_AT_SPINE);
    // How far the page is bound to the insight is said, never left to be read off the JSON: what names its measures, what still
    // holds the worked example's numbers, and - where nothing bound - why, form by form.
    if (insight?.shape) {
      const passed = (report.passed ?? []).map((item) => `${item.form} (${item.why})`);
      if (report.bound.length) console.error(`Bound to ${insight.id}: ${type}/${report.form} names ${report.bound.join(", ")}, and the runtime writes the numbers.` +
        (passed.length ? ` Forms passed over: ${passed.slice(0, 3).join("; ")}${passed.length > 3 ? `; and ${passed.length - 3} more` : ""}.` : "") +
        (report.typed.length ? ` Still the worked example's own numbers, to replace: ${report.typed.map((at) => `\`${at}\``).join(", ")} - the insight records no measure ${report.typed.length === 1 ? "it" : "they"} can take${form ? "" : `; \`--scaffold ${type}/<form>\` asks for another form`}.` : ""));
      else console.error(`Not bound to ${insight.id}: the page printed is the worked example of ${type}/${report.form} with the insight named as \`evidence\`, and its numbers are the example's own. ${report.fallback.length === 1 ? "Why" : "Why, form by form"}: ${report.fallback.join("; ")}.` +
        ` Write the exhibit from the insight's measures by reference (\`series: [{ measure }]\`, a figure's \`measure\`, a \`{{<insight id>/<measure> | 0.0}}\` token in a cell), or choose the type its measures fill (\`--draft\` prints \`insightTypes\`).`);
    }
    const log = insight?.shape ? new Map([[insight.id, insight]]) : null;
    try {
      const written = bindDeck({ pages: [page] }, log);
      if (written.findings.length) throw new Error(written.findings.map((f) => f.repair).join("; "));
      compilePage(withoutDependencies(written.doc.pages[0]).page, 0, { insights: log });
    } catch (error) { console.error(`The scaffold does not compile yet: ${error.message}`); return 2; }
    return 0;
  }
}

// One line per analytical page: body words against floor and ceiling, the
// footer's share, and any band of the page the render will call empty (the
// build's INTERNAL_VOID and DEAD_BAND, measured on the scene); "!" marks a
// line to act on. A number with no bar beside it is read past.
// A page the scene says will read light (SCENE_INK) carries its estimated
// ink on its line, only then: the number is a prompt to give the exhibit its
// surfaces, not a target to write toward.
function pageBudgetLedger(budget, pageGateAdvisories, spec) {
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
  return ledger;
}

/** What a run reports of the deck it compiled: the type and commentary mix, the sequence, the structure drawn, the evidence plotted, and the advisories. */
/**
 * How the storyline critique will read each measure a page shows and has not
 * drawn, a line a page ("p12 i-x/y: read as plotted, every one of its 8
 * periods"): printed with a draft and a plan, before the critique is staged,
 * since the layout is held to that reading (storyline.mjs spineReadings).
 */
function readingLines(spec, insights) {
  if (!insights) return [];
  return spineReadings(spec, recordedMeasures([...insights.values()])).map(({ id, measures }) => `${id} ${measures.map((m) => `${m.ref}: read as ${m.reading}${m.declared ? " (declared)" : ""}`).join("; ")}`);
}
const READINGS_NOTE = "How the storyline critique will read each measure a page shows and does not draw yet - the layout is held to this reading. A page that will show the whole measure plotted needs nothing; one that will show a window, some members, a table or one figure says so now: write the bound exhibit (`series: [{ measure }]` with `select`, a metric's `measure`), or state the view in the exhibit's or metric's `basis` - `as: \"chart\" | \"table\" | \"figure\"` and `labels: [...]`, `labels: { from, to }` or `members: [...]`";

// A page compiled for a draft with a refusal the full compile will make records it as an advisory that opens so (page-types.mjs deferredSlide).
const DEFERRED_PREFIX = "deferred to the full compile";

/**
 * What a draft leaves to the full compile, in lines: for each of the copy, the
 * layout and the fit, every code it settles with how many findings and the
 * pages they name - "settled by the copy: PAGE_DOES_NOT_COMPOSE x38 (p02,
 * p03, ...) (enforced by the full compile)". A page whose compile refusal
 * waits is counted as COMPILE, by the step that refused it: its copy, or its
 * shape and layout - an exhibit not written yet among them.
 */
function deferredLines(spec, advisories) {
  const groups = new Map(Object.keys(SETTLED_LATER).map((kind) => [kind, new Map()]));
  const count = (kind, code, id) => { const codes = groups.get(kind); codes.set(code, [...(codes.get(code) ?? []), ...(id === undefined || id === null ? [null] : [String(id)])]); };
  for (const f of advisories.filter((f) => f.deferred)) count(f.settledBy ?? "copy", f.code, f.id ?? f.page);
  for (const slide of [...spec.slides, ...(spec.appendix || [])]) if (slide.pageType?.deferred) count(slide.pageType.deferredStage === "copy" || !slide.pageType.deferredStage ? "copy" : "layout", "COMPILE", slide.id);
  return [...groups].filter(([, codes]) => codes.size).map(([kind, codes]) => `settled by ${SETTLED_LATER[kind]}: ${[...codes].map(([code, ids]) => {
    const named = ids.filter(Boolean);
    return `${code}${ids.length > 1 ? ` x${ids.length}` : ""}${named.length ? ` (${named.slice(0, 6).join(", ")}${named.length > 6 ? ", ..." : ""})` : ""}`; }).join("; ")} (enforced by the full compile)`);
}

function deckSummary({ values, draft, insights, spec, advisories, pageGatesRan, pageGatesError }) {
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
  const untraced = advisories.filter((f) => f.code === "NUMBER_UNTRACED");
  const hint = draft && insights ? catalogueHint(insights, { players: spec.players, plan: insights.analysis?.plan, stem: spec.id }) : null;
  const summary = { ...(draft ? { draft: true } : {}), pages: typed.length, types: mix("type"), sequence, commentary: mix("commentary"), closes: typed.filter((s) => s.pageType.takeaway || s.pageType.commentary === "so-what-bar").length,
    structure: { twoPlusExhibits: `${drawn.multi.pages} of ${drawn.pages} (${pct(drawn.multi.share)}; floor ${pct(VARIETY.multiShareMin)}, strong decks a quarter to a third)`,
      exhibitBesideColumn: `${drawn.column.pages} of ${drawn.pages} (${pct(drawn.column.share)}; cap ${pct(VARIETY.columnShareMax)}, strong decks about one in eight)${drawn.column.pages ? `: ${drawn.column.ids.join(", ")}` : ""}`,
      skeletons: drawn.skeletons },
    plotted: { chartPages: depth.chartPages, median: depth.median, range: [depth.min, depth.max], thinnest: depth.thinnest, strongDecks: "about 22 a chart page, the middle half 10 to 48" },
    // Which types each insight's data can carry: chosen here, before a page is written against the wrong shape.
    ...(insights && (draft || values.check) ? { insightTypes: insightTypes(insights) } : {}),
    // What the runtime computed from the log's measures, and what it could not: each line a result a page can rest on by its id.
    ...(insights?.analysis?.results?.length ? { analyses: insights.analysis.results.map(analysisLine) } : {}),
    // The analyses about the declared players that the measures allow and the plan runs none of: said in a draft, before the first critique asks for them.
    ...(hint ? { catalogue: hint } : {}),
    // How the critique will read what each page shows and has not drawn: what the layout is then held to.
    ...(draft && readingLines(spec, insights).length ? { readings: readingLines(spec, insights) } : {}),
    ...(pageGatesRan ? {} : { pageGates: `did not run: ${pageGatesError || "no reason given"}` }),
    // Each typed number that is no value of a measure its page rests on, by page and field: the list the author checks by hand, or replaces with references.
    ...(untraced.length ? { untracedNumbers: Object.fromEntries(untraced.map((f) => [f.id, f.measured])) } : {}),
    // What a draft leaves to the full compile, grouped by what settles it - the copy, the layout or the fit - one line a code
    // with its count: none of it is about what the storyline critique is bound to, which a draft refuses instead.
    ...(draft && deferredLines(spec, advisories).length ? { deferred: deferredLines(spec, advisories) } : {}),
    // Every other advisory in class order.
    advisories: advisories.filter((f) => !f.deferred).map((f) => `${f.code}${f.id ? ` [${f.id}]` : ""}`)
      .concat(typed.flatMap((s) => (s.pageType.advisories || []).filter((a) => !a.startsWith(DEFERRED_PREFIX)).map((a) => `${a.split(":")[0]} [${s.id}]: ${a.slice(a.indexOf(":") + 2)}`))) };
  return summary;
}

if (isMain(import.meta.url)) runCli(main);
