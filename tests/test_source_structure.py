from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SourceStructureTests(unittest.TestCase):
    def test_every_source_directory_has_an_index(self):
        source_root = ROOT / "src"
        directories = [
            source_root,
            *(path for path in source_root.rglob("*") if path.is_dir()),
        ]
        missing = [
            path.relative_to(ROOT).as_posix()
            for path in directories
            if not (path / "index.md").is_file()
        ]
        self.assertEqual(missing, [])

    def test_colour_contract_uses_one_structural_primary(self):
        design = (ROOT / "src" / "design" / "index.md").read_text()
        guidelines = (ROOT / "src" / "components" / "guidelines.md").read_text()
        trackers = (ROOT / "src" / "components" / "trackers" / "index.md").read_text()
        evals = (ROOT / "evals" / "index.md").read_text()

        for required in (
            "`component-primary`",
            "`text-accent`",
            "`page-guideline`",
            "`divider-rule`",
            "`chart-segment`",
            "`chart-series-1` to `chart-series-6`",
        ):
            self.assertIn(required, design)

        self.assertIn("it is an alias of the primary token, never a second swatch", design.lower())
        self.assertIn("do not use chart-series colours", trackers.lower())
        self.assertIn("do not introduce a second accent", guidelines.lower())
        self.assertIn("one identical component-primary swatch", evals.lower())
        self.assertNotIn("exactly three expressive roles", design.lower())

    def test_terminal_action_surface_is_singleton(self):
        text_box = (ROOT / "src" / "components" / "text-box.md").read_text().lower()
        components = (ROOT / "src" / "components" / "index.md").read_text().lower()
        copy = (ROOT / "src" / "components" / "copy.md").read_text().lower()
        evals = (ROOT / "evals" / "index.md").read_text().lower()

        self.assertIn("at most one terminal action surface per slide", text_box)
        self.assertIn("no more than one terminal action surface", components)
        self.assertIn("never render the recommendation and its call to action in separate text-box surfaces", copy)
        self.assertIn("mutually exclusive states of the same component", evals)

    def test_title_fit_and_tracker_label_continuity_are_explicit(self):
        design = (ROOT / "src" / "design" / "index.md").read_text().lower()
        text_box = (ROOT / "src" / "components" / "text-box.md").read_text().lower()
        components = (ROOT / "src" / "components" / "index.md").read_text().lower()
        trackers = (ROOT / "src" / "components" / "trackers" / "index.md").read_text().lower()
        evals = (ROOT / "evals" / "index.md").read_text().lower()

        self.assertIn("keep the registered title role at one font size", design)
        self.assertIn("exact same deck-level `x` and `y` anchor", design)
        self.assertIn("prevents a lone orphaned word", text_box)
        self.assertIn("same top-left starting point on every slide", components)
        self.assertIn("move the title separator and every dependent content-top anchor down", components)
        self.assertIn("label-bearing variant cannot appear intermittently", trackers)
        self.assertIn("label-bearing tracker variant", evals)

    def test_commercial_dd_mode_and_coverage_are_explicit(self):
        template = (ROOT / "src" / "templates" / "commercial-due-diligence.md").read_text().lower()
        evals = (ROOT / "evals" / "index.md").read_text().lower()

        self.assertIn("full commercial due diligence", template)
        self.assertIn("red-flag commercial due diligence", template)
        self.assertIn("preliminary public-source commercial screen", template)
        self.assertIn("template-coverage ledger", template)
        self.assertIn("never silently downgrade", template)
        self.assertIn("missing-data statement never counts as completed analysis", evals)

    def test_dot_dash_is_slide_complete_and_owner_approved(self):
        skill = (ROOT / "SKILL.md").read_text().lower()
        source_guide = (ROOT / "src" / "index.md").read_text().lower()
        dot_dash = (ROOT / "src" / "storylining" / "dot-dash.md").read_text().lower()
        storylining = (ROOT / "src" / "storylining" / "index.md").read_text().lower()
        copy = (ROOT / "src" / "components" / "copy.md").read_text().lower()
        evals = (ROOT / "evals" / "index.md").read_text().lower()

        self.assertIn("one supported dot per planned slide", skill)
        self.assertIn("do not create a slide document", source_guide)
        self.assertIn("represent every planned slide in production order with exactly one dot", dot_dash)
        self.assertIn("every dot must contain at least one substantive dash", dot_dash)
        self.assertIn("gather feedback", dot_dash)
        self.assertIn("until the owner explicitly approves it", dot_dash)
        self.assertIn("before any slide document", storylining)
        self.assertIn("most decision-relevant supported comparison", copy)
        self.assertIn("every planned slide maps to exactly one sequenced dot", evals)


if __name__ == "__main__":
    unittest.main()
