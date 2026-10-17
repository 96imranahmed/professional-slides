#!/usr/bin/env node
// A deck's variation draw, for planning.
//
//   node runtime/variation.mjs [seed] [--design editorial]
//
// Two runs of one brief produce the same deck when the runtime breaks every
// tie the same way. Give each new deck a fresh `variation` (this prints one
// when no seed is given): the featured page types are two from the design
// system's repertoire to use where the evidence allows, and the rest is what
// the runtime will vary on its own. The same seed always gives the same draw.
import { randomBytes } from "node:crypto";
import { DESIGN_SYSTEMS, featuredDraw, variationChoices } from "./design-systems.mjs";
import { isMain, parseCli, runCli } from "./cli.mjs";

export function planningDraw(seed, design = "consulting") {
  if (!Object.hasOwn(DESIGN_SYSTEMS, design)) throw new Error(`Unknown design: ${design}`);
  const drawn = variationChoices(seed);
  const featured = featuredDraw(seed, design);
  return { variation: String(seed), design, featured: featured.say,
    runtime: { leansToward: drawn.lean, leadPoints: drawn.leadPoints, tracker: drawn.tracker,
      listMarker: drawn["style.listMarker"], tableRows: drawn["style.tableRows"], contents: drawn.agendaStyle ?? "list" } };
}

if (isMain(import.meta.url)) runCli((argv) => {
  const { values, positionals: [seed = randomBytes(4).toString("hex")] } = parseCli(argv, { design: { type: "string" } }, { usage: "Usage: variation.mjs [seed] [--design editorial]" });
  console.log(JSON.stringify(planningDraw(seed, values.design ?? "consulting"), null, 1));
});
