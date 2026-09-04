from __future__ import annotations

import importlib.util
import sys
import unittest
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


validator = load_module(
    "validate_pptx_contract",
    ROOT / "evals" / "scripts" / "validate_pptx.py",
)


def slide(number, page_type, chapter_id=None, header="structural", tracker_label=None, regions=1):
    record = {
        "slide": number,
        "dotId": f"D{number:02d}",
        "pageType": page_type,
        "title": f"Slide {number} advances the decision",
        "communicationJob": f"Perform narrative job {number}",
        "chapterId": chapter_id,
        "hypothesisIds": ["NAV"] if page_type in {"cover", "contents_tracker", "chapter_transition"} else ["H1"],
        "dashes": ["Provide page-specific support"],
        "evidenceRegions": regions,
        "terminalSurfacePosition": "bottom" if page_type in {"analytical", "executive_synthesis"} else "none",
        "headerVariant": header,
        "trackerLabel": tracker_label,
        "trackerParentId": None,
        "trackerChapterId": None,
        "trackerParentLabel": None,
        "trackerChapterLabel": None,
    }
    if page_type == "executive_synthesis":
        record["title"] = "Executive summary"
        record["executiveSynthesis"] = {
            "answer": "Approve the focused option",
            "branches": [
                {
                    "heading": "Demand is sufficient",
                    "proof": "Qualified demand exceeds the threshold.",
                    "consequence": "The case can proceed to implementation planning.",
                },
                {
                    "heading": "Execution risk is bounded",
                    "proof": "The required capabilities already exist.",
                    "consequence": "The first phase can use the current team.",
                },
            ],
            "overallAction": "Approve the first phase with measured gates.",
        }
    elif page_type == "analytical":
        record["evidenceComposition"] = (
            "single_evidence_field" if regions == 1 else "parallel_evidence_field"
        )
        record["layout"] = "single-dominant-exhibit" if regions == 1 else "parallel-exhibits"
        record["primaryEvidenceType"] = "metric-field"
        if regions == 1:
            record["dominantEvidencePlan"] = {
                "canvasShareTarget": 72,
                "completenessElements": ["comparison", "interpretation"],
            }
    return record


class DeckContractTests(unittest.TestCase):
    def new_dd(self):
        return {
            "schemaVersion": 1,
            "workflowMode": "new_deck",
            "templateId": "commercial-due-diligence",
            "deliveryMode": "executive_pre_read",
            "visualSystem": {"mode": "clean-native-standard", "designSystem": "codex-grid"},
            "plannedSlideCount": 4,
            "chapters": [{"id": "market", "label": "Market attractiveness"}],
            "executiveSummaryDecision": {"status": "required_present", "rationale": "The committee needs the answer first."},
            "structuralRecommendations": [],
            "tracker": {
                "system": "standard-chapter",
                "contentsSlide": 3,
                "transitionSlides": [],
                "analyticalHeader": {
                    "variant": "tracked",
                    "fullStateVariant": "sequential-circles",
                    "compactStateVariant": "compact-number-strip",
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

    def test_executive_summary_navigation_map_must_follow_chapter_order(self):
        contract = self.new_dd()
        summary = next(slide for slide in contract["slides"] if slide["pageType"] == "executive_synthesis")
        contract["executiveSummaryToNavigation"] = [{
            "chapterId": "market",
            "navigationLabel": "Market attractiveness",
            "summarySource": "branch",
            "branchIndex": 1,
            "summaryClaim": summary["executiveSynthesis"]["branches"][0]["heading"],
        }]
        self.assertEqual(validator.validate_contract(contract), [])
        contract["executiveSummaryToNavigation"][0]["navigationLabel"] = "Different taxonomy"
        self.assertTrue(any(
            "navigationLabel must equal the exact chapter label" in error
            for error in validator.validate_contract(contract)
        ))

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

    def test_executive_synthesis_requires_substantive_branch_contract(self):
        contract = self.new_dd()
        contract["slides"][1]["executiveSynthesis"]["branches"][0]["heading"] = "Operating proof"
        errors = validator.validate_contract(contract)
        self.assertTrue(any("heading must state a substantive conclusion" in error for error in errors))

    def test_executive_synthesis_requires_proof_and_consequence(self):
        contract = self.new_dd()
        del contract["slides"][1]["executiveSynthesis"]["branches"][0]["consequence"]
        errors = validator.validate_contract(contract)
        self.assertTrue(any("consequence must be a non-empty string" in error for error in errors))

    def test_single_evidence_synthesis_requires_a_bullet_field(self):
        contract = self.new_dd()
        contract["slides"][3]["evidenceComposition"] = "single_evidence_with_synthesis"
        contract["slides"][3]["synthesisMode"] = "heading_and_body"
        errors = validator.validate_contract(contract)
        self.assertTrue(any("synthesisMode must be bullet_field" in error for error in errors))

    def test_analytical_slide_requires_an_explicit_evidence_composition(self):
        contract = self.new_dd()
        del contract["slides"][3]["evidenceComposition"]
        errors = validator.validate_contract(contract)
        self.assertTrue(any("evidenceComposition is required" in error for error in errors))

    def test_evidence_with_synthesis_requires_approved_bullets(self):
        contract = self.new_dd()
        contract["slides"][3]["evidenceComposition"] = "single_evidence_with_synthesis"
        contract["slides"][3]["synthesisMode"] = "bullet_field"
        errors = validator.validate_contract(contract)
        self.assertTrue(any("synthesisBullets must contain one to three" in error for error in errors))

    def test_new_due_diligence_can_omit_visible_tracker(self):
        contract = self.new_dd()
        contract["plannedSlideCount"] = 3
        contract["tracker"] = {
            "system": "none",
            "contentsSlide": None,
            "transitionSlides": [],
            "analyticalHeader": {
                "variant": "untracked",
                "fullStateVariant": "none",
                "compactStateVariant": "none",
                "governedSlides": [3],
                "requiredFields": ["action-title"],
            },
        }
        contract["slides"] = [
            slide(1, "cover", regions=0),
            slide(2, "executive_synthesis", regions=3),
            slide(3, "analytical", "market", "untracked", None, 3),
        ]
        self.assertEqual(validator.validate_contract(contract), [])

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

    def test_hierarchical_tracker_maps_parent_and_chapter_items_to_the_slide(self):
        contract = self.new_dd()
        contract["tracker"] = {
            "system": "hierarchical-segmented",
            "contentsSlide": 3,
            "transitionSlides": [],
            "parentItems": [{
                "id": "P1",
                "label": "Market attractiveness",
                "chapterId": "market",
                "governedSlides": [4],
            }],
            "chapterTrackers": [{
                "parentId": "P1",
                "items": [{"id": "P1.1", "label": "Demand", "governedSlides": [4]}],
            }],
            "analyticalHeader": {
                "variant": "tracked",
                "fullStateVariant": "split-contents",
                "compactStateVariant": "compact-label",
                "governedSlides": [4],
                "requiredFields": ["parent-tracker-label", "chapter-tracker-label", "action-title"],
            },
        }
        analytical = contract["slides"][3]
        analytical.update({
            "trackerLabel": None,
            "trackerParentId": "P1",
            "trackerChapterId": "P1.1",
            "trackerParentLabel": "Market attractiveness",
            "trackerChapterLabel": "Demand",
        })
        self.assertEqual(validator.validate_contract(contract), [])

    def test_hierarchical_tracker_rejects_a_slide_local_chapter_label(self):
        contract = self.new_dd()
        contract["tracker"] = {
            "system": "hierarchical-segmented",
            "contentsSlide": 3,
            "transitionSlides": [],
            "parentItems": [{
                "id": "P1",
                "label": "Market attractiveness",
                "chapterId": "market",
                "governedSlides": [4],
            }],
            "chapterTrackers": [{
                "parentId": "P1",
                "items": [{"id": "P1.1", "label": "Demand", "governedSlides": [4]}],
            }],
            "analyticalHeader": {
                "variant": "tracked",
                "fullStateVariant": "split-contents",
                "compactStateVariant": "compact-label",
                "governedSlides": [4],
                "requiredFields": ["parent-tracker-label", "chapter-tracker-label", "action-title"],
            },
        }
        contract["slides"][3].update({
            "trackerLabel": None,
            "trackerParentId": "P1",
            "trackerChapterId": "P1.1",
            "trackerParentLabel": "Market attractiveness",
            "trackerChapterLabel": "Demand outlook",
        })
        errors = validator.validate_contract(contract)
        self.assertIn("slide 4 trackerChapterLabel must equal the exact chapter label", errors)

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
            "system": "none",
            "contentsSlide": None,
            "transitionSlides": [],
            "analyticalHeader": {
                "variant": "untracked",
                "fullStateVariant": "none",
                "compactStateVariant": "none",
                "governedSlides": [2],
                "requiredFields": ["action-title"],
            },
        }
        contract["slides"] = [slide(1, "cover", regions=0), slide(2, "analytical", "thesis", "untracked", None, 1)]
        self.assertEqual(validator.validate_contract(contract), [])

    def test_new_deck_rejects_custom_template_escape_hatch(self):
        contract = self.new_dd()
        contract["templateId"] = "custom"
        errors = validator.validate_contract(contract)
        self.assertIn("new_deck templateId must name a registered template", errors)

    def test_custom_visual_mode_requires_approval_evidence(self):
        contract = self.new_dd()
        contract["visualSystem"] = {"mode": "custom-user-directed"}
        errors = validator.validate_contract(contract)
        self.assertIn(
            "custom-user-directed visualSystem.approvalEvidence must be a non-empty string",
            errors,
        )

    def test_chart_requires_underlined_heading_and_canonical_legend(self):
        contract = self.new_dd()
        analytical = contract["slides"][3]
        analytical["primaryEvidenceType"] = "chart"
        analytical["exhibitHeadingVariant"] = "plain"
        analytical["legendTreatment"] = "office-auto"
        errors = validator.validate_contract(contract)
        self.assertIn("slides[3].exhibitHeadingVariant must equal open-underlined for charts", errors)
        self.assertIn("slides[3].legendTreatment must use the canonical legend grammar", errors)

    def test_single_region_pre_read_requires_material_density_plan(self):
        contract = self.new_dd()
        analytical = contract["slides"][3]
        analytical["evidenceRegions"] = 1
        analytical["evidenceComposition"] = "single_evidence_field"
        analytical["layout"] = "single-dominant-exhibit"
        analytical.pop("dominantEvidencePlan", None)
        errors = validator.validate_contract(contract)
        self.assertIn("slide 4 must use two to four evidence regions or define dominantEvidencePlan", errors)

    def test_nonstandard_tracker_system_is_rejected_for_new_decks(self):
        contract = self.new_dd()
        contract["tracker"]["system"] = "segmented_full_state"
        errors = validator.validate_contract(contract)
        self.assertIn(
            "new_deck tracker.system must be none, standard-chapter, or hierarchical-segmented",
            errors,
        )


if __name__ == "__main__":
    unittest.main()
