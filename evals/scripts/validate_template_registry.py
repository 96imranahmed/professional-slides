#!/usr/bin/env python3
"""Validate the professional-slides template registry and template contracts."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = REPO_ROOT / "skills" / "professional-slides"
TEMPLATES_ROOT = SKILL_ROOT / "references" / "templates"
REGISTRY_PATH = TEMPLATES_ROOT / "registry.json"
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REQUIRED_HEADINGS = {
    "mandate",
    "decision question",
    "thesis and scope",
    "story structure",
    "analytical jobs",
    "evidence",
    "page composition",
    "failure checks",
    "acceptance check",
}


def load_registry(path: Path = REGISTRY_PATH) -> dict[str, Any]:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path}: {exc}") from exc
    if not isinstance(document, dict):
        raise ValueError(f"{path}: top-level value must be an object")
    return document


def markdown_headings(path: Path) -> set[str]:
    headings: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            headings.add(line[3:].strip().lower())
    return headings


def validate_registry(
    document: dict[str, Any], templates_root: Path = TEMPLATES_ROOT
) -> list[str]:
    errors: list[str] = []
    if document.get("version") != 1:
        errors.append("registry.version must be 1")
    entries = document.get("templates")
    if not isinstance(entries, list) or not entries:
        return errors + ["registry.templates must be a non-empty list"]

    seen_ids: set[str] = set()
    seen_files: set[str] = set()
    for index, entry in enumerate(entries):
        location = f"templates[{index}]"
        if not isinstance(entry, dict):
            errors.append(f"{location} must be an object")
            continue
        template_id = entry.get("id")
        filename = entry.get("file")
        if not isinstance(template_id, str) or not ID_PATTERN.fullmatch(template_id):
            errors.append(f"{location}.id must be a kebab-case string")
        elif template_id in seen_ids:
            errors.append(f"{location}.id is duplicated: {template_id}")
        else:
            seen_ids.add(template_id)
        if (
            not isinstance(filename, str)
            or Path(filename).name != filename
            or not filename.endswith(".md")
        ):
            errors.append(f"{location}.file must name one Markdown file in the template directory")
            continue
        if filename in seen_files:
            errors.append(f"{location}.file is duplicated: {filename}")
        seen_files.add(filename)
        if isinstance(template_id, str) and filename != f"{template_id}.md":
            errors.append(f"{location}.file must match its id")
        if entry.get("status") not in {"stable", "experimental"}:
            errors.append(f"{location}.status must be stable or experimental")
        for key in ("primaryDecision",):
            if not isinstance(entry.get(key), str) or not entry[key].strip():
                errors.append(f"{location}.{key} must be a non-empty string")
        for key in ("audiences", "aliases"):
            values = entry.get(key)
            if not isinstance(values, list) or not values or not all(
                isinstance(value, str) and value.strip() for value in values
            ):
                errors.append(f"{location}.{key} must be a non-empty list of strings")

        template_path = templates_root / filename
        if not template_path.is_file():
            errors.append(f"{location}.file does not exist: {filename}")
            continue
        missing = REQUIRED_HEADINGS - markdown_headings(template_path)
        if missing:
            errors.append(f"{filename} is missing required headings: {', '.join(sorted(missing))}")
        source = template_path.read_text(encoding="utf-8")
        for required_link in (
            "../storylining/pre-authoring-contract.md",
            "../slide-types/index.md",
        ):
            if required_link not in source:
                errors.append(f"{filename} must link to {required_link}")

    unregistered = {
        path.name
        for path in templates_root.glob("*.md")
        if path.name not in {"index.md", "authoring.md"}
    } - seen_files
    if unregistered:
        errors.append("unregistered template files: " + ", ".join(sorted(unregistered)))
    return errors


def main() -> int:
    try:
        errors = validate_registry(load_registry())
    except ValueError as exc:
        errors = [str(exc)]
    if errors:
        print("\n".join(f"ERROR: {error}" for error in errors), file=sys.stderr)
        return 1
    print(f"Template registry is valid: {REGISTRY_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
