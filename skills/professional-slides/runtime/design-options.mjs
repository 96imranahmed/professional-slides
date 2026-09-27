#!/usr/bin/env node
// Option sheets for the design intake: one labelled contact sheet per question.
//
//   node runtime/design-options.mjs <out-dir> [--only trackers,title-treatments]
//        [--design editorial] [--brand '#0B6E4F,#F2A900'] [--wordmark "Acme"] [--python python3]
//
// A user choosing a tracker or a title treatment from a word ("breadcrumb",
// "band") is guessing. Each sheet shows the same sample pages built once per
// option through the real pipeline (compose, the PPTX emitter, LibreOffice),
// so a tile is what the answer produces, not an illustration of it, and each
// tile is labelled with the exact deck value the answer sets. Every option is
// expressed as an intake answer and turned into deck keys by preferences.mjs
// `deckKeys`, the same function that carries a stored answer into a build.
//
// The default sheets are pre-rendered in assets/design-options/ so a host
// without LibreOffice can still show them; rerun with --brand (the user's
// colours) or --design (the system they picked) to show the options in their
// own frame. Writes <out-dir>/<sheet>.png and <out-dir>/options.json.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeAll } from "./compose-all.mjs";
import { DESIGN_SYSTEMS, DESIGN_NAMES } from "./design-systems.mjs";
import { PALETTES } from "./palettes.mjs";
import { deckKeys, DENSITIES } from "./preferences.mjs";
import { runProcess, lastJson } from "./process.mjs";

const runtime = path.dirname(fileURLToPath(import.meta.url));

// The sample: a cover, a chart page with commentary and a takeaway, a table
// page and a page of cards (the surfaces show on the last two), under three
// sections so every tracker (a number strip needs
// three) has a position to show. Illustrative figures for a fictional firm.
export function sampleDeck() {
  return {
    schema: "professional-slides.deck/v3", id: "design-options", contents: false, footer: "Northwind growth plan (sample)",
    cover: { title: "Northwind: growing the subscription base", subtitle: "Sample pages for choosing a design", date: "September 2026", logo: "Northwind" },
    slides: [
      { id: "s1", kind: "section", title: "Market outlook" },
      { id: "chart", title: "Demand reaches $1.65B by 2030 on a 13% CAGR, led by enterprise buyers",
        exhibit: { type: "chart.column", heading: "Addressable market", unit: "$M", categories: ["2024", "2025", "2026E", "2027E", "2028E", "2029E", "2030E"],
          series: [{ name: "Market", values: [820, 900, 990, 1090, 1220, 1400, 1650] }], forecastFrom: "2026E", cagr: { from: "2024", to: "2030E" } },
        pointsHeading: "What drives it",
        points: [
          { lead: "Enterprise front-loads the growth", text: "Two-thirds of the 2026 to 2028 increment comes from enterprise seats." },
          { lead: "Consumer follows from 2027", text: "Price, not demand, holds the consumer segment back until then." },
          { lead: "The 2030 figure assumes no price erosion", text: "Every 5% of erosion removes about $80M from the endpoint." }
        ],
        soWhat: "Win enterprise accounts before 2027, while the consumer segment is still price-bound.",
        source: "Illustrative figures", highlight: "enterprise seats" },
      { id: "s2", kind: "section", title: "Operations" },
      { id: "table", title: "Two of five workstreams wait on a vendor decision; three hold their dates",
        exhibit: { type: "table", columns: ["Workstream", "Owner", "Status", "Complete", "Next step"],
          rows: [["Billing platform", "J. Smith", "At risk", "40%", "Vendor decision due this week"],
            ["Onboarding flow", "S. Johnson", "At risk", "30%", "Re-plan once the scope is agreed"],
            ["Data migration", "M. Lee", "Behind plan", "45%", "Two hires start next month"],
            ["Pricing pilot", "E. Davis", "On track", "60%", "Second market goes live in May"],
            ["Support model", "D. Brown", "On track", "55%", "No blockers"]] },
        soWhat: "Billing and onboarding need the vendor decision this week; everything else holds its dates.",
        source: "Programme office, illustrative", highlight: "everything else holds its dates" },
      { id: "s3", kind: "section", title: "Next steps" },
      { id: "cards", title: "Three moves close the enterprise gap before the consumer segment opens",
        exhibit: { type: "cards", items: [
          { title: "Sell to enterprise first", text: "A named-account team for the 200 largest buyers, in place by Q2." },
          { title: "Fix billing and onboarding", text: "Both workstreams unblocked by the vendor decision this week." },
          { title: "Hold consumer pricing", text: "Test two price points in one market before any national launch." }] },
        soWhat: "The first move carries two-thirds of the value; the other two protect it.",
        source: "Illustrative", highlight: "two-thirds of the value" }
    ]
  };
}

// The header band of a content page at reading size: trackers and title
// treatments are a few pixels tall on a whole-page thumbnail.
const HEADER = [0, 0, 1280, 186];
// Pages render above the 96 dpi of the 1280 x 720 canvas so the enlarged
// header crops stay sharp; crops are written in canvas pixels and scaled.
const DPI = 120;
const PALETTE_NAMES = Object.keys(PALETTES).filter((name) => name !== "toolkit");
// No tile for leaving the tracker unset: each new deck's `variation` then
// draws label, breadcrumb or number strip, so one picture of it would be false.
const TRACKER_NOTES = {
  pills: "every section as a pill, the current one filled",
  label: "the current section's name, above the title",
  breadcrumb: "the section under its parent",
  "number-strip": "section numbers on a rail, the current one filled",
  none: "no tracker on the pages"
};
const TITLE_NOTES = {
  system: "the design system's own", rule: "a thin rule, margin to margin", full: "a hairline, edge to edge", bar: "a short accent bar",
  band: "a tinted band behind the title", block: "the title reversed out of a colour block", tab: "an accent tab at the top edge", none: "no rule; the page stays open"
};

/**
 * The sheets: which question each answers, its options as intake answers, and
 * which pages (and crops) each tile shows. `base` is the answer set every
 * option is laid over - the user's brand and chosen system when given.
 */
export function sheetPlan({ design = "consulting", brand = null, wordmark = null } = {}) {
  const base = { design, ...(brand ? { colours: "brand", brand } : {}), ...(wordmark ? { wordmark } : {}) };
  const page = (id, crop) => ({ id, ...(crop ? { crop } : {}) });
  const header = [page("chart", HEADER), page("chart")];
  return [
    { id: "design-systems", question: "design", title: "Design system", key: "design",
      pages: [page("cover"), page("chart"), page("table")],
      options: DESIGN_NAMES.map((name) => ({ label: `design: "${name}"`, note: `${DESIGN_SYSTEMS[name].label}: ${DESIGN_SYSTEMS[name].use}`, answers: { ...base, design: name } })) },
    { id: "palettes", question: "colours", title: `Colours (on the ${DESIGN_SYSTEMS[design].label.toLowerCase()} system)`, key: "palette / identity",
      pages: [page("chart"), page("table")],
      // Consulting's own colours are the midnight palette, so on consulting
      // the "system" tile would repeat the midnight one.
      options: [
        ...(design === "consulting" ? [] : [{ label: `colours: "system"`, note: `the ${DESIGN_SYSTEMS[design].label.toLowerCase()} system's own colours`, answers: { ...base, colours: "system" } }]),
        ...(brand ? [{ label: `identity: { primary: "${brand.primary}"${brand.accent ? `, accent: "${brand.accent}"` : ""} }`, note: "your brand colours on the pages", answers: { ...base, colours: "brand", brand } }] : []),
        ...PALETTE_NAMES.map((name) => ({ label: `palette: "${name}"`, note: `${design === "consulting" && name === "midnight" ? "the consulting system's own colours. " : ""}${PALETTES[name].basis}`, answers: { ...base, colours: name } }))
      ] },
    { id: "trackers", question: "tracker", title: "Section tracker", key: "tracker", pages: header,
      options: ["pills", "label", "breadcrumb", "number-strip", "none"].map((value) => ({
        label: value === "none" ? "tracker: false" : `tracker: "${value}"`, note: TRACKER_NOTES[value], answers: { ...base, tracker: value } })) },
    { id: "title-treatments", question: "titleRule", title: "Title treatment", key: "palette.colors[\"style.titleRule\"]", pages: header,
      options: ["system", "rule", "full", "bar", "band", "block", "tab", "none"].map((value) => ({ label: `titleRule: "${value}"`,
        note: value === "system" ? `the ${DESIGN_SYSTEMS[design].label.toLowerCase()} system's own` : TITLE_NOTES[value], answers: { ...base, tracker: "label", titleRule: value } })) },
    { id: "surfaces", question: "surfaces", title: "Surfaces", key: "surfaces", pages: [page("table"), page("cards")],
      options: [
        { label: `surfaces: "reference"`, note: "filled table headers, a tinted label column, filled cards, heavier marks", answers: { ...base, surfaces: "reference" } },
        { label: `surfaces: "open"`, note: "type on the canvas: ruled headers, plain columns, outlined cards, light marks", answers: { ...base, surfaces: "open" } }
      ] }
  ];
}

/** The deck one tile is built from: the sample with the option's deck keys. */
export function optionDeck(answers) {
  const keys = deckKeys(answers);
  const deck = { ...sampleDeck(), ...keys };
  if (keys.logo) deck.cover = { ...deck.cover, logo: keys.logo };
  return deck;
}

async function pool(items, size, work) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await work(items[i], i); }
  }));
  return results;
}

/** Build one option's sample deck and render it; returns { slide id -> PNG path }. */
export async function renderOption(answers, directory, python) {
  await fs.mkdir(directory, { recursive: true });
  const { deck } = composeAll(optionDeck(answers), runtime);
  const scene = path.join(directory, "scene.json"), pptx = path.join(directory, "sample.pptx"), rendered = path.join(directory, "rendered");
  await fs.writeFile(scene, JSON.stringify(deck));
  await runProcess(python, [path.join(runtime, "emit", "emit_pptx.py"), scene, pptx]);
  const result = lastJson((await runProcess(python, [path.join(runtime, "emit", "render_pptx.py"), pptx, rendered, "--dpi", String(DPI)])).stdout);
  const byId = {};
  deck.slides.forEach((slide, i) => { const id = slide.kind === "cover" ? "cover" : slide.sourceSlideId ?? slide.id; if (result.renders[i]) byId[id] = result.renders[i]; });
  return byId;
}

export async function renderSheets(outDirectory, { only, python = process.env.RUNTIME_PYTHON || "python3", ...options } = {}) {
  const plan = sheetPlan(options).filter((sheet) => !only || only.includes(sheet.id));
  if (!plan.length) throw new Error(`No sheet matches --only ${only}`);
  await fs.mkdir(outDirectory, { recursive: true });
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "design-options-"));
  try {
    const jobs = plan.flatMap((sheet) => sheet.options.map((option, i) => ({ sheet, option, dir: path.join(work, `${sheet.id}-${i}`) })));
    // LibreOffice is the slow step and each render takes its own profile, so
    // a few run side by side.
    const renders = await pool(jobs, Math.max(1, Math.min(4, os.cpus().length)), (job) => renderOption(job.option.answers, job.dir, python));
    const manifest = [];
    for (const sheet of plan) {
      const tiles = jobs.map((job, i) => ({ job, pages: renders[i] })).filter(({ job }) => job.sheet === sheet).map(({ job, pages }) => ({
        label: job.option.label, note: job.option.note,
        images: sheet.pages.map((p) => ({ path: pages[p.id], ...(p.crop ? { crop: p.crop.map((v) => Math.round(v * DPI / 96)) } : {}) }))
      }));
      const out = path.join(outDirectory, `${sheet.id}.png`);
      const layout = { out, title: sheet.title, subtitle: `Each tile is the same sample built with the value it is labelled with; the deck key is ${sheet.key}.`, header: Boolean(sheet.pages[0].crop), tiles };
      const layoutPath = path.join(work, `${sheet.id}.layout.json`);
      await fs.writeFile(layoutPath, JSON.stringify(layout));
      await runProcess(python, [path.join(runtime, "emit", "contact_sheet.py"), layoutPath]);
      manifest.push({ sheet: `${sheet.id}.png`, question: sheet.question, title: sheet.title, options: sheet.options.map((o) => ({ label: o.label, note: o.note, answer: o.answers[sheet.question], deckKeys: deckKeys(o.answers) })) });
    }
    const index = { density: DENSITIES, sheets: manifest };
    await fs.writeFile(path.join(outDirectory, "options.json"), JSON.stringify(index, null, 2) + "\n");
    return { outDirectory, sheets: manifest.map((m) => path.join(outDirectory, m.sheet)) };
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

export function parseBrand(value) {
  const colours = String(value).split(",").map((c) => c.trim()).filter(Boolean);
  if (!colours.length || colours.length > 2 || colours.some((c) => !/^#[0-9A-Fa-f]{6}$/.test(c))) throw new Error("--brand takes one or two #RRGGBB colours: '#0B6E4F,#F2A900'");
  return { primary: colours[0], ...(colours[1] ? { accent: colours[1] } : {}) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); if (i < 0) return undefined; const value = args[i + 1]; args.splice(i, 2); return value; };
  const only = flag("--only")?.split(","), design = flag("--design") ?? "consulting", brand = flag("--brand"), wordmark = flag("--wordmark"), python = flag("--python");
  if (!args[0]) { console.error("Usage: design-options.mjs <out-dir> [--only sheet,...] [--design name] [--brand '#hex,#hex'] [--wordmark text]"); process.exit(1); }
  if (!DESIGN_NAMES.includes(design)) { console.error(`Unknown design ${design}; use ${DESIGN_NAMES.join(", ")}`); process.exit(1); }
  renderSheets(path.resolve(args[0]), { only, design, brand: brand ? parseBrand(brand) : null, wordmark: wordmark ?? null, ...(python ? { python } : {}) })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error.message); process.exit(1); });
}
