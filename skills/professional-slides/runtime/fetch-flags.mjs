#!/usr/bin/env node
// Fetch the national flags a deck's pages name, so a country's bar or row
// carries its flag without the author finding the file.
//
//   node runtime/fetch-flags.mjs <id>.deck.json            fetch, write assets/flags/, fill the spec
//   node runtime/fetch-flags.mjs <id>.deck.json --dry-run  name the Commons file each flag would come from
//
// The compile plans a flag a page names - `flag: "France"`, or "FR" or "FRA" -
// as the picture `{ flag: "FRA", alt: "Flag of France" }` (flags.mjs). Its
// file is the one Wikimedia Commons keeps as "Flag of <country>.svg": chosen
// by its name, not searched, so there is nothing to look at before it is
// taken. Commons' thumbnailer renders it to a PNG FLAG_WIDTH pixels wide - a
// deck embeds PNG or JPEG, not SVG - which is saved as assets/flags/<code>.png
// beside the deck, with the file's licence, author and page in
// assets/flags/sources.json, the way a fetched logo's or photograph's are. A
// later build reuses the file without the network. National flags on Commons
// are almost all in the public domain; one whose page records no licence, or
// a licence that is not free, is refused, and the page keeps the empty
// flag-shaped slot UNSOURCED_PICTURE holds until the file is supplied.
import fs from "node:fs/promises";
import path from "node:path";
import { UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { UA } from "./fetch-logos.mjs";
import { commonsCredit, commonsLicence } from "./fetch-pictures.mjs";
import { flagAlt, flagCommonsTitle, flagCountry, flagFile, flagRefs, unknownFlag } from "./flags.mjs";

const COMMONS = "https://commons.wikimedia.org/w/api.php";
// Wide enough for a flag set at twice the height of a table row's line, and
// small enough that a deck of thirty flags stays light.
export const FLAG_WIDTH = 330;
const PNG_SIGNATURE = "89504e470d0a1a0a";

/** The Commons query for a country's flag: the file by its title, redirects followed, with its licence, author and a PNG rendering FLAG_WIDTH wide. */
export function flagRequest(country) {
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", titles: flagCommonsTitle(country), redirects: "1", prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata", iiurlwidth: String(FLAG_WIDTH), iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|NonFree",
  });
  return `${COMMONS}?${params}`;
}

/**
 * The answer to flagRequest, read: the flag's Commons file, its rendering,
 * licence, author and credit - or `error`, why it cannot be taken: Commons
 * has no such file, records no licence for it, holds it under a licence that
 * is not free, or gives no rendering of it. Pure, so it is tested offline.
 */
export function flagRecord(answer, country) {
  const page = answer?.query?.pages?.[0], info = page?.imageinfo?.[0];
  if (!page || page.missing || page.invalid || !info) return { error: `Commons has no ${flagCommonsTitle(country)}` };
  const { license, licenseUrl, artist, free } = commonsLicence(info.extmetadata);
  if (!license) return { error: `Commons records no licence for ${page.title}, so the deck cannot say it may use it` };
  if (!free) return { error: `${page.title} is under ${license}, which is not a free licence` };
  if (!info.thumburl) return { error: `Commons gave no rendering of ${page.title}` };
  return { flag: country.id, country: country.name, title: page.title, page: info.descriptionurl ?? null, license, licenseUrl, artist,
    source: info.thumburl, credit: commonsCredit("Flag", { artist, license, licenseUrl, page: info.descriptionurl }) };
}

/**
 * A country's flag fetched into `directory`: the record read from Commons and
 * the PNG its thumbnailer renders, checked to be one. `{ ...record, path }`,
 * or `{ country, error }`. `fetch` is the network, given in a test.
 */
export async function fetchFlag(country, directory, { fetch: request = globalThis.fetch } = {}) {
  const res = await request(flagRequest(country), { headers: { "User-Agent": UA } });
  if (!res.ok) return { country: country.name, error: `Commons API ${res.status}` };
  const record = flagRecord(await res.json(), country);
  if (record.error) return { country: country.name, error: record.error };
  const image = await request(record.source, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!image.ok) return { country: country.name, error: `download ${image.status}` };
  const bytes = Buffer.from(await image.arrayBuffer());
  if (bytes.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) return { country: country.name, error: `the rendering of ${record.title} is not a PNG` };
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, path.basename(flagFile(country)));
  await fs.writeFile(file, bytes);
  return { ...record, path: file };
}

const recordsPath = (directory) => path.join(directory, "sources.json");
const exists = (file) => fs.access(file).then(() => true, () => false);

/**
 * Fill the spec's planned flags in memory, for the build: a flag already in
 * assets/flags/ is reused without the network, with the credit its record
 * keeps; a missing one is fetched when `fetchMissing`, and its record kept in
 * assets/flags/sources.json; one that cannot be had stays planned, for the
 * page's empty slot and UNSOURCED_PICTURE, and is named in `failed`.
 */
export async function autoFillFlags(spec, baseDir, { fetchMissing = true, fetch: request = globalThis.fetch } = {}) {
  const refs = flagRefs(spec).filter((ref) => !ref.path && !ref.dataUri);
  if (!refs.length) return { filled: 0, fetched: [], failed: [] };
  const directory = path.join(baseDir, "assets", "flags");
  const records = new Map(((await readJson(recordsPath(directory), { optional: true })) ?? []).map((record) => [record.flag, record]));
  const found = new Map(), fetched = [], failed = [];
  for (const code of new Set(refs.map((ref) => String(ref.flag)))) {
    const country = flagCountry(code);
    if (!country) { failed.push(`${code}: ${unknownFlag(code)}`); continue; }
    const file = path.join(baseDir, flagFile(country));
    if (await exists(file)) { found.set(code, { file, credit: records.get(country.id)?.credit ?? flagAlt(country) }); continue; }
    if (!fetchMissing) continue;
    try {
      const got = await fetchFlag(country, directory, { fetch: request });
      if (got.error) { failed.push(`${country.name}: ${got.error}`); continue; }
      const { path: saved, ...record } = got;
      records.set(country.id, { ...record, saved: path.relative(baseDir, saved) });
      found.set(code, { file: saved, credit: record.credit });
      fetched.push(country.name);
    } catch (error) { failed.push(`${country.name}: ${error.message}`); }
  }
  if (fetched.length) await writeJson(recordsPath(directory), [...records.values()]);
  let filled = 0;
  for (const ref of refs) {
    const got = found.get(String(ref.flag));
    if (!got) continue;
    ref.path = path.relative(baseDir, got.file);
    ref.credit = ref.credit ?? got.credit;
    filled += 1;
  }
  return { filled, fetched, failed };
}

const USAGE = "Usage: fetch-flags.mjs <id>.deck.json [--dry-run]";

async function main(argv) {
  const { values, positionals: [specArg] } = parseCli(argv, { "dry-run": { type: "boolean" } }, { usage: USAGE });
  if (!specArg) throw new UsageError(USAGE);
  const specPath = path.resolve(specArg), baseDir = path.dirname(specPath);
  const spec = await readJson(specPath);
  if (values["dry-run"]) {
    // A flag's file is named by its country, so the dry run needs no network: each flag, its Commons file and where it is saved.
    const countries = [...new Set(flagRefs(spec).map((ref) => String(ref.flag)))].map((code) => [code, flagCountry(code)]);
    console.log(JSON.stringify(await Promise.all(countries.map(async ([code, country]) => (country
      ? { flag: country.id, country: country.name, commons: flagCommonsTitle(country), file: flagFile(country), onDisk: await exists(path.join(baseDir, flagFile(country))) }
      : { flag: code, error: unknownFlag(code) }))), null, 1));
    return;
  }
  const result = await autoFillFlags(spec, baseDir);
  await writeJson(specPath, spec);
  console.log(JSON.stringify(result, null, 1));
}

if (isMain(import.meta.url)) runCli(main);
