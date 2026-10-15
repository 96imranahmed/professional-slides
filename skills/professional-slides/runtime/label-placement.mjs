// A chart's value labels placed together, clear of one another, of the marks and of the lines, in one pass. Each label
// offers the frames it may take in its order of preference; it takes the first whose ink clears every label placed before
// it, every box to keep out of (markers, the period labels' band) and every line, inside the band it may print in, and a
// label with no clear frame is left out - the caller then reads the chart off its value axis. Labels are taken in the order
// given, so the subject's go first. Each series' labels were placed alone before: two lines that met printed their values
// on each other, and a value at zero set under its marker printed on the year under the axis.
import { resolveStyle } from "./core.mjs";
import { inkBox } from "./validate-overlap.mjs";

/** The ink a label prints in `frame`, measured as the scene's overlap checks measure it (validate-overlap.mjs inkBox). */
export function labelInk(frame, text, style) {
  return inkBox({ type: "text", text: String(text), frame, style: resolveStyle(style) });
}

const meets = (a, b, pad) => a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;

/** Whether the segment `{ x1, y1, x2, y2 }` passes through `box`. */
function crosses(box, { x1, y1, x2, y2 }) {
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2));
  for (let i = 0; i <= steps; i++) {
    const x = x1 + (x2 - x1) * i / steps, y = y1 + (y2 - y1) * i / steps;
    if (x > box.x + 0.5 && x < box.x + box.width - 0.5 && y > box.y + 0.5 && y < box.y + box.height - 0.5) return true;
  }
  return false;
}

/**
 * `labels`: [{ text, align, frames: [frame, ...] }] in priority order; `style(align)` the label's style at an alignment.
 * `keepOut`: boxes no label may meet; `lines`: segments no label may lie across; `within`: the box a label's ink must stay
 * inside. Returns the labels that found a frame, each with `frame` and `align` set to the frame chosen, and `dropped`, the
 * count left out.
 */
export function placeLabels(labels, { style, keepOut = [], lines = [], within = null, pad = 2 } = {}) {
  const taken = [], placed = [];
  let dropped = 0;
  for (const label of labels) {
    const choice = label.frames.map((frame) => ({ frame: frame.frame ?? frame, align: frame.align ?? label.align ?? "center" })).find(({ frame, align }) => {
      const ink = labelInk(frame, label.text, style(align));
      if (within && (ink.x < within.x - 1 || ink.y < within.y - 1 || ink.x + ink.width > within.x + within.width + 1 || ink.y + ink.height > within.y + within.height + 1)) return false;
      return ![...taken, ...keepOut].some((box) => meets(ink, box, pad)) && !lines.some((line) => crosses(ink, line));
    });
    if (!choice) { dropped += 1; continue; }
    taken.push(labelInk(choice.frame, label.text, style(choice.align)));
    placed.push({ ...label, frame: choice.frame, align: choice.align });
  }
  return { placed, dropped };
}

/**
 * A straight rule - a reference, an average, an event's dashed line - broken where it would run through a label's ink or a
 * box (`boxes`, a callout's frame), as the runs left between them: `[{ x1, y1, x2, y2 }]`. A label sits on the rule's line
 * only where the rule gives way to it: the small multiples' reference struck through the value over a column at the
 * panel's average, and the BA retest's Covid-grounding rule ran through "207,000 flights", the value at the very period it
 * marks.
 */
export function ruleAround({ x1, y1, x2, y2 }, labels, { gap = 3, boxes = [] } = {}) {
  const across = Math.abs(y2 - y1) < 0.5;
  const [from, to] = across ? [Math.min(x1, x2), Math.max(x1, x2)] : [Math.min(y1, y2), Math.max(y1, y2)];
  const at = across ? y1 : x1;
  // Whether the rule meets a label is read off its ink; how much of the rule gives way, along a rule across the page by the
  // figure's ink (a label's slot is far wider than its figure), up the page by the label's line (its frame).
  const cuts = [...labels.map((label) => ({ ink: labelInk(label.frame, label.text, label.style), frame: label.frame })), ...boxes.map((box) => ({ ink: box, frame: box }))]
    .filter(({ ink }) => (across ? ink.y - gap < at && ink.y + ink.height + gap > at : ink.x - gap < at && ink.x + ink.width + gap > at))
    .map(({ ink, frame }) => (across ? [ink.x - gap, ink.x + ink.width + gap] : [frame.y - gap, frame.y + frame.height + gap]))
    .sort((a, b) => a[0] - b[0]);
  const runs = [];
  let cursor = from;
  for (const [start, end] of [...cuts, [to, to]]) {
    if (start > cursor + 1) runs.push([cursor, Math.min(start, to)]);
    cursor = Math.max(cursor, end);
  }
  return runs.map(([a, b]) => (across ? { x1: a, y1: at, x2: b, y2: at } : { x1: at, y1: a, x2: at, y2: b }));
}

/**
 * Labels stacked in one column - a line's end labels, a slope's names at either side, a stacked area's layer values - each
 * set at its mark's height and pushed apart to `step` px between their tops, within `[top, bottom]` (the last label's top
 * no lower than `bottom - step`). `ys`: the tops wanted; returns the tops given, in the same order. One rule where three
 * charts kept a copy each, and the stacked area kept none: two thin layers printed their values on each other.
 */
export function spreadApart(ys, step, top, bottom) {
  const rows = ys.map((y, index) => ({ index, y })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < rows.length; i++) rows[i].y = Math.max(rows[i].y, rows[i - 1].y + step);
  const overflow = rows.length ? rows.at(-1).y + step - bottom : 0;
  if (overflow > 0) for (const row of rows) row.y -= overflow;
  for (let i = rows.length - 2; i >= 0; i--) rows[i].y = Math.min(rows[i].y, rows[i + 1].y - step);
  if (rows.length && rows[0].y < top) { const shift = top - rows[0].y; for (const row of rows) row.y += shift; }
  const out = [];
  for (const row of rows) out[row.index] = row.y;
  return out;
}
