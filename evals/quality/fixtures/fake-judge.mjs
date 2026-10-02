#!/usr/bin/env node
/**
 * Stands in for a judge in the quality eval's tests. It reads the packet it was
 * handed (its working directory), logs every file in it and any that carry the
 * fake agent's AUTHOR_MARK, and answers the way a CLI in JSON mode would: an
 * envelope with the verdict as text in `result`.
 *
 * Deck: rating 3 + number of sheets (capped at 10). Pair: prefers the deck with
 * more sheets, tie when equal. Anchor: FAKE_JUDGE_ANCHOR_RATING (default 5).
 *
 *   FAKE_JUDGE_LOG   append {mode, files, leaks, prompt} here
 */
import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const AUTHOR_MARK = "AUTHOR-RATIONALE-7f3e";
const root = process.cwd();
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [path.relative(root, full)];
});
const files = walk(root).sort();
const leaks = files.filter((f) => readFileSync(path.join(root, f)).includes(AUTHOR_MARK));
const sheets = (dir) => files.filter((f) => f.startsWith(`${dir}/`)).length;
let mode;
let verdict;
if (files.some((f) => f.startsWith("deck-1/"))) {
  mode = "pair";
  const [one, two] = [sheets("deck-1"), sheets("deck-2")];
  verdict = { preference: one === two ? "tie" : one > two ? "deck-1" : "deck-2", margin: "clear", reasons: ["more pages"] };
} else if (files.some((f) => /^page\./.test(f))) {
  mode = "anchor";
  verdict = { rating: Number(process.env.FAKE_JUDGE_ANCHOR_RATING ?? 5) };
} else {
  mode = "deck";
  const rating = Math.min(10, 3 + sheets("sheets"));
  verdict = { rating, dimensions: { argument: rating, evidence: rating, visual: rating, copy: rating, sequence: rating },
              majors: [{ pages: [2], problem: "A fixture major." }] };
}
if (process.env.FAKE_JUDGE_LOG) appendFileSync(process.env.FAKE_JUDGE_LOG, JSON.stringify({ mode, files, leaks, prompt: process.argv[2] ?? "" }) + "\n");
console.log(JSON.stringify({ type: "result", is_error: false, result: "Here is my verdict:\n```json\n" + JSON.stringify(verdict) + "\n```" }));
