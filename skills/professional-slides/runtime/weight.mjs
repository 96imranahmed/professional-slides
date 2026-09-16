/**
 * How much a page is expected to carry.
 *
 * Density is not the defect; empty is. Real client pages run a median of about
 * 200 words of page text (title, labels, table cells, footnotes included), two
 * or three evidence elements, a commentary column that reaches the bottom of
 * its track. Our pages were running half of that, so the runtime now carries an
 * explicit weight contract and the gates measure against it.
 *
 * The contract resolves in three steps, so one deck, one house or one template
 * can all set it and every page in that deck is judged the same way:
 *
 *   1. `weight` on the deck spec (an explicit override, any subset of keys)
 *   2. `weight` in the house profile a `template` deck produced
 *      (runtime/import-template.py measures the template and writes it)
 *   3. the deck's `fill` level (full / balanced / airy), which follows `density`
 *
 * Every number is a floor a page must reach, never a ceiling: the ceiling on
 * prose is the WORDS gate, and it has not moved.
 */

export const WEIGHT_KEYS = Object.freeze([
  "pageWords",     // words of page text (everything, furniture included) a content page must carry
  "columnFill",    // share of its own height the side column must reach
  "plotSpan",      // share of the exhibit frame the marks must span
  "pointWords",    // mean words per point in a side column
  "tableFill",     // share of the page's row budget a table should use
  "elements",      // evidence elements expected on an analytical page
]);

/**
 * Defaults by fill level. `airy` turns the floors off: a live-pitch page is
 * meant to carry one chart and three words, and the deck says so.
 */
export const WEIGHT_BY_FILL = Object.freeze({
  full: Object.freeze({ pageWords: 130, columnFill: 0.68, plotSpan: 0.60, pointWords: 10, tableFill: 0.55, elements: 2 }),
  balanced: Object.freeze({ pageWords: 95, columnFill: 0.55, plotSpan: 0.52, pointWords: 8, tableFill: 0.45, elements: 1 }),
  airy: Object.freeze({ pageWords: 0, columnFill: 0, plotSpan: 0, pointWords: 0, tableFill: 0, elements: 1 }),
});

const RANGES = {
  pageWords: [0, 400],
  columnFill: [0, 1],
  plotSpan: [0, 1],
  pointWords: [0, 60],
  tableFill: [0, 1],
  elements: [1, 4],
};

/** Validate and merge an override block (from the spec or a house profile). */
export function normalizeWeight(weight, where = "weight") {
  if (weight === undefined || weight === null) return {};
  if (typeof weight !== "object" || Array.isArray(weight)) throw new Error(`${where} must be an object of ${WEIGHT_KEYS.join(", ")}`);
  const out = {};
  for (const [key, value] of Object.entries(weight)) {
    if (!WEIGHT_KEYS.includes(key)) throw new Error(`Unknown ${where} key: ${key}; use one of ${WEIGHT_KEYS.join(", ")}`);
    const [min, max] = RANGES[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${where}.${key} must be a number between ${min} and ${max}`);
    out[key] = value;
  }
  return out;
}

/** The weight contract for a deck: fill defaults, then the house, then the spec. */
export function resolveWeight(spec = {}, fill = "balanced") {
  const base = WEIGHT_BY_FILL[fill] || WEIGHT_BY_FILL.balanced;
  return { ...base, ...normalizeWeight(spec.weight, "weight") };
}

/**
 * The reference corpus, for the record: 1,832 pages of published McKinsey, BCG
 * and Bain client decks measured at a median 196 words of page text (quartiles
 * 127 / 196 / 282). The floors above sit deliberately below that median — a
 * floor is not a target, and a page that clears it is not yet a firm page.
 */
export const REFERENCE_PAGE_WORDS = Object.freeze({ p25: 127, median: 196, p75: 282, pages: 1832 });
