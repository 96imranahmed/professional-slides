// Period labels read as dates, so a chart can space them by the time between them.
//
// A run rate observed at Jan, Mar, Jun, Aug, Oct, Dec, Feb, Apr, May and Jul -
// gaps of one to three months - and plotted one slot apart steepens where the
// observations happen to bunch rather than where the growth does. A line or an
// area is a statement about rate, and its horizontal axis is elapsed time: the
// chart reads the labels as dates and places each observation where it falls
// (chart-line.mjs); a column chart, whose slots are categories, is refused
// irregular dates at compile unless its heading says they are snapshots
// (page-types.mjs).
//
// Only forms that read one way are parsed: a year (2025, 2025E, FY25), a
// quarter or half (Q1 2025, 1Q25, H2 2025), a month with its year (Jan 2025,
// Jan '25, Jan-25, 2025-01), a season (Summer 2019, Winter 2021-22, S19, W21),
// a bare month run (Jan, Mar, Jun), an ISO date. A
// label that parses as none of them, or a run that mixes kinds (years beside
// quarters), is left on its categorical slots.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const monthOf = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase());
const year = (text) => { const n = Number(text); return text.length === 2 ? 2000 + n : n; };
// Where a season stands in its schedule year, in months: spring and summer open it, autumn and winter close it.
const SEASON_AT = Object.freeze({ spring: 0, summer: 0, autumn: 6, fall: 6, winter: 6 });

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
  // A scenario's years counted from its start ("Year 1", "Year +2") are periods: a projection runs over them.
  if ((m = /^Year\s?\+?(\d{1,2})$/i.exec(s))) return { kind: "year-offset", t: Number(m[1]) * 12 };
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
  // A season, as an airline or a school schedule names it: Summer 2019, Winter 2021-22 (2021/22), the schedule's S19 and
  // W21, Spring and Autumn or Fall. Each is placed as a half of its schedule year - summer, then the winter that follows
  // it - so a run of seasons is evenly spaced: a schedule's summer and winter are its halves, whatever their months.
  if ((m = /^(summer|winter|spring|autumn|fall)\s?((?:19|20)\d{2}|'?\d{2})(?:[-–/](\d{2}|\d{4}))?(?:\s+season)?$/i.exec(s))) {
    const first = year(m[2].replace("'", ""));
    if (m[3] !== undefined && year(m[3].length === 4 ? m[3] : m[3]) % 100 !== (first + 1) % 100) return null;
    return { kind: "season", t: first * 12 + SEASON_AT[m[1].toLowerCase()] };
  }
  if ((m = /^([SW])\s?((?:19|20)\d{2}|\d{2})$/.exec(s))) return { kind: "season", t: year(m[2]) * 12 + (m[1] === "S" ? 0 : 6) };
  // A bare month: its year is the run's, read in order below.
  if ((m = new RegExp(`^${MONTH}\\.?$`, "i").exec(s))) return { kind: "bare-month", t: monthOf(m[1]) };
  return null;
}

// A period's qualifier - trailing or leading twelve months, to date, an
// estimate or a plan - says how the period is measured, not when it is.
const QUALIFIER = /\((?:[^)]*)\)|\b(?:LTM|TTM|NTM|YTD|QTD|MTD|est(?:imate)?|forecast|budget|plan|target|actual|proj(?:ected)?)\b\.?/gi;
const SPAN = /^(.+?)\s?(?:[-–/]|\bto\b)\s?(.+)$/i;
const BARE_PART = /^(?:Q[1-4]|H[12]|[1-4]Q|[12]H)$/i;
const NOW = /^(?:today|now|current|latest)$/i;
const EDGE = /^(?:end(?: of)?|start(?: of)?|mid|year[- ]end|before|after|since|pre|post|by|as at)\s+(?=\S)/i;
const TAIL = /\s+(?:or (?:later|earlier|after|before)|onwards?|and (?:after|later|earlier|before))$/i;
const DAY = /^(?:0?[1-9]|[12]\d|3[01])\s+(?=[a-z])/i;

/**
 * Is a label a period a trend can run over? The dates parsePeriod reads, and
 * the period labels that are not one point in time: a quarter or half within
 * its year (Q1, 2H), a span (2020-24, FY20-FY24, Jan-Mar, Q1-Q3 2025) and a
 * period with its qualifier (FY25 LTM, 2024 YTD). These decide whether an
 * axis is time at all - a trend's, a deck's chart over time - and have no one
 * place on it, so they are not spaced. The compiler and the craft floor each
 * kept a looser pattern of their own, which took "H3 2024" and any word
 * after a month's first three letters for a period.
 */
export function isPeriodLabel(label) {
  const s = String(label ?? "").trim().replace(/\s+/g, " ");
  if (!s) return false;
  if (parsePeriod(s) || BARE_PART.test(s) || NOW.test(s)) return true;
  // A period named by its edge or its run - End 2021, Before 1995, 2015 or later - or by a day in it (30 Sep 2026), or
  // with its year first (2026 Mar): the A350F deck's cumulative orders and delivery bands are periods all the same.
  const edged = s.replace(EDGE, "").replace(TAIL, "").replace(DAY, "");
  if (edged !== s) return isPeriodLabel(edged);
  const yearFirst = new RegExp(`^((?:19|20)\\d{2})\\s${MONTH}$`, "i").exec(s);
  if (yearFirst) return isPeriodLabel(`${yearFirst[2]} ${yearFirst[1]}`);
  const bare = s.replace(QUALIFIER, " ").replace(/\s+/g, " ").trim();
  if (bare && bare !== s) return isPeriodLabel(bare);
  // A span: both ends periods, or a year and the two digits it runs to.
  const span = SPAN.exec(s);
  return Boolean(span) && isPeriodLabel(span[1]) && (/^\d{2}$/.test(span[2]) ? /\d{2}$/.test(span[1]) : isPeriodLabel(span[2]));
}

// How many months each calendar period runs, so periods of different lengths can share one axis at their ends.
const PERIOD_MONTHS = Object.freeze({ year: 12, half: 6, quarter: 3, month: 1 });

/**
 * Where a run of period labels falls in elapsed time: `{ t, gaps, kind }`,
 * with `t` increasing, or null when the labels are not one kind of date read
 * in order. A bare-month run takes a year each time the month goes back
 * (Nov, Dec, Jan), which is the only way to read it in order.
 */
export function periodTimes(categories) {
  if (!Array.isArray(categories) || categories.length < 3) return null;
  const parsed = categories.map(parsePeriod);
  if (parsed.some((p) => !p)) return null;
  const kinds = new Set(parsed.map((p) => p.kind));
  // Calendar periods of different lengths - year-ends and then a half-year (2019, 2022, ..., 2025, H1 2026) - are read
  // each at its close, which is when a year-end ratio or a twelve-month total stands: the BA retest's leverage line set
  // H1 2026 a whole step after 2025, and 2019 to 2022 one step, where they are half a year and three years.
  const mixed = kinds.size > 1;
  if (mixed && [...kinds].some((k) => !(k in PERIOD_MONTHS))) return null;
  const kind = mixed ? "mixed" : parsed[0].kind;
  const t = [];
  for (const [i, p] of parsed.entries()) {
    let value = mixed ? p.t + PERIOD_MONTHS[p.kind] : p.t;
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

/**
 * The categories a dated run breaks after: each whose next date lies further off than the run's shortest step, so an axis
 * that sets the dates one slot apart says outright where it skips.
 */
export function gapBreaks(categories) {
  const times = periodTimes(categories);
  if (!times) return [];
  const step = Math.min(...times.gaps);
  return times.gaps.flatMap((gap, at) => (gap - step < 0.01 ? [] : [String(categories[at])]));
}

/**
 * The gaps in a dated run that leave out at least one whole period at the
 * run's own cadence, as `{ after, from, to }` (the index of the category
 * before the gap and the two labels): a survey of 2015-2019, 2022, 2023 and
 * 2025 has no 2020, 2021 or 2024. The cadence is the run's commonest gap (the
 * shorter on a tie), so a triennial survey (2017, 2020, 2023) misses nothing
 * and a run observed every one to three months is not broken where it bunches.
 * A line drawn straight across such a gap states values for periods the
 * series does not have - the BA retest's stacked area carried Heathrow's 2019
 * passengers across the two Covid years it had a third of them - so a line
 * breaks there and a filled area is refused it (chart-line.mjs, charts-extra.mjs).
 */
export function missingPeriods(categories) {
  const times = periodTimes(categories);
  if (!times) return [];
  const counts = new Map();
  for (const gap of times.gaps) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  const cadence = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  return times.gaps.flatMap((gap, after) => (gap >= 2 * cadence - 0.01 ? [{ after, from: String(categories[after]), to: String(categories[after + 1]) }] : []));
}

// A date given as approximate ("c. 2030", "circa 2030", "~2030") is still that date for the time between milestones.
const APPROXIMATE = /^(?:c\.|ca\.|circa|~)\s*/i;
// Kinds that name a moment on the calendar; a bare month or a scenario's "Year 2" has no year to measure from.
const DATED = new Set(["year", "half", "quarter", "month", "day", "season"]);

/**
 * The time from each milestone to the one before it, in months, as a list as
 * long as the labels (null for the first and wherever either date does not
 * parse), or null when the steps are even - every known step within half as
 * much again of the shortest - or fewer than two are known. A timeline sets
 * its milestones in even columns so their text reads; the BA retest's runway
 * timeline set Jul 2023 to 2035 that way, two months and five years one step
 * each, so the steps are said where they are uneven (schedule-stages.mjs).
 */
export function elapsedSteps(labels) {
  if (!Array.isArray(labels) || labels.length < 3) return null;
  const at = labels.map((label) => {
    const parsed = parsePeriod(String(label ?? "").trim().replace(APPROXIMATE, ""));
    return parsed && DATED.has(parsed.kind) ? parsed.t : null;
  });
  const steps = at.map((t, i) => (i && t !== null && at[i - 1] !== null && t > at[i - 1] ? Math.round(t - at[i - 1]) : null));
  const known = steps.filter((step) => step !== null);
  if (known.length < 2 || Math.max(...known) < 1.5 * Math.min(...known)) return null;
  return steps;
}

/** A step in months as a reader says it: "2 months", "18 months", "5 years". */
export function sayElapsed(months) {
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(months / 6) / 2;
  return `${years} years`;
}

/** The gaps as a reader would say them, for a message: "1-3 months", "1-4 years". */
export function describeGaps(categories) {
  const times = periodTimes(categories);
  if (!times) return "";
  const unit = times.kind === "year" || times.kind === "mixed" ? 12 : 1;
  const lo = Math.min(...times.gaps) / unit, hi = Math.max(...times.gaps) / unit;
  const noun = unit === 12 ? "year" : "month";
  const fmt = (v) => String(Math.round(v * 10) / 10);
  return `${fmt(lo)}-${fmt(hi)} ${noun}s`;
}

/**
 * A year-and-month label as a reader writes it: "2025-08" is "Aug 25". The
 * ISO form is a data key; thirteen of them under a line read as a table of
 * codes. Any other label is returned as it came.
 */
export function readablePeriod(label) {
  const m = /^((?:19|20)\d{2})[-/](0[1-9]|1[0-2])$/.exec(String(label ?? "").trim());
  if (!m) return label;
  const month = MONTHS[Number(m[2]) - 1];
  return `${month[0].toUpperCase()}${month.slice(1)} ${m[1].slice(2)}`;
}

/**
 * How many months apart a monthly axis labels its ticks: every month up to
 * nine, a quarter up to two years, a half-year up to four, then a year. A
 * label on each of thirteen months set them shoulder to shoulder; a quarterly
 * tick reads the run at a glance and the line keeps every observation.
 */
export function monthlyLabelStep(categories) {
  const times = periodTimes(categories);
  if (!times || times.kind !== "month" || times.gaps.some((gap) => gap !== 1)) return 1;
  const n = categories.length;
  return n <= 9 ? 1 : n <= 25 ? 3 : n <= 49 ? 6 : 12;
}
