/**
 * How much a page is expected to carry.
 *
 * Density is not the defect; empty is. A well-made page runs a median of about
 * 185 words of page text (title, labels, table cells, footnotes included), two
 * or three evidence elements, a commentary column that reaches the bottom of
 * its track. The runtime carries that as an explicit weight contract, and the
 * gates measure against it.
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
 * prose is the WORDS gate.
 *
 * The numbers themselves live in weight.json, which the Python gates read too.
 * There is one copy of the contract, so a floor cannot move in the composer
 * without moving in the finding that reports it.
 */

import { readJsonSync } from "./cli.mjs";

const CONTRACT = Object.freeze(readJsonSync(new URL("./weight.json", import.meta.url)));

export const WEIGHT_KEYS = Object.freeze(Object.keys(CONTRACT.keys));

/**
 * Defaults by fill level. `airy` turns the floors off: a live-pitch page is
 * meant to carry one chart and three words, and the deck says so.
 */
export const WEIGHT_BY_FILL = Object.freeze(Object.fromEntries(
  Object.entries(CONTRACT.byFill).map(([fill, values]) => [fill, Object.freeze({ ...values })]),
));

export const DEFAULT_FILL = CONTRACT.defaultFill;

const RANGES = CONTRACT.ranges;

/**
 * The most of a page's word floor a photograph can stand in for. The floor
 * follows the body the picture leaves; this is where it stops following it, so
 * that a page cannot grow its picture instead of making its argument.
 */
export const PICTURE_SHARE_MAX = CONTRACT.picture.shareMax;

/** The pages every figure here describes (weight.json analyticalPage; page_gates.py `analytical` reads the same). */
export function isAnalyticalPage(slide, index) {
  const components = new Set((slide.componentInstances || []).map((c) => String(c.component)));
  const structural = CONTRACT.analyticalPage.structuralComponents.some((c) => components.has(c)) || (index === 0 && !components.has("slide-chrome"));
  const argues = Boolean(slide.readingTask) || (slide.nodes || []).some((n) => n.role === "action-title");
  return argues && !structural && !new RegExp(CONTRACT.analyticalPage.generated).test(String(slide.id ?? ""));
}

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
 * The skill's reference targets for a well-made page. `slides` holds the pixel
 * targets, on the same 1280x720 canvas the gates read. `benchmark` holds the page
 * text distribution for analytical pages. `judged` holds the family shares and
 * the craft rates. The floors above sit deliberately below these medians; a
 * floor is not a target, and a page that clears it is not yet a strong page.
 */
export const REFERENCE = Object.freeze({
  slides: Object.freeze({ ...CONTRACT.reference.slides, bands: Object.freeze({ ...CONTRACT.reference.slides.bands }), numericByFamily: Object.freeze({ ...CONTRACT.reference.slides.numericByFamily }) }),
  benchmark: Object.freeze({ ...CONTRACT.reference.benchmark }),
  judged: Object.freeze({ ...CONTRACT.reference.judged, byFamily: Object.freeze({ ...CONTRACT.reference.judged.byFamily }) }),
});

/**
 * The plan-stage thresholds (weight.json `plan`): the mix bands, the craft
 * floors and the text form. The Node gates read them here and nowhere else, so
 * a band moved in the file moves in every gate that reads it.
 */
export const PLAN = CONTRACT.plan;

/** How long a deck must be before each deck-wide rule reads it (weight.json `deckLength`). */
export const DECK_LENGTH = Object.freeze({ ...CONTRACT.deckLength });

/** The rules version this runtime enforces, and the map of which rules each version introduced. */
export const RULES_VERSION = CONTRACT.rulesVersion;
export const RULES = CONTRACT.rules;

/** The version a rule began to block in; a rule no version names is older than versioning (1). */
export function ruleIntroduced(rule) {
  for (const [version, rules] of Object.entries(RULES.introduced)) if (rules.includes(rule)) return Number(version);
  return 1;
}

/**
 * The rules a deck is not held to: for a deck revised under the revision
 * workflow that records an older `rulesVersion`, every rule introduced after
 * it. Empty for every other deck, including one that records no version.
 */
export function waivedRules(deck = {}) {
  const version = Number(deck?.rulesVersion);
  if (deck?.workflow !== RULES.revisionWorkflow || !Number.isFinite(version) || version >= RULES_VERSION) return new Set();
  return new Set(Object.entries(RULES.introduced).filter(([v]) => Number(v) > version).flatMap(([, rules]) => rules));
}

/**
 * The rule a finding breaks: its code, or `CODE.tightened` when `measured`
 * falls between a bar a rules version lowered and the bar before it
 * (rules.tightened; page_gates.py rule_of reads the same).
 */
export function ruleOf(code, measured) {
  const tightened = RULES.tightened?.[code];
  return tightened && typeof measured === "number" && Number.isFinite(measured) && measured <= tightened.before ? `${code}.tightened` : code;
}

/**
 * The rule `code` (at `measured`) breaks when `deck` predates it, or null when
 * the deck is held to it: what a compile refusal asks before it is thrown.
 */
export function predatedRule(deck, code, measured, waived = waivedRules(deck)) {
  const rule = ruleOf(code, measured);
  return waived.has(rule) || waived.has(code) ? rule : null;
}

/**
 * `findings` with every rule the deck predates reported as an advisory, and
 * marked with the version that introduced it. A finding names its rule as
 * `rule` where only one variant of its code blocks, and by its code otherwise.
 */
export function applyRulesVersion(findings, deck = {}) {
  const waived = waivedRules(deck);
  if (!waived.size) return findings;
  return findings.map((f) => {
    const rule = f.rule ?? ruleOf(f.code, f.measured);
    if (!(waived.has(rule) || waived.has(f.code)) || !["blocker", "blocking"].includes(f.severity)) return f;
    return { ...f, severity: "advisory", waived: { rulesVersion: Number(deck.rulesVersion), introducedIn: ruleIntroduced(rule) } };
  });
}

/** The page's three bands, as a reference analytical slide carries them. */
export const REFERENCE_PAGE_BANDS = Object.freeze({ ...REFERENCE.slides.bands });
