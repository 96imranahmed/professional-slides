// The pages file, read whole.
//
// A deck's pages are independent once its spine is settled, so several
// workers can write different sections at the same time - but not into one
// JSON file. A pages file may therefore be assembled from parts: an entry of
// `pages` or `appendix` written as `{ "include": "pages/economics.pages.json" }`
// stands for the pages of that file, spliced in at that place, in order. A
// part is `{ "pages": [...] }` (or the bare list), may include further parts,
// and may add to the `sources` registry the sources its pages cite. Paths
// are relative to the file that names them, and stay inside the folder of
// the pages file: a part outside it (`../`, an absolute path, a link that
// leads out of it) is refused, and so is one part included twice.
//
// Every reader of a pages file that compiles it reads it here, so the deck a
// worker checks and the deck that is built are the same pages. Each page id
// is written once across the parts; a second is refused with both places.
// The part a page came from is remembered (`partsOf`), so a finding can name
// the file to edit.
import fs from "node:fs";
import path from "node:path";

const PARTS = new WeakMap();

/** The part file each page id of `doc` was read from (relative to the pages file), for pages that came from one. */
export const partsOf = (doc) => PARTS.get(doc) ?? new Map();

/** `findings` with the part file named on each one whose page came from a part. */
export function withParts(doc, findings) {
  const parts = partsOf(doc);
  return parts.size ? findings.map((f) => { const part = parts.get(String(f.id ?? f.page ?? "")); return part ? { ...f, part } : f; }) : findings;
}

const isInclude = (entry) => entry && typeof entry === "object" && !Array.isArray(entry) && entry.include !== undefined;

function readJsonFile(file, named) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); }
  catch (error) { throw new Error(named ? `${named}, which cannot be read (${error.code ?? error.message})` : `Cannot read ${file}: ${error.message}`); }
  try { return JSON.parse(text); }
  catch (error) { throw new Error(notJson(file, error)); }
}

/** One line saying a file does not parse, with where: the parser's own message quotes the file's contents, and is left out. */
export function notJson(file, error) {
  const at = /\(line \d+ column \d+\)/.exec(String(error?.message ?? ""));
  return `${file} is not valid JSON${at ? ` ${at[0]}` : ""}: it is read as JSON and does not parse`;
}

const within = (base, target) => { const relative = path.relative(base, target); return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative); };
// Where a path leads once every link on it is followed. A file that is not there is placed under where its folder leads, so the reader can say it is missing.
const real = (file) => { try { return fs.realpathSync(file); } catch { const parent = path.dirname(file); return parent === file ? file : path.join(real(parent), path.basename(file)); } };
/**
 * Is `target` inside the folder `base`: by the path as written, and by where
 * it leads - a part that is a link, or sits under a linked folder, is the
 * file it resolves to, and one that resolves outside the folder is outside it
 * as `../` is.
 */
export const inside = (base, target) => within(base, target) && within(real(base), real(target));

/**
 * A pages file with every include spliced in. A file without includes is
 * returned as it is written.
 */
export function readPagesFileSync(file) {
  const root = path.resolve(file), base = path.dirname(root);
  const doc = readJsonFile(root);
  const lists = ["pages", "appendix"].filter((key) => Array.isArray(doc?.[key]) && doc[key].some(isInclude));
  if (!lists.length) return doc;
  const parts = new Map(), seen = new Map(), included = new Map(), sources = new Map(Object.keys(doc.sources ?? {}).map((key) => [key, path.basename(root)]));
  const registry = { ...(doc.sources ?? {}) };
  const relative = (at) => path.relative(base, at) || path.basename(at);
  const place = (page, at, index) => {
    const id = page && typeof page === "object" ? page.id : undefined;
    if (id === undefined) return;
    const where = `${relative(at)} (entry ${index + 1})`;
    if (seen.has(String(id))) throw new Error(`Page id "${id}" is written twice: in ${seen.get(String(id))} and in ${where}. Each page has one id across the parts; rename one`);
    seen.set(String(id), where);
    if (at !== root) parts.set(String(id), relative(at));
  };
  const expand = (list, at, chain) => list.flatMap((entry, index) => {
    if (!isInclude(entry)) { place(entry, at, index); return [entry]; }
    const where = `${relative(at)} entry ${index + 1}`;
    if (typeof entry.include !== "string" || !entry.include.trim() || Object.keys(entry).length !== 1) throw new Error(`${where}: an include is { "include": "<path to a part file>" } and nothing else`);
    const target = path.resolve(path.dirname(at), entry.include);
    if (path.isAbsolute(entry.include) || !inside(base, target)) throw new Error(`${where} includes "${entry.include}", which is outside the folder of ${path.basename(root)}${!path.isAbsolute(entry.include) && !path.relative(base, target).startsWith("..") ? " (it is a link, or under a linked folder, that leads out of it)" : ""}: a part is a file in that folder or under it, named by a relative path`);
    if (chain.includes(target)) throw new Error(`${where} includes ${relative(target)}, which includes it in turn`);
    if (included.has(target)) throw new Error(`${relative(target)} is included twice: at ${included.get(target)} and at ${where}. A part's pages stand in one place in the deck; take one include out`);
    included.set(target, where);
    const part = readJsonFile(target, `${where} includes "${entry.include}"`);
    const pages = Array.isArray(part) ? part : part?.pages;
    if (!Array.isArray(pages)) throw new Error(`${relative(target)} is a part of ${path.basename(root)}: write it as { "pages": [...] }`);
    const extra = Array.isArray(part) ? [] : Object.keys(part).filter((key) => !["pages", "sources"].includes(key));
    if (extra.length) throw new Error(`${relative(target)} carries ${extra.map((key) => `\`${key}\``).join(", ")}; a part holds \`pages\` and the \`sources\` they cite - the deck-level keys stay in ${path.basename(root)}`);
    // A part may register the sources its pages cite; the same key means the same source everywhere.
    for (const [key, source] of Object.entries((!Array.isArray(part) && part.sources) || {})) {
      if (key in registry && JSON.stringify(registry[key]) !== JSON.stringify(source)) throw new Error(`Source "${key}" is registered twice with different entries: in ${sources.get(key)} and in ${relative(target)}`);
      registry[key] = source; if (!sources.has(key)) sources.set(key, relative(target));
    }
    return expand(pages, target, [...chain, target]);
  });
  const whole = { ...doc };
  for (const key of ["pages", "appendix"]) if (Array.isArray(doc[key])) whole[key] = expand(doc[key], root, [root]);
  if (Object.keys(registry).length) whole.sources = registry;
  PARTS.set(whole, parts);
  return whole;
}

/** `readPagesFileSync`, for callers that read asynchronously. */
export const readPagesFile = async (file) => readPagesFileSync(file);

/**
 * `edit(page)` applied to each page of a pages file whose id is in `ids`, in
 * the file the page is written in - the pages file itself or the part it is
 * included from - and each file it changed written back in the indentation it
 * was written in. A page `edit` leaves as it was writes nothing. Returns the
 * files written, relative to the pages file's folder.
 */
export function editPagesSync(file, ids, edit) {
  const root = path.resolve(file), base = path.dirname(root), wanted = new Set([...ids].map(String)), written = [];
  const visit = (at) => {
    const raw = fs.readFileSync(at, "utf8"), doc = JSON.parse(raw);
    const lists = at === root ? ["pages", "appendix"].filter((key) => Array.isArray(doc?.[key])).map((key) => doc[key]) : [Array.isArray(doc) ? doc : doc?.pages].filter(Array.isArray);
    let changed = false;
    for (const list of lists) for (const entry of list) {
      if (isInclude(entry)) { const target = path.resolve(path.dirname(at), entry.include); if (inside(base, target)) visit(target); continue; }
      if (!entry || typeof entry !== "object" || !wanted.has(String(entry.id))) continue;
      const before = JSON.stringify(entry);
      edit(entry);
      if (JSON.stringify(entry) !== before) changed = true;
    }
    if (!changed) return;
    const indent = /^[[{]\r?\n([ \t]+)/.exec(raw)?.[1] ?? 1;
    fs.writeFileSync(at, `${JSON.stringify(doc, null, indent)}${raw.endsWith("\n") ? "\n" : ""}`);
    written.push(path.relative(base, at) || path.basename(at));
  };
  visit(root);
  return written;
}
