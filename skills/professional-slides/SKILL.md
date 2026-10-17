---
name: professional-slides
description: Create or revise editable PowerPoint decks with an answer-first storyline, charts drawn from the data, and every page rendered and checked. Use a general PowerPoint editor for quick fixes.
---

# Professional Slides

A deck is an argument for one reader. Find out who that reader is and what they already know, write the storyline they need, then draw each page once from a catalogue of page types. The runtime lays out, renders and checks every page; you look at every page before you deliver.

Paths resolve from this skill's directory. Write deck files to a task folder, never into the skill. Every command exits 0 done, 1 crash or bad usage, 2 refused: fix what it prints and run it again.

## The process

1. **Ask.** Before any storyline, ask the user who reads the deck, what they already know about the subject (the source, its terms, the context), and what the deck is for. Record the answers as `audience`, `readerKnows` and `decision` on `deck`. Then `node runtime/preferences.mjs show`: if design answers are missing, ask them as [Design intake](references/design-intake.md) describes; if they are stored, say in one line what is reused. Once the pages file exists, `node runtime/preferences.mjs apply <id>.pages.json` writes them into its `deck`, filling only keys the deck does not set.
2. **Storyline.** Write the titles in order: first the setup this reader needs (what the subject is, how it was measured, the terms), then the findings, each title a full-sentence claim, then what follows: the limits of the evidence and the implication, ending the deck on it. Show the user the titles with each page's type and, for a chart, the comparison it shows - what against what - and wait for approval unless they have already said to go ahead. A chart that compares nothing is redrawn here: a run of periods that barely moves, or a long series drawn to compare two of its periods ([Drawing](references/drawing.md#show-a-comparison)); the build refuses both. [Storylining](references/storylining.md)
3. **Pages.** Write `<id>.pages.json` once. Each page is a type from `node runtime/author-deck.mjs --types`; `--example <type>[/<form>]` prints a worked page and `--schema <type>/<form>` every field it reads. Pick the chart a reader expects for the claim and put the point the title rests on on the chart, as a callout, a change mark or a labelled reference line; a column of points beside it, or a summary bar, is the exception - [Drawing](references/drawing.md). Put numbers in `<id>.insights.json` and print them by reference, or type them.
4. **Build.** `node runtime/author-deck.mjs <id>.pages.json` compiles and checks every page and writes `<id>.deck.json`; `--check --render` also renders them. Then `node runtime/build-deck.mjs <id>.deck.json out/` writes `out/<id>.pptx`, the renders in `out/rendered/` (with `<id>.pdf`) and `out/build-result.json`.
5. **Look at every rendered page** in `out/rendered/slide-N.png`. Fix what reads wrong - a crowded chart, a label cut short, a page that says nothing new - in the pages file, and rebuild.
6. **Deliver** `out/<id>.pptx` and `out/rendered/<id>.pdf`. Say what you checked and what evidence is missing.
7. **Review**, only if the user asks: one fresh reader, one pass over the renders and the source, reporting each problem as `FACTUAL_ERROR`, `UNSUPPORTED_CLAIM`, `MISLEADING_COMPARISON`, `OVERFLOW`, `UNREADABLE`, `BROKEN_GEOMETRY` or `MISSING_CONTEXT`, with the page and the fix.

## What the runtime refuses, and what it fixes

It refuses only what cannot be drawn or would ship wrong: an unknown type, form, key or icon; data a form cannot read; more than a frame holds; text that overlaps or cannot be read on its ground; a number that does not bind to the data; a saved file that lost what was composed. Everything else is your choice. Where a page names something its placement does not draw - points under a so-what bar, a highlight the page never writes, a callout a form has no room for - the compiler sets it aside and says so (`PAGE_ADJUSTED`). It computes waterfall and stack totals, axis ticks and footers itself. A typed number that matches no recorded value is advised (`NUMBER_UNTRACED`), not refused.

## Changing a deck the user already has

`$RUNTIME_PYTHON runtime/import-deck.py deck.pptx <work>/ --carry` writes a pages file in which every slide is carried as it is. Change only what the request names: words on a slide with `replace: [{ "old": "...", "new": "..." }]` or a new `title`, a slide redrawn by giving its page a `type` in place of `carry`, a page added or deleted. Compile and build as above; `NUMBER_STALE` and `WORDING_STALE` name other slides that still say what you changed. Every carried slide is copied byte for byte, and `revision.preserved` in `out/build-result.json` confirms it. Without `--carry`, the importer starts a full rebuild with each slide's old copy as its `draft`.

## Setup

`node runtime/doctor.mjs` checks Node, the Python interpreter and its packages, LibreOffice and poppler, and prints the install lines for anything missing; use the `RUNTIME_PYTHON` it names. From the repository: `python3 -m pip install -r requirements.txt`. `--no-render` builds without LibreOffice; the pages are then not rendered or checked as rendered. A deck that needs logos or photographs fetches them at the build; offline, supply them in `assets/` or set `assets: { fetch: "none", reason }`. Google Slides imports the PPTX; check it there separately.

Ask questions with the host's question tool where it has one (Claude Code: `AskUserQuestion`). Maps of regions the runtime does not ship: [Geography](references/geography.md).
