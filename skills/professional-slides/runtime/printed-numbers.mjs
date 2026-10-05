// The numbers a page prints, read out of its text, and when a printed number
// states a recorded one.
//
// A page says its numbers three ways: plotted (an exhibit's values), printed
// in a figure (a metric, a table cell) and typed into a sentence. The first
// is held to its measure value by value (gates/dependency_gates.mjs); the
// other two are text, and text mixes measurements with everything else that
// has digits in it - a year, a period label, a model name, a date, an
// ordinal. This module is the one reading of that text:
//
//   printedNumbers("CHF1.3bn in FY26, up 4.3% on 500X routes")
//     -> 1.3 (currency, scaled, a measurement) and 4.3 (percent, a measurement)
//
// "FY26" and "500X" are labels and are not returned. A year or a day of the
// month is returned as a `period`, a bare whole number as an `integer`, and a
// number written as a measurement - with a decimal point, a thousands
// separator, a sign, a currency, a percent sign, a scale or a unit - as a
// `measure`; the callers decide which kinds they hold to the records.
import { isPercentUnit, isRatioUnit } from "./measures.mjs";

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
// A currency directly before the digits: a symbol, with the letters that
// qualify it ("US$", "A$"), or a two- or three-letter code ("CHF", "GBP").
const LEAD = /([+\-−–])?((?:[A-Za-z]{1,3})?[$£€¥]|[A-Z]{2,3})?$/;
// A scale set against the digits: "26m", "1.3bn", "40k". In capitals it is one only on a number otherwise marked as a
// measurement ("$5M", "1.3BN"): "4K" and "5G" are names.
const SCALE_ATTACHED = /^(k|mn|m|bn|b|tn)(?![A-Za-z])/, SCALE_CAPITAL = /^(K|MN|M|BN|B|TN)(?![A-Za-z])/;
const SCALE_WORD = /^\s(thousand|million|billion|trillion|mn|bn|m|k)(?![A-Za-z])/;
const PERCENT = /^(?:%|\s?(?:percent|per cent)\b)/i;
const ORDINAL = /^(?:st|nd|rd|th)(?![A-Za-z])/i;
// A unit set against the digits: "2.9x", "4.3pp", "12bps", "5km". A lone "s" is a plural ("500s", "1990s").
const UNIT = /^(?!s(?![A-Za-z]))[a-z]{1,3}(?![A-Za-z])/;
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";
const MONTH_AFTER = new RegExp(`^\\s${MONTH}\\b`, "i"), MONTH_BEFORE = new RegExp(`\\b${MONTH}\\s$`, "i");
const ALNUM = /[A-Za-z0-9]/;
// What each scale word multiplies by.
const SCALE_OF = Object.freeze({ k: 1e3, thousand: 1e3, thousands: 1e3, m: 1e6, mn: 1e6, million: 1e6, millions: 1e6, bn: 1e9, b: 1e9, billion: 1e9, billions: 1e9, tn: 1e12, trillion: 1e12, trillions: 1e12 });

/**
 * The scale a measure's unit says its numbers are kept in - "GBP m" is
 * millions, "CHF bn" billions, "journeys, thousands" thousands - and 1 for a
 * unit that names none: "employees", "km" and "USD" are whole units, so
 * 126,604 employees is not "126.6m". Null where there is no unit to read, or
 * the unit names more than one scale. Only what is measured is read: in
 * "m per clinic" the scale is the numerator's.
 */
export function unitScale(unit) {
  const key = String(unit ?? "");
  if (!UNIT_SCALES.has(key)) UNIT_SCALES.set(key, (() => {
    const [head] = key.split(/\s+(?:per(?!\s*cent)|an?)\s+/i);
    if (!key.trim()) return null;
    const scales = new Set(head.toLowerCase().split(/[^a-z]+/).map((word) => SCALE_OF[word]).filter(Boolean));
    return scales.size === 1 ? [...scales][0] : scales.size ? null : 1;
  })());
  return UNIT_SCALES.get(key);
}
// A deck has a few dozen units and sets every printed number against every measure: each unit is read once.
const UNIT_SCALES = new Map();

/** The scale a piece of text opens on - "bn", " million", "k" set against or after a number - or null. */
export function leadingScale(text) {
  const hit = /^\s?(thousands?|millions?|billions?|trillions?|k|mn|m|bn|tn)(?![A-Za-z])/i.exec(String(text ?? ""));
  return hit ? { word: hit[1], factor: SCALE_OF[hit[1].toLowerCase()] } : null;
}

/**
 * The numbers `text` prints, in order: `{ n, decimals, sign, scaled, scale,
 * percent, currency, kind, shown }`. `sign` is 1 or -1 where the text prints
 * one and 0 where it does not; `scale` is what a scale word multiplies the
 * digits by (null without one); `shown` is the number as the reader sees it, with its
 * sign, currency and suffix. A number that is part of a label ("FY26", "Q3",
 * "M25", "500-4", "15th", "2024-25", "20:30") is not one.
 */
export function printedNumbers(text) {
  const source = String(text ?? "");
  // Every run of digits is read, labels included: whether "25" is a number depends on the "2024-" before it.
  const hits = [...source.matchAll(NUMBER)].map((hit) => readNumber(source, hit));
  const joint = (a, b) => source.slice(a.end, b.start);
  return hits.filter((token, i) => {
    if (token.label) return false;
    const prev = hits[i - 1], next = hits[i + 1];
    // Two numbers set against one mark are one token. "2024-25", "500-4" (the second smaller) and "M25-1000" (the first a label) are labels, as are "24/7" and "20:30"; "90-104" is a range of two numbers.
    const hyphened = (a, b) => ["-", "\u2013"].includes(joint(a, b)) && (a.label || a.kind === "period" || (b.n < a.n && !a.decimals && !b.decimals));
    const split = (a, b) => ["/", ":"].includes(joint(a, b));
    return !((prev && (hyphened(prev, token) || split(prev, token))) || (next && ((!next.label && hyphened(token, next)) || split(token, next))));
  }).map(({ label: _label, start: _start, end: _end, ...number }) => number);
}

/**
 * The numbers of a text that are written as measurements: one with a decimal
 * point, a thousands separator, a sign, a currency, a percent sign, a scale
 * or a unit, and - in a `figure`, a table cell or a tile's value - a whole
 * number that is all the text holds, with no word beside it ("648", "~50",
 * not "104 of 219 clinics" or "Line 2"). A year, a date, an ordinal, digits
 * inside a label and a bare count in a sentence are not. `typed` is the text
 * with what the runtime wrote taken out; `written` the text as it stands,
 * which is what a figure is read alone in. This is the one reading of "is
 * this number a measurement": the trace of typed numbers and the test of
 * whether an exhibit still types one both use it.
 */
export function measurementsIn(typed, figure = false, written = typed) {
  const numbers = printedNumbers(typed);
  const alone = figure && numbers.length === 1 && !/[A-Za-z]/.test(String(written).replace(numbers[0].shown, ""));
  return numbers.filter((number) => number.kind === "measure" || (number.kind === "integer" && alone));
}

/** One run of digits read in its place: a number with its marks, or `{ label: true }` where it is part of a name. */
function readNumber(source, hit) {
  const start = hit.index, end = start + hit[0].length;
  const before = source.slice(0, start), after = source.slice(end);
  const label = { label: true, start, end };
  // The end of a longer token ("1.2.3") is not a number.
  if (/\d\.?$/.test(before)) return label;
  const lead = LEAD.exec(before);
  let [, signChar = "", currency = ""] = lead;
  const prior = before.slice(0, before.length - lead[0].length).at(-1) ?? "";
  // Letters before the digits are a currency only as a word of their own: "FY26" and "M25" are labels.
  const letters = /^[A-Z]{2,3}$/.test(currency);
  if (letters && ALNUM.test(prior)) return label;
  if (!currency && !signChar && /[A-Za-z]/.test(before.at(-1) ?? "")) return label;
  // A hyphen set against the word or number before it joins a compound ("category-2", "2024-25"); it is not a minus.
  if ((signChar === "-" || signChar === "\u2013") && ALNUM.test(prior)) { if (!/\d/.test(prior)) return label; signChar = ""; }
  const literal = hit[0].replace(/,/g, "");
  const n = Number(literal);
  const decimals = (literal.split(".")[1] || "").length;
  const scale = SCALE_ATTACHED.exec(after) ?? SCALE_WORD.exec(after) ?? (decimals || currency || signChar ? SCALE_CAPITAL.exec(after) : null);
  const percent = PERCENT.exec(after);
  let unit = null;
  if (!scale && !percent && /^[A-Za-z]/.test(after)) {
    if (ORDINAL.test(after)) return label;
    unit = UNIT.exec(after);
    // Letters set against a bare whole number make a name ("500X", "3D"); against a measurement they are its unit ("1.5GW").
    if (!unit && !(decimals || currency || signChar || hit[0].includes(","))) return label;
  }
  // A letter code needs something that makes the digits a measurement: "CHF26m" and "CHF1.3bn" are money, "FY26" a period.
  if (letters && !(decimals || scale || percent || hit[0].includes(","))) return label;
  const marked = Boolean(decimals || hit[0].includes(",") || signChar || currency || percent || scale || unit);
  const year = !marked && literal.length === 4 && n >= 1900 && n <= 2100;
  const day = !marked && n >= 1 && n <= 31 && (MONTH_AFTER.test(after) || MONTH_BEFORE.test(before));
  // "5-year", "20-minute": a count inside a compound word.
  const compound = /^-[A-Za-z]/.test(after);
  const suffix = (scale ?? percent ?? unit)?.[0] ?? "";
  return { n, decimals, sign: signChar === "+" ? 1 : signChar ? -1 : 0, scaled: Boolean(scale), scale: scale ? SCALE_OF[scale[1].toLowerCase()] : null, percent: Boolean(percent), currency: Boolean(currency), ...(currency ? { currencyMark: currency } : {}),
    kind: year || day ? "period" : marked && !compound ? "measure" : "integer",
    shown: `${signChar}${currency}${hit[0]}${suffix}`.trim(), start: start - signChar.length - currency.length, end: end + suffix.length };
}

/** Is a measure's unit a percentage or percentage points (measures.mjs isPercentUnit): what a printed number of it may round to. */
export const percentUnit = (unit) => isPercentUnit(unit);

const half = (x) => 0.5 * 10 ** (Math.floor(Math.log10(Math.abs(x))) - 1);

/**
 * Does a plotted or printed value state a recorded one. It does when it is
 * the recorded value rounded at the precision printed (`decimals` places), and
 * that precision keeps two significant figures of the value: 54.9 plots 54.93
 * and 55 plots 54.9, and 3 does not state 3.4 however large the other values
 * of its measure are. There is one exception: a value whose unit is a
 * percentage or percentage points (`percent`) may be printed to one decimal
 * place, since a percentage is read on a scale of a hundred whatever its
 * size - so -0.9% states -0.86%, and -1% does not.
 */
export function matches(shown, recorded, { decimals = (String(shown).split(".")[1] || "").length, percent = false } = {}) {
  if (recorded === null || recorded === undefined) return false;
  const printed = 0.5 * 10 ** -decimals;
  const kept = Math.max(recorded === 0 ? printed : half(recorded), percent ? 0.05 : 0);
  return Math.abs(shown - recorded) <= Math.min(printed, kept) + 1e-9;
}

/** The fewest decimal places (six at most) at which `value` printed keeps the number it states, under the rule of `matches`. */
export function decimalsNeeded(value, { percent = false } = {}) {
  for (let decimals = 0; decimals < 6; decimals += 1) if (matches(Number(Math.abs(value).toFixed(decimals)), Math.abs(value), { decimals, percent })) return decimals;
  return 6;
}

// The scales a figure may be printed in against a record whose unit cannot be read: "1.3bn" then states 1,300.
const SCALES = [1e3, 1e6, 1e9];

/**
 * Does a printed number state a recorded value kept in `unit`: at its printed
 * precision (`matches`), with the sign it prints (an unsigned one states
 * either: "fell 21%" words the sign), and at its scale. Where the number
 * prints a scale, it is compared with the unit's - "1,600bn" states neither
 * 1.6 kept in billions nor 1,600 kept in millions, and a unit that names no
 * scale is whole units, so "126.6m" does not state 126,604 employees and
 * "126.6k" does. Only where there is no unit to read (or it names two scales)
 * may a scaled number be the record a scale of thousands up or down. A printed percentage states a recorded ratio or fraction a hundred
 * times over, and nothing else that is not a percentage. A caller that holds
 * no unit says whether the value is a percentage (`percent`); the scale check
 * then has nothing to compare.
 */
export function states(printed, recorded, { unit = null, percent = isPercentUnit(unit) } = {}) {
  if (recorded === null || recorded === undefined) return false;
  if (printed.sign && recorded !== 0 && Math.sign(recorded) !== printed.sign) return false;
  const kept = unitScale(unit);
  const near = (factor = 1) => matches(printed.n, Math.abs(recorded) * factor, { decimals: printed.decimals, percent });
  if (printed.scale && kept) return near(kept / printed.scale);
  if (near()) return true;
  if (printed.scaled && SCALES.some((f) => near(f) || near(1 / f))) return true;
  return Boolean(printed.percent) && isRatioUnit(unit) && near(100);
}
