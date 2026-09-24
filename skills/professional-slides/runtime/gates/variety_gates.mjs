// The variety contract, read from the choices each page made.
//
// A deck's variety is decided when its pages are chosen, not when they are
// drawn: by the time a render shows fifty pages of one skeleton, the remedy is
// a rewrite. These rules read the page types (page-types.mjs) and block before
// the build. They run twice from one implementation: when the deck is authored
// (author-deck.mjs) and again in the build's preflight, which also refuses a
// long deck whose pages were not authored as types, or whose structure was
// edited by hand after it was compiled.
//
// The thresholds sit outside what 123 content pages of strong consulting
// decks measure, so a well-made deck passes them with room: there the commonest page
// type is 23% of pages, the commonest commentary placement 27%, a closing
// line 9%, pages with two or more exhibits 24%, and 80% of chart pages mark
// something on the plot. The deck that prompted them ran 100% closing lines
// and about 95% bullets under the exhibit.
//
// Placement and repetition are measured on the page as drawn. A later deck
// passed every rule with two pages in five drawn as one exhibit with a text
// column beside it - strong decks draw 13% that way - because the rules counted
// declared choices: "beside" and "beside-left" were two placements, and a trend
// beside its points and a stat list beside its points were two signatures. The
// reader sees one page each time, so the contract now counts one.

export const VARIETY_CODES = Object.freeze({
  PAGE_TYPE_UNDECLARED: "the deck's pages were not authored as page types, so nothing chose their structure",
  PAGE_TYPE_EDITED: "a page's structure was changed after it was compiled from its choices",
  VARIETY_TYPE_SHARE: "one page type carries too much of the deck",
  VARIETY_TYPE_RANGE: "the deck uses too few page types for its length",
  VARIETY_TYPE_RUN: "the same page type repeats down consecutive pages",
  VARIETY_COMMENTARY: "one commentary placement carries too much of the deck",
  VARIETY_TAKEAWAY: "too many pages close on a takeaway line",
  VARIETY_PANELS: "too few pages set evidence side by side",
  VARIETY_SIGNATURE: "one drawn page - layout, exhibits, text column and close - repeats across the deck",
  // Raised by author-deck.mjs: the page failed to compose; the rest of the deck is still checked.
  PAGE_DOES_NOT_COMPOSE: "a page could not be composed",
  // Advisory, raised by the page-type compiler (page-types.mjs) and listed in the author's summary.
  MAP_COARSE: "a regional map drawn on the built-in 1:110m coastline, which is coarse at that scale",
});

export const VARIETY = Object.freeze({
  from: 12,                 // content pages; shorter decks are probes
  typeShareMax: 0.25,       // strong decks: commonest type 23%
  // Strong decks: commonest placement 27%, so the cap sits just outside it. At
  // 40% it let two pages in five put their explanation in a column beside the
  // exhibit; the worked example's commonest placement is under a quarter.
  commentaryShareMax: 0.3,
  takeawayShareMax: 0.25,   // strong decks: 9% of pages close on a line or band; a so-what bar is a close
  panelsShareMin: 0.12,     // strong decks: 24% of pages carry two or more exhibits
  // Keyed on the drawn skeleton, not the declared type. The commonest skeleton
  // in strong decks is a full-width chart carrying its own callouts, about 16%
  // of pages (declared, their commonest combination was 10%, under the old
  // 15% cap); one exhibit beside a column is 13%.
  signatureShareMax: 0.2,
  runMax: 2,                // three in a row of one type reads as one page repeated
});

// The pages a deck of one exhibit and a column is usually hiding, named in the
// repairs so the author can reach for them.
const ALTERNATIVES = "labelled row blocks for three challenges or what changed in each area (`parallel`, form `labelled-rows`), " +
  "two or three exhibits joined by arrows for cause and effect or before and after (`panels`, form `sequence`), " +
  "panels side by side, a scorecard or findings matrix, or the exhibit alone closed by a so-what bar (commentary `so-what-bar`)";

const isContent = (slide) => (!slide.kind || slide.kind === "content" || slide.kind === "statement" || slide.kind === "takeaways") && slide.title !== undefined;
const share = (n, of) => Math.round((n / of) * 100) / 100;

/**
 * Findings for a deck's content slides. `structureOf` is passed in so the
 * gate and the compiler share one definition without a circular import.
 */
// Words are not this file's business: the text contract holds every page to
// the floor for its reading task, on the text of the composed page
// (derive-content.mjs), and the rendered deck's empty space is DECK_THIN_PAGES.
export function varietyFindings(spec, { structureOf } = {}) {
  if (spec.purpose === "catalogue") return [];
  const slides = [...(spec.slides || []), ...(spec.appendix || [])].filter(isContent);
  const findings = [];
  const block = (code, measured, threshold, repair, pages = null) => findings.push({ slide: pages, code, severity: "blocker", measured, threshold, repair });
  if (slides.length < VARIETY.from) return findings;

  const untyped = slides.filter((s) => !s.pageType?.type);
  if (untyped.length) {
    block("PAGE_TYPE_UNDECLARED", { pages: untyped.length, of: slides.length, ids: untyped.slice(0, 12).map((s) => s.id ?? null) }, 0,
      `${untyped.length} of ${slides.length} content pages carry no page type. Author the deck as \`<id>.pages.json\` - every page a ` +
      "`type` with its `form`, `commentary`, `takeaway` and `why` - and compile it with `node runtime/author-deck.mjs <id>.pages.json`. " +
      "`--types` lists the types. A deck written straight into the spec takes the composer's defaults on every page, which is how fifty " +
      "pages become one page repeated.", untyped.map((s) => s.id ?? null));
    return findings;
  }
  if (structureOf) {
    const edited = slides.filter((s) => s.pageType.structure && s.pageType.structure !== structureOf(s));
    if (edited.length) block("PAGE_TYPE_EDITED", { pages: edited.map((s) => s.id ?? null) }, 0,
      "These pages' layout, exhibit type, arrangement or closing line no longer match the choices they were compiled from. Change the " +
      "choice in the pages file and recompile; an edit to the compiled spec is overwritten by the next compile and bypasses the contract.",
      edited.map((s) => s.id ?? null));
  }

  const n = slides.length;
  const tally = (key) => { const m = new Map(); for (const s of slides) { const k = key(s); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };

  const types = tally((s) => s.pageType.type);
  if (types[0][1] / n > VARIETY.typeShareMax) {
    block("VARIETY_TYPE_SHARE", { type: types[0][0], pages: types[0][1], of: n, share: share(types[0][1], n) }, VARIETY.typeShareMax,
      `${types[0][1]} of ${n} pages are ${types[0][0]} pages. Go back to the claims those pages make and ask what each has to show: ` +
      "a whole set ranked, a change over time with its rate, a mix, a mechanism, several cuts side by side, a scorecard. The type follows " +
      "the claim; a deck where one type carries a quarter of the pages has stopped asking.");
  }
  const need = Math.min(8, Math.ceil(n / 5));
  if (types.length < need) {
    block("VARIETY_TYPE_RANGE", { types: types.length, pages: n, used: types.map(([t]) => t) }, need,
      `${types.length} page types across ${n} pages; a deck this long uses at least ${need}. Strong decks draw on eleven families - ` +
      "single charts, panels side by side, findings matrices, coded scorecards, parallel columns, prose, diagrams, lookups, pictures, " +
      "quotes and statements - roughly in that order of frequency.");
  }

  // Runs: a declared series (one template on purpose) counts once.
  let run = [];
  const flush = () => {
    if (run.length > VARIETY.runMax && !(run[0].pageType.series && run.every((s) => s.pageType.series === run[0].pageType.series))) {
      block("VARIETY_TYPE_RUN", { type: run[0].pageType.type, run: run.length, pages: run.map((s) => s.id ?? null) }, VARIETY.runMax,
        `${run.length} ${run[0].pageType.type} pages in a row read as one page repeated. Reorder, or change the type of the middle page to ` +
        "the evidence it actually carries; mark a deliberate run of one template with a shared `series`.", run.map((s) => s.id ?? null));
    }
  };
  for (const slide of slides) {
    if (run.length && slide.pageType.type === run[0].pageType.type) run.push(slide);
    else { flush(); run = [slide]; }
  }
  flush();

  // A column on the left and a column on the right are one placement to a reader.
  const placement = (s) => (s.pageType.commentary === "beside-left" ? "beside" : s.pageType.commentary);
  const commentary = tally(placement);
  if (commentary[0][1] / n > VARIETY.commentaryShareMax) {
    const [top, count] = commentary[0];
    block("VARIETY_COMMENTARY", { commentary: top, pages: count, of: n, share: share(count, n),
      mix: Object.fromEntries(commentary) }, VARIETY.commentaryShareMax,
      `${count} of ${n} pages put their explanation ${top === "below" ? "in points under the exhibit" : top === "beside" ? "in a column beside the exhibit (either side)" : `"${top}"`}. ` +
      "In strong decks the explanation lives in several places: on the chart as callouts, in the table's cells, under each panel, in a " +
      "column beside the exhibit, in a so-what bar under it, or nowhere because the exhibit and its title carry it. Choose the placement " +
      "that puts each sentence where the eye already is for that page" +
      (top === "beside" || top === "below" ? ` - and ask whether the page is one exhibit at all: ${ALTERNATIVES}.` : "."));
  }
  // A so-what bar is a close as much as a closing line is: counted apart, a
  // deck could close every page by moving the line into a bar.
  const closes = slides.filter((s) => s.pageType.takeaway || s.pageType.commentary === "so-what-bar").length;
  if (closes / n > VARIETY.takeawayShareMax) {
    block("VARIETY_TAKEAWAY", { pages: closes, of: n, share: share(closes, n) }, VARIETY.takeawayShareMax,
      `${closes} of ${n} pages close on a takeaway line or a so-what bar. The title is the page's message; a close that restates it on every page ` +
      "is a template, and strong decks use one on about one page in ten - where the implication goes beyond the title. Keep it there, " +
      "and let the rest end on their evidence.");
  }
  const panels = slides.filter((s) => ["panels", "options"].includes(s.pageType.type) || (s.exhibits || []).length >= 2).length;
  if (n >= 15 && panels / n < VARIETY.panelsShareMin) {
    block("VARIETY_PANELS", { pages: panels, of: n, share: share(panels, n) }, VARIETY.panelsShareMin,
      `${panels} of ${n} pages set evidence side by side. A quarter of a strong deck's pages carry two to four exhibits - the same ` +
      "measure for several members, two measures that together prove the claim, before and after - each with its own heading and a " +
      "caption under it. Find the pages where the reader would otherwise have to hold one chart in mind while turning to the next.");
  }
  // The drawn skeleton the compiler recorded (page-types.mjs skeletonOf); a
  // deck compiled before it was recorded falls back to its declared choices.
  const signatureOf = (s) => s.pageType.skeleton ?? `${s.pageType.type} · ${s.pageType.commentary} · ${s.pageType.takeaway ? "close" : "open"}`;
  const signature = tally(signatureOf);
  if (signature[0][1] / n > VARIETY.signatureShareMax) {
    const ids = slides.filter((s) => signatureOf(s) === signature[0][0]).map((s) => s.id ?? null);
    block("VARIETY_SIGNATURE", { signature: signature[0][0], pages: signature[0][1], of: n, ids }, VARIETY.signatureShareMax,
      `${signature[0][1]} of ${n} pages are drawn as the same page: ${signature[0][0]}. They may declare different types, but a reader ` +
      "sees one layout repeated. Go back to what each has to show and draw the pages that are not one exhibit as what they are: " +
      `${ALTERNATIVES}. A deck's rhythm comes from pages that ask the reader to do different things.`, ids);
  }
  return findings;
}
