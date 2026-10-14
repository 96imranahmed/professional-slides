"""A section's self-check is read once: it sees every line, its fixes fit and trace, and applying them keeps its verdict.

On ba4 the first per-section self-check found about 115 problems, and a second full
reading after their fixes found 44 more. The sheet had left out every text under three
words and every cell of several lines (na02's row labels, pr13's matrix cells), so the
first reading never saw them. Its fixes overran their slots (six titles of 16-19 words),
so the writers trimmed them. And applying a checker's own fix word for word voided the
page's verdict: 70 of 89 pages were read a second time to confirm text the first
checker wrote. The sheet now carries every cell and label, each problem names its
field and the field's whole replacement, `--validate` refuses a replacement that
overruns or prints a number no record holds, and the join carries a verdict through
its own replacements.
"""
import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from judgement_oracle import self_check_judgements
from node_probe import NODE, ROOT, RUNTIME

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"
TITLE = "Harbour's margin trails its peers while its lending grows fastest"
# A findings matrix as ba4's pr13 wrote it: short row labels and column heads, and a first cell of two lines.
MATRIX = {"id": "fm", "type": "matrix", "form": "findings-matrix", "commentary": "in-exhibit", "title": TITLE,
          "why": "Each move set against its evidence.", "evidence": ["i-peers"],
          "columns": ["Move", "What the evidence shows", "Act"],
          "rows": [{"label": "Margin", "cells": [["Harbour earns {{i-peers/margin@Harbour}}%", "Northgate earns {{i-peers/margin@Northgate}}%"], "Hold"]},
                   {"label": "Growth", "cells": [["Harbour lends fastest of the peers", "On the regional credit unions' FY26 return"], "Watch"]}]}


def stage(tmp):
    home = Path(tmp)
    for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
        shutil.copy(FIXTURES / name, home / name)
    pages = home / "finance.pages.json"
    doc = json.loads(pages.read_text(encoding="utf-8"))
    doc["pages"].append(json.loads(json.dumps(MATRIX)))
    pages.write_text(json.dumps(doc), encoding="utf-8")
    return pages


def node(*args):
    return subprocess.run([NODE, *map(str, args)], capture_output=True, text=True, timeout=300)


def sheet_hashes(text):
    return {m.group(1): m.group(2) for m in re.finditer(r"^(\S+)  .*\(sheet ([0-9a-f]{16})\)$", text, re.M)}


def questions(pages):
    """The questions the rules ask of the deck's copy, as the self-check brief lists them beside its claims."""
    return json.loads((pages.parent / "out" / "self-check" / "questions" / "deck.json").read_text(encoding="utf-8"))["items"]


def edit(pages, change):
    doc = json.loads(pages.read_text(encoding="utf-8"))
    change(next(page for page in doc["pages"] if page.get("id") == "fm"))
    pages.write_text(json.dumps(doc), encoding="utf-8")


class CoverageTests(unittest.TestCase):
    def test_the_sheet_reads_cells_row_labels_and_column_heads_and_a_changed_label_reopens_the_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage(tmp)
            run = node(RUNTIME / "author-deck.mjs", pages, "--claims", "fm")
            self.assertEqual(run.returncode, 0, run.stderr[-600:])
            lines = run.stdout.splitlines()
            for line in ("rows[0].label: Margin", "columns[0]: Move", "rows[0].cells[1]: Hold", "rows[1].label: Growth"):
                self.assertTrue(any(l.endswith(line) for l in lines), f"a short label or cell is a claim the reader reads: {line}")
            # Each line of a two-line cell is read, its numbers by the record.
            self.assertTrue(any("rows[0].cells[0][1]: Northgate earns" in l for l in lines), run.stdout)
            self.assertTrue(any(l.strip().startswith("as written: Northgate earns {{i-peers/margin@Northgate}}%") for l in lines))
            # Each claim carries the room of its slot: the title's word cap, a label's characters as written.
            self.assertIn("        fits: 15 words (title cap)", lines)
            self.assertIn("        fits: 6 characters (as written)", lines)
            before = sheet_hashes(run.stdout)["fm"]
            edit(pages, lambda page: page["rows"][1].update(label="Lending"))
            after = sheet_hashes(node(RUNTIME / "author-deck.mjs", pages, "--claims", "fm").stdout)["fm"]
            self.assertNotEqual(before, after, "a changed row label re-opens its page")


class ValidateTests(unittest.TestCase):
    def test_an_answer_is_refused_for_a_missing_verdict_an_overrun_an_untraced_number_and_a_field_not_on_the_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage(tmp)
            brief = node(RUNTIME / "author-deck.mjs", pages, "--brief", "selfcheck")
            self.assertEqual(brief.returncode, 0, brief.stderr[-600:])
            self.assertIn("self-check.mjs --validate out/self-check/deck.json", brief.stdout)
            hashes = sheet_hashes(brief.stdout)
            verdicts = {page: {"sheet": h, "verified": page != "fm"} for page, h in hashes.items()}
            missing = sorted(page for page in hashes if page != "fm")[0]
            bad = {"section": "deck", "pages": {page: v for page, v in verdicts.items() if page != missing}, "problems": [
                {"slide": "fm", "field": "title", "claim": TITLE, "record": "i-peers/margin",
                 "replacement": "Harbour's margin trails every one of its regional peers while its lending grows faster than any of theirs this year"},
                {"slide": "fm", "field": "rows[0].cells[1]", "claim": "Hold", "record": "i-peers/margin", "replacement": "9.9%"},
                {"slide": "fm", "field": "rows[0].caption", "claim": "Margin", "record": "i-peers/margin", "replacement": "Spread"},
            ]}
            answer = Path(tmp) / "bad.json"
            answer.write_text(json.dumps(bad), encoding="utf-8")
            run = node(RUNTIME / "self-check.mjs", "--validate", answer, pages)
            self.assertEqual(run.returncode, 2, run.stdout + run.stderr)
            reasons = "\n".join(json.loads(run.stdout)["reasons"])
            self.assertIn(f"{missing}: no verdict", reasons)
            self.assertRegex(reasons, r"problem 1 \(fm title\): the replacement runs to \d+ words against 15")
            self.assertIn("problem 2 (fm rows[0].cells[1]): the replacement prints 9.9%, which no record holds", reasons)
            self.assertIn('problem 3 (fm rows[0].caption): fm has no claim at "field"', reasons)
            # Every question the brief lists is answered in the same answer, those reading the relabelled row of the relabel.
            good = {"section": "deck", "pages": verdicts, "problems": [
                {"slide": "fm", "field": "rows[0].label", "claim": "Margin", "record": "i-peers/margin is a net interest margin", "replacement": "Spread"}],
                "judgements": self_check_judgements(questions(pages), [("fm", "Margin", "Spread")])}
            answer.write_text(json.dumps(good), encoding="utf-8")
            run = node(RUNTIME / "self-check.mjs", "--validate", answer, pages)
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            self.assertIn("fm", json.loads(run.stdout)["expect"])


class CarriedVerdictTests(unittest.TestCase):
    def test_a_page_with_its_replacements_applied_keeps_its_verdict_and_another_edit_is_named_by_its_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage(tmp)
            out = Path(tmp) / "out"
            hashes = sheet_hashes(node(RUNTIME / "author-deck.mjs", pages, "--brief", "selfcheck").stdout)
            replacement = "Harbour's margin trails its peers as its lending grows fastest"
            answer = {"section": "deck", "pages": {page: {"sheet": h, "verified": page != "fm"} for page, h in hashes.items()}, "problems": [
                {"slide": "fm", "field": "title", "claim": TITLE, "record": "i-peers ranks loan growth", "replacement": replacement},
                {"slide": "fm", "field": "rows[0].label", "claim": "Margin", "record": "i-peers/margin is a net interest margin", "replacement": "Spread"}],
                "judgements": self_check_judgements(questions(pages), [("fm", TITLE, replacement), ("fm", "Margin", "Spread")])}
            (out / "self-check" / "deck.json").write_text(json.dumps(answer), encoding="utf-8")
            check = node(RUNTIME / "self-check.mjs", "--validate", "out/self-check/deck.json", pages)
            self.assertEqual(check.returncode, 0, check.stdout + check.stderr)
            expect = json.loads(check.stdout)["expect"]["fm"]
            # The writer applies both replacements word for word, and the build writes its ledger.
            edit(pages, lambda page: (page.update(title=replacement), page["rows"][0].update(label="Spread")))
            ledger = {"schema": "professional-slides.claims/v1", "pageHashes": {page: f"build{n:011d}" for n, page in enumerate(hashes)}, "claims": [], "findings": []}
            (out / "claims.json").write_text(json.dumps(ledger), encoding="utf-8")
            spine = ["--spine", "The title-spine pass merged no pages: each proves a different finding about Harbour."]
            first = node(RUNTIME / "self-check.mjs", pages, out, *spine)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            record = json.loads((out / "self-check.json").read_text(encoding="utf-8"))
            self.assertEqual(record["pages"]["fm"]["sheet"], expect, "the page's claims are the checked claims with the fixes applied")
            # A line no problem named, rewritten after the check: the page goes back for that line alone, whatever the ledger says.
            edit(pages, lambda page: page["rows"][1].update(cells=[page["rows"][1]["cells"][0], "Track"]))
            second = node(RUNTIME / "self-check.mjs", pages, out)
            self.assertEqual(second.returncode, 2, second.stdout + second.stderr)
            report = json.loads(second.stdout)
            self.assertEqual(report["toCheck"], {"its claims changed since it was checked": ["fm"]})
            self.assertEqual(report["lines"], {"fm": ["rows[1].cells[1]"]})


if __name__ == "__main__":
    unittest.main()
