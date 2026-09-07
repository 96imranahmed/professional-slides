import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const within = (parent, child) => child === parent || (!path.relative(parent, child).startsWith(`..${path.sep}`) && path.relative(parent, child) !== '..' && !path.isAbsolute(path.relative(parent, child)));
async function resolvedPath(target) {
  try { return await fs.realpath(target); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await resolvedPath(path.dirname(target)), path.basename(target));
  }
}

export async function assertOutputDirectory(target, root = pluginRoot) {
  const directory = await resolvedPath(path.resolve(target));
  const owner = await fs.realpath(root);
  const developmentCheckout = await fs.stat(path.join(owner, '.git')).then(() => true).catch(() => false);
  const developmentOutput = path.join(owner, 'output');
  if (within(owner, directory) && !(developmentCheckout && within(developmentOutput, directory))) {
    throw new Error('Plugin files are read-only. Write deck artifacts under output/<task> in the user workspace, outside the installed plugin. Developer checkouts may use their output/ directory.');
  }
  return directory;
}
