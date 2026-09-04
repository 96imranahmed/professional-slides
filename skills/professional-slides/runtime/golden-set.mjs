import { compileDeck } from "./core.mjs";
import { REGISTRY } from "./registry.mjs";
import { componentFixtureSpecs, componentVariantFixtureSpecs, layoutFixtureSpecs } from "./fixtures.mjs";
import { goldenFixtureSpecs } from "./golden-fixtures.mjs";

export function goldenSetSpecs() {
  return [...componentFixtureSpecs(), ...componentVariantFixtureSpecs(), ...layoutFixtureSpecs(),
    ...goldenFixtureSpecs().map(spec => ({ ...spec,
      ...(spec.chrome ? { chrome: { ...spec.chrome, titleVariant: "without-line", footerLeft: undefined, pageTemplate: {} } } : {}),
      ...(spec.id === "golden-divider" ? { composition: { ...spec.composition, children: spec.composition.children.map(node => ({ ...node, props: { ...node.props, footerRight: undefined, companyName: "Company Name", pageNumber: 12, dividerRule: false, pageTemplate: {} } })) } } : {}),
      target: spec.id, kind: "standard" }))];
}

export function auditGoldenCoverage(fixtures) {
  const required = goldenSetSpecs().map(spec => spec.id);
  const actual = fixtures.map(spec => spec.id);
  const missing = required.filter(id => !actual.includes(id));
  const extra = actual.filter(id => !required.includes(id));
  const duplicates = actual.filter((id, index) => actual.indexOf(id) !== index);
  return { accepted: !missing.length && !extra.length && !duplicates.length, missing, extra, duplicates,
    components: REGISTRY.size, variants: componentVariantFixtureSpecs().length,
    layouts: layoutFixtureSpecs().length, standards: goldenFixtureSpecs().length, slides: required.length };
}

export function buildGoldenSetDeck({ palette = "mckinsey" } = {}) {
  const specs = goldenSetSpecs();
  const deck = compileDeck({ id: `golden-${palette}`, palette, slides: specs }, REGISTRY);
  const fixtures = specs.map((spec, index) => ({ id: spec.id, target: spec.target, kind: spec.kind, ...(spec.variant ? { variant: spec.variant } : {}), slide: index + 1 }));
  return { deck, fixtures };
}
