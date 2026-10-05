// The page's measures: a strip of KPI tiles over the evidence
// (`metricsStrip`), or, when the exhibit keeps its own height and has few
// rows, a column of tiles beside it (`metricsBesideExhibit`, `metricsColumn`).
import { REGISTRY } from "./registry.mjs";
import { CONTENT_FRAME, token, tokenValue } from "./core.mjs";
import { metricHeight } from "./panels.mjs";
import { SIDEWAYS_CATEGORIES } from "./compose-charts.mjs";
import { BRIDGE_VARIANTS } from "./compose-points.mjs";

/** A KPI strip: equal tiles in a row, hugging one tile height. */
/** `metricsTone` on the page sets every tile: dark, tint, ink (black tiles) or rule (accent values behind hairlines). */
// How far a strip grows past its usual height to hold a tile whose label and sublabel wrap: past this it is a band of prose.
const STRIP_GROWTH = 1.5;
export function metricsStrip(metrics, id, tone) {
  const tiles = metrics.map((m) => (typeof m === "string" ? { value: m } : m));
  const prominent = tone === "ink" || tone === "rule";
  const propsOf = (m) => ({ ...(tone ? { tone } : {}), ...(prominent ? { variant: "prominent" } : {}), ...(tiles.length > 1 ? { valign: "top" } : {}), ...m });
  const usual = prominent ? 124 : tone === "ring" ? 150 : 104;
  // The strip is as tall as its tallest tile needs at the width this many tiles leave each: five tiles with sublabels wrap
  // where three do not, and a strip of one fixed height refused them as "too short" with nothing the author could change.
  const width = (CONTENT_FRAME.width - tokenValue(token("space.4")) * (tiles.length - 1)) / tiles.length;
  // What a tile's own check holds it to: its value, label, sublabel and delta with the gaps between them, the tile's padding
  // aside (panels.mjs metricNodes) - so a strip that held its tiles at the usual height still stands at it.
  const pad = (m) => (propsOf(m).tone === "hero" ? 0 : tokenValue(token("space.3")));
  const heights = tone === "ring" ? [] : tiles.map((m) => { try { return Math.ceil(metricHeight(width, propsOf(m)) - 2 * pad(m)); } catch { return 0; } });
  const needed = Math.max(usual, ...heights), most = Math.floor(usual * STRIP_GROWTH);
  if (needed > most) {
    const tall = tiles[heights.indexOf(needed)];
    throw new Error(`A strip of ${tiles.length} tiles gives each ${Math.floor(width)}px, and the tile "${String(tall.label ?? tall.value)}" needs ${needed}px for its value, label${tall.sublabel ? " and sublabel" : ""}${tall.delta ? " and delta" : ""} where a strip grows to ${most}px: shorten its label${tall.sublabel ? " or sublabel (or drop the sublabels)" : ""}, or set fewer tiles - ${tiles.length - 1} leave each ${Math.floor((CONTENT_FRAME.width - tokenValue(token("space.4")) * (tiles.length - 2)) / Math.max(1, tiles.length - 1))}px`);
  }
  return { id, layout: "flow.row", size: { width: { fr: 1 }, height: needed }, items: tiles.map((m, i) => ({ id: `${id}-${i}`, component: "metric", props: propsOf(m), size: { width: { fr: 1 }, height: "fill" } })) };
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
