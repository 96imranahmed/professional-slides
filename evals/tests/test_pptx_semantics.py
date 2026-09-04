from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


validator = load_module(
    "validate_pptx_semantics",
    ROOT / "evals" / "scripts" / "validate_pptx.py",
)


def summary_contract():
    return {
        "slides": [
            {
                "slide": 1,
                "pageType": "executive_synthesis",
                "title": "Executive summary",
                "executiveSynthesis": {
                    "answer": "Hold until cash conversion recovers.",
                    "branches": [
                        {
                            "heading": "Cloud is a second earnings engine",
                            "proof": "Revenue rose 82% and margin reached 35.6%.",
                            "consequence": "Profit growth is less dependent on Search.",
                        },
                        {
                            "heading": "Cash conversion remains the constraint",
                            "proof": "Free cash flow fell to negative $5.9B.",
                            "consequence": "The valuation needs a wider margin of safety.",
                        },
                    ],
                    "overallAction": "Add only after free cash flow turns positive.",
                },
            }
        ]
    }


class PptxSemanticTests(unittest.TestCase):
    def test_compliant_executive_synthesis_passes(self):
        blocks = {
            1: [
                "Executive summary",
                "Hold until cash conversion recovers.",
                "Cloud is a second earnings engine",
                "Revenue rose 82% and margin reached 35.6%. Profit growth is less dependent on Search.",
                "Cash conversion remains the constraint",
                "Free cash flow fell to negative $5.9B. The valuation needs a wider margin of safety.",
                "Add only after free cash flow turns positive.",
            ]
        }
        self.assertEqual(validator.validate_semantics(blocks, summary_contract()), [])

    def test_contract_answer_may_be_synthesized_without_duplicate_visible_copy(self):
        blocks = {
            1: [
                "Executive summary",
                "Cloud is a second earnings engine",
                "Revenue rose 82% and margin reached 35.6%. Profit growth is less dependent on Search.",
                "Cash conversion remains the constraint",
                "Free cash flow fell to negative $5.9B. The valuation needs a wider margin of safety.",
                "Add only after free cash flow turns positive.",
            ]
        }
        self.assertEqual(validator.validate_semantics(blocks, summary_contract()), [])

    def test_generic_executive_role_labels_fail(self):
        blocks = {1: ["Executive summary", "Answer", "Operating proof", "Action"]}
        errors = validator.validate_semantics(blocks, summary_contract())
        self.assertTrue(any("generic role label" in error for error in errors))

    def test_generic_insight_rail_label_fails(self):
        contract = {"slides": [{"slide": 1, "pageType": "analytical", "title": "Search growth accelerated"}]}
        blocks = {1: ["Search growth accelerated", "What the quarter supports", "Network revenue was flat."]}
        errors = validator.validate_semantics(blocks, contract)
        self.assertTrue(any("what the quarter supports" in error for error in errors))

    def test_detached_headline_metrics_fail_redundancy_gate(self):
        contract = {"slides": [{"slide": 1, "pageType": "analytical", "title": "Cloud and Search drove 87% of the $23.4B increase"}]}
        blocks = {1: ["Cloud and Search drove 87% of the $23.4B increase", "+$23.4B Total revenue increase", "87% From Cloud and Search"]}
        errors = validator.validate_semantics(blocks, contract)
        self.assertTrue(any("repeat headline values" in error for error in errors))

    def test_one_detached_headline_metric_still_fails(self):
        contract = {"slides": [{"slide": 1, "pageType": "analytical", "title": "Free cash flow fell to negative $5.9B"}]}
        blocks = {1: ["Free cash flow fell to negative $5.9B", "-$5.9B Q2 free cash flow"]}
        errors = validator.validate_semantics(blocks, contract)
        self.assertTrue(any("repeat headline values" in error for error in errors))

    def test_tracker_number_may_repeat_its_numbered_section_heading(self):
        contract = {
            "slides": [
                {
                    "slide": 1,
                    "pageType": "chapter_transition",
                    "title": "3 Valuation and decision",
                }
            ]
        }
        blocks = {1: ["3 Valuation and decision", "3"]}
        self.assertEqual(validator.validate_semantics(blocks, contract), [])

    def test_bullet_field_rejects_a_dangling_rhs_heading(self):
        contract = {
            "slides": [
                {
                    "slide": 1,
                    "pageType": "analytical",
                    "title": "Search growth accelerated",
                    "synthesisMode": "bullet_field",
                    "synthesisBullets": [
                        "AI adoption coincided with faster growth.",
                        "One quarter is not proof.",
                    ],
                }
            ]
        }
        blocks = {1: ["Search growth accelerated", "• AI adoption coincided with faster growth. • One quarter is not proof."]}
        self.assertEqual(validator.validate_semantics(blocks, contract), [])
        errors = validator.validate_split_synthesis_shape_names(
            {1: ["search-insight-heading", "search-insight-body"]},
            contract,
        )
        self.assertTrue(any("dangling heading" in error for error in errors))

    def test_bullet_field_requires_one_to_three_bullets(self):
        contract = {
            "slides": [
                {
                    "slide": 1,
                    "pageType": "analytical",
                    "title": "Search growth accelerated",
                    "synthesisMode": "bullet_field",
                }
            ]
        }
        errors = validator.validate_semantics(
            {1: ["Search growth accelerated", "AI adoption coincided with faster growth."]},
            contract,
        )
        self.assertTrue(any("one to three bullets" in error for error in errors))

    def test_bullet_field_rejects_detached_metric_indicator_stacks(self):
        contract = {
            "slides": [
                {
                    "slide": 1,
                    "pageType": "analytical",
                    "title": "Other income overstated recurring earnings",
                    "synthesisMode": "bullet_field",
                    "synthesisBullets": ["Unrealized gains are not recurring operating earnings."],
                }
            ]
        }
        blocks = {
            1: [
                "Other income overstated recurring earnings",
                "• Unrealized gains are not recurring operating earnings.",
                "REPORTED",
                "$9.11",
                "Diluted EPS",
                "ANALYST NORMALIZATION",
                "$2.68",
                "Quarterly operating EPS",
            ]
        }
        self.assertEqual(validator.validate_semantics(blocks, contract), [])
        errors = validator.validate_split_synthesis_shape_names(
            {
                1: [
                    "earnings-insight-body",
                    "earnings-reported-value",
                    "earnings-reported-label",
                    "earnings-normalized-value",
                    "earnings-normalized-label",
                ]
            },
            contract,
        )
        self.assertTrue(any("detached metric, KPI, or indicator stack" in error for error in errors))

    def test_renamed_metric_stack_cannot_evade_component_completeness(self):
        contract = {
            "slides": [
                {
                    "slide": 10,
                    "pageType": "analytical",
                    "title": "Free cash flow fell despite higher operating cash",
                }
            ]
        }
        errors = validator.validate_metric_component_shape_names(
            {
                10: [
                    "h1-fcf-change-value",
                    "h1-fcf-change-label",
                    "h1-fcf-change-note",
                ]
            },
            contract,
        )
        self.assertTrue(any("incomplete metric component 'h1-fcf-change'" in error for error in errors))
        self.assertTrue(any("divider-or-rule" in error for error in errors))

    def test_complete_metric_component_passes_for_any_prefix(self):
        contract = {
            "slides": [
                {
                    "slide": 1,
                    "pageType": "analytical",
                    "title": "Cash conversion remains the constraint",
                }
            ]
        }
        self.assertEqual(
            validator.validate_metric_component_shape_names(
                {1: ["cash-value", "cash-rule", "cash-label", "cash-note"]},
                contract,
            ),
            [],
        )


if __name__ == "__main__":
    unittest.main()
