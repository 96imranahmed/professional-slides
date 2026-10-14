"""A cards page's family by what its cards print, and trial pages that ask a reader nothing."""
from __future__ import annotations

import unittest

import json
import tempfile

from node_probe import example_scene_file, run_node

JUDGE = "import { judgementSession, withJudgements } from './skills/professional-slides/runtime/judgements.mjs';\n"


class CardFamilyTests(unittest.TestCase):
    def test_cards_that_print_no_figure_count_as_text(self):
        result = run_node("""
import { pageFamily } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const page = (items, tone) => ({ id: 'p', exhibit: { type: 'cards', ...(tone ? { tone } : {}), items } });
console.log(JSON.stringify([pageFamily(page([{ title: 'A', text: 'x' }, { title: 'B', text: 'y' }], 'header')),
  pageFamily(page([{ title: 'A', value: '12%' }, { title: 'B', value: '9%' }])), pageFamily(page([{ title: 'A', value: '12%' }, { title: 'B', value: '9%' }], 'stat'))]));
""")
        self.assertEqual(result, ["text", "numbers", "numbers"])


class TrialPagesTests(unittest.TestCase):
    def test_a_trial_page_reads_the_answers_and_asks_nothing(self):
        """A search's trial pages - a layout weighed, a page padded with placeholder words to measure its fill - were gated
        like the deck's own, and their garbled copy went to a reader as questions. They read the recorded answers and ask
        nothing; the deck's own pages ask."""
        with tempfile.TemporaryDirectory() as tmp:
            scene = example_scene_file(tmp, "nyc-or-sf")
            result = run_node(JUDGE + f"""
import fs from 'node:fs';
import {{ sceneGateFindings }} from './skills/professional-slides/runtime/author-deck.mjs';
const deck = JSON.parse(fs.readFileSync({json.dumps(str(scene))}, 'utf8'));
const asked = (ask) => {{ const session = judgementSession(); withJudgements(session, () => sceneGateFindings(deck, process.env.RUNTIME_PYTHON || 'python3', {{}}, {{ ask }})); return session.pending.size; }};
console.log(JSON.stringify({{ deck: asked(true), trial: asked(false) }}));
""")
        self.assertGreater(result["deck"], 0)
        self.assertEqual(result["trial"], 0)


if __name__ == "__main__":
    unittest.main()
