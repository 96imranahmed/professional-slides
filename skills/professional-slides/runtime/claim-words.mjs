// The words that make a claim absolute - a rank (largest, lowest), a
// universal (every, never, no rival), an exclusive (only) or a majority (most
// of) - and what holds one to its record. A self-check of a hundred-page deck
// found a third of its sixty overreaching claims were one of these words with
// nothing behind it: "no rival can buy into" a market where slots were sold,
// "second only to Iberia" in a set that left out Ryanair, "every season" over
// nine of eleven, "most" upgrades resting on an analyst's line. Each is cheap
// to catch where it is written and dear to find a hundred pages later.
import { axisOf, valuesOf, isPercentUnit, isRatioUnit } from "./measures.mjs";
import { hasPhrase } from "./text-layout.mjs";

/**
 * The families of absolute words, each a pattern over lower-cased text. A
 * claim's word is held by a finding that says a word of the same family: a
 * page may say "largest" where its evidence says "biggest", never where it
 * says neither.
 */
export const CLAIM_FAMILIES = Object.freeze({
  top: /(?<!\b(?:second|third|fourth|fifth)[- ])\b(?:largest|biggest|highest|greatest|busiest|deepest|strongest|widest|longest|fastest|best|most(?! of\b))\b/,
  bottom: /(?<!\b(?:second|third|fourth|fifth)[- ])\b(?:smallest|lowest|least|fewest|weakest|worst|slowest|shortest|cheapest|narrowest)\b/,
  rank: /\b(?:second|third|fourth|fifth)[- ](?:largest|biggest|highest|lowest|smallest|busiest|only to)\b|\branked? (?:first|second|third|top|last)\b/,
  // "Only" before a quantity minimises ("only 30% higher", "only a third"); before anything else it excludes.
  only: /(?<!\bnot )\b(?:only|sole|solely)\b(?! (?:(?:a|an|about|around|some|just) )?(?:[\d$£€¥]|half\b|a (?:third|quarter|fifth|tenth)\b|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b))|\bno other\b/,
  every: /\b(?:every|always|never|none)\b|\bno (?:rival|rivals|one|competitor|competitors|carrier|carriers|airline|airlines|firm|firms|company|companies|bank|banks|player|players)\b/,
  // A majority of a population, not a size: "grew by more than half" is a rate.
  most: /\bmost of\b|\bmajority\b|\bmore than half of\b/,
});

// What a finding may say that holds a page's word of each family: the family's
// own words, and for a universal or a majority the words that state one.
// A computed comparison says its ranking its own way ("Ryanair leads on 4 of
// 5", "ranks 1 of 8"), and that holds a rank word too.
const COMPUTED_RANK = /\bleads? on\b|\branks? (?:\d+|first|second|third|last|\w+th) of \d+\b/;
// A finding names a place in a ranking in plain words too: "its third market after the UK and Spain".
const ORDINAL = /\b(?:first|second|third|fourth|fifth|sixth)\b/;
const HELD_BY = Object.freeze({
  top: [CLAIM_FAMILIES.top, CLAIM_FAMILIES.rank, COMPUTED_RANK],
  bottom: [CLAIM_FAMILIES.bottom, CLAIM_FAMILIES.rank, COMPUTED_RANK],
  rank: [CLAIM_FAMILIES.rank, CLAIM_FAMILIES.top, CLAIM_FAMILIES.bottom, COMPUTED_RANK, ORDINAL],
  only: [CLAIM_FAMILIES.only],
  every: [CLAIM_FAMILIES.every, /\b(?:each|all)\b/],
  most: [CLAIM_FAMILIES.most, /\bmost\b/],
});

const lower = (text) => String(text ?? "").normalize("NFKC").replace(/[‘’]/g, "'").toLowerCase();

/** The absolute words a text says: `[{ family, word }]`, one per family, in the order the families are listed. */
// "Every minute a crew waits is a minute it cannot be dispatched" says what a unit is, not what a population did.
const EQUIVALENCE = /\bevery (\w+)\b[^.;]*\bis an? \1\b/;

export function claimWords(text) {
  const said = lower(text);
  return Object.entries(CLAIM_FAMILIES).flatMap(([family, pattern]) => {
    const found = said.match(pattern);
    return found && !(family === "every" && found[0] === "every" && EQUIVALENCE.test(said)) ? [{ family, word: found[0] }] : [];
  });
}

/** Whether a finding holds a claim's word of `family`. */
export const holds = (finding, family) => HELD_BY[family].some((pattern) => pattern.test(lower(finding)));

/**
 * The absolute words of `text` that none of `findings` holds: each
 * `{ family, word }`. `findings` are the sentences of the insights a page
 * rests on - their `finding`, not their `soWhat`, which is a reading of the
 * evidence and not the evidence.
 */
export function unheldWords(text, findings) {
  return claimWords(text).filter(({ family }) => !findings.some((finding) => holds(finding, family)));
}

/**
 * A finding's rank word checked against the insight's own measures: the
 * member it names beside "largest" or "lowest" is that measure's largest or
 * lowest, and there is a population to rank it in. Returns `{ kind, word,
 * member, measure, leader }` - kind "wrong" where a named member is not the
 * extreme of a measure over members that names it, "unranked" where the
 * insight records no measure over three or more members to rank in - or null.
 */
export function rankProblem(insight) {
  const finding = String(insight?.finding ?? "");
  const words = claimWords(finding).filter(({ family }) => family === "top" || family === "bottom");
  if (!words.length) return null;
  const measures = Object.entries(insight?.measures && typeof insight.measures === "object" ? insight.measures : {})
    .map(([name, m]) => ({ name, m, axis: axisOf(m), values: valuesOf(m) }))
    .filter(({ axis, values }) => axis.kind === "members" && axis.labels.length >= 3 && values.some((v) => typeof v === "number"));
  const { family, word } = words[0];
  if (!measures.length) return { kind: "unranked", word };
  // The word ranks the member on one of the insight's measures, so it holds where any measure naming the member puts it
  // first, and is wrong only where every one of them puts another there. A measure where the larger number is the worse
  // one (`better: "down"`) still ranks by its numbers: "the lowest cost" is the minimum.
  // "The largest weekend share", "the fastest growth": a rank on a share, a rate or a change is read off a quantity
  // the levels make, not off the levels, so only a measure kept in such a unit can say whether it holds.
  const relative = /\b(?:share|proportion|percentage|rate|ratio|margin|growth|grew|per|density|yield|intensity|mix)\b/.test(lower(finding));
  const readings = measures.filter(({ m }) => !relative || isPercentUnit(m.unit) || isRatioUnit(m.unit)).flatMap(({ name, axis, values }) => {
    const named = axis.labels.filter((label) => hasPhrase(finding, label, { ignoreCase: true }));
    if (named.length !== 1) return [];
    const scored = axis.labels.map((label, at) => ({ label, value: values[at] })).filter((cell) => typeof cell.value === "number");
    const extreme = family === "top" ? Math.max(...scored.map((c) => c.value)) : Math.min(...scored.map((c) => c.value));
    const member = scored.find((c) => c.label === named[0]);
    return member ? [{ held: member.value === extreme, member: named[0], measure: `${insight.id}/${name}`, leader: scored.find((c) => c.value === extreme).label }] : [];
  });
  if (!readings.length || readings.some((r) => r.held)) return null;
  const { member, measure, leader } = readings[0];
  return { kind: "wrong", word, member, measure, leader };
}
