from __future__ import annotations

import copy
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


blueprint_validator = load_module("validate_blueprint", ROOT / "scripts" / "validate_blueprint.py")
theme_validator = load_module("validate_theme", ROOT / "scripts" / "validate_theme.py")


class BlueprintValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.valid = json.loads((ROOT / "examples" / "deck-blueprint.example.json").read_text())

    def test_example_is_valid(self):
        errors, warnings = blueprint_validator.validate(self.valid, strict=True)
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_duplicate_id_is_rejected(self):
        data = copy.deepcopy(self.valid)
        data["slides"][1]["id"] = data["slides"][0]["id"]
        errors, _ = blueprint_validator.validate(data)
        self.assertTrue(any("duplicate id" in error for error in errors))

    def test_verified_evidence_requires_source(self):
        data = copy.deepcopy(self.valid)
        data["slides"][2]["sources"] = []
        errors, _ = blueprint_validator.validate(data)
        self.assertTrue(any("verified evidence requires" in error for error in errors))

    def test_strict_mode_rejects_placeholder(self):
        data = copy.deepcopy(self.valid)
        data["slides"][0]["actionTitle"] = "[Insert action title]"
        errors, _ = blueprint_validator.validate(data, strict=True)
        self.assertTrue(any("placeholder" in error for error in errors))


class ThemeValidationTests(unittest.TestCase):
    def test_example_is_valid(self):
        data = json.loads((ROOT / "references" / "theming" / "theme-spec.example.json").read_text())
        self.assertEqual(theme_validator.validate(data), [])


if __name__ == "__main__":
    unittest.main()

