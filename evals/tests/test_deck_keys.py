"""The deck-level keys are published, and the compile holds `deck` to them.

`--schema` described the pages and said of `deck` only that it carried "the
deck-level keys". An author recorded which storyline template the deck followed
under a key of their own, `template`, which the runtime already read as the
path of a house profile - and learnt so from the composer ("template must name
a house profile .json"). One table (runtime/deck-keys.mjs) now lists every key
with its type and what it is for; `--schema deck` prints it, the pages file's
schema embeds it, and the compile refuses a key it does not hold, naming the
keys nearest it.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"
EXAMPLES = ROOT / "skills" / "professional-slides" / "examples"


class DeckKeyTests(unittest.TestCase):
    def test_the_schema_command_lists_every_deck_key_with_its_type(self):
        printed = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), "--schema", "deck"], capture_output=True, text=True)
        self.assertEqual(printed.returncode, 0, printed.stderr)
        schema = json.loads(printed.stdout)
        keys = schema["properties"]
        for name in ("request", "answer", "players", "assets", "design", "variation", "density", "tracker", "contents", "cover", "footer", "template", "waivers", "evidenceScope", "noPictures"):
            with self.subTest(key=name):
                self.assertIn(name, keys)
                self.assertTrue(keys[name]["description"].strip())
                self.assertTrue(keys[name]["x-takes"].strip())
                self.assertTrue(keys[name]["type"])
        self.assertFalse(schema["additionalProperties"])
        # The pages file's own schema carries the same table for `deck`, not a sentence about it.
        whole = json.loads(subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), "--schema"], capture_output=True, text=True).stdout)
        self.assertEqual(whole["properties"]["deck"]["properties"], keys)

    def test_every_key_the_worked_decks_and_the_fixtures_use_is_listed(self):
        # The table is the compile's, so a deck the repository ships cannot use a key it leaves out.
        result = run_node('''
import { deckKeyProblems, deckSchema } from './skills/professional-slides/runtime/deck-keys.mjs';
import fs from 'node:fs';
const files = [...fs.readdirSync('./evals/quality/fixtures/evidence').filter((name) => name.endsWith('.pages.json')).map((name) => './evals/quality/fixtures/evidence/' + name),
  './skills/professional-slides/examples/page-types.pages.json', './skills/professional-slides/examples/page-forms.pages.json'];
const decks = files.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')).deck);
console.log(JSON.stringify({ files: files.length, problems: decks.flatMap(deckKeyProblems), used: [...new Set(decks.flatMap(Object.keys))].filter((key) => !deckSchema().properties[key]) }));
''')
        self.assertGreaterEqual(result["files"], 6)
        self.assertEqual(result["problems"], [])
        self.assertEqual(result["used"], [])

    def test_an_unknown_key_and_a_value_of_the_wrong_kind_are_refused_with_what_is_meant(self):
        result = run_node('''
import { deckKeyProblems } from './skills/professional-slides/runtime/deck-keys.mjs';
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const base = { schema: 'professional-slides.deck/v3', id: 'd', request: 'Compare the two options for the board' };
const thrown = (deck) => { try { compileDeck({ deck: { ...base, ...deck }, pages: [] }, { partial: true }); return null; } catch (error) { return error.message; } };
console.log(JSON.stringify({ clean: deckKeyProblems({ ...base, design: 'consulting', players: ['A', 'B'], tracker: false, contents: 'once', $note: 'a comment the author keeps' }),
  typo: deckKeyProblems({ ...base, targetpages: 20, audiance: 'the board' }), unknown: deckKeyProblems({ ...base, storylineTemplate: 'competitive-position' }),
  template: deckKeyProblems({ ...base, template: 'competitive-position' }), house: deckKeyProblems({ ...base, template: 'house.json' }),
  kind: deckKeyProblems({ ...base, players: 'A, B', cover: 'Title' }), compile: thrown({ template: 'competitive-position', sectons: 3 }), passes: thrown({ brief: 'Follows the competitive-position template' }) }));
''')
        self.assertEqual(result["clean"], [])
        self.assertEqual(len(result["typo"]), 2)
        self.assertIn("did you mean `targetPages`", result["typo"][0])
        self.assertIn("did you mean `audience`", result["typo"][1])
        self.assertIn("--schema deck", result["typo"][0])
        self.assertEqual(len(result["unknown"]), 1)
        self.assertIn("`storylineTemplate` is not a deck-level key", result["unknown"][0])
        # The key the run collided with: said at the compile, with where the author's own note goes.
        self.assertEqual(len(result["template"]), 1)
        self.assertIn("house profile `.json`", result["template"][0])
        self.assertIn("use `brief`", result["template"][0])
        self.assertEqual(result["house"], [])
        self.assertEqual(len(result["kind"]), 2)
        self.assertIn("it was given a string", result["kind"][0])
        # One compile message carries every problem.
        self.assertIn("The deck-level keys of `deck` are not valid", result["compile"])
        self.assertIn("`template` on `deck`", result["compile"])
        self.assertIn("`sectons` is not a deck-level key", result["compile"])
        self.assertIsNone(result["passes"])

    def test_the_compile_refuses_an_unknown_deck_key_in_one_line_each(self):
        tmp = Path(tempfile.mkdtemp(prefix="deck-keys-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        for name in ("finance.insights.json", "finance.analysis.json"):
            shutil.copy(FIXTURES / name, tmp / name)
        doc = json.loads((FIXTURES / "finance.pages.json").read_text())
        doc["deck"]["template"] = "decision-architecture"
        (tmp / "finance.pages.json").write_text(json.dumps(doc))
        run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(tmp / "finance.pages.json"), "--draft"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 2)
        self.assertIn("`template` on `deck` names a house profile `.json`", run.stderr)
        self.assertNotIn("    at ", run.stderr)   # a refusal, not a stack


if __name__ == "__main__":
    unittest.main()
