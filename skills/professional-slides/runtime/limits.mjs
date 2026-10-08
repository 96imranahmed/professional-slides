// The countable limits a page is held to, published before it is written.
//
// A limit met by violation costs a whole compile to learn: a title one word
// over, a subtitle past its line, a contents page with a section too many.
// Every number here is read from the constant its check reads - the page-type
// compiler's, the composer's, the content gates', the weight contract's and
// the reading-task bank's - so the listing cannot drift from the refusal, and
// a test holds each to the gate that enforces it (test_published_limits.py).
// `measured` marks a capacity the renderer measures in pixels, given here as
// the words of ordinary prose it holds: a guide to write to, not the test.
import { PAGE_TYPES, TEXT_LIMITS, SUBTITLE_WORDS, COPY_LIMITS, CALLOUTS_MAX, EVIDENCE_FLOOR, FORM_COMMENTARY, limitOf, familyOf, chartPage,
  railCapacity, calloutCapacity } from "./page-types.mjs";
import { wordBudgetOf } from "./derive-content.mjs";
import { READING_TASK_BANK } from "./text-contract.mjs";
import { CONTENT_THRESHOLDS, titleContentWords } from "./gates/content_gates.mjs";
import { AGENDA_LIMITS } from "./panels.mjs";
import { FOOTER_LINES_MAX, SOURCE_TITLE_WORDS } from "./page-template.mjs";
import { PLAN, PICTURE_SHARE_MAX } from "./weight.mjs";
import { SECTION_TITLE_LINES, sectionTitleCapacity } from "./registry-chrome.mjs";

/** The limits every analytical page shares, whatever its type. */
function copyLimits() {
  return {
    title: { words: { min: CONTENT_THRESHOLDS.claimWordsMin, max: TEXT_LIMITS.titleWords, target: TEXT_LIMITS.titleTarget }, lines: { max: TEXT_LIMITS.titleLines }, codes: ["TITLE_WORDS", "TITLE_LINES", "CONTENT_NO_CLAIM"] },
    subtitle: { words: { max: SUBTITLE_WORDS }, lines: { max: TEXT_LIMITS.subtitleLines } },
    takeaway: { lines: { max: TEXT_LIMITS.takeawayLines }, codes: ["TAKEAWAY_LONG"] },
    source: { lines: { max: FOOTER_LINES_MAX }, note: "a citation typed as text; one written from `sources` registry keys is fitted by the runtime" },
    note: { lines: { max: FOOTER_LINES_MAX } },
    textBlock: { words: { max: PLAN.textForm.longestBlockMax }, codes: ["TEXT_BLOCK_TOO_LONG"], note: "one point, paragraph, card or cell" },
  };
}

/** A page's body-word floor and ceiling for a reading task, under the deck's density. */
const budget = (task, density, slide = null) => { const b = wordBudgetOf(task, slide, density); return b ? { min: b.floor, max: b.ceiling } : null; };

/**
 * The deck-level limits, and each reading task's body-word budget.
 * `sectionTitle` is what a divider of the deck holds as the composer measures
 * it under the deck's own design, variation, tracker and sections
 * (spine-fit.mjs sectionTitleRoom), given by a caller that has the deck;
 * without one, the house default's divider is measured.
 */
export function deckLimits({ density, sectionTitle = null } = {}) {
  return {
    ...copyLimits(),
    sectionTitle: { lines: { max: SECTION_TITLE_LINES }, words: { max: sectionTitle?.words ?? sectionTitleCapacity(), measured: true }, ...(sectionTitle ? { characters: { max: sectionTitle.characters, measured: true } } : {}),
      ...(sectionTitle?.title ? { whateverTheWords: { words: { max: sectionTitle.title.words }, characters: { max: sectionTitle.title.characters }, measured: true } } : {}), codes: ["SPINE_UNFIT"],
      note: sectionTitle ? `measured on this deck's own dividers - its design, variation, tracker and sections. \`words\` and \`characters\` are the most they hold, of short words (ordinary prose)${sectionTitle.title ? `; \`whateverTheWords\` is what they hold of a title's longer words, so a section title of ${sectionTitle.title.words} words or fewer fits and one between ${sectionTitle.title.words} and ${sectionTitle.words} fits where its words are short` : ""}. Every run composes each section title itself, a draft and a plan too`
        : "measured on the house default's divider; name the pages file (`<id>.pages.json --limits`) for what this deck's design, variation and sections hold" },
    sources: { name: { words: { max: SOURCE_TITLE_WORDS.name } }, short: { words: { max: SOURCE_TITLE_WORDS.short } }, status: { words: { max: SOURCE_TITLE_WORDS.status } }, note: "a `sources` registry entry's `name` and `short` are a title and its `status` a label, refused at the compile when longer; a caveat or a method is the page's `note`. The footer as drawn counts toward NOTE_HEAVY: a citation written from registry keys is fitted by the runtime to the words the page's footer has room for" },
    contents: { sections: { list: { ...AGENDA_LIMITS.list }, columns: { ...AGENDA_LIMITS.columns } }, codes: ["CONTENTS_UNFIT"], note: "the appendix divider counts as a section" },
    answer: { coverageByTitles: { min: CONTENT_THRESHOLDS.answerCoverageMin }, onTheOpeningPage: { min: CONTENT_THRESHOLDS.answerUpFrontMin }, leadingClauseInItsTitle: { min: CONTENT_THRESHOLDS.answerLeadMin }, inItsTitle: { min: CONTENT_THRESHOLDS.answerCarriedMin, wordsAtMost: titleContentWords() },
      inOneTitleForARevisionRecordedBeforeTheUpFrontRule: { min: CONTENT_THRESHOLDS.answerCarriedMin },
      codes: ["CONTENT_ANSWER_UNCARRIED"], note: "shares of the answer's content words; the answer itself has no length limit" },
    bodyWords: Object.fromEntries(Object.keys(READING_TASK_BANK).map((task) => [task, budget(task, density)]).filter(([, b]) => b)),
    executiveSummary: { bodyWords: budget("text-page", density, { role: "executive-summary" }), codes: ["WORDS", "SPINE_UNFILLED"],
      note: "the ceiling counts every word of the body - the cells of the summary's table as well as its points - and the page does not fill on points alone, so the answer table is short: a call of a few words a cell" },
  };
}

/**
 * The limits on one page of `type` and `form`: the shared copy limits, the
 * body-word budget for each way its commentary can be placed (or for the one
 * `commentary` named), what its exhibit holds, and the evidence its type asks.
 */
export function pageLimits(type, form, { commentary = null, density } = {}) {
  const t = PAGE_TYPES[type];
  if (!t) throw new Error(`No page type "${type}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  if (form !== undefined && form !== null && !t.forms[form]) throw new Error(`No form "${form}" of ${type}; one of ${Object.keys(t.forms).join(", ")}`);
  const forms = form ? [form] : Object.keys(t.forms);
  const placements = (f) => FORM_COMMENTARY[`${type}/${f}`] ?? t.commentary;
  // Points beside or below make a page one read with its commentary, which
  // sets the higher floor; every other placement leaves it led by its exhibit.
  // Labelled rows write their points in the rows themselves, so the page is
  // read with its commentary wherever the placement says the explanation is.
  const taskOf = (f, placement) => { const family = familyOf(type, f); return family === "text" ? "text-page" : `${family}-${["beside", "beside-left", "below"].includes(placement) || f === "labelled-rows" ? "with-commentary" : "led"}`; };
  const words = (f) => {
    const summary = type === "summary" && f === "executive-summary" ? { role: "executive-summary" } : null;
    const tasks = [...new Set((commentary ? [commentary] : placements(f)).map((placement) => taskOf(f, placement)))];
    return Object.fromEntries(tasks.map((task) => [task, budget(task, density, summary)]).filter(([, b]) => b));
  };
  const exhibit = (f) => { const l = limitOf(type, f, t.forms[f]); return l ? { [l.key]: { min: l.min, ...(l.max ? { max: l.max } : {}) }, ...(l.valueChars ? { valueCharacters: { max: l.valueChars } } : {}), ...(l.columns ? { columns: { min: 1, max: l.columns, note: "tiles across; optional - left out, the grid sets them" } } : {}) } : null; };
  const [lo, hi] = Array.isArray(t.exhibits) ? t.exhibits : [t.exhibits, t.exhibits];
  const perForm = (f) => ({ commentary: placements(f), bodyWords: words(f), ...(exhibit(f) ? { exhibit: exhibit(f) } : {}) });
  const placed = commentary ? [commentary] : [...new Set(forms.flatMap(placements))];
  return {
    type, ...(form ? { form } : {}), ...copyLimits(),
    exhibits: { min: lo, max: hi },
    ...(chartPage(type, []) ? { plottedValues: { min: EVIDENCE_FLOOR[type] ?? EVIDENCE_FLOOR.chart } } : {}),
    ...(t.periods ? { periods: { min: t.periods } } : {}), ...(t.minCategories ? { members: { min: t.minCategories } } : {}),
    ...(placed.includes("rail") ? { rail: { words: { min: COPY_LIMITS.railWordsMin, max: railCapacity(), measured: true } } } : {}),
    ...(placed.includes("so-what-bar") ? { bar: { words: { min: COPY_LIMITS.barWordsMin }, lines: { max: TEXT_LIMITS.barLines } } } : {}),
    ...(placed.includes("captions") ? { caption: { words: { min: COPY_LIMITS.captionWordsMin } } } : {}),
    ...(placed.includes("on-exhibit") ? { callouts: { count: { max: CALLOUTS_MAX }, wordsEach: { max: calloutCapacity(), measured: true }, wordsBetweenThem: { min: COPY_LIMITS.calloutWordsMin, note: "none needed where the chart carries a number mark - a change, a growth rate, a bracketed gap, a labelled reference line, a stack's total - which is how strong decks mark a chart" } } } : {}),
    ...(forms.includes("labelled-rows") ? { blocks: { points: { ...COPY_LIMITS.blockPoints }, labelWords: { max: COPY_LIMITS.blockLabelWords } } } : {}),
    ...(type === "argument" ? { panel: { words: { min: COPY_LIMITS.panelWordsMin } } } : {}),
    // A photograph stands in for words: the floor falls by the share of the body it holds, to this share of the floor at least.
    ...(type === "picture" ? { pictureRelief: { floorShare: { min: 1 - PICTURE_SHARE_MAX }, note: "bodyWords.min falls by the share of the body the photograph holds" } } : {}),
    // What a table on the page is held to that no count says: rules a run otherwise meets only by breaking them.
    ...(hi > 0 ? { table: {
      implicationColumn: { codes: ["GUTTER_UNEARNED"], note: "a column marked `implication: true` draws a \"therefore\" chevron before it, so its header names the inference the row draws (\"What it means\", \"Verdict\", \"Recommended action\"), not another fact - read as a question of the copy (judge.mjs)" },
      numbers: { codes: ["BASIS_MISSING"], note: "a table that prints one recorded number by token prints every measurement by token - a change or a share computed from recorded measures is an analysis (`growth`, `gap`, `share` in <id>.analysis.json), printed by its own token - or declares `basis: { measures, role }` naming every measure it shows; a year, a period label, an ordinal and a count in a phrase are not measurements" } } } : {}),
    ...(type === "numbers" ? { tiles: { codes: ["TILES_ONE_MEASURE", "SHARES_IN_TILES"], note: "each tile, strip figure or grid item states a different measure: one measure at two dates or for two members is plotted on one axis (a trend, a ranking, or the page's own chart), not set in two tiles; a strip takes the height its tallest tile needs, so five tiles with sublabels hold short labels" } } : {}),
    ...(form ? perForm(form) : { forms: Object.fromEntries(forms.map((f) => [f, perForm(f)])) }),
  };
}
