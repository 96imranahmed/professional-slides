#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
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

// The eval suite runs most of its geometry through `run_node`, which takes an ES
// module as a Python string: 337 call sites, none of them seen by a JavaScript
// parser until the test ran. A typo in one surfaced as a test failure whose
// traceback pointed at the Python `run_node(...)` line rather than at the line
// of JavaScript that was wrong. These are the probes the suite would run,
// checked the way the runtime's own modules are.
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

console.log(JSON.stringify({ accepted: true, javascriptFiles: files.filter(file => /\.(?:mjs|js)$/.test(file)).length, embeddedProbes: probes, pythonRoot: "evals" }));
