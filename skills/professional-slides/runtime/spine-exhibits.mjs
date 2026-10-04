// What a spine says each page shows is proven drawable before the critique.
//
// The storyline critique is bound to what a page shows of each measure: which
// of its periods or members, and whether plotted, tabulated or stated as a
// figure (storyline.mjs storyStructure). A spine that names a measure in a
// bound exhibit, declares a view of it in a `basis` stub, or leaves it to be
// read whole, has said all of that - and whether a chart can draw it turns on
// nothing still to be written. A real run found out after the critique was
// ready: a bound bar chart named a measure with an undisclosed member, which
// no chart draws; the repair - plotting five of six members - changed the
// bound view, and the pass cap was spent.
//
// So a draft and a plan prove it, the way the title probe proves a title
// (spine-fit.mjs): every exhibit the spine fully determines is composed alone,
// with placeholder copy, under the deck's own settings.
//
//   - A drawn chart - bound to its measures, or typed - is composed as
//     written. Where its own form refuses it, the other forms of its class are
//     tried, since a chart's form within its class is the layout's; refused by
//     all of them, it cannot be drawn, and only another view can.
//   - A measure the page shows and has not drawn - declared by a stub, or read
//     whole - is composed as a chart of the periods or members the critic
//     will be told it shows (storyline.mjs spineReadings), where that reading
//     is "plotted".
//   - A page whose exhibits are all drawn and whose type refuses them is
//     compiled under every other form and placement of its type: where one
//     holds them the matter is the layout's, and where none does only another
//     type or another view mends it.
//   - An executive summary is composed with placeholder points up to its word
//     ceiling beside the exhibit it declares: one that still leaves a band
//     empty needs an exhibit the spine has not declared.
//
// Whether an exhibit fits the frame its page gives it, and every word on it,
// stays the layout's and is composed by the full compile.
import { composeAll } from "./compose-all.mjs";
import { registered } from "./errors.mjs";
import { bindDeck } from "./bind.mjs";
import { PAGE_TYPES, markedChart, placementsOf, undrawnExhibit, withChoice } from "./page-types.mjs";
import { plottedValues } from "./evidence.mjs";
import { measureRegistry, valuesOf, axisOf } from "./measures.mjs";
import { refsOf } from "./gates/dependency_gates.mjs";
import { recordedMeasures, spineReadings } from "./storyline.mjs";

export const SPINE_EXHIBIT_CODES = Object.freeze({
  SPINE_UNDRAWABLE: "an exhibit the spine fully determines - a bound or typed chart, a view declared by a `basis` stub, a measure read whole - cannot be drawn: no chart form of its class, or no form of the page's type, holds what the page is said to show",
  SPINE_UNFILLED: "an executive summary that leaves a band of its page empty at its word ceiling, with the exhibit the spine declares for it",
});

// What a chart carries that the critique is not bound to: its marks and its words. Taken off for the probe, which draws the data alone.
const MARKS = ["annotations", "highlights", "caption", "changeAnnotations", "events", "note", "basis"];
const HEADING = "What the exhibit measures";
const NOTE = "A placeholder note standing where the page's own callout will be written at layout.";
const TITLE = "A neutral title for the page the probe composes";
// Ordinary prose, for the words a summary holds when its points are not written yet.
const PROSE = "the operator added capacity on the busiest routes before demand returned in full and the margin held through the year because costs fell faster than fares did".split(" ");
const proseOf = (n, from = 0) => `${Array.from({ length: Math.max(1, n) }, (_, i) => PROSE[(from + i) % PROSE.length]).join(" ")}.`;
const SUMMARY_POINTS = 4;
// The scene's findings that say a band of the page stands empty.
const VOIDS = new Set(["SCENE_VOID", "DEAD_BAND", "INTERNAL_VOID", "COLUMN_VOID"]);

const isChart = (ex) => String(ex?.type ?? "").startsWith("chart");
const exhibitsOf = (page) => [page?.exhibit, ...(Array.isArray(page?.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object");
const idOfMessage = (message) => String(message).match(/^(?:Cannot render )?([^:\s]+):/)?.[1];
const reasonOf = (message) => String(message).replace(/^(?:Cannot render )?[^:\s]+:[^:]*\([^)]*\):\s*/, "").replace(/^[^:\s]+:\s*/, "");

/** An exhibit as the probe draws it: its data and its form, with a heading standing in where none is written. */
function bare(ex, type = ex.type) {
  const out = structuredClone(ex);
  for (const key of MARKS) delete out[key];
  return { ...out, ...(type ? { type } : {}), heading: typeof out.heading === "string" && out.heading.trim() ? out.heading : HEADING };
}

// The chart forms a categorical series can take within its class: what is tried where the exhibit's own form refuses its data.
const SIBLINGS = ["chart.bar", "chart.column", "chart.line"];
/** The same data as a plain chart of `type`, or null where the exhibit is no list of series over one axis. */
function sibling(ex, type) {
  const categories = Array.isArray(ex.categories) ? ex.categories : Array.isArray(ex.labels) ? ex.labels : null;
  const series = Array.isArray(ex.series) && ex.series.every((s) => Array.isArray(s?.values)) ? ex.series.map((s, i) => ({ name: s.name ?? `Series ${i + 1}`, values: s.values }))
    : Array.isArray(ex.values) ? [{ name: "Values", values: ex.values }] : null;
  if (!categories || !series) return null;
  return { type, heading: HEADING, ...(typeof ex.unit === "string" ? { unit: ex.unit } : {}), categories, series };
}

/** Compose `probes` - `[{ key, exhibit }]` - each alone on a neutral page of this deck: the composer's refusal by key. */
function composeProbes(spec, probes, baseDir) {
  const refused = new Map();
  if (!probes.length) return refused;
  const deck = { ...spec, slides: probes.map(({ key, exhibit }) => ({ id: key, title: TITLE, layout: "exhibit-full", exhibit })) };
  delete deck.appendix;
  let composed = null;
  try { composed = composeAll(deck, baseDir, { partial: true }); }
  catch (error) { for (const message of error.pageErrors ?? [error.message]) refused.set(idOfMessage(message) ?? "", message); }
  for (const message of composed?.pageErrors ?? []) refused.set(idOfMessage(message) ?? "", message);
  // A refusal that names no probe is the deck's - a setting the composer does not read - and is the composition's to report.
  return new Map([...refused].filter(([key]) => probes.some((probe) => probe.key === key)));
}

// The copy a placement holds when it is written at a developed length: three points of the reference pages' median block.
const POINT_WORDS = 56, POINTS = 3;
const ADDS = "Each point carries the condition its finding depends on, which the exhibit does not show";

/**
 * A page with placeholder copy standing wherever its commentary placement
 * asks for copy the page has not written: developed points beside or under an
 * exhibit, a rail, a bar, a caption under each panel, callouts on a chart,
 * `adds`, and a heading on each chart. What the page wrote is kept. It is the
 * page as the layout will fill it, near enough to compose: what a plan
 * estimates a placement's text blocks from before any copy exists. Given the
 * page as bound (bind.mjs), so a chart's periods or members are there to mark.
 */
export function withPlaceholderCopy(pageIn) {
  const page = structuredClone(pageIn);
  const exhibits = exhibitsOf(page), written = (value) => typeof value === "string" && value.trim().length > 0;
  for (const ex of exhibits) if ((isChart(ex) || Array.isArray(ex.series) || ex.measure !== undefined) && !written(ex.heading)) ex.heading = HEADING;
  if (["beside", "beside-left", "below"].includes(page.commentary) && !(Array.isArray(page.points) && page.points.length) && !page.paragraphs)
    page.points = Array.from({ length: POINTS }, (_, k) => proseOf(POINT_WORDS, k * 7));
  if (page.commentary === "rail" && !written(page.rail)) page.rail = proseOf(24);
  if (page.commentary === "so-what-bar" && !written(page.bar)) page.bar = proseOf(16, 5);
  if (page.commentary === "captions") exhibits.forEach((ex, k) => { if (!written(ex.caption)) ex.caption = proseOf(14, k * 5 + 3); });
  const first = exhibits[0], labels = first && (Array.isArray(first.categories) ? first.categories : Array.isArray(first.labels) ? first.labels : null);
  if (page.commentary === "on-exhibit" && first && !(Array.isArray(first.annotations) && first.annotations.length) && labels?.length)
    first.annotations = [...new Set([labels.at(-1), labels[0]])].map((category, k) => ({ category, text: proseOf(8, k * 9) }));
  // A type that marks its finding on the plot is given one mark to stand for it.
  else if (PAGE_TYPES[page.type]?.marked && first && labels?.length && !markedChart(first)) first.annotations = [{ category: labels.at(-1), text: proseOf(8) }];
  if (["beside", "beside-left", "below", "captions", "on-exhibit"].includes(page.commentary) && !written(page.adds)) page.adds = ADDS;
  return page;
}

const BOUND = "The storyline critique is bound to what the page shows of each measure, so decide it now: mended after the critique is ready, it sends the page back for another pass";
const listed = (labels) => `${labels.slice(0, 12).map((label) => JSON.stringify(String(label))).join(", ")}${labels.length > 12 ? ", ..." : ""}`;

/**
 * Every exhibit a spine fully determines that cannot be drawn, and every
 * executive summary that cannot fill its page: findings for a draft and a
 * plan. `doc` is the pages document as authored, `spec` its compiled spine
 * (author-deck.mjs compileDeck, draft) - a page that did not compile is read
 * from the document alone - and `compile(page, index, { draft })` compiles
 * one page as the deck's compile does, throwing its refusal. `sceneGates`
 * runs the page gates on a composed deck (the summary's fill is theirs to
 * measure); without it the summary is not probed.
 */
export function spineExhibitFindings(doc, { spec, insights = null, baseDir, compile, sceneGates = null }) {
  const registry = measureRegistry(insights);
  const { doc: written, bound } = bindDeck(doc, insights);
  const authored = [...(written.pages || []), ...(written.appendix || [])];
  const compiled = new Map([...(spec.slides || []), ...(spec.appendix || [])].filter((slide) => slide.pageType).map((slide) => [String(slide.id), slide]));
  const findings = [];
  const add = (code, id, measured, repair, more = {}) => findings.push({ code: registered(SPINE_EXHIBIT_CODES, code), id, severity: "blocker", measured, repair: `${id}: ${repair}`, ...more });

  // --- every drawn chart, composed alone as written --------------------------------------------------------------
  const drawn = [];
  authored.forEach((page, index) => {
    if (!page || typeof page !== "object" || !page.type) return;
    const id = String(page.id ?? `page-${index + 1}`);
    if (bound.failed.has(id)) return;
    const slide = compiled.get(id), deferred = Boolean(slide?.pageType?.deferred);
    // A page that compiled is drawn from its compiled exhibits - typed by its form, a ranking's aligned bars grouped; one that did not, from the page as bound.
    const own = exhibitsOf(page), shown = slide && !deferred ? exhibitsOf(slide) : own;
    const target = PAGE_TYPES[page.type]?.forms?.[page.form];
    own.forEach((ex, at) => {
      if (undrawnExhibit(ex) || !plottedValues(ex)) return;
      const exhibit = shown[at] && typeof shown[at] === "object" && (isChart(shown[at]) || shown[at].type === "chart-group") ? shown[at] : ex;
      // An exhibit with no type yet whose data is a list of series over one axis is a chart to be: probed as a plain one of its axis.
      const plain = sibling(exhibit, "chart.bar");
      const type = exhibit.type ?? (at === 0 && typeof target === "string" && target.startsWith("chart.") ? target : plain ? "chart.bar" : undefined);
      if (!String(type ?? "").startsWith("chart")) return;
      drawn.push({ key: `${id}.x${at}`, id, at, page, source: ex, exhibit: exhibit.type || type !== "chart.bar" || !plain ? bare(exhibit, type) : plain });
    });
  });
  const refusedDrawn = composeProbes(spec, drawn, baseDir);
  for (const probe of drawn.filter((p) => refusedDrawn.has(p.key))) {
    // Another chart form of its class may hold the data its own form refuses: that is a change of form, which the layout is free to make.
    const others = SIBLINGS.filter((type) => type !== probe.exhibit.type).map((type) => ({ key: `${probe.key}.${type.split(".")[1]}`, exhibit: sibling(probe.exhibit, type) })).filter((p) => p.exhibit);
    const stillRefused = composeProbes(spec, others, baseDir);
    if (others.length && others.some((p) => !stillRefused.has(p.key))) continue;
    const name = `exhibit ${probe.at + 1}${probe.exhibit.type ? ` (${probe.exhibit.type})` : ""}`;
    const refs = refsOf(probe.source.basis).filter((ref) => registry.has(ref));
    const categories = (Array.isArray(probe.exhibit.categories) ? probe.exhibit.categories : probe.exhibit.labels) || [];
    const lists = Array.isArray(probe.exhibit.series) ? probe.exhibit.series.map((s) => s?.values) : [probe.exhibit.values];
    const holes = categories.filter((_, i) => lists.some((values) => Array.isArray(values) && !Number.isFinite(values[i])));
    if (holes.length) {
      // The measures the gap is in: the ones whose record holds no number at a period or member the exhibit plots.
      const gapped = refs.filter((ref) => { const m = registry.get(ref), axis = axisOf(m), values = valuesOf(m); return holes.some((label) => axis.labels.includes(String(label)) && typeof values[axis.labels.indexOf(String(label))] !== "number"); });
      const why = gapped.flatMap((ref) => holes.map((label) => registry.get(ref).unavailable?.[label]).filter(Boolean));
      const kept = categories.filter((label) => !holes.includes(label));
      const axis = refs.length ? axisOf(registry.get(refs[0])).kind : "members";
      add("SPINE_UNDRAWABLE", probe.id, { exhibit: probe.at + 1, undisclosed: holes, ...(gapped.length ? { measures: gapped } : {}) },
        `${name} plots ${refs.join(", ") || "its series"} over ${categories.length} ${axis === "periods" ? "periods" : "members"}, and ${gapped.length ? gapped.join(", ") : holes.length === 1 ? "one" : `${holes.length} of them`} ${gapped.length > 1 ? "have" : "has"} no number ${gapped.length ? "for " : "("}${listed(holes)}${gapped.length ? "" : ")"}${why.length ? ` (${[...new Set(why)].join("; ")})` : ""}. No chart draws a missing value. ${BOUND}. ` +
        `Plot the ones that are disclosed - \`select: { ${axis === "periods" ? "periods" : "members"}: [${listed(kept)}] }\` on the exhibit - or show the measure as a table, which prints the gap as n/a (a table exhibit, or \`basis: { measures: [...], as: "table" }\` until it is written)`);
    } else add("SPINE_UNDRAWABLE", probe.id, { exhibit: probe.at + 1, ...(refs.length ? { measures: refs } : {}) },
      `${name} cannot be drawn as this deck draws a chart, in its own form or as a plain bar, column or line chart of the same data (${reasonOf(refusedDrawn.get(probe.key))}). ${BOUND}. Narrow what it shows - \`select\` on a bound exhibit: fewer periods or members - or show the measure in another class (\`as: "table"\`, a figure)`);
  }

  // --- every measure a page shows and has not drawn, read as plotted ----------------------------------------------
  const measures = insights ? recordedMeasures([...insights.values()]) : null;
  const readings = spineReadings(spec, measures).flatMap(({ id, measures: list }) => list.flatMap(({ ref, declared, views }) =>
    views.filter((view) => view.class === "chart" && Array.isArray(view.labels) && view.labels.length).map((view, at) => ({ id, ref, declared, labels: view.labels, key: `${id}.r${ref.replace(/[^A-Za-z0-9]+/g, "-")}-${at}` }))));
  const undrawn = [];
  for (const reading of readings) {
    const measure = registry.get(reading.ref);
    if (!measure) continue;
    const axis = axisOf(measure), values = valuesOf(measure);
    const at = (label) => values[axis.labels.indexOf(label)];
    const holes = reading.labels.filter((label) => typeof at(label) !== "number");
    const how = reading.declared ? "its `basis` declares it plotted" : "nothing on the page draws it yet, so it is read as plotted whole";
    if (holes.length) {
      const why = holes.map((label) => measure.unavailable?.[label]).filter(Boolean);
      const kept = reading.labels.filter((label) => !holes.includes(label));
      add("SPINE_UNDRAWABLE", reading.id, { measure: reading.ref, undisclosed: holes },
        `the page shows ${reading.ref} - ${how} over ${reading.labels.length} ${axis.kind} - and ${holes.length === 1 ? "one has" : `${holes.length} have`} no number (${listed(holes)}${why.length ? `: ${[...new Set(why)].join("; ")}` : ""}). No chart draws a missing value. ${BOUND}. ` +
        `Say which the page will plot - the bound exhibit \`{ "series": [{ "measure": "${reading.ref}" }], "select": { "${axis.kind}": [${listed(kept)}] } }\`, or \`"${axis.kind === "periods" ? "labels" : "members"}": [...]\` in the exhibit's \`basis\` - or declare it a table (\`"as": "table"\`), which prints the gap as n/a`);
      continue;
    }
    undrawn.push({ ...reading, kind: axis.kind, exhibit: { type: axis.kind === "periods" ? "chart.line" : "chart.bar", heading: HEADING, ...(typeof measure.unit === "string" && measure.unit.trim() ? { unit: measure.unit } : {}),
      categories: reading.labels, series: [{ name: String(measure.name ?? "Values"), values: reading.labels.map(at) }] } });
  }
  const refusedUndrawn = composeProbes(spec, undrawn, baseDir);
  for (const probe of undrawn.filter((p) => refusedUndrawn.has(p.key))) {
    const others = SIBLINGS.filter((type) => type !== probe.exhibit.type).map((type) => ({ key: `${probe.key}.${type.split(".")[1]}`, exhibit: sibling(probe.exhibit, type) }));
    const stillRefused = composeProbes(spec, others, baseDir);
    if (others.some((p) => !stillRefused.has(p.key))) continue;
    add("SPINE_UNDRAWABLE", probe.id, { measure: probe.ref, [probe.kind]: probe.labels.length },
      `the page shows ${probe.ref} - ${probe.declared ? "its `basis` declares it plotted" : "nothing on the page draws it yet, so it is read as plotted whole"} over ${probe.labels.length} ${probe.kind} - and no bar, column or line chart of this deck holds that (${reasonOf(refusedUndrawn.get(probe.key))}). ${BOUND}. ` +
      `Declare the view the page will show: fewer ${probe.kind} (\`select\` on the bound exhibit, or \`labels\` / \`members\` in its \`basis\`), or a table (\`"as": "table"\`)`);
  }

  // --- a page whose exhibits are all drawn and whose type refuses them: every other form of the type ------------
  authored.forEach((page, index) => {
    if (!page || typeof page !== "object" || !page.type || !PAGE_TYPES[page.type]) return;
    const id = String(page.id ?? `page-${index + 1}`), slide = compiled.get(id);
    if (slide?.pageType?.deferredStage !== "evidence" || findings.some((f) => f.id === id)) return;
    const own = [...exhibitsOf(page), ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.exhibit).filter((ex) => ex && typeof ex === "object") : [])];
    // Only where the spine has drawn every exhibit of the page: one still to be written is the layout's to add.
    if (!own.length || own.some((ex) => undrawnExhibit(ex) || !plottedValues(ex))) return;
    // The page as authored, its words taken off, under each form and placement of its type: bound again for that form - a
    // measure written out as slices for a donut and as a series for a waffle - with its one measure named either way, and under
    // each way a mark can stand on its exhibits (as written, none, a callout on the last period or member, a highlight on it).
    // What every one of them refuses is refused of what the page shows, not of how it is drawn.
    const source = [...doc.pages, ...(doc.appendix || [])][index];
    const lastOf = (ex) => { const labels = Array.isArray(ex.categories) ? ex.categories : Array.isArray(ex.labels) ? ex.labels : Array.isArray(ex.items) ? ex.items.map((item) => item?.label ?? item?.name) : [];
      return labels.filter((label) => label !== undefined && label !== null).at(-1); };
    const reshaped = (ex, shape) => { if (shape === "written" || !ex || typeof ex !== "object") return ex;
      if (shape === "series" && ex.measure !== undefined && ex.series === undefined) { const { measure, ...rest } = ex; return { ...rest, series: [{ measure, name: String(measure).split("/").pop() }] }; }
      if (shape === "one" && Array.isArray(ex.series) && ex.series.length === 1 && ex.series[0]?.measure !== undefined && ex.measure === undefined) { const { series, ...rest } = ex; return { ...rest, measure: series[0].measure }; }
      return null; };
    const witness = (shape, mark, form, commentary) => {
      const cut = structuredClone(source);
      for (const key of ["points", "paragraphs", "rail", "bar", "takeaway", "highlight", "subtitle", "note", "pointsHeading"]) delete cut[key];
      for (const key of ["exhibit"]) if (cut[key]) { const next = reshaped(cut[key], shape); if (next === null) return null; cut[key] = next; }
      if (Array.isArray(cut.exhibits)) { const next = cut.exhibits.map((ex) => reshaped(ex, shape)); if (shape !== "written" && next.every((ex) => ex === null)) return null; cut.exhibits = next.map((ex, at) => ex ?? cut.exhibits[at]); }
      if (mark !== "written") for (const ex of exhibitsOf(cut)) for (const key of MARKS.filter((key) => key !== "basis")) delete ex[key];
      const rebound = bindDeck({ ...doc, pages: [withChoice(cut, form, commentary)], appendix: [] }, insights);
      if (rebound.findings.length) return null;
      const out = rebound.doc.pages[0];
      for (const ex of exhibitsOf(out)) { const last = lastOf(ex);
        if (last !== undefined && !markedChart(ex)) { if (mark === "callout") ex.annotations = [{ category: last, text: NOTE }]; if (mark === "highlight") ex.highlights = [{ category: last }]; } }
      return out; };
    const holds = [];
    for (const shape of ["written", "series", "one"]) for (const mark of ["written", "none", "callout", "highlight"]) for (const form of Object.keys(PAGE_TYPES[page.type].forms)) for (const commentary of placementsOf(page.type, form)) {
      if (holds.length) break;
      const candidate = witness(shape, mark, form, commentary);
      if (!candidate) continue;
      try { compile(candidate, index, { draft: true }); holds.push(`${form}/${commentary}`); } catch { /* refused under this form, shape and mark too */ }
    }
    if (holds.length) return;
    const forms = Object.keys(PAGE_TYPES[page.type].forms);
    add("SPINE_UNDRAWABLE", id, { type: page.type, forms: forms.length },
      `${String(slide.pageType.deferred).replace(`${id}: `, "").replace(/[.\s]*$/, "")}. No form of a ${page.type} page holds the exhibit${own.length === 1 ? "" : "s"} the spine draws here (${forms.length === 1 ? `its one form, ${forms[0]}, refuses` : `all ${forms.length} forms refuse`} ${own.length === 1 ? "it" : "them"}, whatever the marks and the commentary). ` +
      `The storyline critique is bound to the page's type and to what it shows of each measure, so mend it now: the page type this evidence carries (\`--types\`), or a view of the measure this type holds (\`select\` on the bound exhibit, or other measures)`);
  });

  // --- an executive summary, with placeholder points up to its word ceiling ---------------------------------------
  if (sceneGates) authored.forEach((page, index) => {
    if (!page || typeof page !== "object" || page.type !== "summary" || page.form !== "executive-summary") return;
    const id = String(page.id ?? `page-${index + 1}`);
    if (bound.failed.has(id) || findings.some((f) => f.id === id)) return;
    const own = exhibitsOf(page);
    // A summary whose exhibit is declared and not drawn yet is not proven either way: its rows are still to be written.
    if (own.some((ex) => undrawnExhibit(ex))) return;
    const withPoints = (total) => { const out = structuredClone(page); for (const key of ["highlight", "paragraphs", "pointsHeading"]) delete out[key];
      const each = Math.max(8, Math.floor(total / SUMMARY_POINTS));
      return { ...out, points: Array.from({ length: SUMMARY_POINTS }, (_, k) => proseOf(each, k * 7)), adds: typeof out.adds === "string" && out.adds.trim() ? out.adds : ADDS }; };
    const measure = (total) => {
      let slide;
      try { slide = compile(withPoints(total), index, { draft: false }); } catch { return null; }
      let composed = null;
      try { composed = composeAll({ ...spec, slides: [slide], appendix: undefined }, baseDir, { partial: true }); } catch { return null; }
      if ((composed.pageErrors ?? []).length || !composed.deck) return null;
      const gated = sceneGates(composed.deck);
      if (!gated.ran) return null;
      const budget = (gated.budget ?? []).find((b) => String(b.id ?? "") === id) ?? gated.budget?.[0];
      // A revision recorded before the rule on empty bands hears it as advice (`waived`): the finding below then carries the same rule.
      return { budget, voids: gated.all.filter((f) => VOIDS.has(f.code) && (["blocker", "blocking"].includes(f.severity) || f.waived)) };
    };
    // First with a nominal length, to read the page's ceiling and the words its exhibit already takes of it; then at the ceiling.
    const first = measure(120);
    const ceiling = Number(first?.budget?.ceiling);
    if (!first || !Number.isFinite(ceiling)) return;
    const beside = Math.max(0, first.budget.body - SUMMARY_POINTS * Math.max(8, Math.floor(120 / SUMMARY_POINTS)));
    const room = Math.floor(ceiling) - beside;
    if (room < SUMMARY_POINTS * 8) return;
    const full = measure(room);
    if (!full || !full.voids.length) return;
    const band = full.voids[0].measured;
    const size = band && typeof band === "object" && Number.isFinite(band.to - band.from) ? `a band of ${Math.round(band.to - band.from)}px` : "a band of its body";
    add("SPINE_UNFILLED", id, { ceiling: Math.floor(ceiling), words: full.budget?.body ?? null, exhibits: own.length },
      own.length ? `an executive summary of this deck holds ${Math.floor(ceiling)} body words, its exhibit's among them, and at that length ${size} still stands empty with the exhibit as the spine draws it. Give the exhibit the rows the answer needs - one a question or a lever, with its call - now: an exhibit that gains numbers after the critique is ready changes what the page shows, and reopens it`
        : `an executive summary cannot fill its page on text alone: it holds ${Math.floor(ceiling)} body words, and at that length ${size} still stands empty. Its answer table is part of the spine - declare it now: \`"exhibit": { "type": "table", "columns": ["Question", "Call", "How sure", "What would reverse it"], "rows": [[...], ...] }\`, its cells the calls in words, or its numbers written by reference (\`{{<insight id>/<measure> | 0.0}}\`, with the measures in \`settles.measures\`). ` +
          "Added after the critique is ready, an exhibit that states numbers changes what the page shows and reopens it (`--example summary/executive-summary` prints one)",
      { rule: "SCENE_VOID" });
  });
  return findings;
}
