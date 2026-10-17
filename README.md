# Professional Slides

An AI skill for planning, creating, and revising editable PowerPoint decks. Start with a brief, analysis, or existing presentation; say who will read it; approve the storyline; then build and check the saved file.

Built for board papers, project updates, pitches, due diligence, and strategy decks. Runs in Codex or Claude Code with a local authoring runtime.

[Explore the gallery](https://shiphappens.xyz/slides) · [Download a sample deck](https://shiphappens.xyz/professional-slides/decks/british-airways-europe.pptx) · [Read the skill](skills/professional-slides/SKILL.md)

![An annotated trend chart produced by Professional Slides](assets/sample-trend.png)

## Why use it

- **Start from the reader.** Ask who reads the deck and what they already know, then write the storyline that reader needs before any layout.
- **Keep evidence traceable.** Use supplied sources or public research; separate facts from assumptions and flag missing evidence.
- **Keep the deck editable.** Text, tables, and diagrams remain PowerPoint objects. Eligible charts use native charts with embedded workbooks; custom treatments use editable grouped shapes.
- **Check the saved output.** Render the actual PPTX and look at every page; an independent review runs when you ask for one.

## What it can build

The [authoring catalogue](skills/professional-slides/runtime/page-types.mjs) contains **20 page families and 94 forms**, backed by **106 registered components** in the [component registry](skills/professional-slides/runtime/registry.mjs).

| Coverage | Forms | Examples |
| --- | ---: | --- |
| Charts | 30 | Trends, rankings, shares, scatter and bubble charts, waterfalls |
| Tables, scorecards, and metrics | 17 | Data tables, findings matrices, heatmaps, progress views, metric strips |
| Processes and structures | 16 | Flows, trees, funnels, cycles, frameworks, Sankey diagrams |
| Plans and schedules | 4 | Timelines, Gantt charts, roadmaps, horizons |
| Comparisons and profiles | 12 | Options, parallel arguments, company profiles, people, radar charts |
| Narrative and summaries | 6 | Executive summaries, takeaways, memos, statements, quotations |
| Pictures and maps | 5 | Hero images, picture pairs and strips, photo backdrops, maps |
| Multi-exhibit panels | 4 | Rows, grids, stacks, sequences |

Shared components add covers, dividers, contents, trackers, logos, icons, and source notes. Print the full catalogue with:

```bash
node skills/professional-slides/runtime/author-deck.mjs --types
```

![A comparison slide with aligned charts and explanatory text](assets/sample-comparison.png)

These examples use synthetic data. See more forms in the [live gallery](https://shiphappens.xyz/slides).

## Start with a brief

Invoke `$professional-slides` in Codex or `/professional-slides:professional-slides` in Claude Code, then give it a brief like this:

```text
Create a 12-slide board deck from the attached analysis.
Audience: the board.
Decision: which retention initiative to prioritize next quarter.
Evidence: use only the supplied files and flag gaps.
Style: consulting, using our reference deck as the house style.
First propose the storyline and slide titles for review.
```

The workflow is **reader → storyline → approval → pages → rendering → delivery**. It asks who reads the deck and what they know, asks for missing design choices, and pauses for storyline approval. You can also request just the storyline or titles.

Revisions create a new PPTX and preserve the original; point changes carry unrelated source slides into the new file. For quick typos, colours, or fonts, use a general PowerPoint editor.

## Choose the design

| System | Best suited to |
| --- | --- |
| `consulting` | Boards, steering committees, diligence, compact evidence |
| `editorial` | Narrative pre-reads, strategy papers, prose with imagery |
| `journal` | Chart-led briefings, full-width evidence, small multiples |
| `keynote` | Live pitches, launches, larger type, one idea per page |

A reference deck, website, or brand colours can guide the house style. [Design preferences](skills/professional-slides/references/design-intake.md) are saved for later work.

## Install and start

Use Node 20.9+. The environment check identifies missing Python packages, LibreOffice, and poppler, and prints install commands and the recommended `RUNTIME_PYTHON`.

```bash
git clone https://github.com/96imranahmed/professional-slides.git
cd professional-slides
node skills/professional-slides/runtime/doctor.mjs
python3 evals/scripts/package_plugin.py
```

After the environment check passes, the package is in `dist/professional-slides`:

- **Codex:** add that directory to a [local marketplace](https://developers.openai.com/plugins/build/plugins#build-your-own-curated-plugin-list), install its `professional-slides` entry, and invoke `$professional-slides`.
- **Claude Code:** run `claude --plugin-dir dist/professional-slides`, then invoke `/professional-slides:professional-slides`.

Keep outputs outside the installed plugin. See [setup](skills/professional-slides/SKILL.md#setup). Google Slides import needs its own visual check; inspect fonts, wrapping, crops, and charts after import.

<details>
<summary>Development and public submission</summary>

```bash
npm ci
npm run check
npm run package:plugin
npm run package:submission
```

The [evaluation guide](evals/README.md) covers the test suite and the rendered checks. Technical checks alone do not establish a deck's argument or visual quality.

A rule earns its place in the runtime only if it catches what a reader would see on a page (overflow, overlap, unreadable type, a chart that encodes the data wrongly), a saved file that differs from what was composed, or a number that is wrong or cannot be bound. Anything the runtime can do itself - totals, axis ticks, label wrapping, fitting a footer - is behaviour, not a rule. The writer chooses the chart, the table, the page count and where the words go; no rule judges a page by the pages around it or scales with deck size. Fix a recurring defect where it starts - a default, a published limit, a clearer message - rather than in the next deck.

Public submission creates a separate skills-only ZIP using the [distribution README](submission/README-DISTRIBUTION.md), with manifest, file-hash, and integrity validation. Keep both listings synchronized and complete publisher verification, scans, and attestations in the portal. The hosted policy pages load [privacy](.codex-plugin/PRIVACY.md) and [terms](.codex-plugin/TERMS.md) from `main`.

</details>

## Support and contributors

[Report an issue](https://github.com/96imranahmed/professional-slides/issues) · [Privacy](https://shiphappens.xyz/slides/privacy) · [Terms](https://shiphappens.xyz/slides/terms)

- [Patrick O'Brien](https://github.com/psobrien)
