// Deck assembly: a v3 deck to the planner's deckPlan (`composeDeck`,
// `toDeckPlan`). The slides become pages - a slide mixing reading modes or
// carrying heavy tables split in two, a long table continued across pages -
// each page is composed (compose-page.mjs), and the deck's furniture is added:
// section tabs and trackers, the agenda, the picture credits and the template.
import path from "node:path";
import { mapAll } from "./core.mjs";
import { measureTable } from "./tables.mjs";
import { resolveWeight, normalizeWeight } from "./weight.mjs";
import { readJsonSync } from "./cli.mjs";
import { applyDesign } from "./design-systems.mjs";
import { composedPlaces } from "./revision.mjs";
import { styleTable, heavyTable, barScales, validateCategoryLabels, columnWeight } from "./compose-tables.mjs";
import { DIAGRAM_TYPES } from "./compose-exhibits.mjs";
import { BODY_WIDTH, COLUMN_GAP, LAYOUT, CONNECTOR_WIDTH, withDeckDensity, withDesignLayout } from "./compose-body.mjs";
import { pointsPerRow, resolveFill } from "./compose-points.mjs";
import { imageProps, playerMarks, pictureCredits, sourcedPicture } from "./compose-pictures.mjs";
import { composeSlide } from "./compose-page.mjs";
import { AGENDA_LIMITS, agendaStyleFor } from "./panels.mjs";

const V3 = "professional-slides.deck/v3";

function isV3(spec) { return spec?.schema === V3; }

const tableSignature = (ex) => { const s = styleTable(ex); return `${s.variant}/${s.treatment}`; };

/**
 * Two tables on one page must read as one design. They share a row only when
 * their treatments already match and both are light; otherwise each table takes
 * its own page. The title carries a 1/2 marker, the points travel with the first
 * page and the so-what, being the pages' shared claim, with every page. An
 * explicit `layout` is left alone.
 */
/**
 * A page reads in one grammar.
 *
 * Two tables side by side are peers, and so are two charts, and a chart beside
 * a table: all of them are read the same way, by finding a value in one and
 * comparing it with a value in the other. A figure is not read that way at all.
 * A staircase, a cycle, a framework carries its argument in its shape, and the
 * reader takes it in whole rather than looking things up in it. Set one beside
 * a table and the page asks for both kinds of reading at once, with a hard join
 * down the middle where the first ends and the second begins - which is a page
 * a reader has to be told how to read.
 *
 * So a row the composer chose for itself never mixes the two: the page splits,
 * and each half keeps the grammar it was drawn in. An explicit `arrange` or
 * `layout` is the author overriding this on purpose and is left alone.
 */
const FIGURE_TYPES = DIAGRAM_TYPES.filter((type) => type !== "metrics");
const readingMode = (ex) => (FIGURE_TYPES.includes(String(ex?.type ?? "")) ? "figure" : "measured");

export function splitReadingModes(slide) {
  if (slide.layout && slide.layout !== "auto") return [slide];
  if (slide.arrange) return [slide];
  const exhibits = slide.exhibits || [];
  if (exhibits.length < 2) return [slide];
  if (new Set(exhibits.map(readingMode)).size < 2) return [slide];
  return exhibits.map((ex, i) => {
    const page = { ...slide, exhibit: ex, title: `${slide.title} (${i + 1}/${exhibits.length})` };
    delete page.exhibits;
    if (slide.id) { page.id = `${slide.id}-${i + 1}`; page.sourceSlideId = slide.sourceSlideId ?? slide.id; }
    // The commentary belongs to the page that carries the evidence it reads.
    if (i !== 0) delete page.points;
    return page;
  });
}

export function splitTables(slide) {
  if (slide.layout && slide.layout !== "auto") return [slide];
  const exhibits = slide.exhibits || [];
  const tables = exhibits.filter((ex) => ex?.type === "table");
  if (tables.length < 2) return [slide];
  const oneDesign = new Set(tables.map(tableSignature)).size === 1;
  if (oneDesign && !tables.some(heavyTable)) return [slide];
  return exhibits.map((ex, i) => {
    const page = { ...slide, exhibit: ex, title: `${slide.title} (${i + 1}/${exhibits.length})` };
    delete page.exhibits;
    if (slide.id) { page.id = `${slide.id}-${i + 1}`; page.sourceSlideId = slide.sourceSlideId ?? slide.id; }
    if (i !== 0) delete page.points;
    return page;
  });
}

// Commentary set in columns under a full-width table (`exhibit-top`, or the
// journal's lean toward it) takes its height from the table's budget: each
// column as many body lines as its longest point needs, plus its lead and the
// gap above the row. An estimate, like the rest of the budget - the renderer
// measures - but a page that leaves it out plans rows it cannot hold.
function pointsBelowHeight(slide) {
  const points = Array.isArray(slide.points) ? slide.points : [];
  const below = slide.layout === "exhibit-top" || (!slide.layout && (LAYOUT.shapeBias?.["exhibit-top"] ?? 0) > 0 && points.length >= 2 && points.length <= 4);
  if (!below || !points.length) return 0;
  // In rows as exhibitOverCommentary sets them (pointColumns).
  const perRow = pointsPerRow(points.length);
  const perLine = Math.max(20, Math.floor((BODY_WIDTH - COLUMN_GAP * (perRow - 1)) / perRow / 6.4));
  const text = (point) => typeof point === "string" ? point : `${point?.lead ?? ""} ${point?.text ?? ""}`;
  let height = 22;
  for (let at = 0; at < points.length; at += perRow) {
    height += (Math.max(...points.slice(at, at + perRow).map((point) => Math.ceil(text(point).length / perLine))) + 1) * 18;
  }
  return height;
}

/**
 * A lone table under an auto layout steps down its density - body, compact,
 * dense - before it splits, and splits only where its rows as the renderer
 * measures them do not fit the body at the densest: into equal pages marked
 * (1/2), (2/2), the header repeated. Sixteen rows of short cells, or twelve
 * that wrap, stay one table.
 */
export function paginateTable(slide, bodyScale = 1) {
  if (slide.layout && !["auto", "exhibit-full"].includes(slide.layout)) return [slide];
  const ex = slide.exhibit;
  if (!ex || ex.type !== "table" || !Array.isArray(ex.rows) || slide.exhibits) return [slide];
  // The page holds about 16 body lines of table (compact rows in a dense deck
  // run to 14–20 one-line rows): a row of short cells counts one line, longer
  // cells wrap, so a ranking table keeps a dozen rows on a page while a text
  // table breaks at eight.
  const cellText = (cell) => String(cell?.text ?? (Array.isArray(cell?.points) ? cell.points.join(" ") : cell ?? ""));
  const columnChars = slide.points?.length ? 30 : 42;
  const lines = (r) => Math.max(1, ...(Array.isArray(r) ? r : r.cells || []).map((cell) => Math.ceil(cellText(cell).length / columnChars)));
  // Row heights in body density: a one-line row takes about 34px, each further
  // line 16px, the header 40px. The budget is the body height (508px built in,
  // scaled by a template's chrome) less the page's other furniture.
  // Heights come from the table renderer itself, not from a model of it: the
  // styled props (status pills, zebra bands, wrapped cells) decide the row
  // height, and only `measureTable` knows them.
  const width = slide.points?.length || slide.insight || slide.kpi ? Math.round((BODY_WIDTH - CONNECTOR_WIDTH - COLUMN_GAP * 3) * 3 / 5) : BODY_WIDTH;
  // A single-line row measures 48px at body density, 32 compact and 24 dense,
  // with a header of 44, 32 and 24: the fallback when a spec the renderer cannot
  // measure (mismatched columns, a half-built table) reaches this far.
  const ROW = { body: { row: 48, line: 20, header: 44 }, compact: { row: 32, line: 16, header: 32 }, dense: { row: 24, line: 14, header: 24 } };
  const modelled = (density) => {
    const metric = ROW[density] || ROW.body;
    return metric.header + ex.rows.reduce((sum, r) => sum + metric.row + metric.line * (lines(r) - 1), 0);
  };
  const heightAt = (density) => {
    try {
      const styled = styleTable({ ...ex, density });
      const measured = measureTable({ frame: { x: 0, y: 0, width, height: 100000 }, props: { ...styled, density } }).height;
      return Number.isFinite(measured) ? measured : modelled(density);
    } catch {
      return modelled(density);
    }
  };
  const available = 508 * bodyScale - (slide.callout ? 70 : 0) - (Array.isArray(slide.metrics) && slide.metrics.length ? 112 : 0) - (slide.soWhat ? (LAYOUT.takeaway === "statement" ? 64 : 44) : 0) - 4
    // The column's gap above each block stacked under the table.
    - 22 * [slide.callout, slide.soWhat].filter(Boolean).length
    - pointsBelowHeight(slide)
    // bodyTop holds a two-line title, not a two-line title and a standfirst:
    // with both, the rule and the body start a line lower (8px gap, a 20px line).
    - (slide.subtitle && String(slide.title ?? "").length > 60 ? 28 : 0);
  // The density ladder comes before the split. A twenty-row table set compact is
  // one page of evidence; the same table halved across two pages is two pages of
  // half an argument, and strong decks run tables to twenty and thirty
  // rows rather than splitting them. `density` on the exhibit still wins.
  const ladder = ex.density === undefined ? ["body", "compact", "dense"] : [ex.density];
  const fits = ladder.find((density) => heightAt(density) <= available);
  // `_densityChosen`: the estimate picked this step, not the author, so the
  // page may still set it a step up if the real frame holds it.
  if (fits) return [fits === "body" || fits === ex.density ? slide : { ...slide, exhibit: { ...ex, density: fits, _densityChosen: true } }];
  const densest = ladder[ladder.length - 1];
  const perRow = Math.max(20, heightAt(densest) / Math.max(1, ex.rows.length));
  const rowsPerPage = Math.max(3, Math.floor(available / perRow));
  const pages = Math.ceil(ex.rows.length / rowsPerPage), per = Math.ceil(ex.rows.length / pages);
  // One scale for the whole table, fixed before it is cut: the halves are two
  // views of one measure, and a bar on page two means what it means on page one.
  validateCategoryLabels(ex);
  const shared = barScales(ex);
  // The same numeric domain is insufficient when auto-width changes the plot.
  // Freeze column geometry from the whole table before slicing its rows.
  const sharedColumns = ex.columns.map((column, index) => ({ width: columnWeight(ex, index),
    ...(typeof column === "string" ? { label: column, bold: index === 0 } : column) }));
  return Array.from({ length: pages }, (_, i) => {
    const rows = ex.rows.slice(i * per, (i + 1) * per);
    // A highlighted row travels with the page that holds it; other pages drop the key.
    const label = (r) => String((Array.isArray(r) ? r : r.cells)[0]?.text ?? (Array.isArray(r) ? r : r.cells)[0] ?? "").trim().toLowerCase();
    const keeps = ex.highlightRow === undefined ? false : Number.isInteger(ex.highlightRow) ? ex.highlightRow >= i * per && ex.highlightRow < (i + 1) * per : rows.some((r) => label(r) === String(ex.highlightRow).trim().toLowerCase());
    const { highlightRow, ...rest } = ex;
    const page = { ...slide, exhibit: { ...rest, columns: sharedColumns, density: densest, rows,
      ...(Object.keys(shared).length ? { scales: { ...shared, ...(rest.scales || {}) } } : {}),
      ...(keeps ? { highlightRow: Number.isInteger(highlightRow) ? highlightRow - i * per : highlightRow } : {}) }, title: `${slide.title} (${i + 1}/${pages})` };
    if (slide.id) { page.id = `${slide.id}-${i + 1}`; page.sourceSlideId = slide.sourceSlideId ?? slide.id; }
    if (i !== 0) delete page.points;
    return page;
  });
}

/**
 * `agenda: true` numbers the section dividers, inserts a Contents page before
 * the first section and repeats it (with the coming section highlighted) in
 * front of every later section: the classic tracker. `agenda: "once"` inserts
 * only the Contents page.
 */
/**
 * `sectionTabs: true` on the deck: every analytical page under a section
 * carries the section pill tabs above its title, the current section filled.
 * A deck with sections gets them by default — a reader who cannot tell which
 * section they are in is reading a pile of pages — and `sectionTabs: false`
 * takes them off (use `agenda` instead, which tracks by repeating the contents).
 */
/**
 * The four trackers, and where each one sits.
 *
 * `pills` hug the right of the title row - the right 20% of the band is
 * reserved for exactly this - and the other three are drawn from the left
 * margin, which is the left-anchored tracker a strong deck runs down the
 * side of a section. They are the same component: only the construction
 * changes, and each says where you are in a different amount of space.
 */
const TRACKER_CONSTRUCTIONS = Object.freeze({
  // Every section as a pill, the current one filled: the widest, and the only
  // one that shows the sections you are not in.
  pills: "compact-pills",
  // The current section's name alone, at the left of the title row.
  label: "compact-label",
  // "Contents / Where the value is": the section under its parent.
  breadcrumb: "compact-breadcrumb",
  // 1 2 3 4 on a rail, the current one filled: position without the words, for
  // a deck whose section titles are too long to set as pills.
  "number-strip": "compact-number-strip",
});
export const TRACKER_NAMES = Object.freeze(Object.keys(TRACKER_CONSTRUCTIONS));

export function sectionTabs(slidesIn, mode = "pills") {
  const construction = TRACKER_CONSTRUCTIONS[mode];
  if (!construction) throw new Error(`Unknown tracker: ${mode}; use ${TRACKER_NAMES.join(", ")}, "repeat-contents" or false`);
  const sections = slidesIn.filter((s) => s.kind === "section");
  if (sections.length < 2) return slidesIn;
  // A rail of two markers is not a position, it is a pair of dots.
  if (mode === "number-strip" && sections.length < 3) {
    throw new Error('A number-strip tracker needs three sections; use tracker: "pills" or "label" for two');
  }
  const items = sections.map((s, i) => ({ id: String(i + 1), label: s.title }));
  let current = 0;
  return slidesIn.map((slide) => {
    if (slide.kind === "section") { current = sections.indexOf(slide) + 1; return slide; }
    if (slide.kind || slide.role === "executive-summary" || slide.shape === "executive-summary" || !current || slide.tracker) return slide;
    return {
      ...slide,
      tracker: {
        trackerId: "deck-sections", items, selectedId: String(current), construction,
        ...(mode === "breadcrumb" ? { parentTitle: "Contents" } : {}),
      },
    };
  });
}

/** Whether the deck draws a contents page: `contents` where the deck sets it, otherwise from `agenda`, otherwise once it has two sections. */
const contentsModeOf = (spec) => spec.contents ?? (spec.agenda === "once" ? "once" : spec.agenda ? true : (spec.slides || []).filter((s) => s?.kind === "section").length >= 2);

/**
 * Why the deck's contents page cannot hold its sections, or null: the style
 * the deck names (`agendaStyle`) holds fewer, or the deck has more sections
 * than any style lists. Read where the deck is authored, so a style the
 * author chose is refused before a page is composed; a style the deck did
 * not name is the runtime's to fit (`agendaStyleFor`). The appendix opens
 * behind a divider of its own, which the contents page lists too.
 */
export function contentsProblem(spec) {
  const room = contentsRoom(spec);
  return room && room.sections > room.max ? room : null;
}

/**
 * Where the deck stands against its contents page, or null when it has none:
 * its sections (the appendix divider is one), the style it is held to - the
 * one the deck names, otherwise the list, which holds the most - and what
 * that style holds.
 */
export function contentsRoom(spec) {
  const sections = (spec.slides || []).filter((s) => s?.kind === "section").length + (Array.isArray(spec.appendix) && spec.appendix.length ? 1 : 0);
  if (!contentsModeOf(spec) || sections < AGENDA_LIMITS.list.min) return null;
  const style = spec.agendaStyle === "columns" ? "columns" : "list";
  return { sections, style, ...AGENDA_LIMITS[style] };
}

export function agendaPages(slidesIn, agenda, agendaStyle) {
  const sections = slidesIn.filter((s) => s.kind === "section");
  if (!agenda || sections.length < 2) return slidesIn;
  const numbered = new Map(sections.map((s, i) => [s, s.number ?? i + 1]));
  const items = sections.map((s) => ({ label: s.title, ...(s.summary ? { detail: s.summary } : {}) }));
  // The style the section count fits: columns drawn for a deck of seven
  // sections are set as the list, since the page is the runtime's to fit.
  const style = agendaStyleFor(agendaStyle, items.length);
  const out = [];
  let seen = 0;
  for (const slide of slidesIn) {
    if (slide.kind === "section") {
      // A contents page shown once is an overview and marks nothing: the grey
      // band on section one is a position indicator that never moves, and a
      // reader who meets it at the front and never again reads it as "you are
      // here" for the whole deck. A repeated contents page marks the section it
      // introduces, which is the only reason to repeat it.
      const repeats = agenda !== "once";
      if (seen === 0 || repeats) {
        out.push({ kind: "agenda", id: `agenda-${seen + 1}`, title: seen === 0 ? "Contents" : "Agenda",
                   items, ...(repeats ? { active: seen } : {}), ...(style === "columns" ? { style } : {}) });
      }
      // The divider carries the same list, the band one row lower each time:
      // the contents page the reader met at the front, kept up to date. A
      // repeated contents page already does this, so the divider leaves it be.
      out.push({ ...slide, number: numbered.get(slide),
                 ...(repeats ? {} : { contents: items.map((i) => i.label), contentsActive: seen }) });
      seen += 1;
    } else out.push(slide);
  }
  return out;
}

/**
 * The generated page that states, once, what the deck's sources are declared
 * not to name: one row for each source the registry marks `missing` (a
 * publisher, a date, a document) that a page cites, with the reason the
 * registry gives and the pages that cite it - read from what the compile
 * recorded on each page (`settles.stated.limits`, author-deck.mjs). A deck
 * whose records name no publisher says so here rather than on every page
 * that prints one of their numbers; each page's own source line still names
 * its sources. None when no cited source declares a limit.
 */
export function sourceLimitPages(spec) {
  const limits = new Map();
  for (const slide of [...(spec.slides || []), ...(spec.appendix || [])]) for (const limit of slide?.pageType?.content?.settles?.stated?.limits ?? []) {
    const entry = limits.get(limit.key) ?? { ...limit, pages: [] };
    if (slide.id) entry.pages.push(`{{page:${slide.id}}}`);
    limits.set(limit.key, entry);
  }
  if (!limits.size) return [];
  return [{ id: "source-limits", kind: "content", density: "appendix", title: "What the sources do not name",
    exhibit: { type: "table", columns: [{ label: "Source", type: "text" }, { label: "Does not name", type: "text", width: 130 }, { label: "Why, and what is known of it", type: "text" }, { label: "Cited on page", type: "text", width: 150 }],
      rows: [...limits.values()].map((limit) => [limit.name, limit.missing.join(", "), `${limit.reason}.`, limit.pages.join(", ")]) } }];
}

/** Expand a v3 deck into the deckPlan the planner consumes. */
export function composeDeck(spec, baseDir = process.cwd()) {
  return withDesignLayout(spec.designLayout, () => withDeckDensity(spec.density, () => composeDeckWith(spec, baseDir)));
}

function composeDeckWith(spec, baseDir) {
  if (!isV3(spec)) throw new Error(`Expected schema ${V3}`);
  if (!spec.id || !Array.isArray(spec.slides)) throw new Error("deck/v3 requires id and slides");
  const slides = [];
  if (spec.cover) {
    const cover = { id: "cover", kind: "cover", title: spec.cover.title, subtitle: spec.cover.subtitle || "" };
    if (spec.cover.date) cover.date = spec.cover.date;
    if (spec.cover.logo || spec.logo) cover.logo = spec.cover.logo || spec.logo;
    // `image` with `layout: "full"` puts the title on a card over a full-bleed
    // photograph; otherwise the photo takes the right half and `tone: "dark"`
    // paints the title half navy (a classic split cover).
    // The players the deck compares, by their marks, where the logos are on
    // disk (the player's own `logo`, or assets/logos/ as the build fetches it).
    const marks = playerMarks(spec, baseDir);
    if (marks.length >= 2 && !spec.cover.image) cover.marks = marks;
    // A cover photograph planned and not fetched yet is the build's to fill (fetch-pictures.mjs): until then the cover composes without it.
    if (spec.cover.image && sourcedPicture(spec.cover.image)) { cover.variant = spec.cover.layout === "full" ? "full-image" : "half-image"; cover.image = imageProps(spec.cover.image, baseDir); if (spec.cover.tone) cover.tone = spec.cover.tone; }
    else cover.variant = spec.cover.tone === "light" ? "plain" : "dark";
    if (spec.cover.notes) cover.notes = spec.cover.notes;
    slides.push(cover);
  }
  // The tracker is on by default once a deck has sections: pills above the title
  // unless the deck tracks by repeating its contents page (`agenda`).
  // The contents page and the tracker answer different questions - what the
  // deck covers, and where you are in it - so they are two settings, and
  // neither defaults from the other.
  const sections = spec.slides.filter((s) => s.kind === "section").length;
  if (spec.tracker !== undefined && ![...TRACKER_NAMES, "repeat-contents", false].includes(spec.tracker)) {
    throw new Error(`Unknown tracker: ${spec.tracker}; use ${TRACKER_NAMES.map((n) => `"${n}"`).join(", ")}, "repeat-contents" or false`);
  }
  if (spec.contents !== undefined && ![true, false, "once"].includes(spec.contents)) {
    throw new Error(`Unknown contents: ${spec.contents}; use true, "once" or false`);
  }
  // `agenda` is the old spelling of the pair and resolves to it.
  // `agenda: "once"` asks for the contents page once, at the front, as SKILL.md
  // says, and never sets `repeat-contents`.
  // Which navigation construction, when the deck does not name one.
  //
  // Pills are the widest of the four and the only one that shows the sections
  // you are not in, which earns them a deck of a few short section names; they
  // are the wrong default for seven sections or for names too long to set as
  // pills.
  //
  // The rule reads the section map the deck actually has. A deck that wants
  // something else says so with `tracker`, and all four remain available.
  const sectionTitles = spec.slides.filter((s) => s.kind === "section").map((s) => String(s.title ?? ""));
  const longestSection = Math.max(0, ...sectionTitles.map((title) => title.length));
  const defaultTracker = sections >= 6 || longestSection > 14
    // Too many to set side by side, or names too long: the current section's
    // name alone, at the left above the title.
    ? "label"
    : sections >= 4 && longestSection > 10 ? "number-strip" : "pills";
  const trackerMode = spec.tracker ?? (spec.sectionTabs === false ? false
    : spec.agenda && spec.agenda !== "once" ? "repeat-contents" : defaultTracker);
  const contentsMode = contentsModeOf(spec);
  const tabs = spec.sectionTabs ?? (TRACKER_NAMES.includes(trackerMode) && sections >= 2);
  // `appendix: [...]`: the source pages behind the story - the model grid, the
  // full table, the survey instrument - set at `density: "appendix"` behind an
  // Appendix divider. A strong deck keeps its densest pages here, and a page that
  // belongs in the appendix stops crowding the page that carries the argument.
  const appendix = Array.isArray(spec.appendix) && spec.appendix.length
    ? [{ id: "appendix-divider", kind: "section", title: "Appendix", summary: "The workings behind the story" },
       ...spec.appendix.map((page) => ({ density: "appendix", ...page }))]
    : [];
  const credits = pictureCredits(spec);
  const storySlides = [...spec.slides, ...appendix, ...sourceLimitPages(spec), ...credits];
  // The contents page leads the deck; `repeat-contents` also reprints it in
  // front of every later section, which is the other way a deck tracks.
  const agendaMode = trackerMode === "repeat-contents" ? true : contentsMode === "once" || contentsMode === true ? "once" : false;
  const trackerStyle = TRACKER_NAMES.includes(trackerMode) ? trackerMode : "pills";
  const pages = agendaPages(tabs ? sectionTabs(storySlides, trackerStyle) : storySlides, contentsMode === false ? false : agendaMode, spec.agendaStyle);
  // A tracker above the title drops the body a step (slide-chrome's trackerGap),
  // which the table budget has to know or it plans rows the page cannot hold.
  const trackerGap = spec.chrome && tabs ? 11 : 0;
  const bodyScale = spec.chrome ? Math.max(0.4, Math.min(1.2, ((spec.chrome.footerTop ?? 684) - 36 - (spec.chrome.bodyTop ?? 140) - trackerGap) / 508)) : 1;
  const fill = resolveFill(spec);
  // The weight contract: what a page of this deck is expected to carry. The
  // deck's own `weight` wins, then the house profile a template produced, then
  // the fill level.
  const weight = resolveWeight(spec, fill);
  // The shapes the last few analytical pages took, most recent first: the
  // chooser breaks a tie on variety, so a section spreads across its repertoire
  // instead of repeating whichever shape fitted first.
  const recent = [], recentStyles = [];
  const expanded = pages.flatMap(splitReadingModes).flatMap(splitTables).flatMap((p) => paginateTable(p, bodyScale));
  // A revision that carries slides from its source deck (revision.mjs) composes only some of the deck's pages: each stands
  // among the carried slides, and prints the number of its place in the deck, not of its place among the composed pages.
  const places = Array.isArray(spec.carried) && spec.carried.length ? composedPlaces(spec, [...slides, ...expanded]) : null;
  const placeOf = (index) => places?.[index] ?? index + 1;
  const pageNumbers = new Map();
  expanded.forEach((page, index) => {
    for (const key of new Set([page.id, page.sourceSlideId].filter(Boolean))) {
      const numbers = pageNumbers.get(key) || []; numbers.push(placeOf(slides.length + index)); pageNumbers.set(key, numbers);
    }
  });
  const resolveReferences = value => {
    if (typeof value === "string") return value.replace(/\{\{page:([A-Za-z0-9_-]+)\}\}/g, (_, id) => {
      const numbers = pageNumbers.get(id); if (!numbers) throw new Error(`Unknown page reference: ${id}`);
      return numbers.length > 1 ? `${numbers[0]}–${numbers.at(-1)}` : String(numbers[0]);
    });
    if (Array.isArray(value)) return value.map(resolveReferences);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, resolveReferences(v)]));
    return value;
  };
  // Every page is composed and every failure reported together.
  mapAll(expanded, (raw) => {
    // Hidden is the slide's state in the file, not its layout: it rides past
    // the composer, and a page split in two hides both halves.
    // So does the imported slide a revision's section stands for (`sourceSlide`), which is its record and never drawn.
    const { sourceSlideId, hidden, sourceSlide: _imported, ...page } = resolveReferences(raw);
    if (hidden !== undefined && typeof hidden !== "boolean") throw new Error("`hidden` is true or false");
    const composed = composeSlide(page, slides.length, baseDir, fill, weight.elements, recent, recentStyles);
    if (sourceSlideId) composed.sourceSlideId = sourceSlideId;
    if (hidden) composed.hidden = true;
    slides.push(composed);
    recent.splice(4);
    recentStyles.splice(9);
  }, (raw, index) => raw?.sourceSlideId ?? raw?.id ?? `page-${index + 1}`);
  return {
    id: spec.id,
    palette: spec.palette || "midnight",
    ...(spec.designLayout ? { design: spec.designLayout.name } : {}),
    ...(spec.designLayout?.variation ? { variation: { seed: spec.designLayout.variation.seed, lean: spec.designLayout.variation.lean, leadPoints: spec.designLayout.variation.leadPoints, tracker: spec.tracker ?? null } } : {}),
    ...(spec.pageTemplate ? { pageTemplate: spec.pageTemplate } : {}),
    ...(spec.typography ? { typography: spec.typography } : {}),
    ...(spec.chrome ? { chrome: spec.chrome } : {}),
    fill,
    weight,
    slides: slides.map((s, index) => {
      const page = spec.density && !s.density && s.kind !== "cover" ? { ...s, density: spec.density } : { ...s };
      if (places && s.kind !== "cover" && page.pageNumber === undefined) page.pageNumber = placeOf(index);
      // The document title sits in the footer beside the page number.
      if (spec.footer && s.kind !== "cover" && page.companyName === undefined) page.companyName = spec.footer;
      return page;
    })
  };
}

/**
 * Coverage: when the spec lists the brief's ranked `criteria`,
 * every criterion must be served by at least one page that carries an exhibit
 * (`serves: ["education", …]` on the slide). Returns findings; empty when covered.
 */
export function coverageFindings(spec) {
  if (!isV3(spec) || !Array.isArray(spec.criteria) || !spec.criteria.length) return [];
  const served = new Map(spec.criteria.map((c) => [String(c).toLowerCase(), []]));
  spec.slides.forEach((slide, i) => {
    const hasExhibit = Boolean(slide.exhibit || (slide.exhibits || []).length);
    for (const c of slide.serves || []) if (served.has(String(c).toLowerCase()) && hasExhibit) served.get(String(c).toLowerCase()).push(i + 1);
  });
  return [...served.entries()].filter(([, pages]) => !pages.length).map(([criterion]) => ({ slide: null, code: "MISSING_EVIDENCE", measured: criterion, threshold: "one comparative exhibit", repair: `Add a page whose exhibit compares every option on "${criterion}", and mark it serves: ["${criterion}"].` }));
}

/**
 * `template: "house.json"` applies a house profile written by
 * runtime/import-template.py from a template deck: its palette overlay,
 * typography, chrome margins, page template and density become the deck's
 * defaults; anything the spec sets explicitly still wins.
 */
export function applyTemplate(spec, baseDir = process.cwd()) {
  if (!spec?.template) return spec;
  const file = path.resolve(baseDir, spec.template);
  if (!file.endsWith(".json")) throw new Error("template must name a house profile .json (run runtime/import-template.py on the .pptx first)");
  const house = readJsonSync(file);
  if (house.schema !== "professional-slides.house/v1") throw new Error("template must be a professional-slides.house/v1 profile");
  const out = { ...spec };
  delete out.template;
  if (!spec.palette && house.palette) out.palette = house.palette;
  if (!spec.typography && house.typography) out.typography = house.typography;
  // The importer names the design system nearest the template's own frame.
  if (!spec.design && house.design) out.design = house.design;
  if (!spec.chrome && house.chrome) out.chrome = house.chrome;
  if (!spec.pageTemplate && house.pageTemplate) out.pageTemplate = house.pageTemplate;
  if (!spec.density && house.density) out.density = house.density;
  if (!Object.hasOwn(spec, "footer") && house.footer) out.footer = house.footer;
  // A template deck also sets how full its pages read: the importer measures the
  // template's own words, elements and body coverage and writes them as `fill`
  // and `weight`, so a deck built on a dense house is judged by that house.
  if (!spec.fill && house.fill) out.fill = house.fill;
  if (!spec.weight && house.weight) out.weight = normalizeWeight(house.weight, "template weight");
  return out;
}

/** The plan the planner consumes, for a professional-slides.deck/v3 spec with its template and design applied. */
export function toDeckPlan(specIn, baseDir) {
  const spec = applyDesign(applyTemplate(specIn, baseDir));
  if (isV3(spec)) return composeDeck(spec, baseDir);
  throw new Error("Spec must be professional-slides.deck/v3");
}
