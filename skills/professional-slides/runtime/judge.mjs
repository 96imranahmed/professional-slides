#!/usr/bin/env node
// Answer the questions the rules ask of a deck's copy (judgements.mjs).
//
//   node runtime/judge.mjs <id>.pages.json [--draft | --fetch-assets] [--run auto|claude|codex [--parallel n]] [--model m] [--timeout seconds]
//
// A rule that turns on what a piece of copy means - whether a column judges,
// a title leads with a gap, four paragraphs are alternatives - asks a model
// once and replays the answer. This runs the compile (`author-deck.mjs
// --check`, `--draft` for the spine, or `--fetch-assets` to fetch the planned
// photographs and ask which candidate shows its subject), collects the
// questions it asked that no recorded judgement answers, and stages them all
// at once in judgements/ beside the pages file, in packets of at most 60:
// judgements/packet-01/, packet-02/, ..., each with its packet.json,
// prompt.md and schema.json. The packets are independent: give each one's
// prompt.md to its own fresh model with none of the author's context, side by
// side, save each JSON as answer.json in its packet's folder, and run this
// again. Each answer is checked against its packet - every question answered
// once, each verdict one of its kind's, each quote words of its subject - and
// recorded in <id>.judgements.json; a packet whose answer has a problem stays
// staged with the reasons printed, and the others are recorded. With --run,
// the named backend is asked about every packet at once (`--parallel`, 4 at a
// time), each in a clean folder, until every question is answered; `auto` is
// the CLI the skill is called from (claude under Claude Code, codex under
// Codex), as the reviews choose it (review-passes.mjs detectBackend).
//
// Exit codes: 0 every question the rules ask is answered; 2 an answer was
// refused (its packet's reasons are printed; the other packets' answers are
// recorded); 3 packets are waiting for their answers; 1 a crash or bad usage.
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { readPagesFile } from "./pages-file.mjs";
import { PACKET_DIR, recordAnswers, stageJudgements } from "./judgements.mjs";
import { callReviewer, detectBackend, stageReview } from "./review-passes.mjs";

const USAGE = "Usage: judge.mjs <id>.pages.json [--draft | --fetch-assets] [--run auto|claude|codex [--parallel n]] [--model m] [--timeout seconds]";
// Every packet is asked at once, so a deck's questions are answered in a round or two: one that has not finished in this
// many has met an answer that does not converge (a model that keeps failing the checks).
const ROUNDS_MAX = 6;
const PARALLEL = 4;

/** `work` on every item, `limit` at a time. */
async function inParallel(items, limit, work) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => { while (queue.length) await work(queue.shift()); }));
}
/** Why a backend did not answer, in its own words: the CLI's result where it printed one ("Not logged in"), else its last line of error. */
function whyNot(error) {
  try { const envelope = JSON.parse(String(error.stdout ?? "").trim()); if (envelope?.result) return String(envelope.result).slice(0, 200); } catch { /* not an envelope */ }
  return String(error.stderr || error.message || "").trim().split("\n").filter(Boolean).at(-1)?.slice(0, 200) ?? "no reason given";
}
const kindCounts = (items) => Object.entries(items.reduce((n, item) => ({ ...n, [item.kind]: (n[item.kind] ?? 0) + 1 }), {})).map(([kind, n]) => `${kind} ${n}`).join(", ");

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

export async function judge(file, { draft = false, fetchAssets = false, run = null, parallel = PARALLEL, model = null, timeoutMs = 600000, say = (text) => process.stderr.write(`${text}\n`) } = {}) {
  const doc = await readPagesFile(file);
  const dir = path.dirname(path.resolve(file));
  const stem = doc.deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  const root = path.join(dir, PACKET_DIR), shown = (folder) => path.relative(process.cwd(), folder) || ".";
  for (let round = 1; round <= ROUNDS_MAX; round += 1) {
    const answered = await recordAnswers(dir, stem, { by: run ? { backend: run, ...(model ? { model } : {}) } : null });
    if (answered.recorded) say(`Recorded ${answered.recorded} judgement${answered.recorded === 1 ? "" : "s"} in ${stem}.judgements.json.`);
    if (answered.problems.length && !run) {
      say(`An answer was not recorded, and its packet stays staged:\n${answered.problems.map((p) => `  - ${p}`).join("\n")}\nCorrect it (or ask a fresh model again with the same prompt.md) and run this again.`);
      return EXIT.refused;
    }
    // A model's answer that failed the checks is set aside, and its packet asked again.
    if (answered.problems.length) say(`Answers refused, asked again:\n${answered.problems.map((p) => `  - ${p}`).join("\n")}`);
    for (const folder of answered.refused) await fs.rename(path.join(folder, "answer.json"), path.join(folder, `refused-${round}.json`)).catch(() => {});
    const pending = await pendingQuestions(file, { draft, fetchAssets });
    if (!pending.length) {
      await fs.rm(root, { recursive: true, force: true });
      say(`Every question the rules ask of ${path.basename(file)}${draft ? "'s spine" : ""} is answered. Compile again: the rules that ask them now hold.`);
      return EXIT.ok;
    }
    const { packets } = await stageJudgements(dir, pending);
    if (!run) {
      say(`${pending.length} question${pending.length === 1 ? "" : "s"} the rules ask ${pending.length === 1 ? "is" : "are"} not answered. Staged in ${packets.length} packet${packets.length === 1 ? "" : "s"}:\n` +
        packets.map(({ folder, packet }) => `  ${shown(folder)}/  ${packet.items.length} (${kindCounts(packet.items)})`).join("\n") +
        `\nThe packets are independent: give each one's prompt.md to its own fresh model with none of your context, side by side (it reads the images it names, if any), save each JSON as answer.json in its packet's folder, and run this again.`);
      return EXIT.waiting;
    }
    say(`Round ${round}: asking ${run} about ${packets.length} packet${packets.length === 1 ? "" : "s"} (${pending.length} question${pending.length === 1 ? "" : "s"}), ${Math.min(parallel, packets.length)} at a time.`);
    const failed = [];
    await inParallel(packets, parallel, async ({ folder, packet }) => {
      // A clean folder holding the packet alone, so the model reads nothing else of the deck.
      const images = Object.fromEntries(packet.items.filter((item) => item.image).map((item) => [item.image, path.join(folder, item.image)]));
      const staging = await stageReview("judgements", { "prompt.md": path.join(folder, "prompt.md"), "schema.json": path.join(folder, "schema.json"), ...images });
      try {
        const answer = await callReviewer(run, { prompt: await fs.readFile(path.join(folder, "prompt.md"), "utf8"), schemaPath: path.join(staging, "schema.json"),
          images: Object.keys(images).map((at) => path.join(staging, at)), outPath: path.join(staging, "answer.last-message.json"), model, timeoutMs, cwd: staging });
        await writeJson(path.join(folder, "answer.json"), answer);
      } catch (error) { failed.push(`${path.basename(folder)}: ${whyNot(error)}`); say(`  ${path.basename(folder)}: ${run} did not answer (${whyNot(error)})`); }
      finally { await fs.rm(staging, { recursive: true, force: true }); }
    });
    // A backend that answered no packet at all is not going to answer the next round either: the packets stay staged for readers.
    if (failed.length === packets.length) {
      say(`${run} answered none of the ${packets.length} packet${packets.length === 1 ? "" : "s"} (${failed[0]}). They stay staged in ${shown(root)}/: give each one's prompt.md to its own fresh model, or put ${run} right and run this again.`);
      return EXIT.waiting;
    }
  }
  say(`The questions were not all answered in ${ROUNDS_MAX} rounds; run this again to continue.`);
  return EXIT.waiting;
}

async function main(argv) {
  const { values, positionals: [file] } = parseCli(argv, { draft: { type: "boolean" }, "fetch-assets": { type: "boolean" }, run: { type: "string", valueName: "claude or codex" }, model: { type: "string" },
    timeout: { type: "string", valueName: "seconds" }, parallel: { type: "string", valueName: "a number of packets" } }, { usage: USAGE });
  if (!file) throw new UsageError(USAGE);
  if (values.run !== undefined && !["auto", "claude", "codex"].includes(values.run)) throw new UsageError(`--run is auto, claude or codex\n${USAGE}`);
  // `auto`: the CLI the skill is called from, else whichever is installed; with none, the packets are staged for readers.
  const backend = values.run === "auto" ? detectBackend("auto") : values.run;
  const timeout = values.timeout === undefined ? 600 : Number(values.timeout);
  if (!(timeout > 0)) throw new UsageError(`--timeout is a number of seconds\n${USAGE}`);
  if (values.draft && values["fetch-assets"]) throw new UsageError(`--draft reads the spine, which has no photographs to fetch\n${USAGE}`);
  const parallel = values.parallel === undefined ? PARALLEL : Number(values.parallel);
  if (!Number.isInteger(parallel) || parallel < 1) throw new UsageError(`--parallel is how many packets are asked at once: a whole number, 1 or more\n${USAGE}`);
  if (values.parallel !== undefined && !values.run) throw new UsageError(`--parallel goes with --run: without it, the packets are yours to hand out\n${USAGE}`);
  return judge(file, { draft: Boolean(values.draft), fetchAssets: Boolean(values["fetch-assets"]), run: backend === "packet" ? null : backend ?? null, parallel, model: values.model ?? null, timeoutMs: timeout * 1000 });
}

if (isMain(import.meta.url)) runCli(main);
