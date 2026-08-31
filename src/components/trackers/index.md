# Trackers and Navigation

This file is the sole owner of tracker-system selection, contents and chapter-transition states, subsection navigation, optional running section labels, and tracker QA. [`Storylining`](../../storylining/index.md) owns the chapter sequence and names, [`design`](../../design/index.md) owns the grid and visual tokens, and [`tools`](../../tools/index.md) owns platform-specific implementation.

A tracker answers “where are we in the deck?” It must not compete with the action title, imply progress that has not occurred, or become decoration without a navigation job.

Every multi-chapter deck must define a tracker record. For an executive pre-read, diligence deck, or other chaptered consulting narrative, prefer a multi-page tracker sequence: show the complete map on a dedicated contents page after the cover or executive synthesis, then return to the same full-state component at each material chapter transition with the active item advanced. Analytical pages may remain free of tracker furniture; when a compact running label is selected, bind it and the action title into the tracked analytical-header template and instantiate both fields on every governed analytical slide. A lone chapter label, page-role eyebrow, or isolated heading is a section tag, not a tracker.

## Select one tracker system

Choose the least elaborate system that makes the deck easier to navigate. The chapter counts below are useful heuristics, not fixed limits.

| System | Best fit | Full state | Content-page state | Avoid when |
| --- | --- | --- | --- | --- |
| Top bar | A shallow deck with roughly three to five short top-level chapters where persistent orientation materially helps | Optional contents or heading page | A left-aligned horizontal rail with one active underline, rule, or tonal highlight | a full-page transition system can provide sufficient orientation, labels are long, the deck has many items, or a second level matters |
| Sidebar | A long or list-driven deck that works through roughly five to twelve requirements, workstreams, diligence questions, or repeated items | A heading or index page that establishes the list before the detailed sequence | A persistent side rail with the exact active label repeated in the tracked analytical-header template; one separately registered subsection marker may be added | the rail would leave an inadequate analytical canvas, the items are not a stable recurring list, or chapter transitions alone provide enough orientation |
| Full-page grid | The preferred default for a moderate-to-complex consulting deck with roughly four to eight peer chapters whose overall shape should be scanned at once | A dedicated grid contents page followed by the same full grid at material chapter transitions, with the current tile emphasized | None by default; use an approved compact chapter label only when needed | chapter titles vary greatly in length or the hierarchy is fundamentally sequential rather than peer-based |
| Full-page badged list | The preferred default for a sequential consulting deck with roughly three to seven chapters, especially when labels are longer or numbered progression aids recall | A dedicated contents page followed by the same full list at material chapter transitions, with one active row | None by default; use the approved badge and compact label only when needed | the deck requires a persistent view of many granular items on every page |

Prefer a full-page grid or badged list for chaptered consulting decks because the contents page establishes the complete argument and repeated transition states restore orientation without reducing every analytical canvas. The top bar is the least-preferred default because it adds persistent furniture while conveying little hierarchy. When it is justified, align it to the left-hand title or content guide unless an approved source theme establishes another anchor.

Apply a transition-density test before repeating the full state. A material transition must change the audience's governing question, decision branch, or working mode and must be followed by enough analytical content to justify the interruption. When a short deck would devote roughly one page in five or more to full-page navigation, group adjacent analytical branches into fewer audience-facing chapters, retain the finer hypothesis tests in the storyboard and contents copy, or use the approved compact label instead. Do not insert a full tracker after only one or two analytical pages merely because the template lists another branch; recent consulting references use repeated contents states to restore orientation, not as a substitute for evidence or visual rhythm.

Selecting one system does not require tracker furniture on every page. A full-page system uses one full state on the contents page and repeats that state at material chapter transitions; any optional compact analytical-page state remains a variant of the same component and must use the same labels, identifiers, order, and active state. Decide whether that content-page variant carries a visible tracker label before authoring. If it does, repeat the label on every slide in the variant's declared range; do not drop it from individual slides because the active chapter feels obvious.

For commercial due-diligence and other long executive pre-reads, default to a segmented full-state system on the contents page and at material chapter transitions. Long means that the deck, chapter labels, title lengths, or evidence density make a persistent multi-item rail compete with the analytical canvas; as a working heuristic, this usually includes pre-reads above roughly twelve slides. Ordinary analytical pages then use one stable action-title header and, only when needed, one compact chapter or subsection running label rather than the complete chapter set. Reserve a persistent top bar for a shallow deck whose small number of short chapters benefits materially from continuous orientation. Do not select it merely because three to five chapters can technically fit.

A segmented full-state tracker is one continuous horizontal component divided into exact chapter segments. It may occupy a dedicated contents or chapter-transition page, with one active segment, chapter number, exact label, and one question or thesis statement. It is not a row of decorative tabs repeated above every action title. Keep all segments geometrically related, preserve their labels and order, and advance only the active state at a material audience shift.

## Visual guides

The HTML fragments below are supporting design guides, not browser-delivery templates and not additional rule owners. Read only the fragment for the selected system. They use a shared 16:9 vocabulary and static sample content to make hierarchy, geometry, active state, and full-to-compact continuity explicit; translate the structure into the target slide platform and inherit the active theme rather than copying these resolved sample values.

```css
:root { --ink: #051c2c; --component-primary: #16207b; --muted-ink: #687385; --primary-tint: #eef0fb; --divider-rule: #d7dce5; --paper: #fff; }
.slide { position: relative; width: 1280px; height: 720px; padding: 42px 64px; background: var(--paper); color: var(--ink); font-family: Arial, sans-serif; }
.tracker-item { color: var(--muted-ink); }
.tracker-item[aria-current="step"] { color: var(--ink); font-weight: 700; }
.action-title { max-width: 1040px; margin: 14px 0 0; font-size: 38px; line-height: 1.08; }
.tracked-header { position: relative; }
.tracked-header .running-label { position: absolute; left: 64px; top: 27px; width: 1152px; margin: 0; color: var(--component-primary); font-size: 15px; font-weight: 700; }
.tracked-header .action-title { position: absolute; left: 64px; top: 58px; width: 1152px; max-width: none; margin: 0; }
.tracker--top { display: grid; grid-template-columns: repeat(4, 1fr); width: 760px; border-bottom: 1px solid var(--divider-rule); }
.tracker--top .tracker-item { padding: 0 0 11px; text-align: left; }
.tracker--top .tracker-item[aria-current="step"] { border-bottom: 4px solid var(--component-primary); }
.sidebar-layout { display: grid; grid-template-columns: 320px 1fr; padding: 0; }
.tracker--sidebar { padding: 54px 30px; background: var(--primary-tint); }
.tracker--sidebar .tracker-item { display: block; padding: 13px 14px; }
.tracker--sidebar .tracker-item[aria-current="step"] { background: var(--paper); border-left: 5px solid var(--component-primary); }
.tracker--grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 54px 44px; }
.tracker--grid .tracker-item { min-height: 150px; border-top: 2px solid currentColor; }
.tracker--grid .tracker-item[aria-current="step"] { border-color: var(--component-primary); }
.tracker--badged-list { display: grid; gap: 14px; }
.tracker--badged-list .tracker-item { display: grid; grid-template-columns: 48px 1fr; align-items: center; min-height: 74px; padding: 10px 16px; }
.tracker--badged-list .tracker-item[aria-current="step"] { background: var(--primary-tint); outline: 2px solid var(--component-primary); }
.tracker--segmented { display: grid; grid-template-columns: repeat(4, 1fr); width: 1152px; border-top: 1px solid var(--divider-rule); }
.tracker--segmented .tracker-item { min-height: 92px; padding: 16px 18px 12px; border-right: 1px solid var(--divider-rule); }
.tracker--segmented .tracker-item:last-child { border-right: 0; }
.tracker--segmented .tracker-item[aria-current="step"] { background: var(--primary-tint); box-shadow: inset 0 5px 0 var(--component-primary); }
.badge { display: grid; width: 44px; height: 44px; place-items: center; background: var(--paper); border-radius: 50%; }
```

## Shared tracker contract

Define the tracker once from the approved storyboard before building pages. Store one stable record for each navigable item:

- a stable chapter or item identifier;
- the exact display label and any approved compact form;
- the position in the sequence;
- the hierarchy level and parent when a subsection exists;
- the first and last slide governed by the item;
- the full-state and content-page variants that may display it;
- the named analytical-header template, required `tracker-label` and `action-title` slots, their registered anchors, and the exact slide range in which both are visible;
- active and inactive treatments, plus a completed treatment only when completion is a real audience-relevant state;
- visibility rules for cover, contents, heading, analytical, appendix, and closing pages.

Carry the exact label through the contents page, chapter heading, persistent rail or badge, tracked analytical-header label slot, and any cross-reference. Do not synonymize, abbreviate, renumber, or concatenate it locally. Do not concatenate a subsection, page topic, slide role, or qualifier into the top-level tracker label. The top-level label slot renders only the exact active tracker label or its one approved compact form; a subsection or page topic belongs in its own registered field and never after a dot, colon, slash, dash, or other improvised separator inside the tracker label. If a compact form is necessary, approve it in the tracker record and use that same form everywhere the compact variant appears.

Derive the items from the approved dot-dash or selected deck template, not from broad content buckets invented during layout. Labels must name the audience's actual questions or decision branches. Avoid generic labels such as `Case`, `Business`, `Risk`, or `Decision` when they conceal the chapter's contribution; prefer precise labels such as `Strategic case`, `Standalone quality`, `Deal risks`, `Ownership model`, and `Decision gates` when those are the approved branches.

## Top bar

```html
<section class="slide">
  <nav class="tracker--top" aria-label="Deck chapters">
    <span class="tracker-item" aria-current="step">Strategic case</span>
    <span class="tracker-item">Standalone quality</span>
    <span class="tracker-item">Deal risks</span>
    <span class="tracker-item">Decision gates</span>
  </nav>
  <h1 class="action-title">The strategic fit warrants diligence, but not approval</h1>
</section>
```

Use a top bar only when all chapter labels fit without squeezing, wrapping, or competing with the title. Keep the rail outside the title block, align its first stop to a stable left-hand guide, and show one unambiguous active state through the theme's accent, underline, short rule, or tonal treatment. Muting may distinguish inactive chapters; do not treat inactive chapters as illegible disabled controls.

Do not add a second top tracker, repeat the same rail in the footer, or combine the bar with a persistent sidebar. A chapter number is useful only when the audience refers to numbered sections elsewhere in the deck.

## Segmented transition tracker

```html
<section class="slide">
  <h1 class="action-title">Position and commercial engine</h1>
  <p>Where does Hugging Face control value, and what converts public adoption into paid economics?</p>
  <nav class="tracker--segmented" aria-label="Deck chapters">
    <span class="tracker-item"><strong>01</strong><br>Market and customer evidence</span>
    <span class="tracker-item" aria-current="step"><strong>02</strong><br>Position and commercial engine</span>
    <span class="tracker-item"><strong>03</strong><br>Plan and downside</span>
    <span class="tracker-item"><strong>04</strong><br>Decision and value creation</span>
  </nav>
</section>
```

Use this system for long pre-reads when the audience needs to re-orient at material shifts but a permanent top bar would crowd every analytical page. Place the complete segmented component on the contents page and repeat it at the selected chapter transitions. Keep analytical pages free of the four-segment rail; a compact running label may identify the active chapter without recreating the tracker.

## Sidebar with index and subsection states

```html
<section class="slide sidebar-layout">
  <nav class="tracker--sidebar" aria-label="Requirements sections">
    <span class="tracker-item" aria-current="step">1. Data synchronization</span>
    <span class="tracker-item">2. User administration</span>
    <span class="tracker-item">3. Session monitoring</span>
    <span class="tracker-item">4. Reporting</span>
  </nav>
  <main class="tracked-header">
    <p class="running-label">1. Data synchronization</p>
    <h1 class="action-title">Automated roster sync removes the largest implementation burden</h1>
    <p>Subsection 1 of 3 · Account creation</p>
  </main>
</section>
```

Use a sidebar when the deck repeatedly works through a stable list and the audience benefits from seeing the surrounding items. Introduce the system on a heading or index page before the detailed run begins, then reserve the same grid span for it on every applicable content page.

Highlight the active item with one restrained state such as a light surface, a small edge marker, a short rule, or accent-coloured type. Keep inactive labels readable but subordinate. Repeat the exact active label in the tracked analytical-header label slot so the page remains identifiable when the sidebar is cropped, printed, or viewed as a thumbnail.

One interim subsection state may sit beneath the active item or appear as a smaller running marker when the iteration genuinely has two levels. Keep the parent chapter visible, limit the system to one subordinate level by default, and do not turn slide titles or every row in an exhibit into tracker nodes.

## Full-page grid

```html
<section class="slide">
  <nav class="tracker--grid" aria-label="Deck chapters">
    <article class="tracker-item" aria-current="step"><strong>01</strong><span>Case for action</span></article>
    <article class="tracker-item"><strong>02</strong><span>Market landscape</span></article>
    <article class="tracker-item"><strong>03</strong><span>Strategic fit</span></article>
    <article class="tracker-item"><strong>04</strong><span>Operating model</span></article>
    <article class="tracker-item"><strong>05</strong><span>Risks and mitigations</span></article>
    <article class="tracker-item"><strong>06</strong><span>Decision and next steps</span></article>
  </nav>
</section>
<section class="slide tracked-header">
  <p class="running-label">01 · Case for action</p>
  <h1 class="action-title">The opportunity is large enough to justify focused diligence</h1>
</section>
```

Use a grid when the audience should understand the complete chapter architecture at a glance. Give peer chapters equal tile geometry only when they have equal narrative status; otherwise use scale, placement, or grouping to show the real hierarchy instead of forcing artificial symmetry.

On the opening state, emphasize the first active tile and keep future tiles visible but subordinate. Reuse the full grid at every material chapter boundary, advancing only the active state. A chapter may have a sparse subsection heading page when the next set of slides needs a named intermediate frame. Keep analytical pages free of the grid and use the approved compact running label only when the chapter would otherwise be ambiguous.

## Full-page badged list

```html
<section class="slide">
  <nav class="tracker--badged-list" aria-label="Deck chapters">
    <div class="tracker-item" aria-current="step"><span class="badge">I</span><strong>From signal to decision</strong></div>
    <div class="tracker-item"><span class="badge">II</span><strong>Commercial opportunity</strong></div>
    <div class="tracker-item"><span class="badge">III</span><strong>Operating requirements</strong></div>
    <div class="tracker-item"><span class="badge">IV</span><strong>Risks and mitigations</strong></div>
  </nav>
</section>
<section class="slide tracked-header">
  <p class="running-label">I · From signal to decision</p>
  <h1 class="action-title">The initial signal supports a bounded diligence programme</h1>
</section>
```

Use a badged list when chapter order matters and the labels need more horizontal room than grid tiles allow. Keep badge style, label text, row spacing, and order stable. On a contents guide, emphasize the current row through one theme-defined surface, outline, rule, or typographic state while the remaining rows stay readable.

Advance the active row only at a real chapter boundary and return to the full list when that transition occurs. Content pages need not carry tracker furniture; when orientation requires a compact state, use the same badge and label, or the approved compact form, in one stable position above the action title. Do not use badges as ornamental numbering when the sequence has no narrative meaning.

## Heading, contents, and subsection pages

A contents page establishes the tracker map; an interim chapter-transition page repeats that map with the new top-level chapter active; a subsection page marks a meaningful subordinate shift inside it. For multi-chapter consulting decks, this contents-plus-transitions sequence is the preferred visible tracker. Use only real boundaries required for orientation, pacing, or live delivery.

Keep heading pages sparse: the exact tracker number or badge when used, the exact label, and at most one setup sentence that frames what the chapter will prove or decide. Do not preserve template chapters, insert empty dividers between every analytical slide, or create subsection pages merely to add visual rhythm.

## Cross-page consistency

- Use one selected tracker system for the complete deck. Do not alternate among top bar, sidebar, grid, and badged list because individual slides have available space.
- Cover pages omit the tracker by default and may include one only when an authorized source template explicitly requires it for navigation; contents and material chapter-transition pages use the full state; analytical pages omit it by default or use the one approved compact state; closing and appendix pages follow explicit deck-wide visibility rules.
- When the selected tracker variant includes a visible label, show that label on every slide governed by the variant. Use the exact active label or its one approved compact form in the same position; a label-bearing variant cannot appear intermittently within its declared range.
- Treat the tracker label and action title as the two required fields of one analytical-header template. Their presence, anchors, width, typography roles, and gap remain fixed throughout the declared range; only the field values and approved one-line or two-line title state change.
- Render the top-level tracker label verbatim from the active tracker record. Do not append a subsection, page topic, slide type, or other qualifier; a necessary second level uses its own registered slot and range.
- Keep the tracker in the same guide position and visual hierarchy on every applicable page. A full and compact variant may occupy different approved layouts, but their state and labels must remain bound to the same tracker record.
- Update the tracker map after any slide, chapter, or subsection is inserted, removed, renamed, split, or reordered. Recalculate active ranges, heading pages, running labels, page numbers, cross-references, and appendix references together.
- Use the active theme's typography, single component-primary colour, primary tint, neutral surfaces, page guideline, divider rule, spacing, and component treatments. Do not use chart-series colours or invent tracker-specific fonts, colours, borders, or shadows on individual pages.
- Keep trackers secondary to the action title and evidence on content pages. If a persistent tracker makes the analytical canvas unreadable, select a full-page contents-and-transition system instead of shrinking the exhibit.

## Acceptance check

- the selected system matches the deck's hierarchy, chapter count, label length, delivery context, and available content canvas;
- a multi-chapter pre-read establishes the complete tracker map on a contents page and returns to the same full-state tracker at material chapter transitions, making the thesis progression legible rather than merely tagging topics;
- the number and placement of full-state transitions pass the transition-density test: each interruption marks a material audience shift, short chapters are consolidated or compactly labelled, and navigation does not crowd out the analytical proof;
- every tracker item maps to a real chapter, workstream, requirement, diligence question, or subsection in the storyboard;
- labels, identifiers, order, badges, compact forms, and chapter boundaries are consistent across full and content-page variants;
- exactly one item is active on every tracked page, inactive items remain readable, and a completed state appears only when completion is factual and useful;
- every slide governed by a label-bearing tracker variant displays its exact active label or one approved compact form in the registered position, with no omissions inside the declared range;
- every slide governed by the tracked analytical-header template contains both required fields at the registered anchors, and the tracker-label text exactly matches the active tracker record without concatenated slide-local qualifiers;
- heading and subsection pages introduce real boundaries and use the same labels as the navigation component;
- any optional running label in the analytical-header template matches the active tracker item exactly or uses its one approved compact form, and no isolated or concatenated running label is counted as the tracker system;
- no page combines competing tracker systems or draws a slide-local substitute;
- structural edits have propagated to tracker ranges, heading states, page numbers, cross-references, appendix references, and the action-title spine;
- cover, contents, analytical, appendix, and closing pages follow the deck's declared visibility rules;
- a full-deck montage shows a coherent progression without stale, skipped, duplicated, or prematurely advanced states.
