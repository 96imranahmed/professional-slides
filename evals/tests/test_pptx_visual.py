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
            "copyAudit": {"noRecap": True, "recapEvidence": "The exhibit has necessary labels and no supporting recap.", "insightCount": 0, "insights": [], "criticality": {"itemCount": 0, "items": []}},
        }],
    }


class PptxVisualTests(unittest.TestCase):
    def test_prompt_routes_to_canonical_owners_without_banning_valid_variants(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inputs = [root / name for name in ("contract.json", "theme.json", "ledger.json", "build.cjs")]
            for path in inputs:
                path.write_text("{}", encoding="utf-8")
            prompt = validator.build_visual_prompt(
                root / "deck.pptx", [root / "slide-1.png"], *inputs
            )
        self.assertIn("professional_slides_skill_references", prompt)
        self.assertIn("secondary rail merely repeats chart values", prompt)
        self.assertIn("keeps a short unit inline in a secondary colour", prompt)
        self.assertIn("Chart headings retain their rule even with inline units", prompt)
        self.assertIn("Non-chart headings and insight regions may omit rules or redundant headings", prompt)
        self.assertIn("open compositions are valid", prompt)
        self.assertIn("non-additive balances", prompt)
        self.assertIn("insight-versus-speaker-notes test", prompt)
        self.assertIn("executive-summary standalone narrative test", prompt)
        self.assertIn("not word count or table presence alone", prompt)
        self.assertNotIn("Mandatory calibration", prompt)

    def test_criticality_is_required_and_cannot_be_averaged_away(self):
        value = judgement(score=100)
        audit = value['slides'][0]['copyAudit']
        audit['criticality'] = {'itemCount': 1, 'items': [{
            'text': 'Treat supply catch-up as upside', 'role': 'insight-heading',
            'deletionConsequence': 'None: the body already states the implication.', 'passes': False}]}
        self.assertFalse(validator.derive_visual_acceptance(value, []))
        audit['criticality']['items'][0]['passes'] = True
        audit['criticality']['items'][0]['deletionConsequence'] = 'Identifies the applicable period, otherwise ambiguous.'
        self.assertTrue(validator.derive_visual_acceptance(value, []))
        audit['criticality']['itemCount'] = 2
        self.assertFalse(validator.derive_visual_acceptance(value, []))
        del audit['criticality']
        self.assertFalse(validator.derive_visual_acceptance(value, []))

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

    def test_copy_gate_cannot_be_averaged_away_or_omitted(self):
        value = judgement(score=100)
        self.assertTrue(validator.derive_visual_acceptance(value, []))
        value["slides"][0]["copyAudit"]["noRecap"] = False
        self.assertFalse(validator.derive_visual_acceptance(value, []))
        del value["slides"][0]["copyAudit"]
        self.assertTrue(validator.validate_visual_judgement(value, 1))
        self.assertFalse(validator.derive_visual_acceptance(value, []))

    def test_insight_semantics_and_review_coverage_are_mandatory(self):
        value = judgement(score=100)
        audit = value["slides"][0]["copyAudit"]
        audit["insightCount"] = 1
        self.assertFalse(validator.derive_visual_acceptance(value, []))
        audit["insights"] = [{"text": "Additional promotion will increase backlog unless throughput improves.",
                              "premises": "Demand exceeds capacity and capacity is fixed this quarter.",
                              "addedDeduction": "Demand stimulation worsens the queue under the stated constraint.",
                              "classification": "supported_deduction"}]
        self.assertTrue(validator.derive_visual_acceptance(value, []))
        for invalid in ("recap", "unsupported"):
            audit["insights"][0]["classification"] = invalid
            self.assertFalse(validator.derive_visual_acceptance(value, []))
        audit["insights"][0]["classification"] = "supported_deduction"
        audit["insights"][0]["addedDeduction"] = ""
        self.assertFalse(validator.derive_visual_acceptance(value, []))

    def test_earlier_visual_rubric_without_copy_gate_is_stale(self):
        value = judgement()
        value["rubricVersion"] = "6"
        self.assertTrue(validator.validate_visual_judgement(value, 1))

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
