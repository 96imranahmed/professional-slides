import { withUnit } from "./value-format.mjs";
import { ellipsePrimitive, linePrimitive, rectPrimitive, stableId, textPrimitive, token, tokenValue } from "./core.mjs";
import { measureText } from "./text-layout.mjs";

export const LEGEND_VARIANTS = Object.freeze({ swatch: {}, line: {}, marker: {}, state: {}, 'quantitative-scale': {} });
export const LEGEND_PLACEMENTS = Object.freeze(["top", "top-right", "bottom-center", "right", "inline"]);
export const QUANTITATIVE_SCALE_TOKENS = ['theme-sequential','red-white','red-white-green','red-yellow-green'].flatMap(p=>Array.from({length:11},(_,i)=>`color.heat.${p}.${i}`));
export const LEGEND_TOKENS = ["font.body", "type.chartLabel", "color.ink", "line.hairline", "line.standard", "space.2", "space.4", "radius.none", ...QUANTITATIVE_SCALE_TOKENS, ...Array.from({ length: 6 }, (_, i) => `color.chartSeries${i + 1}`)];

export function normalizeQuantitativeScale(scale) {
  if (!scale || !Array.isArray(scale.domain) || scale.domain.length!==2 || !scale.domain.every(Number.isFinite) || scale.domain[0]>=scale.domain[1]) throw new Error('Quantitative scale needs an increasing finite domain');
  const palette=scale.palette ?? 'theme-sequential';
  if (!['theme-sequential','red-white','red-white-green','red-yellow-green'].includes(palette)) throw new Error('Unknown quantitative scale palette');
  if (typeof scale.unit!=='string' || !scale.unit.trim()) throw new Error('Quantitative scale needs an explicit unit');
  const decimals=scale.decimals ?? 1;
  if (!Number.isInteger(decimals)||decimals<0||decimals>3) throw new Error('Quantitative scale decimals must be zero to three');
  if (scale.semantics!==undefined && scale.semantics!=='relative-level') throw new Error('Unknown quantitative scale semantics; use relative-level for ordered low-to-high values');
  if (palette==='red-yellow-green' && scale.semantics!=='relative-level') throw new Error('Red-yellow-green scale requires explicit relative-level semantics');
  return {...scale,palette,decimals};
}
export function quantitativeScaleColor(scale, value) {
  if (!Number.isFinite(value)||value<scale.domain[0]||value>scale.domain[1]) throw new Error('Quantitative value is outside its shared domain');
  return token(`color.heat.${scale.palette}.${Math.round((value-scale.domain[0])/(scale.domain[1]-scale.domain[0])*10)}`);
}
export function quantitativeLegendNodes({id,frame,props}) {
  if (props.placement!==undefined && props.placement!=='top') throw new Error('Quantitative scale legend supports top placement');
  if (props.items!==undefined) throw new Error('Quantitative scale legend uses a domain rather than categorical items');
  const scale=normalizeQuantitativeScale(props.scale), size=tokenValue(token('type.chartLabel'));
  const labels=scale.domain.map((v,i)=>`${scale.semantics==='relative-level'?(i?'High ':'Low '):''}${withUnit(v.toFixed(scale.decimals), scale.unit)}`);
  const measurements=labels.map(text=>measureText(text,frame.width,{fontSize:size,wrapWidthRatio:1}));
  const height=Math.max(...measurements.map(m=>m.height));
  if (measurements.some(m=>m.lines.length!==1)||measurements.reduce((s,m)=>s+m.width,0)+16>frame.width || height+20>frame.height) throw new Error('Quantitative legend does not fit its allocated frame; widen the legend region or shorten the unit and end labels');
  const data={legendVariant:'quantitative-scale',domain:scale.domain,unit:scale.unit,palette:scale.palette,scaleSemantics:scale.semantics??null,bins:11};
  const nodes=Array.from({length:11},(_,i)=>{
    const low=Math.max(0,(i-.5)/10),high=Math.min(1,(i+.5)/10);
    return rectPrimitive({id:stableId(id,'scale-bin',i),role:'legend-swatch',frame:{x:frame.x+low*frame.width,y:frame.y+height+8,width:(high-low)*frame.width,height:12},style:{fill:token(`color.heat.${scale.palette}.${i}`),stroke:'none',lineWidth:token('line.hairline')},data:{...data,bin:i}});
  });
  labels.forEach((text,i)=>nodes.push(textPrimitive({id:stableId(id,'scale-endpoint',i),role:'legend-label',frame:{x:i?frame.x+frame.width-measurements[i].width:frame.x,y:frame.y,width:measurements[i].width,height},text,style:{fontFamily:token('font.body'),fontSize:token('type.chartLabel'),color:token('color.ink'),align:i?'right':'left',valign:'top'},data:{...data,value:scale.domain[i],textLayout:{lines:[text]}}})));
  return nodes;
}
export const QUANTITATIVE_LEGEND_SAMPLE={variant:'quantitative-scale',scale:{domain:[-5,10],unit:'%',palette:'red-white-green'}};

/** Greedy rows: items in order, a new row when the next item would outrun the width. */
function packLegendRows(widths, maxWidth, gap) {
  const rows = [[]]; let used = 0;
  widths.forEach((w, i) => {
    const row = rows[rows.length - 1];
    const next = row.length ? used + gap + w : w;
    if (row.length && next > maxWidth) { rows.push([i]); used = w; } else { row.push(i); used = next; }
  });
  return rows;
}
/** How many rows a horizontal legend of these items needs at this width. */
export function legendRowCount(items, width) {
  const keyGap = tokenValue(token("space.2")), itemGap = tokenValue(token("space.4"));
  const widths = items.map((item) => 12 + keyGap + measureText(typeof item === "string" ? item : item.label, width, { fontSize: tokenValue(token("type.chartLabel")), wrapWidthRatio: 1 }).width);
  return packLegendRows(widths, width, itemGap).length;
}

export function legendNodes({ id, frame, props }) {
  const variant = props.variant ?? "swatch", placement = props.placement ?? "top";
  if (variant==='quantitative-scale') return quantitativeLegendNodes({id,frame,props});
  if (!Object.hasOwn(LEGEND_VARIANTS, variant)) throw new Error(`Unknown legend variant: ${variant}`);
  if (!LEGEND_PLACEMENTS.includes(placement)) throw new Error(`Unknown legend placement: ${placement}`);
  if (!Array.isArray(props.items) || !props.items.length) throw new Error("Legend requires at least one item");
  const items = props.items.map((item, index) => typeof item === "string" ? { label: item, colorIndex: index } : item);
  const states = { actual: { fill: true, dash: "solid" }, forecast: { fill: false, dash: "dash" }, target: { fill: false, dash: "solid" }, scenario: { fill: false, dash: "dot" }, missing: { fill: false, dash: "solid" } };
  if (variant === "state" && items.some(item => !Object.hasOwn(states, item.state))) throw new Error("State legend requires actual, forecast, target, scenario, or missing");
  const defaultKeyWidth = variant === "line" ? 24 : 12, keyGap = tokenValue(token("space.2")), itemGap = tokenValue(token("space.4"));
  const height = 24;
  const keyWidths = items.map((item) => {
    const markerSize = item.markerSize ?? 12;
    if (!Number.isFinite(markerSize) || markerSize < 8 || markerSize > 20) throw new Error("Legend marker size must be between eight and twenty pixels");
    return variant === "line" ? defaultKeyWidth : Math.max(defaultKeyWidth, markerSize);
  });
  const widths = items.map((item, index) => keyWidths[index] + keyGap + measureText(item.label, frame.width, { fontSize: tokenValue(token("type.chartLabel")), wrapWidthRatio: 1 }).width);
  const vertical = placement === "right";
  // A horizontal legend wraps onto further rows when its items outrun the frame.
  const rows = vertical ? items.map((_, i) => [i]) : packLegendRows(widths, frame.width, itemGap);
  const rowWidth = (row) => row.reduce((a, i) => a + widths[i], 0) + Math.max(0, row.length - 1) * itemGap;
  const width = vertical ? Math.max(0, ...widths) : Math.max(...rows.map(rowWidth));
  const totalHeight = vertical ? items.length * height + Math.max(0, items.length - 1) * keyGap : rows.length * height + Math.max(0, rows.length - 1) * 2;
  if (width > frame.width || totalHeight > frame.height) throw new Error("Legend does not fit its allocated space; enlarge the region or shorten labels");
  const rowOf = new Map(); rows.forEach((row, r) => row.forEach((i, k) => rowOf.set(i, { r, k })));
  const rowStart = (r) => placement === "top-right" || vertical ? frame.x + frame.width - rowWidth(rows[r]) : placement === "bottom-center" ? frame.x + (frame.width - rowWidth(rows[r])) / 2 : frame.x;
  let x = rowStart(0);
  let y = placement === "bottom-center" ? frame.y + frame.height - totalHeight : frame.y;
  return items.flatMap((item, index) => {
    if (!vertical) { const { r, k } = rowOf.get(index); if (k === 0) { x = rowStart(r); y = (placement === "bottom-center" ? frame.y + frame.height - totalHeight : frame.y) + r * (height + 2); } }
    const keyWidth = keyWidths[index];
    const markerSize = item.markerSize ?? 12;
    const colorIndex = item.colorIndex ?? index;
    if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= 6) throw new Error("Legend colour index must be between zero and five");
    const color = item.color ?? token(`color.chartSeries${colorIndex + 1}`);
    const stroke = item.stroke ?? color;
    const state = variant === "state" ? states[item.state] : null;
    const style = { fill: state && !state.fill ? "none" : color, stroke, lineWidth: token("line.hairline"), dash: state?.dash ?? "solid" };
    const data = { categoryKey: item.key ?? item.label, colorIndex, legendVariant: variant, placement };
    const mark = variant === "state" && item.state === "missing"
      ? linePrimitive({ id: stableId(id, "key", index), role: "legend-swatch", x1: x, y1: y + height / 2, x2: x + keyWidth, y2: y + height / 2, style: { stroke, lineWidth: token("line.standard") }, data })
      : variant === "line"
      ? linePrimitive({ id: stableId(id, "key", index), role: "legend-swatch", x1: x, y1: y + height / 2, x2: x + keyWidth, y2: y + height / 2, style: { stroke: color, lineWidth: token("line.standard"), dash: item.state === "forecast" ? "dash" : "solid" }, data })
      : (variant === "marker" || (variant === "state" && item.state === "scenario") ? ellipsePrimitive : rectPrimitive)({ id: stableId(id, "key", index), role: "legend-swatch", frame: { x: x + (keyWidth - markerSize) / 2, y: y + (height - markerSize) / 2, width: markerSize, height: markerSize }, style, data: { ...data, markerSize } });
    const label = textPrimitive({ id: stableId(id, "label", index), role: "legend-label", frame: { x: x + keyWidth + keyGap, y, width: widths[index] - keyWidth - keyGap, height }, text: item.label,
      style: { fontFamily: token("font.body"), fontSize: token("type.chartLabel"), color: token("color.ink"), align: "left", valign: "mid", wrap: false }, data: { ...data, textLayout: { lines: [item.label] } } });
    if (vertical) y += height + keyGap; else x += widths[index] + itemGap;
    return [mark, label];
  });
}
