// Dated stages: the timeline and the roadmap when their stages carry a date
// and what happens at it.
//
// A strip of four labels on a rail is a strip, and it is drawn as one
// (registry-process.mjs processNodes). A schedule a page rests on says more:
// each stage has its date or period and a sentence of what happens then. Set
// as small bold labels on a rail drawn in proportion to its frame, those
// stages left most of the page empty and their sentences were not drawn at
// all, so the page was refused for a band of nothing and for being short of
// words it had been given.
//
// Here each stage is set as what it is - when, what, and the detail at
// reading size - and the group is sized to its content from the top of its
// frame, in whichever of two arrangements suits the frame it is given:
//
//   across  the stages in columns: the date over a marker on a rail (a
//           timeline) or over a phase block (a roadmap), the detail beneath
//   down    the stages in rows: the date at the left, the marker on a rail
//           running down (or the phase block), the label and detail beside
//
// A wide, shallow frame takes the columns; a frame with height to spare takes
// the rows, whose detail wraps less and so reads faster, and fills it. The
// gaps open by a capped rhythm and no further (`ceiling`): past it the page
// keeps the rest as margin, and the commentary sits against the schedule.
// `orientation: "across" | "down"` on the exhibit settles it by hand.
import { token, tokenValue, ellipsePrimitive, rectPrimitive, shapePrimitive, stableId, textPrimitive, readableOn } from "./core.mjs";
import { measureAt } from "./draw.mjs";
import { BODY, COMPACT, INK, SECONDARY, PRIMARY, SURFACE, RULE, HAIRLINE, STANDARD, SMALL_RADIUS, textStyle, boxStyle, openLine } from "./registry-shared.mjs";

export const STAGE_TOKENS = ["font.body", "type.heading", "type.body", "type.compact", "color.ink", "color.textSecondary", "color.componentPrimary",
  "color.surface", "color.surfaceTint", "color.rule", "color.onPrimary", "line.hairline", "line.standard", "radius.round", "radius.small", "radius.none",
  "space.1", "space.2", "space.3", "space.4", "space.5", "icon.small", "icon.medium"];

const HEADING = token("type.heading");
const v = (name) => tokenValue(token(name));
const present = (value) => value !== undefined && value !== null && String(value).trim() !== "";

/** A stage as written - a label, or { label, date | period, maturity, text | detail } - as { label, when, text }. */
function stageOf(item, index, id) {
  const stage = typeof item === "string" ? { label: item } : item;
  if (!stage || typeof stage.label !== "string" || !stage.label.trim()) throw new Error(`${id} stage ${index + 1} requires a label`);
  const when = [stage.date ?? stage.period, stage.maturity].filter(present).map(String).join(" · ");
  const text = stage.text ?? stage.detail;
  return { label: stage.label.trim(), when, text: present(text) ? String(text).trim() : "" };
}

/** Whether any stage carries its date or its detail: the stages are then set by this module, not as a strip of labels. */
export const detailedStages = (items) => Array.isArray(items) && items.some((item) => item && typeof item === "object" && [item.date, item.period, item.maturity, item.text, item.detail].some(present));

const measure = (text, width, size, bold = false) => measureAt(text, width, { size, bold });

// The columns: every stage's date on one line of dates, its marker or block on
// one line, its label and detail beneath. Rows of the grid take the tallest
// cell, so the stages align across.
function across(frame, stages, roadmap) {
  const span = frame.width / stages.length, inset = v("space.2"), width = span - 2 * inset;
  if (width <= 0) throw new Error("the stages are too many for the width");
  const chevron = roadmap ? v("space.3") + inset : 0;
  const cells = stages.map((stage) => ({
    when: stage.when ? measure(stage.when, width, COMPACT, true) : null,
    label: measure(stage.label, roadmap ? width - 2 * chevron : width, HEADING, true),
    text: stage.text ? measure(stage.text, width, BODY) : null,
  }));
  const tallest = (key) => Math.max(0, ...cells.map((cell) => cell[key]?.height ?? 0));
  const whenHeight = tallest("when"), labelHeight = tallest("label"), textHeight = tallest("text");
  const marker = v("icon.medium"), headHeight = roadmap ? labelHeight + 2 * inset : marker;
  // What may open, as the wave roadmap's gaps do: the date from its marker a
  // little, the detail from the head more, and no gap past 56px - wider, and
  // the detail stops reading as its stage's.
  const slots = { when: whenHeight ? v("space.2") : 0, text: textHeight ? 40 : 0 };
  const growth = slots.when + slots.text;
  const place = (spare) => {
    const share = (key) => (growth ? slots[key] * spare / growth : 0);
    const headTop = whenHeight ? whenHeight + v("space.2") + share("when") : 0;
    const labelTop = roadmap ? headTop + inset : headTop + headHeight + v("space.2");
    const textTop = (roadmap ? headTop + headHeight : labelTop + labelHeight) + v("space.2") + share("text");
    return { headTop, labelTop, textTop, height: (textHeight ? textTop + textHeight : roadmap ? headTop + headHeight : labelTop + labelHeight) + inset };
  };
  return { orientation: "across", cells, span, inset, width, chevron, marker, whenHeight, labelHeight, headHeight, growth, place, natural: place(0).height };
}

// The rows: the dates in a column at the left, then the rail and its markers
// (a timeline) or each stage's label in a filled block (a roadmap), then the
// detail - under the label on a timeline, beside the block on a roadmap. A
// roadmap's rows have a roomier setting too (`stacked`): the period under the
// label inside the block, which a frame with the height for it takes.
function down(frame, stages, roadmap, stacked = false) {
  const gap = v("space.4"), inset = v("space.2"), marker = v("icon.small");
  const whens = stages.map((stage) => (stage.when ? measure(stage.when, frame.width * 0.2, COMPACT, true) : null));
  const whenWidth = stacked ? 0 : Math.ceil(Math.max(0, ...whens.map((m) => m?.width ?? 0)));
  const headX = whenWidth ? whenWidth + gap : 0;
  // A block is as wide as its longest label set on one line, to three tenths
  // of the frame, with a pixel or two to spare so a label measured on one
  // line is drawn on one.
  const blockCap = Math.round(frame.width * 0.3);
  const blockWidth = roadmap ? Math.min(blockCap, Math.ceil(Math.max(...stages.map((stage) => measure(stage.label, blockCap - 2 * inset, HEADING, true).width))) + 2 * inset + 2) : 0;
  const textX = headX + (roadmap ? blockWidth : marker) + gap, textWidth = frame.width - textX;
  if (textWidth < 120) throw new Error("the stages need more width for their detail");
  const cells = stages.map((stage, index) => {
    const label = measure(stage.label, roadmap ? blockWidth - 2 * inset : textWidth, HEADING, true);
    const text = stage.text ? measure(stage.text, textWidth, BODY) : null;
    const block = roadmap ? label.height + (stacked && whens[index] ? v("space.1") + whens[index].height : 0) + 2 * inset : 0;
    const body = roadmap ? (text?.height ?? 0) : label.height + (text ? v("space.1") + text.height : 0);
    return { when: whens[index], label, text, block, height: Math.max(block, body, marker) };
  });
  const rowGap = v("space.3"), growth = (stages.length - 1) * (v("space.5") - rowGap);
  const natural = cells.reduce((sum, cell) => sum + cell.height, 0) + rowGap * (stages.length - 1);
  return { orientation: "down", stacked, cells, gap, inset, marker, whenWidth, headX, blockWidth, textX, textWidth, rowGap, growth, natural };
}

/**
 * The stages laid out in `frame`: the columns where they hold most of its
 * height or the height is not yet known, otherwise the rows where they fit.
 * `height` is what it takes with the rhythm its frame allows, `ceiling` the
 * most it can take legibly.
 */
export function stagesLayout(frame, props, { roadmap = false, id = "schedule" } = {}) {
  if (!Array.isArray(props.items) || !props.items.length) throw new Error(`${id} requires ordered stages`);
  if (props.orientation !== undefined && !["across", "down"].includes(props.orientation)) throw new Error(`${id}: \`orientation\` is "across" (the stages in columns) or "down" (the stages in rows)`);
  const stages = props.items.map((item, index) => stageOf(item, index, id));
  const attempt = (build, stacked) => { try { return build(frame, stages, roadmap, stacked); } catch (error) { return { error }; } };
  const stackable = roadmap && stages.some((stage) => stage.when);
  const options = (props.orientation ? [props.orientation] : ["across", "down"]).flatMap((name) => (name === "across" ? [attempt(across)] : [attempt(down, false), ...(stackable ? [attempt(down, true)] : [])]));
  const drawn = options.filter((option) => !option.error);
  if (!drawn.length) throw new Error(`${id}: ${options[0].error.message}; use fewer stages, shorter labels or a wider frame`);
  const bounded = Number.isFinite(frame.height);
  const fitting = bounded ? drawn.filter((option) => option.natural <= frame.height + 0.01) : drawn;
  // The columns are the conventional reading, kept where they already hold
  // most of the frame. Otherwise the rows, where they fit: their detail runs
  // the frame's width instead of a column's, so it wraps less and takes the
  // height the frame has. A frame too short for the rows takes the columns.
  // Of the rows' settings, the roomiest that fits.
  const pick = (name) => fitting.filter((option) => option.orientation === name).reduce((best, option) => (!best || option.natural > best.natural ? option : best), null);
  const chosen = !bounded ? drawn[0]
    : fitting.length ? (pick("across") && pick("across").natural >= 0.8 * frame.height ? pick("across") : pick("down") ?? fitting[0])
    : drawn.reduce((best, option) => (option.natural < best.natural ? option : best));
  const spare = bounded ? Math.max(0, Math.min(chosen.growth, frame.height - chosen.natural)) : 0;
  return { ...chosen, stages, spare, height: chosen.natural + spare, ceiling: chosen.natural + chosen.growth };
}

/** The nodes of a dated timeline (`roadmap: false`) or roadmap in `frame`. */
export function stagesNodes({ id, frame, props, roadmap = false }) {
  const L = stagesLayout(frame, props, { roadmap, id });
  if (L.natural > frame.height + 0.01) throw new Error(`${id}: the stages need ${Math.ceil(L.natural)}px and have ${Math.floor(frame.height)}px; cut the detail, use fewer stages, or give the schedule the page's height`);
  const prefix = roadmap ? "roadmap" : "timeline";
  const nodes = [];
  const say = (key, index, layout, box, size, color, bold, align = "left", valign = "top") => nodes.push(textPrimitive({ id: stableId(id, key, index), role: `${prefix}-${key}`, frame: box, text: layout.text,
    style: { ...textStyle(size, color, bold, align, valign), lineHeight: layout.lineHeight, wrap: false }, data: { textLayout: layout, stage: index } }));
  const blockFill = token("color.surfaceTint");
  const active = (index) => props.active === index;
  if (L.orientation === "across") {
    const at = L.place(L.spare);
    const railY = frame.y + at.headTop + L.headHeight / 2;
    if (!roadmap) nodes.push(openLine(stableId(id, "rail"), frame.x, railY, frame.x + frame.width, railY, `${prefix}-rail`, RULE, STANDARD, { endArrow: true }));
    L.cells.forEach((cell, index) => {
      const x = frame.x + index * L.span + L.inset;
      if (cell.when) say("when", index, cell.when, { x, y: frame.y + L.whenHeight - cell.when.height, width: L.width, height: cell.when.height }, COMPACT, SECONDARY, true, roadmap ? "center" : "left");
      if (roadmap) {
        // One chevron a stage, abutting the next, so the row reads as one sequence.
        const fill = active(index) ? PRIMARY : blockFill;
        nodes.push(shapePrimitive({ id: stableId(id, "phase", index), role: "roadmap-phase-surface", geometry: "chevron", frame: { x: frame.x + index * L.span + 1, y: frame.y + at.headTop, width: L.span - 2, height: L.headHeight },
          style: boxStyle(fill, "none", HAIRLINE, token("radius.none")), data: { stage: index } }));
        say("label", index, cell.label, { x: x + L.chevron, y: frame.y + at.headTop, width: L.width - 2 * L.chevron, height: L.headHeight }, HEADING, readableOn(INK, fill), true, "center", "mid");
      } else {
        nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: "timeline-marker", frame: { x, y: railY - L.marker / 2, width: L.marker, height: L.marker },
          style: boxStyle(props.active === undefined || active(index) ? PRIMARY : SURFACE, PRIMARY, STANDARD, token("radius.round")), data: { stage: index } }));
        say("label", index, cell.label, { x, y: frame.y + at.labelTop, width: L.width, height: cell.label.height }, HEADING, INK, true);
      }
      if (cell.text) say("text", index, cell.text, { x, y: frame.y + at.textTop, width: L.width, height: cell.text.height }, BODY, INK, false);
    });
    return nodes;
  }
  const rowGap = L.rowGap + (L.stages.length > 1 ? L.spare / (L.stages.length - 1) : 0);
  const railX = frame.x + L.headX + L.marker / 2;
  const rows = [];
  let y = frame.y;
  for (const cell of L.cells) { rows.push(y); y += cell.height + rowGap; }
  if (!roadmap && L.cells.length > 1) {
    const first = rows[0] + L.cells[0].label.lineHeight / 2, last = rows.at(-1) + L.cells.at(-1).label.lineHeight / 2;
    nodes.push(openLine(stableId(id, "rail"), railX, first, railX, last, `${prefix}-rail`, RULE, STANDARD));
  }
  L.cells.forEach((cell, index) => {
    const top = rows[index];
    // The date sits level with the stage's label: on its first line on a
    // timeline, at the block's middle on a roadmap - or, where the rows are
    // stacked, inside the block under the label.
    const line = roadmap ? cell.height : cell.label.lineHeight;
    if (cell.when && !L.stacked) say("when", index, cell.when, { x: frame.x, y: top + (line - cell.when.height) / 2, width: L.whenWidth, height: cell.when.height }, COMPACT, SECONDARY, true, "right");
    if (roadmap) {
      const fill = active(index) ? PRIMARY : blockFill, ink = readableOn(INK, fill);
      nodes.push(rectPrimitive({ id: stableId(id, "phase", index), role: "roadmap-phase-surface", frame: { x: frame.x + L.headX, y: top, width: L.blockWidth, height: cell.height }, style: boxStyle(fill, "none", HAIRLINE, SMALL_RADIUS), data: { stage: index } }));
      const under = L.stacked && cell.when ? v("space.1") + cell.when.height : 0, start = top + (cell.height - cell.label.height - under) / 2;
      say("label", index, cell.label, { x: frame.x + L.headX + L.inset, y: start, width: L.blockWidth - 2 * L.inset, height: cell.label.height }, HEADING, ink, true);
      if (under) say("when", index, cell.when, { x: frame.x + L.headX + L.inset, y: start + cell.label.height + v("space.1"), width: L.blockWidth - 2 * L.inset, height: cell.when.height }, COMPACT, active(index) ? ink : SECONDARY, true);
      if (cell.text) say("text", index, cell.text, { x: frame.x + L.textX, y: top + Math.max(0, (cell.height - cell.text.height) / 2), width: L.textWidth, height: cell.text.height }, BODY, INK, false);
      return;
    }
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: "timeline-marker", frame: { x: railX - L.marker / 2, y: top + (line - L.marker) / 2, width: L.marker, height: L.marker },
      style: boxStyle(props.active === undefined || active(index) ? PRIMARY : SURFACE, PRIMARY, STANDARD, token("radius.round")), data: { stage: index } }));
    say("label", index, cell.label, { x: frame.x + L.textX, y: top, width: L.textWidth, height: cell.label.height }, HEADING, INK, true);
    if (cell.text) say("text", index, cell.text, { x: frame.x + L.textX, y: top + cell.label.height + v("space.1"), width: L.textWidth, height: cell.text.height }, BODY, INK, false);
  });
  return nodes;
}
