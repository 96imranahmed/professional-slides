// The chart stress pass: every chart kind's sample and examples drawn under inputs that are awkward but ordinary -
// negatives, zeros, flat runs, millions, outliers, forty members, long names, skipped years, five series - at four
// frames and on two palettes, and each scene read the way the build reads it. It found the faults the October 2026 chart
// review fixed; it is kept so they stay fixed.
//
//   node evals/scripts/chart_stress.mjs                 the summary, and exit 1 on a crash, broken geometry or a count
//                                                       past the baseline
//   node evals/scripts/chart_stress.mjs --kind chart.line,chart.column
//   node evals/scripts/chart_stress.mjs --findings      every finding, one JSON line each
//   node evals/scripts/chart_stress.mjs --write-baseline
//
// The baseline (chart_stress_baseline.json) holds the count of each finding a kind still has - most under 46-character
// member names or forty rows in a panel - and may only go down: a count past it is a regression.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.resolve(here, "../../skills/professional-slides/runtime");
const { resolveStyle, TOKENS, THEME_SLOT_TOKENS } = await import(path.join(runtime, "core.mjs"));
const { withDesignTokens } = await import(path.join(runtime, "design-context.mjs"));
const { resolvePalette, contrastRatio } = await import(path.join(runtime, "palettes.mjs"));
const { REGISTRY } = await import(path.join(runtime, "registry.mjs"));
const { sceneDesignFindings, inkBox } = await import(path.join(runtime, "validate-overlap.mjs"));

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const BASELINE = path.join(here, "chart_stress_baseline.json");

const FRAMES = {
  standard: { x: 60, y: 160, width: 760, height: 420 },
  wide: { x: 60, y: 160, width: 1160, height: 460 },
  panel: { x: 60, y: 160, width: 380, height: 300 },
  short: { x: 60, y: 160, width: 760, height: 240 },
};
// The default palette, and a house palette that leads its series with its ink - the BA deck's.
const PALETTES = {
  midnight: "midnight",
  house: { base: "midnight", colors: { "color.ink": "#021B41", "color.componentPrimary": "#021B41", "color.accent": "#3468AD", "color.chartSeries1": "#021B41", "color.chartSeries2": "#3468AD", "color.chartSeries3": "#9EB7D8", "color.chartSeries4": "#234776", "color.chartSeries5": "#989CAE", "color.chartSeries6": "#BECFE5" } },
};
// Faults no input excuses: the chart broke rather than refused.
const HARD = new Set(["CRASH", "NAN_GEOMETRY"]);

const clone = (value) => structuredClone(value);
function mapValues(props, fn) {
  const out = clone(props);
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "values" && Array.isArray(value) && value.every((x) => typeof x === "number" || x === null)) node[key] = value.map((x, i) => (x === null ? x : fn(x, i)));
      else walk(value);
    }
  };
  walk(out);
  return out;
}
function variants(props) {
  const out = { base: props };
  out.negative = mapValues(props, (x, i) => (i % 2 ? -Math.abs(x) : Math.abs(x)));
  out.allNegative = mapValues(props, (x) => -Math.abs(x) - 1);
  out.zeros = mapValues(props, (x, i) => (i === 0 ? 0 : x));
  out.equal = mapValues(props, () => 42);
  out.millions = mapValues(props, (x) => Math.round(x * 31234.7));
  out.tiny = mapValues(props, (x) => Math.round(x * 13.7) / 1000);
  out.decimals = mapValues(props, (x) => Math.round((x + 0.37) * 100) / 100);
  out.outlier = mapValues(props, (x, i) => (i === 0 ? x * 60 : x));
  const categories = props.categories;
  if (Array.isArray(categories) && categories.length) {
    const extend = (list) => {
      const p = clone(props);
      p.categories = list;
      const fit = (values) => list.map((_, i) => (values[i % values.length] ?? 10) + i * 0.5);
      for (const s of p.series || []) if (Array.isArray(s.values)) s.values = fit(s.values);
      if (Array.isArray(p.values)) p.values = fit(p.values);
      for (const key of ["highlights", "annotations", "changeAnnotations", "focusSeries", "forecastFrom"]) delete p[key];
      return p;
    };
    out.many = extend(Array.from({ length: 24 }, (_, i) => `Member ${i + 1}`));
    out.forty = extend(Array.from({ length: 40 }, (_, i) => `Op${String(i + 1).padStart(2, "0")}`));
    out.one = extend([categories[0]]);
    out.two = extend(categories.length >= 2 ? categories.slice(0, 2) : ["A", "B"]);
    out.longLabels = extend(categories.map((c) => `${c} Group mainline and regional airlines`));
    out.gapYears = extend(["2015", "2017", "2018", "2019", "2023", "2024", "2025"]);
    if (Array.isArray(props.series)) {
      const p = clone(props);
      p.series = Array.from({ length: 5 }, (_, k) => ({ name: `Series ${k + 1}`, values: categories.map((_, i) => 10 + ((i * 7 + k * 13) % 23)) }));
      for (const key of ["focusSeries", "colorIndices", "highlights", "changeAnnotations"]) delete p[key];
      out.fiveSeries = p;
    }
  }
  out.noLabels = { ...props, dataLabels: false };
  return out;
}

const finite = Number.isFinite;
const boxOf = (n) => (n.type === "line" && n.data && [n.data.x1, n.data.y1, n.data.x2, n.data.y2].every(finite)
  ? { x: Math.min(n.data.x1, n.data.x2), y: Math.min(n.data.y1, n.data.y2), width: Math.abs(n.data.x2 - n.data.x1), height: Math.abs(n.data.y2 - n.data.y1) }
  : n.frame);
const colourOf = (value) => (typeof value === "string" ? value : value?.value);
const tokenOf = (value) => (value && typeof value === "object" ? value.tokenId : null);
const inside = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y + a.height <= b.y + b.height + 0.5;

/** What a reader would see wrong in one drawn chart. */
function check(nodes, frame, kind, props) {
  const found = [];
  const add = (code, detail) => found.push({ code, detail });
  if (nodes.some((n) => { const b = boxOf(n); return b && ![b.x, b.y, b.width, b.height].every(finite); })) add("NAN_GEOMETRY", "a node with no position");
  const outside = nodes.filter((n) => {
    let b = boxOf(n);
    if (!b || ![b.x, b.y, b.width, b.height].every(finite)) return false;
    if (n.type === "text" && String(n.text ?? "").trim()) { try { b = inkBox(n); } catch { return false; } }
    return b.x < frame.x - 3 || b.y < frame.y - 3 || b.x + b.width > frame.x + frame.width + 3 || b.y + b.height > frame.y + frame.height + 3;
  });
  if (outside.length) add("OUTSIDE_FRAME", outside.slice(0, 3).map((n) => `${n.role}:${String(n.text ?? n.id).slice(0, 24)}`).join(" | "));
  for (const f of sceneDesignFindings({ slides: [{ id: "s", nodes }] }).filter((f) => f.severity === "blocker")) add(f.code, JSON.stringify(f.measured).slice(0, 160));
  // Bars of one measure on one scale: a pixel a unit is one pixel a unit.
  const marks = nodes.filter((n) => n.role === "chart-mark" && n.type === "rect" && finite(n.data?.value) && n.data.value !== 0);
  if (/^chart\.(column|bar|stacked-column|stacked-bar)$/.test(kind) && marks.length > 1 && !props.valueBreak) {
    const across = /bar$/.test(kind), size = (m) => (across ? m.frame.width : m.frame.height);
    const ratios = marks.map((m) => size(m) / Math.abs(m.data.value)).filter(finite);
    if (Math.max(...ratios) / Math.min(...ratios) > 1.03 && marks.every((m) => size(m) > 3)) add("BAR_SCALE_INCONSISTENT", "bars of one measure on two scales");
  }
  // Series that are data must be told apart; context peers share the context grey by design, and a slope names each line
  // at both its ends, so its lines may share one colour.
  const fills = new Map();
  for (const m of nodes.filter((n) => kind !== "chart.slope" && n.role === "chart-mark" && n.data?.series !== undefined && !n.data?.focus && !n.data?.highlighted)) {
    const colour = colourOf(m.style?.fill), token = tokenOf(m.style?.fill);
    if (!colour || ["color.chartComparator", "color.rule", "color.chartSubject"].includes(token)) continue;
    fills.set(m.data.series, new Set([...(fills.get(m.data.series) ?? []), colour.toUpperCase()]));
  }
  const single = [...fills].filter(([, set]) => set.size === 1).map(([name, set]) => [name, [...set][0]]);
  const same = single.find(([a, ca], i) => single.slice(i + 1).some(([, cb]) => ca === cb));
  if (same) add("SERIES_SAME_COLOUR", `${same[0]} shares ${same[1]}`);
  // A mark the page cannot show: one drawn in a colour that reads as the canvas, unless it lies on another mark.
  const filled = nodes.filter((n) => n.role === "chart-mark" && n.type !== "line").map((n) => n.frame).filter(Boolean);
  const lost = nodes.find((m) => (m.role === "chart-mark" || m.role === "chart-line") && /^#[0-9A-F]{6}$/i.test(colourOf(m.type === "line" ? m.style?.stroke : m.style?.fill) ?? "")
    && contrastRatio(colourOf(m.type === "line" ? m.style?.stroke : m.style?.fill), "#FFFFFF") < 1.15 && !filled.some((box) => box !== m.frame && inside(boxOf(m), box)));
  if (lost) add("MARK_INVISIBLE", `${lost.role} ${lost.id}`);
  const garbage = nodes.find((n) => n.type === "text" && /NaN|undefined|Infinity|\[object/.test(String(n.text ?? "")));
  if (garbage) add("TEXT_GARBAGE", `${garbage.role} "${garbage.text}"`);
  return found;
}

const only = option("--kind") ? new Set(option("--kind").split(",")) : null;
const kinds = [...REGISTRY.keys()].filter((id) => id.startsWith("chart.") && (!only || only.has(id))).sort();
const findings = [];
let rendered = 0, refused = 0;
for (const kind of kinds) {
  const entry = REGISTRY.get(kind);
  const bases = { sample: entry.sample?.props ?? entry.sample, ...Object.fromEntries(Object.entries(entry.examples || {}).map(([k, v]) => [k, v.props ?? v])) };
  for (const [base, baseProps] of Object.entries(bases)) {
    if (!baseProps || typeof baseProps !== "object") continue;
    for (const [variant, props] of Object.entries(variants(baseProps))) for (const [frameName, frame] of Object.entries(FRAMES)) for (const [paletteName, palette] of Object.entries(PALETTES)) {
      if (paletteName === "house" && frameName !== "standard") continue;
      const where = { kind, case: `${base}/${variant}/${paletteName}`, frame: frameName };
      let nodes;
      try {
        const tokens = resolvePalette(palette, TOKENS, THEME_SLOT_TOKENS).tokens;
        nodes = withDesignTokens(tokens, () => entry.render({ id: "c", frame, props: clone(props) }).nodes.map((n) => ({ ...n, style: resolveStyle(n.style || {}) })));
      } catch (error) {
        const message = (error.pageErrors ?? [error.message]).join(" | ");
        // A refusal says what to change; a crash is the program's own failure; and text set in a box the chart sized too small
        // for it is a refusal the author cannot act on (a value in a sliver of a stack, a name in a waterfall's step).
        if (error instanceof TypeError || error instanceof RangeError || /is not defined|Cannot read|is not a function|is not iterable|Maximum call stack/.test(message)) findings.push({ ...where, code: "CRASH", detail: message.slice(0, 200) });
        else if (/^Unbreakable text/.test(message)) findings.push({ ...where, code: "TEXT_UNPLANNED", detail: message.slice(0, 200) });
        else refused += 1;
        continue;
      }
      rendered += 1;
      for (const f of check(nodes, frame, kind, props)) findings.push({ ...where, ...f });
    }
  }
}

if (flag("--findings")) for (const f of findings) console.log(JSON.stringify(f));
const counts = {};
for (const f of findings) if (!HARD.has(f.code)) { counts[f.kind] ??= {}; counts[f.kind][f.code] = (counts[f.kind][f.code] ?? 0) + 1; }
if (flag("--write-baseline")) {
  writeFileSync(BASELINE, `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2)}\n`);
  console.log(`Baseline written: ${path.relative(process.cwd(), BASELINE)}`);
}
const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const hard = findings.filter((f) => HARD.has(f.code));
const worse = Object.entries(counts).flatMap(([kind, codes]) => Object.entries(codes).filter(([code, n]) => n > (only && !only.has(kind) ? Infinity : baseline[kind]?.[code] ?? 0)).map(([code, n]) => `${kind} ${code}: ${n} (baseline ${baseline[kind]?.[code] ?? 0})`));
const better = Object.entries(baseline).flatMap(([kind, codes]) => (only && !only.has(kind) ? [] : Object.entries(codes).filter(([code, n]) => (counts[kind]?.[code] ?? 0) < n).map(([code, n]) => `${kind} ${code}: ${counts[kind]?.[code] ?? 0} (baseline ${n})`)));
console.log(`Chart stress: ${kinds.length} kinds, ${rendered} drawn, ${refused} refused with a reason, ${findings.length} findings.`);
for (const f of hard.slice(0, 10)) console.log(`  ${f.code} ${f.kind} ${f.case} ${f.frame}: ${f.detail}`);
if (worse.length) console.log(`  Past the baseline:\n    ${worse.join("\n    ")}`);
if (better.length) console.log(`  Under the baseline (lower it with --write-baseline):\n    ${better.join("\n    ")}`);
process.exit(hard.length || worse.length ? 1 : 0);
