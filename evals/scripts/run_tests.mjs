#!/usr/bin/env node
/**
 * Eval suite entry point.
 *
 *   node evals/scripts/run_tests.mjs                unit tests
 *
 * `evals/run.sh` is the fuller version: it also prints the content-stage and
 * cold-run numbers for the example decks. Both work without a native canvas -
 * text is measured from the portable font-metric tables and pages are measured
 * from PNGs with Pillow.
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Prefer an explicitly configured runtime, fall back to what is on PATH. */
async function resolveRuntime() {
  const fallback = {
    RUNTIME_NODE: process.execPath,
    RUNTIME_PYTHON: process.env.RUNTIME_PYTHON || "python3",
    RUNTIME_NODE_MODULES: process.env.RUNTIME_NODE_MODULES || path.join(repo, "node_modules")
  };
  return fallback;
}

const runtime = await resolveRuntime();

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repo,
      env: { ...process.env, ...runtime },
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", code => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

const args = process.argv.slice(2);
if (args.length) throw new Error("Usage: run_tests.mjs");
await run(runtime.RUNTIME_PYTHON, ["-m", "unittest", "discover", "-s", "evals/tests", "-p", "test_*.py"]);
