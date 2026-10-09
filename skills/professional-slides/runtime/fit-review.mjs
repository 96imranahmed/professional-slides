// What the fit between claims and forms (claim-fit.mjs) says of a whole deck,
// for the readers of a whole deck: the authoring compile's standings, the plan
// of a revision, and the deck reviewer's craft review.
//
// A deck's reviewers each asked, in their own words, whether a page's exhibit
// has the shape its claim needs, and none of them was told what the runtime
// had already read off the page's measures. This reads it once - the share of
// the deck's exhibits its commonest kinds carry, and the pages drawn in a form
// that only serves their claim while another is its best fit - so a reviewer
// confirms a measured reading, or says why the page is right as drawn.
//
// On a revision the reading is of the pages the revision added or redrew: a
// page kept as its source slide drew it, and a slide carried from the source
// deck, is the user's own, counted in the share and never judged
// (deck-structure.mjs keptAsSource, carriedKinds).
import { measureRegistry, readInsightLog } from "./measures.mjs";
import { alternativesOf, analysisInsights, readAnalysis } from "./analysis.mjs";
import { readInventory, sourceEvidence } from "./review-passes.mjs";
import { carriedKinds, fitsOf, keptAsSource } from "./deck-structure.mjs";
import { fitStandings } from "./gates/variety_gates.mjs";
import path from "node:path";

/**
 * The exhibit kinds each slide of a revision's source deck drew, by source
 * slide, as a page names them; null for new work and where the inventory is
 * not beside the deck's file (`file`: the pages file or the compiled deck).
 */
export async function sourceKindsOf(deck, file) {
  const inventory = file ? await readInventory(deck, file).catch(() => null) : null;
  return Array.isArray(inventory?.slides) ? new Map(inventory.slides.map((slide) => [slide.index, sourceEvidence(slide).map((kind) => (kind === "table" ? kind : `chart.${kind}`))])) : null;
}

/**
 * What the fit says of a compiled deck, as lines for its reviewer: the
 * advisories of gates/variety_gates.mjs fitStandings, each `{ code, pages,
 * text }`. Empty where the deck has no insight log with measures beside it -
 * there is no fit to read - and where nothing is advised.
 */
export async function reviewFit(spec, deckPath) {
  if (!deckPath) return [];
  const base = path.dirname(deckPath), stem = spec.id ?? path.basename(deckPath).replace(/\.deck\.json$/, "");
  const recorded = await readInsightLog(base, stem).catch(() => null);
  if (!recorded) return [];
  const analysis = await readAnalysis(base, stem, recorded, { alternatives: alternativesOf(spec) }).catch(() => ({ results: [] }));
  const insights = new Map([...(recorded.insights || []), ...analysisInsights(analysis.results)].map((item) => [item.id, item]));
  if (!measureRegistry(insights).size) return [];
  const sourceKinds = await sourceKindsOf(spec, deckPath);
  const { findings } = fitStandings(spec, { fits: fitsOf(spec, insights), kept: keptAsSource(spec, sourceKinds), carried: carriedKinds(spec.carried, sourceKinds) });
  return findings.map((f) => ({ code: f.code, pages: (f.slide || []).map(String), text: f.repair }));
}
