#!/usr/bin/env node
// The published gallery (shiphappens.xyz/slides), reproduced page by page, as a layout regression suite.
//
//   node evals/scripts/site_gallery.mjs            compare every page's layout with the approved one (exit 1 on a move)
//   node evals/scripts/site_gallery.mjs --approve  record the layout as it is now, after looking at what moved
//
// evals/regression/site-gallery/pages/*.json hold the pages (one per published slide, id `<type>-<form>`),
// published.json the names of the published slides and the ones not reproduced, layout.json the approved frames of
// every component. The published images themselves are not kept in the repository.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authorDeck, workedExamples } from "../../skills/professional-slides/runtime/author-deck.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../regression/site-gallery");
const TOLERANCE = 1;

/** Every reproduced page, compiled: `{ pages, blocking, layout }`, the layout as `{ <page id>: [[component, x, y, width, height]] }`. */
export async function galleryLayout() {
  const doc = workedExamples();
  doc.pages = fs.readdirSync(path.join(root, "pages")).filter((name) => name.endsWith(".json")).sort().flatMap((name) => JSON.parse(fs.readFileSync(path.join(root, "pages", name), "utf8")));
  // Pictures are the examples' own (`assets/...`), so the suite carries none.
  const authored = await authorDeck(doc, { baseDir: path.join(root, "../../../skills/professional-slides/examples") });
  const layout = {};
  for (const slide of authored.deck?.slides ?? []) {
    const id = String(slide.sourceSlideId ?? slide.id);
    if (!doc.pages.some((page) => String(page.id) === id)) continue;
    (layout[id] ??= []).push(...slide.componentInstances.map((instance) => [instance.component, ...["x", "y", "width", "height"].map((key) => Math.round(instance.frame[key]))]));
  }
  return { pages: doc.pages.map((page) => String(page.id)), blocking: authored.blocking.map((finding) => ({ id: finding.id, code: finding.code, repair: finding.repair })), layout };
}

/** The pages whose components are not where the approved layout has them. */
export function moved(approved, layout) {
  const far = (a, b) => a[0] !== b[0] || a.slice(1).some((value, at) => Math.abs(value - b[at + 1]) > TOLERANCE);
  return Object.keys({ ...approved, ...layout }).filter((id) => !approved[id] || !layout[id] || approved[id].length !== layout[id].length || approved[id].some((frame, at) => far(frame, layout[id][at]))).sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = path.join(root, "layout.json"), now = await galleryLayout();
  if (process.argv.includes("--approve")) { fs.writeFileSync(file, `${JSON.stringify(now.layout)}\n`); console.log(JSON.stringify({ approved: Object.keys(now.layout).length, blocking: now.blocking })); }
  else { const changed = moved(JSON.parse(fs.readFileSync(file, "utf8")), now.layout); console.log(JSON.stringify({ pages: now.pages.length, moved: changed, blocking: now.blocking })); process.exitCode = changed.length || now.blocking.length ? 1 : 0; }
}
