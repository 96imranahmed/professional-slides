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
//
// A verification pass can only close or keep what it is shown, so it cannot
// ratchet a deck toward acceptance: it is never told an earlier rating, a
// "partly fixed" finding keeps its severity unless a measured check now passes,
// and both loops keep their history beside the deck file, keyed by deck id, so
// a new output directory is not a new lineage with a fresh cap.
//
// Everything the two loops do alike lives here, so a fix to one is a fix to
// both: scoping the next pass, splitting a long first pass across parallel
// readers and joining their parts, staging and calling a fresh reviewer, and
// recording each pass.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { runProcess } from "./process.mjs";
import { hostCli, readJson, readJsonSync, writeJson } from "./cli.mjs";
import { textWords } from "./text-contract.mjs";
import { contentWords } from "./gates/content_gates.mjs";
import { registered } from "./errors.mjs";
import { deckStem } from "./artifact-path.mjs";
import { waiverErrors } from "./build-bars.mjs";
import { assetsDeclarationErrors } from "./asset-needs.mjs";
import { carriedChanges, withCarriedPages } from "./revision.mjs";

export const SEVERITIES = Object.freeze(["none", "minor", "major", "blocker"]);
export const PAGE_VERDICTS = Object.freeze(["ok", "minor", "major", "blocker"]);
export const STATUSES = Object.freeze(["fixed", "partly fixed", "not fixed", "regressed"]);
// A status that closes an entry. `unavailable` and `narrowed` are the
// storyline's: a missing analysis searched for and not found, with the search
// log to show it, and a finding met by an answer that now claims less.
// `withdrawn` is the storyline's too: an item the critic now reads as filed in error, quoting the packet line that shows it.
export const CLOSED = Object.freeze(["fixed", "unavailable", "narrowed", "withdrawn"]);
export const MAX_PASSES = 3;
// The rating a deck review must give for the deck to be accepted: 7 is "useful,
// with substantial work still needed" (references/taste-review.md#benchmark-and-score).
export const ACCEPT_RATING = 8;
// Fresh, blind reads of the final artifact a lineage may spend after a
// verification pass accepts; each pass the user adds beyond the cap adds one.
export const MAX_CONFIRMATIONS = 1;
// The folder of a lineage store that keeps the deck review's passes: named here because the storyline loop reads it too (its post-review pass).
export const REVIEW_HISTORY = "review-history";

// Calibrated, so two reviewers put the same defect at the same level and the
// acceptance rule means the same thing on every deck. One scale for both
// judges: `means` is the level, `argument` the defects of argument at that
// level - what the storyline critic reads at the spine and the deck reviewer
// reads again on the page - and `rendered` the defects only a drawn page can
// have. The critic is told the first two, the reviewer all three, from this
// one definition, so a major at the spine is a major on the page.
//
// A level is set by what the defect does to the reader's decision, not by the
// kind of defect: almost every page could be sharper, deeper or better placed,
// and a scale that made those major sent every deck back. So the argument
// side names consequences, and a blocking item says which one it has
// (`ifUnfixed`, BLOCKING_STAKE).
const SEVERITY_SCALE = Object.freeze({
  blocker: { means: "a reader would act on something false, or the page cannot be shown",
    argument: "a figure that is wrong or differs between the pages that state it, a claim the evidence shown contradicts, an answer that does not follow from the pages",
    rendered: "an encoding that distorts (unequal time gaps drawn equal, a truncated bar baseline), clipped or unreadable content, an unfinished element (a blank total row, a placeholder)" },
  major: { means: "the decision-maker's first question would sink the answer or one of its reasons, and the deck could have answered it",
    argument: "a reason the answer rests on with no evidence behind it, evidence that cannot show what the claim asserts, a comparison on incompatible bases, a missing analysis without which the answer could flip",
    rendered: "the wrong chart form for the comparison, a judgement table set as plain text, a wall of text, an empty band, a missing identity anchor, a construction repeated across neighbouring pages, density wrong for the task" },
  minor: { means: "worth improving, and the reader would still decide the same way",
    argument: "a claim that could be sharper or go less far, a page better placed or merged, a counter-argument worth a line, an analysis that would deepen the answer without changing it",
    rendered: "a few points of misalignment, one inconsistent number format, a slightly long label" },
  none: { means: "an observation that needs no action" },
});
/** What a blocking item of argument says it does to the decision, as a critic is asked for it (storyline.mjs `ifUnfixed`). */
export const BLOCKING_STAKE = "A blocking item (major or blocker) carries `ifUnfixed`: what the decision-maker would wrongly conclude or decide if it stays. Without it the item is recorded as minor";
const severityText = (parts) => Object.freeze(Object.fromEntries(Object.entries(SEVERITY_SCALE).map(([level, said]) => [level, `${said.means}${parts.some((part) => said[part]) ? `: ${parts.map((part) => said[part]).filter(Boolean).join(", ")}` : ""}`])));
/** The severity scale as the deck reviewer reads it: every level with its defects of argument and of the drawn page. */
export const SEVERITY_DEFINITIONS = severityText(["argument", "rendered"]);
/** The same scale as the storyline critic reads it: the levels and their defects of argument, in the reviewer's words. */
export const ARGUMENT_SEVERITIES = severityText(["argument"]);

// What a rating means, on one scale for both judges, so that "8, ready" at the
// spine and "8, accepted" on the deck are the same claim about the argument.
// `means` is what both judge; `rendered` what only the deck review can add.
// The caps are part of the scale: an open blocker or major bounds the number.
export const RATING_CAPS = Object.freeze({ blocker: 5, major: 7 });
const RATING_SCALE = Object.freeze([
  { at: "2 or less", means: "no argument: the question restated, or facts without an answer" },
  { at: String(RATING_CAPS.blocker), means: "understandable in parts, but weak proof", rendered: " or costly reading" },
  { at: String(RATING_CAPS.major), means: "useful and mostly supported, with substantial work still needed", rendered: ", editorial and design work included" },
  { at: String(ACCEPT_RATING), means: "the bar: nothing major open and the remaining weaknesses limited" },
  { at: "9", means: "strong argument and evidence, nothing a top team would add missing", rendered: ", effective visual explanation, coherent rhythm" },
  { at: "9.5+", means: "exceptional", rendered: " across the deck, its least effective page included" },
]);
/** The rating scale in a line, for a prompt: `rendered` adds what the deck reviewer judges on the drawn pages. */
// `capped: false` gives the scale without its caps: the storyline critic's rating is a second reading beside its items, not a sum of them.
export const ratingScale = ({ rendered = false, capped = true } = {}) => `${RATING_SCALE.map((anchor) => `${anchor.at} - ${anchor.means}${rendered ? anchor.rendered ?? "" : ""}`).join("; ")}${capped ? `. With a blocker open the rating is ${RATING_CAPS.blocker} or less; with a major open, ${RATING_CAPS.major} or less; ${ACCEPT_RATING} or more says nothing major is open` : ""}`;

/**
 * The deck review's rubric, clause by clause, and where each clause is first
 * decidable. A clause with a `spine` check is decidable from the spine packet
 * - the request, the answer, the titles in order, and each page's claim, type,
 * what settles it, the insights it rests on and the measures it shows - so the
 * storyline critic applies it under that check, in these words, before
 * anything is drawn (storyline.mjs STORYLINE_CHECKS). A clause with none needs
 * the rendered page. Both prompts print the clause from here: the reviewer in
 * its rubric, the critic under the check named, so `ready` at the spine means
 * what the reviewer will later hold the argument to.
 */
const clause = (text, spine = null) => Object.freeze({ text, spine });
export const RUBRIC_CLAUSES = Object.freeze({
  argument: { scope: "page", clauses: [clause("the title states the finding the page proves and the exhibit and commentary prove it", "claim"), clause("the claim goes no further than its evidence", "sourcing"), clause("the page's job in the argument is clear", "restatement")] },
  evidence: { scope: "page", clauses: [clause("members compared on the same measures, with n/a where one does not publish a measure - never a different metric per member", "shape"),
    clause("every number reproduced against its source and against the other pages that print it", "numbers"), clause("evidence deep enough for the claim (the whole peer set, the trend with its rate, not two numbers)", "shape"), clause("bases, units and periods compatible", "numbers")] },
  chart: { scope: "page", clauses: [clause("the chart form fits the comparison (ranking, trend, share, bridge, distribution)"), clause("honest axes - time spaced by time, bars from a zero baseline, scale and units stated"), clause("the subject highlighted and rivals muted"),
    clause("an annotation marks the finding (the gap, the break, the rate)"), clause("not a two-number chart")] },
  table: { scope: "page", clauses: [clause("verdict, score and status cells encoded (Harvey balls, ratings, pills, bars), not plain words"), clause("totals defined and filled"), clause("units in the headers"), clause("numbers right-aligned and rounded alike"), clause("row and column order meaningful")] },
  text: { scope: "page", clauses: [clause("density right for the reading task"), clause("the longest block readable"), clause("no sentence restating the title or the exhibit"), clause("jargon and acronyms explained"),
    clause("the action title commits to a finding in two lines or fewer", "claim"), clause("the subtitle adds scope, not a second title")] },
  layout: { scope: "page", clauses: [clause("no empty band"), clause("the exhibit dominates and the page is balanced"), clause("edges aligned"), clause("hierarchy reads title, exhibit, commentary"), clause("the frame is occupied, not a small figure in a large box")] },
  identity: { scope: "page", clauses: [clause("named companies, products and places carry their visual anchors where the reader needs recognition - logos, product images, maps"),
    // The build chooses a photograph by its metadata (fetch-pictures.mjs): only the rendered page shows whether it is the subject.
    clause("each photograph shows what its caption or the page names - that building, street or place, not a near miss or a generic stand-in"),
    clause("a player is introduced before it is compared", "flow")] },
  sourcing: { scope: "page", clauses: [clause("every number and claim has a source line a reader can look up, with its as-at date"), clause("footnotes define estimates, bases and exclusions")] },
  consistency: { scope: "deck", clauses: [clause("no construction repeated across a window of neighbouring pages"), clause("equal things styled alike"), clause("one term for one thing"), clause("one number format, unit and rounding per measure")] },
  rhythm: { scope: "deck", clauses: [clause("sections open, develop and close", "flow"), clause("page types vary with the reading task", "flow"), clause("the sequence builds rather than repeats", "spine"), clause("no page previews or re-proves another (the executive summary and the close restate the body by design)", "restatement")] },
  bookends: { scope: "deck", clauses: [clause("the executive summary states the answer and the pillars the body proves, with the numbers the body shows", "summary"), clause("the close states the decision, its conditions and the next step, and agrees with the summary", "summary")] },
});
/** The rubric's clauses the storyline critic applies under `check`, in the reviewer's words. */
export const spineClauses = (check) => Object.values(RUBRIC_CLAUSES).flatMap((dimension) => dimension.clauses).filter((item) => item.spine === check).map((item) => item.text);
/**
 * Where a rubric dimension is decidable: "spine" when every clause is, "page"
 * when none is, "both" when the spine decides some of it. The reviewer's codes
 * are classed beside their definitions (reviewer.mjs CODES_AT_SPINE).
 */
export const dimensionAt = (dimension) => { const at = (RUBRIC_CLAUSES[dimension]?.clauses || []).map((item) => Boolean(item.spine)); return at.length && at.every(Boolean) ? "spine" : at.some(Boolean) ? "both" : "page"; };

// Why a later pass may add a finding at all. Anything else is the loop reopening itself.
export const NEW_BASES = Object.freeze({
  changed: "on a page the rebuild changed (or beside a deleted page), read now for the first time in this form",
  regression: "a defect the rebuild introduced, on or caused by a changed page",
  missed: "a major or blocker the earlier passes missed on an unchanged page; `evidence` quotes it from the page and the justification says why it was not seen then",
});

export const BLOCKING = new Set(["major", "blocker"]);
const rank = (severity) => Math.max(0, SEVERITIES.indexOf(severity === "ok" ? "none" : severity));
export const worst = (list) => list.reduce((a, b) => (rank(b) > rank(a) ? b : a), "none");
export const verdictOf = (severity) => (severity === "none" ? "ok" : severity);


function hasCli(name) { return spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" }).status === 0; }


// `auto` runs a fresh reviewer through the host's own CLI first (claude inside
// Claude Code, codex inside Codex: the one known to be logged in), then the
// other CLI on the path, and writes a packet only when neither is installed. An
// agent session that reviews with its own fresh subagents asks for `packet`
// (the flag, or PS_REVIEWER=packet): a CLI being installed does not make it the
// reviewer.
export function detectBackend(preferred = "auto", { env = process.env, has = hasCli } = {}) {
  if (preferred !== "auto") return preferred;
  if (env.PS_REVIEWER) return env.PS_REVIEWER;
  const host = hostCli(env);
  const order = host === "claude" ? ["claude", "codex"] : ["codex", "claude"];
  return order.find((name) => has(name)) ?? "packet";
}

// A CLI that is installed but not signed in fails every call the same way; the
// loop falls back to a packet for the calling agent rather than crashing.
const AUTH_FAILURE = /not logged in|log ?in (?:first|required)|please (?:run )?\S*\s*login|unauthori[sz]ed|authenticat\w* (?:failed|required|error)|invalid api key|api key (?:is )?(?:missing|not set)|\b401\b/i;
export const isAuthFailure = (error) => AUTH_FAILURE.test(`${error?.message ?? ""}\n${error?.stderr ?? ""}\n${error?.stdout ?? ""}`);

// The reviewer models the evaluation rules name (references/evaluation/rules.json
// `reviewer`): the codex model and reasoning effort a review runs with unless
// the caller names another. The claude CLI keeps its own default.
const RULES = readJsonSync(new URL("../references/evaluation/rules.json", import.meta.url));
export const REVIEWER_CONFIG = Object.freeze({ ...(RULES.reviewer || {}) });
export function reviewerModel(which, model) {
  if (model) return model;
  return which === "codex" ? REVIEWER_CONFIG.defaultModel ?? null : null;
}

export const sha256 = (text) => createHash("sha256").update(String(text)).digest("hex");

/**
 * The user's request, verbatim: the yardstick both reviews judge against. The
 * authoring agent carries it unchanged from pages.json to deck.json; the
 * question and brief are the author's paraphrase and never stand in for it.
 */
export const requestOf = (spec) => (typeof spec?.request === "string" && textWords(spec.request) >= 3 ? spec.request : null);

// What the deck says about the request and the evidence, which both reviews
// are told and judge by. A request reconstructed from a brief is not the
// user's words, and a critic told it is "verbatim" holds the deck to wording
// nobody chose. An author confined to the records supplied cannot run an
// analysis that needs other data, and a critic not told so asks for it pass
// after pass. An answer the evidence cannot finish is said to be provisional,
// with what it leaves open, rather than dressed as final.
export const REQUEST_PROVENANCES = Object.freeze({
  verbatim: "the user's own words, unchanged",
  reconstructed: "rebuilt from a brief, a ticket or an earlier deck because the user's own words are not on record",
  paraphrased: "the author's restatement of what the user asked",
});
/** How the deck's `request` came to be: verbatim unless the deck says otherwise. */
export const requestProvenanceOf = (spec) => (Object.hasOwn(REQUEST_PROVENANCES, spec?.requestProvenance) ? spec.requestProvenance : "verbatim");
/** Whether the author may fetch evidence beyond what was supplied: `{ retrieval: "open" | "closed", note }`. */
export const evidenceScopeOf = (spec) => ({ retrieval: spec?.evidenceScope?.retrieval === "closed" ? "closed" : "open", note: typeof spec?.evidenceScope?.note === "string" ? spec.evidenceScope.note.trim() : "",
  ...(spec?.evidenceScope?.retrieval === "closed" && typeof spec.evidenceScope.quote === "string" ? { quote: spec.evidenceScope.quote.trim() } : {}),
  // Where the limit is written, on a deck whose `request` is not the user's own words (scopeSource).
  ...(spec?.evidenceScope?.retrieval === "closed" && scopeSource(spec) ? { source: scopeSource(spec) } : {}) });
/**
 * The file a closed evidence scope quotes its limit from, where the deck's
 * `request` is not the user's own words: `evidenceScope.source`, a path beside
 * the pages file. A verbatim request is its own source, and has none.
 */
function scopeSource(spec) {
  const source = spec?.evidenceScope?.source;
  return requestProvenanceOf(spec) !== "verbatim" && typeof source === "string" && source.trim() ? source.trim() : null;
}
/** Whether the deck offers its answer as final or as provisional, and what a provisional one leaves open. */
export const answerStatusOf = (spec) => ({ status: spec?.answerStatus === "provisional" ? "provisional" : "final", limits: Array.isArray(spec?.answerLimits) ? spec.answerLimits.filter((limit) => typeof limit === "string" && limit.trim()) : [] });
/**
 * What a critic or reviewer is told about the request, the evidence scope and
 * the answer's status, as the three parts of its prompt: `label` (how the
 * request is to be read as a yardstick), `scope` and `offered` (each "" when
 * there is nothing to say). `subject` is what is being judged: "storyline" or
 * "deck". One wording for both reviews, so they cannot be told different things.
 */
export function requestStatement(packet, subject) {
  const provenance = Object.hasOwn(REQUEST_PROVENANCES, packet?.requestProvenance) ? packet.requestProvenance : "verbatim";
  const label = provenance === "verbatim" ? null
    : `${provenance}: ${REQUEST_PROVENANCES[provenance]} - not the user's own words. It is the yardstick as far as it goes: judge the ${subject} against what it asks, do not hold it to the exact wording or to an answer the phrasing presumes, and say in the summary where it leaves the request open`;
  // Whose words close the scope is said with it: the request's own, or - where the request on record is not the user's own
  // words - those of the file the team holds, which the runtime found them in.
  const limit = !packet?.evidenceScope?.quote ? "" : packet.evidenceScope.source
    ? `; the request on record is ${provenance}, so the limit is quoted from the file that sets it (${packet.evidenceScope.source}, where the runtime found these words): "${packet.evidenceScope.quote}" - where they set no such limit the scope is open: say so, and mark nothing scope-limited`
    : `; the request is said to set the limit in these words: "${packet.evidenceScope.quote}" - where they set no such limit the scope is open: say so, and mark nothing scope-limited`;
  const scope = packet?.evidenceScope?.retrieval === "closed"
    ? `EVIDENCE SCOPE: closed - only the evidence supplied may be used${packet.evidenceScope.note ? ` (${packet.evidenceScope.note})` : ""}${limit}. An analysis that needs other data cannot be run. It keeps its severity - a decisive gap is still decisive - and is met only by an answer that claims less, or stays open under a provisional answer.`
    : "";
  const limits = packet?.answerStatus?.status === "provisional" ? packet.answerStatus.limits || [] : null;
  const offered = limits ? `THE ANSWER IS OFFERED AS PROVISIONAL. It says it leaves open: ${limits.map((limit) => `"${limit}"`).join("; ")}. Judge whether those are the decisive gaps, and whether everything else the evidence allows has been done.` : "";
  return { label, scope, offered };
}
// The request's hash covers what the reviews are told about it: a deck that
// says nothing of provenance or scope keeps the hash of its words alone.
export const requestHash = (spec) => {
  if (!requestOf(spec)) return null;
  const provenance = requestProvenanceOf(spec), scope = evidenceScopeOf(spec);
  return sha256(provenance === "verbatim" && scope.retrieval === "open" ? requestOf(spec) : JSON.stringify([requestOf(spec), provenance, scope]));
};

// The deck's own statements both reviews rest on: the user's request, word for
// word, and the build bars it says it is right to miss. Checked where the deck
// is written (author-deck) and again where it is judged (storyline, delivery),
// from this one definition.
export const DECK_STATEMENT_CODES = Object.freeze({
  REQUEST_MISSING: "a new deck carries no verbatim `request`, so the reviews would judge it against the author's paraphrase",
  WAIVERS_INVALID: "a build-bar waiver that names no build bar, names one twice, or gives no reason the reviewer can check",
  STATEMENT_INVALID: "what the deck says of its request, its evidence scope, its answer's status or its assets is not in the form the reviews read",
});
export function deckStatementFindings(deck) {
  const out = [];
  if (deck?.workflow === "new_deck" && !requestOf(deck)) out.push({ code: registered(DECK_STATEMENT_CODES, "REQUEST_MISSING"), severity: "blocker",
    repair: "A new deck records the user's request verbatim as `request` on `deck`: the storyline critic and the reviewers judge the deck against what was asked, not against the author's restatement of it" });
  const waivers = waiverErrors(deck?.waivers);
  if (waivers.length) out.push({ code: registered(DECK_STATEMENT_CODES, "WAIVERS_INVALID"), severity: "blocker", repair: waivers.join("; ") });
  const statements = [];
  if (deck?.requestProvenance !== undefined && !Object.hasOwn(REQUEST_PROVENANCES, deck.requestProvenance))
    statements.push(`\`requestProvenance\` is one of ${Object.entries(REQUEST_PROVENANCES).map(([key, about]) => `${key} (${about})`).join("; ")}`);
  const scope = deck?.evidenceScope;
  if (scope !== undefined && (!scope || typeof scope !== "object" || !["open", "closed"].includes(scope.retrieval) || (scope.retrieval === "closed" && textWords(scope.note) < 4)))
    statements.push("`evidenceScope` is { retrieval: \"open\" | \"closed\", note, quote }: closed when the author may use only the evidence supplied, with a `note` saying what was supplied and who set the limit");
  else if (scope?.retrieval === "closed") {
    // The limit is the user's to set, so it is shown in the user's words: the
    // author cannot close the scope on a request that does not say so.
    const flat = (text) => String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    // Whether the evidence is closed is a fact about the evidence, and how the request came to be recorded is another: a
    // request rebuilt from a brief can sit beside a limit the brief sets. What the quote protects is that the limit is the
    // user's and not the author's, so where the request on record is not the user's own words the limit is quoted from the
    // file that sets it - the brief, the ticket, the message - which the compile and the storyline loop then read
    // (scopeSourceErrors): a closure the author could only assert is still refused.
    if (requestProvenanceOf(deck) !== "verbatim") {
      if (textWords(scope.quote) < 4 || typeof scope.source !== "string" || !scope.source.trim())
        statements.push(`a closed \`evidenceScope\` on a request that is ${requestProvenanceOf(deck)} names, in \`source\`, the file that sets the limit - the brief, the ticket or the message, saved as text beside the pages file ("sources/brief.md") - and quotes its words in \`quote\` (four words or more, as they appear there): the request on record is not the user's own words, so the limit is shown where it was written. The scope is the user's to close, not the author's`);
    } else if (textWords(scope.quote) < 4 || !flat(requestOf(deck)).includes(flat(scope.quote)))
      statements.push("a closed `evidenceScope` quotes, in `quote`, the words of the `request` that set the limit (four words or more, as they appear there): the scope is the user's to close, not the author's");
  }
  if (deck?.answerStatus !== undefined && !["final", "provisional"].includes(deck.answerStatus)) statements.push("`answerStatus` is \"final\" or \"provisional\"");
  if (deck?.answerStatus === "provisional" && !answerStatusOf(deck).limits.some((limit) => textWords(limit) >= 4))
    statements.push("a provisional answer says what it leaves open in `answerLimits` - a sentence for each decisive thing the evidence in scope cannot settle");
  // Whether the deck is built without the network is a statement the reviewer is shown too (asset-needs.mjs).
  statements.push(...assetsDeclarationErrors(deck));
  if (statements.length) out.push({ code: registered(DECK_STATEMENT_CODES, "STATEMENT_INVALID"), severity: "blocker", repair: statements.join("; ") });
  return out;
}
/**
 * Why a closed scope's `source` does not show the limit, as sentences: the
 * file is not beside the deck (`baseDir`), or the words in `quote` are not in
 * it. Read wherever the deck's own folder is at hand - the compile, the
 * storyline loop - since the form alone (deckStatementFindings) cannot say
 * whether the file says what the deck says it does. Empty for a scope that
 * names no source: an open one, or one closed on a verbatim request.
 */
export async function scopeSourceErrors(deck, baseDir) {
  const scope = evidenceScopeOf(deck);
  if (scope.retrieval !== "closed" || !scope.source || !baseDir) return [];
  const flat = (text) => String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const file = path.resolve(baseDir, scope.source);
  if (path.relative(path.resolve(baseDir), file).startsWith("..")) return [`\`evidenceScope.source\` (${scope.source}) is a file beside the pages file, in the deck's own folder`];
  const text = await fs.readFile(file, "utf8").catch(() => null);
  if (text === null) return [`\`evidenceScope.source\` names ${scope.source}, which is not a file beside the pages file: save the brief, the ticket or the message that sets the limit there as text, so the limit can be read where it was written`];
  return flat(text).includes(flat(scope.quote)) ? [] : [`the words in \`evidenceScope.quote\` are not in ${scope.source}: quote the limit as that file states it (four words or more), or leave the scope open - the scope is the user's to close, not the author's`];
}
/** Why a deck cannot be reviewed without its request: a new deck must carry it, and what it says of it must be in form. */
export const requestErrors = (spec) => deckStatementFindings({ workflow: spec?.workflow, request: spec?.request, requestProvenance: spec?.requestProvenance, evidenceScope: spec?.evidenceScope,
  answerStatus: spec?.answerStatus, answerLimits: spec?.answerLimits }).map((f) => f.repair);

export const REVISION = "existing_deck_revision";
/** A revision's inventory of the deck it was imported from (runtime/import-deck.py), beside the deck file; null for new work. */
export async function readInventory(spec, deckPath) {
  if (spec?.workflow !== REVISION || typeof spec.inventory !== "string" || !deckPath) return null;
  return readJson(path.resolve(path.dirname(deckPath), spec.inventory), { optional: true });
}

const normalTitle = (text) => String(text ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").replace(/^[\s\W]+|[\s\W]+$/g, "");

// A revision page against the slide it was imported from, in two halves: what
// it says (sameContent) and how it is drawn (sameDrawing). The inventory
// records a source slide's words and numbers, its tables, its charts and their
// type, and its pictures - not a page type or a layout, which a revision gives
// every page. So a page draws as its slide did only when it draws the same
// evidence (a table as a table, a column chart as a column chart, text as
// text), the same pictures, and nothing the inventory cannot vouch for: a part
// of the rebuild's own (cards, tiles, a hero number) or a drawing setting.
//
// Identity and authoring notes: never drawn, never copy.
const INERT = new Set(["id", "pageType", "sourceSlide", "sourceSlideId", "alt"]);
// Set by the build from the page's type, form and commentary (page-types.mjs
// OWNED); a page type that draws other evidence shows in what the page draws.
const BUILT = new Set(["layout", "arrange", "shape", "kind", "soWhat"]);
// How a part is drawn, which no source slide records: present at all, a change.
const SETTINGS = new Set(["icon", "style", "frame", "crop", "variant", "treatment"]);
// A picture, by its file: `path` anywhere, or `image` and `photo` given as a path.
const PICTURES = new Set(["path", "image", "photo"]);
// The page's parts that show pictures: compared by file.
const PICTURE_PARTS = new Set(["pictures", "image", "photo"]);
// The page's parts that set copy as text: compared as copy. Every other part
// draws evidence - an exhibit by its kind, `rows` as a table, and the rest
// (tiles, a hero number, labelled rows) as parts no source slide had.
const TEXT = new Set(["points", "paragraphs", "panel", "items", "summary", "highlight", "columns"]);
// Every string and number a page holds that a reader reads as copy: not its
// identity, not a value that names how something is drawn (an exhibit's
// `type`, a setting), not its source line or emphasis, not a picture's file.
const QUIET = new Set([...INERT, "layout", "arrange", "shape", "kind", "type", "source", "highlight", ...SETTINGS, "path"]);
function said(value, out = []) {
  if (typeof value === "string" || typeof value === "number") out.push(String(value));
  else if (Array.isArray(value)) for (const v of value) said(v, out);
  else if (value && typeof value === "object") for (const [key, v] of Object.entries(value)) if (!QUIET.has(key) && !(PICTURES.has(key) && typeof v === "string")) said(v, out);
  return out;
}
const wordsOf = (texts) => new Set(texts.join(" ").toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []);
const numbersOf = (texts) => (texts.join(" ").match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, "")).sort().join(" ");
function sameContent(slide, source) {
  const page = said({ ...slide, title: undefined });
  // A source table says its cells and a chart its title, categories and series: not their sizes or type.
  // The deck's own furniture - a footer repeated on its slides, the page number - is no part of what the slide says.
  const before = said({ subtitle: source.subtitle, paragraphs: (source.paragraphs || []).filter((p) => !["furniture", "page-number"].includes(p.role)).map((p) => p.text), tables: (source.tables || []).map((t) => t?.cells),
    charts: (source.charts || []).map((c) => ({ title: c?.title, categories: c?.categories, series: c?.series })) });
  const [a, b] = [wordsOf(page), wordsOf(before)];
  const shared = [...a].filter((w) => b.has(w)).length;
  const jaccard = a.size || b.size ? shared / (a.size + b.size - shared) : 1;
  return jaccard >= 0.8 && numbersOf(page) === numbersOf(before);
}

// Every number a value holds, as a reader compares them: "1,311.8" is 1311.8, and 41 is 41.0.
const eachNumber = (texts) => (texts.join(" ").match(/\d+(?:[.,]\d+)*/g) || []).map((n) => Number(n.replace(/,/g, ""))).filter(Number.isFinite);
/**
 * Is the evidence a composed page shows evidence its source slide held: every
 * number its evidence parts draw - its exhibits, tiles, rows; not its copy -
 * is a number the slide printed or plotted. A slide that held nothing but its
 * title gave the page no evidence and no argument: a page with a body of its
 * own is not that slide's.
 */
function sameEvidence(slide, source) {
  const held = new Set(eachNumber(said({ paragraphs: (source.paragraphs || []).map((p) => p.text), tables: (source.tables || []).map((t) => t?.cells), charts: (source.charts || []).map((c) => ({ categories: c?.categories, series: c?.series })) })));
  const evidence = Object.entries(slide).filter(([key, value]) => value && typeof value === "object" && !INERT.has(key) && !BUILT.has(key) && !TEXT.has(key) && !PICTURE_PARTS.has(key)).map(([, value]) => value);
  const bare = !(source.paragraphs || []).some((p) => !["furniture", "page-number"].includes(p.role)) && !(source.tables || []).length && !(source.charts || []).length && !(source.pictures || []).length;
  return eachNumber(said(evidence)).every((n) => held.has(n)) && !(bare && said({ ...slide, title: undefined }).length > 0);
}

// A chart's kind as the inventory names it (python-pptx's chart type) and as a
// page names it (`chart.<kind>`). A type with no counterpart keeps its own
// name, so it never matches and the page is read.
function sourceChartKind(type) {
  const name = String(type ?? "").toUpperCase();
  const stacked = /STACKED/.test(name) ? "stacked-" : "";
  const kinds = [[/^BAR_/, `${stacked}bar`], [/^COLUMN_/, `${stacked}column`], [/^LINE/, "line"], [/^PIE/, "pie"], [/^DOUGHNUT/, "donut"], [/^AREA/, `${stacked}area`], [/^(?:XY_SCATTER|BUBBLE)/, "scatter"], [/^RADAR/, "radar"]];
  return kinds.find(([pattern]) => pattern.test(name))?.[1] ?? `pptx:${name}`;
}
/** The evidence a source slide drew, by kind: a table for each of its tables, and each chart by its kind as a page names it without `chart.`. */
export const sourceEvidence = (source) => [...(source?.tables || []).map(() => "table"), ...(source?.charts || []).map((c) => sourceChartKind(c?.type))];
const exhibitKind = (exhibit) => { const type = String(exhibit?.type ?? "exhibit"); return type.startsWith("chart.") ? type.slice("chart.".length) : type; };
const fileName = (file) => String(file ?? "").split(/[\\/]/).pop();
const sameList = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** How a page is drawn: the evidence it draws by kind, its pictures by file, and the drawing settings it carries. */
function drawingOf(slide) {
  const evidence = [], pictures = [], settings = [];
  for (const [key, value] of Object.entries(slide)) {
    if (!value || typeof value !== "object" || INERT.has(key) || BUILT.has(key) || TEXT.has(key) || PICTURE_PARTS.has(key)) continue;
    if (key === "exhibit" || key === "exhibits") evidence.push(...[value].flat().filter((e) => e && typeof e === "object").map(exhibitKind));
    else evidence.push(key === "rows" ? "table" : key);
  }
  const walk = (value, top) => {
    if (Array.isArray(value)) { for (const v of value) walk(v, false); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (INERT.has(key) || (top && BUILT.has(key))) continue;
      if (SETTINGS.has(key)) settings.push(key);
      if (PICTURES.has(key) && typeof v === "string") pictures.push(fileName(v));
      else walk(v, false);
    }
  };
  walk(slide, true);
  return { evidence, pictures, settings };
}
function sameDrawing(slide, source) {
  const page = drawingOf(slide);
  return !page.settings.length && sameList(page.evidence, sourceEvidence(source)) && sameList(page.pictures, (source.pictures || []).map((p) => fileName(p?.file)));
}

/**
 * What a revision changed, against the deck it was imported from: `spine`,
 * the pages whose title changed, that are new or moved, that sit beside a
 * cut slide, or that the runtime composed to show evidence their slide did
 * not hold (sameEvidence) - what the storyline critique reads; `copy`, those
 * plus the pages whose words or numbers changed; `drawn`, the pages drawn other than their
 * slide was (sameDrawing); and `content`, every page in `copy` or `drawn` -
 * what the deck review's first pass reads. A revision whose spine is
 * unchanged needs no storyline critique; one whose copy is unchanged is a
 * `restyle`, and the deck review reads every page. Null for new work.
 *
 * A revision that carries slides from its source deck (`carried` on the
 * spec, revision.mjs) is read slide by slide: a carried slide is unchanged
 * unless the revision edited it - a new title changes the spine, replaced
 * words the copy - and every page the runtime composes is drawn anew beside
 * the user's own slides, so the review reads each of them. `pages` then
 * lists the carried slides in their places among the composed pages,
 * `carried` the slides copied untouched, and it is never a restyle.
 *
 * A page composed where a slide stood is compared with what the inventory
 * holds of that slide, and the inventory holds text, table objects and chart
 * objects. A slide that draws its exhibit as shapes - as a deck this runtime
 * built does - leaves nothing to compare the page's numbers with, so the
 * page is read as changed whether the revision changed it or not: `unheld`
 * lists the changed pages whose slide the inventory says it does not hold
 * whole (`unheld` on the slide), for the run to say so (unheldLine). Carrying
 * such a slide is what keeps it unchanged.
 */
export function revisionChanges(spec, inventory) {
  if (spec?.workflow !== REVISION || !Array.isArray(inventory?.slides)) return null;
  const bySource = new Map(inventory.slides.map((s) => [s.index, s]));
  const typed = [...(spec.slides || []), ...(spec.appendix || [])].filter((s) => s?.pageType);
  const carries = Array.isArray(spec.carried) && spec.carried.length > 0;
  // Every page that stands for a slide or adds one, in deck order: the composed pages, and the carried slides among them.
  const pages = carries ? withCarriedPages(spec, typed, (entry) => ({ id: entry.id, carried: entry })) : typed;
  const sourceOf = (s) => (s.carried ? s.carried.sourceSlide : s.pageType.sourceSlide ?? s.sourceSlide);
  const spine = new Set(), copy = new Set(), drawn = new Set(), used = new Set(), untouched = [], partial = new Set();
  let furthest = 0;
  for (const s of pages) {
    const from = sourceOf(s);
    const source = bySource.get(from);
    if (!source) { spine.add(s.id); copy.add(s.id); if (carries) drawn.add(s.id); continue; }
    used.add(from);
    const moved = from < furthest;
    furthest = Math.max(furthest, from);
    if (s.carried) {
      const changes = carriedChanges(s.carried, source);
      // The title as the revision leaves it, whichever key wrote it: a title rewritten through `replace` is a title change.
      if (changes.retitled !== undefined || moved) spine.add(s.id);
      if (spine.has(s.id) || changes.edits) copy.add(s.id);
      if (!copy.has(s.id)) untouched.push(s.id);
      continue;
    }
    if (source.unheld) partial.add(s.id);
    // The critique is bound to a page's title and to what it shows as evidence. So a page the runtime composed keeps its slide's
    // spine where both are the slide's: the same title, over evidence every number of which the slide already held (sameEvidence).
    // A title in common with a source slide keeps nothing from being read by itself - a page that shows other figures under it,
    // or gives a body to a slide that held only its title, is the revision's own argument. Reworded copy is the review's to read.
    if (normalTitle(s.title ?? s.text) !== normalTitle(source.title) || moved || !sameEvidence(s, source)) spine.add(s.id);
    if (spine.has(s.id) || !sameContent(s, source)) copy.add(s.id);
    if (carries || !sameDrawing(s, source)) drawn.add(s.id);
  }
  for (const s of [...(spec.slides || []), ...(spec.appendix || [])]) if (s?.sourceSlide !== undefined) used.add(s.sourceSlide);
  // A source slide with body content that no page carries was cut: the pages either side of the gap changed with it.
  const dropped = inventory.slides.filter((s) => !used.has(s.index) && !s.hidden && ((s.paragraphs || []).length || (s.tables || []).length || (s.charts || []).length)
    && !(s.index === 1 && spec.cover)).map((s) => s.index);
  for (const index of dropped) {
    const before = pages.filter((s) => (sourceOf(s) ?? Infinity) < index).at(-1);
    const after = pages.find((s) => (sourceOf(s) ?? -Infinity) > index);
    for (const s of [before, after]) if (s) { spine.add(s.id); copy.add(s.id); }
  }
  const ids = pages.map((s) => s.id);
  return { spine: ids.filter((id) => spine.has(id)), copy: ids.filter((id) => copy.has(id)), drawn: ids.filter((id) => drawn.has(id)),
    content: ids.filter((id) => copy.has(id) || drawn.has(id)), restyle: copy.size === 0 && !carries, dropped, pages: ids, spineChanged: spine.size > 0 || dropped.length > 0,
    unheld: ids.filter((id) => partial.has(id) && (copy.has(id) || drawn.has(id))),
    ...(carries ? { carried: untouched.filter((id) => !copy.has(id)) } : {}) };
}

/**
 * Why a revision's pages are read as changed where the reason is the
 * inventory and not the revision, in a sentence; null where there is nothing
 * to say. Said by every run of a revision that composes such a page, so a
 * rebuild of a deck whose exhibits are drawn shapes is not silently read as
 * changed on every page.
 */
export function unheldLine(changes) {
  const pages = changes?.unheld ?? [];
  if (!pages.length) return null;
  const all = pages.length === changes.pages.length;
  const which = !all ? `${pages.length} of the ${changes.pages.length} pages` : pages.length === 1 ? "the one page" : `every one of the ${pages.length} pages`;
  return `Read as changed: ${which} this revision composes${pages.length <= 12 ? ` (${pages.join(", ")})` : ""}, each where a slide stood that the inventory does not hold whole - drawn shapes it cannot read as a chart or a table, which is how a deck this runtime built draws its exhibits. `
    + "Such a page cannot be set beside its slide number for number, and is read as changed whether or not the revision changed it: the stale-number check, the fill guidance and the deck review all read it. "
    + "A slide the revision does not change is kept as it is, and read as unchanged, by carrying it: `carry: true` beside its `draft`.";
}

/**
 * Keys a schema with `additionalProperties: false` does not name, at every
 * level: a review or critique carries what its schema asks for and nothing
 * else (an `authorResponse` rebutting the reviewer is not part of a review).
 */
export function unknownKeyErrors(value, schema, at) {
  if (!schema || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return schema.items ? value.flatMap((item, i) => unknownKeyErrors(item, schema.items, `${at}[${i}]`)) : [];
  const errors = [];
  const properties = schema.properties || {};
  if (schema.additionalProperties === false) {
    const extra = Object.keys(value).filter((key) => !(key in properties));
    if (extra.length) errors.push(`${at} carries ${extra.map((k) => `\`${k}\``).join(", ")}, which the schema does not allow: return exactly the schema's fields`);
  }
  for (const [key, sub] of Object.entries(properties)) if (value[key] !== undefined) errors.push(...unknownKeyErrors(value[key], sub, `${at}.${key}`));
  return errors;
}

/**
 * Who wrote an answer: the backend (a CLI the loop ran, or the calling agent's
 * subagent), the model, and the hash of the prompt it answered, echoed from the
 * packet. An answer that does not echo the packet's hash answers no packet the
 * loop wrote.
 */
export const PROVENANCE_BACKENDS = Object.freeze(["codex", "claude", "subagent"]);
export const PROVENANCE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["backend", "model", "promptHash"],
  properties: { backend: { type: "string", enum: PROVENANCE_BACKENDS }, model: { type: "string", minLength: 2 }, promptHash: { type: "string", pattern: "^[a-f0-9]{64}$" } },
};
export function provenanceErrors(answer, promptHash) {
  const p = answer?.provenance;
  if (!p || typeof p !== "object") return ["provenance is missing: an answer says { backend, model, promptHash } - the promptHash printed at the end of the prompt it answered"];
  const errors = [];
  if (!PROVENANCE_BACKENDS.includes(p.backend)) errors.push(`provenance.backend must be one of ${PROVENANCE_BACKENDS.join(", ")}`);
  if (typeof p.model !== "string" || p.model.trim().length < 2) errors.push("provenance.model must name the model that wrote the answer");
  if (!promptHash) errors.push("no packet was written for this answer: request the review through the loop, which writes the packet and its prompt hash");
  else if (p.promptHash !== promptHash) errors.push("provenance.promptHash does not match the packet's prompt: the answer was written for another prompt");
  return errors;
}
/** The closing line of every prompt: the hash the answer echoes, over the prompt text above it. */
export const provenanceLine = (hash, backend = "subagent") => `\n\nPROVENANCE. Set \`provenance\` to { "backend": "${backend}", "model": "<the model id you are running as>", "promptHash": "${hash}" }.`;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// An id spelt as an ordinary word (`cover`, `summary`, `close`) is also a word
// a sentence uses: "the cover ratio" names no page. Such an id counts as
// named only where it is written as an id - in brackets, backticks or quotes,
// as the prompts print it ("[cover]") - so a reviewer is not refused for a
// page it never mentioned.
const WORDLIKE = /^[A-Za-z]+$/;
const marked = (text, hit) => /[[`'"]/.test(text[hit.at - 1] ?? "") && /[\]`'"]/.test(text[hit.end] ?? "");

/**
 * Every page a sentence names, by id or by position ("page 12", "slides
 * 3-5"), with ranges ("p16-p19", "p16 to p19") expanded in deck order. It is
 * how validation holds a deck-level finding to the pages its own reason names.
 */
export function pageRefs(text, ids, { positions = true } = {}) {
  const found = new Set();
  if (!text || !ids?.length) return found;
  const order = new Map(ids.map((id, i) => [id, i]));
  const token = new RegExp(`(?<![\\w])(${[...ids].sort((a, b) => b.length - a.length).map(escape).join("|")})(?!\\w)`, "g");
  const hits = [...String(text).matchAll(token)].map((m) => ({ id: m[1], at: m.index, end: m.index + m[0].length })).filter((hit) => !WORDLIKE.test(hit.id) || marked(String(text), hit));
  hits.forEach((hit, i) => {
    found.add(hit.id);
    const next = hits[i + 1];
    if (next && /^\s*(?:-|–|—|to|through)\s*$/i.test(String(text).slice(hit.end, next.at))) {
      const [a, b] = [order.get(hit.id), order.get(next.id)].sort((x, y) => x - y);
      for (let k = a; k <= b; k += 1) found.add(ids[k]);
    }
  });
  // A page named by its position is read only where the reader was shown positions to name pages by (`positions`): a
  // listing that prints every page's id is answered by id, and "page 12" of it is not the twelfth page's id.
  if (positions) for (const m of String(text).matchAll(/\b(?:pages?|slides?)\s+(\d+)(?:\s*(?:-|–|to)\s*(\d+))?/gi)) {
    const from = Number(m[1]), to = Number(m[2] ?? m[1]);
    for (let n = Math.min(from, to); n <= Math.max(from, to); n += 1) if (ids[n - 1]) found.add(ids[n - 1]);
  }
  return found;
}

/**
 * A page list as its writer meant it, where that can be read without judging
 * anything: `{ pages, mended }`. An entry that is a range of two known ids
 * ("p16-p19", "p16 to p19") is expanded in deck order over `spanned` (the pages
 * a range runs over: a section's divider between two content pages is not one
 * of them, unless it is an end of the range); and where `text` is given, every
 * page it names by id that the list leaves out is added. `mended` says each
 * thing done - `{ did: "range", from, pages }`, `{ did: "named", pages }` -
 * so the caller can record that the runtime, not the writer, wrote those ids.
 */
export function settlePageList(pages, ids, { text = null, spanned = ids } = {}) {
  if (!Array.isArray(pages)) return { pages, mended: [] };
  const known = new Set(ids), order = new Map(ids.map((id, i) => [id, i])), runs = new Set(spanned), mended = [];
  const expand = (entry) => {
    if (typeof entry !== "string" || known.has(entry)) return null;
    // An id may hold a hyphen of its own: the range is the split whose two halves are both pages.
    for (const m of entry.matchAll(/\s*(?:-|–|—|\bto\b|\bthrough\b)\s*/gi)) {
      const a = entry.slice(0, m.index).trim(), b = entry.slice(m.index + m[0].length).trim();
      if (known.has(a) && known.has(b)) { const [lo, hi] = [order.get(a), order.get(b)].sort((x, y) => x - y); return ids.slice(lo, hi + 1).filter((id) => runs.has(id) || id === a || id === b); }
    }
    return null;
  };
  let out = [];
  for (const entry of pages) { const span = expand(entry); if (span) { mended.push({ did: "range", from: entry, pages: span }); out.push(...span); } else out.push(entry); }
  if (mended.length) out = [...new Set(out)];
  if (text !== null && out.length) {
    const named = [...pageRefs(text, ids, { positions: false })].filter((id) => !out.includes(id));
    if (named.length) { mended.push({ did: "named", pages: named }); out = [...out, ...named].sort((a, b) => (order.get(a) ?? ids.length) - (order.get(b) ?? ids.length)); }
  }
  return { pages: mended.length ? out : pages, mended };
}

// A list of pages given by example: "e.g. p11, p16", "such as pages 4 and 9",
// "p3, p8 etc." The reviewer is asked for every affected page, so a sample is
// refused rather than read as the whole list.
const SAMPLING_BEFORE = /\b(?:e\.\s?g\.?|eg\.|for example|for instance|such as|including|notably|among them)/gi;
const SAMPLING_AFTER = /^[\s,;)]*(?:etc\.?|and others|among others|and more|and so on|\.\.\.|…)/i;
/** The words the two patterns above look for, as a prompt lists them: before a page id, and after one. */
export const SAMPLING_WORDS = Object.freeze({ before: ["e.g.", "for example", "for instance", "such as", "including", "notably", "among them"], after: ["etc.", "and others", "among others", "and more", "and so on", "..."] });
export function samplingProblem(text, ids, pages = null) {
  const source = String(text ?? "");
  for (const m of source.matchAll(SAMPLING_BEFORE)) {
    const window = source.slice(m.index, m.index + m[0].length + 60), examples = pageRefs(window, ids);
    // Pages named as examples beside a list that holds more than them are examples of a complete list, not the list.
    const exampled = (id) => examples.has(id) || new RegExp(`(?<![\\w-])${escape(id)}(?![\\w-])`).test(window);
    if (examples.size && !(Array.isArray(pages) && pages.some((id) => !exampled(id)))) return `lists pages by example ("${m[0]} ..."): name every affected page`;
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
export function pageListErrors(at, { scope, pages, text, ids, deckScope = "deck", named: holdNamed = true }) {
  const errors = [];
  if (!Array.isArray(pages) || !pages.length) return [`${at}: list the affected pages (${scope === deckScope ? "every one of them" : "the page"})`];
  const known = new Set(ids);
  const unknown = pages.filter((id) => !known.has(id));
  if (unknown.length) errors.push(`${at}: unknown page${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`);
  if (new Set(pages).size !== pages.length) errors.push(`${at}: a page is listed twice`);
  if (scope === "page" && pages.length !== 1) errors.push(`${at}: a page finding names one page; a defect on several pages is a ${deckScope} finding with every page listed`);
  const sampled = samplingProblem(text, ids, pages);
  if (sampled) errors.push(`${at}: ${sampled}`);
  // A caller that settles its page lists first (settlePageList) has already added the pages the text names: `named: false`.
  if (scope === deckScope && holdNamed) {
    const named = [...pageRefs(text, ids)].filter((id) => !pages.includes(id));
    if (named.length) errors.push(`${at}: the text names ${named.join(", ")}, which the finding's page list leaves out - list every affected page`);
  }
  return errors;
}

/**
 * Whether a status may set an entry's severity. A regression may raise it. A
 * lower severity is the reviewer's opinion that a finding is now smaller, and
 * opinion alone would walk a deck to acceptance pass by pass: only a partly
 * fixed deck finding whose deterministic measure now passes
 * (`downgrade(entry)`, supplied by the loop that can measure) may drop.
 */
export function severityChange(entry, status, downgrade = () => false) {
  if (!status?.severity || !SEVERITIES.includes(status.severity) || status.severity === entry.severity) return null;
  if (rank(status.severity) > rank(entry.severity)) return status.status === "regressed" ? status.severity : null;
  return status.status === "partly fixed" && downgrade(entry) ? status.severity : null;
}

// The open finding a later pass's new finding restates: the same code on a
// page the open one already names. A reviewer verifying one item at a time
// files the defect it still sees without looking up which open item it is, so
// the two are one finding and are folded into one (advanceLedger) rather than
// counted twice or refused.
// A finding about the imported deck and one about the revision's own pages are two findings, whatever they share: folded
// together, a blocker would take the other's flag and stop blocking.
const restated = (open, item) => open.find((e) => e.code === item.code && Boolean(e.aboutImported) === Boolean(item.aboutImported) && (e.pages || []).some((id) => (item.pages || []).includes(id))) ?? null;
const sharedPages = (entry, item) => (item.pages || []).filter((id) => (entry.pages || []).includes(id));

/**
 * Every statement an entry holds: its own, and each one a later pass folded
 * into it (advanceLedger), with the pass it was made in. A fold keeps the
 * entry's first reason, so the folded statements are part of what the entry
 * says wherever it is shown, and of what a status that closes it must answer.
 */
export const statementsOf = (entry) => [{ id: entry.id, pass: entry.raisedIn ?? 1, text: `${entry.reason ?? ""}${entry.repair ? ` → ${entry.repair}` : ""}` },
  ...(entry.folded || []).map((f) => ({ id: f.id, pass: f.pass, severity: f.severity, pages: f.pages || [], text: f.reason }))];
const alsoLine = (f) => `also, from pass ${f.pass} (filed as ${f.id}, ${f.severity}${(f.pages || []).length ? `, on ${f.pages.join(", ")}` : ""}): ${f.text}`;
/** An entry's reason and repair in one line, with every statement folded into it: what a report or a refusal prints. */
export const reasonOf = (entry) => statementsOf(entry).map((f, i) => (i === 0 ? entry.reason ?? "" : alsoLine(f))).join(" | ");
/** The same for a verification prompt: the entry's own statement, then each folded one on its own line beneath it, which the status must answer. */
export const itemLines = (entry) => { const [own, ...folded] = statementsOf(entry); return [own.text, ...folded.map((f) => `    ${alsoLine(f)}`)].join("\n"); };
// The statuses that say an item moved: a closing one, or "partly fixed".
const MOVED = new Set([...CLOSED, "partly fixed"]);
// What an answer to one statement has to be. A status that closes an item
// holding several statements answers each; an answer checked for length alone
// could be the same filler under every one ("n/a n/a n/a n/a n/a n/a"). So an
// answer is evidence about its own statement: it says something (three
// distinct content words or more), in words of its own (not the statement's
// text, or a part of it, given back), that no other answer of the status
// gives, and it is about that statement - it uses one of the statement's
// content words, or names a page the statement is on or the artifact the
// status says changed.
const ANSWER_CHARS_MIN = 20, ANSWER_WORDS_MIN = 3;
const plain = (text) => String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const namesId = (text, id) => { const at = plain(text).split(" "); const want = plain(id).split(" "); return want.length > 0 && want[0] !== "" && at.some((_, i) => want.every((word, k) => at[i + k] === word)); };
/** Why `answer` does not answer `statement` of `entry` (statementsOf), in words; null where it does. */
function answerFault(answer, statement, entry, status) {
  if (!answer || typeof answer.evidence !== "string" || answer.evidence.trim().length < ANSWER_CHARS_MIN) return `has no answer of ${ANSWER_CHARS_MIN} characters or more`;
  const evidence = plain(answer.evidence), words = contentWords(answer.evidence);
  if (words.size < ANSWER_WORDS_MIN) return "is answered with filler: an answer says what you saw, in three words of substance or more";
  if ((status.answers || []).some((other) => other !== answer && plain(other?.evidence) === evidence)) return "is given the same answer as another statement: each is answered for itself";
  if (plain(statement.text).includes(evidence)) return "is answered with its own words: say what the page or the spine shows now, not what the statement said";
  const about = [...contentWords(statement.text)].some((word) => words.has(word))
    || [...(statement.pages ?? entry.pages ?? []), ...(entry.pages || []), status.artifact].filter((id) => typeof id === "string" && id.trim()).some((id) => namesId(answer.evidence, id));
  return about ? null : "is answered without a word of what it says: use the statement's own terms, or name the page or artifact that changed";
}
/** The statements of an entry a status leaves unanswered, each `{ id, why }`: every one of them, the entry's own included, needs its `answers` entry once another is folded in. */
const unanswered = (entry, status) => ((entry.folded || []).length && MOVED.has(status?.status)
  ? statementsOf(entry).map((f) => ({ id: f.id, why: answerFault((status.answers || []).find((a) => a?.statement === f.id), f, entry, status) })).filter((f) => f.why) : []);
/** What a prompt tells a verifier about items that hold several statements. */
export const ANSWERS_RULE = 'An item with lines beginning "also" beneath it holds every one of those statements: an earlier pass filed them as new and they were folded into it. Call it fixed, partly fixed or otherwise closed only with `answers`: one { statement, evidence } for the item\'s own id and for each id an "also" line names, saying what you saw for that statement. Each answer is its own: it differs from the others and from the statement it answers, says something (three words of substance or more), and uses a term of its statement or names the page or artifact that changed. It is fixed only when every statement is; validation refuses a status that answers the first statement alone, or answers them with filler.';
/** The schema of a status's `answers`, for the loops' status schemas. */
export const ANSWERS_SCHEMA = { type: "array", items: { type: "object", additionalProperties: false, required: ["statement", "evidence"], properties: { statement: { type: "string" }, evidence: { type: "string", minLength: ANSWER_CHARS_MIN } } } };

/**
 * The ledger: every finding any pass raised, with its latest status and
 * severity. Pass one opens it; each later pass applies its statuses and appends
 * its new findings. `items` is the review's findings in ledger form
 * ({ id, code, severity, pages, reason, repair }).
 *
 * A new finding that restates an open one (`restated`) is folded into it, not
 * appended: the open entry stays open - "not fixed" with the new finding's
 * text as its evidence where the pass gave it no status - names the new
 * finding's pages as well, and records the fold in `folded`. Its severity is
 * the worst of what it was before the pass, what the pass made it and what
 * the new finding says: a fold never lowers one. Nor does it lose what the
 * new finding said: the entry holds that statement from then on
 * (statementsOf), every later packet prints it under the entry, and a status
 * that closes the entry without answering it leaves the entry open.
 * `automatic(entry)` marks the entries a pass gives a status by other means,
 * which nothing folds into.
 */
export function advanceLedger(prior, review, items, { downgrade = () => false, automatic = () => false } = {}) {
  const pass = review?.pass ?? 1;
  const ledger = (prior || []).map((entry) => ({ ...entry }));
  const byId = new Map(ledger.map((entry) => [entry.id, entry]));
  const open = openEntries(prior).filter((e) => !automatic(e)).map((e) => ({ ...e }));
  const judged = new Set((review?.statuses || []).map((s) => s?.finding));
  for (const s of review?.statuses || []) {
    const entry = byId.get(s.finding);
    if (!entry) continue;
    const severity = severityChange(entry, s, downgrade);
    // The validator refuses a status that moves an item without answering each statement folded into it; here such an item stays where it was.
    const silent = unanswered(entry, s);
    entry.status = silent.length ? "not fixed" : s.status;
    if (severity) entry.severity = severity;
    const pages = s.pages ?? s.slides;
    if (Array.isArray(pages) && pages.length) entry.pages = pages;
    entry.evidence = silent.length ? `${s.evidence ?? ""} [kept open: the status says ${s.status} and answers no statement ${silent.map((f) => f.id).join(", ")}]`.trim() : s.evidence ?? null;
    if (Array.isArray(s.answers) && !silent.length) entry.answers = s.answers;
    if (s.searchLog) entry.searchLog = s.searchLog;
    entry.updatedIn = pass;
  }
  for (const item of items || []) {
    if (byId.has(item.id)) continue;
    const was = restated(open, item);
    if (was) {
      const kept = byId.get(was.id);
      const said = `${item.reason ?? ""}${item.repair ? ` → ${item.repair}` : ""}`.trim();
      // A closing status beside a finding that restates the item is a contradiction the validator refuses; here the item stays open.
      if (!judged.has(was.id) || CLOSED.includes(kept.status)) Object.assign(kept, { status: "not fixed", evidence: said });
      // What the folded finding's repair touches is the entry's too: a pass scoped by what repairs touch must not lose it.
      Object.assign(kept, { severity: worst([was.severity, kept.severity, item.severity]), pages: [...new Set([...(kept.pages || []), ...(item.pages || [])])],
        ...(item.touches || kept.touches ? { touches: [...new Set([...(kept.touches || []), ...(item.touches || [])])] } : {}),
        // And a title it proposes is the one the author is shown for that page now.
        ...(item.retitle ? { retitle: [...(kept.retitle || []).filter((entry) => !item.retitle.some((fresh) => fresh.page === entry.page)), ...item.retitle] } : {}),
        folded: [...(kept.folded || []), { id: item.id, pass, severity: item.severity, pages: item.pages || [], reason: said }], updatedIn: pass });
      continue;
    }
    const entry = { ...item, status: "open", raisedIn: pass, updatedIn: pass };
    ledger.push(entry);
    byId.set(item.id, entry);
  }
  return ledger;
}

export const openEntries = (ledger) => (ledger || []).filter((e) => !CLOSED.includes(e.status) && e.severity !== "none");
export const openBlocking = (ledger) => openEntries(ledger).filter((e) => BLOCKING.has(e.severity) && !e.aboutImported);
/**
 * The open items that are about the imported deck (`aboutImported` on a
 * critique's or a review's finding): a problem whose remedy is to change a
 * slide of the user's own that the revision did not change and the user did
 * not ask to change. They keep their severity and block nothing - the author
 * may not edit that slide unasked - and each is reported to the user with
 * the delivery (deliver-deck.mjs), who decides.
 */
export const openAboutImported = (ledger) => openEntries(ledger).filter((e) => e.aboutImported);
// What both prompts say of such a finding on a revision, and what validation holds a flagged one to.
export const ABOUT_IMPORTED_RULE = "ABOUT THE IMPORTED DECK. Where a changed page is right by its own evidence and the problem is that a slide the revision did NOT change says otherwise - or the problem lies wholly in such a slide's own words - the remedy is to change the user's own slide, which they did not ask for and the team may not do unasked. File it with `aboutImported: true`, list that slide beside the changed page it concerns, keep the severity it deserves, and say in the fix what the user has to decide. It does not block, and it does not count against the verdict, the rating, compliance or sufficiency - judge each of those as though it were not filed, since validation does: it is reported to the user with the revised deck. A problem the changed page can mend on its own - a title that claims what its own slide does not show, a figure it changed and left standing elsewhere - is NOT about the imported deck: say `aboutImported: false`. Every finding that lists a slide the revision did not change says one or the other; validation refuses one that leaves it unsaid. Before filing a contradiction between a changed page and an untouched slide, read the changed slide's own record: where it bears the changed page out, the untouched slide is the one that is wrong.";
/**
 * What a finding's `aboutImported` is held to. `findings` are `{ id, pages,
 * aboutImported }` as the answer gave them; `untouched` the ids of the slides
 * the revision left as they were, null for a deck that has no imported slide.
 * Only a revision has an imported deck, and a finding flagged true names a
 * slide the revision left as it was. A finding that lists such a slide says
 * which it is - true or false: the question is whose remedy it is, and an
 * answer that leaves it unsaid blocks a change for a slide nobody may edit, or
 * waves through one the changed page should have mended, by default.
 */
export function aboutImportedErrors(findings, untouched) {
  return (findings || []).flatMap((item) => { const named = untouched ? (item.pages || []).filter((id) => untouched.includes(id)) : [];
    if (item.aboutImported === true && untouched === null) return [`${item.id}: \`aboutImported\` is for a revision of a deck the user already has; this deck has no imported slide`];
    if (item.aboutImported === true && !named.length) return [`${item.id}: \`aboutImported\` says the remedy is to change a slide the revision left as it was, and ${(item.pages || []).join(", ") || "it"} names none (the untouched slides are ${untouched.join(", ") || "none"}); list that slide, or say \`aboutImported: false\`: a problem on a changed page is the revision's own`];
    if (named.length && typeof item.aboutImported !== "boolean") return [`${item.id}: it lists ${named.join(", ")}, ${named.length === 1 ? "a slide" : "slides"} this revision did not change, so say whose remedy it is - \`aboutImported: true\` where the changed page is right and the fix is to change the user's own slide (reported to the user; it blocks nothing), \`aboutImported: false\` where the changed page can mend it alone`];
    return []; });
}

const normalizeText = (text) => String(text ?? "").normalize("NFKC").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
/** Whether a quoted piece of evidence is printed on one of the pages it names. */
export const quotedOn = (quote, pages, pageText) => pages.some((id) => normalizeText(pageText?.[id]).includes(normalizeText(quote)));

/** The worst open severity naming each page: what that page's verdict must say. */
export function expectedVerdicts(ledger) {
  const worstBy = new Map();
  for (const e of openEntries(ledger)) for (const id of e.pages || []) worstBy.set(id, worst([worstBy.get(id) ?? "none", e.severity]));
  return worstBy;
}

/**
 * A later pass, checked against the ledger it verifies: the pass number and
 * lineage, one status for every open finding, and new findings that are
 * additive. A new finding that restates an open one is not a new finding: it
 * is that finding's status (advanceLedger folds it in), and is refused only
 * where the pass also says the open finding is closed. `changed` is every page the rebuild changed plus the neighbours of
 * deleted pages; `ids` is the current page list. `downgrade(entry)` says which
 * entries' measured checks now pass (severityChange); `pageText` maps a page
 * to its text, against which a missed finding's quoted evidence is checked.
 */
export function verificationErrors(review, { scope, ledger, items, ids, pageKey = "slide", deckScope = "deck", automatic = () => false, statuses: allowed = STATUSES, downgrade = () => false, pageText = null }) {
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
    if (!allowed.includes(s.status)) errors.push(`${at}: status must be one of ${allowed.join(", ")}`);
    if (typeof s.evidence !== "string" || s.evidence.trim().length < 20) errors.push(`${at}: give the evidence on the page for the status`);
    const entry = open.find((e) => e.id === s.finding);
    if (!CLOSED.includes(s.status) && s.severity !== undefined && s.severity !== null && s.severity !== entry.severity) {
      if (!SEVERITIES.includes(s.severity)) errors.push(`${at}: unknown severity ${s.severity}`);
      else if (rank(s.severity) > rank(entry.severity)) { if (s.status !== "regressed") errors.push(`${at}: a residual severity cannot exceed the finding's ${entry.severity} unless it regressed`); }
      else if (!severityChange(entry, s, downgrade)) errors.push(`${at}: ${s.finding} keeps its ${entry.severity} severity - a partly fixed finding is lowered only when it is a ${deckScope} finding whose measured check now passes (the packet marks those); report it as not fixed, partly fixed at ${entry.severity}, or fixed`);
    }
    // An item other statements were folded into is closed, or called partly fixed, statement by statement.
    const silent = unanswered(entry, s);
    if (silent.length) errors.push(`${at}: ${s.finding} holds ${statementsOf(entry).length} statements (${statementsOf(entry).map((f) => `${f.id}, pass ${f.pass}`).join("; ")}) and the status says ${s.status} without answering ${silent.map((f) => `${f.id} (it ${f.why})`).join("; ")}. Give \`answers\` one { statement, evidence } for each, with what the page shows for that statement: ${ANSWER_CHARS_MIN} characters or more, different from every other answer and from the statement itself, using a term of the statement or naming the page or artifact that changed - or report the item not fixed`);
    const strangers = (s.answers || []).map((a) => a?.statement).filter((id) => !statementsOf(entry).some((f) => f.id === id));
    if (strangers.length) errors.push(`${at}: \`answers\` names ${strangers.join(", ")}, which ${s.finding} does not hold (${statementsOf(entry).map((f) => f.id).join(", ")})`);
  }
  const changed = new Set(scope.changed || []);
  const priorIds = new Set((ledger || []).map((e) => e.id));
  // An open finding a new one restates takes that as its status (advanceLedger folds the two).
  const folded = new Set();
  for (const [i, item] of (items || []).entries()) {
    const at = `findings[${i}] (${item.id})`;
    if (priorIds.has(item.id)) errors.push(`${at}: the id is already in the ledger; give a new finding a new id`);
    const was = priorIds.has(item.id) ? null : restated(open, item);
    if (was) {
      // The open finding restated: it is folded into that finding and kept open, so the rules for a new finding do not apply to it.
      // Only a status that closes the same finding cannot stand beside it.
      const given = statuses.find((s) => s?.finding === was.id);
      if (given && CLOSED.includes(given.status)) errors.push(`${at}: two statements conflict - statuses says ${was.id} is ${given.status}, and this finding says ${item.code} still stands on ${sharedPages(was, item).join(", ")}, which is ${was.id}. If the defect remains, give ${was.id} the status "not fixed" or "partly fixed" and leave this finding out; if ${was.id} is ${given.status} and this is another defect, file it under the code that names it`);
      folded.add(was.id);
      continue;
    }
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
      if (typeof item.justification !== "string" || item.justification.trim().length < 60) errors.push(`${at}: justify why the earlier pass could not see it (what was hidden, or what only this pass could check)`);
      // A missed finding is admitted on the page's own words: a quote a reader
      // can find on the page, not a recollection of it.
      const quote = typeof item.evidence === "string" ? item.evidence.trim() : "";
      if (quote.length < 8) errors.push(`${at}: a missed finding quotes the evidence on the page in \`evidence\` (at least a few words, exactly as printed)`);
      else if (pageText && !quotedOn(quote, pages, pageText)) errors.push(`${at}: the quoted evidence "${quote.slice(0, 80)}" is not printed on ${pages.join(", ")}; quote the page exactly`);
    }
  }
  const missing = open.filter((e) => !seen.has(e.id) && !folded.has(e.id)).map((e) => e.id);
  if (missing.length) errors.push(`statuses: every open finding needs a status (${allowed.join(", ")}); missing ${missing.join(", ")}`);

  const covered = new Set((review.pages || []).map((p) => p?.[pageKey]));
  const unread = (scope.mustInspect || []).filter((id) => !covered.has(id));
  if (unread.length) errors.push(`pages: this pass must read and record every changed or blocked page; missing ${unread.join(", ")}`);
  const known = new Set(ids);
  const unknown = [...covered].filter((id) => !known.has(id));
  if (unknown.length) errors.push(`pages: unknown page${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`);
  return errors;
}

/**
 * Validation errors gathered by rule, so one correction round mends every
 * place a rule was broken. `rules` is [{ id, matches, rule }]: `matches` reads
 * an error's text and `rule` states what the validator enforces, as the prompt
 * stated it. Errors under one rule become one line - the rule, every place it
 * was broken, and the first error in full as the example. An error no rule
 * matches, and a rule broken once, stay as they were written.
 */
export function groupErrors(errors, rules) {
  const groups = new Map(), out = [];
  for (const error of errors) {
    const found = rules.find((item) => item.matches.test(error));
    if (!found) { out.push({ text: error }); continue; }
    if (!groups.has(found.id)) { groups.set(found.id, { rule: found, errors: [] }); out.push(groups.get(found.id)); }
    groups.get(found.id).errors.push(error);
  }
  // Where an error was raised - what stands before the rule's message ("s1: findings[4] (F5)") - or the error itself where it is short.
  const place = (error, rule) => { const at = error.search(rule.matches); return error.length <= 90 || at <= 0 ? error : error.slice(0, at).replace(/[:\s]+$/, ""); };
  return out.map((group) => (group.text ?? (group.errors.length === 1 ? group.errors[0]
    : `${group.errors.length} places break one rule - ${group.rule.rule}. Every place: ${group.errors.map((error) => place(error, group.rule)).join("; ")}. The first in full - ${group.errors[0]}`)));
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
export const COMPLETENESS_NOTE = Object.freeze({ clean: 30, findings: 10 });
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
    if (typeof entry.note !== "string" || entry.note.trim().length < (entry.result === "clean" ? COMPLETENESS_NOTE.clean : COMPLETENESS_NOTE.findings)) errors.push(`completeness ${dim}: ${entry.result === "clean" ? "say what was checked and why nothing was found" : "say what was found"}`);
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

/**
 * What the next pass is, or null when there is no prior record: its number,
 * the review it verifies, the pages it must read - every page whose hash
 * changed, the neighbours of deleted pages, and every page an open major or
 * blocker names - and the open findings it must give a status. The changed
 * pages are also the only ones a new major finding may be raised on. A rebuild
 * that deleted every earlier page is read as all changed: the loop continues
 * under its cap rather than silently starting again. `ids` is the pages a pass
 * reads (the storyline reads content pages only); `capped` says the pass would
 * exceed the loop's cap. The scope carries no earlier rating: a verifier that
 * knows the last score is anchored to it.
 */
export function nextPassScope(prior, current, { ledger, ids = Object.keys(current), maxPasses = MAX_PASSES }) {
  if (!prior?.pageHashes || !prior.review) return null;
  const moved = changedPages(prior.pageHashes, current) ?? { changed: Object.keys(current), deleted: Object.keys(prior.pageHashes), neighbours: [] };
  const named = new Set(openBlocking(ledger).flatMap((e) => e.pages || []));
  const changed = [...new Set([...moved.changed, ...moved.neighbours])];
  const pass = (prior.pass ?? prior.review.pass ?? 1) + 1;
  return { pass, verifies: prior.binding, maxPasses, capped: pass > maxPasses, changed, deleted: moved.deleted,
    mustInspect: ids.filter((id) => changed.includes(id) || named.has(id)), open: openEntries(ledger), ledger };
}

/**
 * Split a long first pass for parallel readers: a section per divider, short
 * sections folded into the one before, long ones cut into even chunks of at
 * most `max`, so each reader reads a dozen pages closely instead of fifty
 * thinly. `pages` is [{ id, title, opens, counted }]: `opens` starts a
 * section, `counted: false` leaves the page out of it (the storyline's
 * dividers). The section's page list is written under `key`.
 */
export function splitSections(pages, { max, min = 5, key = "pages" }) {
  const groups = [];
  for (const p of pages) {
    if (!groups.length || p.opens) groups.push({ title: p.opens ? p.title : "Opening", ids: [] });
    if (p.counted !== false) groups.at(-1).ids.push(p.id);
  }
  const folded = [];
  for (const g of groups.filter((x) => x.ids.length)) {
    const last = folded.at(-1);
    if (last && (g.ids.length < min || last.ids.length < min) && last.ids.length + g.ids.length <= max) { last.ids.push(...g.ids); last.title = `${last.title}; ${g.title}`; }
    else folded.push({ ...g, ids: [...g.ids] });
  }
  return folded.flatMap((g) => {
    const n = Math.ceil(g.ids.length / max), size = Math.ceil(g.ids.length / n);
    return Array.from({ length: n }, (_, k) => ({ title: n > 1 ? `${g.title} (${k + 1} of ${n})` : g.title, ids: g.ids.slice(k * size, (k + 1) * size) }));
  }).map((g, i) => ({ id: `s${i + 1}`, title: g.title, [key]: g.ids }));
}

/**
 * The parts of a split first pass, checked as a set before they are joined:
 * one spine part, one binding, every page read by exactly one section part,
 * and a part for every section the packet named. `key` is the parts' page-list
 * field (`slides` for the deck, `pages` for the storyline).
 */
export function partSetErrors(parts, ids, { key, binding = parts[0]?.binding, sections = null }) {
  const errors = [];
  const sectionParts = parts.filter((p) => p?.part?.kind === "section");
  const spines = parts.filter((p) => p?.part?.kind === "spine").length;
  if (spines !== 1) errors.push(`a split review needs exactly one spine part; got ${spines}`);
  if (parts.some((p) => p?.binding !== binding)) errors.push("a part is bound to a different build or spine than the packet");
  const covered = sectionParts.flatMap((p) => p.part?.[key] || []);
  const uncovered = ids.filter((id) => !covered.includes(id));
  if (uncovered.length) errors.push(`no section part covers ${uncovered.join(", ")}`);
  const twice = [...new Set(covered.filter((id, i) => covered.indexOf(id) !== i))];
  if (twice.length) errors.push(`${twice.join(", ")} covered by two section parts`);
  for (const section of sections || []) if (!sectionParts.some((p) => p.part.id === section.id)) errors.push(`section ${section.id} has no part`);
  return errors;
}

/**
 * The joined first pass's page entries and completeness. Pages come from the
 * section parts in deck order, each verdict recomputed from the joined
 * `ledger`, since a spine finding can raise a page its section reviewer
 * passed; completeness is one entry per dimension carrying every part's note.
 * A dimension no part reported on is an error: the join cannot say it was checked.
 */
export function joinParts(parts, ids, ledger, { pageKey, dimensions, dimKey }) {
  const order = new Map(ids.map((id, i) => [id, i]));
  const expected = expectedVerdicts(ledger);
  const pages = parts.filter((p) => p.part.kind === "section").flatMap((p) => p.pages).sort((a, b) => order.get(a[pageKey]) - order.get(b[pageKey]))
    .map((p) => ({ ...p, verdict: verdictOf(expected.get(p[pageKey]) ?? "none") }));
  const completeness = dimensions.map((d) => ({ [dimKey]: d, result: ledger.some((e) => e.dimension === d) ? "findings" : "clean",
    note: parts.flatMap((p) => (p.completeness || []).filter((c) => c[dimKey] === d).map((c) => `${p.part.id}: ${c.note}`)).join(" | ") }));
  const unreported = completeness.filter((c) => !c.note).map((c) => c[dimKey]);
  return { pages, completeness, errors: unreported.length ? [`no part reported what it checked for ${unreported.join(", ")}`] : [] };
}

/**
 * The saved answers of a split first pass: every <id>.json in the parts
 * folder. A backend's raw output (<id>.last-message.json) is written beside
 * them and is not a part - read as one, every part would count twice and the
 * merge would refuse its own run.
 */
export async function readParts(dir) {
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json") && !f.endsWith(".last-message.json")).sort();
  return { files, parts: await Promise.all(files.map((f) => readJson(path.join(dir, f)))) };
}

/** A reviewer's JSON answer, from whatever the backend printed around it. */
function parseAnswer(raw) {
  const match = String(raw).match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

/**
 * One fresh reviewer, with none of the author's context, working in `cwd` - a
 * staging directory holding only the packet, the prompt, the schema and the
 * renders (stageReview), so earlier reviews in the output directory are not
 * within its reach: codex with the schema and the page images, or claude
 * reading the images itself. Both loops call it with the same flags. The
 * answer's provenance is the harness's to write: the backend it ran, the
 * model, and the packet's prompt hash.
 */
export async function callReviewer(which, { prompt, schemaPath, images = [], outPath, model, timeoutMs, cwd, promptHash = null }) {
  const chosen = reviewerModel(which, model);
  let answer, used = chosen;
  if (which === "codex") {
    await runProcess("codex", ["exec", ...(chosen ? ["--model", chosen] : []),
      ...(REVIEWER_CONFIG.defaultReasoningEffort ? ["-c", `model_reasoning_effort="${REVIEWER_CONFIG.defaultReasoningEffort}"`] : []),
      "--sandbox", "read-only", "--ephemeral", "--skip-git-repo-check", ...(cwd ? ["--cd", cwd] : []), "--output-schema", schemaPath,
      "--output-last-message", outPath, ...images.flatMap((image) => ["--image", image]), "-"], { input: prompt, timeoutMs, cwd });
    answer = parseAnswer(await fs.readFile(outPath, "utf8"));
  } else if (which === "claude") {
    const res = await runProcess("claude", ["-p", "--output-format", "json", "--allowedTools", "Read", ...(chosen ? ["--model", chosen] : [])], { input: prompt, timeoutMs, cwd });
    const envelope = JSON.parse(res.stdout);
    answer = parseAnswer(typeof envelope.result === "string" ? envelope.result : JSON.stringify(envelope.result ?? envelope));
    used = chosen ?? Object.keys(envelope.modelUsage ?? {})[0] ?? envelope.model ?? "claude (CLI default)";
  } else throw new Error(`Unknown reviewer backend: ${which}`);
  if (answer && typeof answer === "object" && promptHash) answer.provenance = { backend: which, model: used ?? `${which} (CLI default)`, promptHash };
  return answer;
}

/**
 * Every part of a split first pass at once - the readers are independent -
 * each saved as parts/<id>.json, so a failed merge can be rerun on the saved
 * answers without calling anyone again.
 */
export async function reviewParts(which, jobs, { partsDir, schemaPath, model, timeoutMs, cwd, promptHash }) {
  await fs.mkdir(partsDir, { recursive: true });
  return Promise.all(jobs.map(async (job) => {
    const part = await callReviewer(which, { prompt: job.prompt, schemaPath: job.schemaPath ?? schemaPath, images: job.images, outPath: path.join(partsDir, `${job.id}.last-message.json`), model, timeoutMs, cwd, promptHash });
    await writeJson(path.join(partsDir, `${job.id}.json`), part);
    return part;
  }));
}

const STAGING_PREFIX = "professional-slides-";

/**
 * A clean staging directory for one packet: a fresh folder under the system
 * temp directory holding only what the reviewer is given - the packet, the
 * prompts, the schemas and copies of the renders (`files`, { to: from }) - so
 * a reviewer working there, or handed its path, can reach nothing else the
 * loop wrote. The previous staging directory of the same loop is removed.
 */
export async function stageReview(kind, files = {}, { previous = null } = {}) {
  const tmp = await fs.realpath(os.tmpdir());
  if (previous && path.dirname(previous) === tmp && path.basename(previous).startsWith(STAGING_PREFIX)) await fs.rm(previous, { recursive: true, force: true });
  const dir = await fs.mkdtemp(path.join(tmp, `${STAGING_PREFIX}${kind}-`));
  for (const [to, from] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, to)), { recursive: true });
    await fs.copyFile(from, path.join(dir, to)).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
  return dir;
}

/**
 * Where a deck's review lineages live: beside the deck file, keyed by deck id
 * (<dir of deck.json>/.reviews/<id>/), so a rebuild into another output
 * directory continues the same lineages and caps. With no deck path the deck
 * file is looked for beside or inside the output directory.
 */
export async function lineageStore(spec, directory, deckPath = null) {
  const deck = await locateDeck(spec, directory, deckPath);
  return path.join(deck ? path.dirname(deck) : path.resolve(directory), ".reviews", deckStem(spec));
}
/** The deck file: the path given, or <id>.deck.json beside or inside the output directory. */
export async function locateDeck(spec, directory, deckPath = null) {
  if (deckPath) return path.resolve(deckPath);
  const stem = deckStem(spec);
  const exists = (file) => fs.access(file).then(() => true, () => false);
  if (directory) for (const candidate of [path.join(path.dirname(path.resolve(directory)), `${stem}.deck.json`), path.join(path.resolve(directory), `${stem}.deck.json`)]) if (await exists(candidate)) return candidate;
  return null;
}

const LINEAGE = "lineage.json";
export const readLineage = async (historyDir) => (await readJson(path.join(historyDir, LINEAGE), { optional: true })) ?? { restarts: [] };

/**
 * Start a new lineage: the current passes move to lineage-<n>/ and the restart
 * is logged with its reason. A restart needs a reason; a second restart needs
 * the user's explicit approval, because restarting is how a capped loop would
 * otherwise begin again at pass one. A lineage with no recorded pass has
 * nothing to restart, and the call is a no-op.
 */
export async function restartLineage(historyDir, { reason, userApproved = false, flag = "--full-review" } = {}) {
  const files = (await fs.readdir(historyDir).catch(() => [])).filter((f) => /^(pass|confirmation)-\d+\.json$/.test(f));
  if (!files.some((f) => PASS_FILE.test(f))) return { restarted: false, errors: [] };
  const lineage = await readLineage(historyDir);
  if (typeof reason !== "string" || reason.trim().length < 10) return { restarted: false, errors: [`${flag} starts a new lineage and needs --reason "<why the argument itself changed>", which is logged`] };
  if (lineage.restarts.length >= 1 && !userApproved) return { restarted: false, errors: [`this lineage has restarted ${lineage.restarts.length} time${lineage.restarts.length === 1 ? "" : "s"} already (${lineage.restarts.map((r) => `"${r.reason}"`).join("; ")}); another restart runs only when the user asks for it: rerun with --user-approved`] };
  const archived = `lineage-${lineage.restarts.length + 1}`;
  await fs.mkdir(path.join(historyDir, archived), { recursive: true });
  for (const f of files) await fs.rename(path.join(historyDir, f), path.join(historyDir, archived, f));
  lineage.restarts.push({ at: new Date().toISOString(), reason: reason.trim(), userApproved: Boolean(userApproved), archived, passes: files.filter((f) => PASS_FILE.test(f)).length });
  await writeJson(path.join(historyDir, LINEAGE), lineage);
  return { restarted: true, errors: [], archived };
}

/**
 * Retire a lineage whose record can no longer be read against the deck - it
 * was recorded under an older definition of what a pass is bound to. Its
 * passes, and `files` beside them (a waiting packet, an unrecorded answer),
 * move to retired-<n>/ and the retirement is logged with `note`. It is not a
 * restart: nobody chose it, so it needs no reason, counts against no restart
 * allowance, and the loop begins again at pass one. What was open in it is not
 * dropped with it: `open` is its blocking items still open, which the log
 * keeps (`carried`, how many; `open`, the items) until the new lineage's first
 * pass has said of each whether it still stands (carriedItems, settleCarried).
 * Returns the folder's name.
 */
export async function retireLineage(historyDir, { note, files = [], open = [] } = {}) {
  const lineage = await readLineage(historyDir);
  const passes = (await fs.readdir(historyDir).catch(() => [])).filter((f) => /^(pass|confirmation)-\d+\.json$/.test(f));
  const archived = `retired-${(lineage.retired || []).length + 1}`;
  await fs.mkdir(path.join(historyDir, archived), { recursive: true });
  for (const f of passes) await fs.rename(path.join(historyDir, f), path.join(historyDir, archived, f));
  for (const file of files) await fs.rename(file, path.join(historyDir, archived, path.basename(file))).catch((error) => { if (error.code !== "ENOENT") throw error; });
  await writeJson(path.join(historyDir, LINEAGE), { ...lineage, retired: [...(lineage.retired || []), { at: new Date().toISOString(), note, archived, passes: passes.filter((f) => PASS_FILE.test(f)).length,
    carried: open.length, ...(open.length ? { open } : {}) }] });
  return archived;
}

/** The blocking items a retired lineage left open that no first pass has answered yet: what the next pass-one packet carries. */
export async function carriedItems(historyDir) {
  const last = ((await readLineage(historyDir)).retired || []).at(-1);
  return last && Array.isArray(last.open) && !last.settledIn ? last.open : [];
}

/** Log that the carried items were answered, by the first pass recorded under `binding`: they are that lineage's findings, or its critic's reasons, from here on. */
export async function settleCarried(historyDir, binding) {
  const lineage = await readLineage(historyDir);
  const last = (lineage.retired || []).at(-1);
  if (!last || !Array.isArray(last.open) || last.settledIn) return;
  await writeJson(path.join(historyDir, LINEAGE), { ...lineage, retired: [...lineage.retired.slice(0, -1), { ...last, settledIn: binding }] });
}

/**
 * What a first pass owes the items carried from a retired lineage (`carried`:
 * `{ id, ... }` each), as errors: one `{ item, stands, evidence }` for each,
 * and for one that still stands, the id of the item of this pass (`ids`) it is
 * filed as. The carried items are not statuses - the retired record cannot be
 * compared with the deck - so the critic judges each afresh, and none is lost
 * without a reason on the record.
 */
export function carriedErrors(review, carried, ids) {
  if (!carried?.length) return (review.carried || []).length ? ["`carried` answers items carried from a retired lineage, and this packet carries none: leave `carried` out. It is not where a slide a revision carries is judged - what stands on one is a finding, with the slide's id in its `pages`; and a finding that lists a slide the revision did not change says whose remedy it is - `aboutImported: true` where the changed page is right and the fix is to change the user's own slide (reported to the user; it blocks nothing), `aboutImported: false` where the changed page can mend it alone"] : [];
  const answers = Array.isArray(review.carried) ? review.carried : [];
  const errors = [];
  for (const item of carried) {
    const given = answers.filter((a) => a?.item === item.id);
    if (given.length !== 1) { errors.push(`carried: ${item.id} was open when the earlier lineage was retired and ${given.length ? "is answered more than once" : "is not answered"}: give \`carried\` one { item, stands, evidence } for it${given.length ? "" : ", saying whether it still stands on the spine as it is now"}`); continue; }
    const [answer] = given;
    if (answer.stands === true && !ids.includes(answer.finding)) errors.push(`carried: ${item.id} still stands, so it is an item of this pass: file it as a finding, a missing analysis or a cut and name that item's id in \`finding\`${answer.finding ? ` (${answer.finding} is not an item of this critique)` : ""}`);
  }
  const strangers = answers.map((a) => a?.item).filter((id) => !carried.some((item) => item.id === id));
  if (strangers.length) errors.push(`carried: ${strangers.join(", ")} ${strangers.length === 1 ? "is" : "are"} not among the carried items (${carried.map((item) => item.id).join(", ")})`);
  return errors;
}
/** The schema of a first pass's `carried`, for the loops' schemas. */
export const CARRIED_SCHEMA = { type: "array", items: { type: "object", additionalProperties: false, required: ["item", "stands", "evidence"],
  properties: { item: { type: "string" }, stands: { type: "boolean" }, evidence: { type: "string", minLength: 20 }, finding: { type: "string" } } } };

const PASS_FILE = /^pass-(\d+)\.json$/;

/** Every recorded pass of a loop's history folder, in order. */
export async function readPasses(dir) {
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => PASS_FILE.test(f)).sort((a, b) => Number(a.match(PASS_FILE)[1]) - Number(b.match(PASS_FILE)[1]));
  return Promise.all(files.map((f) => readJson(path.join(dir, f))));
}

/**
 * Record a validated pass as <dir>/pass-N.json, in the one format both loops
 * read: the review, its binding, pass and lineage, the page hashes it read
 * (what the next pass is scoped against) and the ledger after it (what
 * acceptance is read off). `extra` carries what a loop adds (its mode, the
 * outcome it reached).
 */
export async function recordPass(dir, { review, pageHashes, ledger, ...extra }) {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `pass-${(await readPasses(dir)).length + 1}.json`);
  const record = { review, binding: review.binding, pass: review.pass ?? 1, verifies: review.verifies ?? null, pageHashes, ledger, ...extra, recordedAt: new Date().toISOString() };
  await writeJson(file, record);
  return { file, record };
}

const CONFIRMATION_FILE = /^confirmation-(\d+)\.json$/;
/** Every recorded confirmation read of a lineage, in order. */
export async function readConfirmations(dir) {
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => CONFIRMATION_FILE.test(f)).sort((a, b) => Number(a.match(CONFIRMATION_FILE)[1]) - Number(b.match(CONFIRMATION_FILE)[1]));
  return Promise.all(files.map((f) => readJson(path.join(dir, f))));
}
/** Record a validated confirmation read as <dir>/confirmation-N.json beside the passes it confirms. */
export async function recordConfirmation(dir, record) {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `confirmation-${(await readConfirmations(dir)).length + 1}.json`);
  await writeJson(file, { ...record, recordedAt: new Date().toISOString() });
  return file;
}
