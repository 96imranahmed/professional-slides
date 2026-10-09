// The entities a deck compares, and the mark each is introduced by.
//
// `players` on the deck names what the deck compares - companies, and as
// often places, products, aircraft types, people or buildings. A reader knows
// each by a mark before reading its name, and the mark is decided by what the
// entity is, so each entry declares it (`mark`, "logo" when it says nothing):
//
//   "Emirates"                                      an organisation or a brand: its logo,
//   { "name": "Qatar Airways", "short": "Qatar" }   fetched from its Wikipedia infobox
//   { "name": "France", "mark": "outline",          a place: its outline, drawn from the
//     "outline": { "geography": "europe",           runtime's own geography (the maps'
//                  "region": "FRA" } }              data); nothing is fetched
//   { "name": "Boeing 787", "mark": "image",        anything else with a look: a photograph,
//     "image": { "alt": "A Boeing 787 in flight",   fetched from Wikimedia Commons as the
//                "search": "Boeing 787" } }          deck's other photographs are
//
// One reading of the declaration serves every stage that reads it: the deck's
// keys (deck-keys.mjs), which refuse an entry whose mark cannot be drawn; the
// compile (page-types.mjs), which plans each entity's own mark wherever a page
// draws a player's mark (planPlayerMarks); the rules that hold a deck to
// introducing what it compares (gates/variety_gates.mjs PLAYERS_UNMARKED,
// gates/craft_gates.mjs CRAFT_PLAYERS_UNINTRODUCED), which count a mark only in
// the kind its entity declares; and the fetches - fetch-logos.mjs for the
// logos alone, fetch-pictures.mjs for the photographs, nothing for an outline.
import { placeOutline } from "./maps.mjs";

/** The kinds of mark an entity declares, and what each is for. */
export const MARK_KINDS = Object.freeze({
  logo: "an organisation or a brand: its logo, fetched from its Wikipedia article's infobox (`wikipedia` names the article, `logoHint` steers the search) - or the file its own `logo` names",
  outline: "a place - a country, a region, a city's area: its outline, drawn from the runtime's own geography as `outline: { geography, region }`; nothing is fetched",
  image: "anything else with a look - a product, an aircraft type, a person, a building: a photograph planned as `image: { alt, search }`, fetched from Wikimedia Commons as the deck's other photographs are",
});

// What an entry takes. A key that begins with `$` is a comment.
const ENTRY_KEYS = Object.freeze({
  name: "the entity's name, as the pages name it",
  short: "a shorter name the pages also use",
  aliases: "other names the pages use for it",
  mark: `the kind of mark it is introduced by: ${Object.keys(MARK_KINDS).map((kind) => `"${kind}"`).join(", ")} ("logo" when left out)`,
  logo: "a logo's own file, `{ path, credit }`, where the client supplies it",
  wikipedia: "the Wikipedia article a logo is read from",
  logoHint: "a word that steers this logo's search",
  outline: "a place's outline: `{ geography, region }`",
  image: "a photograph: `{ alt, search }`, or `{ alt, path, credit }` for a file supplied beside the pages file",
});

/**
 * A `players` entry read: the entry with its `name` and its mark's `kind`. A
 * name alone is an organisation marked by its logo; an entry with no name is
 * null, and an unknown `mark` is read as a logo (the deck's keys refuse it).
 */
export function playerEntry(p) {
  const entry = typeof p === "string" ? { name: p } : p && typeof p === "object" && !Array.isArray(p) ? p : null;
  if (typeof entry?.name !== "string" || !entry.name.trim()) return null;
  return { ...entry, kind: Object.hasOwn(MARK_KINDS, entry.mark ?? "") ? entry.mark : "logo" };
}

/** Every declared entity, read (playerEntry), in the deck's order. */
export const playerEntries = (players) => (Array.isArray(players) ? players.map(playerEntry).filter(Boolean) : []);

/**
 * The deck's players by every name a page may use for them - the name, its
 * `short` and its `aliases`, lower-cased - each mapped to the player's name.
 * A table cell naming a player is drawn as its mark, a panel headed by one is
 * that player's panel, and an early mark under a short name introduces it.
 * All three read this one map, so a player declared as "Southgate Labs" with
 * short "Southgate" is the same player to each.
 */
export function playerNames(players) {
  const names = new Map();
  for (const player of playerEntries(players))
    for (const alias of [player.name, player.short, ...(Array.isArray(player.aliases) ? player.aliases : [])])
      if (typeof alias === "string" && alias.trim()) names.set(alias.trim().toLowerCase(), player.name);
  return names;
}

/**
 * The mark a page plans for an entity, in the kind it declares: a logo as
 * `{ alt: "<Name> logo" }`, which the build fills from assets/logos/ or the
 * player's Wikipedia infobox (fetch-logos.mjs); an outline as `{ alt, mark,
 * player, outline: { geography, region } }`, read from the geography data when
 * the page is composed (compose-pictures.mjs resolveMediaRefs); a photograph
 * as the entity's own `image` - its alt and search words - which the picture
 * fetch fills (fetch-pictures.mjs), one file for every page that plans it.
 */
export function plannedMark(entry) {
  if (entry.kind === "outline") {
    const { geography, region } = entry.outline ?? {};
    return { alt: `${entry.name} outline`, mark: "outline", player: entry.name, outline: { geography, ...(region !== undefined && region !== null ? { region } : {}) } };
  }
  if (entry.kind === "image") return { ...structuredClone(entry.image ?? {}), mark: "image", player: entry.name };
  return { alt: `${entry.name} logo` };
}

/**
 * The players whose logo the build fetches: those marked by a logo with no
 * file of their own. A place's outline needs no file, and a thing's photograph
 * is the picture fetch's (fetch-pictures.mjs), so neither is searched for a logo.
 */
export const logoPlayers = (players) => playerEntries(players).filter((entry) => entry.kind === "logo" && !(entry.logo && (entry.logo.path || entry.logo.dataUri)));

/** The photographs the declared image entities are introduced by: each one's `alt`, lower-cased, to the entity's name. */
export function playerPhotographs(players) {
  return new Map(playerEntries(players).filter((entry) => entry.kind === "image" && typeof entry.image?.alt === "string" && entry.image.alt.trim())
    .map((entry) => [entry.image.alt.trim().toLowerCase(), entry.name]));
}

const unsourced = (media) => Boolean(media) && typeof media === "object" && !Array.isArray(media) && !media.path && !media.dataUri && !media.outline;
// A planned picture and nothing else - the keys a fetch reads - so a picture page's entry, which carries its label and text, is never taken for one.
const PLANNED_KEYS = new Set(["alt", "search", "fetch", "after", "without"]);

/**
 * Plan each declared entity's own mark wherever a compiled page draws a
 * player's mark, in place: a `logo` cell that names its `player` and plans no
 * picture of its own; a member of a `logos` exhibit named for one, with no
 * image of its own (its name is drawn until the file is there, as a cell's
 * is); and a mark planned under the runtime's name for a player's logo -
 * `{ alt: "<Name> logo" }` on a card, a column header, a chart category - for
 * an entity whose mark is its outline or its photograph, which is planned as
 * that instead. A page that names its own picture keeps it.
 */
export function planPlayerMarks(slide, players) {
  const entries = playerEntries(players);
  if (!entries.length || !slide || typeof slide !== "object") return slide;
  const names = playerNames(players), byName = new Map(entries.map((entry) => [entry.name, entry]));
  const entryOf = (text) => byName.get(names.get(String(text ?? "").trim().toLowerCase()));
  // "<alias> logo", for each entity whose mark is not a logo: the runtime's name for a logo stands for the mark it declares.
  const standIns = new Map([...names].filter(([, name]) => byName.get(name).kind !== "logo").map(([alias, name]) => [`${alias} logo`, byName.get(name)]));
  const standIn = (media) => (unsourced(media) && typeof media.alt === "string" && Object.keys(media).every((key) => PLANNED_KEYS.has(key)) ? standIns.get(media.alt.trim().toLowerCase()) ?? null : null);
  const visit = (holder, key) => {
    const value = holder[key];
    if (!value || typeof value !== "object") return;
    const stood = standIn(value);
    if (stood) { holder[key] = plannedMark(stood); return; }
    if (Array.isArray(value)) { value.forEach((_, at) => visit(value, at)); return; }
    if (value.type === "logo" && typeof value.player === "string" && !value.media) { const entry = entryOf(value.player); if (entry) value.media = plannedMark(entry); }
    if (value.type === "logos" && Array.isArray(value.items))
      for (const item of value.items) { const entry = item && typeof item === "object" ? entryOf(item.name) : null; if (entry && !item.image) item.image = plannedMark(entry); }
    for (const child of Object.keys(value)) visit(value, child);
  };
  for (const key of Object.keys(slide)) visit(slide, key);
  return slide;
}

const kindOf = (value) => (value === null ? "null" : Array.isArray(value) ? "an array" : typeof value === "object" ? "an object" : `a ${typeof value}`);
const written = (value) => typeof value === "string" && value.trim().length > 0;

// What an outline needs: a geography the maps draw, and the region of it that is the place.
function outlineProblems(outline) {
  const form = "an outline is `outline: { geography, region }` - `geography` one the maps draw (a preset such as \"europe\", \"gcc\" or \"usa\", \"country:<ISO code>\", or a geography imported with runtime/import-geography.mjs), `region` the place in it (a country's ISO code or name, a list of them, or an imported feature's id; left out, the whole geography)";
  if (!outline || typeof outline !== "object" || Array.isArray(outline)) return [form];
  const extra = Object.keys(outline).filter((key) => !["geography", "region"].includes(key));
  if (extra.length) return [`\`outline\` takes geography and region only (got ${extra.join(", ")}): ${form}`];
  if (outline.geography === undefined || !(written(outline.geography) || (outline.geography && typeof outline.geography === "object" && !Array.isArray(outline.geography)))) return [`\`outline.geography\` is missing or ${kindOf(outline.geography)}: ${form}`];
  const region = outline.region;
  if (region !== undefined && region !== null && !written(region) && !(Array.isArray(region) && region.length && region.every(written))) return [`\`outline.region\` is ${kindOf(region)}: ${form}`];
  try { placeOutline(outline); } catch (error) { return [`its outline cannot be drawn - ${error.message}`]; }
  return [];
}

// What a photograph needs: what it shows, and the words it is searched by, or the file supplied with its credit.
function imageProblems(image) {
  const form = "a photograph is `image: { alt, search }` - `alt` what it shows, `search` the words Wikimedia Commons is searched by (the thing's own name) - or `{ alt, path, credit }` for a file supplied beside the pages file";
  if (!image || typeof image !== "object" || Array.isArray(image)) return [form];
  const problems = [];
  if (!written(image.alt)) problems.push(`\`image.alt\` says what the photograph shows: ${form}`);
  if (!written(image.path) && !written(image.search)) problems.push(`\`image.search\` names the words the photograph is searched by, or \`image.path\` the file supplied: ${form}`);
  if (written(image.path) && !written(image.credit)) problems.push("a supplied photograph carries its `credit` - who took it and under what licence - which the deck prints");
  return problems;
}

/**
 * Every problem with a deck's `players`, as sentences: an entry with no name,
 * a key no stage reads, a `mark` that is not a kind, a key that belongs to
 * another kind's mark, and what the kind needs and was not given - an outline
 * that cannot be drawn from its geography, a photograph with nothing to say
 * what it shows or to search it by. None for a well-formed list.
 */
export function playerProblems(players) {
  if (!Array.isArray(players)) return [];
  const problems = [];
  players.forEach((p, at) => {
    if (typeof p === "string") { if (!p.trim()) problems.push(`entry ${at + 1} is an empty name`); return; }
    if (!p || typeof p !== "object" || Array.isArray(p)) { problems.push(`entry ${at + 1} is ${kindOf(p)}: an entry is a name, or { name, mark, ... }`); return; }
    const who = written(p.name) ? `"${p.name}"` : `entry ${at + 1}`;
    const say = (sentence) => problems.push(`${who}: ${sentence}`);
    if (!written(p.name)) say("it has no `name` - every entity is named as the pages name it");
    const unknown = Object.keys(p).filter((key) => !key.startsWith("$") && !Object.hasOwn(ENTRY_KEYS, key));
    if (unknown.length) say(`${unknown.map((key) => `\`${key}\``).join(", ")} ${unknown.length === 1 ? "is" : "are"} read by nothing - an entry takes ${Object.keys(ENTRY_KEYS).map((key) => `\`${key}\``).join(", ")}`);
    if (p.short !== undefined && !written(p.short)) say("`short` is a name, as a string");
    if (p.aliases !== undefined && !(Array.isArray(p.aliases) && p.aliases.every(written))) say("`aliases` is a list of names");
    if (p.mark !== undefined && !Object.hasOwn(MARK_KINDS, p.mark)) { say(`\`mark\` is one of ${Object.entries(MARK_KINDS).map(([kind, about]) => `"${kind}" (${about.split(":")[0]})`).join("; ")} - it was given ${JSON.stringify(p.mark)}`); return; }
    const kind = p.mark ?? "logo";
    for (const other of ["outline", "image"]) if (other !== kind && p[other] !== undefined) say(`\`${other}\` is read only under \`mark: "${other}"\`, and this entry's mark is ${kind === "logo" ? "its logo (the default)" : `its ${kind}`} - set \`mark: "${other}"\` to introduce it by its ${other === "image" ? "photograph" : "outline"}, or drop \`${other}\``);
    if (kind !== "logo") for (const key of ["logo", "wikipedia", "logoHint"]) if (p[key] !== undefined) say(`\`${key}\` is read only for a logo, and this entry's mark is its ${kind === "image" ? "photograph" : "outline"}`);
    if (kind === "outline") outlineProblems(p.outline).forEach(say);
    if (kind === "image") imageProblems(p.image).forEach(say);
  });
  return problems;
}
