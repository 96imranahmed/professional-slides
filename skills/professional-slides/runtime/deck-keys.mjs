// The deck-level keys of a pages file, in one table.
//
// `deck` in `<id>.pages.json` carries what is true of the whole deck: the
// request and the answer the reviews judge against, the entities it compares,
// its design and its page furniture. Until this table nothing listed them, so
// a key was learned from a reference page or from the refusal of whichever
// stage first read it - and an author's own key (`template`, to record which
// storyline template the deck follows) could collide with one the runtime
// already read for something else and be refused by the composer in the
// composer's words. One definition now serves both ends: `--schema deck`
// prints it (author-deck.mjs), and the compile holds `deck` to it - a key the
// table does not hold is refused with the keys it is nearest to, and a value
// of the wrong kind with what the key takes. What each value means in detail
// stays with the stage that reads it, which still checks it.
import { MARK_KINDS, playerProblems } from "./players.mjs";

// The kinds a value is read as: what `accepts` names, checked shallowly.
const KINDS = Object.freeze({
  string: (value) => typeof value === "string",
  number: (value) => typeof value === "number" && Number.isFinite(value),
  boolean: (value) => typeof value === "boolean",
  array: (value) => Array.isArray(value),
  object: (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value),
});

// The words the footer's deck line may run to.
export const FOOTER_LINE_WORDS = 5;
const key = (type, accepts, about, test = null) => Object.freeze({ type, accepts: Object.freeze(accepts), about, ...(test ? { test } : {}) });

/** Every key `deck` takes: its `type` as an author reads it, the kinds of value it `accepts`, and what it is `about` in a line. */
const DECK_KEYS = Object.freeze({
  // what the deck is
  schema: key("\"professional-slides.deck/v3\"", ["string"], "the deck spec's schema"),
  id: key("string", ["string"], "the deck's id: it names the files beside the pages file (<id>.insights.json, <id>.analysis.json, <id>.deck.json)"),
  workflow: key("\"new_deck\" | \"existing_deck_revision\"", ["string"], "a new deck, or a revision of an imported one"),
  inventory: key("string (a path)", ["string"], "a revision's source inventory, <id>.inventory.json beside the pages file, as import-deck.py wrote it"),
  purpose: key("\"evaluation\" | \"catalogue\"", ["string"], "an evaluation deck is held to 50 rendered pages; a catalogue makes no argument and skips the storyline gate - never set on a deck that argues something"),
  rulesVersion: key("number", ["number"], "the rules version the deck was authored under; the compile stamps the current one where it is absent"),
  rulesVersionReason: key("a sentence", ["string"], "on a revision that records a `rulesVersion` below the one its import stamped: why the deck is held to the older rules, for the reviewer to check"),
  // the brief: what the reviews judge against
  request: key("string", ["string"], "the user's request, verbatim; a new deck without it is refused"),
  requestProvenance: key("\"verbatim\" | \"reconstructed\" | \"paraphrased\"", ["string"], "how `request` came to be; the reviews are told"),
  evidenceScope: key("{ retrieval: \"open\" | \"closed\", note, quote, source }", ["object"], "closed where only the evidence supplied may be used, quoting the words that set the limit: from the `request` where it is verbatim, and from the file named in `source` (the brief, saved as text beside the pages file) where the request is reconstructed or paraphrased"),
  audience: key("string", ["string"], "who reads the deck, and on what occasion"),
  decision: key("string", ["string"], "the decision the deck is for"),
  question: key("string", ["string"], "the governing question the answer answers"),
  subQuestions: key("array", ["array"], "every sub-question the request asks, each to be answered with a lean"),
  brief: key("string | object", ["string", "object"], "the brief the request was read into: horizon, set compared, criteria, constraints"),
  criteria: key("array of strings", ["array"], "the brief's ranked criteria; each must be served by a page that carries an exhibit (`serves` on the page)"),
  targetPages: key("number", ["number"], "the length the request asks for; the storyline critique is told"),
  storylinePasses: key("{ max, granted }", ["object"], "the storyline passes the user allowed when approving the outline - `max` of 4 to 8, past the three every deck has - with their words in `granted`; a later title change then takes its pass without asking again",
    (value) => (Number.isInteger(value.max) && value.max >= 4 && value.max <= 8 && typeof value.granted === "string" && value.granted.trim().split(/\s+/).length >= 2 && Object.keys(value).every((k) => ["max", "granted", "at"].includes(k))
      ? null : "is { max: 4 to 8, granted: \"the user's words\", at: \"a date\" } - set only on the user's say-so, quoting it")),
  // the answer
  answer: key("string", ["string"], "the governing thought: one answer to the request, sharp enough to be wrong; the opening page carries it"),
  answerStatus: key("\"final\" | \"provisional\"", ["string"], "provisional where the evidence in scope cannot settle the answer"),
  answerLimits: key("array of strings", ["array"], "what a provisional answer leaves open, a sentence each"),
  // who and what it shows
  // Each entry declares the mark it is introduced by, by what it is (players.mjs): a name alone is an organisation marked by its logo.
  players: key("array of names or { name, short, aliases, mark, logo | outline | image, ... }", ["array"],
    `the entities the deck compares, each introduced by its own mark before it is compared. \`mark\` says which: ${Object.entries(MARK_KINDS).map(([kind, about]) => `"${kind}"${kind === "logo" ? " (the default)" : ""} - ${about}`).join("; ")}`,
    (value) => { const problems = playerProblems(value); return problems.length ? `declares what the build cannot draw - ${problems.join("; ")}` : null; }),
  playersHint: key("string", ["string"], "a word that tells the logo search what the players marked by logos are (\"bank\", \"retailer\")"),
  assets: key("{ fetch: \"build\" | \"none\", reason }", ["object"], "whether the build may fetch logos, photographs and places; \"none\" declares the deck is built without the network, with the reason the reviews are shown"),
  noPictures: key("string", ["string"], "why a deck about a subject with nothing to look at carries no photograph, in a sentence"),
  waivers: key("array of { code, reason }", ["array"], "build bars the deck asks to be excused from, each with a reason the review confirms"),
  // the design
  design: key("string (a design system)", ["string"], "the design system: the frame of every page"),
  variation: key("string | number", ["string", "number"], "the seed of what the design leaves open; a new deck takes a fresh one (variation.mjs)"),
  palette: key("string | { base, colors }", ["string", "object"], "a named palette, or colour and style tokens laid over one"),
  identity: key("{ primary, accent }", ["object"], "the subject's own colours, as #RRGGBB"),
  typography: key("object", ["object"], "the deck's typefaces"),
  chrome: key("{ left, right, titleTop, bodyTop, footerTop }", ["object"], "the page margins and the title band's place, in pixels"),
  pageTemplate: key("string | object", ["string", "object"], "the page furniture: footer, page number, logo slot"),
  surfaces: key("\"reference\" | \"open\"", ["string"], "the filled or the light set of table and card surfaces"),
  density: key("\"live-pitch\" | \"executive\" | \"pre-read\"", ["string"], "how much a page of this deck carries; it sets the body size and every word floor"),
  fill: key("string", ["string"], "how full a page reads, where it is not left to follow `density`"),
  weight: key("object", ["object"], "the weight contract a page is held to, where a house profile or the deck sets its own"),
  template: key("string (a path ending .json)", ["string"], "a house profile written by import-template.py from a template deck - its palette, typography, chrome and density become the deck's defaults. Not a storyline template: record that in `brief`",
    (value) => (/\.json$/i.test(value) ? null : "names a house profile `.json` beside the pages file (run runtime/import-template.py on the template .pptx first); to record which storyline template or decision architecture the deck follows, use `brief`")),
  // the front matter and the navigation
  cover: key("{ title, subtitle, date, logo, image, layout, tone, notes }", ["object"], "the cover page"),
  logo: key("string", ["string"], "the wordmark the cover prints"),
  // Printed on every page, so it is read past on every page: a short name, as strong decks set it. A 55-page deck's six-word
  // line was half its footer's words.
  footer: key("string", ["string"], `the short name printed in the footer beside the page number, ${FOOTER_LINE_WORDS} words at most`,
    // A revision's footer is the user's own line, carried from the deck it imports.
    (value, deck) => (deck?.workflow !== "existing_deck_revision" && value.trim().split(/\s+/).filter(Boolean).length > FOOTER_LINE_WORDS ? `runs to ${value.trim().split(/\s+/).length} words, and it is printed on every page: a short name of ${FOOTER_LINE_WORDS} words or fewer ("Manhattan real estate, Oct 2026"), the full title on the cover` : null)),
  contents: key("true | false | \"once\"", ["boolean", "string"], "whether the deck draws a contents page; on from two sections"),
  agenda: key("true | false | \"once\"", ["boolean", "string"], "the older spelling of `contents` and `tracker: \"repeat-contents\"` together"),
  agendaStyle: key("\"list\" | \"columns\"", ["string"], "how the contents page sets the sections"),
  tracker: key("\"pills\" | \"label\" | \"breadcrumb\" | \"number-strip\" | \"repeat-contents\" | false", ["string", "boolean"], "how a page says which section it is in"),
  sectionTabs: key("boolean", ["boolean"], "false takes the section tracker off every page"),
});

const kindOf = (value) => (value === null ? "null" : Array.isArray(value) ? "an array" : typeof value === "object" ? "an object" : `a ${typeof value}`);

/** The known keys nearest `name`: one a slip of the keyboard away, or one that contains it or is contained in it. */
function nearest(name, known) {
  const a = name.toLowerCase();
  const distance = (b) => { const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) { let prev = row[0]; row[0] = i; for (let j = 1; j <= b.length; j += 1) { const keep = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = keep; } }
    return row[b.length]; };
  return known.map((candidate) => [candidate, candidate.toLowerCase()]).filter(([, b]) => distance(b) <= Math.max(1, Math.floor(Math.min(a.length, b.length) / 3)) || (a.length >= 4 && (b.includes(a) || a.includes(b))))
    .map(([candidate]) => candidate).slice(0, 4);
}

/**
 * Every problem with the keys of `deck`, as sentences: a key the table does
 * not hold, with the keys it is nearest to, and a value that is not of a kind
 * its key takes. A key that begins with `$` is a comment and is read past,
 * and so is a key set to null, which sets nothing.
 */
export function deckKeyProblems(deck) {
  if (!deck || typeof deck !== "object" || Array.isArray(deck)) return [];
  const known = Object.keys(DECK_KEYS), problems = [];
  for (const [name, value] of Object.entries(deck)) {
    if (name.startsWith("$") || value === undefined || value === null) continue;
    const entry = DECK_KEYS[name];
    if (!entry) {
      const near = nearest(name, known);
      problems.push(`\`${name}\` is not a deck-level key${near.length ? ` - did you mean ${near.map((k) => `\`${k}\` (${DECK_KEYS[k].about.split(/[:;.]/)[0]})`).join(" or ")}?` : ""} Nothing reads it, so what it says would be lost: \`node runtime/author-deck.mjs --schema deck\` lists every key \`deck\` takes with its type; a note of your own goes in \`brief\`, or under a key that begins with \`$\``);
      continue;
    }
    if (!entry.accepts.some((kind) => KINDS[kind](value))) { problems.push(`\`${name}\` on \`deck\` is ${entry.type} - ${entry.about}; it was given ${kindOf(value)}`); continue; }
    const wrong = entry.test?.(value, deck);
    if (wrong) problems.push(`\`${name}\` on \`deck\` ${wrong}`);
  }
  return problems;
}

/** The deck-level keys as a JSON Schema: what `--schema deck` prints, and the `deck` property of the pages file's schema. */
export function deckSchema() {
  const json = { string: "string", number: "number", boolean: "boolean", array: "array", object: "object" };
  return { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "professional-slides.pages/v1#deck", type: "object", required: ["schema", "id"],
    description: "The deck-level keys of a pages file (`deck`). A key not listed is refused at the compile, with the keys it is nearest to; a key that begins with `$` is a comment. The pages go in `pages` and `appendix`, the citations in `sources`, beside `deck`",
    additionalProperties: false, patternProperties: { "^\\$": {} },
    properties: Object.fromEntries(Object.entries(DECK_KEYS).map(([name, entry]) => [name, { type: entry.accepts.length === 1 ? json[entry.accepts[0]] : entry.accepts.map((kind) => json[kind]), "x-takes": entry.type, description: entry.about }])) };
}
