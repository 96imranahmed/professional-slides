// Portable text measurement. Prefers a native canvas when one is installed; otherwise
// uses bundled advance-width tables so the layout engine runs on any Node without
// native dependencies (Claude, CI, a fresh laptop). Both paths return px widths at
// 96 px/in for a CSS-style font string such as `bold 21.33px "Arial"`.
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readJsonSync } from "./cli.mjs";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const TABLES = new Map();

// Where a face measured on this machine is kept (font-table.py): the user's fonts folder, beside their preferences.
const userFonts = () => [process.env.PROFESSIONAL_SLIDES_HOME && path.join(process.env.PROFESSIONAL_SLIDES_HOME, "fonts"),
  process.env.XDG_CONFIG_HOME && path.join(process.env.XDG_CONFIG_HOME, "professional-slides", "fonts"),
  path.join(process.env.HOME || os.homedir(), ".professional-slides", "fonts"), path.join(process.cwd(), ".professional-slides", "fonts")].filter(Boolean);

function loadTable(family) {
  const key = family.toLowerCase();
  if (TABLES.has(key)) return TABLES.get(key);
  // The shipped tables first, then a face the user measured from their installed fonts.
  const table = [path.join(here, "fonts"), ...userFonts()].map((dir) => readJsonSync(path.join(dir, `${key}-metrics.json`), { optional: true })).find(Boolean) ?? null;
  TABLES.set(key, table);
  return table;
}

// Families whose metrics we treat as Arial-compatible when no native canvas exists.
const ALIASES = { arial: "arial", helvetica: "arial", "liberation sans": "arial", arimo: "arial", georgia: "georgia", "times new roman": "georgia", "liberation serif": "georgia" };

function parseFont(font) {
  const match = /^(bold|normal)\s+([\d.]+)px\s+"?([^"]+)"?$/.exec(String(font).trim());
  if (!match) throw new Error(`Unsupported font string: ${font}`);
  return { bold: match[1] === "bold", px: Number(match[2]), family: match[3] };
}

class TableContext {
  constructor() { this.font = "normal 16px \"Arial\""; }
  hasFont(family) { return Boolean(loadTable(ALIASES[String(family).toLowerCase()] || family)); }
  measureText(text) {
    const { bold, px, family } = parseFont(this.font);
    const table = loadTable(ALIASES[family.toLowerCase()] || family);
    if (!table) throw new Error(`Required font is not installed: ${family}`);
    const face = table.faces[bold ? "bold" : "regular"];
    const scale = px / table.unitsPerEm;
    let units = 0;
    for (const char of String(text)) {
      const cp = char.codePointAt(0);
      units += face.advances[cp] ?? (cp === 0x20 ? face.space : face.default);
    }
    return { width: units * scale };
  }
  // Natural line box for the face at a pixel size, in px: (winAscent + winDescent) / upm.
  lineBox(px, family = "Arial", bold = false) {
    const table = loadTable(ALIASES[family.toLowerCase()] || family);
    const face = table?.faces[bold ? "bold" : "regular"];
    return face ? px * (face.winAscent + face.winDescent) / table.unitsPerEm : px * 1.2;
  }
}

let context = null;
export function metricsBackend() { return context?.backend ?? null; }

export function fontContext() {
  if (context) return context;
  if (process.env.PS_TEXT_METRICS !== "table") {
    try {
      const paths = process.env.RUNTIME_NODE_MODULES ? [process.env.RUNTIME_NODE_MODULES] : undefined;
      const { createCanvas, GlobalFonts } = require(require.resolve("@napi-rs/canvas", { paths }));
      const ctx = createCanvas(1, 1).getContext("2d");
      ctx.hasFont = (family) => GlobalFonts.has(family);
      ctx.backend = "canvas";
      context = ctx;
      return context;
    } catch { /* fall through to bundled tables */ }
  }
  const ctx = new TableContext();
  ctx.backend = "table";
  context = ctx;
  return context;
}
