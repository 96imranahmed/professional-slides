#!/usr/bin/env node
/**
 * Score a cold run.
 *
 *   node evals/cold-run/score.mjs <plan.json> [build-directory] [--json]
 *
 * A cold run is the skill used the way a stranger uses it: a brief, no context,
 * no corrections. Every defect found in this repository over two days of review
 * was found by a person opening a PDF and looking at it, which is a loop that
 * runs once per person per afternoon. This is the same loop as a command.
 *
 * It scores two artefacts and refuses to average them:
 *
 *   the PLAN   - the dot-dash, through the plan gates. What the deck was going
 *                to be before anything was drawn.
 *   the BUILD  - a built output directory, through the design statistics read
 *                off the scene. What it turned out to be.
 *
 * The two disagree more often than you would think: the Marvel plan recorded
 * nine architectures and 0.888 entropy, and the deck it produced carried 2.9
 * distinct exhibits per ten pages, no table treatment and no chart annotation.
 * A plan can only be judged on what it records, so the build is the check on
 * the plan and the plan is the check on the brief.
 *
 * Beside them it records what the run cost, where the author's log is there
 * to count: `<id>.author-log.jsonl` beside the plan (or beside the build
 * directory) holds every author-deck run, and the compile runs, the refused
 * ones, the refusals per code and per page and the longest streak on one page
 * are read from it (runtime/run-log.mjs). The cost is reported, never scored:
 * a deck is not accepted for being cheap, and a run with no log has no cost.
 *
 * Exit 0 when the run clears every bar, 2 when it does not, 1 on a crash.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { runPlanGates } from "../../skills/professional-slides/runtime/gates/plan_gates.mjs";
import { BUILD_BARS, BUILD_CEILINGS, scoreBuild } from "../../skills/professional-slides/runtime/build-bars.mjs";
import { isMain } from "../../skills/professional-slides/runtime/cli.mjs";
import { readRunLog, runCost } from "../../skills/professional-slides/runtime/run-log.mjs";

// The bars a built deck has to clear live with delivery, which refuses a deck
// that misses one (runtime/build-bars.mjs); the harness scores a cold run by
// the same bars rather than a copy of them.
export { BUILD_BARS, BUILD_CEILINGS, scoreBuild };

export function scoreRun({ plan = null, scene = null, purpose = null, runs = null }) {
  const planReport = plan ? runPlanGates(plan) : null;
  const buildReport = scene ? scoreBuild(scene, { purpose }) : null;
  return {
    schema: "professional-slides.cold-run/v1",
    plan: planReport && {
      accepted: planReport.accepted,
      countsByCode: planReport.countsByCode,
      statistics: planReport.statistics,
      findings: planReport.findings.map((f) => ({ code: f.code, page: f.page, measured: f.measured })),
    },
    build: buildReport && { ...buildReport, ...(purpose ? { purpose } : {}) },
    // What authoring cost, counted from the author's log; absent when the run kept none.
    ...(runs && runs.length ? { cost: runCost(runs) } : {}),
    // Deliberately not one number. A plan that passes and a build that does not
    // is a different problem from the reverse, and averaging them hides which.
    accepted: (planReport?.accepted ?? true) && (buildReport?.accepted ?? true),
  };
}

const readSpec = (file) => existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;

/**
 * The deck's `purpose`, which the bars read - a catalogue is held to the
 * ceilings only (build-bars.mjs scoreBuild). Neither a plan nor a scene is
 * guaranteed to carry it, so it is read from the first that does: the plan,
 * the deck spec beside the plan (`<id>.plan.json` -> `<id>.deck.json`), the
 * scene, then the deck spec beside the build directory (`<dir>/out` ->
 * `<dir>/<id>.deck.json`). Null when none says.
 */
export function purposeOf({ planPath = null, plan = null, scene = null, buildPath = null } = {}) {
  if (plan?.purpose) return plan.purpose;
  const beside = planPath && /\.plan\.json$/.test(planPath) ? readSpec(planPath.replace(/\.plan\.json$/, ".deck.json")) : null;
  if (beside?.purpose) return beside.purpose;
  if (scene?.purpose) return scene.purpose;
  const id = scene?.id ?? plan?.id;
  const built = buildPath && id ? readSpec(path.join(path.dirname(path.resolve(buildPath)), `${id}.deck.json`)) : null;
  return built?.purpose ?? null;
}

/**
 * The author's run log of the deck scored, or null: `<id>.author-log.jsonl`
 * beside the plan, else beside the build directory (`<dir>/out` ->
 * `<dir>/<id>.author-log.jsonl`), where author-deck.mjs writes it.
 */
export function authorLogOf({ planPath = null, plan = null, scene = null, buildPath = null } = {}) {
  const beside = planPath && /\.plan\.json$/.test(planPath) ? planPath.replace(/\.plan\.json$/, ".author-log.jsonl") : null;
  if (beside && existsSync(beside)) return beside;
  const id = scene?.id ?? plan?.id;
  const built = buildPath && id ? path.join(path.dirname(path.resolve(buildPath)), `${id}.author-log.jsonl`) : null;
  return built && existsSync(built) ? built : null;
}

function readScene(directory) {
  const file = path.join(directory, "scene.json");
  if (!existsSync(file)) throw new Error(`No scene.json in ${directory}; build the deck first`);
  return JSON.parse(readFileSync(file, "utf8"));
}

function line(label, value, floor, reference, applied = true) {
  const ok = value === null || value === undefined || value >= floor;
  const shown = value === null || value === undefined ? "n/a" : String(value);
  return `  ${!applied ? "  - " : ok ? "pass" : "FAIL"}  ${label.padEnd(22)} ${shown.padStart(7)}   floor ${String(floor).padStart(5)}   reference ${reference}`;
}

export function report(result) {
  const out = [];
  if (result.plan) {
    const s = result.plan.statistics;
    out.push("PLAN");
    out.push(`  ${result.plan.accepted ? "pass" : "FAIL"}  ${Object.keys(result.plan.countsByCode).length} codes: ${Object.entries(result.plan.countsByCode).map(([c, n]) => `${c}${n > 1 ? `x${n}` : ""}`).join(", ") || "none"}`);
    out.push(`        mix chart ${s.mix.chart} table ${s.mix.table} diagram ${s.mix.diagram} picture ${s.mix.picture}`);
    out.push(`        entropy ${s.styleEntropy ?? "not recorded"} over ${s.architectures ?? "?"} architectures, ${s.exhibitVarietyPerTen} exhibits per ten pages`);
  }
  if (result.build) {
    const s = result.build.statistics;
    // A catalogue's floors are measured and printed, not applied.
    const floors = result.build.purpose !== "catalogue";
    out.push(floors ? "BUILD" : "BUILD (catalogue: held to the ceilings only)");
    for (const [key, bar] of Object.entries(BUILD_BARS)) out.push(line(key, s[key], bar.min, bar.reference, floors));
    for (const [key, bar] of Object.entries(BUILD_CEILINGS)) out.push(`  ${s[key] <= bar.max ? "pass" : "FAIL"}  ${key.padEnd(22)} ${String(s[key]).padStart(7)}   ceiling ${String(bar.max).padStart(3)}`);
    out.push(`        ${s.contentPages} content pages, ${s.distinctExhibits} distinct exhibits, ${s.tables} tables, ${s.charts} charts`);
  }
  if (result.cost) {
    const c = result.cost, streak = c.longestStreak;
    out.push("COST (from the author's log; reported, not scored)");
    out.push(`        ${c.runs} compile runs, ${c.refused} refused${c.pages ? `, ${c.runsPerPage} runs a page over ${c.pages} pages` : ""}: ${Object.entries(c.modes).map(([mode, m]) => `${mode} ${m.runs} (${m.refused} refused)`).join(", ")}`);
    out.push(`        refusals by code: ${Object.entries(c.refusalsByCode).slice(0, 6).map(([code, n]) => `${code} ${n.findings} in ${n.runs} run${n.runs === 1 ? "" : "s"}`).join(", ") || "none"}`);
    if (streak) out.push(`        longest streak on one page: ${streak.page}, refused in ${streak.runs} runs in a row (${streak.codes.join(", ")})`);
  }
  out.push(result.accepted ? "ACCEPTED" : "NOT ACCEPTED");
  return out.join("\n");
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  const asJson = process.argv.includes("--json");
  if (!args.length) { console.error("Usage: score.mjs <plan.json> [build-directory] [--json]"); process.exit(1); }
  try {
    // `-` in the plan slot scores a build alone; a build directory alone works
    // too. Either half is a real answer, and neither stands in for the other.
    const planPath = args[0] === "-" ? null : args[0];
    const buildPath = args[1] ?? (planPath && !planPath.endsWith(".json") ? planPath : null);
    const plan = planPath && planPath.endsWith(".json") ? JSON.parse(readFileSync(planPath, "utf8")) : null;
    const scene = buildPath ? readScene(buildPath) : null;
    if (!plan && !scene) throw new Error("Nothing to score: pass a plan.json, a build directory, or both");
    const log = authorLogOf({ planPath, plan, scene, buildPath });
    const result = scoreRun({ plan, scene, purpose: purposeOf({ planPath, plan, scene, buildPath }), runs: log ? readRunLog(log) : null });
    console.log(asJson ? JSON.stringify(result, null, 2) : report(result));
    process.exit(result.accepted ? 0 : 2);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
