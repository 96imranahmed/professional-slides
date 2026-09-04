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
  plan.items.forEach((item, index) => validateItem(item, `${plan.id}.items[${index}]`));
  const budget = plan.density === "appendix" ? 130 : plan.density === "pre-read" ? 85 : plan.density === "live-pitch" ? 30 : 55;
  const countedWords = words(plan.title).length + countWords(plan.items.map((item) => item.props || {}));
  if (countedWords > budget) throw new Error(`${plan.id} has ${countedWords} counted words; ${plan.density || "executive"} permits ${budget}`);
  if (plan.provenanceRequired && !plan.source) throw new Error(`${plan.id} requires a source`);
  return { countedWords, budget };
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
      heading: item.heading || null,
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
    spec: { id: plan.id, chrome: { title: plan.title, titleVariant, source: plan.source, note: plan.note, companyName: plan.companyName, pageNumber: plan.pageNumber, pageTemplate: plan.pageTemplate }, composition: body },
    decision: {
      titleVariant,
      layout: layoutKind(plan, plan.items),
      content,
      itemJobs: plan.items.map((item) => ({ id: item.id, job: item.job, component: item.component || "section" }))
    }
  };
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
