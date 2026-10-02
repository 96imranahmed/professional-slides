// The bars a built deck clears before it is delivered, measured off its own
// composed scene.
//
// They are the plan gates' craft numbers applied to what was actually drawn
// rather than to what was promised: a plan can record nine architectures and
// the deck it produced still carry three distinct exhibits per ten pages, no
// table treatment and no chart annotation. Delivery measures them after the
// page gates (deliver-deck.mjs); the cold-run scorer (evals/cold-run/score.mjs)
// re-exports them, so the harness and delivery hold a deck to one set of bars.
//
// A miss blocks delivery unless the deck carries a waiver for that bar
// (deck-level `waivers: [{ code, reason }]`, carried from pages.json) and the
// accepted review confirms it: the packet shows each waiver to the reviewer and
// the review returns a verdict for each.
//
// The same measures decide when a reviewer may lower a deck finding it calls
// partly fixed (DOWNGRADE_MEASURES): a deck-scope finding about table
// monotony drops only when the table measure now passes, not on the
// reviewer's say-so.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAnalyticalPage, PLAN, REFERENCE, DECK_LENGTH } from "./weight.mjs";
import { textWords } from "./text-contract.mjs";

const CRAFT = PLAN.craft;

// Every bar a delivery can miss, by the code a waiver names.
export const BUILD_BAR_CODES = Object.freeze({
  BAR_EXHIBIT_VARIETY: "fewer distinct exhibits per ten analytical pages than the build bar",
  BAR_TABLES_TREATED: "a smaller share of tables carrying a treatment (heat, ratings, in-cell bars, state marks, logos, icons, a total band) than the build bar",
  BAR_CHARTS_ANNOTATED: "a smaller share of charts carrying an annotation or a highlighted mark than the build bar",
  BAR_DRAWINGS_PER_PAGE: "fewer drawn primitives per analytical page than the build bar: pages of rules and paragraphs",
  BAR_UNSOURCED_PICTURES: "a picture frame shipped with no picture in it",
});

/**
 * The floors, from the contract (weight.json plan.craft) and the reference
 * page's drawings. `drawings` is the reference figure: a well-made analytical page
 * carries a median of 32 primitives that are not type.
 */
export const BUILD_BARS = Object.freeze({
  exhibitVarietyPerTen: { code: "BAR_EXHIBIT_VARIETY", min: CRAFT.exhibitVarietyPerTen.min, reference: CRAFT.exhibitVarietyPerTen.observed },
  tablesTreated: { code: "BAR_TABLES_TREATED", min: CRAFT.tableTreated.min, reference: CRAFT.tableTreated.observed },
  chartsAnnotated: { code: "BAR_CHARTS_ANNOTATED", min: CRAFT.chartAnnotated.min, reference: CRAFT.chartAnnotated.observed },
  drawingsPerPage: { code: "BAR_DRAWINGS_PER_PAGE", min: 12, reference: REFERENCE.slides.drawings },
});

/**
 * Bars that are a count of something that should not be there at all, rather
 * than a floor something has to reach. A cold run shipped two empty picture
 * frames and passed everything, because a frame counts as a picture everywhere
 * a picture is counted.
 */
export const BUILD_CEILINGS = Object.freeze({
  unsourcedPictures: { code: "BAR_UNSOURCED_PICTURES", max: 0 },
});

// A deck-wide rate over a handful of pages is noise: the floors read from this
// many analytical pages (weight.json deckLength.craft); the ceilings always apply.
export const BARS_FROM = DECK_LENGTH.craft ?? CRAFT.from?.min ?? 0;

// Counts describe rendered devices, not whether their semantic use is
// appropriate. What makes a table treated is one data file, read here, by the
// craft gate (craft_gates.mjs, through tableStatistics) and by the page gates
// (deck_gates.py): heat cells, Harvey balls or dots, in-cell bars, state marks,
// logos, icons or a total band. Zebra banding is not one.
const TABLE_TREATMENTS = Object.freeze(JSON.parse(readFileSync(fileURLToPath(new URL("./gates/table-treatments.json", import.meta.url)), "utf8")).treatments);
const TREATED_PREFIXES = Object.values(TABLE_TREATMENTS).flatMap((t) => t.rolePrefixes || []);
const TREATED_CELLS = new Set(Object.values(TABLE_TREATMENTS).flatMap((t) => t.cellTypes || []));
const TREATED_BANDS = new Set(Object.values(TABLE_TREATMENTS).flatMap((t) => t.rowBands || []));
const ANNOTATION = /^(annotation-|chart-(bracket|delta|event-|highlight|reference|band|callout|change))/;
const TABLE = /^(table|comparison-table|heatmap|trend-rows)$/;

const componentsOf = (slide) => (slide.componentInstances || []).map((c) => String(c.component));
const rolesOf = (slide) => (slide.nodes || []).map((n) => String(n.role ?? ""));

// A row block's small table is the row's evidence beside its bullets, not a
// table the page is built on: TABLE_TOO_SHORT exempts it (page-types.mjs
// TABLE_ROWS), and the treated share does not count it. A table is in a row
// block when its nodes descend from a `<page>-block-<n>` section, and small
// under ROW_BLOCK_TABLE_ROWS body rows, a total or group row not being one.
// deck_gates.py row_block_small_table is the same test.
export const ROW_BLOCK_TABLE_ROWS = 3;
const ROW_BLOCK = /-block-\d+$/;
export function rowBlockSmallTable(slide, instance) {
  const key = instance.instanceId ?? instance.id;
  const nodes = (slide.nodes || []).filter((n) => n.data?.componentInstance === key);
  if (!nodes.some((n) => (n.data?.componentAncestors || []).some((a) => ROW_BLOCK.test(String(a))))) return false;
  const banded = new Set(nodes.filter((n) => n.role === "table-row-band" && ["total", "group"].includes(n.data?.rowStyle)).map((n) => n.data.row));
  const body = new Set(nodes.map((n) => n.data?.row).filter((row) => Number.isInteger(row) && !banded.has(row))).size;
  return body > 0 && body < ROW_BLOCK_TABLE_ROWS;
}
// A chart's data table prints the chart's own figures under its categories
// (`dataTable`, the model page): it is part of the chart, not a table the page
// is built on, and the treated share does not count it. Its nodes carry
// `chartData` (tables.mjs). deck_gates.py chart_data_table is the same test.
export function chartDataTable(slide, instance) {
  const key = instance.instanceId ?? instance.id;
  return (slide.nodes || []).some((n) => n.data?.componentInstance === key && n.data?.chartData === true);
}
/** The page's tables the treated share counts: every table but a row block's small one and a chart's data table. */
export const countedTables = (slide) => (slide.componentInstances || [])
  .filter((c) => TABLE.test(String(c.component)) && !rowBlockSmallTable(slide, c) && !chartDataTable(slide, c));
/** The nodes a table draws: those naming it as their instance; a node naming none belongs to every table on its page. */
const tableNodes = (slide, instance) => (slide.nodes || [])
  .filter((n) => !n.data?.componentInstance || n.data.componentInstance === instance.instanceId || n.data.componentInstance === instance.id);
/** Whether `node` is one of a table's treatments (gates/table-treatments.json). */
const treats = (node) => {
  const role = String(node.role ?? "");
  return TREATED_PREFIXES.some((prefix) => role.startsWith(prefix)) || TREATED_CELLS.has(node.data?.cellType)
    || (role === "table-row-band" && TREATED_BANDS.has(node.data?.rowStyle));
};
/** A table carries at least one treatment. */
export const tableTreated = (slide, instance) => tableNodes(slide, instance).some(treats);
/** Every counted table on the analytical pages, and how many carry a treatment: the one count behind BAR_TABLES_TREATED, CRAFT_TABLES_PLAIN and DECK_CRAFT. */
export function tableStatistics(scene) {
  let tables = 0, treated = 0;
  (scene?.slides || []).forEach((slide, index) => {
    if (!isAnalyticalPage(slide, index)) return;
    for (const table of countedTables(slide)) { tables += 1; if (tableTreated(slide, table)) treated += 1; }
  });
  return { tables, treated };
}
/** Every counted table on the page carries a treatment; null when the page has no counted table. */
export const pageTableTreated = (slide) => {
  const tables = countedTables(slide);
  return tables.length ? tables.every((table) => tableTreated(slide, table)) : null;
};
/** A page's chart carries an annotation or a recoloured mark; null when the page has no chart. */
export const pageChartAnnotated = (slide) => (componentsOf(slide).some((c) => c.startsWith("chart."))
  // A recoloured category draws no node of its own - the mark keeps its role
  // and carries `highlighted` - and it is the commonest mark there is.
  ? (slide.nodes || []).some((n) => n.data?.highlighted) || rolesOf(slide).some((r) => ANNOTATION.test(r)) : null);
/** A page carries a visual anchor a reader recognises: a picture with its file, a logo, an icon or a map. */
export const pageHasAnchor = (slide) => (slide.nodes || []).some((n) => {
  const role = String(n.role ?? "");
  if (role === "image-frame" || /placeholder/.test(role)) return false;
  return (n.type === "image" && (n.path || n.src || n.data?.path)) || /(^|-)(logo|icon|photo|image|picture)(-|$)/.test(role) || /^map-(land|marker)/.test(role);
});

/** Descriptive diagnostics for analysis; not editorial targets or reference proof. */
export function designStatistics(scene) {
  // The analytical pages the gates and the census count (weight.json analyticalPage).
  const content = scene.slides.filter(isAnalyticalPage);
  const kinds = new Set();
  let charts = 0, annotated = 0, marks = 0, unsourced = 0;
  const { tables, treated } = tableStatistics(scene);
  for (const slide of content) {
    for (const c of componentsOf(slide)) if (!["chrome", "slide-chrome", "section", "page-template"].includes(c)) kinds.add(c);
    // "Drawings": every primitive that is not type. A well-made
    // analytical page carries 32 (p25 11, p75 88); a page of rules and text
    // carries very few, which is the difference a reader feels first.
    marks += slide.nodes.filter((n) => n.type !== "text").length;
    // An empty picture frame: a photograph written as `alt` with no `path`. It
    // is how a page gets laid out before its pictures are cleared, and it is
    // not how a deck is delivered - so it is counted, not assumed away.
    unsourced += slide.nodes.filter((n) => String(n.role ?? "") === "image-frame").length;
    const chart = pageChartAnnotated(slide);
    if (chart !== null) { charts += 1; if (chart) annotated += 1; }
  }
  const round = (n) => Math.round(n * 100) / 100;
  return {
    contentPages: content.length,
    exhibitVarietyPerTen: content.length ? round((kinds.size / content.length) * 10) : 0,
    distinctExhibits: kinds.size,
    unsourcedPictures: unsourced,
    tables, tablesTreated: tables ? round(treated / tables) : null,
    charts, chartsAnnotated: charts ? round(annotated / charts) : null,
    drawingsPerPage: content.length ? round(marks / content.length) : 0,
    reference: { exhibitVarietyPerTen: "7.1 to 8.3", tablesTreated: 0.89, chartsAnnotated: 0.63, drawingsPerPage: 32 },
  };
}

/**
 * The bars measured on a built scene: the statistics, one finding per bar
 * missed ({ code, measure, measured, floor | ceiling, reference }) and whether
 * the deck clears them all. A deck with no tables cannot fail a bar about
 * tables, and a deck shorter than BARS_FROM analytical pages is held to the
 * ceilings only. So is a catalogue (the spec's `purpose: "catalogue"`): it
 * shows each component in its plain form so it can be copied and makes no
 * argument, and the floors are rates of a deck that does - as the craft floor
 * and the variety contract read it (craft_gates.mjs, variety_gates.mjs).
 */
export function scoreBuild(scene, { purpose = null } = {}) {
  const statistics = designStatistics(scene);
  const findings = [];
  if (statistics.contentPages >= BARS_FROM && purpose !== "catalogue") for (const [key, bar] of Object.entries(BUILD_BARS)) {
    const measured = statistics[key];
    if (measured === null || measured === undefined) continue;
    if (measured < bar.min) findings.push({ code: bar.code, measure: key, measured, floor: bar.min, reference: bar.reference });
  }
  for (const [key, bar] of Object.entries(BUILD_CEILINGS)) {
    const measured = statistics[key];
    if (measured > bar.max) findings.push({ code: bar.code, measure: key, measured, ceiling: bar.max });
  }
  return { statistics, findings, accepted: findings.length === 0 };
}

const WAIVER_KEYS = ["code", "reason"];
/** A deck's waivers, checked: each names a bar by its code and says why the deck is right to miss it. */
export function waiverErrors(waivers) {
  if (waivers === undefined || waivers === null) return [];
  if (!Array.isArray(waivers)) return ["waivers must be a list of { code, reason }"];
  const errors = [];
  const seen = new Set();
  for (const [i, w] of waivers.entries()) {
    const at = `waivers[${i}]`;
    if (!w || typeof w !== "object") { errors.push(`${at} must be { code, reason }`); continue; }
    const extra = Object.keys(w).filter((k) => !WAIVER_KEYS.includes(k));
    if (extra.length) errors.push(`${at} takes code and reason only (got ${extra.join(", ")})`);
    if (!BUILD_BAR_CODES[w.code]) errors.push(`${at}: code must name a build bar - one of ${Object.keys(BUILD_BAR_CODES).join(", ")}`);
    else if (seen.has(w.code)) errors.push(`${at}: ${w.code} is waived twice`);
    seen.add(w.code);
    if (typeof w.reason !== "string" || textWords(w.reason) < 6) errors.push(`${at}: say in a sentence why this deck is right to miss the bar; the reviewer confirms or refuses it`);
  }
  return errors;
}

/**
 * The bars against a deck's waivers: every miss, the misses a waiver covers
 * (each shown to the reviewer, whose confirmation delivery requires) and the
 * misses nothing covers, which block delivery. `purpose` is the spec's: a
 * catalogue is held to the ceilings only, here as in scoreBuild.
 */
export function barOutcome(scene, waivers = [], { purpose = null } = {}) {
  const { statistics, findings } = scoreBuild(scene, { purpose });
  const byCode = new Map((waivers || []).map((w) => [w.code, w]));
  const waived = findings.filter((f) => byCode.has(f.code)).map((f) => ({ ...f, reason: byCode.get(f.code).reason }));
  return { statistics, misses: findings, waived, unwaived: findings.filter((f) => !byCode.has(f.code)) };
}

/**
 * The deterministic measure behind a deck finding's code, when it has one:
 * whether, on the rebuilt scene, the defect the code names is gone from the
 * pages the finding still names (and, for a deck-wide measure, from the deck).
 * A partly fixed deck finding may drop in severity only when its measure passes.
 */
const bySlide = (scene, pages) => {
  const wanted = new Set(pages || []);
  return scene.slides.filter((s) => wanted.has(s.id));
};
const deckBar = (key) => (statistics) => statistics[key] === null || statistics[key] >= BUILD_BARS[key].min;
const everyPage = (test) => (slides) => slides.every((s) => test(s) !== false);
export const DOWNGRADE_MEASURES = Object.freeze({
  TABLE_MONOTONY: { measure: "tables treated and exhibit variety at their bars", deck: (s) => deckBar("tablesTreated")(s) && deckBar("exhibitVarietyPerTen")(s), pages: everyPage(pageTableTreated) },
  FLAT_TABLE: { measure: "every named table carries a treatment", deck: deckBar("tablesTreated"), pages: everyPage(pageTableTreated) },
  NARROW_REPERTOIRE: { measure: "exhibit variety at its bar", deck: deckBar("exhibitVarietyPerTen") },
  DEVICE_OVERUSE: { measure: "exhibit variety at its bar", deck: deckBar("exhibitVarietyPerTen") },
  LAYOUT_MONOTONY: { measure: "exhibit variety at its bar", deck: deckBar("exhibitVarietyPerTen") },
  UNANNOTATED_PLOT: { measure: "every named chart annotated, charts annotated at its bar", deck: deckBar("chartsAnnotated"), pages: everyPage(pageChartAnnotated) },
  NO_VISUAL_ANCHOR: { measure: "a picture, logo, icon or map on every named page", pages: everyPage(pageHasAnchor) },
  MISSING_CONTEXT: { measure: "a logo or picture on every named page", pages: everyPage(pageHasAnchor) },
});

/** Whether a finding's measured check passes on `scene` for `pages`; false when its code has no measure. */
export function measurePasses(code, scene, pages) {
  const m = DOWNGRADE_MEASURES[code];
  if (!m || !scene?.slides) return false;
  const statistics = m.deck ? designStatistics(scene) : null;
  const slides = bySlide(scene, pages);
  return (!m.deck || m.deck(statistics)) && (!m.pages || (slides.length > 0 && m.pages(slides)));
}
