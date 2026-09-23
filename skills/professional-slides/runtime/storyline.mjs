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
  const cats = ex.categories || ex.rows || ex.labels || [];
  const series = Array.isArray(ex.series) ? ex.series.map((s) => s?.name).filter(Boolean) : [];
  const form = type.startsWith("chart.") ? (trivialChart(ex) ? "TWO-NUMBER" : trendChart(ex) ? "trend" : cats.length >= 5 ? "ranked set" : "comparison") : null;
  const parts = [type];
  if (form) parts.push(`[${form}]`);
  if (ex.heading) parts.push(`"${ex.heading}"`);
  if (Array.isArray(cats) && cats.length) parts.push(`${cats.length} categories: ${cats.slice(0, 12).map((c) => typeof c === "object" ? (c.label ?? c.text ?? JSON.stringify(c)) : c).join(", ")}${cats.length > 12 ? ", ..." : ""}`);
  if (series.length) parts.push(`series: ${series.join(", ")}`);
  if (type === "table") {
    const cells = (ex.rows || []).flatMap((r) => Array.isArray(r) ? r : r?.cells || []);
    const text = (c) => String(c && typeof c === "object" ? (c.text ?? c.value ?? c.label ?? "") : c ?? "");
    const numeric = cells.filter((c) => /\d/.test(text(c)) || (c && typeof c === "object" && Number.isFinite(c.value))).length;
    const treated = (ex.columns || []).filter((c) => c && typeof c === "object" && c.type && !["text", "number", "category"].includes(c.type)).map((c) => c.type);
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
    exhibits: exhibitsOf(s).map((ex) => ({ type: ex.type, categories: ex.categories ?? ex.rows ?? null, series: (ex.series || []).map((x) => x?.name ?? null) }))
  }));
}

export function storylineBinding(spec) {
  return createHash("sha256").update(JSON.stringify(storyStructure(spec))).digest("hex");
}

export async function buildStorylinePacket(specPath, outputDirectory) {
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const base = path.dirname(specPath), stem = path.basename(specPath).replace(/\.deck\.json$/, "");
  const content = await fs.readFile(path.join(base, `${stem}.content.json`), "utf8").then(JSON.parse).catch(() => null);
  const byId = new Map((content?.pages || []).map((p) => [p.id, p]));
  const sources = await fs.readdir(path.join(base, "sources")).catch(() => []);
  const pages = [...(spec.slides || []), ...(spec.appendix || [])].map((s, i) => {
    const planned = byId.get(s.id) || {};
    const body = (planned.textPlan || []).filter((b) => ["body", "qualification"].includes(b.role)).map((b) => b.text);
    return { n: i + 1, id: s.id ?? null, kind: s.kind ?? "content", title: s.title ?? s.text ?? "", claim: planned.claim ?? null,
      settles: planned.settles ?? null, exhibits: exhibitsOf(s).map(describeExhibit), commentary: body.slice(0, 6), source: s.source ?? null };
  });
  const packet = { binding: storylineBinding(spec), brief: spec.brief ?? content?.question ?? "", answer: spec.answer ?? content?.answer ?? "",
    players: spec.players ?? [], sources, pages };
  const dir = path.join(outputDirectory, "storyline-review");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "packet.json"), JSON.stringify(packet, null, 2));
  await fs.writeFile(path.join(dir, "schema.json"), JSON.stringify(STORYLINE_SCHEMA, null, 2));
  await fs.writeFile(path.join(dir, "prompt.md"), storylinePrompt(packet));
  return { dir, packet };
}

export function storylinePrompt(packet) {
  const spine = packet.pages.map((p) => p.kind === "content" || !p.kind
    ? `${p.n}. [${p.id}] ${p.title}\n     shows: ${p.exhibits.join(" + ") || "text only"}${p.commentary.length ? `\n     says: ${p.commentary.join(" / ").slice(0, 400)}` : ""}`
    : `${p.n}. -- ${p.kind}: ${p.title}`).join("\n");
  return `You are a senior partner reviewing a team's storyline before a single slide is drawn - the problem-solving session where a weak story gets taken apart. You did not write it and you owe it nothing. Be adversarial and specific: your job is to find where the argument is thin, obvious, unproven or badly built, and to say exactly what would make it strong.

THE QUESTION: ${packet.brief || "(not stated)"}
THE TEAM'S ANSWER: ${packet.answer || "(not stated)"}
PLAYERS DECLARED: ${JSON.stringify(packet.players)}
DATA THEY FOUND (files under sources/): ${packet.sources.length ? packet.sources.join(", ") : "none"}

THE STORYLINE (title, what each page shows, what it says):
${spine}

Work through it in this order.

1. The answer. Is it an answer to the question, or a restatement of it? Is it sharp enough to be wrong? Would a sceptical client learn anything from it? Rewrite it the way it should read.
2. The pillars. Read the section titles and page titles alone. Do they form a MECE set of reasons that together prove the answer, in an order a reader follows? Name overlaps and gaps. For each pillar give your verdict and the strongest counter-argument a sceptic would raise, and whether the storyline answers it.
3. Insight depth, page by page. The bar is a deck that feels important: every page carries evidence a reader could not have assembled in five minutes, and the charts and tables are dense with real data. Flag every page that reports a count, a fact or a comparison of two numbers without an implication; every chart marked TWO-NUMBER or comparing two or three categories where the whole set exists; every table marked PLAIN GRID, or whose cells are mostly words where the comparison is quantitative, or that has too few rows and columns to be worth a page; every page whose title a reader would shrug at; every claim the listed evidence does not prove. For each, say what the page should show instead - the trend over five or more years with its growth rate, the whole peer set ranked on the same basis, the share and how it moved, the ratio that removes size, the benchmark gap, the network on a map, the scorecard that judges every player on every criterion with the numbers in the cells.
4. Missing analyses. What would a strong team have run that is not here? Name each analysis, why it matters to the answer, and the public data that would support it (annual reports, regulators, industry bodies, schedules, order books).
5. Cut or merge. Which pages repeat each other, preview what follows, or exist to reach a page count?
6. Verdict. "ready" only if the answer is sharp, the pillars hold, the evidence on the decisive pages is genuinely analytical (trends, ranked peer sets, shares, ratios, maps, judging tables - not two-number comparisons), and no missing analysis would change the answer. Otherwise "revise". Rate the storyline out of ten against what a top team would bring to this question. Rank the fixes that matter most.

Bind the review to ${packet.binding}. Return ONLY JSON matching this schema: ${JSON.stringify(STORYLINE_SCHEMA)}`;
}

export function validateStorylineReview(review, spec) {
  const errors = [];
  if (!review || typeof review !== "object") return ["storyline-review.json is missing: run the storyline critique (references/storylining.md#stress-test-the-storyline)"];
  if (!STORYLINE_VERDICTS.includes(review.verdict)) errors.push("storyline review verdict must be ready or revise");
  if (review.binding !== storylineBinding(spec)) errors.push("storyline review is for a different storyline: the titles, pages or exhibits changed since it was written; run the critique again");
  if (review.verdict !== "ready") errors.push(`the storyline critique says revise (${review.rating ?? "?"}/10): ${(review.topFixes || []).slice(0, 3).join("; ")}`);
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
