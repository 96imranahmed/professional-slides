// The data blocks: the metric tile, the legend, the chart callout, the tables
// (table, trend rows, comparison table, heatmap - one renderer, tables.mjs,
// each normalising its own props into it) and the status list.
import { stableId, textPrimitive, token, ellipsePrimitive, tokenValue } from "./core.mjs";
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
    id: "heatmap",
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
    render: ({ id, frame, props }) => ({
      nodes: props.items.flatMap((item, index) => {
        const height = frame.height / props.items.length;
        const fill = item.status === "positive"
          ? token("color.positive")
          : item.status === "negative" ? token("color.negative") : token("color.caution");
        return [
          ellipsePrimitive({
            id: stableId(id, "status", index),
            role: "status-marker",
            frame: { x: frame.x, y: frame.y + index * height + (height - 20) / 2, width: 20, height: 20 },
            style: boxStyle(fill, fill, HAIRLINE, token("radius.round"))
          }),
          textPrimitive({
            id: stableId(id, "status-cue", index),
            role: "status-cue",
            frame: { x: frame.x, y: frame.y + index * height + (height - 20) / 2, width: 20, height: 20 },
            text: item.status === "positive" ? "✓" : item.status === "negative" ? "×" : "!",
            style: textStyle(LABEL, WHITE, true, "center")
          }),
          textPrimitive({
            id: stableId(id, "label", index),
            role: "status-label",
            frame: { x: frame.x + 34, y: frame.y + index * height, width: frame.width - 34, height },
            text: item.label,
            style: textStyle(COMPACT, INK, false, "left")
          })
        ];
      })
    })
  });
}

/** Data blocks: the metric, legend, chart callout, the tables and the status list. */
export function registerDataBlocks(registry) {
  const definitions = [defineMetric(), defineLegend(), defineChartCallout(), defineTable(), defineTrendRows(), defineComparisonTable(),
    defineHeatmap(), defineStatusList()];
  for (const definition of definitions) {
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
