// Shared numeric label formatting; encoding continues to use the raw value.
import { groupThousands } from "./draw.mjs";
/**
 * How many decimals a chart's labels carry - decided once for the chart, not
 * per value.
 *
 * Rounding each label on its own gives a series of 6.2, 5.3, 13.5 the labels
 * "6.2", "5.3" and "14": the one bar the title is about is the only one
 * rounded, and to a different number than the title says. A set
 * of numbers read across is written to one precision, so the chart's own
 * values decide it - a decimal while the largest of them is under a hundred
 * and any of them needs one, and whole numbers above that.
 */
export function decimalsFor(props, value) {
  // Every figure the chart prints from its data, wherever the chart keeps it:
  // keyed line points, a range's two ends, a bullet's targets, a treemap's tiles, a sparkline's
  // closing figure, a box's median. Reading only `series` and `values` would
  // leave those charts deciding label by label.
  const numbers = (list) => (Array.isArray(list) ? list : []);
  const all = [
    ...numbers(props?.series).flatMap((item) => [...numbers(item?.values), ...numbers(item?.points).map((point) => point?.y)]),
    ...numbers(props?.values),
    ...numbers(props?.low), ...numbers(props?.high), ...numbers(props?.targets),
    ...numbers(props?.items).map((item) => (Array.isArray(item?.values) ? item.values.at(-1) : item?.value)),
    ...numbers(props?.boxes).map((box) => box?.median),
  ].filter((entry) => Number.isFinite(entry));
  // A label the page's copy quotes to more places raises the whole chart to them, not that one label: the BA retest's
  // lollipop printed Air France's 1.58% as "1.6" beside BA's quoted "1.60", higher-looking yet lower, and its bridge
  // printed its quoted ends to two places and its steps to one, so the steps did not add up to the ends.
  if (Number.isInteger(props?.labelDecimals)) return props.labelDecimals;
  return all.length > 1 ? chartDecimals(all, props?.quotedFigures) : Math.max(Number.isInteger(value) ? 0 : Math.abs(value) >= 10 ? 0 : 1, quotedDecimals(props, value));
}

/**
 * The one precision a chart prints `values` to: a decimal while the largest is
 * under a hundred and any needs one, whole numbers above that - raised to the
 * places the page's copy quotes any of them to (`quoted`, figuresWithDecimals).
 * The consistency gate reads a chart's labels by this same rule
 * (gates/consistency_gates.mjs), so what it holds to one rounding is what the
 * chart prints.
 */
export function chartDecimals(values, quoted = []) {
  const all = values.filter((entry) => Number.isFinite(entry));
  const chart = Math.max(...all.map((entry) => Math.abs(entry))) >= 100 ? 0 : all.some((entry) => !Number.isInteger(entry)) ? 1 : 0;
  return Math.max(chart, ...all.map((entry) => quotedDecimals({ quotedFigures: quoted }, entry)));
}

/**
 * The fewest places, from `least` up to six, at which a bridge's printed steps
 * add up to its printed totals: `values` in order, `totals` the indexes that
 * are levels rather than steps. Rounded on their own, 0.63 + 0.01 - 0.12 +
 * 0.19 = 0.71 prints as 0.63, +0.0, -0.1, +0.2 and 0.71, which add to 0.73
 * (the BA retest's unit-spread bridge). Null where no precision reconciles -
 * the recorded steps themselves do not add up to the recorded totals.
 */
export function bridgeDecimals(values, totals = [], least = 0) {
  const at = new Set(totals);
  const adds = (decimals) => {
    let level = 0;
    return values.every((value, index) => {
      const printed = roundHalfAway(value, decimals);
      if (!at.has(index)) { level += printed; return true; }
      const ok = index === 0 || Math.abs(level - printed) < 0.5 * 10 ** -(decimals + 3);
      level = printed;
      return ok;
    });
  };
  for (let decimals = least; decimals <= 6; decimals += 1) if (adds(decimals)) return decimals;
  return null;
}

/**
 * A bridge's chart props with the one precision its labels print at: the
 * chart's own (decimalsFor), raised to the fewest places at which its printed
 * steps add up to its printed totals (bridgeDecimals). A declared
 * `valueFormat` is the author's and is kept; a bridge it leaves unreconciled is
 * refused at the check (gates/consistency_gates.mjs BRIDGE_UNRECONCILED).
 */
export function bridgeLabelProps(props) {
  const values = Array.isArray(props?.values) ? props.values : [];
  if (props?.valueFormat || values.length < 2) return props;
  const decimals = bridgeDecimals(values, props.totals ?? [], decimalsFor({ ...props, labelDecimals: undefined }, values[0]));
  return decimals === null ? props : { ...props, labelDecimals: decimals };
}

/** `value` rounded half away from zero at `decimals` places, on its decimal value, as formatValue prints it. */
export const roundHalfAway = (value, decimals) => Math.sign(value) * Math.round(Math.abs(value) * 10 ** decimals + 1e-9) / 10 ** decimals;

// The most places a label takes from the page's copy: "11.6" and "4.75" are
// quoted to the precision a reader compares; a longer figure is a table's.
const QUOTED_PLACES_MAX = 2;
/**
 * The places the page's own copy quotes this value to, or 0.
 *
 * A bar labelled "12" beside a sentence saying 11.6 reads as two sources
 * disagreeing, and the chart's one precision - whole numbers once its largest
 * value reaches a hundred - would round exactly the figure the page is about.
 * The composer hands each chart the figures its page writes with decimals
 * (`quotedFigures`, compose-passes.mjs); a value the copy quotes is printed as the
 * copy prints it, and every other label keeps the chart's precision.
 */
export function quotedDecimals(props, value) {
  const quoted = Array.isArray(props?.quotedFigures) ? props.quotedFigures : [];
  if (!quoted.length || !Number.isFinite(value) || Number.isInteger(value)) return 0;
  let places = 0;
  for (const figure of quoted) {
    const decimals = Math.min(QUOTED_PLACES_MAX, Number(figure?.decimals) || 0);
    if (decimals > places && Math.abs(round(Math.abs(value), decimals) - Math.abs(Number(figure?.value))) < 1e-9) places = decimals;
  }
  return places;
}

/**
 * The figures a page's copy writes with decimals, as `{ value, decimals }`:
 * "$11.6B" is 11.6 to one place, "4.75%" 4.75 to two. Whole numbers are left
 * out - a quote without decimals never asks a label for more places.
 */
export function figuresWithDecimals(texts) {
  const found = new Map();
  for (const text of texts) {
    for (const match of String(text ?? "").matchAll(/(?<![\p{L}\d.])\d{1,3}(?:,\d{3})*\.(\d+)|(?<![\p{L}\d.,])\d+\.(\d+)/gu)) {
      const digits = match[1] ?? match[2];
      const value = Number(match[0].replace(/,/g, ""));
      if (Number.isFinite(value)) found.set(`${value}|${digits.length}`, { value, decimals: digits.length });
    }
  }
  return [...found.values()];
}

const round = (value, decimals) => (decimals
  ? Math.round(value * 10 ** decimals) / 10 ** decimals
  : Math.round(value));

export function formatValue(value, props) {
  const format = props.valueFormat;
  // Without a declared format, labels round the way a reader reads them: whole
  // numbers from ten up, one decimal below ten. Marks keep the raw value.
  // Four figures and up read with a thousands separator, the way every
  // well-made page prints them: 10,156 rather than 10156.
  const group = groupThousands;
  if (!format) {
    // The chart's precision is printed, not only rounded to: String() of a
    // rounded 32 is "32", which then sits beside "40.8" on the same series.
    const decimals = decimalsFor(props, value);
    const [whole, fraction] = round(value, decimals).toFixed(decimals).split(".");
    const sign = whole.startsWith("-") ? "-" : "";
    const digits = sign ? whole.slice(1) : whole;
    return `${sign}${digits.length > 3 ? group(digits) : digits}${fraction ? `.${fraction}` : ""}`;
  }
  if (format.sign !== undefined && !["auto", "always"].includes(format.sign)) throw new Error("valueFormat.sign must be auto or always");
  const units = {k: 1000, m: 1000000, bn: 1000000000};
  if (format.compactUnit !== undefined && !Object.hasOwn(units, format.compactUnit)) throw new Error("valueFormat.compactUnit must be k, m or bn");
  const divisor = units[format.compactUnit] || 1;
  const decimals = format.decimals ?? (format.compactUnit ? 1 : 0);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) throw new Error("valueFormat.decimals must be an integer from zero to six");
  if (format.grouping !== undefined && typeof format.grouping !== "boolean") throw new Error("valueFormat.grouping must be boolean");
  // Round half away from zero on the decimal value, as PowerPoint and Excel
  // do. toFixed rounds the binary value, so 3.55 (stored as 3.5499...) would
  // print "3.5" on the drawn chart and "3.6" on the native one beside it.
  const scaled = Math.abs(value / divisor) * 10 ** decimals;
  const raw = (Math.sign(value / divisor) * Math.round(scaled + 1e-9) / 10 ** decimals).toFixed(decimals);
  const number = format.grouping ? raw.split(".").map((part, index) => index === 0 ? group(part) : part).join(".") : raw;
  const sign = format.sign === "always" && Number(raw) > 0 ? "+" : "";
  return `${format.prefix || ""}${sign}${number}${format.compactUnit || ""}${format.suffix || ""}`;
}

/**
 * A formatted number with its unit, written the way the unit is written.
 *
 * "$m" after the figure gives "888$m", which no well-made page prints: a
 * currency symbol leads and its magnitude trails, so the same unit gives
 * "$888m". A percent closes up against the number, and everything else takes
 * the space it needs.
 */
export function withUnit(text, unit) {
  const trimmed = String(unit ?? "").trim();
  if (!trimmed) return String(text);
  const currency = trimmed.match(/^([$£€¥₹])\s*(.*)$/);
  if (currency) return `${currency[1]}${text}${currency[2]}`;
  if (/^[%‰]/.test(trimmed)) return `${text}${trimmed}`;
  return `${text} ${trimmed}`;
}

/**
 * One figure standing alone, as a table's pill, a chart's bubble and a measure
 * cell hold it: a qualifier or sign, a currency, the number (or a score out of
 * something, closed up: "4.5/5"; spaced, "10.48 / 22" is an expression), a
 * unit or magnitude and "p.a.". Three places kept their own pattern and
 * disagreed: the pill check refused "+25bps", "12 pts" and "£38m p.a." as
 * words mixed with figures while the bubble took two of them, so one figure
 * passed on a chart and failed in the table beside it.
 */
export const SCALAR_FIGURE = /^\s*(?:[~≈<>≤≥]\s*)?[+\-−–]?\s*([$€£¥₹])?\s*[+\-−–]?\s*\d[\d,]*(?:\.\d+)?(\/\d[\d,]*(?:\.\d+)?)?\s*(%|pp|pts?|bps|x|×|bn|tn|mn|[kmbt])?\+?(\s*p\.a\.)?\s*$/i;

/** The unit a lone figure is written in ("$bn", "%", "bps", "/5", "£m p.a.", "" bare), or null when `text` is not one figure. */
export function figureUnit(text) {
  const match = SCALAR_FIGURE.exec(String(text ?? ""));
  if (!match) return null;
  const [, currency = "", scale = "", unit = "", perYear] = match;
  return `${currency}${scale}${unit.toLowerCase().replace("×", "x").replace(/^pt$/, "pts")}${perYear ? " p.a." : ""}`;
}
