// A draft is the full compile of the spine, completed.
//
// Three real runs ended undelivered at the same place: a spine passed its
// draft, the storyline critique reached `ready` on its last pass, and the
// full compile then refused a fact the critique was bound to - an exhibit with
// no `type`, a stub on a page type that carries no exhibit, a measure a form
// could not hold. Each time the draft had been a second, more lenient reading
// of the page: it caught the compile's refusal, kept a slide built by other
// code in its place, and listed the refusal among the things "the full compile
// enforces".
//
// So a draft has no reading of its own. Each spine page is completed - given
// placeholder copy where its commentary placement asks for copy, an exhibit
// written from the measures it declares where it declares one and has not
// drawn it, and the worked example's content where its form reads content the
// critique is not bound to (a matrix's rows, a timeline's items, a memo's
// paragraphs) - and the completed page goes through the one compile every
// page goes through (author-deck.mjs compileDeck, page-types.mjs compilePage),
// and is composed. That page is the witness: a layout of the spine reached by
// adding only what a layout adds. Where the page as declared does not compile
// or compose, the type's other forms and commentary placements are tried,
// since those are the layout's to choose; where none holds what the spine
// declares, the draft refuses the page with the compile's own refusal.
//
// What the draft reports of the page is the witness with what the completion
// wrote taken back out (stripWitness): the same slide the full compile will
// build, less its copy. And what the critique would be bound to on that page
// is compared with what it would be bound to on the witness (storyline.mjs
// storyStructure): where they differ, the spine has left something the critic
// reads to be decided by the layout, and the draft refuses it as undetermined,
// saying both readings.
//
// What a draft defers is therefore one closed list, and nothing on it is a
// field the critique binds (DEFERRED): the copy the completion stood in for,
// the content of an exhibit that states no measure, the form and commentary
// placement, and how full the composed page is.
import { PAGE_TYPES, drawnOf, markedChart, placementsOf, skeletonOf, structureOf, undrawnExhibit, withChoice } from "./page-types.mjs";
import { axisOf, isPercentUnit, valuesOf } from "./measures.mjs";
import { VIEW_CLASSES, declaredLabels, metricsOf, refsOf, roleFor } from "./gates/dependency_gates.mjs";
import { boundKeys, kindOfForm } from "./claim-fit.mjs";
import { decimalsNeeded } from "./printed-numbers.mjs";
import { registered } from "./errors.mjs";

export const SPINE_WITNESS_CODES = Object.freeze({
  SPINE_UNDETERMINED: "a spine page leaves something the storyline critique is bound to for the layout to decide: laid out by adding only copy and unbound content, it shows a measure in another class or over other periods or members than the critic would be told, or draws numbers the critic was not shown",
});

/** What a draft leaves to the full compile, and nothing else: each is mended without writing a field the storyline critique is bound to. */
export const DEFERRED = Object.freeze({
  copy: "the words a commentary placement asks for and the spine has not written - points, a rail, a bar, captions, callouts, headings, `adds` - and the mark a chart makes on its finding",
  content: "the content of an exhibit or a page form that states no measure and draws no number: a matrix's rows, a timeline's items, the steps of a flow, a memo's paragraphs, a picture",
  layout: "the page's form and commentary placement among those its type offers, and a chart's form within its class",
  fit: "how much the composed page holds: bands left empty, words against a floor or a ceiling, a line that wraps",
});

// Opens every string the completion writes, so what it wrote is told from what the author wrote wherever the compile carries it.
// It is taken out before a witness is composed and never reaches a file: the slide a draft reports has each such string removed.
const MARK = "⁣";
const marked = (text) => `${MARK}${text}`;
const isMarked = (value) => typeof value === "string" && value.includes(MARK);

const PROSE = "the supplier added capacity at the busiest depots before demand returned in full and the margin held through the year because costs fell faster than sales did".split(" ");
const proseOf = (n, from = 0) => `${Array.from({ length: Math.max(1, n) }, (_, i) => PROSE[(from + i) % PROSE.length]).join(" ")}.`;
const HEADING = "What the exhibit measures";
const ROW_WORDS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"];
const ADDS = "Each point carries the condition its finding depends on, which the exhibit does not show";
// The least copy each placement compiles with: the witness proves that some copy lays the page out, so it stands in the shortest
// that is copy at all - two points of a sentence each, a rail and a bar just past their floors, a caption a panel, two short
// callouts. How much more the page holds is the fit's, measured once the author's own words are written.
const POINT_WORDS = 14, POINTS = 2, SUMMARY_POINTS = 3, SUMMARY_WORDS = 18, RAIL_WORDS = 12, BAR_WORDS = 10, CAPTION_WORDS = 9, CALLOUT_WORDS = 5;

const exhibitsOf = (page) => [page?.exhibit, ...(Array.isArray(page?.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object");
const isChartKind = (kind) => String(kind ?? "").startsWith("chart");
const written = (value) => typeof value === "string" && value.trim().length > 0;
const humanised = (name) => String(name ?? "").replace(/[_.-]+/g, " ").trim();
const classOfKind = (kind) => (isChartKind(kind) ? "chart" : kind === "table" ? "table" : "figure");
// The page types whose one exhibit is a table (storyline.mjs TABLE_TYPES reads the same four for a measure's natural class).
// The keys of an exhibit or a block a renderer reads as data, not as words a reader sees: the completion leaves them as written.
const STRUCTURAL = new Set(["icon", "type", "src", "image", "url", "id", "tone", "variant", "treatment", "arrangement", "date", "start", "end", "from", "to", "kind", "status", "geography", "measure", "format"]);
const TABLE_PAGES = new Set(["scorecard", "lookup", "options"]);
// The chart kinds a callout names one category of; small multiples and a box plot carry a highlight, a slope a focused series (author-deck.mjs bindScaffold).
const CALLOUT_KINDS = new Set(["chart.line", "chart.column", "chart.bar", "chart.area", "chart.lollipop", "chart.stacked-column", "chart.stacked-bar", "chart.stacked-area", "chart.combo", "chart.waterfall"]);

/** `value` with the completion's mark taken out of every string: what a witness is composed from. */
export function unmarked(value) {
  if (typeof value === "string") return value.includes(MARK) ? value.replaceAll(MARK, "") : value;
  if (Array.isArray(value)) return value.map(unmarked);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, unmarked(child)]));
  return value;
}

/**
 * `node` with everything the completion wrote taken out: each marked string,
 * and with it the object that held nothing else worth keeping - a point, a
 * callout, a panel - and a list left empty.
 */
function withoutMarked(node) {
  if (Array.isArray(node)) return node.filter((child) => !isMarked(child)).map(withoutMarked).filter((child) => child !== undefined);
  if (!node || typeof node !== "object") return node;
  // An object whose text was the completion's is the completion's: { text }, { lead, text }, { category, text }, { text, style }.
  if (isMarked(node.text) || isMarked(node.label) || isMarked(node.line)) return undefined;
  const out = {};
  for (const [key, child] of Object.entries(node)) {
    if (isMarked(child)) continue;
    const kept = withoutMarked(child);
    if (kept === undefined || (Array.isArray(kept) && Array.isArray(child) && child.length > 0 && kept.length === 0)) continue;
    out[key] = kept;
  }
  return out;
}

// A figure's format keeps the number it prints (bind.mjs): one decimal place, or as many as the value needs.
const formatOf = (measure, value) => `0.${"0".repeat(Math.max(1, typeof value === "number" ? decimalsNeeded(value, { percent: isPercentUnit(measure.unit) }) : 1))}`;
const valueAt = (measure, label) => (label === null ? valuesOf(measure)[0] : valuesOf(measure)[axisOf(measure).labels.indexOf(label)]);
const tokenOf = (ref, label, measure) => (typeof valueAt(measure, label) === "number" ? `{{${ref}${label === null ? "" : `@${label}`} | ${formatOf(measure, valueAt(measure, label))}}}` : "n/a");

/**
 * What an undrawn exhibit or figure is to show, from its `basis`: each
 * recorded measure with the class its view declares (null where it declares
 * none), the periods or members it declares (null for the whole measure, and
 * for a measure of one value), and its role.
 */
function demandOf(basis, registry) {
  return refsOf(basis).filter((ref) => registry.has(ref)).map((ref) => {
    const measure = registry.get(ref), axis = axisOf(measure), role = roleFor(basis, ref);
    return { ref, measure, axis, class: VIEW_CLASSES.includes(basis.as) ? basis.as : null, labels: axis.kind === "scalar" ? null : declaredLabels(basis, ref, axis),
      ...(role.role === "context" ? { role: "context", relevance: role.relevance } : {}) };
  });
}
// The periods or members a demand shows of its measure: the declared ones, or all that a view of `kind` shows of the whole measure.
const shownLabels = (d, kind) => d.labels ?? (kind === "chart" ? d.axis.labels : d.axis.labels.filter((label) => typeof valueAt(d.measure, label) === "number"));
const sameList = (a, b) => a.length === b.length && a.every((item, i) => item === b[i]);

/** A chart of `kind` written by reference from `demand`, as `{ exhibit }`, or `{ why }` it cannot be. `open`: the form leaves the exhibit's type to the page. */
function chartFrom(kind, demand, { form = null, open = false } = {}) {
  const axed = demand.filter((d) => d.axis.kind !== "scalar");
  if (!axed.length) return { why: "a chart needs a measure that runs over periods or members, and the measures declared here are single values" };
  if (new Set(axed.map((d) => d.axis.kind)).size > 1) return { why: `one chart sets its measures over periods or over members, and ${axed.map((d) => d.ref).join(", ")} run over both` };
  const declared = axed.filter((d) => d.labels);
  if (declared.length && (declared.length < axed.length || declared.some((d) => !sameList(d.labels, declared[0].labels))))
    return { why: `one chart draws every series over the same periods or members, and the views declared for ${axed.map((d) => d.ref).join(", ")} differ` };
  const from = demand.map((d) => ({ ref: d.ref, name: humanised(d.measure.name), m: d.measure }));
  const special = !["chart.line", "chart.column", "chart.bar", "chart.area", "chart.stacked-column", "chart.stacked-bar", "chart.stacked-area"].includes(kind) || ["indexed", "aligned-bars", "distribution"].includes(form);
  let set;
  if (special) {
    const bound = boundKeys(kind, from, { form });
    if (bound.why) return { why: bound.why };
    const left = demand.filter((d) => !bound.claimed.includes(d.ref)).map((d) => d.ref);
    if (left.length) return { why: `a ${kind.replace("chart.", "")} written from these measures draws ${bound.claimed.join(", ")} and leaves out ${left.join(", ")}` };
    set = structuredClone(bound.set);
  } else {
    // Series over the same periods or members sit side by side. Series over periods that do not all run over the same ones are one
    // line where they are one unit - a recorded run and then a scenario's path (bind.mjs: a joined series) - since side by side
    // a chart draws only the periods they share, which is less than the whole of each.
    const whole = axed.filter((d) => !d.labels), common = whole.length ? whole[0].axis.labels.filter((label) => whole.every((d) => d.axis.labels.includes(label))) : [];
    const ragged = whole.length > 1 && whole.some((d) => d.axis.labels.length !== common.length);
    if (ragged && !(axed[0].axis.kind === "periods" && whole.length === axed.length && new Set(axed.map((d) => String(d.measure.unit ?? ""))).size === 1))
      return { why: `${axed.map((d) => d.ref).join(", ")} do not run over the same ${axed[0].axis.kind}, so one chart shows less than the whole of each` };
    const scalars = from.filter((x) => axisOf(x.m).kind === "scalar");
    set = ragged ? { series: [{ measure: axed.map((d) => d.ref), name: humanised(axed[0].measure.name) }, ...scalars.map((x) => ({ measure: x.ref, name: x.name }))] } : { series: from.map((x) => ({ measure: x.ref, name: x.name })) };
  }
  // A measure shown as context says so on its own series, with the relevance its basis claims.
  const contexts = new Map(demand.filter((d) => d.role === "context").map((d) => [d.ref, d]));
  if (Array.isArray(set.series)) set.series = set.series.map((s) => (typeof s.measure === "string" && contexts.has(s.measure) ? { ...s, role: "context", ...(contexts.get(s.measure).relevance !== undefined ? { relevance: contexts.get(s.measure).relevance } : {}) } : s));
  const everyContext = contexts.size === demand.length && !Array.isArray(set.series) ? { role: "context", ...(demand[0].relevance !== undefined ? { relevance: demand[0].relevance } : {}) } : {};
  const select = declared.length ? { ...(set.select ?? {}), [axed[0].axis.kind === "periods" ? "periods" : "members"]: declared[0].labels } : set.select;
  if (declared.length && set.select && ["from", "to"].some((key) => set.select[key] !== undefined)) { delete select.from; delete select.to; }
  // The periods or members the chart will set along its axis, for a mark to name: the declared ones, or those every series shares
  // (all of them where the series are joined end to end).
  const joined = Array.isArray(set.series) && set.series.some((s) => Array.isArray(s.measure));
  const along = declared.length ? declared[0].labels : joined ? [...new Set(axed.flatMap((d) => d.axis.labels))] : axed[0].axis.labels.filter((label) => axed.every((d) => d.axis.labels.includes(label)));
  return { exhibit: { ...(open ? { type: kind } : {}), heading: marked(HEADING), ...set, ...(select ? { select } : {}), ...everyContext }, labels: along };
}

/**
 * A table that prints `demand` by reference, a token a cell: the members down
 * the side and a measure a column where every measure runs over members; a
 * measure a row over its periods where every one runs over periods; otherwise
 * a row a number. A cell outside a measure's declared view prints nothing of it.
 */
function tableFrom(demand, { open = false, coding = null, worked = null } = {}) {
  const shown = demand.map((d) => ({ ...d, shown: d.axis.kind === "scalar" ? [null] : shownLabels(d, "table") }));
  const axed = shown.filter((d) => d.axis.kind !== "scalar"), kinds = new Set(axed.map((d) => d.axis.kind));
  const head = (d) => ({ label: humanised(d.measure.name), ...(written(d.measure.unit) ? { unit: d.measure.unit } : {}) });
  const cell = (d, label) => (d.shown.includes(label) ? tokenOf(d.ref, label, d.measure) : "n/a");
  const union = (list) => { const order = list.flatMap((d) => d.axis.labels); return [...new Set(order)].filter((label) => list.some((d) => d.shown.includes(label))); };
  let columns, rows;
  if (axed.length === shown.length && kinds.size === 1 && kinds.has("members")) {
    // A scorecard that codes recorded magnitudes codes each measure's column as its form does (author-deck.mjs RECORDED_CODING):
    // a heatmap shades every column, bars set the first as in-cell bars, progress takes percentages of a maximum.
    const coded = (d, at) => (coding === "heatmap" ? { heat: true } : coding === "bars" && at === 0 && written(d.measure.unit) ? { bar: true }
      : coding === "progress" && isPercentUnit(d.measure.unit) && valuesOf(d.measure).every((v) => v === null || (v >= 0 && v <= 100)) ? { type: "progress" } : {});
    columns = [marked("Member"), ...shown.map((d, at) => ({ ...head(d), ...coded(d, at) }))];
    rows = union(shown).map((label) => [label, ...shown.map((d) => cell(d, label))]);
  } else if (axed.length === shown.length && kinds.size === 1) {
    const labels = union(shown);
    columns = [marked("Measure"), ...labels.map((label) => (coding === "heatmap" ? { label, heat: true } : label))];
    rows = shown.map((d) => [`${humanised(d.measure.name)}${written(d.measure.unit) ? `, ${d.measure.unit}` : ""}`, ...labels.map((label) => cell(d, label))]);
  } else {
    columns = [marked("Measure"), marked("Period or member"), coding === "heatmap" ? { label: marked("Value"), heat: true } : marked("Value")];
    rows = shown.flatMap((d) => d.shown.map((label) => [`${humanised(d.measure.name)}${written(d.measure.unit) ? `, ${d.measure.unit}` : ""}`, label ?? "-", tokenOf(d.ref, label, d.measure)]));
  }
  if (!rows.length) return { why: "the measures declared hold no number a table can print" };
  // What the page's form asks of its table beyond the numbers - a column of marks that introduces each player, a column that codes
  // a judgement - states no measure: it is stood in for from the worked page's own table, a cell a row.
  const model = worked && Array.isArray(worked.columns) && Array.isArray(worked.rows) ? worked : null;
  const typeOf = (column) => (column && typeof column === "object" ? column.type : undefined);
  if (model && coding === "logo-table") {
    columns[0] = { label: typeof columns[0] === "string" ? columns[0] : marked("Player"), type: "logo" };
    rows = rows.map((row) => [{ type: "logo", player: String(row[0]), media: { alt: `${row[0]} logo` } }, ...row.slice(1)]);
  } else if (model && coding && !["heatmap", "bars", "progress"].includes(coding)) {
    const at = model.columns.findIndex((column, c) => typeOf(column) === coding || model.rows.some((row) => { const cell = Array.isArray(row) ? row[c] : row?.cells?.[c]; return cell && typeof cell === "object" && cell.type === coding; }));
    if (at >= 0) {
      const sample = Array.isArray(model.rows[0]) ? model.rows[0][at] : model.rows[0]?.cells?.[at];
      columns.push(typeof model.columns[at] === "object" ? { ...model.columns[at], label: marked(String(model.columns[at].label ?? "Read")) } : marked(String(model.columns[at])));
      rows = rows.map((row) => [...row, structuredClone(sample)]);
    }
  }
  return { exhibit: { ...(open ? { type: "table" } : {}), heading: marked(HEADING), columns, rows, ...contextBasis(demand) } };
}

/** The figures that state `demand`, one a number: each `{ measure, format, label }` for the runtime to write. */
function figuresFrom(demand) {
  return demand.flatMap((d) => (d.axis.kind === "scalar" ? [null] : shownLabels(d, "figure")).filter((label) => typeof valueAt(d.measure, label) === "number").map((label) => ({ measure: label === null ? d.ref : `${d.ref}@${label}`, format: formatOf(d.measure, valueAt(d.measure, label)),
    label: marked(`${humanised(d.measure.name)}${label === null ? "" : `, ${label}`}`), ...(d.role === "context" ? { role: "context", ...(d.relevance !== undefined ? { relevance: d.relevance } : {}) } : {}) })));
}

/** The class a page of `type` shows `measure` in where nothing declares one (storyline.mjs naturalClass). */
const naturalClass = (type, measure) => (axisOf(measure).kind === "scalar" ? "figure" : TABLE_PAGES.has(type) || type === "matrix" ? "table" : "chart");

/**
 * The kind of exhibit a page draws at exhibit `at`: the one its form sets
 * (page-types.mjs: a chart form's own, a table on a table page, a figure grid),
 * or null where the page names it - a panel, the exhibit under a strip or
 * beside a hero number, a block's.
 */
function slotKind(page, at) {
  const target = PAGE_TYPES[page.type]?.forms?.[page.form];
  if (at > 0 || !target) return null;
  if (page.type === "trend" && page.form === "model") return null;
  if (PAGE_TYPES[page.type].table || (page.type === "profiles" && page.form === "logo-table")) return "table";
  if (page.type === "numbers") return ["fact-grid", "stat-list"].includes(page.form) ? target : null;
  if (["panels", "options", "picture", "summary"].includes(page.type) && !(page.type === "options" && page.form === "compare")) return page.type === "options" && page.form === "table-halves" ? "table" : null;
  // A ranking's aligned bars are a group of bar charts, one a measure.
  return target === "aligned-bars" ? "chart.bar" : kindOfForm(page.type, page.form) ?? target;
}

// A class of exhibit as a critic is told it.
const classWords = (name) => (name === "chart" ? "plotted" : name === "table" ? "tabulated" : "stated as a figure");

/**
 * An exhibit written from `demand` for a slot of `kind` (null: the page names
 * it), as `{ exhibit }` or `{ why }`. `given` is the kind the deck's plan gives
 * an open slot's untyped stub (deck-structure.mjs openKindsOf): the kind the
 * plan prints is the kind drawn here, so the plan, the draft and the critique
 * read one stub one way. Where the stub's own view or the page's type has the
 * critic told another class than that kind's, or the kind cannot be written
 * from the stub's measures, the page is refused and the kind named: the stub
 * says its `type`.
 */
function exhibitFrom(page, demand, kind, { block = false, worked = null, given = null, at = 0 } = {}) {
  const open = kind === null;
  const wanted = demand.find((d) => d.class)?.class ?? (open ? naturalClass(page.type, (demand.find((d) => d.axis.kind !== "scalar") ?? demand[0]).measure) : classOfKind(kind));
  if (!open && classOfKind(kind) !== wanted) return { why: `its basis declares ${demand.map((d) => d.ref).join(", ")} ${wanted === "chart" ? "plotted" : wanted === "table" ? "tabulated" : "stated as a figure"}, and a ${page.type}/${page.form} page draws ${classOfKind(kind) === "chart" ? "a chart" : classOfKind(kind) === "table" ? "a table" : `a ${kind}`} there` };
  const byAxis = demand.find((d) => d.axis.kind !== "scalar")?.axis.kind === "periods" ? "chart.line" : "chart.bar";
  const named = `exhibit ${at + 1}'s \`basis\` stub has no \`type\`, and the plan gives it \`${given}\` (\`--plan\` prints the kind on the page's line)`;
  if (open && given && classOfKind(given) !== wanted) return { directed: true, why: `${named}, which has the critic told ${demand.map((d) => d.ref).join(", ")} ${classWords(classOfKind(given))} where the stub as written has it told ${classWords(wanted)}: write the exhibit's \`type\` on the stub - \`${given}\`, or the kind that is meant` };
  if (wanted === "chart") {
    const drawn = (as) => chartFrom(as, demand, { form: block ? null : page.form, open });
    const made = drawn(open ? given ?? byAxis : kind);
    if (!(open && given && made.why) || given === byAxis) return made;
    // The kind is named only where it is the kind that fails: what no chart of these measures shows is refused as it is of any stub.
    const plain = drawn(byAxis);
    return plain.why ? plain : { directed: true, why: `${named}, which cannot be written from what the stub declares - ${made.why}: write the exhibit's \`type\` on the stub (\`${byAxis}\` plots ${demand.length === 1 ? "its measure" : "its measures"} over ${byAxis === "chart.line" ? "periods" : "members"}), or declare the measures \`${given}\` takes` };
  }
  if (wanted === "table") return tableFrom(demand, { open, worked, coding: block ? null : page.type === "scorecard" ? page.form : page.type === "profiles" && page.form === "logo-table" ? "logo-table" : null });
  // A figure grid or list states a number an item; a measure shown as context beside the claim's says so in the exhibit's own basis.
  const figures = figuresFrom(demand).map(({ role: _role, relevance: _relevance, ...item }) => item);
  if (figures.length < 2 && !block) return { why: `a grid or list of figures states two or more numbers, and ${demand.map((d) => d.ref).join(", ")} ${demand.length === 1 ? "gives" : "give"} ${figures.length}` };
  const listed = kind === "stat-list" || open;
  return { exhibit: { ...(open ? { type: "stat-list" } : {}), items: figures.map(({ label, ...rest }) => (listed ? { ...rest, text: label } : { ...rest, label, text: marked(proseOf(6)) })), ...contextBasis(demand) } };
}

// The basis an exhibit written from tokens or figures carries where a measure it shows is context: the runtime writes the basis of
// an exhibit that says nothing, as proof, so the roles a stub declared are said on the exhibit that stands for it.
function contextBasis(demand) {
  const contexts = demand.filter((d) => d.role === "context");
  if (!contexts.length) return {};
  const every = contexts.length === demand.length;
  return { basis: { measures: demand.map((d) => d.ref), role: every ? "context" : "proof", ...(every && contexts[0].relevance !== undefined ? { relevance: contexts[0].relevance } : {}),
    ...(every ? {} : { roles: Object.fromEntries(contexts.map((d) => [d.ref, { role: "context", ...(d.relevance !== undefined ? { relevance: d.relevance } : {}) }])) }) } };
}

/**
 * A spine page completed: `{ page, filled }`, or `{ why }` where what it
 * declares cannot be written into a page of its type and form - then only
 * another form, another view or another type holds it.
 *
 * `filled` says what the completion wrote, so it can be taken back out of the
 * compiled slide (stripWitness): the page-level keys (`keys`), the exhibits it
 * drew (`exhibits`, by place, each with the stub that stood there and, where
 * the stub had no type and the plan gave it one, that kind as `given`), the
 * figures (`metrics`, `kpi`), and the marks it made on exhibits the author
 * drew (`marks`, by place).
 *
 * `example` is the worked page of the page's type and form (author-deck.mjs
 * workedExamples); `registry` the log's measures; `shown` the measures the
 * page as written already shows by reference, and `labels` the periods or
 * members each of its drawn exhibits sets along its axis, both read off the
 * page as the binding wrote it; `kinds` the kind the deck's plan gives each of
 * the page's untyped stubs, by place (deck-structure.mjs openKindsOf).
 */
export function completePage(pageIn, { example = null, registry = new Map(), shown = new Set(), labels = [], mark = "callout", kinds = null } = {}) {
  const page = structuredClone(pageIn), type = PAGE_TYPES[page.type];
  const filled = { keys: [], exhibits: [], metrics: [], blocks: [], marks: [], kpi: false };
  const worked = example && typeof example === "object" ? example : {};
  const [lo, hi] = Array.isArray(type.exhibits) ? type.exhibits : [type.exhibits, type.exhibits];
  const rows = page.form === "labelled-rows";
  // A type that carries no exhibit has nowhere to draw one: a stub on it declares a view nothing on the page can show.
  const stubbed = exhibitsOf(page).filter(undrawnExhibit);
  if (hi === 0 && stubbed.length) return { directed: true, why: `a ${page.type} page carries no exhibit - ${page.type === "matrix" ? "its rows are its evidence" : "its prose is its evidence"} - so the \`basis\` stub on it declares a view of ${stubbed.flatMap((ex) => refsOf(ex.basis)).join(", ") || "its measures"} that nothing on the page can show. Take the stub off, and with it the measures from \`settles\` (the rows may still print recorded numbers by token), or choose the page type that tabulates or plots them (lookup, scorecard, numbers)` };
  const claimed = (Array.isArray(page.settles?.measures) ? page.settles.measures : []).filter((ref) => registry.has(ref));

  // --- the figures the page states: stubs written from their basis ---------------------------------------------
  const figureOf = (stub, what) => { const figures = figuresFrom(demandOf(stub.basis ?? {}, registry)); return figures.length === 1 ? figures[0] : { directed: true, why: `${what} states one number, and its basis ${figures.length ? `declares ${figures.length}: name one period or member of one measure in \`labels\`` : "names no recorded measure that holds one"}` }; };
  const figureStub = (item) => item && typeof item === "object" && item.basis !== undefined && item.value === undefined && item.measure === undefined;
  if (Array.isArray(page.metrics)) {
    const next = [];
    for (const [at, metric] of page.metrics.entries()) {
      if (!figureStub(metric)) { next.push(metric); continue; }
      // A tile states one number. A measure that runs over periods or members, named with none of them, would set a tile for each -
      // a strip the composer refuses for its width, in pixels - so the stub says which one the tile states.
      const open = demandOf(metric.basis, registry).filter((d) => d.axis.kind !== "scalar" && !d.labels);
      if (open.length) return { directed: true, why: `metric ${at + 1}'s \`basis\` names ${open.map((d) => `${d.ref} (${d.axis.labels.length} ${d.axis.kind})`).join(", ")} and no period or member of ${open.length === 1 ? "it" : "them"}, and a tile states one number: name the one it states - \`basis: { measures: ["${open[0].ref}"], labels: ["${open[0].axis.labels.at(-1)}"] }\` - a tile a number, each of a different measure` };
      const figures = figuresFrom(demandOf(metric.basis, registry));
      if (!figures.length) return { why: `metric ${at + 1} is declared by a \`basis\` that names no recorded number` };
      filled.metrics.push({ from: next.length, count: figures.length });
      next.push(...figures);
    }
    page.metrics = next;
  }
  if (figureStub(page.kpi)) { const figure = figureOf(page.kpi, "a hero figure"); if (figure.why) return figure; page.kpi = figure; filled.kpi = true; }
  // A row of a labelled-rows page declared by its figure alone - `{ metric: { basis } }` - is given the figure, and a label and
  // two points to stand where the row's own will be written.
  if (rows && stubbed.length) return { directed: true, why: `a labelled-rows page states its figures in its rows, one number a row, and carries no exhibit of its own: declare each figure in its row - \`blocks: [{ metric: { basis: { measures: ["<insight id>/<measure>"], labels: ["<period or member>"] } } }, ...]\` - or choose the form or the type that carries the exhibit (cards; a numbers page's fact grid)` };
  for (const [at, block] of (Array.isArray(page.blocks) ? page.blocks : []).entries()) {
    if (!block || typeof block !== "object") continue;
    const before = structuredClone(block);
    if (figureStub(block.metric)) { const figure = figureOf(block.metric, `block ${at + 1}'s metric`); if (figure.why) return figure; block.metric = figure; }
    // A row's exhibit declared by its type and a `basis` is written from the basis, as a page's own is. One with no type is the
    // compile's to refuse: a row does not set its exhibit's type, and the type is the class the critic is told.
    if (undrawnExhibit(block.exhibit) && typeof block.exhibit.type === "string" && block.exhibit.type) {
      const demand = demandOf(block.exhibit.basis ?? {}, registry);
      if (!demand.length) return { directed: true, why: `block ${at + 1}'s exhibit is declared by its type alone: give it a \`basis\` naming the measures it shows, or write it by reference` };
      const made = exhibitFrom(page, demand, block.exhibit.type, { block: true });
      if (made.why) return { why: `block ${at + 1}'s exhibit: ${made.why}` };
      block.exhibit = { type: block.exhibit.type, ...made.exhibit };
    }
    // A row's stand-in label is words alone: a numeral in it would be read as repeating the figure the row states.
    if (!written(block.label)) block.label = marked(`${ROW_WORDS[at % ROW_WORDS.length]} area`);
    if (!Array.isArray(block.points)) block.points = [marked(proseOf(POINT_WORDS, at * 5)), marked(proseOf(POINT_WORDS, at * 5 + 9))];
    if (JSON.stringify(before) !== JSON.stringify(block)) filled.blocks.push({ at, stub: before });
  }

  // --- the exhibits: each stub written from what it declares, and the slots the form needs and the page leaves out ---
  const own = exhibitsOf(page);
  const exampleExhibits = exhibitsOf(worked);
  // What the page is read as showing and nothing on it draws yet: the measures of its claim no exhibit, stub or figure names,
  // each whole in its natural class. They are the first empty exhibit's to draw; a measure of one value needs none.
  const named = new Set([...shown, ...own.flatMap((ex) => refsOf(ex.basis)), ...metricsOf(page).flatMap((m) => [...refsOf(m.basis), ...(typeof m.measure === "string" ? [m.measure.split("@")[0]] : [])]),
    ...(Array.isArray(page.blocks) ? page.blocks.flatMap((block) => refsOf(block?.exhibit?.basis)) : [])]);
  const unshown = claimed.filter((ref) => !named.has(ref)).map((ref) => ({ ref, measure: registry.get(ref), axis: axisOf(registry.get(ref)), class: null, labels: null }));
  const unshownSeries = unshown.filter((d) => d.axis.kind !== "scalar"), unshownSingles = unshown.filter((d) => d.axis.kind === "scalar");
  const slots = own.map((ex, at) => ({ at, ex, stub: undrawnExhibit(ex) }));
  // The page that draws none takes the worked page's count - and no more panels than its claim has series to put in them, so
  // none is left to a stand-in that plots numbers the spine never named.
  const worth = own.length ? 0 : exampleExhibits.length && (lo > 0 || (page.type === "parallel") || (page.type === "statement" && page.form === "quotes") || (page.type === "picture" && page.form === "photo-backdrop")) ? exampleExhibits.length : 0;
  // A panels page sets one cut a panel, so it takes a panel a series, as many as the type holds, whatever its worked page drew.
  const cuts = page.type === "panels" && !own.length ? Math.min(hi, unshownSeries.length) : 0;
  const wanted = rows ? 0 : Math.max(lo, cuts, unshownSeries.length ? Math.min(worth, unshownSeries.length) : worth);
  for (let at = slots.length; at < wanted; at += 1) slots.push({ at, ex: {}, stub: true, added: true });
  const empty = slots.filter((slot) => slot.stub && !demandOf(slot.ex.basis ?? {}, registry).length);
  // The unshown measures go to the empty slots: all to the one a page has, one a slot in turn where it has several. A measure of
  // one value goes with them where the slot tabulates or states figures; a chart needs none of it drawn.
  const share = new Map(empty.map((slot) => [slot.at, []]));
  unshownSeries.forEach((d, i) => { if (empty.length) share.get(empty[empty.length === 1 ? 0 : Math.min(i, empty.length - 1)].at).push(d); });
  const stating = empty.find((slot) => { const kind = typeof slot.ex.type === "string" && slot.ex.type ? slot.ex.type : slotKind(page, slot.at); return kind !== null && !isChartKind(kind) && ["table", "fact-grid", "stat-list"].includes(kind); });
  if (stating && !(Array.isArray(page.metrics) || page.kpi || Array.isArray(worked.metrics) || worked.kpi)) share.get(stating.at).push(...unshownSingles);
  const drawn = [], drawnLabels = new Map();
  let stated = Boolean(stating);
  for (const slot of slots) {
    if (!slot.stub) { drawn.push(slot.ex); continue; }
    const declared = demandOf(slot.ex.basis ?? {}, registry), demand = declared.length ? declared : share.get(slot.at) ?? [];
    const kind = typeof slot.ex.type === "string" && slot.ex.type ? slot.ex.type : slotKind(page, slot.at);
    let exhibit;
    if (demand.length) {
      // An untyped stub in a slot whose kind the page names takes the kind the deck's plan gives it (`kinds`, by place).
      const given = kind === null && declared.length ? kinds?.get(slot.at) ?? null : null;
      const made = exhibitFrom(page, demand, typeof slot.ex.type === "string" && slot.ex.type ? slot.ex.type : kind, { worked: exampleExhibits[slot.at] ?? exampleExhibits[0] ?? null, given, at: slot.at });
      // What the critic would be told the page shows where the spine declares no view: each measure whole, in its natural class.
      const read = declared.length && declared.every((d) => d.class && (d.labels || d.axis.kind === "scalar")) ? ""
        : `${declared.length ? "its `basis` declares no view of" : "nothing on the page draws"} ${demand.filter((d) => !d.class || !d.labels).map((d) => d.ref).join(", ")}, so the critic is told the page shows ${demand.length === 1 ? "it" : "each"} ${declared.find((d) => d.class)?.class === "table" || (!declared.some((d) => d.class) && naturalClass(page.type, (demand.find((d) => d.axis.kind !== "scalar") ?? demand[0]).measure) === "table") ? "tabulated" : declared.find((d) => d.class)?.class === "figure" ? "stated as figures" : "plotted"}, whole where no periods or members are declared; `;
      if (made.why) return { why: `${read}${made.why}`, ...(made.directed ? { directed: true } : {}) };
      exhibit = { ...(typeof slot.ex.type === "string" && slot.ex.type ? { type: slot.ex.type } : {}), ...made.exhibit };
      if (made.labels) drawnLabels.set(slot.at, made.labels);
    } else {
      // No measure to write it from: the worked page's exhibit stands in for content the critique is not bound to.
      const source = exampleExhibits[slot.at] ?? exampleExhibits[0];
      if (!source) return { why: `a ${page.type}/${page.form} page has no exhibit to stand in for exhibit ${slot.at + 1}` };
      const { basis: _basis, ...copied } = structuredClone(source);
      // A stand-in that is words - a table of calls, a diagram's steps - carries no number of the worked page's: the critique is
      // bound to the numbers a page states, and this page's spine states none here. A chart's values cannot be taken out of it.
      const content = Array.isArray(copied.series) || Array.isArray(copied.values) || Array.isArray(copied.charts) ? copied : wordsOnly(copied);
      // The single values of the claim nothing else on the page states are this exhibit's to state - a date of a timeline, a figure
      // in a card - so it names them as the proof the layout will write into it: a number written into an exhibit is stated there.
      const states = !stated && unshownSingles.length && !(Array.isArray(page.metrics) || page.kpi || Array.isArray(worked.metrics) || worked.kpi) ? { basis: { measures: unshownSingles.map((d) => d.ref), role: "proof" } } : {};
      if (states.basis) stated = true;
      exhibit = { ...content, ...(typeof slot.ex.type === "string" && slot.ex.type ? { type: slot.ex.type } : {}), ...(typeof content.heading === "string" ? { heading: marked(content.heading) } : {}), ...(typeof content.caption === "string" ? { caption: marked(content.caption) } : {}), ...states };
    }
    filled.exhibits.push({ at: slot.at, stub: slot.added ? null : structuredClone(slot.ex), written: demand.length > 0, ...(exhibit.type && exhibit.type === (kind === null && declared.length ? kinds?.get(slot.at) : null) ? { given: exhibit.type } : {}) });
    drawn.push(exhibit);
  }
  if (drawn.length) {
    if (page.exhibit !== undefined || (drawn.length === 1 && page.exhibits === undefined && page.type !== "panels")) { page.exhibit = drawn[0]; if (drawn.length > 1) page.exhibits = drawn.slice(1); }
    else page.exhibits = drawn;
  }

  // --- the content a form reads that states no measure: taken from the worked page ------------------------------
  const CONTENT = ["columns", "rows", "blocks", "paragraphs", "panel", "text", "accent", "subtext", "items", "pictures", "photo", "metrics", "kpi"];
  for (const key of CONTENT) {
    if (page[key] !== undefined || worked[key] === undefined) continue;
    // A page's own figures are written from the measures of its claim where they are single numbers, before the worked page's stand in.
    if (key === "metrics" || key === "kpi") {
      const singles = figuresFrom(claimed.filter((ref) => !named.has(ref) && axisOf(registry.get(ref)).kind === "scalar").map((ref) => ({ ref, measure: registry.get(ref), axis: axisOf(registry.get(ref)), class: null, labels: null })));
      if (singles.length) { page[key] = key === "kpi" ? singles[0] : singles.slice(0, Math.max(2, worked.metrics.length)); filled.keys.push(key); continue; }
    }
    page[key] = markText(structuredClone(worked[key]));
    filled.keys.push(key);
  }

  // --- the copy the placement asks for ---------------------------------------------------------------------------
  const exhibits = exhibitsOf(page);
  const drawnBy = new Set(filled.exhibits.map((slot) => slot.at));
  exhibits.forEach((ex, at) => {
    const kind = String(ex.type ?? (at === 0 ? slotKind(page, 0) ?? "" : ""));
    if ((isChartKind(kind) || Array.isArray(ex.series) || ex.measure !== undefined || (page.type === "panels" && page.form === "sequence")) && !written(ex.heading)) ex.heading = marked(HEADING);
  });
  const text = ["beside", "beside-left", "below"].includes(page.commentary);
  const add = (key, value) => { page[key] = value; filled.keys.push(key); };
  if (text && !(Array.isArray(page.points) && page.points.length) && !page.paragraphs) add("points", Array.from({ length: POINTS }, (_, k) => marked(proseOf(POINT_WORDS, k * 7))));
  if (page.type === "summary" && page.form === "executive-summary" && !(Array.isArray(page.points) && page.points.length)) add("points", Array.from({ length: SUMMARY_POINTS }, (_, k) => marked(proseOf(SUMMARY_WORDS, k * 7))));
  if (page.commentary === "rail" && !written(page.rail)) add("rail", marked(proseOf(RAIL_WORDS)));
  if (page.commentary === "so-what-bar" && !written(page.bar)) add("bar", marked(proseOf(BAR_WORDS, 5)));
  if (page.commentary === "captions" && page.type !== "picture") exhibits.forEach((ex, k) => { if (!written(ex.caption)) ex.caption = marked(proseOf(CAPTION_WORDS, k * 5 + 3)); });
  if (["beside", "beside-left", "below", "captions", "on-exhibit"].includes(page.commentary) && !written(page.adds)) add("adds", marked(ADDS));
  // The mark a chart makes on its finding: callouts where the commentary is written on the exhibit, and one mark on a chart whose type
  // asks for it. `mark` chooses how - a callout or a highlight on the last period or member - since a chart kind draws one or the other.
  const first = exhibits[0], firstKind = String(first?.type ?? slotKind(page, 0) ?? "");
  // What a mark can name on the first exhibit: the periods or members along its axis, or - small multiples, a treemap - its items.
  const namesOf = (list) => (Array.isArray(list) ? list.map((item) => (item && typeof item === "object" ? item.label ?? item.name : item)).filter((label) => label !== undefined && label !== null) : []);
  const along = drawnLabels.get(0) ?? labels[0] ?? (first ? [first.categories, first.labels, first.items, ...(["chart.sparklines", "chart.radar"].includes(firstKind) ? [first.series] : [])].map(namesOf).find((list) => list.length) : null) ?? null;
  if (first && isChartKind(firstKind) && along?.length && mark !== "none") {
    // The callouts stand at the ends of the axis, or - `callout-low` - over its two lowest values, where a tall plot leaves them room.
    const values = Array.isArray(first.series?.[0]?.values) ? first.series[0].values : Array.isArray(first.values) ? first.values : null;
    const lowest = values && values.length === along.length ? [...along].sort((a, b) => (values[along.indexOf(a)] ?? 0) - (values[along.indexOf(b)] ?? 0)).slice(0, 2) : [along.at(-1), along[0]];
    const callouts = () => [...new Set(mark === "callout-low" ? lowest : [along.at(-1), along[0]])].map((category, k) => ({ category, text: marked(proseOf(CALLOUT_WORDS, k * 9)) }));
    const markKeys = [];
    if (mark === "highlight") {
      // A highlight on one period or member - small multiples mark one of their items, by its label - which some forms ask for whatever else is marked.
      if (!(Array.isArray(first.highlights) && first.highlights.length)) { first.highlights = [{ category: firstKind === "chart.sparklines" ? (namesOf(first.items)[0] ?? namesOf(first.series)[0] ?? along.at(-1)) : along.at(-1) }]; markKeys.push("highlights"); }
    } else if (page.commentary === "on-exhibit" && !(Array.isArray(first.annotations) && first.annotations.length)) { first.annotations = callouts(); markKeys.push("annotations"); }
    else if (type.marked && !markedChart({ ...first, type: firstKind })) {
      if (firstKind === "chart.slope") { first.focusSeries = Array.isArray(first.series) ? first.series[0]?.name : undefined; markKeys.push("focusSeries"); }
      else if (CALLOUT_KINDS.has(firstKind)) { first.annotations = callouts().slice(0, 1); markKeys.push("annotations"); }
    }
    // A radar of several players, like a slope, marks its finding by naming the series the page is about.
    if (firstKind === "chart.radar" && first.focusSeries === undefined && namesOf(first.series).length > 1) { first.focusSeries = namesOf(first.series)[0]; markKeys.push("focusSeries"); }
    // Callouts on the chart are the commentary of an on-exhibit page whatever else marks it.
    if (mark === "highlight" && page.commentary === "on-exhibit" && !(Array.isArray(first.annotations) && first.annotations.length)) { first.annotations = callouts(); markKeys.push("annotations"); }
    if (markKeys.length && !drawnBy.has(0)) filled.marks.push({ at: 0, keys: markKeys });
  }
  return { page, filled };
}

/** `node` with every string that prints a numeral replaced by placeholder words, the keys a renderer reads as data left alone. */
function wordsOnly(node, key = "") {
  if (typeof node === "string") return STRUCTURAL.has(key) || !/\d/.test(node) ? node : marked(proseOf(4, node.length % 11));
  if (Array.isArray(node)) return node.map((child) => wordsOnly(child, key));
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, child]) => [k, wordsOnly(child, k)]));
  return node;
}

/** `node` with the completion's mark opening every string a reader would see. */
function markText(node, key = "") {
  if (typeof node === "string") return STRUCTURAL.has(key) ? node : marked(node);
  if (Array.isArray(node)) return node.map((child) => markText(child, key));
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, child]) => [k, markText(child, k)]));
  return node;
}

/**
 * The slide a draft reports for a page: its witness's compiled slide
 * (`slide`, the completion's marks still in it) with everything the
 * completion wrote taken back out. An exhibit the completion drew goes back to
 * the place-holder the spine wrote - typed where the compile typed it by the
 * page's form, so the page reads as the kind of exhibit it will carry - and
 * the record says what was deferred (`pageType.pending`).
 */
export function stripWitness(slide, filled) {
  const out = structuredClone(slide);
  for (const key of filled.keys) {
    if (key === "rail") delete out.panel;
    else if (key === "bar" || key === "takeaway") delete out.soWhat;
    else if (key === "adds") { if (out.pageType?.content) out.pageType.content.adds = null; }
    else delete out[key];
  }
  const exhibits = exhibitsOf(out);
  const replace = (at, value) => { if (out.exhibit !== undefined && at === 0) out.exhibit = value; else if (Array.isArray(out.exhibits)) out.exhibits[out.exhibit !== undefined ? at - 1 : at] = value; };
  for (const slot of filled.exhibits) {
    const compiled = exhibits[slot.at];
    if (!compiled) continue;
    // The type the compile gave the exhibit by the page's form is the page's; one the completion chose for an open slot is the layout's.
    const typed = slot.stub?.type ?? (slot.formTyped ? compiled.type : undefined);
    replace(slot.at, typed === undefined ? {} : { type: typed });
  }
  for (const item of filled.marks) { const ex = exhibitsOf(out)[item.at]; if (ex) for (const key of item.keys) delete ex[key]; }
  // A figure the completion wrote from a stub goes back to the one place-holder the spine kept for it, so each figure of the page
  // still stands where its `basis` was declared.
  if (Array.isArray(out.metrics)) for (const run of [...filled.metrics].reverse()) out.metrics.splice(run.from, run.count, {});
  if (filled.kpi) out.kpi = {};
  // A row the completion filled goes back to what the spine wrote of it: its figure a place-holder, as an exhibit's is.
  if (Array.isArray(out.blocks)) for (const { at, stub } of filled.blocks) if (out.blocks[at]) { const { basis: _basis, ...metric } = stub.metric && typeof stub.metric === "object" ? stub.metric : {};
    out.blocks[at] = { ...stub, ...(stub.metric !== undefined ? { metric } : {}), ...(stub.exhibit && typeof stub.exhibit === "object" ? { exhibit: Object.fromEntries(Object.entries(stub.exhibit).filter(([key]) => key !== "basis")) } : {}) }; }
  const stripped = withoutMarked(out);
  if (stripped.pageType) {
    const copied = JSON.stringify(slide).includes(MARK) && (filled.keys.some((key) => COPY_KEYS.includes(key)) || filled.marks.length > 0 || JSON.stringify(exhibitsOf(out)).includes(MARK));
    const pending = [...(copied ? ["copy"] : []),
      ...(filled.exhibits.length || filled.metrics.length || filled.kpi || filled.blocks.length || filled.keys.some((key) => !COPY_KEYS.includes(key)) ? ["content"] : [])];
    if (pending.length) stripped.pageType.pending = pending;
    // What the page plots is read once its exhibits are drawn: an exhibit the completion drew plots nothing of the author's yet.
    if (filled.exhibits.length) delete stripped.pageType.values;
    // The record describes the slide it is on: what the variety contract counts is read off the page as the spine stands.
    Object.assign(stripped.pageType, { structure: structureOf(stripped), skeleton: skeletonOf(stripped), drawn: drawnOf(stripped) });
  }
  return stripped;
}

/** `filled` with each drawn exhibit marked where the page's form, not the completion, gives it its type. */
const COPY_KEYS = ["points", "rail", "bar", "adds"];
const withFormTypes = (page, filled) => ({ ...filled, exhibits: filled.exhibits.map((slot) => ({ ...slot, formTyped: slotKind(page, slot.at) !== null })) });

// A bound exhibit in the other shape its measures can be named in: one measure as a series, or a single series as the one measure.
function reshaped(ex, shape) {
  if (shape === "written" || !ex || typeof ex !== "object") return ex;
  if (shape === "series" && ex.measure !== undefined && ex.series === undefined) { const { measure, ...rest } = ex; return { ...rest, series: [{ measure, name: String(measure).split("/").pop() }] }; }
  if (shape === "one" && Array.isArray(ex.series) && ex.series.length === 1 && ex.series[0]?.measure !== undefined && ex.measure === undefined) { const { series, ...rest } = ex; return { ...rest, measure: series[0].measure }; }
  return null;
}

/**
 * Every way a spine page can be laid out without touching what the critique
 * binds, the page's own choices first: each form of its type under each
 * commentary placement the form offers, with a chart's finding marked by a
 * callout or by a highlight, and a bound exhibit's one measure named either
 * way a form reads it. `[{ page, form, commentary, declared }]`.
 */
function* layoutsOf(page) {
  const type = PAGE_TYPES[page.type];
  // The forms of a summary and of a statement are different pages - the deck's answer or its closing list, a sentence or a wall of
  // quotes - which the deck's structure counts apart: only the one the page declares is its layout.
  const forms = [page.form, ...(["summary", "statement"].includes(page.type) ? [] : Object.keys(type.forms).filter((form) => form !== page.form))];
  // A chart the author has drawn is tried as it stands before the completion marks a finding on it: a page written in full is its
  // own witness, with nothing of the completion's in it.
  const first = exhibitsOf(page)[0];
  const marks = first && !undrawnExhibit(first) ? ["none", "callout", "highlight", "callout-low"] : ["callout", "highlight", "callout-low", "none"];
  for (const form of forms) {
    const placements = placementsOf(page.type, form);
    for (const commentary of [...(placements.includes(page.commentary) ? [page.commentary] : []), ...placements.filter((p) => p !== page.commentary)])
      for (const shape of ["written", "series", "one"]) for (const mark of marks) {
        const declared = form === page.form && commentary === page.commentary;
        let candidate = declared ? structuredClone(page) : inLayout(page, form, commentary);
        if (shape !== "written") {
          const turned = exhibitsOf(candidate).map((ex) => reshaped(ex, shape));
          if (!turned.some((ex, i) => ex && ex !== exhibitsOf(candidate)[i])) continue;
          candidate = { ...candidate, ...(candidate.exhibit ? { exhibit: turned[0] ?? candidate.exhibit } : {}), ...(Array.isArray(candidate.exhibits) ? { exhibits: candidate.exhibits.map((ex) => reshaped(ex, shape) ?? ex) } : {}) };
        }
        yield { page: candidate, form, commentary, declared: declared && shape === "written", mark };
      }
  }
}
// The copy a placement holds is that placement's: a page tried under another placement does not carry points into a rail's page.
const isPlacementCopy = (key, from, to) => from !== to && ((key === "rail" && to !== "rail") || (key === "bar" && to !== "so-what-bar") || (key === "points" && !["beside", "beside-left", "below"].includes(to)));

/**
 * `page` read in another form and commentary placement of its type: its
 * content as written (page-types.mjs withChoice), less the copy that belongs to
 * the placement it leaves and the accent that marked a phrase of it. How the witness tries a layout the page does not
 * declare, and how a plan reads a page in the layout it proposes for it.
 */
export function inLayout(page, form, commentary) {
  const out = withChoice(page, form, commentary);
  const left = ["points", "rail", "bar", "paragraphs"].filter((key) => out[key] !== undefined && isPlacementCopy(key, page.commentary, commentary));
  for (const key of left) delete out[key];
  // An accent is a phrase of the copy the page draws: with that copy left behind, it marks nothing here.
  if (left.length) delete out.highlight;
  return out;
}

/**
 * What naming a type would have the critic told of each exhibit of `page` that
 * is written by reference and has no `type`, a clause an exhibit: the chart its
 * measures' axis takes, and the classes it can choose between. Empty where no
 * untyped exhibit names a recorded measure.
 */
function untypedReadings(page, registry) {
  const rows = (Array.isArray(page?.blocks) ? page.blocks : []).map((block, at) => [block?.exhibit, `block ${at + 1}'s exhibit`]).filter(([ex]) => ex && typeof ex === "object");
  return [...exhibitsOf(page).filter((ex) => !undrawnExhibit(ex)).map((ex, at) => [ex, `exhibit ${at + 1}`]), ...rows].flatMap(([ex, what]) => {
    if (ex.type) return [];
    const named = [...(Array.isArray(ex.series) ? ex.series.flatMap((s) => [].concat(s?.measure ?? [])) : []), ...(typeof ex.measure === "string" ? [ex.measure] : []), ...refsOf(ex.basis ?? {})];
    const refs = [...new Set(named.map((ref) => String(ref).split("@")[0]))].filter((ref) => registry.has(ref));
    if (!refs.length) return [];
    const kinds = new Set(refs.map((ref) => axisOf(registry.get(ref)).kind));
    const chart = kinds.has("periods") ? "`chart.line` or `chart.column`" : kinds.has("members") ? "`chart.bar`" : null;
    return [`${what} names ${refs.join(", ")}${chart ? `, over ${kinds.has("periods") ? "periods" : "members"}: ${chart} has the critic told ${refs.length === 1 ? "it is" : "they are"} plotted, \`table\` tabulated` : `, ${refs.length === 1 ? "a single value" : "single values"}: \`stat-list\` has the critic told ${refs.length === 1 ? "it is" : "they are"} stated as figures, \`table\` tabulated`}`];
  });
}

const form0 = (layout, page) => layout.form === page.form && layout.commentary === page.commentary;
const BOUND = "The storyline critique is bound to the page's type and to what it shows of each measure - which periods or members, and whether plotted, tabulated or stated as a figure - so settle it now: mended after the critique is ready, it sends the page back for another pass";
const reasonOf = (message, id) => unmarked(String(message ?? "")).replace(/^(?:Cannot render )?[^:\s]+:[^:]*\([^)]*\):\s*/, "").replace(`${id}: `, "").replace(/[.\s]*$/, "");

/**
 * The witness of every page of a spine: `{ doc, pages }`. `doc` is the
 * document with each typed page completed - in its own form and commentary
 * placement where the compile takes it so, otherwise in the layout of its type
 * that holds it - which the full compile then compiles; `pages` maps a page id
 * to `{ filled, form, commentary, witness, moved, refusal, code, stage }`:
 * what the completion wrote, the layout the witness took, the witness's own
 * completed page where that is not the one in `doc` (`witness`: the page
 * compiles as declared and composes only in another layout), why the
 * declared layout was passed over (`moved`), or the refusal where no layout
 * of the page's type holds what the spine declares.
 *
 * `compileOne(page)` is the full compile of one page in this deck's context -
 * `{ slide, refusal, stage, unbound }` - and `composes(slide)` composes one
 * compiled slide alone under the deck's settings, returning the composer's
 * refusal or null (left out, a witness is proven to compile and not to
 * compose). `shownOf(page)` reads what a page as written already shows by
 * reference, and `kindsOf(page)` gives the kind the deck's plan gives each of
 * its untyped stubs, by place (a `Map`, or null).
 */
export function proveSpine(doc, { registry, exampleOf, compileOne, composes = null, shownOf, kindsOf = () => null }) {
  const pages = new Map();
  const complete = (list, offset) => (Array.isArray(list) ? list : []).map((page, i) => {
    if (!page || typeof page !== "object" || !page.type || !PAGE_TYPES[page.type] || page.carry === true) return page;
    const index = offset + i, id = String(page.id ?? `page-${index + 1}`), type = PAGE_TYPES[page.type];
    // A form or a placement the type does not offer is the spine's own refusal, made by the compile on the page as written.
    if (!Object.hasOwn(type.forms, page.form ?? "") || !placementsOf(page.type, page.form).includes(page.commentary)) return page;
    const read = shownOf(page);
    if (read.unbound) return page;
    let first = null, asDeclared = null, taken = null;
    for (const layout of layoutsOf(page)) {
      let refusal = null, stage = null, done = null, compiled = null, directed = false;
      try {
        done = completePage(layout.page, { example: exampleOf(page.type, layout.form), registry, shown: read.shown, labels: read.labels, mark: layout.mark, kinds: kindsOf(page) });
        if (done.why) { refusal = done.why; stage = "undetermined"; directed = done.directed === true; }
      } catch (error) { refusal = `the page could not be completed for the draft (${error.message})`; stage = "undetermined"; }
      if (!refusal) {
        compiled = compileOne(done.page, index);
        refusal = compiled.refusal;
        stage = compiled.unbound && done.filled.exhibits.some((slot) => slot.written) ? "undetermined" : compiled.stage ?? (compiled.refusal ? "spine" : null);
        // The page compiles as it is declared: that compile is the slide a draft reports, whichever layout its witness then takes.
        if (!refusal && layout.declared && !asDeclared) asDeclared = { ...layout, done };
      }
      if (!refusal && composes) { const composed = composes(unmarked(compiled.slide)); if (composed) { refusal = composed; stage = "compose"; } }
      // What is said of the declared layout is the refusal it makes with a finding marked on its chart: the first try of a chart the
      // author drew is the chart bare, which a type that asks for a mark refuses whatever else holds.
      if (form0(layout, page) && refusal && (!first || first.bare)) first = { refusal, stage, directed, bare: layout.mark === "none" };
      if (!refusal) { taken = { ...layout, done }; break; }
      // A refusal of the spine's own rules - the title, the claim, what settles it - is made of the page whatever its layout.
      if (stage === "spine") break;
    }
    if (taken) {
      const reported = asDeclared ?? taken, apart = reported.done.page !== taken.done.page;
      pages.set(id, { filled: withFormTypes(reported.page, reported.done.filled), form: taken.form, commentary: taken.commentary, ...(apart ? { witness: taken.done.page } : {}),
        // Moved: the witness stands in another form or placement than the page declares. One that stands as declared, with its
        // finding marked another way than the first tried, has not moved.
        ...(first?.refusal && (taken.form !== page.form || taken.commentary !== page.commentary) ? { moved: { form: page.form, commentary: page.commentary, to: `${taken.form}/${taken.commentary}`, why: reasonOf(first.refusal, id), stage: first.stage } } : {}) });
      return reported.done.page;
    }
    const forms = Object.keys(type.forms), why = reasonOf(first?.refusal, id), drawn = exhibitsOf(page).filter((ex) => !undrawnExhibit(ex)).length;
    const said = { spine: `${id}: ${why}`,
      undetermined: `${id}: what the spine declares the page shows cannot be written into a ${page.type} page - ${why}. No other form or commentary placement of the type holds it either (${forms.length} form${forms.length === 1 ? "" : "s"} tried). ${BOUND}${first?.directed ? "" : `. Declare a view the type can show (\`labels\`, \`members\` or \`as\` in the exhibit's \`basis\`), write the exhibit by reference now (\`--scaffold ${page.type} --evidence <insight id> --id ${id}\` prints one), or choose the page type this evidence carries (\`--types\`)`}`,
      // An exhibit with no `type` has no class: the critic could be told its measures are plotted, tabulated or stated as
      // figures, and whichever type the layout then gave it would be the one the critique had not read.
      shape: `${id}: ${why}. ${/\bno `type`|exhibit's `type`/.test(why) ? `The type is what tells the critic whether the exhibit's measures are plotted, tabulated or stated as figures, so an untyped exhibit would be read one way and laid out another${untypedReadings(page, registry).length ? ` (${untypedReadings(page, registry).join("; ")})` : ""}. ` : ""}The full compile refuses the page for this, and no other form or commentary placement of a ${page.type} page takes it as declared. ${BOUND}`,
      compose: `${id}: ${why}. The page as the spine draws it does not compose under any form or commentary placement of a ${page.type} page (${forms.length} form${forms.length === 1 ? "" : "s"} tried, with the least copy each takes). Mend what the composer names; where that is which periods, members or measures an exhibit shows, the storyline critique is bound to it, so it is settled here and not after the critique is ready` };
    pages.set(id, { stage: first?.stage ?? null, code: ["shape", "spine", "copy", "layout"].includes(first?.stage) ? "COMPILE" : first?.stage === "undetermined" ? "SPINE_UNDETERMINED" : "SPINE_UNDRAWABLE",
      refusal: said[first?.stage] ?? (["copy", "layout"].includes(first?.stage)
        ? `${id}: ${why}. No form or commentary placement of a ${page.type} page takes the page as it is written, so the full compile refuses it`
        : `${id}: ${why}. No form of a ${page.type} page holds the exhibit${drawn === 1 ? "" : "s"} the spine draws here (${forms.length === 1 ? `its one form, ${forms[0]}, refuses` : `all ${forms.length} forms refuse`} ${drawn === 1 ? "it" : "them"}, whatever the marks and the commentary). ${BOUND}: the page type this evidence carries (\`--types\`), or a view of the measure this type holds (\`select\` on the bound exhibit, or other measures)`) });
    return page;
  });
  const completed = complete(doc.pages, 0), appendix = Array.isArray(doc.appendix) ? complete(doc.appendix, completed.length) : undefined;
  return { doc: { ...doc, pages: completed, ...(appendix ? { appendix } : {}) }, pages };
}

/**
 * The finding for a page whose spine and witness the critique would read
 * differently (`before` and `after`, each a page of storyline.mjs
 * storyStructure): what differs, in words, and what to declare.
 */
export function undeterminedFinding(id, before, after, { viewWords = (view) => JSON.stringify(view) } = {}) {
  const differs = [];
  const refs = [...new Set([...Object.keys(before.views ?? {}), ...Object.keys(after.views ?? {})])];
  for (const ref of refs) {
    const a = before.views?.[ref] ?? [], b = after.views?.[ref] ?? [];
    if (JSON.stringify(a) !== JSON.stringify(b)) differs.push(`${ref}: the critic would be told ${a.length ? a.map((view) => viewWords(ref, JSON.parse(view))).join("; and ") : "nothing of it"}, and the page laid out as the spine declares shows it ${b.length ? b.map((view) => viewWords(ref, JSON.parse(view))).join("; and ") : "nowhere"}`);
  }
  const shows = (after.shows ?? []).filter((entry) => !(before.shows ?? []).includes(entry));
  if (shows.length) differs.push(`laid out, the page shows ${shows.join(", ")}, which the spine does not declare`);
  if (JSON.stringify(before.drawn ?? []) !== JSON.stringify(after.drawn ?? [])) differs.push(`its exhibit${(after.drawn ?? []).length === 1 ? "" : "s"} will draw numbers that name no recorded measure, which the critique is bound to as numbers and has not been shown: draw ${(after.drawn ?? []).length === 1 ? "it" : "them"} at the spine`);
  if (!differs.length) differs.push("the page laid out reads differently from its spine");
  return { code: registered(SPINE_WITNESS_CODES, "SPINE_UNDETERMINED"), id, severity: "blocker", measured: { before: before.views ?? null, after: after.views ?? null },
    repair: `${id}: the spine leaves what this page shows to the layout - ${differs.join("; ")}. ${BOUND}. Say it in the spine: the exhibit written by reference (\`series: [{ measure }]\` with \`select\`, a table of \`{{<insight id>/<measure>@<period or member>}}\` tokens, a figure's \`measure\`), or the view in its \`basis\` (\`as\`: "chart", "table" or "figure"; \`labels\` or \`members\`)` };
}
