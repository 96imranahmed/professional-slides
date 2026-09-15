// Framework shapes: the strategy house (roof = ambition, pillars = levers,
// foundation = enablers) and the pyramid (stacked tiers, apex first). Both are
// one filled figure with labels inside, in the deck's navy and accent.
//
// house:   { variant: "house", roof: "Ambition", pillars: [{ title, points? }], foundation: "Enablers" }
// pyramid: { variant: "pyramid", tiers: [{ label, text? }] }   (apex first, 3–5 tiers)
import { token, tokenValue, stableId, textPrimitive, rectPrimitive, shapePrimitive } from "./core.mjs";
import { measureText } from "./text-layout.mjs";

const v = (id) => tokenValue(token(id));
const INK = token("color.ink"), WHITE = token("color.onPrimary"), PRIMARY = token("color.componentPrimary"), ACCENT = token("color.accent"), SECOND = token("color.chartSeries2"), TINT = token("color.componentPrimaryTint"), MUTED = token("color.surfaceMuted"), FONT = token("font.body");
export const FRAMEWORK_TOKENS = Object.freeze(["color.ink", "color.onPrimary", "color.componentPrimary", "color.accent", "color.chartSeries2", "color.componentPrimaryTint", "color.surfaceMuted", "font.body", "type.heading", "type.body", "type.compact", "space.1", "space.2", "space.3", "space.4", "line.hairline", "radius.none", "radius.small"]);

const measure = (text, width, size, bold = false) => measureText(String(text), width, { fontFamily: v("font.body"), fontSize: v(size), bold, wrapWidthRatio: 1 });
const style = (size, color, bold = false, align = "center") => ({ fontFamily: FONT, fontSize: token(size), color, bold, align, valign: "top", wrap: false });
const label = (id, role, frame, layout, st) => textPrimitive({ id, role, frame: { ...frame, height: layout.height }, text: layout.text, style: { ...st, lineHeight: layout.lineHeight }, data: { textLayout: layout } });
const box = (id, role, frame, fill, radius = "radius.none") => rectPrimitive({ id, role, frame, style: { fill, stroke: "none", lineWidth: token("line.hairline"), radius: token(radius) } });

function houseNodes({ id, frame, props }) {
  const pillars = props.pillars;
  if (!Array.isArray(pillars) || pillars.length < 2 || pillars.length > 5) throw new Error("A strategy house takes two to five pillars");
  if (typeof props.roof !== "string" || !props.roof.trim()) throw new Error("A strategy house requires a roof statement");
  const gap = v("space.3"), pad = v("space.3");
  const roofHeight = Math.max(64, frame.height * 0.2);
  const foundationHeight = props.foundation ? Math.max(44, frame.height * 0.13) : 0;
  const pillarTop = frame.y + roofHeight + gap, pillarBottom = frame.y + frame.height - (foundationHeight ? foundationHeight + gap : 0);
  const pillarHeight = pillarBottom - pillarTop;
  if (pillarHeight < 80) throw new Error("A strategy house needs more height for its pillars");
  const nodes = [];
  // Roof: a wide trapezoid with the ambition inside.
  nodes.push(shapePrimitive({ id: stableId(id, "roof"), role: "framework-roof", geometry: "trapezoid", frame: { x: frame.x, y: frame.y, width: frame.width, height: roofHeight }, style: { fill: PRIMARY, stroke: "none", lineWidth: token("line.hairline"), radius: token("radius.none") } }));
  const roof = measure(props.roof, frame.width * 0.6, "type.heading", true);
  if (roof.height > roofHeight - 2 * pad) throw new Error("Roof statement is too long for the roof");
  nodes.push(label(stableId(id, "roof-text"), "framework-roof-text", { x: frame.x + frame.width * 0.2, y: frame.y + (roofHeight - roof.height) / 2, width: frame.width * 0.6 }, roof, style("type.heading", WHITE, true)));
  // Pillars
  const width = (frame.width - gap * (pillars.length - 1)) / pillars.length;
  pillars.forEach((p, i) => {
    if (!p || typeof p.title !== "string" || !p.title.trim()) throw new Error(`Pillar ${i + 1} requires a title`);
    const x = frame.x + i * (width + gap), pid = stableId(id, "pillar", i);
    const headHeight = Math.max(44, measure(p.title, width - 2 * pad, "type.heading", true).height + 2 * v("space.2"));
    nodes.push(box(stableId(pid, "surface"), "framework-pillar", { x, y: pillarTop, width, height: pillarHeight }, MUTED));
    nodes.push(box(stableId(pid, "head"), "framework-pillar-head", { x, y: pillarTop, width, height: headHeight }, i === (props.highlight ?? -1) ? ACCENT : SECOND));
    const title = measure(p.title, width - 2 * pad, "type.heading", true);
    nodes.push(label(stableId(pid, "title"), "framework-pillar-title", { x: x + pad, y: pillarTop + (headHeight - title.height) / 2, width: width - 2 * pad }, title, style("type.heading", WHITE, true)));
    let y = pillarTop + headHeight + pad;
    for (const [k, point] of (p.points || []).entries()) {
      const m = measure(point, width - 2 * pad - v("space.4"), "type.body");
      if (y + m.height > pillarBottom - pad) throw new Error(`Pillar "${p.title}" has more points than fit; shorten them`);
      nodes.push(box(stableId(pid, "bullet", k), "framework-bullet", { x: x + pad, y: y + (m.lineHeight - v("space.1")) / 2, width: v("space.1"), height: v("space.1") }, INK));
      nodes.push(label(stableId(pid, "point", k), "framework-pillar-point", { x: x + pad + v("space.4"), y, width: width - 2 * pad - v("space.4") }, m, style("type.body", INK, false, "left")));
      y += m.height + v("space.1");
    }
  });
  // Foundation
  if (foundationHeight) {
    const fy = frame.y + frame.height - foundationHeight;
    nodes.push(box(stableId(id, "foundation"), "framework-foundation", { x: frame.x, y: fy, width: frame.width, height: foundationHeight }, PRIMARY));
    const f = measure(props.foundation, frame.width - 2 * pad, "type.heading", true);
    nodes.push(label(stableId(id, "foundation-text"), "framework-foundation-text", { x: frame.x + pad, y: fy + (foundationHeight - f.height) / 2, width: frame.width - 2 * pad }, f, style("type.heading", WHITE, true)));
  }
  return nodes;
}

function pyramidNodes({ id, frame, props }) {
  const tiers = props.tiers;
  if (!Array.isArray(tiers) || tiers.length < 3 || tiers.length > 5) throw new Error("A pyramid takes three to five tiers, apex first");
  const gap = v("space.1"), n = tiers.length;
  const tierHeight = (frame.height - gap * (n - 1)) / n;
  const nodes = [];
  const fills = [ACCENT, PRIMARY, SECOND, PRIMARY, SECOND];
  tiers.forEach((tier, i) => {
    if (!tier || typeof tier.label !== "string" || !tier.label.trim()) throw new Error(`Tier ${i + 1} requires a label`);
    const y = frame.y + i * (tierHeight + gap);
    const topW = frame.width * (i / n), bottomW = frame.width * ((i + 1) / n);
    const tid = stableId(id, "tier", i);
    // Each tier is a trapezoid slice of the triangle (the apex is a triangle).
    const paths = [[[0.5 - topW / frame.width / 2, 0], [0.5 + topW / frame.width / 2, 0], [0.5 + bottomW / frame.width / 2, 1], [0.5 - bottomW / frame.width / 2, 1]]];
    nodes.push(shapePrimitive({ id: stableId(tid, "shape"), role: "framework-tier", geometry: "customPolygon", frame: { x: frame.x, y, width: frame.width, height: tierHeight }, style: { fill: fills[i % fills.length], stroke: "none", lineWidth: token("line.hairline"), radius: token("radius.none") }, data: { paths, tier: i } }));
    // Label inside the slice (apex label sits below its point when the slice is narrow) and text to the right.
    const innerW = Math.max(120, bottomW * 0.8);
    const lm = measure(tier.label, innerW, "type.heading", true);
    const inside = lm.width <= bottomW * 0.85 && lm.height <= tierHeight - 2 * v("space.2");
    if (inside) nodes.push(label(stableId(tid, "label"), "framework-tier-label", { x: frame.x + (frame.width - innerW) / 2, y: y + (tierHeight - lm.height) / 2 + (i === 0 ? tierHeight * 0.15 : 0), width: innerW }, lm, style("type.heading", WHITE, true)));
    const rightX = frame.x + frame.width / 2 + bottomW / 2 + v("space.4");
    const rightW = frame.x + frame.width - rightX;
    if (!inside || tier.text) {
      const parts = [!inside ? tier.label : null, tier.text].filter(Boolean);
      const tm = measure(parts.join("\n"), Math.max(80, rightW), "type.compact");
      if (rightW >= 80) nodes.push(label(stableId(tid, "text"), "framework-tier-text", { x: rightX, y: y + (tierHeight - tm.height) / 2, width: rightW }, tm, style("type.compact", INK, false, "left")));
    }
  });
  return nodes;
}

export function registerFramework(registry) {
  registry.set("framework", {
    id: "framework", version: "1.0.0", category: "relationship", role: "framework", tokens: [...FRAMEWORK_TOKENS], preferredSize: { width: 1160, height: 440 },
    sample: { variant: "house", roof: "(Insert ambition)", pillars: [{ title: "(Insert pillar 1)", points: ["(Insert lever)"] }, { title: "(Insert pillar 2)", points: ["(Insert lever)"] }, { title: "(Insert pillar 3)", points: ["(Insert lever)"] }], foundation: "(Insert enablers)" },
    variants: { house: {}, pyramid: { props: { variant: "pyramid", tiers: [{ label: "(Insert apex)" }, { label: "(Insert tier 2)", text: "(Insert what it means)" }, { label: "(Insert base)", text: "(Insert what it means)" }] } } },
    defaultVariant: "house", variantProp: "variant",
    resolveVariant: (props = {}) => { const value = props.variant ?? "house"; if (!["house", "pyramid"].includes(value)) throw new Error(`Unknown framework variant: ${value}`); return value; },
    render: (input) => ({ nodes: (input.props.variant === "pyramid" ? pyramidNodes : houseNodes)(input) }),
    measureContent: ({ frame, props }) => {
      // Natural height follows the measured copy: pillar points wrap with the
      // pillar width, tiers with the frame width.
      if (props.variant === "pyramid") {
        const tiers = props.tiers || [];
        const tallest = Math.max(0, ...tiers.map((t) => measure([t.label, t.text].filter(Boolean).join("\n"), Math.max(80, frame.width * 0.28), "type.compact").height + 2 * v("space.2")));
        return { height: Math.max(48, tallest) * tiers.length + v("space.1") * (tiers.length - 1) };
      }
      const pillars = props.pillars || [], gap = v("space.3"), pad = v("space.3");
      const width = (frame.width - gap * (pillars.length - 1)) / Math.max(1, pillars.length);
      const body = Math.max(0, ...pillars.map((p) => 44 + pad + (p.points || []).reduce((sum, point) => sum + measure(point, Math.max(40, width - 2 * pad - v("space.4")), "type.body").height + v("space.1"), 0) + pad));
      return { height: 64 + gap + Math.max(80, body) + (props.foundation ? gap + 44 : 0) };
    },
    guidance: { useWhen: "a strategy stated as an ambition resting on a few levers over shared enablers (house), or a hierarchy of levels (pyramid)", why: "the figure carries the framework; readers know what a roof and a foundation mean", actionTitle: "state the ambition and the lever that carries most of it" }
  });
  return registry;
}
