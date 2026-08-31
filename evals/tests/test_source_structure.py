from __future__ import annotations

import json
import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PLUGIN_ROOT = "."
SKILL_ROOT = "skills/professional-slides"


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def relative_luminance(hex_colour: str) -> float:
    channels = [int(hex_colour[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(first: str, second: str) -> float:
    light, dark = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


class SourceStructureTests(unittest.TestCase):
    def test_repository_eval_harness_has_one_top_level_owner(self):
        self.assertFalse((ROOT / "scripts").exists())
        self.assertFalse((ROOT / "tests").exists())
        self.assertTrue((ROOT / "evals" / "scripts" / "prepare_eval_run.py").is_file())
        self.assertTrue((ROOT / "evals" / "tests" / "test_run_evals.py").is_file())

    def test_every_source_directory_has_an_index(self):
        missing = [
            path.relative_to(ROOT).as_posix()
            for path in (ROOT / SKILL_ROOT / "references").rglob("*")
            if path.is_dir() and not (path / "index.md").is_file()
        ]
        self.assertEqual(missing, [])

    def test_plugin_manifest_exposes_the_canonical_skill(self):
        manifest = json.loads(read(f"{PLUGIN_ROOT}/.codex-plugin/plugin.json"))
        self.assertEqual(manifest["name"], "professional-slides")
        self.assertEqual(manifest["skills"], "./skills/")
        self.assertTrue((ROOT / SKILL_ROOT / "SKILL.md").is_file())
        self.assertEqual(list(ROOT.glob("SKILL.md")), [])

    def test_entrypoint_is_short_and_routes_to_owners(self):
        skill = read(f"{SKILL_ROOT}/SKILL.md").lower()
        self.assertLess(len(skill.split()), 1000)
        for mode in ("new_deck", "existing_deck_revision", "slide_revision"):
            self.assertIn(mode, skill)
        for target in (
            "references/templates/index.md",
            "references/storylining/index.md",
            "references/design/index.md",
            "references/theming/index.md",
            "references/components/index.md",
            "references/slide-types/index.md",
            "references/charts/index.md",
            "references/tools/index.md",
            "references/evaluation/index.md",
        ):
            self.assertIn(target, skill)
        self.assertIn("before creating any slide document", skill)
        self.assertIn("edit only the requested slides", skill)

    def test_core_guides_have_simple_language_budgets(self):
        limits = {
            f"{SKILL_ROOT}/references/design/index.md": 1800,
            f"{SKILL_ROOT}/references/templates/commercial-due-diligence.md": 2200,
            f"{SKILL_ROOT}/references/templates/project-progress-update.md": 1400,
            f"{SKILL_ROOT}/references/templates/startup-pitch-deck.md": 1400,
            f"{SKILL_ROOT}/references/components/trackers/index.md": 900,
            f"{SKILL_ROOT}/references/components/copy.md": 900,
            f"{SKILL_ROOT}/references/slide-types/executive-synthesis.md": 650,
            f"{SKILL_ROOT}/references/storylining/index.md": 900,
            f"{SKILL_ROOT}/references/storylining/dot-dash.md": 800,
            f"{SKILL_ROOT}/references/storylining/pre-authoring-contract.md": 650,
            f"{SKILL_ROOT}/references/evaluation/index.md": 1600,
        }
        over = {
            path: len(read(path).split())
            for path, limit in limits.items()
            if len(read(path).split()) > limit
        }
        self.assertEqual(over, {})

    def test_design_delegates_values_and_keeps_stable_titles(self):
        design = read(f"{SKILL_ROOT}/references/design/index.md").lower()
        self.assertIn("../theming/index.md", design)
        self.assertIn("../theming/tokens.md", design)
        self.assertIn("one identical component-primary swatch", design)
        self.assertIn("exact same deck-level", design)
        self.assertIn("one-line and two-line titles start at the same point", design)
        self.assertIn("do not impose the same card grid", design)

    def test_theming_contract_covers_families_density_and_component_variables(self):
        theming_root = ROOT / SKILL_ROOT / "references" / "theming"
        index = (theming_root / "index.md").read_text(encoding="utf-8").lower()
        tokens = (theming_root / "tokens.md").read_text(encoding="utf-8").lower()
        bindings = (theming_root / "component-bindings.md").read_text(encoding="utf-8").lower()
        html_contract = (theming_root / "html-css-contract.md").read_text(encoding="utf-8").lower()

        for family in ("executive-light", "executive-dark", "warm-editorial", "reference-derived"):
            self.assertIn(family, index)
            self.assertIn(family, tokens)
        for density in ("live-pitch", "executive", "pre-read", "appendix"):
            self.assertIn(density, index)
            self.assertIn(f'data-density="{density}"', tokens)
        for token in (
            "--component-primary",
            "--component-primary-tint",
            "--page-guideline",
            "--divider-rule",
            "--status-positive",
            "--status-caution",
            "--status-negative",
            "--chart-series-1",
            "--chart-series-6",
            "--type-action-title",
            "--space-10",
            "--component-radius",
            "--component-shadow",
        ):
            self.assertIn(token, tokens)
        for component in (
            "action-title block",
            "terminal action surface",
            "metric field",
            "data table",
            "chart plot",
            "chart callout",
            "comparison indicator",
            "diagram node",
            "semantic icon",
            "logo backing",
            "image frame",
        ):
            self.assertIn(component, bindings)
        self.assertIn("namespaced aliases are the component api", html_contract)
        self.assertIn("component css may not contain", html_contract)

        theming_sources = "\n".join(path.read_text(encoding="utf-8") for path in theming_root.glob("*.md"))
        declared = set(re.findall(r"(--[a-z0-9-]+)\s*:", theming_sources))
        consumed = set()
        for path in (ROOT / SKILL_ROOT / "references").rglob("*.md"):
            consumed.update(re.findall(r"var\((--[a-z0-9-]+)", path.read_text(encoding="utf-8")))
        instance_variables = {"--bottom", "--height", "--series", "--share", "--size", "--value", "--x", "--y"}
        self.assertEqual(consumed - declared - instance_variables, set())

    def test_native_theme_palettes_are_complete_and_readable(self):
        tokens = read(f"{SKILL_ROOT}/references/theming/tokens.md").lower()
        required = {
            "canvas",
            "surface-1",
            "surface-2",
            "surface-inverse",
            "ink",
            "text-secondary",
            "muted-ink",
            "on-primary",
            "on-inverse",
            "component-primary",
            "component-primary-tint",
            "page-guideline",
            "divider-rule",
            "chart-gridline",
            "chart-segment",
            "status-positive",
            "status-positive-tint",
            "status-caution",
            "status-caution-tint",
            "status-negative",
            "status-negative-tint",
            "status-info",
            "status-info-tint",
            "chart-series-1",
            "chart-series-2",
            "chart-series-3",
            "chart-series-4",
            "chart-series-5",
            "chart-series-6",
        }
        for theme in ("executive-light", "executive-dark", "warm-editorial"):
            match = re.search(rf'\.deck\[data-theme="{theme}"\]\s*\{{(.*?)\n\}}', tokens, re.DOTALL)
            self.assertIsNotNone(match)
            palette = dict(re.findall(r"--([a-z0-9-]+):\s*(#[0-9a-f]{6})", match.group(1)))
            self.assertEqual(required - set(palette), set())
            for foreground in ("ink", "text-secondary", "muted-ink"):
                self.assertGreaterEqual(contrast_ratio(palette[foreground], palette["canvas"]), 4.5)
            self.assertGreaterEqual(contrast_ratio(palette["on-primary"], palette["component-primary"]), 4.5)

    def test_executive_summary_is_a_distinct_synthesis_type(self):
        executive = read(f"{SKILL_ROOT}/references/slide-types/executive-synthesis.md").lower()
        for phrase in (
            "distinct slide type",
            "not an agenda",
            "two to four supporting branches",
            "proof for each branch",
            "decision consequence",
            "one overall action",
            "visible structural label **executive summary**",
        ):
            self.assertIn(phrase, executive)
        self.assertIn("do not add a tracker", executive)

    def test_trackers_are_optional_navigation_only(self):
        trackers = read(f"{SKILL_ROOT}/references/components/trackers/index.md").lower()
        self.assertIn("where are we in the deck", trackers)
        self.assertIn("never an executive summary", trackers)
        self.assertIn("default to no visible tracker", trackers)
        self.assertIn("never place a tracker on the executive-summary slide", trackers)
        self.assertIn("label-bearing variant cannot appear intermittently", trackers)
        self.assertIn("do not use chart-series colours", trackers)
        self.assertIn("parent and chapter hierarchy", trackers)
        self.assertIn("parent ids equal section ids", trackers)
        self.assertIn("chapter-item ids equal analytical subgroup ids", trackers)

    def test_copy_is_direct_and_forbids_em_dashes(self):
        copy = read(f"{SKILL_ROOT}/references/components/copy.md").lower()
        self.assertIn("state the answer, not the topic", copy)
        self.assertIn("most decision-relevant supported comparison", copy)
        self.assertIn("role label on a callout or terminal action surface is presumptively slop", copy)
        self.assertIn("audience-facing copy must contain zero em dashes", copy)
        self.assertIn("no quotation, official-name, source-wording, or parenthetical exceptions", copy)
        self.assertIn("repeat the scan until it returns zero matches", copy)

    def test_dot_dash_is_complete_and_approved(self):
        dot_dash = read(f"{SKILL_ROOT}/references/storylining/dot-dash.md").lower()
        storylining = read(f"{SKILL_ROOT}/references/storylining/index.md").lower()
        example = read(f"{SKILL_ROOT}/references/storylining/dot-dash-example.md").lower()
        self.assertIn("represent every planned slide in production order with exactly one dot", dot_dash)
        self.assertIn("every dot must contain at least one substantive dash", dot_dash)
        self.assertIn("tracker and section map", dot_dash)
        self.assertIn("until the owner explicitly approves it", dot_dash)
        self.assertIn("before any slide document is created", storylining)
        self.assertIn("slide-by-slide model", dot_dash)
        self.assertIn("parent tracker", storylining)
        self.assertIn("chapter tracker", storylining)
        self.assertIn("slidescience.co/storytelling-in-powerpoint", example)
        self.assertIn("## complete dot-dash", example)
        self.assertEqual(example.count("**dot:**"), 16)
        self.assertIn("parent tracker order equals dot-dash section order", example)

    def test_contract_supports_untracked_and_existing_decks(self):
        contract = read(f"{SKILL_ROOT}/references/storylining/pre-authoring-contract.md").lower()
        for phrase in (
            "tracker.system none",
            "sourceslidecount",
            "recommended_not_forced",
            "do not force a new executive summary",
            "validate before any slide document is created",
            "hierarchical-segmented",
            "parent-tracker-label",
            "chapter-tracker-label",
        ):
            self.assertIn(phrase, contract)

    def test_commercial_dd_preserves_the_decision_architecture(self):
        template = read(f"{SKILL_ROOT}/references/templates/commercial-due-diligence.md").lower()
        for phrase in (
            "full commercial due diligence",
            "red-flag commercial due diligence",
            "preliminary public-source commercial screen",
            "never silently downgrade",
            "market attractiveness",
            "customer quality",
            "competitive position",
            "commercial engine",
            "plan and downside",
            "template-coverage ledger",
            "decision cutoff date",
            "later validation",
            "hindsight",
        ):
            self.assertIn(phrase, template)

    def test_specialized_templates_use_shared_owners(self):
        for relative in (
            f"{SKILL_ROOT}/references/templates/commercial-due-diligence.md",
            f"{SKILL_ROOT}/references/templates/project-progress-update.md",
            f"{SKILL_ROOT}/references/templates/startup-pitch-deck.md",
        ):
            source = read(relative)
            self.assertIn("../slide-types/index.md", source)
            self.assertIn("../storylining/pre-authoring-contract.md", source)

    def test_evaluation_keeps_fresh_run_and_non_compensating_gates(self):
        evals = read(f"{SKILL_ROOT}/references/evaluation/index.md").lower()
        self.assertIn("completely clearing only", evals)
        self.assertIn("never copy, seed, patch, or resume", evals)
        self.assertIn("prior generated eval materials are not inputs", evals)
        self.assertIn("every slide passes the full-size anti-slop audit", evals)
        self.assertIn("one major defect blocks release", evals)
        self.assertIn("the mean cannot compensate for a weak dimension", evals)
        self.assertIn("release-blocking defect with no exceptions", evals)

    def test_tmp_is_root_ignored_and_untracked(self):
        patterns = {
            line.strip()
            for line in read(".gitignore").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        }
        self.assertIn("/tmp/", patterns)

        if (ROOT / ".git").exists():
            tracked = subprocess.run(
                ["git", "ls-files", "tmp", "tmp/**"],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            self.assertEqual(tracked, "")

            ignored = subprocess.run(
                ["git", "check-ignore", "-q", "tmp/probe.txt"],
                cwd=ROOT,
                check=False,
            )
            self.assertEqual(ignored.returncode, 0)

    def test_eval_thresholds_remain_strict(self):
        cases = json.loads(read("evals/cases.json"))
        self.assertEqual(cases["thresholds"]["selfScoreMinimum"], 98)
        self.assertEqual(cases["thresholds"]["treatmentScoreMinimum"], 98)
        self.assertEqual(cases["thresholds"]["minimumDimensionScore"], 4.9)
        self.assertEqual(cases["thresholds"]["maximumMinorDefects"], 0)

    def test_template_registry_covers_every_template(self):
        templates_root = ROOT / SKILL_ROOT / "references" / "templates"
        registry = json.loads((templates_root / "registry.json").read_text(encoding="utf-8"))
        registered = {entry["file"] for entry in registry["templates"]}
        files = {
            path.name
            for path in templates_root.glob("*.md")
            if path.name not in {"index.md", "authoring.md"}
        }
        self.assertEqual(registered, files)
        self.assertEqual(len(registered), len(registry["templates"]))

    def test_runtime_skill_contains_only_instructions_and_references(self):
        skill_root = ROOT / SKILL_ROOT
        self.assertFalse((skill_root / "scripts").exists())
        self.assertNotIn("scripts/", (skill_root / "SKILL.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
