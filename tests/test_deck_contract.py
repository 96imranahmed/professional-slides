from __future__ import annotations

import importlib.util
import unittest
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


validator = load_module("validate_deck_contract", ROOT / "scripts" / "validate_deck_contract.py")


def slide(number, page_type, chapter_id=None, header="structural", tracker_label=None, regions=1):
    return {
        "slide": number,
        "dotId": f"D{number:02d}",
        "pageType": page_type,
        "title": f"Slide {number} advances the decision",
        "communicationJob": f"Perform narrative job {number}",
        "chapterId": chapter_id,
        "hypothesisIds": ["NAV"] if page_type in {"cover", "contents_tracker", "chapter_transition"} else ["H1"],
        "dashes": ["Provide page-specific support"],
        "evidenceRegions": regions,
        "terminalSurfacePosition": "bottom" if page_type == "analytical" else "none",
        "headerVariant": header,
        "trackerLabel": tracker_label,
    }


class DeckContractTests(unittest.TestCase):
    def new_dd(self):
        return {
            "schemaVersion": 1,
            "workflowMode": "new_deck",
            "templateId": "commercial-due-diligence",
            "deliveryMode": "executive_pre_read",
            "plannedSlideCount": 4,
            "chapters": [{"id": "market", "label": "Market attractiveness"}],
            "executiveSummaryDecision": {"status": "required_present", "rationale": "The committee needs the answer first."},
            "structuralRecommendations": [],
            "tracker": {
                "system": "segmented_full_state",
                "contentsSlide": 3,
                "transitionSlides": [],
                "analyticalHeader": {
                    "variant": "tracked",
                    "governedSlides": [4],
                    "requiredFields": ["tracker-label", "action-title"],
                },
            },
            "approval": {"dotDashApproved": True, "reviewArtifact": "story/dot-dash.md"},
            "slides": [
                slide(1, "cover", regions=0),
                slide(2, "executive_synthesis", regions=3),
                slide(3, "contents_tracker"),
                slide(4, "analytical", "market", "tracked", "Market attractiveness", 3),
            ],
        }

    def existing_without_summary(self):
        return {
            "schemaVersion": 1,
            "workflowMode": "existing_deck_revision",
            "templateId": "custom",
            "deliveryMode": "executive_presentation",
            "plannedSlideCount": 2,
            "sourceSlideCount": 2,
            "chapters": [],
            "executiveSummaryDecision": {"status": "missing_recommended", "rationale": "An answer-first page would improve executive scanability."},
            "structuralRecommendations": [{
                "type": "add_executive_summary",
                "status": "recommended_not_forced",
                "rationale": "Add only if the owner authorizes a structural change.",
            }],
            "tracker": {
                "system": "mixed_as_is",
                "contentsSlide": None,
                "transitionSlides": [],
                "analyticalHeader": {"variant": "mixed_as_is", "governedSlides": [2], "requiredFields": []},
            },
            "approval": {"asIsDotDashComplete": True, "reviewArtifact": "story/as-is-dot-dash.md"},
            "slides": [slide(1, "cover", regions=0), slide(2, "analytical", header="untracked", regions=1)],
        }

    def test_valid_new_due_diligence_contract_passes(self):
        self.assertEqual(validator.validate_contract(self.new_dd()), [])

    def test_new_due_diligence_cannot_omit_executive_summary(self):
        contract = self.new_dd()
        contract["slides"][1]["pageType"] = "analytical"
        errors = validator.validate_contract(contract)
        self.assertTrue(any("slide 2 to be executive_synthesis" in error for error in errors))

    def test_new_due_diligence_requires_validation_approval_state(self):
        contract = self.new_dd()
        contract["approval"]["dotDashApproved"] = False
        errors = validator.validate_contract(contract)
        self.assertIn("new_deck approval.dotDashApproved must be true", errors)

    def test_new_tracked_header_requires_exact_chapter_label(self):
        contract = self.new_dd()
        contract["slides"][3]["trackerLabel"] = "Market"
        errors = validator.validate_contract(contract)
        self.assertTrue(any("trackerLabel must equal the exact declared chapter label" in error for error in errors))

    def test_existing_deck_can_retain_missing_executive_summary(self):
        self.assertEqual(validator.validate_contract(self.existing_without_summary()), [])

    def test_existing_deck_must_enumerate_every_source_slide(self):
        contract = self.existing_without_summary()
        contract["sourceSlideCount"] = 3
        errors = validator.validate_contract(contract)
        self.assertIn("existing_deck_revision sourceSlideCount must equal plannedSlideCount", errors)

    def test_existing_missing_summary_requires_non_forcing_recommendation(self):
        contract = self.existing_without_summary()
        contract["structuralRecommendations"] = []
        errors = validator.validate_contract(contract)
        self.assertTrue(any("recommended_not_forced add_executive_summary" in error for error in errors))

    def test_existing_inventory_does_not_fail_for_mixed_header_grammar(self):
        contract = self.existing_without_summary()
        contract["slides"][1]["headerVariant"] = "tracked"
        contract["slides"][1]["trackerLabel"] = "A current but inconsistent label"
        self.assertEqual(validator.validate_contract(contract), [])

    def test_startup_pitch_does_not_force_executive_summary(self):
        contract = deepcopy(self.new_dd())
        contract.update({
            "templateId": "startup-pitch-deck",
            "deliveryMode": "live_pitch",
            "plannedSlideCount": 2,
            "chapters": [{"id": "thesis", "label": "Investment thesis"}],
            "executiveSummaryDecision": {"status": "not_required", "rationale": "The live opening states the thesis directly."},
        })
        contract["tracker"] = {
            "system": "compact_running_label",
            "contentsSlide": None,
            "transitionSlides": [],
            "analyticalHeader": {"variant": "untracked", "governedSlides": [2], "requiredFields": ["action-title"]},
        }
        contract["slides"] = [slide(1, "cover", regions=0), slide(2, "analytical", "thesis", "untracked", None, 1)]
        self.assertEqual(validator.validate_contract(contract), [])


if __name__ == "__main__":
    unittest.main()
