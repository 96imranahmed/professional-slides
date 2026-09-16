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
const ACCENT_OR_PRIMARY = () => token("color.accent");

export const PANEL_TOKENS = Object.freeze([...new Set([...MARK_TOKENS, "color.accent", "color.componentPrimaryTint", "color.textSecondary", "color.surfaceMuted", "color.rule", "color.positive", "color.negative", "font.display", "type.heading", "type.body", "type.compact", "type.label", "type.metric", "type.deckTitle", "space.1", "space.2", "space.3", "space.4", "space.5", "line.hairline", "line.standard", "radius.none", "radius.small", "radius.round"])]);

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
    return { title: item.title.trim(), text: typeof item.text === "string" && item.text.trim() ? item.text.trim() : null, points, icon: item.icon ?? null, number: item.number ?? index + 1, footer: typeof item.footer === "string" && item.footer.trim() ? item.footer.trim() : null, value: item.value !== undefined && item.value !== null && String(item.value).trim() ? String(item.value).trim() : null };
  });
}

/**
 * tone: "outline" (hairline card, icon ring, bold title), "header" (filled
 * primary header band carrying the title), "numbered" (numbered disc before
 * the title), "plain" (no card edge; a column of icon + title + text).
 */
export const CARD_TONES = Object.freeze(["outline", "header", "numbered", "plain", "disc", "big-number", "dark", "columns"]);
export function cardsLayout(frame, props) {
  const items = normalizeCards(props);
  const tone = props.tone ?? (items.some((i) => i.icon) ? "outline" : "numbered");
  if (!CARD_TONES.includes(tone)) throw new Error(`Unknown cards tone: ${tone}; use one of ${CARD_TONES.join(", ")}`);
  // Icon cards with a line of text each read centred (the "three principles" page).
  const centred = props.align === "center" || (props.align === undefined && ((tone === "outline" || tone === "plain") && items.every((i) => i.icon && !i.points.length) || tone === "disc" || tone === "dark"));
  const open = ["plain", "disc", "big-number", "columns"].includes(tone);
  const gap = tone === "big-number" ? v("space.5") + v("space.4") : v("space.4"), pad = open ? 0 : v("space.4");
  const width = (frame.width - gap * (items.length - 1)) / items.length;
  const inner = width - 2 * pad - (tone === "columns" ? v("space.4") : 0);
  if (inner < 80) throw new Error("Cards are too narrow for their padding; use fewer cards");
  const iconSize = Math.round(markerSize() * (tone === "disc" ? 3.5 : centred ? 2.5 : 1.75)), disc = markerSize();
  const headGap = v("space.2"), bodyGap = v("space.3");
  const measured = items.map((item) => {
    const titleWidth = tone === "numbered" ? inner - disc - v("space.3") : inner;
    const title = measure(item.title, titleWidth, "type.heading", true);
    const bodyWidth = tone === "big-number" ? inner - 2 * v("space.3") : inner;
    const body = item.text ? measure(item.text, bodyWidth, "type.body") : null;
    const points = item.points.map((p) => measure(p, bodyWidth - v("space.4"), "type.body"));
    const footer = item.footer ? measure(item.footer, inner, "type.compact", true) : null;
    const value = item.value ? measure(item.value, inner, "type.metric", true) : null;
    const number = tone === "big-number" ? measure(String(item.number).padStart(2, "0"), inner, "type.deckTitle", true) : null;
    // Header zone: icon (outline/plain/disc), filled band (header), disc + title
    // (numbered), big numeral + title (big-number), dark tile (dark) or a ruled
    // column heading (columns).
    const iconBlock = ["outline", "plain", "disc"].includes(tone) && item.icon ? iconSize + headGap : 0;
    const numberBlock = number ? number.height + headGap : 0;
    const bandHeight = tone === "header" ? title.height + 2 * v("space.2") : tone === "dark" ? Math.max(150, (item.icon ? iconSize + headGap : 0) + title.height + 2 * v("space.4")) : 0;
    const titleHeight = tone === "header" || tone === "dark" ? 0 : title.height + (tone === "columns" ? v("space.2") + v("space.1") : 0);
    const valueHeight = value ? bodyGap + value.height : 0;
    const bodyHeight = (tone === "big-number" ? v("space.3") : 0) + (body ? bodyGap + body.height : 0) + points.reduce((sum, p) => sum + v("space.1") + p.height, points.length ? bodyGap - v("space.1") : 0) + (tone === "big-number" ? v("space.3") : 0);
    const footerHeight = footer ? bodyGap + footer.height : 0;
    return { item, title, body, points, footer, value, number, iconBlock, numberBlock, bandHeight, titleHeight, valueHeight, bodyHeight, footerHeight, height: pad + iconBlock + numberBlock + bandHeight + titleHeight + valueHeight + bodyHeight + footerHeight + pad };
  });
  const headerHeight = Math.max(...measured.map((m) => m.iconBlock + m.numberBlock + m.bandHeight + m.titleHeight + m.valueHeight));
  return { items: measured, tone, centred, open, gap, pad, width, inner, iconSize, disc, headGap, bodyGap, headerHeight, height: Math.max(...measured.map((m) => m.height - (m.iconBlock + m.numberBlock + m.bandHeight + m.titleHeight + m.valueHeight) + headerHeight)) };
}

export function cardsNodes({ id, frame: frameIn, props }) {
  let frame = frameIn;
  const L = cardsLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`Cards need ${Math.ceil(L.height)}px but have ${frame.height}px; shorten the card copy or use fewer cards`);
  const nodes = [];
  const fill = frame.height >= L.height && props.valign !== "middle"; // cards fill the frame height so a row reads as one band
  const cardHeight = fill ? frame.height : L.height;
  // Icon rows (`valign: "middle"`) keep their natural height and sit centred in the frame.
  if (props.valign === "middle" && frame.height > L.height) frame = { ...frame, y: frame.y + (frame.height - L.height) / 2, height: L.height };
  L.items.forEach((m, index) => {
    const x = frame.x + index * (L.width + L.gap), cid = stableId(id, "card", index);
    if (!L.open && L.tone !== "dark") nodes.push(rect(stableId(cid, "surface"), "card-surface", { x, y: frame.y, width: L.width, height: cardHeight }, SURFACE, RULE, "radius.small"));
    let y = frame.y + L.pad;
    const cx = x + L.pad;
    const align = L.centred ? "center" : "left";
    if (L.tone === "header") {
      nodes.push(rect(stableId(cid, "band"), "card-band", { x, y: frame.y, width: L.width, height: m.bandHeight }, PRIMARY));
      nodes.push(label(stableId(cid, "title"), "card-title", { x: cx, y: frame.y + v("space.2"), width: L.inner }, m.title, text("type.heading", WHITE, true)));
      y = frame.y + m.bandHeight + L.pad;
    } else if (L.tone === "dark") {
      // A navy tile carries icon and title in white; the copy sits below it on the page.
      nodes.push(rect(stableId(cid, "band"), "card-band", { x, y: frame.y, width: L.width, height: m.bandHeight }, PRIMARY, "none", "radius.small"));
      const block = (m.item.icon ? L.iconSize + L.headGap : 0) + m.title.height;
      let ty = frame.y + (m.bandHeight - block) / 2;
      if (m.item.icon) { nodes.push(...iconMarker({ id: stableId(cid, "icon"), role: "card-icon", x: cx + (L.inner - L.iconSize) / 2, y: ty, size: L.iconSize, icon: m.item.icon, tone: "filled" })); ty += L.iconSize + L.headGap; }
      nodes.push(label(stableId(cid, "title"), "card-title", { x: cx, y: ty, width: L.inner }, m.title, text("type.heading", WHITE, true, "center")));
    } else if (L.tone === "big-number") {
      // "01 / 02 / 03": the numeral in display type, the title beside the next
      // card's arrow, and the copy on a muted band that runs to the frame's foot.
      nodes.push(label(stableId(cid, "number"), "card-number", { x: cx, y, width: L.inner }, m.number, text("type.deckTitle", ACCENT_OR_PRIMARY(), true)));
      y += m.numberBlock;
      nodes.push(label(stableId(cid, "title"), "card-title", { x: cx, y, width: L.inner }, m.title, text("type.heading", INK, true)));
      if (index < L.items.length - 1) nodes.push(...iconMarker({ id: stableId(cid, "arrow"), role: "card-arrow", x: x + L.width + (L.gap - L.disc) / 2, y: y + (m.title.lineHeight - L.disc) / 2, size: L.disc, icon: "arrow-right", tone: "plain", data: { muted: true } }));
      y += m.title.height;
    } else if (L.tone === "columns") {
      nodes.push(label(stableId(cid, "title"), "card-title", { x: cx, y, width: L.inner }, m.title, text("type.heading", INK, true)));
      const ry = y + m.title.height + v("space.2");
      nodes.push(linePrimitive({ id: stableId(cid, "title-rule"), role: "card-rule", x1: cx, y1: ry, x2: cx + L.inner, y2: ry, style: { stroke: INK, lineWidth: token("line.hairline") } }));
      if (index) nodes.push(linePrimitive({ id: stableId(cid, "divider"), role: "card-divider", x1: x - L.gap / 2, y1: frame.y, x2: x - L.gap / 2, y2: frame.y + cardHeight, style: { stroke: RULE, lineWidth: token("line.hairline") } }));
      y += m.titleHeight;
    } else if (L.tone === "numbered") {
      nodes.push(...numberMarker({ id: stableId(cid, "number"), role: "card-marker", x: cx, y: y + (m.title.lineHeight - L.disc) / 2, size: L.disc, number: m.item.number }));
      nodes.push(label(stableId(cid, "title"), "card-title", { x: cx + L.disc + v("space.3"), y, width: L.inner - L.disc - v("space.3") }, m.title, text("type.heading", INK, true)));
      y += m.title.height;
    } else {
      if (m.item.icon) { nodes.push(...iconMarker({ id: stableId(cid, "icon"), role: "card-icon", x: L.centred ? cx + (L.inner - L.iconSize) / 2 : cx, y, size: L.iconSize, icon: m.item.icon, tone: L.tone === "disc" ? "filled" : "outline" })); }
      y += m.iconBlock;
      nodes.push(label(stableId(cid, "title"), "card-title", { x: cx, y, width: L.inner }, m.title, text("type.heading", INK, true, align)));
      y += m.title.height;
    }
    if (m.value) {
      // A headline figure under the title (price, size, share) in the metric role.
      const vy = frame.y + L.pad + (L.tone === "header" || L.tone === "dark" ? m.bandHeight : m.iconBlock + m.numberBlock + m.titleHeight) + L.bodyGap;
      nodes.push(label(stableId(cid, "value"), "card-value", { x: cx, y: vy, width: L.inner }, m.value, text("type.metric", PRIMARY, true, align)));
    }
    // Content starts level across the row (row rule), below the tallest header.
    y = L.tone === "header" || L.tone === "dark" ? frame.y + L.headerHeight + L.pad : frame.y + L.pad + L.headerHeight;
    let tx = cx, tw = L.inner;
    if (L.tone === "big-number") {
      // The copy band: muted, from the content line to the card's foot.
      nodes.push(rect(stableId(cid, "band"), "card-band", { x, y: y + L.bodyGap, width: L.width, height: Math.max(0, cardHeight - (y + L.bodyGap - frame.y)) }, MUTED));
      tx = cx + v("space.3"); tw = L.inner - 2 * v("space.3"); y += v("space.3");
    }
    if (m.body) { y += L.bodyGap; nodes.push(label(stableId(cid, "text"), "card-text", { x: tx, y, width: tw }, m.body, text("type.body", INK, false, align))); y += m.body.height; }
    m.points.forEach((p, k) => {
      y += k ? v("space.1") : L.bodyGap;
      nodes.push(rect(stableId(cid, "bullet", k), "card-bullet", { x: tx, y: y + (p.lineHeight - v("space.1")) / 2, width: v("space.1"), height: v("space.1") }, INK));
      nodes.push(label(stableId(cid, "point", k), "card-point", { x: tx + v("space.4"), y, width: tw - v("space.4") }, p, text("type.body")));
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
  // Every header band is navy unless `tone: "light"` asks for the tint; a
  // checkerboard of tones would rank the quadrants, which a 2x2 does not.
  const light = props.tone === "light";
  L.cells.forEach((cell, i) => {
    const x = frame.x + (i % 2) * (L.width + L.gap), y0 = frame.y + Math.floor(i / 2) * (L.height + L.gap), qid = stableId(id, "quadrant", i);
    nodes.push(rect(stableId(qid, "surface"), "quadrant-surface", { x, y: y0, width: L.width, height: L.height }, MUTED));
    nodes.push(rect(stableId(qid, "band"), "quadrant-band", { x, y: y0, width: L.width, height: cell.band }, light ? TINT : PRIMARY));
    nodes.push(label(stableId(qid, "title"), "quadrant-title", { x: x + L.pad, y: y0 + v("space.2"), width: L.inner }, cell.title, text("type.heading", light ? INK : WHITE, true)));
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

/* ------------------------------------------------------------------ agenda */

/**
 * Contents / agenda page: numbered discs, section labels in heading type, the
 * active section on a tinted band in bold, an optional detail per item.
 * props: { items: [{ label, detail?, number? }], active?: index }
 */
export function agendaLayout(frame, props) {
  if (!Array.isArray(props.items) || props.items.length < 2 || props.items.length > 10) throw new Error("Agenda takes two to ten items");
  const disc = markerSize(), gap = v("space.3"), pad = v("space.2");
  const hasDetail = props.items.some((i) => i.detail);
  const labelWidth = hasDetail ? Math.min(frame.width * 0.42, 460) : frame.width - disc - gap - 2 * pad;
  const detailWidth = hasDetail ? frame.width - labelWidth - disc - gap - 3 * pad - v("space.5") : 0;
  const items = props.items.map((item, index) => {
    if (!item || typeof item.label !== "string" || !item.label.trim()) throw new Error(`Agenda item ${index + 1} requires a label`);
    const label = measure(item.label, labelWidth, "type.heading", index === props.active);
    const detail = item.detail ? measure(item.detail, detailWidth, "type.body") : null;
    return { item, label, detail, number: item.number ?? index + 1, height: Math.max(label.height, detail?.height ?? 0, disc) + 2 * pad };
  });
  const rowGap = v("space.2");
  const natural = items.reduce((sum, i) => sum + i.height, 0) + rowGap * (items.length - 1);
  return { items, disc, gap, pad, labelWidth, detailWidth, hasDetail, rowGap, height: natural };
}

export function agendaNodes({ id, frame, props }) {
  const L = agendaLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error("Agenda items exceed the page; shorten the details or split the agenda");
  // Rows spread over the frame when it is taller than the list, up to a generous cap.
  const spare = Math.max(0, frame.height - L.height);
  const extra = Math.min(spare / L.items.length, v("space.5"));
  const nodes = [];
  let y = frame.y;
  L.items.forEach((row, i) => {
    const h = row.height + extra, active = i === props.active, rid = stableId(id, "item", i);
    if (active) nodes.push(rect(stableId(rid, "band"), "agenda-active", { x: frame.x, y, width: frame.width, height: h }, TINT, "none", "radius.small"));
    const cy = y + h / 2;
    nodes.push(...numberMarker({ id: stableId(rid, "number"), role: "agenda-marker", x: frame.x + L.pad, y: cy - L.disc / 2, size: L.disc, number: row.number, data: { index: i, active } }));
    nodes.push(label(stableId(rid, "label"), "agenda-label", { x: frame.x + L.pad + L.disc + L.gap, y: cy - row.label.height / 2, width: L.labelWidth }, row.label, text("type.heading", INK, active)));
    if (row.detail) nodes.push(label(stableId(rid, "detail"), "agenda-detail", { x: frame.x + L.pad + L.disc + L.gap + L.labelWidth + v("space.5"), y: cy - row.detail.height / 2, width: L.detailWidth }, row.detail, text("type.body", active ? INK : SECONDARY)));
    if (!active && i < L.items.length - 1) nodes.push(linePrimitive({ id: stableId(rid, "rule"), role: "agenda-rule", x1: frame.x + L.pad + L.disc + L.gap, y1: y + h + L.rowGap / 2, x2: frame.x + frame.width, y2: y + h + L.rowGap / 2, style: { stroke: RULE, lineWidth: token("line.hairline") } }));
    y += h + L.rowGap;
  });
  return nodes;
}

export function registerPanels(registry) {
  registry.set("agenda", {
    id: "agenda", version: "1.0.0", category: "navigation", role: "agenda", tokens: [...PANEL_TOKENS], preferredSize: { width: 1160, height: 420 },
    sample: { items: [{ label: "(Insert section 1)", detail: "(Insert what it covers)" }, { label: "(Insert section 2)" }, { label: "(Insert section 3)" }], active: 0 },
    render: (input) => ({ nodes: agendaNodes(input) }),
    measureContent: ({ frame, props }) => agendaLayout(frame, props),
    guidance: { useWhen: "the contents page and the tracker page before each section", why: "readers orient by the numbered list; the tinted band says where they are", actionTitle: "'Contents' or 'Agenda'; the sections carry the claims" }
  });
  registry.set("cards", {
    id: "cards", version: "1.0.0", category: "section", role: "cards", tokens: [...PANEL_TOKENS], preferredSize: { width: 1160, height: 300 },
    sample: { items: [{ icon: "target", title: "(Insert pillar 1)", text: "(Insert one-line description)" }, { icon: "rocket", title: "(Insert pillar 2)", text: "(Insert one-line description)" }, { icon: "people", title: "(Insert pillar 3)", text: "(Insert one-line description)" }] },
    variants: { outline: {}, header: { props: { tone: "header" } }, numbered: { props: { tone: "numbered" } }, plain: { props: { tone: "plain" } }, disc: { props: { tone: "disc" } }, "big-number": { props: { tone: "big-number", items: [{ title: "(Insert step 1)", text: "(Insert what happens)", points: ["(Insert activity)"] }, { title: "(Insert step 2)", text: "(Insert what happens)", points: ["(Insert activity)"] }, { title: "(Insert step 3)", text: "(Insert what happens)", points: ["(Insert activity)"] }] } }, dark: { props: { tone: "dark" } }, columns: { props: { tone: "columns", items: [{ title: "(Insert column 1)", points: ["(Insert point)"] }, { title: "(Insert column 2)", points: ["(Insert point)"] }, { title: "(Insert column 3)", points: ["(Insert point)"] }] } } }, defaultVariant: "outline", variantProp: "tone",
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
