// Panel families the reference galleries use on one page in eight: pillar
// cards (icon, title, text, sub-points), 2x2 quadrants (SWOT and the like), a
// KPI tile. Each shares the deck's heading band, marker vocabulary and body
// type; the row rule (every panel in a row shares one header height) holds
// inside a cards row because the cards are laid out here, together.
import { token, tokenValue, stableId, linePrimitive, wedgePrimitive, ellipsePrimitive, readableOn, cardFill, cardMuted, reversedFill, reversedType } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { MARK_TOKENS, markerSize, numberMarker, iconMarker } from "./marks.mjs";
import { fillRect } from "./draw.mjs";
import { mediaNode, markDrawable } from "./media.mjs";
import { setText, drawText, settingOfAll, TEXT_ROLE_TOKENS } from "./text-roles.mjs";

const PRIMARY = token("color.componentPrimary"), INK = token("color.ink"), WHITE = token("color.onPrimary"), SECONDARY = token("color.textSecondary"), ACCENT = token("color.accent");
const SURFACE = token("color.surface"), RULE = token("color.rule"), TINT = token("color.componentPrimaryTint");
const FONT = token("font.body");
// Metric values and agenda numbers are figures: the body face, bold, whose
// digits line up (the display serif's old-style figures do not).
const FIGURES = FONT;
const v = (id) => tokenValue(token(id));
const ACCENT_OR_PRIMARY = () => token("color.accent");

export const PANEL_TOKENS = Object.freeze([...new Set([...MARK_TOKENS, "type.coverTitle", "type.figureLarge", "type.figureHero", "color.accent", "color.componentPrimaryTint", "color.surfaceTint", "color.band", "color.textSecondary", "color.surfaceMuted", "color.rule", "color.positive", "color.negative", "color.chartGrid", "color.surface", "font.display", "type.heading", "type.body", "type.compact", "type.label", "type.metric", "type.deckTitle", "space.1", "space.2", "space.3", "space.4", "space.5", "line.hairline", "line.standard", "radius.none", "radius.small", "radius.round", ...TEXT_ROLE_TOKENS])]);

const rect = (id, role, frame, fill, stroke = "none", radius = "radius.none") => fillRect(id, role, frame, fill, { stroke, radius });

/* ------------------------------------------------------------------ cards */

function normalizeCards(props) {
  if (!Array.isArray(props.items) || props.items.length < 2 || props.items.length > 6) throw new Error("Cards take two to six items");
  return props.items.map((item, index) => {
    if (!item || typeof item.title !== "string" || !item.title.trim()) throw new Error(`Card ${index + 1} requires a title`);
    const points = Array.isArray(item.points) ? item.points.map((p) => (typeof p === "string" ? p : p?.text)).filter((p) => typeof p === "string" && p.trim()) : [];
    // A card about a recognisable subject (a product, a company, a place)
    // carries its mark: an embedded `logo` - or a declared player's outline or
    // photograph, the mark it declares (players.mjs) - takes the icon's place.
    // One with no file yet keeps the icon until the build fills it
    // (fetch-logos.mjs, fetch-pictures.mjs).
    const logo = item.logo && typeof item.logo === "object" && markDrawable(item.logo) ? item.logo : null;
    return { title: item.title.trim(), text: typeof item.text === "string" && item.text.trim() ? item.text.trim() : null, points, icon: item.icon ?? null, logo, number: item.number ?? index + 1, footer: typeof item.footer === "string" && item.footer.trim() ? item.footer.trim() : null, value: item.value !== undefined && item.value !== null && String(item.value).trim() ? String(item.value).trim() : null };
  });
}

// A card's mark in the icon's slot, its proportions kept. Every mark gets one
// visual area (as chart and table logos do), so a long wordmark and a squat
// one read at one weight across a row; none is taller than the slot or wider
// than three times it. On a dark card it sits on a white chip, since a mark
// drawn for a white page can vanish on the fill.
function cardLogo(cid, logo, slot, centred, onDark) {
  const aspect = logo.width > 0 && logo.height > 0 ? logo.width / logo.height : 1;
  const area = slot.height * slot.height * 2;
  const shrink = Math.min(1, slot.height / Math.sqrt(area / aspect), Math.min(slot.width, slot.height * 3) / Math.sqrt(area * aspect));
  const width = Math.sqrt(area * aspect) * shrink, height = Math.sqrt(area / aspect) * shrink;
  const frame = { x: centred ? slot.x + (slot.width - width) / 2 : slot.x, y: slot.y + (slot.height - height) / 2, width, height };
  const pad = v("space.1");
  return [
    ...(onDark ? [rect(stableId(cid, "logo-chip"), "card-logo-chip", { x: frame.x - pad, y: frame.y - pad, width: width + 2 * pad, height: height + 2 * pad }, SURFACE, "none", "radius.small")] : []),
    mediaNode({ id: stableId(cid, "logo"), frame, props: logo, role: "card-logo" }),
  ];
}

/**
 * tone: "outline" (hairline card, icon ring, bold title), "header" (filled
 * primary header band carrying the title), "numbered" (numbered disc before
 * the title), "plain" (no card edge; a column of icon + title + text).
 */
export const CARD_TONES = Object.freeze(["outline", "header", "numbered", "plain", "disc", "big-number", "dark", "columns", "stat"]);
// The tones whose card carries an icon. The rest set a band, a numeral or a
// figure in that space and have nowhere to put one.
export const ICON_CARD_TONES = Object.freeze(["dark", "outline", "plain", "disc"]);
export function cardsLayout(frame, props, rhythm = 0) {
  const items = normalizeCards(props);
  const tone = props.tone ?? (items.some((i) => i.icon || i.logo) ? "outline" : "numbered");
  if (!CARD_TONES.includes(tone)) throw new Error(`Unknown cards tone: ${tone}; use one of ${CARD_TONES.join(", ")}`);
  // Only the tones below draw one. An icon a tone cannot draw is refused here
  // rather than dropped: a page that loses its icons silently looks finished
  // with the authored intent gone.
  if (!ICON_CARD_TONES.includes(tone) && items.some((item) => item.icon || item.logo)) {
    throw new Error(
      `cards tone "${tone}" does not draw icons; use ${ICON_CARD_TONES.join(" or ")} for an icon per card, `
      + "or drop the icon. A tone that cannot show one should not be handed one.");
  }
  // Icon cards with a line of text each read centred (the "three principles" page).
  const centred = props.align === "center" || (props.align === undefined && ((tone === "outline" || tone === "plain") && items.every((i) => (i.icon || i.logo) && !i.points.length) || tone === "disc" || tone === "dark"));
  const open = ["plain", "disc", "big-number", "columns"].includes(tone);
  if (tone === "stat" && items.some((i) => !i.value)) throw new Error("Stat cards need a value on every card (the figure before the statement)");
  const gap = tone === "big-number" ? v("space.5") + v("space.4") : v("space.4"), pad = open ? 0 : v("space.4");
  const width = (frame.width - gap * (items.length - 1)) / items.length;
  const inner = width - 2 * pad - (tone === "columns" ? v("space.4") : 0);
  if (inner < 80) throw new Error("Cards are too narrow for their padding; use fewer cards");
  const iconSize = Math.round(markerSize() * (tone === "disc" ? 3.5 : centred ? 2.5 : 1.75)), disc = markerSize();
  // `rhythm` opens the gaps inside a card that has height to spare (see
  // `cardsNodes`): the space between the blocks grows before the padding does.
  const headGap = v("space.2") + rhythm / 2, bodyGap = v("space.3") + rhythm;
  // A card's words are the page's content, set in their roles (text-roles.mjs) at their reading measure: its title a lead
  // (bold body type beside a stat card's figure), its text, points and footer body text. Its figure and its big numeral
  // are display marks, set at the size their place calls for.
  const measured = items.map((item) => {
    const statValue = tone === "stat" && item.value ? setText("figure", item.value, inner) : null;
    const statValueWidth = statValue ? Math.ceil(statValue.width) + 2 * v("space.3") : 0;
    const titleWidth = tone === "numbered" ? inner - disc - v("space.3") : tone === "stat" ? inner - statValueWidth : inner;
    const title = tone === "stat" ? setText("body", item.title, titleWidth, { bold: true }) : setText("lead", item.title, titleWidth);
    const bodyWidth = tone === "big-number" ? inner - 2 * v("space.3") : inner;
    const body = item.text ? setText("body", item.text, bodyWidth) : null;
    const points = item.points.map((p) => setText("body", p, bodyWidth - v("space.4")));
    const footer = item.footer ? setText("body", item.footer, inner, { bold: true }) : null;
    const value = item.value && tone !== "stat" ? setText("figure", item.value, inner, { size: "type.metric" }) : null;
    const number = tone === "big-number" ? setText("mark", String(item.number).padStart(2, "0"), inner, { size: "type.deckTitle" }) : null;
    // Header zone: icon (outline/plain/disc), filled band (header), disc + title
    // (numbered), big numeral + title (big-number), dark tile (dark) or a ruled
    // column heading (columns).
    const iconBlock = ["outline", "plain", "disc"].includes(tone) && (item.icon || item.logo) ? iconSize + headGap : 0;
    const numberBlock = number ? number.height + headGap : 0;
    const bandHeight = tone === "header" ? title.height + 2 * v("space.2") : tone === "dark" ? Math.max(150, (item.icon || item.logo ? iconSize + headGap : 0) + title.height + 2 * v("space.4")) : 0;
    const titleHeight = tone === "header" || tone === "dark" ? 0 : title.height + (tone === "columns" ? v("space.2") + v("space.1") : 0);
    const valueHeight = value ? bodyGap + value.height : 0;
    const bodyHeight = (tone === "big-number" ? v("space.3") : 0) + (body ? bodyGap + body.height : 0) + points.reduce((sum, p) => sum + v("space.1") + p.height, points.length ? bodyGap - v("space.1") : 0) + (tone === "big-number" ? v("space.3") : 0);
    const footerHeight = footer ? bodyGap + footer.height : 0;
    return { item, title, body, points, footer, value, statValue, number, iconBlock, numberBlock, bandHeight, titleHeight, valueHeight, bodyHeight, footerHeight, height: pad + iconBlock + numberBlock + bandHeight + titleHeight + valueHeight + bodyHeight + footerHeight + pad };
  });
  const headerHeight = Math.max(...measured.map((m) => m.iconBlock + m.numberBlock + m.bandHeight + m.titleHeight + m.valueHeight));
  return { items: measured, tone, centred, open, gap, pad, width, inner, iconSize, disc, headGap, bodyGap, headerHeight, height: Math.max(...measured.map((m) => m.height - (m.iconBlock + m.numberBlock + m.bandHeight + m.titleHeight + m.valueHeight) + headerHeight)),
    texts: measured.flatMap((m) => [m.title, m.body, ...m.points, m.footer]) };
}

// The most a boxed card's rhythm opens: the gaps between icon, title, figure
// and text grow by up to 12px each when the frame has the height.
const CARD_RHYTHMS = ["space.3", "space.2", "space.1"];

/**
 * The card set a frame takes: the layout with the most rhythm that fits, so
 * the box is as tall as its copy and never taller. `cardsNodes` draws it and
 * the ceiling reports it, so the flow knows where the row ends.
 */
function grownCards(frame, props) {
  const L = cardsLayout(frame, props);
  if (L.open) return L;
  for (const rhythm of CARD_RHYTHMS) {
    const grown = cardsLayout(frame, props, v(rhythm));
    if (grown.height <= frame.height + 0.01) return grown;
  }
  return L;
}

export function cardsNodes({ id, frame: frameIn, props }) {
  let frame = frameIn;
  // A question panel (the survey deck's "Should companies prioritize investments?")
  // takes the left quarter in dark grey; the cards answer it to the right.
  const asked = typeof props.question === "string" && props.question.trim();
  const qw = Math.round(frame.width * 0.24), qgap = v("space.4"), qpad = v("space.4");
  const q = asked ? setText("statement", props.question, qw - 2 * qpad) : null;
  if (asked) frame = { ...frame, x: frame.x + qw + qgap, width: frame.width - qw - qgap };
  const natural = cardsLayout(frame, props);
  if (natural.height > frame.height + 0.01) throw new Error(`Cards need ${Math.ceil(natural.height)}px but have ${frame.height}px; shorten the card copy or use fewer cards`);
  // Cards are as tall as their copy, at the top of their frame, the copy
  // starting under the box's top edge: cards grown past their copy with the
  // copy centred carry air above every icon and under the last line, which the
  // columns check reads as a hole. The room goes to the card's rhythm first -
  // the gaps between icon, title, figure and text open by up to 12px each -
  // and what is left is the frame's, below the row, for the flow to give to
  // what follows (the ceiling reports the row's height). An open column set
  // keeps its natural height. `valign: "middle"` still centres the row when
  // the author asks.
  const L = props.valign === "middle" ? natural : grownCards(frame, props);
  const cardHeight = L.height;
  if (props.valign === "middle" && frame.height > L.height) frame = { ...frame, y: frame.y + (frame.height - L.height) / 2 };
  const nodes = [];
  if (asked) {
    const h = Math.max(cardHeight, q.height + 2 * qpad);
    nodes.push(rect(stableId(id, "question"), "card-question", { x: frameIn.x, y: frame.y, width: qw, height: h }, reversedFill(SECONDARY), "none", "radius.none"));
    nodes.push(drawText(stableId(id, "question-text"), "card-question-text", { x: frameIn.x + qpad, y: frame.y + qpad, width: qw - 2 * qpad }, q, { color: reversedType() }));
  }
  L.items.forEach((m, index) => {
    const x = frame.x + index * (L.width + L.gap), cid = stableId(id, "card", index);
    const top = frame.y;
    const surface = cardFill();
    if (L.tone === "stat") nodes.push(rect(stableId(cid, "surface"), "card-surface", { x, y: frame.y, width: L.width, height: cardHeight }, cardMuted(), "none", "radius.none"));
    else if (!L.open && L.tone !== "dark") nodes.push(rect(stableId(cid, "surface"), "card-surface", { x, y: frame.y, width: L.width, height: cardHeight }, surface.fill, surface.stroke, "radius.small"));
    const onCard = L.open || L.tone === "dark" ? SURFACE : L.tone === "stat" ? cardMuted() : surface.fill;
    let y = top + L.pad;
    const cx = x + L.pad;
    const align = L.centred ? "center" : "left";
    if (L.tone === "header") {
      nodes.push(rect(stableId(cid, "band"), "card-band", { x, y: top, width: L.width, height: m.bandHeight }, reversedFill(PRIMARY)));
      nodes.push(drawText(stableId(cid, "title"), "card-title", { x: cx, y: top + v("space.2"), width: L.inner }, m.title, { color: reversedType() }));
      y = top + m.bandHeight + L.pad;
    } else if (L.tone === "dark") {
      // A navy tile carries icon and title in white; the copy sits below it on the page.
      nodes.push(rect(stableId(cid, "band"), "card-band", { x, y: top, width: L.width, height: m.bandHeight }, reversedFill(PRIMARY), "none", "radius.small"));
      const block = (m.item.icon || m.item.logo ? L.iconSize + L.headGap : 0) + m.title.height;
      let ty = top + (m.bandHeight - block) / 2;
      if (m.item.logo) { nodes.push(...cardLogo(cid, m.item.logo, { x: cx, y: ty, width: L.inner, height: L.iconSize }, true, true)); ty += L.iconSize + L.headGap; }
      else if (m.item.icon) { nodes.push(...iconMarker({ id: stableId(cid, "icon"), role: "card-icon", x: cx + (L.inner - L.iconSize) / 2, y: ty, size: L.iconSize, icon: m.item.icon, tone: "filled" })); ty += L.iconSize + L.headGap; }
      nodes.push(drawText(stableId(cid, "title"), "card-title", { x: cx, y: ty, width: L.inner }, m.title, { color: reversedType(), align: "center" }));
    } else if (L.tone === "big-number") {
      // "01 / 02 / 03": the numeral in display type, the title beside the next
      // card's arrow, and the copy on a muted band that runs to the frame's foot.
      nodes.push(drawText(stableId(cid, "number"), "card-number", { x: cx, y, width: L.inner }, m.number, { color: ACCENT_OR_PRIMARY() }));
      y += m.numberBlock;
      nodes.push(drawText(stableId(cid, "title"), "card-title", { x: cx, y, width: L.inner }, m.title, { color: INK }));
      if (index < L.items.length - 1) nodes.push(...iconMarker({ id: stableId(cid, "arrow"), role: "card-arrow", x: x + L.width + (L.gap - L.disc) / 2, y: y + (m.title.lineHeight - L.disc) / 2, size: L.disc, icon: "arrow-right", tone: "plain", data: { muted: true } }));
      y += m.title.height;
    } else if (L.tone === "columns") {
      nodes.push(drawText(stableId(cid, "title"), "card-title", { x: cx, y, width: L.inner }, m.title, { color: INK }));
      const ry = y + m.title.height + v("space.2");
      nodes.push(linePrimitive({ id: stableId(cid, "title-rule"), role: "card-rule", x1: cx, y1: ry, x2: cx + L.inner, y2: ry, style: { stroke: INK, lineWidth: token("line.hairline") } }));
      // The rule separates two columns of type, so it ends where the type
      // does. Drawn to the card's height it runs a quarter of its length past
      // the last line on both sides, dividing nothing.
      if (index) {
        const written = Math.max(...L.items.map((entry) => entry.height));
        nodes.push(linePrimitive({ id: stableId(cid, "divider"), role: "card-divider", x1: x - L.gap / 2, y1: top, x2: x - L.gap / 2, y2: top + Math.min(cardHeight, written), style: { stroke: RULE, lineWidth: token("line.hairline") } }));
      }
      y += m.titleHeight;
    } else if (L.tone === "stat") {
      // "88% | Investors that believe …": the figure in the heading role, a hairline
      // divider, the statement beside it; the copy continues below.
      const vw = Math.ceil(m.statValue.width) + v("space.3");
      nodes.push(drawText(stableId(cid, "value"), "card-value", { x: cx, y, width: vw }, m.statValue, { color: INK }));
      nodes.push(linePrimitive({ id: stableId(cid, "divider"), role: "card-divider", x1: cx + vw, y1: y, x2: cx + vw, y2: y + m.title.height, style: { stroke: RULE, lineWidth: token("line.hairline") } }));
      nodes.push(drawText(stableId(cid, "title"), "card-title", { x: cx + vw + v("space.3"), y, width: L.inner - vw - v("space.3") }, m.title, { color: INK }));
      y += m.title.height;
    } else if (L.tone === "numbered") {
      nodes.push(...numberMarker({ id: stableId(cid, "number"), role: "card-marker", x: cx, y: y + (m.title.lineHeight - L.disc) / 2, size: L.disc, number: m.item.number }));
      nodes.push(drawText(stableId(cid, "title"), "card-title", { x: cx + L.disc + v("space.3"), y, width: L.inner - L.disc - v("space.3") }, m.title, { color: INK }));
      y += m.title.height;
    } else {
      if (m.item.logo) nodes.push(...cardLogo(cid, m.item.logo, { x: cx, y, width: L.inner, height: L.iconSize }, L.centred, false));
      else if (m.item.icon) { nodes.push(...iconMarker({ id: stableId(cid, "icon"), role: "card-icon", x: L.centred ? cx + (L.inner - L.iconSize) / 2 : cx, y, size: L.iconSize, icon: m.item.icon, tone: L.tone === "disc" ? "filled" : "outline" })); }
      y += m.iconBlock;
      nodes.push(drawText(stableId(cid, "title"), "card-title", { x: cx, y, width: L.inner }, m.title, { color: INK, align }));
      y += m.title.height;
    }
    if (m.value) {
      // A headline figure under the title (price, size, share) in the metric role.
      const vy = top + L.pad + (L.tone === "header" || L.tone === "dark" ? m.bandHeight : m.iconBlock + m.numberBlock + m.titleHeight) + L.bodyGap;
      nodes.push(drawText(stableId(cid, "value"), "card-value", { x: cx, y: vy, width: L.inner }, m.value, { color: readableOn(PRIMARY, onCard, 3), align }));
    }
    // Content starts level across the row (row rule), below the tallest header.
    y = L.tone === "header" || L.tone === "dark" ? top + L.headerHeight + L.pad : top + L.pad + L.headerHeight;
    let tx = cx, tw = L.inner;
    if (L.tone === "big-number") {
      // The copy band: muted, from the content line to the card's foot.
      nodes.push(rect(stableId(cid, "band"), "card-band", { x, y: y + L.bodyGap, width: L.width, height: Math.max(0, cardHeight - (y + L.bodyGap - top)) }, cardMuted()));
      tx = cx + v("space.3"); tw = L.inner - 2 * v("space.3"); y += v("space.3");
    }
    if (m.body) { y += L.bodyGap; nodes.push(drawText(stableId(cid, "text"), "card-text", { x: tx, y, width: tw }, m.body, { color: INK, align })); y += m.body.height; }
    m.points.forEach((p, k) => {
      y += k ? v("space.1") : L.bodyGap;
      nodes.push(rect(stableId(cid, "bullet", k), "card-bullet", { x: tx, y: y + (p.lineHeight - v("space.1")) / 2, width: v("space.1"), height: v("space.1") }, INK));
      nodes.push(drawText(stableId(cid, "point", k), "card-point", { x: tx + v("space.4"), y, width: tw - v("space.4") }, p, { color: INK }));
      y += p.height;
    });
    if (m.footer) {
      const fy = frame.y + cardHeight - L.pad - m.footer.height;
      nodes.push(linePrimitive({ id: stableId(cid, "footer-rule"), role: "card-rule", x1: cx, y1: fy - v("space.2"), x2: cx + L.inner, y2: fy - v("space.2"), style: { stroke: RULE, lineWidth: token("line.hairline") } }));
      nodes.push(drawText(stableId(cid, "footer"), "card-footer", { x: cx, y: fy, width: L.inner }, m.footer, { color: readableOn(PRIMARY, onCard) }));
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
    // A quadrant's title is its lead and its points body text, at their reading measure (text-roles.mjs).
    const title = setText("lead", q.title, inner);
    const points = (Array.isArray(q.points) ? q.points : q.text ? [q.text] : []).map((p) => setText("body", typeof p === "string" ? p : p.text, inner - v("space.4")));
    const band = title.height + 2 * v("space.2");
    const body = points.reduce((sum, p) => sum + p.height, 0) + Math.max(0, points.length - 1) * v("space.1");
    return { title, points, band, needed: band + pad + body + pad };
  });
  const over = cells.findIndex((c) => c.needed > height + 0.01);
  if (over >= 0) throw new Error(`Quadrant ${over + 1}, "${quads[over].title}", needs ${Math.ceil(cells[over].needed)}px and its cell has ${Math.floor(height)}px; shorten its points or give the quadrants more height`);
  return { cells, gap, pad, width, height, inner, texts: cells.flatMap((c) => [c.title, ...c.points]) };
}

export function quadrantsNodes({ id, frame, props }) {
  const L = quadrantsLayout(frame, props);
  const nodes = [];
  // Every header band is navy unless `tone: "light"` asks for the tint; a
  // checkerboard of tones would rank the quadrants, which a 2x2 does not.
  const light = props.tone === "light";
  L.cells.forEach((cell, i) => {
    const x = frame.x + (i % 2) * (L.width + L.gap), y0 = frame.y + Math.floor(i / 2) * (L.height + L.gap), qid = stableId(id, "quadrant", i);
    nodes.push(rect(stableId(qid, "surface"), "quadrant-surface", { x, y: y0, width: L.width, height: L.height }, cardMuted()));
    nodes.push(rect(stableId(qid, "band"), "quadrant-band", { x, y: y0, width: L.width, height: cell.band }, light ? TINT : reversedFill(PRIMARY)));
    nodes.push(drawText(stableId(qid, "title"), "quadrant-title", { x: x + L.pad, y: y0 + v("space.2"), width: L.inner }, cell.title, { color: light ? INK : reversedType() }));
    let y = y0 + cell.band + L.pad;
    cell.points.forEach((p, k) => {
      nodes.push(rect(stableId(qid, "bullet", k), "quadrant-bullet", { x: x + L.pad, y: y + (p.lineHeight - v("space.1")) / 2, width: v("space.1"), height: v("space.1") }, INK));
      nodes.push(drawText(stableId(qid, "point", k), "quadrant-point", { x: x + L.pad + v("space.4"), y, width: L.inner - v("space.4") }, p, { color: INK }));
      y += p.height + v("space.1");
    });
  });
  return nodes;
}

/* ------------------------------------------------------------------- metric */

/** KPI tile: big number, label, optional sublabel and signed delta; light or dark tone. */
function ringMetricNodes({ id, frame, props }) {
  const raw = String(props.value).trim();
  const share = /^\d+(\.\d+)?\s*%?$/.test(raw) ? Number(raw.replace("%", "")) : NaN;
  if (!(share >= 0 && share <= 100)) throw new Error("Ring metric takes a percentage value from 0 to 100");
  // What the share is of is the tile's content: a note at body size under the ring (text-roles.mjs).
  const labelLayout = props.label ? setText("note", props.label, frame.width - 2 * v("space.2")) : null;
  const gap = v("space.2");
  const size = Math.max(56, Math.min(frame.width - 2 * v("space.2"), frame.height - (labelLayout ? labelLayout.height + gap : 0) - 4));
  const circle = { x: frame.x + (frame.width - size) / 2, y: frame.y + (frame.height - size - (labelLayout ? labelLayout.height + gap : 0)) / 2, width: size, height: size };
  const nodes = [];
  nodes.push(ellipsePrimitive({ id: stableId(id, "track"), role: "metric-ring-track", frame: circle, style: { fill: token("color.chartGrid"), stroke: "none", lineWidth: token("line.hairline"), radius: token("radius.round") } }));
  if (share > 0) nodes.push(wedgePrimitive({ id: stableId(id, "arc"), role: "metric-ring", frame: circle, startAngle: -90, endAngle: -90 + 360 * Math.min(share, 100) / 100, style: { fill: ACCENT, stroke: "none", lineWidth: token("line.hairline") }, data: { share } }));
  const hole = size * 0.72;
  nodes.push(ellipsePrimitive({ id: stableId(id, "hole"), role: "metric-ring-hole", frame: { x: circle.x + (size - hole) / 2, y: circle.y + (size - hole) / 2, width: hole, height: hole }, style: { fill: SURFACE, stroke: "none", lineWidth: token("line.hairline"), radius: token("radius.round") } }));
  // The value is a figure, set at the largest size that holds it on one line inside the hole; a hole too small for it at
  // the figure's own size is refused, not filled with caption type.
  let value = null;
  for (const candidate of ["type.metric", "type.heading"]) {
    try { value = setText("figure", String(props.value), hole - 8, { size: candidate }); if (value.lines.length === 1) break; } catch { value = null; }
  }
  if (!value || value.lines.length > 1) throw new Error(`Ring metric "${props.value}" does not fit its ${Math.floor(hole)}px hole on one line; give the ring more room or shorten the value`);
  nodes.push(drawText(stableId(id, "value"), "metric-value", { x: circle.x + (size - hole) / 2 + 4, y: circle.y + (size - value.height) / 2, width: hole - 8 }, value, { color: INK, align: "center" }));
  if (labelLayout) nodes.push(drawText(stableId(id, "label"), "metric-label", { x: frame.x + v("space.2"), y: circle.y + size + gap, width: frame.width - 2 * v("space.2") }, labelLayout, { align: "center" }));
  return nodes;
}

/**
 * The height a metric tile's value, label, sublabel and delta take at a width:
 * what a column sizes the tile to when the number heads its points, so the
 * first point sits under the number rather than under a fixed box's air.
 */
/**
 * The size a metric's figure is set at. `display` is the figure that is the page's point: it takes the largest display
 * size that sets it on one line in the width it has, so a lone number in an open column is as large as the column
 * allows and the same number in a narrow cell steps down rather than breaking.
 */
function figureSize(props, width) {
  if (props.variant !== "display") return props.variant === "prominent" ? "type.deckTitle" : "type.metric";
  // `ceiling`: the largest size the figure may take, where the page has less height than its width would allow.
  // A figure too wide for the width at a size cannot be measured there (it does not break): that size does not fit.
  const ladder = ["type.figureHero", "type.figureLarge", "type.coverTitle", "type.deckTitle"];
  return ladder.slice(Math.max(0, ladder.indexOf(props.ceiling))).find((size) => { try { return measureText(String(props.value ?? ""), width, { fontFamily: tokenValue(FIGURES), fontSize: v(size), bold: true }).lines.length === 1; } catch { return false; } }) ?? "type.metric";
}

/** How much of the scale a display figure could take it gets at a width (1: the largest size; lower as it steps down). */
const figureEmphasis = (props, width) => (props.variant === "display" ? v(figureSize(props, width)) / v("type.figureHero") : null);

/**
 * A metric's words measured at a width, by its measurement and its drawing alike. Under a display figure the words are
 * the page's content, not a tile's furniture, and are set in their roles (text-roles.mjs): the label is the statement the
 * figure makes, the sub-line a note under it, the delta body text in bold - each at its reading measure. A tile in a
 * strip or a KPI card packs several figures into one row and keeps the caption sizes (`type`, for the drawing).
 */
function metricTexts(props, width) {
  if (props.variant === "display") return { roles: true, label: props.label ? setText("statement", props.label, width) : null, sub: props.sublabel ? setText("note", props.sublabel, width) : null, delta: props.delta ? setText("body", props.delta, width, { bold: true }) : null };
  // A tile in a strip or a KPI card says what its figure counts: that is content too, set as a note at body size, and
  // its change body text in bold - the tile is as tall as they take (metricHeight), not a caption squeezed under it.
  return { roles: true, label: props.label ? setText("note", props.label, width) : null, sub: props.sublabel ? setText("note", props.sublabel, width) : null, delta: props.delta ? setText("body", props.delta, width, { bold: true }) : null };
}

/** A metric's figure at a width: the display size its variant takes (figureSize), set as a figure. */
const metricValue = (props, width) => setText("figure", String(props.value ?? ""), width, { size: figureSize(props, width) });

/** A metric's height at a width. */
export function metricHeight(width, props) {
  const pad = props.tone === "hero" ? 0 : v("space.3");
  const inner = width - 2 * pad;
  const texts = metricTexts(props, inner);
  const gap = v("space.1");
  const value = metricValue(props, inner);
  const parts = [value, texts.label, texts.sub, texts.delta].filter(Boolean);
  return parts.reduce((sum, part) => sum + part.height, 0) + gap * (parts.length - 1) + 2 * pad;
}

export function metricNodes({ id, frame, props }) {
  if (props.value === undefined || props.value === null || String(props.value).trim() === "") throw new Error("Metric requires a value");
  const METRIC_TONES = ["default", "dark", "tint", "hero", "ink", "rule", "ring"];
  // "ring": a share drawn as an accent arc around the value (a KPI ring).
  if (props.tone === "ring") return ringMetricNodes({ id, frame, props });
  if (props.tone !== undefined && !METRIC_TONES.includes(props.tone)) throw new Error(`Unknown metric tone: ${props.tone}; use one of ${METRIC_TONES.join(", ")}`);
  if (props.better !== undefined && !["up", "down"].includes(props.better)) throw new Error(`A metric's \`better\` is "up" or "down" (got ${JSON.stringify(props.better)}): the direction that is good news for the measure`);
  // "ink": a black tile with the value in the accent (a keynote stat row);
  // "rule": no tile, the value in the accent behind a hairline at the left (the
  // "51 | 443 | 39" stat row).
  const ink_ = props.tone === "ink", ruled = props.tone === "rule";
  const dark = props.tone === "dark" || ink_;
  const pad = props.tone === "hero" ? 0 : v("space.3");
  const width = frame.width - 2 * pad;
  const value = metricValue(props, width);
  const display = props.variant === "display";
  const { label: labelLayout, sub, delta } = metricTexts(props, width);
  const gap = v("space.1");
  const total = value.height + (labelLayout ? gap + labelLayout.height : 0) + (sub ? gap + sub.height : 0) + (delta ? gap + delta.height : 0);
  if (total > frame.height + 0.01) throw new Error(`Metric tile is too short for its ${["value", labelLayout && "label", sub && "sublabel", delta && "delta"].filter(Boolean).join(", ")}: they take ${Math.ceil(total)}px at this width and the tile has ${Math.floor(frame.height)}px. Shorten the ${sub ? "sublabel or the label" : "label"}${delta ? ", or drop the delta" : ""}, or set fewer tiles so each is wider`);
  const nodes = [];
  if (ink_) nodes.push(rect(stableId(id, "surface"), "metric-surface", frame, reversedFill(INK), "none", "radius.none"));
  else if (dark) nodes.push(rect(stableId(id, "surface"), "metric-surface", frame, reversedFill(PRIMARY), "none", "radius.small"));
  else if (props.tone === "tint") nodes.push(rect(stableId(id, "surface"), "metric-surface", frame, TINT, "none", "radius.small"));
  // No hairline before the tile. A rule drawn as a divider between tiles
  // - n tiles, n-1 rules - on a row whose values are left-aligned over a
  // label does not read as a divider at all: it sits hard against the number
  // that follows it and reads as a left border on that card. The tiles are
  // already a row of three peers on one baseline with a gap between them, which
  // is what makes them read as a set; a fence between them adds a device and
  // says nothing. `tone: "rule"` keeps what actually distinguishes it - the
  // value in the accent, left-aligned, on no tile.
  // `tone: "hero"`: the one big number beside a chart, in the accent, left-aligned, top-anchored.
  const hero = props.tone === "hero";
  const ink = ink_ ? ACCENT : dark ? reversedType() : hero || ruled ? ACCENT : PRIMARY, grey = dark ? reversedType() : hero || ruled ? INK : SECONDARY;
  const align = props.align ?? (hero || ruled ? "left" : "center");
  // Peers in a row start on one line. Centred in its own track, a tile with
  // three lines against its neighbours' four would begin ten pixels lower, and
  // three numbers read across would step visibly down.
  let y = hero || props.valign === "top" ? frame.y : frame.y + (frame.height - total) / 2;
  nodes.push(drawText(stableId(id, "value"), "metric-value", { x: frame.x + pad, y, width }, value, { color: ink, align }));
  y += value.height;
  // Under a display figure the label is in the page's ink and the sub-line in the secondary colour, so the two read as a
  // statement and its qualifier (their roles' colours); on a dark tile both keep the tile's pale type.
  const tinted = display && !dark ? undefined : grey;
  const words = (part, role, at, set, color) => drawText(stableId(id, part), role, at, set, { color, align });
  if (labelLayout) { y += gap; nodes.push(words("label", "metric-label", { x: frame.x + pad, y, width }, labelLayout, tinted)); y += labelLayout.height; }
  if (sub) { y += gap; nodes.push(words("sublabel", "metric-sublabel", { x: frame.x + pad, y, width }, sub, tinted)); y += sub.height; }
  if (delta) {
    y += gap;
    const falling = /^\s*[-−▼↓]/.test(String(props.delta));
    const rising = /^\s*[+▲↑]/.test(String(props.delta));
    // Coloured by merit, not by sign: a measure whose `better` is "down" - a
    // cost, churn, a wait - reads its fall as the good news.
    const better = props.better ?? "up";
    const good = better === "up" ? rising : falling, bad = better === "up" ? falling : rising;
    const color = dark ? reversedType() : bad ? token("color.negative") : good ? token("color.positive") : PRIMARY;
    nodes.push(words("delta", "metric-delta", { x: frame.x + pad, y, width }, delta, color));
  }
  return nodes;
}

/* ------------------------------------------------------------------ agenda */

/**
 * Contents / agenda page: numbered discs, section labels in heading type, the
 * active section on a tinted band in bold, an optional detail per item.
 * props: { items: [{ label, detail?, number? }], active?: index }
 */
// How many sections each contents style holds: a list down the page, or
// equal columns across it. The composer reads this to pick the style a deck's
// section count fits (`agendaStyleFor`), the authoring check to refuse a named
// style that cannot (compose-deck.mjs contentsProblem), and `--limits` to
// publish it.
export const AGENDA_LIMITS = Object.freeze({ list: Object.freeze({ min: 2, max: 10 }), columns: Object.freeze({ min: 2, max: 6 }) });

/**
 * The contents style that holds `count` sections: the one asked for where it
 * fits, otherwise the list, which holds the most. The contents page is the
 * runtime's own furniture, so a style drawn by the deck's variation is
 * switched for one that fits rather than refused at composition.
 */
export function agendaStyleFor(style, count) {
  const asked = style === "columns" ? "columns" : "list";
  return count >= AGENDA_LIMITS[asked].min && count <= AGENDA_LIMITS[asked].max ? asked : "list";
}

export function agendaLayout(frame, props) {
  if (!Array.isArray(props.items) || props.items.length < AGENDA_LIMITS.list.min || props.items.length > AGENDA_LIMITS.list.max) throw new Error("Agenda takes two to ten items");
  const disc = markerSize(), gap = v("space.3"), pad = v("space.2");
  const hasDetail = props.items.some((i) => i.detail);
  const labelWidth = hasDetail ? Math.min(frame.width * 0.42, 460) : frame.width - disc - gap - 2 * pad;
  const detailWidth = hasDetail ? frame.width - labelWidth - disc - gap - 3 * pad - v("space.5") : 0;
  const items = props.items.map((item, index) => {
    if (!item || typeof item.label !== "string" || !item.label.trim()) throw new Error(`Agenda item ${index + 1} requires a label`);
    // A section's name is its lead, bold where the deck has reached it; what it covers a note (text-roles.mjs).
    const label = setText("lead", item.label, labelWidth, { bold: index === props.active });
    const detail = item.detail ? setText("note", item.detail, detailWidth) : null;
    return { item, label, detail, number: item.number ?? index + 1, height: Math.max(label.height, detail?.height ?? 0, disc) + 2 * pad };
  });
  const rowGap = v("space.2");
  const natural = items.reduce((sum, i) => sum + i.height, 0) + rowGap * (items.length - 1);
  return { items, disc, gap, pad, labelWidth, detailWidth, hasDetail, rowGap, height: natural };
}

/**
 * The list as the page can hold it: with each section's detail where the rows
 * fit the frame, and as the labels alone where they do not. The details are
 * the sections' own summaries, which their dividers carry, so the contents
 * page gives them up before it fails to compose.
 */
function fittedAgenda(frame, props) {
  const full = agendaLayout(frame, props);
  if (full.height <= frame.height + 0.01 || !full.hasDetail) return full;
  return agendaLayout(frame, { ...props, items: props.items.map((item) => ({ ...item, detail: undefined })) });
}

export function agendaNodes({ id, frame, props }) {
  const L = fittedAgenda(frame, props);
  if (L.height > frame.height + 0.01) throw new Error("Agenda items exceed the page; shorten the section titles or split the agenda");
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
    nodes.push(drawText(stableId(rid, "label"), "agenda-label", { x: frame.x + L.pad + L.disc + L.gap, y: cy - row.label.height / 2, width: L.labelWidth }, row.label, { color: INK }));
    if (row.detail) nodes.push(drawText(stableId(rid, "detail"), "agenda-detail", { x: frame.x + L.pad + L.disc + L.gap + L.labelWidth + v("space.5"), y: cy - row.detail.height / 2, width: L.detailWidth }, row.detail, { color: active ? INK : SECONDARY }));
    if (!active && i < L.items.length - 1) nodes.push(linePrimitive({ id: stableId(rid, "rule"), role: "agenda-rule", x1: frame.x + L.pad + L.disc + L.gap, y1: y + h + L.rowGap / 2, x2: frame.x + frame.width, y2: y + h + L.rowGap / 2, style: { stroke: RULE, lineWidth: token("line.hairline") } }));
    y += h + L.rowGap;
  });
  return nodes;
}

/**
 * A columned contents page: sections as equal columns headed by big
 * two-digit numerals ("01", "02"), the active section in the accent and bold,
 * the others in grey. Works on the light page and, with `tone: "dark"`, on navy.
 */
export function agendaColumnsNodes({ id, frame, props }) {
  const items = Array.isArray(props.items) ? props.items : [];
  if (items.length < AGENDA_LIMITS.columns.min || items.length > AGENDA_LIMITS.columns.max) throw new Error("Column agenda takes two to six sections");
  const dark = props.tone === "dark";
  const gap = v("space.5"), width = (frame.width - gap * (items.length - 1)) / items.length;
  const nodes = [];
  if (dark) nodes.push(rect(stableId(id, "surface"), "agenda-surface", { x: frame.x - 40, y: frame.y - 40, width: frame.width + 80, height: frame.height + 80 }, INK));
  const measured = items.map((item, i) => {
    const active = i === props.active;
    const numeral = String(item.number ?? i + 1).padStart(2, "0");
    const number = setText("mark", numeral, width, { size: "type.quoteMark" });
    const labelLayout = setText("lead", item.label, width, { bold: active });
    const detail = item.detail ? setText("note", item.detail, width) : null;
    return { numeral, number, labelLayout, detail, height: number.height + 20 + labelLayout.height + (detail ? 8 + detail.height : 0) };
  });
  // The columns run the body's height, each its own band: the active section's tinted, a hairline between the others. The
  // sections' numerals, rules, labels and details sit on one shared baseline, centred down the bands - a block that does not
  // fill its column is centred in it - so the page reads as its columns, where the block alone stood between two empty bands.
  const top = frame.y + Math.max(0, (frame.height - Math.max(...measured.map((m) => m.height))) / 2);
  items.forEach((item, i) => {
    const x0 = frame.x + i * (width + gap);
    // The band reaches half a gap past its section's text on each side, so the words keep air inside the tint.
    if (i === props.active) nodes.push(rect(stableId(id, "band", i), "agenda-band", { x: x0 - gap / 2, y: frame.y, width: width + gap, height: frame.height }, dark ? token("color.componentPrimary") : token("color.surfaceMuted")));
    else if (i > 0 && i - 1 !== props.active) nodes.push(linePrimitive({ id: stableId(id, "divider", i), role: "agenda-divider", x1: x0 - gap / 2, y1: frame.y, x2: x0 - gap / 2, y2: frame.y + frame.height, style: { stroke: dark ? token("color.chartGrid") : RULE, lineWidth: token("line.hairline") } }));
  });
  items.forEach((item, i) => {
    const active = i === props.active, x = frame.x + i * (width + gap), rid = stableId(id, "item", i);
    const { numeral, number, labelLayout, detail } = measured[i];
    const numberColor = active ? ACCENT : dark ? token("color.chartGrid") : SECONDARY;
    const textColor = active ? (dark ? WHITE : INK) : dark ? token("color.chartGrid") : SECONDARY;
    let y = top;
    nodes.push(drawText(stableId(rid, "number"), "agenda-number", { x, y, width }, number, { color: numberColor, data: { index: i, active } }));
    y += number.height + 8;
    nodes.push(linePrimitive({ id: stableId(rid, "rule"), role: "agenda-rule", x1: x, y1: y, x2: x + width, y2: y, style: { stroke: active ? ACCENT : dark ? token("color.chartGrid") : RULE, lineWidth: token(active ? "line.standard" : "line.hairline") } }));
    y += 12;
    nodes.push(drawText(stableId(rid, "label"), "agenda-label", { x, y, width }, labelLayout, { color: textColor }));
    y += labelLayout.height;
    if (detail) { y += 8; nodes.push(drawText(stableId(rid, "detail"), "agenda-detail", { x, y, width }, detail, { color: textColor })); }
  });
  return nodes;
}

export function registerPanels(registry) {
  registry.set("agenda", {
    id: "agenda", version: "1.0.0", category: "navigation", role: "agenda", tokens: [...PANEL_TOKENS, "color.chartGrid", "type.quoteMark"], preferredSize: { width: 1160, height: 420 },
    sample: { items: [{ label: "(Insert section 1)", detail: "(Insert what it covers)" }, { label: "(Insert section 2)" }, { label: "(Insert section 3)" }], active: 0 },
    variants: { list: {}, columns: { props: { variant: "columns" } } }, defaultVariant: "list",
    resolveVariant: (props = {}) => props.variant === "columns" ? "columns" : "list",
    render: (input) => ({ nodes: input.props.variant === "columns" ? agendaColumnsNodes(input) : agendaNodes(input) }),
    measureContent: ({ frame, props }) => props.variant === "columns" ? { height: frame.height } : fittedAgenda(frame, props),
    guidance: { useWhen: "the contents page and the tracker page before each section", why: "readers orient by the numbered list; the tinted band says where they are", actionTitle: "'Contents' or 'Agenda'; the sections carry the claims" }
  });
  registry.set("cards", {
    id: "cards", version: "1.0.0", category: "section", role: "cards", tokens: [...PANEL_TOKENS], preferredSize: { width: 1160, height: 300 },
    sample: { items: [{ icon: "target", title: "(Insert pillar 1)", text: "(Insert one-line description)" }, { icon: "rocket", title: "(Insert pillar 2)", text: "(Insert one-line description)" }, { icon: "people", title: "(Insert pillar 3)", text: "(Insert one-line description)" }] },
    variants: { outline: {}, header: { props: { tone: "header", items: [{ title: "(Insert pillar 1)", text: "(Insert one-line description)" }, { title: "(Insert pillar 2)", text: "(Insert one-line description)" }, { title: "(Insert pillar 3)", text: "(Insert one-line description)" }] } }, numbered: { props: { tone: "numbered", items: [{ title: "(Insert pillar 1)", text: "(Insert one-line description)" }, { title: "(Insert pillar 2)", text: "(Insert one-line description)" }, { title: "(Insert pillar 3)", text: "(Insert one-line description)" }] } }, plain: { props: { tone: "plain" } }, disc: { props: { tone: "disc" } }, "big-number": { props: { tone: "big-number", items: [{ title: "(Insert step 1)", text: "(Insert what happens)", points: ["(Insert activity)"] }, { title: "(Insert step 2)", text: "(Insert what happens)", points: ["(Insert activity)"] }, { title: "(Insert step 3)", text: "(Insert what happens)", points: ["(Insert activity)"] }] } }, dark: { props: { tone: "dark" } }, columns: { props: { tone: "columns", items: [{ title: "(Insert column 1)", points: ["(Insert point)"] }, { title: "(Insert column 2)", points: ["(Insert point)"] }, { title: "(Insert column 3)", points: ["(Insert point)"] }] } } }, defaultVariant: "outline", variantProp: "tone",
    resolveVariant: (props = {}) => props.tone ?? (Array.isArray(props.items) && props.items.some((i) => i?.icon) ? "outline" : "numbered"),
    render: (input) => ({ nodes: cardsNodes(input) }),
    measureContent: ({ frame, props }) => cardsLayout(frame, props),
    // The height the row uses: its copy with the rhythm the frame allows
    // (grownCards, as `cardsNodes` draws it). Past it the slack goes after the
    // row, to what follows it. A centred row places itself in any frame.
    measureCeiling: ({ frame, props }) => {
      if (props.valign === "middle") return null;
      if (!(typeof props.question === "string" && props.question.trim())) return grownCards(frame, props).height;
      const qw = Math.round(frame.width * 0.24), pad = v("space.4");
      const q = setText("statement", props.question, qw - 2 * pad);
      return Math.max(grownCards({ ...frame, width: frame.width - qw - v("space.4") }, props).height, q.height + 2 * pad);
    },
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
    metric.variants = { default: {}, prominent: { props: { variant: "prominent" } }, dark: { props: { tone: "dark" } }, hero: { props: { tone: "hero", variant: "prominent", value: "80%", label: "(Insert what the number is)" } }, ink: { props: { tone: "ink", variant: "prominent", value: "1.6x", label: "(Insert what the number is)" } }, ring: { props: { tone: "ring", value: "68%", label: "(Insert what the share is)" } }, rule: { props: { tone: "rule", variant: "prominent", value: "443", label: "(Insert what the number is)" } } };
    // What a metric is there to make large: its figure (core.mjs emphasisOf, read where the engine weighs an arrangement).
    metric.emphasis = ({ props, width }) => figureEmphasis(props, width);
    // How a display figure's words break at a width (text-roles.mjs): its statement left with a widow counts against the arrangement.
    metric.setting = ({ props, width }) => { if (props.variant !== "display") return null; const texts = metricTexts(props, width - 2 * (props.tone === "hero" ? 0 : v("space.3"))); return settingOfAll([texts.label, texts.sub, texts.delta]); };
    metric.measureContent = ({ frame, props }) => ({ height: Math.ceil(metricHeight(frame.width, props)) });
    metric.resolveVariant = (props = {}) => ["dark", "hero", "ink", "rule", "ring"].includes(props.tone) ? props.tone : props.variant ?? "default";
  }
  return registry;
}
