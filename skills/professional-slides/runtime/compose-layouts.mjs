// The page shapes the composer can build for an analytical page, how well
// each fits what the slide carries (`PAGE_SHAPES`), and the choice among
// them (`chooseLayout`): fit first, then the shape used least recently, with
// the design system's bias and the deck's variation order applied.
import { LAYOUT } from "./compose-body.mjs";

/**
 * The page shapes the composer can build, and what each one wants.
 *
 * A well-made deck runs about five distinct
 * page shapes per ten analytical pages and never lets one shape past a quarter
 * of the deck. A chooser that short-circuits - one exhibit plus any commentary
 * returns `exhibit-left` - catches almost every page on one shape.
 *
 * So the choice is scored rather than short-circuited. `fit` says how well a
 * shape suits what the page carries; a shape the page cannot support scores 0
 * and is never chosen. Among the shapes that fit *equally well*, the one used
 * least recently wins, which is what spreads a section across its repertoire.
 *
 * Fit comes first and staleness only breaks the tie: a shape fitting at 3
 * never beats one fitting at 4 because the better fit was used two pages
 * earlier, which would send a work profile to `picture-hero` or a boundary
 * comparison to `two-up`. Variety is worth having and it is not worth a page
 * taking the wrong shape for it - and the variety a reader actually sees is in
 * the *exhibit*, which `exhibitVarietyPerTen` measures, not in which side of
 * the page the table sits on.
 */
const PAGE_SHAPES = {
  // One exhibit, commentary beside it. The workhorse.
  "exhibit-left": { fit: (s, ex) => (ex.length === 1 && hasCommentary(s) && !needsFullWidth(ex[0]) ? 3 : 0) },
  // The mirror, and never chosen for you. The evidence goes on the left and
  // what it means on the right, on every page, because a reading order a reader
  // can rely on is worth more than the variety of not having one. Scored equal
  // to `exhibit-left`, it would be picked whenever `exhibit-left` was the
  // staler of the two, and a deck of table pages would mirror itself down a
  // section with nothing in the content to explain the change. It stays
  // authorable as `layout: "exhibit-right"` for the page that genuinely reads
  // the other way.
  "exhibit-right": { fit: () => 0 },
  // The exhibit across the full width with the commentary in columns beneath
  // it: the commonest well-made shape, and the right one when the exhibit is
  // wide (many categories) or the commentary divides into parallel points.
  "exhibit-top": {
    fit: (s, ex) => {
      if (ex.length !== 1 || !Array.isArray(s.points) || s.points.length < 2 || s.points.length > 4) return 0;
      if (s.photo || s.kpi || s.insight || s.insights) return 0;
      // The columns under the exhibit set each point as a paragraph with its
      // lead, which carries no marker. A page that asked for icons, numbers,
      // letters or boxes keeps the side column that draws them: chosen on
      // variety, this shape would drop the icons of an icon-framed page.
      if (["icon-lead", "icon-framed", "numbered", "lettered", "checklist"].includes(s.pointsStyle)) return 0;
      // A `compare` exhibit is already two columns arguing with each other; its
      // commentary belongs beside it, not stacked underneath.
      if (["compare", "quadrants", "swot", "matrix"].includes(ex[0].type)) return 0;
      // exhibit-top trades height for width. A chart that places its labels by
      // searching for a clear position - a scatter, a bubble plot - runs out of
      // positions when the plot shortens, so it keeps the taller frame.
      if (["chart.scatter", "chart.bubble", "chart.bubble-grid"].includes(ex[0].type)) return 0;
      // Each annotation row - period bands, a change marker, events - is taken
      // out of the plot's height before a bar is drawn; with two of them the
      // shortened frame leaves no plot to annotate.
      if ([ex[0].periods?.length, ex[0].change || ex[0].changeAnnotations?.length, ex[0].events?.length].filter(Boolean).length >= 2) return 0;
      // It fits as well as the side column does, never better: a page composed
      // on its own keeps the established shape, and the variety comes from
      // alternating across the deck rather than from a new monoculture.
      return 3;
    },
  },
  // One enormous figure with its explanation, one supporting exhibit beside it.
  // For the page whose whole argument is a single number.
  "hero-number": { fit: (s, ex) => (s.kpi && ex.length === 1 && !s.photo ? (s.points?.length ? 3 : 4) : 0) },
  // Half the page on a tinted ground, half on the canvas: a comparison that
  // genuinely has two sides, rather than evidence and its meaning.
  "split-tone": {
    fit: (s, ex) => (ex.length === 2 && !s.points?.length && !s.kpi
      && ex.every((e) => typeof e.caption === "string" && e.caption.trim()) ? 4 : 0),
  },
  // Two exhibits side by side, each captioned, no shared column.
  "two-up-contrast": { fit: (s, ex) => (ex.length === 2 && !s.points?.length && !s.kpi ? 3 : 0) },
  "two-up": { fit: (s, ex) => (ex.length >= 2 ? 3 : 0) },
  // Stacking halves each panel's height, which a chart with an annotation band
  // cannot always take. It is reachable from `arrange: "stack"` and from the
  // auto-stack rule above (two charts on one category set), both of which know
  // the panels fit - so it is never chosen on score alone.
  "stack": { fit: () => 0 },
  "grid": { fit: (s, ex) => (ex.length >= 4 ? 4 : 0) },
  "exhibit-full": { fit: (s, ex) => (ex.length === 1 && (!hasCommentary(s) || needsFullWidth(ex[0])) ? 3 : 0) },
  // A row of measures across the top, and the evidence they summarise beneath.
  // The strip goes above whatever the layout puts below it; named, the page is
  // one the chooser can spread a deck across and a plan can ask for. What sits
  // underneath is *any* exhibit: it is as much a chart given the full width
  // and the leftover height as it is a table.
  "metrics-over-exhibit": {
    fit: (s, ex) => (ex.length === 1 && Array.isArray(s.metrics) && s.metrics.length
      && s.metricsPosition !== "bottom" && !hasCommentary(s) ? 4 : 0),
  },
  // A long, narrow table cut down the middle and set as two panels side by
  // side, each with its own header: the classic ranking page. Twelve
  // rows down the centre of a 1160px body leaves half the page empty and makes
  // the reader scan a column three times its natural length.
  "table-halves": { fit: (s, ex) => (ex.length === 1 && !hasCommentary(s) && halvable(ex[0]) ? 3 : 0) },
  // The picture-led shapes. Two named things side by side, three to five across
  // a strip, or one subject holding half the page: the architectures the plan's
  // anchor rule sends a page to once it has decided the thing is depictable.
  "picture-pair": { fit: (s) => (pictureCount(s) === 2 ? 4 : 0) },
  "picture-strip": { fit: (s) => (pictureCount(s) >= 3 ? 4 : 0) },
  // The photograph page, named rather than recorded as `text`, so a deck's
  // variety measure sees that the page is a picture.
  "picture-hero": {
    fit: (s, ex) => (!ex.length && (pictureCount(s) === 1
      || (s.photo && (s.points?.length || s.paragraphs?.length))) ? 4 : 0),
  },
  "text": { fit: (s, ex) => (ex.length === 0 && !pictureCount(s) && !s.photo ? 3 : 0) },
};

const pictureCount = (slide) => (Array.isArray(slide?.pictures) ? slide.pictures.length : 0);

export const PAGE_SHAPE_NAMES = Object.freeze(Object.keys(PAGE_SHAPES));

const TABLE_LIKE_TYPES = ["table", "rows", "compare", "phase-table"];
export const hasCommentary = (s) => Boolean(s.points?.length || s.insight || s.insights?.length || s.kpi || s.paragraphs?.length);

/**
 * An exhibit that cannot survive being narrowed to two thirds of the page.
 *
 * A five-column table of sentences needs the full measure: squeezed into a
 * side-column layout its header words stop fitting their cells, which the
 * measurer refuses outright. The chooser has to know that before it picks the
 * shape, or a page that would have composed simply fails.
 */
function needsFullWidth(ex) {
  if (!ex) return false;
  // A timeline with many periods, a matrix, a map: exhibits whose horizontal
  // axis is the content and cannot be compressed.
  if (["gantt", "timeline", "roadmap", "map", "heatmap", "marimekko"].includes(ex.type)) return true;
  if (!TABLE_LIKE_TYPES.includes(ex.type)) return false;
  const columns = ex.columns || [];
  if (columns.length >= 5) return true;
  const cells = (ex.rows || []).flatMap((row) => (Array.isArray(row) ? row : row?.cells || []));
  const longest = Math.max(0, ...cells.map((cell) => String(cell?.text ?? cell ?? "").length));
  // Sentence-length cells starve the narrow label column when the table is
  // squeezed, and the header word stops fitting before the cell text does.
  return columns.length >= 3 && longest > 60;
}

/**
 * A table long enough to want halving and narrow enough to survive it.
 *
 * Halving doubles the column count and halves the width each column gets, so it
 * needs short cells and few of them: a ranking (rank, name, one measure), not a
 * findings matrix. Ten rows is where the single column starts running past the
 * page's natural reading length; three columns is where two panels plus their
 * gutter stop fitting the body width.
 */
function halvable(ex) {
  if (!ex || ex.type !== "table") return false;
  if (ex.split === false || ex.paginate === false) return false;
  const columns = ex.columns || [];
  const rows = ex.rows || [];
  if (columns.length > 3 || rows.length < 10) return false;
  // Grouped headers, total rows and row styles belong to one table read
  // top to bottom; cutting it in half puts the total in the middle of the page.
  if (ex.total === true || ex.total === "auto" || (ex.derive || []).length) return false;
  if (columns.some((c) => c && typeof c === "object" && (c.group || c.implication || c.bar || c.heat || c.bubble))) return false;
  if (rows.some((row) => !Array.isArray(row) && row?.style)) return false;
  const cells = rows.flatMap((row) => (Array.isArray(row) ? row : row?.cells || []));
  if (cells.some((cell) => cell && typeof cell === "object" && cell.type)) return false;
  return Math.max(0, ...cells.map((cell) => String(cell?.text ?? cell ?? "").length)) <= 28;
}

export function chooseLayout(slide, recent = []) {
  if (slide.layout === "text" && (slide.exhibit || slide.exhibits?.length)) throw new Error("A text layout cannot discard an authored exhibit; select an evidence layout");
  // A photograph beside text is the picture-hero page, which is what the
  // documentation promises a text page with a photo becomes; the text branch
  // draws the copy and not the picture.
  if (slide.layout === "text" && slide.photo) return "picture-hero";
  // An evidence layout with no evidence is refused here, naming the missing
  // piece, rather than failing deep in the row builder on `exhibits[0].type`.
  if (["exhibit-left", "exhibit-right", "exhibit-top", "exhibit-full"].includes(slide.layout)
      && !slide.exhibit && !slide.exhibits?.length) {
    throw new Error(`${slide.layout} places an exhibit beside or above the commentary, and this page has none. `
      + "Use layout: \"text\" for a page of commentary, with `photo` for a photograph beside it.");
  }
  if (slide.layout && slide.layout !== "auto") return slide.layout;
  const exhibits = slide.exhibits || (slide.exhibit ? [slide.exhibit] : []);
  // An explicit arrangement is the author overriding the choice, not a hint.
  if (slide.arrange === "stack") return "stack";
  if (slide.arrange === "sequence") return "sequence";
  if (slide.arrange === "row") return exhibits.length === 2 && !slide.points?.length ? "two-up-contrast" : "two-up";
  if (slide.arrange === "grid" || exhibits.length >= 4) return "grid";
  // Two charts on one category set with points beside them stack in the hero
  // column rather than shrinking into a three-way row.
  if (exhibits.length === 2 && slide.points?.length && exhibits.every((ex) => String(ex.type).startsWith("chart.")) && JSON.stringify(exhibits[0].categories) === JSON.stringify(exhibits[1].categories)) return "stack";

  // A design system leans toward the shapes its pages are built from: the
  // journal's full-width exhibit, the keynote's hero number. A bias only moves
  // a shape that already fits the page.
  const bias = LAYOUT.shapeBias || {};
  const scored = Object.entries(PAGE_SHAPES)
    // The variation's drawn lean is lighter: it favours a shape, but not on
    // the page straight after one, so the deck still alternates.
    .map(([name, shape]) => { const fit = shape.fit(slide, exhibits); const lean = LAYOUT.variation?.lean?.includes(name) && recent[0] !== name ? 1 : 0; return [name, fit > 0 ? fit + (bias[name] || 0) + lean : 0]; })
    .filter(([, score]) => score > 0);
  if (!scored.length) return exhibits.length ? "exhibit-full" : "text";
  const best = Math.max(...scored.map(([, score]) => score));
  // Shapes within one point of the best all suit the page, so the tie is broken
  // on variety: the one used longest ago. `recent` is most-recent-first.
  const viable = scored.filter(([, score]) => score >= best - 1).map(([name]) => name);
  if (viable.length === 1) return viable[0];
  // Staleness is how many pages ago the shape was used, capped so that "never
  // used" is a finite number and the comparison stays deterministic. The order
  // is: least recently used, then best fit, then the order declared above - so
  // a page composed on its own always resolves the same way, and a deck spreads
  // across its repertoire.
  const unused = recent.length + 1;
  const staleness = (name) => { const at = recent.indexOf(name); return at === -1 ? unused : at; };
  const score = (name) => scored.find(([n]) => n === name)[1];
  // A varied deck breaks the last tie in its own drawn order, not the order the
  // shapes happen to be declared in.
  const declared = (name) => LAYOUT.variation ? LAYOUT.variation.order[PAGE_SHAPE_NAMES.indexOf(name)] : PAGE_SHAPE_NAMES.indexOf(name);
  return viable.slice().sort((a, b) =>
    score(b) - score(a) || staleness(b) - staleness(a) || declared(a) - declared(b))[0];
}
