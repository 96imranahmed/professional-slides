#!/usr/bin/env node
/**
 * Gates for what the deck says, before anything decides how it looks.
 *
 *   node runtime/gates/content_gates.mjs deck.content.json [--report out.json]
 *
 * A deck can score well on every layout measure and still say nothing. When
 * one record asks for the claim, the exhibit, the variant and the architecture
 * together, choosing the architecture passes for choosing the content.
 *
 * So the content file may not name a component, an architecture or a variant.
 * There is nowhere to put one. A page makes four analytical decisions,
 * then records complete visible copy and a matched-reference text comparison:
 *
 *   claim      the sentence this page proves
 *   settles    what settles it, and what KIND of thing that is
 *   adds       what the commentary says that the exhibit cannot
 *   highlight  the phrase the reader should see first
 *
 * Layout planning reads the whole content record: claim, evidence, commentary
 * job and focus. `settles.kind` suggests an encoding; it does not replace the
 * evidence or prescribe a quota of quantitative pages.
 *
 * `adds` records what the commentary is for. With nowhere to record it, the
 * commentary becomes a second reading of the exhibit, and pages open on
 * "Interpretation:".
 *
 * Exit 0 when the content passes, 2 when it has findings, 1 on a crash.
 */
import { EXIT, UsageError, isMain, parseCli, readJsonSync, runCli, writeJsonSync } from "../cli.mjs";
import { checkTextPlan, textWords } from "../text-contract.mjs";
import { DECK_LENGTH, applyRulesVersion } from "../weight.mjs";

export const CONTENT_CODES = Object.freeze({
  CONTENT_SCHEMA: "the content file is not a readable record of what the deck says",
  TEXT_PLAN_INCOMPLETE: "the dot-dash does not list all visible copy",
  TEXT_REFERENCE_MISSING: "per-page reference text comparison is missing",
  TEXT_COVERAGE_LOW: "planned text is below comparable reference coverage",
  TEXT_BLOCK_TOO_LONG: "one run of prose is longer than a strong deck ever sets",
  // Raised at composition by text-contract.mjs, where the page's structure is
  // known; listed here because it belongs to the same text contract.
  TEXT_TASK_MISMATCH: "the reading task the page is measured against is not the one it composes to",
  CONTENT_NO_CLAIM: "a page names a topic instead of proving something",
  CONTENT_UNMEASURED: "many pages declare qualitative evidence; check its specificity",
  CONTENT_ADDS_NOTHING: "the commentary is planned as a second reading of the exhibit",
  CONTENT_NO_HIGHLIGHT: "no page names the phrase its reader should see first",
  CONTENT_CLAIM_REPEATS: "two pages make the same claim",
  CONTENT_LAYOUT_LEAK: "the content file decides how a page looks",
  CONTENT_ANSWER_UNCARRIED: "the deck's own answer is not carried by any of its claims",
  CONTENT_ANSWER_CONTRADICTED: "a page recommends something the deck's unconditional answer rules out",
});

/** What a page settles, and what kind of thing that is. */
export const EVIDENCE_KINDS = Object.freeze([
  "count",       // how many - a number, a bar, a waffle
  "share",       // how much of the whole - a stack, a marimekko, a pie
  "rank",        // which is biggest - a sorted bar, a lollipop, a dumbbell
  "rate",        // how fast, per what - a line, a slope, an index
  "sequence",    // what happens in what order - a timeline, a gantt, a journey
  "comparison",  // how two or more named things differ - a table, a paired exhibit
  "structure",   // what relates to what - a framework, a network, a tree
  "qualitative", // what something is like, with nothing countable behind it
]);

// Words that carry no argument, so two sentences sharing them share nothing.
// One list, read here and by the page gates (text_stats.py content_words).
const STOPWORDS = new Set(readJsonSync(new URL("./stopwords.json", import.meta.url)).content);

/** The content words of `text`: lower-case runs of letters, four and up, that are not stopwords. */
export const contentWords = (text) => new Set(String(text ?? "").toLowerCase().match(/[a-z][a-z']+/g)?.filter(
  (w) => !STOPWORDS.has(w) && w.length > 3) ?? []);

const overlap = (a, b) => {
  const left = contentWords(a), right = contentWords(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const w of left) if (right.has(w)) shared += 1;
  return shared / left.size;
};

export const CONTENT_THRESHOLDS = Object.freeze({
  from: DECK_LENGTH.content, // pages before a deck-wide share is worth measuring
  qualitativeMax: 0.34,   // a third
  // Past half the deck, "qualitative" is not a judgement about some pages; it
  // is a deck that declared its evidence unmeasured, and an advisory at that
  // share is read and shipped past, so it blocks.
  qualitativeBlock: 0.5,
  addsOverlapMax: 0.5,    // `adds` built from the words of what it adds to
  claimWordsMin: 6,       // "Origins" is a topic; a claim is a sentence
  claimOverlapMax: 0.7,   // two pages proving the same thing
  highlightMin: 1,
  // The answer gate. `coverage` is the share of the answer's own content words
  // that appear somewhere in the claims; `carried` is the best single claim's
  // share of them. An answer nothing claims is a promise the deck does not
  // keep, and an answer spread thinly over twenty pages with no page stating
  // it is a deck with no lead. Measured on the example content plans, which
  // run 0.75/0.55 and 0.80/0.44.
  answerCoverageMin: 0.6,
  answerCarriedMin: 0.35,
});

// The words a recommendation is made in, and the words that make one
// conditional. An answer that says "start with Marvel" and a page that says
// "start with The Dark Knight" are not two findings, they are one unresolved
// question - unless the answer says who each is for.
const RECOMMENDS = /\b(start with|begin with|recommend|choose|pick|go with|watch first|buy|adopt|select|the answer is|should watch|should start|best entry|entry point)\b/i;
const CONDITIONAL = /\b(unless|except|if you|for the|for a|for those|whereas|while|but only|depending|either)\b/i;
/**
 * The pages that recommend something other than what the deck's answer
 * recommends, while the answer names no condition.
 *
 * The named things in a sentence are its capitalised words, less the ones that
 * also appear in lower case somewhere in the deck - which is what tells
 * "Marvel" apart from a "Start" that is only capitalised because it opens a
 * sentence. A claim that puts forward a different name is not wrong, and the
 * deck is usually right to make it; what is wrong is an answer that does not
 * admit it. Consulting writes that as the condition: "Marvel, unless you have
 * one evening, in which case The Dark Knight."
 */
function contradictions(answer, pages) {
  if (!RECOMMENDS.test(answer) || CONDITIONAL.test(answer)) return [];
  const argument = [answer, ...pages.map((p) => String(p.claim ?? ""))].join(" ");
  const lowercased = new Set(argument.match(/\b[a-z][a-z']+\b/g) ?? []);
  const names = (text) => new Set((String(text ?? "").match(/\b[A-Z][A-Za-z']{2,}\b/g) ?? [])
    .filter((word) => !STOPWORDS.has(word.toLowerCase()) && !lowercased.has(word.toLowerCase())));
  const answerNames = names(answer);
  if (!answerNames.size) return [];
  const against = [];
  for (const page of pages) {
    const claim = String(page.claim ?? "");
    if (!RECOMMENDS.test(claim)) continue;
    const claimed = names(claim);
    if (!claimed.size || [...claimed].some((name) => answerNames.has(name))) continue;
    against.push({ page: page.n ?? null, claim: claim.slice(0, 80), recommends: [...claimed].slice(0, 3) });
  }
  return against;
}

// A field that decides how the page looks has no home here.
const LAYOUT_FIELDS = ["exhibit", "variant", "architecture", "layout", "shape", "anchors", "insight", "chart", "component"];

const finding = (page, code, measured, threshold, repair) => {
  if (!Object.hasOwn(CONTENT_CODES, code)) throw new Error(`Unregistered content gate code: ${code}`);
  return { page, code, measured, threshold, repair };
};

const round = (n) => Math.round(n * 1000) / 1000;

export function runContentGates(content, options = {}) {
  const findings = [];
  if (!content || typeof content !== "object" || !Array.isArray(content.pages)) {
    findings.push(finding(null, "CONTENT_SCHEMA", "absent", "professional-slides.content/v1",
      "The content file needs a `pages` array, one entry per page, each carrying `claim`, "
      + "`settles` (with a `kind` and a `what`), `adds` and `highlight`."));
    return report(content, findings, []);
  }
  const pages = content.pages;
  const textCheck = checkTextPlan(content, options);
  findings.push(...textCheck.findings);

  for (const page of pages) {
    const at = page.n ?? null;
    if (page.role === "structural") continue; // still subject to complete-copy/reference checks
    const leaked = LAYOUT_FIELDS.filter((f) => page[f] !== undefined);
    if (leaked.length) {
      findings.push(finding(at, "CONTENT_LAYOUT_LEAK", leaked, "none of " + LAYOUT_FIELDS.join(", "),
        "This stage decides what the page proves; the next one decides what it looks like. "
        + "Naming the exhibit here is how choosing a shape starts to feel like choosing the "
        + "evidence - which is the whole reason these are two files. Move it to the layout plan."));
    }
    const claim = String(page.claim ?? "").trim();
    if (textWords(claim) < CONTENT_THRESHOLDS.claimWordsMin || !/\s/.test(claim)) {
      findings.push(finding(at, "CONTENT_NO_CLAIM", claim || "(empty)", `${CONTENT_THRESHOLDS.claimWordsMin} words`,
        "A page proves something; a topic label does not. \"Origins\" is a section name, "
        + "\"DC's foundational icons predate Marvel's defining 1960s ensemble\" is a claim. "
        + "If the page cannot produce a sentence with a verb in it, the page has no argument yet."));
    }
    const kind = String(page.settles?.kind ?? "").trim();
    if (!EVIDENCE_KINDS.includes(kind)) {
      findings.push(finding(at, "CONTENT_SCHEMA", kind || "(missing evidence kind)", EVIDENCE_KINDS.join(" | "),
        `Declare one evidence relationship: ${EVIDENCE_KINDS.join(", ")}. `
        + "Design reads this together with the claim, actual evidence, basis and consequence."));
    }
    if (typeof page.settles?.what !== "string" || !page.settles.what.trim()) {
      findings.push(finding(at, "CONTENT_SCHEMA", "(missing evidence description)", "nonempty settles.what",
        "Name the observations, comparison, worked case or mechanism that supports the claim. "
        + "An evidence-kind label alone supplies no evidence to design."));
    }
    const adds = String(page.adds ?? "").trim();
    if (!adds && page.adds !== null && page.adds !== "none") {
      findings.push(finding(at, "CONTENT_ADDS_NOTHING", "(empty)", "a sentence",
        "What does the commentary say that the exhibit cannot? If the answer is nothing, "
        + "this page does not need a commentary column and the exhibit should have the width. "
        + "A page with no answer to this question is where \"Interpretation: …\" comes from."));
    } else if (adds && adds !== "none") {
      const against = `${page.claim ?? ""} ${page.settles?.what ?? ""}`;
      const share = overlap(adds, against);
      if (share > CONTENT_THRESHOLDS.addsOverlapMax) {
        findings.push(finding(at, "CONTENT_ADDS_NOTHING", { overlap: round(share), adds: adds.slice(0, 70) },
          CONTENT_THRESHOLDS.addsOverlapMax,
          "This is the claim again in different words. The commentary earns its column by saying "
          + "what follows from the evidence, what it costs, which option it settles, or what would "
          + "change it - none of which the exhibit can draw."));
      }
    }
  }

  if (pages.length >= CONTENT_THRESHOLDS.from) {
    const kinds = pages.map((p) => String(p.settles?.kind ?? "qualitative"));
    const qualitative = kinds.filter((k) => k === "qualitative").length;
    const share = qualitative / kinds.length;
    if (share > CONTENT_THRESHOLDS.qualitativeMax) {
      const blocks = share > CONTENT_THRESHOLDS.qualitativeBlock;
      const which = pages.filter((p) => String(p.settles?.kind ?? "qualitative") === "qualitative").map((p) => p.id ?? p.n).filter((x) => x != null);
      findings.push({ ...finding(null, "CONTENT_UNMEASURED",
        { share: round(share), pages: qualitative, of: kinds.length, ids: which.slice(0, 20) },
        blocks ? CONTENT_THRESHOLDS.qualitativeBlock : CONTENT_THRESHOLDS.qualitativeMax,
        (blocks ? `${qualitative} of ${kinds.length} pages declare their evidence qualitative, past the half at which a deck is refused. `
          + "Go back to the research for the pages whose claim is a quantity - a share, a rate, a ranking, a count - and record what "
          + "settles it; keep `qualitative` for the pages that are genuinely about what something is like. "
          : "Check whether these pages contain named examples, bounded comparisons or worked mechanisms. ")
        + "A qualitative label cannot establish evidence quality, and changing it to comparison "
        + "does not add evidence. Plot quantities when they settle the question; do not invent "
        + "numbers or impose a chart quota on an operating or qualitative argument."),
        severity: blocks ? "blocking" : "advisory" });
    }
    const highlighted = pages.filter((p) => String(p.highlight ?? "").trim()).length;
    if (highlighted < CONTENT_THRESHOLDS.highlightMin) {
      findings.push(finding(null, "CONTENT_NO_HIGHLIGHT", highlighted, CONTENT_THRESHOLDS.highlightMin,
        "Review whether a specific finding needs emphasis. Explicitly neutral pages are valid; "
        + "add a highlight only where the claim identifies its exact target."));
    }
    for (let i = 0; i < pages.length; i += 1) {
      for (let j = i + 1; j < pages.length; j += 1) {
        if (overlap(pages[i].claim, pages[j].claim) > CONTENT_THRESHOLDS.claimOverlapMax
            && overlap(pages[j].claim, pages[i].claim) > CONTENT_THRESHOLDS.claimOverlapMax) {
          findings.push(finding(pages[j].n ?? null, "CONTENT_CLAIM_REPEATS",
            { pages: [pages[i].n ?? i + 1, pages[j].n ?? j + 1], claim: String(pages[j].claim).slice(0, 70) },
            CONTENT_THRESHOLDS.claimOverlapMax,
            "Two pages prove the same thing. Merge them, or make the second one prove the next "
            + "step rather than the same step with different evidence."));
        }
      }
    }
  }
  // The one question no page gate asks: does the deck deliver its own answer?
  //
  // Every other gate here judges a page. This judges the deck: a governing
  // answer is written at the top of the file, and unless the claims carry it,
  // the reader gets twenty proofs of things nobody promised. It is also the
  // cheapest place to catch it - before a page exists, against two fields the
  // author has already written.
  const answer = String(content.answer ?? "").trim();
  const question = String(content.question ?? "").trim();
  if (!answer || !question) {
    findings.push(finding(null, "CONTENT_ANSWER_UNCARRIED", { question: Boolean(question), answer: Boolean(answer) },
      "both", "The file needs the `question` the deck is asked and the `answer` it gives, in "
      + "one sentence each. Without them there is nothing for the claims to add up to, and "
      + "nothing to check them against."));
  } else if (pages.length) {
    const claims = pages.map((p) => String(p.claim ?? ""));
    const answerWords = contentWords(answer);
    const union = new Set();
    for (const claim of claims) for (const w of contentWords(claim)) union.add(w);
    let covered = 0;
    for (const w of answerWords) if (union.has(w)) covered += 1;
    const coverage = answerWords.size ? covered / answerWords.size : 0;
    const carried = Math.max(0, ...claims.map((c) => overlap(answer, c)));
    if (coverage < CONTENT_THRESHOLDS.answerCoverageMin || carried < CONTENT_THRESHOLDS.answerCarriedMin) {
      const missing = [...answerWords].filter((w) => !union.has(w));
      // Where to say it, and how close the deck already is: the executive
      // summary's title (the first analytical page) is where a deck states its
      // answer, so the finding names that title rather than leaving the author
      // to guess which one the rule wants.
      const best = pages.map((p) => ({ id: p.id ?? p.n, claim: String(p.claim ?? ""), score: overlap(answer, String(p.claim ?? "")) })).sort((a, b) => b.score - a.score)[0];
      const opener = pages.find((p) => p.role !== "structural" && !p.kind);
      const where = ` State it in the title of ${opener ? `\`${opener.id ?? opener.n}\` (the opening page)` : "the opening page"}; the closest title now is ${best ? `\`${best.id}\`: "${best.claim.slice(0, 90)}"` : "none"}.`;
      // Blocks once the deck is long enough to judge: a deck whose claims do
      // not deliver its own answer is not finished, however good its pages.
      // As an advisory it is read and shipped past. A probe of a few pages
      // hears it as a question.
      findings.push({ rule: "CONTENT_ANSWER_UNCARRIED.coverage", severity: pages.length >= CONTENT_THRESHOLDS.from ? "blocking" : "advisory", ...finding(null, "CONTENT_ANSWER_UNCARRIED",
        { coverage: round(coverage), carried: round(carried), unclaimed: missing.slice(0, 8) },
        { coverage: CONTENT_THRESHOLDS.answerCoverageMin, carried: CONTENT_THRESHOLDS.answerCarriedMin },
        coverage < CONTENT_THRESHOLDS.answerCoverageMin
          ? "The answer promises something no page proves. Either a page has to claim it - "
            + `nothing in this deck claims ${missing.slice(0, 4).map((w) => `"${w}"`).join(", ")} - `
            + "or the answer is wider than the evidence and should be narrowed to what the "
            + "deck can actually settle." + where
          : "No single page states the answer. The claims between them cover it, which means "
            + "the reader can assemble it - but a deck leads with its answer rather than "
            + "leaving it to be inferred from twenty pages. Write the page that says it." + where) });
    }
    const against = contradictions(answer, pages);
    if (against.length) {
      findings.push(finding(against[0].page, "CONTENT_ANSWER_CONTRADICTED",
        { answer: answer.slice(0, 70), pages: against.slice(0, 3) }, "one answer, or a condition on it",
        "The answer is stated flat, and these pages recommend something else. A reader who "
        + "reaches them stops trusting the first page. Either they are wrong and the deck "
        + "should not make them, or the answer is conditional and has to say so: "
        + "\"X, unless <the condition>, in which case Y\" - written on the answer page and in "
        + "the closing takeaway, not left for page 45 to reveal."));
    }
  }

  return {...report(content, findings, pages, options.deck), textCoverage: textCheck};
}

function report(content, findings, pages, deck = content) {
  const kinds = {};
  for (const kind of EVIDENCE_KINDS) kinds[kind] = 0;
  for (const page of pages) {
    const kind = String(page.settles?.kind ?? "qualitative");
    if (kind in kinds) kinds[kind] += 1;
  }
  const counts = {};
  for (const code of Object.keys(CONTENT_CODES)) {
    const n = findings.filter((f) => f.code === code).length;
    if (n) counts[code] = n;
  }
  // A deck revised under older rules hears the rules introduced since as advisories.
  const reported = applyRulesVersion(findings.map((f) => ({ ...f, severity: f.severity ?? (f.code === "CONTENT_NO_HIGHLIGHT" ? "advisory" : "blocking") })), deck ?? {});
  return {
    schema: "professional-slides.content-gates/v1",
    id: content?.id ?? null,
    pages: pages.length,
    statistics: {
      kinds,
      // Declared relationships are not proof of quantitative or substantive evidence.
      quantitativeKindShare: pages.length ? round((kinds.count + kinds.share + kinds.rank + kinds.rate) / pages.length) : 0,
      structuredKindShare: pages.length ? round((kinds.sequence + kinds.comparison + kinds.structure) / pages.length) : 0,
      withAdds: pages.filter((p) => String(p.adds ?? "").trim()).length,
      withHighlight: pages.filter((p) => String(p.highlight ?? "").trim()).length,
    },
    reference: { qualitativeMax: CONTENT_THRESHOLDS.qualitativeMax,
                 answerCoverageMin: CONTENT_THRESHOLDS.answerCoverageMin },
    countsByCode: counts,
    findings: reported,
    accepted: reported.every(f => f.severity !== "blocking"),
  };
}

if (isMain(import.meta.url)) runCli((argv) => {
  const usage = "usage: content_gates.mjs deck.content.json [--report out.json] [--json]";
  const { values, positionals: [file] } = parseCli(argv, { report: { type: "string" }, json: { type: "boolean" } }, { usage });
  if (!file) throw new UsageError(usage);
  const result = runContentGates(readJsonSync(file), { required: true });
  if (values.report) writeJsonSync(values.report, result);
  if (values.json) console.log(JSON.stringify(result, null, 2));
  else {
    const counts = Object.entries(result.countsByCode).map(([c, n]) => `${c}=${n}`).join(", ");
    console.log(`content gates: ${result.accepted ? "accepted" : "REJECTED"} | ${counts || "none"}`);
    for (const f of result.findings.slice(0, 12)) {
      console.log(`  ${f.code}${f.page ? ` p${f.page}` : ""}: ${JSON.stringify(f.measured)}`);
    }
  }
  return result.accepted ? EXIT.ok : EXIT.refused;
});
