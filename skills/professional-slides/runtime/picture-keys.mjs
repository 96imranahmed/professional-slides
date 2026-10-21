// The keys of the picture libraries that need one - Pexels, Unsplash, Pixabay - kept outside every project.
//
// Wikimedia Commons and Openverse need no key; the stock libraries widen the pool for the generic scenes Commons files
// poorly (a cargo hold, a hub at night). A key is the user's: read from its environment variable, else from keys.json
// beside the stored preferences (preferences.mjs), written only by `keys --set`, which reads the key from standard input
// so it stays out of the shell's history and out of every deck, project and transcript. The design intake asks once
// whether the user has one (preferences.mjs `pictureKeys`); they can add one at any time after.
import fs from "node:fs";
import path from "node:path";
import { preferencesPath } from "./preferences.mjs";

export const KEYED_PROVIDERS = Object.freeze({
  pexels: { variable: "PEXELS_API_KEY", site: "https://www.pexels.com/api/" },
  unsplash: { variable: "UNSPLASH_ACCESS_KEY", site: "https://unsplash.com/developers" },
  pixabay: { variable: "PIXABAY_API_KEY", site: "https://pixabay.com/api/docs/" },
});

/** Where the keys file lives: beside the stored preferences. */
export const keysPath = (env = process.env) => path.join(path.dirname(preferencesPath(env)), "keys.json");

function readKeysFile(file) {
  try { const keys = JSON.parse(fs.readFileSync(file, "utf8")); return keys && typeof keys === "object" && !Array.isArray(keys) ? keys : {}; }
  catch { return {}; }
}

/** Each keyed provider's key and where it came from: its environment variable first, then the keys file. */
export function pictureKeys(env = process.env) {
  const stored = readKeysFile(keysPath(env));
  const out = {};
  for (const [provider, { variable }] of Object.entries(KEYED_PROVIDERS)) {
    if (typeof env[variable] === "string" && env[variable].trim()) out[provider] = { key: env[variable].trim(), from: "environment" };
    else if (typeof stored[provider] === "string" && stored[provider].trim()) out[provider] = { key: stored[provider].trim(), from: "keys file" };
  }
  return out;
}

/** Which providers have a key, never the key: for `doctor` and `keys`. */
export function keyStatus(env = process.env) {
  const keys = pictureKeys(env);
  return Object.fromEntries(Object.keys(KEYED_PROVIDERS).map((provider) => [provider, keys[provider]?.from ?? null]));
}

function writeKeys(keys, env) {
  const file = keysPath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(keys, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

export function setPictureKey(provider, key, env = process.env) {
  if (!KEYED_PROVIDERS[provider]) throw new Error(`No picture provider "${provider}"; one of ${Object.keys(KEYED_PROVIDERS).join(", ")}`);
  if (typeof key !== "string" || !key.trim()) throw new Error(`Give the ${provider} key on standard input: \`printf %s "$KEY" | professional-slides keys --set ${provider}\``);
  return writeKeys({ ...readKeysFile(keysPath(env)), [provider]: key.trim() }, env);
}

export function clearPictureKey(provider, env = process.env) {
  if (!KEYED_PROVIDERS[provider]) throw new Error(`No picture provider "${provider}"; one of ${Object.keys(KEYED_PROVIDERS).join(", ")}`);
  const { [provider]: _gone, ...rest } = readKeysFile(keysPath(env));
  return writeKeys(rest, env);
}
