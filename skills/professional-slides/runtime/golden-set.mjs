import { SLIDE, TOKENS, absolute, compileDeck, component, hashJson, token, tokenValue } from "./core.mjs";
import { REGISTRY } from "./registry.mjs";
import { planSlide } from "./planner.mjs";
import { componentFixtureBoardSpecs, componentVariantFixtureSpecs, layoutFixtureSpecs } from "./fixtures.mjs";
import { goldenFixtureSpecs } from "./golden-fixtures.mjs";
import { TABLE_VARIANTS } from './table-fixtures.mjs';
import { STANDARD_SLIDE_GUIDANCE, assertParentheticalTemplateCopy, guidanceNote } from './guidance.mjs';

function guidedStandard(spec) {
  const guidance = STANDARD_SLIDE_GUIDANCE[spec.id];
  if (!guidance) throw new Error(`Missing guidance for standard slide ${spec.id}`);
  return { ...spec, notes: guidanceNote(guidance) };
}

function tableInsightSpecs() {
  return ['category-bullets','bar-columns'].map(variant=>{
    const props=TABLE_VARIANTS[variant].props;
    const height=REGISTRY.get('table').measureContent({frame:{width:1160},props}).height;
    const conclusion={variant:'tonal',align:'left',text:'(Insert a complete sentence that states the decision-relevant synthesis.)'};
    return {...planSlide({id:`golden-table-insight-${variant}`,title:'(Insert action title)',layout:'absolute',density:'pre-read',copyBudget:{maxWordsPerSlide:230,rationale:'Developed table rows plus one distinct synthesis'},source:'Source: (Insert source)',items:[
      {id:'exhibit',job:'compare the evidence',component:'table',props,frame:{x:0,y:0,width:1160,height}},
      {id:'conclusion',job:'state the decision consequence',component:'insight',props:conclusion,frame:{x:0,y:height+24,width:1160,height:REGISTRY.get('insight').measureContent({frame:{width:1160},props:conclusion}).height}}
    ]}).spec,target:`golden-table-insight-${variant}`,kind:'standard'};
  });
}

function executiveSummarySpec() {
  const themes = [
    ["(Insert theme 1 conclusion)", [
      "(Insert evidence that supports theme 1.)",
      "(Insert the implication of theme 1.)",
      "(Insert a condition, risk or decision linked to theme 1.)"
    ]],
    ["(Insert theme 2 conclusion)", [
      "(Insert evidence that supports theme 2.)",
      "(Insert the implication of theme 2.)",
      "(Insert a condition, risk or decision linked to theme 2.)"
    ]],
    ["(Insert theme 3 conclusion)", [
      "(Insert evidence that supports theme 3.)",
      "(Insert the implication of theme 3.)",
      "(Insert a condition, risk or decision linked to theme 3.)"
    ]]
  ];
  const items = [], width = 1160;
  let y = 0;
  for (const [index, [heading, bullets]] of themes.entries()) {
    const headingHeight = REGISTRY.get("section-heading").measureHeader({ frame: { x: 0, y: 0, width, height: 100 }, props: { heading, rule: false } }).height;
    items.push({ id: `theme-${index}`, job: "state the theme conclusion", component: "section-heading", props: { heading, rule: false }, frame: { x: 0, y, width, height: headingHeight } });
    y += headingHeight + tokenValue(token("space.2"));
    const props = { variant: "body", items: bullets }, height = REGISTRY.get("bullet-list").measureContent({ frame: { width }, props }).height;
    items.push({ id: `bullets-${index}`, job: "develop evidence, implication and condition", component: "bullet-list", props, frame: { x: 0, y, width, height } });
    y += height + tokenValue(token("space.5"));
  }
  const props = { text: "(Insert a complete sentence that states the recommendation and the condition that would change it.)", variant: "tonal" };
  const height = REGISTRY.get("insight").measureContent({ frame: { width }, props }).height;
  items.push({ id: "conclusion", job: "state the recommendation", component: "insight", props, frame: { x: 0, y, width, height } });
  return { ...planSlide({ id: "golden-executive-summary", title: "Executive summary", density: "pre-read", copyBudget: { maxWordsPerSlide: 260, rationale: "Standalone thematic summary with nine developed bullets at the shared body size" }, layout: "absolute", source: "Source: (Insert source)", pageNumber: 2, items }).spec, target: "golden-executive-summary", kind: "standard" };
}

function trackerStandardSpecs() {
  const items = [
    { id: "A", label: "Section A" },
    { id: "B", label: "Section B" },
    { id: "C", label: "Section C" },
    { id: "D", label: "Section D" }
  ];
  const trackerId = "standard-section-map";
  const full = (id, props, pageNumber) => ({
    id, target: "tracker-page", kind: "standard", frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
    composition: absolute({ id: `${id}-root`, children: [
      component({ id: "tracker", component: "tracker-page", frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height }, props: { trackerId, items, selectedId: "B", ...props } }),
      component({ id: "page", component: "page-template", frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height }, props: { companyName: "(Insert company name)", pageNumber, pageTemplate: { rules: "none" } } })
    ] })
  });
  const content = (id, construction, pageNumber, title) => ({
    ...planSlide({
      id, title, pageNumber, source: "Source: (Insert source)",
      tracker: { trackerId, parentTitle: "Contents", items, selectedId: "B", construction, mode: "light" },
      items: [{ id: "evidence", job: "develop the section evidence", component: "paragraph", props: { text: "(Insert evidence that develops the selected section without repeating its label.)" } }]
    }).spec,
    target: "tracker-label", kind: "standard"
  });
  return [
    full("golden-tracker-sequential-progress", { title: "Contents", layout: "sequential-circles", mode: "light" }, 3),
    content("golden-tracker-number-strip-content", "compact-number-strip", 4, "(Insert action title)"),
    full("golden-tracker-split-progress", { parentTitle: "Section A", layout: "split-contents", density: "regular", mode: "light" }, 5),
    content("golden-tracker-label-content", "compact-breadcrumb", 6, "(Insert action title)")
  ];
}

// The fixture suite remains exhaustive. The human review deck is deliberately
// curated: it keeps the layouts that prove a distinct composition contract and
// leaves lower-level permutations to their component boards and unit tests.
// Template sequences stay complete and contiguous.
const GOLDEN_LAYOUT_IDS = new Set([
  "fixture-layout-use-case-grid-1",
  "fixture-layout-use-case-grid-2",
  "fixture-layout-use-case-grid-3",
  "fixture-layout-section-split-50-50",
  "fixture-layout-insight-tree-table-four-branch",
  "fixture-layout-context-panel",
  "fixture-page-template-source-and-note",
  "fixture-map-world-country-highlight",
  "fixture-chart.column-grouped-series-change",
  "fixture-chart.stacked-column-legend-top-right",
  "fixture-chart.stacked-column-total-construction",
  "fixture-chart.stacked-bar-legend-top-right",
  "fixture-chart.line-callout-borderless",
  "fixture-chart.line-orthogonal-dot-vertical",
  "fixture-chart.waterfall-end-to-end-construction",
  "fixture-chart.scatter-orthogonal-dot-horizontal",
  "fixture-chart.bubble-size-legend-top-right",
  "fixture-chart.bubble-quadrant-focus-tint",
  "fixture-chart-group-paired-columns",
  "fixture-planner-auto"
]);

function goldenLayoutFixtureSpecs() {
  const fixtures = layoutFixtureSpecs().filter(spec => GOLDEN_LAYOUT_IDS.has(spec.id));
  const missing = [...GOLDEN_LAYOUT_IDS].filter(id => !fixtures.some(spec => spec.id === id));
  if (missing.length) throw new Error(`Golden layout fixture IDs are missing: ${missing.join(", ")}`);
  return fixtures;
}

export function goldenSetSpecs() {
  const standards = [...goldenFixtureSpecs().map(spec => ({ ...spec,
      ...(spec.chrome ? { chrome: { ...spec.chrome, titleVariant: "without-line", footerLeft: undefined, pageTemplate: {} } } : {}),
      target: spec.id, kind: "standard" })), executiveSummarySpec(), ...tableInsightSpecs(), ...trackerStandardSpecs()].map(guidedStandard);
  // Put complete slide examples first, then compositions, then the isolated
  // component appendix. Within the appendix, keep each component beside its
  // non-default variants so the deck reads as a review document rather than a
  // registry dump. The base fixture already proves the registered default.
  return [...standards, ...goldenLayoutFixtureSpecs(), ...componentFixtureBoardSpecs()];
}

// Related fixtures prove different layers of one family, not competing designs.
const RELATED_FAMILIES = [
  { id: "page-shell", title: "Page template and assembled chrome", targets: ["slide-chrome", "page-template"], description: "Page template owns sources, branding, page numbers and page rules. Slide chrome composes that furniture with the shared slide title; it is not a second furniture design." },
  { id: "section-container", title: "Section container and heading", targets: ["section", "section-heading"], description: "Section owns a surface, padding and the child-content area. Section heading is its reusable heading leaf. Isolated containers are empty; the nested-section layout shows populated sections." },
  { id: "titles", title: "Title family", targets: ["action-title", "section-title"], description: "Action title and section title use one renderer at two hierarchy levels. Both offer the same with-line and without-line variants." }
];
const label = id => id.replace(/^fixture-/, "").replace(/^golden-/, "").replace(/[.-]/g, " ");
const gallerySection = fixture => fixture.kind === "standard" ? { id: "standard-slides", title: "Standard compositions" }
  : fixture.kind === "layout" ? { id: "compositions", title: "Composition and layout" }
    : REGISTRY.get(fixture.target)?.category === "chart" ? { id: "charts", title: "Charts" }
      : ["data"].includes(REGISTRY.get(fixture.target)?.category) ? { id: "data-displays", title: "Tables, legends and data displays" }
        : ["relationship"].includes(REGISTRY.get(fixture.target)?.category) ? { id: "relationships", title: "Relationships, diagrams and maps" }
          : { id: "core-components", title: "Core components and page structure" };
export function goldenGalleryGroups(fixtures) {
  const groups = new Map();
  for (const fixture of fixtures) {
    const family = fixture.kind === "standard" ? { id: "standard-slides", title: "Standard slides" }
      : RELATED_FAMILIES.find(group => group.targets.includes(fixture.target))
        ?? (fixture.kind === "layout" ? { id: "compositions", title: "Composition examples" }
          : { id: fixture.target, title: label(fixture.target) });
    const section = gallerySection(fixture);
    if (!groups.has(family.id)) groups.set(family.id, { id: family.id, title: family.title, description: family.description, section, fixtures: [] });
    const boardLabel = fixture.kind === "board" ? ` / ${fixture.coverage.map(item => item.defaultVariant ? "default" : label(item.variant)).join(", ")}` : null;
    groups.get(family.id).fixtures.push({ ...fixture, label: `${label(fixture.target)}${boardLabel ?? (fixture.defaultVariant ? " / default" : fixture.variant ? ` / ${label(fixture.variant)}` : fixture.kind === "layout" ? ` / ${label(fixture.id).replace(label(fixture.target), "").trim()}` : " / default")}` });
  }
  return [...groups.values()];
}

export function auditGoldenCoverage(fixtures, { requireSignatures = false } = {}) {
  const required = goldenSetSpecs().map(spec => spec.id);
  const actual = fixtures.map(spec => spec.id);
  const missing = required.filter(id => !actual.includes(id));
  const extra = actual.filter(id => !required.includes(id));
  const duplicates = actual.filter((id, index) => actual.indexOf(id) !== index);
  const expectedCoverage = [...REGISTRY.values()].flatMap(definition => {
    const variants = Object.keys(definition.variants || {});
    return variants.length ? variants.map(variant => `${definition.id}:${variant}`) : [`${definition.id}:default`];
  });
  const actualCoverage = fixtures.flatMap(fixture => (fixture.coverage || []).map(item => `${item.target}:${item.variant ?? "default"}`));
  const missingCoverage = expectedCoverage.filter(key => !actualCoverage.includes(key));
  const extraCoverage = actualCoverage.filter(key => !expectedCoverage.includes(key));
  const duplicateCoverage = actualCoverage.filter((key, index) => actualCoverage.indexOf(key) !== index);
  const missingVisualSignatures = [];
  const mismatchedVisualSignatures = [];
  const signatureGroups = new Map();
  for (const fixture of fixtures) for (const item of (fixture.coverage || [])) {
    if (!REGISTRY.has(item.target)) continue;
    const signature = visualVariantSignature(item.target, item.variant ?? null);
    if (requireSignatures && !item.visualSignature) missingVisualSignatures.push(`${item.target}:${item.variant}`);
    if (item.visualSignature && item.visualSignature !== signature) mismatchedVisualSignatures.push(`${item.target}:${item.variant}`);
    const key = `${item.target}:${signature}`;
    if (!signatureGroups.has(key)) signatureGroups.set(key, []);
    signatureGroups.get(key).push(item.variant ?? "default");
  }
  const duplicateVisualBranches = [...signatureGroups.entries()].filter(([, variants]) => new Set(variants).size > 1).map(([key, variants]) => ({ component: key.split(":")[0], variants }));
  const registeredVariants = [...REGISTRY.values()].reduce((count, definition) => count + Object.keys(definition.variants || {}).length, 0);
  const omittedDefaultDuplicates = [...REGISTRY.values()].filter(definition => definition.defaultVariant).length;
  return { accepted: !missing.length && !extra.length && !duplicates.length && !missingCoverage.length && !extraCoverage.length && !duplicateCoverage.length && !missingVisualSignatures.length && !mismatchedVisualSignatures.length && !duplicateVisualBranches.length, missing, extra, duplicates, missingCoverage, extraCoverage, duplicateCoverage, missingVisualSignatures, mismatchedVisualSignatures, duplicateVisualBranches,
    components: REGISTRY.size, variants: registeredVariants, variantSlides: componentVariantFixtureSpecs().length, omittedDefaultDuplicates,
    componentSlides: componentFixtureBoardSpecs().length, layouts: fixtures.filter(spec => spec.kind === "layout").length, standards: goldenSetSpecs().filter(spec => spec.kind === 'standard').length, slides: required.length };
}

function visualVariantSignature(target, variant) {
  const definition = REGISTRY.get(target);
  const variantDefinition = variant === null ? {} : definition.variants?.[variant] || {};
  const preferred = variantDefinition.preferredSize || definition.preferredSize || { width: 640, height: 360 };
  const frame = { x: 0, y: 0, width: Math.min(SLIDE.width, preferred.width || 640), height: Math.min(SLIDE.height, preferred.height || 360) };
  const props = variant === null ? definition.sample : {
    ...definition.sample,
    ...(definition.variantProp ? { [definition.variantProp]: variant } : {}),
    ...(variantDefinition.props || {})
  };
  const rendered = definition.render({ id: "visual-signature", frame, props, tokens: TOKENS });
    const visualData = data => Object.fromEntries(Object.entries(data || {}).filter(([key]) => ["geometry", "x1", "x2", "y1", "y2", "startAngle", "endAngle", "paths", "endArrow", "endArrowType", "dataUri", "circular", "bodyRatio", "caretCenterRatio", "caretWidthRatio", "cornerRadiusRatio"].includes(key)));
  return hashJson({
    nodes: (rendered.nodes || []).map(node => ({ type: node.type, role: node.role, frame: node.frame, text: node.text, style: node.style, data: visualData(node.data) })),
    placements: rendered.placements || []
  });
}

export function buildGoldenSetDeck({ palette = "mckinsey" } = {}) {
  const specs = goldenSetSpecs();
  const deck = compileDeck({ id: `golden-${palette}`, palette, slides: specs }, REGISTRY);
  assertParentheticalTemplateCopy(deck.slides);
  const fixtures = specs.map((spec, index) => ({
    id: spec.id,
    target: spec.target,
    kind: spec.kind,
    ...(spec.variant ? { variant: spec.variant } : {}),
    ...(spec.defaultVariant ? { defaultVariant: true } : {}),
    ...(spec.coverage ? { coverage: spec.coverage.map(item => ({ ...item, visualSignature: visualVariantSignature(item.target, item.variant) })) } : {}),
    slide: index + 1
  }));
  return { deck, fixtures };
}
