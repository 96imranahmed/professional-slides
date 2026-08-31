#!/usr/bin/env python3
"""Prepare an isolated professional-slides evaluation run."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")


def validate_run_id(run_id: str) -> str:
    if not RUN_ID_PATTERN.fullmatch(run_id) or run_id in {".", ".."}:
        raise ValueError(
            "run id must be 1-80 characters and contain only letters, numbers, dots, hyphens, or underscores"
        )
    return run_id


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree_sha256(path: Path) -> str:
    """Hash every material file in a directory, including its relative path."""

    digest = hashlib.sha256()
    ignored = {".DS_Store", "__pycache__"}
    for source in sorted(path.rglob("*")):
        if not source.is_file() or any(part in ignored for part in source.parts):
            continue
        relative = source.relative_to(path).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        with source.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def prepare_eval_run(
    repo_root: Path,
    run_id: str,
    *,
    started_at: datetime | None = None,
) -> dict[str, Any]:
    """Clear the exact output directory and create a never-before-used run workspace."""

    run_id = validate_run_id(run_id)
    repo_root = repo_root.resolve()
    if repo_root == Path(repo_root.anchor):
        raise ValueError("repository root may not be a filesystem root")

    output_path = repo_root / "output"
    runs_root = repo_root / "tmp" / "eval-runs"
    workspace_path = runs_root / run_id

    if output_path.is_symlink():
        raise ValueError(f"refusing to clear symlinked output path: {output_path}")
    if output_path.exists() and not output_path.is_dir():
        raise ValueError(f"refusing to clear non-directory output path: {output_path}")
    if runs_root.is_symlink():
        raise ValueError(f"refusing to use symlinked eval-runs root: {runs_root}")
    if workspace_path.exists() or workspace_path.is_symlink():
        raise ValueError(
            f"run workspace already exists and may not be reused: {workspace_path}; choose a new run id"
        )

    if output_path.exists():
        shutil.rmtree(output_path)
    output_path.mkdir()
    workspace_path.mkdir(parents=True)

    started_at = started_at or datetime.now(timezone.utc)
    manifest = {
        "runId": run_id,
        "startedAt": started_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "workspacePath": str(workspace_path.relative_to(repo_root)),
        "outputPath": str(output_path.relative_to(repo_root)),
        "outputResetComplete": True,
        "priorEvalArtifactsReused": False,
        "referenceInputsMayBeReused": True,
        "generationPolicy": {
            "freshStorylines": True,
            "freshBuilders": True,
            "freshLayouts": True,
            "freshArtifacts": True,
            "freshRenders": True,
            "freshQaPackages": True,
        },
        "inputHashes": {
            "pluginManifest": file_sha256(repo_root / ".codex-plugin" / "plugin.json"),
            "skillPackage": tree_sha256(repo_root / "skills" / "professional-slides"),
            "templateRegistry": file_sha256(
                repo_root
                / "skills"
                / "professional-slides"
                / "references"
                / "templates"
                / "registry.json"
            ),
            "cases": file_sha256(repo_root / "evals" / "cases.json"),
        },
    }
    manifest_path = workspace_path / "run-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Clear the eval output directory and create an isolated, never-reused run workspace."
    )
    parser.add_argument("--run-id", required=True, help="Unique identifier for this evaluation run")
    args = parser.parse_args()

    try:
        manifest = prepare_eval_run(ROOT, args.run_id)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
