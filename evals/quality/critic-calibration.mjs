#!/usr/bin/env node
/**
 * How far can the storyline critic's rating be trusted?
 *
 *   node evals/quality/critic-calibration.mjs --repeats 5              every anchor, five answers each
 *   node evals/quality/critic-calibration.mjs --repeats 3 --anchors finance,finance:declined-answer
 *   node evals/quality/critic-calibration.mjs --repeats 5 --dry-run    print the commands, call nothing
 *   node evals/quality/critic-calibration.mjs --list                   the anchors and what each plants
 *
 * A benchmark's storyline was rated 5, then 4, then 6.2. The three packets
 * were three different decks, so the numbers say nothing about the critic:
 * neither that it is noisy nor that the deck got better. Two measurements
 * answer the question, and this runs both on packets that do not change.
 *
 * - Repeats. One frozen packet - the prompt, the schema, the spine - is given
 *   to a fresh critic `--repeats` times. The spread of those ratings is the
 *   critic's own noise: a later change in a deck's rating smaller than it is
 *   not a result.
 * - Anchors. The fixture decks under fixtures/evidence/ as they are
 *   (clean), and each with one defect of argument planted that a critic must
 *   find: an answer that declines the request, the comparison its players need
 *   cut, an exhibit about something else kept as "context", a page that
 *   restates its neighbour. A critic is calibrated when every planted anchor
 *   is rated below its clean deck by more than the repeat spread, says revise,
 *   and files an item on the check that was planted.
 *
 * Every answer is validated as the storyline loop validates it
 * (validateStorylineRecord): an answer the loop would refuse is counted as
 * invalid, not rated. The critic is the judge command in config.json (its
 * `{packet}` is the staged packet directory, `{schema}` the packet's schema);
 * this costs `anchors x repeats` critic calls, so `--dry-run` first.
 *
 * Results are written to runs/critic-calibration/<skill version>.json and
 * printed. Exit 0 calibrated, 2 not (or nothing valid came back).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { EXIT, isMain, parseCli, runCli } from "../../skills/professional-slides/runtime/cli.mjs";
import { compileDeck, readInsights } from "../../skills/professional-slides/runtime/author-deck.mjs";
import { alternativesOf } from "../../skills/professional-slides/runtime/analysis.mjs";
import { prepareStoryline, validateStorylineRecord, storylineItems } from "../../skills/professional-slides/runtime/storyline.mjs";
import { BLOCKING } from "../../skills/professional-slides/runtime/review-passes.mjs";
import { readPagesFileSync } from "../../skills/professional-slides/runtime/pages-file.mjs";
import { readInsightLog } from "../../skills/professional-slides/runtime/measures.mjs";
import { QUALITY, fillTemplate, parseJudgeOutput, skillSha, spread } from "./lib.mjs";

const FIXTURES = path.join(QUALITY, "fixtures", "evidence");
const PROMPT = "You are the storyline critic. Read prompt.md in the packet directory and follow it exactly: judge from the packet alone and return ONLY the JSON it asks for.";

/**
 * The defects of argument planted on a clean fixture deck. `plant(doc, files)`
 * mutates the pages document (and the staged files' plan, by name) and
 * `check` is the storyline check a critic must file a major or blocker under.
 */
export const PLANTED = Object.freeze({
  "declined-answer": { decks: ["finance", "product", "public-ops"], check: ["answer"],
    about: "the governing answer declines the request instead of answering it",
    plant(doc) { doc.deck.answer = "The evidence cannot rank the options, and no defensible call can be made on either question."; } },
  "comparison-cut": { decks: ["finance", "product"], check: ["missing", "shape", "answer", "pillars"],
    about: "the declared players are never set on common measures: the comparison and its page are cut",
    plant(doc, files) {
      const cut = files.analysis.analyses.filter((a) => a.op === "compare").map((a) => a.id);
      files.analysis.analyses = files.analysis.analyses.filter((a) => a.op !== "compare");
      doc.pages = doc.pages.filter((page) => !(page.evidence || []).some((id) => cut.includes(id)));
    } },
  "context-off-claim": { decks: ["finance", "public-ops", "product"], check: ["shape", "sourcing", "claim", "consequence"],
    about: "a page's chart is replaced by another page's and kept as declared context, so nothing on the exhibit proves the claim",
    plant(doc) {
      const charted = (page) => page.exhibit?.basis && Array.isArray(page.exhibit.series);
      const [target, donor] = [doc.pages.find(charted), [...doc.pages].reverse().find(charted)];
      target.exhibit = { ...structuredClone(donor.exhibit), basis: { ...donor.exhibit.basis, role: "context", relevance: "It is shown beside the claim for the reader to weigh" } };
      target.evidence = [...new Set([...(target.evidence || []), ...donor.exhibit.basis.measures.map((ref) => ref.split("/")[0])])];
    } },
  "restated-page": { decks: ["finance", "public-ops", "product", "explainer"], check: ["restatement", "cuts"],
    about: "a page repeats the claim, the evidence and the exhibit of the page before it",
    plant(doc) { const page = structuredClone(doc.pages.find((p) => p.exhibit)); page.id = `${page.id}-again`; doc.pages.splice(doc.pages.findIndex((p) => p.id + "-again" === page.id) + 1, 0, page); } },
});

/** Every anchor: each fixture deck clean, and each planted defect on the decks that take it. */
export function anchors() {
  const decks = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".pages.json")).sort().map((f) => f.replace(/\.pages\.json$/, ""));
  return [...decks.map((deck) => ({ id: deck, deck, planted: null })),
    ...Object.entries(PLANTED).flatMap(([name, p]) => p.decks.filter((deck) => decks.includes(deck)).map((deck) => ({ id: `${deck}:${name}`, deck, planted: name })))];
}

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);

/** A fixture deck (with a defect planted) staged as a task folder, and the frozen storyline packet for it. */
export async function freeze(anchor, root) {
  const dir = path.join(root, anchor.id.replace(/[^A-Za-z0-9._-]+/g, "_"));
  const out = path.join(dir, "out");
  fs.mkdirSync(out, { recursive: true });
  const doc = readPagesFileSync(path.join(FIXTURES, `${anchor.deck}.pages.json`));
  // The log with its parts merged (measures.mjs), staged as one file: a part's path would not resolve in the task folder.
  const { include: _include, parts: _parts, ...recorded } = await readInsightLog(FIXTURES, anchor.deck);
  const files = { insights: recorded, analysis: readJson(path.join(FIXTURES, `${anchor.deck}.analysis.json`)) };
  if (anchor.planted) PLANTED[anchor.planted].plant(doc, files);
  fs.writeFileSync(path.join(dir, `${anchor.deck}.insights.json`), JSON.stringify(files.insights));
  if (files.analysis) fs.writeFileSync(path.join(dir, `${anchor.deck}.analysis.json`), JSON.stringify(files.analysis));
  fs.mkdirSync(path.join(dir, "sources"), { recursive: true });
  for (const item of files.insights.insights) for (const file of item.sources || []) fs.writeFileSync(path.join(dir, file), "illustrative fixture data\n");
  const insights = await readInsights(dir, anchor.deck, { alternatives: alternativesOf(doc.deck) });
  // The spine as a draft compiles it: the planted deck may break an authoring
  // rule - that is the point - and the critic is still shown what was written.
  const { spec } = compileDeck(doc, { insights, draft: true, partial: true });
  const specPath = path.join(dir, `${anchor.deck}.deck.json`);
  fs.writeFileSync(specPath, JSON.stringify(spec));
  const step = await prepareStoryline(specPath, out);
  if (step.status !== "packet-written") throw new Error(`${anchor.id}: no storyline packet (${step.status}: ${(step.errors || []).join("; ")})`);
  const packet = readJson(path.join(step.dir, "packet.json"));
  return { dir, staging: step.dir, packet, schema: path.join(step.dir, "schema.json") };
}

function context(packet) {
  const ids = packet.pages.map((p) => p.id);
  return { ids, contentIds: packet.pages.filter((p) => !p.kind || p.kind === "content").map((p) => p.id), mode: packet.mode,
    insightIds: packet.insights?.present ? new Set(packet.insights.items.map((i) => i.id)) : null, sources: packet.sources ?? [],
    analyses: packet.analyses ?? [], evidenceScope: packet.evidenceScope ?? null, answerStatus: packet.answerStatus ?? null };
}

/** What one frozen anchor's answers say: how many were valid, the spread of their ratings, and whether the planted defect was found. */
export function summarizeAnchor(anchor, packet, answers) {
  const valid = [], invalid = [];
  for (const answer of answers) {
    const errors = answer ? validateStorylineRecord(answer, context(packet)) : ["no JSON answer"];
    (errors.length ? invalid : valid).push({ answer, errors });
  }
  const ratings = valid.map((v) => v.answer.rating);
  const verdicts = valid.map((v) => v.answer.verdict);
  const share = (list, test) => (list.length ? Math.round(100 * list.filter(test).length / list.length) / 100 : null);
  const wanted = anchor.planted ? PLANTED[anchor.planted].check : null;
  const found = (answer) => storylineItems(answer).some((item) => BLOCKING.has(item.severity) && wanted.includes(item.dimension));
  return { id: anchor.id, deck: anchor.deck, planted: anchor.planted, answers: answers.length, valid: valid.length, invalid: invalid.map((i) => i.errors.slice(0, 3)),
    rating: spread(ratings), verdicts: Object.fromEntries([...new Set(verdicts)].map((v) => [v, verdicts.filter((x) => x === v).length])),
    agreement: share(verdicts, (v) => v === verdicts[0]), sufficiency: Object.fromEntries([...new Set(valid.map((v) => v.answer.sufficiency.verdict))].map((s) => [s, valid.filter((v) => v.answer.sufficiency.verdict === s).length])),
    ...(wanted ? { caught: share(valid.map((v) => v.answer), found), saidRevise: share(verdicts, (v) => v === "revise") } : { saidReady: share(verdicts, (v) => v !== "revise") }) };
}

/**
 * The calibration over every anchor: the critic's noise floor (the median
 * repeat spread), and for each planted anchor whether it was rated below its
 * clean deck by more than that noise, sent back and caught on its check.
 */
export function calibration(rows) {
  const measured = rows.filter((row) => row.rating.n >= 2);
  const sds = measured.map((row) => row.rating.sd).sort((a, b) => a - b);
  const noise = sds.length ? sds[Math.floor((sds.length - 1) / 2)] : null;
  const clean = new Map(rows.filter((row) => !row.planted).map((row) => [row.deck, row]));
  const pairs = rows.filter((row) => row.planted).map((row) => {
    const base = clean.get(row.deck);
    const gap = base?.rating.mean !== null && base?.rating.mean !== undefined && row.rating.mean !== null ? Math.round((base.rating.mean - row.rating.mean) * 100) / 100 : null;
    const widest = Math.max(base?.rating.sd ?? 0, row.rating.sd ?? 0);
    return { anchor: row.id, clean: base?.rating.mean ?? null, planted: row.rating.mean, gap, spread: widest, ordered: gap !== null && gap > 0, separated: gap !== null && gap > widest, caught: row.caught, saidRevise: row.saidRevise };
  });
  const invalid = rows.reduce((n, row) => n + row.invalid.length, 0);
  const calibrated = pairs.length > 0 && pairs.every((p) => p.separated && p.caught === 1 && p.saidRevise === 1) && [...clean.values()].every((row) => row.valid > 0);
  return { noiseFloor: noise, pairs, invalidAnswers: invalid, calibrated,
    reading: noise === null ? "one answer an anchor: the spread is not measured; run with --repeats 3 or more"
      : `a deck's rating must move by more than ${noise} between two critiques before the move is anything but the critic's own spread` };
}

function ask(judge, model, frozen, env = {}) {
  const command = fillTemplate(judge.command, { prompt: PROMPT, packet: frozen.staging, schema: frozen.schema, model });
  const out = spawnSync(command[0], command.slice(1), { cwd: frozen.staging, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: (judge.timeoutMinutes ?? 30) * 60 * 1000 });
  if (out.status !== 0) return { error: `critic exited ${out.status ?? out.signal ?? out.error?.message}: ${String(out.stderr || out.stdout).slice(-300)}` };
  return { answer: parseJudgeOutput(out.stdout) };
}

const USAGE = "Usage: critic-calibration.mjs [--repeats n] [--anchors a,b] [--judge key] [--model m] [--config file] [--out file] [--dry-run] [--list]";

export async function main(argv, log = console.log) {
  const { values } = parseCli(argv, { repeats: { type: "string" }, anchors: { type: "string" }, judge: { type: "string" }, model: { type: "string" }, config: { type: "string" },
    out: { type: "string" }, "dry-run": { type: "boolean" }, list: { type: "boolean" } }, { usage: USAGE, strict: true });
  const all = anchors();
  if (values.list) { for (const a of all) log(`${a.id.padEnd(34)} ${a.planted ? `plants: ${PLANTED[a.planted].about} (checks: ${PLANTED[a.planted].check.join(", ")})` : "clean"}`); return EXIT.ok; }
  const repeats = Number(values.repeats ?? 3);
  if (!Number.isInteger(repeats) || repeats < 1) { console.error(`--repeats is a positive whole number\n${USAGE}`); return EXIT.error; }
  const chosen = values.anchors ? all.filter((a) => values.anchors.split(",").includes(a.id)) : all;
  if (!chosen.length) { console.error(`No anchor named ${values.anchors}; --list prints them`); return EXIT.error; }
  const config = readJson(path.resolve(values.config ?? path.join(QUALITY, "config.json")));
  const judgeKey = values.judge ?? config.defaults.judge, judge = config.judges[judgeKey];
  if (!judge) { console.error(`No judge "${judgeKey}" in the config`); return EXIT.error; }
  const model = values.model ?? judge.model ?? "";
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "critic-calibration-"));
  const rows = [];
  try {
    for (const anchor of chosen) {
      const frozen = await freeze(anchor, root);
      if (values["dry-run"]) { log(`${anchor.id}: ${repeats} x ${fillTemplate(judge.command, { prompt: "<prompt>", packet: frozen.staging, schema: frozen.schema, model }).join(" ")}`); fs.rmSync(frozen.staging, { recursive: true, force: true }); continue; }
      const answers = [];
      for (let run = 1; run <= repeats; run += 1) {
        const got = ask(judge, model, frozen, { CRITIC_CALIBRATION_RUN: String(run), CRITIC_CALIBRATION_ANCHOR: anchor.id });
        if (got.error) log(`${anchor.id} run ${run}: ${got.error}`);
        answers.push(got.answer ?? null);
      }
      const row = summarizeAnchor(anchor, frozen.packet, answers);
      rows.push(row);
      log(`${row.id.padEnd(34)} valid ${row.valid}/${row.answers}  rating ${row.rating.mean ?? "-"} (sd ${row.rating.sd ?? "-"}, ${row.rating.min ?? "-"}-${row.rating.max ?? "-"})  ${JSON.stringify(row.verdicts)}${row.planted ? `  caught ${row.caught}` : ""}`);
      fs.rmSync(frozen.staging, { recursive: true, force: true });
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  if (values["dry-run"]) return EXIT.ok;
  const result = { schema: "professional-slides.critic-calibration/v1", skill: skillSha(), judge: judgeKey, model, repeats, anchors: rows, ...calibration(rows) };
  const out = path.resolve(values.out ?? path.join(QUALITY, "runs", "critic-calibration", `${result.skill.replace(/[^A-Za-z0-9._-]+/g, "_")}.json`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
  log(`\nnoise floor (median repeat spread): ${result.noiseFloor ?? "not measured"}\n${result.reading}`);
  for (const p of result.pairs) log(`  ${p.anchor.padEnd(34)} clean ${p.clean} planted ${p.planted} gap ${p.gap} ${p.separated ? "separated" : p.ordered ? "ordered, inside the spread" : "NOT ordered"}; caught ${p.caught}; revise ${p.saidRevise}`);
  log(`${result.calibrated ? "calibrated" : "NOT calibrated"}; ${result.invalidAnswers} invalid answer(s); written to ${out}`);
  return result.calibrated ? EXIT.ok : EXIT.refused;
}

if (isMain(import.meta.url)) runCli(main);
