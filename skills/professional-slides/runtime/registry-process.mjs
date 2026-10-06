// Process, roadmap and tree: the process steps and chevron process, the
// initiative rollout and highlight strip, the roadmap (with its wave-column
// and phase-workstream variants), the timeline (with its dated schedules), the
// journey, the tree and the organisation chart.
import { token, tokenValue, ellipsePrimitive, rectPrimitive, stableId, textPrimitive, insetFrame, shapePrimitive, houseStyle, readableOn } from "./core.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";
import { routeConnector } from "./routing.mjs";
import { renderPhaseWorkstreams, measurePhaseWorkstreams, PHASE_WORKSTREAM_TOKENS, PHASE_WORKSTREAM_VARIANTS } from "./phase-workstreams.mjs";
import { renderPhaseHierarchy, QUALITATIVE_TOPOLOGY_TOKENS, PHASE_HIERARCHY_SAMPLE } from "./qualitative-topology.mjs";
import { timeGrid, datedLanes, SCHEDULE_TOKENS, SCHEDULE_VARIANTS } from "./schedules.mjs";
import { detailedStages, stagesLayout, stagesNodes, STAGE_TOKENS } from "./schedule-stages.mjs";
import { FONT, COMPACT, INK, SECONDARY, PRIMARY, SURFACE, MUTED_SURFACE, RULE, WHITE, HAIRLINE, STANDARD, SMALL_RADIUS, LABEL, textStyle,
  boxStyle, openLine, PRIMARY_TINT, component, simpleList, refineVariantAxes } from "./registry-shared.mjs";

// A process rail is drawn in proportion to its frame (the rail at 48% of the
// height, 32% on a roadmap), so a tall frame adds no rhythm: it moves the
// rail down and opens an empty band above it and another under the labels.
// The frame it can use is held to a quarter more than its sample height, or
// the height its tallest label needs if that is more (the same sum the render
// refuses on); past that the page keeps the rest as its bottom margin.
function processCeiling(frame, props, roadmap = false, sample = roadmap ? 360 : 280) {
  const items = (props.items || []).map((item) => typeof item === "string" ? { label: item } : item);
  if (!items.length || !Number.isFinite(frame.width)) return null;
  const span = frame.width / items.length, inset = tokenValue(token("space.2"));
  const labelWidth = span - (roadmap ? 20 + 2 * inset : 12);
  if (labelWidth <= 0) return null;
  const tallest = Math.max(...items.map((item) => measureText([item.label, item.period, item.maturity, item.detail].filter(value => value !== undefined && value !== null && value !== "").join("\n"), labelWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(COMPACT), bold: true, wrapWidthRatio: ENGINE_RESERVE }).height));
  const needed = roadmap ? Math.max(28 / 0.44, (28 + tallest + 2 * inset) / 0.68) : (28 + tallest) / 0.52;
  return Math.ceil(Math.max(needed + 1, sample * 1.25));
}

// A frame taller than half its width - a process beside its commentary, or in
// a panel - is a column, and a rail across it is a band in the middle of air:
// the steps run down the column instead, each beside its marker, with the
// stage's detail under its label.
const VERTICAL_RATIO = 0.5;

function verticalProcessNodes({ id, frame, items, active }) {
  const nodes = [];
  const span = frame.height / items.length, marker = 36, gap = tokenValue(token("space.2")) * 2;
  const textX = frame.x + marker + gap, textWidth = frame.width - marker - gap;
  const centre = (index) => frame.y + span * (index + 0.5);
  if (items.length > 1) nodes.push(openLine(stableId(id, "rail"), frame.x + marker / 2, centre(0), frame.x + marker / 2, centre(items.length - 1), "process-rail", PRIMARY, STANDARD));
  const font = { fontFamily: tokenValue(FONT), fontSize: tokenValue(COMPACT), wrapWidthRatio: ENGINE_RESERVE };
  items.forEach((item, index) => {
    if (typeof item.label !== "string" || !item.label.trim()) throw new Error(`${id} stage ${index + 1} requires a label`);
    const on = active === index, y = centre(index);
    nodes.push(ellipsePrimitive({ id: stableId(id, "step-marker", index), role: "process-marker", frame: { x: frame.x, y: y - marker / 2, width: marker, height: marker }, style: boxStyle(on ? PRIMARY : SURFACE, PRIMARY, STANDARD, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "step-number", index), role: "process-number", frame: { x: frame.x, y: y - marker / 2, width: marker, height: marker }, text: String(index + 1), style: textStyle(LABEL, on ? WHITE : PRIMARY, true, "center") }));
    const head = [item.label, item.period, item.maturity].filter((value) => value !== undefined && value !== null && value !== "").join("\n");
    const label = measureText(head, textWidth, { ...font, bold: true });
    const detail = item.detail ? measureText(item.detail, textWidth, font) : null;
    const height = label.height + (detail ? 4 + detail.height : 0);
    if (textWidth <= 0 || height > span) throw new Error(`${id} stage ${index + 1} needs more room for its complete label`);
    // The block is centred on its marker, so a one-line stage reads level with its number.
    const top = y - height / 2;
    nodes.push(textPrimitive({ id: stableId(id, "step-label", index), role: "process-label", frame: { x: textX, y: top, width: textWidth, height: label.height }, text: label.text, style: { ...textStyle(COMPACT, INK, true, "left", "top"), lineHeight: label.lineHeight, wrap: false }, data: { textLayout: label } }));
    if (detail) nodes.push(textPrimitive({ id: stableId(id, "step-detail", index), role: "process-detail", frame: { x: textX, y: top + label.height + 4, width: textWidth, height: detail.height }, text: detail.text, style: { ...textStyle(COMPACT, INK, false, "left", "top"), lineHeight: detail.lineHeight, wrap: false }, data: { textLayout: detail } }));
  });
  return nodes;
}

function processNodes({ id, frame, props, roadmap = false, journey = false }) {
  const items = props.items;
  if (!Array.isArray(items) || !items.length) throw new Error(`${id} requires ordered stages`);
  if (!roadmap && !journey && items.length >= 3 && frame.height > VERTICAL_RATIO * frame.width) return verticalProcessNodes({ id, frame, items, active: props.active });
  const nodes = [];
  const span = frame.width / items.length;
  const railY = frame.y + frame.height * (roadmap ? 0.32 : 0.48);
  nodes.push(openLine(stableId(id, "rail"), frame.x + span * 0.35, railY, frame.x + frame.width - span * 0.35, railY, "process-rail", PRIMARY, STANDARD));
  items.forEach((item, index) => {
    if (typeof item.label !== "string" || !item.label.trim()) throw new Error(`${id} stage ${index + 1} requires a label`);
    const center = frame.x + span * (index + 0.5);
    const active = props.active === index;
    nodes.push(ellipsePrimitive({ id: stableId(id, "step-marker", index), role: "process-marker", frame: { x: center - 18, y: railY - 18, width: 36, height: 36 }, style: boxStyle(active ? PRIMARY : SURFACE, PRIMARY, STANDARD, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "step-number", index), role: "process-number", frame: { x: center - 18, y: railY - 18, width: 36, height: 36 }, text: String(index + 1), style: textStyle(LABEL, active ? WHITE : PRIMARY, true, "center") }));
    const inset = tokenValue(token("space.2"));
    const label = [item.label || item, item.period, item.maturity, item.detail].filter(value => value !== undefined && value !== null && value !== "").join("\n");
    const labelWidth = span - (roadmap ? 20 + 2 * inset : 12);
    const measured = measureText(label, labelWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(COMPACT), bold: true, wrapWidthRatio: ENGINE_RESERVE });
    const bandTop = railY + 28;
    const bandHeight = Math.max(frame.height * 0.24, measured.height + 2 * inset);
    const labelTop = roadmap ? bandTop + (bandHeight - measured.height) / 2 : bandTop;
    if (labelWidth <= 0 || (roadmap ? bandTop + bandHeight : labelTop + measured.height) > frame.y + frame.height) throw new Error(`${id} stage ${index + 1} needs more room for its complete label`);
    if (roadmap) nodes.push(rectPrimitive({ id: stableId(id, "phase-band", index), role: "roadmap-phase", frame: { x: frame.x + span * index + 10, y: bandTop, width: span - 20, height: bandHeight }, style: boxStyle(MUTED_SURFACE, RULE, HAIRLINE, SMALL_RADIUS) }));
    nodes.push(textPrimitive({ id: stableId(id, "step-label", index), role: "process-label", frame: { x: center - labelWidth / 2, y: labelTop, width: labelWidth, height: measured.height }, text: measured.text, style: { ...textStyle(COMPACT, INK, true, "center", "top"), lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: measured } }));
    if (journey) nodes.push(textPrimitive({ id: stableId(id, "touchpoint", index), role: "journey-touchpoint", frame: { x: frame.x + span * index + 8, y: frame.y + 14, width: span - 16, height: 42 }, text: item.touchpoint || "Touchpoint", style: textStyle(LABEL, SECONDARY, false, "center") }));
  });
  return nodes;
}

function treeNodes({ id, frame, props, organization = false }) {
  if (organization && Array.isArray(props.nodes)) {
    const nodeFrames = new Map(props.nodes.map((node) => [node.id, {
      x: frame.x + node.x * frame.width,
      y: frame.y + node.y * frame.height,
      width: node.width * frame.width,
      height: node.height * frame.height
    }]));
    const nodes = [];
    for (const [index, connector] of (props.connectors || []).entries()) {
      const from = nodeFrames.get(connector.from);
      const to = nodeFrames.get(connector.to);
      if (!from || !to) throw new Error(`${id} connector references an unknown organization node`);
      const fromX = from.x + from.width / 2;
      const fromY = from.y + from.height;
      const toX = to.x + to.width / 2;
      const toY = to.y;
      // Reserve a visible vertical port at both ends: a horizontal route along
      // a box edge is covered by its fill and appears to land on a corner.
      const obstacles = [...nodeFrames.values()];
      const portAt = (x, y, direction) => {
        const gaps = obstacles.filter(r => x > r.x && x < r.x + r.width)
          .map(r => direction > 0 ? r.y - y : y - r.y - r.height).filter(gap => gap > 0.01);
        return Math.min(tokenValue(token("space.4")), Math.min(...gaps) / 2);
      };
      const route = [{ x: fromX, y: fromY },
        ...routeConnector({ x: fromX, y: fromY + portAt(fromX, fromY, 1) }, { x: toX, y: toY - portAt(toX, toY, -1) }, obstacles),
        { x: toX, y: toY }];
      route.slice(1).forEach((point, segment) => nodes.push(openLine(stableId(id, "connector", index, segment), route[segment].x, route[segment].y, point.x, point.y, "tree-connector", SECONDARY, HAIRLINE, { from: connector.from, to: connector.to })));
    }
    for (const [index, node] of props.nodes.entries()) {
      const nodeFrame = nodeFrames.get(node.id);
      const tone = node.tone || "muted";
      const fill = tone === "primary" ? PRIMARY : tone === "dark" ? INK : MUTED_SURFACE;
      const textColor = tone === "primary" || tone === "dark" ? WHITE : INK;
      nodes.push(rectPrimitive({ id: stableId(id, "node", node.id || index), role: "organization-node", frame: nodeFrame, style: boxStyle(fill, fill, HAIRLINE, token("radius.none")) }));
      const content = insetFrame(nodeFrame, 8), font = token("type.body");
      const label = measureText(node.label, content.width, { fontSize: tokenValue(font), bold: true, wrapWidthRatio: ENGINE_RESERVE });
      const detail = node.detail ? measureText(node.detail, content.width, { fontSize: tokenValue(font), wrapWidthRatio: ENGINE_RESERVE }) : null;
      const gap = detail ? tokenValue(token("space.2")) : 0;
      const height = label.height + gap + (detail?.height || 0);
      if (height > content.height) throw new Error("Organization node needs more room for its complete label and detail");
      const top = content.y + (content.height - height) / 2;
      nodes.push(textPrimitive({ id: stableId(id, "node-text", node.id || index), role: "node-label", frame: { ...content, y: top, height: label.height }, text: label.text, style: textStyle(font, textColor, true, "center", "top"), data: { textLayout: label } }));
      if (detail) nodes.push(textPrimitive({ id: stableId(id, "node-detail", node.id || index), role: "node-text", frame: { ...content, y: top + label.height + gap, height: detail.height }, text: detail.text, style: textStyle(font, textColor, false, "center", "top"), data: { textLayout: detail } }));
    }
    return nodes;
  }
  const nodes = [];
  const root = { x: frame.x + frame.width / 2 - 90, y: frame.y + 14, width: 180, height: 58 };
  nodes.push(rectPrimitive({ id: stableId(id, "root"), role: organization ? "organization-root" : "tree-root", frame: root, style: boxStyle(PRIMARY, PRIMARY, STANDARD, SMALL_RADIUS) }));
  nodes.push(textPrimitive({ id: stableId(id, "root-text"), role: "node-label", frame: insetFrame(root, 8), text: props.root, style: textStyle(COMPACT, WHITE, true, "center") }));
  const span = frame.width / props.children.length;
  props.children.forEach((child, index) => {
    const childFrame = { x: frame.x + span * index + 18, y: frame.y + frame.height * 0.52, width: span - 36, height: 74 };
    const centerX = childFrame.x + childFrame.width / 2;
    nodes.push(openLine(stableId(id, "connector", index), root.x + root.width / 2, root.y + root.height, centerX, childFrame.y, "tree-connector", SECONDARY, HAIRLINE));
    nodes.push(rectPrimitive({ id: stableId(id, "child", index), role: organization ? "organization-node" : "tree-node", frame: childFrame, style: boxStyle(index === 0 ? PRIMARY_TINT : SURFACE, RULE, HAIRLINE, SMALL_RADIUS) }));
    nodes.push(textPrimitive({ id: stableId(id, "child-text", index), role: "node-label", frame: insetFrame(childFrame, 8), text: child, style: textStyle(COMPACT, INK, true, "center") }));
  });
  return nodes;
}

function initiativeRolloutNodes({ id, frame, props }) {
  const years = props.years || ["20xx", "20xx", "20xx"];
  const rows = props.rows || [];
  const labelWidth = 72;
  const contentX = frame.x + labelWidth;
  const contentWidth = frame.width - labelWidth;
  const span = contentWidth / years.length;
  const nodes = [];
  years.forEach((year, index) => {
    const x = contentX + index * span;
    nodes.push(textPrimitive({ id: stableId(id, "year", index), role: "rollout-year", frame: { x: x + 8, y: frame.y, width: span - 16, height: 30 }, text: year, style: textStyle(token("type.heading"), INK, true, "left") }));
    nodes.push(openLine(stableId(id, "year-rule", index), x + 8, frame.y + 34, x + span - 8, frame.y + 34, "rollout-year-rule", INK, STANDARD));
  });
  const rowsTop = frame.y + 52;
  const rowGap = 12;
  const rowHeight = (frame.height - 52 - rowGap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length);
  const fills = [INK, token("color.chartSeries2"), MUTED_SURFACE];
  rows.forEach((row, rowIndex) => {
    const y = rowsTop + rowIndex * (rowHeight + rowGap);
    const markerSize = Math.min(48, rowHeight * 0.68);
    nodes.push(ellipsePrimitive({ id: stableId(id, "row-marker", rowIndex), role: "rollout-row-marker", frame: { x: frame.x + (labelWidth - markerSize) / 2, y: y + (rowHeight - markerSize) / 2, width: markerSize, height: markerSize }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "row-label", rowIndex), role: "rollout-row-label", frame: { x: frame.x + (labelWidth - markerSize) / 2, y: y + (rowHeight - markerSize) / 2, width: markerSize, height: markerSize }, text: row.label, style: textStyle(token("type.heading"), WHITE, true, "center") }));
    years.forEach((_, phaseIndex) => {
      const x = contentX + phaseIndex * span;
      const cell = row.phases?.[phaseIndex] || "";
      const dark = phaseIndex < 2;
      nodes.push(shapePrimitive({ id: stableId(id, "phase", rowIndex, phaseIndex), role: "rollout-phase", geometry: "chevron", frame: { x: x + 2, y, width: span + (phaseIndex < years.length - 1 ? 10 : -2), height: rowHeight }, style: boxStyle(fills[phaseIndex % fills.length], SURFACE, STANDARD, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "phase-label", rowIndex, phaseIndex), role: "rollout-phase-label", frame: { x: x + 30, y: y + 6, width: span - 50, height: rowHeight - 12 }, text: cell, style: textStyle(LABEL, dark ? WHITE : INK, false, "center") }));
    });
  });
  return nodes;
}

function waveRoadmapLayout(frame, props) {
  const items = props.items || [];
  if (!Array.isArray(items) || !items.length) throw new Error("Wave roadmap requires at least one stage");
  const span = frame.width / items.length, inset = tokenValue(token("space.2"));
  const width = span - 2 * inset, gap = tokenValue(token("space.4"));
  const markerSize = tokenValue(token("icon.medium"));
  const measure = (value, size, bold = false) => value ? measureText(value, width, { fontSize: tokenValue(size), bold, wrapWidthRatio: ENGINE_RESERVE }) : null;
  const list = (label, values) => {
    if (values !== undefined && !Array.isArray(values)) throw new Error(`Roadmap ${label} must be an array`);
    return values?.length ? `${label}\n${values.map(value => `▪  ${value}`).join("\n")}` : "";
  };
  // Surface treatment (core.mjs `style.timeline`): five dots on a hairline rail
  // with small type under them is a page of gaps. Under `blocks` each stage's
  // heading is set in a filled chevron - the phase block - on a heavier spine,
  // so the sequence reads as a row of solid phases before any list is read.
  // The chevron's notch and point take half its height at each end, so the
  // heading is measured that much narrower.
  const blocks = houseStyle("style.timeline") === "blocks";
  const blockPad = blocks ? tokenValue(token("space.2")) : 0;
  const cells = items.map((item, index) => ({
    range: measure(item.range || "", COMPACT, true),
    heading: blocks
      ? measureText(item.heading || item.label || `Wave ${index + 1}`, width - 2 * (tokenValue(token("space.3")) + blockPad), { fontSize: tokenValue(token("type.heading")), bold: true, wrapWidthRatio: ENGINE_RESERVE })
      : measure(item.heading || item.label || `Wave ${index + 1}`, token("type.heading"), true),
    activities: measure(list("Key activities", item.activities), COMPACT),
    deliverables: measure(list("Main deliverables", item.deliverables), COMPACT)
  }));
  const maximum = key => Math.max(0, ...cells.map(cell => cell[key]?.height ?? 0));
  const rangeHeight = maximum("range"), headingHeight = maximum("heading");
  const activitiesHeight = maximum("activities"), deliverablesHeight = maximum("deliverables");
  // The room the roadmap can take as rhythm rather than leave as a gap between
  // its last deliverable and the commentary under it. The stages open up: most
  // between the rail and the lists and between the two lists (up to 40px more
  // each, so no gap passes 56px - wider, and the lists read as separate blocks
  // with a band of nothing between them, which SCENE_VOID reports past a
  // seventh of the body), less between the heading and its marker (32px) - a
  // heading that drifts further from its marker stops labelling it - and least
  // between the date and the heading (8px). Proportionally, so the gaps keep
  // their relation to one another; past the caps the page keeps the rest as
  // its bottom margin (`ceilingSize` in core).
  const slots = { range: rangeHeight ? tokenValue(token("space.2")) : 0, heading: 32, activities: activitiesHeight || deliverablesHeight ? 40 : 0, deliverables: activitiesHeight && deliverablesHeight ? 40 : 0 };
  const growth = Object.values(slots).reduce((sum, value) => sum + value, 0);
  const natural = (spare) => {
    const share = (key) => growth ? slots[key] * spare / growth : 0;
    const headingTop = (rangeHeight ? rangeHeight + tokenValue(token("space.3")) + share("range") : 0) + blockPad;
    const railY = headingTop + headingHeight + blockPad + gap + share("heading") + markerSize / 2;
    const activitiesTop = railY + markerSize / 2 + gap + share("activities");
    const deliverablesTop = activitiesTop + activitiesHeight + (activitiesHeight && deliverablesHeight ? gap + share("deliverables") : 0);
    const height = (deliverablesHeight ? deliverablesTop + deliverablesHeight : activitiesHeight ? activitiesTop + activitiesHeight : railY + markerSize / 2) + inset;
    return { headingTop, railY, activitiesTop, deliverablesTop, height };
  };
  const base = natural(0);
  const spare = Number.isFinite(frame.height) ? Math.max(0, Math.min(growth, frame.height - base.height)) : 0;
  return { cells, span, inset, width, markerSize, rangeHeight, headingHeight, blocks, blockPad, ...natural(spare), naturalHeight: base.height, ceiling: base.height + growth };
}

function waveRoadmapNodes({ id, frame, props }) {
  const layout = waveRoadmapLayout(frame, props);
  if (layout.height > frame.height + 0.01) throw new Error(`Roadmap ${id} complete activity and deliverable rows need ${layout.height.toFixed(1)}px, but only ${frame.height}px is allocated; widen, regroup or split the stages`);
  const railY = frame.y + layout.railY;
  const nodes = [openLine(stableId(id, "rail"), frame.x, railY, frame.x + frame.width, railY, "roadmap-rail", RULE, layout.blocks ? token("line.medium") : STANDARD, { endArrow: true })];
  // The phase block is the filled surface, not the primary: five chevrons in a
  // saturated brand colour shouted over the page they head. The colour stays
  // on the markers; the blocks carry the weight in the neutral surface.
  const blockFill = token("color.surfaceTint"), chevron = tokenValue(token("space.3")) + layout.blockPad;
  layout.cells.forEach((cell, index) => {
    const x = frame.x + index * layout.span, center = x + layout.span / 2;
    if (layout.blocks) {
      // One chevron per stage, abutting the next so the row reads as one
      // sequence, the heading centred on it.
      const top = frame.y + layout.headingTop - layout.blockPad;
      nodes.push(shapePrimitive({ id: stableId(id, "phase", index), role: "roadmap-phase-surface", geometry: "chevron",
        frame: { x: x + 1, y: top, width: layout.span - 2, height: layout.headingHeight + 2 * layout.blockPad },
        style: boxStyle(blockFill, "none", HAIRLINE, token("radius.none")), data: { stage: index } }));
    }
    for (const [key, y, size, color, bold, align] of [
      ["range", layout.rangeHeight - (cell.range?.height ?? 0), COMPACT, SECONDARY, true, "center"],
      ["heading", layout.headingTop + (layout.blocks ? (layout.headingHeight - cell.heading.height) / 2 : layout.headingHeight - cell.heading.height), token("type.heading"), layout.blocks ? readableOn(INK, blockFill) : INK, true, "center"],
      ["activities", layout.activitiesTop, COMPACT, INK, false, "left"],
      ["deliverables", layout.deliverablesTop, COMPACT, INK, false, "left"]
    ]) {
      const text = cell[key];
      if (!text) continue;
      // A heading on a chevron is set in the width it was measured to, clear
      // of the notch and the point, and centred in the block's height: the
      // renderer owns the final wrap, and a heading the metrics wrapped that
      // the renderer sets on one line would otherwise sit at the block's top.
      const onBlock = key === "heading" && layout.blocks;
      const inset = onBlock ? chevron : 0;
      const box = onBlock
        ? { x: x + layout.inset + inset, y: frame.y + layout.headingTop - layout.blockPad, width: layout.width - 2 * inset, height: layout.headingHeight + 2 * layout.blockPad }
        : { x: x + layout.inset, y: frame.y + y, width: layout.width, height: text.height };
      nodes.push(textPrimitive({ id: stableId(id, key, index), role: `roadmap-${key}`, frame: box, text: text.text, style: { ...textStyle(size, color, bold, align, onBlock ? "mid" : "top"), lineHeight: text.lineHeight, wrap: false }, data: { textLayout: text } }));
    }
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: "roadmap-marker", frame: { x: center - layout.markerSize / 2, y: railY - layout.markerSize / 2, width: layout.markerSize, height: layout.markerSize }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
  });
  return nodes;
}

function highlightStripNodes({ id, frame, props }) {
  const items = props.items || [];
  const span = frame.width / Math.max(1, items.length);
  const nodes = [];
  items.forEach((item, index) => {
    const x = frame.x + index * span;
    const size = 40;
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: "highlight-marker", frame: { x: x + span / 2 - size / 2, y: frame.y, width: size, height: size }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "number", index), role: "highlight-number", frame: { x: x + span / 2 - size / 2, y: frame.y, width: size, height: size }, text: item.number || String(index + 1), style: textStyle(token("type.heading"), WHITE, false, "center") }));
    nodes.push(textPrimitive({ id: stableId(id, "heading", index), role: "highlight-heading", frame: { x: x + 6, y: frame.y + 48, width: span - 12, height: 28 }, text: item.heading || "Start highlight", style: textStyle(token("type.heading"), INK, true, "center") }));
    nodes.push(textPrimitive({ id: stableId(id, "description", index), role: "highlight-description", frame: { x: x + 6, y: frame.y + 80, width: span - 12, height: frame.height - 80 }, text: item.description || "(Insert description)", style: textStyle(COMPACT, INK, false, "center", "top") }));
  });
  return nodes;
}

function defineProcess() {
  return component({
    id: "process",
    category: "relationship",
    role: "process",
    tokens: [
      "color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard",
      "line.hairline", "radius.round"
    ],
    preferredSize: { width: 900, height: 280 },
    sample: { items: ["(Insert step 1)", "(Insert step 2)", "(Insert step 3)", "(Insert step 4)"], active: 2 },
    render: ({ id, frame, props }) => ({
      nodes: processNodes({
        id,
        frame,
        props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) }
      })
    })
  });
}

function defineChevronProcess() {
  return component({
    id: "chevron-process",
    category: "relationship",
    role: "process",
    tokens: [
      "color.ink", "color.componentPrimary", "color.surface", "color.surfaceMuted", "color.onPrimary", "font.body", "type.heading",
      "type.compact", "type.label", "line.hairline", "radius.none", "radius.round", "space.1", "space.3", "space.4"
    ],
    preferredSize: { width: 1160, height: 360 },
    sample: {
      items: [
        { heading: "Phase 1", label: "(Insert phase 1)", details: ["(Insert activity 1)", "(Insert activity 2)"] },
        { heading: "Phase 2", label: "(Insert phase 2)", details: ["(Insert activity 1)", "(Insert activity 2)"] },
        { heading: "Phase 3", label: "(Insert phase 3)", details: ["(Insert activity 1)", "(Insert activity 2)"] }
      ]
    },
    render: ({ id, frame, props }) => {
      const items = props.items;
      const span = frame.width / items.length;
      const headingHeight = items.some(item => item.heading?.trim()) ? 42 : 0;
      const nodes = [];
      items.forEach((item, index) => {
        const x = frame.x + index * span;
        if (item.heading?.trim()) nodes.push(textPrimitive({ id: stableId(id, "heading", index), role: "process-heading", frame: { x: x + 8, y: frame.y, width: span - 16, height: 34 }, text: item.heading, style: textStyle(token("type.heading"), INK, true, "left") }));
        nodes.push(shapePrimitive({ id: stableId(id, "band", index), role: "process-band", geometry: "chevron", frame: { x, y: frame.y + headingHeight, width: span + (index < items.length - 1 ? tokenValue(token("space.4")) : 0), height: 70 }, style: boxStyle(index === 0 && props.emphasizeFirst ? PRIMARY : INK, SURFACE, HAIRLINE, token("radius.none")) }));
        const label = measureText(item.label, span - 72, { fontSize: tokenValue(token("type.heading")), bold: true, wrapWidthRatio: ENGINE_RESERVE });
        if (label.height > 64) throw new Error("Process label exceeds its band; enlarge the component or shorten the copy");
        nodes.push(textPrimitive({ id: stableId(id, "label", index), role: "process-label", frame: { x: x + 36, y: frame.y + headingHeight + 35 - label.height / 2, width: span - 72, height: label.height }, text: label.text, style: { ...textStyle(token("type.heading"), WHITE, true, "center", "top"), lineHeight: label.lineHeight, wrap: false }, data: { textLayout: label } }));
        const details = item.details || [];
        nodes.push(...simpleList({ id: stableId(id, "details", index), frame: { x: x + 10, y: frame.y + headingHeight + 90, width: span - 26, height: frame.height - headingHeight - 94 }, items: details, numbered: props.detailStyle === "circled-number", marker: "circle", rolePrefix: "process-detail" }));
      });
      return { nodes };
    }
  });
}

function defineInitiativeRollout() {
  return component({
    id: "initiative-rollout",
    category: "relationship",
    role: "initiative-rollout",
    tokens: [
      "color.ink", "color.componentPrimary", "color.chartSeries2", "color.surfaceMuted", "color.surface", "color.onPrimary", "font.body",
      "type.heading", "type.compact", "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"
    ],
    preferredSize: { width: 1160, height: 450 },
    sample: {
      years: ["Year 1", "Year 2", "Year 3"],
      rows: [
        { label: "A", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] },
        { label: "B", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] }
      ]
    },
    render: ({ id, frame, props }) => ({ nodes: initiativeRolloutNodes({ id, frame, props }) })
  });
}

function defineHighlightStrip() {
  return component({
    id: "highlight-strip",
    category: "relationship",
    role: "highlight-strip",
    tokens: [
      "color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "radius.round"
    ],
    preferredSize: { width: 1160, height: 126 },
    sample: {
      items: [
        { number: "1", heading: "(Insert highlight)", description: "(Insert description)" },
        { number: "2", heading: "(Insert highlight)", description: "(Insert description)" },
        { number: "3", heading: "(Insert highlight)", description: "(Insert description)" }
      ]
    },
    render: ({ id, frame, props }) => ({ nodes: highlightStripNodes({ id, frame, props }) })
  });
}

function defineRoadmap() {
  return component({
    id: "roadmap",
    category: "relationship",
    role: "roadmap",
    tokens: [
      "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary",
      "color.ink", "color.textSecondary", "font.body", "type.heading", "type.compact", "type.label", "line.standard", "line.medium",
      "line.hairline", "radius.round", "radius.small", "radius.none", "color.surfaceTint"
    ],
    preferredSize: { width: 980, height: 360 },
    sample: { items: ["(Insert stage 1)", "(Insert stage 2)", "(Insert stage 3)", "(Insert stage 4)"], active: 1 },
    // Stages that carry their period or their detail are set at reading size
    // and sized to their content (schedule-stages.mjs); a row of bare labels
    // stays the strip it is.
    render: ({ id, frame, props }) => ({
      nodes: props.variant === "wave-columns"
        ? waveRoadmapNodes({ id, frame, props })
        : detailedStages(props.items) ? stagesNodes({ id, frame, props, roadmap: true })
        : processNodes({
          id,
          frame,
          props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) },
          roadmap: true
        })
    })
  });
}

function defineTimeline() {
  return component({
    id: "timeline",
    category: "relationship",
    role: "timeline",
    tokens: [
      "color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard",
      "line.hairline", "radius.round"
    ],
    preferredSize: { width: 920, height: 250 },
    sample: { items: ["Q1", "Q2", "Q3", "Q4"], active: 2 },
    // Dated stages are set at reading size and sized to their content
    // (schedule-stages.mjs); bare labels stay a numbered strip.
    render: ({ id, frame, props }) => ({
      nodes: detailedStages(props.items) ? stagesNodes({ id, frame, props })
        : processNodes({ id, frame, props: { ...props, items: props.items.map((label) => (typeof label === "string" ? { label } : label)) } })
    })
  });
}

function defineJourney() {
  return component({
    id: "journey",
    category: "relationship",
    role: "journey",
    tokens: [
      "color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact",
      "type.label", "line.standard", "line.hairline", "radius.round"
    ],
    preferredSize: { width: 960, height: 300 },
    sample: {
      items: [
        { label: "(Insert stage 1)", touchpoint: "(Insert touchpoint 1)" },
        { label: "(Insert stage 2)", touchpoint: "(Insert touchpoint 2)" },
        { label: "(Insert stage 3)", touchpoint: "(Insert touchpoint 3)" },
        { label: "(Insert stage 4)", touchpoint: "(Insert touchpoint 4)" }
      ],
      active: 3
    },
    render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props, journey: true }) })
  });
}

function defineTree() {
  return component({
    id: "tree",
    category: "relationship",
    role: "tree",
    tokens: [
      "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.rule", "color.onPrimary", "color.ink",
      "color.textSecondary", "font.body", "type.compact", "line.hairline", "line.standard", "radius.small"
    ],
    preferredSize: { width: 900, height: 360 },
    sample: {
      root: "(Insert root question)",
      children: ["(Insert branch 1)", "(Insert branch 2)", "(Insert branch 3)", "(Insert branch 4)"]
    },
    render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props }) })
  });
}

function defineOrganization() {
  return component({
    id: "organization",
    category: "relationship",
    role: "organization",
    tokens: [
      "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary",
      "color.ink", "color.textSecondary", "font.body", "type.compact", "type.body", "space.2", "space.4", "line.hairline", "line.standard",
      "radius.none", "radius.small"
    ],
    preferredSize: { width: 900, height: 360 },
    sample: { root: "(Insert parent role)", children: ["(Insert role 1)", "(Insert role 2)", "(Insert role 3)", "(Insert role 4)"] },
    render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props, organization: true }) })
  });
}

/** Process, roadmap and tree: steps and chevrons, rollouts, roadmaps, timelines, journeys, trees and organisation charts. */
export function registerProcessFamily(registry) {
  const definitions = [defineProcess(), defineChevronProcess(), defineInitiativeRollout(), defineHighlightStrip(), defineRoadmap(), defineTimeline(),
    defineJourney(), defineTree(), defineOrganization()];
  for (const definition of definitions) {
    if (["process", "roadmap", "timeline", "journey"].includes(definition.id)) {
      definition.tokens.push("space.2");
      definition.version = "2.1.0";
    }
    refineVariantAxes(definition);
    if (definition.id === "process") definition.measureCeiling = ({ frame, props }) => processCeiling(frame, props, false, definition.preferredSize.height);
    if (definition.id === "timeline") {
      definition.version = "2.2.0";
      definition.tokens = [...new Set([...definition.tokens, ...SCHEDULE_TOKENS])];
      definition.variants = { process: {}, ...SCHEDULE_VARIANTS, "phase-hierarchy": { preferredSize:{width:1160,height:380}, props:{...PHASE_HIERARCHY_SAMPLE,items:undefined} } };
      definition.tokens = [...new Set([...definition.tokens,...QUALITATIVE_TOPOLOGY_TOKENS])];
      definition.version = "2.3.0";
      definition.defaultVariant = "process";
      definition.variantProp = "variant";
      definition.resolveVariant = (props = {}) => {
        const variant = props.variant ?? "process";
        if (!Object.hasOwn(definition.variants, variant)) throw new Error(`Unknown timeline variant: ${variant}`);
        return variant;
      };
      const render = definition.render;
      const schedule = input => definition.resolveVariant(input.props) === "phase-hierarchy" ? renderPhaseHierarchy(input) : definition.resolveVariant(input.props) === "time-grid" ? timeGrid(input) : datedLanes(input);
      definition.render = input => definition.resolveVariant(input.props) === "process" ? render(input) : schedule(input);
      const staged = input => definition.resolveVariant(input.props) === "process" && detailedStages(input.props.items);
      definition.tokens = [...new Set([...definition.tokens, ...STAGE_TOKENS])];
      definition.measureIntrinsic = input => staged(input) ? { height: stagesLayout({ ...input.frame, height: undefined }, input.props, { id: input.id }).natural }
        : definition.resolveVariant(input.props) === "process" ? null : schedule({ ...input, id: input.id ?? "measure", frame: { ...input.frame, height: input.frame.height ?? Number.MAX_SAFE_INTEGER } });
      // A dated schedule is drawn at its natural height from the top of its
      // frame, so that height is its ceiling - any frame beyond it would be a
      // gap before the commentary; the process variant keeps its proportional
      // ceiling.
      definition.measureCeiling = input => staged(input) ? stagesLayout(input.frame, input.props).ceiling
        : definition.resolveVariant(input.props) === "process"
        ? processCeiling(input.frame, input.props, false, 250)
        : schedule({ ...input, id: "ceiling", frame: { ...input.frame, height: Number.MAX_SAFE_INTEGER } }).height;
    }
    if (definition.id === "roadmap") {
      definition.version = "2.2.0";
      definition.tokens.push("space.2", "space.3", "space.4", "icon.medium");
      definition.variants["wave-columns"] = { preferredSize: { width: 1160, height: 480 }, props: { items: [1, 2, 3].map((index) => ({ heading: `(Insert wave ${index} heading)`, range: `(Insert time range ${index})`, activities: ["(Insert activity)"], deliverables: ["(Insert deliverable)"] })) } };
      definition.version = "2.3.0";
      definition.tokens = [...new Set([...definition.tokens, ...PHASE_WORKSTREAM_TOKENS])];
      Object.assign(definition.variants, PHASE_WORKSTREAM_VARIANTS);
      const priorResolve = definition.resolveVariant;
      definition.resolveVariant = props => props?.variant === "phase-workstreams" ? "phase-workstreams" : priorResolve(props);
      const priorRender = definition.render;
      definition.render = input => definition.resolveVariant(input.props) === "phase-workstreams" ? renderPhaseWorkstreams(input) : priorRender(input);
      const staged = (props) => definition.resolveVariant(props) === "process" && detailedStages(props.items);
      definition.tokens = [...new Set([...definition.tokens, ...STAGE_TOKENS])];
      definition.measureIntrinsic = ({ frame, props }) => definition.resolveVariant(props) === "phase-workstreams" ? measurePhaseWorkstreams({frame,props}) : definition.resolveVariant(props) === "wave-columns" ? { height: waveRoadmapLayout({ ...frame, height: undefined }, props).naturalHeight }
        : staged(props) ? { height: stagesLayout({ ...frame, height: undefined }, props, { roadmap: true }).natural } : null;
      definition.measureCeiling = ({ frame, props }) => definition.resolveVariant(props) === "wave-columns" ? waveRoadmapLayout({ ...frame, height: undefined }, props).ceiling
        : staged(props) ? stagesLayout(frame, props, { roadmap: true }).ceiling : definition.resolveVariant(props) === "process" ? processCeiling(frame, props, true) : null;
    }
    registry.set(definition.id, definition);
  }
  return registry;
}
