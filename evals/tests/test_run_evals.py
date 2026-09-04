from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from evals.tests.test_pptx_validator import build_pptx, manifest as pptx_manifest, validator as pptx_validator


ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


eval_runner = load_module("run_evals", ROOT / "evals" / "run_evals.py")


def accepted_visual_judgement(slide_count: int):
    score_names = eval_runner.PPTX_VISUAL_VALIDATOR.VISUAL_SCORE_NAMES
    scores = {name: 95 for name in score_names}
    return {
        "rubricVersion": eval_runner.PPTX_VISUAL_VALIDATOR.VISUAL_RUBRIC_VERSION,
        "verdict": "accept",
        "summary": "Every rendered slide is complete and uses the declared standard components.",
        "deckScores": scores,
        "findings": [],
        "slides": [
            {
                "slide": number,
                "verdict": "accept",
                "summary": "The slide is complete, legible, and compositionally finished.",
                "scores": scores,
                "findings": [],
            }
            for number in range(1, slide_count + 1)
        ],
    }


def accepted_consistency_judgement(slide_count: int):
    score_names = eval_runner.PPTX_CONSISTENCY_VALIDATOR.CONSISTENCY_SCORE_NAMES
    scores = {name: 95 for name in score_names}
    return {
        "rubricVersion": eval_runner.PPTX_CONSISTENCY_VALIDATOR.CONSISTENCY_RUBRIC_VERSION,
        "verdict": "accept",
        "summary": "Repeated visual roles are consistent across the rendered deck.",
        "deckScores": scores,
        "slideCoverage": list(range(1, slide_count + 1)),
        "comparisonGroups": [] if slide_count == 1 else [{
            "id": "titles",
            "slides": list(range(1, slide_count + 1)),
            "role": "action-title",
            "verdict": "accept",
            "observation": "Title anchors and hierarchy remain consistent.",
        }],
        "findings": [],
    }


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
                "treatmentLedgerPath": f"{case_id}/{arm}/treatment-ledger.json",
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
        if arm in {"self", "treatment"}:
            result["powerpointAcceptanceReview"] = {
                "manifestPath": f"{case_id}/{arm}/powerpoint-acceptance.json",
                "reportPath": f"{case_id}/{arm}/powerpoint-acceptance-report.json",
                "candidateSha256": "a" * 64,
                "accepted": True,
                "iterationCount": 1,
            }
            result["visualReview"] = {
                "reportPath": f"{case_id}/{arm}/visual-review.json",
                "generationScriptPath": f"{case_id}/{arm}/build-deck.cjs",
                "candidateSha256": "a" * 64,
                "accepted": True,
                "model": "gpt-5.6-terra",
                "iterationCount": 1,
            }
            result["crossSlideConsistencyReview"] = {
                "reportPath": f"{case_id}/{arm}/cross-slide-consistency-review.json",
                "generationScriptPath": f"{case_id}/{arm}/build-deck.cjs",
                "candidateSha256": "a" * 64,
                "accepted": True,
                "model": "gpt-5.6-luna",
                "iterationCount": 1,
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

    def test_reference_fidelity_report_is_bound_to_runtime_sources(self):
        report = json.loads((ROOT / "evals" / "reference-fidelity-eval.json").read_text())
        self.assertEqual(eval_runner.validate_reference_fidelity_report(report), [])
        first_path = sorted(report["inputs"]["runtimeSources"])[0]
        report["inputs"]["runtimeSources"][first_path] = "0" * 64
        errors = eval_runner.validate_reference_fidelity_report(report)
        self.assertTrue(any("stale source hash" in error for error in errors))

    def test_run_preparation_proof_is_required(self):
        document = self.document([self.result(self.case_ids[0], "self", 5)])
        del document["runPreparation"]
        errors, report = eval_runner.evaluate(self.cases, document, "self")
        self.assertIn("runPreparation must be an object", errors)
        self.assertFalse(report["passed"])

    def test_overlap_evidence_cannot_omit_native_or_slide_coverage(self):
        report = json.loads((ROOT / "evals" / "reference-fidelity-eval.json").read_text())
        del report["gates"]["overlap"]["nativeGeometry"]
        errors = eval_runner.validate_reference_fidelity_report(report)
        self.assertTrue(any("imported PPTX overlap" in error for error in errors))
        report = json.loads((ROOT / "evals" / "reference-fidelity-eval.json").read_text())
        report["gates"]["overlap"]["slides"].pop()
        errors = eval_runner.validate_reference_fidelity_report(report)
        self.assertTrue(any("overlap coverage is incomplete" in error for error in errors))

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
                (result["renderPaths"][0], "render"),
                (result["preAuthoringReview"]["validatorOutputPath"], "valid"),
                (result["deckConsistencyReview"]["themeManifestPath"], "{}"),
                (result["deckConsistencyReview"]["treatmentLedgerPath"], "{}"),
                (result["deckConsistencyReview"]["auditPath"], "{}"),
            ):
                path = workspace / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(contents, encoding="utf-8")
            artifact = workspace / result["artifactPaths"][0]
            artifact.parent.mkdir(parents=True, exist_ok=True)
            build_pptx(
                artifact,
                [{"title": "Slide 1 advances the decision", "body": "One short proof."}],
            )
            contract = {
                "schemaVersion": 1,
                "workflowMode": "new_deck",
                "templateId": "startup-pitch-deck",
                "deliveryMode": "live_pitch",
                "visualSystem": {"mode": "clean-native-standard", "designSystem": "codex-grid"},
                "plannedSlideCount": 1,
                "chapters": [],
                "executiveSummaryDecision": {
                    "status": "not_required",
                    "rationale": "The cover is the entire one-slide fixture.",
                },
                "structuralRecommendations": [],
                "tracker": {
                    "system": "none",
                    "contentsSlide": None,
                    "transitionSlides": [],
                    "analyticalHeader": {
                        "variant": "untracked",
                        "fullStateVariant": "none",
                        "compactStateVariant": "none",
                        "governedSlides": [],
                        "requiredFields": ["action-title"],
                    },
                },
                "approval": {
                    "dotDashApproved": True,
                    "reviewArtifact": "story/dot-dash.md",
                },
                "slides": [{
                    "slide": 1,
                    "dotId": "D1",
                    "pageType": "cover",
                    "title": "Slide 1 advances the decision",
                    "communicationJob": "State the fixture decision",
                    "chapterId": None,
                    "hypothesisIds": ["NAV"],
                    "dashes": ["One short proof."],
                    "evidenceRegions": 0,
                    "terminalSurfacePosition": "none",
                    "headerVariant": "structural",
                    "trackerLabel": None,
                    "trackerParentId": None,
                    "trackerChapterId": None,
                    "trackerParentLabel": None,
                    "trackerChapterLabel": None,
                }],
            }
            contract_path = workspace / result["preAuthoringReview"]["contractPath"]
            contract_path.parent.mkdir(parents=True, exist_ok=True)
            contract_path.write_text(json.dumps(contract), encoding="utf-8")
            acceptance_manifest_path = workspace / result["powerpointAcceptanceReview"]["manifestPath"]
            acceptance_manifest_path.parent.mkdir(parents=True, exist_ok=True)
            acceptance_manifest_path.write_text(
                json.dumps(pptx_manifest(["Slide 1 advances the decision"])),
                encoding="utf-8",
            )
            acceptance_report = pptx_validator.validate(artifact, acceptance_manifest_path)
            self.assertTrue(acceptance_report["accepted"], acceptance_report["findings"])
            acceptance_report_path = workspace / result["powerpointAcceptanceReview"]["reportPath"]
            acceptance_report_path.write_text(json.dumps(acceptance_report), encoding="utf-8")
            result["powerpointAcceptanceReview"]["candidateSha256"] = acceptance_report["candidate"]["sha256"]
            generation_script_path = workspace / result["visualReview"]["generationScriptPath"]
            generation_script_path.write_text("// generated deck fixture", encoding="utf-8")
            visual_report = eval_runner.PPTX_VISUAL_VALIDATOR.build_visual_report(
                accepted_visual_judgement(1),
                artifact,
                [workspace / result["renderPaths"][0]],
                contract_path,
                workspace / result["deckConsistencyReview"]["themeManifestPath"],
                workspace / result["deckConsistencyReview"]["treatmentLedgerPath"],
                generation_script_path,
                result["visualReview"]["model"],
            )
            visual_report_path = workspace / result["visualReview"]["reportPath"]
            visual_report_path.write_text(json.dumps(visual_report), encoding="utf-8")
            result["visualReview"]["candidateSha256"] = visual_report["candidate"]["sha256"]
            consistency_report = eval_runner.PPTX_CONSISTENCY_VALIDATOR.build_consistency_report(
                accepted_consistency_judgement(1),
                artifact,
                [workspace / result["renderPaths"][0]],
                contract_path,
                workspace / result["deckConsistencyReview"]["themeManifestPath"],
                workspace / result["deckConsistencyReview"]["treatmentLedgerPath"],
                generation_script_path,
                result["crossSlideConsistencyReview"]["model"],
            )
            consistency_report_path = workspace / result["crossSlideConsistencyReview"]["reportPath"]
            consistency_report_path.write_text(json.dumps(consistency_report), encoding="utf-8")
            result["crossSlideConsistencyReview"]["candidateSha256"] = consistency_report["candidate"]["sha256"]
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

    def test_evaluation_reruns_deck_contract_validator(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workspace = root / "tmp" / "eval-runs" / "test-run"
            result = self.result(self.case_ids[0], "self", 5)
            for relative, contents in (
                (result["renderPaths"][0], "render"),
                (result["preAuthoringReview"]["validatorOutputPath"], "claimed valid"),
                (result["deckConsistencyReview"]["themeManifestPath"], "{}"),
                (result["deckConsistencyReview"]["treatmentLedgerPath"], "{}"),
                (result["deckConsistencyReview"]["auditPath"], "{}"),
            ):
                path = workspace / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(contents, encoding="utf-8")
            artifact = workspace / result["artifactPaths"][0]
            artifact.parent.mkdir(parents=True, exist_ok=True)
            build_pptx(artifact, [{"title": "Slide 1 advances the decision", "body": "One short proof."}])
            contract_path = workspace / result["preAuthoringReview"]["contractPath"]
            contract_path.parent.mkdir(parents=True, exist_ok=True)
            contract_path.write_text(json.dumps({
                "slides": [{
                    "slide": 1,
                    "pageType": "analytical",
                    "title": "Slide 1 advances the decision",
                }]
            }), encoding="utf-8")
            acceptance_manifest_path = workspace / result["powerpointAcceptanceReview"]["manifestPath"]
            acceptance_manifest_path.parent.mkdir(parents=True, exist_ok=True)
            acceptance_manifest_path.write_text(
                json.dumps(pptx_manifest(["Slide 1 advances the decision"])),
                encoding="utf-8",
            )
            acceptance_report = pptx_validator.validate(artifact, acceptance_manifest_path)
            acceptance_report_path = workspace / result["powerpointAcceptanceReview"]["reportPath"]
            acceptance_report_path.write_text(json.dumps(acceptance_report), encoding="utf-8")
            result["powerpointAcceptanceReview"]["candidateSha256"] = acceptance_report["candidate"]["sha256"]
            manifest = {
                "runId": "test-run",
                "workspacePath": "tmp/eval-runs/test-run",
                "outputPath": "output",
                "outputResetComplete": True,
                "priorEvalArtifactsReused": False,
                "inputHashes": {"skillPackage": "a" * 64},
            }
            workspace.mkdir(parents=True, exist_ok=True)
            (workspace / "run-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            errors, report = eval_runner.evaluate(
                self.cases, self.document([result]), "self", evidence_root=root
            )
            self.assertTrue(any("evidenceComposition is required" in error for error in errors))
            self.assertFalse(report["passed"])

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

    def test_self_pptx_requires_hard_acceptance_review(self):
        result = self.result(self.case_ids[0], "self", 5)
        del result["powerpointAcceptanceReview"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("powerpointAcceptanceReview must be an object" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_self_pptx_requires_independent_visual_review(self):
        result = self.result(self.case_ids[0], "self", 5)
        del result["visualReview"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("visualReview must be an object" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_rejected_visual_review_blocks_result(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["visualReview"]["accepted"] = False
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("visualReview.accepted must be true" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_self_pptx_requires_cross_slide_consistency_review(self):
        result = self.result(self.case_ids[0], "self", 5)
        del result["crossSlideConsistencyReview"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("crossSlideConsistencyReview must be an object" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_cross_slide_judge_must_differ_from_per_slide_judge(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["crossSlideConsistencyReview"]["model"] = result["visualReview"]["model"]
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("must differ from visualReview.model" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_rejected_powerpoint_review_blocks_result(self):
        result = self.result(self.case_ids[0], "self", 5)
        result["powerpointAcceptanceReview"]["accepted"] = False
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertTrue(any("powerpointAcceptanceReview.accepted must be true" in error for error in errors))
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
