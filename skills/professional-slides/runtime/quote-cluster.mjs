import {
  ellipsePrimitive,
  portraitPrimitive,
  rectPrimitive,
  shapePrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";

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
  "color.canvas", "color.surface", "color.surfaceMuted", "color.ink",
  "color.textSecondary", "color.componentPrimary", "color.rule",
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
  return { treatment, placement, arrangement, attributionPlacement, attributionAlign, avatar: props.avatar === true };
}

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
    return { quote, attribution, detail, avatarText, portrait: item.portrait };
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

function fitText({ id, role, frame, text, fontSize, color = INK, bold = false, align = "left", valign = "top", fontFamily = BODY_FONT, data = {} }) {
  const layout = measureText(text, frame.width, {
    fontFamily: tokenValue(fontFamily),
    fontSize: tokenValue(fontSize),
    bold,
    wrapWidthRatio: 1
  });
  if (layout.height > frame.height) throw new Error(`${id} exceeds its quote text frame; shorten the source excerpt or enlarge the cluster`);
  const y = frame.y + (valign === "mid" ? (frame.height - layout.height) / 2 : valign === "bottom" ? frame.height - layout.height : 0);
  return textPrimitive({
    id, role, frame: { ...frame, y, height: layout.height }, text: layout.text,
    style: { fontFamily, fontSize, color, bold, align, valign, lineHeight: layout.lineHeight, wrap: false },
    data: { ...data, textLayout: layout }
  });
}

function gridFrames(frame, count, placement, arrangement) {
  const gap = tokenValue(token("space.4"));
  if (count === 1) {
    const width = placement === "section" ? frame.width : Math.min(frame.width, 980);
    const height = Math.min(frame.height, placement === "section" ? 320 : 440);
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
    const height = Math.min(frame.height, 300);
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

function outsideAttributionHeight(count) {
  return count === 1 ? 92 : tokenValue(token("space.8")) + tokenValue(token("space.3"));
}

function attributionHeight(count) {
  return count === 1 ? 56 : tokenValue(token("space.6"));
}

function surfaceHeight(frame, treatment, count, avatar = false) {
  return frame.height - (treatment === "callout" ? outsideAttributionHeight(count) : avatar ? attributionHeight(count) + tokenValue(token("space.4")) : 0);
}

function calloutCaretCenter(frame, attributionPlacement) {
  if (attributionPlacement === "below-center") return frame.x + frame.width / 2;
  return frame.x + Math.max(tokenValue(token("space.6")), Math.min(frame.width * 0.22, 180));
}

function surfaceNodes(id, frame, count, treatment, attributionPlacement, data, avatar) {
  const bodyFrame = { ...frame, height: surfaceHeight(frame, treatment, count, avatar) };
  if (treatment === "speech-bubble") return [shapePrimitive({
    id: stableId(id, "surface"), role: "quote-surface", geometry: "snip1Rect", frame: bodyFrame,
    style: { fill: SURFACE, stroke: RULE, lineWidth: STANDARD, flipV: true }, data
  })];
  if (treatment === "callout") {
    const bodyHeight = surfaceHeight(frame, treatment, count);
    const caret = count === 1 ? tokenValue(token("space.5")) : tokenValue(token("space.3"));
    const caretCenter = calloutCaretCenter(frame, attributionPlacement);
    const totalHeight = bodyHeight + caret;
    return [shapePrimitive({
      id: stableId(id, "surface"), role: "quote-surface", geometry: "quoteCallout",
      frame: { ...frame, height: totalHeight },
      style: { fill: SURFACE, stroke: RULE, lineWidth: HAIRLINE },
      data: {
        ...data,
        bodyRatio: bodyHeight / totalHeight,
        caretCenterRatio: (caretCenter - frame.x) / frame.width,
        caretWidthRatio: caret / frame.width,
        cornerRadiusRatio: Math.min(tokenValue(SMALL), bodyHeight / 4) / Math.min(frame.width, totalHeight)
      }
    })];
  }
  return [rectPrimitive({ id: stableId(id, "surface"), role: "quote-surface", frame: bodyFrame, style: { fill: MUTED, stroke: RULE, lineWidth: HAIRLINE, radius: SMALL }, data })];
}

function attributionNodes({ id, frame, item, count, treatment, attributionPlacement, align, avatar, data }) {
  const outside = attributionPlacement !== "inside";
  const height = attributionHeight(count);
  const caret = treatment === "callout" ? (count === 1 ? tokenValue(token("space.5")) : tokenValue(token("space.3"))) : tokenValue(token("space.2"));
  const surfaceBottom = frame.y + surfaceHeight(frame, treatment, count, avatar);
  const y = outside ? surfaceBottom + caret + tokenValue(token("space.1")) : surfaceBottom - height - tokenValue(token("space.2"));
  const inset = tokenValue(token("space.4"));
  const showAvatar = avatar && Boolean(item.portrait || item.avatarText);
  const avatarSize = showAvatar ? tokenValue(token("space.5")) : 0;
  const gap = showAvatar ? tokenValue(token("space.2")) : 0;
  const leftBase = frame.x + inset;
  const contentX = leftBase + avatarSize + gap;
  // Keep the entire caption frame outside the lower-right snip, even for long names.
  const snipInset = treatment === "speech-bubble" && !outside ? frame.width * 0.12 : 0;
  const contentWidth = frame.x + frame.width - inset - snipInset - contentX;
  const nodes = [];
  if (showAvatar) {
    const avatarFrame = { x: leftBase, y, width: avatarSize, height: avatarSize };
    nodes.push(item.portrait ? portraitPrimitive({ id: stableId(id, "avatar"), frame: avatarFrame, portrait: item.portrait, data }) : ellipsePrimitive({ id: stableId(id, "avatar"), role: "quote-avatar", frame: avatarFrame, style: { fill: MUTED, stroke: RULE, lineWidth: HAIRLINE, radius: ROUND }, data }));
    if (item.avatarText && !item.portrait) nodes.push(fitText({
      id: stableId(id, "avatar-label"), role: "quote-avatar-label", frame: avatarFrame, text: item.avatarText,
      fontSize: token("type.label"), color: INK, bold: true, align: "center", valign: "mid",
      data
    }));
  }
  const nameHeight = count === 1 && item.detail ? 32 : item.detail ? height / 2 : height;
  const detailHeight = height - nameHeight;
  const attributionFrame = { x: contentX, y, width: contentWidth, height: nameHeight };
  nodes.push(fitText({ id: stableId(id, "attribution"), role: "quote-attribution", frame: attributionFrame, text: item.attribution, fontSize: count === 1 ? token("type.body") : token("type.label"), color: INK, bold: true, align, valign: "top", data }));
  if (item.detail) nodes.push(fitText({ id: stableId(id, "detail"), role: "quote-detail", frame: { x: contentX, y: y + nameHeight, width: contentWidth, height: detailHeight }, text: item.detail, fontSize: count === 1 ? token("type.label") : token("type.source"), color: SECONDARY, align, valign: "top", data }));
  return nodes;
}

function quoteItemNodes({ id, frame, item, index, count, treatment, placement, attributionPlacement, attributionAlign, avatar }) {
  const data = { quoteIndex: index, treatment, attributionPlacement };
  const nodes = [...surfaceNodes(id, frame, count, treatment, attributionPlacement, data, avatar)];
  const inset = tokenValue(token("space.4"));
  const speechBubble = treatment === "speech-bubble";
  const markSize = count === 1 ? token("type.quoteMarkHero") : count <= 2 ? token("type.quoteMark") : token("type.deckTitle");
  const markFrame = count === 1 ? { width: 96, height: 116 } : count <= 2 ? { width: 66, height: 76 } : { width: 50, height: 58 };
  const markY = frame.y + tokenValue(token("space.2"));
  nodes.push(textPrimitive({ id: stableId(id, "mark-open"), role: "quote-mark", frame: { x: frame.x + inset, y: markY, ...markFrame }, text: "“", style: { fontFamily: DISPLAY_FONT, fontSize: markSize, color: PRIMARY, bold: true, align: "left", valign: "top" }, data }));
  const attributionBlockHeight = attributionHeight(count);
  const surfaceBottom = frame.y + surfaceHeight(frame, treatment, count, avatar);
  const caret = count === 1 ? tokenValue(token("space.5")) : tokenValue(token("space.3"));
  const attributionTop = attributionPlacement === "inside" ? surfaceBottom - attributionBlockHeight - tokenValue(token("space.2")) : surfaceBottom + caret + tokenValue(token("space.1"));
  const closeY = attributionPlacement !== "inside" ? surfaceBottom - inset - markFrame.height : attributionTop - tokenValue(token("space.2")) - markFrame.height;
  const bodyX = frame.x + inset + markFrame.width + tokenValue(token("space.2"));
  const bodyRightInset = treatment === "speech-bubble" ? inset : inset + markFrame.width + tokenValue(token("space.2"));
  const bodyTop = markY + markFrame.height - tokenValue(token("space.1"));
  const bodyBottom = Math.min(attributionTop - tokenValue(token(speechBubble ? "space.1" : "space.3")), surfaceBottom - inset);
  const bodyFont = placement === "section" ? token("type.compact") : count === 1 ? token("type.sectionTitle") : count === 2 || speechBubble ? token("type.heading") : count === 3 ? token("type.body") : token("type.compact");
  nodes.push(fitText({
    id: stableId(id, "body"), role: "quote-body",
    frame: { x: bodyX, y: bodyTop, width: frame.x + frame.width - bodyRightInset - bodyX, height: Math.max(1, bodyBottom - bodyTop) },
    text: item.quote, fontSize: bodyFont, color: INK,
    bold: false, align: "left", valign: "top", data
  }));
  if (treatment !== "speech-bubble") nodes.push(textPrimitive({ id: stableId(id, "mark-close"), role: "quote-mark", frame: { x: frame.x + frame.width - inset - markFrame.width, y: closeY, ...markFrame }, text: "”", style: { fontFamily: DISPLAY_FONT, fontSize: markSize, color: PRIMARY, bold: true, align: "right", valign: "bottom" }, data }));
  nodes.push(...attributionNodes({ id, frame, item, count, treatment, attributionPlacement, align: attributionAlign, avatar, data }));
  return nodes;
}

export function quoteClusterNodes({ id, frame, props }) {
  const quoteItems = items(props);
  const resolved = settings({ ...props, quotes: quoteItems });
  if (quoteItems.length > 3 && resolved.placement === "section") throw new Error("Four-up and five-up quote clusters require full-field placement");
  if (resolved.arrangement === "staggered" && quoteItems.length !== 3) throw new Error("The staggered quote arrangement requires exactly three quotes");
  const frames = gridFrames(frame, quoteItems.length, resolved.placement, resolved.arrangement);
  return quoteItems.flatMap((item, index) => quoteItemNodes({ id: stableId(id, "quote", index + 1), frame: frames[index], item, index, count: quoteItems.length, treatment: resolved.treatment, placement: resolved.placement, attributionPlacement: resolved.attributionPlacement, attributionAlign: resolved.attributionAlign, avatar: resolved.avatar }));
}

export function registerQuoteCluster(registry) {
  registry.set("quote-cluster", {
    id: "quote-cluster", version: "2.3.0", category: "section", role: "quote-cluster",
    tokens: [...QUOTE_CLUSTER_TOKENS], preferredSize: { width: 1160, height: 480 },
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
