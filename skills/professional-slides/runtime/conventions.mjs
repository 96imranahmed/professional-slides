// The deck's conventions (`deck.conventions`): what holds across its pages that no one page declares.
//
// The BA deck was written by sixteen section writers side by side, and every gate read one page at a time. Its review was
// the first reader to see the deck's conventions broken: six charts gave the accent to a rival (pr02's Iberia, fd01's
// Lufthansa Group) or to no one (ap03-ap05), the peer set ran to eight groups on one page and ten on the next,
// "Lufthansa" named both the group (4.9% margin) and the airline (0.9%), sterling printed as £ on six pages and GBP on
// three, and one heat table shaded a rank dark-is-worse beside scores dark-is-better. Each of those was a choice a page
// made alone. So the deck declares them once:
//
//   subject          drawn in the accent wherever a chart plots it; the accent means nothing else
//   sectionSubjects  a section's own subject, by the part file --section names; a page's own `subject` overrides both
//   names            a player's canonical name and the ambiguous forms (`not`) the deck refuses
//   peerSets         the named comparison sets an exhibit of players draws from
//   currency         "symbols" (£, $, €) or "codes" (GBP, USD, EUR), wherever a currency prints
//   heat             "dark-is-better" or "dark-is-more": the one direction every heat scale runs
//
// A per-page gate holds them (gates/convention_gates.mjs), so a writer meets each on their own page check; the composer
// draws each page as written. Every key is optional.
import path from "node:path";
import { playerEntries, playerNames } from "./players.mjs";
import { isRankMeasure } from "./measures.mjs";
import { includedParts, partsOf } from "./pages-file.mjs";

export const CONVENTION_KEYS = Object.freeze({
  subject: "the player the deck is about: a declared player's name or `short`",
  sectionSubjects: "{ \"<section>\": \"<player>\" } - a section's own subject, the section as --section names it",
  names: "{ \"<player>\": { not: [\"<refused form>\", ...] } } - the forms that name the player ambiguously",
  peerSets: "{ \"<set>\": [\"<member>\", ...] } - the named comparison sets, players or not",
  currency: "\"symbols\" (£, $, €) or \"codes\" (GBP, USD, EUR)",
  heat: "\"dark-is-better\" or \"dark-is-more\"",
});
export const CURRENCY_FORMS = Object.freeze(["symbols", "codes"]);
export const HEAT_DIRECTIONS = Object.freeze(["dark-is-better", "dark-is-more"]);
// The ISO codes a deck prints with the symbol each is written as: a closed set of forms, so which one a page typed is
// formatting, read structurally - not a judgement of what the words say.
export const CURRENCIES = Object.freeze({ GBP: "£", USD: "$", EUR: "€", JPY: "¥", INR: "₹" });
const CODE_OF = Object.freeze(Object.fromEntries(Object.entries(CURRENCIES).map(([code, symbol]) => [symbol, code])));

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
/** The deck's conventions as an object, or null where it declares none. */
export const conventionsOf = (deck) => (isObject(deck?.conventions) ? deck.conventions : null);

/** The declared player a label names - its name, `short` or an alias, read whole - as the player's name, or null. */
export function playerNamed(players, label) {
  if (typeof label !== "string" || !label.trim()) return null;
  return playerNames(players).get(label.trim().toLowerCase()) ?? null;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * The declared player a mark's label stands for: the label read whole as a player's name, `short` or alias, else the one
 * player whose declared name the label holds as a whole phrase - fd01 drew "IAG operating margin" beside "Lufthansa Group
 * adjusted EBIT margin", each series one player's. The longest name holding wins ("Lufthansa Group" over "Lufthansa");
 * a label naming two players stands for neither. A name that runs on into a capitalised word is part of a longer proper
 * name ("United" in "United Kingdom"), not the player; an acronym after it ("IAG EBIT margin") is a descriptor. These are
 * the deck's own declared names, not a list of words.
 */
export function playerInLabel(players, label) {
  const whole = playerNamed(players, label);
  if (whole || typeof label !== "string") return whole;
  const text = label.trim();
  const runsOn = (rest) => /^[ \u00A0]+\p{Lu}\p{Ll}/u.test(rest);
  const found = [...playerNames(players)].filter(([alias]) => [...text.matchAll(new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(alias)})(?=$|[^\\p{L}\\p{N}])`, "giu"))]
    .some((m) => !runsOn(text.slice(m.index + m[1].length + m[2].length))));
  const spans = found.filter(([alias]) => !found.some(([other]) => other !== alias && other.length > alias.length && other.includes(alias)));
  const named = new Set(spans.map(([, name]) => name));
  return named.size === 1 ? [...named][0] : null;
}

/**
 * Every problem with `conventions`, as sentences. A player it names is a declared player (by name, `short` or alias), so
 * a slip ("Lufthansa" for "Lufthansa Group") is refused here rather than matching nothing on every page. `sections` are
 * the part files the pages file includes, where it is written in sections; a section subject keyed by anything else is
 * refused with the sections there are.
 */
export function conventionProblems(conventions, players, { sections = null } = {}) {
  if (!isObject(conventions)) return ["is an object of `subject`, `sectionSubjects`, `names`, `peerSets`, `currency` and `heat`, each optional"];
  const problems = [], declared = playerEntries(players).map((p) => p.name);
  const unknownPlayer = (name, where) => (playerNamed(players, name) ? null
    : `${where} names "${name}", which is not a declared player (${declared.length ? `\`players\` holds ${declared.map((n) => `"${n}"`).join(", ")}` : "the deck declares no `players`"}): declare it in \`players\`, or name one that is`);
  for (const key of Object.keys(conventions)) if (!key.startsWith("$") && !Object.hasOwn(CONVENTION_KEYS, key)) problems.push(`\`${key}\` is not a convention - the keys are ${Object.keys(CONVENTION_KEYS).map((k) => `\`${k}\``).join(", ")}`);
  const { subject, sectionSubjects, names, peerSets, currency, heat } = conventions;
  if (subject !== undefined) problems.push(typeof subject === "string" ? unknownPlayer(subject, "`subject`") : "`subject` is a declared player's name");
  if (sectionSubjects !== undefined) {
    if (!isObject(sectionSubjects)) problems.push(`\`sectionSubjects\` is ${CONVENTION_KEYS.sectionSubjects}`);
    else for (const [section, player] of Object.entries(sectionSubjects)) {
      problems.push(typeof player === "string" ? unknownPlayer(player, `\`sectionSubjects.${section}\``) : `\`sectionSubjects.${section}\` is a declared player's name`);
      if (sections?.length && !sections.includes(section)) problems.push(`\`sectionSubjects\` keys "${section}", which is not a section of the pages file - its sections are ${sections.join(", ")}`);
    }
  }
  if (names !== undefined) {
    if (!isObject(names)) problems.push(`\`names\` is ${CONVENTION_KEYS.names}`);
    else for (const [name, entry] of Object.entries(names)) {
      problems.push(unknownPlayer(name, "`names`"));
      if (!isObject(entry) || !Array.isArray(entry.not) || !entry.not.length || !entry.not.every((form) => typeof form === "string" && form.trim())) { problems.push(`\`names["${name}"]\` is { not: ["<refused form>", ...] }, one form or more`); continue; }
      // A refused form the deck also declares as a player's name, short or alias would be refused on every page that uses it.
      for (const form of entry.not) if (playerNamed(players, form)) problems.push(`\`names["${name}"].not\` refuses "${form}", which \`players\` declares as a name of ${playerNamed(players, form)}: take it out of that player's \`short\` or \`aliases\`, or out of \`not\``);
    }
  }
  if (peerSets !== undefined) {
    if (!isObject(peerSets)) problems.push(`\`peerSets\` is ${CONVENTION_KEYS.peerSets}`);
    else for (const [set, members] of Object.entries(peerSets)) {
      if (!Array.isArray(members) || members.length < 2 || !members.every((m) => typeof m === "string" && m.trim())) { problems.push(`\`peerSets["${set}"]\` is a list of two members or more`); continue; }
      // A set is a comparison's members, which need no mark: on ba5 the Which? and Skytrax fields named fifteen airlines and more,
      // and each would have had to be a player with a logo. A member is held only to the names the deck refuses.
      for (const member of members) for (const [name, entry] of Object.entries(isObject(names) ? names : {}))
        if (isObject(entry) && Array.isArray(entry.not) && entry.not.includes(member)) problems.push(`\`peerSets["${set}"]\` names "${member}", a form \`names\` refuses: write "${name}"`);
    }
  }
  if (currency !== undefined && !CURRENCY_FORMS.includes(currency)) problems.push(`\`currency\` is ${CONVENTION_KEYS.currency}; it was given ${JSON.stringify(currency)}`);
  if (heat !== undefined && !HEAT_DIRECTIONS.includes(heat)) problems.push(`\`heat\` is ${CONVENTION_KEYS.heat}; it was given ${JSON.stringify(heat)}`);
  return problems.filter(Boolean);
}

/** A section as --section names it: its part file's name, "6a-returns" for pages/6a-returns.pages.json (brief.mjs). */
export const sectionName = (part) => path.basename(String(part)).replace(/(\.pages)?\.json$/, "");
/** The sections of a pages file written in parts, by name. */
export const sectionNames = (doc) => [...new Set([...includedParts(doc), ...partsOf(doc).values()])].map(sectionName);
// The section of each page id, kept by the deck's conventions as the pages file was read: a one-page compile (the witness,
// a fit search) is handed a new pages file holding the page, which no longer knows its parts but shares the conventions.
const SECTION_OF = new WeakMap();
/** The section a page of `doc` is written in, by name, or null: `(page) => name`. */
export function sectionsOf(doc) {
  const conventions = conventionsOf(doc?.deck);
  if (!conventions) return () => null;
  const parts = partsOf(doc);
  if (parts.size) SECTION_OF.set(conventions, new Map([...parts].map(([id, part]) => [id, sectionName(part)])));
  const known = SECTION_OF.get(conventions);
  return (page) => known?.get(String(page?.id)) ?? null;
}

/**
 * The subject of a page: its own `subject`, else its section's (`sectionSubjects`, by the part file the page is written
 * in), else the deck's; each read as the declared player's name. Null where none is declared.
 */
export function pageSubject(conventions, page, section = null, players = null) {
  const sectionOwn = section && isObject(conventions?.sectionSubjects) ? conventions.sectionSubjects[section] : undefined;
  const named = [page?.subject, sectionOwn, conventions?.subject].find((value) => typeof value === "string" && value.trim());
  return named ? (players ? playerNamed(players, named) ?? named : named) : null;
}

/**
 * The forms the deck refuses, each mapped to the canonical names it could mean (`names[<player>].not`): "Lufthansa" is
 * refused for Lufthansa Group and for Lufthansa Airlines both, and the writer chooses which the label means.
 */
export function refusedForms(conventions) {
  const refused = new Map();
  for (const [name, entry] of Object.entries(isObject(conventions?.names) ? conventions.names : {}))
    for (const form of Array.isArray(entry?.not) ? entry.not : []) if (typeof form === "string" && form.trim()) refused.set(form.trim(), [...(refused.get(form.trim()) ?? []), name]);
  return refused;
}

/**
 * The forms of `refused` (refusedForms) that `text` holds as whole words, read without case: "Northgate's" and "NORTHGATE"
 * hold the form "Northgate", "Northgates" does not. A line that holds none cannot name a player by a form the deck refuses,
 * so the question is not put to a reader (gates/convention_gates.mjs); one that holds a form is asked, and the judgement
 * decides what it names. The forms are the deck's own declaration (`conventions.names[...].not`), not a list of words.
 */
export function refusedFormsIn(text, refused) {
  if (typeof text !== "string" || !text.trim() || !refused?.size) return [];
  return [...refused.keys()].filter((form) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(form)}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text));
}

/**
 * Each currency form typed in `text` that breaks the deck's convention, as `{ wrote, write }`: a code where the deck writes
 * symbols, a symbol where it writes codes. The forms are the closed ISO set above, read as whole words.
 */
export function currencyFormsIn(text, form) {
  if (typeof text !== "string" || !CURRENCY_FORMS.includes(form)) return [];
  const found = new Map();
  if (form === "symbols") for (const match of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])(${Object.keys(CURRENCIES).join("|")})(?![\\p{L}])`, "gu"))) found.set(match[1], CURRENCIES[match[1]]);
  else for (const match of text.matchAll(new RegExp(`[${Object.values(CURRENCIES).join("")}]`, "gu"))) found.set(match[0], CODE_OF[match[0]]);
  return [...found].map(([wrote, write]) => ({ wrote, write }));
}

/**
 * The declared peer set an exhibit's players are drawn from, with the members of it the exhibit leaves out (`missing`)
 * and the players it adds (`outside`): the set it names (`peers`), else the set whose members are exactly its players -
 * the runtime's match - and `{ set: null, nearest }` where none is, `nearest` the smallest set holding them all, if any.
 * A set an exhibit draws on only in part is named, never inferred: o03 ranked eight groups, fd01 ten and fd05 nine,
 * each read by its page as "Europe's groups".
 */
export function peerSetOf(conventions, members, named = undefined, { players = null } = {}) {
  // A set's member is read through the lookup a label is read through (playerNamed): a set that writes a declared player by
  // its `short` or an alias holds that player, so a chart labelled "Northwind" or "Northwind Airlines" finds it there. A
  // member that names no declared player stands as written. `missing` keeps each member as the set writes it.
  const as = (member) => playerNamed(players, member) ?? member;
  const sets = Object.entries(isObject(conventions?.peerSets) ? conventions.peerSets : {}).map(([name, list]) => [name, Array.isArray(list) ? list : []]);
  const holds = (list) => new Set(list.map(as));
  const read = ([name, list]) => { const held = holds(list); return { set: name, missing: list.filter((member) => !members.includes(as(member))), outside: members.filter((member) => !held.has(member)) }; };
  if (named !== undefined) { const chosen = sets.find(([name]) => name === named); return chosen ? read(chosen) : { set: null, nearest: null }; }
  const exact = sets.find(([, list]) => holds(list).size === members.length && members.every((member) => holds(list).has(member)));
  if (exact) return read(exact);
  const nearest = sets.filter(([, list]) => members.every((member) => holds(list).has(member))).sort((a, b) => a[1].length - b[1].length)[0];
  return { set: null, nearest: nearest ? read(nearest) : null };
}

const POINTS = new Set(["chart.scatter", "chart.bubble"]);
/** Whether the exhibit names its own focus: the author's mark stands, and the gate holds it to the subject (convention_gates.mjs). */
export const authorFocused = (ex) => ex?.focus !== undefined || ex?.focusSeries !== undefined || ex?.colorIndices !== undefined || (Array.isArray(ex?.highlights) && ex.highlights.length > 0)
  || (ex?.type === "table" && (ex.highlightRow !== undefined || ex.decisive !== undefined));
const labelOf = (cell) => String(typeof cell === "string" || typeof cell === "number" ? cell : cell?.text ?? cell?.label ?? cell?.name ?? "").trim();
/** The labels an exhibit draws its members under, by where: its series, its categories, its points, its rows' first cells. */
export function memberLabels(ex) {
  const type = String(ex?.type ?? "");
  if (type === "table") return { rows: (ex.rows || []).map((row) => labelOf(cellsOf(row)[0])) };
  return { series: (Array.isArray(ex?.series) ? ex.series : []).map((s) => labelOf(s?.name)), categories: (ex?.categories || []).map(labelOf),
    points: POINTS.has(type) ? (ex.points || []).map((p) => labelOf(p?.name)) : [] };
}

/** A page's exhibits in order: its `exhibit`, its `exhibits`, and the exhibit of each of its `blocks`. */
export const exhibitsOfPage = (page) => [...(page?.exhibit ? [page.exhibit] : []), ...(Array.isArray(page?.exhibits) ? page.exhibits : []),
  ...(Array.isArray(page?.blocks) ? page.blocks.map((block) => block?.exhibit).filter(Boolean) : [])];
/** The field path of each of exhibitsOfPage's exhibits, in its order, as an edit names it: `exhibit`, `exhibits[1]`, `blocks[2].exhibit`. */
export const exhibitPaths = (page) => [...(page?.exhibit ? ["exhibit"] : []), ...(Array.isArray(page?.exhibits) ? page.exhibits.map((_, i) => `exhibits[${i}]`) : []),
  ...(Array.isArray(page?.blocks) ? page.blocks.map((block, i) => (block?.exhibit ? `blocks[${i}].exhibit` : null)).filter(Boolean) : [])];
export const isHeatColumn = (column) => Boolean(column) && typeof column === "object" && (column.heat === true || column.type === "heatmap");
const REFERENCE = /\{\{\s*([^@|}]+?)\s*(?:@[^|}]*)?(?:\|[^}]*)?\}\}/g;
export const cellsOf = (row) => (Array.isArray(row) ? row : Array.isArray(row?.cells) ? row.cells : []);

/**
 * The page's conventions written onto the slide it compiled to (`slide`), from the page as authored (`page`, its cells
 * still references): the page's subject (`subject`, pageSubject), and on each heat column the direction its measure
 * records as good news (`better`: the log's `better`, or "down" for a rank), read off the measures its cells print.
 * The composer then draws both without the deck in hand. ap05's heat table set a Skytrax rank beside Which? scores and
 * shaded both by size, so dark meant worse in one column and better in the next.
 */
export function stampConventions(slide, page, { conventions, players = null, section = null, measured = null } = {}) {
  if (!slide || !conventions) return slide;
  const subject = pageSubject(conventions, page, section, players);
  if (subject && slide.kind === undefined) slide.subject = subject;
  if (!measured) return slide;
  const authored = exhibitsOfPage(page), drawn = exhibitsOfPage(slide);
  drawn.forEach((ex, at) => {
    if (!Array.isArray(ex?.columns) || !Array.isArray(authored[at]?.rows)) return;
    ex.columns.forEach((column, i) => {
      if (!isHeatColumn(column) || column.better !== undefined) return;
      const refs = new Set(authored[at].rows.flatMap((row) => [...String(cellsOf(row)[i] ?? "").matchAll(REFERENCE)].map((m) => m[1].trim())));
      const ways = new Set([...refs].map((ref) => measured.get(ref)).filter(Boolean).map((m) => m.better ?? (isRankMeasure(m) ? "down" : null)));
      if (ways.size === 1 && [...ways][0]) ex.columns[i] = { ...column, better: [...ways][0] };
    });
  });
  return slide;
}
