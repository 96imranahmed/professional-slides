// A point change to an existing deck, judged on what it changes.
//
// A revision (`workflow: "existing_deck_revision"`) starts from the user's
// PPTX (runtime/import-deck.py). Every rule in this runtime was written for a
// deck the runtime composes whole, and a deck recomposed whole is a deck
// redrawn: its untouched slides move, take this runtime's design, and are
// refused for rules the user's deck never met. So a revision does not have to
// recompose what it does not change. Each page of its pages file is one of
// three things, and one sentence says what the runtime does with each:
//
//   carried   `carry: true` beside the slide's `draft`. The slide is copied
//             from the source deck into the new one, part for part and byte
//             for byte (emit/assemble_pptx.py). It is not compiled, composed,
//             gated, critiqued or reviewed: it is the user's own. Its title
//             and its words are read - as context for the critic and the
//             reviewer, and by the stale-text check - and nothing else.
//   edited    a carried page whose `title` is not the slide's, or that lists
//             `replace: [{ old, new }]`. The words are rewritten inside the
//             slide's own XML, so its shapes, fonts and layout stay the
//             user's. It is a changed page: read by the critique when its
//             title changed, and by the review.
//   composed  a page given a `type` (or a section, or the cover). The runtime
//             composes it, and it is the revision's own page: every page rule
//             holds on it in full, under the rules version the deck records.
//
// A source slide no page names is dropped, with every part of the package
// only it drew on. A rule that measures the deck is read over the pages the
// runtime composed and held wherever they are enough for it to be read
// (weight.mjs notHeldOn, where "enough" is stated once): one carried slide
// does not change what forty composed pages are held to, and one composed
// page among thirty carried slides is held to no deck rule.
//
// An edit is made to whole words. `replace` names words as the slide prints
// them, and the slide prints them where they stand as tokens of their own -
// "12.4" is not printed by "£112.45", nor by "£12.4m" (wholeWords, which the
// assembler and the stale check both read). An edit whose old words stand
// only inside longer ones, or more than once on the slide, is refused with
// the places named; `"all": true` says every one of them is meant.
//
// What a point change must not do is leave the deck saying two things. A
// `replace` names the old words and the new, and a composed page stands where
// a slide stood, so what each changed is known: the old figure or the old
// words still standing on another slide is found by the check on what the
// deck's pages say between them (gates/consistency_gates.mjs NUMBER_STALE,
// WORDING_STALE), which reads each carried slide as its edits leave it
// (carriedStated).
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pythonBin } from "./cli.mjs";
import { registered } from "./errors.mjs";
import { RULES_VERSION, deckRulesLine } from "./weight.mjs";

/** The codes a revision's carried slides raise, each with what it is about. */
export const REVISION_CODES = Object.freeze({
  REVISION_CARRY_INVALID: "a carried page that cannot be carried as written: it names no slide of the source deck, a slide another page already stands for, a title the slide has no placeholder for, or a `replace` whose old words the slide does not print",
  REVISION_SOURCE_MISSING: "the copy of the source deck a revision carries slides from is not beside its inventory, or is not the deck the inventory was read from",
  REVISION_SLIDE_SIZE: "a revision that sets composed pages beside carried slides of a deck whose slide size is not the size the runtime composes at",
  REVISION_CARRY_DRIFT: "a carried slide whose parts in the built file are not the source deck's, byte for byte",
  REVISION_RULES_VERSION: "a revision that records a rules version below the one its import stamped and gives no reason the reviewer can check",
});

const REVISION = "existing_deck_revision";
// What the build writes of a revision's assembled deck, beside the composed pages' own scene and renders (build-deck.mjs
// assembleRevision): the deck slide by slide, and the folder of its renders. The review reads these (reviewer.mjs reviewedDeck).
export const ASSEMBLED_SCENE = "deck-scene.json";
export const ASSEMBLED_RENDERS = "deck";
// The canvas a composed page is drawn on (core.mjs SLIDE), which a carried deck must share to take one.
const COMPOSED_SIZE = Object.freeze({ width: 1280, height: 720 });

/** A page the build carries from the source deck rather than composes. */
export const isCarried = (page) => Boolean(page) && typeof page === "object" && page.carry === true;
const CARRIED_KEYS = Object.freeze(["id", "sourceSlide", "title", "carry", "draft", "hidden", "replace"]);
const EDIT_KEYS = Object.freeze(["old", "new", "only", "all"]);
const idList = (value) => Array.isArray(value) && value.length > 0 && value.every((id) => typeof id === "string" && id.trim());

/**
 * Why a carried page cannot be compiled as written, in a sentence, or null:
 * the checks that need no inventory. A carried page is the slide and at most
 * a text edit; anything more is a page to compose, which takes a `type`.
 */
export function carriedProblem(page, { revision = true } = {}) {
  const id = page.id ?? "a page";
  if (!revision) return `${id}: \`carry: true\` keeps a slide of an imported deck as it is, which only a revision (\`workflow: "${REVISION}"\`) has; give the page its \`type\` and write its copy`;
  if (page.type || page.kind) return `${id}: a page is carried from the source deck (\`carry: true\`, with its \`draft\`) or composed by the runtime (a \`type\`), not both - to redraw the slide delete \`carry\` and \`draft\`; to keep it delete the \`type\` and its choices`;
  if (!Number.isInteger(page.sourceSlide) || page.sourceSlide < 1) return `${id}: a carried page names the slide it carries - \`sourceSlide\`, its place in the source deck, as the import wrote it`;
  const unknown = Object.keys(page).filter((key) => !CARRIED_KEYS.includes(key));
  if (unknown.length) return `${id}: a carried page takes ${CARRIED_KEYS.map((key) => `\`${key}\``).join(", ")} and nothing else (it has ${unknown.map((key) => `\`${key}\``).join(", ")}): the slide is copied as it is. To change its words write \`replace: [{ "old": "...", "new": "..." }]\` or a new \`title\`; to change what it shows, give the page a \`type\` in place of \`carry\` and \`draft\``;
  if (page.hidden !== undefined && typeof page.hidden !== "boolean") return `${id}: \`hidden\` is true or false`;
  if (page.title !== undefined && typeof page.title !== "string") return `${id}: \`title\` is the slide's title, as text`;
  const edits = page.replace;
  if (edits !== undefined && (!Array.isArray(edits) || edits.some((edit) => !edit || typeof edit !== "object" || typeof edit.old !== "string" || !edit.old.trim() || typeof edit.new !== "string"
    || Object.keys(edit).some((key) => !EDIT_KEYS.includes(key)) || (edit.only !== undefined && !idList(edit.only)) || (edit.all !== undefined && typeof edit.all !== "boolean") || edit.old === edit.new)))
    return `${id}: \`replace\` is a list of { "old": the words as the slide prints them, whole, "new": the words that replace them } - with \`"all": true\` where the slide prints them more than once and every one is meant, and \`"only": ["s05", ...]\` naming the other pages whose same words are a different thing and stay (the pages, not \`true\`: each is listed for the reviewer)`;
  return null;
}

/**
 * The carried pages of a pages document as the compiled deck records them
 * (`carried` on the spec): each with the slide it carries, its title and
 * edits as authored, and `after` - the id of the composed page it follows in
 * the pages file, null where it comes before every one - which is all the
 * build needs to set the carried slides among the composed ones.
 */
export function carriedEntries(pages) {
  const out = [];
  let after = null;
  for (const page of pages) {
    if (!isCarried(page)) { if (page && typeof page === "object" && page.id !== undefined && !(page.draft !== undefined && !page.type && !page.kind)) after = String(page.id); continue; }
    out.push({ id: String(page.id), sourceSlide: page.sourceSlide, title: page.title ?? "", after,
      ...(page.hidden !== undefined ? { hidden: page.hidden } : {}), ...(Array.isArray(page.replace) && page.replace.length ? { replace: page.replace } : {}) });
  }
  return out;
}

const normalTitle = (text) => String(text ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();

// --- "the slide prints these words": one reading, for the edit and for the stale check ---
// Words are printed where they stand as tokens of their own. A token runs between spaces (and em dashes set without them);
// brackets and quotes before it and sentence punctuation after it are not part of it. So "12.4" is printed by "(12.4)" and
// by "12.4," and by neither "£12.4m", "12.4%", "12.45" nor "112.4": each of those is another token, which an edit of 12.4
// must not rewrite and a search for 12.4 must not find. emit/assemble_pptx.py whole_words is the same reading in Python.
const SEPARATOR = /[\s\u2014]/u, OPENERS = "([{\"'\u201c\u2018\u00ab", CLOSERS = ")]}\"'\u201d\u2019\u00bb.,;:!?\u2026";
/**
 * Where `text` prints `words`: `whole`, the offsets at which they stand as
 * tokens of their own, and `inside`, each place they stand only as part of a
 * longer token, with that token.
 */
export function wholeWords(text, words) {
  const source = String(text ?? ""), wanted = String(words ?? ""), whole = [], inside = [];
  if (!wanted) return { whole, inside };
  for (let at = source.indexOf(wanted); at >= 0; at = source.indexOf(wanted, at + wanted.length)) {
    const end = at + wanted.length;
    let from = at, to = end;
    while (from > 0 && !SEPARATOR.test(source[from - 1])) from -= 1;
    while (to < source.length && !SEPARATOR.test(source[to])) to += 1;
    const opens = SEPARATOR.test(source[at]) || [...source.slice(from, at)].every((char) => OPENERS.includes(char));
    const closes = SEPARATOR.test(source[end - 1]) || [...source.slice(end, to)].every((char) => CLOSERS.includes(char));
    if (opens && closes) whole.push(at); else inside.push({ at, token: source.slice(from, to) });
  }
  return { whole, inside };
}
/** Does `text` print `words` as words of its own. */
export const printsWords = (text, words) => wholeWords(text, words).whole.length > 0;
/** `text` with `old` replaced wherever it stands whole. */
function replaceWhole(text, old, next) {
  let out = String(text);
  for (const at of wholeWords(out, old).whole.reverse()) out = out.slice(0, at) + next + out.slice(at + old.length);
  return out;
}

/**
 * What a carried page changes on its slide: `title` where the page's is not
 * the slide's, `edits` (its `replace`), `hidden` where it differs - and
 * `retitled`, the slide's title as the revision leaves it wherever that is
 * not the slide's own, whichever key wrote it: a title rewritten through
 * `replace` is a title change as much as one written as `title`. Empty for a
 * slide carried untouched.
 */
export function carriedChanges(entry, slide) {
  const title = normalTitle(entry.title) !== normalTitle(slide?.title) ? normalTitle(entry.title) : undefined;
  const edits = entry.replace?.length ? entry.replace.map(({ old, new: next, all }) => ({ old, new: next, ...(all ? { all: true } : {}) })) : undefined;
  const after = slide?.title ? normalTitle((edits ?? []).reduce((now, edit) => replaceWhole(now, edit.old, edit.new), title ?? slide.title)) : title;
  return { ...(title !== undefined ? { title } : {}), ...(edits ? { edits } : {}),
    ...(entry.hidden !== undefined && Boolean(entry.hidden) !== Boolean(slide?.hidden) ? { hidden: Boolean(entry.hidden) } : {}),
    ...(after !== undefined && after !== normalTitle(slide?.title) ? { retitled: after } : {}) };
}
const changed = (changes) => Object.keys(changes).length > 0;

/**
 * What each carried slide prints, by page id - its title first - as the
 * revision's edits leave it; whether the revision edited it; and `rewritten`,
 * the lines its edits changed, as they now read and (`was`) as they stood.
 */
export function carriedSaid(spec, inventory) {
  const slides = new Map((inventory?.slides || []).map((slide) => [slide.index, slide]));
  return (spec?.carried || []).map((entry) => { const slide = slides.get(entry.sourceSlide), changes = carriedChanges(entry, slide);
    const before = slideTexts(slide, { furniture: false }), after = editedTexts(slide, changes, { furniture: false });
    return { id: entry.id, sourceSlide: entry.sourceSlide, edited: changed(changes), texts: [slide?.title ? normalTitle(after[0]) : normalTitle(entry.title), ...after.slice(slide?.title ? 1 : 0)],
      // The slide as a record a critic can read whole: its lines, each table row by row, each chart value by value.
      record: slideRecord(editedSlide(slide, changes)),
      rewritten: after.map((text, at) => ({ text, was: before[at], title: at === 0 && Boolean(slide?.title) })).filter(({ text, was }) => text !== was) }; });
}

/**
 * What an imported slide says and shows, a line each: its text (the deck's
 * furniture left out), each table row by row under its header, and each
 * chart's series value by value. A slide of the user's own has no insight log
 * behind it; this is its record, and what a changed title is judged against.
 */
function slideRecord(slide) {
  if (!slide) return [];
  const lines = (slide.paragraphs || []).filter((p) => !FURNITURE.has(p.role) && typeof p.text === "string" && p.text.trim()).map((p) => p.text);
  const tables = (slide.tables || []).flatMap((table) => { const [head = [], ...rows] = Array.isArray(table?.cells) ? table.cells : [];
    return [`table - ${head.join(" | ")}`, ...rows.map((row) => `  ${row.join(" | ")}`)]; });
  const charts = (slide.charts || []).flatMap((chart) => (chart?.series || []).map((series) => `chart${chart?.title ? ` "${chart.title}"` : ""} - ${series?.name ?? "series"}: ${(series?.values || []).map((value, at) => `${chart?.categories?.[at] ?? at + 1} ${value}`).join(", ")}`));
  return [...(slide.subtitle ? [slide.subtitle] : []), ...lines, ...tables, ...charts];
}

/** The carried pages a revision edited, by id, each with what it changed: what the critique and the review read as the revision's. */
function editedCarried(spec, inventory) {
  const slides = new Map((inventory?.slides || []).map((slide) => [slide.index, slide]));
  return (spec?.carried || []).map((entry) => ({ id: entry.id, sourceSlide: entry.sourceSlide, changes: carriedChanges(entry, slides.get(entry.sourceSlide)) })).filter((item) => changed(item.changes));
}

/**
 * A deck's pages in their final order: `composed` - the composed pages or
 * slides in order, each keyed by the page it was composed from - with the
 * carried slides set among them, each as `make(entry)`. A carried slide
 * follows the last composed slide of the page its `after` names; the slides
 * ahead of every composed page come first - behind the cover, when the
 * runtime composes one - and a slide the runtime generates (a contents page,
 * the picture credits) keeps the place it composed at.
 */
export function withCarriedPages(spec, composed, make, keyOf = (item) => String(item.sourceSlideId ?? item.id)) {
  const groups = new Map();
  for (const entry of spec?.carried || []) groups.set(entry.after, [...(groups.get(entry.after) || []), entry]);
  const out = [], placed = new Set();
  const carry = (key) => { for (const entry of groups.get(key) || []) { placed.add(entry.id); out.push(make(entry)); } };
  const cover = composed.length > 0 && keyOf(composed[0]) === "cover";
  if (!cover) carry(null);
  composed.forEach((item, index) => {
    out.push(item);
    if (index === 0 && cover) carry(null);
    if (index + 1 === composed.length || keyOf(composed[index + 1]) !== keyOf(item)) carry(keyOf(item));
  });
  // A carried slide whose anchor did not compose keeps its place among the carried, at the end.
  for (const entry of spec?.carried || []) if (!placed.has(entry.id)) out.push(make(entry));
  return out;
}

/**
 * The deck as the build assembles it: each slide of the built file as
 * `{ carry, id, title?, edits?, hidden? }` - a source slide, with what is
 * edited on it - or `{ composed, id }`, the nth slide the runtime composed
 * (`composed`: the composed slides in order, `{ id, sourceSlideId }`).
 */
export function assemblyOrder(spec, inventory, composed) {
  const slides = new Map((inventory?.slides || []).map((slide) => [slide.index, slide]));
  const keyOf = (slide) => String(slide.sourceSlideId ?? slide.id);
  const made = (entry) => { const { title, edits, hidden } = carriedChanges(entry, slides.get(entry.sourceSlide)); return { ...(title !== undefined ? { title } : {}), ...(edits ? { edits } : {}), ...(hidden !== undefined ? { hidden } : {}) }; };
  return withCarriedPages(spec, composed.map((slide, index) => ({ composed: index + 1, id: keyOf(slide) })), (entry) => ({ carry: entry.sourceSlide, id: entry.id, ...made(entry) }), (item) => item.id);
}

/** Where each composed slide stands in the final deck, counted from 1: the page number it prints beside carried slides. */
export function composedPlaces(spec, composed) {
  const order = assemblyOrder(spec, null, composed);
  const places = new Array(composed.length).fill(null);
  order.forEach((item, at) => { if (item.composed) places[item.composed - 1] = at + 1; });
  return places;
}

/** The source deck a revision carries slides from: the copy the import kept beside the inventory. */
export function sourceDeckPath(spec, inventory, baseDir) {
  const beside = path.dirname(path.resolve(baseDir, String(spec.inventory ?? "")));
  const named = inventory?.source?.copy ?? `${String(spec.inventory ?? "").replace(/\.inventory\.json$/, "")}.source.pptx`;
  return path.join(beside, path.basename(named));
}
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

// --- what each slide prints, as the revision's edits leave it ----------------

const FURNITURE = new Set(["furniture", "page-number"]);
/**
 * Every string an imported slide prints in its own XML - its title, its text
 * and its table cells - as the inventory read them. `furniture: false` leaves
 * out the deck's own furniture (a footer repeated on its slides, the page number).
 */
const slideTexts = (slide, { furniture = true } = {}) => [slide?.title, slide?.subtitle, ...(slide?.paragraphs || []).filter((p) => furniture || !FURNITURE.has(p.role)).map((p) => p.text), ...(slide?.tables || []).flatMap((t) => (t?.cells || []).flat())]
  .filter((text) => typeof text === "string" && text !== "");
/** A slide's strings with a carried page's edits made, as the built slide will print them. */
function editedTexts(slide, changes, options) {
  let texts = slideTexts(slide, options);
  if (changes.title !== undefined && slide?.title) texts = [changes.title, ...texts.slice(1)];
  for (const { old, new: next } of changes.edits || []) texts = texts.map((text) => replaceWhole(text, old, next));
  return texts;
}

/** An imported slide as a carried page's edits leave it: its title, its text, its table cells and its speaker notes rewritten; its charts are the slide's own, which no text edit reaches. */
function editedSlide(slide, changes) {
  if (!slide) return slide;
  const rewrite = (text) => (typeof text === "string" ? (changes.edits || []).reduce((now, { old, new: next }) => replaceWhole(now, old, next), text) : text);
  return { ...slide, title: rewrite(changes.title !== undefined && slide.title ? changes.title : slide.title), subtitle: rewrite(slide.subtitle), notes: rewrite(slide.notes),
    paragraphs: (slide.paragraphs || []).map((p) => ({ ...p, text: rewrite(p.text) })), tables: (slide.tables || []).map((table) => ({ ...table, cells: (table?.cells || []).map((row) => row.map(rewrite)) })) };
}

/**
 * What each carried slide states, for the checks on what the deck's pages
 * say between them (gates/consistency_gates.mjs): by page id, the `slide` as
 * the revision's edits leave it - what the built deck will print - and
 * `edits`, each change the revision made to its words as `{ old, new, what,
 * only }`: a new `title` against the slide's own, and every `replace` - one
 * whose old words are the slide's whole title is the title's change too.
 * `only` is the pages an edit says print the same words of another thing.
 */
export function carriedStated(spec, inventory) {
  const slides = new Map((inventory?.slides || []).map((slide) => [slide.index, slide]));
  return (spec?.carried || []).map((entry) => { const slide = slides.get(entry.sourceSlide), changes = carriedChanges(entry, slide);
    return { id: entry.id, sourceSlide: entry.sourceSlide, slide: editedSlide(slide, changes),
      edits: [...(changes.title !== undefined && slide?.title ? [{ old: normalTitle(slide.title), new: changes.title, what: "title" }] : []),
        ...(entry.replace || []).map((edit) => ({ ...edit, what: slide?.title && normalTitle(edit.old) === normalTitle(slide.title) ? "title" : "text" }))] }; });
}
/**
 * The carried slides of `plan` (assemblyOrder) tried against the source deck
 * without writing anything (emit/assemble_pptx.py --check): the refusals of
 * the edits that cannot be made - words the slide does not print, a title
 * with no placeholder to hold it - each with the source slide it is on. Empty
 * when every one can be made; null when Python or the assembler could not run.
 */
function tryCarried(plan, source, python = pythonBin()) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "revision-check-"));
  try {
    const file = path.join(dir, "plan.json");
    writeFileSync(file, JSON.stringify({ source, slides: plan.filter((item) => item.carry) }));
    const run = spawnSync(python, [fileURLToPath(new URL("./emit/assemble_pptx.py", import.meta.url)), file, "--check"], { encoding: "utf8" });
    if (run.error || ![0, 2].includes(run.status)) return null;
    try { return JSON.parse(String(run.stdout).trim().split("\n").at(-1)).refusals ?? []; } catch { return null; }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/**
 * Everything a revision's carried slides are held to, as findings: the source
 * deck being where the import kept it and the deck the inventory was read
 * from; each carried page naming a slide of it that no other page stands for;
 * every edit one the slide's own text can take; composed pages only beside
 * slides of the size they are composed at. `spec` is the compiled deck
 * (`carried`, `slides`), `baseDir` the folder of the pages file. Nothing is
 * raised of a revision that carries no slide.
 */
export function carriedFindings(spec, inventory, baseDir, { python = pythonBin() } = {}) {
  const carried = spec?.carried || [];
  if (spec?.workflow !== REVISION || !carried.length || !inventory) return [];
  const findings = [];
  const invalid = (id, repair) => findings.push({ code: registered(REVISION_CODES, "REVISION_CARRY_INVALID"), severity: "blocker", id, repair });
  const slides = new Map((inventory.slides || []).map((slide) => [slide.index, slide]));
  const typed = new Map([...(spec.slides || []), ...(spec.appendix || [])].filter((slide) => (slide.pageType?.sourceSlide ?? slide.sourceSlide) !== undefined).map((slide) => [slide.pageType?.sourceSlide ?? slide.sourceSlide, String(slide.id)]));
  const seen = new Map();
  for (const entry of carried) {
    const slide = slides.get(entry.sourceSlide);
    if (!slide) { invalid(entry.id, `${entry.id}: the source deck has no slide ${entry.sourceSlide} (it has ${slides.size}); a carried page keeps the \`sourceSlide\` the import gave it`); continue; }
    if (seen.has(entry.sourceSlide)) invalid(entry.id, `${entry.id}: slide ${entry.sourceSlide} is already carried by ${seen.get(entry.sourceSlide)}; a slide is carried once - to show it twice, compose the second page`);
    else if (typed.has(entry.sourceSlide)) invalid(entry.id, `${entry.id}: slide ${entry.sourceSlide} is carried here and redrawn as ${typed.get(entry.sourceSlide)}; keep one - delete this page to replace the slide with the composed page, or take \`sourceSlide\` off ${typed.get(entry.sourceSlide)} to add it as a new page beside the slide`);
    seen.set(entry.sourceSlide, entry.id);
    if (normalTitle(entry.title) !== normalTitle(slide.title) && !slide.title) invalid(entry.id, `${entry.id}: slide ${entry.sourceSlide} has no title placeholder, so the page's \`title\` cannot be written onto it; leave \`title\` as the import wrote it and change the words with \`replace\``);
  }
  const source = sourceDeckPath(spec, inventory, baseDir);
  const missing = !existsSync(source) ? `is not at ${path.relative(baseDir, source) || path.basename(source)}` : inventory.source?.sha256 && sha256(source) !== inventory.source.sha256 ? "is not the deck the inventory was read from (its hash differs)" : null;
  if (missing) findings.push({ code: registered(REVISION_CODES, "REVISION_SOURCE_MISSING"), severity: "blocker",
    repair: `This revision carries ${carried.length} slide${carried.length === 1 ? "" : "s"} from its source deck, and the copy of ${inventory.source?.file ?? "that deck"} ${missing}. Run runtime/import-deck.py on the user's deck again in another folder and copy its <id>.source.pptx beside ${path.basename(String(spec.inventory))}, or put the imported file there under that name` });
  const size = inventory.slideSize;
  const composes = (spec.slides || []).length + (spec.appendix || []).length + (spec.cover ? 1 : 0);
  if (composes && size && (size.width !== COMPOSED_SIZE.width || size.height !== COMPOSED_SIZE.height)) findings.push({ code: registered(REVISION_CODES, "REVISION_SLIDE_SIZE"), severity: "blocker",
    repair: `The source deck's slides are ${size.width} x ${size.height} px, and the runtime composes a page at ${COMPOSED_SIZE.width} x ${COMPOSED_SIZE.height}: a composed page cannot be set beside the carried slides. Make the change as a text edit on the carried slide (\`replace\`, \`title\`), or rebuild the deck - import it without --carry and map every slide` });
  // The edits, tried on the slides themselves: the inventory reads a slide's text as a reader does, and the slide holds it in runs.
  if (!missing && !findings.some((f) => f.code === "REVISION_CARRY_INVALID")) {
    const byIndex = new Map(carried.map((entry) => [entry.sourceSlide, entry.id]));
    const refused = tryCarried(assemblyOrder(spec, inventory, []), source, python);
    for (const refusal of refused ?? []) invalid(byIndex.get(refusal.slide) ?? null, `${byIndex.get(refusal.slide) ?? `slide ${refusal.slide}`}: ${refusal.message}`);
  }
  return findings;
}

/**
 * What a revision does with each slide of its source deck, counted: the
 * slides carried as they are, the carried slides edited in place, the pages
 * the runtime composes and the source slides no page names. Null for new work
 * and for a revision whose inventory is not there to read.
 */
export function revisionStatement(spec, inventory) {
  if (spec?.workflow !== REVISION || !Array.isArray(inventory?.slides)) return null;
  const carried = spec.carried || [], edited = editedCarried(spec, inventory).map((item) => item.id);
  const pages = [...(spec.slides || []), ...(spec.appendix || [])];
  const used = new Set([...carried.map((entry) => entry.sourceSlide), ...pages.map((slide) => slide.pageType?.sourceSlide ?? slide.sourceSlide).filter((n) => n !== undefined)]);
  // A composed cover stands for the title slide it was imported from.
  const dropped = inventory.slides.filter((slide) => !used.has(slide.index) && !(slide.index === 1 && spec.cover)).map((slide) => slide.id);
  return { source: inventory.source?.file ?? null, slides: inventory.slides.length, carried: carried.length - edited.length, edited,
    composed: [...(spec.cover ? ["cover"] : []), ...pages.filter((slide) => slide.id !== undefined).map((slide) => String(slide.id))], dropped, rulesVersion: spec.rulesVersion ?? null,
    // What the revision says it leaves standing on purpose, and why its rules are older than its import's: each is the reviewer's to check.
    ...(excusedPages(spec).length ? { excused: excusedPages(spec) } : {}), ...(loweredVersion(spec, inventory) ? { lowered: loweredVersion(spec, inventory) } : {}),
    deckRules: deckRulesLine(spec) };
}

/**
 * The pages a revision says print a changed figure or changed words of
 * another thing (`only`): on a text edit, `{ page, old, only }`; on a page
 * composed where a slide stood, `{ page, only }`. The stale check does not
 * read them for that change, so each is listed for the reviewer, who can.
 */
export function excusedPages(spec) {
  const edits = (spec?.carried || []).flatMap((entry) => (entry.replace || []).filter((edit) => Array.isArray(edit.only) && edit.only.length).map((edit) => ({ page: entry.id, old: edit.old, only: edit.only.map(String) })));
  const composed = [...(spec?.slides || []), ...(spec?.appendix || [])].filter((slide) => Array.isArray(slide?.pageType?.only) && slide.pageType.only.length).map((slide) => ({ page: String(slide.id), only: slide.pageType.only.map(String) }));
  return [...edits, ...composed];
}

// A reason is a sentence someone can check, as a waiver's is (build-bars.mjs waiverErrors).
const REASON_WORDS = 6;
/** A rules version a revision records below the one its import stamped (`rulesVersion` on the inventory): `{ recorded, stamped, reason }`, or null. */
function loweredVersion(spec, inventory) {
  const recorded = Number(spec?.rulesVersion), stamped = Number(inventory?.rulesVersion ?? NaN);
  return Number.isFinite(recorded) && Number.isFinite(stamped) && recorded < stamped ? { recorded, stamped, reason: typeof spec.rulesVersionReason === "string" ? spec.rulesVersionReason.trim() : "" } : null;
}

/**
 * What a revision's own record is held to, whether or not it carries a
 * slide: a rules version below the one the import stamped is the author's
 * choice to be held to less, and says why (`rulesVersionReason` on `deck`);
 * and every page an edit or a composed page excuses with `only` is a page of
 * the deck.
 */
export function revisionRecordFindings(spec, inventory) {
  if (spec?.workflow !== REVISION) return [];
  const findings = [];
  const lowered = loweredVersion(spec, inventory);
  if (lowered && lowered.reason.split(/\s+/).filter(Boolean).length < REASON_WORDS) findings.push({ code: registered(REVISION_CODES, "REVISION_RULES_VERSION"), severity: "blocker",
    repair: `This revision records \`rulesVersion: ${lowered.recorded}\`, and the import of its source deck stamped ${lowered.stamped}${lowered.stamped === RULES_VERSION ? ", the version this runtime enforces" : ""}: every rule introduced since would be an advisory to it. Put back \`rulesVersion: ${lowered.stamped}\`, or - where the deck really was made under version ${lowered.recorded} - say so on \`deck\` in a sentence the reviewer can check: \`"rulesVersionReason": "..."\`` });
  const ids = new Set([...(spec.carried || []).map((entry) => String(entry.id)), ...[...(spec.slides || []), ...(spec.appendix || [])].map((slide) => String(slide.id))]);
  for (const item of excusedPages(spec)) { const unknown = item.only.filter((id) => !ids.has(id) || id === item.page);
    if (unknown.length) findings.push({ code: registered(REVISION_CODES, "REVISION_CARRY_INVALID"), severity: "blocker", id: item.page,
      repair: `${item.page}: \`only\` names the other pages of this deck whose same ${item.old ? "words" : "figure"} are a different thing, by id; ${unknown.map((id) => `"${id}"`).join(", ")} ${unknown.length === 1 ? "is" : "are"} not ${unknown.includes(item.page) ? "another page" : "a page"} of it` }); }
  return findings;
}

/** The statement in a sentence a run prints first: what the revision is judged on, and what it is not. */
export function revisionLine(statement) {
  if (!statement) return null;
  const { carried, edited, composed, dropped } = statement, some = (list) => (list.length <= 12 ? ` (${list.join(", ")})` : "");
  const parts = [carried || edited.length ? `${carried} carried as ${carried === 1 ? "it is" : "they are"}` : null, edited.length ? `${edited.length} edited in place${some(edited)}` : null,
    composed.length ? `${composed.length} page${composed.length === 1 ? "" : "s"} composed by the runtime${some(composed)}` : null, dropped.length ? `${dropped.length} dropped${some(dropped)}` : null].filter(Boolean);
  const held = carried || edited.length
    ? `A carried slide is copied from the source deck unchanged and is not judged; a page the runtime composes is the revision's own and is held to every page rule. ${statement.deckRules ?? ""}`.trim()
    : "Every slide is recomposed, so every page is held to the rules as a new deck's is; a slide to keep as it is takes `carry: true` beside its `draft`.";
  const excused = (statement.excused || []).length ? ` Left standing on purpose (\`only\`), for the reviewer to check: ${statement.excused.map((item) => `${item.page}${item.old ? ` "${item.old}"` : ""} not looked for on ${item.only.join(", ")}`).join("; ")}.` : "";
  const lowered = statement.lowered ? ` Held to rules version ${statement.lowered.recorded}, below the ${statement.lowered.stamped} its import stamped${statement.lowered.reason ? `: "${statement.lowered.reason}"` : ""}.` : "";
  return `Revision of ${statement.source ?? "the imported deck"} (${statement.slides} slide${statement.slides === 1 ? "" : "s"}): ${parts.join("; ") || "nothing mapped yet"}. ${held}${excused}${lowered}`;
}

/**
 * Every change a built revision made to the user's deck, a line each, for
 * the delivery record: each edit as the assembler made it - the old words,
 * the new, and how many places - each page the runtime composed, and each
 * slide cut with the parts that left the file with it. `revision` is the
 * build's record (`revision` in build-result.json), `spec` the compiled deck.
 * The user asked for some of these; listed in full, they can see any they did
 * not ask for.
 */
export function changesMade(revision, spec) {
  if (!revision) return [];
  const idOf = new Map((revision.order || []).filter((item) => item.carried).map((item) => [item.carried, item.id]));
  const stands = new Map([...(spec?.slides || []), ...(spec?.appendix || [])].map((slide) => [String(slide.id), slide.pageType?.sourceSlide]));
  const lines = [];
  for (const edit of revision.edits || []) for (const change of edit.changes || []) {
    const where = `slide ${edit.slide} (${idOf.get(edit.slide) ?? "?"})`;
    if (change.title !== undefined) lines.push({ page: idOf.get(edit.slide) ?? null, slide: edit.slide, kind: "retitled", text: `${where}: title set to "${change.title}"` });
    else if (change.old !== undefined) lines.push({ page: idOf.get(edit.slide) ?? null, slide: edit.slide, kind: "replaced", old: change.old, new: change.new, count: change.count,
      text: `${where}: "${change.old}" replaced by "${change.new}"${change.count > 1 ? `, in ${change.count} places` : ""}${edit.notes ? " (its speaker notes among them, where they printed it)" : ""}` });
    else if (change.hidden !== undefined) lines.push({ page: idOf.get(edit.slide) ?? null, slide: edit.slide, kind: change.hidden ? "hidden" : "shown", text: `${where}: ${change.hidden ? "hidden from" : "put back into"} the slide show` });
  }
  for (const item of (revision.order || []).filter((entry) => entry.composed)) { const from = stands.get(String(item.id));
    lines.push({ page: item.id, slide: from ?? null, kind: from === undefined ? "added" : "redrawn", text: from === undefined ? `page ${item.id}: added, composed by the runtime` : `slide ${from} (${item.id}): redrawn - composed by the runtime in the slide's place` }); }
  for (const index of revision.dropped || []) lines.push({ page: null, slide: index, kind: "removed", text: `slide ${index}: removed` });
  if ((revision.removed || []).length) lines.push({ page: null, slide: null, kind: "parts", parts: revision.removed, text: `${revision.removed.length} part${revision.removed.length === 1 ? "" : "s"} only the removed slide${(revision.dropped || []).length === 1 ? "" : "s"} drew on left the file with ${(revision.dropped || []).length === 1 ? "it" : "them"}: ${revision.removed.join(", ")}` });
  return lines;
}

// --- what a composed page keeps from the slide it stands for -----------------
// On a page composed where a slide stood, what the slide already had and the revision did not change is the user's: its
// title, its source line. It is carried into the page, advised on and never refused. What the revision wrote is the
// revision's, and held in full. So each is checked against the inventory here, once, at the compile, and recorded on the
// compiled page (`pageType.kept`), where the one decision on what a deck is held to reads it (weight.mjs notHeldOn,
// weight.json rules.kept): a title is kept where it is the slide's own word for word; a typed source line where it is a
// source line the slide printed, over numbers every one of which the slide already showed.
const sourceLine = (text) => normalTitle(text).replace(/^(?:sources?|notes?)\s*:\s*/i, "").replace(/[.\s]+$/, "").toLowerCase();
// The keys of an exhibit that set how it is drawn, whose numbers are not numbers it shows.
const DRAWING_KEYS = new Set(["basis", "pageType", "id", "type", "decimals", "max", "min", "step", "width", "height", "size", "gap", "fontSize", "ratio", "span", "weight", "level", "levels", "columnsWidth", "rowHeight"]);
const NUMERAL = /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*/gu;
const numerals = (text) => (String(text ?? "").match(NUMERAL) || []).map((raw) => Number(raw.replace(/,(?=\d{3}(?!\d))/g, ""))).filter(Number.isFinite);
function shownNumbers(value, out = []) {
  if (typeof value === "number" && Number.isFinite(value)) out.push(Math.abs(value));
  else if (typeof value === "string") out.push(...numerals(value));
  else if (Array.isArray(value)) for (const item of value) shownNumbers(item, out);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) if (!DRAWING_KEYS.has(key)) shownNumbers(item, out);
  return out;
}
/**
 * What a compiled page keeps of the slide it stands for (`slide`, from the
 * inventory): `{ title, source }`, each true where it is the slide's own,
 * unchanged. Null for a page that stands for no slide.
 */
function keptFromSlide(page, slide) {
  if (!slide) return null;
  const title = Boolean(slide.title) && normalTitle(page.title ?? page.text) === normalTitle(slide.title);
  const lines = (slide.paragraphs || []).filter((p) => p.role === "source").map((p) => sourceLine(p.text));
  // The line is typed (a citation written from the registry carries its `sourceForms`), and it is one the slide printed.
  const typed = typeof page.source === "string" && !page.sourceForms && lines.includes(sourceLine(page.source));
  const before = new Set(shownNumbers([slide.paragraphs?.map((p) => p.text), slide.tables?.map((t) => t?.cells), slide.charts?.map((c) => [c?.categories, c?.series?.map((s) => s?.values)])]));
  const now = shownNumbers([page.exhibit, page.exhibits, page.metrics, page.kpi, page.items, page.rows, page.blocks]);
  return { title, source: typed && now.every((n) => before.has(n)) };
}
/**
 * What a page composed where a slide stood is held to and may keep, for the
 * scaffold of that page to print (`limits.revision`): the slide's own title
 * and source line, which it may keep word for word; what the slide holds to
 * redraw from; when the page stages a critique; and the least evidence a page
 * that draws numbers owes the critic - one insight record, written out with
 * the slide's own values where it has a chart.
 */
export function composedPageLimits(slide, inventoryName) {
  if (!slide) return null;
  const lines = (slide.paragraphs || []).filter((p) => !FURNITURE.has(p.role));
  const own = lines.find((p) => p.role === "source")?.text ?? null, chart = (slide.charts || [])[0] ?? null;
  const values = chart?.series?.[0]?.values ?? [], members = chart?.categories ?? [];
  return {
    held: "Every page rule holds on this page in full: it is the revision's own. A rule that measures the deck is read over the pages the revision composes and is not held while they are fewer than a deck rule reads from - the compile's first line says which.",
    keeps: { title: slide.title ?? null, source: own,
      rule: "The slide's own title, kept word for word, is the user's: it is advised on and never refused as a label. The slide's own source line, kept as typed over numbers the slide already showed, likewise. A title or a source line you write instead is yours, and is held as on a new deck." },
    slide: { title: slide.title ?? null, lines: lines.filter((p) => p.role !== "source").map((p) => p.text), charts: (slide.charts || []).map((c) => ({ type: c.type, categories: c.categories, series: c.series })), tables: (slide.tables || []).map((t) => t.cells) },
    critique: "None while the page shows what the slide showed - the slide's title over evidence every number of which the slide already held. A new title, or other figures in the exhibit, is the revision's own argument: storyline.mjs then stages a critique of this page. New or reworded commentary is read by the deck review.",
    stale: "A number this page changes that another slide still states is refused (NUMBER_STALE) until it is changed there too, or that slide is named in `only` on this page as stating another thing.",
    evidence: { rule: "A page that draws numbers is read by the critic for what it rests on. The least it needs is one record in <id>.insights.json, named in the page's `evidence`, with the exhibit written from its measure (`series: [{ measure }]`) and the claim's measures in `settles.measures`. A user's own slide is a source: cite the inventory.",
      record: { id: "i-<what it measures>", finding: "<what the numbers say, in a sentence>", shape: "<series | peer-set | mix | measure-pair | bridge | fact>", breadth: "<{ parts: n } for a mix, { members: n } for a peer set, { periods: n, series: n } for a series>",
        calculation: `as charted on slide ${slide.index} of the source deck`, measures: { "<name>": { unit: "<unit>", population: "<of what>", period: "<when>", members: members.length ? members : ["<member>", "..."], values: values.length ? values : ["<number>", "..."] } },
        sources: [inventoryName], soWhat: "<why it matters to what the user asked>", strength: "strong" } },
  };
}

/**
 * Record on each page a revision composed where a slide stood what it keeps
 * of that slide (`pageType.kept`), checked against the inventory, and on each
 * carried slide the title its edits leave it (`retitled`) where a `replace`
 * rewrote it. Written only where there is something to record, so a new
 * deck's record is as it was.
 */
export function stampKept(spec, inventory) {
  if (spec?.workflow !== REVISION || !Array.isArray(inventory?.slides)) return spec;
  const slides = new Map(inventory.slides.map((slide) => [slide.index, slide]));
  // A carried slide's title as the revision's edits leave it, where that is not the slide's own: what the critique is bound to
  // and shown, whichever key wrote it (storyline.mjs storyStructure).
  for (const entry of spec.carried || []) { const { retitled } = carriedChanges(entry, slides.get(entry.sourceSlide)); if (retitled !== undefined && retitled !== normalTitle(entry.title)) entry.retitled = retitled; else delete entry.retitled; }
  for (const page of [...(spec.slides || []), ...(spec.appendix || [])]) {
    if (!page?.pageType || page.pageType.sourceSlide === undefined) continue;
    const kept = keptFromSlide(page, slides.get(page.pageType.sourceSlide));
    if (kept && (kept.title || kept.source)) page.pageType.kept = { ...(kept.title ? { title: true } : {}), ...(kept.source ? { source: true } : {}) };
  }
  return spec;
}

/**
 * The pictures the user's own deck embedded are the user's to show: a page
 * that draws one the import extracted takes its credit from the source deck,
 * so the author is not asked to source the user's own picture.
 */
export function withImportedCredits(doc, inventory) {
  const files = new Set((inventory?.slides || []).flatMap((slide) => (slide.pictures || []).map((picture) => picture?.file).filter(Boolean)));
  if (!files.size) return doc;
  const credit = `From ${inventory.source?.file ?? "the imported deck"}`;
  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    const out = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    return typeof out.path === "string" && files.has(out.path) && out.credit === undefined ? { ...out, credit } : out;
  };
  return { ...doc, pages: walk(doc.pages), ...(doc.appendix ? { appendix: walk(doc.appendix) } : {}) };
}
