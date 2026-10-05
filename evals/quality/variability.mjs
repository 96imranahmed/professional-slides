#!/usr/bin/env node
/**
 * Do two decks from one brief differ where the choice of form is free, and nowhere else?
 *
 *   node evals/quality/variability.mjs                         the fixtures: the variety spine and the evidence decks
 *   node evals/quality/variability.mjs <a>.pages.json ...      these pages files instead (each with its insight log beside it)
 *   node evals/quality/variability.mjs --seeds 8               how many `variation` seeds to plan each spine under (default 5)
 *   node evals/quality/variability.mjs --designs consulting,journal   the design systems to plan under (default: all four)
 *   node evals/quality/variability.mjs --runtime <dir>         plan with another checkout's runtime (a baseline), graded by this one's fit table
 *   node evals/quality/variability.mjs --stubs                 keep each exhibit of a page of open kinds as the `basis` stub a spine declares it by
 *   node evals/quality/variability.mjs --json [--allocations]  the same as JSON, with every allocation
 *
 * A deck's forms are chosen by what its pages claim (runtime/claim-fit.mjs), so
 * variety between runs can only come from the choices the fit leaves free: a
 * page whose claim two forms carry equally well. This strips each deck to its
 * spine - every page's id, type, title, claim and evidence, and no form,
 * placement or exhibit - plans it under several `variation` seeds and each
 * design system (deck-structure.mjs allocateStructure), and reports, a spine:
 *
 *   pages          how many the fit is read on, and of those how many have a
 *                  free choice (two or more best-fit forms, or kinds for an
 *                  exhibit whose form leaves its kind open), how many are
 *                  pinned (exactly one), and how many have no fit read
 *   concentration  the share of the exhibits drawn in the three commonest
 *                  kinds, over the seeds (lowest, mean, highest), and how many
 *                  kinds are drawn
 *   distance       between two allocations: the share of the pages whose form
 *                  or exhibit kinds differ, and the Jensen-Shannon distance
 *                  (base 2, 0 to 1) between the two decks' exhibit-kind
 *                  distributions - averaged over every pair of seeds within a
 *                  design, and over every pair of designs under one seed
 *   what a reader  between two seeds, of the pages that draw an exhibit, the
 *   sees           share whose exhibit kinds differ - the plan's own proposal
 *                  of another page type taken where it makes one (`typeHand`)
 *                  - and how many of the two decks' three commonest kinds are
 *                  the same kinds (3: both decks are tables, lines and bars)
 *   type latitude  the chart pages another page type carries as directly as
 *                  their own, in a type their evidence can rest under: how
 *                  much of a deck's variety could enter through the choice of
 *                  type at the spine
 *
 * Two authors' decks from one brief came out with the same three commonest
 * kinds although the plan's seeds differed. Most of their free choices sat on
 * pages whose form leaves the kind of each exhibit open - panels, the chart
 * under a strip - which a spine declares by `basis` stubs: `--stubs` measures
 * the spine as such a deck's critique reads it, every exhibit of those pages
 * kept as an untyped stub naming its measures (a table or a list of figures
 * as a stub that says so), where the default strips them and lets the plan
 * cut the claim's measures itself.
 *
 * and asserts, a spine:
 *
 *   (a) seeds differ     where pages have a free choice, some pair of seeds
 *                        allocates one of them differently
 *   (b) pinned agree     a page with exactly one best-fit form, and one best
 *                        kind for each exhibit, is allocated the same under
 *                        every seed and design
 *   (c) best fit only    no page is given a form, and no open exhibit a kind,
 *                        outside its best-fit set
 *   (d) reproducible     one seed and design planned twice give one allocation
 *
 * A page the fit is not read on - a diagram, a summary, a page with no
 * measures - is given its form by the structure rules alone; where such a
 * page differs between seeds it is reported (`unread`), not failed: the rules
 * weigh it against pages that did have a choice.
 *
 * Exit 0 when (a) to (d) hold on every spine and every allocation meets the
 * structure rules its page types allow; 2 otherwise. A spine whose page types
 * alone break a rule is reported and does not fail the run: no allocation of
 * forms could mend it. A baseline runtime (`--runtime`) is measured, not
 * judged: the run reports its numbers and exits 0.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EXIT, isMain, parseCli, runCli } from "../../skills/professional-slides/runtime/cli.mjs";
import { exhibitRefs, pageFit } from "../../skills/professional-slides/runtime/claim-fit.mjs";
import { DESIGN_NAMES } from "../../skills/professional-slides/runtime/design-systems.mjs";
import { measureRegistry } from "../../skills/professional-slides/runtime/measures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "..", "..", "skills", "professional-slides");
const FIXTURES = [path.join(HERE, "fixtures", "variety", "variety.pages.json"), ...["finance", "public-ops", "product", "explainer"].map((name) => path.join(HERE, "fixtures", "evidence", `${name}.pages.json`))];
// What a spine keeps of a page: what it is, what it claims and what it rests on. A revision's page keeps where it came from.
const SPINE_KEYS = ["id", "kind", "type", "title", "subtitle", "why", "evidence", "settles", "series", "number", "sourceSlide"];

// The pages whose form leaves the kind of each exhibit to the author: what a spine declares by `basis` stubs.
const OPEN_KINDS = new Set(["panels", "numbers"]);
// An exhibit as the stub a spine declares it by: the measures it names and, for a table or a list of figures, that it is one.
function stubOf(ex) {
  const measures = exhibitRefs(ex).map((ref) => String(ref).split("@")[0]), type = String(ex.type ?? "");
  const as = type === "table" ? "table" : ["fact-grid", "stat-list"].includes(type) ? "figure" : null;
  return measures.length ? { basis: { measures: [...new Set(measures)], ...(as ? { as } : {}) } } : null;
}

/**
 * A pages document stripped to its spine: no form, no placement, no exhibit,
 * no copy. With `stubs`, a page whose form leaves the kind of its exhibits
 * open keeps each as the untyped `basis` stub a spine declares it by.
 */
export function spineOf(doc, { stubs = false } = {}) {
  const kept = (page) => { const own = [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object").map(stubOf);
    return stubs && OPEN_KINDS.has(page.type) && own.length && own.every(Boolean) ? (page.type === "panels" ? { exhibits: own } : { exhibit: own[0] }) : {}; };
  const strip = (page) => (page && typeof page === "object" && !page.include ? { ...Object.fromEntries(SPINE_KEYS.filter((key) => page[key] !== undefined).map((key) => [key, page[key]])), ...kept(page) } : page);
  return { ...doc, pages: (doc.pages || []).map(strip), ...(Array.isArray(doc.appendix) ? { appendix: doc.appendix.map(strip) } : {}) };
}

// The page types whose exhibit is a chart of measures: where another type could carry the same claim.
const CHART_TYPES = new Set(["trend", "ranking", "composition", "relationship", "bridge"]);
const share = (n, of) => (of ? Math.round((n / of) * 1000) / 1000 : 0);
const mean = (list) => (list.length ? Math.round((list.reduce((sum, v) => sum + v, 0) / list.length) * 1000) / 1000 : 0);
const tallyOf = (kinds) => { const tally = new Map(); for (const kind of kinds) tally.set(kind, (tally.get(kind) ?? 0) + 1); return tally; };

/** The Jensen-Shannon distance between two tallies of exhibit kinds: 0 for one distribution, 1 for two that share no kind. */
export function kindDistance(a, b) {
  const total = (tally) => [...tally.values()].reduce((sum, n) => sum + n, 0), ta = total(a), tb = total(b);
  if (!ta || !tb) return 0;
  const half = (p, m) => (p > 0 ? p * Math.log2(p / m) : 0);
  const divergence = [...new Set([...a.keys(), ...b.keys()])].reduce((sum, kind) => { const p = (a.get(kind) ?? 0) / ta, q = (b.get(kind) ?? 0) / tb, m = (p + q) / 2; return sum + (half(p, m) + half(q, m)) / 2; }, 0);
  return Math.round(Math.sqrt(Math.max(0, divergence)) * 1000) / 1000;
}

/** One spine planned under every seed and design, with what the plans say. `runtime` holds the modules that plan. */
export async function measureSpine(file, { seeds, designs, runtime, stubs = false }) {
  const { allocateStructure, evidenceExhibits, stubsOf } = runtime.structure;
  const doc = spineOf(await runtime.pages.readPagesFile(file), { stubs });
  const dir = path.dirname(path.resolve(file)), stem = doc.deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  const insights = await runtime.author.readInsights(dir, stem, {}).catch(() => null);
  const registry = insights ? measureRegistry(insights) : new Map();
  const all = [...doc.pages, ...(doc.appendix || [])];
  const sourceOf = (id) => all.find((p) => String(p?.id) === String(id));
  const planned = (seed, design) => {
    const plan = allocateStructure({ ...doc, deck: { ...doc.deck, variation: seed, design } }, { insights, planOf: runtime.author.planOf });
    // The exhibits each page draws: as the plan says, or - for a runtime that does not say - as its stand-in is typed.
    const draws = (page) => page.draws ?? (() => { const source = sourceOf(page.id);
      const slide = runtime.types.declaredSlide({ ...source, form: page.form, commentary: page.commentary }, 0, { exhibitType: evidenceExhibits(source, insights), stubs: stubsOf(source, insights) });
      return [slide?.exhibit, ...(slide?.exhibits || [])].filter(Boolean).map((ex) => String(ex.type ?? "")).filter(Boolean); })();
    // What the page would draw with the plan's own proposal of another page type taken, where it makes one.
    const seen = (page) => (page.typeHand?.kind ? [String(page.typeHand.kind)] : draws(page));
    return { seed, design, plan, pages: plan.pages.map((page) => ({ id: String(page.id), type: page.type, form: page.form, draws: draws(page), seen: seen(page), beside: Boolean(page.beside?.length), kinds: (page.kinds ?? []).map((item) => item.kind) })) };
  };
  // Each page's fit by this checkout's table, read off the spine: the best-fit forms of its type and the best kinds of each open exhibit.
  const fits = new Map(all.filter((page) => page?.type).map((page) => [String(page.id), registry.size ? pageFit(page, { registry, insights }) : null]));
  const bestForms = (id) => (fits.get(id)?.task ? fits.get(id).forms.equal.map((item) => item.form) : null);
  const bestKinds = (id) => (fits.get(id)?.exhibits ?? []).filter((item) => !item.written).map((item) => item.kinds.equal.map((kind) => kind.kind).filter((kind) => kind.startsWith("chart.")));
  const classOf = (id) => { const forms = bestForms(id), kinds = bestKinds(id).filter((list) => list.length);
    // A page whose form no fit ranks - a strip, a grid or a hero number of figures - is placed by the structure rules whatever its one exhibit's kind: unread.
    return (forms?.length ?? 0) > 1 || kinds.some((list) => list.length > 1) ? "free" : forms ? "pinned" : "unread"; };
  const ids = all.filter((page) => page?.type).map((page) => String(page.id));
  const classes = new Map(ids.map((id) => [id, classOf(id)]));
  const runs = designs.flatMap((design) => seeds.map((seed) => planned(seed, design)));
  const again = planned(seeds[0], designs[0]);
  const key = (page) => `${page.form}|${page.draws.join("+")}`;
  // What a reader sees of two decks: of the pages that draw an exhibit in either, the share whose kinds differ; and how many of
  // the two decks' three commonest kinds are the same kinds.
  const seenTally = new Map(runs.map((run) => [run, tallyOf(run.pages.flatMap((page) => page.seen))]));
  const topThree = (run) => [...seenTally.get(run)].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 3).map(([kind]) => kind);
  const exhibitDiffer = (a, b) => { const drawn = a.pages.map((page, i) => [page, b.pages[i]]).filter(([x, y]) => x.seen.length || y.seen.length); return share(drawn.filter(([x, y]) => x.seen.join("+") !== y.seen.join("+")).length, drawn.length); };
  const reader = (pairs) => ({ differing: mean(pairs.map(([a, b]) => exhibitDiffer(a, b))), topThreeShared: mean(pairs.map(([a, b]) => topThree(a).filter((kind) => topThree(b).includes(kind)).length)),
    kinds: mean(pairs.map(([a, b]) => kindDistance(seenTally.get(a), seenTally.get(b)))) });
  const seenTop = runs.filter((run) => run.design === designs[0]).map((run) => { const tally = seenTally.get(run), n = [...tally.values()].reduce((sum, v) => sum + v, 0); return share(topThree(run).reduce((sum, kind) => sum + tally.get(kind), 0), n); });
  const differing = (a, b) => a.pages.filter((page, i) => key(page) !== key(b.pages[i])).map((page) => page.id);
  const tallies = new Map(runs.map((run) => [run, tallyOf(run.pages.flatMap((page) => page.draws))]));
  const between = (pairs) => ({ pages: mean(pairs.map(([a, b]) => share(differing(a, b).length, a.pages.length))),
    free: mean(pairs.map(([a, b]) => share(differing(a, b).filter((id) => classes.get(id) === "free").length, [...classes.values()].filter((c) => c === "free").length))),
    kinds: mean(pairs.map(([a, b]) => kindDistance(tallies.get(a), tallies.get(b)))) });
  const pairsOf = (list) => list.flatMap((a, i) => list.slice(i + 1).map((b) => [a, b]));
  const seedPairs = designs.flatMap((design) => pairsOf(runs.filter((run) => run.design === design)));
  const designPairs = seeds.flatMap((seed) => pairsOf(runs.filter((run) => run.seed === seed)));
  // (a) and (b): which pages took more than one allocation over every run, by what the fit says of them.
  const varied = ids.filter((id) => new Set(runs.map((run) => key(run.pages.find((page) => page.id === id)))).size > 1);
  // (c): a page given a form outside its best-fit forms, or an open exhibit a kind outside its best kinds.
  const outside = [...new Set(runs.flatMap((run) => run.pages.filter((page) => { const forms = bestForms(page.id), kinds = bestKinds(page.id);
    return (forms && !forms.includes(page.form)) || page.kinds.some((kind, at) => kinds[at]?.length && !kinds[at].includes(kind)); }).map((page) => page.id)))];
  const concentration = runs.filter((run) => run.design === designs[0]).map((run) => { const tally = tallies.get(run), top = [...tally].sort((x, y) => y[1] - x[1]), n = [...tally.values()].reduce((sum, v) => sum + v, 0);
    return { seed: run.seed, exhibits: n, kinds: tally.size, top3: share(top.slice(0, 3).reduce((sum, [, v]) => sum + v, 0), n), histogram: Object.fromEntries(top) }; });
  const unsatisfied = [...new Map(runs.flatMap((run) => run.plan.unsatisfied.map((u) => [u.code, { code: u.code, fixedByTypes: u.fixedByTypes }]))).values()];
  const count = (name) => [...classes.values()].filter((c) => c === name).length;
  return {
    file: path.basename(file), pages: ids.length, free: count("free"), pinned: count("pinned"), unread: count("unread"),
    concentration: { low: Math.min(...concentration.map((c) => c.top3)), mean: mean(concentration.map((c) => c.top3)), high: Math.max(...concentration.map((c) => c.top3)), kinds: mean(concentration.map((c) => c.kinds)), bySeed: concentration },
    betweenSeeds: between(seedPairs), betweenDesigns: between(designPairs),
    reader: { exhibitPages: mean(runs.map((run) => run.pages.filter((page) => page.seen.length).length)), ...reader(seedPairs), topThree: { low: Math.min(...seenTop), mean: mean(seenTop), high: Math.max(...seenTop) } },
    typeLatitude: { chartPages: ids.filter((id) => CHART_TYPES.has(sourceOf(id)?.type)).length, pages: [...new Set(runs.flatMap((run) => run.pages.filter((page) => page.beside).map((page) => page.id)))] },
    spine: stubs ? "stubs" : "open",
    freeVaried: varied.filter((id) => classes.get(id) === "free"), pinnedVaried: varied.filter((id) => classes.get(id) === "pinned"), unreadVaried: varied.filter((id) => classes.get(id) === "unread"),
    outsideBestFit: outside, reproducible: JSON.stringify(again.pages) === JSON.stringify(runs[0].pages), satisfied: !unsatisfied.length, unsatisfied,
    allocations: runs.map((run) => ({ seed: run.seed, design: run.design, pages: run.pages.map((page) => `${page.id} ${page.type}/${page.form}${page.draws.length ? ` [${page.draws.join(", ")}]` : ""}`) })),
  };
}

/** What a spine's measurement fails, as the assertions' letters with what broke each; empty where it holds. */
export function failuresOf(result, { seeds }) {
  return [
    ...(result.free > 0 && seeds > 1 && !result.freeVaried.length ? ["(a) no page with a free choice was allocated differently under any two seeds"] : []),
    ...(result.pinnedVaried.length ? [`(b) pages with one best-fit form were allocated differently: ${result.pinnedVaried.join(", ")}`] : []),
    ...(result.outsideBestFit.length ? [`(c) pages were given a form or a kind outside their best fit: ${result.outsideBestFit.join(", ")}`] : []),
    ...(result.reproducible ? [] : ["(d) one seed planned twice gave two allocations"]),
    ...(result.unsatisfied.some((u) => !u.fixedByTypes) ? [`an allocation left a structure rule unmet that its page types allow: ${result.unsatisfied.filter((u) => !u.fixedByTypes).map((u) => u.code).join(", ")}`] : []),
  ];
}

async function main(argv) {
  const { values, positionals } = parseCli(argv, { seeds: { type: "string" }, designs: { type: "string" }, runtime: { type: "string" }, json: { type: "boolean" }, allocations: { type: "boolean" }, stubs: { type: "boolean" } },
    { usage: "Usage: variability.mjs [--seeds N] [--designs a,b] [--runtime <skill runtime dir>] [--stubs] [--json] [--allocations] [<id>.pages.json ...]" });
  const count = values.seeds === undefined ? 5 : Number(values.seeds);
  if (!Number.isInteger(count) || count < 2) { console.error("--seeds is how many seeds each spine is planned under: a whole number, two or more"); return EXIT.usage; }
  const designs = values.designs === undefined ? DESIGN_NAMES : String(values.designs).split(",").map((name) => name.trim()).filter(Boolean);
  const unknown = designs.filter((name) => !DESIGN_NAMES.includes(name));
  if (unknown.length || !designs.length) { console.error(`--designs takes design systems, comma-separated: ${DESIGN_NAMES.join(", ")}${unknown.length ? `; not ${unknown.join(", ")}` : ""}`); return EXIT.usage; }
  const dir = path.resolve(values.runtime ?? path.join(SKILL, "runtime"));
  const load = (name) => import(pathToFileURL(path.join(dir, name)).href);
  const runtime = { structure: await load("deck-structure.mjs"), author: await load("author-deck.mjs"), pages: await load("pages-file.mjs"), types: await load("page-types.mjs") };
  const seeds = Array.from({ length: count }, (_, i) => `seed-${i + 1}`);
  const files = positionals.length ? positionals : FIXTURES;
  const missing = files.filter((file) => !fs.existsSync(file));
  if (missing.length) { console.error(`No such pages file: ${missing.join(", ")}`); return EXIT.usage; }
  const results = [];
  for (const file of files) results.push(await measureSpine(file, { seeds, designs, runtime, stubs: Boolean(values.stubs) }));
  // Another checkout's runtime is measured against this one's fit table, not judged by it.
  const failed = values.runtime ? [] : results.map((result) => ({ file: result.file, failures: failuresOf(result, { seeds: count }) })).filter((item) => item.failures.length);
  if (values.json) console.log(JSON.stringify({ seeds, designs, accepted: !failed.length, ...(failed.length ? { failed } : {}), results: values.allocations ? results : results.map(({ allocations: _, ...rest }) => rest) }, null, 1));
  else {
    const pct = (x) => `${Math.round(x * 100)}%`;
    console.log(`Each spine planned under ${count} seeds (${seeds.join(", ")}) and ${designs.length} design system${designs.length === 1 ? "" : "s"} (${designs.join(", ")}).\n`);
    console.log(["spine".padEnd(16), "pages", "free", "pinned", "unread", "top-3 kinds low/mean/high", "kinds", "between seeds: pages / free pages / kinds JSD", "between designs: pages / kinds JSD", "rules", "(a)", "(b)", "(c)", "(d)"].join(" | "));
    for (const r of results) console.log([r.file.replace(/\.pages\.json$/, "").padEnd(16), String(r.pages).padStart(5), String(r.free).padStart(4), String(r.pinned).padStart(6), String(r.unread).padStart(6),
      `${pct(r.concentration.low)} / ${pct(r.concentration.mean)} / ${pct(r.concentration.high)}`.padEnd(25), String(r.concentration.kinds).padStart(5),
      `${pct(r.betweenSeeds.pages)} / ${pct(r.betweenSeeds.free)} / ${r.betweenSeeds.kinds.toFixed(3)}`.padEnd(44), `${pct(r.betweenDesigns.pages)} / ${r.betweenDesigns.kinds.toFixed(3)}`.padEnd(33),
      r.satisfied ? "met" : `unmet: ${r.unsatisfied.map((u) => `${u.code}${u.fixedByTypes ? " (the types alone)" : ""}`).join(", ")}`,
      r.free ? `${r.freeVaried.length} of ${r.free} varied` : "no free page", r.pinnedVaried.length ? `varied: ${r.pinnedVaried.join(", ")}` : "agree", r.outsideBestFit.length ? `outside: ${r.outsideBestFit.join(", ")}` : "none outside", r.reproducible ? "yes" : "NO"].join(" | "));
    console.log(`\nWhat a reader sees of two decks from one spine${values.stubs ? " (open exhibits kept as the `basis` stubs a spine declares them by)" : ""}, between two seeds, the plan's own type proposals taken:`);
    console.log(["spine".padEnd(16), "pages with an exhibit", "whose kinds differ", "top-3 kinds low/mean/high", "of the two top threes, kinds in both", "kinds JSD", "chart pages another type carries as directly"].join(" | "));
    for (const r of results) console.log([r.file.replace(/\.pages\.json$/, "").padEnd(16), String(r.reader.exhibitPages).padStart(21), pct(r.reader.differing).padStart(18), `${pct(r.reader.topThree.low)} / ${pct(r.reader.topThree.mean)} / ${pct(r.reader.topThree.high)}`.padEnd(25),
      `${r.reader.topThreeShared.toFixed(1)} of 3`.padStart(36), r.reader.kinds.toFixed(3).padStart(9), `${r.typeLatitude.pages.length} of ${r.typeLatitude.chartPages}${r.typeLatitude.pages.length ? ` (${r.typeLatitude.pages.join(", ")})` : ""}`].join(" | "));
    const drift = results.filter((r) => r.unreadVaried.length);
    if (drift.length) console.log(`\nPages with no fit read that the structure rules placed differently between runs (reported, not failed): ${drift.map((r) => `${r.file.replace(/\.pages\.json$/, "")}: ${r.unreadVaried.join(", ")}`).join("; ")}`);
    if (values.allocations) for (const r of results) { console.log(`\n${r.file}`); for (const c of r.concentration.bySeed) console.log(`  ${c.seed}: ${c.exhibits} exhibits, ${c.kinds} kinds, top three ${pct(c.top3)} - ${Object.entries(c.histogram).map(([kind, n]) => `${kind} ${n}`).join(", ")}`);
      for (const a of r.allocations) console.log(`  ${a.seed} ${a.design}\n    ${a.pages.join("\n    ")}`); }
    console.log(`\n${failed.length ? `Not accepted:\n${failed.map((item) => `  ${item.file}: ${item.failures.join("; ")}`).join("\n")}` : values.runtime ? `Measured with the runtime at ${dir}, graded by this checkout's fit table; not judged.`
      : "Accepted: (a) seeds differ on pages with a free choice, (b) pages with one best-fit form agree under every seed and design, (c) no page is given a form outside its best fit, (d) a seed planned twice gives one deck; and every allocation meets the rules its page types allow."}`);
  }
  return failed.length ? EXIT.refused : EXIT.ok;
}

if (isMain(import.meta.url)) runCli(main);
