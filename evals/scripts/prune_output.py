"""Report, and on request remove, superseded task directories under output/.

The README describes a retention policy - keep the latest useful output and the
inputs a rebuild or a QA pass still needs, remove superseded task-owned
intermediates - and nothing enforced it, so `output/` grew to several gigabytes
beside a repository of a few dozen megabytes.

Deleting generated work is not something a tool should do because it ran, so
this prints what it would remove and stops. `--delete` is the only thing that
removes anything, and it still refuses to touch the newest run of any task.

    python3 evals/scripts/prune_output.py                 # report only
    python3 evals/scripts/prune_output.py --keep 3        # report, keeping 3
    python3 evals/scripts/prune_output.py --keep 2 --delete

A "task" is a directory directly under output/; its "runs" are the directories
directly under that. Anything that is not a directory, and any task with no
run subdirectories, is left alone and reported as such.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def directory_bytes(path: Path) -> int:
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def plan(output: Path, keep: int) -> dict:
    """Which run directories are superseded, newest first within each task."""
    tasks, superseded = [], []
    for task in sorted(p for p in output.iterdir() if p.is_dir()):
        runs = sorted((p for p in task.iterdir() if p.is_dir()),
                      key=lambda p: p.stat().st_mtime, reverse=True)
        tasks.append({"task": task.name, "runs": len(runs)})
        for run in runs[keep:]:
            superseded.append(run)
    return {
        "output": str(output),
        "keep": keep,
        "tasks": tasks,
        "supersededRuns": [
            {"path": str(run.relative_to(output)), "bytes": directory_bytes(run)}
            for run in superseded
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, default=ROOT / "output")
    parser.add_argument("--keep", type=int, default=2,
                        help="run directories to keep per task, newest first (default 2)")
    parser.add_argument("--delete", action="store_true",
                        help="actually remove the superseded runs; without it nothing is touched")
    args = parser.parse_args()
    if args.keep < 1:
        parser.error("--keep must be at least 1: the newest run of a task is never removed")
    if not args.output.is_dir():
        print(json.dumps({"output": str(args.output), "present": False}))
        return 0

    report = plan(args.output, args.keep)
    report["reclaimable"] = sum(run["bytes"] for run in report["supersededRuns"])
    report["deleted"] = False
    if args.delete:
        for run in report["supersededRuns"]:
            shutil.rmtree(args.output / run["path"])
        report["deleted"] = True
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
