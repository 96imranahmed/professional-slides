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
   `runs/<skill>/<brief>/<agent>-<prompt>-<judge>-run<n>/` (git-ignored), a
   directory each run creates for itself: where one of that name is already
   there - a killed run's, or a run recorded in another results file sharing
   the store - the run takes the first free `.2`, `.3` beside it rather than
   writing into another run's deck. The
   authoring files are the scored deck's own - its id, in its spec's
   directory - never the newest file on disk, which may be another attempt's;
   one that cannot be told to be that deck's is not guessed but recorded in
   the result row's `deck.missing` with the reason. Review and storyline histories (`.reviews/`) are never
   collected. A run that leaves no rendered deck is recorded as `no-deck` or
   `agent-failed`; that is a result, not a gap. Delivery ends with a
   confirmation read of the accepted deck; a run that stops before it (a review
   or confirmation packet waiting) is still judged, and recorded as not
   delivered with its `deliveryStage`.
3. **Score.** The scorer (`score.mjs`, below) runs the build bars on the
   scene and the plan gates on the plan.
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
   model, agent, prompt, brief and run; new runs continue the run count.
   Before its agent runs, a run claims its key: a file created exclusively
   under `results.jsonl.claims/` (git-ignored), which only one runner can
   create, and let go once the row is appended. Reading the results and then
   writing could not do this - two runners can both read before either
   writes. A key another runner holds or has recorded is passed over for the
   next number, so runners can share a results file and a store side by side:
   each gets the runs it asked for, numbered apart, and nothing is paid for
   twice or doubled. A runner killed mid-run cannot let go of its claim; the
   claim names its process and host, later runs number past it, and it can be
   deleted once that runner is known to be gone.

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

## Scoring a run

`score.mjs` scores the plan an agent wrote and the deck it built. The runner
calls it on every deck it collects; it scores a run made by hand the same way:

```bash
node evals/quality/score.mjs out/deck.plan.json out/          # plan and build
node evals/quality/score.mjs out/deck.plan.json               # plan alone
node evals/quality/score.mjs - out/                           # build alone
node evals/quality/score.mjs out/deck.plan.json out/ --json
```

Exit 0 when the run clears every bar, 2 when it does not. It scores two things
and refuses to average them:

- **The plan** - the dot-dash, through `plan_gates.mjs`: what the deck was
  going to be before anything was drawn.
- **The build** - a built output directory, through the build bars in
  `runtime/build-bars.mjs` (`designStatistics` and `scoreBuild`, re-exported by
  `score.mjs`) read off `scene.json`: the bars delivery refuses a deck under,
  applied from 12 analytical pages, with the empty-frame ceiling on every deck.
  A catalogue (`purpose: "catalogue"`) is held to the ceilings only.

They disagree more often than you would expect, and the disagreement is the
finding: a Marvel plan recorded nine architectures and 0.888 entropy and
produced a deck carrying 2.9 distinct exhibits per ten pages, no table
treatment and no chart annotation. A plan can only be judged on what it
records, so the build is the check on the plan and the plan the check on the
brief; one combined number would hide which was wrong.

Where the author's run log is beside the plan or the build directory
(`<id>.author-log.jsonl`, which `author-deck.mjs` appends to on every run), the
report also carries what the run cost - `cost`: compile runs and refused runs
by mode (draft, check, full), runs a page, refusals by code and by page, and
the longest streak of refused runs on one page. The numbers are counted from
the log (`runtime/run-log.mjs`), never estimated, and reported, never scored:
a run that kept no log has no `cost`, and a deck is not accepted for being cheap.

The numbers do not replace looking: read the report, then look at the rendered
pages, because the beautification pass in `references/design.md` catches what
they cannot.

## Briefs

- **dev** - `briefs/dev/`. Look at these runs, find what failed, fix the skill.
  Each is aimed at a different failure:

  | Brief | What it is there to catch |
  | --- | --- |
  | `marvel-vs-dc.md` | The craft gap. An ordinary comparison that passed every gate and still read as dry. |
  | `london-vs-new-york.md` | Geography drawn as paragraphs beside a stock photograph instead of as an annotated map. |
  | `network-rollout.md` | The long scorecard: a twelve-row table on a four-point scale, which the skill can draw and almost never does. |

- **heldout** - `briefs/heldout/`. Never used to tune the skill: nobody reads a
  held-out run to decide what to change. They say whether fixes made against
  the dev briefs generalise. See `briefs/heldout/README.md` for what to do when
  one is spent.

## Commands and placeholders

`config.json` holds argv templates. Agent: `{prompt}`, `{workspace}`,
`{plugin}`. Judge: `{prompt}`, `{packet}`, `{schema}` (the JSON schema the
answer must match: `judge-schema.json` or `pairwise-schema.json`), `{model}`. The `claude` entries were checked
against `claude --help`. The `codex` agent entry is marked `unverified`: its
flags were written without the CLI installed, and Codex loads plugins from its
marketplace rather than from `{plugin}`, so install the package first. The
runner prints the `unverified` note whenever that entry is used.

The prompt defaults to the brief alone (`prompts.brief`). A headless run cannot
answer the design intake or approve a dot-dash; if runs stop to ask, that is a
finding about the skill. `--prompt unattended` adds one line telling the agent
nobody will answer - it changes the run, so it is part of what a result row
records and pairwise only compares like with like.

## Evidence validity

`fixtures/evidence/` holds four fixture decks on different subjects - a credit
union with eight declared players, an ambulance service under a closed evidence
scope, a note-taking app against two rivals, and an explanation that compares
nothing - each a pages file, an insight log with measures and an analysis
plan. Most exhibits type their values beside a
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

A critic that catches every planted defect and also sends clean decks back is
not calibrated: it tells nothing apart. `critic-calibration.mjs` measures the
storyline critic on packets that do not change:

```bash
node evals/quality/critic-calibration.mjs --list                # the anchors, and what each plants
node evals/quality/critic-calibration.mjs --repeats 3 --dry-run
node evals/quality/critic-calibration.mjs --repeats 3 --parallel 4 --raw <dir>        # every answer kept as returned
node evals/quality/critic-calibration.mjs --from-raw <dir>                            # score the kept answers again; nothing is called
node evals/quality/critic-calibration.mjs --freeze <dir> --anchors finance,product     # the packets alone, for critics run elsewhere
node evals/quality/critic-calibration.mjs --repeats 3 --anchor-dir ~/decks/anchors    # your own decks, with the verdict you expect
node evals/quality/critic-calibration.mjs --repeats 3 --review-packet <staged packet> # a deck-review packet, repeated
```

Every answer is read as the storyline loop reads it (`judgeCritique` in
`runtime/storyline.mjs`): page lists settled, a blocking item with no
`ifUnfixed` recorded as minor, validated against its packet, and its verdict
read off its items. An answer the loop would refuse is counted under `form`
and not judged.

- **Repeats.** Each frozen packet is answered `--repeats` times by a fresh
  critic. The median spread of the ratings is the noise floor.
- **Plants, found at their place.** The four fixture decks clean, and each
  with one defect of argument planted: an answer that declines the request,
  the players' comparison cut, a chart about something else kept as context
  on one page, a page that restates its neighbour. Each plant names where it
  goes and how to tell it was found there (`PLANTED[name].at` and
  `.caught`): an answer part declined, a blocking item that opens on the
  comparison (a comparison word or a declared rival in its first two
  sentences - an item that sizes a gap and mentions a peer later is not it),
  a blocking item on the target page, a cut or restatement item on the
  repeated page. The repeated page is a cut - minor on the scale - so its
  deck need not be sent back; the other three are blocking. A plant that
  would move nothing is not run: the chart-as-context plant needs a deck
  with two typed charts, so it is not planted on one that has a single
  chart.
- **The same test on the clean twin.** What the test finds at the plant's
  place on the clean deck is a false alarm. A pair is told apart when the
  plant is found in two answers in three or more, the false alarm comes in
  one in three or fewer, and a blocking plant's deck is sent back.
- **Clean decks passed.** Each clean fixture and the full-size worked
  example (`showcase`, about fifty pages) must be passed by two answers in
  three or more. This is the failure the measure exists for.
- **Your decks.** `--anchor-dir` takes folders holding a deck and an
  `anchor.json` - `{ "deck": "<id>.pages.json", "expect": "ready" | "revise",
  "about": "..." }`, with an optional `rating` a person gave it - and holds
  the critic to the verdict you expect.

Calibrated means every pair told apart, every clean deck passed and every
expected verdict given. Whether a planted deck is also rated below its twin
is reported and decides nothing. A run costs `anchors x repeats` critic calls
and is written to `runs/critic-calibration/`.

### Critics this harness cannot call

Where the judge command cannot run - a CLI that is not logged in on the machine, or critics that are subagents of the session running the calibration - `--freeze <dir>` writes each anchor's prompt, packet and schema under the names `--raw` keeps, and calls nothing. Give each prompt to a fresh critic with no other context, save answer *n* beside it as `<anchor>.run<n>.stdout.json` (the answer object, or `{"structured_output": answer}`), and score them with `--from-raw <dir>`. The scoring is the same; only who answered differs, and the result says it was scored from kept answers.

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
pages set every reading task the fit table knows.
A page with no fit read - a diagram, a summary - is placed by the structure
rules alone and reported where it differs between seeds, not failed.

## Tests

`evals/tests/test_quality_eval.py` runs the whole loop with
`fixtures/fake-agent.mjs` and `fixtures/fake-judge.mjs`: no model is called. It
checks blinding (the fake agent writes author files carrying a marker, and the
fake judge reports any packet file carrying it), pairing through the shuffled
order, results keying, two runners started together on one results file and
store, and the summary's arithmetic.
`evals/tests/test_quality_score.py` covers the scorer, and
`evals/tests/test_plan_variety.py` the variability measurement and its four
assertions.
`evals/tests/test_evidence_contract.py` runs the evidence measurement and
`evals/tests/test_diagnosis_instruments.py` the calibration, with
`fixtures/fake-critic.mjs` standing in for the critic, and
`evals/tests/test_review_repair_path.py` the deck-review repeats, with
`fixtures/fake-reviewer.mjs`.
