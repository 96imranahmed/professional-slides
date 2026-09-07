# Design System

Design should make the argument easier to see. Use the fewest visual rules needed for a coherent deck. [`Theming`](../theming/index.md) owns reusable values and component bindings; this file owns the visual decisions applied to the resolved composition.

## Select one design mode

Choose one:

- **Reference-led:** follow a source deck or template admitted by the [asset authorization record](../components/icons-and-logos.md#asset-authorization-record).
- **Clean native standard:** default when no approved reference or explicit custom direction exists. Use the Codex Grid layout, registered components, and standard tracker, chart-heading, and legend variants.
- **Custom user-directed:** use only when the owner explicitly approves a distinct visual direction and record that approval in the deck contract.

Then resolve one [visual family and density profile](../theming/index.md#resolve-one-active-theme). Do not mix reference styles with a new house style.

## Compose the page

Use the [composition model](../composition/index.md) for the content-item contract, relationship-based layout selection, and nesting rules. Design begins after that tree resolves: select the visual family, density, guides, treatment, and hierarchy that make the declared relationships visible. [Slide layouts](slide-layouts.md) owns the corresponding page-geometry guidance.

Do not impose the same card grid, three-column layout, process rail, or footer strip on most slides. Give each slide one dominant exhibit; route any detached synthesis or terminal action through the canonical [`Insight Box`](../components/insight-box.md). Evidence-attached chart annotations follow [`chart callouts`](../components/chart-callouts.md).

Whitespace must support hierarchy. It must not conceal missing evidence or undersized content. On an executive pre-read, use 60% to 90% as a planning guide, not a fill quota. Once the argument is complete, keep related text and insight compact and position the group deliberately within the available field. Do not reopen that gap, enlarge containers, or add prose merely to consume whitespace. The examples of comparison, qualifier, definition, period, and attached interpretation are non-scored planning prompts; the [copy owner](../components/copy.md) defines completeness.

## Deck rhythm

Keep palette, type, anchors, and component grammar consistent while choosing page structures for different analytical questions. Compare the planned sequence and final montage for runs of the same chart-and-rail silhouette. Repetition is useful for comparable markets, periods, or options; retain it when a shared scale and structure help the audience compare. Otherwise, test whether the pages repeat one finding, omit a driver or trade-off, or inherited a layout before their argument was developed.

Category tables are useful but must not become the default for every claim. Audit table-heavy sequences in the dot-dash and montage: numerical claims need the graphs that test their magnitude, persistence, distribution, or relationship. Put substantial proof on dedicated evidence pages before synthesis where useful. A table of assertions is not an evidence base, and unrelated metrics are not a remedy. Retain repeated tables only when their shared structure materially aids comparison.

For a repetitive run, use the [analytical substance check](../components/copy.md#analytical-substance) to decide whether to consolidate overlapping pages or develop distinct proof. A bridge can explain drivers, a trend can test persistence when comparable periods exist, and a scenario comparison can expose sensitivity when its assumptions are supported. Keep a bar chart when magnitude is the question. Swapping chart types, adding decoration, or changing colours solely for variety fails this check.

Match container height to useful content. A few sentences at the top of tall cards leave an unfinished page even when the cards occupy most of the canvas. An executive pre-read close should connect the recommendation to its decisive evidence and explain what changes the decision; use [decision-close guidance](../components/copy.md#decision-close). Prefer compact open sections or a decision table when those relationships warrant them. A deliberately sparse stage close remains valid for a narrated presentation.

## Allocate evidence before geometry

Count the real categories, rows, stages, comparison fields and text before assigning boxes. Choose the exhibit's reading task, then allocate its region:

| Reading task | Composition decision |
| --- | --- |
| Compare several short options on common criteria | One analytical table or repeated evidence group, with a stable schema and deliberate family order. Keep lever, benefit basis, implementation horizon, dependency and status distinct. |
| Explain why a selected option works | A developed mechanism, driver decomposition or dependency exhibit; separate it from the portfolio only when the proof needs that space. |
| Compare magnitudes or changes | A chart with the relevant comparator and common measurement basis; use a table when precise lookup across mixed fields is the primary job. |
| Relate evidence at different levels | A composite with one dominant field and a clearly subordinate decomposition or additional evidence section. Allocate width by the labels and proof each field requires. |
| Show timing or sequence | A registered relationship component with explicit stage labels, optional periods and dependencies. Unequal duration needs a supported time scale; ordinal stage positions do not encode duration. |

For comparable options, draft all rows before deciding the page count. Consolidate sparse family pages when their combined rows remain readable, preserving family names and case IDs in the comparison field. Split a long exhibit at a meaningful family or analytical boundary and repeat its schema, column widths and units. A separate page per source row is appropriate only when that row has a distinct developed argument.

Resolve component capacity with the actual longest labels and fullest rows. Use intrinsic content measurement at the allocated width; sample height is not evidence that production text fits. If a component cannot fit, first remove duplicate copy, rebalance widths, or regroup the evidence. Select a registered compact density for the entire coherent family when the delivery mode warrants it, before resorting to a split. Do not crop meaningful fields, omit qualifiers or locally shrink individual text objects.

Inspect both content density and visual balance. A large container containing two short bullets remains sparse. Compare how much decision-relevant evidence the reader can actually inspect, including values, comparison dimensions, conditions and reasoning. Retain a compact complete group when the content is complete; develop missing proof when it is not. Never use a target slide count or occupancy percentage as a substitute for this judgment.

## Select an evidence-density mode

Use one mode for each slide family:

- **Live pitch:** large type, low density, one idea per page.
- **Executive presentation:** moderate density and strong visual hierarchy.
- **Executive pre-read:** denser evidence that remains readable without narration.
- **Analytical appendix:** compact, precise, and source-rich.

Choose the registered density profile once for each coherent family and carry it through the treatment ledger. Never shrink text locally to make the wrong composition fit. Simplify duplicate copy or redesign the page; keep the measurements and qualifiers that make its evidence meaningful.

## Colour system

Use colour for meaning, not decoration.

Resolve the complete palette from the [theme token registry](../theming/tokens.md). It includes `component-primary`, its `text-accent` alias, neutral surfaces, text roles, structural rules, status roles, and `chart-series-1` to `chart-series-6`.

Use one identical component-primary swatch across tracker emphasis, structural highlights, and primary actions. Titles use their registered text-colour binding, normally ink, unless an approved title variant specifies otherwise. Do not use chart colours for non-chart decoration. Do not use RAG colours unless they encode a defined measure and also have a non-colour cue.

### Semantic treatment registry

Before authoring, record the [theme manifest](../theming/index.md#theme-manifest) and create one deck treatment ledger. For every slide or contiguous slide range, name the visual family, density, analytical-header template, tracker state, page layout, tables, callouts, sources, charts, and repeated component variants. Reuse chrome and comparable table schemas. Select other registered variants when content or hierarchy benefits, recording the reason instead of tuning slide-local styles.

The ledger owns one `tableHeader` record with `variantId`, `fillRole`, `textRole`, `ruleRole`, `rowHeightToken`, `paddingXToken`, and `paddingYToken`. Every analytical table references that record by `variantId`; no slide carries a parallel header definition.

## Implication emphasis system

Use a separate implication or action region only when it adds a distinct conclusion, condition, owner, or action that is not already clear from the title and exhibit.

Choose a content-appropriate registered [`insight-box`](../components/insight-box.md) variant, normally a light tonal or neutral surface, or the dotted no-fill treatment when a filled block would be too heavy. Reserve the primary surface for a decisive action or stage moment. Do not stack an implication box and a recommendation box. If deletion changes nothing, remove the region.

## Typography system

Use the [registered typography roles](../theming/tokens.md#primitive-and-role-tokens): cover title, action title, section title, body, compact body, label, and source.

Keep the registered title role at one font size across a slide family. Every ordinary analytical title uses the exact same deck-level `x` and `y` anchor. One-line and two-line titles start at the same point; dependent content moves down when the title wraps.

Prefer one line. When two lines are needed, wrap at a meaningful phrase and avoid a lone final word. Do not condense, locally shrink, or move a title to balance one slide.

Use readable body text. Dense pre-reads may be compact, but the final render must still work at normal viewing size.

## Spacing system

Use the [registered spacing scale and density profile](../theming/tokens.md#density-profiles). Align related objects to common edges and baselines. Keep internal padding, row rhythm, and gaps consistent within each component family.

Do not use tiny spacing differences to make a crowded layout fit. Remove or regroup content instead.

## Canvas, guides, and grid

Use a 16:9 canvas unless the source specifies otherwise. Resolve the exact values through the active density profile and define:

- outer page margins;
- the analytical title anchor;
- the optional title separator and content start;
- the shared footer/source row and content boundary, following the [page-template owner](../components/index.md#sources-and-footers);
- a simple 12-column analytical grid.

The grid is a guide, not a requirement to fill every column. Give the dominant exhibit most of the canvas. Set diagram nodes before drawing connectors. Keep recurring objects on exact shared anchors.

A tracked analytical-header template contains the tracker label and action title. An untracked template contains only the action title. Declare which slides each template governs before authoring.

## Image and icon system

Use images and icons only when they improve meaning or recognition. Keep one visual style. Prefer editable vectors and real library icons over improvised symbols. Do not add an icon to fill empty space.

Design owns only the image and icon geometry. The component guide owns meaning and selection.

## Reference intake

When a reference deck is authorized:

1. render and inspect the full deck;
2. identify its layouts, anchors, typography, spacing, colours, tables, charts, and recurring components;
3. separate deliberate rules from one-off exceptions;
4. reuse the closest valid structure.

When modernizing an authorized reference, preserve its evidence relationships, comparison depth, meaningful row order and content hierarchy while applying the selected current theme. Compare the source and candidate at equal viewing size. Check which observations, calculations, countercases and conditions the reader can recover from each, then compare grouping and reading effort. Pixel similarity and matching page counts cannot establish equivalent content or design quality.

Do not copy source content or assets unless authorized. Do not claim fidelity without comparing the final render with the reference.

## Cross-slide QA

Review the montage first, then every slide at full size.

Reconcile the rendered deck against the treatment ledger slide by slide. A consistency audit must identify the shared definition used for every repeated title, header, tracker, table, callout, source, chart role, and semantic colour. It must also list each intentional exception with its slide, role, and content reason. An unexplained exception is drift, not variety.

Check:

- title and content anchors;
- type size and wrapping;
- colour roles;
- table and chart grammar;
- repeated component states;
- repeated structures retained for comparable measures or jobs, and structural changes justified by a different evidence relationship, reading order or density;
- [deck rhythm](#deck-rhythm), including repetitive runs and oversized empty containers;
- clipping, overlap, broken assets, and dead space.
- full tracker pages contain the complete approved item set with numbers and labels;
- compact tracker states remain present and selected correctly on every slide in each governed range;
- editable object fills, lines, and text colours resolve to declared semantic roles rather than slide-local literals.

Repair the owning rule when the same defect appears more than once. Keep intentional exceptions only when the content requires them.

## Cross-platform fallbacks and QA

PowerPoint and Google Slides may render differently. Use native editable objects where possible, then render each final platform separately. A successful export is not visual proof.

## Main and secondary design audit

Before production, record each slide's main exhibit and every secondary section with its component, variant, analytical job and reason for selection. Consider credible alternatives instead of accepting registry order. An absent secondary section is valid when the main exhibit is sufficient.

Review these choices across the complete sequence, including nested halves and rails. Repeated insight boxes, two-metric-plus-insight rails, logo grids or chart silhouettes require a content-specific comparison reason. Change the composition where repetition obscures a different job. Preserve table schemas and recurring chrome where they aid reading. Do not add images, arrows or random variants just to meet a diversity quota. An unexplained repeated composition blocks design approval.

## Criticality is a hard acceptance gate

Every title, internal heading, annotation and supporting section MUST pass the deletion test: identify the specific argument, scope, evidence interpretation, decision or navigation that becomes materially weaker or ambiguous if it is removed. Accuracy alone is insufficient. A heading that paraphrases its body, generic label, repeated conclusion or decorative annotation fails. Remove it; do not invent a replacement heading to satisfy a component slot. Necessary measure, unit, period and comparison labels remain.

Apply this check during dot-dash planning and again to every exact rendered slide. Record the exact text, role, deletion consequence and pass/fail for each title, heading and annotation. Missing coverage or any failed item blocks acceptance regardless of aggregate scores or other passing tests. Use TITLE_CRITICALITY for redundant titles/headings and ANNOTATION_CRITICALITY for unnecessary chart callouts.

For a simple directly labelled two-value bar comparison, a derived catch-up requirement or decision implication belongs in the insight section, potentially as a second supporting bullet. Do not attach it to a bar as if it were the plotted quantity. Chart annotations must need a specific visual anchor to explain that mark, event or interval; preserve warranted growth/change highlights. Assess insight reasoning as a whole: a calculated supporting premise may support a deduction without being a standalone insight itself.

### Baseline and supporting-copy requirements

The shared bar/column renderer paints the category axis and zero baseline above opaque bar shapes, with gridlines behind the marks. A continuous baseline must survive native PowerPoint export; do not repair individual slides with duplicate lines.

Criticality includes whole supporting sections, not just their headings. Methodology-only boxes (population basis, coverage, source definitions) normally belong in source notes. An evidence-note tag or neutral surface does not exempt a box from the deletion test. Retain a prominent qualification only when it prevents a material misreading and cannot be communicated adequately in the source note. Do not invent an insight when none is supported.

Tracker pages are not exempt: headings such as “The comparison in five chapters” merely describe visible structure and fail criticality. Use the current substantive section name in slide chrome and omit the redundant internal heading. Keep the actual tracker labels needed for navigation.
