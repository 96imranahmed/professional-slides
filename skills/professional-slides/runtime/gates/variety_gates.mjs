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
  VARIETY_PANELS: "too few pages carry two or more exhibits",
  VARIETY_COLUMN: "too many pages are one exhibit with a text column beside it",
  VARIETY_SIGNATURE: "one drawn page - layout, exhibits, text column and close - repeats across the deck",
  EVIDENCE_DEPTH: "the deck's chart pages plot too few values: the median chart page is thinner than strong decks'",
  // Raised by author-deck.mjs: the page failed to compose; the rest of the deck is still checked.
  PAGE_DOES_NOT_COMPOSE: "a page could not be composed",
  // Advisory, raised by the page-type compiler (page-types.mjs) and listed in the author's summary.
  MAP_COARSE: "a regional map drawn on the built-in 1:110m coastline, which is coarse at that scale",
  // Found by a whole-deck review and refused where the page is written
  // (page-types.mjs reviewedDefect, compose.mjs totalRow); the author sees
  // them as COMPILE or PAGE_DOES_NOT_COMPOSE findings carrying these codes.
  TOTAL_ROW_BLANK: "a table row labelled as a total with no value in any of its result cells",
  TABLE_TOO_SHORT: "a table of fewer than three body rows, where two or three figures are a numbers page",
  TABLE_PANELS_MERGE: "two tables on one page with the same columns, which read as one table split in two",
  TIME_AXIS_UNEVEN: "a column chart whose dated categories are unevenly spaced in time but drawn one slot apart",
  VERDICT_TABLE_PLAIN: "a lookup, options or matrix table whose judgement column (lead, verdict, confidence, status) is plain text",
  SCENARIO_PROSE: "two to four alternatives written as paragraphs of sixty words or more each",
  // Advisory, raised by the page-type compiler and listed in the author's summary.
  SHARES_IN_TILES: "shares of one measure an order of magnitude apart set in tiles of one size",
  // Deck-level, read here from the compiled pages.
  VARIETY_TABLES: "one table construction on more than half of ten consecutive analytical pages",
  PLAYERS_UNMARKED: "the deck compares named players but no early page shows their logos",
  PROFILE_UNPICTURED: "a page introducing players or products as cards with no logo or picture on any of them",
});

export const VARIETY = Object.freeze({
  from: 12,                 // content pages; shorter decks are probes
  typeShareMax: 0.25,       // strong decks: commonest type 23%
  // Strong decks: commonest placement 27%, so the cap sits just outside it. At
  // 40% it let two pages in five put their explanation in a column beside the
  // exhibit; the worked example's commonest placement is under a quarter.
  commentaryShareMax: 0.3,
  takeawayShareMax: 0.25,   // strong decks: 9% of pages close on a line or band; a so-what bar is a close
  // Structure, counted on the page as drawn (page-types.mjs drawnOf), from
  // fifteen pages. Strong decks carry two or more exhibits on a quarter to a
  // third of their pages and draw one exhibit beside a text column on about
  // one in eight; a generated deck that passed every other rule drew them at
  // 14% and 33%. The floor sits under strong decks' lowest share, so a deck
  // that chose its pages passes with room, and it counts every way a page
  // carries two bodies of evidence - panels, a sequence, a metric strip over
  // its chart, row blocks with an exhibit each, a photograph under an exhibit.
  // The cap sits half as high again as strong decks' share: the column is a
  // good page, and a deck that reaches for it on one page in three has
  // stopped asking what each page has to show.
  structureFrom: 15,
  multiShareMin: 0.2,
  columnShareMax: 0.2,
  // Keyed on the drawn skeleton, not the declared type. The commonest skeleton
  // in strong decks is a full-width chart carrying its own callouts, about 16%
  // of pages (declared, their commonest combination was 10%, under the old
  // 15% cap); one exhibit beside a column is 13%.
  signatureShareMax: 0.2,
  runMax: 2,                // three in a row of one type reads as one page repeated
  // Evidence depth: strong decks' chart pages plot a median of about 22 values
  // (the middle half 10 to 48); a generated fifty-page deck's plotted 5. Each
  // page is floored at 8 when it compiles (page-types.mjs EVIDENCE_FLOOR), and
  // a deck of pages that all sit on the floor is still thin: the median chart
  // page has to reach 15, between strong decks' lower quartile and median, so
  // half the charts carry a peer set, a second series or a longer window. Read
  // from eight chart pages, where a median means something.
  evidenceFrom: 8,
  evidenceMedianMin: 15,
});

// The pages a deck of one exhibit and a column is usually hiding, named with
// their choices in the repairs so the author can reach for them.
const ALTERNATIVES = "two cuts of the same evidence side by side, each with its finding under it (`panels`, form `row`, commentary `captions`); " +
  "the exhibit under a strip of the three numbers that carry the claim (`numbers`, form `metric-strip`); the exhibit alone, its explanation " +
  "written as callouts on the plot (commentary `on-exhibit`) or closed by one implication (commentary `so-what-bar`); labelled row blocks, each " +
  "with its bullets and a number or small exhibit (`parallel`, form `labelled-rows`); two or three exhibits joined by arrows for cause and " +
  "effect (`panels`, form `sequence`); a table whose last column is the implication (`lookup` or `scorecard`, commentary `in-exhibit`)";
// What the middle page of a run of one type can become, by the run's type:
// the forms the same evidence takes as a different page.
const RUN_ALTERNATIVES = {
  panels: "one of its cuts as a `trend` or `ranking` page with the other in a callout or the rail, or a `numbers` metric-strip over one exhibit",
  trend: "`panels` (the measure beside a second cut), a `numbers` hero-number with the series as its evidence, or a `bridge` if it explains a change",
  ranking: "`panels` (two cuts of the set side by side), a `scorecard` if the members are rated on several measures, or `numbers`",
  numbers: "a `trend` or `ranking` page for the series behind the figure, or `panels`",
  composition: "a `ranking` of the parts, or `panels` setting the mix beside its change",
  matrix: "a `scorecard` coding the cells, `parallel` labelled rows, or `options` compare",
  scorecard: "a `matrix` of findings, or a `ranking` of the measure that decides it",
  lookup: "a `scorecard` coding the cells, or `profiles`",
  parallel: "`mechanism` if the items connect, or a `matrix` of findings",
  argument: "`statement`, or a page whose exhibit carries the evidence the prose describes",
};

/**
 * What the deck's chart pages plot, from the counts the compiler recorded on
 * each page (`pageType.values`): how many chart pages, their median and range,
 * and the five thinnest - read by the gate below and printed in the author's summary.
 */
export function evidenceDepth(slides) {
  const charts = slides.filter((s) => s.pageType?.chart && Number.isFinite(s.pageType.values));
  const values = charts.map((s) => s.pageType.values).sort((a, b) => a - b);
  const mid = values.length / 2;
  const median = values.length ? (values.length % 2 ? values[Math.floor(mid)] : (values[mid - 1] + values[mid]) / 2) : 0;
  const thinnest = [...charts].sort((a, b) => a.pageType.values - b.pageType.values).slice(0, 5).map((s) => `${s.id ?? "?"} (${s.pageType.values})`);
  return { chartPages: charts.length, median, min: values[0] ?? 0, max: values.at(-1) ?? 0, thinnest };
}

/**
 * The deck's structure as drawn: the skeletons and how often each is drawn,
 * and the two shares the contract holds - pages carrying two or more exhibits,
 * and pages that are one exhibit beside a text column. Read from what the
 * compiler recorded on each page (`pageType.drawn`), or from `drawnOf` for a
 * deck compiled before it was recorded; pages with neither are left out.
 */
export function structureMix(slides, { drawnOf } = {}) {
  const known = slides.filter(isContent).map((s) => ({ s, d: s.pageType?.drawn ?? (drawnOf && s.pageType ? drawnOf(s) : null) })).filter((x) => x.d);
  const pick = (test) => { const hit = known.filter(test); return { pages: hit.length, share: known.length ? share(hit.length, known.length) : 0, ids: hit.map((x) => x.s.id ?? null) }; };
  const skeletons = {};
  for (const s of slides.filter(isContent)) if (s.pageType?.skeleton) skeletons[s.pageType.skeleton] = (skeletons[s.pageType.skeleton] || 0) + 1;
  const multi = pick((x) => x.d.exhibits >= 2);
  return { pages: known.length, multi: { pages: multi.pages, share: multi.share }, column: pick((x) => x.d.column), skeletons: Object.fromEntries(Object.entries(skeletons).sort((a, b) => b[1] - a[1])) };
}

const isContent = (slide) => (!slide.kind || slide.kind === "content" || slide.kind === "statement" || slide.kind === "takeaways") && slide.title !== undefined;
const share = (n, of) => Math.round((n / of) * 100) / 100;

/**
 * Findings for a deck's content slides. `structureOf` is passed in so the
 * gate and the compiler share one definition without a circular import.
 */
// Words are not this file's business: the text contract holds every page to
// the floor for its reading task, on the text of the composed page
// (derive-content.mjs), and the rendered deck's empty space is DECK_THIN_PAGES.
export function varietyFindings(spec, { structureOf, drawnOf } = {}) {
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
  const sequence = (from, to) => slides.slice(from, to).map((s) => `${s.id ?? "?"} ${s.pageType.type}`).join(" | ");
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

  // Runs: a declared series (one template on purpose) counts once. The repair
  // names the page to change and what to: splitting one page into panels made
  // three panels pages in a row, and "change the middle page" left the author
  // to find which one and to guess a type its evidence could carry.
  let run = [], at = 0;
  const flush = () => {
    if (run.length > VARIETY.runMax && !(run[0].pageType.series && run.every((s) => s.pageType.series === run[0].pageType.series))) {
      const type = run[0].pageType.type, ids = run.map((s) => s.id ?? null);
      const middle = run[Math.floor(run.length / 2)];
      const start = at - run.length;
      // The nearest page of another type the middle page can trade places
      // with: neither neighbour of its place is of the run's type, so the
      // trade breaks this run without starting another.
      const mid = start + Math.floor(run.length / 2);
      const swap = slides.map((s, j) => ({ s, j })).filter(({ s, j }) => (j < start - 1 || j > at) && s.pageType.type !== type
        && slides[j - 1]?.pageType.type !== type && slides[j + 1]?.pageType.type !== type)
        .sort((a, b) => Math.abs(a.j - mid) - Math.abs(b.j - mid))[0]?.s;
      block("VARIETY_TYPE_RUN", { type, run: run.length, pages: ids, sequence: sequence(Math.max(0, start - 1), at + 1) }, VARIETY.runMax,
        `${run.length} ${type} pages in a row (${ids.join(", ")}) read as one page repeated. Change ${middle.id} to another type - ` +
        `${RUN_ALTERNATIVES[type] ?? "the type its evidence actually carries"}` +
        (swap ? `; or, if the storyline allows, trade places with ${swap.id} (${swap.pageType.type})` : "") +
        ". Mark a deliberate run of one template with a shared `series`.", ids);
    }
  };
  for (const slide of slides) {
    if (run.length && slide.pageType.type === run[0].pageType.type) run.push(slide);
    else { flush(); run = [slide]; }
    at += 1;
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
  const mix = structureMix(slides, { drawnOf });
  if (mix.pages >= VARIETY.structureFrom && mix.multi.share < VARIETY.multiShareMin) {
    block("VARIETY_PANELS", { pages: mix.multi.pages, of: mix.pages, share: mix.multi.share }, VARIETY.multiShareMin,
      `${mix.multi.pages} of ${mix.pages} pages carry two or more exhibits; a deck this long needs ${Math.ceil(VARIETY.multiShareMin * mix.pages)}, and strong decks ` +
      "carry them on a quarter to a third of their pages - the same measure for several members, two measures that together prove the claim, " +
      "before and after, cause and effect. Find the pages where the reader would otherwise hold one chart in mind while turning to the next, and " +
      "draw them as `panels` (form `row`, `grid` or `stack`, each panel headed with its finding under it as a `caption`), `panels` form `sequence` " +
      "(two or three exhibits joined by arrows), `numbers` form `metric-strip` (three numbers over their chart), `parallel` form `labelled-rows` " +
      "with a small `exhibit` on each row, `options` form `two-up`, or `picture` form `photo-backdrop` (the exhibit on its subject's photograph).",
      null);
  }
  if (mix.pages >= VARIETY.structureFrom && mix.column.share > VARIETY.columnShareMax) {
    block("VARIETY_COLUMN", { pages: mix.column.pages, of: mix.pages, share: mix.column.share, ids: mix.column.ids }, VARIETY.columnShareMax,
      `${mix.column.pages} of ${mix.pages} pages are one exhibit with a text column beside it - points beside or before it, a rail, or a hero number ` +
      `with its points - where strong decks draw about one page in eight that way; at most ${Math.floor(VARIETY.columnShareMax * mix.pages)} here. ` +
      `Keep the column where the argument needs a paragraph the exhibit cannot hold, and redraw the rest as what they show: ${ALTERNATIVES}.`,
      mix.column.ids);
  }
  const depth = evidenceDepth(slides);
  if (depth.chartPages >= VARIETY.evidenceFrom && depth.median < VARIETY.evidenceMedianMin) {
    block("EVIDENCE_DEPTH", depth, VARIETY.evidenceMedianMin,
      `The median chart page plots ${depth.median} values across ${depth.chartPages} chart pages; strong decks' chart pages plot about 22 ` +
      `(the middle half 10 to 48), and this deck's median has to reach ${VARIETY.evidenceMedianMin}. Deepen the thinnest - ${depth.thinnest.join(", ")} - ` +
      "with the evidence a sharp team would have gathered: the whole peer set sorted (ranking form `distribution`), several measures for the " +
      "same members (`aligned-bars`), the subject indexed against its peers (trend form `indexed`), a prior period or a benchmark as a second " +
      "series, a longer window. Where the data stops, that is a research task, not a styling one.", depth.thinnest.map((t) => t.split(" ")[0]));
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
  findings.push(...reviewedDeckFindings(spec, slides));
  return findings;
}

// Deck-level defects a whole-deck review found, read from the compiled pages.
export const REVIEWED = Object.freeze({ tableWindow: 10, tableRunMax: 5, earlyPages: 3, titleShare: 0.2, titleNames: 2 });
const CODED_TABLE = new Set(["binary", "harvey", "heatmap", "bars", "rag", "lights", "progress", "dot", "check", "trend", "logo", "photo"]);
const tablesOf = (slide) => [slide.exhibit, ...(slide.exhibits || [])].filter((ex) => ex?.type === "table");

/**
 * How a page's table reads before a word of it is read: the first column
 * filled or open, cells coded or all text, a short grid or a long one, and a
 * band across its foot or none. A fifty-page deck set sixteen of its pages as
 * dark first-column text grids closed by a grey strip, eight of them in ten
 * consecutive pages on its capital structure - funding stages, commitments and
 * verdicts all in one grammar - and the reviewer read them as one page.
 */
export function tableConstruction(slide) {
  const table = tablesOf(slide)[0];
  if (!table && slide.shape !== "findings-matrix") return null;
  const columns = table?.columns || [];
  const rows = table ? table.rows || [] : slide.rows || [];
  const first = !table || table.treatment === "categories" || (table.treatment === undefined && columns.some((c) => c?.type === "category"))
    ? "filled first column" : table.treatment === "standard" ? "filled header" : "open first column";
  const coded = columns.some((c) => CODED_TABLE.has(c?.type) || c?.heat || c?.bar || c?.harvey)
    || rows.some((row) => (Array.isArray(row) ? row : row?.cells || []).some((cell) => CODED_TABLE.has(cell?.type)));
  return [first, coded ? "coded cells" : "text cells", rows.length > 8 ? "long" : "short", slide.soWhat ? "a band at the foot" : "open foot"].join(" · ");
}

function reviewedDeckFindings(spec, slides) {
  const findings = [];
  const block = (code, measured, threshold, repair, pages = null) => findings.push({ slide: pages, code, severity: "blocker", measured, threshold, repair });
  const analytical = slides.filter((s) => s.pageType && !["statement", "summary"].includes(s.pageType.type));
  // Table monotony: the worst window of ten analytical pages.
  let worst = null;
  for (let at = 0; at + REVIEWED.tableWindow <= Math.max(analytical.length, REVIEWED.tableWindow); at += 1) {
    const window = analytical.slice(at, at + REVIEWED.tableWindow), tally = new Map();
    for (const s of window) { const key = tableConstruction(s); if (key) tally.set(key, [...(tally.get(key) || []), s.id ?? null]); }
    for (const [key, ids] of tally) if (ids.length > REVIEWED.tableRunMax && (!worst || ids.length > worst.ids.length)) worst = { key, ids, from: window[0]?.id ?? null, to: window.at(-1)?.id ?? null };
  }
  if (worst) block("VARIETY_TABLES", { construction: worst.key, pages: worst.ids.length, window: [worst.from, worst.to], ids: worst.ids }, REVIEWED.tableRunMax,
    `${worst.ids.length} of the ${REVIEWED.tableWindow} analytical pages from ${worst.from} to ${worst.to} are the same table - ${worst.key} (${worst.ids.join(", ")}). ` +
    "A reader stops telling them apart, and the differences in the evidence go with them. Draw each as what its evidence is: funding stages or a " +
    "cash position as a bridge or a flow (`bridge`, `mechanism` form `flow`), commitments over time as bars aligned on their durations (`schedule` " +
    "form `gantt`, `ranking` form `aligned-bars`), verdicts as a coded scorecard (`scorecard` forms harvey, rag, check), measures as a chart; keep the table for the look-up.", worst.ids);

  // Identity: the players the deck compares, shown by their marks early.
  const players = (Array.isArray(spec.players) ? spec.players : []).map((p) => (typeof p === "string" ? p : p?.name)).filter((name) => typeof name === "string" && name.trim());
  const named = players.length >= 2 ? players : titleNames(analytical);
  if (named.length >= 2) {
    const early = [spec.cover, ...analytical.slice(0, REVIEWED.earlyPages)].filter(Boolean);
    const marks = early.flatMap(logoTexts).join(" \n ").toLowerCase();
    const unmarked = named.filter((name) => !marks.includes(name.toLowerCase()));
    if (unmarked.length) block("PLAYERS_UNMARKED", { players: named, unmarked, pages: early.map((p) => p.id ?? "cover") }, 0,
      `The deck compares ${named.join(", ")}${players.length >= 2 ? "" : " (named in its titles again and again)"}, and neither the cover nor the first ${REVIEWED.earlyPages} pages ` +
      `shows ${unmarked.length === named.length ? "their logos" : `the logo of ${unmarked.join(", ")}`}. Introduce them by their marks before the evidence starts: a \`profiles\` page ` +
      "(form `logos`, or `logo-table` with each player's numbers), or a `logo` column in an early table. Write each as `{ alt: \"<Name> logo\" }` - " +
      `the build fetches it from the player's Wikipedia infobox${players.length >= 2 ? "" : "; declare them in the deck's `players` so it can"}.`,
      early.map((p) => p.id ?? "cover"));
  }
  // A page that introduces players or products as cards is about what they look like as much as what they do.
  for (const s of slides.filter((slide) => slide.pageType?.type === "profiles" && slide.pageType.form === "cards")) {
    const items = tablesOf(s).length ? [] : (s.exhibit?.items || []);
    if (items.length && !items.some((item) => ["logo", "media", "image", "photo", "picture"].some((key) => item?.[key])))
      block("PROFILE_UNPICTURED", { page: s.id ?? null, cards: items.length }, 1,
        `${s.id}: ${items.length} cards introduce ${items.map((item) => item?.title ?? item?.name).filter(Boolean).slice(0, 4).join(", ")} with no logo or picture on any of them. ` +
        "A reader recognises a company by its mark and a product by its look: give each card its `logo` ({ alt: \"<Name> logo\" }, fetched by name) or a credited " +
        "`image` ({ alt, search }, fetched from Wikimedia Commons), or introduce them as form `logos`.", [s.id ?? null]);
  }
  return findings;
}

/** Every logo a page draws, as the text that names it: `{ alt }` logos, logo cells, logos exhibits. */
function logoTexts(page) {
  const found = [];
  const walk = (value, inLogo) => {
    if (Array.isArray(value)) return value.forEach((v) => walk(v, inLogo));
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (key === "alt" && typeof v === "string" && (inLogo || /\blogo\b/i.test(v))) found.push(v);
      else walk(v, inLogo || key === "logo" || (key === "exhibit" && v?.type === "logos"));
    }
    if (value.type === "logos") found.push(...(value.items || []).map((item) => String(item?.name ?? "")));
  };
  walk(page, false);
  return found;
}

/**
 * The organisations a deck without `players` keeps naming: capitalised names
 * in a fifth of its titles or more, never written in lower case. Two or more
 * of them make a comparison of named players.
 */
function titleNames(slides) {
  const titles = slides.map((s) => String(s.title ?? ""));
  if (titles.length < 8) return [];
  const lower = new Set(titles.join(" ").match(/\b[a-z][a-z'’]+\b/g) ?? []);
  const counts = new Map();
  for (const title of titles) for (const name of new Set((title.match(/\b[A-Z][A-Za-z0-9]*[A-Z0-9]?[A-Za-z0-9]*\b/g) ?? []).filter((w) => w.length > 2 && !lower.has(w.toLowerCase()))))
    counts.set(name, (counts.get(name) || 0) + 1);
  const names = [...counts].filter(([, n]) => n >= Math.max(4, REVIEWED.titleShare * titles.length)).map(([name]) => name);
  return names.length >= REVIEWED.titleNames ? names : [];
}
