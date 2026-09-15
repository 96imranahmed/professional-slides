"""Purpose-aware synthesis and native source-page contracts."""
import unittest
from copy import deepcopy
import test_deck_contract as contract_tests
validator = contract_tests.validator


class SynthesisMetadataTests(unittest.TestCase):
    def contract(self):
        return contract_tests.DeckContractTests().new_dd()

    def test_variable_branches_and_single_support_without_close(self):
        contract = self.contract()
        page = contract['slides'][1]
        synthesis = page['executiveSynthesis']
        synthesis['format'] = 'thematic-bullets'
        synthesis['branches'] = [dict(deepcopy(synthesis['branches'][0]), heading=f'Finding {i} changes the outlook', bullets=[f'Independent evidence {i}']) for i in range(7)]
        del synthesis['overallAction']
        page['terminalSurfacePosition'] = 'none'
        self.assertEqual(validator.validate_contract(contract), [])
        synthesis['branches'][0]['bullets'] = []
        self.assertTrue(any('needs substantive bullets' in e for e in validator.validate_contract(contract)))

    def test_exhibit_synthesis_requires_exact_item_references(self):
        contract = self.contract()
        page = contract['slides'][1]
        page['composition'] = 'auto'
        page['items'] = [{'id': 'summary-table', 'job': 'Compare the conditions', 'component': 'table', 'props': {}}]
        page['executiveSynthesis'] = {'answer': 'Three conditions govern the choice', 'itemIds': ['summary-table']}
        self.assertEqual(validator.validate_contract(contract), [])
        page['executiveSynthesis']['itemIds'] = ['unknown']
        self.assertTrue(any('unique references' in e for e in validator.validate_contract(contract)))

    def test_purpose_exception_is_explicit_and_does_not_change_default(self):
        contract = contract_tests.DeckContractTests().existing_without_summary()
        contract['executiveSummaryDecision'] = {'status': 'not_required', 'purpose': 'workshop', 'rationale': 'Participants will compare options before deciding.'}
        contract['structuralRecommendations'] = []
        self.assertEqual(validator.validate_contract(contract), [])
        del contract['executiveSummaryDecision']['purpose']
        self.assertTrue(any('missing_recommended' in e for e in validator.validate_contract(contract)))
        contract = self.contract()
        contract['executiveSummaryDecision'] = {'status': 'not_required', 'purpose': 'explanation', 'rationale': 'This session teaches the process.'}
        self.assertFalse(validator.required_opening(contract))
        contract['executiveSummaryDecision']['purpose'] = 'decision'
        self.assertTrue(validator.required_opening(contract))

    def test_ordered_scope_group_references_real_slides(self):
        contract = self.contract()
        group = {'id': 'synthesis', 'scope': 'workstream', 'slides': [2, 4], 'governingAnswer': 'The workstream has conditional upside', 'decisionStage': 'options', 'proofSlides': [4], 'conditions': ['Validate demand before authorization']}
        contract['synthesisGroups'] = [group]
        self.assertEqual(validator.validate_contract(contract), [])
        group['slides'] = [4, 2]
        self.assertTrue(any('slide order' in e for e in validator.validate_contract(contract)))
        group['slides'] = [2, 99]
        self.assertTrue(any('existing slide numbers' in e for e in validator.validate_contract(contract)))
        group['slides'] = [2]
        group['decisionStage'] = 'approved-options'
        self.assertTrue(any('decisionStage' in e for e in validator.validate_contract(contract)))

    def test_source_access_identity_and_native_numbering_are_independent(self):
        contract = self.contract()
        source = {'id': 'source-a', 'format': 'pptx', 'form': 'native-presentation', 'accessStatus': 'available', 'identityStatus': 'provisional', 'reviewStatus': 'reviewed', 'path': 'original.pptx', 'sha256': 'a' * 64, 'slideCount': 16, 'reviewedRanges': [{'start': 2, 'end': 4, 'numbering': 'native-slide'}]}
        contract['sourceDocuments'] = [source]
        self.assertEqual(validator.validate_contract(contract), [])
        source['reviewedRanges'][0]['numbering'] = 'physical-pdf-page'
        self.assertTrue(any('Office reflow' in e for e in validator.validate_contract(contract)))
        source['reviewedRanges'][0] = {'start': 15, 'end': 17, 'numbering': 'native-slide'}
        self.assertTrue(any('source bounds' in e for e in validator.validate_contract(contract)))
        source['reviewedRanges'] = []
        del source['sha256']
        self.assertTrue(any('source bytes' in e for e in validator.validate_contract(contract)))
        source['accessStatus'] = 'inaccessible'
        self.assertEqual(validator.validate_contract(contract), [])


if __name__ == '__main__':
    unittest.main()
