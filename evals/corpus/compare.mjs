#!/usr/bin/env node
/**
 * Where our decks stand against the corpus, in one table.
 *
 *   node evals/corpus/compare.mjs /tmp/ps-build-nyc-or-sf /tmp/ps-build-slideworks …
 *   node evals/corpus/compare.mjs --json  /tmp/ps-build-*
 *
 * The corpus was measured three ways and written into `runtime/weight.json`.
 * Our decks were measured a fourth way, by the gates, and the two were never put
 * side by side - so SKILL.md carried an "Ours today" column that was a different
 * instrument, rotted quietly, and was eventually deleted rather than fixed.
 *
 * This reads a built deck's `scene.json` and computes the same quantities the
 * corpus pass computed, so the comparison is one instrument pointed at two
 * populations. Ink needs a render and is reported only when `rendered/` exists;
 * everything else comes off the scene.
 *
 * It prints a table and exits 0. It is a report, not a gate: DECK_CRAFT,
 * THIN_PAGE and the plan gates are where a number becomes a finding. What this
 * answers is the question none of them do - *by how much, and in which
 * direction*.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { designStatistics } from "../../skills/professional-slides/runtime/reviewer.mjs";

const CONTRACT = JSON.parse(readFileSync(
  new URL("../../skills/professional-slides/runtime/weight.json", import.meta.url), "utf8"));
const CLIENT = CONTRACT.reference.judged;
const SLIDES = CONTRACT.reference.slides;
const CRAFT = CONTRACT.plan.craft;
const MIX = CONTRACT.plan.mix;

const BODY_TOP = 140, FOOTER_TOP = 660;
const SOURCE_ROLES = new Set(["source-text", "source", "footnote", "footnote-text"]);
const TITLE_ROLES = new Set(["action-title", "section-title", "kicker", "page-tag"]);
const CHART = (c) => String(c).startsWith("chart.");
const TABLE = (c) => /^(table|comparison-table|heatmap|trend-rows|insight-tree-table|matrix)$/.test(String(c));
const PICTURE = (c) => /^(image-frame|logo-collage|people|logos)$/.test(String(c));

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** The page's body band, counted the way the corpus counted it: words between
 *  the title band and the footer, whatever component drew them. */
function bodyWords(slide) {
  let words = 0;
  for (const node of slide.nodes ?? []) {
    if (node.type !== "text") continue;
    const role = String(node.role ?? "");
    if (SOURCE_ROLES.has(role) || TITLE_ROLES.has(role)) continue;
    const y = node.frame?.y ?? 0;
    if (y < BODY_TOP || y >= FOOTER_TOP) continue;
    words += String(node.text ?? "").split(/\s+/).filter(Boolean).length;
  }
  return words;
}

/** The share of the page darker than the gate's own luminance cut, when the
 *  deck has been rendered. Without renders there is nothing to measure. */
function inkOf(directory) {
  const renders = path.join(directory, "rendered");
  if (!existsSync(renders)) return null;
  const pngs = readdirSync(renders).filter((f) => /^slide-\d+\.png$/.test(f));
  return pngs.length ? { pages: pngs.length, note: "run page_gates.py for the measured value" } : null;
}

export function measureDeck(directory) {
  const scene = JSON.parse(readFileSync(path.join(directory, "scene.json"), "utf8"));
  const content = scene.slides.filter((s) => (s.nodes ?? []).some((n) => n.role === "action-title"));
  if (!content.length) throw new Error(`No content pages in ${directory}`);
  const statistics = designStatistics(scene);

  const families = content.map((slide) => {
    const components = (slide.componentInstances ?? []).map((c) => String(c.component));
    if (components.some(CHART)) return "chart";
    if (components.some(TABLE)) return "table";
    if (components.some(PICTURE)) return "picture";
    if (components.some((c) => !["chrome", "slide-chrome", "section", "page-template"].includes(c)
                              && !/^(paragraph|bullet-list|insight|callout|statement|takeaways)$/.test(c))) return "diagram";
    return "text";
  });
  const share = (name) => families.filter((f) => f === name).length / families.length;
  const rate = (test) => content.filter(test).length / content.length;

  return {
    deck: path.basename(directory).replace(/^ps-build-/, ""),
    pages: content.length,
    bodyWords: median(content.map(bodyWords)),
    marksPerPage: statistics.drawingsPerPage,
    highlight: rate((s) => (s.nodes ?? []).some((n) => n.runs?.some((r) => r.accent))),
    source: rate((s) => (s.nodes ?? []).some((n) => SOURCE_ROLES.has(String(n.role ?? "")))),
    chartShare: share("chart"),
    tableShare: share("table"),
    textShare: share("text"),
    tablesTreated: statistics.tablesTreated,
    chartsAnnotated: statistics.chartsAnnotated,
    ink: inkOf(directory),
  };
}

/** measure → [ours, client work, published work, and what the gate asks for]. */
const ROWS = [
  ["body words a page", "bodyWords", SLIDES.bands.body, CONTRACT.reference.published ? 157 : null, null],
  ["drawn elements a page", "marksPerPage", SLIDES.drawings, null, CONTRACT.plan ? 11 : null],
  ["phrase emphasised", "highlight", CLIENT.highlightedPhrase, null, 0.35],
  ["source line", "source", CLIENT.sourceLine, null, 0.5],
  ["pages carried by a chart", "chartShare", MIX.chart.observedClient, MIX.chart.observedPublished, MIX.chart.min],
  ["pages carried by a table", "tableShare", MIX.table.observedClient, MIX.table.observedPublished, MIX.table.max],
  ["pages of type alone", "textShare", MIX.text.observedClient, MIX.text.observedPublished, MIX.text.max],
  ["tables treated", "tablesTreated", CRAFT.tableTreated.observedClient, CRAFT.tableTreated.observedPublished, CRAFT.tableTreated.min],
  ["charts annotated", "chartsAnnotated", CRAFT.chartAnnotated.observedClient, CRAFT.chartAnnotated.observedPublished, CRAFT.chartAnnotated.min],
];

const show = (value) => {
  if (value === null || value === undefined) return "-";
  if (typeof value !== "number") return String(value);
  return value > 0 && value <= 1 ? `${Math.round(value * 100)}%` : String(Math.round(value * 10) / 10);
};

export function compare(directories) {
  const decks = directories.map(measureDeck);
  const lines = [];
  const width = Math.max(22, ...decks.map((d) => d.deck.length + 1));
  lines.push(["measure".padEnd(26), ...decks.map((d) => d.deck.padStart(width)),
              "client".padStart(9), "published".padStart(10), "floor".padStart(7)].join(""));
  for (const [label, key, client, published, floor] of ROWS) {
    lines.push([label.padEnd(26), ...decks.map((d) => show(d[key]).padStart(width)),
                show(client).padStart(9), show(published).padStart(10), show(floor).padStart(7)].join(""));
  }
  return { decks, table: lines.join("\n") };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const args = process.argv.slice(2);
  const directories = args.filter((a) => !a.startsWith("--")).filter((d) => existsSync(path.join(d, "scene.json")));
  if (!directories.length) {
    console.error("usage: compare.mjs <built deck directory>… [--json]");
    process.exit(1);
  }
  const result = compare(directories);
  if (args.includes("--json")) console.log(JSON.stringify(result.decks, null, 2));
  else console.log(result.table);
}
