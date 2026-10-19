// The storyline: the deck's argument as data, shown to the user and approved before any page is drawn.
//
// A workspace started with `init` is a new argument. Its pages file carries a `storyline` block beside `deck` and `pages`;
// `storyline WORK` prints the one approval message (the page count, the argument tree, the comparison and data behind
// each page) and stops; `--approve "<the user's words>"` records the reply with the storyline's hash; `--scaffold` writes
// the approved pages. `inspect`, `edit` and `build` hold a new argument to it: no page before approval, and no page added
// or dropped after it without a new approval. The A350F deck (Oct 2026) went from a request to twelve rendered pages
// with its reader assumed and its storyline never shown; nothing in the CLI knew a storyline existed.
import crypto from "node:crypto";
import { PAGE_TYPES } from "../page-types.mjs";
import { writeJsonWhole } from "../cli.mjs";

export const ROLES = Object.freeze(["opening", "setup", "finding", "closing", "appendix"]);
const DENSITIES = ["live-pitch", "executive", "pre-read"];
// Pages the runtime draws from the sections and the deck: they are not part of the argument the user approves.
const STRUCTURAL = new Set(["section", "contents", "agenda", "cover"]);
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const STORYLINE_SCHEMA = Object.freeze({
  type: "object", required: ["question", "answer", "reader", "sections", "alternative"],
  properties: {
    question: { type: "string", description: "the question the deck answers" },
    answer: { type: "string", description: "one sentence that answers it, sized in the reader's terms (money, units or share, with a range)" },
    reader: { type: "object", required: ["audience", "readerKnows", "decision", "density"], properties: {
      audience: { type: "string" }, readerKnows: { type: "string" }, decision: { type: "string" }, density: { enum: DENSITIES } } },
    sections: { type: "array", items: { type: "object", required: ["pages"], properties: {
      role: { enum: ROLES, default: "finding" },
      claim: { type: "string", description: "the section's claim, a full sentence; required for a finding section" },
      name: { type: "string", description: "a short handle for the contents page and its divider" },
      pages: { type: "array", items: { type: "object", required: ["id", "title", "type"], properties: {
        id: { type: "string", pattern: ID.source }, title: { type: "string" },
        type: { type: "string", description: "type or type/form from `catalog`" },
        compares: { type: "string", description: "what against what; required for a chart, table or scorecard" },
        members: { type: "integer", description: "for a chart: how many members or periods it compares" },
        series: { type: "integer", default: 1, description: "for a chart: how many series" },
        candidates: { type: "array", items: { type: "string" }, description: "for a chart: the charts that draw its comparison, best first" },
        data: { type: "object", required: ["status", "what"], properties: {
          status: { enum: ["found", "to-find", "derived"] }, what: { type: "string" }, source: { type: "string" } } } } } } } } },
    alternative: { type: "string", description: "one other length and what it drops or adds" },
    approval: { type: "object", description: "written by `storyline WORK --approve`, never by hand" },
  },
});

const formOf = (type) => { const [name, form] = String(type || "").split("/"); return { name, form: form ?? (PAGE_TYPES[name] ? Object.keys(PAGE_TYPES[name].forms)[0] : undefined) }; };
const drawnBy = (type) => { const { name, form } = formOf(type); return PAGE_TYPES[name]?.forms?.[form]; };
const isChart = (type) => String(drawnBy(type) ?? "").startsWith("chart.");
const holdsData = (type) => isChart(type) || ["lookup", "scorecard", "matrix"].includes(formOf(type).name);

/** Every page of the storyline in order, with its section's role. */
export function storylinePages(storyline) {
  return (storyline?.sections ?? []).flatMap((section) => (section?.pages ?? []).map((page) => ({ ...page, role: section.role ?? "finding" })));
}

/** The storyline's hash, without its approval, over keys in a fixed order. */
export function storylineHash(storyline) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).filter((key) => key !== "approval").sort().map((key) => [key, canonical(value[key])])) : value;
  return crypto.createHash("sha256").update(JSON.stringify(canonical(storyline))).digest("hex");
}

/** Every problem with the storyline's shape, as sentences; empty when it can be shown. */
export function storylineProblems(storyline) {
  if (!storyline || typeof storyline !== "object" || Array.isArray(storyline)) return ["`storyline` is an object: { question, answer, reader, sections, alternative }"];
  const problems = [];
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  for (const key of ["question", "answer", "alternative"]) if (!text(storyline[key])) problems.push(`\`storyline.${key}\` is missing`);
  const reader = storyline.reader ?? {};
  for (const key of ["audience", "readerKnows", "decision"]) if (!text(reader[key])) problems.push(`\`storyline.reader.${key}\` is missing: ask the user who reads the deck, what they know and what it is for`);
  if (!DENSITIES.includes(reader.density)) problems.push(`\`storyline.reader.density\` is one of ${DENSITIES.join(", ")}`);
  if (!Array.isArray(storyline.sections) || !storyline.sections.length) return [...problems, "`storyline.sections` lists the sections, each with its pages"];
  if (!storyline.sections.some((s) => (s?.role ?? "finding") === "finding")) problems.push("the storyline has no finding section: the sections that prove the answer");
  const seen = new Set();
  storyline.sections.forEach((section, s) => {
    const where = `section ${s + 1}`;
    if (!ROLES.includes(section?.role ?? "finding")) problems.push(`${where}: \`role\` is one of ${ROLES.join(", ")}`);
    if ((section?.role ?? "finding") === "finding" && !text(section?.claim)) problems.push(`${where}: a finding section states its \`claim\` as a sentence`);
    if (!Array.isArray(section?.pages) || !section.pages.length) { problems.push(`${where}: \`pages\` lists its pages`); return; }
    for (const page of section.pages) {
      const id = page?.id;
      const at = `${where}, page ${text(id) ? `"${id}"` : "?"}`;
      if (!text(id) || !ID.test(id)) problems.push(`${at}: \`id\` is a filename-safe identifier`);
      else if (seen.has(id)) problems.push(`${at}: the id is used twice`); else seen.add(id);
      if (!text(page?.title)) problems.push(`${at}: \`title\` is missing`);
      const { name, form } = formOf(page?.type);
      if (!PAGE_TYPES[name] || !PAGE_TYPES[name].forms[form]) { problems.push(`${at}: \`type\` "${page?.type ?? ""}" is not a type/form from \`catalog\``); continue; }
      if (holdsData(page.type)) {
        if (!text(page.compares)) problems.push(`${at}: \`compares\` names what the exhibit sets against what`);
        if (!page.data || !["found", "to-find", "derived"].includes(page.data.status) || !text(page.data.what)) problems.push(`${at}: \`data\` is { status: found | to-find | derived, what, source }`);
      }
      if (isChart(page.type)) {
        if (!Number.isInteger(page.members) || page.members < 1) problems.push(`${at}: \`members\` counts the members or periods the chart compares`);
        if (!Array.isArray(page.candidates) || !page.candidates.length) problems.push(`${at}: \`candidates\` lists the charts that draw its comparison, best first`);
        else for (const candidate of page.candidates) if (!drawnBy(candidate)) problems.push(`${at}: candidate "${candidate}" is not a type/form`);
      }
    }
  });
  return problems;
}

/** The approval message: the count and its breakdown, the reader, the answer, the argument tree, the alternative. */
export function approvalMessage(storyline) {
  const pages = storylinePages(storyline);
  const count = (role) => pages.filter((p) => p.role === role).length;
  const findings = storyline.sections.filter((s) => (s.role ?? "finding") === "finding");
  const body = pages.filter((p) => p.role !== "appendix").length;
  const parts = [count("opening") && `${count("opening")} opening`, count("setup") && `${count("setup")} setup`,
    `${count("finding")} in ${findings.length} section${findings.length === 1 ? "" : "s"}`, count("closing") && `${count("closing")} closing`].filter(Boolean);
  const r = storyline.reader;
  const lines = [`Storyline: ${body} page${body === 1 ? "" : "s"} (${parts.join(" · ")})${count("appendix") ? ` + appendix of ${count("appendix")}` : ""}, plus the cover and any dividers`,
    `Reader: ${r.audience} · knows: ${r.readerKnows} · for: ${r.decision} · read as: ${r.density}`,
    `Question: ${storyline.question}`, `Answer: ${storyline.answer}`, ""];
  let n = 0, a = 0, finding = 0;
  for (const section of storyline.sections) {
    const role = section.role ?? "finding";
    lines.push(role === "finding" ? `${++finding}. ${section.claim}` : `${role[0].toUpperCase()}${role.slice(1)}${section.claim ? `: ${section.claim}` : ""}`);
    for (const page of section.pages) {
      const number = role === "appendix" ? `A${++a}` : String(++n);
      const detail = [page.type, page.compares && `compares ${page.compares}${Number.isInteger(page.members) ? ` (${page.members} members${(page.series ?? 1) > 1 ? ` × ${page.series} series` : ""})` : ""}`,
        page.candidates && `candidates ${page.candidates.map((c) => (c === page.type ? `${c} (taken)` : c)).join(", ")}`,
        page.data && `data ${page.data.status}: ${page.data.what}${page.data.source ? ` (${page.data.source})` : ""}`].filter(Boolean).join(" · ");
      lines.push(`   ${number.padStart(3)}  ${page.title}`, `        ${detail}`);
    }
  }
  lines.push("", `Alternative: ${storyline.alternative}`, "", "Reply to approve it, or change any line: titles, order, pages, length.");
  return lines.join("\n");
}

/** What a new argument still needs before pages: a storyline, its shape, the user's approval of this version. Null when held. */
export function storylineNeed(work) {
  if (work.project?.argument !== "new") return null;
  const storyline = work.doc.storyline;
  if (!storyline) return { kind: "storyline", target: work.file, discover: "catalog --type storyline --schema",
    message: "Write the `storyline` block in the pages file - question, answer, reader, sections and their pages, one alternative length - then run `storyline WORK` and show the user its message. No page is written before they approve it." };
  const problems = storylineProblems(storyline);
  if (problems.length) return { kind: "storyline", target: work.file, problems, message: `The storyline cannot be shown yet:\n- ${problems.join("\n- ")}` };
  if (!storyline.approval) return { kind: "storyline-approval", message: approvalMessage(storyline),
    ask: "Show the user this message and end your turn. Record their reply with `storyline WORK --approve \"<their words>\"`. A request to make a deck is not approval." };
  if (storyline.approval.hash !== storylineHash(storyline)) return { kind: "storyline-approval", message: approvalMessage(storyline),
    ask: "The storyline changed after the user approved it: show them this version and record their reply with `--approve`." };
  return null;
}

/** The body pages that differ from the approved storyline: added, dropped, retitled. */
export function storylineDrift(work) {
  const approved = storylinePages(work.doc.storyline);
  const written = [...work.doc.pages, ...(work.doc.appendix || [])].filter((page) => !(page.kind && STRUCTURAL.has(page.kind)));
  const ids = new Set(approved.map((p) => p.id)), have = new Set(written.map((p) => String(p.id)));
  const titles = new Map(approved.map((p) => [p.id, p.title]));
  return { missing: approved.filter((p) => !have.has(p.id)).map((p) => p.id), added: written.filter((p) => !ids.has(String(p.id))).map((p) => String(p.id)),
    retitled: written.filter((p) => titles.has(String(p.id)) && typeof p.title === "string" && p.title !== titles.get(String(p.id))).map((p) => String(p.id)) };
}

/**
 * Whether a deck's pages are held to a storyline the user approved: null when they are, or when the deck is not a new
 * argument; else `{ need }` (no storyline, an unshaped one, or one not approved as it stands) or `{ drift }` (pages added
 * or dropped since). A new argument is a workspace `init` started, or any pages file that writes a `storyline` - so
 * `author-deck` and `build-deck`, which the public CLI does not stand in front of, hold it the same way.
 */
export function storylineHold({ doc, project = null, file = null }) {
  if (project?.argument !== "new" && doc?.storyline === undefined) return null;
  const work = { doc, file, project: { argument: "new" } };
  const need = storylineNeed(work);
  if (need) return { need };
  const drift = storylineDrift(work);
  return drift.missing.length || drift.added.length ? { drift } : null;
}

/** The hold as one refusal for the scripts' own output: its code, and what to do. */
export function holdRefusal(hold) {
  if (hold.need) return `STORYLINE_UNAPPROVED: ${hold.need.message}${hold.need.ask ? `\n\n${hold.need.ask}` : ""}\nNo page is compiled or built before the user approves it: a deck is started with \`node runtime/command.mjs init <work>\`, and \`storyline <work>\` shows and records the approval.`;
  const { added, missing } = hold.drift;
  return `STORYLINE_PAGES_CHANGED: the pages differ from the storyline the user approved${added.length ? `; added: ${added.join(", ")}` : ""}${missing.length ? `; not written: ${missing.join(", ")}` : ""}. Write the pages they approved, or change the storyline and show them the new version (\`node runtime/command.mjs storyline <work>\`).`;
}

/** `storyline WORK`: the approval message, or what the storyline still lacks. */
export function showStoryline(work, results) {
  if (!work.doc.storyline) return results.needed([storylineNeed({ ...work, project: { argument: "new" } })]);
  const problems = storylineProblems(work.doc.storyline);
  if (problems.length) return results.blocked("STORYLINE_INVALID", `The storyline cannot be shown yet:\n- ${problems.join("\n- ")}`);
  const approved = work.doc.storyline.approval?.hash === storylineHash(work.doc.storyline);
  return approved ? results.complete({ message: "Approved; this is the version the user approved.", storyline: approvalMessage(work.doc.storyline) })
    : results.needed([{ kind: "storyline-approval", message: approvalMessage(work.doc.storyline),
      ask: "Show the user this message and end your turn. Record their reply with `storyline WORK --approve \"<their words>\"`. A request to make a deck is not approval." }]);
}

/** `storyline WORK --approve "<words>"`: the user's reply, verbatim, bound to this version of the storyline. */
export async function approveStoryline(work, words, results) {
  if (typeof words !== "string" || !words.trim()) throw new Error("--approve takes the user's reply, verbatim");
  const problems = storylineProblems(work.doc.storyline);
  if (problems.length) return results.blocked("STORYLINE_INVALID", `The storyline cannot be approved yet:\n- ${problems.join("\n- ")}`);
  work.doc.storyline.approval = { words: words.trim(), hash: storylineHash(work.doc.storyline), at: new Date().toISOString() };
  await writeJsonWhole(work.file, work.doc);
  return results.complete({ message: "Approved. Run `storyline WORK --scaffold` to write the approved pages." });
}

/** `storyline WORK --scaffold`: each approved page not yet in the pages file, with its id, title, type and form, in order. */
export async function scaffoldStoryline(work, results) {
  const need = storylineNeed({ ...work, project: { argument: "new" } });
  if (need) return results.needed([need]);
  const storyline = work.doc.storyline;
  for (const [key, value] of Object.entries({ ...storyline.reader, question: storyline.question })) work.doc.deck[key] = value;
  const lists = { body: work.doc.pages, appendix: (work.doc.appendix ??= []) };
  const have = new Set([...lists.body, ...lists.appendix].map((p) => String(p.id)));
  const written = [];
  let previous = { body: null, appendix: null };
  for (const page of storylinePages(storyline)) {
    const list = page.role === "appendix" ? "appendix" : "body";
    if (!have.has(page.id)) {
      const { name, form } = formOf(page.type);
      const at = previous[list] === null ? 0 : lists[list].findIndex((p) => String(p.id) === previous[list]) + 1;
      lists[list].splice(at, 0, { id: page.id, title: page.title, type: name, form });
      written.push(page.id);
    }
    previous[list] = page.id;
  }
  if (!lists.appendix.length) delete work.doc.appendix;
  await writeJsonWhole(work.file, work.doc);
  return results.complete({ message: written.length ? `Wrote ${written.length} page${written.length === 1 ? "" : "s"}: ${written.join(", ")}. Fill each from \`catalog --type <type>/<form> --example\`.` : "Every approved page is already in the pages file.", pages: written });
}
