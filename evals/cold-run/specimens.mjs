#!/usr/bin/env node
/**
 * Recorded cold runs, kept as inputs and scored by today's rules.
 *
 *   node evals/cold-run/specimens.mjs                  score every specimen
 *   node evals/cold-run/specimens.mjs --json
 *   node evals/cold-run/specimens.mjs --stamp [name…]  record the verdict and the weight.json it was taken under
 *
 * A specimen that stores only the numbers scoring once produced cannot fail: a
 * change to the gates never reaches it. So a specimen directory holds what a run
 * wrote - its pages file, its plan, its scene (gzipped) and, where there is one,
 * its compiled deck spec - and `specimen.json` beside them says what is known
 * about the run from outside the gates: whether it was delivered, what a reader
 * made of it, and the verdict today's rules must still reach (`expect`).
 *
 * A specimen that kept the author's run log (`author-log.jsonl`) has what the
 * run cost counted from it - compile runs, refused runs, refusals per code and
 * per page, the longest streak on one page - and recorded with the stamp.
 *
 * `recorded` is the stamp: the verdict the rules returned and the sha256 of the
 * weight.json they were read from. Scored again under the same weight.json the
 * verdict must come back unchanged; under a different one the verdict may move,
 * and `--stamp` records where it moved to so the change shows up in review.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { scoreRun } from "./score.mjs";
import { isMain } from "../../skills/professional-slides/runtime/cli.mjs";
import { readRunLog } from "../../skills/professional-slides/runtime/run-log.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SPECIMENS = path.join(HERE, "specimens");
export const WEIGHT = path.resolve(HERE, "../../skills/professional-slides/runtime/weight.json");
export const SCHEMA = "professional-slides.cold-run-specimen/v2";

/** The inputs a specimen may carry, by role, in the order they are looked for. */
export const INPUTS = Object.freeze({
  pages: ["pages.json"],
  plan: ["plan.json"],
  scene: ["scene.json.gz", "scene.json"],
  deck: ["deck.json.gz", "deck.json"],
});

/** The author's run log, where a specimen kept it: counted, never gated. */
const RUN_LOG = "author-log.jsonl";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const weightSha = () => sha256(readFileSync(WEIGHT));

export function readJsonFile(file) {
  const raw = readFileSync(file);
  return JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8"));
}

export function listSpecimens(root = SPECIMENS) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(root, entry.name, "specimen.json")))
    .map((entry) => entry.name)
    .sort();
}

/** The file that plays each role, relative to the specimen directory. */
export function inputFiles(dir) {
  const files = {};
  for (const [role, names] of Object.entries(INPUTS)) {
    const found = names.find((name) => existsSync(path.join(dir, name)));
    if (found) files[role] = found;
  }
  return files;
}

export function loadSpecimen(name, root = SPECIMENS) {
  const dir = path.join(root, name);
  const meta = JSON.parse(readFileSync(path.join(dir, "specimen.json"), "utf8"));
  const files = inputFiles(dir);
  const inputs = Object.fromEntries(Object.entries(files).map(([role, file]) => [role, readJsonFile(path.join(dir, file))]));
  const runs = existsSync(path.join(dir, RUN_LOG)) ? readRunLog(path.join(dir, RUN_LOG)) : null;
  return { name, dir, meta, files, ...inputs, runs };
}

/** What the recorded verdict is compared on: decisions, not every statistic. */
export function verdictOf(result) {
  const round = (value) => (typeof value === "number" ? Math.round(value * 100) / 100 : value);
  return {
    accepted: result.accepted,
    plan: result.plan && {
      accepted: result.plan.accepted,
      countsByCode: Object.fromEntries(Object.entries(result.plan.countsByCode).sort()),
    },
    build: result.build && {
      accepted: result.build.accepted,
      findings: result.build.findings
        .map((f) => ({ measure: f.measure, measured: round(f.measured) }))
        .sort((a, b) => a.measure.localeCompare(b.measure)),
    },
  };
}

export function scoreSpecimen(specimen) {
  const result = scoreRun({ plan: specimen.plan ?? null, scene: specimen.scene ?? null, runs: specimen.runs ?? null });
  return { name: specimen.name, weightSha256: weightSha(), result, verdict: verdictOf(result) };
}

export function inputHashes(dir, files = inputFiles(dir)) {
  return Object.fromEntries(Object.entries(files).map(([role, file]) =>
    [role, { file, sha256: sha256(readFileSync(path.join(dir, file))) }]));
}

/** Record today's verdict, the weight.json it was reached under, and the input bytes. */
export function stamp(name, root = SPECIMENS, today = new Date().toISOString().slice(0, 10)) {
  const specimen = loadSpecimen(name, root);
  const scored = scoreSpecimen(specimen);
  const meta = {
    ...specimen.meta,
    schema: SCHEMA,
    inputs: inputHashes(specimen.dir, specimen.files),
    recorded: { weightSha256: scored.weightSha256, stamped: today, verdict: scored.verdict, ...(scored.result.cost ? { cost: scored.result.cost } : {}) },
  };
  writeFileSync(path.join(specimen.dir, "specimen.json"), JSON.stringify(meta, null, 1) + "\n");
  return { name, previous: specimen.meta.recorded?.verdict ?? null, verdict: scored.verdict };
}

function line(name, scored, meta) {
  const v = scored.verdict;
  const plan = v.plan ? `plan ${v.plan.accepted ? "pass" : "FAIL"} [${Object.keys(v.plan.countsByCode).join(", ") || "clean"}]` : "plan -";
  const build = v.build ? `build ${v.build.accepted ? "pass" : "FAIL"} [${v.build.findings.map((f) => `${f.measure} ${f.measured}`).join(", ") || "clean"}]` : "build -";
  const expected = typeof meta.expect?.accepted === "boolean" ? (meta.expect.accepted === v.accepted ? " as expected" : " UNEXPECTED") : "";
  const rules = meta.recorded?.weightSha256 === scored.weightSha256 ? "" : " (weight.json changed since the stamp)";
  const c = scored.result.cost;
  const cost = c ? `\n  cost ${c.runs} compile runs, ${c.refused} refused${c.longestStreak ? `, longest streak ${c.longestStreak.runs} on ${c.longestStreak.page}` : ""}` : "";
  return `${name.padEnd(28)} ${v.accepted ? "ACCEPTED" : "NOT ACCEPTED"}${expected}${rules}\n  ${plan}\n  ${build}${cost}`;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const names = args.filter((a) => !a.startsWith("--"));
  const chosen = names.length ? names : listSpecimens();
  if (args.includes("--stamp")) {
    for (const name of chosen) console.log(JSON.stringify(stamp(name)));
  } else {
    const scored = chosen.map((name) => {
      const specimen = loadSpecimen(name);
      return { specimen, scored: scoreSpecimen(specimen) };
    });
    if (args.includes("--json")) console.log(JSON.stringify(scored.map(({ scored }) => scored), null, 2));
    else for (const { specimen, scored: s } of scored) console.log(line(specimen.name, s, specimen.meta));
  }
}
