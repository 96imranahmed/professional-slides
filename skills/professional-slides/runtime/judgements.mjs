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
// asked again everywhere. A rule whose question is not answered yet does not
// hold: the compile lists it as pending (JUDGEMENTS_PENDING), `judge.mjs`
// stages the pending questions for a model, and delivery refuses a deck with
// any still open. gates/judgements.py reads the same file by the same key.
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readJsonSync } from "./cli.mjs";

const DEFINITIONS = readJsonSync(new URL("./judgement-kinds.json", import.meta.url));
/** Every kind of question a rule may ask: its version, question, verdicts and the fields an answer carries. */
export const JUDGEMENT_KINDS = Object.freeze(DEFINITIONS.kinds);
export const JUDGEMENTS_SCHEMA = "professional-slides.judgements/v1";
export const PACKET_DIR = "judgements";
// A packet holds this many questions at most: a reader answers a short list well, and the rest follow in the next packet.
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
  return { verdicts: new Map(Object.entries(verdicts)), pending: new Map(), read: new Set(), oracle, file };
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
 */
export function judged(kind, subject, context = null, where = null, { image = null } = {}) {
  const known = recordedJudgement(kind, subject, context);
  if (known || !active) return known;
  const key = judgementKey(kind, subject, context);
  const open = active.pending.get(key) ?? { key, kind, subject, context: context ?? null, where: [], ...(image ? { image } : {}) };
  if (where !== null && where !== undefined && !open.where.includes(String(where))) open.where.push(String(where));
  active.pending.set(key, open);
  return null;
}

/** The recorded answer to a question, or null - without adding it to the pending list (a picture is fetched to be asked about only when no answer is recorded). */
export function recordedJudgement(kind, subject, context = null) {
  const key = judgementKey(kind, subject, context);
  if (!active) return null;
  const said = active.oracle ? active.oracle(kind, subject, context) : null;
  if (said) return typeof said === "string" ? { verdict: said } : said;
  const known = active.verdicts.get(key);
  if (known) active.read.add(key);
  return known ?? null;
}

/** A question met elsewhere - by the Python gates, which hash it the same way - added to the session's pending list. */
export function addPending(session, request) {
  if (!session || !request?.kind || !JUDGEMENT_KINDS[request.kind]) return;
  const key = judgementKey(request.kind, request.subject, request.context ?? null);
  if (session.verdicts.has(key)) return;
  const open = session.pending.get(key) ?? { key, kind: request.kind, subject: request.subject, context: request.context ?? null, where: [], ...(request.image ? { image: request.image } : {}) };
  for (const where of [].concat(request.where ?? [])) if (!open.where.includes(String(where))) open.where.push(String(where));
  session.pending.set(key, open);
}

export const judgementStorePath = (dir, stem) => path.join(dir, `${stem}.judgements.json`);

/** The deck's recorded judgements: `{ schema, verdicts }`, empty where none are recorded yet. */
export async function readJudgementStore(dir, stem) {
  try { return JSON.parse(await fs.readFile(judgementStorePath(dir, stem), "utf8")); }
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
      }
    }
  }
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
      : { type: "string" } });
  const fields = Object.fromEntries(kinds.flatMap((kind) => Object.entries(JUDGEMENT_KINDS[kind].fields || {})).map(([name, field]) => [name, typed(field)]));
  const properties = { key: { type: "string", enum: items.map((item) => item.key) }, verdict: { type: "string", enum: [...new Set(kinds.flatMap((kind) => Object.keys(JUDGEMENT_KINDS[kind].verdicts)))] },
    reason: { type: "string" }, quote: { type: ["string", "null"] }, ...fields };
  return { type: "object", additionalProperties: false, required: ["batch", "judgements"], properties: {
    batch: { type: "string" },
    judgements: { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(properties), properties } } } };
}

/** The prompt a packet's reader is given: each kind's question once, then its subjects, then the form of the answer. */
export function judgementPrompt(packet) {
  const byKind = new Map();
  for (const item of packet.items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
  const sections = [...byKind].map(([kind, items]) => {
    const spec = JUDGEMENT_KINDS[kind];
    const verdicts = Object.entries(spec.verdicts).map(([verdict, meaning]) => `  - "${verdict}": ${meaning}`).join("\n");
    const fields = Object.entries(spec.fields || {}).map(([name, field]) => `  - \`${name}\`${field.for ? ` (with ${field.for.map((v) => `"${v}"`).join(" or ")})` : ""}: ${field.about}`).join("\n");
    const quoted = (spec.quoteFor || []).length ? `\nWith ${spec.quoteFor.map((v) => `"${v}"`).join(" or ")}, set \`quote\` to the words of the subject the verdict rests on, copied exactly.` : "";
    return `## ${kind}\n${spec.asks}\nSubject: ${spec.subject}\nVerdicts:\n${verdicts}${fields ? `\nFields:\n${fields}` : ""}${quoted}\n\n` +
      items.map((item) => `### ${item.key}\n${item.image ? `Image: ${item.image} (open it)\n` : ""}Subject: ${JSON.stringify(item.subject)}${item.context ? `\nContext: ${JSON.stringify(item.context)}` : ""}`).join("\n\n");
  });
  return `You are reading parts of a slide deck to answer a few precise questions about them, one at a time. Judge each from what is given - its subject and its context - and nothing else: do not look anything up, and do not judge the deck as a whole. Choose the verdict the words support; where the words leave it open, choose the verdict a careful editor would, and say why. Every answer gives its reason in a sentence.\n\n` +
    `${sections.join("\n\n")}\n\n## Answer\nReturn JSON only: { "batch": "${packet.batch}", "judgements": [ { "key": "<the question's key>", "verdict": "<one of its verdicts>", "reason": "<a sentence>", "quote": "<where asked, else null>", ... } ] }, one judgement for each of the ${packet.items.length} keys above; a field its kind does not ask for, or its verdict does not take, is null.\n`;
}

/**
 * The pending questions staged as a packet in <dir>/judgements/: packet.json
 * (the questions, keyed), prompt.md, schema.json, and an images/ folder where
 * a question is about a picture. At most PACKET_ITEMS_MAX questions; the rest
 * wait for the next packet. Returns the packet and how many are left.
 */
export async function stageJudgements(dir, requests, { max = PACKET_ITEMS_MAX } = {}) {
  const folder = path.join(dir, PACKET_DIR);
  await fs.mkdir(folder, { recursive: true });
  await fs.rm(path.join(folder, "images"), { recursive: true, force: true });
  const items = [];
  for (const { key, kind, subject, context, where, image } of [...requests].sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key)).slice(0, max)) {
    // A question about a picture carries a copy of it in the packet, named by the question's key.
    let staged = null;
    if (image) {
      staged = `images/${key}${path.extname(image).toLowerCase() || ".jpg"}`;
      await fs.mkdir(path.join(folder, "images"), { recursive: true });
      await fs.copyFile(image, path.join(folder, staged));
    }
    items.push({ key, kind, subject, context: context ?? null, where: where ?? [], ...(staged ? { image: staged } : {}) });
  }
  const packet = { schema: JUDGEMENTS_SCHEMA, batch: createHash("sha256").update(items.map((item) => item.key).join("\n")).digest("hex").slice(0, 16), items };
  await fs.writeFile(path.join(folder, "packet.json"), `${JSON.stringify(packet, null, 1)}\n`);
  await fs.writeFile(path.join(folder, "prompt.md"), judgementPrompt(packet));
  await fs.writeFile(path.join(folder, "schema.json"), `${JSON.stringify(answerSchema(items), null, 1)}\n`);
  return { packet, folder, left: Math.max(0, requests.length - items.length) };
}

/**
 * The answer to the staged packet (<dir>/judgements/answer.json, or `file`)
 * checked against it and recorded in the deck's judgements file: every
 * question answered once, each verdict one of its kind's, each quote words of
 * its subject. Nothing is recorded from an answer with a problem. Returns
 * `{ recorded, problems }`; with no answer waiting, `{ recorded: 0, problems: [] }`.
 */
export async function recordAnswer(dir, stem, { file = null, by = null } = {}) {
  const folder = path.join(dir, PACKET_DIR), answerFile = file ?? path.join(folder, "answer.json");
  let answer;
  try { answer = JSON.parse(await fs.readFile(answerFile, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return { recorded: 0, problems: [] }; return { recorded: 0, problems: [`${answerFile} is not valid JSON`] }; }
  let packet;
  try { packet = JSON.parse(await fs.readFile(path.join(folder, "packet.json"), "utf8")); }
  catch { return { recorded: 0, problems: [`${answerFile} answers no staged packet: run judge.mjs to stage the questions first`] }; }
  const problems = [];
  if (answer?.batch !== packet.batch) problems.push(`the answer is for batch "${answer?.batch}", and the staged packet is "${packet.batch}": answer the packet staged now`);
  const given = new Map();
  for (const entry of Array.isArray(answer?.judgements) ? answer.judgements : []) {
    if (given.has(entry?.key)) problems.push(`${entry.key}: answered twice`);
    given.set(entry?.key, entry);
  }
  for (const key of given.keys()) if (!packet.items.some((item) => item.key === key)) problems.push(`${key}: no such question in the packet`);
  for (const item of packet.items) problems.push(...(given.has(item.key) ? answerProblems(item, given.get(item.key)) : [`${item.key} (${item.kind}): not answered`]));
  if (problems.length) return { recorded: 0, problems };
  const store = await readJudgementStore(dir, stem);
  const at = new Date().toISOString();
  for (const item of packet.items) {
    const { key: _key, ...said } = given.get(item.key);
    store.verdicts[item.key] = { kind: item.kind, version: JUDGEMENT_KINDS[item.kind].version, ...said, subject: item.subject, answeredAt: at, ...(by ? { by } : {}) };
  }
  await fs.writeFile(judgementStorePath(dir, stem), `${JSON.stringify({ schema: JUDGEMENTS_SCHEMA, verdicts: store.verdicts }, null, 1)}\n`);
  await fs.rm(answerFile, { force: true });
  await fs.rm(path.join(folder, "packet.json"), { force: true });
  return { recorded: packet.items.length, problems: [] };
}

/** The pending questions of a session, as a finding: JUDGEMENTS_PENDING, with how many of each kind and where. */
export function pendingFinding(session, { pagesFile = "<id>.pages.json" } = {}) {
  const open = [...(session?.pending?.values() ?? [])];
  if (!open.length) return null;
  const kinds = Object.entries(open.reduce((n, item) => ({ ...n, [item.kind]: (n[item.kind] ?? 0) + 1 }), {})).map(([kind, count]) => `${kind} ${count}`);
  return { code: "JUDGEMENTS_PENDING", severity: "advisory", measured: { pending: open.length, kinds: Object.fromEntries(kinds.map((k) => k.split(" ")).map(([k, v]) => [k, Number(v)])) },
    pages: [...new Set(open.flatMap((item) => item.where))].slice(0, 40),
    repair: `${open.length} question${open.length === 1 ? "" : "s"} the rules ask of the copy ${open.length === 1 ? "is" : "are"} not answered yet (${kinds.join(", ")}), so the rules that ask ${open.length === 1 ? "it do" : "them do"} not hold. Run node runtime/judge.mjs ${pagesFile}: give its prompt to a fresh model, save the answer and run it again until it exits 0. Delivery refuses a deck with questions open` };
}
