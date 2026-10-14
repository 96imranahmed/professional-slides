import { measureText, lineBox } from "./text-layout.mjs";

// Scene-level checks for what the rendered-DOM audit (the suite's, in
// evals/support/overlap-audit.mjs) reads as allowed: a label
// a line runs through, a label touching the frame of a box beside it, and a
// display-face numeral whose old-style figure descends onto a rule under it.
// They read the scene's own geometry (a text node's measured layout, a line's
// end points), so they run without a browser, at build time.
// What each scene check says, for the vocabulary every emitted code is held to.
export const OVERLAP_CODES = Object.freeze({
  TEXT_ON_LINE: "a line runs through a label's ink",
  TEXT_ON_EDGE: "a label within 2px of the frame of a box it is not inside",
  DESCENDER_ON_RULE: "a display-face numeral's old-style descender set on a rule under it",
  SCATTER_UNKEYED: "a scatter coloured by series with no key and no named ends",
  TEXT_ON_TEXT: "two labels whose ink overlaps",
  MAP_LABEL_ASTRAY: "a map marker's label set nearer another marker than its own, with no leader to its own",
});

const LABEL_ROLES = new Set(["flow-arrow-label", "data-label", "chart-reference-label", "annotation-text", "axis-title", "category-label", "legend-label", "chart-threshold-label", "insight-caption", "exhibit-link-label", "chart-event-label"]);
// An event's dashed rule is a line through the plot like a reference line, and was read as none: on the BA retest the
// Covid-grounding rule ran through "207,000 flights" and "22" on hb01 and through "107" on hb02, and no check saw it.
const LINE_ROLES = new Set(["flow-arrow", "chart-line", "chart-reference-line", "chart-threshold-line", "annotation-leader", "data-label-leader", "exhibit-link-line", "chart-event-line"]);
// A callout's box is filled: a label under it is hidden whether or not the callout's own words meet its ink.
const COVERING_ROLES = new Set(["annotation-surface"]);
const BOX_ROLES = new Set(["flow-step", "chart-mark", "fact-tile"]);
const RULE_ROLES = new Set(["divider-accent", "cover-accent", "section-heading-rule", "takeaways-rule"]);
const OLD_STYLE_DESCENDERS = /[34579]/;
// How far two labels' ink may meet, each way, before they read as one over the other: the ink box's own rounding.
const TEXT_CLEAR = 1.5;

// The body faces' vertical metrics, as a share of the em: the line box holds
// ascent and descent centred in its leading; figures and capitals reach the
// cap height above the baseline, and only a descending glyph goes below it.
const ASCENT = 0.905, DESCENT = 0.212, CAP = 0.716;
const DESCENDING = /[gjpqyQ,;()[\]{}|/_]/;

/** The width `text` sets at in the node's face and size, or an estimate where the face cannot be measured. */
function setWidth(text, style, px) {
  try {
    return measureText(text, 1e5, { fontFamily: style?.fontFamily?.value ?? "Arial", fontSize: Number(style?.fontSize?.value), bold: style?.bold === true || style?.fontFamily?.nativeBold === true }).width;
  } catch { return String(text).length * px * 0.55; }
}

/**
 * A text node's ink box: the glyphs as set, not the frame they are set in. A
 * value label's frame is a 60px slot round four figures; read as ink it puts
 * every line chart's own segments through its labels. The lines are measured
 * in the node's face (or taken from its layout), placed by its alignment, and
 * held from the cap height of the first line to the baseline of the last - or
 * the descent, where the last line descends.
 */
export function inkBox(node) {
  const layout = node.data?.textLayout, style = node.style ?? {};
  const pt = Number(style.fontSize?.value);
  const lines = layout?.lines?.length ? layout.lines.map(String) : String(node.text ?? "").split("\n");
  if (!Number.isFinite(pt) || pt <= 0 || !lines.some((line) => line.trim())) {
    if (!layout || !Number.isFinite(layout.width) || !Number.isFinite(layout.height)) return node.frame;
    return placed(node, layout.width, layout.height, 0, layout.height);
  }
  const px = pt * 96 / 72, line = Number.isFinite(layout?.lineHeight) ? layout.lineHeight : lineBox(pt);
  const width = Math.max(...lines.map((text) => setWidth(text, style, px)));
  const gap = (line - (ASCENT + DESCENT) * px) / 2, baseline = gap + ASCENT * px;
  const top = baseline - CAP * px, bottom = (lines.length - 1) * line + baseline + (DESCENDING.test(lines.at(-1)) ? DESCENT * px : 0);
  return placed(node, width, lines.length * line, top, bottom);
}

/**
 * The box from `top` to `bottom` of a block `width` by `height`, placed in the
 * node's frame by its alignment - and, for a label turned a quarter (a table's
 * row-group label set on its side, a rail's tab), turned with it about the
 * frame's centre: unturned, its ink lay across the columns beside it.
 */
function placed(node, width, height, top, bottom) {
  const align = node.style?.align ?? "left", valign = node.style?.valign ?? "top";
  const x = align === "center" ? node.frame.x + (node.frame.width - width) / 2 : align === "right" ? node.frame.x + node.frame.width - width : node.frame.x;
  const y = valign === "mid" || valign === "middle" ? node.frame.y + (node.frame.height - height) / 2 : valign === "bottom" ? node.frame.y + node.frame.height - height : node.frame.y;
  const box = { x, y: y + top, width, height: bottom - top };
  const turn = ((Number(node.style?.rotate || 0) % 360) + 360) % 360;
  if (turn !== 90 && turn !== 270) return box;
  const cx = node.frame.x + node.frame.width / 2, cy = node.frame.y + node.frame.height / 2;
  // A quarter turn clockwise takes (dx, dy) from the centre to (-dy, dx); a quarter back, to (dy, -dx).
  const [dx0, dx1, dy0, dy1] = [box.x - cx, box.x + box.width - cx, box.y - cy, box.y + box.height - cy];
  return turn === 90 ? { x: cx - dy1, y: cy + dx0, width: box.height, height: box.width } : { x: cx + dy0, y: cy - dx1, width: box.height, height: box.width };
}

function crosses(box, line, pad = -1) {
  const { x1, y1, x2, y2 } = line.data ?? {};
  if (![x1, y1, x2, y2].every(Number.isFinite)) return false;
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  for (let i = 0; i <= steps; i++) {
    const x = x1 + (x2 - x1) * i / steps, y = y1 + (y2 - y1) * i / steps;
    if (x > box.x - pad && x < box.x + box.width + pad && y > box.y - pad && y < box.y + box.height + pad) return true;
  }
  return false;
}

/**
 * Collisions the scene carries that the paint-order audit does not refuse:
 * TEXT_ON_LINE (a line runs through a label's ink), TEXT_ON_EDGE (a label
 * within 2px of a box it is not inside) and DESCENDER_ON_RULE (a numeral in
 * the display face, whose old-style 3, 4, 5, 7 and 9 descend below the line,
 * set on the bottom of its box with a rule under it). Leaders to their own
 * label are exempt: a leader ends at the text it points from.
 */
export function sceneCollisions(slide) {
  const nodes = slide.nodes || [], findings = [];
  const texts = nodes.filter((n) => n.type === "text" && LABEL_ROLES.has(n.role) && String(n.text ?? "").trim());
  for (const text of texts) {
    const ink = inkBox(text);
    for (const line of nodes.filter((n) => n.type === "line" && LINE_ROLES.has(n.role))) {
      // A leader ends at its own label; a change arrow's shaft is its own label's only - one that runs through another
      // annotation's label is the crossing this refuses.
      const key = line.data?.annotationKey;
      if (["annotation-leader", "data-label-leader"].includes(line.role) && ["annotation-text", "data-label"].includes(text.role) && (key === undefined || key === text.data?.annotationKey)) continue;
      // An event's rule and label cross under their own variant `event`.
      const event = line.role === "chart-event-line" || text.role === "chart-event-label";
      if (crosses(ink, line)) findings.push({ code: "TEXT_ON_LINE", slide: slide.id, text: text.id, line: line.id, roles: [text.role, line.role], ...(event ? { rule: "TEXT_ON_LINE.event" } : {}) });
    }
    for (const box of nodes.filter((n) => n.type === "rect" && BOX_ROLES.has(n.role))) {
      const f = box.frame, inside = ink.x >= f.x && ink.y >= f.y && ink.x + ink.width <= f.x + f.width && ink.y + ink.height <= f.y + f.height;
      const near = ink.x < f.x + f.width + 2 && f.x < ink.x + ink.width + 2 && ink.y < f.y + f.height + 2 && f.y < ink.y + ink.height + 2;
      if (near && !inside) findings.push({ code: "TEXT_ON_EDGE", slide: slide.id, text: text.id, box: box.id, roles: [text.role, box.role] });
    }
  }
  // Two labels set over each other: a value label on a callout, a category name on its neighbour, an end label on a
  // data label. The suite's rendered audit allows no text over text, and until now only the render's own throws and
  // that audit caught it. Read by ink, a pair whose glyphs share more than a pixel each way.
  const inked = nodes.filter((n) => n.type === "text" && String(n.text ?? "").trim() && n.frame).map((n) => [n, inkBox(n)]);
  for (let i = 0; i < inked.length; i++) for (let j = i + 1; j < inked.length; j++) {
    const [[a, p], [b, q]] = [inked[i], inked[j]];
    const across = Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x), down = Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y);
    if (across > TEXT_CLEAR && down > TEXT_CLEAR) findings.push({ code: "TEXT_ON_TEXT", slide: slide.id, text: a.id, other: b.id, roles: [a.role, b.role] });
  }
  // A label under another callout's box: the two inks need not meet for the label to be lost. On the BA retest hw02's
  // callout box covered the top half of the event label "Domestic band and band C added" while the callout's words ended
  // a pixel above it, so the ink test above passed it. The box's own words (one annotation key) are what it holds.
  for (const box of nodes.filter((n) => n.type === "rect" && COVERING_ROLES.has(n.role) && n.frame)) {
    const f = box.frame, key = box.data?.annotationKey;
    for (const [text, ink] of inked) {
      if (key !== undefined && text.data?.annotationKey === key) continue;
      const across = Math.min(ink.x + ink.width, f.x + f.width) - Math.max(ink.x, f.x), down = Math.min(ink.y + ink.height, f.y + f.height) - Math.max(ink.y, f.y);
      if (across > TEXT_CLEAR && down > TEXT_CLEAR) findings.push({ code: "TEXT_ON_TEXT", slide: slide.id, text: text.id, other: box.id, roles: [text.role, box.role], rule: "TEXT_ON_TEXT.covered" });
    }
  }
  for (const numeral of nodes.filter((n) => n.type === "text" && n.style?.valign === "bottom" && n.style?.fontFamily?.tokenId === "font.display" && OLD_STYLE_DESCENDERS.test(String(n.text ?? "")))) {
    const size = Number(numeral.style?.fontSize?.value ?? 0) * 96 / 72, bottom = numeral.frame.y + numeral.frame.height;
    for (const rule of nodes.filter((n) => RULE_ROLES.has(n.role))) {
      const f = rule.frame;
      if (f.x < numeral.frame.x + numeral.frame.width && numeral.frame.x < f.x + f.width && f.y >= bottom - 1 && f.y < bottom + size * 0.25)
        findings.push({ code: "DESCENDER_ON_RULE", slide: slide.id, text: numeral.id, rule: rule.id, roles: [numeral.role, rule.role] });
    }
  }
  return findings;
}

/**
 * A scatter whose points carry two or more series and nothing on the page that
 * names them - no key and no series name at a connected line's end
 * (SCATTER_UNKEYED): three colours of dot a reader cannot tell apart.
 */
export function sceneChartFindings(slide) {
  const nodes = slide.nodes || [], findings = [];
  const scatters = [...new Set(nodes.filter((n) => n.role === "chart-marker" && n.data?.series).map((n) => n.data.componentInstance))];
  for (const instance of scatters) {
    const mine = nodes.filter((n) => n.data?.componentInstance === instance);
    const series = new Set(mine.filter((n) => n.role === "chart-marker" && n.data?.series).map((n) => n.data.series));
    const named = mine.some((n) => n.role === "legend-label" || n.data?.labelKind === "series-end");
    const coloured = new Set(mine.filter((n) => n.role === "chart-marker").map((n) => n.style?.fill?.tokenId ?? n.style?.fill)).size > 1;
    if (series.size > 1 && coloured && !named) findings.push({ code: "SCATTER_UNKEYED", slide: slide.id, instance, series: [...series] });
  }
  return [...findings, ...mapLabelsAstray(slide)];
}

/**
 * A map marker's label nearer another marker's disc than its own, with no
 * leader drawn to its own (MAP_LABEL_ASTRAY): a reader takes a name for the
 * marker it sits beside. The BA retest's hub map set London Heathrow's name
 * beside Amsterdam's +4.4% disc and Amsterdam's beside Heathrow's -4.1%, so
 * the page read Heathrow as shrinking - the reverse of its title. Read off the
 * scene: each label and disc carries the index of the marker it belongs to
 * (maps.mjs), and distance is from the label's frame to the disc's edge.
 */
function mapLabelsAstray(slide) {
  const nodes = slide.nodes || [], findings = [];
  const discs = nodes.filter((n) => n.role === "map-marker" && Number.isInteger(n.data?.markerIndex) && n.frame);
  const led = new Set(nodes.filter((n) => n.role === "map-label-leader" && Number.isInteger(n.data?.markerIndex)).map((n) => `${n.data?.componentInstance ?? ""}|${n.data.markerIndex}`));
  const reach = (f, disc) => { const r = disc.frame.width / 2, cx = disc.frame.x + r, cy = disc.frame.y + disc.frame.height / 2;
    return Math.max(0, Math.hypot(Math.max(f.x - cx, 0, cx - f.x - f.width), Math.max(f.y - cy, 0, cy - f.y - f.height)) - r); };
  for (const label of nodes.filter((n) => n.role === "map-label" && Number.isInteger(n.data?.markerIndex) && n.frame)) {
    const map = label.data?.componentInstance ?? "", index = label.data.markerIndex;
    if (led.has(`${map}|${index}`)) continue;
    const mine = discs.filter((d) => (d.data?.componentInstance ?? "") === map);
    const own = Math.min(...mine.filter((d) => d.data.markerIndex === index).map((d) => reach(label.frame, d)));
    const nearer = mine.filter((d) => d.data.markerIndex !== index && reach(label.frame, d) + 1 < own).sort((a, b) => reach(label.frame, a) - reach(label.frame, b))[0];
    if (Number.isFinite(own) && nearer) findings.push({ code: "MAP_LABEL_ASTRAY", slide: slide.id, text: label.id, label: String(label.text ?? ""), marker: index, nearer: nearer.data.markerIndex, gap: [Math.round(own), Math.round(reach(label.frame, nearer))] });
  }
  return findings;
}

/**
 * How each scene check is held. A label struck by a line and a numeral sat on
 * its rule are read wrongly, and block. So does a scatter with no key: the
 * composer refuses one, and a scene that still carries one has lost the key a
 * reader needs to tell its colours apart. A label within 2px of a neighbouring
 * box is cramped but legible - a spacing question, read beside the page.
 */
export const OVERLAP_SEVERITY = Object.freeze({ TEXT_ON_LINE: "blocker", DESCENDER_ON_RULE: "blocker", SCATTER_UNKEYED: "blocker", TEXT_ON_TEXT: "blocker", TEXT_ON_EDGE: "advisory", MAP_LABEL_ASTRAY: "blocker" });

const OVERLAP_REPAIR = Object.freeze({
  TEXT_ON_LINE: "Move the label off the line: set a reference label at the end of its line clear of the series, a flow label above its arrow, a value label on the side of its point the line leaves open - or shorten it so it fits between the marks.",
  TEXT_ON_EDGE: "Give the label its gap from the box beside it: widen the category slot, set the value inside its own mark, or shorten the label.",
  DESCENDER_ON_RULE: "Set the numeral in lining figures (the body face) or lift it off the rule by its descent.",
  SCATTER_UNKEYED: "Keep the scatter's legend, or connect each series (connect: true) so its name sits at its end.",
  TEXT_ON_TEXT: "Set one label clear of the other: fewer or shorter callouts on that part of the chart, a callout moved to the category its point leaves open, a shorter category name, or a wider slot.",
  MAP_LABEL_ASTRAY: "Set each marker's name beside its own marker: fewer markers in the cluster, a wider `crop` or a region map that spreads them, shorter names - or move the cluster's values into a ranked bar or a callout list beside the map.",
});

/**
 * The scene checks over a composed deck, as gate findings: `slide` the
 * 1-based page, `id` the page's id, `severity` from OVERLAP_SEVERITY. The
 * build reports them with the page gates; authoring reads them on the scene
 * it composes, so the author meets them before the build does.
 */
export function sceneDesignFindings(scene) {
  return (scene?.slides || []).flatMap((slide, i) => [...sceneCollisions(slide), ...sceneChartFindings(slide)].map(({ code, slide: _, rule, ...measured }) => ({
    slide: i + 1, id: slide.sourceSlideId ?? slide.id, code, ...(rule ? { rule } : {}), severity: OVERLAP_SEVERITY[code] ?? "blocker",
    measured, threshold: code === "TEXT_ON_EDGE" ? "2px clear" : "no contact", repair: OVERLAP_REPAIR[code],
  })));
}
