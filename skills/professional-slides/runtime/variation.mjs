#!/usr/bin/env node
// A deck's variation draw, for planning.
//
//   node runtime/variation.mjs [seed] [--design editorial]
//
// Two runs of one brief produce the same deck when the same habits choose the
// same page types and the runtime breaks every tie the same way. Give
// each new deck a fresh `variation` (this prints one when no seed is given) and
// plan with its draw: the featured page types are two from the design system's
// repertoire to use where the evidence allows - `--plan` prefers their forms
// and exhibit kinds among the choices that carry a page's claim equally well
// (`plan`), then takes the mark whose turn it is in the deck's own hand
// (`plan.hand`: for each reading task that leaves a choice, the kinds that can
// carry it best in the order this deck draws them, lead first) - and the rest
// is what the runtime will vary on its own. The same seed always gives the
// same draw.
import { randomBytes } from "node:crypto";
import { DESIGN_SYSTEMS, featuredDraw, variationChoices } from "./design-systems.mjs";
import { handOf } from "./claim-fit.mjs";
import { isMain, parseCli, runCli } from "./cli.mjs";

export function planningDraw(seed, design = "consulting") {
  if (!Object.hasOwn(DESIGN_SYSTEMS, design)) throw new Error(`Unknown design: ${design}`);
  const drawn = variationChoices(seed);
  const featured = featuredDraw(seed, design);
  // `plan` is what the draw steers in `--plan`: among forms and exhibit kinds that carry a page's claim equally well, the featured
  // entries' come first, then the deck's hand - an order of marks for each reading task more than one kind can carry best.
  const short = (kind) => kind.replace(/^chart\./, "");
  const hand = Object.fromEntries([...handOf(seed)].filter(([, kinds]) => kinds.length > 1).map(([task, kinds]) => [task, kinds.map(short)]));
  return { variation: String(seed), design, featured: featured.say, plan: { prefersForms: [...featured.forms], prefersKinds: [...featured.kinds], hand },
    runtime: { leansToward: drawn.lean, leadPoints: drawn.leadPoints, tracker: drawn.tracker,
      listMarker: drawn["style.listMarker"], tableRows: drawn["style.tableRows"], contents: drawn.agendaStyle ?? "list" } };
}

if (isMain(import.meta.url)) runCli((argv) => {
  const { values, positionals: [seed = randomBytes(4).toString("hex")] } = parseCli(argv, { design: { type: "string" } }, { usage: "Usage: variation.mjs [seed] [--design editorial]" });
  console.log(JSON.stringify(planningDraw(seed, values.design ?? "consulting"), null, 1));
});
