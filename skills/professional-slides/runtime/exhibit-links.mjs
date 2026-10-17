// Marks drawn between two exhibits on one page, read off where each exhibit
// drew its marks (core.mjs `readsScene`): a breakout's fan from one bar,
// column or segment to the panel that splits it, and a spread between a mark
// in one panel and a mark in the next with the gap between them named.
import { linePrimitive, stableId, textPrimitive, token, tokenValue } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { component, textStyle, INK } from "./registry-shared.mjs";
import { lineStyle } from "./chart-axes.mjs";

export const LINK_KINDS = Object.freeze(["breakout", "spread"]);
// The fan stops short of the detail panel's marks, so it points at the
// panel rather than running into its first bar.
const FAN_GAP = 12;
// The spread's ticks run this far off each mark before the bracket turns.
const SPREAD_TICK = 10;

const union = (frames) => {
  const x = Math.min(...frames.map((f) => f.x)), y = Math.min(...frames.map((f) => f.y));
  return { x, y, width: Math.max(...frames.map((f) => f.x + f.width)) - x, height: Math.max(...frames.map((f) => f.y + f.height)) - y };
};

/** Where two segments meet, if they do (Cramer on the two direction vectors). */
function crosses([ax, ay, bx, by], [cx, cy, dx, dy]) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (!d) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}
const edges = (f) => [[f.x, f.y, f.x + f.width, f.y], [f.x + f.width, f.y, f.x + f.width, f.y + f.height], [f.x, f.y + f.height, f.x + f.width, f.y + f.height], [f.x, f.y, f.x, f.y + f.height]];
const throughBox = (segment, f) => edges(f).some((edge) => crosses(segment, edge));
/** Is the point inside the polygon (even-odd ray cast)? */
function inside([x, y], polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/** A box in the wedge: a corner of it, set a pixel in, inside the polygon, or an edge of it crossing the polygon's. */
const inWedge = (f, polygon) => {
  const g = { x: f.x + 1, y: f.y + 1, width: Math.max(0, f.width - 2), height: Math.max(0, f.height - 2) };
  const corners = [[g.x, g.y], [g.x + g.width, g.y], [g.x, g.y + g.height], [g.x + g.width, g.y + g.height]];
  return corners.some((corner) => inside(corner, polygon)) || polygon.some((point, i) => throughBox([...point, ...polygon[(i + 1) % polygon.length]], g));
};

/** The exhibit an end names, by its page item id, and its drawn marks. */
function exhibitOf(id, scene, ref, end) {
  const instance = scene.instances.find((item) => item.id === ref.exhibit || item.instanceId === ref.exhibit);
  if (!instance) throw new Error(`${id}: the ${end} of the link names exhibit "${ref.exhibit}", which is not on the page`);
  const marks = scene.nodes.filter((node) => node.data?.componentInstance === instance.instanceId && node.role === "chart-mark");
  if (!marks.length) throw new Error(`${id}: the ${end} of the link is ${instance.component}, which draws no bars or columns to link from - a breakout or a spread runs between bar, column or stacked charts`);
  return { instance, marks };
}

/** The marks an end names: a category's bar or column, one series' segment of it, or the whole stack. */
function marksAt(id, exhibit, ref, end) {
  const found = exhibit.marks.filter((node) => String(node.data.category) === String(ref.category) && (ref.series === undefined || node.data.series === ref.series));
  if (!found.length) {
    const categories = [...new Set(exhibit.marks.map((node) => node.data.category))];
    throw new Error(`${id}: the ${end} of the link names ${ref.series !== undefined ? `"${ref.series}" in ` : ""}"${ref.category}", which ${exhibit.instance.component} does not draw (its categories: ${categories.join(", ")})`);
  }
  return found;
}

function breakout({ id, props, scene }) {
  const source = exhibitOf(id, scene, props.from, "from"), detail = exhibitOf(id, scene, { exhibit: props.to.exhibit }, "to");
  const picked = marksAt(id, source, props.from, "from"), mark = union(picked.map((node) => node.frame));
  const target = union(detail.marks.map((node) => node.frame));
  const left = target.x - FAN_GAP, right = mark.x + mark.width;
  if (left <= right + FAN_GAP) throw new Error(`${id}: a breakout fans from the mark to a detail panel on its right; "${props.from.category}" ends at ${Math.round(right)}px and the detail starts at ${Math.round(target.x)}px - set the overview first`);
  const fan = [[right, mark.y, left, target.y], [right, mark.y + mark.height, left, target.y + target.height]];
  // The fan runs over the overview's own plot: a bar it crosses is read as
  // part of the breakout, so the mark broken out is one the fan leaves clear.
  // A bar inside the wedge between the two lines reads as part of what is broken out.
  const wedge = [[right, mark.y], [left, target.y], [left, target.y + target.height], [right, mark.y + mark.height]];
  const others = source.marks.filter((node) => !picked.includes(node));
  const crossed = others.find((node) => inWedge(node.frame, wedge));
  if (crossed) throw new Error(`${id}: the breakout's fan from "${props.from.category}" would cross the mark for "${crossed.data.category}" on its way to the detail - break out the last column, the longest bar or a segment of a single stack, so the fan leaves the overview clear`);
  const style = lineStyle(token("color.textSecondary"), token("line.hairline"), "dash");
  return [
    linePrimitive({ id: stableId(id, "fan", "top"), role: "exhibit-link-line", x1: fan[0][0], y1: fan[0][1], x2: fan[0][2], y2: fan[0][3], style, data: { link: "breakout", category: props.from.category, series: props.from.series } }),
    linePrimitive({ id: stableId(id, "fan", "bottom"), role: "exhibit-link-line", x1: fan[1][0], y1: fan[1][1], x2: fan[1][2], y2: fan[1][3], style, data: { link: "breakout", category: props.from.category, series: props.from.series } }),
  ];
}

function spread({ id, props, scene }) {
  if (typeof props.label !== "string" || !props.label.trim()) throw new Error(`${id}: a spread names the gap it draws - \`label\`, the difference in the measure's unit ("+12 pts")`);
  const A = exhibitOf(id, scene, props.from, "from"), B = exhibitOf(id, scene, props.to, "to");
  const pickedA = marksAt(id, A, props.from, "from"), pickedB = marksAt(id, B, props.to, "to");
  const a = union(pickedA.map((node) => node.frame)), b = union(pickedB.map((node) => node.frame));
  const gutterLeft = A.instance.frame.x + A.instance.frame.width, gutterRight = B.instance.frame.x;
  if (gutterRight <= gutterLeft) throw new Error(`${id}: a spread runs from a mark to one in a panel on its right; set the panels in that order`);
  // The bracket stands in the gutter between the two panels, each mark led to
  // it at its own height; a leader that crossed another bar or its figure
  // would read as part of the gap.
  const x = (gutterLeft + gutterRight) / 2;
  const leaders = [[a.x + a.width + 2, a.y, x, a.y], [x, b.y, b.x - 2, b.y]];
  const own = (node, picked, ref) => picked.includes(node) || (node.role === "data-label" && String(node.data?.category) === String(ref.category));
  const obstacles = [
    ...scene.nodes.filter((node) => node.data?.componentInstance === A.instance.instanceId && ["chart-mark", "data-label"].includes(node.role) && !own(node, pickedA, props.from)),
    ...scene.nodes.filter((node) => node.data?.componentInstance === B.instance.instanceId && ["chart-mark", "data-label"].includes(node.role) && !own(node, pickedB, props.to)),
  ];
  const crossed = obstacles.find((node) => leaders.some((segment) => throughBox(segment, node.frame)));
  if (crossed) throw new Error(`${id}: the spread's leader would cross ${crossed.role === "data-label" ? "the label" : "the mark"} for "${crossed.data?.category}" - join marks at the panels' facing edges (the last column of the first panel, the first of the next), or name the gap in a callout`);
  const solid = lineStyle(INK, token("line.hairline")), dashed = lineStyle(INK, token("line.hairline"), "dash");
  const label = measureText(props.label, 160, { fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(token("type.label")), bold: true });
  const top = Math.min(a.y, b.y), height = label.height + 4;
  return [
    linePrimitive({ id: stableId(id, "spread", "from"), role: "exhibit-link-line", x1: leaders[0][0], y1: leaders[0][1], x2: leaders[0][2], y2: leaders[0][3], style: dashed, data: { link: "spread" } }),
    linePrimitive({ id: stableId(id, "spread", "to"), role: "exhibit-link-line", x1: leaders[1][0], y1: leaders[1][1], x2: leaders[1][2], y2: leaders[1][3], style: dashed, data: { link: "spread" } }),
    linePrimitive({ id: stableId(id, "spread", "bracket"), role: "exhibit-link-line", x1: x, y1: a.y, x2: x, y2: b.y, style: solid, data: { link: "spread", startArrow: true, endArrow: true } }),
    // The difference is named over the bracket, above the higher of the two marks.
    textPrimitive({ id: stableId(id, "spread", "label"), role: "exhibit-link-label", frame: { x: x - label.width / 2 - 2, y: top - SPREAD_TICK - height, width: label.width + 4, height },
      text: props.label, style: textStyle(token("type.label"), INK, true, "center"), data: { link: "spread" } }),
  ];
}

function defineExhibitLink() {
  const definition = component({
    id: "exhibit-link", category: "relationship", role: "exhibit-link",
    tokens: ["color.textSecondary", "color.ink", "line.hairline", "font.body", "type.label"],
    preferredSize: { width: 1160, height: 400 },
    sample: { kind: "breakout", from: { exhibit: "(Insert overview exhibit id)", category: "(Insert category)" }, to: { exhibit: "(Insert detail exhibit id)" } },
    render: ({ id, props, scene }) => {
      if (!LINK_KINDS.includes(props.kind)) throw new Error(`${id}: an exhibit link is ${LINK_KINDS.join(" or ")} (got ${JSON.stringify(props.kind)})`);
      if (!props.from?.exhibit || props.from.category === undefined || !props.to?.exhibit) throw new Error(`${id}: a ${props.kind} names \`from: { exhibit, category, series? }\` and \`to: { exhibit${props.kind === "spread" ? ", category, series?" : ""} }\``);
      // Drawn alone (a sample, a measurement, a registry fixture) there is nothing on the page to link.
      if (!scene || !scene.instances.some((item) => String(item.component).startsWith("chart."))) return { nodes: [] };
      return { nodes: props.kind === "breakout" ? breakout({ id, props, scene }) : spread({ id, props, scene }) };
    },
  });
  // Placed after everything else on the slide, with what was drawn (core.mjs).
  definition.readsScene = true;
  return definition;
}

export function registerExhibitLinks(registry) {
  registry.set("exhibit-link", defineExhibitLink());
  return registry;
}
