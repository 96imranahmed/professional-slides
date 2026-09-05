# PptxGenJS API

Use [`pptxgenjs`](https://www.npmjs.com/package/pptxgenjs) as the production writer for net-new Professional Slides PowerPoint files. It consumes the resolved canonical scene; components do not call PptxGenJS directly. Artifact Tool imports and renders the exact saved output as the downstream compatibility adapter. The npm package name is `pptxgenjs`.

PptxGenJS is a generation adapter, not a visual validator. A successful `writeFile` call proves only that bytes were written. Render and inspect the exact saved PPTX through [the PowerPoint QA path](rendering.md).

## Capability gate

Follow [Load the active runtime guidance](../codex-generation.md#load-the-active-runtime-guidance), then confirm the resolved PptxGenJS package:

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

Keep canonical scene geometry in pixels and convert it to inches only inside `runtime/adapters/pptxgenjs.mjs`. Use the active [theme specification](../../theming/index.md) for colors, type roles, margins, grid, and recurring components.

Define the design geometry once in the canonical scene. Store named `canvas`, `region`, `column`, `space`, and `type` tokens; derive spans and component positions through the composition resolver; and round only when passing final values to PptxGenJS. Do not repeat literal margin, title, footer, or spacing values across slide builders.

Map design roles directly to PptxGenJS: size to `fontSize`, weight to `bold`, leading to `lineSpacing` or `lineSpacingMultiple`, paragraph rhythm to `paraSpaceBefore` and `paraSpaceAfter`, alignment to `valign`, and padding to `margin` or `inset`. Preserve native units: geometry uses inches; type and spacing use points. When a token cannot map exactly, use one documented fallback for every instance and verify the exported render.

## Define masters and placeholders

Put fixed footer furniture, confidentiality text, and page numbers on a slide master. Titles follow the shared [title variant contract](../../components/index.md#action-title-block); an optional rule follows measured title text rather than a fixed master coordinate:

```js
pptx.defineSlideMaster({
  title: "ANALYTICAL",
  background: { color: "FFFFFF" },
  objects: [
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

The canonical [scene-to-native chart mapping](../css-to-native-mapper.md#chart-mapping) owns the chart implementation rule. Keep units, period, scale, labels, forecast state, and source aligned:

```js
const adoption = diligenceEvidence.productAdoption;
if (!adoption?.source || !adoption?.unit || adoption.labels.length !== adoption.values.length) {
  throw new Error("Chart data requires a source, unit, and aligned labels and values");
}

const chartItem = {
  id: "product-adoption",
  job: "compare adoption by segment",
  component: "chart.bar",
  props: {
    categories: adoption.labels,
    series: [{ name: adoption.seriesName, values: adoption.values }],
  },
};
```

Pass `chartItem` to the scene planner. The adapter must also render `adoption.unit`, period, and `adoption.source` in the chart furniture or slide source block.

## Add source notes

Put a concise source line on the slide and a complete `Sources:` block in speaker notes:

```js
slide.addText("Source: Hugging Face Hub documentation; retrieved 2026-08-29", {
  x: 0.67, y: 6.92, w: 11.4, h: 0.16,
  fontFace: "Arial", fontSize: 8, color: "5D6678", margin: 0,
});

slide.addNotes(`Sources:
- https://huggingface.co/docs/hub/index

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
