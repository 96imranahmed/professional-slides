// Compose a deck and report every page that fails, in one run.
//
// Composition has stages - the page is composed, then planned, then its
// components render - and each stage stopped at its first failure. A deck with
// six broken pages took six builds to learn so, and a review-and-rebuild loop
// is the most expensive thing this skill does. Each stage now collects its
// failures (core.mjs mapAll); this runs the stages, sets aside the pages that
// failed, and composes the rest, so a page that fails later is reported in the
// same run as one that failed earlier.
import { toDeckPlan } from "./compose.mjs";
import { planDeck } from "./planner.mjs";
import { readingTaskOf } from "./derive-content.mjs";

// Each composed page carries its reading task, so every word check - the
// author's, the page gates', the text contract's - holds it to one floor: the
// lower quartile for pages doing that job (reading-tasks.json).
function withReadingTasks(result, spec) {
  const byId = new Map([...(spec.slides || []), ...(spec.appendix || [])].filter((s) => s.id && s.pageType).map((s) => [s.id, s]));
  for (const slide of result.deck.slides) {
    const source = byId.get(slide.sourceSlideId ?? slide.id);
    if (source) slide.readingTask = readingTaskOf(source.pageType.family, [slide]);
  }
  return result;
}

/** `{ deck, decisions }` when every page composes; otherwise throws with `pageErrors` naming every failing page. */
export function composeAll(spec, baseDir, { partial = false } = {}) {
  const errors = [];
  let working = structuredClone(spec);
  for (let round = 0; round < 6; round += 1) {
    try {
      const result = planDeck(toDeckPlan(structuredClone(working), baseDir));
      if (!errors.length) return withReadingTasks(result, working);
      // The pages that composed, for a caller that reports the failures and
      // still checks everything else in the same run.
      if (partial) return { ...withReadingTasks(result, working), pageErrors: [...new Set(errors)] };
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
