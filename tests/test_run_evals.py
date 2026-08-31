from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


eval_runner = load_module("run_evals", ROOT / "evals" / "run_evals.py")


class EvalRunnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = json.loads((ROOT / "evals" / "cases.json").read_text())
        cls.dimensions = cls.cases["dimensions"]
        cls.case_ids = [case["id"] for case in cls.cases["cases"] if case["enabled"]]

    def result(self, case_id: str, arm: str, value: float, failures=None):
        return {
            "caseId": case_id,
            "arm": arm,
            "artifactPaths": [f"{case_id}/{arm}/deck.pptx"],
            "renderPaths": [f"{case_id}/{arm}/slide-1.png"],
            "preAuthoringReview": {
                "workflowMode": "new_deck",
                "contractPath": f"{case_id}/{arm}/deck-contract.json",
                "validatorOutputPath": f"{case_id}/{arm}/deck-contract-validation.txt",
                "contractValidated": True,
                "dotDashCoverageVerified": True,
                "validationStage": "before_slide_document_creation",
                "executiveSummaryDisposition": "not_required",
            },
            "scores": {dimension: value for dimension in self.dimensions},
            "criticalFailures": failures or [],
            "majorDefects": [],
            "minorDefects": [],
            "antiSlopReview": {
                "renderedTextInspected": True,
                "fullDeckMontageInspected": True,
                "expectedSlideCount": 1,
                "slideAudits": [{
                    "slide": 1,
                    "narrativeJob": "Resolve the requested decision",
                    "inspectedAtFullSize": True,
                    "deletionTestPassed": True,
                    "specificityTestPassed": True,
                    "compositionFitPassed": True,
                    "visualFinishPassed": True,
                    "observations": ["The title states the decision", "The evidence proves the title"],
                    "unresolvedFindings": [],
                }],
                "benchmarkComparisons": [
                    {"candidateSlide": 1, "reference": "Reference A", "dimension": "hierarchy", "observedGap": "No material hierarchy gap remained", "disposition": "no_material_gap"},
                    {"candidateSlide": 1, "reference": "Reference B", "dimension": "density", "observedGap": "No material density gap remained", "disposition": "no_material_gap"},
                    {"candidateSlide": 1, "reference": "Reference C", "dimension": "exhibit_finish", "observedGap": "No material exhibit gap remained", "disposition": "no_material_gap"},
                ],
                "unexplainedRoleLabels": [],
                "retainedLabels": [],
            },
            "evidence": [f"Observed evidence for {dimension}" for dimension in self.dimensions],
        }

    def document(self, results, skipped=None):
        return {
            "runId": "test-run",
            "createdAt": "2026-08-29T12:00:00Z",
            "skippedCases": skipped or [],
            "results": results,
        }

    def test_package_is_valid(self):
        self.assertEqual(eval_runner.check_package(), [])

    def test_release_passes_with_complete_improvement(self):
        results = []
        for case_id in self.case_ids:
            results.append(self.result(case_id, "control", 3))
            results.append(self.result(case_id, "treatment", 5))
        errors, report = eval_runner.evaluate(self.cases, self.document(results), "release")
        self.assertEqual(errors, [])
        self.assertTrue(report["passed"])
        self.assertEqual(report["aggregate"]["delta"], 40.0)

    def test_treatment_critical_failure_fails_release(self):
        results = []
        for index, case_id in enumerate(self.case_ids):
            results.append(self.result(case_id, "control", 3))
            failures = ["misleading_chart"] if index == 0 else []
            results.append(self.result(case_id, "treatment", 5, failures))
        errors, report = eval_runner.evaluate(self.cases, self.document(results), "release")
        self.assertEqual(errors, [])
        self.assertFalse(report["passed"])

    def test_release_requires_both_arms(self):
        results = [self.result(case_id, "treatment", 5) for case_id in self.case_ids]
        errors, report = eval_runner.evaluate(self.cases, self.document(results), "release")
        self.assertTrue(any("requires exactly control and treatment" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_self_mode_uses_absolute_gate(self):
        result = self.result(self.case_ids[0], "self", 4)
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertEqual(errors, [])
        self.assertFalse(report["passed"])

    def test_self_mode_accepts_decimal_scores_above_ninety_eight(self):
        result = self.result(self.case_ids[0], "self", 4.9)
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertEqual(errors, [])
        self.assertTrue(report["passed"])
        self.assertEqual(report["cases"][self.case_ids[0]]["score"], 98.0)

    def test_high_average_cannot_hide_one_weak_dimension(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["scores"]["slideDesign"] = 4.8
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertEqual(errors, [])
        self.assertFalse(report["passed"])
        self.assertEqual(report["cases"][self.case_ids[0]]["dimensionFloorFailures"], ["slideDesign"])

    def test_major_visual_defect_blocks_high_scoring_result(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["majorDefects"] = ["wrong_navigation_system"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertEqual(errors, [])
        self.assertFalse(report["passed"])

    def test_any_minor_defect_blocks_release(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["minorDefects"] = ["Slide 2 spacing"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertEqual(errors, [])
        self.assertFalse(report["passed"])

    def test_unexplained_role_label_blocks_release(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["antiSlopReview"]["unexplainedRoleLabels"] = ["Slide 14: IC conclusion"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertEqual(errors, [])
        self.assertFalse(report["passed"])
        self.assertEqual(report["cases"][self.case_ids[0]]["unexplainedRoleLabels"], ["Slide 14: IC conclusion"])

    def test_unresolved_slide_audit_finding_blocks_release(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["antiSlopReview"]["slideAudits"][0]["unresolvedFindings"] = ["Blank logo in the ecosystem map"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertEqual(errors, [])
        self.assertFalse(report["passed"])
        self.assertEqual(
            report["cases"][self.case_ids[0]]["unresolvedSlopFindings"],
            ["Slide 1: Blank logo in the ecosystem map"],
        )

    def test_slide_audit_must_cover_every_slide_exactly_once(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["antiSlopReview"]["expectedSlideCount"] = 2
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("must cover every slide exactly once" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_self_result_requires_pre_authoring_workflow_proof(self):
        result = self.result(self.case_ids[0], "self", 5)
        del result["preAuthoringReview"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("preAuthoringReview must be an object" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_existing_deck_workflow_accepts_recommended_missing_summary(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["preAuthoringReview"] = {
            "workflowMode": "existing_deck_revision",
            "contractPath": "existing/deck-contract.json",
            "validatorOutputPath": "existing/deck-contract-validation.txt",
            "contractValidated": True,
            "dotDashCoverageVerified": True,
            "validationStage": "before_first_mutation",
            "executiveSummaryDisposition": "missing_recommended",
        }
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertEqual(errors, [])
        self.assertTrue(report["passed"])

    def test_existing_deck_workflow_rejects_forced_new_deck_disposition(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["preAuthoringReview"].update({
            "workflowMode": "existing_deck_revision",
            "validationStage": "before_first_mutation",
            "executiveSummaryDisposition": "not_required",
        })
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("executiveSummaryDisposition is invalid" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_missing_reference_fixture_can_be_explicitly_skipped(self):
        reference_case = "reference-theme-fidelity"
        results = []
        for case_id in self.case_ids:
            if case_id == reference_case:
                continue
            results.append(self.result(case_id, "control", 3))
            results.append(self.result(case_id, "treatment", 5))
        document = self.document(
            results,
            [{"caseId": reference_case, "reason": "Authorized reference fixture unavailable"}],
        )
        errors, report = eval_runner.evaluate(self.cases, document, "release")
        self.assertEqual(errors, [])
        self.assertTrue(report["passed"])
        self.assertEqual(report["skippedCases"], [reference_case])


if __name__ == "__main__":
    unittest.main()
