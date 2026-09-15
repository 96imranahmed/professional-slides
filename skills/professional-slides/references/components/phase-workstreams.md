# Phase and workstream roadmap

`roadmap` / `phase-workstreams` owns an ordinal programme with nested workstreams and distinct activity, leadership and product bands. Its runtime is `runtime/phase-workstreams.mjs`; it is a relationship variant, not a table or a dated timeline. Approximate phase periods remain labels. Equal phase widths do not encode elapsed duration.

Use this exhibit when readers must connect activities, leadership decisions and products within the same phase/workstream structure. Phase labels span their child columns; workstream labels decode those columns. Leadership and recurring products carry explicit contiguous `phaseIds`; their items share that scope without claiming individual phase dates or workstream assignments.

## Inputs

- `phases[]`: exact `id`, `label`, optional `period`, `workstreams[]` and `products[]`.
- Each workstream has an exact `id`, `label` and `activities[]` of keyed `text` records. `sourceText` remains metadata alongside authored copy. Optional `lead` emphasizes an exact complete-word prefix of that same text; it cannot introduce a new heading or change the wording. Use a short source-supported action lead to restore scan hierarchy on dense activity lists.
- Each phase product has `id`, `label`, `workstreamId`, optional `owner`, `additionalPlanned`, and recursive `children[]`. Children inherit a parent's provider and workstream unless they explicitly name a different provider. Children cannot move to another workstream. Nested products render indented under their parent.
- `owners[]` supplies up to two keyed product providers. A shared legend maps surface and muted fill to the two providers. Provider encoding applies only to products. It never assigns activity ownership. Provider qualifications stay attached as metadata.
- `leadershipBands[]` contains `id`, `label`, `phaseIds`, `items[]` of keyed `text`, and optional `placementBasis`.
- `recurringProducts[]` contains keyed labels and `phaseIds`. When taking a visible phase slice, retain the original wider scope in `sourcePhaseIds` and explicitly pass only the visible contiguous `phaseIds`. The renderer never silently clips scope.
- `qualifiers[]` supplies keyed text and `appliesTo`. Any `additionalPlanned: true` product requires an explicit `appliesTo: "additionalPlanned"` qualifier; its label receives `*` and a dependency on that qualifier.
- Optional `workstreamWeights` maps workstream IDs to positive relative column widths within their phase. These widths allocate label space, never time, effort or value. Default weights are equal. Keep phase peers in the same order and comparable page families under the same typography.

Every content/provider ID must be unique. Unknown provider keys, missing workstream relationships, duplicate IDs, non-contiguous scope bands and missing additional-product qualifiers reject.

## Measurement and rendering

`measurePhaseWorkstreams({ frame, props })` accepts a width-only frame for intrinsic measurement and returns `height` (the intrinsic alias), `requiredHeight`, `availableHeight`, `fits`, band offsets/heights, column layouts and resolved font sizes. Measure it under the same resolved design-token context used for compilation. `renderPhaseWorkstreams({ id, frame, props })` returns `{ nodes }` and rejects if the complete required height exceeds the frame.

Phase headings use `type.heading`; every workstream, activity, leadership item, product, provider label and qualifier uses `type.compact`. A whole-page `pre-read` profile therefore gives the compact family 10.8pt with the default typography. No individual label shrinks to pass capacity.

The maximum measured column content determines each shared activity/product band. Leadership scopes are packed into non-overlapping rows. Co-scoped recurring products share a single row of peer labels; overlapping scopes receive separate rows. Content determines the band height, with canonical spacing between bands. Within dense activity lists, hanging bullets distinguish separate records without extra paragraph gaps. Product fill follows measured text directly, as a provider highlight, with no card padding. Nesting remains explicit through indentation and parent dependencies.

The exported scene retains activity-to-workstream, workstream-to-phase, child-to-parent-product, product-to-provider and scoped-band-to-phase dependencies. Both text adapters receive identical measured line breaks. Capacity is a structural check only; exact rendered pages still need the normal readability, overlap and semantic-copy gates.

An emphasized activity remains one semantic text node. Shared [inline emphasis](inline-emphasis.md) measures its bold lead and regular remainder at the same canonical body size and produces the exact complete text plus inline runs. HTML spans and native PowerPoint rich text consume those measured runs in one text box. Bold metrics may increase wrapping, so measure the complete input again after adding leads. Do not split a paragraph into separate per-word shapes or reduce its font size to recover capacity.

Do not add repeated per-column “Key activities” or “Main deliverables” headings. The phase/workstream hierarchy and shared product label already own those scopes. Do not bury leadership decisions in activity prose or manufacture dated bars from approximate durations.
