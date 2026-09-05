from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


prepare = load_module("prepare_eval_run", ROOT / "evals" / "scripts" / "prepare_eval_run.py")


class PrepareEvalRunTests(unittest.TestCase):
    def make_repo(self, root: Path) -> None:
        (root / "evals").mkdir()
        plugin_root = root
        (plugin_root / ".codex-plugin").mkdir(parents=True)
        skill_root = plugin_root / "skills" / "professional-slides"
        templates_root = skill_root / "references" / "templates"
        templates_root.mkdir(parents=True)
        (plugin_root / ".codex-plugin" / "plugin.json").write_text(
            '{"name": "professional-slides"}\n', encoding="utf-8"
        )
        (skill_root / "SKILL.md").write_text("fresh skill\n", encoding="utf-8")
        (templates_root / "registry.json").write_text(
            '{"version": 1, "templates": []}\n', encoding="utf-8"
        )
        (root / "evals" / "cases.json").write_text('{"version": 1}\n', encoding="utf-8")

    def test_clears_complete_output_and_creates_unique_workspace(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_repo(root)
            stale = root / "output" / "previous-run" / "deck.pptx"
            stale.parent.mkdir(parents=True)
            stale.write_text("stale", encoding="utf-8")

            manifest = prepare.prepare_eval_run(
                root,
                "run-20260830",
                started_at=datetime(2026, 8, 30, 12, 0, tzinfo=timezone.utc),
            )

            self.assertEqual(list((root / "output").iterdir()), [])
            workspace = root / manifest["workspacePath"]
            self.assertTrue(workspace.is_dir())
            recorded = json.loads((workspace / "run-manifest.json").read_text(encoding="utf-8"))
            self.assertTrue(recorded["outputResetComplete"])
            self.assertFalse(recorded["priorEvalArtifactsReused"])
            self.assertTrue(all(recorded["generationPolicy"].values()))
            self.assertEqual(len(recorded["inputHashes"]["pluginManifest"]), 64)
            self.assertEqual(len(recorded["inputHashes"]["skillPackage"]), 64)
            self.assertEqual(len(recorded["inputHashes"]["templateRegistry"]), 64)
            self.assertEqual(len(recorded["inputHashes"]["cases"]), 64)

    def test_skill_package_hash_changes_when_a_supporting_file_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_repo(root)
            skill_root = root / "skills" / "professional-slides"
            before = prepare.tree_sha256(skill_root)
            supporting = skill_root / "references" / "guide.md"
            supporting.write_text("material guidance\n", encoding="utf-8")
            after = prepare.tree_sha256(skill_root)
            self.assertNotEqual(before, after)

    def test_existing_run_workspace_is_rejected_before_output_is_cleared(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_repo(root)
            (root / "tmp" / "eval-runs" / "used-run").mkdir(parents=True)
            output = root / "output"
            output.mkdir()
            sentinel = output / "keep-until-new-id-is-chosen"
            sentinel.write_text("present", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "may not be reused"):
                prepare.prepare_eval_run(root, "used-run")

            self.assertTrue(sentinel.exists())

    def test_symlinked_output_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_repo(root)
            target = root / "outside"
            target.mkdir()
            (root / "output").symlink_to(target, target_is_directory=True)

            with self.assertRaisesRegex(ValueError, "symlinked output"):
                prepare.prepare_eval_run(root, "safe-run")

            self.assertTrue(target.exists())

    def test_invalid_run_id_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_repo(root)

            with self.assertRaisesRegex(ValueError, "run id"):
                prepare.prepare_eval_run(root, "../escape")


if __name__ == "__main__":
    unittest.main()
