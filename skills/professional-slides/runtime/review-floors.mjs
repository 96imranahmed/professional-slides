// The floors a repair must stay inside, as the reviewer is shown them.
//
// A reviewer reads the rendered page and asks for a repair. The build holds
// the same page to measured bars - a floor and a ceiling on its words for the
// reading task it does, a band on the words a block across the prose pages, a
// cap on the footer's share of its text, and the deck's structure rules, some
// of them at their bar. A reviewer who cannot see those asks for what a gate
// then refuses: shorter commentary on pages the fragmentation gate needs
// longer, one more table in a deck at its table cap. So every deck-review
// packet carries, per page it reads, the standings that constrain a repair,
// and the prompt prints them.
//
// Nothing here is a threshold of this module's own. Every number is read from
// what the build wrote into the output directory: the scene (each page's
// reading task and the word floor and ceiling composed for it), the density
// profile (the page's measured words and blocks, the band on words a block and
// the standing of the gate that holds it), and the gate reports' standings
// (each deck rule's value, bar and room). The footer's share is counted from
// the scene with the gate's own bands (derive-content.mjs pageBandsOf) against
// the bar that module shares with the gate.
import path from "node:path";
import { readJson } from "./cli.mjs";
import { NOTE_SHARE_MAX, pageBandsOf } from "./derive-content.mjs";
import { standingLine, standingRoom } from "./gates/gate_classes.mjs";
import { deckLimits } from "./limits.mjs";
import { sectionTitleRoom } from "./spine-fit.mjs";
import { titleWords } from "./page-types.mjs";

// The gate reports of a build that carry standings, in the order they are read; a rule two of them report is taken from the first.
const STANDING_REPORTS = ["gates.json", "preflight-gates.json", "content-gates.json", "density-profile.json"];
// A rule whose room is gone or going: one more page of its kind breaks it, or it is already broken. A repair must not spend that room.
const TIGHT = new Set(["at", "over", "short"]);
const round = (value, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

/**
 * What a title is held to, for a judge that proposes one: a page title's
 * words and lines (the published limits, limits.mjs), and - where the deck
 * has section dividers - the words a section title of this deck holds as the
 * composer measures it under the deck's own design (spine-fit.mjs
 * sectionTitleRoom; the house default's divider where the deck does not
 * compose). Both judges are shown these and held to them: the storyline
 * critic in its packet, the deck reviewer among its floors.
 */
export function titleLimits(spec, base) {
  const sections = [...(spec?.slides || [])].some((slide) => slide?.kind === "section");
  let room = null;
  if (sections) try { room = sectionTitleRoom(spec, base); } catch { room = null; }
  const limits = deckLimits(room ? { sectionTitle: room } : {});
  return { title: { words: { min: limits.title.words.min, max: limits.title.words.max, target: limits.title.words.target }, lines: limits.title.lines.max },
    // `sure` is what the dividers hold of a title's longer words; `words` the most they hold, of short ones.
    ...(sections ? { sectionTitle: { words: limits.sectionTitle.words.max, lines: limits.sectionTitle.lines.max,
      ...(limits.sectionTitle.whateverTheWords ? { sure: limits.sectionTitle.whateverTheWords.words.max, characters: limits.sectionTitle.characters.max } : {}) } } : {}) };
}

/** The title limits in a sentence, as either prompt prints them. */
export const titleLimitsLine = (limits) => (limits ? `a page title runs to ${limits.title.words.min}-${limits.title.words.max} words (${limits.title.words.target} the norm) on ${limits.title.lines} lines at most${limits.sectionTitle ? `; a section title ${limits.sectionTitle.sure !== undefined && limits.sectionTitle.sure < limits.sectionTitle.words
  ? `fits this deck's dividers at ${limits.sectionTitle.sure} words or fewer, never past ${limits.sectionTitle.words}, and between them only where its words are short (${limits.sectionTitle.characters} characters of short words fit)`
  : `to ${limits.sectionTitle.words} words at most on this deck's dividers`}` : ""}` : "");

// What a judge's repair does to a title, said as fields rather than read out
// of its sentence: one entry for each page whose title the repair rewrites -
// the page (a divider's id, for a section's title), and the title the judge
// proposes or the length in words it asks for, or both. The deck reviewer
// gives it on a finding (reviewer.mjs), the storyline critic on an item
// (storyline.mjs), and the build holds both to the title limits (titleErrors).
export const RETITLE_SCHEMA = {
  type: "array", minItems: 1,
  items: { type: "object", additionalProperties: false, required: ["page"], properties: {
    page: { type: "string" },
    title: { type: "string", minLength: 2 },
    // The length asked for, in words: the same number twice for one length.
    words: { type: "object", additionalProperties: false, required: ["min", "max"], properties: { min: { type: "integer", minimum: 1 }, max: { type: "integer", minimum: 1 } } },
  } },
};
const isCount = (value) => Number.isInteger(value) && value >= 1;
/** A `retitle` as the author reads it beside the repair: each page with the title proposed and the length asked for. */
export const retitleLine = (retitle) => (Array.isArray(retitle) ? retitle : []).filter((entry) => entry && typeof entry.page === "string")
  .map((entry) => `${entry.page}: ${[typeof entry.title === "string" ? `"${entry.title.trim()}"` : null, entry.words ? `${entry.words.min === entry.words.max ? entry.words.min : `${entry.words.min}-${entry.words.max}`} words` : null].filter(Boolean).join(", ")}`).join("; ");

/**
 * `retitle` held to its form, as errors: a list of entries, each naming one
 * of `pages` (the finding's own) once, and saying a title, a length or both.
 * What holds without the title limits; titleErrors holds those.
 */
export function retitleErrors(retitle, pages, at) {
  if (retitle === undefined) return [];
  if (!Array.isArray(retitle) || !retitle.length) return [`${at}: retitle lists the pages whose title the repair rewrites, one entry a page - leave it out where the repair rewrites none`];
  const errors = [], own = Array.isArray(pages) ? pages : [], seen = new Set();
  for (const [i, entry] of retitle.entries()) {
    const where = `${at}: retitle[${i}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) { errors.push(`${where} is not an object: an entry is { page, title, words }`); continue; }
    const extra = Object.keys(entry).filter((key) => !Object.hasOwn(RETITLE_SCHEMA.items.properties, key));
    if (extra.length) errors.push(`${where} carries ${extra.join(", ")}: an entry takes page, title and words only`);
    if (typeof entry.page !== "string" || !own.includes(entry.page)) errors.push(`${where} names ${typeof entry.page === "string" ? `page ${entry.page}` : "no page"}: its page is one of the finding's own (${own.join(", ") || "none listed"})`);
    else if (seen.has(entry.page)) errors.push(`${where} names ${entry.page} again: one entry a page`);
    seen.add(entry.page);
    if (entry.title !== undefined && (typeof entry.title !== "string" || entry.title.trim().length < 2)) errors.push(`${where}: its title is the title proposed, as it would be printed`);
    const { words } = entry;
    if (words !== undefined && (!words || typeof words !== "object" || !isCount(words.min) || !isCount(words.max) || words.min > words.max))
      errors.push(`${where}: its words are the length asked for, { min, max } in whole words with min no more than max (the same number twice for one length)`);
    if (entry.title === undefined && words === undefined) errors.push(`${where} gives neither the title proposed nor a length: give its title, its words or both, or leave the page out`);
  }
  return errors;
}

// What a repair asks of a page's body, said as fields rather than read out of
// its sentence: one entry for each page whose body the repair takes to a
// stated length - the body words it asks for, the words a block, or both, as
// { min, max } ranges. The deck reviewer gives it on a finding (reviewer.mjs),
// and floorErrors holds it to the floors the packet shows for the page. A
// repair that states no length ("halve the commentary") has nothing here, and
// is held by the prompt and by the gate when the page is rebuilt.
const RANGE_SCHEMA = { type: "object", additionalProperties: false, required: ["min", "max"], properties: { min: { type: "integer", minimum: 1 }, max: { type: "integer", minimum: 1 } } };
export const RESIZE_SCHEMA = {
  type: "array", minItems: 1,
  items: { type: "object", additionalProperties: false, required: ["page"], properties: {
    page: { type: "string" },
    // The page's body words the repair asks for: the same number twice for one length.
    words: RANGE_SCHEMA,
    // The words a block it asks for, on a page of prose blocks.
    wordsPerBlock: RANGE_SCHEMA,
  } },
};
const span = (range) => (range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`);
const isRange = (range) => Boolean(range) && typeof range === "object" && isCount(range.min) && isCount(range.max) && range.min <= range.max;
/** A `resize` as the author reads it beside the repair: each page with the length asked for. */
export const resizeLine = (resize) => (Array.isArray(resize) ? resize : []).filter((entry) => entry && typeof entry.page === "string")
  .map((entry) => `${entry.page}: ${[isRange(entry.words) ? `${span(entry.words)} body words` : null, isRange(entry.wordsPerBlock) ? `${span(entry.wordsPerBlock)} words a block` : null].filter(Boolean).join(", ")}`).join("; ");

/**
 * `resize` held to its form, as errors: a list of entries, each naming one of
 * `pages` (the finding's own) once, and giving body words, words a block or
 * both. What holds without the floors; floorErrors holds those.
 */
export function resizeErrors(resize, pages, at) {
  if (resize === undefined) return [];
  if (!Array.isArray(resize) || !resize.length) return [`${at}: resize lists the pages whose body the repair takes to a stated length, one entry a page - leave it out where the repair states no length`];
  const errors = [], own = Array.isArray(pages) ? pages : [], seen = new Set();
  for (const [i, entry] of resize.entries()) {
    const where = `${at}: resize[${i}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) { errors.push(`${where} is not an object: an entry is { page, words, wordsPerBlock }`); continue; }
    const extra = Object.keys(entry).filter((key) => !Object.hasOwn(RESIZE_SCHEMA.items.properties, key));
    if (extra.length) errors.push(`${where} carries ${extra.join(", ")}: an entry takes page, words and wordsPerBlock only`);
    if (typeof entry.page !== "string" || !own.includes(entry.page)) errors.push(`${where} names ${typeof entry.page === "string" ? `page ${entry.page}` : "no page"}: its page is one of the finding's own (${own.join(", ") || "none listed"})`);
    else if (seen.has(entry.page)) errors.push(`${where} names ${entry.page} again: one entry a page`);
    seen.add(entry.page);
    for (const key of ["words", "wordsPerBlock"]) if (entry[key] !== undefined && !isRange(entry[key]))
      errors.push(`${where}: its ${key} is the length asked for, { min, max } in whole words with min no more than max (the same number twice for one length)`);
    if (entry.words === undefined && entry.wordsPerBlock === undefined) errors.push(`${where} gives no length: give its words, its wordsPerBlock or both, or leave the page out`);
  }
  return errors;
}

const shown = (title) => (title.length > 70 ? `${title.slice(0, 67)}...` : title);

/**
 * A title a judge proposes that the build would refuse, as errors: `retitle`
 * is a finding's or an item's (RETITLE_SCHEMA), `at` where it stands. Each
 * entry's title, and the length it asks for, are held to the page title's
 * words, or to the section title's where its page is one of `dividers`.
 * `sectionFits(title, ids)` composes a proposed section title on its divider,
 * where the caller has the deck to compose it in. An entry malformed is
 * retitleErrors' to refuse, and is passed over here.
 */
export function titleErrors(retitle, limits, at, { dividers = [], sectionFits = null } = {}) {
  if (!limits || !Array.isArray(retitle)) return [];
  const errors = [];
  for (const entry of retitle) {
    if (!entry || typeof entry !== "object" || typeof entry.page !== "string") continue;
    const section = Boolean(limits.sectionTitle) && dividers.includes(entry.page);
    const { max, what, rule } = section ? { max: limits.sectionTitle.words, what: "a section title", rule: "the words its divider holds" } : { max: limits.title.words.max, what: "a page title", rule: "TITLE_WORDS" };
    const proposed = typeof entry.title === "string" ? entry.title.trim() : "";
    if (proposed) {
      const words = titleWords(proposed);
      if (words > max) errors.push(`${at}: the title it proposes for ${entry.page} runs to ${words} words ("${shown(proposed)}") and the build refuses ${what} past ${max} (${rule}): propose one of ${max} words or fewer - the finding and its comparator, with the period, the population and the scope left to the subtitle`);
      // A section title within the most its divider holds is composed on the divider where the caller can (`sectionFits`): a count
      // of words bounds what fits and does not decide it.
      else if (section && sectionFits && sectionFits(proposed, [entry.page]) === false)
        errors.push(`${at}: the section title it proposes for ${entry.page} ("${shown(proposed)}", ${words} words, ${proposed.length} characters) does not fit its divider as this deck draws it (SPINE_UNFIT): its words are long for the room${limits.sectionTitle.sure !== undefined ? ` - ${limits.sectionTitle.sure} words or fewer always fit` : ""}; propose a shorter one, with the detail left to the section's summary`);
    }
    const { words } = entry;
    if (words && isCount(words.min) && words.min > max) errors.push(`${at}: it asks for a title of ${isCount(words.max) && words.max > words.min ? `${words.min}-${words.max}` : words.min} words on ${entry.page} and the build refuses ${what} past ${max} (${rule}): ask for ${max} words or fewer`);
  }
  return errors;
}

/**
 * The floors of a built deck: `{ deck, pages, band }`. `deck` is one line for
 * every deck rule at or past its bar (gate_classes.mjs standingLine), and
 * always the two sides of the words-a-block band. `pages` maps a page id to
 * what holds that page: `words` { now, floor, ceiling, task }, `blocks`
 * { count, wordsPerBlock, prose } (`prose` where the page is one the
 * words-a-block band is measured over), `footer` { share, max } and `rules`,
 * the tight deck rules the page counts toward. A deck not rendered has no
 * profile, and its pages carry what the scene alone says. With the deck
 * (`spec`, and `base`, the folder its assets resolve against), `titles` holds
 * what a title is held to (titleLimits) and `dividers` the section pages.
 */
export async function reviewFloors(directory, scene, { spec = null, base = null } = {}) {
  const dir = path.resolve(directory);
  const reports = await Promise.all(STANDING_REPORTS.map((file) => readJson(path.join(dir, file), { optional: true })));
  const profile = reports[STANDING_REPORTS.indexOf("density-profile.json")];
  const ids = scene.slides.map((slide) => slide.id);
  // A gate report names a page by its number; the profile by its id.
  const named = (key) => (ids.includes(String(key)) ? String(key) : ids[Number(key) - 1] ?? null);
  const seen = new Set(), standings = [];
  for (const report of reports) for (const standing of report?.standings || []) {
    const key = `${standing.code}.${standing.key ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    standings.push(standing);
  }
  const fragmented = standings.filter((standing) => standing.code === "TEXT_FRAGMENTED");
  const tight = standings.filter((standing) => standing.applies !== false && (TIGHT.has(standingRoom(standing).state) || standing.code === "TEXT_FRAGMENTED"));
  const countsToward = (standing, id) => (standing.pages || []).map(named).includes(id) || Object.keys(standing.each || {}).map(named).includes(id);
  const measured = new Map((profile?.pages || []).map((page) => [page.id, page]));
  const prose = new Set(fragmented.flatMap((standing) => Object.keys(standing.each || {}).map(named)));
  const pages = Object.fromEntries(scene.slides.filter((slide) => slide.wordFloor !== undefined || measured.has(slide.id)).map((slide) => {
    const page = measured.get(slide.id), bands = pageBandsOf(slide);
    return [slide.id, {
      words: { now: page?.bodyWords ?? bands.body, floor: slide.wordFloor ?? null, ceiling: slide.wordCeiling ?? null, task: slide.readingTask ?? page?.task ?? null },
      ...(page?.blocks ? { blocks: { count: page.blocks, wordsPerBlock: page.wordsPerBlock, prose: prose.has(slide.id) } } : {}),
      ...(bands.body && bands.footer ? { footer: { share: round(bands.footer / (bands.body + bands.footer), 2), max: NOTE_SHARE_MAX } } : {}),
      rules: tight.filter((standing) => standing.code !== "TEXT_FRAGMENTED" && countsToward(standing, slide.id)).map((standing) => `${standing.code}${standing.key ? `.${standing.key}` : ""}`),
    }];
  }));
  const band = profile?.deck?.wordsPerBlock?.band ?? null;
  // The title limits, where the caller has the deck: a divider is known by the deck's own page list.
  const titles = spec ? { titles: titleLimits(spec, base ?? dir), dividers: (spec.slides || []).filter((slide) => slide?.kind === "section").map((slide) => String(slide.id)) } : {};
  return { deck: tight.map((standing) => standingLine(standing)), pages, band, median: fragmented[0]?.value ?? null, ...titles };
}

const pageLine = (id, page, floors) => {
  const { words, blocks, footer, rules } = page;
  const held = words.floor !== null && words.ceiling !== null ? `held to ${words.floor}-${words.ceiling}` : "no word band composed";
  const inBlocks = blocks ? `; ${blocks.count} blocks at ${blocks.wordsPerBlock} words a block${blocks.prose && floors.band ? ` (a prose page: counts toward the deck's ${floors.band[0]}-${floors.band[1]} band)` : ""}` : "";
  return `- ${id}: ${words.now} body words, ${held}${words.task ? ` (${words.task})` : ""}${inBlocks}${footer ? `; footer ${Math.round(footer.share * 100)}% of the page's text, at most ${Math.round(footer.max * 100)}%` : ""}${rules.length ? `; counts toward ${rules.join(", ")}` : ""}`;
};

/**
 * The floors as a reviewer reads them: the deck rules with no room left, then
 * a line for each page of `only` (every page when null). The reviewer is told
 * what the numbers are for: a repair is not asked past one of them.
 */
export function floorsPrompt(floors, only = null) {
  if (!floors) return "";
  const listed = Object.entries(floors.pages).filter(([id]) => !only || only.includes(id));
  return `FLOORS THE BUILD HOLDS. The build measured these on the pages you are reading and refuses a page, or the deck, on the wrong side of one. They are not findings and not targets: they bound what a repair may ask for. Do not ask for fewer words than a page's floor or more than its ceiling, for blocks shorter or longer than the words-a-block band on a prose page, for a longer note where the footer is at its share, or for one more page of a kind a deck rule below has no room for. Where the right repair moves a page toward one of these - commentary cut, a point split, a table added - say in the finding's \`floors\` how the page stays inside it (the words that replace the ones cut, the form the page takes instead). A length you ask of a page's body goes in the finding's \`resize\` - its body words, its words a block, or both - and validation refuses one outside the page's band that says nothing in \`floors\`.
${floors.titles ? `Titles: ${titleLimitsLine(floors.titles)}. A title a finding proposes in \`retitle\`, or a length it asks for there, stays inside these; validation refuses one that does not.\n` : ""}Deck rules with no room left${floors.median !== null && floors.band ? ` (the prose pages' median is ${floors.median} words a block, held to ${floors.band[0]}-${floors.band[1]})` : ""}:
${floors.deck.map((line) => `- ${line}`).join("\n") || "- none"}
Per page (body words now and the band the build holds them to for the page's reading task; blocks; the footer's share):
${listed.map(([id, page]) => pageLine(id, page, floors)).join("\n") || "- none measured"}`;
}

/**
 * A length a repair asks for that the build refuses, as errors. Where a
 * finding's `resize` asks for body words wholly outside the band the packet
 * shows for that page, or - on a prose page - words a block outside the
 * deck's band, the finding must say in `floors` how the page stays inside it.
 * Only the fields are read, never the repair's sentence: a length the
 * reviewer leaves in the sentence is held by the prompt, and by the gate when
 * the page is rebuilt. A title a finding proposes or sizes in `retitle` is
 * held to the title limits (titleErrors) on any finding, and `floors` does not
 * excuse it.
 */
export function floorErrors(findings, floors) {
  if (!floors) return [];
  const errors = [];
  for (const [i, finding] of (findings || []).entries()) {
    const at = `findings[${i}]${finding?.id ? ` (${finding.id})` : ""}`;
    // A title has no way to stay inside its limit but to be shorter: `floors` does not excuse it.
    if (floors.titles) errors.push(...titleErrors(finding?.retitle, floors.titles, at, { dividers: floors.dividers || [] }));
    if (!Array.isArray(finding?.resize) || (typeof finding.floors === "string" && finding.floors.trim().length >= 20)) continue;
    for (const entry of finding.resize) {
      const page = entry && typeof entry.page === "string" ? floors.pages[entry.page] : null;
      if (!page) continue;
      const { floor, ceiling } = page.words;
      if (isRange(entry.words) && floor !== null && ceiling !== null && (entry.words.max < floor || entry.words.min > ceiling))
        errors.push(`${at}: the repair asks for ${span(entry.words)} words on ${entry.page}, and the build holds that page to ${floor}-${ceiling} body words (it carries ${page.words.now}): ask for a length inside the band, or say in \`floors\` how the page stays inside it - what replaces the words cut, or the form the page takes instead`);
      if (isRange(entry.wordsPerBlock) && page.blocks?.prose && floors.band && (entry.wordsPerBlock.max < floors.band[0] || entry.wordsPerBlock.min > floors.band[1]))
        errors.push(`${at}: the repair asks for ${span(entry.wordsPerBlock)} words a block on ${entry.page}, a prose page, and the build holds the prose pages' median to ${floors.band[0]}-${floors.band[1]} words a block: ask for blocks inside the band, or say in \`floors\` how the deck stays inside it`);
    }
  }
  return errors;
}
