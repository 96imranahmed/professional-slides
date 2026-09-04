from __future__ import annotations

import importlib.util
import sys
import tempfile
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
    "validate_pptx_consistency",
    ROOT / "evals" / "scripts" / "validate_pptx.py",
)


def judgement(score: int = 95):
    return {
        "rubricVersion": validator.CONSISTENCY_RUBRIC_VERSION,
        "verdict": "accept",
        "summary": "Repeated roles remain consistent.",
        "deckScores": {name: score for name in validator.CONSISTENCY_SCORE_NAMES},
        "slideCoverage": [1, 2],
        "comparisonGroups": [{
            "id": "chart-headings",
            "slides": [1, 2],
            "role": "open-underlined exhibit headings",
            "verdict": "accept",
            "observation": "Both exhibits use the same heading and rule grammar.",
        }],
        "findings": [],
    }


class PptxConsistencyTests(unittest.TestCase):
    def test_prompt_requires_executive_summary_to_navigation_comparison(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inputs = [root / name for name in ("contract.json", "theme.json", "ledger.json", "build.cjs")]
            for path in inputs:
                path.write_text("{}", encoding="utf-8")
            prompt = validator.build_consistency_prompt(
                root / "deck.pptx", [root / "slide-1.png"], *inputs
            )
        self.assertIn("executive-summary-to-navigation", prompt)
        self.assertIn("professional_slides_skill_references", prompt)

    def test_multislide_deck_requires_a_comparison_group(self):
        value = judgement()
        value["comparisonGroups"] = []
        errors = validator.validate_consistency_judgement(value, 2)
        self.assertIn("multi-slide decks require at least one comparison group", errors)

    def test_slide_coverage_must_include_the_complete_deck(self):
        value = judgement()
        value["slideCoverage"] = [1]
        errors = validator.validate_consistency_judgement(value, 2)
        self.assertTrue(any("slideCoverage must equal 1 through 2" in error for error in errors))

    def test_rejected_comparison_group_blocks_acceptance(self):
        value = judgement()
        value["comparisonGroups"][0]["verdict"] = "reject"
        self.assertFalse(validator.derive_consistency_acceptance(value, []))

    def test_dimension_floor_blocks_acceptance(self):
        value = judgement()
        value["deckScores"]["densityRhythm"] = 89
        self.assertFalse(validator.derive_consistency_acceptance(value, []))


if __name__ == "__main__":
    unittest.main()
