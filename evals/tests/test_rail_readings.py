"""Two rules read a rail, each for what it measures, and each says so.

`VARIETY_COLUMN` reads how a page is drawn: a rail is a column beside the
exhibit, as points beside it are, and counts toward the cap. `PAGE_SHAPE_FLAT`
reads what a page argues with: a rail is one claim - a close, like a so-what
bar - and leaves the page evidence-only, where points make it
evidence-with-commentary. The difference is intended, so moving points into a
rail keeps a page under the first rule and changes it under the second; it was
said nowhere, and an author met it as a surprise. Both standings lines now say
which reading they take, in one sentence the two runtimes share, and the page
types reference says it beside the rule.
"""
from __future__ import annotations

import sys
import unittest

from node_probe import RUNTIME, run_node

sys.path.insert(0, str(RUNTIME / "gates"))
import gate_config  # noqa: E402


class RailReadingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_node('''
import fs from 'node:fs';
import { authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
import { declaredArchitecture, shapeStructure } from './skills/professional-slides/runtime/deck-structure.mjs';
import { standingLine } from './skills/professional-slides/runtime/gates/gate_classes.mjs';
const dir = 'skills/professional-slides/examples';
const doc = JSON.parse(fs.readFileSync(`${dir}/page-types.pages.json`, 'utf8'));
const run = await authorDeck(doc, { baseDir: dir });
const pick = (code, key) => run.standings.find((st) => st.code === code && (key === undefined || st.key === key));
const typed = run.spec.slides.filter((slide) => slide.pageType);
// The same line before a deck composes: the structure read off the declared choices.
const declared = shapeStructure(typed.map((slide) => ({ id: slide.id, architecture: declaredArchitecture(slide) })), {}).standings.find((st) => st.key === 'share');
console.log(JSON.stringify({ blocking: run.blocking.length, column: { pages: pick('VARIETY_COLUMN').pages, note: pick('VARIETY_COLUMN').note, line: standingLine(pick('VARIETY_COLUMN')) },
  flat: { note: pick('PAGE_SHAPE_FLAT', 'share').note, line: standingLine(pick('PAGE_SHAPE_FLAT', 'share')) }, declared: declared.note,
  pages: typed.filter((slide) => slide.pageType.type !== 'numbers').map((slide) => [slide.id, slide.pageType.commentary, declaredArchitecture(slide)]) }));
''')

    def test_a_rail_is_a_column_under_one_rule_and_a_close_under_the_other(self):
        rails = [(pid, arch) for pid, placement, arch in self.result["pages"] if placement == "rail"]
        beside = [(pid, arch) for pid, placement, arch in self.result["pages"] if placement == "beside" and arch and arch.startswith("evidence")]
        self.assertTrue(rails and beside)
        for pid, arch in rails:
            self.assertIn(pid, self.result["column"]["pages"])      # drawn as a column beside the exhibit
            self.assertEqual(arch, "evidence-only")                # argued with one claim
        for pid, arch in beside:
            self.assertIn(pid, self.result["column"]["pages"])
            self.assertEqual(arch, "evidence-with-commentary")

    def test_each_standing_line_says_which_reading_it_takes(self):
        self.assertEqual(self.result["blocking"], 0)
        self.assertIn("a rail counts here", self.result["column"]["note"])
        self.assertTrue(self.result["column"]["line"].endswith(f"[{self.result['column']['note']}]"))
        self.assertIn("a rail, a so-what bar and a takeaway are one claim each and leave a page evidence-only", self.result["flat"]["note"])
        self.assertTrue(self.result["flat"]["line"].endswith(f"[{self.result['flat']['note']}]"))

    def test_the_two_runtimes_say_it_in_one_sentence(self):
        # The page gates print the line of a composed deck, the structure reading the line of a spine: one rule, one sentence.
        self.assertEqual(self.result["declared"], gate_config.RAIL_AS_CLOSE)
        self.assertEqual(self.result["flat"]["note"], gate_config.RAIL_AS_CLOSE)


if __name__ == "__main__":
    unittest.main()
