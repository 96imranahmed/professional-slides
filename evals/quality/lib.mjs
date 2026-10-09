/**
 * The quality eval's moving parts, kept apart from the command line so the
 * suite can test them without calling a model.
 *
 *   briefs          which briefs a set holds (dev = the development briefs,
 *                   heldout = briefs never used for tuning)
 *   skillSha        the version under test: the git tree of skills/, plus a
 *                   digest of any uncommitted change to it
 *   collect         what an agent run left in its workspace
 *   packets         what a judge is shown - the brief, the rubric and the
 *                   rendered pages, and nothing the author wrote about them
 *   parse           the judge's JSON, from whatever wrapper its CLI put round it
 *   results         one JSON line per judged deck, keyed by skill, judge, treatment
 *                   (agent and prompt), brief and run; each key claimed before
 *                   its run is paid for, and each run kept in a directory of its own
 *   summarize       mean and spread per brief, and the pairwise win rate, per treatment
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, writeSync, appendFileSync } from "node:fs";
import os from "node:os";
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
  dev: path.join(QUALITY, "briefs", "dev"),
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

/**
 * What a judge command can say of the schema its answer must match. Some CLIs
 * take the schema itself as the flag's value and refuse a file path there;
 * others take a path. So a template names which it wants: `{schemaJson}` is
 * the schema inline, on one line; `{schemaPath}` a file that holds it ("" when
 * the caller has none); and `{schema}` is the one the judge's `schemaAs` says
 * - "json" (the default: what this eval has always passed) or "path". The
 * schema is given as its `text` or as the `file` holding it; `shown` prints a
 * placeholder for the inline form, for a dry run.
 */
export function schemaVars(judge, { text = null, file = null, shown = false } = {}) {
  const json = shown ? "<schema, inline>" : JSON.stringify(JSON.parse(text ?? readFileSync(file, "utf8")));
  return { schemaJson: json, schemaPath: file ?? "", schema: judge?.schemaAs === "path" && file ? file : json };
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
const readQuiet = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } };
const realQuiet = (file) => { try { return realpathSync(file); } catch { return null; } };

// The files a deck is authored in, by role. author-deck.mjs writes
// `<id>.deck.json` and `<id>.plan.json` beside the pages file, and the build
// reads the plan from beside the spec: one deck id and one directory name all three.
const AUTHORED = Object.freeze({ plan: ".plan.json", pages: ".pages.json", deck: ".deck.json" });

/**
 * The deck a build directory holds, as its build recorded it: the id - the
 * build writes `<id>.pptx` (build-result.json `pptxPath`, delivery.json
 * `build.pptx`) and delivery `<id>-DELIVERED.pptx` - and, where the build
 * recorded a stage as absent at `<spec dir>/<id>.plan.json`, the spec's
 * directory. Null when the build recorded neither.
 */
function builtDeck(buildDir) {
  const build = readQuiet(path.join(buildDir, "build-result.json")) ?? {};
  const delivery = readQuiet(path.join(buildDir, "delivery.json")) ?? {};
  const expected = Object.values(build.stages ?? {}).map((stage) => stage?.expectedAt).find((at) => typeof at === "string");
  const named = [[build.pptxPath, /\.pptx$/], [delivery.build?.pptx, /\.pptx$/], [delivery.deliverable, /-DELIVERED\.pptx$/],
                 [expected, /\.(plan|content)\.json$/]];
  for (const [file, suffix] of named) {
    if (typeof file === "string" && suffix.test(file)) return { id: path.basename(file).replace(suffix, ""), specDir: expected ? path.dirname(expected) : null };
  }
  return null;
}

/**
 * The authoring files of the deck in `buildDir`, and why any is missing. They
 * are that deck's - its id, in its spec's directory - never the newest on
 * disk, which may be another attempt's. The directory is the one the build
 * recorded, else the nearest one above the build holding the deck's files,
 * else the only one in the workspace holding them. A build that recorded no
 * id is matched by a workspace-wide search only when that finds exactly one
 * candidate; anything else is recorded as missing, with the reason, not guessed.
 */
function authoredFiles(files, workspace, buildDir) {
  const found = {}, missing = {};
  const rel = (file) => path.relative(workspace, file) || ".";
  const deck = buildDir ? builtDeck(buildDir) : null;
  if (!deck) {
    for (const [role, suffix] of Object.entries(AUTHORED)) {
      const candidates = files.filter((f) => f.endsWith(suffix));
      if (candidates.length === 1) found[role] = candidates[0];
      else missing[role] = candidates.length
        ? `${buildDir ? "the build recorded no deck id" : "no deck was built"}, and the workspace holds ${candidates.length} ${suffix} files (${candidates.map(rel).join(", ")})`
        : `the workspace holds no ${suffix} file`;
    }
    return { found, missing };
  }
  const named = (f) => Object.values(AUTHORED).some((suffix) => path.basename(f) === `${deck.id}${suffix}`);
  const dirs = [...new Set(files.filter(named).map((f) => path.dirname(f)))];
  const encloses = (dir) => buildDir === dir || buildDir.startsWith(dir + path.sep);
  const dir = (deck.specDir && dirs.find((d) => realQuiet(d) === realQuiet(deck.specDir)))
    ?? dirs.filter(encloses).sort((a, b) => b.length - a.length)[0]
    ?? (dirs.length === 1 ? dirs[0] : null);
  if (!dir) {
    const why = dirs.length
      ? `${dirs.length} directories hold deck ${deck.id}'s files (${dirs.map(rel).join(", ")}) and none encloses its build ${rel(buildDir)}`
      : `the workspace holds no file of deck ${deck.id}, the deck built in ${rel(buildDir)}`;
    for (const role of Object.keys(AUTHORED)) missing[role] = why;
    return { found, missing };
  }
  for (const [role, suffix] of Object.entries(AUTHORED)) {
    const file = path.join(dir, `${deck.id}${suffix}`);
    // A pages file may carry the id inside it (`deck.id`) under another name.
    const inside = role === "pages" ? files.filter((f) => path.dirname(f) === dir && f.endsWith(suffix) && readQuiet(f)?.deck?.id === deck.id) : [];
    if (files.includes(file)) found[role] = file;
    else if (inside.length === 1) found[role] = inside[0];
    else missing[role] = `no ${deck.id}${suffix} in ${rel(dir)}, where deck ${deck.id}'s other files are`;
  }
  return { found, missing };
}

/**
 * The deck a run produced: the build directory (the one holding scene.json,
 * preferring one that was delivered), its renders and review sheets, and the
 * authoring files of that same deck (authoredFiles). Null fields are things
 * the run did not write or that cannot be told apart; `missing` says why for
 * each authoring file.
 */
export function collectArtifacts(workspace) {
  const files = existsSync(workspace) ? walk(workspace) : [];
  const scenes = files.filter((f) => path.basename(f) === "scene.json");
  const delivered = scenes.filter((f) => readQuiet(path.join(path.dirname(f), "delivery.json"))?.accepted === true);
  const scene = newest(delivered.length ? delivered : scenes);
  const buildDir = scene ? path.dirname(scene) : null;
  const rendered = buildDir ? path.join(buildDir, "rendered") : null;
  const inRendered = (pattern) => (rendered && existsSync(rendered)
    ? readdirSync(rendered).filter((f) => pattern.test(f)).map((f) => path.join(rendered, f)).sort((a, b) => slideNumber(a) - slideNumber(b))
    : []);
  const authoring = files.filter((f) => !f.includes(`${path.sep}rendered${path.sep}`));
  const { found, missing } = authoredFiles(authoring, workspace, buildDir);
  return {
    workspace,
    buildDir,
    scene,
    delivery: buildDir && existsSync(path.join(buildDir, "delivery.json")) ? path.join(buildDir, "delivery.json") : null,
    plan: found.plan ?? null,
    pages: found.pages ?? null,
    deck: found.deck ?? null,
    // The author's run log sits beside the plan under the same stem (author-deck.mjs); null when the run kept none.
    authorLog: [found.plan && found.plan.replace(/\.plan\.json$/, ".author-log.jsonl")].find((f) => f && existsSync(f)) ?? null,
    missing,
    slides: inRendered(/^slide-\d+\.png$/),
    sheets: inRendered(/^spread-\d+\.png$/),
  };
}

/**
 * Keep a run: the authoring files and the scene (gzipped), the delivery record
 * and the rendered pages, and why any authoring file is missing. Kept under the
 * store so a later version of the skill can be judged against this one, deck
 * against deck.
 */
export function storeArtifacts(artifacts, dir) {
  mkdirSync(path.join(dir, "rendered"), { recursive: true });
  const kept = {};
  for (const role of ["plan", "pages", "deck", "delivery"]) {
    if (!artifacts[role]) continue;
    copyFileSync(artifacts[role], path.join(dir, `${role}.json`));
    kept[role] = `${role}.json`;
  }
  if (Object.keys(artifacts.missing ?? {}).length) kept.missing = artifacts.missing;
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

/**
 * The treatment a row ran under when it does not say: config.json's default
 * agent and prompt. Rows written before the treatment joined the key carry it
 * beside the key (`row.agent`, `row.prompt`), or - written by hand - not at all.
 */
export const DEFAULT_TREATMENT = Object.freeze({ agent: "claude", prompt: "brief" });

// What one measurement is: the version under test, the judge that scored it,
// the treatment - the agent and the prompt it was given - and the brief. Runs
// 1..n of a measurement share all five; rows that differ in any one are
// numbered, keyed, kept and reported apart, and never pooled.
const IDENTITY = Object.freeze(["skillSha", "judge", "agent", "prompt", "brief"]);
const TREATMENT = Object.freeze(["agent", "prompt"]);

/** A row's identity (IDENTITY), a missing treatment read as DEFAULT_TREATMENT. */
export function identityOf(row) {
  const key = row?.key ?? {};
  return { skillSha: key.skillSha, judge: key.judge, agent: key.agent ?? row?.agent ?? DEFAULT_TREATMENT.agent,
           prompt: key.prompt ?? row?.prompt ?? DEFAULT_TREATMENT.prompt, brief: key.brief };
}

/** Rows of the measurement `want` names, compared on `fields` (all of IDENTITY by default). */
function sameAs(want, fields = IDENTITY) {
  const target = identityOf({ key: want });
  return (row) => {
    const id = identityOf(row);
    return fields.every((f) => id[f] === target[f]);
  };
}

export function keyOf(row) {
  const id = identityOf(row);
  return [...IDENTITY.map((f) => id[f]), row.key.run].join(" | ");
}

/** Where a run's deck is kept under the store: one directory per key. */
export function keptDir(store, key) {
  const { skillSha, judge, agent, prompt, brief } = identityOf({ key });
  const safe = (text) => String(text).replace(/[^A-Za-z0-9._-]+/g, "_");
  return path.join(store, safe(skillSha), safe(brief), `${safe(agent)}-${safe(prompt)}-${safe(judge)}-run${key.run}`);
}

/**
 * Make the directory a run is kept in, its own: keptDir's, or - where one of
 * that name is already there, a killed run's whose row never landed or a run
 * recorded in another results file sharing the store - the first free `.2`,
 * `.3` beside it. Each is created exclusively, so no two runs write their
 * decks into one directory and no run's files are mixed into another's.
 */
export function makeKeptDir(store, key) {
  const base = keptDir(store, key);
  mkdirSync(path.dirname(base), { recursive: true });
  for (let n = 1; ; n += 1) {
    const dir = n === 1 ? base : `${base}.${n}`;
    try { mkdirSync(dir); return dir; } catch (error) { if (error.code !== "EEXIST") throw error; }
  }
}

export function readResults(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
}

/** Is this row's key already recorded among `rows`? */
export const isRecorded = (rows, row) => rows.some((r) => keyOf(r) === keyOf(row));

/**
 * Append one row; a row whose key is already recorded is refused rather than
 * doubled. Unless told otherwise the file is read at the moment of writing.
 * Reading then writing cannot keep two runners off one key - both can read
 * before either writes - so the runner claims the key first (claimRun) and
 * this check is the backstop for a writer that did not.
 */
export function appendResult(file, row, existing = readResults(file)) {
  if (isRecorded(existing, row)) throw new Error(`already recorded: ${keyOf(row)}`);
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(row) + "\n");
  return row;
}

/** Where the runs under way on a results file hold their keys: beside it. */
export const claimsDir = (file) => `${file}.claims`;

/**
 * Claim a run's key on the results `file` before its agent and judge are paid
 * for. The claim is a file created exclusively under claimsDir, which only one
 * runner's create can do, and the results are read after it rather than
 * before: a runner that recorded the key let go of its claim only once its row
 * was appended, so the key is now held, recorded, or this runner's.
 *
 * Returns `{held: true, release}` - release once the row is appended, or the
 * run has failed - or `{held: false, why}` when another runner holds the key
 * or has recorded it. A runner killed mid-run cannot let go: its claim stays,
 * naming the process and the host, and later runs number past it.
 */
export function claimRun(file, key) {
  const dir = claimsDir(file);
  mkdirSync(dir, { recursive: true });
  const claim = path.join(dir, `${createHash("sha256").update(keyOf({ key })).digest("hex").slice(0, 32)}.json`);
  let fd;
  try {
    fd = openSync(claim, "wx");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const holder = readQuiet(claim);
    return { held: false, why: `${holder ? `claimed by process ${holder.pid} on ${holder.host} since ${holder.since}` : "claimed by another runner"} (${claim})` };
  }
  const release = () => rmSync(claim, { force: true });
  try {
    try { writeSync(fd, JSON.stringify({ key, pid: process.pid, host: os.hostname(), since: new Date().toISOString() }) + "\n"); } finally { closeSync(fd); }
    if (isRecorded(readResults(file), { key })) { release(); return { held: false, why: "already recorded" }; }
  } catch (error) {
    release();
    throw error;
  }
  return { held: true, release };
}

/** The next run of a measurement (IDENTITY), so new runs continue its count. */
export function nextRun(rows, identity) {
  const runs = rows.filter(sameAs(identity)).map((r) => r.key.run);
  return runs.length ? Math.max(...runs) + 1 : 1;
}

/**
 * The deck a new version is compared with: the most recently recorded judged
 * deck of the same brief and treatment from a different skill version, whose
 * stored pages still exist under `store` (rows record the kept deck relative
 * to the store, so results.jsonl carries no machine path). The judge that
 * scored it does not matter: the pair is judged afresh.
 */
export function previousDeck(rows, identity, store) {
  const candidates = rows.filter((r) => sameAs(identity, ["brief", ...TREATMENT])(r) && r.key.skillSha !== identity.skillSha && r.deck?.artifacts);
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

/** The treatments recorded for one skill version and judge, each one a report of its own. */
export function treatmentsOf(rows, { skillSha, judge }) {
  const seen = new Map();
  for (const row of rows.filter(sameAs({ skillSha, judge }, ["skillSha", "judge"]))) {
    const { agent, prompt } = identityOf(row);
    seen.set(`${agent}\n${prompt}`, { agent, prompt });
  }
  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, treatment]) => treatment);
}

/**
 * Mean and spread of the judge's rating per brief for one skill version, judge
 * and treatment (DEFAULT_TREATMENT when none is named), with the build and
 * plan verdicts and the pairwise record beside it. Another treatment's rows
 * are another measurement and never pooled in.
 */
export function summarize(rows, identity) {
  const { skillSha, judge, agent, prompt } = identityOf({ key: identity });
  const mine = rows.filter(sameAs(identity, ["skillSha", "judge", ...TREATMENT]));
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
  return { skillSha, judge, agent, prompt, briefs: perBrief, pairwise: winRate(mine.map((r) => r.pairwise)) };
}

export function formatSummary(summary) {
  const lines = [`skill ${summary.skillSha} · judge ${summary.judge} · agent ${summary.agent} · prompt ${summary.prompt}`];
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

