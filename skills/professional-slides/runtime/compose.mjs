// deck/v3 → planner deckPlan. The author writes content and intent (~10 fields per
// slide); everything geometric — layout, sizes, density, section nesting — is derived
// here from what the page carries. See deep-audit-and-revamp.md item 4.
//
// {
//   "schema": "professional-slides.deck/v3",
//   "id": "nyc-or-sf", "palette": "mckinsey", "density": "executive",
//   "cover": { "title", "subtitle", "image": "assets/cover.jpg" },
//   "slides": [
//     { "title": "Costs grew 9% against 5% revenue growth, moving FY22 into a loss",
//       "exhibit": { "type": "chart.column", "heading": "Revenue and cost, $bn", "unit": "$bn",
//                    "categories": [...], "series": [{ "name": "...", "values": [...] }] },
//       "points": ["...", "..."],           // ≤ 3 short supporting points (optional)
//       "soWhat": "One-sentence consequence for the decision",   // optional
//       "source": "Australia Post annual reports 2015–22", "notes": "...",
//       "layout": "auto" },                 // auto | exhibit-full | exhibit-left | exhibit-right | two-up | text
//     { "kind": "section", "title": "Where the money goes" }
//   ]
// }
// exhibit.type: any registered component id, or the aliases "table", "image", "metrics".
import fs from "node:fs";
import path from "node:path";

const V3 = "professional-slides.deck/v3";
const SIZE = { width: { fr: 1 }, height: "fill" };
const HUG = { width: { fr: 1 }, height: "hug" };

export function isV3(spec) { return spec?.schema === V3; }

function imageDimensions(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), mime: "image/png" };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), mime: "image/jpeg" };
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  throw new Error("Only PNG and JPEG images are supported");
}

function imageProps(ref, baseDir) {
  const file = path.resolve(baseDir, typeof ref === "string" ? ref : ref.path);
  const buffer = fs.readFileSync(file);
  const { width, height, mime } = imageDimensions(buffer);
  return { dataUri: `data:${mime};base64,${buffer.toString("base64")}`, width, height, alt: (typeof ref === "object" && ref.alt) || path.basename(file), ...(typeof ref === "object" && ref.credit ? { authorization: ref.credit } : {}) };
}

function exhibitItem(ex, id, baseDir, size = SIZE) {
  const { type, layout: _l, ...rest } = ex;
  if (type === "image") return { id, component: "image-frame", props: imageProps(ex.path ? ex : ex.image, baseDir), size };
  if (type === "table") return { id, component: "table", props: { variant: rest.variant || "plain", treatment: rest.treatment || "open", density: rest.density || "body", columns: rest.columns.map((c) => typeof c === "string" ? { label: c, type: "text" } : c), rows: rest.rows, fillHeight: size.height === "fill", ...(rest.rowSpacing ? { rowSpacing: rest.rowSpacing } : {}) }, size };
  if (type === "metrics") return { id, layout: "flow.row", size: HUG, items: rest.items.map((m, i) => ({ id: `${id}-${i}`, component: "metric", props: m, size: { width: { fr: 1 }, height: 140 } })) };
  if (type.startsWith("chart.")) {
    const props = { dataLabels: true, legend: Array.isArray(rest.series) && rest.series.length > 1, highlights: [], annotations: [], referenceLines: [], ...rest };
    return { id, component: type, props, size };
  }
  return { id, component: type, props: rest, size };
}

/**
 * Row rule: every panel in a row carries a heading band and the bands share one
 * rule line, so content starts level across the row. Charts bring their own
 * heading (chart-title); anything else is wrapped in a headed section.
 */
function headedPanel(ex, item, id) {
  if (String(ex.type).startsWith("chart.")) {
    if (ex.panelHeading && !ex.heading) item.props.heading = ex.panelHeading;
    return item;
  }
  const heading = ex.panelHeading || ex.heading || (ex.columns ? String(typeof ex.columns[0] === "string" ? ex.columns[0] : ex.columns[0]?.label || "") : "") || "Detail";
  return { id: `${id}-panel`, heading, treatment: "open", size: item.size, items: [item] };
}

function niceCeiling(value) {
  if (!(value > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  for (const rung of [1, 2, 2.5, 5, 10]) if (rung * magnitude >= value) return rung * magnitude;
  return 10 * magnitude;
}

function pointsItem(points, id) {
  return { id, component: "bullet-list", props: { variant: "body", items: points }, size: HUG };
}

function soWhatItem(text, id) {
  return { id, component: "insight", props: { text, variant: "tonal" }, size: HUG };
}

function chooseLayout(slide) {
  if (slide.layout && slide.layout !== "auto") return slide.layout;
  const exhibits = slide.exhibits || (slide.exhibit ? [slide.exhibit] : []);
  if (exhibits.length >= 2) return "two-up";
  if (exhibits.length === 1) return slide.points?.length ? "exhibit-left" : "exhibit-full";
  return "text";
}

export function composeSlide(slide, index, baseDir) {
  const id = slide.id || `s${String(index + 1).padStart(2, "0")}`;
  if (slide.kind === "section") return { id, title: slide.title, items: [{ id: `${id}-divider`, component: "section-divider", props: { title: slide.title, ...(slide.number ? { number: slide.number } : {}) }, size: SIZE }], layout: "flow.column" };
  const layout = chooseLayout(slide);
  const exhibits = slide.exhibits || (slide.exhibit ? [slide.exhibit] : []);
  const items = [];
  if (layout === "exhibit-full") items.push(exhibitItem(exhibits[0], `${id}-exhibit`, baseDir));
  else if (layout === "exhibit-left" || layout === "exhibit-right") {
    const hero = headedPanel(exhibits[0], exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { width: { fr: 2 }, height: "fill" }), `${id}-exhibit`);
    // The side column is a headed section so its rule shares the chart heading's
    // band and the points start level with the plot, not with the heading text.
    // `pointsAlign: "middle"` centres the points on the exhibit instead.
    const list = pointsItem(slide.points || [], `${id}-points`);
    const side = slide.pointsAlign === "middle"
      ? { id: `${id}-side`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" }, leftover: "center", items: [list] }
      : { id: `${id}-side`, heading: slide.pointsHeading || "What it means", treatment: "open", size: { width: { fr: 1 }, height: "fill" }, items: [list] };
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: layout === "exhibit-left" ? [hero, side] : [side, hero] });
  } else if (layout === "two-up") {
    // Peer tables share one density: a row with a text-heavy table steps every
    // table in it to compact together, so type stays uniform across the row.
    const tables = exhibits.filter((ex) => ex.type === "table" && !ex.density);
    if (tables.length >= 2) {
      const heavy = tables.some((ex) => (ex.rows || []).some((row) => row.some((cell) => String(cell).length > 60)) || (ex.rows || []).length > 5);
      if (heavy) for (const ex of tables) ex.density = "compact";
    }
    // Peer charts with one unit share one value scale, or the comparison lies.
    const charts = exhibits.filter((ex) => String(ex.type).startsWith("chart.") && Array.isArray(ex.series));
    if (charts.length >= 2 && charts.every((ex) => ex.unit === charts[0].unit && ex.yMax === undefined)) {
      const max = Math.max(...charts.flatMap((ex) => ex.series.flatMap((se) => se.values)));
      const shared = niceCeiling(max);
      for (const ex of charts) { ex.yMin = ex.yMin ?? 0; ex.yMax = shared; }
    }
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: exhibits.slice(0, 3).map((ex, i) => headedPanel(ex, { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir), size: SIZE }, `${id}-exhibit-${i}`)) });
    if (slide.points?.length) items.push(pointsItem(slide.points, `${id}-points`));
  } else {
    const points = slide.points || [];
    if (points.length > 4) {
      const half = Math.ceil(points.length / 2);
      items.push({ id: `${id}-row`, layout: "flow.row", size: HUG, items: [pointsItem(points.slice(0, half), `${id}-points-a`), pointsItem(points.slice(half), `${id}-points-b`)] });
    } else if (points.length) items.push(pointsItem(points, `${id}-points`));
    for (const [i, p] of (slide.paragraphs || []).entries()) items.push({ id: `${id}-p${i}`, component: "paragraph", props: { text: p }, size: HUG });
  }
  if (slide.soWhat) items.push(soWhatItem(slide.soWhat, `${id}-sowhat`));
  if (!items.length) throw new Error(`${id}: a slide needs an exhibit, points, paragraphs or a soWhat`);
  return { id, title: slide.title, layout: "flow.column", ...(slide.density ? { density: slide.density } : {}), ...(slide.source ? { source: slide.source } : {}), ...(slide.notes ? { notes: slide.notes } : {}), ...(slide.tracker ? { tracker: slide.tracker } : {}), items };
}

/** Expand a v3 deck into the deckPlan the planner consumes. */
export function composeDeck(spec, baseDir = process.cwd()) {
  if (!isV3(spec)) throw new Error(`Expected schema ${V3}`);
  if (!spec.id || !Array.isArray(spec.slides)) throw new Error("deck/v3 requires id and slides");
  const slides = [];
  if (spec.cover) {
    const cover = { id: "cover", kind: "cover", title: spec.cover.title, subtitle: spec.cover.subtitle || "" };
    if (spec.cover.image) { cover.variant = "half-image"; cover.image = imageProps(spec.cover.image, baseDir); }
    if (spec.cover.notes) cover.notes = spec.cover.notes;
    slides.push(cover);
  }
  spec.slides.forEach((slide, index) => slides.push(composeSlide(slide, index + (spec.cover ? 1 : 0), baseDir)));
  return {
    id: spec.id,
    palette: spec.palette || "mckinsey",
    ...(spec.pageTemplate ? { pageTemplate: spec.pageTemplate } : {}),
    ...(spec.typography ? { typography: spec.typography } : {}),
    slides: slides.map((s) => spec.density && !s.density && s.kind !== "cover" ? { ...s, density: spec.density } : s)
  };
}

/**
 * Coverage (revamp item 30): when the spec lists the brief's ranked `criteria`,
 * every criterion must be served by at least one page that carries an exhibit
 * (`serves: ["education", …]` on the slide). Returns findings; empty when covered.
 */
export function coverageFindings(spec) {
  if (!isV3(spec) || !Array.isArray(spec.criteria) || !spec.criteria.length) return [];
  const served = new Map(spec.criteria.map((c) => [String(c).toLowerCase(), []]));
  spec.slides.forEach((slide, i) => {
    const hasExhibit = Boolean(slide.exhibit || (slide.exhibits || []).length);
    for (const c of slide.serves || []) if (served.has(String(c).toLowerCase()) && hasExhibit) served.get(String(c).toLowerCase()).push(i + 1);
  });
  return [...served.entries()].filter(([, pages]) => !pages.length).map(([criterion]) => ({ slide: null, code: "MISSING_EVIDENCE", measured: criterion, threshold: "one comparative exhibit", repair: `Add a page whose exhibit compares every option on "${criterion}", and mark it serves: ["${criterion}"].` }));
}

/** Accept v2 (deckPlan) or v3 (deck) and return a deckPlan. */
export function toDeckPlan(spec, baseDir) {
  if (isV3(spec)) return composeDeck(spec, baseDir);
  if (spec?.deckPlan) return spec.deckPlan;
  throw new Error("Spec must be professional-slides.deck/v3 or carry a deckPlan");
}
