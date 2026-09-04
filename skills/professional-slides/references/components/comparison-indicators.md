# Table Cell Status and Comparison Indicators

This component owns compact completion, binary confirmation, traffic-light status, bounded heatmap scores, and ordinal fill discs inside tables. It keeps the indicator subordinate to the row evidence, preserves an explicit value or label, and resolves every colour through the active theme.

Use the semantic row and cell icon contract in [`icons-and-logos`](icons-and-logos.md#row-and-cell-icons) when a compact library icon improves scanning or replaces a repeated low-information word. Use this component when the cell encodes measured completion, a threshold-based status, or an ordered score.

## Select the encoding

### Completion spinner

Use the circular completion spinner only for a true share from `0%` to `100%`. The filled sector uses component-primary and the remainder uses the theme's neutral chart segment. Print the percentage or numerator and denominator beside the mark. A declared threshold may rebind the fill to positive, caution, or negative, but a spinner does not become a traffic light merely because its value is low.

Do not use the spinner for a qualitative confidence label, arbitrary maturity stage, or decorative status. When the number is the first read, print it and use a thin horizontal bar instead.

### Traffic-light cell

Use a traffic-light cell only when positive, caution, negative, or missing states have written triggers. Show a dot plus a text label such as `On track`, `Watch`, or `Off track`; colour never stands alone. The dot consumes the active theme's status palette, so a reference-derived deck may change the swatches without changing the state names.

A traffic-light table must include one visible legend on the same slide. The legend repeats every state used in the table and states the threshold or trigger. Do not rely on a legend from an earlier slide.

### Binary confirmation

Use a check and `Supported` label for a defined positive state and a cross and `Not supported` label for a defined negative state. The symbol is the primary non-colour cue; colour may reinforce it through the existing positive and negative theme roles. Use `Not assessed` or `Missing` explicitly rather than leaving a blank cell. Define the confirmation test in the column heading or note, and do not use a check merely to signal preference.

### One-to-five heatmap cell

Use a one-to-five heatmap only when the domain has named anchors and a reproducible scoring rule. Print the score in every cell. The complete cell may receive the fill when this improves scanning; the number remains the non-colour cue.

Choose one palette for the complete table:

- `theme-sequential`: low to high intensity in component-primary. This is the default for completeness, evidence quality, maturity, or another one-direction score.
- `red-white-green`: negative through neutral to positive. Use only when the midpoint is genuinely neutral and both directions have meaning.
- `red-white`: negative through neutral. Use when the red endpoint is an adverse condition and the white endpoint means no identified concern, not when white could be mistaken for missing data.

The legend is mandatory, sits on the same slide, uses the same palette, and names the anchors. Use `N/A` for non-applicable and `Not available` for unavailable evidence. Missing cells use the registered missing treatment and never inherit a score colour.

### Ordinal fill disc

Use the ordinal fill disc, sometimes called a Harvey ball, for a compact bounded rating whose anchors are explicitly defined. The standard domain is `0` through `4`, rendered as empty, quarter, half, three-quarter, and full. Print the score or named level beside the disc and provide one same-slide legend that defines the anchors. The filled sector uses component-primary and the track uses the neutral chart segment.

Do not use an ordinal disc for percentages, confidence, or measured completion. Use a spinner for a true `0%` to `100%` share. Use a heatmap for table-wide scanning. Use checks or crosses only for defined binary states.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| completion spinner | `--table-cell-completion-fill`, `--table-cell-completion-track`, `--table-cell-completion-size`, `--table-cell-completion-gap`, `--table-cell-completion-font` | [component bindings](../theming/component-bindings.md#evidence-components) |
| traffic-light cell | `--table-cell-status-positive`, `--table-cell-status-caution`, `--table-cell-status-negative`, `--table-cell-status-missing`, `--table-cell-status-marker-size`, `--table-cell-status-gap`, `--table-cell-status-font` | [component bindings](../theming/component-bindings.md#evidence-components) |
| heatmap cell | `--table-cell-heat-1` through `--table-cell-heat-5`, `--table-cell-heat-on-low`, `--table-cell-heat-on-high`, `--table-cell-heat-missing`, `--table-cell-heat-missing-color`, `--table-cell-heat-font`, `--table-cell-heat-min-size`, `--table-cell-heat-padding` | [component bindings](../theming/component-bindings.md#evidence-components) |
| ordinal fill disc | `--table-cell-rating-fill`, `--table-cell-rating-track`, `--table-cell-rating-size`, `--table-cell-rating-gap`, `--table-cell-rating-font` | [component bindings](../theming/component-bindings.md#evidence-components) |
| indicator legend | `--table-cell-legend-font`, `--table-cell-legend-color`, `--table-cell-legend-gap`, `--table-cell-legend-item-gap`, `--table-cell-legend-swatch-size`, `--table-cell-legend-rule` | [component bindings](../theming/component-bindings.md#evidence-components) |

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
          <li data-state="positive"><span class="table-cell-status__dot" aria-hidden="true"></span><span>On track: forecast meets the approved date</span></li>
          <li data-state="caution"><span class="table-cell-status__dot" aria-hidden="true"></span><span>Watch: recovery is required within the current window</span></li>
          <li data-state="negative"><span class="table-cell-status__dot" aria-hidden="true"></span><span>Off track: approved date is forecast to be missed</span></li>
        </ul>
      </aside>
    </figure>

    <figure class="table-cell-status-set" data-palette="theme-status">
      <table class="data-table" aria-label="Evidence confirmation">
        <thead><tr><th>Statement</th><th>Confirmation</th></tr></thead>
        <tbody>
          <tr><th>Demand exceeds the threshold</th><td class="table-cell-status" data-variant="binary" data-state="positive"><span class="table-cell-status__binary" aria-hidden="true">✓</span><span>Supported</span></td></tr>
          <tr><th>Supply remains constrained</th><td class="table-cell-status" data-variant="binary" data-state="negative"><span class="table-cell-status__binary" aria-hidden="true">×</span><span>Not supported</span></td></tr>
        </tbody>
      </table>
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

    <figure class="table-cell-status-set" data-palette="theme-sequential">
      <table class="data-table" aria-label="Option fit rating" aria-describedby="option-fit-legend">
        <thead><tr><th>Option</th><th>Strategic fit</th></tr></thead>
        <tbody>
          <tr>
            <th>Option A</th>
            <td class="table-cell-status" data-variant="ordinal-disc">
              <span class="table-cell-status__rating" style="--rating:3" role="img" aria-label="3 of 4, strong fit"></span>
              <span class="table-cell-status__value">3 of 4, strong</span>
            </td>
          </tr>
        </tbody>
      </table>
      <aside class="table-cell-status__legend" id="option-fit-legend" aria-label="Strategic fit scale">
        <ol class="table-cell-status__scale">
          <li><span>0</span><span>None</span></li>
          <li><span>1</span><span>Limited</span></li>
          <li><span>2</span><span>Mixed</span></li>
          <li><span>3</span><span>Strong</span></li>
          <li><span>4</span><span>Complete</span></li>
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
  --table-cell-rating-fill: var(--component-primary);
  --table-cell-rating-track: var(--chart-segment);
  --table-cell-rating-size: var(--icon-lg);
  --table-cell-rating-gap: var(--space-2);
  --table-cell-rating-font: var(--type-label);
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

.table-cell-status[data-variant="binary"] {
  display: flex;
  align-items: center;
  gap: var(--table-cell-status-gap);
  font: var(--table-cell-status-font);
}

.table-cell-status__binary {
  display: inline-grid;
  place-items: center;
  width: var(--table-cell-status-marker-size);
  color: var(--table-cell-status-missing);
  font: var(--table-cell-status-font);
}

[data-variant="binary"][data-state="positive"] > .table-cell-status__binary { color: var(--table-cell-status-positive); }
[data-variant="binary"][data-state="negative"] > .table-cell-status__binary { color: var(--table-cell-status-negative); }

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

.table-cell-status[data-variant="ordinal-disc"] {
  display: flex;
  align-items: center;
  gap: var(--table-cell-rating-gap);
  font: var(--table-cell-rating-font);
}

.table-cell-status__rating {
  --rating: 0;
  width: var(--table-cell-rating-size);
  aspect-ratio: 1;
  flex: none;
  border-radius: var(--radius-round);
  background: conic-gradient(var(--table-cell-rating-fill) calc(var(--rating) * 25%), var(--table-cell-rating-track) 0);
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

The HTML exposes one component class with five registered variants. `data-palette` belongs on the table-and-legend set so the cells and legend cannot resolve different scales. Completion `--value` and ordinal `--rating` are content data. A presentation adapter calculates sector geometry and registered heatmap swatches before creating native objects.

## Variants and states

- `completion` accepts `--value` from `0` to `100`. Its default palette is component-primary plus the neutral track. `data-state` may rebind the fill only when a written threshold exists.
- `traffic-light` accepts `positive`, `caution`, `negative`, or `missing`. Every cell includes a visible label and every table includes a same-slide legend.
- `binary` accepts `positive`, `negative`, or `missing`. It uses a check, cross, or explicit missing mark plus visible text and a written confirmation test.
- `heatmap` accepts scores `1` through `5` and `missing`. A different bounded domain is allowed only when the score labels, scale anchors, and legend are changed together.
- `ordinal-disc` accepts ratings `0` through `4` and `missing`. Every disc prints a score or named level and the table includes one same-slide legend defining the anchors.
- `theme-sequential`, `red-white-green`, and `red-white` are the registered heatmap palettes. Palette names describe the scale construction, while the actual swatches resolve through the active theme.

## Native translation

Build completion and ordinal discs as one editable neutral circle plus one editable filled sector, with the value or level in a separate text box. Build traffic lights as editable circles and adjacent text. Build binary confirmation as an editable check, cross, or missing mark plus adjacent text. Build a heatmap as editable table-cell fills plus editable centered values. Resolve every fill and text colour from the active theme before creating the native objects.

Group each legend with its table, not with page furniture. Preserve the legend in PowerPoint and Google Slides as editable shapes and text. Keep the table's accessible description, cell labels, and legend wording in speaker notes or object metadata when the platform cannot retain HTML relationships.

## Acceptance check

- Every spinner maps to a declared `0%` to `100%` quantity and prints the value.
- Every traffic-light state has a written trigger, a visible text label, and a same-slide legend.
- Every binary state has a written confirmation test, an explicit symbol, and visible text; blanks are never interpreted as negative.
- Every heatmap has named scale anchors, a printed value in each cell, and a same-slide legend using the exact same palette.
- Every ordinal disc maps to a declared bounded scale, prints a score or named level, and has a same-slide legend; it never represents a percentage or probabilistic confidence.
- `red-white-green` has a real neutral midpoint; `red-white` does not use white for missing data.
- Missing and non-applicable values are explicit and never scored as zero.
- Peer marks use one construction, palette, size, and threshold contract.
- The table remains readable without colour, and the final rendered legend is large enough to read.
