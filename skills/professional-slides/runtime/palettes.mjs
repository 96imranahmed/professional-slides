// Named, versioned presentation presets.
import { contrastRatio, mix, relativeLuminance } from "./color.mjs";

export { contrastRatio };

export const PALETTES = Object.freeze({
  midnight: {
    label: "Midnight",
    basis: "Serif display titles on an open canvas, deep navy with an electric-blue accent, dash bullets, zebra tables",
    colors: {
      "color.ink": "#051C2C", "color.textSecondary": "#4D4D4D", "color.componentPrimary": "#051C2C", "color.accent": "#2251FF", "color.accentTint": "#DCE4FF",
      "color.componentPrimaryTint": "#E6E8EA", "color.surfaceMuted": "#F0F0F0",
      "color.chartSeries1": "#051C2C", "color.chartSeries2": "#2251FF", "color.chartSeries3": "#00A9F4",
      "color.chartSeries4": "#034B6F", "color.chartSeries5": "#99C4FF", "color.chartSeries6": "#B3D9F5",
      "font.display": "Georgia",
      "style.titleWeight": "bold", "style.titleRule": "rule", "style.titleRuleLength": "content", "style.titleRuleColor": "rule", "style.tagPlacement": "above-title", "style.chartHeading": "text", "style.listMarker": "dot", "style.tableRows": "zebra", "style.labelWeight": "bold"
    }
  },
  evergreen: {
    label: "Evergreen",
    basis: "Regular-weight titles on an open canvas, green pill date tags, plain chart headings with inline units, green bar families",
    colors: {
      "color.ink": "#212427", "color.textSecondary": "#696969", "color.componentPrimary": "#0E7A5E", "color.accent": "#16814B", "color.accentTint": "#DFF6E8",
      "color.componentPrimaryTint": "#E3F3EC", "color.surfaceMuted": "#F2F2F2",
      "color.chartSeries1": "#0E7A5E", "color.chartSeries2": "#5FB08F", "color.chartSeries3": "#9FD4BB",
      "color.chartSeries4": "#1F3A2E", "color.chartSeries5": "#7A7A7A", "color.chartSeries6": "#C9C9C9",
      "style.titleWeight": "regular", "style.titleRule": "rule", "style.titleRuleLength": "short", "style.titleRuleColor": "accent", "line.titleRule": 4, "style.tagPlacement": "below-title", "style.chartHeading": "text", "style.listMarker": "dot", "style.tableRows": "rules", "style.labelWeight": "bold", "style.titleLead": "pipe"
    }
  },
  crimson: {
    label: "Crimson",
    basis: "Light regular titles, grey bar families with the answer in red, red KPI call-outs, annotation rails",
    colors: {
      "color.ink": "#252525", "color.textSecondary": "#595959", "color.componentPrimary": "#CC0000", "color.accent": "#CC0000", "color.accentTint": "#FAE3E3",
      "color.componentPrimaryTint": "#FAE8E9", "color.surfaceMuted": "#F2F2F2", "color.chartComparator": "#BFBFBF",
      "color.chartSeries1": "#8C8C8C", "color.chartSeries2": "#CC0000", "color.chartSeries3": "#4D4D4D",
      "color.chartSeries4": "#BFBFBF", "color.chartSeries5": "#7A0000", "color.chartSeries6": "#E6E6E6",
      "style.titleWeight": "regular", "style.titleRule": "rule", "style.titleRuleLength": "full", "style.titleRuleColor": "rule", "style.tagPlacement": "top-right", "style.chartHeading": "text", "style.listMarker": "dot", "style.tableRows": "rules", "style.labelWeight": "bold"
    }
  },
  graphite: {
    label: "Graphite",
    basis: "Black ink with a bright green accent, regular titles, green chart families, ring KPIs",
    colors: {
      "color.ink": "#000000", "color.textSecondary": "#53565A", "color.componentPrimary": "#000000", "color.accent": "#86BC25", "color.accentTint": "#EAF4D5",
      "color.componentPrimaryTint": "#E8E8E8", "color.surfaceMuted": "#F2F2F2",
      "color.chartSeries1": "#86BC25", "color.chartSeries2": "#046A38", "color.chartSeries3": "#43B02A",
      "color.chartSeries4": "#0076A8", "color.chartSeries5": "#62B5E5", "color.chartSeries6": "#BBBCBC",
      "style.titleWeight": "regular", "style.titleRule": "rule", "style.titleRuleLength": "content", "style.titleRuleColor": "ink", "style.tagPlacement": "above-title", "style.chartHeading": "text", "style.listMarker": "dot", "style.tableRows": "rules", "style.labelWeight": "bold"
    }
  },
  "toolkit": { label: "Toolkit", basis: "Neutral palette retained for component fixtures", colors: {} }
});

// The theme's heat scale runs from the page to the lead series' mid colour, not to the near-black primary: the Spacebar
// deck's category table set half its cells in navy, the darkest page in a deck of light ones. A lead that is a grey (crimson's)
// runs to the primary, which is the house's colour there.
export function heatScaleTokens(colors) {
  const lead = colors['color.chartSeries1'], toward = isHex(lead) && chroma(lead) >= 10 ? lead : colors['color.componentPrimary'];
  return Object.fromEntries(['theme-sequential','red-white','red-white-green','red-yellow-green'].flatMap(palette=>Array.from({length:11},(_,i)=>{
    const f=i/10,canvas=colors['color.canvas'],negative=colors['color.negative'],positive=colors['color.positive'];
    const midpoint=palette==='red-yellow-green'?'#F4E76E':canvas;
    const value=palette==='theme-sequential'?mix(canvas,toward,f):palette==='red-white'?mix(negative,canvas,f):f<=.5?mix(negative,midpoint,f*2):mix(midpoint,positive,(f-.5)*2);
    return [`color.heat.${palette}.${i}`,{kind:'color',cssVar:`--heat-${palette}-${i}`,value,themeSlot:null}];
  })));
}

// What every page sets on the canvas must stay visible on it: the ink as text (WCAG 2's 4.5:1) and the primary as the
// marks a chart draws in it. A dark canvas set under the house navy drew a chart's line navy on navy, about 1:1, and every
// gate passed it. The mark floor is 2:1, below WCAG's 3:1 for a graphic, because a house's pale primary - a light blue at
// 2.8:1 - still reads as a filled bar, and refusing it would refuse the house; under 2:1 a mark is lost. The accent is a
// brand's own and is not held here: where it sets text the runtime darkens it to read (design-systems.mjs readable).
const CANVAS_CONTRAST = Object.freeze({ "color.ink": [4.5, "text"], "color.componentPrimary": [2, "a chart's marks"] });
const isHex = (value) => /^#[0-9A-Fa-f]{6}$/.test(String(value));
function assertCanvasContrast(tokens) {
  const canvas = tokens["color.canvas"]?.value;
  if (!isHex(canvas)) return;
  for (const [key, [least, role]] of Object.entries(CANVAS_CONTRAST)) {
    const color = tokens[key]?.value;
    if (!isHex(color)) continue;
    const ratio = contrastRatio(color, canvas);
    if (ratio < least) throw new Error(`The palette's ${key} (${color}) reads at ${ratio.toFixed(1)}:1 on the canvas (${canvas}), and ${role} needs ${least}:1 - on a dark canvas set a light ${key}, or keep the canvas light; for dark pages keep the palette as drawn for its light page and set \`tone: "dark"\` on the deck or the page, which derives every colour for the dark ground from it`);
  }
}

// Marks lead with the palette's colours, not its type. Series 1 draws every single-series chart, so it must read as a mark
// (2:1 on the canvas, the floor CANVAS_CONTRAST holds the primary to) without reading as type (10:1, as the ink and a
// near-black house navy do); one that does not trades places with the first series that does. Midnight, the toolkit and the
// BA deck's house palette led with the ink, and every plain bar in those decks was near-black with the blues unused. The
// dark series takes the place the lead left - the second, in both - so two lines stay apart, and a subject highlighted among
// the lead colour takes the primary (subjectOf).
const SERIES_KEYS = Object.freeze([1, 2, 3, 4, 5, 6].map((index) => `color.chartSeries${index}`));
const TYPE_DARK = 10;
function leadWithColour(tokens) {
  const canvas = tokens["color.canvas"]?.value, values = SERIES_KEYS.map((key) => tokens[key]?.value);
  if (!isHex(canvas) || !values.every(isHex)) return;
  const reads = (color) => { const ratio = contrastRatio(color, canvas); return ratio >= CANVAS_CONTRAST["color.componentPrimary"][0] && ratio < TYPE_DARK; };
  const lead = values.findIndex(reads);
  if (lead <= 0) return;
  [values[0], values[lead]] = [values[lead], values[0]];
  SERIES_KEYS.forEach((key, index) => { tokens[key] = { ...tokens[key], value: values[index] }; });
}

// The subject's colour (`color.chartSubject`), decided once per palette and ground: the first of the accent, the primary and
// the ink that stands apart from both kinds of peer a subject is drawn among - the lead series (1.5:1), where a highlighted
// bar's other members keep their colour, and the comparator grey (MARK_CONTRAST), where its peers are context. Each chart
// kind chose its own before, and they disagreed: an accent bar that was the lead series' own colour (midnight, the BA house
// palette once the ink left the lead), an evergreen subject at 1.1:1 on its green peers, a slope's subject among lines in the
// gridline grey. Where none clears both, the one nearest to clearing them.
const SUBJECT_KEYS = Object.freeze(["color.accent", "color.componentPrimary", "color.ink"]);
export function subjectOf(value) {
  const lead = value("color.chartSeries1"), grey = value("color.chartComparator");
  if (![lead, grey, ...SUBJECT_KEYS.map(value)].every(isHex)) return value("color.accent");
  const score = (key) => Math.min(contrastRatio(value(key), lead) / 1.5, contrastRatio(value(key), grey) / MARK_CONTRAST);
  return value(SUBJECT_KEYS.find((key) => score(key) >= 1) ?? SUBJECT_KEYS.reduce((best, key) => (score(key) > score(best) ? key : best)));
}

// How colourful a colour is: its CIELAB chroma, 0 for a grey, about 100 for an electric blue.
function chroma(hex) {
  const linear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16)));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return Math.hypot(500 * (x - y), 200 * (y - z));
}

// The colour a highlighted subject's peers take when they are data (`color.chartPeer`): the lead series, unless it
// outshouts the subject or the subject cannot be told from it. A near-neutral subject among strongly coloured peers reads as the one left out, not the one picked
// out - the Spacebar deck's navy bar among rust ones (chroma 15 against 45), midnight's near-black among electric blue,
// graphite's black among lime - while the BA house's navy among its own lighter blue (28 against 42) reads as chosen. Where
// the lead is more colourful than the subject by more than PEER_LOUDER, the peers take the first series colour that is not,
// still reads as a mark on the canvas and stands as far from the subject as a mark from its ground (MARK_CONTRAST) - a deep
// teal at 1.9:1 left midnight's near-black subject hard to find; failing every one, the ink halfway to the canvas.
const PEER_LOUDER = 20;
export function peerOf(value, subject) {
  const lead = value("color.chartSeries1"), canvas = value("color.canvas");
  if (![lead, canvas, subject].every(isHex)) return lead;
  const calm = (color) => chroma(color) - chroma(subject) <= PEER_LOUDER;
  // The lead stays where the subject stands out from it: darker or lighter by a mark's contrast (the BA house's navy among
  // its blue, 3.0:1), or more colourful (crimson's red among grey). Toolkit's navy among a deeper blue, at 1.9:1, did not.
  if (calm(lead) && (contrastRatio(lead, subject) >= MARK_CONTRAST || chroma(subject) - chroma(lead) > PEER_LOUDER)) return lead;
  const reads = (color) => contrastRatio(color, canvas) >= CANVAS_CONTRAST["color.componentPrimary"][0] && contrastRatio(color, subject) >= MARK_CONTRAST;
  return SERIES_KEYS.map(value).find((color) => isHex(color) && calm(color) && reads(color)) ?? mix(value("color.ink"), canvas, 0.5);
}

export function resolvePalette(id = "midnight", baseTokens, slots) {
  // A palette object `{ base, colors, label? }` (a house profile imported from a
  // template deck) overlays its colours and style tokens on a named base.
  let preset;
  if (id && typeof id === "object" && !Array.isArray(id)) {
    const base = id.base ?? "midnight";
    if (!Object.hasOwn(PALETTES, base)) throw new Error(`Unknown palette base: ${base}`);
    const colors = id.colors || {};
    for (const [key, value] of Object.entries(colors)) {
      if (key.startsWith("color.") && !/^#[0-9A-Fa-f]{6}$/.test(String(value))) throw new Error(`Palette colour ${key} must be a #RRGGBB hex`);
      // `line.` and `layout.` carry the house's title rule: its weight and the air around it.
      if (!/^(color|style|font|type|line|layout)\./.test(key)) throw new Error(`Palette override ${key} must be a color., style., font., type., line. or layout. token`);
      if (key.startsWith("type.") && !(Number.isFinite(value) && value >= 6 && value <= 200)) throw new Error(`Palette type size ${key} must be a point size`);
      if (/^(line|layout)\./.test(key) && !(Number.isFinite(value) && value >= 0 && value <= 200)) throw new Error(`Palette length ${key} must be a number of pixels`);
    }
    preset = { ...PALETTES[base], label: id.label ?? `${PALETTES[base].label} (custom)`, colors: { ...PALETTES[base].colors, ...colors } };
    id = id.id ?? `${base}-custom`;
  } else {
    if (typeof id !== "string" || !Object.hasOwn(PALETTES, id)) throw new Error(`Unknown palette: ${id}`);
    preset = PALETTES[id];
  }
  const tokens = Object.fromEntries(Object.entries(baseTokens).map(([key, value]) => [key, { ...value, value: preset.colors[key] ?? value.value }]));
  assertCanvasContrast(tokens);
  leadWithColour(tokens);
  if (tokens["color.chartSubject"]) tokens["color.chartSubject"] = { ...tokens["color.chartSubject"], value: subjectOf((key) => tokens[key]?.value) };
  if (tokens["color.chartPeer"]) tokens["color.chartPeer"] = { ...tokens["color.chartPeer"], value: peerOf((key) => tokens[key]?.value, tokens["color.chartSubject"].value) };
  // The filled surface follows the page it sits on: the palette's own ink mixed
  // toward its own canvas, so a warm paper page gets a warm stone and a navy
  // house a cool grey, and a house profile with its own ink needs no new colour.
  if (tokens["color.surfaceTint"] && !preset.colors["color.surfaceTint"] && tokens["color.ink"] && tokens["color.canvas"])
    tokens["color.surfaceTint"] = { ...tokens["color.surfaceTint"], value: surfaceTint(tokens["color.ink"].value, tokens["color.canvas"].value) };
  // On the light page the band is the ink: the surfaces that read it there draw their own ink or primary (core.mjs reversedFill).
  if (tokens["color.band"] && tokens["color.ink"]) tokens["color.band"] = { ...tokens["color.band"], value: tokens["color.ink"].value };
  Object.assign(tokens,heatScaleTokens(Object.fromEntries(Object.entries(tokens).map(([key,definition])=>[key,definition.value]))));
  // A colour token may share a theme slot only while its value equals that slot.
  for (const definition of Object.values(tokens)) {
    if (definition.themeSlot && definition.value !== tokens[slots[definition.themeSlot]].value) definition.themeSlot = null;
  }
  return { id, label: preset.label, basis: preset.basis, tokens };
}

// How far the filled surface sits from the canvas toward the ink. At 86% it is
// about 30 grey levels under a white or cream page: clearly a surface, still
// light enough for ink and secondary type at 4.5:1 or better.
export const SURFACE_TINT_MIX = 0.86;
export const surfaceTint = (ink, canvas, share = SURFACE_TINT_MIX) => mix(ink, canvas, share);

// The grounds a page is set on: the palette's own light page, the dark ground
// derived from it, and the house's primary as a field of colour. A deck's
// `tone` sets its pages' ground and a page's `tone` its own (core.mjs
// compileDeck), and every token a page reads resolves for that ground here.
export const GROUNDS = Object.freeze(["light", "dark", "primary"]);

// A colour's hue, saturation and lightness, each 0-1, and back: the dark ground
// keeps each mark's hue and moves only its lightness, so the house's blue is
// still its blue on navy, lighter.
function toHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h * 6) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h * 6) % 6];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
// The least step of `step(f)` (f from 0 to 1, lighter as f grows) that reads at
// `ratio` against `ground` and is lighter than it; the last step when none does.
function leastStep(step, ground, ratio) {
  const passes = (f) => { const c = step(f); return relativeLuminance(c) > relativeLuminance(ground) && contrastRatio(c, ground) >= ratio; };
  if (!passes(1)) return step(1);
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i += 1) { const mid = (lo + hi) / 2; if (passes(mid)) hi = mid; else lo = mid; }
  return step(hi);
}
/** `color` at the lightness that reads at `ratio` on a dark `ground`, its hue and saturation kept. */
export function liftedOn(color, ground, ratio) {
  const [h, s] = toHsl(color);
  return leastStep((f) => fromHsl(h, s, f), ground, ratio);
}
/** The colour between `ground` and `toward` that reads at `ratio` on the ground: a line, a surface or type in the ground's own hue. */
export const towardOn = (ground, toward, ratio) => ratio <= 1 ? ground : leastStep((f) => mix(ground, toward, f), ground, ratio);

// The dark ground is the house's own dark: its primary where that is a dark of
// its own (a navy, an indigo, a forest green: white reads on it at 10:1 or
// better), else its ink, deepened until pale type reads at DARK_GROUND_CONTRAST.
// A navy house gets a navy ground; a house whose primary is a brand colour -
// a red, a rust, a mid blue - gets the dark of its ink, and the brand colour is
// the `primary` ground. Never one fixed black.
const OWN_DARK = 10, DARK_GROUND_CONTRAST = 13;
export function darkGroundOf(tokens) {
  const pale = tokens["color.canvas"].value, primary = tokens["color.componentPrimary"].value;
  const source = contrastRatio(primary, pale) >= OWN_DARK ? primary : tokens["color.ink"].value;
  if (contrastRatio(source, pale) >= DARK_GROUND_CONTRAST) return source;
  let f = 0;
  while (contrastRatio(mix(source, "#000000", f), pale) < DARK_GROUND_CONTRAST && f < 1) f += 0.02;
  return mix(source, "#000000", Math.min(1, f));
}

// The band a reversed surface takes on a ground (core.mjs reversedFill): a step
// off the ground, lit in the primary's hue as a panel is on a dark page, while
// the pale type still reads on it at BAND_TYPE; on a mid colour - a brand
// green, a red - where a lighter step would take the type under that, a shade
// of the ground instead.
const BAND_STEP = 1.9, BAND_SHADE = 1.6, BAND_TYPE = 6;
function bandOn(ground, pale, primary) {
  const lift = towardOn(ground, primary, BAND_STEP);
  if (contrastRatio(pale, lift) >= BAND_TYPE) return lift;
  let f = 0;
  while (contrastRatio(mix(ground, "#000000", f), ground) < BAND_SHADE && f < 1) f += 0.02;
  const shade = mix(ground, "#000000", Math.min(1, f));
  return contrastRatio(pale, shade) > contrastRatio(pale, lift) ? shade : lift;
}

// The colour tokens by what each does on a page, and so how each resolves on a
// ground. Every colour token is named here: a colour the table does not hold is
// refused by groundTokens rather than left in its light-page value on a dark page.
const GROUND_ROLES = Object.freeze({
  canvas: ["color.canvas"],
  ink: ["color.ink"],
  // Reversed type: on a dark ground every fill it sits on (a mark, the primary, a light panel) is lighter than the ground.
  reversed: ["color.onPrimary"],
  text: ["color.textSecondary", "color.chartUnit"],
  surfaces: ["color.surface", "color.surfaceMuted", "color.rule", "color.chartGrid"],
  derived: ["color.surfaceTint", "color.band", "color.chartSubject", "color.chartPeer"],
  marks: ["color.componentPrimary", "color.chartComparator", "color.chartSeries1", "color.chartSeries2", "color.chartSeries3", "color.chartSeries4", "color.chartSeries5", "color.chartSeries6"],
  accent: ["color.accent"],
  status: ["color.positive", "color.caution", "color.negative", "color.info"],
  tints: ["color.componentPrimaryTint", "color.accentTint", "color.calloutTint", "color.negativeTint"],
});
// A mark reads at 3:1 on its ground - WCAG's floor for a graphic - wherever the
// ground leaves room above it; the palette's own floor (CANVAS_CONTRAST) is 2:1.
export const MARK_CONTRAST = 3;

/**
 * The design tokens of a page set on `ground`, from the deck's resolved tokens
 * (resolvePalette), which are drawn for its light page. `light` is those tokens.
 * `dark` sets the page on the house's own dark (darkGroundOf) and `primary` on
 * its primary; both set the type in the light page's own colour (white, or the
 * editorial cream).
 *
 * Each colour keeps the contrast it had on the light page, read the other way:
 * the ink becomes the pale type; the secondary type, the rules, the gridlines and
 * the surfaces are set between the ground and that type at the contrast they had
 * (a gridline a faint light line, a surface a step lighter than the ground); a
 * mark keeps its hue at the lightness its place in the house's range asks for,
 * from 3:1 (MARK_CONTRAST) for the palest series up to the type's own for a mark
 * as dark as the ink, so a navy series becomes near-white and a pale blue a mid
 * blue, and the order of emphasis holds; the accent, which sets text as well as
 * the highlighted mark, reads at 4.5:1, and the status colours at 4.5:1 or the
 * contrast they had; a tint is its colour laid over the ground as lightly as it
 * was laid over the page; the band (bandOn) is a step off the ground. The heat
 * scales and the filled surface are derived again from the new values, and a
 * theme slot is kept only where its token still equals the slot.
 */
export function groundTokens(tokens, ground, slots) {
  if (ground === "light" || ground === undefined) return tokens;
  if (!GROUNDS.includes(ground)) throw new Error(`Unknown tone: ${JSON.stringify(ground)}; a page is set on ${GROUNDS.map((g) => `"${g}"`).join(", ")}`);
  const value = (key) => tokens[key].value, page = value("color.canvas"), pale = page;
  const groundColor = ground === "dark" ? darkGroundOf(tokens) : value("color.componentPrimary");
  const room = contrastRatio(pale, groundColor);
  if (room < 4.5) throw new Error(`The house's primary (${groundColor}) carries pale type at ${room.toFixed(1)}:1, and a page set on it needs 4.5:1 - set the page on the dark ground (\`tone: "dark"\`), or give the deck a deeper primary`);
  // How far each colour stood from the light page, against how far the ink did: the mark's place in the house's range.
  const was = (key) => contrastRatio(value(key), page), inkRange = Math.max(1.01, was("color.ink"));
  const markRatio = (key) => Math.min(room, MARK_CONTRAST + Math.max(0, Math.min(1, (was(key) - 1) / (inkRange - 1))) * Math.max(0, room - MARK_CONTRAST));
  const resolved = {};
  const set = (key, color) => { resolved[key] = color; };
  set("color.canvas", groundColor);
  set("color.ink", pale);
  set("color.onPrimary", groundColor);
  for (const key of GROUND_ROLES.text) set(key, towardOn(groundColor, pale, Math.max(4.5, was(key))));
  for (const key of GROUND_ROLES.surfaces) set(key, towardOn(groundColor, pale, was(key)));
  set("color.surfaceTint", surfaceTint(pale, groundColor));
  for (const key of GROUND_ROLES.marks) set(key, liftedOn(value(key), groundColor, markRatio(key)));
  // The accent sets text and the highlighted mark: at the text floor, where a lifted colour keeps the most of its own (a red
  // lifted to the bars' contrast on black is a pink).
  set("color.accent", liftedOn(value("color.accent"), groundColor, 4.5));
  for (const key of GROUND_ROLES.status) set(key, liftedOn(value(key), groundColor, Math.max(4.5, was(key))));
  for (const key of GROUND_ROLES.tints) set(key, towardOn(groundColor, liftedOn(value(key), groundColor, 4.5), was(key)));
  set("color.band", bandOn(groundColor, pale, resolved["color.componentPrimary"]));
  set("color.chartSubject", subjectOf((key) => resolved[key] ?? value(key)));
  set("color.chartPeer", peerOf((key) => resolved[key] ?? value(key), resolved["color.chartSubject"]));
  const named = new Set(Object.values(GROUND_ROLES).flat());
  const missing = Object.entries(tokens).filter(([key, definition]) => definition.kind === "color" && !key.startsWith("color.heat.") && !named.has(key)).map(([key]) => key);
  if (missing.length) throw new Error(`No ground role for ${missing.join(", ")}: name it in palettes.mjs GROUND_ROLES, so a page on a dark ground does not draw it in its light-page colour`);
  const out = Object.fromEntries(Object.entries(tokens).map(([key, definition]) => [key, key in resolved ? { ...definition, value: resolved[key] } : { ...definition }]));
  const heat = heatScaleTokens(Object.fromEntries(Object.entries(out).map(([key, definition]) => [key, definition.value])));
  for (const [key, definition] of Object.entries(heat)) out[key] = { ...out[key], ...definition };
  for (const definition of Object.values(out)) {
    if (definition.themeSlot && slots && definition.value !== out[slots[definition.themeSlot]]?.value) definition.themeSlot = null;
  }
  return out;
}

// Shared by full charts and in-cell charts. Return the caller's index so
// semantic colour mappings remain under the caller's control.
export function strongestContrastIndex(colors, anchor = 0) {
  if (colors.length < 2) throw new Error("Contrast selection requires at least two colours");
  return colors.reduce((best, color, index) => index === anchor ? best
    : best === anchor || contrastRatio(colors[anchor], color) > contrastRatio(colors[anchor], colors[best]) ? index : best, anchor);
}
