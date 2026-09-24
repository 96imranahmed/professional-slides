#!/usr/bin/env node
// Fetch the logos of a deck's declared players, so a players page never ships
// with empty boxes.
//
//   node runtime/fetch-logos.mjs <id>.deck.json            fetch, write assets/logos/, fill the spec
//   node runtime/fetch-logos.mjs <id>.deck.json --dry-run  report what would be fetched
//   node runtime/fetch-logos.mjs <id>.deck.json --hint airline   steer ambiguous names
//
// For each entry in `players` whose logo is still `{ alt }`, the script finds
// the player's Wikipedia article (the entry's `wikipedia` title, or a search on
// its name plus `logoHint`), reads the logo file named in the article's
// infobox, and downloads a 512px PNG rendering of it. Every `{ alt: "<name>
// logo" }` in the spec - player entries, chart category icons, table logo
// cells - then gets the file's `path` and a `credit` naming its source page.
// Logos are trademarks: the credit records where the file came from; whether
// the deck may use it is the author's call, as for any picture.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const UA = "professional-slides/1.0 (deck logo fetch; https://www.mediawiki.org/wiki/API:Etiquette)";
const API = "https://en.wikipedia.org/w/api.php";

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return res.json();
}

/** Candidate articles for a player: an explicit title, or the top search hits. */
export async function articlesFor(player, hint) {
  if (player.wikipedia) return [player.wikipedia];
  const query = [player.name, player.logoHint ?? hint].filter(Boolean).join(" ");
  const found = await api({ action: "query", list: "search", srsearch: query, srlimit: "5" });
  return (found.query?.search || []).map((hit) => hit.title);
}

/** The logo file named in an article's infobox (`logo =`, else `image =` when it is a logo). */
export function logoFileFrom(wikitext) {
  const field = (name) => wikitext.match(new RegExp(`\\|\\s*${name}\\s*=\\s*(?:\\[\\[)?(?:File:|Image:)?([^|\\]\\n]+?\\.(?:svg|png|jpe?g|gif))`, "i"))?.[1]?.trim();
  return field("logo") ?? field("logo_image") ?? (field("image") && /logo|wordmark/i.test(field("image")) ? field("image") : null);
}

// Crop a logo to its mark. Infobox logos often sit in a wide transparent or
// white margin, so a square mark letterboxed into a wordmark slot came out a
// third of the size of its neighbours. Pillow ships with python-pptx.
const TRIM = `
import sys
from PIL import Image, ImageChops
p = sys.argv[1]
im = Image.open(p); im.load()
rgba = im.convert("RGBA")
w, h = rgba.size
box = rgba.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
if box in (None, (0, 0, w, h)):
    ink = ImageChops.difference(rgba.convert("RGB"), Image.new("RGB", (w, h), (255, 255, 255))).convert("L")
    box = ink.point(lambda v: 255 if v > 24 else 0).getbbox() or box
if box:
    pad = max(2, round(0.02 * max(box[2] - box[0], box[3] - box[1])))
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))
    if box != (0, 0, w, h):
        im.crop(box).save(p)
        print("trimmed")
`;

/** Trim a logo file to its mark in place; true when it was cropped. Never throws. */
export function trimLogo(file, python = process.env.RUNTIME_PYTHON || "python3") {
  return new Promise((resolve) => {
    const child = spawn(python, ["-c", TRIM, file], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0 && out.includes("trimmed")));
  });
}

/** A file-name slug: lower case, hyphens, at most 60 characters. */
export const slugOf = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "");

export async function fetchLogo(player, directory, hint) {
  // The first candidate article whose infobox names a logo: a bare name
  // ("Emirates") can land on a region or a disambiguation page first.
  const titles = await articlesFor(player, hint);
  if (!titles.length) return { name: player.name, error: "no Wikipedia article found" };
  let title = null, file = null;
  for (const candidate of titles) {
    const parsed = await api({ action: "parse", page: candidate, prop: "wikitext", section: "0", redirects: "1" });
    file = logoFileFrom(parsed.parse?.wikitext ?? "");
    if (file) { title = candidate; break; }
  }
  if (!file) return { name: player.name, article: titles[0], error: "no logo in the infobox of the top search results; set `wikipedia` on the player" };
  // Special:FilePath serves local and Commons files; a width renders SVGs to PNG.
  const source = `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=512`;
  const res = await fetch(source, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) return { name: player.name, article: title, file, error: `download ${res.status}` };
  const type = res.headers.get("content-type") || "";
  const ext = /png/.test(type) ? "png" : /jpe?g/.test(type) ? "jpg" : null;
  if (!ext) return { name: player.name, article: title, file, error: `unsupported image type ${type}` };
  const slug = slugOf(player.name);
  const out = path.join(directory, `${slug}.${ext}`);
  await fs.writeFile(out, Buffer.from(await res.arrayBuffer()));
  await trimLogo(out);
  return { name: player.name, article: title, file, path: out,
    credit: `${player.name} logo, via Wikipedia (${title}): https://en.wikipedia.org/wiki/File:${file.replace(/ /g, "_")}` };
}

/** Give every `{ alt: "<name> logo" }` without a file the fetched path and credit. */
export function fillLogos(spec, fetched, baseDir) {
  const byAlt = new Map(fetched.filter((f) => f.path).map((f) => [`${f.name} logo`.toLowerCase(), f]));
  let filled = 0;
  const walk = (value) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== "object") return;
    const hit = typeof value.alt === "string" && !value.path && !value.dataUri && byAlt.get(value.alt.toLowerCase());
    if (hit) { value.path = path.relative(baseDir, hit.path); value.credit = value.credit ?? hit.credit; filled += 1; }
    for (const child of Object.values(value)) walk(child);
  };
  walk(spec);
  return filled;
}

/**
 * Fill the spec's unsourced player logos in memory, for the build: a logo
 * already in assets/logos/ is reused without the network; a missing one is
 * fetched; a failure leaves the `{ alt }` placeholder for UNSOURCED_PICTURE to
 * report. Returns what was filled and what failed.
 */
export async function autoFillLogos(spec, baseDir, { hint, fetchMissing = true } = {}) {
  const players = (spec.players || []).map((p) => typeof p === "string" ? { name: p } : p).filter((p) => p?.name && !(p.logo && (p.logo.path || p.logo.dataUri)));
  if (!players.length) return { filled: 0, fetched: [], failed: [] };
  const directory = path.join(baseDir, "assets", "logos");
  const records = new Map((await fs.readFile(path.join(directory, "sources.json"), "utf8").then(JSON.parse).catch(() => [])).map((r) => [r.name, r]));
  const results = [];
  for (const player of players) {
    const slug = slugOf(player.name);
    const existing = await Promise.any(["png", "jpg"].map(async (ext) => { const f = path.join(directory, `${slug}.${ext}`); await fs.access(f); return f; })).catch(() => null);
    const known = records.get(player.name);
    if (existing) { results.push({ name: player.name, path: existing, credit: known?.credit ?? `${player.name} logo` }); continue; }
    if (!fetchMissing) continue;
    try { await fs.mkdir(directory, { recursive: true }); results.push(await fetchLogo(player, directory, hint)); } catch (error) { results.push({ name: player.name, error: error.message }); }
  }
  // A logo fetched here keeps its provenance: without the record, the next
  // build reuses the file and credits it only as "<name> logo".
  const fresh = results.filter((r) => r.path && r.article);
  if (fresh.length) {
    for (const { path: p, ...rest } of fresh) records.set(rest.name, { ...rest, saved: path.relative(baseDir, p) });
    await fs.writeFile(path.join(directory, "sources.json"), JSON.stringify([...records.values()], null, 2) + "\n");
  }
  return { filled: fillLogos(spec, results, baseDir), fetched: results.filter((r) => r.path).map((r) => r.name), failed: results.filter((r) => !r.path).map((r) => `${r.name}: ${r.error}`) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [specArg, ...flags] = process.argv.slice(2);
  if (!specArg) { console.error("Usage: fetch-logos.mjs <id>.deck.json [--hint word] [--dry-run]"); process.exit(1); }
  const specPath = path.resolve(specArg), baseDir = path.dirname(specPath);
  const at = flags.indexOf("--hint"), hint = at >= 0 ? flags[at + 1] : undefined;
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const players = (spec.players || []).map((p) => typeof p === "string" ? { name: p } : p)
    .filter((p) => p?.name && !(p.logo && (p.logo.path || p.logo.dataUri)));
  if (flags.includes("--dry-run")) { console.log(JSON.stringify({ toFetch: players.map((p) => p.name) })); process.exit(0); }
  const directory = path.join(baseDir, "assets", "logos");
  await fs.mkdir(directory, { recursive: true });
  const fetched = [];
  for (const player of players) {
    try { fetched.push(await fetchLogo(player, directory, hint)); } catch (error) { fetched.push({ name: player.name, error: error.message }); }
  }
  const filled = fillLogos(spec, fetched, baseDir);
  await fs.writeFile(specPath, JSON.stringify(spec, null, 1) + "\n");
  // One record per player, kept across runs.
  const recordPath = path.join(directory, "sources.json");
  const records = new Map((await fs.readFile(recordPath, "utf8").then(JSON.parse).catch(() => [])).map((r) => [r.name, r]));
  for (const { path: p, ...rest } of fetched) records.set(rest.name, { ...rest, saved: p ? path.relative(baseDir, p) : null });
  await fs.writeFile(recordPath, JSON.stringify([...records.values()], null, 2) + "\n");
  console.log(JSON.stringify({ fetched: fetched.filter((f) => f.path).map((f) => f.name), failed: fetched.filter((f) => !f.path).map((f) => `${f.name}: ${f.error}`), placeholdersFilled: filled }, null, 1));
}
