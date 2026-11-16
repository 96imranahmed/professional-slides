// Page grids, written as CSS grid writes one.
//
//   { columns: "2fr 1fr", rows: "auto 1fr", gap: "space.4",
//     areas: ["metrics metrics", "exhibit side"],
//     place: { side: { content: ["kpi", "points"], heading: true, align: "center" } } }
//
// A template says where things sit and nothing about what they are: the page
// keeps its content in the fields every page has (`exhibit`, `points`, `kpi`,
// `metrics`, `paragraphs`, `insight`, `callout`, `takeaway`, `photo`), and each
// named area takes the content of that name, or the content `place` gives it -
// one slot, or several stacked, with a heading, a ground (`tone`), where its free height goes (`align`) and how its
// number is set across (`justify`). The tracks are CSS's: `fr` shares what is left,
// `auto` is as large as its content, a length is fixed, `minmax(200px, 1fr)`
// shares with a floor. The layout engine (core.mjs, Taffy) resolves them as a
// browser would, and the HTML emitter writes the same grid.
//
// A share fixed in advance is a guess about content the template has not seen: a third of the page for a figure's
// column is right for "33%" over four words and wrong for the same figure over a sentence that breaks on its last
// word. So `columns` and `rows` may list alternatives, the template's preference first:
//
//   { columns: ["1fr 2fr", "2fr 3fr", "1fr 1fr"], areas: ["side exhibit"] }
//
// and the page's grid becomes a choice between those grids. The layout engine weighs them as it weighs any other way of
// setting a page (tasteful-layout: a statement left with a widow in the narrow column counts against it), records what
// it chose and over what as a decision a judge sees, and a page's recorded `choices` hold it. A tie goes to the first.
//
// A deck keeps its own templates under `layouts`, beside its palette; a page
// takes one by name (`grid: "<name>"`) or writes one in place.
import { TOKENS } from "./core.mjs";

/** The content a page can place: each slot, and the page field it draws. */
export const SLOTS = Object.freeze({
  exhibit: "exhibit", points: "points", paragraphs: "paragraphs", kpi: "kpi", insight: "insight",
  metrics: "metrics", callout: "callout", takeaway: "soWhat", photo: "photo", picture: "pictures", implication: "implication",
});
const ALIGN = Object.freeze({ start: "start", center: "center", end: "end", "space-between": "distribute" });
export const isSlot = (name) => name in SLOTS || /^exhibit-[2-9]$/.test(name);

/**
 * One track as the planner reads it: `{ fr }`, "hug", `{ px }` for a length, or `{ min, fr }` for `minmax(<px>, <fr>)`.
 * A length is `{ px }` and never a bare number, because a bare number is a weight in a dashboard's plan (`[2, 1]`): read
 * as one, `240px` beside `1fr` took 240 shares of the row and left the column beside it a few pixels.
 */
function track(text, where) {
  const fr = /^(\d*\.?\d+)fr$/.exec(text), px = /^(\d*\.?\d+)(px)?$/.exec(text);
  const floor = /^minmax\((\d*\.?\d+)(?:px)?,(\d*\.?\d+)fr\)$/.exec(text);
  if (fr) return { fr: Number(fr[1]) };
  if (text === "auto") return "hug";
  if (floor) return { min: Number(floor[1]), fr: Number(floor[2]) };
  if (px && px[2]) return { px: Number(px[1]) };
  throw new Error(`${where}: a track is \`<n>fr\`, \`auto\`, a length in px or \`minmax(<px>, <n>fr)\` (got "${text}")`);
}

/** A track list - "2fr auto 240px", or weights [2, 1] - as the engine's tracks. */
export function tracksOf(value, where) {
  if (Array.isArray(value) && value.length && value.every((entry) => typeof entry === "string")) throw new Error(`${where}: a list of track lists is a set of alternatives, which only a page's grid takes (layout-templates.mjs alternativesOf)`);
  if (Array.isArray(value)) return value.map((weight) => { if (!(Number.isFinite(weight) && weight > 0)) throw new Error(`${where}: weights are positive numbers`); return { fr: weight }; });
  if (typeof value !== "string" || !value.trim()) throw new Error(`${where}: tracks are written as CSS writes them - "2fr 1fr", "auto 1fr"`);
  return value.trim().replace(/\(\s*/g, "(").replace(/\s*,\s*/g, ",").replace(/\s*\)/g, ")").split(/\s+/).map((text) => track(text, where));
}

/**
 * A grid's `columns` or `rows` as the alternatives it offers, each `{ label, tracks }`, the preference first: one track
 * list ("1fr 2fr", or weights) is one alternative; a list of track lists (["1fr 2fr", "2fr 3fr"]) is several.
 */
export function alternativesOf(value, where) {
  const lists = Array.isArray(value) && value.length && value.every((entry) => typeof entry === "string") ? value : [value];
  const found = lists.map((list) => ({ label: Array.isArray(list) ? list.map((weight) => `${weight}fr`).join(" ") : String(list).trim().replace(/\s+/g, " "), tracks: tracksOf(list, where) }));
  const twice = found.find((entry, at) => found.findIndex((other) => other.label === entry.label) !== at);
  if (twice) throw new Error(`${where}: "${twice.label}" is offered twice`);
  return found;
}

/** `areas: ["a a", "b c"]` as each name's cell: its first column and row, and how many it spans. A `.` leaves a cell empty. */
export function areasOf(lines, where) {
  const rows = (lines || []).map((line) => String(line).trim().split(/\s+/));
  if (rows.some((names) => names.length !== rows[0].length)) throw new Error(`${where}: every line of \`areas\` names the same number of columns`);
  const named = {};
  rows.forEach((names, r) => names.forEach((name, c) => {
    if (name === ".") return;
    const area = named[name] ??= { column: c, row: r, columnSpan: 1, rowSpan: 1 };
    area.columnSpan = Math.max(area.columnSpan, c + 1 - area.column);
    area.rowSpan = Math.max(area.rowSpan, r + 1 - area.row);
  }));
  // An area is a rectangle: every cell its box covers carries its name, and no other does.
  for (const [name, area] of Object.entries(named)) {
    for (let r = area.row; r < area.row + area.rowSpan; r += 1) for (let c = area.column; c < area.column + area.columnSpan; c += 1) {
      if (rows[r][c] !== name) throw new Error(`${where}: area "${name}" is not a rectangle (row ${r + 1}, column ${c + 1} is "${rows[r][c]}")`);
    }
  }
  return { named, columns: rows[0]?.length ?? 0, rows: rows.length };
}

/** The template a `grid` names: the deck's own of that name (`layouts`), or the one written in place. */
export function templateOf(grid, layouts, id) {
  const template = typeof grid === "string" ? layouts?.[grid] : grid;
  if (typeof grid === "string" && !template) throw new Error(`${id}: grid "${grid}" is not one of the deck's \`layouts\` (${Object.keys(layouts || {}).join(", ") || "it declares none"})`);
  return template;
}

/**
 * A page's `grid` resolved: the deck's template of that name or the one written
 * in place, as tracks, a gap, and each area with its cell, the slots it stacks,
 * its heading, its ground and where its free height goes.
 */
export function resolveTemplate(grid, layouts, id, { name = "template", arrange = false } = {}) {
  const template = templateOf(grid, layouts, id);
  if (!template || typeof template !== "object" || !Array.isArray(template.areas) || !template.areas.length)
    throw new Error(`${id}: a grid is { columns, rows, areas, place } - \`areas\` names where the page's content sits, as CSS \`grid-template-areas\` does - or the name of one of the deck's \`layouts\``);
  for (const key of Object.keys(template)) if (!["columns", "rows", "gap", "areas", "place"].includes(key)) throw new Error(`${id}: a grid takes columns, rows, gap, areas and place (got \`${key}\`)`);
  const { named, columns: across, rows: down } = areasOf(template.areas, `${id}: grid.areas`);
  const even = (count) => [{ label: Array.from({ length: count }, () => "1fr").join(" "), tracks: Array.from({ length: count }, () => ({ fr: 1 })) }];
  const columnWays = template.columns === undefined ? even(across) : alternativesOf(template.columns, `${id}: grid.columns`);
  const rowWays = template.rows === undefined ? even(down) : alternativesOf(template.rows, `${id}: grid.rows`);
  for (const { tracks: columns } of columnWays) for (const { tracks: rows } of rowWays) if (columns.length !== across || rows.length !== down) throw new Error(`${id}: grid.areas is ${across} by ${down} and the tracks are ${columns.length} by ${rows.length}`);
  // Every pairing of a column alternative with a row alternative, the preference (the first of each) first. Each is
  // labelled by what it varies, so a recorded choice reads as the tracks it chose.
  const tracks = columnWays.flatMap((columns) => rowWays.map((rows) => ({ label: [columnWays.length > 1 ? columns.label : null, rowWays.length > 1 ? rows.label : null].filter(Boolean).join(" / ") || columns.label, columns: columns.tracks, rows: rows.tracks })));
  const [{ columns, rows }] = tracks;
  if (template.gap !== undefined && !(typeof template.gap === "string" && template.gap.startsWith("space.") && Object.hasOwn(TOKENS, template.gap))) throw new Error(`${id}: grid.gap names a spacing token ("space.4")`);
  for (const name of Object.keys(template.place || {})) if (!named[name]) throw new Error(`${id}: grid.place names area "${name}", and the areas are ${Object.keys(named).join(", ")}`);
  const areas = Object.entries(named).map(([name, cell]) => {
    const placed = template.place?.[name] ?? name;
    const spec = typeof placed === "string" || Array.isArray(placed) ? { content: placed } : placed;
    const content = [spec.content ?? name].flat();
    const unknown = content.filter((slot) => !isSlot(slot));
    if (unknown.length) throw new Error(`${id}: area "${name}" places ${unknown.map((slot) => `"${slot}"`).join(", ")}, which is not content a page carries - a slot is ${Object.keys(SLOTS).join(", ")}, or exhibit-2 and on for a page of several`);
    if (spec.align !== undefined && !(spec.align in ALIGN)) throw new Error(`${id}: area "${name}" align is ${Object.keys(ALIGN).join(", ")}`);
    if (spec.justify !== undefined && !["start", "center"].includes(spec.justify)) throw new Error(`${id}: area "${name}" justify is start or center`);
    return { name, cell, content, ...(spec.heading !== undefined ? { heading: spec.heading } : {}), ...(spec.tone ? { tone: spec.tone } : {}), ...(spec.align ? { leftover: ALIGN[spec.align] } : {}),
      // `optional`: the area takes whichever of its slots the page carries (the built-in arrangements); written by an author, every slot named is content the page must have.
      ...(spec.optional ? { optional: true } : {}), ...(spec.tables ? { tables: spec.tables } : {}), ...(spec.metrics ? { metrics: spec.metrics } : {}), ...(spec.panel === false ? { panel: false } : {}), ...(spec.unit === false ? { unit: false } : {}), ...(spec.justify ? { justify: spec.justify } : {}), ...(spec.gap ? { gap: spec.gap } : {}),
      hug: rows.slice(cell.row, cell.row + cell.rowSpan).every((row) => row === "hug") };
  });
  const twice = areas.flatMap((area) => area.content).filter((slot, at, all) => all.indexOf(slot) !== at);
  if (twice.length) throw new Error(`${id}: ${[...new Set(twice)].map((slot) => `"${slot}"`).join(", ")} is placed in more than one area`);
  // `arrange`: the areas are blocks the engine arranges itself (tasteful-layout) rather than cells of fixed tracks.
  // `tracks`: the alternatives, where the template offers more than one (`columns` and `rows` are the preference).
  return { name, columns, rows, ...(tracks.length > 1 ? { tracks } : {}), ...(template.gap ? { gap: template.gap } : {}), areas, ...(arrange ? { arrange: true } : {}) };
}
