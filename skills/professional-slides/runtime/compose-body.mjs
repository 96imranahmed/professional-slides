// The page body every builder lays out into: the layout tree's two sizings
// (SIZE fills its track, HUG takes its content's height), the body's measured
// frame and the gaps between its columns, the rules a side column is held to,
// and the design system's composition choices for the deck being composed
// (LAYOUT, set only by withDesignLayout).
export const SIZE = { width: { fr: 1 }, height: "fill" };
export const HUG = { width: { fr: 1 }, height: "hug" };

// The least a panel beside prose keeps: a statement in heading type needs
// about this much to stay within its eight lines.
export const PANEL_MIN_WIDTH = 300;

// The body frame a content page lays out into, and the furniture between its
// columns: used to measure a side column against what it holds before the
// planner turns fractions into pixels.
export const BODY_WIDTH = 1160, BODY_HEIGHT = 508, CONNECTOR_WIDTH = 44, COLUMN_GAP = 16;
// How deep a commentary column should run down its track: the gates hold a
// column's trailing band to a fifth of its height (column_void_max), so a
// column that narrows to reach four fifths clears it with the list's own gaps
// to spare. A short column narrows toward this, giving the exhibit the width,
// and stops at SIDE_COLUMN_MIN_WIDTH: below it a line of body type holds too
// few characters to read as prose (CPL's floor of 35).
export const SIDE_COLUMN_DEPTH = 0.8;
export const SIDE_COLUMN_MIN_WIDTH = 280;
// A column of points that still runs less than this far down its track at
// its narrowest is not a column: it ends halfway down the page beside a
// full-height exhibit. The points go under the exhibit, which takes the width.
// Set where the gates' column void starts: a trailing band a fifth of the
// page's height is 144px of a 508px body.
export const SIDE_COLUMN_SHORT = 0.72;

// The design system's composition choices for the deck being composed
// (design-systems.mjs); set by composeDeck, read by the page builders.
const CONSULTING_LAYOUT = Object.freeze({ name: "consulting", takeaway: "band", commentary: "right", shapeBias: {} });
export let LAYOUT = CONSULTING_LAYOUT;
/**
 * Run `compose` with the deck's design layout in force. Invariant: LAYOUT is
 * the consulting layout outside a call, whether the composition returns or
 * throws, and this is its only writer.
 */
export function withDesignLayout(layout, compose) {
  LAYOUT = layout ?? CONSULTING_LAYOUT;
  try { return compose(); } finally { LAYOUT = CONSULTING_LAYOUT; }
}
