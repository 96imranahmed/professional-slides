#!/usr/bin/env node
// Place map markers by name.
//
//   node runtime/fetch-places.mjs <id>.deck.json   look up, cache in assets/places.json, write coordinates into the spec
//
// A city marker needs its longitude and latitude; typed from memory they were
// wrong often enough to put Mumbai in the middle of India. A marker may give
// `place` instead ("Riyadh", "Perth, Western Australia", "King Khalid
// International Airport") - or only its `label`, when it has no `country` and
// is not `countryLevel` - and the build reads the coordinates of that place's
// Wikipedia article. Results are cached beside the spec, so a rebuild is
// offline and a wrong match is corrected by editing assets/places.json or
// setting the marker's coordinates.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UA } from "./fetch-logos.mjs";

const API = "https://en.wikipedia.org/w/api.php";

/** Markers that name a place and carry no position of their own. */
export function markersToPlace(spec) {
  const found = [];
  const walk = (value) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value.markers)) {
      for (const marker of value.markers) {
        if (!marker || typeof marker !== "object" || marker.countryLevel) continue;
        if (Number.isFinite(marker.longitude) || Number.isFinite(marker.latitude) || Number.isFinite(marker.x) || Number.isFinite(marker.y)) continue;
        const name = marker.place ?? (marker.country ? null : marker.label);
        if (typeof name === "string" && name.trim()) found.push({ marker, name: name.trim() });
      }
    }
    for (const child of Object.values(value)) walk(child);
  };
  walk(spec);
  return found;
}

async function api(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: "json", formatversion: "2", redirects: "1", ...params })}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return res.json();
}

const coordinatesOf = (page) => {
  const c = page?.coordinates?.[0];
  return c && Number.isFinite(c.lat) && Number.isFinite(c.lon) ? { latitude: Math.round(c.lat * 1e4) / 1e4, longitude: Math.round(c.lon * 1e4) / 1e4, article: page.title } : null;
};

/** The coordinates of the article for `name`, else of the first search hit that has any. */
export async function geocode(name) {
  const direct = await api({ action: "query", prop: "coordinates", coprimary: "primary", titles: name });
  const hit = coordinatesOf(direct.query?.pages?.[0]);
  if (hit) return hit;
  const searched = await api({ action: "query", generator: "search", gsrsearch: name, gsrlimit: "3", prop: "coordinates", coprimary: "primary" });
  const pages = [...(searched.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const page of pages) { const found = coordinatesOf(page); if (found) return found; }
  return null;
}

/**
 * Give every marker that names a place its longitude and latitude, in memory:
 * cached names are offline; missing ones are looked up when `fetchMissing`.
 * `place` is removed once used, since it is not a map property.
 */
export async function autoFillPlaces(spec, baseDir, { fetchMissing = true } = {}) {
  const wanted = markersToPlace(spec);
  if (!wanted.length) return { placed: 0, failed: [] };
  const cachePath = path.join(baseDir, "assets", "places.json");
  const cache = await fs.readFile(cachePath, "utf8").then(JSON.parse).catch(() => ({}));
  let changed = false;
  const failed = [];
  let placed = 0;
  for (const { marker, name } of wanted) {
    if (!cache[name] && fetchMissing) {
      try {
        const found = await geocode(name);
        if (found) { cache[name] = found; changed = true; }
      } catch (error) { failed.push(`${name}: ${error.message}`); continue; }
    }
    const hit = cache[name];
    if (!hit) { if (fetchMissing) failed.push(`${name}: no coordinates found; set \`place\` to the article title or give longitude and latitude`); continue; }
    marker.longitude = hit.longitude; marker.latitude = hit.latitude;
    delete marker.place;
    placed += 1;
  }
  if (changed) { await fs.mkdir(path.dirname(cachePath), { recursive: true }); await fs.writeFile(cachePath, JSON.stringify(cache, null, 2) + "\n"); }
  return { placed, failed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const specArg = process.argv[2];
  if (!specArg) { console.error("Usage: fetch-places.mjs <id>.deck.json"); process.exit(1); }
  const specPath = path.resolve(specArg);
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const result = await autoFillPlaces(spec, path.dirname(specPath));
  await fs.writeFile(specPath, JSON.stringify(spec, null, 1) + "\n");
  console.log(JSON.stringify(result, null, 1));
}
