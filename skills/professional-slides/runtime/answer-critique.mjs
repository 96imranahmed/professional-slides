#!/usr/bin/env node
// The answer critique: the deck's answer read against the evidence it will be
// built from, before a page is written.
//
//   node runtime/answer-critique.mjs <id>.pages.json out/                  writes the packet for a fresh critic, or records
//                                                                          the critique it returned and says what is open
//   node runtime/answer-critique.mjs <id>.pages.json out/ --validate [file] every reason the critique would be refused;
//                                                                          records nothing
//
// Exit codes (EXIT in errors.mjs): 0 ready (no blocker or major open), 2 revise or an invalid critique, 3 a packet is waiting
// for a critic, 1 a crash or bad usage.
//
// The storyline critique reads the spine - titles, pages, the measures each shows - so it can only run once the skeleton is
// written and compiled. On the BA benchmark its first pass came three quarters of an hour into the run and raised four
// blocking or major items, and every one was in the insight log before a page existed: "the best returns" where the log
// records a rival's margin higher, and a recommendation the log's own local-passenger series undercuts - both in the answer
// itself - and a share set beside rivals' on a basis the log's own calculation note says differs, and a series spanning two
// editions of one survey, which pages then compared. Raised there, each took two more critique passes and three rewrite
// rounds across the sections. Read here, the answer's are one edit, analysis or search before the skeleton is briefed, and
// the log's hazards - the comparisons its own records say they cannot support - are named before any page is written on
// them. Both carry forward: the skeleton and writer briefs print them, and the storyline critique's first pass is told.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, UsageError, commandLine, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { readPagesFileSync } from "./pages-file.mjs";
import { readInsightLog } from "./measures.mjs";
import { alternativesOf, analysisLine, readAnalysis } from "./analysis.mjs";
import { sha256 } from "./review-passes.mjs";

const SELF = fileURLToPath(import.meta.url);
const USAGE = "Usage: answer-critique.mjs <id>.pages.json out/ [--validate [file]]";
export const RECORD_FILE = "answer-critique.json";
const PACKET_DIR = "answer-critique";
const ANSWER_FILE = "answer.json";
const ITEM_MAX = 10;
// A measure's values past this many are named by count: the critic needs the shape and the extremes, not every cell.
const VALUES_MAX = 12;

export const CHECKS = Object.freeze({
  support: "the log records evidence for the claim; a claim no insight supports is narrowed, or researched",
  scope: "a ranked or universal word (best, leads, only, every, all, first, largest, most) holds against the whole set the log records, not only the members the claim names: \"the best returns\" fails where the log records any member earning more",
  basis: "two figures set against each other are on one basis - one definition, one population, one period. Read each insight's calculation note: where it says a figure's basis is undefined, or that two figures are not on the same basis, a comparison of them fails",
  edition: "a series or a change is read from one source edition; points drawn from two editions of a survey, or across a restatement of the accounts, are not a change",
  "missing-analysis": "an analysis the answer's reasoning needs that the log's measures can compute - a split, a share, a gap, an index - so a page can rest on it",
  gap: "evidence the answer needs that the log does not hold: a research task now, or the claim narrowed to what the log holds",
});
export const REMEDIES = Object.freeze({
  narrow: "reword the answer to what the log shows",
  compute: "add the analysis over the log's measures before the skeleton",
  research: "find the data before the skeleton, or narrow the claim if it is not public",
});
const SEVERITIES = Object.freeze({
  blocker: "the answer's verdict or one of its pillars would not survive a reader who checks the log",
  major: "a reason or recommendation overstates the log, or rests on figures that are not on one basis",
  minor: "wording a reader would correct without changing a conclusion",
});
const OPEN_SEVERITIES = new Set(["blocker", "major"]);

// Quotes are compared as a reader reads them: case, curly quotes, dash forms and runs of space do not make two quotes differ.
const plain = (text) => String(text ?? "").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, "\"")
  .replace(/[‐-―−]/g, "-").replace(/\s+/g, " ").trim();

/** The hash a record keeps of the answer it read: what says the answer has changed since. */
export const answerHashOf = (answer) => sha256(plain(answer));

/** The deck's statement: what the critique reads the evidence against. */
export function statementOf(deck) {
  const subQuestions = Array.isArray(deck?.subQuestions) ? deck.subQuestions.filter((q) => typeof q === "string" && q.trim()) : [];
  return { request: deck?.request ?? null, question: deck?.question ?? null, subQuestions, answer: typeof deck?.answer === "string" ? deck.answer : "" };
}

// One measure as the critic reads it: its unit and population, then its recorded values in order, and what is not recorded.
function measureLine(name, m) {
  const keys = Array.isArray(m?.periods) ? m.periods : Array.isArray(m?.members) ? m.members : null;
  const values = Array.isArray(m?.values) ? m.values : null;
  const cells = keys && values ? keys.map((k, i) => `${k} ${values[i] ?? "not recorded"}`) : m?.value !== undefined ? [`${m.period ? `${m.period} ` : ""}${m.value}`] : [];
  const shown = cells.slice(0, VALUES_MAX).join(", ") + (cells.length > VALUES_MAX ? `, and ${cells.length - VALUES_MAX} more` : "");
  const gaps = m?.unavailable && typeof m.unavailable === "object" ? `; not recorded: ${Object.entries(m.unavailable).map(([k, why]) => `${k} (${why})`).join("; ")}` : "";
  return `${name} (${[m?.unit, m?.population].filter(Boolean).join("; ") || "no unit"}): ${shown || "no values"}${m?.computed ? `; computed: ${m.computed}` : ""}${gaps}`;
}

const insightLines = (insight) => [
  `[${insight.id}] (${[insight.strength, insight.shape].filter(Boolean).join(", ")}) ${insight.finding ?? ""}`,
  `   calculation: ${insight.calculation ?? "none recorded"}`,
  ...Object.entries(insight.measures ?? {}).map(([name, m]) => `   ${measureLine(name, m)}`),
  ...(insight.sources?.length ? [`   sources: ${insight.sources.join(", ")}`] : []),
];

/**
 * What the critique reads: the deck's statement, the insight log (its parts merged, measures.mjs readInsightLog) and the
 * analyses the runtime computed over it. `binding` changes when any of them does, so a record names the answer it read.
 */
export async function answerEvidence(pagesFile) {
  const file = path.resolve(pagesFile);
  const base = path.dirname(file), stem = path.basename(file).replace(/\.pages\.json$/, "");
  const doc = readPagesFileSync(file);
  const statement = statementOf(doc.deck);
  const log = await readInsightLog(base, stem);
  const insights = Array.isArray(log?.insights) ? log.insights : [];
  const analysis = log ? await readAnalysis(base, stem, log, { alternatives: alternativesOf(doc.deck) }) : { results: [] };
  const analyses = (analysis.results ?? []).map((r) => ({ id: r.id, line: analysisLine(r) }));
  const binding = sha256(JSON.stringify({ statement, insights: insights.map((i) => [i.id, i.finding, i.calculation, i.measures ?? null]), analyses }));
  return { file, base, stem, statement, insights, analyses, binding, answerHash: answerHashOf(statement.answer) };
}

const ITEM_FIELDS = ["id", "check", "severity", "claim", "insights", "problem", "remedy", "fix"];

/** The packet's prompt: the statement, the log in full, the checks and the form of the answer. */
export function answerPrompt(evidence, { answerFile, prior = [] } = {}) {
  const { statement, insights, analyses } = evidence;
  const priorLines = prior.length ? `
RAISED ON AN EARLIER ANSWER. The answer was revised after an earlier critique raised these. Give each a status in \`prior\` - settled where the answer above no longer makes the claim or the log now supports it, open where it still stands - and raise it again as an item only if it is open:
${prior.map((item) => `- ${item.id} (${item.severity}, ${item.check}): "${item.claim}" - ${item.problem}`).join("\n")}
` : "";
  return `You read a deck's answer against the evidence it will be built from, before any page is written. You did not write the answer. Read it the way a senior partner reads a draft executive summary with the data open: what does the record support, and what would a reader who checks the numbers refuse? Nothing is drawn yet, so every item you raise costs one edit now instead of a rewrite of the pages later.

THE REQUEST (the user's words): ${statement.request ?? "not recorded"}
${statement.question ? `THE QUESTION: ${statement.question}\n` : ""}${statement.subQuestions.length ? `SUB-QUESTIONS:\n${statement.subQuestions.map((q) => `- ${q}`).join("\n")}\n` : ""}THE ANSWER:
${statement.answer || "(none written)"}

THE INSIGHT LOG: every finding the deck can rest on, how it was calculated, and the values recorded. Read the calculation notes: they say what each figure is a share of, which source edition it comes from, and where two figures are not on one basis.
${insights.map((i) => insightLines(i).join("\n")).join("\n") || "(no insights recorded)"}

COMPUTED ANALYSES (run by the runtime over the log's measures):
${analyses.map((a) => `- ${a.line}`).join("\n") || "- none"}
${priorLines}
THE CHECKS. Read every claim the answer makes - each verdict, comparison, ranking and recommendation - against the log:
${Object.entries(CHECKS).map(([check, rule]) => `- ${check}: ${rule}`).join("\n")}

SEVERITY:
${Object.entries(SEVERITIES).map(([s, rule]) => `- ${s}: ${rule}`).join("\n")}

THE LOG'S HAZARDS. Whether or not the answer makes the claim, list in \`hazards\` the comparisons the log itself cannot support, so no page is written on them: figures its calculation notes put on different or undefined bases, a series whose points come from two editions or a restatement, a ranking whose recorded set leaves out members a reader would expect. Each names the insights, the problem and the rule a page must keep (at most ${ITEM_MAX}; none where the log has none).

Raise at most ${ITEM_MAX} items, the ones that most change whether the answer is supported; an answer the log supports throughout has none, and saying so is a full answer. For each item: \`claim\` quotes the answer's words exactly; \`insights\` names the insight or analysis ids the problem is read from (empty only for a gap); \`remedy\` is ${Object.entries(REMEDIES).map(([r, rule]) => `${r} (${rule})`).join(", ")}; \`fix\` gives the narrowed wording, the analysis and its inputs, or the data and where it is published.

Return JSON only:
{ "verdict": "ready" | "revise", "summary": "<two or three sentences>", "items": [ { ${ITEM_FIELDS.map((f) => `"${f}": ...`).join(", ")} } ], "hazards": [ { "insights": [...], "problem": "...", "rule": "<what a page must not do, or must say>" } ]${prior.length ? `, "prior": [ { "id": "<the earlier item's id>", "status": "settled" | "open", "note": "<why>" } ]` : ""} }
\`verdict\` is revise when any blocker or major item is raised, else ready. Item ids are A1, A2 and so on.

BEFORE YOU HAND BACK, if you can run a command: save the answer as ${answerFile} and run \`${commandLine("node", SELF, evidence.file, path.dirname(path.dirname(answerFile)), "--validate", answerFile)}\`. It prints every reason the answer would be refused; fix each and run it again until it says the answer would be recorded.`;
}

/** Every reason a returned critique would be refused against the packet waiting. */
export function answerCritiqueErrors(review, evidence, { prior = [] } = {}) {
  if (!review || typeof review !== "object" || Array.isArray(review)) return ["the answer is not a JSON object"];
  const errors = [];
  const known = new Set([...evidence.insights.map((i) => i.id), ...evidence.analyses.map((a) => a.id)]);
  const read = plain(evidence.statement.answer);
  if (!["ready", "revise"].includes(review.verdict)) errors.push("`verdict` is ready or revise");
  if (typeof review.summary !== "string" || !review.summary.trim()) errors.push("`summary` says in two or three sentences how far the log supports the answer");
  const items = Array.isArray(review.items) ? review.items : null;
  if (!items) errors.push("`items` is a list, empty where the log supports the answer throughout");
  else {
    if (items.length > ITEM_MAX) errors.push(`${items.length} items: raise at most ${ITEM_MAX}, the ones that most change whether the answer is supported`);
    const ids = new Set();
    items.forEach((item, n) => {
      const at = `items[${n}]${item?.id ? ` (${item.id})` : ""}`;
      for (const field of ITEM_FIELDS) if (item?.[field] === undefined) errors.push(`${at}: \`${field}\` is missing`);
      if (item?.id !== undefined && (typeof item.id !== "string" || !/^A\d+$/.test(item.id))) errors.push(`${at}: \`id\` is A1, A2 and so on`);
      if (ids.has(item?.id)) errors.push(`${at}: the id is used twice`);
      ids.add(item?.id);
      if (item?.check !== undefined && !Object.hasOwn(CHECKS, item.check)) errors.push(`${at}: \`check\` is one of ${Object.keys(CHECKS).join(", ")}`);
      if (item?.severity !== undefined && !Object.hasOwn(SEVERITIES, item.severity)) errors.push(`${at}: \`severity\` is one of ${Object.keys(SEVERITIES).join(", ")}`);
      if (item?.remedy !== undefined && !Object.hasOwn(REMEDIES, item.remedy)) errors.push(`${at}: \`remedy\` is one of ${Object.keys(REMEDIES).join(", ")}`);
      // The quote is what the lead edits: one not in the answer cannot be found to narrow.
      if (typeof item?.claim === "string" && (!item.claim.trim() || !read.includes(plain(item.claim)))) errors.push(`${at}: \`claim\` quotes the answer's words exactly; "${item.claim}" is not in it`);
      if (item?.insights !== undefined && !Array.isArray(item.insights)) errors.push(`${at}: \`insights\` is a list of insight or analysis ids`);
      else if (Array.isArray(item?.insights)) {
        const unknown = item.insights.filter((id) => !known.has(id));
        if (unknown.length) errors.push(`${at}: ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not in the log`);
        // A problem read from the log names where; only a gap - evidence the log lacks - names none.
        if (!item.insights.length && item.check !== "gap") errors.push(`${at}: name the insights the problem is read from; only a gap names none`);
      }
      for (const field of ["problem", "fix"]) if (item?.[field] !== undefined && (typeof item[field] !== "string" || !item[field].trim())) errors.push(`${at}: \`${field}\` is a sentence`);
    });
    // The verdict is read off the items, as the storyline critique's is.
    const open = items.some((item) => OPEN_SEVERITIES.has(item?.severity));
    if (review.verdict === "ready" && open) errors.push("`verdict` is revise: a blocker or major item is raised");
    if (review.verdict === "revise" && !open) errors.push("`verdict` is ready: no blocker or major item is raised");
  }
  if (!Array.isArray(review.hazards)) errors.push("`hazards` is a list, empty where the log's records support every comparison a page could make");
  else {
    if (review.hazards.length > ITEM_MAX) errors.push(`${review.hazards.length} hazards: name at most ${ITEM_MAX}, the ones a page is likeliest to be written on`);
    review.hazards.forEach((hazard, n) => {
      const at = `hazards[${n}]`;
      const ids = Array.isArray(hazard?.insights) ? hazard.insights : null;
      if (!ids?.length) errors.push(`${at}: \`insights\` names the insights the hazard is read from`);
      else { const unknown = ids.filter((id) => !known.has(id)); if (unknown.length) errors.push(`${at}: ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not in the log`); }
      for (const field of ["problem", "rule"]) if (typeof hazard?.[field] !== "string" || !hazard[field].trim()) errors.push(`${at}: \`${field}\` is a sentence`);
    });
  }
  if (prior.length) {
    const given = new Map((Array.isArray(review.prior) ? review.prior : []).map((p) => [p?.id, p]));
    for (const item of prior) {
      const status = given.get(item.id)?.status;
      if (!["settled", "open"].includes(status)) errors.push(`prior: give ${item.id} a status, settled or open`);
    }
  }
  return errors;
}

/** The recorded critique beside the deck's output, or null. */
export async function readAnswerCritique(outputDirectory) {
  return readJson(path.join(path.resolve(outputDirectory), RECORD_FILE), { optional: true });
}

/** The items a recorded critique leaves open: those its latest pass raised (a pass over a revised answer raises again only the earlier items still open). */
export const openAnswerItems = (record) => (Array.isArray(record?.items) ? record.items : []);

/**
 * Whether the storyline critique may stage over this answer: refused while the critique's revise stands on the answer
 * unchanged, since a spine written over an answer the log does not support is a spine the critique sends back. Null where
 * it may.
 */
export function answerCritiqueRefusal(record, answer) {
  if (!record || record.verdict !== "revise" || record.answerHash !== answerHashOf(answer)) return null;
  const open = openAnswerItems(record).filter((item) => OPEN_SEVERITIES.has(item.severity));
  return `The answer critique (out/${RECORD_FILE}) sent the answer back and it has not changed since: ${open.map((item) => `${item.id} (${item.severity}, ${item.remedy})`).join(", ")}. Narrow the answer, compute the analyses or find the data each names, then write the skeleton.`;
}

/** The comparisons the log's own records cannot support, as the latest pass named them: they hold whatever the answer says. */
export const answerHazards = (record) => (Array.isArray(record?.hazards) ? record.hazards : []);
export const hazardLine = (hazard) => `[${hazard.insights.join(", ")}] ${hazard.problem} Rule: ${hazard.rule}`;

// The line a skeleton brief and the storyline packet print for each item.
export const itemLine = (item) => `${item.id} (${item.severity}, ${item.check}, ${item.remedy}): "${item.claim}" - ${item.problem} Fix: ${item.fix}${item.insights?.length ? ` [${item.insights.join(", ")}]` : ""}`;

async function writePacket(evidence, out, prior, waiting) {
  const dir = path.join(out, PACKET_DIR);
  await fs.mkdir(dir, { recursive: true });
  const answerFile = path.join(dir, ANSWER_FILE);
  // An answer saved for an earlier packet answers another statement: left there, the next run would record it against this one.
  if (waiting?.binding !== evidence.binding) await fs.rm(answerFile, { force: true });
  await fs.writeFile(path.join(dir, "prompt.md"), `${answerPrompt(evidence, { answerFile, prior })}\n`);
  await writeJson(path.join(dir, "packet.json"), { schema: "professional-slides.answer-critique-packet/v1", binding: evidence.binding, answerHash: evidence.answerHash, prior: prior.map((item) => item.id) });
  return { dir, answerFile };
}

/** Stage, or record what was returned: the run as the CLI makes it. Returns the exit code. */
export async function answerCritique(pagesFile, outputDirectory, { say = console.log, warn = console.error } = {}) {
  const out = path.resolve(outputDirectory);
  await fs.mkdir(out, { recursive: true });
  const evidence = await answerEvidence(pagesFile);
  const record = await readAnswerCritique(out);
  if (record?.binding === evidence.binding) {
    const open = openAnswerItems(record).filter((item) => OPEN_SEVERITIES.has(item.severity));
    say(JSON.stringify({ status: record.verdict, items: openAnswerItems(record).map(itemLine) }, null, 1));
    return open.length ? EXIT.refused : EXIT.ok;
  }
  // The earlier record read another answer: its items go to the next critic to settle.
  const prior = record ? openAnswerItems(record) : [];
  const dir = path.join(out, PACKET_DIR), answerFile = path.join(dir, ANSWER_FILE);
  const waiting = await readJson(path.join(dir, "packet.json"), { optional: true });
  let returned = null;
  if (waiting?.binding === evidence.binding) {
    try { returned = await readJson(answerFile, { optional: true }); } catch (error) {
      warn(`The answer critique in ${answerFile} is refused: it is not JSON (${error.message})`);
      return EXIT.refused;
    }
  }
  if (returned) {
    const errors = answerCritiqueErrors(returned, evidence, { prior });
    if (errors.length) { warn(`The answer critique in ${answerFile} is refused:\n${errors.map((e) => `- ${e}`).join("\n")}`); return EXIT.refused; }
    const items = returned.items;
    await writeJson(path.join(out, RECORD_FILE), { schema: "professional-slides.answer-critique/v1", binding: evidence.binding, answerHash: evidence.answerHash,
      pass: (record?.pass ?? 0) + 1, verdict: returned.verdict, summary: returned.summary, items, hazards: returned.hazards, ...(prior.length ? { prior: returned.prior } : {}) });
    say(JSON.stringify({ status: returned.verdict, items: items.map(itemLine) }, null, 1));
    if (returned.verdict === "revise") warn("Narrow the answer, compute the analyses or find the data the items name, then run this again: the next critic reads the revised answer and settles each item. The skeleton brief prints what is open.");
    return returned.verdict === "revise" ? EXIT.refused : EXIT.ok;
  }
  const packet = await writePacket(evidence, out, prior, waiting);
  say(JSON.stringify({ status: "packet-written", dir: packet.dir, prior: prior.map((item) => item.id),
    note: `Give ${path.join(packet.dir, "prompt.md")} to a fresh critic (no other context), save its JSON as ${packet.answerFile}, then run this again` }, null, 1));
  return EXIT.waiting;
}

/** `--validate`: every reason the answer in `file` would be refused, recording nothing. */
async function validate(pagesFile, outputDirectory, file) {
  const out = path.resolve(outputDirectory);
  const evidence = await answerEvidence(pagesFile);
  const record = await readAnswerCritique(out);
  const prior = record && record.binding !== evidence.binding ? openAnswerItems(record) : [];
  const answerFile = file ?? path.join(out, PACKET_DIR, ANSWER_FILE);
  let review = null, errors = [];
  try { review = JSON.parse(await fs.readFile(answerFile, "utf8")); } catch (error) { errors = [`${answerFile}: ${error.code === "ENOENT" ? "no answer saved there" : `not JSON (${error.message})`}`]; }
  if (review) errors = answerCritiqueErrors(review, evidence, { prior });
  console.log(JSON.stringify(errors.length ? { status: "invalid", errors } : { status: "valid", note: "the answer would be recorded as it is" }, null, 1));
  return errors.length ? EXIT.refused : EXIT.ok;
}

async function main(argv) {
  const { values, positionals: [pagesFile, outputDirectory] } = parseCli(argv, { validate: { type: "string", bare: "", valueName: "the answer file" } }, { usage: USAGE, strict: true });
  if (!pagesFile || !outputDirectory || !/\.pages\.json$/.test(pagesFile)) throw new UsageError(USAGE);
  if (values.validate !== undefined) return validate(pagesFile, outputDirectory, values.validate || null);
  return answerCritique(pagesFile, outputDirectory);
}

if (isMain(import.meta.url)) runCli(main);
