#!/usr/bin/env python3
"""Validate and aggregate professional-slides self and release evaluations."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
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
PPTX_VALIDATOR_PATH = ROOT / "scripts" / "validate_pptx.py"
REFERENCE_COPY_VALIDATOR_PATH = ROOT / "scripts" / "validate_reference_copy.py"
REFERENCE_ROOT = ROOT.parent / "skills" / "professional-slides" / "references"
REFERENCE_COPY_REPORT_PATH = ROOT / "reference-copy-eval.json"
REFERENCE_FIDELITY_REPORT_PATH = ROOT / "reference-fidelity-eval.json"
REFERENCE_FIDELITY_SOURCE_PATHS = {
    "skills/professional-slides/runtime/core.mjs",
    "skills/professional-slides/runtime/page-template.mjs",
    "skills/professional-slides/runtime/text-layout.mjs",
    "skills/professional-slides/runtime/routing.mjs",
    "skills/professional-slides/runtime/overlap-policy.mjs",
    "skills/professional-slides/runtime/validate-overlap.mjs",
    "skills/professional-slides/runtime/registry.mjs",
    "skills/professional-slides/runtime/trackers.mjs",
    "skills/professional-slides/runtime/insight-tree-table.mjs",
    "skills/professional-slides/runtime/quote-cluster.mjs",
    "skills/professional-slides/runtime/maps.mjs",
    "skills/professional-slides/runtime/natural-earth-map-data.mjs",
    "skills/professional-slides/runtime/tables.mjs",
    "skills/professional-slides/runtime/table-fixtures.mjs",
    "skills/professional-slides/runtime/charts.mjs",
    "skills/professional-slides/runtime/chart-annotations.mjs",
    "skills/professional-slides/runtime/chart-group.mjs",
    "skills/professional-slides/runtime/guidance.mjs",
    "skills/professional-slides/runtime/legends.mjs",
    "skills/professional-slides/runtime/palettes.mjs",
    "skills/professional-slides/runtime/typography.mjs",
    "skills/professional-slides/runtime/design-context.mjs",
    "skills/professional-slides/runtime/golden-set.mjs",
    "evals/scripts/generate_golden_set.mjs",
    "skills/professional-slides/runtime/planner.mjs",
    "skills/professional-slides/runtime/fixtures.mjs",
    "skills/professional-slides/runtime/golden-fixtures.mjs",
    "skills/professional-slides/runtime/adapters/html.mjs",
    "skills/professional-slides/runtime/adapters/pptxgenjs.mjs",
    "skills/professional-slides/runtime/adapters/artifact-tool.mjs",
    "evals/run_evals.py",
    "evals/scripts/validate_component_runtime.mjs",
    "evals/scripts/validate_reference_fidelity.mjs",
    "package.json",
}


def load_pptx_validator():
    spec = importlib.util.spec_from_file_location("validate_pptx", PPTX_VALIDATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load PowerPoint validator: {PPTX_VALIDATOR_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


PPTX_VALIDATOR = load_pptx_validator()
SEMANTIC_VALIDATOR = PPTX_VALIDATOR
DECK_CONTRACT_VALIDATOR = PPTX_VALIDATOR
PPTX_VISUAL_VALIDATOR = PPTX_VALIDATOR
PPTX_CONSISTENCY_VALIDATOR = PPTX_VALIDATOR


def load_reference_copy_validator():
    spec = importlib.util.spec_from_file_location(
        "validate_reference_copy", REFERENCE_COPY_VALIDATOR_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(
            f"cannot load reference-copy validator: {REFERENCE_COPY_VALIDATOR_PATH}"
        )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


REFERENCE_COPY_VALIDATOR = load_reference_copy_validator()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path}: top-level value must be an object")
    return value


def validate_reference_fidelity_report(report: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    label = "reference-fidelity report"
    if report.get("schema") != "professional-slides.reference-fidelity/v1":
        errors.append(f"{label}: unsupported schema")
    if report.get("accepted") is not True:
        errors.append(f"{label}: report is not accepted")

    runtime_sources = report.get("inputs", {}).get("runtimeSources")
    if not isinstance(runtime_sources, dict) or set(runtime_sources) != REFERENCE_FIDELITY_SOURCE_PATHS:
        errors.append(f"{label}: runtime source manifest is incomplete")
    else:
        for raw_path, expected_hash in runtime_sources.items():
            source_path = ROOT.parent / raw_path
            if not source_path.is_file():
                errors.append(f"{label}: missing runtime source {raw_path}")
            elif not isinstance(expected_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
                errors.append(f"{label}: invalid source hash for {raw_path}")
            elif file_sha256(source_path) != expected_hash:
                errors.append(f"{label}: stale source hash for {raw_path}")
    source_index_hash = report.get("inputs", {}).get("sourceIndexSha256")
    if not isinstance(source_index_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", source_index_hash):
        errors.append(f"{label}: source gallery index hash is invalid")

    fixtures = report.get("fixtures")
    if not isinstance(fixtures, list) or len(fixtures) != 16:
        errors.append(f"{label}: exactly 16 source-mapped fixtures are required; replacement covers and dividers are checked in the golden set")
        fixtures = []
    source_slides: set[int] = set()
    for index, fixture in enumerate(fixtures):
        location = f"{label}.fixtures[{index}]"
        if not isinstance(fixture, dict):
            errors.append(f"{location} must be an object")
            continue
        source_slide = fixture.get("sourceSlide")
        if not isinstance(source_slide, int) or isinstance(source_slide, bool) or not 1 <= source_slide <= 205:
            errors.append(f"{location}.sourceSlide is invalid")
        elif source_slide in source_slides:
            errors.append(f"{location}.sourceSlide is duplicated")
        else:
            source_slides.add(source_slide)
        if fixture.get("accepted") is not True:
            errors.append(f"{location} is not accepted")
        if not isinstance(fixture.get("visualFamily"), str) or not fixture["visualFamily"].strip():
            errors.append(f"{location}.visualFamily must be non-empty")
        if not isinstance(fixture.get("capabilities"), list) or not fixture["capabilities"]:
            errors.append(f"{location}.capabilities must be non-empty")
        for reference_key in ("restoredReference", "upscaledReference"):
            reference = fixture.get(reference_key)
            if not isinstance(reference, dict) or not re.fullmatch(r"[0-9a-f]{64}", str(reference.get("sha256", ""))):
                errors.append(f"{location}.{reference_key} must carry a source-image hash")

    source = report.get("source")
    deck = report.get("deck")
    if not isinstance(source, dict) or source.get("referenceCount") != len(fixtures):
        errors.append(f"{label}: source reference count does not match fixtures")
    if not isinstance(deck, dict) or deck.get("slideCount") != len(fixtures):
        errors.append(f"{label}: deck slide count does not match fixtures")
    elif deck.get("sceneNodeCount", 0) < 700:
        errors.append(f"{label}: golden deck does not contain the expected editable scene")

    gates = report.get("gates")
    required_gates = (
        "browser",
        "nativeOnly",
        "overflow",
        "overlap",
        "declaredTokenInheritance",
        "chromeGeometry",
        "artifactTool",
        "visual",
    )
    if not isinstance(gates, dict):
        errors.append(f"{label}: gates must be an object")
        return errors
    for gate in required_gates:
        if not isinstance(gates.get(gate), dict) or gates[gate].get("accepted") is not True:
            errors.append(f"{label}: {gate} gate is not accepted")
    native = gates.get("nativeOnly", {})
    overlap = gates.get("overlap") if isinstance(gates.get("overlap"), dict) else {}
    expected_slide_ids = {fixture.get("id") for fixture in fixtures if isinstance(fixture, dict)}
    for source, audit in (("HTML", overlap), ("imported PPTX", overlap.get("nativeGeometry", {}))):
        if not isinstance(audit, dict) or audit.get("accepted") is not True:
            errors.append(f"{label}: {source} overlap evidence is not accepted")
            continue
        audited_slides = audit.get("slides", [])
        if audit.get("checkedSlideCount") != len(fixtures) or not isinstance(audited_slides, list) or len(audited_slides) != len(fixtures):
            errors.append(f"{label}: {source} overlap coverage is incomplete")
            continue
        if {slide.get("slide") for slide in audited_slides if isinstance(slide, dict)} != expected_slide_ids:
            errors.append(f"{label}: {source} overlap slide identities do not match fixtures")
        if audit.get("unexpectedCount") != 0 or audit.get("textOverflowCount") != 0 or audit.get("textMismatches"):
            errors.append(f"{label}: {source} overlap audit contains unresolved defects")
        for slide in audited_slides:
            if not isinstance(slide, dict) or slide.get("accepted") is not True or any(slide.get(key) for key in ("unexpected", "textOverflow", "missingNodes", "headingGapErrors")) or slide.get("checkedNodeCount", 0) <= 0:
                errors.append(f"{label}: {source} overlap slide evidence is invalid")
    if native.get("forbiddenHtmlSlides") or native.get("pptxMedia") or native.get("nativeChartParts"):
        errors.append(f"{label}: native-only gate contains forbidden raster or chart parts")
    artifact = gates.get("artifactTool", {})
    if artifact.get("objectCount") != artifact.get("expectedObjectCount"):
        errors.append(f"{label}: Artifact Tool object count does not match the scene")
    if artifact.get("missingNamedObjects"):
        errors.append(f"{label}: Artifact Tool lost named scene objects")
    geometry = artifact.get("geometry", {})
    if not isinstance(geometry, dict) or geometry.get("maximumDeltaPx", 999) > 1:
        errors.append(f"{label}: Artifact Tool geometry drift exceeds 1 px")

    thresholds = report.get("thresholds", {})
    parity_threshold = thresholds.get("parity", {}).get("fullFrameSimilarity")
    normalized = thresholds.get("normalizedReference", {})
    visual = gates.get("visual", {})
    comparisons = (
        ("minimumHtmlPptxSimilarity", parity_threshold),
        ("minimumNormalizedFullFrameSimilarity", normalized.get("fullFrameSimilarity")),
        ("minimumNormalizedBlurredStructureSimilarity", normalized.get("blurredStructureSimilarity")),
        ("minimumNormalizedBlockSsim", normalized.get("blockSsim")),
    )
    for metric, minimum in comparisons:
        if not isinstance(minimum, (int, float)) or not isinstance(visual.get(metric), (int, float)) or visual[metric] < minimum:
            errors.append(f"{label}: {metric} is below its recorded threshold")
    return errors


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
    pptx_paths = result.get("artifactPaths")
    has_pptx = isinstance(pptx_paths, list) and any(
        isinstance(value, str) and Path(value).suffix.lower() == ".pptx" for value in pptx_paths
    )
    if arm in {"self", "treatment"} and has_pptx:
        acceptance = result.get("powerpointAcceptanceReview")
        if not isinstance(acceptance, dict):
            errors.append(f"{case_id}: powerpointAcceptanceReview must be an object for {arm} PPTX output")
        else:
            for key in ("manifestPath", "reportPath"):
                if not isinstance(acceptance.get(key), str) or not acceptance[key].strip():
                    errors.append(f"{case_id}: powerpointAcceptanceReview.{key} must be non-empty")
            candidate_hash = acceptance.get("candidateSha256")
            if not isinstance(candidate_hash, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", candidate_hash):
                errors.append(f"{case_id}: powerpointAcceptanceReview.candidateSha256 must be a SHA-256 digest")
            if acceptance.get("accepted") is not True:
                errors.append(f"{case_id}: powerpointAcceptanceReview.accepted must be true")
            if not isinstance(acceptance.get("iterationCount"), int) or isinstance(
                acceptance.get("iterationCount"), bool
            ) or acceptance["iterationCount"] < 1:
                errors.append(f"{case_id}: powerpointAcceptanceReview.iterationCount must be a positive integer")
        visual_review = result.get("visualReview")
        if not isinstance(visual_review, dict):
            errors.append(f"{case_id}: visualReview must be an object for {arm} PPTX output")
        else:
            if not isinstance(visual_review.get("reportPath"), str) or not visual_review["reportPath"].strip():
                errors.append(f"{case_id}: visualReview.reportPath must be non-empty")
            if not isinstance(visual_review.get("generationScriptPath"), str) or not visual_review["generationScriptPath"].strip():
                errors.append(f"{case_id}: visualReview.generationScriptPath must be non-empty")
            visual_hash = visual_review.get("candidateSha256")
            if not isinstance(visual_hash, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", visual_hash):
                errors.append(f"{case_id}: visualReview.candidateSha256 must be a SHA-256 digest")
            if visual_review.get("accepted") is not True:
                errors.append(f"{case_id}: visualReview.accepted must be true")
            if visual_review.get("model") not in PPTX_VISUAL_VALIDATOR.VISUAL_ALLOWED_MODELS:
                errors.append(f"{case_id}: visualReview.model must be an approved independent judge")
            if not isinstance(visual_review.get("iterationCount"), int) or isinstance(
                visual_review.get("iterationCount"), bool
            ) or visual_review["iterationCount"] < 1:
                errors.append(f"{case_id}: visualReview.iterationCount must be a positive integer")
        consistency_review = result.get("crossSlideConsistencyReview")
        if not isinstance(consistency_review, dict):
            errors.append(
                f"{case_id}: crossSlideConsistencyReview must be an object for {arm} PPTX output"
            )
        else:
            if not isinstance(consistency_review.get("reportPath"), str) or not consistency_review["reportPath"].strip():
                errors.append(f"{case_id}: crossSlideConsistencyReview.reportPath must be non-empty")
            if not isinstance(consistency_review.get("generationScriptPath"), str) or not consistency_review["generationScriptPath"].strip():
                errors.append(f"{case_id}: crossSlideConsistencyReview.generationScriptPath must be non-empty")
            consistency_hash = consistency_review.get("candidateSha256")
            if not isinstance(consistency_hash, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", consistency_hash):
                errors.append(
                    f"{case_id}: crossSlideConsistencyReview.candidateSha256 must be a SHA-256 digest"
                )
            if consistency_review.get("accepted") is not True:
                errors.append(f"{case_id}: crossSlideConsistencyReview.accepted must be true")
            if consistency_review.get("model") not in PPTX_CONSISTENCY_VALIDATOR.CONSISTENCY_ALLOWED_MODELS:
                errors.append(
                    f"{case_id}: crossSlideConsistencyReview.model must be an approved independent judge"
                )
            if isinstance(visual_review, dict) and consistency_review.get("model") == visual_review.get("model"):
                errors.append(
                    f"{case_id}: crossSlideConsistencyReview.model must differ from visualReview.model"
                )
            if not isinstance(consistency_review.get("iterationCount"), int) or isinstance(
                consistency_review.get("iterationCount"), bool
            ) or consistency_review["iterationCount"] < 1:
                errors.append(
                    f"{case_id}: crossSlideConsistencyReview.iterationCount must be a positive integer"
                )
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
            for key in ("themeManifestPath", "treatmentLedgerPath", "auditPath"):
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
        resolved_artifacts: list[Path] = []
        for key in ("artifactPaths", "renderPaths"):
            values = result.get(key)
            if isinstance(values, list):
                for path_index, raw_path in enumerate(values):
                    resolved = require_material_file(
                        workspace, raw_path, f"{label}.{key}[{path_index}]", errors
                    )
                    if resolved is not None and key == "artifactPaths":
                        resolved_artifacts.append(resolved)
        if result.get("arm") not in {"self", "treatment"}:
            continue
        pre_authoring = result.get("preAuthoringReview")
        contract_path = None
        if isinstance(pre_authoring, dict):
            for key in ("contractPath", "validatorOutputPath"):
                resolved = require_material_file(
                    workspace, pre_authoring.get(key), f"{label}.preAuthoringReview.{key}", errors
                )
                if key == "contractPath":
                    contract_path = resolved
        consistency = result.get("deckConsistencyReview")
        theme_manifest_path = None
        treatment_ledger_path = None
        if isinstance(consistency, dict):
            for key in ("themeManifestPath", "treatmentLedgerPath", "auditPath"):
                resolved = require_material_file(
                    workspace, consistency.get(key), f"{label}.deckConsistencyReview.{key}", errors
                )
                if key == "themeManifestPath":
                    theme_manifest_path = resolved
                elif key == "treatmentLedgerPath":
                    treatment_ledger_path = resolved
        acceptance = result.get("powerpointAcceptanceReview")
        acceptance_manifest = None
        acceptance_report = None
        if isinstance(acceptance, dict):
            acceptance_manifest = require_material_file(
                workspace,
                acceptance.get("manifestPath"),
                f"{label}.powerpointAcceptanceReview.manifestPath",
                errors,
            )
            acceptance_report = require_material_file(
                workspace,
                acceptance.get("reportPath"),
                f"{label}.powerpointAcceptanceReview.reportPath",
                errors,
            )
        pptx_artifacts = [path for path in resolved_artifacts if path.suffix.lower() == ".pptx"]
        if pptx_artifacts and acceptance_manifest is not None:
            for artifact_path in pptx_artifacts:
                hard_report = PPTX_VALIDATOR.validate(artifact_path, acceptance_manifest)
                if not hard_report.get("accepted"):
                    codes = ", ".join(hard_report.get("summary", {}).get("findingCodes", []))
                    errors.append(f"{label}.powerpointAcceptanceReview hard validator rejected artifact: {codes}")
                actual_hash = file_sha256(artifact_path)
                if isinstance(acceptance, dict) and acceptance.get("candidateSha256", "").lower() != actual_hash:
                    errors.append(f"{label}.powerpointAcceptanceReview.candidateSha256 does not match artifact")
        if acceptance_report is not None:
            try:
                stored_report = load_json(acceptance_report)
            except ValueError as exc:
                errors.append(str(exc))
            else:
                if stored_report.get("accepted") is not True or stored_report.get("status") != "accepted":
                    errors.append(f"{label}.powerpointAcceptanceReview.reportPath must record accepted status")
                if pptx_artifacts:
                    actual_hash = file_sha256(pptx_artifacts[0])
                    stored_hash = stored_report.get("candidate", {}).get("sha256")
                    if not isinstance(stored_hash, str) or stored_hash.lower() != actual_hash:
                        errors.append(f"{label}.powerpointAcceptanceReview report hash does not match artifact")
        if contract_path is not None:
            try:
                contract = load_json(contract_path)
            except ValueError as exc:
                errors.append(str(exc))
            else:
                for contract_error in DECK_CONTRACT_VALIDATOR.validate_contract(contract):
                    errors.append(f"{label}.preAuthoringReview.contract: {contract_error}")
                for artifact_path in resolved_artifacts:
                    if artifact_path.suffix.lower() != ".pptx":
                        continue
                    for semantic_error in SEMANTIC_VALIDATOR.validate_pptx_semantics(artifact_path, contract):
                        errors.append(f"{label}.artifactSemanticAudit: {semantic_error}")
        visual_review = result.get("visualReview")
        visual_report_path = None
        generation_script_path = None
        if isinstance(visual_review, dict):
            visual_report_path = require_material_file(
                workspace,
                visual_review.get("reportPath"),
                f"{label}.visualReview.reportPath",
                errors,
            )
            generation_script_path = require_material_file(
                workspace,
                visual_review.get("generationScriptPath"),
                f"{label}.visualReview.generationScriptPath",
                errors,
            )
        render_paths: list[Path] = []
        for path_index, raw_path in enumerate(result.get("renderPaths", [])):
            resolved = resolve_contained_path(
                workspace, raw_path, f"{label}.renderPaths[{path_index}]", errors
            )
            if resolved is not None and resolved.is_file():
                render_paths.append(resolved)
        render_paths.sort(
            key=lambda path: int(match.group(1))
            if (match := PPTX_VISUAL_VALIDATOR.VISUAL_SLIDE_RENDER_RE.match(path.name))
            else 10**9
        )
        if (
            visual_report_path is not None
            and pptx_artifacts
            and contract_path is not None
            and theme_manifest_path is not None
            and treatment_ledger_path is not None
            and generation_script_path is not None
        ):
            try:
                visual_report = load_json(visual_report_path)
                expected_count = PPTX_VISUAL_VALIDATOR.visual_pptx_slide_count(pptx_artifacts[0])
                if len(render_paths) != expected_count:
                    errors.append(
                        f"{label}.visualReview must provide exactly one render for every PPTX slide"
                    )
                else:
                    visual_errors = PPTX_VISUAL_VALIDATOR.validate_visual_cached_report(
                        visual_report,
                        pptx_artifacts[0],
                        render_paths,
                        contract_path,
                        theme_manifest_path,
                        treatment_ledger_path,
                        generation_script_path,
                        visual_review.get("model") if isinstance(visual_review, dict) else None,
                    )
                    errors.extend(f"{label}.visualReview: {error}" for error in visual_errors)
                    if visual_report.get("accepted") is not True:
                        errors.append(f"{label}.visualReview report rejected the rendered deck")
                    actual_hash = file_sha256(pptx_artifacts[0])
                    if visual_review.get("candidateSha256", "").lower() != actual_hash:
                        errors.append(f"{label}.visualReview.candidateSha256 does not match artifact")
            except (ValueError, OSError) as exc:
                errors.append(str(exc))
        consistency_review = result.get("crossSlideConsistencyReview")
        consistency_report_path = None
        consistency_generation_script_path = None
        if isinstance(consistency_review, dict):
            consistency_report_path = require_material_file(
                workspace,
                consistency_review.get("reportPath"),
                f"{label}.crossSlideConsistencyReview.reportPath",
                errors,
            )
            consistency_generation_script_path = require_material_file(
                workspace,
                consistency_review.get("generationScriptPath"),
                f"{label}.crossSlideConsistencyReview.generationScriptPath",
                errors,
            )
        if (
            consistency_report_path is not None
            and pptx_artifacts
            and contract_path is not None
            and theme_manifest_path is not None
            and treatment_ledger_path is not None
            and consistency_generation_script_path is not None
            and render_paths
        ):
            try:
                consistency_report = load_json(consistency_report_path)
                consistency_errors = PPTX_CONSISTENCY_VALIDATOR.validate_consistency_cached_report(
                    consistency_report,
                    pptx_artifacts[0],
                    render_paths,
                    contract_path,
                    theme_manifest_path,
                    treatment_ledger_path,
                    consistency_generation_script_path,
                    consistency_review.get("model"),
                )
                errors.extend(
                    f"{label}.crossSlideConsistencyReview: {error}"
                    for error in consistency_errors
                )
                if consistency_report.get("accepted") is not True:
                    errors.append(
                        f"{label}.crossSlideConsistencyReview report rejected the rendered deck"
                    )
                actual_hash = file_sha256(pptx_artifacts[0])
                if consistency_review.get("candidateSha256", "").lower() != actual_hash:
                    errors.append(
                        f"{label}.crossSlideConsistencyReview.candidateSha256 does not match artifact"
                    )
                if isinstance(visual_review, dict) and consistency_review.get("model") == visual_review.get("model"):
                    errors.append(
                        f"{label}.crossSlideConsistencyReview model must differ from visualReview model"
                    )
            except (ValueError, OSError) as exc:
                errors.append(str(exc))
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


def check_package(*, include_generated: bool = True) -> list[str]:
    errors: list[str] = []
    try:
        cases = load_json(CASES_PATH)
        errors.extend(validate_cases(cases))
    except ValueError as exc:
        errors.append(str(exc))
    if not INDEX_PATH.is_file() or not INDEX_PATH.read_text(encoding="utf-8").strip():
        errors.append(f"missing or empty evaluation index: {INDEX_PATH}")
    for path in (
        PPTX_VALIDATOR_PATH,
        REFERENCE_COPY_VALIDATOR_PATH,
        REFERENCE_COPY_VALIDATOR.SCHEMA_PATH,
    ):
        if not path.is_file() or not path.read_text(encoding="utf-8").strip():
            errors.append(f"missing or empty evaluation validator: {path}")
    if not include_generated:
        return errors
    if not REFERENCE_COPY_REPORT_PATH.is_file():
        errors.append(f"missing reference-copy model report: {REFERENCE_COPY_REPORT_PATH}")
    else:
        try:
            copy_report = load_json(REFERENCE_COPY_REPORT_PATH)
        except ValueError as exc:
            errors.append(str(exc))
        else:
            errors.extend(
                f"reference-copy model report: {error}"
                for error in REFERENCE_COPY_VALIDATOR.validate_cached_report(
                    copy_report,
                    REFERENCE_ROOT,
                    REFERENCE_COPY_VALIDATOR.DEFAULT_MODEL,
                )
            )
            if copy_report.get("accepted") is not True:
                errors.append("reference-copy model report rejected the current references")
    if not REFERENCE_FIDELITY_REPORT_PATH.is_file():
        errors.append(f"missing reference-fidelity report: {REFERENCE_FIDELITY_REPORT_PATH}")
    else:
        try:
            fidelity_report = load_json(REFERENCE_FIDELITY_REPORT_PATH)
        except ValueError as exc:
            errors.append(str(exc))
        else:
            errors.extend(validate_reference_fidelity_report(fidelity_report))
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
