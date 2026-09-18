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
 * Exit 0 when the run clears every bar, 2 when it does not, 1 on a crash.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPlanGates } from "../../skills/professional-slides/runtime/gates/plan_gates.mjs";
import { designStatistics } from "../../skills/professional-slides/runtime/reviewer.mjs";

const CONTRACT = JSON.parse(readFileSync(new URL("../../skills/professional-slides/runtime/weight.json", import.meta.url), "utf8"));
const CRAFT = CONTRACT.plan.craft;

/**
 * The bars a built deck has to clear, as measured off its own scene.
 *
 * These are the same numbers the plan gates use, applied to what was actually
 * drawn rather than to what was promised. `drawings` is the corpus figure: a
 * reference analytical page carries about 29 primitives that are not type, and
 * a page of rules and paragraphs carries a fraction of that.
 */
export const BUILD_BARS = Object.freeze({
  exhibitVarietyPerTen: { min: CRAFT.exhibitVarietyPerTen.min, reference: CRAFT.exhibitVarietyPerTen.observed },
  tablesTreated: { min: CRAFT.tableTreated.min, reference: CRAFT.tableTreated.observed },
  chartsAnnotated: { min: CRAFT.chartAnnotated.min, reference: CRAFT.chartAnnotated.observed },
  drawingsPerPage: { min: 12, reference: CONTRACT.reference.slides.drawings },
});

/**
 * Bars that are a count of something that should not be there at all, rather
 * than a floor something has to reach. A cold run shipped two empty picture
 * frames and passed everything, because a frame counts as a picture everywhere
 * a picture is counted.
 */
export const BUILD_CEILINGS = Object.freeze({
  unsourcedPictures: { max: 0 },
});

export function scoreBuild(scene) {
  const statistics = designStatistics(scene);
  const findings = [];
  for (const [key, bar] of Object.entries(BUILD_BARS)) {
    const measured = statistics[key];
    // A deck with no tables cannot fail a bar about tables.
    if (measured === null || measured === undefined) continue;
    if (measured < bar.min) findings.push({ measure: key, measured, floor: bar.min, reference: bar.reference });
  }
  for (const [key, bar] of Object.entries(BUILD_CEILINGS)) {
    const measured = statistics[key];
    if (measured > bar.max) findings.push({ measure: key, measured, ceiling: bar.max });
  }
  return { statistics, findings, accepted: findings.length === 0 };
}

export function scoreRun({ plan = null, scene = null }) {
  const planReport = plan ? runPlanGates(plan) : null;
  const buildReport = scene ? scoreBuild(scene) : null;
  return {
    schema: "professional-slides.cold-run/v1",
    plan: planReport && {
      accepted: planReport.accepted,
      countsByCode: planReport.countsByCode,
      statistics: planReport.statistics,
      findings: planReport.findings.map((f) => ({ code: f.code, page: f.page, measured: f.measured })),
    },
    build: buildReport,
    // Deliberately not one number. A plan that passes and a build that does not
    // is a different problem from the reverse, and averaging them hides which.
    accepted: (planReport?.accepted ?? true) && (buildReport?.accepted ?? true),
  };
}

function readScene(directory) {
  const file = path.join(directory, "scene.json");
  if (!existsSync(file)) throw new Error(`No scene.json in ${directory}; build the deck first`);
  return JSON.parse(readFileSync(file, "utf8"));
}

function line(label, value, floor, reference) {
  const ok = value === null || value === undefined || value >= floor;
  const shown = value === null || value === undefined ? "n/a" : String(value);
  return `  ${ok ? "pass" : "FAIL"}  ${label.padEnd(22)} ${shown.padStart(7)}   floor ${String(floor).padStart(5)}   reference ${reference}`;
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
    out.push("BUILD");
    for (const [key, bar] of Object.entries(BUILD_BARS)) out.push(line(key, s[key], bar.min, bar.reference));
    for (const [key, bar] of Object.entries(BUILD_CEILINGS)) out.push(`  ${s[key] <= bar.max ? "pass" : "FAIL"}  ${key.padEnd(22)} ${String(s[key]).padStart(7)}   ceiling ${String(bar.max).padStart(3)}`);
    out.push(`        ${s.contentPages} content pages, ${s.distinctExhibits} distinct exhibits, ${s.tables} tables, ${s.charts} charts`);
  }
  out.push(result.accepted ? "ACCEPTED" : "NOT ACCEPTED");
  return out.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
    const result = scoreRun({ plan, scene });
    console.log(asJson ? JSON.stringify(result, null, 2) : report(result));
    process.exit(result.accepted ? 0 : 2);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
