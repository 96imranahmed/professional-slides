// The pages words carry: a statement panel beside its support
// (`sidebarPage`), and a page of words alone (`textPage`) - developed points
// as a ledger, in columns or in rows, a memo's prose beside its panel, or a
// document's columns of prose.
import { textWords, proseParts } from "./text-contract.mjs";
import { SIZE, PANEL_MIN_WIDTH, BODY_WIDTH, COLUMN_GAP, HUG, deckDensity } from "./compose-body.mjs";
import { proseOf, proseBeside, proseFillRange, pointsItem, documentItem, summaryLedger, sideTreatment } from "./compose-points.mjs";
import { exhibitItem } from "./compose-exhibits.mjs";
import { sideStatementLayout } from "./figures.mjs";

// The width prose beside a panel may take at most: the body less the gap and the least the panel keeps.
const PROSE_ROOM = BODY_WIDTH - COLUMN_GAP - PANEL_MIN_WIDTH;
// A panel beside an exhibit or points takes a quarter of the row where its
// statement sets there in its eight lines, and a third only where it needs
// it: a claim of twenty-odd words in a third of the page is a dark band of
// air beside an exhibit that wanted the width. It is measured a tenth
// narrower than the quarter, so a design's gap or margin cannot push the
// statement past its eight lines once it is set.
const QUARTER = 0.9 * (BODY_WIDTH - COLUMN_GAP) / 4;
const fitsQuarter = (props) => { try { sideStatementLayout({ x: 0, y: 0, width: QUARTER, height: BODY_WIDTH }, props); return true; } catch { return false; } };

/**
 * For a page that is prose beside its panel and nothing else - a memo, or a
 * rail page of paragraphs - the words of prose that fill the column the
 * composer sets them in (compose-points.mjs proseFillRange), at the page's
 * `density`, or null for any other page. `most` is the most words of prose
 * the page's word ceiling leaves it.
 */
export function proseFill(slide, density, most) {
  const paragraphs = (slide?.paragraphs || []).filter((p) => proseParts(p).text.trim());
  const beside = typeof slide?.panel?.text === "string" && slide.panel.text.trim() && paragraphs.length && !(slide.points || []).length && !slide.exhibit && !(slide.exhibits || []).length;
  return beside ? proseFillRange(paragraphs, PROSE_ROOM, density, most) : null;
}

// A side panel carrying the page's statement, the content beside it: a
// strong deck sets a question, a claim or a headline figure in a dark panel down
// the left and lets the evidence or the points take the rest. The panel is
// the reading; what sits beside it is the support.
export function sidebarPage(items, { id, slide, exhibits, baseDir, fill, pointsStyle }) {
  const panel = slide.panel;
  if (!panel || typeof panel.text !== "string" || !panel.text.trim()) throw new Error(`${id}: a sidebar page needs \`panel: { text }\`, the statement the panel carries`);
  const tone = panel.tone ?? "dark";
  if (!["dark", "primary", "muted", "tint"].includes(tone)) throw new Error(`${id}: panel.tone is dark, primary, muted or tint`);
  const panelBox = { id: `${id}-panel`, component: "side-statement", props: { text: panel.text.trim(), tone, ...(panel.kicker ? { kicker: panel.kicker } : {}), ...(panel.highlight ? { highlight: panel.highlight } : {}) },
    size: { width: { fr: 1 }, height: "fill" } };
  const body = [];
  exhibits.forEach((ex, i) => body.push(exhibitItem(ex, `${id}-exhibit-${i}`, baseDir, SIZE)));
  if (slide.points?.length) body.push(pointsItem(slide.points, `${id}-points`, "open", fill, !exhibits.length, pointsStyle));
  body.push(...proseOf(slide, id));
  if (!body.length) throw new Error(`${id}: a sidebar page needs an exhibit, points or paragraphs beside its panel`);
  // The copy starts level with the panel's top edge. Centred beside a
  // full-height panel, three paragraphs sit under 125px of air with as much
  // again below them. Prose alone is sized to reach the foot at a readable
  // measure (proseBeside) and the panel takes the rest; in two thirds of the
  // row it would stop at the measure, 165px short of its column's edge.
  const proseOnly = !exhibits.length && !slide.points?.length;
  items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [panelBox,
    proseOnly ? proseBeside(slide.paragraphs, id, PROSE_ROOM, slide.highlight, slide.density ?? deckDensity())
      : { id: `${id}-body`, layout: "flow.column", size: { width: { fr: fitsQuarter(panelBox.props) ? 3 : 2 }, height: "fill" }, items: body }] });
}

// A page of words alone: its points in a ledger, columns or rows, a memo's prose beside its panel, or a document's columns.
export function textPage(items, { id, slide, fill, pointsStyle }) {
  const points = slide.points || [];
  const tone = sideTreatment(slide);
  // Developed points run in columns rather than across the body: one list
  // the width of the page sets an executive summary's four findings at 160
  // characters a line, with a band of air under the last one. Three points
  // take three columns; four take two rows of two, each row a band of the
  // body so the second pair starts level; five and more take two columns.
  const developed = points.length >= 3 && !(slide.paragraphs || []).length
    && points.every((point) => textWords(typeof point === "string" ? point : point?.text) >= 20);
  const numberedAt = (point, at) => (pointsStyle !== "numbered" ? point
    : typeof point === "string" ? { text: point, number: at + 1 } : point?.number === undefined ? { ...point, number: at + 1 } : point);
  const cell = (point, at) => pointsItem([numberedAt(point, at)], `${id}-points-${String.fromCharCode(97 + at)}`, tone, fill, false, pointsStyle);
  const led = points.every((point) => point && typeof point === "object" && typeof point.lead === "string" && point.lead.trim());
  if (developed && led && (points.length === 4 || (points.length === 3 && slide.role === "executive-summary"))) {
    items.push(summaryLedger(points.map(numberedAt), { id, tone, pointsStyle }));
  } else if (developed && points.length === 3) {
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: points.map(cell) });
  } else if (developed && points.length === 4) {
    // Each pair centres in its half of the body, a hairline between the
    // halves: the slack the pairs leave is a margin around each, not one
    // band of air between them.
    const half = (r) => ({ id: `${id}-grid-${r}`, layout: "flow.column", leftover: "center", size: SIZE, items: [
      { id: `${id}-grid-${r}-pair`, layout: "flow.row", size: HUG, items: [cell(points[r * 2], r * 2), cell(points[r * 2 + 1], r * 2 + 1)] }] });
    items.push({ id: `${id}-grid`, layout: "flow.column", size: SIZE, items: [half(0),
      { id: `${id}-grid-rule`, component: "section-boundary", props: { variant: "subsection" }, size: { width: { fr: 1 }, height: 16 } }, half(1)] });
  } else if (points.length > 4 || developed) {
    const half = Math.ceil(points.length / 2);
    // Two columns, one list. A numbered list that restarts at 1 in the right
    // column reads as two unrelated lists of points rather than one ranked
    // set of five, so the numbers are fixed to each point's place in the
    // whole before the list is cut in half.
    const ordered = pointsStyle === "numbered"
      ? points.map((point, at) => {
          const item = typeof point === "string" ? { text: point } : { ...point };
          return item.number === undefined ? { ...item, number: at + 1 } : item;
        })
      : points;
    // The two columns own the track they sit in. Hugging the top of a text
    // page leaves a third of it empty under the shorter column, which is the
    // void the ink gate reports on a page that carries five real findings.
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [
      pointsItem(ordered.slice(0, half), `${id}-points-a`, tone, fill, true, pointsStyle, false),
      pointsItem(ordered.slice(half), `${id}-points-b`, tone, fill, true, pointsStyle, false),
    ] });
  } else if (points.length) {
    // A text page's sole list owns the remaining body track. Letting it hug
    // pins it below a metrics strip (or above a closing band), pooling all
    // the spare height into one internal void. A list followed by authored
    // paragraphs still shares the track and keeps its natural height.
    items.push(pointsItem(points, `${id}-points`, tone, fill,
      !(slide.paragraphs || []).length, pointsStyle));
  }
  // A memo: the prose first at a readable measure, sized to reach the foot
  // (proseBeside), and its panel - the conclusion or the figures to keep -
  // down the right in the tint. Without the panel, one to three equal
  // columns are more than a text page's word ceiling can fill.
  const memo = slide.panel && (slide.paragraphs || []).length && !points.length;
  if (memo) {
    const panel = slide.panel;
    if (typeof panel.text !== "string" || !panel.text.trim()) throw new Error(`${id}: a memo's \`panel\` carries \`text\`, the conclusion the reader keeps`);
    const tone = panel.tone ?? "tint";
    if (!["dark", "primary", "muted", "tint"].includes(tone)) throw new Error(`${id}: panel.tone is dark, primary, muted or tint`);
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [
      proseBeside(slide.paragraphs, id, PROSE_ROOM, slide.highlight, slide.density ?? deckDensity()),
      { id: `${id}-panel`, component: "side-statement", props: { text: panel.text.trim(), tone, ...(panel.kicker ? { kicker: panel.kicker } : {}), ...(panel.highlight ? { highlight: panel.highlight } : {}) },
        size: { width: { fr: 1 }, height: "fill" } }] });
  }
  const document = memo ? null : documentItem(slide, id, points.length);
  if (document) items.push(document);
  else if (!memo) items.push(...proseOf(slide, id));
}
