// Compose a deck and report every page that fails, in one run.
//
// Composition has stages - the page is composed, then planned, then its
// components render - and a review-and-rebuild loop is the most expensive
// thing this skill does, so no stage stops at its first failure: a deck with
// six broken pages learns so in one build. Each stage collects its
// failures (core.mjs mapAll); this runs the stages, sets aside the pages that
// failed, and composes the rest, so a page that fails later is reported in the
// same run as one that failed earlier.
import { toDeckPlan } from "./compose-deck.mjs";
import { planDeck } from "./planner.mjs";

/**
 * `{ deck, decisions }` when every page composes; otherwise throws with `pageErrors` naming every failing page.
 * `slideCache` ({ has, get, set }) holds slides compiled before, by the slide as planned, its place and the deck's
 * tokens (core.mjs compileSlideAsWritten): a page whose planned slide is unchanged is not compiled again.
 */
export function composeAll(spec, baseDir, { partial = false, slideCache = null } = {}) {
  const errors = [];
  let working = structuredClone(spec);
  for (let round = 0; round < 6; round += 1) {
    try {
      const plan = toDeckPlan(structuredClone(working), baseDir);
      const result = planDeck(plan, undefined, { slideCache });
      // The tables the composer cut across pages, with what would hold each on one (compose-deck.mjs splitEstimate).
      if (plan.tableSplits) result.tableSplits = plan.tableSplits;
      if (!errors.length) return result;
      // The pages that composed, for a caller that reports the failures and
      // still checks everything else in the same run.
      if (partial) return { ...result, pageErrors: [...new Set(errors)] };
      break;
    } catch (error) {
      const found = error.pageErrors ?? [error.message];
      errors.push(...found);
      const ids = new Set([...(working.slides || []), ...(working.appendix || [])].map((s) => s.id).filter(Boolean));
      const failing = new Set(found.map((message) => message.match(/^(?:Cannot render )?([^:\s]+):/)?.[1]).filter((id) => ids.has(id)));
      // A failure that names no page (a deck-level error) cannot be set aside.
      if (!failing.size) break;
      working = { ...working, slides: (working.slides || []).filter((s) => !failing.has(s.id)),
        ...(working.appendix ? { appendix: working.appendix.filter((s) => !failing.has(s.id)) } : {}) };
    }
  }
  const unique = [...new Set(errors)];
  const error = new Error(unique.length === 1 ? unique[0] : `${unique.length} pages could not be composed:\n- ${unique.join("\n- ")}`);
  error.pageErrors = unique;
  throw error;
}
