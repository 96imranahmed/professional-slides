from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VALIDATOR_PATH = ROOT / "evals" / "scripts" / "validate_reference_copy.py"
SPEC = importlib.util.spec_from_file_location("validate_reference_copy", VALIDATOR_PATH)
assert SPEC and SPEC.loader
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


def accepted_judgement(files: list[str]) -> dict:
    return {
        "rubricVersion": VALIDATOR.RUBRIC_VERSION,
        "verdict": "accept",
        "filesReviewed": files,
        "aggregateScore": 94,
        "dimensions": {
            name: {"score": 94, "rationale": f"{name} is strong."}
            for name in VALIDATOR.DIMENSIONS
        },
        "findings": [],
        "summary": "The references are concise and actionable.",
    }


class ReferenceCopyTests(unittest.TestCase):
    def make_reference_root(self, temp_dir: str) -> Path:
        root = Path(temp_dir)
        (root / "alpha.md").write_text(
            "# Alpha\n\nUse one claim.\n\n~~~css\n.long { content: 'ignore'; }\n~~~\n",
            encoding="utf-8",
        )
        (root / "beta.md").write_text(
            "# Beta\n\n~~~html\n<h1>Short title</h1><p>Visible example copy.</p>\n~~~\n",
            encoding="utf-8",
        )
        return root

    def test_packet_covers_every_reference_and_omits_executable_code(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = self.make_reference_root(temp_dir)
            packet, files = VALIDATOR.build_packet(root)
        self.assertEqual(files, ["alpha.md", "beta.md"])
        self.assertIn("Use one claim.", packet)
        self.assertIn("Short title", packet)
        self.assertIn("Visible example copy.", packet)
        self.assertNotIn(".long", packet)

    def test_acceptance_requires_full_coverage_and_scores(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = self.make_reference_root(temp_dir)
            files = ["alpha.md", "beta.md"]
            judgement = accepted_judgement(files)
            report = VALIDATOR.build_report(judgement, root, files, "gpt-5.6-terra")
        self.assertTrue(report["accepted"])
        self.assertEqual(report["validationErrors"], [])

    def test_major_finding_forces_rejection(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = self.make_reference_root(temp_dir)
            files = ["alpha.md", "beta.md"]
            judgement = accepted_judgement(files)
            judgement["verdict"] = "reject"
            judgement["findings"] = [
                {
                    "severity": "major",
                    "file": "alpha.md",
                    "location": "line 3",
                    "excerpt": "Use one claim.",
                    "reason": "The instruction lacks a decision criterion.",
                    "recommendedChange": "Name the decision criterion.",
                }
            ]
            report = VALIDATOR.build_report(judgement, root, files, "gpt-5.6-terra")
        self.assertFalse(report["accepted"])

    def test_cached_report_rejects_stale_reference_hash(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = self.make_reference_root(temp_dir)
            files = ["alpha.md", "beta.md"]
            report = VALIDATOR.build_report(
                accepted_judgement(files), root, files, "gpt-5.6-terra"
            )
            (root / "alpha.md").write_text("# Alpha\n\nChanged.\n", encoding="utf-8")
            errors = VALIDATOR.validate_cached_report(report, root, "gpt-5.6-terra")
        self.assertIn("cached report does not match the current reference files", errors)

    def test_all_current_references_are_in_the_model_packet(self):
        reference_root = ROOT / "skills" / "professional-slides" / "references"
        _, files = VALIDATOR.build_packet(reference_root)
        expected = sorted(
            path.relative_to(reference_root).as_posix()
            for path in reference_root.rglob("*.md")
        )
        self.assertEqual(files, expected)
        self.assertEqual(files, sorted(files))

    def test_prompt_delegates_manifest_coverage_to_validator(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = self.make_reference_root(temp_dir)
            prompt, files = VALIDATOR.build_prompt(root)
        self.assertEqual(files, ["alpha.md", "beta.md"])
        self.assertIn("Coverage is enforced deterministically", prompt)
        self.assertIn("never `Manifest`", prompt)


if __name__ == "__main__":
    unittest.main()
