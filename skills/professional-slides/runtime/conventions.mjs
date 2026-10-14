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

/** The declared player a label names - its name, `short` or an alias, read whole - as the player's name, or null. */
export function playerNamed(players, label) {
  if (typeof label !== "string" || !label.trim()) return null;
  return playerNames(players).get(label.trim().toLowerCase()) ?? null;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

// The section of each page id, kept by the deck's conventions as the pages file was read: a one-page compile (the witness,
// a fit search) is handed a new pages file holding the page, which no longer knows its parts but shares the conventions.
const SECTION_OF = new WeakMap();

const POINTS = new Set(["chart.scatter", "chart.bubble"]);
const labelOf = (cell) => String(typeof cell === "string" || typeof cell === "number" ? cell : cell?.text ?? cell?.label ?? cell?.name ?? "").trim();

const REFERENCE = /\{\{\s*([^@|}]+?)\s*(?:@[^|}]*)?(?:\|[^}]*)?\}\}/g;

