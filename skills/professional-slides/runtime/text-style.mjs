// The three primitives every component that draws type needs: the style object,
// the box style beside it, and the node that has been measured against its frame.
//
// There were five `textStyle`, three `measuredTextNode` and two `boxStyle`, one
// set per component family, and they had drifted: the registry's textStyle
// defaulted `valign` to "mid" and horizons' to "top", so the same call in two
// files set type on different baselines. The measured node had drifted further
// and in a way a reader would see - the registry's steps the font size down
// through `fitText` before it refuses, while horizons and insight-tree-table
// threw on the first overflow. A component that used the wrong one failed a
// build where every other component would have adapted.
//
// Each family keeps its own argument order where it has one (tables takes
// `bold` first, chart annotations centre by default); what they no longer keep
// is a second implementation.
import { textPrimitive, tokenValue } from "./core.mjs";
import { measureText, measureTextRuns } from "./text-layout.mjs";

/**
 * Degradation ladder for measured text: fit at the token size; otherwise step
 * the size down in 0.5pt steps to a floor of 80% (never below 9pt) and record
 * the step. Only when the floor still overflows does the component refuse,
 * naming the overflow.
 */
export function fitText({ text, runs, width, height, fontFamily, fontSize, bold, minScale = 0.8, floorPt = 9 }) {
  const measure = (size) => (runs
    ? measureTextRuns(runs, width, { fontFamily, fontSize: size, wrapWidthRatio: 1 })
    : measureText(text, width, { fontFamily, fontSize: size, bold, wrapWidthRatio: 1 }));
  let size = fontSize, layout = measure(size);
  const floor = Math.max(floorPt, Math.round(fontSize * minScale * 2) / 2);
  while (height !== undefined && layout.height > height && size - 0.5 >= floor) { size -= 0.5; layout = measure(size); }
  return { layout, fontSize: size, stepped: size !== fontSize, overflow: height !== undefined && layout.height > height ? layout.height - height : 0 };
}

/** The canonical text style. Every field explicit; callers supply their defaults. */
export function textStyle({ fontFamily, fontSize, color, bold = false, align = "left", valign = "top", wrap }) {
  return { fontFamily, fontSize, color, bold, align, valign, ...(wrap === undefined ? {} : { wrap }) };
}

/** The canonical box style. */
export function boxStyle({ fill, stroke = "none", lineWidth, radius }) {
  return { fill, stroke, lineWidth, radius };
}

/**
 * A text node measured against the frame it was given.
 *
 * `fit: true` (the default) runs the degradation ladder: the text is set at its
 * token size, or stepped down in half points to a floor, and only then refused.
 * `fit: false` measures once and refuses on overflow, for the components whose
 * geometry is computed from the text and cannot absorb a smaller size.
 *
 * `shrinkToText` returns the frame at the measured height rather than the height
 * it was given, for a component that places rows from what they measure.
 * `center` additionally centres the text in the height it was given. The two are
 * separate: a tree row shrinks whether or not its leaf is centred.
 */
export function measuredTextNode(input) {
  const { id, role, frame, text, runs, style, data = {}, fit = true, center = false, shrinkToText = false, overflowMessage } = input;
  if (runs && runs.map((run) => run.text).join("") !== text) {
    throw new Error("Paragraph emphasis must preserve exact text");
  }
  const fontFamily = tokenValue(style.fontFamily), fontSize = tokenValue(style.fontSize);
  if (!fit) {
    const layout = measureText(text, frame.width, { fontFamily, fontSize, bold: style.bold, wrapWidthRatio: 1 });
    if (layout.height > frame.height) {
      throw new Error(overflowMessage ? overflowMessage(id, layout, frame) : `${id} exceeds its allocated text height`);
    }
    const y = center ? frame.y + (frame.height - layout.height) / 2 : frame.y;
    const placed = shrinkToText ? { x: frame.x, y, width: frame.width, height: layout.height } : { ...frame, y };
    return textPrimitive({
      id, role, frame: placed,
      text: layout.text,
      style: { ...style, lineHeight: layout.lineHeight, ...(shrinkToText ? {} : { wrap: false }) },
      data: { ...data, textLayout: layout },
    });
  }
  const fitted = fitText({ text, runs, width: frame.width, height: frame.height, fontFamily, fontSize, bold: style.bold });
  if (fitted.overflow > 0) {
    throw new Error(`${id} overflows its ${frame.height}px box by ${Math.ceil(fitted.overflow)}px at ${fitted.fontSize}pt; split the page or cut the copy`);
  }
  const layout = fitted.layout;
  const stepped = fitted.stepped
    ? { fontSize: { tokenId: style.fontSize?.tokenId ?? "type.body", kind: "fontSizePt", value: fitted.fontSize } }
    : {};
  return textPrimitive({
    ...input, id, role, frame,
    text: layout.text,
    ...(layout.runs ? { runs: layout.runs } : {}),
    style: { ...style, lineHeight: layout.lineHeight, wrap: false, ...stepped },
    data: { ...data, textLayout: layout, ...(fitted.stepped ? { fitStep: fitted.fontSize } : {}) },
  });
}
