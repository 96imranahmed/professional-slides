// Small multiples: one small chart a member, all of one kind on one scale, in
// a trellis of up to twelve - the regions' trends side by side, each segment's
// mix, every line's punctuality by month - where a single chart of twelve
// series is a tangle and twelve pages are eleven too many.
//
//   chart.small-multiples
//     mark        "column" (the default), "bar" or "line": every panel draws the same mark
//     categories  the axis every panel shares - periods for columns and lines, members for bars
//     items       2 to 12 panels, each { label, values, focus?, reference?, note? }: `values` one a category (null for a
//                 gap in a line), `focus` the category to set in the accent, `reference` a value to rule across the panel
//     highlights  [{ category: "<item label>" }]: the panel the page is about, its marks in the accent, the rest navy
//     reference   "average": each panel's own mean ruled across it and named "Ø" - a value the reader compares the
//                 marks with; or one number for every panel
//     scale       "shared" (the default): one domain for every panel, so equal heights are equal values; "own" gives
//                 each panel its own, for members of different sizes whose shapes are compared
//     rowLabels, columnLabels
//                 header labels for a grid read both ways - regions down, segments across - the items in reading
//                 order, a row at a time
//
// Every panel's axis is the same, so the category labels are set once: under
// the bottom row (columns, lines) or beside the left column (bars). Values
// print on the marks while they are few enough to read in a panel - six
// columns or bars, or a line's last value - and the shared scale says the rest.
import { ellipsePrimitive, linePrimitive, rectPrimitive, stableId, textPrimitive, token } from "./core.mjs";
import { formatValue } from "./value-format.mjs";
import { measureAt } from "./draw.mjs";
import { AXIS_LABEL, CHART_LABEL, FONT, GRID, INK, SECONDARY, fillStyle, labelBold, lineStyle, numericBounds, textStyle } from "./chart-axes.mjs";

export const SMALL_MULTIPLES = Object.freeze({ min: 2, max: 12, marks: Object.freeze(["column", "bar", "line"]) });
const ACCENT = token("color.accent");
const GAP_X = 18, GAP_Y = 16, TITLE = 18, AXIS = 16, HEADER = 20;
// Values print on a panel's marks while they are this few: past it a panel's figures crowd its plot.
const LABELLED_MARKS = 6;
const measure = (text, width, bold = false, size = CHART_LABEL) => measureAt(String(text), width, { size, bold, font: FONT });

/** The props checked: the mark, the categories, the panels, the grid and the scale. */
function normalized(props = {}) {
  const mark = props.mark ?? "column";
  if (!SMALL_MULTIPLES.marks.includes(mark)) throw new Error(`small multiples draw one mark in every panel: mark is ${SMALL_MULTIPLES.marks.map((m) => `"${m}"`).join(", ")}`);
  const categories = (props.categories || []).map(String);
  if (categories.length < 2) throw new Error("small multiples share one axis of two or more `categories`");
  const items = props.items || [];
  if (!Array.isArray(items) || items.length < SMALL_MULTIPLES.min || items.length > SMALL_MULTIPLES.max)
    throw new Error(`small multiples hold ${SMALL_MULTIPLES.min} to ${SMALL_MULTIPLES.max} panels (\`items\`); this has ${Array.isArray(items) ? items.length : 0} - past twelve, group the members or show the field as a distribution`);
  const labels = new Set();
  for (const [at, item] of items.entries()) {
    if (!item || typeof item.label !== "string" || !item.label.trim()) throw new Error(`panel ${at + 1} needs its \`label\``);
    if (labels.has(item.label)) throw new Error(`two panels are labelled "${item.label}"`);
    labels.add(item.label);
    if (!Array.isArray(item.values) || item.values.length !== categories.length || item.values.some((v) => v !== null && !Number.isFinite(v)))
      throw new Error(`panel "${item.label}" carries one value a category (${categories.length})${mark === "line" ? ", null for a gap" : ""}`);
    if (mark !== "line" && item.values.some((v) => v === null)) throw new Error(`panel "${item.label}" leaves a ${mark} empty; a missing value is 0, or the panel draws a line`);
    if (item.focus !== undefined && !categories.includes(String(item.focus))) throw new Error(`panel "${item.label}" focuses "${item.focus}", which is not a category`);
    if (item.reference !== undefined && !Number.isFinite(item.reference)) throw new Error(`panel "${item.label}": reference is a value to rule across it`);
  }
  for (const h of props.highlights || []) if (!labels.has(String(h?.category ?? h))) throw new Error(`small multiples highlight a panel by its label; "${h?.category ?? h}" is not one`);
  if ((props.highlights || []).length >= items.length) throw new Error("highlighting every panel marks none of them");
  const reference = props.reference;
  if (reference !== undefined && reference !== "average" && !Number.isFinite(reference)) throw new Error("reference is \"average\" (each panel's own mean) or one value for every panel");
  const scale = props.scale ?? "shared";
  if (!["shared", "own"].includes(scale)) throw new Error("scale is \"shared\" (one domain, the default) or \"own\" (each panel its own)");
  const rowLabels = props.rowLabels, columnLabels = props.columnLabels;
  if ((rowLabels === undefined) !== (columnLabels === undefined)) throw new Error("a grid read both ways names its rows and its columns: rowLabels and columnLabels together");
  if (rowLabels && (!Array.isArray(rowLabels) || !Array.isArray(columnLabels) || rowLabels.length * columnLabels.length !== items.length))
    throw new Error(`rowLabels and columnLabels head a grid of ${rowLabels?.length ?? 0} by ${columnLabels?.length ?? 0}; the items fill it in reading order, so there are ${(rowLabels?.length ?? 0) * (columnLabels?.length ?? 0)} of them (this has ${items.length})`);
  return { mark, categories, items, reference, scale, rowLabels: rowLabels?.map(String), columnLabels: columnLabels?.map(String) };
}

/** How many panels a row holds: the count whose cells come closest to the shape the mark reads best in. */
function columnsFor(count, frame, mark, given) {
  if (given) return given;
  const aspect = mark === "bar" ? 1.1 : 1.6;
  let best = 1, error = Infinity;
  for (let c = 1; c <= Math.min(6, count); c += 1) {
    const rows = Math.ceil(count / c), w = frame.width / c, h = (frame.height ?? frame.width * 0.45) / rows;
    const miss = Math.abs(Math.log((w / h) / aspect)) + (rows * c - count) * 0.15;
    if (miss < error) { best = c; error = miss; }
  }
  return best;
}

/** The trellis laid out: the grid, each cell's frame and its plot, and the scale. */
export function smallMultiplesLayout(frameIn, props = {}) {
  const spec = normalized(props);
  const { mark, categories, items, rowLabels, columnLabels } = spec;
  // Measured at a width alone, the trellis is as tall as its rows need at the shape its mark reads best in, and no shorter.
  const measuring = !Number.isFinite(frameIn.height);
  const guess = { ...frameIn, height: Math.round(frameIn.width * 0.45) };
  const columns = columnLabels ? columnLabels.length : columnsFor(items.length, measuring ? guess : frameIn, mark, props.columns);
  const rows = Math.ceil(items.length / columns);
  const frame = measuring ? { ...frameIn, height: (columnLabels ? HEADER : 0) + (mark === "bar" ? 0 : AXIS) + rows * Math.max(mark === "bar" ? categories.length * 10 + TITLE + 24 : 96, ((frameIn.width - (columns - 1) * GAP_X) / columns) / (mark === "bar" ? 1.1 : 1.6)) + (rows - 1) * GAP_Y } : frameIn;
  const rowGutter = rowLabels ? Math.min(140, Math.ceil(Math.max(...rowLabels.map((l) => measure(l, 140, true).width))) + 12) : 0;
  const categoryGutter = mark === "bar" ? Math.min(120, Math.ceil(Math.max(...categories.map((c) => measure(c, 120, false, AXIS_LABEL).width))) + 8) : 0;
  const top = frame.y + (columnLabels ? HEADER : 0);
  const left = frame.x + rowGutter + categoryGutter;
  const bottomAxis = mark === "bar" ? 0 : AXIS;
  const cellW = (frame.x + frame.width - left - (columns - 1) * GAP_X) / columns;
  const cellH = (frame.y + frame.height - top - bottomAxis - (rows - 1) * GAP_Y) / rows;
  const titled = !rowLabels;
  const minPlot = mark === "bar" ? categories.length * 8 : 40;
  if (cellW < 90 || cellH - (titled ? TITLE : 0) - 16 < minPlot) throw new Error(`${items.length} panels in ${rows} rows of ${columns} leave each ${Math.floor(cellW)} by ${Math.floor(cellH)}px - too small to read; give the chart the page's height (commentary "none" or "below"), fewer panels, or ${mark === "bar" ? "fewer categories" : "fewer rows"}`);
  const values = items.flatMap((item) => item.values.filter(Number.isFinite));
  const shared = numericBounds([...values, ...(Number.isFinite(spec.reference) ? [spec.reference] : [])], { axis: "y", includeZero: mark !== "line", tight: true });
  const cells = items.map((item, at) => {
    const col = at % columns, row = Math.floor(at / columns);
    const cell = { x: left + col * (cellW + GAP_X), y: top + row * (cellH + GAP_Y), width: cellW, height: cellH };
    // Columns that print their values keep a line over the tallest for its figure.
    const headroom = mark === "column" && (categories.length <= LABELLED_MARKS || item.focus !== undefined) ? 16 : 0;
    const plot = { x: cell.x, y: cell.y + (titled ? TITLE : 0) + 4 + headroom, width: cell.width - (mark === "line" ? 40 : mark === "bar" ? 34 : 0), height: cell.height - (titled ? TITLE : 0) - 8 - headroom };
    // An own scale still holds the rule the panel draws: its own reference, or else the chart's.
    const ruled = Number.isFinite(item.reference) ? item.reference : Number.isFinite(spec.reference) ? spec.reference : null;
    const own = spec.scale === "own" ? numericBounds([...item.values.filter(Number.isFinite), ...(ruled === null ? [] : [ruled])], { axis: "y", includeZero: mark !== "line", tight: true }) : shared;
    return { item, at, col, row, cell, plot, bounds: own };
  });
  return { ...spec, frame, columns, rows, cells, rowGutter, categoryGutter, top, left, height: frame.height };
}

/** One panel's marks: its columns, bars or line, their labels where few, its focus and its reference rule. */
function panelNodes({ id, layout, panel, highlighted, props }) {
  const { mark, categories, reference } = layout;
  const { item, plot, bounds } = panel;
  const nodes = [];
  // The panel the page is about in the accent, the rest in the house's primary: a series colour may share the accent's hue.
  const color = highlighted ? ACCENT : token("color.componentPrimary");
  const key = (...parts) => stableId(id, "panel", panel.at, ...parts);
  const n = categories.length;
  const along = mark === "bar" ? plot.height : plot.width;
  const slot = along / n;
  const span = (v) => (v - bounds.min) / bounds.span;
  const labelled = n <= LABELLED_MARKS && mark !== "line";
  // The axis the marks stand on, or the baseline under a line.
  nodes.push(mark === "bar"
    ? linePrimitive({ id: key("axis"), role: "chart-axis", x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, style: lineStyle(INK) })
    : linePrimitive({ id: key("axis"), role: "chart-axis", x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, style: lineStyle(mark === "line" ? GRID : INK) }));
  if (mark === "line") {
    const x = (i) => plot.x + (n === 1 ? plot.width / 2 : (plot.width * i) / (n - 1));
    const y = (v) => plot.y + plot.height - span(v) * plot.height;
    item.values.forEach((v, i) => {
      const next = item.values[i + 1];
      if (Number.isFinite(v) && Number.isFinite(next)) nodes.push(linePrimitive({ id: key("segment", i), role: "chart-line", x1: x(i), y1: y(v), x2: x(i + 1), y2: y(next), style: lineStyle(color, token("line.standard")), data: { item: item.label } }));
    });
    const last = item.values.map((v, i) => [v, i]).filter(([v]) => Number.isFinite(v)).at(-1);
    if (last) {
      nodes.push(ellipsePrimitive({ id: key("end"), role: "chart-marker", frame: { x: x(last[1]) - 3.5, y: y(last[0]) - 3.5, width: 7, height: 7 }, style: fillStyle(color), data: { item: item.label, category: categories[last[1]], value: last[0] } }));
      nodes.push(textPrimitive({ id: key("value"), role: "data-label", frame: { x: x(last[1]) + 6, y: y(last[0]) - 10, width: 40, height: 20 }, text: formatValue(last[0], props), style: textStyle(CHART_LABEL, INK, labelBold(), "left"), data: { item: item.label, category: categories[last[1]], value: last[0] } }));
    }
    if (item.focus !== undefined) {
      const i = categories.indexOf(String(item.focus)), v = item.values[i];
      if (Number.isFinite(v)) nodes.push(ellipsePrimitive({ id: key("focus"), role: "chart-marker", frame: { x: x(i) - 4.5, y: y(v) - 4.5, width: 9, height: 9 }, style: fillStyle(ACCENT), data: { item: item.label, category: item.focus, value: v, focus: true } }));
    }
  } else {
    const weight = n <= 4 ? 0.7 : 0.62;
    item.values.forEach((v, i) => {
      const at = i * slot + (slot * (1 - weight)) / 2, size = slot * weight;
      const zero = span(Math.max(bounds.min, Math.min(bounds.max, 0))), end = span(v);
      const focus = item.focus !== undefined && String(item.focus) === categories[i];
      const frame = mark === "bar"
        ? { x: plot.x + Math.min(zero, end) * plot.width, y: plot.y + at, width: Math.max(1, Math.abs(end - zero) * plot.width), height: Math.max(2, size) }
        : { x: plot.x + at, y: plot.y + plot.height - Math.max(zero, end) * plot.height, width: Math.max(2, size), height: Math.max(1, Math.abs(end - zero) * plot.height) };
      nodes.push(rectPrimitive({ id: key("mark", i), role: "chart-mark", frame, style: fillStyle(focus ? ACCENT : color), data: { item: item.label, category: categories[i], value: v, ...(focus ? { focus: true } : {}) } }));
      if (labelled || focus) {
        const text = formatValue(v, props);
        const box = mark === "bar"
          ? { x: frame.x + frame.width + 4, y: frame.y + frame.height / 2 - 9, width: 32, height: 18 }
          : { x: frame.x - 8, y: frame.y - 18, width: frame.width + 16, height: 16 };
        nodes.push(textPrimitive({ id: key("value", i), role: "data-label", frame: box, text, style: textStyle(CHART_LABEL, INK, labelBold(), mark === "bar" ? "left" : "center"), data: { item: item.label, category: categories[i], value: v } }));
      }
    });
  }
  // The reference: a value given for the panel or the chart, or the panel's own mean, ruled across it and named.
  const values = item.values.filter(Number.isFinite);
  const ref = Number.isFinite(item.reference) ? item.reference : reference === "average" ? values.reduce((a, b) => a + b, 0) / values.length : Number.isFinite(reference) ? reference : null;
  if (ref !== null) {
    const at = span(ref);
    const text = reference === "average" && !Number.isFinite(item.reference) ? `Ø ${formatValue(ref, props)}` : formatValue(ref, props);
    if (mark === "bar") {
      const x = plot.x + at * plot.width;
      nodes.push(linePrimitive({ id: key("reference"), role: "chart-reference-line", x1: x, y1: plot.y - 2, x2: x, y2: plot.y + plot.height, style: lineStyle(SECONDARY, token("line.hairline"), "dash"), data: { item: item.label, value: ref } }));
    } else {
      const y = plot.y + plot.height - at * plot.height;
      nodes.push(linePrimitive({ id: key("reference"), role: "chart-reference-line", x1: plot.x, y1: y, x2: plot.x + plot.width, y2: y, style: lineStyle(SECONDARY, token("line.hairline"), "dash"), data: { item: item.label, value: ref } }));
    }
    const width = Math.ceil(measure(text, 200).width) + 2;
    // Named where it reads as the panel's own figure and touches no mark: a bar panel's under the rule's foot; a column or
    // line panel's at the right of its title, or over its plot where the grid's headers stand in for titles.
    const titled = !layout.rowLabels;
    nodes.push(textPrimitive({ id: key("reference-label"), role: "chart-reference-label", frame: mark === "bar"
      ? { x: Math.min(plot.x + at * plot.width + 3, plot.x + plot.width + 30 - width), y: plot.y + plot.height - 2, width, height: 14 }
      : { x: panel.cell.x + panel.cell.width - width, y: titled ? panel.cell.y + 2 : plot.y - 16, width, height: 14 },
    text, style: { ...textStyle(token("type.compact"), SECONDARY, false, "right"), valign: "top" }, data: { item: item.label, value: ref, reference: true } }));
  }
  return nodes;
}

/** The trellis: headers, each panel's title and marks, and the shared category labels. */
export function smallMultiplesChart({ id, frame, props }) {
  const layout = smallMultiplesLayout(frame, props);
  const { mark, categories, cells, columns, rowLabels, columnLabels, top, left } = layout;
  const highlighted = new Set((props.highlights || []).map((h) => String(h?.category ?? h)));
  const nodes = [];
  if (columnLabels) columnLabels.forEach((label, c) => {
    const cell = cells[c].cell;
    nodes.push(textPrimitive({ id: stableId(id, "column-header", c), role: "category-label", frame: { x: cell.x, y: frame.y, width: cell.width, height: HEADER - 4 }, text: label, style: textStyle(AXIS_LABEL, INK, true, "left"), data: { header: "column" } }));
    nodes.push(linePrimitive({ id: stableId(id, "column-header-rule", c), role: "chart-gridline", x1: cell.x, y1: frame.y + HEADER - 3, x2: cell.x + cell.width, y2: frame.y + HEADER - 3, style: lineStyle(INK, token("line.hairline")) }));
  });
  if (rowLabels) rowLabels.forEach((label, r) => {
    const cell = cells[r * columns].cell, layoutText = measure(label, layout.rowGutter - 12, true);
    nodes.push(textPrimitive({ id: stableId(id, "row-header", r), role: "category-label", frame: { x: frame.x, y: cell.y + cell.height / 2 - layoutText.height / 2, width: layout.rowGutter - 12, height: layoutText.height }, text: layoutText.text,
      style: { ...textStyle(AXIS_LABEL, INK, true, "left"), valign: "top", lineHeight: layoutText.lineHeight, wrap: false }, data: { header: "row", textLayout: layoutText } }));
  });
  for (const panel of cells) {
    const subject = highlighted.has(panel.item.label);
    if (!rowLabels) nodes.push(textPrimitive({ id: stableId(id, "panel", panel.at, "title"), role: "category-label", frame: { x: panel.cell.x, y: panel.cell.y, width: panel.cell.width, height: TITLE }, text: panel.item.label,
      style: textStyle(AXIS_LABEL, subject ? ACCENT : INK, true, "left"), data: { item: panel.item.label, panelTitle: true } }));
    nodes.push(...panelNodes({ id, layout, panel, highlighted: subject, props }));
  }
  // The shared axis, named once: under the bottom row's panels, or beside the left column's.
  const n = categories.length;
  if (mark === "bar") {
    for (const panel of cells.filter((p) => p.col === 0)) {
      const slot = panel.plot.height / n;
      categories.forEach((category, i) => nodes.push(textPrimitive({ id: stableId(id, "category", panel.at, i), role: "category-label", frame: { x: left - layout.categoryGutter, y: panel.plot.y + i * slot + slot / 2 - 8, width: layout.categoryGutter - 6, height: 16 }, text: category, style: textStyle(AXIS_LABEL, SECONDARY, false, "right"), data: { category } })));
    }
  } else {
    const bottom = Math.max(...cells.map((p) => p.row));
    for (const panel of cells.filter((p) => p.row === bottom || (p.row === bottom - 1 && !cells.some((q) => q.row === bottom && q.col === p.col)))) {
      const { plot } = panel, slot = plot.width / n;
      const x = (i) => (mark === "line" ? plot.x + (n === 1 ? plot.width / 2 : (plot.width * i) / (n - 1)) : plot.x + (i + 0.5) * slot);
      const widest = Math.max(...categories.map((c) => measure(c, 400, false, AXIS_LABEL).width));
      const every = Math.max(1, Math.ceil((widest + 6) / Math.max(1, mark === "line" ? plot.width / Math.max(1, n - 1) : slot)));
      categories.forEach((category, i) => {
        if (i % every !== 0 && i !== n - 1) return;
        if (i === n - 1 && i % every !== 0 && (i - Math.floor(i / every) * every) * (plot.width / n) < widest + 6) return;
        const width = Math.ceil(measure(category, 400, false, AXIS_LABEL).width) + 4;
        nodes.push(textPrimitive({ id: stableId(id, "category", panel.at, i), role: "category-label", frame: { x: Math.max(panel.cell.x - 4, Math.min(x(i) - width / 2, panel.cell.x + panel.cell.width - width + 4)), y: plot.y + plot.height + 3, width, height: AXIS - 2 },
          text: category, style: textStyle(AXIS_LABEL, SECONDARY, false, "center"), data: { category } }));
      });
    }
  }
  return nodes;
}
