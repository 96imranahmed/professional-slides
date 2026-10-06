// The class of every finding code, and the order a run reports them in.
//
// Page-local rules and deck-level rules both bind, and the order an author
// meets them in decides how much work is thrown away. Polishing a page and
// then learning that a deck rule forces it into another form wastes the
// polish; a deck rule over measured quantities cannot be read before the
// pages exist. So every code the runtime can emit belongs to one class, and a
// run (author-deck.mjs) reports them in class order:
//
//   S  deck structure   a function of the pages' descriptors alone - type,
//                       form, commentary placement, exhibit kinds, sections
//                       and their order, the page count, a summary or players
//                       page being there, the insights a page rests on.
//                       Evaluated first and on every run, in a draft too, and
//                       from the declared choices (marked provisional) for a
//                       page that did not compile or compose: a failure here
//                       changes which page takes which form.
//   P  page-local       needs one page, its evidence and the deck's constants:
//                       compile refusals, composition, the scene's voids, ink
//                       and words, the dependency and chart-form rules.
//   G  deck aggregate   a rule over what the composed or rendered pages
//                       measure - a median, a rate, a count of half-empty
//                       pages. Evaluated last, and every run prints each
//                       page's own contribution and where the deck stands.
//   R  review           raised after the build by the storyline critique, the
//                       reviewers, the claim ledger or delivery; no compile
//                       reports one.
//
// One registry, here: a test fails when a vocabulary holds a code this file
// does not class, or this file classes a code no vocabulary holds.

export const CLASSES = Object.freeze({
  S: "Deck structure - what the pages' types, forms, placements, sections and evidence add up to; a change here changes which page takes which form, so settle it first",
  P: "Page-local - each page against its own evidence and the deck's constants",
  G: "Deck aggregates - measured across the composed pages; each page's line says where it pulls one",
  R: "Review - raised after the build by the critique, the reviewers or delivery",
});

/** The classes a compile reports, in report order. */
export const CLASS_ORDER = Object.freeze(["S", "P", "G"]);

// What a finding's repair writes, beside its class: the third thing every code says of itself.
//
// A draft is the spine, written before its copy, and the storyline critique
// is then bound to it (storyline.mjs BOUND_FIELDS: the request, the answer,
// the pages and their order, each title, type, `settles`, `evidence`, every
// `basis`, the view of each measure, and the record). So a draft may leave to
// the full compile only what is mended without touching any of that:
//
//   copy    the page's words - points, captions, headings, callouts, a note
//           or a citation - and the marks made on an exhibit
//   layout  the page's form and commentary placement, a chart's form within
//           its class, devices, treatments and the deck's settings; and an
//           exhibit the spine has not drawn yet
//   fit     how much the composed page holds: bands left empty, words against
//           a floor or a ceiling, a line that wraps
//
// Every code lists what its repair can write, in those three words and in the
// names of the binding's fields. A finding every repair of which writes a
// bound field blocks in a draft: mended after the critique is ready, it would
// reopen it. One that lists both is decided where it is raised, by proof - an
// allocation of forms the plan found, an exhibit composed with placeholder
// copy - and the emitter says which (`touches` on the finding); unproven, it
// waits for the full compile. Review codes are raised after the build and
// list nothing.
export const SETTLED_LATER = Object.freeze({
  copy: "the copy",
  layout: "the layout",
  fit: "the fit",
});
const COPY = ["copy"], LAYOUT = ["layout"], FIT = ["fit"];
const codes = (cls, list, repairs = []) => list.split(/\s+/).filter(Boolean).map((code) => [code, cls, Object.freeze([...repairs])]);

const LISTED = [
  // --- S: deck structure -------------------------------------------------
  // The variety contract (variety_gates.mjs): which page takes which form. A form or a placement mends most of it; where no
  // allocation of them does, only another page type, or another page, can (deck-structure.mjs allocateStructure decides which).
  ...codes("S", `PAGE_TYPE_EDITED VARIETY_COMMENTARY VARIETY_TAKEAWAY VARIETY_PANELS VARIETY_COLUMN VARIETY_SIGNATURE VARIETY_EXHIBIT_MIX
    VARIETY_EXHIBIT_RANGE VARIETY_TABLES VARIETY_TYPE_RUN PLAYERS_UNMARKED`, ["layout", "type", "pages"]),
  ...codes("S", "PAGE_TYPE_UNDECLARED VARIETY_TYPE_SHARE VARIETY_TYPE_RANGE", ["type", "pages"]),
  // How the exhibits are shared between kinds, and the pages drawn in a form that carries their claim less directly than another
  // of their type (variety_gates.mjs fitStandings): advised, and mended by a form within the type - the layout's.
  ...codes("S", "VARIETY_KIND_SHARE VARIETY_FIT_UNUSED", LAYOUT),
  // The spine (author-deck.mjs, review-passes.mjs): the request, the titles, the insights and analyses the pages rest on.
  ...codes("S", "TITLE_GAP_SHARE", ["title"]),
  ...codes("S", "GENERATOR_SIGNATURE", ["copy", "settles"]),
  ...codes("S", "PILLAR_UNSUPPORTED", ["evidence", "pages", "record"]),
  ...codes("S", "REVISION_UNMAPPED", ["type"]),
  // A revision's carried slides (revision.mjs): the source deck they are copied from and the size its slides are. A carried
  // page is the user's slide, so what mends it is the page as authored.
  ...codes("S", "REVISION_SOURCE_MISSING REVISION_SLIDE_SIZE REVISION_RULES_VERSION", LAYOUT),
  ...codes("S", "CONTENTS_UNFIT", ["layout", "pages"]),
  ...codes("S", "MEASURES_MISSING MEASURES_CONFLICT ANALYSIS_REQUIRED", ["record"]),
  ...codes("S", "ANALYSIS_UNRESTED", ["evidence"]),
  ...codes("S", "SOURCES_UNFILED", ["record"]),
  // The argument as the storyline critique closed it (storyline.mjs spineLock): put back, or reopened on purpose.
  ...codes("S", "SPINE_LOCKED", ["title", "type", "settles", "evidence"]),
  ...codes("S", "REQUEST_MISSING", ["request"]),
  ...codes("S", "STATEMENT_INVALID", ["request", "answer"]),
  ...codes("S", "REVISION_INVENTORY_MISSING WAIVERS_INVALID", LAYOUT),
  // What the build would fetch for the deck, and its declaration that it is built without the network (asset-needs.mjs).
  ...codes("S", "ASSETS_NEEDED ASSETS_OFFLINE", LAYOUT),
  // The content plan's rules on the claims the pages make between them (content_gates.mjs).
  ...codes("S", "CONTENT_UNMEASURED", ["settles"]),
  ...codes("S", "CONTENT_CLAIM_REPEATS", ["title", "pages"]),
  ...codes("S", "CONTENT_ANSWER_UNCARRIED CONTENT_ANSWER_CONTRADICTED", ["title", "answer", "copy"]),
  // What the pages state between them (consistency_gates.mjs): a number written two ways is mended in the copy or in the record,
  // a proof shown twice by another view of the measure or one page fewer.
  ...codes("S", "NUMBERS_DISAGREE NUMBER_STALE", ["copy", "record"]),
  ...codes("S", "NUMBER_FORMATS_DIFFER WORDING_STALE", COPY),
  ...codes("S", "PROOF_REPEATS", ["view", "pages"]),
  // The plan record, which is the pages' declared choices (plan_gates.mjs); one step diagram too many is a count of forms.
  ...codes("S", `PLAN_SCHEMA PLAN_TITLE_LENGTH PLAN_TABLE_SHARE PLAN_MEASURED_PAGES PLAN_EXHIBIT_MIX PLAN_EXHIBIT_RUN PLAN_STYLE_ENTROPY
    PLAN_NO_PICTURES PLAN_NO_ICONS PLAN_NO_INSIGHT PLAN_TABLE_DEPTH PLAN_TABLE_MONOTONY PLAN_UNANNOTATED_CHARTS PLAN_NO_HIGHLIGHT
    PLAN_EXHIBIT_VARIETY PLAN_CHART_MONOTONY CRAFT_STEP_OVERUSE`, ["layout", "type", "pages"]),
  // The page gates' rules on sections, front matter and the page's architecture (gates/deck_gates.py), and the build's on the stages.
  ...codes("S", "PAGE_SHAPE_FLAT", ["layout", "type", "pages"]),
  // A summary, sections and unique ids are pages of the deck; the criteria a page serves and an evaluation's length are read off pages still to be drawn.
  ...codes("S", "NO_SUMMARY NO_SECTIONS NO_CONTENTS STAGE_CONTRACT", ["pages"]),
  ...codes("S", "MISSING_EVIDENCE EVALUATION_TOO_SHORT", ["layout", "pages"]),
  ...codes("S", "STAGE_MISSING CONTENT_REJECTED PLAN_REJECTED VARIETY_REJECTED SLIDE_COUNT TEXT_EXPORT_PAGE_COUNT", LAYOUT),

  // --- P: page-local -----------------------------------------------------
  // Compile and composition (author-deck.mjs, page-types.mjs). A page that does not compile is refused in every mode; one that does
  // not compose waits on its copy and its layout, unless an exhibit the spine fully determines cannot be drawn (SPINE_UNDRAWABLE).
  ...codes("P", "COMPILE", ["copy", "layout", "title", "type", "settles", "evidence", "basis", "view"]),
  ...codes("P", "PAGE_DOES_NOT_COMPOSE", ["copy", "layout", "fit", "view"]),
  ...codes("P", "TITLE_COUNT_ONLY", ["title"]),
  ...codes("P", "PAGE_SPLITS", ["layout", "view"]),
  // Commentary declared beside the exhibit and drawn under it (author-deck.mjs): the copy, or the declared placement.
  ...codes("P", "COMMENTARY_MOVED", ["copy", "layout"]),
  // A carried slide that cannot be carried as its page is written, and one the built file does not hold byte for byte (revision.mjs).
  ...codes("P", "REVISION_CARRY_INVALID", ["copy", "title", "type"]),
  ...codes("P", "REVISION_CARRY_DRIFT", LAYOUT),
  ...codes("P", "POINT_UNMARKED", COPY),
  ...codes("P", `MAP_COARSE TOTAL_ROW_BLANK TABLE_TOO_SHORT TABLE_PANELS_MERGE TABLE_STACK COMPARISON_MEASURES_DIFFER TIME_AXIS_UNEVEN VERDICT_TABLE_PLAIN
    SCENARIO_PROSE SHARES_IN_TILES PROFILE_UNPICTURED SCATTER_OVER_TIME SCATTER_CURVE LABELS_OFF GUTTER_UNEARNED PILL_NO_VERDICT TILES_ONE_MEASURE
    STRIP_REPEATS_CHART NUMBER_CARDS`, ["layout", "copy", "view"]),
  // What each claim and exhibit rests on (dependency_gates.mjs): the declared facts the critique is bound to. A relation shown
  // on one scale is one exhibit in place of two, which on a page of panels is another page type.
  ...codes("P", "CLAIM_MEASURES_MISSING RELATION_UNDECLARED", ["settles"]),
  ...codes("P", "RELATION_SPLIT", ["settles", "type"]),
  ...codes("P", "BASIS_MISSING CONTEXT_UNEXPLAINED", ["basis"]),
  ...codes("P", "BASIS_UNKNOWN", ["basis", "settles", "evidence"]),
  ...codes("P", "BASIS_UNIT BASIS_AXIS BASIS_VALUES", ["basis", "view"]),
  ...codes("P", "PROOF_OFF_CLAIM PROOF_MISSING", ["basis", "settles"]),
  ...codes("P", "SOURCE_UNCITED", COPY),
  // A reference the runtime cannot write out, and a typed number no measure of the page's evidence holds (bind.mjs).
  ...codes("P", "BINDING_UNRESOLVED", ["basis", "view"]),
  ...codes("P", "NUMBER_UNTRACED", COPY),
  // What the critique binds, proven layable at the spine (spine-fit.mjs): a title that does not fit where the deck's design sets
  // it, an exhibit the spine fully determines that no chart can draw, and a summary that cannot fill its page as declared.
  ...codes("P", "SPINE_UNFIT", ["title"]),
  ...codes("P", "SPINE_UNDRAWABLE", ["view", "type"]),
  ...codes("P", "SPINE_UNFILLED", ["basis"]),
  // A page whose witness - the spine completed with only copy and unbound content (spine-witness.mjs) - the critique would read
  // differently from the spine: what mends it is the view the spine declares, or the exhibit written at the spine.
  ...codes("P", "SPINE_UNDETERMINED", ["view", "basis"]),
  // The page's copy (content_gates.mjs, text-contract.mjs, content-audit.mjs, craft_gates.mjs, plan_gates.mjs).
  ...codes("P", "CONTENT_SCHEMA", ["title", "settles"]),
  ...codes("P", "CONTENT_NO_CLAIM", ["title"]),
  ...codes("P", `TEXT_PLAN_INCOMPLETE TEXT_REFERENCE_MISSING TEXT_COVERAGE_LOW TEXT_BLOCK_TOO_LONG TEXT_TASK_MISMATCH
    CONTENT_ADDS_NOTHING TEXT_PAGE_UNPLANNED TEXT_PAGE_MISSING TEXT_PLAN_PAGINATION TEXT_PLAN_LOST
    TEXT_UNPLANNED TEXT_EXPORT_LOST TEXT_EXPORT_UNPLANNED TEXT_PLAN_CHANGED CRAFT_SOURCE_CODES PLAN_EXHIBIT_REASON`, COPY),
  ...codes("P", "CONTENT_LAYOUT_LEAK CONTENT_LOST MISSING_VISUAL_INTENT MISSING_AUTHORED_CONTENT PLAN_VISUAL_ANCHOR", LAYOUT),
  // The composed scene and its render (gates/page_gates.py, validate-overlap.mjs): what the page holds, and what its words and marks say.
  ...codes("P", "TITLE_LINES TITLE_WORDS TITLE_COUNT", ["title"]),
  ...codes("P", `INK_COVERAGE DEAD_BAND INTERNAL_VOID COLUMN_VOID TYPE_RANGE CPL TAKEAWAY_LONG WORDS HERO_EXHIBIT HEADING_WRAPS THIN_PAGE NOTE_HEAVY
    THIN_COLUMN PLOT_SPAN THIN_TABLE THIN_EVIDENCE MISSING_RENDER SCENE_VOID RENDER_DRIFT SCENE_INK TEXT_ON_LINE TEXT_ON_TEXT TEXT_ON_EDGE DESCENDER_ON_RULE`, FIT),
  ...codes("P", "MISSING_ARGUMENT POINT_DEPTH UNANNOTATED TWIN_CELLS RESTATEMENT PLANNING_VOICE CAVEAT_HEAVY CONTRADICTED_SHARE", COPY),
  ...codes("P", "METRIC_STACK NUMBERS_ON_MARKS NICE_TICKS UNSOURCED_PICTURE UNSCALED_FIGURE SCATTER_UNKEYED", LAYOUT),
  // The saved file read back against the scene (emit/readback_pptx.py).
  ...codes("P", `CANVAS_COLOR WRAP_NONE MISSING_SHAPE FRAME_DRIFT NO_TEXT_FRAME NO_AUTOFIT PARAGRAPH_COUNT TEXT_MISMATCH TITLE_NOT_PLACEHOLDER
    MISSING_NATIVE_CHART SERIES_COUNT NATIVE_AXIS_DRIFT HIDDEN_STATE`, LAYOUT),

  // --- G: deck aggregates ------------------------------------------------
  // What the chart pages plot is what the spine says each shows of its measures; a form that reads more of them is the layout's.
  ...codes("G", "EVIDENCE_DEPTH", ["layout", "view"]),
  ...codes("G", "CONTENT_NO_HIGHLIGHT DECK_FLAT DECK_CRAFT TEXT_FRAGMENTED COMMENTARY_UNDEVELOPED CRAFT_CHARTS_BARE CAVEAT_DENSE", COPY),
  ...codes("G", `LAYOUT_MONOTONY PAGE_VARIETY COLUMN_MONOTONY EVIDENCE_MIX IMAGE_BUDGET IMAGE_RUN TABLE_SCHEMA_FLAT DECK_VOCABULARY
    CRAFT_TRIVIAL_CHARTS CRAFT_NO_TREND CRAFT_TABLES_PLAIN CRAFT_NO_ICONS CRAFT_NO_PICTURES CRAFT_PLAYERS_UNINTRODUCED
    CRAFT_EXHIBIT_VARIETY BAR_EXHIBIT_VARIETY BAR_TABLES_TREATED BAR_CHARTS_ANNOTATED BAR_DRAWINGS_PER_PAGE BAR_UNSOURCED_PICTURES
    READBACK_MISSING PREFLIGHT_FAILED GATES_FAILED`, LAYOUT),
  ...codes("G", "DECK_THIN_PAGES DECK_SCENE_VOID DECK_INK", FIT),

  // --- R: review and delivery --------------------------------------------
  // The storyline critique, the claim ledger and delivery (storyline.mjs, claims.mjs, deliver-deck.mjs).
  ...codes("R", `MISSING_ANALYSIS CUT_PAGE MERGE_PAGES SUMMARY_UNPROVED SELF_CHECK_INCOMPLETE MISSING_RENDERED_GATES STORYLINE_UNREVIEWED
    REVIEW_PASS_CAP INVALID_REVIEW REVIEW_RATING REVIEW_PROVENANCE REVIEW_UNCONFIRMED LINEAGE_RESTART`),
  // What a reviewer raises reading the rendered deck (reviewer.mjs).
  ...codes("R", `FACTUAL_ERROR UNSUPPORTED_CLAIM MISLEADING_COMPARISON UNCLEAR_ARGUMENT UNREADABLE OVERFLOW BROKEN_GEOMETRY PROVENANCE DEAD_SPACE
    NO_HERO_EXHIBIT OVERSIZED_TYPE WALL_OF_TEXT BURIED_NUMBER HEDGED_TITLE INCONSISTENT_ENCODING NO_VISUAL_ANCHOR UNANNOTATED_PLOT TABLE_MONOTONY
    MIXED_GRAMMAR DECORATION NARROW_REPERTOIRE TRIVIAL_CHART NO_INSIGHT_CHART DEVICE_OVERUSE FLAT_TABLE MISSING_CONTEXT MAP_DESIGN DENSITY_MISMATCH EDITORIAL`),
];
// One class a code: a code on two lists would silently keep the last.
const twice = LISTED.map(([code]) => code).filter((code, at, all) => all.indexOf(code) !== at);
if (twice.length) throw new Error(`gates/gate_classes.mjs lists ${[...new Set(twice)].join(", ")} under two classes`);
export const GATE_CLASSES = Object.freeze(Object.fromEntries(LISTED.map(([code, cls]) => [code, cls])));
/** What the repair of each structure, page and aggregate code can write: `copy`, `layout`, `fit`, or the binding's fields (see above). */
export const REPAIRS = Object.freeze(Object.fromEntries(LISTED.filter(([, cls]) => cls !== "R").map(([code, , repairs]) => [code, repairs])));

/**
 * What a finding's repair can write: what the emitter proved of this finding
 * (`touches`), or what its code lists. `settledLater` is the first of copy,
 * layout and fit among them - what a draft says the finding waits on - or
 * null where every repair writes a field the critique is bound to.
 */
export function repairOf(finding) {
  const touches = Array.isArray(finding.touches) ? finding.touches : REPAIRS[finding.code] ?? [];
  return { touches, settledLater: Object.keys(SETTLED_LATER).find((kind) => touches.includes(kind)) ?? null };
}

// What the repair of a review finding changes, in the words a reviewer picks
// from (`touches` on a deck-review finding, reviewer.mjs), and what each
// writes in the registry's own words above. A reviewer reads the rendered
// page, so it says what its repair changes there; the registry says whether
// that is the layout's - done again freely on a `ready` critique - or a fact
// the critique is bound to, which reopens it.
export const REVIEW_TOUCHES = Object.freeze({
  copy: { writes: COPY, about: "the page's words - points, captions, headings, callouts, a note, a source line - and the marks made on an exhibit: an annotation, a highlight, a label" },
  layout: { writes: [...LAYOUT, ...FIT], about: "how the page is drawn: its form, where its commentary sits, a chart's form within charts (a line as columns), a table's treatment, spacing, sizes and alignment" },
  "exhibit-view": { writes: ["view", "basis"], about: "what an exhibit shows: a measure, period or member added or dropped, or a chart swapped for a table or a figure" },
  title: { writes: ["title"], about: "a page's title or a section's" },
  claim: { writes: ["settles", "answer"], about: "what a page claims or what settles it, or the governing answer" },
  evidence: { writes: ["evidence", "record"], about: "the insights, analyses or recorded numbers a page rests on" },
  structure: { writes: ["pages", "type"], about: "the pages themselves: one added, cut, merged, moved, or given another page type" },
});
// What the repair of each of the reviewer's own codes can write, for a finding
// that does not say (`touches` absent: a review recorded before the field, or
// an item the runtime files itself, such as a density verdict). A reviewer's
// own statement always stands in its place.
const REVIEW_REPAIRS = Object.freeze(Object.fromEntries([
  ...codes("R", "PROVENANCE DENSITY_MISMATCH EDITORIAL UNANNOTATED_PLOT", COPY),
  ...codes("R", "UNREADABLE OVERFLOW BROKEN_GEOMETRY DEAD_SPACE", [...LAYOUT, ...FIT]),
  ...codes("R", "NO_HERO_EXHIBIT OVERSIZED_TYPE INCONSISTENT_ENCODING NO_VISUAL_ANCHOR TABLE_MONOTONY MIXED_GRAMMAR DECORATION FLAT_TABLE MAP_DESIGN", LAYOUT),
  ...codes("R", "WALL_OF_TEXT BURIED_NUMBER", ["copy", "layout"]),
  ...codes("R", "NARROW_REPERTOIRE DEVICE_OVERUSE", ["layout", "type"]),
  ...codes("R", "TRIVIAL_CHART NO_INSIGHT_CHART", ["layout", "copy", "view"]),
  ...codes("R", "MISSING_CONTEXT", ["layout", "pages"]),
  ...codes("R", "HEDGED_TITLE", ["title"]),
  ...codes("R", "FACTUAL_ERROR", ["copy", "title", "record"]),
  ...codes("R", "UNCLEAR_ARGUMENT", ["copy", "title", "settles"]),
  ...codes("R", "UNSUPPORTED_CLAIM", ["title", "settles", "evidence"]),
  ...codes("R", "MISLEADING_COMPARISON", ["copy", "view", "basis"]),
].map(([code, , repairs]) => [code, repairs])));

/**
 * What the repair of a deck-review finding writes: `{ stated, touches,
 * settledLater }`. `stated` is true where the reviewer said it (`touches`, in
 * REVIEW_TOUCHES's words) and `touches` is then everything that repair
 * writes, in the registry's words; otherwise `touches` is what a repair of
 * the finding's code can write - a gate's code by REPAIRS, the reviewer's own
 * by REVIEW_REPAIRS, and nothing for a code neither lists. `settledLater` is
 * repairOf's: the first of copy, layout and fit among them, or null.
 */
export function reviewRepairOf(finding) {
  const words = Array.isArray(finding?.touches) ? finding.touches.filter((word) => Object.hasOwn(REVIEW_TOUCHES, word)) : [];
  const touches = words.length ? [...new Set(words.flatMap((word) => REVIEW_TOUCHES[word].writes))] : REPAIRS[finding?.code] ?? REVIEW_REPAIRS[finding?.code] ?? [];
  return { stated: words.length > 0, ...repairOf({ touches }) };
}

/** The class of `code`. A code no class holds is a bug in this registry, and throws. */
export function classOf(code) {
  const cls = GATE_CLASSES[code];
  if (!cls) throw new Error(`Unclassified finding code: ${code}; give it a class in gates/gate_classes.mjs`);
  return cls;
}

// The page-local findings that say a page does not fit the layout its form
// and commentary placement chose: it does not compose, a band of it stands
// empty, its words fall short of the floor or past the ceiling its placement
// sets. For these the compiler tries the type's other forms and placements
// itself (fit-search.mjs) - the remedy is usually another layout for the same
// content, and finding it by hand costs a run a try.
export const LAYOUT_CODES = Object.freeze(new Set(["PAGE_DOES_NOT_COMPOSE", "SCENE_VOID", "DEAD_BAND", "INTERNAL_VOID", "COLUMN_VOID",
  "TEXT_COVERAGE_LOW", "THIN_PAGE", "THIN_COLUMN", "INK_COVERAGE", "HERO_EXHIBIT", "WORDS", "TITLE_LINES", "HEADING_WRAPS", "CPL",
  "PLOT_SPAN", "THIN_TABLE", "NOTE_HEAVY", "TEXT_ON_LINE", "TEXT_ON_TEXT", "TEXT_ON_EDGE"]));

// Every structure and aggregate rule says where the deck stands against it on
// every run (`standing`, below) - except these, which have no quantity to
// have room in. Each says why.
const reasons = (why, list) => list.split(/\s+/).filter(Boolean).map((code) => [code, why]);
export const STANDING_FREE = Object.freeze(Object.fromEntries([
  ...reasons("holds or fails on a named statement, insight, analysis, section or file; nothing is counted toward a bar", `GENERATOR_SIGNATURE PILLAR_UNSUPPORTED
    REVISION_UNMAPPED REVISION_INVENTORY_MISSING REVISION_SOURCE_MISSING REVISION_SLIDE_SIZE REVISION_RULES_VERSION MEASURES_MISSING MEASURES_CONFLICT ANALYSIS_REQUIRED ANALYSIS_UNRESTED SOURCES_UNFILED SPINE_LOCKED REQUEST_MISSING WAIVERS_INVALID STATEMENT_INVALID
    CONTENT_CLAIM_REPEATS CONTENT_ANSWER_CONTRADICTED PLAN_SCHEMA MISSING_EVIDENCE STAGE_CONTRACT STAGE_MISSING SLIDE_COUNT TEXT_EXPORT_PAGE_COUNT
    NUMBERS_DISAGREE NUMBER_STALE WORDING_STALE NUMBER_FORMATS_DIFFER PROOF_REPEATS`),
  ...reasons("an advisory on the families a plan declares; the variety contract and the craft floors hold the same quantity on the compiled deck, and theirs is the standing", `PLAN_TITLE_LENGTH
    PLAN_TABLE_SHARE PLAN_MEASURED_PAGES PLAN_EXHIBIT_MIX PLAN_EXHIBIT_RUN PLAN_NO_PICTURES PLAN_NO_ICONS PLAN_NO_INSIGHT PLAN_TABLE_DEPTH PLAN_TABLE_MONOTONY
    PLAN_UNANNOTATED_CHARTS PLAN_NO_HIGHLIGHT PLAN_EXHIBIT_VARIETY PLAN_CHART_MONOTONY`),
  ...reasons("a statement of the files the build would fetch, each named in the finding; the floor on what is drawn (CRAFT_PLAYERS_UNINTRODUCED) holds the standing", "ASSETS_NEEDED ASSETS_OFFLINE"),
  ...reasons("the build's refusal of a stage whose own findings carry the standing", "CONTENT_REJECTED PLAN_REJECTED VARIETY_REJECTED"),
  ...reasons("the lower floor of a rate whose build bar (BAR_TABLES_TREATED, BAR_CHARTS_ANNOTATED) writes the standing, against the delivery floor", "CRAFT_TABLES_PLAIN CRAFT_CHARTS_BARE"),
  ...reasons("a stage of the build that failed without a finding of its own", "READBACK_MISSING PREFLIGHT_FAILED GATES_FAILED"),
]));

// The structure and aggregate rules that count nothing over the deck, though they are not standing-free by name: a compiled
// page that was edited or never typed, and a contents page that cannot hold the sections the deck itself declares.
const NAMED = new Set(["PAGE_TYPE_EDITED", "PAGE_TYPE_UNDECLARED", "CONTENTS_UNFIT"]);
// The standing-free rules that do count over the deck: a plan's advisories on its families.
const COUNTED = /^PLAN_(?!SCHEMA|REJECTED)/;
// The build bars are not measures of the deck but of what the runtime drew: every stage reads them over the scene
// (build-bars.mjs barOutcome), which on a revision that carries slides is the pages it composed. So they hold there - a floor
// from as many analytical pages as any deck's, a ceiling from the first - and say they are not held on the carried slides.
// The two craft floors that read a bar's rate lower down (CRAFT_TABLES_PLAIN, CRAFT_CHARTS_BARE) are standing-free beside
// their bars, and hold on the same pages.
const DRAWN = /^BAR_/;
/**
 * Does `code` measure the deck: a structure or aggregate rule that counts
 * something across its pages - a share, a rate, a median, a page the deck
 * must have - rather than holding or failing on a named page, statement,
 * record or file, or reading only the pages the runtime drew (a build bar). On a revision that carries slides from its
 * source deck such a rule is read over the pages the runtime composed, and held where they are enough for it to be read
 * (weight.mjs notHeldOn).
 */
export const measuresDeck = (code) => ["S", "G"].includes(GATE_CLASSES[code]) && !NAMED.has(code) && !DRAWN.test(code) && (!Object.hasOwn(STANDING_FREE, code) || COUNTED.test(code));

// The deck rules that ask what the deck as a whole has or is, where the others count across a population of pages: a summary
// that opens it, sections and a contents page, the answer carried up front, an evaluation's length, the players it compares
// introduced somewhere, and a kind of evidence or device it draws nowhere. A slide the revision carries may be the very page
// such a rule asks for, and the runtime does not read it; so these need more than a population - a deck that is mostly the
// runtime's own argument.
const WHOLE_DECK = new Set(`NO_SUMMARY NO_SECTIONS NO_CONTENTS CONTENT_ANSWER_UNCARRIED EVALUATION_TOO_SHORT PLAYERS_UNMARKED CRAFT_PLAYERS_UNINTRODUCED
  CRAFT_NO_TREND CRAFT_NO_ICONS CRAFT_NO_PICTURES PLAN_NO_PICTURES PLAN_NO_ICONS PLAN_NO_INSIGHT`.split(/\s+/));
/** Does `code`, a rule that measures the deck, ask what the deck as a whole has - where every other such rule counts over a population of pages. */
export const readsWholeDeck = (code) => measuresDeck(code) && WHOLE_DECK.has(code);

/**
 * The room a standing leaves: `{ margin, unit, state }`. `standing` is the
 * record every deck-level rule writes (variety_gates.mjs `stand`,
 * gate_config.py `standing`). A share is counted in pages - how many more
 * pages of the kind the cap allows, or how many the floor lacks, with the
 * deck's length held - and any other quantity in its own unit. `state` is
 * "over" or "short" (the rule is broken), "at" (one more page breaks it),
 * "ok", or "unread" while the deck is too short for the rule.
 */
export function standingRoom(standing) {
  const { value, bar, side, count, of } = standing;
  const pages = count !== undefined && of;
  // The rules compare the exact share with the bar, so the most pages a cap
  // allows is the floor of bar x pages and the fewest a floor needs its ceiling.
  // A rule that compares its share another way says its own room (`margin`: a build bar reads the share to two places).
  const margin = standing.margin !== undefined ? standing.margin
    : pages ? (side === "max" ? Math.floor(bar * of + 1e-9) - count : count - Math.ceil(bar * of - 1e-9))
    : Math.round((side === "max" ? bar - value : value - bar) * 1000) / 1000;
  // A count sits at its bar when one more (or one fewer) breaks the rule; a measured quantity has no such step.
  const counted = pages || (Number.isInteger(value) && Number.isInteger(bar) && standing.unit !== "present");
  // A rule that allows none has no room to watch: none is simply none.
  const state = !standing.applies ? "unread" : margin < 0 ? (side === "max" ? "over" : "short") : margin === 0 && counted && bar !== 0 ? "at" : "ok";
  return { margin, unit: pages ? (standing.counted ? standing.counted[1] : "pages") : standing.unit ?? "", state };
}

const percent = (x) => `${Math.round(x * 1000) / 10}%`;
// A share is counted in pages unless its rule counts something else (`counted`: the thing, one and many).
const plural = (n, unit, counted = ["page", "pages"]) => (unit === counted[1] ? `${n} ${n === 1 ? counted[0] : counted[1]}` : unit === "share" ? percent(n) : `${n}${unit && unit !== "present" ? ` ${unit}` : ""}`);

/**
 * One line saying where the deck stands against a rule: the value, the bar
 * and the room, "tables 14 of 46 pages, 30.4%; cap 30%: over by 1 page". A
 * rule that reads a page in a way its name does not say carries a `note`,
 * printed at the end of its line: how each of two rules counts a rail. A bar
 * held by a later stage names itself (`barName`: "delivery floor"), so the
 * line shows that stage's number from the first compile.
 */
export function standingLine(standing) {
  const { code, key, what, value, bar, side, count, of } = standing;
  const { margin, unit, state } = standingRoom(standing);
  const word = standing.barName ?? (side === "max" ? "cap" : "floor");
  const share = count !== undefined && of;
  const measured = standing.unit === "present" ? `${what}: ${value ? "present" : "absent"}`
    : share ? `${what} ${count} of ${of}${standing.counted ? "" : " pages"}, ${percent(count / of)}` : `${what} ${standing.unit === "share" ? percent(value) : value}`;
  const held = standing.unit === "present" ? "" : `; ${word} ${share || standing.unit === "share" ? percent(bar) : bar}`;
  const size = plural(Math.abs(margin), unit, standing.counted);
  const breaks = standing.blocks ? "blocks" : "is advised against";
  const room = state === "unread" ? "not held yet (the deck as it stands is outside what this rule reads)"
    : standing.unit === "present" ? (value ? "ok" : "missing")
    : state === "over" ? `over by ${size}` : state === "short" ? `short by ${size}`
    : state === "at" ? (side === "max" ? `at the ${word}, 1 more ${breaks}` : `at the ${word}, 1 fewer ${breaks}`)
    : side === "max" ? (bar === 0 ? "none allowed, none found" : `room for ${size} more`) : `${size} to spare`;
  // An estimate says so, and says what it estimates: a rule the render measures blocks there, not here.
  const consequence = (state === "over" || state === "short" || (standing.unit === "present" && !value && standing.applies)) ? (standing.estimated ? (Math.abs(margin) <= (standing.tolerance ?? 0) ? ` - inside the estimate's margin of ${standing.tolerance} ${unit}: the render decides` : " - would block at the render") : standing.blocks ? " - BLOCKS" : " - advisory") : "";
  return `${code}${key ? `.${key}` : ""}: ${measured}${held}: ${room}${consequence}${standing.estimated ? ` (${standing.estimated === true ? "estimated from the scene; the render measures it: --check --render" : standing.estimated})` : ""}${standing.provisional ? " (provisional)" : ""}${standing.note ? ` [${standing.note}]` : ""}`;
}
