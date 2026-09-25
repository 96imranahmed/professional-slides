// The content plan, derived from the pages file and its composition.
//
// The content plan (`<id>.content.json`) was a second hand-written record of
// the deck: every page's claim, what settles it, what the commentary adds, and
// a text plan listing every visible word - chart labels, formatted values,
// table cells - to be kept in step with the spec by hand. Two records of one
// deck drift, and every drift was a build that failed on TEXT_UNPLANNED or a
// changed title, then another round.
//
// Now the pages file is the dot-dash. Its content decisions (`claim`,
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

/**
 * The page's word budget, set once and read by every check: the floor is the
 * lower quartile of pages doing its reading task, less the share of the body a
 * photograph holds; the ceiling is the task's outlier fence (the upper
 * quartile plus one and a half times the spread), counted on the same words.
 * The author's budget line, the page gates and the text contract used to
 * derive these three ways - a photo page's floor was 71 in one and 112 in
 * another, and a table page's floor sat above the one flat ceiling of 148.
 */
export function wordBudgetOf(task, slide) {
  const bank = READING_TASK_BANK[task]?.bodyWords;
  if (!bank) return null;
  const share = slide ? pictureShareOf(slide) : 0;
  return { floor: Math.round(bank.q1 * (1 - share)), ceiling: Math.round(bank.q3 + 1.5 * (bank.q3 - bank.q1)) };
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
      id: page.id, n: index + 1, ...(page.kind ? { kind: page.kind } : {}), ...(t ? {} : { role: "structural" }),
      claim: content.claim || String(page.title ?? page.text ?? ""),
      settles: content.settles ?? { kind: "qualitative", what: page.kind ? "Structure of the deck" : String(page.title ?? "") },
      adds: content.adds ?? null,
      highlight: page.highlight ?? null,
      ...(content.evidence ? { evidence: content.evidence } : {}),
      ...(t ? { textReference: (() => { const task = readingTaskOf(t.family, scene);
        const budget = scene[0]?.wordFloor !== undefined ? { floor: scene[0].wordFloor, ceiling: scene[0].wordCeiling } : wordBudgetOf(task, scene[0]);
        return { task, ...(budget ?? {}) }; })() } : {}),
      textPlan: blocks,
    });
  });
  return { schema: "professional-slides.content/v1", id: spec.id, question: spec.brief ?? null, answer: spec.answer ?? null, textContract: "complete", derivedFrom: "pages", pages: records };
}
