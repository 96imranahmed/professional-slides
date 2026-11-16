// The data blocks: the metric tile, the legend, the chart callout, the tables
// (table, trend rows, comparison table, heatmap - one renderer, tables.mjs,
// each normalising its own props into it) and the status list.
import { stableId, textPrimitive, token, ellipsePrimitive, tokenValue } from "./core.mjs";
import { setText, drawText, TEXT_ROLE_TOKENS } from "./text-roles.mjs";
import { legendNodes, LEGEND_TOKENS, LEGEND_VARIANTS, LEGEND_PLACEMENTS, QUANTITATIVE_LEGEND_SAMPLE } from "./legends.mjs";
import { renderChartCallout } from "./chart-annotations.mjs";
import { renderTable, measureTable, tableCeiling, TABLE_TOKENS } from "./tables.mjs";
import { TABLE_VARIANTS } from "./table-fixtures.mjs";
import { TABLE_VARIANT_NAMES } from "./table-variants.mjs";
import { DISPLAY, SECONDARY, PRIMARY, BODY, LABEL, textStyle, component, INK, WHITE, HAIRLINE, COMPACT, boxStyle, SECTION_HEADING_TOKENS,
  refineVariantAxes } from "./registry-shared.mjs";

function defineMetric() {
  return component({
    id: "metric",
    category: "data",
    role: "metric",
    tokens: [
      "color.componentPrimary", "color.textSecondary", "font.display", "font.body", "type.metric", "type.deckTitle", "type.body",
      "type.label"
    ],
    preferredSize: { width: 240, height: 140 },
    sample: { value: "74%", label: "(Insert metric label)", delta: "+8 pts" },
    render: ({ id, frame, props }) => ({
      nodes: [
        textPrimitive({
          id: stableId(id, "value"),
          role: "metric-value",
          frame: { x: frame.x, y: frame.y + 6, width: frame.width, height: frame.height * 0.48 },
          text: props.value,
          style: {
            ...textStyle(token(props.variant === "prominent" ? "type.deckTitle" : "type.metric"), PRIMARY, true, "center"),
            fontFamily: DISPLAY
          }
        }),
        textPrimitive({
          id: stableId(id, "label"),
          role: "metric-label",
          frame: { x: frame.x + 8, y: frame.y + frame.height * 0.52, width: frame.width - 16, height: 28 },
          text: props.label,
          style: textStyle(props.variant === "prominent" ? BODY : LABEL, SECONDARY, false, "center")
        }),
        textPrimitive({
          id: stableId(id, "delta"),
          role: "metric-delta",
          frame: { x: frame.x + 8, y: frame.y + frame.height - 30, width: frame.width - 16, height: 24 },
          text: props.delta || "",
          style: textStyle(LABEL, PRIMARY, true, "center")
        })
      ]
    })
  });
}

function defineLegend() {
  return component({ id: "legend", category: "data", role: "legend", tokens: LEGEND_TOKENS, preferredSize: { width: 420, height: 44 }, sample: { items: ["Actual", "Forecast", "Target"] }, render: input => ({ nodes: legendNodes(input) }) });
}

function defineChartCallout() {
  return component({
    id: "chart-callout", category: "data", role: "annotation",
    tokens: ["color.surface", "color.rule", "color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "font.bodySemibold", "weight.semibold", "type.chartAnnotation", "line.hairline", "line.standard", "radius.none", "radius.small"],
    preferredSize: { width: 260, height: 90 },
    sample: { text: "(Insert evidence annotation)", direction: "down" },
    variants: { bordered: {}, borderless: { props: { border: false } } },
    defaultVariant: "bordered", render: renderChartCallout
  });
}

function defineTable() {
  return component({
    id: "table",
    anchor: "top",
    category: "data",
    role: "table",
    tokens: [
      "color.ink", "color.componentPrimary", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body",
      "type.label", "line.hairline", "radius.none"
    ],
    preferredSize: { width: 760, height: 320 },
    sample: {
      columns: ["Metric", "Period A", "Period B"],
      rows: [["Metric 1", "42", "55"], ["Metric 2", "24%", "29%"], ["Metric 3", "180", "236"]]
    },
    render: renderTable
  });
}

function defineTrendRows() {
  return component({
    id: "trend-rows",
    category: "data",
    role: "trend-rows",
    tokens: [
      "color.ink", "color.surface", "color.rule", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline",
      "line.standard", "radius.none"
    ],
    preferredSize: { width: 1160, height: 440 },
    sample: {
      columns: ["Trend", "Description", "Examples"],
      rows: [
        ["(Insert trend 1)", "• (Insert supporting point 1)\n• (Insert supporting point 2)", "• (Insert example)"],
        ["(Insert trend 2)", "• (Insert supporting point 1)", "• (Insert example)"],
        ["(Insert trend 3)", "• (Insert supporting point 1)", "• (Insert example)"]
      ]
    },
    render: renderTable
  });
}

function defineComparisonTable() {
  return component({
    id: "comparison-table",
    category: "data",
    role: "comparison",
    tokens: [
      "color.ink", "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule",
      "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"
    ],
    preferredSize: { width: 820, height: 340 },
    sample: {
      columns: ["Criterion", "Option A", "Option B", "Option C"],
      rows: [
        ["Criterion 1", "Medium", "High", "High"],
        ["Criterion 2", "Low", "Medium", "Low"],
        ["Criterion 3", "Medium", "Medium", "High"]
      ],
      selectedColumn: 3
    },
    render: renderTable
  });
}

function defineHeatmap() {
  return component({
    id: "heatmap", sizing: "fill",
    category: "data",
    role: "heatmap",
    tokens: [
      "color.ink", "color.componentPrimary", "color.componentPrimaryTint", "color.chartSeries1", "color.chartSeries2", "color.surface",
      "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"
    ],
    preferredSize: { width: 760, height: 320 },
    sample: {
      columns: ["Capability", "A", "B", "C", "D"],
      rows: [["Capability 1", 2, 4, 5, 3], ["Capability 2", 3, 3, 4, 2], ["Capability 3", 1, 4, 5, 2]]
    },
    render: renderTable
  });
}

function defineStatusList() {
  return component({
    id: "status-list",
    category: "data",
    role: "status",
    tokens: [
      "color.positive", "color.caution", "color.negative", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label",
      "line.hairline", "radius.round"
    ],
    preferredSize: { width: 600, height: 260 },
    sample: {
      items: [
        { label: "(Insert item 1)", status: "positive" },
        { label: "(Insert item 2)", status: "caution" },
        { label: "(Insert item 3)", status: "negative" }
      ]
    },
    render: ({ id, frame, props }) => ({ nodes: statusListNodes({ id, frame, props }) })
  });
}

// A status list's items are the page's content: each label body text at its reading measure (text-roles.mjs), beside a
// disc whose glyph (a mark) carries the status. A row is as tall as its label or its disc; the rows share the frame's
// height evenly where it has more, and a frame shorter than the rows is refused, naming the item that does not fit.
const STATUS_DISC = 20, STATUS_TEXT_X = 34;
function statusListLayout(frame, props) {
  const items = Array.isArray(props.items) ? props.items : [];
  if (!items.length) throw new Error("A status list needs at least one item");
  const width = frame.width - STATUS_TEXT_X;
  if (width < 80) throw new Error("A status list is too narrow for its labels; give it more width");
  const labels = items.map((item, index) => {
    if (typeof item?.label !== "string" || !item.label.trim()) throw new Error(`Status item ${index + 1} needs a label`);
    return setText("body", item.label, width);
  });
  const rows = labels.map((set) => Math.max(STATUS_DISC, set.height)), gap = tokenValue(token("space.2"));
  return { items, labels, rows, gap, width, height: rows.reduce((sum, row) => sum + row, 0) + gap * (rows.length - 1), texts: labels };
}

function statusListNodes({ id, frame, props }) {
  const L = statusListLayout(frame, props);
  if (L.height > frame.height + 0.01) {
    const at = L.rows.reduce((best, row, index) => (row > L.rows[best] ? index : best), 0);
    throw new Error(`The status list needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px ("${L.items[at].label}" takes ${Math.ceil(L.rows[at])}px); shorten the labels, drop an item, or give the list more height`);
  }
  const extra = (frame.height - L.height) / L.items.length;
  const nodes = [];
  let y = frame.y;
  L.items.forEach((item, index) => {
    const slot = L.rows[index] + extra, label = L.labels[index];
    const fill = item.status === "positive" ? token("color.positive") : item.status === "negative" ? token("color.negative") : token("color.caution");
    const disc = { x: frame.x, y: y + (slot - STATUS_DISC) / 2, width: STATUS_DISC, height: STATUS_DISC };
    nodes.push(ellipsePrimitive({ id: stableId(id, "status", index), role: "status-marker", frame: disc, style: boxStyle(fill, fill, HAIRLINE, token("radius.round")) }));
    const cue = setText("mark", item.status === "positive" ? "✓" : item.status === "negative" ? "×" : "!", STATUS_DISC);
    nodes.push(drawText(stableId(id, "status-cue", index), "status-cue", { x: disc.x, y: disc.y + (STATUS_DISC - cue.height) / 2, width: STATUS_DISC }, cue, { color: WHITE, align: "center" }));
    nodes.push(drawText(stableId(id, "label", index), "status-label", { x: frame.x + STATUS_TEXT_X, y: y + (slot - label.height) / 2, width: L.width }, label));
    y += slot + L.gap;
  });
  return nodes;
}

/** Data blocks: the metric, legend, chart callout, the tables and the status list. */
export function registerDataBlocks(registry) {
  const definitions = [defineMetric(), defineLegend(), defineChartCallout(), defineTable(), defineTrendRows(), defineComparisonTable(),
    defineHeatmap(), defineStatusList()];
  for (const definition of definitions) {
    if (definition.id === "status-list") {
      definition.tokens = [...new Set([...definition.tokens, ...TEXT_ROLE_TOKENS])];
      definition.measureContent = ({ frame, props }) => statusListLayout(frame, props);
      definition.measureCeiling = ({ frame, props }) => { const L = statusListLayout(frame, props); return L.height + L.rows.length * tokenValue(token("space.3")); };
    }
    if (["table", "comparison-table", "heatmap", "trend-rows"].includes(definition.id)) {
      definition.version = "3.2.0";
      definition.tokens = TABLE_TOKENS;
      const normalize = props => {
        if (definition.id === "heatmap") return { ...props, columns: props.columns.map((label,index)=>({label,type:index?'heatmap':'text',scale:index?'score':undefined})), rows: props.rows.map(row=>row.map((value,index)=>index?{value}:value)), scales: {score:{type:'heatmap',label:'Assessment',min:1,max:5,anchors:{1:'Low',3:'Medium',5:'High'}}} };
        if (definition.id === "trend-rows") return { ...props, columns: props.columns.map((label,index)=>({label,type:index?'text':'category',width:[.18,.52,.3][index]})) };
        if (definition.id === "comparison-table") {
          if (props.selectedColumn !== undefined && (!Number.isInteger(props.selectedColumn) || props.selectedColumn < 0 || props.selectedColumn >= props.columns.length)) throw new Error("Invalid comparison selectedColumn");
          return { ...props, rows: props.rows.map(row => {
            const cells = (Array.isArray(row) ? row : row.cells).map((value, index) => {
              if (index !== props.selectedColumn || value === null) return value;
              return typeof value === "object" && !Array.isArray(value)
                ? { ...value, highlight: true }
                : { text: String(value), value, highlight: true };
            });
            return Array.isArray(row) ? cells : { ...row, cells };
          }) };
        }
        return props;
      };
      definition.render = input => renderTable({...input,props:normalize(input.props)});
      definition.measureContent = input => measureTable({...input,props:normalize(input.props)});
      definition.measureCeiling = input => tableCeiling({...input,props:normalize(input.props)});
      definition.measureHeader = ({ frame, props = {} }) => {
        if (props.headerShape === "chevron") return null;
        const measured = measureTable({ frame: { ...frame, height: Infinity }, props: { ...normalize(props), fillHeight: false, headerBandHeight: undefined } });
        return measured.headerHeight ? { top: frame.y, ruled: true, height: measured.headerHeight - tokenValue(token("space.1")) } : null;
      };
      if (definition.id === "table") {
        definition.variants = TABLE_VARIANTS;
        definition.defaultVariant = "open";
        definition.variantProp = "variant";
        definition.resolveVariant = props => props.variant ?? (props.treatment === "standard" ? "standard" : "open");
        const render=definition.render;
        definition.render=input=>{if(!TABLE_VARIANT_NAMES.includes(definition.resolveVariant(input.props)))throw new Error('Unknown table variant');return render(input);};
      }
    }
    refineVariantAxes(definition);
    if (definition.id === "legend") {
      definition.version = "2.1.0";
      const visuallyDistinctPlacements = LEGEND_PLACEMENTS.filter(placement => placement !== "inline");
      definition.variants = Object.fromEntries(
        Object.keys(LEGEND_VARIANTS).filter(mark => mark !== "quantitative-scale").flatMap(mark => visuallyDistinctPlacements.map(placement => [
          `${mark}-${placement}`,
          {
            props: {
              variant: mark,
              placement,
              items: [{ label: "Actual", state: "actual" }, { label: "Forecast", state: "forecast" }, { label: "Target", state: "target" }]
            },
            preferredSize: { width: 540, height: placement === "right" ? 120 : 44 }
          }
        ]))
      );
      definition.variants["quantitative-scale-top"] = {props: {...QUANTITATIVE_LEGEND_SAMPLE, items:undefined, placement:"top"}, preferredSize:{width:540,height:64}};
      definition.defaultVariant = "swatch-top";
      definition.resolveVariant = (props = {}) => `${props.variant ?? "swatch"}-${props.placement ?? "top"}`;
    }
    if (definition.id === "trend-rows") definition.tokens = [...new Set([...definition.tokens, ...SECTION_HEADING_TOKENS])].sort();
    registry.set(definition.id, definition);
  }
  return registry;
}
