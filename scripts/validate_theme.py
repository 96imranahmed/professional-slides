#!/usr/bin/env python3
"""Validate a professional-slides theme specification without dependencies."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
COLOR_ROLES = {"ink", "mutedInk", "paper", "panel", "rule", "accent", "darkCanvas", "onDark"}
TEXT_ROLES = {"display", "actionTitle", "body", "micro"}


def validate(data: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["root: must be a JSON object"]
    for key in ("name", "canvas", "grid", "typography", "colors", "charts", "components", "platformFallbacks"):
        if key not in data:
            errors.append(f"root: missing required key '{key}'")
    if not isinstance(data.get("name"), str) or not data["name"].strip():
        errors.append("name: must be non-empty text")

    canvas = data.get("canvas", {})
    if not isinstance(canvas, dict):
        errors.append("canvas: must be an object")
    else:
        if canvas.get("aspectRatio") not in {"16:9", "4:3", "custom"}:
            errors.append("canvas.aspectRatio: expected 16:9, 4:3, or custom")
        for key in ("widthInches", "heightInches"):
            if not isinstance(canvas.get(key), (int, float)) or isinstance(canvas.get(key), bool) or canvas[key] <= 0:
                errors.append(f"canvas.{key}: must be a positive number")

    grid = data.get("grid", {})
    if not isinstance(grid, dict):
        errors.append("grid: must be an object")
    else:
        if not isinstance(grid.get("columns"), int) or isinstance(grid.get("columns"), bool) or grid["columns"] < 2:
            errors.append("grid.columns: must be an integer of at least 2")
        for key in ("marginInches", "gutterInches"):
            if not isinstance(grid.get(key), (int, float)) or isinstance(grid.get(key), bool) or grid[key] < 0:
                errors.append(f"grid.{key}: must be a non-negative number")
        if not isinstance(grid.get("baseUnitPoints"), (int, float)) or isinstance(grid.get("baseUnitPoints"), bool) or grid.get("baseUnitPoints", 0) <= 0:
            errors.append("grid.baseUnitPoints: must be a positive number")

    typography = data.get("typography", {})
    if not isinstance(typography, dict):
        errors.append("typography: must be an object")
    else:
        if not isinstance(typography.get("primaryFamily"), str) or not typography["primaryFamily"].strip():
            errors.append("typography.primaryFamily: must be non-empty text")
        fallbacks = typography.get("fallbackFamilies")
        if not isinstance(fallbacks, list) or not fallbacks or any(not isinstance(x, str) or not x.strip() for x in fallbacks):
            errors.append("typography.fallbackFamilies: must be a non-empty text array")
        roles = typography.get("roles")
        if not isinstance(roles, dict):
            errors.append("typography.roles: must be an object")
        else:
            missing = TEXT_ROLES - set(roles)
            if missing:
                errors.append(f"typography.roles: missing {sorted(missing)}")
            for role, spec in roles.items():
                if not isinstance(spec, dict):
                    errors.append(f"typography.roles.{role}: must be an object")
                    continue
                if not isinstance(spec.get("sizePoints"), (int, float)) or isinstance(spec.get("sizePoints"), bool) or spec.get("sizePoints", 0) <= 0:
                    errors.append(f"typography.roles.{role}.sizePoints: must be positive")

    colors = data.get("colors", {})
    if not isinstance(colors, dict):
        errors.append("colors: must be an object")
    else:
        missing = COLOR_ROLES - set(colors)
        if missing:
            errors.append(f"colors: missing {sorted(missing)}")
        for role, value in colors.items():
            if not isinstance(value, str) or not HEX.fullmatch(value):
                errors.append(f"colors.{role}: must be a six-digit hex color")

    for parent, keys in {
        "charts": {"seriesOrder", "gridline", "axis"},
        "components": {"title", "footer", "sectionTracker"},
        "platformFallbacks": {"powerpoint", "googleSlides"},
    }.items():
        value = data.get(parent)
        if not isinstance(value, dict):
            errors.append(f"{parent}: must be an object")
        else:
            missing = keys - set(value)
            if missing:
                errors.append(f"{parent}: missing {sorted(missing)}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("theme", type=Path)
    args = parser.parse_args()
    try:
        data = json.loads(args.theme.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    errors = validate(data)
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if errors:
        print(f"Theme invalid: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"Theme valid: {data['name']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

