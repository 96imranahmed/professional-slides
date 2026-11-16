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
// The gutter a breakout's fan or a spread's bracket crosses between two panels.
export const LINK_GUTTER = 72;
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

// The density the deck being composed sets for every page that names none of
// its own. The planner applies it after a page is composed, so a builder that
// sizes a column by measuring its text reads it here, to measure at the size
// the text will be drawn at. Null outside a composition; withDeckDensity is
// its only writer.
let deckDensityInForce = null;
export const deckDensity = () => deckDensityInForce;
export function withDeckDensity(density, compose) {
  deckDensityInForce = density ?? null;
  try { return compose(); } finally { deckDensityInForce = null; }
}
