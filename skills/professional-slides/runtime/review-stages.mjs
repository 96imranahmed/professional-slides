// Where each review finding could first have been caught, and what a review
// packet costs to read.
//
// On the BA retest (ba4) the final review ran once, at the end, over 102
// pages in 12 packets: 19 minutes, the longest packet 18.5, and 171 findings.
// Most were page-level craft - a wrong exhibit form, no annotation, dead
// space - that a reader of one section could have seen as soon as it was
// drawn, and each found at the end cost a rewrite, a self-check, a judge and
// a render, often in a section whose writer had finished. review-stages.json
// maps every review code to the earliest stage able to catch it; a final-review
// finding whose code maps earlier is an escape, recorded by code and page in
// delivery.json and the run log, as the evidence for which first loop to
// deepen next. The packets are split by what they cost to read, not by a page
// count: a section of fourteen dense chart pages and a section of five
// dividers are not the same reading.
import { readJsonSync } from "./cli.mjs";
import { textWords } from "./text-contract.mjs";
import { GATE_CLASSES } from "./gates/gate_classes.mjs";

const MAP = readJsonSync(new URL("./review-stages.json", import.meta.url));
/** The stages, earliest first. */
export const STAGES = Object.freeze([...MAP.stages]);
/** Every listed code's stage and why: the reviewer's own and the review-class codes, then the codes reviewers coined on real runs. */
export const REVIEW_STAGES = Object.freeze({ ...MAP.codes, ...MAP.observed.codes });
const FINAL = "final-review";
// The page dimensions a section reader reads (review-passes.mjs RUBRIC_CLAUSES scope "page"), named here so this module reads no rubric.
const PAGE_SCOPE = new Set(["argument", "evidence", "chart", "table", "text", "layout", "identity", "sourcing"]);
// A coined code that reuses a gate's: a page gate or a deck aggregate measured it at the compile, a structure rule on the draft.
const CLASS_STAGE = Object.freeze({ P: "page-gate", G: "page-gate", S: "spine" });
const earlier = (a, b) => (STAGES.indexOf(a) <= STAGES.indexOf(b) ? a : b);

/**
 * The earliest stage able to catch a review finding: `{ stage, by }`. Its
 * code's stage (`by: "code"`), or a coined code's gate class (`by: "class"`),
 * or its rubric dimension (`by: "dimension"`). A finding on one page under a
 * page dimension was in that section reader's sight whatever its code
 * (`by: "page"`): on ba4 a heat table shading both ways was filed as
 * INCONSISTENT_ENCODING, a code that otherwise needs the whole deck.
 */
export function stageOf(finding) {
  const listed = REVIEW_STAGES[finding?.code]?.stage;
  const classed = !listed ? CLASS_STAGE[GATE_CLASSES[finding?.code]] : null;
  const onePage = finding?.scope === "page" && PAGE_SCOPE.has(finding?.dimension) ? "section-review" : null;
  const own = listed ?? classed ?? (PAGE_SCOPE.has(finding?.dimension) ? "section-review" : FINAL);
  const stage = onePage ? earlier(own, onePage) : own;
  return { stage, by: stage !== own ? "page" : listed ? "code" : classed ? "class" : "dimension" };
}

/**
 * The final review's escapes: each finding whose earliest stage is before the
 * final review, with its code, stage, pages and severity, and the counts by
 * stage and by code. Findings of severity none ask for nothing and are left out.
 */
export function escapesOf(findings = []) {
  const items = findings.filter((f) => f && f.severity !== "none").map((f) => ({ id: f.id, code: f.code, ...stageOf(f), severity: f.severity, pages: f.slides ?? f.pages ?? [] }))
    .filter((item) => item.stage !== FINAL);
  const count = (key) => Object.fromEntries([...items.reduce((m, item) => m.set(item[key], (m.get(item[key]) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
  return { count: items.length, of: findings.filter((f) => f && f.severity !== "none").length, byStage: Object.fromEntries(STAGES.filter((s) => s !== FINAL).map((s) => [s, items.filter((i) => i.stage === s).length])),
    byCode: count("code"), items };
}

// What a page costs to read, in pages: opening it and writing its notes is
// one, its words add one per WORDS_PER_PAGE, each chart or table adds
// EXHIBIT (the chart and table clauses are read mark by mark), each picture,
// logo or map adds IMAGE. Chrome - the page number, the tracker, the footer -
// is the deck's and is read once, not per page.
const WORDS_PER_PAGE = 120, EXHIBIT = 0.75, IMAGE = 0.25;
const CHROME = /^(page-number|footer-right|tracker)/;
const EXHIBITS = /^(chart|table|comparison-table|heatmap|trend-rows|insight-tree-table)/;
const IMAGES = /image|logo|map|picture/;
/** One page's reading cost from its scene record: `{ cost, words, exhibits, images }`. */
export function readingCost(slide) {
  const words = (slide?.nodes || []).filter((n) => n.type === "text" && !CHROME.test(String(n.role ?? ""))).reduce((sum, n) => sum + textWords(n.text ?? ""), 0);
  const components = (slide?.componentInstances || []).map((c) => String(c.component));
  const exhibits = components.filter((c) => EXHIBITS.test(c)).length, images = components.filter((c) => IMAGES.test(c)).length;
  return { cost: Math.round((1 + words / WORDS_PER_PAGE + EXHIBIT * exhibits + IMAGE * images) * 100) / 100, words, exhibits, images };
}

/**
 * The most a packet of pages should cost to read. ba4's eleven section
 * packets ran 5 to 14 pages and 14 to 44 cost units: those of 14 to 23 were
 * all in by nine minutes, and the two of 41 and 44 held the review to 18.5.
 * At 22 the dearest packet is half ba4's and reads like its quickest.
 */
export const PACKET_COST = 22;

/**
 * Split pages for parallel readers by reading cost: a section per divider,
 * a section cheaper than a third of `target` folded into the one before (or
 * the one before into it), and a section dearer than `target` cut into the
 * fewest even runs of neighbouring pages that each stay within it - so the
 * longest packet is bounded by what it costs, not by its page count, and no
 * packet is a page or two left over. `pages` is [{ id, title, opens, cost,
 * counted }] as splitSections takes them; a page dearer than `target` alone
 * is a packet of its own. The section's page list is written under `key`.
 */
export function costSections(pages, { target = PACKET_COST, key = "pages" } = {}) {
  const groups = [];
  for (const p of pages) {
    if (!groups.length || p.opens) groups.push({ title: p.opens ? p.title : "Opening", ids: [], cost: 0, costs: [] });
    if (p.counted !== false) { const g = groups.at(-1); g.ids.push(p.id); g.costs.push(p.cost ?? 1); g.cost += p.cost ?? 1; }
  }
  const folded = [];
  for (const g of groups.filter((x) => x.ids.length)) {
    const last = folded.at(-1);
    if (last && (g.cost < target / 3 || last.cost < target / 3)) {
      last.ids.push(...g.ids); last.costs.push(...g.costs); last.cost += g.cost; last.title = `${last.title}; ${g.title}`;
    } else folded.push({ ...g, ids: [...g.ids], costs: [...g.costs] });
  }
  return folded.flatMap((g) => {
    if (g.cost <= target) return [{ title: g.title, ids: g.ids, cost: g.cost }];
    // The fewest even runs that each stay within the target: a run closes once it reaches its share of the section's cost.
    let runs;
    for (let n = Math.ceil(g.cost / target); n <= g.ids.length; n += 1) {
      const share = g.cost / n;
      runs = [{ ids: [], cost: 0 }];
      g.ids.forEach((id, i) => {
        if (runs.at(-1).ids.length && runs.at(-1).cost + g.costs[i] / 2 > share && runs.length < n) runs.push({ ids: [], cost: 0 });
        runs.at(-1).ids.push(id); runs.at(-1).cost += g.costs[i];
      });
      if (runs.every((run) => run.cost <= target || run.ids.length === 1)) break;
    }
    return runs.map((run, k) => ({ title: `${g.title} (${k + 1} of ${runs.length})`, ids: run.ids, cost: run.cost }));
  }).map((g, i) => ({ id: `s${i + 1}`, title: g.title, cost: Math.round(g.cost * 10) / 10, [key]: g.ids }));
}
