# Design

Design owns the evidence relationship, attention, treatment and visual hierarchy. [Storylining](storylining.md) owns whether the claim is supported and deserves a page; [Composition](composition.md) owns its geometry.

## Allocate evidence before geometry

Name what each mark, row, panel and arrow represents. Count the actual observations, stages, comparison fields and longest labels. Choose the relationship that makes the title inspectable before choosing a component. Use the [illustrated reference atlas](reference-atlas.md) for candidate structures and counterexamples.

- Magnitudes, distributions and change use supported chart encodings; exact lookup across mixed fields can use a table, even with only two columns.
- Shared entities across several measures can use common rows, scales or linked annotations rather than detached exhibits.
- A mechanism needs an actual input/output, dependency, constraint or failure path. Chevrons alone do not explain it.
- Independent alternatives are peers; an ordered route is a sequence; unequal durations require a quantitative time axis. An accumulation keeps earlier stages' contributions and is different from ordinary sequence.
- A joined scenario exposes interacting constraints. Do not distribute its premises across separate generic charts when their interaction is the finding.
- Qualitative evidence can be a visible specimen, annotated example or named choice/consequence comparison. Never invent numerical axes to make preference look measured.

For hard pages, sketch two plausible evidence structures at low fidelity; select on reading effort and preserved proof. Change the structure when it improves the relationship, not to rotate templates. Record the reason and rejected alternative in existing plan `why`. Two regions must add different necessary evidence; a second component is not a variety token.

## Choose visual treatments during planning

Use the existing `why`, `treatment`, `anchors`, `highlight`, `annotation` and `insight` fields. A composite identifies the intended treatment of each child. The table below is the semantic owner for these decisions; chart/component references own executable props.

| Decision | Use it when | Keep it plain when |
| --- | --- | --- |
| Category axis | A column names distinct classes whose attributes follow: Assignment, Availability, Evidence, Interaction, Outcome; or award classes. Fill category cells with white labels, not whole rows. | Individual records, dates or repeated membership such as DC/DC/Marvel. Editorial conclusions are not peer categories. |
| Icons | Parallel concepts have distinct recognizable meanings, such as population, comparison, analysis and data quality. Select supported names, retain labels and one coherent style. | They decorate IDs, repeat a number, imply an order or suggest evidence that is absent. |
| Focus | The claim names an exact observation or coherent set whose emphasis reduces reading effort. Select exact keys; the set can have several members. | No item has a special role. Neutral is valid; maxima, midpoint, neighboring pages and arrow location never infer focus. |
| Count pills | A selected count field benefits from distinct scanning and a common pill size. | The value is a date, score, arbitrary label or unsupported metric. |
| Status | A short verdict explicitly means good/bad: color Cleared/Met or Missed, or use a labelled check/cross. | Identity, preference and ordinary category membership are not status. Positive/negative colors never map chart marks, swatches or backgrounds. |
| Closing insight | A supported consequence is otherwise buried and deserves a closing band. Write it before reserving space. | It paraphrases the title, rereads the rows or fills whitespace. |
| Image | Recognition or visible features are necessary evidence: product, place, physical allocation or attributed specimen. Resolve usable assets before layout. | A named subject alone does not need a picture. Imagery cannot establish performance, safety or causality. |

Review omission as well as misuse. A meaningful icon in metadata but suppressed in the image is still missing. Verify both classification (was the choice useful?) and handoff (did it render?). Do not increase treatment counts to meet a percentage.

## Put the comparison where it is used

The comparator that makes a title true belongs in the exhibit: a labelled target, shared basis, named contributors, delta, interval or local annotation. Do not make the reader remember a threshold from another slide or count marks to find the named observation. Show series names through a legend or direct labels. Align supporting values to their corresponding categories; attach event-specific interpretation to its event.

Use local annotations for point-specific observations, and a separate commentary region only for developed mechanism, qualification or consequence. Preserve scope where it changes interpretation. Visible records establish the displayed result; speaker notes cannot carry a missing premise in a pre-read.

## One heading owner per exhibit

The action title states the finding. Each distinct chart owns one descriptive measure heading, inline unit and rule by default. A section wrapping one chart stays untitled. A parent heading is warranted only when it groups genuinely different child exhibits. Tables and non-chart exhibits normally need no extra heading when their title and labels identify them. An established consistent unruled reference style can be retained as a deck-wide exception.

Remove subtitles that duplicate chart headings by meaning, not merely shared words. Keep each unique measure, unit, period and population once in the appropriate label or source note. Do not use separate filled/newline unit tiles. Evidence qualifications such as Judgement or Estimate use the common subtitle band via `evidenceStatus`, not ad hoc text above the title. Mixed states are qualified locally.

## Table grammar

Use [Charts: category and verdict semantics](charts.md#category-and-verdict-semantics) for exact props. A plain verdict joins the table with continuous row fills; a gutter belongs only to an authored inference-arrow variant. A table-wide arrow centers in the evidence body independently of highlighted rows. Per-row arrows are a distinct choice. Chevron headers have no redundant underline. Unordered classes get no sequence numbering. Heat scales and Harvey balls need a defined rubric; conclusion/total rows keep their own role.

Paired tables can share column widths and row anchors while retaining different semantic treatment. Parent alignment must not erase a child's category or verdict choice. When splitting a comparison, repeat the needed schema, units and common physical scale; do not split simply to change the silhouette.

## Space, type and boundaries

The shell owns title, source, footer, page number and navigation once. Base canvas: 1280×720; margins 60px; 12-column guide with 82px tracks and 16px gutters. At the adapter boundary 96px=1in and 1px=0.75pt. Registered theme/density roles govern type: action title normally 24pt, section 14–16pt, body 12–14pt, chart furniture 9–10pt, sources 8pt. Do not locally shrink unrelated text to rescue a layout.

Region width expresses weight: equal tracks imply peers; a narrow rail supports a dominant exhibit. Size actual content before assigning space. A few short labels should not acquire the largest dark region. Sparse unheaded content centers as one measured group with natural internal gaps. Headed peers align to common reading baselines. Inspect the relationship between groups, not only each component's fit. [Composition](composition.md#shared-geometry-and-visual-intent) owns how that intent reaches the runtime.

Use whitespace, then a rule, then a surface when a stronger boundary is needed. Every line has one job: separator, boundary, leader or state. Keep padding, rule spacing and repeated row rhythm consistent. Chart-heading rules sit below measured heading text; peer rules align. Prefer open analytical regions. Box the smallest true group rather than building a dashboard of unrelated cards.

Resolve palette and typography through the theme. Color roles distinguish structural emphasis, chart series and short status labels. Body/compact text contrast is at least 4.5:1; large type and meaningful graphics 3:1. Embedded marks keep series identity on total/category surfaces using readable foreground or boundary. Use concise titles and numeric notation; [Copy](copy.md) owns sentence hierarchy, bold leads and redundancy.

## Page architecture and repetition

Record the dominant encoding, shared entity/axis, nesting and attachment of support in each plan's `why`. Review this beside the title sequence. Test repeated informational jobs as well as shapes: several different charts can repeat one calculation; a composite can still be two redundant panels.

Normalize chart/table above two/three commentary columns, cards/prose and optional insight as **evidence over commentary**. Mirroring does not add variety. A process, diagram or second plot counts as evidence only when it develops another necessary part of the claim. Category fills, icons, color, markers and titles never create a new relationship.

The existing blocking repetition screens remain: no architecture over 40% of analytical pages; ten-page windows contain at least three meaningful relationships. These are alarms, not a template-rotation recipe. A repeated comparison series needs an actual comparability reason; naming `series` alone is not editorial acceptance. Preserve common scales and geometry when repetition helps comparison. A 50-page minimum does not exempt a repetitive or deletable sequence.

Alternatives must differ with colors and fonts ignored. Use different questions, orders or evidence relationships; retain comparable tasks where appropriate. After composition inspect the actual montage and originals because plan labels cannot certify the pixels.

## Working from a reference deck

For faithful reference transformation, inspect the whole supplied reference and map consolidations/splits. For benchmarking, select strong comparable originals from every requested deck and state literal page coverage. Extract analytical device, evidence payload, hierarchy, emphasis and readable type size before adopting a structure. Compare at equal viewing size. The [atlas](reference-atlas.md) points to devices, not an exemption from viewing the actual references. Do not copy reference quirks that contradict user preferences.

## Visual review

Use [Taste review](taste-review.md) for the independent reader pass. At design handoff inspect: claim-to-exhibit relation; useful or misplaced focus; field semantics; heading ownership; unique commentary; group balance; actual process dependencies; consistency across repeated families. Check both missing cues and inappropriate cues. Keep fit, clipping, collision and truthful scale failures blocking; use whitespace, ink and treatment counts as prompts, never decoration quotas. Repeated defects return to their shared owner.
