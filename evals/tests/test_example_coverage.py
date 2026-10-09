"""Every registered exhibit appears on a page somewhere.

The registry had grown 89 components and 26 chart types while the example decks
exercised a subset of them; five components and six chart types had no page in
any deck, so nothing but a unit test ever composed, measured, emitted and gated
them. The gallery deck is the coverage, and this test is what keeps it honest:
a new component with no page in an example deck fails here.

The same held a level up. A component is registered; a *device* is a word an
author writes - a `pointsStyle`, a treated column, a page shape. Four commits
added seven point styles, three column treatments and four page shapes, and
none of them appeared on any example page. So every device an author would
reach for is drawn on a real page.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from node_probe import authored_example, run_node

ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / "skills" / "professional-slides"
EXAMPLES = SKILL / "examples"


def example_decks():
    """Every example deck spec: those shipped as specs, and the worked example authored from its pages file."""
    return sorted(EXAMPLES.glob("*.deck.json")) + [authored_example("page-types") / "page-types.deck.json"]


# Components the composer places itself - page furniture, not exhibits an
# author reaches for. Each is covered by the chrome and section tests instead.
FURNITURE = {
    "slide-chrome", "section", "section-heading", "section-title", "section-divider",
    "section-boundary", "page-number", "page-template", "footnote", "connector",
    "content-rail", "tracker-page", "tracker-label", "action-title", "chart-title",
    "chart-callout", "chart-group", "legend", "bullet-list", "paragraph", "metric",
    "insight", "panel", "image-frame", "cover", "divider", "statement", "takeaways",
    "agenda", "callout", "table", "rows", "evidence-note", "insight-tree-table",
    "comparison-table", "logo-collage", "icon-trends", "quote-cluster",
    # The panel of a `layout: "sidebar"` page, placed from `panel`; the gallery's
    # sidebar page exercises it.
    "side-statement",
}


def deck_text():
    return "\n".join(path.read_text(encoding="utf-8") for path in example_decks())


def decks_js():
    """The probe's preamble: `decks`, each deck's file and the directory its assets resolve from."""
    return f"const decks = {json.dumps([[str(path), str(path.parent)] for path in example_decks()])};\n"


class ExampleCoverageTests(unittest.TestCase):
    def test_every_exhibit_component_has_a_page(self):
        registered = run_node('''
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry=createRegistry();
console.log(JSON.stringify({ids:[...registry.keys()].sort()}));
''')["ids"]
        decks = deck_text()
        missing = [component for component in registered
                   if component not in FURNITURE and f'"{component}"' not in decks]
        self.assertFalse(missing, "no example deck exercises: " + ", ".join(missing))

    def test_every_chart_type_has_a_page(self):
        registered = run_node('''
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry=createRegistry();
console.log(JSON.stringify({ids:[...registry.keys()].filter((k)=>k.startsWith('chart.')).sort()}));
''')["ids"]
        decks = deck_text()
        missing = [chart for chart in registered if f'"{chart}"' not in decks]
        self.assertFalse(missing, "no example deck plots: " + ", ".join(missing))
        self.assertGreaterEqual(len(registered), 26)

    def test_every_example_deck_composes(self):
        # Composition only - the render is the slow suite's job - but a deck
        # that no longer plans is a deck nobody would notice was broken.
        names = sorted(path.name for path in example_decks())
        self.assertTrue(names)
        result = run_node('''
import {readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {toDeckPlan} from './evals/support/compose.mjs';
''' + decks_js() + '''
const out={};
for(const [file, dir] of decks){
  const plan=toDeckPlan(JSON.parse(readFileSync(file,'utf8')),dir);
  out[basename(file)]=plan.slides.length;
}
console.log(JSON.stringify({decks:out}));
''')
        self.assertEqual(sorted(result["decks"]), names)
        for name, pages in result["decks"].items():
            self.assertGreater(pages, 0, name)



class DeviceCoverageTests(unittest.TestCase):
    """The authoring devices are drawn on real pages, not only in unit tests.

    A unit test composes one slide in isolation. It does not emit it, render it
    through LibreOffice, read it back or gate it - which is where a device that
    works in principle turns out to overlap its neighbour or fall under a
    density floor. Each of these is one page in an example deck.
    """

    def decks(self):
        return {path.name: path.read_text(encoding="utf-8") for path in example_decks()}

    def assertOnSomePage(self, needle, what):
        hit = [name for name, text in self.decks().items() if needle in text]
        self.assertTrue(hit, f"no example deck carries {what} ({needle})")

    def test_the_commentary_column_styles_are_drawn(self):
        styles = run_node('''
import {POINT_STYLE_NAMES} from './evals/support/compose.mjs';
console.log(JSON.stringify({styles:[...POINT_STYLE_NAMES]}));
''')["styles"]
        decks = self.decks()
        missing = [style for style in styles
                   if not any(f'"pointsStyle": "{style}"' in text or f'"pointsStyle":"{style}"' in text
                              for text in decks.values())]
        self.assertFalse(missing, "no example page sets pointsStyle to: " + ", ".join(missing))

    def test_the_table_column_treatments_are_drawn(self):
        # implication reorganises the table; heat, bubble and bar treat a column.
        self.assertOnSomePage('"implication": true', "an implication column")
        self.assertOnSomePage('"heat": true', "a heat-treated column")
        self.assertOnSomePage('"bubble": true', "a bubble-treated column")
        self.assertOnSomePage('"bar": true', "an in-cell bar column")

    def test_both_implication_styles_are_drawn(self):
        # per-row and single place the chevrons differently enough that one
        # working says nothing about the other.
        self.assertOnSomePage('"implicationStyle": "per-row"', "a per-row implication gutter")
        self.assertOnSomePage('"implicationStyle": "single"', "a single implication chevron")

    def test_the_speech_callout_is_drawn(self):
        self.assertOnSomePage('"treatment": "speech"', "a speech-bubble chart annotation")

    def test_the_picture_led_pages_are_drawn(self):
        # The plan gate can tell a page to depict the things it names; these are
        # where it sends one. A shape that only exists in a unit test is a shape
        # no gate has seen emitted, rendered, read back and measured.
        self.assertOnSomePage('"pictures"', "a picture-led page")

    def test_the_halved_table_is_drawn(self):
        # The composer reaches this one by rotation, which no single deck can
        # guarantee, so a page asks for it by name.
        self.assertOnSomePage('"layout": "table-halves"', "a halved ranking table")


class ExampleBuildTests(unittest.TestCase):
    """Every example deck composes AND renders its scene.

    `test_every_example_deck_composes` stops at the plan. A page can plan
    cleanly and then fail to draw - a scatter whose labels have nowhere to go in
    a shorter frame - and a build loop that reads a report file left over from a
    previous run will not notice. This walks the whole compile.
    """

    def test_every_example_deck_compiles_to_a_scene(self):
        result = run_node('''
import {readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {toDeckPlan} from './evals/support/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
''' + decks_js() + '''
const out={};
for (const [file, dir] of decks) {
  // The same two calls the builder makes before it emits: planDeck compiles
  // every page's components, which is where a page that plans but cannot draw
  // actually fails.
  const {deck}=planDeck(toDeckPlan(JSON.parse(readFileSync(file,'utf8')),dir));
  out[basename(file)]=deck.slides.length;
}
console.log(JSON.stringify({decks:out}));
''')
        self.assertEqual(sorted(result["decks"]), sorted(path.name for path in example_decks()))
        for name, pages in result["decks"].items():
            self.assertGreater(pages, 0, name)


class StaleReportTests(unittest.TestCase):
    """A failed build leaves no report behind for the next reader to trust.

    `buildDeck` writes its reports as it goes, so a deck that throws while
    composing writes none at all - and every report in the output directory is
    then whatever the *previous* build left there. A loop that builds and then
    reads `gates.json` sees that deck's pass and reports the broken deck clean.
    That is not hypothetical: it is how a broken example deck survived four
    commits here. The build now clears its own outputs before it starts.
    """

    def test_a_build_that_throws_takes_the_previous_report_with_it(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildDeck, BUILD_REPORTS} from './skills/professional-slides/runtime/build-deck.mjs';

const dir = await mkdtemp(join(tmpdir(), 'stale-'));
// What a previous, passing build left on disk.
for (const name of BUILD_REPORTS) await writeFile(join(dir, name), '{"accepted":true,"findings":[]}');

// A deck that cannot compose: `subtitile` is not a slide key.
const spec = join(dir, 'broken.deck.json');
await writeFile(spec, JSON.stringify({schema:'professional-slides.deck/v3', id:'broken', slides:[
  {id:'s01', title:'A page', subtitile:'typo', points:['one','two']},
]}));

await assert.rejects(buildDeck(spec, dir, {preflight:true, render:false}), /unknown slide key/);
const left = (await readdir(dir)).filter((n) => BUILD_REPORTS.includes(n));
assert.deepEqual(left, [], `the failed build left ${left.join(', ')} behind`);
console.log(JSON.stringify({cleared:BUILD_REPORTS.length}));
''')
        self.assertGreaterEqual(result["cleared"], 6)


if __name__ == "__main__":
    unittest.main()
