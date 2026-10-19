// A chart over time earns its page by showing a comparison a reader can see. Every chart that draws a series over periods
// calls assertComparison with the scale it draws on, so the rule is one rule, read off what the page will show:
//
// SERIES_FLAT - every series moves less than a tenth of the value axis drawn. Its change is a few pixels; the chart reads as
// a level, not a trend, and the axis that blew out to hold a second series or a zero baseline is what hid it. The BA deck's
// slot shares (51-56% on a 0-60 axis, beside Virgin's 4%) and its per-seat-mile multiples (10.7 to 11.7 on 0-12.5) were
// pages of flat lines and equal columns. A level set against a reference (a target, a band) is exempt: it compares.
//
// ONE_COMPARISON - six periods or more drawn to make one comparison: the chart's only number marks span the same two
// periods (a `cagr`, one change annotation a series), the periods between carry no mark of their own (a callout, an event,
// a band, a highlight) and say nothing the two ends do not - every one lies within the ends' range, close to the straight
// line between them. Two columns, a slope or the two figures say it; the run of periods only asks the reader to look for
// something that is not there.
//
// NO_COMPARISON - one value drawn as a chart, or one period on a chart that joins periods (a line, an area, a combo's
// line): there is nothing to compare, and the figures say it. Two values in one series are a comparison, but a thin one:
// across the full width of a page, nothing marked and nothing beside it, it reads as an empty page - the A350F deck's
// "777F 100, A350F 80" and "replacement 1,530, growth 1,075". In 539 pages of strong decks no such page stands: a pair
// takes about half the page beside an insight column (12 of 13 read well), sits among panels, or runs wide only with
// the change between its bars drawn and labelled. That is a page's fault, not the drawing's, so the page compile
// refuses it (author-deck.mjs); the chart draws two marks as it is asked to.

export const FLAT_SHARE = 0.1;
export const LONG_RUN = 6;
// How far the periods between may stray from the straight line between the ends, as a share of the change between them,
// and still say nothing the ends do not.
const ON_THE_LINE = 0.15;

/**
 * `series`: [{ name, values }] as drawn; `span`: the value axis's span the series is drawn on (one per series where they are
 * drawn on scales of their own, else one for all); `dated`: whether the categories are periods. Throws with the code and the
 * repair; returns nothing when the chart shows a comparison.
 */
/**
 * Whether a chart of `members` categories in `series` series is too thin for the page it fills: one series of two values
 * drawn across the page with no insight column beside it (`shared` false) and no change marked between them (`changed`
 * false). A sentence for the refusal, or null.
 */
export function comparesTooLittle({ members, series = 1, shared = false, changed = false }) {
  if (members !== 2 || series !== 1 || shared || changed) return null;
  return "two values in one series drawn across the page, with nothing marked between them, read as an empty page - set the chart beside its insight column (`commentary: \"beside\"`) and mark the change between the bars (`changeAnnotations`, a bracket with its label), pair it with another cut as `panels`, say the two figures as `numbers`, or draw the whole set they belong to";
}

export function assertComparison({ id, categories, series, span, props = {}, dated = true, line = false }) {
  // One mark compares nothing, and neither does one period on a chart that joins periods: the BA deck's loyalty page drew a
  // year's two figures as two dots over an empty line chart, on an axis cut to 275-375.
  // A level set against a reference - a target line, a band, a ruled value - compares something: above or below it.
  const referenced = [props.referenceLines, props.bands, props.targets].some((list) => Array.isArray(list) && list.length) || Number.isFinite(props.reference);
  // A panel on its peers' scale (compose-arrangements.mjs) is read against them: one bar beside its peer compares, and a
  // flat panel beside one that moves is the finding ("costs held while revenue grew").
  const peers = Boolean(props.peerScale || props.comparisonDomain);
  if (line ? categories.length < 2 : categories.length * series.length < 2 && !referenced && !peers)
    throw new Error(`NO_COMPARISON: ${id}: ${line ? `a line joins two periods or more, and this one has ${categories.length}` : "one value drawn as a chart compares nothing"} - set ${series.length > 1 ? "the values side by side as columns" : "the value as a figure"}, or give the chart the periods or members it compares`);
  // Two periods are a comparison of their own, A against B, where two equal columns say "no change"; the rule is for a run.
  if (!dated || categories.length < 3) return;
  const spans = Array.isArray(span) ? span : series.map(() => span);
  const finite = (values) => values.filter(Number.isFinite);
  const movement = series.map((item, index) => {
    const values = finite(item.values);
    return values.length > 1 && spans[index] > 0 ? (Math.max(...values) - Math.min(...values)) / spans[index] : 1;
  });
  if (!referenced && !props.peerScale?.moves && movement.every((share) => share < FLAT_SHARE)) {
    const most = Math.max(...movement);
    throw new Error(`SERIES_FLAT: ${id}: every series moves under ${Math.round(FLAT_SHARE * 100)}% of the axis it is drawn on (at most ${Math.round(most * 100)}%), so the chart shows levels, not a change over ${categories.length} periods. Say the level in the title or as figures; draw the latest period's values as bars where the point is how the series compare; or plot what moves - the change on the period before, each series indexed to its first period, or, for columns on a zero baseline, a line whose axis starts near its values`);
  }
  if (categories.length < LONG_RUN) return;
  const changes = [...(props.changeAnnotations || []), ...(props.cagr ? [props.cagr] : [])];
  if (!changes.length) return;
  const ends = changes.map((change) => [String(change?.start?.category ?? change?.from ?? categories[0]), String(change?.end?.category ?? change?.to ?? categories.at(-1))]);
  if (new Set(ends.map((pair) => pair.join("|"))).size !== 1) return;
  const [from, to] = ends[0].map((category) => categories.map(String).indexOf(category));
  if (from < 0 || to < 0 || to - from < LONG_RUN - 1) return;
  const marked = [props.annotations, props.events, props.periods, props.bands, props.highlights, props.referenceLines, props.intervals].some((list) => Array.isArray(list) && list.length);
  if (marked) return;
  const saysNothing = series.every((item) => {
    const a = item.values[from], b = item.values[to];
    if (![a, b].every(Number.isFinite)) return true;
    const rise = Math.abs(b - a) || Math.max(Math.abs(a), 1e-9);
    return item.values.slice(from + 1, to).every((value, k) => {
      if (!Number.isFinite(value)) return true;
      const straight = a + (b - a) * (k + 1) / (to - from);
      return value >= Math.min(a, b) && value <= Math.max(a, b) && Math.abs(value - straight) <= ON_THE_LINE * rise;
    });
  });
  if (saysNothing) throw new Error(`ONE_COMPARISON: ${id}: ${to - from + 1} periods are drawn to make one comparison, ${categories[from]} against ${categories[to]}, and the periods between say nothing the two ends do not - each lies between them, close to the straight line. Draw the two periods (two columns, or a slope) with the change on them, or give the periods between a mark of their own (a callout, an event, a band) where what happens there is the point`);
}
