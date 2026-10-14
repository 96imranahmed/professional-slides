// The text plan, derived from the composed pages.
//
// The content plan (`<id>.content.json`) lists every visible block of every
// composed page - chart labels, formatted values, table cells - read off the
// page as composed, which is the author's own copy set by the runtime. The
// build checks every planned block survives export (text-contract.mjs
// auditExportText). Derived, not written by hand: two records of one deck drift.
import { GENERATED_ROLES, textWords } from "./text-contract.mjs";

// The bands of a composed page as the page gates split them (gates/render_gates.py
// page_bands): role first, position second. The runtime reads its own page
// with the gate's eyes here for one purpose - to fit the citation it derived
// to the room the footer has under the note bar - and a test holds the two
// counts to each other on real scenes (test_runtime_owned_furniture.py).
const FOOTER_BAND_ROLES = new Set(["source-text", "source", "footnote", "footnote-text", "page-number", "footer-right", "footer-left", "notes"]);
const TITLE_BAND_ROLES = new Set(["action-title", "kicker", "page-tag", "page-tag-pill", "tracker-label", "tracker-pill-label", "tracker-compact-label", "tracker-compact-marker-label", "action-subtitle"]);
const BODY_ANYWHERE_ROLES = /^(insight|takeaway|so-?what|closing)|^(category-label|category-note|axis-label|axis-title|data-label)$/;
const BAND = Object.freeze({ top: 0.18, bottom: 0.88, canvasHeight: 720 });
// The footer may carry under this share of the page's text (render_gates.py NOTE_HEAVY_SHARE).
export const NOTE_SHARE_MAX = 0.3;

/** `{ body, footer, titleBand }`: a composed page's words by band, as `NOTE_HEAVY` counts them. */
export function pageBandsOf(slide) {
  const bands = { body: 0, footer: 0, titleBand: 0 };
  for (const node of slide.nodes || []) {
    if (node.type !== "text") continue;
    const layout = node.data?.textLayout ?? {};
    const words = textWords([layout.source, layout.text].find((text) => typeof text === "string" && text.trim()) ?? node.text ?? "");
    if (!words) continue;
    const role = String(node.role ?? "");
    const top = node.frame?.height ? Number(node.frame.y ?? 0) / BAND.canvasHeight : null;
    if (FOOTER_BAND_ROLES.has(role)) bands.footer += words;
    else if (TITLE_BAND_ROLES.has(role)) bands.titleBand += words;
    else if (BODY_ANYWHERE_ROLES.test(role) || top === null) bands.body += words;
    else if (top > BAND.bottom) bands.footer += words;
    else if (top < BAND.top) bands.titleBand += words;
    else bands.body += words;
  }
  return bands;
}

/**
 * The words a derived citation may run to on this page, or null when the
 * footer as drawn is within the note bar (or the page derived no citation).
 * The footer's room is what the bar leaves beside the body's words; what the
 * author wrote there - a note, footnotes, the company line - is taken out of
 * it first, so the runtime shortens only its own line and an author's note
 * still counts in full.
 */
export function citationRoomOf(slide) {
  const citation = (slide.nodes || []).find((node) => node.type === "text" && node.role === "source-text" && node.data?.derived === true);
  if (!citation) return null;
  const { body, footer } = pageBandsOf(slide);
  if (!body || !footer || footer / (body + footer) <= NOTE_SHARE_MAX) return null;
  const drawn = textWords(citation.data?.textLayout?.source ?? citation.text);
  return Math.max(0, Math.floor(body * NOTE_SHARE_MAX / (1 - NOTE_SHARE_MAX) + 1e-9) - (footer - drawn));
}

/** The text-plan role of a composed text node, or null for text the runtime generates. */
export function planRole(role) {
  const r = String(role ?? "");
  if (GENERATED_ROLES.test(r)) return null;
  // The standfirst under an action title is title-band furniture, counted
  // with the title: a page cannot reach its body floor by lengthening the
  // line that says what it measures. The page gates' bands (TITLE_BAND_ROLES)
  // and the rendered density pass (HEADER_ROLES) read it the same way.
  if (/^(action-title|action-subtitle|cover-title|divider-title|takeaways-title|statement-title)$/.test(r)) return "title";
  if (/^source/.test(r)) return "source";
  if (/^footnote|^note/.test(r)) return "qualification";
  if (/^(page-tag|cover-logo|cover-date|tracker|agenda-label|agenda-marker|takeaways-numeral|section-tab)/.test(r)) return "furniture";
  if (/^(paragraph|list-item|list-lead|insight|callout|panel|section-heading|cover-subtitle|divider-subtitle|statement|takeaways-item|takeaway-standfirst|quote)/.test(r)) return "body";
  return "exhibit";
}

/** `{ textContract, pages }` for every page of the compiled spec, read off its composition. */
export function deriveContent(spec, deck) {
  const records = [];
  const pages = [...(spec.cover ? [{ ...spec.cover, id: "cover", kind: "cover" }] : []), ...(spec.slides || []), ...(spec.appendix || [])];
  pages.forEach((page, index) => {
    const scene = deck.slides.filter((s) => s.id === page.id || s.sourceSlideId === page.id);
    const blocks = [];
    for (const slide of scene) {
      for (const node of slide.nodes || []) {
        if (node.type !== "text") continue;
        const role = planRole(node.role);
        const text = String(node.data?.textLayout?.source ?? node.text ?? "").trim();
        if (!role || !text) continue;
        blocks.push({ id: `${node.id}`, role, text });
      }
    }
    records.push({ id: page.id, n: index + 1, ...(page.kind ? { kind: page.kind } : {}), textPlan: blocks });
  });
  return { schema: "professional-slides.content/v1", id: spec.id, textContract: "complete", derivedFrom: "pages", pages: records };
}
