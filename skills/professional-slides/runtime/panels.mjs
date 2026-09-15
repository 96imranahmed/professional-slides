// Panel families the reference galleries use on one page in eight: pillar
// cards (icon, title, text, sub-points), 2x2 quadrants (SWOT and the like), a
// KPI tile. Each shares the deck's heading band, marker vocabulary and body
// type; the row rule (every panel in a row shares one header height) holds
// inside a cards row because the cards are laid out here, together.
import { token, tokenValue, stableId, textPrimitive, rectPrimitive, linePrimitive } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { MARK_TOKENS, markerSize, numberMarker, iconMarker } from "./marks.mjs";

const PRIMARY = token("color.componentPrimary"), INK = token("color.ink"), WHITE = token("color.onPrimary"), SECONDARY = token("color.textSecondary");
const SURFACE = token("color.surface"), MUTED = token("color.surfaceMuted"), RULE = token("color.rule"), TINT = token("color.componentPrimaryTint");
const FONT = token("font.body"), DISPLAY = token("font.display");
const v = (id) => tokenValue(token(id));

export const PANEL_TOKENS = Object.freeze([...new Set([...MARK_TOKENS, "color.componentPrimaryTint", "color.textSecondary", "color.surfaceMuted", "color.rule", "color.positive", "color.negative", "font.display", "type.heading", "type.body", "type.compact", "type.label", "type.metric", "type.deckTitle", "space.1", "space.2", "space.3", "space.4", "space.5", "line.hairline", "line.standard", "radius.none", "radius.small", "radius.round"])]);

const text = (size, color = INK, bold = false, align = "left") => ({ fontFamily: FONT, fontSize: token(size), color, bold, align, valign: "top", wrap: false });
const measure = (value, width, size, bold = false) => measureText(String(value), width, { fontFamily: tokenValue(FONT), fontSize: v(size), bold, wrapWidthRatio: 1 });
const rect = (id, role, frame, fill, stroke = "none", radius = "radius.none") => rectPrimitive({ id, role, frame, style: { fill, stroke, lineWidth: token("line.hairline"), radius: token(radius) } });
const label = (id, role, frame, layout, style) => textPrimitive({ id, role, frame: { ...frame, height: layout.height }, text: layout.text, style: { ...style, lineHeight: layout.lineHeight }, data: { textLayout: layout } });

/* ------------------------------------------------------------------ cards */

function normalizeCards(props) {
  if (!Array.isArray(props.items) || props.items.length < 2 || props.items.length > 6) throw new Error("Cards take two to six items");
  return props.items.map((item, index) => {
    if (!item || typeof item.title !== "string" || !item.title.trim()) throw new Error(`Card ${index + 1} requires a title`);
    const points = Array.isArray(item.points) ? item.points.map((p) => (typeof p === "string" ? p : p?.text)).filter((p) => typeof p === "string" && p.trim()) : [];
    return { title: item.title.trim(), text: typeof item.text === "string" && item.text.trim() ? item.text.trim() : null, points, icon: item.icon ?? null, number: item.number ?? index + 1, footer: typeof item.footer === "string" && item.footer.trim() ? item.footer.trim() : null };
  });
}

/**
 * tone: "outline" (hairline card, icon ring, bold title), "header" (filled
 * primary header band carrying the title), "numbered" (numbered disc before
 * the title), "plain" (no card edge; a column of icon + title + text).
 */
export function cardsLayout(frame, props) {
  const items = normalizeCards(props);
  const tone = props.tone ?? (items.some((i) => i.icon) ? "outline" : "numbered");
  // Icon cards with a line of text each read centred (the "three principles" page).
  const centred = props.align === "center" || (props.align === undefined && (tone === "outline" || tone === "plain") && items.every((i) => i.icon && !i.points.length));
  if (!["outline", "header", "numbered", "plain"].includes(tone)) throw new Error(`Unknown cards tone: ${tone}`);
  const gap = v("space.4"), pad = tone === "plain" ? 0 : v("space.4");
  const width = (frame.width - gap * (items.length - 1)) / items.length;
  const inner = width - 2 * pad;
  if (inner < 80) throw new Error("Cards are too narrow for their padding; use fewer cards");
  const iconSize = Math.round(markerSize() * (centred ? 2.5 : 1.75)), disc = markerSize();
  const headGap = v("space.2"), bodyGap = v("space.3");
  const measured = items.map((item) => {
    const titleWidth = tone === "numbered" ? inner - disc - v("space.3") : inner;
    const title = measure(item.title, titleWidth, "type.heading", true);
    const body = item.text ? measure(item.text, inner, "type.body") : null;
    const points = item.points.map((p) => measure(p, inner - v("space.4"), "type.body"));
    const footer = item.footer ? measure(item.footer, inner, "type.compact", true) : null;
    // Header zone: icon (outline/plain) or filled band (header) or disc+title (numbered).
    const iconBlock = (tone === "outline" || tone === "plain") && item.icon ? iconSize + headGap : 0;
    const bandHeight = tone === "header" ? title.height + 2 * v("space.2") : 0;
    const titleHeight = tone === "header" ? 0 : title.height;
    const bodyHeight = (body ? bodyGap + body.height : 0) + points.reduce((sum, p) => sum + v("space.1") + p.height, points.length ? bodyGap - v("space.1") : 0);
    const footerHeight = footer ? bodyGap + footer.height : 0;
    return { item, title, body, points, footer, iconBlock, bandHeight, titleHeight, bodyHeight, footerHeight, height: pad + iconBlock + bandHeight + titleHeight + bodyHeight + footerHeight + pad };
  });
  const headerHeight = Math.max(...measured.map((m) => m.iconBlock + m.bandHeight + m.titleHeight));
  return { items: measured, tone, centred, gap, pad, width, inner, iconSize, disc, headGap, bodyGap, headerHeight, height: Math.max(...measured.map((m) => m.height - (m.iconBlock + m.bandHeight + m.titleHeight) + headerHeight)) };
}

export function cardsNodes({ id, frame, props }) {
  const L = cardsLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`Cards need ${Math.ceil(L.height)}px but have ${frame.height}px; shorten the card copy or use fewer cards`);
  const nodes = [];
  const fill = frame.height >= L.height; // cards fill the frame height so a row reads as one band
  const cardHeight = fill ? frame.height : L.height;
  L.items.forEach((m, index) => {
    const x = frame.x + index * (L.width + L.gap), cid = stableId(id, "card", index);
    if (L.tone !== "plain") nodes.push(rect(stableId(cid, "surface"), "card-surface", { x, y: frame.y, width: L.width, height: cardHeight }, SURFACE, RULE, "radius.small"));
    let y = frame.y + L.pad;
    const cx = x + L.pad;
    if (L.tone === "header") {
      nodes.push(rect(stableId(cid, "band"), "card-band", { x, y: frame.y, width: L.width, height: m.bandHeight }, PRIMARY));
      nodes.push(label(stableId(cid, "title"), "card-title", { x: cx, y: frame.y + v("space.2"), width: L.inner }, m.title, text("type.heading", WHITE, true)));
      y = frame.y + m.bandHeight + L.pad;
    } else if (L.tone === "numbered") {
      nodes.push(...numberMarker({ id: stableId(cid, "number"), role: "card-marker", x: cx, y: y + (m.title.lineHeight - L.disc) / 2, size: L.disc, number: m.item.number }));
      nodes.push(label(stableId(cid, "title"), "card-title", { x: cx + L.disc + v("space.3"), y, width: L.inner - L.disc - v("space.3") }, m.title, text("type.heading", INK, true)));
      y += m.title.height;
    } else {
      if (m.item.icon) { nodes.push(...iconMarker({ id: stableId(cid, "icon"), role: "card-icon", x: L.centred ? cx + (L.inner - L.iconSize) / 2 : cx, y, size: L.iconSize, icon: m.item.icon, tone: "outline" })); }
      y += m.iconBlock;
      nodes.push(label(stableId(cid, "title"), "card-title", { x: cx, y, width: L.inner }, m.title, text("type.heading", INK, true, L.centred ? "center" : "left")));
      y += m.title.height;
    }
    // Content starts level across the row (row rule), below the tallest header.
    y = L.tone === "header" ? frame.y + L.headerHeight + L.pad : frame.y + L.pad + L.headerHeight;
    if (m.body) { y += L.bodyGap; nodes.push(label(stableId(cid, "text"), "card-text", { x: cx, y, width: L.inner }, m.body, text("type.body", INK, false, L.centred ? "center" : "left"))); y += m.body.height; }
    m.points.forEach((p, k) => {
      y += k ? v("space.1") : L.bodyGap;
      nodes.push(rect(stableId(cid, "bullet", k), "card-bullet", { x: cx, y: y + (p.lineHeight - v("space.1")) / 2, width: v("space.1"), height: v("space.1") }, INK));
      nodes.push(label(stableId(cid, "point", k), "card-point", { x: cx + v("space.4"), y, width: L.inner - v("space.4") }, p, text("type.body")));
      y += p.height;
    });
    if (m.footer) {
      const fy = frame.y + cardHeight - L.pad - m.footer.height;
      nodes.push(linePrimitive({ id: stableId(cid, "footer-rule"), role: "card-rule", x1: cx, y1: fy - v("space.2"), x2: cx + L.inner, y2: fy - v("space.2"), style: { stroke: RULE, lineWidth: token("line.hairline") } }));
      nodes.push(label(stableId(cid, "footer"), "card-footer", { x: cx, y: fy, width: L.inner }, m.footer, text("type.compact", PRIMARY, true)));
    }
  });
  return nodes;
}

/* -------------------------------------------------------------- quadrants */

export function quadrantsLayout(frame, props) {
  const quads = props.quadrants;
  if (!Array.isArray(quads) || quads.length !== 4) throw new Error("Quadrants take exactly four cells (top-left, top-right, bottom-left, bottom-right)");
  const gap = v("space.3"), pad = v("space.3");
  const width = (frame.width - gap) / 2, height = (frame.height - gap) / 2, inner = width - 2 * pad;
  const cells = quads.map((q, i) => {
    if (!q || typeof q.title !== "string" || !q.title.trim()) throw new Error(`Quadrant ${i + 1} requires a title`);
    const title = measure(q.title, inner, "type.heading", true);
    const points = (Array.isArray(q.points) ? q.points : q.text ? [q.text] : []).map((p) => measure(typeof p === "string" ? p : p.text, inner - v("space.4"), "type.body"));
    const band = title.height + 2 * v("space.2");
    const body = points.reduce((sum, p) => sum + p.height, 0) + Math.max(0, points.length - 1) * v("space.1");
    return { title, points, band, needed: band + pad + body + pad };
  });
  if (cells.some((c) => c.needed > height + 0.01)) throw new Error("Quadrant copy exceeds its cell; shorten the points");
  return { cells, gap, pad, width, height, inner };
}

export function quadrantsNodes({ id, frame, props }) {
  const L = quadrantsLayout(frame, props);
  const nodes = [];
  const dark = props.tone === "dark";
  L.cells.forEach((cell, i) => {
    const x = frame.x + (i % 2) * (L.width + L.gap), y0 = frame.y + Math.floor(i / 2) * (L.height + L.gap), qid = stableId(id, "quadrant", i);
    nodes.push(rect(stableId(qid, "surface"), "quadrant-surface", { x, y: y0, width: L.width, height: L.height }, MUTED));
    nodes.push(rect(stableId(qid, "band"), "quadrant-band", { x, y: y0, width: L.width, height: cell.band }, dark || i % 3 === 0 ? PRIMARY : TINT));
    nodes.push(label(stableId(qid, "title"), "quadrant-title", { x: x + L.pad, y: y0 + v("space.2"), width: L.inner }, cell.title, text("type.heading", dark || i % 3 === 0 ? WHITE : INK, true)));
    let y = y0 + cell.band + L.pad;
    cell.points.forEach((p, k) => {
      nodes.push(rect(stableId(qid, "bullet", k), "quadrant-bullet", { x: x + L.pad, y: y + (p.lineHeight - v("space.1")) / 2, width: v("space.1"), height: v("space.1") }, INK));
      nodes.push(label(stableId(qid, "point", k), "quadrant-point", { x: x + L.pad + v("space.4"), y, width: L.inner - v("space.4") }, p, text("type.body")));
      y += p.height + v("space.1");
    });
  });
  return nodes;
}

/* ------------------------------------------------------------------- metric */

/** KPI tile: big number, label, optional sublabel and signed delta; light or dark tone. */
export function metricNodes({ id, frame, props }) {
  if (props.value === undefined || props.value === null || String(props.value).trim() === "") throw new Error("Metric requires a value");
  const dark = props.tone === "dark";
  const pad = v("space.3");
  const width = frame.width - 2 * pad;
  const valueSize = props.variant === "prominent" ? "type.deckTitle" : "type.metric";
  const value = measureText(String(props.value), width, { fontFamily: tokenValue(DISPLAY), fontSize: v(valueSize), bold: true, wrapWidthRatio: 1 });
  const labelLayout = props.label ? measure(props.label, width, "type.compact") : null;
  const sub = props.sublabel ? measure(props.sublabel, width, "type.label") : null;
  const delta = props.delta ? measure(props.delta, width, "type.label", true) : null;
  const gap = v("space.1");
  const total = value.height + (labelLayout ? gap + labelLayout.height : 0) + (sub ? gap + sub.height : 0) + (delta ? gap + delta.height : 0);
  if (total > frame.height + 0.01) throw new Error("Metric tile is too short for its value, label and delta");
  const nodes = [];
  if (dark) nodes.push(rect(stableId(id, "surface"), "metric-surface", frame, PRIMARY, "none", "radius.small"));
  else if (props.tone === "tint") nodes.push(rect(stableId(id, "surface"), "metric-surface", frame, TINT, "none", "radius.small"));
  const ink = dark ? WHITE : PRIMARY, grey = dark ? WHITE : SECONDARY;
  const align = props.align ?? "center";
  let y = frame.y + (frame.height - total) / 2;
  nodes.push(textPrimitive({ id: stableId(id, "value"), role: "metric-value", frame: { x: frame.x + pad, y, width, height: value.height }, text: value.text, style: { fontFamily: DISPLAY, fontSize: token(valueSize), color: ink, bold: true, align, valign: "top", wrap: false, lineHeight: value.lineHeight }, data: { textLayout: value } }));
  y += value.height;
  if (labelLayout) { y += gap; nodes.push(label(stableId(id, "label"), "metric-label", { x: frame.x + pad, y, width }, labelLayout, text("type.compact", grey, false, align))); y += labelLayout.height; }
  if (sub) { y += gap; nodes.push(label(stableId(id, "sublabel"), "metric-sublabel", { x: frame.x + pad, y, width }, sub, text("type.label", grey, false, align))); y += sub.height; }
  if (delta) {
    y += gap;
    const negative = /^\s*[-−▼↓]/.test(String(props.delta));
    const positive = /^\s*[+▲↑]/.test(String(props.delta));
    const color = dark ? WHITE : negative ? token("color.negative") : positive ? token("color.positive") : PRIMARY;
    nodes.push(label(stableId(id, "delta"), "metric-delta", { x: frame.x + pad, y, width }, delta, text("type.label", color, true, align)));
  }
  return nodes;
}

export function registerPanels(registry) {
  registry.set("cards", {
    id: "cards", version: "1.0.0", category: "section", role: "cards", tokens: [...PANEL_TOKENS], preferredSize: { width: 1160, height: 300 },
    sample: { items: [{ icon: "target", title: "(Insert pillar 1)", text: "(Insert one-line description)" }, { icon: "rocket", title: "(Insert pillar 2)", text: "(Insert one-line description)" }, { icon: "people", title: "(Insert pillar 3)", text: "(Insert one-line description)" }] },
    variants: { outline: {}, header: { props: { tone: "header" } }, numbered: { props: { tone: "numbered" } }, plain: { props: { tone: "plain" } } }, defaultVariant: "outline", variantProp: "tone",
    resolveVariant: (props = {}) => props.tone ?? (Array.isArray(props.items) && props.items.some((i) => i?.icon) ? "outline" : "numbered"),
    render: (input) => ({ nodes: cardsNodes(input) }),
    measureContent: ({ frame, props }) => cardsLayout(frame, props),
    guidance: { useWhen: "three to five parallel pillars, principles, options or initiatives each with a title and a line of description", why: "equal cards make parallel things read as parallel; the row rule keeps their bodies level", actionTitle: "state what the set of pillars achieves together" }
  });
  registry.set("quadrants", {
    id: "quadrants", version: "1.0.0", category: "section", role: "quadrants", tokens: [...PANEL_TOKENS], preferredSize: { width: 1160, height: 440 },
    sample: { quadrants: [{ title: "Strengths", points: ["(Insert strength)"] }, { title: "Weaknesses", points: ["(Insert weakness)"] }, { title: "Opportunities", points: ["(Insert opportunity)"] }, { title: "Threats", points: ["(Insert threat)"] }] },
    render: (input) => ({ nodes: quadrantsNodes(input) }),
    measureContent: ({ frame, props }) => { const L = quadrantsLayout({ ...frame, height: Number.MAX_SAFE_INTEGER / 4 }, props); return { ...L, height: 2 * Math.max(...L.cells.map((c) => c.needed)) + L.gap }; },
    guidance: { useWhen: "four labelled groups of points in a 2x2 (SWOT, risks by likelihood and impact, options by two criteria)", why: "the grid itself carries the framework; the reader compares diagonals", actionTitle: "state the diagonal that matters" }
  });
  const metric = registry.get("metric");
  if (metric) {
    metric.tokens = [...new Set([...metric.tokens, ...PANEL_TOKENS])];
    metric.render = (input) => ({ nodes: metricNodes(input) });
    metric.variants = { default: {}, prominent: { props: { variant: "prominent" } }, dark: { props: { tone: "dark" } } };
    metric.resolveVariant = (props = {}) => props.tone === "dark" ? "dark" : props.variant ?? "default";
  }
  return registry;
}
