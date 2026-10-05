"""A pages file assembled from parts, so sections can be written at once.

Fifty pages written serially is the largest block of wall time in a run, and
several workers cannot edit one JSON file. A pages file may name part files -
`{ "include": "pages/economics.pages.json" }` in `pages` or `appendix` - whose
pages are spliced in at that place. These tests hold what makes that safe: the
deck assembled from parts is the deck the single file compiles to, an id is
written once across the parts, and a finding names the part to edit.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, run_node

SKILL = ROOT / "skills" / "professional-slides"
RUNTIME = SKILL / "runtime"
EXAMPLE = SKILL / "examples" / "page-types.pages.json"


def author(*args):
    return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), *args], capture_output=True, text=True, cwd=ROOT, timeout=300)


class PartsWorkspace(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir, ignore_errors=True)
        shutil.copytree(SKILL / "examples" / "assets", self.dir / "assets")
        self.doc = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        (self.dir / "pages").mkdir()

    def write(self, name, value):
        path = self.dir / name
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def split(self, sources=None):
        """The worked deck as a main file and three parts, one nested in another."""
        pages = self.doc["pages"]
        first, second, third, fourth = pages[:6], pages[6:20], pages[20:30], pages[30:]
        self.write("pages/second.pages.json", {"pages": second, **({"sources": sources} if sources else {})})
        self.write("pages/third.pages.json", {"pages": third + [{"include": "fourth.json"}]})
        self.write("pages/fourth.json", fourth)  # a bare list is a part too
        return self.write("page-types.pages.json", {**self.doc, "pages": first + [{"include": "pages/second.pages.json"}, {"include": "pages/third.pages.json"}]})

    def read(self, path):
        return run_node(f"""
import {{ readPagesFileSync, partsOf }} from './skills/professional-slides/runtime/pages-file.mjs';
let out;
try {{ const doc = readPagesFileSync({json.dumps(str(path))}); out = {{ doc, parts: Object.fromEntries(partsOf(doc)) }}; }} catch (error) {{ out = {{ error: error.message }}; }}
console.log(JSON.stringify(out));
""")


class PagesFileTests(PartsWorkspace):
    def test_parts_are_spliced_in_order_and_remembered(self):
        result = self.read(self.split())
        self.assertEqual(result["doc"]["pages"], self.doc["pages"])
        self.assertEqual(result["doc"]["deck"], self.doc["deck"])
        ids = [p.get("id") for p in self.doc["pages"]]
        self.assertNotIn(ids[0], result["parts"])                      # a page of the main file
        self.assertEqual(result["parts"][ids[6]], "pages/second.pages.json")
        self.assertEqual(result["parts"][ids[20]], "pages/third.pages.json")
        self.assertEqual(result["parts"][ids[-1]], "pages/fourth.json")  # a part of a part, relative to the main file

    def test_a_file_without_includes_is_returned_as_written(self):
        path = self.write("whole.pages.json", self.doc)
        result = self.read(path)
        self.assertEqual(result["doc"], self.doc)
        self.assertEqual(result["parts"], {})

    def test_an_appendix_can_be_a_part_and_a_part_can_register_its_sources(self):
        self.write("pages/back.pages.json", {"pages": [self.doc["pages"][-1]], "sources": {"survey": {"name": "FY26 passenger survey"}}})
        path = self.write("d.pages.json", {"deck": self.doc["deck"], "sources": {"reports": {"name": "Annual reports"}}, "pages": self.doc["pages"][:3], "appendix": [{"include": "pages/back.pages.json"}]})
        result = self.read(path)
        self.assertEqual(result["doc"]["appendix"], [self.doc["pages"][-1]])
        self.assertEqual(result["doc"]["sources"], {"reports": {"name": "Annual reports"}, "survey": {"name": "FY26 passenger survey"}})

    def test_an_id_written_twice_is_refused_with_both_places(self):
        pages = self.doc["pages"]
        self.write("pages/a.pages.json", {"pages": pages[2:5]})
        self.write("pages/b.pages.json", {"pages": [pages[6], pages[3]]})
        path = self.write("d.pages.json", {"deck": self.doc["deck"], "pages": pages[:2] + [{"include": "pages/a.pages.json"}, {"include": "pages/b.pages.json"}]})
        error = self.read(path)["error"]
        self.assertIn(f'Page id "{pages[3]["id"]}" is written twice', error)
        self.assertIn("pages/a.pages.json (entry 2)", error)
        self.assertIn("pages/b.pages.json (entry 2)", error)
        # The main file against a part, too.
        path = self.write("e.pages.json", {"deck": self.doc["deck"], "pages": pages[:4] + [{"include": "pages/a.pages.json"}]})
        error = self.read(path)["error"]
        self.assertIn("e.pages.json (entry 3)", error)
        self.assertIn("pages/a.pages.json (entry 1)", error)

    def test_what_a_part_cannot_be_is_said(self):
        pages = self.doc["pages"]
        cases = {
            "missing": ({"include": "pages/nowhere.pages.json"}, "which cannot be read"),
            "more": ({"include": "pages/a.pages.json", "title": "x"}, "and nothing else"),
            "notText": ({"include": 7}, "an include is"),
        }
        self.write("pages/a.pages.json", {"pages": pages[2:4]})
        for name, (entry, said) in cases.items():
            with self.subTest(case=name):
                path = self.write(f"{name}.pages.json", {"deck": self.doc["deck"], "pages": [pages[0], entry]})
                self.assertIn(said, self.read(path)["error"])
        self.write("pages/deck.pages.json", {"deck": {"id": "other"}, "pages": pages[2:4]})
        self.assertIn("deck-level keys stay in", self.read(self.write("d.pages.json", {"deck": self.doc["deck"], "pages": [{"include": "pages/deck.pages.json"}]}))["error"])
        self.write("pages/shape.pages.json", {"slides": []})
        self.assertIn('write it as { "pages": [...] }', self.read(self.write("s.pages.json", {"deck": self.doc["deck"], "pages": [{"include": "pages/shape.pages.json"}]}))["error"])
        self.write("pages/loop.pages.json", {"pages": [{"include": "../loop.pages.json"}]})
        self.assertIn("includes it in turn", self.read(self.write("loop.pages.json", {"deck": self.doc["deck"], "pages": [{"include": "pages/loop.pages.json"}]}))["error"])
        self.write("pages/src.pages.json", {"pages": pages[2:4], "sources": {"reports": {"name": "Other reports"}}})
        clash = self.read(self.write("c.pages.json", {"deck": self.doc["deck"], "sources": {"reports": {"name": "Annual reports"}}, "pages": [{"include": "pages/src.pages.json"}]}))["error"]
        self.assertIn('Source "reports" is registered twice with different entries', clash)
        self.assertIn("pages/src.pages.json", clash)


class AuthoringFromPartsTests(PartsWorkspace):
    def test_a_sectioned_deck_compiles_to_the_same_deck_as_the_single_file(self):
        parts = self.split()
        whole = self.write("whole/page-types.pages.json".replace("/", "-"), self.doc)
        result = run_node(f"""
import {{ readPagesFileSync }} from './skills/professional-slides/runtime/pages-file.mjs';
import {{ compileDeck }} from './skills/professional-slides/runtime/author-deck.mjs';
const spec = (file) => compileDeck(readPagesFileSync(file)).spec;
const [a, b] = [spec({json.dumps(str(parts))}), spec({json.dumps(str(whole))})];
console.log(JSON.stringify({{ same: JSON.stringify(a) === JSON.stringify(b), slides: a.slides.length }}));
""")
        self.assertTrue(result["same"])
        self.assertGreater(result["slides"], 40)
        checked = author(str(parts), "--check")
        self.assertEqual(checked.returncode, 0, checked.stderr[-1500:])
        self.assertEqual(json.loads(checked.stdout)["pages"], json.loads(author(str(whole), "--check").stdout)["pages"])

    def test_a_finding_names_the_part_file_its_page_came_from(self):
        pages = self.doc["pages"]
        broken = dict(pages[8])
        broken["title"] = " ".join(["word"] * 16)  # past the title's word limit
        self.doc["pages"] = pages[:8] + [broken] + pages[9:]
        parts = self.split()
        result = author(str(parts), "--check")
        self.assertEqual(result.returncode, 2)
        self.assertIn(f"[{broken['id']} in pages/second.pages.json]", result.stderr)
        self.assertIn("TITLE_WORDS", result.stderr)

    def test_the_deck_level_readers_leave_the_includes_as_written(self):
        # `preferences.mjs apply` writes the deck keys back: the parts stay parts.
        parts = self.split()
        home = self.dir / "home"
        env_run = subprocess.run([NODE, str(RUNTIME / "preferences.mjs"), "apply", str(parts)], capture_output=True, text=True, cwd=ROOT, timeout=120,
                                 env={**__import__("os").environ, "PROFESSIONAL_SLIDES_HOME": str(home)})
        self.assertEqual(env_run.returncode, 0, env_run.stderr)
        written = json.loads(parts.read_text(encoding="utf-8"))
        self.assertEqual([entry for entry in written["pages"] if "include" in entry], [{"include": "pages/second.pages.json"}, {"include": "pages/third.pages.json"}])


if __name__ == "__main__":
    unittest.main()
