"""Field edits applied to a deck's pages where each page is written (author-deck.mjs --apply).

A section's writer edited its part file with scripts of its own - a `node -e`
or a heredoc that read the file, walked to a field and wrote the whole file
back - a model turn each and often a bug. `--apply` takes the edits as data,
`{ page, field, value }`, or a reader's answer as it is saved, refuses an edit
the pages do not bear before writing anything, and writes each into the file
its page is written in, changing no byte the edit does not. These tests hold
that: the round trip of an unedited file, the refusals and what they name, the
three answer formats, the dry run, and the check the run ends with.
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


def author(*args, cwd):
    return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), *args], capture_output=True, text=True, cwd=cwd, timeout=300)


class EditsWorkspace(unittest.TestCase):
    """The worked deck written as a pages file and one part, the part in the formatting `self.dump` gives it."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir, ignore_errors=True)
        shutil.copytree(SKILL / "examples" / "assets", self.dir / "assets")
        doc = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        (self.dir / "pages").mkdir()
        self.part = self.dir / "pages" / "second.pages.json"
        self.part.write_text(self.dump({"pages": doc["pages"][6:20]}), encoding="utf-8")
        self.pages = self.dir / "deck.pages.json"
        self.pages.write_text(json.dumps({**doc, "pages": doc["pages"][:6] + [{"include": "pages/second.pages.json"}] + doc["pages"][20:]}, indent=1) + "\n", encoding="utf-8")
        self.before = {path: path.read_bytes() for path in (self.part, self.pages)}

    def dump(self, value):
        return json.dumps(value, indent=2) + "\n"

    def page(self, page_id):
        found = [p for p in json.loads(self.part.read_text(encoding="utf-8"))["pages"] if p.get("id") == page_id]
        return found[0]

    def apply(self, edits, *flags, name="edits.json"):
        path = self.dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(edits), encoding="utf-8")
        return author(str(self.pages), "--apply", str(path), *flags, cwd=self.dir)


class RoundTripTests(EditsWorkspace):
    def dump(self, value):
        # A part as a Python writer leaves it: non-ASCII escaped, one-space indent, a row kept on one line, a float written 1.0.
        text = json.dumps(value, indent=1, ensure_ascii=True).replace("\n", "\r\n")
        return text.replace('"Hybrid working cost', '"Hybrid working \\u2014 cost', 1) + "\r\n"

    def test_a_file_spliced_with_its_own_values_is_the_same_bytes(self):
        # Every leaf of every page replaced by itself, through the splice an edit uses: the text comes back byte for byte.
        result = run_node(f"""
import fs from 'node:fs';
import {{ spanTree, nodeAt, replaceValue }} from './skills/professional-slides/runtime/json-text.mjs';
const texts = [fs.readFileSync({json.dumps(str(self.part))}, 'utf8'), fs.readFileSync({json.dumps(str(EXAMPLE))}, 'utf8'),
  '{{"pages": [{{"id": "a", "rows": [["x", 1.0, 2], ["y", -0.50, 3e2]], "t": "caf\\\\u00e9"}}]}}'];
const leaves = (node, route = []) => node.kind === 'object' ? node.members.flatMap((m) => leaves(m.value, [...route, m.key]))
  : node.kind === 'array' ? node.items.flatMap((n, i) => leaves(n, [...route, i])) : [route];
const same = texts.map((text) => {{
  let out = text;
  for (const route of leaves(spanTree(text))) {{
    const tree = spanTree(out), node = nodeAt(tree, route), container = nodeAt(tree, route.slice(0, -1));
    const value = JSON.parse(out.slice(node.start, node.end));
    // A number written 1.0 or 3e2 is its own text, not the value's: a splice of it writes what is there.
    if (typeof value === 'number' && String(value) !== out.slice(node.start, node.end)) continue;
    out = replaceValue(out, {{ node, container }}, value);
  }}
  return out === text;
}});
console.log(JSON.stringify({{ same }}));
""")
        self.assertEqual(result["same"], [True, True, True])

    def test_an_edit_changes_only_its_own_bytes(self):
        result = self.apply([{"page": "p09", "field": "exhibit.annotations[1].text", "value": "Two extra trains an hour since 2023, café hours"}])
        self.assertNotEqual(result.stderr.find("Applied 1 change"), -1, result.stderr[-1500:])
        self.assertEqual(self.pages.read_bytes(), self.before[self.pages])  # the pages file is not touched
        before, after = self.before[self.part].decode("utf-8"), self.part.read_bytes().decode("utf-8")  # bytes: a text read would fold the CRLFs
        old_line = [line for line in before.split("\r\n") if "Two extra trains" in line][0]
        new_line = [line for line in after.split("\r\n") if "Two extra trains" in line][0]
        self.assertEqual(after, before.replace(old_line, new_line))  # every other byte - CRLF, indent, escapes - as it was
        self.assertIn("caf\\u00e9", new_line)  # a file that escapes non-ASCII has it escaped
        self.assertIn('\\u2014', after)

    def test_an_edit_the_page_already_reads_as_writes_nothing(self):
        text = self.page("p09")["exhibit"]["annotations"][1]["text"]
        result = self.apply([{"page": "p09", "field": "exhibit.annotations[1].text", "value": text}])
        self.assertIn("Already so (1): p09 exhibit.annotations[1].text", result.stderr)
        self.assertEqual(self.part.read_bytes(), self.before[self.part])


class EditTests(EditsWorkspace):
    def test_set_append_add_and_delete_land_in_the_part_and_the_check_follows(self):
        result = self.apply([
            {"page": "p09", "field": "exhibit.values.1", "value": -7.2},
            {"page": "p09", "field": "exhibit.annotations", "append": True, "value": {"category": "New housing", "text": "Two estates opened on the line"}},
            {"page": "p09", "field": "subtitle", "append": True, "value": "Journeys in millions, FY20 to FY26"},
            {"page": "p05", "field": "exhibit.highlights", "delete": True},
        ])
        page = self.page("p09")
        self.assertEqual(page["exhibit"]["values"][1], -7.2)
        self.assertEqual(page["exhibit"]["annotations"][-1]["category"], "New housing")
        self.assertEqual(page["subtitle"], "Journeys in millions, FY20 to FY26")
        self.assertNotIn("highlights", self.page("p05")["exhibit"])
        # The run ends as --check --page <the pages edited> --json: one object, and that check's exit code.
        report = json.loads(result.stdout)
        self.assertEqual(sorted(report["pages"]), ["p05", "p09"])
        self.assertEqual(result.returncode, 0 if report["ok"] else 2)
        self.assertIn("was: [{\"category\":", result.stderr)

    def test_a_refused_edit_writes_nothing_and_names_the_fields_the_page_has(self):
        result = self.apply([
            {"page": "p09", "field": "exhibit.values.1", "value": -7.2},
            {"page": "p09", "field": "exhibit.annotation[1].text", "value": "x"},
            {"page": "p99", "field": "title", "value": "x"},
            {"page": "p09", "field": "subtitel", "value": "x"},
            {"page": "p09", "field": "title", "old": "a title it never had", "value": "x"},
        ])
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
        self.assertIn("4 of the 5 edits", result.stderr)
        self.assertIn("p09 has no `exhibit.annotation` (in pages/second.pages.json): `exhibit` holds heading, unit, categories, values, totals, annotations - `exhibit.annotations`?", result.stderr)
        self.assertIn('no page "p99"', result.stderr)
        self.assertIn("its pages are p01, p02", result.stderr)
        self.assertIn("p09 has no `subtitel`", result.stderr)
        self.assertIn("it holds id, type, form, commentary", result.stderr)
        self.assertIn('"append": true', result.stderr)
        self.assertIn("the edit expects \"a title it never had\"", result.stderr)
        self.assertEqual(self.part.read_bytes(), self.before[self.part])

    def test_a_dry_run_says_each_change_and_writes_nothing(self):
        result = self.apply([{"page": "p03", "field": "title", "value": "Journeys recovered to 48 million and then stalled"}], "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("1 change --apply would write", result.stdout)
        self.assertIn("p03 title [deck.pages.json]", result.stdout)
        self.assertIn('was: "Journeys recovered to 48 million', result.stdout)
        self.assertIn('now: "Journeys recovered to 48 million and then stalled"', result.stdout)
        self.assertEqual(self.pages.read_bytes(), self.before[self.pages])


class AnswerFormatTests(EditsWorkspace):
    def test_a_self_check_answer_applies_each_replacement_word_for_word(self):
        caption = self.page("p09")["exhibit"]["annotations"][0]["text"]
        answer = {"section": "pages/second.pages.json", "pages": {"p09": {"sheet": "0" * 16, "verified": False}},
                  "problems": [{"slide": "p09", "field": "exhibit.annotations[0].text", "claim": caption, "record": "the log holds 3.1 days",
                                "replacement": "Office commuting settled near three days a week"},
                               {"slide": "p09", "field": "title", "claim": "x", "record": "a note with no replacement"}]}
        result = self.apply(answer, name="out/self-check/second.json")
        self.assertIn("(a self-check answer)", result.stderr)
        self.assertEqual(self.page("p09")["exhibit"]["annotations"][0]["text"], "Office commuting settled near three days a week")
        self.assertIn("Not applied - not a closed fix", result.stderr)
        self.assertIn("problem 2 (p09 title)", result.stderr)
        # Applied twice, the answer is already so: not refused for the text it replaced.
        again = self.apply(answer, name="out/self-check/second.json")
        self.assertIn("Already so (1)", again.stderr)

    def test_a_self_check_replacement_for_a_line_since_rewritten_is_refused(self):
        answer = {"section": "pages/second.pages.json", "pages": {}, "problems": [
            {"slide": "p09", "field": "exhibit.annotations[0].text", "claim": "a line the page no longer says", "record": "r", "replacement": "New text"}]}
        result = self.apply(answer)
        self.assertEqual(result.returncode, 2)
        self.assertIn("the page changed since it was read", result.stderr)

    def test_a_section_review_answer_applies_its_fixes_and_lists_its_routes(self):
        answer = {"part": {"kind": "section", "id": "second"}, "binding": "b", "findings": [
            {"id": "f1", "severity": "minor", "slides": ["p09"], "fix": [{"page": "p09", "field": "exhibit.annotations.1.text", "value": "Two extra trains an hour on two lines"},
                                                                         {"page": "p09", "field": "subtitle", "value": "Journeys, millions"}]},
            {"id": "f2", "severity": "major", "slides": ["p05"], "route": "spine"},
            {"id": "f3", "severity": "none", "slides": ["p06"]}]}
        result = self.apply(answer, name="out/section-review/second.json")
        self.assertIn("(a section-review answer)", result.stderr)
        page = self.page("p09")
        self.assertEqual(page["exhibit"]["annotations"][1]["text"], "Two extra trains an hour on two lines")
        self.assertEqual(page["subtitle"], "Journeys, millions")  # a fix may add the field its holder lacks
        self.assertIn("finding f2 (p05): routed to the spine", result.stderr)
        self.assertNotIn("f3", result.stderr)

    def test_a_judge_answer_replaces_the_one_field_that_says_its_line(self):
        line = self.page("p09")["exhibit"]["annotations"][1]["text"]
        folder = self.dir / "judgements" / "packet-01"
        folder.mkdir(parents=True)
        items = [{"key": "k1", "kind": "commentary-caveats", "subject": line, "context": None, "where": ["p09"]},
                 {"key": "k2", "kind": "commentary-caveats", "subject": "a line no page says", "context": None, "where": ["p09"]},
                 {"key": "k3", "kind": "title-count-only", "subject": "x", "context": None, "where": ["p09"]}]
        (folder / "packet.json").write_text(json.dumps({"batch": "b1", "items": items}), encoding="utf-8")
        answer = {"batch": "b1", "judgements": [
            {"key": "k1", "verdict": "caveat", "reason": "r", "replacement": "Two extra trains an hour lifted off-peak use", "replacementReason": "states a finding"},
            {"key": "k2", "verdict": "caveat", "reason": "r", "replacement": "Some other line", "replacementReason": "r"},
            {"key": "k3", "verdict": "compares", "reason": "r"}]}
        result = self.apply(answer, name="judgements/packet-01/answer.json")
        self.assertIn("(a judge answer)", result.stderr)
        self.assertEqual(self.page("p09")["exhibit"]["annotations"][1]["text"], "Two extra trains an hour lifted off-peak use")
        self.assertIn("no field reads \"a line no page says\" whole - replace it by hand", result.stderr)
        self.assertNotIn("k3", result.stderr)  # a passing verdict has nothing to apply


if __name__ == "__main__":
    unittest.main()
