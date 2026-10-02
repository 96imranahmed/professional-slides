import { OVERLAP_POLICY } from "./overlap-policy.mjs";
import { measureText, lineBox } from "./text-layout.mjs";

// Uses the rendered DOM's line boxes and SVG hit-testing, not the often much
// larger text containers or the bounding square of a pie slice/diagonal line.
export async function auditSlideOverlaps(page, slide) {
  return page.evaluate(({ slide, policy }) => {
    const elements = new Map([...document.querySelectorAll("[data-node-id]")].map((el) => [el.dataset.nodeId, el]));
    const rect = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    const inside = (outer, inner, tolerance = 0.5) => inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.width <= outer.x + outer.width + tolerance && inner.y + inner.height <= outer.y + outer.height + tolerance;
    const intersection = (a, b) => {
      const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
      return { x, y, width: Math.min(a.x + a.width, b.x + b.width) - x, height: Math.min(a.y + a.height, b.y + b.height) - y };
    };
    const value = (binding) => binding?.value ?? binding;
    const missingNodes = [], textOverflow = [], unexpected = [], intentional = [];
    const entries = slide.nodes.map((node) => {
      const el = elements.get(node.id);
      if (!el) { missingNodes.push(node.id); return null; }
      let boxes = [node.frame];
      if (node.type === "text") {
        const range = document.createRange();
        range.selectNodeContents(el.firstElementChild || el);
        boxes = [...range.getClientRects()].map(rect).filter((r) => r.width > 0 && r.height > 0);
        if (String(node.text).trim() && boxes.some((box) => !inside(node.frame, box, 1.1))) textOverflow.push({ id: node.id, frame: node.frame, rendered: boxes });
      }
      return { ...node, el, boxes };
    }).filter(Boolean);
    const rawHit = (entry, x, y) => {
      if (entry.type === "text") return entry.boxes.some((r) => x > r.x + 0.5 && x < r.x + r.width - 0.5 && y > r.y + 0.5 && y < r.y + r.height - 0.5);
      const p = new DOMPoint(x, y);
      return (value(entry.style.fill) !== "none" && entry.el.isPointInFill?.(p)) || (value(entry.style.stroke) !== "none" && entry.el.isPointInStroke?.(p));
    };
    const maskRoles = { "cover-line": ["cover-panel"], "process-rail": ["process-marker"], "tracker-rail": ["tracker-marker"], "tracker-compact-rail": ["tracker-compact-marker"], "chart-gridline": ["chart-mark", "chart-area", "chart-point-highlight", "chart-label-surface"], "chart-line": ["chart-point-highlight"], "image-placeholder-line": ["image-label-surface", "annotation-surface"] };
    const hit = (entry, x, y) => rawHit(entry, x, y) && !(maskRoles[entry.role] || []).some((role) => entries.some((mask) => mask.role === role && (value(mask.style.opacity) ?? 1) === 1 && rawHit(mask, x, y)));
    const collide = (a, b) => {
      if (a.type === "line" || b.type === "line") {
        const line = a.type === "line" ? a : b, other = line === a ? b : a;
        const { x1, y1, x2, y2 } = line.data;
        const length = Math.hypot(x2 - x1, y2 - y1);
        for (let t = 1; t < length; t += 1) {
          const x = x1 + (x2 - x1) * t / length, y = y1 + (y2 - y1) * t / length;
          if (hit(line, x, y) && hit(other, x, y)) return true;
        }
        return false;
      }
      for (const left of a.boxes) for (const right of b.boxes) {
        const r = intersection(left, right);
        if (r.width <= 1 || r.height <= 1) continue;
        if (a.type === "text" && b.type === "text") return true;
        for (let y = r.y + 0.75; y < r.y + r.height - 0.5; y += 2) for (let x = r.x + 0.75; x < r.x + r.width - 0.5; x += 2) {
          if (hit(a, x, y) && hit(b, x, y)) return true;
        }
      }
      return false;
    };
    const own = (a, b) => a.data.componentInstance && a.data.componentInstance === b.data.componentInstance;
    const descendant = (surface, child) => surface.data.componentInstance && Array.isArray(child.data.componentAncestors) && child.data.componentAncestors.includes(surface.data.componentInstance);
    const allowed = (a, b) => {
      if (a.type === "text" && b.type === "text") return null;
      // A legitimate text backing must precede its text in the native paint
      // order. Otherwise it hides that text, even if an HTML preview looks fine.
      for (const [text, shape] of [[a, b], [b, a]]) if (text.type === "text" && shape.type !== "text" && shape.type !== "line" && value(shape.style.fill) !== "none" && (shape.data.paintOrder ?? entries.indexOf(shape)) > (text.data.paintOrder ?? entries.indexOf(text))) return null;
      for (const [surface, child] of [[a, b], [b, a]]) {
        const related = own(surface, child) || descendant(surface, child);
        if (policy.surfaces.includes(surface.role) && related && inside(surface.frame, child.frame)) return `contained by ${surface.role}`;
        if (["tracker-page-surface", "tracker-backdrop"].includes(surface.role) && ["source-text", "footnote-text", "footer-left", "footer-right", "page-number", "footer-rule", "header-rule"].includes(child.role) && (surface.data.paintOrder ?? entries.indexOf(surface)) < (child.data.paintOrder ?? entries.indexOf(child))) return "page furniture above tracker page field";
        if (!related) continue;
        if (["tracker-page-surface", "tracker-backdrop"].includes(surface.role) && inside(surface.frame, child.frame) && (surface.data.paintOrder ?? entries.indexOf(surface)) < (child.data.paintOrder ?? entries.indexOf(child))) return `tracker child inside its ${surface.role}`;
        if (surface.role === "tracker-selection" && surface.data.sectionId === child.data.sectionId && child.boxes.every(box => inside(surface.frame, box)) && (surface.data.paintOrder ?? entries.indexOf(surface)) < (child.data.paintOrder ?? entries.indexOf(child))) return "selected tracker item inside its exact row highlight";
        if (surface.role === "table-cell" && policy.containedCellMarks.includes(child.role) && surface.data.row === child.data.row && surface.data.column === child.data.column && inside(surface.frame, child.frame) && (surface.data.paintOrder ?? entries.indexOf(surface)) < (child.data.paintOrder ?? entries.indexOf(child))) return "mark inside its own table cell";
        if (surface.role === "chart-label-surface" && surface.data.forNode === child.id) return "gridline knockout behind its exact data label";
        // A callout set inside its own bar (chart-annotations insidePlacement):
        // its own category and series only, wholly inside, painted above it.
        if (surface.role === "chart-mark" && ["annotation-surface", "annotation-text"].includes(child.role) && child.data?.insideMark === true
          && child.data.category === surface.data?.category && (child.data.series === undefined || child.data.series === surface.data?.series)
          && inside(surface.frame, child.frame) && (surface.data.paintOrder ?? entries.indexOf(surface)) < (child.data.paintOrder ?? entries.indexOf(child))) return "callout set inside its own bar";
        if (policy.containedLabels[surface.role] === child.role && child.boxes.every((r) => inside(surface.frame, r)) && rawHit(surface, child.frame.x + child.frame.width / 2, child.frame.y + child.frame.height / 2)) return `label inside its ${surface.role}`;
        if (surface.role === "chart-highlight" && child.role.startsWith("chart-") && child.type !== "text") return "chart category highlight under plot geometry";
        if (surface.role === "chart-highlight" && child.role === "data-label") return "data label over category highlight";
        if (surface.role === "chart-highlight" && child.role === "annotation-leader") return "annotation leader over category highlight";
        if (surface.role === "chart-quadrant" && child.role === "chart-quadrant-title" && surface.data.quadrant === child.data.quadrant) return "quadrant title over its background treatment";
        if (surface.role === "chart-quadrant" && (policy.chartGeometry.includes(child.role) || child.role === "data-label")) return "quadrant background under plot geometry";
        if (surface.role === "annotation-leader" && policy.chartGeometry.includes(child.role)) return "annotation leader anchored to plot geometry";
      }
      if (!own(a, b)) return null;
      for (const rule of policy.keyedLineJoints || []) if (a.type==='line' && b.type==='line' && a.role===rule.role && b.role===rule.role && a.data[rule.key]!==undefined && a.data[rule.key]===b.data[rule.key]) {
        const ends=node=>[[node.data.x1,node.data.y1],[node.data.x2,node.data.y2]];
        if (ends(a).some(p=>ends(b).some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.01))) return rule.reason;
      }
      if (a.role === "annotation-leader" && b.role === "annotation-leader" && a.data.annotationKey && a.data.annotationKey === b.data.annotationKey) return "line junction within one change annotation";
      if(a.role==='table-implication'&&b.role==='table-implication'&&a.data.row===b.data.row&&a.data.column===b.data.column){
        const disc=a.type==='ellipse'?a:b.type==='ellipse'?b:null,mark=disc===a?b:a;
        if(!disc||(inside(disc.frame,mark.frame)&&(disc.data.paintOrder??entries.indexOf(disc))<(mark.data.paintOrder??entries.indexOf(mark))))return 'geometry within one implication arrow';
      }
      if (policy.chartGeometry.includes(a.role) && policy.chartGeometry.includes(b.role) && a.type !== "text" && b.type !== "text") {
        if (a.role === "chart-mark" && b.role === "chart-mark") return null;
        return "plot geometry intersection";
      }
      for (const [left, right, reason] of policy.pairs) if ((a.role === left && b.role === right) || (b.role === left && a.role === right)) return reason;
      return null;
    };
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      const bounds = intersection(a.frame, b.frame);
      // Text overflow remains visible to this audit even beyond its declared frame.
      if (bounds.width < 0 || bounds.height < 0) {
        if (!(a.type === "text" && a.boxes.some((r) => { const q = intersection(r, b.frame); return q.width > 0 && q.height > 0; })) && !(b.type === "text" && b.boxes.some((r) => { const q = intersection(r, a.frame); return q.width > 0 && q.height > 0; }))) continue;
      }
      if (!collide(a, b)) continue;
      const reason = allowed(a, b);
      const pair = { a: a.id, b: b.id, roles: [a.role, b.role] };
      (reason ? intentional : unexpected).push(reason ? { ...pair, reason } : pair);
    }
    const headings = entries.filter((entry) => entry.role === "section-heading").map((heading) => {
      const rule = entries.find((entry) => entry.role === "section-heading-rule" && entry.id === heading.id.replace(/:heading$/, ":rule"));
      return { id: heading.id, headerTop: heading.data.headerTop, expectedRuleGap: heading.data.ruleGap, lineCount: heading.data.textLayout?.lines.length, ruleGap: rule ? rule.frame.y - (heading.frame.y + heading.frame.height) : null, renderedRuleGap: rule ? rule.frame.y - Math.max(...heading.boxes.map((r) => r.y + r.height)) : null };
    });
    const headingGapErrors = headings.filter((heading) => heading.ruleGap !== null && heading.expectedRuleGap !== undefined && (Math.abs(heading.ruleGap - heading.expectedRuleGap) > 0.1 || headings.some((peer) => peer.id !== heading.id && peer.headerTop === heading.headerTop && peer.ruleGap !== null && Math.abs(peer.renderedRuleGap - heading.renderedRuleGap) > 1.1)));
    return { slide: slide.id, accepted: !missingNodes.length && !textOverflow.length && !unexpected.length && !headingGapErrors.length, checkedNodeCount: entries.length, missingNodes, textOverflow, unexpected, intentional, headings, headingGapErrors };
  }, { slide, policy: OVERLAP_POLICY });
}

// Scene-level checks for what the rendered-DOM audit reads as allowed: a label
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
});

const LABEL_ROLES = new Set(["flow-arrow-label", "data-label", "chart-reference-label", "annotation-text", "axis-title", "category-label", "legend-label", "chart-threshold-label", "insight-caption"]);
const LINE_ROLES = new Set(["flow-arrow", "chart-line", "chart-reference-line", "chart-threshold-line", "annotation-leader", "data-label-leader"]);
const BOX_ROLES = new Set(["flow-step", "chart-mark", "fact-tile"]);
const RULE_ROLES = new Set(["divider-accent", "cover-accent", "section-heading-rule", "takeaways-rule"]);
const OLD_STYLE_DESCENDERS = /[34579]/;

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

/** The box from `top` to `bottom` of a block `width` by `height`, placed in the node's frame by its alignment. */
function placed(node, width, height, top, bottom) {
  const align = node.style?.align ?? "left", valign = node.style?.valign ?? "top";
  const x = align === "center" ? node.frame.x + (node.frame.width - width) / 2 : align === "right" ? node.frame.x + node.frame.width - width : node.frame.x;
  const y = valign === "mid" || valign === "middle" ? node.frame.y + (node.frame.height - height) / 2 : valign === "bottom" ? node.frame.y + node.frame.height - height : node.frame.y;
  return { x, y: y + top, width, height: bottom - top };
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
      if (["annotation-leader", "data-label-leader"].includes(line.role) && ["annotation-text", "data-label"].includes(text.role)) continue;
      if (crosses(ink, line)) findings.push({ code: "TEXT_ON_LINE", slide: slide.id, text: text.id, line: line.id, roles: [text.role, line.role] });
    }
    for (const box of nodes.filter((n) => n.type === "rect" && BOX_ROLES.has(n.role))) {
      const f = box.frame, inside = ink.x >= f.x && ink.y >= f.y && ink.x + ink.width <= f.x + f.width && ink.y + ink.height <= f.y + f.height;
      const near = ink.x < f.x + f.width + 2 && f.x < ink.x + ink.width + 2 && ink.y < f.y + f.height + 2 && f.y < ink.y + ink.height + 2;
      if (near && !inside) findings.push({ code: "TEXT_ON_EDGE", slide: slide.id, text: text.id, box: box.id, roles: [text.role, box.role] });
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
  return findings;
}

/**
 * How each scene check is held. A label struck by a line and a numeral sat on
 * its rule are read wrongly, and block. So does a scatter with no key: the
 * composer refuses one, and a scene that still carries one has lost the key a
 * reader needs to tell its colours apart. A label within 2px of a neighbouring
 * box is cramped but legible - a spacing question, read beside the page.
 */
export const OVERLAP_SEVERITY = Object.freeze({ TEXT_ON_LINE: "blocker", DESCENDER_ON_RULE: "blocker", SCATTER_UNKEYED: "blocker", TEXT_ON_EDGE: "advisory" });

const OVERLAP_REPAIR = Object.freeze({
  TEXT_ON_LINE: "Move the label off the line: set a reference label at the end of its line clear of the series, a flow label above its arrow, a value label on the side of its point the line leaves open - or shorten it so it fits between the marks.",
  TEXT_ON_EDGE: "Give the label its gap from the box beside it: widen the category slot, set the value inside its own mark, or shorten the label.",
  DESCENDER_ON_RULE: "Set the numeral in lining figures (the body face) or lift it off the rule by its descent.",
  SCATTER_UNKEYED: "Keep the scatter's legend, or connect each series (connect: true) so its name sits at its end.",
});

/**
 * The scene checks over a composed deck, as gate findings: `slide` the
 * 1-based page, `id` the page's id, `severity` from OVERLAP_SEVERITY. The
 * build reports them with the page gates; authoring reads them on the scene
 * it composes, so the author meets them before the build does.
 */
export function sceneDesignFindings(scene) {
  return (scene?.slides || []).flatMap((slide, i) => [...sceneCollisions(slide), ...sceneChartFindings(slide)].map(({ code, slide: _, ...measured }) => ({
    slide: i + 1, id: slide.sourceSlideId ?? slide.id, code, severity: OVERLAP_SEVERITY[code] ?? "blocker",
    measured, threshold: code === "TEXT_ON_EDGE" ? "2px clear" : "no contact", repair: OVERLAP_REPAIR[code],
  })));
}
