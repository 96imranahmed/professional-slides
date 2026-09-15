#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const runtimeNode = process.env.RUNTIME_NODE || process.execPath, runtimePython = process.env.RUNTIME_PYTHON || "python3";
const sourceRoots = ["skills/professional-slides/runtime", "evals/scripts"];

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walk(relative));
    else files.push(relative);
  }
  return files;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

const files = (await Promise.all(sourceRoots.map(walk))).flat();
const textual = files.filter(file => /\.(?:mjs|js|py|md|json)$/.test(file) && !file.endsWith("natural-earth-map-data.mjs"));
const whitespaceErrors = [];
for (const file of textual) {
  const lines = (await fs.readFile(path.join(root, file), "utf8")).split(/\r?\n/);
  lines.forEach((line, index) => { if (/\s+$/.test(line)) whitespaceErrors.push(`${file}:${index + 1}`); });
}
if (whitespaceErrors.length) throw new Error(`Trailing whitespace:\n${whitespaceErrors.join("\n")}`);
for (const file of files.filter(file => /\.(?:mjs|js)$/.test(file))) await run(runtimeNode, ["--check", file]);
await run(runtimePython, ["-m", "compileall", "-q", "evals", "skills/professional-slides/runtime"]);
console.log(JSON.stringify({ accepted: true, javascriptFiles: files.filter(file => /\.(?:mjs|js)$/.test(file)).length, pythonRoot: "evals" }));
