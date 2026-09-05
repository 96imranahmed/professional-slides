import {
  absolute,
  assertSectionHeadingProps,
  compileDeck,
  component as componentNode,
  flow,
  grid,
  overlay,
  resolveTitleVariant,
  section,
  token
} from "./core.mjs";
import { REGISTRY } from "./registry.mjs";

const GENERIC_LABELS = new Set([
  "action", "analysis", "answer", "calculation boundary", "company definition",
  "current snapshot", "decision", "decision gate", "evidence", "implication",
  "insight", "interpretation", "key insight", "key takeaway", "operating proof",
  "priority area", "read-through", "recommendation", "section heading", "synthesis",
  "takeaway", "what holds back a buy", "what it means", "what the quarter supports"
]);

const words = (value) => String(value || "").trim().split(/\s+/).filter(Boolean);
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

function capacityRequirement(item, path, reasons) {
  let required = "live-pitch";
  const props = item.props || {};
  if (item.component === "insight-tree-table") {
    const branches = Array.isArray(props.branches) ? props.branches.length : 0;
    const leaves = Array.isArray(props.branches) ? props.branches.reduce((count, branch) => count + (Array.isArray(branch?.leaves) ? branch.leaves.length : 0), 0) : 0;
    if (branches >= 4 || leaves >= 6) {
      required = "pre-read";
      reasons.push({ path, component: item.component, measure: "hierarchy", count: Math.max(branches, leaves), required });
    }
  } else if (item.component === "table") {
    const rows = Array.isArray(props.rows) ? props.rows.length : 0;
    const columns = Array.isArray(props.columns) ? props.columns.length : 0;
    required = rows > 8 || columns > 6 ? "appendix" : rows > 5 || columns > 4 ? "pre-read" : required;
    if (required !== "live-pitch") reasons.push({ path, component: item.component, measure: rows >= columns ? "rows" : "columns", count: Math.max(rows, columns), required });
  } else if (typeof item.component === "string" && item.component.startsWith("chart.")) {
    const extent = extentOf(props);
    required = extent > 12 ? "appendix" : extent > 8 ? "pre-read" : required;
    if (required !== "live-pitch") reasons.push({ path, component: item.component, measure: "marks", count: extent, required });
  }
  for (const [index, child] of (item.items || []).entries()) required = maximumDensity(required, capacityRequirement(child, `${path}.items[${index}]`, reasons));
  return required;
}

export function resolveSlideDensity(plan) {
  const requested = plan.density ?? "executive";
  if (!DENSITY_ORDER.includes(requested)) throw new Error(`Unknown density profile: ${requested}`);
  const reasons = [];
  const required = (plan.items || []).reduce((result, item, index) => maximumDensity(result, capacityRequirement(item, `${plan.id}.items[${index}]`, reasons)), "live-pitch");
  return { requested, required, resolved: maximumDensity(requested, required), reasons };
}

function validateContentValue(value, path = "props") {
  if (typeof value === "string" && value.includes("—")) throw new Error(`${path} contains a Unicode em dash`);
  if (Array.isArray(value)) return value.forEach((item, index) => validateContentValue(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["heading", "label", "title"].includes(key) && typeof child === "string" && GENERIC_LABELS.has(child.trim().toLowerCase())) {
      throw new Error(`${path}.${key} is a redundant generic label`);
    }
    validateContentValue(child, `${path}.${key}`);
  }
}

function countWords(value) {
  if (typeof value === "string") return words(value).length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countWords(item), 0);
  if (!value || typeof value !== "object") return 0;
  return Object.values(value).reduce((sum, item) => sum + countWords(item), 0);
}

function itemAudienceCopy(item) {
  return {
    heading: item.heading,
    props: item.props || {},
    items: (item.items || []).map(itemAudienceCopy)
  };
}

function trackerAudienceCopy(tracker) {
  if (!tracker || typeof tracker !== "object") return null;
  return {
    title: tracker.title,
    parentTitle: tracker.parentTitle,
    items: (tracker.items || []).map(item => ({ id: item.id, label: item.label }))
  };
}

function validateItem(item, path) {
  if (!item?.id) throw new Error(`${path}.id is required`);
  if (!item.job || !String(item.job).trim()) throw new Error(`${path}.job must state why the item is on the slide`);
  if (item.component && !REGISTRY.has(item.component)) throw new Error(`${path}.component is not registered: ${item.component}`);
  if (!item.component && !item.items) throw new Error(`${path} needs a component or nested items`);
  if (item.items) assertSectionHeadingProps(item);
  if (["section", "section-heading", "content-rail"].includes(item.component)) assertSectionHeadingProps(item.props);
  validateContentValue({ heading: item.heading }, path);
  validateContentValue(item.props || {}, `${path}.props`);
  (item.items || []).forEach((child, index) => validateItem(child, `${path}.items[${index}]`));
}

export function validateSlidePlan(plan) {
  if (!plan?.id) throw new Error("Slide plan id is required");
  resolveTitleVariant({ variant: plan.titleVariant });
  if (!plan.title || !String(plan.title).trim()) throw new Error(`${plan.id}.title is required`);
  if (words(plan.title).length > 14) throw new Error(`${plan.id}.title exceeds 14 words`);
  if (String(plan.title).includes("—")) throw new Error(`${plan.id}.title contains a Unicode em dash`);
  if (!Array.isArray(plan.items) || plan.items.length === 0) throw new Error(`${plan.id}.items must contain at least one content item`);
  if (plan.template !== undefined) {
    const reference = plan.template;
    if (!reference || typeof reference !== "object" || Array.isArray(reference) || typeof reference.id !== "string" || !reference.id.trim()
      || !Number.isInteger(reference.index) || !Number.isInteger(reference.total) || reference.index < 1 || reference.total < 2 || reference.index > reference.total
      || Object.keys(reference).some(key => !["id", "index", "total"].includes(key))) {
      throw new Error(`${plan.id}.template requires id, index and total for a repeated sequence`);
    }
  }
  plan.items.forEach((item, index) => validateItem(item, `${plan.id}.items[${index}]`));
  const density = resolveSlideDensity(plan);
  const defaultBudget = density.resolved === "appendix" ? 130 : density.resolved === "pre-read" ? 85 : density.resolved === "live-pitch" ? 30 : 55;
  const override = plan.copyBudget;
  if (override !== undefined && (!override || typeof override !== "object" || Array.isArray(override)
    || Object.keys(override).some(key => !["maxWordsPerSlide", "rationale"].includes(key))
    || !Number.isInteger(override.maxWordsPerSlide) || override.maxWordsPerSlide <= 0
    || typeof override.rationale !== "string" || !override.rationale.trim())) {
    throw new Error(`${plan.id}.copyBudget requires a positive integer maxWordsPerSlide and a nonempty rationale`);
  }
  const budget = override?.maxWordsPerSlide ?? defaultBudget;
  const countedWords = countWords({
    title: plan.title,
    subtitle: plan.subtitle,
    source: plan.source,
    note: plan.note,
    notes: plan.notes,
    companyName: plan.companyName,
    tracker: trackerAudienceCopy(plan.tracker),
    items: plan.items.map(itemAudienceCopy)
  });
  if (countedWords > budget) throw new Error(`${plan.id} has ${countedWords} counted words; ${density.resolved} permits ${budget}`);
  if (plan.provenanceRequired && !plan.source) throw new Error(`${plan.id} requires a source`);
  return { countedWords, budget, density, ...(override ? { defaultBudget, overrideRationale: override.rationale } : {}) };
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
  const size = item.size || { width: { fr: item.weight || 1 }, height: "fill" };
  if (item.items) {
    const nestedPlan = { id: item.id, layout: item.layout || "auto" };
    const nested = makeComposition(nestedPlan, item.items);
    return section({
      id: item.id,
      treatment: item.treatment || "open",
      edge: item.edge || "contained",
      heading: item.heading || null,
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

function makeComposition(plan, items) {
  const kind = layoutKind(plan, items);
  if (kind === "absolute") return absolute({ id: `${plan.id}-absolute`, children: items.map((item, index) => makeItem(item, index)) });
  if (kind === "overlay") return overlay({ id: `${plan.id}-overlay`, children: items.map((item, index) => makeItem(item, index)) });
  if (kind === "flow.row" || kind === "flow.column") {
    return flow({
      id: `${plan.id}-${kind.replace(".", "-")}`,
      direction: kind.endsWith("row") ? "row" : "column",
      gap: token("space.4"),
      children: items.map((item, index) => makeItem(item, index))
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

export function planSlide(plan) {
  const content = validateSlidePlan(plan);
  const titleVariant = resolveTitleVariant({ variant: plan.titleVariant });
  const body = makeComposition(plan, plan.items);
  return {
    spec: { id: plan.id, notes: plan.notes || "", density: content.density.resolved, ...(plan.template ? { template: plan.template } : {}), chrome: { title: plan.title, titleVariant, tracker: plan.tracker, source: plan.source, note: plan.note, companyName: plan.companyName, pageNumber: plan.pageNumber, pageTemplate: plan.pageTemplate }, composition: body },
    decision: {
      titleVariant,
      density: content.density,
      tracker: plan.tracker ?? null,
      layout: layoutKind(plan, plan.items),
      template: plan.template ?? null,
      content,
      itemJobs: plan.items.map((item) => ({ id: item.id, job: item.job, component: item.component || "section" }))
    }
  };
}

const TEMPLATE_INSTANCE_KEYS = new Set(["id", "title", "notes", "source", "note", "companyName", "pageNumber", "tracker", "copyBudget", "itemContent"]);

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

export function planDeck(deckPlan, registry = REGISTRY) {
  if (!deckPlan?.id || !Array.isArray(deckPlan.slides)) throw new Error("Deck plan requires id and slides");
  const defaultTitleVariant = resolveTitleVariant({ variant: deckPlan.titleVariant });
  const planned = deckPlan.slides.map((slide) => planSlide({ ...slide, titleVariant: slide.titleVariant === undefined ? defaultTitleVariant : slide.titleVariant }));
  return {
    deck: compileDeck({ id: deckPlan.id, palette: deckPlan.palette, typography: deckPlan.typography, pageTemplate: deckPlan.pageTemplate, slides: planned.map((item) => item.spec) }, registry),
    decisions: planned.map((item) => item.decision)
  };
}
