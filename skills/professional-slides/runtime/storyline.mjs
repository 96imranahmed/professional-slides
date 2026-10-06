#!/usr/bin/env node
// The storyline critique: an adversarial, senior reading of the dot-dash before
// anything is drawn.
//
//   node runtime/storyline.mjs <id>.deck.json out/                  the spine critique: records a returned critique, then
//                                                                   writes the next packet or says the spine is ready
//   node runtime/storyline.mjs <id>.deck.json out/ --full           the page-level critique as well: every content page on every page check
//   node runtime/storyline.mjs <id>.deck.json out/ --run [codex|claude] [--model m]
//                                                                   also runs a fresh critic for the packet
//   node runtime/storyline.mjs merge <id>.deck.json out/            joins parallel section critiques (--full on a long spine)
//                                                                   into out/storyline-review.json
//   ... --max-passes n                                              lifts the cap of three passes, when the user asks for another
//   ... --reason "<why>" [--user-approved]                          switching between --full and the spine critique
//                                                                   (--spine) starts a new lineage; a second restart needs the user
//
// Exit codes (EXIT in errors.mjs): 0 ready (or provisional: the answer is offered as provisional and every open item needs evidence the scope forbids), 3 a packet is waiting for
// a critic, 2 revise, capped, refused or an invalid critique, 1 a crash or bad usage.
//
// A deck can pass every gate and still argue nothing: a governing answer that
// restates the question or declines to answer it, pillars that overlap, pages
// that report counts nobody asked about, the analysis a sharp team would have
// run left out. The review of the rendered deck finds this late, after fifty
// pages are drawn. This is the mock problem-solving session instead: an
// independent reader who did not write the story reads the user's request and
// the spine - the answer, the sections, the titles in order and what each page
// claims, rests on and plots - attacks the argument the way a senior partner
// would, and says whether it is ready. It returns at most ten items, the ones
// that most change whether the deck answers the request. `--full` adds the
// page-level critique: a verdict for every content page on every page check.
//
// The first pass is exhaustive for its scope; later passes verify
// (review-passes.mjs): a status for every open item, new items only where
// serious and additive, at most three passes. The deck review waits for this
// gate: `storylineGate` is ready only for the spine the critique read.
//
// The critique is bound to the argument, not to how it is drawn: the request,
// the answer and its status, the sections and pages in order, and per page its
// title, its claim, its page type, what settles the claim, the insights and
// analyses it rests on, the measures it declares it shows with their recorded
// values, and what the page shows of each: which of its periods or members,
// and whether plotted, tabulated or stated as a figure (storyStructure). A
// table - any exhibit with no axis to read - shows a period or member where it
// names it and states its recorded number there, and the values it types are
// bound as themselves. An exhibit that names no recorded measure is bound by
// the numbers it draws. A
// chart's form within its class, where the commentary sits, captions,
// highlights and copy are the layout, which is done once, after the critique
// is ready, and leaves it valid. Its passes live beside the deck file, keyed by
// deck id (review-passes.mjs lineageStore), so a new output directory continues
// the lineage rather than restarting it.
import { SHAPES, TYPE_SHAPES, breadthOf, breadthProblem, plottedValues, trivialChart, trendChart, isTable, cellText, rowCells, rowLabel } from "./evidence.mjs";
import { axisOf, measureRegistry, valuesOf } from "./measures.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { textWords } from "./text-contract.mjs";
import { registered } from "./errors.mjs";
import {
  SEVERITIES, PAGE_VERDICTS, STATUSES, NEW_BASES, MAX_PASSES, BLOCKING,
  pageListErrors, settlePageList, advanceLedger, openEntries, openBlocking, openAboutImported, aboutImportedErrors, ABOUT_IMPORTED_RULE, verificationErrors, coverageErrors,
  changedPages, capMessage, uniqueIds, detectBackend, nextPassScope, splitSections, partSetErrors, joinParts, readParts,
  callReviewer, reviewParts, readPasses, recordPass,
  PROVENANCE_SCHEMA, provenanceLine, provenanceErrors, sha256, requestOf, requestHash, requestErrors, stageReview, lineageStore, restartLineage, isAuthFailure,
  readInventory, revisionChanges, locateDeck, requestStatement, scopeSourceErrors, requestProvenanceOf, evidenceScopeOf, answerStatusOf, retireLineage, carriedItems, settleCarried, carriedErrors, CARRIED_SCHEMA,
  ANSWERS_RULE, ANSWERS_SCHEMA, itemLines, reasonOf, SAMPLING_WORDS, ARGUMENT_SEVERITIES, BLOCKING_STAKE, ratingScale, spineClauses, REVIEW_HISTORY, readConfirmations,
} from "./review-passes.mjs";
import { repairOf, reviewRepairOf } from "./gates/gate_classes.mjs";
import { evidenceDepth, VARIETY } from "./gates/variety_gates.mjs";
import { titleLimits, titleLimitsLine, titleErrors } from "./review-floors.mjs";
import { sectionTitleFits } from "./spine-fit.mjs";
import { alternativesOf, analysisInsights, analysisLine, readAnalysis } from "./analysis.mjs";
import { insightGradeProblems, readInsightLog } from "./measures.mjs";
import { typeFitNote } from "./claim-fit.mjs";
import { VIEW_CLASSES, declaredLabels, declaresView, dependencyNotes, metricsOf, refsOf, roleFor } from "./gates/dependency_gates.mjs";
import { percentUnit, printedNumbers, states } from "./printed-numbers.mjs";
import { carriedSaid, withCarriedPages } from "./revision.mjs";
import { naturalClass } from "./spine-witness.mjs";

// `provisional` is a storyline whose team has done everything the evidence in
// scope allows and whose answer is offered as provisional: the decisive gaps
// that remain need evidence the team may not fetch, and they stay open.
export const STORYLINE_VERDICTS = Object.freeze(["ready", "provisional", "revise"]);
export const STORYLINE_MODES = Object.freeze(["spine", "full"]);
// A missing analysis searched for and not found closes as `unavailable`, with
// the search log under the deck's sources/ to show it.
// `narrowed` closes an item the answer no longer needs, because it now claims
// less; `scope-limited` keeps open, at its severity, a missing analysis whose
// data the team may not fetch - a limit recorded, never a defect excused.
export const STORYLINE_STATUSES = Object.freeze([...STATUSES, "unavailable", "narrowed", "scope-limited", "withdrawn"]);
/** How a missing analysis could be supplied: what the team is asked to do about it. */
export const REMEDIES = Object.freeze({
  computable: "the measures in the packet can compute it",
  assumption: "an input is unrecorded and a stated assumption can stand in, as a labelled scenario",
  retrieval: "it needs data the packet does not hold",
});
// Two judgements, kept apart. Compliance: has the team done everything the
// evidence in scope allows. Sufficiency: does that evidence support the answer
// as it is stated. A deck can comply and still not be sufficient.
export const COMPLIANCE_VERDICTS = Object.freeze(["complete", "incomplete"]);
export const SUFFICIENCY_VERDICTS = Object.freeze(["sufficient", "provisional", "insufficient"]);
// The spine critique returns the items that most change whether the deck
// answers the request, not everything a reader could say.
export const SPINE_ITEM_MAX = 10;
// The ledger codes of a critique's items besides its findings, which carry
// STORY_<CHECK> for the check they fail (storylineItems).
export const STORYLINE_CODES = Object.freeze({
  MISSING_ANALYSIS: "an analysis a strong team would have run is missing from the storyline",
  CUT_PAGE: "a page that repeats, previews or pads the argument, to cut",
  MERGE_PAGES: "pages that make one point between them, to merge",
});

/**
 * What the critique checks. The first five are checked on every page and
 * noted in its coverage entry; the rest are read off the spine as a whole.
 * references/storylining.md#stress-test-the-storyline states the same list.
 *
 * Each check is the critique's own question and, after it, every clause of
 * the deck review's rubric that the spine already decides (review-passes.mjs
 * RUBRIC_CLAUSES, by the check each names), in the reviewer's words. So the
 * critic applies at the spine what the reviewer will apply to the drawn page,
 * and neither prompt holds a second wording of it: `own` is the critique's,
 * `held` the reviewer's, `checks` the two as the prompt prints them.
 */
const OWN_CHECKS = {
  claim: ["page", "the page's claim is a finding with an implication, not a count, a fact or a two-number comparison"],
  shape: ["page", "the evidence has the shape the claim needs - the share and its movement, the ratio, the benchmark gap, the map, the judging table - not an unjudged list; where a page's line ends in `fit:`, the runtime read from its measures that another page type carries the claim directly: the page changes its type, or its claim is one only its own type makes (exact values to look up, a judgement the measures do not hold)"],
  sourcing: ["page", "the claim traces to insights in the log, each with its calculation and source files: supported, partly supported or unsupported, naming the insight ids"],
  restatement: ["page", "the page moves the argument on from the page before it (a summary, a divider and the close are exempt)"],
  consequence: ["page", "the page says what follows for the decision, not only what is true"],
  spine: ["spine", "the titles read alone tell the story: each a finding, in an order that builds to the answer"],
  answer: ["spine", "the governing answer answers every part of the user's request, is sharp enough to be wrong, and is what the pages add up to"],
  pillars: ["spine", "the pillars are distinct reasons that together prove the answer, and none rests on nothing"],
  numbers: ["spine", "a figure is the same number on every page that states it - in a title, a claim or a measure shown - and totals reconcile across pages"],
  flow: ["spine", "no section previews another or ends without its point"],
  summary: ["spine", ""],
  missing: ["spine", "the analyses a strong team would have run are here, or named with why they matter and the public data behind them"],
  cuts: ["spine", "pages that repeat, preview or pad are cut or merged, and the freed pages carry a missing analysis"],
};
export const STORYLINE_CHECKS = Object.freeze(Object.fromEntries(Object.entries(OWN_CHECKS).map(([check, [scope, own]]) => {
  const held = spineClauses(check);
  return [check, Object.freeze({ scope, own, held: Object.freeze(held), checks: [own, ...held].filter(Boolean).join("; ") })];
})));
export const STORYLINE_DIMENSIONS = Object.freeze(Object.keys(STORYLINE_CHECKS));
export const STORYLINE_PAGE_CHECKS = Object.freeze(STORYLINE_DIMENSIONS.filter((d) => STORYLINE_CHECKS[d].scope === "page"));
const SPINE_CHECKS = STORYLINE_DIMENSIONS.filter((d) => STORYLINE_CHECKS[d].scope === "spine");
export const SOURCING_STATUSES = Object.freeze(["supported", "partly", "unsupported", "n/a"]);
// How the answer meets each part of the request. `cannot rank` is allowed once,
// naming the decisive missing evidence; a part `declined` fails the answer check.
export const ANSWER_VERDICTS = Object.freeze(["answered", "cannot rank", "declined"]);

const HASH = { type: "string", pattern: "^[a-f0-9]{64}$" };
const STR = (minLength = 2) => ({ type: "string", minLength });
const ITEM_PROPERTIES = {
  id: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_.-]*$" },
  scope: { type: "string", enum: ["page", "spine"] },
  pages: { type: "array", items: { type: "string" }, minItems: 1 },
  check: { type: "string", enum: STORYLINE_DIMENSIONS },
  severity: { type: "string", enum: SEVERITIES },
  problem: STR(20),
  fix: STR(20),
};
// A finding about the imported deck (review-passes.mjs ABOUT_IMPORTED_RULE): optional, and only a revision's critique may set it.
// `ifUnfixed` is what a blocking item does to the decision (BLOCKING_STAKE): a major or blocker without it is recorded as minor.
const OPTIONAL_ITEM = { aboutImported: { type: "boolean" }, ifUnfixed: { type: "string" } };
const ITEM = { type: "object", additionalProperties: false, required: Object.keys(ITEM_PROPERTIES), properties: { ...ITEM_PROPERTIES, ...OPTIONAL_ITEM } };
const NEW_ITEM = { type: "object", additionalProperties: false, required: [...Object.keys(ITEM_PROPERTIES), "basis", "justification", "evidence"],
  properties: { ...ITEM_PROPERTIES, ...OPTIONAL_ITEM, basis: { type: "string", enum: Object.keys(NEW_BASES) }, justification: { type: "string" }, evidence: { type: "string" } } };
const PAGE_ENTRY = {
  type: "object", additionalProperties: false, required: ["page", "verdict", ...STORYLINE_PAGE_CHECKS],
  properties: {
    page: { type: "string" },
    verdict: { type: "string", enum: PAGE_VERDICTS },
    claim: STR(), shape: STR(), restatement: STR(), consequence: STR(),
    sourcing: { type: "object", additionalProperties: false, required: ["status", "insights", "note"],
      properties: { status: { type: "string", enum: SOURCING_STATUSES }, insights: { type: "array", items: { type: "string" } }, note: STR() } },
  }
};
// A pillar is judged, not argued against: a counter-argument is the critic's to raise where it would flip the answer, as an item.
const PILLAR = { type: "object", additionalProperties: false, required: ["pillar", "pages", "verdict"],
  properties: { pillar: STR(), pages: { type: "array", items: { type: "string" }, minItems: 1 }, verdict: { type: "string", enum: ["holds", "weak", "fails"] }, note: { type: "string" },
    overlap: { type: "string" }, strongestCounter: { type: "string" }, reversal: { type: "string" }, answered: { type: "boolean" } } };
// `public`: "known" when the critic can name the public source that publishes
// the data; "speculative" otherwise, and a speculative analysis is never major.
const MISSING = { type: "object", additionalProperties: false, required: ["id", "analysis", "why", "data", "public", "remedy", "severity"],
  properties: { id: ITEM_PROPERTIES.id, analysis: STR(10), why: STR(10), data: STR(10), public: { type: "string", enum: ["known", "speculative"] },
    remedy: { type: "string", enum: Object.keys(REMEDIES) }, severity: ITEM_PROPERTIES.severity, ifUnfixed: { type: "string" } } };
const CUT = { type: "object", additionalProperties: false, required: ["id", "pages", "action", "freedUse", "severity"],
  properties: { id: ITEM_PROPERTIES.id, pages: ITEM_PROPERTIES.pages, action: { type: "string", enum: ["cut", "merge"] }, freedUse: STR(10), severity: ITEM_PROPERTIES.severity, ifUnfixed: { type: "string" } } };
const STATUS = { type: "object", additionalProperties: false, required: ["finding", "status", "evidence"],
  properties: { finding: { type: "string" }, status: { type: "string", enum: STORYLINE_STATUSES }, evidence: STR(20), severity: { type: "string", enum: SEVERITIES },
    pages: { type: "array", items: { type: "string" } }, searchLog: { type: "string" }, artifact: { type: "string" }, answers: ANSWERS_SCHEMA } };
const COMPLETENESS = { type: "array", items: { type: "object", additionalProperties: false, required: ["check", "result", "note"],
  properties: { check: { type: "string", enum: STORYLINE_DIMENSIONS }, result: { type: "string", enum: ["findings", "clean"] }, note: { type: "string" } } } };
const ANSWER_PARTS = { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["part", "verdict", "missingEvidence"],
  properties: { part: STR(3), verdict: { type: "string", enum: ANSWER_VERDICTS }, missingEvidence: { type: "string" } } } };
const JUDGEMENT = (verdicts) => ({ type: "object", additionalProperties: false, required: ["verdict", "note"], properties: { verdict: { type: "string", enum: verdicts }, note: { type: "string" } } });
// The verdict and the two judgements are read off the ledger (withJudgements), never asked of the critic: an answer may
// carry them, and the runtime's reading replaces them.
const COMMON = { verdict: { type: "string", enum: STORYLINE_VERDICTS }, rating: { type: "number", minimum: 0, maximum: 10 }, binding: HASH, summary: STR(40), provenance: PROVENANCE_SCHEMA,
  compliance: JUDGEMENT(COMPLIANCE_VERDICTS), sufficiency: JUDGEMENT(SUFFICIENCY_VERDICTS) };
const DERIVED = ["verdict", "compliance", "sufficiency", "completeness"];

/** Pass one of the page-level critique (--full): every page of the spine, every spine-level section, and what found nothing. */
export const STORYLINE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["pass", "verifies", "rating", "binding", "summary", "spine", "answer", "answerParts", "pillars", "pages", "numbers", "sectionFlow", "execSummary", "missingAnalyses", "cutOrMerge", "findings", "topFixes"],
  properties: {
    pass: { type: "integer", enum: [1] }, verifies: { type: "null" }, ...COMMON,
    spine: STR(60), answer: STR(40), answerParts: ANSWER_PARTS,
    pillars: { type: "array", items: PILLAR, minItems: 1 },
    pages: { type: "array", items: PAGE_ENTRY },
    numbers: STR(30), sectionFlow: STR(30), execSummary: STR(30),
    missingAnalyses: { type: "array", items: MISSING },
    cutOrMerge: { type: "array", items: CUT },
    findings: { type: "array", items: ITEM },
    topFixes: { type: "array", items: { type: "string" } },
    completeness: COMPLETENESS,
    mergedFrom: { type: "array", items: { type: "string" } },
    // One answer for each blocking item a retired lineage left open (review-passes.mjs carriedErrors); absent where the packet carries none.
    carried: CARRIED_SCHEMA,
  }
};

/** Pass one of the spine critique: the page-level schema without per-page verdicts, at most ten items. */
export const STORYLINE_SPINE_SCHEMA = { ...STORYLINE_SCHEMA, required: STORYLINE_SCHEMA.required.filter((k) => k !== "pages"), properties: { ...STORYLINE_SCHEMA.properties } };
delete STORYLINE_SPINE_SCHEMA.properties.pages;
delete STORYLINE_SPINE_SCHEMA.properties.mergedFrom;

/** Pass two and after: a status for every open item, new items only if serious and additive. */
export const STORYLINE_VERIFICATION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["pass", "verifies", "rating", "binding", "summary", "pages", "statuses", "findings", "topFixes"],
  properties: {
    pass: { type: "integer", minimum: 2 }, verifies: HASH, ...COMMON,
    pages: { type: "array", items: PAGE_ENTRY },
    statuses: { type: "array", items: STATUS },
    findings: { type: "array", items: NEW_ITEM },
    topFixes: { type: "array", items: { type: "string" } },
    // Re-judged when the answer or the request changed since the last pass.
    answerParts: ANSWER_PARTS,
  }
};

/** A verification pass of the spine critique: no per-page entries. */
export const STORYLINE_SPINE_VERIFICATION_SCHEMA = { ...STORYLINE_VERIFICATION_SCHEMA, required: STORYLINE_VERIFICATION_SCHEMA.required.filter((k) => k !== "pages"), properties: { ...STORYLINE_VERIFICATION_SCHEMA.properties } };
delete STORYLINE_SPINE_VERIFICATION_SCHEMA.properties.pages;

/** One reviewer's share of a long spine's page-level first pass: a section of pages, or the spine sections. */
const SPINE_PART_KEYS = ["spine", "answer", "answerParts", "pillars", "numbers", "sectionFlow", "execSummary", "missingAnalyses", "cutOrMerge", "topFixes"];
const partSchema = (kind) => {
  const { pass: _pass, verifies: _verifies, mergedFrom: _mergedFrom, ...properties } = STORYLINE_SCHEMA.properties;
  const checks = kind === "section" ? STORYLINE_PAGE_CHECKS : SPINE_CHECKS;
  return {
    type: "object", additionalProperties: false,
    required: ["part", "binding", "rating", "summary", "pages", "findings", ...(kind === "spine" ? SPINE_PART_KEYS : [])],
    properties: {
      part: { type: "object", additionalProperties: false, required: ["kind", "id", "pages"],
        properties: { kind: { type: "string", enum: [kind] }, id: { type: "string" }, pages: { type: "array", items: { type: "string" } } } },
      ...properties,
      completeness: { ...COMPLETENESS, items: { ...COMPLETENESS.items, properties: { ...COMPLETENESS.items.properties, check: { type: "string", enum: checks } } } },
    }
  };
};
export const STORYLINE_PART_SCHEMAS = Object.freeze({ section: partSchema("section"), spine: partSchema("spine") });

const schemaFor = (mode, scope) => (scope ? (mode === "full" ? STORYLINE_VERIFICATION_SCHEMA : STORYLINE_SPINE_VERIFICATION_SCHEMA) : (mode === "full" ? STORYLINE_SCHEMA : STORYLINE_SPINE_SCHEMA));
// The schema a critic is handed: the one its answer is validated against, less a key the packet gives it nothing to answer with.
// `carried` answers the items a retired lineage left open; offered on a packet that carries none, a critic of a revision filled it
// with the slides the revision carries, and the whole answer was refused for it.
// Nor is a critic offered what the runtime reads off its items (DERIVED), or the fields an older pillar carried, which an
// answer may still hold and which nothing reads.
const LEGACY_PILLAR = ["overlap", "strongestCounter", "reversal", "answered"];
function offered(schema, { carried = false } = {}) {
  const properties = Object.fromEntries(Object.entries(schema.properties).filter(([key]) => !DERIVED.includes(key) && (carried || key !== "carried")));
  if (properties.pillars) properties.pillars = { ...properties.pillars, items: { ...PILLAR, properties: Object.fromEntries(Object.entries(PILLAR.properties).filter(([key]) => !LEGACY_PILLAR.includes(key))) } };
  return { ...schema, properties };
}
const offeredSchema = (mode, scope, { carried = false } = {}) => offered(schemaFor(mode, scope), { carried: Boolean(scope) || carried });
const offeredPart = (kind) => offered(STORYLINE_PART_SCHEMAS[kind]);

const exhibitsOf = (slide) => [slide.exhibit, ...(slide.exhibits || [])].filter((ex) => ex && typeof ex === "object");

/** What an exhibit shows, in a line a reviewer can judge without seeing it drawn. */
export function describeExhibit(ex) {
  const type = String(ex.type ?? "?");
  // Aligned bars are a chart group of one category axis: its members and measures are the charts'.
  const group = type === "chart-group" && Array.isArray(ex.charts) ? ex.charts : null;
  const cats = ex.categories || ex.rows || ex.labels || group?.[0]?.props?.categories || [];
  const series = group ? group.map((c) => c?.heading).filter(Boolean) : Array.isArray(ex.series) ? ex.series.map((s) => s?.name).filter(Boolean) : [];
  const form = type.startsWith("chart.") ? (trivialChart(ex) ? "TWO-NUMBER" : trendChart(ex) ? "trend" : cats.length >= 5 ? "ranked set" : "comparison") : null;
  const parts = [type];
  if (form) parts.push(`[${form}]`);
  // How much it plots, against strong decks' ~22 values a chart page.
  if (type.startsWith("chart")) parts.push(`plots ${plottedValues(ex)} values`);
  if (ex.heading) parts.push(`"${ex.heading}"`);
  if (Array.isArray(cats) && cats.length) parts.push(`${cats.length} categories: ${cats.slice(0, 12).map((c) => typeof c === "object" ? (c.label ?? c.text ?? JSON.stringify(c)) : c).join(", ")}${cats.length > 12 ? ", ..." : ""}`);
  if (series.length) parts.push(`series: ${series.join(", ")}`);
  if (type === "table") {
    const cells = (ex.rows || []).flatMap((r) => Array.isArray(r) ? r : r?.cells || []);
    const text = (c) => String(c && typeof c === "object" ? (c.text ?? c.value ?? c.label ?? "") : c ?? "");
    const numeric = cells.filter((c) => /\d/.test(text(c)) || (c && typeof c === "object" && Number.isFinite(c.value))).length;
    const cellTypes = new Set(cells.filter((c) => c && typeof c === "object" && c.type).map((c) => c.type));
    const treated = [...new Set([...(ex.columns || []).filter((c) => c && typeof c === "object" && ((c.type && !["text", "number", "category"].includes(c.type)) || c.bar || c.bars || c.heat || c.pill)).map((c) => c.type || (c.bar || c.bars ? "bar" : c.heat ? "heat" : "pill")),
      ...[...cellTypes].filter((t) => !["text", "number", "category"].includes(t)), ...(ex.treatment ? [ex.treatment] : []), ...(ex.bars || ex.heat ? ["bars"] : [])])];
    parts.push(`${(ex.columns || []).length} columns (${(ex.columns || []).map((c) => typeof c === "string" ? c : `${c.label ?? ""}${c.type ? ":" + c.type : ""}`).join(" | ")}), ${(ex.rows || []).length} rows, ${numeric} of ${cells.length} cells carry a number${treated.length ? `, treated: ${treated.join(", ")}` : ", PLAIN GRID"}`);
  }
  if (type === "map") parts.push(`${(ex.markers || []).length} markers, ${(ex.routes || []).length} routes`);
  if (ex.change || ex.cagr) parts.push("growth marked");
  return parts.join("; ");
}

// The numbers an exhibit draws: what an exhibit that names no recorded measure
// is bound by, and the line that shows a critic a drafted exhibit. Typed values
// only - a number written into a label or a table cell's text is wording.
const DATA_KEYS = new Set(["series", "values", "value", "points", "rows", "cells", "markers", "items", "charts", "props", "low", "high", "boxes", "targets", "data", "x", "y", "min", "q1", "median", "q3", "max"]);
function plottedNumbers(node, out = []) {
  if (typeof node === "number") { if (Number.isFinite(node)) out.push(node); return out; }
  if (Array.isArray(node)) { for (const v of node) plottedNumbers(v, out); return out; }
  if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) if (DATA_KEYS.has(key)) plottedNumbers(value, out);
  return out;
}

/**
 * The measures a page declares it shows, each as `role:ref`, sorted: the
 * claim's own measures (`settles.measures`) are proof by definition, and an
 * exhibit, block or metric adds to the list where its `basis` names a measure
 * the claim does not, or names one as context - the role is each measure's
 * own (dependency_gates.mjs roleFor), so one chart can show the claim's
 * measure as proof and another beside it as context. Which exhibit draws a measure,
 * and in what form, is the layout's; that the page shows it is the argument's.
 */
export function shownMeasures(slide) {
  const shown = new Set(claimMeasures(slide).map((ref) => `proof:${ref}`));
  for (const basis of declaredBases(slide)) for (const ref of refsOf(basis)) shown.add(`${roleFor(basis, ref).role}:${ref}`);
  return [...shown].sort();
}
// Every `basis` a page declares, on its exhibits, blocks and metrics (author-deck.mjs withoutDependencies), and the measures its claim is about.
const declaredBases = (slide) => { const declared = slide?.pageType?.dependencies ?? {}; return [declared.exhibits, declared.blocks, declared.metrics].flatMap((list) => list || []).filter(Boolean); };
const claimMeasures = (slide) => { const settles = slide?.pageType?.content?.settles ?? slide?.settles; return (Array.isArray(settles?.measures) ? settles.measures : []).filter((ref) => typeof ref === "string"); };

/**
 * The same measures as a critic is shown them, the claim's first: `proof`
 * where an exhibit or metric is declared to show the measure as proof,
 * `claim` where the claim is about it and nothing is declared to show it (a
 * spine not yet laid out, or a page that shows only context), and `context`.
 */
function measureRoles(slide) {
  const claimed = claimMeasures(slide), drawn = new Map();
  for (const basis of declaredBases(slide)) for (const ref of refsOf(basis)) if (drawn.get(ref) !== "proof") drawn.set(ref, roleFor(basis, ref).role);
  return [...claimed.map((ref) => ({ ref, role: drawn.get(ref) === "proof" ? "proof" : "claim" })), ...[...drawn].filter(([ref]) => !claimed.includes(ref)).sort(([a], [b]) => a.localeCompare(b)).map(([ref, role]) => ({ ref, role }))];
}

/**
 * Every measure of an insight log as the binding reads it, keyed `owner/name`:
 * the hash of what it records - its unit, the periods or members it runs over
 * and its values - with that axis and those values, from which what a page
 * shows of the measure is read off its exhibits (shownOf). `insights` is the
 * log with the computed analyses joined to it. A measure whose recorded
 * numbers change is a changed argument on every page that shows it, however
 * the page is drawn.
 */
export function recordedMeasures(insights) {
  return Object.fromEntries([...measureRegistry(insights)].map(([ref, m]) => {
    const unit = m.unit ?? null, axis = axisOf(m), values = valuesOf(m);
    return [ref, { hash: sha256(JSON.stringify({ unit, axis, values })), unit, axis, values }];
  }));
}

// How an exhibit shows a measure, one of three classes and no other
// (dependency_gates.mjs VIEW_CLASSES): plotted (any chart, whatever its form),
// tabulated, or stated as a figure - a metric, a hero figure, a fact grid, a
// stat list, and a number written into any other exhibit (a timeline's item, a
// card, a step of a flow), which states it and neither plots nor tabulates it.
// A line redrawn as columns is the same class; a chart swapped for a table, or
// for one figure, is not. The class is read off the exhibit's type alone, by
// this one function, for a page drawn at the spine and for the same page laid
// out: there is no fourth class for an exhibit to fall into between the two.
const FIGURE_EXHIBITS = new Set(["fact-grid", "stat-list"]);
// A map plots a value a member - a district's shade, a marker's size - so it is read as a chart whose axis is its features and markers.
export const viewClassOf = (ex) => { const type = String(ex?.type ?? ""); return type.startsWith("chart") || type === "map" ? "chart" : type === "table" || isTable(ex) ? "table" : "figure"; };
const classOf = viewClassOf;
const WHOLE = "all";
// The class a page not yet drawn is taken to show a measure in is the witness's (spine-witness.mjs naturalClass): one reading, so the two cannot drift.

const stringsIn = (node, out = []) => {
  if (typeof node === "string") out.push(node);
  else if (node && typeof node === "object") for (const value of Object.values(node)) stringsIn(value, out);
  return out;
};
const names = (text, label) => { const at = text.indexOf(label); return at >= 0 && !/[\p{L}\p{N}]/u.test(text[at - 1] ?? "") && !/[\p{L}\p{N}]/u.test(text[at + label.length] ?? ""); };
// The periods or members of a measure whose recorded value one of `numbers` states (printed-numbers.mjs).
const statedLabels = (numbers, measure) => {
  const reading = { unit: measure.unit, percent: percentUnit(measure.unit) };
  return measure.axis.labels.filter((_, at) => typeof measure.values[at] === "number" && numbers.some((number) => states(number, measure.values[at], reading)));
};
const firstNumber = (text) => printedNumbers(String(text ?? "")).slice(0, 1);
// A typed value read as a printed number: its own digits and its own sign.
const typedNumber = (value) => ({ n: Math.abs(value), decimals: (String(value).split(".")[1] || "").length, sign: value < 0 ? -1 : 1, scale: null, scaled: false, percent: false });

// A chart's category axis - a map's shaded features and its markers among them -
// or null where it has none to read (a scatter's points).
function categoryAxis(ex) {
  if (classOf(ex) !== "chart") return null;
  if (ex.type === "map") {
    const members = [...(ex.choropleth?.values ?? []).map((value) => value?.featureId), ...(ex.markers ?? []).map((marker) => marker?.label)].filter((name) => name !== undefined && name !== null);
    return members.length ? new Set(members.map(String)) : null;
  }
  const group = ex.type === "chart-group" && Array.isArray(ex.charts) ? ex.charts.flatMap((c) => c?.props?.categories || []) : null;
  const axis = ex.categories ?? ex.labels ?? group;
  return Array.isArray(axis) ? new Set(axis.map(String)) : null;
}

// Where an exhibit with no axis states its numbers. A table states them cell
// by cell, each under its column header and beside its row label, so a number
// is read against the period or member its header or its row names; any other
// exhibit is one place. `typed` are the values it draws from (a bar cell's
// `value`, a point's `x`), `printed` the numbers its text prints.
function placesOf(ex) {
  if (!isTable(ex)) return [{ texts: stringsIn(ex), typed: plottedNumbers(ex), printed: stringsIn(ex).flatMap((text) => printedNumbers(text)) }];
  const headers = (ex.columns || []).map(cellText);
  return ex.rows.flatMap((row) => { const label = cellText(rowLabel(row)); return rowCells(row).map((cell, at) => ({ texts: [label, headers[at] ?? ""],
    typed: typeof cell === "number" ? [cell] : plottedNumbers({ cells: cell && typeof cell === "object" ? cell : null }), printed: printedNumbers(cellText(cell)) })); });
}

/**
 * What an exhibit with no axis to read shows of the measures it names: for
 * each, in order, the periods or members shown (null for a measure of one
 * value). A period or member is shown where the exhibit names it - in a
 * table, in a column header or a row label; what a cell says in passing is
 * copy - and, where the exhibit states numbers, a number in that place states
 * its recorded value (printed-numbers.mjs): a header kept over other numbers
 * shows nothing of it. Where the exhibit names none, the ones whose recorded
 * value it states are shown. So the numbers the exhibit states of a measure
 * are bound through the record, and wording that leaves them alone is copy.
 * The values such an exhibit types (a bar cell's `value`, a point's `x`) are
 * bound as themselves besides (shownOf).
 */
function statedViews(ex, measureList) {
  const places = placesOf(ex);
  const anyNumber = places.some((place) => place.typed.length || place.printed.length);
  const readings = measureList.map((measure) => ({ unit: measure.unit, percent: percentUnit(measure.unit) }));
  // The periods or members of each measure a place can be stating: the ones its texts name, or any where they name none.
  const candidates = places.map((place) => measureList.map((measure) => { const named = measure.axis.labels.filter((label) => place.texts.some((text) => names(text, label))); return named.length ? named : measure.axis.labels; }));
  const valueAt = (measure, label) => (measure.axis.kind === "scalar" ? measure.values[0] : measure.values[measure.axis.labels.indexOf(label)]);
  const statesAt = (number, m, label) => typeof valueAt(measureList[m], label) === "number" && states(number, valueAt(measureList[m], label), readings[m]);
  const labels = measureList.map((measure, m) => {
    if (measure.axis.kind === "scalar") return null;
    const texts = isTable(ex) ? [...(ex.columns || []).map(cellText), ...ex.rows.map((row) => cellText(rowLabel(row)))] : places[0].texts;
    const named = measure.axis.labels.filter((label) => texts.some((text) => names(text, label)));
    const stated = measure.axis.labels.filter((label) => places.some((place, at) => candidates[at][m].includes(label) && [...place.printed, ...place.typed.map(typedNumber)].some((number) => statesAt(number, m, label))));
    return named.length ? (anyNumber ? named.filter((label) => stated.includes(label)) : named) : isTable(ex) ? stated : named;
  });
  return labels;
}

// One view of a measure: the class it is shown in and which of its periods or
// members, `WHOLE` for all of them - all a chart's axis can carry, and all that
// hold a number where the class states numbers; `drawn` is added where none of
// them can be read off the exhibit, which is then held to the numbers or the
// figure it draws.
// A measure of one value is one number wherever the page prints it - a tile, a
// sentence of a timeline, a reference line across a chart - so it has one view,
// a figure, whatever exhibit carries it: nothing about how it is drawn is the
// argument's.
const wholeOf = (kind, measure) => (kind === "chart" ? measure.axis.labels : measure.axis.labels.filter((_, at) => typeof measure.values[at] === "number"));
const viewOf = (kind, labels, measure, drawn = null) => (measure.axis.kind === "scalar" ? ["figure"]
  : [kind, labels === null || labels.length === wholeOf(kind, measure).length ? WHOLE : labels, ...(drawn && labels !== null && !labels.length ? [drawn] : [])]);
/** The view a page not yet drawn is taken to show of a measure nothing declares a view of: whole, in its natural class. */
const naturalView = (type, measure) => viewOf(naturalClass(type, measure), null, measure);
// The periods or members the runtime wrote into an exhibit or a figure for `ref` (bind.mjs: a basis marked `bound`), in the measure's
// order: every one a chart sets on its axis, and - as for a declared view (declaredView) - those that hold a number where the class
// states numbers, since a cell or a tile that prints "n/a" states nothing of the measure.
const boundLabels = (basis, ref, measure, kind) => (measure.axis.kind === "scalar" ? null : wholeOf(kind, measure).filter((label) => (basis.labels?.[ref] ?? []).includes(label)));

/**
 * The view of `measure` a `basis` declares for an exhibit or a figure not
 * drawn yet (dependency_gates.mjs declaresView: `as`, `labels`, `members`),
 * read exactly as an exhibit drawn to show it would be: `[class, labels]`, the
 * class `fallback` where the basis names none. A measure the declared labels
 * do not run over is shown whole.
 */
function declaredView(basis, ref, measure, fallback) {
  const kind = VIEW_CLASSES.includes(basis.as) ? basis.as : fallback;
  if (measure.axis.kind === "scalar") return viewOf(kind, null, measure);
  const labels = declaredLabels(basis, ref, measure.axis) ?? measure.axis.labels;
  return viewOf(kind, kind === "chart" ? labels : labels.filter((label) => wholeOf(kind, measure).includes(label)), measure);
}

/**
 * What a page's exhibits and figures show, read off the compiled page.
 * `views`: for each recorded measure an exhibit, a block's exhibit or a figure
 * names in its `basis`, the views of it on the page (viewOf), one per exhibit
 * or figure that shows it - read off the exhibit where it is drawn, and off
 * the view its `basis` declares where it is not (declaredView). `drawn`: for
 * each exhibit that names no recorded measure and draws numbers - every
 * numeric exhibit of a deck with no log - its class and those numbers, since
 * nothing else says what it shows - and for each exhibit with no category
 * axis that types values, whatever it names: a chart's axis is held to the
 * record by the dependency gates, value by value; a table's bar cell or a
 * scatter's point is held by nothing else.
 */
function shownOf(slide, measures) {
  const declared = slide?.pageType?.dependencies ?? {};
  const recorded = (basis) => (measures ? refsOf(basis).filter((ref) => measures[ref] !== undefined) : []);
  const views = new Map(), drawn = [], undrawn = new Set(), read = new Set(), named = new Set();
  const add = (ref, view, declaredOnly = false) => { views.set(ref, [...(views.get(ref) ?? []), view]); (declaredOnly ? undrawn : read).add(ref); };
  const type = slide?.pageType?.type;
  // A spine not laid out yet keeps an exhibit's place with its type alone, or with nothing (author-deck.mjs --draft): declared, not drawn.
  const drawnYet = (ex) => ex && typeof ex === "object" && Object.keys(ex).some((key) => key !== "type");
  const exhibits = [...exhibitsOf(slide).map((ex, at) => [ex, declared.exhibits?.[at]]),
    ...(Array.isArray(slide?.blocks) ? slide.blocks : []).map((block, at) => [block?.exhibit, declared.blocks?.[at]])];
  for (const [ex, basis] of exhibits) {
    for (const ref of recorded(basis)) named.add(ref);
    if (!drawnYet(ex)) {
      // Declared and not drawn: the view the basis states is the one the critic reads, and the one the drawn exhibit is held to.
      if (declaresView(basis)) for (const ref of recorded(basis)) add(ref, declaredView(basis, ref, measures[ref], naturalClass(type, measures[ref])), true);
      continue;
    }
    const refs = recorded(basis), numbers = plottedNumbers(ex);
    if (!refs.length) { if (numbers.length) drawn.push({ class: classOf(ex), values: numbers }); continue; }
    // Written by reference, the exhibit shows exactly the periods or members its references name: read from them, whatever its headers and labels say.
    if (basis.bound === true) { for (const ref of refs) add(ref, viewOf(classOf(ex), boundLabels(basis, ref, measures[ref], classOf(ex)), measures[ref])); continue; }
    // A chart's category axis says which periods or members it shows, and the dependency gates hold the values it plots there to the record;
    // an exhibit with no axis - a table, a figure grid, a scatter - is read by what it names and states (statedViews).
    const axis = categoryAxis(ex);
    const stated = axis ? null : statedViews(ex, refs.map((ref) => measures[ref]));
    const shown = refs.map((ref, at) => [ref, measures[ref].axis.kind === "scalar" ? null : axis ? measures[ref].axis.labels.filter((label) => axis.has(label)) : stated[at]]);
    if (!axis && numbers.length) drawn.push({ class: classOf(ex), values: numbers });
    // One measure of the exhibit unread is the exhibit unread: its numbers stand for what it shows of each.
    const unread = shown.some(([, labels]) => labels !== null && !labels.length);
    for (const [ref, labels] of shown) add(ref, viewOf(classOf(ex), unread && labels !== null ? [] : labels, measures[ref], numbers));
  }
  // The figures a page prints, in the order their bases were declared (dependency_gates.mjs metricsOf); past them, a fact grid's or a stat list's items.
  const figures = metricsOf(slide ?? {});
  const items = exhibits.filter(([ex]) => drawnYet(ex) && FIGURE_EXHIBITS.has(ex.type)).flatMap(([ex]) => (Array.isArray(ex.items) ? ex.items : [])).map((item) => item?.value);
  (declared.metrics || []).forEach((basis, at) => {
    for (const ref of recorded(basis)) named.add(ref);
    const printed = (figures[at] ? [figures[at].value] : items).filter((value) => value !== undefined && value !== null);
    // Declared and not drawn yet: the view the basis states, or nothing to read.
    if (!printed.length) { if (declaresView(basis)) for (const ref of recorded(basis)) add(ref, declaredView(basis, ref, measures[ref], "figure"), true); return; }
    if (basis?.bound === true) { for (const ref of recorded(basis)) add(ref, viewOf("figure", boundLabels(basis, ref, measures[ref], "figure"), measures[ref])); return; }
    for (const ref of recorded(basis)) add(ref, viewOf("figure", measures[ref].axis.kind === "scalar" ? null : statedLabels(printed.flatMap(firstNumber), measures[ref]), measures[ref], printed.map(String)));
  });
  // `declared`: the measures whose every view on the page is a declared one - nothing drawn shows them yet.
  // `named`: every measure an exhibit or a figure on the page names, drawn or not.
  return { views, drawn, declared: new Set([...undrawn].filter((ref) => !read.has(ref))), named };
}

/**
 * The argument: what the critique is bound to. Every page in order - the
 * sections among them, so their order is bound too - with its id, kind and
 * title, and for a page that argues its claim, its page type (the reading
 * task), what settles the claim (`kind`, `what`, `measures`, `relation`), the
 * insights and analyses it rests on and the measures it declares it shows
 * (shownMeasures). `measures` is the log's measures (recordedMeasures), which
 * adds, where the deck has a log, each shown measure's recorded values
 * (`measures`) and what the page shows of it (`views`): per exhibit or figure
 * that shows it, its class and the periods or members it shows. A measure no
 * exhibit shows yet - a spine critiqued before it is laid out - has the view
 * its `basis` declares (declaredView) and, with none declared, the one view
 * the critic is told it is taken to have: whole, in its natural class
 * (naturalClass). So laying a page out to the view the critic read keeps the
 * critique, and another window, a dropped period or member, or another class
 * does not. `drawn` holds, with its class, the numbers of each exhibit that
 * names no recorded measure, and the typed values of each table or other
 * exhibit with no category axis.
 *
 * Left out, because the layout decides them after the critique is ready: the
 * page's form and where its commentary sits, a chart's form within its class,
 * the numbers a chart plots on its axis for a measure it names (the dependency
 * gates hold those to the record), captions, highlights, points and every
 * other piece of copy - a table cell's wording among it, so long as the cell
 * still states the recorded number its header and row name. The deck review judges those on the rendered pages.
 */
export function storyStructure(spec, measures = null) {
  const pages = [...(spec.slides || []), ...(spec.appendix || [])];
  // A slide a revision carries from its source deck (revision.mjs) is a page of the argument by its title and its place alone:
  // the runtime neither types it nor draws it, so nothing else of it is bound, and its words are the copy's.
  const carried = (list) => (spec.carried?.length ? withCarriedPages(spec, list, (entry) => ({ id: entry.id, kind: "carried", title: String(entry.retitled ?? entry.title ?? ""), sourceSlide: entry.sourceSlide }), (page) => String(page.id)) : list);
  return carried(pages.map((s, i) => {
    const content = s.pageType?.content ?? {};
    const settles = content.settles ?? s.settles ?? null;
    const shows = shownMeasures(s);
    const recorded = measures ? shows.map((entry) => entry.slice(entry.indexOf(":") + 1)).filter((ref, at, all) => measures[ref] !== undefined && all.indexOf(ref) === at) : [];
    const { views, drawn } = shownOf(s, measures);
    const viewed = (ref) => (views.get(ref) ?? [naturalView(s.pageType?.type, measures[ref])]).map((view) => JSON.stringify(view)).filter((view, at, all) => all.indexOf(view) === at).sort();
    return { id: s.id ?? `p${i + 1}`, kind: s.kind ?? "content", title: String(s.title ?? s.text ?? ""),
      claim: content.claim ?? s.claim ?? null, type: s.pageType?.type ?? null,
      settles: settles && typeof settles === "object" ? { kind: settles.kind ?? null, what: settles.what ?? null, measures: Array.isArray(settles.measures) ? settles.measures : [], relation: settles.relation ?? null } : null,
      rests: [...new Set(Array.isArray(content.evidence) ? content.evidence : [])].sort(), shows,
      ...(recorded.length ? { measures: Object.fromEntries(recorded.map((ref) => [ref, measures[ref].hash])), views: Object.fromEntries(recorded.map((ref) => [ref, viewed(ref)])) } : {}),
      ...(drawn.length ? { drawn } : {}) };
  }));
}

/**
 * The fields of a pages file the binding reads - what storyStructure and
 * storylineBinding hash - each with what it holds. A repair that writes one
 * of them changes the argument, so a spine is held to everything such a
 * repair would mend before the critique reads it (author-deck.mjs --draft,
 * gates/gate_classes.mjs REPAIRS); what a repair mends without writing any of
 * them is the layout's, and waits. A test moves each field on a fixture and
 * holds this list to the binding: every field here changes it, and the
 * layout's fields do not.
 */
export const BOUND_FIELDS = Object.freeze({
  request: "the user's request, its provenance and the evidence scope",
  answer: "the governing answer and its status",
  pages: "the pages and sections, in order: one added, cut or moved",
  title: "a page's title, which is its claim, and a section's title",
  type: "a page's type, the reading task",
  settles: "what settles the claim: `settles.kind`, `what`, `measures` and `relation`",
  evidence: "the insights and analyses a page rests on",
  basis: "the measures a page shows and each one's role: every `basis` on an exhibit, block or metric, and the measure a bound series or figure names",
  view: "what a page shows of each measure: which of its periods or members, and whether plotted, tabulated or stated as a figure; and the numbers an exhibit with no recorded measure draws",
  record: "the recorded values, unit and periods or members of a measure a page shows",
});

/**
 * What the repair of a deck-review finding reaches: "layout" where everything
 * it changes is the layout's (gates/gate_classes.mjs reviewRepairOf: copy,
 * layout, fit), so the ready critique stands; "argument" where it writes a
 * field the critique is bound to (BOUND_FIELDS), which reopens it. The
 * reviewer's own statement (`touches`) decides; a finding that carries none
 * is read by its code - "argument" or "layout" where every repair of that
 * code is one or the other, and "unstated" where they could be either or the
 * code lists none.
 */
export function repairReach(finding) {
  const { stated, touches } = reviewRepairOf(finding);
  const bound = touches.filter((field) => Object.hasOwn(BOUND_FIELDS, field));
  if (stated) return bound.length ? "argument" : "layout";
  return !touches.length || (bound.length && bound.length < touches.length) ? "unstated" : bound.length ? "argument" : "layout";
}

/** The critique's binding: the argument (storyStructure), the governing answer and its status, and the user's request. */
export function storylineBinding(spec, measures = null) {
  const offered = answerStatusOf(spec);
  return sha256(JSON.stringify({ request: requestHash(spec), answer: spec.answer ?? null, ...(offered.status === "provisional" ? { answerStatus: offered } : {}), pages: storyStructure(spec, measures) }));
}

/**
 * One hash per page of the argument: what a verification pass compares to say
 * which pages moved. A page's place is part of it - the page before it and
 * whether it stands in the appendix - so a fix that reorders the storyline or
 * moves a page to the appendix is a page that moved, while a page inserted
 * moves only the page after it.
 */
export function storylinePageHashes(spec, measures = null) {
  const pages = storyStructure(spec, measures), appendix = new Set((spec.appendix || []).map((s) => String(s.id)));
  return Object.fromEntries(pages.map((p, at) => [p.id, sha256(JSON.stringify({ ...p, after: pages[at - 1]?.id ?? null, appendix: appendix.has(String(p.id)) }))]));
}

const isContent = (p) => !p.kind || p.kind === "content";

// The numbers a drafted exhibit draws, in a line: each series from its first
// to its last value, or the first values. Shown in the page-level packet
// only, with the drafted exhibit and said to be a draft.
// Three significant figures below a hundred, so a small ratio keeps the precision a claim about it needs (0.35, not 0.3).
const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Number(n.toPrecision(3))).toLocaleString("en-US", { maximumFractionDigits: 6 });
function draftedNumbers(exhibits) {
  const out = [];
  for (const ex of exhibits) {
    const unit = ex.unit ? ` ${ex.unit}` : "";
    if (Array.isArray(ex.series) && ex.series.length) {
      for (const s of ex.series.slice(0, 4)) {
        const values = plottedNumbers({ values: s?.values ?? s?.points ?? [] });
        if (values.length) out.push(`${s?.name ?? "series"} ${values.length > 1 ? `${fmt(values[0])} to ${fmt(values.at(-1))}` : fmt(values[0])}${unit}`);
      }
    } else {
      const values = plottedNumbers(ex).slice(0, 6);
      if (values.length) out.push(`${values.map(fmt).join(", ")}${unit}`);
    }
  }
  return out.slice(0, 5).join("; ");
}

// A measure as the critic reads it: what it runs over and its recorded values,
// which are the numbers every page that shows it turns on. Past `max` values
// it is given by its ends and every value the page's title or claim cites - a
// member it names, a number it prints - so a claim the line backs is never
// one the critic cannot check.
function measureLine(ref, label, registry, max, cited = "") {
  const m = registry.get(ref);
  if (!m) return `${label}: NOT IN THE LOG`;
  // The dated events the values turn on, said with them: a claim that a fall followed a switch is checked against the switch.
  const events = m.events && typeof m.events === "object" ? Object.entries(m.events) : [];
  return `${valuesLine(m, label, max, cited)}${events.length ? ` (events: ${events.map(([when, what]) => `${when} ${what}`).join("; ")})` : ""}`;
}

function valuesLine(m, label, max, cited) {
  const axis = axisOf(m), values = valuesOf(m), unit = m.unit ? ` ${m.unit}` : "";
  const show = (v) => (typeof v === "number" && Number.isFinite(v) ? fmt(v) : "n/a");
  if (axis.kind === "scalar") return `${label}: ${show(values[0])}${unit}`;
  const at = (i) => `${axis.labels[i]} ${show(values[i])}`;
  if (values.length <= max) return `${label}: ${axis.labels.map((_, i) => at(i)).join(", ")}${unit}`;
  const said = String(cited), printed = new Set(printedNumbers(said).map((n) => n.n));
  const named = axis.labels.map((name, i) => i).filter((i) => i === 0 || i === values.length - 1 || said.includes(String(axis.labels[i])) || printed.has(values[i]) || printed.has(Number(show(values[i]))));
  return `${label}: ${named.map((i, k) => `${k && i > named[k - 1] + 1 ? "... " : ""}${at(i)}`).join(", ")}${unit} (${values.length} ${axis.kind}; the rest not cited on this page)`;
}

// What a page shows of a measure, as the critic reads it and the critique is
// bound to it (storyStructure `views`): the class of each exhibit or figure
// that shows it and which of its periods or members. `views` is null for a
// measure nothing on the page shows yet.
const CLASS_WORDS = { chart: "plotted", table: "tabulated", figure: "stated as a figure" };
// One view in words: "tabulated, 2 of its 8 periods: FY25, FY26".
export function viewWords([kind, labels], measure) {
  const all = measure.axis.labels;
  const window = (shown) => {
    const at = shown.map((label) => all.indexOf(label)), run = measure.axis.kind === "periods" && shown.length > 2 && at.every((index, i) => i === 0 || index === at[i - 1] + 1);
    return `${shown.length} of its ${all.length} ${measure.axis.kind}: ${run ? `${shown[0]} to ${shown.at(-1)}` : `${shown.slice(0, 8).join(", ")}${shown.length > 8 ? ", ..." : ""}`}`;
  };
  return `${CLASS_WORDS[kind] ?? `shown in a ${kind}`}${measure.axis.kind === "scalar" ? "" : labels === WHOLE ? ", whole" : labels.length ? `, ${window(labels)}` : `, none of its ${measure.axis.kind} named`}`;
}
const naturalWords = (type, measure) => `${CLASS_WORDS[naturalClass(type, measure)]}${measure.axis.kind === "scalar" ? "" : `, every one of its ${measure.axis.labels.length} ${measure.axis.kind}`}`;
// A page that already draws exhibits and none of them this measure does not show it, whatever a page not drawn yet is read as.
function viewsLine(views, measure, type, drawsOthers = false) {
  if (!measure) return "";
  if (!views) return drawsOthers ? " [on none of the page's exhibits: the page draws other measures]" : ` [not drawn yet: critiqued as ${naturalWords(type, measure)}]`;
  return ` [the page shows it ${[...new Set(views.map((view) => viewWords(view, measure)))].join("; and ")}]`;
}

/**
 * How the critique reads each measure a page shows and has not drawn, one
 * entry a page: `{ id, measures: [{ ref, reading, declared }] }`. A measure
 * nothing on the page draws is read in the view its `basis` declares
 * (`declared`), and with none declared as shown whole in its natural class -
 * and the layout is held to that reading. Said at the spine (author-deck.mjs
 * --draft, --plan), before the critique is staged, so a page that will show a
 * window, a subset, a table or one figure says so first. Pages that draw
 * every measure they show are left out. `views` holds each reading as data -
 * `[{ class, labels }]` - which a draft proves drawable (spine-exhibits.mjs).
 */
export function spineReadings(spec, measures) {
  if (!measures) return [];
  return [...(spec.slides || []), ...(spec.appendix || [])].filter((s) => s.pageType).flatMap((s) => {
    const { views, declared } = shownOf(s, measures);
    const refs = shownMeasures(s).map((entry) => entry.slice(entry.indexOf(":") + 1)).filter((ref, at, all) => measures[ref] !== undefined && all.indexOf(ref) === at);
    // Each reading with the views it is of, as data: the class, and the periods or members shown (null for a measure of one value).
    const listed = (ref, [kind, labels]) => ({ class: kind, labels: measures[ref].axis.kind === "scalar" ? null : labels === WHOLE ? wholeOf(kind, measures[ref]) : labels });
    const undrawn = refs.filter((ref) => !views.has(ref) || declared.has(ref)).map((ref) => ({ ref, declared: declared.has(ref),
      views: (declared.has(ref) ? views.get(ref) : [naturalView(s.pageType.type, measures[ref])]).map((view) => listed(ref, view)),
      reading: declared.has(ref) ? [...new Set(views.get(ref).map((view) => viewWords(view, measures[ref])))].join("; and ") : naturalWords(s.pageType.type, measures[ref]) }));
    return undrawn.length ? [{ id: String(s.id), measures: undrawn }] : [];
  });
}

const stemOf = (specPath) => path.basename(specPath).replace(/\.deck\.json$/, "");

/**
 * The evidence beside a deck file: its insight log with the analyses the
 * runtime computes over it joined in (`log`, null where the deck has none),
 * the analysis run, and the log's measures as the binding reads them
 * (recordedMeasures) - what it holds each page's shown measures to.
 */
async function readEvidence(spec, specPath) {
  const base = path.dirname(specPath), stem = stemOf(specPath);
  // The log with its parts merged (measures.mjs readInsightLog): a log extracted by several workers is one log here.
  const recorded = await readInsightLog(base, stem);
  // The analyses the runtime computed from the log's measures stand beside
  // its insights: a page rests on either by id.
  const analysis = recorded ? await readAnalysis(base, stem, recorded, { alternatives: alternativesOf(spec) }) : { plan: null, results: [], problems: [] };
  const log = recorded ? { ...recorded, insights: [...(recorded.insights || []), ...analysisInsights(analysis.results)] } : null;
  return { log, analysis, measures: log ? recordedMeasures(log.insights) : null };
}
/** The recorded measures of a deck whose file is at `deckPath`; null where the deck file, or its log, is not there. */
const readMeasures = async (spec, deckPath) => (deckPath ? (await readEvidence(spec, deckPath)).measures : null);

// A quantity recorded twice. Two measures of different insights, in one unit,
// that agree on some of the periods or members they share and differ on
// others are most likely one quantity recorded twice with a disagreement in
// it - and then the pages that show them disagree, which a reader of the
// drawn deck finds as a blocker. (Two different quantities in one unit differ
// everywhere they meet; the same quantity agrees everywhere.) The runtime
// cannot be sure, so it lists every such pair for the critic to say. A page's
// line gives a measure in a few values, so without the list a disagreement on
// the fifth member of a peer set is not in the packet at all. A difference of
// rounding alone (32.007 against 32.0) is not a difference.
const RECONCILE_MAX = 12;
const decimalsOf = (n) => (String(n).split(".")[1] || "").length;
const sameAtCoarser = (a, b) => { const places = Math.min(decimalsOf(a), decimalsOf(b)); return Number(a.toFixed(places)) === Number(b.toFixed(places)); };
/** The pairs of shown measures that may be one quantity recorded twice, as lines; `shown` maps a measure to the pages that show it, `only` keeps the pairs a page of that list shows. */
function recordedTwice(shown, registry, only = null) {
  const refs = [...shown.keys()].filter((ref) => registry.get(ref)?.unit);
  const lines = [];
  for (const [i, a] of refs.entries()) for (const b of refs.slice(i + 1)) {
    const [ma, mb] = [registry.get(a), registry.get(b)];
    if (a.split("/")[0] === b.split("/")[0] || ma.unit !== mb.unit) continue;
    if (only && ![...shown.get(a), ...shown.get(b)].some((id) => only.includes(id))) continue;
    const [xa, xb] = [axisOf(ma), axisOf(mb)], [va, vb] = [valuesOf(ma), valuesOf(mb)];
    const met = xa.labels.map((label, at) => [label, va[at], vb[xb.labels.indexOf(label)]]).filter(([, p, q]) => typeof p === "number" && typeof q === "number");
    const differ = met.filter(([, p, q]) => !sameAtCoarser(p, q));
    if (differ.length && differ.length < met.length) lines.push(`${a} (shown on ${shown.get(a).join(", ")}) and ${b} (shown on ${shown.get(b).join(", ")}), ${ma.unit}: agree on ${met.length - differ.length} of the ${met.length} they share; differ on ${differ.slice(0, 4).map(([label, p, q]) => `${label}, ${p} against ${q}`).join("; ")}${differ.length > 4 ? `; and ${differ.length - 4} more` : ""}`);
  }
  return lines.slice(0, RECONCILE_MAX);
}

/**
 * The pages the critique reads, with what each rests on: its claim, its page
 * type, what settles it, the measures it declares it shows with their recorded
 * values, and the insights it names with their calculation and sources, so
 * sourcing is judged page by page rather than found by accident. `drafted`,
 * `draftedNumbers` and `commentary` are whatever exhibits and copy the author
 * has sketched: the layout follows the critique, so they are shown as a draft
 * and the critique is not bound to them. `max` is how many values of a
 * measure a line lists.
 */
async function storyPages(spec, specPath, { max }) {
  const content = await readJson(path.join(path.dirname(specPath), `${stemOf(specPath)}.content.json`), { optional: true });
  const byId = new Map((content?.pages || []).map((p) => [p.id, p]));
  const { log, analysis, measures } = await readEvidence(spec, specPath);
  const insights = new Map((log?.insights || []).map((i) => [i.id, i]));
  const registry = measureRegistry(log?.insights || []);
  let section = null;
  const composed = [...(spec.slides || []), ...(spec.appendix || [])].map((s, i) => {
    if (s.kind === "section") section = String(s.title ?? s.text ?? "");
    const planned = byId.get(s.id) || {};
    const body = (planned.textPlan || []).filter((b) => ["body", "qualification"].includes(b.role)).map((b) => b.text);
    const evidence = planned.evidence ?? s.pageType?.content?.evidence ?? [];
    const exhibits = exhibitsOf(s);
    return { n: i + 1, id: s.id ?? `p${i + 1}`, kind: s.kind ?? "content", section, title: s.title ?? s.text ?? "", claim: planned.claim ?? s.pageType?.content?.claim ?? null,
      settles: planned.settles ?? s.pageType?.content?.settles ?? null,
      // Each measure with its recorded values and what the page shows of it: the windows and classes the critique is bound to.
      // A measure an exhibit not drawn yet names is read as that exhibit will draw it, not as missing from a page that shows others.
      measures: (({ views, named }) => measureRoles(s).map(({ ref, role }) => ({ ref, role, line: `${measureLine(ref, `${ref}${role === "context" ? " (context)" : role === "claim" && declaredBases(s).length ? " (the claim's)" : ""}`, registry, max, `${s.title ?? ""} ${planned.claim ?? s.pageType?.content?.claim ?? ""}`)}${viewsLine(views.get(ref) ?? null, measures?.[ref], s.pageType?.type, views.size > 0 && !named.has(ref))}` })))(shownOf(s, measures)),
      drafted: exhibits.map(describeExhibit), draftedNumbers: draftedNumbers(exhibits), commentary: body.slice(0, 6), source: s.source ?? null,
      // The context measures and the relation the claim asserts, for the critic to judge: declared by the author, never inferred.
      declared: dependencyNotes({ bases: declaredBases(s), settles: s.pageType?.content?.settles }),
      // Where the page's type has no form that carries what its measures ask of a reader and another type has (claim-fit.mjs): read, not declared, for the shape check.
      fit: s.pageType && registry.size ? typeFitNote(s, { registry, insights, carriedBy: (type) => !TYPE_SHAPES[type] || evidence.some((id) => TYPE_SHAPES[type].includes(insights.get(id)?.shape)) }) : "",
      evidence: evidence.map((id) => { const item = insights.get(id); return item ? { id, finding: item.finding, calculation: item.calculation ?? null, sources: item.sources ?? [], strength: item.strength ?? null } : { id, missing: true }; }),
      ...(s.pageType ? { type: s.pageType.type } : {}) };
  });
  // The slides a revision carries, in their places: each by its title and the words it prints, as the inventory read them and as the revision's edits leave them.
  const inventory = spec.carried?.length ? await readInventory(spec, specPath) : null;
  const said = new Map(carriedSaid(spec, inventory).map((item) => [item.id, item]));
  const pages = (spec.carried?.length ? withCarriedPages(spec, composed, (entry) => ({ id: entry.id, kind: "carried", title: String(entry.retitled ?? entry.title ?? ""), says: said.get(entry.id)?.texts.slice(1, 9) ?? [], edited: Boolean(said.get(entry.id)?.edited),
    // A slide the revision edited is judged against all it says and shows - its record, whole (revision.mjs slideRecord): a title rewritten over a table is read against every row.
    // With it, the lines the revision rewrote, each beside what it replaced: every other line of the record is the user's own, and a critic who cannot tell the two apart files the user's words as the revision's.
    ...(said.get(entry.id)?.edited ? { record: said.get(entry.id).record, rewrote: said.get(entry.id).rewritten.map((line) => ({ what: line.title ? "title" : "line", was: line.was, now: line.text })) } : {}) }), (page) => String(page.id)) : composed)
    .map((page, i) => ({ ...page, n: i + 1 }));
  const shown = new Map();
  for (const page of composed) for (const { ref } of page.measures) if (registry.has(ref)) shown.set(ref, [...(shown.get(ref) ?? []), page.id]);
  return { pages, content, log, analysis, measures, reconcile: (only) => recordedTwice(shown, registry, only) };
}

// A spine past this many content pages is critiqued page by page (--full) by
// parallel section critics (splitSections, at most STORYLINE_SECTION_MAX pages
// each) and one spine critic: a forty-page section read by one critic is the
// thin reading the split exists to prevent.
export const STORYLINE_SECTION_THRESHOLD = 30;
export const STORYLINE_SECTION_MAX = 16;

// How many values of a measure a page's line lists before it is given by its ends and what the page cites.
const MEASURE_VALUES = 12;
// And how many measures a page's line in the spine packet gives in full; the rest are named.
const SPINE_MEASURES = 4;

const HISTORY = "storyline-history";
// What a ready critique leaves the author to do, said where it is reached: the one layout pass.
const READY_NOTE = "The argument is settled: lay the pages out now, once - exhibits, forms, commentary and copy (author-deck.mjs without --draft). Layout and copy edits keep this critique, a chart redrawn in another chart form among them; changing a title, a page type, what settles a claim, the insights or measures a page rests on, which periods or members of a measure a page shows, whether it is plotted, tabulated or stated as a figure, the pages or the answer needs a verification pass. A page not drawn when the critique read it was read in the view its `basis` declared (`as`, `labels`) and, with none declared, as showing each measure whole: laid out so, it keeps the critique";
// The version of what the binding holds (storyStructure). A pass recorded
// under another version hashed its pages differently, so nothing can say which
// of them changed since: its lineage is retired and the critique begins again
// (prepareStoryline), not read as a deck in which every page moved.
const BINDING_VERSION = 5;
const bindingVersionOf = (record) => record?.bindingVersion ?? 1;
const PACKET_RECORD = "storyline-packet.json";

/** The recorded passes of a deck's storyline lineage, from its lineage store (lineageStore). */
export const readStorylineHistory = (store) => readPasses(path.join(store, HISTORY));

// Phrases with which an answer declines to answer, in a negated sentence
// ("neither has a provably superior ... or a defensible long-run win"):
// counted and shown to the critic, who judges them against the request's parts.
const DECLINE = /\b(?:cannot|can't|could not|unable to|not possible to|too early to)\s+(?:be\s+)?(?:rank|say|tell|call|determine|decide|conclude)\w*|\bunranked\b|\b(?:provabl\w*|defensibl\w*|clear)\s+(?:[\w-]+\s+){0,3}?(?:superior|win|winner|lead|leader|advantage|call|ranking)\b/gi;
export const declinesIn = (text) => String(text ?? "").split(/(?<=[.;!?])\s+/).filter((s) => /\b(?:neither|no|not|nor|cannot|can't|unranked)\b/i.test(s))
  .flatMap((s) => [...s.matchAll(DECLINE)].map((m) => m[0]));

/**
 * Write the next critique packet: the spine packet by default (small - the
 * request, the answer, the sections, and a line per page), or the page-level
 * packet with `mode: "full"`. It is staged in a clean temporary directory (the
 * prompt, the schema, the packet); its record, which the answer is validated
 * against, is kept in the deck's lineage store.
 */
export async function buildStorylinePacket(specPath, outputDirectory, { scope = null, mode = "spine", revision = null, carried = [] } = {}) {
  const spec = await readJson(specPath);
  const base = path.dirname(specPath);
  const store = await lineageStore(spec, outputDirectory, specPath);
  // The spine packet gives a measure in a few values; the page-level packet gives the series.
  const { pages, content, log, analysis, measures, reconcile } = await storyPages(spec, specPath, { max: MEASURE_VALUES });
  // Sources sit in workstream folders (sources/<workstream>/...), so list them all.
  const sources = await sourceFiles(base);
  const insights = checkInsights(log, sources, pages.map((p) => ({ kind: p.kind === "section" ? "section" : isContent(p) && p.type ? "content" : "other", title: p.title, evidence: (p.evidence || []).map((e) => e.id) })));
  const contentPages = pages.filter(isContent).length;
  const targetPages = Number.isFinite(spec.targetPages) ? spec.targetPages : spec.purpose === "evaluation" ? 50 : null;
  const sections = mode === "full" && !scope && !revision && contentPages > STORYLINE_SECTION_THRESHOLD
    ? splitSections(pages.map((p) => ({ id: p.id, title: p.title, opens: p.kind === "section", counted: isContent(p) })), { max: STORYLINE_SECTION_MAX }) : null;
  const answer = spec.answer ?? content?.answer ?? "";
  const packet = { mode, binding: storylineBinding(spec, measures), bindingVersion: BINDING_VERSION, pageHashes: storylinePageHashes(spec, measures), pass: scope ? scope.pass : 1, verifies: scope ? scope.verifies : null,
    maxPasses: scope?.maxPasses ?? MAX_PASSES, scope, sections, deck: path.resolve(specPath), revision: !scope && revision ? { changed: revision.spine, dropped: revision.dropped } : null,
    request: requestOf(spec), requestProvenance: requestProvenanceOf(spec), evidenceScope: evidenceScopeOf(spec), answerStatus: answerStatusOf(spec),
    // What the runtime computed before the outline, and what it could not: a missing analysis closes on one of these, not on a qualification.
    analyses: analysis.results.map((r) => ({ id: r.id, op: r.op, status: r.status, line: analysisLine(r), missing: r.missing ?? [], assumptions: (r.assumptions || []).length })),
    analysisProblems: analysis.problems,
    // Each analysis result and insight by the hash of its content: what a later pass compares to say an item closed on something that changed.
    artifacts: Object.fromEntries([...analysis.results.map((r) => [r.id, r.hash]), ...(log?.insights || []).filter((item) => item?.id && !item.derived).map((item) => [item.id, sha256(JSON.stringify(item))])]),
    question: spec.question ?? content?.question ?? null, answer, declines: declinesIn(answer),
    // What a title is held to, so a fix that proposes one stays inside it.
    limits: titleLimits(spec, base),
    // Measures that may be one quantity recorded twice: where a revision or a later pass reads part of the deck, the pairs a page it reads shows.
    reconcile: reconcile(scope ? scope.postReview?.pages ?? scope.changed : revision ? revision.spine : null),
    // The blocking items open when an earlier lineage was retired: a first pass says of each whether it still stands.
    ...(!scope && carried.length ? { carried } : {}),
    players: spec.players ?? [], sources, insights, targetPages, totalPages: pages.length, contentPages, pages };
  const schema = offeredSchema(mode, scope, { carried: !scope && carried.length > 0 });
  const previous = await readJson(path.join(store, PACKET_RECORD), { optional: true });
  const dir = await stageReview("storyline", {}, { previous: previous?.staging });
  packet.staging = dir;
  const main = scope ? storylineVerificationPrompt(packet) : mode === "full" ? storylinePrompt(packet) : spinePrompt(packet);
  const parts = sections ? [...sections.map((section) => [section.id, storylineSectionPrompt(packet, section)]), ["spine", storylineSpinePrompt(packet)]] : [];
  packet.promptHash = sha256([main, ...parts.map(([, text]) => text)].join("\u0000"));
  const signed = (text) => `${text}${provenanceLine(packet.promptHash)}`;
  // The staged copy says what the critic is given; the record keeps the ledger the answer is checked against.
  const { ledger, ...shownScope } = scope || {};
  await writeJson(path.join(dir, "packet.json"), { ...packet, scope: scope ? shownScope : null });
  await writeJson(path.join(dir, "schema.json"), schema);
  await fs.writeFile(path.join(dir, "prompt.md"), signed(main));
  if (sections) {
    await fs.mkdir(path.join(dir, "sections"), { recursive: true });
    await fs.mkdir(path.join(dir, "parts"), { recursive: true });
    await writeJson(path.join(dir, "part-schema.json"), offeredPart("section"));
    await writeJson(path.join(dir, "spine-part-schema.json"), offeredPart("spine"));
    for (const [id, text] of parts) await fs.writeFile(path.join(dir, "sections", `${id}.md`), signed(text));
  }
  await fs.mkdir(store, { recursive: true });
  await writeJson(path.join(store, PACKET_RECORD), packet);
  return { dir, packet, store };
}

/**
 * The pillars that rest on no strong insight (PILLAR_UNSUPPORTED): `pages` in
 * order as { kind, title, evidence, appendix }, a section opening each pillar
 * and `kind: "content"` for a page that argues; the whole deck, appendix
 * included, is one pillar when it has no sections.
 */
export function unsupportedPillars(pages, insights) {
  const pillars = [];
  for (const page of pages) {
    if (page.kind === "section") pillars.push({ title: String(page.title ?? "section"), ids: [] });
    else if (page.kind === "content" && !page.appendix && pillars.length) pillars.at(-1).ids.push(...(page.evidence || []));
  }
  const all = { title: "the deck", ids: pages.filter((p) => p.kind === "content").flatMap((p) => p.evidence || []) };
  const strength = (id) => (insights instanceof Map ? insights.get(id) : insights?.[id])?.strength;
  return (pillars.length ? pillars : [all]).filter((p) => p.ids.length && !p.ids.some((id) => strength(id) === "strong"));
}

/**
 * The insights whose `sources` are not files the deck holds: `[{ id, none,
 * missing }]`, `none` where an insight names no source and `missing` the
 * entries that are not a file under sources/ (`sources`: the files there, as
 * paths relative to it). A source is the file a finding was read from, by its
 * path - `sources/accounts.csv` - so a name or a registry key is not one.
 */
export function unfiledSources(items, sources = []) {
  const have = new Set(sources.map((f) => `sources/${f}`));
  return (items || []).flatMap((item) => { const listed = Array.isArray(item?.sources) ? item.sources : [], missing = listed.filter((f) => !have.has(f));
    return !listed.length ? [{ id: item?.id ?? "?", none: true, missing: [] }] : missing.length ? [{ id: item?.id ?? "?", none: false, missing }] : []; });
}
// The source files a number can be read back from: text, tables and markup as they are, a PDF through pdftotext (the
// reader the density profile already needs). Research sources are often a publisher's PDF report.
const READABLE = /\.(?:csv|tsv|txt|md|json|html?|xml|pdf)$/i;
const sourceText = (file) => (/\.pdf$/i.test(file)
  ? new Promise((resolve) => execFile("pdftotext", ["-layout", file, "-"], { maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => resolve(error ? null : stdout)))
  : fs.readFile(file, "utf8").catch(() => null));
// A measure is told of when more than this share of its recorded values cannot be found in its insight's source files.
const UNREAD_SHARE = 0.5;
// The scales a source prints a recorded number at: as it is, a share as a percentage or back, and by a thousand, a million or a billion either way.
const SCALES = [1, 100, 0.01, 1e-3, 1e-6, 1e-9, 1e3, 1e6, 1e9];
/** The numbers `text` prints, read both ways where a comma could be a thousands separator or a CSV field's end: "4,629.9" and "2,690.17" alike. */
const numbersIn = (text) => [...(text.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g) ?? []), ...(text.match(/\d+(?:\.\d+)?/g) ?? [])].map((n) => Number(n.replace(/,/g, "")));
/**
 * Whether one of `printed` (a source's numbers) is `value` as the log records
 * it: the same number at one of SCALES, rounded to the decimals the log keeps.
 * The log's 2.08 (msf) is the source's 2,075,442 (sf). A number of one digit
 * is found only as itself: rounded, 4 is found in any table.
 */
function printedIn(printed, value) {
  const decimals = (String(value).split(".")[1] ?? "").length, tolerance = 0.5 * 10 ** -decimals + 1e-9, target = Math.abs(value);
  return printed.some((n) => n === target || SCALES.some((scale) => {
    const scaled = n * scale;
    return Math.abs(scaled - target) <= tolerance && String(n).replace(/\D/g, "").replace(/^0+/, "").length >= 2;
  }));
}

/**
 * The insights whose recorded numbers their own source files do not print: of
 * each finding whose `sources` include a file the runtime can read as text, the
 * values its measures record, looked for in those files in the forms a source
 * prints them. A source named for a number it does not carry is a citation no
 * one checked - the transcription slipped, or the file is not the one the
 * number came from. Told to the author, who opens the file; never refused,
 * since a number a source states in words or in a chart cannot be read back.
 * `[{ id, measures, missing }]`: the measures more than half of whose values no source file prints.
 */
export async function unreadNumbers(items, base) {
  const out = [];
  const read = new Map();
  const numbersOf = async (files) => (await Promise.all(files.filter((file) => READABLE.test(file)).map((file) => {
    if (!read.has(file)) read.set(file, sourceText(path.join(base, file)).then((text) => (text === null ? null : numbersIn(text))));
    return read.get(file);
  }))).filter(Boolean).flat();
  for (const item of items || []) {
    if (!item || item.status === "assumed" || item.derived) continue;
    // Measure by measure, against the files it names or else its insight's: a slipped column among four that read back is
    // still a column no source prints. A measure the researcher computed says how (`computed`) and is not looked for.
    const unread = [];
    for (const [name, m] of Object.entries(item.measures || {})) {
      if (!m || m.assumed || m.computed) continue;
      const printed = await numbersOf(Array.isArray(m.sources) ? m.sources : Array.isArray(item.sources) ? item.sources : []);
      const values = (Array.isArray(m.values) ? m.values : [m.value]).filter(Number.isFinite);
      if (!printed.length || !values.length) continue;
      const missing = values.filter((value) => !printedIn(printed, value));
      if (missing.length / values.length > UNREAD_SHARE) unread.push({ name, missing });
    }
    if (unread.length) out.push({ id: item.id, measures: unread.map((m) => m.name), missing: unread.flatMap((m) => m.missing.slice(0, 3).map((value) => `${m.name} ${value}`)).slice(0, 6) });
  }
  return out;
}

/** The files under `<base>/sources`, as paths relative to it: what an insight's `sources` are checked against. */
export const sourceFiles = (base) => fs.readdir(path.join(base, "sources"), { recursive: true }).then((all) => all.filter((f) => /\.[a-z0-9]+$/i.test(f)).map((f) => f.split(path.sep).join("/"))).catch(() => []);

/**
 * The insight log, checked for what makes a finding a finding: a statement,
 * the calculation that produced it, its grade and what follows from it, and a
 * source file that exists. Problems are reported to the critic, who weighs
 * them; the authoring compile is where an ungraded log is refused.
 */
export function checkInsights(log, sources = [], pages = null) {
  if (!log) return { present: false, items: [], problems: ["no insight log: the titles were written without recorded findings"] };
  const items = Array.isArray(log.insights) ? log.insights : [];
  const problems = [];
  for (const item of items) {
    if (!item?.finding || !item?.calculation) problems.push(`${item?.id ?? "?"}: a finding needs its statement and the calculation behind it`);
    problems.push(...insightGradeProblems(item));
    // The shape of the data decides which pages it can carry (page-types.mjs):
    // recorded here, at the data stage, a missing series or peer set is a
    // research task now rather than a weak page the critic finds later.
    if (!SHAPES[item?.shape]) problems.push(`${item?.id ?? "?"}: record the data's \`shape\` - one of ${Object.keys(SHAPES).join(", ")}`);
    // And its breadth: a four-year series or a three-member peer set is a thin page waiting to be written.
    else if (breadthProblem(item)) problems.push(breadthProblem(item));
  }
  // One line for every insight whose sources are not files: the compile said the same to the author first (author-deck.mjs SOURCES_UNFILED).
  problems.push(...unfiledSources(items, sources).map((entry) => (entry.none ? `${entry.id}: no source file` : `${entry.id}: source not in sources/: ${entry.missing.join(", ")}`)));
  if (pages) for (const pillar of unsupportedPillars(pages, new Map(items.map((i) => [i.id, i])))) problems.push(`PILLAR_UNSUPPORTED: "${pillar.title}" rests on no strong insight`);
  return { present: true, items: items.map((i) => ({ id: i.id, finding: i.finding, shape: i.shape ?? null, breadth: breadthOf(i), strength: i.strength ?? null, calculation: i.calculation ?? null, sources: i.sources ?? [] })), problems };
}

// What settles a page's claim, and the measures it declares it shows: the part of a page's line the critique is bound to.
const settlesLine = (p) => (p.settles?.kind ? `${p.settles.kind}${p.settles.what ? `: ${p.settles.what}` : ""}` : null);
// The measures a page shows, each with its recorded values; past `max` of them the rest are named.
const shownLine = (measures, join, max = measures.length) => `${measures.slice(0, max).map((m) => m.line).join(join)}${measures.length > max ? `${join}and ${measures.slice(max).map((m) => m.ref).join(", ")}` : ""}`;
const restsLine = (p) => (p.evidence?.length ? p.evidence.map((e) => e.missing ? `${e.id} (NOT IN THE LOG)` : `${e.id} "${e.finding}" (calc: ${e.calculation ?? "none"}; sources: ${e.sources.join(", ") || "none"})`).join("; ") : "no insight named");
// A carried slide is the user's own: its title, and what it says in a line, so the critic reads the argument across it.
const carriedLine = (p) => `${p.n}. [${p.id}] ${p.title || "(untitled)"} | a slide of the user's deck, carried as it is${p.edited ? " (edited in place by this revision)" : ""}${(p.says || []).length ? ` | says: ${p.says.join(" / ").slice(0, 320)}` : ""}`
  + ((p.rewrote || []).length ? `\n     WHAT THE REVISION REWROTE ON IT - only this is the revision's; every other line below is the user's own, as it stood:\n${p.rewrote.map((line) => `       the ${line.what}, from "${line.was}" to "${line.now}"`).join("\n")}` : "")
  + ((p.record || []).length ? `\n     THE SLIDE ITSELF under that title, as this revision leaves it - its record, whole (the title is not repeated here):\n${p.record.map((line) => `       ${line}`).join("\n")}` : "");
const spineLine = (p) => p.kind === "carried" ? carriedLine(p) : isContent(p)
  ? `${p.n}. [${p.id}] ${p.title}${p.type ? `\n     page type: ${p.type}` : ""}${settlesLine(p) ? `\n     settled by: ${settlesLine(p)}` : ""}\n     shows: ${shownLine(p.measures || [], " / ") || "no measure declared"}${(p.declared || []).length ? `\n     declared: ${p.declared.join(" / ")}` : ""}\n     rests on: ${restsLine(p)}${(p.drafted || []).length ? `\n     drafted exhibits (not settled): ${p.drafted.join(" + ")}${p.draftedNumbers ? `; drawing ${p.draftedNumbers}` : ""}` : ""}${(p.commentary || []).length ? `\n     drafted copy (not settled): ${p.commentary.join(" / ").slice(0, 400)}` : ""}`
  : `${p.n}. [${p.id}] -- ${p.kind}: ${p.title}`;

// One line per page for the spine critique: title, claim where it differs,
// page type and what kind of evidence settles it, the measures it shows with
// their recorded values, and the insight ids it rests on - only what the
// critique is bound to. A drafted exhibit's numbers are not in it.
const compactLine = (p) => p.kind === "carried" ? carriedLine(p) : isContent(p)
  ? `${p.n}. [${p.id}] ${p.title}${p.claim && p.claim !== p.title ? ` | claim: ${p.claim}` : ""}${p.type ? ` | ${p.type}${p.settles?.kind ? `, settled by ${p.settles.kind}` : ""}` : ""}${(p.measures || []).length ? ` | shows: ${shownLine(p.measures, "; ", SPINE_MEASURES)}` : ""} | rests on: ${(p.evidence || []).map((e) => `${e.id}${e.missing ? " (NOT IN THE LOG)" : ""}`).join(", ") || "none"}${(p.declared || []).length ? ` | declared: ${p.declared.join(" / ")}` : ""}${p.fit ? ` | fit: ${p.fit}` : ""}`
  : `${p.n}. [${p.id}] -- ${p.kind}: ${p.title}`;

// The text of a page as the packet shows it: what a missed item's quoted evidence is checked against.
const packetPageText = (packet) => Object.fromEntries(packet.pages.map((p) => [p.id, [p.title, ...(p.says || []), p.claim, p.type, settlesLine(p), ...(p.measures || []).map((m) => m.line), p.draftedNumbers, ...(p.drafted || []), ...(p.declared || []), ...(p.commentary || []), ...(p.evidence || []).map((e) => `${e.id} ${e.finding ?? ""}`)].filter(Boolean).join("\n")]));

// The measures that may be one quantity recorded twice (recordedTwice), as the critic is asked about them.
const reconcileLines = (packet) => ((packet.reconcile || []).length ? `
FIGURES TO RECONCILE. Each pair below is two measures of different insights, in one unit, that agree on some of the periods or members they share and differ on others. Say in \`numbers\` of each whether they are one quantity - then the pages disagree: a blocker \`numbers\` finding naming both - or two quantities, and why:
${packet.reconcile.map((line) => `- ${line}`).join("\n")}
` : "");

// The title limits the build holds (review-floors.mjs titleLimits), as the critic is held to them in a fix.
const limitsLine = (packet) => (packet.limits ? `\nLIMITS THE BUILD HOLDS: ${titleLimitsLine(packet.limits)}.\n` : "");

// What the runtime computed from the insight log's measures before the outline was written.
const analysesLines = (packet) => `COMPUTED ANALYSES (run by the runtime over the log's measures; a page rests on one by its id):
${(packet.analyses || []).map((a) => `- ${a.line}`).join("\n") || "- none"}${(packet.analysisProblems || []).length ? `\nANALYSIS PLAN PROBLEMS: ${packet.analysisProblems.join("; ")}` : ""}`;

function checksPrompt() {
  return `THE CHECKS. Page checks on every content page; spine checks on the storyline as a whole. After each check's own question come the deck review's words for it: apply them now, to what the packet shows of each page.
${STORYLINE_DIMENSIONS.map((d) => `- ${d} (${STORYLINE_CHECKS[d].scope}): ${STORYLINE_CHECKS[d].checks}`).join("\n")}

SEVERITY, on the deck review's scale:
${["blocker", "major", "minor", "none"].map((s) => `- ${s}: ${ARGUMENT_SEVERITIES[s]}`).join("\n")}`;
}

// What the critique settles and what it leaves to the layout, said to every
// critic: the gate is bound to the argument, so an item only a redrawn exhibit
// or a reworded sentence would fix could never be closed here.
const ARGUMENT_RULES = `the pages are laid out once, after this critique is ready. Settled here: each page's claim, page type, what settles it, the insights it rests on, the measures it shows - with, in brackets after each, which of its periods or members the page shows and whether plotted, tabulated or stated as a figure (a page not drawn yet is read in the view it declares, or as showing the measure whole) - the page order and the answer. A chart's form, commentary placement, captions and copy are not: anything marked a draft is the author's sketch. File no item that only a redrawn or reworded page would fix; the deck review judges the pages as drawn.`;

/** The storylining standard, condensed, so a critic needs no other file. */
export const CRITIC_STANDARDS = `THE STANDARD. You need no other file: this is the skill's storylining guidance, condensed.
- A missing analysis names why it would change the answer, the data behind it and its \`remedy\`: ${Object.entries(REMEDIES).map(([key, about]) => `"${key}" (${about})`).join(", ")}. Ask first whether the packet's own measures would settle it. Mark \`public: "known"\` only when you can name the public source that publishes the data; otherwise "speculative", and a speculative retrieval is never major. Say what you know is published. An analysis is met by the analysis, never by a caveat saying what the evidence does not establish.
- The requested length counts the appendix: recommend cutting weak or repetitive body pages freely, and move surplus pages that still earn a lookup to the appendix, which keeps the total at the requested length; give the freed body pages to a missing analysis.
- Judge the argument, not the drawing or the wording: ${ARGUMENT_RULES}`;

// How a page is named, and what the runtime does with a list that names one loosely (settleCritiqueForm): said once, to every critic.
const PAGE_IDS_RULE = "Name a page by the id in brackets on its line (a divider has one), never by its position. A range in a page list (\"p16-p19\") is read as every page between, and a page a spine item's `problem`, `fix` or `freedUse` names by id is added to its list; the record says the runtime did.";

/**
 * A critique with its page lists settled (review-passes.mjs settlePageList):
 * `{ review, mended }`. Ranges are expanded in every page list - a finding's,
 * a cut's, a pillar's, a status's - and a spine finding or a cut gains each
 * page its own text names by id. Nothing a critic judged is touched, and each
 * thing done is listed in `mended` (`at`, `did`, `pages`), which the loop keeps
 * on the pass's record and prints. A critique that is not an object is returned
 * as it is, for validation to refuse.
 */
export function settleCritiqueForm(reviewIn, ids, contentIds = ids) {
  if (!reviewIn || typeof reviewIn !== "object" || Array.isArray(reviewIn)) return { review: reviewIn, mended: [] };
  const review = structuredClone(reviewIn), mended = [];
  const settle = (name, textOf) => {
    if (!Array.isArray(review[name])) return;
    review[name].forEach((item, i) => {
      if (!item || typeof item !== "object") return;
      const done = settlePageList(item.pages, ids, { text: textOf ? textOf(item) : null, spanned: contentIds });
      if (!done.mended.length) return;
      item.pages = done.pages;
      mended.push(...done.mended.map((entry) => ({ at: `${name}[${i}]${item.id ?? item.finding ? ` (${item.id ?? item.finding})` : ""}`, ...entry })));
    });
  };
  settle("findings", (item) => (item.scope === "spine" ? `${item.problem ?? ""} ${item.fix ?? ""}` : null));
  // A cut names the pages it cuts; the page its freed space goes to is not cut with it. A merge names every page it joins.
  settle("cutOrMerge", (item) => (item.action === "merge" ? String(item.freedUse ?? "") : null));
  settle("pillars", null);
  settle("statuses", null);
  // A cut or merge left without a severity is what the scale makes one: minor.
  (Array.isArray(review.cutOrMerge) ? review.cutOrMerge : []).forEach((item, i) => {
    if (!item || typeof item !== "object" || item.severity !== undefined) return;
    item.severity = "minor";
    mended.push({ at: `cutOrMerge[${i}]${item.id ? ` (${item.id})` : ""}`, did: "minor", was: "no severity", pages: item.pages || [] });
  });
  // A blocking item says what it does to the decision (BLOCKING_STAKE); one that does not is a minor item, recorded as one.
  for (const name of ["findings", "missingAnalyses", "cutOrMerge"]) (Array.isArray(review[name]) ? review[name] : []).forEach((item, i) => {
    if (!item || typeof item !== "object" || !BLOCKING.has(item.severity) || String(item.ifUnfixed ?? "").trim().length >= STAKE_MIN) return;
    mended.push({ at: `${name}[${i}]${item.id ? ` (${item.id})` : ""}`, did: "minor", was: item.severity, pages: item.pages || [] });
    item.severity = "minor";
  });
  return { review, mended };
}
// The least a blocking item's `ifUnfixed` says: a sentence naming what the decision-maker would get wrong.
const STAKE_MIN = 30;
/** `mended` (settleCritiqueForm) as the lines a run prints. */
const mendedLines = (mended) => mended.map((entry) => (entry.did === "range" ? `${entry.at}: "${entry.from}" read as ${entry.pages.join(", ")}`
  : entry.did === "dropped" ? `${entry.at}: a later pass adds only major or blocker findings, so this ${entry.was} point was left out of the record`
  : entry.did === "minor" ? `${entry.at}: ${entry.was === "no severity" ? "filed with no severity, so recorded as minor" : `filed ${entry.was} without \`ifUnfixed\` - what the decision-maker would get wrong - so recorded as minor`}`
  : `${entry.at}: ${entry.pages.join(", ")} added to its pages, since its text names ${entry.pages.length === 1 ? "it" : "them"}`));

/**
 * The rules validation enforces on the form of a critique, each as the prompt
 * states it (`rule`) and as its refusal reads (`matches`): one table, so the
 * critic is told exactly what is tested (the deck review's is reviewer.mjs
 * formRules). `checks` are the checks the answer's completeness covers - all
 * of them, a section's page checks or the spine part's - `cap` the most items
 * a spine critique returns, and `completeness` false for a verification pass,
 * which carries none.
 */
export const storylineFormRules = ({ cap = null } = {}) => [
  ...(cap ? [{ id: "cap", matches: /returns at most \d+ items/, rule: `at most ${cap} items in all: findings, missing analyses and cuts` }] : []),
  { id: "pages", matches: /a page finding names one page|list the affected pages/, rule: "a finding with `scope: \"page\"` has exactly one id in `pages`; a spine finding has one or more" },
  { id: "sampled", matches: /lists pages by example|ends a page list with/, rule: `no page list by example: none of ${SAMPLING_WORDS.before.map((w) => `"${w}"`).join(", ")} just before a page id, none of ${SAMPLING_WORDS.after.map((w) => `"${w}"`).join(", ")} after one` },
  { id: "title", matches: /the title it proposes|asks for a title of/, rule: "a `fix` that proposes a title in quotes, or a length for one, keeps to the limits above" },
];
const itemRules = (options) => `ITEMS. Every problem is an item with an id (F1, F2, ...; M1... for missing analyses; C1... for cuts), a severity and, for findings, the check it belongs to, the problem and the fix. A spine finding lists EVERY page it concerns (for the answer: the summary and closing pages). ${PAGE_IDS_RULE} ${BLOCKING_STAKE}.
FORM. Validation refuses the whole answer on any of these:
${storylineFormRules(options).map((item) => `- ${item.rule}`).join("\n")}`;

const PAGE_RULES = `PAGES. \`pages\` holds one entry for every content page: a note for claim, shape, restatement and consequence, and \`sourcing\` { status: supported | partly | unsupported | n/a, insights: the ids it rests on, note }. An unsupported page carries a major or blocker sourcing finding; a partly supported one a sourcing finding at any severity. Each page's verdict is read off the items that name it.`;

// How a critic should weigh what it finds: the prior a fair reader brings, said to every critic before the checks.
const CALIBRATION = `CALIBRATION. Most storylines a competent team brings you are ready to lay out with a few minor items; an answer with no items at all is valid. A blocking item (major or blocker) is the exception: file one only where you can say in \`ifUnfixed\` what the decision-maker would wrongly conclude or decide if it stays - "the committee would back the programme on an absorption rate the deck never shows". Everything else is minor, however many pages it touches; minor items reach the team just the same, so never raise a severity to get one acted on. Judge the storyline you are given against the request, not against the deck you would have written.`;

// What the critic does not write: the verdict and the two judgements are the ledger's (withJudgements), and the rating is its own.
const JUDGEMENT_RULES = `THE VERDICT IS READ OFF YOUR ITEMS: ready when no major or blocker is open and the answer check passes; provisional when the only ones open need evidence the scope forbids and the answer is offered as provisional; else revise. You do not write the verdict, compliance or sufficiency. Rate the storyline as you judge it: the rating is a second, independent reading, not a sum of your items.
RATING SCALE, the deck review's: ${ratingScale({ capped: false })}.`;

const ANSWER_RULES = `THE ANSWER, PART BY PART. In \`answerParts\` list each part of the user's request (each question it asks, each choice it wants made) with how the governing answer meets it: "answered", "cannot rank" (with \`missingEvidence\` naming the decisive evidence that is missing, and why it decides the part) or "declined" (anything else that does not answer it). "cannot rank" is allowed once; a second, or any part declined, fails the answer check: the verdict is revise, and a major or blocker \`answer\` finding says what the answer must commit to. \`missingEvidence\` is "" for an answered part.`;

// A revision's first critique reads what the revision changed; the rest is the
// user's deck as it stands, there for context.
// What the deck is made of is said from the counts - the slides carried, the ones edited in place, the pages composed - so
// one carried slide beside forty composed pages is not read as "mostly the user's own".
function revisionMakeup(packet) {
  const pages = packet.pages || [], carried = pages.filter((p) => p.kind === "carried"), edited = carried.filter((p) => p.edited).length, kept = carried.length - edited, composed = pages.length - carried.length;
  if (!carried.length) return "";
  const parts = [kept ? `${kept} ${kept === 1 ? "is the user's own slide" : "are the user's own slides"}, carried into the new deck unchanged` : null, edited ? `${edited} ${edited === 1 ? "is a slide of theirs" : "are slides of theirs"} with words edited in place` : null,
    composed ? `${composed} ${composed === 1 ? "is a page" : "are pages"} the revision composed` : null].filter(Boolean);
  const whose = composed > carried.length ? "Most of the deck is the revision's own argument, to be critiqued as one" : composed ? "Most of the deck is the user's own" : "The deck is the user's own";
  return `Of its ${pages.length} pages, ${parts.join(", ")}. ${whose}: a carried slide is listed by its title and what it says, for the argument it sits in, and is not yours to critique. `;
}
const revisionLines = (packet) => (packet.revision ? `
THIS IS A REVISION of the user's existing deck. ${revisionMakeup(packet)}The pages marked [changed] are the revision's${packet.revision.dropped?.length ? `, and ${packet.revision.dropped.length} slide${packet.revision.dropped.length === 1 ? " was" : "s were"} cut from the source deck (the pages either side are marked)` : ""}; the others are the user's deck as it stands, shown for context. File items only where the revision is involved: a page item names a changed page, and a spine item or a cut lists at least one. A missing analysis is in scope only where a changed page needs it.
WHAT A PAGE OF A REVISION RESTS ON. A slide of the user's own - carried, or edited in place - has no insight log behind it and is asked for none: its record is the slide itself, quoted beside its title (\`says:\`). Judge a changed title or changed words against what that slide says and shows; do not file a sourcing finding because the packet records no insight, calculation or source file for it. A page the revision COMPOSED is the team's own page and rests on what its line shows: where it draws numbers and names no insight, that is a sourcing finding, and the fix is one record in the insight log for the numbers it draws - their unit, population, period or members and values, with the source they came from, which may be the user's own slide - named in the page's \`evidence\`.
${ABOUT_IMPORTED_RULE} The request below is the change the user asked for, where one is recorded: judge whether the changed pages make it and still fit the argument around them, and in \`answerParts\` take the parts of that change - not the question the user's deck was written to answer.
` : "");
/** The blocking items a retired lineage left open, as a first pass is asked about them. */
const carriedLines = (packet) => (packet.carried?.length ? `
OPEN WHEN THE EARLIER LINEAGE WAS RETIRED: an earlier critique of this storyline, recorded before the critique was bound to what it is bound to now, left ${packet.carried.length} blocking item${packet.carried.length === 1 ? "" : "s"} open. That record cannot be compared with this spine, so ${packet.carried.length === 1 ? "it is not a status" : "they are not statuses"} to verify; but ${packet.carried.length === 1 ? "it is" : "each is"} a serious problem a critic saw, and none is dropped unread. For each, say in \`carried\` whether it still stands on the spine as it is now - one { item, stands, evidence } - and where it stands, file it as an item of this pass (a finding, a missing analysis or a cut) and name that item's id in \`finding\`. Validation refuses a critique that leaves one unanswered.
${packet.carried.map((item) => `- ${item.id} · ${item.dimension ?? item.code ?? "item"} · ${item.severity} · ${(item.pages || []).join(", ") || "the spine"}: ${item.text}`).join("\n")}
` : "");
const marked = (packet, line, p) => `${line}${packet.revision?.changed?.includes(p.id) ? "  [changed]" : ""}`;

/** The request and the answer, as the critic reads them. */
function requestLines(packet) {
  const said = requestStatement(packet, "storyline");
  const request = packet.request
    ? `THE USER'S REQUEST (${said.label ?? "verbatim - the yardstick; judge the storyline against it, not against the team's framing"}):\n"""\n${packet.request}\n"""`
    : `THE USER'S REQUEST: not recorded. Judge against the team's question and say so in the summary. THE TEAM'S QUESTION: ${packet.question || "(not stated)"}`;
  return `${request}${said.scope ? `\n${said.scope}` : ""}\nTHE TEAM'S ANSWER: ${packet.answer || "(not stated)"}${said.offered ? `\n${said.offered}` : ""}${packet.declines?.length ? `\nTHE ANSWER DECLINES ${packet.declines.length} TIME${packet.declines.length === 1 ? "" : "S"}: ${packet.declines.map((d) => `"${d}"`).join(", ")} - check each against the parts of the request.` : ""}`;
}

// A deck with no dividers has no drawn pillars: it is not one pillar called "Opening", and the critic is told so.
const sectionsLine = (packet) => {
  if (!packet.pages.some((p) => p.kind === "section")) return "- none: the deck runs without section dividers, so read the pillars as the reasons the answer gives, not as sections";
  const groups = [];
  for (const p of packet.pages) {
    if (p.kind === "section") groups.push({ title: p.title, ids: [] });
    else if (isContent(p)) { if (!groups.length) groups.push({ title: "(before the first section)", ids: [] }); groups.at(-1).ids.push(p.id); }
  }
  return groups.map((g) => `- ${g.title}: ${g.ids.length ? `${g.ids[0]}-${g.ids.at(-1)} (${g.ids.length} pages)` : "no pages"}`).join("\n");
};

const SPINE_HEADING = "THE SPINE (title | claim where it differs | page type, settled by | measures shown, as recorded [and what the page shows of each] | insights it rests on):";

/** The spine critique: the request, the answer, the sections and a line per page - small, and at most ten items back. */
export function spinePrompt(packet) {
  return `You are the senior partner who signs a team's storyline off before a single slide is drawn: the spine - the request, the answer, the sections, the titles in order, and what each page claims, rests on and shows. You did not write it. Be exacting and fair: your job is to say whether it is ready to lay out and, where it is not, what would make it so. Judge from this packet alone: do not search the web or open other files.

This is pass 1 of at most ${packet.maxPasses ?? MAX_PASSES}. Return the items that matter, ${SPINE_ITEM_MAX} at most (FORM below); fewer is normal. Later passes verify them, and may add only a serious new problem on a part the team changed.
${revisionLines(packet)}${carriedLines(packet)}
${requestLines(packet)}
PLAYERS DECLARED: ${JSON.stringify((packet.players || []).map((p) => p?.name ?? p))}
REQUESTED LENGTH: ${packet.targetPages ? `${packet.targetPages}+ pages (the storyline has ${packet.totalPages}, ${packet.contentPages} of them content pages)` : `not fixed (the storyline has ${packet.totalPages} pages)`}
INSIGHT LOG: ${packet.insights?.present ? `${packet.insights.items.length} insights` : "none recorded"}${packet.insights?.problems?.length ? `; ${packet.insights.problems.length} problems: ${packet.insights.problems.slice(0, 8).join("; ")}${packet.insights.problems.length > 8 ? "; ..." : ""}` : ""}
DATA FOUND: ${packet.sources.length} files under sources/${packet.sources.length ? ` (${packet.sources.slice(0, 40).join(", ")}${packet.sources.length > 40 ? ", ..." : ""})` : ""}
${analysesLines(packet)}

SECTIONS (the pillars as drawn):
${sectionsLine(packet)}

${SPINE_HEADING}
${packet.pages.map((p) => marked(packet, compactLine(p), p)).join("\n")}
${reconcileLines(packet)}${limitsLine(packet)}
${CRITIC_STANDARDS}

${checksPrompt()}

${CALIBRATION}

Work through it in this order.
1. The spine alone: does it tell the story? Write \`spine\`.
2. The answer, on its check above: an answer, or a restatement or refusal of the request? In \`answer\`, write it as it should read - the team's own words where they already answer - and judge it part by part in \`answerParts\`.
3. The pillars, on their check above. For each in \`pillars\`: its pages, your verdict and a note on what holds it up or what it lacks.
4. The pages, from their lines, on every page check - and a title (a section's too) that claims more than the periods or members its pages show, a comparison with one member - each as a finding on its pages.
5. \`numbers\`: set every figure in a title or claim beside the measures recorded on its page and on each other page stating that quantity. \`sectionFlow\` and \`execSummary\`, a sentence or two each.
6. Missing analyses, each with \`public\` known or speculative; cut or merge.
7. Rate the storyline on the scale below and rank the top fixes (none, where nothing needs fixing).

${JUDGEMENT_RULES}

${ANSWER_RULES}

${itemRules({ cap: SPINE_ITEM_MAX })}

Set pass to 1 and verifies to null. Bind the review to ${packet.binding}. Return ONLY JSON matching the schema in ${packet.staging ? path.join(packet.staging, "schema.json") : "schema.json beside this prompt"}.`;
}

export function storylinePrompt(packet) {
  const split = packet.sections?.length ? `
THIS STORYLINE IS LONG (${packet.contentPages} content pages), so critique it in parallel where the harness can spawn subagents: give each prompt in the packet's sections/ folder (${packet.sections.map((s) => `${s.id}.md: ${s.pages.length} pages`).join("; ")}; spine.md for the spine checks) to its own fresh critic at the same time, save each JSON answer as parts/<id>.json beside it, then run \`node runtime/storyline.mjs merge <deck> <out>\`. Without subagents, work through this prompt alone.
` : "";
  return `You are the senior partner who signs a team's storyline off before a single slide is drawn - the problem-solving session where a story is tested before it is built. You did not write it. Be exacting and fair: your job is to say whether it is ready to lay out and, where it is not, what would make it so. Judge from this packet alone: do not search the web or open other files.

This is pass 1 of at most ${packet.maxPasses ?? MAX_PASSES}: every ${packet.revision ? "changed" : "content"} page gets a note on every page check, and every spine check is considered. Later passes verify your items and may add only a serious new problem on a page the team changed.
${split}${revisionLines(packet)}${carriedLines(packet)}
${requestLines(packet)}
PLAYERS DECLARED: ${JSON.stringify(packet.players)}
DATA THEY FOUND (files under sources/): ${packet.sources.length ? packet.sources.join(", ") : "none"}

REQUESTED LENGTH: ${packet.targetPages ? `${packet.targetPages}+ pages (the storyline has ${packet.totalPages}, ${packet.contentPages} of them content pages)` : `not fixed (the storyline has ${packet.totalPages} pages)`}
INSIGHT LOG (what the team extracted from the data before writing titles):
${packet.insights?.present ? packet.insights.items.map((i) => `- [${i.id}] (${i.strength ?? "ungraded"}) ${i.finding} — calc: ${i.calculation ?? "none"}; sources: ${i.sources.join(", ") || "none"}`).join("\n") || "- empty" : "- none recorded"}${packet.insights?.problems?.length ? `\nINSIGHT LOG PROBLEMS: ${packet.insights.problems.join("; ")}` : ""}
${analysesLines(packet)}

THE STORYLINE (title, page type, what settles the claim, the measures it shows with their recorded values, the insights it rests on; drafted exhibits and copy are the author's sketch):
${packet.pages.map((p) => marked(packet, spineLine(p), p)).join("\n")}
${reconcileLines(packet)}${limitsLine(packet)}
${CRITIC_STANDARDS}

${checksPrompt()}

${CALIBRATION}

Work through it in this order.

1. The spine alone. Read the titles without the pages: does it tell the story? Write \`spine\`.
2. The answer. Is it an answer to the request, or a restatement or refusal of it? Sharp enough to be wrong? In \`answer\`, write it as it should read - the team's own words where they already answer - and judge it part by part in \`answerParts\`.
3. The pillars. Are they distinct reasons that together prove the answer? For each pillar in \`pillars\`: its pages, your verdict (holds, weak, fails) and a note on what holds it up or what it lacks.
4. Every page, in order. The bar is a deck that feels important: every page carries evidence a reader could not have assembled in five minutes. Check the claim, the evidence shape (a measure of two values where the series exists, two or three members where the whole set exists, statements where a measure is needed), its sourcing against the insight log (the insight ids, their calculations, their sources), whether it restates the page before, and whether it states a consequence. Where pages carry a "page type:" line, judge whether the page type is the claim's reading task. Say what evidence each weak page should rest on and show instead.
5. Numbers across pages: the same figure with the same unit, base and period everywhere, totals that reconcile (\`numbers\`).
6. Section flow (\`sectionFlow\`) and the executive summary against the body and the close (\`execSummary\`).
7. Missing analyses: what a strong team would have run, why it matters to the answer, the public data behind it, and whether that data is \`public\` known or speculative.
8. Cut or merge: pages that repeat, preview or exist to reach a count, and what the freed pages should carry. Cut body pages where the argument is better without them; a surplus or weak page that still earns a lookup moves to the appendix, which counts toward the requested length.
9. Rate the storyline on the scale below and rank the top fixes (none, where nothing needs fixing).

${PAGE_RULES}

${JUDGEMENT_RULES}

${ANSWER_RULES}

${itemRules()}

Set pass to 1 and verifies to null. Bind the review to ${packet.binding}. Return ONLY JSON matching this schema: ${JSON.stringify(offeredSchema("full", null, { carried: (packet.carried || []).length > 0 }))}`;
}

export function storylineSectionPrompt(packet, section) {
  const pages = packet.pages.filter((p) => section.pages.includes(p.id));
  return `You are one of several senior critics reading a long storyline in parallel, before anything is drawn. Yours is section ${section.id}, "${section.title}": pages ${section.pages.join(", ")}. A spine critic takes the answer, pillars, numbers across pages, section flow, summary, missing analyses and cuts. Be exacting and fair; judge from this packet alone.

${requestLines(packet)}
THE WHOLE TITLE SPINE, for context:
${packet.pages.map((p) => `${p.n}. [${p.id}] ${p.title}`).join("\n")}

YOUR PAGES:
${pages.map(spineLine).join("\n")}

${CRITIC_STANDARDS}

${checksPrompt()}

${CALIBRATION}

Check every page check on every one of your pages.

${PAGE_RULES}

${itemRules()}
Name only pages in your section; leave the spine sections as short notes ("see the spine critic"). Rate your section on the scale: ${ratingScale({ capped: false })}.

Set part to ${JSON.stringify({ kind: "section", id: section.id, pages: section.pages })}. Bind to ${packet.binding}.
Return ONLY JSON matching this schema: ${JSON.stringify(offeredPart("section"))}`;
}

/** The spine critic of a long page-level critique: the compact spine, not the whole page listing again. */
export function storylineSpinePrompt(packet) {
  return `You are the spine critic of a long storyline read in parallel, before anything is drawn: section critics read every page. Be exacting and fair; judge from this packet alone: do not search the web or open other files.
${carriedLines(packet)}
${requestLines(packet)}
PLAYERS DECLARED: ${JSON.stringify((packet.players || []).map((p) => p?.name ?? p))}
REQUESTED LENGTH: ${packet.targetPages ? `${packet.targetPages}+ pages (the storyline has ${packet.totalPages}, ${packet.contentPages} of them content pages)` : `not fixed (the storyline has ${packet.totalPages} pages)`}

${analysesLines(packet)}

SECTIONS:
${sectionsLine(packet)}

${SPINE_HEADING}
${packet.pages.map(compactLine).join("\n")}
${reconcileLines(packet)}${limitsLine(packet)}
${CRITIC_STANDARDS}

${checksPrompt()}

${CALIBRATION}

You write the spine sections - \`spine\`, \`answer\`, \`answerParts\`, \`pillars\`, \`numbers\`, \`sectionFlow\`, \`execSummary\`, \`missingAnalyses\`, \`cutOrMerge\`, \`topFixes\` - and file spine findings listing every page they concern (${SPINE_CHECKS.join(", ")}). Leave \`pages\` empty. Your rating and summary become the critique's.

${JUDGEMENT_RULES}

${ANSWER_RULES}

${itemRules()}

Set part to ${JSON.stringify({ kind: "spine", id: "spine", pages: packet.pages.filter(isContent).map((p) => p.id) })}. Bind to ${packet.binding}.
Return ONLY JSON matching this schema: ${JSON.stringify(offeredPart("spine"))}`;
}

export function storylineVerificationPrompt(packet) {
  const { scope } = packet;
  const full = packet.mode === "full";
  const post = scope.postReview ?? null;
  // The pages whose argument moved since the pass this verifies, by id: what `artifact` may name for a finding fixed elsewhere.
  const movedIds = [...(scope.changed || []), ...(scope.deleted || []).map((id) => `${id} (deleted)`)];
  const read = packet.pages.filter((p) => (post ? post.pages : scope.mustInspect).includes(p.id));
  const changed = new Set(scope.changed);
  const opening = post?.origin === "compile"
    ? `You are verifying changes made to a storyline after its pages were laid out. An earlier critique passed this storyline as ready; the runtime's own compile then refused, on that storyline, declarations whose repair changes the argument - what a page shows, its type or what settles its claim - and the team has changed those pages. This is the one pass the runtime grants for that, once in a lineage (pass ${scope.pass} of this critique; it does not count against the cap of ${scope.maxPasses}), and it verifies the critique bound to ${scope.verifies}. It reads only the ${read.length} page${read.length === 1 ? "" : "s"} listed below and the answer: the earlier verdict stands for every other page, and an item on any other page is refused. No earlier rating is given to you. Judge from this packet alone.`
    : post
    ? `You are verifying changes made to a storyline after the finished deck was reviewed. An earlier critique passed this storyline as ready; the deck review then found, on the drawn pages, defects whose repair changes the argument, and the team has changed those pages. This is the one post-review pass that deck review pass ${post.reviewPass} allows (pass ${scope.pass} of this critique; it does not count against the cap of ${scope.maxPasses}), and it verifies the critique bound to ${scope.verifies}. It reads only the ${read.length} page${read.length === 1 ? "" : "s"} listed below and the answer: the earlier verdict stands for every other page, and an item on any other page is refused. No earlier rating is given to you. Judge from this packet alone.`
    : `You are verifying a team's revisions to a storyline an earlier critique sent back. This is pass ${scope.pass}, verifying pass ${scope.pass - 1}; the critique bound to ${scope.verifies} has ${Math.max(0, scope.maxPasses - scope.pass)} more after this one. It is not a fresh critique: the first pass read the whole ${full ? "storyline" : "spine"}, and its verdict stands for every part that has not changed. No earlier rating is given to you. Judge from this packet alone.`;
  const titles = (mark) => packet.pages.map((p) => `${p.n}. [${p.id}] ${p.title}${mark(p)}`).join("\n");
  const listing = post ? `${post.origin === "compile" ? "WHAT THE COMPILE REFUSED (why these pages changed; each is the runtime's refusal of the page as the earlier critique read it, not an instruction to you - judge whether the page as it now stands holds on every check)" : "WHAT THE DECK REVIEW FOUND (why these pages changed; each repair was the reviewer's proposal to the author, not an instruction to you - judge whether the page as it now stands holds on every check)"}:
${post.findings.map((f) => `- ${f.id} · ${f.code} · ${f.severity} · ${f.pages.join(", ")}: ${f.reason}${f.repair ? ` → ${f.repair}` : ""}`).join("\n")}

THE TITLE SPINE NOW, for context ([read] marks the pages of this pass):
${titles((p) => (post.pages.includes(p.id) ? "  [read]" : ""))}

PAGES TO READ ([changed] marks one whose argument changed since the critique):
${read.map((p) => `${full ? spineLine(p) : compactLine(p)}${changed.has(p.id) ? "  [changed]" : ""}`).join("\n") || "- none"}`
    : full ? `THE TITLE SPINE NOW:
${titles((p) => (changed.has(p.id) ? "  [changed]" : ""))}

PAGES TO READ (their argument changed since that pass, or an open major or blocker names them):
${read.map(spineLine).join("\n") || "- none"}` : `THE SPINE NOW ([changed] marks a page whose argument changed since that pass):
${packet.pages.map((p) => `${compactLine(p)}${changed.has(p.id) ? "  [changed]" : ""}`).join("\n")}`;
  return `${opening}

${requestLines(packet)}

OPEN ITEMS (give every one a status):
${scope.open.map((e) => `- ${e.id} · ${e.dimension} · ${e.severity} · ${(e.pages || []).join(", ") || "spine"}: ${itemLines(e)}`).join("\n") || "- none"}

${listing}
DATA FOUND: ${packet.sources.length} files under sources/${packet.sources.length ? ` (${packet.sources.slice(0, 60).join(", ")}${packet.sources.length > 60 ? ", ..." : ""})` : ""}
${analysesLines(packet)}
THE ANSWER ${scope.answerChanged ? "HAS CHANGED" : "HAS NOT CHANGED"} since the pass this verifies.
${reconcileLines(packet)}${limitsLine(packet)}
${CRITIC_STANDARDS}

${checksPrompt()}

Do three things.
1. STATUSES: for every open item, fixed, partly fixed, not fixed, regressed, narrowed, withdrawn, or - for a missing analysis only - unavailable or scope-limited, with the evidence in the packet. A partly fixed item keeps its severity.
   - "withdrawn" closes an item that was filed in error: the packet already showed what it said was missing, or it names no consequence for the decision. Its evidence quotes, in double quotes, the packet's line that shows it - ten words or more, as the packet prints them.
   - ${ANSWERS_RULE}
   - A finding is "fixed" only where the argument moved: a claim, a page type, what settles a claim, the insights or measures a page rests on and shows, which periods or members of a measure it shows and in what class of exhibit, the pages or their order, or the answer. A chart redrawn in another form or reworded copy on an unchanged argument closes nothing here. Where the pages the item names did not move and another did, set \`artifact\` to that page's id: ${movedIds.length ? `what moved since that pass is ${movedIds.join(", ")} (a section's divider is a page, by the id in brackets on its line)` : "no page moved since that pass"}.
   - A missing analysis is "fixed" only on its artifact: set \`artifact\` to the id of the computed analysis (listed above) or the insight that supplies it, which a page must rest on. A qualification on the page is not the analysis: where the page only says what the evidence does not establish, the item is not fixed.
   - "narrowed" closes an item the answer no longer needs because the answer now claims less; it is allowed only where the answer has changed, and its evidence quotes the narrower answer.
   - "unavailable" closes a missing analysis the team searched for and could not find, and needs \`searchLog\`: the path of the search log under sources/ (listed above) that shows the search. It is not available where the evidence scope is closed: nothing could be searched.
   - "scope-limited" is for a missing analysis whose remedy is retrieval while the evidence scope is closed: the team may not fetch the data. The item stays open at its severity, and the answer can at most be provisional.
2. ${full ? "PAGES: a full page entry for every page listed above, as the first pass wrote them." : "THE ANSWER: if the answer or the request changed, judge it again in `answerParts`."}
3. NEW ITEMS, only if additive: major or blocker, with \`basis\` ${Object.entries(NEW_BASES).map(([k, v]) => `${k} (${v})`).join("; ")}. A new minor item, an item on an unchanged page unless it is a missed major or blocker whose \`evidence\` quotes the packet's line for that page exactly (and a justification of why the first pass could not see it) are refused. An open item that still stands is that item's status, not a new item: a new item under an open item's check on a page it names is folded into the open item, which stays open, and is refused only where you also call that item fixed. New ids must be new; \`evidence\` is "" except for basis missed.${post ? " In this pass a new item names only the pages listed above." : ""} Then stop: the storyline is not re-critiqued.

${full ? PAGE_RULES : ""}

${CALIBRATION}

${JUDGEMENT_RULES}

${ANSWER_RULES}

${itemRules()}

Set pass to ${scope.pass} and verifies to "${scope.verifies}". Bind to ${packet.binding}.
Return ONLY JSON matching this schema: ${JSON.stringify(offeredSchema(packet.mode, scope))}`;
}

/**
 * The subset of JSON Schema the review schemas use, checked field by field.
 * A schema with `additionalProperties: false` refuses fields it does not name:
 * a critique is what its schema asks for and nothing else.
 */
function schemaErrors(value, schema, at) {
  const errors = [];
  const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  const types = [].concat(schema.type ?? []);
  if (types.length && !types.some((t) => t === kind || (t === "integer" && kind === "number" && Number.isInteger(value))))
    return [`${at} must be ${types.map((t) => (t === "object" ? "an object" : t === "null" ? "null" : `a ${t}`)).join(" or ")}`];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at} must be one of ${schema.enum.join(", ")}`);
  if (kind === "string") {
    if (schema.minLength && value.trim().length < schema.minLength) errors.push(`${at} must be at least ${schema.minLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at} is malformed`);
  }
  if (kind === "number" && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)))
    errors.push(`${at} must be between ${schema.minimum ?? "-"} and ${schema.maximum ?? "-"}`);
  if (kind === "array") {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${at} needs at least ${schema.minItems} item${schema.minItems === 1 ? "" : "s"}`);
    if (schema.items) value.forEach((item, i) => errors.push(...schemaErrors(item, schema.items, `${at}[${i}]`)));
  }
  if (kind === "object") {
    for (const key of schema.required || []) if (value[key] === undefined) errors.push(`${at} is missing \`${key}\``);
    if (schema.additionalProperties === false) {
      const extra = Object.keys(value).filter((key) => !(key in (schema.properties || {})));
      if (extra.length) errors.push(`${at} carries ${extra.map((k) => `\`${k}\``).join(", ")}, which the schema does not allow: return exactly the schema's fields`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) if (value[key] !== undefined) errors.push(...schemaErrors(value[key], sub, `${at}.${key}`));
  }
  return errors;
}

/** Every item of a critique in ledger form: its findings, missing analyses and cuts. */
export function storylineItems(review) {
  const items = [];
  for (const f of review?.findings || []) items.push({ id: f.id, code: `STORY_${String(f.check ?? "").toUpperCase()}`, dimension: f.check, scope: f.scope, severity: f.severity,
    pages: f.pages || [], reason: f.problem, repair: f.fix, ...(f.aboutImported ? { aboutImported: true } : {}), ...(f.basis ? { basis: f.basis, justification: f.justification, evidence: f.evidence } : {}) });
  for (const m of review?.missingAnalyses || []) items.push({ id: m.id, code: registered(STORYLINE_CODES, "MISSING_ANALYSIS"), dimension: "missing", scope: "spine", severity: m.severity, pages: [],
    reason: `${m.analysis}: ${m.why}`, repair: `Run it on ${m.data}`, public: m.public ?? null, remedy: m.remedy ?? null });
  for (const c of review?.cutOrMerge || []) items.push({ id: c.id, code: registered(STORYLINE_CODES, c.action === "cut" ? "CUT_PAGE" : "MERGE_PAGES"), dimension: "cuts", scope: "spine", severity: c.severity,
    pages: c.pages || [], reason: `${c.action} ${(c.pages || []).join(", ")}`, repair: c.freedUse });
  return items;
}

export const storylineLedger = (prior, review) => advanceLedger(prior, review, storylineItems(review));

function itemErrors(review, ids, own = null, { cap = null, limits = null, dividers = [], sectionFits = null } = {}) {
  const errors = [];
  const seen = new Set();
  const lists = [["findings", review.findings || []], ["missingAnalyses", review.missingAnalyses || []], ["cutOrMerge", review.cutOrMerge || []]];
  for (const [name, list] of lists) for (const [i, item] of list.entries()) {
    const at = `${name}[${i}]${item?.id ? ` (${item.id})` : ""}`;
    if (seen.has(item.id)) errors.push(`${at}: id ${item.id} is used twice`);
    seen.add(item.id);
    if (name === "findings") errors.push(...pageListErrors(at, { scope: item.scope, pages: item.pages, text: `${item.problem ?? ""} ${item.fix ?? ""}`, ids, deckScope: "spine", named: false }));
    // A fix that proposes a title the build would refuse sends the author into a refusal: held to the limits the packet showed (review-floors.mjs).
    if (name === "findings") errors.push(...titleErrors(item.fix, limits, at, { section: (item.pages || []).length > 0 && item.pages.every((id) => dividers.includes(id)),
      sectionFits: sectionFits ? (title) => sectionFits(title, (item.pages || []).filter((id) => dividers.includes(id))) : null }));
    if (name === "cutOrMerge") errors.push(...pageListErrors(at, { scope: "spine", pages: item.pages, text: item.freedUse, ids, deckScope: "spine", named: false }));
    // Only data the critic knows to be published can carry a major: a guess at
    // what might exist is a research question, not a defect of the storyline.
    // An analysis the team can run from the packet's own measures, or under a
    // stated assumption, needs no public source to matter.
    if (name === "missingAnalyses" && item.remedy === "retrieval" && item.public !== "known" && BLOCKING.has(item.severity)) errors.push(`${at}: only a retrieval on data known to be public can be ${item.severity}; name the public source and mark it known, lower it to minor, or - where the packet's own measures would settle it - mark its remedy computable`);
    if (own && name !== "missingAnalyses") {
      const outside = (item.pages || []).filter((id) => !own.includes(id));
      if (outside.length) errors.push(`${at}: names ${outside.join(", ")}, outside this section`);
    }
  }
  if (cap !== null && seen.size > cap) errors.push(`the spine critique returns at most ${cap} items (findings, missing analyses and cuts together); this one returns ${seen.size} - keep the ${cap} that most change whether the deck answers the request`);
  return errors;
}

function sourcingErrors(pages, ledger, insightIds) {
  const errors = [];
  const open = openEntries(ledger).filter((e) => e.dimension === "sourcing");
  for (const entry of pages || []) {
    const s = entry.sourcing || {};
    const unknown = insightIds ? (s.insights || []).filter((id) => !insightIds.has(id)) : [];
    if (unknown.length) errors.push(`pages ${entry.page}: sourcing names ${unknown.join(", ")}, which the insight log does not hold`);
    const naming = open.filter((e) => (e.pages || []).includes(entry.page));
    if (s.status === "unsupported" && !naming.some((e) => BLOCKING.has(e.severity))) errors.push(`pages ${entry.page}: an unsupported claim needs a major or blocker sourcing finding naming the page`);
    if (s.status === "partly" && !naming.length) errors.push(`pages ${entry.page}: a partly supported claim needs a sourcing finding naming the page`);
    if (s.status === "supported" && !(s.insights || []).length) errors.push(`pages ${entry.page}: a supported claim names the insights it rests on`);
  }
  return errors;
}

/**
 * The answer check, part by part: "cannot rank" names its decisive missing
 * evidence and is allowed once; a second, or any part declined, fails the
 * check - the critique cannot say ready, and a major or blocker answer
 * finding must say what the answer has to commit to.
 */
// Why the answer check fails, or null. A provisional answer does not pretend to rank what its evidence cannot: the parts it
// leaves unranked are its declared limits, not a refusal.
function answerFails(review, provisional) {
  const parts = Array.isArray(review.answerParts) ? review.answerParts : [];
  const unranked = parts.filter((p) => p?.verdict === "cannot rank").length, declined = parts.filter((p) => p?.verdict === "declined").length;
  if (!declined && (unranked <= 1 || provisional)) return null;
  return `${declined ? `${declined} part${declined === 1 ? "" : "s"} of the request declined` : ""}${declined && unranked > 1 ? " and " : ""}${unranked > 1 ? `${unranked} parts left unranked (once is allowed)` : ""}`;
}
function answerErrors(review, ledger, provisional) {
  const parts = review.answerParts;
  if (!Array.isArray(parts)) return [];
  const errors = [];
  for (const [i, part] of parts.entries()) if (part?.verdict === "cannot rank" && (typeof part.missingEvidence !== "string" || part.missingEvidence.trim().length < 20))
    errors.push(`answerParts[${i}]: "cannot rank" names the decisive missing evidence in missingEvidence, and why it decides "${part.part}"`);
  const why = answerFails(review, provisional);
  if (why && !openBlocking(ledger).some((e) => e.dimension === "answer")) errors.push(`the answer check fails (${why}): file a major or blocker \`answer\` finding saying what the answer must commit to, with its \`ifUnfixed\``);
  return errors;
}

/**
 * How an item closes, checked against what the packet holds. A missing
 * analysis is fixed on its artifact - a computed analysis or an insight a page
 * rests on - never on a qualification; `narrowed` needs an answer that changed;
 * `scope-limited` is a retrieval the closed scope forbids, and stays open.
 */
const QUOTE_WORDS = 10;
const squeeze = (text) => String(text ?? "").replace(/[\s"“”]+/g, " ").trim().toLowerCase();
/** Does `evidence` quote, in double quotes, QUOTE_WORDS words or more that the packet prints. */
function quotesPacket(evidence, pageText) {
  const said = squeeze(Object.values(pageText).join("\n"));
  return [...String(evidence ?? "").matchAll(/["“]([^"”]+)["”]/g)].some(([, quote]) => quote.trim().split(/\s+/).length >= QUOTE_WORDS && said.includes(squeeze(quote)));
}
function closureErrors(review, ledger, { analyses = [], insightIds = null, rested = new Set(), evidenceScope = null, answerChanged = false, artifacts = null, prior = null, moved = null, pageText = null } = {}) {
  const errors = [];
  // What stood, unchanged, at the pass that left the item open cannot be what closes it.
  const stale = (id) => Boolean(prior?.artifacts && prior?.rested && artifacts && prior.rested.includes(id) && prior.artifacts[id] !== undefined && prior.artifacts[id] === artifacts[id]);
  const computed = new Map((analyses || []).map((a) => [a.id, a]));
  for (const [i, s] of (review.statuses || []).entries()) {
    const entry = (ledger || []).find((e) => e.id === s?.finding);
    if (!entry) continue;
    const at = `statuses[${i}] (${s.finding})`;
    if (s.status === "fixed" && entry.code === "MISSING_ANALYSIS" && entry.remedy) {
      const artifact = typeof s.artifact === "string" ? s.artifact.trim() : "";
      const run = computed.get(artifact);
      if (!artifact) errors.push(`${at}: a missing analysis is fixed on its artifact - set \`artifact\` to the id of the computed analysis or the insight that supplies it. A qualification on the page is not the analysis`);
      else if (["computable", "assumption"].includes(entry.remedy) && !run) errors.push(`${at}: ${artifact} is not among the packet's computed analyses; a ${entry.remedy} analysis closes on the runtime's result, not on an insight written by hand`);
      else if (run && run.status === "unavailable") errors.push(`${at}: ${artifact} could not be run (${(run.missing || []).join(", ") || "an input is missing"}): the analysis is still missing`);
      else if (!run && insightIds && !insightIds.has(artifact)) errors.push(`${at}: ${artifact} is neither a computed analysis nor an insight in the packet`);
      else if (!rested.has(artifact)) errors.push(`${at}: no page rests on ${artifact}; an analysis that reaches no page has not changed the storyline`);
      else if (stale(artifact)) errors.push(`${at}: ${artifact} was already computed and rested on, unchanged, at the pass that left ${s.finding} open; an item closes on something that changed - a new analysis, a changed one, or a page that now rests on it`);
    }
    if (s.status === "fixed" && entry.code !== "MISSING_ANALYSIS" && moved) {
      // A finding is fixed where the argument moved (storyStructure): on a page it names, on the page the status names in `artifact`, or in the answer. A page redrawn or reworded has not moved.
      const where = [...(entry.pages || []), ...(typeof s.artifact === "string" && s.artifact.trim() ? [s.artifact.trim()] : [])];
      const touched = where.some((id) => moved.changed.includes(id) || moved.deleted.includes(id)) || (!(entry.pages || []).length && (moved.changed.length > 0 || moved.deleted.length > 0));
      if (!touched && !answerChanged) errors.push(`${at}: fixed, and ${(entry.pages || []).length ? `${entry.pages.join(", ")} ${entry.pages.length === 1 ? "is" : "are"}` : "the spine is"} as ${(entry.pages || []).length === 1 ? "it was" : "they were"} at the pass that filed ${s.finding}; where another page carries the repair, name it in \`artifact\` - a finding does not close on a storyline that did not move, and a page moves when its claim, its page type, what settles it, or the insights and measures it rests on change, not when it is redrawn or reworded`);
    }
    if (s.status === "narrowed" && !answerChanged) errors.push(`${at}: narrowed closes an item the answer no longer needs because it now claims less; the answer has not changed since the pass this verifies`);
    // An item filed in error is withdrawn on the packet's own words: a line it prints that shows the item was never so.
    if (s.status === "withdrawn" && pageText && !quotesPacket(s.evidence, pageText)) errors.push(`${at}: withdrawn closes an item filed in error, on the packet's own line: quote that line in double quotes in \`evidence\`, ${QUOTE_WORDS} words or more as the packet prints them`);
    if (s.status === "scope-limited") {
      if (entry.code !== "MISSING_ANALYSIS" || entry.remedy !== "retrieval") errors.push(`${at}: scope-limited is for a missing analysis whose remedy is retrieval; ${s.finding} is ${entry.code}${entry.remedy ? ` with remedy ${entry.remedy}` : ""} - the team can still act on it`);
      else if (evidenceScope?.retrieval !== "closed") errors.push(`${at}: the deck's evidence scope is open, so the data can be fetched: report the item as not fixed, or unavailable with its search log`);
    }
    if (s.status === "unavailable" && evidenceScope?.retrieval === "closed") errors.push(`${at}: the evidence scope is closed, so nothing was searched: a retrieval the scope forbids is scope-limited, and stays open`);
  }
  return errors;
}

// An open item the team cannot act on: a missing analysis whose data must be
// fetched, on a deck whose evidence scope is closed. It keeps its severity.
const limitedBy = (evidenceScope) => (entry) => entry.code === "MISSING_ANALYSIS" && entry.remedy === "retrieval" && evidenceScope?.retrieval === "closed";

/**
 * The verdict and the two judgements, read off the ledger they summarise
 * (`after`, the ledger with this pass applied) rather than asked of the
 * critic, so they cannot disagree with its items: ready when no major or
 * blocker is open and the answer check passes; provisional when every one open
 * is a retrieval the closed scope forbids and the deck offers its answer as
 * provisional; revise otherwise. Compliance is complete when nothing the team
 * can act on is open; sufficiency is sufficient when nothing is open. The
 * rating stays the critic's own: a second signal, never clamped to the items.
 * In a page-level pass each page's verdict is the worst open item naming it.
 */
export function withJudgements(review, after, { answerStatus = null, evidenceScope = null } = {}) {
  const scopeLimited = limitedBy(evidenceScope), open = openBlocking(after), doable = open.filter((e) => !scopeLimited(e));
  const provisional = answerStatus?.status === "provisional", failing = answerFails(review, provisional);
  const verdict = !open.length && !failing ? "ready" : !doable.length && provisional && !failing ? "provisional" : "revise";
  const names = (list) => list.map((e) => e.id).join(", ");
  const worst = (id) => { const naming = openEntries(after).filter((e) => (e.pages || []).includes(id)).map((e) => e.severity);
    return naming.includes("blocker") ? "blocker" : naming.includes("major") ? "major" : naming.includes("minor") ? "minor" : "ok"; };
  return { ...review, verdict,
    compliance: { verdict: doable.length ? "incomplete" : "complete", note: doable.length ? `open and within reach: ${names(doable)}` : "nothing open that the team can act on" },
    sufficiency: { verdict: !open.length ? "sufficient" : !doable.length && provisional ? "provisional" : "insufficient", note: open.length ? `open: ${names(open)}` : "nothing major or blocking open" },
    ...(Array.isArray(review.pages) ? { pages: review.pages.map((entry) => ({ ...entry, verdict: worst(entry.page) })) } : {}) };
}

/** A revision's first critique files items only where the revision is involved. */
function revisionItemErrors(items, changed) {
  return items.filter((item) => item.code !== "MISSING_ANALYSIS" && !(item.pages || []).some((id) => changed.includes(id)))
    .map((item) => `${item.id}: ${(item.pages || []).join(", ")} did not change in this revision; an item names a page the revision changed`);
}

/** An `unavailable` status closes only a missing analysis, with a search log under the deck's sources/. */
function unavailableErrors(review, ledger, sources) {
  const errors = [];
  for (const [i, s] of (review.statuses || []).entries()) {
    if (s?.status !== "unavailable") continue;
    const entry = (ledger || []).find((e) => e.id === s.finding);
    if (entry && entry.code !== "MISSING_ANALYSIS") errors.push(`statuses[${i}]: unavailable closes a missing analysis only; ${s.finding} is ${entry.code}`);
    const log = String(s.searchLog ?? "").replace(/^\.?\/?sources\//, "");
    if (!s.searchLog) errors.push(`statuses[${i}]: unavailable needs searchLog, the path of the search log under sources/ that shows the search`);
    else if (!(sources || []).includes(log)) errors.push(`statuses[${i}]: searchLog ${s.searchLog} is not a file under the deck's sources/; record the search there first`);
  }
  return errors;
}

/**
 * Validate a critique against the argument it read: `ids` every page of that
 * spine, `contentIds` the pages the first pass must cover, `scope` and
 * `ledger` for a later pass, `mode` spine or full, `sources` the files under
 * the deck's sources/, `pageText` what a missed item's quote is checked
 * against and `promptHash` the packet's (its provenance is checked when given).
 */
export function validateStorylineRecord(review, { ids, contentIds, scope = null, ledger = [], insightIds = null, mode = "full", sources = [], pageText = null, promptHash, revision = null,
  analyses = [], rested = new Set(), evidenceScope = null, answerStatus = null, artifacts = null, carried = [], limits = null, dividers = [], sectionFits = null, untouched = null } = {}) {
  if (!review || typeof review !== "object") return ["storyline-review.json is missing: run the storyline critique (references/storylining.md#stress-test-the-storyline)"];
  // The whole record, not just the verdict: a truncated or hand-written
  // `{ verdict: "ready", binding }` is not a critique.
  const structure = schemaErrors(review, schemaFor(mode, scope), "storyline review");
  if (structure.length) return structure;
  const errors = itemErrors(review, ids, null, { cap: mode === "spine" ? SPINE_ITEM_MAX : null, limits, dividers, sectionFits });
  if (promptHash !== undefined) errors.push(...provenanceErrors(review, promptHash));
  const items = storylineItems(review);
  errors.push(...aboutImportedErrors((review.findings || []).map((f) => ({ id: f.id, pages: f.pages || [], aboutImported: f.aboutImported })), untouched));
  if (scope) {
    errors.push(...verificationErrors(review, { scope: mode === "full" ? scope : { ...scope, mustInspect: [] }, ledger, items, ids, pageKey: "page", deckScope: "spine", statuses: STORYLINE_STATUSES, pageText }));
    errors.push(...unavailableErrors(review, ledger, sources));
    // A post-review pass reads the pages its deck review named, and files nothing elsewhere.
    // An item there may list another page beside one it reads (a figure two pages disagree on), but not stand wholly outside them.
    if (scope.postReview) for (const item of items) {
      if (!(item.pages || []).length || item.pages.some((id) => scope.postReview.pages.includes(id))) continue;
      errors.push(`${item.id}: this is ${scope.postReview.origin === "compile" ? "the pass a compile refusal allowed" : "a post-review pass"}, which reads ${scope.postReview.pages.join(", ")} and the answer only; ${item.pages.join(", ")} ${item.pages.length === 1 ? "is" : "are"} outside it - the earlier critique's verdict stands there`);
    }
    errors.push(...closureErrors(review, ledger, { analyses, insightIds, rested, evidenceScope, answerChanged: Boolean(scope.answerChanged), artifacts, prior: scope.prior ?? null, pageText,
      moved: Array.isArray(scope.changed) && Array.isArray(scope.deleted) ? { changed: scope.changed, deleted: scope.deleted } : null }));
  } else {
    if (mode === "full") errors.push(...coverageErrors(review.pages, revision ? revision.changed : contentIds, "page"));
    if (revision) errors.push(...revisionItemErrors(items, revision.changed));
    errors.push(...carriedErrors(review, carried, items.map((item) => item.id)));
    for (const [i, pillar] of review.pillars.entries()) {
      const unknown = pillar.pages.filter((id) => !ids.includes(id));
      if (unknown.length) errors.push(`pillars[${i}]: unknown page${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`);
    }
  }
  const after = storylineLedger(scope ? ledger : [], review);
  if (mode === "full") errors.push(...sourcingErrors(review.pages, after, insightIds));
  errors.push(...answerErrors(review, after, answerStatus?.status === "provisional"));
  return errors;
}

// The critique is written by another agent: an answer that does not parse is
// an invalid answer, said as such (`invalid`), never a crash.
async function readCritique(file) {
  try { return { review: await readJson(file, { optional: true }) }; }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { review: null, invalid: `the critique is not valid JSON (${error.message}): have the critic write its answer again` };
  }
}
/**
 * A critic's answer, read as the loop reads it against its packet's context (packetContext): its page lists
 * settled and a blocking item with no stake recorded as minor
 * (settleCritiqueForm), validated against the packet, and its verdict and
 * judgements read off the ledger (withJudgements). `{ review, errors,
 * mended, ledger }`; `review` is the answer as recorded, where `errors` is
 * empty. The calibration harness reads answers through this too, so what it
 * measures is what the loop records.
 */
export function judgeCritique(answer, context) {
  const settled = settleCritiqueForm(answer, context.ids, context.contentIds ?? context.ids);
  // A later pass adds only blocking findings. A minor point filed anyway is left out and said, not refused: refused, the
  // whole answer went back to its critic for one stray line, and its judgement came back the same. One that restates an open
  // finding stays, since the ledger folds it into that finding.
  if (context.scope && Array.isArray(settled.review?.findings)) {
    const open = openEntries(context.ledger ?? []);
    settled.review.findings = settled.review.findings.filter((item, i) => {
      if (!item || typeof item !== "object" || BLOCKING.has(item.severity)) return true;
      const code = `STORY_${String(item.check ?? "").toUpperCase()}`;
      if (open.some((e) => e.code === code && (e.pages || []).some((id) => (item.pages || []).includes(id)))) return true;
      settled.mended.push({ at: `findings[${i}]${item.id ? ` (${item.id})` : ""}`, did: "dropped", was: item.severity, pages: item.pages || [] });
      return false;
    });
  }
  const errors = validateStorylineRecord(settled.review, context);
  if (errors.length) return { review: null, errors, mended: settled.mended, ledger: null };
  const ledger = storylineLedger(context.scope ? context.ledger : [], settled.review);
  return { review: withJudgements(settled.review, ledger, { answerStatus: context.answerStatus ?? null, evidenceScope: context.evidenceScope ?? null }), errors: [], mended: settled.mended, ledger };
}
export const packetContext = (packet) => ({
  ids: packet.pages.map((p) => p.id), contentIds: packet.pages.filter(isContent).map((p) => p.id), scope: packet.scope ?? null, ledger: packet.scope?.ledger ?? [],
  insightIds: packet.insights?.present ? new Set(packet.insights.items.map((i) => i.id)) : null, mode: packet.mode ?? "full", sources: packet.sources ?? [],
  pageText: packetPageText(packet), promptHash: packet.promptHash ?? null, revision: packet.revision ?? null,
  analyses: packet.analyses ?? [], rested: new Set(packet.pages.flatMap((p) => (p.evidence || []).filter((e) => !e.missing).map((e) => e.id))),
  evidenceScope: packet.evidenceScope ?? null, answerStatus: packet.answerStatus ?? null, artifacts: packet.artifacts ?? null, carried: packet.carried ?? [],
  limits: packet.limits ?? null, dividers: packet.pages.filter((p) => p.kind === "section").map((p) => p.id),
  // The slides a revision carries and did not edit: what a finding about the imported deck names. Null for a deck that carries none.
  untouched: packet.pages.some((p) => p.kind === "carried") ? packet.pages.filter((p) => p.kind === "carried" && !p.edited).map((p) => p.id) : null,
});

/**
 * The storyline gate's judgement of a critique for a spec: it validates
 * against where it came from, is bound to the argument as it stands now
 * (`measures`: the log's recorded measures, where the deck has a log), and says
 * ready with no major or blocker item open across its passes. `record` is its
 * recorded pass in the lineage store, which was validated when it was recorded
 * and whose review and ledger - not the editable file - say what it
 * concluded; `packet` is the packet it answers. With neither, it is checked
 * as a first pass over the spec (the pure check the tests use; the gate never
 * passes a critique that has neither), in the mode its shape says.
 */
export function validateStorylineReview(review, spec, { record = null, packet = null, measures = null } = {}) {
  if (!review || typeof review !== "object") return ["storyline-review.json is missing: run the storyline critique (node runtime/storyline.mjs <id>.deck.json out/) and bring it to ready before the deck review"];
  const structure = storyStructure(spec);
  // A recorded pass was judged when it was recorded; an answer not yet recorded is read as the loop would read it.
  const read = record ? null : judgeCritique(review, packet ? packetContext(packet)
    : { ids: structure.map((p) => p.id), contentIds: structure.filter(isContent).map((p) => p.id), mode: Array.isArray(review.pages) ? "full" : "spine", answerStatus: answerStatusOf(spec), evidenceScope: evidenceScopeOf(spec) });
  const judged = record?.review ?? read.review ?? review;
  const errors = record ? [] : [...read.errors];
  if (judged.binding !== storylineBinding(spec, measures)) {
    const was = record?.pageHashes ?? packet?.pageHashes;
    const moved = was ? changedPages(was, storylinePageHashes(spec, measures)) : null;
    const which = moved ? [...moved.changed, ...moved.deleted.map((id) => `${id} deleted`)] : [];
    // The binding holds the argument only, so this is never a layout or copy edit: say so, since the author's next step differs.
    errors.push(`the spine changed after the storyline critique${which.length ? ` (${which.join(", ")}: a title, a page type, what settles a claim, the insights and measures a page rests on and shows, or which periods or members of a measure the page shows and whether it plots, tabulates or states them)` : " (the answer, the request or the order of the pages)"}: re-run the storyline critique first - node runtime/storyline.mjs <id>.deck.json out/ writes the verification pass for what changed - and bring it back to ready before the deck review. Copy edits and a chart redrawn in another chart form do not change the spine`);
  }
  if (judged.verdict === "provisional") {
    // A provisional storyline passes the gate as provisional, never as ready:
    // every open item is one the evidence scope forbids, and the deck says so.
    const ledger = record?.ledger ?? read.ledger ?? storylineLedger(packet?.scope?.ledger ?? [], review);
    const doable = openBlocking(ledger).filter((e) => !limitedBy(evidenceScopeOf(spec))(e));
    if (doable.length) errors.push(`the storyline critique says provisional but ${doable.map((e) => `${e.id} (${e.severity})`).join(", ")} ${doable.length === 1 ? "is" : "are"} still open and within reach`);
    if (answerStatusOf(spec).status !== "provisional") errors.push("the storyline critique says provisional but the deck offers its answer as final: set `answerStatus: \"provisional\"` with its `answerLimits`");
  } else if (judged.verdict !== "ready") errors.push(`the storyline critique says revise (${judged.rating ?? "?"}/10): revise the storyline, re-run the critique and bring it to ready before the deck review${(judged.topFixes || []).length ? ` - ${judged.topFixes.slice(0, 3).join("; ")}` : ""}`);
  else if (!errors.length) {
    const open = openBlocking(record?.ledger ?? read.ledger ?? storylineLedger(packet?.scope?.ledger ?? [], review));
    if (open.length) errors.push(`the storyline critique says ready but ${open.map((e) => `${e.id} (${e.severity})`).join(", ")} ${open.length === 1 ? "is" : "are"} still open`);
  }
  return errors;
}

/**
 * The storyline gate the deck review waits for (validateStorylineReview). It
 * reads the deck's lineage store: the latest recorded pass, or a critique in
 * out/storyline-review.json that answers the latest packet and is not yet
 * recorded. A storyline-review.json written by hand answers neither, and
 * accepting it would also reset the loop's pass cap. An argument edited after
 * the critique names its changed pages and sends the author back to the
 * critique before any deck review is prepared or accepted; a page laid out,
 * redrawn or reworded on the same argument passes. `deckPath` locates the store
 * beside the deck file; without it the deck is looked for beside `directory`.
 */
export async function storylineGate(spec, directory, { deckPath = null } = {}) {
  if (spec?.purpose === "catalogue") return [];
  const request = requestErrors(spec);
  if (request.length) return request;
  const store = await lineageStore(spec, directory, deckPath);
  const history = await readStorylineHistory(store);
  const deck = await locateDeck(spec, directory, deckPath);
  // A revision whose spine is the user's own needs no critique - and a lineage recorded under another binding version, which
  // cannot be compared with today's spine, does not ask one of it: there is nothing of the revision's for a critic to read.
  if ((!history.length || bindingVersionOf(history.at(-1)) !== BINDING_VERSION) && (await unchangedRevision(spec, deck))) return [];
  const measures = await readMeasures(spec, deck);
  const packet = await readJson(path.join(store, PACKET_RECORD), { optional: true });
  const { review, invalid } = await readCritique(path.join(directory, "storyline-review.json"));
  if (invalid) return [invalid];
  const recorded = review ? history.find((h) => h.binding === review.binding && h.pass === review.pass) : null;
  if (review && !recorded && packet && bindingVersionOf(packet) === BINDING_VERSION && packet.binding === review.binding && packet.pass === review.pass) {
    // Read as the loop will read it: with its page lists settled.
    const context = packetContext(packet);
    return validateStorylineReview(settleCritiqueForm(review, context.ids, context.contentIds).review, spec, { packet, measures });
  }
  const latest = history.at(-1);
  if (latest && bindingVersionOf(latest) !== BINDING_VERSION) return [staleLineage(latest, history.length)];
  if (latest) return validateStorylineReview(latest.review, spec, { record: latest, measures });
  if (review) return [`storyline-review.json answers no packet this deck's storyline loop wrote and is in no recorded pass: run node runtime/storyline.mjs <id>.deck.json out/, give its prompt to a fresh critic and save that answer - a critique that did not answer the packet is not a gate`];
  return validateStorylineReview(null, spec);
}

/**
 * How the storyline loop stands for delivery to record: `provisional` with the
 * open items the evidence scope forbids and the limits the answer declares, so
 * a deck delivered on a provisional storyline says so; otherwise the latest
 * verdict alone.
 */
export async function storylineOutcome(spec, directory, { deckPath = null } = {}) {
  const latest = (await readStorylineHistory(await lineageStore(spec, directory, deckPath))).at(-1);
  // What the critic said of the imported deck goes with the outcome whatever the verdict: delivery reports it to the user.
  const aboutImported = openAboutImported(latest?.ledger).map((e) => ({ id: e.id, from: "storyline critique", severity: e.severity, pages: e.pages || [], reason: reasonOf(e), repair: e.repair ?? null }));
  if (latest?.review?.verdict !== "provisional") return { verdict: latest?.review?.verdict ?? null, aboutImported };
  return { verdict: "provisional", aboutImported, open: openBlocking(latest.ledger).map((e) => ({ id: e.id, severity: e.severity, reason: reasonOf(e) })), answerLimits: answerStatusOf(spec).limits };
}

// What is said of a lineage recorded under another binding version, by the gate and by the loop that retires it.
const staleLineage = (latest, passes) => `the storyline critique on record (${passes} pass${passes === 1 ? "" : "es"}, the last one ${latest.review?.verdict ?? "unreadable"}) was recorded under binding version ${bindingVersionOf(latest)}, and what a page shows of each measure is read differently now (version ${BINDING_VERSION}), so it cannot say which pages changed since: run node runtime/storyline.mjs <id>.deck.json out/, which archives that lineage and writes a first pass - not a restart, and not counted against the pass cap`;

// A revision that leaves the user's spine as it was - every page's title,
// order and source slide - needs no storyline critique: the argument is the
// user's, unchanged.
const unchangedRevision = async (spec, deckPath) => {
  const changes = revisionChanges(spec, await readInventory(spec, deckPath));
  return Boolean(changes && !changes.spineChanged);
};

/**
 * The gate as a warning, for the steps before delivery that do not enforce
 * it - a full compile of the copy (author-deck) and the build: the copy and
 * the pages can be drafted and checked, but they are written against a spine
 * the critique has not passed, and delivery refuses the deck until it has.
 * Null when the gate is ready.
 */
export async function storylineWarning(spec, directory, { deckPath = null } = {}) {
  const errors = await storylineGate(spec, directory, { deckPath });
  return errors.length ? `Warning: the storyline gate is not ready for ${directory} - ${errors[0]}${errors.length > 1 ? ` (and ${errors.length - 1} more)` : ""}. Copy written now is written against a spine the critique has not passed; delivery refuses the deck until the gate is ready.` : null;
}

/**
 * The storyline as the critique closed it, held through the layout. Once the
 * critique has closed - its latest pass says ready or provisional, or its own
 * passes are spent - an edit that moves what it is bound to cannot be read
 * without a pass the deck may not have: a fresh one where it is ready, one past
 * the cap, which only the user grants, where it is spent. A layout written by
 * hand or by a helper moved eight such pages of one deck after its last pass,
 * and delivery then refused the whole deck. So the compile refuses the edit
 * where it is made (author-deck.mjs SPINE_LOCKED), naming the pages, and an
 * author who means the change says so (`--reopen-spine`) and takes the deck
 * back to the critique. `{ closed, verdict, pass, spent, pages, deleted }`, or
 * null when the critique is still open or nothing it read has moved.
 */
export async function spineLock(spec, directory, { deckPath = null, maxPasses = MAX_PASSES } = {}) {
  if (spec?.purpose === "catalogue") return null;
  const history = await readStorylineHistory(await lineageStore(spec, directory, deckPath));
  const latest = history.at(-1);
  if (!latest || bindingVersionOf(latest) !== BINDING_VERSION) return null;
  const spent = history.filter((h) => ![POST_REVIEW, COMPILE_REFUSAL].includes(h.kind)).length;
  const verdict = latest.review?.verdict ?? null;
  const closed = ["ready", "provisional"].includes(verdict) ? verdict : spent >= maxPasses ? "spent" : null;
  if (!closed) return null;
  const measures = await readMeasures(spec, await locateDeck(spec, directory, deckPath));
  if (latest.binding === storylineBinding(spec, measures)) return null;
  const moved = changedPages(latest.pageHashes, storylinePageHashes(spec, measures));
  return { closed, verdict, pass: latest.pass, spent, pages: moved ? [...moved.changed, ...moved.deleted] : [], deleted: moved?.deleted ?? [] };
}

// The repair path after the deck review. A deck review reads the drawn pages
// and can find the argument wanting where the critique passed it; most such
// repairs change a bound fact, and by then the critique's passes are usually
// spent. So each rejected deck-review pass grants one storyline verification
// pass of its own, outside the critique's cap. It is narrow by construction:
// it reads only the pages that pass's open findings name whose repair reaches
// the argument (repairReach), and the answer; every page whose argument moved
// must be one of them; and a further change after it is an ordinary pass,
// counted against the cap. No cap is raised: the deck review's own cap bounds
// how many of these a lineage can ever be granted.
// How such a pass is marked in the lineage (`kind` on its record), so it is never counted as one of the critique's own.
const POST_REVIEW = "post-review";
export const POST_REVIEW_RULE = "each rejected deck-review pass allows one storyline verification pass that does not count against the critique's cap: it reads only the pages named by that pass's open findings whose repair reopens the argument, and the answer; it is refused where a page outside them changed, and a second change after it counts against the cap";

// The other pass outside the cap: where the runtime's own full compile raises, on the storyline a critique passed as ready,
// a finding every repair of which changes what the critique is bound to, and the runtime's own draft of the same pages does
// not raise it. A draft is the full compile of the spine, so the two cannot disagree about a bound fact by design; this is
// what holds if they ever do, since the cost of the runtime's own disagreement with itself must not be the author's whole
// deck. It is granted on the compile's record and on nothing an author says or does: the compile writes the record itself,
// only when every page it read carries the hash the ready pass recorded, and only for what its draft of those pages passed
// (recordCompileRefusal). Once in a lineage; the pass reads the refused pages and the answer and nothing else, is shown the
// refusals, and is not granted where any other page moved.
//
// A page the page compile refuses never earns it. Whether such a refusal's repair writes a bound field cannot be read off
// the refusal - a ninth callout, a key the composer does not read and an exhibit not written yet are refused by the same
// steps that refuse an exhibit's type - and a pass granted on the step alone was one any author could earn by adding a
// callout. Nor does it need to: a page the draft passes has a witness (spine-witness.mjs), a layout of it the page compile
// takes that binds as the spine does, so what the compile refuses of that page is mended by laying it out as the witness is.
const COMPILE_REFUSAL = "compile-refusal";
const COMPILE_REFUSAL_RECORD = "compile-refusal.json";
export const COMPILE_REFUSAL_RULE = "a full compile that raises, on the storyline a critique passed as ready, a finding whose every repair changes what the critique is bound to, where the runtime's own draft of the same pages raised none, allows one storyline verification pass that does not count against the critique's cap, once in a lineage: it reads only the pages of those findings and the answer, is shown them, and is refused where a page outside them changed";

/**
 * Record that the full compile refused bound facts of the ready storyline that
 * its draft passed, in the deck's lineage store; returns the record, or null
 * where there is nothing to record. Called by the compile itself
 * (author-deck.mjs) with what it found: `spec` the compiled deck, `refused`
 * the pages its page compile refused (`{ id, record }`, `record` what the page
 * declares: its type, what settles it and each exhibit as written), `findings`
 * its blocking findings, `measures` the log's recorded measures, and
 * `drafted`, which runs the draft of the same pages and returns its blocking
 * findings (called only where there is something a record could hold).
 *
 * The record is written only when the deck is still the storyline the latest
 * pass called ready - every page, a refused one by its record, hashing as that
 * pass recorded it - and holds only findings every repair of which writes a
 * bound field (their code lists no copy, layout or fit repair,
 * gates/gate_classes.mjs), on a page of that storyline, that the draft of the
 * same pages does not raise on that page.
 */
export async function recordCompileRefusal(specPath, { spec, refused = [], findings = [], measures = null, drafted = async () => [] }) {
  const store = await lineageStore(spec, path.dirname(path.resolve(specPath)), specPath);
  const latest = (await readPasses(path.join(store, HISTORY))).at(-1);
  if (!latest || bindingVersionOf(latest) !== BINDING_VERSION || !["ready", "provisional"].includes(latest.review?.verdict)) return null;
  const records = refused.filter((f) => f.record).map((f) => f.record);
  const moved = changedPages(latest.pageHashes, storylinePageHashes({ ...spec, slides: [...(spec.slides || []), ...records] }, measures));
  if (!moved || moved.changed.length || moved.deleted.length) return null;
  const pageOf = (f) => (f.id === undefined || f.id === null ? null : String(f.id));
  const candidates = findings.filter((f) => f.code !== "COMPILE" && pageOf(f) && Object.hasOwn(latest.pageHashes, pageOf(f)) && boundOnly(f));
  if (!candidates.length) return null;
  // What the draft of the same pages says: a finding it raises too is no disagreement of the runtime with itself.
  const said = new Set((await drafted()).map((f) => `${f.code}\u0000${pageOf(f)}`));
  const bound = candidates.filter((f) => !said.has(`${f.code}\u0000${pageOf(f)}`)).map((f) => ({ id: pageOf(f), code: f.code, reason: String(f.repair ?? f.reason ?? "") }));
  if (!bound.length) return null;
  const record = { binding: latest.binding, pass: latest.pass, pages: [...new Set(bound.map((f) => f.id))], findings: bound, recordedAt: new Date().toISOString() };
  await writeJson(path.join(store, COMPILE_REFUSAL_RECORD), record);
  return record;
}
/** Whether every repair of a finding writes a field the critique is bound to: its code lists repairs, and none of them is the copy's, the layout's or the fit's. */
const boundOnly = (finding) => { const { touches, settledLater } = repairOf(finding); return touches.length > 0 && settledLater === null; };

/**
 * The compile-refusal pass a lineage may take now, or why it may not:
 * `{ grant }` in the shape of a post-review grant (its pages, and the refusals
 * as the findings the critic is shown) or `{ why }`. `record` is what the
 * compile wrote (recordCompileRefusal), `latest` the pass being verified and
 * `moved` the pages whose argument changed or were deleted since it.
 */
function compileRefusalPass(history, record, latest, moved) {
  if (!record || !Array.isArray(record.pages) || !Array.isArray(record.findings)) return { why: "no full compile of this deck has raised, on the storyline the critique passed as ready, a finding whose every repair changes what the critique is bound to and that its draft of the same pages passed" };
  if (history.some((h) => h.kind === COMPILE_REFUSAL)) return { why: "the one pass a compile refusal allows in a lineage is spent" };
  if (record.binding !== latest.binding) return { why: "the compile's refusal on record was of another storyline than the one the latest pass read" };
  const changed = [...moved.changed, ...moved.deleted];
  const outside = changed.filter((id) => !record.pages.includes(id));
  if (outside.length) return { why: `${outside.join(", ")} changed, and the compile refused nothing bound on ${outside.length === 1 ? "it" : "them"} (it refused ${record.pages.join(", ")})` };
  if (!changed.length) return { why: "no page the compile refused has changed" };
  return { grant: { key: `compile:${record.binding}`, origin: "compile", reviewPass: null, pages: record.pages,
    findings: record.findings.map((f, at) => ({ id: `R${at + 1}`, code: f.code, severity: "blocker", pages: [f.id], reason: f.reason, repair: "", reach: "argument" })) } };
}

/**
 * The post-review pass a lineage may take now, or why it may not: `{ grant }`
 * - the deck-review pass that allows it, its findings that reach the argument
 * and the pages they name - or `{ why }`. `history` is the storyline passes,
 * `reviews` and `confirmations` the deck review's, `moved` the pages whose
 * argument changed or were deleted since the latest storyline pass.
 */
function postReviewPass(history, reviews, confirmations, moved, revised = null) {
  const review = reviews.at(-1);
  if (!review) return { why: "no deck review has read this deck yet, and the pass exists only to verify what one sent back" };
  const refused = confirmations.filter((c) => c.afterPass === review.pass && c.accepted !== true).at(-1) ?? null;
  if (review.accepted === true && !refused) return { why: `deck review pass ${review.pass} accepted the deck: nothing it sent back is open` };
  const key = refused ? `confirmation:${refused.binding}` : review.binding;
  if (history.some((h) => h.postReview?.key === key)) return { why: `the one post-review pass deck review pass ${review.pass} allows is spent` };
  // What that pass left open: its ledger, and the findings of a confirmation read that refused it.
  const ledger = [...(review.ledger || []), ...(refused?.review?.findings || []).map((f) => ({ ...f, pages: f.slides || [], status: "open" }))];
  const reach = openEntries(ledger).filter((e) => repairReach(e) !== "layout");
  // A revision is judged on what it changes: a page of the imported deck it leaves as it was is the user's, and no finding sends it to the critic.
  const own = (id) => !revised || revised.restyle || revised.content.includes(id);
  const reaching = reach.filter((e) => (e.pages || []).some(own));
  const pages = [...new Set(reaching.flatMap((e) => e.pages || []))].filter(own);
  if (reach.length && !pages.length) return { why: `the open findings of deck review pass ${review.pass} whose repair reaches the argument name only pages of the imported deck this revision leaves unchanged (${[...new Set(reach.flatMap((e) => e.pages || []))].join(", ")}): they are about the user's deck as it stands and oblige no storyline pass` };
  if (!pages.length) return { why: `no open finding of deck review pass ${review.pass} has a repair that reaches the argument` };
  const outside = [...moved.changed, ...moved.deleted].filter((id) => !pages.includes(id));
  if (outside.length) return { why: `${outside.join(", ")} changed, and no open finding of deck review pass ${review.pass} whose repair reaches the argument names ${outside.length === 1 ? "it" : "them"} (it names ${pages.join(", ")})` };
  return { grant: { key, reviewPass: review.pass, pages, findings: reaching.map((e) => ({ id: e.id, code: e.code, severity: e.severity, pages: (e.pages || []).filter(own), reason: reasonOf(e), repair: e.repair ?? "", reach: repairReach(e) })) } };
}

/**
 * One step of the storyline loop. Records a returned critique (validated
 * against the packet it answered) in the lineage store, then says where the
 * loop stands: ready for this spine; revise (the spine has not changed since
 * the critique); capped; refused; or a new packet - the first pass, or a
 * verification of what changed since the last one. `mode` continues the
 * lineage's mode when not given (spine for a new lineage); a different mode
 * starts a new lineage (restartLineage), which needs `reason` and, the second
 * time, `userApproved`.
 */
/**
 * A critique refused for its form is moved aside (`storyline-review.refused.json`,
 * the last one kept), so the corrected answer is written to a path that holds
 * no file: a critic whose tools may create a file and not overwrite one can
 * answer a correction round. Returns the path, or null where nothing was moved.
 */
async function setAside(out) {
  const from = path.join(out, "storyline-review.json"), to = path.join(out, "storyline-review.refused.json");
  try { await fs.rename(from, to); return to; } catch { return null; }
}
const refusedForm = async (out, errors) => { const kept = await setAside(out);
  return { status: "invalid", errors, ...(kept ? { refused: kept, note: `The refused answer was moved to ${kept}: have the critic correct what the errors name and save the corrected answer as ${path.join(out, "storyline-review.json")}, which is free to write` } : {}) }; };

/**
 * Advance the storyline loop one step (see the file header): read a critique
 * waiting in the output directory, settle and validate its form, record it,
 * and say what comes next. Whatever the runtime settled of the critique's page
 * lists is on the pass's record and in the result (`formMended`).
 */
export async function prepareStoryline(specPath, outputDirectory, options = {}) {
  const said = { mended: [...(options.formMended ?? [])] };
  const step = await advanceStoryline(specPath, outputDirectory, options, said);
  return said.mended.length && step && typeof step === "object" ? { ...step, formMended: mendedLines(said.mended) } : step;
}
// What closes a missing analysis, by its remedy: the artifact a verification pass reads it `fixed` on (STATUS: `fixed` needs
// `artifact`), or the search a pass reads it `unavailable` on.
const RESEARCH_CLOSES = Object.freeze({
  computable: "compute it from data the log already holds: an analysis in <id>.analysis.json whose result a page rests on",
  retrieval: "find the data: its source file under sources/, an insight in <id>.insights.json recording its measures, and a page resting on it - or, where it cannot be had, the searches made (`unavailable` with its search log)",
  assumption: "state it as an assumption: an insight with `status: \"assumed\"` and the basis for the figure, and a page that rests on it and says so",
});
const RESEARCH_FILE = "research-tasks.json";

/**
 * The research the critique asks for, as tasks the author works through
 * before the next pass, in three kinds:
 * - `analysis`: each missing analysis the critic filed and no pass has closed,
 *   with what it is, why it matters, the data it runs on, its remedy and what
 *   closes it;
 * - `revision`: each open blocking finding, with the fix the critic named - an
 *   item like "build the path year by year from the recorded orders" is
 *   analysis work too, though it was filed as a finding;
 * - `depth`: where the deck's chart pages plot fewer values than strong decks'
 *   (EVIDENCE_DEPTH's target), its thinnest pages, each a peer set, a second
 *   series or a longer window short.
 * Blocking ones first. A critic's missing analysis used to reach the author as
 * an id and a severity, and the findings that needed analysis not even that: a
 * deck went to its cap with its evidence as thin as it began. Written beside
 * the critique on every pass that leaves one open (`research-tasks.json`), and
 * returned with the run's result.
 */
// The page types whose chart plots as many values as its subject has parts or steps.
const THIN_BY_FORM = new Set(["composition", "bridge"]);

export function researchTasks(history, ledger, spec = null) {
  const filed = new Map(), found = new Map();
  for (const pass of history) {
    for (const m of pass.review?.missingAnalyses || []) filed.set(m.id, { ...m, pass: pass.pass });
    for (const f of pass.review?.findings || []) found.set(f.id, { ...f, pass: pass.pass });
  }
  const open = openEntries(ledger).filter((e) => !e.aboutImported);
  const analyses = open.filter((e) => e.dimension === "missing").map((e) => {
    const m = filed.get(e.id) ?? {};
    return { kind: "analysis", id: e.id, severity: e.severity, blocking: BLOCKING.has(e.severity), analysis: m.analysis ?? e.reason, why: m.why ?? null, data: m.data ?? null,
      public: m.public ?? e.public ?? null, remedy: m.remedy ?? e.remedy ?? null, ifUnfixed: m.ifUnfixed ?? null, filedAt: m.pass ?? null,
      closes: RESEARCH_CLOSES[m.remedy ?? e.remedy] ?? RESEARCH_CLOSES.retrieval };
  });
  const revisions = open.filter((e) => e.dimension !== "missing" && e.dimension !== "cuts" && BLOCKING.has(e.severity)).map((e) => {
    const f = found.get(e.id) ?? {};
    return { kind: "revision", id: e.id, severity: e.severity, blocking: true, pages: e.pages || [], analysis: f.problem ?? e.reason, why: f.ifUnfixed ?? null,
      filedAt: f.pass ?? null, closes: `${f.fix ?? e.repair ?? "the change the finding names"} - on the pages it names, read by the next pass` };
  });
  const depth = spec ? evidenceDepth(spec.slides || []) : null;
  // A part-to-whole page and a bridge plot as many values as the whole has parts or the change has steps: deepening one
  // means another page, not more of this one, so the thinnest of the rest are asked.
  const deepenable = (spec?.slides || []).filter((s) => s.pageType?.chart && Number.isFinite(s.pageType.values) && !THIN_BY_FORM.has(s.pageType.type))
    .sort((a, b) => a.pageType.values - b.pageType.values).slice(0, 5);
  const thin = depth && depth.chartPages >= VARIETY.evidenceFrom && depth.median < VARIETY.evidenceMedianTarget
    ? deepenable.map((slide) => [null, String(slide.id), slide.pageType.values]).map(([, id, n]) => ({ kind: "depth", id: `depth-${id}`, severity: "minor", blocking: false, pages: [id],
      analysis: `${id} plots ${n} values, where the deck's chart pages plot a median of ${depth.median} and strong decks' about ${VARIETY.evidenceMedianTarget}`,
      data: "the whole peer set, a second series (a prior period, a benchmark), or a longer window of the same measure",
      closes: "the page plots more of the evidence - its measures recorded over the wider set or window, and the page's view widened, which its next pass reads" }))
    : [];
  return [...analyses, ...revisions, ...thin].sort((a, b) => Number(b.blocking) - Number(a.blocking));
}

/** The tasks written beside the critique, or the file removed when none is open. Returns the lines the run prints. */
async function writeResearchTasks(out, tasks) {
  const file = path.join(out, RESEARCH_FILE);
  if (!tasks.length) { await fs.rm(file, { force: true }); return []; }
  await writeJson(file, { schema: "professional-slides.research-tasks/v1", note: "Run each before the next pass: a verification pass reads a missing analysis closed only on its artifact - the analysis, the insight a page rests on - or on the searches that show the data cannot be had, and a finding closed on the change its fix names", tasks });
  return tasks.map((t) => `${t.id} [${t.kind}] (${t.severity}${t.blocking ? ", blocks" : ""}): ${t.analysis}${t.data ? ` - on ${t.data}` : ""}. Closes on: ${t.closes}`);
}

async function advanceStoryline(specPath, outputDirectory, { maxPasses = MAX_PASSES, mode, reason, userApproved = false } = {}, said = { mended: [] }) {
  if (mode !== undefined && !STORYLINE_MODES.includes(mode)) throw new Error(`Unknown storyline mode ${mode}; one of ${STORYLINE_MODES.join(", ")}`);
  const spec = await readJson(specPath);
  const out = path.resolve(outputDirectory);
  const request = [...requestErrors(spec), ...(await scopeSourceErrors(spec, path.dirname(path.resolve(specPath))))];
  if (request.length) return { status: "refused", errors: request };
  const store = await lineageStore(spec, out, specPath);
  const historyDir = path.join(store, HISTORY);
  let history = await readPasses(historyDir);
  const { review: answered, invalid } = await readCritique(path.join(out, "storyline-review.json"));
  let packet = await readJson(path.join(store, PACKET_RECORD), { optional: true });
  // A lineage recorded under another binding version is retired whole - its passes, its waiting packet and the critique
  // in the output directory - and the loop begins again at pass one: its page hashes cannot be compared with today's.
  let retired = null;
  const stale = history.length ? bindingVersionOf(history.at(-1)) !== BINDING_VERSION : Boolean(packet) && bindingVersionOf(packet) !== BINDING_VERSION;
  if (stale) {
    const note = history.length ? staleLineage(history.at(-1), history.length) : `a packet written under binding version ${bindingVersionOf(packet)} was waiting for its critique; the binding is now version ${BINDING_VERSION}`;
    // What was open and blocking in it goes to the new first pass, which says of each whether it still stands.
    const last = history.at(-1);
    const open = last ? openBlocking(last.ledger ?? storylineLedger([], last.review)).map((e) => ({ id: e.id, code: e.code ?? null, dimension: e.dimension ?? null, severity: e.severity, pages: e.pages || [], text: itemLines(e).replace(/\n\s*/g, " | ") })) : [];
    const archived = await retireLineage(historyDir, { note, files: [path.join(store, PACKET_RECORD), path.join(out, "storyline-review.json")], open });
    retired = `The earlier storyline lineage (${history.length} pass${history.length === 1 ? "" : "es"}) was recorded under binding version ${bindingVersionOf(history.at(-1) ?? packet)} and is archived in ${path.join(historyDir, archived)}: this runtime binds the critique under version ${BINDING_VERSION}, which reads the pages differently, so that record cannot say which of them changed. This is a clean first pass, not a restart, and nothing of the old lineage counts against the pass cap${open.length ? `. Its ${open.length} open blocking item${open.length === 1 ? " is" : "s are"} carried into the new packet (${open.map((e) => e.id).join(", ")}): the critic says of each whether it still stands` : ""}`;
    history = [];
    packet = null;
  }
  if (invalid && !stale) return refusedForm(out, [invalid]);
  let review = stale ? null : answered;
  if (review && !history.some((h) => h.binding === review.binding && h.pass === review.pass)) {
    if (!packet || packet.binding !== review.binding || packet.pass !== review.pass)
      return { status: "invalid", errors: [`storyline-review.json does not answer the latest packet (binding or pass differs): give ${packet?.staging ? path.join(packet.staging, "prompt.md") : "the packet's prompt.md"} to a fresh critic and save the answer`] };
    // The page lists are settled before the form is judged: a range expanded, a page the item's own text names added. What was
    // settled is written back to the answer, so every later reading of it is of the same lists, and kept on the pass's record.
    const judged = judgeCritique(review, { ...packetContext(packet), sectionFits: (title, ids) => sectionTitleFits(spec, path.dirname(path.resolve(specPath)), title, ids) });
    if (judged.errors.length) return refusedForm(out, judged.errors);
    // What the runtime settled and read off the ledger is written back, so every later reading of the answer is of the record.
    ({ review } = judged);
    const { ledger } = judged;
    said.mended.push(...judged.mended);
    await writeJson(path.join(out, "storyline-review.json"), review);
    history.push((await recordPass(historyDir, { review, pageHashes: packet.pageHashes, bindingVersion: BINDING_VERSION, ledger, mode: packet.mode ?? "full", answerHash: sha256(packet.answer ?? ""),
      ...(said.mended.length ? { formMended: said.mended } : {}),
      // A post-review pass says so in the lineage: which deck-review pass allowed it and the pages it read. It is not counted against the cap.
      ...(packet.scope?.postReview && packet.scope.postReview.origin !== "compile" ? { kind: POST_REVIEW, postReview: { key: packet.scope.postReview.key, reviewPass: packet.scope.postReview.reviewPass, pages: packet.scope.postReview.pages, findings: packet.scope.postReview.findings.map((f) => f.id) } } : {}),
      // So does the pass a compile refusal allowed: its kind, the pages it read and the refusals that earned it.
      ...(packet.scope?.postReview?.origin === "compile" ? { kind: COMPILE_REFUSAL, compileRefusal: { key: packet.scope.postReview.key, pages: packet.scope.postReview.pages, refusals: packet.scope.postReview.findings.map((f) => ({ page: f.pages[0], code: f.code, reason: f.reason })) } } : {}),
      artifacts: packet.artifacts ?? null, rested: [...new Set(packet.pages.flatMap((p) => (p.evidence || []).filter((e) => !e.missing).map((e) => e.id)))] })).record);
    if (packet.carried?.length) await settleCarried(historyDir, review.binding);
  }
  const lineageMode = history.at(-1)?.mode ?? (history.length ? "full" : null);
  const wanted = mode ?? lineageMode ?? "spine";
  if (lineageMode && wanted !== lineageMode) {
    const restart = await restartLineage(historyDir, { reason, userApproved, flag: wanted === "full" ? "--full" : "--spine" });
    if (restart.errors.length) return { status: "refused", errors: restart.errors };
    history = [];
  }
  const measures = await readMeasures(spec, specPath);
  const binding = storylineBinding(spec, measures);
  const latest = history.at(-1);
  const changes = latest ? null : revisionChanges(spec, await readInventory(spec, specPath));
  if (changes && !changes.spineChanged) return { status: "ready", pass: 0, mode: wanted, binding, note: "A revision that leaves the user's spine unchanged - every title, its order and its source slide - needs no storyline critique" };
  // An open item a later pass restated under a new id is one item (review-passes.mjs advanceLedger): named by its first id, with the ids folded into it.
  const brief = (e) => `${e.id} ${e.dimension} (${e.severity}) on ${(e.pages || []).join(", ") || "the spine"}${(e.folded || []).length ? ` (restated as ${e.folded.map((f) => f.id).join(", ")})` : ""}`;
  if (latest && latest.binding === binding) {
    const open = openBlocking(latest.ledger);
    // What the critic filed about the imported deck blocks nothing, and is the user's to hear: the run names each.
    const told = openAboutImported(latest.ledger);
    const deepen = latest.review.verdict === "ready" && !open.length ? await writeResearchTasks(out, researchTasks(history, latest.ledger, spec)) : [];
    if (latest.review.verdict === "ready" && !open.length) return { status: "ready", pass: latest.pass, mode: wanted, binding, note: READY_NOTE,
      ...(deepen.length ? { research: deepen, researchNote: `Minor missing analyses the critic said would deepen the answer without changing it (${RESEARCH_FILE}): worth running before the layout if the data is to hand - each one rested on reopens its pages for one verification pass` } : {}),
      ...(told.length ? { aboutImported: told.map(brief), tell: `${told.length} item${told.length === 1 ? " is" : "s are"} about the imported deck - a slide of the user's own this revision did not change. Nothing is refused for ${told.length === 1 ? "it" : "them"}, and no slide is to be edited that the user did not ask to change: delivery reports ${told.length === 1 ? "it" : "each"} to the user (out/delivery.json \`aboutImported\`), who decides` } : {}) };
    // Provisional: the team has done what the evidence in scope allows, the
    // answer is offered as provisional, and what stays open is recorded with it.
    if (latest.review.verdict === "provisional" && open.length && open.every(limitedBy(evidenceScopeOf(spec))) && answerStatusOf(spec).status === "provisional")
      return { status: "provisional", pass: latest.pass, mode: wanted, binding, limits: open.map(brief), note: "The storyline is provisional, not ready: every open item needs evidence the scope forbids. The deck review may start; delivery records the deck as provisional with these limits" };
    const research = await writeResearchTasks(out, researchTasks(history, latest.ledger, spec));
    return { status: "revise", pass: latest.pass, mode: wanted, open: open.map(brief), ...(research.length ? { research, researchFile: path.join(out, RESEARCH_FILE) } : {}),
      note: `Revise the argument at the root for the open items - a claim, what settles it, the insights and measures a page rests on and what it shows of them, the pages or the answer; a chart redrawn in another form or reworded copy is not a revision - then run this again: it writes the verification pass for what you changed${research.length ? `. Run the research first (${RESEARCH_FILE}): a missing analysis closes on its artifact, not on a page reworded around it` : ""}` };
  }
  const ids = storyStructure(spec).filter(isContent).map((p) => p.id);
  const scope = latest ? nextPassScope(latest, storylinePageHashes(spec, measures), { ids, ledger: latest.ledger ?? storylineLedger([], latest.review), maxPasses }) : null;
  if (scope && wanted === "spine") scope.mustInspect = [];
  // Whether the answer moved since the pass being verified: what `narrowed` rests on.
  if (scope) scope.answerChanged = typeof latest.answerHash === "string" && latest.answerHash !== sha256(spec.answer ?? "");
  // The artifacts as they stood at that pass, and which of them a page rested on: what `fixed` is held against.
  if (scope && latest.artifacts && Array.isArray(latest.rested)) scope.prior = { artifacts: latest.artifacts, rested: latest.rested };
  if (scope) {
    // The cap counts the critique's own passes; a post-review pass is granted by the deck review and counted against that.
    const spent = history.filter((h) => ![POST_REVIEW, COMPILE_REFUSAL].includes(h.kind)).length;
    scope.capped = spent + 1 > maxPasses;
    const moved = changedPages(latest.pageHashes, storylinePageHashes(spec, measures)) ?? { changed: scope.changed, deleted: scope.deleted };
    const reviewDir = path.join(store, REVIEW_HISTORY);
    const post = postReviewPass(history, await readPasses(reviewDir), await readConfirmations(reviewDir), moved, revisionChanges(spec, await readInventory(spec, specPath)));
    // The pass a compile refusal allows, where no deck review allows one: on the compile's own record, never on a flag.
    const refusal = post.grant ? { why: null } : compileRefusalPass(history, await readJson(path.join(store, COMPILE_REFUSAL_RECORD), { optional: true }), latest, moved);
    const grant = post.grant ?? refusal.grant ?? null;
    if (grant) Object.assign(scope, { capped: false, postReview: grant, mustInspect: wanted === "full" ? ids.filter((id) => grant.pages.includes(id)) : [] });
    else if (scope.capped) {
      const research = await writeResearchTasks(out, researchTasks(history, latest.ledger, spec));
      return { status: "capped", pass: scope.pass, ...(research.length ? { research, researchFile: path.join(out, RESEARCH_FILE) } : {}),
        message: `${capMessage("storyline critique", spent + 1, maxPasses, latest.ledger)} The post-review pass (${POST_REVIEW_RULE}) is not available: ${post.why}. Nor is the pass a compile refusal allows (${COMPILE_REFUSAL_RULE}): ${refusal.why}.` };
    }
  }
  const { dir, packet: next } = await buildStorylinePacket(specPath, out, { scope, mode: wanted, revision: changes, carried: scope ? [] : await carriedItems(historyDir) });
  // The folder the answer is saved into exists from the moment it is asked for: an answer written elsewhere and copied in is not lost to a missing directory.
  await fs.mkdir(out, { recursive: true });
  return { status: "packet-written", pass: next.pass, mode: wanted, dir, binding: next.binding, sections: next.sections?.length ?? 0, ...(retired ? { retired } : {}),
    ...(scope?.postReview && scope.postReview.origin !== "compile" ? { postReview: { reviewPass: scope.postReview.reviewPass, pages: scope.postReview.pages } } : {}),
    ...(scope?.postReview?.origin === "compile" ? { compileRefusal: { pages: scope.postReview.pages, refusals: scope.postReview.findings.map((f) => `${f.pages[0]}: ${f.code}`) } } : {}),
    note: next.sections ? `Give each prompt in ${path.join(dir, "sections")} to its own fresh critic in parallel (no other context), save each answer as ${path.join(dir, "parts", "<id>.json")}, then run storyline.mjs merge` : `Give ${path.join(dir, "prompt.md")} to a fresh critic (no other context) and save its JSON as ${path.join(out, "storyline-review.json")}, then run this again` };
}

function partErrors(part, packet) {
  const meta = part?.part;
  if (!meta || !["section", "spine"].includes(meta.kind)) return ["part must say { kind: section|spine, id, pages }"];
  const structure = schemaErrors(part, STORYLINE_PART_SCHEMAS[meta.kind], meta.id);
  if (structure.length) return structure;
  const { ids, insightIds, promptHash, limits, dividers } = packetContext(packet);
  const errors = [...itemErrors(part, ids, meta.kind === "section" ? meta.pages : null, { limits, dividers }), ...(promptHash ? provenanceErrors(part, promptHash) : [])];
  if (meta.kind === "section") errors.push(...coverageErrors(part.pages, meta.pages, "page"), ...sourcingErrors(part.pages, storylineLedger([], part), insightIds));
  return errors;
}

/** Join a long spine's parallel critiques into one first pass, as reviewer.mjs does for the deck. */
export function mergeStorylineParts(partsIn, packet) {
  const { ids, contentIds } = packetContext(packet);
  // Each part's page lists are settled as a whole critique's are, and what was settled is returned for the record.
  const mended = [];
  const parts = partsIn.map((part) => { const settled = settleCritiqueForm(part, ids, contentIds); mended.push(...settled.mended.map((entry) => ({ ...entry, at: `${part?.part?.id ?? "part"}: ${entry.at}` }))); return settled.review; });
  const errors = [...parts.flatMap((part) => partErrors(part, packet).map((e) => `${part?.part?.id ?? "part"}: ${e}`)),
    ...partSetErrors(parts, contentIds, { key: "pages", binding: packet.binding, sections: packet.sections })];
  if (errors.length) return { errors };
  const rename = uniqueIds(parts, (p) => [...(p.findings || []), ...(p.missingAnalyses || []), ...(p.cutOrMerge || [])]);
  const relabel = (part, list) => (list || []).map((item) => ({ ...item, id: rename(part, item.id) }));
  const [lead] = parts.filter((p) => p.part.kind === "spine");
  const merged = {
    pass: 1, verifies: null, binding: packet.binding, rating: lead.rating, summary: lead.summary, ...(lead.provenance ? { provenance: lead.provenance } : {}),
    spine: lead.spine, answer: lead.answer, answerParts: lead.answerParts, pillars: lead.pillars, numbers: lead.numbers, sectionFlow: lead.sectionFlow, execSummary: lead.execSummary,
    missingAnalyses: relabel(lead, lead.missingAnalyses), cutOrMerge: relabel(lead, lead.cutOrMerge),
    findings: parts.flatMap((p) => relabel(p, p.findings)), topFixes: lead.topFixes, mergedFrom: parts.map((p) => p.part.id),
    // The spine critic answers the carried items; an item it files one as is renamed with its other items.
    ...(lead.carried ? { carried: lead.carried.map((answer) => (answer.finding ? { ...answer, finding: rename(lead, answer.finding) } : answer)) } : {}),
  };
  const ledger = storylineLedger([], merged);
  const joined = joinParts(parts, contentIds, ledger, { pageKey: "page", dimensions: [], dimKey: "check" });
  if (joined.errors.length) return { errors: joined.errors };
  // The verdict and the judgements are read off the joined ledger when the merged pass is recorded (withJudgements).
  merged.pages = joined.pages;
  return { review: merged, errors: [], mended };
}

/** Merge saved parts into out/storyline-review.json and record it. */
export async function mergeStorylineDirectory(specPath, outputDirectory, options = {}) {
  const out = path.resolve(outputDirectory);
  const spec = await readJson(specPath);
  const packet = await readJson(path.join(await lineageStore(spec, out, specPath), PACKET_RECORD), { optional: true });
  if (!packet?.sections) return { status: "invalid", errors: ["no split storyline packet to merge against: run storyline.mjs --full on a long spine first"] };
  const { files, parts } = await readParts(path.join(packet.staging, "parts"));
  const { review, errors, mended } = mergeStorylineParts(parts, packet);
  if (errors.length) return { status: "invalid", errors, parts: files };
  await writeJson(path.join(out, "storyline-review.json"), review);
  return prepareStoryline(specPath, out, { ...options, formMended: mended });
}

/**
 * Run the critique through fresh CLI sessions: readers with none of the
 * author's context, working in the packet's staging directory. A CLI that is
 * not signed in leaves the packet for a critic the calling agent spawns.
 */
export async function runStorylineReview(specPath, outputDirectory, backend = "auto", { model, timeoutMs = 600000, maxPasses = MAX_PASSES, mode, reason, userApproved } = {}) {
  const options = { maxPasses, mode, reason, userApproved };
  const step = await prepareStoryline(specPath, outputDirectory, options);
  if (step.status !== "packet-written") return step;
  const which = detectBackend(backend);
  if (which === "packet") return step;
  const packet = await readJson(path.join(step.dir, "packet.json"));
  let review;
  try {
    if (packet.sections) {
      const prompt = (id) => fs.readFile(path.join(step.dir, "sections", `${id}.md`), "utf8");
      const jobs = [...await Promise.all(packet.sections.map(async (s) => ({ id: s.id, prompt: await prompt(s.id) }))), { id: "spine", prompt: await prompt("spine"), schemaPath: path.join(step.dir, "spine-part-schema.json") }];
      const parts = await reviewParts(which, jobs, { partsDir: path.join(step.dir, "parts"), schemaPath: path.join(step.dir, "part-schema.json"), model, timeoutMs, cwd: step.dir, promptHash: packet.promptHash });
      const record = await readJson(path.join(await lineageStore(await readJson(specPath), outputDirectory, specPath), PACKET_RECORD));
      const merged = mergeStorylineParts(parts, record);
      if (merged.errors.length) return { status: "invalid", errors: merged.errors };
      review = merged.review;
      options.formMended = merged.mended;
    } else review = await callReviewer(which, { prompt: await fs.readFile(path.join(step.dir, "prompt.md"), "utf8"), schemaPath: path.join(step.dir, "schema.json"),
      outPath: path.join(step.dir, "codex-last-message.json"), model, timeoutMs, cwd: step.dir, promptHash: packet.promptHash });
  } catch (error) {
    if (isAuthFailure(error)) return { ...step, note: `The ${which} CLI is not signed in (${String(error.message).split("\n").find((l) => l.trim()) ?? "authentication failed"}), so the packet is left for a critic the calling agent spawns. ${step.note}` };
    throw error;
  }
  await writeJson(path.join(outputDirectory, "storyline-review.json"), review);
  const next = await prepareStoryline(specPath, outputDirectory, { maxPasses, formMended: options.formMended });
  return { ...next, verdict: review.verdict, rating: review.rating, topFixes: review.topFixes };
}

const USAGE = "Usage: storyline.mjs [merge] <id>.deck.json output-directory [--full | --spine] [--run codex|claude] [--model m] [--max-passes n] [--reason text] [--user-approved]";

async function main(argv) {
  const { values, positionals } = parseCli(argv, { full: { type: "boolean" }, spine: { type: "boolean" }, run: { type: "string", bare: "auto" }, model: { type: "string" },
    "max-passes": { type: "string" }, reason: { type: "string" }, "user-approved": { type: "boolean" } }, { usage: USAGE });
  const merging = positionals[0] === "merge";
  const [spec, out] = merging ? positionals.slice(1) : positionals;
  if (!spec || !out) throw new UsageError(USAGE);
  if (values.full && values.spine) throw new UsageError(`--full and --spine are two modes; pass one\n${USAGE}`);
  const options = { maxPasses: values["max-passes"] ? Number(values["max-passes"]) : MAX_PASSES, mode: values.full ? "full" : values.spine ? "spine" : undefined,
    reason: values.reason, userApproved: Boolean(values["user-approved"]) };
  const result = merging ? await mergeStorylineDirectory(path.resolve(spec), path.resolve(out), options)
    : values.run !== undefined ? await runStorylineReview(path.resolve(spec), path.resolve(out), values.run, { ...options, model: values.model })
    : await prepareStoryline(path.resolve(spec), path.resolve(out), options);
  console.log(JSON.stringify(result));
  return ["ready", "provisional"].includes(result.status) ? EXIT.ok : result.status === "packet-written" ? EXIT.waiting : EXIT.refused;
}

if (isMain(import.meta.url)) runCli(main);
