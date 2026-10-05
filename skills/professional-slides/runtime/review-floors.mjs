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

// A title a repair proposes: the words in quotes after it says to retitle, or
// to rewrite or replace a title. A single quote closes only before punctuation
// or the end, so an apostrophe inside the title does not end it; a title cut
// short by that reads as shorter than it is, never longer.
const PROPOSED = /\b(retitle|(?:rewrite|reword|replace|change|shorten)\s+(?:the\s+|this\s+|its\s+)?((?:section\s+)?)title)\b([^'"“\u2018`]{0,80})(?:"([^"]{8,})"|“([^”]{8,})”|`([^`]{8,})`|['\u2018](.{8,}?)['\u2019](?=[.;,:)]|\s*$))/gi;
// A length a repair states for a title: "a title of 15 words", "the title to 14-16 words".
const TITLE_LENGTH = /\b((?:section\s+)?)title\b[^.;]{0,40}?\b(\d{1,3})(?:\s*(?:-|–|to)\s*(\d{1,3}))?\s+words\b/gi;

/**
 * A title a judge proposes that the build would refuse, as errors: `text` is
 * a repair or a fix, `at` where it stands. Only what the sentence states is
 * read - a title given in quotes after "retitle" or "rewrite the title", and
 * a length given in words - and each is held to the page title's words, or to
 * the section title's where the sentence says a section title (or `section`
 * says every page the finding names is a divider). `sectionFits(title)`
 * composes a proposed section title on its divider, where the caller has the
 * deck to compose it in.
 */
export function titleErrors(text, limits, at, { section = false, sectionFits = null } = {}) {
  if (!limits) return [];
  const errors = [], source = String(text ?? "");
  const bar = (said) => ((said || section) && limits.sectionTitle ? { max: limits.sectionTitle.words, what: "a section title", rule: "the words its divider holds" } : { max: limits.title.words.max, what: "a page title", rule: "TITLE_WORDS" });
  for (const match of source.matchAll(PROPOSED)) {
    // "Retitle the s2 divider" names a section as surely as "the section title" does.
    const { max, what, rule } = bar(match[2] || /\b(?:section|divider)\b/i.test(match[3]));
    const proposed = match[4] ?? match[5] ?? match[6] ?? match[7], words = titleWords(proposed);
    if (words > max) errors.push(`${at}: the title it proposes runs to ${words} words ("${proposed.length > 70 ? `${proposed.slice(0, 67)}...` : proposed}") and the build refuses ${what} past ${max} (${rule}): propose one of ${max} words or fewer - the finding and its comparator, with the period, the population and the scope left to the subtitle`);
    // A section title within the most its divider holds is composed on the divider where the caller can (`sectionFits`): a count
    // of words bounds what fits and does not decide it.
    else if (what === "a section title" && sectionFits && sectionFits(proposed) === false)
      errors.push(`${at}: the section title it proposes ("${proposed.length > 70 ? `${proposed.slice(0, 67)}...` : proposed}", ${words} words, ${proposed.length} characters) does not fit its divider as this deck draws it (SPINE_UNFIT): its words are long for the room${limits.sectionTitle.sure !== undefined ? ` - ${limits.sectionTitle.sure} words or fewer always fit` : ""}; propose a shorter one, with the detail left to the section's summary`);
  }
  for (const match of source.matchAll(TITLE_LENGTH)) {
    const { max, what, rule } = bar(match[1]);
    const low = Number(match[2]);
    if (low > max) errors.push(`${at}: it asks for a title of ${match[3] ? `${match[2]}-${match[3]}` : match[2]} words and the build refuses ${what} past ${max} (${rule}): ask for ${max} words or fewer`);
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
  return `FLOORS THE BUILD HOLDS. The build measured these on the pages you are reading and refuses a page, or the deck, on the wrong side of one. They are not findings and not targets: they bound what a repair may ask for. Do not ask for fewer words than a page's floor or more than its ceiling, for blocks shorter or longer than the words-a-block band on a prose page, for a longer note where the footer is at its share, or for one more page of a kind a deck rule below has no room for. Where the right repair moves a page toward one of these - commentary cut, a point split, a table added - say in the finding's \`floors\` how the page stays inside it (the words that replace the ones cut, the form the page takes instead); validation refuses a repair that states a word count outside the page's band and says nothing in \`floors\`.
${floors.titles ? `Titles: ${titleLimitsLine(floors.titles)}. A repair that proposes a title, or states a length for one, stays inside these; validation refuses one that does not.\n` : ""}Deck rules with no room left${floors.median !== null && floors.band ? ` (the prose pages' median is ${floors.median} words a block, held to ${floors.band[0]}-${floors.band[1]})` : ""}:
${floors.deck.map((line) => `- ${line}`).join("\n") || "- none"}
Per page (body words now and the band the build holds them to for the page's reading task; blocks; the footer's share):
${listed.map(([id, page]) => pageLine(id, page, floors)).join("\n") || "- none measured"}`;
}

// A word count a repair states for a page's body: "to about 60 words", "to
// 120-150 words", "target about 150 words", "90 body words". A length given
// for one part - "a takeaway of 40 to 60 words" - is not the page's, so the
// count must follow "to" or "target" (and not be the end of a range), or say
// "body words".
const WORD_TARGET = /(?:(?<!\d\s)\bto|\btarget(?:ing)?(?:\s+of)?)\s+(?:(?:about|around|roughly|under|over|some|at\s+most|at\s+least|no\s+more\s+than)\s+)?(\d{2,4})(?:\s*(?:-|–|to)\s*(\d{2,4}))?\s+(?:body\s+)?words\b(?!\s+(?:a|per|each)\s+block)|\b(\d{2,4})(?:\s*(?:-|–|to)\s*(\d{2,4}))?\s+body\s+words\b/gi;
const BLOCK_TARGET = /(\d{1,3})(?:\s*(?:-|–|to)\s*(\d{1,3}))?\s+words\s+(?:a|per)\s+block/gi;
const ranges = (text, pattern) => [...String(text ?? "").matchAll(pattern)].map((match) => { const low = match[1] ?? match[3], high = match[2] ?? match[4] ?? low; return [Number(low), Number(high)]; });

/**
 * A repair that states a number the build refuses, as errors. A finding on
 * one page whose repair gives a body word count wholly outside the band the
 * packet shows for that page, or - on a prose page - a words-a-block figure
 * outside the deck's band, must say in `floors` how the page stays inside it.
 * Only a stated number is caught: a repair that says "halve the commentary"
 * is held by the prompt, and by the gate when the page is rebuilt. A title a
 * repair proposes or sizes is held to the title limits (titleErrors) on any
 * finding, and `floors` does not excuse it.
 */
export function floorErrors(findings, floors) {
  if (!floors) return [];
  const errors = [];
  for (const [i, finding] of (findings || []).entries()) {
    const pages = Array.isArray(finding?.slides) ? finding.slides : [];
    // A title has no way to stay inside its limit but to be shorter: `floors` does not excuse it.
    if (floors.titles) errors.push(...titleErrors(finding?.repair, floors.titles, `findings[${i}]${finding?.id ? ` (${finding.id})` : ""}`, { section: pages.length > 0 && pages.every((id) => (floors.dividers || []).includes(id)) }));
    if (pages.length !== 1 || (typeof finding.floors === "string" && finding.floors.trim().length >= 20)) continue;
    const page = floors.pages[pages[0]];
    if (!page) continue;
    const at = `findings[${i}]${finding.id ? ` (${finding.id})` : ""}`;
    const { floor, ceiling } = page.words;
    // A length the sentence gives for a title is the title's (held above), not the page's body.
    const body = String(finding.repair ?? "").replace(TITLE_LENGTH, " ");
    const off = floor !== null && ceiling !== null ? ranges(body, WORD_TARGET).find(([low, high]) => high < floor || low > ceiling) : null;
    if (off) errors.push(`${at}: the repair asks for ${off[0] === off[1] ? off[0] : `${off[0]}-${off[1]}`} words on ${pages[0]}, and the build holds that page to ${floor}-${ceiling} body words (it carries ${page.words.now}): ask for a count inside the band, or say in \`floors\` how the page stays inside it - what replaces the words cut, or the form the page takes instead`);
    const blocks = page.blocks?.prose && floors.band ? ranges(finding.repair, BLOCK_TARGET).find(([low, high]) => high < floors.band[0] || low > floors.band[1]) : null;
    if (blocks) errors.push(`${at}: the repair asks for ${blocks[0] === blocks[1] ? blocks[0] : `${blocks[0]}-${blocks[1]}`} words a block on ${pages[0]}, a prose page, and the build holds the prose pages' median to ${floors.band[0]}-${floors.band[1]} words a block: ask for blocks inside the band, or say in \`floors\` how the deck stays inside it`);
  }
  return errors;
}
