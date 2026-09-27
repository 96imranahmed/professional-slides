#!/usr/bin/env node
// A deck's variation draw, for planning.
//
//   node runtime/variation.mjs [seed] [--design editorial]
//
// Two runs of one brief used to produce the same deck, because the same habits
// chose the same page types and the runtime broke every tie the same way. Give
// each new deck a fresh `variation` (this prints one when no seed is given) and
// plan with its draw: the featured page types are two from the design system's
// repertoire to use where the evidence allows, and the rest is what the
// runtime will vary on its own. The same seed always gives the same draw.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DESIGN_SYSTEMS, variationChoices, seededRandom } from "./design-systems.mjs";

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--design");
  const design = at >= 0 ? args[at + 1] : "consulting";
  const seed = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--design") ?? randomBytes(4).toString("hex");
  console.log(JSON.stringify(planningDraw(seed, design), null, 1));
}
