// Page chrome and structure: the slide chrome and page template, the section
// and its heading, the boundary between sections, the action and section
// titles, the cover, the section divider, the takeaways and statement pages,
// and the footer lines (source, footnote, page number).
import { token, tokenValue, CHROME, rectPrimitive, stableId, textPrimitive, TITLE_VARIANTS, resolveTitleVariant, houseStyle, normalizeInsets,
  insetFrame, ellipsePrimitive, linePrimitive, SLIDE, STYLE_TOKENS, DEFAULT_TITLE_VARIANT } from "./core.mjs";
import { textWords } from "./text-contract.mjs";
import { measureText, measureTextRuns, balancedWrap } from "./text-layout.mjs";
import { PAGE_TEMPLATE_TOKENS, renderPageTemplate, PAGE_RULES, PAGE_BRANDING, pageTemplateLayout, resolvePageTemplate } from "./page-template.mjs";
import { TRACKER_TOKENS, trackerLabelNodes } from "./trackers.mjs";
import { mediaNode, logoFrame } from "./media.mjs";
import { contrastRatio } from "./color.mjs";
import { FONT, DISPLAY, INK, SECONDARY, PRIMARY, RULE, WHITE, HAIRLINE, textStyle, boxStyle, openLine, headingLayout, STANDARD, component,
  lightChevronNode, MUTED_SURFACE, BODY, SURFACE, SMALL_RADIUS, SECTION_HEADING_TOKENS, sectionHeadingNodes, PRIMARY_TINT, refineVariantAxes,
  refineSectionHeader } from "./registry-shared.mjs";

const SOURCE = token("type.source");

// A closing message's lead clause: the words before its first colon, or its
// first sentence, when either is a short phrase and not the whole message.
const TAKEAWAY_SPREAD = 72;
function takeawayLead(text) {
  const colon = text.indexOf(":");
  if (colon > 0 && textWords(text.slice(0, colon)) <= 12) return text.slice(0, colon + 1);
  const sentence = /^[^.!?]+[.!?](?=\s)/.exec(text)?.[0];
  return sentence && sentence.length < text.length && textWords(sentence) <= 16 ? sentence : null;
}
function measureTakeaway(item, width) {
  const text = String(item).trim(), lead = takeawayLead(text);
  const font = { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")) };
  // A message with no short lead is set regular: bold is for the clause that
  // carries the message, and a whole paragraph in it carries none.
  if (!lead) return measureText(text, width, { ...font, bold: textWords(text) <= 16 });
  // The unwrapped runs travel with the layout: the emitter reads a break
  // inside runs as a new paragraph (insightNodes' `sourceRuns`).
  const sourceRuns = [{ text: lead, bold: true }, { text: text.slice(lead.length), bold: false }];
  return { ...measureTextRuns(sourceRuns, width, font), sourceRuns };
}

// The covers of the non-consulting design systems. Each is a whole
// construction, not a recolouring: the editorial cover is typographic on paper,
// the journal cover a masthead over a rule, the keynote cover a colour field.
function designedCoverNodes(layout, { id, frame, props }) {
  const nodes = [];
  const keynote = layout === "keynote";
  const ground = keynote ? PRIMARY : token("color.canvas");
  const ink = keynote ? WHITE : INK, secondary = keynote ? WHITE : SECONDARY;
  const x = frame.x + CHROME.left, width = Math.min(frame.width - CHROME.left - CHROME.right, frame.width * (layout === "editorial" ? 0.8 : 0.74));
  const bold = layout !== "editorial";
  const title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")), bold });
  const subtitle = props.subtitle?.trim() ? measureText(props.subtitle, width, { fontFamily: tokenValue(layout === "editorial" ? DISPLAY : FONT), fontSize: tokenValue(token("type.heading")) }) : null;
  const date = props.date?.trim() ? measureText(props.date, 360, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.compact")), bold: true }) : null;
  if (title.lines.length > 3 || subtitle?.lines.length > 2) throw new Error("Cover text exceeds its allocated space; shorten the title or subtitle");
  const gap = tokenValue(token("space.5"));
  nodes.push(rectPrimitive({ id: stableId(id, "surface"), role: "cover-surface", frame, style: boxStyle(ground, ground, HAIRLINE, token("radius.none")) }));
  const text = (part, measured, y, style, family = FONT, w = width, px = x) => nodes.push(textPrimitive({ id: stableId(id, part), role: `cover-${part}`, frame: { x: px, y, width: w, height: measured.height }, text: measured.text, style: { ...style, fontFamily: family, lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: measured } }));
  if (layout === "editorial") {
    // Title on the upper-middle line, a full-measure hairline under it, the
    // standfirst in the serif below; the date is a small label at the top.
    const top = frame.y + frame.height * 0.3;
    if (date) text("date", date, frame.y + CHROME.titleTop, textStyle(token("type.compact"), token("color.accent"), true, "left", "top"), FONT, 360);
    text("title", title, top, textStyle(token("type.deckTitle"), ink, false, "left", "top"), DISPLAY);
    const ruleY = top + title.height + gap;
    nodes.push(openLine(stableId(id, "accent"), x, ruleY, frame.x + frame.width - CHROME.right, ruleY, "cover-accent", RULE, HAIRLINE));
    if (subtitle) text("subtitle", subtitle, ruleY + gap, textStyle(token("type.heading"), secondary, false, "left", "top"), DISPLAY);
  } else if (layout === "journal") {
    // A masthead: the accent tab top-left, the title set large above a full
    // primary rule, the subtitle and date beneath it.
    nodes.push(rectPrimitive({ id: stableId(id, "tab"), role: "cover-tab", frame: { x, y: frame.y, width: 96, height: 14 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
    const ruleY = frame.y + frame.height * 0.58;
    text("title", title, ruleY - gap - title.height, textStyle(token("type.deckTitle"), ink, true, "left", "top"), DISPLAY);
    nodes.push(rectPrimitive({ id: stableId(id, "accent"), role: "cover-accent", frame: { x, y: ruleY, width: frame.width - CHROME.left - CHROME.right, height: 3 }, style: boxStyle(PRIMARY, "none", HAIRLINE, token("radius.none")) }));
    let y = ruleY + 3 + gap;
    if (subtitle) { text("subtitle", subtitle, y, textStyle(token("type.heading"), secondary, false, "left", "top")); y += subtitle.height + tokenValue(token("space.3")); }
    if (date) text("date", date, y, textStyle(token("type.compact"), SECONDARY, true, "left", "top"), FONT, 360);
  } else {
    // Keynote: the title large and reversed on the primary field, centred on
    // the page's middle line, an accent bar leading it.
    const block = title.height + (subtitle ? gap + subtitle.height : 0);
    const top = frame.y + (frame.height - block) / 2;
    nodes.push(rectPrimitive({ id: stableId(id, "accent"), role: "cover-accent", frame: { x, y: top - gap - 8, width: 96, height: 8 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
    text("title", title, top, textStyle(token("type.deckTitle"), ink, true, "left", "top"), DISPLAY);
    if (subtitle) text("subtitle", subtitle, top + title.height + gap, textStyle(token("type.heading"), secondary, false, "left", "top"));
    if (date) text("date", date, frame.y + frame.height - CHROME.left - date.height, textStyle(token("type.compact"), secondary, true, "left", "top"), FONT, 360);
  }
  if (props.logo?.trim()) {
    const logo = measureText(props.logo, 320, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.heading")), bold: true });
    nodes.push(textPrimitive({ id: stableId(id, "logo"), role: "cover-logo", frame: { x: frame.x + frame.width - CHROME.right - 320, y: frame.y + CHROME.titleTop, width: 320, height: logo.height }, text: logo.text, style: { ...textStyle(token("type.heading"), ink, true, "right", "top"), fontFamily: DISPLAY, lineHeight: logo.lineHeight, wrap: false }, data: { textLayout: logo } }));
  }
  return nodes;
}

function titleNodes({ id, frame, props, section = false, chrome = false }) {
  // The house style decides the title's weight and whether a hairline runs under
  // it: a palette's `style.titleWeight` / `style.titleRule` unless the page says.
  const houseRule = chrome && !section && props.variant === undefined && props.rule === undefined && houseStyle("style.titleRule") === "rule";
  const variant = houseRule ? "with-line" : resolveTitleVariant(props);
  const titleBold = houseStyle("style.titleWeight") !== "regular";
  const ruleGap = tokenValue(token("space.2"));
  const size = section ? token("type.sectionTitle") : token("type.actionTitle");
  const baseTextFrame = chrome
    ? { x: frame.x + CHROME.left, y: frame.y + (props.titleTop ?? CHROME.titleTop), width: props.availableTitleWidth ?? frame.width - CHROME.left - CHROME.right, height: CHROME.titleHeight }
    : { x: frame.x, y: frame.y, width: frame.width, height: frame.height - ruleGap };
  // Fit ladder: the action title is set at 24pt; a title that needs a third line
  // is retried at 22pt. Beyond that the page gate (TITLE_LINES) reports it.
  // An optional lead-in ("Why", "Drive") is set in the accent colour as a run.
  const lead = typeof props.lead === "string" && props.lead.trim() && props.text.startsWith(props.lead) ? props.lead : null;
  // The house decides how a lead reads: in the accent before the rest
  // ("South Korea: …"), or as "Topic | statement" with the topic in bold, a pipe,
  // and the statement in the title weight. The pipe replaces a colon or dash
  // after the lead while retaining a single title hierarchy.
  const pipe = lead && chrome && houseStyle("style.titleLead") === "pipe";
  const restOf = (text) => pipe ? text.slice(lead.length).replace(/^\s*[:\-–—|]?\s*/, "") : text.slice(lead.length);
  const runsFor = () => pipe
    ? [{ text: lead, bold: true }, { text: " | ", bold: false }, { text: restOf(props.text), bold: titleBold }]
    : [{ text: lead, bold: titleBold, accent: true }, { text: props.text.slice(lead.length), bold: titleBold }];
  const measureTitle = (fontSize, width = baseTextFrame.width) => lead
    ? measureTextRuns(runsFor(), width, { fontFamily: tokenValue(DISPLAY), fontSize, wrapWidthRatio: 0.98 })
    : measureText(props.text, width, { fontFamily: tokenValue(DISPLAY), fontSize, bold: titleBold, wrapWidthRatio: 0.98 });
  let fontSize = tokenValue(size), textLayout = measureTitle(fontSize);
  if (chrome && !section && textLayout.lines.length > 2) {
    const long = tokenValue(token("type.actionTitleLong"));
    const retry = measureTitle(long);
    if (retry.lines.length < textLayout.lines.length) { fontSize = long; textLayout = retry; }
  }
  // A title that wraps is balanced: set at the narrowest width that keeps its
  // line count, so its lines run to about the same length and the last is
  // never a stranded word or two. The box takes that width, and the PPTX
  // breaks the lines where the render did (`balanced`), so PowerPoint's own
  // metrics cannot move a word back. An author's own line break is kept.
  let titleWidth = baseTextFrame.width, balanced = false;
  if (chrome && !section && !String(props.text).includes("\n") && textLayout.lines.length > 1) {
    const wrap = balancedWrap((width) => measureTitle(fontSize, width), baseTextFrame.width);
    if (wrap.width < baseTextFrame.width) { titleWidth = wrap.width; textLayout = wrap.layout; balanced = true; }
  }
  const textFrame = chrome ? { ...baseTextFrame, width: titleWidth, height: Math.max(baseTextFrame.height, textLayout.height) } : baseTextFrame;
  const ruleY = textFrame.y + textLayout.height + ruleGap;
  if (!chrome && textLayout.height > textFrame.height) throw new Error(`Title ${id} exceeds its allocated height; shorten it or allocate more space`);
  const nodes = [textPrimitive({
    id: stableId(id, chrome ? "title" : "text"),
    role: section ? "section-title" : "action-title",
    frame: textFrame,
    text: textLayout.text,
    ...(lead ? { runs: textLayout.runs } : {}),
    style: { ...textStyle(fontSize === tokenValue(size) ? size : token("type.actionTitleLong"), INK, titleBold), fontFamily: DISPLAY, valign: "top", lineHeight: textLayout.lineHeight, wrap: false },
    data: { titleVariant: variant, textLayout, ruleGap, ...(lead ? { lead } : {}), ...(balanced ? { balanced } : {}) }
  })];
  if (TITLE_VARIANTS[variant].rule) nodes.push(openLine(stableId(id, chrome ? "title-rule" : "rule"), textFrame.x, ruleY, textFrame.x + textFrame.width, ruleY, "title-rule", RULE, HAIRLINE, { titleVariant: variant }));
  return nodes;
}

// The title rule as the house draws it (style.titleRuleLength, .titleRuleColor,
// line.titleRule): margin to margin, edge to edge, or a short accent bar.
const TITLE_RULE_COLORS = { rule: "color.rule", ink: "color.ink", accent: "color.accent", primary: "color.componentPrimary" };
const TITLE_BAR = 64;
function titleRuleNode(id, frame, y, titleVariant) {
  const length = houseStyle("style.titleRuleLength"), colour = TITLE_RULE_COLORS[houseStyle("style.titleRuleColor")];
  if (!["content", "full", "short"].includes(length)) throw new Error(`Unknown title rule length: ${length}; use content, full or short`);
  if (!colour) throw new Error(`Unknown title rule colour: ${houseStyle("style.titleRuleColor")}; use ${Object.keys(TITLE_RULE_COLORS).join(", ")}`);
  const x1 = length === "full" ? frame.x : frame.x + CHROME.left;
  const x2 = length === "full" ? frame.x + frame.width : length === "short" ? x1 + TITLE_BAR : frame.x + frame.width - CHROME.right;
  return openLine(stableId(id, "title-rule"), x1, y, x2, y, "title-rule", token(colour), token("line.titleRule"), { titleVariant, ruleLength: length });
}

/** Boxed sections pad on all sides; open sections keep the grid's left and right edges. */
function sectionPadding(props = {}) {
  if (props.padding !== undefined) return normalizeInsets(props.padding);
  const treatment = props.treatment || "open";
  // A filled panel breathes: a well-made panel sets its copy a full gutter off
  // every edge, not the four pixels a tint can get away with.
  const value = tokenValue(token("space.5"));
  return treatment === "open" ? { top: 0, right: 0, bottom: 0, left: 0 } : { top: value, right: value, bottom: value, left: value };
}

function sectionContentInsets(frame, props = {}) {
  const padding = sectionPadding(props);
  const headerFrame = insetFrame(frame, padding);
  const header = props.heading ? headingLayout(headerFrame, { ...props, rule: props.treatment !== "muted" && props.treatment !== "tint" }).height : 0;
  return { ...padding, top: padding.top + header };
}

function defineSectionBoundary() {
  return component({
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
      if (variant === "inference-chevron") return { nodes: [
        linePrimitive({ id: stableId(id, "before"), role: "section-separator", x1: x, y1: frame.y, x2: x, y2: y - radius - clearance, style: { stroke: RULE, lineWidth: HAIRLINE, dash: "dash" } }),
        linePrimitive({ id: stableId(id, "after"), role: "section-separator", x1: x, y1: y + radius + clearance, x2: x, y2: frame.y + frame.height, style: { stroke: RULE, lineWidth: HAIRLINE, dash: "dash" } }),
        lightChevronNode(id, frame)
      ] };
      return { nodes: [
        openLine(stableId(id, "before"), x, frame.y, x, y - radius - clearance, "section-separator"),
        openLine(stableId(id, "after"), x, y + radius + clearance, x, frame.y + frame.height, "section-separator"),
        ellipsePrimitive({ id: stableId(id, "disc"), role: "relationship-disc", frame: { x: x - radius, y: y - radius, width: diameter, height: diameter }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }),
        openLine(stableId(id, "chevron-top"), x - diameter / 8, y - diameter / 4, x + diameter / 8, y, "relationship-chevron", WHITE, STANDARD),
        openLine(stableId(id, "chevron-bottom"), x + diameter / 8, y, x - diameter / 8, y + diameter / 4, "relationship-chevron", WHITE, STANDARD)
      ] };
    }
  });
}

/** The slide chrome: the page template, then the title band - tracker, kicker, action title, tag, standfirst and rule or band - and the content frame the body is laid out in under it. */
function renderSlideChrome({ id, frame, props }) {
  const page = renderPageTemplate({ id, frame, props });
  const tracker = props.tracker ? trackerLabelNodes({ id: stableId(id, "tracker"), frame: { x: frame.x + CHROME.left, y: frame.y + 30, width: page.titleWidth, height: 20 }, props: props.tracker }) : [];
  // `kicker`: the small label above the title that says what part of the
  // argument this page belongs to ("People", "Commercial evidence"). A
  // well-made page carries a dozen words of this band furniture against our
  // four, and it shares the tracker's row: kicker left, pills right.
  const kickerText = typeof props.kicker === "string" && props.kicker.trim() ? props.kicker.trim() : null;
  const kicker = [];
  if (kickerText) {
    const measured = measureText(kickerText, 420, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.compact")), bold: true });
    if (measured.lines.length > 1) throw new Error("A kicker must fit on one line");
    // Pill trackers hug the right margin, so the kicker keeps the left of
    // that row. A left-anchored tracker (label, breadcrumb, number strip)
    // already names the section, so it wins the slot and the kicker drops.
    const trackerLeft = tracker.reduce((min, node) => Math.min(min, node.frame ? node.frame.x : Math.min(node.x1 ?? Infinity, node.x2 ?? Infinity)), Infinity);
    const kickerRight = frame.x + CHROME.left + Math.ceil(measured.width) + 2 + tokenValue(token("space.4"));
    if (kickerRight <= trackerLeft) kicker.push(textPrimitive({
      id: stableId(id, "kicker"), role: "kicker",
      frame: { x: frame.x + CHROME.left, y: frame.y + 30, width: Math.ceil(measured.width) + 2, height: measured.height },
      text: kickerText,
      style: { ...textStyle(token("type.compact"), token("color.accent"), true, "left", "top"), lineHeight: measured.lineHeight, wrap: false },
      data: { textLayout: measured }
    }));
  }
  // `subtitle`: the standfirst under the action title - what the page
  // measures, over what population, for what period ("Employment, growth
  // and specialization by subsector"). A well-made title band carries
  // twenty words against our fourteen, and this line is the difference.
  // It sits between the title and the rule, in body type and the
  // secondary colour, so it reads as the title's footnote, not a second title.
  const subtitleText = typeof props.subtitle === "string" && props.subtitle.trim() ? props.subtitle.trim() : null;
  const tagPlacement = props.tag ? houseStyle("style.tagPlacement") : "top-right";
  // An above-title tag (a small accent label, as in a country or section spotlight) sits in the title's top margin.
  const titles = titleNodes({ id, frame, props: { text: props.title, lead: props.titleLead, variant: props.titleVariant, rule: props.titleRule, availableTitleWidth: page.titleWidth, titleTop: props.tracker || kicker.length ? 58 : CHROME.titleTop }, chrome: true });
  const title = titles.find((node) => node.role === "action-title");
  // The rule is drawn below, once the band's height is known.
  const ruled = titles.some((node) => node.role === "title-rule");
  titles.splice(0, titles.length, ...titles.filter((node) => node.role !== "title-rule"));
  let titleBottom = title.frame.y + title.data.textLayout.height;
  // Page tag: PRELIMINARY, ILLUSTRATIVE, CONFIDENTIAL, Exhibit 3. The house
  // style places it: small caps top-right, an accent pill under the title
  // (a survey date), or an accent label above the title (a spotlight).
  if (props.tag) {
    const pill = tagPlacement === "below-title";
    const text = pill || tagPlacement === "above-title" ? String(props.tag).trim() : String(props.tag).trim().toUpperCase();
    const tag = measureText(text, 320, { fontFamily: tokenValue(FONT), fontSize: tokenValue(SOURCE), bold: pill || tagPlacement === "above-title" });
    if (tag.lines.length > 1) throw new Error("Page tag must fit on one line");
    if (pill) {
      const padX = tokenValue(token("space.2")), h = tag.height + 4, y = titleBottom + tokenValue(token("space.2"));
      titles.push(rectPrimitive({ id: stableId(id, "tag-pill"), role: "page-tag-pill", frame: { x: title.frame.x, y, width: Math.ceil(tag.width) + 2 * padX, height: h }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.small")) }));
      titles.push(textPrimitive({ id: stableId(id, "tag"), role: "page-tag", frame: { x: title.frame.x + padX, y: y + 2, width: Math.ceil(tag.width) + 2, height: tag.height }, text, style: { ...textStyle(SOURCE, WHITE, true, "left", "top"), lineHeight: tag.lineHeight, wrap: false }, data: { textLayout: tag, tag: text } }));
      titleBottom = y + h;
    } else if (tagPlacement === "above-title") {
      titles.push(textPrimitive({ id: stableId(id, "tag"), role: "page-tag", frame: { x: title.frame.x, y: title.frame.y - tag.height - 2, width: Math.ceil(tag.width) + 2, height: tag.height }, text, style: { ...textStyle(SOURCE, token("color.accent"), true, "left", "top"), lineHeight: tag.lineHeight, wrap: false }, data: { textLayout: tag, tag: text } }));
    } else {
      titles.push(textPrimitive({ id: stableId(id, "tag"), role: "page-tag", frame: { x: frame.x + frame.width - CHROME.right - Math.ceil(tag.width) - 2, y: frame.y + 22, width: Math.ceil(tag.width) + 2, height: tag.height }, text, style: { ...textStyle(SOURCE, SECONDARY, false, "right", "top"), lineHeight: tag.lineHeight, wrap: false }, data: { textLayout: tag, tag: text } }));
    }
  }
  if (subtitleText) {
    const measured = measureText(subtitleText, page.titleWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY) });
    if (measured.lines.length > 2) throw new Error("A subtitle runs to at most two lines; it names the measure, not the finding");
    const y = titleBottom + tokenValue(token("space.2"));
    titles.push(textPrimitive({
      id: stableId(id, "subtitle"), role: props.subtitleRole === "takeaway-standfirst" ? "takeaway-standfirst" : "action-subtitle",
      frame: { x: frame.x + CHROME.left, y, width: page.titleWidth, height: measured.height },
      text: measured.text,
      style: { ...textStyle(BODY, SECONDARY, false, "left", "top"), lineHeight: measured.lineHeight, wrap: false },
      data: { textLayout: measured }
    }));
    titleBottom = y + measured.height;
  }
  // A tinted title band (the house style `band`) runs from the page top to just under the title.
  const titleRule = props.titleVariant === undefined ? houseStyle("style.titleRule") : "none";
  if (titleRule === "band") {
    titles.unshift(rectPrimitive({ id: stableId(id, "title-band"), role: "title-band", frame: { x: frame.x, y: frame.y, width: frame.width, height: titleBottom + tokenValue(token("space.4")) }, style: boxStyle(MUTED_SURFACE, "none", HAIRLINE, token("radius.none")) }));
  }
  // `block` (keynote): the title reversed out of a full-width block of the
  // primary, which the tracker and kicker share. Everything set on it turns
  // to the reversed colour, so nothing on the block is ink on navy.
  if (titleRule === "block") {
    // The block is its own margin: its contents sit 8px higher than on an
    // open page, and the body starts a small step (space.4) below its edge
    // rather than the standard space.5 below the title.
    const lift = 8;
    for (const node of [...titles, ...tracker, ...kicker]) if (node.frame) node.frame = { ...node.frame, y: node.frame.y - lift };
    titleBottom -= lift;
    const blockBottom = titleBottom + tokenValue(token("space.3"));
    titles.unshift(rectPrimitive({ id: stableId(id, "title-band"), role: "title-band", frame: { x: frame.x, y: frame.y, width: frame.width, height: blockBottom }, style: boxStyle(PRIMARY, "none", HAIRLINE, token("radius.none")), data: { block: true } }));
    for (const node of [...titles, ...tracker, ...kicker]) {
      if (node.type === "text" && node.frame && node.frame.y < blockBottom) {
        node.style = { ...node.style, color: WHITE };
        // An accent lead ("Sector outlook:") keeps its weight but reverses too.
        const plain = (runs) => Array.isArray(runs) ? runs.map((run) => ({ ...run, accent: false })) : runs;
        if (Array.isArray(node.runs)) node.runs = plain(node.runs);
        const layout = node.data?.textLayout;
        if (layout && (layout.runs || layout.sourceRuns)) node.data = { ...node.data, textLayout: { ...layout, runs: plain(layout.runs), sourceRuns: plain(layout.sourceRuns) } };
      }
      else if (node.type === "rect" && node.role !== "title-band" && node.frame?.y < blockBottom) node.style = { ...node.style, fill: token("color.accent") };
    }
    titleBottom = blockBottom - (tokenValue(token("space.5")) - tokenValue(token("space.4")));
  }
  // `tab` (journal): a short thick bar in the accent at the top-left
  // corner, the mark a data briefing is recognised by.
  if (titleRule === "tab") titles.unshift(rectPrimitive({ id: stableId(id, "title-tab"), role: "title-tab", frame: { x: frame.x + CHROME.left, y: frame.y, width: 64, height: 10 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
  const baseBottom = page.contentFrame.y + page.contentFrame.height;
  // One content top for the whole deck: the body starts at CHROME.bodyTop whether
  // the title takes one line or two. Only a three-line title pushes it down.
  const gap = tokenValue(token("space.5"));
  // A tracker above the title (pill tabs, a label) sits in the same band as
  // the title, so the body starts a step lower to keep it off the content.
  const trackerGap = tracker.length || kicker.length ? tokenValue(token("space.3")) : 0;
  const floorTop = Math.max(CHROME.bodyTop + trackerGap, page.logoFrame ? page.logoFrame.y + page.logoFrame.height + gap : 0);
  let contentTop = Math.max(floorTop, titleBottom + gap + trackerGap);
  if (ruled) {
    // The rule closes the title band at a fixed height, the gap above the
    // body, and the title and its standfirst sit on it: a one-line title
    // drops to meet the rule rather than leaving the rule stranded 50px
    // under it, so the rule reads as the title's and the body still
    // starts where it does on every other page. A band too tall for that
    // (two lines and a standfirst) pushes the rule and the body down.
    const ruleGap = tokenValue(token("layout.titleRuleGap"));
    const ruleY = Math.max(floorTop - ruleGap, titleBottom + ruleGap);
    const drop = ruleY - ruleGap - titleBottom;
    const onTitle = (node) => node.frame && (node.role === "action-title" || node.role === "action-subtitle" || node.role === "takeaway-standfirst" || node.role === "page-tag-pill" || (node.role === "page-tag" && tagPlacement !== "top-right"));
    if (drop > 0) for (const node of titles) if (onTitle(node)) node.frame = { ...node.frame, y: node.frame.y + drop };
    titles.push(titleRuleNode(id, frame, ruleY, title.data.titleVariant));
    contentTop = Math.max(floorTop, ruleY + ruleGap);
  }
  const contentFrame = { ...page.contentFrame, y: contentTop, height: baseBottom - contentTop };
  if (contentFrame.height <= 0) throw new Error("Action title leaves no room for slide content; shorten the title or split the slide");
  // The title band paints first; the tracker sits on it, above the title.
  const band = titles.filter((n) => n.role === "title-band" || n.role === "title-tab"), rest = titles.filter((n) => n.role !== "title-band" && n.role !== "title-tab");
  return { ...page, contentFrame, nodes: [...band, ...tracker, ...kicker, ...rest, ...page.nodes] };
}

function defineSlideChrome() {
  return component({
    id: "slide-chrome", category: "shared", role: "slide-chrome",
    tokens: [
      "color.canvas",
      "color.ink",
      "color.componentPrimary",
      "color.accent",
      "color.onPrimary",
      "color.surfaceMuted",
      "color.textSecondary",
      "font.display",
      "font.body",
      "type.source",
      "type.compact",
      "type.heading",
      "type.actionTitle",
      "type.actionTitleLong",
      "layout.titleContentGap",
      "layout.titleRuleGap",
      "line.titleRule",
      "color.rule",
      "space.2",
      "space.4",
      "radius.small",
      "radius.none",
      ...STYLE_TOKENS,
      ...PAGE_TEMPLATE_TOKENS,
      ...TRACKER_TOKENS
    ],
    preferredSize: { width: SLIDE.width, height: SLIDE.height },
    sample: { title: "(Insert action title)", source: "Source: (Insert source)", footerRight: "(Insert company name)", pageNumber: 7 },
    render: renderSlideChrome
  });
}

function definePageTemplate() {
  return component({ id: "page-template", category: "shared", role: "page-template", tokens: PAGE_TEMPLATE_TOKENS,
    preferredSize: { ...SLIDE }, sample: { source: "Source: (Insert source)", companyName: "(Insert company name)", pageNumber: 7 }, render: renderPageTemplate });
}

function defineSection() {
  return component({
    id: "section", category: "structure", role: "section", tokens: ["color.surface", "color.surfaceMuted", "color.rule", "color.ink", "color.accentTint", "color.onPrimary", "space.4", "space.5", "line.standard", "radius.none", "radius.small", ...SECTION_HEADING_TOKENS], preferredSize: { width: 520, height: 300 }, sample: { treatment: "open", heading: "(Insert section heading)" },
    render: ({ id, frame, props }) => {
      const treatment = props.treatment || "open";
      const edge = props.edge || "contained";
      if(!["contained","full-bleed"].includes(edge))throw new Error("Unknown section edge treatment");
      // `card`: a plain surface with padding and no rule - the white card an
      // exhibit sits on over a photograph, where `open` draws nothing at all.
      if (!["open", "muted", "primary", "dark", "tint", "card"].includes(treatment)) throw new Error(`Unknown section treatment: ${treatment}`);
      const padding = sectionPadding(props);
      // Side panels from the 2020–24 decks: a navy "Key insights" column (dark),
      // a grey commentary column (muted) and an accent-tinted message column (tint).
      const fill = treatment === "muted" ? MUTED_SURFACE : treatment === "primary" ? PRIMARY : treatment === "dark" ? INK : treatment === "tint" ? token("color.accentTint") : SURFACE;
      const stroke = treatment === "open" ? RULE : fill;
      const nodes = [];
      const headerFrame = { x: frame.x + padding.left, y: frame.y + padding.top, width: frame.width - padding.left - padding.right, height: frame.height };
      const headerProps = { ...props, variant: treatment === "primary" || treatment === "dark" ? "inverse" : "standard", rule: treatment !== "muted" && treatment !== "tint" };
      if (props.heading) nodes.push(...sectionHeadingNodes({ id: stableId(id, "header"), frame: headerFrame, props: headerProps }));
      const contentFrame = insetFrame(frame, sectionContentInsets(frame, props));
      if (treatment !== "open") nodes.unshift(rectPrimitive({ id: stableId(id, "surface"), role: "section-surface", frame, style: boxStyle(fill, stroke, treatment === "primary" ? STANDARD : HAIRLINE, edge === "full-bleed" ? token("radius.none") : SMALL_RADIUS), data: { edge, contentFrame } }));
      return { nodes, contentFrame };
    }
  });
}

function defineSectionHeading() {
  return component({ id: "section-heading", category: "shared", role: "section-heading", tokens: SECTION_HEADING_TOKENS, preferredSize: { width: 720, height: 52 }, sample: { heading: "(Insert section heading)", rule: true }, render: ({ id, frame, props }) => ({ nodes: sectionHeadingNodes({ id, frame, props }) }) });
}

function defineActionTitle() {
  return component({ id: "action-title", category: "shared", role: "title", tokens: ["font.display", "type.actionTitle", "color.ink", "color.rule", "line.hairline", "space.2"], preferredSize: { width: 1136, height: 86 }, sample: { text: "(Insert action title)" }, render: ({ id, frame, props }) => ({ nodes: titleNodes({ id, frame, props }) }) });
}

function defineSectionTitle() {
  return component({ id: "section-title", category: "shared", role: "title", tokens: ["font.display", "type.sectionTitle", "color.ink", "color.rule", "line.hairline", "space.2"], preferredSize: { width: 720, height: 64 }, sample: { text: "(Insert section title)" }, render: ({ id, frame, props }) => ({ nodes: titleNodes({ id, frame, props, section: true }) }) });
}

function defineCover() {
  return component({
    id: "cover",
    category: "navigation",
    role: "cover",
    tokens: [
      "style.coverLayout", "type.coverTitle", "color.surface", "radius.small", "type.metric", "type.actionTitle", "color.accent",
      "color.rule", "color.ink", "color.canvas", "color.onPrimary", "color.textSecondary", "color.componentPrimary", "color.chartSeries4",
      "color.accentTint", "font.display", "font.body", "type.deckTitle", "type.heading", "type.body", "type.compact", "space.2", "space.5",
      "line.hairline", "line.standard", "radius.none"
    ],
    preferredSize: { width: 1280, height: 720 },
    sample: { title: "(Insert presentation title)", subtitle: "(Insert subtitle)" },
    render: ({ id, frame, props }) => {
      if (typeof props.title !== "string" || !props.title.trim()) throw new Error("Cover requires a deck title");
      if (props.subtitle !== undefined && typeof props.subtitle !== "string") throw new Error("Cover subtitle must be text");
      // The compiler supplies headerBandHeight to every component as layout metadata.
      if (Object.keys(props).some(key => !["title", "subtitle", "date", "logo", "tone", "headerBandHeight", "marks"].includes(key))) throw new Error("Cover supports title, subtitle, date, logo, marks and tone; use the page template for other furniture");
      // A design system other than the consulting block builds its own cover.
      const coverLayout = houseStyle("style.coverLayout");
      // A cover drawn into a card or a half page (a photograph beside it) keeps
      // the block construction in the system's type and colours.
      if (coverLayout !== "block" && frame.width >= SLIDE.width) return { nodes: designedCoverNodes(coverLayout, { id, frame, props }) };
      // Dark tone is the gallery default: navy full bleed, title block in the
      // lower third, a logo slot top-left, a date line under the subtitle.
      const dark = (props.tone ?? "dark") === "dark";
      // On navy the subtitle takes the accent tint when it reads (a dark green
      // fourth series does not), white otherwise.
      const tint = token("color.accentTint");
      const ink = dark ? WHITE : INK, secondary = dark ? (contrastRatio(tokenValue(INK), tokenValue(tint)) >= 4.5 ? tint : WHITE) : SECONDARY;
      const width = Math.min(frame.width - CHROME.left - CHROME.right, frame.width * 0.72);
      // Fit ladder: a design system's large cover title steps down through the
      // metric and action-title sizes when the cover is a card or a half page.
      let titleSize = token("type.coverTitle"), title;
      for (const id of ["type.coverTitle", "type.deckTitle", "type.metric", "type.actionTitle"]) {
        if (title && tokenValue(token(id)) >= tokenValue(titleSize)) continue;
        titleSize = token(id);
        title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(titleSize), bold: true });
        if (title.lines.length <= 3 && title.height <= frame.height * 0.36) break;
      }
      const subtitle = props.subtitle?.trim() ? measureText(props.subtitle, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")) }) : null;
      const date = props.date?.trim() ? measureText(props.date, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY) }) : null;
      const gap = tokenValue(token("space.5")), small = tokenValue(token("space.2"));
      const height = title.height + (subtitle ? gap + subtitle.height : 0) + (date ? gap + date.height : 0);
      if (title.lines.length > 3 || subtitle?.lines.length > 2 || height > frame.height * 0.6) throw new Error("Cover text exceeds its allocated space; shorten the title or subtitle");
      const x = frame.x + CHROME.left;
      // Anchor the block so its bottom sits at 78% of the page; a taller block grows upward.
      let y = frame.y + frame.height * 0.78 - height;
      const nodes = [];
      if (dark) nodes.push(rectPrimitive({ id: stableId(id, "surface"), role: "cover-surface", frame, style: boxStyle(INK, INK, HAIRLINE, token("radius.none")) }));
      // `marks`: the players the deck compares, their logos on white tiles in
      // the band above the title - a cover about two companies shows them
      // before a word is read, and the top half of the page carries them
      // rather than nothing.
      const marks = (props.marks || []).filter((mark) => mark?.dataUri).slice(0, 4);
      if (marks.length && frame.width >= SLIDE.width) {
        const tileHeight = 112, tileWidth = 208, tileGap = tokenValue(token("space.5"));
        const top = frame.y + frame.height * 0.2;
        marks.forEach((mark, at) => {
          const tile = { x: x + at * (tileWidth + tileGap), y: top, width: tileWidth, height: tileHeight };
          nodes.push(rectPrimitive({ id: stableId(id, "mark-tile", at), role: "cover-mark-tile", frame: tile, style: boxStyle(token("color.surface"), "none", HAIRLINE, token("radius.small")) }));
          nodes.push(mediaNode({ id: stableId(id, "mark", at), frame: logoFrame({ x: tile.x + 20, y: tile.y + 16, width: tileWidth - 40, height: tileHeight - 32 }, mark.width, mark.height, { area: (tileWidth - 40) * (tileHeight - 32) * 0.5 }), props: mark, role: "cover-mark" }));
        });
      }
      // Accent rule above the title: the one graphic element on a text cover.
      nodes.push(openLine(stableId(id, "accent"), x, y - gap, x + 72, y - gap, "cover-accent", PRIMARY, token("line.standard")));
      if (props.logo?.trim()) {
        const logo = measureText(props.logo, 320, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.heading")), bold: true });
        nodes.push(textPrimitive({ id: stableId(id, "logo"), role: "cover-logo", frame: { x, y: frame.y + CHROME.titleTop, width: 320, height: logo.height }, text: logo.text, style: { ...textStyle(token("type.heading"), ink, true, "left", "top"), fontFamily: DISPLAY, lineHeight: logo.lineHeight, wrap: false }, data: { textLayout: logo } }));
      }
      nodes.push(textPrimitive({ id: stableId(id, "title"), role: "cover-title", frame: { x, y, width, height: title.height }, text: title.text, style: { ...textStyle(titleSize, ink, true, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }));
      y += title.height;
      if (subtitle) { y += gap; nodes.push(textPrimitive({ id: stableId(id, "subtitle"), role: "cover-subtitle", frame: { x, y, width, height: subtitle.height }, text: subtitle.text, style: { ...textStyle(token("type.heading"), secondary, false, "left", "top"), lineHeight: subtitle.lineHeight, wrap: false }, data: { textLayout: subtitle } })); y += subtitle.height; }
      if (date) { y += gap; nodes.push(textPrimitive({ id: stableId(id, "date"), role: "cover-date", frame: { x, y, width, height: date.height }, text: date.text, style: { ...textStyle(BODY, secondary, false, "left", "top"), lineHeight: date.lineHeight, wrap: false }, data: { textLayout: date } })); }
      return { nodes };
    }
  });
}

/** The section divider page: its surface, part label, numeral, title, summary and the contents beside it, in the house's divider layout. */
function renderSectionDivider({ id, frame, props }) {
  if (typeof props.title !== "string" || !props.title.trim()) throw new Error("Section divider requires a section title");
  for (const key of Object.keys(props))
    if (!["title", "subtitle", "sectionId", "style", "mode", "contents", "contentsActive", "pageTemplate", "source", "note", "companyName", "pageNumber", "footerLeft", "footerRight", "headerBandHeight", "panelWidth"].includes(key))
      throw new Error(
        `Unknown section-divider setting: ${key}; dividers have one title, an optional subtitle and section id, the deck's contents, and page furniture`
      );
  // The design system decides the chapter page's ground: the consulting
  // panel is dark, the editorial and journal pages sit on the canvas, the
  // keynote page is a field of the primary.
  const dividerLayout = houseStyle("style.dividerLayout");
  const inverse = dividerLayout === "panel" ? (props.mode ?? "dark") === "dark" : dividerLayout === "keynote";
  const dividerStyle = props.style ?? "plain";
  if (!["plain", "numbered"].includes(dividerStyle)) throw new Error(`Unknown section-divider style: ${dividerStyle}`);
  if (dividerStyle === "numbered" && !String(props.sectionId ?? "").trim()) throw new Error("Numbered section divider requires sectionId");
  const page = renderPageTemplate({ id: stableId(id, "page"), frame, props: { ...props, inverse } });
  // With a photograph beside it (registry-media.mjs) the divider keeps a left panel of
  // `panelWidth`; the numeral then sits above the title instead of at the right.
  const panelWidth = props.panelWidth ?? null;
  const surfaceFrame = panelWidth ? { ...frame, width: panelWidth } : frame;
  // The deck's contents down the right, the section this page opens on a
  // band: a reader who met the contents page at the front sees the same
  // list again with the band one row lower. A tracker that never moves is
  // not a tracker, and a contents page shown once and never again leaves
  // the reader to keep the place themselves. With a photograph beside the
  // divider there is no room for it, and it is dropped.
  const contents = !panelWidth && Array.isArray(props.contents) && props.contents.length >= 2
    ? props.contents.map((entry) => String(entry?.label ?? entry ?? "").trim()).filter(Boolean) : [];
  const contentsActive = Number.isInteger(props.contentsActive) ? props.contentsActive : -1;
  const railX = frame.x + Math.round(frame.width * 0.62), railWidth = frame.width - railX - CHROME.right;
  const width = contents.length ? railX - CHROME.left - frame.x - 48
    : panelWidth ? panelWidth - CHROME.left - 24 : dividerStyle === "numbered" ? frame.width * 0.58 - CHROME.left : frame.width - CHROME.left - CHROME.right;
  const titleBold = dividerLayout !== "editorial";
  const title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")), bold: titleBold });
  if (title.lines.length > (panelWidth ? 3 : 2) || title.height > frame.height - 2 * CHROME.bodyTop) throw new Error("Section divider title exceeds its allocated space; shorten the section title");
  const background = dividerLayout === "keynote" ? PRIMARY : inverse ? INK : token("color.canvas"), foreground = inverse ? WHITE : INK;
  if (contrastRatio(tokenValue(background), tokenValue(foreground)) < 4.5) throw new Error("Section divider title contrast must be at least 4.5:1");
  // A short accent rule above the title and the section's one-line summary
  // below it, in the same block, so the divider says what the section shows.
  if (props.subtitle !== undefined && typeof props.subtitle !== "string") throw new Error("Section divider subtitle must be text");
  const subtitle = typeof props.subtitle === "string" && props.subtitle.trim() ? measureText(props.subtitle.trim(), width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")) }) : null;
  const ruleGap = tokenValue(token("space.4")), subGap = tokenValue(token("space.3"));
  // The title holds the page's centre line; the accent bar sits above it and the summary below.
  const titleTop = frame.y + (frame.height - title.height) / 2;
  const rail = [];
  if (contents.length) {
    const rowGap = 10, muted = inverse ? token("color.chartGrid") : SECONDARY;
    const measured = contents.map((label, index) => measureText(label, railWidth - 24, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.body")), bold: index === contentsActive }));
    const heights = measured.map((m) => m.height + 14);
    const block = heights.reduce((sum, h) => sum + h, 0) + rowGap * (contents.length - 1);
    let rowY = frame.y + (frame.height - block) / 2;
    contents.forEach((label, index) => {
      const active = index === contentsActive, rid = stableId(id, "contents", index);
      if (active) rail.push(rectPrimitive({ id: stableId(rid, "band"), role: "divider-contents-active", frame: { x: railX - 12, y: rowY, width: railWidth + 12, height: heights[index] }, style: boxStyle(inverse ? token("color.componentPrimaryTint") : PRIMARY_TINT, "none", HAIRLINE, token("radius.small")), data: { index } }));
      rail.push(
        textPrimitive({
          id: stableId(rid, "label"),
          role: "divider-contents",
          frame: { x: railX, y: rowY + 7, width: railWidth - 24, height: measured[index].height },
          text: measured[index].text,
          style: {
            ...textStyle(token("type.body"), active ? INK : muted, active, "left", "top"),
            lineHeight: measured[index].lineHeight,
            wrap: false
          },
          data: { index, active, textLayout: measured[index] }
        })
      );
      rowY += heights[index] + rowGap;
    });
  }
  // Each system marks the chapter its own way: an accent bar over the title
  // (panel, keynote), a full-measure hairline under it with the section's
  // number set small in the accent above (editorial), the accent tab at the page's top
  // edge with the section number set in the accent (journal).
  const surfaceRight = surfaceFrame.x + surfaceFrame.width - (panelWidth ? 24 : CHROME.right);
  const marker = dividerLayout === "editorial"
    ? [openLine(stableId(id, "accent-rule"), frame.x + CHROME.left, titleTop + title.height + subGap / 2, surfaceRight, titleTop + title.height + subGap / 2, "divider-accent", RULE, HAIRLINE)]
    : dividerLayout === "journal"
      ? [rectPrimitive({ id: stableId(id, "accent-bar"), role: "divider-accent", frame: { x: frame.x + CHROME.left, y: frame.y, width: 96, height: 14 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) })]
      : [rectPrimitive({ id: stableId(id, "accent-bar"), role: "divider-accent", frame: { x: frame.x + CHROME.left, y: titleTop - ruleGap - 4, width: 64, height: 4 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) })];
  const partLabel = String(props.sectionId ?? "").trim() && ["editorial", "journal"].includes(dividerLayout)
    ? measureText(String(props.sectionId).trim().padStart(2, "0"), width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token(dividerLayout === "editorial" ? "type.compact" : "type.metric")), bold: true })
    : null;
  if (partLabel)
    marker.push(
      textPrimitive({
        id: stableId(id, "part"),
        role: "divider-number",
        frame: { x: frame.x + CHROME.left, y: titleTop - ruleGap - partLabel.height, width, height: partLabel.height },
        text: partLabel.text,
        style: {
          ...textStyle(
            dividerLayout === "editorial" ? token("type.compact") : token("type.metric"),
            token("color.accent"),
            true,
            "left",
            "top"
          ),
          fontFamily: FONT,
          lineHeight: partLabel.lineHeight,
          wrap: false
        },
        data: { sectionId: String(props.sectionId), dividerStyle, textLayout: partLabel }
      })
    );
  const bigNumeral = dividerStyle === "numbered" && !partLabel;
  return { ...page, nodes: [
    rectPrimitive({ id: stableId(id, "surface"), role: "divider-surface", frame: surfaceFrame, style: boxStyle(background, background, HAIRLINE, token("radius.none")) }),
    ...marker,
    textPrimitive({ id: stableId(id, "title"), role: "divider-title", frame: { x: frame.x + CHROME.left, y: titleTop, width, height: title.height }, text: title.text, style: { ...textStyle(token("type.deckTitle"), foreground, titleBold, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }),
    ...(subtitle ? [textPrimitive({ id: stableId(id, "subtitle"), role: "divider-subtitle", frame: { x: frame.x + CHROME.left, y: titleTop + title.height + subGap, width, height: subtitle.height }, text: subtitle.text, style: { ...textStyle(token("type.heading"), foreground, false, "left", "top"), lineHeight: subtitle.lineHeight, wrap: false }, data: { textLayout: subtitle } })] : []),
    ...(bigNumeral && (panelWidth || contents.length)
      ? [
        textPrimitive({
          id: stableId(id, "number"),
          role: "divider-number",
          frame: { x: frame.x + CHROME.left, y: frame.y + 48, width, height: Math.max(80, titleTop - ruleGap - 24 - (frame.y + 48)) },
          text: String(props.sectionId),
          style: { ...textStyle(token("type.sectionNumber"), inverse ? WHITE : PRIMARY, true, "left", "bottom"), fontFamily: FONT },
          data: { sectionId: String(props.sectionId), dividerStyle }
        })
      ]
      : []),
    ...(bigNumeral && !panelWidth && !contents.length
      ? [
        textPrimitive({
          id: stableId(id, "number"),
          role: "divider-number",
          frame: { x: frame.x + frame.width * 0.67, y: frame.y + 110, width: frame.width * 0.25, height: frame.height - 220 },
          text: String(props.sectionId),
          style: { ...textStyle(token("type.sectionNumber"), inverse ? WHITE : PRIMARY, true, "center", "mid"), fontFamily: FONT },
          data: { sectionId: String(props.sectionId), dividerStyle }
        })
      ]
      : []),
    ...rail,
    ...page.nodes
  ] };
}

function defineSectionDivider() {
  return component({
    id: "section-divider",
    category: "navigation",
    role: "divider",
    tokens: [
      "style.dividerLayout",
      "color.rule",
      "type.metric",
      "type.compact",
      "color.canvas",
      "color.ink",
      "color.componentPrimary",
      "color.onPrimary",
      "color.accent",
      "color.chartGrid",
      "color.componentPrimaryTint",
      "color.textSecondary",
      "font.display",
      "font.body",
      "type.deckTitle",
      "type.heading",
      "type.body",
      "type.sectionNumber",
      "line.hairline",
      "radius.none",
      "radius.small",
      "space.3",
      "space.4",
      ...PAGE_TEMPLATE_TOKENS
    ],
    preferredSize: { ...SLIDE },
    sample: { title: "(Insert section title)" },
    render: renderSectionDivider
  });
}

// A closing page: navy, "Key takeaways", the
// three or four messages as big serif numerals with bold copy, an optional
// photograph on the right (registry-media.mjs). Structural, like a divider.
function defineTakeaways() {
  return component({
    id: "takeaways",
    category: "navigation",
    role: "takeaways",
    tokens: [
      "color.canvas",
      "color.ink",
      "color.onPrimary",
      "color.accent",
      "color.rule",
      "color.chartGrid",
      "font.display",
      "font.body",
      "type.deckTitle",
      "type.heading",
      "type.sectionTitle",
      "type.body",
      "line.hairline",
      "radius.none",
      "space.3",
      "space.4",
      ...PAGE_TEMPLATE_TOKENS
    ],
    preferredSize: { ...SLIDE },
    sample: { title: "Key takeaways", items: ["(Insert takeaway 1)", "(Insert takeaway 2)", "(Insert takeaway 3)"] },
    render: ({ id, frame, props }) => {
      for (const key of Object.keys(props)) if (!["title", "items", "mode", "panelWidth", "pageTemplate", "source", "note", "companyName", "pageNumber", "footerLeft", "footerRight", "headerBandHeight"].includes(key)) throw new Error(`Unknown takeaways setting: ${key}`);
      if (!Array.isArray(props.items) || props.items.length < 2 || props.items.length > 5) throw new Error("Takeaways take two to five messages");
      const inverse = (props.mode ?? "dark") === "dark";
      const page = renderPageTemplate({ id: stableId(id, "page"), frame, props: { ...props, inverse } });
      const background = inverse ? INK : token("color.canvas"), foreground = inverse ? WHITE : INK;
      const panelWidth = props.panelWidth ?? frame.width;
      const x = frame.x + CHROME.left, width = panelWidth - CHROME.left - (props.panelWidth ? 32 : CHROME.right);
      const title = measureText(props.title || "Key takeaways", width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.sectionTitle")), bold: true });
      const titleTop = frame.y + CHROME.titleTop + 8;
      const numeralWidth = 64, gap = tokenValue(token("space.4"));
      const items = props.items.map((item) => { if (typeof item !== "string" || !item.trim()) throw new Error("Takeaways are text"); return measureTakeaway(item, width - numeralWidth); });
      const listTop = titleTop + title.height + gap + 12, listBottom = frame.y + frame.height - CHROME.bodyTop - 24;
      // Dividing the whole track by the item count gives three one-line messages
      // a 150px row each and leaves the bottom half of the page empty. The rows
      // take their own height plus a reading gap, the slack opens that gap up
      // to about a line and a half, and whatever is still left over centres the
      // block rather than stretching it.
      const naturalHeights = items.map((item) => item.height + 8);
      const natural = naturalHeights.reduce((sum, height) => sum + height, 0);
      const track = listBottom - listTop;
      if (natural > track) throw new Error("Takeaways exceed the page; shorten them or use fewer");
      const spread = items.length > 1 ? Math.min((track - natural) / (items.length - 1), TAKEAWAY_SPREAD) : 0;
      const block = natural + spread * (items.length - 1);
      const top = listTop + Math.max(0, (track - block) / 2);
      const nodes = [
        rectPrimitive({ id: stableId(id, "surface"), role: "takeaways-surface", frame: { ...frame, width: panelWidth }, style: boxStyle(background, background, HAIRLINE, token("radius.none")) }),
        textPrimitive({ id: stableId(id, "title"), role: "takeaways-title", frame: { x, y: titleTop, width, height: title.height }, text: title.text, style: { ...textStyle(token("type.sectionTitle"), foreground, true, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }),
        openLine(stableId(id, "rule"), x, titleTop + title.height + gap / 2, x + width, titleTop + title.height + gap / 2, "takeaways-rule", inverse ? WHITE : RULE, HAIRLINE),
      ];
      let rowY = top;
      items.forEach((item, index) => {
        const y = rowY + (naturalHeights[index] - item.height) / 2;
        rowY += naturalHeights[index] + spread;
        nodes.push(textPrimitive({ id: stableId(id, "numeral", index), role: "takeaways-numeral", frame: { x, y: y - 6, width: numeralWidth - 12, height: item.height + 12 }, text: String(index + 1), style: { ...textStyle(token("type.deckTitle"), inverse ? WHITE : token("color.accent"), true, "left", "top"), fontFamily: FONT, wrap: false } }));
        // The lead clause in bold, the rest regular: four sixty-word messages
        // set wholly in bold are a wall of one weight.
        nodes.push(
          textPrimitive({
            id: stableId(id, "item", index),
            role: "takeaways-item",
            frame: { x: x + numeralWidth, y, width: width - numeralWidth, height: item.height },
            text: item.text,
            ...(item.runs ? { runs: item.runs } : {}),
            style: {
              ...textStyle(token("type.heading"), foreground, !item.runs && textWords(item.lines.join(" ")) <= 16, "left", "top"),
              lineHeight: item.lineHeight,
              wrap: false
            },
            data: { textLayout: item }
          })
        );
        // A hairline between messages, in the middle of the gap, so the
        // spread reads as rows of a list rather than as air.
        if (index < items.length - 1 && spread >= 24) nodes.push(openLine(stableId(id, "divider", index), x + numeralWidth, rowY - spread / 2, x + width, rowY - spread / 2, "takeaways-divider", inverse ? token("color.chartGrid") : RULE, HAIRLINE));
      });
      return { ...page, nodes: [...nodes, ...page.nodes] };
    },
    measureContent: ({ frame, props }) => {
      const width = (props.panelWidth ?? frame.width) - CHROME.left - CHROME.right;
      const title = measureText(props.title || "Key takeaways", width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.sectionTitle")), bold: true });
      const items = (Array.isArray(props.items) ? props.items : []).map((item) => measureTakeaway(String(item), width - 64));
      return { height: CHROME.titleTop + 8 + title.height + tokenValue(token("space.4")) + 12 + items.reduce((sum, item) => sum + item.height + 16, 0) };
    }
  });
}

// The statement page: one sentence set large and
// centred, its key phrase in the accent (bold white on navy), a short accent
// rule above; with a photograph (registry-media.mjs) the sentence sits on a navy card.
function defineStatement() {
  return component({
    id: "statement",
    category: "navigation",
    role: "statement",
    tokens: [
      "color.canvas",
      "color.ink",
      "color.onPrimary",
      "color.accent",
      "font.display",
      "font.body",
      "type.deckTitle",
      "type.heading",
      "line.hairline",
      "line.standard",
      "radius.none",
      "space.4",
      "space.5",
      ...PAGE_TEMPLATE_TOKENS
    ],
    preferredSize: { ...SLIDE },
    sample: {
      text: "The pandemic has been a catalyst for existing digital users to adopt new online services.",
      accent: ["adopt new online services"]
    },
    render: ({ id, frame, props }) => {
      for (const key of Object.keys(props)) if (!["text", "accent", "subtext", "mode", "card", "pageTemplate", "source", "note", "companyName", "pageNumber", "footerLeft", "footerRight", "headerBandHeight"].includes(key)) throw new Error(`Unknown statement setting: ${key}`);
      if (typeof props.text !== "string" || !props.text.trim()) throw new Error("Statement requires text");
      const inverse = (props.mode ?? "light") === "dark";
      const page = renderPageTemplate({ id: stableId(id, "page"), frame, props: { ...props, inverse } });
      const phrases = (Array.isArray(props.accent) ? props.accent : props.accent ? [props.accent] : []).filter((p) => typeof p === "string" && p.trim());
      // Split the sentence into runs at each accent phrase, in order of appearance.
      const runs = [];
      let rest = props.text.trim();
      while (rest.length) {
        const hits = phrases.map((p) => ({ p, at: rest.indexOf(p) })).filter((h) => h.at >= 0).sort((a, b) => a.at - b.at);
        if (!hits.length) { runs.push({ text: rest, bold: false }); break; }
        const { p, at } = hits[0];
        if (at > 0) runs.push({ text: rest.slice(0, at), bold: false });
        runs.push({ text: p, bold: true, ...(inverse ? {} : { accent: true }) });
        rest = rest.slice(at + p.length);
      }
      const card = props.card ?? null;
      const width = card ? card.width - 2 * tokenValue(token("space.5")) : Math.round(frame.width * 0.72);
      const fontSize = tokenValue(token("type.deckTitle"));
      const layout = measureTextRuns(runs, width, { fontFamily: tokenValue(DISPLAY), fontSize });
      if (layout.lines.length > 5) throw new Error("Statement runs to more than five lines; shorten it");
      const sub = typeof props.subtext === "string" && props.subtext.trim() ? measureText(props.subtext.trim(), width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")) }) : null;
      const gap = tokenValue(token("space.4"));
      const blockHeight = 4 + gap + layout.height + (sub ? gap + sub.height : 0);
      const cx = card ? card.x + card.width / 2 : frame.x + frame.width / 2;
      const top = card ? card.y + (card.height - blockHeight) / 2 : frame.y + (frame.height - blockHeight) / 2;
      const background = inverse ? INK : token("color.canvas"), foreground = inverse || card ? WHITE : INK;
      const nodes = [];
      if (!card) nodes.push(rectPrimitive({ id: stableId(id, "surface"), role: "statement-surface", frame, style: boxStyle(background, background, HAIRLINE, token("radius.none")) }));
      nodes.push(rectPrimitive({ id: stableId(id, "accent-bar"), role: "divider-accent", frame: { x: cx - 32, y: top, width: 64, height: 4 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "text"), role: "statement-text", frame: { x: cx - width / 2, y: top + 4 + gap, width, height: layout.height }, text: layout.text, runs: layout.runs, style: { ...textStyle(token("type.deckTitle"), foreground, false, "center", "top"), fontFamily: DISPLAY, lineHeight: layout.lineHeight, wrap: false }, data: { textLayout: layout } }));
      if (sub) nodes.push(textPrimitive({ id: stableId(id, "subtext"), role: "statement-subtext", frame: { x: cx - width / 2, y: top + 4 + gap + layout.height + gap, width, height: sub.height }, text: sub.text, style: { ...textStyle(token("type.heading"), foreground, false, "center", "top"), lineHeight: sub.lineHeight, wrap: false }, data: { textLayout: sub } }));
      return { ...page, nodes: [...nodes, ...page.nodes] };
    },
    measureContent: ({ frame, props }) => {
      const width = Math.round(frame.width * 0.72);
      const layout = measureText(String(props.text ?? ""), width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")) });
      return { height: 4 + 2 * tokenValue(token("space.4")) + layout.height };
    }
  });
}

function defineSource() {
  return component({ id: "source", category: "shared", role: "source", tokens: ["font.body", "type.source", "color.textSecondary", "color.rule", "line.hairline"], preferredSize: { width: 920, height: 26 }, sample: { text: "Source: (Insert source)" }, render: ({ id, frame, props }) => {
    const variant = resolveTitleVariant(props);
    return { nodes: [...(variant === "with-line" ? [openLine(stableId(id, "rule"), frame.x, frame.y, frame.x + frame.width, frame.y, "source-rule", RULE, HAIRLINE)] : []), textPrimitive({ id: stableId(id, "text"), role: "source-text", frame: { x: frame.x, y: frame.y + 4, width: frame.width, height: frame.height - 4 }, text: props.text, style: textStyle(SOURCE, SECONDARY, false, "left") })] };
  } });
}

function defineFootnote() {
  return component({
    id: "footnote",
    category: "shared",
    role: "footnote",
    tokens: ["font.body", "type.source", "color.textSecondary"],
    preferredSize: { width: 600, height: 34 },
    sample: { text: "Note: (Insert note)" },
    render: ({ id, frame, props }) => ({
      nodes: [
        textPrimitive({
          id: stableId(id, "text"),
          role: "footnote-text",
          frame,
          text: props.text,
          style: textStyle(SOURCE, SECONDARY, false, "left", "top")
        })
      ]
    })
  });
}

function definePageNumber() {
  return component({
    id: "page-number",
    category: "shared",
    role: "page-number",
    tokens: ["font.body", "type.source", "color.textSecondary"],
    preferredSize: { width: 48, height: 24 },
    sample: { value: 7 },
    render: ({ id, frame, props }) => ({
      nodes: [
        textPrimitive({
          id: stableId(id, "text"),
          role: "page-number",
          frame,
          text: String(props.value),
          style: textStyle(SOURCE, SECONDARY, false, "right")
        })
      ]
    })
  });
}

/** Page chrome and structure: the slide chrome, page template, sections and their headings, titles, cover, divider, takeaways, statement and footer lines. */
export function registerChrome(registry) {
  const definitions = [defineSectionBoundary(), defineSlideChrome(), definePageTemplate(), defineSection(), defineSectionHeading(),
    defineActionTitle(), defineSectionTitle(), defineCover(), defineSectionDivider(), defineTakeaways(), defineStatement(), defineSource(),
    defineFootnote(), definePageNumber()];
  for (const definition of definitions) {
    refineVariantAxes(definition);
    if (definition.id === "section") definition.measureInsets = ({ frame, props }) => sectionContentInsets(frame, props);
    if (definition.id === "section-heading") definition.variants.inverse = { backdrop: "primary" };
    if (definition.id === "section-boundary") definition.variants.subsection = { preferredSize: { width: 520, height: 24 } };
    if (["action-title", "section-title", "slide-chrome"].includes(definition.id)) {
      definition.variants = TITLE_VARIANTS;
      definition.defaultVariant = DEFAULT_TITLE_VARIANT;
      definition.variantProp = definition.id === "slide-chrome" ? "titleVariant" : "variant";
      definition.resolveVariant = definition.id === "slide-chrome"
        ? (props = {}) => props.titleVariant === undefined && props.titleRule === undefined ? (houseStyle("style.titleRule") === "rule" ? "with-line" : DEFAULT_TITLE_VARIANT) : resolveTitleVariant({ variant: props.titleVariant, rule: props.titleRule })
        : resolveTitleVariant;
    }
    if (definition.id === "slide-chrome") {
      definition.version = "2.1.0";
      definition.examples = { "compact-content-spacing": { props: { pageTemplate: { contentSpacing: "compact" } } } };
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
    refineSectionHeader(definition);
    registry.set(definition.id, definition);
  }
  return registry;
}
