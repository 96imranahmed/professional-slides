from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


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
        result = {
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
            "deckConsistencyReview": {
                "themeManifestPath": f"{case_id}/{arm}/theme-manifest.json",
                "auditPath": f"{case_id}/{arm}/deck-consistency-audit.json",
                "fullDeckCompared": True,
                "paletteRolesVerified": True,
                "trackerMapVerified": True,
                "repeatedComponentsVerified": True,
                "unresolvedFindings": [],
            },
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
        return result

    def document(self, results, skipped=None):
        return {
            "runId": "test-run",
            "createdAt": "2026-08-29T12:00:00Z",
            "runPreparation": {
                "manifestPath": "tmp/eval-runs/test-run/run-manifest.json",
                "workspacePath": "tmp/eval-runs/test-run",
                "outputPath": "output",
                "outputResetComplete": True,
                "priorEvalArtifactsReused": False,
            },
            "skippedCases": skipped or [],
            "results": results,
        }

    def test_package_is_valid(self):
        self.assertEqual(eval_runner.check_package(), [])

    def test_run_preparation_proof_is_required(self):
        document = self.document([self.result(self.case_ids[0], "self", 5)])
        del document["runPreparation"]
        errors, report = eval_runner.evaluate(self.cases, document, "self")
        self.assertIn("runPreparation must be an object", errors)
        self.assertFalse(report["passed"])

    def test_prior_eval_artifact_reuse_is_rejected(self):
        document = self.document([self.result(self.case_ids[0], "self", 5)])
        document["runPreparation"]["priorEvalArtifactsReused"] = True
        errors, report = eval_runner.evaluate(self.cases, document, "self")
        self.assertIn("runPreparation.priorEvalArtifactsReused must be false", errors)
        self.assertFalse(report["passed"])

    def test_declared_evidence_paths_must_exist_in_the_fresh_workspace(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workspace = root / "tmp" / "eval-runs" / "test-run"
            workspace.mkdir(parents=True)
            manifest = {
                "runId": "test-run",
                "workspacePath": "tmp/eval-runs/test-run",
                "outputPath": "output",
                "outputResetComplete": True,
                "priorEvalArtifactsReused": False,
                "inputHashes": {"skillPackage": "a" * 64},
            }
            (workspace / "run-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            document = self.document([self.result(self.case_ids[0], "self", 5)])
            errors, report = eval_runner.evaluate(
                self.cases, document, "self", evidence_root=root
            )
            self.assertTrue(any("does not exist as a file" in error for error in errors))
            self.assertFalse(report["passed"])

    def test_evidence_files_are_verified(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workspace = root / "tmp" / "eval-runs" / "test-run"
            result = self.result(self.case_ids[0], "self", 5)
            for relative, contents in (
                (result["artifactPaths"][0], "editable deck"),
                (result["renderPaths"][0], "render"),
                (result["preAuthoringReview"]["contractPath"], "{}"),
                (result["preAuthoringReview"]["validatorOutputPath"], "valid"),
                (result["deckConsistencyReview"]["themeManifestPath"], "{}"),
                (result["deckConsistencyReview"]["auditPath"], "{}"),
            ):
                path = workspace / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(contents, encoding="utf-8")
            manifest = {
                "runId": "test-run",
                "workspacePath": "tmp/eval-runs/test-run",
                "outputPath": "output",
                "outputResetComplete": True,
                "priorEvalArtifactsReused": False,
                "inputHashes": {"skillPackage": "a" * 64},
            }
            (workspace / "run-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            errors, report = eval_runner.evaluate(
                self.cases, self.document([result]), "self", evidence_root=root
            )
            self.assertEqual(errors, [])
            self.assertTrue(report["passed"])

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

    def test_self_result_requires_deck_consistency_review(self):
        result = self.result(self.case_ids[0], "self", 5)
        del result["deckConsistencyReview"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("deckConsistencyReview must be an object" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_unresolved_deck_consistency_finding_blocks_result(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["deckConsistencyReview"]["unresolvedFindings"] = ["Slide 4 uses an undeclared blue"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("unresolvedFindings must be empty" in error for error in errors))
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
