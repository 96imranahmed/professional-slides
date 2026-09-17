/**
 * How much a page is expected to carry.
 *
 * Density is not the defect; empty is. Real client pages run a median of about
 * 185 words of page text (title, labels, table cells, footnotes included), two
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
 *
 * The numbers themselves live in weight.json, which the Python gates read too.
 * There is one copy of the contract, so a floor cannot move in the composer
 * without moving in the finding that reports it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CONTRACT = Object.freeze(JSON.parse(readFileSync(fileURLToPath(new URL("./weight.json", import.meta.url)), "utf8")));

export const WEIGHT_KEYS = Object.freeze(Object.keys(CONTRACT.keys));

/** What each key floors, in one line - the same text the docs and gates use. */
export const WEIGHT_KEY_DOC = Object.freeze({ ...CONTRACT.keys });

/**
 * Defaults by fill level. `airy` turns the floors off: a live-pitch page is
 * meant to carry one chart and three words, and the deck says so.
 */
export const WEIGHT_BY_FILL = Object.freeze(Object.fromEntries(
  Object.entries(CONTRACT.byFill).map(([fill, values]) => [fill, Object.freeze({ ...values })]),
));

export const DEFAULT_FILL = CONTRACT.defaultFill;

const RANGES = CONTRACT.ranges;

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
export function resolveWeight(spec = {}, fill = DEFAULT_FILL) {
  const base = WEIGHT_BY_FILL[fill] || WEIGHT_BY_FILL[DEFAULT_FILL];
  return { ...base, ...normalizeWeight(spec.weight, "weight") };
}

/**
 * The reference corpus, for the record. `slides` is the careful sample - 137
 * landscape analytical slides of published McKinsey, BCG and Bain client work,
 * with covers, dividers, back matter and portrait proposal documents excluded -
 * measured band by band and block by block. `corpus` is the wide sample: 1,832
 * pages of page text with no band split. The floors above sit deliberately
 * below both medians; a floor is not a target, and a page that clears it is not
 * yet a firm page.
 */
export const REFERENCE = Object.freeze({
  slides: Object.freeze({ ...CONTRACT.reference.slides, bands: Object.freeze({ ...CONTRACT.reference.slides.bands }), lineBlocks: Object.freeze({ ...CONTRACT.reference.slides.lineBlocks }) }),
  corpus: Object.freeze({ ...CONTRACT.reference.corpus }),
});

/** The page's three bands, as a reference analytical slide carries them. */
export const REFERENCE_PAGE_BANDS = Object.freeze({ ...REFERENCE.slides.bands, pages: REFERENCE.slides.pages });
/** Page text over the wide corpus, for the distribution the DECK_FLAT gate reads. */
export const REFERENCE_PAGE_WORDS = Object.freeze({ ...REFERENCE.corpus });
