#!/usr/bin/env node
// Answer the questions the rules ask of a deck's copy (judgements.mjs).
//
//   node runtime/judge.mjs <id>.pages.json [--draft | --fetch-assets] [--run claude|codex] [--model m] [--timeout seconds]
//
// A rule that turns on what a piece of copy means - whether a column judges,
// a title leads with a gap, four paragraphs are alternatives - asks a model
// once and replays the answer. This runs the compile (`author-deck.mjs
// --check`, `--draft` for the spine, or `--fetch-assets` to fetch the planned
// photographs and ask which candidate shows its subject), collects the questions it asked that
// no recorded judgement answers, and stages them in judgements/ beside the
// pages file: packet.json, prompt.md and schema.json, at most 60 questions a
// packet. Give prompt.md to a fresh model with none of the author's context,
// save its JSON as judgements/answer.json and run this again: the answer is
// checked against the packet - every question answered once, each verdict
// one of its kind's, each quote words of its subject - recorded in
// <id>.judgements.json, and the next packet staged. With --run, the named
// backend is called on each packet in a clean folder until every question is
// answered.
//
// Exit codes: 0 every question the rules ask is answered; 2 the answer was
// refused (nothing recorded; the reasons are printed); 3 a packet is waiting
// for its answer; 1 a crash or bad usage.
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { readPagesFile } from "./pages-file.mjs";
import { PACKET_DIR, recordAnswer, stageJudgements } from "./judgements.mjs";
import { callReviewer, stageReview } from "./review-passes.mjs";

const USAGE = "Usage: judge.mjs <id>.pages.json [--draft | --fetch-assets] [--run claude|codex] [--model m] [--timeout seconds]";
// A deck's questions are answered in a few packets; a run that has not finished in this many has met an answer that does not converge.
const ROUNDS_MAX = 12;

/** The questions the compile asked that no recorded judgement answers, as the compile itself found them. */
function pendingQuestions(file, { draft, fetchAssets }) {
  const dir = path.join(os.tmpdir(), `professional-slides-pending-${process.pid}-${Date.now()}`);
  const out = path.join(dir, "pending.json");
  const author = fileURLToPath(new URL("./author-deck.mjs", import.meta.url));
  return fs.mkdir(dir, { recursive: true }).then(async () => {
    const run = spawnSync(process.execPath, [author, file, "--check", ...(draft ? ["--draft"] : []), ...(fetchAssets ? ["--fetch-assets"] : []), "--pending", out], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const pending = await readJson(out, { optional: true });
    await fs.rm(dir, { recursive: true, force: true });
    if (!Array.isArray(pending)) throw new Error(`The compile did not run to the rules (exit ${run.status}): ${String(run.stderr || run.error?.message || "").trim().split("\n").slice(-4).join(" ")}`);
    return pending;
  });
}

export async function judge(file, { draft = false, fetchAssets = false, run = null, model = null, timeoutMs = 600000, say = (text) => process.stderr.write(`${text}\n`) } = {}) {
  const doc = await readPagesFile(file);
  const dir = path.dirname(path.resolve(file));
  const stem = doc.deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  const folder = path.join(dir, PACKET_DIR);
  let staging = null;
  for (let round = 1; round <= ROUNDS_MAX; round += 1) {
    const answered = await recordAnswer(dir, stem, { by: run ? { backend: run, ...(model ? { model } : {}) } : null });
    if (answered.problems.length) {
      say(`The answer in ${path.relative(process.cwd(), path.join(folder, "answer.json"))} was not recorded:\n${answered.problems.map((p) => `  - ${p}`).join("\n")}\nCorrect it (or ask the model again with the same prompt) and run this again.`);
      return EXIT.refused;
    }
    if (answered.recorded) say(`Recorded ${answered.recorded} judgement${answered.recorded === 1 ? "" : "s"} in ${stem}.judgements.json.`);
    const pending = await pendingQuestions(file, { draft, fetchAssets });
    if (!pending.length) {
      say(`Every question the rules ask of ${path.basename(file)}${draft ? "'s spine" : ""} is answered. Compile again: the rules that ask them now hold.`);
      return EXIT.ok;
    }
    const { packet, left } = await stageJudgements(dir, pending);
    const counts = Object.entries(packet.items.reduce((n, item) => ({ ...n, [item.kind]: (n[item.kind] ?? 0) + 1 }), {})).map(([kind, n]) => `${kind} ${n}`).join(", ");
    if (!run) {
      say(`${pending.length} question${pending.length === 1 ? "" : "s"} the rules ask ${pending.length === 1 ? "is" : "are"} not answered. Staged ${packet.items.length} in ${path.relative(process.cwd(), folder)}/ (${counts})${left ? `; ${left} more follow in the next packet` : ""}.\n` +
        `Give ${PACKET_DIR}/prompt.md to a fresh model with none of your context (it reads the images it names, if any), save its JSON as ${PACKET_DIR}/answer.json, and run this again.`);
      return EXIT.waiting;
    }
    // A clean folder holding the packet alone, so the model reads nothing else of the deck.
    const images = Object.fromEntries(packet.items.filter((item) => item.image).map((item) => [item.image, path.join(folder, item.image)]));
    staging = await stageReview("judgements", { "prompt.md": path.join(folder, "prompt.md"), "schema.json": path.join(folder, "schema.json"), ...images }, { previous: staging });
    say(`Round ${round}: asking ${run} ${packet.items.length} question${packet.items.length === 1 ? "" : "s"} (${counts})${left ? `, ${left} to follow` : ""}.`);
    const answer = await callReviewer(run, { prompt: await fs.readFile(path.join(folder, "prompt.md"), "utf8"), schemaPath: path.join(staging, "schema.json"),
      images: Object.keys(images).map((at) => path.join(staging, at)), outPath: path.join(staging, "answer.last-message.json"), model, timeoutMs, cwd: staging });
    await writeJson(path.join(folder, "answer.json"), answer);
  }
  say(`The questions were not all answered in ${ROUNDS_MAX} rounds; run this again to continue.`);
  return EXIT.waiting;
}

async function main(argv) {
  const { values, positionals: [file] } = parseCli(argv, { draft: { type: "boolean" }, "fetch-assets": { type: "boolean" }, run: { type: "string", valueName: "claude or codex" }, model: { type: "string" },
    timeout: { type: "string", valueName: "seconds" } }, { usage: USAGE });
  if (!file) throw new UsageError(USAGE);
  if (values.run !== undefined && !["claude", "codex"].includes(values.run)) throw new UsageError(`--run is claude or codex\n${USAGE}`);
  const timeout = values.timeout === undefined ? 600 : Number(values.timeout);
  if (!(timeout > 0)) throw new UsageError(`--timeout is a number of seconds\n${USAGE}`);
  if (values.draft && values["fetch-assets"]) throw new UsageError(`--draft reads the spine, which has no photographs to fetch\n${USAGE}`);
  return judge(file, { draft: Boolean(values.draft), fetchAssets: Boolean(values["fetch-assets"]), run: values.run ?? null, model: values.model ?? null, timeoutMs: timeout * 1000 });
}

if (isMain(import.meta.url)) runCli(main);
