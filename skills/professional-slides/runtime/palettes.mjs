// Named, versioned presentation presets.
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
      "style.titleWeight": "bold", "style.titleRule": "none", "style.tagPlacement": "above-title", "style.chartHeading": "text", "style.listMarker": "dot", "style.tableRows": "zebra", "style.labelWeight": "bold"
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
      "style.titleWeight": "regular", "style.titleRule": "none", "style.tagPlacement": "below-title", "style.chartHeading": "text", "style.listMarker": "dot", "style.tableRows": "rules", "style.labelWeight": "bold", "style.titleLead": "pipe"
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
      "style.titleWeight": "regular", "style.titleRule": "none", "style.tagPlacement": "top-right", "style.chartHeading": "text", "style.listMarker": "dot", "style.tableRows": "rules", "style.labelWeight": "bold"
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
      "style.titleWeight": "regular", "style.titleRule": "none", "style.tagPlacement": "above-title", "style.chartHeading": "text", "style.listMarker": "dot", "style.tableRows": "rules", "style.labelWeight": "bold"
    }
  },
  "toolkit": { label: "Toolkit", basis: "Neutral palette retained for component fixtures", colors: {} }
});

export function heatScaleTokens(colors) {
  const mix=(a,b,f)=>'#'+[0,1,2].map(i=>Math.round(parseInt(a.slice(1+i*2,3+i*2),16)*(1-f)+parseInt(b.slice(1+i*2,3+i*2),16)*f).toString(16).padStart(2,'0')).join('').toUpperCase();
  return Object.fromEntries(['theme-sequential','red-white','red-white-green','red-yellow-green'].flatMap(palette=>Array.from({length:11},(_,i)=>{
    const f=i/10,canvas=colors['color.canvas'],negative=colors['color.negative'],positive=colors['color.positive'];
    const midpoint=palette==='red-yellow-green'?'#F4E76E':canvas;
    const value=palette==='theme-sequential'?mix(canvas,colors['color.componentPrimary'],f):palette==='red-white'?mix(negative,canvas,f):f<=.5?mix(negative,midpoint,f*2):mix(midpoint,positive,(f-.5)*2);
    return [`color.heat.${palette}.${i}`,{kind:'color',cssVar:`--heat-${palette}-${i}`,value,themeSlot:null}];
  })));
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
      if (!key.startsWith("color.") && !key.startsWith("style.") && !key.startsWith("font.") && !key.startsWith("type.")) throw new Error(`Palette override ${key} must be a color., style., font. or type. token`);
      if (key.startsWith("type.") && !(Number.isFinite(value) && value >= 6 && value <= 200)) throw new Error(`Palette type size ${key} must be a point size`);
    }
    preset = { ...PALETTES[base], label: id.label ?? `${PALETTES[base].label} (custom)`, colors: { ...PALETTES[base].colors, ...colors } };
    id = id.id ?? `${base}-custom`;
  } else {
    if (typeof id !== "string" || !Object.hasOwn(PALETTES, id)) throw new Error(`Unknown palette: ${id}`);
    preset = PALETTES[id];
  }
  const tokens = Object.fromEntries(Object.entries(baseTokens).map(([key, value]) => [key, { ...value, value: preset.colors[key] ?? value.value }]));
  // The filled surface follows the page it sits on: the palette's own ink mixed
  // toward its own canvas, so a warm paper page gets a warm stone and a navy
  // house a cool grey, and a house profile with its own ink needs no new colour.
  if (tokens["color.surfaceTint"] && !preset.colors["color.surfaceTint"] && tokens["color.ink"] && tokens["color.canvas"])
    tokens["color.surfaceTint"] = { ...tokens["color.surfaceTint"], value: surfaceTint(tokens["color.ink"].value, tokens["color.canvas"].value) };
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
export function surfaceTint(ink, canvas, share = SURFACE_TINT_MIX) {
  const channel = (color, i) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map((i) => Math.round(channel(ink, i) * (1 - share) + channel(canvas, i) * share).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function contrastRatio(a, b) {
  const luminance = hex => {
    const rgb = hex.replace("#", "").match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

// Shared by full charts and in-cell charts. Return the caller's index so
// semantic colour mappings remain under the caller's control.
export function strongestContrastIndex(colors, anchor = 0) {
  if (colors.length < 2) throw new Error("Contrast selection requires at least two colours");
  return colors.reduce((best, color, index) => index === anchor ? best
    : best === anchor || contrastRatio(colors[anchor], color) > contrastRatio(colors[anchor], colors[best]) ? index : best, anchor);
}
