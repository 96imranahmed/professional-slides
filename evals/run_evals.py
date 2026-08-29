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
SCHEMA_PATH = ROOT / "result.schema.json"
REQUIRED_FILES = (ROOT / "rubric.md", ROOT / "evaluator-prompt.md", ROOT / "EVALS.md")


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path}: top-level value must be an object")
    return value


def validate_cases(document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    dimensions = document.get("dimensions")
    failures = document.get("criticalFailures")
    thresholds = document.get("thresholds")
    cases = document.get("cases")

    if not isinstance(dimensions, list) or len(dimensions) < 1 or len(set(dimensions)) != len(dimensions):
        errors.append("dimensions must be a non-empty unique list")
    if not isinstance(failures, list) or len(failures) < 1 or len(set(failures)) != len(failures):
        errors.append("criticalFailures must be a non-empty unique list")
    if not isinstance(thresholds, dict):
        errors.append("thresholds must be an object")
    else:
        for key in ("selfScoreMinimum", "treatmentScoreMinimum", "improvementMinimum"):
            if not isinstance(thresholds.get(key), (int, float)):
                errors.append(f"thresholds.{key} must be numeric")
        regression = thresholds.get("maximumDimensionRegression")
        if not isinstance(regression, (int, float)) or regression < 0:
            errors.append("thresholds.maximumDimensionRegression must be non-negative")

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
    valid_case_ids: set[str],
) -> list[str]:
    errors: list[str] = []
    case_id = result.get("caseId")
    if case_id not in valid_case_ids:
        errors.append(f"unknown caseId: {case_id!r}")
    if result.get("arm") not in {"self", "control", "treatment"}:
        errors.append(f"{case_id}: arm must be self, control, or treatment")
    for key in ("artifactPaths", "renderPaths"):
        value = result.get(key)
        if not isinstance(value, list) or not value or not all(isinstance(item, str) and item for item in value):
            errors.append(f"{case_id}: {key} must contain at least one path")
    scores = result.get("scores")
    if not isinstance(scores, dict):
        errors.append(f"{case_id}: scores must be an object")
    else:
        if set(scores) != set(dimensions):
            errors.append(f"{case_id}: scores must contain exactly the configured dimensions")
        for dimension in dimensions:
            score = scores.get(dimension)
            if isinstance(score, bool) or not isinstance(score, int) or not 1 <= score <= 5:
                errors.append(f"{case_id}: scores.{dimension} must be an integer from 1 to 5")
    critical = result.get("criticalFailures")
    if not isinstance(critical, list) or any(item not in allowed_failures for item in critical):
        errors.append(f"{case_id}: criticalFailures contains an invalid value")
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


def evaluate(cases_document: dict[str, Any], results_document: dict[str, Any], mode: str) -> tuple[list[str], dict[str, Any]]:
    errors = validate_cases(cases_document)
    if errors:
        return errors, {"passed": False}

    dimensions = cases_document["dimensions"]
    allowed_failures = set(cases_document["criticalFailures"])
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
            errors.extend(validate_result(result, dimensions, allowed_failures, enabled_ids))
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
            passed = result_score >= thresholds["selfScoreMinimum"] and not result["criticalFailures"]
            report["cases"][result["caseId"]] = {
                "score": round(result_score, 2),
                "criticalFailures": result["criticalFailures"],
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
        for dimension in dimensions:
            dimension_control[dimension].append(control["scores"][dimension])
            dimension_treatment[dimension].append(treatment["scores"][dimension])
        report["cases"][case_id] = {
            "control": round(control_score, 2),
            "treatment": round(treatment_score, 2),
            "delta": round(treatment_score - control_score, 2),
            "treatmentCriticalFailures": treatment["criticalFailures"],
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
    }
    report["passed"] = (
        treatment_mean >= thresholds["treatmentScoreMinimum"]
        and improvement >= thresholds["improvementMinimum"]
        and not treatment_critical
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
    try:
        schema = load_json(SCHEMA_PATH)
        if schema.get("type") != "object" or "results" not in schema.get("required", []):
            errors.append("result.schema.json does not define the required result object")
    except ValueError as exc:
        errors.append(str(exc))
    for path in REQUIRED_FILES:
        if not path.is_file() or not path.read_text(encoding="utf-8").strip():
            errors.append(f"missing or empty evaluation file: {path}")
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

    errors, report = evaluate(cases, results, args.mode)
    if errors:
        report["errors"] = errors
    output = json.dumps(report, indent=2, sort_keys=True)
    print(output)
    if args.out:
        args.out.write_text(output + "\n", encoding="utf-8")
    return 0 if report.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
