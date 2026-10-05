// The chart heading every chart draws over its plot (`chart-title`): its
// copy checked, its variants (an underlined heading, a unit line under it or
// the unit inline), and the ruled band peers in a row share. Registered after
// the core components, before the charts that draw it.
import { houseStyle, token, tokenValue, rectPrimitive, stableId, textPrimitive, STYLE_TOKENS } from "./core.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";
import { textWordList } from "./text-contract.mjs";
import { FONT, COMPACT, INK, SECONDARY, WHITE, HAIRLINE, textStyle, boxStyle, openLine, SECTION_HEADING_TOKENS } from "./registry-shared.mjs";

function resolveChartTitleVariant(props = {}) {
  assertChartTitleCopy(props);
  if (props.unit !== undefined && (typeof props.unit !== "string" || !props.unit.trim())) throw new Error("Chart title unit must be nonempty text");
  const variant = props.variant ?? "underlined";
  if (!["underlined", "unit"].includes(variant)) throw new Error(`Unknown chart-title variant: ${variant}`);
  if (variant === "unit" && (typeof props.unit !== "string" || !props.unit.trim())) throw new Error("Chart title unit variant requires a unit");
  return variant;
}
// Chart titles identify the measure, population and period. Values and changes
// belong on chart marks/annotations, never in this shared title band. Keep this
// fail-closed: numeric context must use an unambiguous period or unit spelling.
function assertChartTitleCopy(props = {}) {
  for (const [field, value] of [["heading", props.heading || props.text], ["unit", props.unit]]) {
    if (typeof value !== "string") continue;
    let copy = value.normalize("NFKC");
    // A complete index-scale definition may use a scenario baseline rather
    // than a calendar year. Anchor the whole unit so appended results reject.
    if (field === "unit" && /^(?:index\s*[,;:]?\s*)?(?:base|baseline)\s*=\s*(?:1|100)\s*$/i.test(copy.trim())) continue;
    const year = "(?:19|20)\\d{2}";
    const fiscalYear = `(?:${year}|\\d{2})`;
    const month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
    // "March 2026" is the date the measure is taken at, as "FY26" is.
    // "31 March 2026", "calendar 2025": the date or year the measure is taken at.
    copy = copy.replace(new RegExp(`\\b(?:\\d{1,2}\\s+)?${month}\\.?\\s+${year}\\b`, "gi"), "period");
    copy = copy.replace(new RegExp(`\\b(?:calendar|fiscal|financial)\\s+(?:year\\s+)?${year}\\b`, "gi"), "period");
    // Dates written as numbers: 2026-03-31, 31/03/2026, March 31, 2026.
    copy = copy.replace(new RegExp(`\\b${year}-\\d{1,2}-\\d{1,2}\\b|\\b\\d{1,2}/\\d{1,2}/(?:${year}|\\d{2})\\b|\\b${month}\\.?\\s+\\d{1,2},?\\s+${year}\\b`, "gi"), "period");
    const period = `(?:FY\\s*${fiscalYear}(?:\\s*[-–/]\\s*(?:FY\\s*)?${fiscalYear})?|[QH][1-4](?:\\s+${year})?|${month}\\.?\\s+${year}|${year}\\s*[-–/]\\s*(?:${year}|\\d{2}))`;
    // "Index, 2021 = 100", "Index, FY19 = 100" and the bare "2018 = 100" a
    // heading ends on ("Passengers carried, 2018 = 100") name the base, not a
    // result: a period set equal to 100 is an index base whether or not the
    // word "index" stands before it. A figure appended to it still rejects.
    copy = copy.replace(new RegExp(`(?:\\bindex(?:ed)?\\b[^\\d]*?)?(?:${period}|\\b${year})\\s*=\\s*100\\b(?![.,]?\\d)`, "gi"), "index base");
    copy = copy.replace(/\b[nN]\s*=\s*[\d,.]+\b/g, "sample size"); // "n = 240" is the population, not a result
    copy = copy.replace(new RegExp(`\\b${period}\\b(?![\\d.%])`, "gi"), "period");
    // A year in the possessive names whose period it is - "at 2025's growth rate" - whatever word stands before it.
    copy = copy.replace(new RegExp(`\\b${year}(?=['\u2019]s\\b)`, "g"), "period");
    copy = copy.replace(new RegExp(`\\b(?:in|during|for|since|through|to|versus|vs\\.?|year)\\s+${year}\\b(?![\\d.%])`, "gi"), "period");
    copy = copy.replace(new RegExp(`([,(]\\s*)${year}(?=\\s*(?:$|[,) ;]))`, "g"), "$1period");
    copy = copy.replace(new RegExp(`^\\s*${year}(?=\\s*(?:$|[,;) ]))`), "period"); // a unit line that opens with its period
    // A year anywhere else is the period the heading asks for - "today and
    // 2030 goal", "2030 target" - not a result. It reads as a value only when
    // it is one: after a colon ("NYPD: 2025"), a currency or sign, a verb of
    // change ("fell 2015"), or carrying a decimal, percent or multiplier.
    copy = copy.replace(new RegExp(`(?<![:$€£¥₹+\\-−=.,\\d]\\s*)(?<!\\b(?:fell|rose|grew|declined|increased|decreased|dropped|reached|hit|totall?ed|of|at|was|were|is|are|up|down)\\s+)\\b${year}\\b(?![\\d.,]*\\s*(?:%|[xX]\\b|bn\\b|mn\\b|[mkb]\\b|pp\\b|pts?\\b|bps\\b|percent\\b|points?\\b|times\\b|fold\\b))(?![.,]\\d)`, "g"), "period");
    // A bounded observation window describes the measure. Mask only the
    // complete duration phrase so adjoining result values still reject.
    copy = copy.replace(/\bwithin\s+(?:one|1)\s+year\b/gi, "within observation period");
    // Scale denominators and named budgets/thresholds describe the measure, not a result.
    copy = copy.replace(/\bper\s+(?:100[,. ]?000|100k|1[,. ]?000|1k|100|10|1)\b(?:\s+(?:residents|people|employees|units|capita))?/gi, "per population");
    copy = copy.replace(/\b\d+(?:\.\d+)?\s*(?:-|–)\s*(?:minute|min|hour|day|week|month|year)\b/gi, "duration"); // "45-minute limit" names a threshold
    copy = copy.replace(/\b(?:above|below|under|over|at least|at most)\s+[$€£]?\d+(?:[.,]\d+)?\s*(?:bn|billion|million|m|k|%|hours?|minutes?)\b/gi, "population threshold");
    // Model and product designations name a thing, not a result: A350-1000,
    // A321neo, 787-9, 737 MAX 8, iPhone 15. A token that mixes letters and
    // digits, or a three-digit model with a short variant, is masked.
    // A figure with its multiplier or magnitude ("12x", "5bn", "40pp") mixes
    // letters and digits too, and is a result, so it is left to reject.
    copy = copy.replace(/\b(?!\d+(?:[xX]|bn|mn|[mkb]|pp|pts?|bps)\b)(?=[A-Za-z]*\d)(?=\d*[A-Za-z])[A-Za-z0-9]{2,}(?:-[A-Za-z0-9]+)*\b/g, "designation");
    copy = copy.replace(/\b\d{3}(?:-\d{1,2}[A-Za-z]*|\s+MAX(?:\s+\d{1,2})?)\b/g, "designation");
    // So is a three-digit model with a capital letter for its variant ("505X", "220F"): a multiplier is written with a small x
    // and a magnitude with M, K or B, which are left to reject.
    copy = copy.replace(/\b\d{3}(?![MKB]\b)[A-Z]\b/g, "designation");
    // A rank scale says which end is best ("rank, 1 = best"), and a set size
    // says how many members the chart shows ("top 40", "World's Top 100"):
    // both describe the measure. A figure after them - "top 40%", "top 3.5x" -
    // is still a result.
    copy = copy.replace(/\brank(?:ed|ing)?\b\s*[,;:]?\s*\(?\s*1\s*=\s*(?:best|top|highest|largest|first|lowest|worst)\s*\)?/gi, "rank scale");
    copy = copy.replace(/\b(?:top|bottom|largest|biggest|busiest|leading|first|last)\s+\d{1,4}\b(?![.,]\d)(?!\s*(?:%|[xX]\b|bn\b|mn\b|[mkb]\b|pp\b|pts?\b|bps\b|percent\b|points?\b|times\b|fold\b))/gi, "member set");
    // And so does a count of the members set off as the population - "Depots in service, 20 suppliers", "(12
    // markets)": a whole number before a plural noun, after the comma or bracket that opens the population (or opening a unit
    // line), with nothing after the noun. A magnitude or a currency there is a value, and is left to reject.
    copy = copy.replace(/(^\s*|[,;(]\s*)\d{1,4}\s+(?!(?:percent|points?|pts|times|fold|millions?|billions?|thousands?|hundreds?|bn|mn|pp|bps|dollars|pounds|euros|cents|pence)\b)(?:[a-z][a-z-]*\s+){0,2}[a-z][a-z-]*s\b(?=\s*(?:$|[,;)]))/gi, "$1member set");
    const numberWords = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)";
    // A number word is a result only when it quantifies a change or share ("twenty percent", "one point"),
    // not when it counts things the chart shows ("three monthly budgets").
    // The refusal names the figure it read as a result, so the author knows
    // which words to move rather than guessing at the heading.
    const result = copy.match(/[$€£¥₹+\-−]?\p{N}[\p{N}.,/]*\s*(?:%|[xX]\b|bn\b|mn\b|[mkb]\b|pp\b|pts?\b|bps\b)?/u)?.[0]
      ?? copy.match(/\b(?:doubled|tripled|halved)\b/i)?.[0] ?? copy.match(new RegExp(`\\b${numberWords}\\s+(?:percent|per\\s*cent|points?|pts|x|times|fold|percentage)\\b`, "i"))?.[0];
    if (result) {
      throw new Error(
        `Chart title ${field} must not contain statistics or chart results: ${JSON.stringify(value)} carries "${result.trim()}", which reads as a value the chart shows. Put it on the mark, a label or an annotation, and keep the ${field} to the measure, population and period. A ${field} may name a period ("FY26", "2 August 2026", "at 2025's rate"), a sample ("n = 240"), a set size ("top 40", or the members counted, set off by a comma: "20 suppliers"), a model by its designation ("X77", "505X"), an index base ("2019 = 100") or a rank scale ("1 = best").`
      );
    }
  }
}
// Chart headings default to measure plus inline unit in one ruled band.
// Explicit legacy layouts may stack the unit; peers reserve a shared band.
function chartTitleLayout(frame, props) {
  const variant = resolveChartTitleVariant(props);
  // The house style `band` sets the heading in white on a filled grey band with
  // side padding; the unit line then sits under the band.
  const band = houseStyle("style.chartHeading") === "band";
  const padX = band ? tokenValue(token("space.3")) : 0, padY = band ? tokenValue(token("space.2")) : 0;
  const rawHeading = String(props.heading || props.text || "").trimEnd();
  const headingText = props.unit ? rawHeading.replace(/,\s*$/, "") : rawHeading;
  const measureHeading = (text) => measureText(text, frame.width - 2 * padX, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold: !band, wrapWidthRatio: ENGINE_RESERVE });
  let heading = measureHeading(headingText);
  // The stacked unit line is compact grey under the heading; the inline unit
  // sits on the heading's line at the heading's size, after a comma in the heading.
  // The inline unit is tried first and falls back to the stacked line — at the
  // compact size — when the heading wraps or the pair will not fit on the line.
  const inlineGap = tokenValue(token("space.2"));
  const measureUnit = (size) => props.unit ? measureText(props.unit, frame.width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(size) }) : null;
  // A ruled heading takes the unit inline wherever the pair fits: a second
  // line under the heading pushes the rule down (peers then share the taller
  // band, below). The stacked unit line otherwise belongs to headings that
  // carry no rule.
  const underlined = resolveChartTitleVariant(props) === "underlined" && !band;
  const wanted = (props.unitPlacement === "inline" || underlined) && !band && heading.lines.length === 1;
  const inlineHeading = wanted ? measureHeading(`${headingText},`) : null;
  const inlineMeasure = wanted ? measureUnit(token("type.heading")) : null;
  const inline = Boolean(inlineMeasure) && inlineHeading.lines.length === 1 && inlineMeasure.lines.length === 1 && inlineHeading.width + inlineGap + inlineMeasure.width <= frame.width - 2 * padX;
  if (inline) heading = inlineHeading;
  const unitSize = inline ? token("type.heading") : COMPACT;
  const unit = inline ? inlineMeasure : measureUnit(COMPACT);
  if (unit && unit.lines.length !== 1) throw new Error("Chart unit must fit on one line; shorten the unit (e.g. \"$m\" not \"millions of US dollars\")");
  // `unitPlacement: "inline"` (the composer's choice for a chart beside a text
  // column) sets the unit after the heading on the same line, in grey, so the
  // heading band is one line and level with the side column's heading. It
  // falls back to the stacked unit line when the heading wraps or the unit
  // would not fit beside it.
  const unitGap = unit && !inline ? (band ? tokenValue(token("space.2")) : tokenValue(token("space.1")) / 2) : 0;
  const block = heading.height + 2 * padY + (unit && !inline ? unitGap + unit.height : 0);
  const bandHeight = Math.max(block, props.headerBandHeight || 0);
  const ruled = variant === "underlined" && !band;
  const ruleGap = tokenValue(token("space.1")), contentGap = tokenValue(token("space.3"));
  const height = bandHeight + (ruled ? ruleGap : 0) + contentGap;
  // A hero chart's banner is one line. When the composer asked for the inline
  // unit and the pair will not fit, the band becomes two lines. A real unit
  // ("% y/y", "$bn") beside a one-line heading is the runtime's to resolve: it
  // moves under the heading, and peers share the taller band, so their rules
  // still line up; reported as HEADING_WRAPS, it would name the heading when
  // the unit is what breaks the line. What the runtime cannot resolve is
  // recorded with its measure: a heading that wraps on its own, or a unit
  // written as a phrase ("$k, published base-salary band") carrying a
  // qualification that belongs in the note.
  const available = frame.width - 2 * padX;
  const oneLine = (text, bold = !band) => Math.ceil(measureText(text, 1e5, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold }).width);
  const phrase = Boolean(unit) && textWordList(props.unit).filter((word) => /[A-Za-z]{3,}/.test(word)).length >= 3;
  const reason = band || !(props.unitPlacement === "inline" || underlined) ? null
    : heading.lines.length > 1 ? "heading" : unit && !inline && phrase ? "unit" : null;
  const wrapped = reason ? { reason, text: reason === "heading" ? headingText : `${headingText}, ${props.unit}`,
    width: reason === "heading" ? oneLine(headingText) : oneLine(`${headingText},`) + inlineGap + oneLine(props.unit, false), available: Math.floor(available) } : false;
  return { heading, unit, unitSize, unitGap, inline, inlineGap, unitPlacement: unit ? (inline ? "inline" : "stacked") : "none", wrapped, block, bandHeight, ruleGap, contentHeight: bandHeight, ruled, variant, height, band, padX, padY };
}
function chartTitleNodes({ id, frame, props }) {
  const layout = chartTitleLayout(frame, props);
  if (layout.height > frame.height) throw new Error(`Chart title ${id} exceeds its allocated height; shorten the heading or unit, or allocate more height`);
  const blockTop = frame.y + layout.padY;
  const nodes = [];
  if (layout.band) nodes.push(rectPrimitive({ id: stableId(id, "band"), role: "chart-heading-band", frame: { x: frame.x, y: frame.y, width: frame.width, height: layout.heading.height + 2 * layout.padY }, style: boxStyle(SECONDARY, "none", HAIRLINE, token("radius.none")) }));
  nodes.push(textPrimitive({
    id: stableId(id, "heading"),
    role: "section-heading",
    frame: { x: frame.x + layout.padX, y: blockTop, width: frame.width - 2 * layout.padX, height: layout.heading.height },
    text: layout.heading.text,
    style: { ...textStyle(token("type.heading"), layout.band ? WHITE : INK, !layout.band, "left", "top"), lineHeight: layout.heading.lineHeight, wrap: false },
    data: { textLayout: layout.heading, headerTop: frame.y, headerBandHeight: layout.bandHeight, ruleGap: layout.ruleGap, chartTitleVariant: layout.variant, chartUnitPlacement: layout.unitPlacement, ...(layout.wrapped ? { headingWrapped: layout.wrapped } : {}) }
  }));
  if (layout.unit) nodes.push(textPrimitive({
    id: stableId(id, "unit"),
    role: "chart-unit",
    frame: layout.inline
      ? { x: frame.x + layout.padX + layout.heading.width + layout.inlineGap, y: blockTop, width: Math.max(layout.unit.width + 4, frame.width - layout.padX - layout.heading.width - layout.inlineGap), height: layout.unit.height }
      : { x: frame.x, y: blockTop + layout.heading.height + layout.padY + layout.unitGap, width: frame.width, height: layout.unit.height },
    text: props.unit,
    style: { ...textStyle(layout.unitSize, token("color.chartUnit"), false, "left", "top"), lineHeight: layout.unit.lineHeight, wrap: false },
    data: { textLayout: layout.unit, chartTitleVariant: layout.variant, chartUnitPlacement: layout.unitPlacement }
  }));
  if (props.badge) {
    // A right-aligned statistic pill on the heading line ("CAGR 2024–30: +13%").
    const badge = measureText(String(props.badge), frame.width * 0.5, { fontFamily: tokenValue(FONT), fontSize: tokenValue(COMPACT), bold: true });
    if (badge.lines.length === 1) {
      const pad = tokenValue(token("space.2")), w = Math.ceil(badge.width) + 2 * pad, h = badge.height + tokenValue(token("space.1"));
      const bx = frame.x + frame.width - w, by = frame.y + (layout.heading.height - h) / 2;
      nodes.push(rectPrimitive({ id: stableId(id, "badge-surface"), role: "chart-badge-surface", frame: { x: bx, y: by, width: w, height: h }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.round")) }));
      nodes.push(textPrimitive({ id: stableId(id, "badge"), role: "chart-badge", frame: { x: bx + pad, y: by + (h - badge.height) / 2, width: w - 2 * pad, height: badge.height }, text: badge.text, style: { ...textStyle(COMPACT, WHITE, true, "center", "top"), lineHeight: badge.lineHeight, wrap: false }, data: { textLayout: badge } }));
    }
  }
  if (layout.ruled) nodes.push(openLine(stableId(id, "rule"), frame.x, frame.y + layout.bandHeight + layout.ruleGap, frame.x + frame.width, frame.y + layout.bandHeight + layout.ruleGap, "section-heading-rule", INK, HAIRLINE, { chartTitleVariant: layout.variant }));
  return nodes;
}

/** The chart heading every chart draws over its plot, registered after the core components. */
export function registerChartTitle(registry) {
  registry.set("chart-title", {
    id: "chart-title", version: "2.1.0", category: "shared", role: "chart-title",
    tokens: [...SECTION_HEADING_TOKENS, "color.chartUnit", "color.accent", "color.textSecondary", "color.onPrimary", "type.compact", "space.1", "space.2", "space.3", "radius.round", "radius.none", ...STYLE_TOKENS],
    preferredSize: { width: 540, height: 76 }, sample: { heading: "(Insert chart title)", unit: "(Insert unit)" },
    variants: { underlined: {}, unit: { props: { unit: "Revenue share, %" } } }, defaultVariant: "underlined", variantProp: "variant", resolveVariant: resolveChartTitleVariant,
    measureContent: ({ frame, props }) => chartTitleLayout(frame, props),
    measureHeader: ({ frame, props }) => {
      const layout = chartTitleLayout(frame, props);
      return { top: frame.y, ruled: layout.ruled, height: layout.contentHeight };
    },
    render: input => ({ nodes: chartTitleNodes(input) })
  });
  return registry;
}
