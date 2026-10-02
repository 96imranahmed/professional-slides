// Deck craft floors, measured on what was actually built.
//
// The plan gates advise on a deck's craft from what the plan records, and a
// plan can record `treatment: "plain"` on every table. These floors read the
// deck spec and the composed scene, which cannot be written around, and they
// block: a deck whose tables are all plain grids, whose charts are bare or
// compare two bars of one series, that repeats step diagrams, carries no icon
// or never introduces the players it compares is not delivered.
//
// They are floors, not targets. A deck well above them can still be flat, and
// the review judges that; a deck below them has not made the choices at all.

import { PLAN, DECK_LENGTH, applyRulesVersion } from "../weight.mjs";
import { photographsWaived } from "./plan_gates.mjs";
import { tableStatistics } from "../build-bars.mjs";
import { trivialChart, trendChart } from "../evidence.mjs";
import { registered } from "../errors.mjs";

export { trivialChart, trendChart };

export const CRAFT_CODES = Object.freeze({
  CRAFT_TRIVIAL_CHARTS: "too many charts compare two numbers, which a metric with its delta says better",
  CRAFT_NO_TREND: "a chart-heavy deck with no chart over time",
  CRAFT_TABLES_PLAIN: "most tables are plain grids with no treatment",
  CRAFT_CHARTS_BARE: "most charts have nothing marked on them",
  CRAFT_STEP_OVERUSE: "step and process diagrams recur far more often than the argument needs",
  CRAFT_NO_ICONS: "a long deck with no icon anywhere",
  CRAFT_NO_PICTURES: "a long deck about recognisable subjects with no photograph anywhere",
  CRAFT_PLAYERS_UNINTRODUCED: "the deck compares named players but never introduces them with their marks",
  CRAFT_EXHIBIT_VARIETY: "the deck draws on too few kinds of exhibit for its length",
  CRAFT_SOURCE_CODES: "source lines cite internal ledger codes instead of naming the publisher",
});

// "Source: E26+DXB+SKY+B777; exact URL in source ledger". A reader cannot look
// up E26; the source line names the publisher, the document and the date.
const SOURCE_CODE = /\b[A-Z][A-Z0-9]{1,6}(?:\+[A-Z][A-Z0-9]{1,6})+\b|\b(?:source|evidence|citation) (?:ledger|register)\b|\bsee ledger\b/i;
export const codedSource = (text) => SOURCE_CODE.test(String(text ?? ""));

// Decks shorter than DECK_LENGTH.craft are diagnostics and probes; the floors
// are about a deck's rhythm, which a handful of pages does not have. The
// deck-wide devices (icons, photographs, the exhibit range) are read from
// DECK_LENGTH.craftDevices, where a deck has room for all of them.
const CRAFT = PLAN.craft;
const STEP_TYPES = new Set(["steps", "process", "chevron-process", "staircase"]);
const ANNOTATION = /^(annotation-|chart-(bracket|delta|event-|highlight|reference|band|callout|change))/;

const exhibitsOf = (slide) => [slide.exhibit, ...(slide.exhibits || [])].filter((ex) => ex && typeof ex === "object");
const isChart = (ex) => String(ex.type ?? "").startsWith("chart.");

/** Two bars of one series that add up to a whole: a share drawn as a comparison. */
export function shareAsBars(ex) {
  if (!trivialChart(ex) || (ex.categories || []).length !== 2) return false;
  const values = (ex.series?.[0]?.values || []).map(Number);
  const total = values.reduce((a, b) => a + b, 0);
  return values.length === 2 && values.every((v) => v >= 0) && Math.abs(total - 100) <= 1.5;
}


export function craftFindings(spec, scene) {
  // A deck revised under older rules hears the rules introduced since as advisories.
  return applyRulesVersion(floorFindings(spec, scene), spec);
}

function floorFindings(spec, scene) {
  // A catalogue shows each component in its plain form so it can be copied;
  // it makes no argument, and the floors are about decks that do.
  if (spec.purpose === "catalogue") return [];
  const content = [...(spec.slides || []), ...(spec.appendix || [])].filter((s) => (!s.kind || s.kind === "content") && s.title);
  if (content.length < DECK_LENGTH.craft) return [];
  const findings = [];
  const block = (code, measured, threshold, repair, slides = null) => findings.push({ slide: slides, code: registered(CRAFT_CODES, code), severity: "blocker", measured, threshold, repair });
  const advise = (code, measured, threshold, repair) => findings.push({ slide: null, code: registered(CRAFT_CODES, code), severity: "advisory", measured, threshold, repair });

  const charts = content.flatMap((slide) => exhibitsOf(slide).filter(isChart).map((ex) => ({ slide, ex })));
  const trivial = charts.filter(({ ex }) => trivialChart(ex));
  // A share drawn as two bars (cargo 12, everything else 88) is never the right
  // chart, however few there are: it is a number, or one segment of a whole.
  const shares = trivial.filter(({ ex }) => shareAsBars(ex));
  if (charts.length >= 4 && (trivial.length / charts.length >= 0.2 || shares.length)) {
    block("CRAFT_TRIVIAL_CHARTS", { trivial: trivial.length, of: charts.length, pages: trivial.map(({ slide }) => slide.id ?? null) }, 0.2,
      `${trivial.length} of ${charts.length} charts plot two numbers of one series. Two numbers are a metric pair: set them as metrics with ` +
      "the delta, or give the chart what makes it evidence - the whole peer set ranked, the series over time with its CAGR, the share " +
      "each part takes, the gap to a benchmark, a ratio that normalises size (per seat, per head, per route). A chart earns its page " +
      "by showing a relationship the reader could not get from the numbers in the title." +
      (shares.length ? ` ${shares.length} of them draw a share as two bars (${shares.map(({ slide }) => slide.id).join(", ")}): state the share as a metric, or show it as one segment of a stacked bar beside the peers' mix.` : ""));
  }
  if (charts.length >= 8 && !charts.some(({ ex }) => trendChart(ex))) {
    advise("CRAFT_NO_TREND", { charts: charts.length, overTime: 0 }, 1,
      "Not one of the deck's charts runs over time. Most strategic questions have a history - revenue, volume, share, fleet, users - and a " +
      "series over five or more periods with its growth rate marked is often the page that makes the case. Find the public series (annual " +
      "reports, regulators, industry bodies) before settling for a snapshot.");
  }

  // The built deck's floors sit under the plan's targets on purpose
  // (weight.json plan.craft: `min` asks the plan, `blockBelow` stops the deck).
  const stats = sceneStatistics(scene);
  const treated = CRAFT.tableTreated, annotated = CRAFT.chartAnnotated;
  if (stats.tables >= treated.blockFrom && stats.tablesTreated / stats.tables < treated.blockBelow) {
    block("CRAFT_TABLES_PLAIN", { treated: stats.tablesTreated, of: stats.tables }, treated.blockBelow,
      `${stats.tablesTreated} of ${stats.tables} tables carry a treatment. A table that compares options on criteria wants Harvey balls or ` +
      "ratings; one that ranks wants bars in the cells; one that judges wants a check, cross or status column and an implication column; " +
      "one about named companies or products wants their logos. A plain grid is right for a record lookup, rarely for an argument.");
  }
  if (stats.charts >= annotated.blockFrom && stats.chartsAnnotated / stats.charts < annotated.blockBelow) {
    block("CRAFT_CHARTS_BARE", { annotated: stats.chartsAnnotated, of: stats.charts }, annotated.blockBelow,
      `${stats.chartsAnnotated} of ${stats.charts} charts mark anything on the plot. Put the finding where the eye already is: the CAGR on ` +
      "the growth arrow, the gap bracketed, the focal bar highlighted and the rest neutral, the target or benchmark as a reference line, " +
      "the event that explains the break flagged on the axis.");
  }

  const steps = content.filter((slide) => exhibitsOf(slide).some((ex) => STEP_TYPES.has(ex.type)));
  const stepMax = Math.max(2, Math.ceil(content.length / 25));
  if (steps.length > stepMax) {
    block("CRAFT_STEP_OVERUSE", { pages: steps.length, of: content.length, ids: steps.map((s) => s.id ?? null) }, stepMax,
      `${steps.length} pages are step or process diagrams, against ${stepMax} for a deck of this length. Most of them are not sequences a ` +
      "reader follows step by step: a set of options is a table with ratings, a plan over time is a timeline or gantt, parallel priorities " +
      "are icon cards, a path with gates is a roadmap, conditions are a checklist. Keep the steps diagram for the one page that is a genuine procedure.");
  }

  if (content.length >= DECK_LENGTH.craftDevices && stats.icons === 0) {
    block("CRAFT_NO_ICONS", { pages: content.length, icons: 0 }, 1,
      "No page carries an icon. The pages that list parallel categories - the three pillars of a case, the risks, the levers, the " +
      "segments - read faster with an icon per point (`pointsStyle: \"icon-lead\"`) or as icon cards.");
  }

  // Pictures: a deck about airlines, films, products or places with no
  // photograph reads as a spreadsheet. Logos do not count - they identify, they
  // do not show. `noPictures` states in a sentence why a deck has none, and
  // waives this alone (plan_gates.mjs photographsWaived).
  if (content.length >= DECK_LENGTH.craftDevices && stats.pictures === 0 && !photographsWaived(spec)) {
    block("CRAFT_NO_PICTURES", { pages: content.length, pictures: 0 }, 1,
      "No page carries a photograph. The cover, the section dividers and the pages about a recognisable subject - an aircraft, a cabin, " +
      "a hub, a city, a product - want one: `cover.image`, a divider `image`, `photo` on a page, or a photo column in a table. Plan each " +
      "as `{ alt, search }`: the build fetches a freely licensed photograph from Wikimedia Commons and credits it on a generated last " +
      "page; mark `fetch: false` on one that must come from the client. `noPictures` is for a deck whose subject has nothing to look at, stated in a sentence.");
  }

  const players = Array.isArray(spec.players) ? spec.players.filter((p) => p && (typeof p === "string" || p.name)) : [];
  if (players.length >= 3 && stats.logos === 0) {
    block("CRAFT_PLAYERS_UNINTRODUCED", { players: players.length, logoPages: 0 }, 1,
      `The deck compares ${players.length} named players and never shows their marks. Introduce them early on one page: each player's ` +
      "logo, what it is and the two or three numbers the deck will compare (a `logos` exhibit, or a table with a `logo` column). Later " +
      "pages can then name a player without the reader having to remember who it is. Plan each logo as `{ alt: \"<Name> logo\" }`: the build fetches it from the player's Wikipedia infobox.");
  }

  // One coded source is one too many, so this is a count, not a share.
  const coded = [...(spec.slides || []), ...(spec.appendix || [])].filter((slide) => codedSource(slide.source) || (slide.footnotes || []).some(codedSource));
  if (coded.length) {
    block("CRAFT_SOURCE_CODES", { pages: coded.length, example: String(coded[0].source ?? "").slice(0, 80) }, 0,
      `${coded.length} source line${coded.length === 1 ? "" : "s"} cite ledger codes ("${String(coded[0].source ?? "").slice(0, 60)}"). ` +
      "The reader has no ledger. Name each source as it would be cited: publisher, document, date - \"Emirates Group Annual Report 2025-26; " +
      "Dubai Airports, traffic release, Feb 2026\". Keep the URLs in sources.md.", coded.map((slide) => slide.id ?? null));
  }

  const perTen = content.length ? (stats.distinctExhibits / content.length) * 10 : 0;
  const sceneMin = CRAFT.exhibitVarietyPerTen.sceneMin;
  if (content.length >= DECK_LENGTH.craftDevices && perTen < sceneMin) {
    block("CRAFT_EXHIBIT_VARIETY", { distinct: stats.distinctExhibits, pages: content.length, perTen: Math.round(perTen * 10) / 10 }, sceneMin,
      `${stats.distinctExhibits} kinds of exhibit across ${content.length} pages. Go back through the pages and ask what each has to show: a ` +
      "ranking across many entities, a trend with its growth rate, a composition, a network on a map, a scorecard, a portrait of each player. " +
      "The catalogue has sixty exhibits; a deck of this length that uses a handful has chosen by habit.");
  }
  return findings;
}

/** What the built scene draws: its tables and how many carry a treatment, its charts and how many mark the finding, its anchors. */
export function sceneStatistics(scene) {
  let charts = 0, chartsAnnotated = 0, icons = 0, logos = 0, pictures = 0;
  // Tables are counted one definition for every treated share
  // (build-bars.mjs tableStatistics, gates/table-treatments.json).
  const { tables, treated: tablesTreated } = tableStatistics(scene);
  const kinds = new Set();
  for (const slide of scene?.slides || []) {
    if (!slide.nodes?.some((n) => n.role === "action-title") || /^picture-credits(?:-\d+)?$/.test(String(slide.id ?? ""))) continue;
    const components = (slide.componentInstances || []).map((c) => String(c.component));
    for (const c of components) if (!["slide-chrome", "section", "page-template", "chrome"].includes(c)) kinds.add(c);
    const roles = slide.nodes.map((n) => String(n.role ?? ""));
    // A chart-group composes its charts inside one instance, so its name does
    // not start with "chart."; its plotted marks still say it is a chart page.
    if (components.some((c) => c.startsWith("chart.") || c === "chart-group") || roles.includes("chart-mark")) {
      charts += 1;
      if (slide.nodes.some((n) => n.data?.highlighted) || roles.some((r) => ANNOTATION.test(r))) chartsAnnotated += 1;
    }
    icons += roles.filter((r) => /icon/.test(r)).length;
    logos += roles.filter((r) => /logo/.test(r) && r !== "cover-logo").length;
  }
  // Pictures anywhere, cover and dividers included, logos excluded.
  for (const slide of scene?.slides || []) for (const n of slide.nodes || []) {
    const role = String(n.role ?? "");
    if ((n.type === "image" || /image-frame|image-placeholder|table-photo|photo/.test(role)) && !/logo/.test(role)) pictures += 1;
  }
  return { tables, tablesTreated, charts, chartsAnnotated, icons, logos, pictures, distinctExhibits: kinds.size };
}
