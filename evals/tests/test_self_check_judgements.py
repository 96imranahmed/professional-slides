"""One reader a line: a section's self-check answers the questions the rules ask of its copy, and its fixes are read on the page.

A section was read by two readers side by side - a judge answering the rules' questions of its copy, and a self-checker
reading its claims against the records - and each rewrote lines the other also read, neither seeing the other's fix. A
caveat the judge turned into a finding kept a year the self-check corrected; a consequence the judge added was false once
the correction applied; a phrase the self-check struck as unsupported came back in the judge's line. A line merged from
two fixes kept neither reading. Now the self-check brief lists the section's open questions beside its claim sheet, the
same reader answers both, and a question on a line it replaces is answered of its own replacement - so each line gets one
fix that passes both readings, and the validation refuses an answer given on the text the fix removes.

And a replacement held to its slot's words still broke the page it was applied to: a callout within its slot's words did
not fit the callout box, and corrected points cut a page out of its band. `--validate` now composes every page the answer
touches with all its replacements in place and runs the writer's own page check, refusing a replacement under which a page
has a blocking finding it did not have before, with the finding's repair.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from judgement_oracle import self_check_judgements
from node_probe import NODE, ROOT, RUNTIME, run_node

AUTHOR = RUNTIME / "author-deck.mjs"
JUDGE = RUNTIME / "judge.mjs"
SELF_CHECK = RUNTIME / "self-check.mjs"
EVIDENCE = ROOT / "evals" / "quality" / "fixtures" / "evidence"
RUNTIME_PATH = "./skills/professional-slides/runtime"
# f1's title as the sheet reads it, and as it is written with the tokens that print its numbers.
TITLE = "Loans grew 57% in seven years to 648 million"
WRITTEN = "Loans grew {{A-loans/percent | 0%}} in seven years to {{i-loans/loans@FY26}} million"
FIXED, FIXED_WRITTEN = f"{TITLE} by FY26", f"{WRITTEN} by FY26"


def node(*args, timeout=600):
    return subprocess.run([NODE, *map(str, args)], capture_output=True, text=True, timeout=timeout)


def sectioned(tmp, change=None):
    """The finance fixture written in two sections beside its root page (pages/a: f1, f2; pages/b: the rest)."""
    home = Path(tmp)
    for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
        shutil.copy(EVIDENCE / name, home / name)
    doc = json.loads((home / "finance.pages.json").read_text(encoding="utf-8"))
    by_id = {page["id"]: page for page in doc["pages"]}
    if change:
        change(by_id)
    (home / "pages").mkdir()
    (home / "pages" / "a.pages.json").write_text(json.dumps({"pages": [by_id["f1"], by_id["f2"]]}), encoding="utf-8")
    (home / "pages" / "b.pages.json").write_text(json.dumps({"pages": [by_id[i] for i in ("f3", "f4", "f5", "f6")]}), encoding="utf-8")
    doc["pages"] = [by_id["f0"], {"include": "pages/a.pages.json"}, {"include": "pages/b.pages.json"}]
    (home / "finance.pages.json").write_text(json.dumps(doc), encoding="utf-8")
    return home / "finance.pages.json"


def brief(pages, *section):
    run = node(AUTHOR, pages, "--brief", "selfcheck", *section)
    assert run.returncode == 0, run.stderr[-800:]
    name = section[1] if section else "deck"
    items = json.loads((pages.parent / "out" / "self-check" / "questions" / f"{name}.json").read_text(encoding="utf-8"))["items"]
    hashes = {m.group(1): m.group(2) for m in re.finditer(r"^(\S+)  .*\(sheet ([0-9a-f]{16})\)$", run.stdout, re.M)}
    return run.stdout, items, hashes


def validate(pages, answer, name="deck"):
    path = pages.parent / "out" / "self-check" / f"{name}.json"
    path.write_text(json.dumps(answer), encoding="utf-8")
    run = node(SELF_CHECK, "--validate", f"out/self-check/{name}.json", pages)
    return run.returncode, json.loads(run.stdout) if run.stdout.strip() else {"stderr": run.stderr}


def store(pages):
    path = pages.parent / "finance.judgements.json"
    return json.loads(path.read_text(encoding="utf-8"))["verdicts"] if path.exists() else {}


def title_fix(**more):
    return {"slide": "f1", "field": "title", "claim": TITLE, "record": "A-loans and i-loans hold the growth to FY26", "replacement": FIXED_WRITTEN, **more}


@unittest.skipUnless(NODE, "Node.js is not available")
class BriefTests(unittest.TestCase):
    def test_the_section_brief_lists_the_questions_judge_page_would_stage_beside_the_claims(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp)
            text, items, _ = brief(pages, "--section", "a")
            staged = node(JUDGE, pages, "--page", "f1,f2")
            packets = [json.loads(p.read_text()) for p in (pages.parent / "judgements").glob("*/packet-*/packet.json")]
        self.assertEqual(staged.returncode, 3, staged.stderr[-800:])
        self.assertTrue(items, "the section's copy has questions open")
        self.assertEqual({item["key"] for item in items}, {item["key"] for packet in packets for item in packet["items"]},
                         "the self-checker is given the questions a judge of the section would be")
        self.assertTrue(all({"f1", "f2"} & set(item["where"]) for item in items))
        self.assertIn("## The questions the rules ask of your pages' copy", text)
        title = next(item for item in items if item["kind"] == "title-count-only" and item["subject"] == TITLE)
        self.assertIn(f"- {title['key']} (on f1; reads f1 title)", text, "each question names the lines of the sheet it reads")
        self.assertIn('"on": "replacement"', text)


@unittest.skipUnless(NODE, "Node.js is not available")
class OneReadingTests(unittest.TestCase):
    def test_a_question_on_a_replaced_line_is_answered_of_the_replacement_and_recorded(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp)
            _, items, hashes = brief(pages, "--section", "a")
            verdicts = {page: {"sheet": h, "verified": page != "f1"} for page, h in hashes.items()}
            swaps = [("f1", TITLE, FIXED), ("f1", WRITTEN, FIXED_WRITTEN)]
            # Judged as the title stands, though the same answer replaces it: refused, and nothing recorded.
            old_status, old = validate(pages, {"section": "a", "pages": verdicts, "problems": [title_fix()], "judgements": self_check_judgements(items)}, "a")
            recorded_old = store(pages)
            status, said = validate(pages, {"section": "a", "pages": verdicts, "problems": [title_fix()], "judgements": self_check_judgements(items, swaps)}, "a")
            kept = store(pages)
            # The writer applies the title word for word; the page's check finds every question it asks answered.
            part = pages.parent / "pages" / "a.pages.json"
            doc = json.loads(part.read_text(encoding="utf-8"))
            doc["pages"][0]["title"] = FIXED_WRITTEN
            part.write_text(json.dumps(doc), encoding="utf-8")
            pending = pages.parent / "pending.json"
            node(AUTHOR, pages, "--check", "--page", "f1", "--pending", pending)
            left = [item for item in json.loads(pending.read_text()) if "f1" in item["where"]]
        self.assertEqual(old_status, 2)
        reasons = "\n".join(old["reasons"])
        self.assertIn("your problem 1 (f1 title) replaces the text this question reads", reasons)
        self.assertIn(f'judge it as it reads with the replacement in place - "{FIXED}" - and set "on": "replacement"', reasons)
        self.assertEqual(recorded_old, {}, "a refused answer records nothing")
        self.assertEqual(status, 0, said)
        self.assertEqual(said["judgements"], len(items))
        moved = [entry for entry in kept.values() if entry.get("replaces")]
        self.assertTrue(moved and all(entry["subject"] in (FIXED, FIXED_WRITTEN) for entry in moved), moved)
        self.assertTrue(all(entry["by"] == {"selfCheck": "a"} for entry in kept.values()))
        self.assertEqual(left, [], "the replacement applied word for word is found answered: no second reading")

    def test_a_line_is_mended_once_by_the_self_checks_own_replacement(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp)
            _, items, hashes = brief(pages, "--section", "a")
            verdicts = {page: {"sheet": h, "verified": page != "f1"} for page, h in hashes.items()}
            said = {entry["key"]: entry for entry in self_check_judgements(items, [("f1", TITLE, FIXED), ("f1", WRITTEN, FIXED_WRITTEN)])}
            own = next(item for item in items if item["kind"] == "title-count-only" and item["subject"] == TITLE)
            other = next(item for item in items if item["kind"] == "title-count-only" and "f2" in item["where"])
            # Its own replacement fails the question it is to pass, and another title fails with a judge's fix of its own.
            said[own["key"]].update(verdict="count-only", quote="Loans grew")
            said[other["key"]].update(verdict="count-only", quote=other["subject"].split()[0], replacement="Profit rose while cash fell", replacementReason="It now says what follows.")
            status, answer = validate(pages, {"section": "a", "pages": verdicts, "problems": [title_fix()], "judgements": list(said.values())}, "a")
        self.assertEqual(status, 2)
        reasons = "\n".join(answer["reasons"])
        self.assertIn(f"({own['key']} title-count-only, on f1): your problem 1 (f1 title) fails this question (\"count-only\"): write the replacement so that, asked of it, it answers \"compares\"", reasons)
        self.assertIn(f"({other['key']} title-count-only, on f2): a line's fix goes in \"problems\"", reasons)
        self.assertEqual(store(pages), {})

    def test_a_failing_verdict_on_a_line_left_standing_is_mended_as_a_problem(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp)
            _, items, hashes = brief(pages, "--section", "a")
            said = {entry["key"]: entry for entry in self_check_judgements(items)}
            other = next(item for item in items if item["kind"] == "title-count-only" and "f2" in item["where"])
            said[other["key"]].update(verdict="count-only", quote=other["subject"].split()[0])
            status, answer = validate(pages, {"section": "a", "pages": {page: {"sheet": h, "verified": True} for page, h in hashes.items()}, "problems": [],
                                              "judgements": list(said.values())}, "a")
        self.assertEqual(status, 2)
        self.assertIn('"count-only" is mended once, as one of your problems: give the title its whole replacement in "problems"', "\n".join(answer["reasons"]))


@unittest.skipUnless(NODE, "Node.js is not available")
class SettledByThePageTests(unittest.TestCase):
    def test_what_a_replacement_moves_is_settled_by_what_the_page_then_asks(self):
        """A question's subject is read for the replaced line to say which questions move to the replacement; the page check
        of the pages with the replacements in place settles it. A question it still asks of the text as it stands is answered
        of that text, and one the substitution did not foresee is named by its key and answered under it."""
        result = run_node(f"""
import {{ judgementProblems, extraProblems }} from '{RUNTIME_PATH}/self-check.mjs';
import {{ judgementKey }} from '{RUNTIME_PATH}/judgements.mjs';
const item = (subject, where = 'p1') => ({{ key: judgementKey('commentary-caveats', subject, null), kind: 'commentary-caveats', subject, context: null, where: [where] }});
const line = 'Arrears stayed low while the book grew fastest', fixed = 'Arrears stayed low in every year of growth';
const questions = [item(line), item('Cost fell in every year of the plan')];
const swaps = [{{ slide: 'p1', at: 'problem 1 (p1 points[0].text)', claim: {{ field: 'points[0].text', text: line, written: line, limit: {{ words: 40, from: 'limits' }} }}, to: fixed, written: fixed }}];
const finding = (q, on = null) => ({{ key: q.key, verdict: 'finding', reason: 'The line states what the record shows.', quote: null, on }});
const moved = judgementKey('commentary-caveats', fixed, null), unforeseen = item('Arrears stayed low in every year of growth, the union says');
const answer = (entries) => ({{ judgements: entries }});
const said = {{
  // The page asks the question of the replacement: answered of it, it is recorded under the replacement's key.
  moved: judgementProblems(questions, answer([finding(questions[0], 'replacement'), finding(questions[1])]), swaps, {{ pending: new Set() }}),
  // The page still asks it of the text as it stands: the answer on the replacement is refused.
  stays: judgementProblems(questions, answer([finding(questions[0], 'replacement'), finding(questions[1])]), swaps, {{ pending: new Set([questions[0].key]) }}),
  // Answered of the text as it stands where the page asks it of the replacement: refused.
  old: judgementProblems(questions, answer([finding(questions[0]), finding(questions[1])]), swaps, {{ pending: new Set([moved]) }}),
  // Answered of the text as it stands where the page does not ask it of the replacement after all: kept as it stands.
  kept: judgementProblems(questions, answer([finding(questions[0]), finding(questions[1])]), swaps, {{ pending: new Set() }}),
  extra: extraProblems([{{ entry: finding(unforeseen), i: 2 }}], [unforeseen]),
  open: extraProblems([], [unforeseen]),
}};
console.log(JSON.stringify(Object.fromEntries(Object.entries(said).map(([name, r]) => [name, {{ reasons: r.reasons, keys: Object.keys(r.verdicts), replaces: Object.values(r.verdicts).map((v) => v.replaces ?? null) }}]))));
""")
        moved_key = result["moved"]["keys"][0]
        self.assertEqual(result["moved"]["reasons"], [])
        self.assertIsNotNone(result["moved"]["replaces"][0], "recorded as the question asked of the replacement")
        self.assertIn("the page still asks this of the text as it stands", " ".join(result["stays"]["reasons"]))
        self.assertIn('replaces the text this question reads', " ".join(result["old"]["reasons"]))
        self.assertEqual(result["kept"]["reasons"], [])
        self.assertNotIn(moved_key, result["kept"]["keys"])
        self.assertEqual(result["extra"]["reasons"], [])
        self.assertEqual(len(result["extra"]["keys"]), 1)
        self.assertIn('no answer judges it - add it to "judgements" under this key', " ".join(result["open"]["reasons"]))


def callouts(by_id):
    """f1 drawn with its argument in three callouts on the line, each within the callout box."""
    page = by_id["f1"]
    page.update(commentary="on-exhibit", adds="The callouts say why the book grew faster after FY22, which the line alone cannot")
    page.pop("bar", None)
    page["exhibit"].pop("highlights", None)
    page["exhibit"]["annotations"] = [{"category": "FY20", "text": "Growth held through the year branches shut"},
                                      {"category": "FY23", "text": "Lending sped up from FY22 as mortgage demand rose"},
                                      {"category": "FY26", "text": "Arrears stayed low while the book grew fastest"}]


@unittest.skipUnless(NODE, "Node.js is not available")
class PageReadTests(unittest.TestCase):
    def test_a_callout_within_its_slots_words_that_does_not_fit_its_box_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, callouts)
            text, items, hashes = brief(pages, "--section", "a")
            line = "Arrears stayed low in every year of growth while the book grew faster than before"
            problem = {"slide": "f1", "field": "exhibit.annotations[2].text", "claim": "Arrears stayed low while the book grew fastest",
                       "record": "i-credit holds arrears low in every year", "replacement": line}
            status, answer = validate(pages, {"section": "a", "pages": {page: {"sheet": h, "verified": page != "f1"} for page, h in hashes.items()},
                                              "problems": [problem], "judgements": self_check_judgements(items, [("f1", problem["claim"], line)])}, "a")
        room = re.search(r"exhibit\.annotations\[2\]\.text: .*\n\s+fits: (\d+) words", text)
        self.assertTrue(room and int(room.group(1)) > len(line.split()), "the slot's words hold the line: only the page refuses it")
        self.assertEqual(status, 2, answer)
        reasons = "\n".join(answer["reasons"])
        self.assertIn("f1: with your problem 1 (f1 exhibit.annotations[2].text) in place, the page has COMPILE, which it does not have as the pages stand", reasons)
        self.assertIn("too long for the chart's callout box", reasons)
        self.assertIn("Write the replacement so the page passes as it does now", reasons)

    def test_points_cut_short_are_refused_with_the_finding_and_the_pages_words(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp)
            _, items, hashes = brief(pages)
            doc = json.loads(pages.read_text(encoding="utf-8"))
            points = doc["pages"][0]["points"]
            sheet = node(AUTHOR, pages, "--claims", "f0").stdout
            read = {m.group(1): m.group(2) for m in re.finditer(r"^  (?:ok   |CHECK) (points\[\d\]): (.*)$", sheet, re.M)}
            fixes = {"points[1]": "Liquidity cover has fallen every year, so term funding must come before further lending.",
                     "points[2]": "Harbour lends faster than its peers on thinner liquidity."}
            problems = [{"slide": "f0", "field": field, "claim": read[field], "record": "The record holds it in fewer words.", "replacement": fix} for field, fix in fixes.items()]
            swaps = [("f0", read[field], fix) for field, fix in fixes.items()] + [("f0", points[int(field[7])], fix) for field, fix in fixes.items()]
            status, answer = validate(pages, {"section": "deck", "pages": {page: {"sheet": h, "verified": page != "f0"} for page, h in hashes.items()},
                                              "problems": problems, "judgements": self_check_judgements(items, swaps)})
        self.assertEqual(status, 2, answer)
        reasons = "\n".join(answer["reasons"])
        self.assertIn("f0: with your problem 1 (f0 points[1]), problem 2 (f0 points[2]) in place, the page has", reasons)
        self.assertRegex(reasons, r"Its body runs to \d+ words with them and \d+ as it stands, and the page holds \d+ to \d+")
        self.assertEqual(store(pages), {})


if __name__ == "__main__":
    unittest.main()
