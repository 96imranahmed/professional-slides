#!/usr/bin/env node
/**
 * Stands in for a storyline critic in the calibration's tests. It reads the
 * frozen packet it was handed (its working directory) and answers with a
 * valid spine critique, the way a CLI in JSON mode would.
 *
 * It "finds" what a careful reader of the packet would: an answer that
 * declines, declared players with no computed comparison, a page whose every
 * exhibit is context, a title used twice. A clean packet is rated 8 and passes; a planted one is
 * rated 6, with a major (its consequence stated) where the plant is one, and a cut where a page repeats. The rating wobbles with the
 * repeat (CRITIC_CALIBRATION_RUN) by FAKE_CRITIC_NOISE (default 0.2), so the
 * harness has a spread to measure; FAKE_CRITIC_BLIND=1 misses every defect.
 * FAKE_CRITIC_INVALID=<run> leaves the answer's parts out of that repeat's
 * answer, which the loop refuses on form. FAKE_CRITIC_NEEDS_SCHEMA=1
 * behaves as a CLI that takes the schema inline: it fails unless one of its
 * arguments is the schema itself, as JSON. FAKE_CRITIC_SENDS_BACK makes it a
 * critic that tells nothing apart: `every-check` files a major under every
 * check a plant is caught on, on every deck, planted or clean; `numbers`
 * sends every deck back for one item no plant is caught on.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

if (process.env.FAKE_CRITIC_NEEDS_SCHEMA === "1" && !process.argv.slice(2).some((arg) => { try { return JSON.parse(arg).type === "object"; } catch { return false; } })) {
  process.stderr.write("--json-schema is not valid JSON\n");
  process.exit(1);
}
const packet = JSON.parse(readFileSync(path.join(process.cwd(), "packet.json"), "utf8"));
const content = packet.pages.filter((p) => !p.kind || p.kind === "content");
// A revision that composed no page of its own is critiqued on the slides it changed.
const ids = content.length ? content.map((p) => p.id) : packet.revision?.changed ?? [];
const blind = process.env.FAKE_CRITIC_BLIND === "1";
const titles = content.map((p) => p.title);
const repeated = content.filter((p, i) => titles.indexOf(p.title) !== i);
// A page that declares context and nothing as proof: nothing it shows proves its claim.
const context = content.filter((p) => (p.measures || []).some((m) => m.role === "context") && !(p.measures || []).some((m) => m.role === "proof"));
const compared = (packet.analyses || []).some((a) => a.op === "compare" && a.status !== "unavailable");

const findings = [], missingAnalyses = [], cutOrMerge = [];
const stake = "The committee would act on a claim the deck does not show.";
if (!blind) {
  if ((packet.declines || []).length) findings.push({ id: "F1", scope: "spine", pages: ids, check: "answer", severity: "major", ifUnfixed: stake,
    problem: "The governing answer declines the request rather than answering it.", fix: "Commit to the lean the evidence supports, with its confidence and reversal." });
  if ((packet.players || []).length >= 2 && !compared) missingAnalyses.push({ id: "M1", analysis: "The declared players on common measures", why: "The answer compares them and no page sets them side by side.",
    data: "The peer measures already in the insight log", public: "speculative", remedy: "computable", severity: "major", ifUnfixed: stake });
  for (const page of context.slice(0, 1)) findings.push({ id: "F2", scope: "page", pages: [page.id], check: "shape", severity: "major", ifUnfixed: stake,
    problem: "The only exhibit on this page is declared context and plots something other than its claim.", fix: "Plot the measure the claim is about on this page." });
  for (const page of repeated.slice(0, 1)) findings.push({ id: "F3", scope: "page", pages: [page.id], check: "restatement", severity: "minor",
    problem: "This page repeats the claim and the exhibit of the page before it.", fix: "Cut the page, or make it prove the next step of the argument." });
}
const sendsBack = process.env.FAKE_CRITIC_SENDS_BACK ?? "";
const always = (id, check) => ({ id, scope: "spine", pages: ids, check, severity: "major", ifUnfixed: stake, problem: `The spine does not hold on ${check}, as on every deck this critic reads.`, fix: `Rework the spine until ${check} holds.` });
if (sendsBack === "every-check") {
  for (const [at, check] of ["answer", "shape", "restatement"].entries()) if (!findings.some((f) => f.check === check)) findings.push(always(`A${at + 1}`, check));
  if (!missingAnalyses.length) missingAnalyses.push({ id: "M9", analysis: "A further comparison", why: "Every deck could compare more.", data: "The measures in the log", public: "speculative", remedy: "computable", severity: "major", ifUnfixed: stake });
}
if (sendsBack === "numbers") findings.push(always("N1", "numbers"));
const open = [...findings, ...missingAnalyses].some((item) => item.severity === "major");
const filed = new Set([...findings.map((f) => f.check), ...(missingAnalyses.length ? ["missing"] : [])]);
const run = Number(process.env.CRITIC_CALIBRATION_RUN ?? 1), noise = Number(process.env.FAKE_CRITIC_NOISE ?? 0.2);
const rating = Math.round(((open ? 6 : 8) + noise * ((run % 3) - 1)) * 10) / 10;
const checks = ["claim", "shape", "sourcing", "restatement", "consequence", "spine", "answer", "pillars", "numbers", "flow", "summary", "missing", "cuts"];
const critique = { pass: 1, verifies: null, verdict: open ? "revise" : "ready", rating, binding: packet.binding,
  summary: open ? "The storyline is sent back for the items filed below." : "The answer is sharp and the pillars hold on the evidence shown.",
  compliance: { verdict: open ? "incomplete" : "complete", note: open ? "An item within the team's reach is open." : "Nothing the evidence in scope allows is left undone." },
  sufficiency: { verdict: open ? "insufficient" : "sufficient", note: open ? "The answer outruns its evidence while the item is open." : "The evidence supports the answer as it is stated." },
  provenance: { backend: "subagent", model: "fake-critic", promptHash: packet.promptHash },
  spine: "Read alone, the titles build from the evidence to the answer in the order a reader follows.", answer: "The answer as it should read, committing to the lean the evidence supports.",
  answerParts: [{ part: "the request", verdict: (packet.declines || []).length && !blind ? "declined" : "answered", missingEvidence: "" }],
  pillars: [{ pillar: "The argument", pages: ids, verdict: open ? "weak" : "holds", overlap: "One pillar; nothing overlaps.", strongestCounter: "The base may be too small to generalise.", reversal: "The lead measure reverses for two periods.", answered: !open }],
  numbers: "The figures agree across the pages that print them.", sectionFlow: "The pages open, develop and close in order.", execSummary: "No summary page in this short spine; the titles carry the answer.",
  missingAnalyses, cutOrMerge, findings, topFixes: [open ? "Repair the items filed" : "None material"],
  completeness: checks.map((check) => ({ check, result: filed.has(check) ? "findings" : "clean", note: filed.has(check) ? `Filed an item under ${check}.` : `Checked ${check} across the spine and found nothing to raise.` })) };
if (process.env.FAKE_CRITIC_INVALID === String(run)) delete critique.answerParts;
process.stdout.write(JSON.stringify({ type: "result", result: JSON.stringify(critique) }));
