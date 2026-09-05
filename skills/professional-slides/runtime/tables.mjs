import {
  token,
  tokenValue,
  stableId,
  textPrimitive,
  rectPrimitive,
  ellipsePrimitive,
  wedgePrimitive,
  linePrimitive,
  chartAnnotationStyle,
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { contrastRatio, strongestContrastIndex } from "./palettes.mjs";

// One table compiler. Columns select defaults; individual cells may override the
// encoding (e.g. options as columns with prose and rating rows in the same table).
export const CELL_TYPES = Object.freeze([
  "text",
  "bullets",
  "category",
  "highlight",
  "number",
  "binary",
  "harvey",
  "heatmap",
  "bars",
  "implication",
]);
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
  "color.surface",
  "color.surfaceMuted",
  "color.rule",
  "color.chartGrid",
  "color.positive",
  "color.negative",
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
const measure = (text, width, bold = false, size = "type.body") =>
  measureText(String(text), width, {
    fontFamily: v("font.body"),
    fontSize: v(size),
    bold,
    wrapWidthRatio: 1,
  });
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
  const rows = props.rows.map((row) =>
    Array.isArray(row) ? { cells: row } : row,
  );
  const occupied = rows.map(() => Array(columns.length).fill(false));
  const cells = rows.map((row, r) => {
    if (!Array.isArray(row.cells) || row.cells.length !== columns.length)
      throw new Error(
        `Table row ${r + 1} must have exactly ${columns.length} cells, including null span continuations`,
      );
    if (!["plain", "accented"].includes(row.style ?? props.rowStyle ?? "plain"))
      throw new Error("Unknown table row style");
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
      !Number.isFinite(scale.max) ||
      scale.max <= 0 ||
      scale.min !== 0 ||
      !Array.isArray(scale.series) ||
      !scale.series.length ||
      scale.series.length > 6
    )
      throw new Error(
        "Bar cells require a shared zero-based positive scale and 1 to 6 named series",
      );
    requireText(scale.unit, "bar unit");
    if (
      !Array.isArray(cell.values) ||
      cell.values.length !== scale.series.length ||
      cell.values.some((n) => !Number.isFinite(n) || n < 0 || n > scale.max)
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
    const labels = cell.values.map((n) => String(n));
    const size = bodySize(props);
    const labelWidth = Math.max(
      ...labels.map((s) => measure(s, inner, true, size).width),
      v("space.6"),
    );
    const rowHeight = Math.max(
      marker,
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
  if (cell.type === "binary") {
    cell.labelDisplay =
      cell.labelDisplay ?? cell.scaleRecord.labelDisplay ?? "none";
    texts =
      cell.labelDisplay === "state"
        ? [cell.scaleRecord.states[cell.value]]
        : [];
    offset = texts.length ? marker + gap : 0;
  } else if (cell.type === "harvey") {
    texts = [missing(cell.value) ?? `${cell.value}/4`];
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
  } else {
    texts = [requireText(cell.text, "cell")];
    bold = cell.type === "category" || bold;
  }
  const blocks = texts.map((s) => measure(s, inner - offset, bold, size));
  const blockHeight = blocks.length
    ? sum(blocks.map((b) => b.height)) + (blocks.length - 1) * gap
    : 0;
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
    bold,
    size,
    marker,
    numberMarker,
    numberWidth,
    numberDisplay: cell.numberDisplay,
    height: Math.max(
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
    return `${scale.label} (${scale.unit}, common scale 0–${scale.max})`;
  return `${scale.label}: ${Object.entries(scale.anchors)
    .map(([n, label]) => `${n} = ${label}`)
    .join("; ")}. Missing = Not available; N/A = not applicable.`;
}

function layoutLegend(id, scale, width, size, gap) {
  const text = legendText(scale),
    layout = measure(text, width, false, size);
  const entries = [];
  let extraHeight = scale.type === "heatmap" ? v("icon.medium") + gap : 0;
  if (scale.type === "bars") {
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
    density =
      props.density ??
      (model.rows.length > 10 || model.columns.length > 6
        ? "dense"
        : model.rows.length > 5 || model.columns.length > 4
          ? "compact"
          : "body");
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
  const textSize =
    density === "dense"
      ? "type.label"
      : density === "compact"
        ? "type.compact"
        : "type.body";
  const headers = model.columns.map((c, i) =>
    c.label ? measure(c.label, widths[i] - 2 * padding, true, textSize) : null,
  );
  const headerHeight =
    Math.max(...headers.map((h) => h?.height ?? 0)) + 2 * padding;
  const layouts = model.cells.map((row) =>
    row.map((cell) =>
      cell ? contentLayout(cell, widths[cell.column], tableProps, used) : null,
    ),
  );
  // All rows in a bar column must reserve the same label width so their
  // common numeric domain also has the same physical plot width.
  model.columns.forEach((_, c) => {
    const bars = layouts
      .map((row, r) => (model.cells[r][c]?.type === "bars" ? row[c] : null))
      .filter(Boolean);
    if (!bars.length) return;
    const labelWidth = Math.max(...bars.map((layout) => layout.labelWidth));
    if (widths[c] - 2 * padding - labelWidth - gap < v("space.6"))
      throw new Error("Bar column leaves no usable plot width");
    bars.forEach((layout) => {
      layout.labelWidth = labelWidth;
    });
  });
  const minimumRowHeight = v(
    density === "dense"
      ? "space.5"
      : density === "compact"
        ? "space.6"
        : "space.8",
  );
  const heights = layouts.map((row, r) =>
    Math.max(
      minimumRowHeight,
      ...row.map((l, c) =>
        l && model.cells[r][c].rowSpan === 1 ? l.height + 2 * padding : 0,
      ),
    ),
  );
  const sectionMarkerSize = v("icon.medium");
  // Numbered section markers straddle the horizontal centre of the category
  // cell's top edge. Reserve explicit air above each marked section so the
  // disc never collides with the preceding group or the header rule.
  const topGaps = model.cells.map((row) =>
    row.some((cell) => cell?.sectionNumber !== undefined)
      ? sectionMarkerSize / 2 + gap
      : 0,
  );
  model.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell || cell.rowSpan === 1) return;
      const required = layouts[r][c].height + 2 * padding,
        allocated = sum(heights.slice(r, r + cell.rowSpan));
      if (required > allocated) {
        const extra = (required - allocated) / cell.rowSpan;
        for (let k = r; k < r + cell.rowSpan; k++) heights[k] += extra;
      }
    }),
  );
  const legends = [...used.entries()].map(([id, scale]) =>
    layoutLegend(id, scale, frame.width, textSize, gap),
  );
  // Reserve visible scale bars/swatches and labels together. Never infer row-local scales.
  const legendHeight = sum(legends.map((l) => l.height));
  const height =
    headerHeight +
    sum(topGaps) +
    sum(heights) +
    (legends.length ? v("space.4") + legendHeight : 0);
  if (Number.isFinite(frame.height) && height > frame.height + 0.01)
    throw new Error(
      `Table content needs ${height.toFixed(1)}px, but only ${frame.height}px is allocated; widen, simplify or split the table`,
    );
  return {
    ...model,
    density,
    textSize,
    widths,
    headers,
    headerHeight,
    layouts,
    heights,
    topGaps,
    sectionMarkerSize,
    legends,
    height,
    padding,
    gap,
  };
}

export function renderTable({ id, frame, props }) {
  const m = measureTable({ frame, props }),
    nodes = [],
    xs = m.widths.map((_, c) => frame.x + sum(m.widths.slice(0, c)));
  const ys = m.heights.map(
    (_, r) =>
      frame.y +
      m.headerHeight +
      sum(m.heights.slice(0, r)) +
      sum(m.topGaps.slice(0, r + 1)),
  );
  const putText = (nodeId, role, area, layout, style, data = {}) =>
    nodes.push(
      textPrimitive({
        id: nodeId,
        role,
        frame: { ...area, height: layout.height },
        text: layout.text,
        style: { ...style, lineHeight: layout.lineHeight },
        data: { ...data, textLayout: layout },
      }),
    );
  const header = props.treatment ?? "open";
  if (!["open", "standard"].includes(header))
    throw new Error("Unknown table header treatment");
  m.columns.forEach((column, c) => {
    if (header === "standard")
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
          style: box(ink),
        }),
      );
    if (m.headers[c])
      putText(
        stableId(id, "header-text", c),
        "table-header-text",
        {
          x: xs[c] + m.padding,
          y: frame.y + m.padding,
          width: m.widths[c] - 2 * m.padding,
        },
        m.headers[c],
        textStyle(
          true,
          header === "standard" ? white : ink,
          column.align ?? "left",
          m.textSize,
        ),
      );
    if (column.type !== "implication")
      nodes.push(
        line(
          stableId(id, "header-rule", c),
          xs[c],
          frame.y + m.headerHeight,
          xs[c] + m.widths[c] - m.gap,
          frame.y + m.headerHeight,
        ),
      );
  });
  m.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell) return;
      const l = m.layouts[r][c],
        height =
          sum(m.heights.slice(r, r + cell.rowSpan)) +
          sum(m.topGaps.slice(r + 1, r + cell.rowSpan)),
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
      let fill =
        (m.rows[r].style ?? props.rowStyle) === "accented"
          ? t("color.componentPrimaryTint")
          : null;
      if (cell.type === "category" && (cell.surface ?? "primary") === "primary")
        fill = primary;
      if (cell.type === "highlight") fill = t("color.componentPrimaryTint");
      if (cell.type === "heatmap")
        fill = heatFill(cell.scaleRecord, cell.value);
      if (cell.highlight === true) {
        if (cell.type === "heatmap")
          throw new Error(
            "Use an outline outside heatmap cells to preserve the declared colour scale",
          );
        fill = t("color.componentPrimaryTint");
      }
      if (fill)
        nodes.push(
          rectPrimitive({
            id: cellId,
            role: "table-cell",
            frame: {
              ...area,
              y: area.y + m.gap / 2,
              height: area.height - m.gap,
              width: area.width - m.gap,
            },
            style: box(fill),
            data,
          }),
        );
      const color = fill ? foreground(fill) : ink;
      const inner = {
        x: area.x + m.padding,
        y: area.y + m.padding,
        width: area.width - 2 * m.padding,
        height: height - 2 * m.padding,
      };
      if (cell.type === "implication") {
        // Canonical row implication: an icon-medium primary disc and two
        // editable chevron strokes, with identical geometry in both adapters.
        const diameter = v("icon.medium"),
          x = area.x + area.width / 2,
          y = area.y + height / 2;
        const arrowData = {
          ...data,
          relation: "implies",
          arrowVariant: "disc-chevron",
        };
        nodes.push(
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
        [
          [x - diameter * 0.11, y - diameter * 0.23, x + diameter * 0.12, y],
          [x + diameter * 0.12, y, x - diameter * 0.11, y + diameter * 0.23],
        ].forEach(([x1, y1, x2, y2], part) =>
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
      } else if (cell.type === "bars") {
        const plot = inner.width - l.labelWidth - m.gap,
          scale = cell.scaleRecord;
        cell.values.forEach((value, i) => {
          const y = inner.y + i * (l.rowHeight + m.gap),
            barHeight = v("space.4");
          if (value > 0)
            nodes.push(
              rectPrimitive({
                id: stableId(cellId, "bar", i),
                role: "table-bar",
                frame: {
                  x: inner.x,
                  y: y + (l.rowHeight - barHeight) / 2,
                  width: (plot * value) / scale.max,
                  height: barHeight,
                },
                style: box(barColor(scale, i)),
                data: { ...data, series: i, value, domain: [0, scale.max] },
              }),
            );
          const label = measure(String(value), l.labelWidth, true, l.size);
          putText(
            stableId(cellId, "value", i),
            "table-cell-text",
            { x: inner.x + plot + m.gap, y, width: l.labelWidth },
            label,
            {
              ...chartAnnotationStyle(),
              ...textStyle(true, ink, "right", l.size),
            },
            data,
          );
        });
      } else {
        let y = inner.y;
        if (
          ["category", "number", "binary", "harvey", "heatmap"].includes(
            cell.type,
          )
        )
          y = area.y + (height - l.height) / 2;
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
                style: { stroke: ink, lineWidth: t("line.hairline") },
                data,
              }),
            ),
          );
        }
        if (cell.type === "harvey" && !missing(cell.value)) {
          const disc = {
            x: inner.x,
            y,
            width: v("icon.medium"),
            height: v("icon.medium"),
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
        } else
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
      }
      if (cell.sectionNumber !== undefined) {
        const diameter = m.sectionMarkerSize,
          cx = area.x + (area.width - m.gap) / 2,
          cy = area.y + m.gap / 2,
          markerData = {
            ...data,
            sectionNumber: cell.sectionNumber,
            placement: "top-center",
          };
        nodes.push(
          ellipsePrimitive({
            id: stableId(cellId, "section-marker"),
            role: "table-section-marker",
            frame: {
              x: cx - diameter / 2,
              y: cy - diameter / 2,
              width: diameter,
              height: diameter,
            },
            style: {
              fill: primary,
              stroke: white,
              lineWidth: t("line.standard"),
              radius: t("radius.none"),
            },
            data: markerData,
          }),
        );
        const markerText = measure(
          String(cell.sectionNumber),
          diameter,
          true,
          "type.compact",
        );
        putText(
          stableId(cellId, "section-number"),
          "table-section-number",
          {
            x: cx - diameter / 2,
            y: cy - markerText.height / 2,
            width: diameter,
          },
          markerText,
          textStyle(true, white, "center", "type.compact"),
          markerData,
        );
      }
      if (cell.type !== "implication" && r + cell.rowSpan < m.rows.length) {
        nodes.push(
          line(
            stableId(cellId, "rule"),
            area.x,
            area.y + height,
            area.x + area.width - m.gap,
            area.y + height,
            "table-rule",
            { ...data, rule: "row" },
          ),
        );
      }
    }),
  );
  let y =
    frame.y + m.headerHeight + sum(m.topGaps) + sum(m.heights) + v("space.4");
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
