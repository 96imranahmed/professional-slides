#!/usr/bin/env node
// Fill a deck's photograph placeholders from Wikimedia Commons, keeping only
// freely licensed photographs and recording who took each one.
//
//   node runtime/fetch-pictures.mjs <id>.deck.json            fetch, write assets/pictures/, fill the spec
//   node runtime/fetch-pictures.mjs <id>.deck.json --dry-run  name the photograph each placeholder would get
//
// A picture planned as `{ alt: "what it shows" }` - the cover image, a divider
// image, a page `photo`, a photo cell - is searched on Commons by its `search`
// (else its alt text). The first result that is a JPEG photograph at least
// 1200px wide, under CC0, CC BY, CC BY-SA or the public domain, and not a
// map, diagram, logo or flag, is downloaded at 1600px; landscape results are
// preferred. The picture gets its `path` and a `credit` naming author and
// licence, which CC BY and CC BY-SA require the deck to show. A picture that
// must come from the client is marked `fetch: false` and stays a placeholder.
// Logos (alt ending in "logo") are fetch-logos.mjs's business.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UA, slugOf } from "./fetch-logos.mjs";

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

/**
 * The best freely licensed photograph among Commons search results (pages in
 * search order, each with `imageinfo`), or null. Pure, so it is tested offline.
 */
export function chooseCommonsPhoto(pages) {
  const ok = [];
  for (const page of [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value);
    if (!info || info.mime !== "image/jpeg" || info.width < 1200) continue;
    if (!FREE.test(license) || /\b(nc|nd)\b/i.test(license) || meta.NonFree?.value === "true") continue;
    if (NOT_A_PHOTO.test(page.title) || NOT_A_PHOTO.test(stripHtml(meta.ObjectName?.value))) continue;
    const artist = stripHtml(meta.Artist?.value).slice(0, 80) || "unknown author";
    ok.push({
      title: page.title, landscape: info.width >= info.height * 1.15,
      url: info.thumburl || info.url, page: info.descriptionurl, license, licenseUrl: meta.LicenseUrl?.value ?? null, artist,
      // The credits page prints this string, so it carries the links a reader
      // needs to trace the file and its licence.
      credit: `Photo: ${artist}, ${license}${meta.LicenseUrl?.value ? ` (${meta.LicenseUrl.value})` : ""}, via Wikimedia Commons${info.descriptionurl ? `: ${info.descriptionurl}` : ""}`,
    });
  }
  return ok.find((c) => c.landscape) ?? ok[0] ?? null;
}

export async function searchCommons(query) {
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", generator: "search", gsrnamespace: "6",
    gsrsearch: `${query} filetype:bitmap`, gsrlimit: "12", prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600", iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|ObjectName|NonFree",
  });
  const res = await fetch(`${COMMONS}?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return chooseCommonsPhoto((await res.json()).query?.pages ?? []);
}

async function download(choice, file) {
  const res = await fetch(choice.url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`download ${res.status}`);
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
}

const recordsPath = (directory) => path.join(directory, "sources.json");
async function readRecords(directory) {
  return new Map((await fs.readFile(recordsPath(directory), "utf8").then(JSON.parse).catch(() => [])).map((r) => [r.alt, r]));
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
  for (const picture of placeholders) {
    const file = path.join(directory, `${slugOf(picture.alt)}.jpg`);
    const known = records.get(picture.alt);
    const exists = await fs.access(file).then(() => true, () => false);
    try {
      if (!exists) {
        if (!fetchMissing) continue;
        const choice = await searchCommons(picture.search ?? picture.alt);
        if (!choice) { failed.push(`${picture.alt}: no freely licensed photograph found; set \`search\` or supply the file`); continue; }
        await fs.mkdir(directory, { recursive: true });
        await download(choice, file);
        const { url, landscape, ...record } = choice;
        records.set(picture.alt, { alt: picture.alt, search: picture.search ?? null, ...record, source: url, saved: path.relative(baseDir, file) });
      }
      picture.path = path.relative(baseDir, file);
      picture.credit = picture.credit ?? records.get(picture.alt)?.credit ?? known?.credit ?? `Photo: ${picture.alt}`;
      filled.push(picture.alt);
    } catch (error) { failed.push(`${picture.alt}: ${error.message}`); }
  }
  if (records.size) { await fs.mkdir(directory, { recursive: true }); await fs.writeFile(recordsPath(directory), JSON.stringify([...records.values()], null, 2) + "\n"); }
  if (!write) {
    const strip = (value) => {
      if (Array.isArray(value)) { value.forEach(strip); return; }
      if (!value || typeof value !== "object") return;
      if (typeof value.alt === "string") { delete value.search; delete value.fetch; }
      for (const child of Object.values(value)) strip(child);
    };
    strip(spec);
  }
  return { filled: filled.length, failed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [specArg, ...flags] = process.argv.slice(2);
  if (!specArg) { console.error("Usage: fetch-pictures.mjs <id>.deck.json [--dry-run]"); process.exit(1); }
  const specPath = path.resolve(specArg);
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  if (flags.includes("--dry-run")) {
    const plan = [];
    for (const picture of picturePlaceholders(spec)) {
      const choice = await searchCommons(picture.search ?? picture.alt).catch((error) => ({ error: error.message }));
      plan.push({ alt: picture.alt, photo: choice?.page ?? null, license: choice?.license ?? null, artist: choice?.artist ?? null, ...(choice?.error ? { error: choice.error } : {}) });
    }
    console.log(JSON.stringify(plan, null, 1));
    process.exit(0);
  }
  const result = await autoFillPictures(spec, path.dirname(specPath), { write: true });
  await fs.writeFile(specPath, JSON.stringify(spec, null, 1) + "\n");
  console.log(JSON.stringify(result, null, 1));
}
