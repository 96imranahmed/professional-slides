#!/usr/bin/env node
/**
 * Eval suite entry point.
 *
 *   node evals/scripts/run_tests.mjs [--jobs N] [--serial] [--strict] [--slow] [--pattern GLOB] [--verbose]
 *
 *   --jobs N       worker processes (default: CPUs, at most 8)
 *   --serial       one worker process: the fallback when parallel runs misbehave
 *   --strict       fail when any test was skipped for a missing dependency
 *   --slow         also run the opt-in LibreOffice end-to-end tests (PS_RUN_SLOW=1)
 *   --pattern GLOB test modules to run (default test_*.py)
 *   --verbose      print each module as it finishes, and the workers' output
 *
 * Before anything runs, the dependency preflight looks for a Python that has
 * everything in requirements.txt - RUNTIME_PYTHON, python3, /usr/bin/python3,
 * /opt/homebrew/bin/python3, /usr/local/bin/python3 - and runs the suite under
 * it. A suite run under an interpreter without python-pptx skips the export
 * tests and still says OK, so the preflight says which interpreter it chose
 * and why, and the end of the run lists every skip.
 *
 * Test classes are shared out across worker processes (evals/scripts/
 * unittest_worker.py), longest first by the last run's timings: a class is the
 * unit because one slow module would otherwise set the wall time for the whole
 * run. Each worker keeps its own warm Node probe worker, so no two processes
 * share one.
 *
 * `evals/run.sh` is the fuller version: it also prints the example decks'
 * content-stage numbers and runs the source checks.
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { isMain, parseCli, runCli } from "../../skills/professional-slides/runtime/cli.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TESTS = path.join(repo, "evals", "tests");
const WORKER = path.join(repo, "evals", "scripts", "unittest_worker.py");
const TIMINGS = path.join(os.tmpdir(), "professional-slides-test-timings.json");
const USAGE = "Usage: run_tests.mjs [--jobs N] [--serial] [--strict] [--slow] [--pattern GLOB] [--verbose]";
// Import names for the requirements whose package name differs.
const IMPORT_NAMES = { "python-pptx": "pptx", pillow: "PIL" };
// A skip whose reason starts with this is a test the user has to ask for
// (--slow), not a dependency the machine lacks; --strict does not count it.
const OPT_IN = "opt-in";

function usage(message) {
  if (message) console.error(message);
  console.error(USAGE);
  process.exit(2);
}

export function parseArgs(argv) {
  let parsed;
  try {
    parsed = parseCli(argv, { jobs: { type: "string" }, serial: { type: "boolean" }, strict: { type: "boolean" }, slow: { type: "boolean" },
      pattern: { type: "string", valueName: "a glob" }, verbose: { type: "boolean" } }, { strict: true });
  } catch (error) { usage(error.message); }
  const { values, positionals } = parsed;
  if (positionals.length) usage(`Unknown argument: ${positionals[0]}`);
  const options = { jobs: null, serial: Boolean(values.serial), strict: Boolean(values.strict), slow: Boolean(values.slow), pattern: values.pattern ?? "test_*.py", verbose: Boolean(values.verbose) };
  if (values.jobs !== undefined) {
    options.jobs = Number(values.jobs);
    if (!Number.isInteger(options.jobs) || options.jobs < 1) usage("--jobs must be a positive whole number");
  }
  if (options.serial) options.jobs = 1;
  return options;
}

/** The import names requirements.txt asks for. */
export function requiredModules(file = path.join(repo, "requirements.txt")) {
  return readFileSync(file, "utf8").split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean)
    .map((line) => line.split(/[<>=!~;\s[]/)[0].toLowerCase())
    .map((name) => IMPORT_NAMES[name] ?? name.replace(/-/g, "_"));
}

/**
 * The first interpreter that imports every requirement, else the one missing
 * least. Candidates are deduplicated by the file they resolve to.
 */
export function preflight(modules = requiredModules(), env = process.env) {
  const candidates = [env.RUNTIME_PYTHON, "python3", "/usr/bin/python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3"].filter(Boolean);
  const probe = `import importlib.util, json, sys\nprint(json.dumps({"exe": sys.executable, "version": sys.version.split()[0], "missing": [m for m in ${JSON.stringify(modules)} if importlib.util.find_spec(m) is None]}))`;
  const seen = new Set();
  const checked = [];
  for (const candidate of candidates) {
    const out = spawnSync(candidate, ["-c", probe], { encoding: "utf8", env });
    if (out.status !== 0) continue;
    let report;
    try { report = JSON.parse(out.stdout); } catch { continue; }
    let real = report.exe;
    try { real = realpathSync(report.exe); } catch { /* keep the reported path */ }
    if (seen.has(real)) continue;
    seen.add(real);
    checked.push({ command: candidate, ...report });
    if (!report.missing.length) break;
  }
  if (!checked.length) return { chosen: null, checked };
  const chosen = checked.find((c) => !c.missing.length) ?? [...checked].sort((a, b) => a.missing.length - b.missing.length)[0];
  return { chosen, checked };
}

function modulesMatching(pattern) {
  const regex = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  return readdirSync(TESTS).filter((f) => regex.test(f) && f.endsWith(".py")).map((f) => f.replace(/\.py$/, "")).sort();
}

function readTimings() {
  try { return JSON.parse(readFileSync(TIMINGS, "utf8")); } catch { return {}; }
}

const CLASS = /^class (\w+)\(([^)]*)\):/gm;

/**
 * The test classes each module of the tests folder declares, by module. A
 * class is a test class when it names TestCase among its bases, or a class
 * that is one - declared in its own module or in another, since a module
 * imports a shared fixture class by its bare name (`class StaleTextTests(
 * CarriedDeck)`). Read from the source, so nothing is imported to schedule
 * it. A class matched on TestCase alone left every such subclass unscheduled:
 * its tests passed under `python -m unittest` and never ran here.
 */
function testClasses() {
  const declared = readdirSync(TESTS).filter((file) => file.endsWith(".py")).flatMap((file) => [...readFileSync(path.join(TESTS, file), "utf8").matchAll(CLASS)]
    .map((match) => ({ module: file.replace(/\.py$/, ""), name: match[1], bases: match[2].match(/\w+/g) ?? [] })));
  const known = new Set(["TestCase"]);
  for (let grew = true; grew;) {
    grew = false;
    for (const item of declared) if (!known.has(item.name) && item.bases.some((base) => known.has(base))) { known.add(item.name); grew = true; }
  }
  const byModule = new Map();
  for (const item of declared) if (known.has(item.name) && item.bases.some((base) => known.has(base))) byModule.set(item.module, [...(byModule.get(item.module) ?? []), item.name]);
  return byModule;
}

/** The units a run is split into: every test class, or the module when it declares none. */
export function units(modules) {
  const classes = testClasses();
  return modules.flatMap((name) => ((classes.get(name) ?? []).length ? classes.get(name).map((cls) => `${name}.${cls}`) : [name]));
}

/** Longest first: last run's time where known, a share of the file's size (a fair proxy) where not. */
export function schedule(unitNames, timings = {}) {
  const perModule = {};
  for (const unit of unitNames) perModule[unit.split(".")[0]] = (perModule[unit.split(".")[0]] ?? 0) + 1;
  const guess = (unit) => {
    const module = unit.split(".")[0];
    return statSync(path.join(TESTS, `${module}.py`)).size / 20000 / perModule[module];
  };
  const cost = (unit) => timings[unit] ?? guess(unit);
  return [...unitNames].sort((a, b) => cost(b) - cost(a) || a.localeCompare(b));
}

function runParallel(modules, { jobs, env, verbose }) {
  return new Promise((resolve) => {
    const queue = [...modules];
    const results = [];
    let live = 0;
    const start = () => {
      if (!queue.length) return;
      live += 1;
      const child = spawn(env.RUNTIME_PYTHON, [WORKER], { cwd: repo, env, stdio: ["pipe", "pipe", "pipe", "pipe"] });
      let current = null;
      let output = "";
      const keep = (chunk) => { output = (output + chunk).slice(-20000); if (verbose) process.stderr.write(chunk); };
      child.stdout.on("data", keep);
      child.stderr.on("data", keep);
      const next = () => {
        current = queue.shift() ?? null;
        if (current) child.stdin.write(`${current}\n`);
        else child.stdin.end();
      };
      readline.createInterface({ input: child.stdio[3] }).on("line", (line) => {
        let result;
        try { result = JSON.parse(line); } catch { return; }
        results.push(result);
        if (verbose) console.error(`  ${result.module} ${result.testsRun} tests ${result.seconds}s`);
        next();
      });
      child.on("close", (code, signal) => {
        live -= 1;
        if (current) {
          // The worker died inside a module: that module errors, the rest go on.
          results.push({ module: current, testsRun: 0, failures: [], skipped: [], expectedFailures: 0, unexpectedSuccesses: [], seconds: 0,
                         errors: [{ id: current, traceback: `worker exited ${code ?? signal} while running ${current}\n${output.slice(-4000)}` }] });
          current = null;
          start();
        }
        if (!live && !queue.length) resolve(results);
      });
      next();
    };
    const workers = Math.max(1, Math.min(jobs, modules.length));
    for (let i = 0; i < workers; i += 1) start();
    if (!modules.length) resolve(results);
  });
}

function rule(char) { return char.repeat(70); }

export function report(results, { seconds, jobs, modules, python, strict }) {
  const lines = [];
  const failures = results.flatMap((r) => r.failures.map((f) => ({ kind: "FAIL", ...f })));
  const errors = results.flatMap((r) => r.errors.map((f) => ({ kind: "ERROR", ...f })));
  const unexpected = results.flatMap((r) => r.unexpectedSuccesses);
  const skipped = results.flatMap((r) => r.skipped);
  const optIn = skipped.filter((s) => s.reason.startsWith(OPT_IN));
  const missing = skipped.filter((s) => !s.reason.startsWith(OPT_IN));
  for (const item of [...errors, ...failures]) {
    lines.push(rule("="), `${item.kind}: ${item.id}`, rule("-"), item.traceback.trimEnd());
  }
  const tests = results.reduce((n, r) => n + r.testsRun, 0);
  lines.push(rule("-"), `Ran ${tests} tests from ${modules ?? results.length} modules in ${seconds.toFixed(1)}s across ${jobs} process${jobs === 1 ? "" : "es"} (${python})`, "");
  if (missing.length) {
    const byReason = {};
    for (const s of missing) (byReason[s.reason] ??= []).push(s.id);
    lines.push(rule("!"), `!!! ${missing.length} test${missing.length === 1 ? " was" : "s were"} SKIPPED: this run did not check everything`);
    for (const [reason, ids] of Object.entries(byReason)) {
      lines.push(`  ${reason} (${ids.length})`);
      for (const id of ids.slice(0, 8)) lines.push(`      ${id}`);
      if (ids.length > 8) lines.push(`      ... and ${ids.length - 8} more`);
    }
    lines.push(strict ? "  --strict: skips fail the run." : "  Install what they need (see requirements.txt and evals/README.md), or run with --strict to fail on skips.", rule("!"), "");
  }
  if (optIn.length) lines.push(`${optIn.length} opt-in test${optIn.length === 1 ? "" : "s"} not run (--slow runs them).`, "");
  const bad = failures.length + errors.length + unexpected.length;
  const counts = [failures.length && `failures=${failures.length}`, errors.length && `errors=${errors.length}`,
    unexpected.length && `unexpected successes=${unexpected.length}`, skipped.length && `skipped=${skipped.length}`].filter(Boolean).join(", ");
  const failed = bad > 0 || (strict && missing.length > 0);
  lines.push(`${failed ? "FAILED" : "OK"}${counts ? ` (${counts})` : ""}`);
  return { text: lines.join("\n"), failed };
}

async function main(argv) {
  const options = parseArgs(argv);
  const found = preflight();
  if (!found.chosen) {
    console.error("No Python 3 interpreter found. Install python3 and the packages in requirements.txt.");
    return 1;
  }
  const { chosen, checked } = found;
  if (chosen.missing.length) {
    console.error(rule("!"));
    console.error(`!!! No interpreter has every requirement. Using ${chosen.command} (${chosen.version}), which lacks ${chosen.missing.join(", ")}:`);
    console.error("!!! the tests that need them will SKIP.  python3 -m pip install -r requirements.txt");
    for (const c of checked) console.error(`      ${c.command} -> ${c.exe}: missing ${c.missing.join(", ") || "nothing"}`);
    console.error(rule("!"));
  } else if (process.env.RUNTIME_PYTHON && chosen.command !== process.env.RUNTIME_PYTHON) {
    const first = checked.find((c) => c.command === process.env.RUNTIME_PYTHON);
    console.error(`RUNTIME_PYTHON=${process.env.RUNTIME_PYTHON} ${first ? `lacks ${first.missing.join(", ")}` : "does not run"}; using ${chosen.exe}, which has every requirement.`);
  } else if (options.verbose) {
    console.error(`python: ${chosen.exe} (${chosen.version})`);
  }
  const modules = modulesMatching(options.pattern);
  if (!modules.length) usage(`No test module matches ${options.pattern}`);
  const jobs = options.jobs ?? Math.min(os.availableParallelism?.() ?? os.cpus().length, 8);
  const env = {
    ...process.env,
    RUNTIME_PYTHON: chosen.exe,
    RUNTIME_NODE: process.env.RUNTIME_NODE || process.execPath,
    RUNTIME_NODE_MODULES: process.env.RUNTIME_NODE_MODULES || path.join(repo, "node_modules"),
    PS_RESULT_FD: "3",
    ...(options.slow ? { PS_RUN_SLOW: "1" } : {}),
  };
  const timings = readTimings();
  const started = Date.now();
  const work = units(modules);
  const results = await runParallel(schedule(work, timings), { jobs, env, verbose: options.verbose });
  const seconds = (Date.now() - started) / 1000;
  for (const r of results) timings[r.module] = r.seconds;
  try { writeFileSync(TIMINGS, JSON.stringify(timings)); } catch { /* timings only order the next run */ }
  const { text, failed } = report(results, { seconds, jobs: Math.min(jobs, work.length), modules: modules.length, python: chosen.exe, strict: options.strict });
  console.log(text);
  return failed ? 1 : 0;
}

if (isMain(import.meta.url)) runCli(main);
