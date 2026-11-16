import {
  cardFill,
  ellipsePrimitive,
  portraitPrimitive,
  rectPrimitive,
  shapePrimitive,
  stableId,
  token,
  tokenValue
} from "./core.mjs";
import { setText, drawText, TEXT_ROLE_TOKENS } from "./text-roles.mjs";

const SURFACE = token("color.surface");
const MUTED = token("color.surfaceMuted");
const INK = token("color.ink");
const SECONDARY = token("color.textSecondary");
const PRIMARY = token("color.componentPrimary");
const RULE = token("color.rule");
const BODY_FONT = token("font.body");
const DISPLAY_FONT = token("font.display");
const HAIRLINE = token("line.hairline");
const STANDARD = token("line.standard");
const SMALL = token("radius.small");
const ROUND = token("radius.round");

export const QUOTE_CLUSTER_TOKENS = Object.freeze([
  "color.canvas", "color.surface", "color.surfaceMuted", "color.surfaceTint", "color.ink",
  "color.textSecondary", "color.componentPrimary", "color.rule", "color.positive", "color.negative", "color.chartComparator",
  "font.body", "font.display", "type.deckTitle", "type.sectionTitle", "type.quoteMark", "type.quoteMarkHero", "type.heading",
  "type.body", "type.compact", "type.label", "type.source", "space.1",
  "space.2", "space.3", "space.4", "space.5", "space.6", "space.8",
  "line.hairline", "line.standard", "radius.small", "radius.round"
]);

const exampleQuotes = count => Array.from({ length: count }, (_, index) => ({
  quote: `(Insert approved quotation ${index + 1}.)`,
  attribution: `(Insert attribution ${index + 1})`,
  detail: `(Insert role ${index + 1})`
}));
const speechQuotes = count => exampleQuotes(count).map(({ detail, ...item }) => item);

export const QUOTE_CLUSTER_VARIANTS = Object.freeze({
  "one-contained-grid-full": { props: { quotes: exampleQuotes(1), treatment: "contained", placement: "full-field", arrangement: "grid", attributionAlign: "right" } },
  "one-callout-grid-full-below-center": { props: { quotes: exampleQuotes(1), treatment: "callout", placement: "full-field", arrangement: "grid", attributionPlacement: "below-center", attributionAlign: "center" } },
  "one-callout-grid-full-below-left": { props: { quotes: exampleQuotes(1), treatment: "callout", placement: "full-field", arrangement: "grid", attributionPlacement: "below-left", attributionAlign: "left" } },
  "one-speech-bubble-grid-full": { props: { quotes: speechQuotes(1), treatment: "speech-bubble", placement: "full-field", arrangement: "grid", attributionAlign: "left" } },
  "two-callout-grid-full-below-center": { props: { quotes: exampleQuotes(2), treatment: "callout", placement: "full-field", arrangement: "grid", attributionPlacement: "below-center", attributionAlign: "center" } },
  "two-contained-grid-section": { props: { quotes: exampleQuotes(2), treatment: "contained", placement: "section", arrangement: "grid", attributionAlign: "right" }, preferredSize: { width: 560, height: 460 } },
  "three-contained-grid-full": { props: { quotes: exampleQuotes(3), treatment: "contained", placement: "full-field", arrangement: "grid", attributionAlign: "right" } },
  "three-speech-bubble-staggered-full": { props: { quotes: speechQuotes(3), treatment: "speech-bubble", placement: "full-field", arrangement: "staggered", attributionAlign: "left" } },
  "four-callout-grid-full-below-left": { props: { quotes: exampleQuotes(4), treatment: "callout", placement: "full-field", arrangement: "grid", attributionPlacement: "below-left", attributionAlign: "left" } },
  "five-contained-grid-full": { props: { quotes: exampleQuotes(5), treatment: "contained", placement: "full-field", arrangement: "grid", attributionAlign: "right" } },
  "five-contained-grid-full-avatar": { props: { quotes: exampleQuotes(5).map((item, index) => ({ ...item, avatarText: String(index + 1) })), treatment: "contained", placement: "full-field", arrangement: "grid", avatar: true, attributionAlign: "left" } }
});

function settings(props = {}) {
  const treatment = props.treatment ?? "speech-bubble";
  const placement = props.placement ?? "full-field";
  const arrangement = props.arrangement ?? (treatment === "speech-bubble" && (props.quotes?.length ?? 0) === 3 ? "staggered" : "grid");
  const avatar = props.avatar === true;
  // A portrait large enough to recognise: 24px (the default) is a marker; a voice page that is about who said it sets 40 to 72.
  if (props.avatarSize !== undefined && !(Number.isFinite(props.avatarSize) && props.avatarSize >= 24 && props.avatarSize <= 72)) throw new Error("avatarSize is the portrait's diameter in px, 24 to 72");
  if (props.avatarSize !== undefined && !avatar) throw new Error("avatarSize sizes the portraits `avatar: true` draws; set avatar, or drop avatarSize");
  const attributionPlacement = props.attributionPlacement ?? (avatar || treatment === "callout" && props.attributionAlign === "left" ? "below-left" : treatment === "callout" ? "below-center" : "inside");
  const attributionAlign = props.attributionAlign ?? (attributionPlacement === "below-left" || treatment === "speech-bubble" ? "left" : treatment === "contained" ? "right" : "center");
  if (!["contained", "callout", "speech-bubble"].includes(treatment)) throw new Error(`Unknown quote-cluster treatment: ${treatment}`);
  if (!["full-field", "section"].includes(placement)) throw new Error(`Unknown quote-cluster placement: ${placement}`);
  if (!["grid", "staggered"].includes(arrangement)) throw new Error(`Unknown quote-cluster arrangement: ${arrangement}`);
  if (!["inside", "below-center", "below-left"].includes(attributionPlacement)) throw new Error(`Unknown quote-cluster attribution placement: ${attributionPlacement}`);
  if (!["left", "center", "right"].includes(attributionAlign)) throw new Error(`Unknown quote-cluster attribution alignment: ${attributionAlign}`);
  if (treatment === "callout" && attributionPlacement === "inside") throw new Error("Callout quote attribution must sit below the box");
  if (treatment !== "callout" && !avatar && attributionPlacement !== "inside") throw new Error("Only callout or profile quotes place attribution outside the box");
  if (avatar && attributionPlacement !== "below-left") throw new Error("Profile quote attribution must sit below-left of the box");
  if (attributionPlacement === "below-center" && attributionAlign !== "center") throw new Error("Centered callout attribution must use centered alignment");
  if (attributionPlacement === "below-left" && attributionAlign !== "left") throw new Error("Left callout attribution must use left alignment");
  if (arrangement === "staggered" && (placement !== "full-field" || treatment !== "speech-bubble")) throw new Error("Staggered quote clusters require full-field speech-bubble treatment");
  return { treatment, placement, arrangement, attributionPlacement, attributionAlign, avatar: props.avatar === true, avatarSize: props.avatarSize ?? tokenValue(token("space.5")) };
}

// A voice for or against, as a survey's verbatims are sorted: its quotation marks and a strip at its left in the verdict's
// colour - a verdict being what the status colours are kept for - the words in ink.
const QUOTE_TONES = Object.freeze({ positive: token("color.positive"), negative: token("color.negative"), neutral: token("color.chartComparator") });

function items(props = {}) {
  const raw = Array.isArray(props.quotes)
    ? props.quotes
    : (props.quote ? [{ quote: props.quote, attribution: props.attribution, detail: props.detail, avatarText: props.avatarText, portrait: props.portrait }] : []);
  if (raw.length < 1 || raw.length > 5) throw new Error("Quote cluster requires one to five quotes");
  const normalized = raw.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Quote ${index + 1} must be an object`);
    const stringField = (value, name) => {
      if (value !== undefined && typeof value !== "string") throw new Error(`Quote ${index + 1} ${name} must be text`);
      return (value ?? "").trim();
    };
    const quote = stringField(item.quote ?? item.text, "quotation");
    const attribution = stringField(item.attribution, "attribution");
    const detail = stringField(item.detail, "subtitle");
    if (!quote || !attribution) throw new Error(`Quote ${index + 1} requires exact quote text and attribution`);
    const avatarText = stringField(item.avatarText, "initials");
    if (Array.from(avatarText).length > 3) throw new Error("Quote initials must contain at most three characters");
    if (item.tone !== undefined && !Object.hasOwn(QUOTE_TONES, item.tone)) throw new Error(`Quote ${index + 1} tone is ${Object.keys(QUOTE_TONES).map((t) => `"${t}"`).join(", ")}: a voice for, against or neither`);
    return { quote, attribution, detail, avatarText, portrait: item.portrait, tone: item.tone };
  });
  return normalized;
}

export function resolveQuoteClusterVariant(props = {}) {
  const quoteItems = items(props);
  const { treatment, placement, arrangement, attributionPlacement, attributionAlign } = settings({ ...props, quotes: quoteItems });
  const count = ["zero", "one", "two", "three", "four", "five"][quoteItems.length];
  const outside = treatment === "callout" ? `-${attributionPlacement}` : "";
  const defaultAlign = props.avatar === true || treatment === "speech-bubble" || attributionPlacement === "below-left" ? "left" : treatment === "contained" ? "right" : "center";
  const alignment = attributionAlign === defaultAlign ? "" : `-align-${attributionAlign}`;
  return `${count}-${treatment}-${arrangement}-${placement === "section" ? "section" : "full"}${outside}${props.avatar === true ? "-avatar" : ""}${alignment}`;
}

// Every text in the cluster is set in its role (text-roles.mjs) and drawn as it was measured. The quotations are the
// page's content: body text at their reading measure, set larger where the cluster is few - a lone quotation as a pull
// quote, two or a row of speech bubbles in heading type - and never below body. Who said each is its byline and the
// detail under it its source line (furniture, read as a tag); the quotation marks and an avatar's initials are marks.
const quoteSize = (count, placement, treatment) => (placement === "section" ? "type.body" : count === 1 ? "type.sectionTitle" : count === 2 || treatment === "speech-bubble" ? "type.heading" : "type.body");
const markSizeOf = (count) => (count === 1 ? "type.quoteMarkHero" : count <= 2 ? "type.quoteMark" : "type.deckTitle");
const markFrameOf = (count) => (count === 1 ? { width: 96, height: 116 } : count <= 2 ? { width: 66, height: 76 } : { width: 50, height: 58 });

function gridFrames(frame, count, placement, arrangement, needs = []) {
  const gap = tokenValue(token("space.4"));
  // A box in a row of three or fewer takes the height its quotation needs, from the row's usual height up to the frame's;
  // the other arrangements share the frame between their boxes, and a quotation too long for its share is refused.
  const grown = (usual) => Math.min(frame.height, Math.max(usual, ...needs));
  if (count === 1) {
    const width = placement === "section" ? frame.width : Math.min(frame.width, 980);
    const height = grown(Math.min(frame.height, placement === "section" ? 320 : 440));
    return [{ x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height }];
  }
  if (count === 2 && placement === "section") {
    const height = (frame.height - gap) / 2;
    return [0, 1].map(index => ({ x: frame.x, y: frame.y + index * (height + gap), width: frame.width, height }));
  }
  if (count === 3 && arrangement === "staggered") {
    const height = (frame.height - 2 * gap) / 3;
    const width = frame.width * 0.62;
    return [
      { x: frame.x, y: frame.y, width, height },
      { x: frame.x + frame.width - width, y: frame.y + height + gap, width, height },
      { x: frame.x + frame.width * 0.12, y: frame.y + 2 * (height + gap), width, height }
    ];
  }
  if (count <= 3) {
    const width = (frame.width - (count - 1) * gap) / count;
    const height = grown(Math.min(frame.height, 300));
    return Array.from({ length: count }, (_, index) => ({ x: frame.x + index * (width + gap), y: frame.y + (frame.height - height) / 2, width, height }));
  }
  const height = (frame.height - gap) / 2;
  if (count === 4) {
    const width = (frame.width - gap) / 2;
    return Array.from({ length: 4 }, (_, index) => ({ x: frame.x + (index % 2) * (width + gap), y: frame.y + Math.floor(index / 2) * (height + gap), width, height }));
  }
  const width = (frame.width - 2 * gap) / 3;
  return Array.from({ length: 5 }, (_, index) => {
    const top = index < 3;
    const column = top ? index : index - 3;
    return {
      x: frame.x + (top ? column * (width + gap) : width / 2 + column * (width + gap)),
      y: frame.y + (top ? 0 : height + gap),
      width,
      height
    };
  });
}

function outsideAttributionHeight(count, attribution) {
  return Math.max(count === 1 ? 92 : tokenValue(token("space.8")) + tokenValue(token("space.3")), attribution + tokenValue(token("space.5")) + tokenValue(token("space.2")));
}

/** The attribution block's height: the old rhythm's (56px for one quote, `space.6` for more), or what its byline and source line take. */
function attributionHeight(count, attribution = 0) {
  return Math.max(count === 1 ? 56 : tokenValue(token("space.6")), attribution);
}

function surfaceHeight(frame, treatment, count, avatar = false, avatarSize = 0, attribution = 0) {
  return frame.height - (treatment === "callout" ? outsideAttributionHeight(count, attribution) : avatar ? Math.max(attributionHeight(count, attribution), avatarSize) + tokenValue(token("space.4")) : 0);
}

function calloutCaretCenter(frame, attributionPlacement) {
  if (attributionPlacement === "below-center") return frame.x + frame.width / 2;
  return frame.x + Math.max(tokenValue(token("space.6")), Math.min(frame.width * 0.22, 180));
}

// A quotation's box is a card (core.mjs cardFill): under the reference weight
// it is the filled surface with no outline, as a pillar card is. A muted grey
// box with a hairline is 15 grey levels off white - four of them make a page
// that reads as empty with type on it.

function surfaceNodes(id, frame, count, treatment, attributionPlacement, data, avatar, avatarSize, attribution) {
  const bodyFrame = { ...frame, height: surfaceHeight(frame, treatment, count, avatar, avatarSize, attribution) };
  if (treatment === "speech-bubble") return [shapePrimitive({
    id: stableId(id, "surface"), role: "quote-surface", geometry: "snip1Rect", frame: bodyFrame,
    style: { ...cardFill(SURFACE, RULE), lineWidth: STANDARD, flipV: true }, data
  })];
  if (treatment === "callout") {
    const bodyHeight = bodyFrame.height;
    const caret = count === 1 ? tokenValue(token("space.5")) : tokenValue(token("space.3"));
    const caretCenter = calloutCaretCenter(frame, attributionPlacement);
    const totalHeight = bodyHeight + caret;
    return [shapePrimitive({
      id: stableId(id, "surface"), role: "quote-surface", geometry: "quoteCallout",
      frame: { ...frame, height: totalHeight },
      style: { ...cardFill(SURFACE, RULE), lineWidth: HAIRLINE },
      data: {
        ...data,
        bodyRatio: bodyHeight / totalHeight,
        caretCenterRatio: (caretCenter - frame.x) / frame.width,
        caretWidthRatio: caret / frame.width,
        cornerRadiusRatio: Math.min(tokenValue(SMALL), bodyHeight / 4) / Math.min(frame.width, totalHeight)
      }
    })];
  }
  return [rectPrimitive({ id: stableId(id, "surface"), role: "quote-surface", frame: bodyFrame, style: { ...cardFill(MUTED, RULE), lineWidth: HAIRLINE, radius: SMALL }, data })];
}

/** Where a box's text runs: the attribution's column, and the quotation's (inside the marks). */
function columnsOf(frame, count, treatment, attributionPlacement, avatar, avatarSize, item) {
  const inset = tokenValue(token("space.4")), outside = attributionPlacement !== "inside";
  const showAvatar = avatar && Boolean(item.portrait || item.avatarText);
  const contentX = frame.x + inset + (showAvatar ? avatarSize + tokenValue(token("space.2")) : 0);
  // Keep the entire caption frame outside the lower-right snip, even for long names.
  const snipInset = treatment === "speech-bubble" && !outside ? frame.width * 0.12 : 0;
  const mark = markFrameOf(count);
  const bodyX = frame.x + inset + mark.width + tokenValue(token("space.2"));
  const bodyRightInset = treatment === "speech-bubble" ? inset : inset + mark.width + tokenValue(token("space.2"));
  return { inset, showAvatar, contentX, contentWidth: frame.x + frame.width - inset - snipInset - contentX, bodyX, bodyWidth: frame.x + frame.width - bodyRightInset - bodyX };
}

/** A quotation's byline and source line set in the attribution's column. */
function attributionSets(item, count, width) {
  const name = setText("byline", item.attribution, width, { size: count === 1 ? "type.body" : "type.label" });
  const detail = item.detail ? setText("source", item.detail, width, { size: count === 1 ? "type.label" : "type.source" }) : null;
  return { name, detail, height: name.height + (detail?.height ?? 0) };
}

/**
 * The height a quotation's box needs at its width: the mark over the quotation, the quotation as set, and under it the
 * attribution (inside the box) or the box's padding (an attribution set below the box).
 */
function quoteNeed(frameWidth, item, ctx, body) {
  const { count, treatment, attributionPlacement, avatar, avatarSize, attribution } = ctx;
  const inset = tokenValue(token("space.4")), mark = markFrameOf(count);
  const bodyTop = tokenValue(token("space.2")) + mark.height - tokenValue(token("space.1"));
  const attributionBlock = Math.max(attributionHeight(count, attribution), avatar ? avatarSize : 0);
  const under = attributionPlacement === "inside" ? Math.max(attributionBlock + tokenValue(token("space.2")) + tokenValue(token(treatment === "speech-bubble" ? "space.1" : "space.3")), inset) : inset;
  const surface = bodyTop + body.height + under;
  return surface + (treatment === "callout" ? outsideAttributionHeight(count, attribution) : avatar ? Math.max(attributionHeight(count, attribution), avatarSize) + tokenValue(token("space.4")) : 0);
}

function attributionNodes({ id, frame, item, count, treatment, attributionPlacement, align, avatar, avatarSize: size, attribution, data }) {
  const outside = attributionPlacement !== "inside";
  const height = Math.max(attributionHeight(count, attribution), avatar ? size : 0);
  const caret = treatment === "callout" ? (count === 1 ? tokenValue(token("space.5")) : tokenValue(token("space.3"))) : tokenValue(token("space.2"));
  const surfaceBottom = frame.y + surfaceHeight(frame, treatment, count, avatar, size, attribution);
  const y = outside ? surfaceBottom + caret + tokenValue(token("space.1")) : surfaceBottom - height - tokenValue(token("space.2"));
  const columns = columnsOf(frame, count, treatment, attributionPlacement, avatar, size, item);
  const avatarSize = columns.showAvatar ? size : 0;
  const nodes = [];
  if (columns.showAvatar) {
    const avatarFrame = { x: frame.x + columns.inset, y, width: avatarSize, height: avatarSize };
    nodes.push(item.portrait ? portraitPrimitive({ id: stableId(id, "avatar"), frame: avatarFrame, portrait: item.portrait, data }) : ellipsePrimitive({ id: stableId(id, "avatar"), role: "quote-avatar", frame: avatarFrame, style: { fill: MUTED, stroke: RULE, lineWidth: HAIRLINE, radius: ROUND }, data }));
    if (item.avatarText && !item.portrait) {
      const initials = setText("mark", item.avatarText, avatarSize, { size: avatarSize >= 40 ? "type.body" : "type.label" });
      nodes.push(drawText(stableId(id, "avatar-label"), "quote-avatar-label", { x: avatarFrame.x, y: avatarFrame.y + (avatarSize - initials.height) / 2, width: avatarSize }, initials, { color: INK, align: "center", data }));
    }
  }
  const sets = attributionSets(item, count, columns.contentWidth);
  const column = { x: columns.contentX, width: columns.contentWidth };
  nodes.push(drawText(stableId(id, "attribution"), "quote-attribution", { ...column, y }, sets.name, { color: INK, align, data }));
  if (sets.detail) nodes.push(drawText(stableId(id, "detail"), "quote-detail", { ...column, y: y + sets.name.height }, sets.detail, { color: SECONDARY, align, data }));
  return nodes;
}

function quoteItemNodes({ id, frame, item, index, count, treatment, placement, attributionPlacement, attributionAlign, avatar, avatarSize, attribution, body }) {
  const data = { quoteIndex: index, treatment, attributionPlacement, ...(item.tone ? { tone: item.tone } : {}) };
  const nodes = [...surfaceNodes(id, frame, count, treatment, attributionPlacement, data, avatar, avatarSize, attribution)];
  const surfaceBottom = frame.y + surfaceHeight(frame, treatment, count, avatar, avatarSize, attribution);
  const markColor = item.tone ? QUOTE_TONES[item.tone] : PRIMARY;
  if (item.tone) nodes.push(rectPrimitive({ id: stableId(id, "tone"), role: "quote-tone", frame: { x: frame.x, y: frame.y, width: 4, height: surfaceBottom - frame.y }, style: { fill: markColor, stroke: "none", lineWidth: HAIRLINE }, data }));
  const inset = tokenValue(token("space.4"));
  const markFrame = markFrameOf(count), markY = frame.y + tokenValue(token("space.2"));
  const mark = (glyph) => setText("mark", glyph, markFrame.width, { size: markSizeOf(count), face: "font.display" });
  const open = mark("“");
  nodes.push(drawText(stableId(id, "mark-open"), "quote-mark", { x: frame.x + inset, y: markY, width: markFrame.width }, open, { color: markColor, data }));
  const attributionBlockHeight = Math.max(attributionHeight(count, attribution), avatar ? avatarSize : 0);
  const caret = count === 1 ? tokenValue(token("space.5")) : tokenValue(token("space.3"));
  const attributionTop = attributionPlacement === "inside" ? surfaceBottom - attributionBlockHeight - tokenValue(token("space.2")) : surfaceBottom + caret + tokenValue(token("space.1"));
  const closeY = attributionPlacement !== "inside" ? surfaceBottom - inset - markFrame.height : attributionTop - tokenValue(token("space.2")) - markFrame.height;
  const columns = columnsOf(frame, count, treatment, attributionPlacement, avatar, avatarSize, item);
  const bodyTop = markY + markFrame.height - tokenValue(token("space.1"));
  nodes.push(drawText(stableId(id, "body"), "quote-body", { x: columns.bodyX, y: bodyTop, width: columns.bodyWidth }, body, { color: INK, data }));
  if (treatment !== "speech-bubble") {
    const close = mark("”");
    nodes.push(drawText(stableId(id, "mark-close"), "quote-mark", { x: frame.x + frame.width - inset - markFrame.width, y: closeY + markFrame.height - close.height, width: markFrame.width }, close, { color: markColor, align: "right", data }));
  }
  nodes.push(...attributionNodes({ id, frame, item, count, treatment, attributionPlacement, align: attributionAlign, avatar, avatarSize, attribution, data }));
  return nodes;
}

const opening = (quote) => { const words = quote.split(/\s+/); return words.length > 8 ? `${words.slice(0, 8).join(" ")}...` : quote; };

export function quoteClusterNodes({ id, frame, props }) {
  const quoteItems = items(props);
  const resolved = settings({ ...props, quotes: quoteItems });
  if (quoteItems.length > 3 && resolved.placement === "section") throw new Error("Four-up and five-up quote clusters require full-field placement");
  if (resolved.arrangement === "staggered" && quoteItems.length !== 3) throw new Error("The staggered quote arrangement requires exactly three quotes");
  const count = quoteItems.length;
  // The boxes' widths do not depend on their heights, so each quotation is measured at its box's width first and the
  // boxes are then sized to what they hold.
  const widths = gridFrames({ ...frame }, count, resolved.placement, resolved.arrangement).map((box) => box.width);
  const ctx = { count, treatment: resolved.treatment, attributionPlacement: resolved.attributionPlacement, avatar: resolved.avatar, avatarSize: resolved.avatarSize };
  const columns = quoteItems.map((item, index) => columnsOf({ x: 0, y: 0, width: widths[index], height: 0 }, count, ctx.treatment, ctx.attributionPlacement, ctx.avatar, ctx.avatarSize, item));
  ctx.attribution = Math.max(...quoteItems.map((item, index) => attributionSets(item, count, columns[index].contentWidth).height));
  const size = quoteSize(count, resolved.placement, resolved.treatment);
  const bodies = quoteItems.map((item, index) => {
    try { return setText("body", item.quote, columns[index].bodyWidth, { size }); }
    catch (error) { throw new Error(`Quote ${index + 1} ("${opening(item.quote)}"): ${error.message}`); }
  });
  const needs = quoteItems.map((item, index) => quoteNeed(widths[index], item, ctx, bodies[index]));
  const frames = gridFrames(frame, count, resolved.placement, resolved.arrangement, needs);
  const over = frames.findIndex((box, index) => needs[index] > box.height + 0.5);
  if (over >= 0) throw new Error(`Quote ${over + 1} ("${opening(quoteItems[over].quote)}") needs a box ${Math.ceil(needs[over])}px tall at ${Math.floor(frames[over].width)}px wide and has ${Math.floor(frames[over].height)}px - over by ${Math.ceil(needs[over] - frames[over].height)}px; shorten the quotation, use fewer quotes, or give the cluster more height`);
  return quoteItems.flatMap((item, index) => quoteItemNodes({ id: stableId(id, "quote", index + 1), frame: frames[index], item, index, count, treatment: resolved.treatment, placement: resolved.placement, attributionPlacement: resolved.attributionPlacement, attributionAlign: resolved.attributionAlign, avatar: resolved.avatar, avatarSize: resolved.avatarSize, attribution: ctx.attribution, body: bodies[index] }));
}

export function registerQuoteCluster(registry) {
  registry.set("quote-cluster", {
    id: "quote-cluster", sizing: "fill", version: "2.4.0", category: "section", role: "quote-cluster",
    tokens: [...new Set([...QUOTE_CLUSTER_TOKENS, ...TEXT_ROLE_TOKENS])], preferredSize: { width: 1160, height: 480 },
    sample: { quotes: speechQuotes(3), treatment: "speech-bubble", placement: "full-field", arrangement: "staggered", attributionAlign: "left" },
    variants: QUOTE_CLUSTER_VARIANTS,
    defaultVariant: "three-speech-bubble-staggered-full",
    resolveVariant: resolveQuoteClusterVariant,
    guidance: {
      useWhen: "one to five attributable voices prove, qualify or humanize one page-level claim",
      why: "a shared quote grammar keeps evidence comparable while count, placement and enclosure adapt to the source material",
      actionTitle: "state the pattern, contrast or decision consequence established across the quoted voices"
    },
    render: input => ({ nodes: quoteClusterNodes(input) })
  });
  return registry;
}
