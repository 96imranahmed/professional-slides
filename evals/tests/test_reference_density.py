"""The references are read by an agent under a context budget, so paragraphs
that run past a screen are where guidance goes to hide.

This is not a style rule about prose. It is about one failure that happened:
design.md carried "For an evidence-to-implication layout, use the established
dashed separator and one arrow centred on the evidence body" in the middle of a
900-character paragraph about exhibit selection. It read as the house rule
rather than as one option, and the deck that followed it drew the same dashed
gutter on all eight of its exhibit-left pages. Rewritten as a table of the
alternatives with their originals, the same guidance produced a choice.

So: a budget per file at today's count, which may fall and may not rise. The
fix for a failure here is a table, a list, or a heading - the forms that let a
reader find one row - not a shorter sentence.
"""

from __future__ import annotations

import unittest

from node_probe import REFERENCES

LIMIT = 900

# Today's count. Lower these as paragraphs are broken up; never raise one.
BUDGET = {
    "charts.md": 7,
    "components.md": 10,
    "storylining.md": 3,
    "theming.md": 2,
    "design.md": 1,
}


def dense_lines(name: str) -> list[int]:
    text = (REFERENCES / name).read_text(encoding="utf-8")
    return [n for n, line in enumerate(text.split("\n"), 1) if len(line) > LIMIT]


class ReferenceDensityTests(unittest.TestCase):
    def test_no_file_carries_more_dense_paragraphs_than_its_budget(self):
        for name, budget in sorted(BUDGET.items()):
            with self.subTest(reference=name):
                lines = dense_lines(name)
                self.assertLessEqual(
                    len(lines), budget,
                    f"{name} has {len(lines)} paragraphs over {LIMIT} characters "
                    f"(budget {budget}), at lines {lines}. Break one into a table or a list "
                    "rather than raising the budget")

    def test_a_reference_not_in_the_budget_stays_readable(self):
        """A file nobody has had to budget for should not quietly become one."""
        for path in sorted(REFERENCES.glob("*.md")):
            if path.name in BUDGET:
                continue
            with self.subTest(reference=path.name):
                lines = dense_lines(path.name)
                self.assertEqual(
                    lines, [],
                    f"{path.name} grew a paragraph over {LIMIT} characters at {lines}; "
                    "break it up, or add the file to BUDGET with a reason")

    def test_the_budget_does_not_outlive_the_files_it_names(self):
        for name in BUDGET:
            with self.subTest(reference=name):
                self.assertTrue((REFERENCES / name).is_file(), f"{name} is budgeted but absent")
