from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


eval_runner = load_module("run_evals", ROOT / "evals" / "run_evals.py")


class EvalRunnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = json.loads((ROOT / "evals" / "cases.json").read_text())
        cls.dimensions = cls.cases["dimensions"]
        cls.case_ids = [case["id"] for case in cls.cases["cases"] if case["enabled"]]

    def result(self, case_id: str, arm: str, value: int, failures=None):
        return {
            "caseId": case_id,
            "arm": arm,
            "artifactPaths": [f"{case_id}/{arm}/deck.pptx"],
            "renderPaths": [f"{case_id}/{arm}/slide-1.png"],
            "scores": {dimension: value for dimension in self.dimensions},
            "criticalFailures": failures or [],
            "evidence": [f"Observed evidence for {dimension}" for dimension in self.dimensions],
        }

    def document(self, results, skipped=None):
        return {
            "runId": "test-run",
            "createdAt": "2026-08-29T12:00:00Z",
            "skippedCases": skipped or [],
            "results": results,
        }

    def test_package_is_valid(self):
        self.assertEqual(eval_runner.check_package(), [])

    def test_release_passes_with_complete_improvement(self):
        results = []
        for case_id in self.case_ids:
            results.append(self.result(case_id, "control", 3))
            results.append(self.result(case_id, "treatment", 5))
        errors, report = eval_runner.evaluate(self.cases, self.document(results), "release")
        self.assertEqual(errors, [])
        self.assertTrue(report["passed"])
        self.assertEqual(report["aggregate"]["delta"], 40.0)

    def test_treatment_critical_failure_fails_release(self):
        results = []
        for index, case_id in enumerate(self.case_ids):
            results.append(self.result(case_id, "control", 3))
            failures = ["misleading_chart"] if index == 0 else []
            results.append(self.result(case_id, "treatment", 5, failures))
        errors, report = eval_runner.evaluate(self.cases, self.document(results), "release")
        self.assertEqual(errors, [])
        self.assertFalse(report["passed"])

    def test_release_requires_both_arms(self):
        results = [self.result(case_id, "treatment", 5) for case_id in self.case_ids]
        errors, report = eval_runner.evaluate(self.cases, self.document(results), "release")
        self.assertTrue(any("requires exactly control and treatment" in error for error in errors))
        self.assertFalse(report["passed"])

    def test_self_mode_uses_absolute_gate(self):
        result = self.result(self.case_ids[0], "self", 4)
        errors, report = eval_runner.evaluate(self.cases, self.document([result]), "self")
        self.assertEqual(errors, [])
        self.assertTrue(report["passed"])

    def test_missing_reference_fixture_can_be_explicitly_skipped(self):
        reference_case = "reference-theme-fidelity"
        results = []
        for case_id in self.case_ids:
            if case_id == reference_case:
                continue
            results.append(self.result(case_id, "control", 3))
            results.append(self.result(case_id, "treatment", 5))
        document = self.document(
            results,
            [{"caseId": reference_case, "reason": "Authorized reference fixture unavailable"}],
        )
        errors, report = eval_runner.evaluate(self.cases, document, "release")
        self.assertEqual(errors, [])
        self.assertTrue(report["passed"])
        self.assertEqual(report["skippedCases"], [reference_case])


if __name__ == "__main__":
    unittest.main()
