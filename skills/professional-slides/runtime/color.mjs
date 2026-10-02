// Colour arithmetic on #RRGGBB hex strings: mixing two colours and the WCAG
// contrast between them. core.mjs `onFill` picks a label's colour with
// `contrastRatio`, and runtime/emit/color.py ports it for the emitter and the
// template importer; evals/tests/test_color_parity.py holds them together.

/** A #RRGGBB colour's red, green and blue channels, 0-255. */
export const channels = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

/** `a` moved `f` of the way toward `b` (0 is `a`, 1 is `b`), each channel rounded; upper-case hex. */
export const mix = (a, b, f) => {
  const to = channels(b);
  return "#" + channels(a).map((c, i) => Math.round(c * (1 - f) + to[i] * f).toString(16).padStart(2, "0")).join("").toUpperCase();
};

/** WCAG 2 relative luminance of a #RRGGBB colour. */
export function relativeLuminance(hex) {
  const rgb = hex.replace("#", "").match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

/** WCAG 2 contrast ratio of two #RRGGBB colours, 1 to 21. */
export function contrastRatio(a, b) {
  const values = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
