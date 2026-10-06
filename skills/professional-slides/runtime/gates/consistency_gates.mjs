// What the deck's pages say between them, checked as data.
//
// Every other check reads one page against its own evidence. A reader reads
// the deck: a count that is 171 on one page and 158 on the next, a series
// plotted twice running, a number a revision changed on the page it was asked
// to change and left standing on three others. A review of a rendered deck
// found each of these by reading; the runtime holds the numbers, so it can
// find them first.
//
// The deck-wide table of stated numbers is built from what each page states
// and what it states it of:
//
//   by measure   every number the runtime wrote - a bound exhibit's values, a
//                bound figure, a `{{...}}` token - is a value of one measure at
//                one period or member (bind.mjs `bound.stated`); a typed
//                number is one too where it states exactly one such value of
//                the measures its page rests on, or is a whole number written
//                with the unit of the one value it equals ("158 clinics")
//   by name      every number an exhibit sets under a series or row name and
//                against a category or column label, typed or bound - the
//                weakest sound key, and the only one a deck with no insight
//                log has: the same pair of names on two pages is taken to be
//                the same thing
//
// With numbers bound to measures two pages cannot state different values of
// one measure at one label - the runtime writes both, and a typed chart is
// held to its measure value by value (dependency_gates.mjs BASIS_VALUES). What
// is left, and what is reported:
//
//   NUMBERS_DISAGREE (blocks)    two pages each print one of two records the
//                                log's own conflict check calls one measure
//                                (measures.mjs measureConflicts); or a typed
//                                table gives a number under the series and
//                                label another page's exhibit of the same
//                                measure gives another number under
//   NUMBERS_DISAGREE (advisory)  two pages print what reads as one quantity
//                                from two measures the log keeps apart - an
//                                entity's own record and its row in a peer set
//                                (measures.mjs measureNeighbours) - and neither
//                                page prints both; or, with no measures named,
//                                two exhibits give different numbers under the
//                                same pair of names
//   NUMBER_FORMATS_DIFFER        one value printed at different precision or
//                                scale on different pages
//   NUMBER_STALE                 a revision: a number changed on one page and
//                                still standing in its old form on another.
//                                Two kinds of change feed it. A text edit on a
//                                carried slide (`replace`, a new `title`) names
//                                the old words and the new: a figure the edit
//                                dropped ("£12.4m") still printed on another
//                                slide blocks, its bare number there advises,
//                                and an edit marked `only` is this slide's
//                                alone. A page composed where a slide stood is
//                                read against that slide: the page shows what
//                                the number was changed to and another page
//                                still states the old value of the same thing,
//                                under the same names or in the same words
//                                (blocks); the old value still standing in
//                                words that are only alike, with no replacement
//                                shown, or in its digits alone (advisory)
//   PROOF_REPEATS                a page that plots, as proof, a measure over the
//                                same periods or members as the page before
//                                plots it, or shows nothing an earlier page
//                                does not: the same line on the same frame
//                                (blocks where both claim the same measures and
//                                show exactly the same views)
//   WORDING_STALE                a revision: words changed on one page that
//                                another still carries. The old words of a
//                                `replace` that drops no figure, and a title of
//                                four words or more - rewritten on a carried
//                                slide or on the page composed in its place -
//                                still printed whole on another page block; a
//                                shorter title, and a name replaced inside a
//                                sentence a composed page otherwise kept,
//                                advise
//
// On a revision a point change is judged on what it changes: a disagreement
// is reported only where one of its pages is a page the revision changed, and
// what the untouched pages say between them is one advisory about the deck
// that was imported. A slide the revision carries from its source deck
// (`carry: true`, revision.mjs) is never compiled: what it states is the
// inventory's record of it, as the revision's text edits leave it.
//
// The limits of the name key, said once: it reads names, so two exhibits that
// call different things by one series name and one label ("Revenue", "FY26",
// for two companies) are set against each other - which is why a disagreement
// under it advises unless both exhibits name the same measure, and a stale
// value blocks under it only where the other page holds the very number the
// revision replaced - and one thing under two spellings ("FY26", "2025-26") is
// not seen at all. A number in a sentence is matched by the words it is said
// of (sameLabel), which is narrower still.
import { bindDeck, withoutTokens } from "../bind.mjs";
import { cellText, isTable, rowCells } from "../evidence.mjs";
import { measureConflicts, measureNeighbours, measureRegistry, normalUnit, valuesAgree } from "../measures.mjs";
import { measurementsIn, percentUnit, printedNumbers, unitScale } from "../printed-numbers.mjs";
import { recordedMeasures, storyStructure } from "../storyline.mjs";
import { registered } from "../errors.mjs";
import { readJsonSync } from "../cli.mjs";
import { carriedStated, printsWords } from "../revision.mjs";
import { pagePool, pageTexts, refsOf, statedCells, typedNumbers } from "./dependency_gates.mjs";

export const CONSISTENCY_CODES = Object.freeze({
  NUMBERS_DISAGREE: "two pages state different values for one measure at one period or member; as an advisory, for what reads as one quantity under two measures, or under one pair of names in two exhibits",
  NUMBER_STALE: "a number a revision changed on one page - by a text edit on a carried slide or on a page composed in its place - that another page still prints in its old form",
  NUMBER_FORMATS_DIFFER: "one value printed at different precision or scale on different pages",
  WORDING_STALE: "words a revision changed on one page - a title, a name, the old words of a `replace` - that another page still carries in their old form",
  PROOF_REPEATS: "a page that plots, as proof, a measure over the same periods or members as another page plots it; it blocks where the two claim the same measures and show exactly the same views",
});

const REVISION = "existing_deck_revision";
// How many cells, keys or pages one finding lists before it counts the rest.
const LISTED = 8;
const listed = (items, join = "; ") => `${items.slice(0, LISTED).join(join)}${items.length > LISTED ? `${join}and ${items.length - LISTED} more` : ""}`;
const nameOf = (text) => String(text ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const cellOf = (ref, label) => `${ref}${label === null || label === undefined ? "" : `@${label}`}`;
const exhibitsOf = (page) => [page?.exhibit, ...(Array.isArray(page?.exhibits) ? page.exhibits : []), ...(Array.isArray(page?.blocks) ? page.blocks.map((block) => block?.exhibit) : [])].filter((ex) => ex && typeof ex === "object");
const idOf = (page, index) => String(page?.id ?? `page-${index + 1}`);

// A unit a count is written with in a sentence: a plain word ("clinics", "branches"), not a scale, a currency or a percentage.
const wordUnit = (unit) => { const normal = normalUnit(unit); return /^\p{L}{3,}(?: \p{L}{3,})?$/u.test(normal) && !percentUnit(unit) ? normal : null; };
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The measures whose unit is a plain word a count is written with, by that
 * unit, with the one pattern that finds "<whole number> <unit>" for any of
 * them in a text; null where there is none.
 */
function countedUnits(pool) {
  const byUnit = new Map();
  for (const m of pool) { const unit = m.ref && wordUnit(m.unit); if (unit) byUnit.set(unit, [...(byUnit.get(unit) ?? []), m]); }
  // The longest unit first, so "clinic rooms" is not read as "clinic".
  const units = [...byUnit.keys()].sort((a, b) => b.length - a.length);
  return units.length ? { byUnit, pattern: new RegExp(`(?<![\\p{L}\\p{N}.,])(\\d{1,3}(?:,\\d{3})+|\\d+)\\s+(${units.map(escaped).join("|")})(?![\\p{L}\\p{N}])`, "giu") } : null;
}

/**
 * The whole numbers a page's text writes with a unit, each traced to the one
 * value it equals among `units` (countedUnits of the measures the page rests
 * on, or of the whole log): "about 158 clinics" states the measure in
 * clinics whose value is 158, where there is exactly one. A bare whole
 * number in a sentence is otherwise a count or a name as often as a
 * measurement, and is left alone (printed-numbers.mjs).
 */
function countedNumbers(texts, units) {
  const out = [];
  if (units) for (const { field, text } of texts) {
    if (!/\d/.test(text)) continue;
    for (const hit of text.matchAll(units.pattern)) {
      const number = { n: Number(hit[1].replace(/,/g, "")), decimals: 0, sign: 0, scale: null, scaled: false, percent: false, currency: false, shown: hit[0] };
      const cells = statedCells(number, units.byUnit.get(normalUnit(hit[2])) ?? []).filter((cell) => Number.isInteger(cell.value));
      if (new Set(cells.map((cell) => cellOf(cell.ref, cell.label))).size === 1) out.push({ field, number, cell: cells[0] });
    }
  }
  return out;
}

/** One number a table cell holds as a figure: `{ value, shown, percent }`, or null where it holds none, several, or a number with words. */
function cellFigure(cell) {
  if (typeof cell === "number") return Number.isFinite(cell) ? { value: cell, shown: String(cell), percent: false } : null;
  if (cell && typeof cell === "object" && typeof cell.value === "number" && Number.isFinite(cell.value)) return { value: cell.value, shown: String(cell.value), percent: false };
  const text = cell && typeof cell === "object" ? cellText(cell) : String(cell ?? "");
  const numbers = measurementsIn(withoutTokens(text), true, text);
  if (numbers.length !== 1 || numbers[0].scaled) return null;
  return { value: numbers[0].sign < 0 ? -numbers[0].n : numbers[0].n, shown: numbers[0].shown, percent: numbers[0].percent };
}

const headerOf = (column) => (column && typeof column === "object" ? column.label ?? column.text ?? "" : column ?? "");
/** A table's cells under their names: `[{ name, label, cell, unit }]`, the row's label, the column's header, the cell as written and the column's unit where it gives one. */
function tableCells(ex) {
  if (!(Array.isArray(ex.rows) && Array.isArray(ex.columns) && (isTable(ex) || ex.rows.every((row) => rowCells(row).length)))) return [];
  return ex.rows.flatMap((row) => { const cells = Array.isArray(row) || row?.label === undefined ? rowCells(row) : [row.label, ...rowCells(row)];
    return cells.slice(1).map((cell, at) => ({ name: cellText(cells[0]), label: String(headerOf(ex.columns[at + 1])), cell, unit: ex.columns[at + 1] && typeof ex.columns[at + 1] === "object" ? ex.columns[at + 1].unit ?? null : null })); });
}
/** A chart's plotted values under their names: `[{ name, label, value, unit }]`, the series' name (the heading's for one unnamed series) and the category. */
function chartCells(ex) {
  const out = [];
  const plotted = (categories, series, unit, heading) => { for (const s of series) (s?.values || []).forEach((value, at) => { if (typeof value === "number" && Number.isFinite(value) && categories[at] !== undefined) out.push({ name: String(s.name ?? heading ?? ""), label: String(categories[at]), value, unit: s.unit ?? unit ?? null }); }); };
  const categories = Array.isArray(ex.categories) ? ex.categories : Array.isArray(ex.labels) ? ex.labels : null;
  if (categories && Array.isArray(ex.series)) plotted(categories, ex.series, ex.unit, ex.heading);
  else if (categories && Array.isArray(ex.values)) plotted(categories, [{ name: ex.heading, values: ex.values }], ex.unit, ex.heading);
  // Aligned bars are one chart a measure over one list of members.
  if (ex.type === "chart-group" && Array.isArray(ex.charts)) for (const chart of ex.charts) { const props = chart?.props ?? {};
    if (Array.isArray(props.categories)) plotted(props.categories, Array.isArray(props.series) ? props.series.map((item) => ({ ...item, name: chart.heading ?? item?.name })) : [{ name: chart.heading, values: props.values }], props.unit, chart.heading); }
  return out;
}

/**
 * Every number an exhibit sets under a pair of names: a chart's series name
 * and category, a table's row label and column header. `{ name, label, value,
 * shown, unit, refs }`, `refs` the measures the exhibit says it shows (its
 * `basis`, written by the runtime for a bound one). A chart of one unnamed
 * series is named by its heading.
 */
function keyedOf(ex) {
  const refs = refsOf(ex.basis);
  const keyed = (name, label, figure, unit) => (nameOf(name) && nameOf(label) && figure ? [{ name: String(name), label: String(label), value: figure.value, shown: figure.shown, unit: unit ?? (figure.percent ? "%" : null), refs }] : []);
  return [...chartCells(ex).flatMap((cell) => keyed(cell.name, cell.label, { value: cell.value, shown: String(cell.value), percent: false }, cell.unit)),
    ...tableCells(ex).flatMap((cell) => keyed(cell.name, cell.label, cellFigure(cell.cell), cell.unit))];
}

/** A slide of a revision's inventory (runtime/import-deck.py) as the exhibits it held: each chart's series by category, each table's cells under its first row and beside its first column. */
const slideExhibits = (slide) => [
  ...(slide?.charts || []).map((chart) => ({ heading: chart?.title, categories: chart?.categories || [], series: (chart?.series || []).map((item) => ({ name: item?.name ?? chart?.title, values: item?.values || [] })) })),
  ...(slide?.tables || []).map((table) => { const [head = [], ...rows] = Array.isArray(table?.cells) ? table.cells : []; return { type: "table", columns: head, rows }; })];
/** The same reading of a slide in a revision's inventory as of a page's exhibits. */
const keyedOfSlide = (slide) => slideExhibits(slide).flatMap(keyedOf);
/** What a slide of the inventory says in words, as a page's texts are read. */
const slideTexts = (slide) => [slide?.title, slide?.subtitle, ...(slide?.paragraphs || []).map((p) => p?.text), ...(slide?.tables || []).flatMap((t) => (t?.cells || []).flat())].filter((text) => typeof text === "string" && text.trim()).map((text) => ({ field: "the imported slide", text }));

/** A slide's speaker notes, as a text of its own. */
const notesOf = (slide) => (typeof slide?.notes === "string" && slide.notes.trim() ? [{ field: "the slide's notes", text: slide.notes }] : []);

const keyOf = (entry) => [nameOf(entry.name), nameOf(entry.label)].sort().join(" | ");
// Two units a pair of names can be compared under: the same one, or one of them not said.
const sameUnit = (a, b) => !a.unit || !b.unit || normalUnit(a.unit) === normalUnit(b.unit);
// Where a unit is not said the two may be one number at two scales - millions and billions, a ratio and its percentage - and are not set apart for that.
const SCALES = [1, 1e3, 1e6, 1e9, 100];
const agreeAt = (a, b) => (a.unit && b.unit ? [1] : SCALES).some((scale) => valuesAgree(a.value, b.value * scale) || valuesAgree(a.value * scale, b.value));
const apart = (a, b) => sameUnit(a, b) && !agreeAt(a, b);

// --- a number where it stands: what a revision's stale copies are found by ---
// A label is the words a number is said of: what is measured, and when. Two numbers are said of one thing where every word of
// the shorter label is a word of the longer and the two share two or more - "Operating cash flow" in a table row and
// "operating cash flow fell to 66 million" in a caption; not "revenue grew 12%" and "costs grew 12%", which share a verb and a
// number and nothing they are about. A period ("FY26", "2025", "Q3") counts as one shared word, and where both labels name
// one they must name the same: a row at FY25 is not the sentence about FY26.
const SAME_LABEL_WORDS = 2;
// How many words either side of a number, within its clause, are read as its label.
const LABEL_WINDOW = 6;
const STOPWORDS = new Set(readJsonSync(new URL("./stopwords.json", import.meta.url)).content);
const PERIOD_WORD = /^(?:fy)?\d{2,4}$|^[qh][1-4]$/;
// A label's words: content words with a plural's "s" taken off, and period names.
const labelWords = (text) => String(text ?? "").normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => PERIOD_WORD.test(word) || (/^\p{L}{3,}$/u.test(word) && !STOPWORDS.has(word)))
  .map((word) => (/^\p{L}{5,}s$/u.test(word) && !word.endsWith("ss") ? word.slice(0, -1) : word));
// A clause ends where the sentence turns to something else.
const CLAUSE = /\.(?!\d)|[;!?()]|:(?!\d)|,\s|\s[\u2013\u2014-]\s|\b(?:while|whereas|but|against|versus|vs)\b/giu;
const termsOf = (words) => [...words].filter((word) => !PERIOD_WORD.test(word)), periodsOf = (words) => [...words].filter((word) => PERIOD_WORD.test(word));
function sameLabel(a, b) {
  const [few, many] = termsOf(a.words).length <= termsOf(b.words).length ? [a.words, b.words] : [b.words, a.words];
  const [when, then] = [periodsOf(a.words), periodsOf(b.words)], dated = when.length > 0 && then.length > 0;
  if (dated && !(when.length <= then.length ? when.every((word) => then.includes(word)) : then.every((word) => when.includes(word)))) return false;
  return termsOf(few).length + (dated ? 1 : 0) >= SAME_LABEL_WORDS && termsOf(few).length > 0 && termsOf(few).every((word) => many.has(word));
}
// The unit a column's header states beside its name - "Revenue (£m)", "Share, %" - where it is one a number's kind can be read
// from: a currency, a scale word or a percent sign. "Length (m)" is metres, and says nothing of scale.
const STATED_UNIT = /[$£€¥%]|\b(?:thousands?|millions?|billions?|trillions?|mn|bn)\b|\b[A-Z]{3}\s?(?:k|m|mn|bn)\b/;
const headerUnit = (label) => { const tail = /\(([^()]+)\)\s*$/.exec(String(label ?? ""))?.[1] ?? /,\s*([^,]+)$/.exec(String(label ?? ""))?.[1] ?? null; return tail && STATED_UNIT.test(tail) ? tail.trim() : null; };
// What kind of number it is, as far as it says: a percentage or not, and its scale - each null where neither the number nor a unit beside it says.
const kindOf = (number, unit) => ({ percent: number.percent ? true : unit ? percentUnit(unit) : number.scaled || number.currency ? false : null, scale: number.scale ?? (unit && !percentUnit(unit) ? unitScale(unit) : null) });
const sameKind = (a, b) => (a.percent === null || b.percent === null || a.percent === b.percent) && (a.scale === null || b.scale === null || a.scale === b.scale);

/**
 * Every number a page or a slide states, with the words it is said of:
 * `[{ n, shown, marked, percent, scale, words, said }]`. `texts` are its
 * pieces of text (`{ text }`: a number is said of the words around it in its
 * clause, and a whole number in a sentence only of the word after it too -
 * "158 clinics"); `exhibits` its charts and tables (a number is said of its
 * series or row and its category or column). `marked` is a number written as
 * a measurement (printed-numbers.mjs), which alone is matched on its digits.
 */
function occurrences(texts, exhibits) {
  const out = [];
  for (const { text } of texts) {
    let from = 0;
    for (const clause of [...String(text).split(CLAUSE)]) {
      const at = String(text).indexOf(clause, from); from = at + clause.length;
      for (const number of printedNumbers(clause).filter((item) => item.kind !== "period")) {
        const [before, after] = (() => { const cut = clause.indexOf(number.shown); return cut < 0 ? [clause, ""] : [clause.slice(0, cut), clause.slice(cut + number.shown.length)]; })();
        const words = new Set([...labelWords(before).slice(-LABEL_WINDOW), ...labelWords(after).slice(0, LABEL_WINDOW)]);
        // A bare whole number in a sentence is a count of the thing named after it, and is read only with that word.
        const counted = number.kind === "integer" ? labelWords(after.trim().split(/\s+/)[0] ?? "")[0] ?? null : null;
        if (number.kind === "integer" && String(text).trim() !== number.shown && !counted) continue;
        out.push({ n: number.n, shown: number.shown, marked: number.kind === "measure", ...kindOf(number, null), words, counted, said: `"${clause.trim().slice(0, 90)}"` });
      }
    }
  }
  for (const ex of exhibits) {
    for (const cell of chartCells(ex)) out.push({ n: Math.abs(cell.value), shown: String(cell.value), marked: false, ...kindOf({}, cell.unit), words: new Set(labelWords(`${cell.name} ${cell.label}`)), counted: null, said: `"${cell.name}" at "${cell.label}"` });
    for (const cell of tableCells(ex)) { const text = cell.cell && typeof cell.cell === "object" ? cellText(cell.cell) : String(cell.cell ?? ""), numbers = printedNumbers(text).filter((item) => item.kind !== "period");
      if (numbers.length === 1) out.push({ n: numbers[0].n, shown: numbers[0].shown, marked: numbers[0].kind === "measure", ...kindOf(numbers[0], cell.unit ?? headerUnit(cell.label)), words: new Set(labelWords(`${cell.name} ${cell.label}`)), counted: null, said: `"${cell.name}" under "${cell.label}"` }); }
  }
  return out;
}
// A count in a sentence is the same count elsewhere only where it counts the same thing.
const sameCount = (a, b) => (!a.counted || b.words.has(a.counted)) && (!b.counted || a.words.has(b.counted));
const sameThing = (a, b) => sameKind(a, b) && sameLabel(a, b) && sameCount(a, b);
// Two sentences rarely put one label in the same words, so neither holds every word of the other: three words in common (a
// shared period is one) say they may be about one thing, which is enough to ask and not enough to refuse.
const NEAR_LABEL_WORDS = 3;
const nearThing = (a, b) => sameKind(a, b) && sameCount(a, b) && !(periodsOf(a.words).length && periodsOf(b.words).length && !periodsOf(a.words).some((word) => b.words.has(word)))
  && termsOf(a.words).filter((word) => b.words.has(word)).length + (periodsOf(a.words).some((word) => b.words.has(word)) ? 1 : 0) >= NEAR_LABEL_WORDS;

/**
 * What every page states, read once: `byMeasure` the numbers each page states
 * of a measure at a period or member, `byName` the numbers its exhibits set
 * under a pair of names, `prints` every number its text and exhibits print
 * (what a page that reconciles two figures prints both of), and `texts` its
 * words. A page whose references do not bind states nothing yet. On a
 * revision an imported slide not yet mapped to a page type is read from the
 * inventory.
 */
function statedOf(doc, insights, inventory, carried = new Map()) {
  const registry = measureRegistry(insights);
  const { doc: written, bound } = bindDeck(doc, insights);
  const authored = [...(doc.pages || []), ...(doc.appendix || [])];
  const slides = new Map((inventory?.slides || []).map((slide) => [slide.index, slide]));
  const pages = [];
  // The whole log, read once for every page: its measures, the units a count is written with, and what each printed number
  // states of it - the same number is printed on many pages, and is traced once.
  const all = [...registry.values()], everyUnit = countedUnits(all), read = new Map();
  const one = (cells) => (new Set(cells.map((cell) => cellOf(cell.ref, cell.label))).size === 1 ? cells[0] : null);
  const anywhere = (number) => { const key = `${number.n}|${number.decimals}|${number.sign}|${number.scale}|${number.percent}|${number.currency}`;
    if (!read.has(key)) read.set(key, one(statedCells(number, all)));
    return read.get(key); };
  [...(written.pages || []), ...(written.appendix || [])].forEach((page, index) => {
    if (!page || typeof page !== "object" || page.kind) return;
    const id = idOf(page, index), source = slides.get(page.sourceSlide) ?? null;
    if (!page.type) {
      // An imported slide the runtime does not compose - carried from the source deck, or still carrying its old copy: what it
      // says is the inventory's record of it, with the words a carried page's edits rewrote as they now stand.
      const shown = carried.get(id)?.slide ?? source;
      // Where a number stands is read in the speaker's notes too: they are part of what the deck says, and a figure changed on the slide and left in its notes is said twice.
      if (shown) pages.push({ id, source, mapped: false, byMeasure: [], byName: keyedOfSlide(shown), texts: slideTexts(shown), title: String(shown.title ?? ""), stands: occurrences([...slideTexts(shown), ...notesOf(shown)], slideExhibits(shown)) });
      return;
    }
    if (bound.failed.has(id)) return;
    const texts = pageTexts(authored[index]), pool = registry.size ? pagePool(page, registry) : [];
    // A typed number is a value of the measures its page rests on; one that is none of theirs is read against the whole log,
    // since a page can quote a record it does not name. Either way it is traced only where it states exactly one value.
    const traced = (number) => { const near = statedCells(number, pool); return near.length ? one(near) : anywhere(number); };
    const counted = all.length ? countedNumbers(texts, countedUnits(pool)) : [];
    const typed = !all.length ? [] : [...typedNumbers(authored[index]).map(({ field, number }) => ({ field, number, cell: traced(number) })).filter(({ cell }) => cell),
      ...(counted.length ? counted : countedNumbers(texts, everyUnit))];
    pages.push({ id, source, mapped: true, only: Array.isArray(authored[index]?.only) ? authored[index].only.map(String) : [],
      // A typed number's scale is read against its measure's, as a token's modifier is: "1.3bn" of a record kept in millions is the format "0.0bn | /1000".
      byMeasure: [...(bound.stated.get(page) ?? []), ...typed.map(({ field, number, cell }) => ({ ...cell, how: "typed", shown: number.shown, decimals: number.decimals,
        factor: number.scale && unitScale(registry.get(cell.ref)?.unit) ? unitScale(registry.get(cell.ref).unit) / number.scale : 1, field: `\`${field}\`` }))],
      byName: exhibitsOf(page).flatMap(keyedOf), texts, title: typeof page.title === "string" ? page.title : "",
      // Where each number stands is read only for a revision, which is the one reader of it.
      stands: inventory ? occurrences(texts, exhibitsOf(page)) : [] });
  });
  for (const page of pages) page.prints = [...page.texts.flatMap(({ text }) => printedNumbers(text).map((number) => number.n)), ...page.byMeasure.map((entry) => Math.abs(entry.value)), ...page.byName.map((entry) => Math.abs(entry.value))];
  return { pages, registry };
}

/** Does a page print `value`, at whatever precision: what a page that sets two figures side by side does of both. */
const printsValue = (page, value) => page.prints.some((n) => valuesAgree(n, Math.abs(value)));
const shownOf = (entry) => entry.shown ?? String(entry.value);

/**
 * The findings on what the deck's pages state between them (see the head of
 * this file). `doc` is the pages document as authored, `insights` the Map by
 * id author-deck reads (or null), `spec` the compiled deck where PROOF_REPEATS
 * is wanted, `inventory` a revision's inventory and `changed` the ids of the
 * pages it changed (review-passes.mjs revisionChanges; null for new work,
 * where every page is the author's). Blocking rules are returned as blockers:
 * the caller applies the deck's rules version.
 */
export function consistencyFindings(doc, insights = null, { spec = null, inventory = null, changed = null } = {}) {
  const revision = doc?.deck?.workflow === REVISION;
  const touched = revision && changed ? new Set([...changed].map(String)) : null;
  const involves = (...ids) => !touched || ids.some((id) => touched.has(String(id)));
  const carried = new Map((revision && inventory ? carriedStated(spec, inventory) : []).map((item) => [item.id, item]));
  const { pages, registry } = statedOf(doc, insights, revision ? inventory : null, carried);
  const out = [];
  const finding = (code, severity, ids, repair, measured) => out.push({ code: registered(CONSISTENCY_CODES, code), severity, pages: [...new Set(ids.map(String))], ...(measured === undefined ? {} : { measured }), repair });
  const items = [...(insights?.values?.() ?? [])];

  // --- by measure -----------------------------------------------------------
  const stating = new Map();
  for (const page of pages) for (const entry of page.byMeasure) { const key = cellOf(entry.ref, entry.label); stating.set(key, [...(stating.get(key) ?? []), { ...entry, page: page.id }]); }
  const pagesAt = (ref, label) => [...new Set((stating.get(cellOf(ref, label)) ?? []).map((entry) => entry.page))];
  const byId = new Map(pages.map((page) => [page.id, page]));
  // Where a record comes from, as the log says it: the measure's citation keys, or the source files behind it.
  const fromOf = (ref) => { const m = registry.get(ref), from = m?.cite?.length ? m.cite : m?.sources ?? []; return from.length ? `, from ${listed(from, ", ")}` : ""; };
  const sourcesOf = (refs) => refs.map((ref) => { const m = registry.get(ref); return m?.cite?.length ? m.cite : m?.sources ?? []; });
  // Two records the log's own conflict check calls one measure, each printed by a page.
  const conflicts = measureConflicts(items);
  const paired = new Set(conflicts.flatMap((c) => [`${c.refs[0]}|${c.refs[1]}`, `${c.refs[1]}|${c.refs[0]}`]));
  for (const conflict of conflicts.filter((c) => c.kind === "contradiction")) for (const cell of conflict.at) {
    const [a, b] = [pagesAt(conflict.refs[0], cell.labels[0]), pagesAt(conflict.refs[1], cell.labels[1])];
    const first = a.find((id) => b.some((other) => other !== id)), second = first === undefined ? undefined : b.find((id) => id !== first);
    if (first === undefined || !involves(...a, ...b)) continue;
    finding("NUMBERS_DISAGREE", "blocker", [...a, ...b],
      `${first} states ${cell.values[0]} (${cellOf(conflict.refs[0], cell.labels[0])}${fromOf(conflict.refs[0])}) and ${second} states ${cell.values[1]} (${cellOf(conflict.refs[1], cell.labels[1])}${fromOf(conflict.refs[1])}) for one measure: the insight log records it twice - one name, population and unit - with different numbers there, and each page prints one of them. Keep the number the source gives in one record and name that measure on ${listed([...new Set([...a, ...b])], ", ")}; where the two are different quantities, say so in the measure's \`population\` or its name`,
      { measures: conflict.refs, at: cell.label, values: cell.values, sources: sourcesOf(conflict.refs) });
  }
  // What reads as one quantity under two measures the log keeps apart, printed on two pages neither of which prints both.
  for (const { kind, cells: [x, y], shared } of measureNeighbours(items)) {
    // Two records the conflict check already pairs are reported by it, above.
    if (paired.has(`${x.ref}|${y.ref}`)) continue;
    const [a, b] = [pagesAt(x.ref, x.label), pagesAt(y.ref, y.label)];
    const lone = (ids, other) => ids.filter((id) => !printsValue(byId.get(id), other));
    const [onlyA, onlyB] = [lone(a, y.value), lone(b, x.value)];
    if (!onlyA.length || !onlyB.length || !involves(...onlyA, ...onlyB)) continue;
    const both = pages.filter((page) => printsValue(page, x.value) && printsValue(page, y.value)).map((page) => page.id);
    const said = (cell) => `${cell.value} (${cellOf(cell.ref, cell.label)}${cell.period ? `, ${cell.period}` : ""}${fromOf(cell.ref)})`;
    const why = kind === "twin" ? `one measure recorded twice: the same unit, and the same number at ${shared.agree} of the ${shared.labels} ${shared.kind} the two share`
      : `one quantity for ${y.label}: the same unit, and the one is named for what the other measures`;
    finding("NUMBERS_DISAGREE", "advisory", [...onlyA, ...onlyB],
      `${listed(onlyA, ", ")} state${onlyA.length === 1 ? "s" : ""} ${said(x)} and ${listed(onlyB, ", ")} state${onlyB.length === 1 ? "s" : ""} ${said(y)}: the log keeps these as two measures, and they read as ${why}. ` +
      `A reader meets two numbers for one thing, and no page of these prints both${both.length ? ` (${listed(both, ", ")} do${both.length === 1 ? "es" : ""})` : ""}. Use one of them on every page; or, where they are two dates or two definitions, say which beside each number, or set both in one note the other pages repeat`,
      { kind, cells: [cellOf(x.ref, x.label), cellOf(y.ref, y.label)], values: [x.value, y.value], sources: sourcesOf([x.ref, y.ref]) });
  }
  // One value printed at two precisions on two pages (a chart's own labels are the layout's, and are not read). It is read
  // value by value, not measure by measure: a printed number keeps two significant figures (printed-numbers.mjs), so the
  // small values of a measure take decimal places its large ones do not, and one format for the whole measure is not the rule.
  // A table's cells are not read either: a detailed table prints 5.84% where the pages that argue from it say 5.8%, and a
  // reader looks a number up there at the precision it was recorded to.
  const inTable = (entry) => /`[^`]*\b(?:rows|cells)[[.]/.test(String(entry.field ?? ""));
  const formats = [];
  for (const [key, entries] of stating) {
    const printed = entries.filter((entry) => entry.how !== "exhibit" && entry.decimals !== undefined && !inTable(entry));
    const forms = new Map();
    for (const entry of printed) { const form = `${entry.decimals}|${Math.round(Math.log10(entry.factor ?? 1))}`; forms.set(form, [...(forms.get(form) ?? []), entry]); }
    const apartPages = [...forms.values()].map((group) => new Set(group.map((entry) => entry.page)));
    // Two formats on two pages: a page that prints the value both ways itself - rounded in its title, exact in its table - has said they are one number.
    if (forms.size < 2 || !apartPages.some((a, i) => apartPages.some((b, j) => i !== j && [...a].some((id) => !b.has(id)) && [...b].some((id) => !a.has(id)))) || !involves(...printed.map((entry) => entry.page))) continue;
    formats.push({ key, pages: printed.map((entry) => entry.page), text: `${key} is ${[...forms.values()].map((group) => `"${shownOf(group[0])}" on ${listed([...new Set(group.map((entry) => entry.page))], ", ")}`).join(" and ")}` });
  }
  // Two records of one measure kept at different precision, each printed by a page, are the same finding.
  for (const conflict of conflicts.filter((c) => c.kind === "precision")) for (const cell of conflict.at) {
    const [a, b] = [pagesAt(conflict.refs[0], cell.labels[0]), pagesAt(conflict.refs[1], cell.labels[1])];
    if (a.length && b.length && new Set([...a, ...b]).size > 1 && involves(...a, ...b)) formats.push({ key: cellOf(conflict.refs[0], cell.labels[0]), pages: [...a, ...b], text: `${cell.values[0]} (${cellOf(conflict.refs[0], cell.labels[0])}) on ${a[0]} and ${cell.values[1]} (${cellOf(conflict.refs[1], cell.labels[1])}) on ${b[0]} are one number recorded at two precisions` });
  }
  if (formats.length) finding("NUMBER_FORMATS_DIFFER", "blocker", formats.flatMap((f) => f.pages),
    `${formats.length} value${formats.length === 1 ? " is" : "s are"} rounded differently on different pages: ${listed(formats.map((f) => f.text))}. A reader who meets 53 on one page and 53.2 on another checks whether they are one number. Print each value in one format on every page - the same decimal places and scale in its token, figure or typed number - or say on the page that rounds that it does`,
    formats.slice(0, LISTED).map((f) => f.key));

  // --- by name --------------------------------------------------------------
  const named = new Map();
  for (const page of pages) for (const entry of page.byName) named.set(keyOf(entry), [...(named.get(keyOf(entry)) ?? []), { ...entry, page: page.id, mapped: page.mapped }]);
  const sameMeasure = (a, b) => a.refs.some((ref) => b.refs.includes(ref));
  // Two exhibits each showing one of two records the conflict check pairs: reported by it, above.
  const pairedRecords = (a, b) => a.refs.some((ref) => b.refs.some((other) => paired.has(`${ref}|${other}`)));
  const loose = [], imported = [];
  for (const entries of named.values()) {
    const pair = entries.flatMap((a, i) => entries.slice(i + 1).filter((b) => b.page !== a.page && apart(a, b)).map((b) => [a, b]))[0];
    if (!pair) continue;
    const [a, b] = pair, said = `${a.page} gives ${shownOf(a)} and ${b.page} gives ${shownOf(b)} for "${a.name}" at "${a.label}"`;
    if (!involves(a.page, b.page)) { imported.push({ pages: [a.page, b.page], text: said }); continue; }
    if (sameMeasure(a, b)) finding("NUMBERS_DISAGREE", "blocker", [a.page, b.page],
      `${said}, and both exhibits say they show ${listed(a.refs.filter((ref) => b.refs.includes(ref)), ", ")}: one of the two numbers is not the measure's. Write the typed one by reference - \`{{<insight id>/<measure>@<period or member> | 0.0}}\` in the cell, or \`series: [{ measure }]\` - so the runtime prints the recorded value on both pages`,
      { name: a.name, label: a.label, values: [a.value, b.value] });
    // Exhibits that name different measures under one pair of names show different things, and say so.
    else if (!pairedRecords(a, b) && (!a.refs.length || !b.refs.length)) loose.push({ pages: [a.page, b.page], text: said });
  }
  if (loose.length) finding("NUMBERS_DISAGREE", "advisory", loose.flatMap((item) => item.pages),
    `${loose.length} number${loose.length === 1 ? " is" : "s are"} given two values under one series or row name and one label: ${listed(loose.map((item) => item.text))}. The names are all that says these are one thing, so check each: where they are, print one value on both pages; where they are not - two populations, two definitions, two dates - name the series or the label apart so a reader does not set them side by side`,
    loose.slice(0, LISTED).map((item) => item.text));

  // --- a revision: what it changed, and where the old value still stands ----
  if (revision && inventory) {
    // One stale figure is one finding: what a text edit already found standing on a page is not reported again of a page composed beside it.
    const stale = new Set();
    out.push(...staleEdits([...carried.values()], spec, stale));
    for (const page of pages.filter((p) => p.mapped && p.source)) {
      const before = new Map(keyedOfSlide(page.source).map((entry) => [keyOf(entry), entry]));
      for (const now of page.byName) {
        const was = before.get(keyOf(now));
        if (!was || !apart(was, now)) continue;
        const still = pages.filter((other) => other.id !== page.id).flatMap((other) => other.byName.filter((entry) => keyOf(entry) === keyOf(now) && sameUnit(entry, now) && valuesAgree(entry.value, was.value) && apart(entry, now)).map((entry) => ({ ...entry, page: other.id })))
          .filter((entry) => !stale.has(`${entry.page}|${Math.abs(was.value)}`));
        if (!still.length) continue;
        for (const entry of still) stale.add(`${entry.page}|${Math.abs(was.value)}`);
        finding("NUMBER_STALE", "blocker", [page.id, ...still.map((entry) => entry.page)],
          `This revision changed "${now.name}" at "${now.label}" on ${page.id} from ${shownOf(was)} to ${shownOf(now)}, and ${listed([...new Set(still.map((entry) => entry.page))], ", ")} still print${new Set(still.map((entry) => entry.page)).size === 1 ? "s" : ""} ${shownOf(still[0])} under the same names: the deck now gives one thing two values. Change it there too - the new value on a composed page; on a carried slide \`replace\` for a table's cell, and a \`type\` in place of \`carry\` for a chart's values - or, where the other page states a different thing, name its series or label apart`,
          { name: now.name, label: now.label, was: was.value, now: now.value });
      }
      // What the slide stated and the page changed: a number under whose label the page now states another (the page shows
      // what it was changed to), or one the page no longer prints anywhere. Another page that still states the old number under
      // the same label blocks where the page shows what it was changed to. Everything less is asked, not refused: the same
      // label with no replacement shown, a sentence that shares words with the changed one, or the same digits alone.
      const kept = new Set(page.prints), was = occurrences(slideTexts(page.source), slideExhibits(page.source));
      const stands = (old) => page.stands.some((now) => valuesAgree(now.n, old.n) && sameThing(old, now));
      // What it was changed to is the number that now stands under the nearest label: the one that shares the period and the
      // most words, and is the same kind of number - a level is not replaced by the percentage it moved.
      const nearness = (old, now) => termsOf(now.words).filter((word) => old.words.has(word)).length + (periodsOf(now.words).some((word) => old.words.has(word)) ? SAME_LABEL_WORDS : 0);
      const changedTo = (old) => (stands(old) ? null : page.stands.filter((now) => sameThing(old, now) && (old.percent === true) === (now.percent === true) && !valuesAgree(old.n, now.n))
        .reduce((best, now) => (!best || nearness(old, now) > nearness(old, best) ? now : best), null));
      const digits = (old, other) => (old.marked ? other.stands.find((there) => there.marked && there.n === old.n && sameKind(old, there)) ?? null : null);
      // The same quantity in whatever notation: the value, with a kind both say - a percentage, or one stated scale ("12.4" under
      // "Revenue (£m)" is "£12.4m", "£12.4 million" and "GBP 12.40m").
      const quantity = (old, other) => (old.percent !== null && (old.percent || old.scale !== null) ? other.stands.find((there) => there.n === old.n && there.percent === old.percent && (old.percent || there.scale === old.scale)) ?? null : null);
      const certain = [], loose = [];
      for (const old of was) {
        const now = changedTo(old);
        if (!now && kept.has(old.n)) continue;
        // A page this one says states the same figure of another thing (`only`) is not looked at.
        for (const other of pages.filter((item) => item.id !== page.id && !page.only?.includes(item.id))) {
          if (stale.has(`${other.id}|${old.n}`)) continue;
          const labelled = other.stands.find((there) => valuesAgree(there.n, old.n) && sameThing(old, there)) ?? null;
          // Where no label says so, the quantity itself does - once the page shows what it was changed to and no longer prints it.
          const same = labelled ?? (now && !kept.has(old.n) ? quantity(old, other) : null);
          const near = same ?? other.stands.find((there) => valuesAgree(there.n, old.n) && nearThing(old, there)) ?? null;
          if (same && now) certain.push({ old, now, page: other.id, there: same, by: labelled ? "label" : "quantity" });
          else if (near || (!kept.has(old.n) && digits(old, other))) loose.push({ old, now, page: other.id, there: near ?? digits(old, other), labelled: Boolean(near) });
        }
      }
      for (const item of certain) stale.add(`${item.page}|${item.old.n}`);
      for (const [key, items] of Map.groupBy(certain, (item) => `${item.old.n}|${item.now.n}`)) {
        const { old, now } = items[0], each = items.filter((item, at) => items.findIndex((other) => other.page === item.page) === at);
        finding("NUMBER_STALE", "blocker", [page.id, ...each.map((item) => item.page)],
          `This revision changed ${old.shown} to ${now.shown} on ${page.id} (${now.said}; the slide said ${old.said}), and ${listed(each.map((item) => `${item.page} still states ${item.there.shown} ${item.by === "label" ? "of the same thing" : "- the same quantity, whatever it is said of there"} (${item.there.said})`))}: the deck now gives one number two values${each.some((item) => item.by === "quantity") ? ", unless the other page means another thing by it" : ""}. Change it there too - \`replace: [{ old, new }]\` on a carried slide, the new number on a composed page - or, where the other page states a different thing, say so on ${page.id}: \`"only": [${each.map((item) => `"${item.page}"`).join(", ")}]\` names the pages whose figure is another thing, and each is listed for the reviewer`,
          { was: old.n, now: now.n, key });
      }
      const open = loose.filter((item) => !stale.has(`${item.page}|${item.old.n}`)).filter((item, at, all) => all.findIndex((other) => other.page === item.page && other.old.n === item.old.n) === at);
      if (open.length) finding("NUMBER_STALE", "advisory", [page.id, ...open.map((item) => item.page)],
        `${page.id} no longer states ${listed([...new Set(open.map((item) => `${item.old.shown}${item.now ? ` (now ${item.now.shown})` : ""}`))], ", ")}, which the slide it was imported from did (${listed([...new Set(open.map((item) => item.old.said))].slice(0, 3))}), and ${listed([...new Set(open.map((item) => `${item.page} still states ${item.there.shown} (${item.there.said})`))])}. ` +
        `${open.some((item) => item.labelled) ? "The words around them are alike, which is not enough to say they are one figure" : "Nothing but the digits says these are the figure the revision changed"}, so check each: where it is, change it there too`,
        [...new Set(open.map((item) => item.old.shown))].slice(0, LISTED));
      out.push(...staleWording(page, pages, registered(CONSISTENCY_CODES, "WORDING_STALE")));
    }
    if (imported.length) finding("NUMBERS_DISAGREE", "advisory", imported.flatMap((item) => item.pages),
      `About the imported deck, not this revision: ${imported.length} number${imported.length === 1 ? " is" : "s are"} given two values under one series or row name and one label on pages the revision did not change - ${listed(imported.map((item) => item.text))}. Nothing is refused; they are as the user made them, and worth a line to the user`,
      imported.slice(0, LISTED).map((item) => item.text));
  }

  // --- a page that re-proves its neighbour ----------------------------------
  if (spec) out.push(...repeatedProofs(spec, registry.size ? recordedMeasures(items) : null).filter((f) => involves(...f.pages)));
  return out;
}

// A name is one to four words, one of them capitalised, with no digits: "Project Falcon", "Northgate".
const NAME_WORDS = 4;
const wordsIn = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean);
const bare = (word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const phrase = (text) => ` ${wordsIn(text).map(bare).filter(Boolean).join(" ")} `;

// A title of this many words or more is a phrase of its own: quoted whole on another page it is that title. A shorter one is common words.
const TITLE_QUOTED_WORDS = 4;

/**
 * The words a revision changed on `page`, a page composed where a slide
 * stood, that another page still carries: a title rewritten whose old wording
 * another page still quotes whole, and a name replaced inside a sentence the
 * page otherwise kept - the sentence the slide had and the one the page has
 * differ in one run of words, the old run a name - that another page still
 * uses and the changed page no longer does. The title blocks, as it does
 * where a carried slide is retitled in place (staleEdits): the old title is
 * known exactly, and a contents slide that still lists it is the deck saying
 * two things. A name advises: it is inferred from two sentences, and one that
 * is still right elsewhere is left to the author.
 */
function staleWording(page, pages, code) {
  const others = pages.filter((other) => other.id !== page.id);
  const said = (other) => other.texts.map(({ text }) => phrase(text)).join(" | ");
  const found = [], out = [];
  const oldTitle = String(page.source?.title ?? "").trim();
  if (oldTitle && wordsIn(oldTitle).length >= TITLE_QUOTED_WORDS && phrase(oldTitle).toLowerCase() !== phrase(page.title).toLowerCase()) {
    const quoting = others.filter((other) => said(other).toLowerCase().includes(phrase(oldTitle).toLowerCase())).map((other) => other.id);
    if (quoting.length) out.push({ code, severity: "blocker", id: page.id, pages: [page.id, ...quoting], measured: { old: oldTitle, new: page.title, still: quoting },
      repair: `${page.id} is now titled "${page.title}" where the slide was titled "${oldTitle}", and ${listed(quoting, ", ")} still print${quoting.length === 1 ? "s" : ""} the old title whole: the deck now says two things. Make the same change there - \`replace\` on a carried page, the new words on a composed one` });
  }
  const now = page.texts.map(({ text }) => wordsIn(text)), mine = now.map((words) => ` ${words.map(bare).join(" ")} `).join(" | ");
  for (const { text } of slideTexts(page.source)) {
    const old = wordsIn(text);
    if (old.length < 4) continue;
    for (const words of now) {
      let head = 0, tail = 0;
      while (head < old.length && head < words.length && old[head] === words[head]) head += 1;
      while (tail < old.length - head && tail < words.length - head && old.at(-1 - tail) === words.at(-1 - tail)) tail += 1;
      const [gone, came] = [old.slice(head, old.length - tail).map(bare).filter(Boolean), words.slice(head, words.length - tail).map(bare).filter(Boolean)];
      // One run replaced inside a sentence otherwise kept: most of it stands either side.
      if (!gone.length || !came.length || gone.length > NAME_WORDS || head + tail < 3 || gone.some((word) => /\d/.test(word)) || !gone.some((word) => /^\p{Lu}/u.test(word))) continue;
      const name = ` ${gone.join(" ")} `;
      if (mine.includes(name)) continue;
      for (const other of others) if (said(other).includes(name)) found.push({ page: other.id, what: `"${gone.join(" ")}", which this page now writes "${came.join(" ")}"` });
    }
  }
  if (!found.length) return out;
  const each = [...new Map(found.map((item) => [`${item.page}|${item.what}`, item])).values()];
  return [...out, { code, severity: "advisory", pages: [...new Set([page.id, ...each.map((item) => item.page)])], measured: each.slice(0, LISTED).map((item) => item.what),
    repair: `This revision changed wording on ${page.id} that other pages still carry in its old form: ${listed(each.map((item) => `${item.page} still says ${item.what}`))}. Where it is the same name or the same claim, change it there too; where the old wording is still right on that page, leave it` }];
}

/** Every number in `text`, as a reader compares them: "1,311.8" is 1311.8. The digits of a name - "FY22", "Q3" - are part of the name, not a number of their own. */
const numbersIn = (text) => (String(text ?? "").match(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*/gu) || []).map((raw) => Number(raw.replace(/,(?=\d{3}\b)/g, "").replace(/,/g, "."))).filter(Number.isFinite);
const tokensOf = (text) => String(text ?? "").split(/\s+/).map((token) => token.replace(/^[("'“‘]+|[)"'”’.,;:!?]+$/g, "")).filter(Boolean);
/** The words of `old` that `next` does not keep: what the edit took away. */
function removedTokens(old, next) {
  const kept = new Map();
  for (const token of tokensOf(next)) kept.set(token, (kept.get(token) || 0) + 1);
  return tokensOf(old).filter((token) => { const left = kept.get(token) || 0; if (left) kept.set(token, left - 1); return !left; });
}
// What a composed page prints, read off the compiled slide: every string it holds but the keys that name its form, and every number its exhibits draw.
const FORM_KEYS = ["id", "pageType", "path", "type", "kind", "layout", "arrange", "shape"];
const stringsOf = (value, out = []) => {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) stringsOf(item, out);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) if (!FORM_KEYS.includes(key)) stringsOf(item, out);
  return out;
};
const drawnNumbers = (value, out = []) => {
  if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  else if (Array.isArray(value)) for (const item of value) drawnNumbers(item, out);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) if (!FORM_KEYS.includes(key)) drawnNumbers(item, out);
  return out;
};

// --- a figure as a quantity: what an edit's stale copies are found by --------
// What kind of quantity a printed number says it is: a percentage, a number at a stated scale ("£12.4m", "£12.4 million" and
// "GBP 12.40m" are each 12.4 at a million), money in whole units - or null where nothing but its digits says.
// A kind names its currency after a colon where the number or its unit names one ("x1000000:£"): "€12.4m" is not "£12.4m".
const CURRENCY_CODES = Object.freeze({ USD: "$", US$: "$", GBP: "£", EUR: "€", JPY: "¥" });
const currencyIn = (mark) => { const said = String(mark ?? "").toUpperCase(); return said ? CURRENCY_CODES[said] ?? said : null; };
const unitCurrency = (unit) => currencyIn(/[$£€¥]/.exec(String(unit ?? ""))?.[0] ?? /\b(USD|GBP|EUR|CHF|JPY|AUD|CAD)\b/i.exec(String(unit ?? ""))?.[1]);
const kindSaid = (number, unit = null) => {
  const base = number.percent || (unit && percentUnit(unit)) ? "percent" : number.scale ? `x${number.scale}` : unit && unitScale(unit) > 1 ? `x${unitScale(unit)}` : number.currency ? "money" : null;
  const money = base && base !== "percent" ? currencyIn(number.currencyMark) ?? (unit ? unitCurrency(unit) : null) : null;
  return money ? `${base}:${money}` : base;
};
const baseOf = (kind) => (kind ? kind.split(":")[0] : null), moneyOf = (kind) => (kind ? kind.split(":")[1] ?? null : null);
const scaleSaid = (kind) => (baseOf(kind)?.startsWith("x") ? Number(baseOf(kind).slice(1)) : null);
const decimalsOf = (value) => (String(value).split(".")[1] || "").length;
const closeTo = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const quoted = (text) => { const line = String(text).replace(/\s+/g, " ").trim(); return `"${line.length > 80 ? `${line.slice(0, 79).trimEnd()}…` : line}"`; };
/**
 * Every quantity a page states, `{ n, decimals, kind, shown, said }`: the
 * numbers its texts print (printed-numbers.mjs; a year or a date is a label)
 * and the numbers its exhibits hold - a chart's values (`drawn`: data a
 * sentence rounds) and a table's cells, with the unit their column gives. A
 * bare whole number among the words of a sentence is a `count`.
 */
function quantitiesOf(texts, exhibits) {
  const out = [];
  for (const text of texts) for (const number of printedNumbers(text).filter((item) => item.kind !== "period"))
    out.push({ n: number.n, decimals: number.decimals, kind: kindSaid(number), shown: number.shown, said: quoted(text), count: number.kind === "integer" && String(text).trim() !== number.shown });
  for (const ex of exhibits) {
    for (const cell of chartCells(ex)) out.push({ n: Math.abs(cell.value), decimals: decimalsOf(cell.value), kind: kindSaid({}, cell.unit), shown: String(cell.value), said: `"${cell.name}" at "${cell.label}", in a chart`, drawn: true });
    for (const cell of tableCells(ex)) { const text = cell.cell && typeof cell.cell === "object" ? cellText(cell.cell) : String(cell.cell ?? ""), numbers = printedNumbers(text).filter((item) => item.kind !== "period");
      if (numbers.length === 1) out.push({ n: numbers[0].n, decimals: numbers[0].decimals, kind: kindSaid(numbers[0], cell.unit ?? headerUnit(cell.label) ?? headerUnit(cell.name)), shown: numbers[0].shown, said: `"${cell.name}" under "${cell.label}"` }); }
  }
  return out;
}
/**
 * How a quantity `there` on another page stands to the figure `old` an edit
 * replaced: "same" - the same value of the same stated kind, whatever the
 * notation; "scale" - the same amount at another stated scale ("£12,400k"),
 * or written out in full; "rounds" - chart data the figure is the rounding
 * of (12.43); "digits" - the same digits where one of the two says nothing of
 * its kind; null - another number, or another kind of number.
 */
function sameFigure(old, there) {
  const rounds = there.drawn && there.decimals > old.decimals && closeTo(Number(there.n.toFixed(old.decimals)), old.n);
  const [a, b] = [scaleSaid(old.kind), scaleSaid(there.kind)];
  if (old.kind && there.kind) {
    const [mine, theirs] = [moneyOf(old.kind), moneyOf(there.kind)];
    // Another currency is another figure; a currency only one of the two names leaves the digits alike, and no more.
    if (mine && theirs && mine !== theirs) return null;
    if (baseOf(old.kind) === baseOf(there.kind)) return there.n === old.n ? (mine === theirs ? "same" : "digits") : rounds ? "rounds" : null;
    return a && b && closeTo(old.n * a, there.n * b) ? "scale" : null;
  }
  // A figure that says what it is is not a bare count in a sentence ("14%" is not "14 stores").
  if ((old.kind && there.count) || (there.kind && old.count)) return null;
  if (there.n === old.n) return "digits";
  return (a && closeTo(old.n * a, there.n)) || (b && closeTo(there.n * b, old.n)) ? "scale" : rounds ? "rounds" : null;
}

/**
 * What a revision's text edits on carried slides left standing. An edit
 * names the old words and the new (`carried`: revision.mjs carriedStated), so
 * what it replaced is known exactly: the old words, and each figure in them
 * that the new words do not keep. Every slide of the final deck is read for
 * them - the carried ones as their edits leave them, speaker notes included,
 * and the composed ones as compiled (`spec`); the edited slide itself too,
 * since an edit rewrites one place on it:
 *
 *   NUMBER_STALE    the edit dropped a figure. Blocks where a slide still
 *                   prints the old words or the figure whole (printsWords:
 *                   the reading the edit itself is made by), or states the
 *                   same quantity in another notation - the same value, kind
 *                   and scale ("£12.4m", "£12.4 million", "GBP 12.40m", a
 *                   table's 12.4 under "Revenue (£m)"). Advises where the same
 *                   amount stands at another scale ("£12,400k"), where a
 *                   chart's data rounds to it (12.43), and where nothing but
 *                   the digits says it is the same figure.
 *   WORDING_STALE   an edit of words alone: the old words printed whole on
 *                   another slide block; a title of fewer than four words is
 *                   common words, and advises.
 *
 * `only` on an edit names the pages whose same words are another thing: they
 * are not read for it. `stale` takes each page and number found, so the same
 * figure is not reported again of a page composed beside the edit.
 */
function staleEdits(carried, spec, stale) {
  const composed = [...(spec?.slides || []), ...(spec?.appendix || [])];
  const pages = [
    // A carried slide's chart is the inventory's record of it, which may name no categories: every value it plots is read.
    ...carried.map((item) => { const texts = [...slideTexts(item.slide), ...notesOf(item.slide)].map(({ text }) => text);
      const plotted = (item.slide?.charts || []).flatMap((chart) => (chart?.series || []).flatMap((series) => (series?.values || []).map((value, at) => ({ value, name: series?.name ?? chart?.title ?? "a series", label: chart?.categories?.[at] }))))
        .filter(({ value }) => typeof value === "number" && Number.isFinite(value)).map(({ value, name, label }) => ({ n: Math.abs(value), decimals: decimalsOf(value), kind: null, shown: String(value), said: `"${name}"${label === undefined ? "" : ` at "${label}"`}, in a chart`, drawn: true }));
      return { id: item.id, texts, notes: item.slide?.notes ?? null, quantities: [...quantitiesOf(texts, slideExhibits(item.slide).filter((ex) => ex.type === "table")), ...plotted] }; }),
    ...composed.map((slide) => { const texts = stringsOf(slide); return { id: String(slide.id), texts, quantities: quantitiesOf(texts, [slide.exhibit, ...(Array.isArray(slide.exhibits) ? slide.exhibits : [])].filter((ex) => ex && typeof ex === "object")) }; }),
  ];
  const findings = [];
  for (const item of carried) for (const edit of item.edits) {
    const excused = new Set(Array.isArray(edit.only) ? edit.only.map(String) : []);
    // The figures the edit took away, as quantities: what the old words stated and the new do not. Each is looked for as it
    // was written, whole - "£12.4 million" is one figure, and "£12.4" a kilo on another slide is not it.
    const kept = quantitiesOf([edit.new], []);
    const gone = quantitiesOf([edit.old], []).filter((old) => !kept.some((now) => now.n === old.n && now.kind === old.kind));
    // And the words with digits that are no measurement - a period, a year, a name ("FY26", "2026", "Q3"). A year another
    // slide prints may date another figure, so a label left standing is asked about, never refused, and the edited slide's
    // own other mentions of it are its own.
    const labels = removedTokens(edit.old, edit.new).filter((token) => /\d/.test(token) && !printedNumbers(token).some((number) => number.kind !== "period"));
    const figures = [...new Set(gone.map((old) => old.shown))];
    const phrases = [...new Set([edit.old, ...figures])];
    const strong = [], weak = [];
    for (const page of pages) {
      if (excused.has(page.id)) continue;
      // On the edited slide the old words are gone from where they stood; what can still stand there is a figure they held.
      const hit = (page.id === item.id ? figures : phrases).find((words) => page.texts.some((text) => printsWords(text, words)));
      const label = !hit && page.id !== item.id ? labels.find((words) => page.texts.some((text) => printsWords(text, words))) : null;
      if (label) { weak.push({ id: page.id, number: label, said: "a period label", how: "label", n: label }); continue; }
      // Words only the speaker's notes print are said to be there: the slide itself may not show them.
      if (hit) { strong.push({ id: page.id, phrase: hit, n: numbersIn(hit), ...(page.notes && printsWords(page.notes, hit) && !page.texts.some((text) => text !== page.notes && printsWords(text, hit)) ? { notes: true } : {}) }); continue; }
      const graded = gone.flatMap((old) => page.quantities.map((there) => ({ old, there, how: sameFigure(old, there) })).filter((match) => match.how));
      const same = graded.find((match) => match.how === "same");
      if (same) { strong.push({ id: page.id, phrase: same.there.shown, said: same.there.said, n: [same.old.n] }); continue; }
      // The edited slide is read for the figure it still states, and for its own chart, which no text edit reaches - not for
      // the digits its other numbers share.
      const near = ["scale", "rounds", "digits"].map((how) => graded.find((match) => match.how === how && (page.id !== item.id || match.there.drawn))).find(Boolean);
      if (near) weak.push({ id: page.id, number: near.there.shown, said: near.there.said, how: near.how, n: near.old.n });
    }
    for (const hit of strong) for (const n of hit.n) stale.add(`${hit.id}|${n}`);
    for (const hit of weak) stale.add(`${hit.id}|${hit.n}`);
    const code = registered(CONSISTENCY_CODES, figures.length || labels.length ? "NUMBER_STALE" : "WORDING_STALE");
    // A short title is common words: where one still stands is asked, not refused.
    const exact = figures.length > 0 || edit.what !== "title" || wordsIn(edit.old).length >= TITLE_QUOTED_WORDS;
    const where = `${item.id} now prints "${edit.new}" where the slide printed "${edit.old}"`;
    const at = (id) => (id === item.id ? `${id} itself` : id);
    // A `replace` can say whose words are another thing; a title is the slide's one title, and has no such mark.
    const others = [...new Set(strong.map((s) => s.id).filter((id) => id !== item.id))];
    const apartBy = edit.what === "title" || !others.length ? "" : ` - or, where the words on another page are a different thing, name that page on this edit: \`"only": [${others.map((id) => `"${id}"`).join(", ")}]\` (each is listed for the reviewer)`;
    if (strong.length) findings.push({ code, severity: exact ? "blocker" : "advisory", id: item.id, pages: [...new Set([item.id, ...strong.map((s) => s.id)])], measured: { old: edit.old, new: edit.new, still: strong.map(({ n: _n, ...hit }) => hit) },
      repair: `${where}, and ${strong.map((s) => (s.said ? `${at(s.id)} still states ${s.phrase} (${s.said})` : `${at(s.id)} still prints "${s.phrase}"${s.notes ? " in its speaker notes" : ""}`)).join(", ")}: the deck now says two things. Make the same change there - \`replace\` on a carried page, naming the words as that slide prints them; the new words on a composed one${exact ? apartBy : "; where the words are only alike, leave them"}` });
    const HOW = { scale: (w) => `${w.id} still states ${w.number} (${w.said}), the same amount at another scale`, rounds: (w) => `${w.id} still plots ${w.number} (${w.said}), which the figure rounds`, digits: (w) => `${w.id} still shows ${w.number} (${w.said})`,
      label: (w) => `${w.id} still prints "${w.number}", which may date another figure` };
    if (weak.length) findings.push({ code, severity: "advisory", id: item.id, pages: [item.id, ...weak.map((w) => w.id)], measured: { old: edit.old, new: edit.new, still: weak.map(({ n: _n, ...hit }) => hit) },
      repair: `${where}, and ${weak.map((w) => HOW[w.how](w)).join(", ")}. Nothing says outright that each is the figure this edit changed, so check each: where it is, change it there too - \`replace\` for words and a table's cell, and a \`type\` in place of \`carry\` for a chart's values, which no text edit reaches` });
  }
  return findings;
}

/**
 * The pages whose proof another page already gave: read from what the
 * storyline binding reads of each page (storyline.mjs storyStructure) - the
 * measures it shows as proof, the class each is shown in and the periods or
 * members shown - so the two agree on what a page shows. A page repeats the
 * page before it where it plots, as proof, a measure over the periods or
 * members that page plots it over: the same line on the same frame. Where
 * every view of every measure it shows as proof is one the other page shows
 * too it repeats it whole, and that is looked for against every earlier page
 * of the deck, not only its neighbour; otherwise the finding names the
 * measures replotted beside the ones that are new. A whole repeat blocks
 * (the rule `PROOF_REPEATS.identical`) where the two pages are the same
 * page twice by what they declare: their claims are about the same measures
 * (`settles.measures`) and each shows exactly the views the other shows.
 * Everything else advises. A single value drawn on both - a threshold, a
 * target - is a reference, not a repeat, and a table or a figure of a measure
 * another page plots is another reading of it. With no measures recorded,
 * the numbers each exhibit draws are what is compared, with the page before
 * alone, and only a page all of whose exhibits redraw its neighbour's is
 * reported.
 */
function repeatedProofs(spec, measures) {
  const out = [];
  const lists = [storyStructure({ ...spec, appendix: [] }, measures), storyStructure({ ...spec, slides: spec.appendix || [], appendix: [] }, measures)];
  const argues = (shown) => shown && shown.kind === "content" && shown.type;
  const proofOf = (shown) => (shown.shows || []).filter((entry) => entry.startsWith("proof:")).map((entry) => entry.slice("proof:".length)).filter((ref) => shown.views?.[ref]);
  const views = (shown, ref) => new Set(shown.views?.[ref] ?? []);
  const drawn = (shown) => (shown.drawn || []).map((item) => JSON.stringify(item));
  const plots = (shown, ref) => [...views(shown, ref)].filter((view) => JSON.parse(view)[0] === "chart");
  // Does every view `shown` gives of its proof stand on `other` too, with every number it draws from no measure.
  const within = (shown, other) => proofOf(shown).every((ref) => [...views(shown, ref)].every((view) => views(other, ref).has(view))) && drawn(shown).every((item) => drawn(other).includes(item));
  const claimed = (shown) => [...new Set(shown.settles?.measures ?? [])].sort().join("|");
  for (const pages of lists) pages.forEach((page, at) => {
    if (!argues(page)) return;
    const proof = proofOf(page);
    // The measures over periods or members this page plots as proof, and of those the ones `other` plots over the same.
    const plotted = proof.filter((ref) => measures?.[ref]?.axis.kind !== "scalar" && plots(page, ref).length);
    const againOn = (other) => plotted.filter((ref) => plots(page, ref).some((view) => views(other, ref).has(view)));
    const wholeOn = (other) => againOn(other).length > 0 && within(page, other);
    const beside = argues(pages[at - 1]) ? pages[at - 1] : null;
    const before = pages.slice(0, at).find((other) => argues(other) && wholeOn(other)) ?? beside;
    if (!before) return;
    const again = againOn(before), whole = wholeOn(before);
    const byNumbers = before === beside && !proof.length && drawn(page).length > 0 && drawn(page).every((item) => drawn(before).includes(item)) && (page.drawn || []).some((item) => item.class === "chart");
    if (!again.length && !byNumbers) return;
    const identical = whole && claimed(page) !== "" && claimed(page) === claimed(before) && within(before, page);
    const fresh = plotted.filter((ref) => !again.includes(ref));
    const where = before === beside ? `${before.id}, the page before,` : `${before.id}, earlier in the deck,`;
    const what = byNumbers ? `its exhibits draw the numbers ${before.id} draws, and nothing else`
      : whole ? `${listed(again, ", ")} ${again.length === 1 ? "is" : "are"} plotted on both over the same periods or members, and ${page.id} shows nothing else as proof`
      : `${page.id} plots ${listed(again, ", ")} over the same periods or members as ${before.id} does${fresh.length ? `, beside ${listed(fresh, ", ")}` : ""}`;
    const repairs = "another window of the series (`select: { from, to }`), the relation between the measures computed and drawn in place of the levels (a gap, a ratio, an index: `node runtime/analysis.mjs`), only the measures the first page does not show - or one page that carries both claims";
    out.push({ code: registered(CONSISTENCY_CODES, "PROOF_REPEATS"), id: page.id, ...(identical ? { rule: "PROOF_REPEATS.identical" } : {}), severity: identical ? "blocker" : "advisory", pages: [before.id, page.id],
      measured: byNumbers ? { drawn: (page.drawn || []).length } : { repeated: again, whole, ...(identical ? { identical } : {}) },
      repair: identical ? `${page.id} is ${before.id} a second time: both claims are about ${listed([...new Set(page.settles.measures)], ", ")}, and each page shows exactly what the other shows - ${what}. Two pages cannot prove one thing with one exhibit. Merge them into one page that carries both titles' point, or make ${page.id} show what ${before.id} does not: ${repairs}`
        : `${page.id} proves its claim with what ${where} already showed: ${what}. A reader meets the same line on the same frame twice, under two titles. What would make them two pages: ${repairs}. Where the repeat is meant, as a comparator the second page reads something new against, leave it: this is an advisory` });
  });
  return out;
}
