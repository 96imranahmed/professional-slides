#!/usr/bin/env node
/**
 * Gates for the plan, not the page.
 *
 *   node runtime/gates/plan_gates.mjs deck.plan.json [--report out.json]
 *
 * Every other gate in this skill judges a rendered deck. By then fifty pages
 * exist and the remedy is a rewrite. The defects that matter most are decided
 * in the dot-dash - what kind of evidence each page carries, whether anything
 * is depicted, whether the deck is one page repeated - and all of them are
 * computable from a fifty-row table in under a second.
 *
 * Two decks with nothing in common that come out within two points of each
 * other on every exhibit family are not responding to content; they are taking
 * a default on every page. EVIDENCE_MIX merges charts and tables into one
 * bucket and asks for 45% of either, which an all-table deck satisfies best of
 * all, so the plan bands each family on its own.
 *
 * Exit 0 when the plan passes, 2 when it has findings, 1 on a crash.
 */
import { EXIT, UsageError, isMain, parseCli, readJsonSync, runCli, writeJsonSync } from "../cli.mjs";
import { PLAN, DECK_LENGTH, applyRulesVersion } from "../weight.mjs";
import { exhibitFamily } from "./variety_gates.mjs";
import { textWords } from "../text-contract.mjs";

/** Every code this file can emit, with the one line that says what it is about. */
export const PLAN_CODES = Object.freeze({
  PLAN_SCHEMA: "the plan is not a readable design record",
  PLAN_TITLE_LENGTH: "titles are written to the ceiling instead of to the target",
  PLAN_TABLE_SHARE: "too much of the deck is a table",
  PLAN_MEASURED_PAGES: "too little of the deck carries a measurement",
  PLAN_EXHIBIT_MIX: "one evidence family is outside its band",
  PLAN_EXHIBIT_RUN: "the same exhibit repeats down consecutive pages",
  PLAN_STYLE_ENTROPY: "the deck is built from too few page architectures",
  PLAN_VISUAL_ANCHOR: "a page enumerates named things and depicts none of them",
  PLAN_NO_PICTURES: "no page in the deck carries a photograph",
  PLAN_NO_ICONS: "no page in the deck carries an icon",
  PLAN_NO_INSIGHT: "no page states its conclusion in an insight",
  PLAN_TABLE_DEPTH: "the tables are planned too shallow to be worth a page",
  PLAN_TABLE_MONOTONY: "no table names a treatment, so every one of them is a plain grid",
  PLAN_UNANNOTATED_CHARTS: "charts planned with nothing marked on the plot",
  PLAN_NO_HIGHLIGHT: "no page names the phrase its reader should see first",
  PLAN_EXHIBIT_VARIETY: "the deck draws on too few of the exhibits it could use",
  PLAN_CHART_MONOTONY: "one chart type carries most of the deck's charts",
  PLAN_EXHIBIT_REASON: "a page took a default exhibit without saying why",
});

const finding = (page, code, measured, threshold, repair) => {
  if (!Object.hasOwn(PLAN_CODES, code)) throw new Error(`Unregistered plan gate code: ${code}`);
  return { page, code, measured, threshold, repair };
};

// --- reading the plan -------------------------------------------------------

// The fields of a plan page (references/storyline-records.md#the-plan-file).
const PLAN_FIELDS = new Set(["id", "n", "kind", "title", "exhibit", "variant", "why", "architecture", "anchors", "highlight",
  "treatment", "annotation", "insight", "rows", "items", "shape", "series", "sourceSlide", "pageType", "commentary"]);
// Other names a plan page may give a field. They are read into the field once,
// as the plan is read (readPlanPages); nothing after that reads an alias. A
// field given under both names keeps its own.
const PLAN_ALIASES = Object.freeze({ layout: "architecture", points: "items", dataShape: "shape", exhibitVariant: "variant", reason: "why", exhibitReason: "why" });

/** The plan's pages with every alias read into its field, and each field a page carries that the plan does not have. */
function readPlanPages(pages) {
  const unknown = [];
  const read = pages.map((page) => {
    const out = { ...page };
    for (const [alias, field] of Object.entries(PLAN_ALIASES)) {
      if (!Object.hasOwn(out, alias)) continue;
      out[field] ??= out[alias];
      delete out[alias];
    }
    for (const field of Object.keys(out)) if (!PLAN_FIELDS.has(field)) unknown.push({ page: page.id ?? page.n ?? null, field });
    return out;
  });
  return { pages: read, unknown };
}

const PICTURE_SHAPES = new Set(["picture-pair", "picture-strip", "picture-hero"]);

/**
 * Which evidence family a page belongs to. One page, one family, from the
 * exhibit the plan names (variety_gates.mjs exhibitFamily: chart, table,
 * numbers, picture, text, mixed or diagram). The family is the author's
 * declaration, so the plan's mix statistics only advise; the variety
 * contract enforces the same bands on the compiled pages.
 */
export function family(page) {
  if (page.kind && page.kind !== "content") return null;
  // The shape counts as well as the exhibit. A plan that writes `picture-pair`
  // in the architecture column has said the page is photographs, whatever it
  // then writes under exhibit - and the composer has three shapes that only a
  // picture page can take, so the two columns cannot disagree.
  const shape = String(page.architecture ?? "").trim();
  if (anchorsOf(page).some(isPhoto) || PICTURE_SHAPES.has(shape)) return "picture";
  return exhibitFamily(page.exhibit);
}

/** The page's anchors, where `false` means "deliberately none" and is not a list. */
const anchorsOf = (page) => (Array.isArray(page.anchors) ? page.anchors : []);

/**
 * Does this anchor say "photograph"?
 *
 * The key is the claim: `{ photo: "the Bucharest servicing centre" }` and
 * `{ image: "skyline.jpg" }` are photographs whatever their value says, as are
 * a bare "photo ..." string and an object whose `kind` says so. A device gate
 * that misses a photograph the plan declared is worse than no gate: the
 * deck-wide device gates are exactly the ones an author reads as settled.
 */
const isPhoto = (anchor) => {
  if (typeof anchor === "string") return /^(photo|image)\b/i.test(anchor);
  if (!anchor || typeof anchor !== "object") return false;
  if (typeof anchor.photo === "string" || typeof anchor.image === "string") return true;
  return /^(photo|image)\b/i.test(String(anchor.kind ?? ""));
};
const isIcon = (anchor) => {
  if (typeof anchor === "string") return !/^(photo|image)\b/i.test(anchor);
  return Boolean(anchor?.icon);
};

/**
 * The page's architecture, for the entropy count.
 *
 * The plan declares it; where it does not, the family is a coarse stand-in so
 * the plan still measures rather than crashing.
 */
const ARCHITECTURES = new Set([
  "evidence-with-commentary", "evidence-only", "paired-evidence", "evidence-stack", "evidence-grid",
  "reconciliation", "metrics-over-evidence", "hero-number-with-evidence", "metrics-with-text",
  "picture-led", "card-grid", "text", "steps", "cycle", "journey", "timeline", "process",
  "chevron-process", "flow", "roadmap", "tree", "organization", "matrix", "quadrants",
  "horizons", "gantt", "relationship-network",
]);
const ARCHITECTURE_ALIASES = {
  "exhibit-full": "evidence-only", "shared-rows": "evidence-only",
  "two-up": "paired-evidence", "two-up-contrast": "paired-evidence", "table-halves": "paired-evidence",
  "split-tone": "evidence-with-commentary", "stack": "evidence-stack",
  "hero-number": "hero-number-with-evidence", "metrics-over-exhibit": "metrics-over-evidence",
  "picture-pair": "picture-led", "picture-strip": "picture-led", "picture-hero": "picture-led",
};

export function architecture(page) {
  if (page.kind && page.kind !== "content") return null;
  const shape = String(page.architecture || `auto:${family(page)}`);
  if (["exhibit-left", "exhibit-right", "exhibit-top", "evidence-with-side-commentary", "evidence-over-commentary"].includes(shape)
      || /^(?:chart|table)[- /].*(?:two|three|2|3)[- ]col/i.test(shape)) return "evidence-with-commentary";
  const normalized = ARCHITECTURE_ALIASES[shape] ?? shape;
  // A new name for an old reading task must not manufacture entropy. The
  // specific mechanism belongs in `why`; unclassified plans cannot pass.
  return ARCHITECTURES.has(normalized) ? normalized : null;
}

/** Did the author actually choose a shape for this page, or is it inferred? */
const declaresArchitecture = (page) => architecture(page) !== null;

// --- the entropy metric -----------------------------------------------------

/**
 * Normalised Shannon entropy over page architectures, with declared series runs
 * collapsed to one observation each.
 *
 * A share test - no architecture past 40% - cannot see a deck
 * that holds every architecture just under the cap and still reads as a
 * pattern. Entropy can: it is highest when the pages are spread evenly over the
 * repertoire and falls as any one of them dominates, which is the property the
 * deck actually wants maximised.
 *
 * A deliberate run is not monotony. Six pages enumerating use-cases off one
 * template is a design decision, and counting them six times would punish the
 * author for making it, so a `series` name collapses its run to a single
 * observation before the count.
 */
export function styleEntropy(pages) {
  const observations = [];
  let lastSeries = null;
  for (const page of pages) {
    const shape = architecture(page);
    if (!shape) continue;
    const series = page.series ? String(page.series) : null;
    if (series && series === lastSeries) continue;
    lastSeries = series;
    observations.push(shape);
  }
  const counts = new Map();
  for (const shape of observations) counts.set(shape, (counts.get(shape) || 0) + 1);
  const n = observations.length, k = counts.size;
  const declared = pages.every(declaresArchitecture);
  if (n === 0 || k <= 1) return { value: 0, distinct: k, pages: n, counts, declared };
  let h = 0;
  for (const count of counts.values()) { const p = count / n; h -= p * Math.log(p); }
  return { value: h / Math.log(k === 1 ? 2 : k), distinct: k, pages: n, counts, declared };
}

// --- gates ------------------------------------------------------------------

function gateTitles(pages, findings) {
  const titles = pages.filter((p) => !p.kind || p.kind === "content").map((p) => String(p.title ?? ""));
  if (!titles.length) return;
  const words = titles.map(textWords);
  const over = words.filter((w) => w > PLAN.titleWords.target).length;
  const share = over / words.length;
  if (share <= PLAN.titleWords.overShareMax) return;
  const sorted = [...words].sort((a, b) => a - b);
  findings.push(finding(
    null, "PLAN_TITLE_LENGTH",
    { median: sorted[Math.floor(sorted.length / 2)], max: Math.max(...words), overTarget: over, pages: words.length },
    PLAN.titleWords.target,
    `A title of ${PLAN.titleWords.target} words or fewer sets on one line, and a one-line title is what makes the ` +
    `title band, its rule and the content below it sit the same way on every page. The page gate's ${PLAN.titleWords.max}-word limit is ` +
    "a ceiling, not a target: written to, it makes two-line titles the norm. Cut to the claim.",
  ));
}

function gateMix(pages, findings) {
  const families = pages.map(family).filter(Boolean);
  const total = families.length;
  if (total < DECK_LENGTH.plan) return;
  const count = (name) => families.filter((f) => f === name).length;
  const share = (name) => count(name) / total;

  // Charts and tables are different evidence and get different bands. Merged,
  // a deck of 43% tables and 31% charts scores 74% on one combined floor and
  // passes more comfortably than a balanced deck would.
  if (share("table") > PLAN.mix.table.max) {
    findings.push(finding(
      null, "PLAN_TABLE_SHARE",
      { share: round(share("table")), pages: count("table"), of: total },
      PLAN.mix.table.max,
      "Review whether each table serves a shared lookup or comparison task. Column count alone does not decide: " +
      "a two-column exact-value lookup can be useful, while generic advice may read better as an icon-led list. " +
      "This share is advisory; do not replace useful matrices to meet a target percentage.",
    ));
  }
  const measured = share("chart") + share("table");
  if (measured < PLAN.measuredMin) {
    findings.push(finding(
      null, "PLAN_MEASURED_PAGES",
      { share: round(measured), pages: count("chart") + count("table"), of: total },
      PLAN.measuredMin,
      "Most analytical pages should carry a measurement. Add the chart or the table the argument rests on.",
    ));
  }
  for (const [name, band] of Object.entries(PLAN.mix)) {
    if (name === "table" || name.startsWith("$") || typeof band !== "object") continue; // table is reported above with its own code
    const value = share(name);
    if (band.min !== undefined && value < band.min) {
      findings.push(finding(
        null, "PLAN_EXHIBIT_MIX",
        { family: name, share: round(value), pages: count(name), of: total, direction: "below",
          target: band.observed },
        band.min,
        `The deck carries too few ${name} pages. Strong decks run ${pc(band.observed)} ` +
        `${name} pages; the floor sits under that so a real deck would pass it. A family at zero is a family ` +
        "nobody considered.",
      ));
    }
    if (band.max !== undefined && value > band.max) {
      findings.push(finding(
        null, "PLAN_EXHIBIT_MIX",
        { family: name, share: round(value), pages: count(name), of: total, direction: "above",
          target: band.observed },
        band.max,
        name === "text"
          ? `${count(name)} of ${total} pages carry no exhibit at all. Strong decks run ` +
            `${pc(band.observed)} pages of type alone - that is a real page, not a failure - but past ` +
            "this the deck is an essay with a template around it. Give the argument something to stand on."
          : `The deck leans on ${name === "numbers" ? "metric tiles, fact grids and cards" : `${name} pages`}` +
            `${band.observed === undefined ? "" : `; strong decks run ${pc(band.observed)}`}.`,
      ));
    }
  }
}

/** A share as the finding prints it: 0.371 -> "37%". */
const pc = (value) => (value === undefined ? "few" : `${Math.round(value * 100)}%`);

function gateRuns(pages, findings) {
  const content = pages.filter((p) => !p.kind || p.kind === "content");
  let run = [];
  const flush = () => {
    if (run.length > PLAN.runMax && !run[0].series) {
      findings.push(finding(
        run[0].n ?? null, "PLAN_EXHIBIT_RUN",
        { exhibit: String(run[0].exhibit ?? "text"), run: run.length, pages: run.map((p) => p.n) },
        PLAN.runMax,
        `${run.length} consecutive pages on the same exhibit read as one page repeated. Break the run with a ` +
        "different shape of evidence, or mark it as a deliberate `series` if the pages are one template on purpose.",
      ));
    }
    run = [];
  };
  for (const page of content) {
    const key = String(page.exhibit ?? "text");
    if (run.length && key === String(run[0].exhibit ?? "text")) run.push(page);
    else { flush(); run = [page]; }
  }
  flush();
}

function gateEntropy(pages, findings) {
  const content = pages.filter((p) => !p.kind || p.kind === "content");
  const unknown = content.filter(p => p.architecture && !declaresArchitecture(p));
  if (unknown.length) {
    findings.push(finding(null, "PLAN_STYLE_ENTROPY",
      { entropy: null, reason: "unrecognized architecture", pages: unknown.map(p => p.id ?? p.n),
        names: [...new Set(unknown.map(p => p.architecture))] },
      [...ARCHITECTURES],
      "Classify the actual reading relationship using the normalized Design vocabulary. Keep task-specific " +
      "names and mechanisms in `why`. A table of explanations beside a chart is evidence-with-commentary; " +
      "table borders and new labels do not create an independent evidence relationship."));
    return;
  }
  if (content.length < DECK_LENGTH.plan) return;
  const entropy = styleEntropy(content);
  // Without a declared architecture per page the only thing left to count is
  // the evidence family, which has four or five values against the composer's
  // twelve shapes - so the number comes out high and means nothing. A gate that
  // passes on missing data is the failure this whole stage exists to stop, so
  // it reports the absence instead of the score.
  if (!entropy.declared) {
    findings.push(finding(
      null, "PLAN_STYLE_ENTROPY",
      { entropy: null, reason: "one or more pages have no normalized architecture", observations: entropy.pages },
      PLAN.entropyMin,
      "Page architecture is not recorded in this plan, so the deck's variety cannot be measured before it is built - " +
      "and measuring it afterwards is what makes the remedy a rewrite. Name the shape each page takes " +
      "(`exhibit-left`, `exhibit-top`, `hero-number`, `two-up`, `picture-pair`, `text`, …) in the plan.",
    ));
    return;
  }
  const commonest = [...entropy.counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (entropy.value >= PLAN.entropyMin && (commonest?.[1] ?? 0) / entropy.pages <= 0.4) return;
  findings.push(finding(
    null, "PLAN_STYLE_ENTROPY",
    { entropy: round(entropy.value), architectures: entropy.distinct, observations: entropy.pages,
      commonest: commonest?.[0], commonestPages: commonest?.[1] },
    PLAN.entropyMin,
    "Too many pages share one normalized evidence relationship. Reconsider the argument before rotating layouts: " +
    "use paired measures, a reconciliation, a genuine dependency or decision structure, a calendar, or an integrated " +
    "comparison where that relationship is present in the evidence. Two versus three commentary columns, " +
    "mirroring, colour and an insight strip do not create distinct architectures. A series exception requires " +
    "a real repeated comparison task and reviewer justification.",
  ));
}

/**
 * PLAN_VISUAL_ANCHOR. A page that enumerates named things depicts them.
 *
 * The rule is one anchor per named item, and the form follows the thing: a
 * photograph for something depictable (a character, a city, a product), an icon
 * for a category or a concept. It is the same rule either way - the page is a
 * set of named things and the reader should be able to tell them apart without
 * reading - and it is the main route out of a deck that is 43% tables, because
 * most of those tables are "five categories and what each means", which is an
 * icon list.
 *
 * Restraint is half of it. An anchor belongs on a *set of named things*, not on
 * everything: a deck that puts an icon on every page is the same failure to
 * choose as one that puts an icon on none.
 */
function gateAnchors(pages, findings) {
  const content = pages.filter((p) => !p.kind || p.kind === "content");
  for (const page of content) {
    const items = Number(page.items ?? 0);
    const enumerated = items >= PLAN.anchor.itemsFrom && items <= PLAN.anchor.itemsTo;
    if (!enumerated) continue;
    if (family(page) === "chart") continue; // the marks are the anchor
    const anchors = anchorsOf(page);
    if (anchors.length >= items) continue;
    if (page.anchors === false) continue; // the author said no, on purpose
    findings.push(finding(
      page.n ?? null, "PLAN_VISUAL_ANCHOR",
      { items, anchors: anchors.length },
      items,
      `This page names ${items} things and depicts ${anchors.length} of them. Give each one an anchor: a photograph ` +
      "where the thing is depictable (a character, a city, a product) and an icon where it is a category or a " +
      "concept. The photographs have three architectures - `picture-hero` for one subject, `picture-pair` for two, " +
      "`picture-strip` for three to five - and the icons go on `cards`, a `rows` list or an icon-led points column. " +
      "Set `anchors: false` if the page is deliberately unanchored.",
    ));
  }
}

/**
 * The craft gates: what the plan records about how a page is *made*, not which
 * family its evidence belongs to.
 *
 * A deck can pass every gate above and still read as dry. The example decks'
 * tables run a median of six rows and 47% of them carry a treatment; 36% of
 * their charts carry an annotation; their point lists name a highlighted
 * phrase; and they draw on seven to eight distinct exhibits per ten pages.
 *
 * None of that is a matter of judgement alone: what is not written down is
 * not chosen - the same mechanism, one level finer, as the exhibit mix.
 */
const CRAFT = PLAN.craft;
const tablePages = (pages) => pages.filter((p) => family(p) === "table");
const chartPages = (pages) => pages.filter((p) => family(p) === "chart");
/** The rows a page says its table carries: `rows: 8`, or "8x4" in `shape`. */
function plannedRows(page) {
  if (Number.isFinite(page.rows)) return page.rows;
  const shape = String(page.shape ?? "");
  const match = shape.match(/(\d+)\s*[x\u00d7]\s*\d+/i);
  return match ? Number(match[1]) : null;
}
const TREATMENTS = /\b(heat|bubble|bar|harvey|implication|verdict|highlight\w*|total|derive|rank|share|change|index|group|recommend\w*)\b/i;
const ANNOTATIONS = /\b(annotat\w*|callout|bracket|flag|reference|baseline|target|band|cagr|change|growth|period|event|highlight\w*|focus)\b/i;
/**
 * What the page is, at the grain a reader notices.
 *
 * Two pages both reading `table` may be a twelve-row heat matrix and a
 * three-row grid; counted as one kind they make a deck look more varied than it
 * is. Where the plan records the variant it counts, and where it does not the
 * type stands alone - which means recording variants can only ever raise the
 * measured variety, never lower it, and a plan that records none is judged
 * on its types alone.
 */
const exhibitKey = (page) => {
  const type = String(page.exhibit ?? "").trim();
  if (!type) return "";
  const variant = String(page.variant ?? "").trim().toLowerCase();
  return variant ? `${type}/${variant}` : type;
};

/**
 * The exhibits a plan reaches for when it has not decided anything.
 *
 * These are all fine exhibits and often the right one; the point is that
 * choosing one of them is where a default hides - a plan that has decided
 * nothing puts over half its pages on four of them - so it is the one place
 * worth making the plan say why.
 */
const DEFAULT_EXHIBITS = new Set(["table", "chart.column", "chart.bar", "steps", "bullet-list", "text", "rows"]);
const reasoned = (page) => String(page.why ?? "").trim().length >= 12;

// A treatment or an annotation named outright, else read off what the page does record.
const treated = (page) => TREATMENTS.test(String(page.treatment ?? page.variant ?? ""));
const annotated = (page) => ANNOTATIONS.test(String(page.annotation ?? page.treatment ?? page.variant ?? ""));

function gateCraft(pages, findings) {
  const content = pages.filter((p) => !p.kind || p.kind === "content");
  if (content.length < DECK_LENGTH.plan) return;
  const tables = tablePages(content), charts = chartPages(content);

  if (tables.length) {
    const measured = tables.map(plannedRows).filter((n) => Number.isFinite(n));
    if (!measured.length) {
      findings.push(finding(null, "PLAN_TABLE_DEPTH",
        { median: null, reason: "no table page records its size", tables: tables.length }, CRAFT.tableRows.min,
        "Record the actual row and column counts so capacity can be assessed. A short matrix may be complete; " +
        "a conceptual list may read better as rows or icons. Judge the evidence relationship and measured fit, " +
        "not a required number of rows."));
    } else {
      const sorted = [...measured].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (median < CRAFT.tableRows.min) {
        findings.push(finding(null, "PLAN_TABLE_DEPTH",
          { median, tables: tables.length, measured: sorted }, CRAFT.tableRows.min,
          `The planned median is ${median} rows. Inspect whether these are complete matrices or underdeveloped lists. ` +
          "Choose a smaller measured group or a more suitable encoding when appropriate; do not add rows or " +
          "derived columns merely to reach a depth statistic."));
      }
    }
    const share = tables.filter(treated).length / tables.length;
    if (share < CRAFT.tableTreated.min) {
      findings.push(finding(null, "PLAN_TABLE_MONOTONY",
        { share: round(share), treated: tables.filter(treated).length, of: tables.length }, CRAFT.tableTreated.min,
        "Inspect omitted and misused treatments: distinct category classes can use filled category cells; " +
        "repeated membership and individual records stay plain. Keep a verdict joined unless an authored inference " +
        "arrow requires a gutter. Counts, ratings and highlights need explicit semantics. Record the chosen " +
        "treatment or intentional plain construction; this advisory is not a decoration quota."));
    }
  }

  if (charts.length) {
    const share = charts.filter(annotated).length / charts.length;
    if (share < CRAFT.chartAnnotated.min) {
      findings.push(finding(null, "PLAN_UNANNOTATED_CHARTS",
        { share: round(share), annotated: charts.filter(annotated).length, of: charts.length }, CRAFT.chartAnnotated.min,
        "Check whether the title needs a visible target, capacity, event or comparison annotation. Show that premise " +
        "on the plot or beside it when it is required to support the claim. A readable neutral comparison may need " +
        "no extra mark. Record useful reference lines or explicit focus in the plan; do not add decoration to hit a share."));
    }
  }

  // Variety, counted as distinct exhibits per ten pages rather than as entropy.
  // Entropy normalises by the number of exhibits used, so a deck that runs the
  // same three shapes evenly scores as well as one that runs twenty.
  const kinds = new Set(content.map(exhibitKey).filter(Boolean));
  const perTen = content.length ? (kinds.size / content.length) * 10 : 0;
  if (kinds.size && perTen < CRAFT.exhibitVarietyPerTen.min) {
    findings.push(finding(null, "PLAN_EXHIBIT_VARIETY",
      { perTen: round(perTen), distinct: kinds.size, pages: content.length }, CRAFT.exhibitVarietyPerTen.min,
      `This deck draws on ${kinds.size} exhibits across ${content.length} pages - ${round(perTen)} per ten, against ` +
      `${CRAFT.exhibitVarietyPerTen.observed.join(", ")} in the example decks. The catalogue is far wider than the ` +
      "handful a plan reaches for by default: a sequence can be a timeline or a gantt rather than a fourth " +
      "staircase, a composition can be a marimekko or a waffle, a ranking a lollipop, a distribution a boxplot or " +
      "a dumbbell, two measures on one category a combo. Ask what each page's evidence actually is before " +
      "reaching for the shape the last page used."));
  }

  // One chart type doing most of the charting. Distinct exhibits per ten pages
  // can look healthy while every chart in the deck is a column chart: the
  // windowed count sees tables, diagrams and text pages between them. What a
  // reader notices is the same chart coming back, so count the charts alone.
  const chartTypes = content.map((p) => String(p.exhibit ?? "").trim()).filter((t) => t.startsWith("chart."));
  if (chartTypes.length >= CRAFT.chartTypeShare.fromCharts) {
    const tally = {};
    for (const t of chartTypes) tally[t] = (tally[t] || 0) + 1;
    const [top, n] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    const share = n / chartTypes.length;
    if (share > CRAFT.chartTypeShare.max) {
      findings.push(finding(null, "PLAN_CHART_MONOTONY",
        { chart: top, count: n, of: chartTypes.length, share: round(share) }, CRAFT.chartTypeShare.max,
        `${n} of this deck's ${chartTypes.length} charts are ${top}. Go back through the pages that use it and ask ` +
        "what each one has to show: a ranking reads as a lollipop, a composition as a waffle or a stacked column, " +
        "change between two points as a dumbbell or slope, movement in rank as a rank-flow, a share of a population " +
        "as a pictogram. Design's selector table maps each message to its slide type. Keep the pages where the " +
        "column genuinely is the right chart; change the ones that took it by default."));
    }
  }

  // Why this exhibit, on the pages where a default hides.
  const defaulted = content.filter((p) => DEFAULT_EXHIBITS.has(String(p.exhibit ?? "").trim()));
  const unexplained = defaulted.filter((p) => !reasoned(p));
  if (defaulted.length >= 4 && unexplained.length / defaulted.length > CRAFT.reasonShareMax) {
    findings.push(finding(
      unexplained[0].n ?? null, "PLAN_EXHIBIT_REASON",
      { unexplained: unexplained.length, of: defaulted.length, pages: unexplained.slice(0, 8).map((p) => p.n) },
      CRAFT.reasonShareMax,
      "These pages take one of the exhibits a plan reaches for when it has not decided anything - a table, a column " +
      "or bar chart, a staircase, a list - and none of them says why. Each is often the right answer; the point is " +
      "that choosing one is where a default hides, and writing the reason is where it gets noticed. One phrase " +
      "against the exhibit is enough: \"magnitude over time\", \"ranking, sorted\", \"genuinely a matrix: three " +
      "dimensions over the same rows\". A page that cannot produce the phrase has not chosen its exhibit yet.",
    ));
  }
}

/**
 * `noPictures`: the one honest way out of carrying photographs, and the only
 * thing it waives. It is a sentence saying why this deck carries none - the
 * subjects are trademarked, the site is confidential, there is nothing to
 * photograph - and a deck that has a reason states it once and is not asked
 * again (PLAN_NO_PICTURES here, CRAFT_NO_PICTURES on the built deck). It does
 * not waive logos, which identify the players a deck compares
 * (CRAFT_PLAYERS_UNINTRODUCED, PLAYERS_UNMARKED, PROFILE_UNPICTURED), nor
 * icons, which mark categories (PLAN_NO_ICONS, CRAFT_NO_ICONS): a deck with
 * nothing to photograph still has names and categories to mark. A deck with no
 * reason is asked, because the alternative to asking is a placeholder - an
 * empty gradient rectangle with a note that it stands in for a specimen image -
 * and a placeholder with an apology beside it is worse than a page of type.
 */
export const photographsWaived = (deck) => textWords(deck?.noPictures) >= 3;

function gateDeckWideDevices(pages, findings, plan = {}) {
  const content = pages.filter((p) => !p.kind || p.kind === "content");
  if (content.length < DECK_LENGTH.plan) return;
  const anchors = content.flatMap(anchorsOf);
  if (!anchors.some(isPhoto) && !photographsWaived(plan)) {
    findings.push(finding(
      null, "PLAN_NO_PICTURES",
      { pages: content.length, photographs: 0 }, 1,
      "Not one page carries a photograph. A well-made page averages 29 drawn elements; a deck of type and rules " +
      "averages very few. Any subject a reader would recognise - a film, a product, a brand, a place, a person - " +
      "wants its picture, and the cover and section dividers are the cheapest places to start. A picture the " +
      "author has to supply, such as a poster or a product shot, is not a reason to go without: plan it as " +
      "`{ alt }`, ask for the file, and record the use the author is entitled to make of it as its `credit`. " +
      "`noPictures` is for a deck whose subject genuinely has nothing to look at - a number, a process, a " +
      "confidential site - and says so in a sentence. An empty frame is a draft, never a delivery; " +
      "UNSOURCED_PICTURE stops it at the render.",
    ));
  }
  if (!anchors.some(isIcon)) {
    findings.push(finding(
      null, "PLAN_NO_ICONS",
      { pages: content.length, icons: 0 }, 1,
      "Not one page carries an icon, from a vocabulary of 48. Any page that enumerates named categories wants one " +
      "per category - the capability is already built into cards, rows lists and points columns.",
    ));
  }
  const highlighted = content.filter((p) => String(p.highlight ?? "").trim() && String(p.highlight).trim() !== "none").length;
  if (highlighted === 0) {
    findings.push(finding(
      null, "PLAN_NO_HIGHLIGHT",
      { pages: content.length, highlighted: 0 }, 1,
      "No page names the phrase its reader should see first. `highlight` sets one phrase inside a point in the " +
      "house accent - \"**Improved quality of care** for patients\" - which is how a well-made page emphasises the " +
      "finding inside a sentence instead of bolding the whole line or breaking it onto its own. It is not wanted " +
      "on every point, and a deck that uses it nowhere has left the emphasis to the reader.",
    ));
  }
  const insights = content.filter((p) => p.insight && p.insight !== "none").length;
  if (insights === 0) {
    findings.push(finding(
      null, "PLAN_NO_INSIGHT",
      { pages: content.length, insights: 0 }, 1,
      "No page states its conclusion in an insight. The closing band is what turns a page of evidence into a page " +
      "that argues; `filled` or `outline` per page, or `none` where the title already carries it.",
    ));
  }
}

const round = (n) => Math.round(n * 1000) / 1000;

// --- driver -----------------------------------------------------------------

export function runPlanGates(plan, { deck } = {}) {
  const findings = [];
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.pages)) {
    findings.push(finding(null, "PLAN_SCHEMA", "absent", "professional-slides.plan/v1",
      "The plan needs a `pages` array, one row per page, each naming its exhibit, architecture and anchors."));
    return report(plan, findings, [], deck);
  }
  const { pages, unknown } = readPlanPages(plan.pages);
  if (unknown.length) findings.push(finding(null, "PLAN_SCHEMA", { unknownFields: unknown }, [...PLAN_FIELDS],
    `A plan page carries fields the plan does not have (${unknown.slice(0, 6).map((u) => `\`${u.field}\`${u.page === null ? "" : ` on ${u.page}`}`).join(", ")}${unknown.length > 6 ? ", ..." : ""}); ` +
    "nothing reads them. Record the page under the plan's own fields (references/storyline-records.md#the-plan-file)."));
  gateTitles(pages, findings);
  gateMix(pages, findings);
  gateRuns(pages, findings);
  gateEntropy(pages, findings);
  gateAnchors(pages, findings);
  gateCraft(pages, findings);
  gateDeckWideDevices(pages, findings, plan);
  return report(plan, findings, pages, deck);
}

// The plan's blocking codes. Everything else it reports rests on labels the
// author declared, which can be wrong, and so advises.
const PLAN_BLOCKING = new Set(["PLAN_SCHEMA", "PLAN_EXHIBIT_REASON", "PLAN_STYLE_ENTROPY"]);

function report(plan, findings, pages, deck = plan) {
  const content = pages.filter((p) => !p.kind || p.kind === "content");
  const families = content.map(family).filter(Boolean);
  const total = families.length || 1;
  const shareOf = (name) => round(families.filter((f) => f === name).length / total);
  const entropy = content.length ? styleEntropy(content) : { value: 0, distinct: 0 };
  const counts = {};
  for (const code of Object.keys(PLAN_CODES)) {
    const n = findings.filter((f) => f.code === code).length;
    if (n) counts[code] = n;
  }
  const reported = applyRulesVersion(findings.map((f) => ({ ...f, severity: PLAN_BLOCKING.has(f.code) ? "blocker" : "advisory" })), deck ?? {});
  return {
    schema: "professional-slides.plan-gates/v1",
    id: plan?.id ?? null,
    pages: pages.length,
    contentPages: content.length,
    statistics: {
      mix: { chart: shareOf("chart"), table: shareOf("table"), diagram: shareOf("diagram"), numbers: shareOf("numbers"),
             mixed: shareOf("mixed"), picture: shareOf("picture"), text: shareOf("text") },
      styleEntropy: entropy.declared ? round(entropy.value) : null,
      architectures: entropy.declared ? entropy.distinct : null,
      exhibitVarietyPerTen: content.length ? round((new Set(content.map(exhibitKey).filter(Boolean)).size / content.length) * 10) : 0,
      variantsRecorded: content.filter((p) => String(p.variant ?? "").trim()).length,
      reasonsRecorded: content.filter(reasoned).length,
      tablesTreated: tablePages(content).length ? round(tablePages(content).filter(treated).length / tablePages(content).length) : null,
      chartsAnnotated: chartPages(content).length ? round(chartPages(content).filter(annotated).length / chartPages(content).length) : null,
      anchoredPages: content.filter((p) => Array.isArray(p.anchors) && p.anchors.length).length,
      insightPages: content.filter((p) => p.insight && p.insight !== "none").length,
    },
    reference: { mix: Object.fromEntries(Object.entries(PLAN.mix).filter(([k]) => !k.startsWith("$"))),
                 styleEntropy: PLAN.entropyMin, observed: PLAN.entropyObserved, craft: PLAN.craft },
    accepted: reported.every((f) => f.severity !== "blocker"),
    countsByCode: counts,
    findings: reported,
  };
}

if (isMain(import.meta.url)) runCli((argv) => {
  const usage = "Usage: plan_gates.mjs deck.plan.json [--report out.json]";
  const { values, positionals: [file] } = parseCli(argv, { report: { type: "string" } }, { usage });
  if (!file) throw new UsageError(usage);
  const result = runPlanGates(readJsonSync(file));
  if (values.report) writeJsonSync(values.report, result);
  console.log(JSON.stringify(result, null, 2));
  return result.accepted ? EXIT.ok : EXIT.refused;
});
