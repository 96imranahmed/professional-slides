# evals

Verification for `skills/professional-slides` covers the pages file's contract,
binding, composition, export, readback and rendered geometry.
Passing these checks does not establish editorial or visual taste. The pipeline
the skill itself runs is [SKILL.md](../skills/professional-slides/SKILL.md#the-process);
none of it is repeated here.

## Point changes

`point-change/` is the skill's second workflow as a command: a change to one
page of a deck the user already has - a figure that stands on three slides, a
title, an exhibit redrawn - run the way `SKILL.md` tells an author to run it,
on decks made on the spot. It checks that the change was made, that every
other slide came out byte for byte as it went in, that a figure left behind
on another slide was caught, and that nothing but the changed pages was
refused; and it counts the commands the run took. See
`point-change/README.md`.

```bash
node evals/point-change/run.mjs [--task <id>] [--agent claude]
```

## Gallery layout regression

`regression/site-gallery/` is every slide of the published gallery
(shiphappens.xyz/slides, named in `published.json`) rebuilt as a typed page
(`pages/*.json`), with the approved frame of every component on every page
(`layout.json`) and the commit that approval was recorded at
(`layout.meta.json`). `test_site_gallery.py` fails when a page no longer
composes or a component has moved more than a pixel. A move is approved from a
look, not from the numbers:

```bash
node evals/scripts/site_gallery.mjs                  # which pages moved (exit 1 on any)
node evals/scripts/site_gallery.mjs --sheet [OUT]    # draw them: before | after | published
node evals/scripts/site_gallery.mjs --approve        # record the layout as it is now
```

`--sheet` writes, to `OUT` (default `output/site-gallery/review/`, ignored by
git), one sheet a moved page and an `index.png` of them all (`index-2.png`...
past forty), with `review.json` holding the same in words. Each sheet shows the
page as approved, as the runtime draws it now and, where the published image is
on this machine (`output/site-gallery/reference-png/<type>__<form>.png`, kept
out of the repository), that image; the moved components are outlined in pink
and numbered, and under the pages every moved frame is listed with its delta
(`#4 section 844,204 376x428 -> 848,168 372x500 (x +4, y -36, w -4, h +72)`).

"Before" is the approved layout's own scene: the script checks the commit the
baseline came from out into a temporary `git worktree`, compiles the gallery
with that commit's runtime and pages, and removes the worktree. It tries the
commit `layout.meta.json` names when the tree was clean at approval, then the
last commit of `layout.json` (an approval made over uncommitted runtime work is
committed with it), and uses the first whose frames match the approved ones;
`review.json` says which (`before.commit`, `before.reproduces`), and a panel
that does not match says so in its caption.

`--approve` is refused while pages have moved and no sheet of exactly these
moves has been written (the sheet's fingerprint of the moved pages' approved and
current frames is kept in `output/site-gallery/last-sheet.json`); it prints the
sheet it was approved from. `--approve --force` records without one. Rendering
needs Playwright's Chromium and Pillow (`RUNTIME_NODE_MODULES`,
`RUNTIME_PYTHON`).

## Support code

`support/` holds the code only the suite runs, kept out of the shipped runtime
so the plugin carries nothing a deck does not use: the composer's entry point
the tests import (`compose.mjs`, re-exporting `runtime/compose-*.mjs`), the
component fixtures, the HTML adapter and the browser overlap audit with its
layering policy.

## Commands

Iterate on the modules a change touches, `--pattern "test_<module>.py"`, or on
the fast tier, `--fast` (about a third of the full suite's wall time): every
test except the property sweeps and end-to-end authoring classes listed, each
with its reason, in `heavy-tests.json`. Run the full suite, with no flag, once
before a commit or push. One run holds the machine at a time: a second run
waits for the first, saying so, since two run together each take twice as long;
a lock left by a run that was killed is taken over.

```bash
# everything: unit tests, the example decks' content stage and the source checks
evals/run.sh

# plus the LibreOffice end-to-end render (test_end_to_end_render.py, ~5 s)
evals/run.sh --slow

# unit tests only: parallel, with a dependency preflight and a skip report.
# --jobs N workers (default: CPUs, at most 8); --serial one worker; --strict fails
# on a test skipped for a missing dependency; --slow adds the opt-in LibreOffice
# end-to-end tests (PS_RUN_SLOW=1); --fast leaves out the heavy classes
# evals/heavy-tests.json lists; --pattern GLOB picks modules; --verbose
node evals/scripts/run_tests.mjs [--jobs N] [--serial] [--strict] [--slow] [--fast] [--pattern GLOB] [--verbose]
python3 -m unittest discover -s evals/tests -p 'test_*.py'

# source checks (npm run check:syntax): syntax, the embedded probes, and dead
# exports - an export no runtime module, eval script, test probe or code example
# in the docs imports; it fails on any, unless evals/scripts/dead_exports.mjs
# names it in PUBLIC_API with the reason it is kept
node evals/scripts/check_source_quality.mjs
node evals/scripts/dead_exports.mjs

# deterministic page gates on any scene + render
python3 skills/professional-slides/runtime/gates/page_gates.py \
    scene.json [render_dir/] [--report out.json] \
    [--profile executive|pre-read|live-pitch|appendix] [--only CODE,CODE]

# compile a spec into a scene the gates and the emitter can read
node evals/scripts/compile_scene.mjs spec.json scene.json

# rebuild a gate-readable scene from a .pptx built by an older pipeline
python3 evals/scripts/pptx_scene_probe.py deck.pptx scene.json
```

## Page gates

`runtime/gates/page_gates.py` measures the resolved scene and, where the
question is optical, the rendered PNG. Exit 0 pass, 2 findings. Every finding is
`{slide, code, measured, threshold, repair}`.

The codes the gates raise, grouped by what they catch, are listed in the [runtime guide](../skills/professional-slides/runtime/README.md#what-is-checked); each generated report carries the thresholds actually used, and [gate_config.py](../skills/professional-slides/runtime/gates/gate_config.py) owns them.

Install Node test dependencies with `npm ci`, then install the browser used by
rendered overlap tests with `npx playwright install chromium`. Use Node 20.9+
and set `RUNTIME_PYTHON` when the Python dependencies live outside the default
interpreter. `RUNTIME_NODE_MODULES` defaults to this checkout's `node_modules`.
