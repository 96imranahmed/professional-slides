// The context pack a section's subagent reads in place of the references and the insight log
// (`author-deck.mjs <id>.pages.json --brief <role> [--section <part>]`).
//
// A deck written by one agent end to end, reviewed by one critic reading the
// whole spine, cost hours; split by section, each subagent needs only its own
// share of the context. The BA deck's six copy writers each read the reference
// docs freely (540k characters) and grepped the insight logs before writing a
// page. The pack gives each role what it acts on and nothing else:
//
//   - every role: its rules as a short digest (references/briefs/<role>.md)
//     linking the sections they are drawn from, the deck's request and answer,
//     and the commands it runs - the page check, and the validation the
//     section passes before it is handed back;
//   - `skeleton`: the deck's sections in order, the section's pages as the
//     critique reads them (the spine fields), the limits each type sets, and
//     the insights it may rest pages on - those its pages name and those no
//     page names yet;
//   - `writer`: the section's pages as they stand, the limits each is held to
//     (the `limits` block `--scaffold` prints for its type, form and
//     commentary, printed once per set and named by the pages it holds), and
//     every measure its evidence holds, with the token that prints each value;
//   - `critic` and `judge`: the section's page ids and titles; the packets
//     they answer hold the rest.
//
// A section is a part file of the pages file (pages-file.mjs): `--section
// 1-atlantic` or `--section pages/1-atlantic.pages.json`. Without it the pack
// covers the whole deck.
import fs from "node:fs";
import path from "node:path";
import { partsOf } from "./pages-file.mjs";
import { axisOf, measureRegistry, valuesOf } from "./measures.mjs";
import { tokenOf } from "./spine-witness.mjs";

export const BRIEF_ROLES = Object.freeze(["skeleton", "writer", "critic", "judge"]);
// The fields the storyline critique reads of a page (storyline.mjs storyStructure): what a skeleton writes.
const SPINE_FIELDS = ["id", "kind", "type", "form", "title", "why", "evidence", "settles", "basis"];
// The keys of a limits block that explain a number rather than set one: the digest says the rules, the pack keeps the numbers.
const EXPLAINING = new Set(["codes", "note"]);

const partName = (part) => path.basename(part).replace(/(\.pages)?\.json$/, "");
const compact = (value) => JSON.stringify(value);
const pagesOf = (doc) => [...(doc.pages || []), ...(doc.appendix || [])].filter((page) => page && typeof page === "object");
const emptyObject = (value) => value && typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length;
const numbersOf = (node) => (Array.isArray(node) ? node.map(numbersOf) : node && typeof node === "object"
  ? Object.fromEntries(Object.entries(node).filter(([key]) => !EXPLAINING.has(key)).map(([key, value]) => [key, numbersOf(value)]).filter(([, value]) => !emptyObject(value))) : node);
// The finding whole: cut at a hundred and twenty characters it lost the numbers and comparators a title is written from - the
// BA skeleton's writers met "profitable in only one of fif..." and wrote "rarely", and could not say whom BA cancels more than.
const insightLine = (id, insight) => {
  const finding = String(insight?.finding ?? "");
  return `${id}${insight?.strength ? ` (${insight.strength}${insight.shape ? `, ${insight.shape}` : ""})` : ""}${finding ? `: ${finding}` : ""}`;
};

/** The section's pages in deck order, `{ pages, part }`, or `{ why }` where `section` names no part of the pages file. */
export function sectionPages(doc, section) {
  const all = pagesOf(doc);
  if (section === null || section === undefined) return { pages: all, part: null };
  const parts = partsOf(doc);
  const names = [...new Set(parts.values())];
  const part = names.find((name) => name === section || partName(name) === section || partName(name) === partName(section));
  if (!part) return { why: names.length ? `No section "${section}" in the pages file; its sections are ${names.map(partName).join(", ")}` : "The pages file is not written in sections (no `include` of a part file), so --section has nothing to name: leave it out to brief the whole deck" };
  return { pages: all.filter((page) => parts.get(String(page.id)) === part), part };
}

/**
 * A measure's values with the tokens that print them (spine-witness.mjs tokenOf, the token the runtime itself writes): the
 * values that print in one format are listed under one token, its label standing for each - `{{i3/journeys@<period> | 0.0}}`
 * for `FY25 47.5` is exactly `{{i3/journeys@FY25 | 0.0}}`.
 */
function measureLine(measure) {
  const axis = axisOf(measure), values = valuesOf(measure);
  const unit = measure.unit ? ` (${measure.unit})` : "";
  if (axis.kind === "scalar") return `- ${measure.name}${unit}: ${tokenOf(measure.ref, null, measure)} = ${values[0] ?? "n/a"}`;
  const byFormat = new Map(), missing = [];
  axis.labels.forEach((label, i) => {
    const token = tokenOf(measure.ref, label, measure);
    if (token === "n/a") { missing.push(label); return; }
    const format = /\| (.*)\}\}$/.exec(token)[1];
    byFormat.set(format, [...(byFormat.get(format) ?? []), `${label} ${values[i]}`]);
  });
  const slot = axis.kind === "periods" ? "<period>" : "<member>";
  return `- ${measure.name}${unit}: ${[...byFormat].map(([format, shown]) => `{{${measure.ref}@${slot} | ${format}}} for ${shown.join(", ")}`).join("; ")}${missing.length ? `; no value at ${missing.join(", ")}` : ""}`;
}

/** The measures the pages' evidence holds, insight by insight in the order the pages first name them. */
function measureLines(pages, insights) {
  const registry = measureRegistry(insights);
  const lines = [];
  for (const id of evidenceOf(pages)) {
    const insight = insights.get(id);
    const measures = [...registry.values()].filter((measure) => measure.owner === id);
    lines.push(`### ${insightLine(id, insight)}`, ...(measures.length ? measures.map(measureLine) : [insight ? "- no measures recorded: its numbers are not printed by token" : "- not in the insight log"]));
  }
  return lines;
}
const evidenceOf = (pages) => [...new Set(pages.flatMap((page) => (Array.isArray(page.evidence) ? page.evidence.map(String) : [])))];

/** The limits the pages are held to, each set printed once, and the set each page is held to: `{ sets: [[key, limits, ids]], of }`. */
function limitSets(pages, limitsOf) {
  const sets = new Map(), of = new Map();
  for (const page of pages.filter((p) => p.type)) {
    const key = [page.type, page.form, page.commentary].filter(Boolean).join(" / ");
    if (!sets.has(key)) {
      let limits;
      try { limits = numbersOf(limitsOf(page)); } catch (error) { limits = { refused: error.message }; }
      sets.set(key, { limits, ids: [] });
    }
    sets.get(key).ids.push(String(page.id));
    of.set(String(page.id), key);
  }
  // A limit every set holds alike - the title's, the source's - is printed once, as the section's, and each set prints what is its own.
  const all = [...sets.values()].map(({ limits }) => limits);
  const shared = all.length > 1 ? Object.fromEntries(Object.entries(all[0]).filter(([key, value]) => all.every((limits) => compact(limits[key]) === compact(value)))) : {};
  const own = (limits) => Object.fromEntries(Object.entries(limits).filter(([key]) => !(key in shared)));
  return { shared, sets: [...sets].map(([key, { limits, ids }]) => [key, own(limits), ids]), of };
}

/** The commands a role runs on its section, exactly as it runs them. */
function commandLines(role, { file, ids, deckFile }) {
  const pages = ids.join(",");
  const judge = `node runtime/judge.mjs ${file} --page ${pages}`;
  return {
    skeleton: [`- check the spine of your pages: \`node runtime/author-deck.mjs ${file} --draft --page ${pages} --json\` - hand back when nothing blocks on them`,
      "- the page types and the reading task each serves: `node runtime/author-deck.mjs --types`"],
    writer: [`- a page bound to its insight, to start from: \`node runtime/author-deck.mjs ${file} --scaffold <type>[/<form>] --evidence <insight-id> --id <page-id>\``,
      `- check your pages: \`node runtime/author-deck.mjs ${file} --check --page ${pages} --json\` - every blocking finding on them is yours to repair`,
      `- stage the questions the rules ask of your pages: \`${judge}\` (exit 3: packets wait, each for a fresh reader; exit 0: none open)`],
    critic: [`- the section packets are staged by \`node runtime/storyline.mjs ${deckFile} <out> --split\`: answer the section prompt you were given, save its JSON where the prompt says, and \`node runtime/storyline.mjs merge ${deckFile} <out>\` validates every part against its packet`],
    judge: [`- stage your section's questions: \`${judge}\` (exit 3: packets wait in judgements/<section>/; exit 0: none open)`,
      "- give each packet's prompt.md to its own fresh reader, save its JSON as answer.json in the packet's folder, and run the same command again to record it",
      `- a plain \`node runtime/judge.mjs ${file}\` records every section's answered packets`],
  }[role];
}

/**
 * The brief for `role` over `section` of the pages file: `{ lines }`, or `{ why }` where the section is not one of the file's.
 * `limitsOf(page)` is the limits block `--scaffold` prints for a page; `insights` the insight log as author-deck reads it,
 * null where there is none; `digest` the role's rules; `slotsOf`, for a writer, each page's measured slots by id.
 */
export function briefLines(doc, { role, section = null, file, stem, insights = null, limitsOf, digest, slotsOf = null }) {
  const found = sectionPages(doc, section);
  if (found.why) return { why: found.why };
  const { pages, part } = found;
  const ids = pages.map((page) => String(page.id)), mine = new Set(ids);
  const deck = doc.deck ?? {};
  const said = (value) => (typeof value === "string" ? value : compact(value));
  const lines = [`# ${role} brief: ${part ? `section ${partName(part)} (${part})` : "the whole deck"}, ${pages.length} page${pages.length === 1 ? "" : "s"}`, "", digest.trim(), "", "## The deck",
    ...(deck.request ? [`Request: ${said(deck.request)}`] : []), ...(deck.answer ? [`Answer: ${said(deck.answer)}`] : []), ...(deck.density ? [`Density: ${deck.density}`] : [])];
  if (role === "skeleton") {
    // The pillars in order, for where the section sits; the section's own pages follow in full.
    lines.push("", "## The deck's sections (* yours)", ...pagesOf(doc).filter((page) => page.kind === "section").map((page) => `${mine.has(String(page.id)) ? "*" : " "} [${page.id}] ${page.title ?? ""}`));
  }
  if (role === "critic" || role === "judge") lines.push("", "## Your pages", ...pages.map((page) => `[${page.id}] ${page.title ?? ""}`));
  else {
    const { shared, sets, of } = limitSets(pages, limitsOf);
    if (sets.length) lines.push("", "## Limits (the `limits` block --scaffold prints, its numbers)", ...(Object.keys(shared).length ? [`every page: ${compact(shared)}`] : []),
      ...sets.map(([key, limits, held]) => `${key} (${held.join(", ")}): ${compact(limits)}`));
    lines.push("", `## Your pages${role === "skeleton" ? " (the fields the critique reads)" : ""}`);
    if (slotsOf?.size) lines.push("`slots` under a page: the words each text slot holds where the deck sets it, measured by composing the page with that slot run shorter and longer and the rest as written (`together`: the page passes with every slot at the middle of its range). Write to them.");
    for (const page of pages) {
      const { id: _id, ...fields } = page;
      const shown = role === "writer" ? fields : Object.fromEntries(SPINE_FIELDS.filter((key) => key !== "id" && fields[key] !== undefined).map((key) => [key, fields[key]]));
      lines.push(`[${page.id}]${of.has(String(page.id)) ? ` limits: ${of.get(String(page.id))}` : page.type || page.kind ? "" : " (no type yet)"} ${compact(shown)}`);
      // The words each of its text slots holds where the deck sets it (--scaffold --id prints the same): written to them, the page composes.
      if (slotsOf?.has(String(page.id))) { const { note: _note, ...slots } = slotsOf.get(String(page.id)); lines.push(`  slots: ${compact(slots)}`); }
    }
  }
  if (role === "skeleton" && insights) {
    // What a page may rest on: the insights the section's pages name, and those no page of the deck names yet.
    const named = new Set(evidenceOf(pagesOf(doc))), own = evidenceOf(pages);
    const free = [...insights.keys()].filter((id) => !named.has(id) && !insights.get(id)?.derived);
    // Each insight with the measures `settles.measures` may name: its name, unit and what it runs over.
    const registry = measureRegistry(insights);
    const withMeasures = (id) => {
      const measures = [...registry.values()].filter((measure) => measure.owner === id).map((measure) => {
        const axis = axisOf(measure), over = axis.kind === "scalar" ? "one value" : `${axis.labels.length} ${axis.kind}: ${axis.labels.length > 4 ? `${axis.labels[0]} ... ${axis.labels.at(-1)}` : axis.labels.join(", ")}`;
        return `${measure.ref}${measure.unit ? ` (${measure.unit})` : ""} [${over}]`;
      });
      return `- ${insightLine(id, insights.get(id))}${measures.length ? `\n  measures: ${measures.join("; ")}` : ""}`;
    };
    lines.push("", "## Insights your pages rest on", ...own.map(withMeasures));
    if (free.length) lines.push("", "## Insights no page rests on yet", ...free.map(withMeasures));
  }
  if (role === "writer") lines.push("", "## The measures your pages' evidence holds: each value, and the token that prints it", ...(insights ? measureLines(pages, insights) : ["No insight log beside the pages file: there are no measures to print by token."]));
  lines.push("", "## Commands", ...commandLines(role, { file, ids, deckFile: path.join(path.dirname(file), `${stem}.deck.json`) }));
  return { lines };
}

/** A role's digest of the rules, from references/briefs/<role>.md. */
export const briefDigest = (role) => fs.readFileSync(new URL(`../references/briefs/${role}.md`, import.meta.url), "utf8");
