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
import { includedParts, partsOf } from "./pages-file.mjs";
import { axisOf, isPercentUnit, measureRegistry, valuesOf } from "./measures.mjs";
import { decimalsNeeded } from "./printed-numbers.mjs";
import { recordedPlaces } from "./gates/dependency_gates.mjs";
import { hazardLine, insightLines, itemLine } from "./answer-critique.mjs";
import { claimSheetLines, linesRead } from "./claim-sheet.mjs";
import { questionLines } from "./judgements.mjs";
import { READING_TASK_BANK } from "./text-contract.mjs";
import { conventionsOf, pageSubject, sectionName, sectionsOf } from "./conventions.mjs";
import { evidenceHomes, plottableValues } from "./allocation.mjs";

export const BRIEF_ROLES = Object.freeze(["skeleton", "writer", "critic", "judge", "selfcheck"]);
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

/**
 * The deck's conventions in a few lines, and the subject of each of the section's pages where it is not the deck's: or the
 * one line that says none is declared yet, which the skeleton fills before its pages are written.
 */
function conventionLines(doc, pages, part, role) {
  const conventions = conventionsOf(doc.deck);
  if (!conventions) return role === "skeleton" ? ["Conventions: none declared - the lead fills `deck.conventions` (subject, names, peerSets, currency, heat) before the skeleton is written; `--schema deck` prints its shape"] : [];
  const { subject, names, peerSets, currency, heat } = conventions;
  const lines = ["", "## The deck's conventions (`deck.conventions`): every page holds them",
    ...(subject ? [`- subject: ${subject} - in the accent wherever a chart plots it; the runtime marks it, so name no other focus`] : []),
    ...(names ? [`- names: ${Object.entries(names).map(([name, entry]) => `"${name}", never ${(entry?.not ?? []).map((form) => `"${form}"`).join(" or ")}`).join("; ")}`] : []),
    ...(peerSets ? [`- peer sets: ${Object.entries(peerSets).map(([set, list]) => `"${set}" (${(list ?? []).join(", ")})`).join("; ")} - a comparison of players names its set in \`peers\` and what it leaves out in \`omits\``] : []),
    ...(currency ? [`- currency: ${currency === "symbols" ? "symbols (£, $, €)" : "codes (GBP, USD, EUR)"} in every title, line and cell`] : []),
    ...(heat ? [`- heat: ${heat}; a heat column's direction is its measure's recorded \`better\``] : [])];
  const section = part ? sectionName(part) : null;
  const own = pages.filter((page) => page && !page.kind).map((page) => [page.id, pageSubject(conventions, page, section ?? sectionsOf(doc)(page))]).filter(([, named]) => named && named !== subject);
  if (own.length) lines.push(`- page subjects other than the deck's: ${own.map(([id, named]) => `${id} ${named}`).join("; ")}`);
  return lines;
}

/** The section's pages in deck order, `{ pages, part }`, or `{ why }` where `section` names no part of the pages file. */
export function sectionPages(doc, section) {
  const all = pagesOf(doc);
  if (section === null || section === undefined) return { pages: all, part: null };
  // A section is a part file the pages file includes, whether or not it holds a page yet: a section with no divider is briefed
  // before its first page is written (the BA run's opening and appendix were refused until one was).
  const parts = partsOf(doc);
  const names = [...new Set([...includedParts(doc), ...parts.values()])];
  const part = names.find((name) => name === section || partName(name) === section || partName(name) === partName(section));
  if (!part) return { why: names.length ? `No section "${section}" in the pages file; its sections are ${names.map(partName).join(", ")}` : "The pages file is not written in sections (no `include` of a part file), so --section has nothing to name: leave it out to brief the whole deck" };
  return { pages: all.filter((page) => parts.get(String(page.id)) === part), part };
}

/**
 * The token that prints one value of a measure at the record's own precision: the decimal places the value needs to keep
 * what it states (one at least, as the runtime's own tokens print it - spine-witness.mjs tokenOf), never more than any
 * recorded value of the measure carries. On the BA retest every token was briefed as `| 0.0`, and the OAG seat shares
 * recorded as 34, 16 and 14 were printed 34.0% (gates/dependency_gates.mjs PRECISION_UNRECORDED).
 */
function tokenOf(ref, label, measure) {
  const value = label === null ? valuesOf(measure)[0] : valuesOf(measure)[axisOf(measure).labels.indexOf(label)];
  if (typeof value !== "number") return "n/a";
  const places = Math.min(recordedPlaces(measure) ?? 1, Math.max(1, decimalsNeeded(value, { percent: isPercentUnit(measure.unit) })));
  return `{{${ref}${label === null ? "" : `@${label}`} | ${places ? `0.${"0".repeat(places)}` : "0"}}}`;
}

/**
 * A measure's values with the tokens that print them (tokenOf): the values that print in one format are listed under one
 * token, its label standing for each - `{{i3/journeys@<period> | 0.0}}` for `FY25 47.5` is exactly
 * `{{i3/journeys@FY25 | 0.0}}`, and `{{oag/share@<member> | 0}}` for `BA 34` is `{{oag/share@BA | 0}}`.
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

/**
 * The body-word band a writer's page is held to, for each reading task its
 * placement makes it (limits.mjs pageLimits): the floor, the reference decks'
 * median and the ceiling - their upper quartile, which the density profile the
 * review reads holds it to as well (derive-content.mjs wordBudgetOf). On ba4
 * seven pages written under the old ceiling, the outlier fence, cleared every
 * check and were judged too dense by the review.
 */
function bodyWordBand(page, limitsOf) {
  if (!page.type) return null;
  let limits;
  try { limits = limitsOf(page); } catch { return null; }
  const tasks = limits?.bodyWords ?? (page.form ? null : Object.assign({}, ...Object.values(limits?.forms ?? {}).map((f) => f.bodyWords ?? {})));
  const bands = Object.entries(tasks ?? {}).filter(([, b]) => b && Number.isFinite(b.min) && Number.isFinite(b.max))
    .map(([task, b]) => `${b.min}-${b.max} as ${task}${READING_TASK_BANK[task] ? ` (median ${Math.round(READING_TASK_BANK[task].bodyWords.median)})` : ""}`);
  return bands.length ? `${bands.join("; ")} - the band the review reads; write near the median` : null;
}

/** The commands a role runs on its section, exactly as it runs them. */
function commandLines(role, { file, ids, deckFile, part, spine }) {
  const pages = ids.join(",");
  // A self-check's answer is validated before it is handed back, as a critic's is: a page left without a verdict, a replacement
  // past its slot or printing a number no record holds, or a field the page does not have is refused while the checker can mend it.
  const answer = `out/self-check/${spine ? "spine/" : ""}${part ? partName(part) : "deck"}.json`;
  const judge = `node runtime/judge.mjs ${file} --page ${pages}`;
  return {
    skeleton: [`- check the spine of your pages: \`node runtime/author-deck.mjs ${file} --draft --page ${pages} --json\` - hand back when nothing blocks on them`,
      "- the page types and the reading task each serves: `node runtime/author-deck.mjs --types`"],
    writer: [`- a page bound to its insight, to start from: \`node runtime/author-deck.mjs ${file} --scaffold <type>[/<form>] --evidence <insight-id> --id <page-id>\``,
      `- check your pages: \`node runtime/author-deck.mjs ${file} --check --page ${pages} --json\` - every blocking finding on them is yours to repair`,
      `- the questions the rules ask of your pages are answered once, by the section's self-checker beside its claims (\`node runtime/author-deck.mjs ${file} --brief selfcheck${part ? ` --section ${partName(part)}` : ""}\`); where the section has no self-check, \`${judge}\` stages them for readers of their own (exit 3: packets wait, each for a fresh reader; exit 0: none open)`],
    critic: [`- the section packets are staged by \`node runtime/storyline.mjs ${deckFile} <out> --split\`: answer the section prompt you were given, save its JSON where the prompt says, and \`node runtime/storyline.mjs merge ${deckFile} <out>\` validates every part against its packet`],
    selfcheck: [`- save your answer as ${answer} beside ${file} (the form above), then run \`node runtime/self-check.mjs --validate ${answer} ${file}\` - it prints every reason the answer would be refused; mend each and run it again until it says the answer is recorded`,
      ...(spine ? [] : ["- the validation composes every page your replacements touch with all of them in place, and runs the page check the writer runs: a replacement under which a page has a blocking finding it does not have now is refused, with the finding's repair. Once it passes, your `judgements` are recorded in the deck's judgements file, as the judges' are"]),
      ...(spine ? ["- the lead applies your replacements to the titles and summaries before the storyline critique closes"]
        : [`- the lead records the deck's with \`node runtime/self-check.mjs ${file} out/\` after the build: a page whose replacements were applied word for word keeps your verdict`])],
    judge: [`- stage your section's questions: \`${judge}\` (exit 3: packets wait in judgements/<section>/; exit 0: none open)`,
      "- give each packet's prompt.md to its own fresh reader, save its JSON as answer.json in the packet's folder, and run the same command again to record it",
      `- a plain \`node runtime/judge.mjs ${file}\` records every section's answered packets`],
  }[role];
}

// The caps a writer chooses within: where the commentary sits and whether the page closes on a line. The rest are the skeleton's.
const PLACEMENT_QUOTAS = new Set(["VARIETY_COMMENTARY", "VARIETY_COLUMN", "VARIETY_TAKEAWAY", "HEADLINE_CROWDED"]);

/**
 * The section's room under each of the deck's caps (deck-structure.mjs
 * sectionQuotas), as lines: the cap in pages, what the other sections hold
 * (by section), what that leaves this one and what it holds. A skeleton is
 * told every quota and the kinds of exhibit; a writer the placements it
 * chooses. On the BA retest each section met the deck's caps only once all
 * were written - 2a wrote four numbers pages of six against a deck cap of
 * nine, and a writer's `below` on hw04 tipped VARIETY_COMMENTARY for all.
 */
function quotaLines(quotas, role, parts) {
  const bySection = (ids) => {
    const tally = new Map();
    for (const id of ids) { const part = parts.get(String(id)); const name = part ? partName(part) : "the pages file"; tally.set(name, (tally.get(name) ?? 0) + 1); }
    return [...tally].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count}`).join(", ");
  };
  const lines = quotas.quotas.filter((q) => role === "skeleton" || PLACEMENT_QUOTAS.has(q.code)).map((q) => {
    // A section of a deck still being written is held to its fair share of the room - the cap's share of its own budget,
    // rounded - where it has a budget; the cap's whole room is every section's at once only once all are written.
    const fair = q.fair === undefined ? null : Math.round(q.fair);
    const left = fair === null ? Math.max(q.room, 0) : Math.max(Math.min(q.room, fair), 0), over = q.own.length - left;
    const change = q.code === "VARIETY_TYPE_SHARE" ? "type" : q.code === "VARIETY_EXHIBIT_MIX" ? "exhibit" : q.code === "HEADLINE_CROWDED" ? "form without a headline figure" : "placement";
    const standing = over > 0 ? `: ${over} over - give ${over === 1 ? "one" : `${over} of them`} another ${change}` : over === 0 ? ": at the cap" : `: ${-over} to spare`;
    const of = quotas.planned ? `${q.of} pages planned (${quotas.pages} written)` : `${q.of} pages`;
    const leaves = fair === null ? `which leaves this section ${left}` : `and this section's fair share, for its budget of ${quotas.budget} pages, is ${left} (${q.fair.toFixed(1)})`;
    return `- ${q.what} (${q.code}${q.key ? `.${q.key}` : ""}, at most ${Math.round(q.share * 100)}%): the deck's cap is ${q.cap} of ${of}; the other sections hold ${q.others.length}` +
      `${q.others.length ? ` (${bySection(q.others)})` : ""}, ${leaves}${q.room < 0 ? ` (they are ${-q.room} over it already)` : ""}; it holds ${q.own.length}${q.own.length ? ` (${q.own.join(", ")})` : ""}${standing}`;
  });
  // The section's share of the deck's floors, given before its skeleton (allocation.mjs): the kinds it draws for the deck, each
  // from an insight it holds in a form that draws it, and the depth its chart pages keep - its own to meet, whatever the others do.
  if (quotas.share) {
    const { share, given } = quotas, d = share.depth;
    lines.push(`- this section's share of the deck (\`allocation\` in its part file, given by --allocate): it draws ${given.map((g) => (typeof g === "string" ? g : `${g.kind} (${g.insight} as ${g.type}/${g.form})`)).join(", ")} for the deck - ` +
      `${share.owed.length ? `not drawn yet: ${share.owed.join(", ")}. Each was given to this section because its evidence draws it and no other section is counted on to: keep it on the page the evidence suits, in a form that carries that page's claim` : "every one drawn; keep them"}`,
    `- depth: ${d.charts ? `${d.deep} of this section's ${d.charts} chart page${d.charts === 1 ? "" : "s"} plot ${d.floor} values or more, and at least ${d.need} must${d.deep < d.need ? ` - deepen ${d.thin.join(", ")} (a peer set, a second series, a longer window), or draw its evidence as a table or figures` : ""}` : `no chart page yet; at least half of them plot ${d.floor} values or more, so the deck's median holds`}`);
  }
  if (role === "skeleton") {
    const k = quotas.kinds;
    lines.push(`- kinds of exhibit (VARIETY_EXHIBIT_RANGE, at least ${k.perTen} per ten pages; advisory at the spine, held at the full compile): the floor is ${k.floor} for ${quotas.planned ?? quotas.pages} pages${quotas.planned ? " planned" : ""}, and the deck draws ${k.deck} so far - ` +
      `the other sections ${k.others.length}${k.others.length ? ` (${k.others.join(", ")})` : ""}; this section ${k.own.length}${k.own.length ? ` (${k.own.join(", ")})` : ""}, ${k.only.length} no other section draws${k.only.length ? ` (${k.only.join(", ")})` : ""}`,
    k.adds.length ? `  kinds the deck does not draw that this section's evidence holds (each read as --scaffold <type>/<form> --evidence reads it): ${k.adds.map((item) => `${item.id} as ${item.type}/${item.form} (${item.change === "form" ? "form change" : `type change from ${item.from}`}) adds ${item.adds.join(", ")}`).join("; ")}`
      : "  no form this section's evidence holds draws a kind the deck does not draw yet");
  }
  return lines;
}

/**
 * The brief for `role` over `section` of the pages file: `{ lines }`, or `{ why }` where the section is not one of the file's.
 * `limitsOf(page)` is the limits block `--scaffold` prints for a page; `insights` the insight log as author-deck reads it,
 * null where there is none; `digest` the role's rules; `slotsOf`, for a writer, each page's measured slots by id; `sheet`, for a
 * self-checker, its pages' claims (claim-sheet.mjs), and `spine` where they are the titles and divider summaries alone;
 * `questions`, for a section's self-checker, the questions the rules ask of its pages that no judgement answers; `quotas`,
 * for a skeleton or a writer briefed on a section, its room under the deck's caps (deck-structure.mjs sectionQuotas).
 */
export function briefLines(doc, { role, section = null, file, stem, insights = null, limitsOf, digest, slotsOf = null, answerItems = [], answerHazards = [], sheet = null, questions = null, spine = false, quotas = null }) {
  const found = sectionPages(doc, section);
  if (found.why) return { why: found.why };
  const { pages, part } = found;
  const ids = pages.map((page) => String(page.id)), mine = new Set(ids);
  const deck = doc.deck ?? {};
  const said = (value) => (typeof value === "string" ? value : compact(value));
  const lines = [`# ${role} brief${spine ? " (titles and divider summaries)" : ""}: ${part ? `section ${partName(part)} (${part})` : "the whole deck"}, ${pages.length} page${pages.length === 1 ? "" : "s"}`, "", digest.trim(), "", "## The deck",
    ...(deck.request ? [`Request: ${said(deck.request)}`] : []), ...(deck.answer ? [`Answer: ${said(deck.answer)}`] : []), ...(deck.density ? [`Density: ${deck.density}`] : [])];
  // What the answer critique raised before the skeleton (answer-critique.mjs): a page that builds on a claim the log does not
  // support is a page the storyline critique sends back, so the skeleton and its writers see what is open.
  // The deck's conventions (conventions.mjs), which every section's pages hold: sixteen BA writers each chose their own accent,
  // peers, names and currency, and the review was the first reader to see them disagree.
  if (["skeleton", "writer", "selfcheck"].includes(role)) lines.push(...conventionLines(doc, pages, part, role));
  if (["skeleton", "writer", "selfcheck"].includes(role) && answerItems.length) {
    lines.push("", "## Raised on the answer before the skeleton (out/answer-critique.json): do not build on these as raised", ...answerItems.map((item) => `- ${itemLine(item)}`));
  }
  if (["skeleton", "writer", "selfcheck"].includes(role) && answerHazards.length) {
    lines.push("", "## Comparisons the log cannot support (out/answer-critique.json): no title, exhibit or point makes them as stated", ...answerHazards.map((hazard) => `- ${hazardLine(hazard)}`));
  }
  if (role === "skeleton") {
    // The pillars in order, for where the section sits; the section's own pages follow in full.
    lines.push("", "## The deck's sections (* yours)", ...pagesOf(doc).filter((page) => page.kind === "section").map((page) => `${mine.has(String(page.id)) ? "*" : " "} [${page.id}] ${page.title ?? ""}`));
  }
  if (role === "critic" || role === "judge") lines.push("", "## Your pages", ...pages.map((page) => `[${page.id}] ${page.title ?? ""}`));
  else if (role === "selfcheck") {
    // Each page's sentences beside the record behind their numbers (claim-sheet.mjs), and the records whole: the checker
    // reads ranks, comparisons and causes against the findings and calculations, not against the page's own exhibit.
    lines.push("", `## Your pages' ${spine ? "titles and divider summaries" : "claims"} (\`ok\`: every number is a recorded value at its printed precision; \`CHECK\`: one is not; \`fits\`: the room of the slot the text sits in, which a replacement fits; \`as written\`: the text with the tokens that print its numbers)`,
      ...claimSheetLines(sheet ?? []));
    const rests = [...new Set(evidenceOf(pages))].map((id) => insights?.get?.(String(id))).filter(Boolean);
    lines.push("## The records they rest on", ...rests.flatMap((insight) => insightLines(insight)));
    // The questions the rules ask of the same lines, for the same reader (author-deck.mjs openQuestions): one reading a line,
    // so a line that both readings mend gets one fix that passes both.
    if (questions) {
      lines.push("", `## The questions the rules ask of your pages' copy (${questions.length}): answer each in \`judgements\`, beside the claims`);
      if (!questions.length) lines.push("None is open: every question the rules ask of these pages is answered. Leave `judgements` empty.");
      else {
        const reads = new Map(questions.map((item) => [item.key, linesRead(item, sheet ?? [])]));
        lines.push("A rule that turns on what a line means asks a question of it, and holds only where it is answered. Answer each once, from its subject and context (the page's other lines are the sheet above): `{ \"key\", \"verdict\", \"reason\", \"quote\", ...its fields, \"on\" }`, a field the kind or verdict does not take null.",
          "Where one of your problems replaces a line a question reads (`reads`, of its subject or its context), judge the question as the page will read it with your replacement in place, and set `\"on\": \"replacement\"`: an answer given on the line as it stands is lost when the writer applies your fix, and the validation refuses it. Write the replacement so that it passes both readings.", "",
          ...questionLines(questions, { reads }));
      }
    }
  }
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
      const band = role === "writer" ? bodyWordBand(page, limitsOf) : null;
      if (band) lines.push(`  body words: ${band}`);
      // The words each of its text slots holds where the deck sets it (--scaffold --id prints the same): written to them, the page composes.
      // A page with no copy yet does not compose at any slot length: its slots are its limits, and the line says so.
      if (slotsOf?.has(String(page.id))) {
        const { note: _note, read, ...slots } = slotsOf.get(String(page.id));
        lines.push(read === "limits" ? `  slots (its limits - the page does not compose before its copy is written, so no slot was measured): ${compact(slots)}` : `  slots: ${compact(slots)}`);
      }
    }
  }
  if (quotas && ["skeleton", "writer"].includes(role)) {
    lines.push("", `## The deck's caps: this section's room, as the other sections stand now${role === "writer" ? " (the placements you choose)" : ""}`,
      "Choose within it: a page over its section's room tips the deck's cap for every section, and the whole-deck check refuses it.", ...quotaLines(quotas, role, partsOf(doc)));
  }
  if (role === "skeleton" && insights) {
    // What a page may rest on: the insights the section holds where the deck declares its homes (allocation.mjs), each the one
    // section's to build on; otherwise those its pages name, and those no page of the deck names yet.
    const homes = evidenceHomes(doc), held = part && homes.declared ? [...homes.home].filter(([, at]) => at === part).map(([id]) => id) : null;
    const rereads = part && homes.declared ? [...(homes.rereads.get(part) ?? [])] : [];
    const named = new Set(evidenceOf(pagesOf(doc))), own = held ? [...new Set([...held, ...rereads])] : evidenceOf(pages);
    const free = held ? [] : [...insights.keys()].filter((id) => !named.has(id) && !insights.get(id)?.derived);
    // Each insight with the measures `settles.measures` may name: its name, unit and what it runs over.
    const registry = measureRegistry(insights);
    const withMeasures = (id) => {
      const measures = [...registry.values()].filter((measure) => measure.owner === id).map((measure) => {
        const axis = axisOf(measure), over = axis.kind === "scalar" ? "one value" : `${axis.labels.length} ${axis.kind}: ${axis.labels.length > 4 ? `${axis.labels[0]} ... ${axis.labels.at(-1)}` : axis.labels.join(", ")}`;
        return `${measure.ref}${measure.unit ? ` (${measure.unit})` : ""} [${over}]`;
      });
      const plots = plottableValues(insights.get(id));
      return `- ${insightLine(id, insights.get(id))}${rereads.includes(id) ? " [re-read from another section]" : ""}${measures.length ? `\n  measures: ${measures.join("; ")}${plots ? ` - plots up to ${plots} values` : ""}` : ""}`;
    };
    lines.push("", held ? `## The insights this section holds: its pages rest on these alone (${homes.home.size - held.length} more are other sections', and a page that builds on one is refused: EVIDENCE_ELSEWHERE)` : "## Insights your pages rest on", ...own.map(withMeasures));
    if (free.length) lines.push("", "## Insights no page rests on yet", ...free.map(withMeasures));
  }
  if (role === "writer") lines.push("", "## The measures your pages' evidence holds: each value, and the token that prints it", ...(insights ? measureLines(pages, insights) : ["No insight log beside the pages file: there are no measures to print by token."]));
  lines.push("", "## Commands", ...commandLines(role, { file, ids, deckFile: path.join(path.dirname(file), `${stem}.deck.json`), part, spine }));
  return { lines };
}

/** A role's digest of the rules, from references/briefs/<role>.md. */
export const briefDigest = (role) => fs.readFileSync(new URL(`../references/briefs/${role}.md`, import.meta.url), "utf8");
