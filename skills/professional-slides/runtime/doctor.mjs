#!/usr/bin/env node
// Step 0: whether this machine can build a deck, checked before any work.
//
//   node runtime/doctor.mjs [--json] [--no-render]
//
// A build needs Node for the layout, one Python interpreter that imports every
// package the emitter and the gates import, LibreOffice (`soffice`) to render,
// and poppler (`pdftoppm`, `pdftotext`) to rasterise and read the rendered
// pages. Each is checked here, before any work, and each missing piece gets an
// install line for this platform. The interpreter the runtime runs is
// RUNTIME_PYTHON, else `python3` on PATH; when a complete one exists elsewhere
// the doctor prints the line that selects it. Exit 0 when ready, 2 when not,
// 1 on a crash. `--no-render` checks for authoring and unrendered builds
// (`build-deck.mjs --no-render`): the three binaries are reported, not required.
// `--json` prints one object: { ready, render, node, python, binaries, optional, install }.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EXIT, UsageError, isMain, parseCli, pythonBin, runCli } from "./cli.mjs";

const runtime = path.dirname(fileURLToPath(import.meta.url));
const REQUIREMENTS = path.resolve(runtime, "..", "..", "..", "requirements.txt");

// Mirrors package.json `engines`.
export const MIN_NODE = Object.freeze([20, 9]);
// Import name -> pip package, as requirements.txt lists them.
export const PYTHON_MODULES = Object.freeze({ pptx: "python-pptx", lxml: "lxml", PIL: "Pillow", numpy: "numpy", pypdf: "pypdf" });
// emit/render_pptx.py's search, in its order: either name on PATH, then these installs.
const SOFFICE_NAMES = ["soffice", "libreoffice"];
const SOFFICE_PATHS = ["/Applications/LibreOffice.app/Contents/MacOS/soffice", "/usr/lib/libreoffice/program/soffice"];
const PROBE = `import json, sys
missing = []
for name in ${JSON.stringify(Object.keys(PYTHON_MODULES))}:
    try:
        __import__(name)
    except Exception:
        missing.append(name)
print(json.dumps({"executable": sys.executable, "version": "%d.%d.%d" % sys.version_info[:3], "missing": missing}))`;

const quote = (value) => /^[\w@%+=:,./\\-]+$/.test(value) ? value : JSON.stringify(value);

/** An executable's absolute path: the path itself when it names a directory, else the first match on PATH; null when absent. */
export function which(name, env = process.env, platform = process.platform) {
  const executable = (file) => { try { fs.accessSync(file, fs.constants.X_OK); return fs.statSync(file).isFile(); } catch { return false; } };
  if (name.includes("/") || (platform === "win32" && name.includes("\\"))) return executable(path.resolve(name)) ? path.resolve(name) : null;
  const extensions = platform === "win32" ? ["", ...(env.PATHEXT || ".EXE;.CMD;.BAT").split(";")] : [""];
  for (const directory of (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean))
    for (const extension of extensions) { const file = path.join(directory, name + extension); if (executable(file)) return file; }
  return null;
}

/** The interpreters to try, in order: RUNTIME_PYTHON, `python3` on PATH, then the usual install locations. */
export function pythonCandidates(env = process.env, platform = process.platform) {
  return [
    ...(env.RUNTIME_PYTHON ? [{ command: env.RUNTIME_PYTHON, source: "RUNTIME_PYTHON" }] : []),
    { command: "python3", source: "PATH" },
    ...(platform === "win32" ? [{ command: "python", source: "PATH" }]
      : ["/usr/bin/python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3"].map((command) => ({ command, source: "install" })))
  ];
}

function run(file, args, env) {
  return new Promise((resolve) => execFile(file, args, { env, timeout: 20000, windowsHide: true },
    (error, stdout, stderr) => resolve({ error, stdout: String(stdout), stderr: String(stderr) })));
}

/** One interpreter: where it is, its version and the modules it cannot import (every one when it does not run). */
async function probePython(candidate, env) {
  const all = Object.keys(PYTHON_MODULES);
  if (!candidate.path) return { ...candidate, ok: false, missing: all, error: "not found" };
  const { error, stdout, stderr } = await run(candidate.path, ["-c", PROBE], env);
  let report = null;
  try { report = JSON.parse(stdout.trim().split(/\r?\n/).pop()); } catch { /* reported below */ }
  if (!Array.isArray(report?.missing)) return { ...candidate, ok: false, missing: all, error: stderr.trim().split(/\r?\n/).pop() || (error?.signal ? `stopped by ${error.signal}` : `exited ${error?.code ?? 0} without a report`) };
  return { ...candidate, version: report.version, executable: report.executable, missing: report.missing, ok: report.missing.length === 0 };
}

async function pythonCheck(candidates, env, platform) {
  const seen = new Set(), listed = [];
  for (const given of candidates) {
    const candidate = typeof given === "string" ? { command: given, source: "given" } : given;
    const found = which(candidate.command, env, platform);
    const real = found ? fs.realpathSync(found) : null;
    if ((real && seen.has(real)) || (!found && candidate.source === "install")) continue;
    if (real) seen.add(real);
    listed.push({ ...candidate, path: found });
  }
  const probed = await Promise.all(listed.map((candidate) => probePython(candidate, env)));
  const chosen = probed.find((c) => c.ok) ?? null;
  const runtimePython = pythonBin(env);
  const byDefault = probed.find((c) => c.command === runtimePython);
  const assign = platform === "win32" ? `$env:RUNTIME_PYTHON = ${JSON.stringify(chosen?.path)}` : `export RUNTIME_PYTHON=${quote(chosen?.path ?? "")}`;
  return { chosen: chosen?.path ?? null, runtimePython, export: chosen && chosen !== byDefault ? assign : null, candidates: probed };
}

function binaryCheck(env, platform) {
  const onPath = SOFFICE_NAMES.map((name) => which(name, env, platform)).find(Boolean);
  const installed = onPath ? null : SOFFICE_PATHS.find((file) => fs.existsSync(file));
  const found = (file) => ({ found: Boolean(file), path: file ?? null });
  return {
    soffice: { ...found(onPath ?? installed), ...(installed ? { note: "not on PATH; the renderer also looks in this install location" } : {}) },
    pdftoppm: found(which("pdftoppm", env, platform)),
    pdftotext: found(which("pdftotext", env, platform))
  };
}

// font-metrics.mjs's lookup: RUNTIME_NODE_MODULES first, else this checkout.
async function canvasCheck(env) {
  try {
    const require = createRequire(import.meta.url);
    const resolved = require.resolve("@napi-rs/canvas", env.RUNTIME_NODE_MODULES ? { paths: [env.RUNTIME_NODE_MODULES] } : undefined);
    await import(pathToFileURL(resolved).href);
    return { found: true, required: false, note: "text is measured with the installed fonts" };
  } catch {
    return { found: false, required: false, note: "optional; text is measured with the bundled metrics" };
  }
}

/** One line per missing piece, for this platform; the RUNTIME_PYTHON line first when a complete interpreter needs selecting. */
export function installLines({ node, python, binaries, platform }) {
  const lines = [];
  const win = platform === "win32", linux = platform === "linux";
  if (python.export) lines.push(python.export);
  if (!node.ok) lines.push(win ? "winget install OpenJS.NodeJS.LTS (or https://nodejs.org)" : linux ? "Node.js 20.9 or later from https://nodejs.org or your distribution's nodejs package" : "brew install node (or https://nodejs.org)");
  if (!python.chosen) {
    const fix = python.candidates.find((c) => c.source === "RUNTIME_PYTHON" && c.path) ?? python.candidates.find((c) => c.path);
    if (!fix) lines.push(win ? "winget install Python.Python.3.12 (or https://www.python.org/downloads/)" : linux ? "sudo apt-get install -y python3 python3-pip" : "brew install python");
    const py = quote(fix?.path ?? (win ? "python" : "python3"));
    const packages = Object.values(PYTHON_MODULES).join(" ");
    lines.push(`${py} -m pip install ${fs.existsSync(REQUIREMENTS) ? `-r ${quote(REQUIREMENTS)}` : packages}`);
    if (!win) lines.push(`if pip refuses an externally managed Python: ${py} -m venv "$HOME/.professional-slides/venv" && "$HOME/.professional-slides/venv/bin/python" -m pip install ${packages} && export RUNTIME_PYTHON="$HOME/.professional-slides/venv/bin/python"`);
  }
  const poppler = !binaries.pdftoppm.found || !binaries.pdftotext.found;
  if (linux && (!binaries.soffice.found || poppler)) lines.push(`sudo apt-get install -y ${[!binaries.soffice.found && "libreoffice-impress", poppler && "poppler-utils"].filter(Boolean).join(" ")}`);
  if (!linux && !binaries.soffice.found) lines.push(win ? "winget install TheDocumentFoundation.LibreOffice, then add C:\\Program Files\\LibreOffice\\program to PATH" : "brew install --cask libreoffice");
  if (!linux && poppler) lines.push(win ? "choco install poppler (or https://github.com/oschwartz10612/poppler-windows/releases, with its Library\\bin on PATH)" : "brew install poppler");
  return lines;
}

/** Everything a build needs, checked; `candidates` and `env` replace the interpreters tried and the environment searched. */
export async function diagnose({ env = process.env, platform = process.platform, candidates, render = true, nodeVersion = process.versions.node } = {}) {
  const [major, minor] = nodeVersion.split(".").map(Number);
  const node = { version: nodeVersion, required: `>=${MIN_NODE.join(".")}`, ok: major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]) };
  const [python, optional] = await Promise.all([pythonCheck(candidates ?? pythonCandidates(env, platform), env, platform), canvasCheck(env).then((canvas) => ({ "@napi-rs/canvas": canvas }))]);
  const binaries = binaryCheck(env, platform);
  const rendered = Object.values(binaries).every((b) => b.found);
  return { ready: node.ok && Boolean(python.chosen) && (rendered || !render), render, platform, node, python, binaries, optional, install: installLines({ node, python, binaries, platform }) };
}

/** The report as lines for a person. */
export function describe(report) {
  const lines = [`Node ${report.node.version} (needs ${report.node.required}): ${report.node.ok ? "ok" : "too old"}`];
  for (const c of report.python.candidates) {
    const where = `${c.path ?? c.command}${c.version ? ` ${c.version}` : ""} [${c.source}]`;
    const state = c.ok ? (c.path === report.python.chosen ? "complete, chosen" : "complete") : c.error && c.missing.length === Object.keys(PYTHON_MODULES).length ? c.error : `missing ${c.missing.map((m) => PYTHON_MODULES[m] ?? m).join(", ")}`;
    lines.push(`Python ${where}: ${state}`);
  }
  if (!report.python.chosen) lines.push(`Python: no interpreter imports ${Object.values(PYTHON_MODULES).join(", ")}`);
  for (const [name, b] of Object.entries(report.binaries)) lines.push(`${name}: ${b.found ? b.path : "not found"}${b.note ? ` (${b.note})` : ""}${!b.found && !report.render ? " (not required with --no-render)" : ""}`);
  for (const [name, o] of Object.entries(report.optional)) lines.push(`${name}: ${o.found ? "installed" : "not installed"} (${o.note})`);
  if (report.python.export) lines.push("", `RUNTIME_PYTHON must name the complete interpreter; run: ${report.python.export}`);
  const todo = report.install.filter((line) => line !== report.python.export);
  if (todo.length) lines.push("", "To install:", ...todo.map((line) => `  ${line}`));
  lines.push("", !report.ready ? "Not ready: install the missing pieces above and run the doctor again."
    : report.render ? "Ready for a full rendered build."
      : "Ready for authoring and unrendered builds only (--no-render); a rendered build also needs soffice, pdftoppm and pdftotext.");
  return lines;
}

if (isMain(import.meta.url)) runCli(async (argv) => {
  const usage = "Usage: doctor.mjs [--json] [--no-render]";
  const { values, positionals } = parseCli(argv, { json: { type: "boolean" }, "no-render": { type: "boolean" } }, { usage, strict: true });
  if (positionals.length) throw new UsageError(`Unknown argument ${positionals[0]}\n${usage}`);
  const report = await diagnose({ render: !values["no-render"] });
  console.log(values.json ? JSON.stringify(report, null, 2) : describe(report).join("\n"));
  return report.ready ? EXIT.ok : EXIT.refused;
});
