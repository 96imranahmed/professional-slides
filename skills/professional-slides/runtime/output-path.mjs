import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

// Resolve existing ancestors as well as dangling symlinks before any mkdir or
// cleanup. realpath alone cannot resolve a destination that does not exist yet.
async function resolvedPath(target, links = 0) {
  if (links > 40) throw new Error("Too many output-directory symlinks");
  try { return await fs.realpath(target); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    const entry = await fs.lstat(target).catch(error => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (entry?.isSymbolicLink()) return resolvedPath(path.resolve(path.dirname(target), await fs.readlink(target)), links + 1);
    return path.join(await resolvedPath(path.dirname(target), links), path.basename(target));
  }
}

export async function assertOutputDirectory(target, root = pluginRoot) {
  const directory = await resolvedPath(path.resolve(target));
  const owner = await fs.realpath(root);
  const developmentCheckout = await fs.stat(path.join(owner, ".git")).then(() => true).catch(() => false);
  if (within(owner, directory) && !(developmentCheckout && within(path.join(owner, "output"), directory))) {
    throw new Error("Plugin files are read-only. Write deck artifacts outside the installed plugin; developer checkouts may use their output/ directory.");
  }
  return directory;
}
