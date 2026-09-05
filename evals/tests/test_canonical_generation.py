from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VALIDATOR_PATH = ROOT / "evals" / "scripts" / "validate_pptx.py"


def load_validator():
    spec = importlib.util.spec_from_file_location("canonical_generation_validator", VALIDATOR_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


validator = load_validator()


class CanonicalGenerationTests(unittest.TestCase):
    def generate(self, directory: Path, extra_source: str = ""):
        generator = directory / "build-deck.mjs"
        output = directory / "generated"
        runtime_url = (ROOT / "skills" / "professional-slides" / "runtime" / "generation.mjs").as_uri()
        generator.write_text(
            f'''import {{ writeCanonicalDeckPlan }} from {json.dumps(runtime_url)};
{extra_source}
const deckPlan = {{
  id: "canonical-test",
  palette: "mckinsey",
  slides: [
    {{ kind: "cover", id: "cover", title: "A canonical deck", subtitle: "Built through the shared runtime" }},
    {{
      id: "evidence",
      title: "Revenue growth is concentrated in one segment",
      density: "executive",
      layout: "absolute",
      copyBudget: {{ maxWordsPerSlide: 80, rationale: "Chart labels and one synthesis sentence" }},
      items: [
        {{ id: "chart", job: "show segment growth", component: "chart.column", frame: {{ x: 0, y: 10, width: 760, height: 390 }}, props: {{ categories: ["Search", "Cloud", "Other"], series: [{{ name: "Growth", values: [9, 11, 2] }}], yMax: 12, dataLabels: true, annotations: [], highlights: [], referenceLines: [] }} }},
        {{ id: "synthesis", job: "state the implication", component: "insight", frame: {{ x: 800, y: 60, width: 360, height: 180 }}, props: {{ text: "Cloud and Search account for most of the measured increase." }} }}
      ]
    }}
  ]
}};
await writeCanonicalDeckPlan({{ deckPlan, outputDirectory: {json.dumps(str(output))}, fileStem: "candidate", authoringScriptPath: new URL(import.meta.url).pathname }});
''',
            encoding="utf-8",
        )
        runtime_node = os.environ.get("RUNTIME_NODE", "node")
        completed = subprocess.run([runtime_node, str(generator)], cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(completed.returncode, 0, completed.stderr or completed.stdout)
        return generator, output / "candidate.pptx", output / "canonical-generation-receipt.json"

    def test_accepts_a_deck_exported_by_the_shared_golden_pipeline(self):
        with tempfile.TemporaryDirectory() as directory:
            generator, pptx, receipt = self.generate(Path(directory))
            report = validator.validate_canonical_generation(pptx, receipt, generator, require_planning=True)
            self.assertTrue(report["accepted"], report["findings"])

    def test_rejects_direct_pptxgenjs_bypass_even_with_a_valid_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            generator, pptx, receipt = self.generate(Path(directory), 'const forbiddenDirectAdapter = "pptxgenjs";')
            report = validator.validate_canonical_generation(pptx, receipt, generator, require_planning=True)
            self.assertFalse(report["accepted"])
            self.assertIn("generation.direct_adapter_bypass", report["summary"]["findingCodes"])

    def test_rejects_a_candidate_not_bound_to_the_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            generator, pptx, receipt = self.generate(Path(directory))
            pptx.write_bytes(pptx.read_bytes() + b"changed")
            report = validator.validate_canonical_generation(pptx, receipt, generator, require_planning=True)
            self.assertFalse(report["accepted"])
            self.assertIn("generation.candidate_hash", report["summary"]["findingCodes"])

    def test_rejects_a_tampered_html_observer_page(self):
        with tempfile.TemporaryDirectory() as directory:
            generator, pptx, receipt = self.generate(Path(directory))
            payload = json.loads(receipt.read_text(encoding="utf-8"))
            Path(payload["html"][0]["path"]).write_text("tampered", encoding="utf-8")
            report = validator.validate_canonical_generation(pptx, receipt, generator, require_planning=True)
            self.assertFalse(report["accepted"])
            self.assertIn("generation.html_hash", report["summary"]["findingCodes"])


if __name__ == "__main__":
    unittest.main()
