#!/usr/bin/env node
import fs from "node:fs";
import {configureRuntime} from "../../skills/professional-slides/runtime/environment.mjs";
import path from "node:path";
import { spawn } from "node:child_process";

const {RUNTIME_PYTHON:runtimePython,RUNTIME_NODE:runtimeNode,RUNTIME_NODE_MODULES:runtimeNodeModules}=configureRuntime();
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
  await run(runtimeNode, ["evals/scripts/generate_golden_set.mjs", "--check"]);
} else if (process.argv.includes("--dependencies")) {
  await run(runtimeNode, ["evals/scripts/runtime_lock.mjs"]);
} else {
  await run(runtimePython, ["-m", "unittest", "discover", "-s", "evals/tests", "-p", "test_*.py"]);
}
