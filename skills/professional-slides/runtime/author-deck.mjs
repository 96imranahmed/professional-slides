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
//                                                        the storyline gate in out/ (or --out <dir>) is not ready, and
//                                                        once the critique has closed refuses a page whose argument
//                                                        moved since (SPINE_LOCKED) unless --reopen-spine is given
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
// page type. The deck records the inventory it was imported from. A page
// marked `carry: true` is not mapped at all: the build copies its slide from
// the source deck as it is (revision.mjs), so a point change composes, gates
// and reviews only the pages it changes.
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
import { SHAPES, TYPE_SHAPES, plottedValues } from "./evidence.mjs";
import { compilePage, declaredSlide, describeTypes, pageSchema, structureOf, drawnOf, architectureOf, PAGE_TYPES,
  typesForShape, titleGap, dataKeys, undrawnExhibit, withChoice, markedChart, titleBandProblems } from "./page-types.mjs";
import { deriveContent, wordBudgetOf } from "./derive-content.mjs";
import { textWords } from "./text-contract.mjs";
import { runContentGates } from "./gates/content_gates.mjs";
import { varietyFindings, evidenceDepth, structureMix, typeSequence, VARIETY } from "./gates/variety_gates.mjs";
import { SLIDE_KEYS } from "./compose-page.mjs";
import { composeAll } from "./compose-all.mjs";
import { chartDraws } from "./charts.mjs";
import { autoFillLogos } from "./fetch-logos.mjs";
import { autoFillPictures } from "./fetch-pictures.mjs";
import { autoFillPlaces } from "./fetch-places.mjs";
import { assetFindings, assetNotice, assetsDeclaration, suppliedPictures } from "./asset-needs.mjs";
import { storylineWarning, spineLock, recordCompileRefusal, unsupportedPillars, unfiledSources, sourceFiles, recordedMeasures, spineReadings, storyStructure, viewWords, BOUND_FIELDS } from "./storyline.mjs";
import { CALLOUT_KINDS, DEFERRED, inLayout, proveSpine, stripWitness, undeterminedFinding, unmarked } from "./spine-witness.mjs";
import { deckStatementFindings, revisionChanges, scopeSourceErrors, unheldLine } from "./review-passes.mjs";
import { carriedEntries, carriedFindings, carriedProblem, composedPageLimits, isCarried, revisionLine, revisionRecordFindings, revisionStatement, stampKept, withImportedCredits } from "./revision.mjs";
import { sourceKindsOf } from "./fit-review.mjs";
import { ICONS, ICON_NAMES, ICON_ALIASES } from "./icons.mjs";
import { AGENDA_LIMITS } from "./panels.mjs";
import { deckLimits, pageLimits } from "./limits.mjs";
import { SOURCE_TITLE_WORDS } from "./page-template.mjs";
import { readPagesFile, withParts } from "./pages-file.mjs";
import * as WEIGHT from "./weight.mjs";
import { sceneDesignFindings } from "./validate-overlap.mjs";
import { axisOf, hasMeasures, insightLogRefusal, isPercentUnit, measureConflicts, measureRegistry, readInsightLog, unmeasuredInsights, valuesOf } from "./measures.mjs";
import { DATA_KEYS, GRADE, FIT_WORDS, READING_TASKS, boundKeys, drawOrder, exhibitRefs, fitSentence, kindOfForm, pageFit, profileWords, sharedKinds } from "./claim-fit.mjs";
import { featuredDraw } from "./design-systems.mjs";
import { decimalsNeeded } from "./printed-numbers.mjs";
import { alternativesOf, analysisInsights, analysisLine, catalogueHint, readAnalysis, ANALYSIS_OPS } from "./analysis.mjs";
import { claimMarks, dependencyFindings, metricsOf, relationRepair, requiredCitations } from "./gates/dependency_gates.mjs";
import { craftFindings, sceneStatistics } from "./gates/craft_gates.mjs";
import { pageChartAnnotated } from "./build-bars.mjs";
import { consistencyFindings } from "./gates/consistency_gates.mjs";
import { LAYOUT_CODES, REPAIRS, SETTLED_LATER, classOf, repairOf } from "./gates/gate_classes.mjs";
import { allocateStructure, declaredArchitecture, declaredStructure, drawOf, evidenceExhibits, fitsOf, freeChoices, openKindsOf, shapeStructure, stubsOf } from "./deck-structure.mjs";
import { FIT, fitSearch } from "./fit-search.mjs";
import { fillGuidance } from "./fill-guidance.mjs";
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
import { spineExhibitFindings } from "./spine-exhibits.mjs";
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
  PAGE_SPLITS: "a page the composer draws as two slides or more - a table past the rows one page holds - advised, with the rows a page holds",
  SPINE_LOCKED: "a page whose argument - its title, page type, what settles its claim, the insights and measures it rests on and shows - moved after the storyline critique closed (ready, provisional or its passes spent), refused unless the run says --reopen-spine and takes the deck back to the critique",
  SOURCES_UNFILED: "an insight whose `sources` are not files under sources/ - a name or a registry key where the path of the file the finding was read from belongs, or none at all - advised at the compile, and told to the storyline critic as a problem of the log",
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

// What a source can be declared not to name, and the length of the reason: a sentence, long enough to say something.
const SOURCE_MISSING = Object.freeze(["publisher", "date", "document"]);
const MISSING_REASON = Object.freeze({ min: 5, max: 40 });

/** Every problem with the pages file's `sources` registry, as sentences. */
export function registryProblems(sources) {
  if (sources === undefined) return [];
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return ["`sources` is a registry - { key: { name, url, status } }"];
  return Object.entries(sources).flatMap(([key, entry]) => {
    if (!entry || typeof entry !== "object" || typeof entry.name !== "string" || !entry.name.trim()) return [`source "${key}" needs its \`name\` - the publisher and title as the citation prints them`];
    const extra = Object.keys(entry).filter((k) => !["name", "short", "url", "status", "missing", "reason"].includes(k));
    // A record that names no publisher, no date or no document says so once, here, with the reason: the deck then states the
    // limit once (compose-deck.mjs sourceLimitPages) and each page that cites the record carries it for the reviewers, rather
    // than every such page being found wanting on its own. It is not a way to leave a source unnamed: `name` still says what it is.
    const listed = Array.isArray(entry.missing) && entry.missing.length > 0 && entry.missing.every((item) => SOURCE_MISSING.includes(item)) && new Set(entry.missing).size === entry.missing.length;
    const reasoned = typeof entry.reason === "string" && textWords(entry.reason) >= MISSING_REASON.min && textWords(entry.reason) <= MISSING_REASON.max;
    const provenance = [
      ...(entry.missing !== undefined && !listed ? [`source "${key}": \`missing\` lists what the record does not name - one or more of ${SOURCE_MISSING.map((item) => `"${item}"`).join(", ")}, each once - or is left out for a source that names all three`] : []),
      ...(listed && !reasoned ? [`source "${key}" declares it names no ${entry.missing.join(", no ")}: say why in \`reason\` - who supplied the record and what is known of it - in ${MISSING_REASON.min} to ${MISSING_REASON.max} words; the deck states it once, on the page it derives for the sources' limits`] : []),
      ...(entry.missing === undefined && entry.reason !== undefined ? [`source "${key}": \`reason\` says why the record names no publisher, date or document, and goes with \`missing\`; a source that names all three needs none`] : []),
      ...(listed && entry.missing.includes("publisher") && typeof entry.url === "string" && entry.url.trim() ? [`source "${key}" declares it names no publisher and gives a \`url\`: a record with a URL has a publisher - name it in \`name\` and take "publisher" out of \`missing\``] : [])];
    // A name is a title and a status a label: each is held to the length of what it is, so a registry entry cannot carry a page's caveats.
    const kind = { name: "its title - the publisher, the publication and its year -", short: "its title in brief", status: "the kind of record it is (\"audited\", \"company-reported\") -" };
    const wordy = Object.entries(SOURCE_TITLE_WORDS).filter(([k, max]) => typeof entry[k] === "string" && textWords(entry[k]) > max)
      .map(([k, max]) => `source "${key}": \`${k}\` runs to ${textWords(entry[k])} words, and a source's \`${k}\` is ${kind[k]} in ${max} words or fewer. A caveat, a scope or a method is a note, not a source: write it in the page's \`note\`, where it is counted (NOTE_HEAVY) and fitted to the footer`);
    return [...(extra.length ? [`source "${key}": unknown key${extra.length === 1 ? "" : "s"} ${extra.join(", ")} - a source is { name, short, url, status }, with { missing: ["publisher" | "date" | "document"], reason } where the record does not name one`] : []),
      ...["short", "url", "status"].filter((k) => entry[k] !== undefined && typeof entry[k] !== "string").map((k) => `source "${key}": \`${k}\` is text`), ...wordy, ...provenance];
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
 * There is one compile. `draft` compiles the spine, which is the same compile
 * of the same pages once each is completed (spine-witness.mjs): placeholder
 * copy where its commentary placement asks for copy, an exhibit written from
 * the measures it declares where it declares one and has not drawn it, and the
 * worked page's content where its form reads content the critique is not
 * bound to. The completed deck is the spine's witness (`witness`: its spec,
 * and for each page what the completion wrote or why no layout of the page's
 * type holds it), and the spec a draft returns is the witness with what the
 * completion wrote taken back out: the slides the full compile will build,
 * less their copy. A page no form or placement of its type holds as declared
 * is refused here, in a draft as in the full compile. `baseDir`, where given,
 * lets a draft compose each witness under the deck's settings as well.
 * `spineFindings` are the deck-level rules on the spine - the request, the
 * titles, the insights, generated metadata - which hold in a draft as in a
 * full compile; `findings` are the variety contract's.
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
export function compileDeck(docIn, { insights = null, draft = false, partial = false, baseDir = null, sourceKinds = null } = {}) {
  if (!docIn || typeof docIn !== "object" || !docIn.deck || !Array.isArray(docIn.pages)) throw new Error("A pages file is { deck: {...}, pages: [...] }");
  if (docIn.deck.slides || docIn.deck.appendix) throw new Error("`deck` carries the deck-level keys only; the pages go in `pages` and `appendix`");
  const registry = registryProblems(docIn.sources);
  if (registry.length) throw new Error(`The \`sources\` registry is not valid:\n- ${registry.join("\n- ")}`);
  // Every deck-level key is one the runtime reads, of the kind it reads it as (deck-keys.mjs): said here, in one message, rather than by whichever stage first trips on it.
  const keyed = deckKeyProblems(docIn.deck);
  if (keyed.length) throw new Error(`The deck-level keys of \`deck\` are not valid:\n- ${keyed.join("\n- ")}`);
  // The deck-level fields the reviews read may sit beside `deck` as well as on it.
  const deckKeys = Object.fromEntries(["request", "waivers", "rulesVersion"].filter((key) => docIn[key] !== undefined && docIn.deck[key] === undefined).map((key) => [key, docIn[key]]));
  const withKeys = (doc) => ({ ...doc, deck: { ...doc.deck, ...deckKeys } });
  const measured = measureRegistry(insights);
  // A draft: the spine as written, bound - what the deck's own rules on the spine read, and what a page's record keeps of what
  // it declares - and its witness, each page completed in a layout of its type that holds it.
  const written = draft ? bindDeck(withKeys(docIn), insights) : null;
  const proof = draft ? spineProof(withKeys(docIn), { insights, measured, written, baseDir, sourceKinds }) : null;
  const binding = proof ? bindDeck(proof.doc, insights) : bindDeck(withKeys(docIn), insights);
  const doc = binding.doc;
  const revision = doc.deck.workflow === REVISION;
  const errors = [], waiting = [], refusals = new Map(), cited = new Map(), witnessed = new Map();
  const refuse = (index, message, more = {}) => { errors.push(message); refusals.set(index, { message, ...more }); return null; };
  const spineOf = (page, index) => (written ? [...written.doc.pages, ...(written.doc.appendix || [])][index] : page);
  const compile = (list, offset = 0) => list.map((page, i) => {
    const index = offset + i, id = String(page?.id ?? `page-${index + 1}`);
    // A carried slide is the user's own, copied by the build as it is: only its form as a carried page is checked here.
    if (isCarried(page)) {
      const problem = offset ? `${page.id ?? `page ${index + 1}`}: a carried slide keeps its place in the deck, among \`pages\`; the appendix holds pages the runtime composes` : carriedProblem(page, { revision });
      return problem ? refuse(index, problem) : null;
    }
    if (unmapped(page)) {
      if (revision) { waiting.push(page.id ?? `page ${index + 1}`); return null; }
      return refuse(index, `${page.id ?? `page ${index + 1}`}: \`draft\` is an imported slide's old copy, which only a revision (\`workflow: "${REVISION}"\`) carries; give the page its \`type\` and write its copy`);
    }
    // No layout of the page's type holds what the spine declares: the witness's refusal is the page's, in a draft as in the full compile.
    const proved = proof?.pages.get(id);
    if (proved?.refusal) return refuse(index, proved.refusal, { code: proved.code });
    const options = { insights, players: doc.deck.players, sources: doc.sources, rules: doc.deck };
    if (binding.bound.failed.has(page?.id ?? `page-${index + 1}`)) {
      // The page is left out for its binding; what does not wait on the missing numbers is compiled now, for its refusal alone.
      // In a draft that is its spine: its copy is not written yet, and nothing stands in for a page whose references do not bind.
      const stand = withPlaceholders(binding.bound.attempted.get(page) ?? page);
      const unfilled = /"measure"\s*:/.test(JSON.stringify(stand));
      try { compilePage(withoutDependencies(stand, measured).page, index, { ...options, spineOnly: draft || unfilled }); } catch (error) { refuse(index, error.message); }
      return null;
    }
    let slide;
    const { page: authored, dependencies } = withoutDependencies(page, measured, binding.bound.printed.get(page));
    try { slide = compilePage(authored, index, options); } catch (error) { return refuse(index, error.message, { stage: error.stage ?? null }); }
    // Every key checked now, on every page, rather than one at a time by the build.
    const unknown = Object.keys(slide).filter((key) => !(key in SLIDE_KEYS));
    if (unknown.length) return refuse(index, `${slide.id ?? `page ${index + 1}`}: unknown page key${unknown.length === 1 ? "" : "s"} ${unknown.map((k) => `\`${k}\``).join(", ")} - a key the composer does not read (an exhibit's own props go inside the exhibit)`, { stage: "shape" });
    // What the page declares it rests on and what the binding recorded of it are kept on its record, where the storyline critique
    // and the reviewers read them (`recorded`): of a draft's page, what the spine itself declares; of its witness, what the completed page does.
    const recorded = (target, source, deps, bound) => {
      if (Array.isArray(source.source)) cited.set(target, source.source);
      if (deps && target.pageType) {
        target.pageType.dependencies = deps.declared;
        if (deps.claim && target.pageType.content?.settles) target.pageType.content.settles = { ...target.pageType.content.settles, ...deps.claim };
      }
      // The assumed measures it shows, the values it prints without their sign: kept with what settles the claim, where the
      // critic's and the reviewer's notes read it (gates/dependency_gates.mjs dependencyNotes).
      const assumed = bound.assumed.get(source.bound), unsigned = bound.unsigned.get(source.bound);
      if ((assumed || unsigned) && target.pageType?.content?.settles) target.pageType.content.settles = { ...target.pageType.content.settles, stated: { ...(assumed ? { assumed } : {}), ...(unsigned ? { unsigned } : {}) } };
      return target;
    };
    if (!proved) return recorded(slide, { source: authored.source, bound: page }, dependencies, binding.bound);
    // The witness is kept whole, and the slide the draft reports is the completed page's with what the completion wrote taken out.
    // Where the page compiles as declared and composes only in another layout, its witness is that layout's compile.
    const elsewhere = proved.witness ? compileDeck({ ...withKeys(docIn), pages: [proved.witness], appendix: [] }, { insights, partial: true }).spec.slides[0] : null;
    witnessed.set(index, elsewhere ? unmarked(elsewhere) : recorded(unmarked(slide), { source: authored.source, bound: page }, dependencies, binding.bound));
    // A page whose references bind only in the layout its witness took (proveSpine) is read in that layout: the form is the layout's.
    const relaid = written.bound.failed.has(page?.id) ? bindDeck({ ...withKeys(docIn), pages: [inLayout(spineOf(page, index), proved.form, proved.commentary)], appendix: [] }, insights) : null;
    const spine = relaid ? relaid.doc.pages[0] : spineOf(page, index), bound = (relaid ?? written).bound, own = withoutDependencies(spine, measured, bound.printed.get(spine));
    const reported = stripWitness(slide, proved.filled);
    if (proved.moved && reported.pageType) reported.pageType.moved = proved.moved;
    return recorded(reported, { source: own.page.source, bound: spine }, own.dependencies, bound);
  });
  const compiled = [...compile(doc.pages), ...compile(doc.appendix || [], doc.pages.length)];
  const slides = compiled.slice(0, doc.pages.length).filter(Boolean), appendix = compiled.slice(doc.pages.length).filter(Boolean);
  // Each page that did not compile, with its place and its refusal, for the caller to stand in for. A page left out for a
  // reference that does not bind is listed as unbound - its refusal is the binding's finding - and again with its compile
  // refusal where what could be checked of it without the binding was refused too.
  const authored = written ? [...written.doc.pages, ...(written.doc.appendix || [])] : [...doc.pages, ...(doc.appendix || [])];
  const idAt = (index) => authored[index]?.id ?? `page-${index + 1}`;
  const carried = revision ? carriedEntries(doc.pages, { skip: (page, index) => isCarried(page) && refusals.has(index) }) : [];
  // `page` is the page as the binding left it - its bound exhibits written out - which is what stands in for it (withStandIns).
  // A refused page keeps the record of what it declares (`record`): its type, what settles it and each `basis`, with its
  // exhibits as written - what a draft's particular proofs read to say which bound choice mends it (spine-exhibits.mjs), and
  // what says, of a full compile's refusal, whether the page is still the one the storyline critique read (storyline.mjs
  // recordCompileRefusal).
  const recordOf = (page, index) => { if (!page?.type || !PAGE_TYPES[page.type]) return {};
    const { page: bare, dependencies } = withoutDependencies(page, measured);
    const kept = Object.fromEntries(["exhibit", "exhibits", "blocks", "metrics", "kpi"].filter((key) => bare[key] !== undefined).map((key) => [key, bare[key]]));
    return { record: { id: idAt(index), title: String(page.title ?? ""), ...kept, pageType: { type: page.type, form: page.form, commentary: page.commentary, refused: true,
      content: { claim: String(page.title ?? ""), ...(page.settles && typeof page.settles === "object" ? { settles: page.settles } : {}), ...(Array.isArray(page.evidence) ? { evidence: page.evidence } : {}) },
      ...(dependencies ? { dependencies: dependencies.declared } : {}) } } }; };
  // Every length the title band is held to is said with the page's first refusal, whatever that refusal is: the compile shows
  // one refusal a page, and a title or a subtitle found long only once that one is mended costs a run for each.
  for (const [index, refusal] of refusals) {
    const page = authored[index];
    if (!page || typeof page !== "object" || !PAGE_TYPES[page.type] || isCarried(page)) continue;
    const more = titleBandProblems(page, idAt(index), { rules: doc.deck }).refused.filter((message) => !refusal.message.includes(message.slice(`${idAt(index)}: `.length, `${idAt(index)}: `.length + 40)));
    if (!more.length || /TITLE_WORDS|: the subtitle /.test(refusal.message)) continue;
    const added = `${refusal.message.replace(/[.\s]*$/, "")}. Also refused on this page, so mend it in the same edit: ${more.map((message) => message.slice(`${idAt(index)}: `.length)).join("; and ")}`;
    errors[errors.indexOf(refusal.message)] = added;
    refusals.set(index, { ...refusal, message: added });
  }
  const failed = compiled.flatMap((slide, index) => (slide || (revision && unmapped(authored[index]) && !refusals.has(index)) ? [] : [
    ...(refusals.has(index) ? [{ index, id: idAt(index), ...refusals.get(index), page: authored[index], ...recordOf(authored[index], index) }] : []),
    ...(binding.bound.failed.has(idAt(index)) ? [{ index, id: idAt(index), unbound: true, page: authored[index] }] : [])]));
  // What a cited source is declared not to name is recorded on each page that cites it, for the reviewers and for the page the deck states it on.
  stateSourceLimits(doc, [...slides, ...appendix, ...witnessed.values()], cited);
  const base = { ...doc.deck, ...(doc.sources ? { sources: doc.sources } : {}),
    // The rules the deck was authored under; a revised deck keeps the version it records.
    ...(doc.deck.rulesVersion === undefined && WEIGHT.RULES_VERSION !== undefined ? { rulesVersion: WEIGHT.RULES_VERSION } : {}) };
  const spec = { ...base, slides, ...(appendix.length ? { appendix } : {}),
    // The slides the build copies from the source deck as they are, each with the composed page it follows (revision.mjs).
    ...(carried.length ? { carried } : {}) };
  // The witness: the deck as the full compile builds it from the completed spine, page for page.
  const whole = (list, offset) => list.flatMap((slide, i) => (slide ? [witnessed.get(offset + i) ?? slide] : []));
  const witnessPage = (page, index) => proof.pages.get(String(page?.id ?? `page-${index + 1}`))?.witness ?? page;
  const witness = proof ? { spec: { ...base, slides: whole(compiled.slice(0, doc.pages.length), 0), ...(appendix.length ? { appendix: whole(compiled.slice(doc.pages.length), doc.pages.length) } : {}), ...(carried.length ? { carried } : {}) },
    doc: unmarked({ ...proof.doc, deck: doc.deck, pages: proof.doc.pages.map(witnessPage), ...(proof.doc.appendix ? { appendix: proof.doc.appendix.map((page, i) => witnessPage(page, proof.doc.pages.length + i)) } : {}) }), pages: proof.pages } : null;
  // A revision recorded under an older rules version hears the spine rules introduced since as advisories, and one that
  // carries slides hears the rules that measure the deck as advisories too (weight.mjs notHeldOn).
  const spineFindings = [...WEIGHT.applyRulesVersion(deckSpineFindings(written ? written.doc : doc, insights), spec), ...(waiting.length ? [{ code: "REVISION_UNMAPPED", severity: draft ? "advisory" : "blocker", pages: waiting,
    repair: `${waiting.length} imported slide${waiting.length === 1 ? " carries" : "s carry"} only their old copy (${waiting.join(", ")}): keep each as it is - \`carry: true\` beside its \`draft\`, and the build copies the slide from the source deck unchanged - or map it to a page type by its stable id - \`type\`, \`form\`, \`commentary\`, \`why\` and the exhibit its evidence needs (\`--scaffold <type>\` prints one; the inventory holds the slide's table cells and chart values) - or delete it from \`pages\` to drop the slide` }] : [])];
  if (partial) return { spec, findings: varietyFindings(spec, { structureOf, drawnOf }), spineFindings, bindingFindings: binding.findings, compileErrors: errors, failed, unmapped: waiting, witness };
  errors.push(...binding.findings.map((f) => f.repair));
  if (errors.length) {
    const error = new Error(`${errors.length} page${errors.length === 1 ? "" : "s"} could not be compiled:\n- ${errors.join("\n- ")}`);
    error.pageErrors = errors;
    throw error;
  }
  return { spec, findings: varietyFindings(spec, { structureOf, drawnOf }), spineFindings, unmapped: waiting, witness };
}

/**
 * The kind the deck's plan gives each exhibit whose form leaves its kind open
 * and whose page has not said it (deck-structure.mjs openKindsOf), by page id.
 * The one reading of an untyped stub: the plan prints these kinds, the draft
 * stands the stub in as its kind for the structure rules and draws that kind
 * in the page's witness, and the critique is told the class the witness shows.
 * `sourceKinds` is what each slide of a revision's source deck drew.
 */
const openKindsByPage = (doc, insights, sourceKinds = null) => new Map([...openKindsOf(doc, insights, { sourceKinds })].map(([page, kinds]) => [String(page.id), kinds]));

/**
 * The witness of a spine (spine-witness.mjs proveSpine), in this deck's
 * context: each candidate layout of a page is compiled by the full compile of
 * a one-page deck with the deck's own settings, and - where the deck's folder
 * is known - composed alone under them.
 */
function spineProof(doc, { insights, measured, written, baseDir, sourceKinds = null }) {
  const examples = workedExamples();
  // The kind the deck's plan gives each untyped stub (openKindsByPage), by place on its page: the witness draws that kind.
  const open = openKindsByPage(doc, insights, sourceKinds);
  const exampleOf = (type, form) => examples.pages.find((page) => page.type === type && page.form === form) ?? examples.pages.find((page) => page.type === type) ?? null;
  const spines = new Map([...written.doc.pages, ...(written.doc.appendix || [])].map((page, index) => [String(page?.id ?? `page-${index + 1}`), page]));
  const settings = { ...doc.deck, ...(doc.sources ? { sources: doc.sources } : {}) };
  return proveSpine(doc, { registry: measured, exampleOf, kindsOf: (page) => (open.has(String(page?.id)) ? new Map(open.get(String(page.id)).map((item) => [item.at, item.kind])) : null),
    compileOne: (page) => {
      const one = compileDeck({ ...doc, pages: [page], appendix: [] }, { insights, partial: true });
      // A reference that does not bind in this layout may bind in another (two units drawn as a combo, not a line): the layout's to choose.
      const refused = one.failed.find((f) => !f.unbound);
      return { slide: one.spec.slides[0] ?? null, refusal: one.bindingFindings[0]?.repair ?? refused?.message ?? (one.spec.slides[0] ? null : "the page did not compile"), stage: refused?.stage ?? (one.bindingFindings.length ? "layout" : null), unbound: one.bindingFindings.length > 0 };
    },
    // A layout holds the page where the composer takes it and the composed page keeps what the page carries: a form that
    // composes by leaving an exhibit out has not laid the page out.
    composes: baseDir ? (slide) => {
      try {
        const composed = composeAll({ ...settings, slides: [slide] }, baseDir, { partial: true });
        if ((composed.pageErrors ?? []).length) return composed.pageErrors[0];
        const lost = composed.deck ? auditContent({ slides: [slide] }, composed.deck).findings[0] : null;
        return lost ? `${slide.id}: composed in this form the page drops ${lost.kind ? `its ${lost.kind} (${lost.value})` : `what it carries ("${String(lost.text ?? "").slice(0, 80)}")`}` : null;
      } catch (error) { return (error.pageErrors ?? [error.message])[0]; }
    } : null,
    // What the page as written already shows by reference, and the periods or members each of its drawn exhibits sets along its axis:
    // where its references did not bind, the axis of the first measure each names, which a layout that binds them draws.
    shownOf: (page) => {
      const id = String(page?.id ?? ""), spine = spines.get(id) ?? page;
      const exhibits = [spine.exhibit, ...(Array.isArray(spine.exhibits) ? spine.exhibits : [])].filter((ex) => ex && typeof ex === "object");
      // A number printed in the title or the prose is copy: what a page shows of a measure is what an exhibit or a figure of it shows.
      const blocks = (Array.isArray(spine.blocks) ? spine.blocks : []).map((block) => block?.exhibit).filter((ex) => ex && typeof ex === "object");
      const shown = new Set([...exhibits, ...blocks, ...metricsOf(spine)].flatMap((item) => (Array.isArray(item.basis?.measures) ? item.basis.measures : [])));
      const axis = (ex) => exhibitRefs(ex).map((ref) => measured.get(ref)).map((m) => (m ? axisOf(m) : null)).find((a) => a && a.kind !== "scalar")?.labels ?? null;
      return { unbound: written.bound.failed.has(page?.id), shown, labels: exhibits.map((ex) => (Array.isArray(ex.categories) ? ex.categories : Array.isArray(ex.labels) ? ex.labels : axis(ex))) };
    } });
}

/**
 * The limits the registry declares of the deck's sources, recorded where they
 * are read: every page that cites a source declared to name no publisher,
 * date or document keeps the fact with what settles its claim
 * (`settles.stated.limits`: `[{ key, name, missing, reason }]`). The critic's
 * and the reviewer's notes read it there (gates/dependency_gates.mjs
 * dependencyNotes), and the composer writes the deck's one statement of it
 * from the same record (compose-deck.mjs sourceLimitPages). The page's
 * own source line is untouched: it still names the source. `cited` is the
 * registry keys each compiled slide cites.
 */
function stateSourceLimits(doc, slides, cited) {
  const limited = Object.entries(doc.sources ?? {}).filter(([, entry]) => Array.isArray(entry?.missing) && entry.missing.length);
  for (const slide of slides) {
    const limits = limited.filter(([key]) => (cited.get(slide) ?? []).includes(key)).map(([key, entry]) => ({ key, name: entry.name, missing: entry.missing, reason: String(entry.reason).trim().replace(/[.;]$/, "") }));
    const settles = slide.pageType?.content?.settles;
    if (limits.length && settles) slide.pageType.content.settles = { ...settles, stated: { ...(settles.stated ?? {}), limits } };
  }
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
// `settles.what` on its own as well: a stamped sentence hides inside settles objects that differ only by their measures.
const SIGNATURE_FIELDS = ["why", "settles", "settles.what", "adds", "takeaway", "subtitle", "rail", "bar"];
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
        const value = field.split(".").reduce((at, key) => (at && typeof at === "object" ? at[key] : undefined), page);
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
  // What any command that reads the log refuses it for (measures.mjs): the analyses' own command says the same.
  const refusal = insightLogRefusal(items);
  if (refusal) throw new Error(refusal);
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
function withStandIns(doc, spec, failed, insights, sourceKinds = null) {
  const missing = new Set(failed.map((f) => f.index));
  // A page that did not compile is stood in for as the binding wrote it: an exhibit that names its measures stands in with the values it will plot.
  const written = new Map(failed.filter((f) => f.page).map((f) => [f.index, f.page]));
  const revision = doc.deck.workflow === REVISION, declared = [], undrawn = [];
  // An exhibit a page of open kinds has not typed is stood in for as the kind the deck's plan gives it (openKindsByPage): the draft and the plan read one stub as one kind.
  const open = openKindsByPage(doc, insights, sourceKinds);
  const standFor = (page, index) => declaredSlide(page, index, { exhibitType: open.get(String(page?.id))?.map((item) => item.kind) ?? evidenceExhibits(page, insights, drawOf(doc.deck)), players: doc.deck.players, stubs: stubsOf(page, insights, open.get(String(page?.id)) ?? null) });
  // A spine page with no exhibit drawn yet - its exhibits declared by `basis` stubs, or not written at all, and stood in for in
  // its witness (`pageType.pending`) - is read for the structure rules as its choices declare it, the way a plan reads it: the
  // exhibits its form draws, each stub as the exhibit it declares. Its record of the claim is kept; an undrawn exhibit is never one that plots nothing.
  const shapeOf = (slide, page, index) => {
    const own = [page?.exhibit, ...(Array.isArray(page?.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object");
    if (!slide?.pageType?.pending?.includes("content") || !own.every(undrawnExhibit)) return slide;
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
 * The spine's structure rules as an allocation of forms and placements reads
 * them (deck-structure.mjs allocateStructure): a page that compiles as written
 * is read as the compile reads it, the rest from their declared choices. What
 * it leaves unsatisfied no form or placement mends - only another page type,
 * another page or other evidence, all of which the critique is bound to.
 */
function structurePlan(doc, insights, sourceKinds = null) {
  let compiled = new Map();
  try { const { spec } = compileDeck(doc, { insights, partial: true }); compiled = new Map([...spec.slides, ...(spec.appendix || [])].filter((slide) => slide.pageType).map((slide) => [String(slide.id), slide])); }
  catch { compiled = new Map(); }
  // Any form the catalogue allows, whatever its fit: a draft holds a rule against a spine only where nothing the layout can choose meets it.
  return allocateStructure(doc, { insights, planOf, compiled, forms: "any", sourceKinds });
}

/**
 * The pages of a spine the critique would read one way and their witness
 * another, as findings (spine-witness.mjs undeterminedFinding): each page of
 * the argument (storyline.mjs storyStructure) is set against the same page of
 * the witness spec, and any difference is a bound fact the spine has left to
 * the layout.
 */
function undeterminedPages(spec, witnessSpec, insights, proved = null) {
  const measures = insights ? recordedMeasures([...insights.values()]) : null;
  const after = new Map(storyStructure(witnessSpec, measures).map((page) => [String(page.id), page]));
  // Where the witness drew an untyped stub as the kind the deck's plan gives it (spine-witness.mjs: `given`), the finding names
  // the kind where the two read a measure's view differently: another kind of the same class may show the measure as the critic
  // would be told, and only the stub's `type` says so.
  const given = (id) => (proved?.get(id)?.filled?.exhibits ?? []).filter((slot) => slot.given);
  const named = (f) => (given(String(f.id)).length && JSON.stringify(f.measured.before) !== JSON.stringify(f.measured.after) ? { ...f, repair: `${f.repair}. ${given(String(f.id)).map((slot) => `Exhibit ${slot.at + 1} is laid out here as \`${slot.given}\`, the kind the plan gives its untyped stub`).join("; ")}: where another kind is meant, write its \`type\` on the stub` } : f);
  return storyStructure(spec, measures).filter((page) => page.type && after.has(String(page.id)) && JSON.stringify(page) !== JSON.stringify(after.get(String(page.id))))
    .map((page) => named(undeterminedFinding(String(page.id), page, after.get(String(page.id)), { viewWords: (ref, view) => (measures?.[ref] ? viewWords(view, measures[ref]) : JSON.stringify(view)) })));
}

// The page types that carry no exhibit and no figure of their own: nothing on such a page can be declared to show a measure.
const carriesNothing = (page) => { const type = PAGE_TYPES[page?.type]; const [, most] = type ? [].concat(type.exhibits, type.exhibits) : [0, 1];
  return Boolean(type) && most === 0 && !metricsOf(page ?? {}).length; };

/**
 * The dependency contract's findings as a deck is held to them. A draft reads
 * them off the spine's witness (`witness`, the completed document): every
 * exhibit the spine declares is drawn there, so each finding is decided, and
 * what blocks the witness blocks the spine - its repair writes a declared
 * fact. What a witness's stand-in content says in passing is not the author's,
 * so of the advisories only the spine's own are kept.
 */
function spineDependencies(doc, insights, deck, witness = null) {
  if (!insights) return [];
  const read = (source) => WEIGHT.applyRulesVersion(dependencyFindings(source, insights).filter((f) => f.code !== "BINDING_UNRESOLVED"), deck);
  const pages = new Map([...doc.pages, ...(doc.appendix || [])].map((page, index) => [String(page?.id ?? `page-${index + 1}`), page]));
  // A page whose type carries no exhibit and no figure cannot show a measure as proof, whatever is written on it: the choice is the claim's or the type's.
  const said = (f) => (f.code === "PROOF_MISSING" && carriesNothing(pages.get(String(f.id)))
    ? { ...f, repair: `${f.id}: the claim is about measures (\`settles.measures\`) and a ${pages.get(String(f.id)).type} page carries no exhibit and no figure, so nothing on it can be declared to prove them. Take the measures out of \`settles\` - the page's rows and prose then settle the claim, and may still print recorded numbers by token - or choose the page type that tabulates or plots them (lookup, scorecard, numbers; \`--types\`). The storyline critique is bound to both, so settle it before the critique` } : f);
  if (!witness) return read(doc).map(said);
  const blocker = (f) => f.severity === "blocker" || f.severity === "blocking";
  return [...read(witness).filter(blocker), ...read(doc).filter((f) => !blocker(f))].map(said);
}
// The page-gate findings that are about how much a page carries: a band that stands empty, words under the floor, words over the ceiling.
const FILL_CODES = Object.freeze(["SCENE_VOID", "TEXT_COVERAGE_LOW", "WORDS"]);
// The craft floors and build bars that count what the build fetches rather than what the pages say: the players' logos, and a planned photograph's file.
const FETCHED_AT_BUILD = new Set(["CRAFT_PLAYERS_UNINTRODUCED", "BAR_UNSOURCED_PICTURES"]);
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
function localFindings({ doc, structural, deck, spec, insights, uncomposed, uncompiled, witness = null }) {
  // A reference that could not be bound is reported by the compile, which left its page out (compileDeck `bindingFindings`).
  const depends = spineDependencies(doc, insights, spec, witness);
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
export async function authorDeck(docIn, { baseDir, insights = null, draft = false, fit = !draft, fill = !draft, fitCap = FIT.perPage, fitCache = null, fitPages = null } = {}) {
  // A revision is read beside the inventory of the deck it was imported from: a picture the user's own deck embedded is
  // credited to that deck, and the slides it carries are checked against the slides the inventory holds (revision.mjs).
  const imported = docIn?.deck?.workflow === REVISION && typeof docIn.deck.inventory === "string" && baseDir ? readJsonSync(path.resolve(baseDir, docIn.deck.inventory), { optional: true }) : null;
  const doc = imported ? withImportedCredits(docIn, imported) : docIn;
  // What each slide of a revision's source deck drew: the kinds its like is drawn in, read by the plan and by a draft alike.
  const sourceKinds = baseDir ? await sourceKindsOf(doc.deck, path.join(baseDir, "deck")) : null;
  const { spec, spineFindings, bindingFindings, unmapped: waiting, failed, witness } = compileDeck(doc, { insights, draft, partial: true, baseDir, sourceKinds });
  // What each page composed where a slide stood keeps of that slide - its title, its source line - checked against the inventory
  // and recorded on the page: those are the user's, and the rules that judge them advise there (revision.mjs stampKept).
  stampKept(spec, imported);
  const authoredIds = new Set([...doc.pages, ...(doc.appendix || [])].map((page, index) => String(page?.id ?? `page-${index + 1}`)));
  // A closed evidence scope on a request that is not the user's own words quotes its limit from the file that sets it: read here,
  // where the deck's folder is, so the author is told before the critic that the file is missing or says no such thing.
  const scopeSource = baseDir ? await scopeSourceErrors(doc.deck, baseDir) : [];
  if (scopeSource.length) spineFindings.push({ code: "STATEMENT_INVALID", severity: "blocker", repair: scopeSource.join("; ") });
  // What the critic will be told of the log is told to the author first, all of it at once: every insight whose `sources`
  // are not files the deck holds. It is advice here as it is a problem there - the critic weighs it - so nothing is refused.
  const unfiled = baseDir && insights ? unfiledSources([...insights.values()].filter((item) => !item.derived), await sourceFiles(baseDir)) : [];
  if (unfiled.length) spineFindings.push({ code: "SOURCES_UNFILED", severity: "advisory", pages: unfiled.map((entry) => entry.id), measured: { insights: unfiled.length, none: unfiled.filter((entry) => entry.none).map((entry) => entry.id) },
    repair: `${unfiled.length} insight${unfiled.length === 1 ? " names" : "s name"} sources that are not files under sources/ (${unfiled.slice(0, 8).map((entry) => (entry.none ? `${entry.id}: none` : `${entry.id}: ${entry.missing.slice(0, 2).map((f) => JSON.stringify(f)).join(", ")}${entry.missing.length > 2 ? ", ..." : ""}`)).join("; ")}${unfiled.length > 8 ? `; and ${unfiled.length - 8} more` : ""}). An insight's \`sources\` are the paths of the files its finding was read from - "sources/accounts-fy26.csv" - beside the pages file; a publisher's name or a key of the \`sources\` registry is a citation, which goes on the measure (\`cite\`) or the page (\`source\`). Save each file under sources/ and name its path, or the storyline critic is told the log has ${unfiled.length} unsourced finding${unfiled.length === 1 ? "" : "s"}` });
  const { structural, declared, shaped, undrawn } = withStandIns(doc, spec, failed, insights, sourceKinds);
  const composed = await composeForAuthoring(spec, baseDir);
  // A page the composer drew as two slides or more - a table past the rows one page holds at its densest setting - says so, and
  // why: the deck is a slide longer than its pages, each part repeats the title, and only the first carries the commentary.
  const splitInto = new Map();
  for (const slide of composed.deck?.slides ?? []) if (slide.sourceSlideId) splitInto.set(String(slide.sourceSlideId), (splitInto.get(String(slide.sourceSlideId)) ?? 0) + 1);
  for (const [id, count] of splitInto) {
    if (count < 2) continue;
    const page = [...spec.slides, ...(spec.appendix || [])].find((slide) => String(slide.id) === id), rows = [page?.exhibit, ...(page?.exhibits || [])].map((ex) => (Array.isArray(ex?.rows) ? ex.rows.length : 0)).find((n) => n > 0) ?? null;
    spineFindings.push({ code: "PAGE_SPLITS", severity: "advisory", id, measured: { slides: count, ...(rows ? { rows, rowsASlide: Math.ceil(rows / count) } : {}) },
      repair: `${id} is drawn as ${count} slides${rows ? `: its table has ${rows} rows, and one page holds ${Math.ceil(rows / count)} of them at the densest setting a table takes` : ": its exhibits do not share one page"}. Each part repeats the title with (1/${count}) to (${count}/${count}), the commentary stays with the first, and the deck is ${count - 1} slide${count === 2 ? "" : "s"} longer than its pages (a requested length counts them). Keep it where the reader looks rows up${rows ? `; to hold one page, cut the table to ${Math.ceil(rows / count)} rows or fewer - the members the claim compares - and move the rest to the appendix` : ""}` });
  }
  // A page whose references could not be bound (bind.mjs) is left out as one that did not compile is, and stood in for
  // by its declared choices; its finding is the binding's, in a draft as in the full compile.
  // A page the compile refuses, in a draft as in the full compile. In a draft the refusal is the witness's - no form or commentary
  // placement of the page's type holds what the spine declares - so nothing the copy, the layout or the fit does mends it (`touches`).
  const refusals = failed.filter((f) => !f.unbound).map(({ id, message, code }) => ({ code: code ?? "COMPILE", id: idOfMessage(message) ?? id, severity: "blocker", repair: message,
    ...(draft ? { touches: (REPAIRS[code ?? "COMPILE"] ?? []).filter((kind) => Object.hasOwn(BOUND_FIELDS, kind)) } : {}) }));
  const unbound = new Set(failed.filter((f) => f.unbound).map((f) => String(f.id)));
  const composing = (composed.pageErrors ?? (composed.error ? [composed.error] : [])).map((message) => ({ code: "PAGE_DOES_NOT_COMPOSE", id: idOfMessage(message), severity: "blocker", repair: message }));
  // In a draft a page stands without its copy, so whether it composes is read off its witness, which was composed with the copy
  // stood in for (compileDeck): a page that has one composes, and one no layout of its type composes was refused there.
  const witnessed = new Set(witness ? [...witness.pages].filter(([, proved]) => !proved.refusal).map(([id]) => id) : []);
  // Every title the critique binds, composed where this deck's design sets it (spine-fit.mjs): held on every run, a draft's
  // among them, so a spine that passes its draft meets no later refusal whose repair is to change a title. A divider or
  // a contents page that does not compose for its title is reported once, by this finding, which says the room it has.
  const unfit = spineFitFindings(structural, baseDir);
  // What the spine says each page shows, proven drawable, and its summary proven to fill (spine-exhibits.mjs): a draft's proof,
  // since the full compile composes the pages themselves. With the titles, it is what makes a spine that passes its draft
  // one the layout can finish without touching anything the critique is bound to.
  const refusedIds = new Set(failed.map((f) => String(f.id)));
  // The particular proofs (spine-exhibits.mjs) name the bound choice to make - the members to select, the table to declare - so
  // where one speaks of a page the witness refused, it is the page's one finding and the compile's general refusal is not repeated.
  const recorded = { ...spec, slides: [...spec.slides, ...failed.filter((f) => f.record).map((f) => f.record)] };
  const undrawable = draft ? spineExhibitFindings(doc, { spec: recorded, insights, baseDir, sceneGates: (deck) => sceneGateFindings(deck, undefined, spec),
    compile: (page) => { const one = compileDeck({ ...doc, pages: [page], appendix: [] }, { insights, partial: true }); const refused = one.bindingFindings[0]?.repair ?? one.compileErrors[0]; if (refused) throw new Error(refused); return one.spec.slides[0]; } }) : [];
  const proven = new Set(undrawable.map((f) => String(f.id)));
  const compiled = refusals.filter((f) => !proven.has(String(f.id)));
  // What the critique would be bound to on each page of the spine, against what it would be bound to on that page's witness: where
  // the two differ, the spine leaves a bound fact for the layout to decide, and the draft refuses it as undetermined (spine-witness.mjs).
  const undetermined = draft && witness ? undeterminedPages(spec, witness.spec, insights, witness.pages).filter((f) => !refusedIds.has(String(f.id)) && !proven.has(String(f.id))) : [];
  const structuralIds = new Set([...structural.slides, ...(structural.appendix || [])].filter((slide) => !slide.pageType).map((slide) => String(slide.id)));
  const unfitIds = new Set(unfit.map((f) => String(f.id)));
  const composingShown = composing.filter((f) => !(unfitIds.has(String(f.id)) && (structuralIds.has(String(f.id)) || !authoredIds.has(String(f.id)))) && !witnessed.has(String(f.id)));
  const uncompiled = new Set([...refusals.map((f) => String(f.id)), ...unbound]), uncomposed = new Set(composing.map((f) => f.id).filter(Boolean).map(String));
  const failedIds = new Set([...refusals, ...bindingFindings, ...composing].map((f) => f.id).filter(Boolean));
  // Every page compiled and composed: the composed deck is the whole deck, and what the gates say of it stands.
  const complete = Boolean(composed.deck) && !refusals.length && !unbound.size && !composing.length;
  const inventory = spec.workflow === REVISION && spec.inventory && baseDir && !existsSync(path.resolve(baseDir, String(spec.inventory)))
    ? [{ code: "REVISION_INVENTORY_MISSING", severity: "blocker", repair: `The deck records its source inventory as "${spec.inventory}", which is not beside the pages file; run runtime/import-deck.py again or correct the path` }] : [];
  // The slides a revision carries from its source deck: that deck being there, and each edit one its slide can take.
  // And what the revision records of itself: a rules version below its import's with no reason, an `only` that names no page.
  const carry = [...(baseDir ? carriedFindings(spec, imported, baseDir) : []), ...revisionRecordFindings(spec, imported)];
  const scene = composed.deck ? sceneGateFindings(composed.deck, undefined, spec)
    : { findings: [], advisories: [], all: [], standings: [], architectures: [], budget: [], ran: false, reason: composed.error };
  const sceneId = (slide) => { const page = composed.deck?.slides[Number(slide) - 1]; return page ? page.sourceSlideId ?? page.id : null; };
  const standIn = [declared.length ? `${declared.join(", ")} did not compile` : null, undrawn.length ? `${undrawn.length} page${undrawn.length === 1 ? " is" : "s are"} not drawn yet and read as declared` : null].filter(Boolean).join("; ") || null;
  const partial = complete ? null : `measured on the ${composed.deck ? new Set(composed.deck.slides.map((slide) => slide.sourceSlideId ?? slide.id)).size : 0} pages that composed`;

  // --- S: the deck's structure, on every page ------------------------------
  // The variety contract and the plan record's gates, read off the compiled
  // pages and the stand-ins; a rule the deck predates (a revision under an
  // older rules version) comes back as an advisory.
  // On a revision the fit is read on the pages the revision added or redrew: what each source slide drew says which those are.
  const structure = declaredStructure(shaped, { planOf, insights, sourceKinds });
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
  const local = localFindings({ doc, structural, deck: composed.deck, spec, insights, uncomposed, uncompiled, witness: witness?.doc ?? null });
  // A page the witness refused, or one a particular proof speaks of, has said why: what the dependency contract would say of the same page laid out is that refusal again.
  if (draft) local.depends = local.depends.filter((f) => !(isBlocker(f) && (refusedIds.has(String(f.id)) || proven.has(String(f.id)) || undetermined.some((u) => String(u.id) === String(f.id)))));
  // What a revision changed, against the deck it was imported from: the pages whose words, numbers or drawing differ from
  // their slide. Null for new work, and for a revision whose inventory cannot be read - then every page is the author's.
  const revised = revisionChanges(spec, imported);
  // A page that stands part empty, falls short of its word floor or runs past its ceiling, and is not prose beside a panel, is
  // told what fills it by the same kind of measurement (fill-guidance.mjs): the page composed again with its own points run
  // shorter and longer and its own table's rows fewer and more, in the deck's sections and at its density, and the lengths
  // at which the page gates report none of the three.
  if (fill && scene.ran && composed.deck) {
    const written = bindDeck(doc, insights).doc, writtenPages = [...written.pages, ...(written.appendix || [])];
    const blockingOn = (id) => [...gateFindings, ...local.copy].filter((f) => isBlocker(f) && String(f.id) === id);
    const targets = [...new Set([...gateFindings, ...local.copy].filter((f) => isBlocker(f) && FILL_CODES.includes(f.code) && !f.fills && f.id !== undefined).map((f) => String(f.id)))].flatMap((id) => {
      const index = writtenPages.findIndex((page, at) => String(page?.id ?? `page-${at + 1}`) === id), page = writtenPages[index];
      // A revision is measured on the pages it changed: the rest are as the user made them, and a point change does not pay to measure them.
      if (!page?.type || (fitPages && !fitPages.has(id)) || (revised && !revised.content.includes(id))) return [];
      const shown = [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : [])].find((ex) => ex && typeof ex === "object");
      return [{ id, page, index, appendix: index >= written.pages.length, base: new Set(blockingOn(id).map((f) => f.code).filter((code) => !FILL_CODES.includes(code))),
        ceiling: (scene.budget ?? []).find((b) => String(b.id ?? "") === id)?.ceiling ?? null, exhibit: shown ? (typeof shown.heading === "string" && shown.heading.trim() ? `"${shown.heading.trim()}"` : `its ${String(shown.type ?? page.form ?? page.type)}`) : null }];
    });
    const pointWords = writtenPages.flatMap((page) => [...(Array.isArray(page?.points) ? page.points : []), ...(Array.isArray(page?.blocks) ? page.blocks.flatMap((block) => (Array.isArray(block?.points) ? block.points : [])) : [])])
      .flatMap((point) => String((typeof point === "string" ? point : point?.text) ?? "").trim().split(/\s+/).filter(Boolean));
    const fills = targets.length ? await fillGuidance(targets, {
      words: pointWords,
      compile: (page, index) => { const one = compileDeck({ ...doc, pages: [page], appendix: [] }, { insights, partial: true }); const refused = one.bindingFindings[0]?.repair ?? one.compileErrors[0]; if (refused) throw new Error(refused); return one.spec.slides[0]; },
      compose: (body, behind) => composeVariants(spec, baseDir, body, behind),
      // The deck's first page leads the batch, so the gates place no variant as a cover.
      pageGates: (slides) => { const gated = sceneGateFindings({ ...composed.deck, slides: [composed.deck.slides[0], ...slides] }, undefined, spec);
        return { ran: gated.ran, findings: gated.all.map((f) => ({ ...f, slide: f.slide ? f.slide - 1 : f.slide })), budget: (gated.budget ?? []).map((row) => ({ ...row, slide: row.slide - 1 })) }; },
    }) : new Map();
    // The statement goes on each of the page's findings it answers: the page gates' (`repair`) and the text plan's (`reason`).
    const withFill = (f) => { if (!FILL_CODES.includes(f.code) || f.fills || !fills.has(String(f.id))) return f;
      const { text, ...measured } = fills.get(String(f.id)), said = f.repair === undefined && f.reason !== undefined ? "reason" : "repair";
      return { ...f, fills: measured, [said]: `${f[said] ?? ""} ${text}`.trim() }; };
    gateFindings = gateFindings.map(withFill);
    local.copy = local.copy.map(withFill);
  }
  const stages = [];
  try { validateStageContract(structural, { content: local.content, plan: planOf(structural) }); }
  catch (error) { if (!isRefusal(error)) throw error; stages.push({ code: error.code, severity: "blocker", repair: `${error.message} - the build refuses the deck here. Give every page a unique \`id\`, and open the deck on a \`summary\` page (form \`executive-summary\`) ahead of its first section` }); }
  const standings = [];
  if (spec.purpose === "evaluation") {
    // Each page still to compose will add at least a slide.
    // The deck's length is every page it renders, the slides a revision carries among them (the build counts the same).
    const slides = (composed.deck?.slides.length ?? 0) + new Set([...uncompiled, ...uncomposed]).size + WEIGHT.carriedCount(spec);
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
  // The build bars are held here by the definition delivery holds them, over the pages delivery reads (build-bars.mjs, read by
  // craftFindings): the pages the runtime drew. On a revision that carries slides those are the pages it composed, and each
  // bar's line says it is not held on the carried slides.
  const craft = craftFindings(structural, composed.deck ?? { slides: [] }, { standings, picturesSupplied: baseDir ? await suppliedPictures(baseDir) : 0 })
    .map((f) => (awaitsFetch && FETCHED_AT_BUILD.has(f.code) && isBlocker(f) ? { ...f, severity: "advisory", pending: "decided when the build fetches the logos and photographs the pages plan; the compile does not fetch" } : f));
  if (awaitsFetch) for (const st of standings) if (FETCHED_AT_BUILD.has(st.code)) st.blocks = false;
  // What the pages state between them (gates/consistency_gates.mjs): one number given two values, a number a revision changed
  // that another page still prints, a proof the page before already gave. A revision is read for what it changed: the pages
  // it composed and the carried slides it edited in place, each carried slide read from the inventory as its edits leave it.
  const consistency = consistencyFindings(doc, insights, { spec, inventory: imported, changed: revised?.content ?? null });
  // A proof another page already gave is kept with what settles the later page's claim, where the critic's and the reviewer's
  // notes read it (gates/dependency_gates.mjs dependencyNotes): the storyline critique sees the overlap on the spine.
  for (const f of consistency.filter((item) => item.code === "PROOF_REPEATS")) {
    const slide = [...spec.slides, ...(spec.appendix || [])].find((item) => String(item.id) === String(f.id)), settles = slide?.pageType?.content?.settles;
    if (settles) slide.pageType.content.settles = { ...settles, stated: { ...(settles.stated ?? {}), repeats: [...(settles.stated?.repeats ?? []), { page: f.pages[0], measures: f.measured?.repeated ?? [], whole: Boolean(f.measured?.whole ?? f.measured?.drawn) }] } };
  }
  // The mark each bare chart's own title names (gates/dependency_gates.mjs claimMarks), proven on the composed page before it is
  // said: the finding on a chart with nothing marked names the exact mark to write, and the bar the deck misses says which of
  // its pages already say what to mark. Nothing is written into the page.
  const marks = draft ? new Map() : await provenMarks(doc, insights, { deck: composed.deck, spec, baseDir });
  const withMark = (f) => {
    const named = f.id !== undefined && f.code === "UNANNOTATED" ? marks.get(String(f.id)) : null;
    if (named) return { ...f, marks: named, repair: `${f.repair ?? ""} The title already names what to mark: ${named.map(markLine).join("; ")}. Composed with it, the plot marks the claim`.trim() };
    const pages = ["BAR_CHARTS_ANNOTATED", "CRAFT_CHARTS_BARE"].includes(f.code) ? (f.pages ?? [...marks.keys()]).filter((id) => marks.has(String(id))) : [];
    return pages.length ? { ...f, marks: Object.fromEntries(pages.map((id) => [id, marks.get(String(id))])),
      repair: `${f.repair ?? ""} On ${pages.length} of the bare chart pages the title already names what to mark - ${pages.slice(0, 8).map((id) => `${id}: ${marks.get(String(id)).map(markLine).join("; ")}`).join(" | ")}${pages.length > 8 ? ` | and ${pages.length - 8} more` : ""}`.trim() } : f;
  };
  // What the build would fetch and the deck's folder does not hold, said at the compile - a draft too - with the choices (asset-needs.mjs).
  const assets = baseDir ? await assetFindings(spec, baseDir) : { statement: null, findings: [] };

  // --- every finding, with its class and, for a draft, whether it is held yet
  const classed = (list, more = {}) => list.map((f) => ({ ...f, ...more, class: classOf(f.code) }));
  const gathered = [
    ...classed(compiled), ...classed(bindingFindings), ...classed(composingShown), ...classed(unfitShown), ...classed(undrawable), ...classed(undetermined), ...classed(spineFindings), ...classed(inventory), ...classed(carry),
    ...classed(structure.findings).map((f) => (f.class === "S" && standIn ? { ...f, provisional: standIn } : f)),
    ...classed(provisionalShape.findings, { provisional: standIn ?? "not every page composed" }), ...classed(stages),
    ...classed(consistency), ...classed(local.depends), ...classed(local.design), ...classed(local.kept), ...classed(gateFindings.map(withMark)), ...classed(craft.map(withMark)), ...classed(assets.findings),
  // An aggregate read while pages are missing is read from the pages that composed, and says so.
  ].map((f) => (f.class === "G" && partial ? { ...f, partial } : f));
  // A draft is the spine, and the storyline critique is then bound to it. So a draft holds everything whose repair writes a
  // field the critique binds (gates/gate_classes.mjs REPAIRS, storyline.mjs BOUND_FIELDS): every refusal of the one compile,
  // made on the spine's witness; the spine's own rules; the content plan's rules on claims; the dependency contract, read off
  // the witness; a structure rule no allocation of forms and placements satisfies. What a draft leaves to the full compile is
  // the closed list spine-witness.mjs DEFERRED states - the copy, unbound content, the layout, the fit - and nothing else.
  const unmet = new Map((draft ? structurePlan(doc, insights, sourceKinds).unsatisfied : []).map((u) => [u.code, u]));
  const NO_ALLOCATION = "No allocation of forms and commentary placements satisfies this rule (`--plan` prints the closest one found): what mends it is another page type, another page, or other evidence on a page - which the storyline critique is bound to, so settle it before the critique";
  // A structure or aggregate rule the layout can usually mend is the spine's where the plan's allocation cannot satisfy it.
  const settled = gathered.map((f) => (draft && isBlocker(f) && waitsFor(f) && boundOnly(f.code).length && unmet.has(f.code) ? { ...f, touches: boundOnly(f.code), repair: `${f.repair ?? ""} ${NO_ALLOCATION}`.trim() } : f));
  // One the draft's own reading does not raise, and the allocation still leaves broken, is said too: the plan and the draft refuse the same spines.
  for (const [code, u] of unmet) if (!settled.some((f) => f.code === code && isBlocker(f)))
    settled.push({ ...(u.finding ?? { code, severity: "blocker" }), code, severity: "blocker", class: classOf(code), touches: boundOnly(code).length ? boundOnly(code) : ["pages"],
      repair: `${u.standing ? `${readStandings([u.standing])[0].line}. ` : u.finding?.repair ? `${u.finding.repair} ` : ""}${NO_ALLOCATION}` });
  // One decision for every gate's findings, whichever raised them (weight.mjs notHeldOn): a rule the deck's recorded version
  // predates, and - on a revision that carries slides - a rule that measures the deck, is an advisory marked with why.
  const judged = WEIGHT.applyRulesVersion(settled, spec), copy = WEIGHT.applyRulesVersion(classed(local.copy), spec);
  const spineCodes = new Set([...compiled, ...bindingFindings, ...unfit, ...undrawable, ...undetermined, ...spineFindings, ...inventory, ...carry].map((f) => f.code));
  const holds = (f) => isBlocker(f) && (!draft || spineCodes.has(f.code) || !waitsFor(f));
  const copyHolds = (f) => isBlocker(f) && !(draft && COPY_CODES.test(f.code));
  const findings = judged.filter(holds);

  // --- the fit search: other forms and placements for a page that does not fit
  const authored = new Map([...doc.pages, ...(doc.appendix || [])].map((page, index) => [String(page?.id ?? `page-${index + 1}`), { page, index }]));
  // `fitPages` keeps the search to the pages a page run reports.
  const misfit = [...new Set([...findings, ...copy.filter(copyHolds)].filter((f) => f.class === "P" && LAYOUT_CODES.has(f.code) && f.id !== undefined && authored.has(String(f.id)) && !uncompiled.has(String(f.id))).map((f) => String(f.id)))]
    .filter((id) => !fitPages || fitPages.has(id));
  let fits = new Map();
  if (fit && misfit.length && typed.length) {
    const baseline = new Set([...structure.findings, ...provisionalShape.findings, ...(complete && scene.ran ? scene.all.filter((f) => f.code === "PAGE_SHAPE_FLAT") : [])].filter((f) => isBlocker(f) && classOf(f.code) === "S").map((f) => f.code));
    // An alternative keeps of its slide what the page as written keeps (revision.mjs stampKept): it is the same title over another form.
    const compileOne = (page, index) => { const one = compileDeck({ ...doc, pages: [page], appendix: [] }, { insights, partial: true }); const refused = one.bindingFindings[0]?.repair ?? one.compileErrors[0]; if (refused) throw new Error(refused);
      stampKept(one.spec, imported); return { ...one.spec.slides[0], id: one.spec.slides[0].id ?? `page-${index + 1}` }; };
    const alone = new Map();
    const swapped = (id, slide) => { const swap = (list) => (list || []).map((s) => (String(s.id) === id ? slide : s)); return { ...structural, slides: swap(structural.slides), ...(structural.appendix ? { appendix: swap(structural.appendix) } : {}) }; };
    fits = await fitSearch(misfit.map((id) => ({ id, ...authored.get(id) })), {
      spec, deck: composed.deck, perPage: fitCap,
      // How well each form of the page's type carries its claim (claim-fit.mjs): the alternatives are tried best fit first.
      grade: (page, form) => { const fit = insights ? pageFit({ ...page, form }, { registry: measureRegistry(insights), insights }) : null; return fit?.task ? fit.forms.ranked.find((item) => item.form === form)?.grade ?? 0 : null; },
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
      // The mark a bare chart's own finding names (provenMarks) goes with every alternative that draws it: a form that fits is not offered as a chart still bare.
      marks: (target) => marks.get(String(target.id)) ?? null, marked: withMarks, marksDrawn: (slides) => slides.length > 0 && slides.every((slide) => pageChartAnnotated(slide) !== false) && slides.some((slide) => pageChartAnnotated(slide) === true),
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
  const advisories = inClassOrder([...judged.filter((f) => !holds(f)), ...copy.filter((f) => !copyHolds(f))].map((f) => (draft && isBlocker(f) ? { ...f, deferred: true, settledBy: waitsFor(f) ?? "copy" } : f)), order);
  // Each composed page's own counts of what the craft rates read over the deck (sceneStatistics), by page id: what a page run reports of its part in them.
  const parts = {};
  for (const slide of composed.deck?.slides ?? []) {
    const id = String(slide.sourceSlideId ?? slide.id), own = sceneStatistics({ slides: [slide] });
    parts[id] = Object.fromEntries(Object.entries(own).filter(([, n]) => typeof n === "number").map(([key, n]) => [key, (parts[id]?.[key] ?? 0) + n]));
  }
  return { spec, deck: composed.deck ?? { slides: [] }, failedIds, compiled: !refusals.length, complete, unmapped: waiting, declared, assets: assets.statement, parts,
    findings: findings.map(withFit),
    // A draft has no copy yet: what the copy settles is reported, not enforced.
    pageGateAdvisories: judged.filter((f) => !holds(f)),
    // A revision's inventory, where it was read: what a run says of the slides it carries.
    imported,
    pageGatesRan: scene.ran, pageGatesError: scene.ran ? null : scene.reason, budget: scene.budget ?? [],
    content: local.content, contentReport: local.report, blocking, advisories, standings: read, order, fits,
    // A draft's witness: the spine completed, as a pages document any compile takes, and what was completed on each page.
    witness: witness ? { doc: witness.doc, pages: witness.pages } : null,
    // The pages the page compile refused, each with the step that refused it and the record of what it declares.
    refused: failed.filter((f) => !f.unbound).map((f) => ({ id: f.id, stage: f.stage ?? null, message: f.message, record: f.record ?? null })) };
}

// How many pages back the composer looks when it breaks a tie between layouts on variety (compose-deck.mjs keeps this many).
const LAYOUT_MEMORY = 4;

/**
 * Variants of pages composed as the deck would compose them, for a measure
 * that reads each one (fill-guidance.mjs): `body` each `{ slide, after }` - a
 * compiled variant and the id of the page whose place it takes - and `behind`
 * the appendix's. Each is set among the deck's own sections, so the tracker
 * and the body's height are the deck's. A variant whose layout its page type
 * settles is composed with the others in one deck. One whose layout the
 * composer chooses takes the choice from the pages before it (it breaks a tie
 * on which shape was used longest ago), so it is composed on its own behind
 * the pages that precede its page in the deck: beside its fellow variants it
 * would alternate with them, and be measured in a layout the page never gets.
 * Returns `{ deck: { slides } }`, the variants' composed slides.
 */
async function composeVariants(spec, baseDir, body, behind) {
  const settled = (slide) => typeof slide.layout === "string" && slide.layout !== "auto";
  const among = (variants, extra = () => []) => spec.slides.flatMap((slide) => [...(slide.pageType ? [] : [slide]), ...extra(slide), ...variants.filter((variant) => variant.after === String(slide.id)).map((variant) => variant.slide)]);
  const ids = new Set([...body.map((variant) => String(variant.slide.id)), ...behind.map((slide) => String(slide.id))]);
  const decks = [];
  const together = body.filter((variant) => settled(variant.slide)), apart = body.filter((variant) => !settled(variant.slide));
  if (together.length || behind.length) decks.push({ ...spec, slides: among(together), appendix: behind.length ? behind : undefined });
  for (const variant of apart) {
    const pages = spec.slides.filter((slide) => slide.pageType), at = pages.findIndex((slide) => String(slide.id) === variant.after);
    const before = new Set(pages.slice(Math.max(0, at - LAYOUT_MEMORY), Math.max(0, at)).map((slide) => String(slide.id)));
    decks.push({ ...spec, slides: among([variant], (slide) => (before.has(String(slide.id)) ? [slide] : [])), appendix: undefined });
  }
  const slides = [];
  for (const deck of decks) slides.push(...((await composeForAuthoring(deck, baseDir)).deck?.slides ?? []).filter((slide) => ids.has(String(slide.sourceSlideId ?? slide.id))));
  return { deck: { slides } };
}

/** A page with each proposed mark (gates/dependency_gates.mjs claimMarks) written on the exhibit it names: what the page is once its bare chart's finding is mended. */
function withMarks(page, marks) {
  const copy = structuredClone(page);
  const exhibits = [copy.exhibit, ...(Array.isArray(copy.exhibits) ? copy.exhibits : []), ...(Array.isArray(copy.blocks) ? copy.blocks.map((block) => block?.exhibit) : [])].filter((ex) => ex && typeof ex === "object");
  for (const mark of marks) if (exhibits[mark.at]) exhibits[mark.at].highlights = mark.mark.highlights;
  return copy;
}

// A proposed mark as the finding says it: the JSON to write, the exhibit it goes on, and why that category.
const markLine = (mark) => `\`"highlights": ${JSON.stringify(mark.mark.highlights)}\` on ${mark.exhibit} (${mark.because})`;

/**
 * The marks the pages' own titles name on their bare charts, each proven:
 * a page whose composed chart marks nothing (build-bars.mjs
 * pageChartAnnotated) is compiled and composed again with the proposed
 * highlight written on its exhibit, and the proposal is kept only where that
 * page then marks its chart. So a finding never names a mark the chart's
 * form does not draw. One composition for all of them.
 */
async function provenMarks(doc, insights, { deck, spec, baseDir }) {
  const proposed = claimMarks(doc, insights);
  const bare = new Set((deck?.slides ?? []).filter((slide) => pageChartAnnotated(slide) === false).map((slide) => String(slide.sourceSlideId ?? slide.id)));
  const authored = [...doc.pages, ...(doc.appendix || [])];
  const marked = [];
  for (const [id, marks] of proposed) {
    if (!bare.has(id)) continue;
    const index = authored.findIndex((page, at) => String(page?.id ?? `page-${at + 1}`) === id), page = withMarks(authored[index], marks);
    const one = compileDeck({ ...doc, pages: [page], appendix: [] }, { insights, partial: true });
    if (one.spec.slides[0] && !one.compileErrors.length && !one.bindingFindings.length) marked.push({ id, marks, slide: { ...one.spec.slides[0], id } });
  }
  if (!marked.length) return new Map();
  const composed = await composeForAuthoring({ ...spec, slides: marked.map((item) => item.slide), appendix: undefined }, baseDir);
  const drawn = new Set((composed.deck?.slides ?? []).filter((slide) => pageChartAnnotated(slide) === true).map((slide) => String(slide.sourceSlideId ?? slide.id)));
  return new Map(marked.filter((item) => drawn.has(item.id)).map((item) => [item.id, item.marks]));
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
export function scaffoldReport(type, { id = "p00", form = null, insight = null, example = workedExamples(), seed = null, featured = null, claim = null, kinds = null } = {}) {
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
  // How the type's forms carry what the insight's measures give a reader to read (claim-fit.mjs): the forms are tried best fit
  // first, forms of one grade in the order the deck's `variation` draws them - the catalogue's order where it has none.
  // `claim` is the page's own `settles`, where the pages file holds the page: the kind of claim, the relation it asserts and the
  // measures of this insight it names - what the plan reads the page's fit from - else every measure the insight records.
  const asked = (Array.isArray(claim?.measures) ? claim.measures : []).filter((ref) => String(ref).startsWith(`${insight.id}/`));
  const fit = measured ? pageFit({ id, type, settles: { ...(claim?.kind ? { kind: claim.kind } : {}), ...(claim?.relation ? { relation: claim.relation } : {}), measures: asked.length ? asked : Object.keys(insight.measures).map((name) => `${insight.id}/${name}`) }, evidence: [insight.id] },
    { registry: measureRegistry([insight]), insights: new Map([[insight.id, insight]]) }) : null;
  const gradeIn = (name) => fit?.forms.ranked.find((item) => item.form === name)?.grade ?? -1;
  // The deck's draw, as the plan takes it (claim-fit.mjs drawOrder): what it features, then where a mark falls in the deck's hand for
  // the reading task - so a scaffold takes the form and the kinds the plan gives the page, whatever its id.
  const marks = seed === null ? null : new Set([...(featured?.forms ?? []), ...(featured?.kinds ?? [])]);
  const order = (items, { task = fit?.task, mark, before = [] } = {}) => drawOrder(items, { seed, task, featured: marks, mark, before }).ordered;
  const tried = form || !fit?.task ? sources : order(sources, { mark: (source) => `${type}/${source.form}`, before: [["grade", (a, b) => gradeIn(b.form) - gradeIn(a.form)]] });
  const attempts = !measured ? [] : tried.map((source) => {
    const named = { ...scaffoldBase(source, type, id), evidence: [insight.id] };
    delete named.settles;
    const { claimed, why } = bindScaffold(named, insight, { fit, order, declared: kinds ?? [] });
    if (!claimed.length) return { form: source.form, page: null, why: why ?? "the form's exhibit takes no measure" };
    // The page with prompts for its commentary too, where that still compiles; else with the example's commentary under the bound exhibit.
    let refusal = null;
    // And, where a callout carried over from the worked page is what the form refuses, without it.
    const bare = (candidate) => { const copy = structuredClone(candidate); for (const ex of [copy.exhibit, ...(Array.isArray(copy.exhibits) ? copy.exhibits : [])]) if (ex && typeof ex === "object") delete ex.annotations; return copy; };
    const page = [promptedCommentary(named), named, bare(promptedCommentary(named))].find((candidate) => { refusal = scaffoldRefusal(candidate, insight); return !refusal; }) ?? null;
    if (!page) return { form: source.form, page: null, why: `bound to ${claimed.join(", ")}, it does not compile (${String(refusal).replace(`${id}: `, "").slice(0, 200)})` };
    page.settles = { measures: claimed };
    if ((insight.cite || []).length) delete page.source;
    return { form: source.form, page, claimed, typed: typedParts(page) };
  });
  const taken = attempts.find((a) => a.page && !a.typed.length) ?? attempts.find((a) => a.page);
  if (taken) return { page: taken.page, bound: taken.claimed, form: taken.form, typed: taken.typed, fallback: null,
    // What the form is asked to carry and how well it does, with the other forms that carry it as well and bind as completely: the latitude the author has.
    // And the forms that only serve it, and the ones that would carry it and that the measures do not fill, each with what it lacks.
    ...(fit?.task && gradeIn(taken.form) > 0 ? { fit: { task: fit.task, grade: gradeIn(taken.form), shows: profileWords(fit.profile),
      equal: attempts.filter((a) => a !== taken && a.page && !a.typed.length && gradeIn(a.form) === gradeIn(taken.form)).map((a) => a.form),
      serves: fit.forms.ranked.filter((item) => item.grade < gradeIn(taken.form)).map((item) => item.form), lacking: fit.forms.lacking.map((item) => ({ form: item.form, lacks: item.lacks })) } } : {}),
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
function bindScaffold(page, insight, { fit = null, order, declared = [] } = {}) {
  const measures = Object.entries(insight.measures && typeof insight.measures === "object" ? insight.measures : {}).map(([name, m]) => ({ ref: `${insight.id}/${name}`, name, m, axis: axisOf(m) }));
  const claimed = [], reasons = [];
  const series = measures.filter((x) => x.axis.kind !== "scalar");
  // A figure's format keeps the number it prints (bind.mjs): one decimal place, or as many as the value needs.
  const formatOf = (x, at = -1) => { const value = valuesOf(x.m).at(at); return `0.${"0".repeat(Math.max(1, typeof value === "number" ? decimalsNeeded(value, { percent: isPercentUnit(x.m.unit) }) : 1))}`; };
  const charts = [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object");
  // An exhibit written from the measures in the shape its kind reads (claim-fit.mjs boundKeys), its marks moved to what it now draws.
  const bindChart = (ex, kind, from) => {
    const written = boundKeys(kind, from, { form: page.form });
    if (written.why) return void reasons.push(written.why);
    for (const key of DATA_KEYS) delete ex[key];
    Object.assign(ex, written.set);
    // A mark names a category the exhibit draws: the last along its axis. Small multiples and a box plot carry a highlight and no callout.
    const last = written.labels.at(-1);
    for (const list of [ex.annotations, ex.highlights]) for (const mark of list || []) if (mark && typeof mark === "object" && mark.category !== undefined) mark.category = last;
    for (const mark of ex.annotations || []) if (mark && typeof mark === "object" && mark.series !== undefined) mark.series = written.names[0];
    if (["chart.sparklines", "chart.boxplot"].includes(kind)) { delete ex.annotations; ex.highlights = [{ category: last }]; }
    if (kind === "chart.slope") ex.focusSeries = written.names[0];
    claimed.push(...written.claimed);
    promptExhibit(ex);
    // A chart over periods that marks nothing is scaffolded with its latest period highlighted - the value a title over time most
    // often states - where its renderer draws a highlight (charts.mjs chartDraws), for the author to move to the period the title
    // names (the compile proposes it: dependency_gates.mjs claimMarks).
    if (Array.isArray(ex.series) && !ex.pivot && from.find((x) => x.axis.kind !== "scalar")?.axis.kind === "periods" && chartDraws(String(ex.type ?? ""), "highlights") && !markedChart(ex)) ex.highlights = [{ category: last }];
  };
  // The first chart of a page is drawn as its form draws it; any other by the kind it names.
  const kindOf = (ex, at) => String(ex.type ?? (at === 0 ? kindOfForm(page.type, page.form) ?? "" : ""));
  // A page whose form leaves the kind of its exhibits open - panels, the chart under a strip or beside a hero number - draws
  // each cut of the insight's measures in the kind that carries it best (claim-fit.mjs), kinds of one grade in the deck's draw.
  const charted = charts.filter((ex, at) => kindOf(ex, at).startsWith("chart."));
  const singles = measures.filter((x) => x.axis.kind === "scalar");
  // Cuts of one question are read across: a kind every cut can take at its best grade is preferred, so the panels match.
  const matched = sharedKinds(fit?.exhibits ?? []);
  const cuts = (fit?.exhibits ?? []).map((cut) => {
    const from = [...cut.refs.map((ref) => measures.find((x) => x.ref === ref)).filter(Boolean), ...singles];
    const kinds = order(cut.kinds.equal.map((item) => item.kind).filter((kind) => kind.startsWith("chart.")), { task: cut.task, before: [["matched", (a, b) => matched.includes(b) - matched.includes(a)]] });
    // A kind the page already names for this exhibit - the plan's, once copied in - is the one scaffolded, where it carries the cut
    // as well as any; a cut past the exhibits the page names takes a kind the page names for another, so the panels still match.
    const named = declared[cut.at] ?? declared.find((kind) => kinds.includes(kind));
    return { from, kind: [...kinds.filter((kind) => kind === named), ...kinds].find((kind) => !boundKeys(kind, from).why) };
  }).filter((cut) => cut.kind);
  const [fewest, most] = [].concat(PAGE_TYPES[page.type].exhibits);
  const opened = charted.length && cuts.length >= (page.type === "panels" ? Math.max(fewest, 2) : 1) && charted.length === charts.length;
  if (opened) {
    const made = cuts.slice(0, page.type === "panels" ? most ?? fewest : 1).map((cut, at) => {
      // The worked exhibit's callouts come with it as prompts, moved to what the new exhibit draws: a chart marks its finding.
      const from = charted[at % charted.length];
      const ex = { type: cut.kind, heading: PROMPTS.heading, ...(typeof from.caption === "string" ? { caption: PROMPTS.caption } : {}),
        ...(Array.isArray(from.annotations) && CALLOUT_KINDS.has(cut.kind) ? { annotations: structuredClone(from.annotations).filter((mark) => mark && typeof mark === "object" && mark.category !== undefined).slice(0, 1).map((mark) => ({ category: mark.category, text: mark.text })) } : {}) };
      bindChart(ex, cut.kind, cut.from);
      return ex;
    });
    if (page.type === "panels") { delete page.exhibit; page.exhibits = made; } else if (page.exhibit) page.exhibit = made[0]; else page.exhibits = made;
  }
  (opened ? [] : charts).forEach((ex, at) => {
    const kind = kindOf(ex, at);
    const charted = kind.startsWith("chart.") || kind === "chart-group" || (page.type === "trend" && page.form === "model");
    // A profiles page introduces the players by their marks: its exhibit is not a measure drawn.
    if (page.type === "profiles") reasons.push("a profiles page introduces the players by their marks, and its exhibit takes no measure: write each player's numbers into its cells by reference");
    else if (charted) {
      // One exhibit takes the measures its kind sets together; several take one each, in turn, and a panel past the last measure is dropped while the page keeps two.
      const from = charts.length > 1 ? measures.filter((x) => x.axis.kind !== "scalar").slice(at, at + 1) : measures;
      if (from.length) bindChart(ex, kind, from);
      else reasons.push(`panel ${at + 1} has no measure left to plot (the insight records ${series.length} over periods or members)`);
    } else if (Array.isArray(ex.rows) && Array.isArray(ex.columns) && page.type === "lookup") {
      const table = tokenTable(measures, formatOf, ex.columns.some((c) => c && typeof c === "object" && c.implication));
      if (table) { for (const key of ["total", "highlightRow"]) delete ex[key]; Object.assign(ex, { columns: table.columns, rows: table.rows }); claimed.push(...table.refs); promptExhibit(ex); }
      else reasons.push("the insight records no measure a table can set out");
    } else if (Array.isArray(ex.rows) && Array.isArray(ex.columns) && page.type === "scorecard" && Object.hasOwn(RECORDED_CODING, page.form)) {
      // A scorecard of recorded magnitudes: the members down the side, a measure a column, each column coded as the form codes it.
      const table = series.some((x) => x.axis.kind === "members") ? tokenTable(measures.filter((x) => x.axis.kind === "members"), formatOf, ex.columns.some((c) => c && typeof c === "object" && c.implication)) : null;
      const coded = table ? RECORDED_CODING[page.form](table.columns.slice(1).filter((column) => !column.implication), table.refs.map((ref) => measures.find((x) => x.ref === ref))) : 0;
      if (table && coded) { for (const key of ["total", "highlightRow"]) delete ex[key]; Object.assign(ex, { columns: table.columns, rows: table.rows }); claimed.push(...table.refs); promptExhibit(ex); }
      else reasons.push(table ? `a ${page.form} scorecard codes percentages of a maximum, and the insight's measures over members are none` : `a ${page.form} scorecard sets recorded measures over members side by side, and the insight records none over three or more members`);
    } else if (Array.isArray(ex.rows) && Array.isArray(ex.columns)) {
      reasons.push(`the cells of a ${page.type}/${page.form} table code a judgement, which no measure records; recorded measures over members are a scorecard of form heatmap or bars, and the numbers set out side by side a lookup page (\`--scaffold lookup --evidence ${insight.id}\`)`);
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

// How each scorecard form that codes recorded magnitudes codes a table's measure columns, in place; each returns how many it coded.
// A heatmap shades every column on its own range; bars set the first measure as in-cell bars and leave the rest as figures;
// progress takes percentages of a maximum.
const RECORDED_CODING = Object.freeze({
  heatmap: (columns) => columns.map((column) => Object.assign(column, { heat: true })).length,
  bars: (columns) => columns.slice(0, 1).filter((column) => column.unit).map((column) => Object.assign(column, { bar: true })).length,
  progress: (columns, shown) => columns.filter((_, i) => isPercentUnit(shown[i].m.unit) && valuesOf(shown[i].m).every((v) => v === null || (v >= 0 && v <= 100))).map((column) => Object.assign(column, { type: "progress" })).length,
});

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
// A build bar and the craft floor under it read one rate, so a page answers for both by the same count.
const CHART_RATE = Object.freeze({ of: "charts", done: "chartsAnnotated", noun: "chart page", verb: "marking something on the plot" });
const TABLE_RATE = Object.freeze({ of: "tables", done: "tablesTreated", noun: "table", verb: "carrying a treatment" });
const CRAFT_RATES = Object.freeze({ BAR_CHARTS_ANNOTATED: CHART_RATE, CRAFT_CHARTS_BARE: CHART_RATE, BAR_TABLES_TREATED: TABLE_RATE, CRAFT_TABLES_PLAIN: TABLE_RATE });

const USAGE = "Usage: author-deck.mjs <id>.pages.json [--check [--render] | --draft | --plan | --log | --repair-relation <page-id>] [--page <id>[,<id>...]] [--fit-cap <n>] [--reopen-spine] | --types | --schema [type | deck] | --limits [<type>[/<form>]] | --example <type>[/<form>] | --scaffold <type>[/<form>] [--evidence <insight-id>]";

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
 * The text blocks each page sets under each choice a plan can take for it,
 * read the way the check reads them: the page as written - its own copy,
 * under the choice - is compiled by the full compile, composed and read by the
 * page budget (gates/density_profile.py scene_blocks). Returns
 * `blocksOf(page, choice)`, null for a page that does not compile or compose
 * so. A page whose copy is not written does not: words a block are a property
 * of the copy, and a stand-in for copy to come measured 48 words a block on a
 * deck whose written pages then measured 25. So a spine has no reading, and
 * the plan prints none.
 */
async function placementBlocks(doc, { insights, baseDir }) {
  const pages = [...doc.pages, ...(doc.appendix || [])];
  const keyOf = (page, choice) => `${page.id}|${choice.form}|${choice.commentary}`;
  // Each page as bound: an exhibit that names its measures written out, so the placeholder copy can mark a period or member of it.
  const written = bindDeck(doc, insights).doc, bound = [...written.pages, ...(written.appendix || [])];
  // A summary after the deck's first analytical page closes it (deck-structure.mjs freeChoices).
  const opening = pages.findIndex((page) => PAGE_TYPES[page?.type]);
  const candidates = pages.flatMap((page, index) => freeChoices(page, null, index > opening).map((choice) => ({ page: bound[index] ?? page, index, choice })));
  const slides = [];
  let deck = null;
  for (const [at, { page, index, choice }] of candidates.entries()) {
    try {
      const one = compileDeck({ ...doc, pages: [{ ...page, ...choice }], appendix: [] }, { insights, partial: true });
      deck ??= one.spec;
      if (one.spec.slides[0]) slides.push({ ...one.spec.slides[0], id: `c${at}`, key: keyOf(page, choice), index });
    } catch { /* a page that does not compile under this choice has no reading */ }
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
      // An alternative offered with its chart's mark is rendered with it: what is called verified is what was drawn.
      const chosen = withChoice(page, alt.form, alt.commentary);
      const one = compileDeck({ ...doc, pages: [alt.marks ? withMarks(chosen, alt.marks) : chosen], appendix: [] }, { insights, partial: true });
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

/** What a deck's draw features from its design system's repertoire, as a parenthesis for the plan; empty where the deck has no draw or the entries name no form. */
function featuredSay(deck) {
  if (deck?.variation === undefined) return "";
  const drawn = featuredDraw(deck.variation, deck.design);
  return drawn.forms.size || drawn.kinds.size ? ` (${drawn.say.join("; ")}: ${[...drawn.forms, ...drawn.kinds].join(", ")})` : ` (this draw - ${drawn.say.join("; ")} - names no form the plan chooses)`;
}

// What told a plan's choice from the others of equal fit, as the plan says it after "chosen by".
const CHOSEN_BY = Object.freeze({ rules: "the structure rules", spread: "the spread of the deck's kinds", featured: "the deck's featured draw", room: "the room it leaves under the caps",
  seed: "this deck's draw for the reading task (its `variation`)", order: "the catalogue's order (the deck has no `variation`)", convention: "the source deck's own way of drawing its like", source: "what its source slide drew", matched: "one kind for every cut of the page" });

/** What the fit says of one page of a plan, as the end of its line: how many forms fit equally and what chose among them, the kinds its open exhibits take, and where another form carries its claim more directly. */
function fitWords(page) {
  const short = (kind) => String(kind).replace(/^chart\./, "");
  const by = (key) => `chosen by ${CHOSEN_BY[key] ?? "the plan"}`;
  // A form the page declares was the author's choice among them; one the plan gave says what chose it.
  const kept = ["declared", "placed"].includes(page.source);
  const hand = page.hand ? `; this deck's draw takes ${page.hand}` : "";
  const also = page.also?.length ? (kept ? ` (also fits: ${page.also.join(", ")}${hand})` : ` - ${page.also.length + 1} forms fit equally (${[page.form, ...page.also].join(", ")}); ${page.form} ${by(page.by)}`) : page.by === "source" || page.by === "convention" ? ` - ${by(page.by)}` : "";
  const open = (page.kinds ?? []).filter((item) => item.also.length), others = [...new Set([...open.map((item) => item.kind), ...open.flatMap((item) => item.also)])];
  const kinds = page.kinds?.length ? `; exhibits ${page.kinds.map((item) => item.kind).join(", ")}${open.length ? ` - ${others.length} kinds fit equally (${others.map(short).join(", ")}); ${[...new Set(open.map((item) => by(item.by)))].join(", ")}` : ""}` : "";
  // An exhibit the author typed on a page of open kinds, where its kind is one of several that carry its cut equally and the deck's draw takes another.
  const typed = (page.typed ?? []).map((item) => ` - ${item.where} (${short(item.has)}) fits equally with ${item.also.map(short).join(", ")}; this deck's draw takes ${short(item.hand)}`).join("");
  const better = page.better?.length ? ` - ${READING_TASKS[page.task]}: carried more directly by form ${page.better.join(" or ")}` : "";
  const exhibits = (page.exhibits ?? []).map((item) => ` - ${item.where} (${item.has}) ${FIT_WORDS[item.grade]}: ${item.better.join(" or ")} ${item.better.length === 1 ? "carries" : "carry"} it directly`).join("");
  const elsewhere = page.elsewhere?.length ? ` - another type carries it directly: ${page.elsewhere.map((item) => `${item.type}/${item.form}`).join(", ")} (a change of type, made before the critique)` : "";
  const beside = page.beside?.length ? ` - another type carries it as directly: ${page.beside.map((item) => `${item.type}/${item.form}`).join(", ")}${page.typeHand ? `; this deck's draw takes ${page.typeHand.type}/${page.typeHand.form}` : ""} (a change of type, made before the critique)` : "";
  return `${also}${kinds}${typed}${better}${exhibits}${elsewhere}${beside}`;
}

/** `--plan`: the spine's structure rules on its declared types, and an allocation of form and placement that satisfies them. Returns the exit code. */
async function planCommand(doc, { dir, stem, file, say, refusal = [] }) {
  let insights = null;
  try { insights = await readInsights(dir, stem, { alternatives: alternativesOf(doc.deck) }); } catch (error) { refusal.push({ code: "COMPILE", message: String(error.message).slice(0, 300) }); console.error(error.message); return 2; }
  // A slide a revision carries from its source deck is not the runtime's to give a form: the plan is of the pages it composes.
  const typed = [...doc.pages, ...(doc.appendix || [])].filter((page) => page && typeof page === "object" && !page.kind && !isCarried(page));
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
  // Where a placement would leave the deck on the one rule read off the rendered text: read from each page that carries its copy.
  let blocksOf = null;
  try { blocksOf = await placementBlocks(doc, { insights, baseDir: dir }); } catch { blocksOf = null; }
  // A revision's pages are planned against the deck they were imported from: what each source slide drew.
  const sourceKinds = await sourceKindsOf(doc.deck, file);
  const plan = allocateStructure(doc, { insights, planOf, compiled, blocksOf, sourceKinds });
  // What the critique will read of each page as the spine stands: part of what the plan proposes, since the layout is held to it.
  // The proposal is drafted (authorDeck in draft, below), and what that draft refuses the plan refuses: the titles where the deck's
  // design sets them, each exhibit the spine determines proven drawable, the dependency contract and the structure rules.
  // A page that declares no form or no placement is read in the one the plan gives it: the spine the author is about to have,
  // since those are the choices this run asks them to copy in. A choice the page declares is read as declared.
  const given = new Map(plan.pages.map((page) => [String(page.id), page]));
  const take = (page) => { const to = page && typeof page === "object" && !isCarried(page) ? given.get(String(page.id)) : null;
    return to && (page.form === undefined || page.commentary === undefined) ? inLayout(page, page.form ?? to.form, page.commentary ?? to.commentary) : page; };
  const proposed = { ...doc, pages: doc.pages.map(take), ...(Array.isArray(doc.appendix) ? { appendix: doc.appendix.map(take) } : {}) };
  let readings = [], unfit = [], unlayable = [], drafted = null;
  // Where the proposal stands, and what of it is refused, is read by the draft itself, run on it: the plan allocates on descriptors
  // and estimates an exhibit a page has not declared, and a standing or a refusal printed from those can differ from the ones the
  // next command prints. So the plan refuses all the draft of its own proposal refuses - the titles that do not fit said apart, and
  // a structure rule the allocation already reports unmet said once.
  try {
    const draft = await authorDeck(proposed, { baseDir: dir, insights, draft: true }), unmet = new Set(plan.unsatisfied.map((u) => u.code));
    drafted = draft.standings.filter((st) => st.class === "S");
    readings = readingLines(draft.spec, insights);
    unfit = draft.blocking.filter((f) => f.code === "SPINE_UNFIT");
    unlayable = draft.blocking.filter((f) => f.code !== "SPINE_UNFIT" && !unmet.has(f.code));
  } catch { drafted = null; }
  // Where the forms that carry the claims best cannot meet a rule between them, the plan says what meeting it would cost: the
  // same search with every form of each type allowed, and the pages it would move off the forms that carry their claims best.
  const loose = !plan.satisfied && plan.pinned.length ? allocateStructure(doc, { insights, planOf, compiled, blocksOf, sourceKinds, forms: "any" }) : null;
  const mended = loose ? plan.unsatisfied.filter((u) => !u.fixedByTypes && !loose.unsatisfied.some((other) => other.code === u.code)).map((u) => u.code) : [];
  const served = mended.length ? loose.pages.filter((page) => page.served).map((page) => ({ id: page.id, form: page.form, best: page.served })) : [];
  const estimated = plan.pages.filter((page) => page.estimated).map((page) => String(page.id));
  const fragments = readStandings(plan.structure.standings.filter((st) => st.estimated));
  // The pages no reading could be taken from, under the choice the plan gives them.
  const unwritten = blocksOf ? plan.pages.filter((page) => { const source = typed.find((p) => String(p.id) === String(page.id)); return source && !blocksOf(source, { form: page.form, commentary: page.commentary }); }).length : plan.pages.length;
  const read = (structure) => readStandings(structure.standings.filter((st) => classOf(st.code) === "S"));
  // The structure rules the draft of the proposal refuses that no form or placement decides: the allocation does not claim them.
  const ruled = [...new Set(unlayable.filter((f) => classOf(f.code) === "S").map((f) => f.code))];
  const blockers = (structure) => inClassOrder(structure.findings.filter((f) => isBlocker(f) && classOf(f.code) === "S"));
  const count = (source) => plan.pages.filter((page) => page.source === source).length;
  const declared = plan.pages.every((page) => !["proposed", "placed"].includes(page.source)) ? { blocking: blockers(plan.declared).map((f) => f.code), standing: read(plan.declared).map((st) => st.line) } : null;
  const lines = [
    `Plan for ${path.basename(file)}: ${plan.pages.length} analytical pages; ${count("declared")} keep the form and placement they declare, ${count("placed")} keep the form they declare and are given a placement, ${count("proposed")} are given both, ${count("changed")} would change.`,
    ...(estimated.length ? [`${estimated.length} page${estimated.length === 1 ? " has" : "s have"} no exhibit written yet whose kind the form sets (${estimated.join(", ")}): ${estimated.length === 1 ? "its exhibits are" : "their exhibits are"} estimated from the measures and insights ${estimated.length === 1 ? "it names" : "they name"}, and marked below. What the rules say of ${estimated.length === 1 ? "it" : "them"} is a reading of that estimate, read again from the exhibits once they are written.`] : []),
    ...(declared ? [declared.blocking.length ? `As declared${estimated.length ? ", on that estimate," : ","} the deck's structure rules ${estimated.length ? "would refuse" : "refuse"} it: ${[...new Set(declared.blocking)].join(", ")}.`
      : `As declared${estimated.length ? ", on that estimate," : ","} the deck satisfies its structure rules.`] : ["Not every page declares a form and a placement, so the structure rules are read on the proposal."]),
    ...(unshaped.length ? ["", "Types the evidence cannot carry (choose another type, or find the data):", ...unshaped.map((line) => `  ${line}`)] : []),
    "", plan.satisfied ? `Proposed allocation (${ruled.length ? `its forms and placements meet every structure rule they decide; the draft of it refuses ${ruled.join(", ")}, below` : `satisfies every structure rule${estimated.length ? " as far as the pages declare their exhibits" : ""}`}; nothing was written - copy the choices you take into the pages file):`
      : `No allocation of forms and placements satisfies ${plan.unsatisfied.map((u) => u.code).join(", ")}${plan.capped ? ` within the search's budget (${plan.steps} changes, ${plan.evaluations} readings of the structure)` : ""}; the closest found:`,
    ...plan.pages.map((page) => `  ${String(page.id).padEnd(8)} ${page.type.padEnd(13)} form ${String(page.form).padEnd(18)} commentary ${String(page.commentary).padEnd(12)} ${page.source === "placed" ? "form declared, placement proposed" : page.source}${page.was ? ` (declared ${page.was.form}${page.was.commentary ? `/${page.was.commentary}` : ""})` : ""}${page.imported && page.source !== "proposed" ? " - imported page, kept as drawn" : ""}${page.estimated ? " - exhibit estimated" : ""}` +
      (page.reads ? ` - taken to meet a structure rule; this form reads ${page.reads.join(", ")}: check the evidence holds it` : "") + fitWords(page)),
    ...(estimated.length && plan.pages.some((page) => page.source === "changed") ? ["  A change to a declared choice above mends a rule that is broken on the estimate: write the estimated pages' exhibits (or give each its `type`) and run --plan again before taking it."] : []),
    ...(plan.unsatisfied.length ? ["", "Unsatisfied:", ...plan.unsatisfied.map((u) => `  ${u.standing ? readStandings([u.standing])[0].line : `${u.code}: ${u.finding.repair}`}` +
      (u.fixedByTypes ? "\n    The page types alone break this rule: no form or placement can meet it. Change a page's `type`, or mark a deliberate run with a shared `series`." : "")),
      ...(plan.pinned.length && plan.unsatisfied.some((u) => !u.fixedByTypes) ? [`  The plan keeps every page in a form that carries its claim best, and those forms do not meet ${plan.unsatisfied.filter((u) => !u.fixedByTypes).map((u) => u.code).join(", ")} between them.` +
        (served.length ? ` ${mended.join(", ")} would be met only by drawing ${served.length === 1 ? "this page" : "these pages"} in a form that is not a best fit for ${served.length === 1 ? "its" : "their"} claim: ${served.slice(0, 12).map((page) => `${page.id} as ${page.form} (best fit: ${page.best.join(", ")})`).join("; ")}${served.length > 12 ? `; and ${served.length - 12} more` : ""}. That trades the picture for the rule, and the plan does not propose it: the sounder repair is evidence of another shape or a page of another type, made before the critique. A form you declare on a page is kept, and is named under VARIETY_FIT_UNUSED.`
          : mended.length ? ` ${mended.join(", ")} would be met by other placements or forms the catalogue allows these pages; declare them and run --plan again.` : " No form the catalogue allows these pages meets it either: the page types or the evidence have to change.")] : [])] : []),
    ...(unfit.length ? ["", `${unfit.length} title${unfit.length === 1 ? "" : "s"} the storyline critique will be bound to ${unfit.length === 1 ? "does" : "do"} not fit where this deck draws ${unfit.length === 1 ? "it" : "them"} (SPINE_UNFIT; the plan is refused until ${unfit.length === 1 ? "it does" : "they do"}):`, ...unfit.map((f) => `  ${f.repair}`)] : []),
    ...(unlayable.length ? ["", `${unlayable.length} thing${unlayable.length === 1 ? "" : "s"} the draft of this proposal refuses - the spine as it would stand once its choices are copied in, which the layout cannot mend (the plan is refused until ${unlayable.length === 1 ? "it is" : "they are"} mended; \`--draft\` refuses the same):`,
      ...inClassOrder(unlayable, typed.map((page) => String(page.id))).map((f) => `  ${f.code}${(f.id ?? f.page) === undefined ? "" : ` [${f.id ?? f.page}]`} ${f.repair}`)] : []),
    ...(readings.length ? ["", `${READINGS_NOTE}:`, ...readings.map((line) => `  ${line}`)] : []),
    "", drafted ? "Where the proposed deck stands (structure rules, read by `--draft`'s own compile of this proposal, so the next draft prints the same; the aggregates are measured once pages compose):"
      : "Where the proposed deck stands (structure rules, on the plan's descriptors - the proposal did not compile as a draft; the aggregates are measured once pages compose):", ...(drafted ?? read(plan.structure)).map((st) => `  ${st.line}`),
    ...(fragments.length ? ["", "Read from the scene of each page as its copy is written, under its placement, the way `--check` reads it - a chart's own labels counted as the render counts them:",
      ...fragments.map((st) => `  ${st.line}${["over", "short"].includes(st.state) && st.each ? ` | pages ${st.side === "min" ? "under" : "over"} the bar at their placement: ${Object.entries(st.each).filter(([, value]) => (st.side === "min" ? value < st.bar : value > st.bar)).map(([id, value]) => `${id} (${value})`).join(", ")}` : ""}`),
      "  The free choices were steered away from placements that take this median out of its band; no declared choice was changed for it."]
      // Words a block are a property of the copy. Before it is written the plan has nothing to read, and prints the rule, not a number.
      : ["", `TEXT_FRAGMENTED is not read here: ${unwritten ? `${unwritten} of the ${plan.pages.length} pages carry no copy yet` : "too few prose pages compose as written"}, and the rule is on the copy - the prose pages' median words a block, held between ${BLOCK_BAND.low} and ${BLOCK_BAND.high}. A block is a run of text with no empty band inside it: each point, each caption, each item of a list or tile of a strip, and a chart's own labels where they stand apart. So a page of several short points or items sets small blocks, and points developed to ${Math.ceil(BLOCK_BAND.low)} words or more hold the band. \`--check\` prints the deck's standing from the composed pages as soon as they carry copy, and \`--plan\` run again then reads the same.`]),
    ...(plan.pages.some((page) => page.task || page.kinds) ? ["", `How each form was chosen: a page that declares no form is given one that carries its claim best - the reading task its measures set, told from what the page shows of them (claim-fit.mjs; \`--types\` prints what each form is right for) - and never a form that carries it less directly: a structure rule those forms cannot meet is reported unmet. Where several carry it equally well ("fit equally"), the plan takes one the deck's draw features from its design system's repertoire${featuredSay(doc.deck)}, else the one this deck's draw takes for that reading task - one order a deck, drawn by its \`variation\`${doc.deck?.variation === undefined ? " (this deck has none, so its kinds are spread and the catalogue's order breaks what is left: give it one with `node runtime/variation.mjs`)" : ` (${doc.deck.variation})`}, so every page that reads one task and can take the deck's mark takes it, on a form and on a panel alike: any of those is as good a choice, so another deck from the same spine draws those pages another way and differs nowhere else. A declared form or kind is always kept; where the draw would take another of its equals the line says which ("this deck's draw takes"), for you to take or leave. An exhibit the spine declares by a \`basis\` stub with no \`type\` is given its kind the same way and read as that kind: write that \`type\` on it. "Carried more directly by" marks a declared form another form of the type would carry better - advice, never a change the plan makes.${doc.deck?.workflow === REVISION ? " On a revision nothing is spread: an imported page keeps the form it declares, one that declares none takes the form that draws what its source slide drew, and a page the revision adds takes, of the forms that carry its claim best, the one the source deck draws most - the deck stays drawn one way." : ""}`] : []),
    "", "The plan reads what each page declares: a page that compiles is read as the compile reads it, and a declared form sets its exhibit's kind where the form does. Only what is absent is estimated - the exhibits of a page that has none yet and whose form leaves their kind to the author (panels take two), from the measures its claim names and the shape of its evidence - and such a page is marked. So the plan satisfies the structure rules as far as the declared descriptors go: a rule that counts exhibit kinds can still be met or broken by the exhibits those pages are given, and every compile reads the pages as written again. Where a proposed form asks more of the data than the evidence holds, declare the form it can carry and run --plan again: declared choices are kept and the rest re-allocated. A form built for particular data (an indexed trend, a distribution, small multiples, aligned bars, a diagram other than the type's first) is proposed only where no other allocation meets a rule, and is marked with the data it reads.",
  ];
  console.error(lines.join("\n"));
  // One page a line: `id type/form/commentary source`, the choices to copy into the pages file.
  say(JSON.stringify({ plan: { satisfied: plan.satisfied, ...(plan.capped ? { capped: true } : {}), unsatisfied: plan.unsatisfied.map((u) => ({ code: u.code, fixedByTypes: u.fixedByTypes })),
    ...(served.length ? { served: served.map((page) => `${page.id} ${page.form} (best fit: ${page.best.join(", ")})`), servedWouldMeet: mended } : {}),
    pages: plan.pages.map((page) => `${page.id} ${page.type}/${page.form}/${page.commentary} ${page.source}${page.was ? ` (declared ${page.was.form}${page.was.commentary ? `/${page.was.commentary}` : ""})` : ""}${page.reads ? " (reads its own data)" : ""}${page.estimated ? " (exhibit estimated)" : ""}`), ...(estimated.length ? { estimated } : {}), ...(readings.length ? { readings } : {}),
    // What the fit says of each page, by id: the task read, the forms and kinds of equal fit (the latitude), and the forms that carry a declared choice's claim more directly.
    ...(plan.pages.some((page) => page.task || page.kinds) ? { fit: Object.fromEntries(plan.pages.filter((page) => page.task || page.kinds || page.elsewhere || page.beside).map((page) => [page.id, { ...(page.task ? { task: page.task } : {}), ...(page.also ? { also: page.also } : {}), ...(page.by ? { by: page.by } : {}), ...(page.better ? { better: page.better } : {}),
      ...(page.hand ? { hand: page.hand } : {}), ...(page.typed ? { typed: page.typed.map((item) => `${item.where} ${item.has}: this deck's draw takes ${item.hand}`) } : {}),
      ...(page.kinds ? { kinds: page.kinds.map((item) => item.kind), alsoKinds: [...new Set(page.kinds.flatMap((item) => item.also))], kindsBy: [...new Set(page.kinds.filter((item) => item.also.length).map((item) => item.by))] } : {}), ...(page.exhibits ? { exhibits: page.exhibits.map((item) => `${item.where} ${item.has}: ${item.better.join(" or ")}`) } : {}),
      ...(page.elsewhere ? { elsewhere: page.elsewhere.map((item) => `${item.type}/${item.form}`) } : {}), ...(page.beside ? { beside: page.beside.map((item) => `${item.type}/${item.form}`) } : {}), ...(page.typeHand ? { typeHand: `${page.typeHand.type}/${page.typeHand.form}` } : {}) }])) } : {}) },
    ...(declared ? { declared } : {}), ...(unshaped.length ? { evidence: unshaped } : {}), ...(unfit.length ? { unfit: unfit.map((f) => ({ code: f.code, id: f.id, measured: f.measured, repair: f.repair })) } : {}),
    ...(unlayable.length ? { unlayable: unlayable.map((f) => ({ code: f.code, id: f.id ?? f.page, measured: f.measured, repair: f.repair })) } : {}),
    search: { steps: plan.steps, evaluations: plan.evaluations }, standing: { S: (drafted ?? read(plan.structure)).map((st) => st.line), ...(fragments.length ? { estimated: fragments.map((st) => st.line) } : {}) } }, null, 1));
  // What the run was refused for, as the author log keeps it.
  refusal.push(...plan.unsatisfied.map((u) => ({ code: u.code, class: classOf(u.code), message: String(u.standing ? readStandings([u.standing])[0].line : u.finding.repair).slice(0, 300) })),
    ...[...unfit, ...unlayable].map((f) => ({ code: f.code, class: classOf(f.code), ...(f.id ?? f.page ? { id: String(f.id ?? f.page) } : {}), message: String(f.repair).slice(0, 300) })));
  return plan.satisfied && !unfit.length && !unlayable.length ? 0 : 2;
}

/** SPINE_LOCKED, one finding a page whose argument moved after the critique closed (storyline.mjs spineLock). */
function spineLockFindings(lock) {
  const how = lock.closed === "spent" ? `spent its ${lock.spent} passes` : `closed ${lock.verdict} at pass ${lock.pass}`;
  const back = `To change the argument, run again with --reopen-spine and take the deck back to the critique (node runtime/storyline.mjs <id>.deck.json out/)${lock.closed === "spent" ? ", whose next pass is past its cap: only the user can grant it (--max-passes)" : ""}`;
  if (!lock.pages.length) return [{ code: "SPINE_LOCKED", class: "S", severity: "blocker", id: null,
    repair: `The storyline critique ${how}, and the deck's answer, its request or the order of its pages has moved since. The layout keeps what the critique read: put it back. ${back}.` }];
  return lock.pages.map((id) => ({ code: "SPINE_LOCKED", class: "S", severity: "blocker", id,
    repair: lock.deleted.includes(id)
      ? `The storyline critique ${how} with ${id} in the deck, and it has been taken out since. The layout keeps the pages the critique read: put it back. ${back}.`
      : `The storyline critique ${how}, and ${id}'s argument has moved since - its title, its page type, what settles its claim, the insights and measures it rests on and shows, or which periods or members of a measure it shows and how. The layout keeps what the critique read: put the page back as it was; copy, layout and a chart redrawn in another chart form are free. ${back}.` }));
}

/** The CLI. Returns the exit code. */
async function main(argv) {
  const { values, positionals: [file] } = parseCli(argv, { types: { type: "boolean" }, schema: { type: "string", bare: "" }, icons: { type: "boolean" }, limits: { type: "string", bare: "" },
    example: { type: "string", bare: "" }, scaffold: { type: "string" }, evidence: { type: "string" }, id: { type: "string" }, out: { type: "string" },
    log: { type: "boolean" }, check: { type: "boolean" }, draft: { type: "boolean" }, "repair-relation": { type: "string", valueName: "a page id" },
    page: { type: "string", valueName: "one or more page ids, comma-separated" }, render: { type: "boolean" }, plan: { type: "boolean" }, "fit-cap": { type: "string", valueName: "a number of alternatives" },
    "reopen-spine": { type: "boolean" } }, { usage: USAGE });
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
  // A revision says first what it does with each slide of the deck it was imported from: what it is judged on, and what it is not.
  // A full compile that raises, on the storyline its critique passed as ready, a finding only a change to that storyline mends -
  // and that the draft of the same pages does not raise - is recorded in the deck's lineage: the storyline loop grants its one
  // pass outside the cap on this record, and on nothing else (storyline.mjs recordCompileRefusal, which says why a page the
  // page compile refuses never earns it).
  let refusalRecord = null;
  if (!draft && !named && compiled.blocking.length) try { refusalRecord = await recordCompileRefusal(path.join(dir, `${stem}.deck.json`), { spec, refused: compiled.refused, findings: compiled.blocking, measures: insights ? recordedMeasures([...insights.values()]) : null,
    drafted: async () => (await authorDeck(doc, { baseDir: dir, insights, draft: true, fit: false })).blocking }); } catch { refusalRecord = null; }
  if (refusalRecord) console.error(`This compile raises, on the storyline the critique passed as ready, what only a change to that storyline mends and what the draft of the same pages passed (${refusalRecord.findings.map((f) => `${f.id}: ${f.code}`).join("; ")}): the runtime disagrees with itself. Mend those pages; \`node runtime/storyline.mjs\` then writes one verification pass for them that does not count against the critique's cap - once in a lineage, and only while no other page's argument changes.\n`);
  // The storyline as the critique closed it is held through the layout (storyline.mjs spineLock): a page whose argument moved
  // since is refused here, where the edit was made, unless the run means it (--reopen-spine) and takes the deck back to the critique.
  const lock = draft || values["reopen-spine"] ? null
    : await spineLock(spec, path.resolve(values.out ?? path.join(dir, "out")), { deckPath: path.join(dir, `${stem}.deck.json`) }).catch(() => null);
  const locked = lock ? spineLockFindings(lock) : [];
  if (values["reopen-spine"] && !draft) console.error("--reopen-spine: the argument may change; every page whose argument moved goes back to the storyline critique (node runtime/storyline.mjs <id>.deck.json out/) before delivery.\n");
  const revision = revisionStatement(spec, compiled.imported);
  if (revision) console.error(`${revisionLine(revision)}\n`);
  // Where a composed page is read as changed because the inventory cannot say otherwise, the run says so (review-passes.mjs unheldLine).
  const readAsChanged = revision ? revisionChanges(spec, compiled.imported) : null;
  if (unheldLine(readAsChanged)) console.error(`${unheldLine(readAsChanged)}\n`);
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
  const everything = withParts(doc, merge([...locked, ...compiled.blocking], rendered?.blockers ?? [])), advice = withParts(doc, merge(compiled.advisories, rendered?.advisories ?? []));
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
  // What a revision that carries slides is not held to is said in a line, by code and by why (weight.mjs deckRuleUnread).
  const unheld = new Map();
  for (const f of advice) if (f.waived?.imported) unheld.set(f.waived.why, [...(unheld.get(f.waived.why) ?? []), f.code]);
  const counted = (codes) => [...new Set(codes)].map((code) => { const n = codes.filter((c) => c === code).length; return `${code}${n > 1 ? ` x${n}` : ""}`; }).join(", ");
  const notHeldLine = unheld.size ? `Not held (advisories): ${[...unheld].map(([why, codes]) => `${counted(codes)} - ${why}`).join("; ")}` : null;
  // What a revision's change may have left standing elsewhere is said in full where it only advises: the author checks each slide named.
  const stale = advice.filter((f) => ["NUMBER_STALE", "WORDING_STALE"].includes(f.code) && !f.deferred);
  const tail = [
    ...(stale.length ? [`To check (advisories):\n${stale.map((f) => `  ${f.code} [${f.id ?? (f.pages || []).join(", ")}]\n    ${f.repair}`).join("\n")}`] : []),
    ...(notHeldLine ? [notHeldLine] : []),
    ...(beyond.length ? [`Deck structure findings these pages are not named in (not counted in this run's exit code; the whole-deck run holds them):\n${findingsText(beyond, order)}`] : []),
    ...(aggregatesBeyond.length ? [`Deck aggregate findings these pages are not counted in (not counted in this run's exit code; the whole-deck run holds them):\n${findingsText(aggregatesBeyond, order)}`] : []),
    ...(share ? [`Each page's part in the deck's aggregates:\n${Object.entries(share).map(([id, lines]) => `  ${id}: ${lines.length ? lines.join("\n    ") : "counted in no aggregate out of its band"}`).join("\n")}`] : []),
    `Where the deck stands:\n${standingText(standings)}`,
    ...(draft && deferredLines(spec, advice).length ? [`Left to the full compile - what the copy, the layout or the fit settles, none of it a fact the storyline critique is bound to (a count a code). A draft is the full compile of the spine completed with placeholder copy, and this is all it defers: ${Object.entries(DEFERRED).map(([kind, what]) => `${kind} - ${what}`).join("; ")}:\n${deferredLines(spec, advice).map((line) => `  ${line}`).join("\n")}`] : []),
    ...(draft && movedLines(spec).length ? [`Drawn in another form or placement than the page declares (the layout's choice, said now so the layout takes it):\n${movedLines(spec).map((line) => `  ${line}`).join("\n")}`] : []),
    ...(draft && readingLines(spec, insights).length ? [`${READINGS_NOTE}:\n${readingLines(spec, insights).map((line) => `  ${line}`).join("\n")}`] : []),
    ...(draft && fitChoiceLines(spec, insights).length ? [`${FITS_NOTE}:\n${fitChoiceLines(spec, insights).map((line) => `  ${line}`).join("\n")}`] : []),
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
  const shown = (named ? advice.filter((f) => f.class !== "P" || about(f)) : advice).filter((f) => !f.waived?.imported);
  const summary = { ...deckSummary({ values, draft, insights, spec, advisories: shown, pageGatesRan, pageGatesError }), ...(compiled.assets ? { assets: compiled.assets } : {}), standing,
    ...(revision ? { revision: { ...revision, ...(unheld.size ? { notHeld: Object.fromEntries([...unheld].flatMap(([why, codes]) => codes.map((code) => [code, why]))) } : {}), ...(readAsChanged?.unheld.length ? { readAsChanged: readAsChanged.unheld } : {}) } } : {}),
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
function withLimits(page, density, more = {}) {
  const limits = { ...pageLimits(page.type, page.form, { commentary: page.commentary, density }), ...more };
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
    // The page the scaffold is for, where the pages file holds it (`--id`): the form it declares - the plan's allocation, once
    // copied in - is the form scaffolded, and its own `settles` says what kind of claim the form has to carry.
    const own = values.id && scoped ? [...(scoped.pages || []), ...(scoped.appendix || [])].find((p) => p && typeof p === "object" && String(p.id) === String(values.id) && p.type === type) ?? null : null;
    const declared = !form && own && Object.hasOwn(PAGE_TYPES[type]?.forms ?? {}, own.form ?? "") ? own.form : null;
    try { report = scaffoldReport(type, { id: values.id ?? "p00", form: form || declared || null, insight, seed: scoped?.deck?.variation ?? null, featured: scoped?.deck ? drawOf(scoped.deck) : null, claim: own?.settles ?? null,
      kinds: own ? [own.exhibit, ...(Array.isArray(own.exhibits) ? own.exhibits : [])].filter((ex) => ex && typeof ex === "object").map((ex) => (typeof ex.type === "string" ? ex.type : null)) : null }); page = report.page; } catch (error) { console.error(error.message); return 1; }
    if (declared) console.error(`${values.id} declares form "${declared}" in ${path.basename(file)}, so that form is scaffolded; \`--scaffold ${type}/<form>\` asks for another.`);
    // On a revision, the page scaffolded for a slide (`--id` of a page that names its `sourceSlide`) keeps the slide's place and
    // prints what it is held to there, what it may keep of the slide, and what the slide holds to redraw from (revision.mjs).
    const standsFor = scoped?.deck?.workflow === REVISION && values.id ? [...(scoped.pages || [])].find((p) => p && typeof p === "object" && String(p.id) === String(values.id) && Number.isInteger(p.sourceSlide)) ?? null : null;
    const inventory = standsFor && typeof scoped.deck.inventory === "string" ? await readJson(path.resolve(path.dirname(path.resolve(file)), scoped.deck.inventory), { optional: true }).catch(() => null) : null;
    const revisionLimits = composedPageLimits((inventory?.slides || []).find((slide) => slide.index === standsFor?.sourceSlide), standsFor ? scoped.deck.inventory : null);
    if (revisionLimits) { say(withLimits({ ...page, sourceSlide: standsFor.sourceSlide }, density, { revision: revisionLimits }));
      console.error(`${values.id} stands for slide ${standsFor.sourceSlide} of the imported deck: paste the scaffold over the carried page (it keeps \`id\` and \`sourceSlide\`; \`carry\` and \`draft\` go), and replace the worked example's numbers with the slide's own, printed under \`limits.revision.slide\`. \`limits.revision\` says what the page is held to, what it may keep of the slide and the least evidence it owes.`); }
    else say(withLimits(page, density));
    if (page.form === "executive-summary") console.error(SUMMARY_AT_SPINE);
    // How far the page is bound to the insight is said, never left to be read off the JSON: what names its measures, what still
    // holds the worked example's numbers, and - where nothing bound - why, form by form.
    if (insight?.shape) {
      const passed = (report.passed ?? []).map((item) => `${item.form} (${item.why})`);
      // Why this form: what the insight's measures give a reader to read, how the form carries it, and the forms that carry it as well.
      const fitted = report.fit ? ` Its measures show ${report.fit.shows}, which asks the reader to read ${READING_TASKS[report.fit.task]}: ${type}/${report.form} ${FIT_WORDS[report.fit.grade]}` +
        (report.fit.equal.length ? `; ${report.fit.equal.map((name) => `\`${type}/${name}\``).join(", ")} ${report.fit.equal.length === 1 ? "carries" : "carry"} it as well and ${report.fit.equal.length === 1 ? "binds" : "bind"} as completely (\`--scaffold ${type}/<form>\`) - a free choice: take the form \`--plan\` allocated this page, the mark whose turn it is in this deck's draw; asked without the page, this scaffold takes the draw's lead mark for the reading task.` : `, the one form of the type that does${report.fit.grade === GRADE.direct ? "" : " as well"}.`) +
        (report.fit.serves.length ? ` Serving it with the reader doing work: ${report.fit.serves.join(", ")}.` : "") +
        (report.fit.lacking.length ? ` ${report.fit.lacking.slice(0, 4).map((item) => fitSentence(item.form, report.fit.task, GRADE.direct, item.lacks)).join("; ")}.` : "") : "";
      if (report.bound.length) console.error(`Bound to ${insight.id}: ${type}/${report.form} names ${report.bound.join(", ")}, and the runtime writes the numbers.${form ? "" : fitted}` +
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

/**
 * Which forms carry each page's claim, a page a line, for a draft: the
 * reading task its measures set and every form of its type that is a best fit
 * - the latitude the layout has - with the form the page declares named where
 * another carries the claim more directly. Only pages with a choice to make or
 * to mend are listed; a page whose one best-fit form is the form it has needs
 * no line.
 */
function fitChoiceLines(spec, insights) {
  if (!insights) return [];
  // A page that declares a form whose content is a judgement - a Harvey ball, a verdict a cell - chose it for what no measure says, and is not listed.
  return [...fitsOf(spec, insights).values()].filter((fit) => fit.task && (!fit.form || fit.chosen || fit.type === "numbers" || fit.type === "panels") && (fit.forms.equal.length > 1 || fit.left.length) && !(spec.workflow === REVISION && fit.imported)).map((fit) => {
    const equal = fit.forms.equal.map((item) => item.form), below = fit.left.find((item) => item.where === "form");
    return `${fit.id} ${fit.type}${fit.form ? `/${fit.form}` : ""}: ${READING_TASKS[fit.task]} - best fit ${equal.join(", ")}${below ? `; the declared form ${FIT_WORDS[below.grade]}` : ""}` +
      fit.left.filter((item) => item.where !== "form").map((item) => `; ${item.where} (${item.has}) ${FIT_WORDS[item.grade]}, best fit ${item.better.join(", ")}`).join("");
  });
}
const FITS_NOTE = "Which forms carry each page's claim (claim-fit.mjs; `--types` lists every reading task): a form within a page's type is the layout's to choose and keeps the critique, so take the one `--plan` allocates - among these it takes the one this deck's draw takes for the reading task (its `variation`), on every page that reads that task - and never one outside them for variety's sake";

const READINGS_NOTE = "How the storyline critique will read each measure a page shows and does not draw yet - the layout is held to this reading. A page that will show the whole measure plotted needs nothing; one that will show a window, some members, a table or one figure says so now: write the bound exhibit (`series: [{ measure }]` with `select`, a metric's `measure`), or state the view in the exhibit's or metric's `basis` - `as: \"chart\" | \"table\" | \"figure\"` and `labels: [...]`, `labels: { from, to }` or `members: [...]`";

// A page compiled for a draft with a refusal the full compile will make records it as an advisory that opens so (page-types.mjs deferredSlide).
const DEFERRED_PREFIX = "deferred to the full compile";

/**
 * What a draft leaves to the full compile, in lines: for each of the copy, the
 * layout and the fit, every code it settles with how many findings and the
 * pages they name - "settled by the copy: TEXT_COVERAGE_LOW x3 (p02, p03,
 * ...) (enforced by the full compile)". It is the closed list a draft defers
 * (spine-witness.mjs DEFERRED), and none of it is a fact the critique binds.
 * The pages whose copy or unbound content the draft stood in for are counted
 * with it, under the copy, and so is a page drawn, in its witness, in another
 * form or commentary placement than the one it declares, because the one it
 * declares does not hold it: COMPILE, under the layout.
 */
function deferredLines(spec, advisories) {
  const groups = new Map(Object.keys(SETTLED_LATER).map((kind) => [kind, new Map()]));
  const count = (kind, code, id) => { const codes = groups.get(kind); codes.set(code, [...(codes.get(code) ?? []), ...(id === undefined || id === null ? [null] : [String(id)])]); };
  for (const f of advisories.filter((f) => f.deferred)) count(f.settledBy ?? "copy", f.code, f.id ?? f.page);
  const UNWRITTEN = "pages whose copy or unbound content is not written yet";
  for (const slide of [...spec.slides, ...(spec.appendix || [])]) {
    if (slide.pageType?.pending?.length) count("copy", UNWRITTEN, slide.id);
    if (slide.pageType?.moved) count(slide.pageType.moved.stage === "copy" ? "copy" : "layout", "COMPILE", slide.id);
  }
  return [...groups].filter(([, codes]) => codes.size).map(([kind, codes]) => `settled by ${SETTLED_LATER[kind]}: ${[...codes].map(([code, ids]) => {
    const named = ids.filter(Boolean);
    return `${code}${ids.length > 1 || code === UNWRITTEN ? ` x${ids.length}` : ""}${named.length ? ` (${named.slice(0, 6).join(", ")}${named.length > 6 ? ", ..." : ""})` : ""}`; }).join("; ")} (enforced by the full compile)`);
}

/** The pages of a draft whose witness took another layout than the one they declare, a line each: what refused the declared one, and what holds the page. */
function movedLines(spec) {
  return [...spec.slides, ...(spec.appendix || [])].filter((slide) => slide.pageType?.moved).map((slide) => { const { moved, form, commentary } = slide.pageType;
    void form; void commentary;
    return `${slide.id}: ${moved.form}/${moved.commentary} does not hold the page as the spine declares it (${moved.why}); ${moved.to} does - a form and a placement are the layout's to choose, so the critique is not affected, and the full compile refuses ${moved.form}/${moved.commentary} until it is changed or what refused it is mended`; });
}

// The advisories a run prints with their text: the consistency of what the pages state, and the build bars.
const SAID_IN_FULL = /^(?:NUMBERS_DISAGREE|NUMBER_STALE|WORDING_STALE|NUMBER_FORMATS_DIFFER|PROOF_REPEATS|BAR_[A-Z_]+)$/;

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
    ...(draft && fitChoiceLines(spec, insights).length ? { fits: fitChoiceLines(spec, insights) } : {}),
    ...(pageGatesRan ? {} : { pageGates: `did not run: ${pageGatesError || "no reason given"}` }),
    // Each typed number that is no value of a measure its page rests on, by page and field: the list the author checks by hand, or replaces with references.
    ...(untraced.length ? { untracedNumbers: Object.fromEntries(untraced.map((f) => [f.id, f.measured])) } : {}),
    // What a draft leaves to the full compile, grouped by what settles it - the copy, the layout or the fit - one line a code
    // with its count: none of it is about what the storyline critique is bound to, which a draft refuses instead.
    ...(draft && deferredLines(spec, advisories).length ? { deferred: deferredLines(spec, advisories) } : {}),
    // What the pages say between them, and a build bar the deck waives or a revision's untouched pages miss: said in full, since the
    // pages and the two numbers are the advisory.
    ...(advisories.some((f) => !f.deferred && SAID_IN_FULL.test(f.code)) ? { between: advisories.filter((f) => !f.deferred && SAID_IN_FULL.test(f.code)).map((f) => `${f.code}${f.pages?.length ? ` [${f.pages.slice(0, 8).join(", ")}${f.pages.length > 8 ? ", ..." : ""}]` : ""}: ${f.repair}`) } : {}),
    // Every other advisory in class order.
    advisories: advisories.filter((f) => !f.deferred).map((f) => `${f.code}${f.id ? ` [${f.id}]` : ""}`)
      .concat(typed.flatMap((s) => (s.pageType.advisories || []).filter((a) => !a.startsWith(DEFERRED_PREFIX)).map((a) => `${a.split(":")[0]} [${s.id}]: ${a.slice(a.indexOf(":") + 2)}`))) };
  return summary;
}

if (isMain(import.meta.url)) runCli(main);
