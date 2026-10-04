// What authoring a deck cost, counted from the log author-deck.mjs keeps.
//
// Every author-deck run that compiles or plans the deck appends one line to
// `<id>.author-log.jsonl` beside the pages file: its number, its mode (draft,
// check, full, page for a run on named pages, or plan), whether it rendered,
// whether it was refused, and each blocking finding's code, page and message.
// That is all the log holds, and the count says so (`counted`): the catalogue
// commands, the analysis, the storyline critique, the build and delivery are
// other commands, and a session's whole command count is larger than this. The cost of a
// deck is agent round trips - each one a whole-deck compile to learn about one
// page - and it was only ever visible when an author kept a log by hand. Read
// from this file it is a number a run is scored on (evals/cold-run/score.mjs):
// nothing here is estimated, and a run with no log has no cost recorded.
import { readFileSync } from "node:fs";

// Entries of this version tell a check from a full compile and record the page count; earlier ones logged a check as "full".
export const RUN_LOG_VERSION = 2;
// The mode a `--plan` run is logged under.
export const PLAN_MODE = "plan";
// What the log counts, said with every count read from it.
const COUNTED = "author-deck.mjs runs that compile the deck (`runs`: draft, check, full and page runs) and that plan it (`plans`). Not counted: the catalogue commands (--types, --schema, --limits, --icons, --example, --scaffold, --log), analysis.mjs, storyline.mjs, build-deck.mjs and deliver-deck.mjs - none of them is logged here";

/** The runs logged in an author log (`<id>.author-log.jsonl`), in order; none when the file is not there. A line that is not a run is left out. */
export function readRunLog(file) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  return text.split("\n").filter((line) => line.trim()).flatMap((line) => { try { const run = JSON.parse(line); return run && typeof run.ok === "boolean" ? [run] : []; } catch { return []; } });
}

/**
 * What the author runs logged beside a pages file cost, counted from the log
 * and nothing else, with what the log counts (`counted`): the compile runs
 * and how many were refused, by mode; the plan runs beside them (`plans`); the
 * refusals by code and by page (findings, and the runs they came back in);
 * the longest unbroken streak of refused runs on one page - a page fixed one
 * finding at a time; and the findings that recurred.
 */
export function runCost(runs) {
  const logged = (Array.isArray(runs) ? runs : []).filter((run) => run && typeof run.ok === "boolean");
  // A plan is a refusable run of the same tool, counted beside the compile runs; the tallies below are of the compiles.
  const plans = logged.filter((run) => run.mode === PLAN_MODE), list = logged.filter((run) => run.mode !== PLAN_MODE);
  const findingsOf = (run) => (Array.isArray(run.findings) ? run.findings : []);
  const refused = list.filter((run) => !run.ok);
  const tally = (keyOf) => {
    const counts = new Map();
    for (const run of refused) {
      const keys = findingsOf(run).map(keyOf).filter((key) => key !== undefined && key !== null);
      for (const key of keys) { const c = counts.get(key) ?? { findings: 0, runs: 0 }; c.findings += 1; counts.set(key, c); }
      for (const key of new Set(keys)) counts.get(key).runs += 1;
    }
    return Object.fromEntries([...counts].sort((a, b) => b[1].runs - a[1].runs || b[1].findings - a[1].findings));
  };
  const modes = {};
  for (const run of list) { const m = modes[run.mode ?? "unrecorded"] ??= { runs: 0, refused: 0 }; m.runs += 1; if (!run.ok) m.refused += 1; }
  // A page's streak: consecutive runs of the log, each refused with a finding on that page.
  let longest = null;
  const open = new Map();
  for (const [i, run] of list.entries()) {
    const ids = new Map();
    if (!run.ok) for (const f of findingsOf(run)) if (f.id) ids.set(String(f.id), [...(ids.get(String(f.id)) || []), f.code]);
    for (const id of [...open.keys()]) if (!ids.has(id)) open.delete(id);
    for (const [id, codes] of ids) {
      const streak = open.get(id) ?? { page: id, runs: 0, fromRun: run.run ?? i + 1, toRun: null, codes: [] };
      streak.runs += 1; streak.toRun = run.run ?? i + 1; streak.codes.push(...codes);
      open.set(id, streak);
      if (!longest || streak.runs > longest.runs) longest = { ...streak, codes: [...new Set(streak.codes)] };
    }
  }
  const seen = new Map();
  for (const run of list) for (const f of findingsOf(run)) { const key = `${f.code}${f.id ? ` [${f.id}]` : ""}`; seen.set(key, (seen.get(key) || 0) + 1); }
  const pages = [...list].reverse().find((run) => Number.isInteger(run.pages))?.pages ?? null;
  const unversioned = list.filter((run) => run.v === undefined).length;
  return { counted: COUNTED, runs: list.length, clean: list.length - refused.length, refused: refused.length, modes,
    plans: { runs: plans.length, refused: plans.filter((run) => !run.ok).length, ...(plans.some((run) => !run.ok) ? { refusedFor: [...new Set(plans.filter((run) => !run.ok).flatMap((run) => findingsOf(run).map((f) => f.code)))] } : {}) },
    ...(pages ? { pages, runsPerPage: Math.round(100 * list.length / pages) / 100 } : {}),
    refusalsByCode: tally((f) => f.code), refusalsByPage: tally((f) => (f.id ? String(f.id) : null)),
    longestStreak: longest,
    recurring: Object.fromEntries([...seen].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])),
    ...(unversioned ? { note: `${unversioned} run${unversioned === 1 ? " was" : "s were"} logged before a check was told apart from a full compile and before the page count was recorded: ${unversioned === 1 ? "it is" : "they are"} counted under the mode the log gives` } : {}) };
}
