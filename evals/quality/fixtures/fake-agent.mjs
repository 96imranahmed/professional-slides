#!/usr/bin/env node
/**
 * Stands in for a headless agent in the quality eval's tests: writes a small
 * deck into its working directory the way a real run lays one out, including
 * the author's own files a judge must never see (they carry AUTHOR_MARK).
 *
 *   FAKE_AGENT_SLIDES   pages in the deck (default 4); 0 writes nothing
 *   FAKE_AGENT_LOG      append {prompt, cwd} here, so a test can read what the agent was told
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const AUTHOR_MARK = "AUTHOR-RATIONALE-7f3e";
// A 1x1 PNG: the runner copies renders, it never decodes them.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const prompt = process.argv[2] ?? "";
const cwd = process.cwd();
if (process.env.FAKE_AGENT_LOG) appendFileSync(process.env.FAKE_AGENT_LOG, JSON.stringify({ prompt, cwd }) + "\n");
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
  writeFileSync(path.join(deck, "fake.author-log.jsonl"), JSON.stringify({ note: AUTHOR_MARK }) + "\n");
  writeFileSync(path.join(deck, "storyline-review.json"), JSON.stringify({ verdict: "ready", note: AUTHOR_MARK }));
  const scene = { slides: pages.map((p) => ({ id: p.id, nodes: [{ role: "action-title", type: "text", text: p.title },
    ...Array.from({ length: 20 }, () => ({ role: "mark", type: "rect" }))], componentInstances: [{ component: p.exhibit === "table" ? "table" : "chart.column" }] })) };
  writeFileSync(path.join(out, "scene.json"), JSON.stringify(scene));
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
}
console.log(JSON.stringify({ type: "result", result: "done" }));
