// `pictures WORK --candidates`: the files each planned picture could take, on one sheet to look at before the build.
//
// The build takes the best-named file of the first library that has one (picture-providers.mjs). A look at the top three
// beside each other is one image to read rather than a wrong photograph found in review - the A350F deck's first fetch
// placed an A350-900 simulator cockpit as "the A350F". A picture takes one of them with `pick`: its page, as listed.
import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonWhole } from "../cli.mjs";
import { compileDeck, readInsights } from "../author-deck.mjs";
import { readPagesFile } from "../pages-file.mjs";
import { picturePlaceholders, searchPictures } from "../fetch-pictures.mjs";
import { isIllustration } from "../compose-pictures.mjs";
import { slugOf, UA } from "../fetch-logos.mjs";
import { python } from "./workspace.mjs";

const SHOWN = 3;

export async function pictureCandidates(work, results, { fetch: request = globalThis.fetch } = {}) {
  const doc = await readPagesFile(work.file);
  const { spec } = compileDeck(doc, { insights: await readInsights(work.root, doc.deck.id), partial: true });
  const placeholders = picturePlaceholders(structuredClone(spec));
  if (!placeholders.length) return results.complete({ message: "No page plans a picture to fetch." });
  const dir = path.join(work.root, "assets", "pictures", "candidates");
  await fs.mkdir(dir, { recursive: true });
  const listing = [], tiles = [];
  const seen = new Set();
  for (const picture of placeholders) {
    const query = picture.search ?? picture.alt;
    if (seen.has(`${picture.alt}|${query}`)) continue;
    seen.add(`${picture.alt}|${query}`);
    const found = await searchPictures(query, { ...(isIllustration(picture) ? { kind: "illustration" } : {}), fetch: request });
    const shown = [];
    for (const [i, candidate] of found.slice(0, SHOWN).entries()) {
      const file = path.join(dir, `${slugOf(picture.alt)}-${i + 1}.${isIllustration(picture) ? "png" : "jpg"}`);
      try {
        const res = await request(candidate.url, { headers: { "User-Agent": UA }, redirect: "follow" });
        if (!res.ok) throw new Error(`download ${res.status}`);
        await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
        shown.push({ n: i + 1, provider: candidate.provider, title: candidate.title, page: candidate.page, license: candidate.license, artist: candidate.artist, file: path.relative(work.root, file) });
      } catch (error) { shown.push({ n: i + 1, provider: candidate.provider, title: candidate.title, page: candidate.page, error: error.message }); }
    }
    listing.push({ alt: picture.alt, search: query, candidates: shown, ...(shown.length ? {} : { tried: found.tried, near: found.near }) });
    if (shown.some((c) => c.file)) tiles.push({ label: picture.alt, note: shown.map((c) => `${c.n}: ${c.provider}, ${String(c.title).replace(/^File:/, "").slice(0, 48)}`).join("  |  "),
      images: shown.filter((c) => c.file).map((c) => ({ path: path.join(work.root, c.file) })) });
  }
  const list = path.join(dir, "candidates.json"), sheet = path.join(dir, "candidates.png");
  await writeJsonWhole(list, listing);
  const artifacts = [list];
  if (tiles.length) {
    const layout = path.join(dir, "candidates-sheet.json");
    await writeJsonWhole(layout, { out: sheet, title: "Picture candidates", subtitle: "Take one with the picture's `pick`: its page in candidates.json", header: false, tiles });
    const made = await python("emit/contact_sheet.py", [layout]);
    if (!made.code) artifacts.push(sheet);
  }
  const unmatched = listing.filter((entry) => !entry.candidates.length).map((entry) => entry.alt);
  return results.complete({ artifacts, pictures: listing.length,
    message: `${listing.length - unmatched.length} of ${listing.length} pictures have candidates; look at the sheet, then set \`pick\` on a picture to the page of the one it takes.${unmatched.length ? ` No library names: ${unmatched.join("; ")} - set their \`search\`, or supply the files.` : ""}` });
}
