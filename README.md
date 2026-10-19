# Professional Slides

Create, redesign and reconstruct **editable PowerPoint slides** in Codex or Claude Code. An npm package installs the portable skill and local runtime; your agent interprets the request, and the runtime builds, renders and checks the saved PPTX.

## Required local software

**You must install Microsoft PowerPoint or LibreOffice locally.** Professional Slides uses the installed application to export the saved PPTX for visual inspection. **Installing the npm package does not install PowerPoint or LibreOffice. PowerPoint for the web is not a local renderer.**

You also need:

- **Node.js 20.9 or newer**.
- **Python 3**, with the packages in [requirements.txt](requirements.txt). Setup prepares an isolated environment and installs missing packages there.
- **Poppler**, including both `pdftoppm` and `pdftotext`.
- **Codex or Claude Code**, signed in under your own account. The package uses the agent you already run; it has no model subscription, server or API key of its own.

On macOS, if you do not already have PowerPoint:

```bash
brew install node python poppler
brew install --cask libreoffice
```

If you already use desktop PowerPoint, install Node, Python and Poppler, open and activate PowerPoint, then allow its Automation access when macOS asks. Setup tests an actual export. Linux uses LibreOffice (`libreoffice-impress` and `poppler-utils`); Windows supports activated desktop PowerPoint or LibreOffice with Poppler on `PATH`.

Automatic selection prefers PowerPoint on macOS and Windows, with LibreOffice as fallback. `--renderer powerpoint` or `--renderer libreoffice` pins the choice and does not silently fall back. An unrendered development build does **not** satisfy the normal workflow.

## Recommended getting-started flow

1. **Install the local software above.**
2. **Run setup for your agent** from a terminal:

   ```bash
   npx professional-slides@latest setup --agent codex
   # Or:
   npx professional-slides@latest setup --agent claude
   # Both agents:
   npx professional-slides@latest setup --agent both
   ```

   Setup makes a persistent runtime installation, prepares Python, verifies a real Office export, and registers the skill. A temporary `npx` download can be removed later without breaking it. It never installs Office or changes an unrelated skill installation. User scope is the default; add `--scope project` to install for the current project instead.
3. **Open Codex or Claude Code and invoke the skill.** In Codex, use `$professional-slides`; in Claude Code, use `/professional-slides`. If a skill does not appear, restart the agent. Plugin installations retain their namespaced Claude command, `/professional-slides:professional-slides`.
4. **Attach your source files and give the outcome you want**, using one of the short requests below. You do not need to describe the pipeline or manually run each CLI command.
5. **Inspect the previews and receive an editable PPTX**, plus a PDF and slide images. For alternatives, pick the displayed option identifier before it is applied.

The npm commands above target a **published release**. Preparing a tarball does not publish it. To use an unpublished checkout:

```bash
git clone https://github.com/96imranahmed/professional-slides.git
cd professional-slides
npm ci
npm pack --pack-destination /tmp
npm exec --package /tmp/professional-slides-0.0.1.tgz -- professional-slides setup --agent codex
```

To diagnose an installation without changing it:

```bash
npx professional-slides doctor --probe --json
```

A `blocked` result includes the missing pieces or export failure. Install or repair those, then rerun setup. Successful dependency discovery alone is not proof that Office can export a presentation.

## Choose the work you want

| Your goal | Give the agent | You receive |
| --- | --- | --- |
| Create a new deck | Brief, audience, decision and evidence | Proposed storyline, editable slides, rendered checks |
| See alternatives for one slide | Deck or workspace and slide number | Labelled comparison image, individual previews and editable candidates |
| Redesign or “consultingify” a slide | Existing deck, target slide and desired style | Before/after previews and a revised PPTX preserving unrelated slides |
| Convert an image to editable PowerPoint | Slide screenshot, scan or PDF | Editable reconstruction, source/output comparison and explicit uncertainty |
| Develop a business stylesheet/template | Reference deck, website or brand assets | Named house profile, editable style guide and reusable template slides |

### Create a new deck

```text
$professional-slides Create a 12-slide board deck from the attached analysis.
The decision is which retention initiative to prioritise next quarter.
Use the supplied evidence and our reference deck's house style.
Propose the storyline and slide titles before building.
```

The agent establishes what the audience already knows, develops the argument and proposes titles before drawing pages, unless you already authorised it to proceed. Design preferences already supplied are reused. Missing evidence is stated rather than invented.

**Manual CLI equivalent:** start a workspace, discover a suitable page schema/example, fill `deck.pages.json`, then build:

```bash
npx professional-slides init ./board-work
npx professional-slides catalog --type trend/line --schema --json
npx professional-slides catalog --type trend/line --example --json
npx professional-slides inspect ./board-work --json
npx professional-slides build ./board-work --out ./board-output
```

`init` creates an empty document. It does not invent your argument or data. Your agent supplies these inputs.

### Show variant images for a particular slide

```text
$professional-slides Show me three different layouts for slide 7 of this deck.
Keep all its wording, data and sources. Let me choose before changing it.
```

The variants use **that slide's actual content**, not sample slides or just different colours. The agent shows a labelled comparison image and full-size previews. Only compatible, distinct candidates that pass the shared build checks are returned; if fewer than requested pass, the result explains that.

```bash
npx professional-slides import ./original.pptx --out ./revision-work
npx professional-slides inspect ./revision-work --slide 7 --json
# The agent maps the selected carried slide to a supported page type first.
npx professional-slides options ./revision-work --slide 7 --count 3 --json
npx professional-slides apply ./revision-work --candidate <returned-candidate-id>
npx professional-slides build ./revision-work --out ./revised-output
```

Import initially carries existing slides unchanged and infers a source house profile for pages you later redraw. Mapping is an authoring task for the agent, using the imported text, tables, chart data and image assets. The CLI reports the required input; it does not pretend to understand an arbitrary drawing automatically. Selection uses a saved candidate ID and rejects stale or modified candidate records. Keep the workspace's `candidates/` directory: a selected redesign may depend on its preserved baseline deck.

### Generate an alternate design: “consultingify”

```text
$professional-slides Consultingify slide 7 in the attached presentation.
Keep its exact content and show three options. Leave the other slides alone.
```

```bash
npx professional-slides options ./revision-work --slide 7 --design consulting --count 3 --json
npx professional-slides apply ./revision-work --candidate <returned-candidate-id>
npx professional-slides build ./revision-work --out ./consulting-output
```

The same candidate mechanism handles `consulting`, `editorial`, `journal` and `keynote`, or `--style ./acme.house.json`. A style change preserves other slides from the exact baseline PPTX; it does not restyle the whole deck. The selected target needs a unique title in that baseline so it can be matched safely.

Design scope preserves wording, numbers and citations. If you want a shorter title or different argument too, say so: that is a content revision. The source presentation is never overwritten.

### Transform an image into editable PowerPoint

```text
$professional-slides Turn this slide image into an editable PowerPoint slide.
Match its layout. Recreate text and shapes as editable elements, keep photos
as pictures, and flag anything you cannot read accurately.
```

```bash
npx professional-slides import ./slide.png --out ./image-work
npx professional-slides catalog --type reference --schema --json
npx professional-slides inspect ./image-work --json
# The agent reads the source and supplies native reference nodes.
npx professional-slides edit ./image-work --file ./reconstruction.json
npx professional-slides build ./image-work --out ./image-output
```

PNG, JPEG and PDF are supported. PDF pages become separate reference pages. Coordinates are on the shared **1280 × 720** canvas; the agent scales the source layout to it. A patch replaces a page in full:

```json
{
  "scope": "content",
  "edits": [{
    "page": "reference-1",
    "value": {
      "id": "reference-1",
      "type": "reference",
      "title": "The source's title",
      "reference": "sources/reference.png",
      "nodes": [{
        "id": "title",
        "kind": "text",
        "text": "The source's title",
        "frame": { "x": 64, "y": 54, "width": 1152, "height": 70 },
        "style": { "fontSize": 28, "bold": true, "color": "#183D36" }
      }],
      "uncertainties": []
    }
  }]
}
```

Native reference nodes support text, rectangles, ellipses, lines and cropped photographs. Tables and diagrams can be reconstructed from editable text, cells and connectors. This is **agent-assisted reconstruction**, not a deterministic OCR service. A chart reconstructed as editable shapes does not automatically acquire an embedded data workbook; use a supported chart page type with supplied data when that is required. Never infer invisible values as facts.

The agent compares the final render with the reference. The source image cannot be inserted whole as a substitute for editable reconstruction. Unreadable content and estimated values stay in the result's `uncertainties` and speaker notes. To redesign instead of match the source, ask the agent to map its evidence to a catalogue page type.

### Develop a brand stylesheet and template slides

```text
$professional-slides Develop a reusable house style for Acme from this deck
and our website. Show the visual stylesheet and create editable template
slides for charts, tables and narrative pages. Save it as an Acme profile.
```

```bash
npx professional-slides style import ./brand-reference.pptx --out ./acme.house.json
# Website, PDF, PNG, JPEG and existing house JSON are also accepted.
npx professional-slides catalog --type house --schema --json
npx professional-slides style build ./acme.house.json --out ./acme-brand
```

A PPTX/POTX provides structure and theme evidence. A website supplies observed colours and typography; a screenshot supplies only properties that can be read from pixels. Missing design choices are returned as `needs-input`, not silently invented. The agent completes the named profile and removes resolved entries from `unresolved` before building it.

Outputs include `brand.house.json`, editable `brand-template.pptx` and `brand-style-guide.pptx`, PDFs and preview images. The examples contain illustrative data. These are **template slides, not a `.potx` file with PowerPoint masters**. Multiple business profiles can coexist without overwriting personal preferences. To use one for a new deck, set `deck.template` to its house JSON path; explicit deck settings take precedence.

## CLI and result contract

Run `npx professional-slides --help` for the current command list and `<command> --help` for exact flags. All commands support `--json`; stdout then contains one structured result. The agent can also run the persistent bundled CLI directly, so ordinary work does not need repeated npm downloads.

| Status | Exit | Meaning |
| --- | ---: | --- |
| `complete` | 0 | This command completed |
| `error` | 1 | Invalid invocation or unexpected failure |
| `blocked` | 2 | Dependencies or validation findings prevent completion |
| `needs-input` | 3 | Structured authoring or interpretation is needed |

Results expose `artifacts`, `findings` and `requiredInputs`. `complete` is not a claim that a human or agent visually inspected the file: mechanical checks, rendering and visual judgment are reported separately. A `needs-input` result often asks the agent for authoring, not the user for another answer.

`edit` accepts `{ "scope": "content" | "design", "edits": [{ "page": "<id>" | "new" | "deck", "value": {} }] }`. The value is the complete replacement page or deck settings. `new` adds a uniquely identified page in content scope. Design scope refuses changes to text and data. Workspaces contain `project.json`, the authoritative `deck.pages.json`, supplied sources/assets and derived candidates/builds. Preserve source and candidate dependencies when moving a workspace.

The CLI has no free-text `--prompt`, external model server or separate generation engine. New page types extend the runtime catalogue; agents discover their schemas and examples. All flows use the shared editable PowerPoint emitter and saved-file checks.

## Rendering, editability and verification

The **saved PPTX** is exported by local PowerPoint or LibreOffice, converted to numbered PNGs and PDF text by Poppler, read back and checked against the composed scene. The agent inspects changed pages and repairs the source document. Optional independent review is available when requested.

Text, tables and diagrams remain editable PowerPoint objects. Eligible charts carry native charts with embedded workbooks; richer custom treatments use editable grouped shapes. Photographs stay images. Google Slides can import the PPTX, but fonts, wrapping, crops and charts need a separate check there.

[Explore the gallery](https://shiphappens.xyz/slides) · [Download a sample deck](https://shiphappens.xyz/professional-slides/decks/british-airways-europe.pptx)

![Example trend chart](assets/sample-trend.png)

## Development and packaging

```bash
npm ci
npm run check
npm run test:cli:render  # requires working local Office and Poppler
npm run package:plugin
npm pack --pack-destination /tmp
npm run package:submission
```

npm and plugin distributions share [distribution.json](distribution.json), versioned manifests and the same runtime. The npm tarball contains runtime files, policies, instructions and assets; evaluation tooling, private workspaces and developer dependencies are excluded. The public submission ZIP remains a separate validated artifact; building it does not publish to npm or a plugin directory.

[Runtime reference](skills/professional-slides/runtime/README.md) · [Evaluation guide](evals/README.md) · [Submission packaging](submission/README-DISTRIBUTION.md)

## Support and policies

[Report an issue](https://github.com/96imranahmed/professional-slides/issues) · [Privacy](PRIVACY.md) · [Terms](TERMS.md) · [Licence](LICENSE)

Package policies cover Professional Slides and its local runtime. They do not cover the separate gallery website.

Contributors: [Patrick O'Brien](https://github.com/psobrien).
