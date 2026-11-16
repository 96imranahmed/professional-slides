// How text is set, by what it is on the page rather than by the size it happens to take.
//
// A component names the role of each piece of text it draws - a figure's claim is a `statement`, a list item's bold
// words its `lead`, the sentence under them `body` or `note` - and this table says how that role is set: the size, the
// weight, the colour, and whether it is the page's content. The rules that make type read well then hold in one place
// instead of in each component's choice of token:
//
//   - content is never set below `type.body`: a role marked `content` whose size token comes out smaller (a design
//     system's own scale) is set at `type.body`;
//   - content is set at most a reading measure wide: `measure.max` at the toolkit's body size, and in proportion for a
//     larger size, so a line holds about as many characters whatever its size (about 75 at body size, 600px at 12pt).
//     A column wider than that keeps its text at the measure, ranged left in it. The measure is a range and not a wall:
//     a sentence read once across what it is read off (a closing band, a panel's caption) takes the `band` role and spans
//     it;
//     and where breaking at it would leave a widow that a tenth more width takes back onto the line before, the text
//     takes that tenth;
//   - the furniture roles (a chart's axis and legend, a data label, a dense cell, the source line, the footer, a kicker,
//     the byline under a quotation) keep their small sizes and are not held to a measure: they are read a word at a time;
//   - the display roles are the marks a reader sees rather than reads: a `figure` (the number a tile or a stat shows)
//     and a `mark` (the numeral, initials or glyph a disc, a tile or a quotation carries). They are set at the size their
//     place calls for, which the component gives, and are not held to a measure either.
//
// A role's size is its floor. A component may set a text larger than its role's size where its place calls for it - a
// lone quotation set as a pull quote, a figure as large as its column allows - and never smaller: `setText` refuses a
// size under the role's, so no component can take content below body size by naming a smaller token.
//
// `setText` measures a string in its role and `drawText` draws what it measured, so what a component sizes itself to is
// what it draws. A set text also says how it reads where it was set (`settingOf`): its lines, how full its last line is,
// and the width its ink actually takes - which a component reports up to the layout engine (core.mjs, tasteful-layout).
import { TOKENS, token, tokenValue, textPrimitive } from "./core.mjs";
import { measureText, measureTextRuns } from "./text-layout.mjs";

const role = (size, color, { bold = false, content = false, display = false, spans = false } = {}) => Object.freeze({ size, color, bold, content, display, spans });
export const TEXT_ROLES = Object.freeze({
  // A figure's claim: what the number says, read straight after it.
  statement: role("type.heading", "color.ink", { bold: true, content: true }),
  // A list item's few bold words, read down the list before its sentences.
  lead: role("type.heading", "color.ink", { bold: true, content: true }),
  // The page's sentences.
  body: role("type.body", "color.ink", { content: true }),
  // Secondary content: the sentence under a lead, a qualifier under a figure, a caption under a panel.
  note: role("type.body", "color.textSecondary", { content: true }),
  // A sentence read once, across the thing it is read off: the closing band under an exhibit, the caption under a panel.
  // It is set to the width of that thing rather than to a reading measure (`spans`) - a band that stopped at the measure
  // left half its ground empty - and is never more than a couple of lines, so there is no long return to make easy.
  band: role("type.body", "color.ink", { content: true, spans: true }),
  axis: role("type.chartLabel", "color.textSecondary"),
  legend: role("type.chartLabel", "color.textSecondary"),
  datum: role("type.chartLabel", "color.ink"),
  cell: role("type.compact", "color.ink"),
  source: role("type.source", "color.textSecondary"),
  footer: role("type.label", "color.textSecondary"),
  kicker: role("type.label", "color.componentPrimary", { bold: true }),
  // Who said a quotation, or whose card it is, under the words themselves: a name read as a tag.
  byline: role("type.label", "color.ink", { bold: true }),
  // A word or two set small inside a figure's mark or cell, read where it sits: a rank's entity, a zone's name, the label
  // on a flow's arrow.
  tag: role("type.label", "color.textSecondary"),
  // The number a metric tile, a stat or a fact shows: set at the display size its place holds, one line, never a sentence.
  figure: role("type.heading", "color.ink", { bold: true, display: true }),
  // The numeral, initials or glyph inside a marker (a numbered disc, a tile, a quotation's marks): sized to the marker.
  mark: role("type.label", "color.ink", { bold: true, display: true }),
});

/** The tokens a component that sets its words by role draws with: every role's size and colour, and the faces. */
export const TEXT_ROLE_TOKENS = Object.freeze([...new Set([...Object.values(TEXT_ROLES).flatMap((r) => [r.size, r.color]), "type.body", "font.body", "font.display", "measure.max"])]);

function roleOf(name) {
  const found = TEXT_ROLES[name];
  if (!found) throw new Error(`Unknown text role: ${name} (the roles are ${Object.keys(TEXT_ROLES).join(", ")})`);
  return found;
}

/**
 * The size token a role is set at: its own, or `type.body` for content whose own comes out smaller. `asked`, where a
 * component gives one, sets it larger than that; a size under it is refused, since the role's size is its floor.
 */
export function roleSize(name, asked) {
  const { size, content } = roleOf(name);
  const floor = content && tokenValue(token(size)) < tokenValue(token("type.body")) ? "type.body" : size;
  if (asked === undefined || asked === null || asked === floor) return floor;
  if (tokenValue(token(asked)) < tokenValue(token(floor)) - 0.01) throw new Error(`A ${name} text is set at ${floor} or larger, not at ${asked}: a role's size is its floor; give the text the room its role needs, or cut it`);
  return asked;
}

/**
 * The widest a role's lines run: `measure.max` scaled by the role's size against the toolkit's body size (the size the
 * token is written for), so the measure is a count of characters rather than of pixels. A density or a house style that
 * sets larger body text gets a proportionally wider measure. Furniture is not held to one.
 */
export function roleMeasure(name, size) {
  if (!roleOf(name).content || roleOf(name).spans) return Infinity;
  return tokenValue(token("measure.max")) * tokenValue(token(roleSize(name, size))) / TOKENS["type.body"].value;
}

// A last line under this share of its measure is a widow: a word or two the eye reads as a mistake.
const WIDOW = 1 / 3;
// How much wider a short text is tried at, to see whether it was broken onto a line it did not need.
const SLACK = 1.1;
// A text this many lines or fewer is short enough that one line more is a visible fault.
const SHORT = 3;

const lastLine = (layout, font) => (layout.lines.length > 1 ? measureText(layout.lines.at(-1) || " ", Number.MAX_SAFE_INTEGER, font).width : layout.width);
const fontOf = (size, bold, face) => ({ fontFamily: tokenValue(token(face)), fontSize: tokenValue(token(size)), bold });

/**
 * `text` (or its `runs`) measured in role `name` in a column `width` wide: wrapped at the narrower of the column and the
 * role's measure. Returns the measured layout (lines, height, line height) with the role, the size token, the width it
 * wrapped at (`wrap`), the width its ink takes (`inkWidth`), and how full its last line is (`lastFill`, of `wrap`).
 * `size` sets it larger than its role (never smaller, roleSize); `face` sets it in another of the design's faces (the
 * display face of an editorial close), measured in that face as it is drawn in it.
 */
export function setText(name, text, width, { bold, runs, size: asked, face = "font.body", lines = false } = {}) {
  const weight = bold ?? roleOf(name).bold, size = roleSize(name, asked), font = fontOf(size, weight, face), measure = lines ? Infinity : roleMeasure(name, size);
  const at = (wide) => (runs ? measureTextRuns(runs, wide, font) : measureText(String(text), wide, font));
  let wrap = Math.max(1, Math.min(width, measure)), layout = at(wrap);
  // Where the measure (not the column) broke it and left a widow, the tenth of slack the measure allows takes it back.
  const slack = Math.min(width, measure * SLACK);
  if (slack > wrap && layout.lines.length > 1 && lastLine(layout, font) / wrap < WIDOW) { const wider = at(slack); if (wider.lines.length < layout.lines.length) { wrap = slack; layout = wider; } }
  const last = lastLine(layout, font);
  return { ...layout, role: name, size, face, bold: weight, wrap, inkWidth: layout.width, lastFill: last / wrap, ...(runs ? { sourceRuns: runs } : {}) };
}

/**
 * Whether every text of a series sets on one line in `width`. The measure is there to make the eye's return to the next
 * line easy; a series that is all single lines has no returns, so its texts are set across their column (`setText` with
 * `lines: true`) - and all of them, or none: a series where one row ran across and the next stopped at the measure read
 * as two settings. Components that set parallel texts (a timeline's details, a process's steps) ask this once per series.
 */
export function oneLineEach(name, texts, width, options = {}) {
  return texts.length > 0 && texts.every((text) => setText(name, text, width, { ...options, lines: true }).lines.length === 1);
}

/**
 * A text `setText` measured, drawn at `at` (`{ x, y, width }`, the column it was set for): ranged left at the column's
 * left edge, or centred or ranged right in the column when `align` says so, in a frame as wide as the measure it was
 * set to - so a renderer that wraps by the frame wraps where it was measured. `color` and `bold` stand in for the
 * role's own where a ground or an emphasis needs them; the size is always the one it was set at. `data` adds what the
 * component records on the node (its place in a list, the series it belongs to); `runs` stands in for the measured runs
 * where a ground cannot carry their accent (null: none).
 */
export function drawText(id, nodeRole, at, set, { color, align = "left", bold, data = {}, runs = set.runs } = {}) {
  const width = Math.min(at.width ?? set.wrap, set.wrap), spare = (at.width ?? width) - width;
  const x = at.x + (align === "center" ? spare / 2 : align === "right" ? spare : 0);
  return textPrimitive({
    id, role: nodeRole, frame: { x, y: at.y, width, height: set.height }, text: set.text, ...(runs ? { runs } : {}),
    style: { fontFamily: token(set.face ?? "font.body"), fontSize: token(set.size), color: color ?? token(roleOf(set.role).color), bold: bold ?? set.bold, align, valign: "top", wrap: false, lineHeight: set.lineHeight },
    data: { ...data, textLayout: set, textRole: set.role },
  });
}

/**
 * How well a set text reads where it was set, from 0 (well) to 0.5: a last line under a third of its measure (a widow)
 * counts by how far short it falls, and a short text broken onto a line it would not need at a tenth more width counts
 * at least a quarter. Half the scale at most, as a figure's emphasis is weighed: a poorly broken line is a fault of the
 * arrangement, never a reason it cannot be used.
 */
export function settingOf(set) {
  if (!set || set.lines.length < 2) return 0;
  const widow = set.lastFill < WIDOW ? (WIDOW - set.lastFill) / WIDOW : 0;
  let needless = 0;
  // Only where the column broke it: at its measure, more width would not take the line back.
  if (set.lines.length <= SHORT && set.wrap < roleMeasure(set.role, set.size) - 0.5) {
    try { needless = setText(set.role, set.source, set.wrap * SLACK, { bold: set.bold, runs: set.sourceRuns, size: set.size, face: set.face }).lines.length < set.lines.length ? 0.5 : 0; } catch { needless = 0; }
  }
  return 0.5 * Math.max(widow, needless);
}

/**
 * Several settings taken together: 1 - product(1 - each), so each badly broken text adds to the fault and none hides
 * another - a widow in a description the arrangement cannot help does not mask the one in a statement it can.
 */
export const together = (values) => 1 - values.reduce((kept, value) => kept * (1 - value), 1);
/** A component's setting: its texts' (`settingOf`) taken together, or null where it sets none. */
export const settingOfAll = (sets) => { const found = sets.filter(Boolean); return found.length ? together(found.map(settingOf)) : null; };
