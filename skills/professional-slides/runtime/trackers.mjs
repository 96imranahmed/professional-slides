import {
  SLIDE,
  ellipsePrimitive,
  linePrimitive,
  rectPrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";

const INK = token("color.ink");
const SECONDARY = token("color.textSecondary");
const PRIMARY = token("color.componentPrimary");
const PRIMARY_TINT = token("color.componentPrimaryTint");
const CANVAS = token("color.canvas");
const SURFACE = token("color.surface");
const MUTED = token("color.surfaceMuted");
const RULE = token("color.rule");
const WHITE = token("color.onPrimary");
const BODY_FONT = token("font.body");
const DISPLAY_FONT = token("font.display");
const HAIRLINE = token("line.hairline");
const STANDARD = token("line.standard");
const ROUND = token("radius.round");
const NONE = token("radius.none");
const SMALL = token("radius.small");

export const TRACKER_TOKENS = Object.freeze([
  "color.canvas", "color.surface", "color.surfaceMuted", "color.componentPrimaryTint",
  "color.componentPrimary", "color.ink", "color.textSecondary", "color.rule", "color.onPrimary",
  "font.body", "font.display", "type.deckTitle", "type.sectionTitle", "type.heading",
  "type.body", "type.compact", "type.label", "space.1", "space.2", "space.3",
  "space.4", "space.5", "space.6", "space.8", "line.hairline", "line.standard",
  "radius.none", "radius.small", "radius.round"
]);

const TRACKER_PAGE_VARIANTS = Object.freeze(Object.fromEntries([
  ...["light", "dark"].flatMap(mode => ["overview", "selected"].map(state => [
    `sequential-${state}-${mode}`,
    { props: { layout: "sequential-circles", mode, selectedId: state === "selected" ? "B" : null } }
  ])),
  ...["regular", "long"].flatMap(density => ["light", "dark"].flatMap(mode => [
    [
      `split-overview-${density}-${mode}`,
      { props: { layout: "split-contents", density, mode, selectedId: null, ...(density === "long" ? { items: Array.from({ length: 8 }, (_, index) => ({ id: String.fromCharCode(65 + index), label: `Section ${String.fromCharCode(65 + index)}` })) } : {}) } }
    ],
    [
      `split-selected-${density}-${mode}`,
      { props: { layout: "split-contents", density, mode, selectedId: "B", selectionTreatment: "tint", ...(density === "long" ? { items: Array.from({ length: 8 }, (_, index) => ({ id: String.fromCharCode(65 + index), label: `Section ${String.fromCharCode(65 + index)}` })) } : {}) } }
    ],
    [
      `split-selected-inverse-${density}-${mode}`,
      { props: { layout: "split-contents", density, mode, selectedId: "B", selectionTreatment: "inverse", ...(density === "long" ? { items: Array.from({ length: 8 }, (_, index) => ({ id: String.fromCharCode(65 + index), label: `Section ${String.fromCharCode(65 + index)}` })) } : {}) } }
    ]
  ]))
]));

const TRACKER_LABEL_VARIANTS = Object.freeze(Object.fromEntries(
  ["label", "breadcrumb", "number-strip"].flatMap(construction => ["light", "dark"].map(mode => [
    `${construction}-${mode}`,
    { props: { construction: `compact-${construction}`, mode }, ...(mode === "dark" ? { backdrop: "primary" } : {}) }
  ]))
));

function style(fontSize, color, bold = false, align = "left", valign = "mid", display = false) {
  return { fontFamily: display ? DISPLAY_FONT : BODY_FONT, fontSize, color, bold, align, valign };
}

function box(fill, stroke = fill, lineWidth = HAIRLINE, radius = NONE) {
  return { fill, stroke, lineWidth, radius };
}

function trackerItems(props) {
  if (!Array.isArray(props.items) || props.items.length < 3 || props.items.length > 11) throw new Error("Tracker requires three to eleven items");
  const items = props.items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Tracker item ${index + 1} must be an object`);
    const id = String(item.id ?? "").trim(), label = String(item.label ?? "").trim();
    if (!id || !label) throw new Error(`Tracker item ${index + 1} requires a stable id and label`);
    return { id, label };
  });
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error("Tracker item ids must be unique");
  if (props.selectedId !== null && props.selectedId !== undefined && !items.some(item => item.id === String(props.selectedId))) throw new Error("Tracker selectedId must match exactly one item");
  return items;
}

function pageSettings(props) {
  const layout = props.layout ?? "sequential-circles";
  const mode = props.mode ?? "light";
  const density = props.density ?? "regular";
  const selectionTreatment = props.selectionTreatment ?? "tint";
  if (!["sequential-circles", "split-contents"].includes(layout)) throw new Error(`Unknown tracker-page layout: ${layout}`);
  if (!["light", "dark"].includes(mode)) throw new Error(`Unknown tracker-page mode: ${mode}`);
  if (!["regular", "long"].includes(density)) throw new Error(`Unknown tracker-page density: ${density}`);
  if (!["tint", "inverse"].includes(selectionTreatment)) throw new Error(`Unknown tracker-page selection treatment: ${selectionTreatment}`);
  if (layout === "sequential-circles" && density !== "regular") throw new Error("Sequential tracker uses its one stable density");
  if (layout === "sequential-circles" && props.selectionTreatment !== undefined) throw new Error("Sequential tracker does not use a row selection treatment");
  return { layout, mode, density, selectionTreatment };
}

export function resolveTrackerPageVariant(props = {}) {
  const { layout, mode, density, selectionTreatment } = pageSettings(props);
  const state = props.selectedId === null || props.selectedId === undefined ? "overview" : "selected";
  const key = layout === "sequential-circles"
    ? `sequential-${state}-${mode}`
    : state === "overview"
      ? `split-overview-${density}-${mode}`
      : `split-selected${selectionTreatment === "inverse" ? "-inverse" : ""}-${density}-${mode}`;
  if (!Object.hasOwn(TRACKER_PAGE_VARIANTS, key)) throw new Error(`Unknown tracker-page variant: ${key}`);
  return key;
}

function measuredText(id, role, frame, text, textStyle, data = {}) {
  const layout = measureText(text, frame.width, {
    fontFamily: tokenValue(textStyle.fontFamily),
    fontSize: tokenValue(textStyle.fontSize),
    bold: textStyle.bold,
    wrapWidthRatio: 1
  });
  if (layout.height > frame.height) throw new Error(`${id} exceeds its tracker text frame`);
  return textPrimitive({ id, role, frame: { ...frame, height: layout.height }, text: layout.text, style: { ...textStyle, valign: "top", lineHeight: layout.lineHeight, wrap: false }, data: { ...data, textLayout: layout } });
}

function commonData(props, item, index) {
  return { trackerId: props.trackerId ?? "deck-sections", sectionId: item.id, trackerIndex: index, selected: String(props.selectedId ?? "") === item.id };
}

function sequentialNodes({ id, frame, props, items, dark }) {
  if (items.length > 6) throw new Error("Sequential tracker supports three to six items; use split contents for longer lists");
  const foreground = dark ? WHITE : INK, quiet = dark ? WHITE : SECONDARY;
  const nodes = [rectPrimitive({ id: stableId(id, "surface"), role: "tracker-page-surface", frame, style: box(dark ? INK : CANVAS, dark ? INK : CANVAS) })];
  const titleText = String(props.title ?? "Contents").trim();
  if (!titleText) throw new Error("Sequential tracker requires a page title");
  nodes.push(measuredText(stableId(id, "title"), "tracker-page-title", { x: frame.x + 72, y: frame.y + 62, width: frame.width - 144, height: 70 }, titleText, style(token("type.sectionTitle"), foreground, true, "left", "top", true), { trackerId: props.trackerId ?? "deck-sections" }));
  const left = frame.x + 108, right = frame.x + frame.width - 108, markerSize = 52;
  const railY = frame.y + frame.height * 0.48;
  nodes.push(linePrimitive({ id: stableId(id, "rail"), role: "tracker-rail", x1: left, y1: railY, x2: right, y2: railY, style: { stroke: quiet, lineWidth: HAIRLINE }, data: { trackerId: props.trackerId ?? "deck-sections" } }));
  const span = (right - left) / (items.length - 1);
  items.forEach((item, index) => {
    const data = commonData(props, item, index), selected = data.selected;
    const x = left + index * span, markerFill = selected ? (dark ? WHITE : PRIMARY) : (dark ? INK : SURFACE);
    const markerStroke = selected ? markerFill : quiet, markerText = selected ? (dark ? INK : WHITE) : quiet;
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", item.id), role: "tracker-marker", frame: { x: x - markerSize / 2, y: railY - markerSize / 2, width: markerSize, height: markerSize }, style: box(markerFill, markerStroke, selected ? STANDARD : HAIRLINE, ROUND), data }));
    nodes.push(textPrimitive({ id: stableId(id, "marker-label", item.id), role: "tracker-marker-label", frame: { x: x - markerSize / 2, y: railY - markerSize / 2, width: markerSize, height: markerSize }, text: item.id, style: style(token("type.heading"), markerText, true, "center", "mid"), data }));
    const labelWidth = Math.min(220, span * 0.84);
    const labelX = Math.max(frame.x + 24, Math.min(x - labelWidth / 2, frame.x + frame.width - 24 - labelWidth));
    nodes.push(measuredText(stableId(id, "item-label", item.id), "tracker-item-label", { x: labelX, y: railY + 46, width: labelWidth, height: 84 }, item.label, style(token("type.body"), selected ? foreground : quiet, selected, "center", "top"), data));
  });
  return nodes;
}

function splitNodes({ id, frame, props, items, dark, density, selectionTreatment }) {
  const nodes = [];
  const leftWidth = frame.width * 0.43, rightX = frame.x + leftWidth, rightWidth = frame.width - leftWidth;
  const leftFill = dark ? INK : CANVAS, rightFill = dark ? PRIMARY_TINT : MUTED;
  const leftText = dark ? WHITE : INK, rightText = INK;
  nodes.push(rectPrimitive({ id: stableId(id, "left-surface"), role: "tracker-page-surface", frame: { x: frame.x, y: frame.y, width: leftWidth, height: frame.height }, style: box(leftFill, leftFill) }));
  nodes.push(rectPrimitive({ id: stableId(id, "backdrop"), role: "tracker-backdrop", frame: { x: rightX, y: frame.y, width: rightWidth, height: frame.height }, style: box(rightFill, rightFill) }));
  const parentTitle = String(props.parentTitle ?? props.title ?? "Section A").trim();
  if (!parentTitle) throw new Error("Split contents requires a parent title");
  const parent = measureText(parentTitle, leftWidth - 144, { fontFamily: tokenValue(DISPLAY_FONT), fontSize: tokenValue(token("type.sectionTitle")), bold: true, wrapWidthRatio: 1 });
  if (parent.lines.length > 3) throw new Error("Split contents parent title must fit without a subtitle");
  nodes.push(textPrimitive({ id: stableId(id, "parent-title"), role: "tracker-parent-title", frame: { x: frame.x + 72, y: frame.y + (frame.height - parent.height) / 2, width: leftWidth - 144, height: parent.height }, text: parent.text, style: { ...style(token("type.sectionTitle"), leftText, true, "left", "top", true), lineHeight: parent.lineHeight, wrap: false }, data: { trackerId: props.trackerId ?? "deck-sections", parentId: props.parentId ?? null, textLayout: parent } }));
  const rowHeight = density === "long" ? 50 : 66;
  const listHeight = rowHeight * items.length;
  if (listHeight > frame.height - 96) throw new Error("Split tracker list does not fit the selected density");
  const listX = rightX + 56, listWidth = rightWidth - 112, listY = frame.y + (frame.height - listHeight) / 2;
  items.forEach((item, index) => {
    const data = commonData(props, item, index), selected = data.selected, rowY = listY + index * rowHeight;
    const inverse = selected && selectionTreatment === "inverse";
    const labelStyle = style(density === "long" ? token("type.compact") : token("type.body"), inverse ? WHITE : rightText, selected, "left", "mid");
    const labelMeasure = measureText(item.label, listWidth - 96, { fontFamily: tokenValue(BODY_FONT), fontSize: tokenValue(labelStyle.fontSize), bold: selected, wrapWidthRatio: 1 });
    const selectionWidth = Math.min(listWidth, Math.max(listWidth * 0.72, labelMeasure.width + 112));
    const selectionFill = inverse ? PRIMARY : dark ? SURFACE : PRIMARY_TINT;
    if (selected) nodes.push(rectPrimitive({ id: stableId(id, "selection", item.id), role: "tracker-selection", frame: { x: listX, y: rowY + 5, width: selectionWidth, height: rowHeight - 10 }, style: box(selectionFill, selectionFill, HAIRLINE, SMALL), data: { ...data, selectionTreatment } }));
    const markerSize = density === "long" ? 30 : 36, markerX = listX + 14, markerY = rowY + (rowHeight - markerSize) / 2;
    const markerFill = selected ? PRIMARY : SURFACE;
    const markerStroke = selected ? (inverse ? WHITE : PRIMARY) : RULE;
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", item.id), role: "tracker-marker", frame: { x: markerX, y: markerY, width: markerSize, height: markerSize }, style: box(markerFill, markerStroke, selected ? STANDARD : HAIRLINE, ROUND), data }));
    nodes.push(textPrimitive({ id: stableId(id, "marker-label", item.id), role: "tracker-marker-label", frame: { x: markerX, y: markerY, width: markerSize, height: markerSize }, text: item.id, style: style(token("type.label"), selected ? WHITE : rightText, true, "center", "mid"), data }));
    const labelY = rowY + (rowHeight - labelMeasure.height) / 2;
    nodes.push(textPrimitive({ id: stableId(id, "item-label", item.id), role: "tracker-item-label", frame: { x: markerX + markerSize + 18, y: labelY, width: listWidth - markerSize - 40, height: labelMeasure.height }, text: labelMeasure.text, style: { ...labelStyle, valign: "top", lineHeight: labelMeasure.lineHeight, wrap: false }, data: { ...data, textLayout: labelMeasure } }));
  });
  return nodes;
}

export function trackerPageNodes({ id, frame, props }) {
  const items = trackerItems(props), settings = pageSettings(props);
  resolveTrackerPageVariant(props);
  return settings.layout === "sequential-circles"
    ? sequentialNodes({ id, frame, props, items, dark: settings.mode === "dark" })
    : splitNodes({ id, frame, props, items, dark: settings.mode === "dark", density: settings.density, selectionTreatment: settings.selectionTreatment });
}

function labelSettings(props) {
  const construction = props.construction ?? "compact-label", mode = props.mode ?? "light";
  if (!["compact-label", "compact-breadcrumb", "compact-number-strip"].includes(construction)) throw new Error(`Unknown tracker-label construction: ${construction}`);
  if (!["light", "dark"].includes(mode)) throw new Error(`Unknown tracker-label mode: ${mode}`);
  return { construction, mode };
}

export function resolveTrackerLabelVariant(props = {}) {
  const { construction, mode } = labelSettings(props);
  const key = `${construction.replace(/^compact-/, "")}-${mode}`;
  if (!Object.hasOwn(TRACKER_LABEL_VARIANTS, key)) throw new Error(`Unknown tracker-label variant: ${key}`);
  return key;
}

export function trackerLabelNodes({ id, frame, props }) {
  const items = trackerItems(props), { construction, mode } = labelSettings(props), selectedId = String(props.selectedId ?? "");
  const selected = items.find(item => item.id === selectedId);
  if (!selected) throw new Error("Compact tracker requires exactly one selected item");
  const dark = mode === "dark", foreground = dark ? WHITE : PRIMARY, quiet = dark ? WHITE : SECONDARY;
  if (construction === "compact-number-strip") {
    const nodes = [];
    const markerSize = Math.min(24, frame.height - 2), gap = tokenValue(token("space.3"));
    const total = items.length * markerSize + (items.length - 1) * gap;
    const x0 = frame.x, y = frame.y + (frame.height - markerSize) / 2;
    nodes.push(linePrimitive({ id: stableId(id, "rail"), role: "tracker-compact-rail", x1: x0 + markerSize / 2, y1: y + markerSize / 2, x2: x0 + total - markerSize / 2, y2: y + markerSize / 2, style: { stroke: quiet, lineWidth: HAIRLINE }, data: { trackerId: props.trackerId ?? "deck-sections" } }));
    items.forEach((item, index) => {
      const data = commonData(props, item, index), active = data.selected, x = x0 + index * (markerSize + gap);
      nodes.push(ellipsePrimitive({ id: stableId(id, "marker", item.id), role: "tracker-compact-marker", frame: { x, y, width: markerSize, height: markerSize }, style: box(active ? foreground : (dark ? INK : SURFACE), active ? foreground : quiet, active ? STANDARD : HAIRLINE, ROUND), data }));
      nodes.push(textPrimitive({ id: stableId(id, "marker-label", item.id), role: "tracker-compact-marker-label", frame: { x, y, width: markerSize, height: markerSize }, text: item.id, style: style(token("type.label"), active ? (dark ? INK : WHITE) : quiet, true, "center", "mid"), data }));
    });
    return nodes;
  }
  const parent = String(props.parentTitle ?? props.parentLabel ?? "").trim();
  const text = construction === "compact-breadcrumb" && parent ? `${parent}  /  ${selected.id}. ${selected.label}` : `${selected.id}. ${selected.label}`;
  return [measuredText(stableId(id, "text"), "tracker-compact-label", frame, text, style(token("type.label"), foreground, true, "left", "top"), { trackerId: props.trackerId ?? "deck-sections", sectionId: selected.id, selected: true, construction })];
}

export function registerTrackers(registry) {
  const sampleItems = [
    { id: "A", label: "Section A" },
    { id: "B", label: "Section B" },
    { id: "C", label: "Section C" },
    { id: "D", label: "Section D" }
  ];
  registry.set("tracker-page", {
    id: "tracker-page", version: "2.1.0", category: "navigation", role: "tracker-page",
    tokens: [...TRACKER_TOKENS], preferredSize: { ...SLIDE },
    sample: { trackerId: "example-sections", title: "Contents", parentTitle: "Section A", items: sampleItems, selectedId: "B", layout: "sequential-circles", mode: "light", density: "regular" },
    variants: TRACKER_PAGE_VARIANTS, defaultVariant: "sequential-selected-light", resolveVariant: resolveTrackerPageVariant,
    render: input => ({ nodes: trackerPageNodes(input) })
  });
  registry.set("tracker-label", {
    id: "tracker-label", version: "2.0.0", category: "navigation", role: "tracker-label",
    tokens: [...TRACKER_TOKENS], preferredSize: { width: 1160, height: 26 },
    sample: { trackerId: "example-sections", parentTitle: "Contents", items: sampleItems, selectedId: "B", construction: "compact-label", mode: "light" },
    variants: TRACKER_LABEL_VARIANTS, defaultVariant: "label-light", resolveVariant: resolveTrackerLabelVariant,
    render: input => ({ nodes: trackerLabelNodes(input) })
  });
  return registry;
}
