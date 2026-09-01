# Table Cell Status and Comparison Indicators

This component owns compact completion, traffic-light status, and bounded heatmap scores inside tables. It keeps the indicator subordinate to the row evidence, preserves an explicit value or label, and resolves every colour through the active theme.

Use the semantic row and cell icon contract in [`icons-and-logos`](icons-and-logos.md#row-and-cell-icons) when a compact library icon improves scanning or replaces a repeated low-information word. Use this component when the cell encodes measured completion, a threshold-based status, or an ordered score.

## Select the encoding

### Completion spinner

Use the circular completion spinner only for a true share from `0%` to `100%`. The filled sector uses component-primary and the remainder uses the theme's neutral chart segment. Print the percentage or numerator and denominator beside the mark. A declared threshold may rebind the fill to positive, caution, or negative, but a spinner does not become a traffic light merely because its value is low.

Do not use the spinner for a qualitative confidence label, arbitrary maturity stage, or decorative status. When the number is the first read, print it and use a thin horizontal bar instead.

### Traffic-light cell

Use a traffic-light cell only when positive, caution, negative, or missing states have written triggers. Show a dot plus a text label such as `On track`, `Watch`, or `Off track`; colour never stands alone. The dot consumes the active theme's status palette, so a reference-derived deck may change the swatches without changing the state names.

A traffic-light table must include one visible legend on the same slide. The legend repeats every state used in the table and states the threshold or trigger. Do not rely on a legend from an earlier slide.

### One-to-five heatmap cell

Use a one-to-five heatmap only when the domain has named anchors and a reproducible scoring rule. Print the score in every cell. The complete cell may receive the fill when this improves scanning; the number remains the non-colour cue.

Choose one palette for the complete table:

- `theme-sequential`: low to high intensity in component-primary. This is the default for completeness, evidence quality, maturity, or another one-direction score.
- `red-white-green`: negative through neutral to positive. Use only when the midpoint is genuinely neutral and both directions have meaning.
- `red-white`: negative through neutral. Use when the red endpoint is an adverse condition and the white endpoint means no identified concern, not when white could be mistaken for missing data.

The legend is mandatory, sits on the same slide, uses the same palette, and names the anchors. Use `N/A` for non-applicable and `Not available` for unavailable evidence. Missing cells use the registered missing treatment and never inherit a score colour.

## Theme contract

| Component | Consumed custom properties | Default binding |
| --- | --- | --- |
| completion spinner | `--table-cell-completion-fill`, `--table-cell-completion-track`, `--table-cell-completion-size`, `--table-cell-completion-gap`, `--table-cell-completion-font` | component primary, chart segment, registered icon size, `space-2`, label role |
| traffic-light cell | `--table-cell-status-positive`, `--table-cell-status-caution`, `--table-cell-status-negative`, `--table-cell-status-missing`, `--table-cell-status-marker-size`, `--table-cell-status-gap`, `--table-cell-status-font` | semantic status roles, chart segment, icon size, `space-2`, compact body role |
| heatmap cell | `--table-cell-heat-1` through `--table-cell-heat-5`, `--table-cell-heat-on-low`, `--table-cell-heat-on-high`, `--table-cell-heat-missing`, `--table-cell-heat-missing-color`, `--table-cell-heat-font`, `--table-cell-heat-min-size`, `--table-cell-heat-padding` | registered theme heatmap scale, ink, on-primary, surface-1, muted ink, label role, density row height, `space-2` |
| indicator legend | `--table-cell-legend-font`, `--table-cell-legend-color`, `--table-cell-legend-gap`, `--table-cell-legend-item-gap`, `--table-cell-legend-swatch-size`, `--table-cell-legend-rule` | compact body role, ink, `space-3`, `space-2`, icon size, quiet rule |

## Structural HTML reference

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Table cell status component examples">
    <figure class="table-cell-status-set" data-palette="theme-sequential">
      <table class="data-table" aria-label="Completion by workstream">
        <thead><tr><th>Workstream</th><th>Complete</th></tr></thead>
        <tbody>
          <tr>
            <th>Systems testing</th>
            <td class="table-cell-status" data-variant="completion">
              <span class="table-cell-status__spinner" style="--value: 72" role="img" aria-label="72 percent complete"></span>
              <span class="table-cell-status__value">72%</span>
            </td>
          </tr>
        </tbody>
      </table>
    </figure>

    <figure class="table-cell-status-set" data-palette="theme-status">
      <table class="data-table" aria-label="Forecast by workstream" aria-describedby="forecast-status-legend">
        <thead><tr><th>Workstream</th><th>Forecast</th></tr></thead>
        <tbody>
          <tr><th>Stations</th><td class="table-cell-status" data-variant="traffic-light" data-state="positive"><span class="table-cell-status__dot" aria-hidden="true"></span><span>On track</span></td></tr>
          <tr><th>Systems</th><td class="table-cell-status" data-variant="traffic-light" data-state="caution"><span class="table-cell-status__dot" aria-hidden="true"></span><span>Watch</span></td></tr>
          <tr><th>Assurance</th><td class="table-cell-status" data-variant="traffic-light" data-state="negative"><span class="table-cell-status__dot" aria-hidden="true"></span><span>Off track</span></td></tr>
        </tbody>
      </table>
      <aside class="table-cell-status__legend" id="forecast-status-legend" aria-label="Forecast status legend">
        <ul>
          <li data-state="positive"><span class="table-cell-status__dot" aria-hidden="true"></span><span><strong>On track</strong>: forecast meets the approved date</span></li>
          <li data-state="caution"><span class="table-cell-status__dot" aria-hidden="true"></span><span><strong>Watch</strong>: recovery is required within the current window</span></li>
          <li data-state="negative"><span class="table-cell-status__dot" aria-hidden="true"></span><span><strong>Off track</strong>: approved date is forecast to be missed</span></li>
        </ul>
      </aside>
    </figure>

    <figure class="table-cell-status-set" data-palette="red-white-green">
      <table class="data-table" aria-label="Evidence score by workstream" aria-describedby="evidence-score-legend">
        <thead><tr><th>Workstream</th><th>Evidence score</th></tr></thead>
        <tbody>
          <tr><th>Operations</th><td class="table-cell-status" data-variant="heatmap" data-score="5"><span>5</span></td></tr>
          <tr><th>Commercial</th><td class="table-cell-status" data-variant="heatmap" data-score="3"><span>3</span></td></tr>
          <tr><th>Technology</th><td class="table-cell-status" data-variant="heatmap" data-score="1"><span>1</span></td></tr>
        </tbody>
      </table>
      <aside class="table-cell-status__legend" id="evidence-score-legend" aria-label="Evidence score legend">
        <ol class="table-cell-status__scale">
          <li data-score="1"><span class="table-cell-status__swatch">1</span><span>Insufficient</span></li>
          <li data-score="2"><span class="table-cell-status__swatch">2</span><span>Weak</span></li>
          <li data-score="3"><span class="table-cell-status__swatch">3</span><span>Mixed</span></li>
          <li data-score="4"><span class="table-cell-status__swatch">4</span><span>Good</span></li>
          <li data-score="5"><span class="table-cell-status__swatch">5</span><span>Strong</span></li>
        </ol>
      </aside>
    </figure>
  </section>
</main>
```

```css
.table-cell-status-set {
  --table-cell-completion-fill: var(--component-primary);
  --table-cell-completion-track: var(--chart-segment);
  --table-cell-completion-size: var(--icon-lg);
  --table-cell-completion-gap: var(--space-2);
  --table-cell-completion-font: var(--type-label);
  --table-cell-status-positive: var(--status-positive);
  --table-cell-status-caution: var(--status-caution);
  --table-cell-status-negative: var(--status-negative);
  --table-cell-status-missing: var(--chart-segment);
  --table-cell-status-marker-size: var(--icon-sm);
  --table-cell-status-gap: var(--space-2);
  --table-cell-status-font: var(--type-body-compact);
  --table-cell-heat-1: var(--heatmap-primary-1);
  --table-cell-heat-2: var(--heatmap-primary-2);
  --table-cell-heat-3: var(--heatmap-primary-3);
  --table-cell-heat-4: var(--heatmap-primary-4);
  --table-cell-heat-5: var(--heatmap-primary-5);
  --table-cell-heat-on-low: var(--ink);
  --table-cell-heat-on-high: var(--on-primary);
  --table-cell-heat-missing: var(--surface-1);
  --table-cell-heat-missing-color: var(--muted-ink);
  --table-cell-heat-font: var(--type-label);
  --table-cell-heat-min-size: var(--chart-row-height);
  --table-cell-heat-padding: var(--space-2);
  --table-cell-legend-font: var(--type-body-compact);
  --table-cell-legend-color: var(--ink);
  --table-cell-legend-gap: var(--space-3);
  --table-cell-legend-item-gap: var(--space-2);
  --table-cell-legend-swatch-size: var(--icon-md);
  --table-cell-legend-rule: var(--rule-quiet);
}

.table-cell-status-set[data-palette="red-white-green"] {
  --table-cell-heat-1: var(--status-negative);
  --table-cell-heat-2: var(--status-negative-tint);
  --table-cell-heat-3: var(--canvas);
  --table-cell-heat-4: var(--status-positive-tint);
  --table-cell-heat-5: var(--status-positive);
}

.table-cell-status-set[data-palette="red-white"] {
  --table-cell-heat-1: var(--status-negative);
  --table-cell-heat-2: var(--status-negative-tint);
  --table-cell-heat-3: var(--surface-2);
  --table-cell-heat-4: var(--surface-1);
  --table-cell-heat-5: var(--canvas);
}

.table-cell-status[data-variant="completion"] {
  display: flex;
  align-items: center;
  gap: var(--table-cell-completion-gap);
}

.table-cell-status[data-variant="traffic-light"] {
  display: flex;
  align-items: center;
  gap: var(--table-cell-status-gap);
  font: var(--table-cell-status-font);
}

.table-cell-status__spinner {
  --value: 0;
  width: var(--table-cell-completion-size);
  aspect-ratio: 1;
  flex: none;
  border-radius: var(--radius-round);
  background: conic-gradient(var(--table-cell-completion-fill) calc(var(--value) * 1%), var(--table-cell-completion-track) 0);
}

.table-cell-status__value {
  font: var(--table-cell-completion-font);
  font-variant-numeric: tabular-nums;
}

.table-cell-status[data-variant="completion"][data-state="positive"] { --table-cell-completion-fill: var(--table-cell-status-positive); }
.table-cell-status[data-variant="completion"][data-state="caution"] { --table-cell-completion-fill: var(--table-cell-status-caution); }
.table-cell-status[data-variant="completion"][data-state="negative"] { --table-cell-completion-fill: var(--table-cell-status-negative); }

.table-cell-status__dot {
  width: var(--table-cell-status-marker-size);
  aspect-ratio: 1;
  flex: none;
  border-radius: var(--radius-round);
  background: var(--table-cell-status-missing);
}

[data-state="positive"] > .table-cell-status__dot { background: var(--table-cell-status-positive); }
[data-state="caution"] > .table-cell-status__dot { background: var(--table-cell-status-caution); }
[data-state="negative"] > .table-cell-status__dot { background: var(--table-cell-status-negative); }

.table-cell-status[data-variant="heatmap"] {
  min-width: var(--table-cell-heat-min-size);
  min-height: var(--table-cell-heat-min-size);
  padding: var(--table-cell-heat-padding);
  text-align: center;
  font: var(--table-cell-heat-font);
  font-variant-numeric: tabular-nums;
  color: var(--table-cell-heat-on-low);
}

.table-cell-status-set [data-score="1"] { background: var(--table-cell-heat-1); }
.table-cell-status-set [data-score="2"] { background: var(--table-cell-heat-2); }
.table-cell-status-set [data-score="3"] { background: var(--table-cell-heat-3); }
.table-cell-status-set [data-score="4"] { background: var(--table-cell-heat-4); }
.table-cell-status-set [data-score="5"] { background: var(--table-cell-heat-5); color: var(--table-cell-heat-on-high); }
.table-cell-status-set [data-score="missing"] { background: var(--table-cell-heat-missing); color: var(--table-cell-heat-missing-color); }

.table-cell-status-set[data-palette="red-white-green"] [data-score="1"],
.table-cell-status-set[data-palette="red-white"] [data-score="1"] {
  color: var(--on-status-negative);
}

.table-cell-status-set[data-palette="red-white"] [data-score="5"] {
  color: var(--table-cell-heat-on-low);
}

.table-cell-status-set[data-palette="red-white-green"] [data-score="5"] {
  color: var(--on-status-positive);
}

.table-cell-status__legend {
  margin-top: var(--table-cell-legend-gap);
  padding-top: var(--table-cell-legend-gap);
  border-top: var(--table-cell-legend-rule);
  color: var(--table-cell-legend-color);
  font: var(--table-cell-legend-font);
}

.table-cell-status__legend ul,
.table-cell-status__legend ol {
  display: flex;
  flex-wrap: wrap;
  gap: var(--table-cell-legend-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}

.table-cell-status__legend li {
  display: flex;
  align-items: center;
  gap: var(--table-cell-legend-item-gap);
}

.table-cell-status__scale {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
}

.table-cell-status__swatch {
  width: var(--table-cell-legend-swatch-size);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  flex: none;
  font: var(--table-cell-heat-font);
}
```

The HTML exposes one component class with three registered variants. `data-palette` belongs on the table-and-legend set so the cells and legend cannot resolve different scales. The completion `--value` is content data. A presentation adapter calculates the sector geometry and the registered heatmap swatches before creating native objects.

## Variants and states

- `completion` accepts `--value` from `0` to `100`. Its default palette is component-primary plus the neutral track. `data-state` may rebind the fill only when a written threshold exists.
- `traffic-light` accepts `positive`, `caution`, `negative`, or `missing`. Every cell includes a visible label and every table includes a same-slide legend.
- `heatmap` accepts scores `1` through `5` and `missing`. A different bounded domain is allowed only when the score labels, scale anchors, and legend are changed together.
- `theme-sequential`, `red-white-green`, and `red-white` are the registered heatmap palettes. Palette names describe the scale construction, while the actual swatches resolve through the active theme.

## Native translation

Build the completion spinner as one editable neutral circle plus one editable filled sector, with the value in a separate text box. Build traffic lights as editable circles and adjacent text. Build a heatmap as editable table-cell fills plus editable centered values. Resolve every fill and text colour from the active theme before creating the native objects.

Group each legend with its table, not with page furniture. Preserve the legend in PowerPoint and Google Slides as editable shapes and text. Keep the table's accessible description, cell labels, and legend wording in speaker notes or object metadata when the platform cannot retain HTML relationships.

## Acceptance check

- Every spinner maps to a declared `0%` to `100%` quantity and prints the value.
- Every traffic-light state has a written trigger, a visible text label, and a same-slide legend.
- Every heatmap has named scale anchors, a printed value in each cell, and a same-slide legend using the exact same palette.
- `red-white-green` has a real neutral midpoint; `red-white` does not use white for missing data.
- Missing and non-applicable values are explicit and never scored as zero.
- Peer marks use one construction, palette, size, and threshold contract.
- The table remains readable without colour, and the final rendered legend is large enough to read.
