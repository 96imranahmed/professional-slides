#!/usr/bin/env node
/**
 * Does the evidence contract catch what it is there to catch, and nothing else?
 *
 *   node evals/quality/evidence-validity.mjs            the table: each seeded defect, how often it was caught, and
 *                                                       every finding raised on a clean deck
 *   node evals/quality/evidence-validity.mjs --json     the same as JSON
 *
 * The fixtures under fixtures/evidence/ are decks on four different
 * subjects - a credit union, an ambulance service, a note-taking app and an
 * explanation of a signalling upgrade - each declaring what its claims and
 * exhibits rest on. None is the deck the contract was written after. Two
 * measurements:
 *
 * - False positives. Each clean deck is compiled and its dependencies checked.
 *   It carries deliberate cases a careless rule would refuse: a context
 *   exhibit with its relevance, two same-unit series read separately with the
 *   reason, a metric strip over a chart, a deck that compares nothing and so
 *   has no comparison. Any finding here is a false positive.
 * - Recall. Each seeded defect is planted on every page it applies to, one at
 *   a time, and the mutated deck is checked. A defect is caught when the
 *   finding it should raise names that page.
 *
 * The seeded defects are the ways an exhibit comes to disagree with its page:
 * an exhibit copied from another page with its evidence id appended and the
 * citation left as it was (how a repair for variety put a chart of one
 * measure on a page about another), the same copy relabelled as the claim's measure, a unit,
 * a period or a number changed or rounded away, a copy listed beside the
 * claim's own measure, a dependency left undeclared, a citation
 * dropped, a context exhibit unexplained, and a relation split across panels.
 * Then the numbers outside the exhibits: one typed cell of a table changed and
 * one number in a sentence changed, which the trace of typed numbers reports
 * (an advisory, `NUMBER_UNTRACED`, or in a title a refusal, `TITLE_NUMBER_UNTRACED`); and the references a page writes its
 * numbers by: a bound exhibit naming a measure the log does not hold, and a
 * token whose measure comes from an insight the page does not rest on.
 *
 * A defect whose finding is an advisory - reported to the author, blocking
 * nothing - is labelled "(advisory)" in the table: it is caught, not refused.
 *
 * Known limits. A changed number is caught when it is no value of any measure
 * the page rests on, and only where it is written as a measurement. Three
 * defects the trace does not claim to catch are planted the same way and
 * reported beside the others, caught over planted, so the measure says what it
 * leaves out: a bare whole number in a sentence changed ("8 branches" is a
 * count or a name as often as a measurement, and is not traced), a year
 * changed (a year is a period label), and a number changed into another
 * recorded value of the measure it stated (the trace asks whether a number was
 * recorded, not which record the sentence meant). They do not count towards
 * acceptance.
 *
 * Exit 0 when every seeded defect was caught on every page it was planted on
 * and no clean deck raised a finding, advisories included; 2 otherwise.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, isMain, parseCli, runCli } from "../../skills/professional-slides/runtime/cli.mjs";
import { compileDeck, readInsights } from "../../skills/professional-slides/runtime/author-deck.mjs";
import { alternativesOf } from "../../skills/professional-slides/runtime/analysis.mjs";
import { dependencyFindings } from "../../skills/professional-slides/runtime/gates/dependency_gates.mjs";
import { plottedValues } from "../../skills/professional-slides/runtime/evidence.mjs";
import { readPagesFileSync } from "../../skills/professional-slides/runtime/pages-file.mjs";
import { decimalsNeeded, printedNumbers, states } from "../../skills/professional-slides/runtime/printed-numbers.mjs";
import { isPercentUnit, measureRegistry, valuesOf } from "../../skills/professional-slides/runtime/measures.mjs";
import { withoutTokens } from "../../skills/professional-slides/runtime/bind.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "evidence");

const exhibitsOf = (page) => [page.exhibit, ...(page.exhibits || [])].filter((ex) => ex && typeof ex === "object");
const charted = (ex) => Array.isArray(ex?.categories) && Array.isArray(ex?.series) && ex.series.every((s) => Array.isArray(s.values));
const proof = (ex) => ex?.basis && (ex.basis.role ?? "proof") === "proof";
const ownersOf = (ex) => (ex.basis?.measures || []).map((ref) => ref.split("/")[0]);

/**
 * The seeded defects. `plant(page, doc)` mutates the page in place and returns
 * true where the defect applies to it; `expect` is the finding (any of the
 * codes) that must then name the page.
 */
export const SEEDED = Object.freeze({
  "exhibit copied from another page": {
    // The other page's first plotted exhibit replaces this page's, its evidence
    // id is appended, and the caption and citation stay as they were.
    expect: ["PROOF_OFF_CLAIM"],
    plant(page, doc) {
      const own = exhibitsOf(page).find((ex) => proof(ex) && charted(ex));
      if (!own) return false;
      const claimed = new Set((page.settles?.measures || []).map((ref) => ref.split("/")[0]));
      const donor = doc.pages.flatMap((other) => (other.id === page.id ? [] : exhibitsOf(other))).find((ex) => proof(ex) && charted(ex)
        && ownersOf(ex).every((owner) => !claimed.has(owner) && !(page.evidence || []).includes(owner)));
      if (!donor) return false;
      const { caption } = own;
      for (const key of Object.keys(own)) delete own[key];
      Object.assign(own, structuredClone(donor), caption === undefined ? {} : { caption });
      page.evidence = [...(page.evidence || []), ...ownersOf(donor)];
      return true;
    },
  },
  "copied exhibit relabelled as the claim's measure": {
    // The same copy, with its `basis` rewritten to name the measure the claim is about.
    expect: ["BASIS_UNIT", "BASIS_VALUES", "BASIS_AXIS"],
    plant(page, doc) {
      const own = exhibitsOf(page).find((ex) => proof(ex) && charted(ex));
      if (!own) return false;
      const basis = structuredClone(own.basis);
      const donor = doc.pages.flatMap((other) => (other.id === page.id ? [] : exhibitsOf(other))).find((ex) => proof(ex) && charted(ex)
        && JSON.stringify(ex.series.map((s) => s.values)) !== JSON.stringify(own.series.map((s) => s.values)));
      if (!donor) return false;
      for (const key of Object.keys(own)) delete own[key];
      Object.assign(own, structuredClone(donor), { basis });
      return true;
    },
  },
  "copied exhibit listed beside the claim's measure": {
    // The copy again, its `basis` naming the claim's measure and the one actually drawn.
    expect: ["BASIS_VALUES"],
    plant(page, doc) {
      const own = exhibitsOf(page).find((ex) => proof(ex) && charted(ex));
      if (!own) return false;
      const named = own.basis.measures;
      const donor = doc.pages.flatMap((other) => (other.id === page.id ? [] : exhibitsOf(other))).find((ex) => proof(ex) && charted(ex)
        && ex.basis.measures.every((ref) => !named.includes(ref)) && JSON.stringify(ex.series.map((s) => s.values)) !== JSON.stringify(own.series.map((s) => s.values)));
      if (!donor) return false;
      for (const key of Object.keys(own)) delete own[key];
      Object.assign(own, structuredClone(donor), { basis: { measures: [...named, ...donor.basis.measures], role: "proof" } });
      page.evidence = [...(page.evidence || []), ...ownersOf(donor)];
      return true;
    },
  },
  "plotted numbers rounded to one figure": {
    expect: ["BASIS_VALUES"],
    plant(page) {
      const ex = exhibitsOf(page).find((e) => e.basis && charted(e));
      if (!ex) return false;
      const before = JSON.stringify(ex.series);
      for (const s of ex.series) s.values = s.values.map((v) => (typeof v === "number" ? Number(v.toPrecision(1)) : v));
      return JSON.stringify(ex.series) !== before;
    },
  },
  "a metric's printed number changed": {
    expect: ["BASIS_VALUES"],
    plant(page) { const metric = (page.metrics || []).find((m) => m.basis && /\d/.test(String(m.value))); if (!metric) return false; metric.value = String(metric.value).replace(/\d[\d.,]*/, "907.3"); return true; },
  },
  "basis left undeclared": {
    expect: ["BASIS_MISSING"],
    plant(page) { const ex = exhibitsOf(page).find((e) => e.basis && plottedValues(e) > 0); if (!ex) return false; delete ex.basis; return true; },
  },
  "claim measures left undeclared": {
    expect: ["CLAIM_MEASURES_MISSING"],
    plant(page) { if (!page.settles?.measures || !exhibitsOf(page).some((e) => plottedValues(e) > 0)) return false; delete page.settles.measures; delete page.settles.relation; return true; },
  },
  "unit changed": {
    expect: ["BASIS_UNIT"],
    plant(page) { const ex = exhibitsOf(page).find((e) => e.basis && typeof e.unit === "string" && plottedValues(e) > 0); if (!ex) return false; ex.unit = "tonnes of freight"; return true; },
  },
  "one plotted number changed": {
    expect: ["BASIS_VALUES"],
    plant(page) { const ex = exhibitsOf(page).find((e) => e.basis && charted(e)); if (!ex) return false; ex.series[0].values[1] = Number(ex.series[0].values[1]) * 1.4 + 3; return true; },
  },
  "period or member outside the measure": {
    expect: ["BASIS_AXIS"],
    plant(page) { const ex = exhibitsOf(page).find((e) => e.basis && charted(e)); if (!ex) return false; ex.categories[ex.categories.length - 1] = "a label no record carries"; return true; },
  },
  "measure the log does not hold": {
    expect: ["BASIS_UNKNOWN"],
    plant(page) { const ex = exhibitsOf(page).find((e) => e.basis?.measures?.length); if (!ex) return false; ex.basis.measures = ["no-such-insight/no-such-measure"]; return true; },
  },
  "insight not named in evidence": {
    // A page that prints the insight's numbers through tokens is refused when they are bound, before its bases are read.
    expect: ["BASIS_UNKNOWN", "BINDING_UNRESOLVED"],
    plant(page) {
      const ex = exhibitsOf(page).find((e) => e.basis?.measures?.length);
      if (!ex || !(page.evidence || []).length) return false;
      page.evidence = page.evidence.filter((id) => !ownersOf(ex).includes(id));
      return true;
    },
  },
  "citation dropped": {
    expect: ["SOURCE_UNCITED"],
    plant(page) { if (!exhibitsOf(page).some((e) => e.basis)) return false; page.source = "Source: typed by hand, naming another record"; return true; },
  },
  "context exhibit unexplained": {
    expect: ["CONTEXT_UNEXPLAINED"],
    plant(page) { const ex = exhibitsOf(page).find((e) => e.basis?.role === "context"); if (!ex) return false; delete ex.basis.relevance; return true; },
  },
  "every exhibit marked context": {
    expect: ["PROOF_MISSING"],
    plant(page) {
      const all = exhibitsOf(page).filter((e) => e.basis);
      if (!all.length || (page.metrics || []).some((m) => m.basis)) return false;
      for (const ex of all) Object.assign(ex.basis, { role: "context", relevance: "It is shown beside the claim for the reader to weigh" });
      return true;
    },
  },
  "relation left undeclared across panels": {
    expect: ["RELATION_UNDECLARED"],
    plant(page) { if (page.settles?.relation?.kind !== "separate") return false; delete page.settles.relation; return true; },
  },
  "gap claimed across separate panels": {
    expect: ["RELATION_SPLIT"],
    plant(page) { if (page.settles?.relation?.kind !== "separate") return false; page.settles.relation = { kind: "gap" }; return true; },
  },
  "one typed cell of a table changed": {
    expect: ["NUMBER_UNTRACED"],
    plant(page) {
      const table = exhibitsOf(page).find((e) => e.basis && Array.isArray(e.rows));
      const row = table?.rows.find((r) => Array.isArray(r) && r.some((cell) => /^\d/.test(String(cell))));
      if (!row) return false;
      const at = row.findIndex((cell) => /^\d/.test(String(cell)));
      row[at] = String(row[at]).replace(/\d+/, (n) => String(Number(n) + 37));
      return true;
    },
  },
  "a typed number in a sentence changed": {
    // The first number the page's title, closing line or commentary writes as a measurement - "57%", "12.2 minutes", "41 million" - moved by 37.
    expect: ["NUMBER_UNTRACED", "TITLE_NUMBER_UNTRACED"],
    plant(page) {
      const typed = typedNumber((number) => number.kind === "measure");
      const sentence = sentenceOf(page, typed);
      if (!sentence) return false;
      const number = typed(sentence.get());
      sentence.set(digitsSwapped(sentence.get(), number, (number.n + 37).toFixed(number.decimals)));
      return true;
    },
  },
  "bound exhibit names a measure the log does not hold": {
    expect: ["BINDING_UNRESOLVED"],
    plant(page) { const ex = exhibitsOf(page).find((e) => Array.isArray(e.series) && e.series.some((s) => s.measure)); if (!ex) return false; ex.series.find((s) => s.measure).measure = "no-such-insight/no-such-measure"; return true; },
  },
  "token of an insight the page does not rest on": {
    expect: ["BINDING_UNRESOLVED"],
    plant(page) {
      const token = /\{\{\s*([^/{}]+)\//.exec(JSON.stringify(page));
      if (!token || !(page.evidence || []).includes(token[1])) return false;
      page.evidence = page.evidence.filter((id) => id !== token[1]);
      return true;
    },
  },
});

// The sentences of a page a number is typed into: its closing line, its title, and its points.
const sentenceOf = (page, has) => {
  const key = ["bar", "takeaway", "title"].find((k) => typeof page[k] === "string" && has(page[k]));
  if (key) return { get: () => page[key], set: (text) => { page[key] = text; } };
  const at = Array.isArray(page.points) ? page.points.findIndex((pt) => typeof pt === "string" && has(pt)) : -1;
  return at < 0 ? null : { get: () => page.points[at], set: (text) => { page.points[at] = text; } };
};
const typedNumber = (kind) => (text) => printedNumbers(withoutTokens(text)).find(kind);
const digitsSwapped = (text, number, digits) => text.replace(number.shown, number.shown.replace(/\d[\d,]*(?:\.\d+)?/, digits));

/**
 * Defects the trace of typed numbers is known NOT to catch, planted the same
 * way and reported beside the others so the measure says what it leaves out.
 * `plant(page, doc, registry)` as above, `registry` the measures of the deck's
 * insight log. They do not count towards acceptance; one that starts being
 * caught shows in its count.
 */
export const KNOWN_LIMITS = Object.freeze({
  "a bare whole number in a sentence changed": {
    // "retains 15 points more" becomes "52 points more": a whole number with no mark of a measurement is not traced.
    plant(page) {
      const bare = typedNumber((number) => number.kind === "integer");
      const sentence = sentenceOf(page, bare);
      if (!sentence) return false;
      const number = bare(sentence.get());
      sentence.set(digitsSwapped(sentence.get(), number, String(number.n + 37)));
      return true;
    },
  },
  "a year changed": {
    // "than in 2023" becomes "than in 2024": a year is read as a period label, not a number.
    plant(page) {
      const year = typedNumber((number) => number.kind === "period" && number.n >= 1900);
      const sentence = sentenceOf(page, year);
      if (!sentence) return false;
      const number = year(sentence.get());
      sentence.set(digitsSwapped(sentence.get(), number, String(number.n + 1)));
      return true;
    },
  },
  "a number changed into another value of the same measure": {
    // The first measurement a sentence types that states a value of a measure the page rests on, replaced by that
    // measure's value at another period or member: still a recorded number, of the wrong record.
    plant(page, doc, registry) {
      const rested = [...registry.values()].filter((m) => (page.evidence || []).includes(m.owner));
      const swapFor = (number) => {
        for (const m of rested) {
          const values = valuesOf(m).filter((v) => typeof v === "number");
          if (!values.some((v) => states(number, v, { unit: m.unit }))) continue;
          const other = values.find((v) => !states(number, v, { unit: m.unit }) && Math.sign(v) >= 0);
          if (other !== undefined) return Math.abs(other).toFixed(decimalsNeeded(other, { percent: isPercentUnit(m.unit) }));
        }
        return null;
      };
      const stated = typedNumber((number) => number.kind === "measure" && !number.scaled && swapFor(number) !== null);
      const sentence = sentenceOf(page, stated);
      if (!sentence) return false;
      const number = stated(sentence.get());
      sentence.set(digitsSwapped(sentence.get(), number, swapFor(number)));
      return true;
    },
  },
});

const decks = () => fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".pages.json")).sort().map((f) => f.replace(/\.pages\.json$/, ""));

async function check(name, doc) {
  const insights = await readInsights(FIXTURES, name, { alternatives: alternativesOf(doc.deck) });
  const { compileErrors, spineFindings } = compileDeck(doc, { insights, partial: true });
  return { compileErrors, spine: spineFindings.filter((f) => f.severity !== "advisory"), dependencies: dependencyFindings(doc, insights), analyses: insights.analysis?.results ?? [], registry: measureRegistry(insights) };
}

/**
 * `{ clean, seeded, limits, accepted }`: every finding on a clean deck, each
 * seeded defect's catches over its plantings (`advisory` where what caught it
 * blocks nothing), and the same count for each known limit.
 */
export async function measure() {
  const clean = [], seeded = Object.fromEntries(Object.keys(SEEDED).map((name) => [name, { planted: 0, caught: 0, advisory: false, missed: [] }]));
  const limits = Object.fromEntries(Object.keys(KNOWN_LIMITS).map((name) => [name, { planted: 0, caught: 0 }]));
  for (const name of decks()) {
    const doc = readPagesFileSync(path.join(FIXTURES, `${name}.pages.json`));
    const base = await check(name, doc);
    clean.push({ deck: name, pages: doc.pages.length, analyses: base.analyses.map((r) => `${r.id}:${r.status}`),
      findings: [...base.compileErrors.map((message) => `COMPILE ${message}`), ...base.spine.map((f) => `${f.code} ${f.repair}`), ...base.dependencies.map((f) => `${f.code} ${f.repair}`)] });
    for (const [defect, { plant, expect }] of Object.entries(SEEDED)) {
      for (const [index, page] of doc.pages.entries()) {
        const mutated = structuredClone(doc);
        if (!page.type || !plant(mutated.pages[index], mutated)) continue;
        seeded[defect].planted += 1;
        const found = (await check(name, mutated)).dependencies.filter((f) => f.id === page.id);
        const hits = found.filter((f) => expect.includes(f.code));
        if (hits.length) { seeded[defect].caught += 1; if (hits.every((f) => f.severity === "advisory")) seeded[defect].advisory = true; }
        else seeded[defect].missed.push(`${name}/${page.id}: raised ${found.map((f) => f.code).join(", ") || "nothing"}; expected ${expect.join(" or ")}`);
      }
    }
    // A limit is caught when the planting raises a finding on its page that the clean deck did not.
    const before = new Set(base.dependencies.map((f) => `${f.id}|${f.code}|${JSON.stringify(f.measured ?? null)}`));
    for (const [limit, { plant }] of Object.entries(KNOWN_LIMITS)) for (const [index, page] of doc.pages.entries()) {
      const mutated = structuredClone(doc);
      if (!page.type || !plant(mutated.pages[index], mutated, base.registry)) continue;
      limits[limit].planted += 1;
      if ((await check(name, mutated)).dependencies.some((f) => f.id === page.id && !before.has(`${f.id}|${f.code}|${JSON.stringify(f.measured ?? null)}`))) limits[limit].caught += 1;
    }
  }
  const accepted = clean.every((deck) => !deck.findings.length) && Object.values(seeded).every((d) => d.planted > 0 && d.caught === d.planted);
  return { clean, seeded, limits, accepted };
}

async function main(argv) {
  const { values } = parseCli(argv, { json: { type: "boolean" } }, { usage: "Usage: evidence-validity.mjs [--json]" });
  const result = await measure();
  if (values.json) console.log(JSON.stringify(result, null, 1));
  else {
    console.log("Clean decks (any finding is a false positive):");
    for (const deck of result.clean) console.log(`  ${deck.deck.padEnd(12)} ${deck.pages} pages, ${deck.analyses.length} analyses  ${deck.findings.length ? `${deck.findings.length} FINDINGS\n    ${deck.findings.join("\n    ")}` : "clean"}`);
    console.log("\nSeeded defects (caught / planted):");
    for (const [name, d] of Object.entries(result.seeded)) console.log(`  ${`${d.caught}/${d.planted}`.padEnd(7)} ${name}${d.advisory ? " (advisory)" : ""}${d.missed.length ? `\n    missed: ${d.missed.join("\n    missed: ")}` : ""}${d.planted ? "" : "  (never planted: no fixture page takes it)"}`);
    console.log("\nKnown limits (planted, not counted): what the trace of typed numbers does not claim to catch");
    for (const [name, d] of Object.entries(result.limits)) console.log(`  ${`${d.caught}/${d.planted}`.padEnd(7)} ${name}${d.planted ? "" : "  (never planted: no fixture page takes it)"}`);
    console.log(`\n${result.accepted ? "accepted" : "NOT accepted"}`);
  }
  return result.accepted ? EXIT.ok : EXIT.refused;
}

if (isMain(import.meta.url)) runCli(main);
