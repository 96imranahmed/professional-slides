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
import { GENERATED_ROLES } from "./text-contract.mjs";

const COMMENTARY_ROLES = new Set(["list-item", "list-lead", "paragraph"]);

/** The text-plan role of a composed text node, or null for text the runtime generates. */
export function planRole(role) {
  const r = String(role ?? "");
  if (GENERATED_ROLES.test(r)) return null;
  if (/^(action-title|cover-title|divider-title|takeaways-title|statement-title)$/.test(r)) return "title";
  if (/^source/.test(r)) return "source";
  if (/^footnote|^note/.test(r)) return "qualification";
  if (/^(page-tag|cover-logo|cover-date|tracker|agenda-label|agenda-marker|takeaways-numeral|section-tab)/.test(r)) return "furniture";
  if (/^(paragraph|list-item|list-lead|insight|callout|panel|section-heading|action-subtitle|cover-subtitle|divider-subtitle|statement|takeaways-item|quote)/.test(r)) return "body";
  return "exhibit";
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
      ...(t ? { textReference: { task: readingTaskOf(t.family, scene) } } : {}),
      textPlan: blocks,
    });
  });
  return { schema: "professional-slides.content/v1", id: spec.id, question: spec.brief ?? null, answer: spec.answer ?? null, textContract: "complete", derivedFrom: "pages", pages: records };
}
