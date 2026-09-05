import crypto from "node:crypto";
import { resolvePalette, heatScaleTokens } from "./palettes.mjs";
import { activeDesignTokens, withDesignTokens } from "./design-context.mjs";
import { resolveTypography } from "./typography.mjs";

export const DESIGN_SYSTEM_VERSION = "2.0.0";
export const SCENE_SCHEMA = "professional-slides.scene/v1";
export const MANIFEST_SCHEMA = "professional-slides.design-provenance/v1";
export const DEFAULT_TITLE_VARIANT = "without-line";
export const TITLE_VARIANTS = Object.freeze({
  "with-line": Object.freeze({ rule: true }),
  "without-line": Object.freeze({ rule: false })
});

export function resolveTitleVariant({ variant, rule } = {}) {
  if (variant !== undefined && (typeof variant !== "string" || !Object.hasOwn(TITLE_VARIANTS, variant))) throw new Error(`Unknown title variant: ${variant}`);
  if (rule !== undefined && typeof rule !== "boolean") throw new Error("Title rule must be a boolean");
  const resolved = variant ?? (rule === true ? "with-line" : DEFAULT_TITLE_VARIANT);
  if (rule !== undefined && TITLE_VARIANTS[resolved].rule !== rule) throw new Error("Title variant conflicts with rule");
  return resolved;
}
export const SLIDE = Object.freeze({ width: 1280, height: 720 });
export const CONTENT_FRAME = Object.freeze({ x: 60, y: 46, width: 1160, height: 632 });
export const CHROME = Object.freeze({
  left: 60,
  right: 60,
  titleTop: 48,
  titleHeight: 58,
  bodyTop: 150,
  sourceTop: 648,
  footerRuleY: 680,
  footerTop: 684
});

const colour = (cssVar, value, themeSlot = null) => ({ kind: "color", cssVar, value, themeSlot });
const length = (cssVar, value) => ({ kind: "lengthPx", cssVar, value });
const point = (cssVar, value) => ({ kind: "fontSizePt", cssVar, value });
const font = (cssVar, value) => ({ kind: "fontFamily", cssVar, value });

export const TOKENS = Object.freeze({
  ...heatScaleTokens({'color.canvas':'#FFFFFF','color.componentPrimary':'#00A6E6','color.negative':'#C53030','color.positive':'#198754'}),
  "color.canvas": colour("--canvas", "#FFFFFF"),
  "color.surface": colour("--surface-1", "#FFFFFF", "lt1"),
  "color.surfaceMuted": colour("--surface-2", "#EEF0F2", "lt2"),
  "color.ink": colour("--ink", "#06233B", "dk1"),
  "color.textSecondary": colour("--text-secondary", "#405263", "dk2"),
  "color.chartUnit": colour("--chart-unit-color", "#757575"),
  "color.componentPrimary": colour("--component-primary", "#00A6E6", "accent1"),
  "color.componentPrimaryTint": colour("--component-primary-tint", "#DCEEF8"),
  "color.rule": colour("--rule", "#929BA3"),
  "color.chartGrid": colour("--chart-gridline", "#D4D8DC"),
  "color.chartSeries1": colour("--chart-series-1", "#06233B", "dk1"),
  "color.chartSeries2": colour("--chart-series-2", "#0B4F7D", "accent2"),
  "color.chartSeries3": colour("--chart-series-3", "#00A6E6", "accent3"),
  "color.chartSeries4": colour("--chart-series-4", "#9ACCE8", "accent4"),
  "color.chartSeries5": colour("--chart-series-5", "#D9DDE0", "accent5"),
  "color.chartSeries6": colour("--chart-series-6", "#7B8791", "accent6"),
  "color.positive": colour("--status-positive", "#198754"),
  "color.caution": colour("--status-caution", "#C47B00"),
  "color.negative": colour("--status-negative", "#C53030"),
  "color.info": colour("--status-info", "#0877BE"),
  "color.onPrimary": colour("--on-primary", "#FFFFFF"),
  "font.body": font("--font-body", "Arial"),
  "font.bodySemibold": { ...font("--font-body-semibold", "Arial"), nativeBold: true, effectiveWeight: 700 },
  "weight.semibold": { kind: "fontWeight", cssVar: "--weight-semibold", value: 600 },
  "font.display": font("--font-display", "Arial"),
  "font.serif": font("--font-serif", "Georgia"),
  "type.deckTitle": point("--type-deck-title", 38),
  "type.actionTitle": point("--type-action-title", 30),
  "type.actionTitleLong": point("--type-action-title-long", 27),
  "type.sectionTitle": point("--type-section-title", 24),
  "type.sectionNumber": point("--type-section-number", 170),
  "type.quoteMark": point("--type-quote-mark", 48),
  "type.quoteMarkHero": point("--type-quote-mark-hero", 76),
  "type.heading": point("--type-heading", 16),
  "type.body": point("--type-body", 14),
  // Chart text keeps semantic roles so adapters can preserve purpose and
  // weight, while its default size stays aligned to ordinary body copy.
  "type.chartLabel": point("--type-chart-label", 14),
  "type.chartAnnotation": point("--type-chart-annotation", 14),
  "type.compact": point("--type-compact", 12),
  "type.label": point("--type-label", 10),
  "type.source": point("--type-source", 8),
  "type.metric": point("--type-metric", 26),
  "space.1": length("--space-1", 4),
  "space.2": length("--space-2", 8),
  "space.3": length("--space-3", 12),
  "space.4": length("--space-4", 16),
  "space.5": length("--space-5", 24),
  "space.6": length("--space-6", 32),
  "space.8": length("--space-8", 48),
  "layout.titleContentGap": length("--title-content-gap", 56),
  "icon.small": length("--icon-sm", 16),
  "icon.medium": length("--icon-md", 24),
  "line.hairline": length("--line-hairline", 1),
  "line.standard": length("--line-standard", 2),
  "radius.none": length("--radius-none", 0),
  "radius.small": length("--radius-small", 4),
  "radius.round": length("--radius-round", 999)
});

export const DENSITY_PROFILES = Object.freeze({
  "live-pitch": Object.freeze({ typeScale: 1.15 }),
  executive: Object.freeze({ typeScale: 1 }),
  "pre-read": Object.freeze({ typeScale: 0.9 }),
  appendix: Object.freeze({ typeScale: 0.8 })
});

export function resolveDensityTokens(baseTokens, density = "executive") {
  if (typeof density !== "string" || !Object.hasOwn(DENSITY_PROFILES, density)) throw new Error(`Unknown density profile: ${density}`);
  const scale = DENSITY_PROFILES[density].typeScale;
  return Object.fromEntries(Object.entries(baseTokens).map(([tokenId, definition]) => [
    tokenId,
    tokenId.startsWith("type.")
      ? { ...definition, value: Number((definition.value * scale).toFixed(2)) }
      : { ...definition }
  ]));
}

export const THEME_SLOT_TOKENS = Object.freeze({
  dk1: "color.ink",
  lt1: "color.surface",
  dk2: "color.textSecondary",
  lt2: "color.surfaceMuted",
  accent1: "color.componentPrimary",
  accent2: "color.chartSeries2",
  accent3: "color.chartSeries3",
  accent4: "color.chartSeries4",
  accent5: "color.chartSeries5",
  accent6: "color.chartSeries6",
  hlink: "color.info",
  folHlink: "color.chartSeries4"
});

export function token(tokenId) {
  if (!TOKENS[tokenId]) throw new Error(`Unknown design token: ${tokenId}`);
  return Object.freeze({ tokenId });
}

export function isTokenReference(value) {
  return Boolean(value && typeof value === "object" && typeof value.tokenId === "string");
}

export function tokenDefinition(tokenOrId) {
  const tokenId = typeof tokenOrId === "string" ? tokenOrId : tokenOrId?.tokenId;
  const definition = (activeDesignTokens() || TOKENS)[tokenId];
  if (!definition) throw new Error(`Unknown design token: ${tokenId}`);
  return { tokenId, ...definition };
}

export function tokenValue(tokenOrId) {
  return tokenDefinition(tokenOrId).value;
}

export const chartAnnotationStyle = () => ({ fontFamily: token("font.bodySemibold"), fontWeight: token("weight.semibold") });

export function resolveStyle(style = {}) {
  return Object.fromEntries(
    Object.entries(style).map(([key, value]) => [
      key,
      isTokenReference(value) ? tokenDefinition(value) : value
    ])
  );
}

export function styleValue(value) {
  return value && typeof value === "object" && "value" in value ? value.value : value;
}

export function stableId(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== null && String(part).length)
    .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join(":");
}

export function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function px(value) {
  return Number(Number(value).toFixed(4));
}

export function insetFrame(frame, inset) {
  const value = normalizeInsets(inset);
  return {
    x: px(frame.x + value.left),
    y: px(frame.y + value.top),
    width: px(Math.max(0, frame.width - value.left - value.right)),
    height: px(Math.max(0, frame.height - value.top - value.bottom))
  };
}

export function normalizeInsets(inset = 0) {
  if (isTokenReference(inset)) {
    const value = tokenValue(inset);
    return { top: value, right: value, bottom: value, left: value };
  }
  if (typeof inset === "number") return { top: inset, right: inset, bottom: inset, left: inset };
  const resolve = (value) => isTokenReference(value) ? tokenValue(value) : Number(value || 0);
  const x = resolve(inset.x);
  const y = resolve(inset.y);
  return {
    top: resolve(inset.top ?? y),
    right: resolve(inset.right ?? x),
    bottom: resolve(inset.bottom ?? y),
    left: resolve(inset.left ?? x)
  };
}

export function primitive({ type, id, role, frame, style = {}, text = null, data = {}, tokens = [] }) {
  if (!type || !id || !frame) throw new Error("A scene primitive requires type, id, and frame");
  return {
    type,
    id,
    role: role || type,
    frame: Object.fromEntries(Object.entries(frame).map(([key, value]) => [key, px(value)])),
    style: resolveStyle(style),
    text,
    data,
    tokens: [...new Set([
      ...tokens,
      ...Object.values(style).filter(isTokenReference).map((value) => value.tokenId)
    ])].sort()
  };
}

export function textPrimitive({ id, role = "text", frame, text, style = {}, data = {}, tokens = [] }) {
  return primitive({ type: "text", id, role, frame, text: String(text ?? ""), style, data, tokens });
}

export function rectPrimitive({ id, role = "surface", frame, style = {}, data = {}, tokens = [] }) {
  return primitive({ type: "rect", id, role, frame, style, data, tokens });
}

export function ellipsePrimitive({ id, role = "marker", frame, style = {}, data = {}, tokens = [] }) {
  return primitive({ type: "ellipse", id, role, frame, style, data, tokens });
}

export function portraitPrimitive({ id, frame, portrait, data = {} }) {
  if (!portrait || typeof portrait.dataUri !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(portrait.dataUri)) throw new Error("Portrait requires an embedded PNG data URI");
  if (typeof portrait.alt !== "string" || !portrait.alt.trim() || typeof portrait.authorization !== "string" || !portrait.authorization.trim()) throw new Error("Portrait requires alt text and an asset authorization record");
  const bytes = Buffer.from(portrait.dataUri.split(",")[1], "base64");
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(16) !== bytes.readUInt32BE(20)) throw new Error("Portrait PNG must be square; crop the authorized source before embedding");
  return primitive({ type: "image", id, role: "quote-avatar", frame, data: { ...data, ...portrait, circular: true } });
}

export function linePrimitive({ id, role = "rule", x1, y1, x2, y2, style = {}, data = {}, tokens = [] }) {
  return primitive({
    type: "line",
    id,
    role,
    frame: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
    style,
    data: { ...data, x1: px(x1), y1: px(y1), x2: px(x2), y2: px(y2) },
    tokens
  });
}

export function wedgePrimitive({ id, role = "segment", frame, startAngle, endAngle, style = {}, data = {}, tokens = [] }) {
  return primitive({ type: "wedge", id, role, frame, style, data: { ...data, startAngle, endAngle }, tokens });
}

export function shapePrimitive({ id, role = "shape", geometry = "rect", frame, style = {}, data = {}, tokens = [] }) {
  return primitive({ type: "shape", id, role, frame, style, data: { ...data, geometry }, tokens });
}

export function flow({ id, direction = "row", gap = token("space.4"), padding = 0, size = {}, cell = null, frame = null, children = [] }) {
  return { nodeType: "flow", id, direction, gap, padding, size, cell, frame, children };
}

export function grid({ id, columns, rows, columnGap = token("space.4"), rowGap = token("space.4"), padding = 0, size = {}, cell = null, frame = null, children = [] }) {
  return { nodeType: "grid", id, columns, rows, columnGap, rowGap, padding, size, cell, frame, children };
}

export function overlay({ id, padding = 0, size = {}, cell = null, frame = null, children = [] }) {
  return { nodeType: "overlay", id, padding, size, cell, frame, children };
}

export function absolute({ id, size = {}, cell = null, frame = null, children = [] }) {
  return { nodeType: "absolute", id, size, cell, frame, children };
}

export function component({ id, component: componentId, props = {}, size = {}, cell = null, frame = null, role = null }) {
  return { nodeType: "component", id, component: componentId, props, size, cell, frame, role };
}

export function assertSectionHeadingProps(props = {}) {
  if (Object.hasOwn(props, "subtitle")) throw new Error("Section headings do not support subtitle metadata; use heading text only");
}

export function section(options) {
  assertSectionHeadingProps(options);
  const { id, treatment = "open", edge = "contained", heading = null, padding = token("space.4"), children = [], composition = null, size = {}, cell = null, frame = null } = options;
  return { nodeType: "section", id, treatment, edge, heading, padding, children, composition, size, cell, frame };
}

function resolveLength(value, available, preferred = 0) {
  if (typeof value === "number") return value;
  if (isTokenReference(value)) return Number(tokenValue(value));
  if (value === "hug") return preferred;
  if (value === "fill" || value === undefined || value === null) return null;
  if (typeof value === "object" && typeof value.percent === "number") return available * value.percent;
  return null;
}

function fraction(value) {
  if (value === "fill" || value === undefined || value === null) return 1;
  if (typeof value === "object" && typeof value.fr === "number") return value.fr;
  return 0;
}

function gridTrackPreferences(node, axis, registry) {
  const tracks = axis === "width" ? node.columns : node.rows;
  return tracks.map((_, index) => Math.max(0, ...node.children
    .filter((child) => ((axis === "width" ? child.cell?.column : child.cell?.row) ?? 0) === index && ((axis === "width" ? child.cell?.columnSpan : child.cell?.rowSpan) ?? 1) === 1)
    .map((child) => preferredSize(child, axis, registry))));
}

function preferredSize(node, axis, registry) {
  if (node.nodeType === "component") {
    return registry.get(node.component)?.preferredSize?.[axis] || 0;
  }
  if (node.nodeType === "section") {
    const padding = normalizeInsets(node.padding);
    const nested = node.composition || (node.children?.length ? flow({ id: `${node.id}-intrinsic`, direction: "column", gap: token("space.3"), children: node.children }) : null);
    const content = nested ? preferredSize(nested, axis, registry) : 0;
    if (axis === "width") return content + padding.left + padding.right;
    return content + padding.top + padding.bottom + (node.heading ? 46 : 0);
  }
  const padding = normalizeInsets(node.padding);
  const horizontalPadding = padding.left + padding.right;
  const verticalPadding = padding.top + padding.bottom;
  if (node.nodeType === "flow") {
    const row = node.direction === "row";
    const gap = isTokenReference(node.gap) ? tokenValue(node.gap) : Number(node.gap || 0);
    const childValues = node.children.map((child) => {
      const explicit = child.size?.[axis];
      const preferred = preferredSize(child, axis, registry);
      if (typeof explicit === "number" || isTokenReference(explicit) || explicit === "hug") return resolveLength(explicit, 0, preferred) ?? preferred;
      return preferred;
    });
    const content = row === (axis === "width")
      ? childValues.reduce((sum, value) => sum + value, 0) + Math.max(0, node.children.length - 1) * gap
      : Math.max(0, ...childValues);
    return content + (axis === "width" ? horizontalPadding : verticalPadding);
  }
  if (node.nodeType === "grid") {
    const tracks = axis === "width" ? node.columns : node.rows;
    const gapValue = axis === "width" ? node.columnGap : node.rowGap;
    const gap = isTokenReference(gapValue) ? tokenValue(gapValue) : Number(gapValue || 0);
    const contentPreferences = gridTrackPreferences(node, axis, registry);
    const trackPreferred = tracks.map((track, index) => {
      const content = contentPreferences[index];
      if (typeof track === "number" || isTokenReference(track) || track === "hug") return resolveLength(track, 0, content) ?? content;
      return content;
    });
    return trackPreferred.reduce((sum, value) => sum + value, 0)
      + Math.max(0, tracks.length - 1) * gap
      + (axis === "width" ? horizontalPadding : verticalPadding);
  }
  if (node.nodeType === "overlay" || node.nodeType === "absolute") {
    const extent = Math.max(0, ...(node.children || []).map((child) => {
      if (child.frame) return (axis === "width" ? child.frame.x + child.frame.width : child.frame.y + child.frame.height);
      return preferredSize(child, axis, registry);
    }));
    return extent + (axis === "width" ? horizontalPadding : verticalPadding);
  }
  return 0;
}

function allocateTracks(specs, available, gapTotal, preferredValues = []) {
  const usable = Math.max(0, available - gapTotal);
  const fixed = specs.map((spec, index) => resolveLength(spec, usable, preferredValues[index] || 0));
  const fixedTotal = fixed.reduce((sum, value) => sum + (value ?? 0), 0);
  if (fixedTotal > usable + 0.01) throw new Error(`Fixed and content-sized tracks require ${fixedTotal}px; only ${usable}px is available`);
  const fractions = specs.map(fraction);
  const fractionTotal = fractions.reduce((sum, value) => sum + value, 0);
  const remainder = Math.max(0, usable - fixedTotal);
  return fixed.map((value, index) => value ?? (fractionTotal ? remainder * fractions[index] / fractionTotal : 0));
}

function placement(node, frame) {
  return { node, frame: Object.fromEntries(Object.entries(frame).map(([key, value]) => [key, px(value)])) };
}

export function resolveLayout(root, frame, registry) {
  const placements = [];
  const walk = (node, currentFrame) => {
    if (!node || !node.nodeType) throw new Error("Every composition node requires nodeType");
    if (node.nodeType === "component" || node.nodeType === "section") {
      placements.push(placement(node, currentFrame));
      return;
    }
    if (node.nodeType === "absolute") {
      for (const child of node.children) {
        if (!child.frame) throw new Error(`Absolute child ${child.id} requires a frame`);
        if (child.frame.x < 0 || child.frame.y < 0 || child.frame.width < 0 || child.frame.height < 0 || child.frame.x + child.frame.width > currentFrame.width || child.frame.y + child.frame.height > currentFrame.height) {
          throw new Error(`Absolute child ${child.id} exceeds its parent frame`);
        }
        walk(child, {
          x: currentFrame.x + child.frame.x,
          y: currentFrame.y + child.frame.y,
          width: child.frame.width,
          height: child.frame.height
        });
      }
      return;
    }
    const inner = insetFrame(currentFrame, node.padding);
    if (node.nodeType === "overlay") {
      for (const child of node.children) {
        if (child.frame && (child.frame.x < 0 || child.frame.y < 0 || child.frame.width < 0 || child.frame.height < 0 || child.frame.x + child.frame.width > inner.width || child.frame.y + child.frame.height > inner.height)) {
          throw new Error(`Overlay child ${child.id} exceeds its parent frame`);
        }
        const childFrame = child.frame
          ? {
              x: inner.x + child.frame.x,
              y: inner.y + child.frame.y,
              width: child.frame.width,
              height: child.frame.height
            }
          : inner;
        walk(child, childFrame);
      }
      return;
    }
    if (node.nodeType === "flow") {
      const row = node.direction === "row";
      if (!row && node.direction !== "column") throw new Error(`Unsupported flow direction: ${node.direction}`);
      const gap = isTokenReference(node.gap) ? tokenValue(node.gap) : Number(node.gap || 0);
      const mainAvailable = row ? inner.width : inner.height;
      const specs = node.children.map((child) => row ? child.size?.width : child.size?.height);
      const preferred = node.children.map((child) => preferredSize(child, row ? "width" : "height", registry));
      const lengths = allocateTracks(specs, mainAvailable, Math.max(0, node.children.length - 1) * gap, preferred);
      let cursor = row ? inner.x : inner.y;
      node.children.forEach((child, index) => {
        const crossSpec = row ? child.size?.height : child.size?.width;
        const crossAvailable = row ? inner.height : inner.width;
        const cross = resolveLength(crossSpec, crossAvailable, preferredSize(child, row ? "height" : "width", registry)) ?? crossAvailable;
        if (cross < 0 || cross > crossAvailable + 0.01) throw new Error(`Flow child ${child.id} exceeds its cross axis`);
        const childFrame = row
          ? { x: cursor, y: inner.y, width: lengths[index], height: cross }
          : { x: inner.x, y: cursor, width: cross, height: lengths[index] };
        walk(child, childFrame);
        cursor += lengths[index] + gap;
      });
      return;
    }
    if (node.nodeType === "grid") {
      const columnGap = isTokenReference(node.columnGap) ? tokenValue(node.columnGap) : Number(node.columnGap || 0);
      const rowGap = isTokenReference(node.rowGap) ? tokenValue(node.rowGap) : Number(node.rowGap || 0);
      const widths = allocateTracks(node.columns, inner.width, Math.max(0, node.columns.length - 1) * columnGap, gridTrackPreferences(node, "width", registry));
      const heights = allocateTracks(node.rows, inner.height, Math.max(0, node.rows.length - 1) * rowGap, gridTrackPreferences(node, "height", registry));
      const starts = (values, start, gap) => values.map((_, index) => start + values.slice(0, index).reduce((sum, value) => sum + value, 0) + index * gap);
      const xs = starts(widths, inner.x, columnGap);
      const ys = starts(heights, inner.y, rowGap);
      for (const child of node.children) {
        const cell = child.cell || {};
        const column = cell.column || 0;
        const row = cell.row || 0;
        const columnSpan = cell.columnSpan || 1;
        const rowSpan = cell.rowSpan || 1;
        if (!widths[column] || !heights[row] || columnSpan < 1 || rowSpan < 1 || column + columnSpan > widths.length || row + rowSpan > heights.length) throw new Error(`Grid child ${child.id} has an invalid cell`);
        const width = widths.slice(column, column + columnSpan).reduce((sum, value) => sum + value, 0) + Math.max(0, columnSpan - 1) * columnGap;
        const height = heights.slice(row, row + rowSpan).reduce((sum, value) => sum + value, 0) + Math.max(0, rowSpan - 1) * rowGap;
        walk(child, { x: xs[column], y: ys[row], width, height });
      }
      return;
    }
    throw new Error(`Unsupported composition node type: ${node.nodeType}`);
  };
  walk(root, frame);
  return placements;
}

export function assertNoLegacyPageTaxonomy(value, path = "root") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoLegacyPageTaxonomy(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase().includes("archetype")) throw new Error(`${path}.${key} uses deleted fixed-page taxonomy`);
    assertNoLegacyPageTaxonomy(child, `${path}.${key}`);
  }
}

export function assertUniqueIds(nodes) {
  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.id)) throw new Error(`Duplicate scene node id: ${node.id}`);
    seen.add(node.id);
  }
}

export function assertStyleProvenance(nodes) {
  const visualKeys = new Set(["fill", "stroke", "color", "fontFamily", "fontSize", "lineWidth", "radius"]);
  for (const node of nodes) {
    for (const [key, value] of Object.entries(node.style || {})) {
      if (!visualKeys.has(key) || value === null || value === "none") continue;
      if (!value || typeof value !== "object" || !value.tokenId || value.value === undefined) {
        throw new Error(`${node.id}.${key} lacks design-token provenance`);
      }
    }
  }
}

export function assertDeclaredComponentTokens(definition, nodes, instanceId) {
  const declared = new Set(definition.tokens || []);
  for (const node of nodes) {
    for (const tokenId of node.tokens || []) {
      if (!declared.has(tokenId)) throw new Error(`${instanceId} uses undeclared token ${tokenId} in ${node.id}`);
    }
  }
}

export function assertSceneBounds(nodes, bounds = SLIDE) {
  for (const node of nodes) {
    const values = [node.frame.x, node.frame.y, node.frame.width, node.frame.height];
    if (values.some((value) => !Number.isFinite(value))) throw new Error(`${node.id} has a non-finite frame`);
    if (node.frame.width < 0 || node.frame.height < 0) throw new Error(`${node.id} has a negative frame dimension`);
    if (node.frame.x < -0.01 || node.frame.y < -0.01 || node.frame.x + node.frame.width > bounds.width + 0.01 || node.frame.y + node.frame.height > bounds.height + 0.01) {
      throw new Error(`${node.id} exceeds the ${bounds.width} by ${bounds.height} slide`);
    }
  }
}

export function buildManifest(deck) {
  const manifest = {
    schema: MANIFEST_SCHEMA,
    designSystemVersion: DESIGN_SYSTEM_VERSION,
    sceneSchema: SCENE_SCHEMA,
    slideSize: SLIDE,
    palette: deck.palette,
    typography: deck.typography,
    pageTemplate: deck.pageTemplate,
    templateSequences: deck.templateSequences || [],
    tokens: deck.tokens || TOKENS,
    slides: deck.slides.map((slide, index) => ({
      id: slide.id,
      number: index + 1,
      density: slide.density,
      template: slide.template,
      componentInstances: slide.componentInstances,
      pageTemplate: slide.pageTemplate,
      contentFrame: slide.contentFrame,
      nodes: slide.nodes.map((node) => ({
        id: node.id,
        role: node.role,
        type: node.type,
        frame: node.frame,
        tokens: node.tokens,
        text: node.text,
        data: node.data,
        style: node.style
      }))
    }))
  };
  manifest.designHash = hashJson(manifest);
  return manifest;
}

export function compileDeck(deckSpec, registry) {
  assertNoLegacyPageTaxonomy(deckSpec);
  const { tokens: designTokens, ...palette } = resolvePalette(deckSpec.palette, TOKENS, THEME_SLOT_TOKENS);
  const typography = resolveTypography(deckSpec.typography, designTokens);
  const pageTemplate = registry.get("page-template")?.resolveTemplate(deckSpec.pageTemplate);
  return withDesignTokens(designTokens, () => {
  const slides = deckSpec.slides.map((slideSpec, slideIndex) => {
    const slideId = slideSpec.id || `slide-${slideIndex + 1}`;
    const density = slideSpec.density ?? "executive";
    const slideTokens = resolveDensityTokens(designTokens, density);
    return withDesignTokens(slideTokens, () => {
    if (slideSpec.palette !== undefined) throw new Error("Palette belongs to the deck, not individual slides");
    if (slideSpec.typography !== undefined) throw new Error("Typography belongs to the deck, not individual slides");
    const nodes = [];
    const componentInstances = [];
    const templatePlacements = [];
    let contentFrame = CONTENT_FRAME;
    let resolvedPageTemplate;
    if (slideSpec.chrome) {
      const chromeDefinition = registry.get("slide-chrome");
      if (!chromeDefinition) throw new Error("The component registry must define slide-chrome");
      const chromeId = stableId(slideId, "chrome");
      const chromeProps = { ...slideSpec.chrome, pageTemplate: { ...pageTemplate, ...slideSpec.chrome.pageTemplate }, pageNumber: slideSpec.chrome.pageNumber ?? slideIndex + 1 };
      const rendered = chromeDefinition.render({
        id: chromeId,
        tokens: slideTokens,
        frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
        props: chromeProps
      });
      contentFrame = rendered.contentFrame;
      resolvedPageTemplate = rendered.pageTemplate;
      templatePlacements.push(...(rendered.placements || []).map(placement => ({ ...placement, ancestors: [chromeId] })));
      assertDeclaredComponentTokens(chromeDefinition, rendered.nodes, chromeId);
      rendered.nodes.forEach((item) => { item.data.componentInstance = chromeId; });
      nodes.push(...rendered.nodes);
      componentInstances.push({
        id: "chrome",
        instanceId: chromeId,
        component: "slide-chrome",
        version: chromeDefinition.version,
        category: chromeDefinition.category,
        role: chromeDefinition.role,
        variant: chromeDefinition.resolveVariant?.(slideSpec.chrome),
        frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
        tokens: chromeDefinition.tokens
      });
    }
    const placements = [...templatePlacements, ...resolveLayout(slideSpec.composition, slideSpec.frame || contentFrame, registry)];
    const placementProps = (node) => {
      if (node.nodeType !== "section") return node.props || {};
      assertSectionHeadingProps(node);
      return { treatment: node.treatment, edge: node.edge, heading: node.heading, padding: node.padding };
    };
    const headerBandHeight = (placement) => {
      const measure = ({ node, frame }) => registry.get(node.nodeType === "section" ? "section" : node.component)?.measureHeader?.({ frame, props: placementProps(node) });
      const own = measure(placement);
      if (!own) return undefined;
      // Ruled peers sharing a top guide share a bottom-aligned text band. Longer
      // headings increase the band; neither adapter may shrink or invent wraps.
      const peers = own.ruled ? placements.map(measure).filter((peer) => peer?.ruled && Math.abs(peer.top - own.top) < 0.01) : [own];
      return Math.max(own.height, ...peers.map((peer) => peer.height));
    };
    for (const { node, frame, ancestors = [] } of placements) {
      if (node.nodeType === "section") {
        const sectionDefinition = registry.get("section");
        if (!sectionDefinition) throw new Error("The component registry must define section");
        const instanceId = stableId(slideId, node.id);
        const rendered = sectionDefinition.render({
          id: instanceId,
          tokens: slideTokens,
          frame,
          props: { ...placementProps(node), headerBandHeight: headerBandHeight({ node, frame }) }
        });
        assertDeclaredComponentTokens(sectionDefinition, rendered.nodes, node.id);
        rendered.nodes.forEach((item) => {
          item.data.componentInstance = instanceId;
          item.data.componentAncestors = [...ancestors];
        });
        nodes.push(...rendered.nodes);
        componentInstances.push({
          id: node.id,
          instanceId,
          component: "section",
          version: sectionDefinition.version,
          variant: sectionDefinition.resolveVariant?.(placementProps(node)),
          role: "section",
          frame,
          tokens: sectionDefinition.tokens
        });
        if (node.composition || node.children.length) {
          const nestedRoot = node.composition || flow({
            id: `${node.id}-content`,
            direction: "column",
            gap: token("space.3"),
            children: node.children
          });
          const nestedPlacements = resolveLayout(nestedRoot, rendered.contentFrame, registry);
          placements.push(...nestedPlacements.map(placement => ({ ...placement, ancestors: [...ancestors, instanceId] })));
        }
        continue;
      }
      const definition = registry.get(node.component);
      if (!definition) throw new Error(`Unknown component: ${node.component}`);
      const instanceId = stableId(slideId, node.id || node.component);
      const props = { ...node.props, headerBandHeight: headerBandHeight({ node, frame }) };
      if (["page-template", "slide-chrome", "section-divider"].includes(node.component)) props.pageTemplate = { ...pageTemplate, ...node.props?.pageTemplate };
      const rendered = definition.render({ id: instanceId, frame, tokens: slideTokens, props });
      placements.push(...(rendered.placements || []).map(placement => ({ ...placement, ancestors: [...ancestors, instanceId] })));
      assertDeclaredComponentTokens(definition, rendered.nodes, instanceId);
      rendered.nodes.forEach((item) => {
        item.data.componentInstance = instanceId;
        item.data.componentAncestors = [...ancestors];
      });
      nodes.push(...rendered.nodes);
      componentInstances.push({
        id: node.id || instanceId,
        instanceId,
        component: definition.id,
        version: definition.version,
        category: definition.category,
        role: node.role || definition.role,
        variant: definition.resolveVariant?.(props),
        frame,
        tokens: definition.tokens
      });
    }
    assertUniqueIds(nodes);
    for (const node of nodes) {
      node.style = Object.fromEntries(Object.entries(node.style).map(([key, value]) => [key,
        isTokenReference(value) ? { tokenId: value.tokenId, ...slideTokens[value.tokenId] } : value]));
    }
    assertStyleProvenance(nodes);
    assertSceneBounds(nodes);
    return { id: slideId, notes: slideSpec.notes || "", nodes, componentInstances, tokens: slideTokens, density, ...(slideSpec.template ? { template: structuredClone(slideSpec.template) } : {}), palette: palette.id, pageTemplate: resolvedPageTemplate, contentFrame: slideSpec.frame || contentFrame };
    });
  });
  const templateSequences = [];
  const closed = new Set();
  let active = null;
  for (const [position, slide] of slides.entries()) {
    const reference = slide.template;
    if (!reference) {
      if (active) { closed.add(active.id); active = null; }
      continue;
    }
    if (!reference || typeof reference.id !== "string" || !reference.id.trim() || !Number.isInteger(reference.index) || !Number.isInteger(reference.total) || reference.index < 1 || reference.total < 2 || reference.index > reference.total) throw new Error(`Slide ${slide.id} has invalid template sequence metadata`);
    if (!active || active.id !== reference.id) {
      if (active) closed.add(active.id);
      if (closed.has(reference.id)) throw new Error(`Template sequence ${reference.id} must remain contiguous`);
      active = { id: reference.id, total: reference.total, slides: [], positions: [], signature: null };
      templateSequences.push(active);
    }
    if (reference.total !== active.total || reference.index !== active.slides.length + 1) throw new Error(`Template sequence ${reference.id} has inconsistent index or total`);
    const structure = {
      density: slide.density,
      contentFrame: slide.contentFrame,
      pageTemplate: slide.pageTemplate,
      // A sequence signature describes reusable structure. Instance IDs are
      // intentionally slide-scoped provenance, so including them would make
      // two structurally identical sequence slides compare as different.
      components: slide.componentInstances.map(instance => ({ id: instance.id, component: instance.component, variant: instance.variant ?? null, role: instance.role, frame: instance.frame }))
    };
    const signature = hashJson(structure);
    if (active.signature && active.signature !== signature) throw new Error(`Template sequence ${reference.id} changed layout, component frames or variants on slide ${slide.id}`);
    active.signature = signature;
    active.slides.push(slide.id);
    active.positions.push(position + 1);
    slide.template = { ...reference, structuralHash: signature };
  }
  for (const sequence of templateSequences) {
    if (sequence.slides.length !== sequence.total) throw new Error(`Template sequence ${sequence.id} declares ${sequence.total} slides but contains ${sequence.slides.length}`);
  }
  const deck = { schema: SCENE_SCHEMA, id: deckSpec.id || "deck", slides, palette, typography, pageTemplate, tokens: designTokens, templateSequences };
  deck.manifest = buildManifest(deck);
  return deck;
  });
}
