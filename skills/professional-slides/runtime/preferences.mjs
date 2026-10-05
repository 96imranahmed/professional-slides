#!/usr/bin/env node
// Design preferences: the intake answers, stored once per user.
//
//   node runtime/preferences.mjs show                       stored answers, what is missing (and its recommended default), the deck keys they set
//   node runtime/preferences.mjs get [key]                  one answer's value (or every answer)
//   node runtime/preferences.mjs set key=value ...          store answers (JSON values or bare strings)
//        [--source asked|inferred|default] [--reference deck.pptx] [--from-house house.json]
//   node runtime/preferences.mjs clear [key ...]            forget answers (all when no key)
//   node runtime/preferences.mjs deck-keys                  the deck-level keys the answers set
//   node runtime/preferences.mjs apply <id>.pages.json      write those keys into a pages or deck file (an unset answer writes nothing)
//   node runtime/preferences.mjs path                       where the file lives (which location, and why, on stderr)
//
// The intake (references/theming.md#design-intake) asks how a user's decks
// should look: a reference deck, the design system, colours, tracker, title
// treatment, surfaces and density. Those are a person's habits, not a deck's,
// so asking them before every deck is friction and silently defaulting them
// puts every deck in the consulting frame. They live in one file per
// user, outside any project (inside the workspace only when that location
// cannot be written), so a new deck in another folder reuses them; the
// file records what was chosen, when and how (asked, inferred from a reference
// deck, or a default accepted), and a reference deck only as a hash of its
// path - the deck's content never leaves the project it belongs to.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { UsageError, isMain, parseCli, readJsonSync, runCli, writeJsonSync } from "./cli.mjs";
import { DESIGN_NAMES, SURFACES } from "./design-systems.mjs";
import { PALETTES } from "./palettes.mjs";

export const PREFERENCES_SCHEMA = "professional-slides.preferences/v1";

// Mirrors compose-deck.mjs TRACKER_NAMES; kept literal so this module loads without
// the composer (the CLI runs before any deck exists).
const TRACKERS = ["pills", "label", "breadcrumb", "number-strip"];
const PALETTE_NAMES = Object.keys(PALETTES).filter((name) => name !== "toolkit");
const HEX = /^#[0-9A-Fa-f]{6}$/;

// The title treatments a user can pick, each as the palette tokens that draw
// it. `system` leaves the design system's own treatment (consulting's grey
// rule, editorial's hairline, journal's tab, keynote's block).
export const TITLE_TREATMENTS = Object.freeze({
  system: {},
  rule: { "style.titleRule": "rule", "style.titleRuleLength": "content", "style.titleRuleColor": "rule" },
  full: { "style.titleRule": "rule", "style.titleRuleLength": "full", "style.titleRuleColor": "rule" },
  bar: { "style.titleRule": "rule", "style.titleRuleLength": "short", "style.titleRuleColor": "accent", "line.titleRule": 4 },
  band: { "style.titleRule": "band" },
  block: { "style.titleRule": "block" },
  tab: { "style.titleRule": "tab" },
  none: { "style.titleRule": "none" }
});

// Density in the reader's terms. The floors are weight.json's `pageWords` for
// the fill each density implies (airy, balanced, full); the live-pitch figure
// is the importer's own threshold for a presented deck.
export const DENSITIES = Object.freeze({
  "live-pitch": "presented to a room: one idea a page, about 40 body words or fewer, the largest type",
  executive: "presented or sent: about 95 to 120 body words a page with commentary beside the evidence",
  "pre-read": "read alone without a presenter: 120 body words a page and up, commentary carrying the argument"
});

const oneOf = (values) => (value) => values.includes(value) ? null : `use one of ${values.map((v) => JSON.stringify(v)).join(", ")}`;
const text = (value) => value === null || (typeof value === "string" && value.trim() && value.length <= 120) ? null : "use a line of text (120 characters at most) or null";
const colours = (value) => value && typeof value === "object" && HEX.test(value.primary ?? "") && (value.accent === undefined || HEX.test(value.accent))
  ? null : 'use { "primary": "#RRGGBB", "accent": "#RRGGBB" }';

/**
 * Every answer the intake can store. `ask` marks the questions the intake asks
 * when the answer is missing; the others are offered in one optional line.
 * `default` is the recommended answer the question offers first.
 */
export const ANSWERS = Object.freeze({
  reference: { ask: true, default: "none", check: (v) => v === "none" || (v && typeof v === "object" && /^sha256:[0-9a-f]{64}$/.test(v.pathHash ?? "") && ["pptx", "potx", "pdf", "images"].includes(v.kind)) ? null : 'use "none" or { "pathHash": "sha256:…", "kind": "pptx|potx|pdf|images" } (set with --reference)' },
  design: { ask: true, default: "consulting", check: oneOf(DESIGN_NAMES), sheet: "design-systems.png" },
  colours: { ask: true, default: "subject", check: oneOf(["subject", "system", "brand", ...PALETTE_NAMES]), sheet: "palettes.png" },
  brand: { ask: false, default: null, check: (v) => v === null ? null : colours(v) },
  tracker: { ask: true, default: "auto", check: oneOf(["auto", ...TRACKERS, "repeat-contents", "none"]), sheet: "trackers.png" },
  titleRule: { ask: true, default: "system", check: oneOf(Object.keys(TITLE_TREATMENTS)), sheet: "title-treatments.png" },
  surfaces: { ask: true, default: "reference", check: oneOf(Object.keys(SURFACES)), sheet: "surfaces.png" },
  density: { ask: true, default: "executive", check: oneOf(Object.keys(DENSITIES)) },
  typography: { ask: false, default: null, check: (v) => v === null || (v && typeof v === "object" && Object.keys(v).every((k) => ["body", "display"].includes(k) && typeof v[k] === "string" && v[k].trim())) ? null : 'use { "body": "Face", "display": "Face" } or null' },
  footer: { ask: false, default: null, check: text },
  wordmark: { ask: false, default: null, check: text },
  // A reference deck's inferred frame (import-template.py's house profile,
  // less its own title, stats and notes): stored so the next deck reuses the
  // house without the file.
  house: { ask: false, default: null, check: (v) => v === null || (v && typeof v === "object" && Object.keys(v).every((k) => HOUSE_KEYS.includes(k))) ? null : `use a house profile's ${HOUSE_KEYS.join(", ")} or null` }
});
const HOUSE_KEYS = ["design", "palette", "typography", "chrome", "pageTemplate", "density", "fill", "weight"];
export const ANSWER_KEYS = Object.freeze(Object.keys(ANSWERS));
const SOURCES = ["asked", "inferred", "default"];

/** Whether a file can be created in `directory`: asked of the directory, or of its nearest existing ancestor. */
function writableDirectory(directory) {
  for (let at = path.resolve(directory); ; at = path.dirname(at)) {
    if (fs.existsSync(at)) { try { fs.accessSync(at, fs.constants.W_OK); return fs.statSync(at).isDirectory(); } catch { return false; } }
    if (path.dirname(at) === at) return false;
  }
}

/**
 * Where the preferences file lives, and why: $PROFESSIONAL_SLIDES_HOME, else
 * $XDG_CONFIG_HOME/professional-slides, else ~/.professional-slides. A sandbox
 * may forbid writing outside the workspace, so when the XDG or home directory
 * cannot be written the file lives in <cwd>/.professional-slides and `reason`
 * says why. An explicit PROFESSIONAL_SLIDES_HOME is always used as given.
 * `location` is PROFESSIONAL_SLIDES_HOME, XDG_CONFIG_HOME, home or workspace.
 */
export function preferencesLocation(env = process.env, cwd = process.cwd(), { write = false } = {}) {
  const file = (directory) => path.join(directory, "preferences.json");
  if (env.PROFESSIONAL_SLIDES_HOME) return { file: file(env.PROFESSIONAL_SLIDES_HOME), location: "PROFESSIONAL_SLIDES_HOME" };
  const [directory, location, shown] = env.XDG_CONFIG_HOME
    ? [path.join(env.XDG_CONFIG_HOME, "professional-slides"), "XDG_CONFIG_HOME", "$XDG_CONFIG_HOME/professional-slides"]
    : [path.join(env.HOME || os.homedir(), ".professional-slides"), "home", "~/.professional-slides"];
  if (writableDirectory(directory)) return { file: file(directory), location };
  // Answers already stored where the sandbox cannot write are still read,
  // until the workspace holds its own copy; a write goes to the workspace.
  const workspace = file(path.join(cwd, ".professional-slides"));
  if (!write && !fs.existsSync(workspace) && readableFile(file(directory)))
    return { file: file(directory), location, reason: `${shown} is read-only here; its answers are read, and new answers are stored in ${path.join(cwd, ".professional-slides")}` };
  return { file: workspace, location: "workspace", reason: `${shown} is not writable` };
}

function readableFile(file) {
  try { fs.accessSync(file, fs.constants.R_OK); return fs.statSync(file).isFile(); } catch { return false; }
}

/** The preferences file's path (preferencesLocation's `file`). */
export function preferencesPath(env = process.env) {
  return preferencesLocation(env).file;
}

export function emptyPreferences() {
  return { schema: PREFERENCES_SCHEMA, updated: null, answers: {} };
}

/** Every problem with a preferences object, as sentences; empty when valid. */
export function validatePreferences(prefs) {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return ["preferences must be an object"];
  const problems = [];
  if (prefs.schema !== PREFERENCES_SCHEMA) problems.push(`schema must be "${PREFERENCES_SCHEMA}"`);
  if (!prefs.answers || typeof prefs.answers !== "object" || Array.isArray(prefs.answers)) return [...problems, "answers must be an object"];
  for (const [key, record] of Object.entries(prefs.answers)) {
    if (!Object.hasOwn(ANSWERS, key)) { problems.push(`unknown answer "${key}"; known: ${ANSWER_KEYS.join(", ")}`); continue; }
    if (!record || typeof record !== "object" || !("value" in record)) { problems.push(`${key} must be { value, at, source }`); continue; }
    const wrong = ANSWERS[key].check(record.value);
    if (wrong) problems.push(`${key}: ${wrong}`);
    if (!SOURCES.includes(record.source)) problems.push(`${key}.source must be ${SOURCES.join(", ")}`);
    if (Number.isNaN(Date.parse(record.at))) problems.push(`${key}.at must be an ISO date`);
  }
  if (prefs.answers.colours?.value === "brand" && !prefs.answers.brand?.value) problems.push('colours "brand" needs brand { primary, accent }');
  return problems;
}

export function readPreferences(file = preferencesPath()) {
  if (!fs.existsSync(file)) return emptyPreferences();
  const prefs = readJsonSync(file);
  const problems = validatePreferences(prefs);
  if (problems.length) throw new Error(`${file} is not valid preferences: ${problems.join("; ")}`);
  return prefs;
}

export function writePreferences(prefs, file = preferencesPath()) {
  const problems = validatePreferences(prefs);
  if (problems.length) throw new Error(`Refusing to store invalid preferences: ${problems.join("; ")}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write then rename, so a crash never leaves half a file for the next deck.
  const temporary = `${file}.${process.pid}.tmp`;
  writeJsonSync(temporary, prefs);
  fs.renameSync(temporary, file);
  return file;
}

/** A reference deck as the file records it: the hash of its resolved path and its kind, never its content. */
export function referenceRecord(file) {
  const resolved = path.resolve(file);
  const extension = path.extname(resolved).slice(1).toLowerCase();
  const kind = ["pptx", "potx", "pdf"].includes(extension) ? extension : "images";
  return { pathHash: `sha256:${createHash("sha256").update(resolved).digest("hex")}`, kind };
}

/** Store answers: `{ key: value }`, each stamped with when and how it was chosen. */
export function setAnswers(prefs, values, { source = "asked", at = new Date().toISOString() } = {}) {
  const out = structuredClone(prefs);
  for (const [key, value] of Object.entries(values)) out.answers[key] = { value, at, source };
  out.updated = at;
  const problems = validatePreferences(out);
  if (problems.length) throw new Error(problems.join("; "));
  return out;
}

/** The house profile's frame, less the reference deck's own words and measurements. */
export function houseAnswer(profile) {
  if (profile?.schema !== "professional-slides.house/v1") throw new Error("--from-house takes a professional-slides.house/v1 profile from import-template.py");
  return Object.fromEntries(HOUSE_KEYS.filter((k) => profile[k] !== undefined && profile[k] !== null).map((k) => [k, profile[k]]));
}

export const answerValues = (prefs) => Object.fromEntries(Object.entries(prefs.answers).map(([k, r]) => [k, r.value]));

/** The intake questions still to ask: every asked answer not stored. A stored reference deck answers the frame questions it inferred. */
export function missingQuestions(prefs) {
  const values = answerValues(prefs);
  const fromHouse = values.house ? new Set(["design", ...(values.house.palette ? ["colours", "titleRule"] : []), ...(values.house.density ? ["density"] : [])]) : new Set();
  return ANSWER_KEYS.filter((key) => ANSWERS[key].ask && values[key] === undefined && !fromHouse.has(key));
}

/** The missing questions with the answer each recommends: shown to the agent, never applied. */
export function unsetAnswers(prefs) {
  return missingQuestions(prefs).map((key) => ({ key, default: ANSWERS[key].default }));
}

/**
 * The deck-level keys the answers set. This is the whole of how a preference
 * reaches a build: each answer becomes a key the deck spec already reads
 * (design-systems.mjs applyDesign, compose-deck.mjs), and an author's explicit key
 * on the deck still wins because `apply` never overwrites one.
 *
 *   design       -> design
 *   colours      -> brand: identity { primary, accent }; a palette name: palette
 *                   (a name on consulting, else its colours over the system);
 *                   subject/system: nothing (the author sets identity per deck)
 *   titleRule    -> palette.colors style.titleRule (+ Length, Color, line.titleRule)
 *   tracker      -> tracker ("none" is false; "auto" leaves the system and variation to choose)
 *   surfaces     -> surfaces
 *   density      -> density (fill follows: live-pitch airy, executive balanced, pre-read full)
 *   typography   -> typography (a non-Arial body takes a bold semibold mapping)
 *   footer       -> footer;  wordmark -> logo (the cover's wordmark)
 *   house        -> design, palette, typography, chrome, pageTemplate, density, fill, weight
 */
export function deckKeys(input) {
  const v = input?.answers ? answerValues(input) : { ...(input || {}) };
  const house = v.house || {};
  const keys = {};
  for (const key of HOUSE_KEYS) if (house[key] !== undefined) keys[key] = structuredClone(house[key]);
  // An unanswered design sets no key: the deck, or the intake, decides.
  if (v.design !== undefined) keys.design = v.design;
  let palette = keys.palette && typeof keys.palette === "object" ? keys.palette : null;
  if (PALETTE_NAMES.includes(v.colours)) {
    // A named palette's colours reach any system: on consulting the name
    // itself; on another system its colour roles laid over the system's own
    // (applyDesign lets a palette object's colours win), so the system keeps
    // its frame and takes the palette's colours. A deck with no design is
    // built as consulting (applyDesign), so it takes the name.
    if ((keys.design ?? "consulting") === "consulting") keys.palette = v.colours;
    else palette = { base: v.colours, colors: Object.fromEntries(Object.entries(PALETTES[v.colours].colors).filter(([k]) => k.startsWith("color."))) };
  }
  if (v.colours === "brand" && v.brand) keys.identity = { primary: v.brand.primary, ...(v.brand.accent ? { accent: v.brand.accent } : {}) };
  const treatment = TITLE_TREATMENTS[v.titleRule ?? "system"] || {};
  if (Object.keys(treatment).length) {
    const named = typeof keys.palette === "string" ? keys.palette : null;
    palette = { ...(palette || {}), ...(named ? { base: named } : {}), colors: { ...(palette?.colors || {}), ...treatment } };
  }
  if (palette) keys.palette = palette;
  if (v.tracker !== undefined && v.tracker !== "auto") keys.tracker = v.tracker === "none" ? false : v.tracker;
  if (v.surfaces !== undefined) keys.surfaces = v.surfaces;
  if (v.density !== undefined) keys.density = v.density;
  if (v.typography) {
    const body = v.typography.body ?? "Arial";
    keys.typography = { body, display: v.typography.display ?? body, ...(body !== "Arial" ? { semibold: { family: body, nativeBold: true, effectiveWeight: 700 } } : {}) };
  }
  if (v.footer) keys.footer = v.footer;
  if (v.wordmark) keys.logo = v.wordmark;
  return keys;
}

/**
 * Write the deck keys into a pages file (`{ deck, pages }`) or a deck spec,
 * filling only keys the deck does not set: a choice made for this deck beats
 * a habit. Returns what was set and what the deck kept.
 */
export function applyToDeck(document, keys) {
  const out = structuredClone(document);
  const deck = out.deck && Array.isArray(out.pages) ? out.deck : out;
  const set = [], kept = [];
  for (const [key, value] of Object.entries(keys)) {
    if (deck[key] !== undefined) { kept.push(key); continue; }
    deck[key] = value; set.push(key);
  }
  return { document: out, set, kept };
}

/** One line for the user: what was reused and how to change it. */
export function reuseLine(prefs, file = preferencesPath()) {
  const values = answerValues(prefs);
  const shown = Object.entries(values).filter(([k]) => k !== "house" && k !== "reference").map(([k, v]) => `${k} ${typeof v === "object" && v ? JSON.stringify(v) : v}`);
  if (values.house) shown.unshift("the reference deck's frame");
  if (!shown.length) return "";
  return `Reusing your stored design preferences (${shown.join(", ")}); say if you want any changed, or edit ${file}.`;
}

function parseValue(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
}

function main(argv) {
  const { values: flags, positionals: [command = "show", ...rest] } = parseCli(argv, { source: { type: "string" }, reference: { type: "string" }, "from-house": { type: "string" } },
    { usage: "Usage: preferences.mjs show | get [key] | set key=value ... [--source asked|inferred|default] [--reference deck.pptx] [--from-house house.json] | clear [key ...] | deck-keys | apply <file> | path", strict: true });
  const { file, location, reason } = preferencesLocation();
  const where = { location, ...(reason ? { locationReason: reason } : {}) };
  // Where a change is written: the file read, unless that file is read-only here.
  const target = preferencesLocation(process.env, process.cwd(), { write: true });
  const written = { file: target.file, location: target.location, ...(target.reason ? { locationReason: target.reason } : {}) };
  const print = (value) => console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  // The path alone on stdout, so a script can use it; where and why on stderr.
  if (command === "path") { console.error(`location: ${location}${reason ? ` (${reason})` : ""}`); return print(file); }
  const prefs = readPreferences(file);
  if (command === "show") return print({ file, ...where, ...prefs, missing: missingQuestions(prefs), unset: unsetAnswers(prefs), deckKeys: deckKeys(prefs), reuse: reuseLine(prefs, file) });
  // JSON even for a bare string, so a script can parse any answer the same way.
  if (command === "get") return console.log(JSON.stringify(rest[0] ? prefs.answers[rest[0]]?.value ?? null : answerValues(prefs)));
  if (command === "deck-keys") return print(deckKeys(prefs));
  if (command === "set") {
    const { source = "asked", reference, "from-house": house } = flags;
    // What a reference deck inferred is marked as inferred, so a later reader
    // of the file knows the user never chose it outright; anything the user
    // also answered on the same line is theirs.
    const inferred = {};
    if (house) { inferred.house = houseAnswer(readJsonSync(house)); if (inferred.house.design) inferred.design = inferred.house.design; }
    const values = reference ? { reference: referenceRecord(reference) } : {};
    for (const pair of rest) {
      const at = pair.indexOf("=");
      if (at < 1) throw new Error(`Expected key=value, got ${pair}`);
      values[pair.slice(0, at)] = parseValue(pair.slice(at + 1));
      delete inferred[pair.slice(0, at)];
    }
    const next = setAnswers(setAnswers(prefs, inferred, { source: "inferred" }), values, { source });
    writePreferences(next, target.file);
    return print({ ...written, stored: [...Object.keys(inferred), ...Object.keys(values)], missing: missingQuestions(next), deckKeys: deckKeys(next) });
  }
  if (command === "clear") {
    const next = structuredClone(prefs);
    if (rest.length) for (const key of rest) delete next.answers[key]; else next.answers = {};
    next.updated = new Date().toISOString();
    writePreferences(next, target.file);
    return print({ ...written, cleared: rest.length ? rest : "all", missing: missingQuestions(next) });
  }
  if (command === "apply") {
    if (!rest[0]) throw new Error("apply takes a pages or deck file");
    const { document, set, kept } = applyToDeck(readJsonSync(rest[0]), deckKeys(prefs));
    writeJsonSync(rest[0], document);
    return print({ file: rest[0], preferences: file, ...where, set, kept, unset: unsetAnswers(prefs), reuse: reuseLine(prefs, file) });
  }
  throw new Error(`Unknown command ${command}; use show, get, set, clear, deck-keys, apply or path`);
}

// Every failure is the command line's or the stored file's, said in one line.
if (isMain(import.meta.url)) runCli((argv) => { try { main(argv); } catch (error) { throw error instanceof UsageError ? error : new UsageError(error.message); } });
