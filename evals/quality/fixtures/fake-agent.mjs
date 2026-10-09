#!/usr/bin/env node
/**
 * Stands in for a headless agent in the quality eval's tests: writes a small
 * deck into its working directory the way a real run lays one out, including
 * the author's own files a judge must never see (they carry AUTHOR_MARK).
 *
 *   FAKE_AGENT_SLIDES   pages in the deck (default 4); 0 writes nothing
 *   FAKE_AGENT_LOG      append {prompt, cwd} here, so a test can read what the agent was told
 *   FAKE_AGENT_RETRY    also leave an abandoned attempt beside the delivered deck: another
 *                       deck id, a one-page plan, built and never delivered, and the newest
 *                       files on disk
 *   FAKE_AGENT_RECORDS  {"file", "row"}: append the row to that results file while the run is
 *                       under way, as a second runner sharing the file would - once, however
 *                       many runs call the agent
 *   FAKE_AGENT_SLEEP_MS take this long before writing anything, so runners started together
 *                       are under way at once
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";

export const AUTHOR_MARK = "AUTHOR-RATIONALE-7f3e";
// A 1x1 PNG: the runner copies renders, it never decodes them.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const prompt = process.argv[2] ?? "";
const cwd = process.cwd();
if (process.env.FAKE_AGENT_LOG) appendFileSync(process.env.FAKE_AGENT_LOG, JSON.stringify({ prompt, cwd }) + "\n");
if (process.env.FAKE_AGENT_SLEEP_MS) await new Promise((resolve) => setTimeout(resolve, Number(process.env.FAKE_AGENT_SLEEP_MS)));
const slides = Number(process.env.FAKE_AGENT_SLIDES ?? 4);
if (slides > 0) {
  const deck = path.join(cwd, "decks", "fake");
  const out = path.join(deck, "out");
  mkdirSync(path.join(out, "rendered"), { recursive: true });
  const pages = Array.from({ length: slides }, (_, i) => ({
    id: `p${i + 1}`, n: i + 1, title: `Finding ${i + 1} is stated as a claim a reader can test`,
    exhibit: i % 2 ? "table" : "chart", architecture: "exhibit-full", why: AUTHOR_MARK,
  }));
  writeFileSync(path.join(deck, "fake.pages.json"), JSON.stringify({ deck: { id: "fake", brief: AUTHOR_MARK }, pages }));
  writeFileSync(path.join(deck, "fake.plan.json"), JSON.stringify({ schema: "professional-slides.plan/v1", id: "fake", pages }));
  writeFileSync(path.join(deck, "fake.deck.json"), JSON.stringify({ schema: "professional-slides.deck/v3", id: "fake", note: AUTHOR_MARK, slides: [] }));
  // Two author runs, as author-deck.mjs logs them: one refused on a page, then a clean one.
  writeFileSync(path.join(deck, "fake.author-log.jsonl"), [{ run: 1, v: 2, mode: "check", pages: slides, ok: false, findings: [{ code: "WORDS", id: "p1", message: AUTHOR_MARK }] },
    { run: 2, v: 2, mode: "full", pages: slides, ok: true, findings: [], note: AUTHOR_MARK }].map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  writeFileSync(path.join(deck, "storyline-review.json"), JSON.stringify({ verdict: "ready", note: AUTHOR_MARK }));
  const scene = { slides: pages.map((p) => ({ id: p.id, nodes: [{ role: "action-title", type: "text", text: p.title },
    ...Array.from({ length: 20 }, () => ({ role: "mark", type: "rect" }))], componentInstances: [{ component: p.exhibit === "table" ? "table" : "chart.column" }] })) };
  writeFileSync(path.join(out, "scene.json"), JSON.stringify(scene));
  // The build's record names the deck it built: `<id>.pptx`, the deck id as its stem.
  writeFileSync(path.join(out, "build-result.json"), JSON.stringify({ status: "built", outputDirectory: out, scenePath: path.join(out, "scene.json"),
    pptxPath: path.join(out, "fake.pptx"), slides }));
  writeFileSync(path.join(out, "review.json"), JSON.stringify({ accepted: true, summary: AUTHOR_MARK }));
  writeFileSync(path.join(out, "self-check.json"), JSON.stringify({ pages: [], note: AUTHOR_MARK }));
  writeFileSync(path.join(out, "delivery.json"), JSON.stringify({ accepted: true, stage: "delivered", note: AUTHOR_MARK }));
  // Review history keeps earlier copies of the deck's files; written last, so
  // it is the newest plan on disk and a collector that walked into it would
  // keep a one-page plan instead of the run's.
  const history = path.join(deck, ".reviews", "fake", "pass-1");
  mkdirSync(history, { recursive: true });
  writeFileSync(path.join(history, "fake.plan.json"), JSON.stringify({ schema: "professional-slides.plan/v1", id: "fake", pages: pages.slice(0, 1) }));
  for (let i = 1; i <= slides; i += 1) writeFileSync(path.join(out, "rendered", `slide-${i}.png`), PNG);
  for (let i = 1; i <= Math.ceil(slides / 4); i += 1) writeFileSync(path.join(out, "rendered", `spread-${i}.png`), PNG);
  if (process.env.FAKE_AGENT_RETRY) {
    // An attempt the agent abandoned for the deck above: its own id and
    // directory, a scene it built but never delivered, and authoring files a
    // minute newer than the delivered deck's, so "the newest plan on disk"
    // is this one's.
    const retry = path.join(cwd, "decks", "retry");
    const retryOut = path.join(retry, "out");
    mkdirSync(path.join(retryOut, "rendered"), { recursive: true });
    const one = pages.slice(0, 1);
    const files = {
      [path.join(retry, "retry.pages.json")]: { deck: { id: "retry", brief: AUTHOR_MARK }, pages: one },
      [path.join(retry, "retry.plan.json")]: { schema: "professional-slides.plan/v1", id: "retry", pages: one },
      [path.join(retry, "retry.deck.json")]: { schema: "professional-slides.deck/v3", id: "retry", note: AUTHOR_MARK, slides: [] },
      [path.join(retryOut, "scene.json")]: { slides: scene.slides.slice(0, 1) },
      [path.join(retryOut, "build-result.json")]: { status: "built", outputDirectory: retryOut, pptxPath: path.join(retryOut, "retry.pptx"), slides: 1 },
    };
    const later = new Date(Date.now() + 60_000);
    for (const [file, body] of Object.entries(files)) { writeFileSync(file, JSON.stringify(body)); utimesSync(file, later, later); }
    writeFileSync(path.join(retryOut, "rendered", "slide-1.png"), PNG);
  }
}
if (process.env.FAKE_AGENT_RECORDS) {
  const { file, row } = JSON.parse(process.env.FAKE_AGENT_RECORDS);
  const line = JSON.stringify(row);
  if (!(existsSync(file) && readFileSync(file, "utf8").split("\n").includes(line))) appendFileSync(file, line + "\n");
}
console.log(JSON.stringify({ type: "result", result: "done" }));
