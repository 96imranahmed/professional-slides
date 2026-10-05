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
import { measuresDeck, readsWholeDeck } from "./gates/gate_classes.mjs";

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

// The rules no revision is excused (weight.json rules.always): what makes a revision a revision.
const ALWAYS = new Set(RULES.always ?? []);

/** How many of a deck's slides are carried from its source deck, not composed here (revision.mjs): `carried` on the compiled spec. */
export const carriedCount = (deck) => (deck?.workflow === RULES.revisionWorkflow && Array.isArray(deck.carried) ? deck.carried.length : 0);
/** How many pages of a deck the runtime composes: its content pages, appendix included - what a deck rule counts. */
export const composedCount = (deck) => [...(deck?.slides || []), ...(deck?.appendix || [])].filter((slide) => slide && typeof slide === "object" && slide.kind !== "section").length;

// The fewest pages any deck-wide rule reads from (weight.json deckLength): "a share or a range over a handful of pages is
// noise", and that is as true of the pages a revision composes as of a short deck.
const POPULATION = Math.min(...Object.values(DECK_LENGTH).filter((value) => typeof value === "number"));

/**
 * Whether the pages a revision composes are enough for a rule that measures
 * the deck to be read over them - the one statement of "enough":
 *
 *   the rule                              is read over the composed pages when
 *   counts across pages - a share, a      there are as many as the shortest deck any deck rule reads
 *   rate, a run, a median                 (the smallest `deckLength`); the rule's own floor then applies
 *   asks what the deck as a whole has     that, and the composed pages are most of the deck - more than
 *   (gate_classes.mjs readsWholeDeck)     the slides carried: a carried slide may be the very page asked for
 *
 * Returns null when they are enough - the rule is held - and otherwise why
 * not, in a clause. One carried slide beside forty composed pages changes
 * nothing; one composed page among thirty carried slides is held to no deck
 * rule.
 */
export function deckRuleUnread(code, deck) {
  const carried = carriedCount(deck), composed = composedCount(deck);
  if (!carried || !measuresDeck(code)) return null;
  if (composed < POPULATION) return `the ${composed} page${composed === 1 ? "" : "s"} this revision composes ${composed === 1 ? "is" : "are"} fewer than the ${POPULATION} a rule over a deck reads from`;
  if (readsWholeDeck(code) && composed <= carried) return `it asks what the deck as a whole has, and ${carried} of the deck's ${carried + composed} pages are the user's own slides, which are not read and may hold it`;
  return null;
}

// What a page composed where a slide stood keeps of that slide, and the rules that judge it (weight.json rules.kept).
const KEPT = Object.entries(RULES.kept ?? {}).filter(([, codes]) => Array.isArray(codes));
/**
 * What of its slide the page a finding names kept unchanged, where the
 * finding's rule judges exactly that: "title", "source", or null. The page is
 * the compiled one the finding names by `id`, and what it kept is what the
 * compile checked against the inventory and recorded (`pageType.kept`).
 */
function keptOn(finding, deck) {
  const part = KEPT.find(([, codes]) => codes.includes(finding.code))?.[0];
  if (!part || finding.id === undefined || finding.id === null) return null;
  const page = [...(deck.slides || []), ...(deck.appendix || [])].find((slide) => String(slide?.id) === String(finding.id));
  return page?.pageType?.kept?.[part] ? part : null;
}

/**
 * The one decision on a blocking finding: why `deck` is not held to it, or
 * null when it is. Every stage asks it here - the compile, the build and
 * delivery (applyRulesVersion) - so a finding one stage holds is held by all.
 *
 *   workflow   the deck             the rule                              held?
 *   new deck   -                    any                                   held
 *   revision   -                    one no revision is excused            held
 *                                   (rules.always)
 *   revision   the finding's page   judges what the page kept of its      not held: { imported: true, kept, why }
 *              stands for a slide   slide, unchanged (rules.kept)
 *   revision   carries slides       measures the deck (measuresDeck),     not held: { imported: true, carried, composed, why }
 *                                   and the composed pages are not
 *                                   enough to read it (deckRuleUnread)
 *   revision   -                    introduced after the deck's version   not held: { rulesVersion, introducedIn }
 *   revision   -                    any other                             held
 *
 * A point change is judged on what it changes. A slide the revision carries
 * is the user's own: it is not composed, so no page rule can be raised of it.
 * A rule that counts something across the deck is read over the pages the
 * revision composed, and held wherever those are themselves enough for it to
 * be read: the presence of a carried slide excuses nothing. Every rule on a
 * page the revision composes - a page it gave a type - holds as it does for
 * any page.
 */
export function notHeldOn(finding, deck = {}) {
  if (deck?.workflow !== RULES.revisionWorkflow || ALWAYS.has(finding.code)) return null;
  const kept = keptOn(finding, deck);
  if (kept) return { imported: true, kept, why: `the ${kept === "title" ? "title" : "source line"} is the slide's own, unchanged by this revision: it is the user's, and is advised on, not refused` };
  const unread = deckRuleUnread(finding.code, deck);
  if (unread) return { imported: true, carried: carriedCount(deck), composed: composedCount(deck), why: unread };
  const waived = waivedRules(deck);
  if (!waived.size) return null;
  const rule = finding.rule ?? ruleOf(finding.code, finding.measured);
  return waived.has(rule) || waived.has(finding.code) ? { rulesVersion: Number(deck.rulesVersion), introducedIn: ruleIntroduced(rule) } : null;
}

/**
 * `findings` with every blocking one the deck is not held to (notHeldOn)
 * reported as an advisory, and marked with why: the version that introduced
 * its rule, or that it measures a deck of which the revision composes too
 * little for it to be read. A finding names its rule as `rule` where only one
 * variant of its code blocks, and by its code otherwise. `idOf` gives the id
 * of the page a finding names where it names it another way.
 */
export function applyRulesVersion(findings, deck = {}, idOf = (finding) => finding.id) {
  if (deck?.workflow !== RULES.revisionWorkflow) return findings;
  return findings.map((f) => {
    if (!["blocker", "blocking"].includes(f.severity)) return f;
    const waived = notHeldOn(f.id === undefined ? { ...f, id: idOf(f) } : f, deck);
    return waived ? { ...f, severity: "advisory", waived } : f;
  });
}

/**
 * What a revision that carries slides is told of the deck rules, in a
 * sentence written from its counts: which are held over the pages it
 * composes, and why the rest are not. Null where nothing is carried.
 */
export function deckRulesLine(deck) {
  const carried = carriedCount(deck), composed = composedCount(deck);
  if (!carried) return null;
  if (composed < POPULATION) return `No rule that measures the deck is held: the ${composed} page${composed === 1 ? "" : "s"} it composes ${composed === 1 ? "is" : "are"} fewer than the ${POPULATION} such a rule reads from, and the rest of the deck is the user's own.`;
  if (composed <= carried) return `A rule that counts across pages - a share, a rate, a run - is held over the ${composed} pages it composes, which are enough to read one; a rule on what the deck as a whole has (a summary, sections, the answer up front) is not held while most of the deck (${carried} of ${carried + composed} pages) is the user's own slides.`;
  return `Every rule that measures the deck is held over the ${composed} pages it composes: they are most of the deck (${carried} carried), so it is held as a deck this runtime wrote is.`;
}

/** The page's three bands, as a reference analytical slide carries them. */
export const REFERENCE_PAGE_BANDS = Object.freeze({ ...REFERENCE.slides.bands });
