// Design systems: the page frame a deck is built in, not only its colours.
//
// A design system sets the whole frame at once, so two decks on unrelated
// subjects differ in more than their accent: canvas and typefaces, title size
// and treatment, margins, where the takeaway goes, which side the commentary
// takes, and how the cover and chapter pages are built. `identity` then takes
// the colours from the subject.
//
//   { "design": "editorial", "identity": { "primary": "#740001", "accent": "#D3A625" } }
//
// Everything resolves to things the pipeline already reads: a palette object
// (colour, `style.*`, `font.*` and `type.*` tokens), `chrome`, `tracker`, the
// cover layout, and two composition choices (`takeaway`, `commentary`).
import { channels, contrastRatio, mix } from "./color.mjs";
import { PALETTES } from "./palettes.mjs";

export const DESIGN_SYSTEMS = Object.freeze({
  consulting: {
    label: "Consulting",
    use: "Steering committees, board papers and diligence, where the reader expects the familiar analytical grammar.",
    character: "Open white canvas, sans titles top-left with no rule under them, commentary rail on the right, tinted takeaway band, dark cover and numbered chapter panels.",
    base: "midnight", colors: {},
    // No line under the title: strong decks rarely set one (a short accent bar under it, on under one page in ten). A house
    // that sets one (a reference deck, `titleRule` in the preferences) still draws it.
    style: { takeaway: "band", coverLayout: "block", dividerLayout: "panel", titleRule: "none" },
    commentary: "right", takeaway: "band", tracker: undefined, chrome: undefined, coverImage: "half", shapeBias: {}
  },
  editorial: {
    label: "Editorial",
    use: "Pre-reads, strategy narratives and essays read alone, where the argument is carried by sentences as much as by charts.",
    character: "Warm paper canvas, large regular-weight serif titles, wide margins, commentary on the left of the exhibit, the takeaway as a serif close over a hairline, typographic cover and chapter pages with no dark panels.",
    base: "midnight",
    colors: {
      "color.canvas": "#FAF7F2", "color.surfaceMuted": "#F0EBE3", "color.ink": "#221E1A", "color.textSecondary": "#5E564C",
      "color.componentPrimary": "#7A2E1E", "color.componentPrimaryTint": "#F2E4DF", "color.accent": "#9C4221", "color.accentTint": "#F6E6DC",
      "color.chartSeries1": "#7A2E1E", "color.chartSeries2": "#C07A55", "color.chartSeries3": "#3F5A66", "color.chartSeries4": "#A9B8BE", "color.chartSeries5": "#7D746A", "color.chartSeries6": "#D4CCC0",
      "color.chartComparator": "#DDD5CA", "color.chartGrid": "#E2DBD0", "color.rule": "#A39A8E",
      "font.display": "Georgia", "type.actionTitle": 26, "type.actionTitleLong": 23, "type.deckTitle": 40,
      "style.titleWeight": "regular", "style.titleRule": "none", "style.titleRuleLength": "full", "style.titleRuleColor": "rule", "style.tagPlacement": "above-title", "style.listMarker": "dash",
      "style.tableRows": "rules", "style.labelWeight": "regular", "style.chartHeading": "text"
    },
    style: { takeaway: "rule", coverLayout: "editorial", dividerLayout: "editorial" },
    commentary: "left", takeaway: "rule", tracker: "label", shapeBias: { "picture-hero": 1, text: 1 }, panelTones: { dark: "open", muted: "open", primary: "tint" },
    chrome: { left: 72, right: 72, titleTop: 48, bodyTop: 150 }, coverImage: "half"
  },
  journal: {
    label: "Data journal",
    use: "Evidence-led briefings where the charts carry the argument and the reader wants the finding and the proof, fast.",
    character: "Economist-style: a red tab over short bold sans titles with the finding as a standfirst beneath, tight margins, full-width exhibits, zebra tables, no tinted boxes; clean white chapter pages keyed by the red tab.",
    base: "evergreen",
    colors: {
      "color.canvas": "#FFFFFF", "color.surfaceMuted": "#EEF1F3", "color.ink": "#121212", "color.textSecondary": "#555A5E",
      "color.componentPrimary": "#1E4D6B", "color.componentPrimaryTint": "#E1EBF1", "color.accent": "#C8102E", "color.accentTint": "#F8DDE1",
      "color.chartSeries1": "#1E4D6B", "color.chartSeries2": "#5AA3C8", "color.chartSeries3": "#C8102E", "color.chartSeries4": "#9FBFD0", "color.chartSeries5": "#7A7F84", "color.chartSeries6": "#C8CDD1",
      "font.display": "Arial", "type.actionTitle": 22, "type.actionTitleLong": 20,
      "style.titleWeight": "bold", "style.titleRule": "tab", "style.tagPlacement": "above-title", "style.titleLead": "accent", "style.listMarker": "dot",
      "style.tableRows": "zebra", "style.labelWeight": "bold", "style.chartHeading": "text"
    },
    style: { takeaway: "rule", coverLayout: "journal", dividerLayout: "journal" },
    commentary: "right", takeaway: "standfirst", tracker: "label", shapeBias: { "exhibit-top": 2, "exhibit-full": 1, grid: 1, "metrics-over-exhibit": 1 }, panelTones: { dark: "muted", primary: "muted", tint: "muted" },
    chrome: { left: 52, right: 52, titleTop: 42, bodyTop: 132 }, coverImage: "half"
  },
  keynote: {
    label: "Keynote",
    use: "Decks presented to a room, launches and pitches, where each page has to land at a glance from the back of the room.",
    character: "Bold statement titles reversed out of a full-width colour block, large type, the takeaway as a statement with an accent bar, full-bleed picture covers and full-colour chapter pages.",
    base: "crimson",
    colors: {
      "color.canvas": "#FFFFFF", "color.ink": "#141414", "color.textSecondary": "#4F4F4F",
      "color.componentPrimary": "#2B2D6E", "color.componentPrimaryTint": "#E4E5F2", "color.accent": "#D1452B", "color.accentTint": "#FBE3DD",
      "color.chartSeries1": "#2B2D6E", "color.chartSeries2": "#D1452B", "color.chartSeries3": "#7F82C2", "color.chartSeries4": "#B9BBDD", "color.chartSeries5": "#808080", "color.chartSeries6": "#D0D0D0",
      "font.display": "Arial", "type.actionTitle": 24, "type.actionTitleLong": 22, "type.deckTitle": 44,
      "style.titleWeight": "bold", "style.titleRule": "block", "style.tagPlacement": "top-right", "style.listMarker": "dot",
      "style.tableRows": "rules", "style.labelWeight": "bold", "style.chartHeading": "text"
    },
    style: { takeaway: "statement", coverLayout: "keynote", dividerLayout: "keynote" },
    commentary: "right", takeaway: "statement", tracker: "label", shapeBias: { "hero-number": 2, "metrics-over-exhibit": 2, "split-tone": 1, "picture-hero": 1 }, panelTones: { dark: "primary", muted: "tint" },
    chrome: { left: 60, right: 60, titleTop: 40, bodyTop: 148 }, coverImage: "full"
  }
});
export const DESIGN_NAMES = Object.freeze(Object.keys(DESIGN_SYSTEMS));

// Surface treatments. Pages drawn as type on the canvas with hairlines - a
// table with an open header and no label column, white cards outlined on a
// cream page, one thin line across an empty plot, roadmap dots on a rail -
// carry a median of 0.18 of their body as ink where strong analytical decks
// carry about 0.26, at the same word count: the gap is surfaces, not words.
// `reference` is that weight and every system's default; `open` is the light
// construction, kept for a house whose own pages are drawn that way. A system
// may still take single treatments from `open` (its `surfaces` overrides).
export const SURFACES = Object.freeze({
  reference: Object.freeze({ "style.tableHeader": "band", "style.tableLabels": "tint", "style.cards": "tint", "style.marks": "reference", "style.timeline": "blocks" }),
  open: Object.freeze({ "style.tableHeader": "rule", "style.tableLabels": "plain", "style.cards": "outline", "style.marks": "light", "style.timeline": "dots" })
});
// The journal keeps its character - no tinted boxes, zebra rows carry its
// tables - and takes the rest of the reference weight.
const SYSTEM_SURFACES = Object.freeze({
  journal: { "style.tableLabels": "plain", "style.cards": "outline" }
});
export function surfaceTokens(name, set = "reference") {
  if (!Object.hasOwn(SURFACES, set)) throw new Error(`Unknown surface set: ${set}; use ${Object.keys(SURFACES).map((n) => `"${n}"`).join(", ")}`);
  return { ...SURFACES[set], ...(set === "reference" ? SYSTEM_SURFACES[name] || {} : {}) };
}

const hex = (value) => /^#[0-9A-Fa-f]{6}$/.test(String(value));
/** Darken a colour toward ink until it reads at `ratio` against `ground`. */
export function readable(color, ground, ratio = 4.5) {
  let out = color;
  for (let f = 0.08; contrastRatio(out, ground) < ratio && f <= 1; f += 0.08) out = mix(color, "#000000", f);
  return out;
}

// The colours a subject may name: its structural colour and its emphasis, then the three families a brand's pages are
// dressed in - the secondary type, the light ground its panels and bands sit on, and its hairlines.
export const IDENTITY_KEYS = Object.freeze({
  primary: "the brand's structural colour: bands, the primary marks",
  accent: "its emphasis colour: highlighted words and marks, the first chart series",
  muted: "its secondary-text colour: sub-lines, units, captions",
  tint: "its light ground: tinted panels, table label columns, callouts",
  rule: "its hairline colour: rules and gridlines",
});

const FAMILY_LEVELS = Object.freeze({ tint: 30, rule: 40, step: 18 }), MUTED_SHARE = 0.35;
const luma = (color) => channels(color).reduce((total, channel, i) => total + channel * [0.299, 0.587, 0.114][i], 0);
/** A colour laid over the canvas just far enough to sit `levels` grey levels (luma, 0-255) from it. */
const laid = (color, canvas, levels) => { const gap = Math.abs(luma(canvas) - luma(color)); return gap <= levels ? color : mix(color, canvas, 1 - levels / gap); };
/**
 * The families a brand did not name, from the colours it did: `{ tint, rule, muted }`.
 *
 * A surface is the brand's colour laid over the canvas as lightly as leaves it
 * a set number of grey levels (0-255, the luma a projector shows) under the
 * page (`laid`), so a navy and a bright blue give surfaces of one weight, each
 * in its own hue: the tint from the emphasis colour at the weight every
 * palette's filled surface carries (palettes.mjs surfaceTint, about 30 levels:
 * lighter vanishes on a projector), the hairline from the primary at the weight
 * of the house's gridline, a step heavier so it still shows across a tinted
 * panel. The secondary type is the page's ink at about two thirds strength, as
 * the palettes' own secondary greys stand to their inks, darkened where needed
 * to read at 4.5:1 on the tint, the darkest ground it is set on.
 */
function brandFamilies({ emphasis, primary, ink, canvas }) {
  const tint = laid(emphasis, canvas, FAMILY_LEVELS.tint);
  return { tint, rule: laid(primary, canvas, FAMILY_LEVELS.rule), muted: (ground) => readable(mix(ink, canvas, MUTED_SHARE), ground, 4.5) };
}

/**
 * The subject's own colours - a franchise's house colours, a brand's, a
 * country's flag - resolved onto the palette roles. The structural primary and
 * the accent are darkened until they read as text on the canvas; the raw
 * accent keeps its brightness as a chart series, where it is a mark, not type.
 *
 * The brand then dresses the whole page, not only its bands. `tint`, `muted`
 * and `rule` set the tinted surfaces, the secondary type and the hairlines; a
 * family the subject does not name is derived from the colours it does
 * (brandFamilies). Left to the base palette, those families stayed its greys
 * and its yellow callout under any brand.
 */
export function identityColors(identity, canvas = "#FFFFFF", ink = "#1F1F1F") {
  if (!identity) return {};
  if (typeof identity !== "object" || !hex(identity.primary)) throw new Error("identity.primary must be a #RRGGBB colour taken from the subject");
  for (const [name, value] of Object.entries(identity)) {
    if (!Object.hasOwn(IDENTITY_KEYS, name)) throw new Error(`identity.${name} is not a colour \`identity\` takes; it takes ${Object.keys(IDENTITY_KEYS).join(", ")}, and any single token is set in \`palette.colors\``);
    if (value !== undefined && !hex(value)) throw new Error(`identity.${name} must be a #RRGGBB colour`);
  }
  const primary = readable(identity.primary, canvas, 4.5);
  const rawAccent = identity.accent ?? mix(identity.primary, "#FFFFFF", 0.35);
  // Emphasis is the subject's own colour: its accent where it names one, made readable as the primary is, else the primary.
  // A highlighted bar or point takes it (palettes.mjs subjectOf) and its peers go quiet around it (peerOf), so series 1 can
  // be the raw accent too - then a neutral warmed by the brand, the primary paled, and the dark neutral last: with the dark
  // neutral first, every plain bar in a subject's deck was near-black (palettes.mjs leadWithColour).
  const accent = identity.accent ? readable(identity.accent, canvas, 4.5) : primary;
  const base = mix("#3A3A3A", identity.primary, 0.08);
  const derived = brandFamilies({ emphasis: accent, primary, ink, canvas });
  const tint = identity.tint ?? derived.tint, rule = identity.rule ?? derived.rule, muted = identity.muted ?? derived.muted(tint);
  // Two weights of ground, never one. The quiet ground (a zebra band, a label column) is the brand's tint; the ground that
  // marks something out (a highlighted row, a callout, a figure's panel) is the accent laid a clear step deeper. Set to one
  // colour, a highlighted row beside a zebra band read as two highlighted rows.
  const marked = laid(accent, canvas, Math.abs(luma(canvas) - luma(tint)) + FAMILY_LEVELS.step);
  return {
    "color.componentPrimary": primary, "color.componentPrimaryTint": marked,
    "color.accent": accent, "color.accentTint": marked, "color.surfaceTint": tint, "color.surfaceMuted": tint, "color.calloutTint": marked,
    "color.textSecondary": muted, "color.chartUnit": muted, "color.rule": rule, "color.chartGrid": rule,
    "color.chartSeries1": rawAccent, "color.chartSeries2": mix(base, "#FFFFFF", 0.45), "color.chartSeries3": mix(identity.primary, "#FFFFFF", 0.7),
    "color.chartSeries4": "#C9C9C9", "color.chartSeries5": "#8A8A8A", "color.chartSeries6": base
  };
}

// Run-to-run variation. The runtime is deterministic, so the same brief
// planned twice comes out with the same shapes in the same order and the same
// secondary styles. `variation` (any string or number; a new deck takes a fresh
// one) draws, once per deck and reproducibly, from choices the system allows:
// list markers, table rows, the tracker, the contents page, how lead-in points
// are marked, and which of the shapes that fit a page the deck leans toward.
// It never changes what a page says or which shapes fit it.
export const VARIATION = Object.freeze({
  "style.listMarker": ["dot", "dash"],
  "style.tableRows": ["rules", "zebra"],
  tracker: ["label", "breadcrumb", "number-strip"],
  agendaStyle: [null, "columns"],
  leadPoints: ["prose", "ruled"],
  // Shapes that only score when the page's content suits them, so a lean
  // toward one changes the layout of pages that could take either.
  leanShapes: ["exhibit-top", "metrics-over-exhibit", "hero-number", "split-tone", "two-up-contrast", "stack"]
});

export function seededRandom(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The page types each system is built from (references/design-intake.md),
 * each as the author reads it (`say`) and, where the entry names forms of the
 * catalogue or exhibit kinds, as the plan reads it: the `forms`
 * (`<type>/<form>`) and `kinds` a deck that features the entry prefers among
 * the choices that carry a page's claim equally well. An entry that names a
 * page type, a placement or a way of writing - a text page, commentary first,
 * a photograph - steers nothing the plan chooses: the type of a page is set by
 * its claim, at the spine. Few entries name a form that competes with another
 * of equal fit - a strip against a hero number, bars in cells against a heat
 * map, small multiples against six lines on one scale, a bullet against a bar
 * - so the draw's hold on a plan is small by construction: the system frames
 * the page, and the claim chooses the exhibit.
 */
export const REPERTOIRE = Object.freeze({
  consulting: [
    { say: "a table with a treatment (ratings, bars in cells, status)", forms: ["scorecard/bars", "lookup/table"] },
    { say: "metrics over their exhibit", forms: ["numbers/metric-strip"] },
    { say: "a tracker or roadmap" },
    { say: "evidence beside developed commentary" },
    { say: "matched small multiples", forms: ["trend/sparklines", "panels/grid"], kinds: ["chart.sparklines"] },
    { say: "a reconciliation (waterfall or bridge)", forms: ["bridge/waterfall"], kinds: ["chart.waterfall"] },
  ],
  editorial: [
    { say: "a text page that carries an argument" },
    { say: "a photograph beside prose" },
    { say: "a quotation page" },
    { say: "one large exhibit with commentary first" },
    { say: "a statement page between parts" },
    { say: "an annotated specimen" },
  ],
  journal: [
    { say: "a full-width annotated chart with columns beneath" },
    { say: "small multiples on one scale", forms: ["trend/sparklines", "panels/grid"], kinds: ["chart.sparklines"] },
    { say: "metrics over their exhibit", forms: ["numbers/metric-strip"] },
    { say: "a record table", forms: ["lookup/measure-table", "scorecard/heatmap"] },
    { say: "a threshold or frontier chart", forms: ["ranking/bullet", "relationship/scatter"], kinds: ["chart.bullet", "chart.scatter"] },
    { say: "a distribution with the focal case marked", forms: ["ranking/distribution", "ranking/boxplot"], kinds: ["chart.boxplot"] },
  ],
  keynote: [
    { say: "a hero number with its proof", forms: ["numbers/hero-number"] },
    { say: "metrics over their exhibit", forms: ["numbers/metric-strip"] },
    { say: "a split-tone comparison" },
    { say: "a statement page" },
    { say: "a full-bleed picture page" },
    { say: "one idea with one chart" },
  ],
});

/**
 * What a deck features from its design system's repertoire: two entries the
 * seed draws, to use where the evidence allows. `say` is the two as the author
 * reads them; `forms` and `kinds` what the plan prefers among choices of equal
 * fit (deck-structure.mjs allocateStructure). The same seed and system always
 * give the same draw.
 */
export function featuredDraw(seed, design = "consulting") {
  const entries = REPERTOIRE[Object.hasOwn(REPERTOIRE, design ?? "") ? design : "consulting"];
  // Two entries drawn each pair as likely as another (Fisher-Yates): a sort by a random comparison favours the entries listed first.
  const random = seededRandom(`${seed}:repertoire`), drawn = [...entries];
  for (let i = drawn.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [drawn[i], drawn[j]] = [drawn[j], drawn[i]]; }
  drawn.length = 2;
  return { say: drawn.map((entry) => entry.say), forms: new Set(drawn.flatMap((entry) => entry.forms ?? [])), kinds: new Set(drawn.flatMap((entry) => entry.kinds ?? [])) };
}

/** The deck's draws for a seed; the same seed always gives the same deck. */
export function variationChoices(seed) {
  const random = seededRandom(seed);
  const pick = (options) => options[Math.floor(random() * options.length)];
  const lean = [...VARIATION.leanShapes].sort(() => random() - 0.5).slice(0, 2);
  const order = [...Array(64).keys()].sort(() => random() - 0.5);
  return {
    "style.listMarker": pick(VARIATION["style.listMarker"]), "style.tableRows": pick(VARIATION["style.tableRows"]),
    tracker: pick(VARIATION.tracker), agendaStyle: pick(VARIATION.agendaStyle), leadPoints: pick(VARIATION.leadPoints),
    lean, order
  };
}

/**
 * Resolve `design` and `identity` into the settings the pipeline reads. An
 * author's own `palette` colours, `chrome` and `tracker` still win: the system
 * is the default frame, not a lock.
 */
export function applyDesign(spec) {
  if (!spec || (spec.design === undefined && spec.identity === undefined && spec.variation === undefined && spec.surfaces === undefined)) return spec;
  const name = spec.design ?? "consulting";
  if (!Object.hasOwn(DESIGN_SYSTEMS, name)) throw new Error(`Unknown design: ${name}; use ${DESIGN_NAMES.map((n) => `"${n}"`).join(", ")}`);
  const system = DESIGN_SYSTEMS[name];
  const own = spec.palette && typeof spec.palette === "object" ? spec.palette : null;
  const base = own?.base ?? (typeof spec.palette === "string" ? spec.palette : system.base);
  const styleTokens = Object.fromEntries(Object.entries(system.style).map(([key, value]) => [`style.${key}`, value]));
  const canvas = own?.colors?.["color.canvas"] ?? system.colors["color.canvas"] ?? "#FFFFFF";
  const drawn = spec.variation === undefined ? null : variationChoices(spec.variation);
  // A system that fixes a style (the journal's zebra rows, the editorial dash)
  // keeps it; the draw fills only what the system leaves open.
  const varied = drawn ? Object.fromEntries(["style.listMarker", "style.tableRows"].filter((key) => !(key in system.colors)).map((key) => [key, drawn[key]])) : {};
  // The ink the page will be set in: the author's, the system's, or the base palette's, in the order the tokens resolve.
  const ink = own?.colors?.["color.ink"] ?? system.colors["color.ink"] ?? PALETTES[base]?.colors["color.ink"];
  const colors = { ...surfaceTokens(name, spec.surfaces ?? "reference"), ...system.colors, ...varied, ...styleTokens, ...identityColors(spec.identity, canvas, ink), ...(own?.colors || {}) };
  const out = { ...spec, palette: { base, id: own?.id ?? `${name}-${spec.id ?? "deck"}`, label: own?.label ?? `${system.label}${spec.identity ? " (subject identity)" : ""}`, colors } };
  if (system.chrome && !spec.chrome) out.chrome = system.chrome;
  if (spec.tracker === undefined && drawn) out.tracker = drawn.tracker;
  else if (system.tracker !== undefined && spec.tracker === undefined) out.tracker = system.tracker;
  if (drawn && spec.agendaStyle === undefined && drawn.agendaStyle) out.agendaStyle = drawn.agendaStyle;
  if (spec.cover?.image && !spec.cover.layout && system.coverImage === "full") out.cover = { ...spec.cover, layout: "full", tone: spec.cover.tone ?? "dark" };
  const shapeBias = { ...system.shapeBias };
  out.designLayout = { name, takeaway: system.takeaway, commentary: system.commentary, shapeBias, panelTones: system.panelTones || {},
    ...(drawn ? { variation: { seed: String(spec.variation), leadPoints: drawn.leadPoints, order: drawn.order, lean: drawn.lean } } : {}) };
  return out;
}
