# Point-change benchmark

The skill serves two workflows: a new deck from a brief, and a change to a deck
the user already has. Every gate, critique and review in it was written for the
first. This directory is the second as a command: a deck made here, a change a
user would ask for, the revision run the way `SKILL.md` ("A point change") tells
an author to run it, and the checks below on what comes out.

```bash
node evals/point-change/run.mjs                      # every task, scripted author, offline
node evals/point-change/run.mjs --task retitle       # one task
node evals/point-change/run.mjs --agent claude       # a real agent CLI (evals/quality/config.json `agents`)
node evals/point-change/run.mjs --tasks my.json      # tasks on a deck of your own (a task's `deck`, `files`)
python3 evals/point-change/preservation.py source.pptx revised.pptx [--pairs 1:1,2:2,4:3]
```

Exit 0 when every task meets every check, 2 when one does not. It needs
LibreOffice: delivery reviews a rendered deck. Scripted, the seven tasks take
six to eight runtime commands each (the `commands` column lists them): import,
a compile per attempt and the full compile, the storyline gate (twice where a
critique is staged), the build, delivery to the review packet - and, where the
task goes on to an accepted delivery, delivery again with the scripted review.
Six is the least: a change whose first attempt compiles and whose spine is
unchanged, to the packet.

## What a point change owes its user

| Check | What it reads | Passes when |
| --- | --- | --- |
| `made` | the revised PPTX, read back by `runtime/import-deck.py --inventory-only`, and the assembled deck's scene | the new words are on the slides the task names, the old words are on no slide, and a redrawn exhibit is drawn as the kind asked for |
| `preserved` | `preservation.py`: the source deck against the revised one, slide by slide | every slide the task does not change is the source's, byte for byte, with every part it draws on; a slide edited in place has every shape where it was |
| `stale` | the refusals of the first compile | where the figure stands on several slides and the author changed one, the compile was refused naming the others |
| `scoped` | the storyline packet, the review packet, the refusals | no refusal named an untouched page; the critique was staged only for a changed title and marked only that page; the review asks for the changed pages and no other |
| `asked` | the source deck and the revised one, read back slide by slide, speaker notes included | every slide edited, redrawn or cut is one the task names, and every line that differs on an edited slide is the source line with the task's own changes made (`accept.edits`) - the title of a slide the task asks to retitle is asked for whatever its words: an edit nobody asked for - "up 14%" made "16%" beside the restated figure - fails it |
| `delivered` | `delivery.json`, on a task marked `deliver` | a scripted reviewer answered the packet and delivery accepted the deck; its record lists every change made (`made`) and reports what the critic found in a slide nobody asked to change (`aboutImported`), that slide untouched |
| `refusedFor` | the refusals of the first compile, on a task that names codes | the first move was refused for what it should be: a bare figure that stands only inside longer numbers |
| `packet` | a real agent's run only: delivery's record of the review packet it reached | the packet asks for the task's changed pages and no other (or the deck was delivered) |

Beside them the run counts its cost - the runtime commands in order, the runs
refused, each refusal with whether it named a changed page - which is reported
and never scored.

`stale` accepts any finding whose code holds `STALE` and names the slides
left behind: `NUMBER_STALE` for a figure and `WORDING_STALE` for words, the
runtime's one check on what a revision leaves behind, whether the change was a
text edit on a carried slide or a page composed where a slide stood.

## Tasks (`tasks.json`)

| Task | The request | What it exercises |
| --- | --- | --- |
| `number-propagates` | a restated figure that stands on three slides - in a sentence, in a table's total, in the close | text edits in place; the first move changes one slide and is refused for the others |
| `retitle` | a label title made a claim | a title rewritten in the slide's own placeholder; a critique scoped to the one slide; `made` reads the new title for what it says (`retitled: [{ slide, says }]`), not for the scripted sentence |
| `exhibit-swap` | a pie redrawn as a donut, with a title that says what it shows | one page composed by the runtime among seven carried slides, held to every page rule; `made` asks for a new title that is a sentence, whatever its words |
| `notations` | the restated figure on a deck that says it five ways - "£12.4m", a table's 12.4 under "Revenue (£m)", "£12.4 million", and "£12.4m" in a slide's speaker notes | the stale check by quantity: the first move is refused naming every one; the edits reach the notes; carried to an accepted delivery |
| `bare-number` | the same restatement, with the figure typed bare ("12.4") beside "£12.45" and "£12.4" a kilo | an edit that stands only inside longer numbers is refused with them named; the longer numbers are untouched in the delivered deck |
| `swap-own-title` | "redraw the pie as a donut, leave everything else" | a page composed under the slide's own label title, with the slide's own lines: it compiles, and stages no critique |
| `retitle-contradicts` | the retitle, where the new title contradicts a slide nobody asked to change | the scripted critic files the contradiction as about the imported deck: it blocks nothing, the run is delivered with it reported to the user, and the untouched slide is identical |

A task is `{ id, fixture | deck, request, moves, accept }`. `moves` are what the
scripted author writes into the pages file, one a compile; a later move is
made only when the compile refused the one before, which is how a task says
"the author's first attempt is incomplete". A real agent is given `request` and
the deck, told to build the revision in `work/` beside it, and nothing else;
its transcript and the wall time are kept beside its workspace
(`<task>-agent.stdout`, `agent.seconds` in the results), and the revision is
found wherever it was built - in the workspace, or in a folder the transcript
names.

## Fixtures (`fixtures.py`)

Nothing binary is committed. `user` is a deck this skill did not build,
written with python-pptx: placeholders, native charts, a native table, a
picture, notes, and a footer and page number set as text boxes. `notations` is
the same deck saying its headline figure in several notations and in a
slide's speaker notes, beside longer numbers that hold its digits. `own` is a
deck this skill built, from the worked example.

## What the baseline was

Before slides could be carried, the first three changes on the `user` deck
never reached a build: with every slide mapped to a page type by hand, each
was refused at the compile for the user's own untouched pages - topic titles,
thin pages, a deck with no stated answer - and a build, had there been one,
would have redrawn every slide in this skill's design. On a deck this skill
built, re-mapped from its own pages file, a one-number change staged a
critique over 21 pages with nine marked changed, a self-check of 20 pages and
a full review of 28 slides.
