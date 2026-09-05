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
import { renderTable, measureTable, TABLE_TOKENS } from "./tables.mjs";
import { TABLE_VARIANTS } from "./table-fixtures.mjs";
import { measureText } from "./text-layout.mjs";
import { routeConnector } from "./routing.mjs";
import { legendNodes, LEGEND_TOKENS, LEGEND_VARIANTS, LEGEND_PLACEMENTS } from "./legends.mjs";
import { registerChartGroup } from "./chart-group.mjs";
import { contrastRatio } from "./palettes.mjs";
import { renderChartCallout } from "./chart-annotations.mjs";
import { PAGE_RULES, PAGE_BRANDING, PAGE_TEMPLATE_TOKENS, pageTemplateLayout, renderPageTemplate, resolvePageTemplate } from "./page-template.mjs";
import { TRACKER_TOKENS, registerTrackers, trackerLabelNodes } from "./trackers.mjs";
import { registerQuoteCluster } from "./quote-cluster.mjs";
import { MAP_GUIDANCE, MAP_PRESET_IDS, MAP_TOKENS, mapNodes, resolveGeography } from "./maps.mjs";
import { registerInsightTreeTable } from "./insight-tree-table.mjs";

const FONT = token("font.body");
const DISPLAY = token("font.display");
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

const component = ({ id, category, role = category, tokens, preferredSize, sample, variants, defaultVariant, render }) => ({
  id,
  version: "2.0.0",
  category,
  role,
  tokens: [...new Set(tokens)].sort(),
  preferredSize,
  sample,
  ...(variants ? { variants, defaultVariant } : {}),
  render
});

function measuredTextNode(input) {
  const textLayout = measureText(input.text, input.frame.width, { fontFamily: tokenValue(input.style.fontFamily), fontSize: tokenValue(input.style.fontSize), bold: input.style.bold, wrapWidthRatio: 1 });
  if (textLayout.height > input.frame.height) throw new Error(`${input.id} exceeds its allocated text height`);
  return textPrimitive({ ...input, text: textLayout.text, style: { ...input.style, lineHeight: textLayout.lineHeight, wrap: false }, data: { ...input.data, textLayout } });
}

function insightLayout(frame, props) {
  if (typeof props.text !== "string" || !props.text.trim()) throw new Error("Insight requires a nonempty synthesis sentence");
  if (props.align !== undefined && !["left", "center"].includes(props.align)) throw new Error("Insight alignment must be left or center");
  const paddingX = tokenValue(token("space.5")), paddingY = tokenValue(token(props.text.includes("\n\n") ? "space.6" : "space.4"));
  const width = frame.width - 2 * paddingX;
  if (width <= 0) throw new Error("Insight width cannot contain its theme padding");
  const options = { fontFamily: tokenValue(FONT), wrapWidthRatio: 1 };
  const body = measureText(props.text, width, { ...options, fontSize: tokenValue(BODY), bold: false });
  const heading = props.heading ? measureText(props.heading, width, { ...options, fontSize: tokenValue(token("type.heading")), bold: true }) : null;
  const gap = heading ? tokenValue(token("space.2")) : 0;
  const contentHeight = body.height + (heading?.height ?? 0) + gap;
  return { body, heading, width, paddingX, paddingY, gap, contentHeight, height: contentHeight + 2 * paddingY };
}

function insightNodes({ id, frame, props }) {
  const layout = insightLayout(frame, props), variant = props.variant ?? "tonal";
  if (layout.height > frame.height) throw new Error("Insight exceeds its frame; enlarge the box or edit the sentence, never shrink type");
  const fill = variant === "primary" ? PRIMARY : variant === "neutral" ? MUTED_SURFACE : variant === "dotted" ? "none" : PRIMARY_TINT;
  const foreground = variant === "primary" ? WHITE : INK;
  const nodes = [rectPrimitive({ id: stableId(id, "surface"), role: "insight-surface", frame, style: boxStyle(fill, "none", HAIRLINE, SMALL_RADIUS) })];
  if (variant === "dotted") {
    // Native renderers collapse hairline dash presets into solid borders.
    // Resolve editable dots once so every adapter receives identical geometry.
    const diameter = tokenValue(HAIRLINE), gap = tokenValue(token("space.2")), seen = new Set();
    for (const [x, y, dx, dy, length] of [[frame.x, frame.y, 1, 0, frame.width], [frame.x, frame.y + frame.height - diameter, 1, 0, frame.width], [frame.x, frame.y, 0, 1, frame.height], [frame.x + frame.width - diameter, frame.y, 0, 1, frame.height]]) {
      const count = Math.max(1, Math.floor((length - diameter) / gap));
      for (let i = 0; i <= count; i++) {
        const dotX = x + dx * i * (length - diameter) / count, dotY = y + dy * i * (length - diameter) / count;
        const key = `${dotX.toFixed(5)}:${dotY.toFixed(5)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        nodes.push(ellipsePrimitive({ id: stableId(id, "border-dot", seen.size), role: "insight-border-dot", frame: { x: dotX, y: dotY, width: diameter, height: diameter }, style: boxStyle(RULE, "none", HAIRLINE, SMALL_RADIUS) }));
      }
    }
  }
  let y = frame.y + (frame.height - layout.contentHeight) / 2;
  for (const [part, measured] of [["heading", layout.heading], ["body", layout.body]]) {
    if (!measured) continue;
    nodes.push(textPrimitive({ id: stableId(id, part), role: `insight-${part}`, frame: { x: frame.x + layout.paddingX, y, width: layout.width, height: measured.height }, text: measured.text,
      style: { ...textStyle(part === "heading" ? token("type.heading") : BODY, part === "heading" && variant !== "primary" ? PRIMARY : foreground, part === "heading", props.align ?? "center", "top"), lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: measured } }));
    y += measured.height + layout.gap;
  }
  return nodes;
}

function titleNodes({ id, frame, props, section = false, chrome = false }) {
  const variant = resolveTitleVariant(props);
  const ruleGap = tokenValue(token("space.2"));
  const size = section ? token("type.sectionTitle") : token(chrome && String(props.text || "").length > 55 ? "type.actionTitleLong" : "type.actionTitle");
  const textFrame = chrome
    ? { x: frame.x + CHROME.left, y: frame.y + (props.titleTop ?? CHROME.titleTop), width: props.availableTitleWidth ?? frame.width - CHROME.left - CHROME.right, height: CHROME.titleHeight }
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
  const unit = variant === "unit" ? measureText(props.unit, frame.width, { fontSize: tokenValue(BODY), wrapWidthRatio: 1 }) : null;
  if (unit && unit.lines.length !== 1) throw new Error("Chart unit must fit on one line");
  const height = layout.bandHeight + (unit ? tokenValue(token("space.1")) + unit.height : layout.ruleGap) + tokenValue(token("space.3"));
  return { ...layout, variant, unit, height };
}
function chartTitleNodes({ id, frame, props }) {
  const layout = chartTitleLayout(frame, props);
  if (layout.height > frame.height) throw new Error("Chart title exceeds its allocated height");
  const nodes = sectionHeadingNodes({ id, frame, props: { ...props, variant: "standard", rule: layout.variant === "underlined" } });
  nodes.forEach(node => { node.data.chartTitleVariant = layout.variant; });
  if (layout.unit) nodes.push(textPrimitive({ id: stableId(id, "unit"), role: "chart-unit", frame: { x: frame.x, y: frame.y + layout.bandHeight + tokenValue(token("space.1")), width: frame.width, height: layout.unit.height }, text: props.unit, style: { ...textStyle(BODY, token("color.chartUnit"), false, "left", "top"), lineHeight: layout.unit.lineHeight, wrap: false }, data: { textLayout: layout.unit } }));
  return nodes;
}

function estimatedLines(text, width) {
  const charactersPerLine = Math.max(12, Math.floor(width / 7));
  return String(text).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
}

function bodyListLayout(frame, items) {
  if (!Array.isArray(items) || !items.length || items.some(item => typeof item !== "string" || !item.trim())) throw new Error("Body bullet list needs nonempty text items");
  const offset = tokenValue(token("space.4")), gap = tokenValue(token("space.2")), markerSize = tokenValue(token("space.1"));
  if (frame.width <= offset) throw new Error("Body bullet list has no text width");
  const measured = items.map(text => measureText(text, frame.width - offset, { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY), wrapWidthRatio: 1 }));
  return { offset, gap, markerSize, measured, height: measured.reduce((sum, text) => sum + text.height, 0) + gap * (items.length - 1) };
}

function bodyListNodes({ id, frame, props }) {
  const layout = bodyListLayout(frame, props.items);
  if (layout.height > frame.height) throw new Error(`${id} body bullets exceed the allocated height; allocate space or edit copy, never shrink type`);
  let y = frame.y;
  return layout.measured.flatMap((text, index) => {
    const nodes = [
      rectPrimitive({ id: stableId(id, "marker", index), role: "list-marker", frame: { x: frame.x, y: y + (text.lineHeight - layout.markerSize) / 2, width: layout.markerSize, height: layout.markerSize }, style: boxStyle(INK, INK, HAIRLINE, token("radius.none")) }),
      textPrimitive({ id: stableId(id, "item", index), role: "list-item", frame: { x: frame.x + layout.offset, y, width: frame.width - layout.offset, height: text.height }, text: text.text, style: { ...textStyle(BODY, INK, false, "left", "top"), lineHeight: text.lineHeight, wrap: false }, data: { textLayout: text } })
    ];
    y += text.height + layout.gap;
    return nodes;
  });
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
    nodes.push(textPrimitive({ id: stableId(id, "range", index), role: "roadmap-range", frame: { x: x + 8, y: frame.y, width: span - 16, height: 28 }, text: item.range || "(Insert time range)", style: textStyle(COMPACT, SECONDARY, true, "center") }));
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
    nodes.push(textPrimitive({ id: stableId(id, "description", index), role: "highlight-description", frame: { x: x + 6, y: frame.y + 80, width: span - 12, height: frame.height - 80 }, text: item.description || "(Insert description)", style: textStyle(COMPACT, INK, false, "center", "top") }));
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

function registerCore(registry) {
  const definitions = [
    component({
      id: "section-boundary", category: "relationship", role: "section-boundary",
      tokens: ["color.rule", "color.componentPrimary", "color.onPrimary", "line.hairline", "line.standard", "space.1", "icon.medium", "radius.round"],
      preferredSize: { width: 54, height: 400 }, sample: { variant: "related" },
      render: ({ id, frame, props }) => {
        const variant = props.variant ?? "related", x = frame.x + frame.width / 2, y = frame.y + frame.height / 2;
        if (variant === "subsection") return { nodes: [openLine(stableId(id, "separator"), frame.x, y, frame.x + frame.width, y, "subsection-rule")] };
        if (variant === "related") return { nodes: [linePrimitive({ id: stableId(id, "separator"), role: "section-separator", x1: x, y1: frame.y, x2: x, y2: frame.y + frame.height, style: { stroke: RULE, lineWidth: HAIRLINE, dash: "dash" } })] };
        const diameter = tokenValue(token("icon.medium")), clearance = tokenValue(token("space.1"));
        if (frame.width < diameter + clearance * 2 || frame.height < diameter + clearance * 4) throw new Error("Inference boundary needs room for its marker and clear divider segments");
        const radius = diameter / 2;
        return { nodes: [
          openLine(stableId(id, "before"), x, frame.y, x, y - radius - clearance, "section-separator"),
          openLine(stableId(id, "after"), x, y + radius + clearance, x, frame.y + frame.height, "section-separator"),
          ellipsePrimitive({ id: stableId(id, "disc"), role: "relationship-disc", frame: { x: x - radius, y: y - radius, width: diameter, height: diameter }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }),
          openLine(stableId(id, "chevron-top"), x - diameter / 8, y - diameter / 4, x + diameter / 8, y, "relationship-chevron", WHITE, STANDARD),
          openLine(stableId(id, "chevron-bottom"), x + diameter / 8, y, x - diameter / 8, y + diameter / 4, "relationship-chevron", WHITE, STANDARD)
        ] };
      }
    }),
    component({
      id: "slide-chrome", category: "shared", role: "slide-chrome",
      tokens: ["color.canvas", "color.ink", "font.display", "type.actionTitle", "type.actionTitleLong", ...PAGE_TEMPLATE_TOKENS, ...TRACKER_TOKENS],
      preferredSize: { width: SLIDE.width, height: SLIDE.height },
      sample: { title: "(Insert action title)", source: "Source: (Insert source)", footerRight: "(Insert company name)", pageNumber: 7 },
      render: ({ id, frame, props }) => {
        const page = renderPageTemplate({ id, frame, props });
        const tracker = props.tracker ? trackerLabelNodes({ id: stableId(id, "tracker"), frame: { x: frame.x + CHROME.left, y: frame.y + 30, width: page.titleWidth, height: 20 }, props: props.tracker }) : [];
        return { ...page, nodes: [...tracker, ...titleNodes({ id, frame, props: { text: props.title, variant: props.titleVariant, rule: props.titleRule, availableTitleWidth: page.titleWidth, titleTop: props.tracker ? 58 : CHROME.titleTop }, chrome: true }), ...page.nodes] };
      }
    }),
    component({ id: "page-template", category: "shared", role: "page-template", tokens: PAGE_TEMPLATE_TOKENS,
      preferredSize: { ...SLIDE }, sample: { source: "Source: (Insert source)", companyName: "(Insert company name)", pageNumber: 7 }, render: renderPageTemplate }),
    component({
      id: "section", category: "structure", role: "section", tokens: ["color.surface", "color.surfaceMuted", "color.rule", "space.4", "space.5", "line.standard", "radius.none", "radius.small", ...SECTION_HEADING_TOKENS], preferredSize: { width: 520, height: 300 }, sample: { treatment: "open", heading: "(Insert section heading)" },
      render: ({ id, frame, props }) => {
        const treatment = props.treatment || "open";
        const edge = props.edge || "contained";
        if(!["contained","full-bleed"].includes(edge))throw new Error("Unknown section edge treatment");
        const padding = normalizeInsets(props.padding ?? token("space.4"));
        const fill = treatment === "muted" ? MUTED_SURFACE : treatment === "primary" ? PRIMARY : SURFACE;
        const stroke = treatment === "open" ? RULE : fill;
        const nodes = [];
        const headerFrame = { x: frame.x + padding.left, y: frame.y + padding.top, width: frame.width - padding.left - padding.right, height: frame.height };
        const headerProps = { ...props, variant: treatment === "primary" ? "inverse" : "standard", rule: treatment !== "muted" };
        if (props.heading) nodes.push(...sectionHeadingNodes({ id: stableId(id, "header"), frame: headerFrame, props: headerProps }));
        const top = padding.top + (props.heading ? headingLayout(headerFrame, headerProps).height : 0);
        const contentFrame = { x: frame.x + padding.left, y: frame.y + top, width: frame.width - padding.left - padding.right, height: frame.height - top - padding.bottom };
        if (treatment !== "open") nodes.unshift(rectPrimitive({ id: stableId(id, "surface"), role: "section-surface", frame, style: boxStyle(fill, stroke, treatment === "primary" ? STANDARD : HAIRLINE, edge === "full-bleed" ? token("radius.none") : SMALL_RADIUS), data: { edge, contentFrame } }));
        return { nodes, contentFrame };
      }
    }),
    component({ id: "section-heading", category: "shared", role: "section-heading", tokens: SECTION_HEADING_TOKENS, preferredSize: { width: 720, height: 52 }, sample: { heading: "(Insert section heading)", rule: true }, render: ({ id, frame, props }) => ({ nodes: sectionHeadingNodes({ id, frame, props }) }) }),
    component({ id: "action-title", category: "shared", role: "title", tokens: ["font.display", "type.actionTitle", "color.ink", "color.rule", "line.hairline", "space.2"], preferredSize: { width: 1136, height: 86 }, sample: { text: "(Insert action title)" }, render: ({ id, frame, props }) => ({ nodes: titleNodes({ id, frame, props }) }) }),
    component({ id: "section-title", category: "shared", role: "title", tokens: ["font.display", "type.sectionTitle", "color.ink", "color.rule", "line.hairline", "space.2"], preferredSize: { width: 720, height: 64 }, sample: { text: "(Insert section title)" }, render: ({ id, frame, props }) => ({ nodes: titleNodes({ id, frame, props, section: true }) }) }),
    component({ id: "cover", category: "navigation", role: "cover", tokens: ["color.ink", "color.textSecondary", "font.display", "font.body", "type.deckTitle", "type.body", "space.5"], preferredSize: { width: 1280, height: 720 }, sample: { title: "(Insert presentation title)", subtitle: "(Insert subtitle)" }, render: ({ id, frame, props }) => {
      if (typeof props.title !== "string" || !props.title.trim()) throw new Error("Cover requires a deck title");
      if (props.subtitle !== undefined && typeof props.subtitle !== "string") throw new Error("Cover subtitle must be text");
      // The compiler supplies headerBandHeight to every component as layout metadata.
      if (Object.keys(props).some(key => !["title", "subtitle", "headerBandHeight"].includes(key))) throw new Error("Cover supports only title and subtitle; use the page template for other furniture");
      const width = frame.width - CHROME.left - CHROME.right;
      const title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")), bold: true, wrapWidthRatio: 1 });
      const subtitle = props.subtitle?.trim() ? measureText(props.subtitle, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY), wrapWidthRatio: 1 }) : null;
      const gap = subtitle ? tokenValue(token("space.5")) : 0, height = title.height + gap + (subtitle?.height || 0);
      if (title.lines.length > 2 || subtitle?.lines.length > 2 || height > frame.height - 2 * CHROME.left) throw new Error("Cover text exceeds its allocated space; shorten the title or subtitle");
      const x = frame.x + CHROME.left, y = frame.y + (frame.height - height) / 2;
      const nodes = [textPrimitive({ id: stableId(id, "title"), role: "cover-title", frame: { x, y, width, height: title.height }, text: title.text, style: { ...textStyle(token("type.deckTitle"), INK, true, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } })];
      if (subtitle) nodes.push(textPrimitive({ id: stableId(id, "subtitle"), role: "cover-subtitle", frame: { x, y: y + title.height + gap, width, height: subtitle.height }, text: subtitle.text, style: { ...textStyle(BODY, SECONDARY, false, "left", "top"), lineHeight: subtitle.lineHeight, wrap: false }, data: { textLayout: subtitle } }));
      return { nodes };
    } }),
    component({ id: "section-divider", category: "navigation", role: "divider", tokens: ["color.canvas", "color.ink", "color.componentPrimary", "color.onPrimary", "font.display", "type.deckTitle", "type.sectionNumber", "line.hairline", "radius.none", ...PAGE_TEMPLATE_TOKENS], preferredSize: { ...SLIDE }, sample: { title: "(Insert section title)" }, render: ({ id, frame, props }) => {
      if (typeof props.title !== "string" || !props.title.trim()) throw new Error("Section divider requires a section title");
      for (const key of Object.keys(props)) if (!["title", "sectionId", "style", "mode", "pageTemplate", "source", "note", "companyName", "pageNumber", "footerLeft", "footerRight", "headerBandHeight"].includes(key)) throw new Error(`Unknown section-divider setting: ${key}; dividers have one title, an optional section id, and page furniture`);
      const inverse = (props.mode ?? "dark") === "dark";
      const dividerStyle = props.style ?? "plain";
      if (!["plain", "numbered"].includes(dividerStyle)) throw new Error(`Unknown section-divider style: ${dividerStyle}`);
      if (dividerStyle === "numbered" && !String(props.sectionId ?? "").trim()) throw new Error("Numbered section divider requires sectionId");
      const page = renderPageTemplate({ id: stableId(id, "page"), frame, props: { ...props, inverse } });
      const width = dividerStyle === "numbered" ? frame.width * 0.58 - CHROME.left : frame.width - CHROME.left - CHROME.right;
      const title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")), bold: true, wrapWidthRatio: 1 });
      if (title.lines.length > 2 || title.height > frame.height - 2 * CHROME.bodyTop) throw new Error("Section divider title exceeds its allocated space");
      const background = inverse ? INK : token("color.canvas"), foreground = inverse ? WHITE : INK;
      if (contrastRatio(tokenValue(background), tokenValue(foreground)) < 4.5) throw new Error("Section divider title contrast must be at least 4.5:1");
      return { ...page, nodes: [
        rectPrimitive({ id: stableId(id, "surface"), role: "divider-surface", frame, style: boxStyle(background, background, HAIRLINE, token("radius.none")) }),
        textPrimitive({ id: stableId(id, "title"), role: "divider-title", frame: { x: frame.x + CHROME.left, y: frame.y + (frame.height - title.height) / 2, width, height: title.height }, text: title.text, style: { ...textStyle(token("type.deckTitle"), foreground, true, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }),
        ...(dividerStyle === "numbered" ? [textPrimitive({ id: stableId(id, "number"), role: "divider-number", frame: { x: frame.x + frame.width * 0.67, y: frame.y + 110, width: frame.width * 0.25, height: frame.height - 220 }, text: String(props.sectionId), style: { ...textStyle(token("type.sectionNumber"), inverse ? WHITE : PRIMARY, true, "center", "mid"), fontFamily: DISPLAY }, data: { sectionId: String(props.sectionId), dividerStyle } })] : []),
        ...page.nodes
      ] };
    } }),
    component({ id: "source", category: "shared", role: "source", tokens: ["font.body", "type.source", "color.textSecondary", "color.rule", "line.hairline"], preferredSize: { width: 920, height: 26 }, sample: { text: "Source: (Insert source)" }, render: ({ id, frame, props }) => {
      const variant = resolveTitleVariant(props);
      return { nodes: [...(variant === "with-line" ? [openLine(stableId(id, "rule"), frame.x, frame.y, frame.x + frame.width, frame.y, "source-rule", RULE, HAIRLINE)] : []), textPrimitive({ id: stableId(id, "text"), role: "source-text", frame: { x: frame.x, y: frame.y + 4, width: frame.width, height: frame.height - 4 }, text: props.text, style: textStyle(SOURCE, SECONDARY, false, "left") })] };
    } }),
    component({ id: "footnote", category: "shared", role: "footnote", tokens: ["font.body", "type.source", "color.textSecondary"], preferredSize: { width: 600, height: 34 }, sample: { text: "Note: (Insert note)" }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "text"), role: "footnote-text", frame, text: props.text, style: textStyle(SOURCE, SECONDARY, false, "left", "top") })] }) }),
    component({ id: "page-number", category: "shared", role: "page-number", tokens: ["font.body", "type.source", "color.textSecondary"], preferredSize: { width: 48, height: 24 }, sample: { value: 7 }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "text"), role: "page-number", frame, text: String(props.value), style: textStyle(SOURCE, SECONDARY, false, "right") })] }) }),
    component({ id: "paragraph", category: "text", tokens: ["font.body", "type.body", "color.ink"], preferredSize: { width: 520, height: 180 }, sample: { text: "(Insert supporting statement)" }, render: ({ id, frame, props }) => ({ nodes: [measuredTextNode({ id: stableId(id, "text"), role: "paragraph", frame, text: props.text, style: textStyle(BODY, INK, false, props.align || "left", "top") })] }) }),
    component({ id: "bullet-list", category: "text", tokens: ["font.body", "type.compact", "type.label", "color.ink", "color.componentPrimary", "color.onPrimary", "space.1", "space.3", "line.hairline", "radius.none", "radius.round"], preferredSize: { width: 540, height: 240 }, sample: { items: ["(Insert supporting point 1)", "(Insert supporting point 2)", "(Insert supporting point 3)"] }, render: ({ id, frame, props }) => ({ nodes: simpleList({ id, frame, items: props.items, numbered: false, marker: "square" }) }) }),
    component({ id: "insight", category: "section", role: "insight", tokens: ["color.componentPrimaryTint", "color.componentPrimary", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "font.body", "type.heading", "type.body", "space.2", "space.4", "space.5", "space.6", "line.hairline", "radius.small"], preferredSize: { width: 1160, height: 100 }, sample: { text: "(Insert decision-relevant synthesis)" }, render: input => ({ nodes: insightNodes(input) }) }),
    component({ id: "panel", category: "section", role: "panel", tokens: ["color.surface", "color.surfaceMuted", "color.componentPrimary", "color.rule", "color.ink", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "radius.none", ...[1, 2, 3, 4, 5, 6].map(index => `color.chartSeries${index}`)], preferredSize: { width: 400, height: 240 }, sample: { heading: "(Insert panel heading)", text: "(Insert panel description)" }, render: ({ id, frame, props, tokens = TOKENS }) => {
      const tone = props.tone || "open";
      const seriesColorIndex = props.seriesColorIndex;
      if (seriesColorIndex !== undefined && (!Number.isInteger(seriesColorIndex) || seriesColorIndex < 0 || seriesColorIndex > 5)) throw new Error("Panel seriesColorIndex must be an integer from zero to five");
      const fill = seriesColorIndex !== undefined ? token(`color.chartSeries${seriesColorIndex + 1}`) : tone === "primary" ? PRIMARY : tone === "dark" ? INK : tone === "muted" ? MUTED_SURFACE : SURFACE;
      const foreground = seriesColorIndex !== undefined
        ? (contrastRatio(tokens[fill.tokenId].value, tokens[WHITE.tokenId].value) >= contrastRatio(tokens[fill.tokenId].value, tokens[INK.tokenId].value) ? WHITE : INK)
        : tone === "primary" || tone === "dark" ? WHITE : INK;
      const data = seriesColorIndex === undefined ? {} : { seriesKey: props.seriesKey ?? props.heading, colorIndex: seriesColorIndex };
      return { nodes: [rectPrimitive({ id: stableId(id, "surface"), role: "panel-surface", frame, style: boxStyle(fill, tone === "open" && seriesColorIndex === undefined ? RULE : fill, HAIRLINE, token("radius.none")), data }), textPrimitive({ id: stableId(id, "heading"), role: "panel-heading", frame: { x: frame.x + 10, y: frame.y + 10, width: frame.width - 20, height: 30 }, text: props.heading, style: textStyle(token("type.heading"), foreground, true), data }), textPrimitive({ id: stableId(id, "body"), role: "panel-body", frame: { x: frame.x + 10, y: frame.y + 44, width: frame.width - 20, height: frame.height - 54 }, text: props.text, style: textStyle(COMPACT, foreground, false, "left", "top"), data })] };
    } }),
    component({ id: "metric", category: "data", role: "metric", tokens: ["color.componentPrimary", "color.textSecondary", "font.display", "font.body", "type.metric", "type.label"], preferredSize: { width: 240, height: 140 }, sample: { value: "74%", label: "(Insert metric label)", delta: "+8 pts" }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "value"), role: "metric-value", frame: { x: frame.x, y: frame.y + 6, width: frame.width, height: frame.height * 0.48 }, text: props.value, style: { ...textStyle(token("type.metric"), PRIMARY, true, "center"), fontFamily: DISPLAY } }), textPrimitive({ id: stableId(id, "label"), role: "metric-label", frame: { x: frame.x + 8, y: frame.y + frame.height * 0.52, width: frame.width - 16, height: 28 }, text: props.label, style: textStyle(LABEL, SECONDARY, false, "center") }), textPrimitive({ id: stableId(id, "delta"), role: "metric-delta", frame: { x: frame.x + 8, y: frame.y + frame.height - 30, width: frame.width - 16, height: 24 }, text: props.delta || "", style: textStyle(LABEL, PRIMARY, true, "center") })] }) }),
    component({ id: "legend", category: "data", role: "legend", tokens: LEGEND_TOKENS, preferredSize: { width: 420, height: 44 }, sample: { items: ["Actual", "Forecast", "Target"] }, render: input => ({ nodes: legendNodes(input) }) }),
    component({
      id: "chart-callout", category: "data", role: "annotation",
      tokens: ["color.surface", "color.componentPrimary", "color.ink", "font.body", "font.bodySemibold", "weight.semibold", "type.chartAnnotation", "line.hairline", "radius.none"],
      preferredSize: { width: 260, height: 90 },
      sample: { text: "(Insert evidence annotation)", direction: "down" },
      variants: { bordered: {}, borderless: { props: { border: false } } },
      defaultVariant: "bordered", render: renderChartCallout
    }),
    component({ id: "table", category: "data", role: "table", tokens: ["color.ink", "color.componentPrimary", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 760, height: 320 }, sample: { columns: ["Metric", "Period A", "Period B"], rows: [["Metric 1", "42", "55"], ["Metric 2", "24%", "29%"], ["Metric 3", "180", "236"]] }, render: renderTable }),
    component({ id: "trend-rows", category: "data", role: "trend-rows", tokens: ["color.ink", "color.surface", "color.rule", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "line.standard", "radius.none"], preferredSize: { width: 1160, height: 440 }, sample: { columns: ["Trend", "Description", "Examples"], rows: [["(Insert trend 1)", "• (Insert supporting point 1)\n• (Insert supporting point 2)", "• (Insert example)"], ["(Insert trend 2)", "• (Insert supporting point 1)", "• (Insert example)"], ["(Insert trend 3)", "• (Insert supporting point 1)", "• (Insert example)"]] }, render: renderTable }),
    component({ id: "comparison-table", category: "data", role: "comparison", tokens: ["color.ink", "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 820, height: 340 }, sample: { columns: ["Criterion", "Option A", "Option B", "Option C"], rows: [["Criterion 1", "Medium", "High", "High"], ["Criterion 2", "Low", "Medium", "Low"], ["Criterion 3", "Medium", "Medium", "High"]], selectedColumn: 3 }, render: renderTable }),
    component({ id: "heatmap", category: "data", role: "heatmap", tokens: ["color.ink", "color.componentPrimary", "color.componentPrimaryTint", "color.chartSeries1", "color.chartSeries2", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 760, height: 320 }, sample: { columns: ["Capability", "A", "B", "C", "D"], rows: [["Capability 1", 2, 4, 5, 3], ["Capability 2", 3, 3, 4, 2], ["Capability 3", 1, 4, 5, 2]] }, render: renderTable }),
    component({ id: "status-list", category: "data", role: "status", tokens: ["color.positive", "color.caution", "color.negative", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.hairline", "radius.round"], preferredSize: { width: 600, height: 260 }, sample: { items: [{ label: "(Insert item 1)", status: "positive" }, { label: "(Insert item 2)", status: "caution" }, { label: "(Insert item 3)", status: "negative" }] }, render: ({ id, frame, props }) => ({ nodes: props.items.flatMap((item, index) => {
      const height = frame.height / props.items.length;
      const fill = item.status === "positive" ? token("color.positive") : item.status === "negative" ? token("color.negative") : token("color.caution");
      return [ellipsePrimitive({ id: stableId(id, "status", index), role: "status-marker", frame: { x: frame.x, y: frame.y + index * height + (height - 20) / 2, width: 20, height: 20 }, style: boxStyle(fill, fill, HAIRLINE, token("radius.round")) }), textPrimitive({ id: stableId(id, "status-cue", index), role: "status-cue", frame: { x: frame.x, y: frame.y + index * height + (height - 20) / 2, width: 20, height: 20 }, text: item.status === "positive" ? "✓" : item.status === "negative" ? "×" : "!", style: textStyle(LABEL, WHITE, true, "center") }), textPrimitive({ id: stableId(id, "label", index), role: "status-label", frame: { x: frame.x + 34, y: frame.y + index * height, width: frame.width - 34, height }, text: item.label, style: textStyle(COMPACT, INK, false, "left") })];
    }) }) }),
    component({ id: "image-frame", category: "media", role: "image", tokens: ["color.surfaceMuted", "color.rule", "color.textSecondary", "font.body", "type.label", "line.hairline", "radius.small"], preferredSize: { width: 520, height: 300 }, sample: { alt: "(Insert image)" }, render: ({ id, frame, props }) => ({ nodes: [rectPrimitive({ id: stableId(id, "frame"), role: "image-frame", frame, style: boxStyle(MUTED_SURFACE, RULE, HAIRLINE, SMALL_RADIUS), data: { alt: props.alt } }), textPrimitive({ id: stableId(id, "alt"), role: "image-alt", frame: { x: frame.x + 24, y: frame.y + frame.height / 2 - 18, width: frame.width - 48, height: 36 }, text: props.alt, style: textStyle(LABEL, SECONDARY, true, "center") })] }) }),
    component({ id: "icon", category: "media", role: "icon", tokens: ["color.componentPrimary", "color.onPrimary", "color.ink", "font.body", "type.heading", "type.label", "line.hairline", "radius.round"], preferredSize: { width: 90, height: 90 }, sample: { symbol: "✓", label: "(Insert label)" }, render: ({ id, frame, props }) => {
      const size = Math.min(frame.width, frame.height * 0.62);
      return { nodes: [ellipsePrimitive({ id: stableId(id, "surface"), role: "icon-surface", frame: { x: frame.x + (frame.width - size) / 2, y: frame.y, width: size, height: size }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }), textPrimitive({ id: stableId(id, "symbol"), role: "icon-symbol", frame: { x: frame.x + (frame.width - size) / 2, y: frame.y, width: size, height: size }, text: props.symbol, style: textStyle(token("type.heading"), WHITE, true, "center") }), textPrimitive({ id: stableId(id, "label"), role: "icon-label", frame: { x: frame.x, y: frame.y + size + 8, width: frame.width, height: frame.height - size - 8 }, text: props.label, style: textStyle(LABEL, INK, true, "center", "top") })] };
    } }),
    component({ id: "logo", category: "media", role: "logo", tokens: ["color.surface", "color.rule", "color.ink", "font.display", "type.heading", "line.hairline", "radius.small"], preferredSize: { width: 220, height: 90 }, sample: { text: "(Insert logo)" }, render: ({ id, frame, props }) => ({ nodes: [rectPrimitive({ id: stableId(id, "backing"), role: "logo-backing", frame, style: boxStyle() }), textPrimitive({ id: stableId(id, "text"), role: "logo-text", frame: insetFrame(frame, 12), text: props.text, style: { ...textStyle(token("type.heading"), INK, true, "center"), fontFamily: DISPLAY } })] }) }),
    component({ id: "process", category: "relationship", role: "process", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 900, height: 280 }, sample: { items: ["(Insert step 1)", "(Insert step 2)", "(Insert step 3)", "(Insert step 4)"], active: 2 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) } }) }) }),
    component({ id: "chevron-process", category: "relationship", role: "process", tokens: ["color.ink", "color.componentPrimary", "color.surface", "color.surfaceMuted", "color.onPrimary", "font.body", "type.heading", "type.compact", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 1160, height: 360 }, sample: { items: [{ heading: "Phase 1", label: "(Insert phase 1)", details: ["(Insert activity 1)", "(Insert activity 2)"] }, { heading: "Phase 2", label: "(Insert phase 2)", details: ["(Insert activity 1)", "(Insert activity 2)"] }, { heading: "Phase 3", label: "(Insert phase 3)", details: ["(Insert activity 1)", "(Insert activity 2)"] }] }, render: ({ id, frame, props }) => {
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
    component({ id: "initiative-rollout", category: "relationship", role: "initiative-rollout", tokens: ["color.ink", "color.componentPrimary", "color.chartSeries2", "color.surfaceMuted", "color.surface", "color.onPrimary", "font.body", "type.heading", "type.compact", "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"], preferredSize: { width: 1160, height: 450 }, sample: { years: ["Year 1", "Year 2", "Year 3"], rows: [{ label: "A", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] }, { label: "B", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] }] }, render: ({ id, frame, props }) => ({ nodes: initiativeRolloutNodes({ id, frame, props }) }) }),
    component({ id: "highlight-strip", category: "relationship", role: "highlight-strip", tokens: ["color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "radius.round"], preferredSize: { width: 1160, height: 126 }, sample: { items: [{ number: "1", heading: "(Insert highlight)", description: "(Insert description)" }, { number: "2", heading: "(Insert highlight)", description: "(Insert description)" }, { number: "3", heading: "(Insert highlight)", description: "(Insert description)" }] }, render: ({ id, frame, props }) => ({ nodes: highlightStripNodes({ id, frame, props }) }) }),
    component({ id: "roadmap", category: "relationship", role: "roadmap", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.heading", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round", "radius.small"], preferredSize: { width: 980, height: 360 }, sample: { items: ["(Insert stage 1)", "(Insert stage 2)", "(Insert stage 3)", "(Insert stage 4)"], active: 1 }, render: ({ id, frame, props }) => ({ nodes: props.variant === "wave-columns" ? waveRoadmapNodes({ id, frame, props }) : processNodes({ id, frame, props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) }, roadmap: true }) }) }),
    component({ id: "timeline", category: "relationship", role: "timeline", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 920, height: 250 }, sample: { items: ["Q1", "Q2", "Q3", "Q4"], active: 2 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props: { ...props, items: props.items.map((label) => ({ label })) } }) }) }),
    component({ id: "journey", category: "relationship", role: "journey", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 960, height: 300 }, sample: { items: [{ label: "(Insert stage 1)", touchpoint: "(Insert touchpoint 1)" }, { label: "(Insert stage 2)", touchpoint: "(Insert touchpoint 2)" }, { label: "(Insert stage 3)", touchpoint: "(Insert touchpoint 3)" }, { label: "(Insert stage 4)", touchpoint: "(Insert touchpoint 4)" }], active: 3 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props, journey: true }) }) }),
    component({ id: "tree", category: "relationship", role: "tree", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "line.hairline", "line.standard", "radius.small"], preferredSize: { width: 900, height: 360 }, sample: { root: "(Insert root question)", children: ["(Insert branch 1)", "(Insert branch 2)", "(Insert branch 3)", "(Insert branch 4)"] }, render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props }) }) }),
    component({ id: "organization", category: "relationship", role: "organization", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "line.hairline", "line.standard", "radius.none", "radius.small"], preferredSize: { width: 900, height: 360 }, sample: { root: "(Insert parent role)", children: ["(Insert role 1)", "(Insert role 2)", "(Insert role 3)", "(Insert role 4)"] }, render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props, organization: true }) }) }),
    component({ id: "matrix", category: "relationship", role: "matrix", tokens: ["color.componentPrimary", "color.chartSeries2", "color.surface", "color.rule", "color.ink", "color.positive", "color.caution", "color.negative", "color.onPrimary", "font.body", "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"], preferredSize: { width: 720, height: 410 }, sample: { points: [{ label: "A", x: 0.24, y: 0.35 }, { label: "B", x: 0.56, y: 0.62 }, { label: "C", x: 0.76, y: 0.82 }], highlight: 2 }, render: ({ id, frame, props }) => ({ nodes: matrixNodes({ id, frame, props }) }) }),
    component({ id: "map", category: "relationship", role: "map", tokens: MAP_TOKENS, preferredSize: { width: 920, height: 440 }, sample: { geography: "world", markers: [{ label: "Americas", x: 0.2, y: 0.45, fraction: 0.75 }, { label: "Europe", x: 0.5, y: 0.34, fraction: 0.5 }, { label: "Asia", x: 0.77, y: 0.44, fraction: 0.25 }] }, render: ({ id, frame, props }) => ({ nodes: mapNodes({ id, frame, props }) }) }),
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
    component({ id: "connector", category: "relationship", role: "connector", tokens: ["color.componentPrimary", "color.onPrimary", "font.body", "type.label", "line.standard", "line.hairline", "icon.medium", "radius.round"], preferredSize: { width: 360, height: 90 }, sample: { label: "therefore", variant: "labelled-line" }, render: ({ id, frame, props }) => {
      const variant = props.variant ?? (props.label ? "labelled-line" : "disc-chevron"), centerY = frame.y + frame.height / 2;
      if (variant === "disc-chevron") {
        const diameter = tokenValue(token("icon.medium")), centerX = frame.x + frame.width / 2;
        return { nodes: [
          ellipsePrimitive({ id: stableId(id, "disc"), role: "relationship-disc", frame: { x: centerX - diameter / 2, y: centerY - diameter / 2, width: diameter, height: diameter }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")), data: { relation: "implies", arrowVariant: variant, arrowPart: 0 } }),
          openLine(stableId(id, "chevron-top"), centerX - diameter / 8, centerY - diameter / 4, centerX + diameter / 8, centerY, "relationship-chevron", WHITE, STANDARD, { relation: "implies", arrowVariant: variant, arrowPart: 1 }),
          openLine(stableId(id, "chevron-bottom"), centerX + diameter / 8, centerY, centerX - diameter / 8, centerY + diameter / 4, "relationship-chevron", WHITE, STANDARD, { relation: "implies", arrowVariant: variant, arrowPart: 2 })
        ] };
      }
      const line = openLine(stableId(id, "line"), frame.x, centerY, frame.x + frame.width - 2, centerY, "relationship-arrow", PRIMARY, STANDARD, { relation: "implies", arrowVariant: "line", endArrow: true, endArrowType: "triangle" });
      if (variant === "line") return { nodes: [line] };
      return { nodes: [line, textPrimitive({ id: stableId(id, "label"), role: "connector-label", frame: { x: frame.x + frame.width * 0.28, y: frame.y, width: frame.width * 0.44, height: frame.height / 2 - 4 }, text: props.label, style: textStyle(LABEL, PRIMARY, true, "center") })] };
    } }),
    component({ id: "content-rail", category: "section", role: "rail", tokens: ["color.surface", "color.surfaceMuted", "color.rule", "type.compact", "space.1", "space.3", "radius.none", ...SECTION_HEADING_TOKENS], preferredSize: { width: 330, height: 360 }, sample: { heading: "(Insert takeaway heading)", items: ["(Insert evidence-backed takeaway 1)", "(Insert evidence-backed takeaway 2)", "(Insert evidence-backed takeaway 3)"] }, render: ({ id, frame, props }) => {
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
  ];
  for (const definition of definitions) {
    if (["table", "comparison-table", "heatmap", "trend-rows"].includes(definition.id)) {
      definition.tokens = TABLE_TOKENS;
      const normalize = props => {
        if (definition.id === "heatmap") return { ...props, columns: props.columns.map((label,index)=>({label,type:index?'heatmap':'text',scale:index?'score':undefined})), rows: props.rows.map(row=>row.map((value,index)=>index?{value}:value)), scales: {score:{type:'heatmap',label:'Assessment',min:1,max:5,anchors:{1:'Low',3:'Medium',5:'High'}}} };
        if (definition.id === "trend-rows") return { ...props, columns: props.columns.map((label,index)=>({label,type:index?'text':'category',width:[.18,.52,.3][index]})) };
        if (definition.id === "comparison-table") {
          if (props.selectedColumn !== undefined && (!Number.isInteger(props.selectedColumn) || props.selectedColumn < 0 || props.selectedColumn >= props.columns.length)) throw new Error("Invalid comparison selectedColumn");
          return { ...props, rows: props.rows.map(row => {
            const cells = (Array.isArray(row) ? row : row.cells).map((value, index) => {
              if (index !== props.selectedColumn || value === null) return value;
              return typeof value === "object" && !Array.isArray(value)
                ? { ...value, highlight: true }
                : { text: String(value), value, highlight: true };
            });
            return Array.isArray(row) ? cells : { ...row, cells };
          }) };
        }
        return props;
      };
      definition.render = input => renderTable({...input,props:normalize(input.props)});
      definition.measureContent = input => measureTable({...input,props:normalize(input.props)});
      if (definition.id === "table") {
        definition.variants = TABLE_VARIANTS;
        definition.defaultVariant = "open";
        definition.variantProp = "variant";
        definition.resolveVariant = props => props.variant ?? (props.treatment === "standard" ? "standard" : "open");
        const render=definition.render;
        definition.render=input=>{if(!Object.hasOwn(TABLE_VARIANTS,definition.resolveVariant(input.props)))throw new Error('Unknown table variant');return render(input);};
      }
    }
    const axes = { section: ["treatment", ["open", "muted", "primary"]], panel: ["tone", ["open", "muted", "primary", "dark"]], "content-rail": ["treatment", ["muted", "open"]], roadmap: ["variant", ["process", "wave-columns"]], "section-heading": ["variant", ["standard", "accent", "inverse"]] };
    axes["section-boundary"] = ["variant", ["related", "inference", "subsection"]];
    axes.connector = ["variant", ["disc-chevron", "line", "labelled-line"]];
    axes["bullet-list"] = ["variant", ["compact", "body"]];
    axes.insight = ["variant", ["tonal", "neutral", "dotted", "primary"]];
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
    if (definition.id === "roadmap") definition.variants["wave-columns"] = { preferredSize: { width: 1160, height: 480 }, props: { items: [1, 2, 3].map((index) => ({ heading: `(Insert wave ${index} heading)`, range: `(Insert time range ${index})`, activities: ["(Insert activity)"], deliverables: ["(Insert deliverable)"] })) } };
    if (definition.id === "bullet-list") {
      definition.tokens.push("type.body", "space.2", "space.4");
      const render = definition.render;
      definition.render = input => definition.resolveVariant(input.props) === "body" ? { nodes: bodyListNodes(input) } : render(input);
      definition.measureContent = ({ frame, props }) => {
        if (definition.resolveVariant(props) !== "body") throw new Error("Content measurement requires the body bullet-list variant");
        return bodyListLayout(frame, props.items);
      };
    }
    if (definition.id === "section-heading") definition.variants.inverse = { backdrop: "primary" };
    if (definition.id === "insight") definition.measureContent = ({ frame, props }) => { definition.resolveVariant(props); return insightLayout(frame, props); };
    if (definition.id === "section-boundary") definition.variants.subsection = { preferredSize: { width: 520, height: 24 } };
    if (definition.id === "map") {
      definition.version = "3.0.0";
      definition.variants = Object.fromEntries(MAP_PRESET_IDS.map((geography) => [geography, { props: { geography, markers: [] } }]));
      definition.defaultVariant = "world";
      definition.variantProp = "geography";
      definition.resolveVariant = (props = {}) => resolveGeography(props.geography ?? "world").id;
      definition.guidance = MAP_GUIDANCE;
      const render = definition.render;
      definition.render = input => { definition.resolveVariant(input.props); return render(input); };
      definition.examples = {
        "world-country-highlight": { props: { geography: "world", markers: [], highlightCountries: ["USA", "DEU", "CHN"] } },
        "country-marker-anchor": { props: { geography: "europe", markers: [{ country: "GBR", label: "United Kingdom", fraction: 1 }] } }
      };
    }
    if (definition.id === "legend") {
      const visuallyDistinctPlacements = LEGEND_PLACEMENTS.filter(placement => placement !== "inline");
      definition.variants = Object.fromEntries(Object.keys(LEGEND_VARIANTS).flatMap(mark => visuallyDistinctPlacements.map(placement => [`${mark}-${placement}`, { props: { variant: mark, placement, items: [{ label: "Actual", state: "actual" }, { label: "Forecast", state: "forecast" }, { label: "Target", state: "actual" }] }, preferredSize: { width: 540, height: placement === "right" ? 120 : 44 } }])));
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
      definition.variants = Object.fromEntries(["plain", "numbered"].flatMap(style => ["dark", "light"].flatMap(mode => PAGE_RULES.map(rules => [`${style}-${mode}-${rules}`, { props: { style, mode, ...(style === "numbered" ? { sectionId: "1" } : {}), pageTemplate: { rules } } }]))));
      definition.defaultVariant = "plain-dark-none";
      definition.resolveVariant = (props = {}) => {
        const mode = props.mode ?? "dark";
        const style = props.style ?? "plain";
        if (!["light", "dark"].includes(mode)) throw new Error(`Unknown section-divider mode: ${mode}`);
        if (!["plain", "numbered"].includes(style)) throw new Error(`Unknown section-divider style: ${style}`);
        return `${style}-${mode}-${resolvePageTemplate(props.pageTemplate).rules}`;
      };
      const render = definition.render;
      definition.render = input => { definition.resolveVariant(input.props); return render(input); };
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
    tokens: [...SECTION_HEADING_TOKENS, "type.body", "color.chartUnit", "space.1"],
    preferredSize: { width: 540, height: 76 }, sample: { heading: "(Insert chart title)" },
    variants: { underlined: {}, unit: { props: { unit: "Revenue share, %" } } }, defaultVariant: "underlined", variantProp: "variant", resolveVariant: resolveChartTitleVariant,
    measureContent: ({ frame, props }) => chartTitleLayout(frame, props),
    measureHeader: ({ frame, props }) => ({ top: frame.y, ruled: resolveChartTitleVariant(props) === "underlined", height: headingLayout(frame, props).heading.height }),
    render: input => ({ nodes: chartTitleNodes(input) })
  });
  return registry;
}

export function createRegistry() {
  return registerChartGroup(registerCharts(registerQuoteCluster(registerInsightTreeTable(registerTrackers(registerCore(new Map()))))));
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
      sample: definition.sample,
      ...(definition.guidance ? { guidance: definition.guidance } : {})
    }))
  };
}
