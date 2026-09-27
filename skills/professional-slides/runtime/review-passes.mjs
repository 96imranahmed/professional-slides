// The review loop both reviews share: the storyline critique (storyline.mjs)
// and the deck review (reviewer.mjs).
//
// A review that samples ("p11, p16-p19, e.g.") leaves the author to find the
// rest, and the next review finds them instead - so a fix round never ends. The
// loop here is built the other way round. The first pass is exhaustive: every
// page gets a verdict and every finding names every page it affects. Every
// later pass is a verification: it gives each open finding a status and may add
// only what is both serious and new - a major or blocker on a page the rebuild
// changed, or a blocker the first pass demonstrably could not see. A minor
// point on an unchanged page is refused, because that is how a loop that should
// converge keeps finding more to say. The passes are capped; acceptance is read
// off the ledger of every pass, not off the last reviewer's mood.
import { spawnSync } from "node:child_process";

export const SEVERITIES = Object.freeze(["none", "minor", "major", "blocker"]);
export const PAGE_VERDICTS = Object.freeze(["ok", "minor", "major", "blocker"]);
export const STATUSES = Object.freeze(["fixed", "partly fixed", "not fixed", "regressed"]);
export const MAX_PASSES = 3;

// Calibrated, so two reviewers put the same defect at the same level and the
// acceptance rule means the same thing on every deck.
export const SEVERITY_DEFINITIONS = Object.freeze({
  blocker: "a reader would be misled or the page cannot be shown: a wrong or unreconciled number, a claim its evidence contradicts, an encoding that distorts (unequal time gaps drawn equal, a truncated bar baseline), clipped or unreadable content, an unfinished element (a blank total row, a placeholder)",
  major: "a partner would send the page back: the reader gets the point late, at avoidable cost or with the wrong emphasis - the wrong chart form, a judgement table set as plain text, a wall of text, an empty band, a missing identity anchor, a construction repeated across neighbouring pages, density wrong for the task",
  minor: "polish a reader notices only on close reading and that does not change what they take away: a few points of misalignment, one inconsistent number format, a slightly long label",
  none: "an observation that needs no action",
});

// Why a later pass may add a finding at all. Anything else is the loop reopening itself.
export const NEW_BASES = Object.freeze({
  changed: "on a page the rebuild changed (or beside a deleted page), read now for the first time in this form",
  regression: "a defect the rebuild introduced, on or caused by a changed page",
  missed: "a blocker the first pass demonstrably missed; the justification says why it was not visible then",
});

export const BLOCKING = new Set(["major", "blocker"]);
const rank = (severity) => Math.max(0, SEVERITIES.indexOf(severity === "ok" ? "none" : severity));
export const worst = (list) => list.reduce((a, b) => (rank(b) > rank(a) ? b : a), "none");
export const verdictOf = (severity) => (severity === "none" ? "ok" : severity);

function hasCli(name) { return spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" }).status === 0; }

export function detectBackend(preferred = "auto") {
  if (preferred !== "auto") return preferred;
  if (process.env.PS_REVIEWER) return process.env.PS_REVIEWER;
  if (hasCli("codex")) return "codex";
  if (hasCli("claude")) return "claude";
  return "packet";
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every page a sentence names, by id or by position ("page 12", "slides
 * 3-5"), with ranges ("p16-p19", "p16 to p19") expanded in deck order. It is
 * how validation holds a deck-level finding to the pages its own reason names.
 */
export function pageRefs(text, ids) {
  const found = new Set();
  if (!text || !ids?.length) return found;
  const order = new Map(ids.map((id, i) => [id, i]));
  const token = new RegExp(`(?<![\\w])(${[...ids].sort((a, b) => b.length - a.length).map(escape).join("|")})(?!\\w)`, "g");
  const hits = [...String(text).matchAll(token)].map((m) => ({ id: m[1], at: m.index, end: m.index + m[0].length }));
  hits.forEach((hit, i) => {
    found.add(hit.id);
    const next = hits[i + 1];
    if (next && /^\s*(?:-|–|—|to|through)\s*$/i.test(String(text).slice(hit.end, next.at))) {
      const [a, b] = [order.get(hit.id), order.get(next.id)].sort((x, y) => x - y);
      for (let k = a; k <= b; k += 1) found.add(ids[k]);
    }
  });
  for (const m of String(text).matchAll(/\b(?:pages?|slides?)\s+(\d+)(?:\s*(?:-|–|to)\s*(\d+))?/gi)) {
    const from = Number(m[1]), to = Number(m[2] ?? m[1]);
    for (let n = Math.min(from, to); n <= Math.max(from, to); n += 1) if (ids[n - 1]) found.add(ids[n - 1]);
  }
  return found;
}

// A list of pages given by example: "e.g. p11, p16", "such as pages 4 and 9",
// "p3, p8 etc." The reviewer is asked for every affected page, so a sample is
// refused rather than read as the whole list.
const SAMPLING_BEFORE = /\b(?:e\.\s?g\.?|eg\.|for example|for instance|such as|including|notably|among them)/gi;
const SAMPLING_AFTER = /^[\s,;)]*(?:etc\.?|and others|among others|and more|and so on|\.\.\.|…)/i;
export function samplingProblem(text, ids) {
  const source = String(text ?? "");
  for (const m of source.matchAll(SAMPLING_BEFORE)) {
    if (pageRefs(source.slice(m.index, m.index + m[0].length + 60), ids).size) return `lists pages by example ("${m[0]} ..."): name every affected page`;
  }
  const token = new RegExp(`(?<![\\w])(?:${[...ids].sort((a, b) => b.length - a.length).map(escape).join("|")})(?!\\w)`, "g");
  for (const m of source.matchAll(token)) if (SAMPLING_AFTER.test(source.slice(m.index + m[0].length, m.index + m[0].length + 20))) return `ends a page list with "etc." or "and others": name every affected page`;
  return null;
}

/**
 * The page list of one finding, checked: known pages, a page finding on one
 * page, a deck finding on every page it affects - which includes every page
 * its own text names - and no list given by example.
 */
export function pageListErrors(at, { scope, pages, text, ids, deckScope = "deck" }) {
  const errors = [];
  if (!Array.isArray(pages) || !pages.length) return [`${at}: list the affected pages (${scope === deckScope ? "every one of them" : "the page"})`];
  const known = new Set(ids);
  const unknown = pages.filter((id) => !known.has(id));
  if (unknown.length) errors.push(`${at}: unknown page${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`);
  if (new Set(pages).size !== pages.length) errors.push(`${at}: a page is listed twice`);
  if (scope === "page" && pages.length !== 1) errors.push(`${at}: a page finding names one page; a defect on several pages is a ${deckScope} finding with every page listed`);
  const sampled = samplingProblem(text, ids);
  if (sampled) errors.push(`${at}: ${sampled}`);
  if (scope === deckScope) {
    const named = [...pageRefs(text, ids)].filter((id) => !pages.includes(id));
    if (named.length) errors.push(`${at}: the text names ${named.join(", ")}, which the finding's page list leaves out - list every affected page`);
  }
  return errors;
}

/**
 * The ledger: every finding any pass raised, with its latest status and
 * severity. Pass one opens it; each later pass applies its statuses and appends
 * its new findings. `items` is the review's findings in ledger form
 * ({ id, code, severity, pages, reason, repair }).
 */
export function advanceLedger(prior, review, items) {
  const pass = review?.pass ?? 1;
  const ledger = (prior || []).map((entry) => ({ ...entry }));
  const byId = new Map(ledger.map((entry) => [entry.id, entry]));
  for (const s of review?.statuses || []) {
    const entry = byId.get(s.finding);
    if (!entry) continue;
    entry.status = s.status;
    if (s.severity && SEVERITIES.includes(s.severity)) entry.severity = s.severity;
    const pages = s.pages ?? s.slides;
    if (Array.isArray(pages) && pages.length) entry.pages = pages;
    entry.evidence = s.evidence ?? null;
    entry.updatedIn = pass;
  }
  for (const item of items || []) {
    if (byId.has(item.id)) continue;
    const entry = { ...item, status: "open", raisedIn: pass, updatedIn: pass };
    ledger.push(entry);
    byId.set(item.id, entry);
  }
  return ledger;
}

export const openEntries = (ledger) => (ledger || []).filter((e) => e.status !== "fixed" && e.severity !== "none");
export const openBlocking = (ledger) => openEntries(ledger).filter((e) => BLOCKING.has(e.severity));

/** The worst open severity naming each page: what that page's verdict must say. */
export function expectedVerdicts(ledger) {
  const worstBy = new Map();
  for (const e of openEntries(ledger)) for (const id of e.pages || []) worstBy.set(id, worst([worstBy.get(id) ?? "none", e.severity]));
  return worstBy;
}

/**
 * A later pass, checked against the ledger it verifies: the pass number and
 * lineage, one status for every open finding, and new findings that are
 * additive. `changed` is every page the rebuild changed plus the neighbours of
 * deleted pages; `ids` is the current page list.
 */
export function verificationErrors(review, { scope, ledger, items, ids, pageKey = "slide", deckScope = "deck", automatic = () => false }) {
  const errors = [];
  if (review.pass !== scope.pass) errors.push(`pass must be ${scope.pass}: this review verifies pass ${scope.pass - 1}`);
  if (review.verifies !== scope.verifies) errors.push(`verifies must be ${scope.verifies}, the binding of the pass it verifies`);
  // `automatic` entries take their status from the pass itself (a density
  // verdict re-given on the page), so the reviewer is not asked for one.
  const open = openEntries(ledger).filter((e) => !automatic(e));
  const openIds = new Set(open.map((e) => e.id));
  const statuses = Array.isArray(review.statuses) ? review.statuses : [];
  if (!Array.isArray(review.statuses)) errors.push("statuses must list a status for every open finding of the earlier passes");
  const seen = new Set();
  for (const [i, s] of statuses.entries()) {
    const at = `statuses[${i}]`;
    if (!openIds.has(s?.finding)) { errors.push(`${at}: ${s?.finding} is not an open finding of the earlier passes`); continue; }
    if (seen.has(s.finding)) errors.push(`${at}: ${s.finding} has two statuses`);
    seen.add(s.finding);
    if (!STATUSES.includes(s.status)) errors.push(`${at}: status must be one of ${STATUSES.join(", ")}`);
    if (typeof s.evidence !== "string" || s.evidence.trim().length < 20) errors.push(`${at}: give the evidence on the page for the status`);
    const entry = open.find((e) => e.id === s.finding);
    if (s.severity !== undefined && s.severity !== null) {
      if (!SEVERITIES.includes(s.severity)) errors.push(`${at}: unknown severity ${s.severity}`);
      else if (s.status !== "regressed" && rank(s.severity) > rank(entry.severity)) errors.push(`${at}: a residual severity cannot exceed the finding's ${entry.severity} unless it regressed`);
    }
  }
  const missing = open.filter((e) => !seen.has(e.id)).map((e) => e.id);
  if (missing.length) errors.push(`statuses: every open finding needs a status (fixed, partly fixed, not fixed or regressed); missing ${missing.join(", ")}`);

  const changed = new Set(scope.changed || []);
  const priorIds = new Set((ledger || []).map((e) => e.id));
  for (const [i, item] of (items || []).entries()) {
    const at = `findings[${i}] (${item.id})`;
    if (priorIds.has(item.id)) errors.push(`${at}: the id is already in the ledger; give a new finding a new id`);
    if (!BLOCKING.has(item.severity)) { errors.push(`${at}: a later pass adds only major or blocker findings; a ${item.severity} point on this pass is not additive - leave it out`); continue; }
    if (!NEW_BASES[item.basis]) { errors.push(`${at}: say why it is additive - basis one of ${Object.keys(NEW_BASES).join(", ")}`); continue; }
    const pages = item.pages || [];
    const onChanged = pages.filter((id) => changed.has(id));
    if (item.basis === "changed" && (item.scope === deckScope ? !onChanged.length : onChanged.length !== pages.length))
      errors.push(`${at}: basis "changed" but ${pages.filter((id) => !changed.has(id)).join(", ")} did not change since pass ${scope.pass - 1}; findings on unchanged pages were settled by the earlier passes`);
    if (item.basis === "regression") {
      if (!onChanged.length) errors.push(`${at}: a regression is on or caused by a changed page; none of ${pages.join(", ")} changed`);
      if (typeof item.justification !== "string" || item.justification.trim().length < 40) errors.push(`${at}: say what the rebuild changed that introduced it`);
    }
    if (item.basis === "missed") {
      if (item.severity !== "blocker") errors.push(`${at}: only a blocker the earlier passes missed may be added on unchanged pages; a missed major is not reopened`);
      if (typeof item.justification !== "string" || item.justification.trim().length < 60) errors.push(`${at}: justify why the earlier pass could not see it (what was hidden, or what only this pass could check)`);
    }
    const repeat = open.find((e) => e.code === item.code && (e.pages || []).some((id) => pages.includes(id)));
    if (repeat) errors.push(`${at}: ${item.code} on ${pages.filter((id) => (repeat.pages || []).includes(id)).join(", ")} is already ${repeat.id}; report it as that finding's status`);
  }

  const covered = new Set((review.pages || []).map((p) => p?.[pageKey]));
  const unread = (scope.mustInspect || []).filter((id) => !covered.has(id));
  if (unread.length) errors.push(`pages: this pass must read and record every changed or blocked page; missing ${unread.join(", ")}`);
  const known = new Set(ids);
  const unknown = [...covered].filter((id) => !known.has(id));
  if (unknown.length) errors.push(`pages: unknown page${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`);
  return errors;
}

/** Coverage of a first pass: one entry per page, no page missing, none unknown or doubled. */
export function coverageErrors(entries, ids, pageKey = "slide") {
  if (!Array.isArray(entries)) return ["pages must hold one entry per page"];
  const errors = [];
  const listed = entries.map((p) => p?.[pageKey]);
  const known = new Set(ids);
  const missing = ids.filter((id) => !listed.includes(id));
  if (missing.length) errors.push(`pages: the first pass covers every page; missing ${missing.join(", ")}`);
  const unknown = listed.filter((id) => !known.has(id));
  if (unknown.length) errors.push(`pages: unknown page${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`);
  const doubled = listed.filter((id, i) => listed.indexOf(id) !== i);
  if (doubled.length) errors.push(`pages: ${[...new Set(doubled)].join(", ")} listed twice`);
  return errors;
}

/** A page's verdict is the worst open finding naming it, no better and no worse. */
export function verdictErrors(entries, ledger, pageKey = "slide") {
  const expected = expectedVerdicts(ledger);
  const errors = [];
  for (const entry of entries || []) {
    if (!PAGE_VERDICTS.includes(entry?.verdict)) { errors.push(`pages ${entry?.[pageKey]}: verdict must be one of ${PAGE_VERDICTS.join(", ")}`); continue; }
    const want = verdictOf(expected.get(entry[pageKey]) ?? "none");
    if (entry.verdict !== want) errors.push(`pages ${entry[pageKey]}: verdict ${entry.verdict}, but ${want === "ok" ? "no open finding names it" : `the worst open finding naming it is ${want}`}; the verdict and the findings must agree`);
  }
  return errors;
}

/**
 * The completeness self-check: one entry per rubric dimension, "findings" when
 * the pass raised any in it and "clean" with what was checked when it did not.
 * A clean dimension has to say what was looked at, which is what makes a
 * silent gap visible.
 */
export function completenessErrors(completeness, dimensions, items, key = "dimension") {
  if (!Array.isArray(completeness)) return [`completeness must hold one entry per dimension: ${dimensions.join(", ")}`];
  const errors = [];
  const byDim = new Map();
  for (const entry of completeness) {
    if (!dimensions.includes(entry?.[key])) { errors.push(`completeness: unknown ${key} ${entry?.[key]}`); continue; }
    if (byDim.has(entry[key])) errors.push(`completeness: ${entry[key]} listed twice`);
    byDim.set(entry[key], entry);
  }
  const missing = dimensions.filter((d) => !byDim.has(d));
  if (missing.length) errors.push(`completeness: say what was checked for every ${key}; missing ${missing.join(", ")}`);
  for (const [dim, entry] of byDim) {
    const raised = (items || []).filter((f) => f.dimension === dim).length;
    if (!["findings", "clean"].includes(entry.result)) errors.push(`completeness ${dim}: result must be findings or clean`);
    else if (entry.result === "clean" && raised) errors.push(`completeness ${dim}: marked clean but ${raised} finding${raised === 1 ? "" : "s"} sit in it`);
    else if (entry.result === "findings" && !raised) errors.push(`completeness ${dim}: marked findings but none is filed under it`);
    if (typeof entry.note !== "string" || entry.note.trim().length < (entry.result === "clean" ? 30 : 10)) errors.push(`completeness ${dim}: ${entry.result === "clean" ? "say what was checked and why nothing was found" : "say what was found"}`);
  }
  return errors;
}

/**
 * Pages changed between two hash maps, with the neighbours of every deleted
 * page (the sequence there changed). Null when a deletion leaves no neighbour:
 * the whole thing has to be read again.
 */
export function changedPages(priorHashes, currentHashes) {
  const ids = Object.keys(currentHashes);
  const changed = ids.filter((id) => priorHashes[id] !== currentHashes[id]);
  const priorIds = Object.keys(priorHashes);
  const deleted = priorIds.filter((id) => !(id in currentHashes));
  const neighbours = new Set();
  for (const id of deleted) {
    const at = priorIds.indexOf(id);
    const before = priorIds.slice(0, at).reverse().find((other) => other in currentHashes);
    const after = priorIds.slice(at + 1).find((other) => other in currentHashes);
    if (!before && !after) return null;
    for (const other of [before, after]) if (other) neighbours.add(other);
  }
  return { changed, deleted, neighbours: [...neighbours] };
}

/** The message a capped loop stops with: what is still open, and that only the user can ask for more. */
export function capMessage(kind, pass, maxPasses, ledger) {
  const open = openBlocking(ledger);
  return `The ${kind} has run ${pass - 1} pass${pass - 1 === 1 ? "" : "es"}, the cap of ${maxPasses}. ` +
    (open.length ? `Still open: ${open.map((e) => `${e.id} ${e.code} (${e.severity}) on ${(e.pages || []).join(", ") || "the deck"}`).join("; ")}. ` : "") +
    `Report the open findings to the user; another pass runs only when the user asks for it (--max-passes ${maxPasses + 1}).`;
}

/**
 * Merge the ids of several parts' findings into one namespace: a part's ids
 * are prefixed with the part's id only where two parts used the same one.
 */
export function uniqueIds(parts, listOf) {
  const count = new Map();
  for (const part of parts) for (const f of listOf(part)) count.set(f.id, (count.get(f.id) ?? 0) + 1);
  return (part, id) => (count.get(id) > 1 ? `${part.part?.id ?? "part"}.${id}` : id);
}
