/**
 * The four things every component module does.
 *
 * Measure a string at a token size, draw a filled box, place a measured string
 * in a frame, and group a number's thousands. Each of those had grown its own
 * copy in six to ten modules - `measure` alone existed in six, with four
 * different argument orders, so calling one with another's order silently
 * measured the wrong thing. They live here once.
 *
 * Every helper takes an options object rather than a tail of positional
 * booleans, and the modules keep a one-line local alias where their own call
 * sites read better positionally. The alias is a name; this is the behaviour.
 */

import { token, tokenValue, textPrimitive, rectPrimitive } from "./core.mjs";
import { measureText } from "./text-layout.mjs";

/** A token id (`"type.body"`), a token reference, or a raw number, resolved. */
export function sizeValue(size) {
  if (typeof size === "number") return size;
  return tokenValue(typeof size === "string" ? token(size) : size);
}

/**
 * Measure a string at a token size, in the deck's resolved face.
 *
 * `wrapWidthRatio: 1` is not a default anyone should have to remember: a
 * component measures against the frame it was given, not against a fraction of
 * it, or the text it drew will not be the text it measured.
 */
export function measureAt(text, width, { size = "type.body", bold = false, font = "font.body" } = {}) {
  return measureText(String(text), width, {
    fontFamily: tokenValue(typeof font === "string" ? token(font) : font),
    fontSize: sizeValue(size),
    bold,
    wrapWidthRatio: 1,
  });
}

/** A filled box: the hairline width is the deck's, the radius a token id. */
export function fillRect(id, role, frame, fill, { stroke = "none", radius = "radius.none", data } = {}) {
  return rectPrimitive({
    id, role, frame,
    style: { fill, stroke, lineWidth: token("line.hairline"), radius: token(radius) },
    ...(data ? { data } : {}),
  });
}

/**
 * Place an already-measured string in a frame.
 *
 * The frame takes the layout's height and the style its line height, so the
 * node's box is the box the text actually occupies - which is what every
 * overlap and void gate reads.
 */
export function measuredLabel(id, role, frame, layout, style) {
  return textPrimitive({
    id, role,
    frame: { ...frame, height: layout.height },
    text: layout.text,
    style: { ...style, lineHeight: layout.lineHeight },
    data: { textLayout: layout },
  });
}

/**
 * Four figures and up read with a thousands separator, the way every published
 * page prints them: 10,156 rather than 10156.
 */
export function groupThousands(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
