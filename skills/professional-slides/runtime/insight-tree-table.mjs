import {
  ellipsePrimitive,
  linePrimitive,
  rectPrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";

const INK = token("color.ink");
const PRIMARY = token("color.componentPrimary");
const PRIMARY_TINT = token("color.componentPrimaryTint");
const SURFACE = token("color.surface");
const MUTED_SURFACE = token("color.surfaceMuted");
const RULE = token("color.rule");
const ON_PRIMARY = token("color.onPrimary");
const FONT = token("font.body");
const BODY = token("type.body");
const HEADING = token("type.heading");
const HAIRLINE = token("line.hairline");
const STANDARD = token("line.standard");
const NONE = token("radius.none");
const SMALL = token("radius.small");

export const INSIGHT_TREE_TABLE_TOKENS = Object.freeze([
  "color.ink", "color.componentPrimary", "color.componentPrimaryTint", "color.surface",
  "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.body",
  "type.heading", "space.1", "space.2", "space.3", "space.4", "space.6",
  "icon.medium", "line.hairline", "line.standard", "radius.none", "radius.small"
]);

export const INSIGHT_TREE_TABLE_GUIDANCE = Object.freeze({
  useWhen: "a root finding branches through named drivers into leaf evidence, and each leaf needs an aligned interpretation or implication",
  why: "the tree preserves causal or hierarchical logic while the aligned rows make each leaf-to-insight relationship auditable",
  actionTitle: "state the governing branch logic and the consequence it creates; do not merely label the page as an insight tree",
  extension: "one to three branches normally use executive density; four branches or six to seven leaves promote the complete page to pre-read density so titles, headers, nodes, rows, legends, and annotations step down together"
});

export const INSIGHT_TREE_TABLE_SAMPLE = Object.freeze({
  headers: { tree: "(Insert driver tree heading)", insight: "(Insert insight heading)", implication: "(Insert implication heading)" },
  root: { id: "root", label: "(Insert root finding)" },
  branches: [
    { id: "branch-a", label: "(Insert branch A)", leaves: [
      { id: "leaf-a1", label: "(Insert leaf A1)", insight: "(Insert aligned insight A1)", implications: ["(Insert implication A1)"] },
      { id: "leaf-a2", label: "(Insert leaf A2)", insight: "(Insert aligned insight A2)", implications: ["(Insert implication A2)"] }
    ] },
    { id: "branch-b", label: "(Insert branch B)", leaves: [
      { id: "leaf-b1", label: "(Insert leaf B1)", insight: "(Insert aligned insight B1)", implications: ["(Insert implication B1)"] },
      { id: "leaf-b2", label: "(Insert leaf B2)", insight: "(Insert aligned insight B2)", implications: ["(Insert implication B2)"] },
      { id: "leaf-b3", label: "(Insert leaf B3)", insight: "(Insert aligned insight B3)", implications: ["(Insert implication B3)"] }
    ] }
  ]
});

export const INSIGHT_TREE_TABLE_FOUR_BRANCH_SAMPLE = Object.freeze({
  headers: INSIGHT_TREE_TABLE_SAMPLE.headers,
  root: { id: "root", label: "(Insert root finding)" },
  branches: [
    { id: "branch-a", label: "(Insert branch A)", leaves: [
      { id: "leaf-a1", label: "(Insert leaf A1)", insight: "(Insert aligned insight A1)", implications: ["(Insert implication A1)"] },
      { id: "leaf-a2", label: "(Insert leaf A2)", insight: "(Insert aligned insight A2)", implications: ["(Insert implication A2)"] }
    ] },
    { id: "branch-b", label: "(Insert branch B)", leaves: [
      { id: "leaf-b1", label: "(Insert leaf B1)", insight: "(Insert aligned insight B1)", implications: ["(Insert implication B1)"] },
      { id: "leaf-b2", label: "(Insert leaf B2)", insight: "(Insert aligned insight B2)", implications: ["(Insert implication B2)"] }
    ] },
    { id: "branch-c", label: "(Insert branch C)", leaves: [
      { id: "leaf-c1", label: "(Insert leaf C1)", insight: "(Insert aligned insight C1)", implications: ["(Insert implication C1)"] },
      { id: "leaf-c2", label: "(Insert leaf C2)", insight: "(Insert aligned insight C2)", implications: ["(Insert implication C2)"] }
    ] },
    { id: "branch-d", label: "(Insert branch D)", leaves: [
      { id: "leaf-d1", label: "(Insert leaf D1)", insight: "(Insert aligned insight D1)", implications: ["(Insert implication D1)"] }
    ] }
  ]
});

const value = key => tokenValue(token(key));
const boxStyle = (fill, stroke = "none", lineWidth = HAIRLINE, radius = NONE) => ({ fill, stroke, lineWidth, radius });
const textStyle = (fontSize = BODY, color = INK, bold = false, align = "left") => ({
  fontFamily: FONT,
  fontSize,
  color,
  bold,
  align,
  valign: "top",
  wrap: false
});

function requiredText(input, name) {
  if (typeof input !== "string" || !input.trim()) throw new Error(`Insight tree table ${name} requires nonempty text`);
  return input.trim();
}

function normalize(props = {}) {
  if (!props.root || typeof props.root !== "object" || Array.isArray(props.root)) throw new Error("Insight tree table requires one root object");
  const root = { id: requiredText(String(props.root.id ?? ""), "root id"), label: requiredText(props.root.label, "root label") };
  if (!Array.isArray(props.branches) || !props.branches.length || props.branches.length > 4) throw new Error("Insight tree table requires one to four branches");
  const ids = new Set([root.id]);
  const branches = props.branches.map((branch, branchIndex) => {
    if (!branch || typeof branch !== "object" || Array.isArray(branch)) throw new Error(`Insight tree table branch ${branchIndex + 1} must be an object`);
    const id = requiredText(String(branch.id ?? ""), `branch ${branchIndex + 1} id`);
    if (ids.has(id)) throw new Error("Insight tree table node ids must be unique");
    ids.add(id);
    if (!Array.isArray(branch.leaves) || !branch.leaves.length) throw new Error(`Insight tree table branch ${id} requires at least one leaf`);
    const leaves = branch.leaves.map((leaf, leafIndex) => {
      if (!leaf || typeof leaf !== "object" || Array.isArray(leaf)) throw new Error(`Insight tree table leaf ${leafIndex + 1} in branch ${id} must be an object`);
      const leafId = requiredText(String(leaf.id ?? ""), `leaf ${leafIndex + 1} id`);
      if (ids.has(leafId)) throw new Error("Insight tree table node ids must be unique");
      ids.add(leafId);
      const implications = typeof leaf.implications === "string" ? [leaf.implications] : leaf.implications;
      if (!Array.isArray(implications) || !implications.length || implications.length > 4) throw new Error(`Insight tree table leaf ${leafId} requires one to four implications`);
      return {
        id: leafId,
        label: requiredText(leaf.label, `leaf ${leafId} label`),
        insight: requiredText(leaf.insight, `leaf ${leafId} insight`),
        implications: implications.map((item, itemIndex) => requiredText(item, `leaf ${leafId} implication ${itemIndex + 1}`))
      };
    });
    return { id, label: requiredText(branch.label, `branch ${id} label`), leaves };
  });
  const leaves = branches.flatMap(branch => branch.leaves.map(leaf => ({ ...leaf, branchId: branch.id })));
  if (leaves.length < 2 || leaves.length > 7) throw new Error("Insight tree table requires two to seven leaves");
  const rowTreatment = props.rowTreatment ?? "tonal";
  if (!["tonal", "open"].includes(rowTreatment)) throw new Error(`Unknown insight tree table row treatment: ${rowTreatment}`);
  const headers = {
    tree: requiredText(props.headers?.tree ?? "(Insert driver tree heading)", "tree header"),
    insight: requiredText(props.headers?.insight ?? "(Insert insight heading)", "insight header"),
    implication: requiredText(props.headers?.implication ?? "(Insert implication heading)", "implication header")
  };
  return { root, branches, leaves, rowTreatment, headers };
}

function measuredTextNode({ id, role, frame, text, style, data = {}, center = false }) {
  const layout = measureText(text, frame.width, {
    fontFamily: tokenValue(style.fontFamily),
    fontSize: tokenValue(style.fontSize),
    bold: style.bold,
    wrapWidthRatio: 1
  });
  if (layout.height > frame.height) throw new Error(`${id} exceeds its insight tree table text frame; enlarge the component or simplify the copy`);
  const y = center ? frame.y + (frame.height - layout.height) / 2 : frame.y;
  return textPrimitive({ id, role, frame: { x: frame.x, y, width: frame.width, height: layout.height }, text: layout.text, style: { ...style, lineHeight: layout.lineHeight }, data: { ...data, textLayout: layout } });
}

function connector(nodes, id, x1, y1, x2, y2, data = {}) {
  if (Math.abs(x2 - x1) < 0.01 && Math.abs(y2 - y1) < 0.01) return;
  nodes.push(linePrimitive({ id, role: "tree-connector", x1, y1, x2, y2, style: { stroke: RULE, lineWidth: HAIRLINE }, data }));
}

function discChevron(nodes, id, cx, cy, data) {
  const diameter = value("icon.medium"), half = diameter / 2;
  nodes.push(ellipsePrimitive({ id: stableId(id, "disc"), role: "relationship-disc", frame: { x: cx - half, y: cy - half, width: diameter, height: diameter }, style: boxStyle(PRIMARY), data: { ...data, arrowVariant: "disc-chevron", arrowPart: 0 } }));
  const points = [
    [cx - diameter * 0.11, cy - diameter * 0.23, cx + diameter * 0.12, cy],
    [cx + diameter * 0.12, cy, cx - diameter * 0.11, cy + diameter * 0.23]
  ];
  points.forEach(([x1, y1, x2, y2], index) => nodes.push(linePrimitive({ id: stableId(id, "chevron", index), role: "relationship-chevron", x1, y1, x2, y2, style: { stroke: ON_PRIMARY, lineWidth: STANDARD }, data: { ...data, arrowVariant: "disc-chevron", arrowPart: index + 1 } })));
}

function lineArrow(nodes, id, x1, x2, y, data) {
  nodes.push(linePrimitive({ id, role: "relationship-arrow", x1, y1: y, x2, y2: y, style: { stroke: PRIMARY, lineWidth: STANDARD }, data: { ...data, relation: "implies", arrowVariant: "line", endArrow: true, endArrowType: "triangle" } }));
}

export function insightTreeTableLayout({ frame, props }) {
  const model = normalize(props);
  const headerHeight = value("space.6") + value("space.2");
  const rowGap = value("space.2");
  const bodyHeight = frame.height - headerHeight;
  const rowHeight = (bodyHeight - rowGap * (model.leaves.length - 1)) / model.leaves.length;
  if (rowHeight < value("space.8") + value("space.2")) throw new Error("Insight tree table needs more vertical space for its leaf rows");
  const treeWidth = frame.width * 0.42;
  const firstGap = value("space.6");
  const insightWidth = frame.width * 0.24;
  const arrowGap = value("space.8");
  const implicationWidth = frame.width - treeWidth - firstGap - insightWidth - arrowGap;
  if (implicationWidth < 220) throw new Error("Insight tree table needs a wider frame for its implication column");
  const tree = { x: frame.x, y: frame.y + headerHeight, width: treeWidth, height: bodyHeight };
  const insight = { x: tree.x + tree.width + firstGap, y: tree.y, width: insightWidth, height: bodyHeight };
  const implication = { x: insight.x + insight.width + arrowGap, y: tree.y, width: implicationWidth, height: bodyHeight };
  const rows = model.leaves.map((leaf, row) => ({ leaf, row, y: tree.y + row * (rowHeight + rowGap), height: rowHeight, centerY: tree.y + row * (rowHeight + rowGap) + rowHeight / 2 }));
  return { ...model, frame, headerHeight, rowGap, rowHeight, tree, insight, implication, rows };
}

export function renderInsightTreeTable({ id, frame, props }) {
  const m = insightTreeTableLayout({ frame, props }), nodes = [];
  const headerGap = value("space.2"), headerTextHeight = m.headerHeight - headerGap;
  for (const [key, area] of [["tree", m.tree], ["insight", m.insight], ["implication", m.implication]]) {
    nodes.push(measuredTextNode({ id: stableId(id, "header", key), role: "insight-tree-header", frame: { x: area.x, y: frame.y, width: area.width, height: headerTextHeight }, text: m.headers[key], style: textStyle(HEADING, INK, true) }));
    nodes.push(linePrimitive({ id: stableId(id, "header-rule", key), role: "insight-tree-header-rule", x1: area.x, y1: frame.y + m.headerHeight - headerGap, x2: area.x + area.width, y2: frame.y + m.headerHeight - headerGap, style: { stroke: RULE, lineWidth: HAIRLINE } }));
  }

  const rootWidth = m.tree.width * 0.27, branchWidth = m.tree.width * 0.27, leafWidth = m.tree.width * 0.31;
  const rootFrame = { x: m.tree.x, y: m.tree.y + (m.tree.height - Math.min(96, m.rowHeight * 1.25)) / 2, width: rootWidth, height: Math.min(96, m.rowHeight * 1.25) };
  const branchX = m.tree.x + m.tree.width * 0.36, leafX = m.tree.x + m.tree.width - leafWidth;
  const rootTrunkX = (rootFrame.x + rootFrame.width + branchX) / 2;
  const branchFrames = m.branches.map(branch => {
    const rows = m.rows.filter(row => row.leaf.branchId === branch.id);
    const centerY = (rows[0].centerY + rows.at(-1).centerY) / 2;
    const height = Math.min(88, Math.max(value("space.8") + value("space.2"), m.rowHeight * 0.92));
    return { branch, rows, frame: { x: branchX, y: centerY - height / 2, width: branchWidth, height }, centerY };
  });

  const branchCenters = branchFrames.map(item => item.centerY);
  connector(nodes, stableId(id, "root-connector"), rootFrame.x + rootFrame.width, rootFrame.y + rootFrame.height / 2, rootTrunkX, rootFrame.y + rootFrame.height / 2, { from: m.root.id, to: "branches" });
  connector(nodes, stableId(id, "root-trunk"), rootTrunkX, Math.min(...branchCenters), rootTrunkX, Math.max(...branchCenters), { from: m.root.id, to: "branches" });
  branchFrames.forEach(({ branch, rows, frame: branchFrame, centerY }) => {
    connector(nodes, stableId(id, "branch-in", branch.id), rootTrunkX, centerY, branchFrame.x, centerY, { from: m.root.id, to: branch.id });
    const leafTrunkX = (branchFrame.x + branchFrame.width + leafX) / 2;
    connector(nodes, stableId(id, "branch-out", branch.id), branchFrame.x + branchFrame.width, centerY, leafTrunkX, centerY, { from: branch.id, to: "leaves" });
    connector(nodes, stableId(id, "branch-trunk", branch.id), leafTrunkX, rows[0].centerY, leafTrunkX, rows.at(-1).centerY, { from: branch.id, to: "leaves" });
    rows.forEach(row => connector(nodes, stableId(id, "leaf-in", row.leaf.id), leafTrunkX, row.centerY, leafX, row.centerY, { from: branch.id, to: row.leaf.id }));
  });

  const nodeFill = PRIMARY;
  nodes.push(rectPrimitive({ id: stableId(id, "root", m.root.id), role: "tree-root", frame: rootFrame, style: boxStyle(nodeFill, nodeFill, HAIRLINE, SMALL), data: { nodeId: m.root.id, depth: 0 } }));
  nodes.push(measuredTextNode({ id: stableId(id, "root-label", m.root.id), role: "node-label", frame: { x: rootFrame.x + value("space.3"), y: rootFrame.y + value("space.2"), width: rootFrame.width - 2 * value("space.3"), height: rootFrame.height - 2 * value("space.2") }, text: m.root.label, style: textStyle(BODY, ON_PRIMARY, true), data: { nodeId: m.root.id, depth: 0 }, center: true }));

  branchFrames.forEach(({ branch, frame: branchFrame }) => {
    nodes.push(rectPrimitive({ id: stableId(id, "branch", branch.id), role: "tree-node", frame: branchFrame, style: boxStyle(nodeFill, nodeFill, HAIRLINE, SMALL), data: { nodeId: branch.id, parentId: m.root.id, depth: 1 } }));
    nodes.push(measuredTextNode({ id: stableId(id, "branch-label", branch.id), role: "node-label", frame: { x: branchFrame.x + value("space.3"), y: branchFrame.y + value("space.2"), width: branchFrame.width - 2 * value("space.3"), height: branchFrame.height - 2 * value("space.2") }, text: branch.label, style: textStyle(BODY, ON_PRIMARY, true), data: { nodeId: branch.id, parentId: m.root.id, depth: 1 }, center: true }));
  });

  m.rows.forEach(({ leaf, row, y, height, centerY }) => {
    const leafFrame = { x: leafX, y, width: leafWidth, height };
    const surfaceFill = m.rowTreatment === "tonal" ? MUTED_SURFACE : SURFACE;
    const insightFrame = { x: m.insight.x, y, width: m.insight.width, height };
    const implicationFrame = { x: m.implication.x, y, width: m.implication.width, height };
    nodes.push(rectPrimitive({ id: stableId(id, "leaf", leaf.id), role: "tree-node", frame: leafFrame, style: boxStyle(nodeFill, nodeFill, HAIRLINE, SMALL), data: { nodeId: leaf.id, parentId: leaf.branchId, depth: 2, row } }));
    nodes.push(measuredTextNode({ id: stableId(id, "leaf-label", leaf.id), role: "node-label", frame: { x: leafFrame.x + value("space.3"), y: leafFrame.y + value("space.2"), width: leafFrame.width - 2 * value("space.3"), height: leafFrame.height - 2 * value("space.2") }, text: leaf.label, style: textStyle(BODY, ON_PRIMARY, true), data: { nodeId: leaf.id, parentId: leaf.branchId, depth: 2, row }, center: true }));
    nodes.push(rectPrimitive({ id: stableId(id, "insight-surface", leaf.id), role: "insight-tree-insight-surface", frame: insightFrame, style: boxStyle(surfaceFill), data: { leafId: leaf.id, row } }));
    nodes.push(measuredTextNode({ id: stableId(id, "insight", leaf.id), role: "insight-tree-insight-text", frame: { x: insightFrame.x + value("space.3"), y: insightFrame.y + value("space.2"), width: insightFrame.width - 2 * value("space.3"), height: insightFrame.height - 2 * value("space.2") }, text: leaf.insight, style: textStyle(BODY, INK), data: { leafId: leaf.id, row }, center: true }));
    nodes.push(rectPrimitive({ id: stableId(id, "implication-surface", leaf.id), role: "insight-tree-implication-surface", frame: implicationFrame, style: boxStyle(surfaceFill), data: { leafId: leaf.id, row } }));
    nodes.push(measuredTextNode({ id: stableId(id, "implication", leaf.id), role: "insight-tree-implication-text", frame: { x: implicationFrame.x + value("space.3"), y: implicationFrame.y + value("space.2"), width: implicationFrame.width - 2 * value("space.3"), height: implicationFrame.height - 2 * value("space.2") }, text: leaf.implications.map(item => `• ${item}`).join("\n"), style: textStyle(BODY, INK), data: { leafId: leaf.id, row }, center: true }));
    discChevron(nodes, stableId(id, "leaf-arrow", leaf.id), m.tree.x + m.tree.width + value("space.4"), centerY, { leafId: leaf.id, row, relation: "supports" });
    lineArrow(nodes, stableId(id, "implication-arrow", leaf.id), m.insight.x + m.insight.width + value("space.2"), m.implication.x - value("space.2"), centerY, { leafId: leaf.id, row });
  });
  return { nodes };
}

export function registerInsightTreeTable(registry) {
  registry.set("insight-tree-table", {
    id: "insight-tree-table",
    version: "1.0.0",
    category: "relationship",
    role: "insight-tree-table",
    tokens: [...INSIGHT_TREE_TABLE_TOKENS],
    preferredSize: { width: 1160, height: 500 },
    sample: INSIGHT_TREE_TABLE_SAMPLE,
    guidance: INSIGHT_TREE_TABLE_GUIDANCE,
    measureContent: insightTreeTableLayout,
    render: renderInsightTreeTable
  });
  return registry;
}
