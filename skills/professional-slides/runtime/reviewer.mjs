// Model review behind an interface. One rubric, two schemas (the exhaustive
// first pass and the verification passes after it), and a `repair` that has
// to be a sentence. Backends:
//   codex   — `codex exec --image … --output-schema`  (OpenAI Codex CLI)
//   claude  — `claude -p … --output-format json`       (Claude Code CLI; reads the PNGs itself)
//   packet  — no model call: writes review-packet/ for the calling agent to review and
//             answer with `deliver-deck.mjs … --review review.json`. This is the default
//             inside an agent session, where the agent *is* the reviewer.
//
// The first pass is exhaustive: a verdict and a note per rubric dimension for
// every page, every deck-level finding with every page it affects, and a
// completeness self-check. A long deck is read by parallel section reviewers
// and one spine reviewer, merged here into one review. Every later pass is a
// verification (review-passes.mjs): a status for each open finding, and new
// findings only where they are serious and additive. The deck review is not
// prepared at all until the storyline critique is ready for the current spine.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runProcess } from "./process.mjs";
import { storylineGate } from "./storyline.mjs";
import {
  SEVERITIES, PAGE_VERDICTS, STATUSES, NEW_BASES, MAX_PASSES, SEVERITY_DEFINITIONS, BLOCKING, verdictOf,
  pageListErrors, advanceLedger, openEntries, openBlocking, expectedVerdicts, verificationErrors, coverageErrors,
  verdictErrors, completenessErrors, changedPages, uniqueIds, detectBackend,
} from "./review-passes.mjs";

export { SEVERITIES, MAX_PASSES, detectBackend };
export const CODES = Object.freeze({
  // facts and evidence
  FACTUAL_ERROR: "a stated number, name or date is wrong",
  UNSUPPORTED_CLAIM: "a claim the cited evidence does not support",
  MISLEADING_COMPARISON: "values compared across incompatible bases without saying so",
  MISSING_EVIDENCE: "a ranked criterion or stated requirement has no comparative evidence",
  MISSING_ARGUMENT: "the page's purpose or necessary inference is unclear from its title, evidence and commentary together",
  // legibility and geometry
  UNREADABLE: "text too small, clipped or low-contrast to read",
  OVERFLOW: "content exceeds its box or the slide",
  BROKEN_GEOMETRY: "misaligned, overlapping or orphaned elements",
  PROVENANCE: "a number or claim with no traceable source, basis or as-at date",
  // design — these block too
  DEAD_SPACE: "a large empty band the page does nothing with",
  LAYOUT_MONOTONY: "the same page construction repeated across most of the deck",
  NO_HERO_EXHIBIT: "an analytical page with no dominant exhibit",
  OVERSIZED_TYPE: "body or chart type set larger than a reader expects on a slide",
  WALL_OF_TEXT: "prose doing the work an exhibit should do",
  BURIED_NUMBER: "a decisive number in a sentence instead of on a mark",
  HEDGED_TITLE: "an action title that does not commit to a finding",
  TITLE_TOO_LONG: "an action title over two lines",
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
  type: "object", additionalProperties: false, required: [...Object.keys(FINDING_PROPERTIES), "basis", "justification"],
  properties: { ...FINDING_PROPERTIES, basis: { type: "string", enum: Object.keys(NEW_BASES) }, justification: { type: "string" } }
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
        properties: { slide: { type: "string" }, verdict: { type: "string", enum: DENSITY_VERDICTS }, reason: { type: "string", minLength: 20 } }
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
const COMMON = {
  binding: HASH,
  rating: { type: "number", minimum: 0, maximum: 10 },
  accepted: { type: "boolean" },
  summary: { type: "string", minLength: 20 },
  density: DENSITY,
};

/** Pass one: exhaustive. Every page, every dimension, every affected page, and what found nothing. */
export const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["pass", "verifies", "accepted", "summary", "rating", "binding", "pages", "findings", "completeness", "assessment", "density"],
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
  required: ["pass", "verifies", "accepted", "summary", "rating", "binding", "pages", "statuses", "findings", "density"],
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

/** One reviewer's share of a long deck's first pass: a section of pages, or the spine. */
export const PART_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["part", "binding", "accepted", "summary", "rating", "pages", "findings", "completeness"],
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
    ...(f.basis ? { basis: f.basis, justification: f.justification } : {}),
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

/** The ledger after this review: the prior ledger with its statuses applied and its new findings added. */
export function deckLedger(priorLedger, review) {
  const items = deckItems(review);
  if (!priorLedger?.length) return advanceLedger([], review, items);
  // A later pass's density item for a page that stays wrong is the same item, not a new one.
  return advanceLedger(priorLedger, withDensityStatuses(review, priorLedger), items);
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

/**
 * Validate a deck review. With no scope it is the exhaustive first pass;
 * with a scope (verificationScope) it is a later pass checked against the
 * ledger it verifies.
 */
export function validateReview(review, slideIds, { scope = null, ledger = [] } = {}) {
  if (!review || typeof review !== "object") return ["review is not an object"];
  const errors = basicErrors(review);
  if (!Array.isArray(review.findings)) return [...errors, "findings must be an array"];
  errors.push(...findingErrors(review.findings, slideIds));
  if (!Array.isArray(review.pages)) return [...errors, "pages must hold one coverage entry per page read"];
  errors.push(...pageCheckErrors(review.pages));
  const items = deckItems({ findings: review.findings });
  if (scope) {
    errors.push(...verificationErrors(review, { scope, ledger, items, ids: slideIds, automatic: isDensity }));
  } else {
    if (review.pass !== 1) errors.push("pass must be 1: this is the first, exhaustive pass");
    if (review.verifies !== null && review.verifies !== undefined) errors.push("verifies is null on the first pass");
    errors.push(...coverageErrors(review.pages, slideIds));
    errors.push(...completenessErrors(review.completeness, DIMENSIONS, items));
    const assessment = review.assessment;
    const thin = ASSESSMENT_KEYS.filter((k) => typeof assessment?.[k] !== "string" || assessment[k].trim().length < 10);
    if (thin.length) errors.push(`assessment: write ${thin.join(", ")}`);
  }
  const after = deckLedger(scope ? ledger : [], review);
  // Density verdicts sit beside the findings rather than in page verdicts: a
  // page judged "too dense" is blocked by that verdict, not asked to repeat it.
  errors.push(...verdictErrors(review.pages, after.filter((e) => !isDensity(e))));
  if (review.accepted === true && openBlocking(after).length) errors.push("accepted cannot be true while a major or blocker finding is open");
  return errors;
}

/**
 * Validate one part of a split first pass. A section part covers its own
 * pages on every page dimension; the spine part covers the deck dimensions
 * and writes the deck's assessment, rating and density comparison.
 */
export function validatePart(part, slideIds) {
  if (!part || typeof part !== "object") return ["part is not an object"];
  const meta = part.part;
  if (!meta || !["section", "spine"].includes(meta.kind) || typeof meta.id !== "string") return ["part must say { kind: section|spine, id, slides }"];
  const errors = basicErrors(part);
  if (!/^[a-f0-9]{64}$/.test(part.binding ?? "")) errors.push("binding is missing");
  if (!Array.isArray(part.findings)) return [...errors, "findings must be an array"];
  errors.push(...findingErrors(part.findings, slideIds));
  const items = deckItems({ findings: part.findings });
  if (meta.kind === "section") {
    const own = new Set(meta.slides || []);
    const outside = [...new Set(items.flatMap((f) => f.pages).filter((id) => !own.has(id)))];
    if (outside.length) errors.push(`findings name ${outside.join(", ")}, outside this section; the spine reviewer files deck findings across sections`);
    errors.push(...coverageErrors(part.pages, meta.slides || []), ...pageCheckErrors(part.pages));
    errors.push(...completenessErrors(part.completeness, PAGE_DIMENSIONS, items));
    errors.push(...verdictErrors(part.pages, advanceLedger([], {}, items)));
  } else {
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
export function mergeReviewParts(parts, slideIds, sections = null) {
  const errors = [];
  for (const part of parts) errors.push(...validatePart(part, slideIds).map((e) => `${part?.part?.id ?? "part"}: ${e}`));
  const spine = parts.filter((p) => p?.part?.kind === "spine");
  const sectionParts = parts.filter((p) => p?.part?.kind === "section");
  if (spine.length !== 1) errors.push(`a split review needs exactly one spine part; got ${spine.length}`);
  if (new Set(parts.map((p) => p?.binding)).size > 1) errors.push("the parts are bound to different builds");
  const covered = sectionParts.flatMap((p) => p.part?.slides || []);
  const uncovered = slideIds.filter((id) => !covered.includes(id));
  if (uncovered.length) errors.push(`no section part covers ${uncovered.join(", ")}`);
  const twice = covered.filter((id, i) => covered.indexOf(id) !== i);
  if (twice.length) errors.push(`${[...new Set(twice)].join(", ")} covered by two section parts`);
  for (const section of sections || []) {
    const part = sectionParts.find((p) => p.part.id === section.id);
    if (!part) errors.push(`section ${section.id} has no part`);
  }
  if (errors.length) return { errors };

  const order = new Map(slideIds.map((id, i) => [id, i]));
  const sort = (list) => [...new Set(list)].sort((a, b) => order.get(a) - order.get(b));
  const rename = uniqueIds(parts, (p) => p.findings || []);
  const findings = [];
  const byKey = new Map();
  for (const part of [...spine, ...sectionParts]) for (const f of part.findings) {
    const finding = { ...f, id: rename(part, f.id), slides: sort(f.slides) };
    const key = `${f.code}\u0000${f.dimension}`;
    const same = f.scope === "deck" ? byKey.get(key) : null;
    if (!same) { findings.push(finding); if (f.scope === "deck") byKey.set(key, finding); continue; }
    same.slides = sort([...same.slides, ...finding.slides]);
    if (!same.reason.includes(finding.reason)) same.reason = `${same.reason} / ${finding.reason}`;
    if (SEVERITIES.indexOf(finding.severity) > SEVERITIES.indexOf(same.severity)) { same.severity = finding.severity; same.repair = finding.repair; }
    same.checkable = same.checkable ?? finding.checkable ?? null;
  }
  const expected = expectedVerdicts(advanceLedger([], {}, deckItems({ findings })));
  const pages = sectionParts.flatMap((p) => p.pages).sort((a, b) => order.get(a.slide) - order.get(b.slide))
    .map((p) => ({ ...p, verdict: verdictOf(expected.get(p.slide) ?? "none") }));
  const completeness = DIMENSIONS.map((dimension) => {
    const notes = parts.flatMap((p) => (p.completeness || []).filter((c) => c.dimension === dimension).map((c) => `${p.part.id}: ${c.note}`));
    return { dimension, result: findings.some((f) => f.dimension === dimension) ? "findings" : "clean", note: notes.join(" | ") };
  });
  const missing = completeness.filter((c) => !c.note).map((c) => c.dimension);
  if (missing.length) return { errors: [`no part reported what it checked for ${missing.join(", ")}`] };
  const [lead] = spine;
  const densityPages = new Map();
  for (const part of parts) for (const p of part.density?.pages || []) if (!densityPages.has(p.slide)) densityPages.set(p.slide, p);
  const review = {
    pass: 1, verifies: null, binding: lead.binding, rating: lead.rating, summary: lead.summary, pages, findings, completeness,
    assessment: lead.assessment, density: { deck: lead.density?.deck ?? "", pages: [...densityPages.values()] },
    mergedFrom: parts.map((p) => p.part.id),
  };
  review.accepted = parts.every((p) => p.accepted === true) && !openBlocking(deckLedger([], review)).length;
  return { review, errors: [] };
}

/**
 * Split a long deck for parallel first-pass reviewers: one section per
 * divider, short sections folded into the one before, long ones cut into even
 * chunks, so each reviewer reads a dozen pages closely instead of fifty
 * pages thinly. A spine reviewer reads the whole sequence alongside them.
 */
export const SECTION_REVIEW_THRESHOLD = 24;
export function reviewSections(scene, { max = 14, min = 5 } = {}) {
  const isDivider = (s) => !s.nodes?.some((n) => n.role === "action-title" || n.role === "cover-title")
    && ((s.componentInstances || []).some((c) => /section/.test(String(c.component))) || (s.nodes || []).some((n) => /divider|section-title/.test(String(n.role))));
  const titleOf = (s) => (s.nodes || []).find((n) => n.type === "text" && n.text)?.text?.replace(/\n/g, " ") ?? s.id;
  const groups = [];
  for (const s of scene.slides) {
    if (!groups.length || isDivider(s)) groups.push({ title: groups.length ? titleOf(s) : "Opening", slides: [] });
    groups.at(-1).slides.push(s.id);
  }
  const folded = [];
  for (const g of groups) {
    const last = folded.at(-1);
    if (last && (g.slides.length < min || last.slides.length < min) && last.slides.length + g.slides.length <= max) { last.slides.push(...g.slides); last.title = `${last.title}; ${g.title}`; }
    else folded.push({ ...g, slides: [...g.slides] });
  }
  const out = [];
  for (const g of folded) {
    const n = Math.ceil(g.slides.length / max), size = Math.ceil(g.slides.length / n);
    for (let k = 0; k < n; k += 1) out.push({ title: n > 1 ? `${g.title} (${k + 1} of ${n})` : g.title, slides: g.slides.slice(k * size, (k + 1) * size) });
  }
  return out.map((g, i) => ({ id: `s${i + 1}`, ...g }));
}

/** Bind a visual review to the exact editable file, scene and rendered pages. */
export async function reviewBinding(directory) {
  const scene = JSON.parse(await fs.readFile(path.join(directory, "scene.json"), "utf8"));
  const result = JSON.parse(await fs.readFile(path.join(directory, "build-result.json"), "utf8"));
  const files = ["scene.json", path.relative(directory, result.pptxPath),
    ...scene.slides.map((_, i) => `rendered/slide-${i + 1}.png`)];
  const hash = createHash("sha256");
  for (const file of files) { hash.update(file); hash.update(await fs.readFile(path.join(directory, file))); }
  return hash.digest("hex");
}

/** One hash per slide over its scene record and its render: what a verification review compares. */
export async function slideHashes(directory) {
  const scene = JSON.parse(await fs.readFile(path.join(directory, "scene.json"), "utf8"));
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
  const current = await fs.readFile(file, "utf8").then(JSON.parse).catch(() => null);
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
  await fs.writeFile(file, JSON.stringify({ schema: "professional-slides.check-candidates/v1",
    note: "Review findings a deterministic check could have caught. Turn each into a compile-time or composition check in its owner (SKILL.md, Iterate the reusable skill), then remove it here.",
    candidates }, null, 2) + "\n");
  return { file, added: found.length, candidates };
}

/** A recorded pass's ledger; a record written before ledgers existed rebuilds it from its review. */
export const ledgerOf = (record) => record?.ledger ?? (record?.review ? deckLedger([], record.review) : []);
const passOf = (record) => record?.pass ?? record?.review?.pass ?? 1;

/**
 * Keep a validated review with the slide hashes it was bound to, its pass,
 * the review it verifies and the ledger after it, so the next pass can be
 * scoped and the acceptance rule read across every pass.
 */
export async function recordReview(directory, review, priorLedger = []) {
  const dir = path.join(directory, HISTORY);
  await fs.mkdir(dir, { recursive: true });
  const n = (await fs.readdir(dir)).filter((f) => /^review-\d+\.json$/.test(f)).length + 1;
  const file = path.join(dir, `review-${n}.json`);
  const ledger = deckLedger(review.pass > 1 ? priorLedger : [], review);
  await fs.writeFile(file, JSON.stringify({ review, binding: review.binding, pass: review.pass ?? 1, verifies: review.verifies ?? null,
    slideHashes: await slideHashes(directory), ledger, recordedAt: new Date().toISOString() }, null, 2) + "\n");
  await recordCheckCandidates(directory, review, file);
  return file;
}

export async function latestReview(directory) {
  const dir = path.join(directory, HISTORY);
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => /^review-\d+\.json$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  return files.length ? JSON.parse(await fs.readFile(path.join(dir, files.at(-1)), "utf8")) : null;
}

/**
 * What the next pass is: its number, the review it verifies, the pages it
 * must read (every page whose scene record or render changed, the neighbours
 * of deleted pages, and every page an open major or blocker names), the open
 * findings it must give a status, and the density verdicts it inherits. The
 * changed pages are also the only ones a new major finding may be raised on.
 * `capped` says the pass would exceed the loop's cap.
 */
export function verificationScope(prior, current, { maxPasses = MAX_PASSES } = {}) {
  if (!prior?.slideHashes || !prior.review) return null;
  const moved = changedPages(prior.slideHashes, current);
  if (!moved) return null;
  const ledger = ledgerOf(prior);
  const open = openEntries(ledger);
  const blocking = openBlocking(ledger);
  const ids = Object.keys(current);
  const named = new Set(blocking.flatMap((e) => e.pages || []).filter((id) => current[id]));
  const changed = [...new Set([...moved.changed, ...moved.neighbours])];
  const mustInspect = ids.filter((id) => changed.includes(id) || named.has(id));
  const inheritedDensity = (prior.review.density?.pages || []).filter((p) => p.verdict === "right" && !mustInspect.includes(p.slide) && current[p.slide]);
  const pass = passOf(prior) + 1;
  return {
    pass, verifies: prior.binding, basedOn: prior.binding, maxPasses, capped: pass > maxPasses,
    changed, deleted: moved.deleted, mustInspect, open, ledger,
    priorBlocking: blocking.map((e) => ({ id: e.id, slide: e.pages?.[0] ?? null, slides: e.pages || [], code: e.code, severity: e.severity, reason: e.reason, repair: e.repair })),
    inheritedDensity, priorRating: prior.review.rating,
  };
}

/** A verification review carries forward the density verdicts of pages it did not need to reread. */
export function withInheritedDensity(review, scope) {
  if (!scope) return review;
  const judged = new Set((review.density?.pages || []).map((p) => p.slide));
  const pages = [...(review.density?.pages || []), ...scope.inheritedDensity.filter((p) => !judged.has(p.slide))];
  return { ...review, density: { ...(review.density || {}), pages } };
}

/** The review is bound to the current build. Coverage is validateReview's job. */
export async function validateReviewBinding(review, directory) {
  const errors = [];
  if (review.binding !== await reviewBinding(directory)) errors.push("Review does not match the current PPTX, scene and renders");
  if (!Number.isFinite(review.rating) || review.rating < 0 || review.rating > 10) errors.push("Review must provide a rating from zero to ten");
  return errors;
}

/**
 * The density pass is complete: the deck comparison is written and every page
 * the profile flagged has a verdict. A review without it cannot accept a deck
 * whose rendered words were never compared with the skill's density targets.
 */
export function validateDensityReview(review, profile) {
  if (!profile) return [];
  const errors = [];
  const density = review?.density;
  if (!density || typeof density !== "object") return ["Review must carry the density pass (density.deck and density.pages)"];
  if (typeof density.deck !== "string" || density.deck.trim().length < 40) errors.push("density.deck must compare the deck's measured medians with the skill's targets");
  const pages = Array.isArray(density.pages) ? density.pages : [];
  for (const [i, entry] of pages.entries()) {
    if (!DENSITY_VERDICTS.includes(entry?.verdict)) errors.push(`density.pages[${i}]: verdict must be one of ${DENSITY_VERDICTS.join(", ")}`);
    if (typeof entry?.reason !== "string" || entry.reason.trim().length < 20) errors.push(`density.pages[${i}]: give the reason for the verdict`);
  }
  const judged = new Set(pages.map((entry) => entry?.slide));
  const missing = (profile.flaggedPages || []).filter((id) => !judged.has(id));
  if (missing.length) errors.push(`density pass must judge every flagged page; missing ${missing.join(", ")}`);
  return errors;
}

/**
 * The acceptance rule, read off the ledger of every pass rather than off the
 * last review alone: accepted when the reviewer accepts and no major or
 * blocker finding from any pass is still open (density verdicts included).
 */
export function reviewOutcome(review, priorLedger = []) {
  const ledger = deckLedger(review?.pass > 1 ? priorLedger : [], review);
  const blocking = openBlocking(ledger).map((e) => ({ id: e.id, slide: e.pages?.[0] ?? null, slides: e.pages || [], code: e.code, severity: e.severity,
    reason: e.status === "open" ? e.reason : `${e.status} (pass ${e.updatedIn}): ${e.reason}`, repair: e.repair }));
  const newBlockers = ledger.filter((e) => e.raisedIn === (review?.pass ?? 1) && e.severity === "blocker" && e.status === "open");
  return { accepted: review?.accepted === true && blocking.length === 0, blocking, ledger, newBlockers: newBlockers.length };
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

/**
 * Write the review packet: the prompt, the schema, and per page its text,
 * exhibits, gate findings, image and checklist. Refused until the storyline
 * critique is ready for the deck's current spine, because a deck review spent
 * on an argument that is about to change is spent twice. A long first pass is
 * split into section prompts and a spine prompt for parallel reviewers.
 */
export async function buildReviewPacket({ outputDirectory, spec, brief = "", answer = "", scope = null }) {
  const dir = path.resolve(outputDirectory);
  if (!spec || typeof spec !== "object") throw new Error("buildReviewPacket needs the deck spec: the deck review is prepared only once the storyline critique is ready for its spine");
  const gate = await storylineGate(spec, dir);
  if (gate.length) throw Object.assign(new Error(`The deck review waits for the storyline critique: ${gate.join("; ")}`), { code: "STORYLINE_NOT_READY", reasons: gate });
  const scene = JSON.parse(await fs.readFile(path.join(dir, "scene.json"), "utf8"));
  const gates = await fs.readFile(path.join(dir, "gates.json"), "utf8").then(JSON.parse).catch(() => ({ findings: [] }));
  const packetDir = path.join(dir, "review-packet");
  // Section prompts are rewritten each time; answers already saved in parts/
  // stay, and the merge refuses any bound to another build.
  await fs.rm(path.join(packetDir, "sections"), { recursive: true, force: true });
  await fs.mkdir(packetDir, { recursive: true });
  const slides = scene.slides.map((s, i) => ({
    id: s.id, index: i + 1,
    title: s.nodes.find((n) => n.role === "action-title" || n.role === "cover-title")?.text?.replace(/\n/g, " ") ?? "",
    text: textOf(s),
    exhibits: (s.componentInstances || []).filter((c) => /^(chart\.|table|image-frame|metric)/.test(c.component)).map((c) => ({ component: c.component, frame: c.frame })),
    gateFindings: (gates.findings || []).filter((f) => f.slide === s.id || f.slide === i + 1),
    image: path.join(dir, "rendered", `slide-${i + 1}.png`),
    ...checklistOf(s),
  }));
  const statistics = designStatistics(scene);
  const density = await fs.readFile(path.join(dir, "density-profile.json"), "utf8").then(JSON.parse).catch(() => null);
  const craft = await fs.readFile(path.join(dir, "preflight-gates.json"), "utf8").then(JSON.parse).then((r) => (r.findings || []).filter((f) => String(f.code).startsWith("CRAFT_"))).catch(() => []);
  const spreads = (await fs.readdir(path.join(dir, "rendered")).catch(() => [])).filter((f) => /^spread-.*\.png$/.test(f)).map((f) => path.join(dir, "rendered", f));
  const sections = !scope && slides.length > SECTION_REVIEW_THRESHOLD ? reviewSections(scene) : null;
  const schema = scope ? VERIFICATION_SCHEMA : REVIEW_SCHEMA;
  const packet = { binding: await reviewBinding(dir), pass: scope ? scope.pass : 1, verifies: scope ? scope.verifies : null, maxPasses: scope?.maxPasses ?? MAX_PASSES,
    scope, sections, craft, statistics, density, brief, answer, montage: path.join(dir, "rendered", "montage.png"), spreads,
    titles: slides.map((s) => `${s.index}. [${s.id}] ${s.title}`), slides, rubric: RUBRIC, severities: SEVERITY_DEFINITIONS, codes: CODES, schema };
  await fs.writeFile(path.join(packetDir, "packet.json"), JSON.stringify(packet, null, 2));
  await fs.writeFile(path.join(packetDir, "schema.json"), JSON.stringify(schema, null, 2));
  await fs.writeFile(path.join(packetDir, "prompt.md"), scope ? verificationPrompt(packet) : reviewPrompt(packet));
  if (sections) {
    await fs.mkdir(path.join(packetDir, "sections"), { recursive: true });
    await fs.mkdir(path.join(packetDir, "parts"), { recursive: true });
    await fs.writeFile(path.join(packetDir, "part-schema.json"), JSON.stringify(PART_SCHEMA, null, 2));
    for (const section of sections) await fs.writeFile(path.join(packetDir, "sections", `${section.id}.md`), sectionPrompt(packet, section));
    await fs.writeFile(path.join(packetDir, "sections", "spine.md"), spinePrompt(packet));
  }
  return { packetDir, packet };
}

/** Descriptive diagnostics for analysis; not editorial targets or reference proof. */
export function designStatistics(scene) {
  // Counts describe rendered devices, not whether their semantic use is appropriate. `page_gates.py` holds the same list, because the
  // build has to be able to refuse a deck and the build reads that file.
  const TREATMENT = /^table-(bubble|bar|rating-|implication|column-band|row-band|zebra-band|harvey|status-pill|number-circle|lamp|dot|check|progress-|cell-icon|section-marker|section-number)/;
  const ANNOTATION = /^(annotation-|chart-(bracket|delta|event-|highlight|reference|band|callout|change))/;
  const content = scene.slides.filter((s) => s.nodes.some((n) => n.role === "action-title"));
  const kinds = new Set();
  let tables = 0, treated = 0, charts = 0, annotated = 0, marks = 0, unsourced = 0;
  for (const slide of content) {
    const components = (slide.componentInstances || []).map((c) => String(c.component));
    for (const c of components) if (!["chrome", "section", "page-template"].includes(c)) kinds.add(c);
    const roles = slide.nodes.map((n) => String(n.role ?? ""));
    // "Drawings": every primitive that is not type. A well-made
    // analytical page carries 32 (p25 11, p75 88); a page of rules and text
    // carries very few, which is the difference a reader feels first.
    marks += slide.nodes.filter((n) => n.type !== "text").length;
    // An empty picture frame: a photograph written as `alt` with no `path`. It
    // is how a page gets laid out before its pictures are cleared, and it is
    // not how a deck is delivered - so it is counted, not assumed away.
    unsourced += slide.nodes.filter((n) => String(n.role ?? "") === "image-frame").length;
    if (components.some((c) => /^(table|comparison-table|heatmap|trend-rows)$/.test(c))) {
      tables += 1;
      if (roles.some((r) => TREATMENT.test(r))) treated += 1;
    }
    if (components.some((c) => c.startsWith("chart."))) {
      charts += 1;
      // A recoloured category draws no node of its own - the mark keeps its
      // role and carries `highlighted` - and it is the commonest mark there is.
      const recoloured = slide.nodes.some((n) => n.data?.highlighted);
      if (recoloured || roles.some((r) => ANNOTATION.test(r))) annotated += 1;
    }
  }
  const round = (n) => Math.round(n * 100) / 100;
  return {
    contentPages: content.length,
    exhibitVarietyPerTen: content.length ? round((kinds.size / content.length) * 10) : 0,
    distinctExhibits: kinds.size,
    unsourcedPictures: unsourced,
    tables, tablesTreated: tables ? round(treated / tables) : null,
    charts, chartsAnnotated: charts ? round(annotated / charts) : null,
    drawingsPerPage: content.length ? round(marks / content.length) : 0,
    reference: { exhibitVarietyPerTen: "7.1 to 8.3", tablesTreated: 0.89, chartsAnnotated: 0.63, drawingsPerPage: 32 },
  };
}

const guidance = (names) => names.map((name) => fileURLToPath(new URL(`../references/${name}.md`, import.meta.url)));

/** The rubric and the severity scale, as the reviewer reads them. */
export function rubricPrompt() {
  return `THE RUBRIC. Check every dimension on every page it applies to; the deck dimensions across the whole sequence.
${DIMENSIONS.map((d) => `- ${d} (${RUBRIC[d].scope}): ${RUBRIC[d].checks}`).join("\n")}

SEVERITY, calibrated so the same defect gets the same level on every deck:
${["blocker", "major", "minor", "none"].map((s) => `- ${s}: ${SEVERITY_DEFINITIONS[s]}`).join("\n")}`;
}

const FINDING_RULES = `FINDINGS. Give each finding an id (F1, F2, ...), a scope, the rubric dimension it belongs to, a code, a severity, a reason and a concrete repair (what to add, replace, move, merge, cut, plot, label or rewrite, and where). A page finding names its one page in \`slides\`. A deck finding - a defect of the sequence, or one defect recurring on several pages - lists EVERY page it affects in \`slides\`, in deck order: never a sample, never "e.g.", "such as", "for example" or "etc.". Validation refuses a sampled page list, and a finding whose reason or repair names a page its \`slides\` leave out. Do not file twenty copies of one defect: file it once, as a deck finding with all its pages.`;

const PAGE_RULES = `PAGE COVERAGE. \`pages\` holds one entry per page: its id, a verdict (ok, minor, major, blocker) and \`checks\`, a short note for each page dimension (${PAGE_DIMENSIONS.join(", ")}) saying what you checked and what you saw - "n/a - no table on this page" where a dimension has nothing to check. A page's verdict is the worst severity of the open findings that name it (ok when none does); validation refuses a verdict that disagrees with the findings.`;

const COMPLETENESS_RULES = (dimensions) => `COMPLETENESS SELF-CHECK. \`completeness\` holds one entry per dimension (${dimensions.join(", ")}): result "findings" when you filed any under it, or "clean" with a note saying what you checked and why nothing was found. A clean dimension with nothing said about it is a gap, not a pass.`;

const pageLine = (s) => `- [${s.id}] page ${s.index}: ${s.title || "(no title)"} - ${s.image}${s.exhibits?.length ? `; exhibits: ${s.exhibits.map((e) => e.component).join(", ")}` : ""}${s.absent?.length ? `; n/a: ${s.absent.join(", ")}` : ""}`;

function gatePrompt(packet, only = null) {
  const slides = (packet.slides || []).filter((s) => !only || only.includes(s.id));
  return `Deterministic gate findings already computed (confirm, refine or explain why they do not matter):
${slides.flatMap((s) => (s.gateFindings || []).map((f) => `- ${s.id} (page ${s.index}) ${f.code}: ${f.measured ?? ""} (threshold ${f.threshold ?? ""})`)).join("\n") || "- none"}

Deck craft findings from the build (a blocker has already stopped delivery; confirm each advisory or explain why it does not apply):
${(packet.craft || []).map((f) => `- ${f.severity} ${f.code}: ${JSON.stringify(f.measured)}`).join("\n") || "- none"}`;
}

const VISUAL = `VISUAL REVIEW. Read the deck through its spreads (rendered/spread-*.png, four pages to a sheet at reading size) and the montage for the sequence, then open every page at full size for its page checks. Follow the semantic checks in references/design.md: coherent argument and counts; reconciled totals, periods, sample membership and durations; scoped comparisons, non-causal wording unless supported, and reversal conditions that affect the named option; focus that supports the claim; appropriate table category/dimension grammar; one chart heading owner; consistent qualifiers; vertically balanced sparse groups; meaningful arrows and rules; and cross-slide consistency. Neutral charts, joined verdicts and optional commentary are valid where they serve the page.`;

const CRAFT = `CRAFT REVIEW. Judge the deck the way a partner would who has seen strong decks on this subject. For every chart ask what it shows that two numbers in the title do not: a chart of two bars is a metric pair (TRIVIAL_CHART); a chart that could show the trend with its growth rate, the full ranked peer set, the share or the gap to a benchmark and does not is NO_INSIGHT_CHART. For every table ask whether it compares, rates or judges and, if so, whether the treatment shows it (FLAT_TABLE). Count the constructions: steps, cards, bar charts or two-column comparisons standing in for evidence of other shapes is DEVICE_OVERUSE. Named players (companies, brands, products, places) compared without a page that introduces them with their logos is MISSING_CONTEXT. Maps are checked for placed cities, meaningful fills, marker size and the routes or flows they are about (MAP_DESIGN). Parallel categories with no icon, and a deck with no photograph of a recognisable subject, are defects too. These are major when they recur across the deck. Record concrete defects, not preferences.`;

const REFERENCES = `If the user supplied reference decks, compare strong relevant pages from each before scoring and record the pages inspected. Reference material is only what the user supplied: never search the machine for other decks or documents. Historical aggregate device counts do not establish a benchmark. Explain concrete differences in evidence relationships and reader effort; do not infer quality from more devices or annotations. Compare substantive text against matched reading tasks, preserving necessary explanation without padding.`;

const ASSESS = `ASSESSMENT. Write \`assessment\`: argument, evidence, visual explanation, copy and sequence quality, each in a sentence or two; the best page and the worst page and why; the most repetitive sequence; and the most deletable page, challenged with a concrete merger and the evidence it would lose. Reproduce material calculations from supplied source records; disclose unverified assumptions.`;

export function reviewPrompt(packet) {
  // Historical aggregates remain available to analysis callers, not as review targets.
  const { reference: historicalReference, ...candidateStatistics } = packet.statistics || {};
  const slides = packet.slides || [];
  const split = packet.sections?.length ? `
THIS DECK IS LONG (${slides.length} pages), so read it in parallel where the harness can spawn subagents: give each prompt in review-packet/sections/ (${packet.sections.map((s) => `${s.id}.md: ${s.slides.length} pages`).join("; ")}; and spine.md for the whole sequence) to its own fresh reviewer at the same time, save each JSON answer as review-packet/parts/<id>.json, then run \`node runtime/reviewer.mjs merge <out>\`, which joins them into <out>/review.json and refuses any part that misses a page. A harness with no subagents works through this prompt alone, page by page.
` : "";
  return `You are the first reader of a finished consulting deck, reviewing it against the client's brief the way an engagement manager would the night before a steering committee. This is pass 1 of at most ${packet.maxPasses ?? MAX_PASSES}, and it is exhaustive.

Read these skill files before assessing: ${guidance(["storylining", "design", "taste-review"]).join(", ")}. The taste-review guidance owns the rubric, the severity scale, benchmark comparison and literal coverage. Do not consult prior candidate scores, repair lists or peer status summaries.

Why exhaustive: every later pass only verifies. It gives each of your findings a status and may add a new finding only when it is a major or blocker on a page the rebuild changed, or a blocker you demonstrably could not have seen. A defect you see now and leave out will not be raised again, and a sampled page list leaves the author guessing which pages to fix. Report every defect at every severity, on every page, with its repair: work through every page and every dimension before deciding.
${split}
BRIEF: ${packet.brief || "(not supplied)"}
GOVERNING ANSWER: ${packet.answer || "(not supplied)"}

TITLES ALONE (read as a memo first - does the argument flow?):
${(packet.titles || []).join("\n")}

${rubricPrompt()}

HOW TO WORK.
1. Read the titles alone and write down what the deck argues; check the executive summary and the close against it (bookends).
2. Page by page, in order, for every page below: open its image, read its text in packet.json, check each page dimension and write its note, and file every defect as a finding.
3. Across the deck: repeated constructions in any window of neighbouring pages, styling, terminology and number formats (consistency); section openings, development and closes and the variety of reading tasks (rhythm); logos, product images and maps where recognition matters (identity).
4. Before returning, run the completeness self-check.

${PAGE_RULES}

${FINDING_RULES}

${COMPLETENESS_RULES(DIMENSIONS)}

For each slide, decide whether a reader gets the finding from the title and can verify it from the exhibit. A separate soWhat or closing strip is optional: the title and exhibit may already complete the argument. Two distinct insights can share a page when each is supported and clearly placed. Flag redundant propositions or competing summary boxes, not the absence of a footer conclusion. Use these codes where appropriate, or a precise upper-case code for a newly observed defect:
${Object.entries(packet.codes || CODES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

${checkablePrompt()}

${gatePrompt(packet)}

PAGES (id, page, title, image, exhibits, dimensions with nothing to check):
${slides.map(pageLine).join("\n") || "- (see packet.json)"}
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
Set accepted=false if any finding is major or blocker. The summary is two sentences: what the deck does well and what must change.`;
}

/** One section of a long deck's first pass: its pages, closely, on every page dimension. */
export function sectionPrompt(packet, section) {
  const slides = (packet.slides || []).filter((s) => section.slides.includes(s.id));
  return `You are one of several reviewers reading a long consulting deck in parallel for its exhaustive first pass. Yours is section ${section.id}, "${section.title}": pages ${section.slides.join(", ")}. Other reviewers take the other sections, and a spine reviewer reads the whole sequence for consistency, rhythm and the executive summary and close. Read ${guidance(["design", "taste-review"]).join(" and ")} for the standards. Do not consult prior candidate scores, repair lists or peer status summaries.

BRIEF: ${packet.brief || "(not supplied)"}
GOVERNING ANSWER: ${packet.answer || "(not supplied)"}

THE WHOLE TITLE SPINE, for context (review only your pages):
${(packet.titles || []).join("\n")}

${rubricPrompt()}

Check every page dimension on every one of your pages. Later passes only verify, so a defect you leave out now will not be raised again.

${PAGE_RULES}

${FINDING_RULES} A defect recurring on several of your pages is a deck finding listing every one of them; the merge joins it with the same defect seen from other sections. Name only pages in your section.

${COMPLETENESS_RULES(PAGE_DIMENSIONS)}

Codes (or a precise upper-case code of your own):
${Object.entries(packet.codes || CODES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

${checkablePrompt()}

${gatePrompt(packet, section.slides)}

YOUR PAGES:
${slides.map(pageLine).join("\n")}

${VISUAL}

${CRAFT}

${densityPrompt(packet.density, section.slides)} Leave density.deck to the spine reviewer: write "Judged by the spine reviewer for the whole deck." there.

Set part to ${JSON.stringify({ kind: "section", id: section.id, slides: section.slides })}. Bind to ${packet.binding}; rate your section out of ten.
Return ONLY JSON matching this schema: ${JSON.stringify(PART_SCHEMA)}`;
}

/** The spine of a long deck's first pass: what no section reviewer can see. */
export function spinePrompt(packet) {
  const { reference: historicalReference, ...candidateStatistics } = packet.statistics || {};
  return `You are the spine reviewer of a long consulting deck read in parallel for its exhaustive first pass. Section reviewers read every page closely; you read the whole deck for what none of them can see. Read ${guidance(["storylining", "design", "taste-review"]).join(", ")}. Do not consult prior candidate scores, repair lists or peer status summaries.

BRIEF: ${packet.brief || "(not supplied)"}
GOVERNING ANSWER: ${packet.answer || "(not supplied)"}

TITLES ALONE:
${(packet.titles || []).join("\n")}

${rubricPrompt()}

Your dimensions are ${DECK_DIMENSIONS.join(", ")}, plus identity and number consistency across the deck: repeated constructions in any window of neighbouring pages, one styling and term and number format for one thing, the section flow, the executive summary against the body and the close. Read the montage and every spread (${(packet.spreads || []).join(", ") || "rendered/spread-*.png"}; montage ${packet.montage}), opening pages at full size where a sequence needs it.

${FINDING_RULES} Across sections, list every affected page in the deck. Leave \`pages\` empty: the section reviewers cover the pages.

${COMPLETENESS_RULES(DECK_DIMENSIONS)}

Codes:
${Object.entries(packet.codes || CODES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

${checkablePrompt()}

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
  const open = scope.open || scope.priorBlocking || [];
  return `You are verifying repairs to a consulting deck. This is pass ${scope.pass} of at most ${scope.maxPasses ?? MAX_PASSES}; it verifies the review bound to ${scope.verifies ?? scope.basedOn}. It is not a fresh review: the first pass read every page on every dimension, and its verdict stands for every page that has not changed.

Read ${guidance(["design", "taste-review"]).join(" and ")} for the standards. BRIEF: ${packet.brief || "(not supplied)"}
GOVERNING ANSWER: ${packet.answer || "(not supplied)"}

OPEN FINDINGS (give every one a status):
${open.filter((f) => !String(f.id).startsWith("density:")).map((f) => `- ${f.id ?? "?"} · ${f.code} · ${f.severity} · ${(f.pages || f.slides || [f.slide]).filter(Boolean).join(", ") || "deck"}: ${f.reason}${f.repair ? ` → ${f.repair}` : ""}`).join("\n") || "- none"}

PAGES TO READ at full size (${scope.changed?.length ?? 0} changed since that pass or beside a deleted page, the rest named by an open major or blocker):
${pages.map((s) => `${pageLine(s)}${changed.has(s.id) ? " [changed]" : ""}`).join("\n") || "- none"}
Montage, for the sequence: ${packet.montage}

TITLES ALONE, to check the repaired pages still fit the argument:
${(packet.titles || []).join("\n")}

${rubricPrompt()}

Do three things.
1. STATUSES. For every open finding, one entry in \`statuses\`: fixed, partly fixed, not fixed or regressed, with the evidence you saw on the page. A partly fixed finding may carry a lower residual \`severity\` and, for a deck finding, the \`slides\` where it still stands. Do not re-file an open finding as new.
2. PAGES. Read every listed page on every page dimension and record it in \`pages\` exactly as the first pass did (verdict and a note per dimension). A page's verdict is the worst open finding naming it, counting the open findings above.
3. NEW FINDINGS, only if additive. A new finding must be major or blocker, and its \`basis\` must be one of:
${Object.entries(NEW_BASES).map(([k, v]) => `   - ${k}: ${v}`).join("\n")}
   Validation refuses a new minor finding, a new finding on a page that did not change unless it is a blocker with a justification of why the first pass could not see it, and a repeat of an open finding. Give new findings ids no earlier pass used, and a \`justification\` ("" is fine for basis changed). The deck is not re-reviewed: stop when these three are done, or the loop never converges.

${FINDING_RULES}

${checkablePrompt()}

${densityPrompt(packet.density, scope.mustInspect)}

Set pass to ${scope.pass} and verifies to "${scope.verifies ?? scope.basedOn}". Bind this review to ${packet.binding}. The earlier rating was ${scope.priorRating ?? "not recorded"}; rate the repaired deck out of ten on what you now see.

Return ONLY JSON matching this schema: ${JSON.stringify(packet.schema)}
Set accepted=false while any major or blocker finding, earlier or new, is open. The summary is two sentences: which repairs held and what, if anything, must still change.`;
}

/** What the reviewer is told about `checkable`: the review judges what code cannot. */
export function checkablePrompt() {
  return `CHECKABLE FINDINGS. The review is for judgement; a defect a machine could have measured is a check the skill is missing. On every finding set ${CHECKABLE}. Write rule as the constraint a check would enforce ("a chart callout never overlaps a data label") and measure as what it would compute and against what threshold ("intersection area of each callout box with each value-label box in the scene; any overlap fails"). Fill it whether or not a deterministic gate already reported the defect: a gate that fired and was ignored, or fired too late to act on, is still a check that did not stop the page. Leave it null when the call is judgement - whether the argument holds, what deserves emphasis, whether the page earns its place.`;
}


/** The density pass: the profile's comparison and flags, put to the reviewer as questions. */
export function densityPrompt(profile, only = null) {
  if (!profile) return "DENSITY PASS. No density profile was built (the deck was not rendered); set density to {\"deck\": \"No rendered density profile was available for this build.\", \"pages\": []}.";
  const deck = profile.deck || {};
  const line = (name, label) => deck[name] ? `- ${label}: ${deck[name].measured} against the target ${deck[name].target} (band ${JSON.stringify(deck[name].band ?? null)}), ${deck[name].position}` : null;
  const flagged = (profile.pages || []).filter((p) => p.flags?.length && (!only || only.includes(p.id)));
  return `DENSITY PASS. The rendered pages were measured by the skill's density rules (pdftotext -layout; title and source lines excluded; a block is a run of lines between blank ones; blocks under three words are labels). Compare the deck with the skill's targets, then open every flagged page and judge whether its density is right for the job it does. A flag is a question, not a verdict: a chart-led page may rightly sit light, and a page that clears its word floor with padding or restatement is too dense or the wrong shape even though it passed. Deck against the targets for pages doing this job (block measures over the ${deck.comparedPages ?? "?"} pages that carry commentary or prose, the population the targets describe; ${deck.exhibitLed?.pages ?? 0} exhibit-led pages sit beside them at ${deck.exhibitLed?.wordsPerBlock ?? "-"} words a block, which are labels):
${[line("bodyWordsVsTaskMedian", "body words against each page's task median (1.0 = target median)"), line("blocksPerPage", "text blocks per page"), line("wordsPerBlock", "words per block"), line("longestBlock", "longest block per page"), deck.singleBlockShare ? `- single-block pages: ${deck.singleBlockShare.measured} of pages against at most ${deck.singleBlockShare.target}` : null].filter(Boolean).join("\n")}
Flagged pages:
${flagged.map((p) => `- ${p.id} (page ${p.page}, ${p.task ?? "no task"}): ${p.flags.join("; ")}`).join("\n") || "- none"}
Record density.deck as two or three sentences comparing the deck's medians with the skill's targets and saying what that means for a reader, and density.pages as one verdict per flagged page (right, too thin, too dense or wrong shape) with the reason you saw on the page. Any verdict other than right blocks delivery.`;
}

/** A reviewer's JSON answer, from whatever the backend printed around it. */
function parseAnswer(raw) {
  const match = String(raw).match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

async function callBackend(which, { prompt, schemaPath, images, outPath, model, timeoutMs }) {
  if (which === "codex") {
    const args = ["exec", ...(model ? ["--model", model] : []), "--sandbox", "read-only", "--ephemeral", "--output-schema", schemaPath, "--output-last-message", outPath, ...images.flatMap((image) => ["--image", image]), "-"];
    await runProcess("codex", args, { input: prompt, timeoutMs });
    return parseAnswer(await fs.readFile(outPath, "utf8"));
  }
  if (which === "claude") {
    const res = await runProcess("claude", ["-p", "--output-format", "json", "--allowedTools", "Read", ...(model ? ["--model", model] : [])], { input: prompt, timeoutMs });
    const envelope = JSON.parse(res.stdout);
    return parseAnswer(typeof envelope.result === "string" ? envelope.result : JSON.stringify(envelope.result ?? envelope));
  }
  throw new Error(`Unknown reviewer backend: ${which}`);
}

/** Merge the saved parts of a split first pass into <out>/review.json. */
export async function mergeReviewDirectory(outputDirectory, partsDirectory = null) {
  const dir = path.resolve(outputDirectory);
  const from = partsDirectory ? path.resolve(partsDirectory) : path.join(dir, "review-packet", "parts");
  const files = (await fs.readdir(from).catch(() => [])).filter((f) => f.endsWith(".json")).sort();
  const parts = await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(from, f), "utf8"))));
  const slideIds = JSON.parse(await fs.readFile(path.join(dir, "scene.json"), "utf8")).slides.map((s) => s.id);
  const packet = await fs.readFile(path.join(dir, "review-packet", "packet.json"), "utf8").then(JSON.parse).catch(() => null);
  const { review, errors } = mergeReviewParts(parts, slideIds, packet?.sections ?? null);
  if (errors.length) return { status: "invalid", errors, parts: files };
  const reviewPath = path.join(dir, "review.json");
  await fs.writeFile(reviewPath, JSON.stringify(review, null, 2) + "\n");
  return { status: "merged", reviewPath, parts: files, findings: review.findings.length };
}

export async function runReview({ outputDirectory, spec, brief, answer, backend = "auto", model, timeoutMs = 600000, scope = null }) {
  const { packetDir, packet } = await buildReviewPacket({ outputDirectory, spec, brief, answer, scope });
  const which = detectBackend(backend);
  const reviewPath = path.join(path.resolve(outputDirectory), "review.json");
  if (which === "packet") {
    const note = packet.sections
      ? `Give each prompt in ${path.join(packetDir, "sections")} to its own fresh reviewer in parallel, save each answer as ${path.join(packetDir, "parts", "<id>.json")}, run node runtime/reviewer.mjs merge ${path.resolve(outputDirectory)}, then rerun deliver-deck with --review ${reviewPath}`
      : `Review the packet at ${packetDir} (prompt.md + images) and write ${reviewPath}, then rerun deliver-deck with --review ${reviewPath}`;
    return { backend: "packet", status: "packet-written", packetDir, reviewPath, sections: packet.sections?.length ?? 0, note };
  }
  const read = (s) => !scope || scope.mustInspect.includes(s.id);
  let review;
  if (packet.sections) {
    // Every section and the spine at once: the reviewers are independent, and a
    // fifty-page first pass is only exhaustive when no reader has fifty pages.
    const jobs = [...packet.sections.map((section) => ({ id: section.id, prompt: sectionPrompt(packet, section), images: packet.slides.filter((s) => section.slides.includes(s.id)).map((s) => s.image) })),
      { id: "spine", prompt: spinePrompt(packet), images: [packet.montage, ...packet.spreads] }];
    const partsDir = path.join(packetDir, "parts");
    const parts = await Promise.all(jobs.map(async (job) => {
      const part = await callBackend(which, { prompt: job.prompt, schemaPath: path.join(packetDir, "part-schema.json"), images: job.images, outPath: path.join(partsDir, `${job.id}.last-message.json`), model, timeoutMs });
      await fs.writeFile(path.join(partsDir, `${job.id}.json`), JSON.stringify(part, null, 2) + "\n");
      return part;
    }));
    const merged = mergeReviewParts(parts, packet.slides.map((s) => s.id), packet.sections);
    if (merged.errors.length) throw new Error(`The section reviews could not be merged:\n- ${merged.errors.join("\n- ")}`);
    review = merged.review;
  } else {
    review = await callBackend(which, { prompt: await fs.readFile(path.join(packetDir, "prompt.md"), "utf8"), schemaPath: path.join(packetDir, "schema.json"),
      images: [...packet.slides.filter(read).map((s) => s.image), packet.montage], outPath: path.join(packetDir, "codex-last-message.json"), model, timeoutMs });
  }
  review.backend = which; review.model = model || null;
  await fs.writeFile(reviewPath, JSON.stringify(review, null, 2) + "\n");
  return { backend: which, status: "reviewed", reviewPath, review };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, out, partsDirectory] = process.argv.slice(2);
  if (command !== "merge" || !out) { console.error("Usage: reviewer.mjs merge output-directory [parts-directory]"); process.exit(1); }
  const result = await mergeReviewDirectory(out, partsDirectory);
  console.log(JSON.stringify(result));
  process.exit(result.status === "merged" ? 0 : 2);
}
