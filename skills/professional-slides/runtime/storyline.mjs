#!/usr/bin/env node
// The storyline critique: an adversarial, senior reading of the dot-dash before
// anything is drawn.
//
//   node runtime/storyline.mjs <id>.deck.json out/                  records a returned critique, then writes the next
//                                                                   packet (out/storyline-review/) or says the spine is ready
//   node runtime/storyline.mjs <id>.deck.json out/ --run [codex|claude]   also runs a fresh reviewer for the packet
//   node runtime/storyline.mjs merge <id>.deck.json out/            joins parallel section critiques into out/storyline-review.json
//
// A deck can pass every gate and still argue nothing: a governing answer that
// restates the question, pillars that overlap, pages that report counts nobody
// asked about, the analysis a sharp team would have run left out. The review
// of the rendered deck finds this late, after fifty pages are drawn. This is
// the mock problem-solving session instead: an independent reader who did not
// write the story reads the title spine, each page's evidence and the insights
// behind it, attacks the argument the way a senior partner would, and says
// whether it is ready.
//
// The first pass is exhaustive: a verdict for every page of the spine on every
// page check, and the spine-level sections (the spine read alone, the answer,
// the pillars with their countercases, cross-page numbers, section flow, the
// summary against the body, missing analyses, cuts), with a completeness
// self-check. Later passes verify (review-passes.mjs): a status for every
// open item, new items only where serious and additive, at most three passes.
// The deck review waits for this gate: `storylineGate` is ready only for the
// spine the critique read.
//
// The review is bound to the story's structure - page ids, titles, exhibit
// types and the data each exhibit plots - so rewording a sentence does not
// invalidate it, and changing what a page argues or shows does.
import { SHAPES, breadthOf, breadthProblem, plottedValues } from "./page-types.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { trivialChart, trendChart } from "./gates/craft_gates.mjs";
import { runProcess } from "./process.mjs";
import {
  SEVERITIES, PAGE_VERDICTS, STATUSES, NEW_BASES, MAX_PASSES, SEVERITY_DEFINITIONS, BLOCKING, verdictOf,
  pageListErrors, advanceLedger, openEntries, openBlocking, expectedVerdicts, verificationErrors, coverageErrors,
  verdictErrors, completenessErrors, changedPages, capMessage, uniqueIds, detectBackend,
} from "./review-passes.mjs";

export const STORYLINE_VERDICTS = Object.freeze(["ready", "revise"]);
export const STORYLINE_CODES = Object.freeze({
  STORYLINE_UNREVIEWED: "delivery has no current ready storyline critique for this dot-dash",
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
  answer: { scope: "spine", checks: "the governing answer answers the question, is sharp enough to be wrong, and is what the pages add up to" },
  pillars: { scope: "spine", checks: "the pillars are a MECE set of reasons that together prove the answer; each has its strongest counter-argument and the condition that would reverse it, answered by the storyline" },
  numbers: { scope: "spine", checks: "a figure is the same number, unit, base and period on every page that states it, and totals reconcile across pages" },
  flow: { scope: "spine", checks: "sections open, develop and close in an order a reader follows; no section previews another or ends without its point" },
  summary: { scope: "spine", checks: "the executive summary states the answer and the pillars the body proves, with the body's numbers, and the close agrees with it" },
  missing: { scope: "spine", checks: "the analyses a strong team would have run are here, or named with why they matter and the public data behind them" },
  cuts: { scope: "spine", checks: "pages that repeat, preview or pad are cut or merged, and the freed pages carry a missing analysis" },
});
export const STORYLINE_DIMENSIONS = Object.freeze(Object.keys(STORYLINE_CHECKS));
export const STORYLINE_PAGE_CHECKS = Object.freeze(STORYLINE_DIMENSIONS.filter((d) => STORYLINE_CHECKS[d].scope === "page"));
export const SOURCING_STATUSES = Object.freeze(["supported", "partly", "unsupported", "n/a"]);

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
const NEW_ITEM = { type: "object", additionalProperties: false, required: [...Object.keys(ITEM_PROPERTIES), "basis", "justification"],
  properties: { ...ITEM_PROPERTIES, basis: { type: "string", enum: Object.keys(NEW_BASES) }, justification: { type: "string" } } };
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
const MISSING = { type: "object", additionalProperties: false, required: ["id", "analysis", "why", "data", "severity"],
  properties: { id: ITEM_PROPERTIES.id, analysis: STR(10), why: STR(10), data: STR(10), severity: ITEM_PROPERTIES.severity } };
const CUT = { type: "object", additionalProperties: false, required: ["id", "pages", "action", "freedUse", "severity"],
  properties: { id: ITEM_PROPERTIES.id, pages: ITEM_PROPERTIES.pages, action: { type: "string", enum: ["cut", "merge"] }, freedUse: STR(10), severity: ITEM_PROPERTIES.severity } };
const STATUS = { type: "object", additionalProperties: false, required: ["finding", "status", "evidence"],
  properties: { finding: { type: "string" }, status: { type: "string", enum: STATUSES }, evidence: STR(20), severity: { type: "string", enum: SEVERITIES }, pages: { type: "array", items: { type: "string" } } } };
const COMPLETENESS = { type: "array", items: { type: "object", additionalProperties: false, required: ["check", "result", "note"],
  properties: { check: { type: "string", enum: STORYLINE_DIMENSIONS }, result: { type: "string", enum: ["findings", "clean"] }, note: { type: "string" } } } };
const COMMON = { verdict: { type: "string", enum: STORYLINE_VERDICTS }, rating: { type: "number", minimum: 0, maximum: 10 }, binding: HASH, summary: STR(40) };

/** Pass one: every page of the spine, every spine-level section, and what found nothing. */
export const STORYLINE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["pass", "verifies", "verdict", "rating", "binding", "summary", "spine", "answer", "pillars", "pages", "numbers", "sectionFlow", "execSummary", "missingAnalyses", "cutOrMerge", "findings", "topFixes", "completeness"],
  properties: {
    pass: { type: "integer", enum: [1] }, verifies: { type: "null" }, ...COMMON,
    spine: STR(60), answer: STR(40),
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

/** Pass two and after: a status for every open item, new items only if serious and additive. */
export const STORYLINE_VERIFICATION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["pass", "verifies", "verdict", "rating", "binding", "summary", "pages", "statuses", "findings", "topFixes"],
  properties: {
    pass: { type: "integer", minimum: 2 }, verifies: HASH, ...COMMON,
    pages: { type: "array", items: PAGE_ENTRY },
    statuses: { type: "array", items: STATUS },
    findings: { type: "array", items: NEW_ITEM },
    topFixes: { type: "array", items: { type: "string" } },
  }
};

/** One reviewer's share of a long spine's first pass: a section of pages, or the spine sections. */
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

/** The story's structure: what the critique is bound to. */
export function storyStructure(spec) {
  const pages = [...(spec.slides || []), ...(spec.appendix || [])];
  return pages.map((s, i) => ({
    id: s.id ?? `p${i + 1}`, kind: s.kind ?? "content", title: String(s.title ?? s.text ?? ""),
    exhibits: exhibitsOf(s).map(exhibitEvidence)
  }));
}

// What an exhibit asserts, as opposed to how it is drawn: its categories or
// rows, every plotted value, and the data of the non-chart exhibits (markers,
// items, nodes). A trend that reverses or a ranking that reorders after the
// critique changes the story, so it changes the binding; a new colour or a
// moved label does not.
const EVIDENCE_KEYS = ["categories", "rows", "columns", "values", "markers", "routes", "items", "nodes", "edges", "links", "points", "steps", "phases", "tasks"];
function exhibitEvidence(ex) {
  const out = { type: ex.type ?? null, series: (ex.series || []).map((x) => ({ name: x?.name ?? null, values: x?.values ?? null })) };
  for (const key of EVIDENCE_KEYS) if (ex[key] !== undefined) out[key] = ex[key];
  // A chart group's evidence is its charts' data, not their headings.
  if (Array.isArray(ex.charts)) out.charts = ex.charts.map((c) => exhibitEvidence({ type: c?.component, ...(c?.props || {}) }));
  return out;
}

export function storylineBinding(spec) {
  return createHash("sha256").update(JSON.stringify(storyStructure(spec))).digest("hex");
}

/** One hash per page of the story's structure: what a verification pass compares. */
export function storylinePageHashes(spec) {
  return Object.fromEntries(storyStructure(spec).map((p) => [p.id, createHash("sha256").update(JSON.stringify(p)).digest("hex")]));
}

const isContent = (p) => !p.kind || p.kind === "content";

/**
 * The pages the critique reads, with what each rests on: its claim, what
 * settles it, its exhibits, its commentary, and the insights it names with
 * their calculation and sources, so sourcing is judged page by page rather
 * than found by accident.
 */
async function storyPages(spec, base, stem) {
  const content = await fs.readFile(path.join(base, `${stem}.content.json`), "utf8").then(JSON.parse).catch(() => null);
  const byId = new Map((content?.pages || []).map((p) => [p.id, p]));
  const log = await fs.readFile(path.join(base, `${stem}.insights.json`), "utf8").then(JSON.parse).catch(() => null);
  const insights = new Map((log?.insights || []).map((i) => [i.id, i]));
  let section = null;
  const pages = [...(spec.slides || []), ...(spec.appendix || [])].map((s, i) => {
    if (s.kind === "section") section = String(s.title ?? s.text ?? "");
    const planned = byId.get(s.id) || {};
    const body = (planned.textPlan || []).filter((b) => ["body", "qualification"].includes(b.role)).map((b) => b.text);
    const evidence = planned.evidence ?? s.pageType?.content?.evidence ?? [];
    return { n: i + 1, id: s.id ?? `p${i + 1}`, kind: s.kind ?? "content", section, title: s.title ?? s.text ?? "", claim: planned.claim ?? s.pageType?.content?.claim ?? null,
      settles: planned.settles ?? s.pageType?.content?.settles ?? null, exhibits: exhibitsOf(s).map(describeExhibit), commentary: body.slice(0, 6), source: s.source ?? null,
      evidence: evidence.map((id) => { const item = insights.get(id); return item ? { id, finding: item.finding, calculation: item.calculation ?? null, sources: item.sources ?? [], strength: item.strength ?? null } : { id, missing: true }; }),
      ...(s.pageType ? { page: `${s.pageType.type}/${s.pageType.form}, explanation ${s.pageType.commentary}${s.pageType.takeaway ? ", closes on a line" : ""}` } : {}) };
  });
  return { pages, content, log };
}

/** Sections of a long spine for parallel critics: one per section divider, short ones folded together. */
export const STORYLINE_SECTION_THRESHOLD = 30;
export function storySections(pages, { max = 16, min = 5 } = {}) {
  const groups = [];
  for (const p of pages) {
    if (!groups.length || p.kind === "section") groups.push({ title: p.kind === "section" ? p.title : "Opening", pages: [] });
    if (isContent(p)) groups.at(-1).pages.push(p.id);
  }
  const folded = [];
  for (const g of groups.filter((x) => x.pages.length)) {
    const last = folded.at(-1);
    if (last && (g.pages.length < min || last.pages.length < min) && last.pages.length + g.pages.length <= max) { last.pages.push(...g.pages); last.title = `${last.title}; ${g.title}`; }
    else folded.push({ ...g, pages: [...g.pages] });
  }
  return folded.map((g, i) => ({ id: `s${i + 1}`, ...g }));
}

const HISTORY = "storyline-history";
const PACKET = "storyline-review";

export async function readStorylineHistory(outputDirectory) {
  const dir = path.join(outputDirectory, HISTORY);
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => /^pass-\d+\.json$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  return Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), "utf8"))));
}

/** What the next storyline pass reads and verifies, or null for a first pass. */
export function storylineScope(prior, currentHashes, contentIds, { maxPasses = MAX_PASSES } = {}) {
  if (!prior?.pageHashes || !prior.review) return null;
  const moved = changedPages(prior.pageHashes, currentHashes);
  if (!moved) return null;
  const ledger = prior.ledger ?? storylineLedger([], prior.review);
  const named = new Set(openBlocking(ledger).flatMap((e) => e.pages || []));
  const changed = [...new Set([...moved.changed, ...moved.neighbours])];
  const pass = (prior.pass ?? 1) + 1;
  return { pass, verifies: prior.binding, maxPasses, capped: pass > maxPasses, changed, deleted: moved.deleted,
    mustInspect: contentIds.filter((id) => changed.includes(id) || named.has(id)), open: openEntries(ledger), ledger, priorRating: prior.review.rating };
}

export async function buildStorylinePacket(specPath, outputDirectory, { scope = null } = {}) {
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const base = path.dirname(specPath), stem = path.basename(specPath).replace(/\.deck\.json$/, "");
  const { pages, content, log } = await storyPages(spec, base, stem);
  // Sources sit in workstream folders (sources/<workstream>/...), so list them all.
  const sources = await fs.readdir(path.join(base, "sources"), { recursive: true }).then((all) => all.filter((f) => /\.[a-z0-9]+$/i.test(f))).catch(() => []);
  const insights = checkInsights(log, sources);
  const contentPages = pages.filter(isContent).length;
  const targetPages = Number.isFinite(spec.targetPages) ? spec.targetPages : spec.purpose === "evaluation" ? 50 : null;
  const sections = !scope && contentPages > STORYLINE_SECTION_THRESHOLD ? storySections(pages) : null;
  const packet = { binding: storylineBinding(spec), pageHashes: storylinePageHashes(spec), pass: scope ? scope.pass : 1, verifies: scope ? scope.verifies : null,
    maxPasses: scope?.maxPasses ?? MAX_PASSES, scope, sections, deck: path.resolve(specPath),
    brief: spec.brief ?? content?.question ?? "", answer: spec.answer ?? content?.answer ?? "",
    players: spec.players ?? [], sources, insights, targetPages, totalPages: pages.length, contentPages, pages };
  const dir = path.join(outputDirectory, PACKET);
  await fs.rm(path.join(dir, "sections"), { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const schema = scope ? STORYLINE_VERIFICATION_SCHEMA : STORYLINE_SCHEMA;
  await fs.writeFile(path.join(dir, "packet.json"), JSON.stringify(packet, null, 2));
  await fs.writeFile(path.join(dir, "schema.json"), JSON.stringify(schema, null, 2));
  await fs.writeFile(path.join(dir, "prompt.md"), scope ? storylineVerificationPrompt(packet) : storylinePrompt(packet));
  if (sections) {
    await fs.mkdir(path.join(dir, "sections"), { recursive: true });
    await fs.mkdir(path.join(dir, "parts"), { recursive: true });
    await fs.writeFile(path.join(dir, "part-schema.json"), JSON.stringify(STORYLINE_PART_SCHEMA, null, 2));
    for (const section of sections) await fs.writeFile(path.join(dir, "sections", `${section.id}.md`), storylineSectionPrompt(packet, section));
    await fs.writeFile(path.join(dir, "sections", "spine.md"), storylineSpinePrompt(packet));
  }
  return { dir, packet };
}

/**
 * The insight log, checked for what makes a finding a finding: a statement,
 * the calculation that produced it, and a source file that exists. Problems
 * are reported to the critic, who weighs them; they are not a gate here.
 */
export function checkInsights(log, sources = []) {
  if (!log) return { present: false, items: [], problems: ["no insight log: the titles were written without recorded findings"] };
  const items = Array.isArray(log.insights) ? log.insights : [];
  const have = new Set(sources.map((f) => `sources/${f}`));
  const problems = [];
  for (const item of items) {
    if (!item?.finding || !item?.calculation) problems.push(`${item?.id ?? "?"}: a finding needs its statement and the calculation behind it`);
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
  return { present: true, items: items.map((i) => ({ id: i.id, finding: i.finding, shape: i.shape ?? null, breadth: breadthOf(i), strength: i.strength ?? null, calculation: i.calculation ?? null, sources: i.sources ?? [] })), problems };
}

const spineLine = (p) => isContent(p)
  ? `${p.n}. [${p.id}] ${p.title}${p.page ? `\n     page: ${p.page}` : ""}\n     shows: ${p.exhibits.join(" + ") || "text only"}${p.commentary.length ? `\n     says: ${p.commentary.join(" / ").slice(0, 400)}` : ""}${p.evidence?.length ? `\n     rests on: ${p.evidence.map((e) => e.missing ? `${e.id} (NOT IN THE LOG)` : `${e.id} "${e.finding}" (calc: ${e.calculation ?? "none"}; sources: ${e.sources.join(", ") || "none"})`).join("; ")}` : "\n     rests on: no insight named"}`
  : `${p.n}. -- ${p.kind}: ${p.title}`;

function checksPrompt() {
  return `THE CHECKS. The page checks are made on every content page; the spine checks on the storyline as a whole.
${STORYLINE_DIMENSIONS.map((d) => `- ${d} (${STORYLINE_CHECKS[d].scope}): ${STORYLINE_CHECKS[d].checks}`).join("\n")}

SEVERITY:
${["blocker", "major", "minor", "none"].map((s) => `- ${s}: ${s === "blocker" ? "the answer does not follow, a decisive claim is unsupported or contradicted, or a number conflicts across pages" : s === "major" ? "a page or pillar a partner would send back: an obvious or unsourced claim, the wrong evidence shape, a restated page, a missing countercase, a missing analysis that would change the answer" : SEVERITY_DEFINITIONS[s]}`).join("\n")}`;
}

const ITEM_RULES = `ITEMS. Every problem is an item with an id (F1, F2, ...; M1... for missing analyses; C1... for cuts), a severity and, for findings, the check it belongs to, the problem and the fix. A page finding names its one page; a spine finding lists EVERY page it concerns (for the answer, the summary and closing pages) - never a sample, never "e.g.", "such as" or "etc.". Validation refuses a sampled page list and a finding whose text names a page its list leaves out.`;

const PAGE_RULES = `PAGE VERDICTS. \`pages\` holds one entry for every content page: its verdict (ok, minor, major, blocker - the worst open item naming the page), a note for claim, shape, restatement and consequence, and \`sourcing\` { status: supported | partly | unsupported | n/a, insights: the ids it rests on, note }. An unsupported page carries a major or blocker sourcing finding; a partly supported one a sourcing finding at any severity.`;

export function storylinePrompt(packet) {
  const split = packet.sections?.length ? `
THIS STORYLINE IS LONG (${packet.contentPages} content pages), so critique it in parallel where the harness can spawn subagents: give each prompt in storyline-review/sections/ (${packet.sections.map((s) => `${s.id}.md: ${s.pages.length} pages`).join("; ")}; spine.md for the spine checks) to its own fresh critic at the same time, save each JSON answer as storyline-review/parts/<id>.json, then run \`node runtime/storyline.mjs merge <deck> <out>\`. Without subagents, work through this prompt alone.
` : "";
  return `You are a senior partner reviewing a team's storyline before a single slide is drawn - the problem-solving session where a weak story gets taken apart. You did not write it and you owe it nothing. Be adversarial and specific. Judge from this packet alone: do not search the web or open other files.

This is pass 1 of at most ${packet.maxPasses ?? MAX_PASSES}, and it is exhaustive: every content page gets a verdict on every page check, and every spine check gets an answer. Later passes only verify your items and may add only a serious new problem on a page the team changed, so what you leave out now is not raised again.
${split}
THE QUESTION: ${packet.brief || "(not stated)"}
THE TEAM'S ANSWER: ${packet.answer || "(not stated)"}
PLAYERS DECLARED: ${JSON.stringify(packet.players)}
DATA THEY FOUND (files under sources/): ${packet.sources.length ? packet.sources.join(", ") : "none"}

REQUESTED LENGTH: ${packet.targetPages ? `${packet.targetPages}+ pages (the storyline has ${packet.totalPages}, ${packet.contentPages} of them content pages)` : `not fixed (the storyline has ${packet.totalPages} pages)`}
INSIGHT LOG (what the team extracted from the data before writing titles):
${packet.insights?.present ? packet.insights.items.map((i) => `- [${i.id}] (${i.strength ?? "ungraded"}) ${i.finding} — calc: ${i.calculation ?? "none"}; sources: ${i.sources.join(", ") || "none"}`).join("\n") || "- empty" : "- none recorded"}${packet.insights?.problems?.length ? `\nINSIGHT LOG PROBLEMS: ${packet.insights.problems.join("; ")}` : ""}

THE STORYLINE (title, what each page shows, what it says, the insights it rests on):
${packet.pages.map(spineLine).join("\n")}

${checksPrompt()}

Work through it in this order.

1. The spine alone. Read the titles without the pages: does it tell the story? Write \`spine\`.
2. The answer. Is it an answer to the question, or a restatement of it? Sharp enough to be wrong? Rewrite it the way it should read in \`answer\`.
3. The pillars. Do they form a MECE set of reasons that together prove the answer? For each pillar in \`pillars\`: its pages, your verdict (holds, weak, fails), the overlaps and gaps, the strongest counter-argument, the condition that would reverse it, and whether the storyline answers it.
4. Every page, in order. The bar is a deck that feels important: every page carries evidence a reader could not have assembled in five minutes. Check the claim, the evidence shape (TWO-NUMBER charts, PLAIN GRID tables, two or three categories where the whole set exists), its sourcing against the insight log (the insight ids, their calculations, their sources), whether it restates the page before, and whether it states a consequence. Where pages carry a "page:" line, judge whether the page type is the claim's reading task. Say what each weak page should show instead.
5. Numbers across pages: the same figure with the same unit, base and period everywhere, totals that reconcile (\`numbers\`).
6. Section flow (\`sectionFlow\`) and the executive summary against the body and the close (\`execSummary\`).
7. Missing analyses: what a strong team would have run, why it matters to the answer, and the public data behind it.
8. Cut or merge: pages that repeat, preview or exist to reach a count, and what the freed pages should carry. A long deck is legitimate when the brief asks for one: never recommend a total below the requested length.
9. Completeness: one entry per check in \`completeness\` - "findings" when you filed any under it, "clean" with what you checked when you did not.
10. Verdict. "ready" only if no major or blocker item is open: the answer is sharp, the pillars hold, the decisive pages are analytical and sourced, and no missing analysis would change the answer. Otherwise "revise". Rate the storyline out of ten against what a top team would bring. Rank the top fixes.

${PAGE_RULES}

${ITEM_RULES}

Set pass to 1 and verifies to null. Bind the review to ${packet.binding}. Return ONLY JSON matching this schema: ${JSON.stringify(STORYLINE_SCHEMA)}`;
}

export function storylineSectionPrompt(packet, section) {
  const pages = packet.pages.filter((p) => section.pages.includes(p.id));
  return `You are one of several senior critics reading a long storyline in parallel, before anything is drawn. Yours is section ${section.id}, "${section.title}": pages ${section.pages.join(", ")}. A spine critic takes the answer, pillars, numbers across pages, section flow, summary, missing analyses and cuts. Be adversarial and specific; judge from this packet alone.

THE QUESTION: ${packet.brief || "(not stated)"}
THE TEAM'S ANSWER: ${packet.answer || "(not stated)"}
THE WHOLE TITLE SPINE, for context:
${packet.pages.map((p) => `${p.n}. [${p.id}] ${p.title}`).join("\n")}

YOUR PAGES:
${pages.map(spineLine).join("\n")}

${checksPrompt()}

Check every page check on every one of your pages; this is the exhaustive first pass.

${PAGE_RULES}

${ITEM_RULES} Name only pages in your section; leave the spine sections as short notes ("see the spine critic").

\`completeness\` covers the page checks (${STORYLINE_PAGE_CHECKS.join(", ")}). Set part to ${JSON.stringify({ kind: "section", id: section.id, pages: section.pages })}. Bind to ${packet.binding}.
Return ONLY JSON matching this schema: ${JSON.stringify(STORYLINE_PART_SCHEMA)}`;
}

export function storylineSpinePrompt(packet) {
  const spineChecks = STORYLINE_DIMENSIONS.filter((d) => STORYLINE_CHECKS[d].scope === "spine");
  return `${storylinePrompt({ ...packet, sections: null }).split("Work through it in this order.")[0]}You are the spine critic of a long storyline read in parallel: section critics give every page its verdict. You write the spine sections - \`spine\`, \`answer\`, \`pillars\`, \`numbers\`, \`sectionFlow\`, \`execSummary\`, \`missingAnalyses\`, \`cutOrMerge\`, \`topFixes\` - and file spine findings listing every page they concern. Leave \`pages\` empty. \`completeness\` covers ${spineChecks.join(", ")}. Your verdict, rating and summary become the critique's.

${ITEM_RULES}

Set part to ${JSON.stringify({ kind: "spine", id: "spine", pages: packet.pages.filter(isContent).map((p) => p.id) })}. Bind to ${packet.binding}.
Return ONLY JSON matching this schema: ${JSON.stringify(STORYLINE_PART_SCHEMA)}`;
}

export function storylineVerificationPrompt(packet) {
  const { scope } = packet;
  const read = packet.pages.filter((p) => scope.mustInspect.includes(p.id));
  const changed = new Set(scope.changed);
  return `You are verifying a team's revisions to a storyline an earlier critique sent back. This is pass ${scope.pass} of at most ${scope.maxPasses}; it verifies the critique bound to ${scope.verifies}. It is not a fresh critique: the first pass read every page, and its verdict stands for every page that has not changed. Judge from this packet alone.

THE QUESTION: ${packet.brief || "(not stated)"}
THE TEAM'S ANSWER: ${packet.answer || "(not stated)"}

OPEN ITEMS (give every one a status):
${scope.open.map((e) => `- ${e.id} · ${e.dimension} · ${e.severity} · ${(e.pages || []).join(", ") || "spine"}: ${e.reason}${e.repair ? ` → ${e.repair}` : ""}`).join("\n") || "- none"}

THE TITLE SPINE NOW:
${packet.pages.map((p) => `${p.n}. [${p.id}] ${p.title}${changed.has(p.id) ? "  [changed]" : ""}`).join("\n")}

PAGES TO READ (changed since that pass, or named by an open major or blocker):
${read.map(spineLine).join("\n") || "- none"}

${checksPrompt()}

Do three things.
1. STATUSES: for every open item, fixed, partly fixed, not fixed or regressed, with the evidence in the packet; a partly fixed item may carry a lower residual \`severity\`.
2. PAGES: a full page entry for every page listed above, as the first pass wrote them.
3. NEW ITEMS, only if additive: major or blocker, with \`basis\` ${Object.entries(NEW_BASES).map(([k, v]) => `${k} (${v})`).join("; ")}. A new minor item, an item on an unchanged page unless it is a blocker the first pass could not see (justify why), and a repeat of an open item are refused. New ids must be new. Then stop: the storyline is not re-critiqued.

${PAGE_RULES}

${ITEM_RULES}

"ready" only when no major or blocker item, earlier or new, is open. Set pass to ${scope.pass} and verifies to "${scope.verifies}". Bind to ${packet.binding}. The earlier rating was ${scope.priorRating ?? "not recorded"}.
Return ONLY JSON matching this schema: ${JSON.stringify(STORYLINE_VERIFICATION_SCHEMA)}`;
}

/** The subset of JSON Schema the review schemas use, checked field by field. Extra fields are allowed. */
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
    for (const [key, sub] of Object.entries(schema.properties || {})) if (value[key] !== undefined) errors.push(...schemaErrors(value[key], sub, `${at}.${key}`));
  }
  return errors;
}

/** Every item of a critique in ledger form: its findings, missing analyses and cuts. */
export function storylineItems(review) {
  const items = [];
  for (const f of review?.findings || []) items.push({ id: f.id, code: `STORY_${String(f.check ?? "").toUpperCase()}`, dimension: f.check, scope: f.scope, severity: f.severity,
    pages: f.pages || [], reason: f.problem, repair: f.fix, ...(f.basis ? { basis: f.basis, justification: f.justification } : {}) });
  for (const m of review?.missingAnalyses || []) items.push({ id: m.id, code: "MISSING_ANALYSIS", dimension: "missing", scope: "spine", severity: m.severity, pages: [],
    reason: `${m.analysis}: ${m.why}`, repair: `Run it on ${m.data}` });
  for (const c of review?.cutOrMerge || []) items.push({ id: c.id, code: c.action === "cut" ? "CUT_PAGE" : "MERGE_PAGES", dimension: "cuts", scope: "spine", severity: c.severity,
    pages: c.pages || [], reason: `${c.action} ${(c.pages || []).join(", ")}`, repair: c.freedUse });
  return items;
}

export const storylineLedger = (prior, review) => advanceLedger(prior, review, storylineItems(review));

function itemErrors(review, ids, own = null) {
  const errors = [];
  const seen = new Set();
  const lists = [["findings", review.findings || []], ["missingAnalyses", review.missingAnalyses || []], ["cutOrMerge", review.cutOrMerge || []]];
  for (const [name, list] of lists) for (const [i, item] of list.entries()) {
    const at = `${name}[${i}]${item?.id ? ` (${item.id})` : ""}`;
    if (seen.has(item.id)) errors.push(`${at}: id ${item.id} is used twice`);
    seen.add(item.id);
    if (name === "findings") errors.push(...pageListErrors(at, { scope: item.scope, pages: item.pages, text: `${item.problem ?? ""} ${item.fix ?? ""}`, ids, deckScope: "spine" }));
    if (name === "cutOrMerge") errors.push(...pageListErrors(at, { scope: "spine", pages: item.pages, text: item.freedUse, ids, deckScope: "spine" }));
    if (own && name !== "missingAnalyses") {
      const outside = (item.pages || []).filter((id) => !own.includes(id));
      if (outside.length) errors.push(`${at}: names ${outside.join(", ")}, outside this section`);
    }
  }
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
 * Validate a critique against the spine it read: `ids` every page of that
 * spine, `contentIds` the pages the first pass must cover, `scope` and
 * `ledger` for a later pass.
 */
export function validateStorylineRecord(review, { ids, contentIds, scope = null, ledger = [], insightIds = null }) {
  if (!review || typeof review !== "object") return ["storyline-review.json is missing: run the storyline critique (references/storylining.md#stress-test-the-storyline)"];
  // The whole record, not just the verdict: a truncated or hand-written
  // `{ verdict: "ready", binding }` is not a critique.
  const structure = schemaErrors(review, scope ? STORYLINE_VERIFICATION_SCHEMA : STORYLINE_SCHEMA, "storyline review");
  if (structure.length) return structure;
  const errors = itemErrors(review, ids);
  const items = storylineItems(review);
  if (scope) errors.push(...verificationErrors(review, { scope, ledger, items, ids, pageKey: "page", deckScope: "spine" }));
  else {
    errors.push(...coverageErrors(review.pages, contentIds, "page"));
    errors.push(...completenessErrors(review.completeness, STORYLINE_DIMENSIONS, items, "check"));
    for (const [i, pillar] of review.pillars.entries()) {
      const unknown = pillar.pages.filter((id) => !ids.includes(id));
      if (unknown.length) errors.push(`pillars[${i}]: unknown page${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`);
    }
  }
  const after = storylineLedger(scope ? ledger : [], review);
  errors.push(...verdictErrors(review.pages, after, "page"), ...sourcingErrors(review.pages, after, insightIds));
  const open = openBlocking(after);
  if (review.verdict === "ready" && open.length) errors.push(`verdict is ready while ${open.map((e) => `${e.id} (${e.severity})`).join(", ")} ${open.length === 1 ? "is" : "are"} open; ready means no major or blocker item remains`);
  return errors;
}

/** Validate a critique against a spec: its structure, its binding, and that it says ready. */
export function validateStorylineReview(review, spec, { scope = null, ledger = [], insightIds = null } = {}) {
  const structure = storyStructure(spec);
  const errors = validateStorylineRecord(review, { ids: structure.map((p) => p.id), contentIds: structure.filter(isContent).map((p) => p.id), scope, ledger, insightIds });
  if (!review || typeof review !== "object") return errors;
  if (review.binding !== storylineBinding(spec)) errors.push("storyline review is for a different storyline: the titles, pages or exhibits changed since it was written; re-run the storyline critique first");
  if (review.verdict !== "ready") errors.push(`the storyline critique says revise (${review.rating ?? "?"}/10): ${(review.topFixes || []).slice(0, 3).join("; ")}`);
  return errors;
}

const readJson = (file) => fs.readFile(file, "utf8").then(JSON.parse).catch(() => null);
const packetContext = (packet) => ({
  ids: packet.pages.map((p) => p.id), contentIds: packet.pages.filter(isContent).map((p) => p.id), scope: packet.scope ?? null, ledger: packet.scope?.ledger ?? [],
  insightIds: packet.insights?.present ? new Set(packet.insights.items.map((i) => i.id)) : null,
});

/**
 * The storyline gate the deck review waits for: a critique that validates
 * against the packet it answered, says ready with no major or blocker item
 * open across its passes, and is bound to the spine as it stands now. A spine
 * edited after the critique names its changed pages and sends the author back
 * to the critique before any deck review is prepared or accepted.
 */
export async function storylineGate(spec, directory) {
  if (spec?.purpose === "catalogue") return [];
  const review = await readJson(path.join(directory, "storyline-review.json"));
  if (!review) return ["storyline-review.json is missing: run the storyline critique (node runtime/storyline.mjs <id>.deck.json out/) and bring it to ready before the deck review"];
  const history = await readStorylineHistory(directory);
  const packet = await readJson(path.join(directory, PACKET, "packet.json"));
  const record = history.find((h) => h.binding === review.binding && h.pass === review.pass);
  const answered = packet && packet.binding === review.binding && packet.pass === review.pass ? packet : null;
  const structure = storyStructure(spec);
  const errors = record ? [] : answered ? validateStorylineRecord(review, packetContext(answered))
    : validateStorylineRecord(review, { ids: structure.map((p) => p.id), contentIds: structure.filter(isContent).map((p) => p.id) });
  if (review.binding !== storylineBinding(spec)) {
    const was = record?.pageHashes ?? answered?.pageHashes;
    const moved = was ? changedPages(was, storylinePageHashes(spec)) : null;
    const which = moved ? [...moved.changed, ...moved.deleted.map((id) => `${id} deleted`)] : [];
    errors.push(`the title spine changed after the storyline critique${which.length ? ` (${which.join(", ")})` : ""}: re-run the storyline critique first - node runtime/storyline.mjs <id>.deck.json out/ writes the verification pass for the changed pages - and bring it back to ready before the deck review`);
  }
  if (review.verdict !== "ready") errors.push(`the storyline critique says revise (${review.rating ?? "?"}/10): revise the storyline, re-run the critique and bring it to ready before the deck review${(review.topFixes || []).length ? ` - ${review.topFixes.slice(0, 3).join("; ")}` : ""}`);
  else if (!errors.length) {
    const open = openBlocking(record?.ledger ?? storylineLedger(answered?.scope?.ledger ?? [], review));
    if (open.length) errors.push(`the storyline critique says ready but ${open.map((e) => `${e.id} (${e.severity})`).join(", ")} ${open.length === 1 ? "is" : "are"} still open`);
  }
  return errors;
}

/**
 * One step of the storyline loop. Records a returned critique (validated
 * against the packet it answered) in storyline-history/, then says where the
 * loop stands: ready for this spine; revise (the spine has not changed since
 * the critique); capped; or a new packet - the first pass, or a verification
 * of the pages changed since the last one.
 */
export async function prepareStoryline(specPath, outputDirectory, { maxPasses = MAX_PASSES } = {}) {
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const out = path.resolve(outputDirectory);
  const history = await readStorylineHistory(out);
  const review = await readJson(path.join(out, "storyline-review.json"));
  const packet = await readJson(path.join(out, PACKET, "packet.json"));
  if (review && !history.some((h) => h.binding === review.binding && h.pass === review.pass)) {
    if (!packet || packet.binding !== review.binding || packet.pass !== review.pass)
      return { status: "invalid", errors: [`storyline-review.json does not answer the packet in ${path.join(out, PACKET)} (binding or pass differs): give its prompt.md to a fresh critic and save the answer`] };
    const errors = validateStorylineRecord(review, packetContext(packet));
    if (errors.length) return { status: "invalid", errors };
    const record = { review, binding: review.binding, pass: review.pass, verifies: review.verifies ?? null, pageHashes: packet.pageHashes,
      ledger: storylineLedger(packet.scope?.ledger ?? [], review), recordedAt: new Date().toISOString() };
    await fs.mkdir(path.join(out, HISTORY), { recursive: true });
    await fs.writeFile(path.join(out, HISTORY, `pass-${history.length + 1}.json`), JSON.stringify(record, null, 2) + "\n");
    history.push(record);
  }
  const binding = storylineBinding(spec);
  const latest = history.at(-1);
  const brief = (e) => `${e.id} ${e.dimension} (${e.severity}) on ${(e.pages || []).join(", ") || "the spine"}`;
  if (latest && latest.binding === binding) {
    const open = openBlocking(latest.ledger);
    if (latest.review.verdict === "ready" && !open.length) return { status: "ready", pass: latest.pass, binding };
    return { status: "revise", pass: latest.pass, open: open.map(brief), note: "Revise the storyline at the root for the open items, then run this again: it writes the verification pass for the pages you changed" };
  }
  const contentIds = storyStructure(spec).filter(isContent).map((p) => p.id);
  const scope = latest ? storylineScope(latest, storylinePageHashes(spec), contentIds, { maxPasses }) : null;
  if (scope?.capped) return { status: "capped", pass: scope.pass, message: capMessage("storyline critique", scope.pass, maxPasses, latest.ledger) };
  const { dir, packet: next } = await buildStorylinePacket(specPath, out, { scope });
  return { status: "packet-written", pass: next.pass, dir, binding: next.binding, sections: next.sections?.length ?? 0,
    note: next.sections ? `Give each prompt in ${path.join(dir, "sections")} to its own fresh critic in parallel, save each answer as ${path.join(dir, "parts", "<id>.json")}, then run storyline.mjs merge` : `Give ${path.join(dir, "prompt.md")} to a fresh critic and save its JSON as ${path.join(out, "storyline-review.json")}, then run this again` };
}

function partErrors(part, packet) {
  const meta = part?.part;
  if (!meta || !["section", "spine"].includes(meta.kind)) return ["part must say { kind: section|spine, id, pages }"];
  const structure = schemaErrors(part, { ...STORYLINE_PART_SCHEMA, required: ["part", "binding", "verdict", "rating", "summary", "pages", "findings", "completeness",
    ...(meta.kind === "spine" ? ["spine", "answer", "pillars", "numbers", "sectionFlow", "execSummary", "missingAnalyses", "cutOrMerge", "topFixes"] : [])] }, meta.id);
  if (structure.length) return structure;
  const { ids, insightIds } = packetContext(packet);
  const errors = itemErrors(part, ids, meta.kind === "section" ? meta.pages : null);
  const items = storylineItems(part);
  if (meta.kind === "section") {
    errors.push(...coverageErrors(part.pages, meta.pages, "page"), ...completenessErrors(part.completeness, STORYLINE_PAGE_CHECKS, items, "check"));
    const ledger = storylineLedger([], part);
    errors.push(...verdictErrors(part.pages, ledger, "page"), ...sourcingErrors(part.pages, ledger, insightIds));
  } else errors.push(...completenessErrors(part.completeness, STORYLINE_DIMENSIONS.filter((d) => STORYLINE_CHECKS[d].scope === "spine"), items.filter((f) => STORYLINE_CHECKS[f.dimension]?.scope === "spine"), "check"));
  return errors;
}

/** Join a long spine's parallel critiques into one first pass, as reviewer.mjs does for the deck. */
export function mergeStorylineParts(parts, packet) {
  const errors = parts.flatMap((part) => partErrors(part, packet).map((e) => `${part?.part?.id ?? "part"}: ${e}`));
  const spine = parts.filter((p) => p?.part?.kind === "spine");
  const sections = parts.filter((p) => p?.part?.kind === "section");
  if (spine.length !== 1) errors.push(`a split critique needs exactly one spine part; got ${spine.length}`);
  if (parts.some((p) => p?.binding !== packet.binding)) errors.push("a part is bound to a different spine than the packet");
  const { contentIds } = packetContext(packet);
  const covered = sections.flatMap((p) => p.part?.pages || []);
  const uncovered = contentIds.filter((id) => !covered.includes(id));
  if (uncovered.length) errors.push(`no section part covers ${uncovered.join(", ")}`);
  if (errors.length) return { errors };
  const rename = uniqueIds(parts, (p) => [...(p.findings || []), ...(p.missingAnalyses || []), ...(p.cutOrMerge || [])]);
  const relabel = (part, list) => (list || []).map((item) => ({ ...item, id: rename(part, item.id) }));
  const [lead] = spine;
  const merged = {
    pass: 1, verifies: null, binding: packet.binding, rating: lead.rating, summary: lead.summary,
    spine: lead.spine, answer: lead.answer, pillars: lead.pillars, numbers: lead.numbers, sectionFlow: lead.sectionFlow, execSummary: lead.execSummary,
    missingAnalyses: relabel(lead, lead.missingAnalyses), cutOrMerge: relabel(lead, lead.cutOrMerge),
    findings: parts.flatMap((p) => relabel(p, p.findings)), topFixes: lead.topFixes, mergedFrom: parts.map((p) => p.part.id),
  };
  const order = new Map(contentIds.map((id, i) => [id, i]));
  const expected = expectedVerdicts(storylineLedger([], merged));
  merged.pages = sections.flatMap((p) => p.pages).sort((a, b) => order.get(a.page) - order.get(b.page)).map((p) => ({ ...p, verdict: verdictOf(expected.get(p.page) ?? "none") }));
  merged.completeness = STORYLINE_DIMENSIONS.map((check) => ({ check,
    result: storylineItems(merged).some((f) => f.dimension === check) ? "findings" : "clean",
    note: parts.flatMap((p) => (p.completeness || []).filter((c) => c.check === check).map((c) => `${p.part.id}: ${c.note}`)).join(" | ") }));
  merged.verdict = lead.verdict === "ready" && !openBlocking(storylineLedger([], merged)).length ? "ready" : "revise";
  return { review: merged, errors: [] };
}

async function callCritic(which, prompt, schemaPath, lastPath, timeoutMs) {
  let raw;
  if (which === "codex") {
    await runProcess("codex", ["exec", "--sandbox", "read-only", "--ephemeral", "--output-schema", schemaPath, "--output-last-message", lastPath, "-"], { input: prompt, timeoutMs });
    raw = await fs.readFile(lastPath, "utf8");
  } else if (which === "claude") {
    const res = await runProcess("claude", ["-p", "--output-format", "json"], { input: prompt, timeoutMs });
    const envelope = JSON.parse(res.stdout);
    raw = typeof envelope.result === "string" ? envelope.result : JSON.stringify(envelope.result ?? envelope);
  } else throw new Error(`Unknown storyline reviewer: ${which}`);
  const match = String(raw).match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

/** Merge saved parts into out/storyline-review.json and record it. */
export async function mergeStorylineDirectory(specPath, outputDirectory) {
  const out = path.resolve(outputDirectory);
  const packet = await readJson(path.join(out, PACKET, "packet.json"));
  if (!packet) return { status: "invalid", errors: ["no storyline packet to merge against: run storyline.mjs first"] };
  const from = path.join(out, PACKET, "parts");
  const files = (await fs.readdir(from).catch(() => [])).filter((f) => f.endsWith(".json") && !f.includes("last-message")).sort();
  const parts = await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(from, f), "utf8"))));
  const { review, errors } = mergeStorylineParts(parts, packet);
  if (errors.length) return { status: "invalid", errors, parts: files };
  await fs.writeFile(path.join(out, "storyline-review.json"), JSON.stringify(review, null, 2) + "\n");
  return prepareStoryline(specPath, out);
}

/** Run the critique through fresh CLI sessions: readers with none of the author's context. */
export async function runStorylineReview(specPath, outputDirectory, backend = "auto", { timeoutMs = 600000, maxPasses = MAX_PASSES } = {}) {
  const step = await prepareStoryline(specPath, outputDirectory, { maxPasses });
  if (step.status !== "packet-written") return step;
  const which = detectBackend(backend);
  if (which === "packet") return step;
  const packet = await readJson(path.join(step.dir, "packet.json"));
  let review;
  if (packet.sections) {
    const jobs = [...packet.sections.map((s) => ({ id: s.id, prompt: storylineSectionPrompt(packet, s) })), { id: "spine", prompt: storylineSpinePrompt(packet) }];
    const parts = await Promise.all(jobs.map((job) => callCritic(which, job.prompt, path.join(step.dir, "part-schema.json"), path.join(step.dir, "parts", `${job.id}.last-message.json`), timeoutMs)));
    const merged = mergeStorylineParts(parts, packet);
    if (merged.errors.length) return { status: "invalid", errors: merged.errors };
    review = merged.review;
  } else review = await callCritic(which, await fs.readFile(path.join(step.dir, "prompt.md"), "utf8"), path.join(step.dir, "schema.json"), path.join(step.dir, "codex-last-message.json"), timeoutMs);
  await fs.writeFile(path.join(outputDirectory, "storyline-review.json"), JSON.stringify(review, null, 2) + "\n");
  const next = await prepareStoryline(specPath, outputDirectory, { maxPasses });
  return { ...next, verdict: review.verdict, rating: review.rating, topFixes: review.topFixes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const merging = args[0] === "merge";
  const [spec, out] = merging ? args.slice(1) : args;
  if (!spec || !out) { console.error("Usage: storyline.mjs [merge] <id>.deck.json output-directory [--run codex|claude] [--max-passes n]"); process.exit(1); }
  const cap = args.indexOf("--max-passes");
  const maxPasses = cap >= 0 ? Number(args[cap + 1]) : MAX_PASSES;
  const at = args.indexOf("--run");
  const result = merging ? await mergeStorylineDirectory(path.resolve(spec), path.resolve(out))
    : at >= 0 ? await runStorylineReview(path.resolve(spec), path.resolve(out), args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : "auto", { maxPasses })
    : await prepareStoryline(path.resolve(spec), path.resolve(out), { maxPasses });
  console.log(JSON.stringify(result));
  process.exit(result.status === "ready" ? 0 : result.status === "packet-written" ? 3 : 2);
}
