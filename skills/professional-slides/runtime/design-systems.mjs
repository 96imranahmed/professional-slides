// Design systems: the page frame a deck is built in, not only its colours.
//
// Two decks on unrelated subjects used to come out with the same cover, the
// same numbered chapter pages, the same title in the same place, the same
// commentary rail on the right and the same grey takeaway band at the foot of
// half their pages - only the accent differed. A design system sets all of
// that at once: canvas and typefaces, title size and treatment, margins, where
// the takeaway goes, which side the commentary takes, and how the cover and
// chapter pages are built. `identity` then takes the colours from the subject.
//
//   { "design": "editorial", "identity": { "primary": "#740001", "accent": "#D3A625" } }
//
// Everything resolves to things the pipeline already reads: a palette object
// (colour, `style.*`, `font.*` and `type.*` tokens), `chrome`, `tracker`, the
// cover layout, and two composition choices (`takeaway`, `commentary`).
import { contrastRatio } from "./palettes.mjs";

export const DESIGN_SYSTEMS = Object.freeze({
  consulting: {
    label: "Consulting",
    use: "Steering committees, board papers and diligence read against firm decks; the reader expects the house grammar.",
    character: "Open white canvas, sans titles top-left, commentary rail on the right, tinted takeaway band, dark cover and numbered chapter panels.",
    base: "mckinsey", colors: {},
    style: { takeaway: "band", coverLayout: "block", dividerLayout: "panel" },
    commentary: "right", takeaway: "band", tracker: undefined, chrome: undefined, coverImage: "half", shapeBias: {}
  },
  editorial: {
    label: "Editorial",
    use: "Pre-reads, strategy narratives and essays read alone, where the argument is carried by sentences as much as by charts.",
    character: "Warm paper canvas, large regular-weight serif titles, wide margins, commentary on the left of the exhibit, the takeaway as a serif close over a hairline, typographic cover and chapter pages with no dark panels.",
    base: "mckinsey",
    colors: {
      "color.canvas": "#FAF7F2", "color.surfaceMuted": "#F0EBE3", "color.ink": "#221E1A", "color.textSecondary": "#5E564C",
      "color.componentPrimary": "#7A2E1E", "color.componentPrimaryTint": "#F2E4DF", "color.accent": "#9C4221", "color.accentTint": "#F6E6DC",
      "color.chartSeries1": "#7A2E1E", "color.chartSeries2": "#C07A55", "color.chartSeries3": "#3F5A66", "color.chartSeries4": "#A9B8BE", "color.chartSeries5": "#7D746A", "color.chartSeries6": "#D4CCC0",
      "color.chartComparator": "#DDD5CA", "color.chartGrid": "#E2DBD0", "color.rule": "#A39A8E",
      "font.display": "Georgia", "type.actionTitle": 26, "type.actionTitleLong": 23, "type.deckTitle": 40,
      "style.titleWeight": "regular", "style.titleRule": "none", "style.tagPlacement": "above-title", "style.listMarker": "dash",
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
    base: "bcg",
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
    base: "bain",
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

const hex = (value) => /^#[0-9A-Fa-f]{6}$/.test(String(value));
const channels = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
export const mix = (a, b, f) => "#" + channels(a).map((c, i) => Math.round(c * (1 - f) + channels(b)[i] * f).toString(16).padStart(2, "0")).join("").toUpperCase();
/** Darken a colour toward ink until it reads at `ratio` against `ground`. */
export function readable(color, ground, ratio = 4.5) {
  let out = color;
  for (let f = 0.08; contrastRatio(out, ground) < ratio && f <= 1; f += 0.08) out = mix(color, "#000000", f);
  return out;
}

/**
 * The subject's own colours - a franchise's house colours, a brand's, a
 * country's flag - resolved onto the palette roles. The structural primary and
 * the accent are darkened until they read as text on the canvas; the raw
 * accent keeps its brightness as a chart series, where it is a mark, not type.
 */
export function identityColors(identity, canvas = "#FFFFFF") {
  if (!identity) return {};
  if (typeof identity !== "object" || !hex(identity.primary)) throw new Error("identity.primary must be a #RRGGBB colour taken from the subject");
  if (identity.accent !== undefined && !hex(identity.accent)) throw new Error("identity.accent must be a #RRGGBB colour");
  const primary = readable(identity.primary, canvas, 4.5);
  const rawAccent = identity.accent ?? mix(identity.primary, "#FFFFFF", 0.35);
  const accent = readable(rawAccent, canvas, 4.5);
  return {
    "color.componentPrimary": primary, "color.componentPrimaryTint": mix(primary, canvas, 0.88),
    "color.accent": accent, "color.accentTint": mix(rawAccent, canvas, 0.85),
    "color.chartSeries1": primary, "color.chartSeries2": rawAccent, "color.chartSeries3": mix(primary, "#FFFFFF", 0.45),
    "color.chartSeries4": mix(primary, "#000000", 0.35), "color.chartSeries5": "#8A8A8A", "color.chartSeries6": "#C9C9C9"
  };
}

/**
 * Resolve `design` and `identity` into the settings the pipeline reads. An
 * author's own `palette` colours, `chrome` and `tracker` still win: the system
 * is the default frame, not a lock.
 */
export function applyDesign(spec) {
  if (!spec || (spec.design === undefined && spec.identity === undefined)) return spec;
  const name = spec.design ?? "consulting";
  if (!Object.hasOwn(DESIGN_SYSTEMS, name)) throw new Error(`Unknown design: ${name}; use ${DESIGN_NAMES.map((n) => `"${n}"`).join(", ")}`);
  const system = DESIGN_SYSTEMS[name];
  const own = spec.palette && typeof spec.palette === "object" ? spec.palette : null;
  const base = own?.base ?? (typeof spec.palette === "string" ? spec.palette : system.base);
  const styleTokens = Object.fromEntries(Object.entries(system.style).map(([key, value]) => [`style.${key}`, value]));
  const canvas = own?.colors?.["color.canvas"] ?? system.colors["color.canvas"] ?? "#FFFFFF";
  const colors = { ...system.colors, ...styleTokens, ...identityColors(spec.identity, canvas), ...(own?.colors || {}) };
  const out = { ...spec, palette: { base, id: own?.id ?? `${name}-${spec.id ?? "deck"}`, label: own?.label ?? `${system.label}${spec.identity ? " (subject identity)" : ""}`, colors } };
  if (system.chrome && !spec.chrome) out.chrome = system.chrome;
  if (system.tracker !== undefined && spec.tracker === undefined) out.tracker = system.tracker;
  if (spec.cover?.image && !spec.cover.layout && system.coverImage === "full") out.cover = { ...spec.cover, layout: "full", tone: spec.cover.tone ?? "dark" };
  out.designLayout = { name, takeaway: system.takeaway, commentary: system.commentary, shapeBias: system.shapeBias, panelTones: system.panelTones || {} };
  return out;
}
