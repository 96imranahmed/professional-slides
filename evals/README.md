# evals

Verification for `skills/professional-slides`. The rule this directory now
follows, after the deep audit: **a test either measures the page or exercises
real geometry.** Assertions about markdown prose, prompt substrings, repository
ownership and the shape of the system's own JSON were deleted — they compared
the system to itself and could never fail on a quality regression.

## Commands

```bash
# everything: unit tests, page-gate numbers for the fixture deck, golden check
evals/run.sh

# plus the LibreOffice end-to-end render (~10 s, skipped without soffice)
evals/run.sh --slow

# unit tests only
python3 -m unittest discover -s evals/tests -p 'test_*.py'
node evals/scripts/run_tests.mjs

# release gate: reference-image comparison (item 17)
node evals/scripts/run_tests.mjs --release
python3 evals/scripts/golden_reference.py check <render-dir> [--report out.json]
python3 evals/scripts/golden_reference.py accept <render-dir> [--only id,id]

# deterministic page gates on any scene + render (item 11)
python3 skills/professional-slides/runtime/gates/page_gates.py \
    scene.json render_dir/ [--report out.json] \
    [--profile executive|pre-read|live-pitch] [--only CODE,CODE]

# compile a spec into a scene the gates and the emitter can read
node evals/scripts/compile_scene.mjs spec.json scene.json

# rebuild a gate-readable scene from a .pptx built by an older pipeline
python3 evals/scripts/pptx_scene_probe.py deck.pptx scene.json
```

### package.json needs one edit (outside this directory's ownership)

`evals/scripts/check_production_policy.mjs` — the prose-grep gate — has been
deleted. Remove its script entry and its use in `check`:

```diff
-    "check": "npm run check:syntax && npm run check:policy && npm test",
+    "check": "npm run check:syntax && npm test",
-    "check:policy": "node evals/scripts/check_production_policy.mjs",
+    "check:gates": "bash evals/run.sh",
```

`npm run check:release` already routes to the new reference-image golden check
through `run_tests.mjs --release`; no change needed there.

## Page gates

`runtime/gates/page_gates.py` measures the resolved scene and, where the
question is optical, the rendered PNG. Exit 0 pass, 2 findings. Every finding is
`{slide, code, measured, threshold, repair}`.

| code | measured | threshold |
| --- | --- | --- |
| `INK_COVERAGE` | ink (luminance < 235) above the footer band, over the 1280×720 canvas | ≥ 0.12 |
| `DEAD_BAND` | gap between the last content ink row and the footer band | ≤ 8% of 720 |
| `TITLE_LINES` / `TITLE_WORDS` | laid-out lines / words of the action title | ≤ 2 / ≤ 14 |
| `TYPE_RANGE` | `node.style.fontSize.value` by role | body 10–14, chart furniture 8–11, action title 20–26, source 7–9 pt |
| `CPL` | longest laid-out line of a prose node | 35–90 characters (the floor applies only to a wrapped paragraph) |
| `WORDS` | visible body words, excluding source, page number, notes and chart furniture | ≤ 100 with an exhibit, ≤ 140 without (executive profile) |
| `HERO_EXHIBIT` | largest chart/table/image frame ÷ content frame | ≥ 0.40 |
| `LAYOUT_MONOTONY` | share of content slides sharing one layout signature | ≤ 0.40 |
| `NICE_TICKS` | the axis as a whole: step on the 1/2/2.5/5 ladder, every tick a whole step | — |
| `HEDGED_TITLE` | hedge lexicon hit in the action title | none |
| `ENDS_ON_CAVEAT` | the last sentence of the last paragraph is a caveat or an instruction | none |

The cover slide is exempt from the page-level gates. Density profiles move only
the word budget (`live-pitch` 70/100, `executive` 100/140, `pre-read` 130/180);
nothing relaxes a geometric or typographic threshold.

## Fixtures

* `evals/fixtures/scene-nyc.json.gz` — the resolved 21-slide NYC/SF scene the
  audit was written about (embedded photographs downscaled so the fixture stays
  under 250 KB). Loaded by `page_gates.load_scene`, which transparently gunzips.
* `evals/golden/reference/slide-{2,5,6,15}.png` — four accepted 1280×720 pages.
  They are both the golden references and the render fixture for the ink gates:
  one deck, one copy in the repository.

## Golden set

`golden_reference.py` compares a candidate render to the accepted PNG at full
1280×720 on two numbers, both of which must pass:

* mean absolute channel difference ≤ 0.02
* foreground mismatch ratio ≤ 0.12, over pixels that are ink in either image

A source-hash change does not fail. A pixel regression does. `--accept` (or the
`accept` action) updates the references.
