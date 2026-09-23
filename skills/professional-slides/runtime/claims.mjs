// The claim ledger: every checkable statement the rendered deck makes, listed
// for the author to reproduce before the review.
//
// Most review rounds used to be spent on things the author could have caught
// with the data open: a figure mistyped from the records, a superlative that a
// rival quietly meets, a summary number no page shows, the same proposition
// proved on three pages. The ledger turns those into a list the author works
// through once, so the independent review reads a deck whose claims already
// hold. It does not judge truth; it says what has to be checked.
//
//   node runtime/claims.mjs out/          writes out/claims.json
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Text a reader takes as a statement, not a label. Data labels, table cells and
// axes carry the evidence; the claims are made about it in these roles.
export const CLAIM_ROLES = new Set(["action-title", "list-lead", "list-item", "list-subitem", "insight-body", "paragraph",
  "footnote-text", "category-note", "fact-text", "spectrum-text", "arrow-row-text", "metric-label", "section-heading"]);
export const CLAIM_CODES = Object.freeze({
  SUMMARY_UNPROVED: "a summary or close states a figure that no proving page prints",
  SELF_CHECK_INCOMPLETE: "a page's claims have no current self-check verdict, or a ledger finding is unanswered"
});
// Pages whose claims restate the argument rather than prove it.
export const SUMMARY_ROLES = new Set(["executive-summary", "conclusion", "summary", "recommendation", "verdict"]);

// A number, or a word that makes a statement universal, ranked or comparative.
// These are the statements a single counterexample in the data can break.
const QUANTIFIER = /\b(only|every|each|all|none|no|never|always|any|highest|lowest|largest|smallest|biggest|most|least|fewest|first|last|best|worst|top|bottom|beats?|leads?|led|ahead|behind|above|below|exceeds?|more|less|fewer|than|unlike|matches|ranks?|ranked|record|twice|half|double|doubled|tripled|rose|fell|grew|declined)\b/i;
const NUMBER = /\d/;

const normalize = (text) => String(text ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
const textOf = (node) => normalize(node.data?.textLayout?.source ?? node.text);
const hash = (text, length) => createHash("sha256").update(text).digest("hex").slice(0, length);

export function sentences(text) {
  // Split where a sentence or clause list ends and a new one starts; decimals stay whole.
  return normalize(text).split(/(?<=[.!?;])\s+(?=[A-Z0-9$£€"'(])/).map((s) => s.trim()).filter(Boolean);
}

export const isClaim = (sentence) => NUMBER.test(sentence) || QUANTIFIER.test(sentence);
export const claimId = (slideId, text) => hash(`${slideId}\u0000${normalize(text)}`, 12);

// Numeric tokens as a reader would compare them: "$1,311.8m" → 1311.8, one decimal.
export function numbersIn(text) {
  return (String(text).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((raw) => {
    const plain = raw.replace(/,/g, "");
    return { raw, value: Number(plain), decimals: (plain.split(".")[1] || "").length };
  });
}

// A summary figure is shown when some page prints it at any thousand-scale and
// it rounds to the summary's precision: "$1.34bn" is shown by a bar labelled
// "1,337" on a $m axis. Years are dates, not figures.
export function figureShown(figure, printed) {
  const tolerance = 0.5 * 10 ** -figure.decimals + 1e-9;
  return printed.some((value) => [1e-9, 1e-6, 1e-3, 1, 1e3, 1e6, 1e9].some((scale) => Math.abs(value * scale - figure.value) <= tolerance));
}
const isYear = (figure) => figure.decimals === 0 && figure.value >= 1900 && figure.value <= 2100;

export function buildLedger(scene) {
  const slides = scene.slides.map((slide, index) => ({ slide, index }));
  const claims = [];
  for (const { slide, index } of slides) {
    for (const node of slide.nodes) {
      if (node.type !== "text" || !CLAIM_ROLES.has(node.role)) continue;
      for (const text of sentences(textOf(node))) {
        if (isClaim(text)) claims.push({ id: claimId(slide.id, text), slide: slide.id, page: index + 1, role: node.role, text });
      }
    }
  }
  // A sentence repeated on one page is one claim to check.
  const unique = [...new Map(claims.map((c) => [c.id, c])).values()];

  const findings = [];
  // A summary figure that no proving page shows: the reader is asked to take it
  // on trust, and the review will ask where it came from.
  const printed = slides.filter(({ slide }) => !SUMMARY_ROLES.has(slide.role))
    .flatMap(({ slide }) => slide.nodes.filter((n) => n.type === "text").flatMap((n) => numbersIn(textOf(n)).map((f) => f.value)));
  for (const claim of unique) {
    if (!SUMMARY_ROLES.has(scene.slides[claim.page - 1].role)) continue;
    const missing = [...new Set(numbersIn(claim.text).filter((f) => !isYear(f) && !figureShown(f, printed)).map((f) => f.raw))];
    if (missing.length) findings.push({ code: "SUMMARY_UNPROVED", slide: claim.slide, claim: claim.id, numbers: missing,
      reason: `The summary states ${missing.join(", ")}, which no other page shows`, repair: "Show the figure on the page that proves it, or cut it from the summary" });
  }
  // The title spine, in order, for the author's merge pass. Whether two titles
  // make the same proposition is a reading judgement; shared words do not settle it.
  const spine = slides.map(({ slide, index }) => {
    const node = slide.nodes.find((n) => n.role === "action-title");
    return node ? { slide: slide.id, page: index + 1, title: textOf(node) } : null;
  }).filter(Boolean);
  // One hash per page over its claim IDs: a verdict stays current while the
  // page's claims are unchanged, whatever else the rebuild moved.
  const byPage = {};
  for (const claim of unique) (byPage[claim.slide] ??= []).push(claim.id);
  const pageHashes = Object.fromEntries(Object.entries(byPage).map(([slide, ids]) => [slide, hash(ids.sort().join(","), 16)]));
  return { schema: "professional-slides.claims/v1", spine, pageHashes, claims: unique, findings,
    counts: { claims: unique.length, pages: Object.keys(byPage).length, findings: findings.length } };
}

export async function writeLedger(directory) {
  const scene = JSON.parse(await fs.readFile(path.join(directory, "scene.json"), "utf8"));
  const ledger = buildLedger(scene);
  await fs.writeFile(path.join(directory, "claims.json"), JSON.stringify(ledger, null, 2) + "\n");
  return ledger;
}

export const findingKey = (finding) => `${finding.code}:${finding.claim ?? finding.slide}`;

/**
 * The author's self-check is complete when every page that makes claims has a
 * verdict bound to its current claims, every ledger finding is answered, and
 * the title-spine pass is recorded. A rebuild keeps the verdicts of pages whose
 * claims did not change and asks only for the pages that did.
 */
export function validateSelfCheck(selfCheck, ledger) {
  if (!ledger) return [];
  if (!selfCheck || typeof selfCheck !== "object") return ["self-check.json is missing: reproduce every claim in claims.json from the source records, then record a verdict per page"];
  const errors = [];
  const pages = selfCheck.pages && typeof selfCheck.pages === "object" ? selfCheck.pages : {};
  const stale = Object.entries(ledger.pageHashes).filter(([slide, current]) => pages[slide]?.claims !== current || pages[slide]?.verified !== true).map(([slide]) => slide);
  if (stale.length) errors.push(`self-check has no current verdict for ${stale.length} page(s) whose claims changed or were never checked: ${stale.join(", ")}`);
  const answers = selfCheck.findings && typeof selfCheck.findings === "object" ? selfCheck.findings : {};
  const open = ledger.findings.filter((f) => typeof answers[findingKey(f)] !== "string" || answers[findingKey(f)].trim().length < 20);
  if (open.length) errors.push(`${open.length} ledger finding(s) are unanswered: ${open.map(findingKey).join(", ")}`);
  if (typeof selfCheck.spine !== "string" || selfCheck.spine.trim().length < 40) errors.push("self-check.spine must record the title-spine pass: which pages were merged or cut, or why none were");
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(process.argv[2] || "out");
  const ledger = await writeLedger(directory);
  console.log(JSON.stringify({ claims: ledger.counts.claims, pages: ledger.counts.pages, findings: ledger.findings.map((f) => `${findingKey(f)}: ${f.reason}`) }, null, 1));
}
