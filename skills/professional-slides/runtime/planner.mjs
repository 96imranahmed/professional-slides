import {
  SLIDE,
  TOKENS,
  absolute,
  assertSectionHeadingProps,
  compileDeck,
  mapAll,
  component as componentNode,
  flow,
  grid,
  isTokenReference,
  normalizeInsets,
  overlay,
  resolveTitleVariant,
  section,
  token
} from "./core.mjs";
import { REGISTRY } from "./registry.mjs";

const DENSITY_ORDER = Object.freeze(["live-pitch", "executive", "pre-read", "appendix"]);

function maximumDensity(left, right) {
  return DENSITY_ORDER[Math.max(DENSITY_ORDER.indexOf(left), DENSITY_ORDER.indexOf(right))];
}

function extentOf(props = {}) {
  const seriesMarks = Array.isArray(props.series)
    ? props.series.reduce((count, series) => count + (Array.isArray(series?.values) ? series.values.length : 0), 0)
    : 0;
  return Math.max(
    Array.isArray(props.categories) ? props.categories.length : 0,
    Array.isArray(props.labels) ? props.labels.length : 0,
    Array.isArray(props.values) ? props.values.length : 0,
    Array.isArray(props.horizons) ? props.horizons.length : 0,
    Array.isArray(props.points) ? props.points.length : 0,
    seriesMarks
  );
}

function capacityRecommendation(item, path, reasons) {
  let recommended = "executive";
  const props = item.props || {};
  if (item.component === "insight-tree-table") {
    const branches = Array.isArray(props.branches) ? props.branches.length : 0;
    const leaves = Array.isArray(props.branches) ? props.branches.reduce((count, branch) => count + (Array.isArray(branch?.leaves) ? branch.leaves.length : 0), 0) : 0;
    if (branches >= 4 || leaves >= 6) {
      recommended = "pre-read";
      reasons.push({ path, component: item.component, measure: "hierarchy", count: Math.max(branches, leaves), recommended });
    }
  } else if (item.component === "table") {
    // A dense table steps its own type down (body → compact → dense) and long
    // tables paginate; it never drags the page's other type with it.
  } else if (typeof item.component === "string" && item.component.startsWith("chart.")) {
    const extent = extentOf(props);
    recommended = extent > 12 ? "appendix" : extent > 8 ? "pre-read" : recommended;
    if (recommended !== "live-pitch") reasons.push({ path, component: item.component, measure: "marks", count: extent, recommended });
  }
  for (const [index, child] of (item.items || []).entries()) recommended = maximumDensity(recommended, capacityRecommendation(child, `${path}.items[${index}]`, reasons));
  return recommended;
}

export function resolveSlideDensity(plan) {
  const requested = plan.density ?? "executive";
  if (!DENSITY_ORDER.includes(requested)) throw new Error(`Unknown density profile: ${requested}`);
  const reasons = [];
  const recommended = (plan.items || []).reduce((result, item, index) => maximumDensity(result, capacityRecommendation(item, `${plan.id}.items[${index}]`, reasons)), "executive");
  // An explicit density is the author's; otherwise the denser of default and recommendation.
  const explicit = plan.density !== undefined;
  return { requested, recommended, resolved: explicit ? requested : maximumDensity(requested, recommended), selection: explicit ? "explicit" : "capacity-default", reasons };
}

function validateItem(item, path, registry) {
  if (!item?.id) throw new Error(`${path}.id is required`);
  if (item.component && !registry.has(item.component)) throw new Error(`${path}.component is not registered: ${item.component}`);
  if ((!item.component && (!Array.isArray(item.items) || !item.items.length)) || (item.items !== undefined && (!Array.isArray(item.items) || !item.items.length))) throw new Error(`${path} needs a component or nested items`);
  if (item.items) assertSectionHeadingProps(item);
  if (item.heading && item.items?.length === 1) {
    const child = item.items[0];
    if (child.component?.startsWith("chart.") && String(child.props?.heading ?? "").trim()) {
      throw new Error(`${path}: a section wrapping one headed chart creates redundant heading levels; remove the section heading and let the chart own its measure, unit and rule`);
    }
  }
  if (["section", "section-heading", "content-rail"].includes(item.component)) assertSectionHeadingProps(item.props);
  const checkChange = (props) => {
    if (props.changeIntent && !(props.changeAnnotations?.length) && props.changePresentation !== 'direct-labels') throw new Error(`${path}: declared change requires a highlighted change annotation`);
    for (const chart of props.charts || []) checkChange(chart.props || chart);
  };
  checkChange(item.props || {});
  (item.items || []).forEach((child, index) => validateItem(child, `${path}.items[${index}]`, registry));
}

export function validateSlidePlan(plan, registry = REGISTRY) {
  if (!plan?.id) throw new Error("Slide plan id is required");
  resolveTitleVariant({ variant: plan.titleVariant });
  if (!plan.title || !String(plan.title).trim()) throw new Error(`${plan.id}.title is required`);
  if (!Array.isArray(plan.items) || plan.items.length === 0) throw new Error(`${plan.id}.items must contain at least one content item`);
  if (plan.template !== undefined) {
    const reference = plan.template;
    if (!reference || typeof reference !== "object" || Array.isArray(reference) || typeof reference.id !== "string" || !reference.id.trim()
      || !Number.isInteger(reference.index) || !Number.isInteger(reference.total) || reference.index < 1 || reference.total < 2 || reference.index > reference.total
      || Object.keys(reference).some(key => !["id", "index", "total"].includes(key))) {
      throw new Error(`${plan.id}.template requires id, index and total for a repeated sequence`);
    }
  }
  plan.items.forEach((item, index) => validateItem(item, `${plan.id}.items[${index}]`, registry));
  const density = resolveSlideDensity(plan);
  if (plan.provenanceRequired && !plan.source) throw new Error(`${plan.id} requires a source`);
  return { density };
}

/* --------------------------------------------------------------- row rules */

/**
 * What a section holds, leaf by leaf. A section's family is decided by its
 * contents rather than by its name: the composer's ids are its own business.
 */
function leafComponents(item, out = []) {
  if (Array.isArray(item.items)) for (const child of item.items) leafComponents(child, out);
  else if (item.component) out.push(item.component);
  return out;
}

// The components a commentary column is built from. Anything else in a section
// is evidence, and a section holding evidence is a panel.
const COMMENTARY_COMPONENTS = new Set([
  "paragraph", "bullet-list", "insight", "evidence-note", "callout", "metric",
  "connector", "source", "section-boundary", "legend", "section-heading"
]);
const isPanel = (item) => Array.isArray(item.items) && leafComponents(item).some((id) => !COMMENTARY_COMPONENTS.has(id));

/** A section's padding before the section() default fills it in. */
const rawPadding = (item) => item.padding ?? ((item.treatment || "open") === "open" ? 0 : token("space.4"));
function insetSpecs(item) {
  const raw = rawPadding(item);
  if (typeof raw === "number" || isTokenReference(raw)) return { top: raw, right: raw, bottom: raw, left: raw };
  return { top: raw.top ?? raw.y ?? 0, right: raw.right ?? raw.x ?? 0, bottom: raw.bottom ?? raw.y ?? 0, left: raw.left ?? raw.x ?? 0 };
}
// Only ever used to order two paddings against each other. The spacing tokens
// scale with the page's density, so the winner is carried as its own spec and
// never as the pixel count read here.
const paddingTop = (item) => normalizeInsets(rawPadding(item)).top;

/**
 * Panels in a row are drawn the same way and start on the same line.
 *
 * Two panels side by side are read across, so a tinted panel beside a plain one
 * says one of the two matters more - and says it by accident, because the
 * surface is what a composer reached for to tell the halves apart. Worse, the
 * surface pads its contents inward and the plain panel does not, so the tables
 * inside them start at different heights and the row stops reading across at
 * all. Both halves of that are fixed here, where the row is built.
 *
 * Peers are the sections in the row that carry evidence. A commentary rail
 * beside an exhibit is not a peer of it and keeps whatever ground the page gave
 * it (`pointsTone`), because it is read down, not across.
 *
 * Differing treatments hold only when every peer names its own: that is the
 * page deciding which side is highlighted. Where one peer names a ground and
 * another takes the default, the difference is an alternation rather than a
 * decision, and the row falls back to the open ground. Whatever the grounds,
 * the peers take one top inset, so their headings and their tables begin on one
 * line.
 */
function alignRowPanels(items) {
  const panels = items.filter(isPanel);
  if (panels.length < 2) return items;
  const named = panels.every((panel) => panel.treatment !== undefined);
  const mixed = new Set(panels.map((panel) => panel.treatment || "open")).size > 1;
  let resolved = mixed && !named ? panels.map((panel) => ({ ...panel, treatment: "open" })) : panels;
  const tallest = resolved.reduce((deepest, panel) => (paddingTop(panel) > paddingTop(deepest) ? panel : deepest));
  const top = insetSpecs(tallest).top;
  resolved = resolved.map((panel) => (paddingTop(panel) === paddingTop(tallest) ? panel : { ...panel, padding: { ...insetSpecs(panel), top } }));
  const aligned = new Map(panels.map((panel, index) => [panel, resolved[index]]));
  return items.map((item) => aligned.get(item) ?? item);
}

/**
 * A row whose every column is a section holding nothing but prose: the shape
 * the composer builds when a page's commentary goes under its exhibit rather
 * than beside it. A bare pair of paragraphs in a row is a label and its body
 * (the `rows` exhibit), which is one point read across, not three read down.
 */
const isProseRow = (items) => items.length >= 2 && items.every((item) => {
  const leaves = leafComponents(item);
  return Array.isArray(item.items) && leaves.length > 0 && leaves.every((id) => id === "paragraph");
});

// About one line of a column in a three-up under a full-width exhibit (360px of
// 14px Arial), and the widest a column may be before it reads as a sentence
// rather than as one of three parallel answers.
const PARALLEL_LINE = 64;
// A one-word column beside a full line is not a set, however short both are.
const PARALLEL_RATIO = 3;

/**
 * Three columns across the foot of a page say: here are three parallel answers
 * to one question. Three sentences that happen to number three say no such
 * thing, and setting them in columns claims a structure the writing has not
 * got - "the series ran from 1992 to 1995" beside "interpretation: the format
 * offers repeated encounters" is a list, drawn as a comparison.
 *
 * So the columns must be built the same way. Either every one carries its own
 * lead - the lead becomes the column's heading, and three headings are three
 * parallel answers - or none does and every column is a short phrase of
 * comparable length: at most a line, and none more than three times another.
 * Anything else stacks as ordinary points, which is what it is.
 */
function parallelProse(items) {
  const headed = items.filter((item) => item.heading).length;
  if (headed === items.length) return true;
  if (headed) return false;
  const lengths = items.map((item) => leafText(item).length);
  if (Math.max(...lengths) > PARALLEL_LINE) return false;
  return Math.max(...lengths) <= Math.min(...lengths) * PARALLEL_RATIO;
}

function leafText(item, out = []) {
  if (Array.isArray(item.items)) for (const child of item.items) leafText(child, out);
  else if (typeof item.props?.text === "string") out.push(item.props.text);
  return out.join(" ");
}

function layoutKind(plan, items) {
  if (plan.layout && plan.layout !== "auto") return plan.layout;
  if (items.some((item) => item.frame)) return "absolute";
  if (items.some((item) => item.relationship === "layer")) return "overlay";
  if (items.every((item) => item.relationship === "sequence")) return "flow.row";
  if (items.length === 1) return "flow.column";
  if (items.length <= 3) return "flow.row";
  return "grid";
}

function makeItem(item, index, cell = null) {
  const size = item.size || { width: { fr: item.weight || 1 }, height: (["paragraph", "insight", "evidence-note", "callout", "table"].includes(item.component) || item.component === "bullet-list" && item.props?.variant === "body") ? "hug" : "fill" };
  if (item.items) {
    const nestedPlan = { id: item.id, layout: item.layout || "auto", gap: item.gap, leftover: item.leftover, textFlow: item.textFlow };
    const nested = makeComposition(nestedPlan, item.items);
    return section({
      id: item.id,
      treatment: item.treatment || "open",
      edge: item.edge || "contained",
      heading: item.heading || null,
      headingRule: item.headingRule,
      padding: item.padding,
      composition: nested,
      size,
      cell,
      frame: item.frame || null
    });
  }
  return componentNode({
    id: item.id,
    component: item.component,
    props: item.props || {},
    size,
    cell,
    frame: item.frame || null,
    role: item.role || item.job
  });
}

function makeComposition(plan, items, { root = false } = {}) {
  const kind = layoutKind(plan, items);
  if (plan.gap !== undefined && (typeof plan.gap !== "string" || !plan.gap.startsWith("space.") || !Object.hasOwn(TOKENS, plan.gap))) throw new Error(`${plan.id}.gap must name a canonical spacing token`);
  if (plan.gap !== undefined && !["flow.row", "flow.column"].includes(kind)) throw new Error(`${plan.id}.gap is supported only for row and column flows`);
  if (kind === "absolute") return absolute({ id: `${plan.id}-absolute`, children: items.map((item, index) => makeItem(item, index)) });
  if (kind === "overlay") return overlay({ id: `${plan.id}-overlay`, children: items.map((item, index) => makeItem(item, index)) });
  if (kind === "flow.row" || kind === "flow.column") {
    let direction = kind.endsWith("row") ? "row" : "column";
    let children = items;
    if (direction === "row") {
      children = alignRowPanels(children);
      // A row of prose that is not parallel is a list, and a list reads down -
      // unless it is one text set in columns, which reads down the first column
      // and on into the next. A document page says so; reflowing its columns
      // into one stack is what left report prose in a single narrow band.
      if (plan.textFlow !== "columns" && isProseRow(children) && !parallelProse(children)) {
        // It reads down - in two columns, not one. Stacked, each paragraph
        // stopped at the 80-character measure and the list filled the left half
        // of a full-width band under the exhibit with nothing to its right,
        // which is most of what made an editorial deck look unfinished. Two
        // columns reading down and across keep the measure and fill the width.
        const hug = (item) => ({ ...item, size: { width: { fr: 1 }, height: "hug" } });
        if (children.length >= 2) {
          const half = Math.ceil(children.length / 2);
          children = [children.slice(0, half), children.slice(half)].map((part, k) => ({
            id: `${plan.id}-reading-${k}`, layout: "flow.column", gap: plan.gap, size: { width: { fr: 1 }, height: "hug" }, items: part.map(hug) }));
        } else {
          direction = "column";
          children = children.map(hug);
        }
      }
    }
    // A slide body whose blocks all hug their content claims less than the frame.
    // Without a policy the remainder is abandoned below the last block, which is
    // what produces a dead band across the lower third of the page.
    const bodyColumn = root && direction === "column";
    return flow({
      id: `${plan.id}-flow-${direction}`,
      direction,
      gap: token(plan.gap ?? "space.4"),
      leftover: plan.leftover ?? (bodyColumn ? "distribute" : "start"),
      children: children.map((item, index) => makeItem(item, index))
    });
  }
  if (kind === "section-split-50-50") {
    if (items.length !== 2 || items.some(item => !Array.isArray(item.items) || !item.items.length)) throw new Error(`${plan.id}.section-split-50-50 requires exactly two populated section items`);
    return flow({
      id: `${plan.id}-section-split-50-50`,
      direction: "row",
      gap: 0,
      children: items.map((item, index) => makeItem({
        ...item,
        treatment: item.treatment ?? (index ? "muted" : "open"),
        edge: "full-bleed",
        size: { width: { fr: 1 }, height: "fill" }
      }, index))
    });
  }
  if (kind === "grid") {
    const columns = Math.min(3, Math.ceil(Math.sqrt(items.length)));
    const rows = Math.ceil(items.length / columns);
    return grid({
      id: `${plan.id}-grid`,
      columns: Array.from({ length: columns }, () => ({ fr: 1 })),
      rows: Array.from({ length: rows }, () => ({ fr: 1 })),
      children: items.map((item, index) => makeItem(item, index, { column: index % columns, row: Math.floor(index / columns), ...(item.cell || {}) }))
    });
  }
  throw new Error(`${plan.id}.layout is unsupported: ${kind}`);
}

function planCover(plan) {
  if (!plan?.id) throw new Error("Cover plan id is required");
  if (!plan.title || !String(plan.title).trim()) throw new Error(`${plan.id}.title is required`);
  if (String(plan.title).includes("—") || String(plan.subtitle || "").includes("—")) throw new Error(`${plan.id} contains a Unicode em dash`);
  if (plan.items !== undefined || plan.chrome !== undefined || plan.source !== undefined || plan.note !== undefined || plan.tracker !== undefined) {
    throw new Error(`${plan.id} cover content belongs in title, subtitle, date and logo only`);
  }
  // Dark is the default cover; a sourced image makes it half-image.
  const variant = plan.variant ?? (plan.image ? "half-image" : "dark");
  const spec = {
    id: plan.id,
    density: plan.density ?? "executive",
    frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
    composition: absolute({ id: `${plan.id}-cover`, children: [componentNode({ id: "cover", component: "cover", props: { title: plan.title, ...(plan.subtitle ? { subtitle: plan.subtitle } : {}), ...(plan.date ? { date: plan.date } : {}), ...(plan.logo ? { logo: plan.logo } : {}), variant, ...(plan.image ? {image:plan.image} : {}), ...(plan.image && plan.tone ? { tone: plan.tone } : {}) }, frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height }, role: "cover" })] })
  };
  return { spec, decision: { layout: "structural", kind: "cover", density: { requested: spec.density, recommended: "live-pitch", resolved: spec.density, selection: plan.density === undefined ? "capacity-default" : "explicit", reasons: [] }, itemJobs: [{ id: "cover", job: "introduce the deck", component: "cover" }] } };
}

// A section divider is its own page: navy full bleed, section title, giant
// numeral; no chrome title, its own page furniture.
function planDivider(plan) {
  if (!plan?.id || !plan.title?.trim()) throw new Error("Divider plan requires id and title");
  const frame = { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height };
  const props = { title: plan.title, ...(plan.subtitle ? { subtitle: plan.subtitle } : {}), ...(plan.number !== undefined ? { style: "numbered", sectionId: String(plan.number) } : {}), ...(Array.isArray(plan.contents) && plan.contents.length ? { contents: plan.contents, ...(Number.isInteger(plan.contentsActive) ? { contentsActive: plan.contentsActive } : {}) } : {}), ...(plan.pageNumber !== undefined ? { pageNumber: plan.pageNumber } : {}), ...(plan.companyName ? { companyName: plan.companyName } : {}), ...(plan.image ? { image: plan.image } : {}) };
  return {
    spec: { id: plan.id, notes: plan.notes || "", density: plan.density ?? "executive", frame, composition: absolute({ id: `${plan.id}-divider`, children: [componentNode({ id: "divider", component: "section-divider", props, frame, role: "divider" })] }) },
    decision: { layout: "structural", kind: "divider", density: { requested: "executive", recommended: "live-pitch", resolved: plan.density ?? "executive", selection: "explicit", reasons: [] }, itemJobs: [{ id: "divider", job: "open the section", component: "section-divider" }] }
  };
}

function planTakeaways(plan) {
  if (!plan?.id || !Array.isArray(plan.items) || !plan.items.length) throw new Error("Takeaways plan requires id and items");
  const frame = { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height };
  const props = { ...(plan.title ? { title: plan.title } : {}), items: plan.items, ...(plan.mode ? { mode: plan.mode } : {}), ...(plan.pageNumber !== undefined ? { pageNumber: plan.pageNumber } : {}), ...(plan.companyName ? { companyName: plan.companyName } : {}), ...(plan.image ? { image: plan.image } : {}) };
  return {
    spec: { id: plan.id, notes: plan.notes || "", density: plan.density ?? "executive", frame, composition: absolute({ id: `${plan.id}-takeaways`, children: [componentNode({ id: "takeaways", component: "takeaways", props, frame, role: "takeaways" })] }) },
    decision: { layout: "structural", kind: "takeaways", density: { requested: "executive", recommended: "live-pitch", resolved: plan.density ?? "executive", selection: "explicit", reasons: [] }, itemJobs: [{ id: "takeaways", job: "close the deck", component: "takeaways" }] }
  };
}

function planStatement(plan) {
  if (!plan?.id || !plan.text?.trim()) throw new Error("Statement plan requires id and text");
  const frame = { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height };
  const props = { text: plan.text, ...(plan.accent ? { accent: plan.accent } : {}), ...(plan.subtext ? { subtext: plan.subtext } : {}), ...(plan.mode ? { mode: plan.mode } : {}), ...(plan.pageNumber !== undefined ? { pageNumber: plan.pageNumber } : {}), ...(plan.companyName ? { companyName: plan.companyName } : {}), ...(plan.image ? { image: plan.image } : {}) };
  return {
    spec: { id: plan.id, notes: plan.notes || "", density: plan.density ?? "executive", frame, composition: absolute({ id: `${plan.id}-statement`, children: [componentNode({ id: "statement", component: "statement", props, frame, role: "statement" })] }) },
    decision: { layout: "structural", kind: "statement", density: { requested: "executive", recommended: "live-pitch", resolved: plan.density ?? "executive", selection: "explicit", reasons: [] }, itemJobs: [{ id: "statement", job: "state the message", component: "statement" }] }
  };
}

function planTracker(plan, registry) {
  if (!plan?.id || !plan.title?.trim()) throw new Error("Tracker plan requires id and title");
  const props = plan.trackerPage;
  if (!props || !props.items?.some(item => item.id === props.selectedId && item.label === plan.title)) throw new Error("Tracker title must match its selected chapter label");
  if (plan.items !== undefined || plan.tracker !== undefined) throw new Error("Full tracker content belongs in trackerPage");
  validateItem({ id: "tracker", job: "orient the reader in the approved sequence", component: "tracker-page", props }, plan.id, registry);
  const frame = { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height };
  const density = plan.density ?? "pre-read";
  return {
    spec: { id: plan.id, notes: plan.notes || "", density, frame, composition: absolute({ id: `${plan.id}-tracker`, children: [
      componentNode({ id: "tracker", component: "tracker-page", props, frame, role: "tracker-page" }),
      componentNode({ id: "page", component: "page-template", props: { pageNumber: plan.pageNumber, pageTemplate: plan.pageTemplate }, frame, role: "page-furniture" })
    ] }) },
    decision: { layout: "structural", kind: "tracker", tracker: props, density: { requested: density, recommended: "live-pitch", resolved: density, selection: "explicit", reasons: [] }, itemJobs: [{ id: "tracker", job: "orient the reader in the approved sequence", component: "tracker-page" }] }
  };
}

export function planSlide(plan, registry = REGISTRY) {
  const content = validateSlidePlan(plan, registry);
  // Undefined lets the house style (a palette's style.titleRule) decide the rule.
  const titleVariant = plan.titleVariant === undefined ? undefined : resolveTitleVariant({ variant: plan.titleVariant });
  const titleDecision = titleVariant ?? "house-style";
  const body = makeComposition({...plan, gap: plan.gap ?? (["pre-read","appendix"].includes(content.density.resolved) && ["flow.row","flow.column"].includes(layoutKind(plan,plan.items)) ? "space.3" : undefined)}, plan.items, { root: true });
  return {
    spec: { id: plan.id, notes: plan.notes || "", density: content.density.resolved, ...(plan.template ? { template: plan.template } : {}), chrome: { title: plan.title, titleVariant, ...(plan.titleLead ? { titleLead: plan.titleLead } : {}), ...(plan.tag ? { tag: plan.tag } : {}), ...(plan.kicker ? { kicker: plan.kicker } : {}), ...(plan.subtitle ? { subtitle: plan.subtitle } : {}), ...(plan.subtitleRole ? { subtitleRole: plan.subtitleRole } : {}), tracker: plan.tracker, source: plan.source, note: plan.note, companyName: plan.companyName, pageNumber: plan.pageNumber, pageTemplate: plan.pageTemplate }, composition: body },
    decision: {
      titleVariant: titleDecision,
      density: content.density,
      tracker: plan.tracker ?? null,
      layout: layoutKind(plan, plan.items),
      template: plan.template ?? null,
      content,
      itemJobs: plan.items.map((item) => ({ id: item.id, job: item.job, component: item.component || "section" }))
    }
  };
}

const TEMPLATE_INSTANCE_KEYS = new Set(["id", "title", "titleLead", "tag", "kicker", "subtitle", "notes", "source", "note", "companyName", "pageNumber", "tracker", "itemContent"]);

function templateItemIndex(items, index = new Map()) {
  for (const item of items || []) {
    if (!item?.id || index.has(item.id)) throw new Error("Slide templates require unique item ids across the complete nested layout");
    index.set(item.id, item);
    templateItemIndex(item.items, index);
  }
  return index;
}

function applyTemplateContent(items, overrides, seen) {
  return (items || []).map(item => {
    const clone = structuredClone(item), override = overrides[item.id];
    if (override !== undefined) {
      if (!override || typeof override !== "object" || Array.isArray(override) || Object.keys(override).some(key => !["props", "heading"].includes(key))) throw new Error(`Template item ${item.id} accepts only props or heading content`);
      if (override.props !== undefined && (!override.props || typeof override.props !== "object" || Array.isArray(override.props))) throw new Error(`Template item ${item.id}.props must be an object`);
      if (override.heading !== undefined && (typeof override.heading !== "string" || !override.heading.trim())) throw new Error(`Template item ${item.id}.heading must be nonempty text`);
      if (override.props) clone.props = { ...(clone.props || {}), ...structuredClone(override.props) };
      if (override.heading !== undefined) clone.heading = override.heading;
      seen.add(item.id);
    }
    if (clone.items) clone.items = applyTemplateContent(clone.items, overrides, seen);
    return clone;
  });
}

export function instantiateSlideTemplate({ id, template, instances }) {
  if (typeof id !== "string" || !id.trim()) throw new Error("Slide template id is required");
  if (!template || typeof template !== "object" || Array.isArray(template) || !Array.isArray(template.items) || !template.items.length) throw new Error("Slide template requires a populated base slide plan");
  if (!Array.isArray(instances) || instances.length < 2) throw new Error("A repeated slide template requires at least two contiguous instances");
  const itemIndex = templateItemIndex(template.items);
  return instances.map((instance, position) => {
    if (!instance || typeof instance !== "object" || Array.isArray(instance) || Object.keys(instance).some(key => !TEMPLATE_INSTANCE_KEYS.has(key))) throw new Error("Template instances may change only slide copy, furniture values and declared item content");
    if (typeof instance.id !== "string" || !instance.id.trim() || typeof (instance.title ?? template.title) !== "string" || !(instance.title ?? template.title).trim()) throw new Error("Every template instance requires an id and action title");
    const overrides = instance.itemContent ?? {};
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw new Error("Template itemContent must be an object keyed by item id");
    for (const key of Object.keys(overrides)) if (!itemIndex.has(key)) throw new Error(`Unknown template item content target: ${key}`);
    const seen = new Set(), items = applyTemplateContent(template.items, overrides, seen);
    if (seen.size !== Object.keys(overrides).length) throw new Error("Not every template item content override was applied");
    const { itemContent, ...content } = instance;
    return { ...structuredClone(template), ...content, items, template: { id, index: position + 1, total: instances.length } };
  });
}

export function planDeck(deckPlan, registry = REGISTRY, {slideCache}={}) {
  if (!deckPlan?.id || !Array.isArray(deckPlan.slides)) throw new Error("Deck plan requires id and slides");
  const defaultTitleVariant = resolveTitleVariant({ variant: deckPlan.titleVariant });
  // A page that carries an argument carries a page number. `slide-chrome`
  // defaults one from the slide's position; the structural pages planned below
  // it did not, so a deck's closing takeaways and its statements sat unnumbered
  // in a numbered deck and the printed footer ran 45, 46, then nothing, then
  // 49. A divider is the exception a reader expects: a full-bleed navy page
  // with a numeral on it already says where it is.
  const planned = mapAll(deckPlan.slides, (slide, index) => slide.kind === "cover"
    ? planCover(slide)
    : slide.kind === "tracker" ? planTracker(slide, registry)
    : slide.kind === "divider" ? planDivider(slide)
    : slide.kind === "takeaways" ? planTakeaways({ pageNumber: index + 1, ...slide })
    : slide.kind === "statement" ? planStatement({ pageNumber: index + 1, ...slide })
    : planSlide({ ...slide, titleVariant: slide.titleVariant === undefined ? deckPlan.titleVariant : slide.titleVariant }, registry));
  const deck = compileDeck({ id: deckPlan.id, palette: deckPlan.palette, typography: deckPlan.typography, pageTemplate: deckPlan.pageTemplate, ...(deckPlan.chrome ? { chrome: deckPlan.chrome } : {}), ...(deckPlan.fill ? { fill: deckPlan.fill } : {}), ...(deckPlan.weight ? { weight: deckPlan.weight } : {}), slides: planned.map((item) => item.spec) }, registry, {slideCache});
  deck.slides.forEach((slide, index) => { if (deckPlan.slides[index].role) slide.role = deckPlan.slides[index].role; });
  return {deck, decisions:planned.map(item=>item.decision)};
}
