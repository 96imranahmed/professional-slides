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
import { numbersIn } from "./claims.mjs";
import { measureText } from "./text-layout.mjs";

const DEFINITIONS = readJsonSync(new URL("./judgement-kinds.json", import.meta.url));
/** Every kind of question a rule may ask: its version, question, verdicts and the fields an answer carries. */
export const JUDGEMENT_KINDS = Object.freeze(DEFINITIONS.kinds);
export const JUDGEMENTS_SCHEMA = "professional-slides.judgements/v1";
export const PACKET_DIR = "judgements";
// A packet holds this many questions at most: a reader answers a short list well, and a deck's questions are split across
// packets that fresh readers answer side by side.
export const PACKET_ITEMS_MAX = 60;

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
/**
 * The figures each composed page prints, kept on the session by page id: what a judge's replacement for one of its lines
 * may use (answerProblems). A replacement brings no number the page does not already print - a new figure is a new fact
 * for the self-check and the critique to read, and the closed fix is closed because it adds none.
 */
export function notePageFigures(session, slides) {
  for (const slide of session ? slides ?? [] : []) {
    const printed = (slide.nodes ?? []).filter((node) => node?.type === "text" && !FURNITURE_ROLE.test(String(node.role ?? "")))
      .flatMap((node) => numbersIn(node.data?.textLayout?.source ?? node.text ?? "").map((figure) => figure.raw.replace(/,/g, "")));
    session.figures.set(String(slide.id), [...new Set(printed)]);
  }
}

/** The session's pending questions, each with the figures its pages print (notePageFigures), for judge.mjs to stage. */
export function pendingRequests(session) {
  return [...(session?.pending?.values() ?? [])].map((item) => {
    const figures = [...new Set(item.where.flatMap((id) => session.figures?.get(String(id)) ?? []))];
    return figures.length ? { ...item, figures } : item;
  });
}

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
/** The session the rules read now, or null. */
export const activeJudgements = () => active;

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

/**
 * Record every question asked from now, with the answer it was given, in order; the function returned stops and
 * returns them. What a cache keeps beside work whose result turns on those answers (author-deck.mjs
 * openComposeCache), to read the work again only while each answer stands (answersStand) and to ask the same
 * questions when it does (askAgain).
 */
export function askingFrom() {
  const before = asked, mine = [];
  asked = mine;
  return () => { asked = before; return mine; };
}

/** Whether every question in `questions` (askedDuring) would be given the answer it was given then. Notes nothing. */
export function answersStand(questions) {
  return Array.isArray(questions) && questions.every((q) => JUDGEMENT_KINDS[q?.kind] && JSON.stringify(answerOf(q.kind, q.subject, q.context ?? null, { note: false })) === JSON.stringify(q.said ?? null));
}

/** The questions in `questions` asked again, in order, as the work that asked them did: its pending questions and its reads noted alike. */
export function askAgain(questions) {
  for (const q of questions) {
    if (q.ask === "judged") judged(q.kind, q.subject, q.context ?? null, q.where ?? null, { ...(q.image ? { image: q.image } : {}), ...(q.beside ? { beside: q.beside } : {}) });
    else recordedJudgement(q.kind, q.subject, q.context ?? null);
  }
}

/** A question met elsewhere - by the Python gates, which hash it the same way - added to the session's pending list. */
export function addPending(session, request) {
  if (!session || !request?.kind || !JUDGEMENT_KINDS[request.kind]) return;
  const key = judgementKey(request.kind, request.subject, request.context ?? null);
  if (session.verdicts.has(key)) return;
  const open = session.pending.get(key) ?? { key, kind: request.kind, subject: request.subject, context: request.context ?? null, where: [], ...(request.image ? { image: request.image } : {}),
    ...(request.beside ? { beside: request.beside } : {}) };
  for (const where of [].concat(request.where ?? [])) if (!open.where.includes(String(where))) open.where.push(String(where));
  session.pending.set(key, open);
}

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

/**
 * The answer schema a packet's reader writes to: one judgement per question,
 * keyed. Every property is required, as a strict structured output asks, and
 * one that does not apply to the verdict given is null.
 */
export function answerSchema(items) {
  const kinds = [...new Set(items.map((item) => item.kind))];
  const typed = (field) => (field.type === "number" ? { type: ["number", "null"] } : field.type === "string" ? { type: ["string", "null"] }
    : { type: ["array", "null"], items: field.of === "quoted"
      ? { type: "object", additionalProperties: false, required: ["phrase", "share"], properties: { phrase: { type: "string" }, share: { type: "number" } } }
      : field.of === "cells" ? { type: "object", additionalProperties: false, required: ["cell", "value"], properties: { cell: { type: "string" }, value: { type: "string", enum: field.values } } }
      : field.of === "pair" ? { type: "array", items: { type: "string" } }
      : { type: "string" } });
  const fields = Object.fromEntries(kinds.flatMap((kind) => Object.entries(JUDGEMENT_KINDS[kind].fields || {})).map(([name, field]) => [name, typed(field)]));
  // What a failing answer mends its subject with (fixProblems): a replacement and the reason it passes, or the change named.
  const fixes = new Set(kinds.map((kind) => JUDGEMENT_KINDS[kind].fix?.by).filter(Boolean));
  const mends = { ...(fixes.has("replace") ? { replacement: { type: ["string", "null"] }, replacementReason: { type: ["string", "null"] } } : {}), ...(fixes.has("choose") ? { fix: { type: ["string", "null"] } } : {}) };
  const properties = { key: { type: "string", enum: items.map((item) => item.key) }, verdict: { type: "string", enum: [...new Set(kinds.flatMap((kind) => Object.keys(JUDGEMENT_KINDS[kind].verdicts)))] },
    reason: { type: "string" }, quote: { type: ["string", "null"] }, ...fields, ...mends };
  return { type: "object", additionalProperties: false, required: ["batch", "judgements"], properties: {
    batch: { type: "string" },
    judgements: { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(properties), properties } } } };
}

// What a question is read against: its context and what is shown beside it. Questions that share it - the lines of one page
// of commentary - are staged side by side and shown it once.
const surroundings = (item) => canonical([item.context ?? null, item.beside ?? null]);

/**
 * The prompt a packet's reader is given: each kind's question once, then its subjects, then the form of the answer.
 * `validate` is the command that checks the answer as it will be recorded (judge.mjs --validate), which the reader runs
 * before handing back where it can run one.
 */
export function judgementPrompt(packet, { validate = null } = {}) {
  const byKind = new Map();
  for (const item of packet.items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
  // A question whose failure is mended by a replacement shows what the replacement may use: its slot and the page's figures.
  const span = (slot) => [Number.isFinite(slot?.words?.min) ? `at least ${slot.words.min}` : null, Number.isFinite(slot?.words?.max) ? `at most ${slot.words.max}` : null].filter(Boolean).join(" and ");
  const mendable = (item) => JUDGEMENT_KINDS[item.kind].fix?.by === "replace"
    ? `${span(item.slot) ? `\nSlot: ${span(item.slot)} words${item.slot?.measure && Number.isFinite(item.slot?.lines?.max) ? `, on ${item.slot.lines.max} lines at most as the page sets it` : ""}` : ""}${item.figures?.length ? `\nFigures the page prints: ${item.figures.join(", ")}` : ""}` : "";
  const asked = (item, shared) => `### ${item.key}\n${item.image ? `Image: ${item.image} (open it)\n` : ""}Subject: ${JSON.stringify(item.subject)}` +
    `${!shared && item.context ? `\nContext: ${JSON.stringify(item.context)}` : ""}${!shared && item.beside ? `\nBeside it: ${JSON.stringify(item.beside)}` : ""}${mendable(item)}`;
  const mend = (spec) => {
    const failing = (spec.fix?.for || []).map((v) => `"${v}"`).join(" or ");
    if (spec.fix?.by === "replace") return `\nWith ${failing}, mend it in the same answer, so this is the last reading: set \`replacement\` to the ${spec.fix.slot === "title" ? "title" : "line"} rewritten so this question, asked of it, answers "${spec.fix.passes}", and \`replacementReason\` to that answer's reason in a sentence. The writer applies it word for word and it is recorded as judged, so it must stand on its own: use only facts the page already gives - no figure it does not print (the figures are listed under each question), no new cause or comparison - and keep within the slot given.`;
    if (spec.fix?.by === "choose") return `\nWith ${failing}, no one line mends it: set \`fix\` to the change the writer makes, in a sentence (which ${spec.subject.split(",")[0].replace(/^the /, "")} to merge, redraw or drop, and how).`;
    return "";
  };
  const sections = [...byKind].map(([kind, items]) => {
    const spec = JUDGEMENT_KINDS[kind];
    const verdicts = Object.entries(spec.verdicts).map(([verdict, meaning]) => `  - "${verdict}": ${meaning}`).join("\n");
    const fields = Object.entries(spec.fields || {}).map(([name, field]) => `  - \`${name}\`${field.for ? ` (with ${field.for.map((v) => `"${v}"`).join(" or ")})` : ""}: ${field.about}`).join("\n");
    const quoted = (spec.quoteFor || []).length ? `\nWith ${spec.quoteFor.map((v) => `"${v}"`).join(" or ")}, set \`quote\` to the words of the subject the verdict rests on, copied exactly.` : "";
    const runs = [];
    for (const item of items) { const last = runs.at(-1); if (last && surroundings(last[0]) === surroundings(item)) last.push(item); else runs.push([item]); }
    return `## ${kind}\n${spec.asks}\nSubject: ${spec.subject}\nVerdicts:\n${verdicts}${fields ? `\nFields:\n${fields}` : ""}${quoted}${mend(spec)}\n\n` +
      runs.map((run) => {
        const [first] = run;
        if (run.length === 1 || !(first.context || first.beside)) return run.map((item) => asked(item, false)).join("\n\n");
        return `The ${run.length} questions that follow are read against the same words:${first.context ? `\nContext: ${JSON.stringify(first.context)}` : ""}${first.beside ? `\nBeside each: ${JSON.stringify(first.beside)}` : ""}\n\n` +
          run.map((item) => asked(item, true)).join("\n\n");
      }).join("\n\n");
  });
  const check = validate ? `\n## Before you hand back\nIf you can run commands, check the answer as it will be recorded: save it as answer.json in this packet's folder and run\n\n    ${validate}\n\nIt prints every reason the answer would be refused - a question unanswered or answered twice, a key not in this packet, a verdict its kind does not take, a field its verdict needs, a quote that is not the subject's words, a failing verdict without its replacement, a replacement past its slot or printing a figure the page does not. Fix each and run it again until it says the answer would be recorded. A reader without a shell hands back as it is: the answer is checked when it is recorded.\n` : "";
  return `You are reading parts of a slide deck to answer a few precise questions about them, one at a time. Judge each from what is given - its subject and its context - and nothing else: do not look anything up, and do not judge the deck as a whole. Choose the verdict the words support; where the words leave it open, choose the verdict a careful editor would, and say why. Every answer gives its reason in a sentence.\n\n` +
    `${sections.join("\n\n")}\n\n## Answer\nReturn JSON only: { "batch": "${packet.batch}", "judgements": [ { "key": "<the question's key>", "verdict": "<one of its verdicts>", "reason": "<a sentence>", "quote": "<where asked, else null>", ... } ] }, one judgement for each of the ${packet.items.length} keys above; a field its kind does not ask for, or its verdict does not take, is null - a replacement or a fix included, where the verdict passes.\n${check}`;
}

const PACKET_NAME = /^packet-\d+$/;
const packetDirs = async (folder) => (await fs.readdir(folder, { withFileTypes: true }).catch(() => [])).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

/**
 * The packets staged in <dir>/judgements/, in order: `{ folder, packet, answered, scope }`, `answered` where an answer.json
 * waits beside it. A plain run's packets sit in judgements/ itself (`scope` null); a page run's (judge.mjs --page) in a
 * folder of their own, judgements/<scope>/, so sections judged side by side never stage over each other's packets.
 */
export async function stagedPackets(dir) {
  const root = path.join(dir, PACKET_DIR);
  const names = await packetDirs(root);
  const folders = names.filter((name) => PACKET_NAME.test(name)).map((name) => ({ folder: path.join(root, name), scope: null }));
  for (const scope of names.filter((name) => !PACKET_NAME.test(name))) {
    folders.push(...(await packetDirs(path.join(root, scope))).filter((name) => PACKET_NAME.test(name)).map((name) => ({ folder: path.join(root, scope, name), scope })));
  }
  const found = [];
  for (const { folder, scope } of folders) {
    const packet = await fs.readFile(path.join(folder, "packet.json"), "utf8").then(JSON.parse, () => null);
    if (packet) found.push({ folder, packet, answered: await fs.access(path.join(folder, "answer.json")).then(() => true, () => false), scope });
  }
  return found;
}

/** A packet as a reader is told of it: its folder under judgements/ ("packet-02", or "1-atlantic/packet-02" for a page run's). */
export const packetName = (dir, folder) => path.relative(path.join(dir, PACKET_DIR), folder);

/**
 * Every pending question staged at once, in as few packets of
 * PACKET_ITEMS_MAX at most as hold them, of even sizes, each in its own folder (judgements/packet-01/, packet-02/, ...) with
 * its packet.json, prompt.md, schema.json and, where a question is about a
 * picture, images/. The packets are independent, so fresh readers answer them
 * side by side. A packet already staged whose questions are all still open is
 * kept as it is - a reader may be answering it now - and one that is not is
 * removed, its open questions staged again with the rest. Returns `{ packets,
 * fresh }`: every packet waiting, and how many were staged by this call.
  *
 * With `scope` - a page run (judge.mjs --page), whose `requests` are only its
 * pages' questions - the packets go in judgements/<scope>/ and only that
 * scope's are kept or removed: a section judged beside it is not this run's to
 * restage, and a question one of its packets already holds is not staged
 * twice (those packets are returned as `elsewhere`). A plain run reads every
 * packet staged, a page run's included, against every open question, as before.
 *
 * `validate`, given a packet's folder, is the command its prompt tells the
 * reader to check the answer with (judgementPrompt). `slots`, by name, are the
 * limits the writer brief prints (limits.mjs deckLimits: `textBlock`, `title`):
 * a question whose failure is mended by a replacement carries its kind's slot.
 */
export async function stageJudgements(dir, requests, { max = PACKET_ITEMS_MAX, scope = null, validate = null, slots = null } = {}) {
  const root = path.join(dir, PACKET_DIR), home = scope ? path.join(root, scope) : root;
  await fs.mkdir(home, { recursive: true });
  const open = new Map(requests.map((request) => [request.key, request]));
  const kept = [], elsewhere = [];
  for (const staged of await stagedPackets(dir)) {
    if (scope && staged.scope !== scope) {
      if (staged.packet.items.some((item) => open.has(item.key))) { elsewhere.push(staged); for (const item of staged.packet.items) open.delete(item.key); }
      continue;
    }
    if (staged.packet.items.every((item) => open.has(item.key))) { kept.push(staged); for (const item of staged.packet.items) open.delete(item.key); }
    else { await fs.rm(staged.folder, { recursive: true, force: true }); await dropEmptyScope(root, staged.scope); }
  }
  let number = Math.max(0, ...kept.filter((staged) => staged.scope === scope).map(({ folder }) => Number(path.basename(folder).slice("packet-".length))));
  // Questions read against the same words sit together, so the prompt shows those words once.
  const around = new Map([...open.values()].map((request) => [request.key, surroundings(request)]));
  const rest = [...open.values()].sort((a, b) => a.kind.localeCompare(b.kind) || around.get(a.key).localeCompare(around.get(b.key)) || a.key.localeCompare(b.key));
  // As few packets as `max` allows, of even sizes, so readers working side by side finish together.
  const size = rest.length ? Math.ceil(rest.length / Math.ceil(rest.length / max)) : max;
  const fresh = [];
  for (let at = 0; at < rest.length; at += size) {
    number += 1;
    const folder = path.join(home, `packet-${String(number).padStart(2, "0")}`);
    await fs.mkdir(folder, { recursive: true });
    const items = [];
    for (const { key, kind, subject, context, where, image, beside, figures, slot: own } of rest.slice(at, at + size)) {
      // A question about a picture carries a copy of it in the packet, named by the question's key.
      let staged = null;
      if (image) {
        staged = `images/${key}${path.extname(image).toLowerCase() || ".jpg"}`;
        await fs.mkdir(path.join(folder, "images"), { recursive: true });
        await fs.copyFile(image, path.join(folder, staged));
      }
      // A question a replacement mends carries what the replacement may use: the slot's limits the writer brief prints, and the page's figures.
      // A question that names its own slot (judged `slot`) is held to that one, with the band its lines are measured in.
      const fix = JUDGEMENT_KINDS[kind].fix, named = slots?.[own?.name ?? fix?.slot];
      const slot = fix?.by === "replace" && named ? { ...named, ...(own?.measure ? { measure: own.measure } : {}) } : null;
      items.push({ key, kind, subject, context: context ?? null, where: where ?? [], ...(staged ? { image: staged } : {}), ...(beside ? { beside } : {}),
        ...(fix?.by === "replace" && figures?.length ? { figures } : {}), ...(slot ? { slot } : {}) });
    }
    const packet = { schema: JUDGEMENTS_SCHEMA, batch: createHash("sha256").update(items.map((item) => item.key).join("\n")).digest("hex").slice(0, 16), items };
    await fs.writeFile(path.join(folder, "packet.json"), `${JSON.stringify(packet, null, 1)}\n`);
    await fs.writeFile(path.join(folder, "prompt.md"), judgementPrompt(packet, { validate: validate ? validate(folder) : null }));
    await fs.writeFile(path.join(folder, "schema.json"), `${JSON.stringify(answerSchema(items), null, 1)}\n`);
    fresh.push({ folder, packet, answered: false, scope });
  }
  return { packets: [...kept, ...fresh], fresh: fresh.length, ...(scope ? { elsewhere } : {}) };
}

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

/**
 * Every reason the recording would refuse the answer in `file`, found without
 * recording anything: its packet is the one beside it (packet.json), else the
 * one staged in `dir` for its batch; it is checked against that packet's schema
 * (a field left out read as null, as the recording reads it) and then as
 * recordAnswers checks it. An answering agent runs this before it hands back
 * (judge.mjs --validate): its packet's schema had only been checked as "it
 * parses", and an answer refused after hand-back is a whole packet asked of a
 * fresh reader again. Returns `{ problems, packet }`.
 */
export async function validateAnswer(dir, file) {
  let answer;
  try { answer = JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { return { problems: [error.code === "ENOENT" ? `${file} does not exist: save the answer there first` : `${path.basename(file)} is not valid JSON (${error.message})`], packet: null }; }
  const own = await readJson(path.join(path.dirname(file), "packet.json"), { optional: true }).catch(() => null);
  const packet = own?.items ? own : (await stagedPackets(dir)).find((staged) => staged.packet.batch === answer?.batch)?.packet;
  if (!packet) return { problems: [`no packet is staged beside ${file}, nor for batch "${answer?.batch}" in ${path.join(dir, PACKET_DIR)}: save the answer as answer.json in the folder of the packet it answers`], packet: null };
  const shape = schemaErrors(answer, answerSchema(packet.items), "the answer", { absentIsNull: true, enums: false });
  return { problems: [...shape, ...packetProblems(packet, answer).problems], packet };
}

/**
 * The answers waiting in the staged packets' folders (answer.json beside each
 * packet.json), each checked against its packet and recorded in the deck's
 * judgements file. A packet is recorded whole or not at all: one whose answer
 * has a problem is left staged with its answer, and the problems are returned
 * under its folder's name; the others are recorded and their folders removed.
 * A failing answer's replacement is recorded too, under its own key, as judged.
 * Returns `{ recorded, problems, refused, waiting }`: `refused`, the folders
 * whose answers were not recorded; `waiting`, the packets still without one.
 */
export async function recordAnswers(dir, stem, { by = null } = {}) {
  judgementStoreNow(dir, stem);  // a store that is not JSON is said before anything is read against it
  const verdicts = {}, replaced = {};
  const at = new Date().toISOString(), problems = [], refused = [], answeredFolders = [];
  let recorded = 0, waiting = 0;
  for (const { folder, packet, answered } of await stagedPackets(dir)) {
    if (!answered) { waiting += 1; continue; }
    const name = packetName(dir, folder);
    let answer;
    try { answer = JSON.parse(await fs.readFile(path.join(folder, "answer.json"), "utf8")); }
    catch { problems.push(`${name}/answer.json is not valid JSON`); refused.push(folder); continue; }
    const checked = packetProblems(packet, answer);
    if (checked.problems.length) { problems.push(...checked.problems.map((problem) => `${name}: ${problem}`)); refused.push(folder); continue; }
    for (const item of packet.items) {
      const { key: _key, ...said } = checked.given.get(item.key);
      const spec = JUDGEMENT_KINDS[item.kind], replacement = spec.fix?.by === "replace" && spec.fix.for.includes(said.verdict) ? String(said.replacement).trim() : null;
      verdicts[item.key] = { kind: item.kind, version: spec.version, ...said, subject: item.subject, answeredAt: at, ...(by ? { by } : {}) };
      // The replacement is judged as it is given: recorded under its own words in the question's context, with the verdict it
      // passes on and the reader's reason, so the writer who applies it word for word is not asked again (runtime-defects 62).
      if (replacement) replaced[judgementKey(item.kind, replacement, item.context ?? null)] = { kind: item.kind, version: spec.version, verdict: spec.fix.passes,
        reason: said.replacementReason, subject: replacement, replaces: item.key, answeredAt: at, ...(by ? { by } : {}) };
    }
    recorded += packet.items.length;
    answeredFolders.push(folder);
  }
  // Sections are judged side by side (judge.mjs --page), so another run may have recorded since this one began: the store is
  // read again as it stands and written in the same tick, whole, by a rename - never from a copy read before the answers were.
  // A question asked in its own right keeps its own reading over a replacement that happens to say the same words.
  if (recorded) {
    const file = judgementStorePath(dir, stem), staged = `${file}.${process.pid}.tmp`;
    const standing = judgementStoreNow(dir, stem).verdicts ?? {};
    writeFileSync(staged, `${JSON.stringify({ schema: JUDGEMENTS_SCHEMA, verdicts: Object.assign(standing, replaced, verdicts) }, null, 1)}\n`);
    renameSync(staged, file);
  }
  // A packet's folder goes only once its answers are in the store.
  for (const folder of answeredFolders) { await fs.rm(folder, { recursive: true, force: true }); await dropEmptyScope(path.join(dir, PACKET_DIR), path.relative(path.join(dir, PACKET_DIR), path.dirname(folder)) || null); }
  return { recorded, problems, refused, waiting };
}


/** The pending questions of a session, as a finding: JUDGEMENTS_PENDING, with how many of each kind and where. */
export function pendingFinding(session, { pagesFile = "<id>.pages.json" } = {}) {
  const open = [...(session?.pending?.values() ?? [])];
  if (!open.length) return null;
  const kinds = Object.entries(open.reduce((n, item) => ({ ...n, [item.kind]: (n[item.kind] ?? 0) + 1 }), {})).map(([kind, count]) => `${kind} ${count}`);
  return { code: "JUDGEMENTS_PENDING", severity: "advisory", measured: { pending: open.length, kinds: Object.fromEntries(kinds.map((k) => k.split(" ")).map(([k, v]) => [k, Number(v)])) },
    pages: [...new Set(open.flatMap((item) => item.where))].slice(0, 40),
    repair: `${open.length} question${open.length === 1 ? "" : "s"} the rules ask of the copy ${open.length === 1 ? "is" : "are"} not answered yet (${kinds.join(", ")}), so the rules that ask ${open.length === 1 ? "it do" : "them do"} not hold. Run node runtime/judge.mjs ${pagesFile}: it stages them as packets of at most ${PACKET_ITEMS_MAX}, each answered by its own fresh model, side by side (or --run claude), and records the answers when run again, until it exits 0. Delivery refuses a deck with questions open` };
}
