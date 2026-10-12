#!/usr/bin/env node
// Fill a deck's photograph and illustration placeholders from Wikimedia
// Commons, keeping only freely licensed files and recording who made each one.
//
//   node runtime/fetch-pictures.mjs <id>.deck.json            fetch, write assets/pictures/, fill the spec
//   node runtime/fetch-pictures.mjs <id>.deck.json --dry-run  name the file each placeholder would get
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
// fetch-logos.mjs's business. A player marked by its photograph (players.mjs)
// is fetched here, wherever its mark is planned - a logo's place included -
// once for every page that plans it; a place marked by its outline is drawn
// from the geography data and never fetched. A flag, planned from a country's
// name, is fetch-flags.mjs's.
//
// A picture planned `kind: "illustration"` - a line or flat-colour drawing
// beside the copy - is searched the same way among Commons' drawings
// (`filetype:drawing`, its SVG files), held to the same licences, taken in
// search order (a drawing's date and shape say nothing of whether it fits),
// looked at as a drawing (illustration-shows) and rendered by Commons'
// thumbnailer to a PNG 1600px wide, saved as assets/pictures/<alt>.png, its
// credit naming the illustrator. Commons and not Openverse, whose API has an
// illustration category: Openverse fills that category only where a provider
// labels its files, and it points at each file on its provider's host in the
// provider's own format, where Commons gives every drawing the licence record
// a photograph's credit is written from and a PNG rendering at a width asked
// for, through the API, the cache and the judged choice photographs already use.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { isMain, parseCli, readJson, runCli, UsageError, writeJson, writeJsonWhole } from "./cli.mjs";
import { UA, slugOf } from "./fetch-logos.mjs";
import { contentWords } from "./gates/content_gates.mjs";
import { deckStem } from "./artifact-path.mjs";
import { activeJudgements, judged, loadJudgements, recordedJudgement, withJudgements } from "./judgements.mjs";
import { playerEntries, playerPhotographs } from "./players.mjs";
import { isFlagRef } from "./flags.mjs";
import { isIllustration } from "./compose-pictures.mjs";

const COMMONS = "https://commons.wikimedia.org/w/api.php";
const FREE = /^(cc0|cc[- ]by(-sa)?(\s[\d.]+)?(\s\w+)?|public domain|pd\b|pdm|attribution(-sharealike)?)/i;
/** The file a picture is saved as in assets/pictures/: a photograph as a JPEG, an illustration as Commons renders a drawing, a PNG. */
export const pictureFile = (picture) => `${slugOf(picture.alt)}.${isIllustration(picture) ? "png" : "jpg"}`;
/**
 * Every photograph placeholder in the spec: `{ alt }` with no file, not opted
 * out, not a place's outline (drawn from the geography data, never fetched)
 * and not a logo. A logo is planned where the deck plans one - under a `logo`
 * key (a player's, a card's, a column header's), in a `logo` cell, in a
 * chart's `categoryIcons` - or as a declared player's logo named the way the
 * runtime names it ("<Name> logo"). A player marked by its photograph
 * (players.mjs) is a photograph wherever it is planned, a logo's place
 * included: its own `image` in `players`, and every page's mark of it, which
 * share its `alt` and so one file.
 */
export function picturePlaceholders(spec) {
  const players = playerEntries(spec?.players).map((entry) => entry.name);
  const logos = new Set(players.map((name) => `${name} logo`.toLowerCase()));
  const photographs = playerPhotographs(spec?.players);
  const found = [];
  const walk = (value, inLogo) => {
    if (Array.isArray(value)) { value.forEach((child) => walk(child, inLogo)); return; }
    if (!value || typeof value !== "object") return;
    const alt = String(value.alt ?? "").trim().toLowerCase();
    const logo = !photographs.has(alt) && (inLogo || value.type === "logo" || logos.has(alt));
    if (!logo && !value.outline && !isFlagRef(value) && typeof value.alt === "string" && value.alt.trim() && !value.path && !value.dataUri && value.fetch !== false) found.push(value);
    for (const [key, child] of Object.entries(value)) walk(child, logo || key === "logo" || key === "categoryIcons");
  };
  walk(spec, false);
  return found;
}

const stripHtml = (html) => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

/**
 * A Commons file's licence and maker, read off its `extmetadata`: the
 * licence's short name and link, the artist, and whether the deck may use it
 * - CC0, CC BY, CC BY-SA or the public domain, not non-commercial or
 * no-derivatives, not marked non-free. A file Commons records under no
 * licence is not free.
 */
export function commonsLicence(meta = {}) {
  const license = stripHtml(meta.LicenseShortName?.value);
  return { license, licenseUrl: meta.LicenseUrl?.value ?? null, artist: stripHtml(meta.Artist?.value).slice(0, 80) || "unknown author",
    free: FREE.test(license) && !/\b(nc|nd)\b/i.test(license) && meta.NonFree?.value !== "true" };
}

/**
 * The credit a Commons file carries: what it is ("Photo", "Illustration",
 * "Flag"), who made it, the licence and the links a reader needs to trace the
 * file and its licence - the credits page prints it as it is.
 */
export const commonsCredit = (what, { artist, license, licenseUrl, page }) =>
  `${what}: ${artist}, ${license}${licenseUrl ? ` (${licenseUrl})` : ""}, via Wikimedia Commons${page ? `: ${page}` : ""}`;

/**
 * The freely licensed candidates among Commons search results (pages in
 * search order, each with `imageinfo`), in the order the fetch looks at them:
 * the latest dated first, landscape before portrait among equals, then in
 * search order; undated after dated. A file another picture holds
 * (`exclude`), one dated before `after` and one naming a word of `without` are
 * left out. With `kind: "illustration"` the candidates are drawings - SVG
 * files, which Commons renders at any width, so no width floor - in search
 * order. Pure, so it is tested offline.
 */
export function commonsCandidates(pages, { exclude = new Set(), after = null, without = [], kind = "photograph" } = {}) {
  const shunned = without.flatMap((word) => [...contentWords(word)]);
  const drawing = kind === "illustration";
  const ok = [];
  for (const page of [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    if (!info || (drawing ? info.mime !== "image/svg+xml" : info.mime !== "image/jpeg" || info.width < 1200)) continue;
    const licence = commonsLicence(meta);
    if (!licence.free) continue;
    if (exclude.has(page.title)) continue;
    const taken = Number(/\b(?:19|20)\d{2}\b/.exec(stripHtml(meta.DateTimeOriginal?.value ?? meta.DateTime?.value ?? ""))?.[0] ?? NaN);
    if (Number.isFinite(after) && Number.isFinite(taken) && taken < after) continue;
    const description = stripHtml(meta.ImageDescription?.value).slice(0, 300);
    const named = contentWords([page.title, description, stripHtml(meta.Categories?.value), stripHtml(meta.ObjectName?.value)].join(" "));
    if (shunned.some((word) => named.has(word))) continue;
    const { license, licenseUrl, artist } = licence;
    ok.push({
      title: page.title, landscape: info.width >= info.height * 1.15, description, ...(Number.isFinite(taken) && !drawing ? { year: taken } : {}),
      ...(drawing ? { kind } : {}),
      url: info.thumburl || info.url, page: info.descriptionurl, license, licenseUrl, artist,
      credit: commonsCredit(drawing ? "Illustration" : "Photo", { artist, license, licenseUrl, page: info.descriptionurl }),
    });
  }
  if (drawing) return ok;
  return ok.map((c, at) => ({ c, at })).sort((a, b) => (b.c.year ?? -Infinity) - (a.c.year ?? -Infinity) || Number(b.c.landscape) - Number(a.c.landscape) || a.at - b.at).map(({ c }) => c);
}

// The candidates looked at in one run before the rest wait on their answers: the first of a ranked list usually shows the subject.
export const PREVIEWS_AT_ONCE = 4;
/** What the question about a candidate is asked of: what the picture is to show, and the file's own title and description. */
export const pictureQuestion = (picture, candidate) => ({ asked: String(picture.alt).trim(), file: candidate.title, description: candidate.description ?? "" });

// The question a candidate is asked: whether a photograph shows the subject (picture-shows), or whether a drawing does
// (illustration-shows) - a drawing is exactly what the first question turns away.
const shows = (picture) => (isIllustration(picture)
  ? { recorded: (question) => recordedJudgement("illustration-shows", question), ask: (question, image) => judged("illustration-shows", question, null, picture.alt, { image }) }
  : { recorded: (question) => recordedJudgement("picture-shows", question), ask: (question, image) => judged("picture-shows", question, null, picture.alt, { image }) });

/**
 * The candidate a picture takes: the first, in rank order, judged to show
 * what the picture is planned to show (picture-shows; illustration-shows for
 * a drawing). One not yet judged is fetched as a preview (`preview(candidate)`,
 * a local file) and asked about, and none after it is taken until it is
 * answered, so the choice does not turn on the order the answers came in.
 * `{ choice, waiting }`: `waiting`, how many candidates before any choice are
 * still to be answered.
 */
export async function judgedChoice(candidates, picture, { preview = null } = {}) {
  let waiting = 0;
  const asking = shows(picture);
  for (const candidate of candidates) {
    const question = pictureQuestion(picture, candidate);
    const said = asking.recorded(question);
    if (said?.verdict === "shows" && !waiting) return { choice: candidate, waiting };
    if (said) continue;
    // A preview that cannot be fetched cannot be looked at: the candidate is passed over. With nothing to fetch it with
    // (the dry run), it still stands before the ones after it.
    if (preview && activeJudgements()) {
      const image = await preview(candidate).catch(() => null);
      if (!image) continue;
      asking.ask(question, image);
    }
    waiting += 1;
    if (waiting >= PREVIEWS_AT_ONCE) break;
  }
  return { choice: null, waiting };
}

/** The Commons search for a picture's words: twelve files of its kind, with their sizes, licences and renderings 1600px wide. */
export function commonsSearchUrl(query, kind = "photograph") {
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", generator: "search", gsrnamespace: "6",
    // A photograph is a bitmap; an illustration a drawing, which Commons keeps as SVG and renders to a PNG at the width asked.
    gsrsearch: `${query} filetype:${kind === "illustration" ? "drawing" : "bitmap"}`, gsrlimit: "12", prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600", iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|ObjectName|NonFree|ImageDescription|Categories|DateTimeOriginal|DateTime",
  });
  return `${COMMONS}?${params}`;
}

/** The candidates a Commons search returns for `query`, of the picture's `kind`; `fetch` is the network, given in a test. */
export async function searchCommons(query, { fetch: request = globalThis.fetch, ...options } = {}) {
  const res = await request(commonsSearchUrl(query, options.kind), { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return commonsCandidates((await res.json()).query?.pages ?? [], options);
}

/** What a placeholder is searched by and held to: its search words, its kind, the year and the words it excludes. */
const askOf = (picture) => ({ query: picture.search ?? picture.alt,
  options: { ...(isIllustration(picture) ? { kind: "illustration" } : {}), ...(Number.isFinite(Number(picture.after)) ? { after: Number(picture.after) } : {}), ...(Array.isArray(picture.without) ? { without: picture.without.map(String) } : {}) } });

/**
 * The photograph each placeholder takes, in the deck's order: the dry run and
 * the fetch both read this, so the one names what the other downloads. A file
 * a placeholder takes is passed over for the ones after it, and so is one the
 * records hold for another picture of the deck. `{ chosen, waiting }`:
 * `waiting`, the candidates fetched as previews to be judged before a choice.
 */
export async function choosePictures(placeholders, { records = new Map(), search = searchCommons, preview = null, fetch: request = null } = {}) {
  const taken = new Set([...records.values()].map((r) => r.title).filter(Boolean));
  const chosen = new Map(), asked = new Map();
  let waiting = 0;
  for (const picture of placeholders) {
    // One photograph planned on several pages - a player's mark, by its `alt` and search words - is one choice and one file.
    const same = JSON.stringify([picture.alt, picture.search ?? null]);
    if (asked.has(same)) { chosen.set(picture, chosen.get(asked.get(same))); continue; }
    asked.set(same, picture);
    const ask = askOf(picture), own = records.get(picture.alt)?.title;
    const exclude = new Set([...taken].filter((title) => title !== own));
    const found = await judgedChoice(await search(ask.query, { ...ask.options, exclude, ...(request ? { fetch: request } : {}) }), picture, { preview });
    chosen.set(picture, found.choice);
    waiting += found.waiting;
    if (found.choice?.title) taken.add(found.choice.title);
  }
  return { chosen, waiting };
}

// A drawing's preview is the PNG Commons renders of it; a photograph's, a JPEG.
const previewName = (candidate) => `${createHash("sha256").update(candidate.title).digest("hex").slice(0, 16)}.${candidate.kind === "illustration" ? "png" : "jpg"}`;
/** A candidate's preview, fetched once into assets/pictures/candidates/ and kept for the packet and the choice. */
const previewer = (directory, request) => async (candidate) => {
  const file = path.join(directory, "candidates", previewName(candidate));
  if (await fs.access(file).then(() => true, () => false)) return file;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await download(candidate, file, request);
  return file;
};

const PNG_SIGNATURE = "89504e470d0a1a0a";
async function download(choice, file, request = globalThis.fetch) {
  // A candidate looked at as a preview is the file taken: it is not fetched twice.
  const preview = path.join(path.dirname(file), "candidates", previewName(choice));
  if (path.basename(path.dirname(file)) !== "candidates" && await fs.copyFile(preview, file).then(() => true, () => false)) return;
  const res = await request(choice.url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  // A drawing comes back as Commons' rendering of it: anything but a PNG is an error page or the SVG itself, which a deck cannot embed.
  if (choice.kind === "illustration" && bytes.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) throw new Error(`the rendering of ${choice.title} is not a PNG`);
  await fs.writeFile(file, bytes);
}

const recordsPath = (directory) => path.join(directory, "sources.json");
async function readRecords(directory) {
  return new Map(((await readJson(recordsPath(directory), { optional: true })) ?? []).map((r) => [r.alt, r]));
}

/**
 * Fill the spec's photograph and illustration placeholders in memory, for the
 * build: a file already in assets/pictures/ is reused offline; a missing one
 * is fetched when `fetchMissing`. `search` and `fetch` are removed from every
 * picture, since they steer this step and are not picture properties; `kind`
 * stays, since an illustration is drawn whole where a photograph is cropped.
 * The `fetch` option is the network, given in a test.
 */
export async function autoFillPictures(spec, baseDir, { fetchMissing = true, write = false, fetch: request = globalThis.fetch } = {}) {
  const placeholders = picturePlaceholders(spec);
  const directory = path.join(baseDir, "assets", "pictures");
  const records = await readRecords(directory);
  const filled = [], failed = [];
  const state = new Map();
  for (const picture of placeholders) {
    const file = path.join(directory, pictureFile(picture));
    const known = records.get(picture.alt);
    const exists = await fs.access(file).then(() => true, () => false);
    // A photograph fetched for other search words is not the one asked for now: re-searched where the network is allowed.
    const searched = exists && known && fetchMissing && (known.search ?? null) !== (picture.search ?? null);
    state.set(picture, { file, known, exists, fetch: !exists || searched });
  }
  // Chosen together, in order, so no two pictures of the deck take one file (choosePictures).
  const wanted = fetchMissing ? placeholders.filter((picture) => state.get(picture).fetch) : [];
  let chosen = new Map(), waiting = 0;
  try { ({ chosen, waiting } = await choosePictures(wanted, { records, preview: previewer(directory, request), fetch: request })); } catch (error) { for (const picture of wanted) failed.push(`${picture.alt}: ${error.message}`); }
  // A photograph several pages plan (a player's mark) is chosen once (choosePictures) and downloaded once.
  const downloaded = new Map();
  for (const picture of placeholders) {
    const { file, known, exists, fetch: fetching } = state.get(picture);
    try {
      if (fetching) {
        if (!fetchMissing || !chosen.has(picture)) continue;
        const choice = chosen.get(picture);
        const noun = isIllustration(picture) ? "illustration" : "photograph";
        if (!choice) { failed.push(waiting ? `${picture.alt}: its candidate ${noun}s are to be looked at first (judge.mjs <pages> --fetch-assets)` : `${picture.alt}: no freely licensed ${noun} among the search's results shows what it is planned to show; set \`search\` to ${isIllustration(picture) ? "the words a drawing of it would be filed under" : "the place's own name"}, or supply the file`); continue; }
        await fs.mkdir(directory, { recursive: true });
        if (downloaded.get(file) !== choice) await download(choice, file, request);
        downloaded.set(file, choice);
        const { url, landscape, ...record } = choice;
        records.set(picture.alt, { alt: picture.alt, search: picture.search ?? null, ...record, source: url, saved: path.relative(baseDir, file) });
      } else if (!exists) continue;
      picture.path = path.relative(baseDir, file);
      picture.credit = picture.credit ?? records.get(picture.alt)?.credit ?? known?.credit ?? `${isIllustration(picture) ? "Illustration" : "Photo"}: ${picture.alt}`;
      filled.push(picture.alt);
    } catch (error) { failed.push(`${picture.alt}: ${error.message}`); }
  }
  // Written only when the records change, and whole: every run reads them, and section writers run side by side.
  if (records.size && JSON.stringify([...records.values()]) !== JSON.stringify([...(await readRecords(directory)).values()])) {
    await fs.mkdir(directory, { recursive: true });
    await writeJsonWhole(recordsPath(directory), [...records.values()]);
  }
  if (!write) {
    const strip = (value) => {
      if (Array.isArray(value)) { value.forEach(strip); return; }
      if (!value || typeof value !== "object") return;
      if (typeof value.alt === "string") { delete value.search; delete value.fetch; delete value.after; delete value.without; }
      for (const child of Object.values(value)) strip(child);
    };
    strip(spec);
  }
  return { filled: filled.length, failed: [...new Set(failed)], ...(waiting ? { waiting } : {}) };
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
        return { alt: picture.alt, ...(isIllustration(picture) ? { kind: "illustration", illustration: choice?.page ?? null } : { photo: choice?.page ?? null }),
          license: choice?.license ?? null, artist: choice?.artist ?? null, ...(choice?.year ? { year: choice.year } : {}) }; }), null, 1));
      return;
    }
    const result = await autoFillPictures(spec, path.dirname(specPath), { write: true });
    await writeJson(specPath, spec);
    console.log(JSON.stringify(result, null, 1));
    if (session.pending.size) console.error(`${session.pending.size} candidate picture${session.pending.size === 1 ? " is" : "s are"} to be looked at before ${session.pending.size === 1 ? "it" : "they"} can be taken: run node runtime/judge.mjs <id>.pages.json --fetch-assets, then fetch again.`);
  });
}

if (isMain(import.meta.url)) runCli(main);
