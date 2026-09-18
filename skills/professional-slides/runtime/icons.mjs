// Single-weight line icons for consulting slides (the "line icon in a circle"
// look). Every icon is a handful of polylines in a unit square (y down, all
// coordinates inside [0.06, 0.94]) so it can be emitted as an editable
// PowerPoint freeform (stroke only, no fill, round caps) or as inline SVG.
// No curves: circles and arcs are 16-24 segment polygons generated below.
// Designed for 24-40 px with a 2 px stroke: no feature is thinner than ~0.1
// of the box and every icon stays under ~6 paths / ~80 points.

const R3 = (v) => Math.round(v * 1000) / 1000;
const rad = (deg) => (deg * Math.PI) / 180;
const pt = (x, y) => [R3(x), R3(y)];

// Points on an ellipse arc from angle a0 to a1 (degrees, 0 = right, 90 = down).
function earcPoints(cx, cy, rx, ry, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    out.push(pt(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
  }
  return out;
}
const arcPoints = (cx, cy, r, a0, a1, n) => earcPoints(cx, cy, r, r, a0, a1, n);
function circlePoints(cx, cy, r, n = 20) {
  return earcPoints(cx, cy, r, r, 0, 360, n).slice(0, n);
}
// Circular arc from A to B bulging by `sagitta` to the left of the A->B
// direction (negative bulges to the right).
function bowPoints(A, B, sagitta, n = 10) {
  const [ax, ay] = A, [bx, by] = B;
  const dx = bx - ax, dy = by - ay;
  const c = Math.hypot(dx, dy);
  const h = Math.abs(sagitta);
  const r = (c * c) / (8 * h) + h / 2;
  const s = Math.sign(sagitta) || 1;
  const nx = (dy / c) * s, ny = (-dx / c) * s; // left normal (y down)
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const cx = mx - nx * (r - h), cy = my - ny * (r - h);
  const a0 = Math.atan2(ay - cy, ax - cx);
  let a1 = Math.atan2(by - cy, bx - cx);
  // sweep on the side of the bulge: choose the direction whose midpoint is
  // on the same side as the sagitta.
  let sweep = a1 - a0;
  while (sweep <= -Math.PI) sweep += 2 * Math.PI;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  const midA = a0 + sweep / 2;
  const midX = cx + r * Math.cos(midA), midY = cy + r * Math.sin(midA);
  const side = (midX - mx) * nx + (midY - my) * ny;
  if (side < 0) sweep = sweep > 0 ? sweep - 2 * Math.PI : sweep + 2 * Math.PI;
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + (sweep * i) / n;
    out.push(pt(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return out;
}
// Open arrow head whose tip is at T, pointing along `angle` (degrees).
function headPoints(T, angle, size = 0.16, spread = 40) {
  const back = angle + 180;
  const a = rad(back - spread), b = rad(back + spread);
  return [pt(T[0] + size * Math.cos(a), T[1] + size * Math.sin(a)), pt(T[0], T[1]), pt(T[0] + size * Math.cos(b), T[1] + size * Math.sin(b))];
}
const polar = (cx, cy, r, deg) => pt(cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg)));

const open = (points) => ({ points, closed: false });
const closed = (points) => ({ points, closed: true });
const line = (x0, y0, x1, y1) => open([pt(x0, y0), pt(x1, y1)]);
const poly = (...xy) => open(xy.map(([x, y]) => pt(x, y)));
const shape = (...xy) => closed(xy.map(([x, y]) => pt(x, y)));
const rect = (x0, y0, x1, y1) => shape([x0, y0], [x1, y0], [x1, y1], [x0, y1]);
const circle = (cx, cy, r, n = 20) => closed(circlePoints(cx, cy, r, n));
const dot = (cx, cy) => line(cx, cy - 0.02, cx, cy + 0.02);

function starPoints(cx, cy, ro, ri) {
  const out = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? ro : ri;
    out.push(polar(cx, cy, r, -90 + i * 36));
  }
  return out;
}
function gearPoints(cx, cy, ro, ri, teeth) {
  const out = [];
  const step = 360 / teeth;
  for (let i = 0; i < teeth; i += 1) {
    const a = -90 + i * step;
    out.push(polar(cx, cy, ri, a - step * 0.30), polar(cx, cy, ro, a - step * 0.19), polar(cx, cy, ro, a + step * 0.19), polar(cx, cy, ri, a + step * 0.30));
  }
  return out;
}
function wrenchPaths() {
  const H = [0.66, 0.34], r = 0.24, ri = 0.11, A = [0.20, 0.80], hw = 0.085;
  const v = [Math.SQRT1_2, Math.SQRT1_2]; // perpendicular to the handle axis
  const jaw = 12; // half opening angle, jaw faces the top-right (-45 deg)
  const d = Math.asin(hw / r) * (180 / Math.PI);
  const pts = [
    polar(H[0], H[1], ri, -45 + jaw + 18),
    polar(H[0], H[1], r, -45 + jaw + 18),
    ...arcPoints(H[0], H[1], r, -45 + jaw + 18, 135 - d, 12).slice(1),
    pt(A[0] + v[0] * hw, A[1] + v[1] * hw),
    pt(A[0] - v[0] * hw, A[1] - v[1] * hw),
    ...arcPoints(H[0], H[1], r, 135 + d, 315 - jaw - 18, 12),
    polar(H[0], H[1], ri, 315 - jaw - 18)
  ];
  return [closed(pts)];
}
function cloudPaths() {
  const pts = [
    ...arcPoints(0.30, 0.60, 0.16, 90, 270, 8),
    ...arcPoints(0.52, 0.46, 0.24, 195, 350, 12).slice(1),
    ...arcPoints(0.72, 0.60, 0.16, 270, 450, 8).slice(1)
  ];
  return [closed(pts)];
}
function phonePaths() {
  const C = [0.92, 0.08];
  const pts = [
    pt(0.08, 0.10), pt(0.34, 0.10), pt(0.42, 0.26),
    ...arcPoints(C[0], C[1], 0.52, 160, 110, 10).slice(1),
    pt(0.74, 0.58), pt(0.90, 0.66), pt(0.90, 0.92),
    ...arcPoints(C[0], C[1], 0.84, 90, 180, 14).slice(1, -1)
  ];
  return [closed(pts)];
}
function puzzlePaths() {
  const pts = [
    pt(0.12, 0.30), pt(0.44, 0.30),
    ...arcPoints(0.50, 0.20, 0.12, 120, 420, 12),
    pt(0.56, 0.30), pt(0.70, 0.30), pt(0.70, 0.476),
    ...arcPoints(0.76, 0.58, 0.12, 240, 480, 12),
    pt(0.70, 0.684), pt(0.70, 0.90), pt(0.12, 0.90)
  ];
  return [closed(pts)];
}
function refreshPaths() {
  const r = 0.36;
  const top = arcPoints(0.5, 0.5, r, 205, 335, 12);
  const bottom = arcPoints(0.5, 0.5, r, 25, 155, 12);
  return [open(top), open(headPoints(top[top.length - 1], 335 + 90, 0.15)), open(bottom), open(headPoints(bottom[bottom.length - 1], 155 + 90, 0.15))];
}
// Handshake drawn on a 24-unit grid (sleeves at the top corners, clasped
// hands in the middle with two finger bumps and a thumb), then mapped into
// the unit box.
function handshakePaths() {
  const g = (v) => 0.06 + 0.044 * (v - 2);
  const G = (x, y) => pt(g(x), g(y));
  const garc = (cx, cy, r, a0, a1, n) => arcPoints(g(cx), g(cy), 0.044 * r, a0, a1, n);
  const main = [
    G(14, 14), G(16.5, 16.5),
    ...garc(18, 15, 2.12, 135, -45, 7).slice(1),
    G(15.62, 9.62),
    ...garc(13.5, 11.74, 3, -45, -135, 5).slice(1),
    G(10.5, 10.5),
    ...garc(9, 9, 2.12, 45, 225, 7).slice(1),
    G(10.31, 4.69),
    ...bowPoints([g(10.31), g(4.69)], [g(17.37), g(3.82)], 0.054, 6).slice(1),
    G(19.2, 4.3), G(21, 4)
  ];
  const finger = [G(11, 17), G(13, 19), ...garc(14.5, 17.5, 2.12, 135, -45, 7).slice(1)];
  return [
    open(main), open(finger),
    open([G(3, 3), G(2, 14), G(8, 15)]),
    open([G(3, 4), G(11, 4)]),
    open([G(21, 3), G(22, 14), G(20, 14)])
  ];
}
function scalePan(cx) {
  return closed([pt(cx, 0.30), pt(cx + 0.14, 0.60), ...arcPoints(cx, 0.60, 0.14, 0, 180, 8).slice(1, -1), pt(cx - 0.14, 0.60)]);
}

export const ICONS = Object.freeze({
  "target": { label: "Target", paths: [circle(0.5, 0.5, 0.42, 24), circle(0.5, 0.5, 0.26, 20), circle(0.5, 0.5, 0.10, 12)] },
  "rocket": { label: "Rocket", paths: [
    shape([0.50, 0.06], [0.64, 0.26], [0.64, 0.74], [0.36, 0.74], [0.36, 0.26]),
    poly([0.36, 0.50], [0.16, 0.70], [0.16, 0.90], [0.36, 0.74]),
    poly([0.64, 0.50], [0.84, 0.70], [0.84, 0.90], [0.64, 0.74]),
    circle(0.50, 0.40, 0.09, 12)
  ] },
  "people": { label: "People", paths: [
    circle(0.36, 0.30, 0.13, 16),
    open([pt(0.12, 0.86), pt(0.12, 0.68), ...arcPoints(0.36, 0.68, 0.24, 180, 360, 10).slice(1, -1), pt(0.60, 0.68), pt(0.60, 0.86)]),
    circle(0.70, 0.29, 0.10, 14),
    open([...arcPoints(0.70, 0.68, 0.20, 255, 360, 8), pt(0.90, 0.86)])
  ] },
  "person": { label: "Person", paths: [
    circle(0.50, 0.28, 0.14, 16),
    open([pt(0.20, 0.90), pt(0.20, 0.82), ...arcPoints(0.50, 0.82, 0.30, 180, 360, 12).slice(1, -1), pt(0.80, 0.82), pt(0.80, 0.90)])
  ] },
  "gear": { label: "Gear", paths: [closed(gearPoints(0.5, 0.5, 0.44, 0.32, 8)), circle(0.5, 0.5, 0.13, 14)] },
  "chart-bar": { label: "Bar chart", paths: [
    line(0.08, 0.90, 0.92, 0.90),
    poly([0.14, 0.90], [0.14, 0.58], [0.30, 0.58], [0.30, 0.90]),
    poly([0.40, 0.90], [0.40, 0.38], [0.56, 0.38], [0.56, 0.90]),
    poly([0.66, 0.90], [0.66, 0.16], [0.82, 0.16], [0.82, 0.90])
  ] },
  "chart-line": { label: "Line chart", paths: [
    poly([0.10, 0.10], [0.10, 0.90], [0.90, 0.90]),
    poly([0.22, 0.70], [0.40, 0.46], [0.56, 0.60], [0.86, 0.24])
  ] },
  "shield": { label: "Shield", paths: [
    shape([0.50, 0.08], [0.84, 0.20], [0.84, 0.46], [0.80, 0.62], [0.70, 0.76], [0.58, 0.86], [0.50, 0.92], [0.42, 0.86], [0.30, 0.76], [0.20, 0.62], [0.16, 0.46], [0.16, 0.20]),
    poly([0.36, 0.50], [0.46, 0.60], [0.64, 0.40])
  ] },
  "clock": { label: "Clock", paths: [circle(0.5, 0.5, 0.42, 24), poly([0.50, 0.26], [0.50, 0.52], [0.68, 0.62])] },
  "money": { label: "Money", paths: [rect(0.06, 0.26, 0.94, 0.74), circle(0.50, 0.50, 0.14, 16), line(0.20, 0.44, 0.20, 0.56), line(0.80, 0.44, 0.80, 0.56)] },
  "map-pin": { label: "Map pin", paths: [
    closed([...arcPoints(0.50, 0.38, 0.28, 150, 390, 16), pt(0.50, 0.92)]),
    circle(0.50, 0.38, 0.10, 12)
  ] },
  "lightbulb": { label: "Lightbulb", paths: [
    closed([...arcPoints(0.50, 0.40, 0.28, 140, 400, 16), pt(0.62, 0.72), pt(0.62, 0.78), pt(0.38, 0.78), pt(0.38, 0.72)]),
    line(0.40, 0.88, 0.60, 0.88)
  ] },
  "checklist": { label: "Checklist", paths: [
    poly([0.08, 0.22], [0.17, 0.31], [0.30, 0.13]), line(0.42, 0.22, 0.92, 0.22),
    poly([0.08, 0.50], [0.17, 0.59], [0.30, 0.41]), line(0.42, 0.50, 0.92, 0.50),
    poly([0.08, 0.78], [0.17, 0.87], [0.30, 0.69]), line(0.42, 0.78, 0.92, 0.78)
  ] },
  "handshake": { label: "Handshake", paths: handshakePaths() },
  "building": { label: "Building", paths: [
    rect(0.18, 0.08, 0.82, 0.92),
    poly([0.42, 0.92], [0.42, 0.72], [0.58, 0.72], [0.58, 0.92]),
    rect(0.28, 0.22, 0.42, 0.36), rect(0.58, 0.22, 0.72, 0.36),
    rect(0.28, 0.48, 0.42, 0.62), rect(0.58, 0.48, 0.72, 0.62)
  ] },
  "globe": { label: "Globe", paths: [circle(0.5, 0.5, 0.42, 24), closed(earcPoints(0.5, 0.5, 0.18, 0.42, 0, 360, 20).slice(0, 20)), line(0.08, 0.50, 0.92, 0.50)] },
  "lock": { label: "Lock", paths: [
    open([pt(0.30, 0.46), pt(0.30, 0.38), ...arcPoints(0.50, 0.38, 0.20, 180, 360, 10).slice(1, -1), pt(0.70, 0.38), pt(0.70, 0.46)]),
    rect(0.18, 0.46, 0.82, 0.90),
    line(0.50, 0.60, 0.50, 0.74)
  ] },
  "search": { label: "Search", paths: [circle(0.42, 0.42, 0.30, 20), line(0.64, 0.64, 0.90, 0.90)] },
  "growth": { label: "Growth", paths: [poly([0.08, 0.80], [0.36, 0.50], [0.54, 0.66], [0.90, 0.28]), poly([0.68, 0.28], [0.90, 0.28], [0.90, 0.50])] },
  "funnel": { label: "Funnel", paths: [shape([0.08, 0.12], [0.92, 0.12], [0.60, 0.50], [0.60, 0.84], [0.40, 0.92], [0.40, 0.50])] },
  "flag": { label: "Flag", paths: [line(0.18, 0.08, 0.18, 0.92), shape([0.18, 0.16], [0.84, 0.16], [0.70, 0.38], [0.84, 0.60], [0.18, 0.60])] },
  "star": { label: "Star", paths: [closed(starPoints(0.5, 0.54, 0.44, 0.19))] },
  "warning": { label: "Warning", paths: [shape([0.50, 0.10], [0.92, 0.86], [0.08, 0.86]), line(0.50, 0.38, 0.50, 0.60), dot(0.50, 0.73)] },
  "info": { label: "Info", paths: [circle(0.5, 0.5, 0.42, 24), line(0.50, 0.46, 0.50, 0.70), dot(0.50, 0.31)] },
  "document": { label: "Document", paths: [
    shape([0.22, 0.08], [0.62, 0.08], [0.78, 0.24], [0.78, 0.92], [0.22, 0.92]),
    poly([0.62, 0.08], [0.62, 0.24], [0.78, 0.24]),
    line(0.36, 0.50, 0.64, 0.50), line(0.36, 0.66, 0.64, 0.66)
  ] },
  "folder": { label: "Folder", paths: [shape([0.08, 0.20], [0.36, 0.20], [0.44, 0.30], [0.92, 0.30], [0.92, 0.84], [0.08, 0.84])] },
  "mail": { label: "Mail", paths: [rect(0.08, 0.22, 0.92, 0.78), poly([0.08, 0.24], [0.50, 0.54], [0.92, 0.24])] },
  "phone": { label: "Phone", paths: phonePaths() },
  "calendar": { label: "Calendar", paths: [rect(0.10, 0.18, 0.90, 0.90), line(0.10, 0.40, 0.90, 0.40), line(0.32, 0.08, 0.32, 0.28), line(0.68, 0.08, 0.68, 0.28)] },
  "truck": { label: "Truck", paths: [
    rect(0.06, 0.26, 0.60, 0.70),
    poly([0.60, 0.40], [0.78, 0.40], [0.92, 0.56], [0.92, 0.70], [0.60, 0.70]),
    circle(0.26, 0.80, 0.10, 12), circle(0.74, 0.80, 0.10, 12)
  ] },
  "factory": { label: "Factory", paths: [
    shape([0.08, 0.92], [0.08, 0.12], [0.24, 0.12], [0.24, 0.46], [0.46, 0.32], [0.46, 0.46], [0.68, 0.32], [0.68, 0.46], [0.92, 0.32], [0.92, 0.92]),
    poly([0.44, 0.92], [0.44, 0.72], [0.56, 0.72], [0.56, 0.92])
  ] },
  "leaf": { label: "Leaf", paths: [
    closed([...bowPoints([0.14, 0.86], [0.86, 0.14], 0.22, 12), ...bowPoints([0.86, 0.14], [0.14, 0.86], 0.22, 12).slice(1, -1)]),
    line(0.14, 0.86, 0.72, 0.28)
  ] },
  "bolt": { label: "Bolt", paths: [shape([0.58, 0.06], [0.22, 0.52], [0.46, 0.52], [0.38, 0.94], [0.78, 0.44], [0.54, 0.44])] },
  "cloud": { label: "Cloud", paths: cloudPaths() },
  "database": { label: "Database", paths: [
    closed(earcPoints(0.5, 0.24, 0.36, 0.12, 0, 360, 20).slice(0, 20)),
    open([pt(0.14, 0.24), pt(0.14, 0.78), ...earcPoints(0.5, 0.78, 0.36, 0.12, 180, 0, 10).slice(1, -1), pt(0.86, 0.78), pt(0.86, 0.24)]),
    open(earcPoints(0.5, 0.51, 0.36, 0.12, 0, 180, 10))
  ] },
  "layers": { label: "Layers", paths: [
    shape([0.50, 0.08], [0.92, 0.32], [0.50, 0.56], [0.08, 0.32]),
    poly([0.08, 0.50], [0.50, 0.74], [0.92, 0.50]),
    poly([0.08, 0.68], [0.50, 0.92], [0.92, 0.68])
  ] },
  "puzzle": { label: "Puzzle", paths: puzzlePaths() },
  "megaphone": { label: "Megaphone", paths: [
    shape([0.08, 0.36], [0.28, 0.36], [0.80, 0.10], [0.80, 0.76], [0.28, 0.50], [0.08, 0.50]),
    poly([0.18, 0.50], [0.26, 0.86], [0.42, 0.86], [0.36, 0.54])
  ] },
  "briefcase": { label: "Briefcase", paths: [rect(0.08, 0.32, 0.92, 0.88), poly([0.36, 0.32], [0.36, 0.16], [0.64, 0.16], [0.64, 0.32]), line(0.08, 0.56, 0.92, 0.56)] },
  "wrench": { label: "Wrench", paths: wrenchPaths() },
  "refresh": { label: "Refresh", paths: refreshPaths() },
  "link": { label: "Link", paths: [
    open([pt(0.42, 0.72), pt(0.30, 0.72), ...arcPoints(0.30, 0.50, 0.22, 90, 270, 10).slice(1, -1), pt(0.30, 0.28), pt(0.42, 0.28)]),
    open([pt(0.58, 0.28), pt(0.70, 0.28), ...arcPoints(0.70, 0.50, 0.22, 270, 450, 10).slice(1, -1), pt(0.70, 0.72), pt(0.58, 0.72)]),
    line(0.34, 0.50, 0.66, 0.50)
  ] },
  "eye": { label: "Eye", paths: [
    closed([...bowPoints([0.06, 0.50], [0.94, 0.50], 0.26, 12), ...bowPoints([0.94, 0.50], [0.06, 0.50], 0.26, 12).slice(1, -1)]),
    circle(0.50, 0.50, 0.14, 16)
  ] },
  "scale": { label: "Scale", paths: [line(0.50, 0.12, 0.50, 0.84), line(0.30, 0.88, 0.70, 0.88), line(0.14, 0.30, 0.86, 0.30), scalePan(0.22), scalePan(0.78)] },
  "check": { label: "Check", paths: [poly([0.12, 0.52], [0.38, 0.78], [0.88, 0.24])] },
  "cross": { label: "Cross", paths: [line(0.16, 0.16, 0.84, 0.84), line(0.84, 0.16, 0.16, 0.84)] },
  "arrow-right": { label: "Arrow right", paths: [line(0.08, 0.50, 0.90, 0.50), poly([0.60, 0.20], [0.90, 0.50], [0.60, 0.80])] },
  "plus": { label: "Plus", paths: [line(0.50, 0.10, 0.50, 0.90), line(0.10, 0.50, 0.90, 0.50)] }
});

export const ICON_NAMES = Object.freeze(Object.keys(ICONS).sort());

const ALIASES = Object.freeze({
  team: "people", user: "person", settings: "gear", "bar-chart": "chart-bar", trend: "chart-line",
  pin: "map-pin", location: "map-pin", idea: "lightbulb", tick: "check", x: "cross"
});

export function iconDefinition(name) {
  if (typeof name !== "string") return null;
  const key = name.trim().toLowerCase();
  return ICONS[key] ?? ICONS[ALIASES[key]] ?? null;
}

// SVG path data for an icon mapped into an absolute frame {x, y, width, height}.
export function iconSvgPaths(name, frame) {
  const def = iconDefinition(name);
  if (!def) return "";
  const { x = 0, y = 0, width = 1, height = 1 } = frame ?? {};
  const fmt = (v) => String(Math.round(v * 1000) / 1000);
  return def.paths.map((path) => {
    const cmds = path.points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${fmt(x + px * width)} ${fmt(y + py * height)}`);
    return cmds.join(" ") + (path.closed ? " Z" : "");
  }).join(" ");
}
