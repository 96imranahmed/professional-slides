#!/usr/bin/env node
// The storyline critique: an adversarial, senior reading of the dot-dash before
// anything is drawn.
//
//   node runtime/storyline.mjs <id>.deck.json out/                 writes out/storyline-review/{packet.json,prompt.md,schema.json}
//   node runtime/storyline.mjs <id>.deck.json out/ --run [codex|claude]   also runs a fresh reviewer and writes out/storyline-review.json
//
// A deck can pass every gate and still argue nothing: a governing answer that
// restates the question, pillars that overlap, pages that report counts nobody
// asked about, the analysis a sharp team would have run left out. The review
// of the rendered deck finds this late, after fifty pages are drawn. This is
// the mock problem-solving session instead: an independent reader who did not
// write the story reads the title spine, each page's evidence and the data
// behind it, attacks the argument the way a senior partner would, and says
// whether it is ready. The author revises and asks again until it is.
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
import { detectBackend } from "./reviewer.mjs";
import { runProcess } from "./process.mjs";

export const STORYLINE_VERDICTS = Object.freeze(["ready", "revise"]);
export const STORYLINE_CODES = Object.freeze({
  STORYLINE_UNREVIEWED: "delivery has no current ready storyline critique for this dot-dash",
});

export const STORYLINE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["verdict", "rating", "binding", "summary", "answer", "pillars", "weakPages", "missingAnalyses", "cutOrMerge", "topFixes"],
  properties: {
    verdict: { type: "string", enum: STORYLINE_VERDICTS },
    rating: { type: "number", minimum: 0, maximum: 10 },
    binding: { type: "string", pattern: "^[a-f0-9]{64}$" },
    summary: { type: "string", minLength: 40 },
    answer: { type: "string", minLength: 40 },
    pillars: { type: "array", items: { type: "object", additionalProperties: false, required: ["pillar", "verdict", "strongestCounter"],
      properties: { pillar: { type: "string" }, verdict: { type: "string" }, strongestCounter: { type: "string" } } } },
    weakPages: { type: "array", items: { type: "object", additionalProperties: false, required: ["page", "problem", "fix"],
      properties: { page: { type: "string" }, problem: { type: "string" }, fix: { type: "string" } } } },
    missingAnalyses: { type: "array", items: { type: "object", additionalProperties: false, required: ["analysis", "why", "data"],
      properties: { analysis: { type: "string" }, why: { type: "string" }, data: { type: "string" } } } },
    cutOrMerge: { type: "array", items: { type: "string" } },
    topFixes: { type: "array", items: { type: "string" }, minItems: 1 }
  }
};

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

export async function buildStorylinePacket(specPath, outputDirectory) {
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const base = path.dirname(specPath), stem = path.basename(specPath).replace(/\.deck\.json$/, "");
  const content = await fs.readFile(path.join(base, `${stem}.content.json`), "utf8").then(JSON.parse).catch(() => null);
  const byId = new Map((content?.pages || []).map((p) => [p.id, p]));
  // Sources sit in workstream folders (sources/<workstream>/...), so list them all.
  const sources = await fs.readdir(path.join(base, "sources"), { recursive: true }).then((all) => all.filter((f) => /\.[a-z0-9]+$/i.test(f))).catch(() => []);
  const insightLog = await fs.readFile(path.join(base, `${stem}.insights.json`), "utf8").then(JSON.parse).catch(() => null);
  const insights = checkInsights(insightLog, sources);
  const pages = [...(spec.slides || []), ...(spec.appendix || [])].map((s, i) => {
    const planned = byId.get(s.id) || {};
    const body = (planned.textPlan || []).filter((b) => ["body", "qualification"].includes(b.role)).map((b) => b.text);
    return { n: i + 1, id: s.id ?? null, kind: s.kind ?? "content", title: s.title ?? s.text ?? "", claim: planned.claim ?? null,
      settles: planned.settles ?? null, exhibits: exhibitsOf(s).map(describeExhibit), commentary: body.slice(0, 6), source: s.source ?? null,
      ...(s.pageType ? { page: `${s.pageType.type}/${s.pageType.form}, explanation ${s.pageType.commentary}${s.pageType.takeaway ? ", closes on a line" : ""}` } : {}) };
  });
  const contentPages = pages.filter((p) => p.kind === "content").length;
  const targetPages = Number.isFinite(spec.targetPages) ? spec.targetPages : spec.purpose === "evaluation" ? 50 : null;
  const packet = { binding: storylineBinding(spec), brief: spec.brief ?? content?.question ?? "", answer: spec.answer ?? content?.answer ?? "",
    players: spec.players ?? [], sources, insights, targetPages, totalPages: pages.length, contentPages, pages };
  const dir = path.join(outputDirectory, "storyline-review");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "packet.json"), JSON.stringify(packet, null, 2));
  await fs.writeFile(path.join(dir, "schema.json"), JSON.stringify(STORYLINE_SCHEMA, null, 2));
  await fs.writeFile(path.join(dir, "prompt.md"), storylinePrompt(packet));
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

export function storylinePrompt(packet) {
  const spine = packet.pages.map((p) => p.kind === "content" || !p.kind
    ? `${p.n}. [${p.id}] ${p.title}${p.page ? `\n     page: ${p.page}` : ""}\n     shows: ${p.exhibits.join(" + ") || "text only"}${p.commentary.length ? `\n     says: ${p.commentary.join(" / ").slice(0, 400)}` : ""}`
    : `${p.n}. -- ${p.kind}: ${p.title}`).join("\n");
  return `You are a senior partner reviewing a team's storyline before a single slide is drawn - the problem-solving session where a weak story gets taken apart. You did not write it and you owe it nothing. Be adversarial and specific: your job is to find where the argument is thin, obvious, unproven or badly built, and to say exactly what would make it strong. Judge from this packet alone: do not search the web or open other files. Keep it short: at most ten weak pages, five missing analyses and five top fixes.

THE QUESTION: ${packet.brief || "(not stated)"}
THE TEAM'S ANSWER: ${packet.answer || "(not stated)"}
PLAYERS DECLARED: ${JSON.stringify(packet.players)}
DATA THEY FOUND (files under sources/): ${packet.sources.length ? packet.sources.join(", ") : "none"}

REQUESTED LENGTH: ${packet.targetPages ? `${packet.targetPages}+ pages (the storyline has ${packet.totalPages}, ${packet.contentPages} of them content pages)` : `not fixed (the storyline has ${packet.totalPages} pages)`}
INSIGHT LOG (what the team extracted from the data before writing titles):
${packet.insights?.present ? packet.insights.items.map((i) => `- [${i.id}] (${i.strength ?? "ungraded"}) ${i.finding} — calc: ${i.calculation ?? "none"}; sources: ${i.sources.join(", ") || "none"}`).join("\n") || "- empty" : "- none recorded"}${packet.insights?.problems?.length ? `\nINSIGHT LOG PROBLEMS: ${packet.insights.problems.slice(0, 12).join("; ")}` : ""}

THE STORYLINE (title, what each page shows, what it says):
${spine}

Work through it in this order.

1. The answer. Is it an answer to the question, or a restatement of it? Is it sharp enough to be wrong? Would a sceptical client learn anything from it? Rewrite it the way it should read.
2. The pillars. Read the section titles and page titles alone. Do they form a MECE set of reasons that together prove the answer, in an order a reader follows? Name overlaps and gaps. For each pillar give your verdict and the strongest counter-argument a sceptic would raise, and whether the storyline answers it.
3. Insight depth, page by page. The bar is a deck that feels important: every page carries evidence a reader could not have assembled in five minutes, and the charts and tables are dense with real data. Flag every page that reports a count, a fact or a comparison of two numbers without an implication; every chart marked TWO-NUMBER or comparing two or three categories where the whole set exists; every table marked PLAIN GRID, or whose cells are mostly words where the comparison is quantitative, or that has too few rows and columns to be worth a page; every page whose title a reader would shrug at; every claim the listed evidence does not prove. For each, say what the page should show instead - the trend over five or more years with its growth rate, the whole peer set ranked on the same basis, the share and how it moved, the ratio that removes size, the benchmark gap, the network on a map, the scorecard that judges every player on every criterion with the numbers in the cells.
4. Missing analyses. What would a strong team have run that is not here? Name each analysis, why it matters to the answer, and the public data that would support it (annual reports, regulators, industry bodies, schedules, order books).
   Where pages carry a "page:" line - the page type the author chose, and where its explanation lives - judge whether that type is the claim's reading task (a ranking for where the whole set stands, a trend for a change with its rate, panels for one question across several cuts, a scorecard for judging members on criteria), and whether neighbouring pages ask the reader to do different things. Name any page whose type does not fit its claim and the type it should be.
5. Cut or merge. Which pages repeat each other, preview what follows, or exist to reach a page count? A long deck is legitimate when the brief asks for one: never recommend a total below the requested length. Where you merge duplicates, say which missing analysis should take the freed pages.
   Check the insight log against the pages: an insight with no page, a page whose title no insight supports, and a title that restates a fact rather than a finding.
6. Verdict. "ready" only if the answer is sharp, the pillars hold, the evidence on the decisive pages is genuinely analytical (trends, ranked peer sets, shares, ratios, maps, judging tables - not two-number comparisons), and no missing analysis would change the answer. Otherwise "revise". Rate the storyline out of ten against what a top team would bring to this question. Rank the fixes that matter most.

Bind the review to ${packet.binding}. Return ONLY JSON matching this schema: ${JSON.stringify(STORYLINE_SCHEMA)}`;
}

/** The subset of JSON Schema the review schema uses, checked field by field. Extra fields (authorResponse) are allowed. */
function schemaErrors(value, schema, at) {
  const errors = [];
  const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (schema.type && schema.type !== kind) return [`${at} must be ${schema.type === "object" ? "an object" : `a ${schema.type}`}`];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at} must be one of ${schema.enum.join(", ")}`);
  if (kind === "string") {
    if (schema.minLength && value.trim().length < schema.minLength) errors.push(`${at} must be at least ${schema.minLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at} is malformed`);
  }
  if (kind === "number" && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)))
    errors.push(`${at} must be between ${schema.minimum} and ${schema.maximum}`);
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

export function validateStorylineReview(review, spec) {
  const errors = [];
  if (!review || typeof review !== "object") return ["storyline-review.json is missing: run the storyline critique (references/storylining.md#stress-test-the-storyline)"];
  // The whole record, not just the verdict: a truncated or hand-written
  // `{ verdict: "ready", binding }` is not a critique.
  errors.push(...schemaErrors(review, STORYLINE_SCHEMA, "storyline review"));
  if (!STORYLINE_VERDICTS.includes(review.verdict) && !errors.length) errors.push("storyline review verdict must be ready or revise");
  if (review.binding !== storylineBinding(spec)) errors.push("storyline review is for a different storyline: the titles, pages or exhibits changed since it was written; run the critique again");
  // One critique and one revision is the default. A storyline the critic
  // called "revise" passes once the author has revised and answered each fix
  // in `authorResponse`; further rounds happen only when the user asks.
  const answered = typeof review.authorResponse === "string" && review.authorResponse.trim().length >= 40;
  if (review.verdict !== "ready" && !answered) errors.push(`the storyline critique says revise (${review.rating ?? "?"}/10): ${(review.topFixes || []).slice(0, 3).join("; ")}`);
  return errors;
}

/** Run the critique through a fresh CLI session: a reader with none of the author's context. */
export async function runStorylineReview(specPath, outputDirectory, backend = "auto", { timeoutMs = 600000 } = {}) {
  const { dir, packet } = await buildStorylinePacket(specPath, outputDirectory);
  const which = detectBackend(backend);
  if (which === "packet") return { status: "packet-written", dir, binding: packet.binding };
  const prompt = await fs.readFile(path.join(dir, "prompt.md"), "utf8");
  let raw;
  if (which === "codex") {
    const last = path.join(dir, "codex-last-message.json");
    await runProcess("codex", ["exec", "--sandbox", "read-only", "--ephemeral", "--output-schema", path.join(dir, "schema.json"), "--output-last-message", last, "-"], { input: prompt, timeoutMs });
    raw = await fs.readFile(last, "utf8");
  } else if (which === "claude") {
    const res = await runProcess("claude", ["-p", "--output-format", "json"], { input: prompt, timeoutMs });
    const envelope = JSON.parse(res.stdout);
    raw = typeof envelope.result === "string" ? envelope.result : JSON.stringify(envelope.result ?? envelope);
  } else throw new Error(`Unknown storyline reviewer: ${which}`);
  const match = String(raw).match(/\{[\s\S]*\}/);
  const review = JSON.parse(match ? match[0] : raw);
  await fs.writeFile(path.join(outputDirectory, "storyline-review.json"), JSON.stringify(review, null, 2) + "\n");
  return { status: "reviewed", verdict: review.verdict, rating: review.rating, topFixes: review.topFixes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const [spec, out] = args;
  if (!spec || !out) { console.error("Usage: storyline.mjs <id>.deck.json output-directory [--run codex|claude]"); process.exit(1); }
  const at = args.indexOf("--run");
  if (at >= 0) {
    const result = await runStorylineReview(path.resolve(spec), path.resolve(out), args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : "auto");
    console.log(JSON.stringify(result));
    process.exit(result.verdict === "ready" ? 0 : 2);
  }
  const { dir, packet } = await buildStorylinePacket(path.resolve(spec), path.resolve(out));
  console.log(JSON.stringify({ packet: dir, pages: packet.pages.length, binding: packet.binding, note: `Give ${path.join(dir, "prompt.md")} to an independent reviewer and save its JSON as ${path.join(out, "storyline-review.json")}` }));
}
