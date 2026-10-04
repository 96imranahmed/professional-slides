import { CHROME, SLIDE, component, linePrimitive, stableId, textPrimitive, token, tokenValue } from "./core.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";
import { textWords } from "./text-contract.mjs";

export const PAGE_RULES = ["none", "bottom", "top-and-bottom"];
export const PAGE_BRANDING = ["footer-company", "top-right-logo", "none"];
export const PAGE_TEMPLATE_TOKENS = ["font.body", "type.source", "color.textSecondary", "color.onPrimary", "color.rule", "line.hairline", "space.2", "space.4", "space.5"];

// The footer row is furniture inside the page's own margin system, so the
// clearance under it is measured against the page's side margin (CHROME.left /
// CHROME.right) rather than left to CHROME.footerTop: the row's bottom edge
// keeps this share of that margin clear of the page's bottom edge. At
// CHROME.footerTop + the row height the row would end at 706 on a 720 page -
// 14px against a 60px side margin - and the page number would read as though
// it had slipped off the page.
//
// A third of the margin, not half of it, because the padding is taken out of
// the band the footer already shares with the body - space.4 above the row,
// then the row's own 22px - rather than out of the body's height: the content
// frame keeps every pixel it had, and the row rises into its own clearance,
// which falls from 16px to 10px. Half a margin would spend all of it and seat
// the footer text under the body's last line.
export const FOOTER_EDGE_MARGIN_RATIO = 1 / 3;
// Page numbers are guidelines, so the footer is a fixed-width element: every
// number is zero-padded to the digits of the deck's highest page number, which
// is also how the contents page numbers its sections (01-06). A deck that does
// not declare its length pads to this many digits, because a deck long enough
// to number its pages runs past page 9 and the width must not change under the
// reader halfway through.
export const PAGE_NUMBER_MIN_DIGITS = 2;

function assertPageCount(value) {
  if (!Number.isInteger(value) || value < 1) throw new Error("Page count must be a positive whole number of pages");
}

// A citation, and a note, each take at most this many footer lines. A citation the author typed is
// refused past them; one the runtime derived from registry keys arrives with
// its shorter forms (`sourceForms`, page-types.mjs citationForms) and is set
// in the fullest that fits, so the runtime never refuses its own footer.
export const FOOTER_LINES_MAX = 3;
// A registry source's `name` is its title - the publisher, the publication and
// its year - `short` the form the footer falls back to, and `status` what kind
// of record it is ("audited", "company-reported", "unaudited half-year
// release"). The runtime writes them into the footer as a derived citation,
// and each is held to the length of what it is: the long titles of real
// publications (an agency and the full name of its annual survey, with year
// and edition) run to twelve or fourteen words and the examples' longest is
// seven; a status is a label of a word or two, and five words hold the longest
// honest one. A caveat or a method is a `note`. The footer as drawn is counted
// by `NOTE_HEAVY` whoever wrote it, so these limits are not what keeps prose
// out of the footer; they keep a registry entry what it says it is.
export const SOURCE_TITLE_WORDS = Object.freeze({ name: 16, short: 8, status: 5 });

export function resolvePageTemplate(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("pageTemplate must be an object");
  for (const key of Object.keys(input)) if (!["rules", "branding", "sourcePlacement", "companyName", "logo", "contentSpacing", "pageCount"].includes(key)) throw new Error(`Unknown pageTemplate setting: ${key}`);
  const result = { rules: "none", branding: "footer-company", sourcePlacement: "inline", contentSpacing: "standard", ...input };
  if (!["standard", "compact"].includes(result.contentSpacing)) throw new Error("Unknown page-template contentSpacing");
  // The deck's length is a page-template setting so it reaches every page's
  // footer through the template the deck already carries. It stays absent
  // unless a deck declares it, so a manifest gains no key it did not ask for.
  if (result.pageCount !== undefined) assertPageCount(result.pageCount);
  if (!PAGE_RULES.includes(result.rules)) throw new Error(`Unknown page-template rules: ${result.rules}`);
  if (!PAGE_BRANDING.includes(result.branding)) throw new Error(`Unknown page-template branding: ${result.branding}`);
  if (!["inline", "separate"].includes(result.sourcePlacement)) throw new Error("Unknown page-template sourcePlacement");
  if (result.branding === "top-right-logo" && (!result.logo?.component || ["slide-chrome", "page-template", "section-divider"].includes(result.logo.component))) throw new Error("Top-right branding requires a registered logo component and props");
  if (result.logo && result.branding !== "top-right-logo") throw new Error("Logo requires top-right-logo branding");
  return result;
}

// Page furniture shares one measured footer row. Sources wrap upward, never
// underneath the page number or company; extra notes consume explicit body space.
export function pageTemplateLayout(frame, props = {}) {
  if (frame.width !== SLIDE.width || frame.height !== SLIDE.height) throw new Error("Page templates require the complete slide frame");
  const template = resolvePageTemplate(props.pageTemplate);
  const left = frame.x + CHROME.left, right = frame.x + frame.width - CHROME.right;
  const gap = tokenValue(token("space.4")), smallGap = tokenValue(token("space.2"));
  const rowTop = frame.y + CHROME.footerTop, rowHeight = 22;
  // Every footer element - the row, a wrapped source, a separate source and the
  // footer rule - is laid out on CHROME's own datums and then lifted by this one
  // measure, so the distances CHROME encodes between them are unchanged and only
  // the band's clearance from the page edge grows. The body is measured before
  // the lift (`contentFrame` below), so the padding comes out of the footer's
  // clearance, not out of the page's content height. A template that already
  // seats the footer higher than the padding asks for (configureChrome({
  // footerTop })) keeps its own placement: this is a floor on the clearance.
  const edgePadding = Math.round(Math.min(CHROME.left, CHROME.right) * FOOTER_EDGE_MARGIN_RATIO);
  const footerLift = Math.max(0, edgePadding - (frame.height - CHROME.footerTop - rowHeight));
  const style = { fontFamily: token("font.body"), fontSize: token("type.source"), color: token(props.inverse ? "color.onPrimary" : "color.textSecondary"), bold: false, align: "left", valign: "top", wrap: false };
  const measure = (value, width) => measureText(value, width, { fontSize: tokenValue(style.fontSize), wrapWidthRatio: ENGINE_RESERVE });
  // The deck's length reaches the footer through the page template the deck
  // already carries: `pageTemplate.pageCount` is merged into every slide's
  // chrome props, so one declaration on the deck sets the width of every page's
  // number. A page may also pass `pageCount` beside `pageNumber`.
  const pageCount = template.pageCount ?? props.pageCount;
  if (pageCount !== undefined) assertPageCount(pageCount);
  const pageDigits = Math.max(PAGE_NUMBER_MIN_DIGITS, pageCount === undefined ? 0 : String(pageCount).length);
  const rawNumber = props.pageNumber === false || props.pageNumber == null ? "" : String(props.pageNumber);
  // Only a plain count is padded: a deck that labels its appendix "A-1" keeps
  // the label it chose.
  const pageNumber = /^\d+$/.test(rawNumber) ? rawNumber.padStart(pageDigits, "0") : rawNumber;
  const company = template.branding === "footer-company" ? template.companyName ?? props.companyName ?? props.footerRight ?? "" : "";
  const numberLayout = pageNumber ? measure(pageNumber, 64) : null;
  if (numberLayout?.lines.length > 1) throw new Error("Page number must fit on one line");
  const numberWidth = numberLayout ? Math.max(24, Math.ceil(numberLayout.width) + 4) : 0;
  const companyLayout = company ? measure(company, frame.width * 0.3) : null;
  if (companyLayout?.lines.length > 1) throw new Error("Company name must fit on one footer line");
  const companyWidth = companyLayout ? Math.ceil(companyLayout.width) + 4 : 0;
  const companyRight = right - (numberWidth ? numberWidth + gap : 0);
  const sourceRight = companyWidth ? companyRight - companyWidth - gap : numberWidth ? right - numberWidth - gap : right;
  const slots = [];
  const place = (key, role, value, x, y, width, layout, align = "left", data = {}) => {
    if (!value) return;
    slots.push({ key, role, text: layout.text, frame: { x, y: y - footerLift, width, height: layout.height }, style: { ...style, align, lineHeight: layout.lineHeight }, data: { textLayout: layout, pageTemplate: template.rules, ...data } });
  };
  // The citation as the footer sets it: the author's own line, held to the
  // line limit, or the fullest of a derived citation's forms that keeps it.
  // `data` marks a derived line (the gates count what the author wrote) and
  // carries the full citation when a shorter form stands in for it.
  // A derived citation is also held to the words the page's footer has room
  // for under the note bar (`sourceWordsMax`, set by the slide compile once it
  // has counted the page - core.mjs compileSlide): the footer as drawn counts
  // toward `NOTE_HEAVY`, so the runtime fits its own line under that bar and
  // never asks the author to. The last form - the count alone - is drawn when
  // no fuller one has room.
  const forms = Array.isArray(props.sourceForms) && props.sourceForms.length && props.source ? props.sourceForms : null;
  const wordsMax = forms && Number.isFinite(props.sourceWordsMax) ? props.sourceWordsMax : Infinity;
  const citation = (width, refusal) => {
    for (const text of forms ?? [props.source]) {
      const layout = measure(text, width);
      const roomy = textWords(text) <= wordsMax || text === forms?.at(-1);
      if (layout.lines.length <= FOOTER_LINES_MAX && roomy) return { text, layout, data: forms ? { derived: true, ...(text !== forms[0] ? { fullCitation: forms[0] } : {}) } : {} };
    }
    throw new Error(refusal);
  };
  const baselineTop = rowTop + (rowHeight - measure("7", 64).height) / 2;
  place("page-number", "page-number", pageNumber, right - numberWidth, baselineTop, numberWidth, numberLayout, "right");
  place("footer-right", "footer-right", company, companyRight - companyWidth, baselineTop, companyWidth, companyLayout, "right");
  let occupiedTop = rowTop;
  if (template.sourcePlacement === "inline") {
    if (props.source && props.footerLeft) throw new Error("Inline sources share the left footer slot; move footerLeft to notes or select separate sources");
    if (props.source || props.footerLeft) {
      const refusal = "Source exceeds three footer lines; shorten the visible citation and retain details in notes";
      const { text: source, layout, data } = props.source ? citation(sourceRight - left, refusal) : { text: props.footerLeft, layout: measure(props.footerLeft, sourceRight - left), data: {} };
      if (layout.lines.length > FOOTER_LINES_MAX) throw new Error(refusal);
      const y = baselineTop - (layout.height - layout.lineHeight);
      place(props.source ? "source" : "footer-left", props.source ? "source-text" : "footer-left", source, left, y, sourceRight - left, layout, "left", data);
      occupiedTop = Math.min(occupiedTop, y);
    }
  } else {
    if (props.footerLeft) {
      const layout = measure(props.footerLeft, sourceRight - left);
      if (layout.lines.length > 1) throw new Error("Footer label must fit on one line");
      place("footer-left", "footer-left", props.footerLeft, left, baselineTop, sourceRight - left, layout);
    }
    if (props.source) {
      const { text: source, layout, data } = citation(right - left, "Source exceeds three footer lines");
      const y = frame.y + CHROME.sourceTop - Math.max(0, layout.height - rowHeight);
      place("source", "source-text", source, left, y + (rowHeight - layout.lineHeight) / 2, right - left, layout, "left", data);
      occupiedTop = Math.min(occupiedTop, y);
    }
  }
  if (props.note) {
    const layout = measure(props.note, sourceRight - left);
    if (layout.lines.length > FOOTER_LINES_MAX) throw new Error("Note exceeds three footer lines");
    const y = occupiedTop - smallGap - layout.height;
    place("note", "footnote-text", props.note, left, y, sourceRight - left, layout);
    occupiedTop = y;
  }
  const ruleAnchor = template.sourcePlacement === "separate" ? frame.y + CHROME.footerRuleY : occupiedTop - smallGap;
  const ruleY = ruleAnchor - footerLift;
  const bodyBottom = Math.min(occupiedTop, template.rules !== "none" ? ruleAnchor : occupiedTop) - gap;
  const logoFrame = template.branding === "top-right-logo" ? { x: right - 180, y: frame.y + CHROME.titleTop, width: 180, height: 64 } : null;
  return { template, slots, ruleY, logoFrame, titleWidth: logoFrame ? logoFrame.x - left - tokenValue(token("space.5")) : right - left,
    contentFrame: { x: left, y: frame.y + CHROME.bodyTop, width: right - left, height: bodyBottom - frame.y - CHROME.bodyTop } };
}

export function renderPageTemplate({ id, frame, props = {} }) {
  const layout = pageTemplateLayout(frame, props);
  const nodes = layout.slots.map(({ key, ...slot }) => textPrimitive({ id: stableId(id, key), ...slot }));
  const rule = (name, y) => linePrimitive({ id: stableId(id, name), role: name, x1: frame.x + CHROME.left, y1: y, x2: frame.x + frame.width - CHROME.right, y2: y, style: { stroke: token("color.rule"), lineWidth: token("line.hairline") } });
  if (layout.template.rules !== "none") nodes.push(rule("footer-rule", layout.ruleY));
  if (layout.template.rules === "top-and-bottom") nodes.push(rule("header-rule", frame.y + 28));
  const placements = layout.logoFrame ? [{ node: component({ id: stableId(id, "logo"), component: layout.template.logo.component, props: layout.template.logo.props || {} }), frame: layout.logoFrame }] : [];
  return { nodes, placements, logoFrame: layout.logoFrame, contentFrame: layout.contentFrame, pageTemplate: layout.template, titleWidth: layout.titleWidth };
}
