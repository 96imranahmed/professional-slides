import { createRequire } from "node:module";
import { activeDesignTokens } from "./design-context.mjs";

const require = createRequire(import.meta.url);
let context;
function fontContext() {
  if (!context) {
    const paths = process.env.RUNTIME_NODE_MODULES ? [process.env.RUNTIME_NODE_MODULES] : undefined;
    const { createCanvas, GlobalFonts } = require(require.resolve("@napi-rs/canvas", { paths }));
    context = createCanvas(1, 1).getContext("2d");
    context.hasFont = (family) => GlobalFonts.has(family);
  }
  return context;
}

// Wrap once, using the resolved font. Both adapters receive the same explicit lines.
export function measureText(text, width, { fontFamily = activeDesignTokens()?.["font.body"].value ?? "Arial", fontSize = 16, bold = false, wrapWidthRatio = 0.97 } = {}) {
  if (!(width > 0)) throw new Error("Text width must be positive");
  if (!(wrapWidthRatio > 0 && wrapWidthRatio <= 1)) throw new Error("Text wrap width ratio must be greater than zero and at most one");
  const ctx = fontContext();
  if (!ctx.hasFont(fontFamily)) throw new Error(`Required font is not installed: ${fontFamily}`);
  ctx.font = `${bold ? "bold" : "normal"} ${fontSize * 96 / 72}px "${fontFamily}"`;
  const lines = [];
  for (const paragraph of String(text ?? "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      // Ordinary headings reserve font-engine tolerance; titles may use their full
      // measured width rather than create a spurious final-word wrap.
      if (line && ctx.measureText(candidate).width > width * wrapWidthRatio) {
        lines.push(line);
        line = word;
      } else line = candidate;
      if (ctx.measureText(line).width > width) throw new Error(`Unbreakable text exceeds its width: ${line}`);
    }
    lines.push(line);
  }
  const lineHeight = Math.ceil(fontSize * 96 / 72 * 1.12);
  return { text: lines.join("\n"), lines, width: Math.max(...lines.map((line) => ctx.measureText(line).width)), lineHeight, height: lines.length * lineHeight };
}
