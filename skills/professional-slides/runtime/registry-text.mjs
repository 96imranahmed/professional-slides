// The text blocks: the paragraph, the bullet list, the insight box, the
// callout, the evidence note and the panel, with the measures the composer
// sizes prose and lists by (`proseMeasure`, `measureProse`, `measureCaption`,
// `measureInsight`, `measureList`).
import { tokenValue, token, rectPrimitive, stableId, textPrimitive, ellipsePrimitive, shapePrimitive, emphasisRuns, houseStyle, TOKENS, onFill } from "./core.mjs";
import { measureText, accentRuns, measureTextRuns } from "./text-layout.mjs";
import { markerSize, numberMarker, iconMarker, stateMarker, MARK_TOKENS } from "./marks.mjs";
import { measuredTextNode } from "./text-style.mjs";
import { BODY, FONT, COMPACT, DISPLAY, INK, SURFACE, HAIRLINE, textStyle, boxStyle, PRIMARY, PRIMARY_TINT, MUTED_SURFACE, RULE, WHITE,
  SMALL_RADIUS, openLine, SECONDARY, component, simpleList, refineVariantAxes } from "./registry-shared.mjs";

/** Body copy never runs wider than ≈ 80 characters (item 6, measure cap). */
function paragraphMeasure(frameWidth, props = {}) {
  if (props.maxMeasure === false) return frameWidth;
  return Math.min(frameWidth, Math.round(tokenValue(BODY) * 96 / 72 * 0.47 * 80));
}

/**
 * Prose as a paragraph sets it: the widest line a paragraph runs to (the
 * measure cap), the narrowest a column of prose should be (45 characters),
 * and the height `text` takes at `width`. The composer sizes a column of
 * prose with these rather than handing it a track: a paragraph in a track
 * wider than the cap stops short of the track's right edge, and the rest of
 * the track is a strip of nothing down the page.
 */
export const proseMeasure = () => ({ widest: paragraphMeasure(Infinity), narrowest: Math.round(tokenValue(BODY) * 96 / 72 * 0.47 * 45) });
/** A panel caption's height at a width: compact, the panel's full width (paragraph variant "caption"). */
export const measureCaption = (text, width) => measureText(text, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(COMPACT), bold: false }).height;
export const measureProse = (text, width) => measureText(text, paragraphMeasure(width), { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY), bold: false }).height;

/**
 * The runs a paragraph is set in: its own `runs` where it was given them, else
 * its `lead` in bold and its `highlight` - the page's phrase or its point's -
 * in the accent, where the text says them. The composer only says which; the
 * paragraph cuts the runs, so a paragraph built anywhere on a page takes its
 * emphasis the same way. A lead the page also highlights keeps the accent.
 */
function paragraphRuns({ text, runs, lead, highlight }) {
  if (runs) return runs;
  const phrases = [highlight ?? []].flat().filter((phrase) => typeof phrase === "string");
  if (!lead && !phrases.length) return null;
  const lit = (phrase) => phrases.some((p) => p.toLowerCase() === phrase.toLowerCase());
  return accentRuns(text, [...(lead ? [lead] : []), ...phrases], { strict: false })
    ?.map((run, at) => (lead && at === 0 && run.text === lead && !lit(lead) ? { text: run.text, bold: true } : run)) ?? null;
}

function insightLayout(frame, props) {
  // `items`: the closing block as two or three square-bulleted findings on the
  // band rather than one sentence running across it. A strong deck closes
  // a dense table this way - each line carries its own finding, and the reader
  // can take them one at a time.
  const list = Array.isArray(props.items) ? props.items.map((item) => String(item ?? "").trim()).filter(Boolean) : null;
  if (list && !list.length) throw new Error("Insight items need nonempty text");
  if (!list && (typeof props.text !== "string" || !props.text.trim())) throw new Error("Insight requires a nonempty synthesis sentence");
  if (props.align !== undefined && !["left", "center"].includes(props.align)) throw new Error("Insight alignment must be left or center");
  // A takeaway band: 16 px side padding, 12 px above and below one or two lines
  // of semibold body text, left-aligned (the gallery's grey band). The primary
  // variant carries a chevron disc at the left and reserves its width.
  // `plain` is the statement with no box around it: the label that sits above a
  // boxed takeaway. With no surface there is nothing to inset it from, so it
  // sits flush with the column and keeps only the reading gap under it.
  // `rule` (the editorial and journal close) is the statement under a hairline
  // with no box; `statement` (the keynote close) sets it a size larger beside
  // an accent bar. Both are open: nothing to inset the text from.
  const plain = ["plain", "rule", "statement"].includes(props.variant);
  const paddingX = plain ? 0 : tokenValue(token("space.4"));
  const paddingY = props.variant === "rule" ? tokenValue(token("space.3")) : plain ? tokenValue(token("space.2")) : tokenValue(token(!list && props.text.includes("\n\n") ? "space.5" : "space.3"));
  const bar = props.variant === "statement" ? 5 : 0;
  const marker = bar || ((props.variant ?? "tonal") === "primary" || props.marker === "chevron" ? tokenValue(token("icon.medium")) : 0);
  const markerGap = marker ? tokenValue(token("space.3")) : 0;
  const bodySize = props.variant === "statement" ? token("type.heading") : BODY;
  const width = frame.width - 2 * paddingX - marker - markerGap;
  if (width <= 0) throw new Error("Insight width cannot contain its theme padding; give the insight a wider frame");
  const options = { fontFamily: tokenValue(FONT) };
  const heading = props.heading ? measureText(props.heading, width, { ...options, fontSize: tokenValue(token("type.heading")), bold: true }) : null;
  const gap = heading ? tokenValue(token("space.2")) : 0;
  if (list) {
    const bulletGap = tokenValue(token("space.3"));
    const indent = tokenValue(token("space.4"));
    const rowGap = tokenValue(token("space.2"));
    const lines = list.map((text) => measureText(text, width - indent, { ...options, fontSize: tokenValue(BODY), bold: true }));
    const listHeight = lines.reduce((sum, line) => sum + line.height, 0) + rowGap * (lines.length - 1);
    const contentHeight = listHeight + (heading?.height ?? 0) + gap;
    return { body: null, lines, indent, bulletGap, rowGap, heading, width, paddingX, paddingY, gap, marker, markerGap, contentHeight, height: Math.max(contentHeight, marker) + 2 * paddingY };
  }
  const body = measureText(props.text, width, { ...options, ...(props.variant === "rule" ? { fontFamily: tokenValue(DISPLAY) } : {}), fontSize: tokenValue(bodySize), bold: true });
  const contentHeight = body.height + (heading?.height ?? 0) + gap;
  return { body, bodySize, bar, lines: null, heading, width, paddingX, paddingY, gap, marker, markerGap, contentHeight, height: (bar ? contentHeight : Math.max(contentHeight, marker)) + 2 * paddingY };
}

/**
 * The height an insight box needs at a width, in its own face and padding.
 * The composer's row of captioned panels shares one caption height; measured
 * with this rather than an Arial-14 estimate it never under-allocates the box.
 */
export const measureInsight = (frame, props) => insightLayout(frame, props);

/**
 * The height a body points list needs at a width, in its own face, markers and
 * gaps. A side column is narrowed against this rather than an Arial-14
 * estimate, which puts four lines where the page sets three and stops the
 * column narrowing a fifth of the track short.
 */
export const measureList = (frame, props) => bodyListLayout(frame, props.items, props).height;

// A reading note: the cream box a consulting page carries top-right to say how
// to read it, or to flag a caveat. Compact type, hairline caution border.
function calloutLayout(frame, props) {
  if (typeof props.text !== "string" || !props.text.trim()) throw new Error("Callout requires text");
  // `outline`: the insight box of the modern survey deck, an accent outline
  // with semibold accent copy at body size; otherwise a quiet cream note.
  const outline = props.tone === "outline";
  const paddingX = tokenValue(token(outline ? "space.4" : "space.3")), paddingY = tokenValue(token(outline ? "space.4" : "space.2"));
  const width = frame.width - 2 * paddingX;
  if (width <= 0) throw new Error("Callout has no text width; give the callout a wider frame");
  const options = { fontFamily: tokenValue(FONT), fontSize: tokenValue(outline ? BODY : COMPACT) };
  const lead = props.lead?.trim() ? measureText(props.lead, width, { ...options, bold: true }) : null;
  const body = measureText(props.text, width, { ...options, bold: outline });
  const gap = lead ? tokenValue(token("space.2")) / 2 : 0;
  return { lead, body, paddingX, paddingY, gap, outline, height: (lead?.height ?? 0) + gap + body.height + 2 * paddingY };
}

function calloutNodes({ id, frame, props }) {
  let layout = calloutLayout(frame, props);
  // As with the insight: a box a few pixels short closes its vertical padding
  // (to a 4px floor) instead of failing.
  if (layout.height > frame.height + 0.01) {
    const paddingY = layout.paddingY - (layout.height - frame.height) / 2;
    if (paddingY < tokenValue(token("space.1")) - 0.01) throw new Error(`Callout overflows its ${frame.height}px box by ${Math.ceil(layout.height - frame.height)}px; give it the space or shorten the note`);
    layout = { ...layout, paddingY, height: frame.height };
  }
  const height = layout.outline && props.fill ? frame.height : layout.height;
  const color = layout.outline ? token("color.accent") : INK;
  const nodes = [rectPrimitive({ id: stableId(id, "surface"), role: "callout-surface", frame: { ...frame, height }, style: layout.outline ? boxStyle(SURFACE, token("color.accent"), HAIRLINE, token("radius.none")) : boxStyle(token("color.calloutTint"), props.tone === "caution" ? token("color.caution") : "none", HAIRLINE, token("radius.none")) })];
  let y = frame.y + layout.paddingY;
  if (layout.lead) {
    nodes.push(
      textPrimitive({
        id: stableId(id, "lead"),
        role: "callout-lead",
        frame: { x: frame.x + layout.paddingX, y, width: frame.width - 2 * layout.paddingX, height: layout.lead.height },
        text: layout.lead.text,
        style: {
          ...textStyle(layout.outline ? BODY : COMPACT, color, true, "left", "top"),
          lineHeight: layout.lead.lineHeight,
          wrap: false
        },
        data: { textLayout: layout.lead }
      })
    );
    y += layout.lead.height + layout.gap;
  }
  nodes.push(textPrimitive({ id: stableId(id, "text"), role: "callout-text", frame: { x: frame.x + layout.paddingX, y, width: frame.width - 2 * layout.paddingX, height: layout.body.height }, text: layout.body.text, style: { ...textStyle(layout.outline ? BODY : COMPACT, color, layout.outline, "left", "top"), lineHeight: layout.body.lineHeight, wrap: false }, data: { textLayout: layout.body } }));
  return nodes;
}

function insightNodes({ id, frame, props }) {
  const layout = insightLayout(frame, props), variant = props.variant ?? "tonal";
  // The content is centred in the frame, so a box a few pixels short of the
  // measured height gives the difference up from its padding rather than
  // failing: a caption sized by an estimate (a row of captioned panels shares
  // one height, measured in a different face) overflowed its 80px box by 2px.
  // The padding keeps a 4px floor on each side; only content taller than the
  // box less that floor is a sentence the box cannot hold.
  const floor = tokenValue(token("space.1"));
  const content = layout.bar ? layout.contentHeight : Math.max(layout.contentHeight, layout.marker);
  if (layout.height > frame.height && content + 2 * Math.min(floor, layout.paddingY) > frame.height) throw new Error(`Insight overflows its ${frame.height}px box by ${Math.ceil(layout.height - frame.height)}px even with its padding closed to ${floor}px; give it ${Math.ceil(layout.height - frame.height)}px more height or shorten the sentence`);
  const fill = variant === "primary" ? PRIMARY : variant === "neutral" ? MUTED_SURFACE : variant === "dotted" ? "none" : PRIMARY_TINT;
  const foreground = variant === "primary" ? WHITE : INK;
  const nodes = ["plain", "rule", "statement"].includes(variant) ? [] : [rectPrimitive({ id: stableId(id, "surface"), role: "insight-surface", frame, style: boxStyle(fill, "none", HAIRLINE, SMALL_RADIUS) })];
  if (variant === "rule") nodes.push(openLine(stableId(id, "rule"), frame.x, frame.y, frame.x + frame.width, frame.y, "insight-rule", RULE, HAIRLINE));
  if (variant === "statement") nodes.push(rectPrimitive({ id: stableId(id, "bar"), role: "insight-bar", frame: { x: frame.x, y: frame.y + layout.paddingY, width: layout.bar, height: layout.contentHeight }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
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
  const textX = frame.x + layout.paddingX + layout.marker + layout.markerGap;
  if (layout.marker && !layout.bar) {
    // Chevron disc: reversed on the primary band, primary on a tinted band.
    const size = layout.marker, mx = frame.x + layout.paddingX, my = frame.y + (frame.height - size) / 2;
    const discFill = variant === "primary" ? WHITE : PRIMARY, chevron = variant === "primary" ? PRIMARY : WHITE;
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker"), role: "insight-marker", frame: { x: mx, y: my, width: size, height: size }, style: boxStyle(discFill, discFill, HAIRLINE, token("radius.round")) }));
    nodes.push(shapePrimitive({ id: stableId(id, "marker-chevron"), role: "insight-marker-glyph", geometry: "iconPath", frame: { x: mx + size * 0.3, y: my + size * 0.28, width: size * 0.4, height: size * 0.44 }, style: { fill: "none", stroke: chevron, lineWidth: token("line.standard"), lineCap: "round" }, data: { paths: [{ points: [[0.2, 0], [0.8, 0.5], [0.2, 1]], closed: false }] } }));
  }
  if (layout.lines) {
    if (layout.heading) {
      nodes.push(textPrimitive({ id: stableId(id, "heading"), role: "insight-heading", frame: { x: textX, y, width: layout.width, height: layout.heading.height }, text: layout.heading.text, style: { ...textStyle(token("type.heading"), foreground, true, props.align ?? "left", "top"), lineHeight: layout.heading.lineHeight }, data: { textLayout: layout.heading } }));
      y += layout.heading.height + layout.gap;
    }
    const square = tokenValue(token("space.1"));
    layout.lines.forEach((line, index) => {
      nodes.push(rectPrimitive({ id: stableId(id, "bullet", index), role: "insight-bullet", frame: { x: textX, y: y + line.lineHeight / 2 - square / 2, width: square, height: square }, style: boxStyle(foreground, foreground, HAIRLINE, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "item", index), role: "insight-text", frame: { x: textX + layout.indent, y, width: layout.width - layout.indent, height: line.height }, text: line.text, style: { ...textStyle(BODY, foreground, true, "left", "top"), lineHeight: line.lineHeight }, data: { textLayout: line } }));
      y += line.height + layout.rowGap;
    });
    return nodes;
  }
  for (const [part, measured] of [["heading", layout.heading], ["body", layout.body]]) {
    if (!measured) continue;
    // `highlight`: the phrase the reader should see first, set in the accent
    // inside the sentence. Accent only, never bold - an insight body is already
    // semibold, so the emphasis is colour and the measured width is unchanged.
    // On the filled so-what bar the accent often cannot read (a red accent on a
    // red bar); there the sentence drops to the regular weight and the phrase
    // stays bold (emphasisRuns). Narrower than the bold it was measured in, the
    // sentence cannot overflow its lines. A page-level highlight is offered to
    // every piece of the page's prose, and one that does not say it is simply
    // not emphasised.
    const fill = variant === "primary" ? PRIMARY : null;
    const emphasis = part === "body" && props.highlight ? emphasisRuns(measured.text, props.highlight, fill) : null;
    // Those runs are cut from the wrapped text, so they carry its line breaks,
    // and the PowerPoint emitter reads a break inside runs as a new paragraph:
    // a highlight that falls just after a wrap would split the band into two
    // paragraphs on export. The emitter prefers runs over the unwrapped source,
    // so those travel with the layout.
    const sourceRuns = emphasis && measured.source !== undefined ? emphasisRuns(measured.source, props.highlight, fill)?.runs ?? null : null;
    nodes.push(textPrimitive({ id: stableId(id, part), role: `insight-${part}`, frame: { x: textX, y, width: layout.width, height: measured.height }, text: measured.text,
      ...(emphasis ? { runs: emphasis.runs } : {}),
      style: {
        ...textStyle(
          part === "heading" ? token("type.heading") : layout.bodySize ?? BODY,
          part === "heading" && variant !== "primary" ? PRIMARY : foreground,
          !emphasis || emphasis.accent,
          props.align ?? "left",
          "top"
        ),
        ...(variant === "rule" && part === "body" ? { fontFamily: DISPLAY } : {}),
        lineHeight: measured.lineHeight,
        wrap: false
      }, data: {
        textLayout: sourceRuns ? { ...measured, sourceRuns } : measured
      } }));
    y += measured.height + layout.gap;
  }
  return nodes;
}

/**
 * Body list items are strings or { lead?, text?, icon?, state?, number? }. The
 * marker is one of: dot (a small ink square), number (the deck's numbered disc),
 * icon (a line icon in a ring), check (green tick / red cross by `state`).
 * "auto" picks number when any item carries a lead, dot otherwise.
 */
export function normalizeListItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Body bullet list needs nonempty text items");
  return items.map((item, index) => {
    const o = typeof item === "string" ? { text: item } : item && typeof item === "object" ? { ...item } : null;
    if (!o) throw new Error("Body bullet list needs nonempty text items");
    const lead = typeof o.lead === "string" && o.lead.trim() ? o.lead.trim() : null;
    const text = typeof o.text === "string" && o.text.trim() ? o.text.trim() : null;
    if (!lead && !text) throw new Error("Body bullet list needs nonempty text items");
    // `highlight`: the phrase (or phrases) inside the point that reads in the
    // house colour, which is how a well-made page emphasises the finding
    // inside a sentence rather than bolding the whole line.
    const highlight = o.highlight === undefined || o.highlight === null ? null : o.highlight;
    // `points`: sub-points under the item, each a short line set at an indent
    // with a dash - the way a strong executive summary develops a statement
    // into its parts ("the vision includes: - better data - planning ...").
    if (o.points !== undefined && (!Array.isArray(o.points) || o.points.some((sub) => typeof sub !== "string" || !sub.trim()))) {
      throw new Error("A point's sub-points are a list of nonempty strings");
    }
    const points = (o.points || []).map((sub) => sub.trim());
    return { lead, text, icon: o.icon ?? null, state: o.state ?? null, highlight, number: o.number ?? index + 1, points };
  });
}

export function resolveListMarker(props) {
  const items = normalizeListItems(props.items);
  const marker = props.marker ?? "auto";
  // The plain marker follows the house style: a square dot, or a short dash.
  if (marker === "auto") return items.some((i) => i.icon) ? "icon" : items.some((i) => i.state !== null) ? "check" : items.some((i) => i.lead) ? "number" : houseStyle("style.listMarker") === "dash" ? "dash" : "dot";
  // `none` is the prose column (a bold lead and its paragraph, nothing in the
  // gutter), `rule` separates items with a hairline instead of marking them,
  // and `letter` is A / B / C for options rather than steps - the devices a
  // strong deck uses where we only ever reached for the numbered disc.
  if (!["dot", "dash", "number", "letter", "icon", "icon-ring", "check", "none", "rule"].includes(marker)) throw new Error(`Unknown list marker: ${marker}`);
  return marker;
}

function bodyListLayout(frame, itemsIn, props = {}) {
  const items = normalizeListItems(itemsIn);
  const marker = resolveListMarker({ ...props, items: itemsIn });
  const disc = markerSize();
  // A well-made icon list sets the glyph alone in the house colour, about
  // twice the text line, with the text beside it and room between the rows -
  // not a small icon in a ring. `marker: "icon-ring"` keeps the ringed marker.
  const ringed = marker === "icon-ring";
  const iconSize = Math.round(disc * (ringed ? 1.5 : 1.75));
  const iconList = marker === "icon" || ringed;
  const plain = marker === "dot" || marker === "dash";
  // A prose or ruled column has nothing in its gutter, so the text starts at
  // the frame edge and the space goes to the measure instead of the marker.
  const bare = marker === "none" || marker === "rule";
  const markerWidth = plain || bare ? 0 : iconList ? iconSize : disc;
  const offset = bare ? 0 : plain ? tokenValue(token("space.4")) : markerWidth + tokenValue(token(iconList && !ringed ? "space.4" : "space.3"));
  const gap = tokenValue(token(marker === "rule" ? "space.4" : plain ? "space.2" : iconList && !ringed ? "space.4" : "space.3"));
  const leadGap = tokenValue(token("space.1"));
  const markerSquare = tokenValue(token("space.1"));
  if (frame.width <= offset) throw new Error("Body bullet list has no text width; give the list a wider frame");
  const width = frame.width - offset;
  const font = { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY) };
  const subIndent = tokenValue(token("space.5"));
  // `inlineLead`: the lead runs *into* the sentence in the house accent rather
  // than sitting above it in bold - the way a well-made icon list sets the
  // phrase that carries the finding. The item then measures as one block.
  const inlineLead = props.inlineLead === true;
  const measured = items.map((item) => {
    if (inlineLead && item.lead && item.text) {
      const joined = `${item.lead} ${item.text}`;
      const runs = accentRuns(joined, item.highlight ?? [item.lead], { bold: true, accent: true, strict: false })
        || [{ text: joined }];
      const block = measureTextRuns(runs, width, font);
      const subs = item.points.map((sub) => measureText(sub, Math.max(1, width - subIndent), font));
      const subHeight = subs.reduce((sum, sub) => sum + sub.height, 0) + (subs.length ? leadGap * subs.length : 0);
      return { item, lead: null, text: block, subs, textHeight: block.height + subHeight, height: Math.max(block.height + subHeight, markerWidth) };
    }
    // A highlight inside the lead is set in the accent on the lead's own line;
    // inside the text it flows with the sentence.
    // `strict: false`: the page's own highlight is offered to every point, and
    // a point that does not say the phrase simply does not emphasise it.
    const leadRuns = item.lead ? accentRuns(item.lead, item.highlight, { bold: true, strict: false }) : null;
    const textRuns = item.text && !(leadRuns && leadRuns.some((run) => run.accent)) ? accentRuns(item.text, item.highlight, { bold: houseStyle("style.labelWeight") !== "regular", strict: false }) : null;
    const lead = item.lead ? (leadRuns && leadRuns.some((run) => run.accent) ? measureTextRuns(leadRuns.map((run) => ({ ...run, bold: true })), width, font) : measureText(item.lead, width, { ...font, bold: true })) : null;
    const text = item.text ? (textRuns ? measureTextRuns(textRuns, width, font) : measureText(item.text, width, font)) : null;
    const subs = item.points.map((sub) => measureText(sub, Math.max(1, width - subIndent), font));
    const subHeight = subs.reduce((sum, sub) => sum + sub.height, 0) + (subs.length ? leadGap * subs.length : 0);
    const textHeight = (lead?.height ?? 0) + (lead && text ? leadGap : 0) + (text?.height ?? 0) + subHeight;
    return { item, lead, text, subs, textHeight, height: Math.max(textHeight, markerWidth) };
  });
  return { marker, offset, gap, leadGap, subIndent, ringed, markerSize: plain ? markerSquare : markerWidth, measured, height: measured.reduce((sum, m) => sum + m.height, 0) + gap * (items.length - 1) };
}

function bodyListNodes({ id, frame, props }) {
  const layout = bodyListLayout(frame, props.items, props);
  if (layout.height > frame.height + 0.01) throw new Error(`${id} body bullets exceed the allocated height; allocate space or edit copy, never shrink type`);
  // `distribute: true` (a side column on any deck that is not airy) spreads the
  // rows down the frame instead of stacking them at the top. The gap is capped
  // near the height of a two-line item: past that the list reads as a menu, and
  // the answer to a column that still ends early is more content or a narrower
  // column, not more air.
  const spare = Math.max(0, frame.height - layout.height);
  // The spread opens a reading gap, not a chasm: past about a line of text the
  // points stop reading as one column and start reading as three labels adrift
  // in it. A column that still ends high wants another point, not more air -
  // which is what the column and page floors ask for.
  const extraGap = props.distribute === true && layout.measured.length > 1 ? Math.min(spare / (layout.measured.length - 1), 24) : 0;
  // Whatever the cap leaves over is split above and below the list rather than
  // dropped under it. A column that opens its gaps to the cap and then hugs the
  // top still ends two fifths up the track, with all the slack in one band at
  // the foot - which reads as an unfinished page, not as air. Centred, the same
  // leftover reads as the margin around a block. The gap does the reading work;
  // the centring stops the remainder pooling in one place.
  // On a dark or primary panel the list reads in white: white text, white markers,
  // reversed number discs.
  const inverse = props.tone === "inverse";
  if (props.tone !== undefined && !["standard", "inverse"].includes(props.tone)) throw new Error(`Unknown bullet-list tone: ${props.tone}`);
  const INK_ = inverse ? WHITE : INK;
  // `centre: false` keeps the block at the top of its track. The leftover is
  // only a margin when the list owns the track: under a kpi or an insight it
  // reads as a gap between the two, and in a two-column split it lands the
  // halves on different tops.
  const centred = props.centre !== false;
  let y = frame.y + (centred && extraGap > 0 ? Math.max(0, spare - extraGap * (layout.measured.length - 1)) / 2 : 0);
  const nodes = [];
  layout.measured.forEach((m, index) => {
    const first = m.lead ?? m.text;
    const lineCentre = y + first.lineHeight / 2;
    const mid = y + m.height / 2;
    if (layout.marker === "dot") {
      nodes.push(rectPrimitive({ id: stableId(id, "marker", index), role: "list-marker", frame: { x: frame.x, y: lineCentre - layout.markerSize / 2, width: layout.markerSize, height: layout.markerSize }, style: boxStyle(INK_, INK_, HAIRLINE, token("radius.none")) }));
    } else if (layout.marker === "dash") {
      nodes.push(rectPrimitive({ id: stableId(id, "marker", index), role: "list-marker", frame: { x: frame.x, y: lineCentre - 0.5, width: tokenValue(token("space.2")), height: 1 }, style: boxStyle(INK_, INK_, HAIRLINE, token("radius.none")) }));
    } else if (layout.marker === "number" || layout.marker === "letter") {
      // `state: "open"` hollows the disc: a well-made ledger runs solid discs
      // for what is done and outlined ones for what is not, on one list.
      const hollow = m.item.state === "open";
      const label = layout.marker === "letter" ? String.fromCharCode(64 + Number(m.item.number || index + 1)) : m.item.number;
      nodes.push(...numberMarker({ id: stableId(id, "marker", index), role: "list-marker", x: frame.x, y: Math.max(y, lineCentre - layout.markerSize / 2), size: layout.markerSize, number: label, reverse: inverse || hollow }));
    } else if (layout.marker === "rule") {
      // Nothing. The gap already separates the items; a hairline between them,
      // with a full item gap either side of it, would make three sentences
      // three ruled boxes with more rule than reason and the page read loose.

    } else if (layout.marker === "none") {
      // Nothing in the gutter; the lead carries the item.
    } else if (layout.marker === "check") {
      nodes.push(...stateMarker({ id: stableId(id, "marker", index), role: "list-marker", x: frame.x, y: Math.max(y, lineCentre - layout.markerSize / 2), size: layout.markerSize, state: m.item.state ?? "yes" }));
    } else {
      // A ringed icon centres on the item block, as on a feature row. A plain
      // glyph sits on the first line, the way a well-made icon list reads down
      // a column whose items run to three and four lines.
      const iconY = layout.ringed ? mid - layout.markerSize / 2 : Math.max(y, lineCentre - layout.markerSize / 2);
      // A RINGED marker is a marker, not the finding. Drawn in the house
      // primary it is a column of blue discs down the left of three sentences,
      // louder than the highlighted phrase inside them and saying nothing - so
      // the ring is a hairline and its glyph secondary. A bare glyph with no
      // ring keeps the accent: there it is the only mark the item has - but
      // only where the author named it. An item with no icon of its own falls
      // back to an "i" in a circle, and three of those down a column in the
      // house accent are three blue marks louder than the phrase they sit
      // beside, saying nothing the list did not already say. Unauthored, the
      // fallback is secondary.
      nodes.push(...iconMarker({ id: stableId(id, "marker", index), role: "list-icon", x: frame.x, y: iconY, size: layout.markerSize, icon: m.item.icon || "info", tone: inverse ? "inverse" : layout.ringed || !m.item.icon ? "muted" : "accent" }));
    }
    let ty = layout.ringed && m.textHeight < m.height ? y + (m.height - m.textHeight) / 2 : y;
    if (m.lead) {
      nodes.push(
        textPrimitive({
          id: stableId(id, "lead", index),
          role: "list-lead",
          frame: { x: frame.x + layout.offset, y: ty, width: frame.width - layout.offset, height: m.lead.height },
          text: m.lead.text,
          ...(m.lead.runs && m.lead.runs.some((run) => run.accent) && !inverse ? { runs: m.lead.runs } : {}),
          style: { ...textStyle(BODY, INK_, true, "left", "top"), lineHeight: m.lead.lineHeight },
          data: { textLayout: m.lead }
        })
      );
      ty += m.lead.height + (m.text ? layout.leadGap : 0);
    }
    if (m.text)
      nodes.push(
        textPrimitive({
          id: stableId(id, "item", index),
          role: "list-item",
          frame: { x: frame.x + layout.offset, y: ty, width: frame.width - layout.offset, height: m.text.height },
          text: m.text.text,
          ...(m.text.runs && m.text.runs.some((run) => run.accent) && !inverse ? { runs: m.text.runs } : {}),
          style: { ...textStyle(BODY, INK_, false, "left", "top"), lineHeight: m.text.lineHeight },
          data: { textLayout: m.text }
        })
      );
    if (m.text) ty += m.text.height;
    m.subs.forEach((sub, k) => {
      ty += layout.leadGap;
      const x = frame.x + layout.offset;
      nodes.push(rectPrimitive({ id: stableId(id, "sub-marker", index, k), role: "list-submarker", frame: { x: x + 4, y: ty + sub.lineHeight / 2 - 0.5, width: tokenValue(token("space.2")), height: 1 }, style: boxStyle(INK_, INK_, HAIRLINE, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "sub", index, k), role: "list-subitem", frame: { x: x + layout.subIndent, y: ty, width: frame.width - layout.offset - layout.subIndent, height: sub.height }, text: sub.text, style: { ...textStyle(BODY, INK_, false, "left", "top"), lineHeight: sub.lineHeight }, data: { textLayout: sub } }));
      ty += sub.height;
    });
    y += m.height + layout.gap + extraGap;
  });
  return nodes;
}

function defineParagraph() {
  return component({ id: "paragraph", category: "text", tokens: ["font.body", "type.body", "type.compact", "color.ink", "color.textSecondary"], preferredSize: { width: 520, height: 180 }, sample: { text: "(Insert supporting statement)" }, render: ({ id, frame, props }) => {
    if (typeof props.text !== "string" || !props.text.trim()) throw new Error(`paragraph ${id} requires a non-empty text string; keep geometry in the component frame`);
    const width = paragraphMeasure(frame.width, props);
    // `variant: "caption"` is the line under a panel: compact, secondary, the
    // finding this panel carries. A well-made page captions every panel in a row
    // instead of closing the page with one shared so-what. It is the panel's
    // insight, and its role says so: set at the foot of the body it is still
    // the page's own commentary, not a note in the footer.
    const caption = props.variant === "caption", runs = paragraphRuns(props);
    return { nodes: [measuredTextNode({ id: stableId(id, "text"), role: caption ? "insight-caption" : "paragraph", frame: { ...frame, width }, text: props.text, ...(runs ? { runs } : {}), style: textStyle(caption ? COMPACT : BODY, caption ? SECONDARY : INK, false, props.align || "left", "top") })] };
  } });
}

function defineBulletList() {
  return component({
    id: "bullet-list",
    category: "text",
    tokens: [
      "font.body", "type.compact", "type.label", "color.ink", "color.accent", "color.componentPrimary", "color.onPrimary", "color.rule",
      "space.1", "space.2", "space.3", "space.4", "space.5", "line.hairline", "radius.none", "radius.round"
    ],
    preferredSize: { width: 540, height: 240 },
    sample: { items: ["(Insert supporting point 1)", "(Insert supporting point 2)", "(Insert supporting point 3)"] },
    render: ({ id, frame, props }) => ({ nodes: simpleList({ id, frame, items: props.items, numbered: false, marker: "circle" }) })
  });
}

function defineInsight() {
  return component({
    id: "insight",
    category: "section",
    role: "insight",
    tokens: [
      "color.accent", "font.display", "radius.none", "color.componentPrimaryTint", "color.componentPrimary", "color.surfaceMuted",
      "color.rule", "color.onPrimary", "color.ink", "font.body", "type.heading", "type.body", "space.2", "space.3", "space.4", "space.5",
      "space.6", "line.hairline", "line.standard", "radius.small", "radius.round", "icon.medium"
    ],
    preferredSize: { width: 1160, height: 100 },
    sample: { text: "(Insert decision-relevant synthesis)" },
    render: input => ({ nodes: insightNodes(input) })
  });
}

function defineCallout() {
  return component({
    id: "callout",
    category: "section",
    role: "callout",
    tokens: [
      "color.calloutTint", "color.caution", "color.accent", "color.surface", "color.ink", "font.body", "type.compact", "type.body",
      "space.2", "space.3", "space.4", "line.hairline", "radius.none"
    ],
    preferredSize: { width: 360, height: 72 },
    sample: { text: "(Insert reading note)" },
    render: input => ({ nodes: calloutNodes(input) })
  });
}

function defineEvidenceNote() {
  return component({
    id: "evidence-note",
    category: "section",
    role: "evidence-note",
    tokens: [
      "color.componentPrimaryTint", "color.componentPrimary", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink",
      "font.body", "type.heading", "type.body", "space.2", "space.3", "space.4", "space.5", "space.6", "line.hairline", "line.standard",
      "radius.small", "radius.round", "icon.medium"
    ],
    preferredSize: { width: 1160, height: 150 },
    sample: { heading: "Measurement basis", text: "(Insert scope, period or scenario assumptions)" },
    render: input => {
      if (!input.props.heading || !input.props.text) throw new Error("Evidence note requires heading and body");
      return {
        nodes: insightNodes({...input, props:{...input.props, variant:"neutral", align:"left"}}).map(node => ({
          ...node,
          role:node.role.replace("insight-", "evidence-note-")
        }))
      };
    }
  });
}

function definePanel() {
  return component({
    id: "panel",
    category: "section",
    role: "panel",
    tokens: [
      "color.surface",
      "color.surfaceMuted",
      "color.componentPrimary",
      "color.rule",
      "color.ink",
      "color.onPrimary",
      "font.body",
      "type.heading",
      "type.compact",
      "line.hairline",
      "radius.none",
      ...[1, 2, 3, 4, 5, 6].map(index => `color.chartSeries${index}`)
    ],
    preferredSize: { width: 400, height: 240 },
    sample: { heading: "(Insert panel heading)", text: "(Insert panel description)" },
    render: ({ id, frame, props, tokens = TOKENS }) => {
      const tone = props.tone || "open";
      const seriesColorIndex = props.seriesColorIndex;
      if (seriesColorIndex !== undefined && (!Number.isInteger(seriesColorIndex) || seriesColorIndex < 0 || seriesColorIndex > 5))
        throw new Error("Panel seriesColorIndex must be an integer from zero to five");
      const fill = seriesColorIndex !== undefined
        ? token(`color.chartSeries${seriesColorIndex + 1}`)
        : tone === "primary" ? PRIMARY : tone === "dark" ? INK : tone === "muted" ? MUTED_SURFACE : SURFACE;
      const foreground = seriesColorIndex !== undefined
        ? onFill(fill)
        : tone === "primary" || tone === "dark" ? WHITE : INK;
      const data = seriesColorIndex === undefined ? {} : { seriesKey: props.seriesKey ?? props.heading, colorIndex: seriesColorIndex };
      return {
        nodes: [
          rectPrimitive({
            id: stableId(id, "surface"),
            role: "panel-surface",
            frame,
            style: boxStyle(fill, tone === "open" && seriesColorIndex === undefined ? RULE : fill, HAIRLINE, token("radius.none")),
            data
          }),
          textPrimitive({
            id: stableId(id, "heading"),
            role: "panel-heading",
            frame: { x: frame.x + 10, y: frame.y + 10, width: frame.width - 20, height: 30 },
            text: props.heading,
            style: textStyle(token("type.heading"), foreground, true),
            data
          }),
          textPrimitive({
            id: stableId(id, "body"),
            role: "panel-body",
            frame: { x: frame.x + 10, y: frame.y + 44, width: frame.width - 20, height: frame.height - 54 },
            text: props.text,
            style: textStyle(COMPACT, foreground, false, "left", "top"),
            data
          })
        ]
      };
    }
  });
}

/** Text blocks: the paragraph, bullet list, insight, callout, evidence note and panel. */
export function registerTextBlocks(registry) {
  const definitions = [defineParagraph(), defineBulletList(), defineInsight(), defineCallout(), defineEvidenceNote(), definePanel()];
  for (const definition of definitions) {
    refineVariantAxes(definition);
    if (definition.id === "bullet-list") {
      definition.tokens.push("type.body", "space.2", "space.4", ...MARK_TOKENS, "color.positive", "color.negative");
      const render = definition.render;
      definition.render = input => definition.resolveVariant(input.props) === "body" ? { nodes: bodyListNodes(input) } : render(input);
      definition.measureContent = ({ frame, props }) => {
        if (definition.resolveVariant(props) !== "body") throw new Error("Content measurement requires the body bullet-list variant");
        return bodyListLayout(frame, props.items, props);
      };
      definition.measureIntrinsic = input => definition.resolveVariant(input.props) === "body" ? definition.measureContent(input) : null;
    }
    if (definition.id === "paragraph") definition.measureContent = ({ frame, props }) => {
      // Geometry-only layout probes have no copy yet; rendering still requires it.
      if (!Object.hasOwn(props ?? {}, "text")) return null;
      if (typeof props.text !== "string" || !props.text.trim()) throw new Error("paragraph requires a non-empty text string for measurement");
      const runs = paragraphRuns(props);
      if (runs && runs.map((r) => r.text).join("") !== props.text) throw new Error("Paragraph emphasis must preserve exact text");
      return (runs ? measureTextRuns : measureText)(runs || props.text, paragraphMeasure(frame.width, props), { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY), bold: false });
    };
    if (["insight", "evidence-note"].includes(definition.id)) definition.measureContent = ({ frame, props }) => { definition.resolveVariant(props); return insightLayout(frame, props); };
    if (definition.id === "callout") definition.measureContent = ({ frame, props }) => calloutLayout(frame, props);
    registry.set(definition.id, definition);
  }
  return registry;
}
