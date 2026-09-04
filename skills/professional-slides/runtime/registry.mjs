import {
  CHROME,
  DEFAULT_TITLE_VARIANT,
  SLIDE,
  TITLE_VARIANTS,
  TOKENS,
  assertSectionHeadingProps,
  ellipsePrimitive,
  insetFrame,
  linePrimitive,
  normalizeInsets,
  rectPrimitive,
  resolveTitleVariant,
  shapePrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue,
  wedgePrimitive
} from "./core.mjs";
import { registerCharts } from "./charts.mjs";
import { measureText } from "./text-layout.mjs";
import { routeConnector } from "./routing.mjs";
import { legendNodes, LEGEND_TOKENS, LEGEND_VARIANTS, LEGEND_PLACEMENTS } from "./legends.mjs";
import { registerChartGroup } from "./chart-group.mjs";
import { contrastRatio } from "./palettes.mjs";
import { PAGE_RULES, PAGE_BRANDING, PAGE_TEMPLATE_TOKENS, pageTemplateLayout, renderPageTemplate, resolvePageTemplate } from "./page-template.mjs";

const FONT = token("font.body");
const DISPLAY = token("font.display");
const SERIF = token("font.serif");
const INK = token("color.ink");
const SECONDARY = token("color.textSecondary");
const PRIMARY = token("color.componentPrimary");
const PRIMARY_TINT = token("color.componentPrimaryTint");
const SURFACE = token("color.surface");
const MUTED_SURFACE = token("color.surfaceMuted");
const RULE = token("color.rule");
const WHITE = token("color.onPrimary");
const HAIRLINE = token("line.hairline");
const STANDARD = token("line.standard");
const SMALL_RADIUS = token("radius.small");
const BODY = token("type.body");
const COMPACT = token("type.compact");
const LABEL = token("type.label");
const SOURCE = token("type.source");
const SECTION_HEADING_TOKENS = ["color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "type.heading", "line.hairline", "space.2", "space.3"];

const textStyle = (size = BODY, color = INK, bold = false, align = "left", valign = "mid") => ({
  fontFamily: FONT,
  fontSize: size,
  color,
  bold,
  align,
  valign
});

const boxStyle = (fill = SURFACE, stroke = RULE, lineWidth = HAIRLINE, radius = SMALL_RADIUS) => ({
  fill,
  stroke,
  lineWidth,
  radius
});

const openLine = (id, x1, y1, x2, y2, role = "rule", stroke = RULE, lineWidth = HAIRLINE, data = {}) => linePrimitive({
  id,
  role,
  x1,
  y1,
  x2,
  y2,
  style: { stroke, lineWidth },
  data
});

const component = ({ id, category, role = category, tokens, preferredSize, sample, render }) => ({
  id,
  version: "2.0.0",
  category,
  role,
  tokens: [...new Set(tokens)].sort(),
  preferredSize,
  sample,
  render
});

function measuredTextNode(input) {
  const textLayout = measureText(input.text, input.frame.width, { fontFamily: tokenValue(input.style.fontFamily), fontSize: tokenValue(input.style.fontSize), bold: input.style.bold, wrapWidthRatio: 1 });
  if (textLayout.height > input.frame.height) throw new Error(`${input.id} exceeds its allocated text height`);
  return textPrimitive({ ...input, text: textLayout.text, style: { ...input.style, lineHeight: textLayout.lineHeight, wrap: false }, data: { ...input.data, textLayout } });
}

function titleNodes({ id, frame, props, section = false, chrome = false }) {
  const variant = resolveTitleVariant(props);
  const ruleGap = tokenValue(token("space.2"));
  const size = section ? token("type.sectionTitle") : token(chrome && String(props.text || "").length > 55 ? "type.actionTitleLong" : "type.actionTitle");
  const textFrame = chrome
    ? { x: frame.x + CHROME.left, y: frame.y + CHROME.titleTop, width: props.availableTitleWidth ?? frame.width - CHROME.left - CHROME.right, height: CHROME.titleHeight }
    : { x: frame.x, y: frame.y, width: frame.width, height: frame.height - ruleGap };
  const textLayout = measureText(props.text, textFrame.width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(size), bold: true, wrapWidthRatio: 1 });
  const ruleY = textFrame.y + textLayout.height + ruleGap;
  if (textLayout.height > textFrame.height) throw new Error(`Title ${id} exceeds its allocated height; shorten it or allocate more space`);
  const nodes = [textPrimitive({
    id: stableId(id, chrome ? "title" : "text"),
    role: section ? "section-title" : "action-title",
    frame: textFrame,
    text: textLayout.text,
    style: { ...textStyle(size, INK, true), fontFamily: DISPLAY, valign: "top", lineHeight: textLayout.lineHeight, wrap: false },
    data: { titleVariant: variant, textLayout, ruleGap }
  })];
  if (TITLE_VARIANTS[variant].rule) nodes.push(openLine(stableId(id, chrome ? "title-rule" : "rule"), textFrame.x, ruleY, textFrame.x + textFrame.width, ruleY, "title-rule", RULE, HAIRLINE, { titleVariant: variant }));
  return nodes;
}

function headingLayout(frame, props = {}) {
  assertSectionHeadingProps(props);
  const headingWidth = frame.width;
  const heading = measureText(props.heading || props.text || "", headingWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold: true });
  const bandHeight = Math.max(heading.height, props.headerBandHeight || 0);
  const ruleGap = tokenValue(token("space.2"));
  const contentGap = tokenValue(token("space.3"));
  return { heading, headingWidth, bandHeight, ruleGap, height: bandHeight + (props.rule === false ? 0 : ruleGap) + contentGap };
}

function sectionHeadingNodes({ id, frame, props = {} }) {
  const variant = props.variant || "standard";
  const color = variant === "inverse" ? WHITE : variant === "accent" ? PRIMARY : INK;
  const showRule = props.rule !== false;
  const layout = headingLayout(frame, props);
  const { heading, headingWidth, bandHeight, ruleGap } = layout;
  const nodes = [textPrimitive({
    id: stableId(id, "heading"),
    role: "section-heading",
    frame: { x: frame.x, y: frame.y + bandHeight - heading.height, width: headingWidth, height: heading.height },
    text: heading.text,
    style: { ...textStyle(token("type.heading"), color, true, "left", "top"), lineHeight: heading.lineHeight, wrap: false },
    data: { textLayout: heading, headerTop: frame.y, headerBandHeight: bandHeight, ruleGap }
  })];
  if (showRule) nodes.push(openLine(stableId(id, "rule"), frame.x, frame.y + bandHeight + ruleGap, frame.x + frame.width, frame.y + bandHeight + ruleGap, "section-heading-rule", color, HAIRLINE));
  return nodes;
}

function resolveChartTitleVariant(props = {}) {
  const variant = props.variant ?? (props.unit ? "unit" : "underlined");
  if (!["underlined", "unit"].includes(variant)) throw new Error(`Unknown chart-title variant: ${variant}`);
  if (variant === "unit" && (typeof props.unit !== "string" || !props.unit.trim()) || variant === "underlined" && props.unit) throw new Error("Chart title unit conflicts with its variant");
  return variant;
}
function chartTitleLayout(frame, props) {
  const variant = resolveChartTitleVariant(props);
  const layout = headingLayout(frame, { ...props, rule: variant === "underlined" });
  const unit = variant === "unit" ? measureText(props.unit, frame.width, { fontSize: tokenValue(COMPACT), wrapWidthRatio: 1 }) : null;
  if (unit && unit.lines.length !== 1) throw new Error("Chart unit must fit on one line");
  const height = layout.bandHeight + (unit ? tokenValue(token("space.1")) + unit.height : layout.ruleGap) + tokenValue(token("space.3"));
  return { ...layout, variant, unit, height };
}
function chartTitleNodes({ id, frame, props }) {
  const layout = chartTitleLayout(frame, props);
  if (layout.height > frame.height) throw new Error("Chart title exceeds its allocated height");
  const nodes = sectionHeadingNodes({ id, frame, props: { ...props, variant: "standard", rule: layout.variant === "underlined" } });
  nodes.forEach(node => { node.data.chartTitleVariant = layout.variant; });
  if (layout.unit) nodes.push(textPrimitive({ id: stableId(id, "unit"), role: "chart-unit", frame: { x: frame.x, y: frame.y + layout.bandHeight + tokenValue(token("space.1")), width: frame.width, height: layout.unit.height }, text: props.unit, style: { ...textStyle(COMPACT, token("color.chartUnit"), false, "left", "top"), lineHeight: layout.unit.lineHeight, wrap: false }, data: { textLayout: layout.unit } }));
  return nodes;
}

function estimatedLines(text, width) {
  const charactersPerLine = Math.max(12, Math.floor(width / 7));
  return String(text).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
}

function simpleList({ id, frame, items, numbered = false, markerColor = PRIMARY, marker = "square", distribute = false, rolePrefix = "list" }) {
  const defaultGap = tokenValue(token("space.3"));
  const minimumGap = tokenValue(token("space.1"));
  const markerSize = numbered ? 24 : marker === "square" ? 6 : 18;
  const textOffset = numbered ? 36 : marker === "square" ? 18 : 36;
  const textWidth = Math.max(1, frame.width - textOffset);
  let heights = items.map((item) => Math.max(28, estimatedLines(item, textWidth) * 20));
  let gap = defaultGap;
  if (distribute) {
    const distributedHeight = (frame.height - defaultGap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
    heights = items.map(() => distributedHeight);
  } else {
    const desiredHeight = heights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, items.length - 1);
    if (desiredHeight > frame.height && items.length > 1) {
      gap = minimumGap;
      const available = Math.max(items.length * 20, frame.height - gap * (items.length - 1));
      const scale = Math.min(1, available / heights.reduce((sum, value) => sum + value, 0));
      heights = heights.map((value) => Math.max(20, value * scale));
    }
  }
  const nodes = [];
  let cursor = frame.y;
  items.forEach((item, index) => {
    const height = heights[index];
    const y = cursor;
    if (numbered) {
      nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, frame: { x: frame.x, y: y + 2, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.round")) }));
      nodes.push(textPrimitive({ id: stableId(id, "marker-label", index), role: `${rolePrefix}-marker-label`, frame: { x: frame.x, y: y + 2, width: markerSize, height: markerSize }, text: String(index + 1), style: textStyle(LABEL, WHITE, true, "center") }));
    } else if (marker === "square") {
      nodes.push(rectPrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, frame: { x: frame.x + 2, y: y + 9, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.none")) }));
    } else {
      nodes.push(shapePrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, geometry: "rightArrow", frame: { x: frame.x + 2, y: y + 5, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.none")) }));
    }
    nodes.push(textPrimitive({ id: stableId(id, "item", index), role: `${rolePrefix}-item`, frame: { x: frame.x + textOffset, y, width: textWidth, height }, text: item, style: textStyle(COMPACT, INK, false, "left", "top") }));
    cursor += height + gap;
  });
  return nodes;
}

function tableNodes({ id, frame, props, heatmap = false, comparison = false }) {
  const rows = props.rows;
  const columns = props.columns;
  const rowCount = rows.length + 1;
  const columnCount = columns.length;
  const rowHeight = frame.height / rowCount;
  const declaredWidths = props.columnWidths;
  const firstWidth = frame.width * (comparison ? 0.34 : 0.28);
  const otherWidth = (frame.width - firstWidth) / Math.max(1, columnCount - 1);
  const widths = declaredWidths
    ? declaredWidths.map((value) => value * frame.width)
    : columns.map((_, index) => index === 0 ? firstWidth : otherWidth);
  const xs = widths.map((_, index) => frame.x + widths.slice(0, index).reduce((sum, value) => sum + value, 0));
  const nodes = [];
  columns.forEach((label, column) => {
    const headerFill = props.headerTone === "dark" || column === 0 ? token("color.ink") : PRIMARY;
    nodes.push(rectPrimitive({ id: stableId(id, "header-cell", column), role: "table-header-cell", frame: { x: xs[column], y: frame.y, width: widths[column], height: rowHeight }, style: boxStyle(headerFill, headerFill, HAIRLINE, token("radius.none")) }));
    nodes.push(textPrimitive({ id: stableId(id, "header-text", column), role: "table-header-text", frame: { x: xs[column] + 8, y: frame.y + 4, width: widths[column] - 16, height: rowHeight - 8 }, text: label, style: textStyle(LABEL, WHITE, true, column === 0 ? "left" : "center") }));
  });
  rows.forEach((row, rowIndex) => {
    row.forEach((value, column) => {
      let fill = props.alternating === false ? SURFACE : rowIndex % 2 ? MUTED_SURFACE : SURFACE;
      if (heatmap && column > 0) {
        const palette = [token("color.surfaceMuted"), token("color.componentPrimaryTint"), token("color.chartSeries1"), token("color.chartSeries2"), token("color.ink")];
        fill = palette[Math.max(0, Math.min(4, Number(value) - 1))];
      }
      if (comparison && column > 0 && props.selectedColumn === column) fill = PRIMARY_TINT;
      nodes.push(rectPrimitive({ id: stableId(id, "cell", rowIndex, column), role: "table-cell", frame: { x: xs[column], y: frame.y + (rowIndex + 1) * rowHeight, width: widths[column], height: rowHeight }, style: boxStyle(fill, RULE, HAIRLINE, token("radius.none")), data: { row: rowIndex, column } }));
      nodes.push(textPrimitive({ id: stableId(id, "cell-text", rowIndex, column), role: "table-cell-text", frame: { x: xs[column] + 8, y: frame.y + (rowIndex + 1) * rowHeight + 4, width: widths[column] - 16, height: rowHeight - 8 }, text: String(value), style: textStyle(LABEL, heatmap && column > 0 && Number(value) > 3 ? WHITE : INK, column === 0, column === 0 ? "left" : "center") }));
    });
  });
  return nodes;
}

function processNodes({ id, frame, props, roadmap = false, journey = false }) {
  const items = props.items;
  const nodes = [];
  const span = frame.width / items.length;
  const railY = frame.y + frame.height * (roadmap ? 0.32 : 0.48);
  nodes.push(openLine(stableId(id, "rail"), frame.x + span * 0.35, railY, frame.x + frame.width - span * 0.35, railY, "process-rail", PRIMARY, STANDARD));
  items.forEach((item, index) => {
    const center = frame.x + span * (index + 0.5);
    const active = props.active === index;
    nodes.push(ellipsePrimitive({ id: stableId(id, "step-marker", index), role: "process-marker", frame: { x: center - 18, y: railY - 18, width: 36, height: 36 }, style: boxStyle(active ? PRIMARY : SURFACE, PRIMARY, STANDARD, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "step-number", index), role: "process-number", frame: { x: center - 18, y: railY - 18, width: 36, height: 36 }, text: String(index + 1), style: textStyle(LABEL, active ? WHITE : PRIMARY, true, "center") }));
    nodes.push(textPrimitive({ id: stableId(id, "step-label", index), role: "process-label", frame: { x: frame.x + span * index + 6, y: railY + 28, width: span - 12, height: 58 }, text: item.label || item, style: textStyle(COMPACT, INK, true, "center", "top") }));
    if (roadmap) nodes.push(rectPrimitive({ id: stableId(id, "phase-band", index), role: "roadmap-phase", frame: { x: frame.x + span * index + 10, y: frame.y + frame.height * 0.58, width: span - 20, height: frame.height * 0.24 }, style: boxStyle(index % 2 ? MUTED_SURFACE : PRIMARY_TINT, RULE, HAIRLINE, SMALL_RADIUS) }));
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
      const route = routeConnector({ x: fromX, y: fromY }, { x: toX, y: toY }, [...nodeFrames.values()]);
      route.slice(1).forEach((point, segment) => nodes.push(openLine(stableId(id, "connector", index, segment), route[segment].x, route[segment].y, point.x, point.y, "tree-connector", SECONDARY, HAIRLINE, { from: connector.from, to: connector.to })));
    }
    for (const [index, node] of props.nodes.entries()) {
      const nodeFrame = nodeFrames.get(node.id);
      const tone = node.tone || "muted";
      const fill = tone === "primary" ? PRIMARY : tone === "dark" ? INK : MUTED_SURFACE;
      const textColor = tone === "primary" || tone === "dark" ? WHITE : INK;
      nodes.push(rectPrimitive({ id: stableId(id, "node", node.id || index), role: "organization-node", frame: nodeFrame, style: boxStyle(fill, fill, HAIRLINE, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "node-text", node.id || index), role: "node-label", frame: insetFrame(nodeFrame, 5), text: node.label, style: textStyle(COMPACT, textColor, false, "center") }));
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

function trendRowNodes({ id, frame, props }) {
  const columns = props.columns || ["Trend", "Description", "Examples"];
  const widths = [frame.width * 0.13, frame.width * 0.52, frame.width * 0.35];
  const xs = [frame.x, frame.x + widths[0] + 20, frame.x + widths[0] + widths[1] + 40];
  const nodes = [];
  const headerBandHeight = Math.max(...columns.map((heading, index) => headingLayout({ ...frame, width: widths[index] - 8 }, { heading }).bandHeight));
  columns.forEach((label, index) => {
    nodes.push(...sectionHeadingNodes({ id: stableId(id, "column", index), frame: { x: xs[index], y: frame.y, width: widths[index] - 8, height: frame.height }, props: { heading: label, headerBandHeight } }));
  });
  const headerHeight = headerBandHeight + tokenValue(token("space.2")) + tokenValue(token("space.3"));
  const rowTop = frame.y + headerHeight;
  const rowHeight = (frame.height - headerHeight) / props.rows.length;
  props.rows.forEach((row, index) => {
    const y = rowTop + index * rowHeight;
    const block = { x: xs[0], y: y + 4, width: widths[0] - 8, height: rowHeight - 14 };
    nodes.push(rectPrimitive({ id: stableId(id, "trend", index), role: "trend-label-surface", frame: block, style: boxStyle(INK, INK, HAIRLINE, token("radius.none")) }));
    nodes.push(textPrimitive({ id: stableId(id, "trend-label", index), role: "trend-label", frame: insetFrame(block, 10), text: row[0], style: textStyle(token("type.heading"), WHITE, true, "left") }));
    nodes.push(textPrimitive({ id: stableId(id, "description", index), role: "trend-description", frame: { x: xs[1], y: y + 4, width: widths[1] - 16, height: rowHeight - 14 }, text: row[1], style: textStyle(COMPACT, INK, false, "left", "top") }));
    nodes.push(textPrimitive({ id: stableId(id, "examples", index), role: "trend-examples", frame: { x: xs[2], y: y + 4, width: widths[2] - 8, height: rowHeight - 14 }, text: row[2], style: textStyle(COMPACT, INK, false, "left", "top") }));
    if (index < props.rows.length - 1) nodes.push(openLine(stableId(id, "row-rule", index), frame.x, y + rowHeight - 2, frame.x + frame.width, y + rowHeight - 2, "table-row-rule", RULE, HAIRLINE));
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

function waveRoadmapNodes({ id, frame, props }) {
  const items = props.items || [];
  const span = frame.width / items.length;
  const railY = frame.y + frame.height * 0.40;
  const nodes = [openLine(stableId(id, "rail"), frame.x, railY, frame.x + frame.width, railY, "roadmap-rail", RULE, STANDARD, { endArrow: true })];
  items.forEach((item, index) => {
    const x = frame.x + index * span;
    const center = x + span / 2;
    nodes.push(textPrimitive({ id: stableId(id, "range", index), role: "roadmap-range", frame: { x: x + 8, y: frame.y, width: span - 16, height: 28 }, text: item.range || "[MONTH RANGE]", style: textStyle(COMPACT, SECONDARY, true, "center") }));
    const heading = measureText(item.heading || item.label || `Wave ${index + 1}`, span - 16, { fontSize: tokenValue(token("type.heading")), bold: true });
    if (frame.y + 42 + heading.height > railY - 20) throw new Error("Roadmap heading exceeds its band; enlarge the component or shorten the copy");
    nodes.push(textPrimitive({ id: stableId(id, "heading", index), role: "roadmap-heading", frame: { x: x + 8, y: frame.y + 42, width: span - 16, height: heading.height }, text: heading.text, style: { ...textStyle(token("type.heading"), INK, true, "center", "top"), lineHeight: heading.lineHeight, wrap: false }, data: { textLayout: heading } }));
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: "roadmap-marker", frame: { x: center - 15, y: railY - 15, width: 30, height: 30 }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "activities", index), role: "roadmap-activities", frame: { x: x + 8, y: railY + 36, width: span - 16, height: 112 }, text: `Key activities\n${(item.activities || []).map((value) => `▪  ${value}`).join("\n")}`, style: textStyle(COMPACT, INK, false, "left", "top") }));
    nodes.push(textPrimitive({ id: stableId(id, "deliverables", index), role: "roadmap-deliverables", frame: { x: x + 8, y: railY + 176, width: span - 16, height: frame.height - (railY - frame.y) - 178 }, text: `Main deliverables\n${(item.deliverables || []).map((value) => `▪  ${value}`).join("\n")}`, style: textStyle(COMPACT, INK, false, "left", "top") }));
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
    nodes.push(textPrimitive({ id: stableId(id, "description", index), role: "highlight-description", frame: { x: x + 6, y: frame.y + 80, width: span - 12, height: frame.height - 80 }, text: item.description || "[Insert description]", style: textStyle(COMPACT, INK, false, "center", "top") }));
  });
  return nodes;
}

function matrixNodes({ id, frame, props }) {
  const nodes = [];
  const plotInset = 54;
  const plot = { x: frame.x + plotInset, y: frame.y + 18, width: frame.width - plotInset - 28, height: frame.height - 68 };
  if (props.highlightQuadrant === "topRight") nodes.push(rectPrimitive({ id: stableId(id, "quadrant-highlight"), role: "matrix-highlight", frame: { x: plot.x + plot.width / 2, y: plot.y, width: plot.width / 2, height: plot.height / 2 }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.none")) }));
  nodes.push(openLine(stableId(id, "x-axis"), plot.x, plot.y + plot.height, plot.x + plot.width, plot.y + plot.height, "matrix-axis", INK, STANDARD));
  nodes.push(openLine(stableId(id, "y-axis"), plot.x, plot.y, plot.x, plot.y + plot.height, "matrix-axis", INK, STANDARD));
  nodes.push(openLine(stableId(id, "vertical-split"), plot.x + plot.width / 2, plot.y, plot.x + plot.width / 2, plot.y + plot.height, "matrix-boundary", RULE, HAIRLINE));
  nodes.push(openLine(stableId(id, "horizontal-split"), plot.x, plot.y + plot.height / 2, plot.x + plot.width, plot.y + plot.height / 2, "matrix-boundary", RULE, HAIRLINE));
  props.points.forEach((point, index) => {
    const x = plot.x + point.x * plot.width;
    const y = plot.y + (1 - point.y) * plot.height;
    const size = point.size || (props.bubbles ? 76 : 18);
    const color = point.state === "positive" ? token("color.positive") : point.state === "caution" ? token("color.caution") : point.state === "negative" ? token("color.negative") : index === props.highlight ? PRIMARY : token("color.chartSeries2");
    nodes.push(ellipsePrimitive({ id: stableId(id, "point", index), role: "matrix-point", frame: { x: x - size / 2, y: y - size / 2, width: size, height: size }, style: boxStyle(color, SURFACE, HAIRLINE, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "point-label", index), role: "matrix-point-label", frame: props.bubbles ? { x: x - size * 0.4, y: y - size * 0.32, width: size * 0.8, height: size * 0.64 } : { x: x + 12, y: y - 10, width: 94, height: 22 }, text: point.label, style: textStyle(LABEL, props.bubbles ? WHITE : INK, true, props.bubbles ? "center" : "left") }));
  });
  return nodes;
}

function mapNodes({ id, frame, props }) {
  const nodes = [];
  const continentSpecs = [
    ["north-america", "trapezoid", 0.05, 0.18, 0.27, 0.3],
    ["south-america", "parallelogram", 0.24, 0.49, 0.13, 0.36],
    ["greenland", "pentagon", 0.27, 0.08, 0.1, 0.13],
    ["europe", "hexagon", 0.45, 0.22, 0.15, 0.12],
    ["africa", "pentagon", 0.46, 0.36, 0.16, 0.35],
    ["asia", "trapezoid", 0.56, 0.17, 0.34, 0.34],
    ["india", "triangle", 0.67, 0.45, 0.08, 0.17],
    ["australia", "pentagon", 0.78, 0.68, 0.15, 0.15],
    ["japan", "ellipse", 0.88, 0.36, 0.025, 0.09]
  ];
  for (const [name, geometry, x, y, width, height] of continentSpecs) {
    const primitiveFrame = { x: frame.x + x * frame.width, y: frame.y + y * frame.height, width: width * frame.width, height: height * frame.height };
    nodes.push(geometry === "ellipse"
      ? ellipsePrimitive({ id: stableId(id, "land", name), role: "map-land", frame: primitiveFrame, style: boxStyle(MUTED_SURFACE, MUTED_SURFACE, HAIRLINE, token("radius.round")) })
      : shapePrimitive({ id: stableId(id, "land", name), role: "map-land", geometry, frame: primitiveFrame, style: boxStyle(MUTED_SURFACE, MUTED_SURFACE, HAIRLINE, token("radius.none")) }));
  }
  for (const [index, marker] of (props.markers || []).entries()) {
    const size = marker.size || 34;
    const markerFrame = { x: frame.x + marker.x * frame.width - size / 2, y: frame.y + marker.y * frame.height - size / 2, width: size, height: size };
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker-base", index), role: "map-marker", frame: markerFrame, style: boxStyle(SURFACE, INK, HAIRLINE, token("radius.round")) }));
    const fraction = Math.max(0, Math.min(1, marker.fraction ?? 1));
    if (fraction >= 0.999) nodes.push(ellipsePrimitive({ id: stableId(id, "marker-fill", index), role: "map-marker-fill", frame: markerFrame, style: boxStyle(INK, INK, HAIRLINE, token("radius.round")) }));
    else if (fraction > 0) nodes.push(wedgePrimitive({ id: stableId(id, "marker-fill", index), role: "map-marker-fill", frame: markerFrame, startAngle: -90, endAngle: -90 + fraction * 360, style: boxStyle(INK, INK, HAIRLINE, token("radius.none")) }));
    if (marker.label) nodes.push(textPrimitive({ id: stableId(id, "marker-label", index), role: "map-label", frame: { x: markerFrame.x + size + 4, y: markerFrame.y - 2, width: 90, height: size + 4 }, text: marker.label, style: textStyle(LABEL, SECONDARY, true, "left") }));
  }
  return nodes;
}

function registerCore(registry) {
  const definitions = [
    component({
      id: "slide-chrome", category: "shared", role: "slide-chrome",
      tokens: ["color.canvas", "color.ink", "font.display", "type.actionTitle", "type.actionTitleLong", ...PAGE_TEMPLATE_TOKENS],
      preferredSize: { width: SLIDE.width, height: SLIDE.height },
      sample: { title: "Growth is concentrated in two priority segments", source: "Source: Company data; team analysis", footerRight: "Company Name", pageNumber: 7 },
      render: ({ id, frame, props }) => {
        const page = renderPageTemplate({ id, frame, props });
        return { ...page, nodes: [...titleNodes({ id, frame, props: { text: props.title, variant: props.titleVariant, rule: props.titleRule, availableTitleWidth: page.titleWidth }, chrome: true }), ...page.nodes] };
      }
    }),
    component({ id: "page-template", category: "shared", role: "page-template", tokens: PAGE_TEMPLATE_TOKENS,
      preferredSize: { ...SLIDE }, sample: { source: "Source: Company data; team analysis", companyName: "Company Name", pageNumber: 7 }, render: renderPageTemplate }),
    component({
      id: "section", category: "structure", role: "section", tokens: ["color.surface", "color.surfaceMuted", "color.rule", "space.4", "space.5", "line.standard", "radius.small", ...SECTION_HEADING_TOKENS], preferredSize: { width: 520, height: 300 }, sample: { treatment: "open", heading: "Operating constraints" },
      render: ({ id, frame, props }) => {
        const treatment = props.treatment || "open";
        const padding = normalizeInsets(props.padding ?? token("space.4"));
        const fill = treatment === "muted" ? MUTED_SURFACE : treatment === "primary" ? PRIMARY : SURFACE;
        const stroke = treatment === "open" ? RULE : fill;
        const nodes = [];
        if (treatment !== "open") nodes.push(rectPrimitive({ id: stableId(id, "surface"), role: "section-surface", frame, style: boxStyle(fill, stroke, treatment === "primary" ? STANDARD : HAIRLINE, SMALL_RADIUS) }));
        const headerFrame = { x: frame.x + padding.left, y: frame.y + padding.top, width: frame.width - padding.left - padding.right, height: frame.height };
        const headerProps = { ...props, variant: treatment === "primary" ? "inverse" : "standard", rule: treatment !== "muted" };
        if (props.heading) nodes.push(...sectionHeadingNodes({ id: stableId(id, "header"), frame: headerFrame, props: headerProps }));
        const top = padding.top + (props.heading ? headingLayout(headerFrame, headerProps).height : 0);
        return { nodes, contentFrame: { x: frame.x + padding.left, y: frame.y + top, width: frame.width - padding.left - padding.right, height: frame.height - top - padding.bottom } };
      }
    }),
    component({ id: "section-heading", category: "shared", role: "section-heading", tokens: SECTION_HEADING_TOKENS, preferredSize: { width: 720, height: 52 }, sample: { heading: "Description", rule: true }, render: ({ id, frame, props }) => ({ nodes: sectionHeadingNodes({ id, frame, props }) }) }),
    component({ id: "action-title", category: "shared", role: "title", tokens: ["font.display", "type.actionTitle", "color.ink", "color.rule", "line.hairline", "space.2"], preferredSize: { width: 1136, height: 86 }, sample: { text: "Growth is concentrated in two priority segments" }, render: ({ id, frame, props }) => ({ nodes: titleNodes({ id, frame, props }) }) }),
    component({ id: "section-title", category: "shared", role: "title", tokens: ["font.display", "type.sectionTitle", "color.ink", "color.rule", "line.hairline", "space.2"], preferredSize: { width: 720, height: 64 }, sample: { text: "Operating model" }, render: ({ id, frame, props }) => ({ nodes: titleNodes({ id, frame, props, section: true }) }) }),
    component({ id: "cover", category: "navigation", role: "cover", tokens: ["color.ink", "color.componentPrimary", "color.surface", "color.onPrimary", "color.chartSeries2", "color.chartSeries3", "font.serif", "font.body", "type.deckTitle", "type.body", "type.heading", "line.hairline", "line.standard", "radius.none"], preferredSize: { width: 1280, height: 720 }, sample: { title: "Business & Consulting\nToolkit", subtitle: "Powerful templates with a library of best-practice slide layouts,\nchart examples, frameworks and more", brand: "Slideworks" }, render: ({ id, frame, props }) => {
      const panel = { x: frame.x + frame.width * 0.1, y: frame.y, width: frame.width * 0.8, height: frame.height * 0.825 };
      const nodes = [rectPrimitive({ id: stableId(id, "backdrop"), role: "cover-backdrop", frame, style: boxStyle(INK, INK, HAIRLINE, token("radius.none")) })];
      const lineColours = [PRIMARY, token("color.chartSeries2"), token("color.chartSeries3")];
      for (let index = 0; index < 18; index += 1) {
        const left = index % 2 === 0;
        const x1 = left ? frame.x : frame.x + frame.width - 250 + index * 5;
        const x2 = left ? frame.x + 250 + index * 4 : frame.x + frame.width;
        const y1 = frame.y + 30 + index * 33;
        const y2 = Math.min(frame.y + frame.height, y1 + 150 + index * 4);
        nodes.push(openLine(stableId(id, "energy-line", index), x1, y1, x2, y2, "cover-line", lineColours[index % lineColours.length], index % 3 === 0 ? STANDARD : HAIRLINE));
      }
      nodes.push(rectPrimitive({ id: stableId(id, "panel"), role: "cover-panel", frame: panel, style: boxStyle(SURFACE, SURFACE, HAIRLINE, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "title"), role: "cover-title", frame: { x: panel.x + 52, y: panel.y + 76, width: panel.width - 104, height: 142 }, text: props.title, style: { ...textStyle(token("type.deckTitle"), INK, true, "left", "top"), fontFamily: SERIF } }));
      nodes.push(textPrimitive({ id: stableId(id, "subtitle"), role: "cover-subtitle", frame: { x: panel.x + 54, y: panel.y + 248, width: panel.width - 108, height: 88 }, text: props.subtitle || "", style: textStyle(BODY, INK, false, "left", "top") }));
      nodes.push(textPrimitive({ id: stableId(id, "brand"), role: "cover-brand", frame: { x: panel.x + 54, y: panel.y + panel.height - 74, width: 260, height: 42 }, text: props.brand || "", style: textStyle(token("type.heading"), INK, true, "left", "mid") }));
      return { nodes };
    } }),
    component({ id: "section-divider", category: "navigation", role: "divider", tokens: ["color.ink", "color.componentPrimary", "color.onPrimary", "color.rule", "font.serif", "font.body", "type.deckTitle", "type.heading", "type.source", "line.hairline", "radius.none"], preferredSize: { width: 1280, height: 720 }, sample: { number: "Appendix A", title: "Common frameworks and tools used in\nmanagement consulting", orientation: "" }, render: ({ id, frame, props }) => ({ nodes: [
      rectPrimitive({ id: stableId(id, "surface"), role: "divider-surface", frame, style: boxStyle(INK, INK, HAIRLINE, token("radius.none")) }),
      ...(props.dividerRule ? [openLine(stableId(id, "top-rule"), frame.x + 60, frame.y + 130, frame.x + frame.width - 60, frame.y + 130, "divider-rule", RULE, HAIRLINE)] : []),
      measuredTextNode({ id: stableId(id, "number"), role: "divider-number", frame: { x: frame.x + 70, y: frame.y + 278, width: 260, height: 38 }, text: props.number, style: textStyle(token("type.heading"), PRIMARY, true, "left") }),
      measuredTextNode({ id: stableId(id, "title"), role: "divider-title", frame: { x: frame.x + 70, y: frame.y + 326, width: frame.width - 140, height: 128 }, text: props.title, style: { ...textStyle(token("type.deckTitle"), WHITE, true, "left", "top"), fontFamily: SERIF } }),
      ...(props.orientation ? [textPrimitive({ id: stableId(id, "orientation"), role: "divider-orientation", frame: { x: frame.x + 70, y: frame.y + 470, width: frame.width - 140, height: 42 }, text: props.orientation, style: textStyle(token("type.heading"), WHITE, false, "left") })] : []),
      ...renderPageTemplate({ id: stableId(id, "page"), frame, props: { ...props, inverse: true } }).nodes
    ] }) }),
    component({ id: "source", category: "shared", role: "source", tokens: ["font.body", "type.source", "color.textSecondary", "color.rule", "line.hairline"], preferredSize: { width: 920, height: 26 }, sample: { text: "Source: Company data; team analysis" }, render: ({ id, frame, props }) => {
      const variant = resolveTitleVariant(props);
      return { nodes: [...(variant === "with-line" ? [openLine(stableId(id, "rule"), frame.x, frame.y, frame.x + frame.width, frame.y, "source-rule", RULE, HAIRLINE)] : []), textPrimitive({ id: stableId(id, "text"), role: "source-text", frame: { x: frame.x, y: frame.y + 4, width: frame.width, height: frame.height - 4 }, text: props.text, style: textStyle(SOURCE, SECONDARY, false, "left") })] };
    } }),
    component({ id: "footnote", category: "shared", role: "footnote", tokens: ["font.body", "type.source", "color.textSecondary"], preferredSize: { width: 600, height: 34 }, sample: { text: "Note: Figures may not sum due to rounding." }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "text"), role: "footnote-text", frame, text: props.text, style: textStyle(SOURCE, SECONDARY, false, "left", "top") })] }) }),
    component({ id: "page-number", category: "shared", role: "page-number", tokens: ["font.body", "type.source", "color.textSecondary"], preferredSize: { width: 48, height: 24 }, sample: { value: 7 }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "text"), role: "page-number", frame, text: String(props.value), style: textStyle(SOURCE, SECONDARY, false, "right") })] }) }),
    component({ id: "paragraph", category: "text", tokens: ["font.body", "type.body", "color.ink"], preferredSize: { width: 520, height: 180 }, sample: { text: "A concise explanatory paragraph gives the evidence enough context to support the decision." }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "text"), role: "paragraph", frame, text: props.text, style: textStyle(BODY, INK, false, props.align || "left", "top") })] }) }),
    component({ id: "bullet-list", category: "text", tokens: ["font.body", "type.compact", "type.label", "color.ink", "color.componentPrimary", "color.onPrimary", "space.1", "space.3", "line.hairline", "radius.none", "radius.round"], preferredSize: { width: 540, height: 240 }, sample: { items: ["Prioritize the largest source of value", "Protect the critical dependency", "Confirm ownership before launch"] }, render: ({ id, frame, props }) => ({ nodes: simpleList({ id, frame, items: props.items, numbered: false, marker: "square" }) }) }),
    component({ id: "insight", category: "section", role: "insight", tokens: ["color.componentPrimaryTint", "color.componentPrimary", "color.ink", "font.body", "type.heading", "type.body", "space.4", "line.standard", "radius.small"], preferredSize: { width: 360, height: 220 }, sample: { heading: "Concentrate capacity", text: "Focus the next wave on the two segments where adoption and economics reinforce each other." }, render: ({ id, frame, props }) => {
      const hasHeading = Boolean(props.heading);
      return { nodes: [
        rectPrimitive({ id: stableId(id, "surface"), role: "insight-surface", frame, style: boxStyle(PRIMARY_TINT, PRIMARY, STANDARD, SMALL_RADIUS) }),
        ...(hasHeading ? [textPrimitive({ id: stableId(id, "heading"), role: "insight-heading", frame: { x: frame.x + 20, y: frame.y + 18, width: frame.width - 40, height: 34 }, text: props.heading, style: textStyle(token("type.heading"), PRIMARY, true) })] : []),
        textPrimitive({ id: stableId(id, "body"), role: "insight-body", frame: { x: frame.x + 20, y: frame.y + (hasHeading ? 60 : 20), width: frame.width - 40, height: frame.height - (hasHeading ? 80 : 40) }, text: props.text, style: textStyle(BODY, INK, false, "left", hasHeading ? "top" : "mid") })
      ] };
    } }),
    component({ id: "panel", category: "section", role: "panel", tokens: ["color.surface", "color.surfaceMuted", "color.componentPrimary", "color.rule", "color.ink", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "radius.none"], preferredSize: { width: 400, height: 240 }, sample: { heading: "Enterprise segment", text: "Demand growth and delivery readiness support the next commercial wave." }, render: ({ id, frame, props }) => {
      const tone = props.tone || "open";
      const fill = tone === "primary" ? PRIMARY : tone === "dark" ? INK : tone === "muted" ? MUTED_SURFACE : SURFACE;
      const foreground = tone === "primary" || tone === "dark" ? WHITE : INK;
      return { nodes: [rectPrimitive({ id: stableId(id, "surface"), role: "panel-surface", frame, style: boxStyle(fill, tone === "open" ? RULE : fill, HAIRLINE, token("radius.none")) }), textPrimitive({ id: stableId(id, "heading"), role: "panel-heading", frame: { x: frame.x + 10, y: frame.y + 10, width: frame.width - 20, height: 30 }, text: props.heading, style: textStyle(token("type.heading"), foreground, true) }), textPrimitive({ id: stableId(id, "body"), role: "panel-body", frame: { x: frame.x + 10, y: frame.y + 44, width: frame.width - 20, height: frame.height - 54 }, text: props.text, style: textStyle(COMPACT, foreground, false, "left", "top") })] };
    } }),
    component({ id: "quote", category: "section", role: "quote", tokens: ["color.surfaceMuted", "color.componentPrimary", "color.ink", "color.textSecondary", "font.display", "font.body", "type.sectionTitle", "type.body", "type.label", "line.hairline", "radius.small"], preferredSize: { width: 560, height: 250 }, sample: { quote: "The operating model must make the right action easier, not merely document it.", attribution: "Programme lead" }, render: ({ id, frame, props }) => ({ nodes: [rectPrimitive({ id: stableId(id, "surface"), role: "quote-surface", frame, style: boxStyle(MUTED_SURFACE, MUTED_SURFACE, HAIRLINE, SMALL_RADIUS) }), textPrimitive({ id: stableId(id, "mark"), role: "quote-mark", frame: { x: frame.x + 20, y: frame.y + 12, width: 52, height: 56 }, text: "“", style: { ...textStyle(token("type.sectionTitle"), PRIMARY, true), fontFamily: DISPLAY } }), textPrimitive({ id: stableId(id, "body"), role: "quote-body", frame: { x: frame.x + 74, y: frame.y + 34, width: frame.width - 98, height: frame.height - 92 }, text: props.quote, style: textStyle(BODY, INK, false, "left", "top") }), textPrimitive({ id: stableId(id, "attribution"), role: "quote-attribution", frame: { x: frame.x + 74, y: frame.y + frame.height - 48, width: frame.width - 98, height: 28 }, text: props.attribution, style: textStyle(LABEL, SECONDARY, true, "left") })] }) }),
    component({ id: "metric", category: "data", role: "metric", tokens: ["color.componentPrimary", "color.textSecondary", "font.display", "font.body", "type.metric", "type.label"], preferredSize: { width: 240, height: 140 }, sample: { value: "74%", label: "Customers retained", delta: "+8 pts" }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "value"), role: "metric-value", frame: { x: frame.x, y: frame.y + 6, width: frame.width, height: frame.height * 0.48 }, text: props.value, style: { ...textStyle(token("type.metric"), PRIMARY, true, "center"), fontFamily: DISPLAY } }), textPrimitive({ id: stableId(id, "label"), role: "metric-label", frame: { x: frame.x + 8, y: frame.y + frame.height * 0.52, width: frame.width - 16, height: 28 }, text: props.label, style: textStyle(LABEL, SECONDARY, false, "center") }), textPrimitive({ id: stableId(id, "delta"), role: "metric-delta", frame: { x: frame.x + 8, y: frame.y + frame.height - 30, width: frame.width - 16, height: 24 }, text: props.delta || "", style: textStyle(LABEL, PRIMARY, true, "center") })] }) }),
    component({ id: "legend", category: "data", role: "legend", tokens: LEGEND_TOKENS, preferredSize: { width: 420, height: 44 }, sample: { items: ["Actual", "Forecast", "Target"] }, render: input => ({ nodes: legendNodes(input) }) }),
    component({ id: "chart-callout", category: "data", role: "annotation", tokens: ["color.surface", "color.componentPrimary", "color.ink", "font.body", "type.label", "line.hairline", "radius.small"], preferredSize: { width: 260, height: 90 }, sample: { text: "+13 points since 2025", direction: "down" }, render: ({ id, frame, props }) => ({ nodes: [openLine(stableId(id, "leader"), frame.x + frame.width / 2, frame.y + frame.height, frame.x + frame.width / 2, frame.y + frame.height + 24, "annotation-leader", PRIMARY, HAIRLINE), rectPrimitive({ id: stableId(id, "surface"), role: "annotation-surface", frame, style: boxStyle(SURFACE, PRIMARY, HAIRLINE, SMALL_RADIUS) }), textPrimitive({ id: stableId(id, "text"), role: "annotation-text", frame: insetFrame(frame, 12), text: props.text, style: textStyle(LABEL, INK, true, "center") })] }) }),
    component({ id: "table", category: "data", role: "table", tokens: ["color.ink", "color.componentPrimary", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 760, height: 320 }, sample: { columns: ["Metric", "2025", "2026"], rows: [["Revenue", "$42m", "$55m"], ["Margin", "24%", "29%"], ["Customers", "180", "236"]] }, render: ({ id, frame, props }) => ({ nodes: tableNodes({ id, frame, props }) }) }),
    component({ id: "trend-rows", category: "data", role: "trend-rows", tokens: ["color.ink", "color.surface", "color.rule", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "line.standard", "radius.none"], preferredSize: { width: 1160, height: 440 }, sample: { columns: ["Trend", "Description", "Examples"], rows: [["Trend 1", "• Short description\n• Short description", "• Select examples"], ["Trend 2", "• Short description", "• Select examples"], ["Trend 3", "• Short description", "• Select examples"]] }, render: ({ id, frame, props }) => ({ nodes: trendRowNodes({ id, frame, props }) }) }),
    component({ id: "comparison-table", category: "data", role: "comparison", tokens: ["color.ink", "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 820, height: 340 }, sample: { columns: ["Criterion", "Option A", "Option B", "Option C"], rows: [["Strategic fit", "Medium", "High", "High"], ["Delivery risk", "Low", "Medium", "Low"], ["Economics", "Medium", "Medium", "High"]], selectedColumn: 3 }, render: ({ id, frame, props }) => ({ nodes: tableNodes({ id, frame, props, comparison: true }) }) }),
    component({ id: "heatmap", category: "data", role: "heatmap", tokens: ["color.ink", "color.componentPrimary", "color.componentPrimaryTint", "color.chartSeries1", "color.chartSeries2", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 760, height: 320 }, sample: { columns: ["Capability", "A", "B", "C", "D"], rows: [["Coverage", 2, 4, 5, 3], ["Maturity", 3, 3, 4, 2], ["Readiness", 1, 4, 5, 2]] }, render: ({ id, frame, props }) => ({ nodes: tableNodes({ id, frame, props, heatmap: true }) }) }),
    component({ id: "status-list", category: "data", role: "status", tokens: ["color.positive", "color.caution", "color.negative", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.hairline", "radius.round"], preferredSize: { width: 600, height: 260 }, sample: { items: [{ label: "Commercial case", status: "positive" }, { label: "Data migration", status: "caution" }, { label: "Contracting", status: "negative" }] }, render: ({ id, frame, props }) => ({ nodes: props.items.flatMap((item, index) => {
      const height = frame.height / props.items.length;
      const fill = item.status === "positive" ? token("color.positive") : item.status === "negative" ? token("color.negative") : token("color.caution");
      return [ellipsePrimitive({ id: stableId(id, "status", index), role: "status-marker", frame: { x: frame.x, y: frame.y + index * height + (height - 20) / 2, width: 20, height: 20 }, style: boxStyle(fill, fill, HAIRLINE, token("radius.round")) }), textPrimitive({ id: stableId(id, "status-cue", index), role: "status-cue", frame: { x: frame.x, y: frame.y + index * height + (height - 20) / 2, width: 20, height: 20 }, text: item.status === "positive" ? "✓" : item.status === "negative" ? "×" : "!", style: textStyle(LABEL, WHITE, true, "center") }), textPrimitive({ id: stableId(id, "label", index), role: "status-label", frame: { x: frame.x + 34, y: frame.y + index * height, width: frame.width - 34, height }, text: item.label, style: textStyle(COMPACT, INK, false, "left") })];
    }) }) }),
    component({ id: "image-frame", category: "media", role: "image", tokens: ["color.surfaceMuted", "color.rule", "color.textSecondary", "font.body", "type.label", "line.hairline", "radius.small"], preferredSize: { width: 520, height: 300 }, sample: { alt: "Product or market image" }, render: ({ id, frame, props }) => ({ nodes: [rectPrimitive({ id: stableId(id, "frame"), role: "image-frame", frame, style: boxStyle(MUTED_SURFACE, RULE, HAIRLINE, SMALL_RADIUS), data: { alt: props.alt } }), textPrimitive({ id: stableId(id, "alt"), role: "image-alt", frame: { x: frame.x + 24, y: frame.y + frame.height / 2 - 18, width: frame.width - 48, height: 36 }, text: props.alt, style: textStyle(LABEL, SECONDARY, true, "center") })] }) }),
    component({ id: "icon", category: "media", role: "icon", tokens: ["color.componentPrimary", "color.onPrimary", "color.ink", "font.body", "type.heading", "type.label", "line.hairline", "radius.round"], preferredSize: { width: 90, height: 90 }, sample: { symbol: "✓", label: "Confirmed" }, render: ({ id, frame, props }) => {
      const size = Math.min(frame.width, frame.height * 0.62);
      return { nodes: [ellipsePrimitive({ id: stableId(id, "surface"), role: "icon-surface", frame: { x: frame.x + (frame.width - size) / 2, y: frame.y, width: size, height: size }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }), textPrimitive({ id: stableId(id, "symbol"), role: "icon-symbol", frame: { x: frame.x + (frame.width - size) / 2, y: frame.y, width: size, height: size }, text: props.symbol, style: textStyle(token("type.heading"), WHITE, true, "center") }), textPrimitive({ id: stableId(id, "label"), role: "icon-label", frame: { x: frame.x, y: frame.y + size + 8, width: frame.width, height: frame.height - size - 8 }, text: props.label, style: textStyle(LABEL, INK, true, "center", "top") })] };
    } }),
    component({ id: "logo", category: "media", role: "logo", tokens: ["color.surface", "color.rule", "color.ink", "font.display", "type.heading", "line.hairline", "radius.small"], preferredSize: { width: 220, height: 90 }, sample: { text: "COMPANY" }, render: ({ id, frame, props }) => ({ nodes: [rectPrimitive({ id: stableId(id, "backing"), role: "logo-backing", frame, style: boxStyle() }), textPrimitive({ id: stableId(id, "text"), role: "logo-text", frame: insetFrame(frame, 12), text: props.text, style: { ...textStyle(token("type.heading"), INK, true, "center"), fontFamily: DISPLAY } })] }) }),
    component({ id: "process", category: "relationship", role: "process", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 900, height: 280 }, sample: { items: ["Diagnose", "Design", "Pilot", "Scale"], active: 2 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) } }) }) }),
    component({ id: "chevron-process", category: "relationship", role: "process", tokens: ["color.ink", "color.componentPrimary", "color.surface", "color.surfaceMuted", "color.onPrimary", "font.body", "type.heading", "type.compact", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 1160, height: 360 }, sample: { items: [{ heading: "Phase 1", label: "Diagnose", details: ["Frame the question", "Confirm the baseline"] }, { heading: "Phase 2", label: "Design", details: ["Test the options", "Select the model"] }, { heading: "Phase 3", label: "Scale", details: ["Mobilize delivery", "Track outcomes"] }] }, render: ({ id, frame, props }) => {
      const items = props.items;
      const span = frame.width / items.length;
      const nodes = [];
      items.forEach((item, index) => {
        const x = frame.x + index * span;
        nodes.push(textPrimitive({ id: stableId(id, "heading", index), role: "process-heading", frame: { x: x + 8, y: frame.y, width: span - 16, height: 34 }, text: item.heading || `Phase ${index + 1}`, style: textStyle(token("type.heading"), INK, true, "left") }));
        nodes.push(shapePrimitive({ id: stableId(id, "band", index), role: "process-band", geometry: "chevron", frame: { x: x + 4, y: frame.y + 50, width: span - 8, height: 82 }, style: boxStyle(index === 0 && props.emphasizeFirst ? PRIMARY : INK, SURFACE, HAIRLINE, token("radius.none")) }));
        const label = measureText(item.label, span - 72, { fontSize: tokenValue(token("type.heading")), bold: true });
        if (label.height > 64) throw new Error("Process label exceeds its band; enlarge the component or shorten the copy");
        nodes.push(textPrimitive({ id: stableId(id, "label", index), role: "process-label", frame: { x: x + 36, y: frame.y + 91 - label.height / 2, width: span - 72, height: label.height }, text: label.text, style: { ...textStyle(token("type.heading"), WHITE, true, "center", "top"), lineHeight: label.lineHeight, wrap: false }, data: { textLayout: label } }));
        const details = item.details || [];
        nodes.push(textPrimitive({ id: stableId(id, "details", index), role: "process-details", frame: { x: x + 14, y: frame.y + 152, width: span - 28, height: frame.height - 156 }, text: details.map((detail, detailIndex) => `${detailIndex + 1}. ${detail}`).join("\n"), style: textStyle(COMPACT, INK, false, "left", "top") }));
      });
      return { nodes };
    } }),
    component({ id: "initiative-rollout", category: "relationship", role: "initiative-rollout", tokens: ["color.ink", "color.componentPrimary", "color.chartSeries2", "color.surfaceMuted", "color.surface", "color.onPrimary", "font.body", "type.heading", "type.compact", "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"], preferredSize: { width: 1160, height: 450 }, sample: { years: ["2025", "2026", "2027"], rows: [{ label: "A", phases: ["Build", "Scale", "Embed"] }, { label: "B", phases: ["Design", "Pilot", "Roll out"] }] }, render: ({ id, frame, props }) => ({ nodes: initiativeRolloutNodes({ id, frame, props }) }) }),
    component({ id: "highlight-strip", category: "relationship", role: "highlight-strip", tokens: ["color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "radius.round"], preferredSize: { width: 1160, height: 126 }, sample: { items: [{ number: "1", heading: "Start highlight", description: "[Insert description]" }, { number: "2", heading: "Start highlight", description: "[Insert description]" }, { number: "3", heading: "Start highlight", description: "[Insert description]" }] }, render: ({ id, frame, props }) => ({ nodes: highlightStripNodes({ id, frame, props }) }) }),
    component({ id: "roadmap", category: "relationship", role: "roadmap", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.heading", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round", "radius.small"], preferredSize: { width: 980, height: 360 }, sample: { items: ["Mobilize", "Build", "Launch", "Stabilize"], active: 1 }, render: ({ id, frame, props }) => ({ nodes: props.variant === "wave-columns" ? waveRoadmapNodes({ id, frame, props }) : processNodes({ id, frame, props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) }, roadmap: true }) }) }),
    component({ id: "timeline", category: "relationship", role: "timeline", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 920, height: 250 }, sample: { items: ["Q1", "Q2", "Q3", "Q4"], active: 2 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props: { ...props, items: props.items.map((label) => ({ label })) } }) }) }),
    component({ id: "journey", category: "relationship", role: "journey", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 960, height: 300 }, sample: { items: [{ label: "Discover", touchpoint: "Search" }, { label: "Evaluate", touchpoint: "Demo" }, { label: "Buy", touchpoint: "Checkout" }, { label: "Adopt", touchpoint: "Onboarding" }], active: 3 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props, journey: true }) }) }),
    component({ id: "tree", category: "relationship", role: "tree", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "line.hairline", "line.standard", "radius.small"], preferredSize: { width: 900, height: 360 }, sample: { root: "Decision", children: ["Market", "Customer", "Economics", "Execution"] }, render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props }) }) }),
    component({ id: "organization", category: "relationship", role: "organization", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "line.hairline", "line.standard", "radius.none", "radius.small"], preferredSize: { width: 900, height: 360 }, sample: { root: "Executive sponsor", children: ["Product", "Operations", "Technology", "Finance"] }, render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props, organization: true }) }) }),
    component({ id: "matrix", category: "relationship", role: "matrix", tokens: ["color.componentPrimary", "color.chartSeries2", "color.surface", "color.rule", "color.ink", "color.positive", "color.caution", "color.negative", "color.onPrimary", "font.body", "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"], preferredSize: { width: 720, height: 410 }, sample: { points: [{ label: "A", x: 0.24, y: 0.35 }, { label: "B", x: 0.56, y: 0.62 }, { label: "C", x: 0.76, y: 0.82 }], highlight: 2 }, render: ({ id, frame, props }) => ({ nodes: matrixNodes({ id, frame, props }) }) }),
    component({ id: "map", category: "relationship", role: "map", tokens: ["color.surface", "color.surfaceMuted", "color.ink", "color.textSecondary", "font.body", "type.label", "line.hairline", "radius.round", "radius.none"], preferredSize: { width: 820, height: 400 }, sample: { markers: [{ label: "Americas", x: 0.2, y: 0.45, fraction: 0.75 }, { label: "Europe", x: 0.5, y: 0.34, fraction: 0.5 }, { label: "Asia", x: 0.77, y: 0.44, fraction: 0.25 }] }, render: ({ id, frame, props }) => ({ nodes: mapNodes({ id, frame, props }) }) }),
    component({ id: "funnel", category: "relationship", role: "funnel", tokens: ["color.componentPrimary", "color.chartSeries2", "color.chartSeries3", "color.chartSeries4", "color.onPrimary", "color.ink", "font.body", "type.compact", "line.hairline", "radius.small"], preferredSize: { width: 700, height: 360 }, sample: { stages: [{ label: "Market", value: 100 }, { label: "Qualified", value: 62 }, { label: "Engaged", value: 38 }, { label: "Won", value: 18 }] }, render: ({ id, frame, props, tokens = TOKENS }) => {
      const colors = [PRIMARY, token("color.chartSeries2"), token("color.chartSeries3"), token("color.chartSeries4")];
      const max = props.stages[0].value;
      const height = frame.height / props.stages.length;
      return { nodes: props.stages.flatMap((stage, index) => {
        const width = frame.width * (0.38 + 0.62 * stage.value / max), x = frame.x + (frame.width - width) / 2;
        const fill = colors[index % colors.length], background = tokens[fill.tokenId].value;
        const foreground = contrastRatio(background, tokens["color.onPrimary"].value) >= contrastRatio(background, tokens["color.ink"].value) ? WHITE : INK;
        return [rectPrimitive({ id: stableId(id, "stage", index), role: "funnel-stage", frame: { x, y: frame.y + index * height + 3, width, height: height - 6 }, style: boxStyle(fill, fill, HAIRLINE, SMALL_RADIUS) }), textPrimitive({ id: stableId(id, "label", index), role: "funnel-label", frame: { x: x + 12, y: frame.y + index * height + 3, width: width - 24, height: height - 6 }, text: `${stage.label}  ${stage.value}`, style: textStyle(COMPACT, foreground, true, "center") })];
      }) };
    } }),
    component({ id: "connector", category: "relationship", role: "connector", tokens: ["color.componentPrimary", "font.body", "type.label", "line.standard"], preferredSize: { width: 360, height: 90 }, sample: { label: "therefore" }, render: ({ id, frame, props }) => ({ nodes: [openLine(stableId(id, "line"), frame.x, frame.y + frame.height / 2, frame.x + frame.width - 18, frame.y + frame.height / 2, "connector-line", PRIMARY, STANDARD, { endArrow: true }), textPrimitive({ id: stableId(id, "label"), role: "connector-label", frame: { x: frame.x + frame.width * 0.28, y: frame.y, width: frame.width * 0.44, height: frame.height / 2 - 4 }, text: props.label, style: textStyle(LABEL, PRIMARY, true, "center") })] }) }),
    component({ id: "content-rail", category: "section", role: "rail", tokens: ["color.surface", "color.surfaceMuted", "color.rule", "type.compact", "space.1", "space.3", "radius.none", ...SECTION_HEADING_TOKENS], preferredSize: { width: 330, height: 360 }, sample: { heading: "Commercial consequence", items: ["Value is concentrated", "Execution remains feasible", "One dependency needs action"] }, render: ({ id, frame, props }) => {
      const treatment = props.treatment || "muted";
      const inset = treatment === "open" ? 18 : 18;
      const nodes = [];
      if (treatment === "muted") nodes.push(rectPrimitive({ id: stableId(id, "surface"), role: "rail-surface", frame, style: boxStyle(MUTED_SURFACE, MUTED_SURFACE, HAIRLINE, token("radius.none")) }));
      if (props.dividerLeft) nodes.push(openLine(stableId(id, "divider"), frame.x, frame.y, frame.x, frame.y + frame.height, "rail-divider", RULE, HAIRLINE));
      const headerFrame = { x: frame.x + inset, y: frame.y + 18, width: frame.width - inset * 2, height: 52 };
      const headerProps = { ...props, variant: treatment === "muted" ? "accent" : "standard", rule: treatment === "open" };
      nodes.push(...sectionHeadingNodes({ id: stableId(id, "header"), frame: headerFrame, props: headerProps }));
      const listTop = headerFrame.y + headingLayout(headerFrame, headerProps).height + tokenValue(token("space.2"));
      nodes.push(...simpleList({ id: stableId(id, "list"), frame: { x: frame.x + inset, y: listTop, width: frame.width - inset * 2, height: frame.y + frame.height - listTop - 12 }, items: props.items, marker: "square", rolePrefix: "rail" }));
      return { nodes };
    } }),
    component({ id: "contents", category: "navigation", role: "contents", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "space.1", "space.3", "line.hairline", "radius.round"], preferredSize: { width: 840, height: 420 }, sample: { items: ["Context and objective", "Evidence and options", "Recommendation", "Implementation"] }, render: ({ id, frame, props }) => ({ nodes: simpleList({ id, frame, items: props.items, numbered: true, distribute: true }) }) })
  ];
  for (const definition of definitions) {
    const axes = { section: ["treatment", ["open", "muted", "primary"]], panel: ["tone", ["open", "muted", "primary", "dark"]], "content-rail": ["treatment", ["muted", "open"]], roadmap: ["variant", ["process", "wave-columns"]], "section-heading": ["variant", ["standard", "accent", "inverse"]] };
    if (axes[definition.id]) {
      const [prop, choices] = axes[definition.id];
      definition.variants = Object.fromEntries(choices.map(choice => [choice, {}]));
      definition.defaultVariant = choices[0];
      definition.variantProp = prop;
      definition.resolveVariant = (props = {}) => {
        const value = props[prop] ?? choices[0];
        if (!choices.includes(value)) throw new Error(`Unknown ${definition.id} variant: ${value}`);
        return value;
      };
      const render = definition.render;
      definition.render = input => { definition.resolveVariant(input.props); return render(input); };
    }
    if (definition.id === "roadmap") definition.variants["wave-columns"] = { preferredSize: { width: 1160, height: 480 }, props: { items: ["Diagnose", "Design", "Scale"].map((heading, index) => ({ heading, range: `Quarter ${index + 1}`, activities: ["Confirm priorities"], deliverables: ["Agreed plan"] })) } };
    if (definition.id === "section-heading") definition.variants.inverse = { backdrop: "primary" };
    if (definition.id === "legend") {
      definition.variants = Object.fromEntries(Object.keys(LEGEND_VARIANTS).flatMap(mark => LEGEND_PLACEMENTS.map(placement => [`${mark}-${placement}`, { props: { variant: mark, placement, items: [{ label: "Actual", state: "actual" }, { label: "Forecast", state: "forecast" }, { label: "Target", state: "actual" }] }, preferredSize: { width: 540, height: placement === "right" ? 120 : 44 } }])));
      definition.defaultVariant = "swatch-top";
      definition.resolveVariant = (props = {}) => `${props.variant ?? "swatch"}-${props.placement ?? "top"}`;
    }
    if (["action-title", "section-title", "slide-chrome"].includes(definition.id)) {
      definition.variants = TITLE_VARIANTS;
      definition.defaultVariant = DEFAULT_TITLE_VARIANT;
      definition.variantProp = definition.id === "slide-chrome" ? "titleVariant" : "variant";
      definition.resolveVariant = definition.id === "slide-chrome"
        ? (props = {}) => resolveTitleVariant({ variant: props.titleVariant, rule: props.titleRule })
        : resolveTitleVariant;
    }
    if (definition.id === "source") {
      definition.variants = TITLE_VARIANTS; definition.defaultVariant = DEFAULT_TITLE_VARIANT;
      definition.variantProp = "variant"; definition.resolveVariant = resolveTitleVariant;
    }
    if (definition.id === "page-template") {
      const logo = { component: "paragraph", props: { text: "Company name" } };
      definition.variants = Object.fromEntries(PAGE_RULES.flatMap(rules => PAGE_BRANDING.map(branding => [`${rules}-${branding}`, { props: { pageTemplate: { rules, branding, ...(branding === "top-right-logo" ? { logo } : {}) } } }])));
      definition.defaultVariant = "none-footer-company";
      definition.resolveVariant = props => { const t = resolvePageTemplate(props?.pageTemplate); return `${t.rules}-${t.branding}`; };
      definition.resolveTemplate = resolvePageTemplate;
      definition.measurePage = pageTemplateLayout;
      definition.examples = {
        "wrapped-sources": { props: { source: "Source: Company operating data for the twelve months ended June 2026, customer research and team analysis of the regional growth outlook and delivery capacity by market. Values include analyst calculations based on the stated reporting perimeter." } },
        "source-and-note": { props: { note: "Note: Figures may not sum due to rounding." } },
        "separate-sources": { props: { footerLeft: "Report title", pageTemplate: { rules: "bottom", sourcePlacement: "separate" } } }
      };
    }
    if (definition.id === "section-divider") {
      definition.tokens = [...new Set([...definition.tokens, ...PAGE_TEMPLATE_TOKENS])].sort();
      const render = definition.render;
      definition.render = input => ({ ...render(input), placements: renderPageTemplate({ ...input, props: { ...input.props, inverse: true } }).placements });
    }
    if (definition.id === "trend-rows") definition.tokens = [...new Set([...definition.tokens, ...SECTION_HEADING_TOKENS])].sort();
    if (["section", "section-heading", "content-rail"].includes(definition.id)) {
      const render = definition.render;
      definition.render = (input) => {
        assertSectionHeadingProps(input.props);
        return render(input);
      };
      definition.measureHeader = ({ frame, props = {} }) => {
        assertSectionHeadingProps(props);
        if (!(props.heading || props.text)) return null;
        const rail = definition.id === "content-rail";
        const padding = normalizeInsets(rail ? 18 : definition.id === "section" ? props.padding ?? token("space.4") : 0);
        const headerFrame = insetFrame(frame, padding);
        const ruled = rail ? props.treatment === "open" : props.rule !== false && props.treatment !== "muted";
        return { top: headerFrame.y, ruled, height: headingLayout(headerFrame, { ...props, rule: ruled }).bandHeight };
      };
    }
    registry.set(definition.id, definition);
  }
  registry.set("chart-title", {
    id: "chart-title", version: "2.0.0", category: "shared", role: "chart-title",
    tokens: [...SECTION_HEADING_TOKENS, "type.compact", "color.chartUnit", "space.1"],
    preferredSize: { width: 540, height: 76 }, sample: { heading: "Current mix" },
    variants: { underlined: {}, unit: { props: { unit: "Revenue share, %" } } }, defaultVariant: "underlined", variantProp: "variant", resolveVariant: resolveChartTitleVariant,
    measureContent: ({ frame, props }) => chartTitleLayout(frame, props),
    measureHeader: ({ frame, props }) => ({ top: frame.y, ruled: resolveChartTitleVariant(props) === "underlined", height: headingLayout(frame, props).heading.height }),
    render: input => ({ nodes: chartTitleNodes(input) })
  });
  return registry;
}

export function createRegistry() {
  return registerChartGroup(registerCharts(registerCore(new Map())));
}

export const REGISTRY = createRegistry();

export const COMPONENT_IDS = Object.freeze([...REGISTRY.values()].filter((definition) => definition.category !== "chart").map((definition) => definition.id));

export function registryManifest() {
  return {
    schema: "professional-slides.component-registry/v1",
    components: [...REGISTRY.values()].map((definition) => ({
      id: definition.id,
      version: definition.version,
      category: definition.category,
      role: definition.role,
      ...(definition.variants ? { variants: definition.variants, defaultVariant: definition.defaultVariant, variantProp: definition.variantProp } : {}),
      ...(definition.examples ? { examples: definition.examples } : {}),
      tokens: definition.tokens,
      preferredSize: definition.preferredSize,
      sample: definition.sample
    }))
  };
}
