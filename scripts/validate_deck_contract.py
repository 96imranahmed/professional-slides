#!/usr/bin/env python3
"""Validate the professional-slides pre-authoring deck contract."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


WORKFLOW_MODES = {"new_deck", "existing_deck_revision"}
SUMMARY_STATUSES = {"required_present", "present", "missing_recommended", "not_required"}
HEADER_VARIANTS = {"tracked", "untracked", "structural"}
TERMINAL_POSITIONS = {"bottom", "none", "other"}


def load_contract(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path}: top-level value must be an object")
    return value


def non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def required_opening(contract: dict[str, Any]) -> bool:
    if contract.get("workflowMode") != "new_deck":
        return False
    template_id = contract.get("templateId")
    delivery_mode = contract.get("deliveryMode")
    chapter_count = len(contract.get("chapters", [])) if isinstance(contract.get("chapters"), list) else 0
    if template_id == "commercial-due-diligence":
        return True
    if template_id == "project-progress-update":
        return delivery_mode == "executive_pre_read" and chapter_count > 1
    if template_id == "custom":
        return delivery_mode == "executive_pre_read" and chapter_count > 1
    return False


def validate_contract(contract: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if contract.get("schemaVersion") != 1:
        errors.append("schemaVersion must equal 1")

    workflow_mode = contract.get("workflowMode")
    if workflow_mode not in WORKFLOW_MODES:
        errors.append("workflowMode must be new_deck or existing_deck_revision")

    for field in ("templateId", "deliveryMode"):
        if not non_empty_string(contract.get(field)):
            errors.append(f"{field} must be a non-empty string")

    planned_count = contract.get("plannedSlideCount")
    if isinstance(planned_count, bool) or not isinstance(planned_count, int) or planned_count < 1:
        errors.append("plannedSlideCount must be a positive integer")
        planned_count = None

    chapters = contract.get("chapters")
    chapter_labels: dict[str, str] = {}
    if not isinstance(chapters, list):
        errors.append("chapters must be a list")
        chapters = []
    for index, chapter in enumerate(chapters):
        location = f"chapters[{index}]"
        if not isinstance(chapter, dict):
            errors.append(f"{location} must be an object")
            continue
        chapter_id = chapter.get("id")
        label = chapter.get("label")
        if not non_empty_string(chapter_id):
            errors.append(f"{location}.id must be a non-empty string")
        elif chapter_id in chapter_labels:
            errors.append(f"{location}.id is duplicated: {chapter_id}")
        if not non_empty_string(label):
            errors.append(f"{location}.label must be a non-empty string")
        if non_empty_string(chapter_id) and non_empty_string(label):
            chapter_labels[chapter_id] = label

    summary = contract.get("executiveSummaryDecision")
    summary_status = None
    if not isinstance(summary, dict):
        errors.append("executiveSummaryDecision must be an object")
    else:
        summary_status = summary.get("status")
        if summary_status not in SUMMARY_STATUSES:
            errors.append("executiveSummaryDecision.status is invalid")
        if not non_empty_string(summary.get("rationale")):
            errors.append("executiveSummaryDecision.rationale must be a non-empty string")

    recommendations = contract.get("structuralRecommendations")
    if not isinstance(recommendations, list):
        errors.append("structuralRecommendations must be a list")
        recommendations = []
    for index, recommendation in enumerate(recommendations):
        location = f"structuralRecommendations[{index}]"
        if not isinstance(recommendation, dict):
            errors.append(f"{location} must be an object")
            continue
        for field in ("type", "status", "rationale"):
            if not non_empty_string(recommendation.get(field)):
                errors.append(f"{location}.{field} must be a non-empty string")

    approval = contract.get("approval")
    if not isinstance(approval, dict):
        errors.append("approval must be an object")
    elif workflow_mode == "new_deck":
        if approval.get("dotDashApproved") is not True:
            errors.append("new_deck approval.dotDashApproved must be true")
        if not non_empty_string(approval.get("reviewArtifact")):
            errors.append("new_deck approval.reviewArtifact must be a non-empty string")
    elif workflow_mode == "existing_deck_revision":
        if approval.get("asIsDotDashComplete") is not True:
            errors.append("existing_deck_revision approval.asIsDotDashComplete must be true")
        if not non_empty_string(approval.get("reviewArtifact")):
            errors.append("existing_deck_revision approval.reviewArtifact must be a non-empty string")

    slides = contract.get("slides")
    slide_by_number: dict[int, dict[str, Any]] = {}
    dot_ids: set[str] = set()
    if not isinstance(slides, list) or not slides:
        errors.append("slides must be a non-empty list")
        slides = []
    for index, slide in enumerate(slides):
        location = f"slides[{index}]"
        if not isinstance(slide, dict):
            errors.append(f"{location} must be an object")
            continue
        number = slide.get("slide")
        if isinstance(number, bool) or not isinstance(number, int) or number < 1:
            errors.append(f"{location}.slide must be a positive integer")
        elif number in slide_by_number:
            errors.append(f"{location}.slide is duplicated: {number}")
        else:
            slide_by_number[number] = slide
        dot_id = slide.get("dotId")
        if not non_empty_string(dot_id):
            errors.append(f"{location}.dotId must be a non-empty string")
        elif dot_id in dot_ids:
            errors.append(f"{location}.dotId is duplicated: {dot_id}")
        else:
            dot_ids.add(dot_id)
        for field in ("pageType", "title", "communicationJob"):
            if not non_empty_string(slide.get(field)):
                errors.append(f"{location}.{field} must be a non-empty string")
        hypothesis_ids = slide.get("hypothesisIds")
        if not isinstance(hypothesis_ids, list) or not hypothesis_ids or not all(non_empty_string(item) for item in hypothesis_ids):
            errors.append(f"{location}.hypothesisIds must contain at least one non-empty string")
        dashes = slide.get("dashes")
        if not isinstance(dashes, list) or not dashes or not all(non_empty_string(item) for item in dashes):
            errors.append(f"{location}.dashes must contain at least one substantive string")
        chapter_id = slide.get("chapterId")
        if chapter_id is not None and chapter_id not in chapter_labels:
            errors.append(f"{location}.chapterId must reference a declared chapter or be null")
        evidence_regions = slide.get("evidenceRegions")
        if isinstance(evidence_regions, bool) or not isinstance(evidence_regions, int) or evidence_regions < 0:
            errors.append(f"{location}.evidenceRegions must be a non-negative integer")
        header_variant = slide.get("headerVariant")
        if header_variant not in HEADER_VARIANTS:
            errors.append(f"{location}.headerVariant is invalid")
        if slide.get("terminalSurfacePosition") not in TERMINAL_POSITIONS:
            errors.append(f"{location}.terminalSurfacePosition is invalid")
        tracker_label = slide.get("trackerLabel")
        if tracker_label is not None and not non_empty_string(tracker_label):
            errors.append(f"{location}.trackerLabel must be null or a non-empty string")

    if planned_count is not None:
        if len(slides) != planned_count:
            errors.append("slides length must equal plannedSlideCount")
        if sorted(slide_by_number) != list(range(1, planned_count + 1)):
            errors.append("slides must enumerate every slide exactly once from 1 to plannedSlideCount")

    if workflow_mode == "existing_deck_revision":
        source_count = contract.get("sourceSlideCount")
        if isinstance(source_count, bool) or not isinstance(source_count, int) or source_count < 1:
            errors.append("existing_deck_revision sourceSlideCount must be a positive integer")
        elif planned_count is not None and source_count != planned_count:
            errors.append("existing_deck_revision sourceSlideCount must equal plannedSlideCount")

    page_types = {number: slide.get("pageType") for number, slide in slide_by_number.items()}
    has_summary = "executive_synthesis" in page_types.values()
    if required_opening(contract):
        expected = {1: "cover", 2: "executive_synthesis", 3: "contents_tracker"}
        for number, page_type in expected.items():
            if page_types.get(number) != page_type:
                errors.append(f"new deck requires slide {number} to be {page_type}")
        if summary_status != "required_present":
            errors.append("required new-deck executive summary must use status required_present")
    elif workflow_mode == "new_deck":
        if has_summary and summary_status not in {"present", "required_present"}:
            errors.append("new deck with an executive_synthesis must use status present or required_present")
        if not has_summary and summary_status != "not_required":
            errors.append("new deck without an executive_synthesis must use status not_required")
    elif workflow_mode == "existing_deck_revision":
        if has_summary and summary_status != "present":
            errors.append("existing deck with an executive_synthesis must use status present")
        if not has_summary:
            if summary_status != "missing_recommended":
                errors.append("existing deck without an executive_synthesis must use status missing_recommended")
            recommendation_found = any(
                isinstance(item, dict)
                and item.get("type") == "add_executive_summary"
                and item.get("status") == "recommended_not_forced"
                and non_empty_string(item.get("rationale"))
                for item in recommendations
            )
            if not recommendation_found:
                errors.append("existing deck without an executive_synthesis must record a recommended_not_forced add_executive_summary recommendation")

    tracker = contract.get("tracker")
    governed_slides: set[int] = set()
    tracked_contract = False
    if not isinstance(tracker, dict):
        errors.append("tracker must be an object")
    else:
        if not non_empty_string(tracker.get("system")):
            errors.append("tracker.system must be a non-empty string")
        contents_slide = tracker.get("contentsSlide")
        if contents_slide is not None and (isinstance(contents_slide, bool) or not isinstance(contents_slide, int)):
            errors.append("tracker.contentsSlide must be an integer or null")
        elif isinstance(contents_slide, int) and page_types.get(contents_slide) != "contents_tracker":
            errors.append("tracker.contentsSlide must reference a contents_tracker slide")
        transition_slides = tracker.get("transitionSlides")
        if not isinstance(transition_slides, list) or any(isinstance(item, bool) or not isinstance(item, int) for item in transition_slides):
            errors.append("tracker.transitionSlides must be a list of integers")
        else:
            for number in transition_slides:
                if page_types.get(number) != "chapter_transition":
                    errors.append(f"tracker transition slide {number} must reference a chapter_transition slide")
        analytical_header = tracker.get("analyticalHeader")
        if not isinstance(analytical_header, dict):
            errors.append("tracker.analyticalHeader must be an object")
        else:
            variant = analytical_header.get("variant")
            allowed_variants = {"tracked", "untracked"} if workflow_mode == "new_deck" else {"tracked", "untracked", "mixed_as_is"}
            if variant not in allowed_variants:
                errors.append("tracker.analyticalHeader.variant is invalid for the workflow mode")
            tracked_contract = variant == "tracked"
            governed = analytical_header.get("governedSlides")
            if not isinstance(governed, list) or any(isinstance(item, bool) or not isinstance(item, int) for item in governed):
                errors.append("tracker.analyticalHeader.governedSlides must be a list of integers")
            else:
                governed_slides = set(governed)
                if len(governed_slides) != len(governed):
                    errors.append("tracker.analyticalHeader.governedSlides must not contain duplicates")
                for number in governed:
                    if page_types.get(number) != "analytical":
                        errors.append(f"governed slide {number} must reference an analytical slide")
            required_fields = analytical_header.get("requiredFields")
            if not isinstance(required_fields, list) or not all(non_empty_string(item) for item in required_fields):
                errors.append("tracker.analyticalHeader.requiredFields must be a list of non-empty strings")
            elif tracked_contract and workflow_mode == "new_deck" and set(required_fields) != {"tracker-label", "action-title"}:
                errors.append("tracked analytical header requiredFields must contain exactly tracker-label and action-title")

    analytical_numbers = {number for number, slide in slide_by_number.items() if slide.get("pageType") == "analytical"}
    if governed_slides != analytical_numbers:
        errors.append("tracker.analyticalHeader.governedSlides must enumerate every analytical slide exactly once")
    for number in sorted(analytical_numbers):
        slide = slide_by_number[number]
        location = f"slide {number}"
        header_variant = slide.get("headerVariant")
        if workflow_mode == "existing_deck_revision":
            continue
        if tracked_contract:
            if header_variant != "tracked":
                errors.append(f"{location} must use the tracked header variant")
            chapter_id = slide.get("chapterId")
            if chapter_id not in chapter_labels:
                errors.append(f"{location} tracked header requires a declared chapterId")
            elif slide.get("trackerLabel") != chapter_labels[chapter_id]:
                errors.append(f"{location} trackerLabel must equal the exact declared chapter label")
        elif header_variant != "untracked":
            errors.append(f"{location} must use the untracked header variant")

        if workflow_mode == "new_deck" and contract.get("deliveryMode") == "executive_pre_read":
            evidence_regions = slide.get("evidenceRegions")
            if isinstance(evidence_regions, int) and not isinstance(evidence_regions, bool) and not 2 <= evidence_regions <= 4:
                if not non_empty_string(slide.get("densityException")):
                    errors.append(f"{location} must use two to four evidence regions or name a densityException")
            if slide.get("terminalSurfacePosition") not in {"bottom", "none"}:
                errors.append(f"{location} terminal action surface must be bottom or none in a new executive pre-read")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("contract", type=Path, help="Path to the deck contract JSON")
    args = parser.parse_args()
    try:
        contract = load_contract(args.contract)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1
    errors = validate_contract(contract)
    if errors:
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Deck contract is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
