#!/usr/bin/env node
/**
 * Dead exports in the runtime: an export no file imports - no runtime module,
 * no eval script, no test probe, no code example in the docs - and its own
 * module never uses either. Code nothing runs. A re-export (`export { x }` of
 * an imported `x`, or `export ... from`) is dead when nothing imports it,
 * whatever its module does with the name.
 *
 *   node evals/scripts/dead_exports.mjs     prints them; exits 1 when there are any
 *
 * An export kept on purpose, for callers outside this repository, is named in
 * PUBLIC_API with its reason. An export only its own module uses is not dead:
 * the name is live, and a module split may need it exported again.
 *
 * Imports are read as text. A test probe interpolates its specifier
 * (`from '{KIT}'`); a name imported from a specifier that resolves to no file
 * counts as used in every module that exports it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, runCli } from "../../skills/professional-slides/runtime/cli.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const runtimeOf = (root) => path.join(root, "skills", "professional-slides", "runtime");
const SKIPPED = new Set(["node_modules", "__pycache__", "runs", ".git"]);

// Exports kept for callers outside the repository, as `path:name` with why.
export const PUBLIC_API = Object.freeze({});

function walk(directory, keep) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, keep));
    else if (keep(entry.name)) found.push(full);
  }
  return found;
}

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\/])\/\/[^\n]*/g, "$1");
const names = (list) => list.split(",").map((part) => part.trim()).filter(Boolean);

/** A module's exports: `{ name, reexport }`, `reexport` when the module passes on a name it imports. */
function exportsOf(source) {
  const code = stripComments(source);
  const imported = new Set();
  for (const m of code.matchAll(/import\s+(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from/g)) for (const part of names(m[1])) imported.add(part.split(/\s+as\s+/).pop().trim());
  const out = [];
  for (const m of code.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([\w$]+)/gm)) out.push({ name: m[1], reexport: false });
  for (const m of code.matchAll(/^\s*export\s*\{([^}]*)\}\s*(from\s*["'][^"']+["'])?/gm)) {
    for (const part of names(m[1])) {
      const [local, exported = local] = part.split(/\s+as\s+/).map((s) => s.trim());
      out.push({ name: exported, reexport: Boolean(m[2]) || imported.has(local) });
    }
  }
  return out;
}

function resolve(root, from, specifier) {
  let spec = specifier;
  if (spec.startsWith("file://")) spec = decodeURIComponent(spec.slice(7));
  let target;
  if (spec.startsWith("./skills/") || spec.startsWith("skills/")) target = path.join(root, spec);
  else if (spec.startsWith(".")) target = path.resolve(path.dirname(from), spec);
  else if (spec.startsWith("/")) target = spec;
  else return null;
  return fs.existsSync(target) ? target : null;
}

/** Every import a file makes: `{ target, names }`; `target` null when its specifier resolves to no file. */
function importsOf(root, file, source) {
  const code = file.endsWith(".mjs") ? stripComments(source) : source.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
  const found = [];
  const add = (specifier, list) => { if (/^(node:|[a-z@])/.test(specifier) && !specifier.startsWith("skills/")) return; found.push({ target: resolve(root, file, specifier), names: list }); };
  for (const m of code.matchAll(/import\s+(?:([\w$]+)\s*,\s*)?(\{[^}]*\}|\*\s*as\s+([\w$]+))?\s*from\s*["'`]([^"'`]+)["'`]/g)) {
    if (m[2]?.startsWith("{")) add(m[4], names(m[2].slice(1, -1)).map((part) => part.split(/\s+as\s+/)[0].trim()));
    else if (m[3]) {
      // A namespace: the names it reads off the namespace.
      const used = [...code.matchAll(new RegExp(`\\b${m[3]}\\.([\\w$]+)`, "g"))].map((u) => u[1]);
      add(m[4], used);
    }
  }
  for (const m of code.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) add(m[2], names(m[1]).map((part) => part.split(/\s+as\s+/)[0].trim()));
  // `await import(path.join(runtime, "gates", "x.mjs"))`: the literal parts, under the runtime.
  const dynamic = (call) => {
    const joined = /path\.join\(\s*[\w$]+\s*,((?:\s*["'`][^"'`]+["'`]\s*,?)+)\)/.exec(call);
    return joined ? path.join(runtimeOf(root), ...[...joined[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((part) => part[1])) : null;
  };
  for (const m of code.matchAll(/\{([^}]*)\}\s*=\s*await\s+import\(([^;]*?)\)\s*;/g)) {
    const list = names(m[1]).map((part) => part.split(":")[0].trim());
    const target = dynamic(m[2]);
    if (target) found.push({ target: fs.existsSync(target) ? target : null, names: list });
    else { const literal = /["'`]([^"'`]+)["'`]/.exec(m[2]); if (literal) add(literal[1], list); }
  }
  for (const m of code.matchAll(/await\s+import\(\s*[^)]*?["'`]([^"'`]+)["'`]\s*\)\s*\)?\.([\w$]+)/g)) add(m[1], [m[2]]);
  return found;
}

/** The dead exports of the runtime under `root`: `{ file, name, reexport }`, none when it is clean. */
export function deadExports(root = ROOT, { publicApi = PUBLIC_API } = {}) {
  const modules = walk(runtimeOf(root), (name) => name.endsWith(".mjs"));
  const readers = [
    ...walk(path.join(root, "skills"), (name) => /\.(mjs|md)$/.test(name)),
    ...walk(path.join(root, "evals"), (name) => /\.(mjs|py|md)$/.test(name)),
  ];
  const used = new Map(), unresolved = new Set();
  for (const file of readers) {
    for (const { target, names: list } of importsOf(root, file, fs.readFileSync(file, "utf8"))) {
      if (!target) { for (const name of list) unresolved.add(name); continue; }
      if (!used.has(target)) used.set(target, new Set());
      for (const name of list) used.get(target).add(name);
    }
  }
  const dead = [];
  for (const file of modules) {
    const source = fs.readFileSync(file, "utf8");
    // Uses of a name inside its module, the export lists that name it aside.
    const code = stripComments(source).replace(/^[ \t]*export\s*\{[^}]*\}[^;\n]*;?/gm, "");
    for (const { name, reexport } of exportsOf(source)) {
      const where = `${path.relative(root, file)}:${name}`;
      if (used.get(file)?.has(name) || unresolved.has(name) || Object.hasOwn(publicApi, where)) continue;
      if (!reexport) {
        // Every mention of the name, less the reads of a property that shares it (`a.name`, not `...name`).
        const word = name.replace(/\$/g, "\\$");
        const count = (pattern) => (code.match(new RegExp(pattern, "g")) || []).length;
        if (count(`(?<![\\w$])${word}(?![\\w$])`) - count(`(?<!\\.)\\.${word}(?![\\w$])`) > 1) continue;
      }
      dead.push({ file: path.relative(root, file), name, reexport });
    }
  }
  return dead;
}

if (isMain(import.meta.url)) runCli(() => {
  const dead = deadExports();
  for (const d of dead) console.log(`${d.file}: ${d.name}${d.reexport ? " (re-export)" : ""}`);
  console.log(JSON.stringify({ deadExports: dead.length }));
  return dead.length ? 1 : 0;
});
