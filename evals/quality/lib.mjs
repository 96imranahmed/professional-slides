/**
 * The quality eval's moving parts, kept apart from the command line so the
 * suite can test them without calling a model.
 *
 *   briefs          which briefs a set holds (dev = the cold-run briefs,
 *                   heldout = briefs never used for tuning)
 *   skillSha        the version under test: the git tree of skills/, plus a
 *                   digest of any uncommitted change to it
 *   collect         what an agent run left in its workspace
 *   packets         what a judge is shown - the brief, the rubric and the
 *                   rendered pages, and nothing the author wrote about them
 *   parse           the judge's JSON, from whatever wrapper its CLI put round it
 *   results         one JSON line per judged deck, keyed by skill, judge, brief, run
 *   summarize       mean and spread per brief, and the pairwise win rate
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..");
export const QUALITY = HERE;
export const RESULT_SCHEMA = "professional-slides.quality-result/v1";
export const DIMENSIONS = Object.freeze(["argument", "evidence", "visual", "copy", "sequence"]);

// --- briefs -------------------------------------------------------------------

export const BRIEF_SETS = Object.freeze({
  dev: path.join(ROOT, "evals", "cold-run", "briefs"),
  heldout: path.join(QUALITY, "briefs", "heldout"),
});

/** The briefs of a set, as `{id, set, file, text}`; `all` is dev then heldout. */
export function briefs(set, sets = BRIEF_SETS) {
  const names = set === "all" ? Object.keys(sets) : [set];
  const out = [];
  for (const name of names) {
    const dir = sets[name];
    if (!dir) throw new Error(`Unknown brief set: ${name} (dev, heldout or all)`);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md").sort()) {
      out.push({ id: `${name}/${file.replace(/\.md$/, "")}`, set: name, file: path.join(dir, file),
                 text: readFileSync(path.join(dir, file), "utf8") });
    }
  }
  return out;
}

/**
 * The request a stranger would type: the brief with the suite's own notes
 * removed. "Why this brief is in the suite" says what the brief is there to
 * catch, which is a hint the agent must not get.
 */
export function briefRequest(text) {
  return text.split(/\n(?=Why this brief is in the suite)/)[0].trim() + "\n";
}

// --- version ------------------------------------------------------------------

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 });

/**
 * The version of the skill under test: the git tree hash of `skills/` at HEAD,
 * and when the working tree differs from it, `+dirty.<digest>` of the change,
 * so two different uncommitted states never share a key.
 */
export function skillSha(root = ROOT) {
  const tree = git(["rev-parse", "HEAD:skills"], root).trim();
  const status = git(["status", "--porcelain", "--untracked-files=all", "--", "skills"], root);
  if (!status.trim()) return tree;
  const digest = createHash("sha256").update(git(["diff", "HEAD", "--binary", "--", "skills"], root));
  const untracked = git(["ls-files", "--others", "--exclude-standard", "--", "skills"], root).split("\n").filter(Boolean).sort();
  for (const file of untracked) digest.update(file).update(readFileSync(path.join(root, file)));
  return `${tree}+dirty.${digest.digest("hex").slice(0, 12)}`;
}

// --- commands -----------------------------------------------------------------

/** Fill `{name}` placeholders in every argument of a command template. */
export function fillTemplate(command, vars) {
  return command.map((arg) => String(arg).replace(/\{(\w+)\}/g, (whole, name) =>
    (Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole)));
}

// --- what an agent run left behind ---------------------------------------------

// Review and storyline histories (`.reviews/`) hold earlier copies of the
// deck's files; the run's deck is the one in its build directory.
const SKIP_DIRS = new Set(["node_modules", ".git", "__pycache__", ".claude", ".reviews"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const slideNumber = (file) => Number(path.basename(file).match(/(\d+)/)?.[1] ?? 0);
const newest = (files) => files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? null;

/**
 * The deck a run produced: the build directory (the one holding scene.json,
 * preferring one that was delivered), its renders and review sheets, and the
 * authoring files that sit beside the spec. Null fields are things the run did
 * not write.
 */
export function collectArtifacts(workspace) {
  const files = existsSync(workspace) ? walk(workspace) : [];
  const scenes = files.filter((f) => path.basename(f) === "scene.json");
  const delivered = scenes.filter((f) => {
    const delivery = path.join(path.dirname(f), "delivery.json");
    try { return JSON.parse(readFileSync(delivery, "utf8")).accepted === true; } catch { return false; }
  });
  const scene = newest(delivered.length ? delivered : scenes);
  const buildDir = scene ? path.dirname(scene) : null;
  const rendered = buildDir ? path.join(buildDir, "rendered") : null;
  const inRendered = (pattern) => (rendered && existsSync(rendered)
    ? readdirSync(rendered).filter((f) => pattern.test(f)).map((f) => path.join(rendered, f)).sort((a, b) => slideNumber(a) - slideNumber(b))
    : []);
  const authored = (suffix) => newest(files.filter((f) => f.endsWith(suffix) && !f.includes(`${path.sep}rendered${path.sep}`)));
  return {
    workspace,
    buildDir,
    scene,
    delivery: buildDir && existsSync(path.join(buildDir, "delivery.json")) ? path.join(buildDir, "delivery.json") : null,
    plan: authored(".plan.json"),
    pages: authored(".pages.json"),
    deck: authored(".deck.json"),
    slides: inRendered(/^slide-\d+\.png$/),
    sheets: inRendered(/^spread-\d+\.png$/),
  };
}

/**
 * Keep a run: the authoring files and the scene (gzipped), the delivery record
 * and the rendered pages. Kept under the store so a later version of the skill
 * can be judged against this one, deck against deck.
 */
export function storeArtifacts(artifacts, dir) {
  mkdirSync(path.join(dir, "rendered"), { recursive: true });
  const kept = {};
  for (const role of ["plan", "pages", "deck", "delivery"]) {
    if (!artifacts[role]) continue;
    copyFileSync(artifacts[role], path.join(dir, `${role}.json`));
    kept[role] = `${role}.json`;
  }
  if (artifacts.scene) {
    writeFileSync(path.join(dir, "scene.json.gz"), gzipSync(readFileSync(artifacts.scene)));
    kept.scene = "scene.json.gz";
  }
  for (const file of [...artifacts.slides, ...artifacts.sheets]) copyFileSync(file, path.join(dir, "rendered", path.basename(file)));
  kept.slides = artifacts.slides.map((f) => `rendered/${path.basename(f)}`);
  kept.sheets = artifacts.sheets.map((f) => `rendered/${path.basename(f)}`);
  writeFileSync(path.join(dir, "kept.json"), JSON.stringify(kept, null, 1) + "\n");
  return kept;
}

// --- judge packets -------------------------------------------------------------

export const RUBRIC = path.join(QUALITY, "rubric.md");
export const JUDGE_SCHEMA = path.join(QUALITY, "judge-schema.json");
export const PAIRWISE_SCHEMA = path.join(QUALITY, "pairwise-schema.json");
export const ANCHOR_SCHEMA = path.join(QUALITY, "anchor-judge-schema.json");

/**
 * The pages a judge reads for one stored deck: its review sheets (four pages
 * to a sheet) when the build drew them, the single pages otherwise.
 */
export function deckPages(storedDir) {
  const kept = JSON.parse(readFileSync(path.join(storedDir, "kept.json"), "utf8"));
  const chosen = kept.sheets.length ? kept.sheets : kept.slides;
  return chosen.map((rel) => path.join(storedDir, rel));
}

function copyPages(pages, dir) {
  mkdirSync(dir, { recursive: true });
  pages.forEach((file, i) => copyFileSync(file, path.join(dir, `sheet-${String(i + 1).padStart(2, "0")}${path.extname(file)}`)));
}

const DECK_PROMPT = `You are judging a slide deck as the reader it was written for would. Everything you may use is in this directory:
- brief.md: the request the deck answers
- rubric.md: how to score it
- sheets/: the rendered pages in order, several to a sheet
Read the brief, then the rubric, then every sheet. Use nothing else, and do not search for other files.
Return only a JSON object: {"rating": number 1-10, "dimensions": {"argument": n, "evidence": n, "visual": n, "copy": n, "sequence": n}, "majors": [{"pages": [page numbers], "problem": "one sentence"}]}`;

const PAIR_PROMPT = `You are comparing two slide decks written for the same request, as the reader they were written for would. Everything you may use is in this directory:
- brief.md: the request both decks answer
- rubric.md: what makes one better than the other
- deck-1/ and deck-2/: each deck's rendered pages in order, several to a sheet
Read the brief and the rubric, then every sheet of both decks. Use nothing else, and do not search for other files.
Return only a JSON object: {"preference": "deck-1" | "deck-2" | "tie", "margin": "slight" | "clear" | "decisive", "reasons": ["one sentence each"]}`;

const ANCHOR_PROMPT = `You are scoring one rendered slide on the page scale in rubric.md. Read rubric.md, then the page image (page.jpg or page.png) in this directory. Use nothing else.
Return only a JSON object: {"rating": number 1-10}`;

/**
 * A single-deck packet: the brief as the user wrote it, the condensed rubric
 * and the rendered pages. Never the pages file, the plan, the scene, reviews,
 * self-checks or anything else the author wrote about the deck.
 */
export function buildDeckPacket(dir, { briefText, pages }) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "brief.md"), briefRequest(briefText));
  copyFileSync(RUBRIC, path.join(dir, "rubric.md"));
  copyPages(pages, path.join(dir, "sheets"));
  return { dir, prompt: DECK_PROMPT, schema: readFileSync(JUDGE_SCHEMA, "utf8") };
}

/**
 * A pairwise packet. Which deck is the version under test is decided by
 * `swap`, recorded by the caller and never written into the packet.
 */
export function buildPairPacket(dir, { briefText, current, previous, swap }) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "brief.md"), briefRequest(briefText));
  copyFileSync(RUBRIC, path.join(dir, "rubric.md"));
  const order = swap ? ["previous", "current"] : ["current", "previous"];
  const decks = { current, previous };
  order.forEach((who, i) => copyPages(decks[who], path.join(dir, `deck-${i + 1}`)));
  return { dir, prompt: PAIR_PROMPT, schema: readFileSync(PAIRWISE_SCHEMA, "utf8"), order };
}

export function buildAnchorPacket(dir, { image }) {
  mkdirSync(dir, { recursive: true });
  copyFileSync(RUBRIC, path.join(dir, "rubric.md"));
  copyFileSync(image, path.join(dir, `page${path.extname(image)}`));
  return { dir, prompt: ANCHOR_PROMPT, schema: readFileSync(ANCHOR_SCHEMA, "utf8") };
}

/** Deterministic presentation order for a pair, so a rerun shows the same order. */
export function pairSwap(key) {
  return createHash("sha256").update(key).digest()[0] % 2 === 1;
}

// --- judge output ---------------------------------------------------------------

function lastJsonObject(text) {
  const stripped = String(text).replace(/```(?:json)?/g, "");
  for (let end = stripped.lastIndexOf("}"); end >= 0; end = stripped.lastIndexOf("}", end - 1)) {
    for (let start = stripped.lastIndexOf("{", end); start >= 0; start = stripped.lastIndexOf("{", start - 1)) {
      try { return JSON.parse(stripped.slice(start, end + 1)); } catch { /* keep widening */ }
    }
  }
  return null;
}

/**
 * The judge's answer, whether its CLI printed it bare, inside a result
 * envelope (`{"result": "...", "structured_output": {...}}`) or inside prose.
 */
export function parseJudgeOutput(stdout) {
  let parsed = null;
  try { parsed = JSON.parse(stdout); } catch { parsed = lastJsonObject(stdout); }
  if (parsed && typeof parsed === "object") {
    if (parsed.structured_output && typeof parsed.structured_output === "object") return parsed.structured_output;
    if (typeof parsed.result === "string" && !("rating" in parsed) && !("preference" in parsed)) return lastJsonObject(parsed.result);
  }
  return parsed;
}

const inScale = (n) => typeof n === "number" && Number.isFinite(n) && n >= 1 && n <= 10;

export function validateVerdict(verdict) {
  if (!verdict || !inScale(verdict.rating)) throw new Error("judge returned no rating on the 1-10 scale");
  const dimensions = {};
  for (const name of DIMENSIONS) {
    const value = verdict.dimensions?.[name];
    if (!inScale(value)) throw new Error(`judge returned no ${name} score`);
    dimensions[name] = value;
  }
  const majors = Array.isArray(verdict.majors) ? verdict.majors : [];
  return { rating: verdict.rating, dimensions, majors };
}

export function validatePreference(verdict, order) {
  const choice = verdict?.preference;
  if (!["deck-1", "deck-2", "tie"].includes(choice)) throw new Error("judge returned no preference");
  const preferred = choice === "tie" ? "tie" : order[Number(choice.slice(-1)) - 1];
  return { preferred, margin: verdict.margin ?? null, reasons: Array.isArray(verdict.reasons) ? verdict.reasons : [], order };
}

// --- results --------------------------------------------------------------------

export const keyOf = (row) => [row.key.skillSha, row.key.judge, row.key.brief, row.key.run].join(" | ");

export function readResults(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
}

/** Append one row; a row whose key is already recorded is refused rather than doubled. */
export function appendResult(file, row, existing = readResults(file)) {
  if (row.kind !== "anchors" && existing.some((r) => r.kind !== "anchors" && keyOf(r) === keyOf(row))) {
    throw new Error(`already recorded: ${keyOf(row)}`);
  }
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(row) + "\n");
  return row;
}

/** Runs of one deck identity already recorded, so new runs continue the count. */
export function nextRun(rows, { skillSha, brief, agent, prompt }) {
  const runs = rows.filter((r) => r.kind !== "anchors" && r.key.skillSha === skillSha && r.key.brief === brief
    && r.agent === agent && r.prompt === prompt).map((r) => r.key.run);
  return runs.length ? Math.max(...runs) + 1 : 1;
}

/**
 * The deck a new version is compared with: the most recently recorded judged
 * deck of the same brief, agent and prompt from a different skill version,
 * whose stored pages still exist under `store` (rows record the kept deck
 * relative to the store, so results.jsonl carries no machine path).
 */
export function previousDeck(rows, { skillSha, brief, agent, prompt }, store) {
  const candidates = rows.filter((r) => r.kind !== "anchors" && r.key.brief === brief && r.key.skillSha !== skillSha
    && r.agent === agent && r.prompt === prompt && r.deck?.artifacts);
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const dir = path.resolve(store, candidates[i].deck.artifacts);
    if (existsSync(path.join(dir, "kept.json")) && deckPages(dir).length) {
      return { skillSha: candidates[i].key.skillSha, run: candidates[i].key.run, dir };
    }
  }
  return null;
}

// --- summary --------------------------------------------------------------------

const round = (n, places = 2) => (n === null || n === undefined ? null : Math.round(n * 10 ** places) / 10 ** places);

export function spread(values) {
  if (!values.length) return { n: 0, mean: null, sd: null, min: null, max: null };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = values.length > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)) : 0;
  return { n: values.length, mean: round(mean), sd: round(sd), min: Math.min(...values), max: Math.max(...values) };
}

/** Wins count one, ties a half, over every comparison that returned a preference. */
export function winRate(pairs) {
  const decided = pairs.filter((p) => p && p.preferred);
  const wins = decided.filter((p) => p.preferred === "current").length;
  const ties = decided.filter((p) => p.preferred === "tie").length;
  const losses = decided.filter((p) => p.preferred === "previous").length;
  return { comparisons: decided.length, wins, ties, losses, rate: decided.length ? round((wins + ties / 2) / decided.length) : null };
}

/**
 * Mean and spread of the judge's rating per brief for one skill version and
 * judge, with the build and plan verdicts and the pairwise record beside it.
 */
export function summarize(rows, { skillSha, judge }) {
  const mine = rows.filter((r) => r.kind !== "anchors" && r.key.skillSha === skillSha && r.key.judge === judge);
  const byBrief = {};
  for (const row of mine) (byBrief[row.key.brief] ??= []).push(row);
  const perBrief = {};
  for (const [brief, list] of Object.entries(byBrief).sort()) {
    const judged = list.filter((r) => r.judge && typeof r.judge.rating === "number");
    perBrief[brief] = {
      runs: list.length,
      noDeck: list.filter((r) => r.status === "no-deck" || r.status === "agent-failed").length,
      rating: spread(judged.map((r) => r.judge.rating)),
      dimensions: Object.fromEntries(DIMENSIONS.map((d) => [d, spread(judged.map((r) => r.judge.dimensions[d])).mean])),
      buildAccepted: list.filter((r) => r.build?.accepted === true).length,
      planAccepted: list.filter((r) => r.plan?.accepted === true).length,
      delivered: list.filter((r) => r.deck?.delivered === true).length,
      pairwise: winRate(list.map((r) => r.pairwise)),
    };
  }
  return { skillSha, judge, briefs: perBrief, pairwise: winRate(mine.map((r) => r.pairwise)) };
}

export function formatSummary(summary) {
  const lines = [`skill ${summary.skillSha} · judge ${summary.judge}`];
  lines.push(`  ${"brief".padEnd(32)}${"runs".padStart(5)}${"mean".padStart(7)}${"sd".padStart(6)}${"min".padStart(6)}${"max".padStart(6)}${"no deck".padStart(9)}${"build".padStart(7)}${"plan".padStart(6)}${"W-T-L".padStart(9)}${"win".padStart(6)}`);
  for (const [brief, s] of Object.entries(summary.briefs)) {
    const p = s.pairwise;
    const show = (v) => (v === null || v === undefined ? "-" : String(v));
    lines.push(`  ${brief.padEnd(32)}${String(s.runs).padStart(5)}${show(s.rating.mean).padStart(7)}${show(s.rating.sd).padStart(6)}`
      + `${show(s.rating.min).padStart(6)}${show(s.rating.max).padStart(6)}${String(s.noDeck).padStart(9)}`
      + `${`${s.buildAccepted}/${s.runs}`.padStart(7)}${`${s.planAccepted}/${s.runs}`.padStart(6)}`
      + `${(p.comparisons ? `${p.wins}-${p.ties}-${p.losses}` : "-").padStart(9)}${show(p.rate).padStart(6)}`);
  }
  const all = summary.pairwise;
  lines.push(all.comparisons
    ? `  pairwise win rate against the previous version: ${all.rate} over ${all.comparisons} comparisons (${all.wins} won, ${all.ties} tied, ${all.losses} lost)`
    : "  pairwise: no previous version recorded for these briefs");
  return lines.join("\n");
}

/** Mean absolute error of the judge against the anchors a person has scored. */
export function anchorError(scored) {
  const pairs = scored.filter((a) => typeof a.humanScore === "number" && typeof a.judgeScore === "number");
  if (!pairs.length) return null;
  return round(pairs.reduce((sum, a) => sum + Math.abs(a.judgeScore - a.humanScore), 0) / pairs.length);
}
