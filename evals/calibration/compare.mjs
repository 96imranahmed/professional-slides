#!/usr/bin/env node
/**
 * Where built decks stand against the calibration targets, in one table.
 *
 *   node evals/calibration/compare.mjs out/deck-a out/deck-b …
 *   node evals/calibration/compare.mjs --json out/deck-*
 *
 * The calibration set was measured three ways and written into
 * `runtime/weight.json`. Built decks are measured a fourth way, by the gates,
 * and the two were never put side by side - so a hand-kept "ours today" column
 * rotted quietly and was eventually deleted rather than fixed.
 *
 * This reads a built deck's `scene.json` and computes the same quantities the
 * calibration pass computed, so the comparison is one instrument pointed at two
 * populations. It prints a table and exits 0. It is a report, not a gate:
 * DECK_CRAFT, THIN_PAGE and the plan gates are where a number becomes a
 * finding. What this answers is the question none of them do - by how much,
 * and in which direction.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { designStatistics } from "../../skills/professional-slides/runtime/build-bars.mjs";
import { isMain } from "../../skills/professional-slides/runtime/cli.mjs";

const CONTRACT = JSON.parse(readFileSync(
  new URL("../../skills/professional-slides/runtime/weight.json", import.meta.url), "utf8"));
const JUDGED = CONTRACT.reference?.judged ?? {};
const SLIDES = CONTRACT.reference?.slides ?? {};
const BENCHMARK = CONTRACT.reference?.benchmark ?? {};
const CRAFT = CONTRACT.plan?.craft ?? {};
const MIX = CONTRACT.plan?.mix ?? {};

const BODY_TOP = 140, FOOTER_TOP = 660;
const SOURCE_ROLES = new Set(["source-text", "source", "footnote", "footnote-text"]);
const TITLE_ROLES = new Set(["action-title", "section-title", "kicker", "page-tag"]);
const CHART = (c) => String(c).startsWith("chart.");
const TABLE = (c) => /^(table|comparison-table|heatmap|trend-rows|insight-tree-table|matrix)$/.test(String(c));
const PICTURE = (c) => /^(image-frame|logo-collage|people|logos)$/.test(String(c));
// The rubric's own words: a page of type is "prose, bullets, quote blocks,
// numbered points, tinted cards of type". So a `cards` page is a page of type,
// and a process chain or a framework is not - the difference is whether the
// shape carries the argument or just holds the words.
const TYPE_IN_A_CONTAINER = (c) => /^(paragraph|bullet-list|insight|callout|statement|takeaways|cards|quote-cluster|evidence-note|panel)$/.test(String(c));

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** The page's body band, counted the way the calibration pass counted it:
 *  words between the title band and the footer, whatever component drew them. */
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

export function measureScene(scene, name = "deck") {
  const content = scene.slides.filter((s) => (s.nodes ?? []).some((n) => n.role === "action-title"));
  if (!content.length) throw new Error(`No content pages in ${name}`);
  const statistics = designStatistics(scene);
  const families = content.map((slide) => {
    const components = (slide.componentInstances ?? []).map((c) => String(c.component));
    if (components.some(CHART)) return "chart";
    if (components.some(TABLE)) return "table";
    if (components.some(PICTURE)) return "picture";
    if (components.some((c) => !["chrome", "slide-chrome", "section", "page-template"].includes(c)
                              && !TYPE_IN_A_CONTAINER(c))) return "diagram";
    return "text";
  });
  const share = (family) => families.filter((f) => f === family).length / families.length;
  const rate = (test) => content.filter(test).length / content.length;
  return {
    deck: name,
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
  };
}

export function measureDeck(directory) {
  const scene = JSON.parse(readFileSync(path.join(directory, "scene.json"), "utf8"));
  return measureScene(scene, path.basename(directory));
}

/** measure → [label, key, calibration target, what the gate asks for]. */
export const ROWS = [
  ["body words a page", "bodyWords", BENCHMARK.median ?? null, null],
  ["drawn elements a page", "marksPerPage", SLIDES.drawings ?? null, 12],
  ["phrase emphasised", "highlight", JUDGED.highlightedPhrase ?? null, null],
  ["source line", "source", JUDGED.sourceLine ?? null, null],
  ["pages carried by a chart", "chartShare", MIX.chart?.observed ?? null, MIX.chart?.min ?? null],
  ["pages carried by a table", "tableShare", MIX.table?.observed ?? null, MIX.table?.max ?? null],
  ["pages of type alone", "textShare", MIX.text?.observed ?? null, MIX.text?.max ?? null],
  ["tables treated", "tablesTreated", CRAFT.tableTreated?.observed ?? null, CRAFT.tableTreated?.min ?? null],
  ["charts annotated", "chartsAnnotated", CRAFT.chartAnnotated?.observed ?? null, CRAFT.chartAnnotated?.min ?? null],
];

const show = (value) => {
  if (value === null || value === undefined) return "-";
  if (typeof value !== "number") return String(value);
  return value > 0 && value <= 1 ? `${Math.round(value * 100)}%` : String(Math.round(value * 10) / 10);
};

export function compare(decks) {
  const width = Math.max(14, ...decks.map((d) => d.deck.length + 1));
  const lines = [["measure".padEnd(26), ...decks.map((d) => d.deck.padStart(width)), "target".padStart(9), "gate".padStart(7)].join("")];
  for (const [label, key, target, gate] of ROWS) {
    lines.push([label.padEnd(26), ...decks.map((d) => show(d[key]).padStart(width)), show(target).padStart(9), show(gate).padStart(7)].join(""));
  }
  return lines.join("\n");
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const directories = args.filter((a) => !a.startsWith("--")).filter((d) => existsSync(path.join(d, "scene.json")));
  if (!directories.length) {
    console.error("usage: compare.mjs <built deck directory>… [--json]");
    process.exit(1);
  }
  const decks = directories.map(measureDeck);
  console.log(args.includes("--json") ? JSON.stringify(decks, null, 2) : compare(decks));
}
