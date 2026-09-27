// Period labels read as dates, so a chart can space them by the time between them.
//
// A fifty-page deck plotted a company's run rate at Jan, Mar, Jun, Aug, Oct,
// Dec, Feb, Apr, May and Jul - gaps of one to three months - one slot apart,
// so the line steepened where the observations happened to bunch rather than
// where the growth did. A line or an area is a statement about rate, and its
// horizontal axis is elapsed time: the chart reads the labels as dates and
// places each observation where it falls (charts.mjs); a column chart, whose
// slots are categories, is refused irregular dates at compile unless its
// heading says they are snapshots (page-types.mjs).
//
// Only forms that read one way are parsed: a year (2025, 2025E, FY25), a
// quarter or half (Q1 2025, 1Q25, H2 2025), a month with its year (Jan 2025,
// Jan '25, Jan-25, 2025-01), a bare month run (Jan, Mar, Jun), an ISO date. A
// label that parses as none of them, or a run that mixes kinds (years beside
// quarters), is left on its categorical slots.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const monthOf = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase());
const year = (text) => { const n = Number(text); return text.length === 2 ? 2000 + n : n; };

/**
 * One period label as `{ kind, t }`: `t` in months from year zero, so every
 * kind shares a unit, or null where the label is not unambiguously a date.
 */
export function parsePeriod(label) {
  const s = String(label ?? "").trim().replace(/\s+/g, " ");
  let m;
  // A year, with an estimate or forecast mark: 2025, 2025E, 2025F, 2025A.
  if ((m = /^((?:19|20)\d{2})\s?[AEFPB]?$/i.exec(s))) return { kind: "year", t: Number(m[1]) * 12 };
  // A fiscal year: FY25, FY2025, FY'25, FY 25.
  if ((m = /^FY\s?'?(\d{2}|\d{4})[AEFPB]?$/i.exec(s))) return { kind: "year", t: year(m[1]) * 12 };
  // A split fiscal year whose second half is the next year: 2025-26, 2025/26.
  if ((m = /^((?:19|20)\d{2})[-–/](\d{2})$/.exec(s)) && (Number(m[1]) + 1) % 100 === Number(m[2])) return { kind: "year", t: Number(m[1]) * 12 };
  // A quarter: Q1 2025, Q1'25, Q1-25, Q1 FY25, 1Q25, 2025 Q1, 2025-Q1.
  if ((m = /^Q([1-4])\s?[-'’]?\s?(?:FY\s?)?((?:19|20)\d{2}|\d{2})$/i.exec(s)) || (m = /^([1-4])Q\s?'?(\d{2}|\d{4})$/i.exec(s)))
    return { kind: "quarter", t: year(m[2]) * 12 + (Number(m[1]) - 1) * 3 };
  if ((m = /^((?:19|20)\d{2})\s?[-–]?\s?Q([1-4])$/i.exec(s))) return { kind: "quarter", t: Number(m[1]) * 12 + (Number(m[2]) - 1) * 3 };
  // A half: H1 2025, H2'25, 1H25, 2025 H1.
  if ((m = /^H([12])\s?[-'’]?\s?((?:19|20)\d{2}|\d{2})$/i.exec(s)) || (m = /^([12])H\s?'?(\d{2}|\d{4})$/i.exec(s)))
    return { kind: "half", t: year(m[2]) * 12 + (Number(m[1]) - 1) * 6 };
  if ((m = /^((?:19|20)\d{2})\s?[-–]?\s?H([12])$/i.exec(s))) return { kind: "half", t: Number(m[1]) * 12 + (Number(m[2]) - 1) * 6 };
  // A month with its year: Jan 2025, January 2025, Jan '25, Jan-25, Jan 25.
  if ((m = new RegExp(`^${MONTH}\\.?\\s?[-'’/]?\\s?((?:19|20)\\d{2}|\\d{2})$`, "i").exec(s))) return { kind: "month", t: year(m[2]) * 12 + monthOf(m[1]) };
  // A year and month: 2025-01, 2025/01.
  if ((m = /^((?:19|20)\d{2})[-/](0[1-9]|1[0-2])$/.exec(s))) return { kind: "month", t: Number(m[1]) * 12 + Number(m[2]) - 1 };
  // An ISO date: 2025-01-15, as a fraction of its month.
  if ((m = /^((?:19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(s))) return { kind: "day", t: Number(m[1]) * 12 + Number(m[2]) - 1 + (Number(m[3]) - 1) / 31 };
  // A bare month: its year is the run's, read in order below.
  if ((m = new RegExp(`^${MONTH}\\.?$`, "i").exec(s))) return { kind: "bare-month", t: monthOf(m[1]) };
  return null;
}

/**
 * Where a run of period labels falls in elapsed time: `{ t, gaps, kind }`,
 * with `t` increasing, or null when the labels are not one kind of date read
 * in order. A bare-month run takes a year each time the month goes back
 * (Nov, Dec, Jan), which is the only way to read it in order.
 */
export function periodTimes(categories) {
  if (!Array.isArray(categories) || categories.length < 3) return null;
  const parsed = categories.map(parsePeriod);
  if (parsed.some((p) => !p) || new Set(parsed.map((p) => p.kind)).size !== 1) return null;
  const kind = parsed[0].kind;
  const t = [];
  for (const [i, p] of parsed.entries()) {
    let value = p.t;
    if (kind === "bare-month") while (i && value <= t[i - 1]) value += 12;
    if (i && value <= t[i - 1]) return null;
    t.push(value);
  }
  return { kind, t, gaps: t.slice(1).map((v, i) => Math.round((v - t[i]) * 100) / 100) };
}

/**
 * The share of the axis each label sits at when the gaps between them are
 * uneven, or null when they are even (the categorical slots are already
 * proportional) or the labels are not dates. A run of calendar months whose
 * gaps are all one month is even, whatever the months' lengths.
 */
export function timePositions(categories) {
  const times = periodTimes(categories);
  if (!times) return null;
  const { t, gaps } = times;
  if (Math.max(...gaps) - Math.min(...gaps) < 0.01) return null;
  return t.map((v) => (v - t[0]) / (t.at(-1) - t[0]));
}

/**
 * Which labels a time-spaced axis sets, given each label's position `xs` and
 * the room `minGap` one needs: the first, then each that clears the last one
 * kept, the latest kept over the one before it when both cannot be. Every
 * observation keeps its tick; an even step would label a bunch and skip a gap.
 */
export function spacedLabelIndices(xs, minGap) {
  const clear = (a, b) => Math.abs(xs[a] - xs[b]) >= minGap;
  return xs.reduce((kept, _, index) => {
    if (!kept.length || clear(kept.at(-1), index)) kept.push(index);
    else if (index === xs.length - 1 && kept.length > 1 && clear(kept.at(-2), index)) kept[kept.length - 1] = index;
    return kept;
  }, []);
}

/** The gaps as a reader would say them, for a message: "1-3 months", "1-4 years". */
export function describeGaps(categories) {
  const times = periodTimes(categories);
  if (!times) return "";
  const unit = times.kind === "year" ? 12 : 1;
  const lo = Math.min(...times.gaps) / unit, hi = Math.max(...times.gaps) / unit;
  const noun = unit === 12 ? "year" : "month";
  const fmt = (v) => String(Math.round(v * 10) / 10);
  return `${fmt(lo)}-${fmt(hi)} ${noun}s`;
}
