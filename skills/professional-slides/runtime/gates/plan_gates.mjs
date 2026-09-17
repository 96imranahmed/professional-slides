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
 * Two cold-run decks made this concrete. A comic-book franchise comparison and
 * a personal relocation decision, nothing in common, came out within two points
 * of each other on every exhibit family: 31% charts, 42% and 44% tables, zero
 * images, zero icons. That is not a response to content, it is a default being
 * taken forty-five times, and every gate the skill had passed it - because
 * EVIDENCE_MIX merges charts and tables into one bucket and asks for 45% of
 * either, which an all-table deck satisfies best of all.
 *
 * Exit 0 when the plan passes, 2 when it has findings, 1 on a crash.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CONTRACT = JSON.parse(readFileSync(new URL("../weight.json", import.meta.url), "utf8"));
const PLAN = CONTRACT.plan;

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
});

const finding = (page, code, measured, threshold, repair) => {
  if (!Object.hasOwn(PLAN_CODES, code)) throw new Error(`Unregistered plan gate code: ${code}`);
  return { page, code, measured, threshold, repair };
};

// --- reading the plan -------------------------------------------------------

const TABLE_LIKE = new Set(["table", "rows", "compare", "phase-table", "matrix"]);
const PICTURE_LIKE = new Set(["image", "photo", "picture-pair", "picture-strip", "picture-hero"]);
const TEXT_LIKE = new Set(["text", "", undefined, null]);

/** Which evidence family a page belongs to. One page, one family. */
export function family(page) {
  if (page.kind && page.kind !== "content") return null;
  const exhibit = String(page.exhibit ?? "").trim();
  // The shape counts as well as the exhibit. A plan that writes `picture-pair`
  // in the architecture column has said the page is photographs, whatever it
  // then writes under exhibit - and the composer has three shapes that only a
  // picture page can take, so the two columns cannot disagree.
  const shape = String(page.architecture ?? page.layout ?? "").trim();
  if (anchorsOf(page).some(isPhoto) || PICTURE_LIKE.has(exhibit) || PICTURE_LIKE.has(shape)) return "picture";
  if (exhibit.startsWith("chart.")) return "chart";
  if (exhibit === "metrics") return "chart";
  if (TABLE_LIKE.has(exhibit)) return "table";
  if (TEXT_LIKE.has(exhibit)) return "text";
  return "diagram";
}

/** The page's anchors, where `false` means "deliberately none" and is not a list. */
const anchorsOf = (page) => (Array.isArray(page.anchors) ? page.anchors : []);

const isPhoto = (anchor) => {
  const value = typeof anchor === "string" ? anchor : anchor?.photo ?? anchor?.image;
  return typeof value === "string" && /^(photo|image)\b/i.test(String(anchor?.kind ?? value));
};
const isIcon = (anchor) => {
  if (typeof anchor === "string") return !/^(photo|image)\b/i.test(anchor);
  return Boolean(anchor?.icon);
};

/**
 * The page's architecture, for the entropy count.
 *
 * The plan declares it; where it does not, the family is a coarse stand-in so a
 * plan written before this record existed still measures rather than crashing.
 */
export function architecture(page) {
  if (page.kind && page.kind !== "content") return null;
  return String(page.architecture || page.layout || `auto:${family(page)}`);
}

/** Did the author actually choose a shape for this page, or is it inferred? */
const declaresArchitecture = (page) => Boolean(page.architecture || page.layout);

// --- the entropy metric -----------------------------------------------------

/**
 * Normalised Shannon entropy over page architectures, with declared series runs
 * collapsed to one observation each.
 *
 * The share test this replaces - no architecture past 40% - cannot see a deck
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
  const declared = pages.some(declaresArchitecture);
  if (n === 0 || k <= 1) return { value: 0, distinct: k, pages: n, counts, declared };
  let h = 0;
  for (const count of counts.values()) { const p = count / n; h -= p * Math.log(p); }
  return { value: h / Math.log(k === 1 ? 2 : k), distinct: k, pages: n, counts, declared };
}

// --- gates ------------------------------------------------------------------

function gateTitles(pages, findings) {
  const titles = pages.filter((p) => !p.kind || p.kind === "content").map((p) => String(p.title ?? ""));
  if (!titles.length) return;
  const words = titles.map((t) => t.trim().split(/\s+/).filter(Boolean).length);
  const over = words.filter((w) => w > PLAN.titleWords.target).length;
  const share = over / words.length;
  if (share <= PLAN.titleWords.overShareMax) return;
  const sorted = [...words].sort((a, b) => a - b);
  findings.push(finding(
    null, "PLAN_TITLE_LENGTH",
    { median: sorted[Math.floor(sorted.length / 2)], max: Math.max(...words), overTarget: over, pages: words.length },
    PLAN.titleWords.target,
    `A title of ${PLAN.titleWords.target} words or fewer sets on one line, and a one-line title is what makes the ` +
    "title band, its rule and the content below it sit the same way on every page. The page gate's 14-word limit is " +
    "a ceiling, not a target: written to, it makes two-line titles the norm. Cut to the claim.",
  ));
}

function gateMix(pages, findings) {
  const families = pages.map(family).filter(Boolean);
  const total = families.length;
  if (total < PLAN.from) return;
  const count = (name) => families.filter((f) => f === name).length;
  const share = (name) => count(name) / total;

  // Charts and tables are different evidence and get different bands. Merging
  // them is what let a deck of 43% tables and 31% charts score 74% on one
  // combined floor and pass more comfortably than a balanced deck would.
  if (share("table") > PLAN.mix.table.max) {
    findings.push(finding(
      null, "PLAN_TABLE_SHARE",
      { share: round(share("table")), pages: count("table"), of: total },
      PLAN.mix.table.max,
      "A table is the right answer when the content is genuinely a matrix - three or more dimensions compared across " +
      "the same rows. It is the wrong answer, and the commonest default, for two columns of sentences: that is a " +
      "comparison panel, a rows list with an icon per category, or a chart. Reference decks run about 13% tables.",
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
    if (name === "table") continue; // reported above with its own code
    const value = share(name);
    if (band.min !== undefined && value < band.min) {
      findings.push(finding(
        null, "PLAN_EXHIBIT_MIX",
        { family: name, share: round(value), pages: count(name), of: total, direction: "below" },
        band.min,
        `The deck carries too few ${name} pages. These bands are calibrated on the example decks and are guidelines: ` +
        "move them with judgement, but a family at zero is a family nobody considered.",
      ));
    }
  }
}

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
  if (content.length < PLAN.from) return;
  const entropy = styleEntropy(content);
  // Without a declared architecture per page the only thing left to count is
  // the evidence family, which has four or five values against the composer's
  // twelve shapes - so the number comes out high and means nothing. A gate that
  // passes on missing data is the failure this whole stage exists to stop, so
  // it reports the absence instead of the score.
  if (!entropy.declared) {
    findings.push(finding(
      null, "PLAN_STYLE_ENTROPY",
      { entropy: null, reason: "no page declares an architecture", observations: entropy.pages },
      PLAN.entropyMin,
      "Page architecture is not recorded in this plan, so the deck's variety cannot be measured before it is built - " +
      "and measuring it afterwards is what makes the remedy a rewrite. Name the shape each page takes " +
      "(`exhibit-left`, `exhibit-top`, `hero-number`, `two-up`, `picture-pair`, `text`, …) in the plan.",
    ));
    return;
  }
  if (entropy.value >= PLAN.entropyMin) return;
  const commonest = [...entropy.counts.entries()].sort((a, b) => b[1] - a[1])[0];
  findings.push(finding(
    null, "PLAN_STYLE_ENTROPY",
    { entropy: round(entropy.value), architectures: entropy.distinct, observations: entropy.pages,
      commonest: commonest?.[0], commonestPages: commonest?.[1] },
    PLAN.entropyMin,
    "The deck is built from too few page architectures, so it reads as one page repeated. The example decks run " +
    `${PLAN.entropyObserved.join(", ")} on this measure. Give pages a reason to take a different shape: commentary ` +
    "beside the exhibit on some, beneath it on others, a hero number where the story has one, two exhibits " +
    "contrasted, a picture pair where the subject is two named things. A deliberate template run can be marked " +
    "`series` and is then counted once.",
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
    const items = Number(page.items ?? page.points ?? 0);
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

function gateDeckWideDevices(pages, findings) {
  const content = pages.filter((p) => !p.kind || p.kind === "content");
  if (content.length < PLAN.from) return;
  const anchors = content.flatMap(anchorsOf);
  if (!anchors.some(isPhoto)) {
    findings.push(finding(
      null, "PLAN_NO_PICTURES",
      { pages: content.length, photographs: 0 }, 1,
      "Not one page carries a photograph. A reference page averages 29 drawn elements; a deck of type and rules " +
      "averages very few. Cover, section dividers and any page whose subject is a real place, product or person " +
      "are the cheapest places to start.",
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

export function runPlanGates(plan) {
  const findings = [];
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.pages)) {
    findings.push(finding(null, "PLAN_SCHEMA", "absent", "professional-slides.plan/v1",
      "The plan needs a `pages` array, one row per page, each naming its exhibit, architecture and anchors."));
    return report(plan, findings, []);
  }
  const pages = plan.pages;
  gateTitles(pages, findings);
  gateMix(pages, findings);
  gateRuns(pages, findings);
  gateEntropy(pages, findings);
  gateAnchors(pages, findings);
  gateDeckWideDevices(pages, findings);
  return report(plan, findings, pages);
}

function report(plan, findings, pages) {
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
  return {
    schema: "professional-slides.plan-gates/v1",
    id: plan?.id ?? null,
    pages: pages.length,
    contentPages: content.length,
    statistics: {
      mix: { chart: shareOf("chart"), table: shareOf("table"), diagram: shareOf("diagram"),
             picture: shareOf("picture"), text: shareOf("text") },
      styleEntropy: entropy.declared ? round(entropy.value) : null,
      architectures: entropy.declared ? entropy.distinct : null,
      anchoredPages: content.filter((p) => Array.isArray(p.anchors) && p.anchors.length).length,
      insightPages: content.filter((p) => p.insight && p.insight !== "none").length,
    },
    reference: { mix: Object.fromEntries(Object.entries(PLAN.mix).map(([k, v]) => [k, v])),
                 styleEntropy: PLAN.entropyMin, observed: PLAN.entropyObserved },
    accepted: findings.length === 0,
    countsByCode: counts,
    findings,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args[0];
  if (!file) { console.error("Usage: plan_gates.mjs deck.plan.json [--report out.json]"); process.exit(1); }
  try {
    const result = runPlanGates(JSON.parse(readFileSync(file, "utf8")));
    const at = args.indexOf("--report");
    if (at >= 0 && args[at + 1]) writeFileSync(args[at + 1], JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.accepted ? 0 : 2);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
