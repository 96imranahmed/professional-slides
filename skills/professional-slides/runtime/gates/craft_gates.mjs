// Deck craft floors, measured on what was actually built.
//
// A 62-page deck shipped with every table a plain grid (0 of 16 treated),
// every chart bare (0 of 16 annotated), eleven of its sixteen charts comparing
// two bars of one series, five step diagrams, no icon anywhere and no page
// introducing the six airlines it compared. The plan gates had said most of
// this - as advisories - and the plan itself recorded `treatment: "plain"` on
// every table, which is easy to write and says nothing. These floors read the
// deck spec and the composed scene, which cannot be written around, and they
// block: a deck under them is not delivered.
//
// They are floors, not targets. A deck well above them can still be flat, and
// the review judges that; a deck below them has not made the choices at all.

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
});

// Decks shorter than this are diagnostics and probes; the floors are about a
// deck's rhythm, which a handful of pages does not have.
const FROM_PAGES = 12;
const PERIOD = /^(?:(?:19|20)\d{2}(?:[EFP]|\s*[EF])?|FY\s?'?\d{2,4}|[QH][1-4]\b.*|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b.*|\d{4}[-–]\d{2,4})$/i;
const STEP_TYPES = new Set(["steps", "process", "chevron-process", "staircase"]);
// Zebra striping is house style, not a decision about the evidence, so it does not count.
const TREATMENT = /^table-(bubble|bar|rating-|implication|column-band|row-band|harvey|status-pill|number-circle|lamp|dot|check|progress-|cell-icon|section-marker|section-number)|^table-logo$|^table-photo$/;
const ANNOTATION = /^(annotation-|chart-(bracket|delta|event-|highlight|reference|band|callout|change))/;

const exhibitsOf = (slide) => [slide.exhibit, ...(slide.exhibits || [])].filter((ex) => ex && typeof ex === "object");
const isChart = (ex) => String(ex.type ?? "").startsWith("chart.");

/** A chart that shows two numbers of one series: a metric pair with a chart drawn round it. */
export function trivialChart(ex) {
  if (!isChart(ex) || ["chart.scatter", "chart.bubble", "chart.bubble-grid", "chart.waffle"].includes(ex.type)) return false;
  const series = Array.isArray(ex.series) ? ex.series.length : 1;
  const categories = Array.isArray(ex.categories) ? ex.categories.length : Array.isArray(ex.rows) ? ex.rows.length : Infinity;
  return series <= 1 && categories <= 2;
}

/** A chart over time: four or more period categories. */
export function trendChart(ex) {
  const categories = Array.isArray(ex.categories) ? ex.categories.map(String) : [];
  return isChart(ex) && categories.length >= 4 && categories.filter((c) => PERIOD.test(c.trim())).length >= Math.ceil(categories.length * 0.75);
}

export function craftFindings(spec, scene) {
  // A catalogue shows each component in its plain form so it can be copied;
  // it makes no argument, and the floors are about decks that do.
  if (spec.purpose === "catalogue") return [];
  const content = [...(spec.slides || []), ...(spec.appendix || [])].filter((s) => (!s.kind || s.kind === "content") && s.title);
  if (content.length < FROM_PAGES) return [];
  const findings = [];
  const block = (code, measured, threshold, repair, slides = null) => findings.push({ slide: slides, code, severity: "blocker", measured, threshold, repair });
  const advise = (code, measured, threshold, repair) => findings.push({ slide: null, code, severity: "advisory", measured, threshold, repair });

  const charts = content.flatMap((slide) => exhibitsOf(slide).filter(isChart).map((ex) => ({ slide, ex })));
  const trivial = charts.filter(({ ex }) => trivialChart(ex));
  if (charts.length >= 4 && trivial.length / charts.length > 0.25) {
    block("CRAFT_TRIVIAL_CHARTS", { trivial: trivial.length, of: charts.length, pages: trivial.map(({ slide }) => slide.id ?? null) }, 0.25,
      `${trivial.length} of ${charts.length} charts plot two numbers of one series. Two numbers are a metric pair: set them as metrics with ` +
      "the delta, or give the chart what makes it evidence - the whole peer set ranked, the series over time with its CAGR, the share " +
      "each part takes, the gap to a benchmark, a ratio that normalises size (per seat, per head, per route). A chart earns its page " +
      "by showing a relationship the reader could not get from the numbers in the title.");
  }
  if (charts.length >= 8 && !charts.some(({ ex }) => trendChart(ex))) {
    advise("CRAFT_NO_TREND", { charts: charts.length, overTime: 0 }, 1,
      "Not one of the deck's charts runs over time. Most strategic questions have a history - revenue, volume, share, fleet, users - and a " +
      "series over five or more periods with its growth rate marked is often the page that makes the case. Find the public series (annual " +
      "reports, regulators, industry bodies) before settling for a snapshot.");
  }

  const stats = sceneStatistics(scene);
  if (stats.tables >= 4 && stats.tablesTreated / stats.tables < 0.5) {
    block("CRAFT_TABLES_PLAIN", { treated: stats.tablesTreated, of: stats.tables }, 0.5,
      `${stats.tablesTreated} of ${stats.tables} tables carry a treatment. A table that compares options on criteria wants Harvey balls or ` +
      "ratings; one that ranks wants bars in the cells; one that judges wants a check, cross or status column and an implication column; " +
      "one about named companies or products wants their logos. A plain grid is right for a record lookup, rarely for an argument.");
  }
  if (stats.charts >= 6 && stats.chartsAnnotated / stats.charts < 0.3) {
    block("CRAFT_CHARTS_BARE", { annotated: stats.chartsAnnotated, of: stats.charts }, 0.3,
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

  if (content.length >= 20 && stats.icons === 0) {
    block("CRAFT_NO_ICONS", { pages: content.length, icons: 0 }, 1,
      "No page carries an icon. The pages that list parallel categories - the three pillars of a case, the risks, the levers, the " +
      "segments - read faster with an icon per point (`pointsStyle: \"icon-lead\"`) or as icon cards.");
  }

  // Pictures: a deck about airlines, films, products or places with no
  // photograph reads as a spreadsheet. Logos do not count - they identify, they
  // do not show. `noPictures` states in a sentence why a deck has none.
  const excused = String(spec.noPictures ?? "").trim().split(/\s+/).filter(Boolean).length >= 3;
  if (content.length >= 20 && stats.pictures === 0 && !excused) {
    block("CRAFT_NO_PICTURES", { pages: content.length, pictures: 0 }, 1,
      "No page carries a photograph. The cover, the section dividers and the pages about a recognisable subject - an aircraft, a cabin, " +
      "a hub, a city, a product - want one: `cover.image`, a divider `image`, `photo` on a page, or a photo column in a table. Name the " +
      "pictures and ask for them; plan the unsourced ones as `{ alt }`. `noPictures` is for a deck whose subject has nothing to look at, stated in a sentence.");
  }

  const players = Array.isArray(spec.players) ? spec.players.filter((p) => p && (typeof p === "string" || p.name)) : [];
  if (players.length >= 3 && stats.logos === 0) {
    block("CRAFT_PLAYERS_UNINTRODUCED", { players: players.length, logoPages: 0 }, 1,
      `The deck compares ${players.length} named players and never shows their marks. Introduce them early on one page: each player's ` +
      "logo, what it is and the two or three numbers the deck will compare (a `logos` exhibit, or a table with a `logo` column). Later " +
      "pages can then name a player without the reader having to remember who it is. A logo not yet sourced is planned as `{ alt }` and asked for.");
  }

  const perTen = content.length ? (stats.distinctExhibits / content.length) * 10 : 0;
  if (content.length >= 20 && perTen < 2) {
    block("CRAFT_EXHIBIT_VARIETY", { distinct: stats.distinctExhibits, pages: content.length, perTen: Math.round(perTen * 10) / 10 }, 2,
      `${stats.distinctExhibits} kinds of exhibit across ${content.length} pages. Go back through the pages and ask what each has to show: a ` +
      "ranking across many entities, a trend with its growth rate, a composition, a network on a map, a scorecard, a portrait of each player. " +
      "The catalogue has sixty exhibits; a deck of this length that uses a handful has chosen by habit.");
  }
  return findings;
}

function sceneStatistics(scene) {
  let tables = 0, tablesTreated = 0, charts = 0, chartsAnnotated = 0, icons = 0, logos = 0, pictures = 0;
  const kinds = new Set();
  for (const slide of scene?.slides || []) {
    if (!slide.nodes?.some((n) => n.role === "action-title")) continue;
    const components = (slide.componentInstances || []).map((c) => String(c.component));
    for (const c of components) if (!["slide-chrome", "section", "page-template", "chrome"].includes(c)) kinds.add(c);
    const roles = slide.nodes.map((n) => String(n.role ?? ""));
    if (components.some((c) => /^(table|comparison-table|heatmap|trend-rows)$/.test(c))) {
      tables += 1;
      if (roles.some((r) => TREATMENT.test(r))) tablesTreated += 1;
    }
    if (components.some((c) => c.startsWith("chart."))) {
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
