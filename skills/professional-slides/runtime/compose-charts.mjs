// What the composer reads into a chart from the page before it is drawn:
// the subject a title names (`focusFromTitle`, `namedInTitle`), the extreme
// it calls out (`decisiveFromTitle`), the change a title or the data
// describes (`changeFromContent`), a stack re-expressed as shares
// (`percentStack`), paired bar panels, and the shared ceiling peer charts take.
import { defaultFocusIndex } from "./chart-categorical.mjs";
import { CEILING_LADDER, niceCeiling } from "./nice-numbers.mjs";

/**
 * The shared ceiling for peer charts. The ladder is fine-grained on purpose: a
 * 62% maximum rounded to 100 leaves the bars crossing three fifths of the plot
 * and the page reading empty, where a ceiling of 80 keeps the scale honest and
 * the marks worth looking at.
 */
export const sharedBound = (value) => (value > 0 ? niceCeiling(value, { ladder: CEILING_LADDER }) : 1);

/**
 * Growth indicators. A chart that measures a change carries the change on the
 * chart: an arrow with a bubble from the first to the last period of a single
 * series, or a bracket per category between two series when the title talks
 * about the gap. `change: false` turns it off; `change: { from, to, text? }`
 * (or `change: true`) asks for the arrow explicitly; `cagr` puts the rate in
 * the bubble as "+13% p.a.".
 */
const PERIOD_CATEGORY = /(?:19|20)\d{2}|^FY\s?\d{2,4}|^[QH][1-4]\b|^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|^(?:Current|Today|Now|Baseline|Before|Future|Target|After|Year \d)/i;
const GAP_WORDS = /\b(?:gap|beat|beats|lead|leads|ahead|behind|trail|trails|above|below|higher|lower|more than|less than|points?|pts|pp|vs\.?|versus|outperform\w*|exceed\w*)\b/i;
const CHANGE_TYPES = ["chart.column", "chart.bar", "chart.line", "chart.area", "chart.stacked-column"];
const fmtNumber = (n) => { const a = Math.abs(n); return a >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, ""); };
const signed = (n, suffix = "") => `${n >= 0 ? "+" : "−"}${fmtNumber(Math.abs(n))}${suffix}`;
// Charts that set their categories over a data table's columns (chart-axes.mjs tableSpan).
export const TABLE_ALIGNED = new Set(["chart.column", "chart.stacked-column", "chart.line", "chart.area", "chart.combo", "chart.waffle"]);
// A chart whose categories run down the side, not along the bottom. A data
// table stacked under one of these has columns that align with nothing: a row
// of "Consultants 110 221 112" beneath three horizontal bars sets each number
// under empty plot. The table is only ever readable under a chart whose
// category axis is the x axis.
export const SIDEWAYS_CATEGORIES = new Set(["chart.bar", "chart.stacked-bar", "chart.lollipop",
  "chart.dumbbell", "chart.bullet", "chart.range"]);

/** `percent: true` on a stacked chart re-expresses each category as shares of its total (100% stack). */
export function percentStack(ex) {
  if (!ex || !ex.percent || !["chart.stacked-column", "chart.stacked-bar"].includes(ex.type) || !Array.isArray(ex.series) || !Array.isArray(ex.categories)) return ex;
  const totals = ex.categories.map((_, i) => ex.series.reduce((sum, sr) => sum + (sr.values[i] || 0), 0));
  // Shares to one decimal by largest remainder, so each column sums to exactly
  // 100. Rounding each share on its own can bring a column to 100.1, past the
  // 0-100 axis the chart refuses to draw.
  const shares = ex.categories.map((_, i) => {
    if (!totals[i]) return ex.series.map(() => 0);
    const exact = ex.series.map((sr) => ((sr.values[i] || 0) / totals[i]) * 1000);
    const floors = exact.map(Math.floor);
    let short = 1000 - floors.reduce((a, b) => a + b, 0);
    const order = exact.map((v, k) => [v - floors[k], k]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [, k] of order) { if (short <= 0) break; floors[k] += 1; short -= 1; }
    return floors.map((v) => v / 10);
  });
  const series = ex.series.map((sr, k) => ({ ...sr, values: sr.values.map((_, i) => shares[i][k]) }));
  const { percent, ...rest } = ex;
  return { ...rest, series, unit: ex.unit || "% of total", yMin: 0, yMax: 100, change: ex.change ?? false };
}

/**
 * The subject of a chart, named or read from the title.
 *
 * `focus` on a column, bar or line chart names what the page is about, as it
 * does on a scatter: a series name makes that series the subject and the rest
 * the comparator grey (`focusSeries`), a category name lights that bar
 * (`highlights`), a point's name sets it in the accent. Unnamed, the title
 * decides: a title that names one series, one bar of a single-series ranking
 * or one point of a scatter has named the mark the page is about, and the
 * chart marks it - four saturated series under a title about one of them, or
 * a ranking whose title names its leader, leave the reader to find it. A title
 * that names two members is a comparison, and marks neither; a chart the
 * author has already marked keeps its marks.
 */
const FOCUS_CHARTS = new Set(["chart.column", "chart.bar", "chart.line", "chart.area", "chart.lollipop"]);
const BAR_FOCUS = new Set(["chart.column", "chart.bar", "chart.lollipop"]);
// Words too common in labels to say which one a title means.
const LABEL_STOPWORDS = new Set(["the", "and", "for", "with", "from", "into", "per", "all", "other", "total", "share", "rate", "level", "group", "plan", "actual", "new", "old", "top", "base", "case", "only"]);
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * The one label of `labels` the title names, or null. A label is named when
 * its whole text (or its plural) is in the title; where no label is, when the
 * title uses a word of it that no other label carries. Two or more named -
 * or none - is null: the title compares, or does not say.
 */
export function namedInTitle(labels, title) {
  const text = String(title ?? "");
  const says = (phrase) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(phrase)}(?:e?s)?(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
  const clean = [...new Set(labels.map((label) => String(label ?? "").trim()).filter(Boolean))];
  // A label inside a longer one the title names ("Claude" in "Claude Code") is that label, not a second.
  const whole = clean.filter(says);
  const exact = whole.filter((label) => !whole.some((other) => other !== label && other.toLowerCase().includes(label.toLowerCase())));
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const words = (label) => [...new Set(label.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !LABEL_STOPWORDS.has(w)))];
  const own = clean.map((label) => words(label).filter((w) => clean.every((other) => other === label || !words(other).includes(w))));
  const hits = clean.filter((_, i) => own[i].some(says));
  return hits.length === 1 ? hits[0] : null;
}
export function focusFromTitle(ex, title) {
  if (!ex) return ex;
  if (["chart.scatter", "chart.bubble"].includes(ex.type)) {
    if (ex.focus !== undefined || !title) return ex;
    const point = namedInTitle((ex.points || []).map((p) => p?.name).filter((name) => typeof name === "string"), title);
    return point && (ex.points || []).length > 2 ? { ...ex, focus: [point] } : ex;
  }
  if (!FOCUS_CHARTS.has(ex.type)) return ex;
  const series = (Array.isArray(ex.series) ? ex.series : []).map((s) => s?.name).filter((name) => typeof name === "string");
  const categories = (ex.categories || []).map(String);
  if (ex.focus !== undefined) {
    const { focus, ...rest } = ex;
    const names = [focus].flat().map(String);
    const unknown = names.filter((name) => !series.includes(name) && !categories.includes(name));
    if (unknown.length) throw new Error(`focus names "${unknown[0]}", which is neither a series nor a category of the chart`);
    const inSeries = names.filter((name) => series.includes(name));
    if (inSeries.length > 1) throw new Error("focus names one series as the subject; the rest are its comparators");
    const bars = names.filter((name) => !series.includes(name));
    return { ...rest, ...(inSeries.length ? { focusSeries: inSeries[0] } : {}),
      ...(bars.length ? { highlights: [...(rest.highlights || []), ...bars.map((category) => ({ category, style: "bar" }))] } : {}) };
  }
  if (!title || ex.focusSeries !== undefined || ex.colorIndices !== undefined || (ex.highlights || []).length) return ex;
  if (series.length >= 2) {
    const named = namedInTitle(series, title);
    return named ? { ...ex, focusSeries: named } : ex;
  }
  // One bar of a ranking. Periods are the title's time frame, not its subject.
  if (BAR_FOCUS.has(ex.type) && series.length <= 1 && categories.length >= 3 && !categories.every((c) => PERIOD_CATEGORY.test(c))) {
    const named = namedInTitle(categories, title);
    if (named) return { ...ex, highlights: [{ category: named, style: "bar" }] };
  }
  return ex;
}

// A title that ranks one row with a superlative ("cheapest and safest", "the
// highest margin") says which row a table of figures turns on: its least or
// its greatest figure. A title with both directions, or neither, names none.
const LEAST_WORDS = /\b(cheapest|lowest|least|smallest|fewest|shortest|slowest|weakest)\b/i;
const MOST_WORDS = /\b(highest|largest|biggest|greatest|longest|fastest|strongest|priciest|costliest|dearest)\b/i;
export function decisiveFromTitle(ex, title) {
  if (ex?.type !== "table" || ex.highlightRow !== undefined || ex.decisive !== undefined || !title) return ex;
  const least = LEAST_WORDS.test(String(title)), most = MOST_WORDS.test(String(title));
  return least === most ? ex : { ...ex, decisive: least ? "least" : "most" };
}

export function changeFromContent(ex, title) {
  if (!ex || !CHANGE_TYPES.includes(ex.type) || ex.change === false || (!ex.change && !ex.cagr) || (ex.changeAnnotations || []).length) return ex;
  const categories = ex.categories || [], series = Array.isArray(ex.series) ? ex.series : [];
  if (categories.length < 2 || !series.length || !series.every((sr) => Array.isArray(sr.values) && sr.values.length === categories.length && sr.values.every(Number.isFinite))) return ex;
  const percentUnit = /%|percent|share|pts|points/i.test(String(ex.unit || ""));
  const delta = (a, b) => (percentUnit ? signed(b - a, " pp") : a > 0 ? signed(((b - a) / a) * 100, "%") : null);
  const out = { ...ex }; delete out.change;
  if (ex.cagr) {
    // The CAGR belongs on the arrow between its two periods, not in the heading.
    const a = categories.indexOf(ex.cagr.from), b = categories.indexOf(ex.cagr.to);
    if (a < 0 || b <= a) throw new Error("cagr.from and cagr.to must name two categories in order");
    const v0 = series[0].values[a], v1 = series[0].values[b];
    const year = (c) => { const m = String(c).match(/(?:19|20)\d{2}/); return m ? Number(m[0]) : null; };
    const years = year(ex.cagr.from) !== null && year(ex.cagr.to) !== null && year(ex.cagr.to) > year(ex.cagr.from) ? year(ex.cagr.to) - year(ex.cagr.from) : b - a;
    if (v0 > 0 && v1 > 0) {
      const rate = (Math.pow(v1 / v0, 1 / years) - 1) * 100;
      delete out.cagr;
      return { ...out, changeAnnotations: [{ start: ex.cagr.from, end: ex.cagr.to, style: "arrow", text: `${signed(rate, "%")} p.a.` }] };
    }
    return ex;
  }
  const explicit = ex.change && typeof ex.change === "object" ? ex.change : null;
  const periodic = categories.every((c) => PERIOD_CATEGORY.test(String(c)));
  const stacked = ex.type === "chart.stacked-column";
  // A stack's change is the change in its totals.
  const totals = stacked ? categories.map((_, i) => series.reduce((sum, sr) => sum + sr.values[i], 0)) : series[0].values;
  // `change: "steps"`: the period-to-period change between every adjacent pair,
  // as a small bracket above each pair (a familiar small-multiple pattern).
  if (ex.change === "steps" && (series.length === 1 || stacked) && categories.length >= 2 && categories.length <= 8) {
    const annotations = [];
    for (let i = 1; i < categories.length; i += 1) {
      const text = delta(totals[i - 1], totals[i]);
      if (text) annotations.push({ start: categories[i - 1], end: categories[i], style: "bracket", text, compact: true });
    }
    return annotations.length ? { ...out, changeAnnotations: annotations } : ex;
  }
  // An implied first-to-last change only reads on a series that trends: a run
  // that peaks and falls back, or starts from next to nothing, gets no arrow
  // unless the author asks for one (an epidemic curve, a launch ramp).
  const peak = Math.max(...totals.map(Math.abs)), first = Math.abs(totals[0]), last = Math.abs(totals[totals.length - 1]);
  // A growth column beside the stack already states the change per segment.
  const trends = first >= peak * 0.05 && (last >= peak * 0.6 || last <= first) && !ex.segmentGrowth;
  if ((series.length === 1 || stacked) && (explicit || ex.change === true || (periodic && ex.type !== "chart.bar" && trends))) {
    const from = explicit?.from ?? categories[0], to = explicit?.to ?? categories[categories.length - 1];
    const a = categories.indexOf(from), b = categories.indexOf(to);
    if (a < 0 || b <= a) throw new Error("change.from and change.to must name two categories in order");
    const text = explicit?.text || delta(totals[a], totals[b]);
    // Columns take the diagonal arrow across the tops; a line takes its change
    // beside its last point, where the eye already lands.
    // Adjacent columns take a bracket: an arrow has no room to read between them.
    const style = ex.type === "chart.line" || ex.type === "chart.area" ? "end-bubble" : b - a === 1 ? "bracket" : "arrow";
    return text ? { ...out, changeAnnotations: [{ start: from, end: to, style, text }] } : ex;
  }
  if (series.length === 2 && categories.length <= 6 && (ex.change === true || GAP_WORDS.test(String(title || "")))) {
    // The subject is the series the chart paints in the primary (the named
    // focus, else the latest period, else the first); the bubble reads subject
    // minus comparator, so a "2019 | 2024" pair reads 2024 minus 2019.
    const focus = series[Math.max(0, defaultFocusIndex(series.map((sr) => sr.name), ex.focusSeries))], base = series.find((sr) => sr !== focus);
    const annotations = categories.map((c, i) => ({ start: { category: c, series: base.name }, end: { category: c, series: focus.name }, style: "bracket", text: percentUnit ? signed(focus.values[i] - base.values[i], " pp") : signed(focus.values[i] - base.values[i]) }));
    return { ...out, changeAnnotations: annotations };
  }
  return ex;
}

/**
 * `paired: true` on a horizontal bar chart with two or three series: one panel
 * per series side by side, each on its own scale and headed by the series
 * name, sharing the left panel's category column (a "share of
 * commuters | share of residents" pair, say). The row is a two-up of peers, so the
 * plots share one top band and the rows line up.
 */
export function pairedBars(slide) {
  const ex = slide.exhibit;
  if (!ex || ex.type !== "chart.bar" || ex.paired !== true) return slide;
  const series = Array.isArray(ex.series) ? ex.series : [];
  if (series.length < 2 || series.length > 3) throw new Error("paired bars take two or three series");
  const { paired, heading, unit, units: unitsIn, ...rest } = ex;
  const units = Array.isArray(unitsIn) ? unitsIn : [];
  const panels = series.map((sr, i) => ({ ...rest, series: [sr], panelHeading: sr.name, ...(units[i] || unit ? { unit: units[i] || unit } : {}), ...(i ? { categoryLabels: false } : {}), native: false }));
  return { ...slide, exhibit: undefined, exhibits: panels, arrange: "row", pairedHeading: heading, pairedWeights: series.map((_, i) => (i ? 1 : 1.35)) };
}
