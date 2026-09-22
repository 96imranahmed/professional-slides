import { mediaNode } from "./media.mjs";
import { formatValue } from "./value-format.mjs";
import {
  token,
  tokenValue,
  stableId,
  textPrimitive,
  rectPrimitive,
  ellipsePrimitive,
  wedgePrimitive,
  linePrimitive,
  shapePrimitive,
  chartAnnotationStyle,
  houseStyle,
} from "./core.mjs";
import { measureText, measureTextRuns, accentRuns } from "./text-layout.mjs";
import { contrastRatio, strongestContrastIndex } from "./palettes.mjs";
import { numberMarker, stateMarker, iconMarker, MARK_TOKENS } from "./marks.mjs";
import { measureAt } from "./draw.mjs";

// One table compiler. Columns select defaults; individual cells may override the
// encoding (e.g. options as columns with prose and rating rows in the same table).
export const CELL_TYPES = Object.freeze([
  "text",
  "logo",
  "bullets",
  "category",
  "highlight",
  "number",
  "binary",
  "harvey",
  "heatmap",
  "bars",
  "implication",
  "rag",
  "lights",
  "progress",
  "dot",
  "check",
  "trend",
]);
// Outlook cells (the Bain sector tables): an arrow in a ring, green up, grey flat, red down.
export const TREND_STATES = Object.freeze({ up: { glyph: "↑", color: "color.positive" }, flat: { glyph: "→", color: "color.textSecondary" }, down: { glyph: "↓", color: "color.negative" } });
// Status vocabularies. Pill labels are the canonical words; the composer maps
// free text onto them.
export const RAG_STATES = Object.freeze({
  "on-track": { label: "On track", color: "color.positive" },
  complete: { label: "Complete", color: "color.positive" },
  behind: { label: "Behind plan", color: "color.caution" },
  "at-risk": { label: "At risk", color: "color.negative" },
  "not-started": { label: "Not started", color: "color.rule" },
});
export const LIGHT_STATES = Object.freeze({ green: "color.positive", amber: "color.caution", red: "color.negative" });
export const TABLE_TOKENS = [
  "font.body",
  "font.bodySemibold",
  "weight.semibold",
  "type.body",
  "type.compact",
  "type.label",
  "type.heading",
  "color.ink",
  "color.onPrimary",
  "color.componentPrimary",
  "color.componentPrimaryTint",
  "color.accent",
  "color.accentTint",
  "color.surface",
  "color.surfaceMuted",
  "color.rule",
  "color.chartGrid",
  "color.positive",
  "color.caution",
  "color.negative",
  "color.textSecondary",
  ...Array.from({ length: 6 }, (_, i) => `color.chartSeries${i + 1}`),
  "space.1",
  "space.2",
  "space.3",
  "space.4",
  "space.5",
  "space.6",
  "space.8",
  "icon.small",
  "icon.medium",
  "line.hairline",
  "line.standard",
  "radius.none",
  "radius.round",
];
const t = token,
  v = (key) => tokenValue(t(key));
TABLE_TOKENS.push(...MARK_TOKENS.filter((id) => !TABLE_TOKENS.includes(id)));
TABLE_TOKENS.push(
  ...["theme-sequential", "red-white", "red-white-green"].flatMap((p) =>
    Array.from({ length: 11 }, (_, i) => `color.heat.${p}.${i}`),
  ),
);
const ink = t("color.ink"),
  primary = t("color.componentPrimary"),
  white = t("color.onPrimary");
const box = (fill) => ({
  fill,
  stroke: "none",
  lineWidth: t("line.hairline"),
  radius: t("radius.none"),
});
const textStyle = (
  bold = false,
  color = ink,
  align = "left",
  size = "type.body",
) => ({
  fontFamily: t("font.body"),
  fontSize: t(size),
  color,
  bold,
  align,
  valign: "top",
  wrap: false,
});
const measure = (text, width, bold = false, size = "type.body") => measureAt(text, width, { size, bold });
// A cell may carry `highlight`: the phrase inside it that reads in the house
// accent, the way a reference table marks the figure that decides the row.
const measureRuns = (text, highlight, width, bold = false, size = "type.body") => {
  const runs = accentRuns(String(text), highlight, { bold: true, strict: false });
  if (!runs) return measure(text, width, bold, size);
  return measureTextRuns(runs.map((run) => ({ ...run, bold: run.accent ? true : bold })), width, {
    fontFamily: v("font.body"),
    fontSize: v(size),
    wrapWidthRatio: 1,
  });
};
const line = (id, x1, y1, x2, y2, role = "table-rule", data = {}) =>
  linePrimitive({
    id,
    role,
    x1,
    y1,
    x2,
    y2,
    style: { stroke: t("color.rule"), lineWidth: t("line.hairline") },
    data,
  });
const requireText = (value, name) => {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Table ${name} requires nonempty text`);
  return value;
};
const sum = (values) => values.reduce((a, b) => a + b, 0);
const bodySize = (props) =>
  props.density === "dense"
    ? "type.label"
    : props.density === "compact"
      ? "type.compact"
      : "type.body";
function barColor(scale, index) {
  if (scale.series.length !== 2 || index === 0)
    return t(`color.chartSeries${index + 1}`);
  const candidates = Array.from({ length: 6 }, (_, i) =>
    t(`color.chartSeries${i + 1}`),
  );
  return candidates[strongestContrastIndex(candidates.map(tokenValue))];
}

function normalize(props) {
  if (
    !Array.isArray(props.columns) ||
    !props.columns.length ||
    !Array.isArray(props.rows) ||
    !props.rows.length
  )
    throw new Error("Table requires columns and rows");
  const columns = props.columns.map((col, i) =>
    typeof col === "string"
      ? {
          id: String(i),
          label: col,
          type: "text",
          bold: i === 0,
          align: props.columnAlignments?.[i] ?? "left",
        }
      : { id: String(i), label: "", type: "text", ...col },
  );
  if (new Set(columns.map((c) => c.id)).size !== columns.length)
    throw new Error("Duplicate table column id");
  // `group`: the band above the header that names what a run of columns
  // measures ("Size", "Growth", "Specialization"); `unit`: the measure's unit
  // under the label, so the cells carry the number alone. Groups must be
  // contiguous - a band that reappears further along is two different things.
  const seenGroups = new Set();
  let runningGroup = null;
  for (const column of columns) {
    const group = column.group === undefined || column.group === null ? null : String(column.group);
    if (group !== runningGroup) {
      if (group && seenGroups.has(group)) throw new Error(`Table column group "${group}" is not contiguous`);
      if (group) seenGroups.add(group);
      runningGroup = group;
    }
  }
  const rows = props.rows.map((row) =>
    Array.isArray(row) ? { cells: row } : row,
  );
  const occupied = rows.map(() => Array(columns.length).fill(false));
  const cells = rows.map((row, r) => {
    if (!Array.isArray(row.cells) || row.cells.length !== columns.length)
      throw new Error(
        `Table row ${r + 1} must have exactly ${columns.length} cells, including null span continuations`,
      );
    if (!["plain", "accented", "total", "group"].includes(row.style ?? props.rowStyle ?? "plain"))
      throw new Error("Unknown table row style");
    const groupRow = (row.style ?? props.rowStyle) === "group";
    return row.cells.map((value, c) => {
      if (occupied[r][c]) {
        if (value !== null)
          throw new Error("Table row span collides with a populated cell");
        return null;
      }
      if (value === null || value === undefined)
        throw new Error(
          "Missing table evidence must be explicit, not a blank cell",
        );
      const column = columns[c];
      const cell = {
        ...column,
        ...(typeof value === "object" && !Array.isArray(value)
          ? value
          : { text: String(value), value }),
      };
      // A group row is one label across a grey band; its other cells stay blank.
      const bandRow = groupRow || (row.style ?? props.rowStyle) === "total";
      const emptyValue = typeof value === "string" && !value.trim();
      if (emptyValue && (bandRow ? c > 0 : c === 0)) { cell.blank = true; cell.type = "text"; }
      if (bandRow) cell.bold = true;
      if (!CELL_TYPES.includes(cell.type))
        throw new Error(`Unknown table cell type: ${cell.type}`);
      if (!["left", "center", "right"].includes(cell.align ?? "left"))
        throw new Error("Unknown table alignment");
      if (cell.sectionNumber !== undefined) {
        if (cell.type !== "category")
          throw new Error(
            "Table section numbers belong only on category cells",
          );
        if (!Number.isInteger(cell.sectionNumber) || cell.sectionNumber < 1)
          throw new Error(
            "Table section numbers must be positive natural integers",
          );
      }
      const span = cell.rowSpan ?? 1;
      if (!Number.isInteger(span) || span < 1 || r + span > rows.length)
        throw new Error("Invalid table row span");
      if (span > 1 && cell.type !== "category")
        throw new Error("Only category cells may span rows");
      for (let k = r + 1; k < r + span; k++) occupied[k][c] = true;
      return { ...cell, row: r, column: c, rowSpan: span };
    });
  });
  const sectionNumbers = cells
    .flat()
    .filter(Boolean)
    .map((cell) => cell.sectionNumber)
    .filter((number) => number !== undefined);
  if (new Set(sectionNumbers).size !== sectionNumbers.length)
    throw new Error("Table section numbers must be unique");
  return { columns, rows, cells };
}

function resolveWidths(columns, props, width) {
  if (props.columnWidths) {
    if (
      props.columnWidths.length !== columns.length ||
      props.columnWidths.some((w) => !Number.isFinite(w) || w <= 0) ||
      Math.abs(sum(props.columnWidths) - 1) > 1e-6
    )
      throw new Error(
        "Table columnWidths must be positive fractions summing to one",
      );
    return props.columnWidths.map((w) => w * width);
  }
  const fixed = columns.map((c) =>
    typeof c.width === "object" ? c.width.px : 0,
  );
  if (fixed.some((n) => !Number.isFinite(n) || n < 0) || sum(fixed) >= width)
    throw new Error("Invalid fixed table column widths");
  const weights = columns.map((c, i) => (fixed[i] ? 0 : (c.width ?? 1)));
  if (weights.some((n) => !Number.isFinite(n) || n < 0))
    throw new Error("Table widths must be positive weights or {px}");
  const widths = columns.map(
    (c, i) => fixed[i] || ((width - sum(fixed)) * weights[i]) / sum(weights),
  );
  if (widths.some((w, i) => w < (columns[i].minWidth ?? v("space.6"))))
    throw new Error("Table column is narrower than its minimum width");
  return widths;
}

function scaleFor(cell, props, used) {
  const scale = props.scales?.[cell.scale];
  if (!scale)
    throw new Error(`Table ${cell.type} requires a declared scale ID`);
  if (scale.type !== cell.type)
    throw new Error("Table cell and scale encodings disagree");
  requireText(scale.label, "scale label");
  if (cell.type === "binary") {
    requireText(scale.test, "binary confirmation test");
    if (
      !scale.states ||
      !["yes", "no", "missing"].every(
        (k) => typeof scale.states[k] === "string" && scale.states[k].trim(),
      )
    )
      throw new Error("Binary scale requires yes, no and missing labels");
    if (!Object.hasOwn(scale.states, cell.value))
      throw new Error("Unknown binary state");
    if (
      !["none", "state"].includes(
        cell.labelDisplay ?? scale.labelDisplay ?? "none",
      )
    )
      throw new Error("Binary labelDisplay must be none or state");
  } else if (cell.type === "harvey" || cell.type === "heatmap") {
    const { min, max, anchors } = scale;
    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      max <= min ||
      !anchors ||
      !anchors[min] ||
      !anchors[max]
    )
      throw new Error(
        "Table rating scale requires integer bounds and named endpoint anchors",
      );
    if (
      cell.type === "harvey" &&
      (min !== 0 ||
        max !== 4 ||
        Array.from({ length: 5 }, (_, i) => i).some((i) => !anchors[i]))
    )
      throw new Error(
        "Harvey balls require five named ordinal anchors from 0 to 4",
      );
    if (
      cell.value !== "missing" &&
      cell.value !== "na" &&
      (!Number.isInteger(cell.value) || cell.value < min || cell.value > max)
    )
      throw new Error("Table score is outside its declared domain");
    if (
      cell.type === "heatmap" &&
      !["theme-sequential", "red-white", "red-white-green"].includes(
        scale.palette ?? "theme-sequential",
      )
    )
      throw new Error("Unknown heatmap palette");
    if (
      scale.palette === "red-white-green" &&
      (scale.midpoint !== (min + max) / 2 || !anchors[scale.midpoint])
    )
      throw new Error("Diverging heatmap requires a named neutral midpoint");
  } else if (cell.type === "bars") {
    if (
      !Number.isFinite(scale.min) ||
      !Number.isFinite(scale.max) ||
      scale.max <= scale.min ||
      scale.min > 0 || scale.max < 0 ||
      !Array.isArray(scale.series) ||
      !scale.series.length ||
      scale.series.length > 6
    )
      throw new Error(
        "Bar cells require a shared finite domain containing zero and 1 to 6 named series",
      );
    requireText(scale.unit, "bar unit");
    if (
      !Array.isArray(cell.values) ||
      cell.values.length !== scale.series.length ||
      cell.values.some((n) => !Number.isFinite(n) || n < scale.min || n > scale.max)
    )
      throw new Error(
        "Bar values must match the series and remain within the shared domain",
      );
    scale.series.forEach((s) => requireText(s, "bar series"));
  }
  used.set(cell.scale, scale);
  return scale;
}

const missing = (value) =>
  value === "missing" ? "Not available" : value === "na" ? "N/A" : null;
function heatFill(scale, value) {
  if (missing(value)) return t("color.surfaceMuted");
  const fraction = (value - scale.min) / (scale.max - scale.min);
  return t(
    `color.heat.${scale.palette ?? "theme-sequential"}.${Math.round(fraction * 10)}`,
  );
}
const foreground = (fill) =>
  contrastRatio(tokenValue(fill), v("color.ink")) >= 4.5 ? ink : white;
const rowBand = (style) =>
  style === "accented" ? t("color.accentTint") : style === "total" ? primary : style === "group" ? t("color.surfaceMuted") : null;
const categorySurface = (cell, props) =>
  cell.surface ?? (props.treatment === "dimensions" || props.variant === "plain" ? "plain" : "primary");

function contentLayout(cell, width, props, used) {
  const dense = props.density === "dense",
    compact = props.density === "compact" || dense;
  const padding = v(dense ? "space.1" : compact ? "space.2" : "space.3"),
    gap = v(compact ? "space.1" : "space.2");
  const marker =
    cell.type === "binary" || dense ? v("icon.small") : v("icon.medium");
  const inner = width - padding * 2;
  if (inner <= 0) throw new Error("Table cell is too narrow for padding");
  if (["binary", "harvey", "heatmap", "bars"].includes(cell.type))
    cell.scaleRecord = scaleFor(cell, props, used);
  if (cell.type === "logo") {
    const height = measure("M", inner, false, bodySize(props)).lineHeight;
    const media = cell.media;
    const node = mediaNode({id:"logo-measure", frame:{x:0,y:0,width:inner,height}, props:media, role:"table-logo"});
    if (node.frame.height < height - 0.01) throw new Error("Logo column must fit every logo at the shared body-height; widen the column");
    return {height, padding, mediaWidth:node.frame.width};
  }
  if (cell.type === "implication") {
    if (cell.relation !== "implies")
      throw new Error("Arrow cells require relation: implies");
    if (inner < marker)
      throw new Error(
        "Implication column must reserve the compact disc and cell padding",
      );
    return { height: marker, padding };
  }
  if (cell.type === "bars") {
    // `labels` keeps what the author wrote. The house rounding reads 14.8 as
    // 15, which is right for a figure the runtime derived and wrong for one
    // the author typed - a page cannot say 14.8 in its takeaway and 15 in
    // the table it is drawn from.
    const labels = cell.values.map((n, i) => cell.labels?.[i] ?? formatValue(n, cell.scaleRecord));
    const size = bodySize(props);
    const labelWidth = Math.max(
      ...[...labels, ...(cell.scaleRecord.labelTexts || [])].map((s) => measure(s, inner, true, size).width),
      v("space.6"),
    );
    const rowHeight = Math.max(
      v("space.4"),
      ...labels.map((s) => measure(s, inner, true, size).height),
    );
    if (inner - labelWidth - gap < v("space.6"))
      throw new Error("Bar cell leaves no usable plot width");
    return {
      height: cell.values.length * rowHeight + (cell.values.length - 1) * gap,
      padding,
      labelWidth,
      rowHeight,
      size,
    };
  }
  if (!["body", "compact", "dense"].includes(props.density ?? "body"))
    throw new Error("Unknown table density");
  let texts,
    offset = 0,
    bold = Boolean(cell.bold),
    size = dense ? "type.label" : compact ? "type.compact" : "type.body";
  if (cell.blank) return { padding, offset: 0, blocks: [], bold, size, marker, numberMarker: 0, numberWidth: 0, blockHeight: 0, height: 0 };
  if (cell.type === "rag") {
    const state = RAG_STATES[cell.value];
    if (!state) throw new Error(`Table rag cells take one of ${Object.keys(RAG_STATES).join(", ")}`);
    const label = measure(cell.text || state.label, inner, true, "type.label");
    const pillWidth = label.width + 2 * v("space.3"), pillHeight = label.height + 2 * v("space.1");
    if (pillWidth > inner) throw new Error("Table status pill does not fit its column; widen the column");
    return { padding, offset: 0, blocks: [label], bold: true, size: "type.label", marker, numberMarker: 0, numberWidth: 0, blockHeight: label.height, pill: { width: pillWidth, height: pillHeight, color: t(state.color) }, height: pillHeight };
  }
  if (cell.type === "lights") {
    if (!LIGHT_STATES[cell.value]) throw new Error("Table lights cells take green, amber or red");
    const dot = v("icon.small");
    if (inner < 3 * dot + 2 * gap) throw new Error("Table lights cell is too narrow for three lamps");
    return { padding, offset: 0, blocks: [], bold, size, marker, numberMarker: 0, numberWidth: 0, blockHeight: 0, lights: { dot, gap }, height: dot };
  }
  if (cell.type === "progress") {
    const value = Number(cell.value);
    if (!(value >= 0 && value <= 100)) throw new Error("Table progress cells take a percentage from 0 to 100");
    const label = measure(cell.text || `${Math.round(value)}%`, inner, true, "type.label");
    const labelWidth = Math.max(label.width, v("space.6"));
    if (inner - labelWidth - gap < v("space.6")) throw new Error("Table progress cell leaves no bar width");
    return { padding, offset: 0, blocks: [label], bold: true, size: "type.label", marker, numberMarker: 0, numberWidth: 0, blockHeight: label.height, progress: { value, labelWidth, barHeight: v("space.2") }, height: Math.max(label.height, v("space.2")) };
  }
  if (cell.type === "trend") {
    const key = { up: "up", positive: "up", strong: "up", improving: "up", flat: "flat", neutral: "flat", moderate: "flat", stable: "flat", down: "down", negative: "down", weak: "down", declining: "down" }[String(cell.value).toLowerCase()];
    if (!key) throw new Error(`Table trend cells take up, flat or down (got ${cell.value})`);
    const size = v("icon.small") + v("space.2");
    if (inner < size) throw new Error("Table trend cell is too narrow for its mark");
    return { padding, offset: 0, blocks: [], bold, size: "type.label", marker, numberMarker: 0, numberWidth: 0, blockHeight: 0, trend: { size, key }, height: size };
  }
  if (cell.type === "dot" || cell.type === "check") {
    const size = v("icon.small") + (cell.type === "check" ? v("space.2") : 0);
    if (inner < size) throw new Error("Table mark cell is too narrow for its mark");
    return { padding, offset: 0, blocks: [], bold, size: "type.label", marker, numberMarker: 0, numberWidth: 0, blockHeight: 0, mark: { size, on: cell.value === true || cell.value === "yes" || cell.value === "done" }, height: size };
  }
  if (cell.type === "binary") {
    cell.labelDisplay =
      cell.labelDisplay ?? cell.scaleRecord.labelDisplay ?? "none";
    texts =
      cell.labelDisplay === "state"
        ? [cell.scaleRecord.states[cell.value]]
        : [];
    offset = texts.length ? marker + gap : 0;
  } else if (cell.type === "harvey") {
    // The word the scale gives that value, not "3/4". The fraction reads as a
    // score out of four, which is not what a rating on a named scale means, and
    // it says the same thing the disc already says - so the column carried a
    // number nobody asked for beside a picture of the same number. A cold run
    // hit exactly this and went back to plain words, which is the right call
    // against "3/4" and the wrong one against a scale you can scan.
    const anchor = cell.scaleRecord?.anchors?.[cell.value];
    texts = [missing(cell.value) ?? anchor ?? `${cell.value}/4`];
    offset = missing(cell.value) ? 0 : marker + gap;
  } else if (cell.type === "heatmap") {
    texts = [missing(cell.value) ?? String(cell.value)];
  } else if (cell.type === "number") {
    const value = cell.value ?? cell.text;
    if (
      !(
        Number.isFinite(value) ||
        (typeof value === "string" && value.trim() && /\d/.test(value))
      )
    )
      throw new Error(
        "Table number cells require a finite number or formatted numeric text",
      );
    cell.numberDisplay = cell.numberDisplay ?? "circle";
    if (!["circle", "oval", "plain"].includes(cell.numberDisplay))
      throw new Error("Table numberDisplay must be circle, oval or plain");
    texts = [String(value)];
    bold = true;
  } else if (cell.type === "bullets") {
    if (!Array.isArray(cell.items) || !cell.items.length)
      throw new Error("Table bullets require items");
    texts = cell.items.map((s) => requireText(s, "bullet"));
    offset = v("space.4");
  } else if (cell.type === "category" && cell.sectionNumber !== undefined && !String(cell.text ?? "").trim()) {
    texts = []; // a bare numbered disc, as in a "#" column
  } else {
    texts = [requireText(cell.text, "cell")];
    bold = cell.type === "category" || bold;
  }
  // A numbered section marker sits at the left of its category cell, on the
  // label's centre line, whatever the surface; the label starts after it.
  // A row label carries a numbered disc, an icon, or both: the reference matrix
  // numbers its rows and gives each one its own mark, and the label starts after
  // whatever is there.
  const inlineSectionMarker = cell.sectionNumber !== undefined || (cell.type === "category" && cell.icon);
  const iconInline = cell.type === "category" && Boolean(cell.icon);
  if (inlineSectionMarker) {
    const disc = cell.sectionNumber !== undefined ? v("icon.medium") + gap : 0;
    const glyph = iconInline ? Math.round(v("icon.medium") * 1.5) + gap : 0;
    offset = disc + glyph;
  }
  const blocks = texts.map((s) => measureRuns(s, cell.accent, inner - offset, bold, size));
  // A bullets cell may open with a bold lead line: the finding, then the
  // evidence under it. The reference matrix page sets every cell this way.
  const leadText = cell.type === "bullets" && typeof cell.lead === "string" && cell.lead.trim() ? cell.lead.trim() : null;
  const lead = leadText ? measureRuns(leadText, cell.accent, inner, true, size) : null;
  // `sub`: the qualifier under a measure, in the small type - "10,156" over
  // "+18% since 2014". Blocks without another column, which is how a reference
  // measure column carries two readings in one width.
  const subText = typeof cell.sub === "string" && cell.sub.trim() ? cell.sub.trim() : null;
  const sub = subText ? measure(subText, inner - offset, false, "type.label") : null;
  // `accent`: the phrase inside the cell that reads in the house colour.
  // (`highlight: true` is the older flag that marks a whole cell.)
  if (cell.accent !== undefined && cell.accent !== null) {
    const phrases = Array.isArray(cell.accent) ? cell.accent : [cell.accent];
    const everything = [leadText, ...texts].filter(Boolean).join("\u0000");
    for (const phrase of phrases) {
      if (!everything.includes(String(phrase))) throw new Error(`Table cell accent "${phrase}" does not occur in the cell`);
    }
  }
  const blockHeight = (blocks.length
    ? sum(blocks.map((b) => b.height)) + (blocks.length - 1) * gap
    : 0) + (lead ? lead.height + gap : 0) + (sub ? sub.height : 0);
  const numberMarker =
    cell.type === "number" && cell.numberDisplay !== "plain"
      ? Math.max(
          marker,
          cell.numberDisplay === "circle" ? blocks[0].width + 2 * gap : 0,
          blocks[0].height + 2 * v("space.1"),
        )
      : 0;
  const numberWidth =
    cell.numberDisplay === "oval"
      ? Math.max(numberMarker * 2.2, blocks[0].width + 2 * gap)
      : numberMarker;
  if (numberWidth > inner)
    throw new Error(
      "Table number bubble does not fit its column; widen the column or use numberDisplay: plain",
    );
  return {
    padding,
    offset,
    blocks,
    lead,
    sub,
    bold,
    size,
    marker,
    numberMarker,
    numberWidth,
    numberDisplay: cell.numberDisplay,
    inlineSectionMarker,
    blockHeight,
    height: Math.max(
      inlineSectionMarker ? v("icon.medium") : 0,
      ["binary", "harvey"].includes(cell.type) ? marker : 0,
      numberMarker,
      blockHeight,
    ),
  };
}

function legendText(scale) {
  if (scale.type === "binary")
    return `${scale.label}: ${scale.test}. ${scale.states.yes}; ${scale.states.no}; ${scale.states.missing}.`;
  if (scale.type === "bars")
    return `${scale.label} (${scale.unit}, common scale ${scale.min} to ${scale.max})`;
  return `${scale.label}: ${Object.entries(scale.anchors)
    .map(([n, label]) => `${n} = ${label}`)
    .join("; ")}. Missing = Not available; N/A = not applicable.`;
}

function layoutLegend(id, scale, width, size, gap) {
  const text = legendText(scale),
    layout = measure(text, width, false, size);
  const entries = [];
  let extraHeight = scale.type === "heatmap" ? v("icon.medium") + gap : 0;
  // A bar column of one series is named by its own column header, so a swatch
  // row under the table repeats the heading and says nothing. Two or more
  // series share a cell and do need the key.
  if (scale.type === "bars" && scale.series.length > 1) {
    const swatch = v("space.3");
    let x = 0,
      y = 0,
      rowHeight = 0;
    for (const [index, name] of scale.series.entries()) {
      const label = measure(name, width - swatch - gap - 1, false, size);
      const entryWidth = swatch + gap + label.width + 1;
      if (x && x + entryWidth > width) {
        y += rowHeight + gap;
        x = 0;
        rowHeight = 0;
      }
      entries.push({ index, label, x, y, swatch });
      rowHeight = Math.max(rowHeight, v("icon.medium"), label.height);
      x += entryWidth + v("space.5");
    }
    extraHeight = y + rowHeight + gap;
  }
  return {
    id,
    scale,
    text,
    layout,
    entries,
    height: layout.height + gap + extraHeight,
  };
}

export function measureTable({ frame, props }) {
  const model = normalize(props),
    density = props.density ?? "body";
  if (!["body", "compact", "dense"].includes(density))
    throw new Error("Unknown table density");
  const tableProps = { ...props, density },
    widths = resolveWidths(model.columns, tableProps, frame.width),
    used = new Map();
  const compact = density !== "body",
    padding = v(
      density === "dense" ? "space.1" : compact ? "space.2" : "space.3",
    ),
    gap = v(compact ? "space.1" : "space.2");
  if (props.rowSpacing !== undefined && !["normal", "tight"].includes(props.rowSpacing))
    throw new Error("Table rowSpacing must be normal or tight");
  // Compact line spacing and compact type are separate decisions. A long
  // list of short records can keep body type while reducing vertical padding.
  const paddingY = props.rowSpacing === "tight" ? v("space.1") : padding;
  const textSize =
    density === "dense"
      ? "type.label"
      : density === "compact"
        ? "type.compact"
        : "type.body";
  // Chevron headers keep their label clear of the point: inset by half the
  // band height on both sides (measured at a taller band so the label fits).
  const chevronInset = props.headerShape === "chevron" ? v("space.5") : 0;
  const headers = model.columns.map((c, i) =>
    c.label ? measure(c.label, widths[i] - 2 * padding - 2 * chevronInset, true, textSize) : null,
  );
  // A unit sits under its column's label at label size: "Jobs, 2019" over "#",
  // so every cell in the column prints the number and nothing else.
  const units = model.columns.map((c, i) =>
    c.unit ? measure(String(c.unit), widths[i] - 2 * padding, false, "type.label") : null,
  );
  const unitHeight = units.some(Boolean) ? Math.max(...units.map((u) => u?.height ?? 0)) + v("space.1") : 0;
  // The group band runs above the header over each contiguous run of columns
  // that share a `group`, with its own rule under it.
  const groupRuns = [];
  model.columns.forEach((column, i) => {
    const group = column.group === undefined || column.group === null ? null : String(column.group);
    const last = groupRuns.at(-1);
    if (last && last.group === group) last.end = i;
    else groupRuns.push({ group, start: i, end: i });
  });
  const groups = groupRuns.filter((run) => run.group).map((run) => ({
    ...run,
    layout: measure(run.group, sum(widths.slice(run.start, run.end + 1)) - 2 * padding, true, textSize),
  }));
  const groupHeight = groups.length ? Math.max(...groups.map((g) => g.layout.height)) + paddingY + v("space.1") : 0;
  const headerHeight = headers.some(Boolean)
    ? Math.max(...headers.map((h) => h?.height ?? 0)) + unitHeight + 2 * paddingY + (chevronInset ? paddingY : 0) + groupHeight
    : 0;
  const layouts = model.cells.map((row) =>
    row.map((cell) =>
      cell ? contentLayout(cell, widths[cell.column], tableProps, used) : null,
    ),
  );
  const sectionMarkerSize = v("icon.medium");
  const cellHeight = layout => layout.height + 2 * paddingY;
  // A column shares a plot width across its rows; a scale shared across
  // columns must also retain the same physical length per unit. Connect both
  // constraints before reserving label gutters (including unequal columns).
  const barColumns = model.columns.map((_, c) => ({
    column: c,
    entries: layouts.flatMap((row, r) => model.cells[r][c]?.type === "bars"
      ? [{ layout: row[c], scale: model.cells[r][c].scaleRecord }] : []),
  })).filter(group => group.entries.length);
  const pending = new Set(barColumns);
  while (pending.size) {
    const group = [pending.values().next().value];
    pending.delete(group[0]);
    const scales = new Set(group[0].entries.map(entry => entry.scale));
    for (let i = 0; i < group.length; i++) {
      for (const candidate of pending) {
        if (!candidate.entries.some(entry => scales.has(entry.scale))) continue;
        pending.delete(candidate);
        group.push(candidate);
        candidate.entries.forEach(entry => scales.add(entry.scale));
      }
    }
    const plotWidth = Math.min(...group.flatMap(({ column, entries }) =>
      entries.map(({ layout }) => widths[column] - 2 * padding - layout.labelWidth - gap)));
    if (plotWidth < v("space.6")) throw new Error("Bar column leaves no usable plot width");
    group.forEach(({ column, entries }) => entries.forEach(({ layout }) => {
      layout.labelWidth = widths[column] - 2 * padding - gap - plotWidth;
    }));
  }
  const minimumRowHeight = v(
    props.rowSpacing === "tight" || density === "dense"
      ? "space.5"
      : density === "compact"
        ? "space.6"
        : "space.8",
  );
  const heights = layouts.map((row, r) =>
    Math.max(
      minimumRowHeight,
      ...row.map((l, c) =>
        l && model.cells[r][c].rowSpan === 1 ? cellHeight(l) : 0,
      ),
    ),
  );
  model.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell || cell.rowSpan === 1) return;
      const required = cellHeight(layouts[r][c]),
        allocated = sum(heights.slice(r, r + cell.rowSpan));
      if (required > allocated) {
        const extra = (required - allocated) / cell.rowSpan;
        for (let k = r; k < r + cell.rowSpan; k++) heights[k] += extra;
      }
    }),
  );
  for (const [id, scale] of used) {
    if (scale.legend !== false) continue;
    const columns = model.columns.filter((column, c) => model.cells.some(row => row[c]?.scale === id));
    // A tick and a cross under a header that asks a question need no key, and
    // the generic one - "Meets requirement: The option meets the requirement.
    // Yes; No; Not assessed." - defines its own term with itself under a table
    // that says neither "requirement" nor "option".
    if (scale.type === "binary" && columns.length && columns.every(column => /\?\s*$/.test(String(column.label ?? "").trim()))) continue;
    if (scale.type !== "bars" || scale.series.length !== 1 || columns.some(column => !column.label.includes(scale.unit)))
      throw new Error("Only single-series bar legends may be omitted, with their unit visible in every using column header, or a binary scale whose every column header asks a question");
  }
  const legends = [...used.entries()].filter(([, scale]) => scale.legend !== false).map(([id, scale]) =>
    layoutLegend(id, scale, frame.width, textSize, gap),
  );
  // Reserve visible scale bars/swatches and labels together. Never infer row-local scales.
  const legendHeight = sum(legends.map((l) => l.height));
  let height =
    headerHeight +
    sum(heights) +
    (legends.length ? v("space.4") + legendHeight : 0);
  if (Number.isFinite(frame.height) && height > frame.height + 0.01)
    throw new Error(
      `Table content needs ${height.toFixed(1)}px, but only ${frame.height}px is allocated; widen, simplify or split the table`,
    );
  // A table given more height than it needs spreads the surplus across its rows,
  // up to 2.5× the natural row height, so a hero table fills its frame the way a
  // consulting scorecard does instead of leaving a void beneath it.
  // Stretched rows read as bands, so every cell's content is then centred on
  // the row rather than hanging from its top edge beside a centred category.
  let stretched = false;
  if (props.fillHeight === true && Number.isFinite(frame.height) && frame.height > height + 0.01 && heights.length) {
    const surplus = Math.min(frame.height - height, heights.reduce((a, b) => a + b, 0) * 1.5);
    const per = surplus / heights.length;
    for (let r = 0; r < heights.length; r += 1) heights[r] += per;
    height += surplus;
    stretched = per > gap;
  }
  return {
    ...model,
    density,
    textSize,
    widths,
    headers,
    units,
    unitHeight,
    groups,
    groupHeight,
    headerHeight,
    layouts,
    heights,
    stretched,
    sectionMarkerSize,
    legends,
    height,
    padding,
    paddingY,
    gap,
  };
}

// Degradation ladder for tables: body → compact → dense before refusing. A table
// that loses its band height to a shared heading steps its type down one notch
// rather than failing the page.
export function renderTable(input) {
  const ladder = ["body", "compact", "dense"];
  const start = Math.max(0, ladder.indexOf(input.props.density ?? "body"));
  let lastError = null;
  for (let i = start; i < ladder.length; i += 1) {
    try {
      const result = renderTableAt({ ...input, props: { ...input.props, density: ladder[i] } });
      if (i > start) for (const node of result.nodes) node.data = { ...node.data, fitStep: ladder[i] };
      return result;
    } catch (error) {
      if (!/only \d+px is allocated/.test(error.message)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

function renderTableAt({ id, frame, props }) {
  if (props.comparisonAxis !== undefined) {
    if (!["rows", "columns"].includes(props.comparisonAxis)) throw new Error("Table comparisonAxis must be rows or columns");
    if (props.comparisonAxis === "rows" && ["dimensions", "standard"].includes(props.treatment)) throw new Error("Row dimensions require first-column emphasis, not a filled item header");
    if (props.comparisonAxis === "rows" && props.columns?.[0]?.type !== "category") throw new Error("Row dimensions require a category first column");
    if (props.comparisonAxis === "columns" && !["dimensions", "categories"].includes(props.treatment)) throw new Error("Column dimensions require dimensions treatment or a higher category hierarchy");
  }
  if (props.treatment === "categories" && !props.columns?.some(column => column.type === "category")) throw new Error("Category hierarchy requires category cells");
  const m = measureTable({ frame, props }),
    nodes = [],
    xs = m.widths.map((_, c) => frame.x + sum(m.widths.slice(0, c)));
  const ys = m.heights.map(
    (_, r) =>
      frame.y +
      m.headerHeight +
      sum(m.heights.slice(0, r)),
  );
  const putText = (nodeId, role, area, layout, style, data = {}) =>
    nodes.push(
      textPrimitive({
        id: nodeId,
        role,
        frame: { ...area, height: layout.height },
        text: layout.text,
        ...(layout.runs && layout.runs.some((run) => run.accent) ? { runs: layout.runs } : {}),
        style: { ...style, lineHeight: layout.lineHeight },
        data: { ...data, textLayout: layout },
      }),
    );
  const header = props.treatment ?? "open";
  if (!["open", "standard", "dimensions", "categories"].includes(header))
    throw new Error("Unknown table header treatment");
  // The group band: what a run of columns measures, over its own rule. The
  // reference wide table heads four measures with three groups this way, so a
  // reader takes the table in two passes instead of reading six labels.
  if (m.headerHeight && m.groups.length) {
    for (const group of m.groups) {
      const x = xs[group.start];
      const width = sum(m.widths.slice(group.start, group.end + 1)) - m.gap;
      putText(
        stableId(id, "group-text", group.start),
        "table-group-text",
        { x: x + m.padding, y: frame.y + v("space.1"), width: width - 2 * m.padding },
        group.layout,
        textStyle(true, ink, "left", m.textSize),
        { columnGroup: group.group },
      );
      nodes.push(
        line(
          stableId(id, "group-rule", group.start),
          x,
          frame.y + m.groupHeight - v("space.1"),
          x + width,
          frame.y + m.groupHeight - v("space.1"),
          "table-group-rule",
          { columnGroup: group.group },
        ),
      );
    }
  }
  m.columns.forEach((column, c) => {
    if (!m.headerHeight) return;
    // The implication gutter carries no header, so it takes no header fill. The
    // band used to run straight through it, which put a block of ink in the
    // header with nothing in it and joined the verdict column to the evidence
    // it is drawn from - the opposite of what the gutter is there to say. The
    // band now breaks at the gutter, and the chevron is what crosses it.
    const filledHeader = column.type !== "implication"
      && (header === "standard" || (header === "dimensions" && column.type !== "category"));
    if (filledHeader && props.headerShape === "chevron")
      // Phase tables: each header is a chevron pointing along the sequence.
      nodes.push(
        shapePrimitive({
          id: stableId(id, "header-cell", c),
          role: "table-header-cell",
          geometry: "chevron",
          frame: { x: xs[c], y: frame.y, width: m.widths[c] - m.gap, height: m.headerHeight },
          style: box(ink),
          data: { column: c, headerShape: "chevron" },
        }),
      );
    else if (filledHeader)
      nodes.push(
        rectPrimitive({
          id: stableId(id, "header-cell", c),
          role: "table-header-cell",
          frame: {
            x: xs[c],
            y: frame.y,
            width: m.widths[c],
            height: m.headerHeight,
          },
          // The recommended column's header takes the accent so the column
          // reads as the answer from the header down.
          style: box(c === props.highlightColumn ? t("color.accent") : ink),
          data: { column: c, ...(c === props.highlightColumn ? { highlightColumn: true } : {}) },
        }),
      );
    if (m.headers[c]) {
      const chevron = filledHeader && props.headerShape === "chevron";
      const inset = chevron ? m.headerHeight / 2 : 0;
      const labelY = frame.y + m.paddingY + m.groupHeight;
      putText(
        stableId(id, "header-text", c),
        "table-header-text",
        {
          x: xs[c] + m.padding + inset,
          y: labelY,
          width: m.widths[c] - 2 * m.padding - 2 * inset,
        },
        m.headers[c],
        textStyle(
          true,
          filledHeader ? white : ink,
          chevron ? "center" : column.align ?? "left",
          m.textSize,
        ),
      );
      if (m.units[c])
        putText(
          stableId(id, "header-unit", c),
          "table-header-unit",
          {
            x: xs[c] + m.padding + inset,
            y: labelY + m.headers[c].height,
            width: m.widths[c] - 2 * m.padding - 2 * inset,
          },
          m.units[c],
          textStyle(false, filledHeader ? white : t("color.textSecondary"), chevron ? "center" : column.align ?? "left", "type.label"),
        );
    }
    // One continuous header rule unless a column is an implication arrow or
    // the header sits over a chevron/category run whose slits are by design.
    const continuousHeader = !m.columns.some((col) => col.type === "implication") && props.headerShape !== "chevron" && header !== "categories";
    if (!(filledHeader && props.headerShape === "chevron") && (continuousHeader ? c === 0 : column.type !== "implication"))
      nodes.push(
        line(
          stableId(id, "header-rule", c),
          xs[c],
          frame.y + m.headerHeight,
          continuousHeader ? frame.x + frame.width - m.gap : xs[c] + m.widths[c] - m.gap,
          frame.y + m.headerHeight,
        ),
      );
  });
  // Zebra rows (house style): every second body row on a muted band, no row
  // rules, for open and standard tables that carry no filled category column.
  const zebra = (props.zebra ?? (houseStyle("style.tableRows") === "zebra")) && props.treatment !== "categories" && props.headerShape !== "chevron";
  if (zebra) m.cells.forEach((row, r) => {
    if (r % 2 === 0 || rowBand(m.rows[r].style ?? props.rowStyle)) return;
    nodes.push(rectPrimitive({ id: stableId(id, "zebra", r), role: "table-zebra-band", frame: { x: frame.x, y: ys[r] + m.gap / 2, width: frame.width - m.gap, height: m.heights[r] - m.gap }, style: box(t("color.surfaceMuted")), data: { row: r, zebra: true } }));
  });
  // The recommended option's column is one tinted band from the header rule
  // to the last row; row bands (total, group) paint over it so a total stays a total.
  if (Number.isInteger(props.highlightColumn) && m.widths[props.highlightColumn] !== undefined) {
    const c = props.highlightColumn;
    nodes.push(rectPrimitive({ id: stableId(id, "column-band", c), role: "table-column-band", frame: { x: xs[c], y: frame.y + m.headerHeight + m.gap / 2, width: m.widths[c] - m.gap, height: sum(m.heights) - m.gap }, style: box(t("color.accentTint")), data: { column: c, highlightColumn: true } }));
  }
  // Row-level fills (accented, total, group) are one continuous band so the
  // row reads as a band rather than a run of tinted cells with slits between.
  m.cells.forEach((row, r) => {
    const band = props.treatment === "categories" && (m.rows[r].style ?? props.rowStyle) === "total"
      ? t("color.surfaceMuted") : rowBand(m.rows[r].style ?? props.rowStyle);
    if (!band) return;
    nodes.push(rectPrimitive({ id: stableId(id, "row-band", r), role: "table-row-band", frame: { x: frame.x, y: ys[r] + m.gap / 2, width: frame.width - m.gap, height: m.heights[r] - m.gap }, style: box(band), data: { row: r, rowStyle: m.rows[r].style ?? props.rowStyle } }));
  });
  // The implication gutter as one device for the whole table: a dashed rule down
  // its own column with the disc centred on it, rather than a chevron sitting on
  // whichever row happens to be halfway down. On a twelve-market scorecard that
  // chevron read as a mark against France. It is the same marker the gutter
  // between an exhibit and its commentary carries, which is the point: the
  // reader has already learned what it means.
  m.columns.forEach((column, c) => {
    if (!column || column.type !== "implication" || column.divider !== true) return;
    const centreX = xs[c] + (m.widths[c] - m.gap) / 2;
    // The rule spans the evidence, and a total is not evidence: it is the same
    // rows added up. Drawn to the foot of the table the hairline crossed the
    // dark total band and the disc came to rest one row low, against "Open
    // markets" rather than between the six rows it reads from.
    let last = m.rows.length - 1;
    while (last > 0 && (m.rows[last].style ?? props.rowStyle) === "total") last -= 1;
    const top = frame.y + m.headerHeight + m.gap / 2;
    const bottom = ys[last] + m.heights[last] - m.gap / 2;
    const diameter = Math.min(v("icon.medium"), m.widths[c] - m.gap);
    const data = { column: c, relation: "implies", arrowVariant: "divider-chevron" };
    // A table-level inference spans the evidence body. Row emphasis is independent.
    const centreY = (top + bottom) / 2, reach = diameter / 2 + v("space.2");
    for (const [suffix, y1, y2] of [["top", top, centreY - reach], ["bottom", centreY + reach, bottom]]) {
      if (y2 <= y1) continue;
      nodes.push(linePrimitive({ id: stableId(id, "implication-rule", c, suffix), role: "table-implication",
        x1: centreX, y1, x2: centreX, y2,
        style: { stroke: t("color.rule"), lineWidth: t("line.hairline"), dash: "dash" }, data }));
    }
    nodes.push(ellipsePrimitive({ id: stableId(id, "implication-disc", c), role: "table-implication",
      frame: { x: centreX - diameter / 2, y: centreY - diameter / 2, width: diameter, height: diameter },
      style: box(primary), data: { ...data, arrowPart: 0 } }));
    [[centreX - diameter * 0.11, centreY - diameter * 0.23, centreX + diameter * 0.12, centreY],
     [centreX + diameter * 0.12, centreY, centreX - diameter * 0.11, centreY + diameter * 0.23],
    ].forEach(([x1, y1, x2, y2], part) => nodes.push(linePrimitive({
      id: stableId(id, "implication-chevron", c, part), role: "table-implication", x1, y1, x2, y2,
      style: { stroke: foreground(primary), lineWidth: t("line.standard") }, data: { ...data, arrowPart: part + 1 } })));
  });

  // A bubble column is one pill repeated, not a pill per figure. Sized to its
  // own text each pill made "6.7%" a visibly different object from "29.7%", and
  // taking the row's height turned the pill into a tall capsule whose size read
  // as a value it did not carry. Every pill in a column now takes the width of
  // the widest figure in it and the height of one line of type - the same pill
  // the change annotation puts a CAGR in - so the reader compares the numbers
  // and not the shapes.
  const isBubble = (cell) => cell && cell.type === "highlight" && cell.surface === "bubble";
  const bubbleText = new Map();
  m.cells.forEach((row, r) => row.forEach((cell, c) => {
    if (!isBubble(cell)) return;
    const block = m.layouts[r]?.[c]?.blocks?.[0];
    if (!block) return;
    const seen = bubbleText.get(c) ?? { width: 0, height: 0 };
    bubbleText.set(c, { width: Math.max(seen.width, block.width), height: Math.max(seen.height, block.height) });
  }));
  const BUBBLE_PAD_X = v("space.3"), BUBBLE_PAD_Y = v("space.1");
  const bubblePill = (c, area, height) => {
    const text = bubbleText.get(c) ?? { width: 0, height: 0 };
    const width = Math.min(text.width + 2 * BUBBLE_PAD_X, area.width - m.gap);
    const pillHeight = Math.min(text.height + 2 * BUBBLE_PAD_Y, height - m.gap);
    return { x: area.x + (area.width - m.gap - width) / 2, y: area.y + (height - pillHeight) / 2, width, height: pillHeight };
  };
  m.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell) return;
      const l = m.layouts[r][c],
        height = sum(m.heights.slice(r, r + cell.rowSpan)),
        area = { x: xs[c], y: ys[r], width: m.widths[c], height };
      const cellId = stableId(id, "cell", r, c),
        data = {
          row: r,
          column: c,
          cellType: cell.type,
          rowSpan: cell.rowSpan,
          scale: cell.scale,
          value: cell.value,
          labelDisplay: cell.labelDisplay,
          numberDisplay: cell.numberDisplay,
        };
      const categoryTotal = props.treatment === "categories" && (m.rows[r].style ?? props.rowStyle) === "total";
      const band = categoryTotal ? t("color.surfaceMuted") : rowBand(m.rows[r].style ?? props.rowStyle);
      let fill = null;
      if (cell.type === "category" && categorySurface(cell, props) === "primary")
        fill = primary;
      // `surface: "bubble"` sets the value in a filled pill rather than a
      // tinted cell - the same device the change annotation uses on a chart, so
      // one column of an otherwise flat table carries the emphasis.
      const bubble = cell.type === "highlight" && cell.surface === "bubble";
      if (cell.type === "highlight") fill = bubble ? primary : t("color.componentPrimaryTint");
      if (cell.type === "heatmap")
        fill = heatFill(cell.scaleRecord, cell.value);
      if (cell.highlight === true) {
        if (cell.type === "heatmap")
          throw new Error(
            "Use an outline outside heatmap cells to preserve the declared colour scale",
          );
        fill = t("color.componentPrimaryTint");
      }
      if (categoryTotal) fill = c === 0 ? t("color.accent") : null;
      if (fill)
        nodes.push(
          rectPrimitive({
            id: cellId,
            role: bubble ? "table-bubble" : "table-cell",
            frame: bubble
              ? bubblePill(c, area, height)
              : {
                  ...area,
                  y: area.y + m.gap / 2,
                  height: area.height - m.gap,
                  width: area.width - m.gap,
                },
            style: bubble
              ? { fill, stroke: "none", lineWidth: t("line.hairline"), radius: t("radius.round") }
              : box(fill),
            data,
          }),
        );
      // `tone: "positive" | "negative"` on a text cell colours a signed change
      // (the "difference to prior year" rows of the financial tables).
      const color = fill ? foreground(fill) : band ? foreground(band) : cell.tone === "positive" ? t("color.positive") : cell.tone === "negative" ? t("color.negative") : ink;
      const inner = {
        x: area.x + m.padding,
        y: area.y + m.paddingY,
        width: area.width - 2 * m.padding,
        height: height - 2 * m.paddingY,
      };
      if (cell.blank) {
        // nothing to draw: a group row's continuation cells
      } else if (cell.type === "rag") {
        const { width: pw, height: ph, color: pc } = l.pill;
        const px0 = area.x + (area.width - m.gap - pw) / 2, py0 = area.y + (height - ph) / 2;
        nodes.push(rectPrimitive({ id: stableId(cellId, "pill"), role: "table-status-pill", frame: { x: px0, y: py0, width: pw, height: ph }, style: { fill: pc, stroke: "none", lineWidth: t("line.hairline"), radius: t("radius.round") }, data: { ...data, state: cell.value } }));
        putText(stableId(cellId, "pill-label"), "table-status-label", { x: px0, y: py0 + (ph - l.blocks[0].height) / 2, width: pw }, l.blocks[0], textStyle(true, white, "center", "type.label"), { ...data, state: cell.value });
      } else if (cell.type === "lights") {
        const { dot, gap } = l.lights, total = 3 * dot + 2 * gap;
        const x0 = area.x + (area.width - m.gap - total) / 2, y0 = area.y + (height - dot) / 2;
        ["red", "amber", "green"].forEach((lamp, i) => nodes.push(ellipsePrimitive({ id: stableId(cellId, "lamp", lamp), role: "table-lamp", frame: { x: x0 + i * (dot + gap), y: y0, width: dot, height: dot }, style: { fill: cell.value === lamp ? t(LIGHT_STATES[lamp]) : t("color.chartGrid"), stroke: "none", lineWidth: t("line.hairline"), radius: t("radius.round") }, data: { ...data, lamp, lit: cell.value === lamp } })));
      } else if (cell.type === "progress") {
        const { value, labelWidth, barHeight } = l.progress;
        const trackWidth = inner.width - labelWidth - m.gap, y0 = area.y + (height - barHeight) / 2;
        nodes.push(rectPrimitive({ id: stableId(cellId, "track"), role: "table-progress-track", frame: { x: inner.x, y: y0, width: trackWidth, height: barHeight }, style: box(t("color.chartGrid")), data }));
        if (value > 0) nodes.push(rectPrimitive({ id: stableId(cellId, "fill"), role: "table-progress-fill", frame: { x: inner.x, y: y0, width: trackWidth * value / 100, height: barHeight }, style: box(primary), data: { ...data, value } }));
        putText(stableId(cellId, "progress-label"), "table-progress-label", { x: inner.x + trackWidth + m.gap, y: area.y + (height - l.blocks[0].height) / 2, width: labelWidth }, l.blocks[0], textStyle(true, color, "right", "type.label"), data);
      } else if (cell.type === "dot") {
        const { size, on } = l.mark, x0 = area.x + (area.width - m.gap - size) / 2, y0 = area.y + (height - size) / 2;
        nodes.push(ellipsePrimitive({ id: stableId(cellId, "dot"), role: "table-dot", frame: { x: x0, y: y0, width: size, height: size }, style: { fill: on ? primary : "none", stroke: on ? "none" : t("color.rule"), lineWidth: t("line.hairline"), radius: t("radius.round") }, data: { ...data, on } }));
      } else if (cell.type === "trend") {
        const { size, key } = l.trend, x0 = area.x + (area.width - m.gap - size) / 2, y0 = area.y + (height - size) / 2;
        const color = t(TREND_STATES[key].color);
        nodes.push(ellipsePrimitive({ id: stableId(cellId, "trend-ring"), role: "table-trend", frame: { x: x0, y: y0, width: size, height: size }, style: { fill: "none", stroke: color, lineWidth: t("line.standard"), radius: t("radius.round") }, data: { ...data, trend: key } }));
        const glyph = measure(TREND_STATES[key].glyph, size, true, "type.compact");
        putText(stableId(cellId, "trend-glyph"), "table-trend-glyph", { x: x0, y: y0 + (size - glyph.height) / 2, width: size }, glyph, textStyle(true, color, "center", "type.compact"), { ...data, trend: key });
      } else if (cell.type === "check") {
        const { size, on } = l.mark, x0 = area.x + (area.width - m.gap - size) / 2, y0 = area.y + (height - size) / 2;
        nodes.push(...stateMarker({ id: stableId(cellId, "check"), role: "table-check", x: x0, y: y0, size, state: on ? "yes" : "no", data }));
      } else if (cell.type === "logo") {
        const logo = mediaNode({id:stableId(cellId,"logo"),frame:{x:inner.x,y:area.y+(height-l.height)/2,width:inner.width,height:l.height},props:cell.media,role:"table-logo"});
        logo.data = {...logo.data,...data,sharedHeight:l.height};
        nodes.push(logo);
      } else if (cell.type === "implication") {
        // `draw: false` keeps the gutter and leaves the row unmarked: the
        // `single` treatment draws one chevron for the whole table rather than
        // repeating it down every row.
        const diameter = v("icon.medium"),
          x = area.x + area.width / 2,
          y = area.y + height / 2;
        const arrowData = {
          ...data,
          relation: "implies",
          arrowVariant: "disc-chevron",
        };
        if (cell.draw !== false) nodes.push(
          ellipsePrimitive({
            id: stableId(cellId, "arrow", 0),
            role: "table-implication",
            frame: {
              x: x - diameter / 2,
              y: y - diameter / 2,
              width: diameter,
              height: diameter,
            },
            style: box(primary),
            data: { ...arrowData, arrowPart: 0 },
          }),
        );
        (cell.draw === false ? [] : [
          [x - diameter * 0.11, y - diameter * 0.23, x + diameter * 0.12, y],
          [x + diameter * 0.12, y, x - diameter * 0.11, y + diameter * 0.23],
        ]).forEach(([x1, y1, x2, y2], part) =>
          nodes.push(
            linePrimitive({
              id: stableId(cellId, "arrow", part + 1),
              x1,
              y1,
              x2,
              y2,
              role: "table-implication",
              style: {
                stroke: foreground(primary),
                lineWidth: t("line.standard"),
              },
              data: { ...arrowData, arrowPart: part + 1 },
            }),
          ),
        );
      } else if (bubble) {
        // The figure sits centred in its pill, not on the cell's own alignment:
        // a column of identical pills whose numbers are not on one centre line
        // reads as a column of near-misses.
        const pill = bubblePill(c, area, height);
        putText(stableId(cellId, "bubble-label"), "table-bubble-label",
          { x: pill.x, y: pill.y + (pill.height - l.blocks[0].height) / 2, width: pill.width },
          l.blocks[0], textStyle(true, color, "center", l.size), data);
      } else if (cell.type === "bars") {
        const plot = inner.width - l.labelWidth - m.gap,
          scale = cell.scaleRecord,
          xScale = value => inner.x + plot * (value - scale.min) / (scale.max - scale.min),
          zeroX = xScale(0),
          contentY = inner.y + (inner.height - l.height) / 2;
        if (scale.min < 0) nodes.push(line(stableId(cellId, "zero"), zeroX, area.y, zeroX, area.y + height, "table-bar-axis", { ...data, domain: [scale.min, scale.max] }));
        cell.values.forEach((value, i) => {
          const y = contentY + i * (l.rowHeight + m.gap),
            barHeight = v("space.4");
          if (value !== 0)
            nodes.push(
              rectPrimitive({
                id: stableId(cellId, "bar", i),
                role: "table-bar",
                frame: {
                  x: Math.min(zeroX, xScale(value)),
                  y: y + (l.rowHeight - barHeight) / 2,
                  width: Math.abs(xScale(value) - zeroX),
                  height: barHeight,
                },
                style: {
                  ...box(barColor(scale, i)),
                  ...((fill || band) && contrastRatio(tokenValue(barColor(scale, i)), tokenValue(fill || band)) < 3
                    ? { stroke: foreground(fill || band), lineWidth: t("line.hairline") } : {}),
                },
                data: { ...data, series: i, value, zeroX, domain: [scale.min, scale.max] },
              }),
            );
          const label = measure(cell.labels?.[i] ?? formatValue(value, scale), l.labelWidth, true, l.size);
          putText(
            stableId(cellId, "value", i),
            "table-cell-text",
            { x: inner.x + plot + m.gap, y, width: l.labelWidth },
            label,
            {
              ...chartAnnotationStyle(),
              ...textStyle(true, color, "right", l.size),
            },
            data,
          );
        });
      } else {
        let y = inner.y;
        if (
          m.stretched ||
          ["category", "number", "binary", "harvey", "heatmap"].includes(
            cell.type,
          )
        )
          y = inner.y + (inner.height - l.height) / 2;
        if (l.inlineSectionMarker) y += (l.height - l.blockHeight) / 2;
        if (cell.type === "binary") {
          const s = l.marker,
            markY = area.y + (height - s) / 2,
            x =
              cell.labelDisplay === "none"
                ? area.x + (area.width - s) / 2
                : inner.x,
            cy = markY + s / 2,
            pad = s * 0.16;
          const points =
            cell.value === "yes"
              ? [
                  [x + pad, cy, x + s * 0.4, markY + s - pad],
                  [x + s * 0.4, markY + s - pad, x + s - pad, markY + pad],
                ]
              : cell.value === "no"
                ? [
                    [x + pad, markY + pad, x + s - pad, markY + s - pad],
                    [x + pad, markY + s - pad, x + s - pad, markY + pad],
                  ]
                : [[x + pad, cy, x + s - pad, cy]];
          points.forEach(([x1, y1, x2, y2], k) =>
            nodes.push(
              linePrimitive({
                id: stableId(cellId, "binary", k),
                x1,
                y1,
                x2,
                y2,
                role: "table-binary-mark",
                style: { stroke: ink, lineWidth: t("line.standard") },
                data,
              }),
            ),
          );
        }
        if (cell.type === "harvey" && !missing(cell.value)) {
          // The same size the measurement reserved. A dense table reserves the
          // small marker and this drew the medium one, so the disc overlapped
          // the word beside it - visible the moment a twelve-row scorecard got
          // a rating column, which is the table this treatment is for.
          const discSize = l.marker ?? v("icon.medium");
          const disc = {
            x: inner.x,
            y,
            width: discSize,
            height: discSize,
          };
          nodes.push(
            ellipsePrimitive({
              id: stableId(cellId, "track"),
              role: "table-rating-track",
              frame: disc,
              style: box(t("color.chartGrid")),
              data,
            }),
          );
          if (cell.value === 4)
            nodes.push(
              ellipsePrimitive({
                id: stableId(cellId, "sector"),
                role: "table-rating-sector",
                frame: disc,
                style: box(primary),
                data,
              }),
            );
          else if (cell.value > 0)
            nodes.push(
              wedgePrimitive({
                id: stableId(cellId, "sector"),
                role: "table-rating-sector",
                frame: disc,
                startAngle: -90,
                endAngle: -90 + cell.value * 90,
                style: box(primary),
                data,
              }),
            );
        }
        if (cell.type === "number" && l.numberDisplay !== "plain") {
          const diameter = l.numberMarker,
            width = l.numberWidth,
            cx = area.x + (area.width - m.gap) / 2,
            cy = area.y + height / 2,
            numberData = { ...data, numberDisplay: l.numberDisplay };
          nodes.push(
            ellipsePrimitive({
              id: stableId(cellId, "number-circle"),
              role: "table-number-circle",
              frame: {
                x: cx - width / 2,
                y: cy - diameter / 2,
                width,
                height: diameter,
              },
              style: {
                fill: primary,
                stroke: "none",
                lineWidth: t("line.hairline"),
                radius: t("radius.round"),
              },
              data: numberData,
            }),
          );
          putText(
            stableId(cellId, "number-value"),
            "table-number-value",
            { x: cx - width / 2, y: cy - l.blocks[0].height / 2, width },
            l.blocks[0],
            textStyle(true, foreground(primary), "center", l.size),
            numberData,
          );
        } else {
          if (l.lead) {
            putText(
              stableId(id, "cell-lead", r, c),
              "table-cell-text",
              { x: inner.x, y, width: inner.width },
              l.lead,
              textStyle(true, color, cell.align ?? "left", l.size),
              data,
            );
            y += l.lead.height + m.gap;
          }
          l.blocks.forEach((block, k) => {
            if (cell.type === "bullets")
              nodes.push(
                rectPrimitive({
                  id: stableId(cellId, "bullet", k),
                  role: "table-bullet",
                  frame: {
                    x: inner.x,
                    y: y + (block.lineHeight - v("space.1")) / 2,
                    width: v("space.1"),
                    height: v("space.1"),
                  },
                  style: box(color),
                  data,
                }),
              );
            const alignment =
              cell.type === "heatmap"
                ? "center"
                : cell.type === "number"
                  ? (cell.align ?? "right")
                  : (cell.align ?? "left");
            putText(
              stableId(id, "cell-text", r, c, k),
              "table-cell-text",
              { x: inner.x + l.offset, y, width: inner.width - l.offset },
              block,
              textStyle(l.bold, color, alignment, l.size),
              data,
            );
            y += block.height + m.gap;
          });
          if (l.sub)
            putText(
              stableId(id, "cell-sub", r, c),
              "table-cell-sub",
              { x: inner.x + l.offset, y: y - m.gap, width: inner.width - l.offset },
              l.sub,
              textStyle(false, t("color.textSecondary"), cell.align ?? "left", l.size === "type.label" ? "type.label" : "type.label"),
              data,
            );
        }
      }
      if (cell.sectionNumber !== undefined) {
        // The deck's one numbered disc, at the left of the cell on the label's
        // centre line; reversed (white disc, primary numeral) on a filled box.
        const diameter = m.sectionMarkerSize;
        nodes.push(...numberMarker({
          id: stableId(cellId, "section"),
          role: "table-section-marker",
          labelRole: "table-section-number",
          x: inner.x,
          y: inner.y + inner.height / 2 - diameter / 2,
          size: diameter,
          number: cell.sectionNumber,
          reverse: fill === primary,
          data: { ...data, sectionNumber: cell.sectionNumber, placement: "inline-start" },
        }));
      }
      if (cell.type === "category" && cell.icon) {
        // The icon sits where the label starts: alone at the cell's left edge,
        // or just after the numbered disc when the row carries both.
        const size = Math.round(m.sectionMarkerSize * 1.5);
        const x = inner.x + (cell.sectionNumber !== undefined ? m.sectionMarkerSize + m.gap : 0);
        nodes.push(...iconMarker({ id: stableId(cellId, "icon"), role: "table-cell-icon", x, y: inner.y + inner.height / 2 - size / 2, size, icon: cell.icon, tone: fill === primary ? "inverse" : "accent", data: { ...data, icon: cell.icon } }));
      }
      if (cell.type !== "implication" && r + cell.rowSpan < m.rows.length) {
        // One continuous rule per row unless the row is a run of filled
        // category boxes, whose slits are part of the design.
        const continuous = props.treatment !== "categories" && cell.rowSpan === 1 && !m.columns.some((col) => col.type === "implication");
        if (zebra && continuous) { /* zebra bands replace the row rules */ } else if (!continuous || c === 0) nodes.push(
          line(
            stableId(cellId, "rule"),
            area.x,
            area.y + height,
            continuous ? frame.x + frame.width - m.gap : area.x + area.width - m.gap,
            area.y + height,
            "table-rule",
            { ...data, rule: "row" },
          ),
        );
      }
    }),
  );
  let y =
    frame.y + m.headerHeight + sum(m.heights) + v("space.4");
  m.legends.forEach(
    ({ id: scaleId, scale, layout, entries, height: legendHeight }) => {
      const legendTop = y;
      putText(
        stableId(id, "legend", scaleId),
        "table-legend",
        { x: frame.x, y, width: frame.width },
        layout,
        textStyle(false, ink, "left", m.textSize),
      );
      y += layout.height + m.gap;
      if (scale.type === "heatmap") {
        const count = scale.max - scale.min + 1,
          slot = Math.min(v("space.8"), frame.width / count);
        if (slot < v("icon.medium"))
          throw new Error(
            "Heatmap domain is too large for a readable same-slide legend",
          );
        for (let value = scale.min; value <= scale.max; value++) {
          const fill = heatFill(scale, value),
            area = {
              x: frame.x + (value - scale.min) * slot,
              y,
              width: slot - m.gap,
              height: v("icon.medium"),
            };
          nodes.push(
            rectPrimitive({
              id: stableId(id, "legend-swatch", scaleId, value),
              role: "table-cell",
              frame: area,
              style: box(fill),
            }),
          );
          const label = measure(String(value), area.width, true, m.textSize);
          putText(
            stableId(id, "legend-value", scaleId, value),
            "table-cell-text",
            { ...area, y: y + (area.height - label.height) / 2 },
            label,
            textStyle(true, foreground(fill), "center", m.textSize),
          );
        }
        y += v("icon.medium") + m.gap;
      } else if (scale.type === "bars") {
        entries.forEach(
          ({ index: i, label, x: offsetX, y: offsetY, swatch }) => {
            const x = frame.x + offsetX,
              rowY = y + offsetY;
            nodes.push(
              rectPrimitive({
                id: stableId(id, "legend-swatch", scaleId, i),
                role: "table-legend-swatch",
                frame: {
                  x,
                  y: rowY + (v("icon.medium") - swatch) / 2,
                  width: swatch,
                  height: swatch,
                },
                style: box(barColor(scale, i)),
              }),
            );
            putText(
              stableId(id, "legend-series", scaleId, i),
              "table-legend",
              { x: x + swatch + m.gap, y: rowY, width: label.width + 1 },
              label,
              textStyle(false, ink, "left", m.textSize),
            );
          },
        );
      }
      y = legendTop + legendHeight;
    },
  );
  return { nodes };
}
