// The page's measures: a strip of KPI tiles over the evidence
// (`metricsStrip`), or, when the exhibit keeps its own height and has few
// rows, a column of tiles beside it (`metricsBesideExhibit`, `metricsColumn`).
import { REGISTRY } from "./registry.mjs";
import { SIDEWAYS_CATEGORIES } from "./compose-charts.mjs";
import { BRIDGE_VARIANTS } from "./compose-points.mjs";

/** A KPI strip: equal tiles in a row, hugging one tile height. */
/** `metricsTone` on the page sets every tile: dark, tint, ink (black tiles) or rule (accent values behind hairlines). */
export function metricsStrip(metrics, id, tone) {
  const tiles = metrics.map((m) => (typeof m === "string" ? { value: m } : m));
  const prominent = tone === "ink" || tone === "rule";
  return { id, layout: "flow.row", size: { width: { fr: 1 }, height: prominent ? 124 : tone === "ring" ? 150 : 104 }, items: tiles.map((m, i) => ({ id: `${id}-${i}`, component: "metric", props: { ...(tone ? { tone } : {}), ...(prominent ? { variant: "prominent" } : {}), ...(tiles.length > 1 ? { valign: "top" } : {}), ...m }, size: { width: { fr: 1 }, height: "fill" } })) };
}

/**
 * Whether the measures over an exhibit stand beside it instead. A strip over
 * an exhibit that keeps its own height - rows that do not grow with their
 * frame (a dumbbell, a lollipop, a short table), and few of them - is two thin
 * bands across the page: the numbers spread over the full width, the rows over
 * a plot their marks cannot fill. Up to four measures then stand in a column
 * beside the exhibit, which takes the rest of the row (metricsColumn). An
 * exhibit that grows into the height the strip leaves (bars, columns, lines)
 * keeps the strip over it, and so does one with more rows than a strip-high
 * band holds, or measures in a tone that draws no tile (metricsColumn needs one).
 */
const BESIDE_ROWS_MAX = 4;
const TILED_TONES = new Set([undefined, "tint", "dark", "ink"]);
export function metricsBesideExhibit(slide, exhibits, layout) {
  // An implication marker drawn across, between the measures and the exhibit,
  // is the author asking for the strip over it.
  if (layout !== "metrics-over-exhibit" || exhibits.length !== 1 || slide.metricsPosition === "bottom" || BRIDGE_VARIANTS.get(slide.implication) !== null) return false;
  if (!TILED_TONES.has(slide.metricsTone)) return false;
  const count = Array.isArray(slide.metrics) ? slide.metrics.length : 0;
  if (count < 2 || count > BESIDE_ROWS_MAX) return false;
  const ex = exhibits[0], type = String(ex?.type ?? "");
  const rows = type === "table" || type === "rows" ? (ex.rows || []).filter((row) => Array.isArray(row) || !["total", "group"].includes(row?.style)).length
    : SIDEWAYS_CATEGORIES.has(type) ? (ex.categories || []).length : Infinity;
  const component = REGISTRY.get(type === "rows" ? "table" : type);
  return rows <= BESIDE_ROWS_MAX && typeof component?.measureContent === "function";
}

/**
 * The measures in a column beside the exhibit, the tiles dividing the
 * column's height between them, each a filled tile (the light tint unless the
 * page names a tone) with its figure centred. The exhibit keeps its own
 * height, so its column may stop short; the tiles carry this one to the foot.
 * Unfilled, three figures centred in thirds of a 500px column left 110px of
 * air between each (COLUMN_VOID), and drawn as a compact group they stopped
 * where the exhibit did, and the page's foot stood empty (DEAD_BAND).
 */
export function metricsColumn(metrics, id, tone) {
  const strip = metricsStrip(metrics, id, tone ?? "tint");
  return { id, layout: "flow.column", gap: "space.4", size: { width: { fr: 1 }, height: "fill" },
    items: strip.items.map((tile) => ({ ...tile, props: { variant: "prominent", ...tile.props, valign: "middle" }, size: { width: { fr: 1 }, height: { fr: 1 } } })) };
}
