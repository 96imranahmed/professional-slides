// A page run: the pages a writer names, compiled, composed and gated in the deck's context, and nothing else.
//
//   node runtime/author-deck.mjs <id>.pages.json --check --page <id>[,<id>...] [--json] [--render]
//   node runtime/author-deck.mjs <id>.pages.json --draft --page <id>[,<id>...]
//
// Writers and skeleton agents check their own sections side by side, five to eight pages each, on decks of fifty to a
// hundred pages. A page run that compiled, composed and gated the whole deck cost what the deck cost, and more with every
// check running at once; it printed every deck-wide finding to every section, whose agent then chased codes that were not
// its own; and it rendered nothing while any page of the deck did not compose, so a section could not be reviewed beside
// the others' writing. A page run therefore reads the deck as far as its pages need it, and no further:
//
//   compiled, composed, gated   the pages it names, among the deck's structural pages - the cover, each section and
//                               contents page, which set the tracker over a page and where its body starts: a pages
//                               document of their own (pageContext). The deck block, its conventions, players, sources
//                               and insight log are read whole, as every run reads them.
//   read off declarations       every other page. Its place in the deck, which the pages print and a reference to it
//                               resolves to (`places`); the layouts the analytical pages before a named page take, which
//                               the composer breaks a tie on variety by (`between`); and, stood in for by its declared
//                               choices as a page that does not compile is (author-deck.mjs withStandIns), what the rules
//                               that read a page against its neighbours read of it (PAGE_RUN_HOLDS).
//   the whole-deck run's        every rule over the deck as a whole - its structure's shares, caps and floors and its
//                               aggregates - said in one line (deckRulesLine), and any rule that names a page and needs
//                               what a page run does not compile or compose (WHOLE_DECK_ONLY).
//
// So its cost is its pages' and not the deck's, and of the pages it names it reports what the whole-deck run reports of
// them, page-local finding for page-local finding, with the held cross-page findings that name them
// (evals/tests/test_page_run.py holds the two runs to one another, and the cost to the pages named).
import { GATE_CLASSES } from "./gates/gate_classes.mjs";
import { declaredPlaces } from "./compose-deck.mjs";
import { withPages } from "./pages-file.mjs";
import { pagesOf } from "./deck-report.mjs";

/**
 * The rules over more than one page that a page run holds, each read with its
 * neighbours as they declare themselves: what the rule reads of them. Every
 * page-local rule (class P) is held too, read on the page as composed.
 */
export const PAGE_RUN_HOLDS = Object.freeze({
  VARIETY_TYPE_RUN: "the page types in a row, read off each page's declared type",
  HEADLINE_CROWDED: "the headline figures in ten consecutive analytical pages, read off each page's declared architecture",
  CONTENT_CLAIM_REPEATS: "a claim another page makes too: every page's declared title, and the reading of all of them at once the whole-deck run recorded (claims-repeat), which a page run reads and does not ask",
  NUMBERS_DISAGREE: "one number given two values on two pages, read off what each page states and the insight log",
  NUMBER_FORMATS_DIFFER: "one value printed at two precisions or scales on two pages",
  NUMBER_STALE: "a number a revision changed on one page and left standing on another",
  WORDING_STALE: "words a revision changed on one page and left standing on another",
  BRIDGE_UNRECONCILED: "what two pages print that is said to add up and does not",
  PROOF_REPEATS: "a proof an earlier page already gave, read off the bases each page declares and the measures they bind",
  SPINE_LOCKED: "the page's own argument and its place in the deck's order as declared, against the storyline the critique closed",
  // A page's own evidence against the insights each part file declares it holds (allocation.mjs): no other page is read.
  EVIDENCE_ELSEWHERE: "an insight the page builds on that another section's part file holds",
  EVIDENCE_UNHOMED: "an insight the page builds on that no section's part file holds",
});

/**
 * The rules that name a page and that a page run leaves to the whole-deck run,
 * each with why: a rule that reads its neighbours as composed, which no
 * declaration says. A page run says which they are, in its one line on the
 * deck's rules. (Every other rule over the deck reads a share, a cap or a
 * floor of the whole deck, and names no page as its own.)
 */
export const WHOLE_DECK_ONLY = Object.freeze({
  PAGE_SHAPE_FLAT: "it names the pages that share the deck's commonest architecture, each measured on the page as composed",
});

/** Whether a page run holds finding `f`: a page-local rule, or one PAGE_RUN_HOLDS reads off the neighbours' declarations. */
export const heldOnPageRun = (f) => GATE_CLASSES[f.code] === "P" || Object.hasOwn(PAGE_RUN_HOLDS, f.code);

/** The deck-level rules a page run does not read: every structure and aggregate rule but the ones it holds. */
export const DECK_RULES = Object.freeze(Object.keys(GATE_CLASSES).filter((code) => ["S", "G"].includes(GATE_CLASSES[code]) && !Object.hasOwn(PAGE_RUN_HOLDS, code)
  // The questions a run leaves open are this run's own, said with every run.
  && code !== "JUDGEMENTS_PENDING"));

/**
 * What a page run says, in one line, of the rules it leaves to the whole-deck
 * run: how many, what they are about, and the command that holds them.
 */
export function deckRulesLine(file) {
  const named = Object.entries(WHOLE_DECK_ONLY);
  return `${DECK_RULES.length} deck-level rules are the whole-deck run's and are not read on a page run - the deck's structure (its type, form, placement and kind shares, caps and floors, the page shapes) and its aggregates (evidence depth, the craft rates, density): \`node runtime/author-deck.mjs ${file} --check\` holds them` +
    (named.length ? `; among them, deferred here though ${named.length === 1 ? "it names" : "they name"} pages: ${named.map(([code, why]) => `${code} (${why})`).join("; ")}` : "");
}

// The kinds of page the composer gives a fixed shape (compose-page.mjs KINDS): they take no layout and leave its memory as it is.
const FIXED = new Set(["section", "agenda", "statement", "takeaways", "cover"]);
// How many of the analytical pages before a page a page run reads the layouts of: the composer remembers four, and the
// layout an analytical page takes where it breaks a tie reads the four before it in turn.
const RECALL = 8;
const isPage = (page) => page && typeof page === "object";
const structural = (page) => isPage(page) && ["section", "agenda"].includes(page.kind);

// A deck whose navigation the composer refuses (an unknown tracker) is refused on the run's own pages, as it is on every page.
const placesOf = (spec) => { try { return declaredPlaces(spec); } catch { return {}; } };

/**
 * The context a page run reads its pages in. `named` is the set of page ids it
 * names. Returns:
 *
 *   doc       the pages document of the named pages among the deck's structural
 *             pages, each where it stands, read as the pages file was (pages-file.mjs
 *             withPages): what the run compiles, composes and gates
 *   ids       the ids of that document's pages
 *   places    every page's place in the deck as declared (compose-deck.mjs declaredPlaces)
 *   appendix  whether the deck has an appendix: its divider is a section of the deck
 *   order     every page id in deck order, `indexOf` each id's place in it
 *
 * A page with no id is given the one the compile gives it, from its place in
 * the deck (`page-<n>`), so the context names it as the deck does.
 */
export function pageContext(doc, named) {
  const at = (page, index) => (isPage(page) && page.id === undefined ? { ...page, id: `page-${index + 1}` } : page);
  const pages = doc.pages.map((page, index) => at(page, index)), appendix = (doc.appendix || []).map((page, index) => at(page, doc.pages.length + index));
  const keep = (page) => structural(page) || (isPage(page) && named.has(String(page.id)));
  const context = withPages(doc, { pages: pages.filter(keep), appendix: doc.appendix === undefined ? undefined : appendix.filter(keep) });
  const order = [...pages, ...appendix].map((page, index) => (isPage(page) ? String(page.id) : `page-${index + 1}`));
  return { doc: context, named, ids: new Set([...context.pages, ...(context.appendix || [])].filter(isPage).map((page) => String(page.id))),
    places: placesOf({ ...doc.deck, slides: pages.filter(isPage), appendix: appendix.filter(isPage) }), appendix: appendix.length > 0,
    order, indexOf: new Map(order.map((id, index) => [id, index])) };
}

/**
 * For each page of a page run's deck that composes (`composed`, its ids), the
 * analytical pages of the deck it does not compose that stand between that
 * page and the one before it, the last RECALL of them, as `slides` - the deck
 * in order, each other page stood in for by its declared choices - holds them:
 * the composer sets the layouts they take in its memory before the page
 * (compose-deck.mjs `pageRun.between`). A page of the context that did not
 * compose is in neither deck's memory.
 */
export function layoutsBetween(slides, { context, composed }) {
  const between = {};
  let gap = [];
  for (const slide of slides) {
    if (!isPage(slide) || FIXED.has(slide.kind)) continue;
    const id = String(slide.id);
    if (composed.has(id)) { if (gap.length) between[id] = gap.slice(-RECALL); gap = []; continue; }
    if (context.has(id)) continue;
    const { pageType: _record, ...drawn } = slide;
    gap.push(drawn);
  }
  return between;
}

/** Whether finding `f` is one of the named pages' to answer: it names one of them. */
export const namesOneOf = (f, named) => pagesOf(f).some((id) => named.has(id));
