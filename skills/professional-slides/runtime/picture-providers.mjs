// Where a planned photograph is found, and whether a found file shows what was asked for.
//
// A search returns what matches its words, and the first result taken whatever it shows put an A350-900 airliner and
// an A350-900 flight-simulator cockpit on the A350F deck as "the Airbus A350F": the match ranked files newest first, and
// its words were letters only, so "A350F" never took part. A file is now taken only where it names what the search
// names: every identifying token of the search - a model, a registration, a code (A350F, 777-8F, A7-ANI), never a bare
// year - appears among its title's, description's, categories' or tags' tokens, and otherwise half its words do. The
// files that do are ranked by how much they name, then as the library ranked them. The words are the picture's own;
// nothing here judges a file by a list of words of the runtime's.
//
// The libraries are searched in order, the next only when the last named no file: Wikimedia Commons (searchCommons, in
// fetch-pictures.mjs), Openverse (Creative Commons images across Flickr and other hosts, no key), then Pexels, Unsplash
// and Pixabay where their keys are set (picture-keys.mjs). Each file comes back as one record - its licence, its maker,
// the page it is filed on and the credit the credits page prints - so the credit is written the same way whichever
// library found it. A search that names a model a stock library has never photographed stops at Commons or Openverse.
import { pictureKeys } from "./picture-keys.mjs";

const UA = "professional-slides/1.0 (https://github.com/96imranahmed/professional-slides)";
const YEAR = /^(?:19|20)\d{2}$/;

/** A text's tokens, lower case: words and codes, a code's hyphens kept inside it ("777-8f", "a350-1041"). */
const tokensOf = (text) => String(text ?? "").toLowerCase().split(/[^a-z0-9-]+/).map((t) => t.replace(/^-+|-+$/g, "")).filter(Boolean);
const compact = (token) => token.replace(/[^a-z0-9]/g, "");

/** The tokens a file can be matched on: each token compacted ("a3501041"), and each two neighbours joined ("777 8F" is "7778f"). */
export function fileTokens(text) {
  const tokens = tokensOf(text).map(compact).filter(Boolean);
  return new Set([...tokens, ...tokens.slice(1).map((token, i) => tokens[i] + token)]);
}

/** What a search asks for: its identifying tokens (letters and digits together, or a long number) and its other words. */
export function searchTerms(query) {
  const tokens = tokensOf(query);
  const identity = [...new Set(tokens.filter((t) => /\d/.test(t) && (/[a-z]/.test(t) || t.replace(/\D/g, "").length >= 3) && !YEAR.test(t)).map(compact))];
  const words = [...new Set(tokens.filter((t) => !/\d/.test(t) && t.length > 3).map(compact))];
  return { identity, words };
}

/**
 * How well a file names what the search asks for: `{ named, score }`. A file names it when every identifying token is
 * among its tokens and, for a search with none, at least half the search's words are.
 */
export function relevance(text, query) {
  const { identity, words } = searchTerms(query);
  const has = fileTokens(text);
  const ids = identity.filter((t) => has.has(t)).length;
  const hits = words.filter((w) => has.has(w)).length;
  const named = identity.length ? ids === identity.length : words.length === 0 || hits >= Math.ceil(words.length / 2);
  return { named, score: ids * 3 + hits };
}

/** The candidates that name what the search asks for, best named first, the library's own order among equals. */
export function namedCandidates(candidates, query) {
  return candidates.map((c, at) => ({ c, at, r: relevance(c.text ?? `${c.title} ${c.description ?? ""}`, query) }))
    .filter(({ r }) => r.named).sort((a, b) => b.r.score - a.r.score || a.at - b.at).map(({ c }) => c);
}

const landscape = (w, h) => w >= h * 1.15;
const credit = (artist, license, licenseUrl, library, page) => `Photo: ${artist}, ${license}${licenseUrl ? ` (${licenseUrl})` : ""}, via ${library}${page ? `: ${page}` : ""}`;
async function getJson(url, request, headers = {}) {
  const res = await request(url, { headers: { "User-Agent": UA, ...headers } });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

/** Openverse: openly licensed photographs (CC0, CC BY, CC BY-SA, public domain), at least 1200px wide, as JPEGs. */
export async function searchOpenverse(query, { fetch: request = globalThis.fetch } = {}) {
  const url = `https://api.openverse.org/v1/images/?${new URLSearchParams({ q: query, license: "by,by-sa,cc0,pdm", page_size: "20", mature: "false" })}`;
  const { results = [] } = await getJson(url, request);
  const name = (r) => (r.license === "cc0" ? "CC0 1.0" : r.license === "pdm" ? "Public Domain Mark 1.0" : `CC ${String(r.license).toUpperCase()} ${r.license_version ?? ""}`.trim());
  return results.filter((r) => (r.width ?? 0) >= 1200 && /^(jpe?g)$/i.test(r.filetype ?? (r.url ?? "").split(".").pop()))
    .map((r) => ({ provider: "openverse", title: r.title ?? "", text: [r.title, ...(r.tags ?? []).map((t) => t.name)].join(" "), url: r.url, page: r.foreign_landing_url,
      license: name(r), licenseUrl: r.license_url ?? null, artist: r.creator || "unknown author", landscape: landscape(r.width, r.height),
      credit: credit(r.creator || "unknown author", name(r), r.license_url, "Openverse", r.foreign_landing_url) }));
}

/** Pexels: the Pexels License (free to use; a credit is kept all the same). */
export async function searchPexels(query, { key, fetch: request = globalThis.fetch } = {}) {
  const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: "15", orientation: "landscape" })}`;
  const { photos = [] } = await getJson(url, request, { Authorization: key });
  const license = "Pexels License", licenseUrl = "https://www.pexels.com/license/";
  return photos.filter((p) => (p.width ?? 0) >= 1200).map((p) => ({ provider: "pexels", title: p.alt || p.url, text: `${p.alt ?? ""} ${String(p.url ?? "").split("/photo/")[1] ?? ""}`,
    url: `${p.src?.original}?auto=compress&cs=tinysrgb&w=1920`, page: p.url, license, licenseUrl, artist: p.photographer || "unknown author", landscape: landscape(p.width, p.height),
    credit: credit(p.photographer || "unknown author", license, licenseUrl, "Pexels", p.url) }));
}

/** Unsplash: the Unsplash License; a download is reported to Unsplash (`ping`), as its API terms ask. */
export async function searchUnsplash(query, { key, fetch: request = globalThis.fetch } = {}) {
  const url = `https://api.unsplash.com/search/photos?${new URLSearchParams({ query, per_page: "15", orientation: "landscape" })}`;
  const { results = [] } = await getJson(url, request, { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" });
  const license = "Unsplash License", licenseUrl = "https://unsplash.com/license";
  return results.filter((r) => (r.width ?? 0) >= 1200).map((r) => ({ provider: "unsplash", title: r.description || r.alt_description || r.links?.html,
    text: [r.description, r.alt_description, ...(r.tags ?? []).map((t) => t.title)].join(" "), url: `${r.urls?.raw}&w=1920&fm=jpg&q=85`, page: r.links?.html,
    ping: r.links?.download_location, pingHeaders: { Authorization: `Client-ID ${key}` }, license, licenseUrl, artist: r.user?.name || "unknown author", landscape: landscape(r.width, r.height),
    credit: credit(r.user?.name || "unknown author", license, licenseUrl, "Unsplash", r.links?.html) }));
}

/** Pixabay: the Pixabay Content License. */
export async function searchPixabay(query, { key, fetch: request = globalThis.fetch } = {}) {
  const url = `https://pixabay.com/api/?${new URLSearchParams({ key, q: query, image_type: "photo", orientation: "horizontal", per_page: "20", safesearch: "true" })}`;
  const { hits = [] } = await getJson(url, request);
  const license = "Pixabay Content License", licenseUrl = "https://pixabay.com/service/license-summary/";
  return hits.filter((h) => (h.imageWidth ?? 0) >= 1200).map((h) => ({ provider: "pixabay", title: h.tags, text: `${h.tags ?? ""} ${String(h.pageURL ?? "").split("/").at(-2) ?? ""}`,
    url: h.largeImageURL, page: h.pageURL, license, licenseUrl, artist: h.user || "unknown author", landscape: landscape(h.imageWidth, h.imageHeight),
    credit: credit(h.user || "unknown author", license, licenseUrl, "Pixabay", h.pageURL) }));
}

const KEYED = { pexels: searchPexels, unsplash: searchUnsplash, pixabay: searchPixabay };

/**
 * The libraries a photograph is searched in, in order: Commons (`commons`, given by the caller), Openverse, and each
 * stock library whose key is set. An illustration is Commons' alone: the others file no drawings with licence records.
 */
export function libraries({ commons, kind = "photograph", keys = pictureKeys() } = {}) {
  if (kind === "illustration") return [["commons", commons]];
  return [["commons", commons], ["openverse", searchOpenverse], ...Object.entries(KEYED).filter(([name]) => keys[name]).map(([name, search]) => [name, (q, o) => search(q, { ...o, key: keys[name].key })])];
}

/**
 * Search the libraries in order for files that name what `query` asks for: the first library that has one answers, so a
 * search Commons answers costs one request as before. The array carries what was tried: `tried` (each library and its
 * error, if it failed) and `near` (the best files that did not name it), for the message when none does.
 */
export async function searchLibraries(query, { commons, kind = "photograph", keys, fetch: request = globalThis.fetch, ...options } = {}) {
  const tried = [], near = [];
  for (const [name, search] of libraries({ commons, kind, keys })) {
    let found;
    try { found = await search(query, { ...options, kind, fetch: request }); } catch (error) { tried.push(`${name} (${error.message})`); continue; }
    tried.push(name);
    const named = namedCandidates(found, query);
    if (named.length) return Object.assign(named, { tried, near: [] });
    near.push(...found.slice(0, 3).map((c) => `${c.title} (${name})`));
  }
  return Object.assign([], { tried, near: near.slice(0, 3) });
}
