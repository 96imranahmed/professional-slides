// One marker vocabulary for the whole deck. Every numbered disc — on a list, a
// process step, a table tracker, a map pin, an agenda item — is drawn here, so
// they match to the pixel; every icon-in-a-circle likewise. Components pass a
// frame and get primitives back; they never draw a numeral themselves.
import { rectPrimitive, token, tokenValue, stableId, textPrimitive, ellipsePrimitive, shapePrimitive } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { iconDefinition } from "./icons.mjs";

export const MARK_TOKENS = Object.freeze(["color.componentPrimary", "color.accent", "color.onPrimary", "color.ink", "color.surface", "color.rule", "color.textSecondary", "font.body", "type.compact", "type.label", "icon.medium", "line.standard", "line.hairline", "radius.round"]);

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
 * names fail rather than silently changing an icon into a letter.
 */
export function iconMarker({ id, role = "icon", x, y, size, icon, tone = "outline", data = {} }) {
  const definition = iconDefinition(icon);
  if (!definition) throw new Error(`Unknown icon: ${String(icon)}; choose a name from runtime/icons.mjs ICON_NAMES.`);
  const nodes = [];
  // outline: ring + primary glyph; filled: primary disc + white glyph; plain:
  // primary glyph alone; inverse: white glyph alone (on a filled field);
  // muted: a hairline ring and a secondary glyph, for a marker that is only
  // telling the reader where the item starts.
  // `faint`: the glyph alone in the rule grey - the unfilled figures of an icon
  // array, which have to read as present but not counted.
  const ring = !["plain", "inverse", "accent", "faint"].includes(tone);
  // `accent`: the glyph alone in the house accent, so an icon list reads in the
  // same colour as the phrases it highlights.
  const strokeColor = tone === "filled" || tone === "inverse" ? WHITE
    : tone === "accent" ? token("color.accent")
    : tone === "muted" ? token("color.textSecondary")
    : tone === "faint" ? token("color.rule") : PRIMARY;
  const ringStroke = tone === "muted" ? token("color.rule") : PRIMARY;
  if (ring) nodes.push(ellipsePrimitive({ id: stableId(id, "ring"), role: `${role}-ring`, frame: { x, y, width: size, height: size }, style: { fill: tone === "filled" ? PRIMARY : SURFACE, stroke: ringStroke, lineWidth: token("line.standard"), radius: token("radius.round") }, data: { ...data, icon, tone } }));
  const inset = ring ? size * 0.24 : size * 0.06;
  const box = { x: x + inset, y: y + inset, width: size - 2 * inset, height: size - 2 * inset };
  nodes.push(shapePrimitive({ id: stableId(id, "glyph"), role: `${role}-glyph`, geometry: "iconPath", frame: box, style: { fill: "none", stroke: strokeColor, lineWidth: token("line.standard"), lineCap: "round" }, data: { ...data, icon, paths: definition.paths } }));
  return nodes;
}

/** ✓ / ✗ disc for checklists: green tick or red cross on a filled disc. */
export function stateMarker({ id, role = "marker", x, y, size = markerSize(), state, data = {} }) {
  // `open`: an empty box - a question still to answer, a criterion not yet
  // judged. A checklist of open questions drew each one as a red cross,
  // because anything that was not "yes" was "no".
  if (state === "open") {
    const box = size * 0.78, inset = (size - box) / 2;
    return [rectPrimitive({ id: stableId(id, "box"), role, frame: { x: x + inset, y: y + inset, width: box, height: box },
      style: { fill: "none", stroke: PRIMARY, lineWidth: token("line.standard"), radius: token("radius.none") }, data: { ...data, marker: "state", state: "open" } })];
  }
  const yes = state === "yes" || state === true || state === "done";
  const fill = token(yes ? "color.positive" : "color.negative");
  const definition = iconDefinition(yes ? "check" : "cross");
  const inset = size * 0.26;
  return [
    ellipsePrimitive({ id: stableId(id, "disc"), role, frame: { x, y, width: size, height: size }, style: { fill, stroke: fill, lineWidth: token("line.hairline"), radius: token("radius.round") }, data: { ...data, marker: "state", state: yes ? "yes" : "no" } }),
    shapePrimitive({ id: stableId(id, "glyph"), role: `${role}-glyph`, geometry: "iconPath", frame: { x: x + inset, y: y + inset, width: size - 2 * inset, height: size - 2 * inset }, style: { fill: "none", stroke: WHITE, lineWidth: token("line.standard"), lineCap: "round" }, data: { ...data, icon: yes ? "check" : "cross", paths: definition.paths } })
  ];
}
