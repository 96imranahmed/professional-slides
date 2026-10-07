#!/usr/bin/env node
// Fill a deck's photograph placeholders from Wikimedia Commons, keeping only
// freely licensed photographs and recording who took each one.
//
//   node runtime/fetch-pictures.mjs <id>.deck.json            fetch, write assets/pictures/, fill the spec
//   node runtime/fetch-pictures.mjs <id>.deck.json --dry-run  name the photograph each placeholder would get
//
// A picture planned as `{ alt: "what it shows" }` - the cover image, a divider
// image, a page `photo`, a photo cell - is searched on Commons by its `search`
// (else its alt text). Of the results that are JPEG photographs at least
// 1200px wide, under CC0, CC BY, CC BY-SA or the public domain, and not a
// map, diagram, logo or flag, the one whose title, description and categories
// name most of what the picture is planned to show is downloaded at 1600px,
// landscape preferred among equals; a result that names none of it is not
// taken, since a search returns what matches its words, not what shows the
// subject. The words it matched are recorded with the file. The picture gets its `path` and a `credit` naming author and
// licence, which CC BY and CC BY-SA require the deck to show. A picture that
// must come from the client is marked `fetch: false` and stays a placeholder.
// A photograph is used once a deck: a file another picture of the deck took is
// passed over for the next best. Among photographs that name as much of the
// subject, the latest dated wins; `after: 2019` on a picture takes none dated
// before that year (an aircraft in a livery retired since), and `without:
// ["Ataturk"]` none naming those words (a lounge at another airport of the same
// city). The dry run names the photograph the fetch would take, by the same
// choice in the same order. Logos (alt ending in "logo") are fetch-logos.mjs's business.
import fs from "node:fs/promises";
import path from "node:path";
import { UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { UA, slugOf } from "./fetch-logos.mjs";
import { contentWords } from "./gates/content_gates.mjs";

const COMMONS = "https://commons.wikimedia.org/w/api.php";
const FREE = /^(cc0|cc[- ]by(-sa)?(\s[\d.]+)?(\s\w+)?|public domain|pd\b|pdm|attribution(-sharealike)?)/i;
const NOT_A_PHOTO = /\b(logo|map|diagram|chart|graph|flag|coat of arms|seal|icon|screenshot|infographic|plan|poster|drawing|render(ing)?)\b/i;

export const isLogoAlt = (alt) => /\blogo\s*$/i.test(String(alt ?? "").trim());

/** Every photograph placeholder in the spec: `{ alt }` with no file, not a logo, not opted out. */
export function picturePlaceholders(spec) {
  const found = [];
  const walk = (value) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== "object") return;
    if (typeof value.alt === "string" && value.alt.trim() && !value.path && !value.dataUri && !isLogoAlt(value.alt) && value.fetch !== false) found.push(value);
    for (const child of Object.values(value)) walk(child);
  };
  walk(spec);
  return found;
}

const stripHtml = (html) => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

// Words a picture's plan shares with every photograph of anything: they say nothing of its subject.
const GENERIC = new Set(["photo", "photograph", "picture", "image", "view", "views", "showing", "shows", "from", "with", "street", "building", "buildings", "city", "york"]);
/** The words a candidate must name to show the subject: the plan's content words, less the generic ones. */
export const subjectWords = (text) => [...contentWords(text)].filter((word) => !GENERIC.has(word));

/**
 * The best freely licensed photograph among Commons search results (pages in
 * search order, each with `imageinfo`), or null. With `subject` - what the
 * picture is planned to show - a candidate is taken only where its title,
 * description or categories name some of it, and the one naming most wins.
 * Pure, so it is tested offline.
 */
export function chooseCommonsPhoto(pages, subject = null, { exclude = new Set(), after = null, without = [] } = {}) {
  const wanted = subject ? subjectWords(subject) : [];
  const shunned = without.flatMap((word) => [...contentWords(word)]);
  const ok = [];
  for (const page of [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value);
    if (!info || info.mime !== "image/jpeg" || info.width < 1200) continue;
    if (!FREE.test(license) || /\b(nc|nd)\b/i.test(license) || meta.NonFree?.value === "true") continue;
    if (NOT_A_PHOTO.test(page.title) || NOT_A_PHOTO.test(stripHtml(meta.ObjectName?.value))) continue;
    if (exclude.has(page.title)) continue;
    const taken = Number(/\b(?:19|20)\d{2}\b/.exec(stripHtml(meta.DateTimeOriginal?.value ?? meta.DateTime?.value ?? ""))?.[0] ?? NaN);
    if (Number.isFinite(after) && Number.isFinite(taken) && taken < after) continue;
    const artist = stripHtml(meta.Artist?.value).slice(0, 80) || "unknown author";
    const description = stripHtml(meta.ImageDescription?.value).slice(0, 300);
    const named = contentWords([page.title, description, stripHtml(meta.Categories?.value), stripHtml(meta.ObjectName?.value)].join(" "));
    const matched = wanted.filter((word) => named.has(word));
    if (wanted.length && !matched.length) continue;
    if (shunned.some((word) => named.has(word))) continue;
    ok.push({
      title: page.title, landscape: info.width >= info.height * 1.15, description, matched, ...(Number.isFinite(taken) ? { year: taken } : {}),
      url: info.thumburl || info.url, page: info.descriptionurl, license, licenseUrl: meta.LicenseUrl?.value ?? null, artist,
      // The credits page prints this string, so it carries the links a reader
      // needs to trace the file and its licence.
      credit: `Photo: ${artist}, ${license}${meta.LicenseUrl?.value ? ` (${meta.LicenseUrl.value})` : ""}, via Wikimedia Commons${info.descriptionurl ? `: ${info.descriptionurl}` : ""}`,
    });
  }
  const best = Math.max(0, ...ok.map((c) => c.matched.length));
  // Of those naming most of the subject, the latest dated, landscape among equals; undated after dated, in search order.
  const top = ok.filter((c) => c.matched.length === best).map((c, at) => ({ c, at }))
    .sort((a, b) => (b.c.year ?? -Infinity) - (a.c.year ?? -Infinity) || Number(b.c.landscape) - Number(a.c.landscape) || a.at - b.at);
  return top[0]?.c ?? null;
}

export async function searchCommons(query, subject = null, options = {}) {
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", generator: "search", gsrnamespace: "6",
    gsrsearch: `${query} filetype:bitmap`, gsrlimit: "12", prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600", iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|ObjectName|NonFree|ImageDescription|Categories|DateTimeOriginal|DateTime",
  });
  const res = await fetch(`${COMMONS}?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return chooseCommonsPhoto((await res.json()).query?.pages ?? [], subject, options);
}

/** What a placeholder is searched by and held to: its search words, its subject, the year and words it excludes. */
const askOf = (picture) => ({ query: picture.search ?? picture.alt, subject: [picture.alt, picture.search].filter(Boolean).join(" "),
  options: { ...(Number.isFinite(Number(picture.after)) ? { after: Number(picture.after) } : {}), ...(Array.isArray(picture.without) ? { without: picture.without.map(String) } : {}) } });

/**
 * The photograph each placeholder takes, in the deck's order: the dry run and
 * the fetch both read this, so the one names what the other downloads. A file
 * a placeholder takes is passed over for the ones after it, and so is one the
 * records hold for another picture of the deck.
 */
export async function choosePictures(placeholders, { records = new Map(), search = searchCommons } = {}) {
  const taken = new Set([...records.values()].map((r) => r.title).filter(Boolean));
  const chosen = new Map();
  for (const picture of placeholders) {
    const ask = askOf(picture), own = records.get(picture.alt)?.title;
    const exclude = new Set([...taken].filter((title) => title !== own));
    const choice = await search(ask.query, ask.subject, { ...ask.options, exclude });
    chosen.set(picture, choice);
    if (choice?.title) taken.add(choice.title);
  }
  return chosen;
}

async function download(choice, file) {
  const res = await fetch(choice.url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`download ${res.status}`);
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
}

const recordsPath = (directory) => path.join(directory, "sources.json");
async function readRecords(directory) {
  return new Map(((await readJson(recordsPath(directory), { optional: true })) ?? []).map((r) => [r.alt, r]));
}

/**
 * Fill the spec's photograph placeholders in memory, for the build: a file
 * already in assets/pictures/ is reused offline; a missing one is fetched when
 * `fetchMissing`. `search` and `fetch` are removed from every picture, since
 * they steer this step and are not picture properties.
 */
export async function autoFillPictures(spec, baseDir, { fetchMissing = true, write = false } = {}) {
  const placeholders = picturePlaceholders(spec);
  const directory = path.join(baseDir, "assets", "pictures");
  const records = await readRecords(directory);
  const filled = [], failed = [];
  const state = new Map();
  for (const picture of placeholders) {
    const file = path.join(directory, `${slugOf(picture.alt)}.jpg`);
    const known = records.get(picture.alt);
    const exists = await fs.access(file).then(() => true, () => false);
    // A photograph fetched for other search words is not the one asked for now: re-searched where the network is allowed.
    const searched = exists && known && fetchMissing && (known.search ?? null) !== (picture.search ?? null);
    state.set(picture, { file, known, exists, fetch: !exists || searched });
  }
  // Chosen together, in order, so no two pictures of the deck take one file (choosePictures).
  const wanted = fetchMissing ? placeholders.filter((picture) => state.get(picture).fetch) : [];
  let chosen = new Map();
  try { chosen = await choosePictures(wanted, { records }); } catch (error) { for (const picture of wanted) failed.push(`${picture.alt}: ${error.message}`); }
  for (const picture of placeholders) {
    const { file, known, exists, fetch: fetching } = state.get(picture);
    try {
      if (fetching) {
        if (!fetchMissing || !chosen.has(picture)) continue;
        const choice = chosen.get(picture);
        if (!choice) { failed.push(`${picture.alt}: no freely licensed photograph whose title, description or categories name what it is planned to show; set \`search\` to the place's own name, or supply the file`); continue; }
        await fs.mkdir(directory, { recursive: true });
        await download(choice, file);
        const { url, landscape, ...record } = choice;
        records.set(picture.alt, { alt: picture.alt, search: picture.search ?? null, ...record, source: url, saved: path.relative(baseDir, file) });
      } else if (!exists) continue;
      picture.path = path.relative(baseDir, file);
      picture.credit = picture.credit ?? records.get(picture.alt)?.credit ?? known?.credit ?? `Photo: ${picture.alt}`;
      filled.push(picture.alt);
    } catch (error) { failed.push(`${picture.alt}: ${error.message}`); }
  }
  if (records.size) { await fs.mkdir(directory, { recursive: true }); await writeJson(recordsPath(directory), [...records.values()]); }
  if (!write) {
    const strip = (value) => {
      if (Array.isArray(value)) { value.forEach(strip); return; }
      if (!value || typeof value !== "object") return;
      if (typeof value.alt === "string") { delete value.search; delete value.fetch; delete value.after; delete value.without; }
      for (const child of Object.values(value)) strip(child);
    };
    strip(spec);
  }
  return { filled: filled.length, failed };
}

const USAGE = "Usage: fetch-pictures.mjs <id>.deck.json [--dry-run]";

async function main(argv) {
  const { values, positionals: [specArg] } = parseCli(argv, { "dry-run": { type: "boolean" } }, { usage: USAGE });
  if (!specArg) throw new UsageError(USAGE);
  const specPath = path.resolve(specArg);
  const spec = await readJson(specPath);
  if (values["dry-run"]) {
    // The choice the fetch makes, in the order it makes it: the records of the files already fetched count as taken.
    const placeholders = picturePlaceholders(spec);
    const chosen = await choosePictures(placeholders, { records: await readRecords(path.join(path.dirname(specPath), "assets", "pictures")) });
    console.log(JSON.stringify(placeholders.map((picture) => { const choice = chosen.get(picture);
      return { alt: picture.alt, photo: choice?.page ?? null, license: choice?.license ?? null, artist: choice?.artist ?? null, ...(choice?.year ? { year: choice.year } : {}), ...(choice?.matched ? { matched: choice.matched } : {}) }; }), null, 1));
    return;
  }
  const result = await autoFillPictures(spec, path.dirname(specPath), { write: true });
  await writeJson(specPath, spec);
  console.log(JSON.stringify(result, null, 1));
}

if (isMain(import.meta.url)) runCli(main);
