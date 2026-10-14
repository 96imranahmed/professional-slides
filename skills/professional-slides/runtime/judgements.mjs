// Judgements: what a rule needs read, not counted, asked of a model once and
// recorded.
//
// Some rules turn on what a piece of copy means - whether a column judges its
// rows, whether four paragraphs are alternatives, whether a chart heading
// states a result, whether a photograph shows what the page planned. A list of
// words cannot read those, and every list the runtime once kept was a guess
// that the next deck's wording slipped past. So such a rule asks a question of
// a kind (judgement-kinds.json), about one subject - the words or the picture
// it judges - in its context, and holds only where the question is answered.
//
// An answer is recorded once and replayed: the deck's judgements file
// (<id>.judgements.json, beside the pages file) keeps each verdict under a key
// hashed from its kind, the kind's version, the subject and the context, so
// the same page judged again gets the same verdict without asking, a page
// edited since is asked again, and a question reworded (a new version) is
// asked again everywhere. What a question shows its reader only to place the
// subject - the rest of the page a line of commentary sits in - goes `beside`
// it, unkeyed: a neighbour rewritten leaves the line's answer standing. A rule
// whose question is not answered yet does not hold: the compile lists it as
// pending (JUDGEMENTS_PENDING), `judge.mjs`
// stages the pending questions for a model, and delivery refuses a deck with
// any still open. gates/judgements.py reads the same file by the same key.
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readJson, readJsonSync, schemaErrors } from "./cli.mjs";
import { measureText } from "./text-layout.mjs";

const DEFINITIONS = readJsonSync(new URL("./judgement-kinds.json", import.meta.url));
/** Every kind of question a rule may ask: its version, question, verdicts and the fields an answer carries. */
export const JUDGEMENT_KINDS = Object.freeze(DEFINITIONS.kinds);
export const JUDGEMENTS_SCHEMA = "professional-slides.judgements/v1";

// Numeric tokens as a reader compares them: "$1,311.8m" is 1311.8, to one decimal.
const numbersIn = (text) => (String(text).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((raw) => ({ raw, value: Number(raw.replace(/,/g, "")) }));

/** `value` with every object's keys in sorted order: the one text a key is hashed from (gates/judgements.py canonical). */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value === undefined ? null : value);
}

/** The key a question is recorded under: its kind, the kind's version, its subject and its context, hashed. */
export function judgementKey(kind, subject, context = null) {
  const spec = JUDGEMENT_KINDS[kind];
  if (!spec) throw new Error(`Unknown judgement kind: ${kind}`);
  return createHash("sha256").update(canonical([kind, spec.version, subject, context ?? null]), "utf8").digest("hex").slice(0, 24);
}

/**
 * A session: the verdicts a run may read (`verdicts`, by key), the questions
 * it met unanswered (`pending`, by key) and, for a test, an `oracle` that
 * answers a question in place of the file - `(kind, subject, context)` to a
 * verdict, a verdict record or null.
 */
export function judgementSession({ verdicts = {}, oracle = null, file = null } = {}) {
  return { verdicts: new Map(Object.entries(verdicts)), pending: new Map(), read: new Set(), oracle, file, figures: new Map() };
}

// Page furniture, whose numbers are not the page's facts: its number, footer, sources and tracker.
const FURNITURE_ROLE = /^(page-number|footer|source|tracker)/;

let active = null;
/** `fn` run with `session` as the judgements its rules read; the session before it is restored after, an async `fn` included. */
export function withJudgements(session, fn) {
  const before = active;
  active = session;
  let out;
  try { out = fn(); } catch (error) { active = before; throw error; }
  if (out && typeof out.then === "function") return out.finally(() => { active = before; });
  active = before;
  return out;
}

/**
 * A rule's question: the recorded answer - `{ verdict, reason, quote?, ...fields }`
 * - or null where none is recorded, in which case the question is added to the
 * session's pending list with where it was asked (`where`, a page id) and the
 * rule does not hold. With no session, nothing is recorded and nothing holds.
 * `beside` is shown to the reader with the question and is not keyed.
 */
export function judged(kind, subject, context = null, where = null, { image = null, beside = null, slot = null } = {}) {
  // The answer read here is this question's own, recorded once as the question.
  const recording = asked;
  asked = null;
  let known;
  try { known = recordedJudgement(kind, subject, context); } finally { asked = recording; }
  asked?.push({ ask: "judged", kind, subject, context, where, image, beside, said: known ?? null });
  if (known || !active) return known;
  const key = judgementKey(kind, subject, context);
  // `slot`: the slot this one line sits in where its kind's `fix.slot` does not say it - a title asked with the commentary
  // (player-name-form) - `{ name, measure? }`, its replacement held to that slot's limits, and its lines measured in the band.
  const open = active.pending.get(key) ?? { key, kind, subject, context: context ?? null, where: [], ...(image ? { image } : {}), ...(beside ? { beside } : {}), ...(slot ? { slot } : {}) };
  if (where !== null && where !== undefined && !open.where.includes(String(where))) open.where.push(String(where));
  active.pending.set(key, open);
  return null;
}

/** The recorded answer to a question, or null - without adding it to the pending list (a picture is fetched to be asked about only when no answer is recorded). */
export function recordedJudgement(kind, subject, context = null) {
  const said = answerOf(kind, subject, context);
  asked?.push({ ask: "recorded", kind, subject, context, said });
  return said;
}

/** The recorded answer, or null; a verdict read from the file is noted as read unless `note` is false. */
function answerOf(kind, subject, context, { note = true } = {}) {
  const key = judgementKey(kind, subject, context);
  if (!active) return null;
  const said = active.oracle ? active.oracle(kind, subject, context) : null;
  if (said) return typeof said === "string" ? { verdict: said } : said;
  const known = active.verdicts.get(key);
  if (known && note) active.read.add(key);
  return known ?? null;
}

// While a cache records what a piece of work asks (askingFrom): every question and the answer read, in order.
let asked = null;

export const judgementStorePath = (dir, stem) => path.join(dir, `${stem}.judgements.json`);

/** The deck's recorded judgements: `{ schema, verdicts }`, empty where none are recorded yet. */
export async function readJudgementStore(dir, stem) {
  return judgementStoreNow(dir, stem);
}
function judgementStoreNow(dir, stem) {
  try { return JSON.parse(readFileSync(judgementStorePath(dir, stem), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return { schema: JUDGEMENTS_SCHEMA, verdicts: {} }; throw new Error(`${judgementStorePath(dir, stem)} is not valid JSON: write it as judge.mjs does, or remove it to ask again`); }
}

/** A session reading the deck's recorded judgements. */
export async function loadJudgements(dir, stem) {
  const store = await readJudgementStore(dir, stem);
  return judgementSession({ verdicts: store.verdicts ?? {}, file: judgementStorePath(dir, stem) });
}

const words = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
const flat = (value) => (Array.isArray(value) ? value.flatMap(flat) : value && typeof value === "object" ? Object.values(value).flatMap(flat) : typeof value === "string" ? [value] : []);
const squeeze = (text) => String(text ?? "").normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
/** Whether `quote` is words the subject says, read without case, curly quotes or runs of space. */
export const quotes = (subject, quote) => Boolean(String(quote ?? "").trim()) && flat(subject).some((text) => squeeze(text).includes(squeeze(quote)));

/** Every problem with one answer to one question, as sentences. */
export function answerProblems(item, answer) {
  const spec = JUDGEMENT_KINDS[item.kind], at = `${item.key} (${item.kind})`, problems = [];
  if (!answer || typeof answer !== "object") return [`${at}: no answer`];
  if (!Object.hasOwn(spec.verdicts, answer.verdict)) return [`${at}: verdict "${answer.verdict}" is none of ${Object.keys(spec.verdicts).map((v) => `"${v}"`).join(", ")}`];
  if (words(answer.reason) < 4) problems.push(`${at}: give the reason for the verdict in a sentence`);
  if ((spec.quoteFor || []).includes(answer.verdict) && !quotes(item.subject, answer.quote)) problems.push(`${at}: a "${answer.verdict}" verdict quotes the words of the subject it rests on in \`quote\`, exactly as they are written there`);
  for (const [name, field] of Object.entries(spec.fields || {})) {
    if (!(field.for || Object.keys(spec.verdicts)).includes(answer.verdict)) continue;
    const value = answer[name];
    if (field.type === "number" && !(typeof value === "number" && Number.isFinite(value))) problems.push(`${at}: \`${name}\` is a number - ${field.about}`);
    if (field.type === "string" && !(typeof value === "string" && value.trim())) problems.push(`${at}: \`${name}\` is text - ${field.about}`);
    if (field.type === "string" && field.quoted && typeof value === "string" && value.trim() && !quotes(item.subject, value)) problems.push(`${at}: \`${name}\` ("${value}") is words of the subject, exactly as written there`);
    if (field.type === "list") {
      if (!Array.isArray(value) || !value.length) { problems.push(`${at}: \`${name}\` is a list of one entry or more - ${field.about}`); continue; }
      if (field.size && value.length !== field.size) problems.push(`${at}: \`${name}\` holds ${field.size} entries - ${field.about}`);
      for (const entry of value) {
        if (field.of === "id" && !flat(item.subject).includes(String(entry))) problems.push(`${at}: \`${name}\` names "${entry}", which is not one of the subject's ids`);
        if (field.of === "quoted" && !quotes(item.subject, entry?.phrase)) problems.push(`${at}: \`${name}\` entry "${entry?.phrase}" is not words of the subject`);
        if (field.of === "quoted" && !(typeof entry?.share === "number" && entry.share >= 0 && entry.share <= 1)) problems.push(`${at}: \`${name}\` entry "${entry?.phrase}" gives its share as a fraction from 0 to 1`);
        if (field.of === "pair" && !(Array.isArray(entry) && entry.length === 2 && entry[0] !== entry[1] && entry.every((id) => flat(item.subject).includes(String(id)))))
          problems.push(`${at}: \`${name}\` entry ${JSON.stringify(entry)} is two different ids of the subject`);
        if (field.of === "cells" && !flat(item.subject).some((text) => squeeze(text) === squeeze(entry?.cell))) problems.push(`${at}: \`${name}\` names the cell "${entry?.cell}", which is not one of the subject's cells`);
        if (field.of === "cells" && !(field.values || []).includes(entry?.value)) problems.push(`${at}: \`${name}\` gives "${entry?.cell}" the value "${entry?.value}", which is none of ${(field.values || []).map((v) => `"${v}"`).join(", ")}`);
      }
    }
  }
  return [...problems, ...fixProblems(item, answer)];
}

/**
 * Every problem with the fix a failing answer carries (judgement-kinds.json `fix`). A failure that came back without one
 * cost ba4 a round per rewrite: the writer rewrote the line, the new line was asked again, and o01 failed three times. So
 * a `replace` answer gives the line's replacement - checked here to be a new text, within its slot, and to print no
 * figure the page does not already print - with the reader's reason that it passes; a `choose` answer names the change.
 */
function fixProblems(item, answer) {
  const fix = JUDGEMENT_KINDS[item.kind].fix, at = `${item.key} (${item.kind})`;
  if (!fix || !fix.for.includes(answer.verdict)) return [];
  if (fix.by === "choose") return words(answer.fix) < 4 ? [`${at}: a "${answer.verdict}" verdict names the change that mends it in \`fix\`, in a sentence the writer can act on`] : [];
  const text = String(answer.replacement ?? "").trim();
  if (!text) return [`${at}: a "${answer.verdict}" verdict gives \`replacement\`: the ${fix.slot === "title" ? "title" : "line"} rewritten so this question, asked of it, answers "${fix.passes}", using only what the page already says`];
  const problems = [];
  if (squeeze(text) === squeeze(item.subject)) problems.push(`${at}: \`replacement\` is the ${fix.slot === "title" ? "title" : "line"} as it stands: rewrite it so it answers "${fix.passes}"`);
  if (words(answer.replacementReason) < 4) problems.push(`${at}: give in \`replacementReason\` your answer to this question for the replacement - why it is "${fix.passes}" - in a sentence`);
  const span = item.slot?.words ?? {};
  if (Number.isFinite(span.max) && words(text) > span.max) problems.push(`${at}: \`replacement\` is ${words(text)} words, and its slot holds ${span.max} at most`);
  if (Number.isFinite(span.min) && words(text) < span.min) problems.push(`${at}: \`replacement\` is ${words(text)} words, and its slot takes ${span.min} at least`);
  // A title's replacement is held to the title's lines as well, measured in the band the page sets it in.
  const band = item.slot?.measure, most = item.slot?.lines?.max;
  if (band && Number.isFinite(most) && band.width > 0) {
    const set = measureText(text, band.width, { fontFamily: band.fontFamily, fontSize: band.fontSize, bold: Boolean(band.bold) }).lines.length;
    if (set > most) problems.push(`${at}: \`replacement\` sets on ${set} lines where its slot holds ${most}: shorten it to fit`);
  }
  // The page's figures as it prints them, and every figure the question itself shows (its subject, context and what is beside it).
  const printed = [...(item.figures ?? []), ...flat([item.subject, item.context ?? null, item.beside ?? null]).flatMap((said) => numbersIn(said).map((f) => f.raw.replace(/,/g, "")))].map(Number);
  const added = numbersIn(text).filter((figure) => !printed.includes(figure.value)).map((figure) => figure.raw);
  if (added.length) problems.push(`${at}: \`replacement\` prints ${added.map((raw) => `"${raw}"`).join(", ")}, which the page does not: a replacement uses only the figures the page already prints, and adds no number, cause or comparison`);
  return problems;
}

// What a question is read against: its context and what is shown beside it. Questions that share it - the lines of one page
// of commentary - are staged side by side and shown it once.
const surroundings = (item) => canonical([item.context ?? null, item.beside ?? null]);

const PACKET_NAME = /^packet-\d+$/;
const packetDirs = async (folder) => (await fs.readdir(folder, { withFileTypes: true }).catch(() => [])).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

/** A page run's folder under judgements/, removed once its last packet is: an empty folder would read as a section still waiting. */
async function dropEmptyScope(root, scope) {
  if (scope) await fs.rmdir(path.join(root, scope)).catch(() => {});
}

/** Every problem with one packet's answer, as sentences: every question answered once, a verdict of its kind, quotes of its subject. */
function packetProblems(packet, answer) {
  const problems = [];
  if (answer?.batch !== packet.batch) problems.push(`the answer is for batch "${answer?.batch}", and the packet is "${packet.batch}": answer the packet staged in this folder`);
  const given = new Map();
  for (const entry of Array.isArray(answer?.judgements) ? answer.judgements : []) {
    if (given.has(entry?.key)) problems.push(`${entry.key}: answered twice`);
    given.set(entry?.key, entry);
  }
  for (const key of given.keys()) if (!packet.items.some((item) => item.key === key)) problems.push(`${key}: no such question in the packet`);
  for (const item of packet.items) problems.push(...(given.has(item.key) ? answerProblems(item, given.get(item.key)) : [`${item.key} (${item.kind}): not answered`]));
  return { problems, given };
}

