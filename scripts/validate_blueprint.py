#!/usr/bin/env python3
"""Validate a professional-slides deck blueprint without third-party packages."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


ARCHETYPES = {
    "title",
    "section-divider",
    "executive-synthesis",
    "decomposition",
    "chart-led-insight",
    "comparison-options",
    "process-roadmap",
    "recommendation-action-plan",
    "appendix",
}
CHART_TYPES = {
    "bar",
    "column",
    "line",
    "stacked",
    "waterfall",
    "scatter",
    "bubble",
    "heatmap",
    "table",
}
OUTPUT_FORMATS = {"pptx", "google-slides", "pdf"}
DELIVERY_MODES = {"live", "pre-read", "workshop", "analytical-pack"}
EVIDENCE_STATES = {"verified", "illustrative", "unresolved"}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
PLACEHOLDER = re.compile(r"(?:\blorem ipsum\b|\bxxx\b|\btbd\b|\[insert[^]]*\])", re.I)


def _is_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate(data: Any, strict: bool = False) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(data, dict):
        return ["root: must be a JSON object"], warnings

    for key in ("deck", "theme", "story", "slides"):
        if key not in data:
            errors.append(f"root: missing required key '{key}'")

    deck = data.get("deck", {})
    if not isinstance(deck, dict):
        errors.append("deck: must be an object")
        deck = {}
    for key in ("title", "audience", "purpose", "governingThought"):
        if not _is_text(deck.get(key)):
            errors.append(f"deck.{key}: must be non-empty text")
    if deck.get("deliveryMode") not in DELIVERY_MODES:
        errors.append(f"deck.deliveryMode: expected one of {sorted(DELIVERY_MODES)}")
    formats = deck.get("outputFormats")
    if not isinstance(formats, list) or not formats:
        errors.append("deck.outputFormats: must be a non-empty array")
    elif any(item not in OUTPUT_FORMATS for item in formats):
        errors.append(f"deck.outputFormats: expected values from {sorted(OUTPUT_FORMATS)}")
    elif len(formats) != len(set(formats)):
        errors.append("deck.outputFormats: duplicate values are not allowed")

    theme = data.get("theme", {})
    if not isinstance(theme, dict):
        errors.append("theme: must be an object")
        theme = {}
    if theme.get("aspectRatio") not in {"16:9", "4:3", "custom"}:
        errors.append("theme.aspectRatio: expected 16:9, 4:3, or custom")
    if not _is_text(theme.get("fontFamily")):
        errors.append("theme.fontFamily: must be non-empty text")
    if not isinstance(theme.get("accentColor"), str) or not HEX.fullmatch(theme["accentColor"]):
        errors.append("theme.accentColor: must be a six-digit hex color")
    if "referenceDeck" not in theme or not isinstance(theme.get("referenceDeck"), (str, type(None))):
        errors.append("theme.referenceDeck: must be text or null")

    story = data.get("story", {})
    if not isinstance(story, dict):
        errors.append("story: must be an object")
        story = {}
    chapters = story.get("chapters")
    if not isinstance(chapters, list) or not chapters or any(not _is_text(c) for c in chapters):
        errors.append("story.chapters: must be a non-empty array of non-empty text")
        chapters = []
    elif len(chapters) != len(set(chapters)):
        errors.append("story.chapters: duplicate chapter names are not allowed")

    slides = data.get("slides")
    if not isinstance(slides, list) or not slides:
        errors.append("slides: must be a non-empty array")
        return errors, warnings

    ids: set[str] = set()
    numbers: list[int] = []
    for index, slide in enumerate(slides, start=1):
        path = f"slides[{index - 1}]"
        if not isinstance(slide, dict):
            errors.append(f"{path}: must be an object")
            continue
        number = slide.get("number")
        if not isinstance(number, int) or isinstance(number, bool) or number < 1:
            errors.append(f"{path}.number: must be a positive integer")
        else:
            numbers.append(number)
        slide_id = slide.get("id")
        if not isinstance(slide_id, str) or not SLUG.fullmatch(slide_id):
            errors.append(f"{path}.id: must be a lowercase hyphenated slug")
        elif slide_id in ids:
            errors.append(f"{path}.id: duplicate id '{slide_id}'")
        else:
            ids.add(slide_id)
        if slide.get("chapter") not in chapters:
            errors.append(f"{path}.chapter: must match story.chapters")
        archetype = slide.get("archetype")
        if archetype not in ARCHETYPES:
            errors.append(f"{path}.archetype: expected one of {sorted(ARCHETYPES)}")
        for key in ("actionTitle", "primaryClaim", "dominantExhibit", "implication"):
            if not _is_text(slide.get(key)):
                errors.append(f"{path}.{key}: must be non-empty text")
            elif PLACEHOLDER.search(slide[key]):
                message = f"{path}.{key}: contains unresolved placeholder text"
                (errors if strict else warnings).append(message)
        if not isinstance(slide.get("speakerNotes"), str):
            errors.append(f"{path}.speakerNotes: must be text")
        chart_type = slide.get("chartType")
        if chart_type is not None and chart_type not in CHART_TYPES:
            errors.append(f"{path}.chartType: expected one of {sorted(CHART_TYPES)}")
        if archetype == "chart-led-insight" and chart_type is None:
            errors.append(f"{path}.chartType: required for chart-led-insight")

        evidence = slide.get("evidence")
        if not isinstance(evidence, list):
            errors.append(f"{path}.evidence: must be an array")
            evidence = []
        verified = False
        for evidence_index, item in enumerate(evidence):
            epath = f"{path}.evidence[{evidence_index}]"
            if not isinstance(item, dict):
                errors.append(f"{epath}: must be an object")
                continue
            if not _is_text(item.get("claim")):
                errors.append(f"{epath}.claim: must be non-empty text")
            if item.get("status") not in EVIDENCE_STATES:
                errors.append(f"{epath}.status: expected one of {sorted(EVIDENCE_STATES)}")
            verified = verified or item.get("status") == "verified"

        sources = slide.get("sources")
        if not isinstance(sources, list):
            errors.append(f"{path}.sources: must be an array")
            sources = []
        for source_index, item in enumerate(sources):
            spath = f"{path}.sources[{source_index}]"
            if not isinstance(item, dict):
                errors.append(f"{spath}: must be an object")
                continue
            for key in ("label", "location"):
                if not _is_text(item.get(key)):
                    errors.append(f"{spath}.{key}: must be non-empty text")
        if verified and not sources:
            errors.append(f"{path}.sources: verified evidence requires at least one source")
        if len(slide.get("actionTitle", "")) > 180:
            warnings.append(f"{path}.actionTitle: likely too long for a two-line title")

    expected_numbers = list(range(1, len(slides) + 1))
    if sorted(numbers) != expected_numbers:
        errors.append(f"slides.number: expected contiguous unique values {expected_numbers}")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("blueprint", type=Path)
    parser.add_argument("--strict", action="store_true", help="Treat placeholder warnings as errors")
    args = parser.parse_args()
    try:
        data = json.loads(args.blueprint.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    errors, warnings = validate(data, strict=args.strict)
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if errors:
        print(f"Blueprint invalid: {len(errors)} error(s), {len(warnings)} warning(s)", file=sys.stderr)
        return 1
    print(f"Blueprint valid: {len(data['slides'])} slide(s), {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

