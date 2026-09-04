from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

from evals.tests.test_pptx_validator import build_pptx


ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


validator = load_module(
    "validate_pptx_visual",
    ROOT / "evals" / "scripts" / "validate_pptx.py",
)


def judgement(score: int = 95, verdict: str = "accept"):
    scores = {name: score for name in validator.VISUAL_SCORE_NAMES}
    return {
        "rubricVersion": validator.VISUAL_RUBRIC_VERSION,
        "verdict": verdict,
        "summary": "The complete rendered slide uses the declared standard visual grammar.",
        "deckScores": scores,
        "findings": [],
        "slides": [{
            "slide": 1,
            "verdict": verdict,
            "summary": "The slide is complete and visually finished.",
            "scores": scores,
            "findings": [],
        }],
    }


class PptxVisualTests(unittest.TestCase):
    def test_prompt_uses_skill_rules_and_rejects_parallel_narrative_rails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inputs = [root / name for name in ("contract.json", "theme.json", "ledger.json", "build.cjs")]
            for path in inputs:
                path.write_text("{}", encoding="utf-8")
            prompt = validator.build_visual_prompt(
                root / "deck.pptx", [root / "slide-1.png"], *inputs
            )
        self.assertIn("professional_slides_skill_references", prompt)
        self.assertIn("secondary rail restates chart values", prompt)

    def test_every_slide_must_be_enumerated_exactly_once(self):
        value = judgement()
        value["slides"][0]["slide"] = 2
        errors = validator.validate_visual_judgement(value, 1)
        self.assertTrue(any("cover 1 through 1" in error for error in errors))

    def test_dimension_floor_rejects_otherwise_accepted_judgement(self):
        value = judgement()
        value["slides"][0]["scores"]["evidenceDensity"] = 89
        self.assertFalse(validator.derive_visual_acceptance(value, []))

    def test_major_finding_rejects_high_scores(self):
        value = judgement()
        value["slides"][0]["findings"] = [{
            "severity": "major",
            "code": "dangling-label",
            "observation": "A metric label is visibly detached from any component.",
            "reason": "The page cannot be decoded as a complete exhibit.",
            "recommendedChange": "Rebuild it as the canonical metric field.",
        }]
        self.assertFalse(validator.derive_visual_acceptance(value, []))

    def test_cached_report_is_bound_to_exact_candidate_render_and_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pptx = root / "deck.pptx"
            build_pptx(pptx, [{"title": "Complete slide", "body": "Evidence"}])
            render = root / "slide-1.png"
            render.write_bytes(b"render-one")
            contract = root / "contract.json"
            theme = root / "theme.json"
            ledger = root / "ledger.json"
            script = root / "build.cjs"
            for path in (contract, theme, ledger):
                path.write_text("{}", encoding="utf-8")
            script.write_text("// generated deck", encoding="utf-8")
            report = validator.build_visual_report(
                judgement(), pptx, [render], contract, theme, ledger, script, "gpt-5.6-terra"
            )
            self.assertEqual(
                validator.validate_visual_cached_report(
                    report, pptx, [render], contract, theme, ledger, script, "gpt-5.6-terra"
                ),
                [],
            )
            render.write_bytes(b"render-two")
            errors = validator.validate_visual_cached_report(
                report, pptx, [render], contract, theme, ledger, script, "gpt-5.6-terra"
            )
            self.assertTrue(any("exact per-slide renders" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
