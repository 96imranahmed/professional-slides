import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("benchmark", Path(__file__).resolve().parents[1] / "scripts" / "validate_client_deck_benchmark.py")
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class ClientDeckBenchmarkTests(unittest.TestCase):
    """Synthetic artifacts test coverage accounting, never visual quality."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        source = self.artifact("source.pdf", "synthetic source")
        candidate = self.artifact("candidate.pptx", "synthetic candidate")
        scores = dict.fromkeys(benchmark.DIMENSIONS, 95)
        review = {"sourceSha256": source["sha256"], "candidateSha256": candidate["sha256"], "accepted": True, "scores": scores, "pageComparisons": [{"sourcePages": [1, 2], "candidatePages": [1], "evidence": "Synthetic test comparison", "scores": scores, "materialLoss": False, "findings": []}]}
        case = {"id": "case", "sourcePages": [1, 2], "candidatePages": [1], "candidatePageCount": 1, "firstPassPlan": self.artifact("plan.md", "plan"), "frozenInputs": self.artifact("inputs.json", {}), "evidencePacket": self.artifact("evidence.md", "facts"), "candidate": candidate, "firstPassCandidate": candidate, "acceptedAttempt": "first-pass", "reports": {key: self.artifact(key + ".json", {"accepted": True, "candidate": {"sha256": candidate["sha256"]}}) for key in ["provenance", "hard", "visual", "consistency"]}, "backwardReview": self.artifact("review.json", review), "sourceRenders": [{**self.artifact(f"source-{p}.png", str(p)), "page": p} for p in [1, 2]], "candidateRenders": [{**self.artifact("candidate.png", "render"), "page": 1}]}
        self.source = {"id": "source", "status": "included", "reason": "Synthetic client deck", "listingUrl": "https://example.test/list", "documentUrl": "https://example.test/deck", "document": source, "pageCount": 2, "selectedPages": [1, 2], "cases": [case]}
        self.case = case
        self.manifest = {"schemaVersion": 1, "inventory": self.artifact("inventory.json", [{"id": "source", "listingUrl": "https://example.test/list"}]), "sources": [self.source]}

    def artifact(self, name, value):
        data = (json.dumps(value) if isinstance(value, (dict, list)) else value).encode()
        (self.root / name).write_bytes(data)
        return {"path": name, "sha256": hashlib.sha256(data).hexdigest()}

    def verdict(self):
        return benchmark.audit(self.manifest, self.root)

    def test_complete_synthetic_accounting_passes(self):
        self.assertTrue(self.verdict()["accepted"])

    def test_inventory_cannot_silently_drop_unavailable_entries(self):
        self.manifest["inventory"] = self.artifact("inventory.json", [{"id": "source", "listingUrl": "https://example.test/list"}, {"id": "unavailable", "listingUrl": "https://example.test/list"}])
        result = self.verdict()
        self.assertFalse(result["accepted"])
        self.assertEqual(result["counts"]["listingEntries"], 2)
        self.assertTrue(any("Every listing entry" in e["message"] for e in result["errors"]))

    def test_absent_case_and_silently_omitted_pages_fail(self):
        self.source["cases"] = []
        self.assertFalse(self.verdict()["accepted"])
        self.source["cases"] = [self.case]
        self.source["pageCount"] = 3
        self.assertFalse(self.verdict()["accepted"])
        self.source["excludedPages"] = [{"page": 3, "reason": "Prose wrapper outside the slide deck"}]
        self.assertTrue(self.verdict()["accepted"])

    def test_stale_render_or_unbound_report_fails(self):
        (self.root / "candidate.png").write_text("changed")
        self.assertFalse(self.verdict()["accepted"])
        self.case["candidateRenders"][0].update(self.artifact("candidate.png", "render"))
        self.case["reports"]["visual"] = self.artifact("visual.json", {"accepted": True, "candidate": {"sha256": "another candidate"}})
        self.assertFalse(self.verdict()["accepted"])

    def test_repaired_bytes_cannot_count_as_first_pass(self):
        self.case["firstPassCandidate"] = self.artifact("first.pptx", "different")
        self.assertFalse(self.verdict()["accepted"])
        self.case["acceptedAttempt"] = "repaired"
        self.case["repairLedger"] = self.artifact("repairs.md", "specific repairs")
        result = self.verdict()
        self.assertTrue(result["accepted"])
        self.assertEqual(result["counts"]["reportedRepairedAccepted"], 1)
        self.assertNotIn("reportedFirstPassAccepted", result["counts"])

    def test_candidate_page_omission_and_unresolved_source_fail(self):
        self.case["candidatePageCount"] = 2
        self.assertFalse(self.verdict()["accepted"])
        self.case["candidatePageCount"] = 1
        self.manifest["sources"].append({"id": "missing", "status": "unresolved", "reason": "Unavailable", "listingUrl": "https://example.test/list", "documentUrl": "https://example.test/unavailable"})
        self.assertFalse(self.verdict()["accepted"])


if __name__ == "__main__":
    unittest.main()
