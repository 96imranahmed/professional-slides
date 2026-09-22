// Four diagram families the reference galleries use for people, partners and
// journeys: a continuous-improvement cycle, a milestone staircase, a row of
// profile cards and a logo wall. Each shares the deck's marker vocabulary, its
// body and display type, one primary colour and hairline rules; every text node
// is measured once here and carries its layout with it.
import { token, tokenValue, stableId, textPrimitive, rectPrimitive, ellipsePrimitive, linePrimitive, shapePrimitive } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { MARK_TOKENS, numberMarker, iconMarker, markerSize } from "./marks.mjs";
import { mediaNode } from "./media.mjs";
import { measureAt, fillRect, measuredLabel } from "./draw.mjs";

const PRIMARY = token("color.componentPrimary"), ACCENT = token("color.accent"), INK = token("color.ink"), WHITE = token("color.onPrimary"), SECONDARY = token("color.textSecondary");
const SURFACE = token("color.surface"), RULE = token("color.rule");
const FONT = token("font.body"), DISPLAY = token("font.display");
const v = (id) => tokenValue(token(id));

export const EXTRA_TOKENS = Object.freeze([...new Set([...MARK_TOKENS, "color.accent", "color.textSecondary", "color.rule", "font.display", "type.heading", "type.body", "type.compact", "type.label", "space.1", "space.2", "space.3", "space.4", "space.5", "line.hairline", "line.standard", "radius.none", "radius.small", "radius.round"])]);

const text = (size, color = INK, bold = false, align = "left", font = FONT) => ({ fontFamily: font, fontSize: token(size), color, bold, align, valign: "top", wrap: false });
const measure = (value, width, size, bold = false, font = FONT) => measureAt(value, width, { size, bold, font });
const rect = (id, role, frame, fill, stroke = "none", radius = "radius.none") => fillRect(id, role, frame, fill, { stroke, radius });
const label = measuredLabel;
const clean = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** An open or closed polyline in absolute coordinates, packed into an iconPath shape. */
function polylineShape(id, role, points, style, closed = false) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const width = Math.max(Math.max(...xs) - minX, 1), height = Math.max(Math.max(...ys) - minY, 1);
  return shapePrimitive({ id, role, geometry: "iconPath", frame: { x: minX, y: minY, width, height }, style, data: { paths: [{ points: points.map(([x, y]) => [(x - minX) / width, (y - minY) / height]), closed }] } });
}

/** A portrait clipped to a circle: mediaNode's fit, then the circular flag portraitPrimitive uses. */
function circularMedia(id, role, frame, image) {
  const node = mediaNode({ id, role, frame, props: image });
  return { ...node, data: { ...node.data, circular: true } };
}

const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/* ------------------------------------------------------------------- cycle */

function normalizeCycle(props) {
  if (!Array.isArray(props.items) || props.items.length < 3 || props.items.length > 6) throw new Error("Cycle takes three to six steps");
  return props.items.map((item, index) => {
    if (!item || !clean(item.label)) throw new Error(`Cycle step ${index + 1} requires a label`);
    return { label: clean(item.label), text: clean(item.text), icon: item.icon ?? null, number: item.number ?? index + 1 };
  });
}

const DISC = 44, ARROW = 10;
const markerDiameter = () => markerSize();

/**
 * Nodes sit on a ring at radius R, the first at twelve o'clock, running
 * clockwise. Each label block is anchored just outside its node along the same
 * angle (left-aligned on the right side, right-aligned on the left, centred at
 * the top and bottom). R is the largest radius that keeps the whole figure
 * inside `limit` (width, and height when known), so the ring fills its frame.
 */
export function cycleLayout(frame, props, { strict = true } = {}) {
  const items = normalizeCycle(props);
  const n = items.length, gap = v("space.3"), textGap = v("space.1");
  const minRadius = Math.max(70, (DISC + 3 * ARROW) / (2 * Math.sin(Math.PI / n)));
  // Labels take about 26 characters a line: a fifth of the frame, between 120 and 220 px.
  const labelWidth = Math.min(Math.max(120, Math.round(frame.width * 0.18)), 220, Math.floor((frame.width - 2 * (minRadius + DISC / 2 + gap)) / 2));
  if (labelWidth < 100) throw new Error(`Cycle needs at least ${Math.ceil(2 * (minRadius + DISC / 2 + gap) + 200)}px of width for its labels`);
  const measured = items.map((item) => {
    const title = measure(item.label, labelWidth, "type.heading", true);
    const body = item.text ? measure(item.text, labelWidth, "type.body") : null;
    return { item, title, body, width: labelWidth, height: title.height + (body ? textGap + body.height : 0) };
  });
  const center = clean(props.center);
  const place = (radius) => {
    const nodes = measured.map((m, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n, cos = Math.cos(angle), sin = Math.sin(angle);
      const reach = radius + DISC / 2 + gap;
      const box = { x: reach * cos - m.width / 2 + (cos * m.width) / 2, y: reach * sin - m.height / 2 + (sin * m.height) / 2, width: m.width, height: m.height };
      // A diagonal label anchors by its corner and would hang over the ring; push
      // it out along its angle until its nearest point clears the disc and gap.
      for (let pass = 0; pass < 6; pass += 1) {
        const nx = Math.max(box.x, Math.min(0, box.x + box.width)), ny = Math.max(box.y, Math.min(0, box.y + box.height));
        const distance = Math.hypot(nx, ny);
        if (distance >= reach - 0.01) break;
        box.x += (reach - distance) * cos; box.y += (reach - distance) * sin;
      }
      return { ...m, angle, cx: radius * cos, cy: radius * sin, box, align: cos > 0.3 ? "left" : cos < -0.3 ? "right" : "center" };
    });
    const boxes = [...nodes.map((p) => p.box), ...nodes.map((p) => ({ x: p.cx - DISC / 2, y: p.cy - DISC / 2, width: DISC, height: DISC }))];
    const minX = Math.min(...boxes.map((b) => b.x)), maxX = Math.max(...boxes.map((b) => b.x + b.width));
    const minY = Math.min(...boxes.map((b) => b.y)), maxY = Math.max(...boxes.map((b) => b.y + b.height));
    const clash = nodes.some((a, i) => nodes.some((b, j) => j > i && intersects(a.box, b.box)) || nodes.some((b, j) => j !== i && intersects(a.box, { x: b.cx - DISC / 2, y: b.cy - DISC / 2, width: DISC, height: DISC })));
    const centerWidth = Math.floor(2 * radius * 0.72);
    let centerLayout = null;
    if (center && centerWidth > 40) { try { centerLayout = measure(center, centerWidth, "type.heading", true); } catch { centerLayout = null; } }
    const centerFits = !center || (centerLayout && centerLayout.height <= 2 * radius * 0.5);
    return { radius, nodes, centerLayout, centerWidth, clash, centerFits, bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
  };
  const maxRadius = 200;
  let chosen = null;
  for (let radius = maxRadius; radius >= minRadius; radius -= 2) {
    const candidate = place(radius);
    if (candidate.bounds.width <= frame.width + 0.01 && (frame.height === undefined || candidate.bounds.height <= frame.height + 0.01)) { chosen = candidate; break; }
  }
  if (!chosen) throw new Error(`Cycle labels cannot fit a ${frame.width}x${frame.height ?? "auto"}px frame; shorten the step labels or give the cycle more room`);
  // Measurement reports the height the ring would need; rendering refuses a colliding figure.
  if (strict && chosen.clash) throw new Error("Cycle labels collide; shorten the step labels or use fewer steps");
  if (strict && !chosen.centerFits) throw new Error("Cycle centre label does not fit inside the ring; shorten it");
  return { ...chosen, items: measured, gap, textGap, height: chosen.bounds.height };
}

export function cycleNodes({ id, frame, props }) {
  const L = cycleLayout(frame, props);
  const cx = frame.x + (frame.width - L.bounds.width) / 2 - L.bounds.x, cy = frame.y + (frame.height - L.bounds.height) / 2 - L.bounds.y;
  const nodes = [];
  const n = L.nodes.length, R = L.radius;
  const stroke = { fill: "none", stroke: RULE, lineWidth: token("line.standard"), lineCap: "round" };
  // Arrow arcs first (painted under the discs), then discs, then labels.
  const clearance = Math.asin((DISC / 2 + v("space.2")) / R);
  L.nodes.forEach((p, i) => {
    const next = L.nodes[(i + 1) % n];
    const from = p.angle + clearance, to = next.angle + (i + 1 === n ? 2 * Math.PI : 0) - clearance - ARROW / R;
    if (to <= from) return;
    const steps = 12, points = [];
    for (let k = 0; k <= steps; k += 1) { const a = from + ((to - from) * k) / steps; points.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
    nodes.push(polylineShape(stableId(id, "arc", i), "cycle-arc", points, stroke));
    const tip = to + ARROW / R, tx = cx + R * Math.cos(tip), ty = cy + R * Math.sin(tip);
    const dx = -Math.sin(tip), dy = Math.cos(tip); // clockwise tangent
    const bx = tx - dx * ARROW, by = ty - dy * ARROW, nx = -dy * ARROW * 0.55, ny = dx * ARROW * 0.55;
    nodes.push(polylineShape(stableId(id, "arrow", i), "cycle-arrow", [[tx, ty], [bx + nx, by + ny], [bx - nx, by - ny]], { fill: RULE, stroke: "none", lineWidth: token("line.hairline") }, true));
  });
  L.nodes.forEach((p, i) => {
    const x = cx + p.cx - DISC / 2, y = cy + p.cy - DISC / 2, nid = stableId(id, "step", i);
    if (p.item.icon) nodes.push(...iconMarker({ id: stableId(nid, "icon"), role: "cycle-node", x, y, size: DISC, icon: p.item.icon, tone: "filled" }));
    else nodes.push(...numberMarker({ id: stableId(nid, "number"), role: "cycle-node", x, y, size: DISC, number: p.item.number }));
    const bx = cx + p.box.x, by = cy + p.box.y;
    nodes.push(label(stableId(nid, "label"), "cycle-label", { x: bx, y: by, width: p.width }, p.title, text("type.heading", INK, true, p.align)));
    if (p.body) nodes.push(label(stableId(nid, "text"), "cycle-text", { x: bx, y: by + p.title.height + L.textGap, width: p.width }, p.body, text("type.body", INK, false, p.align)));
  });
  if (L.centerLayout) nodes.push(label(stableId(id, "center"), "cycle-center", { x: cx - L.centerWidth / 2, y: cy - L.centerLayout.height / 2, width: L.centerWidth }, L.centerLayout, text("type.heading", PRIMARY, true, "center")));
  return nodes;
}

/* ------------------------------------------------------------------- steps */

function normalizeSteps(props) {
  if (!Array.isArray(props.items) || props.items.length < 3 || props.items.length > 6) throw new Error("Steps take three to six milestones");
  return props.items.map((item, index) => {
    if (!item || !clean(item.label)) throw new Error(`Step ${index + 1} requires a label`);
    return { label: clean(item.label), text: clean(item.text), icon: item.icon ?? null };
  });
}

/**
 * A staircase: one tread per milestone, each a step higher, numbered at its
 * left; the description sits above its tread, and a hairline riser drops
 * from each tread to the baseline so the figure reads as stairs, not bars.
 */
export function stepsLayout(frame, props) {
  const items = normalizeSteps(props);
  const gap = v("space.2"), pad = v("space.3"), tread = 44, disc = markerDiameter();
  const width = (frame.width - gap * (items.length - 1)) / items.length, inner = width - 2 * pad - disc - v("space.2");
  if (inner < 60) throw new Error("Steps are too narrow for their labels; use fewer steps");
  const measured = items.map((item) => ({ item, title: measure(item.label, inner, "type.body", true), body: item.text ? measure(item.text, width - pad, "type.compact") : null }));
  if (measured.some((m) => m.title.lines.length > 3)) throw new Error("Step labels must fit three lines on the tread; shorten them or use fewer steps");
  // A tread grows to carry a two-line label at a narrow width.
  const treadHeight = Math.max(tread, Math.max(...measured.map((m) => m.title.height)) + 2 * v("space.2"));
  const bodyHeight = Math.max(0, ...measured.map((m) => (m.body ? m.body.height : 0)));
  const rise = Math.max(treadHeight + v("space.2"), bodyHeight + v("space.3"));
  return { items: measured, gap, pad, width, inner, tread: treadHeight, disc, rise, bodyHeight, height: treadHeight + rise * (items.length - 1) + bodyHeight + v("space.3") };
}

export function stepsNodes({ id, frame, props }) {
  const L = stepsLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`Steps need ${Math.ceil(L.height)}px but have ${frame.height}px; shorten the descriptions or use fewer steps`);
  const n = L.items.length;
  // The rise is capped, and the staircase is centred in whatever is left.
  //
  // It used to stretch to fill the frame: three steps in a 470px body gave a
  // 191px rise for a 44px tread, so the page was three small islands with a
  // hundred and fifty pixels of nothing between them and the whole top-left
  // corner empty. A staircase is a shape, not a way of spending height - it
  // rises by about what a tread and its text need, and the leftover goes in one
  // place rather than being smeared between every step.
  const naturalRise = L.rise;
  const stretched = n > 1 ? (frame.height - L.tread - L.bodyHeight - v("space.3")) / (n - 1) : naturalRise;
  const rise = n > 1 ? Math.max(naturalRise, Math.min(stretched, naturalRise * STEP_RISE_STRETCH)) : naturalRise;
  const figure = L.tread + rise * (n - 1) + L.bodyHeight + v("space.3");
  const baseline = frame.y + frame.height - Math.max(0, (frame.height - figure) / 2);
  const nodes = [];
  nodes.push(linePrimitive({ id: stableId(id, "baseline"), role: "step-baseline", x1: frame.x, y1: baseline, x2: frame.x + frame.width, y2: baseline, style: { stroke: RULE, lineWidth: token("line.hairline") } }));
  L.items.forEach((m, i) => {
    const x = frame.x + i * (L.width + L.gap), top = baseline - L.tread - rise * i, sid = stableId(id, "step", i);
    const last = i === n - 1;
    nodes.push(rect(stableId(sid, "tread"), "step-block", { x, y: top, width: L.width, height: L.tread }, last ? ACCENT : PRIMARY));
    if (i) nodes.push(linePrimitive({ id: stableId(sid, "riser"), role: "step-riser", x1: x, y1: top + L.tread, x2: x, y2: baseline, style: { stroke: RULE, lineWidth: token("line.hairline") } }));
    // The tread's marker: the icon the author named, else the step's number.
    // A staircase already carries its order in its shape, so an icon loses
    // nothing and says what the step is about.
    nodes.push(...(m.item.icon
      ? iconMarker({ id: stableId(sid, "icon"), role: "step-marker", x: x + L.pad, y: top + (L.tread - L.disc) / 2, size: L.disc, icon: m.item.icon, tone: "inverse" })
      : numberMarker({ id: stableId(sid, "number"), role: "step-marker", x: x + L.pad, y: top + (L.tread - L.disc) / 2, size: L.disc, number: i + 1, reverse: true })));
    nodes.push(label(stableId(sid, "label"), "step-label", { x: x + L.pad + L.disc + v("space.2"), y: top + (L.tread - m.title.height) / 2, width: L.inner }, m.title, text("type.body", WHITE, true)));
    if (m.body) nodes.push(label(stableId(sid, "text"), "step-text", { x: x + L.pad, y: top - v("space.2") - m.body.height, width: L.width - L.pad }, m.body, text("type.compact", INK)));
  });
  return nodes;
}

/* ------------------------------------------------------------------ people */

// How much a staircase may stretch past the height its content needs. Past
// this the treads stop reading as steps and start reading as scattered blocks.
const STEP_RISE_STRETCH = 1.45;

const PORTRAIT = 72;

function normalizePeople(props) {
  if (!Array.isArray(props.items) || props.items.length < 2 || props.items.length > 5) throw new Error("People take two to five profiles");
  return props.items.map((item, index) => {
    if (!item || !clean(item.name)) throw new Error(`Profile ${index + 1} requires a name`);
    const points = (Array.isArray(item.points) ? item.points : []).map((p) => clean(typeof p === "string" ? p : p?.text)).filter(Boolean);
    if (points.length > 3) throw new Error(`Profile ${index + 1} takes at most three points`);
    return { name: clean(item.name), role: clean(item.role), points, image: item.image ?? null };
  });
}

const initials = (name) => name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";

export function peopleLayout(frame, props) {
  const items = normalizePeople(props);
  const gap = v("space.4"), pad = v("space.4");
  const width = (frame.width - gap * (items.length - 1)) / items.length, inner = width - 2 * pad;
  if (inner < PORTRAIT + 16) throw new Error("Profile cards are too narrow; use fewer people");
  const nameGap = v("space.3"), roleGap = v("space.1"), pointsGap = v("space.3"), pointGap = v("space.1");
  const measured = items.map((item) => {
    const name = measure(item.name, inner, "type.body", true);
    const role = item.role ? measure(item.role, inner, "type.compact") : null;
    const points = item.points.map((p) => measure(p, inner, "type.compact"));
    const head = PORTRAIT + nameGap + name.height + (role ? roleGap + role.height : 0);
    const body = points.length ? pointsGap + points.reduce((sum, p) => sum + p.height, 0) + pointGap * (points.length - 1) : 0;
    return { item, name, role, points, head, height: pad + head + body + pad };
  });
  const headHeight = Math.max(...measured.map((m) => m.head));
  return { items: measured, gap, pad, width, inner, nameGap, roleGap, pointsGap, pointGap, headHeight, height: Math.max(...measured.map((m) => m.height - m.head + headHeight)) };
}

export function peopleNodes({ id, frame, props }) {
  const L = peopleLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`Profile cards need ${Math.ceil(L.height)}px but have ${frame.height}px; shorten the points or use fewer people`);
  const nodes = [];
  L.items.forEach((m, i) => {
    const x = frame.x + i * (L.width + L.gap), pid = stableId(id, "person", i), cx = x + L.pad;
    nodes.push(rect(stableId(pid, "surface"), "person-surface", { x, y: frame.y, width: L.width, height: frame.height }, SURFACE, RULE, "radius.small"));
    let y = frame.y + L.pad;
    const px = x + (L.width - PORTRAIT) / 2, portrait = { x: px, y, width: PORTRAIT, height: PORTRAIT };
    if (m.item.image) {
      nodes.push(circularMedia(stableId(pid, "portrait"), "person-portrait", portrait, m.item.image));
    } else {
      const mono = measure(initials(m.item.name), PORTRAIT, "type.heading", true);
      nodes.push(ellipsePrimitive({ id: stableId(pid, "ring"), role: "person-portrait", frame: portrait, style: { fill: SURFACE, stroke: PRIMARY, lineWidth: token("line.standard"), radius: token("radius.round") } }));
      nodes.push(label(stableId(pid, "initials"), "person-initials", { x: px, y: y + (PORTRAIT - mono.height) / 2, width: PORTRAIT }, mono, text("type.heading", PRIMARY, true, "center")));
    }
    y += PORTRAIT + L.nameGap;
    nodes.push(label(stableId(pid, "name"), "person-name", { x: cx, y, width: L.inner }, m.name, text("type.body", INK, true, "center")));
    y += m.name.height;
    if (m.role) { y += L.roleGap; nodes.push(label(stableId(pid, "role"), "person-role", { x: cx, y, width: L.inner }, m.role, text("type.compact", SECONDARY, false, "center"))); }
    // Points start level across the row, below the tallest header.
    y = frame.y + L.pad + L.headHeight;
    if (m.points.length) {
      const ruleY = y + L.pointsGap / 2, ruleWidth = v("space.5");
      nodes.push(linePrimitive({ id: stableId(pid, "rule"), role: "person-rule", x1: x + (L.width - ruleWidth) / 2, y1: ruleY, x2: x + (L.width + ruleWidth) / 2, y2: ruleY, style: { stroke: RULE, lineWidth: token("line.hairline") } }));
      y += L.pointsGap;
    }
    m.points.forEach((p, k) => {
      if (k) y += L.pointGap;
      nodes.push(label(stableId(pid, "point", k), "person-point", { x: cx, y, width: L.inner }, p, text("type.compact", INK, false, "center")));
      y += p.height;
    });
  });
  return nodes;
}

/* ------------------------------------------------------------------- logos */

function normalizeLogos(props) {
  if (!Array.isArray(props.items) || props.items.length < 2 || props.items.length > 12) throw new Error("Logo wall takes two to twelve logos");
  return props.items.map((item, index) => {
    if (!item || !clean(item.name)) throw new Error(`Logo ${index + 1} requires a name`);
    return { name: clean(item.name), caption: clean(item.caption), image: item.image ?? null };
  });
}

/** Two to four columns: as many as there are logos up to four, fewer when the frame is tall. */
export function logoColumns(count, frame) {
  let columns = count <= 4 ? count : count <= 6 ? 3 : 4;
  if ((frame.height !== undefined && frame.width / frame.height < 1.2) || frame.width < 520) columns = Math.min(columns, 2);
  return Math.max(2, columns);
}

export function logosLayout(frame, props) {
  const items = normalizeLogos(props);
  const gap = v("space.3"), pad = v("space.3"), captionGap = v("space.1");
  const columns = logoColumns(items.length, frame), rows = Math.ceil(items.length / columns);
  const width = (frame.width - gap * (columns - 1)) / columns, inner = width - 2 * pad;
  if (inner < 60) throw new Error("Logo cells are too narrow; use fewer logos");
  const measured = items.map((item) => {
    const name = item.image ? null : measure(item.name, inner, "type.heading", true, DISPLAY);
    const caption = item.caption ? measure(item.caption, inner, "type.compact") : null;
    return { item, name, caption, content: (name ? name.height : 0) + (caption ? captionGap + caption.height : 0) };
  });
  const content = Math.max(...measured.map((m) => m.content + 2 * pad));
  const cell = Math.max(content, Math.min(140, Math.round(width * 0.45)));
  return { items: measured, columns, rows, gap, pad, captionGap, width, inner, cell, content, height: rows * cell + gap * (rows - 1) };
}

export function logosNodes({ id, frame, props }) {
  const L = logosLayout(frame, props);
  const cell = (frame.height - L.gap * (L.rows - 1)) / L.rows;
  if (cell + 0.01 < L.content) throw new Error(`Logo cells need ${Math.ceil(L.content)}px of height but have ${Math.floor(cell)}px; shorten the captions or use fewer logos`);
  const nodes = [];
  L.items.forEach((m, i) => {
    const x = frame.x + (i % L.columns) * (L.width + L.gap), y = frame.y + Math.floor(i / L.columns) * (cell + L.gap), lid = stableId(id, "logo", i);
    nodes.push(rect(stableId(lid, "surface"), "logo-surface", { x, y, width: L.width, height: cell }, SURFACE, RULE));
    const captionHeight = m.caption ? L.captionGap + m.caption.height : 0;
    if (m.item.image) {
      const box = { x: x + L.pad, y: y + L.pad, width: L.inner, height: cell - 2 * L.pad - captionHeight };
      if (box.height < 24) throw new Error("Logo cells are too short for an image and caption");
      nodes.push(mediaNode({ id: stableId(lid, "image"), role: "logo-image", frame: box, props: m.item.image }));
    } else {
      const top = y + (cell - m.content) / 2;
      nodes.push(label(stableId(lid, "name"), "logo-name", { x: x + L.pad, y: top, width: L.inner }, m.name, text("type.heading", INK, true, "center", DISPLAY)));
    }
    if (m.caption) {
      const cy = m.item.image ? y + cell - L.pad - m.caption.height : y + (cell - m.content) / 2 + m.name.height + L.captionGap;
      nodes.push(label(stableId(lid, "caption"), "logo-caption", { x: x + L.pad, y: cy, width: L.inner }, m.caption, text("type.compact", SECONDARY, false, "center")));
    }
  });
  return nodes;
}

/* ---------------------------------------------------------------- register */

export function registerExtras(registry) {
  const define = (id, category, preferredSize, sample, render, measureContent, guidance) => registry.set(id, { id, version: "1.0.0", category, role: id, tokens: [...EXTRA_TOKENS], preferredSize, sample, render, measureContent, guidance });
  define("cycle", "diagram", { width: 1160, height: 460 },
    { items: [1, 2, 3, 4, 5].map((i) => ({ label: `(Insert step ${i})`, text: "(Insert one-line description)" })), center: "(Insert loop name)" },
    (input) => ({ nodes: cycleNodes(input) }),
    ({ frame, props }) => cycleLayout(frame, props, { strict: false }),
    { useWhen: "three to six steps that repeat in order (a plan-do-check-act loop, an operating rhythm, a feedback cycle)", why: "the ring says the last step feeds the first; a row of chevrons would say the work ends", actionTitle: "state what the loop improves each time round" });
  define("steps", "diagram", { width: 1160, height: 360 },
    { items: [1, 2, 3, 4].map((i) => ({ label: `(Insert milestone ${i})`, text: "(Insert what is true at this step)" })) },
    (input) => ({ nodes: stepsNodes(input) }),
    ({ frame, props }) => stepsLayout(frame, props),
    { useWhen: "three to six milestones that build on one another towards an end state", why: "rising blocks carry the accumulation; the accent on the last block names the destination", actionTitle: "state the end state and what it takes to reach it" });
  define("people", "section", { width: 1160, height: 300 },
    { items: [1, 2, 3, 4].map((i) => ({ name: `(Insert name ${i})`, role: "(Insert role)", points: ["(Insert relevant experience)", "(Insert responsibility)"] })) },
    (input) => ({ nodes: peopleNodes(input) }),
    ({ frame, props }) => peopleLayout(frame, props),
    { useWhen: "introducing two to five people (a team, a steering group, interviewees) with a role and a line or two each", why: "equal cards with a portrait make the group read as a unit; centred content keeps the cards calm", actionTitle: "state why this group is the right one for the work" });
  define("logos", "media", { width: 1160, height: 300 },
    { items: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ name: `(Insert logo ${i})`, caption: i % 2 ? "(Insert segment)" : null })) },
    (input) => ({ nodes: logosNodes(input) }),
    ({ frame, props }) => logosLayout(frame, props),
    { useWhen: "showing the membership of a customer, partner or peer set by name", why: "equal ruled cells give every member the same weight and make the count legible", actionTitle: "state what the membership proves" });
  return registry;
}
