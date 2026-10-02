"""Copy broken into labels blocks the build.

A delivered deck's prose pages set five blocks a page of 25 words each,
against the 41-86 words a block strong pages keep - the fragment copy.md
names - and the review's density pass judged every flagged page "right". The
page flags stay questions for that pass; the deck-level median across the
prose pages blocks (TEXT_FRAGMENTED). The profile reads the PDF in one
pdftotext run rather than one a page.
"""
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))
import density_profile  # noqa: E402

FORM = density_profile.TEXT_FORM


def block(words):
    return " ".join(["word"] * words)


def page_text(title, blocks):
    return "\n\n".join([title] + [block(n) for n in blocks]) + "\n"


def scene(pages):
    slides = [{"id": "cover", "componentInstances": [{"component": "cover"}], "nodes": []}]
    slides += [{"id": f"p{i}", "componentInstances": [{"component": "slide-chrome"}],
                "nodes": [{"type": "text", "role": "action-title", "text": f"Title {i}"}]} for i in range(pages)]
    return {"slides": slides}


def content(pages, task="chart-with-commentary"):
    return {"pages": [{"id": f"p{i}", "textReference": {"task": task}} for i in range(pages)]}


class FragmentationTests(unittest.TestCase):
    def profile(self, blocks, pages=10, task="chart-with-commentary", rules=None):
        texts = [""] + [page_text(f"Title {i}", blocks) for i in range(pages)]
        with mock.patch.object(density_profile, "extract", return_value=texts):
            return density_profile.profile(Path("deck.pdf"), scene(pages), content(pages, task), rules)

    def test_prose_pages_of_fragments_block(self):
        report = self.profile([25, 25, 25, 25, 25])
        self.assertFalse(report["accepted"])
        [finding] = report["findings"]
        self.assertEqual(finding["code"], "TEXT_FRAGMENTED")
        self.assertEqual(finding["severity"], "blocker")
        self.assertEqual(finding["measured"]["direction"], "below")
        self.assertEqual(finding["threshold"], [FORM["wordsPerBlock"]["q1"], FORM["wordsPerBlock"]["q3"]])
        self.assertIn("p0", finding["repair"])

    def test_developed_points_pass_and_slabs_block(self):
        self.assertTrue(self.profile([55, 60, 50])["accepted"])
        slab = self.profile([140, 130])
        self.assertEqual([f["measured"]["direction"] for f in slab["findings"]], ["above"])

    def test_it_reads_prose_pages_only_and_needs_enough_of_them(self):
        # A chart-led page's blocks are its labels; they are not prose.
        self.assertTrue(self.profile([12, 12, 12, 12], task="chart-led")["accepted"])
        short = density_profile.CONTRACT["deckLength"]["density"] - 1
        self.assertTrue(self.profile([25, 25, 25], pages=short)["accepted"])

    def test_a_revision_under_older_rules_hears_it_as_advice(self):
        report = self.profile([25, 25, 25, 25], rules={"workflow": "existing_deck_revision", "rulesVersion": 2})
        self.assertTrue(report["accepted"])
        self.assertEqual(report["findings"][0]["severity"], "advisory")
        self.assertEqual(report["findings"][0]["waived"]["introducedIn"], 3)

    def test_the_code_is_registered_where_the_registry_reads_it(self):
        self.assertIn("TEXT_FRAGMENTED", density_profile.DENSITY_CODES)
        self.assertIn("TEXT_FRAGMENTED", json.loads((ROOT / "skills/professional-slides/runtime/weight.json").read_text())["rules"]["introduced"]["3"])


class OneReadTests(unittest.TestCase):
    def test_the_pdf_is_read_once_and_split_into_pages(self):
        calls = []

        def fake(cmd, **_):
            calls.append(cmd)
            return subprocess.CompletedProcess(cmd, 0, stdout="page one\fpage two\fpage three", stderr="")

        with mock.patch.object(density_profile.subprocess, "run", side_effect=fake):
            pages = density_profile.extract(Path("deck.pdf"))
        self.assertEqual(len(calls), 1)
        self.assertNotIn("-f", calls[0])
        self.assertEqual(pages, ["page one", "page two", "page three"])


if __name__ == "__main__":
    unittest.main()
