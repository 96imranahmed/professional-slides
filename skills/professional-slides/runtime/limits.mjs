// The countable limits a page is held to, published before it is written.
//
// Each is what a frame holds - a title's lines, a rail's words, a chart's
// callouts, the members a form draws - read from the constant its check reads
// (the page-type compiler's, the composer's), so the listing cannot drift
// from the refusal. `measured` marks a capacity the renderer measures in
// pixels, given here as the words of ordinary prose it holds: a guide to
// write to, not the test.
import { PAGE_TYPES, TEXT_LIMITS, CALLOUTS_MAX, WATERFALL_BELOW_CALLOUTS, limitOf, railCapacity, calloutCapacity, exhibitRange, placementsOf } from "./page-types.mjs";
import { AGENDA_LIMITS } from "./panels.mjs";
import { FOOTER_LINES_MAX } from "./page-template.mjs";
import { SECTION_TITLE_LINES, sectionTitleCapacity } from "./registry-chrome.mjs";

/** The limits every analytical page shares, whatever its type. */
export function copyLimits() {
  return {
    title: { lines: { max: TEXT_LIMITS.titleLines }, codes: ["TITLE_LINES"] },
    subtitle: { lines: { max: TEXT_LIMITS.subtitleLines } },
    takeaway: { lines: { max: TEXT_LIMITS.takeawayLines } },
    source: { lines: { max: FOOTER_LINES_MAX }, note: "a citation typed as text; one written from `sources` registry keys is fitted by the runtime" },
    note: { lines: { max: FOOTER_LINES_MAX } },
  };
}

/** The deck-level limits: a divider's title and the contents page. */
export function deckLimits() {
  return {
    ...copyLimits(),
    sectionTitle: { lines: { max: SECTION_TITLE_LINES }, words: { max: sectionTitleCapacity(), measured: true }, note: "measured on the house default's divider, of short words (ordinary prose)" },
    contents: { sections: { list: { ...AGENDA_LIMITS.list }, columns: { ...AGENDA_LIMITS.columns } }, note: "the appendix divider counts as a section" },
  };
}

/**
 * The limits on one page of `type` and `form`: the shared copy limits, how
 * many exhibits it carries, what its exhibit holds, and what each of its
 * placements holds (or the one `commentary` named).
 */
export function pageLimits(type, form, { commentary = null } = {}) {
  const t = PAGE_TYPES[type];
  if (!t) throw new Error(`No page type "${type}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  if (form !== undefined && form !== null && !t.forms[form]) throw new Error(`No form "${form}" of ${type}; one of ${Object.keys(t.forms).join(", ")}`);
  const forms = form ? [form] : Object.keys(t.forms);
  const exhibit = (f) => { const l = limitOf(type, f, t.forms[f]); return l ? { [l.key]: { min: l.min, ...(l.max ? { max: l.max } : {}) }, ...(l.valueChars ? { valueCharacters: { max: l.valueChars } } : {}), ...(l.columns ? { columns: { min: 1, max: l.columns, note: "tiles across; optional - left out, the grid sets them" } } : {}) } : null; };
  const [lo, hi] = form ? exhibitRange(type, form) : Array.isArray(t.exhibits) ? t.exhibits : [t.exhibits, t.exhibits];
  const perForm = (f) => ({ commentary: placementsOf(type, f), ...(exhibit(f) ? { exhibit: exhibit(f) } : {}) });
  const placed = commentary ? [commentary] : [...new Set(forms.flatMap((f) => placementsOf(type, f)))];
  return {
    type, ...(form ? { form } : {}), ...copyLimits(),
    exhibits: { min: lo, max: hi },
    ...(placed.includes("rail") ? { rail: { words: { max: railCapacity(), measured: true } } } : {}),
    ...(placed.includes("so-what-bar") ? { bar: { lines: { max: TEXT_LIMITS.barLines } } } : {}),
    ...(placed.includes("on-exhibit") ? { callouts: { count: { max: CALLOUTS_MAX, belowABridge: WATERFALL_BELOW_CALLOUTS }, wordsEach: { max: calloutCapacity(), measured: true } } } : {}),
    ...(forms.includes("labelled-rows") ? { blocks: { points: { max: 4 } } } : {}),
    ...(form ? perForm(form) : { forms: Object.fromEntries(forms.map((f) => [f, perForm(f)])) }),
  };
}
