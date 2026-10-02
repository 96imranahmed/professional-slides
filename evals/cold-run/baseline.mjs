#!/usr/bin/env node
/**
 * The example decks, scored by the harness that scores a cold run.
 *
 *   node evals/cold-run/baseline.mjs            print the build bars per example deck
 *   node evals/cold-run/baseline.mjs --json
 *   node evals/cold-run/baseline.mjs --stamp    rewrite specimens/example-deck-baseline.json
 *
 * The decks are compiled in-process from `examples/*.deck.json`, so nothing has
 * to be built first and the numbers are today's rather than whatever a stale
 * build directory last held. A harness only trusted on decks that fail it is
 * not a harness: these are hand-authored decks, and where one misses a bar that
 * is a finding about the deck.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toDeckPlan } from "../../skills/professional-slides/runtime/compose.mjs";
import { planDeck } from "../../skills/professional-slides/runtime/planner.mjs";
import { BUILD_BARS, scoreBuild } from "./score.mjs";
import { SPECIMENS, weightSha } from "./specimens.mjs";
import { isMain } from "../../skills/professional-slides/runtime/cli.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES = path.resolve(HERE, "../../skills/professional-slides/examples");
export const BASELINE_DECKS = Object.freeze(["gallery-acceptance", "house-style", "nyc-or-sf"]);
export const BASELINE_FILE = path.join(SPECIMENS, "example-deck-baseline.json");

export function exampleScene(name) {
  const spec = JSON.parse(readFileSync(path.join(EXAMPLES, `${name}.deck.json`), "utf8"));
  return planDeck(toDeckPlan(spec, EXAMPLES)).deck;
}

export function measureBaseline(names = BASELINE_DECKS) {
  return Object.fromEntries(names.map((name) => {
    const scored = scoreBuild(exampleScene(name));
    const s = scored.statistics;
    return [name, {
      contentPages: s.contentPages, exhibitVarietyPerTen: s.exhibitVarietyPerTen, distinctExhibits: s.distinctExhibits,
      tables: s.tables, tablesTreated: s.tablesTreated, charts: s.charts, chartsAnnotated: s.chartsAnnotated,
      drawingsPerPage: s.drawingsPerPage, accepted: scored.accepted,
      misses: scored.findings.map((f) => f.measure),
    }];
  }));
}

function table(decks) {
  const keys = Object.keys(BUILD_BARS);
  const lines = [`  ${"deck".padEnd(20)} ${keys.map((k) => k.padStart(21)).join("")}`];
  for (const [name, s] of Object.entries(decks)) {
    lines.push(`  ${name.padEnd(20)} ${keys.map((k) => {
      const value = s[k] === null || s[k] === undefined ? "n/a" : String(s[k]);
      return `${s.misses.includes(k) ? "*" : " "}${value}`.padStart(21);
    }).join("")}`);
  }
  lines.push(`  ${"floor".padEnd(20)} ${keys.map((k) => String(BUILD_BARS[k].min).padStart(21)).join("")}`);
  lines.push("  * under the floor: a finding about the deck, not a reason to move the bar");
  return lines.join("\n");
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const decks = measureBaseline();
  if (args.includes("--stamp")) {
    const record = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
    record.recorded = new Date().toISOString().slice(0, 10);
    record.weightSha256 = weightSha();
    record.decks = decks;
    writeFileSync(BASELINE_FILE, JSON.stringify(record, null, 1) + "\n");
  }
  console.log(args.includes("--json") ? JSON.stringify(decks, null, 2) : table(decks));
}
