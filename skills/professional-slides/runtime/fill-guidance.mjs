// How much content fills a page that stands part empty, measured.
//
// A band of a page that carries nothing is the commonest refusal an author
// meets, and "write more" does not say how much: three points beside a chart
// were lengthened a run at a time until the column closed, and past it the
// word ceiling fired. A page of prose beside its panel is already told the
// words that fill its column (compose-points.mjs proseFillRange). This does
// the same for the other common kinds, by the one measurement that cannot
// disagree with the composer: the page itself is composed again with its own
// content run shorter and longer, and the lengths at which the page gates
// report no empty band, no shortfall against the word floor and nothing over
// the word ceiling are the range.
//
// Two levers are read off the page as written, whatever its type:
//
//   points   the commentary points beside or under an exhibit, and the
//            bullets of a labelled-rows page's blocks: every point run to the
//            same number of words - the page's own, and the deck's where it
//            has too few to show how its words run - at the lengths of
//            FILL.pointWords and then between the two where the page turns
//   rows     the rows of the page's table (a lookup, a scorecard, an
//            executive summary's answer table, the table under a metric
//            strip) or of a findings matrix: its own rows, fewer and more
//
// Where no length of points fills the page inside its word ceiling - an
// executive summary's four points cannot reach the foot under 204 words - the
// statement says so, and names the exhibit that does: the table at the rows
// measured to fill it, or the exhibit the page carries.
//
// Nothing is changed: the author is told a range to write to. A page is
// composed in the deck's own sections, at its own density, so the body it is
// measured in is the body it is drawn in; the devices the composer varies
// against a page's neighbours are not, which is why the range is stated as
// measured at these lengths and not as a bound.
import { textWords } from "./text-contract.mjs";

export const FILL = Object.freeze({
  // Words a point, shortest to longest, at the first reading: from a phrase to the longest block the text gates let stand.
  pointWords: Object.freeze([8, 14, 22, 32, 44, 58, 74]),
  // Rows tried at the first reading, against the table's own count; never fewer than a table holds.
  rows: Object.freeze({ offsets: Object.freeze([-2, 1, 2, 4, 6, 8]), min: 3 }),
  // How many lengths the second reading sets between two of the first, where the page turns from empty to filled or to over.
  between: 3,
  // How far inside each end of the lengths that filled the stated range of words stops: a line of a narrow column, as words.
  margin: Object.freeze({ words: 3, share: 0.08 }),
  // The most pages measured in one run: each costs two compositions of a dozen variants.
  pages: 6,
});

const wordsOf = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean);
// A text's own words run to `n`, cycled where it has to run longer, closed as a sentence.
const runTo = (text, n) => { const words = wordsOf(text); return `${Array.from({ length: n }, (_, i) => words[i % words.length]).join(" ").replace(/[.,;:!?]+$/, "")}.`; };
const exhibitsOf = (page) => [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object");
const pointText = (point) => (typeof point === "string" ? point : point?.text);

/** The lists of points a page writes: its commentary's, and each labelled row's bullets. */
const pointLists = (page) => [...(Array.isArray(page.points) ? [page.points] : []), ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.points).filter(Array.isArray) : [])];
/** The object whose `rows` are the page's table: its first exhibit with columns and rows, or the page itself where it is a matrix of findings. */
const rowHolder = (page) => exhibitsOf(page).find((ex) => Array.isArray(ex.rows) && Array.isArray(ex.columns) && ex.rows.length > 0) ?? (Array.isArray(page.rows) && page.rows.length > 0 ? page : null);

/**
 * The levers of a page as written: `{ points, rows }`, each null where the
 * page has none. `points` is `{ count, average, placed }` - how many points,
 * the words they average, and where they sit - and `rows` `{ count, of }`,
 * the rows and what holds them.
 */
export function fillLevers(page) {
  const points = pointLists(page).flat().filter((point) => wordsOf(pointText(point)).length > 0);
  const holder = rowHolder(page);
  return {
    points: points.length ? { count: points.length, average: Math.round(points.reduce((sum, point) => sum + textWords(pointText(point)), 0) / points.length),
      placed: Array.isArray(page.blocks) && !Array.isArray(page.points) ? "in its labelled rows" : page.commentary === "below" ? "under its exhibit" : ["beside", "beside-left"].includes(page.commentary) ? "beside its exhibit" : "on the page" } : null,
    rows: holder ? { count: holder.rows.length, of: holder === page ? "matrix" : holder.type === undefined || /table/.test(String(holder.type)) ? "table" : String(holder.type) } : null,
  };
}

// The fewest words a pool holds before it is taken as the measure of how the page's words run.
const POOL_WORDS = 120;
// Words are not lines: thirty words of short words and thirty of long ones differ by a line or two of a column, and where a
// layout turns on a line the two compose differently. So every length is composed twice - in the pool's words with the
// longest fifth left out, and with the shortest fifth left out - and a length fills only where both do: what an author
// writes to that count, in words of their own, falls between the two.
const TEXTURES = Object.freeze({ lean: (lengths) => { const cut = lengths[Math.floor(lengths.length * 0.8)]; return (word) => word.length <= cut; },
  full: (lengths) => { const cut = lengths[Math.floor(lengths.length * 0.2)]; return (word) => word.length >= cut; } });

/**
 * `page` with every point run to `words` words: its own words first, as far
 * as they go, so it opens as the author opened it - a layout can turn on how a
 * point begins - and then the words of the page's other points and, where
 * those are too few to say how its words run, the deck's (`deckWords`), in
 * one `texture` (TEXTURES), as one sentence. Each point continues from its
 * own place in the pool, so no two are the same text. The phrases the page
 * emphasised go, since a run of words may not hold them.
 */
function withPointWords(pageIn, words, deckWords = [], texture = "lean") {
  const page = structuredClone(pageIn);
  delete page.highlight;
  const points = pointLists(page).flat().filter((point) => wordsOf(pointText(point)).length > 0);
  const own = points.flatMap((point) => wordsOf(pointText(point)));
  // The continuation is words, not sentences: the stops inside it are taken out.
  const whole = (own.length >= POOL_WORDS ? own : [...own, ...deckWords]).map((word) => word.replace(/[.;:!?]+$/, "")).filter(Boolean);
  const kept = TEXTURES[texture](whole.map((word) => word.length).sort((a, b) => a - b)), pool = whole.filter(kept);
  const stride = Math.max(1, Math.floor(pool.length / Math.max(1, points.length)));
  for (const list of pointLists(page)) list.forEach((point, at) => {
    const place = points.indexOf(point);
    if (place < 0 || !pool.length) return;
    const opening = wordsOf(pointText(point)).map((word, i, all) => (i < all.length - 1 ? word : word.replace(/[.;:!?]+$/, "")));
    const more = [...pool.slice((place * stride) % pool.length), ...pool.slice(0, (place * stride) % pool.length)];
    const text = runTo([...opening, ...Array.from({ length: Math.max(0, words - opening.length) }, (_, i) => more[i % more.length])].join(" "), words);
    if (typeof point === "string") list[at] = text;
    else { point.text = text; delete point.highlight; }
  });
  return page;
}
/** `page` with its table's own rows run to `count` rows. */
function withRows(pageIn, count) {
  const page = structuredClone(pageIn), holder = rowHolder(page);
  holder.rows = Array.from({ length: count }, (_, i) => structuredClone(holder.rows[i % holder.rows.length]));
  return page;
}

// The widest run of neighbouring lengths that all filled: a range an author can write anywhere inside. A single length of
// points that fills between two that do not is a turn of the layout, not a range, and is not stated.
function filledRun(samples, least = 1) {
  let best = null, run = null;
  for (const sample of samples) {
    if (!sample.fills) { run = null; continue; }
    run = run ? { ...run, max: sample.at, n: run.n + 1 } : { min: sample.at, max: sample.at, n: 1 };
    if (run.n >= least && (!best || run.max - run.min >= best.max - best.min)) best = run;
  }
  return best;
}

// The findings that say a page carries too little: a band that stands empty, and words under the page's floor.
const SHORT_CODES = new Set(["SCENE_VOID", "TEXT_COVERAGE_LOW"]);

// The page's other text slots, each one text a page runs shorter or longer: the lengths each is first read at, from the
// shortest its check lets stand to past the longest its box holds. A heading is one line, a subtitle and a takeaway two.
const SLOT_WORDS = Object.freeze({
  caption: Object.freeze([8, 11, 15, 20, 26, 34, 44]), rail: Object.freeze([10, 14, 20, 28, 38, 50, 64]), bar: Object.freeze([8, 11, 15, 20, 26, 34]),
  takeaway: Object.freeze([4, 8, 12, 16, 22, 30]), subtitle: Object.freeze([3, 6, 10, 14, 19, 26]), heading: Object.freeze([2, 4, 6, 8, 10, 13, 17]),
});
// Where each slot's text sits on a page: `at` is the exhibit for a caption or a heading.
const SLOT_TEXT = Object.freeze({
  caption: { get: (page, at) => exhibitsOf(page)[at]?.caption, set: (page, at, text) => { exhibitsOf(page)[at].caption = text; } },
  heading: { get: (page, at) => exhibitsOf(page)[at]?.heading, set: (page, at, text) => { exhibitsOf(page)[at].heading = text; } },
  ...Object.fromEntries(["rail", "bar", "takeaway", "subtitle"].map((key) => [key, { get: (page) => page[key], set: (page, _, text) => { page[key] = text; } }])),
});
const slotOf = (lever) => { const [slot, at] = String(lever).split(":"); return { slot, at: at === undefined ? 0 : Number(at) }; };

/**
 * The text slots of a page as written, apart from its points: each exhibit's
 * caption and heading, the rail, the so-what bar, the takeaway and the
 * subtitle - the ones the page writes as text, keyed `caption:0`, `rail` -
 * with the words each has now. A subtitle the page leaves out is a slot too:
 * what one would hold is a limit the author needs before writing it.
 */
function textSlots(page) {
  const slots = {};
  exhibitsOf(page).forEach((ex, at) => { for (const slot of ["heading", "caption"]) if (typeof ex[slot] === "string" && ex[slot].trim()) slots[`${slot}:${at}`] = wordsOf(ex[slot]).length; });
  for (const slot of ["rail", "bar", "takeaway", "subtitle"]) if (typeof page[slot] === "string" && page[slot].trim()) slots[slot] = wordsOf(page[slot]).length;
  if (!Object.hasOwn(slots, "subtitle")) slots.subtitle = 0;
  return slots;
}

/** `page` with one text slot run to `n` words: its own words first, then the deck's, in one texture, as one sentence. */
function withSlotWords(pageIn, lever, n, deckWords = [], texture = "lean") {
  const page = structuredClone(pageIn), { slot, at } = slotOf(lever), place = SLOT_TEXT[slot];
  delete page.highlight;
  const own = wordsOf(place.get(page, at));
  const whole = [...own, ...deckWords].map((word) => word.replace(/[.;:!?]+$/, "")).filter(Boolean);
  const kept = TEXTURES[texture](whole.map((word) => word.length).sort((a, b) => a - b)), pool = whole.filter(kept);
  const opening = own.filter(kept).slice(0, n);
  const more = pool.length ? Array.from({ length: Math.max(0, n - opening.length) }, (_, i) => pool[i % pool.length]) : [];
  // A heading is a label and takes no full stop; every other slot is a sentence.
  const text = [...opening, ...more].join(" ");
  place.set(page, at, slot === "heading" ? text.replace(/[.,;:!?]+$/, "") : runTo(text, n));
  return page;
}

/** `page` with one lever set to `at`: its points run to that many words in one texture, its table to that many rows, or one text slot to that many words. */
const withLever = (page, lever, at, words, texture) => (lever === AS_WRITTEN ? page : lever === "points" ? withPointWords(page, at, words, texture) : lever === "rows" ? withRows(page, at) : withSlotWords(page, lever, at, words, texture));
// The page composed as it is given, every slot already set: how the ranges are checked together (slotGuidance).
const AS_WRITTEN = "as-written";
const textured = (lever) => lever !== "rows" && lever !== AS_WRITTEN;

/**
 * Compose every `{ target, lever, at }` of `requests` and read it: a Map from
 * the request to `{ at, fills, short, over }` - whether the page composes as
 * one page with no blocking page-gate finding beyond the ones it already
 * carried (`target.base`), whether it is still short (a band stands empty, or
 * it is under its word floor), and whether it is past its ceiling or its
 * frame. A length of points is composed in both textures and fills only
 * where both do. One composition and one gate run for all.
 */
async function measure(requests, { compile, compose, pageGates, words = [] }) {
  const variants = requests.flatMap((request) => (textured(request.lever) ? Object.keys(TEXTURES) : [null]).map((texture) => {
    const id = `${request.target.id}--fill-${String(request.lever).replace(/[^a-z0-9]+/gi, "-")}-${texture ? `${texture}-` : ""}${request.at}`;
    try { return { request, id, slide: { ...compile({ ...withLever(request.target.page, request.lever, request.at, words, texture), id }, request.target.index), id } }; }
    catch { return { request, id, slide: null }; }
  }));
  const compiled = variants.filter((variant) => variant.slide);
  const composed = compiled.length ? await compose(compiled.filter((v) => !v.request.target.appendix).map((v) => ({ slide: v.slide, after: v.request.target.id })), compiled.filter((v) => v.request.target.appendix).map((v) => v.slide)) : { deck: null };
  const drawn = (composed.deck?.slides ?? []).filter((slide) => compiled.some((variant) => variant.id === String(slide.sourceSlideId ?? slide.id)));
  const gated = drawn.length ? pageGates(drawn) : { ran: true, findings: [] };
  const blocking = (gated.findings || []).filter((f) => ["blocker", "blocking"].includes(f.severity) && f.slide >= 1);
  const read = (variant) => {
    const slides = drawn.map((slide, at) => [slide, at + 1]).filter(([slide]) => String(slide.sourceSlideId ?? slide.id) === variant.id);
    const codes = slides.flatMap(([, no]) => blocking.filter((f) => f.slide === no).map((f) => f.code)).filter((code) => !variant.request.target.base.has(code));
    const composes = Boolean(variant.slide) && slides.length === 1 && gated.ran;
    // Under its word floor a page is short too: the gates' own budget for the page says the floor and the words it has.
    const budget = (gated.budget || []).find((row) => slides.some(([, no]) => row.slide === no));
    if (composes && budget && Number.isFinite(budget.floor) && budget.body < budget.floor && !codes.includes("TEXT_COVERAGE_LOW")) codes.push("TEXT_COVERAGE_LOW");
    const short = composes && codes.some((code) => SHORT_CODES.has(code));
    // What of a heading that wrapped fits its line, as the composer measured it (registry-chart-title.mjs): the characters it holds.
    const room = slides.flatMap(([slide]) => (slide.nodes || []).map((node) => node?.data?.headingWrapped?.fits?.characters).filter(Number.isFinite));
    return { fills: composes && !codes.length, short, over: !composes || codes.some((code) => !SHORT_CODES.has(code)), room: room.length ? Math.min(...room) : null };
  };
  return new Map(requests.map((request) => { const each = variants.filter((variant) => variant.request === request).map(read), rooms = each.map((one) => one.room).filter((room) => room !== null);
    return [request, { at: request.at, fills: each.every((one) => one.fills), short: each.some((one) => one.short), over: each.some((one) => one.over), room: rooms.length ? Math.min(...rooms) : null }]; }));
}

/**
 * Measure what fills each of `targets` - `[{ id, page, index, appendix, base,
 * ceiling, exhibit }]`: a page as written (its numbers bound), its place, the
 * blocking page-gate codes it carries apart from the empty band, the word
 * floor and the word ceiling (`base`: a variant is not blamed for them), its ceiling of body
 * words and its exhibit as the page names it. The deck's machinery comes in
 * as functions, as it does for the fit search:
 *
 *   compile(page, index)   the compiled slide, or throws with the refusal
 *   compose(body, behind)  `{ deck }` for variants set in the deck's own
 *                          sections: `body` each `{ slide, after }`, the page
 *                          whose place it takes, and `behind` the appendix's
 *   pageGates(slides)      the page gates' `findings` for composed slides, each
 *                          with the `slide` it is on (1-based among them), and
 *                          their `budget` rows (`{ slide, body, floor }`)
 *   words                  the words of the deck's points, in order: what a
 *                          page with few words of its own is measured with
 *
 * A lever is read twice: at the lengths of FILL, and then between every two
 * of those where the page turns - from empty to filled, from filled to over,
 * or straight from empty to over. The points are read where the page has
 * them, and its table where it has none or where no length of its points
 * filled it. Returns a Map from page id to
 * `{ points, rows, text }`: for each lever the page has, `{ ...lever, min,
 * max, short, over, tried }` - the widest range of tried lengths that all
 * filled (null where none did), the longest length still short of filling,
 * the shortest already over the ceiling or past the frame, and the lengths
 * tried - and `text`, the sentences its finding says.
 */
// The lengths a lever is first read at: FILL's words a point, the table's own rows fewer and more, or a slot's SLOT_WORDS.
const firstOf = (lever, count) => (lever === "points" ? FILL.pointWords : lever === "rows" ? FILL.rows.offsets.map((offset) => count + offset).filter((at) => at >= FILL.rows.min) : SLOT_WORDS[slotOf(lever).slot]);

/**
 * One or more levers of each of `asked` pages (`{ target, levers, lever,
 * measured }`), read twice: at their first lengths, then between every two of
 * those where the page turns. Each lever's reading is written into its
 * `measured`. Every lever of every page is composed in the one batch.
 */
async function readLevers(asked, machinery) {
  const coarse = await measure(asked.flatMap(({ target, levers, lever }) => firstOf(lever, levers[lever].count).map((at) => ({ target, lever, at }))), machinery);
  const of = (results, target, lever) => [...results].filter(([request]) => request.target === target && request.lever === lever).map(([, sample]) => sample).sort((a, b) => a.at - b.at);
  const fine = await measure(asked.flatMap(({ target, levers, lever }) => { const samples = of(coarse, target, lever);
    return samples.slice(1).flatMap((b, i) => { const a = samples[i];
      if (!(a.fills !== b.fills || (a.short && b.over && !a.over))) return [];
      // Between two lengths where the page turns: evenly spaced words a point, every word of a slot and every count of rows but the table's own.
      const step = lever === "points" ? Math.max(1, Math.round((b.at - a.at) / (FILL.between + 1))) : 1, inside = [];
      for (let at = a.at + step; at < b.at; at += step) if (lever !== "rows" || at !== levers.rows.count) inside.push({ target, lever, at });
      return inside; }); }), machinery);
  for (const { target, levers, lever, measured } of asked) {
    const samples = [...of(coarse, target, lever), ...of(fine, target, lever)].sort((a, b) => a.at - b.at);
    const whole = filledRun(samples, lever === "points" ? 2 : 1);
    // The two ends of the run are where a line more or less decides, so the range stated for points stops a line's worth of
    // words inside each end; a run too narrow for that is stated as it was measured, and called narrow. A slot is read word
    // by word at its turns, in shorter and in longer words, so its range is stated as measured.
    const margin = (at) => (lever === "points" ? Math.max(FILL.margin.words, Math.round(at * FILL.margin.share)) : 0);
    const wide = whole && whole.min + margin(whole.min) < whole.max - margin(whole.max);
    const run = wide ? { min: whole.min + margin(whole.min), max: whole.max - margin(whole.max) } : whole;
    const rooms = samples.map((sample) => sample.room).filter((room) => room !== null && room !== undefined);
    measured[lever] = { ...levers[lever], min: run?.min ?? null, max: run?.max ?? null, ...(whole && !wide && lever === "points" ? { narrow: true } : {}), tried: samples.map((sample) => sample.at),
      short: samples.filter((sample) => sample.short).map((sample) => sample.at).at(-1) ?? null, over: samples.filter((sample) => sample.over && !sample.short).map((sample) => sample.at)[0] ?? null,
      ...(rooms.length ? { characters: Math.min(...rooms) } : {}) };
  }
}

/**
 * What each text slot of one page holds (R10): for its points and every slot
 * textSlots names, the range of words at which the page composes as one page
 * with no band left empty, nothing under its word floor, no heading wrapped
 * and nothing past its frame or ceiling - read as fillGuidance reads points,
 * by composing the page in the deck's sections with that slot run shorter and
 * longer and the rest as written, in one batch for all of its slots. A
 * heading that wraps also gives the characters its line holds. Then the page
 * is composed once more with every slot at the middle of its range, in
 * shorter and in longer words, and `joint` says whether it filled so: the
 * ranges are each slot's with the others as written, and this is whether
 * they hold together. Returns `{ slots: { <lever>: { count, min, max, ... } }, joint }`.
 */
export async function slotGuidance(target, machinery) {
  const levers = { ...(fillLevers(target.page).points ? { points: fillLevers(target.page).points } : {}),
    ...Object.fromEntries(Object.entries(textSlots(target.page)).map(([lever, count]) => [lever, { count }])) };
  const measured = {};
  await readLevers(Object.keys(levers).map((lever) => ({ target, levers, lever, measured })), machinery);
  // Every slot at the middle of its range at once - a subtitle the page leaves out stays out - in each texture.
  const middle = (m) => (m.min === null ? null : Math.round((m.min + m.max) / 2));
  const together = Object.keys(TEXTURES).map((texture) => Object.entries(measured).reduce((page, [lever, m]) => (middle(m) === null || (lever === "subtitle" && !levers.subtitle.count) ? page
    : withLever(page, lever, middle(m), machinery.words ?? [], texture)), target.page));
  const joint = await measure(together.map((page, at) => ({ target: { ...target, page }, lever: AS_WRITTEN, at })), machinery);
  return { slots: measured, joint: [...joint.values()].every((sample) => sample.fills) };
}

export async function fillGuidance(targets, machinery) {
  const read = targets.slice(0, FILL.pages).map((target) => ({ target, levers: fillLevers(target.page), measured: {} }));
  const readLever = (asked) => readLevers(asked, machinery);
  // The words first: the points where the page has them. The table is read where the page has no points, and where no length of its points filled it.
  await readLever(read.filter((item) => item.levers.points || item.levers.rows).map((item) => ({ ...item, lever: item.levers.points ? "points" : "rows" })));
  const unfilled = read.filter((item) => item.measured.points && item.measured.points.min === null && item.levers.rows);
  if (unfilled.length) await readLever(unfilled.map((item) => ({ ...item, lever: "rows" })));
  // A page with neither is filled by the text it does carry - its rail, its captions, its so-what bar, its takeaway - each
  // read as the points are, so its finding names the words that fill each rather than "write more".
  const bare = read.filter((item) => !item.levers.points && !item.levers.rows).map((item) => ({ ...item,
    levers: Object.fromEntries(Object.entries(textSlots(item.target.page)).filter(([lever, count]) => count && !/^(heading|subtitle)/.test(lever)).map(([lever, count]) => [lever, { count }])) }));
  if (bare.some((item) => Object.keys(item.levers).length)) await readLever(bare.flatMap((item) => Object.keys(item.levers).map((lever) => ({ ...item, lever }))));
  return new Map(read.map(({ target, measured }) => [target.id, { ...measured, text: fillText(measured, target) }]));
}

const range = (lever, unit) => (lever.min === lever.max ? `${lever.min} ${unit}` : `${lever.min} to ${lever.max} ${unit}`);

/** What a page's measured levers say, as the sentences its finding ends on. */
function fillText({ points, rows, ...slots }, { page, ceiling = null, exhibit = null }) {
  const said = [], strip = Array.isArray(page?.metrics) && page.metrics.length ? `the strip of ${page.metrics.length} figures takes its own height and ` : "";
  if (!points && !rows) {
    // The words each text slot fills the page at, measured as the points are, where some length of it does.
    const name = (lever) => { const { slot, at } = slotOf(lever); return slot === "caption" ? `caption ${at + 1}` : slot === "bar" ? "so-what bar" : slot; };
    const filled = Object.entries(slots).filter(([, m]) => m && m.min !== null).map(([lever, m]) => `its ${name(lever)} at ${range(m, "words")} (it has ${m.count})`);
    const tail = `${strip}what fills it is the exhibit${exhibit ? `, ${exhibit}` : ""} - give it the height (another form or placement of the page, listed below where one passes) or more of the evidence in it.`;
    return filled.length ? `This page has no points and no table: it fills with ${filled.join(", ")}, measured by composing this page with each run shorter and longer, in shorter and in longer words of the deck's own, the rest as written. Where none of those is a length the page's words can take, ${tail}`
      : `This page has no points and no table whose length fills a band${Object.keys(slots).length ? `, and no length of its ${Object.keys(slots).map(name).join(" or ")} does` : ""}: ${tail}`;
  }
  if (points && points.narrow) said.push(`Its ${points.count} point${points.count === 1 ? "" : "s"} ${points.placed} fill the page only between ${points.min} and ${points.max} words each, a window so narrow that a line more or less turns it (measured by composing this page with its points run to ${points.tried.length} lengths, each in shorter and in longer words of the deck's own); they average ${points.average}. Write to its middle, or let the exhibit carry the page`);
  else if (points && points.min !== null) said.push(`Its ${points.count} point${points.count === 1 ? "" : "s"} ${points.placed} fill the page at ${range(points, "words each")} (${points.min * points.count} to ${points.max * points.count} in all), measured by composing this page with its points run to ${points.tried.length} lengths, each in shorter and in longer words of the deck's own, and stated a line inside the lengths at which both filled; they average ${points.average}`);
  else if (points) said.push(`No length of its ${points.count} point${points.count === 1 ? "" : "s"} ${points.placed} fills the page${ceiling ? ` inside its ceiling of ${Math.floor(ceiling)} body words` : ""}: ` +
    `${points.short !== null ? `at ${points.short} words each the page is still short - a band stands empty, or it is under its word floor` : "the band is not the points' to fill"}${points.over !== null ? `, and at ${points.over} the page is over its ceiling or past its frame` : ""}. Text alone does not fill this page`);
  const unfilled = points && points.min === null;
  if (rows && rows.min !== null) said.push(`${unfilled ? "The exhibit fills it: its" : "Its"} ${rows.of} fills the frame at ${range(rows, "rows")} at the row height it is drawn at (its own rows, repeated to measure); it has ${rows.count}`);
  else if (rows && unfilled) said.push(`Nor does its ${rows.of} on its own, at any number of rows from ${rows.tried[0]} to ${rows.tried.at(-1)} (it has ${rows.count}): the page needs more of both together, or another form or placement of the page (listed below where one passes)`);
  else if (rows) said.push(`No number of rows from ${rows.tried[0]} to ${rows.tried.at(-1)} fills the frame with the ${rows.of} as it is drawn (it has ${rows.count}): what fills the page is another form or placement of it (listed below where one passes), or other evidence beside the ${rows.of}`);
  if (unfilled && !rows && exhibit) said.push(`What fills it is ${strip}the exhibit, ${exhibit}: give it the height - another form or placement of the page (listed below where one passes) - or more of the evidence in it`);
  return `${said.join(". ")}.`;
}
