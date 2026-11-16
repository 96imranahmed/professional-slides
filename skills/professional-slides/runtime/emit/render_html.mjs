// HTML deck -> one PNG a slide, photographed in a headless browser.
//
// The page gates read 1280 by 720 images of the pages and do not ask who drew
// them, so the HTML output is held to the same pixel checks as the PowerPoint
// one: this stands where render_pptx.py stands for a saved PPTX. The browser is
// Playwright's Chromium, an optional dependency: without it the deck is still
// written and every scene gate has run, and the result says the pages were not
// photographed.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { SLIDE } from "../core.mjs";

/** Playwright from this installation, or from the folder RUNTIME_NODE_MODULES names; null when neither holds it. */
async function loadPlaywright() {
  const roots = [import.meta.url, ...(process.env.RUNTIME_NODE_MODULES ? [pathToFileURL(path.join(process.env.RUNTIME_NODE_MODULES, "_")).href] : [])];
  for (const root of roots) {
    try { return await import(pathToFileURL(createRequire(root).resolve("playwright")).href); } catch { /* try the next */ }
  }
  return null;
}

/**
 * Photograph every slide of the deck's actual-size HTML into `directory` as slide-N.png, with
 * the text each page shows (`page-text.json`, the form render_pptx.py writes).
 * Returns `{ renderer, directory, renders, pageText }`, or `{ skipped }` saying
 * what to install.
 */
export async function renderHtml(actualHtml, directory) {
  const playwright = await loadPlaywright();
  if (!playwright) return { skipped: "The HTML pages were not photographed: Playwright is not installed (npm install playwright, then npx playwright install chromium)." };
  let browser;
  try { browser = await (playwright.chromium ?? playwright.default.chromium).launch(); }
  catch (error) { return { skipped: `The HTML pages were not photographed: Chromium did not start (npx playwright install chromium). ${String(error.message).split("\n")[0]}` }; }
  try {
    await fs.rm(directory, { recursive: true, force: true });
    await fs.mkdir(directory, { recursive: true });
    const page = await browser.newPage({ viewport: { width: SLIDE.width, height: SLIDE.height }, deviceScaleFactor: 1 });
    // The delivered page scales its slides to the window; photographed, each is set at its own size (`actual`).
    await page.setContent(actualHtml);
    await page.evaluate(() => document.fonts.ready);
    const slides = page.locator(".ps-slide");
    const count = await slides.count(), renders = [];
    for (let at = 0; at < count; at += 1) {
      const file = path.join(directory, `slide-${at + 1}.png`);
      await slides.nth(at).screenshot({ path: file });
      renders.push(file);
    }
    const pages = await page.evaluate(() => [...document.querySelectorAll(".ps-slide")].map((slide) => [...slide.querySelectorAll(".ps-text")].map((node) => node.textContent).join("\n")));
    const pageText = path.join(directory, "page-text.json");
    await fs.writeFile(pageText, `${JSON.stringify(pages, null, 2)}\n`);
    return { renderer: `chromium ${browser.version()}`, directory, renders, pageText };
  } finally { await browser.close(); }
}
