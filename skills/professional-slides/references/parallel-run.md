# Run a long deck in parallel

A deck of a hundred pages built in sequence spends most of its time waiting. One agent writes every page, one critic reads them all, writers hunt through the references and the logs, and each finding surfaces a round after the last. On the BA benchmark that came to almost seven hours. This page sets out the stages, the roles and the limits that let the same deck, held to the same gates, be built section by section, side by side.

A section is one part file, `pages/<part>.pages.json`, of about five to eight pages: a pillar of twenty pages is three or four sections, so no writer holds the run for long. The lead (the agent the user talks to) owns the request, the governing thought, the sections and every stage gate. It never writes pages and never runs the skill's test suite.

## The stages

| Stage | Who, side by side | What they read | Done when |
| --- | --- | --- | --- |
| 1. Brief and sections | The lead | The request, the insight log's index | `deck` written; one part file per section, each with its sub-question and page budget |
| 1b. Answer critique | One critic, beside the lead's sectioning | The packet `answer-critique.mjs <id>.pages.json out/` stages: the answer beside every insight's calculation | Recorded; the answer narrowed, and the analyses and searches its items name started ([Read the answer against the log](storylining.md#read-the-answer-against-the-log)) |
| 2. Skeleton | One `skeleton` agent per section | `author-deck.mjs <id>.pages.json --brief skeleton --section <part>`, which prints the answer critique's open items and the log's hazards | Each page has its title, type, `why`, `evidence` and `settles`; then the lead runs `--plan --write` and `--draft` to exit 0 |
| 3. Critique | One critic on the whole spine, a fresh one each pass (the spine critique is one reading: its items are capped across the deck); beside pass 1, one self-checker on the titles | The packet `storyline.mjs <id>.deck.json out/` stages, as soon as `--draft` exits 0; `author-deck.mjs <id>.pages.json --brief selfcheck --spine [--section <part>]`, each title and divider summary with the records behind it | The review records `ready`; blocking items go back to that section's skeleton agent, and the spine self-check's replacements (a title's number, period or ranked word narrowed to its record) go into the titles before the critique closes, not after it |
| 4. Write | One `writer` per section | `--brief writer --section <part>` | Every page in the section checks clean, with `--check --page <ids> --json` and `--claims` |
| 5. Judge and self-check | One reading per section, after its last structural change: the deck-level variety and depth fixes come before it. A fresh reader and a self-checker, side by side | The packet `judge.mjs <id>.pages.json --page <section ids>` stages; `author-deck.mjs <id>.pages.json --brief selfcheck --section <part>`, every claim with its slot's room | Both answers pass `--validate`. The section's writer applies both answers' replacements word for word in one pass, then runs `--check --page` and `--claims` mechanically. There is no second reading |
| 6. Compile and render | The lead | The whole-deck compile, then `--check --render` | Exit 0, every finding fixed in one batch |
| 7. Record and review | The lead, then the reviewer | `self-check.mjs <id>.pages.json out/` after the build, then the review packet | `out/self-check.json` complete: a page whose replacements were applied word for word keeps its verdict, and only a page changed besides goes back to its self-checker, for the lines the record names; the review accepted |

A section moves to its next stage as soon as it passes: the lead does not wait for every section to be written before the first is judged.

Stage the critique as early as the draft allows. A structure rule that only a change of page type can meet does not hold it back: `--plan --write` writes its forms anyway and says so, and the types change beside the critic's reading (each changed page is verified on its own). The confirming critic of a pass's blocking items reads while the lead starts the fixes. The full critique of the written deck (`storyline.mjs --full`) splits by section for a long deck, and `--split` asks for that split at any length. Data gaps a critic finds go to one research agent per gap, in parallel, while the sections they do not touch are written.

## What each agent is given

A role's brief is the pack `--brief <role>` prints, and nothing else. The pack holds:
- the rules that role follows, as a digest linked to the references;
- for each page, its fields and its exact `limits` (the words each text slot takes, the characters a heading fits);
- the measures its evidence holds, with the token that prints each one.

An agent that reads the references whole, or greps the insight log, is spending the deck's time on what its pack already says.

Add to the pack only what this deck asks of the role: the voice, the counter-case to keep, the pages that carry the answer.

## Limits every agent keeps

| Role | Budget | Stop and report when |
| --- | --- | --- |
| `skeleton` | About 40 tool calls | A page's evidence cannot settle its title |
| `writer` | About 80 tool calls; at most three checks of a page | The same finding returns after a fix; a page cannot compose under any form the check proposes |
| critic, judge, self-checker, reviewer | One reading, its answer validated | The answer fails `--validate` twice |
| lead | Routes every fix to the page's own writer, word for word where a checker gave the wording | Never writes copy itself: on the BA retest a dozen of the self-check's problems were in lines the lead wrote while clearing gates |
| research | About fifteen searches a gap | The decisive series is found, or shown not to be public |

Each agent keeps its scratch files in a folder named for its section (`scratchpad/w-<part>/`): writers side by side overwrote one another's check output when they shared one.

A writer checks only its own pages, with `--json` (a page's findings, budgets and limits, not the whole deck's report). It writes copy to the stated ranges, and applies the copy rules to its own lines before the judges read them. It never tries variants by brute force: a page that fails on length is told the range that fits, and a page that cannot compose is told the form that does.

A critic, judge, self-checker or reviewer runs the `--validate` command its packet or brief names before handing back (`judge.mjs <id>.pages.json --validate <answer.json>`, `storyline.mjs <id>.deck.json out/ --validate <review.json>`, `self-check.mjs --validate out/self-check/<part>.json <id>.pages.json`). An answer refused after it is handed back costs a whole reading.

The stage 5 reading is the last one because its fixes are closed. On ba4 the first per-section self-check found about 115 problems, and a second full reading found 44 more. The sheet had left out cells and labels. Its fixes overran their slots, so the writers trimmed them. Lines were rewritten for other reasons after the check. And applying the checker's own fix voided the page's verdict, so 70 of 89 pages were read again. Now:
- the sheet carries every text a reader takes as a claim, cells and labels included;
- each problem names its `field` and the field's whole `replacement`, written to the room the brief prints beside it;
- the validator refuses a replacement that overruns its slot or prints a number no record holds;
- the join carries a page's verdict when the page reads as checked with the replacements in place.

Every rewrite after the reading is a replacement from one of the two answers. A line rewritten for any other reason is the one thing that sends a page back.

## When something stops

- **The API drops.** Resume the stopped agent with what it was doing; do not wait to be told.
- **A finding names another section.** It goes to that section's agent, not to whoever found it.
- **A page's argument moves while it is written** (its title, type, `settles`, `evidence` or the measures it shows): `SPINE_LOCKED` names that page alone. It goes back to its section's critic, not the whole deck's.
- **The deck-level rules break at the whole-deck compile** (variety, mix, repeated claims): the lead fixes them in one batch, across sections, before rendering.
