import { OVERLAP_POLICY } from "./overlap-policy.mjs";
import { renderSlideHtml } from "./adapters/html.mjs";

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
      for (const [text, shape] of [[a, b], [b, a]]) if (text.type === "text" && shape.type !== "text" && shape.type !== "line" && value(shape.style.fill) !== "none" && shape.data.paintOrder > text.data.paintOrder) return null;
      for (const [surface, child] of [[a, b], [b, a]]) {
        const related = own(surface, child) || descendant(surface, child);
        if (policy.surfaces.includes(surface.role) && related && inside(surface.frame, child.frame)) return `contained by ${surface.role}`;
        if (["tracker-page-surface", "tracker-backdrop"].includes(surface.role) && ["source-text", "footnote-text", "footer-left", "footer-right", "page-number", "footer-rule", "header-rule"].includes(child.role) && (surface.data.paintOrder ?? entries.indexOf(surface)) < (child.data.paintOrder ?? entries.indexOf(child))) return "page furniture above tracker page field";
        if (!related) continue;
        if (["tracker-page-surface", "tracker-backdrop"].includes(surface.role) && inside(surface.frame, child.frame) && (surface.data.paintOrder ?? entries.indexOf(surface)) < (child.data.paintOrder ?? entries.indexOf(child))) return `tracker child inside its ${surface.role}`;
        if (surface.role === "tracker-selection" && surface.data.sectionId === child.data.sectionId && child.boxes.every(box => inside(surface.frame, box)) && (surface.data.paintOrder ?? entries.indexOf(surface)) < (child.data.paintOrder ?? entries.indexOf(child))) return "selected tracker item inside its exact row highlight";
        if (surface.role === "table-cell" && policy.containedCellMarks.includes(child.role) && surface.data.row === child.data.row && surface.data.column === child.data.column && inside(surface.frame, child.frame) && (surface.data.paintOrder ?? entries.indexOf(surface)) < (child.data.paintOrder ?? entries.indexOf(child))) return "mark inside its own table cell";
        if (surface.role === "chart-label-surface" && surface.data.forNode === child.id) return "gridline knockout behind its exact data label";
        if (policy.containedLabels[surface.role] === child.role && child.boxes.every((r) => inside(surface.frame, r)) && rawHit(surface, child.frame.x + child.frame.width / 2, child.frame.y + child.frame.height / 2)) return `label inside its ${surface.role}`;
        if (surface.role === "chart-highlight" && child.role.startsWith("chart-") && child.type !== "text") return "chart category highlight under plot geometry";
        if (surface.role === "chart-highlight" && child.role === "data-label") return "data label over category highlight";
        if (surface.role === "chart-highlight" && child.role === "annotation-leader") return "annotation leader over category highlight";
        if (surface.role === "chart-quadrant" && child.role === "chart-quadrant-title" && surface.data.quadrant === child.data.quadrant) return "quadrant title over its background treatment";
        if (surface.role === "chart-quadrant" && (policy.chartGeometry.includes(child.role) || child.role === "data-label")) return "quadrant background under plot geometry";
        if (surface.role === "annotation-leader" && policy.chartGeometry.includes(child.role)) return "annotation leader anchored to plot geometry";
      }
      if (!own(a, b)) return null;
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

export function summarizeOverlapAudits(slides) {
  return { accepted: slides.length > 0 && slides.every((slide) => slide.accepted), checkedSlideCount: slides.length, unexpectedCount: slides.reduce((sum, slide) => sum + slide.unexpected.length, 0), textOverflowCount: slides.reduce((sum, slide) => sum + slide.textOverflow.length, 0), slides: slides.map(({ intentional, ...slide }) => ({ ...slide, intentionalCount: intentional.length, intentionalReasons: intentional.reduce((counts, pair) => ({ ...counts, [pair.reason]: (counts[pair.reason] || 0) + 1 }), {}) })) };
}

// Recheck recovered PPTX geometry and text, independently of authoring frames.
// This is an imported-geometry check, not a substitute for exact-PPTX image QA.
export async function auditObservedOverlaps(page, deck, observed) {
  const audits = [], textMismatches = [];
  const squash = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
  for (const [index, slide] of deck.slides.entries()) {
    const elements = new Map((observed.renderLayouts?.[index]?.elements || []).map((entry) => [String(entry.name).replace(/^ps:/, ""), entry]));
    const nodes = slide.nodes.map((node) => {
      const entry = elements.get(node.id);
      if (!entry?.bbox) throw new Error(`PPTX overlap audit is missing native geometry: ${node.id}`);
      const [x, y, width, height] = entry.bbox;
      const data = { ...node.data, paintOrder: entry.order };
      if (node.type === "text" && (squash(entry.text) !== squash(node.text) || (node.style.wrap === false && entry.textLayout?.lineCount !== node.data.textLayout?.lines.length))) textMismatches.push({ id: node.id, expected: node.text, actual: entry.text, expectedLineCount: node.data.textLayout?.lines.length, observedLineCount: entry.textLayout?.lineCount });
      if (node.type === "line") {
        data.x1 = node.data.x1 <= node.data.x2 ? x : x + width;
        data.x2 = node.data.x1 <= node.data.x2 ? x + width : x;
        data.y1 = node.data.y1 <= node.data.y2 ? y : y + height;
        data.y2 = node.data.y1 <= node.data.y2 ? y + height : y;
      }
      return { ...node, frame: { x, y, width, height }, data };
    });
    await page.setContent(renderSlideHtml({ ...slide, nodes }));
    audits.push(await auditSlideOverlaps(page, { ...slide, nodes }));
  }
  const result = summarizeOverlapAudits(audits);
  return { ...result, accepted: result.accepted && !textMismatches.length, source: "artifact-tool-imported-pptx-geometry", textMismatches };
}
