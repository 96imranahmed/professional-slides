#!/usr/bin/env python3
"""Validate and aggregate professional-slides self and release evaluations."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
CASES_PATH = ROOT / "cases.json"
INDEX_PATH = (
    ROOT.parent
    / "skills"
    / "professional-slides"
    / "references"
    / "evaluation"
    / "index.md"
)


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path}: top-level value must be an object")
    return value


def resolve_contained_path(root: Path, raw_path: Any, label: str, errors: list[str]) -> Path | None:
    if not isinstance(raw_path, str) or not raw_path.strip():
        errors.append(f"{label} must be a non-empty relative path")
        return None
    relative = Path(raw_path)
    if relative.is_absolute():
        errors.append(f"{label} must be relative")
        return None
    root = root.resolve()
    candidate = (root / relative).resolve()
    if candidate != root and root not in candidate.parents:
        errors.append(f"{label} escapes its allowed root")
        return None
    return candidate


def require_material_file(root: Path, raw_path: Any, label: str, errors: list[str]) -> Path | None:
    candidate = resolve_contained_path(root, raw_path, label, errors)
    if candidate is None:
        return None
    if not candidate.is_file():
        errors.append(f"{label} does not exist as a file: {raw_path}")
        return None
    if candidate.stat().st_size < 1:
        errors.append(f"{label} is empty: {raw_path}")
        return None
    return candidate


def validate_cases(document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    dimensions = document.get("dimensions")
    failures = document.get("criticalFailures")
    major_defects = document.get("majorDefects")
    thresholds = document.get("thresholds")
    cases = document.get("cases")

    if not isinstance(dimensions, list) or len(dimensions) < 1 or len(set(dimensions)) != len(dimensions):
        errors.append("dimensions must be a non-empty unique list")
    if not isinstance(failures, list) or len(failures) < 1 or len(set(failures)) != len(failures):
        errors.append("criticalFailures must be a non-empty unique list")
    if not isinstance(major_defects, list) or len(major_defects) < 1 or len(set(major_defects)) != len(major_defects):
        errors.append("majorDefects must be a non-empty unique list")
    if not isinstance(thresholds, dict):
        errors.append("thresholds must be an object")
    else:
        for key in ("selfScoreMinimum", "treatmentScoreMinimum", "improvementMinimum"):
            if not isinstance(thresholds.get(key), (int, float)):
                errors.append(f"thresholds.{key} must be numeric")
        regression = thresholds.get("maximumDimensionRegression")
        if not isinstance(regression, (int, float)) or regression < 0:
            errors.append("thresholds.maximumDimensionRegression must be non-negative")
        minimum_dimension = thresholds.get("minimumDimensionScore")
        if not isinstance(minimum_dimension, (int, float)) or not 1 <= minimum_dimension <= 5:
            errors.append("thresholds.minimumDimensionScore must be numeric from 1 to 5")
        maximum_minor = thresholds.get("maximumMinorDefects")
        if isinstance(maximum_minor, bool) or not isinstance(maximum_minor, int) or maximum_minor < 0:
            errors.append("thresholds.maximumMinorDefects must be a non-negative integer")

    if not isinstance(cases, list) or not cases:
        errors.append("cases must be a non-empty list")
        return errors

    seen: set[str] = set()
    for index, case in enumerate(cases):
        location = f"cases[{index}]"
        if not isinstance(case, dict):
            errors.append(f"{location} must be an object")
            continue
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id:
            errors.append(f"{location}.id must be a non-empty string")
        elif case_id in seen:
            errors.append(f"{location}.id is duplicated: {case_id}")
        else:
            seen.add(case_id)
        if case.get("platform") not in {"powerpoint", "google_slides", "both"}:
            errors.append(f"{location}.platform is invalid")
        if not isinstance(case.get("enabled"), bool):
            errors.append(f"{location}.enabled must be boolean")
        if not isinstance(case.get("brief"), str) or not case["brief"].strip():
            errors.append(f"{location}.brief must be a non-empty string")
        fixture = case.get("fixture")
        if not isinstance(fixture, dict) or not isinstance(fixture.get("required"), bool):
            errors.append(f"{location}.fixture.required must be boolean")
        if not isinstance(case.get("focus"), list) or not case["focus"]:
            errors.append(f"{location}.focus must be a non-empty list")
    return errors


def validate_result(
    result: dict[str, Any],
    dimensions: list[str],
    allowed_failures: set[str],
    allowed_major_defects: set[str],
    valid_case_ids: set[str],
) -> list[str]:
    errors: list[str] = []
    case_id = result.get("caseId")
    if case_id not in valid_case_ids:
        errors.append(f"unknown caseId: {case_id!r}")
    if result.get("arm") not in {"self", "control", "treatment"}:
        errors.append(f"{case_id}: arm must be self, control, or treatment")
    arm = result.get("arm")
    for key in ("artifactPaths", "renderPaths"):
        value = result.get(key)
        if not isinstance(value, list) or not value or not all(isinstance(item, str) and item for item in value):
            errors.append(f"{case_id}: {key} must contain at least one path")
    pre_authoring = result.get("preAuthoringReview")
    if arm in {"self", "treatment"}:
        if not isinstance(pre_authoring, dict):
            errors.append(f"{case_id}: preAuthoringReview must be an object for {arm}")
        else:
            workflow_mode = pre_authoring.get("workflowMode")
            if workflow_mode not in {"new_deck", "existing_deck_revision"}:
                errors.append(f"{case_id}: preAuthoringReview.workflowMode is invalid")
            for key in ("contractPath", "validatorOutputPath"):
                if not isinstance(pre_authoring.get(key), str) or not pre_authoring[key].strip():
                    errors.append(f"{case_id}: preAuthoringReview.{key} must be non-empty")
            if pre_authoring.get("contractValidated") is not True:
                errors.append(f"{case_id}: preAuthoringReview.contractValidated must be true")
            if pre_authoring.get("dotDashCoverageVerified") is not True:
                errors.append(f"{case_id}: preAuthoringReview.dotDashCoverageVerified must be true")
            expected_stage = {
                "new_deck": "before_slide_document_creation",
                "existing_deck_revision": "before_first_mutation",
            }.get(workflow_mode)
            if expected_stage is not None and pre_authoring.get("validationStage") != expected_stage:
                errors.append(
                    f"{case_id}: preAuthoringReview.validationStage must be {expected_stage} for {workflow_mode}"
                )
            disposition = pre_authoring.get("executiveSummaryDisposition")
            allowed_dispositions = (
                {"required_present", "present", "not_required"}
                if workflow_mode == "new_deck"
                else {"present", "missing_recommended"}
            )
            if workflow_mode in {"new_deck", "existing_deck_revision"} and disposition not in allowed_dispositions:
                errors.append(f"{case_id}: preAuthoringReview.executiveSummaryDisposition is invalid for {workflow_mode}")
    scores = result.get("scores")
    if not isinstance(scores, dict):
        errors.append(f"{case_id}: scores must be an object")
    else:
        if set(scores) != set(dimensions):
            errors.append(f"{case_id}: scores must contain exactly the configured dimensions")
        for dimension in dimensions:
            score = scores.get(dimension)
            if (
                isinstance(score, bool)
                or not isinstance(score, (int, float))
                or not 1 <= score <= 5
                or abs(score * 10 - round(score * 10)) > 1e-9
            ):
                errors.append(f"{case_id}: scores.{dimension} must be from 1 to 5 in increments of 0.1")
    critical = result.get("criticalFailures")
    if not isinstance(critical, list) or any(item not in allowed_failures for item in critical):
        errors.append(f"{case_id}: criticalFailures contains an invalid value")
    major = result.get("majorDefects")
    if not isinstance(major, list) or any(item not in allowed_major_defects for item in major):
        errors.append(f"{case_id}: majorDefects contains an invalid value")
    minor = result.get("minorDefects")
    if not isinstance(minor, list) or not all(isinstance(item, str) and item.strip() for item in minor):
        errors.append(f"{case_id}: minorDefects must be a list of non-empty strings")
    consistency = result.get("deckConsistencyReview")
    if arm in {"self", "treatment"}:
        if not isinstance(consistency, dict):
            errors.append(f"{case_id}: deckConsistencyReview must be an object for {arm}")
        else:
            for key in ("themeManifestPath", "auditPath"):
                if not isinstance(consistency.get(key), str) or not consistency[key].strip():
                    errors.append(f"{case_id}: deckConsistencyReview.{key} must be non-empty")
            for key in (
                "fullDeckCompared",
                "paletteRolesVerified",
                "trackerMapVerified",
                "repeatedComponentsVerified",
            ):
                if consistency.get(key) is not True:
                    errors.append(f"{case_id}: deckConsistencyReview.{key} must be true")
            unresolved_consistency = consistency.get("unresolvedFindings")
            if not isinstance(unresolved_consistency, list) or not all(
                isinstance(item, str) and item.strip() for item in unresolved_consistency
            ):
                errors.append(
                    f"{case_id}: deckConsistencyReview.unresolvedFindings must be a list of non-empty strings"
                )
            elif unresolved_consistency:
                errors.append(f"{case_id}: deckConsistencyReview.unresolvedFindings must be empty")
    anti_slop = result.get("antiSlopReview")
    if not isinstance(anti_slop, dict):
        errors.append(f"{case_id}: antiSlopReview must be an object")
    else:
        if anti_slop.get("renderedTextInspected") is not True:
            errors.append(f"{case_id}: antiSlopReview.renderedTextInspected must be true")
        if anti_slop.get("fullDeckMontageInspected") is not True:
            errors.append(f"{case_id}: antiSlopReview.fullDeckMontageInspected must be true")
        expected_slide_count = anti_slop.get("expectedSlideCount")
        if (
            isinstance(expected_slide_count, bool)
            or not isinstance(expected_slide_count, int)
            or expected_slide_count < 1
        ):
            errors.append(f"{case_id}: antiSlopReview.expectedSlideCount must be a positive integer")
            expected_slide_count = None
        slide_audits = anti_slop.get("slideAudits")
        if not isinstance(slide_audits, list):
            errors.append(f"{case_id}: antiSlopReview.slideAudits must be a list")
        else:
            audited_slides: list[int] = []
            for index, item in enumerate(slide_audits):
                location = f"{case_id}: antiSlopReview.slideAudits[{index}]"
                if not isinstance(item, dict):
                    errors.append(f"{location} must be an object")
                    continue
                slide = item.get("slide")
                if isinstance(slide, bool) or not isinstance(slide, int) or slide < 1:
                    errors.append(f"{location}.slide must be a positive integer")
                else:
                    audited_slides.append(slide)
                if not isinstance(item.get("narrativeJob"), str) or not item["narrativeJob"].strip():
                    errors.append(f"{location}.narrativeJob must be non-empty")
                for key in (
                    "inspectedAtFullSize",
                    "deletionTestPassed",
                    "specificityTestPassed",
                    "compositionFitPassed",
                    "visualFinishPassed",
                ):
                    if item.get(key) is not True:
                        errors.append(f"{location}.{key} must be true")
                observations = item.get("observations")
                if (
                    not isinstance(observations, list)
                    or len(observations) < 2
                    or not all(isinstance(value, str) and value.strip() for value in observations)
                ):
                    errors.append(f"{location}.observations must contain at least two non-empty strings")
                unresolved = item.get("unresolvedFindings")
                if not isinstance(unresolved, list) or not all(
                    isinstance(value, str) and value.strip() for value in unresolved
                ):
                    errors.append(f"{location}.unresolvedFindings must be a list of non-empty strings")
            if expected_slide_count is not None:
                expected_slides = list(range(1, expected_slide_count + 1))
                if sorted(audited_slides) != expected_slides:
                    errors.append(
                        f"{case_id}: antiSlopReview.slideAudits must cover every slide exactly once "
                        f"from 1 to expectedSlideCount"
                    )
        comparisons = anti_slop.get("benchmarkComparisons")
        if not isinstance(comparisons, list) or len(comparisons) < 3:
            errors.append(f"{case_id}: antiSlopReview.benchmarkComparisons must contain at least three comparisons")
        else:
            allowed_dimensions = {
                "navigation",
                "hierarchy",
                "exhibit_finish",
                "table_finish",
                "density",
                "typography",
                "implication_placement",
            }
            allowed_dispositions = {"repaired", "no_material_gap"}
            for index, item in enumerate(comparisons):
                location = f"{case_id}: antiSlopReview.benchmarkComparisons[{index}]"
                if not isinstance(item, dict):
                    errors.append(f"{location} must be an object")
                    continue
                if isinstance(item.get("candidateSlide"), bool) or not isinstance(item.get("candidateSlide"), int):
                    errors.append(f"{location}.candidateSlide must be an integer")
                for key in ("reference", "observedGap"):
                    if not isinstance(item.get(key), str) or not item[key].strip():
                        errors.append(f"{location}.{key} must be non-empty")
                if item.get("dimension") not in allowed_dimensions:
                    errors.append(f"{location}.dimension is invalid")
                if item.get("disposition") not in allowed_dispositions:
                    errors.append(f"{location}.disposition is invalid")
        unexplained = anti_slop.get("unexplainedRoleLabels")
        if not isinstance(unexplained, list) or not all(isinstance(item, str) and item.strip() for item in unexplained):
            errors.append(f"{case_id}: antiSlopReview.unexplainedRoleLabels must be a list of non-empty strings")
        retained = anti_slop.get("retainedLabels")
        if not isinstance(retained, list):
            errors.append(f"{case_id}: antiSlopReview.retainedLabels must be a list")
        else:
            for index, item in enumerate(retained):
                if not isinstance(item, dict):
                    errors.append(f"{case_id}: antiSlopReview.retainedLabels[{index}] must be an object")
                    continue
                if not isinstance(item.get("slide"), (int, str)) or isinstance(item.get("slide"), bool):
                    errors.append(f"{case_id}: antiSlopReview.retainedLabels[{index}].slide must identify a slide")
                for key in ("text", "role", "indispensableDistinction"):
                    if not isinstance(item.get(key), str) or not item[key].strip():
                        errors.append(f"{case_id}: antiSlopReview.retainedLabels[{index}].{key} must be non-empty")
    evidence = result.get("evidence")
    if not isinstance(evidence, list) or len(evidence) < len(dimensions):
        errors.append(f"{case_id}: evidence must include at least one observation per dimension")
    elif not all(isinstance(item, str) and item.strip() for item in evidence):
        errors.append(f"{case_id}: evidence entries must be non-empty strings")
    return errors


def score(result: dict[str, Any], dimensions: list[str]) -> float:
    return sum(result["scores"][name] for name in dimensions) / len(dimensions) * 20


def mean(values: list[float]) -> float:
    return sum(values) / len(values)


def unresolved_slop_findings(result: dict[str, Any]) -> list[str]:
    findings: list[str] = []
    for audit in result["antiSlopReview"]["slideAudits"]:
        findings.extend(f"Slide {audit['slide']}: {item}" for item in audit["unresolvedFindings"])
    return findings


def validate_evidence_files(results_document: dict[str, Any], repo_root: Path) -> list[str]:
    """Verify that declared evidence exists inside the fresh evaluation workspace."""

    errors: list[str] = []
    preparation = results_document.get("runPreparation")
    if not isinstance(preparation, dict):
        return errors
    workspace = resolve_contained_path(
        repo_root, preparation.get("workspacePath"), "runPreparation.workspacePath", errors
    )
    if workspace is None:
        return errors
    if not workspace.is_dir():
        errors.append("runPreparation.workspacePath does not exist as a directory")
        return errors

    manifest_path = require_material_file(
        repo_root, preparation.get("manifestPath"), "runPreparation.manifestPath", errors
    )
    if manifest_path is None:
        return errors
    if manifest_path.parent != workspace:
        errors.append("runPreparation.manifestPath must be directly inside the run workspace")
    try:
        manifest = load_json(manifest_path)
    except ValueError as exc:
        errors.append(str(exc))
        return errors

    for key in ("runId", "workspacePath", "outputPath", "outputResetComplete", "priorEvalArtifactsReused"):
        expected = results_document.get("runId") if key == "runId" else preparation.get(key)
        if manifest.get(key) != expected:
            errors.append(f"run manifest {key} does not match the result document")
    package_hash = manifest.get("inputHashes", {}).get("skillPackage")
    if not isinstance(package_hash, str) or len(package_hash) != 64:
        errors.append("run manifest inputHashes.skillPackage must be a SHA-256 hex digest")

    results = results_document.get("results")
    if not isinstance(results, list):
        return errors
    for index, result in enumerate(results):
        if not isinstance(result, dict):
            continue
        label = f"results[{index}]"
        for key in ("artifactPaths", "renderPaths"):
            values = result.get(key)
            if isinstance(values, list):
                for path_index, raw_path in enumerate(values):
                    require_material_file(workspace, raw_path, f"{label}.{key}[{path_index}]", errors)
        if result.get("arm") not in {"self", "treatment"}:
            continue
        pre_authoring = result.get("preAuthoringReview")
        if isinstance(pre_authoring, dict):
            for key in ("contractPath", "validatorOutputPath"):
                require_material_file(
                    workspace, pre_authoring.get(key), f"{label}.preAuthoringReview.{key}", errors
                )
        consistency = result.get("deckConsistencyReview")
        if isinstance(consistency, dict):
            for key in ("themeManifestPath", "auditPath"):
                require_material_file(
                    workspace, consistency.get(key), f"{label}.deckConsistencyReview.{key}", errors
                )
    return errors


def evaluate(
    cases_document: dict[str, Any],
    results_document: dict[str, Any],
    mode: str,
    *,
    evidence_root: Path | None = None,
) -> tuple[list[str], dict[str, Any]]:
    errors = validate_cases(cases_document)
    if errors:
        return errors, {"passed": False}

    dimensions = cases_document["dimensions"]
    allowed_failures = set(cases_document["criticalFailures"])
    allowed_major_defects = set(cases_document["majorDefects"])
    enabled_ids = {case["id"] for case in cases_document["cases"] if case["enabled"]}
    required_fixture_ids = {
        case["id"]
        for case in cases_document["cases"]
        if case["enabled"] and case["fixture"]["required"]
    }
    if not isinstance(results_document.get("runId"), str) or not results_document["runId"].strip():
        errors.append("runId must be a non-empty string")
    if not isinstance(results_document.get("createdAt"), str) or not results_document["createdAt"].strip():
        errors.append("createdAt must be a non-empty date-time string")
    run_preparation = results_document.get("runPreparation")
    if not isinstance(run_preparation, dict):
        errors.append("runPreparation must be an object")
    else:
        for key in ("manifestPath", "workspacePath", "outputPath"):
            if not isinstance(run_preparation.get(key), str) or not run_preparation[key].strip():
                errors.append(f"runPreparation.{key} must be a non-empty string")
        if run_preparation.get("outputResetComplete") is not True:
            errors.append("runPreparation.outputResetComplete must be true")
        if run_preparation.get("priorEvalArtifactsReused") is not False:
            errors.append("runPreparation.priorEvalArtifactsReused must be false")
    skipped_items = results_document.get("skippedCases", [])
    skipped_ids: set[str] = set()
    if not isinstance(skipped_items, list):
        errors.append("skippedCases must be a list")
        skipped_items = []
    for index, skipped in enumerate(skipped_items):
        if not isinstance(skipped, dict):
            errors.append(f"skippedCases[{index}] must be an object")
            continue
        case_id = skipped.get("caseId")
        reason = skipped.get("reason")
        if case_id not in required_fixture_ids:
            errors.append(f"only enabled cases requiring fixtures may be skipped: {case_id!r}")
        if case_id in skipped_ids:
            errors.append(f"duplicate skipped case: {case_id}")
        if not isinstance(reason, str) or not reason.strip():
            errors.append(f"skippedCases[{index}].reason must be a non-empty string")
        if isinstance(case_id, str):
            skipped_ids.add(case_id)
    results = results_document.get("results")
    if not isinstance(results, list) or not results:
        return ["results must be a non-empty list"], {"passed": False}

    for index, result in enumerate(results):
        if not isinstance(result, dict):
            errors.append(f"results[{index}] must be an object")
        else:
            errors.extend(validate_result(result, dimensions, allowed_failures, allowed_major_defects, enabled_ids))
    if evidence_root is not None:
        errors.extend(validate_evidence_files(results_document, evidence_root))
    if errors:
        return errors, {"passed": False}

    grouped: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for result in results:
        key = result["caseId"]
        arm = result["arm"]
        if key in skipped_ids:
            errors.append(f"{key}: cannot be both skipped and scored")
        if arm in grouped[key]:
            errors.append(f"duplicate result for {key}/{arm}")
        grouped[key][arm] = result

    thresholds = cases_document["thresholds"]
    report: dict[str, Any] = {
        "mode": mode,
        "passed": False,
        "cases": {},
        "skippedCases": sorted(skipped_ids),
    }

    if mode == "self":
        self_results = [result for result in results if result["arm"] == "self"]
        if len(self_results) != len(results):
            errors.append("self mode accepts only self results")
        for result in self_results:
            result_score = score(result, dimensions)
            slop_findings = unresolved_slop_findings(result)
            dimension_floor_failures = [
                dimension
                for dimension in dimensions
                if result["scores"][dimension] < thresholds["minimumDimensionScore"]
            ]
            passed = (
                result_score >= thresholds["selfScoreMinimum"]
                and not result["criticalFailures"]
                and not result["majorDefects"]
                and len(result["minorDefects"]) <= thresholds["maximumMinorDefects"]
                and not dimension_floor_failures
                and not result["antiSlopReview"]["unexplainedRoleLabels"]
                and not slop_findings
            )
            report["cases"][result["caseId"]] = {
                "score": round(result_score, 2),
                "criticalFailures": result["criticalFailures"],
                "majorDefects": result["majorDefects"],
                "minorDefects": result["minorDefects"],
                "dimensionFloorFailures": dimension_floor_failures,
                "unexplainedRoleLabels": result["antiSlopReview"]["unexplainedRoleLabels"],
                "unresolvedSlopFindings": slop_findings,
                "passed": passed,
            }
        report["passed"] = not errors and bool(self_results) and all(item["passed"] for item in report["cases"].values())
        return errors, report

    expected_arms = {"control", "treatment"}
    runnable_ids = set(grouped)
    missing_cases = enabled_ids - skipped_ids - runnable_ids
    if missing_cases:
        errors.append("missing enabled cases: " + ", ".join(sorted(missing_cases)))

    control_scores: list[float] = []
    treatment_scores: list[float] = []
    dimension_control: dict[str, list[float]] = defaultdict(list)
    dimension_treatment: dict[str, list[float]] = defaultdict(list)
    treatment_critical: list[str] = []
    treatment_major: list[str] = []
    treatment_minor: list[str] = []
    treatment_floor_failures: list[str] = []
    treatment_unexplained_role_labels: list[str] = []
    treatment_unresolved_slop_findings: list[str] = []

    for case_id in sorted(runnable_ids):
        arms = grouped[case_id]
        if set(arms) != expected_arms:
            errors.append(f"{case_id}: release mode requires exactly control and treatment arms")
            continue
        control = arms["control"]
        treatment = arms["treatment"]
        control_score = score(control, dimensions)
        treatment_score = score(treatment, dimensions)
        control_scores.append(control_score)
        treatment_scores.append(treatment_score)
        treatment_critical.extend(f"{case_id}:{failure}" for failure in treatment["criticalFailures"])
        treatment_major.extend(f"{case_id}:{defect}" for defect in treatment["majorDefects"])
        treatment_minor.extend(f"{case_id}:{defect}" for defect in treatment["minorDefects"])
        treatment_floor_failures.extend(
            f"{case_id}:{dimension}"
            for dimension in dimensions
            if treatment["scores"][dimension] < thresholds["minimumDimensionScore"]
        )
        treatment_unexplained_role_labels.extend(
            f"{case_id}:{label}" for label in treatment["antiSlopReview"]["unexplainedRoleLabels"]
        )
        treatment_unresolved_slop_findings.extend(
            f"{case_id}:{finding}" for finding in unresolved_slop_findings(treatment)
        )
        for dimension in dimensions:
            dimension_control[dimension].append(control["scores"][dimension])
            dimension_treatment[dimension].append(treatment["scores"][dimension])
        report["cases"][case_id] = {
            "control": round(control_score, 2),
            "treatment": round(treatment_score, 2),
            "delta": round(treatment_score - control_score, 2),
            "treatmentCriticalFailures": treatment["criticalFailures"],
            "treatmentMajorDefects": treatment["majorDefects"],
            "treatmentMinorDefects": treatment["minorDefects"],
            "treatmentUnexplainedRoleLabels": treatment["antiSlopReview"]["unexplainedRoleLabels"],
            "treatmentUnresolvedSlopFindings": unresolved_slop_findings(treatment),
        }

    if not control_scores or errors:
        return errors, report

    control_mean = mean(control_scores)
    treatment_mean = mean(treatment_scores)
    improvement = treatment_mean - control_mean
    dimension_deltas = {
        dimension: mean(dimension_treatment[dimension]) - mean(dimension_control[dimension])
        for dimension in dimensions
    }
    regressions = {
        dimension: delta
        for dimension, delta in dimension_deltas.items()
        if delta < -thresholds["maximumDimensionRegression"]
    }
    report["aggregate"] = {
        "control": round(control_mean, 2),
        "treatment": round(treatment_mean, 2),
        "delta": round(improvement, 2),
        "dimensionDeltas": {key: round(value, 2) for key, value in dimension_deltas.items()},
        "treatmentCriticalFailures": treatment_critical,
        "treatmentMajorDefects": treatment_major,
        "treatmentMinorDefects": treatment_minor,
        "treatmentDimensionFloorFailures": treatment_floor_failures,
        "treatmentUnexplainedRoleLabels": treatment_unexplained_role_labels,
        "treatmentUnresolvedSlopFindings": treatment_unresolved_slop_findings,
    }
    report["passed"] = (
        treatment_mean >= thresholds["treatmentScoreMinimum"]
        and improvement >= thresholds["improvementMinimum"]
        and not treatment_critical
        and not treatment_major
        and len(treatment_minor) <= thresholds["maximumMinorDefects"] * len(control_scores)
        and not treatment_floor_failures
        and not treatment_unexplained_role_labels
        and not treatment_unresolved_slop_findings
        and not regressions
    )
    if regressions:
        report["aggregate"]["dimensionRegressions"] = {key: round(value, 2) for key, value in regressions.items()}
    return errors, report


def check_package() -> list[str]:
    errors: list[str] = []
    try:
        cases = load_json(CASES_PATH)
        errors.extend(validate_cases(cases))
    except ValueError as exc:
        errors.append(str(exc))
    if not INDEX_PATH.is_file() or not INDEX_PATH.read_text(encoding="utf-8").strip():
        errors.append(f"missing or empty evaluation index: {INDEX_PATH}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate the evaluation package")
    parser.add_argument("--mode", choices=("self", "release"), default="release")
    parser.add_argument("--results", type=Path, help="result JSON to validate and aggregate")
    parser.add_argument("--out", type=Path, help="optional path for the aggregate report")
    args = parser.parse_args()

    package_errors = check_package()
    if package_errors:
        print("\n".join(f"ERROR: {error}" for error in package_errors), file=sys.stderr)
        return 2
    if args.check and not args.results:
        print("Evaluation package is valid.")
        return 0
    if not args.results:
        parser.error("--results is required unless --check is used alone")

    try:
        cases = load_json(CASES_PATH)
        results = load_json(args.results)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    errors, report = evaluate(cases, results, args.mode, evidence_root=ROOT.parent)
    if errors:
        report["errors"] = errors
    output = json.dumps(report, indent=2, sort_keys=True)
    print(output)
    if args.out:
        args.out.write_text(output + "\n", encoding="utf-8")
    return 0 if report.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
