"""Exercise source integrity and preservation of approved visual relationships."""
import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from test_source_structure import NODE, ROOT

MODULE = (ROOT / 'skills/professional-slides/runtime/outcome-contract.mjs').as_uri()

class OutcomeContractTests(unittest.TestCase):
    def invoke(self, function, *arguments):
        source = f"import {{{function}}} from {json.dumps(MODULE)}; try {{await {function}(...{json.dumps(arguments)}); console.log(JSON.stringify({{ok:true}}));}} catch(e) {{console.log(JSON.stringify({{ok:false,error:e.message}}));}}"
        result = subprocess.run([NODE, '--input-type=module', '-e', source], text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_source_extract_is_bound_to_exact_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'source.txt';p.write_text('Quoted provider price: 40 dollars monthly.\n')
            evidence={'id':'price','kind':'source','provenance':{'path':'source.txt','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'url':'https://example.org/prices','retrievedAt':'2026-09-08','locator':'Monthly price'}}
            spec={'evidence':[evidence]}
            self.assertTrue(self.invoke('verifyResearchSources',spec,directory)['ok'])
            p.write_text('Quoted provider price: 90 dollars monthly.\n')
            result=self.invoke('verifyResearchSources',spec,directory)
            self.assertFalse(result['ok']);self.assertIn('hash mismatch',result['error'])

    def test_source_metadata_and_source_file_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'source.txt';p.write_text('Original source extract')
            source={'id':'e1','kind':'source','provenance':{'path':'source.txt','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'url':'https://example.org/facts','retrievedAt':'2026-09-08','locator':'Section 1'}}
            for field in source['provenance']:
                changed=json.loads(json.dumps(source));del changed['provenance'][field]
                with self.subTest(field=field):
                    self.assertFalse(self.invoke('verifyResearchSources',{'evidence':[changed]},directory)['ok'])
            p.unlink()
            self.assertFalse(self.invoke('verifyResearchSources',{'evidence':[source]},directory)['ok'])

    def test_derivation_validates_inputs_formula_and_cycles(self):
        base=[{'id':'input','kind':'user','text':'We need 12 seats'},{'id':'total','kind':'calculation','inputs':['input'],'formula':'12 * 40'},{'id':'decision','kind':'interpretation','inputs':['total'],'text':'Within the stated cap'}]
        self.assertTrue(self.invoke('verifyResearchSources',{'evidence':base},'.')['ok'])
        for mutate in ('unknown','self','cycle','formula'):
            with self.subTest(mutate=mutate):
                records=json.loads(json.dumps(base))
                if mutate=='unknown': records[1]['inputs']=['absent']
                if mutate=='self': records[1]['inputs']=['total']
                if mutate=='cycle': records[1]['inputs']=['decision']
                if mutate=='formula': records[1]['formula']=''
                self.assertFalse(self.invoke('verifyResearchSources',{'evidence':records},'.')['ok'])

    def test_research_status_cannot_hide_missing_evidence_or_limit(self):
        for requirement in ({'criterion':'Cost','status':'resolved','evidence':[]},{'criterion':'Cost','status':'uncertain','evidence':[]},{'criterion':'Cost','status':'resolved','evidence':['missing']}):
            with self.subTest(requirement=requirement):
                self.assertFalse(self.invoke('verifyResearchSources',{'context':{'researchRequirements':[requirement]}},'.')['ok'])
        self.assertTrue(self.invoke('verifyResearchSources',{'context':{'researchRequirements':[{'criterion':'Cost','status':'needs-user','evidence':[],'limit':'Seat count depends on the hiring decision'}]}},'.')['ok'])

    def design(self, contract, frames):
        return self.invoke('assertDesignContracts',{'deckPlan':{'slides':[{'id':'compare','designContract':contract}]}},{'slides':[{'componentInstances':[{'id':id,'frame':frame} for id,frame in frames.items()]}]})

    def test_peers_must_survive_compilation_side_by_side(self):
        contract={'peerGroups':[['a','b']]}
        a={'x':0,'y':100,'width':400,'height':250};b={'x':450,'y':100,'width':400,'height':250}
        self.assertTrue(self.design(contract,{'a':a,'b':b})['ok'])
        for changed in ({**b,'x':0,'y':380},{**b,'x':390}):
            self.assertFalse(self.design(contract,{'a':a,'b':changed})['ok'])
        self.assertFalse(self.design(contract,{'a':a})['ok'])

    def test_reading_order_rejects_reversal_and_duplicate_items(self):
        frames={'a':{'x':0,'y':0,'width':200,'height':100},'b':{'x':300,'y':0,'width':200,'height':100},'c':{'x':0,'y':200,'width':500,'height':100}}
        self.assertTrue(self.design({'readingOrder':['a','b','c']},frames)['ok'])
        self.assertFalse(self.design({'readingOrder':['b','a','c']},frames)['ok'])
        self.assertFalse(self.design({'readingOrder':['a','c','b']},frames)['ok'])
        self.assertFalse(self.design({'readingOrder':['a','a']},frames)['ok'])
        self.assertFalse(self.design({'readingOrder':['absent']},frames)['ok'])

    def test_material_outcome_blocks_but_style_is_advisory(self):
        finding={'code':'MISSING_EVIDENCE','severity':'major','reason':'Neither vendor price appears','repair':'Compare both quoted prices','slideIds':['s1']}
        source=f"import {{validateOutcome}} from {json.dumps(MODULE)}; console.log(JSON.stringify(validateOutcome({json.dumps({'outcome':'Missing requested comparison','findings':[finding]})},['s1'])));"
        result=subprocess.run([NODE,'--input-type=module','-e',source],capture_output=True,text=True,check=True)
        self.assertTrue(any('MATERIAL' in e for e in json.loads(result.stdout)))
        finding.update(code='EDITORIAL',severity='minor',reason='A different palette may feel warmer',repair='Optional palette refinement')
        source=f"import {{validateOutcome}} from {json.dumps(MODULE)}; console.log(JSON.stringify(validateOutcome({json.dumps({'outcome':'Brief fulfilled','findings':[finding]})},['s1'])));"
        result=subprocess.run([NODE,'--input-type=module','-e',source],capture_output=True,text=True,check=True)
        self.assertEqual(json.loads(result.stdout),[])

if __name__ == '__main__': unittest.main()
