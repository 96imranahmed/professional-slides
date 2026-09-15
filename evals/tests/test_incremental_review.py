"""Exercise the real runner with a deterministic fake transport, not a quality judge."""
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from test_source_structure import NODE, ROOT

class IncrementalReviewTests(unittest.TestCase):
    def test_local_revision_reuses_other_slides_and_final_hash_stays_strict(self):
        self.exercise_review(False)

    def test_malformed_local_and_global_responses_retry_once_and_cache(self):
        self.exercise_review(True)

    def exercise_review(self, malformed):
        with tempfile.TemporaryDirectory() as directory:
            d=Path(directory); (d/'rendered').mkdir(); (d/'bin').mkdir()
            fake=d/'bin/codex'
            fake.write_text('''#!/usr/bin/env python3
import json,sys,os
from pathlib import Path
args=sys.argv
schema=json.loads(Path(args[args.index('--output-schema')+1]).read_text())
prompt=sys.stdin.read()
assert 'sourceExtract' in prompt and 'Exact original provider extract' in prompt
items={i:{'decision':'keep','severity':'none','code':'NONE','classification':'navigation','addedInformation':'Identifies scope','deletionConsequence':'Lose scope','evidenceIds':[],'reason':'Scope label','repair':'None'} for i in schema['properties'].get('items',{}).get('required',[])}
answer={'outcome':'The scope-identification brief is fulfilled','findings':[]} if 'outcome' in schema['properties'] else {'items':items}
if os.environ.get('FAKE_MALFORMED') == '1':
    kind='global' if 'outcome' in schema['properties'] else 'local'
    marker=Path(os.environ['FAKE_CALLS']+'.'+kind)
    if not marker.exists():
        marker.write_text('attempted')
        answer={'outcome':'Invalid', 'findings':[{'slide':'missing'}]} if kind=='global' else {'items':{}}
Path(args[args.index('--output-last-message')+1]).write_text(json.dumps(answer))
with open(os.environ['FAKE_CALLS'],'a') as f:f.write('call\\n')
''');fake.chmod(0o755)
            scene={'slides':[{'id':f's{i}','nodes':[{'id':f't{i}','type':'text','role':'action-title','text':f'Scope {i}','data':{}}]} for i in range(3)]}
            contract={'slides':[{'id':f's{i}','title':f'Scope {i}','argument':{'evidence':['source-e1']}} for i in range(3)]}
            (d/'extract.txt').write_text('Exact original provider extract')
            contract['copyEvidence']=[{'id':'source-e1','kind':'source','text':'Author paraphrase','provenance':{'path':'extract.txt','sha256':hashlib.sha256((d/'extract.txt').read_bytes()).hexdigest(),'url':'https://example.org','retrievedAt':'2026-09-08','locator':'Provider terms'}}]
            for i in range(3):(d/'rendered'/f'slide-{i+1}.png').write_bytes(b'fake transport image')
            (d/'deck.pptx').write_bytes(b'fake transport pptx')
            def write():
                (d/'scene.json').write_text(json.dumps(scene));(d/'contract.json').write_text(json.dumps(contract))
            write()
            env={**os.environ,'PATH':str(d/'bin')+os.pathsep+os.environ['PATH'],'FAKE_CALLS':str(d/'calls'),'FAKE_MALFORMED':'1' if malformed else '0'}
            cmd=[NODE,str(ROOT/'skills/professional-slides/runtime/review-deck.mjs'),'--pptx',str(d/'deck.pptx'),'--scene',str(d/'scene.json'),'--contract',str(d/'contract.json'),'--render-dir',str(d/'rendered'),'--report',str(d/'review.json'),'--batch-size','2','--concurrency','1']
            def run(extra=()):return subprocess.run(cmd+list(extra),env=env,text=True,capture_output=True)
            first=run();self.assertEqual(first.returncode,0,first.stderr)
            report=json.loads((d/'review.json').read_text());self.assertEqual(report['timings']['modelCalls'],5 if malformed else 3)
            second=run();self.assertEqual(second.returncode,0,second.stderr)
            report=json.loads((d/'review.json').read_text());self.assertEqual(report['timings']['cacheHits'],4);self.assertEqual(report['timings']['modelCalls'],0)
            scene['slides'][1]['nodes'][0]['text']='Changed scope';contract['slides'][1]['title']='Changed scope';write()
            changed=run();self.assertEqual(changed.returncode,0,changed.stderr)
            report=json.loads((d/'review.json').read_text());self.assertEqual(report['timings']['cacheHits'],2);self.assertEqual(report['timings']['modelCalls'],2)
            self.assertEqual(run(['--check']).returncode,0)
            (d/'deck.pptx').write_bytes(b'changed candidate')
            self.assertNotEqual(run(['--check']).returncode,0)
            partial=run(['--slides','1']);self.assertEqual(partial.returncode,0,partial.stderr)
            self.assertNotEqual(run(['--check']).returncode,0)
            (d/'extract.txt').write_text('Changed source after authoring')
            altered_source=run()
            self.assertNotEqual(altered_source.returncode,0)
            self.assertIn('source extract hash mismatch',altered_source.stderr)
