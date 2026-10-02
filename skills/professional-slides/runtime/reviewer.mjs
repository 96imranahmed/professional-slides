// Model review behind an interface. One rubric, three schemas (the exhaustive
// first pass, the verification passes after it, and the confirmation read),
// and a `repair` that has to be a sentence. Backends:
//   codex   — `codex exec --image … --output-schema`  (OpenAI Codex CLI; model from rules.json `reviewer`)
//   claude  — `claude -p … --output-format json`       (Claude Code CLI; reads the PNGs itself)
//   packet  — no model call: stages the packet for the calling agent to review and
//             answer with `deliver-deck.mjs … --review review.json`. `auto` picks the
//             host's own CLI (claude inside Claude Code, codex inside Codex), then the
//             other, and writes a packet when neither is on the path or signed in, so an
//             agent session that reviews with its own subagents asks for `packet`.
//
//   node runtime/reviewer.mjs merge <id>.deck.json out/ [parts-dir]
//                                   joins a split first pass into out/review.json
//                                   (exit codes: EXIT in errors.mjs)
//
// The first pass is exhaustive: a verdict and a note per rubric dimension for
// every page, every deck-level finding with every page it affects, and a
// completeness self-check. A long deck is read by parallel section reviewers
// and one spine reviewer, merged here into one review. Every later pass is a
// verification (review-passes.mjs): a status for each open finding, and new
// findings only where they are serious and additive. A deck is accepted at a
// rating of ACCEPT_RATING or more with nothing major open; when the accepting
// pass is a verification, a confirmation read - a fresh reader with no ledger,
// no earlier rating and no earlier findings - must accept the final artifact
// too. Every packet is staged in a clean directory with only what the reviewer
// is given, carries the user's verbatim request, and ends with the prompt hash
// the answer's provenance echoes. The deck review is not prepared at all until
// the storyline critique is ready for the current spine.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { normalizeText, textWords } from "./text-contract.mjs";
import { storylineGate, readStorylineHistory, STORYLINE_CHECKS, STORYLINE_PAGE_CHECKS } from "./storyline.mjs";
import { designStatistics, measurePasses, DOWNGRADE_MEASURES } from "./build-bars.mjs";
import {
  SEVERITIES, PAGE_VERDICTS, STATUSES, NEW_BASES, MAX_PASSES, SEVERITY_DEFINITIONS, BLOCKING, ACCEPT_RATING, MAX_CONFIRMATIONS,
  pageListErrors, advanceLedger, openEntries, openBlocking, verificationErrors, coverageErrors, verdictErrors, completenessErrors,
  uniqueIds, detectBackend, nextPassScope, splitSections, partSetErrors, joinParts, readParts, callReviewer, reviewParts, readPasses, recordPass,
  PROVENANCE_SCHEMA, provenanceLine, provenanceErrors, sha256, requestOf, deckStatementFindings, unknownKeyErrors, stageReview, lineageStore, isAuthFailure, readConfirmations,
} from "./review-passes.mjs";

export { MAX_PASSES, MAX_CONFIRMATIONS, designStatistics };
// The reviewer's own vocabulary. A defect a build check also names keeps that
// check's code - LAYOUT_MONOTONY (page_gates.py), MISSING_EVIDENCE (the
// composer) - rather than a second registration of it here, and a code means
// one thing wherever it is raised: the gate's MISSING_ARGUMENT is a picture or
// comparison page with no argument drawn on it, so the reviewer's broader
// judgement is UNCLEAR_ARGUMENT.
export const CODES = Object.freeze({
  // facts and evidence
  FACTUAL_ERROR: "a stated number, name or date is wrong",
  UNSUPPORTED_CLAIM: "a claim the cited evidence does not support",
  MISLEADING_COMPARISON: "values compared across incompatible bases without saying so",
  UNCLEAR_ARGUMENT: "the page's purpose or necessary inference is unclear from its title, evidence and commentary together",
  // legibility and geometry
  UNREADABLE: "text too small, clipped or low-contrast to read",
  OVERFLOW: "content exceeds its box or the slide",
  BROKEN_GEOMETRY: "misaligned, overlapping or orphaned elements",
  PROVENANCE: "a number or claim with no traceable source, basis or as-at date",
  // design — these block too
  DEAD_SPACE: "a large empty band the page does nothing with",
  NO_HERO_EXHIBIT: "an analytical page with no dominant exhibit",
  OVERSIZED_TYPE: "body or chart type set larger than a reader expects on a slide",
  WALL_OF_TEXT: "prose doing the work an exhibit should do",
  BURIED_NUMBER: "a decisive number in a sentence instead of on a mark",
  HEDGED_TITLE: "an action title that does not commit to a finding",
  INCONSISTENT_ENCODING: "the same measure encoded differently across pages",
  // beautification - the pass a threshold cannot make
  NO_VISUAL_ANCHOR: "recognition or visible evidence matters, but the page supplies no useful visual anchor",
  UNANNOTATED_PLOT: "a necessary comparison or threshold is difficult to locate without an annotation",
  TABLE_MONOTONY: "repeated table grammar obscures a meaningful difference in evidence relationships",
  MIXED_GRAMMAR: "different evidence grammars share a page without a clear relationship or reading order",
  DECORATION: "a rule, band or device that separates nothing and says nothing",
  NARROW_REPERTOIRE: "the deck draws on a handful of exhibits where its evidence has many shapes",
  TRIVIAL_CHART: "a chart that shows two or three numbers a metric would state, or a comparison too obvious to need drawing",
  NO_INSIGHT_CHART: "a chart that displays data without making the implication visible: no trend and growth rate, no ranking across the full set, no share, no gap to a benchmark",
  DEVICE_OVERUSE: "one construction (steps, cards, a bar chart) carries pages whose evidence has different shapes",
  FLAT_TABLE: "a table that compares, rates or judges but is set as a plain grid: no Harvey balls, ratings, bars, status or implication column",
  MISSING_CONTEXT: "named players, places or products appear without being introduced: no page with their logos, what they are and the numbers that matter",
  MAP_DESIGN: "a map that misplaces cities, fills countries that mean nothing, draws markers that cover the geography, or omits the routes or flows it is about",
  // density - the review's pass over the rendered density profile
  DENSITY_MISMATCH: "a page's words are thinner, denser or differently shaped than the skill's targets for pages doing its job, and it shows",
  EDITORIAL: "a wording preference"
});

// A flagged page is right, or it is wrong in one of three ways. Only "right"
// lets the deck through: the profile's flag is a question, the verdict is the
// answer, and a padded page that cleared the hard floor is answered here.
export const DENSITY_VERDICTS = Object.freeze(["right", "too thin", "too dense", "wrong shape"]);

/**
 * The rubric: every dimension the review checks, and on what. The eight page
 * dimensions are checked on every page and each gets a note in the page's
 * coverage entry; the three deck dimensions are checked across the sequence.
 * references/taste-review.md#the-rubric states the same list for the reader.
 */
export const RUBRIC = Object.freeze({
  argument: { scope: "page", checks: "the title states the finding the page proves and the exhibit and commentary prove it; the claim goes no further than its evidence; the page's job in the argument is clear" },
  evidence: { scope: "page", checks: "members compared on the same measures, with n/a where one does not publish a measure - never a different metric per member; every number reproduced against its source and against the other pages that print it; evidence deep enough for the claim (the whole peer set, the trend with its rate, not two numbers); bases, units and periods compatible" },
  chart: { scope: "page", checks: "the chart form fits the comparison (ranking, trend, share, bridge, distribution); honest axes - time spaced by time, bars from a zero baseline, scale and units stated; the subject highlighted and rivals muted; an annotation marks the finding (the gap, the break, the rate); not a two-number chart" },
  table: { scope: "page", checks: "verdict, score and status cells encoded (Harvey balls, ratings, pills, bars), not plain words; totals defined and filled; units in the headers; numbers right-aligned and rounded alike; row and column order meaningful" },
  text: { scope: "page", checks: "density right for the reading task; the longest block readable; no sentence restating the title or the exhibit; jargon and acronyms explained; the action title commits to a finding in two lines or fewer; the subtitle adds scope, not a second title" },
  layout: { scope: "page", checks: "no empty band; the exhibit dominates and the page is balanced; edges aligned; hierarchy reads title, exhibit, commentary; the frame is occupied, not a small figure in a large box" },
  identity: { scope: "page", checks: "named companies, products and places carry their visual anchors where the reader needs recognition - logos, product images, maps; a player is introduced before it is compared" },
  sourcing: { scope: "page", checks: "every number and claim has a source line a reader can look up, with its as-at date; footnotes define estimates, bases and exclusions" },
  consistency: { scope: "deck", checks: "no construction repeated across a window of neighbouring pages; equal things styled alike; one term for one thing; one number format, unit and rounding per measure" },
  rhythm: { scope: "deck", checks: "sections open, develop and close; page types vary with the reading task; the sequence builds rather than repeats; no page previews or re-proves another" },
  bookends: { scope: "deck", checks: "the executive summary states the answer and the pillars the body proves, with the numbers the body shows; the close states the decision, its conditions and the next step, and agrees with the summary" },
});
export const DIMENSIONS = Object.freeze(Object.keys(RUBRIC));
export const PAGE_DIMENSIONS = Object.freeze(DIMENSIONS.filter((d) => RUBRIC[d].scope === "page"));
export const DECK_DIMENSIONS = Object.freeze(DIMENSIONS.filter((d) => RUBRIC[d].scope === "deck"));
export const ASSESSMENT_KEYS = Object.freeze(["argument", "evidence", "visual", "copy", "sequence", "bestPage", "worstPage", "mostRepetitive", "mostDeletable"]);

const HASH = { type: "string", pattern: "^[a-f0-9]{64}$" };
const CHECKABLE_SCHEMA = {
  type: ["object", "null"], additionalProperties: false, required: ["rule", "measure"],
  properties: { rule: { type: "string", minLength: 10 }, measure: { type: "string", minLength: 10 } }
};
const FINDING_PROPERTIES = {
  id: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_.-]*$" },
  // A page finding is one page; a deck finding is a defect of the deck or one
  // recurring across pages, and `slides` lists every page it affects.
  scope: { type: "string", enum: ["page", "deck"] },
  slides: { type: "array", items: { type: "string" }, minItems: 1 },
  dimension: { type: "string", enum: DIMENSIONS },
  code: { type: "string", pattern: "^[A-Z][A-Z0-9_]+$" },
  severity: { type: "string", enum: SEVERITIES },
  reason: { type: "string", minLength: 20 },
  repair: { type: "string" },
  checkable: CHECKABLE_SCHEMA,
};
const FINDING = { type: "object", additionalProperties: false, required: Object.keys(FINDING_PROPERTIES), properties: FINDING_PROPERTIES };
const NEW_FINDING = {
  type: "object", additionalProperties: false, required: [...Object.keys(FINDING_PROPERTIES), "basis", "justification", "evidence"],
  // `evidence` quotes the page, exactly as printed; required for a missed finding.
  properties: { ...FINDING_PROPERTIES, basis: { type: "string", enum: Object.keys(NEW_BASES) }, justification: { type: "string" }, evidence: { type: "string" } }
};
const PAGE_ENTRY = {
  type: "object", additionalProperties: false, required: ["slide", "verdict", "checks"],
  properties: {
    slide: { type: "string" },
    verdict: { type: "string", enum: PAGE_VERDICTS },
    checks: { type: "object", additionalProperties: false, required: PAGE_DIMENSIONS,
      properties: Object.fromEntries(PAGE_DIMENSIONS.map((d) => [d, { type: "string", minLength: 2 }])) }
  }
};
const STATUS = {
  type: "object", additionalProperties: false, required: ["finding", "status", "evidence"],
  properties: {
    finding: { type: "string" },
    status: { type: "string", enum: STATUSES },
    evidence: { type: "string", minLength: 20 },
    // The residual severity of a partly fixed finding, when it is now less.
    severity: { type: "string", enum: SEVERITIES },
    // Where a partly fixed deck finding still stands.
    slides: { type: "array", items: { type: "string" } }
  }
};
const DENSITY = {
  // The density pass: the rendered pages measured against the skill's density
  // targets (density-profile.json), judged. `deck` compares the deck's medians
  // with those targets; `pages` holds a verdict for every flagged page.
  type: "object", additionalProperties: false, required: ["deck", "pages"],
  properties: {
    deck: { type: "string", minLength: 40 },
    pages: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["slide", "verdict", "reason"],
        properties: { slide: { type: "string" }, verdict: { type: "string", enum: DENSITY_VERDICTS }, reason: { type: "string", minLength: 20 },
          // A verdict of right on a prose page whose blocks run outside the
          // band quotes the developed point that makes it right, as printed.
          point: { type: "string" } }
      }
    }
  }
};
const COMPLETENESS = {
  type: "array",
  items: { type: "object", additionalProperties: false, required: ["dimension", "result", "note"],
    properties: { dimension: { type: "string", enum: DIMENSIONS }, result: { type: "string", enum: ["findings", "clean"] }, note: { type: "string" } } }
};
const ASSESSMENT = { type: "object", additionalProperties: false, required: ASSESSMENT_KEYS,
  properties: Object.fromEntries(ASSESSMENT_KEYS.map((k) => [k, { type: "string", minLength: 10 }])) };
// A verdict on each build-bar waiver the packet shows: the deck misses a bar
// and says why it is right to; delivery needs the reviewer to confirm it.
export const WAIVER_VERDICTS = Object.freeze(["confirmed", "refused"]);
const WAIVERS = { type: "array", items: { type: "object", additionalProperties: false, required: ["code", "verdict", "reason"],
  properties: { code: { type: "string" }, verdict: { type: "string", enum: WAIVER_VERDICTS }, reason: { type: "string", minLength: 20 } } } };
const COMMON = {
  binding: HASH,
  rating: { type: "number", minimum: 0, maximum: 10 },
  accepted: { type: "boolean" },
  summary: { type: "string", minLength: 20 },
  density: DENSITY,
  // The pages this reader actually opened at full size - not the pages the
  // binding covers. A full or confirmation read opens every page.
  opened: { type: "array", items: { type: "string" } },
  provenance: PROVENANCE_SCHEMA,
  waivers: WAIVERS,
};

/** Pass one: exhaustive. Every page, every dimension, every affected page, and what found nothing. */
export const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["pass", "verifies", "accepted", "summary", "rating", "binding", "opened", "provenance", "pages", "findings", "completeness", "assessment", "density"],
  properties: {
    pass: { type: "integer", enum: [1] },
    verifies: { type: "null" },
    ...COMMON,
    pages: { type: "array", items: PAGE_ENTRY },
    findings: { type: "array", items: FINDING },
    completeness: COMPLETENESS,
    assessment: ASSESSMENT,
    // Set by the merge: the section and spine parts this review was joined from.
    mergedFrom: { type: "array", items: { type: "string" } },
  }
};

/** Pass two and after: a status for every open finding, and only additive new findings. */
export const VERIFICATION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["pass", "verifies", "accepted", "summary", "rating", "binding", "opened", "provenance", "pages", "statuses", "findings", "density"],
  properties: {
    pass: { type: "integer", minimum: 2 },
    // The binding of the review this pass verifies: the lineage.
    verifies: HASH,
    ...COMMON,
    pages: { type: "array", items: PAGE_ENTRY },
    statuses: { type: "array", items: STATUS },
    findings: { type: "array", items: NEW_FINDING },
  }
};

/**
 * The confirmation read: a fresh reader of the final artifact after a
 * verification pass accepted it, told nothing of the ledger, the earlier
 * ratings or the earlier findings. It opens every page, gives each a verdict
 * and a note, and rates the deck on what it sees.
 */
export const CONFIRMATION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["confirms", "accepted", "summary", "rating", "binding", "opened", "provenance", "pages", "findings", "assessment"],
  properties: {
    // The binding of the verification pass whose acceptance this read confirms.
    confirms: HASH,
    ...COMMON,
    pages: { type: "array", items: { type: "object", additionalProperties: false, required: ["slide", "verdict", "note"],
      properties: { slide: { type: "string" }, verdict: { type: "string", enum: PAGE_VERDICTS }, note: { type: "string", minLength: 10 } } } },
    findings: { type: "array", items: FINDING },
    assessment: ASSESSMENT,
  }
};
delete CONFIRMATION_SCHEMA.properties.density;

/** One reviewer's share of a long deck's first pass: a section of pages, or the spine. */
export const PART_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["part", "binding", "accepted", "summary", "rating", "opened", "provenance", "pages", "findings", "completeness"],
  properties: {
    part: { type: "object", additionalProperties: false, required: ["kind", "id", "slides"],
      properties: { kind: { type: "string", enum: ["section", "spine"] }, id: { type: "string" }, slides: { type: "array", items: { type: "string" } } } },
    ...COMMON,
    pages: { type: "array", items: PAGE_ENTRY },
    findings: { type: "array", items: FINDING },
    completeness: COMPLETENESS,
    assessment: ASSESSMENT,
  }
};

// A finding a deterministic check could have caught before the build names the
// check it wants: `rule` (what must hold, said as a rule) and `measure` (what
// to measure and against what threshold). Judgement - the argument, emphasis,
// whether a page is worth reading - leaves it null. Every checkable finding is
// a review spent on something code should have refused, so recordReview keeps
// them as candidates for a compile-time or composition check.
export const CHECKABLE = "checkable: { rule, measure } when a deterministic check on the pages file, the composed scene or the render could have caught the defect before the build (a callout covering a data label, a title over two lines, a caption repeating its heading); null for judgement (the argument, emphasis, whether the page is worth reading, whether the evidence supports the claim)";

const REPAIR_VERB = /\b(add|replace|move|merge|cut|rewrite|split|show|plot|label|reduce|enlarge|use|drop|state|cite|fill|define|align|highlight|annotate|redraw|respace|encode|introduce|source|shorten|convert)\b/i;

/** A review's findings in ledger form; an old review's `slide` reads as a one-page list. */
export function deckItems(review) {
  const items = (review?.findings || []).map((f, i) => ({
    id: f.id ?? `F${i + 1}`, code: f.code, severity: f.severity, scope: f.scope ?? (f.slide ? "page" : "deck"), dimension: f.dimension ?? null,
    pages: Array.isArray(f.slides) ? f.slides : f.slide ? [f.slide] : [], reason: f.reason, repair: f.repair,
    ...(f.basis ? { basis: f.basis, justification: f.justification, evidence: f.evidence } : {}),
  }));
  // A density verdict other than "right" blocks as a finding would, and is
  // carried in the ledger so the next pass re-judges that page.
  for (const entry of review?.density?.pages || []) {
    if (entry.verdict === "right") continue;
    items.push({ id: `density:${entry.slide}`, code: "DENSITY_MISMATCH", severity: "major", scope: "page", dimension: "text", pages: [entry.slide],
      reason: `${entry.verdict}: ${entry.reason}`,
      repair: "Rewrite the page to the skill's density targets for pages doing its job: add the missing reasoning, cut the padding, or split the long block into points" });
  }
  return items;
}

// A density item takes its status from the density verdict this pass gives the
// page: "right" fixes it, anything else keeps it open.
const isDensity = (entry) => String(entry.id).startsWith("density:");
function withDensityStatuses(review, ledger) {
  const judged = new Map((review?.density?.pages || []).map((p) => [p.slide, p]));
  const auto = openEntries(ledger).filter(isDensity).filter((e) => judged.has(e.pages[0])).map((e) => {
    const page = judged.get(e.pages[0]);
    return { finding: e.id, status: page.verdict === "right" ? "fixed" : "not fixed", evidence: `density ${page.verdict}: ${page.reason}` };
  });
  return { ...review, statuses: [...(review?.statuses || []), ...auto] };
}

/**
 * The ledger after this review: the prior ledger with its statuses applied and
 * its new findings added. `downgrade(entry)` says which entries a partly fixed
 * status may lower (downgradeRule).
 */
export function deckLedger(priorLedger, review, { downgrade = () => false } = {}) {
  const items = deckItems(review);
  if (!priorLedger?.length) return advanceLedger([], review, items);
  // A later pass's density item for a page that stays wrong is the same item, not a new one.
  return advanceLedger(priorLedger, withDensityStatuses(review, priorLedger), items, { downgrade });
}

/**
 * Which open deck findings a partly fixed status may lower on this build: a
 * deck-scope finding whose code has a deterministic measure (build-bars.mjs
 * DOWNGRADE_MEASURES) that now passes on the scene for the pages it names.
 * Everything else keeps its severity until it is fixed.
 */
export const downgradeRule = (scene) => (entry) => entry?.scope === "deck" && measurePasses(entry.code, scene, entry.pages);

/** Every page's text, as printed: what a missed finding's quoted evidence is checked against. */
export function pageTexts(scene) {
  return Object.fromEntries((scene?.slides || []).map((s) => [s.id, (s.nodes || []).filter((n) => n.type === "text").map((n) => n.data?.textLayout?.source ?? n.text ?? "").join("\n")]));
}

function findingErrors(findings, ids) {
  const errors = [];
  const seen = new Set();
  for (const [i, f] of findings.entries()) {
    const at = `findings[${i}]${f?.id ? ` (${f.id})` : ""}`;
    if (!f || typeof f !== "object") { errors.push(`${at}: not an object`); continue; }
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(f.id ?? "")) errors.push(`${at}: give the finding an id (F1, F2, ...) so a later pass can report its status`);
    else if (seen.has(f.id)) errors.push(`${at}: id ${f.id} is used twice`);
    seen.add(f.id);
    if (!["page", "deck"].includes(f.scope)) errors.push(`${at}: scope must be page or deck`);
    errors.push(...pageListErrors(at, { scope: f.scope, pages: f.slides, text: `${f.reason ?? ""} ${f.repair ?? ""}`, ids }));
    if (!DIMENSIONS.includes(f.dimension)) errors.push(`${at}: dimension must be one of ${DIMENSIONS.join(", ")}`);
    if (!/^[A-Z][A-Z0-9_]+$/.test(f.code ?? "")) errors.push(`${at}: invalid code ${f.code}`);
    if (!SEVERITIES.includes(f.severity)) errors.push(`${at}: unknown severity ${f.severity}`);
    if (typeof f.reason !== "string" || f.reason.trim().length < 20) errors.push(`${at}: the reason says what is wrong on the page`);
    if (BLOCKING.has(f.severity) && f.code === "EDITORIAL") errors.push(`${at}: EDITORIAL cannot be ${f.severity}`);
    if (f.severity !== "none" && SEVERITIES.includes(f.severity)) {
      const floor = BLOCKING.has(f.severity) ? 40 : 25;
      if (typeof f.repair !== "string" || f.repair.trim().length < floor || !REPAIR_VERB.test(f.repair)) errors.push(`${at}: a ${f.severity} finding needs a concrete repair sentence saying what to add, replace, move, merge, cut, plot or rewrite`);
    }
    if (f.checkable === undefined) errors.push(`${at}: checkable is required - { rule, measure } or null`);
    else if (f.checkable !== null) {
      const c = f.checkable;
      if (typeof c !== "object" || Array.isArray(c)) errors.push(`${at}: checkable must be { rule, measure } or null`);
      else {
        for (const key of ["rule", "measure"]) if (typeof c[key] !== "string" || c[key].trim().length < 10) errors.push(`${at}: checkable.${key} must say ${key === "rule" ? "what must hold" : "what to measure and against what"}`);
        const extra = Object.keys(c).filter((key) => !["rule", "measure"].includes(key));
        if (extra.length) errors.push(`${at}: checkable takes rule and measure only (got ${extra.join(", ")})`);
      }
    }
  }
  return errors;
}

function pageCheckErrors(pages) {
  const errors = [];
  for (const entry of pages || []) {
    const checks = entry?.checks;
    const missing = PAGE_DIMENSIONS.filter((d) => typeof checks?.[d] !== "string" || checks[d].trim().length < 2);
    if (missing.length) errors.push(`pages ${entry?.slide}: note what was checked for ${missing.join(", ")} ("n/a - no chart" where a dimension does not apply)`);
  }
  return errors;
}

function basicErrors(review) {
  const errors = [];
  if (typeof review.accepted !== "boolean") errors.push("accepted must be boolean");
  if (typeof review.summary !== "string" || review.summary.trim().length < 20) errors.push("summary must be a sentence");
  if (!Number.isFinite(review.rating) || review.rating < 0 || review.rating > 10) errors.push("rating must be a number from zero to ten");
  return errors;
}

/** The pages a reader says it opened, against the pages it had to open. */
function openedErrors(opened, required, ids) {
  if (!Array.isArray(opened)) return ["opened must list every page you opened at full size (the page ids)"];
  const errors = [];
  const unknown = opened.filter((id) => !ids.includes(id));
  if (unknown.length) errors.push(`opened: unknown page${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`);
  const unopened = required.filter((id) => !opened.includes(id));
  if (unopened.length) errors.push(`opened: this read must open ${unopened.length === ids.length ? "every page" : "every page it was given"} at full size; not opened: ${unopened.join(", ")}`);
  return errors;
}

/**
 * A revision's first pass reads the pages the revision changed: one entry for
 * each of them and none for the user's pages as they stand, and findings only
 * where a changed page is involved.
 */
function revisionErrors(review, revision, items) {
  const changed = new Set(revision.changed);
  const errors = [];
  const listed = (review.pages || []).map((p) => p?.slide);
  const missing = revision.changed.filter((id) => !listed.includes(id));
  if (missing.length) errors.push(`pages: a revision's first pass covers every page it changed; missing ${missing.join(", ")}`);
  const unchanged = listed.filter((id) => !changed.has(id));
  if (unchanged.length) errors.push(`pages: ${unchanged.join(", ")} did not change in this revision; they are the user's pages as they stand and take no entry`);
  for (const item of items) if (!(item.pages || []).some((id) => changed.has(id)))
    errors.push(`findings (${item.id}): ${(item.pages || []).join(", ")} did not change in this revision; a finding names a page the revision changed`);
  return errors;
}

/**
 * Exactly one verdict for each waiver the packet showed, and none for a bar it
 * did not: two verdicts on one waiver leave acceptance to pick between them.
 */
function waiverVerdictErrors(verdicts, waivers = []) {
  if (!waivers.length) return verdicts?.length ? ["waivers: the packet showed no waivers; leave waivers empty"] : [];
  if (!Array.isArray(verdicts)) return [`waivers: give a verdict (confirmed or refused, with the reason) for each waiver: ${waivers.map((w) => w.code).join(", ")}`];
  const errors = [];
  const codes = waivers.map((w) => w.code);
  for (const [i, v] of verdicts.entries()) {
    if (!codes.includes(v?.code)) errors.push(`waivers[${i}]: ${v?.code} is not a waiver the packet showed`);
    else if (verdicts.findIndex((other) => other?.code === v.code) !== i) errors.push(`waivers[${i}]: a second verdict for ${v.code}; give one verdict per waiver`);
    if (!WAIVER_VERDICTS.includes(v?.verdict)) errors.push(`waivers[${i}]: verdict must be confirmed or refused`);
    if (typeof v?.reason !== "string" || v.reason.trim().length < 20) errors.push(`waivers[${i}]: say why the deck is or is not right to miss the bar`);
  }
  const missing = codes.filter((code) => !verdicts.some((v) => v?.code === code));
  if (missing.length) errors.push(`waivers: no verdict for ${missing.join(", ")}`);
  return errors;
}

// A rating below the acceptance bar says substantial work is still needed;
// that work is the findings, or the author has nothing to repair.
const ratingErrors = (review, open) => (Number.isFinite(review.rating) && review.rating < ACCEPT_RATING && !open.length
  ? [`rating ${review.rating} is below the acceptance bar of ${ACCEPT_RATING} while no major or blocker finding is open: a deck rated below ${ACCEPT_RATING} still needs substantial work, so file that work as major findings with their repairs`] : []);

/**
 * Validate a deck review. With no scope it is the exhaustive first pass;
 * with a scope (verificationScope) it is a later pass checked against the
 * ledger it verifies. `waivers` are the build-bar waivers the packet showed;
 * `downgrade` (downgradeRule) and `pageText` (pageTexts) hold a verification
 * pass's residual severities and missed findings to the rebuilt scene.
 */
export function validateReview(review, slideIds, { scope = null, ledger = [], waivers = [], downgrade = () => false, pageText = null, revision = null } = {}) {
  if (!review || typeof review !== "object") return ["review is not an object"];
  const errors = [...unknownKeyErrors(review, scope ? VERIFICATION_SCHEMA : REVIEW_SCHEMA, "review"), ...basicErrors(review)];
  if (!Array.isArray(review.findings)) return [...errors, "findings must be an array"];
  errors.push(...findingErrors(review.findings, slideIds));
  if (!Array.isArray(review.pages)) return [...errors, "pages must hold one coverage entry per page read"];
  errors.push(...pageCheckErrors(review.pages));
  errors.push(...openedErrors(review.opened, scope ? scope.mustInspect : revision ? revision.changed : slideIds, slideIds));
  errors.push(...waiverVerdictErrors(review.waivers, waivers));
  const items = deckItems({ findings: review.findings });
  if (scope) {
    errors.push(...verificationErrors(review, { scope, ledger, items, ids: slideIds, automatic: isDensity, downgrade, pageText }));
  } else {
    if (review.pass !== 1) errors.push("pass must be 1: this is the first, exhaustive pass");
    if (review.verifies !== null && review.verifies !== undefined) errors.push("verifies is null on the first pass");
    errors.push(...(revision ? revisionErrors(review, revision, items) : coverageErrors(review.pages, slideIds)));
    errors.push(...completenessErrors(review.completeness, DIMENSIONS, items));
    const assessment = review.assessment;
    const thin = ASSESSMENT_KEYS.filter((k) => typeof assessment?.[k] !== "string" || assessment[k].trim().length < 10);
    if (thin.length) errors.push(`assessment: write ${thin.join(", ")}`);
  }
  const after = deckLedger(scope ? ledger : [], review, { downgrade });
  // Density verdicts sit beside the findings rather than in page verdicts: a
  // page judged "too dense" is blocked by that verdict, not asked to repeat it.
  errors.push(...verdictErrors(review.pages, after.filter((e) => !isDensity(e))));
  const open = openBlocking(after);
  if (review.accepted === true && open.length) errors.push("accepted cannot be true while a major or blocker finding is open");
  errors.push(...ratingErrors(review, open));
  return errors;
}

/**
 * Validate a confirmation read: the confirmation schema, every page opened and
 * given a verdict, the findings held to the first pass's rules, and bound to
 * the verification pass it confirms.
 */
export function validateConfirmation(review, slideIds, { confirms, waivers = [] } = {}) {
  if (!review || typeof review !== "object") return ["confirmation is not an object"];
  const errors = [...unknownKeyErrors(review, CONFIRMATION_SCHEMA, "confirmation"), ...basicErrors(review)];
  if (review.confirms !== confirms) errors.push(`confirms must be ${confirms}, the binding of the verification pass this read confirms`);
  if (!Array.isArray(review.findings)) return [...errors, "findings must be an array"];
  errors.push(...findingErrors(review.findings, slideIds));
  errors.push(...coverageErrors(review.pages, slideIds));
  for (const entry of Array.isArray(review.pages) ? review.pages : []) if (typeof entry?.note !== "string" || entry.note.trim().length < 10) errors.push(`pages ${entry?.slide}: say in a note what you saw on the page`);
  errors.push(...openedErrors(review.opened, slideIds, slideIds));
  errors.push(...waiverVerdictErrors(review.waivers, waivers));
  const thin = ASSESSMENT_KEYS.filter((k) => typeof review.assessment?.[k] !== "string" || review.assessment[k].trim().length < 10);
  if (thin.length) errors.push(`assessment: write ${thin.join(", ")}`);
  const ledger = advanceLedger([], {}, deckItems({ findings: review.findings }));
  if (Array.isArray(review.pages)) errors.push(...verdictErrors(review.pages, ledger));
  const open = openBlocking(ledger);
  if (review.accepted === true && open.length) errors.push("accepted cannot be true while a major or blocker finding is open");
  errors.push(...ratingErrors(review, open));
  return errors;
}

/**
 * Validate one part of a split first pass. A section part covers its own
 * pages on every page dimension; the spine part covers the deck dimensions
 * and writes the deck's assessment, rating and density comparison.
 */
export function validatePart(part, slideIds, { waivers = [] } = {}) {
  if (!part || typeof part !== "object") return ["part is not an object"];
  const meta = part.part;
  if (!meta || !["section", "spine"].includes(meta.kind) || typeof meta.id !== "string") return ["part must say { kind: section|spine, id, slides }"];
  const errors = [...unknownKeyErrors(part, PART_SCHEMA, "part"), ...basicErrors(part)];
  if (!/^[a-f0-9]{64}$/.test(part.binding ?? "")) errors.push("binding is missing");
  if (!Array.isArray(part.findings)) return [...errors, "findings must be an array"];
  errors.push(...findingErrors(part.findings, slideIds));
  const items = deckItems({ findings: part.findings });
  if (meta.kind === "section") {
    const own = new Set(meta.slides || []);
    const outside = [...new Set(items.flatMap((f) => f.pages).filter((id) => !own.has(id)))];
    if (outside.length) errors.push(`findings name ${outside.join(", ")}, outside this section; the spine reviewer files deck findings across sections`);
    errors.push(...coverageErrors(part.pages, meta.slides || []), ...pageCheckErrors(part.pages));
    errors.push(...openedErrors(part.opened, meta.slides || [], slideIds));
    errors.push(...completenessErrors(part.completeness, PAGE_DIMENSIONS, items));
    errors.push(...verdictErrors(part.pages, advanceLedger([], {}, items)));
  } else {
    errors.push(...waiverVerdictErrors(part.waivers, waivers));
    errors.push(...completenessErrors(part.completeness, DECK_DIMENSIONS, items.filter((f) => DECK_DIMENSIONS.includes(f.dimension))));
    const thin = ASSESSMENT_KEYS.filter((k) => typeof part.assessment?.[k] !== "string" || part.assessment[k].trim().length < 10);
    if (thin.length) errors.push(`assessment: write ${thin.join(", ")}`);
  }
  return errors;
}

/**
 * Join a long deck's parts into one first-pass review. Findings keep their
 * ids unless two parts used the same one; deck findings with the same code and
 * dimension - the same recurring defect seen from several sections - become
 * one finding over the union of their pages at the worst severity. Page
 * verdicts are recomputed from the joined findings, since a spine finding can
 * raise a page a section reviewer passed.
 */
export function mergeReviewParts(parts, slideIds, { sections = null, binding, promptHash = null, waivers = [] } = {}) {
  const errors = [...parts.flatMap((part) => validatePart(part, slideIds, { waivers }).map((e) => `${part?.part?.id ?? "part"}: ${e}`)),
    ...partSetErrors(parts, slideIds, { key: "slides", sections, binding }),
    // Every part answers the same packet: the prompt hash it printed.
    ...(promptHash ? parts.flatMap((part) => provenanceErrors(part, promptHash).map((e) => `${part?.part?.id ?? "part"}: ${e}`)) : [])];
  if (errors.length) return { errors };

  const order = new Map(slideIds.map((id, i) => [id, i]));
  const sort = (list) => [...new Set(list)].sort((a, b) => order.get(a) - order.get(b));
  const rename = uniqueIds(parts, (p) => p.findings || []);
  const [lead] = parts.filter((p) => p.part.kind === "spine");
  const findings = [];
  const byKey = new Map();
  for (const part of [lead, ...parts.filter((p) => p.part.kind === "section")]) for (const f of part.findings) {
    const finding = { ...f, id: rename(part, f.id), slides: sort(f.slides) };
    const key = `${f.code}\u0000${f.dimension}`;
    const same = f.scope === "deck" ? byKey.get(key) : null;
    if (!same) { findings.push(finding); if (f.scope === "deck") byKey.set(key, finding); continue; }
    same.slides = sort([...same.slides, ...finding.slides]);
    if (!same.reason.includes(finding.reason)) same.reason = `${same.reason} / ${finding.reason}`;
    if (SEVERITIES.indexOf(finding.severity) > SEVERITIES.indexOf(same.severity)) { same.severity = finding.severity; same.repair = finding.repair; }
    same.checkable = same.checkable ?? finding.checkable ?? null;
  }
  const joined = joinParts(parts, slideIds, advanceLedger([], {}, deckItems({ findings })), { pageKey: "slide", dimensions: DIMENSIONS, dimKey: "dimension" });
  if (joined.errors.length) return { errors: joined.errors };
  const { pages, completeness } = joined;
  const densityPages = new Map();
  for (const part of parts) for (const p of part.density?.pages || []) if (!densityPages.has(p.slide)) densityPages.set(p.slide, p);
  const review = {
    pass: 1, verifies: null, binding: lead.binding, rating: lead.rating, summary: lead.summary,
    opened: sort(parts.filter((p) => p.part.kind === "section").flatMap((p) => p.opened || [])), provenance: lead.provenance,
    ...(lead.waivers ? { waivers: lead.waivers } : {}), pages, findings, completeness,
    assessment: lead.assessment, density: { deck: lead.density?.deck ?? "", pages: [...densityPages.values()] },
    mergedFrom: parts.map((p) => p.part.id),
  };
  review.accepted = parts.every((p) => p.accepted === true) && !openBlocking(deckLedger([], review)).length;
  return { review, errors: [] };
}

/**
 * Split a long deck for parallel first-pass reviewers (splitSections): a
 * section per divider, the divider read with its section. A spine reviewer
 * reads the whole sequence alongside them.
 */
export const SECTION_REVIEW_THRESHOLD = 24;
export function reviewSections(scene, { max = 14 } = {}) {
  const isDivider = (s) => !s.nodes?.some((n) => n.role === "action-title" || n.role === "cover-title")
    && ((s.componentInstances || []).some((c) => /section/.test(String(c.component))) || (s.nodes || []).some((n) => /divider|section-title/.test(String(n.role))));
  const titleOf = (s) => (s.nodes || []).find((n) => n.type === "text" && n.text)?.text?.replace(/\n/g, " ") ?? s.id;
  return splitSections(scene.slides.map((s, i) => ({ id: s.id, title: titleOf(s), opens: i > 0 && isDivider(s) })), { max, key: "slides" });
}

/**
 * Bind a visual review to the exact editable file, scene and rendered pages,
 * and to the user's request it was judged against (its hash): a review of the
 * same pages against another request is another review.
 */
export async function reviewBinding(directory, { request = null } = {}) {
  const scene = await readJson(path.join(directory, "scene.json"));
  const result = await readJson(path.join(directory, "build-result.json"));
  const files = ["scene.json", path.relative(directory, result.pptxPath),
    ...scene.slides.map((_, i) => `rendered/slide-${i + 1}.png`)];
  const hash = createHash("sha256");
  for (const file of files) { hash.update(file); hash.update(await fs.readFile(path.join(directory, file))); }
  if (request) hash.update(`request:${sha256(request)}`);
  return hash.digest("hex");
}

/** One hash per slide over its scene record and its render: what a verification review compares. */
export async function slideHashes(directory) {
  const scene = await readJson(path.join(directory, "scene.json"));
  const hashes = {};
  for (const [i, slide] of scene.slides.entries()) {
    const hash = createHash("sha256").update(JSON.stringify(slide));
    hash.update(await fs.readFile(path.join(directory, "rendered", `slide-${i + 1}.png`)).catch(() => Buffer.alloc(0)));
    hashes[slide.id] = hash.digest("hex");
  }
  return hashes;
}

const HISTORY = "review-history";
export const CHECK_CANDIDATES = "check-candidates.json";

/**
 * The findings a machine check could have caught: every finding with a
 * non-null `checkable`, as { slide, slides, code, severity, rule, measure, reason }.
 * These are the review's evidence that a rule is still living in a reviewer's
 * head rather than in code (references/taste-review.md).
 */
export function checkCandidates(review) {
  return (review?.findings || [])
    .filter((f) => f && f.checkable && typeof f.checkable === "object" && typeof f.checkable.rule === "string" && f.checkable.rule.trim())
    .map((f) => {
      const slides = Array.isArray(f.slides) ? f.slides : f.slide ? [f.slide] : [];
      return { slide: slides[0] ?? null, slides, code: f.code, severity: f.severity, rule: f.checkable.rule.trim(),
        measure: String(f.checkable.measure ?? "").trim(), reason: f.reason };
    });
}

/**
 * Merge a review's check candidates into review-history/check-candidates.json.
 * One entry per (code, rule): a rule raised again, on another page or in a
 * later review, adds its slides and review to the entry and counts it, so the
 * file ranks the checks worth writing by how often a review had to do their job.
 */
export async function recordCheckCandidates(directory, review, reviewFile = null) {
  const found = checkCandidates(review);
  const file = path.join(directory, HISTORY, CHECK_CANDIDATES);
  const current = await readJson(file, { optional: true });
  const candidates = Array.isArray(current?.candidates) ? current.candidates : [];
  const key = (c) => `${c.code}\u0000${c.rule.toLowerCase()}`;
  const byKey = new Map(candidates.map((c) => [key(c), c]));
  const recordedAt = new Date().toISOString();
  const from = reviewFile ? path.basename(reviewFile) : null;
  for (const c of found) {
    const entry = byKey.get(key(c));
    if (entry) {
      entry.count = (entry.count ?? 1) + 1;
      for (const slide of c.slides) if (!entry.slides.includes(slide)) entry.slides.push(slide);
      if (from && !entry.reviews.includes(from)) entry.reviews.push(from);
      entry.lastSeen = recordedAt;
    } else {
      const fresh = { code: c.code, rule: c.rule, measure: c.measure, severity: c.severity, slides: [...c.slides],
        reason: c.reason, reviews: from ? [from] : [], count: 1, firstSeen: recordedAt, lastSeen: recordedAt };
      candidates.push(fresh);
      byKey.set(key(c), fresh);
    }
  }
  if (!found.length && !current) return { file: null, added: 0, candidates };
  candidates.sort((a, b) => (b.count ?? 1) - (a.count ?? 1));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await writeJson(file, { schema: "professional-slides.check-candidates/v1",
    note: "Review findings a deterministic check could have caught. Turn each into a compile-time or composition check in its owner (SKILL.md, Iterate the reusable skill), then remove it here.",
    candidates });
  return { file, added: found.length, candidates };
}

/** A recorded pass's ledger; a record written before ledgers existed rebuilds it from its review. */
export const ledgerOf = (record) => record?.ledger ?? (record?.review ? deckLedger([], record.review) : []);

/** The folder a lineage store keeps the deck review's passes in. */
export const reviewHistory = (store) => path.join(store, HISTORY);

/**
 * Keep a validated review in the lineage store's review-history/ (recordPass)
 * with the slide hashes it read, the ledger after it and its outcome, so the
 * next pass can be scoped and the acceptance rule read across every pass.
 * `store` is lineageStore(spec, out, deckPath): beside the deck, not in out/.
 */
export async function recordReview(store, directory, review, priorLedger = [], { downgrade = () => false, accepted = false } = {}) {
  const { file } = await recordPass(reviewHistory(store), { review, pageHashes: await slideHashes(directory),
    ledger: deckLedger(review.pass > 1 ? priorLedger : [], review, { downgrade }), accepted });
  await recordCheckCandidates(store, review, file);
  return file;
}

export const latestReview = async (store) => (await readPasses(reviewHistory(store))).at(-1) ?? null;

/**
 * The ledger a lineage carries into its next pass: the latest pass's, plus the
 * findings of a confirmation read that rejected it, so the next verification
 * gives those a status too.
 */
export async function lineageLedger(store, prior) {
  const ledger = ledgerOf(prior);
  const refused = (await readConfirmations(reviewHistory(store))).filter((c) => c.afterPass === prior?.pass && c.accepted !== true);
  const byId = new Set(ledger.map((e) => e.id));
  for (const [k, c] of refused.entries()) for (const item of deckItems(c.review)) {
    const id = `conf${k + 1}.${item.id}`;
    if (!byId.has(id)) ledger.push({ ...item, id, status: "open", raisedIn: "confirmation", updatedIn: prior.pass });
  }
  return ledger;
}

/**
 * The next deck pass (nextPassScope), with what the density pass carries: the
 * "right" verdicts of pages it need not reread, which it inherits, and every
 * page an open density finding names, which it must judge again - that page's
 * finding closes only on a fresh verdict, and a rebuilt page the profile no
 * longer flags would otherwise never be asked, and never close.
 */
export function verificationScope(prior, current, { maxPasses = MAX_PASSES, ledger = null } = {}) {
  const scope = nextPassScope(prior, current, { ledger: ledger ?? ledgerOf(prior), maxPasses });
  if (!scope) return null;
  const inheritedDensity = (prior.review.density?.pages || []).filter((p) => p.verdict === "right" && !scope.mustInspect.includes(p.slide) && current[p.slide]);
  const rejudge = scope.open.filter(isDensity).filter((e) => current[e.pages[0]]).map((e) => ({ slide: e.pages[0], reason: e.reason }));
  return { ...scope, inheritedDensity, rejudge };
}

/** A verification review carries forward the density verdicts of pages it did not need to reread. */
export function withInheritedDensity(review, scope) {
  if (!scope) return review;
  const judged = new Set((review.density?.pages || []).map((p) => p.slide));
  const pages = [...(review.density?.pages || []), ...scope.inheritedDensity.filter((p) => !judged.has(p.slide))];
  return { ...review, density: { ...(review.density || {}), pages } };
}

/** The review is bound to the current build and request. Coverage is validateReview's job. */
export async function validateReviewBinding(review, directory, { request = null } = {}) {
  const errors = [];
  if (review.binding !== await reviewBinding(directory, { request })) errors.push("Review does not match the current PPTX, scene, renders and request");
  if (!Number.isFinite(review.rating) || review.rating < 0 || review.rating > 10) errors.push("Review must provide a rating from zero to ten");
  return errors;
}

/**
 * The density pass is complete: the deck comparison is written and every page
 * the profile flagged - and, on a later pass, every page an open density
 * finding names (scope.rejudge) - has a verdict. A review without it cannot
 * accept a deck whose rendered words were never compared with the skill's
 * density targets.
 */
export function validateDensityReview(review, profile, scope = null, pageText = null) {
  const required = [...new Set([...(profile?.flaggedPages || []), ...(scope?.rejudge || []).map((p) => p.slide)])];
  if (!profile && !required.length) return [];
  const errors = [];
  const density = review?.density;
  if (!density || typeof density !== "object") return ["Review must carry the density pass (density.deck and density.pages)"];
  if (typeof density.deck !== "string" || density.deck.trim().length < 40) errors.push("density.deck must compare the deck's measured medians with the skill's targets");
  const pages = Array.isArray(density.pages) ? density.pages : [];
  const measured = new Map((profile?.pages || []).map((p) => [p.id, p]));
  for (const [i, entry] of pages.entries()) {
    if (!DENSITY_VERDICTS.includes(entry?.verdict)) errors.push(`density.pages[${i}]: verdict must be one of ${DENSITY_VERDICTS.join(", ")}`);
    if (typeof entry?.reason !== "string" || entry.reason.trim().length < 20) errors.push(`density.pages[${i}]: give the reason for the verdict`);
    if (entry?.verdict === "right") errors.push(...rightVerdictErrors(entry, i, measured.get(entry.slide), profile?.deck?.wordsPerBlock?.band, pageText));
  }
  const judged = new Set(pages.map((entry) => entry?.slide));
  const missing = required.filter((id) => !judged.has(id));
  if (missing.length) errors.push(`density pass must judge every flagged page and every page an open density finding names; missing ${missing.join(", ")}`);
  return errors;
}

// A developed point: the 40 to 90 words a commentary point runs to.
export const DEVELOPED_POINT_WORDS = 40;
// The pages the text-form band describes (density_profile.py prose_task).
const proseTask = (task) => Boolean(task) && (String(task).includes("commentary") || ["text-page", "mixed"].includes(task));
const squash = (text) => normalizeText(text).toLowerCase();

/**
 * A verdict of right on a prose page whose blocks average outside the band
 * strong pages keep says the page is right as it stands, against the measure.
 * It holds only on a developed point the page prints: `point` quotes it, word
 * for word, at DEVELOPED_POINT_WORDS or more. A page that has no such point to
 * quote is fragmented or a slab, and its verdict is not right.
 */
function rightVerdictErrors(entry, i, page, band, pageText) {
  if (!page || !Array.isArray(band) || !proseTask(page.task) || !page.blocks) return [];
  const blocks = Number(page.wordsPerBlock);
  if (!(blocks < band[0] || blocks > band[1])) return [];
  const at = `density.pages[${i}] (${entry.slide})`;
  const point = squash(entry.point);
  if (textWords(point) < DEVELOPED_POINT_WORDS)
    return [`${at}: its blocks average ${blocks} words, ${blocks < band[0] ? "under" : "over"} the ${band[0]}-${band[1]} strong prose pages keep; a verdict of right quotes in \`point\` the developed point (${DEVELOPED_POINT_WORDS} words or more, as the page prints it) that makes the page right - or give the page the verdict it earns`];
  const printed = pageText?.[entry.slide];
  if (typeof printed === "string" && !squash(printed).includes(point))
    return [`${at}: \`point\` is not on the page as printed; quote the developed point word for word`];
  return [];
}

/**
 * What else holds an otherwise clean review back: a rating under the
 * acceptance bar, and a build-bar waiver the reviewer refused, did not judge,
 * or judged more than once - a waiver holds on its one verdict, confirmed.
 */
function acceptanceBlockers(review, waivers = []) {
  const blocking = [];
  if (!(Number.isFinite(review?.rating) && review.rating >= ACCEPT_RATING)) blocking.push({ id: "rating", slide: null, slides: [], code: "REVIEW_RATING", severity: "blocker",
    reason: `rated ${review?.rating ?? "?"}/10, below the acceptance bar of ${ACCEPT_RATING}: a deck is delivered only when its reader rates it ${ACCEPT_RATING} or more`,
    repair: "Repair the findings that hold the rating down and rebuild; the next pass verifies them" });
  for (const w of waivers) {
    const given = (review?.waivers || []).filter((v) => v?.code === w.code);
    const verdict = given.length === 1 ? given[0] : null;
    if (verdict?.verdict !== "confirmed") blocking.push({ id: `waiver:${w.code}`, slide: null, slides: [], code: w.code, severity: "blocker",
      reason: `build bar ${w.measure} at ${w.measured} against ${w.floor ?? w.ceiling}: the waiver ("${w.reason}") was ${verdict ? `refused - ${verdict.reason}` : given.length ? `given ${given.length} verdicts (${given.map((v) => v?.verdict).join(", ")}), not one` : "not judged"}`,
      repair: "Clear the bar on the rebuilt deck, or make the waiver's case on the pages so the reviewer can confirm it" });
  }
  return blocking;
}

/**
 * The acceptance rule, read off the ledger of every pass rather than off the
 * last review alone: accepted when the reviewer accepts at a rating of
 * ACCEPT_RATING or more, confirms every build-bar waiver the packet showed, and
 * no major or blocker finding from any pass is still open (density verdicts
 * included).
 */
export function reviewOutcome(review, priorLedger = [], { waivers = [], downgrade = () => false } = {}) {
  const ledger = deckLedger(review?.pass > 1 ? priorLedger : [], review, { downgrade });
  const blocking = openBlocking(ledger).map((e) => ({ id: e.id, slide: e.pages?.[0] ?? null, slides: e.pages || [], code: e.code, severity: e.severity,
    reason: e.status === "open" ? e.reason : `${e.status} (pass ${e.updatedIn}): ${e.reason}`, repair: e.repair }));
  const held = acceptanceBlockers(review, waivers);
  const newBlockers = ledger.filter((e) => e.raisedIn === (review?.pass ?? 1) && e.severity === "blocker" && e.status === "open");
  return { accepted: review?.accepted === true && blocking.length === 0 && held.length === 0, blocking: [...blocking, ...held], ledger, newBlockers: newBlockers.length };
}

/** A confirmation read's outcome: its own findings and rating alone, with no ledger behind it. */
export function confirmationOutcome(review, { waivers = [] } = {}) {
  const ledger = advanceLedger([], {}, deckItems({ findings: review?.findings || [] }));
  const blocking = [...openBlocking(ledger).map((e) => ({ id: e.id, slide: e.pages?.[0] ?? null, slides: e.pages || [], code: e.code, severity: e.severity, reason: e.reason, repair: e.repair })),
    ...acceptanceBlockers(review, waivers)];
  return { accepted: review?.accepted === true && blocking.length === 0, blocking, ledger };
}

function textOf(slide) {
  return slide.nodes.filter((n) => n.type === "text" && !["page-number", "source-text"].includes(n.role)).map((n) => ({ role: n.role, text: (n.data?.textLayout?.source ?? n.text) }));
}

// Which page dimensions have something to check on a page. A dimension with
// nothing on the page is still noted ("n/a - no table"), so a skipped check
// and an absent exhibit read differently.
function checklistOf(slide) {
  const components = (slide.componentInstances || []).map((c) => String(c.component));
  const roles = (slide.nodes || []).map((n) => String(n.role ?? ""));
  const has = {
    chart: components.some((c) => c.startsWith("chart")),
    table: components.some((c) => /^(table|comparison-table|heatmap|trend-rows|insight-tree-table)$/.test(c)),
    identity: components.some((c) => /image|logo|map/.test(c)) || roles.some((r) => /logo|image|picture|map/.test(r)),
  };
  return { check: PAGE_DIMENSIONS.filter((d) => has[d] !== false), absent: PAGE_DIMENSIONS.filter((d) => has[d] === false) };
}


const PACKET_RECORD = "review-packet.json";
/** The record of the latest deck-review packet written for a deck: what its answer is checked against. */
export const readPacketRecord = (store) => readJson(path.join(store, PACKET_RECORD), { optional: true });

// What a staged packet may say about the lineage: the open findings the pass
// must give a status and the pages it must read - never the fixed history or
// an earlier rating.
const stagedScope = (scope) => scope && ({ pass: scope.pass, verifies: scope.verifies, maxPasses: scope.maxPasses, changed: scope.changed, deleted: scope.deleted,
  mustInspect: scope.mustInspect, open: scope.open, rejudge: scope.rejudge ?? [] });

/**
 * Write the review packet: the prompt, the schema, and per page its text,
 * exhibits, gate findings, image and checklist. Refused until the storyline
 * critique is ready for the deck's current spine, because a deck review spent
 * on an argument that is about to change is spent twice. A long first pass is
 * split into section prompts and a spine prompt for parallel reviewers.
 *
 * The packet is staged in a clean temporary directory holding only the renders,
 * the packet, the prompts and the schemas (stageReview), so a reviewer given
 * its path can reach no earlier review. Its record - kind, pass, binding,
 * prompt hash, staging directory - is kept in the deck's lineage store, where
 * delivery checks the answer's provenance against it. `confirmation` is
 * { confirms: <binding of the accepted verification pass> } for the fresh
 * confirmation read, which is told nothing of the ledger.
 */
export async function buildReviewPacket({ outputDirectory, spec, deckPath = null, scope = null, confirmation = null, waivers = [], revision = null }) {
  const dir = path.resolve(outputDirectory);
  if (!spec || typeof spec !== "object") throw new Error("buildReviewPacket needs the deck spec: the deck review is prepared only once the storyline critique is ready for its spine");
  const [statement] = deckStatementFindings(spec);
  if (statement) throw Object.assign(new Error(`The deck review needs the deck's own statements in order: ${statement.repair}`), { code: statement.code });
  const gate = await storylineGate(spec, dir, { deckPath });
  if (gate.length) throw Object.assign(new Error(`The deck review waits for the storyline critique: ${gate.join("; ")}`), { code: "STORYLINE_UNREVIEWED", reasons: gate });
  const store = await lineageStore(spec, dir, deckPath);
  const scene = await readJson(path.join(dir, "scene.json"));
  const gates = (await readJson(path.join(dir, "gates.json"), { optional: true })) ?? { findings: [] };
  const renders = await fs.readdir(path.join(dir, "rendered")).catch(() => []);
  const spreadFiles = renders.filter((f) => /^spread-.*\.png$/.test(f)).sort();
  const staged = { "rendered/montage.png": path.join(dir, "rendered", "montage.png"),
    ...Object.fromEntries(scene.slides.map((_, i) => [`rendered/slide-${i + 1}.png`, path.join(dir, "rendered", `slide-${i + 1}.png`)])),
    ...Object.fromEntries(spreadFiles.map((f) => [`rendered/${f}`, path.join(dir, "rendered", f)])) };
  const previous = await readPacketRecord(store);
  const packetDir = await stageReview("review", staged, { previous: previous?.staging });
  const slides = scene.slides.map((s, i) => ({
    id: s.id, index: i + 1,
    title: s.nodes.find((n) => n.role === "action-title" || n.role === "cover-title")?.text?.replace(/\n/g, " ") ?? "",
    text: textOf(s),
    exhibits: (s.componentInstances || []).filter((c) => /^(chart\.|table|image-frame|metric)/.test(c.component)).map((c) => ({ component: c.component, frame: c.frame })),
    gateFindings: (gates.findings || []).filter((f) => f.slide === s.id || f.slide === i + 1),
    image: path.join(packetDir, "rendered", `slide-${i + 1}.png`),
    ...checklistOf(s),
  }));
  const statistics = designStatistics(scene);
  const density = confirmation ? null : await readJson(path.join(dir, "density-profile.json"), { optional: true });
  const craft = ((await readJson(path.join(dir, "preflight-gates.json"), { optional: true }))?.findings || []).filter((f) => String(f.code).startsWith("CRAFT_"));
  const spreads = spreadFiles.map((f) => path.join(packetDir, "rendered", f));
  const sections = !scope && !confirmation && !revision && slides.length > SECTION_REVIEW_THRESHOLD ? reviewSections(scene) : null;
  const schema = confirmation ? CONFIRMATION_SCHEMA : scope ? VERIFICATION_SCHEMA : REVIEW_SCHEMA;
  // A verification pass is told which open deck findings a measured check now
  // clears for a lower residual severity, and which storyline items stand on the pages it rereads.
  const downgrade = downgradeRule(scene);
  const shown = scope ? { ...stagedScope(scope), open: scope.open.map((e) => ({ ...e, ...(downgrade(e) ? { downgradable: DOWNGRADE_MEASURES[e.code].measure } : {}) })) } : null;
  const storyline = scope ? await storylineOnChanged(store, scope.changed) : null;
  const binding = await reviewBinding(dir, { request: requestOf(spec) });
  const packet = { binding, kind: confirmation ? "confirmation" : scope ? "verification" : "review", pass: confirmation ? null : scope ? scope.pass : 1,
    verifies: scope ? scope.verifies : null, confirms: confirmation?.confirms ?? null, maxPasses: scope?.maxPasses ?? MAX_PASSES,
    scope: shown, sections, craft, statistics, density, request: requestOf(spec), question: spec.question ?? null, answer: spec.answer ?? spec.context?.governingAnswer ?? "",
    waivers, storyline, revision: !scope && !confirmation && revision ? { changed: revision.changed } : null, montage: path.join(packetDir, "rendered", "montage.png"), spreads,
    titles: slides.map((s) => `${s.index}. [${s.id}] ${s.title}`), slides, rubric: RUBRIC, severities: SEVERITY_DEFINITIONS, codes: CODES, schema };
  const main = confirmation ? confirmationPrompt(packet) : scope ? verificationPrompt(packet) : reviewPrompt(packet);
  const parts = sections ? [...sections.map((section) => [section.id, sectionPrompt(packet, section)]), ["spine", spinePrompt(packet)]] : [];
  // One hash over every prompt the packet holds: each answer, and each part of a split pass, echoes it.
  packet.promptHash = sha256([main, ...parts.map(([, text]) => text)].join("\u0000"));
  const signed = (text) => `${text}${provenanceLine(packet.promptHash)}`;
  await writeJson(path.join(packetDir, "packet.json"), packet);
  await writeJson(path.join(packetDir, "schema.json"), schema);
  await fs.writeFile(path.join(packetDir, "prompt.md"), signed(main));
  if (sections) {
    await fs.mkdir(path.join(packetDir, "sections"), { recursive: true });
    await fs.mkdir(path.join(packetDir, "parts"), { recursive: true });
    await writeJson(path.join(packetDir, "part-schema.json"), PART_SCHEMA);
    for (const [id, text] of parts) await fs.writeFile(path.join(packetDir, "sections", `${id}.md`), signed(text));
  }
  const record = { kind: packet.kind, pass: packet.pass, binding, verifies: packet.verifies, confirms: packet.confirms, promptHash: packet.promptHash,
    staging: packetDir, sections, waivers, revision: packet.revision, out: dir, deck: deckPath ? path.resolve(deckPath) : null, writtenAt: new Date().toISOString() };
  await fs.mkdir(store, { recursive: true });
  await writeJson(path.join(store, PACKET_RECORD), record);
  return { packetDir, packet, record, store };
}

// The storyline critique's open items on the pages a deck verification pass
// rereads: the storyline gate binds only the spine, so a copy change to such a
// page is checked for its storyline items here rather than by a new critique.
async function storylineOnChanged(store, changed = []) {
  const latest = (await readStorylineHistory(store)).at(-1);
  const on = new Set(changed);
  const items = openEntries(latest?.ledger || []).filter((e) => (e.pages || []).some((id) => on.has(id)))
    .map((e) => ({ id: e.id, check: e.dimension, severity: e.severity, pages: e.pages, problem: e.reason }));
  return { checks: Object.fromEntries(STORYLINE_PAGE_CHECKS.map((c) => [c, STORYLINE_CHECKS[c].checks])), items };
}

/** The rubric and the severity scale, as the reviewer reads them. */
export function rubricPrompt() {
  return `THE RUBRIC. Check every dimension on every page it applies to; the deck dimensions across the whole sequence.
${DIMENSIONS.map((d) => `- ${d} (${RUBRIC[d].scope}): ${RUBRIC[d].checks}`).join("\n")}

SEVERITY, calibrated so the same defect gets the same level on every deck:
${["blocker", "major", "minor", "none"].map((s) => `- ${s}: ${SEVERITY_DEFINITIONS[s]}`).join("\n")}`;
}

/**
 * The review standard, condensed from the skill's guidance on storylining,
 * design and the taste review, so a reviewer needs no other file: the reader
 * is given what to judge, not a reading list.
 */
export const STANDARDS = `THE STANDARD. You need no other file: this is the skill's review guidance, condensed.
- Judge the saved artifact as its reader will meet it, against THE USER'S REQUEST above. A passing build gate is not a taste score; a declaration (a treatment named, an arrow drawn) is not the thing itself.
- Three reading scales. The title spine first: write what the deck argues, whether it answers every part of the request, and trace each decisive branch to its proof; hold the summary and the close to the same scope and evidence. Then every page at full size on every rubric dimension. Then the spreads and the sequence: repeated informational jobs, density, whether the sequence builds. Different chart types or column counts are not variety by themselves.
- Finish before the argument. Raise a major for each of these that recurs on more than a couple of pages: half a page empty, or a list in the left half with nothing beside it; a small figure floating in a band sized for a chart; a table stretched into tall rows of short phrases; emphasis the wrong way round (the rival loud, the subject muted); a share or two numbers drawn as a two-bar chart; source lines a reader cannot look up; page shapes so alike the pages are indistinguishable at thumbnail size. A deck with a recurring finish defect is not rated above 7.
- Evidence. Reconcile the decisive quantities to their records: populations, units, periods, bases, totals. Members of a comparison share one set of measures, n/a where one is undisclosed. Keep analyst illustrations apart from empirical premises, dated snapshots apart from current claims, and a lower bound ("over $5bn") apart from an exact point. A claim goes no further than its evidence; causal wording needs causal evidence.
- The answer. A page or a summary that declines part of the request ("cannot rank", "no defensible call") without naming the decisive missing evidence is an argument finding, however carefully it is caveated.
- Challenge. Name the least-supported conclusion, the best and worst page, the most repetitive sequence and the most deletable page, with the merger and what it would lose. The requested length does not protect filler, a preview or a methods page that could join its result.
- File once. One defect recurring on many pages is one deck finding listing every page, with its cause. No preferences, no fault quota, no statistics turned into a taste formula.
- Score with anchors, not an average: 5 - understandable in parts, but weak proof or costly reading; 7 - useful and mostly supported, with substantial editorial or design work still needed; ${ACCEPT_RATING} - the delivery bar: nothing major open and the remaining weaknesses limited; 9 - strong argument and evidence, effective visual explanation, coherent rhythm; 9.5+ - exceptional across the deck, its least effective page included. A rating below ${ACCEPT_RATING} means major work remains: file it as findings. No earlier score, target or repair list exists for you; do not look for one.`;

const FINDING_RULES = `FINDINGS. Give each finding an id (F1, F2, ...), a scope, the rubric dimension it belongs to, a code, a severity, a reason and a concrete repair (what to add, replace, move, merge, cut, plot, label or rewrite, and where). A page finding names its one page in \`slides\`. A deck finding - a defect of the sequence, or one defect recurring on several pages - lists EVERY page it affects in \`slides\`, in deck order: never a sample, never "e.g.", "such as", "for example" or "etc.". Validation refuses a sampled page list, and a finding whose reason or repair names a page its \`slides\` leave out. Do not file twenty copies of one defect: file it once, as a deck finding with all its pages.`;

const PAGE_RULES = `PAGE COVERAGE. \`pages\` holds one entry per page: its id, a verdict (ok, minor, major, blocker) and \`checks\`, a short note for each page dimension (${PAGE_DIMENSIONS.join(", ")}) saying what you checked and what you saw - "n/a - no table on this page" where a dimension has nothing to check. A page's verdict is the worst severity of the open findings that name it (ok when none does); validation refuses a verdict that disagrees with the findings.`;

const COMPLETENESS_RULES = (dimensions) => `COMPLETENESS SELF-CHECK. \`completeness\` holds one entry per dimension (${dimensions.join(", ")}): result "findings" when you filed any under it, or "clean" with a note saying what you checked and why nothing was found. A clean dimension with nothing said about it is a gap, not a pass.`;

const OPENED = (which) => `OPENED. List in \`opened\` the id of every page you actually opened at full size - ${which}. The binding says which build you read; \`opened\` says what you looked at, and a page you did not open is not in it.`;

// The reviewer's codes, and the rule that keeps one code per defect across the reviews and the build's checks.
const codesPrompt = (packet) => `${Object.entries(packet.codes || CODES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
A defect a build check already names keeps that check's code: a gate finding's own code, MISSING_EVIDENCE for a ranked criterion with no comparative exhibit, LAYOUT_MONOTONY for one construction across most of the deck.`;

const pageLine = (s) => `- [${s.id}] page ${s.index}: ${s.title || "(no title)"} - ${s.image}${s.exhibits?.length ? `; exhibits: ${s.exhibits.map((e) => e.component).join(", ")}` : ""}${s.absent?.length ? `; n/a: ${s.absent.join(", ")}` : ""}`;

/** The user's request, verbatim, as the yardstick; the deck's answer beside it as the author's. */
export function requestPrompt(packet) {
  const answer = `THE DECK'S GOVERNING ANSWER (the author's): ${packet.answer || "(not stated)"}`;
  if (packet.request) return `THE USER'S REQUEST (verbatim - the yardstick: judge the deck against it, not against the deck's own framing):\n"""\n${packet.request}\n"""\n${answer}`;
  return `THE USER'S REQUEST: not recorded. Judge the deck against its own question and say in the summary that no verbatim request was supplied. THE DECK'S QUESTION (the author's): ${packet.question || "(not stated)"}\n${answer}`;
}

/** The build bars the deck misses and says it is right to, for the reviewer to confirm or refuse. */
export function waiverPrompt(waivers = []) {
  if (!waivers.length) return "BUILD-BAR WAIVERS: none. Leave `waivers` empty.";
  return `BUILD-BAR WAIVERS. The deck misses these measured bars and says why it is right to. For each, return a verdict in \`waivers\` - { code, verdict: confirmed or refused, reason } - and confirm only when the pages bear the reason out; delivery needs every one confirmed.
${waivers.map((w) => `- ${w.code}: ${w.measure} measured ${w.measured} against ${w.floor !== undefined ? `a floor of ${w.floor}` : `a ceiling of ${w.ceiling}`}; the deck's reason: "${w.reason}"`).join("\n")}`;
}

function gatePrompt(packet, only = null) {
  const slides = (packet.slides || []).filter((s) => !only || only.includes(s.id));
  return `Deterministic gate findings already computed (confirm, refine or explain why they do not matter):
${slides.flatMap((s) => (s.gateFindings || []).map((f) => `- ${s.id} (page ${s.index}) ${f.code}: ${f.measured ?? ""} (threshold ${f.threshold ?? ""})`)).join("\n") || "- none"}

Deck craft findings from the build (a blocker has already stopped delivery; confirm each advisory or explain why it does not apply):
${(packet.craft || []).map((f) => `- ${f.severity} ${f.code}: ${JSON.stringify(f.measured)}`).join("\n") || "- none"}`;
}

const VISUAL = `VISUAL REVIEW. Read the deck through its spreads (rendered/spread-*.png, four pages to a sheet at reading size) and the montage for the sequence, then open every page at full size for its page checks. The semantic checks: coherent argument and counts; reconciled totals, periods, sample membership and durations; scoped comparisons, non-causal wording unless supported, and reversal conditions that affect the named option; focus that supports the claim; appropriate table category/dimension grammar; one chart heading owner; consistent qualifiers; vertically balanced sparse groups; meaningful arrows and rules; and cross-slide consistency. Neutral charts, joined verdicts and optional commentary are valid where they serve the page.`;

const CRAFT = `CRAFT REVIEW. Judge the deck the way a partner would who has seen strong decks on this subject. For every chart ask what it shows that two numbers in the title do not: a chart of two bars is a metric pair (TRIVIAL_CHART); a chart that could show the trend with its growth rate, the full ranked peer set, the share or the gap to a benchmark and does not is NO_INSIGHT_CHART. For every table ask whether it compares, rates or judges and, if so, whether the treatment shows it (FLAT_TABLE). Count the constructions: steps, cards, bar charts or two-column comparisons standing in for evidence of other shapes is DEVICE_OVERUSE. Named players (companies, brands, products, places) compared without a page that introduces them with their logos is MISSING_CONTEXT. Maps are checked for placed cities, meaningful fills, marker size and the routes or flows they are about (MAP_DESIGN). Parallel categories with no icon, and a deck with no photograph of a recognisable subject, are defects too. These are major when they recur across the deck. Record concrete defects, not preferences.`;

const REFERENCES = `If the user supplied reference decks, compare strong relevant pages from each before scoring and record the pages inspected. Reference material is only what the user supplied: never search the machine for other decks or documents. Historical aggregate device counts do not establish a benchmark. Explain concrete differences in evidence relationships and reader effort; do not infer quality from more devices or annotations. Compare substantive text against matched reading tasks, preserving necessary explanation without padding.`;

const ASSESS = `ASSESSMENT. Write \`assessment\`: argument, evidence, visual explanation, copy and sequence quality, each in a sentence or two; the best page and the worst page and why; the most repetitive sequence; and the most deletable page, challenged with a concrete merger and the evidence it would lose. Reproduce material calculations from supplied source records; disclose unverified assumptions.`;

const INDEPENDENT = "Do not consult prior candidate scores, repair lists or peer status summaries.";

export function reviewPrompt(packet) {
  // Historical aggregates remain available to analysis callers, not as review targets.
  const { reference: historicalReference, ...candidateStatistics } = packet.statistics || {};
  const slides = packet.slides || [];
  const changed = new Set(packet.revision?.changed || []);
  const revision = packet.revision ? `
THIS IS A REVISION of the user's existing deck. The revision changed ${changed.size} of ${slides.length} pages, marked [changed] below: read those at full size on every dimension, give each an entry in \`pages\` and list them in \`opened\`. The other pages are the user's as they stand: read them in the spreads for the sequence, give them no entry, and file a finding only where a changed page is involved - a page finding on a changed page, a deck finding listing at least one.
` : "";
  const split = packet.sections?.length ? `
THIS DECK IS LONG (${slides.length} pages), so read it in parallel where the harness can spawn subagents: give each prompt in the packet's sections/ folder (${packet.sections.map((s) => `${s.id}.md: ${s.slides.length} pages`).join("; ")}; and spine.md for the whole sequence) to its own fresh reviewer at the same time and save each JSON answer as parts/<id>.json beside it; the merge joins them into one review and refuses any part that misses a page. A harness with no subagents works through this prompt alone, page by page.
` : "";
  return `You are the first reader of a finished consulting deck, reviewing it against the user's request the way an engagement manager would the night before a steering committee. This is pass 1 of at most ${packet.maxPasses ?? MAX_PASSES}, and it is exhaustive. ${INDEPENDENT}

Why exhaustive: every later pass only verifies. It gives each of your findings a status and may add a new finding only when it is a major or blocker on a page the rebuild changed, or one you demonstrably missed, quoted from the page. A defect you see now and leave out will not be raised again, and a sampled page list leaves the author guessing which pages to fix. Report every defect at every severity, on every page, with its repair: work through every page and every dimension before deciding.
${split}${revision}
${requestPrompt(packet)}

TITLES ALONE (read as a memo first - does the argument flow?):
${(packet.titles || []).join("\n")}

${rubricPrompt()}

${STANDARDS}

HOW TO WORK.
1. Read the titles alone and write down what the deck argues; check the executive summary and the close against it (bookends).
2. Page by page, in order, for every page below: open its image, read its text in packet.json, check each page dimension and write its note, and file every defect as a finding.
3. Across the deck: repeated constructions in any window of neighbouring pages, styling, terminology and number formats (consistency); section openings, development and closes and the variety of reading tasks (rhythm); logos, product images and maps where recognition matters (identity).
4. Before returning, run the completeness self-check.

${PAGE_RULES}

${OPENED(packet.revision ? "every page the revision changed" : "this first pass opens every page")}

${FINDING_RULES}

${COMPLETENESS_RULES(DIMENSIONS)}

For each slide, decide whether a reader gets the finding from the title and can verify it from the exhibit. A separate soWhat or closing strip is optional: the title and exhibit may already complete the argument. Two distinct insights can share a page when each is supported and clearly placed. Flag redundant propositions or competing summary boxes, not the absence of a footer conclusion. Use these codes where appropriate, or a precise upper-case code for a newly observed defect:
${codesPrompt(packet)}

${checkablePrompt()}

${gatePrompt(packet)}

${waiverPrompt(packet.waivers)}

PAGES (id, page, title, image, exhibits, dimensions with nothing to check):
${slides.map((s) => `${pageLine(s)}${changed.has(s.id) ? " [changed]" : ""}`).join("\n") || "- (see packet.json)"}
Spreads: ${(packet.spreads || []).join(", ") || "rendered/spread-*.png"}
Montage: ${packet.montage}

${VISUAL}

${CRAFT}

Candidate diagnostics, not quality targets:
${JSON.stringify(candidateStatistics, null, 1)}

${REFERENCES}

${ASSESS} Name the best page, worst page and most repetitive sequence; challenge the most deletable page.

${densityPrompt(packet.density)}

Bind this review to ${packet.binding}. Set pass to 1 and verifies to null. Rate the actual deck out of ten independently of any requested target; a passing gate is not a taste score.

Return ONLY JSON matching this schema: ${JSON.stringify(packet.schema)}
Set accepted=true only at a rating of ${ACCEPT_RATING} or more with no major or blocker finding. The summary is two sentences: what the deck does well and what must change.`;
}

/** One section of a long deck's first pass: its pages, closely, on every page dimension. */
export function sectionPrompt(packet, section) {
  const slides = (packet.slides || []).filter((s) => section.slides.includes(s.id));
  return `You are one of several reviewers reading a long consulting deck in parallel for its exhaustive first pass. Yours is section ${section.id}, "${section.title}": pages ${section.slides.join(", ")}. Other reviewers take the other sections, and a spine reviewer reads the whole sequence for consistency, rhythm and the executive summary and close. ${INDEPENDENT}

${requestPrompt(packet)}

THE WHOLE TITLE SPINE, for context (review only your pages):
${(packet.titles || []).join("\n")}

${rubricPrompt()}

${STANDARDS}

Check every page dimension on every one of your pages. Later passes only verify, so a defect you leave out now will not be raised again.

${PAGE_RULES}

${OPENED("every one of your pages")}

${FINDING_RULES} A defect recurring on several of your pages is a deck finding listing every one of them; the merge joins it with the same defect seen from other sections. Name only pages in your section.

${COMPLETENESS_RULES(PAGE_DIMENSIONS)}

Codes (or a precise upper-case code of your own):
${codesPrompt(packet)}

${checkablePrompt()}

${gatePrompt(packet, section.slides)}

YOUR PAGES:
${slides.map(pageLine).join("\n")}

${VISUAL}

${CRAFT}

${densityPrompt(packet.density, section.slides)} Leave density.deck to the spine reviewer: write "Judged by the spine reviewer for the whole deck." there. Leave \`waivers\` to the spine reviewer.

Set part to ${JSON.stringify({ kind: "section", id: section.id, slides: section.slides })}. Bind to ${packet.binding}; rate your section out of ten.
Return ONLY JSON matching this schema: ${JSON.stringify(PART_SCHEMA)}`;
}

/** The spine of a long deck's first pass: what no section reviewer can see. */
export function spinePrompt(packet) {
  const { reference: historicalReference, ...candidateStatistics } = packet.statistics || {};
  return `You are the spine reviewer of a long consulting deck read in parallel for its exhaustive first pass. Section reviewers read every page closely; you read the whole deck for what none of them can see. ${INDEPENDENT}

${requestPrompt(packet)}

TITLES ALONE:
${(packet.titles || []).join("\n")}

${rubricPrompt()}

${STANDARDS}

Your dimensions are ${DECK_DIMENSIONS.join(", ")}, plus identity and number consistency across the deck: repeated constructions in any window of neighbouring pages, one styling and term and number format for one thing, the section flow, the executive summary against the body and the close. Read the montage and every spread (${(packet.spreads || []).join(", ") || "rendered/spread-*.png"}; montage ${packet.montage}), opening pages at full size where a sequence needs it.

${FINDING_RULES} Across sections, list every affected page in the deck. Leave \`pages\` empty: the section reviewers cover the pages. List in \`opened\` any page you opened at full size.

${COMPLETENESS_RULES(DECK_DIMENSIONS)}

Codes:
${codesPrompt(packet)}

${checkablePrompt()}

${waiverPrompt(packet.waivers)}

Candidate diagnostics, not quality targets:
${JSON.stringify(candidateStatistics, null, 1)}

${REFERENCES}

${ASSESS}

${densityPrompt(packet.density, [])} Write density.deck for the whole deck; the section reviewers judge the flagged pages.

Set part to ${JSON.stringify({ kind: "spine", id: "spine", slides: (packet.slides || []).map((s) => s.id) })}. Bind to ${packet.binding}. Rate the whole deck out of ten; your rating and summary become the review's.
Return ONLY JSON matching this schema: ${JSON.stringify(PART_SCHEMA)}`;
}

/** A verification pass: a status for every open finding, and only additive new ones. */
export function verificationPrompt(packet) {
  const { scope } = packet;
  const byId = new Map((packet.slides || []).map((s) => [s.id, s]));
  const pages = (scope.mustInspect || []).map((id) => byId.get(id)).filter(Boolean);
  const changed = new Set(scope.changed || []);
  const story = packet.storyline;
  return `You are verifying repairs to a consulting deck. This is pass ${scope.pass} of at most ${scope.maxPasses ?? MAX_PASSES}; it verifies the review bound to ${scope.verifies}. It is not a fresh review: the first pass read every page on every dimension, and its verdict stands for every page that has not changed. No earlier rating is given to you: rate the deck on what you see now.

${requestPrompt(packet)}

OPEN FINDINGS (give every one a status; an open density finding takes its status from the density verdict below):
${(scope.open || []).filter((f) => !isDensity(f)).map((f) => `- ${f.id} · ${f.code} · ${f.severity} · ${(f.pages || []).join(", ") || "deck"}: ${f.reason}${f.repair ? ` → ${f.repair}` : ""}${f.downgradable ? ` [measured check now passes (${f.downgradable}): may drop if partly fixed]` : ""}`).join("\n") || "- none"}

PAGES TO READ at full size (${scope.changed?.length ?? 0} changed since that pass or beside a deleted page, the rest named by an open major or blocker):
${pages.map((s) => `${pageLine(s)}${changed.has(s.id) ? " [changed]" : ""}`).join("\n") || "- none"}
Montage, for the sequence: ${packet.montage}

TITLES ALONE, to check the repaired pages still fit the argument:
${(packet.titles || []).join("\n")}
${story ? `
STORYLINE CHECKS ON CHANGED PAGES. The storyline critique binds only the spine, so a copy change to a page is checked here: on every changed page, the claim still ${story.checks.claim}; the shape, sourcing, restatement and consequence still hold as the critique read them. A change that breaks one is a new finding with basis "changed" (dimension argument).${story.items?.length ? ` The critique's open items on these pages:\n${story.items.map((e) => `- ${e.id} · ${e.check} · ${e.severity} · ${(e.pages || []).join(", ")}: ${e.problem}`).join("\n")}` : ""}
` : ""}
${rubricPrompt()}

${STANDARDS}

Do three things.
1. STATUSES. For every open finding, one entry in \`statuses\`: fixed, partly fixed, not fixed or regressed, with the evidence you saw on the page. A partly fixed finding keeps its severity: only a finding marked [measured check now passes] may carry a lower residual \`severity\`, and a deck finding may carry the \`slides\` where it still stands. Do not re-file an open finding as new.
2. PAGES. Read every listed page on every page dimension and record it in \`pages\` exactly as the first pass did (verdict and a note per dimension). A page's verdict is the worst open finding naming it, counting the open findings above. ${OPENED("every page listed above")}
3. NEW FINDINGS, only if additive. A new finding must be major or blocker, and its \`basis\` must be one of:
${Object.entries(NEW_BASES).map(([k, v]) => `   - ${k}: ${v}`).join("\n")}
   Validation refuses a new minor finding, a new finding on a page that did not change unless it is a missed major or blocker that quotes the page in \`evidence\` exactly as printed and justifies why the earlier passes could not see it, and a repeat of an open finding. Give new findings ids no earlier pass used, a \`justification\` ("" is fine for basis changed) and \`evidence\` ("" is fine except for basis missed). The deck is not re-reviewed: stop when these three are done, or the loop never converges.

${FINDING_RULES}

${checkablePrompt()}

${waiverPrompt(packet.waivers)}

${densityPrompt(packet.density, scope.mustInspect, scope.rejudge)}

Set pass to ${scope.pass} and verifies to "${scope.verifies}". Bind this review to ${packet.binding}. Rate the repaired deck out of ten on what you now see.

Return ONLY JSON matching this schema: ${JSON.stringify(packet.schema)}
Set accepted=true only at a rating of ${ACCEPT_RATING} or more while no major or blocker finding, earlier or new, is open. The summary is two sentences: which repairs held and what, if anything, must still change.`;
}

/**
 * The confirmation read: after a verification pass accepts, one fresh reader
 * reads the final artifact whole, blind to the ledger, the earlier ratings and
 * the earlier findings, and must accept it too. A verification pass only sees
 * what it is shown; this read is how an accepted deck is checked against the
 * deck a reader would actually meet.
 */
export function confirmationPrompt(packet) {
  const { reference: historicalReference, ...candidateStatistics } = packet.statistics || {};
  const slides = packet.slides || [];
  return `You are a fresh reader of a finished consulting deck, reading it once and whole before it goes to the client, as an engagement manager would the night before a steering committee. No earlier review, rating, finding or repair list is given to you, and none exists for you to look for: rate what you see.

${requestPrompt(packet)}

TITLES ALONE (read as a memo first - does the argument flow, and does it answer every part of the request?):
${(packet.titles || []).join("\n")}

${rubricPrompt()}

${STANDARDS}

HOW TO WORK.
1. Read the titles alone and write down what the deck argues and whether it answers the request.
2. Read the spreads and the montage for the sequence.
3. Open every page at full size, in order, and give each an entry in \`pages\`: its verdict (ok, minor, major, blocker - the worst finding naming it) and a one-line \`note\` of what you saw on it.
4. File every major or blocker defect as a finding; minor ones are welcome. Then write the assessment.

${OPENED("this read opens every page")}

${FINDING_RULES}

Codes (or a precise upper-case code of your own):
${codesPrompt(packet)}

${checkablePrompt()}

${waiverPrompt(packet.waivers)}

PAGES (id, page, title, image, exhibits):
${slides.map(pageLine).join("\n") || "- (see packet.json)"}
Spreads: ${(packet.spreads || []).join(", ") || "rendered/spread-*.png"}
Montage: ${packet.montage}

${VISUAL}

${CRAFT}

Candidate diagnostics, not quality targets:
${JSON.stringify(candidateStatistics, null, 1)}

${ASSESS}

Set confirms to "${packet.confirms}". Bind this read to ${packet.binding}. Rate the deck out of ten on what you see.

Return ONLY JSON matching this schema: ${JSON.stringify(packet.schema)}
Set accepted=true only at a rating of ${ACCEPT_RATING} or more with no major or blocker finding. The summary is two sentences: what the deck does well and what must change.`;
}

/** What the reviewer is told about `checkable`: the review judges what code cannot. */
export function checkablePrompt() {
  return `CHECKABLE FINDINGS. The review is for judgement; a defect a machine could have measured is a check the skill is missing. On every finding set ${CHECKABLE}. Write rule as the constraint a check would enforce ("a chart callout never overlaps a data label") and measure as what it would compute and against what threshold ("intersection area of each callout box with each value-label box in the scene; any overlap fails"). Fill it whether or not a deterministic gate already reported the defect: a gate that fired and was ignored, or fired too late to act on, is still a check that did not stop the page. Leave it null when the call is judgement - whether the argument holds, what deserves emphasis, whether the page earns its place.`;
}


/**
 * The density pass: the profile's comparison and flags, put to the reviewer
 * as questions, and on a later pass every page an open density finding names
 * (`rejudge`), flagged or not: its finding closes only on a fresh verdict.
 */
export function densityPrompt(profile, only = null, rejudge = []) {
  const again = rejudge.filter((p) => !(profile?.pages || []).some((q) => q.id === p.slide && q.flags?.length && (!only || only.includes(q.id))));
  const judgeAgain = again.length ? `\nJudge again, flagged or not, every page an open density finding names; a verdict of right closes it:\n${again.map((p) => `- ${p.slide}: earlier judged ${p.reason}`).join("\n")}` : "";
  if (!profile) return `DENSITY PASS. No density profile was built (the deck was not rendered); set density.deck to "No rendered density profile was available for this build." and density.pages to one verdict per page listed below, or [] when none is.${judgeAgain}`;
  const deck = profile.deck || {};
  const line = (name, label) => deck[name] ? `- ${label}: ${deck[name].measured} against the target ${deck[name].target} (band ${JSON.stringify(deck[name].band ?? null)}), ${deck[name].position}` : null;
  const flagged = (profile.pages || []).filter((p) => p.flags?.length && (!only || only.includes(p.id)));
  return `DENSITY PASS. The rendered pages were measured by the skill's density rules (pdftotext -layout; title and source lines excluded; a block is a run of lines between blank ones; blocks under three words are labels). Compare the deck with the skill's targets, then open every flagged page and judge whether its density is right for the job it does. A flag is a question, not a verdict: a chart-led page may rightly sit light, and a page that clears its word floor with padding or restatement is too dense or the wrong shape even though it passed. Deck against the targets for pages doing this job (block measures over the ${deck.comparedPages ?? "?"} pages that carry commentary or prose, the population the targets describe; ${deck.exhibitLed?.pages ?? 0} exhibit-led pages sit beside them at ${deck.exhibitLed?.wordsPerBlock ?? "-"} words a block, which are labels):
${[line("bodyWordsVsTaskMedian", "body words against each page's task median (1.0 = target median)"), line("blocksPerPage", "text blocks per page"), line("wordsPerBlock", "words per block"), line("longestBlock", "longest block per page"), deck.singleBlockShare ? `- single-block pages: ${deck.singleBlockShare.measured} of pages against at most ${deck.singleBlockShare.target}` : null].filter(Boolean).join("\n")}
Flagged pages:
${flagged.map((p) => `- ${p.id} (page ${p.page}, ${p.task ?? "no task"}): ${p.flags.join("; ")}`).join("\n") || "- none"}${judgeAgain}
Record density.deck as two or three sentences comparing the deck's medians with the skill's targets and saying what that means for a reader, and density.pages as one verdict per listed page (right, too thin, too dense or wrong shape) with the reason you saw on the page. A verdict of right on a page with commentary or prose whose blocks average outside ${JSON.stringify(deck.wordsPerBlock?.band ?? null)} words also quotes, in \`point\`, the developed point (${DEVELOPED_POINT_WORDS} words or more, word for word as printed) that makes the page right; with no such point on the page, it is not right. Any verdict other than right blocks delivery.`;
}

/**
 * Merge the saved parts of a split first pass into <out>/review.json: the one
 * merge `reviewer.mjs merge` and `deliver-deck --review <parts-dir>` both run,
 * held to the packet's sections, binding and prompt hash. The parts are read
 * from the staged packet's parts/ folder unless another folder is named.
 */
export async function mergeReviewDirectory(outputDirectory, partsDirectory = null, { spec, deckPath = null } = {}) {
  const dir = path.resolve(outputDirectory);
  const record = spec ? await readPacketRecord(await lineageStore(spec, dir, deckPath)) : null;
  const from = partsDirectory ? path.resolve(partsDirectory) : record?.staging ? path.join(record.staging, "parts") : null;
  if (!from) return { status: "invalid", errors: ["no review packet was written for this deck: run deliver-deck with --reviewer packet first, or name the parts folder"] };
  const { files, parts } = await readParts(from);
  const slideIds = (await readJson(path.join(dir, "scene.json"))).slides.map((s) => s.id);
  const { review, errors } = mergeReviewParts(parts, slideIds, { sections: record?.sections ?? null, binding: record?.binding, promptHash: record?.promptHash ?? null, waivers: record?.waivers ?? [] });
  if (errors.length) return { status: "invalid", errors, parts: files };
  const reviewPath = path.join(dir, "review.json");
  await writeJson(reviewPath, review);
  return { status: "merged", reviewPath, review, parts: files, findings: review.findings.length };
}

/**
 * Run one read of the deck - a first pass, a verification pass (`scope`) or
 * the confirmation read (`confirmation`) - through the chosen backend, or
 * leave its staged packet for the calling agent. A CLI that fails because it
 * is not signed in falls back to the packet, with the reason in the note.
 */
export async function runReview({ outputDirectory, spec, deckPath = null, backend = "auto", model, timeoutMs = 600000, scope = null, confirmation = null, waivers = [], revision = null }) {
  const out = path.resolve(outputDirectory);
  const { packetDir, packet } = await buildReviewPacket({ outputDirectory: out, spec, deckPath, scope, confirmation, waivers, revision });
  const which = detectBackend(backend);
  const reviewPath = path.join(out, confirmation ? "confirmation.json" : "review.json");
  const deck = deckPath ? path.resolve(deckPath) : "<id>.deck.json";
  const note = packet.sections
    ? `Give each prompt in ${path.join(packetDir, "sections")} to its own fresh reviewer in parallel (no other context), save each JSON answer as ${path.join(packetDir, "parts", "<id>.json")}, run node runtime/reviewer.mjs merge ${deck} ${out}, then rerun deliver-deck with --review ${reviewPath}`
    : `Give ${path.join(packetDir, "prompt.md")} to a fresh ${confirmation ? "reader who has seen no earlier review of this deck" : "reviewer"} (the images sit beside it; give it nothing else), save its JSON answer as ${reviewPath}, then rerun deliver-deck with --review ${reviewPath}`;
  const pending = (why = "") => ({ backend: "packet", status: "packet-written", kind: packet.kind, packetDir, reviewPath, sections: packet.sections?.length ?? 0, note: `${why}${note}` });
  if (which === "packet") return pending();
  const read = (s) => (scope ? scope.mustInspect.includes(s.id) : !packet.revision || packet.revision.changed.includes(s.id));
  let review;
  try {
    if (packet.sections) {
      // Every section and the spine at once: the reviewers are independent, and a
      // fifty-page first pass is only exhaustive when no reader has fifty pages.
      const prompts = Object.fromEntries(await Promise.all([...packet.sections.map((s) => s.id), "spine"].map(async (id) => [id, await fs.readFile(path.join(packetDir, "sections", `${id}.md`), "utf8")])));
      const jobs = [...packet.sections.map((section) => ({ id: section.id, prompt: prompts[section.id], images: packet.slides.filter((s) => section.slides.includes(s.id)).map((s) => s.image) })),
        { id: "spine", prompt: prompts.spine, images: [packet.montage, ...packet.spreads] }];
      const parts = await reviewParts(which, jobs, { partsDir: path.join(packetDir, "parts"), schemaPath: path.join(packetDir, "part-schema.json"), model, timeoutMs, cwd: packetDir, promptHash: packet.promptHash });
      const merged = mergeReviewParts(parts, packet.slides.map((s) => s.id), { sections: packet.sections, binding: packet.binding, promptHash: packet.promptHash, waivers });
      if (merged.errors.length) throw new Error(`The section reviews could not be merged:\n- ${merged.errors.join("\n- ")}`);
      review = merged.review;
    } else {
      review = await callReviewer(which, { prompt: await fs.readFile(path.join(packetDir, "prompt.md"), "utf8"), schemaPath: path.join(packetDir, "schema.json"),
        images: [...packet.slides.filter(read).map((s) => s.image), packet.montage], outPath: path.join(packetDir, "codex-last-message.json"), model, timeoutMs, cwd: packetDir, promptHash: packet.promptHash });
    }
  } catch (error) {
    if (isAuthFailure(error)) return pending(`The ${which} CLI is not signed in (${String(error.message).split("\n").find((l) => l.trim()) ?? "authentication failed"}), so the packet is left for a reviewer the calling agent spawns. `);
    throw error;
  }
  await writeJson(reviewPath, review);
  return { backend: which, status: "reviewed", kind: packet.kind, reviewPath, review };
}

const USAGE = "Usage: reviewer.mjs merge <id>.deck.json output-directory [parts-directory]";

async function main(argv) {
  const [command, deck, out, partsDirectory] = parseCli(argv, {}, { usage: USAGE }).positionals;
  if (command !== "merge" || !deck || !out || !deck.endsWith(".json")) throw new UsageError(USAGE);
  const { review, ...result } = await mergeReviewDirectory(out, partsDirectory, { spec: await readJson(path.resolve(deck)), deckPath: path.resolve(deck) });
  console.log(JSON.stringify(result));
  return result.status === "merged" ? EXIT.ok : EXIT.refused;
}

if (isMain(import.meta.url)) runCli(main);
