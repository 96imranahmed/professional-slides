import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire, isBuiltin } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modules = process.env.RUNTIME_NODE_MODULES || path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules");

// The private Artifact Tool package is supplied by Codex, not the public npm
// registry. Lock the resolved bundle dependency graph without modifying it.
export async function runtimeLock(moduleRoot = modules) {
  const project = JSON.parse(await fs.readFile(path.join(root, "package.json")));
  const records = new Map();
  async function visit(name, from, optional = false) {
    if (isBuiltin(name)) return `node:${name.replace(/^node:/, "")}`;
    const require = createRequire(path.join(from, "package.json"));
    let filename;
    try {
      for (const directory of require.resolve.paths(name) || []) {
        const candidate = path.join(directory, name, "package.json");
        if (await fs.stat(candidate).then(stat => stat.isFile()).catch(() => false)) { filename = candidate; break; }
      }
      if (!filename) throw new Error(`Cannot locate manifest for ${name}`);
    } catch (error) {
      if (optional) return null;
      throw error;
    }
    const bytes = await fs.readFile(filename), manifest = JSON.parse(bytes);
    const key = path.relative(moduleRoot, path.dirname(filename));
    if (records.has(key)) return key;
    const record = { name, version: manifest.version, manifestSha256: createHash("sha256").update(bytes).digest("hex"), dependencies: {} };
    records.set(key, record);
    const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies };
    for (const dependency of Object.keys(dependencies).sort()) {
      record.dependencies[dependency] = await visit(dependency, path.dirname(filename), Object.hasOwn(manifest.optionalDependencies || {}, dependency));
    }
    return key;
  }
  const direct = {};
  for (const name of Object.keys(project.peerDependencies).sort()) {
    const key = await visit(name, path.dirname(moduleRoot));
    if (records.get(key).version !== project.peerDependencies[name]) throw new Error(`Runtime version differs from pinned ${name}`);
    direct[name] = key;
  }
  return { schema: "professional-slides.runtime-lock/v1", bundle: "26.904.11930", node: process.version, platform: process.platform, arch: process.arch, direct, packages: Object.fromEntries([...records].sort(([a], [b]) => a.localeCompare(b))) };
}

export async function verifyRuntimeLock() {
  const expected = JSON.parse(await fs.readFile(path.join(root, "evals/runtime-lock.json")));
  const actual = await runtimeLock();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Rendering dependency graph changed; review and refresh evals/runtime-lock.json before accepting new visual evidence");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--print")) console.log(JSON.stringify(await runtimeLock(), null, 2));
  else { await verifyRuntimeLock(); console.log("Rendering dependency lock verified"); }
}
