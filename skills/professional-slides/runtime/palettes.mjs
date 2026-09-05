// Named, versioned presentation presets. They are not official firm templates.
export const PALETTES = Object.freeze({
  mckinsey: {
    label: "McKinsey", source: "https://cdn.mckinsey.com/assets/sketch/McK_DS_core_Artboards.pdf",
    basis: "2020 published design-system colours; presentation-role mapping",
    colors: {
      "color.ink": "#051C2C", "color.textSecondary": "#4D4D4D", "color.componentPrimary": "#051C2C",
      "color.componentPrimaryTint": "#E6E8EA", "color.surfaceMuted": "#F0F0F0",
      "color.chartSeries1": "#051C2C", "color.chartSeries2": "#034B6F", "color.chartSeries3": "#00A9F4",
      "color.chartSeries4": "#027AB1", "color.chartSeries5": "#2251FF", "color.chartSeries6": "#71D2F1"
    }
  },
  bcg: {
    label: "BCG", source: "https://www.bcg.com/about/corporate-newsroom",
    basis: "Public site global colour variables, retrieved 2026-09-03; presentation-role mapping",
    colors: {
      "color.ink": "#212427", "color.textSecondary": "#696969", "color.componentPrimary": "#197A56",
      "color.componentPrimaryTint": "#E3FDDB", "color.surfaceMuted": "#F1EEEA",
      "color.chartSeries1": "#0C2B15", "color.chartSeries2": "#197A56", "color.chartSeries3": "#21BF61",
      "color.chartSeries4": "#A8F0B8", "color.chartSeries5": "#856E57", "color.chartSeries6": "#C4B5A4"
    }
  },
  bain: {
    label: "Bain", source: "https://www.baincapital.com/news/embedded-financial-services-what-it-takes-prosper-new-value-chain",
    basis: "Joint Bain and Company / Bain Capital publication chart colours; presentation-role mapping, not an official brand guide",
    colors: {
      "color.ink": "#252525", "color.textSecondary": "#595959", "color.componentPrimary": "#CB2027",
      "color.componentPrimaryTint": "#FAE8E9", "color.surfaceMuted": "#F2F2F2",
      "color.chartSeries1": "#CB2027", "color.chartSeries2": "#640D0D", "color.chartSeries3": "#991B1E",
      "color.chartSeries4": "#F16667", "color.chartSeries5": "#999999", "color.chartSeries6": "#CCCCCC"
    }
  },
  "consulting-toolkit": { label: "Consulting toolkit reference", basis: "Retained reference palette", colors: {} }
});
// Release validation uses one canonical visual system. The other named palettes
// remain supported inputs, but they are covered by fast token/contract tests
// rather than repeating the full render-and-readback gallery.
export const GOLDEN_PALETTES = Object.freeze(["mckinsey"]);

export function heatScaleTokens(colors) {
  const mix=(a,b,f)=>'#'+[0,1,2].map(i=>Math.round(parseInt(a.slice(1+i*2,3+i*2),16)*(1-f)+parseInt(b.slice(1+i*2,3+i*2),16)*f).toString(16).padStart(2,'0')).join('').toUpperCase();
  return Object.fromEntries(['theme-sequential','red-white','red-white-green'].flatMap(palette=>Array.from({length:11},(_,i)=>{
    const f=i/10,canvas=colors['color.canvas'],negative=colors['color.negative'],positive=colors['color.positive'];
    const value=palette==='theme-sequential'?mix(canvas,colors['color.componentPrimary'],f):palette==='red-white'?mix(negative,canvas,f):f<=.5?mix(negative,canvas,f*2):mix(canvas,positive,(f-.5)*2);
    return [`color.heat.${palette}.${i}`,{kind:'color',cssVar:`--heat-${palette}-${i}`,value,themeSlot:null}];
  })));
}

export function resolvePalette(id = "mckinsey", baseTokens, slots) {
  if (typeof id !== "string" || !Object.hasOwn(PALETTES, id)) throw new Error(`Unknown palette: ${id}`);
  const preset = PALETTES[id];
  const tokens = Object.fromEntries(Object.entries(baseTokens).map(([key, value]) => [key, { ...value, value: preset.colors[key] ?? value.value }]));
  Object.assign(tokens,heatScaleTokens(Object.fromEntries(Object.entries(tokens).map(([key,definition])=>[key,definition.value]))));
  // A colour token may share a theme slot only while its value equals that slot.
  for (const definition of Object.values(tokens)) {
    if (definition.themeSlot && definition.value !== tokens[slots[definition.themeSlot]].value) definition.themeSlot = null;
  }
  return { id, label: preset.label, source: preset.source, basis: preset.basis, tokens };
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
