// One marker vocabulary for the whole deck. Every numbered disc — on a list, a
// process step, a table tracker, a map pin, an agenda item — is drawn here, so
// they match to the pixel; every icon-in-a-circle likewise. Components pass a
// frame and get primitives back; they never draw a numeral themselves.
import { token, tokenValue, stableId, textPrimitive, ellipsePrimitive, shapePrimitive } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { iconDefinition } from "./icons.mjs";

export const MARK_TOKENS = Object.freeze(["color.componentPrimary", "color.onPrimary", "color.ink", "color.surface", "font.body", "type.compact", "type.label", "icon.medium", "line.standard", "line.hairline", "radius.round"]);

const PRIMARY = token("color.componentPrimary"), WHITE = token("color.onPrimary"), INK = token("color.ink"), SURFACE = token("color.surface");

/** Diameter of a numbered disc: the icon.medium token (24 px at executive density). */
export function markerSize() { return tokenValue(token("icon.medium")); }

/**
 * A numbered disc. `reverse` draws a white disc with a primary numeral for use
 * on a primary-filled surface. Returns [disc, numeral]; the numeral is a
 * single-line label centred on the disc.
 */
export function numberMarker({ id, role = "marker", labelRole = `${role}-label`, x, y, size = markerSize(), number, reverse = false, data = {} }) {
  const fill = reverse ? WHITE : PRIMARY, ink = reverse ? PRIMARY : WHITE;
  const label = measureText(String(number), size, { fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(token("type.compact")), bold: true, wrapWidthRatio: 1 });
  return [
    ellipsePrimitive({ id: stableId(id, "disc"), role, frame: { x, y, width: size, height: size }, style: { fill, stroke: reverse ? PRIMARY : WHITE, lineWidth: token("line.hairline"), radius: token("radius.round") }, data: { ...data, marker: "number", number } }),
    textPrimitive({ id: stableId(id, "numeral"), role: labelRole, frame: { x, y: y + (size - label.height) / 2, width: size, height: label.height }, text: String(number), style: { fontFamily: token("font.body"), fontSize: token("type.compact"), color: ink, bold: true, align: "center", valign: "top", wrap: false, lineHeight: label.lineHeight }, data: { ...data, marker: "number", number, textLayout: label } })
  ];
}

/**
 * A line icon inside a circle. `tone`: "outline" (primary ring, primary strokes),
 * "filled" (primary disc, white strokes) or "plain" (no ring). Unknown icon
 * names draw the initial letter so a page never loses its marker.
 */
export function iconMarker({ id, role = "icon", x, y, size, icon, tone = "outline", data = {} }) {
  const nodes = [];
  const ring = tone !== "plain";
  const strokeColor = tone === "filled" ? WHITE : PRIMARY;
  if (ring) nodes.push(ellipsePrimitive({ id: stableId(id, "ring"), role: `${role}-ring`, frame: { x, y, width: size, height: size }, style: { fill: tone === "filled" ? PRIMARY : SURFACE, stroke: PRIMARY, lineWidth: token("line.standard"), radius: token("radius.round") }, data: { ...data, icon, tone } }));
  const definition = iconDefinition(icon);
  const inset = ring ? size * 0.24 : size * 0.06;
  const box = { x: x + inset, y: y + inset, width: size - 2 * inset, height: size - 2 * inset };
  if (definition) {
    nodes.push(shapePrimitive({ id: stableId(id, "glyph"), role: `${role}-glyph`, geometry: "iconPath", frame: box, style: { fill: "none", stroke: strokeColor, lineWidth: token("line.standard"), lineCap: "round" }, data: { ...data, icon, paths: definition.paths } }));
  } else {
    const letter = String(icon || "•").trim().charAt(0).toUpperCase() || "•";
    const label = measureText(letter, size, { fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(token("type.compact")), bold: true, wrapWidthRatio: 1 });
    nodes.push(textPrimitive({ id: stableId(id, "glyph"), role: `${role}-glyph`, frame: { x, y: y + (size - label.height) / 2, width: size, height: label.height }, text: letter, style: { fontFamily: token("font.body"), fontSize: token("type.compact"), color: strokeColor, bold: true, align: "center", valign: "top", wrap: false, lineHeight: label.lineHeight }, data: { ...data, icon, fallback: true, textLayout: label } }));
  }
  return nodes;
}

/** ✓ / ✗ disc for checklists: green tick or red cross on a filled disc. */
export function stateMarker({ id, role = "marker", x, y, size = markerSize(), state, data = {} }) {
  const yes = state === "yes" || state === true || state === "done";
  const fill = token(yes ? "color.positive" : "color.negative");
  const definition = iconDefinition(yes ? "check" : "cross");
  const inset = size * 0.26;
  return [
    ellipsePrimitive({ id: stableId(id, "disc"), role, frame: { x, y, width: size, height: size }, style: { fill, stroke: fill, lineWidth: token("line.hairline"), radius: token("radius.round") }, data: { ...data, marker: "state", state: yes ? "yes" : "no" } }),
    shapePrimitive({ id: stableId(id, "glyph"), role: `${role}-glyph`, geometry: "iconPath", frame: { x: x + inset, y: y + inset, width: size - 2 * inset, height: size - 2 * inset }, style: { fill: "none", stroke: WHITE, lineWidth: token("line.standard"), lineCap: "round" }, data: { ...data, icon: yes ? "check" : "cross", paths: definition.paths } })
  ];
}
