# Quality eval

The unit suite checks that each part of the skill does what it says. It cannot
say whether the decks got better. This directory is the end-to-end measurement:
a headless agent is given a brief and nothing else, the deck it delivers is
judged blind, and the result is compared with the previous version of the
skill on the same brief.

```bash
node evals/quality/run.mjs --set dev --runs 3                 # the development briefs
node evals/quality/run.mjs --set heldout --runs 3             # the held-out briefs
node evals/quality/run.mjs --set all --runs 3 --agent claude --judge claude
node evals/quality/run.mjs --set dev --runs 1 --dry-run       # print the commands, run nothing
node evals/quality/run.mjs --report                           # the summary for this skill version, one block per treatment
```

A run costs real model time: an agent run builds a whole deck, and every
judged deck is one or two judge calls. `--dry-run` shows exactly what would be
called.

## What one run does

1. **Agent.** An empty temporary workspace, and the agent command from
   `config.json` with `{prompt}` set to the brief as a stranger would type it -
   the "Why this brief is in the suite" paragraph is removed, since it says what
   the run is there to catch. For the `claude` agent, `{plugin}` is a fresh
   package of this checkout (`evals/scripts/package_plugin.py`) loaded with
   `--plugin-dir`, so the run measures this working tree rather than whatever
   is installed. `PROFESSIONAL_SLIDES_HOME` points into the workspace so stored
   design preferences cannot make two runs differ.
2. **Collect.** The build directory (the one holding `scene.json`, preferring a
   delivered one), its renders and review sheets, `delivery.json`, and the
   pages, plan and deck files are kept under
   `runs/<skill>/<brief>/<agent>-<prompt>-<judge>-run<n>/` (git-ignored). The
   authoring files are the scored deck's own - its id, in its spec's
   directory - never the newest file on disk, which may be another attempt's;
   one that cannot be told to be that deck's is not guessed but recorded in
   the result row's `deck.missing` with the reason. Review and storyline histories (`.reviews/`) are never
   collected. A run that leaves no rendered deck is recorded as `no-deck` or
   `agent-failed`; that is a result, not a gap. Delivery ends with a
   confirmation read of the accepted deck; a run that stops before it (a review
   or confirmation packet waiting) is still judged, and recorded as not
   delivered with its `deliveryStage`.
3. **Score.** The cold-run scorer (`../cold-run/score.mjs`) runs the build
   bars on the scene and the plan gates on the plan.
4. **Judge, blind.** A packet directory holding only `brief.md`, `rubric.md`
   (condensed; five dimensions and majors) and the rendered pages as contact
   sheets. No pages file, plan, scene, reviews, self-check, storyline critique
   or history: a page that needs its author's explanation is a page that does
   not work. The judge returns
   `{rating, dimensions: {argument, evidence, visual, copy, sequence}, majors}`.
5. **Pairwise.** The same judge sees this deck and the most recent stored deck
   from a different skill version for the same brief, agent and prompt, as
   `deck-1/` and `deck-2/` in an order fixed by a hash of the pair - never
   labelled old or new. The preference is mapped back to `current`,
   `previous` or `tie`.
6. **Record.** One line in `results.jsonl`, keyed by skill version, judge
   model, agent, prompt, brief and run. A key already recorded is refused
   before the agent runs, so nothing is paid for twice and nothing doubled;
   new runs continue the run count.

The skill version is the git tree hash of `skills/` at HEAD, with
`+dirty.<digest>` of any uncommitted change to it, so two different working
trees never share a key.

## The report

One block per treatment - an agent and prompt pair - since runs under another
agent or prompt measure something else. Per brief: runs, mean rating, standard deviation, min and max, decks not
produced, how many cleared the build bars and the plan gates, and the pairwise
record (won-tied-lost) with its win rate, where a tie counts a half. Overall:
the pairwise win rate against the previous version. Three runs is the least
that shows spread; a mean moving by less than the standard deviation is noise.

## Briefs

- **dev** - the cold-run briefs in `../cold-run/briefs/`. Look at these runs,
  find what failed, fix the skill.
- **heldout** - `briefs/heldout/`. Never used to tune the skill: nobody reads a
  held-out run to decide what to change. They say whether fixes made against
  the dev briefs generalise. See `briefs/heldout/README.md` for what to do when
  one is spent.

## Commands and placeholders

`config.json` holds argv templates. Agent: `{prompt}`, `{workspace}`,
`{plugin}`. Judge: `{prompt}`, `{packet}`, `{schema}` (the JSON schema the
answer must match: `judge-schema.json`, `pairwise-schema.json`,
`anchor-judge-schema.json`), `{model}`. The `claude` entries were checked
against `claude --help`. The `codex` agent entry is marked `unverified`: its
flags were written without the CLI installed, and Codex loads plugins from its
marketplace rather than from `{plugin}`, so install the package first. The
runner prints the `unverified` note whenever that entry is used.

The prompt defaults to the brief alone (`prompts.brief`). A headless run cannot
answer the design intake or approve a dot-dash; if runs stop to ask, that is a
finding about the skill. `--prompt unattended` adds one line telling the agent
nobody will answer - it changes the run, so it is part of what a result row
records and pairwise only compares like with like.

## Judge calibration

`anchors/` holds rendered pages with a known place on the page scale. Once a
person has scored them, every run reports the judge's mean absolute error over
the scored anchors and records it as an `anchors` row; until then the runner
says none are scored. See `anchors/README.md`.

## Gate validity

`defects.json` labels what people found on the stored specimens with the gate
that should catch each defect. `gate-validity.mjs` replays the stored scenes and
plans through today's gates and prints per-gate recall and precision:

```bash
node evals/quality/gate-validity.mjs
node evals/quality/gate-validity.mjs --overlap                 # also the Chromium overlap audit
node evals/quality/gate-validity.mjs --renders anthropic-vs-openai-2026=path/to/rendered
```

A defect with `expectedGate: null` is one no gate measures yet; the report
lists what fired on those pages, which is where a new gate starts.

## Evidence validity

`fixtures/evidence/` holds four fixture decks on different subjects - a credit
union with eight declared players, an ambulance service under a closed evidence
scope, a note-taking app against two rivals, and an explanation that compares
nothing - each a pages file, an insight log with measures and an analysis plan
(`make_fixtures.py` wrote them). Most exhibits type their values beside a
`basis`; the credit union also writes numbers by reference - a bound chart, an
indexed trend bound to an index analysis, a bound metric, tokens in a title and
in table cells - and the ambulance service draws a recorded series and a
scenario's path as one bound line, so both ways of putting a number on a page
are measured. They are not the deck whose failure prompted
the contract, but they were written with it, by the same hand: they show the
rules fire and stay quiet where intended, not how the contract fares on decks
it has never seen. `evidence-validity.mjs` measures the contract on them:

```bash
node evals/quality/evidence-validity.mjs           # the table; exit 2 unless everything seeded is caught and nothing clean is flagged
```

- **False positives.** Each deck is compiled and checked as it stands. They
  carry the cases a careless rule would refuse: a context exhibit with its
  relevance, two same-unit series read separately with the reason, a metric
  strip over a chart, a deck with no comparison because it compares nothing.
  Any finding is a false positive, the advisory on untraced numbers
  (`NUMBER_UNTRACED`) included. Zero here is by construction: the fixtures
  were written to pass.
- **Seeded defects.** Twenty-one defects are planted on every page each applies
  to, one at a time: an exhibit copied from another page with its evidence id
  appended and the citation left alone, the same copy relabelled as the claim's
  measure or listed beside it, numbers rounded to one figure, a metric's printed
  number changed, a unit, a period or a number changed, a dependency left
  undeclared, a citation dropped, a context exhibit unexplained, a relation
  split across panels; one typed cell of a table changed and one typed number
  in a sentence changed - a number written as a measurement, such as "57%" or
  "12.2 minutes" - which the trace of typed numbers reports as an advisory
  (the table labels these two "(advisory)": they are reported, and block
  nothing); and two references that cannot be bound - a bound exhibit naming a
  measure the log does not hold, and a token of an insight the page does not
  rest on. A defect is caught when the finding it should raise
  names the page. Each defect is planted in the terms a rule reads, so a full
  catch says each rule fires on its own trigger across four decks; it is not a
  recall estimate against an author who errs in ways nobody listed.
- **Known limits (planted, not counted).** The table closes on three defects
  the trace does not claim to catch, planted the same way and reported caught
  over planted: a bare whole number in a sentence changed ("8 branches" is a
  count or a name as often as a measurement, and is not traced), a year changed
  (a year is read as a period label), and a number changed into another
  recorded value of the measure it stated (the trace asks whether a typed
  number is a value of some measure the page rests on, not which record the
  sentence meant - so one that happens to equal a value of another measure in
  a compatible unit passes too). They do not count towards acceptance; a count
  above zero means the trace has started to read that case. The contract runs
  at authoring: a `deck.json` edited after the compile is not re-checked
  against the log.

## Critic calibration

A storyline rated 5, then 4, then 6.2 across three different packets says
nothing about the critic. `critic-calibration.mjs` measures it on packets that
do not change:

```bash
node evals/quality/critic-calibration.mjs --list                # the anchors, and what each plants
node evals/quality/critic-calibration.mjs --repeats 5 --dry-run
node evals/quality/critic-calibration.mjs --repeats 5 [--anchors finance,finance:declined-answer] [--judge claude]
node evals/quality/critic-calibration.mjs --repeats 3 --anchor-dir ~/decks/anchors    # your own decks, with the verdict you expect
node evals/quality/critic-calibration.mjs --repeats 3 --review-packet <staged packet> # a deck-review packet, repeated
node evals/quality/critic-calibration.mjs --repeats 3 --parallel 4 --raw runs/raw     # four calls at a time; every answer kept as returned
node evals/quality/critic-calibration.mjs --from-raw runs/raw                         # score the kept answers again; nothing is called
```

- **Repeats.** Each frozen packet is answered `--repeats` times by a fresh
  critic (the judge command; `{packet}` is the staged packet directory). The
  median spread of those ratings is the noise floor: a deck's rating moving by
  less than it between two critiques is not a result.
- **Planted anchors.** The four fixture decks clean, and each with one defect
  of argument planted - an answer that declines the request, the players'
  comparison cut, a chart about something else kept as context, a page that
  restates its neighbour.
- **What calibrated means: discrimination.** A critic is calibrated when, for
  every plant, the planted deck is sent back with a blocking item filed under
  the check that was planted (*caught*) **and** its clean twin draws no
  blocking item under that check (*the planted check quiet on the clean
  deck*); when every deck of yours is given the verdict you expect; and when
  it has not sent back every deck it was shown. The catch alone decides
  nothing: a critic that files under every check on every deck catches every
  plant. Each pair's line says `told apart` or `NOT told apart` with the
  three figures, and the result names why a run is not calibrated (`why`).
  Whether a planted deck is also rated below its clean deck by more than the
  spread is the secondary measure (`ratingSeparation`): reported, and it
  decides nothing. A delivery bar rests on verdicts and findings, and on a
  rating only where decks a person has judged anchor it.
- **The clean fixture decks are twins, not anchors.** They carry no expected
  verdict - six pages are too thin to say what a ready storyline is, and a
  critic that sends one back is not wrong - so the run reports what was said
  of them (`cleanVerdict`) as `not measured`. A planted deck run without its
  clean twin is not measured either.
- **Form, counted apart.** Every answer is validated as the storyline loop
  validates it. One the loop would refuse is not rated, and is not a verdict
  on the critic's judgement either: the result reports it under `form`
  (answers, how many failed, and under which rule), and the calibration
  verdict is read off the valid answers. An anchor that returned no valid
  answer is `not measured`, not failed.

### What the real critic's run shows

`calibration/storyline-critic.json` is the summary of a real run of the
storyline critic on every built-in anchor - thirteen packets, three answers
each, 39 calls - scored by `--from-raw` from the answers the run kept (no
answer's text is recorded). It is **not calibrated**, and the fixtures are why:

- Every planted deck was sent back with its plant's check filed: 7 of 7
  measured pairs caught, 7 of 7 sent back. Read alone that was called
  calibrated.
- The same check was filed on the clean twin in 5 of those 7 pairs: an answer
  that declines, a comparison cut and context kept off the claim are each
  "caught" on a clean six-page fixture too. Only the restated page is told
  apart, and only on the fixtures - quiet on the two clean ones it was run
  on, filed on the planted ones in 6 of 6 answers; among the showcase's fifty
  pages its check fires on the clean deck as well - so 2 of 7 pairs
  discriminate. (The pair on the showcase's answer returned no valid answer:
  not measured.)
- The clean decks were themselves sent back: finance, public-ops, product and
  the showcase by every valid answer, the explainer by 2 of 3, rated 4 to
  6.8. They are too thin to say what "8, ready" looks like.
- 7 of the 39 answers failed validation on form and were not rated.

So on today's fixtures the critic's verdict is not evidence of calibration:
it shows the critic finds what is planted, and not that it tells a planted
deck from a clean one. What can show that is a clean deck a careful critic
passes - which a six-page fixture is not.

### What can anchor a rating

Two kinds of full-size anchor exist, and they are not the same thing.

- **Your own decks (`--anchor-dir`).** One folder a deck, holding the deck's
  files as the author left them - `<id>.pages.json` or a compiled
  `<id>.deck.json`, with its insight log, analyses and `sources/` - and an
  `anchor.json`:

  ```json
  { "deck": "<id>.pages.json", "expect": "ready", "about": "the board paper that was approved as written" }
  ```

  `expect` is `ready` or `revise`: the verdict you would expect of a careful
  critic. `rating` is optional: the number a person gave the deck, printed
  beside the critic's and never averaged into it. The harness copies the folder to a temporary directory (it writes
  nothing into yours), freezes the storyline packet and reports, per anchor,
  the share of valid answers that agreed, and the mean rating the decks you
  expected ready and the decks you expected sent back were given
  (`ratingAnchors`). This is what a rating can be anchored to: decks a person
  has judged. A critic is not calibrated while it disagrees with one. A deck
  you expect `ready`, beside a copy of it with a defect you plant by hand and
  expect sent back, is the pair the built-in fixtures cannot give.
- **The showcase (`showcase`, in the repo).** The worked-example deck
  (`skills/professional-slides/examples/page-types.pages.json`, about fifty
  pages) clean, and with the two plants that apply to a deck with no insight
  log. It is an anchor for **form at full size**: do answers about fifty pages
  validate, how wide is the spread on a long packet, is a plant caught among
  fifty pages. It carries no expected verdict, on purpose. A deck written to
  show every page type is not proof of a good argument, and a critic that
  sends it back is not wrong; its rating must not be read as what a good
  storyline gets.

### The judge command and the schema

Some CLIs take the answer's schema inline and refuse a file path there
(Claude Code 2.1: `--json-schema is not valid JSON`). A judge template names
which it wants: `{schemaJson}` is the schema inline, on one line;
`{schemaPath}` a file holding it; `{schema}` is whichever the judge's
`schemaAs` names (`"json"`, the default, or `"path"`). The shipped `claude`
judge uses `{schemaJson}`.

### The deck-review side

`--review-packet <dir>` runs the repeat half of the measurement on a
deck-review packet `deliver-deck.mjs --reviewer packet` staged (exit 3; the
directory its note names): the packet's own prompt, `--repeats` times, each
answer validated as delivery validates a first pass. It reports how many
validate, the spread of the rating and of the number of findings, how many
accepted, and the mean number of blocking findings per answer that the
storyline critic could have decided at the spine - the count that says
whether the two judges agree on that deck.

The planted half is not built for the deck review. A deck-review packet is a
rendered build, so each planted anchor would need: a fixture deck that builds
clean with a ready storyline lineage recorded for it; a plant applied to its
pages file (a defect of the drawn page - an unannotated chart, a plain verdict
table, an empty band - and one of argument); a full build and render per
plant (about a quarter of a minute each for fifty pages, and LibreOffice on
the machine); and, for the plants of argument, a storyline verification pass
recorded for the changed spine, since the review is not staged without one.
That is a build farm rather than a share of this harness, so it is left out
and said here.

A run costs `anchors x repeats` critic calls and is written to
`runs/critic-calibration/`.

## Variability

Three decks written from one brief converged on the same few exhibit kinds, and
the plan gave every `variation` seed the same allocation. `variability.mjs`
measures what the plan does with a spine: it strips each fixture deck to its
spine (every page's type, claim and evidence, and no form or exhibit), plans it
under several seeds and every design system, and grades each allocation
against the fit between claims and forms (`runtime/claim-fit.mjs`).

```bash
node evals/quality/variability.mjs                         # the variety spine and the evidence decks, 5 seeds x 4 design systems
node evals/quality/variability.mjs --seeds 8 --designs consulting,journal
node evals/quality/variability.mjs path/to/<id>.pages.json  # another spine, with its insight log beside it
node evals/quality/variability.mjs --runtime <other checkout>/skills/professional-slides/runtime   # a baseline's plans, graded by this checkout's fit table
node evals/quality/variability.mjs --stubs                  # open exhibits kept as the `basis` stubs a spine declares them by
node evals/quality/variability.mjs --json --allocations     # every allocation
```

It reports, a spine: how many pages have a free choice (two or more best-fit
forms, or kinds for an exhibit whose form leaves its kind open), how many are
pinned to one and how many have no fit read; the share of the exhibits in the
three commonest kinds over the seeds; and the distance between allocations -
the share of pages whose form or kinds differ, and the Jensen-Shannon distance
between the exhibit-kind distributions - between seeds and between design
systems. It exits 2 unless, on every spine:

- **(a)** some page with a free choice is allocated differently under two seeds;
- **(b)** every pinned page is allocated the same under every seed and system;
- **(c)** no page is given a form, and no open exhibit a kind, outside its best fit;
- **(d)** one seed planned twice gives one allocation;
- and every allocation meets the structure rules its page types allow.

A second table says what a reader of two decks would see, between two seeds:
of the pages that draw an exhibit, the share whose kinds differ; the share of
the exhibits in the three commonest kinds; how many of the two decks' three
commonest kinds are the same kinds (3: both are tables, lines and bars); and
how many chart pages another page type carries as directly as their own, in a
type their evidence can rest under - the variety that could enter through the
choice of type. Where the plan proposes another type for a page, the page is
counted as that proposal.

`--stubs` plans the spine as a deck's critique reads it. A spine declares the
exhibits of a page of open kinds - panels, the chart under a strip - by
`basis` stubs, and the default strips them, which lets the plan cut the
claim's measures itself and flatters it: a runtime that reads a stub by its
measure's axis plans every such exhibit as a bar or a line under every seed.

What the two readings show, on three decks written from one brief (eight
seeds, one design system):

| | spine as its critique reads it (`--stubs`) | | stripped spine | |
| --- | --- | --- | --- | --- |
| | stubs read by axis, choices by spread then seed | a deck's hand, stubs given their kind | before | after |
| exhibit pages whose kinds differ between two seeds | 4% to 8% | 14% to 17% | 20% to 25% | 16% to 20% |
| share of exhibits in the three commonest kinds | 50% to 63% | 39% to 49% | 38% to 45% | 39% to 51% |
| of two decks' three commonest kinds, the same kinds | 3.0 of 3 | 2.1 to 2.4 | 2.3 to 2.8 | 1.8 to 2.4 |
| distance between the two decks' kinds (JSD) | 0.15 | 0.23 to 0.24 | 0.18 to 0.23 | 0.24 to 0.26 |
| chart pages another type carries as directly | 0 of 49 | 1 of 49 | | |

Read with their limits. These are plans, not decks: an author can still type
every exhibit before the plan runs, and the plan then keeps the choice and
says what its draw would take. On the stripped spine the hand moves fewer
pages than the page-by-page draw it replaced and separates the two decks'
mixtures more - one deck leads with one mark where the other mixed them all.
And the ceiling is the evidence's: about four exhibits in ten are a table, a
grid of figures or a diagram the page type sets, a quarter are charts one
form carries best, and the third that are free choose between two or three
kinds, so two seeds cannot differ on much more than a fifth of the pages.

`fixtures/variety/` holds the fixed spine: a fictional rail operator whose
pages set every reading task the fit table knows (`make_fixture.py` wrote it).
A page with no fit read - a diagram, a summary - is placed by the structure
rules alone and reported where it differs between seeds, not failed.

## Tests

`evals/tests/test_quality_eval.py` runs the whole loop with
`fixtures/fake-agent.mjs` and `fixtures/fake-judge.mjs`: no model is called. It
checks blinding (the fake agent writes author files carrying a marker, and the
fake judge reports any packet file carrying it), pairing through the shuffled
order, results keying and the summary's arithmetic.
`evals/tests/test_gate_validity.py` covers the replay, and
`evals/tests/test_plan_variety.py` the variability measurement and its four
assertions.
`evals/tests/test_evidence_contract.py` runs the evidence measurement and
`evals/tests/test_diagnosis_instruments.py` the calibration, with
`fixtures/fake-critic.mjs` standing in for the critic, and
`evals/tests/test_review_repair_path.py` the deck-review repeats, with
`fixtures/fake-reviewer.mjs`.
