// tasteful-layout: choose how a group of blocks is arranged in a frame.
//
// A page's blocks can be set many ways - stacked, side by side, in two or
// three columns, the first beside the rest - and which one reads well depends
// on what the blocks measure at the widths each arrangement gives them. Rules
// written ahead of time ("points beside a chart spread down the column") are
// right for the page they were written for and wrong for the next. So this
// module does not carry rules about pages. It runs a loop:
//
//   1. propose  every arrangement of the group that keeps its reading order;
//   2. lay out  each one with Taffy (the CSS grid engine), asking each block
//               how tall it is at the width that arrangement gives it;
//   3. score    what came out, on a few measures of how a page reads;
//   4. choose   the lowest score.
//
// A block is `{ id, sizing, minWidth, maxWidth }`, or a group `{ id, blocks }`
// of its own, arranged the same way inside whatever frame its parent's
// arrangement gives it - the loop is recursive. A block may also be a choice,
// `{ id, options: [...] }`: several ways of realising the same content (a list
// of one point, or the same point as a statement in a box), each a block with
// its own `label` and its own requirements. Every option is tried in every
// arrangement, so what a component needs decides where it can be used, and
// nothing outside the component has to know. `sizing: "fill"` is a block that
// draws to any frame (a chart, a picture); otherwise it has a height of its own
// at a width, which `measure(block, width)` returns. The module knows nothing
// about slides: it takes blocks, a frame and a measure, and returns the chosen
// arrangement, every block's frame, and the scores of every candidate so a
// caller can see why.
//
// The measures are not this module's invention. They are the vocabulary automated document layout settled on
// (Harrington and others, "Aesthetic measures for automated document layout", 2004; Ngo, Teo and Byrne, "Modelling
// interface aesthetics", 2003), read off the ink each block lays down - a short line in a wide column inks only as far
// as its words - and not off the frame it was given. Each is a share between 0 (fine) and 1 (as bad as it gets):
//
//   overflow    the content does not fit the frame's height (disqualifies);
//   narrow      a block set narrower than it can be read at (disqualifies);
//   whitespace  white-space fraction: the page's ink falls short of the fill a page should carry (`fill.page`);
//   balance     the centre of the ink's weight sits away from the centre of the frame, across or down;
//   uniformity  text set past its readable measure, or sibling texts inking very different widths;
//   regularity  the arrangement is not a clean grid: columns ending at different heights, a last row not full;
//   proportion  a fill block squeezed below its share or its least height, or stretched past the proportions it reads at;
//               or the page's point (a display figure) set smaller than the room would let it be (`settings.emphasis`);
//   simplicity  a small cost per column, so the plainer arrangement wins a tie;
//   variety     the candidate sets a kind of content the way the caller says it was last set (`settings.recent`):
//               a deck that sets every figure, every list, the same way reads as a template, not as pages. It
//               counts only where a fresh setting is about as good; a clearly better repeat stands.
//
// They are not added up. A page is as good as its worst feature lets it be - one bad feature harms the whole out of
// proportion - so the score is 1 - product((1 - measure) ^ weight): any measure near 1 takes the score to 1 whatever
// the rest say, and a weight says how sharply its measure bites, not how much of a sum it is.
import { readFileSync } from "node:fs";
import { initSync, TaffyTree, Style, Display, AlignContent, AlignSelf } from "../vendor/taffy-layout/taffy_wasm.mjs";

initSync({ module: readFileSync(new URL("../vendor/taffy-layout/taffy_wasm_bg.wasm", import.meta.url)) });

// The module carries no page's numbers of its own. Everything a page's taste is made of comes in as `presets`, from
// whoever holds the global presets (the slide runtime: its tokens and its density profiles), so the rhythm is set in
// one place. What stays here are the constants of the search itself (REPEATED, CLOSE, COMBINATIONS, TIE below):
//
//   gap      { major, minor }   the least air between major components (a fill block, a group, a block marked
//                               `major`) and between the blocks inside one;
//   measure  { min, max }       the widths a line of body text is read at;
//   fill     { page, share, minHeight, aspect: [tallest, flattest] }   the share of the frame a page's ink should
//                               reach, and what a fill block wants of it;
//   weights  one weight per measure above (whitespace, balance, uniformity, regularity, proportion, simplicity, variety).
const MEASURES = ["whitespace", "balance", "uniformity", "regularity", "proportion", "simplicity", "variety"];
// How much repeating the last setting of a kind of content counts: enough to lose to a sound alternative, not to a poor one.
const REPEATED = 0.5;
// Quality first: a repeat is only marked down where a fresh setting scores within this much of it. Where every other
// way of setting the content is clearly weaker, the page repeats the last one and is better for it.
const CLOSE = 0.15;
/**
 * The measures taken together: 1 - product((1 - measure) ^ weight). One place writes the sum, so whoever recomputes a
 * score from recorded measures (evals/scripts/taste_fit.mjs) scores as the engine does. A measure not given counts 0.
 */
export const combined = (parts, weights) => 1 - MEASURES.reduce((kept, name) => kept * (1 - Math.min(1, parts[name] ?? 0)) ** weights[name], 1);

function checked(presets) {
  const numbers = [presets?.gap?.major, presets?.gap?.minor, presets?.measure?.min, presets?.measure?.max, presets?.fill?.page, presets?.fill?.share, presets?.fill?.minHeight, ...(presets?.fill?.aspect ?? [NaN, NaN]), ...MEASURES.map((name) => presets?.weights?.[name])];
  if (numbers.some((value) => !Number.isFinite(value))) throw new Error("tasteful-layout takes its presets from the caller: { gap: { major, minor }, measure: { min, max }, fill: { page, share, minHeight, aspect: [tallest, flattest] }, weights: { " + MEASURES.join(", ") + " } }");
  return presets;
}

const isGroup = (block) => Array.isArray(block.blocks);
// The most ways of realising a group's choices that are tried in each arrangement.
const COMBINATIONS = 24;
// Scores closer than this are a tie, and a tie goes to the candidate proposed first: the plainer arrangement, the plainer realisation.
const TIE = 0.01;

/** Every way of taking one option from each block that offers some: the blocks as they would be drawn, and what was taken. */
function realisations(blocks) {
  let found = [{ blocks: [], picks: {}, families: {} }];
  for (const block of blocks) {
    const options = Array.isArray(block.options) && block.options.length ? block.options : null;
    found = found.flatMap((sofar) => (options ? options.map((option) => ({ blocks: [...sofar.blocks, { ...option, id: block.id }], picks: { ...sofar.picks, [block.id]: option.label },
        // What kind of content was set, and in which family of settings (two sizes of one setting are one family).
        families: { ...sofar.families, [block.kind ?? block.id]: option.family ?? option.label } }))
      : [{ blocks: [...sofar.blocks, block], picks: sofar.picks, families: sofar.families }])).slice(0, COMBINATIONS);
  }
  return found;
}

/** A candidate's name: its arrangement, then what it took for each choice - what a judge is shown and a page records. */
const labelOf = (candidate, picks) => [candidate.kind + (candidate.shares ? ` ${candidate.shares.join(":")}` : candidate.columns ? ` ${candidate.columns}` : candidate.share ? ` ${candidate.share}:1` : ""),
  ...Object.entries(picks).map(([id, label]) => `${id}=${label}`)].join(" / ");
const major = (block) => fills(block) || isGroup(block) || Boolean(block.major);
/** The air between a group's blocks: its own where it names one, else the preset for what it holds. */
const gapOf = (group, presets) => group.gap ?? (group.blocks.some(major) ? presets.gap.major : presets.gap.minor);
const fills = (block) => (isGroup(block) ? block.blocks.some(fills) : block.sizing === "fill");

/**
 * The arrangements of `count` blocks that keep their order: a stack, a row,
 * two to four equal columns filled in reading order, and - for three or more -
 * the first block beside the rest stacked, at each of a few width shares.
 */
function candidates(blocks) {
  const count = blocks.length;
  if (count < 2) return [{ kind: "column" }];
  const found = [{ kind: "column" }, { kind: "row", shares: blocks.map(() => 1) }];
  // A fill block beside text takes the larger share, as an exhibit does beside its commentary.
  if (count === 2 && fills(blocks[0]) !== fills(blocks[1])) for (const share of [2, 1.5]) found.push({ kind: "row", shares: blocks.map((block) => (fills(block) ? share : 1)) });
  for (let columns = 2; columns <= Math.min(4, count - 1); columns += 1) found.push({ kind: "columns", columns });
  if (count >= 3) for (const share of [1, 1.5, 2]) found.push({ kind: "lead", share });
  return found;
}

/** A candidate as CSS grid: its column tracks, and each block's cell. */
function gridOf(candidate, count) {
  const fr = (value) => ({ min: 0, max: `${value}fr` });
  if (candidate.kind === "column") return { columns: [fr(1)], cells: Array.from({ length: count }, (_, at) => ({ column: 0, row: at })) };
  if (candidate.kind === "row") return { columns: candidate.shares.map(fr), cells: Array.from({ length: count }, (_, at) => ({ column: at, row: 0 })) };
  if (candidate.kind === "columns") return { columns: Array.from({ length: candidate.columns }, () => fr(1)), cells: Array.from({ length: count }, (_, at) => ({ column: at % candidate.columns, row: Math.floor(at / candidate.columns) })) };
  // The first block beside the rest: it spans every row the rest take.
  return { columns: [fr(candidate.share), fr(1)], cells: [{ column: 0, row: 0, rowSpan: count - 1 }, ...Array.from({ length: count - 1 }, (_, at) => ({ column: 1, row: at }))] };
}

/** One candidate laid out by Taffy in `frame`: each block's frame, relative to the group's, and the height the content takes. */
function layOut(group, candidate, frame, context) {
  const { natural } = context, gap = gapOf(group, context.presets);
  const tree = new TaffyTree();
  tree.disableRounding();
  const make = (style, children, block) => { const made = new Style(style); try { return children ? tree.newWithChildren(made, children) : tree.newLeafWithContext(made, block); } finally { made.free(); } };
  try {
    const grid = gridOf(candidate, group.blocks.length);
    const rows = Math.max(...grid.cells.map((cell) => cell.row + (cell.rowSpan || 1)));
    const leaves = group.blocks.map((block, at) => make({ gridColumn: { start: grid.cells[at].column + 1, end: { span: 1 } }, gridRow: { start: grid.cells[at].row + 1, end: { span: grid.cells[at].rowSpan || 1 } },
      // A block with a height of its own keeps it; one that fills takes its cell's.
      ...(fills(block) ? {} : { alignSelf: AlignSelf.Start }) }, null, block));
    // Rows are their content's height; in a frame of a given height, a row holding a fill block shares what the others leave.
    const filling = (row) => group.blocks.some((block, at) => fills(block) && grid.cells[at].row <= row && row < grid.cells[at].row + (grid.cells[at].rowSpan || 1));
    const root = make({ display: Display.Grid, size: { width: frame.width, height: frame.height ?? "auto" }, alignContent: AlignContent.Start, gridTemplateColumns: grid.columns,
      gridTemplateRows: Array.from({ length: rows }, (_, row) => (frame.height !== null && filling(row) ? { min: 0, max: "1fr" } : { min: "auto", max: "auto" })), gap: { width: gap, height: gap } }, leaves);
    tree.computeLayoutWithMeasure(root, { width: frame.width, height: frame.height ?? "max-content" }, (known, available, _id, block, style) => {
      style.free();
      const width = known.width ?? (typeof available.width === "number" ? available.width : frame.width);
      return { width, height: known.height ?? natural(block, width) };
    });
    const read = (id) => { const at = tree.getLayout(id); try { return { x: at.x, y: at.y, width: at.width, height: at.height }; } finally { at.free(); } };
    const frames = leaves.map(read);
    return { frames, height: Math.max(0, ...frames.map((at) => at.y + at.height)) };
  } finally { tree.free(); }
}

/** A laid-out candidate's score: the measures of how it reads, and what they come to together (Infinity when it cannot be used). */
function scoreOf(group, candidate, laid, frame, context, families = {}) {
  const { presets, extent } = context;
  const height = frame.height ?? laid.height, area = Math.max(1, frame.width * height);
  const parts = { overflow: 0, narrow: 0, whitespace: 0, balance: 0, uniformity: 0, regularity: 0, proportion: 0, simplicity: 0, variety: 0 };
  if (Object.entries(families).some(([kind, family]) => context.recent[kind] === family)) parts.variety = REPEATED;
  if (frame.height !== null && laid.height > frame.height + 0.5) parts.overflow = (laid.height - frame.height) / frame.height;
  // Each block's ink: a fill block inks its frame; text inks as far as its words run, from its left edge.
  const inks = group.blocks.map((block, at) => { const box = laid.frames[at]; return fills(block) ? box : { ...box, width: Math.min(box.width, block.maxWidth ?? presets.measure.max, extent(block, box.width)) }; });
  const texts = [];
  group.blocks.forEach((block, at) => {
    const box = laid.frames[at], min = block.minWidth ?? presets.measure.min, max = block.maxWidth ?? presets.measure.max;
    if (box.width < min - 0.5) parts.narrow = Math.max(parts.narrow, (min - box.width) / min);
    if (fills(block)) {
      const ratio = box.width / Math.max(1, box.height), [tallest, flattest] = block.aspect ?? presets.fill.aspect;
      parts.proportion = Math.max(parts.proportion, Math.max(0, presets.fill.share - (box.width * box.height) / area), box.height < presets.fill.minHeight ? (presets.fill.minHeight - box.height) / presets.fill.minHeight : 0,
        ratio > flattest ? (ratio - flattest) / ratio : ratio < tallest ? (tallest - ratio) / tallest : 0);
    } else {
      // What the block is there to make large, it should make large: half the shortfall counts against the arrangement.
      // Such a block is meant to differ from the text around it, so it is not held to that text's line.
      const emphasis = context.emphasis(block, box.width);
      if (emphasis === null) texts.push(inks[at].width);
      if (emphasis !== null) parts.proportion = Math.max(parts.proportion, 0.5 * (1 - emphasis));
      parts.uniformity = Math.max(parts.uniformity, Math.max(0, box.width - max) / box.width);
    }
  });
  // Sibling texts that ink very different widths read as a ragged set: a figure of four characters over a paragraph.
  if (texts.length > 1) parts.uniformity = Math.max(parts.uniformity, 0.5 * (1 - Math.min(...texts) / Math.max(1, ...texts)));
  const inked = inks.reduce((sum, ink) => sum + ink.width * ink.height, 0);
  parts.whitespace = Math.max(0, presets.fill.page - inked / area) / presets.fill.page;
  if (inked > 0) {
    // Across, a block weighs where its frame stands: text ranged left in its column is aligned to that column, not leaning out of it.
    const across = inks.reduce((sum, ink, at) => sum + (laid.frames[at].x + laid.frames[at].width / 2) * ink.width * ink.height, 0) / inked, down = inks.reduce((sum, ink) => sum + (ink.y + ink.height / 2) * ink.width * ink.height, 0) / inked;
    // Down the page the group is read against its own extent: where it sits in a taller frame is the caller's to place (centred, as a rule).
    const depth = Math.max(1, laid.height);
    parts.balance = Math.max(Math.abs(across - frame.width / 2) / (frame.width / 2), Math.abs(down - depth / 2) / (depth / 2));
  }
  // Blocks side by side: how far apart the columns end, and a grid whose last row is not full.
  const columns = new Map();
  laid.frames.forEach((box) => columns.set(Math.round(box.x), Math.max(columns.get(Math.round(box.x)) ?? 0, box.y + box.height)));
  if (columns.size > 1) parts.regularity = (Math.max(...columns.values()) - Math.min(...columns.values())) / Math.max(1, height);
  if (candidate.kind === "columns" && group.blocks.length % candidate.columns) parts.regularity = Math.max(parts.regularity, 1 - (group.blocks.length % candidate.columns) / candidate.columns);
  // A column is a part, and so is a ground or frame a block draws around itself (`chrome`): a box has to earn its place.
  parts.simplicity = Math.min(1, (columns.size - 1 + group.blocks.reduce((sum, block) => sum + (block.chrome || 0), 0)) / 4);
  const total = parts.overflow > 0 || parts.narrow > 0 ? Infinity : combined(parts, presets.weights);
  return { total, parts };
}

/**
 * Arrange `group` (`{ id, blocks, gap? }`) in `frame` (`{ width, height }`; a null
 * height leaves it to the content). `measure(block, width)` is a block's own
 * height at a width. Returns the chosen arrangement (`kind`, and its `shares`
 * or `columns`), its `label`, the option taken for each choice (`picks`), the
 * content's `height`, every block's `frames` in the group's own coordinates (a
 * nested group's blocks under it, as `children`), the `score`, and `scores`:
 * every candidate with its label and measures, best first. `settings.choices`
 * (`{ <group id>: <label> }`) holds a group to the candidate of that label where
 * it can be used - a judge's decision, recorded by whoever asked;
 * `settings.extent(block, width)` says how wide a text block's ink runs at a width;
 * `settings.emphasis(block, width)` how far a block gets with what it is there to
 * make large (0 to 1, null where it holds no such thing); `settings.recent`
 * (`{ <kind>: <family> }`) how each kind of content was last set, for `variety`; and
 * `settings.refused` (`{ <group id>: [<label>] }`) rules candidates out: ones the
 * caller found it could not draw. `presets` is required (see the
 * top of the module); `gap` in the result is the air it set between the group's blocks.
 */
export function arrange(group, frame, measure, presets, settings = {}) {
  checked(presets);
  const memo = new Map();
  // A nested group is as tall as its own best arrangement at that width.
  const natural = (block, width) => {
    // A block that cannot be set at this width at all (its measure does not come to a number) rules the candidate out.
    if (!isGroup(block)) { const tall = fills(block) ? 0 : measure(block, width); if (!Number.isFinite(tall)) { context.unfit = true; return 0; } return tall; }
    const key = `${block.id}@${Math.round(width)}`;
    if (!memo.has(key)) memo.set(key, choose(block, { width, height: null }).height);
    return memo.get(key);
  };
  // A block's ink width at a width: the caller's, where it can say how far the words run; else the width it was given.
  const context = { presets, natural, extent: settings.extent ?? ((_block, width) => width), emphasis: settings.emphasis ?? (() => null), recent: settings.recent ?? {} };
  function choose(target, at) {
    const refused = new Set(settings.refused?.[target.id]);
    const scored = realisations(target.blocks).flatMap(({ blocks, picks, families }) => { const drawn = { ...target, blocks };
      return candidates(blocks).map((candidate) => { context.unfit = false; const laid = layOut(drawn, candidate, at, context), label = labelOf(candidate, picks), score = scoreOf(drawn, candidate, laid, at, context, families);
        return { candidate, laid, blocks, picks, families, label, ...score, ...(refused.has(label) || context.unfit ? { total: Infinity } : {}) }; }); });
    // What each candidate scores before variety is counted, and the best of the fresh ones: a repeat keeps its mark only
    // where one of those is close behind it.
    const base = (entry) => (Number.isFinite(entry.total) ? combined({ ...entry.parts, variety: 0 }, presets.weights) : Infinity);
    const fresh = Math.min(Infinity, ...scored.filter((entry) => entry.parts.variety === 0).map(base));
    for (const entry of scored) if (entry.parts.variety > 0 && Number.isFinite(entry.total) && !(fresh <= base(entry) + CLOSE)) { entry.total = base(entry); entry.parts = { ...entry.parts, variety: 0 }; }
    scored.sort((a, b) => (Math.abs(a.total - b.total) < TIE ? 0 : a.total - b.total));
    // A judge's decision stands where it can be drawn. With none, the best score; and where nothing fits, the stack - whose overflow is the caller's to report.
    const held = scored.find((entry) => entry.label === settings.choices?.[target.id] && Number.isFinite(entry.total));
    const best = held ?? (Number.isFinite(scored[0].total) ? scored[0] : scored.find((entry) => entry.candidate.kind === "column"));
    return { ...best.candidate, gap: gapOf(target, presets), label: best.label, picks: best.picks, families: best.families, height: best.laid.height, score: best.total,
      frames: best.laid.frames.map((box, index) => ({ id: best.blocks[index].id, ...box, ...(isGroup(best.blocks[index]) ? { children: choose(best.blocks[index], { width: box.width, height: fills(best.blocks[index]) ? box.height : null }) } : {}) })),
      scores: scored.map((entry) => ({ ...entry.candidate, label: entry.label, picks: entry.picks, total: entry.total, ...entry.parts })) };
  }
  return choose(group, frame);
}
