// The content plan, derived from the pages file and its composition.
//
// The content plan (`<id>.content.json`) records every page's claim, what
// settles it, what the commentary adds, and a text plan listing every visible
// word - chart labels, formatted values, table cells. It is derived, not
// written by hand: two records of one deck drift, and every drift is a build
// that fails on TEXT_UNPLANNED or a changed title.
//
// The pages file is the dot-dash. Its content decisions (`claim`,
// `settles`, `adds`, `highlight`) come from the page; its text plan comes from
// the page as composed, which is the author's own copy set by the runtime, so
// the checks that remain are the ones that measure something: each page's words
// against the floor for its reading task, the longest run of prose, the
// answer carried by the claims, and every planned word surviving export. The
// reading task comes from the page type's exhibit family and whether the
// composed page has a commentary column - the same test the composition audit
// applies, so the two cannot disagree.
import { GENERATED_ROLES, READING_TASK_BANK, textWords } from "./text-contract.mjs";
import { PICTURE_SHARE_MAX } from "./weight.mjs";

// Lines the reading-task bank drops from body counts (text-contract NOTE_LINE).
const NOTE_LINE = /^\s*(source|sources|note|notes|footnote)\b[:\s]/i;

/**
 * A composed page's body words, counted exactly as the text contract counts a
 * text plan: body, exhibit and qualification blocks, notes excluded. The page
 * gates read this number off the scene rather than keeping a second counter,
 * so authoring and the build cannot disagree about whether a page is thin.
 */
export function bodyWordsOf(sceneSlides) {
  let words = 0;
  for (const slide of sceneSlides) for (const node of slide.nodes || []) {
    if (node.type !== "text") continue;
    const role = planRole(node.role);
    const text = String(node.data?.textLayout?.source ?? node.text ?? "");
    if (["body", "exhibit", "qualification"].includes(role) && !NOTE_LINE.test(text)) words += textWords(text);
  }
  return words;
}

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

const COMMENTARY_ROLES = new Set(["list-item", "list-lead", "paragraph"]);

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

// A photograph smaller than this is an icon or a thumbnail, not the page's subject.
const PHOTO_MIN_AREA = 0.03 * 1280 * 720;

/** How much of the page's body a photograph holds, capped so a larger photo cannot buy a page out of its argument. */
export function pictureShareOf(slide) {
  const frame = slide.contentFrame ?? { width: 1160, height: 506 };
  const area = (frame.width || 0) * (frame.height || 0);
  if (area <= 0) return 0;
  const covered = (slide.nodes || []).filter((n) => n.type === "image" || n.role === "image-frame")
    .map((n) => (n.frame?.width || 0) * (n.frame?.height || 0)).filter((a) => a >= PHOTO_MIN_AREA).reduce((a, b) => a + b, 0);
  return Math.min(covered / area, PICTURE_SHARE_MAX);
}

// The share of the reading task's lower quartile a page is held to, by the
// deck's `density`. The quartiles are those of pages read or sent - executive
// papers and pre-reads - so both are held to them; a live pitch is presented
// to a room, one idea a page, and its floors scale down so the densest task
// asks for under the forty body words such a page carries.
export const DENSITY_FLOOR_SCALE = Object.freeze({ "live-pitch": 0.25, executive: 1, "pre-read": 1 });
export const floorScaleOf = (density) => DENSITY_FLOOR_SCALE[density] ?? 1;

/**
 * The page's word budget, set once and read by every check: the floor is the
 * lower quartile of pages doing its reading task, scaled by the deck's
 * density and less the share of the body a photograph holds; the ceiling is
 * the task's outlier fence (the upper quartile plus one and a half times the
 * spread), counted on the same words. The author's budget line, the page
 * gates and the text contract all read it here, so they cannot disagree.
 */
export function wordBudgetOf(task, slide, density) {
  const bank = READING_TASK_BANK[task]?.bodyWords;
  if (!bank) return null;
  const share = slide ? pictureShareOf(slide) : 0;
  // The executive summary is read before anything else and in full, so it is
  // held to its task's upper quartile (204 body words for a text page) rather
  // than the outlier fence.
  const ceiling = slide?.role === "executive-summary" ? Math.round(bank.q3) : Math.round(bank.q3 + 1.5 * (bank.q3 - bank.q1));
  return { floor: Math.round(bank.q1 * floorScaleOf(density) * (1 - share)), ceiling };
}

/** The reading task a composed page performs: its exhibit family, and whether it has a commentary column. */
export function readingTaskOf(family, sceneSlides) {
  if (family === "text") return "text-page";
  const commentary = sceneSlides.some((slide) => (slide.nodes || []).some((n) => n.type === "text" && COMMENTARY_ROLES.has(String(n.role ?? ""))));
  return `${family}-${commentary ? "with-commentary" : "led"}`;
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
    const t = page.pageType;
    const content = t?.content ?? {};
    records.push({
      // The executive summary is the page the deck states its answer on, and a
      // page whose copy waits for the full compile is marked, so the answer
      // gate (content_gates.mjs) knows which page to read and how far.
      id: page.id, n: index + 1, ...(page.kind ? { kind: page.kind } : {}), ...(t ? (t.type === "summary" && t.form === "executive-summary" ? { role: "executive-summary" } : {}) : { role: "structural" }),
      ...(t?.deferred ? { deferred: true } : {}),
      claim: content.claim || String(page.title ?? page.text ?? ""),
      settles: content.settles ?? { kind: "qualitative", what: page.kind ? "Structure of the deck" : String(page.title ?? "") },
      adds: content.adds ?? null,
      highlight: page.highlight ?? null,
      ...(content.evidence ? { evidence: content.evidence } : {}),
      ...(t ? { textReference: (() => { const task = readingTaskOf(t.family, scene);
        const budget = scene[0]?.wordFloor !== undefined ? { floor: scene[0].wordFloor, ceiling: scene[0].wordCeiling } : wordBudgetOf(task, scene[0], spec.density);
        const scale = floorScaleOf(spec.density);
        return { task, ...(budget ?? {}), ...(scale !== 1 ? { floorScale: scale } : {}) }; })() } : {}),
      textPlan: blocks,
    });
  });
  return { schema: "professional-slides.content/v1", id: spec.id, question: spec.question ?? spec.brief ?? null, answer: spec.answer ?? null, textContract: "complete", derivedFrom: "pages", pages: records };
}
