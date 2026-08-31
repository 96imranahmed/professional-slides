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

    def test_redundant_role_labels_are_major_slop_defects(self):
        import json

        skill = (ROOT / "SKILL.md").read_text().lower()
        copy = (ROOT / "src" / "components" / "copy.md").read_text().lower()
        text_box = (ROOT / "src" / "components" / "text-box.md").read_text().lower()
        components = (ROOT / "src" / "components" / "index.md").read_text().lower()
        evals = (ROOT / "evals" / "index.md").read_text().lower()
        cases = json.loads((ROOT / "evals" / "cases.json").read_text())

        self.assertIn("visible role label on a callout", skill)
        self.assertIn("a role label on a callout or terminal action surface is presumptively slop", copy)
        self.assertIn("do not reserve a separate label column", text_box)
        self.assertIn("do not prepend `ic conclusion`", components)
        self.assertIn("redundant role label or reserved label column", evals)
        self.assertIn("redundant_role_label", cases["majorDefects"])

    def test_title_fit_and_tracker_label_continuity_are_explicit(self):
        design = (ROOT / "src" / "design" / "index.md").read_text().lower()
        text_box = (ROOT / "src" / "components" / "text-box.md").read_text().lower()
        components = (ROOT / "src" / "components" / "index.md").read_text().lower()
        trackers = (ROOT / "src" / "components" / "trackers" / "index.md").read_text().lower()
        evals = (ROOT / "evals" / "index.md").read_text().lower()

        self.assertIn("keep the registered title role at one font size", design)
        self.assertIn("exact same deck-level `x` and `y` anchor", design)
        self.assertIn("tracked analytical-header template", design)
        self.assertIn("prevents a lone orphaned word", text_box)
        self.assertIn("same top-left starting point on every slide", components)
        self.assertIn("both a `tracker-label` slot", components)
        self.assertIn("move the title separator and every dependent content-top anchor down", components)
        self.assertIn("label-bearing variant cannot appear intermittently", trackers)
        self.assertIn("do not concatenate a subsection", trackers)
        self.assertIn("both its tracker-label and action-title fields", evals)
        self.assertIn("cross-slide consistency pass", evals)
        self.assertIn("compare the actual tracker-label text with the active tracker record", evals)

    def test_commercial_dd_mode_and_coverage_are_explicit(self):
        template = (ROOT / "src" / "templates" / "commercial-due-diligence.md").read_text().lower()
        evals = (ROOT / "evals" / "index.md").read_text().lower()

        self.assertIn("full commercial due diligence", template)
        self.assertIn("red-flag commercial due diligence", template)
        self.assertIn("preliminary public-source commercial screen", template)
        self.assertIn("template-coverage ledger", template)
        self.assertIn("never silently downgrade", template)
        self.assertIn("missing-data statement never counts as completed analysis", evals)

    def test_retrospective_dd_separates_decision_date_from_hindsight(self):
        template = (ROOT / "src" / "templates" / "commercial-due-diligence.md").read_text().lower()

        for required in ("retrospective commercial diligence", "decision cutoff date", "later validation", "hindsight"):
            self.assertIn(required, template)

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

    def test_pre_authoring_contract_distinguishes_new_and_existing_decks(self):
        skill = (ROOT / "SKILL.md").read_text().lower()
        source_guide = (ROOT / "src" / "index.md").read_text().lower()
        storylining = (ROOT / "src" / "storylining" / "index.md").read_text().lower()
        dot_dash = (ROOT / "src" / "storylining" / "dot-dash.md").read_text().lower()
        contract = (ROOT / "src" / "storylining" / "pre-authoring-contract.md").read_text().lower()
        evals = (ROOT / "evals" / "index.md").read_text().lower()

        self.assertIn("classify the work as `new_deck` or `existing_deck_revision`", skill)
        self.assertIn("exactly one sequenced dot for every source slide", source_guide)
        self.assertIn("owner approval of the as-is inventory is not a prerequisite", storylining)
        self.assertIn("recommend one but do not insert it", dot_dash)
        self.assertIn("recommended_not_forced", contract)
        self.assertIn("do not force a new executive summary", contract)
        self.assertIn("`sourceslidecount`", contract)
        self.assertIn("pre_authoring_gate_bypassed", evals)
        self.assertIn("missing executive summary is not a defect by itself", evals)

    def test_structural_html_specimens_are_routed_and_non_raster(self):
        skill = (ROOT / "SKILL.md").read_text().lower()
        specimen_contract = (ROOT / "src" / "design" / "html-specimens.md").read_text().lower()
        trackers = (ROOT / "src" / "components" / "trackers" / "index.md").read_text().lower()
        executive_synthesis = (ROOT / "src" / "slide-types" / "executive-synthesis.md").read_text().lower()

        self.assertIn("structural html specimen", skill)
        self.assertIn("do not embed a png", specimen_contract)
        self.assertIn("1280 × 720", specimen_contract)
        for tracker_class in ("tracker--top", "tracker--sidebar", "tracker--grid", "tracker--badged-list", "tracker--segmented"):
            self.assertIn(tracker_class, trackers)
        self.assertNotIn("border-inline-start", executive_synthesis)

    def test_density_modes_and_specialized_profiles_are_explicit(self):
        design = (ROOT / "src" / "design" / "index.md").read_text().lower()
        slide_types = (ROOT / "src" / "slide-types" / "index.md").read_text().lower()
        template_router = (ROOT / "src" / "templates" / "index.md").read_text().lower()
        commercial_dd = (ROOT / "src" / "templates" / "commercial-due-diligence.md").read_text().lower()

        for mode in ("live pitch", "executive presentation", "executive pre-read", "analytical appendix"):
            self.assertIn(mode, design)
        for profile in ("metric page", "category overview", "market landscape", "project status"):
            self.assertIn(profile, slide_types)
        self.assertIn("project-progress-update.md", template_router)
        self.assertIn("a table-only core deck is a major design and analysis defect", commercial_dd)

    def test_specialized_templates_route_slide_types_without_local_aliases(self):
        import re

        template_router = (ROOT / "src" / "templates" / "index.md").read_text().lower()
        templates = (
            ROOT / "src" / "templates" / "project-progress-update.md",
            ROOT / "src" / "templates" / "startup-pitch-deck.md",
        )

        self.assertIn("do not create template-local slide-type codes", template_router)
        for path in templates:
            source = path.read_text()
            self.assertIn("../slide-types/index.md", source)
            self.assertIn("../storylining/pre-authoring-contract.md", source)
            self.assertNotRegex(source, r"(?im)^\|\s*code\s*\|")
            self.assertIsNone(re.search(r"`(?:SYN|DEC|CLI|TLI|AWC|CMP|PRO|ACT)(?:-[A-Z]+)?`", source))
            for target in re.findall(r"\[[^]]+\]\(([^)]+)\)", source):
                relative_target = target.split("#", 1)[0]
                if relative_target and "://" not in relative_target:
                    self.assertTrue((path.parent / relative_target).resolve().exists(), f"{path}: missing {target}")

    def test_dd_release_gates_cover_observed_visual_failures(self):
        executive = (ROOT / "src" / "slide-types" / "executive-synthesis.md").read_text().lower()
        trackers = (ROOT / "src" / "components" / "trackers" / "index.md").read_text().lower()
        logos = (ROOT / "src" / "components" / "icons-and-logos.md").read_text().lower()
        commercial_dd = (ROOT / "src" / "templates" / "commercial-due-diligence.md").read_text().lower()
        evals = (ROOT / "evals" / "index.md").read_text().lower()

        self.assertIn("visible structural label **executive summary**", executive)
        self.assertIn("above roughly twelve slides", trackers)
        self.assertIn("segmented full-state system", trackers)
        self.assertIn("keep analytical pages free of the four-segment rail", trackers)
        self.assertIn("non-blank", logos)
        self.assertIn("two to four mutually supporting evidence regions", commercial_dd)
        self.assertIn("under-composed core analytical canvas", evals)

    def test_harsh_quality_gate_blocks_compensating_scores(self):
        import json

        cases = json.loads((ROOT / "evals" / "cases.json").read_text())
        evals = (ROOT / "evals" / "index.md").read_text().lower()
        self.assertEqual(cases["thresholds"]["minimumDimensionScore"], 4.9)
        self.assertEqual(cases["thresholds"]["maximumMinorDefects"], 0)
        self.assertIn("wrong_navigation_system", cases["majorDefects"])
        self.assertIn("broken_asset_render", cases["majorDefects"])
        self.assertIn("the mean cannot compensate for a weak dimension", evals)
        self.assertIn("analytical tables are composed exhibits rather than raw spreadsheet grids", evals)
        self.assertIn("bottom-anchored", evals)
        self.assertIn("every slide must pass the full-size anti-slop audit", evals)

    def test_evaluation_threshold_targets_ninety_eight(self):
        import json

        cases = json.loads((ROOT / "evals" / "cases.json").read_text())
        self.assertEqual(cases["thresholds"]["selfScoreMinimum"], 98)
        self.assertEqual(cases["thresholds"]["treatmentScoreMinimum"], 98)


if __name__ == "__main__":
    unittest.main()
