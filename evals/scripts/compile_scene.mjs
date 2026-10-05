#!/usr/bin/env node
/**
 * Compile a deck spec into a resolved scene.
 *
 *   node evals/scripts/compile_scene.mjs <spec.json> <scene-out.json>
 *
 * A deck/v3 spec is composed first; a planner plan (`{ id, slides }`) goes to
 * the planner as it is. The scene that comes back is what the emitter and the
 * page gates both read. Prints one line of counters so a failed compile is
 * visible in CI output.
 */
import fs from "node:fs";
import path from "node:path";
import { planDeck } from "../../skills/professional-slides/runtime/planner.mjs";
import { toDeckPlan } from "../support/compose.mjs";
import { metricsBackend } from "../../skills/professional-slides/runtime/font-metrics.mjs";
import { isMain, parseCli, readJsonSync, runCli } from "../../skills/professional-slides/runtime/cli.mjs";

function main(argv) {
  const [specPath, outPath] = parseCli(argv).positionals;
  if (!specPath || !outPath) {
    console.error("usage: compile_scene.mjs <spec.json> <scene-out.json>");
    return 64;
  }
  const spec = readJsonSync(specPath);
  const started = Date.now();
  const plan = spec.schema === "professional-slides.deck/v3" ? toDeckPlan(spec, path.dirname(path.resolve(specPath))) : spec;
  const { deck } = planDeck(plan);
  console.log([
    `metrics backend: ${metricsBackend()}`,
    `slides: ${deck.slides.length}`,
    `nodes: ${deck.slides.reduce((n, s) => n + s.nodes.length, 0)}`,
    `ms: ${Date.now() - started}`
  ].join(" | "));
  // Compact, as build-deck writes it: only programs read a scene.
  fs.writeFileSync(outPath, JSON.stringify(deck));
}

if (isMain(import.meta.url)) runCli(main);
