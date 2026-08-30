# PptxGenJS API

Use [`pptxgenjs`](https://www.npmjs.com/package/pptxgenjs) for portable JavaScript creation of a new PowerPoint when the host exposes the package and does not require the Codex-native Artifact Tool route. The npm package name is `pptxgenjs`; do not use the misspelled `pptxgenjse` package name.

PptxGenJS is a generation adapter, not a visual validator. A successful `writeFile` call proves only that bytes were written. Render and inspect the exact saved PPTX through [the PowerPoint QA path](rendering.md).

## Capability gate

Resolve the host-provided Node runtime and dependency location before coding. Do not silently install a different package version during a deck run. Confirm:

```bash
"$RUNTIME_NODE" -e "const p=require('pptxgenjs/package.json'); console.log(p.name, p.version)"
```

Use this route for new decks. Do not claim fidelity when editing an existing template unless the available PptxGenJS workflow demonstrably preserves its theme, masters, layouts, notes, charts, links, and object editability. Prefer an import-aware adapter for template surgery.

## Create the presentation

Create a fresh instance per deck, select 16:9 explicitly, set document metadata, and centralize theme tokens before adding slides:

```js
import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.subject = "Executive decision deck";
pptx.title = "Deck title";
pptx.company = "Client";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  lang: "en-US",
};
```

Keep all dimensions in inches. Use the active theme specification for colors, type roles, margins, grid, and recurring components.

Define the design geometry once before creating slides. Store named `canvas`, `region`, `column`, `space`, and `type` tokens; derive spans and component positions through helpers; and round only when passing final values to PptxGenJS. Do not repeat literal margin, title, footer, or spacing values across slide builders.

Map the design roles directly to PptxGenJS options: point values to `fontSize`, role weight to `bold`, line height to `lineSpacing` or `lineSpacingMultiple`, paragraph rhythm to `paraSpaceBefore` and `paraSpaceAfter`, vertical alignment to `valign`, and component padding to `margin` or `inset` as supported by the selected object type. Preserve the library's native units for each option: geometry uses inches, while `fontSize`, `lineSpacing`, paragraph spacing, and `margin` use points. When PptxGenJS cannot express a design token exactly, use one documented fallback across every instance and verify the exported PPTX render.

## Define masters and placeholders

Put recurring title rules, footer furniture, confidentiality text, and page numbers on a slide master instead of duplicating them on every slide:

```js
pptx.defineSlideMaster({
  title: "ANALYTICAL",
  background: { color: "FFFFFF" },
  objects: [
    { line: { x: 0.67, y: 1.25, w: 12.0, h: 0, line: { color: "051C2C", width: 1 } } },
    {
      placeholder: {
        options: { name: "actionTitle", type: "title", x: 0.67, y: 0.38, w: 12.0, h: 0.72 },
        text: "Action title",
      },
    },
    { text: { text: "Confidential", options: { x: 0.67, y: 7.15, w: 1.2, h: 0.16, fontFace: "Arial", fontSize: 8, color: "5D6678", margin: 0 } } },
  ],
  slideNumber: { x: 12.18, y: 7.15, w: 0.48, h: 0.16, align: "right", fontFace: "Arial", fontSize: 8, color: "5D6678", margin: 0 },
});

const slide = pptx.addSlide({ masterName: "ANALYTICAL" });
slide.addText("The diligence case remains attractive but unproven", {
  placeholder: "actionTitle",
  fontFace: "Arial",
  fontSize: 24,
  bold: true,
  color: "051C2C",
  margin: 0,
  breakLine: false,
});
```

Use `fit` only under the overflow contract in [`text-box`](../../components/text-box.md#container-contract); generation code must not invent a platform-specific exception.

## Add editable objects

Keep meaning-bearing content native and separately addressable:

```js
slide.addText("Commercial diligence", {
  x: 0.67, y: 1.58, w: 3.1, h: 0.35,
  fontFace: "Arial", fontSize: 18, bold: true, color: "051C2C", margin: 0,
});

slide.addShape(pptx.ShapeType.rect, {
  x: 0.67, y: 2.05, w: 3.7, h: 0.08,
  fill: { color: "19D3C5" }, line: { color: "19D3C5", transparency: 100 },
});

slide.addTable(
  [
    ["Question", "Verified", "Data-room request"],
    ["Revenue quality", "Not public", "ARR by product, cohort, geography, and concentration"],
  ],
  {
    x: 0.67, y: 2.25, w: 12.0, h: 1.2,
    colW: [2.1, 2.0, 7.9],
    fontFace: "Arial", fontSize: 12, color: "051C2C",
    border: { type: "solid", pt: 0.5, color: "D7DCE5" },
    margin: 5,
  },
);
```

Use `addChart` only with reconciled data that satisfies the selected chart contract. Keep units, period, scale, labels, forecast state, and source aligned:

```js
const adoption = diligenceEvidence.productAdoption;
if (!adoption?.source || !adoption?.unit || adoption.labels.length !== adoption.values.length) {
  throw new Error("Chart data requires a source, unit, and aligned labels and values");
}

slide.addChart(
  pptx.ChartType.bar,
  [{ name: adoption.seriesName, labels: adoption.labels, values: adoption.values }],
  {
    x: 0.67, y: 2.0, w: 7.4, h: 4.5,
    barDir: "bar", showLegend: false, showValue: true,
    valAxisMinVal: 0,
    chartColors: ["19D3C5"],
    showTitle: false,
  },
);
```

The chart adapter must also render `adoption.unit`, period, and `adoption.source` in the chart furniture or slide source block.

## Add source notes

Put a concise source line on the slide and a complete `[Sources]` block in speaker notes:

```js
slide.addText("Source: Hugging Face Hub documentation; retrieved 2026-08-29", {
  x: 0.67, y: 6.92, w: 11.4, h: 0.16,
  fontFace: "Arial", fontSize: 8, color: "5D6678", margin: 0,
});

slide.addNotes(`[Sources]
- https://huggingface.co/docs/hub/index
[/Sources]

Verified public fact. Transaction implications are analytical hypotheses.`);
```

## Write the candidate

Await the file write and record the returned filename. Use `write` instead when the host needs an in-memory `nodebuffer`, `uint8array`, or other supported transport:

```js
const written = await pptx.writeFile({
  fileName: finalPptx,
  compression: true,
});

const bytes = await pptx.write({
  outputType: "nodebuffer",
  compression: true,
});
```

Do not emit both forms unless the workflow needs both. The saved file becomes the candidate of record and must complete the [PowerPoint rendering path](rendering.md).

## Native Google Slides handoff

For a dual-format new deck, finish and verify the PPTX, then follow the [Google Slides import and native-verification route](../google-slides/index.md). Do not assume import parity.

## Official references

- [PptxGenJS quick start](https://gitbrent.github.io/PptxGenJS/docs/quick-start/)
- [Masters and placeholders](https://gitbrent.github.io/PptxGenJS/docs/masters/)
- [Charts](https://gitbrent.github.io/PptxGenJS/docs/api-charts/)
- [Tables](https://gitbrent.github.io/PptxGenJS/docs/api-tables/)
- [Speaker notes](https://gitbrent.github.io/PptxGenJS/docs/speaker-notes/)
- [Saving presentations](https://gitbrent.github.io/PptxGenJS/docs/usage-saving/)
