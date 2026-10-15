// The survey question a chart answers, set under its heading as strong survey
// decks set it: a "Q" badge, the question quoted in full and the base it was
// put to.
//
//   question: { text, base }
//
// A survey chart's heading is one line and its subtitle sixteen words, and a
// question asked of a panel runs fifteen to twenty-five words: cut to fit
// either, it stops being the question the answers were given to. So the
// question is its own block, three lines at most, and `base` - "n = 1,204",
// or the count alone - is the population that answered.
import { rectPrimitive, stableId, textPrimitive, token, tokenValue } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { FONT, INK, SECONDARY, CHART_LABEL, textStyle } from "./chart-axes.mjs";

export const QUESTION_LINES = 3;
const BADGE = 22, GAP = 10, AFTER = 10;
const face = () => ({ fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.body")) });
const baseFace = () => ({ fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL) });

/** `question` checked: `{ text, base }`, the base printed as "n = 1,204" where it is given as a count. */
export function normalizeQuestion(question) {
  if (question === undefined || question === null) return null;
  if (!question || typeof question !== "object" || typeof question.text !== "string" || !question.text.trim()) throw new Error("question is { text, base }: the survey question as it was asked, and the base that answered it");
  const base = question.base;
  if (base !== undefined && !(typeof base === "number" && Number.isInteger(base) && base > 0) && !(typeof base === "string" && base.trim()))
    throw new Error("question.base is the population that answered: a count (1204) or the line as printed (\"n = 1,204 commuters\")");
  const printed = typeof base === "number" ? `n = ${base.toLocaleString("en-GB")}` : base?.trim();
  return { text: question.text.trim().replace(/^[“"]|[”"]$/g, ""), base: printed };
}

/** The question's block at a width: its layout, and the height it takes off the chart's frame. */
export function questionLayout(question, width) {
  const q = normalizeQuestion(question);
  if (!q) return null;
  const textWidth = Math.max(120, width - BADGE - GAP);
  const text = measureText(`“${q.text}”`, textWidth, face());
  if (text.lines.length > QUESTION_LINES) throw new Error(`the survey question runs to ${text.lines.length} lines at this width (${QUESTION_LINES} at most); quote the question as it was asked, cut its preamble, or give the chart the page's width`);
  const base = q.base ? measureText(q.base, textWidth, baseFace()) : null;
  const height = Math.max(BADGE, text.height + (base ? base.height + 2 : 0)) + AFTER;
  return { q, text, base, height, textWidth };
}

/** The badge, the question and its base, at the top of `frame`. */
export function questionNodes({ id, frame, layout }) {
  const { text, base } = layout, x = frame.x + BADGE + GAP;
  const nodes = [
    rectPrimitive({ id: stableId(id, "question-badge"), role: "chart-question-badge", frame: { x: frame.x, y: frame.y + 1, width: BADGE, height: BADGE }, style: { fill: token("color.componentPrimary"), stroke: "none", lineWidth: token("line.hairline") } }),
    textPrimitive({ id: stableId(id, "question-badge-label"), role: "chart-question-badge-label", frame: { x: frame.x, y: frame.y + 1, width: BADGE, height: BADGE }, text: "Q", style: { ...textStyle(CHART_LABEL, token("color.onPrimary"), true, "center"), valign: "middle" } }),
    textPrimitive({ id: stableId(id, "question"), role: "chart-question", frame: { x, y: frame.y, width: layout.textWidth, height: text.height }, text: text.text,
      style: { fontFamily: FONT, fontSize: token("type.body"), color: INK, bold: false, align: "left", valign: "top", lineHeight: text.lineHeight, wrap: false }, data: { textLayout: text } }),
  ];
  if (base) nodes.push(textPrimitive({ id: stableId(id, "question-base"), role: "chart-question-base", frame: { x, y: frame.y + text.height + 2, width: layout.textWidth, height: base.height }, text: base.text,
    style: { ...textStyle(CHART_LABEL, SECONDARY, false, "left"), valign: "top", lineHeight: base.lineHeight, wrap: false }, data: { textLayout: base } }));
  return nodes;
}
