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
import { DECK_LENGTH, PLAN, applyRulesVersion, waivedRules } from "../weight.mjs";

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
  CONTENT_ANSWER_UNCARRIED: "the deck's own answer is not proved by its claims, or not stated up front on its opening page",
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
  // The answer gate, three measures on the answer's own content words.
  // `coverage` is the share of them that appear somewhere in the claims: an
  // answer nothing claims is a promise the deck does not keep. The other two,
  // with the opening title's own share of the whole answer (`titleContentShare`
  // below), hold the answer up front, on the opening answer page (the executive
  // summary, or the first analytical page of a deck without one): `upFront`
  // is the share of the answer the page carries as a whole - its title, its
  // points, its highlight and its exhibit's cells - and is the same share the
  // whole deck is held to, since the page that states the answer must hold
  // what the deck must prove; `lead` is the share of the answer's leading
  // clause (its verdict, before the reasons) that the page's title carries.
  // A title is written to twelve words, so it is asked for the verdict and the page
  // for the reasons, the rivals and the thresholds a reasoned answer names.
  answerCoverageMin: 0.6,
  answerUpFrontMin: 0.6,
  answerLeadMin: 0.5,
  // The rule the up-front measures replaced, kept for the decks it was the
  // rule for: a revision recorded under a rules version before the up-front
  // rule hears that rule as an advisory, and is held instead to this - the
  // best single title carries this share of the whole answer's content words -
  // so no deck is held to neither.
  answerCarriedMin: 0.35,
  // What a title can hold. A lead can be a clause that states no verdict
  // ("The board has a clear decision ahead: ..."), and a title that repeats it
  // then leads with nothing; so the opening page's title is also asked for a
  // share of the whole answer, as every deck's best title once was
  // (`answerCarriedMin`) - up to the content words a full-length title holds,
  // so that a long answer is not asked for more than a title can say. A title
  // is written to `plan.titleWords.target` words (weight.json; the most it may
  // run to is longer, for the comparator a finding needs, and is no part of
  // this), and this share of a title's words are content words: the median
  // over the example decks' titles, so a full-length title written as a
  // sentence holds seven of them
  // (test_answer_up_front.py measures the examples against it).
  titleContentShare: 0.6,
  // The fewest content words a leading clause has: under them it is a name or
  // an opener, not a verdict, and the next clause is read with it (answerLead).
  answerLeadWordsMin: 3,
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
  // A page that did not compose (`options.uncomposed`, its ids) has no text to
  // plan, and its composition error is its finding; its claim and its declared
  // content are still the deck's, so every other rule reads every page.
  const pages = content.pages.map((p) => (options.uncomposed?.has(p.id) || options.uncomposed?.has(String(p.id)) ? { ...p, uncomposed: true } : p));
  const textCheck = checkTextPlan({ ...content, pages: pages.filter((p) => !p.uncomposed) }, options);
  findings.push(...textCheck.findings);
  // Where the deck stands against each deck-wide content rule, broken or not
  // (the record variety_gates.mjs writes), for the author's report.
  const standings = [];
  checkPages(findings, pages);
  checkDeckSpread(findings, pages, standings);
  checkAnswerCarried(findings, content, pages, standings, options.deck ?? content);
  return {...report(content, findings, pages, options.deck), textCoverage: textCheck, standings};
}

/** Each page's own content: its claim, what settles it, what its commentary adds, its highlight. */
function checkPages(findings, pages) {
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
}

/** Across a deck long enough to judge: the share of pages that settle nothing measurable, the highlights, and claims that repeat. */
function checkDeckSpread(findings, pages, standings = []) {
  const applies = pages.length >= CONTENT_THRESHOLDS.from;
  const unmeasured = pages.filter((p) => String(p.settles?.kind ?? "qualitative") === "qualitative");
  if (pages.length) standings.push({ code: "CONTENT_UNMEASURED", what: "pages declaring their evidence qualitative", value: round(unmeasured.length / pages.length), bar: CONTENT_THRESHOLDS.qualitativeBlock, side: "max",
    count: unmeasured.length, of: pages.length, applies, blocks: true, pages: unmeasured.map((p) => p.id ?? p.n).filter((x) => x != null) },
  { code: "CONTENT_NO_HIGHLIGHT", what: "pages naming a highlight", value: pages.filter((p) => String(p.highlight ?? "").trim()).length, bar: CONTENT_THRESHOLDS.highlightMin, side: "min", unit: "pages", applies, blocks: false });
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
}

// The clause an answer leads with: its verdict, before the reasons and the
// conditions. It ends at the first sentence end, colon, semicolon or dash, or
// at the conjunction that opens a reason or a condition; an opener with no
// content of its own ("Yes.") is passed over.
//
// The lead is a clause with a verdict in it, not the subject it is about. An
// answer that opens "Subject: verdict" would otherwise lead with the subject
// alone, and a title that only names the subject would carry all of it. So
// the text before a break is read on with the next clause where it is too
// short to say anything (under `answerLeadWordsMin` content words), and the
// text before a colon - a label by construction - wherever it is just a noun
// phrase naming what the answer is about: "Northfield: expand in the north"
// leads with both halves, "The northern lead is narrow: ..." with the first.
//
// Whether the text before a colon says something of its subject is read off
// its shape, not off a list of verbs - verbs are an open class, and a list of
// them read "Harbour remains the region's strongest lender: ..." as a
// label because "remains" was not on it. A noun phrase is one determiner and
// what it governs; a clause carries a predicate, which shows as one of three
// things only a predicate brings, each told by closed-class words:
//   - an auxiliary, a copula, a modal or a negation ("is", "should", "not"),
//     or the "than" of a comparison;
//   - a second noun phrase opening inside it - a determiner, possessive or
//     quantifier that is not its first word and that no preposition or
//     conjunction governs: the object or complement of a verb ("remains THE
//     strongest", "keeps ITS lead", "leads EVERY rival");
//   - the next clause taking its subject up with a subject pronoun ("...: it
//     leads every rival"). A possessive does not: "Northfield retail banking
//     division: its lead is narrow" opens a new subject, of the thing a label
//     has just named.
// A clause that shows none of them - a bare verb over a bare noun, "Alder
// beats Birch: ..." - is read on with the next clause, the stricter reading.
//
// What governs a noun phrase is read off the phrase too, and prepositions are a
// closed class: the list holds all of the common ones, since one left off it
// ("Verdict AFTER all three tests", "Position VERSUS the peers") made a label
// read as a clause. And a determiner over a calendar unit is when, not what: in
// "Answer this quarter for lending", "this quarter" is an adverbial, as
// "last year" or "every month" is, and no verb's object.
const CLAUSE_END = /[.!?;:](?=\s|$)|\s[—–-]\s|,?\s+(?:because|unless|although|though|whereas|provided|given that|so that|as long as|only if|if)\b/i;
const PREDICATE_WORD = /\b(?:is|are|was|were|be|been|has|have|had|will|would|can|cannot|could|should|must|may|might|shall|does|did|do|not|never|than)(?:n't)?\b/i;
const DETERMINERS = new Set(["the", "a", "an", "its", "their", "his", "her", "our", "your", "my", "this", "that", "these", "those", "every", "each", "all", "both", "no", "any", "some", "most", "more", "fewer", "less", "neither", "either", "another"]);
const GOVERNORS = new Set(["of", "in", "on", "at", "by", "for", "with", "to", "from", "into", "onto", "over", "under", "across", "between", "among", "amongst", "amid", "through", "throughout", "during", "against", "within",
  "without", "about", "above", "below", "behind", "beneath", "beside", "besides", "beyond", "per", "via", "as", "and", "or", "nor", "but", "than",
  "after", "before", "since", "until", "till", "versus", "vs", "despite", "toward", "towards", "upon", "around", "along", "alongside", "near", "off", "outside", "inside", "past", "up", "down",
  "underneath", "except", "excluding", "including", "regarding", "concerning", "following", "given", "like", "unlike", "plus", "minus"]);
const CALENDAR_UNITS = new Set(["year", "years", "quarter", "quarters", "month", "months", "week", "weeks", "day", "days", "decade", "decades", "season", "seasons", "half", "term", "period", "cycle", "time"]);
const TAKES_UP = /^\s*(?:it|they|this|these|those|both|each)\b/i;
/** Does `text` say something of its subject - is it a clause, not just a noun phrase naming one (see above). `next` is the text after the colon that ends it. */
function predicates(text, next = "") {
  if (PREDICATE_WORD.test(text) || TAKES_UP.test(next)) return true;
  const words = String(text).toLowerCase().match(/[a-z][a-z']*/g) ?? [];
  return words.some((word, at) => at > 0 && DETERMINERS.has(word) && !GOVERNORS.has(words[at - 1]) && !DETERMINERS.has(words[at - 1]) && !CALENDAR_UNITS.has(words[at + 1]));
}
export function answerLead(answer) {
  const whole = String(answer ?? "").trim();
  let from = 0, at = 0;
  while (at < whole.length) {
    const end = CLAUSE_END.exec(whole.slice(at));
    const stop = end ? at + end.index : whole.length;
    const lead = whole.slice(from, stop).trim();
    const words = contentWords(lead).size;
    // An opener with nothing in it is passed over; a clause that has begun is kept and read on.
    if (!words) from = end ? stop + end[0].length : stop;
    else if (!end || (words >= CONTENT_THRESHOLDS.answerLeadWordsMin && !(end[0].startsWith(":") && !predicates(lead, whole.slice(stop + end[0].length))))) return lead;
    if (!end) break;
    at = stop + end[0].length;
  }
  return whole;
}

/** The content words a full-length title can hold: the title word limit, at the content-word share of a title's words. */
export const titleContentWords = () => Math.floor(PLAN.titleWords.target * CONTENT_THRESHOLDS.titleContentShare);

/** The share of `words` (a set) that `text` carries, and the ones it does not. */
function carriedBy(words, text) {
  const has = contentWords(text);
  const missing = [...words].filter((w) => !has.has(w));
  return { share: words.size ? (words.size - missing.length) / words.size : 0, missing };
}

/**
 * The page a deck states its answer on: the executive summary where the deck
 * has one, otherwise its first analytical page. `whole` is everything the
 * page says to its reader - the claim, the highlight and every planned block
 * but the source line and the runtime's furniture - or null when the page's
 * copy is not there to read yet (a plan that lists no copy, a draft's deferred
 * page, a page that did not compose), where only its title can be held.
 */
function openingPage(pages) {
  const analytical = pages.filter((p) => p.role !== "structural" && !p.kind);
  const at = analytical.findIndex((p) => p.role === "executive-summary");
  const page = analytical[at] ?? analytical[0];
  if (!page) return null;
  // A summary may run on to a second page when the answer has more parts than one page holds: the pages that follow it
  // as summaries are read with it, as the reader reads them, so the answer is carried by the summary as a whole.
  const run = at < 0 ? [page] : analytical.slice(at).filter((p, i, all) => all.slice(0, i + 1).every((q) => q.role === "executive-summary"));
  const written = run.every((p) => Array.isArray(p.textPlan) && !p.deferred && !p.uncomposed);
  const said = (p) => [p.claim, p.highlight, ...(p.textPlan ?? []).filter((b) => !["source", "furniture"].includes(b.role)).map((b) => b.text)];
  return { page, id: page.id ?? page.n, summary: page.role === "executive-summary", title: String(page.claim ?? ""), pages: run.map((p) => p.id ?? p.n),
    whole: written ? run.flatMap(said).flat().filter(Boolean).join(" \n ") : null };
}

// The one question no page gate asks: does the deck deliver its own answer?
//
// Every other gate here judges a page. This judges the deck: a governing
// answer is written at the top of the file, and unless the claims carry it,
// the reader gets twenty proofs of things nobody promised. It is also the
// cheapest place to catch it - before a page exists, against two fields the
// author has already written.
function checkAnswerCarried(findings, content, pages, standings = [], deck = content) {
  const answer = String(content.answer ?? "").trim();
  const question = String(content.question ?? "").trim();
  if (!answer || !question) {
    findings.push(finding(null, "CONTENT_ANSWER_UNCARRIED", { question: Boolean(question), answer: Boolean(answer) },
      "both", `The deck needs ${[!question && "the question it is asked", !answer && "the answer it gives"].filter(Boolean).join(" and ")}: `
      + "in a pages file, `question` (or `brief`) and `answer` on `deck`; in a content plan written by hand, `question` and `answer` at the top. "
      + "Without them there is nothing for the claims to add up to, and nothing to check them against."));
  } else if (pages.length) {
    const claims = pages.map((p) => String(p.claim ?? ""));
    const answerWords = contentWords(answer);
    const { share: coverage, missing } = carriedBy(answerWords, claims.join(" \n "));
    const opening = openingPage(pages);
    const named = opening ? `${opening.pages.map((id) => `\`${id}\``).join(" and ")} (${opening.summary ? `the executive summary${opening.pages.length > 1 ? `, ${opening.pages.length} pages read as one` : ""}` : "the opening page"})` : "the opening page";
    const lead = answerLead(answer);
    const titled = carriedBy(contentWords(lead), opening?.title ?? "");
    const upFront = opening?.whole === null ? null : carriedBy(answerWords, opening?.whole ?? "");
    // The opening title's own share of the whole answer, and the share it is held to: `answerCarriedMin`, or what a full-length title can hold where that is less.
    const inTitle = carriedBy(answerWords, opening?.title ?? "");
    const titleBar = answerWords.size ? Math.min(CONTENT_THRESHOLDS.answerCarriedMin, titleContentWords() / answerWords.size) : 0;
    // Blocks once the deck is long enough to judge: a deck whose claims do
    // not deliver its own answer is not finished, however good its pages.
    // As an advisory it is read and shipped past. A probe of a few pages
    // hears it as a question.
    const severity = pages.length >= CONTENT_THRESHOLDS.from ? "blocking" : "advisory";
    // Where the deck stands against each bar of the answer rule, broken or
    // not: the titles' coverage, the opening title's share of the leading
    // clause, and the opening page's share of the whole answer once its copy
    // is there to read.
    const blocks = severity === "blocking";
    standings.push({ code: "CONTENT_ANSWER_UNCARRIED", key: "coverage", what: "the answer's content words some claim carries", value: round(coverage), bar: CONTENT_THRESHOLDS.answerCoverageMin, side: "min", unit: "share", applies: true, blocks });
    if (opening) standings.push({ code: "CONTENT_ANSWER_UNCARRIED", key: "lead", what: "the answer's leading clause the opening title carries", value: round(titled.share), bar: CONTENT_THRESHOLDS.answerLeadMin, side: "min", unit: "share", applies: true, blocks, pages: [opening.id] });
    if (opening && upFront) standings.push({ code: "CONTENT_ANSWER_UNCARRIED", key: "upfront", what: "the answer's content words the opening page carries", value: round(upFront.share), bar: CONTENT_THRESHOLDS.answerUpFrontMin, side: "min", unit: "share", applies: true, blocks, pages: opening.pages });
    if (opening) standings.push({ code: "CONTENT_ANSWER_UNCARRIED", key: "title", what: "the answer's content words the opening title carries", value: round(inTitle.share), bar: round(titleBar), side: "min", unit: "share", applies: true, blocks, pages: [opening.id] });
    const quoted = (words) => words.slice(0, 6).map((w) => `"${w}"`).join(", ");
    if (coverage < CONTENT_THRESHOLDS.answerCoverageMin)
      findings.push({ rule: "CONTENT_ANSWER_UNCARRIED.coverage", severity, ...finding(null, "CONTENT_ANSWER_UNCARRIED",
        { coverage: round(coverage), unclaimed: missing.slice(0, 8) }, { coverage: CONTENT_THRESHOLDS.answerCoverageMin },
        `The answer promises something no page proves: the page titles between them carry ${Math.round(coverage * 100)}% of the answer's words and the deck is held to ${Math.round(CONTENT_THRESHOLDS.answerCoverageMin * 100)}%. `
        + `Either a page has to claim it - no title in this deck says ${quoted(missing)} - `
        + `or the answer is wider than the evidence and should be narrowed to what the deck can actually settle. State the answer on ${named}, and give each reason it names a page whose title claims it.`) });
    // The answer up front. The title is asked for the verdict and the page
    // for the rest, so an answer with its reasons and thresholds is carried
    // by a summary that states them, whatever its length.
    const short = titled.share < CONTENT_THRESHOLDS.answerLeadMin;
    const thin = upFront !== null && upFront.share < CONTENT_THRESHOLDS.answerUpFrontMin;
    // Compared as counts, so the bar is exact: the title carries `answerCarriedMin` of the answer's words, or as many as a full-length title holds.
    const titleNeeds = Math.min(CONTENT_THRESHOLDS.answerCarriedMin * answerWords.size, titleContentWords());
    const bare = answerWords.size - inTitle.missing.length < titleNeeds - 1e-9;
    if (opening && (short || thin || bare))
      findings.push({ rule: "CONTENT_ANSWER_UNCARRIED.upfront", severity, id: opening.id, ...finding(opening.page.n ?? null, "CONTENT_ANSWER_UNCARRIED",
        { page: opening.id, lead: round(titled.share), title: round(inTitle.share), ...(upFront ? { upFront: round(upFront.share) } : {}), ...(short ? { leadMissing: titled.missing.slice(0, 8) } : {}), ...(bare ? { titleMissing: inTitle.missing.slice(0, 8) } : {}), ...(thin ? { pageMissing: upFront.missing.slice(0, 8) } : {}) },
        { lead: CONTENT_THRESHOLDS.answerLeadMin, title: round(titleBar), upFront: CONTENT_THRESHOLDS.answerUpFrontMin },
        `The deck does not lead with its answer on ${named}. `
        + (short ? `Its title ("${opening.title.slice(0, 90)}") carries ${Math.round(titled.share * 100)}% of the answer's leading clause ("${lead.slice(0, 110)}") and is held to ${Math.round(CONTENT_THRESHOLDS.answerLeadMin * 100)}%: write the verdict in the title in the answer's own words (missing: ${quoted(titled.missing)}). ` : "")
        + (bare ? `Its title carries ${answerWords.size - inTitle.missing.length} of the answer's ${answerWords.size} content words and is held to ${Math.ceil(titleNeeds - 1e-9)} - ${Math.round(CONTENT_THRESHOLDS.answerCarriedMin * 100)}% of them, or the ${titleContentWords()} a full-length title holds where that is fewer: a title that repeats an opening clause which states no verdict leads with nothing, so write what the answer concludes in the title, in the answer's own words (missing: ${quoted(inTitle.missing)}). ` : "")
        + (thin ? `The page as a whole - title, points, highlight and exhibit cells - carries ${Math.round(upFront.share * 100)}% of the answer's words and is held to ${Math.round(CONTENT_THRESHOLDS.answerUpFrontMin * 100)}%: state the answer's reasons, rivals and thresholds in the page's points, in the answer's own words (missing: ${quoted(upFront.missing)}). ` : "")
        + `The answer itself may be as long as its reasons need: the title is asked for its leading clause and for no more of the whole than ${titleContentWords()} of its words. If the answer says something the summary should not, narrow the answer.`) });
    // A revision recorded before the up-front rule hears it as an advisory (report: applyRulesVersion), and is held to the rule it was
    // recorded under instead: one title carries a share of the whole answer. It is the version-3 answer rule, under that rule's name.
    if (waivedRules(deck ?? {}).has("CONTENT_ANSWER_UNCARRIED.upfront")) {
      const best = pages.map((p) => ({ id: p.id ?? p.n, claim: String(p.claim ?? ""), share: overlap(answer, String(p.claim ?? "")) })).sort((a, b) => b.share - a.share)[0];
      const carried = best?.share ?? 0;
      standings.push({ code: "CONTENT_ANSWER_UNCARRIED", key: "carried", what: "the answer's content words the best single title carries (the rule this revision was recorded under)", value: round(carried), bar: CONTENT_THRESHOLDS.answerCarriedMin, side: "min", unit: "share", applies: true, blocks, ...(best ? { pages: [best.id] } : {}) });
      if (carried < CONTENT_THRESHOLDS.answerCarriedMin && coverage >= CONTENT_THRESHOLDS.answerCoverageMin)
        findings.push({ rule: "CONTENT_ANSWER_UNCARRIED.coverage", severity, ...finding(null, "CONTENT_ANSWER_UNCARRIED",
          { coverage: round(coverage), carried: round(carried), unclaimed: missing.slice(0, 8) }, { coverage: CONTENT_THRESHOLDS.answerCoverageMin, carried: CONTENT_THRESHOLDS.answerCarriedMin },
          `No single page states the answer: the closest title${best ? ` (\`${best.id}\`: "${best.claim.slice(0, 90)}")` : ""} carries ${Math.round(carried * 100)}% of the answer's words and this deck, revised under rules version ${Number(deck?.rulesVersion)}, is held to ${Math.round(CONTENT_THRESHOLDS.answerCarriedMin * 100)}%. `
          + `The claims between them cover it, which means the reader can assemble it - but a deck leads with its answer rather than leaving it to be inferred. State it in the title of ${named}. `
          + "(A deck recorded under the current rules is held to the answer up front on its opening page instead; this deck hears that rule as an advisory.)") });
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
  // A finding on a page is judged with the page it names: what a revision's page kept of its slide is read by its id (weight.mjs notHeldOn).
  const idOf = new Map(pages.filter((p) => p.n !== undefined && p.id !== undefined).map((p) => [p.n, p.id]));
  const reported = applyRulesVersion(findings.map((f) => ({ ...f, severity: f.severity ?? (f.code === "CONTENT_NO_HIGHLIGHT" ? "advisory" : "blocking") })), deck ?? {}, (f) => (f.id ?? idOf.get(f.page)));
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
