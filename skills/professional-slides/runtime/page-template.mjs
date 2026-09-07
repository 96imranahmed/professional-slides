import { CHROME, SLIDE, component, linePrimitive, stableId, textPrimitive, token, tokenValue } from "./core.mjs";
import { measureText } from "./text-layout.mjs";

export const PAGE_RULES = ["none", "bottom", "top-and-bottom"];
export const PAGE_BRANDING = ["footer-company", "top-right-logo", "none"];
export const PAGE_TEMPLATE_TOKENS = ["font.body", "type.source", "color.textSecondary", "color.onPrimary", "color.rule", "line.hairline", "space.2", "space.4", "space.5"];

export function resolvePageTemplate(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("pageTemplate must be an object");
  for (const key of Object.keys(input)) if (!["rules", "branding", "sourcePlacement", "companyName", "logo"].includes(key)) throw new Error(`Unknown pageTemplate setting: ${key}`);
  const result = { rules: "none", branding: "footer-company", sourcePlacement: "inline", ...input };
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
  const style = { fontFamily: token("font.body"), fontSize: token("type.source"), color: token(props.inverse ? "color.onPrimary" : "color.textSecondary"), bold: false, align: "left", valign: "top", wrap: false };
  const measure = (value, width) => measureText(value, width, { fontSize: tokenValue(style.fontSize) });
  const pageNumber = props.pageNumber === false || props.pageNumber == null ? "" : String(props.pageNumber);
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
  const place = (key, role, value, x, y, width, layout, align = "left") => {
    if (!value) return;
    slots.push({ key, role, text: layout.text, frame: { x, y, width, height: layout.height }, style: { ...style, align, lineHeight: layout.lineHeight }, data: { textLayout: layout, pageTemplate: template.rules } });
  };
  const baselineTop = rowTop + (rowHeight - measure("7", 64).height) / 2;
  place("page-number", "page-number", pageNumber, right - numberWidth, baselineTop, numberWidth, numberLayout, "right");
  place("footer-right", "footer-right", company, companyRight - companyWidth, baselineTop, companyWidth, companyLayout, "right");
  let occupiedTop = rowTop;
  if (template.sourcePlacement === "inline") {
    if (props.source && props.footerLeft) throw new Error("Inline sources share the left footer slot; move footerLeft to notes or select separate sources");
    const source = props.source || props.footerLeft;
    if (source) {
      const layout = measure(source, sourceRight - left);
      if (layout.lines.length > 3) throw new Error("Source exceeds three footer lines; shorten the visible citation and retain details in notes");
      const y = baselineTop - (layout.height - layout.lineHeight);
      place(props.source ? "source" : "footer-left", props.source ? "source-text" : "footer-left", source, left, y, sourceRight - left, layout);
      occupiedTop = Math.min(occupiedTop, y);
    }
  } else {
    if (props.footerLeft) {
      const layout = measure(props.footerLeft, sourceRight - left);
      if (layout.lines.length > 1) throw new Error("Footer label must fit on one line");
      place("footer-left", "footer-left", props.footerLeft, left, baselineTop, sourceRight - left, layout);
    }
    if (props.source) {
      const layout = measure(props.source, right - left);
      if (layout.lines.length > 3) throw new Error("Source exceeds three footer lines");
      const y = frame.y + CHROME.sourceTop - Math.max(0, layout.height - rowHeight);
      place("source", "source-text", props.source, left, y + (rowHeight - layout.lineHeight) / 2, right - left, layout);
      occupiedTop = Math.min(occupiedTop, y);
    }
  }
  if (props.note) {
    const layout = measure(props.note, sourceRight - left);
    if (layout.lines.length > 3) throw new Error("Note exceeds three footer lines");
    const y = occupiedTop - smallGap - layout.height;
    place("note", "footnote-text", props.note, left, y, sourceRight - left, layout);
    occupiedTop = y;
  }
  const ruleY = template.sourcePlacement === "separate" ? frame.y + CHROME.footerRuleY : occupiedTop - smallGap;
  const bodyBottom = Math.min(occupiedTop, template.rules !== "none" ? ruleY : occupiedTop) - gap;
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
  return { nodes, placements, contentFrame: layout.contentFrame, pageTemplate: layout.template, titleWidth: layout.titleWidth };
}
