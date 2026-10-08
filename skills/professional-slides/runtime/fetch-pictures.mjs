#!/usr/bin/env node
// Fill a deck's photograph placeholders from Wikimedia Commons, keeping only
// freely licensed photographs and recording who took each one.
//
//   node runtime/fetch-pictures.mjs <id>.deck.json            fetch, write assets/pictures/, fill the spec
//   node runtime/fetch-pictures.mjs <id>.deck.json --dry-run  name the photograph each placeholder would get
//
// A picture planned as `{ alt: "what it shows" }` - the cover image, a divider
// image, a page `photo`, a photo cell - is searched on Commons by its `search`
// (else its alt text). The results that are JPEG files at least 1200px wide,
// under CC0, CC BY, CC BY-SA or the public domain, are ranked - the latest
// dated first, landscape before portrait among equals, then in search order -
// and the first that shows what the picture is planned to show is taken: each
// is looked at (picture-shows, judgements.mjs), since a search returns what
// matches its words, and a file's name says neither whether it is a
// photograph nor what of. A candidate not yet looked at is fetched as a
// preview (assets/pictures/candidates/) and asked about, a few at a time, and
// none after it is taken until it is answered: `judge.mjs <pages>
// --fetch-assets` stages the previews for a model to look at. The picture
// gets its `path` and a `credit` naming author and licence, which CC BY and
// CC BY-SA require the deck to show. A picture that must come from the client
// is marked `fetch: false` and stays a placeholder. A photograph is used once
// a deck: a file another picture of the deck took is passed over for the
// next. `after: 2019` on a picture takes none dated before that year (an
// aircraft in a livery retired since), and `without: ["Ataturk"]` none naming
// those words (a lounge at another airport of the same city). The dry run
// names the photograph the fetch would take, by the same choice in the same
// order. A logo - planned under a `logo` key, in a logo cell or a chart's
// category marks, or as a declared player's "<Name> logo" - is
// fetch-logos.mjs's business.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { UA, slugOf } from "./fetch-logos.mjs";
import { contentWords } from "./gates/content_gates.mjs";
import { deckStem } from "./artifact-path.mjs";
import { activeJudgements, judged, loadJudgements, recordedJudgement, withJudgements } from "./judgements.mjs";

const COMMONS = "https://commons.wikimedia.org/w/api.php";
const FREE = /^(cc0|cc[- ]by(-sa)?(\s[\d.]+)?(\s\w+)?|public domain|pd\b|pdm|attribution(-sharealike)?)/i;
/**
 * Every photograph placeholder in the spec: `{ alt }` with no file, not opted
 * out, and not a logo. A logo is planned where the deck plans one - under a
 * `logo` key (a player's, a card's, a column header's), in a `logo` cell, in a
 * chart's `categoryIcons` - or as a declared player's logo named the way the
 * runtime names it ("<Name> logo").
 */
export function picturePlaceholders(spec) {
  const players = (spec?.players || []).map((p) => (typeof p === "string" ? p : p?.name)).filter(Boolean);
  const logos = new Set(players.map((name) => `${name} logo`.toLowerCase()));
  const found = [];
  const walk = (value, inLogo) => {
    if (Array.isArray(value)) { value.forEach((child) => walk(child, inLogo)); return; }
    if (!value || typeof value !== "object") return;
    const logo = inLogo || value.type === "logo" || logos.has(String(value.alt ?? "").trim().toLowerCase());
    if (!logo && typeof value.alt === "string" && value.alt.trim() && !value.path && !value.dataUri && value.fetch !== false) found.push(value);
    for (const [key, child] of Object.entries(value)) walk(child, logo || key === "logo" || key === "categoryIcons");
  };
  walk(spec, false);
  return found;
}

const stripHtml = (html) => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

/**
 * The freely licensed candidates among Commons search results (pages in
 * search order, each with `imageinfo`), in the order the fetch looks at them:
 * the latest dated first, landscape before portrait among equals, then in
 * search order; undated after dated. A file another picture holds
 * (`exclude`), one dated before `after` and one naming a word of `without` are
 * left out. Pure, so it is tested offline.
 */
export function commonsCandidates(pages, { exclude = new Set(), after = null, without = [] } = {}) {
  const shunned = without.flatMap((word) => [...contentWords(word)]);
  const ok = [];
  for (const page of [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value);
    if (!info || info.mime !== "image/jpeg" || info.width < 1200) continue;
    if (!FREE.test(license) || /\b(nc|nd)\b/i.test(license) || meta.NonFree?.value === "true") continue;
    if (exclude.has(page.title)) continue;
    const taken = Number(/\b(?:19|20)\d{2}\b/.exec(stripHtml(meta.DateTimeOriginal?.value ?? meta.DateTime?.value ?? ""))?.[0] ?? NaN);
    if (Number.isFinite(after) && Number.isFinite(taken) && taken < after) continue;
    const artist = stripHtml(meta.Artist?.value).slice(0, 80) || "unknown author";
    const description = stripHtml(meta.ImageDescription?.value).slice(0, 300);
    const named = contentWords([page.title, description, stripHtml(meta.Categories?.value), stripHtml(meta.ObjectName?.value)].join(" "));
    if (shunned.some((word) => named.has(word))) continue;
    ok.push({
      title: page.title, landscape: info.width >= info.height * 1.15, description, ...(Number.isFinite(taken) ? { year: taken } : {}),
      url: info.thumburl || info.url, page: info.descriptionurl, license, licenseUrl: meta.LicenseUrl?.value ?? null, artist,
      // The credits page prints this string, so it carries the links a reader
      // needs to trace the file and its licence.
      credit: `Photo: ${artist}, ${license}${meta.LicenseUrl?.value ? ` (${meta.LicenseUrl.value})` : ""}, via Wikimedia Commons${info.descriptionurl ? `: ${info.descriptionurl}` : ""}`,
    });
  }
  return ok.map((c, at) => ({ c, at })).sort((a, b) => (b.c.year ?? -Infinity) - (a.c.year ?? -Infinity) || Number(b.c.landscape) - Number(a.c.landscape) || a.at - b.at).map(({ c }) => c);
}

// The candidates looked at in one run before the rest wait on their answers: the first of a ranked list usually shows the subject.
export const PREVIEWS_AT_ONCE = 4;
/** What the question about a candidate is asked of: what the picture is to show, and the file's own title and description. */
export const pictureQuestion = (picture, candidate) => ({ asked: String(picture.alt).trim(), file: candidate.title, description: candidate.description ?? "" });

/**
 * The candidate a picture takes: the first, in rank order, judged to show
 * what the picture is planned to show (picture-shows). One not yet judged is
 * fetched as a preview (`preview(candidate)`, a local file) and asked about,
 * and none after it is taken until it is answered, so the choice does not turn
 * on the order the answers came in. `{ choice, waiting }`: `waiting`, how many
 * candidates before any choice are still to be answered.
 */
export async function judgedChoice(candidates, picture, { preview = null } = {}) {
  let waiting = 0;
  for (const candidate of candidates) {
    const question = pictureQuestion(picture, candidate);
    const said = recordedJudgement("picture-shows", question);
    if (said?.verdict === "shows" && !waiting) return { choice: candidate, waiting };
    if (said) continue;
    // A preview that cannot be fetched cannot be looked at: the candidate is passed over. With nothing to fetch it with
    // (the dry run), it still stands before the ones after it.
    if (preview && activeJudgements()) {
      const image = await preview(candidate).catch(() => null);
      if (!image) continue;
      judged("picture-shows", question, null, picture.alt, { image });
    }
    waiting += 1;
    if (waiting >= PREVIEWS_AT_ONCE) break;
  }
  return { choice: null, waiting };
}

export async function searchCommons(query, options = {}) {
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", generator: "search", gsrnamespace: "6",
    gsrsearch: `${query} filetype:bitmap`, gsrlimit: "12", prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600", iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|ObjectName|NonFree|ImageDescription|Categories|DateTimeOriginal|DateTime",
  });
  const res = await fetch(`${COMMONS}?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return commonsCandidates((await res.json()).query?.pages ?? [], options);
}

/** What a placeholder is searched by and held to: its search words, the year and the words it excludes. */
const askOf = (picture) => ({ query: picture.search ?? picture.alt,
  options: { ...(Number.isFinite(Number(picture.after)) ? { after: Number(picture.after) } : {}), ...(Array.isArray(picture.without) ? { without: picture.without.map(String) } : {}) } });

/**
 * The photograph each placeholder takes, in the deck's order: the dry run and
 * the fetch both read this, so the one names what the other downloads. A file
 * a placeholder takes is passed over for the ones after it, and so is one the
 * records hold for another picture of the deck. `{ chosen, waiting }`:
 * `waiting`, the candidates fetched as previews to be judged before a choice.
 */
export async function choosePictures(placeholders, { records = new Map(), search = searchCommons, preview = null } = {}) {
  const taken = new Set([...records.values()].map((r) => r.title).filter(Boolean));
  const chosen = new Map();
  let waiting = 0;
  for (const picture of placeholders) {
    const ask = askOf(picture), own = records.get(picture.alt)?.title;
    const exclude = new Set([...taken].filter((title) => title !== own));
    const found = await judgedChoice(await search(ask.query, { ...ask.options, exclude }), picture, { preview });
    chosen.set(picture, found.choice);
    waiting += found.waiting;
    if (found.choice?.title) taken.add(found.choice.title);
  }
  return { chosen, waiting };
}

const previewName = (candidate) => `${createHash("sha256").update(candidate.title).digest("hex").slice(0, 16)}.jpg`;
/** A candidate's preview, fetched once into assets/pictures/candidates/ and kept for the packet and the choice. */
const previewer = (directory) => async (candidate) => {
  const file = path.join(directory, "candidates", previewName(candidate));
  if (await fs.access(file).then(() => true, () => false)) return file;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await download(candidate, file);
  return file;
};

async function download(choice, file) {
  // A candidate looked at as a preview is the file taken: it is not fetched twice.
  const preview = path.join(path.dirname(file), "candidates", previewName(choice));
  if (path.basename(path.dirname(file)) !== "candidates" && await fs.copyFile(preview, file).then(() => true, () => false)) return;
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
  let chosen = new Map(), waiting = 0;
  try { ({ chosen, waiting } = await choosePictures(wanted, { records, preview: previewer(directory) })); } catch (error) { for (const picture of wanted) failed.push(`${picture.alt}: ${error.message}`); }
  for (const picture of placeholders) {
    const { file, known, exists, fetch: fetching } = state.get(picture);
    try {
      if (fetching) {
        if (!fetchMissing || !chosen.has(picture)) continue;
        const choice = chosen.get(picture);
        if (!choice) { failed.push(waiting ? `${picture.alt}: its candidate photographs are to be looked at first (judge.mjs <pages> --fetch-assets)` : `${picture.alt}: no freely licensed photograph among the search's results shows what it is planned to show; set \`search\` to the place's own name, or supply the file`); continue; }
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
  return { filled: filled.length, failed, ...(waiting ? { waiting } : {}) };
}

const USAGE = "Usage: fetch-pictures.mjs <id>.deck.json [--dry-run]";

async function main(argv) {
  const { values, positionals: [specArg] } = parseCli(argv, { "dry-run": { type: "boolean" } }, { usage: USAGE });
  if (!specArg) throw new UsageError(USAGE);
  const specPath = path.resolve(specArg);
  const spec = await readJson(specPath);
  // Which candidate shows the subject is read off the deck's recorded judgements, as the build reads it.
  const session = await loadJudgements(path.dirname(specPath), deckStem(spec));
  return withJudgements(session, async () => {
    const directory = path.join(path.dirname(specPath), "assets", "pictures");
    if (values["dry-run"]) {
      // The choice the fetch makes, in the order it makes it: the records of the files already fetched count as taken.
      const placeholders = picturePlaceholders(spec);
      const { chosen } = await choosePictures(placeholders, { records: await readRecords(directory) });
      console.log(JSON.stringify(placeholders.map((picture) => { const choice = chosen.get(picture);
        return { alt: picture.alt, photo: choice?.page ?? null, license: choice?.license ?? null, artist: choice?.artist ?? null, ...(choice?.year ? { year: choice.year } : {}) }; }), null, 1));
      return;
    }
    const result = await autoFillPictures(spec, path.dirname(specPath), { write: true });
    await writeJson(specPath, spec);
    console.log(JSON.stringify(result, null, 1));
    if (session.pending.size) console.error(`${session.pending.size} candidate photograph${session.pending.size === 1 ? " is" : "s are"} to be looked at before ${session.pending.size === 1 ? "it" : "they"} can be taken: run node runtime/judge.mjs <id>.pages.json --fetch-assets, then fetch again.`);
  });
}

if (isMain(import.meta.url)) runCli(main);
