// Intentional layering is declared by semantic construction, not by detected
// collisions. No rule exempts text/text, headings, legends, or whole charts.
export const OVERLAP_POLICY = Object.freeze({
  surfaces: ["cover-backdrop", "cover-panel", "divider-surface", "section-surface", "rail-surface", "panel-surface", "insight-surface", "quote-surface", "image-frame", "annotation-surface"],
  containedLabels: {
    "table-cell": "table-cell-text", "table-header-cell": "table-header-text",
    "organization-node": "node-label", "tree-node": "node-label", "tree-root": "node-label", "organization-root": "node-label",
    "funnel-stage": "funnel-label", "icon-surface": "icon-symbol",
    "logo-backing": "logo-text", "trend-label-surface": "trend-label",
    "process-marker": "process-number", "list-marker": "list-marker-label",
    "highlight-marker": "highlight-number", "matrix-point": "matrix-point-label",
    "rollout-phase": "rollout-phase-label", "process-band": "process-label",
    "status-marker": "status-cue", "rollout-row-marker": "rollout-row-label",
    "chart-mark": "data-label", "chart-segment": "data-label", "chart-label-surface": "data-label"
  },
  chartGeometry: ["chart-gridline", "chart-axis", "chart-mark", "chart-marker", "chart-line", "chart-area", "chart-reference-line", "chart-connector", "chart-point-highlight"],
  pairs: [
    ["cover-line", "cover-line", "cover pattern intersections"],
    ["cover-line", "cover-panel", "cover panel masks the edge pattern"],
    ["image-placeholder-line", "image-placeholder-line", "placeholder diagonals"],
    ["tree-connector", "tree-connector", "organization branch junctions"],
    ["matrix-axis", "matrix-axis", "matrix origin"],
    ["matrix-axis", "matrix-boundary", "matrix quadrant junction"],
    ["matrix-boundary", "matrix-boundary", "matrix quadrant junction"],
    ["matrix-boundary", "matrix-point", "point at quadrant boundary"],
    ["matrix-highlight", "matrix-boundary", "highlighted quadrant"],
    ["matrix-highlight", "matrix-point-label", "label in highlighted quadrant"],
    ["roadmap-rail", "roadmap-marker", "wave marker on roadmap rail"],
    ["process-rail", "process-marker", "step markers sit on the process rail"],
    ["map-land", "map-marker", "map marker anchored to geography"],
    ["map-land", "map-marker-fill", "map marker anchored to geography"],
    ["map-land", "map-label", "map label anchored to geography"],
    ["map-land", "map-land", "contiguous map land mass"],
    ["map-marker", "map-marker-fill", "fraction overlays its own map marker"],
    ["matrix-highlight", "matrix-point", "point is in the highlighted quadrant"],
    ["chart-segment", "chart-hole", "donut hole masks the segment center"],
    ["chart-marker", "chart-point-highlight-label", "selected point label"],
    ["chart-point-highlight", "chart-point-highlight-label", "selected point label"]
  ]
});
