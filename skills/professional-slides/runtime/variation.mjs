#!/usr/bin/env node
// A deck's variation draw, for planning.
//
//   node runtime/variation.mjs [seed] [--design editorial]
//
// Two runs of one brief produce the same deck when the same habits choose the
// same page types and the runtime breaks every tie the same way. Give
// each new deck a fresh `variation` (this prints one when no seed is given) and
// plan with its draw: the featured page types are two from the design system's
// repertoire to use where the evidence allows, and the rest is what the
// runtime will vary on its own. The same seed always gives the same draw.
import { randomBytes } from "node:crypto";
import { DESIGN_SYSTEMS, variationChoices, seededRandom } from "./design-systems.mjs";
import { isMain, parseCli, runCli } from "./cli.mjs";

// The page types each system is built from (references/theming.md#design-systems).
export const REPERTOIRE = Object.freeze({
  consulting: ["a table with a treatment (ratings, bars in cells, status)", "metrics over their exhibit", "a tracker or roadmap", "evidence beside developed commentary", "matched small multiples", "a reconciliation (waterfall or bridge)"],
  editorial: ["a text page that carries an argument", "a photograph beside prose", "a quotation page", "one large exhibit with commentary first", "a statement page between parts", "an annotated specimen"],
  journal: ["a full-width annotated chart with columns beneath", "small multiples on one scale", "metrics over their exhibit", "a record table", "a threshold or frontier chart", "a distribution with the focal case marked"],
  keynote: ["a hero number with its proof", "metrics over their exhibit", "a split-tone comparison", "a statement page", "a full-bleed picture page", "one idea with one chart"]
});

export function planningDraw(seed, design = "consulting") {
  if (!Object.hasOwn(DESIGN_SYSTEMS, design)) throw new Error(`Unknown design: ${design}`);
  const drawn = variationChoices(seed);
  const random = seededRandom(`${seed}:repertoire`);
  const featured = [...REPERTOIRE[design]].sort(() => random() - 0.5).slice(0, 2);
  return { variation: String(seed), design, featured, runtime: { leansToward: drawn.lean, leadPoints: drawn.leadPoints, tracker: drawn.tracker,
    listMarker: drawn["style.listMarker"], tableRows: drawn["style.tableRows"], contents: drawn.agendaStyle ?? "list" } };
}

if (isMain(import.meta.url)) runCli((argv) => {
  const { values, positionals: [seed = randomBytes(4).toString("hex")] } = parseCli(argv, { design: { type: "string" } }, { usage: "Usage: variation.mjs [seed] [--design editorial]" });
  console.log(JSON.stringify(planningDraw(seed, values.design ?? "consulting"), null, 1));
});
