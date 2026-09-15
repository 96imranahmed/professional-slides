import { createRequire } from "node:module";
import { activeDesignTokens } from "./design-context.mjs";

const require = createRequire(import.meta.url);
let context;
const measurements=new Map();
const MAX_MEASUREMENTS=4096;
export function clearTextMeasurementCache(){measurements.clear();}
export function textMeasurementCacheSize(){return measurements.size;}
function cachedMeasurement(key,fn){if(measurements.has(key)){const value=measurements.get(key);measurements.delete(key);measurements.set(key,value);return structuredClone(value);}const value=fn();measurements.set(key,structuredClone(value));if(measurements.size>MAX_MEASUREMENTS)measurements.delete(measurements.keys().next().value);return value;}
function measureWidth(ctx,text){return cachedMeasurement(JSON.stringify([ctx.font,text]),()=>({width:ctx.measureText(text).width}));}
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
      if (line && measureWidth(ctx,candidate).width > width * wrapWidthRatio) {
        lines.push(line);
        line = word;
      } else line = candidate;
      if (measureWidth(ctx,line).width > width) throw new Error(`Unbreakable text exceeds its width: ${line}`);
    }
    lines.push(line);
  }
  const lineHeight = Math.ceil(fontSize * 96 / 72 * 1.12);
  return { text: lines.join("\n"), lines, width: Math.max(...lines.map((line) => measureWidth(ctx,line).width)), lineHeight, height: lines.length * lineHeight };
}

// Styled runs share a single font family, point size and line box. Only emphasis
// varies; neither the author nor an adapter may independently reflow a run.
export function measureTextRuns(runs, width, { fontFamily = activeDesignTokens()?.["font.body"].value ?? "Arial", fontSize = 16, wrapWidthRatio = 0.97 } = {}) {
  if (!Array.isArray(runs) || !runs.length || runs.some(run => !run || typeof run.text !== 'string' || typeof run.bold !== 'boolean' || Object.keys(run).some(key => !['text', 'bold'].includes(key)))) throw new Error('Text runs require text and boolean bold only');
  if (!(width > 0) || !(wrapWidthRatio > 0 && wrapWidthRatio <= 1)) throw new Error('Text runs require a positive width and valid wrap ratio');
  const ctx = fontContext();
  if (!ctx.hasFont(fontFamily)) throw new Error(`Required font is not installed: ${fontFamily}`);
  const source = runs.map(run => run.text).join('');
  let offset = 0;
  const ranges = runs.map(run => { const start = offset; offset += run.text.length; return { ...run, start, end: offset }; });
  const merge = parts => parts.reduce((result, part) => {
    if (!part.text) return result;
    if (result.at(-1)?.bold === part.bold) result.at(-1).text += part.text;
    else result.push({ text: part.text, bold: part.bold });
    return result;
  }, []);
  const runWidth = parts => merge(parts).reduce((total, part) => {
    ctx.font = `${part.bold ? 'bold' : 'normal'} ${fontSize * 96 / 72}px "${fontFamily}"`;
    return total + measureWidth(ctx,part.text).width;
  }, 0);
  const wordRuns = (start, end) => ranges.filter(run => run.end > start && run.start < end).map(run => ({ text: source.slice(Math.max(start, run.start), Math.min(end, run.end)), bold: run.bold }));
  const lineRuns = [];
  offset = 0;
  for (const paragraph of source.split('\n')) {
    let line = [];
    for (const match of paragraph.matchAll(/\S+/g)) {
      const word = wordRuns(offset + match.index, offset + match.index + match[0].length);
      const candidate = merge([...line, ...(line.length ? [{ text: ' ', bold: line.at(-1).bold }] : []), ...word]);
      if (line.length && runWidth(candidate) > width * wrapWidthRatio) { lineRuns.push(line); line = merge(word); }
      else line = candidate;
      if (runWidth(line) > width) throw new Error(`Unbreakable text exceeds its width: ${match[0]}`);
    }
    lineRuns.push(line);
    offset += paragraph.length + 1;
  }
  const lines = lineRuns.map(parts => parts.map(part => part.text).join(''));
  const measuredRuns = merge(lineRuns.flatMap((parts, index) => [...(index ? [{ text: '\n', bold: false }] : []), ...parts]));
  const lineHeight = Math.ceil(fontSize * 96 / 72 * 1.12);
  return { text: lines.join('\n'), lines, runs: measuredRuns.length ? measuredRuns : [{text:'',bold:false}], width: Math.max(...lineRuns.map(runWidth)), lineHeight, height: lines.length * lineHeight };
}
