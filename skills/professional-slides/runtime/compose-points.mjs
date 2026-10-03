// The page's words beside and under its evidence: points lists and their
// styles (`pointsItem`, `resolvePointsStyle`), points set in rows, prose and
// document columns, the summary ledger, the side column's tone and the bridge
// drawn to it, the so-what close, and how full a page should read (`fill`).
import { resolveDensityTokens, TOKENS } from "./core.mjs";
import { activeDesignTokens, withDesignTokens } from "./design-context.mjs";
import { textWords } from "./text-contract.mjs";
import { measureProse, proseMeasure, measureList } from "./registry-text.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";
import { HUG, SIZE, BODY_HEIGHT, LAYOUT, BODY_WIDTH } from "./compose-body.mjs";

// A paragraph of the page's prose. It carries the phrase to set in the
// accent (the page's highlight, or its point's) and, where a point's lead
// runs into its sentence, the lead to set in bold; the component cuts the
// runs itself (registry-text.mjs paragraphRuns), so every paragraph a page draws
// takes its emphasis one way, wherever it was built.
export const paragraph = (id, text, highlight, props = {}) => ({ id, component: "paragraph", props: { text, ...(highlight == null ? {} : { highlight }), ...props }, size: HUG });
/** The page's authored `paragraphs`, each carrying the page's highlight. */
export const proseOf = (slide, id) => (slide.paragraphs || []).map((text, at) => paragraph(`${id}-p${at}`, text, slide.highlight));
// Points set in columns run up to three across, four two by two and more
// three across, reading along each row: four across the body are 270px
// columns, under the measure prose needs, and fail CPL for a placement
// that is sound. `most` is the row's limit on a narrower track.
export const pointsPerRow = (count, most = 3) => (count <= most ? count : count === 4 ? 2 : most);
/** Point columns in rows of `pointsPerRow`: one row, or a column of rows `${rowId}-${r}`. */
export function pointColumns(columns, rowId, most) {
  const perRow = pointsPerRow(columns.length, most), rows = [];
  for (let at = 0; at < columns.length; at += perRow) rows.push(columns.slice(at, at + perRow));
  return rows.length === 1 ? { layout: "flow.row", items: columns }
    : { layout: "flow.column", items: rows.map((row, r) => ({ id: `${rowId}-${r}`, layout: "flow.row", size: HUG, items: row })) };
}

// Words of prose one column carries before a document page opens a second.
// A single column is capped at a readable measure of about 600px, so past a
// hundred words or so it leaves the right half of the page standing empty; a
// report designer opens the second column there rather than letting one
// narrow column run down the left.
const DOCUMENT_COLUMN_WORDS = 110;

/**
 * A text page carrying only prose: the paragraphs flow from the top, in one to
 * three columns, as a report page sets them. Pushed one by one into the page's
 * body column, which spreads leftover height between its items, two paragraphs
 * sit pinned to the top and the foot of the page with the body empty between
 * them.
 */
export function documentItem(slide, id, pointCount) {
  const paragraphs = slide.paragraphs || [];
  if (!paragraphs.length || pointCount) return null;
  const total = paragraphs.reduce((sum, p) => sum + textWords(p), 0);
  const asked = slide.textColumns;
  if (asked !== undefined && ![1, 2, 3].includes(asked)) throw new Error(`${id}: textColumns is 1, 2 or 3`);
  const count = Math.min(asked ?? Math.min(3, Math.ceil(total / DOCUMENT_COLUMN_WORDS)), paragraphs.length) || 1;
  const columns = balancedColumns(paragraphs, count);
  const column = (texts, c) => ({ id: `${id}-doc-${c}`, layout: "flow.column", gap: "space.4",
    size: { width: { fr: 1 }, height: "fill" },
    items: texts.map((text, i) => paragraph(`${id}-doc-${c}-p${i}`, text, slide.highlight)) });
  return { id: `${id}-document`, layout: "flow.row", textFlow: "columns", gap: "space.6", size: SIZE,
    items: columns.filter((texts) => texts.length).map(column) };
}

/** Paragraphs into `count` columns balanced by words, whole and in reading order. */
function balancedColumns(paragraphs, count) {
  const total = paragraphs.reduce((sum, p) => sum + textWords(p), 0);
  const columns = Array.from({ length: count }, () => []);
  let at = 0, filled = 0;
  for (const text of paragraphs) {
    if (at < count - 1 && filled >= total * (at + 1) / count) at += 1;
    columns[at].push(text); filled += textWords(text);
  }
  return columns.filter((texts) => texts.length);
}

// The depth prose may reach: the body less a line, so a two-line title (a
// body some 14px shorter) still takes it; and the depth that reads as a full
// column, some 70px above the foot, well inside the column check's bar. The
// gaps are the document columns' own (space.4 between paragraphs, space.6
// between columns).
const PROSE_DEPTH = 488, PROSE_FULL = 440, PROSE_PARAGRAPH_GAP = 16, PROSE_COLUMN_GAP = 32;

/**
 * Prose beside a panel, in one column or two, each as narrow as lets the
 * prose reach the foot of the body and no wider than a paragraph's measure;
 * the panel beside it takes the rest of the width. `room` is the width the
 * prose may take at most.
 *
 * A fixed share of the row does not fit prose: a memo in two equal columns
 * needs some 500 words to reach the foot, against a text page's ceiling of
 * 329, and a sidebar's copy in two thirds of the row stops at the paragraph's
 * measure, 165px short of its column's right edge. Sized to the text, 150 to
 * 330 words fill the page: one column from the measure's floor (45
 * characters) to its cap (80), and two when one at the cap runs past the foot.
 */
export function proseBeside(paragraphs, id, room, highlight) {
  const { widest, narrowest } = proseMeasure();
  const depth = (texts, width) => texts.reduce((sum, text) => sum + measureProse(text, width), 0) + PROSE_PARAGRAPH_GAP * (texts.length - 1);
  // One column, or two broken where the deeper of them is shallowest at that
  // width: between paragraphs, or inside one at a sentence, as a column of
  // type runs on. Balanced by whole paragraphs alone, 91, 71 and 94 words go
  // left and 78 right, and the right column stops a quarter of the page short.
  const sentences = (text) => text.split(/(?<=[.!?])\s+(?=[A-Z0-9£$€"“])/);
  const breaks = paragraphs.flatMap((text, at) => {
    const parts = sentences(text);
    const whole = at ? [[paragraphs.slice(0, at), paragraphs.slice(at)]] : [];
    return [...whole, ...parts.slice(1).map((_, cut) => [
      [...paragraphs.slice(0, at), parts.slice(0, cut + 1).join(" ")],
      [parts.slice(cut + 1).join(" "), ...paragraphs.slice(at + 1)]])];
  });
  const deepest = (columns, width) => Math.max(...columns.map((texts) => depth(texts, width)));
  const split = (count, width) => count === 1 || !breaks.length ? [paragraphs]
    : breaks.reduce((best, columns) => (deepest(columns, width) < deepest(best, width) ? columns : best));
  const most = (count) => Math.min(widest, Math.floor((room - PROSE_COLUMN_GAP * (count - 1)) / count));
  const counts = breaks.length ? [1, 2] : [1];
  // Of the widths at which the prose fits, the widest that still reaches
  // PROSE_FULL: the narrowest that fits can put 263 words in a 474px column
  // beside a panel half as wide again, the prose reading as the aside. Prose
  // too short to reach it at any width takes the narrowest, its deepest.
  let chosen = null;
  for (const count of counts) {
    const fits = [];
    for (let width = Math.min(narrowest, most(count)); width <= most(count); width += 8) {
      const columns = split(count, width), reach = deepest(columns, width);
      if (reach <= PROSE_DEPTH) fits.push({ columns, width, reach });
    }
    chosen = fits.filter((fit) => fit.reach >= PROSE_FULL).at(-1) ?? fits[0] ?? null;
    if (chosen) break;
  }
  // Longer than two columns at the measure hold: the widest, and the overflow
  // is the layout's to report.
  if (!chosen) chosen = { columns: split(counts.at(-1), most(counts.at(-1))), width: most(counts.at(-1)) };
  const { columns, width } = chosen;
  const column = (texts, c) => ({ id: `${id}-doc-${c}`, layout: "flow.column", gap: "space.4", size: { width, height: "fill" },
    items: texts.map((text, i) => paragraph(`${id}-doc-${c}-p${i}`, text, highlight)) });
  return { id: `${id}-document`, layout: "flow.row", textFlow: "columns", gap: "space.6",
    size: { width: columns.length * width + PROSE_COLUMN_GAP * (columns.length - 1), height: "fill" }, items: columns.map(column) };
}

/**
 * The bridge between the evidence and what is read off it, in the gutter.
 *
 * A well-made deck carries this relation four or five different ways and draws
 * it in the gutter on very few pages. One page sets the right-hand heading to
 * say the relation in words ("As a result of piracy and internationalization")
 * and puts nothing between the columns. A diagnostic runs "KEY FACTS AND DATA"
 * against a bordered "PERSPECTIVES" panel, ten pages running, with no mark in
 * the gutter at all. A plain comparison leaves white space. Another page closes
 * the exhibit with a filled band underneath it. The dashed rule with a disc on it
 * is one member of that set, not the house style: a deck that draws it on every
 * page has made the reader stop seeing it, and the pages where the inference is
 * genuinely authored no longer stand out.
 *
 * So `implication` names which bridge the page wants rather than switching one
 * on. `true` is the dashed rule.
 */
export const BRIDGE_VARIANTS = new Map([
  [true, "divider-chevron"], ["divider-chevron", "divider-chevron"],
  ["chevron", "disc-chevron"], ["rule", "divider"], ["arrow", "arrow"],
  [false, null], ["none", null], [undefined, null], [null, null],
]);
/**
 * The values `implication` accepts, in the order the guidance presents them.
 *
 * Named once here, for the error message and the references alike;
 * `test_authoring_surface` checks the docs list exactly these.
 */
export const IMPLICATION_NAMES = Object.freeze(["divider-chevron", "arrow", "chevron", "rule"]);

export function bridgeVariant(slide, id) {
  const asked = slide.implication;
  if (!BRIDGE_VARIANTS.has(asked)) {
    throw new Error(`${id}: unknown implication ${JSON.stringify(asked)}; use `
      + IMPLICATION_NAMES.map((name) => JSON.stringify(name)).join(", ") + " or false. "
      + "A relation stated in the commentary's heading, or in a `pointsTone` panel, or in a closing `soWhat` band, needs no gutter mark at all");
  }
  return BRIDGE_VARIANTS.get(asked);
}
const LIST_BODY_PX = 14, LIST_ITEM_GAP = 16, LIST_LEAD_GAP = 4, LIST_MARKER_OFFSET = 22;
/**
 * A composed points list's height at a width, by the list's own measure, at
 * the page's density: a pre-read page sets its points a size smaller than the
 * deck's tokens say, and measured at the deck's size a column reads as deep
 * enough and stops a fifth of the page short of its foot.
 */
export function listDepth(list, width, density) {
  const measure = () => { try { return measureList({ x: 0, y: 0, width, height: BODY_HEIGHT }, list.props); } catch { return pointsHeight(list.props.items, width); } };
  return density && density !== "executive" ? withDesignTokens(resolveDensityTokens(activeDesignTokens() ?? TOKENS, density), measure) : measure();
}

/** The height a points list wants at a given column width. */
function pointsHeight(points, width) {
  const textWidth = Math.max(60, width - LIST_MARKER_OFFSET);
  let total = 0;
  (points || []).forEach((point, index) => {
    const object = point && typeof point === "object";
    const lead = object && point.lead ? measureText(String(point.lead), textWidth, { fontFamily: "Arial", fontSize: LIST_BODY_PX, bold: true, wrapWidthRatio: ENGINE_RESERVE }) : null;
    const text = String(object ? point.text ?? "" : point ?? "");
    const body = text ? measureText(text, textWidth, { fontFamily: "Arial", fontSize: LIST_BODY_PX, wrapWidthRatio: ENGINE_RESERVE }) : null;
    total += (lead ? lead.height + (body ? LIST_LEAD_GAP : 0) : 0) + (body ? body.height : 0);
    if (index < (points || []).length - 1) total += LIST_ITEM_GAP;
  });
  return total;
}

/**
 * The shapes a commentary column can take.
 *
 * In a well-made deck the numbered disc is one device among six, and it is used for a full-width ledger of one-line items rather
 * than for a three-item side column. A composer with one shape sets page after
 * page of identical numbered lists; these are the alternatives a strong deck
 * actually uses. Markers follow the authored relationship.
 */
const POINT_STYLES = {
  // Icon, then the lead running into the sentence in the house accent.
  "icon-lead": { marker: "icon", inlineLead: true },
  // The icon in a ring, the lead above its own text: for points that each
  // carry their own evidence.
  "icon-framed": { marker: "icon-ring" },
  // A bold lead and its paragraph, nothing in the gutter.
  prose: { marker: "none" },
  // A hairline between items instead of a mark beside them.
  ruled: { marker: "rule" },
  // A / B / C: options, not steps.
  lettered: { marker: "letter" },
  // The numbered disc, which a strong deck reserves for an ordered ledger.
  numbered: { marker: "number" },
  // The plain house bullet.
  bulleted: { marker: "auto" },
  // A box per item: questions to answer, criteria to meet. An item may set
  // `state: "yes"` or `"no"` once it is judged; unset, the box stays open.
  checklist: { marker: "check" },
};

export const POINT_STYLE_NAMES = Object.freeze(Object.keys(POINT_STYLES));

/**
 * Honour the author, then choose markers from the content semantics.
 */
export function resolvePointsStyle(slide, points) {
  if (slide.pointsStyle) {
    if (!POINT_STYLES[slide.pointsStyle]) throw new Error(`Unknown pointsStyle: ${slide.pointsStyle}; use one of ${POINT_STYLE_NAMES.join(", ")}`);
    return slide.pointsStyle;
  }
  const entries = points.map((point) => (typeof point === "string" ? { text: point } : point || {}));
  // Content decides first, where it speaks clearly.
  if (entries.some((e) => e.icon)) return "icon-lead";
  if (entries.some((e) => e.state)) return "numbered";
  if (entries.every((e) => e.number !== undefined)) return "numbered";
  if (!entries.some((e) => e.lead)) return "bulleted";
  // Parallel findings have no implied order or invented icon. A varied deck
  // marks them one of two unordered ways, the same way on every page.
  return LAYOUT.variation?.leadPoints ?? "prose";
}

export function pointsItem(points, id, tone, fill, inColumn = false, style = null, centre = false) {
  // The side column is a track, not a shelf: its points spread down it. A list
  // that hugs the top of a 500px column leaves two fifths of it empty, which is
  // how a page carrying real content still reads as thin. A list under a row of
  // exhibits hugs instead — there it is a footer, not a column.
  //
  // The gap opens to its cap on every deck, airy included: white space between
  // the points is what "airy" means; all of it pooled under the last one is
  // just an unfinished page.
  //
  // What the cap leaves over stays at the foot: the list starts at the top of
  // its track. Centred, a list under a kpi or an insight floats away from the
  // thing it reads from, the halves of a two-column split land on different
  // tops, and a list that owns its track carries a band of air above its first
  // point as tall as the one under its last. `centre: true` is for an author
  // who asked for the middle (`pointsAlign`).
  const distribute = inColumn && points.length > 1;
  const shape = style && POINT_STYLES[style] ? POINT_STYLES[style] : {};
  if (style === "checklist") points = points.map((p) => {
    const item = typeof p === "string" ? { text: p } : { ...p };
    return item.state === undefined ? { ...item, state: "open" } : item;
  });
  return { id, component: "bullet-list", props: { variant: "body", items: points, ...shape, ...(tone === "dark" || tone === "primary" ? { tone: "inverse" } : {}), ...(distribute ? { distribute: true, ...(centre ? {} : { centre: false }) } : {}) }, size: distribute ? { width: { fr: 1 }, height: "fill" } : HUG };
}

/**
 * A summary's developed points as a ledger: one row a finding, its lead as a
 * side head and its statement beside it at a reading measure, a hairline
 * between rows, and the rows spread down the body so the page is read to its
 * foot.
 *
 * Four findings set two by two sit as two pairs, each centred in half the
 * body, with a band of air a third of the body tall between the pairs.
 * Stacked, the same words reach from the rule under the title to the footer,
 * the gaps between rows are the only air, and a reader takes the findings in
 * order.
 */
const LEDGER_HEAD_WIDTH = 264, LEDGER_GAP = "space.6";
export function summaryLedger(points, { id, tone, pointsStyle }) {
  // The statement's measure: the widest a paragraph runs to, which holds it
  // under the points' CPL bar.
  const measure = Math.min(BODY_WIDTH - LEDGER_HEAD_WIDTH - 32, Math.round(proseMeasure().widest * 0.98));
  const inverse = tone === "dark" || tone === "primary" ? { tone: "inverse" } : {};
  const numbered = pointsStyle === "numbered";
  const rows = points.map((point, at) => {
    const { lead, points: parts, ...said } = point;
    const head = { id: `${id}-ledger-${at}-head`, component: "bullet-list",
      props: { variant: "body", marker: numbered ? "number" : "none", items: [{ lead, ...(numbered ? { number: point.number ?? at + 1 } : {}), ...(point.highlight ? { highlight: point.highlight } : {}) }], ...inverse },
      size: { width: LEDGER_HEAD_WIDTH, height: "hug" } };
    const body = { id: `${id}-ledger-${at}-text`, component: "bullet-list",
      props: { variant: "body", marker: "none", items: [{ ...said, ...(parts ? { points: parts } : {}) }], ...inverse },
      size: { width: measure, height: "hug" } };
    return { id: `${id}-ledger-${at}`, layout: "flow.row", gap: LEDGER_GAP, size: { width: { fr: 1 }, height: "hug" }, items: [head, body] };
  });
  const rule = (at) => ({ id: `${id}-ledger-rule-${at}`, component: "section-boundary", props: { variant: "subsection" }, size: { width: { fr: 1 }, height: 16 } });
  return { id: `${id}-ledger`, layout: "flow.column", leftover: "distribute", size: SIZE,
    items: rows.flatMap((row, at) => (at ? [rule(at), row] : [row])) };
}

/**
 * How full a page should read. `fill` on the deck: "full" (the pre-read page —
 * the side column's points spread down the column and the gates want more ink),
 * "balanced" (the default working page) or "airy" (a live-pitch page, where
 * white space is the point and the gates relax). Absent, it follows the density:
 * pre-read and appendix fill, live-pitch is airy, executive is balanced.
 */
export const FILL_LEVELS = Object.freeze(["full", "balanced", "airy"]);
export function resolveFill(spec = {}) {
  if (spec.fill !== undefined) {
    if (!FILL_LEVELS.includes(spec.fill)) throw new Error(`Unknown fill: ${spec.fill}; use one of ${FILL_LEVELS.join(", ")}`);
    return spec.fill;
  }
  return { "pre-read": "full", appendix: "full", "live-pitch": "airy" }[spec.density] ?? "balanced";
}

/**
 * `pointsTone`: the side column as a panel — "dark" (a navy "Key insights"
 * column, white text), "muted" (grey commentary), "tint" (accent-tinted
 * message) or "primary". Absent, the column is open with a rule.
 */
const POINTS_TONES = ["open", "dark", "muted", "tint", "primary"];
export function sideTreatment(slide) {
  const asked = slide.pointsTone ?? "open";
  if (!POINTS_TONES.includes(asked)) throw new Error(`Unknown pointsTone: ${asked}; use one of ${POINTS_TONES.join(", ")}`);
  // The design system translates a panel into its own grammar: the editorial
  // page has no navy column, the journal no coloured one, and the keynote
  // turns the navy column into its colour field.
  return LAYOUT.panelTones?.[asked] ?? asked;
}

const TAKEAWAY_VARIANT = { band: "tonal", rule: "rule", statement: "statement", standfirst: "rule" };

/**
 * The page's close, under everything else.
 *
 * One sentence is the tonal band. A list is the other common closing
 * device: two or three square-bulleted lines on a muted surface under a dense
 * table, each carrying its own finding, rather than one long band that says
 * three things in a row.
 */
export function soWhatItem(text, id, highlight, tinted = true) {
  const accent = highlight === undefined || highlight === null ? {} : { highlight };
  // `{ text, style: "bar" }`: the so-what bar, a band in the house colour with
  // the implication in bold white across the foot of the exhibit. It is a
  // different device from the closing line - the page's commentary lives in
  // it, not after it - so it is drawn the same way in every design system,
  // and it stays filled beside a callout: it is the page's one box.
  if (text && typeof text === "object" && !Array.isArray(text)) {
    if (text.style !== "bar" || typeof text.text !== "string" || !text.text.trim()) throw new Error("A soWhat object is the so-what bar: { text, style: \"bar\" }");
    return { id, component: "insight", props: { text: text.text.trim(), variant: "primary", ...accent }, size: HUG };
  }
  // One tinted box per page. A callout is already a tinted box saying "read
  // this"; a second one underneath in a different tint reads as two competing
  // boxes rather than as a page with a close, which is what a reviewer sees
  // first and cannot explain.
  // A design whose takeaway is not a box closes the page its own way.
  if (LAYOUT.takeaway !== "band" && !Array.isArray(text)) return { id, component: "insight", props: { text, variant: TAKEAWAY_VARIANT[LAYOUT.takeaway], ...accent }, size: HUG };
  if (!tinted) {
    const plain = Array.isArray(text) ? { items: text } : { text };
    return { id, component: "insight", props: { ...plain, variant: "plain", ...accent }, size: HUG };
  }
  if (Array.isArray(text)) {
    if (!text.length) throw new Error("A soWhat list needs at least one line");
    if (text.length > 3) throw new Error("A soWhat list carries at most three lines; the rest belongs in the page");
    return { id, component: "insight", props: { items: text, variant: "tonal", ...accent }, size: HUG };
  }
  return { id, component: "insight", props: { text, variant: "tonal", ...accent }, size: HUG };
}
