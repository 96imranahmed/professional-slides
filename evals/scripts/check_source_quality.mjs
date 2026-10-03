#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { pythonBin } from "../../skills/professional-slides/runtime/cli.mjs";
import { deadExports } from "./dead_exports.mjs";

const root = process.cwd();
const runtimeNode = process.env.RUNTIME_NODE || process.execPath, runtimePython = pythonBin();
const sourceRoots = ["skills/professional-slides/runtime", "evals/scripts", "evals/quality", "evals/cold-run", "evals/calibration"];
// Generated or cached, never authored: the quality eval's kept runs and bytecode.
const SKIPPED_DIRECTORIES = new Set(["runs", "__pycache__", "node_modules"]);

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { if (!SKIPPED_DIRECTORIES.has(entry.name)) files.push(...await walk(relative)); }
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

/** Run quietly: the exit code and what the command wrote to stderr. */
function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stderr }));
  });
}

/** Run `task` over `items`, `limit` at a time. */
async function inPool(items, limit, task) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await task(queue.shift());
  }));
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

// Every runtime module imports on its own, in a fresh process. An import cycle
// whose modules read each other's bindings while they load ("Cannot access 'X'
// before initialization") fails only when the cycle is entered from one side,
// and the order in which the suite and the CLIs happen to import can hide that
// side; a module imported first and alone cannot.
const runtimeModules = files.filter(file => file.startsWith(`${sourceRoots[0]}/`) && file.endsWith(".mjs"));
const isolatedImportErrors = [];
await inPool(runtimeModules, os.availableParallelism?.() ?? os.cpus().length, async (file) => {
  const url = pathToFileURL(path.join(root, file)).href;
  const { code, stderr } = await capture(runtimeNode, ["--input-type=module", "-e", `await import(${JSON.stringify(url)});`]);
  if (code === 0) return;
  const lines = stderr.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  isolatedImportErrors.push(`${file}: ${lines.find(line => /^[A-Za-z]*Error\b/.test(line)) ?? lines.at(-1) ?? `exited ${code}`}`);
});
if (isolatedImportErrors.length) {
  throw new Error(`Runtime modules that do not import on their own (an import cycle read before its module ran):\n${isolatedImportErrors.sort().join("\n")}`);
}

// An export nothing imports and its own module never uses is code nothing
// runs (evals/scripts/dead_exports.mjs). One kept for callers outside the
// repository is named, with its reason, in that script's PUBLIC_API.
const dead = deadExports(root);
if (dead.length) throw new Error(`Dead exports (remove them, or name them in dead_exports.mjs PUBLIC_API with the reason):\n${dead.map((d) => `${d.file}: ${d.name}`).join("\n")}`);

// The eval suite runs most of its geometry through `run_node`, which takes an ES
// module as a Python string that no JavaScript parser sees until the test runs,
// and a typo in one fails with a traceback at the Python `run_node(...)` line
// rather than at the line of JavaScript that is wrong. These are the probes the
// suite would run, checked the way the runtime's own modules are.
//
// Only the blobs a parser can read: an f-string probe is a template that
// interpolates Python, and half a template is not JavaScript.
const QUOTES = ["'''", '"""'];
const probeErrors = [];
let probes = 0;
// The probes live in the tests, which are not a `sourceRoot` for the whitespace
// and compile checks above.
const probeFiles = (await walk("evals/tests")).filter(name => name.endsWith(".py"));
for (const file of probeFiles) {
  const source = await fs.readFile(path.join(root, file), "utf8");
  for (const quote of QUOTES) {
    let at = 0;
    for (;;) {
      const call = source.indexOf("run_node(", at);
      if (call < 0) break;
      at = call + 9;
      const prefix = source.slice(call - 2, call + 9 + 4);
      // `run_node(f'''` and `run_node(rf'''` interpolate; skip them.
      if (/run_node\(\s*r?f/.test(prefix)) continue;
      const open = source.indexOf(quote, at);
      if (open < 0 || open > at + 4) continue;
      const close = source.indexOf(quote, open + quote.length);
      if (close < 0) continue;
      const body = source.slice(open + quote.length, close);
      at = close + quote.length;
      if (!/\bimport\b|\bconst\b|\bassert\b/.test(body)) continue;
      probes += 1;
      const line = source.slice(0, open).split("\n").length;
      const scratch = path.join(os.tmpdir(), `ps-probe-${process.pid}-${probes}.mjs`);
      await fs.writeFile(scratch, body, "utf8");
      try {
        await run(runtimeNode, ["--check", scratch]);
      } catch {
        probeErrors.push(`${file}:${line}`);
      } finally {
        await fs.rm(scratch, { force: true });
      }
    }
  }
}
if (probeErrors.length) {
  throw new Error(`Embedded run_node probes do not parse as JavaScript:\n${probeErrors.join("\n")}`);
}

console.log(JSON.stringify({ accepted: true, javascriptFiles: files.filter(file => /\.(?:mjs|js)$/.test(file)).length, isolatedImports: runtimeModules.length, embeddedProbes: probes, deadExports: 0, pythonRoot: "evals" }));
