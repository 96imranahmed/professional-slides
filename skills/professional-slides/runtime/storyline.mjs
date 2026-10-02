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
// The critique is bound to the spine only - the request, the answer, each
// page's title, claim and what it settles, its page and exhibit types, and the
// numbers it plots - so rewording, commentary and table-cell edits carry over,
// and changing what a page argues or shows does not. Its passes live beside the
// deck file, keyed by deck id (review-passes.mjs lineageStore), so a new output
// directory continues the lineage rather than restarting it.
import { SHAPES, breadthOf, breadthProblem, plottedValues, trivialChart, trendChart } from "./evidence.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { textWords } from "./text-contract.mjs";
import { registered } from "./errors.mjs";
import {
  SEVERITIES, PAGE_VERDICTS, STATUSES, NEW_BASES, MAX_PASSES, SEVERITY_DEFINITIONS, BLOCKING,
  pageListErrors, advanceLedger, openEntries, openBlocking, verificationErrors, coverageErrors, verdictErrors, completenessErrors,
  changedPages, capMessage, uniqueIds, detectBackend, nextPassScope, splitSections, partSetErrors, joinParts, readParts,
  callReviewer, reviewParts, readPasses, recordPass,
  PROVENANCE_SCHEMA, provenanceLine, provenanceErrors, sha256, requestOf, requestHash, requestErrors, stageReview, lineageStore, restartLineage, isAuthFailure,
  readInventory, revisionChanges, locateDeck, REQUEST_PROVENANCES, requestProvenanceOf, evidenceScopeOf, answerStatusOf,
} from "./review-passes.mjs";
import { alternativesOf, analysisInsights, analysisLine, readAnalysis } from "./analysis.mjs";
import { dependencyNotes } from "./gates/dependency_gates.mjs";

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
export const STORYLINE_STATUSES = Object.freeze([...STATUSES, "unavailable", "narrowed", "scope-limited"]);
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
// What a rating means, so that two passes and two critics use one scale; and
// the most a storyline with an open item can be rated.
export const RATING_ANCHORS = Object.freeze({
  "9-10": "ready as it stands; nothing a top team would add is missing",
  "7-8": "the argument holds; only minor items remain",
  "5-7": "a major item is open",
  "3-5": "a blocker is open",
  "0-2": "no argument: the question restated, or facts without an answer",
});
export const RATING_CAPS = Object.freeze({ blocker: 5, major: 7 });
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
 */
export const STORYLINE_CHECKS = Object.freeze({
  claim: { scope: "page", checks: "the page's claim is a finding with an implication, not a count, a fact or a two-number comparison" },
  shape: { scope: "page", checks: "the evidence has the shape the claim needs - the trend with its rate, the whole ranked peer set, the share and its movement, the ratio, the benchmark gap, the map, the judging table - not a two-number chart or a plain grid; a comparison sets every member on the same measures, n/a where one is undisclosed, not a different metric per member" },
  sourcing: { scope: "page", checks: "the claim traces to insights in the log, each with its calculation and source files: supported, partly supported or unsupported, naming the insight ids" },
  restatement: { scope: "page", checks: "the page moves the argument on from the page before it; it does not restate it or re-prove another page's proposition" },
  consequence: { scope: "page", checks: "the page says what follows for the decision, not only what is true" },
  spine: { scope: "spine", checks: "the titles read alone tell the story: each a finding, in an order that builds to the answer" },
  answer: { scope: "spine", checks: "the governing answer answers every part of the user's request, is sharp enough to be wrong, and is what the pages add up to" },
  pillars: { scope: "spine", checks: "the pillars are a MECE set of reasons that together prove the answer; each has its strongest counter-argument and the condition that would reverse it, answered by the storyline" },
  numbers: { scope: "spine", checks: "a figure is the same number, unit, base and period on every page that states it, and totals reconcile across pages" },
  flow: { scope: "spine", checks: "sections open, develop and close in an order a reader follows; no section previews another or ends without its point" },
  summary: { scope: "spine", checks: "the executive summary states the answer and the pillars the body proves, with the body's numbers, and the close agrees with it" },
  missing: { scope: "spine", checks: "the analyses a strong team would have run are here, or named with why they matter and the public data behind them" },
  cuts: { scope: "spine", checks: "pages that repeat, preview or pad are cut or merged, and the freed pages carry a missing analysis" },
});
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
const ITEM = { type: "object", additionalProperties: false, required: Object.keys(ITEM_PROPERTIES), properties: ITEM_PROPERTIES };
const NEW_ITEM = { type: "object", additionalProperties: false, required: [...Object.keys(ITEM_PROPERTIES), "basis", "justification", "evidence"],
  properties: { ...ITEM_PROPERTIES, basis: { type: "string", enum: Object.keys(NEW_BASES) }, justification: { type: "string" }, evidence: { type: "string" } } };
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
const PILLAR = { type: "object", additionalProperties: false, required: ["pillar", "pages", "verdict", "overlap", "strongestCounter", "reversal", "answered"],
  properties: { pillar: STR(), pages: { type: "array", items: { type: "string" }, minItems: 1 }, verdict: { type: "string", enum: ["holds", "weak", "fails"] },
    overlap: STR(10), strongestCounter: STR(10), reversal: STR(10), answered: { type: "boolean" } } };
// `public`: "known" when the critic can name the public source that publishes
// the data; "speculative" otherwise, and a speculative analysis is never major.
const MISSING = { type: "object", additionalProperties: false, required: ["id", "analysis", "why", "data", "public", "remedy", "severity"],
  properties: { id: ITEM_PROPERTIES.id, analysis: STR(10), why: STR(10), data: STR(10), public: { type: "string", enum: ["known", "speculative"] },
    remedy: { type: "string", enum: Object.keys(REMEDIES) }, severity: ITEM_PROPERTIES.severity } };
const CUT = { type: "object", additionalProperties: false, required: ["id", "pages", "action", "freedUse", "severity"],
  properties: { id: ITEM_PROPERTIES.id, pages: ITEM_PROPERTIES.pages, action: { type: "string", enum: ["cut", "merge"] }, freedUse: STR(10), severity: ITEM_PROPERTIES.severity } };
const STATUS = { type: "object", additionalProperties: false, required: ["finding", "status", "evidence"],
  properties: { finding: { type: "string" }, status: { type: "string", enum: STORYLINE_STATUSES }, evidence: STR(20), severity: { type: "string", enum: SEVERITIES },
    pages: { type: "array", items: { type: "string" } }, searchLog: { type: "string" }, artifact: { type: "string" } } };
const COMPLETENESS = { type: "array", items: { type: "object", additionalProperties: false, required: ["check", "result", "note"],
  properties: { check: { type: "string", enum: STORYLINE_DIMENSIONS }, result: { type: "string", enum: ["findings", "clean"] }, note: { type: "string" } } } };
const ANSWER_PARTS = { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["part", "verdict", "missingEvidence"],
  properties: { part: STR(3), verdict: { type: "string", enum: ANSWER_VERDICTS }, missingEvidence: { type: "string" } } } };
const JUDGEMENT = (verdicts) => ({ type: "object", additionalProperties: false, required: ["verdict", "note"], properties: { verdict: { type: "string", enum: verdicts }, note: STR(10) } });
const COMMON = { verdict: { type: "string", enum: STORYLINE_VERDICTS }, rating: { type: "number", minimum: 0, maximum: 10 }, binding: HASH, summary: STR(40), provenance: PROVENANCE_SCHEMA,
  compliance: JUDGEMENT(COMPLIANCE_VERDICTS), sufficiency: JUDGEMENT(SUFFICIENCY_VERDICTS) };

/** Pass one of the page-level critique (--full): every page of the spine, every spine-level section, and what found nothing. */
export const STORYLINE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["pass", "verifies", "verdict", "rating", "binding", "summary", "compliance", "sufficiency", "spine", "answer", "answerParts", "pillars", "pages", "numbers", "sectionFlow", "execSummary", "missingAnalyses", "cutOrMerge", "findings", "topFixes", "completeness"],
  properties: {
    pass: { type: "integer", enum: [1] }, verifies: { type: "null" }, ...COMMON,
    spine: STR(60), answer: STR(40), answerParts: ANSWER_PARTS,
    pillars: { type: "array", items: PILLAR, minItems: 1 },
    pages: { type: "array", items: PAGE_ENTRY },
    numbers: STR(30), sectionFlow: STR(30), execSummary: STR(30),
    missingAnalyses: { type: "array", items: MISSING },
    cutOrMerge: { type: "array", items: CUT },
    findings: { type: "array", items: ITEM },
    topFixes: { type: "array", items: { type: "string" }, minItems: 1 },
    completeness: COMPLETENESS,
    mergedFrom: { type: "array", items: { type: "string" } },
  }
};

/** Pass one of the spine critique: the page-level schema without per-page verdicts, at most ten items. */
export const STORYLINE_SPINE_SCHEMA = { ...STORYLINE_SCHEMA, required: STORYLINE_SCHEMA.required.filter((k) => k !== "pages"), properties: { ...STORYLINE_SCHEMA.properties } };
delete STORYLINE_SPINE_SCHEMA.properties.pages;
delete STORYLINE_SPINE_SCHEMA.properties.mergedFrom;

/** Pass two and after: a status for every open item, new items only if serious and additive. */
export const STORYLINE_VERIFICATION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["pass", "verifies", "verdict", "rating", "binding", "summary", "compliance", "sufficiency", "pages", "statuses", "findings", "topFixes"],
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
export const STORYLINE_PART_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["part", "binding", "verdict", "rating", "summary", "pages", "findings", "completeness"],
  properties: {
    part: { type: "object", additionalProperties: false, required: ["kind", "id", "pages"],
      properties: { kind: { type: "string", enum: ["section", "spine"] }, id: { type: "string" }, pages: { type: "array", items: { type: "string" } } } },
    ...STORYLINE_SCHEMA.properties,
  }
};
delete STORYLINE_PART_SCHEMA.properties.pass;
delete STORYLINE_PART_SCHEMA.properties.verifies;
delete STORYLINE_PART_SCHEMA.properties.mergedFrom;

const schemaFor = (mode, scope) => (scope ? (mode === "full" ? STORYLINE_VERIFICATION_SCHEMA : STORYLINE_SPINE_VERIFICATION_SCHEMA) : (mode === "full" ? STORYLINE_SCHEMA : STORYLINE_SPINE_SCHEMA));

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

// The data an exhibit plots, as numbers: what a reversed trend or a reordered
// ranking changes. Typed values only - a number written into a label or a
// table cell's text is wording, and editing it keeps the critique.
const DATA_KEYS = new Set(["series", "values", "value", "points", "rows", "cells", "markers", "items", "charts", "props", "low", "high", "boxes", "targets", "data", "x", "y", "min", "q1", "median", "q3", "max"]);
export function plottedNumbers(node, out = []) {
  if (typeof node === "number") { if (Number.isFinite(node)) out.push(node); return out; }
  if (Array.isArray(node)) { for (const v of node) plottedNumbers(v, out); return out; }
  if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) if (DATA_KEYS.has(key)) plottedNumbers(value, out);
  return out;
}

/**
 * The spine: what the critique is bound to. Per page its id, kind, title,
 * claim and what it settles, its page type, and each exhibit's type and the
 * numbers it plots. Commentary, labels and cell text are left out, so copy
 * edits after the critique carry over; a page checked for them is checked by
 * the deck review's verification pass.
 */
export function storyStructure(spec) {
  const pages = [...(spec.slides || []), ...(spec.appendix || [])];
  return pages.map((s, i) => ({
    id: s.id ?? `p${i + 1}`, kind: s.kind ?? "content", title: String(s.title ?? s.text ?? ""),
    claim: s.pageType?.content?.claim ?? s.claim ?? null, settles: s.pageType?.content?.settles ?? s.settles ?? null,
    type: s.pageType ? `${s.pageType.type ?? ""}/${s.pageType.form ?? ""}` : null,
    // What each exhibit says it plots and why it is on the page: an exhibit
    // moved onto another claim is a different argument, whatever its numbers.
    exhibits: exhibitsOf(s).map((ex, at) => ({ type: ex.type ?? null, values: plottedNumbers(ex), ...(s.pageType?.dependencies?.exhibits?.[at] ? { basis: s.pageType.dependencies.exhibits[at] } : {}) })),
  }));
}

/** The critique's binding: the spine, the governing answer and the user's request. */
export function storylineBinding(spec) {
  const offered = answerStatusOf(spec);
  return sha256(JSON.stringify({ request: requestHash(spec), answer: spec.answer ?? null, ...(offered.status === "provisional" ? { answerStatus: offered } : {}), pages: storyStructure(spec) }));
}

/** One hash per page of the spine: what a verification pass compares. */
export function storylinePageHashes(spec) {
  return Object.fromEntries(storyStructure(spec).map((p) => [p.id, sha256(JSON.stringify(p))]));
}

const isContent = (p) => !p.kind || p.kind === "content";

// The numbers a page turns on, in a line: each series from its first to its
// last value, or the first plotted values.
const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString("en-US");
function keyNumbers(exhibits) {
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

/**
 * The pages the critique reads, with what each rests on: its claim, what
 * settles it, its exhibits, its commentary, and the insights it names with
 * their calculation and sources, so sourcing is judged page by page rather
 * than found by accident.
 */
async function storyPages(spec, base, stem) {
  const content = await readJson(path.join(base, `${stem}.content.json`), { optional: true });
  const byId = new Map((content?.pages || []).map((p) => [p.id, p]));
  const recorded = await readJson(path.join(base, `${stem}.insights.json`), { optional: true });
  // The analyses the runtime computed from the log's measures stand beside
  // its insights: a page rests on either by id.
  const analysis = recorded ? await readAnalysis(base, stem, recorded, { alternatives: alternativesOf(spec) }) : { plan: null, results: [], problems: [] };
  const log = recorded ? { ...recorded, insights: [...(recorded.insights || []), ...analysisInsights(analysis.results)] } : null;
  const insights = new Map((log?.insights || []).map((i) => [i.id, i]));
  let section = null;
  const pages = [...(spec.slides || []), ...(spec.appendix || [])].map((s, i) => {
    if (s.kind === "section") section = String(s.title ?? s.text ?? "");
    const planned = byId.get(s.id) || {};
    const body = (planned.textPlan || []).filter((b) => ["body", "qualification"].includes(b.role)).map((b) => b.text);
    const evidence = planned.evidence ?? s.pageType?.content?.evidence ?? [];
    const exhibits = exhibitsOf(s);
    return { n: i + 1, id: s.id ?? `p${i + 1}`, kind: s.kind ?? "content", section, title: s.title ?? s.text ?? "", claim: planned.claim ?? s.pageType?.content?.claim ?? null,
      settles: planned.settles ?? s.pageType?.content?.settles ?? null, exhibits: exhibits.map(describeExhibit), keyNumbers: keyNumbers(exhibits), commentary: body.slice(0, 6), source: s.source ?? null,
      // The context exhibits and the relation the claim asserts, for the critic to judge: declared by the author, never inferred.
      declared: dependencyNotes({ exhibits: exhibits.map((ex, at) => ({ ...ex, basis: s.pageType?.dependencies?.exhibits?.[at] })), settles: s.pageType?.content?.settles }),
      evidence: evidence.map((id) => { const item = insights.get(id); return item ? { id, finding: item.finding, calculation: item.calculation ?? null, sources: item.sources ?? [], strength: item.strength ?? null } : { id, missing: true }; }),
      ...(s.pageType ? { type: `${s.pageType.type}/${s.pageType.form}`, page: `${s.pageType.type}/${s.pageType.form}, explanation ${s.pageType.commentary}${s.pageType.takeaway ? ", closes on a line" : ""}` } : {}) };
  });
  return { pages, content, log, analysis };
}

// A spine past this many content pages is critiqued page by page (--full) by
// parallel section critics (splitSections, at most STORYLINE_SECTION_MAX pages
// each) and one spine critic: a forty-page section read by one critic is the
// thin reading the split exists to prevent.
export const STORYLINE_SECTION_THRESHOLD = 30;
export const STORYLINE_SECTION_MAX = 16;

const HISTORY = "storyline-history";
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
export async function buildStorylinePacket(specPath, outputDirectory, { scope = null, mode = "spine", revision = null } = {}) {
  const spec = await readJson(specPath);
  const base = path.dirname(specPath), stem = path.basename(specPath).replace(/\.deck\.json$/, "");
  const store = await lineageStore(spec, outputDirectory, specPath);
  const { pages, content, log, analysis } = await storyPages(spec, base, stem);
  // Sources sit in workstream folders (sources/<workstream>/...), so list them all.
  const sources = await fs.readdir(path.join(base, "sources"), { recursive: true }).then((all) => all.filter((f) => /\.[a-z0-9]+$/i.test(f))).catch(() => []);
  const insights = checkInsights(log, sources, pages.map((p) => ({ kind: p.kind === "section" ? "section" : isContent(p) && p.type ? "content" : "other", title: p.title, evidence: (p.evidence || []).map((e) => e.id) })));
  const contentPages = pages.filter(isContent).length;
  const targetPages = Number.isFinite(spec.targetPages) ? spec.targetPages : spec.purpose === "evaluation" ? 50 : null;
  const sections = mode === "full" && !scope && !revision && contentPages > STORYLINE_SECTION_THRESHOLD
    ? splitSections(pages.map((p) => ({ id: p.id, title: p.title, opens: p.kind === "section", counted: isContent(p) })), { max: STORYLINE_SECTION_MAX }) : null;
  const answer = spec.answer ?? content?.answer ?? "";
  const packet = { mode, binding: storylineBinding(spec), pageHashes: storylinePageHashes(spec), pass: scope ? scope.pass : 1, verifies: scope ? scope.verifies : null,
    maxPasses: scope?.maxPasses ?? MAX_PASSES, scope, sections, deck: path.resolve(specPath), revision: !scope && revision ? { changed: revision.spine, dropped: revision.dropped } : null,
    request: requestOf(spec), requestProvenance: requestProvenanceOf(spec), evidenceScope: evidenceScopeOf(spec), answerStatus: answerStatusOf(spec),
    // What the runtime computed before the outline, and what it could not: a missing analysis closes on one of these, not on a qualification.
    analyses: analysis.results.map((r) => ({ id: r.id, op: r.op, status: r.status, line: analysisLine(r), missing: r.missing ?? [], assumptions: (r.assumptions || []).length })),
    analysisProblems: analysis.problems,
    question: spec.question ?? content?.question ?? null, answer, declines: declinesIn(answer),
    players: spec.players ?? [], sources, insights, targetPages, totalPages: pages.length, contentPages, pages };
  const schema = schemaFor(mode, scope);
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
    await writeJson(path.join(dir, "part-schema.json"), STORYLINE_PART_SCHEMA);
    for (const [id, text] of parts) await fs.writeFile(path.join(dir, "sections", `${id}.md`), signed(text));
  }
  await fs.mkdir(store, { recursive: true });
  await writeJson(path.join(store, PACKET_RECORD), packet);
  return { dir, packet, store };
}

// How an insight is graded, and what makes a measurement a finding: one
// definition, read where the insight log is compiled (author-deck.mjs
// readInsights, which refuses an ungraded log) and where the critic is shown it.
export const INSIGHT_STRENGTHS = Object.freeze(["strong", "supporting", "context"]);
export function insightGradeProblems(item) {
  const id = item?.id ?? "?";
  return [...(INSIGHT_STRENGTHS.includes(item?.strength) ? [] : [`${id}: \`strength\` is one of ${INSIGHT_STRENGTHS.join(", ")}${item?.strength === undefined ? "" : ` (got ${JSON.stringify(item.strength)})`}`]),
    ...(typeof item?.soWhat === "string" && textWords(item.soWhat) >= 4 ? [] : [`${id}: \`soWhat\` says what follows for the decision, in a sentence`])];
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
 * The insight log, checked for what makes a finding a finding: a statement,
 * the calculation that produced it, its grade and what follows from it, and a
 * source file that exists. Problems are reported to the critic, who weighs
 * them; the authoring compile is where an ungraded log is refused.
 */
export function checkInsights(log, sources = [], pages = null) {
  if (!log) return { present: false, items: [], problems: ["no insight log: the titles were written without recorded findings"] };
  const items = Array.isArray(log.insights) ? log.insights : [];
  const have = new Set(sources.map((f) => `sources/${f}`));
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
    const missing = (item?.sources || []).filter((f) => !have.has(f));
    if (!(item?.sources || []).length) problems.push(`${item?.id ?? "?"}: no source file`);
    else if (missing.length) problems.push(`${item?.id ?? "?"}: source not in sources/: ${missing.join(", ")}`);
  }
  if (pages) for (const pillar of unsupportedPillars(pages, new Map(items.map((i) => [i.id, i])))) problems.push(`PILLAR_UNSUPPORTED: "${pillar.title}" rests on no strong insight`);
  return { present: true, items: items.map((i) => ({ id: i.id, finding: i.finding, shape: i.shape ?? null, breadth: breadthOf(i), strength: i.strength ?? null, calculation: i.calculation ?? null, sources: i.sources ?? [] })), problems };
}

const spineLine = (p) => isContent(p)
  ? `${p.n}. [${p.id}] ${p.title}${p.page ? `\n     page: ${p.page}` : ""}\n     shows: ${p.exhibits.join(" + ") || "text only"}${(p.declared || []).length ? `\n     declared: ${p.declared.join(" / ")}` : ""}${p.commentary.length ? `\n     says: ${p.commentary.join(" / ").slice(0, 400)}` : ""}${p.evidence?.length ? `\n     rests on: ${p.evidence.map((e) => e.missing ? `${e.id} (NOT IN THE LOG)` : `${e.id} "${e.finding}" (calc: ${e.calculation ?? "none"}; sources: ${e.sources.join(", ") || "none"})`).join("; ")}` : "\n     rests on: no insight named"}`
  : `${p.n}. -- ${p.kind}: ${p.title}`;

// One line per page for the spine critique: title, claim where it differs,
// page type, the numbers it turns on and the insight ids it rests on.
const compactLine = (p) => isContent(p)
  ? `${p.n}. [${p.id}] ${p.title}${p.claim && p.claim !== p.title ? ` | claim: ${p.claim}` : ""}${p.type ? ` | ${p.type}` : ""}${p.keyNumbers ? ` | ${p.keyNumbers}` : ""} | rests on: ${(p.evidence || []).map((e) => `${e.id}${e.missing ? " (NOT IN THE LOG)" : ""}`).join(", ") || "none"}${(p.declared || []).length ? ` | declared: ${p.declared.join(" / ")}` : ""}`
  : `${p.n}. -- ${p.kind}: ${p.title}`;

// The text of a page as the packet shows it: what a missed item's quoted evidence is checked against.
const packetPageText = (packet) => Object.fromEntries(packet.pages.map((p) => [p.id, [p.title, p.claim, p.type, p.keyNumbers, ...(p.exhibits || []), ...(p.commentary || []), ...(p.evidence || []).map((e) => `${e.id} ${e.finding ?? ""}`)].filter(Boolean).join("\n")]));

// What the runtime computed from the insight log's measures before the outline was written.
const analysesLines = (packet) => `COMPUTED ANALYSES (run by the runtime over the log's measures; a page rests on one by its id):
${(packet.analyses || []).map((a) => `- ${a.line}`).join("\n") || "- none"}${(packet.analysisProblems || []).length ? `\nANALYSIS PLAN PROBLEMS: ${packet.analysisProblems.join("; ")}` : ""}`;

function checksPrompt() {
  return `THE CHECKS. The page checks are made on every content page; the spine checks on the storyline as a whole.
${STORYLINE_DIMENSIONS.map((d) => `- ${d} (${STORYLINE_CHECKS[d].scope}): ${STORYLINE_CHECKS[d].checks}`).join("\n")}

SEVERITY:
${["blocker", "major", "minor", "none"].map((s) => `- ${s}: ${s === "blocker" ? "the answer does not follow, a decisive claim is unsupported or contradicted, or a number conflicts across pages" : s === "major" ? "a page or pillar a partner would send back: an obvious or unsourced claim, the wrong evidence shape, a restated page, a missing countercase, a missing analysis that would change the answer" : SEVERITY_DEFINITIONS[s]}`).join("\n")}`;
}

/** The storylining standard, condensed, so a critic needs no other file. */
export const CRITIC_STANDARDS = `THE STANDARD. You need no other file: this is the skill's storylining guidance, condensed.
- The answer answers the user's request - every part of it - and is sharp enough to be wrong. An answer that declines part of the request fails the answer check: "cannot rank" is allowed at most once, and only when it names the decisive missing evidence; an answer that leaves two of three questions unranked is not an answer.
- The pillars are a MECE set of reasons that together prove the answer; each has its strongest counter-argument and the condition that would reverse it.
- Every analytical page carries a finding with an implication, drawn from the insight log: not a count, a fact or a two-number comparison. Its evidence has the shape the claim needs: the trend with its rate, the whole ranked peer set, the share and its movement, the ratio, the gap to a benchmark, the map, the judging table. A comparison sets every member on the same measures, n/a where one is undisclosed.
- Each page moves the argument on: none restates, previews or re-proves another. The summary states what the body proves, with its numbers, and the close agrees with it.
- A missing analysis names why it would change the answer, the data behind it and its \`remedy\`: ${Object.entries(REMEDIES).map(([key, about]) => `"${key}" (${about})`).join(", ")}. Ask first whether the packet's own measures would settle it. Mark \`public: "known"\` only when you can name the public source that publishes the data; otherwise "speculative", and a speculative retrieval is never major. You are not searching the web: say what you know is published. An analysis is met by the analysis, never by a caveat saying what the evidence does not establish.
- The requested length counts the appendix: recommend cutting weak or repetitive body pages freely, and move surplus pages that still earn a lookup to the appendix, which keeps the total at the requested length; give the freed body pages to a missing analysis.
- Judge the argument, not the wording: the copy is written later.`;

const ITEM_RULES = `ITEMS. Every problem is an item with an id (F1, F2, ...; M1... for missing analyses; C1... for cuts), a severity and, for findings, the check it belongs to, the problem and the fix. A page finding names its one page; a spine finding lists EVERY page it concerns (for the answer, the summary and closing pages) - never a sample, never "e.g.", "such as" or "etc.". Validation refuses a sampled page list and a finding whose text names a page its list leaves out.`;

const PAGE_RULES = `PAGE VERDICTS. \`pages\` holds one entry for every content page: its verdict (ok, minor, major, blocker - the worst open item naming the page), a note for claim, shape, restatement and consequence, and \`sourcing\` { status: supported | partly | unsupported | n/a, insights: the ids it rests on, note }. An unsupported page carries a major or blocker sourcing finding; a partly supported one a sourcing finding at any severity.`;

// The two judgements a critique returns beside its verdict, and the scale its rating is on.
const JUDGEMENT_RULES = `TWO JUDGEMENTS, KEPT APART. \`compliance\`: has the team done everything the evidence in scope allows? "complete" only when no major or blocker item it could still act on is open. \`sufficiency\`: does the evidence support the answer as stated? "sufficient" only when no major or blocker item is open at all; "provisional" when the only ones open need evidence the team may not fetch and the answer is offered as provisional; else "insufficient". A severity is never lowered because the scope forbids the remedy.
RATING SCALE: ${Object.entries(RATING_ANCHORS).map(([band, means]) => `${band} ${means}`).join("; ")}. With a blocker open the rating is ${RATING_CAPS.blocker} or less; with a major open, ${RATING_CAPS.major} or less.`;

const ANSWER_RULES = `THE ANSWER, PART BY PART. In \`answerParts\` list each part of the user's request (each question it asks, each choice it wants made) with how the governing answer meets it: "answered", "cannot rank" (with \`missingEvidence\` naming the decisive evidence that is missing, and why it decides the part) or "declined" (anything else that does not answer it). "cannot rank" is allowed once; a second, or any part declined, fails the answer check: the verdict is revise and a major or blocker \`answer\` finding says what the answer must commit to. \`missingEvidence\` is "" for an answered part.`;

// A revision's first critique reads what the revision changed; the rest is the
// user's deck as it stands, there for context.
const revisionLines = (packet) => (packet.revision ? `
THIS IS A REVISION of the user's existing deck. The pages marked [changed] are the revision's${packet.revision.dropped?.length ? `, and ${packet.revision.dropped.length} slide${packet.revision.dropped.length === 1 ? " was" : "s were"} cut from the source deck (the pages either side are marked)` : ""}; the others are the user's deck as it stands, shown for context. File items only where the revision is involved: a page item names a changed page, and a spine item or a cut lists at least one. A missing analysis is in scope only where a changed page needs it.
` : "");
const marked = (packet, line, p) => `${line}${packet.revision?.changed?.includes(p.id) ? "  [changed]" : ""}`;

/** The request and the answer, as the critic reads them. */
function requestLines(packet) {
  const provenance = packet.requestProvenance ?? "verbatim";
  const label = provenance === "verbatim" ? "verbatim - the yardstick; judge the storyline against it, not against the team's framing"
    : `${provenance}: ${REQUEST_PROVENANCES[provenance]} - not the user's own words. It is the yardstick as far as it goes: judge the storyline against what it asks, do not hold the team to its exact wording or to an answer its phrasing presumes, and say in the summary where it leaves the request open`;
  const request = packet.request
    ? `THE USER'S REQUEST (${label}):\n"""\n${packet.request}\n"""`
    : `THE USER'S REQUEST: not recorded. Judge against the team's question and say so in the summary. THE TEAM'S QUESTION: ${packet.question || "(not stated)"}`;
  const scope = packet.evidenceScope?.retrieval === "closed"
    ? `\nEVIDENCE SCOPE: closed - the team may use only the evidence supplied${packet.evidenceScope.note ? ` (${packet.evidenceScope.note})` : ""}. An analysis that needs other data has remedy "retrieval": the team cannot run it. It keeps its severity - a decisive gap is still decisive - and is met only by an answer that claims less, or stays open under a provisional answer.`
    : "";
  const offered = packet.answerStatus?.status === "provisional"
    ? `\nTHE ANSWER IS OFFERED AS PROVISIONAL. It says it leaves open: ${packet.answerStatus.limits.map((limit) => `"${limit}"`).join("; ")}. Judge whether those are the decisive gaps, and whether everything else the evidence allows has been done.`
    : "";
  return `${request}${scope}\nTHE TEAM'S ANSWER: ${packet.answer || "(not stated)"}${offered}${packet.declines?.length ? `\nTHE ANSWER DECLINES ${packet.declines.length} TIME${packet.declines.length === 1 ? "" : "S"}: ${packet.declines.map((d) => `"${d}"`).join(", ")} - check each against the parts of the request.` : ""}`;
}

const sectionsLine = (packet) => {
  const groups = [];
  for (const p of packet.pages) {
    if (p.kind === "section") groups.push({ title: p.title, ids: [] });
    else if (isContent(p)) { if (!groups.length) groups.push({ title: "Opening", ids: [] }); groups.at(-1).ids.push(p.id); }
  }
  return groups.map((g) => `- ${g.title}: ${g.ids.length ? `${g.ids[0]}-${g.ids.at(-1)} (${g.ids.length} pages)` : "no pages"}`).join("\n");
};

/** The spine critique: the request, the answer, the sections and a line per page - small, and at most ten items back. */
export function spinePrompt(packet) {
  return `You are a senior partner reviewing a team's storyline before a single slide is drawn: the spine - the request, the answer, the sections, the titles in order, and what each page claims, rests on and plots. You did not write it and you owe it nothing. Be adversarial and specific. Judge from this packet alone: do not search the web or open other files.

This is pass 1 of at most ${packet.maxPasses ?? MAX_PASSES}. Return at most ${SPINE_ITEM_MAX} items - findings, missing analyses and cuts together - the ones that most change whether the deck answers the request. Later passes only verify them, and may add only a serious new problem on a part the team changed.
${revisionLines(packet)}
${requestLines(packet)}
PLAYERS DECLARED: ${JSON.stringify((packet.players || []).map((p) => p?.name ?? p))}
REQUESTED LENGTH: ${packet.targetPages ? `${packet.targetPages}+ pages (the storyline has ${packet.totalPages}, ${packet.contentPages} of them content pages)` : `not fixed (the storyline has ${packet.totalPages} pages)`}
INSIGHT LOG: ${packet.insights?.present ? `${packet.insights.items.length} insights` : "none recorded"}${packet.insights?.problems?.length ? `; ${packet.insights.problems.length} problems: ${packet.insights.problems.slice(0, 8).join("; ")}${packet.insights.problems.length > 8 ? "; ..." : ""}` : ""}
DATA FOUND: ${packet.sources.length} files under sources/${packet.sources.length ? ` (${packet.sources.slice(0, 40).join(", ")}${packet.sources.length > 40 ? ", ..." : ""})` : ""}
${analysesLines(packet)}

SECTIONS (the pillars as drawn):
${sectionsLine(packet)}

THE SPINE (title | claim where it differs | page type | the numbers it plots | the insights it rests on):
${packet.pages.map((p) => marked(packet, compactLine(p), p)).join("\n")}

${CRITIC_STANDARDS}

${checksPrompt()}

Work through it in this order.
1. The spine alone: does it tell the story? Write \`spine\`.
2. The answer: is it an answer to the request, or a restatement or refusal of it? Sharp enough to be wrong? Rewrite it the way it should read in \`answer\`, and judge it part by part in \`answerParts\`.
3. The pillars: a MECE set of reasons that together prove the answer? For each in \`pillars\`: its pages, your verdict, overlaps and gaps, the strongest counter-argument, the condition that would reverse it, and whether the storyline answers it.
4. The pages, from their lines: a claim that is a count or a fact, a page type or plotted numbers too thin for the claim, a page with no insight behind it, a page that restates another, a page with no consequence - each as a finding on its pages.
5. \`numbers\`, \`sectionFlow\` and \`execSummary\`, in a sentence or two each.
6. Missing analyses, each with \`public\` known or speculative; cut or merge.
7. Completeness: one entry per check in \`completeness\` - "findings" when you filed any under it, "clean" with what you checked when you did not.
8. Verdict: "ready" only if no major or blocker item is open and the answer check passes. Rate the storyline on the scale below; rank the top fixes.

${JUDGEMENT_RULES}

${ANSWER_RULES}

${ITEM_RULES}

Set pass to 1 and verifies to null. Bind the review to ${packet.binding}. Return ONLY JSON matching the schema in ${packet.staging ? path.join(packet.staging, "schema.json") : "schema.json beside this prompt"}.`;
}

export function storylinePrompt(packet) {
  const split = packet.sections?.length ? `
THIS STORYLINE IS LONG (${packet.contentPages} content pages), so critique it in parallel where the harness can spawn subagents: give each prompt in the packet's sections/ folder (${packet.sections.map((s) => `${s.id}.md: ${s.pages.length} pages`).join("; ")}; spine.md for the spine checks) to its own fresh critic at the same time, save each JSON answer as parts/<id>.json beside it, then run \`node runtime/storyline.mjs merge <deck> <out>\`. Without subagents, work through this prompt alone.
` : "";
  return `You are a senior partner reviewing a team's storyline before a single slide is drawn - the problem-solving session where a weak story gets taken apart. You did not write it and you owe it nothing. Be adversarial and specific. Judge from this packet alone: do not search the web or open other files.

This is pass 1 of at most ${packet.maxPasses ?? MAX_PASSES}, and it is exhaustive: every ${packet.revision ? "changed" : "content"} page gets a verdict on every page check, and every spine check gets an answer. Later passes only verify your items and may add only a serious new problem on a page the team changed, so what you leave out now is not raised again.
${split}${revisionLines(packet)}
${requestLines(packet)}
PLAYERS DECLARED: ${JSON.stringify(packet.players)}
DATA THEY FOUND (files under sources/): ${packet.sources.length ? packet.sources.join(", ") : "none"}

REQUESTED LENGTH: ${packet.targetPages ? `${packet.targetPages}+ pages (the storyline has ${packet.totalPages}, ${packet.contentPages} of them content pages)` : `not fixed (the storyline has ${packet.totalPages} pages)`}
INSIGHT LOG (what the team extracted from the data before writing titles):
${packet.insights?.present ? packet.insights.items.map((i) => `- [${i.id}] (${i.strength ?? "ungraded"}) ${i.finding} — calc: ${i.calculation ?? "none"}; sources: ${i.sources.join(", ") || "none"}`).join("\n") || "- empty" : "- none recorded"}${packet.insights?.problems?.length ? `\nINSIGHT LOG PROBLEMS: ${packet.insights.problems.join("; ")}` : ""}
${analysesLines(packet)}

THE STORYLINE (title, what each page shows, what it says, the insights it rests on):
${packet.pages.map((p) => marked(packet, spineLine(p), p)).join("\n")}

${CRITIC_STANDARDS}

${checksPrompt()}

Work through it in this order.

1. The spine alone. Read the titles without the pages: does it tell the story? Write \`spine\`.
2. The answer. Is it an answer to the request, or a restatement or refusal of it? Sharp enough to be wrong? Rewrite it the way it should read in \`answer\`, and judge it part by part in \`answerParts\`.
3. The pillars. Do they form a MECE set of reasons that together prove the answer? For each pillar in \`pillars\`: its pages, your verdict (holds, weak, fails), the overlaps and gaps, the strongest counter-argument, the condition that would reverse it, and whether the storyline answers it.
4. Every page, in order. The bar is a deck that feels important: every page carries evidence a reader could not have assembled in five minutes. Check the claim, the evidence shape (TWO-NUMBER charts, PLAIN GRID tables, two or three categories where the whole set exists), its sourcing against the insight log (the insight ids, their calculations, their sources), whether it restates the page before, and whether it states a consequence. Where pages carry a "page:" line, judge whether the page type is the claim's reading task. Say what each weak page should show instead.
5. Numbers across pages: the same figure with the same unit, base and period everywhere, totals that reconcile (\`numbers\`).
6. Section flow (\`sectionFlow\`) and the executive summary against the body and the close (\`execSummary\`).
7. Missing analyses: what a strong team would have run, why it matters to the answer, the public data behind it, and whether that data is \`public\` known or speculative.
8. Cut or merge: pages that repeat, preview or exist to reach a count, and what the freed pages should carry. Cut body pages where the argument is better without them; a surplus or weak page that still earns a lookup moves to the appendix, which counts toward the requested length.
9. Completeness: one entry per check in \`completeness\` - "findings" when you filed any under it, "clean" with what you checked when you did not.
10. Verdict. "ready" only if no major or blocker item is open and the answer check passes: the answer is sharp, the pillars hold, the decisive pages are analytical and sourced, and no missing analysis would change the answer. Otherwise "revise". Rate the storyline on the scale below. Rank the top fixes.

${PAGE_RULES}

${JUDGEMENT_RULES}

${ANSWER_RULES}

${ITEM_RULES}

Set pass to 1 and verifies to null. Bind the review to ${packet.binding}. Return ONLY JSON matching this schema: ${JSON.stringify(STORYLINE_SCHEMA)}`;
}

export function storylineSectionPrompt(packet, section) {
  const pages = packet.pages.filter((p) => section.pages.includes(p.id));
  return `You are one of several senior critics reading a long storyline in parallel, before anything is drawn. Yours is section ${section.id}, "${section.title}": pages ${section.pages.join(", ")}. A spine critic takes the answer, pillars, numbers across pages, section flow, summary, missing analyses and cuts. Be adversarial and specific; judge from this packet alone.

${requestLines(packet)}
THE WHOLE TITLE SPINE, for context:
${packet.pages.map((p) => `${p.n}. [${p.id}] ${p.title}`).join("\n")}

YOUR PAGES:
${pages.map(spineLine).join("\n")}

${CRITIC_STANDARDS}

${checksPrompt()}

Check every page check on every one of your pages; this is the exhaustive first pass.

${PAGE_RULES}

${ITEM_RULES} Name only pages in your section; leave the spine sections as short notes ("see the spine critic").

\`completeness\` covers the page checks (${STORYLINE_PAGE_CHECKS.join(", ")}). Set part to ${JSON.stringify({ kind: "section", id: section.id, pages: section.pages })}. Bind to ${packet.binding}.
Return ONLY JSON matching this schema: ${JSON.stringify(STORYLINE_PART_SCHEMA)}`;
}

/** The spine critic of a long page-level critique: the compact spine, not the whole page listing again. */
export function storylineSpinePrompt(packet) {
  return `You are the spine critic of a long storyline read in parallel, before anything is drawn: section critics give every page its verdict. Be adversarial and specific; judge from this packet alone: do not search the web or open other files.

${requestLines(packet)}
PLAYERS DECLARED: ${JSON.stringify((packet.players || []).map((p) => p?.name ?? p))}
REQUESTED LENGTH: ${packet.targetPages ? `${packet.targetPages}+ pages (the storyline has ${packet.totalPages}, ${packet.contentPages} of them content pages)` : `not fixed (the storyline has ${packet.totalPages} pages)`}

${analysesLines(packet)}

SECTIONS:
${sectionsLine(packet)}

THE SPINE (title | claim where it differs | page type | the numbers it plots | the insights it rests on):
${packet.pages.map(compactLine).join("\n")}

${CRITIC_STANDARDS}

${checksPrompt()}

You write the spine sections - \`spine\`, \`answer\`, \`answerParts\`, \`pillars\`, \`numbers\`, \`sectionFlow\`, \`execSummary\`, \`missingAnalyses\`, \`cutOrMerge\`, \`topFixes\`, \`compliance\`, \`sufficiency\` - and file spine findings listing every page they concern. Leave \`pages\` empty. \`completeness\` covers ${SPINE_CHECKS.join(", ")}. Your verdict, rating and summary become the critique's.

${JUDGEMENT_RULES}

${ANSWER_RULES}

${ITEM_RULES}

Set part to ${JSON.stringify({ kind: "spine", id: "spine", pages: packet.pages.filter(isContent).map((p) => p.id) })}. Bind to ${packet.binding}.
Return ONLY JSON matching this schema: ${JSON.stringify(STORYLINE_PART_SCHEMA)}`;
}

export function storylineVerificationPrompt(packet) {
  const { scope } = packet;
  const full = packet.mode === "full";
  const read = packet.pages.filter((p) => scope.mustInspect.includes(p.id));
  const changed = new Set(scope.changed);
  return `You are verifying a team's revisions to a storyline an earlier critique sent back. This is pass ${scope.pass} of at most ${scope.maxPasses}; it verifies the critique bound to ${scope.verifies}. It is not a fresh critique: the first pass read the whole ${full ? "storyline" : "spine"}, and its verdict stands for every part that has not changed. No earlier rating is given to you. Judge from this packet alone.

${requestLines(packet)}

OPEN ITEMS (give every one a status):
${scope.open.map((e) => `- ${e.id} · ${e.dimension} · ${e.severity} · ${(e.pages || []).join(", ") || "spine"}: ${e.reason}${e.repair ? ` → ${e.repair}` : ""}`).join("\n") || "- none"}

${full ? `THE TITLE SPINE NOW:
${packet.pages.map((p) => `${p.n}. [${p.id}] ${p.title}${changed.has(p.id) ? "  [changed]" : ""}`).join("\n")}

PAGES TO READ (changed since that pass, or named by an open major or blocker):
${read.map(spineLine).join("\n") || "- none"}` : `THE SPINE NOW ([changed] marks a page changed since that pass):
${packet.pages.map((p) => `${compactLine(p)}${changed.has(p.id) ? "  [changed]" : ""}`).join("\n")}`}
DATA FOUND: ${packet.sources.length} files under sources/${packet.sources.length ? ` (${packet.sources.slice(0, 60).join(", ")}${packet.sources.length > 60 ? ", ..." : ""})` : ""}
${analysesLines(packet)}
THE ANSWER ${scope.answerChanged ? "HAS CHANGED" : "HAS NOT CHANGED"} since the pass this verifies.

${CRITIC_STANDARDS}

${checksPrompt()}

Do three things.
1. STATUSES: for every open item, fixed, partly fixed, not fixed, regressed, narrowed, or - for a missing analysis only - unavailable or scope-limited, with the evidence in the packet. A partly fixed item keeps its severity.
   - A missing analysis is "fixed" only on its artifact: set \`artifact\` to the id of the computed analysis (listed above) or the insight that supplies it, which a page must rest on. A qualification on the page is not the analysis: where the page only says what the evidence does not establish, the item is not fixed.
   - "narrowed" closes an item the answer no longer needs because the answer now claims less; it is allowed only where the answer has changed, and its evidence quotes the narrower answer.
   - "unavailable" closes a missing analysis the team searched for and could not find, and needs \`searchLog\`: the path of the search log under sources/ (listed above) that shows the search. It is not available where the evidence scope is closed: nothing could be searched.
   - "scope-limited" is for a missing analysis whose remedy is retrieval while the evidence scope is closed: the team may not fetch the data. The item stays open at its severity. It does not count against compliance; it does count against sufficiency.
2. ${full ? "PAGES: a full page entry for every page listed above, as the first pass wrote them." : "THE ANSWER: if the answer or the request changed, judge it again in `answerParts`."}
3. NEW ITEMS, only if additive: major or blocker, with \`basis\` ${Object.entries(NEW_BASES).map(([k, v]) => `${k} (${v})`).join("; ")}. A new minor item, an item on an unchanged page unless it is a missed major or blocker whose \`evidence\` quotes the packet's line for that page exactly (and a justification of why the first pass could not see it), and a repeat of an open item are refused. New ids must be new; \`evidence\` is "" except for basis missed. Then stop: the storyline is not re-critiqued.

${full ? PAGE_RULES : ""}

${JUDGEMENT_RULES}

${ANSWER_RULES}

${ITEM_RULES}

"ready" only when no major or blocker item, earlier or new, is open. "provisional" only when every major or blocker item still open is scope-limited, compliance is complete and the answer is offered as provisional; otherwise "revise". Set pass to ${scope.pass} and verifies to "${scope.verifies}". Bind to ${packet.binding}.
Return ONLY JSON matching this schema: ${JSON.stringify(schemaFor(packet.mode, scope))}`;
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
    pages: f.pages || [], reason: f.problem, repair: f.fix, ...(f.basis ? { basis: f.basis, justification: f.justification, evidence: f.evidence } : {}) });
  for (const m of review?.missingAnalyses || []) items.push({ id: m.id, code: registered(STORYLINE_CODES, "MISSING_ANALYSIS"), dimension: "missing", scope: "spine", severity: m.severity, pages: [],
    reason: `${m.analysis}: ${m.why}`, repair: `Run it on ${m.data}`, public: m.public ?? null, remedy: m.remedy ?? null });
  for (const c of review?.cutOrMerge || []) items.push({ id: c.id, code: registered(STORYLINE_CODES, c.action === "cut" ? "CUT_PAGE" : "MERGE_PAGES"), dimension: "cuts", scope: "spine", severity: c.severity,
    pages: c.pages || [], reason: `${c.action} ${(c.pages || []).join(", ")}`, repair: c.freedUse });
  return items;
}

export const storylineLedger = (prior, review) => advanceLedger(prior, review, storylineItems(review));

function itemErrors(review, ids, own = null, { cap = null } = {}) {
  const errors = [];
  const seen = new Set();
  const lists = [["findings", review.findings || []], ["missingAnalyses", review.missingAnalyses || []], ["cutOrMerge", review.cutOrMerge || []]];
  for (const [name, list] of lists) for (const [i, item] of list.entries()) {
    const at = `${name}[${i}]${item?.id ? ` (${item.id})` : ""}`;
    if (seen.has(item.id)) errors.push(`${at}: id ${item.id} is used twice`);
    seen.add(item.id);
    if (name === "findings") errors.push(...pageListErrors(at, { scope: item.scope, pages: item.pages, text: `${item.problem ?? ""} ${item.fix ?? ""}`, ids, deckScope: "spine" }));
    if (name === "cutOrMerge") errors.push(...pageListErrors(at, { scope: "spine", pages: item.pages, text: item.freedUse, ids, deckScope: "spine" }));
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
function answerErrors(review, ledger) {
  const parts = review.answerParts;
  if (!Array.isArray(parts)) return [];
  const errors = [];
  for (const [i, part] of parts.entries()) if (part?.verdict === "cannot rank" && (typeof part.missingEvidence !== "string" || part.missingEvidence.trim().length < 20))
    errors.push(`answerParts[${i}]: "cannot rank" names the decisive missing evidence in missingEvidence, and why it decides "${part.part}"`);
  const unranked = parts.filter((p) => p?.verdict === "cannot rank").length;
  const declined = parts.filter((p) => p?.verdict === "declined").length;
  // A provisional answer does not pretend to rank what its evidence cannot: the
  // parts it leaves unranked are its declared limits, not a refusal.
  if ((unranked > 1 && review.verdict !== "provisional") || declined) {
    const why = `${declined ? `${declined} part${declined === 1 ? "" : "s"} of the request declined` : ""}${declined && unranked > 1 ? " and " : ""}${unranked > 1 ? `${unranked} parts left unranked (once is allowed)` : ""}`;
    if (review.verdict === "ready") errors.push(`verdict is ready while the answer check fails: ${why}`);
    if (!openBlocking(ledger).some((e) => e.dimension === "answer")) errors.push(`the answer check fails (${why}): file a major or blocker \`answer\` finding saying what the answer must commit to`);
  }
  return errors;
}

/**
 * How an item closes, checked against what the packet holds. A missing
 * analysis is fixed on its artifact - a computed analysis or an insight a page
 * rests on - never on a qualification; `narrowed` needs an answer that changed;
 * `scope-limited` is a retrieval the closed scope forbids, and stays open.
 */
function closureErrors(review, ledger, { analyses = [], insightIds = null, rested = new Set(), evidenceScope = null, answerChanged = false } = {}) {
  const errors = [];
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
    }
    if (s.status === "narrowed" && !answerChanged) errors.push(`${at}: narrowed closes an item the answer no longer needs because it now claims less; the answer has not changed since the pass this verifies`);
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
 * The verdict, the two judgements and the rating, held to the ledger they
 * summarise: compliance is complete exactly when nothing the team can still
 * act on is open; sufficiency is sufficient exactly when nothing is open;
 * provisional needs a complete, scope-limited ledger and a deck that offers
 * its answer as provisional; and the rating sits under the cap its worst open
 * item sets.
 */
function judgementErrors(review, ledger, { answerStatus = null, evidenceScope = null } = {}) {
  const errors = [];
  const scopeLimited = limitedBy(evidenceScope);
  const open = openBlocking(ledger), limited = open.filter(scopeLimited), doable = open.filter((e) => !scopeLimited(e));
  const provisional = answerStatus?.status === "provisional";
  const names = (list) => list.map((e) => `${e.id} (${e.severity})`).join(", ");
  if (review.verdict === "provisional") {
    if (doable.length) errors.push(`verdict is provisional while ${names(doable)} ${doable.length === 1 ? "is" : "are"} open and within the team's reach; provisional is for a storyline whose only open items the evidence scope forbids`);
    if (!limited.length) errors.push("verdict is provisional with no scope-limited item open: say ready, or revise");
    if (!provisional) errors.push("verdict is provisional but the deck offers its answer as final: the deck sets `answerStatus: \"provisional\"` with its `answerLimits`, or narrows the answer until the open items no longer bear on it");
  }
  const compliance = review.compliance?.verdict, sufficiency = review.sufficiency?.verdict;
  if (compliance === "complete" && doable.length) errors.push(`compliance is complete while ${names(doable)} ${doable.length === 1 ? "is" : "are"} open and within the team's reach`);
  if (compliance === "incomplete" && !doable.length) errors.push("compliance is incomplete with no major or blocker item open that the team can act on: file the item, or say complete");
  if (sufficiency === "sufficient" && open.length) errors.push(`sufficiency is sufficient while ${names(open)} ${open.length === 1 ? "is" : "are"} open: an item the scope forbids still leaves the answer short of its evidence`);
  if (sufficiency !== "sufficient" && compliance !== undefined && !open.length) errors.push("sufficiency is not sufficient with no major or blocker item open: file what the answer still lacks, or say sufficient");
  if (sufficiency === "provisional" && (doable.length || !provisional)) errors.push(`sufficiency is provisional ${doable.length ? `while ${names(doable)} can still be acted on` : "but the deck offers its answer as final"}: it is insufficient`);
  if (typeof review.rating === "number") {
    const worstOpen = open.some((e) => e.severity === "blocker") ? "blocker" : open.length ? "major" : null;
    if (worstOpen && review.rating > RATING_CAPS[worstOpen]) errors.push(`rating ${review.rating} with a ${worstOpen} open (${names(open.filter((e) => e.severity === worstOpen))}): on the rating scale a storyline with a ${worstOpen} open is ${RATING_CAPS[worstOpen]} or less`);
  }
  return errors;
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
 * Validate a critique against the spine it read: `ids` every page of that
 * spine, `contentIds` the pages the first pass must cover, `scope` and
 * `ledger` for a later pass, `mode` spine or full, `sources` the files under
 * the deck's sources/, `pageText` what a missed item's quote is checked
 * against and `promptHash` the packet's (its provenance is checked when given).
 */
export function validateStorylineRecord(review, { ids, contentIds, scope = null, ledger = [], insightIds = null, mode = "full", sources = [], pageText = null, promptHash, revision = null,
  analyses = [], rested = new Set(), evidenceScope = null, answerStatus = null } = {}) {
  if (!review || typeof review !== "object") return ["storyline-review.json is missing: run the storyline critique (references/storylining.md#stress-test-the-storyline)"];
  // The whole record, not just the verdict: a truncated or hand-written
  // `{ verdict: "ready", binding }` is not a critique.
  const structure = schemaErrors(review, schemaFor(mode, scope), "storyline review");
  if (structure.length) return structure;
  const errors = itemErrors(review, ids, null, { cap: mode === "spine" ? SPINE_ITEM_MAX : null });
  if (promptHash !== undefined) errors.push(...provenanceErrors(review, promptHash));
  const items = storylineItems(review);
  if (scope) {
    errors.push(...verificationErrors(review, { scope: mode === "full" ? scope : { ...scope, mustInspect: [] }, ledger, items, ids, pageKey: "page", deckScope: "spine", statuses: STORYLINE_STATUSES, pageText }));
    errors.push(...unavailableErrors(review, ledger, sources));
    errors.push(...closureErrors(review, ledger, { analyses, insightIds, rested, evidenceScope, answerChanged: Boolean(scope.answerChanged) }));
  } else {
    if (mode === "full") errors.push(...coverageErrors(review.pages, revision ? revision.changed : contentIds, "page"));
    if (revision) errors.push(...revisionItemErrors(items, revision.changed));
    errors.push(...completenessErrors(review.completeness, STORYLINE_DIMENSIONS, items, "check"));
    for (const [i, pillar] of review.pillars.entries()) {
      const unknown = pillar.pages.filter((id) => !ids.includes(id));
      if (unknown.length) errors.push(`pillars[${i}]: unknown page${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`);
    }
  }
  const after = storylineLedger(scope ? ledger : [], review);
  if (mode === "full") errors.push(...verdictErrors(review.pages, after, "page"), ...sourcingErrors(review.pages, after, insightIds));
  errors.push(...answerErrors(review, after));
  errors.push(...judgementErrors(review, after, { answerStatus, evidenceScope }));
  const open = openBlocking(after);
  if (review.verdict === "ready" && open.length) errors.push(`verdict is ready while ${open.map((e) => `${e.id} (${e.severity})`).join(", ")} ${open.length === 1 ? "is" : "are"} open; ready means no major or blocker item remains`);
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
const packetContext = (packet) => ({
  ids: packet.pages.map((p) => p.id), contentIds: packet.pages.filter(isContent).map((p) => p.id), scope: packet.scope ?? null, ledger: packet.scope?.ledger ?? [],
  insightIds: packet.insights?.present ? new Set(packet.insights.items.map((i) => i.id)) : null, mode: packet.mode ?? "full", sources: packet.sources ?? [],
  pageText: packetPageText(packet), promptHash: packet.promptHash ?? null, revision: packet.revision ?? null,
  analyses: packet.analyses ?? [], rested: new Set(packet.pages.flatMap((p) => (p.evidence || []).filter((e) => !e.missing).map((e) => e.id))),
  evidenceScope: packet.evidenceScope ?? null, answerStatus: packet.answerStatus ?? null,
});

/**
 * The storyline gate's judgement of a critique for a spec: it validates
 * against where it came from, is bound to the spine as it stands now, and says
 * ready with no major or blocker item open across its passes. `record` is its
 * recorded pass in the lineage store, which was validated when it was recorded
 * and whose review and ledger - not the editable file - say what it
 * concluded; `packet` is the packet it answers. With neither, it is checked
 * as a first pass over the spec (the pure check the tests use; the gate never
 * passes a critique that has neither), in the mode its shape says.
 */
export function validateStorylineReview(review, spec, { record = null, packet = null } = {}) {
  if (!review || typeof review !== "object") return ["storyline-review.json is missing: run the storyline critique (node runtime/storyline.mjs <id>.deck.json out/) and bring it to ready before the deck review"];
  const structure = storyStructure(spec);
  const judged = record?.review ?? review;
  const errors = record ? [] : validateStorylineRecord(review, packet ? packetContext(packet)
    : { ids: structure.map((p) => p.id), contentIds: structure.filter(isContent).map((p) => p.id), mode: Array.isArray(review.pages) ? "full" : "spine" });
  if (judged.binding !== storylineBinding(spec)) {
    const was = record?.pageHashes ?? packet?.pageHashes;
    const moved = was ? changedPages(was, storylinePageHashes(spec)) : null;
    const which = moved ? [...moved.changed, ...moved.deleted.map((id) => `${id} deleted`)] : [];
    errors.push(`the spine changed after the storyline critique${which.length ? ` (${which.join(", ")})` : " (the answer or the request)"}: re-run the storyline critique first - node runtime/storyline.mjs <id>.deck.json out/ writes the verification pass for what changed - and bring it back to ready before the deck review`);
  }
  if (judged.verdict === "provisional") {
    // A provisional storyline passes the gate as provisional, never as ready:
    // every open item is one the evidence scope forbids, and the deck says so.
    const ledger = record?.ledger ?? storylineLedger(packet?.scope?.ledger ?? [], review);
    const doable = openBlocking(ledger).filter((e) => !limitedBy(evidenceScopeOf(spec))(e));
    if (doable.length) errors.push(`the storyline critique says provisional but ${doable.map((e) => `${e.id} (${e.severity})`).join(", ")} ${doable.length === 1 ? "is" : "are"} still open and within reach`);
    if (answerStatusOf(spec).status !== "provisional") errors.push("the storyline critique says provisional but the deck offers its answer as final: set `answerStatus: \"provisional\"` with its `answerLimits`");
  } else if (judged.verdict !== "ready") errors.push(`the storyline critique says revise (${judged.rating ?? "?"}/10): revise the storyline, re-run the critique and bring it to ready before the deck review${(judged.topFixes || []).length ? ` - ${judged.topFixes.slice(0, 3).join("; ")}` : ""}`);
  else if (!errors.length) {
    const open = openBlocking(record?.ledger ?? storylineLedger(packet?.scope?.ledger ?? [], review));
    if (open.length) errors.push(`the storyline critique says ready but ${open.map((e) => `${e.id} (${e.severity})`).join(", ")} ${open.length === 1 ? "is" : "are"} still open`);
  }
  return errors;
}

/**
 * The storyline gate the deck review waits for (validateStorylineReview). It
 * reads the deck's lineage store: the latest recorded pass, or a critique in
 * out/storyline-review.json that answers the latest packet and is not yet
 * recorded. A storyline-review.json written by hand answers neither, and
 * accepting it would also reset the loop's pass cap. A spine edited after the
 * critique names its changed pages and sends the author back to the critique
 * before any deck review is prepared or accepted. `deckPath` locates the store
 * beside the deck file; without it the deck is looked for beside `directory`.
 */
export async function storylineGate(spec, directory, { deckPath = null } = {}) {
  if (spec?.purpose === "catalogue") return [];
  const request = requestErrors(spec);
  if (request.length) return request;
  const store = await lineageStore(spec, directory, deckPath);
  const history = await readStorylineHistory(store);
  if (!history.length && (await unchangedRevision(spec, await locateDeck(spec, directory, deckPath)))) return [];
  const packet = await readJson(path.join(store, PACKET_RECORD), { optional: true });
  const { review, invalid } = await readCritique(path.join(directory, "storyline-review.json"));
  if (invalid) return [invalid];
  const recorded = review ? history.find((h) => h.binding === review.binding && h.pass === review.pass) : null;
  if (review && !recorded && packet && packet.binding === review.binding && packet.pass === review.pass) return validateStorylineReview(review, spec, { packet });
  const latest = history.at(-1);
  if (latest) return validateStorylineReview(latest.review, spec, { record: latest });
  if (review) return [`storyline-review.json answers no packet this deck's storyline loop wrote and is in no recorded pass: run node runtime/storyline.mjs <id>.deck.json out/, give its prompt to a fresh critic and save that answer - a critique that did not answer the packet is not a gate`];
  return validateStorylineReview(null, spec);
}

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
 * One step of the storyline loop. Records a returned critique (validated
 * against the packet it answered) in the lineage store, then says where the
 * loop stands: ready for this spine; revise (the spine has not changed since
 * the critique); capped; refused; or a new packet - the first pass, or a
 * verification of what changed since the last one. `mode` continues the
 * lineage's mode when not given (spine for a new lineage); a different mode
 * starts a new lineage (restartLineage), which needs `reason` and, the second
 * time, `userApproved`.
 */
export async function prepareStoryline(specPath, outputDirectory, { maxPasses = MAX_PASSES, mode, reason, userApproved = false } = {}) {
  if (mode !== undefined && !STORYLINE_MODES.includes(mode)) throw new Error(`Unknown storyline mode ${mode}; one of ${STORYLINE_MODES.join(", ")}`);
  const spec = await readJson(specPath);
  const out = path.resolve(outputDirectory);
  const request = requestErrors(spec);
  if (request.length) return { status: "refused", errors: request };
  const store = await lineageStore(spec, out, specPath);
  const historyDir = path.join(store, HISTORY);
  let history = await readPasses(historyDir);
  const { review, invalid } = await readCritique(path.join(out, "storyline-review.json"));
  if (invalid) return { status: "invalid", errors: [invalid] };
  const packet = await readJson(path.join(store, PACKET_RECORD), { optional: true });
  if (review && !history.some((h) => h.binding === review.binding && h.pass === review.pass)) {
    if (!packet || packet.binding !== review.binding || packet.pass !== review.pass)
      return { status: "invalid", errors: [`storyline-review.json does not answer the latest packet (binding or pass differs): give ${packet?.staging ? path.join(packet.staging, "prompt.md") : "the packet's prompt.md"} to a fresh critic and save the answer`] };
    const errors = validateStorylineRecord(review, packetContext(packet));
    if (errors.length) return { status: "invalid", errors };
    history.push((await recordPass(historyDir, { review, pageHashes: packet.pageHashes, ledger: storylineLedger(packet.scope?.ledger ?? [], review), mode: packet.mode ?? "full", answerHash: sha256(packet.answer ?? "") })).record);
  }
  const lineageMode = history.at(-1)?.mode ?? (history.length ? "full" : null);
  const wanted = mode ?? lineageMode ?? "spine";
  if (lineageMode && wanted !== lineageMode) {
    const restart = await restartLineage(historyDir, { reason, userApproved, flag: wanted === "full" ? "--full" : "--spine" });
    if (restart.errors.length) return { status: "refused", errors: restart.errors };
    history = [];
  }
  const binding = storylineBinding(spec);
  const latest = history.at(-1);
  const changes = latest ? null : revisionChanges(spec, await readInventory(spec, specPath));
  if (changes && !changes.spineChanged) return { status: "ready", pass: 0, mode: wanted, binding, note: "A revision that leaves the user's spine unchanged - every title, its order and its source slide - needs no storyline critique" };
  const brief = (e) => `${e.id} ${e.dimension} (${e.severity}) on ${(e.pages || []).join(", ") || "the spine"}`;
  if (latest && latest.binding === binding) {
    const open = openBlocking(latest.ledger);
    if (latest.review.verdict === "ready" && !open.length) return { status: "ready", pass: latest.pass, mode: wanted, binding };
    // Provisional: the team has done what the evidence in scope allows, the
    // answer is offered as provisional, and what stays open is recorded with it.
    if (latest.review.verdict === "provisional" && open.length && open.every(limitedBy(evidenceScopeOf(spec))) && answerStatusOf(spec).status === "provisional")
      return { status: "provisional", pass: latest.pass, mode: wanted, binding, limits: open.map(brief), note: "The storyline is provisional, not ready: every open item needs evidence the scope forbids. The deck review may start; delivery records the deck as provisional with these limits" };
    return { status: "revise", pass: latest.pass, mode: wanted, open: open.map(brief), note: "Revise the storyline at the root for the open items, then run this again: it writes the verification pass for what you changed" };
  }
  const ids = storyStructure(spec).filter(isContent).map((p) => p.id);
  const scope = latest ? nextPassScope(latest, storylinePageHashes(spec), { ids, ledger: latest.ledger ?? storylineLedger([], latest.review), maxPasses }) : null;
  if (scope && wanted === "spine") scope.mustInspect = [];
  // Whether the answer moved since the pass being verified: what `narrowed` rests on.
  if (scope) scope.answerChanged = typeof latest.answerHash === "string" && latest.answerHash !== sha256(spec.answer ?? "");
  if (scope?.capped) return { status: "capped", pass: scope.pass, message: capMessage("storyline critique", scope.pass, maxPasses, latest.ledger) };
  const { dir, packet: next } = await buildStorylinePacket(specPath, out, { scope, mode: wanted, revision: changes });
  return { status: "packet-written", pass: next.pass, mode: wanted, dir, binding: next.binding, sections: next.sections?.length ?? 0,
    note: next.sections ? `Give each prompt in ${path.join(dir, "sections")} to its own fresh critic in parallel (no other context), save each answer as ${path.join(dir, "parts", "<id>.json")}, then run storyline.mjs merge` : `Give ${path.join(dir, "prompt.md")} to a fresh critic (no other context) and save its JSON as ${path.join(out, "storyline-review.json")}, then run this again` };
}

function partErrors(part, packet) {
  const meta = part?.part;
  if (!meta || !["section", "spine"].includes(meta.kind)) return ["part must say { kind: section|spine, id, pages }"];
  const structure = schemaErrors(part, { ...STORYLINE_PART_SCHEMA, required: ["part", "binding", "verdict", "rating", "summary", "pages", "findings", "completeness",
    ...(meta.kind === "spine" ? ["spine", "answer", "answerParts", "pillars", "numbers", "sectionFlow", "execSummary", "missingAnalyses", "cutOrMerge", "topFixes", "compliance", "sufficiency"] : [])] }, meta.id);
  if (structure.length) return structure;
  const { ids, insightIds, promptHash } = packetContext(packet);
  const errors = [...itemErrors(part, ids, meta.kind === "section" ? meta.pages : null), ...(promptHash ? provenanceErrors(part, promptHash) : [])];
  const items = storylineItems(part);
  if (meta.kind === "section") {
    errors.push(...coverageErrors(part.pages, meta.pages, "page"), ...completenessErrors(part.completeness, STORYLINE_PAGE_CHECKS, items, "check"));
    const ledger = storylineLedger([], part);
    errors.push(...verdictErrors(part.pages, ledger, "page"), ...sourcingErrors(part.pages, ledger, insightIds));
  } else errors.push(...completenessErrors(part.completeness, SPINE_CHECKS, items.filter((f) => STORYLINE_CHECKS[f.dimension]?.scope === "spine"), "check"));
  return errors;
}

/** Join a long spine's parallel critiques into one first pass, as reviewer.mjs does for the deck. */
export function mergeStorylineParts(parts, packet) {
  const { contentIds } = packetContext(packet);
  const errors = [...parts.flatMap((part) => partErrors(part, packet).map((e) => `${part?.part?.id ?? "part"}: ${e}`)),
    ...partSetErrors(parts, contentIds, { key: "pages", binding: packet.binding, sections: packet.sections })];
  if (errors.length) return { errors };
  const rename = uniqueIds(parts, (p) => [...(p.findings || []), ...(p.missingAnalyses || []), ...(p.cutOrMerge || [])]);
  const relabel = (part, list) => (list || []).map((item) => ({ ...item, id: rename(part, item.id) }));
  const [lead] = parts.filter((p) => p.part.kind === "spine");
  const merged = {
    pass: 1, verifies: null, binding: packet.binding, rating: lead.rating, summary: lead.summary, compliance: lead.compliance, sufficiency: lead.sufficiency, ...(lead.provenance ? { provenance: lead.provenance } : {}),
    spine: lead.spine, answer: lead.answer, answerParts: lead.answerParts, pillars: lead.pillars, numbers: lead.numbers, sectionFlow: lead.sectionFlow, execSummary: lead.execSummary,
    missingAnalyses: relabel(lead, lead.missingAnalyses), cutOrMerge: relabel(lead, lead.cutOrMerge),
    findings: parts.flatMap((p) => relabel(p, p.findings)), topFixes: lead.topFixes, mergedFrom: parts.map((p) => p.part.id),
  };
  const ledger = storylineLedger([], merged);
  const joined = joinParts(parts, contentIds, ledger, { pageKey: "page", dimensions: STORYLINE_DIMENSIONS, dimKey: "check" });
  if (joined.errors.length) return { errors: joined.errors };
  // The section critics' items can reopen what the spine critic judged closed.
  const reopened = openBlocking(ledger).length > 0;
  const within = openBlocking(ledger).filter((e) => !limitedBy(packet.evidenceScope)(e)).length > 0;
  Object.assign(merged, { pages: joined.pages, completeness: joined.completeness, verdict: lead.verdict === "ready" && !reopened ? "ready" : lead.verdict === "provisional" && !within ? "provisional" : "revise",
    ...(within && lead.verdict !== "revise" ? { compliance: { ...lead.compliance, verdict: "incomplete" }, sufficiency: { ...lead.sufficiency, verdict: "insufficient" }, rating: Math.min(lead.rating, RATING_CAPS[openBlocking(ledger).some((e) => e.severity === "blocker") ? "blocker" : "major"]) } : {}) });
  return { review: merged, errors: [] };
}

/** Merge saved parts into out/storyline-review.json and record it. */
export async function mergeStorylineDirectory(specPath, outputDirectory, options = {}) {
  const out = path.resolve(outputDirectory);
  const spec = await readJson(specPath);
  const packet = await readJson(path.join(await lineageStore(spec, out, specPath), PACKET_RECORD), { optional: true });
  if (!packet?.sections) return { status: "invalid", errors: ["no split storyline packet to merge against: run storyline.mjs --full on a long spine first"] };
  const { files, parts } = await readParts(path.join(packet.staging, "parts"));
  const { review, errors } = mergeStorylineParts(parts, packet);
  if (errors.length) return { status: "invalid", errors, parts: files };
  await writeJson(path.join(out, "storyline-review.json"), review);
  return prepareStoryline(specPath, out, options);
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
      const jobs = [...await Promise.all(packet.sections.map(async (s) => ({ id: s.id, prompt: await prompt(s.id) }))), { id: "spine", prompt: await prompt("spine") }];
      const parts = await reviewParts(which, jobs, { partsDir: path.join(step.dir, "parts"), schemaPath: path.join(step.dir, "part-schema.json"), model, timeoutMs, cwd: step.dir, promptHash: packet.promptHash });
      const record = await readJson(path.join(await lineageStore(await readJson(specPath), outputDirectory, specPath), PACKET_RECORD));
      const merged = mergeStorylineParts(parts, record);
      if (merged.errors.length) return { status: "invalid", errors: merged.errors };
      review = merged.review;
    } else review = await callReviewer(which, { prompt: await fs.readFile(path.join(step.dir, "prompt.md"), "utf8"), schemaPath: path.join(step.dir, "schema.json"),
      outPath: path.join(step.dir, "codex-last-message.json"), model, timeoutMs, cwd: step.dir, promptHash: packet.promptHash });
  } catch (error) {
    if (isAuthFailure(error)) return { ...step, note: `The ${which} CLI is not signed in (${String(error.message).split("\n").find((l) => l.trim()) ?? "authentication failed"}), so the packet is left for a critic the calling agent spawns. ${step.note}` };
    throw error;
  }
  await writeJson(path.join(outputDirectory, "storyline-review.json"), review);
  const next = await prepareStoryline(specPath, outputDirectory, { maxPasses });
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
