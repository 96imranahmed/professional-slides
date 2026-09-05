#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const bundledRoot = path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies");
const firstExisting = candidates => candidates.find(candidate => candidate && fs.existsSync(candidate));
const runtimePython = firstExisting([
  process.env.RUNTIME_PYTHON,
  path.join(bundledRoot, "python", "bin", "python3")
]) || "python3";
const runtimeNode = firstExisting([
  process.env.RUNTIME_NODE,
  path.join(bundledRoot, "node", "bin", "node")
]) || process.execPath;
const runtimeNodeModules = firstExisting([
  process.env.RUNTIME_NODE_MODULES,
  path.join(bundledRoot, "node", "node_modules"),
  path.join(path.dirname(path.dirname(runtimeNode)), "node_modules"),
  path.join(path.dirname(path.dirname(runtimeNode)), "lib", "node_modules")
]);

if (!runtimeNodeModules) throw new Error("Unable to locate the bundled Node module directory; set RUNTIME_NODE_MODULES");
if (!fs.existsSync(path.join(runtimeNodeModules, "@napi-rs", "canvas"))) throw new Error(`Required test dependency @napi-rs/canvas is unavailable under ${runtimeNodeModules}`);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, RUNTIME_NODE: runtimeNode, RUNTIME_NODE_MODULES: runtimeNodeModules, RUNTIME_PYTHON: runtimePython },
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

if (process.argv.includes("--release")) {
  await run(runtimePython, ["evals/run_evals.py", "--check"]);
  await run(runtimeNode, ["evals/scripts/generate_golden_set.mjs", "--check"]);
} else if (process.argv.includes("--dependencies")) {
  await run(runtimeNode, ["evals/scripts/runtime_lock.mjs"]);
} else {
  await run(runtimePython, ["-m", "unittest", "discover", "-s", "evals/tests", "-p", "test_*.py"]);
}
