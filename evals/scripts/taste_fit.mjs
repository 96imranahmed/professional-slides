#!/usr/bin/env node
// Check, and fit, the layout engine's weights against recorded verdicts (evals/taste/README.md).
//
//   node evals/scripts/taste_fit.mjs PATH [PATH...]         how often the engine's own choice is the judge's, by measure
//   node evals/scripts/taste_fit.mjs PATH [PATH...] --fit   also search for weights that agree with more verdicts
//
// PATH is a verdicts.jsonl file, or a folder searched for `judgement/verdicts.jsonl` (one a workspace). A verdict is one
// decision put to a judge: the candidates it was shown, each with its measures, and the label chosen. A candidate's score
// is recomputed here from its measures alone, by the engine's own sum (tasteful-layout `combined`), so no
// page is laid out again and a corpus of verdicts is fitted in a moment. Nothing is written: the weights printed go into
// TASTE.weights (skills/professional-slides/runtime/core.mjs) by hand, after a look at what they change.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DENSITY_PROFILES, TASTE } from "../../skills/professional-slides/runtime/core.mjs";
import { combined } from "../../skills/professional-slides/runtime/tasteful-layout/index.mjs";

const MEASURES = Object.keys(TASTE.weights), TIE = 0.01;
const STEPS = [0, 0.03, 0.1, 0.3, 0.6, 1, 1.5, 2, 3];

/** Every verdict under the paths given. */
export function readVerdicts(paths) {
  const files = [];
  const walk = (at) => { const stat = fs.statSync(at);
    if (stat.isFile()) { if (at.endsWith(".jsonl")) files.push(at); return; }
    for (const name of fs.readdirSync(at)) if (name !== "node_modules" && !name.startsWith(".")) { const next = path.join(at, name); if (fs.statSync(next).isDirectory() || name === "verdicts.jsonl") walk(next); } };
  paths.forEach(walk);
  return files.flatMap((file) => fs.readFileSync(file, "utf8").split("\n").filter((line) => line.trim()).map((line) => ({ ...JSON.parse(line), file })))
    .filter((verdict) => verdict.candidates?.length > 1 && verdict.candidates.some((candidate) => candidate.label === verdict.chosen));
}

/** How the weights do on the verdicts: how many the engine would have chosen as the judge did, and by how much on average. */
export function agreement(verdicts, weights) {
  let agreed = 0, margin = 0;
  for (const verdict of verdicts) {
    const own = { ...weights, ...(DENSITY_PROFILES[verdict.density]?.taste ?? {}) };
    const scores = verdict.candidates.map((candidate) => ({ label: candidate.label, score: combined(candidate.measures, own) }));
    const chosen = scores.find((entry) => entry.label === verdict.chosen).score, rest = Math.min(...scores.filter((entry) => entry.label !== verdict.chosen).map((entry) => entry.score));
    if (chosen <= rest + TIE) agreed += 1;
    margin += rest - chosen;
  }
  return { agreed, of: verdicts.length, margin: verdicts.length ? margin / verdicts.length : 0 };
}

/** Weights that agree with more verdicts: each weight tried at a few steps in turn, kept where it helps, for three passes. */
export function fit(verdicts, start) {
  let best = { ...start }, at = agreement(verdicts, best);
  const better = (a, b) => a.agreed > b.agreed || (a.agreed === b.agreed && a.margin > b.margin + 1e-9);
  for (let pass = 0; pass < 3; pass += 1) for (const name of MEASURES) for (const step of STEPS) {
    const tried = { ...best, [name]: step }, got = agreement(verdicts, tried);
    if (better(got, at)) { best = tried; at = got; }
  }
  return { weights: best, ...at };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (!paths.length) { console.error("node evals/scripts/taste_fit.mjs PATH [PATH...] [--fit]"); process.exit(1); }
  const verdicts = readVerdicts(paths), now = agreement(verdicts, TASTE.weights);
  // Which measure the judge's choice was better on, and worse on, across the verdicts where the engine disagreed.
  const missed = verdicts.filter((verdict) => agreement([verdict], TASTE.weights).agreed === 0);
  const leaning = Object.fromEntries(MEASURES.map((name) => [name, missed.reduce((sum, verdict) => { const engine = verdict.candidates[0].measures[name] ?? 0, judge = verdict.candidates.find((c) => c.label === verdict.chosen).measures[name] ?? 0; return sum + Math.sign(engine - judge); }, 0)]));
  const report = { verdicts: verdicts.length, workspaces: new Set(verdicts.map((verdict) => verdict.file)).size, weights: TASTE.weights, agreed: now.agreed, share: verdicts.length ? Number((now.agreed / verdicts.length).toFixed(3)) : null,
    disagreed: missed.map((verdict) => ({ page: verdict.page, decision: verdict.decision, engine: verdict.candidates[0].label, judge: verdict.chosen })).slice(0, 40),
    // Positive: where they disagreed, the judge's choice was more often the better one on this measure - a weight to raise.
    judgeBetterOn: leaning };
  if (process.argv.includes("--fit")) { const found = fit(verdicts, TASTE.weights); report.fitted = { weights: found.weights, agreed: found.agreed, share: verdicts.length ? Number((found.agreed / verdicts.length).toFixed(3)) : null }; }
  console.log(JSON.stringify(report, null, 2));
}
