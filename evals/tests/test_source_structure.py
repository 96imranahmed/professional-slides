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
        self.assertIn("prefer one variant for each recurring component or semantic relationship across the deck", skill)
        self.assertIn("a consistency default, not a hard constraint", skill)

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
            f"{SKILL_ROOT}/references/storylining/dot-dash.md": 1800,
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

    def test_slide_layouts_are_a_separate_registered_design_axis(self):
        skill = read(f"{SKILL_ROOT}/SKILL.md").lower()
        design = read(f"{SKILL_ROOT}/references/design/index.md").lower()
        slide_types = read(f"{SKILL_ROOT}/references/slide-types/index.md").lower()
        layouts = read(f"{SKILL_ROOT}/references/design/slide-layouts.md").lower()
        bindings = read(f"{SKILL_ROOT}/references/theming/component-bindings.md").lower()

        self.assertIn("[slide layouts](references/design/slide-layouts.md)", skill)
        self.assertIn("[slide-layout router](slide-layouts.md)", design)
        self.assertIn("[slide layout](../design/slide-layouts.md)", slide_types)
        self.assertIn("layouts own page-level region geometry only", design)
        self.assertIn("they do not define the narrative job", layouts)
        self.assertIn("if the two halves contain genuinely unrelated claims, they belong on separate slides", layouts)
        self.assertEqual(layouts.count('<main class="deck"'), 6)
        for variant in (
            "cover-split-50-50",
            "section-split-50-50",
            "context-detail-20-80",
            "soft-split-50-50",
            "full-field",
            "implication-split",
        ):
            self.assertIn(f'data-layout="{variant}"', layouts)
        for slot in ("primary", "secondary", "context", "evidence", "inference", "implication"):
            self.assertIn(f'data-slot="{slot}"', layouts)
        self.assertIn("| slide layout frame |", bindings)
        self.assertIn("--slide-layout-region-padding", bindings)
        self.assertNotRegex(layouts, r"#[0-9a-f]{3,8}\\b")
        self.assertNotIn("—", layouts)

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
            "| description slide |",
            "description with implication",
            "| arrow |",
            "metric field",
            "data table",
            "chart plot",
            "chart callout",
            "comparison indicator",
            "| item indicator |",
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
            "on-status-positive",
            "status-caution",
            "status-caution-tint",
            "status-negative",
            "status-negative-tint",
            "on-status-negative",
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
            self.assertGreaterEqual(contrast_ratio(palette["on-status-positive"], palette["status-positive"]), 4.5)
            self.assertGreaterEqual(contrast_ratio(palette["on-status-negative"], palette["status-negative"]), 4.5)

    def test_table_cell_status_components_define_palettes_and_mandatory_legends(self):
        components = read(f"{SKILL_ROOT}/references/components/index.md").lower()
        indicators = read(f"{SKILL_ROOT}/references/components/comparison-indicators.md").lower()
        bindings = read(f"{SKILL_ROOT}/references/theming/component-bindings.md").lower()
        tokens = read(f"{SKILL_ROOT}/references/theming/tokens.md").lower()
        evaluation = read(f"{SKILL_ROOT}/references/evaluation/index.md").lower()

        self.assertIn("table cell status and comparison indicators", components)
        for variant in ("completion", "traffic-light", "heatmap"):
            self.assertIn(f'data-variant="{variant}"', indicators)
        for palette in ("theme-sequential", "theme-status", "red-white-green", "red-white"):
            self.assertIn(f'data-palette="{palette}"', indicators)
        self.assertIn('class="table-cell-status__spinner"', indicators)
        self.assertGreaterEqual(indicators.count('class="table-cell-status__legend"'), 2)
        self.assertGreaterEqual(indicators.count("same-slide legend"), 3)
        self.assertIn("aria-describedby=\"forecast-status-legend\"", indicators)
        self.assertIn("aria-describedby=\"evidence-score-legend\"", indicators)
        self.assertIn("the legend is mandatory", indicators)
        self.assertIn("--table-cell-heat-1", bindings)
        self.assertIn("--table-cell-legend-rule", bindings)
        for level in range(1, 6):
            self.assertIn(f"--heatmap-primary-{level}", tokens)
        self.assertIn("every traffic-light table and heatmap includes a readable same-slide legend", evaluation)
        self.assertNotRegex(indicators, r"#[0-9a-f]{3,8}\\b")
        self.assertNotIn("—", indicators)

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
        self.assertIn("do not add a subtitle", executive)
        self.assertNotIn('class="subtitle"', executive)
        self.assertEqual(executive.count('<main class="deck"'), 3)
        for variant in ("one-column", "two-column", "three-column"):
            self.assertIn(f'data-variant="{variant}"', executive)
        self.assertEqual(executive.count("<h1>executive summary</h1>"), 3)
        self.assertIn("--executive-synthesis-columns", executive)
        self.assertIn('data-heading-style="text"', executive)
        self.assertIn('data-heading-style="underline"', executive)
        self.assertIn("branches are open, borderless, and backgroundless", executive)
        self.assertNotIn("border-top:var(--executive-synthesis-heading-rule)", executive)
        self.assertNotIn("executive-synthesis__action", executive)
        self.assertEqual(executive.count('class="insight-box"'), 3)
        bindings = read(f"{SKILL_ROOT}/references/theming/component-bindings.md").lower()
        self.assertIn("| executive synthesis |", bindings)

    def test_insight_box_is_shared_and_exposes_orthogonal_variants(self):
        index = read(f"{SKILL_ROOT}/references/components/index.md").lower()
        insight = read(f"{SKILL_ROOT}/references/components/insight-box.md").lower()
        executive = read(f"{SKILL_ROOT}/references/slide-types/executive-synthesis.md").lower()
        metrics = read(f"{SKILL_ROOT}/references/components/metric-fields.md").lower()
        status = read(f"{SKILL_ROOT}/references/slide-types/project-status.md").lower()

        self.assertIn("[insight boxes](insight-box.md)", index)
        self.assertIn("a section may have no more than one insight box", index)
        self.assertIn("use at most one insight box per section", insight)
        self.assertIn("never repeat the component once per column", insight)
        self.assertIn("consolidate them into one governing synthesis or split the page", insight)
        self.assertIn("text is centered horizontally and vertically by default", insight)
        self.assertIn("full-width box may use left-aligned text", insight)
        self.assertIn("--insight-box-border:0", insight)
        self.assertIn("filled variants have no border", insight)
        self.assertIn("body copy uses regular font weight", insight)
        self.assertIn("--insight-box-font:var(--weight-regular)", insight)
        self.assertIn("--insight-box-padding-y-multi", insight)
        self.assertIn('data-content="multi-paragraph"', insight)
        self.assertIn('data-divider="between-sections"', insight)
        self.assertIn('class="insight-box__header"', insight)
        self.assertIn("--insight-box-dotted-border", insight)
        self.assertEqual(insight.count('<main class="deck"'), 5)
        for variant in ("tonal", "neutral", "dotted", "primary"):
            self.assertIn(f'data-variant="{variant}"', executive + insight)
        for consumer in (executive, metrics, status):
            self.assertIn('class="insight-box"', consumer)

    def test_quote_cluster_supports_counts_and_sectional_placement(self):
        components = read(f"{SKILL_ROOT}/references/components/index.md").lower()
        quotes = read(f"{SKILL_ROOT}/references/components/quote-cluster.md").lower()
        bindings = read(f"{SKILL_ROOT}/references/theming/component-bindings.md").lower()

        self.assertIn("[quote clusters](quote-cluster.md)", components)
        self.assertIn("it is an evidence component, not a narrative archetype or a slide layout", quotes)
        self.assertEqual(quotes.count('<main class="deck"'), 5)
        for variant in ("one-up", "two-up", "three-up", "four-up", "five-up"):
            self.assertIn(f'data-variant="{variant}"', quotes)
        for placement in ("full-field", "section"):
            self.assertIn(f'data-placement="{placement}"', quotes)
        self.assertIn('data-layout="soft-split-50-50"', quotes)
        self.assertIn('data-variant="two-up" data-placement="section"', quotes)
        self.assertIn("six equal internal tracks", quotes)
        for treatment in ("callout", "contained"):
            self.assertIn(f'data-treatment="{treatment}"', quotes)
        self.assertNotIn('data-treatment="open"', quotes)
        self.assertNotIn("border-top: var(--quote-item-border)", quotes)
        self.assertIn('data-attribution-align="left"', quotes)
        self.assertIn('data-avatar="true"', quotes)
        self.assertEqual(quotes.count('class="quote-cluster__avatar"'), 5)
        self.assertEqual(quotes.count("quote-cluster__mark quote-cluster__mark--close"), 15)
        self.assertIn("align-content: center", quotes)
        self.assertNotIn("margin-top: auto", quotes)
        self.assertIn("blockquote::after", quotes)
        self.assertIn("rounded enclosure containing the quote body and attribution", bindings)
        self.assertIn("| quote cluster |", bindings)
        self.assertIn("--quote-cluster-columns", bindings)
        self.assertIn("--quote-caret-size", bindings)
        self.assertIn("--quote-caret-angle", bindings)
        self.assertIn("--quote-avatar-size", bindings)
        self.assertIn("the line-only quote treatment is not registered", bindings)
        self.assertNotRegex(quotes, r"#[0-9a-f]{3,8}\b")
        self.assertNotIn("—", quotes)

    def test_description_slide_owns_variable_detail_and_embedded_indicator_variants(self):
        index = read(f"{SKILL_ROOT}/references/slide-types/index.md").lower()
        description = read(f"{SKILL_ROOT}/references/slide-types/description.md").lower()
        category_visuals = read(f"{SKILL_ROOT}/references/components/icons-and-logos.md").lower()

        self.assertIn("[description slide](description.md)", index)
        self.assertIn("base slide type", description)
        self.assertIn("description ledger", description)
        self.assertIn("## structural html reference", description)
        self.assertIn("var(--type-column-heading)", description)
        self.assertIn("same size and line height as compact body text", description)
        self.assertNotIn("--description-slide-heading-font: var(--type-section-heading)", description)
        for variant in (
            "trend-with-examples",
            "icon-label-narrative",
            "label-only-narrative",
            "embedded-indicator-narrative",
        ):
            self.assertIn(f'data-variant="{variant}"', description)
        for family in ("executive-light", "executive-dark", "warm-editorial"):
            self.assertIn(f'data-theme="{family}"', description)
        for count in ("1", "2", "3"):
            self.assertIn(f'data-detail-columns="{count}"', description)
        self.assertIn('data-content-density="dense"', description)
        self.assertIn('data-placement="embedded-start"', description)
        self.assertIn("never changes `.action-title`", description)
        self.assertIn(".description-slide__row:last-of-type { border-bottom: 0; }", description)
        self.assertIn("the final row has no bottom divider", description)
        for treatment in ("icon-only", "image-only", "icon-image"):
            self.assertIn(treatment, description)
            self.assertIn(treatment, category_visuals)
        self.assertIn('data-visual-treatment="icon-image"', category_visuals)
        self.assertIn('class="category__image"', category_visuals)
        self.assertIn("perform distinct jobs", category_visuals)
        self.assertIn("replaceable native image object", description)
        self.assertIn("every row shares one vertical centerline", description)
        self.assertIn("align-items: center", description)
        self.assertIn("padding-block: var(--description-slide-row-padding)", description)
        self.assertIn("align-self: stretch", description)
        self.assertEqual(description.count('<main class="deck"'), 4)
        self.assertFalse((ROOT / SKILL_ROOT / "references/slide-types/description-slide.md").exists())
        self.assertFalse((ROOT / SKILL_ROOT / "references/slide-types/category-overview.md").exists())
        self.assertNotIn("diagnostic-to-impact", description)
        self.assertNotRegex(description, r"#[0-9a-f]{3,8}\\b")
        self.assertNotIn("—", description)
        self.assertNotIn("—", category_visuals)

    def test_description_with_implication_inherits_description_slide_and_owns_specimens(self):
        index = read(f"{SKILL_ROOT}/references/slide-types/index.md").lower()
        owner = read(f"{SKILL_ROOT}/references/slide-types/description-with-implication.md").lower()

        self.assertIn("description-with-implication.md", index)
        for phrase in (
            "explicitly inherits from [`description slide`](description.md)",
            "## inheritance contract",
            "start with a valid description slide row",
            "adds one mandatory inference arrow",
            "text-led implication",
            "process and roadmap",
            "the default treatment is `open`",
            "very light gray",
        ):
            self.assertIn(phrase, owner)
        for variant in (
            "labeled-findings-to-implication",
            "numbered-description-to-implication",
            "embedded-indicator-description-to-implication",
        ):
            self.assertIn(f'data-variant="{variant}"', owner)
        for treatment in ("open", "subtle"):
            self.assertIn(f'data-implication-treatment="{treatment}"', owner)
        self.assertIn('class="description-slide description-implication"', owner)
        self.assertIn('class="description-slide__row description-implication__row"', owner)
        self.assertIn('class="arrow description-implication__arrow-slot"', owner)
        self.assertIn('class="item-indicator description-implication__indicator-slot"', owner)
        self.assertIn('data-placement="column"', owner)
        self.assertIn('data-placement="embedded-start"', owner)
        self.assertIn('data-detail-columns="2"', owner)
        self.assertIn('data-content-density="dense"', owner)
        self.assertIn(".description-implication__head span:empty", owner)
        self.assertIn("border-bottom: 0", owner)
        self.assertIn(".description-implication__row:last-of-type { border-bottom: 0; }", owner)
        self.assertIn("the final row has no bottom divider", owner)
        self.assertIn("inherit the base row centerline", owner)
        self.assertIn("padding-block: var(--description-implication-row-padding)", owner)
        self.assertNotIn("padding-bottom: var(--description-implication-row-padding)", owner)
        self.assertIn("var(--surface-1)", owner)
        self.assertIn("var(--description-slide-gap)", owner)
        self.assertEqual(owner.count('<main class="deck"'), 3)
        self.assertFalse((ROOT / SKILL_ROOT / "references/slide-types/description-with-implication-specimens.md").exists())
        self.assertNotIn("var(--surface-action)", owner)
        self.assertNotIn("var(--component-primary-tint)", owner)
        self.assertNotRegex(owner, r"#[0-9a-f]{3,8}\\b")
        self.assertNotIn("—", owner)

    def test_arrows_are_a_reusable_component_with_four_registered_variants(self):
        components = read(f"{SKILL_ROOT}/references/components/index.md").lower()
        arrows = read(f"{SKILL_ROOT}/references/components/arrows.md").lower()
        implication = read(f"{SKILL_ROOT}/references/slide-types/description-with-implication.md").lower()

        self.assertIn("[arrows](arrows.md)", components)
        for variant in ("line", "wedge", "disc-chevron", "disc-multi-chevron"):
            self.assertIn(f'data-variant="{variant}"', arrows)
        self.assertEqual(arrows.count('<svg class="arrow"'), 4)
        self.assertIn("empty arrow header slots have no visible rule", arrows)
        self.assertEqual(implication.count('data-variant="disc-chevron"'), 14)
        self.assertNotIn('data-variant="line"', implication)
        self.assertIn("use `disc-chevron` by default", arrows)
        self.assertIn("--arrow-emphasis-size: var(--icon-md)", arrows)
        self.assertIn("--arrow-wide-size: var(--space-6)", arrows)
        self.assertIn("roughly one-third", arrows)
        self.assertNotIn("--description-implication-arrow-", implication)
        self.assertNotRegex(arrows, r"#[0-9a-f]{3,8}\\b")
        self.assertNotIn("—", arrows)

    def test_item_indicators_are_reusable_identity_marks_with_two_placements(self):
        components = read(f"{SKILL_ROOT}/references/components/index.md").lower()
        indicators = read(f"{SKILL_ROOT}/references/components/item-indicators.md").lower()
        description = read(f"{SKILL_ROOT}/references/slide-types/description.md").lower()
        implication = read(f"{SKILL_ROOT}/references/slide-types/description-with-implication.md").lower()

        self.assertIn("[item indicators](item-indicators.md)", components)
        for shape in ("square", "circle"):
            self.assertIn(f'data-shape="{shape}"', indicators)
        for placement in ("column", "embedded-start"):
            self.assertIn(f'data-placement="{placement}"', indicators)
        for contrast in ("accent-fill", "inverse-keyline"):
            self.assertIn(f'data-contrast="{contrast}"', indicators)
        self.assertRegex(indicators, r">(?:01|2|3)</span>")
        self.assertIn(">a</span>", indicators)
        self.assertIn("center it horizontally", indicators)
        self.assertIn("center it vertically", indicators)
        self.assertIn("line-height: 1", indicators)
        self.assertIn("text-align: center", indicators)
        self.assertIn("center the text box horizontally and vertically inside the shape", indicators)
        self.assertIn("comparison indicators", indicators)
        self.assertIn("arrows", indicators)
        self.assertIn('--item-indicator-accent-bg: var(--component-primary)', indicators)
        self.assertIn('--item-indicator-keyline: var(--line-hairline) solid var(--on-inverse)', indicators)
        self.assertEqual(description.count('data-placement="embedded-start" data-contrast="inverse-keyline"'), 4)
        self.assertNotIn('data-placement="embedded-start" data-contrast="accent-fill"', description)
        self.assertIn("preferred embedded number or letter treatment", indicators)
        self.assertEqual(implication.count('data-placement="embedded-start" data-contrast="inverse-keyline"'), 4)
        self.assertIn('data-placement="column"', implication)
        self.assertNotRegex(indicators, r"#[0-9a-f]{3,8}\\b")
        self.assertNotIn("—", indicators)

    def test_trackers_are_optional_navigation_only(self):
        trackers = read(f"{SKILL_ROOT}/references/components/trackers/index.md").lower()
        specimens = read(f"{SKILL_ROOT}/references/components/trackers/specimens.md").lower()
        self.assertIn("where are we in the deck", trackers)
        self.assertIn("never an executive summary", trackers)
        self.assertIn("default to no visible tracker", trackers)
        self.assertIn("never place a tracker on the executive-summary slide", trackers)
        self.assertIn("label-bearing variant cannot appear intermittently", trackers)
        self.assertIn("do not use chart-series colours", trackers)
        self.assertIn("parent and chapter hierarchy", trackers)
        self.assertIn("parent ids equal section ids", trackers)
        self.assertIn("chapter-item ids equal analytical subgroup ids", trackers)
        self.assertIn("contents progress pages", trackers)
        self.assertIn("hierarchical numbers such as `8.1` through `8.8`", trackers)
        self.assertIn("a longer list is a density state", trackers)
        self.assertIn("show the full tracker at every major section change", trackers)
        self.assertIn("left field contains the section title only", trackers)
        self.assertIn("bias numbered tracker markers to circles", trackers)
        self.assertIn("vertically center the complete contents list", trackers)
        self.assertEqual(specimens.count('<main class="deck"'), 5)
        for variant in (
            "sequential-circles",
            "split-contents",
            "compact-label",
            "compact-number-strip",
            "numbered-section-break",
        ):
            self.assertIn(f'data-variant="{variant}"', specimens)
        self.assertIn('data-state="selected" aria-current="step"', specimens)
        self.assertIn(">8.7</span><strong>ipo readiness</strong>", specimens)
        self.assertIn("--tracker-section-number-font: var(--type-section-number)", specimens)
        self.assertIn('.tracker-page[data-variant="sequential-circles"]', specimens)
        self.assertIn('.tracker-page[data-variant="split-contents"] {\n  padding: 0 0 0 var(--slide-margin-inline);', specimens)
        self.assertIn('min-height: var(--slide-height);\n  width: 100%;', specimens)
        self.assertIn("align-self: center", specimens)
        self.assertNotIn("margin-top: var(--space-10)", specimens)
        self.assertNotIn('li[data-state="selected"] {\n  padding:', specimens)
        self.assertNotIn('.tracker--compact-label .tracker__current {\n  color: var(--tracker-active);\n  border-bottom:', specimens)
        self.assertIn('.tracker--compact-number-strip li[data-state="selected"] {\n  color: var(--tracker-active);\n  border-bottom: var(--tracker-rule);', specimens)
        self.assertIn('li[data-state="selected"] .tracker__marker {\n  border: var(--tracker-rule);', specimens)
        self.assertIn('--tracker-list-width: 72%;', specimens)
        self.assertIn('.tracker--split-contents ol {\n  display: grid;\n  gap: var(--tracker-list-gap);\n  width: var(--tracker-list-width);\n  max-width: 100%;', specimens)
        self.assertIn('gap: var(--tracker-gap);\n  width: 100%;\n  padding: var(--tracker-gap);\n  font: var(--tracker-item-font);', specimens)
        self.assertIn('with generous space after short labels', specimens)
        self.assertIn('normally around three quarters', trackers)
        self.assertNotRegex(specimens, r"#[0-9a-f]{3,8}\\b")
        self.assertNotIn("—", specimens)

    def test_deck_consistency_contract_covers_trackers_and_colour_roles(self):
        skill = read(f"{SKILL_ROOT}/SKILL.md").lower()
        design = read(f"{SKILL_ROOT}/references/design/index.md").lower()
        theming = read(f"{SKILL_ROOT}/references/theming/index.md").lower()
        trackers = read(f"{SKILL_ROOT}/references/components/trackers/index.md").lower()
        evaluation = read(f"{SKILL_ROOT}/references/evaluation/index.md").lower()

        self.assertIn("one deck treatment ledger", skill)
        self.assertIn("complete approved item set", skill)
        self.assertIn("reconcile the rendered deck against the treatment ledger slide by slide", design)
        self.assertIn("include a colour ledger", theming)
        self.assertIn("no undeclared editable-object colour", theming)
        self.assertIn("complete item set shown on every full tracker page", trackers)
        self.assertIn("deck-consistency review", evaluation)

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
        worked_example = dot_dash.split("## grounded worked example", maxsplit=1)[1]
        self.assertIn("represent every planned slide in production order with exactly one dot", dot_dash)
        self.assertIn("every dot must contain at least one substantive dash", dot_dash)
        self.assertIn("write the review artifact as markdown", dot_dash)
        self.assertIn("the exact proposed audience-facing title of one slide", dot_dash)
        self.assertIn("it is the underlying title that should appear on the authored slide", dot_dash)
        self.assertIn("do not add a separate `slide title` field", dot_dash)
        self.assertIn("copy each dot verbatim", dot_dash)
        self.assertIn("tracker and section map", dot_dash)
        self.assertIn("until the owner explicitly approves it", dot_dash)
        self.assertIn("before any slide document is created", storylining)
        self.assertIn("## grounded worked example", dot_dash)
        self.assertIn("parent tracker", storylining)
        self.assertIn("chapter tracker", storylining)
        self.assertIn("slidescience.co/storytelling-in-powerpoint", worked_example)
        self.assertIn("### complete dot-dash", worked_example)
        self.assertEqual(worked_example.count("**dot:**"), 16)
        self.assertNotIn("**slide title:**", worked_example)
        self.assertIn("parent tracker order equals dot-dash section order", worked_example)
        self.assertFalse((ROOT / SKILL_ROOT / "references/storylining/dot-dash-example.md").exists())

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
