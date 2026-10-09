// deck/v3 → planner deckPlan. The author writes content and intent (~10 fields per
// slide); everything geometric — layout, sizes, density, section nesting — is derived
// here from what the page carries.
//
// {
//   "schema": "professional-slides.deck/v3",
//   "id": "nyc-or-sf", "palette": "midnight", "density": "executive",
//   "cover": { "title", "subtitle", "date", "logo", "tone": "dark|light", "image": "assets/cover.jpg" },
//   "footer": "Document title",          // right footer, beside the page number
//   "slides": [
//     { "title": "Costs grew 9% against 5% revenue growth, moving FY22 into a loss",
//       "exhibit": { "type": "chart.column", "heading": "Revenue and cost, $bn", "unit": "$bn",
//                    "categories": [...], "series": [{ "name": "...", "values": [...] }] },
//       "points": ["...", "..."],           // ≤ 3 short supporting points (optional)
//       "soWhat": "One-sentence consequence for the decision",   // optional
//       "source": "Australia Post annual reports 2015–22", "note": "Figures may not sum", "notes": "speaker notes",
//       "tag": "Preliminary", "titleLead": "Why", "callout": "How to read this page",
//       "layout": "auto",                 // auto | exhibit-full | exhibit-left | exhibit-right | two-up | stack | grid | text
//       "arrange": "stack|grid", "metrics": [{ "value": "$2.1B", "label": "..." }], "rows": [{ "label", "text|points" }] },
//     { "kind": "section", "title": "Where the money goes" }
//   ]
// }
// exhibit.type: any registered component id, or the aliases "table", "image", "metrics", "cards",
// "quadrants", "swot", "compare", "phase-table", "rows".
//
// The composer is split along its seams; this module is its entry, and its
// re-exports keep the import path the evals read the composer through:
//
//   compose-deck.mjs          the deck: slides to pages (split, paginated), sections, agenda, credits
//   compose-page.mjs          one slide to one page: keys checked, passes run, the layout built
//   compose-passes.mjs        the rewrite passes a slide runs through, in order
//   compose-layouts.mjs       the page shapes and the choice among them
//   compose-arrangements.mjs  the evidence arrangements: peer rows, exhibit beside or over commentary, ...
//   compose-picture-pages.mjs pictures side by side, a picture hero, an exhibit over a photograph
//   compose-text-pages.mjs    a sidebar statement, a page of words alone
//   compose-exhibits.mjs      an exhibit as a layout item: aliases, media, headed panels
//   compose-tables.mjs        table treatment and inference (`styleTable`)
//   compose-charts.mjs        chart content and defaults read from the title and the data
//   compose-metrics.mjs       KPI strips, and the column of tiles beside an exhibit
//   compose-points.mjs        points, prose, the side column, the so-what close, fill
//   compose-pictures.mjs      images, photographs, picture pages and their credits
//   compose-body.mjs          the page body's frame and sizes, and the deck's design layout
export { splitReadingModes, splitTables, paginateTable, TRACKER_NAMES, sectionTabs, agendaPages, composeDeck, applyTemplate, toDeckPlan } from "../../skills/professional-slides/runtime/compose-deck.mjs";
export { SLIDE_KEYS, composeSlide } from "../../skills/professional-slides/runtime/compose-page.mjs";
export { SHAPE_NAMES, PASS_NAMES } from "../../skills/professional-slides/runtime/compose-passes.mjs";
export { PAGE_SHAPE_NAMES } from "../../skills/professional-slides/runtime/compose-layouts.mjs";
export { barScales, quantity, styleTable } from "../../skills/professional-slides/runtime/compose-tables.mjs";
export { changeFromContent, focusFromTitle, namedInTitle } from "../../skills/professional-slides/runtime/compose-charts.mjs";
export { IMPLICATION_NAMES, POINT_STYLE_NAMES, resolveFill } from "../../skills/professional-slides/runtime/compose-points.mjs";
export { pictureCredits } from "../../skills/professional-slides/runtime/compose-pictures.mjs";
