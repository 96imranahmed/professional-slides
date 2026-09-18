#!/usr/bin/env node
/**
 * Compile a deck spec into a resolved scene.
 *
 *   node evals/scripts/compile_scene.mjs <spec.json> <scene-out.json>
 *
 * The spec's `deckPlan` goes through the planner; the scene that comes back is
 * what the emitter and the page gates both read. Prints one line of counters so
 * a failed compile is visible in CI output.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.resolve(here, "..", "..", "skills", "professional-slides", "runtime");
const { planDeck } = await import(path.join(runtime, "planner.mjs"));
const { toDeckPlan } = await import(path.join(runtime, "compose.mjs"));
const { metricsBackend } = await import(path.join(runtime, "font-metrics.mjs"));

const [, , specPath, outPath] = process.argv;
if (!specPath || !outPath) {
  console.error("usage: compile_scene.mjs <spec.json> <scene-out.json>");
  process.exit(64);
}
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const started = Date.now();
const plan = spec.schema === "professional-slides.deck/v3" || spec.deckPlan
  ? toDeckPlan(spec, path.dirname(path.resolve(specPath))) : spec;
const { deck } = planDeck(plan);
console.log([
  `metrics backend: ${metricsBackend()}`,
  `slides: ${deck.slides.length}`,
  `nodes: ${deck.slides.reduce((n, s) => n + s.nodes.length, 0)}`,
  `ms: ${Date.now() - started}`
].join(" | "));
fs.writeFileSync(outPath, JSON.stringify(deck));
