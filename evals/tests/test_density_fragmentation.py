"""Copy broken into labels blocks the build.

A delivered deck's prose pages set its commentary as one-sentence fragments,
and the review's density pass judged every flagged page "right". The page
flags stay questions for that pass; the deck-level median words a block across
the pages that carry prose blocks (TEXT_FRAGMENTED), read by column as the
reference pages were. The profile reads the PDF in one pdftotext run rather
than one a page.
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
        # A developed opening and nine one-line fragments: prose, read as labels.
        report = self.profile([15, 6, 6, 6, 6, 6, 6, 6, 6, 6])
        self.assertFalse(report["accepted"])
        finding = next(f for f in report["findings"] if f["code"] == "TEXT_FRAGMENTED")
        self.assertEqual(finding["code"], "TEXT_FRAGMENTED")
        self.assertEqual(finding["severity"], "blocker")
        self.assertEqual(finding["measured"]["direction"], "below")
        self.assertEqual(finding["threshold"], [FORM["wordsPerBlock"]["q1"], FORM["wordsPerBlock"]["q3"]])
        self.assertIn("p0", finding["repair"])

    def test_developed_points_among_their_labels_pass_and_slabs_block(self):
        # Three developed points with the chart's heading and label rows around them, as a strong page sets them.
        self.assertTrue(self.profile([8, 25, 4, 30, 5, 20, 6])["accepted"])
        slab = self.profile([140, 130])
        self.assertEqual([f["measured"]["direction"] for f in slab["findings"] if f["code"] == "TEXT_FRAGMENTED"], ["above"])

    def test_it_reads_prose_pages_only_and_needs_enough_of_them(self):
        # A page whose blocks are its labels carries no prose, however many it has.
        self.assertTrue(self.profile([12, 12, 12, 12], task="chart-led")["accepted"])
        self.assertEqual(self.profile([12, 12, 12, 12])["findings"], [])   # nor is it held to the developed-block floor
        short = density_profile.CONTRACT["deckLength"]["density"] - 1
        self.assertTrue(self.profile([15, 6, 6, 6, 6, 6, 6, 6, 6, 6], pages=short)["accepted"])

    def test_prose_pages_that_stop_at_two_developed_points_block(self):
        # Strong prose pages carry a median of three developed blocks; a deck whose pages stop at two says less than its evidence.
        two = self.profile([8, 25, 4, 30, 5, 6])
        [finding] = two["findings"]
        self.assertEqual((finding["code"], finding["severity"], finding["measured"]["developedPerPage"]), ("COMMENTARY_UNDEVELOPED", "blocker", 2))
        self.assertIn("Do not split a point in two", finding["repair"])
        self.assertTrue(self.profile([8, 25, 4, 30, 5, 20, 6])["accepted"])
        standing = next(s for s in two["standings"] if s["code"] == "COMMENTARY_UNDEVELOPED")
        self.assertEqual((standing["value"], standing["bar"], standing["side"]), (2, 3, "min"))

    def test_a_family_of_light_pages_is_told_what_words_that_job_carries(self):
        # Exhibit-led pages each clearing their floor, the family's median well under strong pages': advised, never refused,
        # and the repair is captions and callouts, not prose.
        light = self.profile([20, 10], pages=6, task="exhibit-led")
        found = [f for f in light["findings"] if f["code"] == "FAMILY_LIGHT"]
        self.assertEqual([(f["severity"], f["measured"]["task"], f["measured"]["pages"]) for f in found], [("advisory", "exhibit-led", 6)])
        self.assertIn("caption under each panel", found[0]["repair"])
        self.assertTrue(light["accepted"])
        self.assertEqual([f for f in self.profile([20, 10], pages=4, task="exhibit-led")["findings"] if f["code"] == "FAMILY_LIGHT"], [])

    def test_a_revision_under_older_rules_hears_it_as_advice(self):
        report = self.profile([15, 6, 6, 6, 6, 6, 6, 6, 6, 6], rules={"workflow": "existing_deck_revision", "rulesVersion": 2})
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
            page = '<page width="1280" height="720"><flow><block><line xMin="60" yMin="200" xMax="400" yMax="216">{}</line></block></flow></page>'
            words = lambda text: "".join(f'<word xMin="60" yMin="200" xMax="90" yMax="216">{w}</word>' for w in text.split())  # noqa: E731
            body = "".join(page.format(words(text)) for text in ("page one", "page two", "page three"))
            return subprocess.CompletedProcess(cmd, 0, stdout=f'<html xmlns="http://www.w3.org/1999/xhtml"><body><doc>{body}</doc></body></html>', stderr="")

        with mock.patch.object(density_profile.subprocess, "run", side_effect=fake):
            pages = density_profile.extract(Path("deck.pdf"))
        self.assertEqual(len(calls), 1)
        self.assertNotIn("-f", calls[0])
        self.assertIn("-bbox-layout", calls[0])
        self.assertEqual([[line["text"] for line in page] for page in pages], [["page one"], ["page two"], ["page three"]])


if __name__ == "__main__":
    unittest.main()
