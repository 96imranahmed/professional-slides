// A brand's design read off its website (`preferences.mjs from-site <url>`):
// the colours its stylesheets use most and the typefaces they set text in,
// proposed as the intake's answers - `colours: "brand"` with `brand: {
// primary, accent }`, and `typography: { body, display }` - for the user to
// take or change. A deck about a company is styled as the company is: a
// hundred-page deck on an airline read its palette and its typeface off the
// airline's site by hand, which this does in one command. Nothing is stored
// until the user sets it.

const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
  "-apple-system", "blinkmacsystemfont", "inherit", "initial", "unset", "revert", "emoji", "math", "fangsong"]);
// Faces that draw icons, not words: a stylesheet sets them on every icon, and they are counted as often as the brand face.
const ICON_FAMILIES = /icon|awesome|material|glyph|symbol|dashicons|fontello|feather/i;

/** A colour as `#RRGGBB` and its hue (degrees), saturation and lightness (0-1); null for what is not a colour. */
function colourOf(match) {
  let r, g, b;
  if (match.hex) {
    const hex = match.hex.length === 3 ? match.hex.split("").map((c) => c + c).join("") : match.hex;
    [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
  } else [r, g, b] = match.rgb.map(Number);
  if ([r, g, b].some((v) => !Number.isFinite(v) || v > 255)) return null;
  const [rr, gg, bb] = [r, g, b].map((v) => v / 255), max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), light = (max + min) / 2, d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * light - 1));
  const hue = d === 0 ? 0 : max === rr ? 60 * (((gg - bb) / d) % 6) : max === gg ? 60 * ((bb - rr) / d + 2) : 60 * ((rr - gg) / d + 4);
  return { hex: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`, hue: (hue + 360) % 360, sat, light };
}

/** Each colour a stylesheet writes, with how often: a brand's own custom property (`--brand-primary: #...`) counted five times. */
function colourCounts(css) {
  const counts = new Map();
  const add = (colour, weight) => { if (colour) counts.set(colour.hex, { ...colour, count: (counts.get(colour.hex)?.count ?? 0) + weight }); };
  for (const m of css.matchAll(/(--[\w-]*(?:brand|primary|accent|main|theme)[\w-]*)\s*:\s*#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) add(colourOf({ hex: m[2] }), 4);
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) add(colourOf({ hex: m[1] }), 1);
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/gi)) add(colourOf({ rgb: [m[1], m[2], m[3]] }), 1);
  return [...counts.values()];
}

/** Each typeface a stylesheet sets text in, with how often: one it declares with @font-face counted three times over. */
function faceCounts(css) {
  const counts = new Map(), heading = new Map(), running = new Map();
  const first = (list) => String(list).split(",").map((name) => name.trim().replace(/^["']|["']$/g, "").trim()).find((name) => name && !GENERIC_FAMILIES.has(name.toLowerCase()) && !/^var\(/i.test(name));
  const add = (map, name, weight) => { if (name && !ICON_FAMILIES.test(name)) map.set(name, (map.get(name) ?? 0) + weight); };
  for (const m of css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*([^;}]+)/gi)) add(counts, first(m[1]), 3);
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const family = /font-family\s*:\s*([^;}]+)/i.exec(m[2]);
    if (!family || /@font-face/i.test(m[1])) continue;
    add(counts, first(family[1]), 1);
    if (/\bh[1-3]\b|heading|title|display|hero|headline/i.test(m[1])) add(heading, first(family[1]), 1);
    if (/(^|[\s,>+~])(html|body|p|li|main|article|td)(?![\w-])/i.test(m[1])) add(running, first(family[1]), 1);
  }
  const ranked = (map) => [...map].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  return { all: ranked(counts), heading: ranked(heading), running: ranked(running) };
}

/**
 * The design a site's stylesheets say: `{ brand: { primary, accent }, typography: { body, display }, evidence }`.
 * The primary is the most used colour dark enough to set a title band in; the
 * accent the most used colour of middle lightness that is not the primary's
 * shade. Greys, near-white and near-black are the page's, not the brand's,
 * and are passed over. Null where a part cannot be read.
 */
export function siteDesign(cssTexts) {
  const css = cssTexts.join("\n");
  const colours = colourCounts(css).filter((c) => c.sat >= 0.18 && c.light > 0.06 && c.light < 0.92).sort((a, b) => b.count - a.count);
  const primary = colours.find((c) => c.light <= 0.35) ?? colours[0] ?? null;
  const distinct = (c) => !primary || Math.abs(c.hue - primary.hue) > 15 || Math.abs(c.light - primary.light) > 0.15;
  const accent = colours.find((c) => c !== primary && c.light > 0.3 && c.light < 0.7 && distinct(c)) ?? colours.find((c) => c !== primary && distinct(c)) ?? null;
  const faces = faceCounts(css);
  // The face the running text is set in, where the sheets say; a face declared for the headings alone is the display face.
  const body = faces.running[0]?.name ?? faces.all[0]?.name ?? null, display = faces.heading[0]?.name ?? body;
  return { brand: primary ? { primary: primary.hex, ...(accent ? { accent: accent.hex } : {}) } : null,
    typography: body ? { body, display } : null,
    evidence: { colours: colours.slice(0, 6).map((c) => `${c.hex} x${c.count}`), faces: faces.all.slice(0, 5).map((f) => `${f.name} x${f.count}`) } };
}

/** The stylesheets a page's HTML links and inlines: inline `<style>` blocks and `style` attributes, and the URLs of linked sheets. */
export function stylesOf(html, base) {
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const attributes = [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => `x{${m[1]}}`);
  const linked = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((tag) => /rel\s*=\s*["']?stylesheet/i.test(tag))
    .map((tag) => /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]).filter(Boolean).map((href) => { try { return new URL(href, base).href; } catch { return null; } }).filter(Boolean);
  return { inline: [...inline, ...attributes], linked };
}

const UA = "professional-slides/1.0 (design intake from a brand's site)";

/** The site read: its page and up to eight linked stylesheets fetched, and `siteDesign` of what they hold. */
export async function readSite(url, { fetcher = fetch } = {}) {
  const page = await fetcher(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!page.ok) throw new Error(`${url} answered ${page.status}`);
  const html = await page.text();
  const { inline, linked } = stylesOf(html, page.url || url);
  const sheets = await Promise.all(linked.slice(0, 8).map((href) => fetcher(href, { headers: { "User-Agent": UA } }).then((r) => (r.ok ? r.text() : "")).catch(() => "")));
  return { url, sheets: linked.length, ...siteDesign([...inline, ...sheets]) };
}
