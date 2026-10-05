// What the storyline critique binds is proven layable before the critique.
//
// The critique is bound to every title - a page's, a section's - so a title
// that turns out not to fit its place after the critique is `ready` costs a
// pass: shortening it is a changed argument. Whether a title fits does not
// wait on the page's content: the divider, the contents page, the cover and
// each page's title band are set by the deck's design, its variation, its
// tracker and its sections, all of which a spine already has. So every run -
// a draft and a plan among them - composes those, under the deck's own
// settings, and refuses what does not fit with the room it has, measured by
// the composer that will draw it.
//
// A page is probed by its title band over a neutral body: the page's own
// exhibit and copy are the layout's, and are composed by the full compile.
import { composeAll } from "./compose-all.mjs";
import { registered } from "./errors.mjs";
import { TEXT_LIMITS } from "./page-types.mjs";
import { textWords } from "./text-contract.mjs";

export const SPINE_FIT_CODES = Object.freeze({
  SPINE_UNFIT: "a title the storyline critique is bound to - a page's, a section's, on its divider, the contents page or the tracker - or the cover's, does not fit where the deck's design sets it",
});

// A neutral body, long enough to be a paragraph and short enough to fit under any title band.
const BODY = "The page's exhibit and copy are written at the layout step, once the storyline critique is ready.";
// Ordinary prose, for the words a place holds when no title is written for it yet.
const PROSE = "the operator added capacity on the busiest routes before demand returned in full".split(" ");
const proseOf = (n) => Array.from({ length: n }, (_, i) => PROSE[i % PROSE.length]).join(" ");
// The words of a title: longer than prose, since a title drops the short words that pad a sentence. A line breaks between
// words, so long words fill a divider in fewer characters than short ones do.
const TITLE_PROSE = "Demand recovered because capacity returned before competitors rebuilt their regional networks".split(" ");
const titleProseOf = (n) => Array.from({ length: n }, (_, i) => TITLE_PROSE[i % TITLE_PROSE.length]).join(" ");
// The most words a divider is measured to: one that still takes this many has no limit to publish.
const MOST_WORDS = 40;

const isSection = (slide) => slide?.kind === "section" || slide?.kind === "divider";

/**
 * A slide as the spine probes it: a structural page as written; a typed page
 * as its title band - the title, its lead-in, its kicker and tag - over a
 * neutral body, or as the closing page its form draws; a statement page, whose
 * sentence is copy still to write, as a page that draws no title at all.
 */
function probeOf(slide) {
  if (!slide || typeof slide !== "object") return slide;
  if (slide.kind === "takeaways") return { id: slide.id, kind: "takeaways", title: slide.title, items: [BODY, BODY] };
  if (slide.kind === "statement") return { id: slide.id, kind: "statement", text: BODY };
  if (slide.kind) return slide;
  const band = Object.fromEntries(["id", "title", "titleLead", "kicker", "tag", "role"].filter((key) => slide[key] !== undefined).map((key) => [key, slide[key]]));
  return { ...band, paragraphs: [BODY] };
}

const pagesOf = (spec) => [...(spec.slides || []), ...(spec.appendix || [])];
const idOfMessage = (message) => String(message).match(/^(?:Cannot render )?([^:\s]+):/)?.[1];
const reasonOf = (message) => String(message).replace(/^(?:Cannot render )?[^:\s]+:[^:]*\([^)]*\):\s*/, "").replace(/^[^:\s]+(?: \("[^"]*"\))?:\s*/, "");

/** The action title a composed slide draws, or null. */
function actionTitle(node) {
  if (Array.isArray(node)) { for (const child of node) { const found = actionTitle(child); if (found) return found; } return null; }
  if (!node || typeof node !== "object") return null;
  if (node.role === "action-title" && node.data?.textLayout) return node;
  for (const value of Object.values(node)) if (value && typeof value === "object") { const found = actionTitle(value); if (found) return found; }
  return null;
}

/**
 * The probe deck composed: `errors`, the composer's refusals by page id (a
 * refusal that names no page under "" - the deck's), and `lines`, the lines
 * each analytical page's title sets in.
 */
function composeProbe(spec, baseDir) {
  const probe = { ...spec, slides: (spec.slides || []).map(probeOf), ...(spec.appendix ? { appendix: spec.appendix.map(probeOf) } : {}) };
  const errors = new Map(), lines = new Map();
  let composed = null;
  try { composed = composeAll(probe, baseDir, { partial: true }); }
  catch (error) { for (const message of error.pageErrors ?? [error.message]) errors.set(idOfMessage(message) ?? "", message); }
  for (const message of composed?.pageErrors ?? []) errors.set(idOfMessage(message) ?? "", message);
  for (const slide of composed?.deck?.slides ?? []) {
    const title = actionTitle(slide.nodes);
    if (title) lines.set(String(slide.sourceSlideId ?? slide.id), title.data.textLayout.lines.length);
  }
  return { errors, lines };
}

const firstWords = (text, n) => String(text).trim().split(/\s+/).slice(0, n).join(" ");
// The most words `fits` accepts, of `max`: what fits is taken to stay fitting when shortened.
function most(max, fits) {
  let lo = 0, hi = max;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid - 1; }
  return lo;
}

/**
 * The deck with only what a title's fit turns on beside `keep`: its sections,
 * and the pages `keep` names. An appendix stays an appendix - one neutral page
 * where none of its own is kept - since its divider is a row of the contents.
 */
function reduced(spec, keep = new Set()) {
  const wanted = (slide) => isSection(slide) || slide?.kind === "agenda" || keep.has(String(slide?.id));
  const appendix = (spec.appendix || []).filter(wanted);
  return { ...spec, slides: (spec.slides || []).filter(wanted), ...(spec.appendix?.length ? { appendix: appendix.length ? appendix : [{ id: "appendix-page", title: "Appendix", paragraphs: [BODY] }] } : {}) };
}
const retitled = (spec, change) => ({ ...spec, slides: (spec.slides || []).map(change), ...(spec.appendix ? { appendix: spec.appendix.map(change) } : {}) });

/**
 * Whether page `id` fits once its title is `title`, composed with the deck's
 * sections around it: no refusal names it, and an analytical page's title
 * keeps to its lines.
 */
function fitsAs(spec, id, title, baseDir) {
  const { errors, lines } = composeProbe(retitled(reduced(spec, new Set([id])), (slide) => (String(slide?.id) === id ? { ...slide, title } : slide)), baseDir);
  return !errors.has(id) && (lines.get(id) ?? 0) <= TEXT_LIMITS.titleLines;
}

const sized = (text) => ({ words: textWords(text), characters: String(text).trim().length });
const roomText = (room) => (room.words ? `its first ${room.words} word${room.words === 1 ? "" : "s"} (${room.characters} characters) fit` : "not even its first word fits");
const BOUND = "The storyline critique is bound to it, so shorten it now: changed after the critique is ready, it sends the spine back for another pass";

/**
 * Every title the critique binds that does not fit where this deck draws it,
 * and the cover: one finding a page, each with the room the place has
 * (`measured.fits`, in words and characters of the title as written), measured
 * by composing the page again with the title cut back. `spec` is the compiled
 * deck, a page that did not compile stood in for by its declared choices.
 */
export function spineFitFindings(spec, baseDir) {
  const { errors, lines } = composeProbe(spec, baseDir);
  const findings = [], pages = new Map(pagesOf(spec).map((slide) => [String(slide?.id), slide]));
  const finding = (id, measured, repair) => findings.push({ code: registered(SPINE_FIT_CODES, "SPINE_UNFIT"), id, severity: "blocker", measured, repair });
  const roomOf = (id, title) => { const n = most(Math.max(0, textWords(title) - 1), (k) => k > 0 && fitsAs(spec, id, firstWords(title, k), baseDir)); return sized(firstWords(title, n)); };
  const numbered = (spec.slides || []).filter(isSection).length >= 2;
  // A refusal no shortening of the page's own title lifts is not that title's: the contents page, the tracker's labels, the deck's settings.
  const beyond = new Map([...errors].filter(([id]) => !(pages.has(id) && String(pages.get(id)?.title ?? "").trim())));
  for (const [id, slide] of pages) {
    const title = String(slide?.title ?? "");
    const over = !errors.has(id) && (lines.get(id) ?? 0) > TEXT_LIMITS.titleLines;
    if (!title.trim() || !(errors.has(id) || over)) continue;
    const room = roomOf(id, title);
    if (!room.words && errors.has(id)) { if (![...beyond.values()].some((message) => reasonOf(message) === reasonOf(errors.get(id)))) beyond.set(id, errors.get(id)); continue; }
    if (isSection(slide)) finding(id, { title: sized(title), fits: room },
      `${id}: the section title "${title}" (${textWords(title)} words, ${title.trim().length} characters) does not fit its divider as this deck draws it${numbered ? " - numbered, with the deck's contents or its numeral beside the title" : ""}: ${roomText(room)}. ${BOUND}. Keep the section's verdict and move the rest to its \`summary\`, which the divider sets under the title and the critique is not bound to (\`--limits\` on the pages file prints what a divider of this deck holds)`);
    else if (over) finding(id, { title: sized(title), lines: lines.get(id), linesMax: TEXT_LIMITS.titleLines, fits: room },
      `${id}: the title sets in ${lines.get(id)} lines in this deck's title band and a title holds ${TEXT_LIMITS.titleLines} (the build's TITLE_LINES): ${roomText(room)}. ${BOUND}. Keep the finding and its comparator, and move the period, the population and the scope to \`subtitle\``);
    else finding(id, { title: sized(title), fits: room },
      `${id}: the title "${title}" does not fit where this deck's design sets it (${reasonOf(errors.get(id))}): ${roomText(room)}. ${BOUND}`);
  }
  // Each is a finding of this kind only where shorter text lifts it. A refusal that stands whatever the titles say - a setting
  // the deck names wrongly, a key the composer does not read - is the composition's to report, as it was.
  const sections = (spec.slides || []).filter(isSection);
  for (const [id, message] of beyond) {
    if (id === "cover") {
      const title = String(spec.cover?.title ?? "");
      const refused = (cover) => composeProbe({ ...reduced(spec), cover: { ...spec.cover, ...cover } }, baseDir).errors.has("cover");
      const room = sized(firstWords(title, most(Math.max(0, textWords(title) - 1), (k) => k > 0 && !refused({ title: firstWords(title, k) }))));
      // The title's room is measured with the subtitle as written; where no title fits beside it, the subtitle is what is too long.
      if (!room.words && refused({ title: firstWords(title, 1), subtitle: "" })) continue;
      finding("cover", { title: sized(title), fits: room }, `cover: the cover's title and subtitle do not fit the cover as this deck draws it (${reasonOf(message)}): with the subtitle as written, ${room.words ? roomText(room).replace(/^its/, "the title's") : "no title fits - the subtitle is what runs long"}. Shorten the title, or the subtitle`);
      continue;
    }
    // What every section title would have to keep to for the page to compose: the same refusal, read as a limit on the titles it lists.
    const longest = Math.max(0, ...sections.map((slide) => textWords(slide.title)));
    const cut = (k) => retitled(reduced(spec, new Set(pages.has(id) ? [id] : [])), (slide) => (isSection(slide) ? { ...slide, title: firstWords(slide.title, k) } : slide));
    const each = most(Math.max(0, longest - 1), (k) => k > 0 && !composeProbe(cut(k), baseDir).errors.has(id));
    const over = sections.filter((slide) => textWords(slide.title) > each);
    if (!each || !over.length) continue;
    finding(id || "deck", { reason: reasonOf(message), sectionTitleWords: { max: each }, over: over.map((slide) => String(slide.id)) },
      `${id || "The deck"}: ${reasonOf(message)} - it composes once no section title runs past ${each} word${each === 1 ? "" : "s"}; over that: ${over.map((slide) => `${slide.id} (${textWords(slide.title)} words)`).join(", ")}. The storyline critique is bound to the section titles, so shorten them now, or choose the setting that holds them (another \`tracker\`, \`contents: false\`): changed after the critique is ready, a title sends the spine back for another pass`);
  }
  return findings;
}

/**
 * What a section title of this deck holds, by the composer's own measure
 * under the deck's design, variation, tracker and sections: the words of
 * ordinary prose - and their characters - that fit the tightest of its
 * dividers. A deck with no sections written yet is measured with three; null
 * where the deck does not compose at all, so there is no divider to measure.
 * `title` is the same measure taken with a title's longer words: what the
 * dividers hold whatever the words, where `words` is the most they hold of
 * short ones.
 */
export function sectionTitleRoom(specIn, baseDir) {
  const written = (specIn.slides || []).filter(isSection);
  const spec = reduced(written.length ? specIn : { ...specIn, slides: ["One", "Two", "Three"].map((title, at) => ({ id: `section-${at + 1}`, kind: "section", title })) });
  // Each divider measured with the others as written - they are the contents beside it - and the tightest taken.
  const refused = (id, title) => { const { errors } = composeProbe(retitled(spec, (slide) => (String(slide?.id) === id ? { ...slide, title } : slide)), baseDir); return errors.has(id) || errors.has(""); };
  const ids = spec.slides.filter(isSection).map((slide) => String(slide.id));
  // A deck that does not compose even with a word on each divider has no divider to measure: the caller keeps the house default.
  if (ids.some((id) => refused(id, proseOf(1)))) return null;
  const words = Math.min(...ids.map((id) => most(MOST_WORDS, (n) => n > 0 && !refused(id, proseOf(n)))));
  if (words >= MOST_WORDS) return null;
  // The same dividers measured with a title's longer words: what they hold of those, in words and characters. A limit given
  // to someone who will write a title is this one - nine words of prose fitted where eight words of a real title did not.
  const titled = Math.min(words, ...ids.map((id) => most(words, (n) => n > 0 && !refused(id, titleProseOf(n)))));
  return { words, characters: proseOf(words).length, title: { words: titled, characters: titleProseOf(titled).length } };
}

/**
 * Whether `title` fits the dividers of this deck as a section's title, by the
 * composer: on each divider `ids` names, or on every one where it names none.
 * What a title a judge proposes for a section is held to (review-floors.mjs
 * titleErrors) - the title itself, composed, where a count of words can only
 * bound it. Null where the deck has no divider to compose.
 */
export function sectionTitleFits(specIn, baseDir, title, ids = null) {
  const written = (specIn.slides || []).filter(isSection);
  if (!written.length) return null;
  const spec = reduced(specIn);
  const all = spec.slides.filter(isSection).map((slide) => String(slide.id));
  const named = (ids || []).map(String).filter((id) => all.includes(id));
  return (named.length ? named : all).every((id) => { const { errors } = composeProbe(retitled(spec, (slide) => (String(slide?.id) === id ? { ...slide, title } : slide)), baseDir); return !errors.has(id) && !errors.has(""); });
}
