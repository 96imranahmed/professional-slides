#!/usr/bin/env node
/**
 * The point-change benchmark: a change to one page of a deck the user already has.
 *
 *   node evals/point-change/run.mjs [--task <id>]... [--tasks <file>] [--work <dir>] [--agent <name>] [--json <file>]
 *
 * The skill serves two workflows, and every check in it was written for the
 * first - a new deck from a brief. This runs the second the way an author
 * runs it (SKILL.md "A point change"), on decks made here (fixtures.py), and
 * holds each run to what a point change owes its user:
 *
 *   made        the change is in the revised deck: the new words on the
 *               slides the task names, the old ones nowhere, and a redrawn
 *               exhibit drawn as the kind asked for
 *   preserved   nothing else changed. Every slide the task does not name is
 *               the source deck's, byte for byte - its part and every part it
 *               draws on (preservation.py) - and a slide edited in place
 *               keeps every shape where it was
 *   stale       where the task's figure stands on several slides, a compile
 *               that changed only one is refused, naming the others. The
 *               check passes on any finding whose code holds STALE that
 *               names them: NUMBER_STALE or WORDING_STALE, the runtime's
 *               one check for a text edit and for a composed page alike
 *   scoped      the storyline critique is staged only when a title changed,
 *               and marks only the changed pages; the deck review's packet
 *               asks for the changed pages and no other
 *   asked       nothing was changed that the request did not ask for: every
 *               slide the revision edited, redrew or cut is one the task
 *               names, and every line that differs on an edited slide - its
 *               speaker notes too - is the task's own change (`accept.edits`)
 *   delivered   where the task says so (`deliver`): a scripted reviewer reads
 *               the packet, accepts the changed pages, and delivery hands the
 *               deck over - with every change it made listed, and what the
 *               critic found in a slide nobody asked to change reported to
 *               the user, that slide untouched
 *
 * and it counts what the run cost: the runtime commands, in order, and every
 * refusal with whether it named a page the task changes or one it does not.
 * The cost is reported, never scored; a refusal on an untouched page is
 * scored - it fails `scoped`.
 *
 * Offline the author is scripted: each task's `moves` (tasks.json) are
 * written into the pages file, the next one only when a compile refused the
 * one before; a staged critique is answered by the quality eval's fake
 * critic, and the run stops at the deck review's packet. `--agent <name>`
 * gives the request and the deck to a real agent CLI instead (an entry of
 * evals/quality/config.json `agents`), told to build the revision in `work/`
 * beside the deck, and scores what it leaves behind on `made`, `preserved`,
 * `asked` and on the review packet it reached (`packet`: it asks for the
 * task's changed pages and no other), with the cost its author log records,
 * the wall time, and the agent's transcript kept beside the workspace.
 *
 * `--tasks <file>` runs another task file - a deck of your own, named by a
 * task's `deck` (a path to the .pptx, in place of `fixture`), with the files
 * its composed pages need beside the pages file (`files`: an insight log,
 * pictures), each resolved from the task file's folder.
 *
 * Exit 0 when every task meets every check, 2 when one does not, 1 on a crash.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, parseCli, pythonBin } from "../../skills/professional-slides/runtime/cli.mjs";
import { lastJson } from "../../skills/professional-slides/runtime/process.mjs";
import { readRunLog, runCost } from "../../skills/professional-slides/runtime/run-log.mjs";
import { ASSESSMENT_KEYS, DIMENSIONS, PAGE_DIMENSIONS } from "../../skills/professional-slides/runtime/reviewer.mjs";
import { fillTemplate } from "../quality/lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const RUNTIME = path.join(ROOT, "skills", "professional-slides", "runtime");
const FAKE_CRITIC = path.join(ROOT, "evals", "quality", "fixtures", "fake-critic.mjs");
const DEFAULT_TASKS = path.join(HERE, "tasks.json");
/** The tasks of a task file, each with the folder its own paths resolve from. */
const readTasks = (file = DEFAULT_TASKS) => JSON.parse(readFileSync(file, "utf8")).tasks.map((task) => ({ ...task, base: path.dirname(path.resolve(file)) }));
const DECK_ID = "deck";

const run = (command, { cwd, timeoutMinutes = 20 } = {}) => {
  const done = spawnSync(String(command[0]), command.slice(1).map(String), { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: timeoutMinutes * 60 * 1000 });
  return { code: done.status, stdout: done.stdout ?? "", stderr: done.stderr ?? "", error: done.error?.message ?? null };
};
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const node = (script, ...args) => [process.execPath, path.join(RUNTIME, script), ...args];
const python = (script, ...args) => [pythonBin(), script, ...args];

/** The deck a task revises: its own (`deck`), or a fixture built here. */
const sourceOf = (task, work) => (task.deck ? path.resolve(task.base, task.deck) : fixture(work, task.fixture));

/** A fixture deck, built once a work folder. */
function fixture(work, name) {
  const dir = path.join(work, "fixtures");
  const done = run(python(path.join(HERE, "fixtures.py"), dir, "--fixture", name));
  if (done.code !== 0) throw new Error(`fixtures.py --fixture ${name} exited ${done.code}: ${done.stderr.slice(-2000)}`);
  return lastJson(done.stdout).pptx;
}

/** `doc` with one move's edits written in, as an author writes them into the pages file. */
function applyMove(doc, move) {
  const out = structuredClone(doc);
  for (const edit of move.edits) {
    if (edit.deck) { Object.assign(out.deck, edit.deck); continue; }
    if (edit.sources) { out.sources = { ...(out.sources || {}), ...edit.sources }; continue; }
    const at = out.pages.findIndex((page) => page.id === edit.page);
    if (at < 0) throw new Error(`No page ${edit.page} to edit`);
    if (edit.set) out.pages[at] = { id: edit.page, ...edit.set };
    else if (edit.title !== undefined) out.pages[at].title = edit.title;
    else if (edit.replace) out.pages[at].replace = [...(edit.reset ? [] : out.pages[at].replace || []), ...edit.replace];
  }
  return out;
}

/** The refusals of the author run just logged: each finding with whether it names a page the task changes. */
function refusalsOf(dir, changed) {
  const last = readRunLog(path.join(dir, `${DECK_ID}.author-log.jsonl`)).at(-1);
  return (last?.findings || []).map((f) => ({ code: f.code, ...(f.id ? { id: f.id } : {}), about: !f.id ? "deck" : changed.includes(f.id) ? "changed" : "untouched", message: String(f.message ?? "").slice(0, 240) }));
}

/** What the built deck prints, slide by slide, read by the runtime's own importer. */
function printed(pptx, dir) {
  const file = path.join(dir, "revised.inventory.json");
  const done = run(python(path.join(RUNTIME, "import-deck.py"), pptx, "--inventory-only", file));
  if (done.code !== 0) throw new Error(`reading ${pptx} back: ${done.stderr.slice(-1000)}`);
  return readJson(file).slides.map((slide) => ({ index: slide.index, id: slide.id, charts: slide.charts, title: slide.title ?? "", notes: slide.notes ?? "",
    texts: [slide.title, slide.subtitle, ...slide.paragraphs.map((p) => p.text), ...slide.tables.flatMap((t) => t.cells.flat())].filter((text) => typeof text === "string") }));
}

/**
 * `asked`: what the revision changed that the task did not ask for. `order`
 * is the build's record of the revised deck. A slide edited, redrawn or cut
 * outside `accept.changed` is one; so is a line on an edited slide - or in
 * its speaker notes - that differs from the source and is not the source
 * line with the task's own changes made (`accept.edits`, each `{ old, new }`).
 * The title of a slide the task asks to retitle (`accept.retitled`) is asked
 * for whatever its words - an author is not held to the scripted sentence -
 * and `made` reads what it says. A page the runtime composed is read by
 * `made`, not line by line.
 */
// A slide whose title the task asks for: its number, or `{ slide, says }` where the new title must use those words.
const titleAsked = (entry) => (typeof entry === "number" ? entry : entry.slide);
function unasked(task, before, after, order) {
  const changed = new Set(task.accept.changed), edits = task.accept.edits || [], retitled = new Set((task.accept.retitled || []).map(titleAsked));
  const asked = (line) => edits.reduce((now, edit) => now.split(edit.old).join(edit.new), line);
  const found = [];
  const kept = new Set(order.filter((item) => item.carried).map((item) => item.carried));
  // A source slide the revised deck does not carry was cut, or redrawn by a page composed in its place: either is a change to it.
  for (const slide of before) if (!kept.has(slide.index) && !changed.has(slide.id)) found.push({ slide: slide.index, what: "cut or redrawn, and the task does not name it" });
  order.forEach((item, at) => {
    if (!item.carried) { if (!changed.has(item.id)) found.push({ slide: at + 1, what: `page ${item.id} composed, and the task does not name it` }); return; }
    const was = before[item.carried - 1], now = after[at];
    const lines = [...was.texts, was.notes], revised = [...now.texts, now.notes];
    const differing = lines.length !== revised.length ? [{ was: `${lines.length} lines`, now: `${revised.length} lines` }] : lines.map((line, i) => ({ was: line, now: revised[i] })).filter((pair) => pair.was !== pair.now);
    if (differing.length && !changed.has(item.id)) found.push({ slide: item.carried, what: "edited, and the task does not name it" });
    for (const pair of differing) if (asked(pair.was) !== pair.now && !(retitled.has(at + 1) && pair.was === was.title)) found.push({ slide: item.carried, what: `"${pair.was}" now reads "${pair.now}"` });
  });
  return found;
}
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const says = (text, phrase) => new RegExp(`(?<![\\p{L}\\p{N}]|\\d[.,])${escaped(phrase)}(?![\\p{L}\\p{N}]|[.,]\\d)`, "u").test(text);

/**
 * `made` and `preserved`, read off a source deck and the deck revised from
 * it: the task's new words where it wants them and its old words nowhere;
 * every slide it does not change identical to the source's, part for part,
 * and every slide it edits in place with its shapes where they were. `order`
 * is the revised deck's slides as the build recorded them (`revision.order`).
 */
function scoreDeck(task, { source, revised, order, dir }) {
  const accept = task.accept, slides = printed(revised, dir);
  mkdirSync(path.join(dir, "source-read"), { recursive: true });
  const original = printed(source, path.join(dir, "source-read"));
  // The words a slide prints, or - `notes: true` - its speaker's notes.
  const prints = (accept.prints || []).map((want) => ({ ...want, ok: Boolean(want.notes ? slides[want.slide - 1]?.notes.includes(want.text) : slides[want.slide - 1]?.texts.some((text) => text.includes(want.text))) }));
  const gone = (accept.gone || []).map((phrase) => ({ phrase, still: slides.filter((slide) => [...slide.texts, slide.notes].some((text) => says(text, phrase))).map((slide) => slide.index) }));
  // A title asked for in the user's words, not in the scripted author's: the slide's title is no longer the source's, and is a sentence.
  const retitled = (accept.retitled || []).map((entry) => { const slide = titleAsked(entry), now = slides[slide - 1]?.title ?? "", was = original[order[slide - 1]?.carried ? order[slide - 1].carried - 1 : slide - 1]?.title ?? "";
    return { slide, title: now, ok: now.trim() !== was.trim() && now.trim().split(/\s+/).length >= 5 && (entry.says || []).every((word) => says(now, word)) }; });
  const extra = unasked(task, original, slides, order);
  // What a composed page draws is read off the assembled deck's scene: the runtime draws some charts as shapes, which no reader of the file names.
  const scene = accept.draws && existsSync(path.join(path.dirname(revised), "deck-scene.json")) ? readJson(path.join(path.dirname(revised), "deck-scene.json")) : null;
  const draws = accept.draws ? { ...accept.draws, ok: Boolean(scene?.slides[accept.draws.slide - 1]?.componentInstances?.some((c) => c.component === accept.draws.component)) } : null;
  // Source slide n against the slide of the revised deck that carries it.
  const pairs = order.map((item, at) => (item.carried ? `${item.carried}:${at + 1}` : null)).filter(Boolean);
  const report = path.join(dir, "preservation.json");
  const measured = run(python(path.join(HERE, "preservation.py"), source, revised, "--pairs", pairs.join(","), "--json", report));
  if (measured.code !== 0) throw new Error(`preservation.py: ${measured.stderr.slice(-1000)}`);
  const kept = readJson(report).slides;
  const edited = new Set(order.filter((item) => item.edited).map((item) => item.carried));
  const untouched = kept.filter((slide) => !edited.has(slide.source)), inPlace = kept.filter((slide) => edited.has(slide.source));
  const drifted = untouched.filter((slide) => !slide.parts).map((slide) => slide.source);
  const displaced = inPlace.filter((slide) => slide.geometry !== 0 || slide.unmatched !== 0).map((slide) => slide.source);
  return {
    made: { ok: prints.every((p) => p.ok) && gone.every((g) => !g.still.length) && retitled.every((r) => r.ok) && (!draws || draws.ok), prints, gone, ...(retitled.length ? { retitled } : {}), ...(draws ? { draws } : {}) },
    asked: { ok: !extra.length, unasked: extra },
    preserved: { ok: !drifted.length && !displaced.length, untouched: untouched.length, identical: untouched.length - drifted.length, drifted,
      editedInPlace: inPlace.length, displaced, furthest: Math.max(0, ...kept.map((slide) => slide.geometry)) },
  };
}

/** One task, run as the scripted author runs it. Returns the commands, the refusals and the four checks. */
function runTask(task, work) {
  const dir = path.join(work, task.id), out = path.join(dir, "out");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const source = sourceOf(task, work);
  const commands = [], refusals = [];
  const step = (name, command, more = {}) => { const done = run(command, { cwd: dir }); commands.push({ step: name, exit: done.code, ...more }); return done; };
  const pagesFile = path.join(dir, `${DECK_ID}.pages.json`), deckFile = path.join(dir, `${DECK_ID}.deck.json`);
  const changed = task.accept.changed;

  const imported = step("import", python(path.join(RUNTIME, "import-deck.py"), source, dir, "--carry", "--id", DECK_ID));
  if (imported.code !== 0) return { task: task.id, commands, refusals, error: `import refused: ${imported.stderr.slice(-600)}` };
  // What the pages the task composes need beside the pages file: the insight log a bound exhibit names, a picture.
  for (const [name, from] of Object.entries(task.files || {})) cpSync(path.resolve(task.base, from), path.join(dir, name), { recursive: true });
  let doc = readJson(pagesFile);
  doc.deck.request = task.request;
  // The moves: each compiled as it is written; the next is made only where the compile refused this one.
  let stale = null, compiled = false;
  for (const [at, move] of task.moves.entries()) {
    doc = applyMove(doc, move);
    writeFileSync(pagesFile, `${JSON.stringify(doc, null, 1)}\n`);
    const checked = step("check", node("author-deck.mjs", pagesFile, "--check"), { move: at + 1 });
    if (checked.code === 0) { compiled = true; break; }
    const found = refusalsOf(dir, changed);
    refusals.push(...found.map((f) => ({ ...f, step: "check", move: at + 1 })));
    // The other slides a stale finding names, read from what the run printed in full: each is said to "still" print or state the old figure.
    const named = found.some((f) => /STALE/.test(f.code)) ? (checked.stderr.match(/\bs\d{2,3}(?= (?:itself )?still )/g) || []) : [];
    if (named.length) stale = [...new Set([...(stale || []), ...named])];
  }
  if (!compiled) return { task: task.id, commands, refusals, error: "the scripted moves did not compile" };
  const full = step("compile", node("author-deck.mjs", pagesFile));
  if (full.code !== 0) { refusals.push(...refusalsOf(dir, changed).map((f) => ({ ...f, step: "compile" }))); return { task: task.id, commands, refusals, error: "the full compile refused the deck" }; }

  // The storyline: ready without a critique where no title changed; a critique of the changed pages where one did.
  let critique = { staged: false, changed: [] };
  const story = step("storyline", node("storyline.mjs", deckFile, out));
  if (story.code === 3) {
    const said = lastJson(story.stdout), packet = readJson(path.join(said.dir, "packet.json"));
    critique = { staged: true, changed: packet.revision?.changed ?? null, pages: packet.pages.length };
    const answer = run([process.execPath, FAKE_CRITIC], { cwd: said.dir });
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, "storyline-review.json"), scriptedCritique(JSON.parse(answer.stdout).result, task.critic));
    const again = step("storyline", node("storyline.mjs", deckFile, out));
    critique.status = lastJson(again.stdout)?.status ?? null;
  } else critique.status = lastJson(story.stdout)?.status ?? null;

  const built = step("build", node("build-deck.mjs", deckFile, out));
  const result = existsSync(path.join(out, "build-result.json")) ? readJson(path.join(out, "build-result.json")) : null;
  if (built.code !== 0 || !result?.revision) return { task: task.id, commands, refusals, critique, error: `the build did not assemble the deck: ${(result?.blockers || []).map((b) => b.code).join(", ") || built.stderr.slice(-600)}` };

  // The self-check the author owes: the claims the revision wrote or rewrote, and no other page's.
  const ledger = readJson(path.join(out, "claims.json"));
  writeFileSync(path.join(out, "self-check.json"), JSON.stringify({ pages: Object.fromEntries(Object.entries(ledger.pageHashes).map(([id, claims]) => [id, { claims, verified: true }])),
    findings: Object.fromEntries(ledger.findings.map((f) => [`${f.code}:${f.claim ?? f.slide}`, "Checked against the figure the request states; it is the user's own."])) }));
  const delivered = step("deliver", node("deliver-deck.mjs", deckFile, out, "--skip-build", "--reviewer", "packet"));
  const report = lastJson(delivered.stdout) ?? {};
  const review = { exit: delivered.code, mode: report.reviewMode ?? null, pages: report.review?.pages ?? null, of: result.revision.order.length, rejectedAt: report.rejectedAt ?? null,
    changed: delivered.code === 3 && report.review?.packet ? readJson(path.join(report.review.packet, "packet.json")).revision?.changed ?? null : null };
  // Where the task says so, the run goes on to an accepted delivery: a scripted reviewer answers the packet for the pages it asks for.
  let handed = null;
  if (task.deliver && delivered.code === 3) {
    const record = readJson(path.join(dir, ".reviews", DECK_ID, "review-packet.json")), file = path.join(dir, "scripted-review.json");
    writeFileSync(file, JSON.stringify(scriptedReview(record, review.changed ?? changed)));
    const done = step("deliver", node("deliver-deck.mjs", deckFile, out, "--skip-build", "--review", file));
    const final = lastJson(done.stdout) ?? {};
    const told = (final.aboutImported || []).flatMap((item) => item.pages || []);
    handed = { exit: done.code, accepted: final.accepted === true, stage: final.stage ?? null, rejectedAt: final.rejectedAt ?? null, made: (final.made || []).map((line) => line.text), aboutImported: final.aboutImported || [],
      deliverable: final.deliverable && existsSync(final.deliverable) ? final.deliverable : null,
      // Every change listed for the user, and what was found in the slides nobody asked to change said to them - those slides untouched (`preserved`).
      ok: final.accepted === true && (final.made || []).length > 0 && (task.accept.aboutImported || []).every((id) => told.includes(id)) };
  }

  const scored = scoreDeck(task, { source, revised: result.pptxPath, order: result.revision.order, dir });
  const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
  const wantsCritique = task.accept.critique.length > 0;
  const checks = { ...scored, ...(task.deliver ? { delivered: handed ?? { ok: false, error: "the review packet was not reached" } } : {}),
    stale: task.accept.stale ? { ok: task.accept.stale.every((id) => (stale || []).includes(id)), wanted: task.accept.stale, named: stale || [] } : { ok: true, wanted: null },
    // The first move is refused for what the task says it must be: an edit that would have rewritten longer numbers, say.
    ...(task.accept.refusedFor ? { refusedFor: { ok: task.accept.refusedFor.every((code) => refusals.some((f) => f.code === code && f.move === 1)), wanted: task.accept.refusedFor, got: [...new Set(refusals.filter((f) => f.move === 1).map((f) => f.code))] } } : {}),
    scoped: { ok: !refusals.some((f) => f.about === "untouched") && critique.staged === wantsCritique && (!wantsCritique || (same(critique.changed, task.accept.critique) && critique.status === "ready"))
        && review.exit === 3 && same(review.changed, changed) && review.pages === changed.length,
      refusalsOnUntouched: refusals.filter((f) => f.about === "untouched").length, critique, review },
  };
  return { task: task.id, fixture: task.fixture ?? path.basename(task.deck), accepted: Object.values(checks).every((check) => check.ok), checks,
    cost: { commands: commands.length, sequence: commands.map((c) => `${c.step}${c.exit ? `(${c.exit})` : ""}`), refusedRuns: commands.filter((c) => c.exit === 2).length, refusals,
      composed: result.revision.composed, carried: result.revision.carried, edited: result.revision.edited, seconds: Math.round((result.timings?.wallMs ?? 0) / 100) / 10 } };
}

/**
 * The scripted critic's answer (evals/quality/fixtures/fake-critic.mjs: a
 * clean spine, ready), with what a task has its critic find (`critic` on the
 * task): `aboutImported` - a finding whose remedy is a slide the revision
 * did not change, filed as the critic's prompt asks: flagged, at its own
 * severity, naming that slide beside the changed page. It leaves the verdict
 * as it was: such a finding is the user's to hear, and blocks nothing.
 */
function scriptedCritique(answer, critic) {
  if (!critic?.aboutImported) return answer;
  const critique = JSON.parse(answer), found = critic.aboutImported;
  critique.findings = [...critique.findings, { id: "F9", scope: "spine", pages: found.pages, check: "numbers", severity: found.severity ?? "major", problem: found.problem, fix: found.fix, aboutImported: true }];
  critique.completeness = critique.completeness.map((entry) => (entry.check === "numbers" ? { ...entry, result: "findings", note: "Filed an item under numbers, about the imported deck." } : entry));
  return JSON.stringify(critique);
}

/** A scripted reviewer's answer to a first-pass packet (`record`: the packet's record beside the deck): the pages it asks for, read and accepted. */
function scriptedReview(record, ids) {
  return { pass: 1, verifies: null, accepted: true, summary: "The changed pages read as part of the deck they sit in. Nothing must change.", rating: 8.5, binding: record.binding, opened: [...ids],
    provenance: { backend: "subagent", model: "scripted-reviewer", promptHash: record.promptHash },
    pages: ids.map((slide) => ({ slide, verdict: "ok", checks: Object.fromEntries(PAGE_DIMENSIONS.map((dimension) => [dimension, `checked ${dimension} on the page`])) })), findings: [],
    completeness: DIMENSIONS.map((dimension) => ({ dimension, result: "clean", note: `Checked ${dimension} on the changed pages and found nothing to raise.` })),
    assessment: Object.fromEntries(ASSESSMENT_KEYS.map((key) => [key, `A sentence about ${key}.`])), density: { deck: "No density profile was built for this deck, so no medians are compared.", pages: [] } };
}

// Folders of a workspace that hold copies of a deck, not the run's own.
const SKIP = new Set(["node_modules", ".git", ".reviews", "__pycache__"]);
const findAll = (dir, name, out = []) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name);
  if (entry.isDirectory()) { if (!SKIP.has(entry.name)) findAll(full, name, out); } else if (entry.name === name) out.push(full); } return out; };

// A CLI asked for its result as one JSON object (`--output-format json`) is asked for the whole run instead, where it can give
// it (Claude Code: `stream-json`, which needs `--verbose`): every command the agent ran and every refusal it met, kept as the transcript.
const withTranscript = (command) => { const at = command.findIndex((arg, i) => arg === "--output-format" && command[i + 1] === "json");
  return at < 0 ? command : [...command.slice(0, at), "--output-format", "stream-json", "--verbose", ...command.slice(at + 2)]; };

/** One task given to a real agent CLI: the request and the deck in an empty workspace, and the deck it leaves scored. */
function runAgentTask(task, work, agent, plugin) {
  const workspace = path.join(work, `${task.id}-agent`);
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(workspace, { recursive: true });
  const source = sourceOf(task, work), name = path.basename(source);
  cpSync(source, path.join(workspace, name));
  for (const [file, from] of Object.entries(task.files || {})) cpSync(path.resolve(task.base, from), path.join(workspace, file), { recursive: true });
  // The agent is told where a revision is built, as SKILL.md tells an author: a task folder beside the user's deck.
  const prompt = `${task.request}\n\nThe deck is ${name}, in this folder. It is a change to an existing deck, not a new one: keep every slide the request does not name exactly as it is, build the revision in the folder work/ beside the deck, and take the revised deck as far as the deck review's packet.`;
  const started = Date.now();
  const done = run(fillTemplate(withTranscript(agent.command), { prompt, workspace, plugin: plugin ?? "" }), { cwd: workspace, timeoutMinutes: agent.timeoutMinutes ?? 60 });
  const seconds = Math.round((Date.now() - started) / 1000);
  // The transcript is kept: what the agent ran, read and was refused is the evidence a score alone does not hold.
  const transcript = path.join(work, `${task.id}-agent.stdout`);
  writeFileSync(transcript, done.stdout);
  writeFileSync(path.join(work, `${task.id}-agent.stderr`), done.stderr);
  const about = { exit: done.code, error: done.error, seconds, transcript };
  // The revision, wherever the agent built it: in the workspace, or in a folder its transcript names.
  const named = [...new Set((done.stdout.match(/\/[^"'\s\\|]+?build-result\.json/g) || []).filter((file) => existsSync(file)))];
  const builds = [...new Set([...findAll(workspace, "build-result.json"), ...named])].map((file) => ({ file, result: readJson(file) })).filter((b) => b.result.revision && existsSync(b.result.pptxPath ?? "")).sort((a, b) => statSync(b.file).mtimeMs - statSync(a.file).mtimeMs);
  if (!builds.length) return { task: task.id, fixture: task.fixture ?? path.basename(task.deck), accepted: false, agent: about, error: "the agent left no assembled revision (no build-result.json with `revision`)" };
  const { file, result } = builds[0], outDir = path.dirname(file), deckDir = path.dirname(outDir);
  const scored = scoreDeck(task, { source, revised: result.pptxPath, order: result.revision.order, dir: outDir });
  // The review packet the agent reached, from delivery's own record of it: it asks for the task's changed pages and no other.
  const delivery = existsSync(path.join(outDir, "delivery.json")) ? readJson(path.join(outDir, "delivery.json")) : null;
  const staged = delivery?.review?.packet && existsSync(path.join(delivery.review.packet, "packet.json")) ? readJson(path.join(delivery.review.packet, "packet.json")) : null;
  const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
  const packet = { ok: delivery?.accepted === true || (Boolean(staged) && same(staged.revision?.changed, task.accept.changed)), reached: Boolean(staged) || delivery?.accepted === true, changed: staged?.revision?.changed ?? null,
    stage: delivery?.stage ?? null, rejectedAt: delivery?.rejectedAt ?? null, aboutImported: (delivery?.aboutImported || []).map((item) => item.pages) };
  const checks = { ...scored, packet };
  const logs = [...findAll(workspace, "author-log.jsonl"), ...(existsSync(deckDir) ? readdirSync(deckDir).filter((f) => f.endsWith(".author-log.jsonl")).map((f) => path.join(deckDir, f)) : [])];
  const runs = logs.length ? readRunLog(logs[0]) : [];
  return { task: task.id, fixture: task.fixture ?? path.basename(task.deck), accepted: Object.values(checks).every((check) => check.ok), checks, agent: about, built: outDir, ...(runs.length ? { cost: runCost(runs) } : {}) };
}

const mark = (check) => (check?.ok ? "yes" : "NO");
/** The results as the table a run prints. */
function table(results) {
  const lines = ["| task | made | preserved (untouched slides identical) | asked (nothing else changed) | stale caught | scoped | delivered | review packet | commands | refused runs | refusals on untouched pages | seconds |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const r of results) {
    if (!r.checks) { lines.push(`| ${r.task} | - | - | - | - | - | - | - | ${r.commands?.length ?? "-"} | - | ${r.error} | ${r.agent?.seconds ?? "-"} |`); continue; }
    const c = r.checks, cost = r.cost ?? {};
    lines.push(`| ${r.task} | ${mark(c.made)} | ${mark(c.preserved)} (${c.preserved.identical} of ${c.preserved.untouched}${c.preserved.editedInPlace ? `; ${c.preserved.editedInPlace} edited in place, furthest shape moved ${c.preserved.furthest} px` : ""}) | ${mark(c.asked)}${c.asked.unasked.length ? ` (${c.asked.unasked.length}: ${c.asked.unasked.slice(0, 2).map((item) => `slide ${item.slide} ${item.what}`).join("; ")})` : ""} | ${c.stale ? (c.stale.wanted ? mark(c.stale) : "n/a") : "-"} | ${c.scoped ? mark(c.scoped) : "-"} | ${c.delivered ? `${mark(c.delivered)}${c.delivered.aboutImported?.length ? ` (${c.delivered.aboutImported.length} reported about the imported deck)` : ""}` : "n/a"} | ${c.packet ? `${mark(c.packet)}${c.packet.reached ? "" : " (not reached)"}` : "-"} | ${cost.commands ?? cost.runs ?? "-"}${cost.sequence ? ` (${cost.sequence.join(", ")})` : ""} | ${cost.refusedRuns ?? cost.refused ?? "-"} | ${c.scoped ? c.scoped.refusalsOnUntouched : "-"} | ${r.agent?.seconds ?? cost.seconds ?? "-"} |`);
  }
  return lines.join("\n");
}

const USAGE = "Usage: run.mjs [--task <id>]... [--tasks <file>] [--work <dir>] [--agent <name>] [--json <file>]";

async function main(argv) {
  const { values } = parseCli(argv, { task: { type: "string", multiple: true }, tasks: { type: "string" }, work: { type: "string" }, agent: { type: "string" }, json: { type: "string" } }, { usage: USAGE });
  const wanted = values.task ? [values.task].flat() : null;
  const TASKS = readTasks(values.tasks ? path.resolve(values.tasks) : undefined);
  const unknown = (wanted || []).filter((id) => !TASKS.some((task) => task.id === id));
  if (unknown.length) { console.error(`No task ${unknown.join(", ")}; the tasks are ${TASKS.map((task) => task.id).join(", ")}`); return 1; }
  const work = values.work ? path.resolve(values.work) : mkdtempSync(path.join(os.tmpdir(), "point-change-"));
  mkdirSync(work, { recursive: true });
  const tasks = TASKS.filter((task) => !wanted || wanted.includes(task.id));
  let results;
  if (values.agent) {
    const config = readJson(path.join(ROOT, "evals", "quality", "config.json")), agent = config.agents?.[values.agent];
    if (!agent) { console.error(`No agent "${values.agent}" in evals/quality/config.json (${Object.keys(config.agents ?? {}).join(", ")})`); return 1; }
    let plugin = null;
    if (agent.command.some((arg) => String(arg).includes("{plugin}"))) {
      plugin = path.join(work, "plugin");
      const packed = run(python(path.join(ROOT, "evals", "scripts", "package_plugin.py"), "--output", plugin), { cwd: ROOT });
      if (packed.code !== 0) { console.error(`packaging the plugin failed: ${packed.stderr.slice(-1000)}`); return 1; }
    }
    results = tasks.map((task) => runAgentTask(task, work, agent, plugin));
  } else results = tasks.map((task) => runTask(task, work));
  if (values.json) writeFileSync(path.resolve(values.json), `${JSON.stringify(results, null, 1)}\n`);
  console.log(table(results));
  console.error(`\n${results.filter((r) => r.accepted).length} of ${results.length} tasks accepted; work in ${work}`);
  return results.every((r) => r.accepted) ? 0 : 2;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((code) => process.exit(code), (error) => { console.error(error?.stack || String(error)); process.exit(1); });
