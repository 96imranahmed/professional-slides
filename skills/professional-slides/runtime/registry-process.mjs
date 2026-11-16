// Process, roadmap and tree: the process steps and chevron process, the
// initiative rollout and highlight strip, the roadmap (with its wave-column
// and phase-workstream variants), the timeline (with its dated schedules), the
// journey, the tree and the organisation chart.
import { token, tokenValue, ellipsePrimitive, rectPrimitive, stableId, insetFrame, shapePrimitive, houseStyle, readableOn } from "./core.mjs";
import { setText, drawText, oneLineEach, TEXT_ROLE_TOKENS } from "./text-roles.mjs";
import { contrastRatio } from "./color.mjs";
import { routeConnector } from "./routing.mjs";
import { renderPhaseWorkstreams, measurePhaseWorkstreams, PHASE_WORKSTREAM_TOKENS, PHASE_WORKSTREAM_VARIANTS } from "./phase-workstreams.mjs";
import { renderPhaseHierarchy, QUALITATIVE_TOPOLOGY_TOKENS, PHASE_HIERARCHY_SAMPLE } from "./qualitative-topology.mjs";
import { timeGrid, datedLanes, SCHEDULE_TOKENS, SCHEDULE_VARIANTS } from "./schedules.mjs";
import { detailedStages, stagesLayout, stagesNodes, STAGE_TOKENS } from "./schedule-stages.mjs";
import { INK, SECONDARY, PRIMARY, SURFACE, MUTED_SURFACE, RULE, WHITE, HAIRLINE, STANDARD, SMALL_RADIUS,
  boxStyle, openLine, PRIMARY_TINT, component, listLayout, listNodes, refineVariantAxes } from "./registry-shared.mjs";

const v = (name) => tokenValue(token(name));
const present = (value) => value !== undefined && value !== null && String(value).trim() !== "";
const MARKER = 36;

/**
 * A stage of a strip set in its roles (text-roles.mjs) in a column `width` wide: its label the stage's bold line of body
 * text, its period or maturity read off it as a schedule's dates are (furniture, `axis`), and its detail a note under
 * them, each at its reading measure - or, where `across` says every detail of the strip is one line, across the column
 * (text-roles.mjs oneLineEach). The height is the height drawn.
 */
function stageTexts(item, width, across = false) {
  const label = setText("body", item.label, width, { bold: true });
  const when = [item.period, item.maturity].filter(present).join("\n");
  const qualifier = when ? setText("axis", when, width, { bold: true }) : null;
  const detail = present(item.detail) ? setText("note", String(item.detail), width, { lines: across }) : null;
  const parts = [label, qualifier, detail].filter(Boolean), gap = v("space.1");
  return { label, qualifier, detail, gap, height: parts.reduce((sum, part) => sum + part.height, 0) + gap * (parts.length - 1) };
}

function stageNodes(id, index, texts, at, align) {
  const nodes = [];
  let y = at.y;
  for (const [key, role, part] of [["step-label", "process-label", texts.label], ["step-period", "process-period", texts.qualifier], ["step-detail", "process-detail", texts.detail]]) {
    if (!part) continue;
    nodes.push(drawText(stableId(id, key, index), role, { x: at.x, y, width: at.width }, part, { align }));
    y += part.height + texts.gap;
  }
  return nodes;
}

/** The number in a stage's marker, centred on it. */
function markerNumber(id, index, frame, color) {
  const set = setText("mark", String(index + 1), frame.width);
  return drawText(stableId(id, "step-number", index), "process-number", { x: frame.x, y: frame.y + (frame.height - set.height) / 2, width: frame.width }, set, { color, align: "center" });
}

const stagesOf = (id, props) => {
  const items = (props.items || []).map((item) => (typeof item === "string" ? { label: item } : item));
  if (!items.length) throw new Error(`${id} requires ordered stages`);
  items.forEach((item, index) => { if (typeof item?.label !== "string" || !item.label.trim()) throw new Error(`${id} stage ${index + 1} requires a label`); });
  return items;
};

/**
 * A strip of stages across its frame, measured: each stage's text under its marker in its column (on a roadmap, in a
 * phase band), a journey's touchpoint over the marker. The rail sits where the proportion of the frame puts it (48% of
 * the height, 32% on a roadmap) as far as the text above and below it lets it, and the strip needs `natural` px: the
 * tallest stage's text, the marker and the touchpoints, which is what it refuses below.
 */
function processLayout(frame, props, { roadmap = false, journey = false, id = "process" } = {}) {
  const items = stagesOf(id, props);
  const span = frame.width / items.length, inset = v("space.2");
  const labelWidth = span - (roadmap ? 20 + 2 * inset : 12);
  if (labelWidth < 48) throw new Error(`${id}: ${items.length} stages across ${Math.floor(frame.width)}px leave each ${Math.floor(labelWidth)}px for its label; use fewer stages or give the process more width`);
  const across = oneLineEach("note", items.map((item) => item.detail).filter(present).map(String), labelWidth);
  const stages = items.map((item) => stageTexts(item, labelWidth, across));
  const touch = journey ? items.map((item) => setText("note", present(item.touchpoint) ? item.touchpoint : "Touchpoint", span - 16)) : [];
  const touchHeight = Math.max(0, ...touch.map((t) => t.height)), touchGap = journey ? v("space.3") : 0;
  const tallest = Math.max(...stages.map((stage) => stage.height));
  // Above the rail's centre: the touchpoints and half the marker. Below it: half the marker, the 10px under it, the text
  // (on a roadmap in its band, padded).
  const above = touchHeight + touchGap + MARKER / 2, band = roadmap ? tallest + 2 * inset : tallest, below = MARKER / 2 + 10 + band;
  return { items, span, inset, labelWidth, stages, touch, touchHeight, touchGap, tallest, band, above, below, natural: above + below, texts: [...stages.flatMap((stage) => [stage.label, stage.qualifier, stage.detail]), ...touch] };
}

// The frame a strip can use is held to a quarter more than its sample height, or its natural height where that is more:
// a rail drawn in proportion to a taller frame only opens a band of air above it and another under the labels; past
// that the page keeps the rest as its bottom margin.
function processCeiling(frame, props, roadmap = false, sample = roadmap ? 360 : 280, journey = false) {
  if (!Number.isFinite(frame.width)) return null;
  let natural;
  try { natural = processLayout(frame, props, { roadmap, journey }).natural; } catch { return null; }
  return Math.ceil(Math.max(natural + 1, sample * 1.25));
}

// A frame taller than half its width - a process beside its commentary, or in
// a panel - is a column, and a rail across it is a band in the middle of air:
// the steps run down the column instead, each beside its marker, with the
// stage's detail under its label.
const VERTICAL_RATIO = 0.5;

/** The column: each stage's row as tall as its text (or its marker), the rows sharing what height is left between them. */
function verticalLayout(frame, items, id) {
  const gap = v("space.2") * 2, textWidth = frame.width - MARKER - gap;
  if (textWidth < 120) throw new Error(`${id}: the column leaves its stages ${Math.floor(textWidth)}px for their text; give the process more width`);
  // Details that each sit on one line across the row are set so, all of them; otherwise every one stops at the measure.
  const across = oneLineEach("note", items.map((item) => item.detail).filter(present).map(String), textWidth);
  const stages = items.map((item) => stageTexts(item, textWidth, across));
  const rows = stages.map((stage) => Math.max(MARKER, stage.height)), between = v("space.3");
  return { gap, textWidth, stages, rows, between, natural: rows.reduce((sum, row) => sum + row, 0) + between * (rows.length - 1) };
}

function verticalProcessNodes({ id, frame, items, active }) {
  const L = verticalLayout(frame, items, id);
  if (L.natural > frame.height + 0.01) {
    const at = L.stages.reduce((best, stage, index) => (stage.height > L.stages[best].height ? index : best), 0);
    throw new Error(`${id}: the stages need ${Math.ceil(L.natural)}px down the column and have ${Math.floor(frame.height)}px (stage ${at + 1}, "${items[at].label}", takes ${Math.ceil(L.rows[at])}px); shorten the details, use fewer stages, or give the process more height`);
  }
  // Each row has its own height and an equal share of the spare: a stage with a long detail keeps it under its label.
  const extra = (frame.height - L.rows.reduce((sum, row) => sum + row, 0)) / items.length;
  const centres = [];
  let y = frame.y;
  for (const row of L.rows) { centres.push(y + (row + extra) / 2); y += row + extra; }
  const nodes = [], textX = frame.x + MARKER + L.gap;
  if (items.length > 1) nodes.push(openLine(stableId(id, "rail"), frame.x + MARKER / 2, centres[0], frame.x + MARKER / 2, centres.at(-1), "process-rail", PRIMARY, STANDARD));
  items.forEach((item, index) => {
    const on = active === index, y = centres[index], marker = { x: frame.x, y: y - MARKER / 2, width: MARKER, height: MARKER };
    nodes.push(ellipsePrimitive({ id: stableId(id, "step-marker", index), role: "process-marker", frame: marker, style: boxStyle(on ? PRIMARY : SURFACE, PRIMARY, STANDARD, token("radius.round")) }));
    nodes.push(markerNumber(id, index, marker, on ? WHITE : PRIMARY));
    // The block is centred on its marker, so a one-line stage reads level with its number.
    nodes.push(...stageNodes(id, index, L.stages[index], { x: textX, y: y - L.stages[index].height / 2, width: L.textWidth }, "left"));
  });
  return nodes;
}

function processNodes({ id, frame, props, roadmap = false, journey = false }) {
  const items = stagesOf(id, props);
  if (!roadmap && !journey && items.length >= 3 && frame.height > VERTICAL_RATIO * frame.width) return verticalProcessNodes({ id, frame, items, active: props.active });
  const L = processLayout(frame, { ...props, items }, { roadmap, journey, id });
  if (L.natural > frame.height + 0.01) {
    const at = L.stages.findIndex((stage) => stage.height === L.tallest);
    throw new Error(`${id}: stage ${at + 1}, "${items[at].label}", needs ${Math.ceil(L.natural)}px with its marker and the frame has ${Math.floor(frame.height)}px; shorten its detail, use fewer stages so each is wider, or give the process more height`);
  }
  const nodes = [];
  const railY = frame.y + Math.min(Math.max(frame.height * (roadmap ? 0.32 : 0.48), L.above), frame.height - L.below);
  nodes.push(openLine(stableId(id, "rail"), frame.x + L.span * 0.35, railY, frame.x + frame.width - L.span * 0.35, railY, "process-rail", PRIMARY, STANDARD));
  // A roadmap's bands take a quarter of the frame or what the tallest stage needs, whichever is more, as far as the frame
  // allows: one height for every band, so the phases read as one row.
  const bandTop = railY + MARKER / 2 + 10;
  const bandHeight = roadmap ? Math.min(Math.max(frame.height * 0.24, L.band), frame.y + frame.height - bandTop) : L.band;
  items.forEach((item, index) => {
    const center = frame.x + L.span * (index + 0.5), active = props.active === index;
    const marker = { x: center - MARKER / 2, y: railY - MARKER / 2, width: MARKER, height: MARKER };
    nodes.push(ellipsePrimitive({ id: stableId(id, "step-marker", index), role: "process-marker", frame: marker, style: boxStyle(active ? PRIMARY : SURFACE, PRIMARY, STANDARD, token("radius.round")) }));
    nodes.push(markerNumber(id, index, marker, active ? WHITE : PRIMARY));
    const stage = L.stages[index];
    if (roadmap) nodes.push(rectPrimitive({ id: stableId(id, "phase-band", index), role: "roadmap-phase", frame: { x: frame.x + L.span * index + 10, y: bandTop, width: L.span - 20, height: bandHeight }, style: boxStyle(MUTED_SURFACE, RULE, HAIRLINE, SMALL_RADIUS) }));
    const labelTop = roadmap ? bandTop + (bandHeight - stage.height) / 2 : bandTop;
    nodes.push(...stageNodes(id, index, stage, { x: center - L.labelWidth / 2, y: labelTop, width: L.labelWidth }, "center"));
    if (journey) {
      // The touchpoints share one line along their foot, over the rail.
      const touch = L.touch[index];
      nodes.push(drawText(stableId(id, "touchpoint", index), "journey-touchpoint", { x: frame.x + L.span * index + 8, y: railY - MARKER / 2 - L.touchGap - touch.height, width: L.span - 16 }, touch, { align: "center" }));
    }
  });
  return nodes;
}

const ORG_TIER_GAP_MAX = 120;
function treeNodes({ id, frame, props, organization = false }) {
  if (organization && Array.isArray(props.nodes)) {
    const nodeFrames = new Map(props.nodes.map((node) => [node.id, {
      x: frame.x + node.x * frame.width,
      y: frame.y + node.y * frame.height,
      width: node.width * frame.width,
      height: node.height * frame.height
    }]));
    const nodes = [];
    for (const [index, connector] of (props.connectors || []).entries()) {
      const from = nodeFrames.get(connector.from);
      const to = nodeFrames.get(connector.to);
      if (!from || !to) throw new Error(`${id} connector references an unknown organization node`);
      const fromX = from.x + from.width / 2;
      const fromY = from.y + from.height;
      const toX = to.x + to.width / 2;
      const toY = to.y;
      // Reserve a visible vertical port at both ends: a horizontal route along
      // a box edge is covered by its fill and appears to land on a corner.
      const obstacles = [...nodeFrames.values()];
      const portAt = (x, y, direction) => {
        const gaps = obstacles.filter(r => x > r.x && x < r.x + r.width)
          .map(r => direction > 0 ? r.y - y : y - r.y - r.height).filter(gap => gap > 0.01);
        return Math.min(tokenValue(token("space.4")), Math.min(...gaps) / 2);
      };
      const route = [{ x: fromX, y: fromY },
        ...routeConnector({ x: fromX, y: fromY + portAt(fromX, fromY, 1) }, { x: toX, y: toY - portAt(toX, toY, -1) }, obstacles),
        { x: toX, y: toY }];
      route.slice(1).forEach((point, segment) => nodes.push(openLine(stableId(id, "connector", index, segment), route[segment].x, route[segment].y, point.x, point.y, "tree-connector", SECONDARY, HAIRLINE, { from: connector.from, to: connector.to })));
    }
    for (const [index, node] of props.nodes.entries()) {
      const nodeFrame = nodeFrames.get(node.id);
      const tone = node.tone || "muted";
      const fill = tone === "primary" ? PRIMARY : tone === "dark" ? INK : MUTED_SURFACE;
      const textColor = tone === "primary" || tone === "dark" ? WHITE : INK;
      nodes.push(rectPrimitive({ id: stableId(id, "node", node.id || index), role: "organization-node", frame: nodeFrame, style: boxStyle(fill, fill, HAIRLINE, token("radius.none")) }));
      // A node's name and its detail are the chart's content: body text, bold for the name, in the box the author placed.
      const content = insetFrame(nodeFrame, 8);
      const label = setText("body", node.label, content.width, { bold: true });
      const detail = node.detail ? setText("body", node.detail, content.width) : null;
      const gap = detail ? tokenValue(token("space.2")) : 0;
      const height = label.height + gap + (detail?.height || 0);
      if (height > content.height) throw new Error(`Organization node "${node.label}" needs ${Math.ceil(height)}px for its label and detail and its box holds ${Math.floor(content.height)}px; give the node a taller box or shorten the detail`);
      const top = content.y + (content.height - height) / 2;
      nodes.push(drawText(stableId(id, "node-text", node.id || index), "node-label", { ...content, y: top }, label, { color: textColor, align: "center" }));
      if (detail) nodes.push(drawText(stableId(id, "node-detail", node.id || index), "node-text", { ...content, y: top + label.height + gap }, detail, { color: textColor, align: "center" }));
    }
    return nodes;
  }
  // The root and each role are the chart's content: body text in bold, in boxes as tall as the tallest of them needs
  // (the root at least 58px, a role at least 74px, so a tier of one-word roles keeps its proportions).
  const children = props.children || [];
  if (!children.length) throw new Error(`${id} requires the branches under its root`);
  const span = frame.width / children.length, pad = 8;
  const rootSet = setText("body", String(props.root), 180 - 2 * pad, { bold: true });
  const childSets = children.map((child, index) => {
    try { return setText("body", String(child), span - 36 - 2 * pad, { bold: true }); }
    catch (error) { throw new Error(`${organization ? "Organization role" : "Branch"} ${index + 1}, "${child}": ${error.message}; use fewer roles in the tier or a shorter name`); }
  });
  const rootHeight = Math.max(58, rootSet.height + 2 * pad), childHeight = Math.max(74, ...childSets.map((set) => set.height + 2 * pad));
  const nodes = [];
  // An organization's two tiers stand a bounded gap apart, centred in the
  // frame, joined by a bus as reporting lines are drawn; the gap past that
  // reads as two charts, and a pair of tiers pinned to the frame's top left
  // the lower third of a page empty.
  const tierGap = organization ? Math.min(ORG_TIER_GAP_MAX, Math.max(48, frame.height * 0.3)) : null;
  const needed = organization ? rootHeight + 48 + childHeight : 14 + Math.max(rootHeight + 24, frame.height * 0.52 - 14) + childHeight;
  if (needed > frame.height + 0.01) throw new Error(`${id}: the root and its ${children.length} ${organization ? "roles" : "branches"} need ${Math.ceil(needed)}px and the frame has ${Math.floor(frame.height)}px; shorten the longest name or give the chart more height`);
  const top = organization ? frame.y + Math.max(0, (frame.height - (rootHeight + tierGap + childHeight)) / 2) : frame.y + 14;
  const root = { x: frame.x + frame.width / 2 - 90, y: top, width: 180, height: rootHeight };
  nodes.push(rectPrimitive({ id: stableId(id, "root"), role: organization ? "organization-root" : "tree-root", frame: root, style: boxStyle(PRIMARY, PRIMARY, STANDARD, SMALL_RADIUS) }));
  nodes.push(drawText(stableId(id, "root-text"), "node-label", { x: root.x + pad, y: root.y + (root.height - rootSet.height) / 2, width: root.width - 2 * pad }, rootSet, { color: WHITE, align: "center" }));
  const childY = organization ? root.y + root.height + tierGap : Math.max(frame.y + frame.height * 0.52, root.y + root.height + 24), busY = (root.y + root.height + childY) / 2;
  if (organization) {
    const centres = children.map((_, index) => frame.x + span * index + span / 2);
    nodes.push(openLine(stableId(id, "connector", "stem"), root.x + root.width / 2, root.y + root.height, root.x + root.width / 2, busY, "tree-connector", SECONDARY, HAIRLINE));
    nodes.push(openLine(stableId(id, "connector", "bus"), Math.min(...centres), busY, Math.max(...centres), busY, "tree-connector", SECONDARY, HAIRLINE));
  }
  children.forEach((child, index) => {
    const childFrame = { x: frame.x + span * index + 18, y: childY, width: span - 36, height: childHeight };
    const centerX = childFrame.x + childFrame.width / 2;
    if (organization) nodes.push(openLine(stableId(id, "connector", index), centerX, busY, centerX, childFrame.y, "tree-connector", SECONDARY, HAIRLINE));
    else nodes.push(openLine(stableId(id, "connector", index), root.x + root.width / 2, root.y + root.height, centerX, childFrame.y, "tree-connector", SECONDARY, HAIRLINE));
    // An organization tints the role it names (`highlight`, its place from 0) and no other: a first role tinted by default
    // read as singled out with nothing on the page saying why.
    const tinted = organization ? props.highlight === index : index === 0;
    nodes.push(rectPrimitive({ id: stableId(id, "child", index), role: organization ? "organization-node" : "tree-node", frame: childFrame, style: boxStyle(tinted ? PRIMARY_TINT : SURFACE, RULE, HAIRLINE, SMALL_RADIUS) }));
    const set = childSets[index];
    nodes.push(drawText(stableId(id, "child-text", index), "node-label", { x: childFrame.x + pad, y: childFrame.y + (childFrame.height - set.height) / 2, width: childFrame.width - 2 * pad }, set, { align: "center" }));
  });
  return nodes;
}

// A row named by a code (A, B, 1) takes the disc; a row named in words takes
// a column of its own, as wide as its longest name allows, the disc dropped.
const ROLLOUT_CODE_CHARS = 3, ROLLOUT_LABEL_MAX = 200;
// The years over the columns and a row's name are the rollout's content, set in bold heading type (`lead`); a code in
// the row's disc is a mark. The phases in the chevrons are a grid's dense cells - a few words each, read across the row
// against the year above - and are set as cells (furniture, `cell`), measured in the chevron's width and refused where
// a row is too low for them rather than set smaller.
function rolloutLayout(frame, props) {
  const years = props.years || ["20xx", "20xx", "20xx"];
  const rows = props.rows || [];
  const named = rows.some((row) => String(row.label ?? "").length > ROLLOUT_CODE_CHARS);
  const labelWidth = named ? Math.min(ROLLOUT_LABEL_MAX, Math.max(...rows.map((row) => Math.ceil(setText("lead", String(row.label ?? ""), ROLLOUT_LABEL_MAX).width))) + v("space.4")) : 72;
  const contentWidth = frame.width - labelWidth, span = contentWidth / years.length;
  if (span < 80) throw new Error(`The rollout's ${years.length} years leave each column ${Math.floor(span)}px; use fewer years or give the rollout the page's width`);
  const yearSets = years.map((year) => setText("lead", String(year), span - 16));
  const head = Math.max(...yearSets.map((set) => set.height)) + v("space.2");
  const rowGap = 12, top = head + 4 + v("space.4");
  const names = rows.map((row) => (named ? setText("lead", String(row.label ?? ""), labelWidth - v("space.4")) : setText("mark", String(row.label ?? ""), 48, { size: "type.heading" })));
  const cells = rows.map((row, rowIndex) => years.map((_, phaseIndex) => {
    const text = row.phases?.[phaseIndex] || "";
    if (!text) return null;
    try { return setText("cell", text, span - 50); } catch (error) { throw new Error(`Rollout row "${row.label}", ${years[phaseIndex]}: ${error.message}`); }
  }));
  const tallest = (rowIndex) => Math.max(named ? names[rowIndex].height : 0, ...cells[rowIndex].map((cell) => (cell ? cell.height + 12 : 0)));
  const natural = top + rows.reduce((sum, _, rowIndex) => sum + Math.max(32, tallest(rowIndex)), 0) + rowGap * Math.max(0, rows.length - 1);
  return { years, rows, named, labelWidth, contentWidth, span, yearSets, head, rowGap, top, names, cells, tallest, natural };
}

function initiativeRolloutNodes({ id, frame, props }) {
  const L = rolloutLayout(frame, props);
  const contentX = frame.x + L.labelWidth;
  const nodes = [];
  L.years.forEach((year, index) => {
    const x = contentX + index * L.span;
    nodes.push(drawText(stableId(id, "year", index), "rollout-year", { x: x + 8, y: frame.y + L.head - v("space.2") - L.yearSets[index].height, width: L.span - 16 }, L.yearSets[index]));
    nodes.push(openLine(stableId(id, "year-rule", index), x + 8, frame.y + L.head + 4, x + L.span - 8, frame.y + L.head + 4, "rollout-year-rule", INK, STANDARD));
  });
  const rows = L.rows, rowGap = L.rowGap;
  const rowHeight = (frame.height - L.top - rowGap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length);
  const short = rows.findIndex((_, rowIndex) => L.tallest(rowIndex) > rowHeight + 0.01);
  if (short >= 0) throw new Error(`Rollout row "${rows[short].label}" needs ${Math.ceil(L.tallest(short))}px and each row has ${Math.floor(rowHeight)}px; shorten its phases or name, use fewer rows, or give the rollout more height`);
  const fills = [INK, token("color.chartSeries2"), MUTED_SURFACE];
  rows.forEach((row, rowIndex) => {
    const y = frame.y + L.top + rowIndex * (rowHeight + rowGap), name = L.names[rowIndex];
    if (L.named) {
      nodes.push(drawText(stableId(id, "row-label", rowIndex), "rollout-row-label", { x: frame.x, y: y + (rowHeight - name.height) / 2, width: L.labelWidth - v("space.4") }, name));
    } else {
      const markerSize = Math.min(48, rowHeight * 0.68), marker = { x: frame.x + (L.labelWidth - markerSize) / 2, y: y + (rowHeight - markerSize) / 2, width: markerSize, height: markerSize };
      nodes.push(ellipsePrimitive({ id: stableId(id, "row-marker", rowIndex), role: "rollout-row-marker", frame: marker, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
      nodes.push(drawText(stableId(id, "row-label", rowIndex), "rollout-row-label", { x: marker.x, y: marker.y + (markerSize - name.height) / 2, width: markerSize }, name, { color: WHITE, align: "center" }));
    }
    L.years.forEach((_, phaseIndex) => {
      const x = contentX + phaseIndex * L.span;
      // The label reverses where the phase's fill is dark enough to carry white, whichever design sets the fill.
      const dark = contrastRatio(tokenValue(fills[phaseIndex % fills.length]), tokenValue(WHITE)) >= 4.5;
      nodes.push(shapePrimitive({ id: stableId(id, "phase", rowIndex, phaseIndex), role: "rollout-phase", geometry: "chevron", frame: { x: x + 2, y, width: L.span + (phaseIndex < L.years.length - 1 ? 10 : -2), height: rowHeight }, style: boxStyle(fills[phaseIndex % fills.length], SURFACE, STANDARD, token("radius.none")) }));
      const cell = L.cells[rowIndex][phaseIndex];
      if (cell) nodes.push(drawText(stableId(id, "phase-label", rowIndex, phaseIndex), "rollout-phase-label", { x: x + 30, y: y + (rowHeight - cell.height) / 2, width: L.span - 50 }, cell, { color: dark ? WHITE : INK, align: "center" }));
    });
  });
  return nodes;
}

function waveRoadmapLayout(frame, props) {
  const items = props.items || [];
  if (!Array.isArray(items) || !items.length) throw new Error("Wave roadmap requires at least one stage");
  const span = frame.width / items.length, inset = tokenValue(token("space.2"));
  const width = span - 2 * inset, gap = tokenValue(token("space.4"));
  const markerSize = tokenValue(token("icon.medium"));
  // A wave's range is read off it as a schedule's dates are (furniture, `axis`); its heading is its lead and its lists
  // body text, each at its reading measure (text-roles.mjs).
  const set = (name, value, bold) => (value ? setText(name, value, width, { bold }) : null);
  const list = (label, values) => {
    if (values !== undefined && !Array.isArray(values)) throw new Error(`Roadmap ${label} must be an array`);
    return values?.length ? `${label}\n${values.map(value => `▪  ${value}`).join("\n")}` : "";
  };
  // Surface treatment (core.mjs `style.timeline`): five dots on a hairline rail
  // with small type under them is a page of gaps. Under `blocks` each stage's
  // heading is set in a filled chevron - the phase block - on a heavier spine,
  // so the sequence reads as a row of solid phases before any list is read.
  // The chevron's notch and point take half its height at each end, so the
  // heading is measured that much narrower.
  const blocks = houseStyle("style.timeline") === "blocks";
  const blockPad = blocks ? tokenValue(token("space.2")) : 0;
  const cells = items.map((item, index) => ({
    range: set("axis", item.range || "", true),
    heading: setText("lead", item.heading || item.label || `Wave ${index + 1}`, blocks ? width - 2 * (tokenValue(token("space.3")) + blockPad) : width),
    activities: set("body", list("Key activities", item.activities)),
    deliverables: set("body", list("Main deliverables", item.deliverables))
  }));
  const maximum = key => Math.max(0, ...cells.map(cell => cell[key]?.height ?? 0));
  const rangeHeight = maximum("range"), headingHeight = maximum("heading");
  const activitiesHeight = maximum("activities"), deliverablesHeight = maximum("deliverables");
  // The room the roadmap can take as rhythm rather than leave as a gap between
  // its last deliverable and the commentary under it. The stages open up: most
  // between the rail and the lists and between the two lists (up to 40px more
  // each, so no gap passes 56px - wider, and the lists read as separate blocks
  // with a band of nothing between them), less between the heading and its marker (32px) - a
  // heading that drifts further from its marker stops labelling it - and least
  // between the date and the heading (8px). Proportionally, so the gaps keep
  // their relation to one another; past the caps the page keeps the rest as
  // its bottom margin (`ceilingSize` in core).
  const slots = { range: rangeHeight ? tokenValue(token("space.2")) : 0, heading: 32, activities: activitiesHeight || deliverablesHeight ? 40 : 0, deliverables: activitiesHeight && deliverablesHeight ? 40 : 0 };
  const growth = Object.values(slots).reduce((sum, value) => sum + value, 0);
  const natural = (spare) => {
    const share = (key) => growth ? slots[key] * spare / growth : 0;
    const headingTop = (rangeHeight ? rangeHeight + tokenValue(token("space.3")) + share("range") : 0) + blockPad;
    const railY = headingTop + headingHeight + blockPad + gap + share("heading") + markerSize / 2;
    const activitiesTop = railY + markerSize / 2 + gap + share("activities");
    const deliverablesTop = activitiesTop + activitiesHeight + (activitiesHeight && deliverablesHeight ? gap + share("deliverables") : 0);
    const height = (deliverablesHeight ? deliverablesTop + deliverablesHeight : activitiesHeight ? activitiesTop + activitiesHeight : railY + markerSize / 2) + inset;
    return { headingTop, railY, activitiesTop, deliverablesTop, height };
  };
  const base = natural(0);
  const spare = Number.isFinite(frame.height) ? Math.max(0, Math.min(growth, frame.height - base.height)) : 0;
  return { cells, span, inset, width, markerSize, rangeHeight, headingHeight, blocks, blockPad, ...natural(spare), naturalHeight: base.height, ceiling: base.height + growth };
}

function waveRoadmapNodes({ id, frame, props }) {
  const layout = waveRoadmapLayout(frame, props);
  if (layout.height > frame.height + 0.01) throw new Error(`Roadmap ${id} complete activity and deliverable rows need ${layout.height.toFixed(1)}px, but only ${frame.height}px is allocated; widen, regroup or split the stages`);
  const railY = frame.y + layout.railY;
  const nodes = [openLine(stableId(id, "rail"), frame.x, railY, frame.x + frame.width, railY, "roadmap-rail", RULE, layout.blocks ? token("line.medium") : STANDARD, { endArrow: true })];
  // The phase block is the filled surface, not the primary: five chevrons in a
  // saturated brand colour shouted over the page they head. The colour stays
  // on the markers; the blocks carry the weight in the neutral surface.
  const blockFill = token("color.surfaceTint"), chevron = tokenValue(token("space.3")) + layout.blockPad;
  layout.cells.forEach((cell, index) => {
    const x = frame.x + index * layout.span, center = x + layout.span / 2;
    if (layout.blocks) {
      // One chevron per stage, abutting the next so the row reads as one
      // sequence, the heading centred on it.
      const top = frame.y + layout.headingTop - layout.blockPad;
      nodes.push(shapePrimitive({ id: stableId(id, "phase", index), role: "roadmap-phase-surface", geometry: "chevron",
        frame: { x: x + 1, y: top, width: layout.span - 2, height: layout.headingHeight + 2 * layout.blockPad },
        style: boxStyle(blockFill, "none", HAIRLINE, token("radius.none")), data: { stage: index } }));
    }
    for (const [key, y, color, align] of [
      ["range", layout.rangeHeight - (cell.range?.height ?? 0), SECONDARY, "center"],
      ["heading", layout.headingTop + (layout.blocks ? (layout.headingHeight - cell.heading.height) / 2 : layout.headingHeight - cell.heading.height), layout.blocks ? readableOn(INK, blockFill) : INK, "center"],
      ["activities", layout.activitiesTop, INK, "left"],
      ["deliverables", layout.deliverablesTop, INK, "left"]
    ]) {
      const text = cell[key];
      if (!text) continue;
      // A heading on a chevron is set in the width it was measured to, clear of the notch and the point, and centred in
      // the block's height.
      const inset = key === "heading" && layout.blocks ? chevron : 0;
      nodes.push(drawText(stableId(id, key, index), `roadmap-${key}`, { x: x + layout.inset + inset, y: frame.y + y, width: layout.width - 2 * inset }, text, { color, align }));
    }
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: "roadmap-marker", frame: { x: center - layout.markerSize / 2, y: railY - layout.markerSize / 2, width: layout.markerSize, height: layout.markerSize }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
  });
  return nodes;
}

// A strip of highlights: a numbered disc over each, its heading the highlight's lead and its description a note under
// it, both at their reading measure in the column's width. The strip is as tall as its tallest column; a frame shorter
// than that is refused, naming the highlight that does not fit.
const HIGHLIGHT_DISC = 40;
function highlightStripLayout(frame, props) {
  const items = props.items || [];
  if (!items.length) throw new Error("A highlight strip needs at least one highlight");
  const span = frame.width / items.length, width = span - 12;
  if (width < 80) throw new Error(`A highlight strip's ${items.length} highlights leave each ${Math.floor(width)}px; use fewer, or give the strip the page's width`);
  const cells = items.map((item) => {
    const heading = setText("lead", item.heading || "Start highlight", width);
    const description = setText("note", item.description || "(Insert description)", width);
    return { item, heading, description, height: HIGHLIGHT_DISC + v("space.2") + heading.height + v("space.1") + description.height };
  });
  return { items, span, width, cells, height: Math.max(...cells.map((cell) => cell.height)), texts: cells.flatMap((cell) => [cell.heading, cell.description]) };
}

function highlightStripNodes({ id, frame, props }) {
  const L = highlightStripLayout(frame, props);
  const over = L.cells.findIndex((cell) => cell.height > frame.height + 0.01);
  if (over >= 0) throw new Error(`Highlight ${over + 1}, "${L.cells[over].item.heading}", needs ${Math.ceil(L.cells[over].height)}px and the strip has ${Math.floor(frame.height)}px; shorten its description or give the strip more height`);
  const nodes = [];
  L.cells.forEach((cell, index) => {
    const x = frame.x + index * L.span, disc = { x: x + L.span / 2 - HIGHLIGHT_DISC / 2, y: frame.y, width: HIGHLIGHT_DISC, height: HIGHLIGHT_DISC };
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: "highlight-marker", frame: disc, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
    const number = setText("mark", cell.item.number || String(index + 1), HIGHLIGHT_DISC, { size: "type.heading" });
    nodes.push(drawText(stableId(id, "number", index), "highlight-number", { x: disc.x, y: disc.y + (HIGHLIGHT_DISC - number.height) / 2, width: HIGHLIGHT_DISC }, number, { color: WHITE, align: "center", bold: false }));
    const top = frame.y + HIGHLIGHT_DISC + v("space.2");
    nodes.push(drawText(stableId(id, "heading", index), "highlight-heading", { x: x + 6, y: top, width: L.width }, cell.heading, { align: "center" }));
    nodes.push(drawText(stableId(id, "description", index), "highlight-description", { x: x + 6, y: top + cell.heading.height + v("space.1"), width: L.width }, cell.description, { color: INK, align: "center" }));
  });
  return nodes;
}

function defineProcess() {
  return component({
    id: "process",
    category: "relationship",
    role: "process",
    tokens: [
      "color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard",
      "line.hairline", "radius.round"
    ],
    preferredSize: { width: 900, height: 280 },
    sample: { items: ["(Insert step 1)", "(Insert step 2)", "(Insert step 3)", "(Insert step 4)"], active: 2 },
    render: ({ id, frame, props }) => ({
      nodes: processNodes({
        id,
        frame,
        props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) }
      })
    })
  });
}

function defineChevronProcess() {
  return component({
    id: "chevron-process",
    category: "relationship",
    role: "process",
    tokens: [
      "color.ink", "color.componentPrimary", "color.accent", "color.surface", "color.surfaceMuted", "color.onPrimary", "font.body", "type.heading",
      "type.body", "type.compact", "type.label", "line.hairline", "radius.none", "radius.round", "space.1", "space.3", "space.4"
    ],
    preferredSize: { width: 1160, height: 360 },
    sample: {
      items: [
        { heading: "Phase 1", label: "(Insert phase 1)", details: ["(Insert activity 1)", "(Insert activity 2)"] },
        { heading: "Phase 2", label: "(Insert phase 2)", details: ["(Insert activity 1)", "(Insert activity 2)"] },
        { heading: "Phase 3", label: "(Insert phase 3)", details: ["(Insert activity 1)", "(Insert activity 2)"] }
      ]
    },
    render: ({ id, frame, props }) => ({ nodes: chevronProcessNodes({ id, frame, props }) })
  });
}

// A chevron's notch and point each take half its height (emit_pptx.py), so the label starts past the notch. One line,
// set across the middle, runs on into the point to 18px short of its tip; lines above and below it stop where the point
// starts to narrow. Every step's label is set at one size: in bold heading type (`lead`), or a step down to bold body
// type where a label does not fit its chevron there - never below body.
const CHEVRON_HEIGHT = 70;
function chevronProcessLayout(frame, props) {
  const items = props.items;
  if (!Array.isArray(items) || !items.length) throw new Error("A chevron process needs its steps");
  const span = frame.width / items.length;
  const headings = items.map((item) => (item.heading?.trim() ? setText("lead", item.heading, span - 16) : null));
  const headingHeight = headings.some(Boolean) ? Math.max(...headings.map((set) => set?.height ?? 0)) + v("space.3") : 0;
  const bandWidth = (index) => span + (index < items.length - 1 ? v("space.4") : 0);
  const fit = (label, index, role) => {
    const at = (width) => setText(role, label, width, { bold: true });
    try { const line = at(bandWidth(index) - 54); if (line.lines.length === 1) return { layout: line, width: bandWidth(index) - 54 }; } catch { /* one line cannot hold it */ }
    try { const lines = at(bandWidth(index) - 72); return lines.height <= CHEVRON_HEIGHT - 6 ? { layout: lines, width: bandWidth(index) - 72 } : null; } catch { return null; }
  };
  const labelsAt = (role) => { const fitted = items.map((item, index) => fit(item.label, index, role)); return fitted.every(Boolean) ? fitted : null; };
  const role = labelsAt("lead") ? "lead" : "body";
  const labels = labelsAt(role);
  if (!labels) {
    const at = items.findIndex((item, index) => !fit(item.label, index, role));
    throw new Error(`The step "${items[at].label}" does not fit its chevron: ${items.length} steps across ${Math.floor(frame.width)}px leave a label ${Math.floor(bandWidth(at) - 54)}px on one line. Give the process the page's width (\`commentary: "below"\` or \`"none"\`), use fewer steps, or a shorter step name`);
  }
  const detailsTop = headingHeight + CHEVRON_HEIGHT + 20;
  const lists = items.map((item) => listLayout({ width: span - 26 }, item.details || [], { numbered: props.detailStyle === "circled-number" }));
  const tallest = Math.max(0, ...lists.map((list) => list.height));
  return { items, span, headings, headingHeight, bandWidth, labels, detailsTop, lists, natural: detailsTop + tallest, texts: [...headings, ...labels.map((l) => l.layout), ...lists.flatMap((list) => list.sets)] };
}

function chevronProcessNodes({ id, frame, props }) {
  const L = chevronProcessLayout(frame, props);
  for (const name of [props.active ?? []].flat()) if (!L.items.some((item, index) => (typeof name === "number" ? name === index : [item.label, item.heading].includes(String(name)))))
    throw new Error(`Chevron process active ${JSON.stringify(name)} is not a step's index, label or heading`);
  if (L.natural > frame.height + 0.01) {
    const at = L.lists.reduce((best, list, index) => (list.height > L.lists[best].height ? index : best), 0);
    throw new Error(`The chevron process needs ${Math.ceil(L.natural)}px and has ${Math.floor(frame.height)}px: step ${at + 1}, "${L.items[at].label}", lists ${L.lists[at].sets.length} details taking ${Math.ceil(L.lists[at].height)}px; cut its details, or give the process more height`);
  }
  // The steps a page points to (`active`: a step's index, its label or its heading, or a list of them - "Opportunity" names
  // every step under that heading) take the accent; the rest stay the process's own colour.
  const named = [props.active ?? []].flat();
  const active = (item, index) => named.some((name) => (typeof name === "number" ? name === index : [item.label, item.heading].includes(String(name))));
  const nodes = [];
  L.items.forEach((item, index) => {
    const x = frame.x + index * L.span;
    if (L.headings[index]) nodes.push(drawText(stableId(id, "heading", index), "process-heading", { x: x + 8, y: frame.y + L.headingHeight - v("space.3") - L.headings[index].height, width: L.span - 16 }, L.headings[index]));
    nodes.push(shapePrimitive({ id: stableId(id, "band", index), role: "process-band", geometry: "chevron", frame: { x, y: frame.y + L.headingHeight, width: L.bandWidth(index), height: CHEVRON_HEIGHT }, style: boxStyle(active(item, index) ? token("color.accent") : index === 0 && props.emphasizeFirst ? PRIMARY : INK, SURFACE, HAIRLINE, token("radius.none")) }));
    const { layout: label, width: labelWidth } = L.labels[index];
    nodes.push(drawText(stableId(id, "label", index), "process-label", { x: x + 36, y: frame.y + L.headingHeight + CHEVRON_HEIGHT / 2 - label.height / 2, width: labelWidth }, label, { color: WHITE, align: "center" }));
    nodes.push(...listNodes({ id: stableId(id, "details", index), x: x + 10, y: frame.y + L.detailsTop, layout: L.lists[index], rolePrefix: "process-detail" }));
  });
  return nodes;
}

function defineInitiativeRollout() {
  return component({
    id: "initiative-rollout",
    category: "relationship",
    role: "initiative-rollout",
    tokens: [
      "color.ink", "color.componentPrimary", "color.chartSeries2", "color.surfaceMuted", "color.surface", "color.onPrimary", "font.body",
      "type.heading", "type.compact", "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"
    ],
    preferredSize: { width: 1160, height: 450 },
    sample: {
      years: ["Year 1", "Year 2", "Year 3"],
      rows: [
        { label: "A", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] },
        { label: "B", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] }
      ]
    },
    render: ({ id, frame, props }) => ({ nodes: initiativeRolloutNodes({ id, frame, props }) })
  });
}

function defineHighlightStrip() {
  return component({
    id: "highlight-strip",
    category: "relationship",
    role: "highlight-strip",
    tokens: [
      "color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "radius.round"
    ],
    preferredSize: { width: 1160, height: 126 },
    sample: {
      items: [
        { number: "1", heading: "(Insert highlight)", description: "(Insert description)" },
        { number: "2", heading: "(Insert highlight)", description: "(Insert description)" },
        { number: "3", heading: "(Insert highlight)", description: "(Insert description)" }
      ]
    },
    render: ({ id, frame, props }) => ({ nodes: highlightStripNodes({ id, frame, props }) })
  });
}

function defineRoadmap() {
  return component({
    id: "roadmap",
    category: "relationship",
    role: "roadmap",
    tokens: [
      "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary",
      "color.ink", "color.textSecondary", "font.body", "type.heading", "type.compact", "type.label", "line.standard", "line.medium",
      "line.hairline", "radius.round", "radius.small", "radius.none", "color.surfaceTint"
    ],
    preferredSize: { width: 980, height: 360 },
    sample: { items: ["(Insert stage 1)", "(Insert stage 2)", "(Insert stage 3)", "(Insert stage 4)"], active: 1 },
    // Stages that carry their period or their detail are set at reading size
    // and sized to their content (schedule-stages.mjs); a row of bare labels
    // stays the strip it is.
    render: ({ id, frame, props }) => ({
      nodes: props.variant === "wave-columns"
        ? waveRoadmapNodes({ id, frame, props })
        : detailedStages(props.items) ? stagesNodes({ id, frame, props, roadmap: true })
        : processNodes({
          id,
          frame,
          props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) },
          roadmap: true
        })
    })
  });
}

function defineTimeline() {
  return component({
    id: "timeline",
    category: "relationship",
    role: "timeline",
    tokens: [
      "color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard",
      "line.hairline", "radius.round"
    ],
    preferredSize: { width: 920, height: 250 },
    sample: { items: ["Q1", "Q2", "Q3", "Q4"], active: 2 },
    // Dated stages are set at reading size and sized to their content
    // (schedule-stages.mjs); bare labels stay a numbered strip.
    render: ({ id, frame, props }) => ({
      nodes: detailedStages(props.items) ? stagesNodes({ id, frame, props })
        : processNodes({ id, frame, props: { ...props, items: props.items.map((label) => (typeof label === "string" ? { label } : label)) } })
    })
  });
}

function defineJourney() {
  return component({
    id: "journey",
    category: "relationship",
    role: "journey",
    tokens: [
      "color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact",
      "type.label", "line.standard", "line.hairline", "radius.round"
    ],
    preferredSize: { width: 960, height: 300 },
    sample: {
      items: [
        { label: "(Insert stage 1)", touchpoint: "(Insert touchpoint 1)" },
        { label: "(Insert stage 2)", touchpoint: "(Insert touchpoint 2)" },
        { label: "(Insert stage 3)", touchpoint: "(Insert touchpoint 3)" },
        { label: "(Insert stage 4)", touchpoint: "(Insert touchpoint 4)" }
      ],
      active: 3
    },
    render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props, journey: true }) })
  });
}

function defineTree() {
  return component({
    id: "tree", sizing: "fill",
    category: "relationship",
    role: "tree",
    tokens: [
      "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.rule", "color.onPrimary", "color.ink",
      "color.textSecondary", "font.body", "type.compact", "line.hairline", "line.standard", "radius.small"
    ],
    preferredSize: { width: 900, height: 360 },
    sample: {
      root: "(Insert root question)",
      children: ["(Insert branch 1)", "(Insert branch 2)", "(Insert branch 3)", "(Insert branch 4)"]
    },
    render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props }) })
  });
}

function defineOrganization() {
  return component({
    id: "organization", sizing: "fill",
    category: "relationship",
    role: "organization",
    tokens: [
      "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary",
      "color.ink", "color.textSecondary", "font.body", "type.compact", "type.body", "space.2", "space.4", "line.hairline", "line.standard",
      "radius.none", "radius.small"
    ],
    preferredSize: { width: 900, height: 360 },
    sample: { root: "(Insert parent role)", children: ["(Insert role 1)", "(Insert role 2)", "(Insert role 3)", "(Insert role 4)"] },
    render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props, organization: true }) })
  });
}

/** Process, roadmap and tree: steps and chevrons, rollouts, roadmaps, timelines, journeys, trees and organisation charts. */
export function registerProcessFamily(registry) {
  const definitions = [defineProcess(), defineChevronProcess(), defineInitiativeRollout(), defineHighlightStrip(), defineRoadmap(), defineTimeline(),
    defineJourney(), defineTree(), defineOrganization()];
  for (const definition of definitions) {
    if (["process", "roadmap", "timeline", "journey"].includes(definition.id)) {
      definition.tokens.push("space.2");
      definition.version = "2.1.0";
    }
    refineVariantAxes(definition);
    // Every member sets its words by role (text-roles.mjs) and measures what it draws, so the engine sizes its frame from
    // what it reports: its natural height (`measureContent`) and how far it can grow legibly (`measureCeiling`).
    definition.tokens = [...new Set([...definition.tokens, ...TEXT_ROLE_TOKENS])];
    if (definition.id === "process") definition.measureCeiling = ({ frame, props }) => processCeiling(frame, props, false, definition.preferredSize.height);
    if (definition.id === "journey") {
      definition.measureContent = ({ frame, props }) => processLayout(frame, props, { journey: true });
      definition.measureCeiling = ({ frame, props }) => processCeiling(frame, props, false, definition.preferredSize.height, true);
    }
    if (definition.id === "chevron-process") {
      definition.measureContent = ({ frame, props }) => ({ ...chevronProcessLayout(frame, props), height: chevronProcessLayout(frame, props).natural });
      // Drawn from the top of its frame: past its natural height a taller frame is a band under the details.
      definition.measureCeiling = ({ frame, props }) => chevronProcessLayout(frame, props).natural;
    }
    if (definition.id === "initiative-rollout") definition.measureContent = ({ frame, props }) => ({ height: rolloutLayout(frame, props).natural });
    if (definition.id === "highlight-strip") {
      definition.measureContent = ({ frame, props }) => highlightStripLayout(frame, props);
      definition.measureCeiling = ({ frame, props }) => highlightStripLayout(frame, props).height;
    }
    if (definition.id === "timeline") {
      definition.version = "2.2.0";
      definition.tokens = [...new Set([...definition.tokens, ...SCHEDULE_TOKENS])];
      definition.variants = { process: {}, ...SCHEDULE_VARIANTS, "phase-hierarchy": { preferredSize:{width:1160,height:380}, props:{...PHASE_HIERARCHY_SAMPLE,items:undefined} } };
      definition.tokens = [...new Set([...definition.tokens,...QUALITATIVE_TOPOLOGY_TOKENS])];
      definition.version = "2.3.0";
      definition.defaultVariant = "process";
      definition.variantProp = "variant";
      definition.resolveVariant = (props = {}) => {
        const variant = props.variant ?? "process";
        if (!Object.hasOwn(definition.variants, variant)) throw new Error(`Unknown timeline variant: ${variant}`);
        return variant;
      };
      const render = definition.render;
      const schedule = input => definition.resolveVariant(input.props) === "phase-hierarchy" ? renderPhaseHierarchy(input) : definition.resolveVariant(input.props) === "time-grid" ? timeGrid(input) : datedLanes(input);
      definition.render = input => definition.resolveVariant(input.props) === "process" ? render(input) : schedule(input);
      const staged = input => definition.resolveVariant(input.props) === "process" && detailedStages(input.props.items);
      definition.tokens = [...new Set([...definition.tokens, ...STAGE_TOKENS])];
      definition.measureIntrinsic = input => staged(input) ? { height: stagesLayout({ ...input.frame, height: undefined }, input.props, { id: input.id }).natural }
        : definition.resolveVariant(input.props) === "process" ? null : schedule({ ...input, id: input.id ?? "measure", frame: { ...input.frame, height: input.frame.height ?? Number.MAX_SAFE_INTEGER } });
      // A dated schedule is drawn at its natural height from the top of its
      // frame, so that height is its ceiling - any frame beyond it would be a
      // gap before the commentary; the process variant keeps its proportional
      // ceiling.
      definition.measureCeiling = input => staged(input) ? ((L) => (input.props.centre && L.stagger ? null : L.ceiling))(stagesLayout(input.frame, input.props))
        : definition.resolveVariant(input.props) === "process"
        ? processCeiling(input.frame, input.props, false, 250)
        : schedule({ ...input, id: "ceiling", frame: { ...input.frame, height: Number.MAX_SAFE_INTEGER } }).height;
    }
    if (definition.id === "roadmap") {
      definition.version = "2.2.0";
      definition.tokens.push("space.2", "space.3", "space.4", "icon.medium");
      definition.variants["wave-columns"] = { preferredSize: { width: 1160, height: 480 }, props: { items: [1, 2, 3].map((index) => ({ heading: `(Insert wave ${index} heading)`, range: `(Insert time range ${index})`, activities: ["(Insert activity)"], deliverables: ["(Insert deliverable)"] })) } };
      definition.version = "2.3.0";
      definition.tokens = [...new Set([...definition.tokens, ...PHASE_WORKSTREAM_TOKENS])];
      Object.assign(definition.variants, PHASE_WORKSTREAM_VARIANTS);
      const priorResolve = definition.resolveVariant;
      definition.resolveVariant = props => props?.variant === "phase-workstreams" ? "phase-workstreams" : priorResolve(props);
      const priorRender = definition.render;
      definition.render = input => definition.resolveVariant(input.props) === "phase-workstreams" ? renderPhaseWorkstreams(input) : priorRender(input);
      const staged = (props) => definition.resolveVariant(props) === "process" && detailedStages(props.items);
      definition.tokens = [...new Set([...definition.tokens, ...STAGE_TOKENS])];
      definition.measureIntrinsic = ({ frame, props }) => definition.resolveVariant(props) === "phase-workstreams" ? measurePhaseWorkstreams({frame,props}) : definition.resolveVariant(props) === "wave-columns" ? { height: waveRoadmapLayout({ ...frame, height: undefined }, props).naturalHeight }
        : staged(props) ? { height: stagesLayout({ ...frame, height: undefined }, props, { roadmap: true }).natural } : null;
      definition.measureCeiling = ({ frame, props }) => definition.resolveVariant(props) === "wave-columns" ? waveRoadmapLayout({ ...frame, height: undefined }, props).ceiling
        : staged(props) ? stagesLayout(frame, props, { roadmap: true }).ceiling : definition.resolveVariant(props) === "process" ? processCeiling(frame, props, true) : null;
    }
    registry.set(definition.id, definition);
  }
  return registry;
}
