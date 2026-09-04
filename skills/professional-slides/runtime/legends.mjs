import { ellipsePrimitive, linePrimitive, rectPrimitive, stableId, textPrimitive, token, tokenValue } from "./core.mjs";
import { measureText } from "./text-layout.mjs";

export const LEGEND_VARIANTS = Object.freeze({ swatch: {}, line: {}, marker: {}, state: {} });
export const LEGEND_PLACEMENTS = Object.freeze(["top", "top-right", "bottom-center", "right", "inline"]);
export const LEGEND_TOKENS = ["font.body", "type.label", "color.ink", "line.hairline", "line.standard", "space.2", "space.4", "radius.none", ...Array.from({ length: 6 }, (_, i) => `color.chartSeries${i + 1}`)];

export function legendNodes({ id, frame, props }) {
  const variant = props.variant ?? "swatch", placement = props.placement ?? "top";
  if (!Object.hasOwn(LEGEND_VARIANTS, variant)) throw new Error(`Unknown legend variant: ${variant}`);
  if (!LEGEND_PLACEMENTS.includes(placement)) throw new Error(`Unknown legend placement: ${placement}`);
  if (!Array.isArray(props.items) || !props.items.length) throw new Error("Legend requires at least one item");
  const items = props.items.map((item, index) => typeof item === "string" ? { label: item, colorIndex: index } : item);
  const keyWidth = variant === "line" ? 24 : 12, keyGap = tokenValue(token("space.2")), itemGap = tokenValue(token("space.4"));
  const height = 24;
  const widths = items.map(item => keyWidth + keyGap + measureText(item.label, frame.width, { fontSize: tokenValue(token("type.label")), wrapWidthRatio: 1 }).width);
  const vertical = placement === "right";
  const width = vertical ? Math.max(0, ...widths) : widths.reduce((a, b) => a + b, 0) + Math.max(0, items.length - 1) * itemGap;
  const totalHeight = vertical ? items.length * height + Math.max(0, items.length - 1) * keyGap : height;
  if (width > frame.width || totalHeight > frame.height) throw new Error("Legend does not fit its allocated space; enlarge the region or shorten labels");
  let x = placement === "top-right" || vertical ? frame.x + frame.width - width : placement === "bottom-center" ? frame.x + (frame.width - width) / 2 : frame.x;
  let y = placement === "bottom-center" ? frame.y + frame.height - height : frame.y;
  return items.flatMap((item, index) => {
    const colorIndex = item.colorIndex ?? index;
    if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= 6) throw new Error("Legend colour index must be between zero and five");
    const color = token(`color.chartSeries${colorIndex + 1}`);
    const forecast = variant === "state" && item.state === "forecast";
    const style = { fill: forecast ? "none" : color, stroke: color, lineWidth: token("line.hairline"), ...(forecast ? { dash: "dash" } : {}) };
    const data = { categoryKey: item.key ?? item.label, colorIndex, legendVariant: variant, placement };
    const mark = variant === "line"
      ? linePrimitive({ id: stableId(id, "key", index), role: "legend-swatch", x1: x, y1: y + height / 2, x2: x + keyWidth, y2: y + height / 2, style: { stroke: color, lineWidth: token("line.standard"), dash: item.state === "forecast" ? "dash" : "solid" }, data })
      : (variant === "marker" ? ellipsePrimitive : rectPrimitive)({ id: stableId(id, "key", index), role: "legend-swatch", frame: { x, y: y + (height - 12) / 2, width: keyWidth, height: 12 }, style, data });
    const label = textPrimitive({ id: stableId(id, "label", index), role: "legend-label", frame: { x: x + keyWidth + keyGap, y, width: widths[index] - keyWidth - keyGap, height }, text: item.label,
      style: { fontFamily: token("font.body"), fontSize: token("type.label"), color: token("color.ink"), align: "left", valign: "mid", wrap: false }, data: { ...data, textLayout: { lines: [item.label] } } });
    if (vertical) y += height + keyGap; else x += widths[index] + itemGap;
    return [mark, label];
  });
}
