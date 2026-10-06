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
//
// The build bars (build-bars.mjs) are read here too, on the same scene and by
// the definition delivery reads them: a deck that delivery would refuse for a
// bar is refused for it at the compile and the build, with the number, and a
// waived bar is an advisory until the reviewer confirms it. Where a rate
// falls under its craft floor as well - most tables plain, most charts bare -
// the one finding is the craft floor's, which no waiver lifts.

import { GENERATED, PLAN, DECK_LENGTH, applyRulesVersion, carriedCount, isAnalyticalPage } from "../weight.mjs";
import { photographsWaived } from "./plan_gates.mjs";
import { BUILD_BAR_CODES, barStandings, barsNotHeld, chartStatistics, countedTables, pageChartAnnotated, tableStatistics, tableTreated } from "../build-bars.mjs";
import { trivialChart, trendChart } from "../evidence.mjs";
import { registered } from "../errors.mjs";
import { assetsDeclaration } from "../asset-needs.mjs";
import { playerNames } from "./variety_gates.mjs";

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

const exhibitsOf = (slide) => [slide.exhibit, ...(slide.exhibits || [])].filter((ex) => ex && typeof ex === "object");
const isChart = (ex) => String(ex.type ?? "").startsWith("chart.");

/** Two bars of one series that add up to a whole: a share drawn as a comparison. */
export function shareAsBars(ex) {
  if (!trivialChart(ex) || (ex.categories || []).length !== 2) return false;
  const values = (ex.series?.[0]?.values || []).map(Number);
  const total = values.reduce((a, b) => a + b, 0);
  return values.length === 2 && values.every((v) => v >= 0) && Math.abs(total - 100) <= 1.5;
}


/**
 * The deck's craft findings. `standings`, when given, takes where the deck
 * stands against each floor and each build bar, broken or not (the record
 * variety_gates.mjs and gate_config.py write), for the author's report.
 * `scene` is the pages the runtime drew: on a revision that carries slides,
 * the pages it composed, which is where the build bars are held.
 */
export function craftFindings(spec, scene, { standings = [], picturesSupplied = 0 } = {}) {
  const floors = floorFindings(spec, scene, standings, picturesSupplied);
  // One finding a rate: under its craft floor a rate is refused by that floor, and the finding says what the build bar asks beyond it.
  const bars = barFindings(spec, scene, standings).flatMap((f) => {
    const under = floors.find((floor) => floor.code === CRAFT_UNDER_BAR[f.code] && floor.severity === "blocker");
    if (!under) return [f];
    under.repair = `${under.repair} The build bar ${f.code} asks more than this floor: ${f.standing}.`;
    return [];
  });
  // A deck revised under older rules hears the rules introduced since as advisories.
  return applyRulesVersion([...bars, ...floors], spec);
}

// The craft floor that reads the same rate as each build bar, lower down.
const CRAFT_UNDER_BAR = Object.freeze({ BAR_TABLES_TREATED: "CRAFT_TABLES_PLAIN", BAR_CHARTS_ANNOTATED: "CRAFT_CHARTS_BARE" });
// What mends each bar, said with the number.
const BAR_REPAIRS = Object.freeze({
  BAR_EXHIBIT_VARIETY: "Go back through the pages and ask what each has to show - a ranking, a trend with its growth rate, a composition, a network on a map, a scorecard, a portrait of each player - and draw the ones that repeat a neighbour's exhibit as the exhibit their evidence is",
  BAR_TABLES_TREATED: "Give each plain table the treatment its reading task asks for: Harvey balls or ratings where it compares options on criteria, bars in the cells where it ranks, a check, cross or status column and an implication column where it judges, logos where it is about named companies",
  BAR_CHARTS_ANNOTATED: "Put the finding where the eye already is on each bare chart: the growth rate on an arrow, the gap bracketed, the focal bar highlighted, the target or benchmark as a reference line, the event that explains a break flagged on the axis",
  BAR_DRAWINGS_PER_PAGE: "The pages are rules and paragraphs: set the evidence as exhibits - a table with its treatment, a chart, cards or tiles - rather than as text on the canvas",
  BAR_UNSOURCED_PICTURES: "A photograph planned as `{ alt }` with no file is an empty frame: put the file in assets/pictures/ (or give the picture its `path` and `credit`), let the build fetch it, or take the picture off the page",
});
const WAIVE = (code) => `If the deck is right to miss this bar, record \`waivers: [{ "code": "${code}", "reason": "<a sentence saying why>" }]\` on \`deck\`: the miss is then an advisory here, and at delivery the reviewer is shown the waiver and must confirm it`;

/**
 * The build bars as the compile and the build hold them (build-bars.mjs
 * barStandings: the one definition delivery reads, over the same pages). A
 * miss nothing covers blocks - the refusal delivery has always made of every
 * deck, whatever version it records, so the bars are no version's rule and
 * the three stages hold one thing - and names the pages that hold the rate
 * down; a waived miss is an advisory. On a revision that
 * carries slides the scene is the pages it composed: the bar is held on
 * those, as delivery holds it, and the finding says the carried slides are
 * not counted.
 */
function barFindings(spec, scene, standings) {
  const { outcome, standings: read } = barStandings(scene, spec.waivers || [], { purpose: spec.purpose ?? null, carried: carriedCount(spec) });
  standings.push(...read);
  const line = Object.fromEntries(read.map((standing) => [standing.code, standing]));
  const idOf = (slide) => String(slide.sourceSlideId ?? slide.id);
  const notHeld = barsNotHeld(new Set((scene?.slides || []).map(idOf)).size, carriedCount(spec));
  const analytical = (scene?.slides || []).filter((slide, index) => isAnalyticalPage(slide, index));
  // The pages that hold each rate down, by the count the bar itself makes.
  const holding = { BAR_TABLES_TREATED: (slide) => countedTables(slide).some((table) => !tableTreated(slide, table)), BAR_CHARTS_ANNOTATED: (slide) => pageChartAnnotated(slide) === false,
    BAR_UNSOURCED_PICTURES: (slide) => (slide.nodes || []).some((n) => String(n.role ?? "") === "image-frame") };
  const pagesOf = (code) => (holding[code] ? [...new Set(analytical.filter(holding[code]).map(idOf))] : []);
  const stood = (f) => { const st = line[f.code]; return st.of ? `${st.count} of ${st.of} ${st.counted[1]} (${Math.round((st.count / st.of) * 100)}%) against the delivery floor of ${Math.round(st.bar * 100)}%: ${-st.margin} more reach it`
    : f.floor !== undefined ? `${f.measured} ${st.unit} against the delivery floor of ${f.floor}` : `${f.measured} ${st.unit} against a delivery cap of ${f.ceiling}`; };
  const listed = (ids) => (ids.length ? ` (holding it down: ${ids.slice(0, 12).join(", ")}${ids.length > 12 ? ", ..." : ""})` : "");
  const finding = (f, severity, pages, repair, more = {}) => ({ slide: null, code: registered(BUILD_BAR_CODES, f.code), severity, measured: f.measured, threshold: f.floor ?? f.ceiling, standing: stood(f),
    ...(pages.length ? { pages } : {}), repair, ...more });
  return [
    ...outcome.unwaived.map((f) => finding(f, "blocker", pagesOf(f.code), `${stood(f)}${listed(pagesOf(f.code))}${notHeld ? ` - ${notHeld}` : ""}. Delivery refuses the deck for this bar, and the compile and the build hold it by the same number over the same pages. ${BAR_REPAIRS[f.code]}. ${WAIVE(f.code)}`)),
    ...outcome.waived.map((f) => finding(f, "advisory", pagesOf(f.code), `${stood(f)}${notHeld ? ` - ${notHeld}` : ""}. The deck waives this bar ("${f.reason}"), so nothing is refused here; delivery shows the waiver to the reviewer, who must confirm it`, { waivedBy: f.reason })),
  ];
}

function floorFindings(spec, scene, standings, picturesSupplied) {
  // A catalogue shows each component in its plain form so it can be copied;
  // it makes no argument, and the floors are about decks that do.
  if (spec.purpose === "catalogue") return [];
  const content = [...(spec.slides || []), ...(spec.appendix || [])].filter((s) => (!s.kind || s.kind === "content") && s.title);
  const stand = (code, what, value, bar, side, more = {}) => standings.push({ code: registered(CRAFT_CODES, code), what, value, bar, side, applies: true, blocks: true, ...more });
  if (content.length < DECK_LENGTH.craft) {
    stand("CRAFT_EXHIBIT_VARIETY", "content pages (the craft floors are read from this many)", content.length, DECK_LENGTH.craft, "min", { unit: "pages", applies: false });
    return [];
  }
  const long = content.length >= DECK_LENGTH.craftDevices;
  const findings = [];
  const block = (code, measured, threshold, repair, slides = null) => findings.push({ slide: slides, code: registered(CRAFT_CODES, code), severity: "blocker", measured, threshold, repair });
  const advise = (code, measured, threshold, repair) => findings.push({ slide: null, code: registered(CRAFT_CODES, code), severity: "advisory", measured, threshold, repair });

  const charts = content.flatMap((slide) => exhibitsOf(slide).filter(isChart).map((ex) => ({ slide, ex })));
  const trivial = charts.filter(({ ex }) => trivialChart(ex));
  // A share drawn as two bars (cargo 12, everything else 88) is never the right
  // chart, however few there are: it is a number, or one segment of a whole.
  const shares = trivial.filter(({ ex }) => shareAsBars(ex));
  // The rule blocks at a fifth of the charts, so the most it allows is one fewer than that.
  stand("CRAFT_TRIVIAL_CHARTS", "charts plotting two numbers of one series", trivial.length, Math.max(0, Math.ceil(0.2 * charts.length - 1e-9) - 1), "max",
    { unit: "charts", applies: charts.length >= 4, pages: trivial.map(({ slide }) => slide.id ?? null) });
  stand("CRAFT_NO_TREND", "charts running over time", charts.filter(({ ex }) => trendChart(ex)).length, 1, "min", { unit: "charts", applies: charts.length >= 8, blocks: false });
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
      "Not one of the deck's charts runs over time. Most strategic questions have a history - revenue, volume, share, capacity, users - and a " +
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
  stand("CRAFT_STEP_OVERUSE", "step or process diagram pages", steps.length, stepMax, "max", { unit: "pages", pages: steps.map((s) => s.id ?? null) });
  if (steps.length > stepMax) {
    block("CRAFT_STEP_OVERUSE", { pages: steps.length, of: content.length, ids: steps.map((s) => s.id ?? null) }, stepMax,
      `${steps.length} pages are step or process diagrams, against ${stepMax} for a deck of this length. Most of them are not sequences a ` +
      "reader follows step by step: a set of options is a table with ratings, a plan over time is a timeline or gantt, parallel priorities " +
      "are icon cards, a path with gates is a roadmap, conditions are a checklist. Keep the steps diagram for the one page that is a genuine procedure.");
  }

  stand("CRAFT_NO_ICONS", "icons drawn", stats.icons, 1, "min", { unit: "icons", applies: long });
  // A deck that declares it is built without the network (asset-needs.mjs) and was supplied no photograph has none to
  // show: the floor on photographs is advised, not held, as the floor on logos is, and the reviews are told. `noPictures`
  // keeps its own meaning - a subject with nothing to look at - and is not what an offline build writes.
  const unpictured = assetsDeclaration(spec).fetch === "none" && !picturesSupplied;
  stand("CRAFT_NO_PICTURES", "photographs drawn", stats.pictures, 1, "min", { unit: "pictures", applies: long && !photographsWaived(spec), blocks: !unpictured });
  if (content.length >= DECK_LENGTH.craftDevices && stats.icons === 0) {
    block("CRAFT_NO_ICONS", { pages: content.length, icons: 0 }, 1,
      "No page carries an icon. The pages that list parallel categories - the three pillars of a case, the risks, the levers, the " +
      "segments - read faster with an icon per point (`pointsStyle: \"icon-lead\"`) or as icon cards.");
  }

  // Pictures: a deck about companies, films, products or places with no
  // photograph reads as a spreadsheet. Logos do not count - they identify, they
  // do not show. `noPictures` states in a sentence why a deck has none, and
  // waives this alone (plan_gates.mjs photographsWaived).
  if (content.length >= DECK_LENGTH.craftDevices && stats.pictures === 0 && !photographsWaived(spec) && unpictured) {
    advise("CRAFT_NO_PICTURES", { pages: content.length, pictures: 0, assets: "none" }, 1,
      `No page carries a photograph: the deck declares it is built without the network ("${assetsDeclaration(spec).reason}") and no photograph is supplied in assets/pictures/, ` +
      "so none is expected and the reviewers are told. To carry photographs, put each file in assets/pictures/ beside the pages file (or give a picture its own `path` and `credit`) " +
      "and plan it on the cover, a divider or the page about its subject. A photograph a page still plans as `{ alt }` stays an empty frame, which delivery refuses (`BAR_UNSOURCED_PICTURES`).");
  } else if (content.length >= DECK_LENGTH.craftDevices && stats.pictures === 0 && !photographsWaived(spec)) {
    block("CRAFT_NO_PICTURES", { pages: content.length, pictures: 0 }, 1,
      "No page carries a photograph. The cover, the section dividers and the pages about a recognisable subject - a product, a site, " +
      "a building, a city, a team - want one: `cover.image`, a divider `image`, `photo` on a page, or a photo column in a table. Plan each " +
      "as `{ alt, search }`: the build fetches a freely licensed photograph from Wikimedia Commons and credits it on a generated last " +
      "page; mark `fetch: false` on one that must come from the client. `noPictures` is for a deck whose subject has nothing to look at, stated in a sentence; " +
      "a deck built with no network and no photograph supplied declares that instead (`assets: { fetch: \"none\", reason }`).");
  }

  const players = Array.isArray(spec.players) ? spec.players.filter((p) => p && (typeof p === "string" || p.name)) : [];
  // A deck that declares it is built without the network (asset-needs.mjs)
  // cannot show a mark it has no file for: it introduces its players by
  // name, and the missing logos are said - here, in the build result and to
  // the reviewer - rather than blocking a deck that could never clear them.
  const offline = assetsDeclaration(spec).fetch === "none";
  const unnamed = offline && players.length >= 3 && stats.logos === 0 ? unnamedPlayers(spec, scene) : [];
  // Where the deck stands says the same: under the declaration the floor advises once every player is named on a page.
  stand("CRAFT_PLAYERS_UNINTRODUCED", "player logos drawn", stats.logos, 1, "min", { unit: "logos", applies: players.length >= 3, blocks: !offline || unnamed.length > 0 });
  if (players.length >= 3 && stats.logos === 0) {
    if (offline && !unnamed.length) advise("CRAFT_PLAYERS_UNINTRODUCED", { players: players.length, logoPages: 0, assets: "none" }, 1,
      `The deck compares ${players.length} named players and shows none of their marks: it declares it is built without the network ("${assetsDeclaration(spec).reason}"), ` +
      "so they are introduced by name. The reviewer is told the logos were not available. To show the marks, put each player's logo in assets/logos/ beside the pages file and rebuild.");
    else block("CRAFT_PLAYERS_UNINTRODUCED", { players: players.length, logoPages: 0, ...(offline ? { assets: "none", unnamed } : {}) }, 1,
      offline ? `The deck is built without the network, so its players are introduced by name, and ${unnamed.join(", ")} ${unnamed.length === 1 ? "is" : "are"} named on no page. Introduce every player early on one page: ` +
        "a `logo` cell that names its `player` (it prints the name while no file is there), with what the player is and the numbers the deck will compare."
      : `The deck compares ${players.length} named players and never shows their marks. Introduce them early on one page: each player's ` +
      "logo, what it is and the two or three numbers the deck will compare (a `logos` exhibit, or a table with a `logo` column). Later " +
      "pages can then name a player without the reader having to remember who it is. Plan each logo as `{ alt: \"<Name> logo\" }`: the build fetches it from the player's Wikipedia infobox. " +
      "With no network at the build, either put each logo in assets/logos/ beside the pages file (the compile lists the file names) or declare `assets: { fetch: \"none\", reason }` on the deck, under which the players are introduced by name.");
  }

  // One coded source is one too many, so this is a count, not a share.
  // A source the deck's registry declares is cited by the name its record gives it, and a record may be of a document that is
  // itself called a ledger ("Official-source ledger supplied with the brief"): that is the source named, not a pointer to one the
  // reader lacks. So the names the registry declares are set aside before a line is read for codes.
  const declared = Object.values(spec.sources && typeof spec.sources === "object" ? spec.sources : {}).flatMap((entry) => [entry?.name, entry?.short]).filter((name) => typeof name === "string" && name.trim().length > 3).sort((x, y) => y.length - x.length);
  const typed = (text) => declared.reduce((line, name) => line.split(name).join(" "), String(text ?? ""));
  const coded = [...(spec.slides || []), ...(spec.appendix || [])].filter((slide) => codedSource(typed(slide.source)) || (slide.footnotes || []).some((note) => codedSource(typed(note))));
  if (coded.length) {
    block("CRAFT_SOURCE_CODES", { pages: coded.length, example: String(coded[0].source ?? "").slice(0, 80) }, 0,
      `${coded.length} source line${coded.length === 1 ? "" : "s"} cite ledger codes ("${String(coded[0].source ?? "").slice(0, 60)}"). ` +
      "The reader has no ledger. Name each source as it would be cited: publisher, document, date - \"Northvale Rail Annual Report 2025-26; " +
      "Office of Rail Statistics, quarterly release, Feb 2026\". Keep the URLs in sources.md. A document that is itself a ledger or a register is cited by declaring it in the pages file's `sources` registry (`{ name, status }`) and naming its key: a declared record's name is read as the source's name.", coded.map((slide) => slide.id ?? null));
  }

  const perTen = content.length ? (stats.distinctExhibits / content.length) * 10 : 0;
  const sceneMin = CRAFT.exhibitVarietyPerTen.sceneMin;
  stand("CRAFT_EXHIBIT_VARIETY", `kinds of exhibit composed (${sceneMin} per ten pages)`, stats.distinctExhibits, Math.ceil((sceneMin * content.length) / 10 - 1e-9), "min", { unit: "kinds", applies: long });
  if (content.length >= DECK_LENGTH.craftDevices && perTen < sceneMin) {
    block("CRAFT_EXHIBIT_VARIETY", { distinct: stats.distinctExhibits, pages: content.length, perTen: Math.round(perTen * 10) / 10 }, sceneMin,
      `${stats.distinctExhibits} kinds of exhibit across ${content.length} pages. Go back through the pages and ask what each has to show: a ` +
      "ranking across many entities, a trend with its growth rate, a composition, a network on a map, a scorecard, a portrait of each player. " +
      "The catalogue has sixty exhibits; a deck of this length that uses a handful has chosen by habit.");
  }
  return findings;
}

// What is not a page's content when asking whether it names a player: the
// citation, the footer and its notes, picture credits, and the runtime's own
// navigation furniture, which repeats section titles on every page. A player
// named only in a source line has been cited, not introduced.
const NOT_CONTENT = /^(?:page-number|footer|source|footnote|note|tracker|agenda|divider-contents|picture-credit|image-credit)/;
// A name is printed where it stands as whole words: "Rus" is not named by "Russia", nor "Alder" by "Alderney".
const namedIn = (text, alias) => {
  for (let at = text.indexOf(alias); at >= 0; at = text.indexOf(alias, at + 1))
    if (!/[\p{L}\p{N}]/u.test(text[at - 1] ?? "") && !/[\p{L}\p{N}]/u.test(text[at + alias.length] ?? "")) return true;
  return false;
};

/**
 * The declared players no page of the scene names, by any of their names:
 * under an offline declaration a name is the introduction. A name counts
 * where a page's content prints it as whole words - its title, its exhibit's
 * cells and labels, its body - and not in a source line, a footer or a note.
 */
function unnamedPlayers(spec, scene) {
  // A composed text node holds its lines as set: a name wrapped over two lines in a narrow cell is still the name.
  const printed = (scene?.slides || []).flatMap((slide) => (slide.nodes || []).filter((n) => n.type === "text" && !NOT_CONTENT.test(String(n.role ?? ""))).map((n) => String(n.text ?? "").replace(/\s+/g, " "))).join(" \n ").toLowerCase();
  const aliases = [...playerNames(spec.players)];
  return [...new Set(aliases.map(([, name]) => name))].filter((name) => !aliases.some(([alias, owner]) => owner === name && namedIn(printed, alias)));
}

/** What the built scene draws: its tables and how many carry a treatment, its charts and how many mark the finding, its anchors. */
export function sceneStatistics(scene) {
  let icons = 0, logos = 0, pictures = 0;
  // Tables and chart pages are counted by one definition each, the build
  // bars' (build-bars.mjs tableStatistics, chartStatistics; gates/table-treatments.json).
  const { tables, treated: tablesTreated } = tableStatistics(scene);
  const { charts, annotated: chartsAnnotated } = chartStatistics(scene);
  const kinds = new Set();
  for (const slide of scene?.slides || []) {
    if (!slide.nodes?.some((n) => n.role === "action-title") || GENERATED.test(String(slide.id ?? ""))) continue;
    const components = (slide.componentInstances || []).map((c) => String(c.component));
    for (const c of components) if (!["slide-chrome", "section", "page-template", "chrome"].includes(c)) kinds.add(c);
    const roles = slide.nodes.map((n) => String(n.role ?? ""));
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
