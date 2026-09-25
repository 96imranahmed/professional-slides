"""The cold-run harness: the review loop as a command.

Every defect found in this repository over two days of review was found by a
person opening a PDF and looking at it. That loop runs once per person per
afternoon and only after fifty pages exist. `evals/cold-run/score.mjs` is the
same loop as a command, and these tests hold the harness to what it claims:
that it measures the deck rather than itself, that its bars are the contract's
bars, and that the run which started all of this still fails it.

The suite cannot run the model. Generating a deck is not deterministic and does
not belong here; producing a cold run is a human step, and the point of the
directory is that scoring one afterwards is not.
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
COLD = ROOT / "evals" / "cold-run"
SCORE = COLD / "score.mjs"
CONTRACT = json.loads((ROOT / "skills" / "professional-slides" / "runtime" / "weight.json").read_text(encoding="utf-8"))

SHIPS_EMPTY_FRAMES = '''
import assert from 'node:assert/strict';
import {scoreBuild} from './evals/cold-run/score.mjs';
const page=(roles)=>({id:'s',nodes:[{role:'action-title',type:'text'},
  ...roles.map(r=>({role:r,type:'rect',frame:{x:0,y:0,width:400,height:300}})),
  ...Array(20).fill({role:'m',type:'rect'})],componentInstances:[{component:'image-frame'}]});
const shipped={slides:[page(['image-frame','image-frame']),page([]),page([]),page([]),page([]),page([])]};
const s=scoreBuild(shipped);
assert.equal(s.statistics.unsourcedPictures,2);
assert.ok(s.findings.some(f=>f.measure==='unsourcedPictures'&&f.ceiling===0));
assert.equal(s.accepted,false,'two grey boxes is not a deliverable deck');
const sourced={slides:[{id:'s',nodes:[{role:'action-title',type:'text'},
  {role:'image',type:'image',frame:{x:0,y:0,width:400,height:300}},...Array(20).fill({role:'m',type:'rect'})],
  componentInstances:[{component:'image-frame'}]}]};
assert.equal(scoreBuild(sourced).statistics.unsourcedPictures,0);
console.log(JSON.stringify({ok:true}));
'''



def score(*args):
    out = subprocess.run(["node", str(SCORE), *args, "--json"], capture_output=True, text=True, cwd=ROOT)
    if out.returncode not in (0, 2):
        raise AssertionError(f"score.mjs exited {out.returncode}\n{out.stderr}")
    return json.loads(out.stdout), out.returncode


class HarnessTests(unittest.TestCase):
    def test_the_bars_are_the_contract_s_bars(self):
        """A second set of numbers is a second contract nobody maintains."""
        craft = CONTRACT["plan"]["craft"]
        result = run_node('''
import {BUILD_BARS} from './evals/cold-run/score.mjs';
console.log(JSON.stringify(Object.fromEntries(Object.entries(BUILD_BARS).map(([k, v]) => [k, v.min]))));
''')
        self.assertEqual(result["exhibitVarietyPerTen"], craft["exhibitVarietyPerTen"]["min"])
        self.assertEqual(result["tablesTreated"], craft["tableTreated"]["min"])
        self.assertEqual(result["chartsAnnotated"], craft["chartAnnotated"]["min"])

    def test_a_bar_about_tables_cannot_fail_a_deck_with_no_tables(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {scoreBuild} from './evals/cold-run/score.mjs';
const page=(component,roles=[])=>({id:'s',nodes:[{role:'action-title',type:'text',text:'A finding'},
  ...roles.map(r=>({role:r,type:'rect'})),...Array(20).fill({role:'mark',type:'rect'})],
  componentInstances:[{component}]});
const noTables={slides:[page('chart.column',['chart-bracket']),page('chart.bar',['chart-delta']),
  page('cards'),page('steps'),page('timeline'),page('framework')]};
const s=scoreBuild(noTables);
assert.equal(s.statistics.tables,0);
assert.equal(s.statistics.tablesTreated,null,'not zero: there is nothing to measure');
assert.ok(!s.findings.some(f=>f.measure==='tablesTreated'),'and nothing to fail');
assert.equal(s.accepted,true);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_a_deck_of_one_shape_fails_on_variety(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {scoreBuild} from './evals/cold-run/score.mjs';
const page=()=>({id:'s',nodes:[{role:'action-title',type:'text'},...Array(20).fill({role:'m',type:'rect'})],
  componentInstances:[{component:'table'}]});
const s=scoreBuild({slides:Array.from({length:20},page)});
const variety=s.findings.find(f=>f.measure==='exhibitVarietyPerTen');
assert.ok(variety,'twenty pages of one exhibit is half an exhibit per ten pages');
assert.ok(variety.measured<1);
assert.equal(s.accepted,false);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_a_deck_that_ships_empty_frames_is_not_accepted(self):
        """Found by running the harness, which is the point of the harness.

        A cold run planned a picture-pair of two servicing centres, wrote both
        as uncleared, and the deck passed every gate while shipping two grey
        boxes - because a frame counts as a picture everywhere a picture is
        counted. Writing a picture as `alt` with no `path` is how a page gets
        laid out before its photographs exist; this is what stops it reaching a
        reader.
        """
        result = run_node(SHIPS_EMPTY_FRAMES)
        self.assertTrue(result["ok"])

    def test_the_plan_and_the_build_are_reported_apart(self):
        # The Marvel plan scored nine architectures and 0.888 entropy while the
        # deck it produced carried 2.9 exhibits per ten pages and no treatment
        # anywhere. One combined number would have hidden which was wrong.
        result = run_node('''
import assert from 'node:assert/strict';
import {scoreRun} from './evals/cold-run/score.mjs';
const plan={schema:'professional-slides.plan/v1',id:'t',pages:Array.from({length:12},(_,i)=>({
  n:i+1,title:'A page that states something measurable',exhibit:'table',architecture:'exhibit-full'}))};
const both=scoreRun({plan,scene:{slides:[]}});
assert.ok(both.plan&&both.build,'two reports');
assert.equal(both.plan.accepted,false);
assert.ok('countsByCode' in both.plan);
// Either half alone is a real answer.
assert.equal(scoreRun({plan}).build,null);
assert.equal(scoreRun({scene:{slides:[]}}).plan,null);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])


class SpecimenTests(unittest.TestCase):
    """The runs on record, and what they are for."""

    def specimen(self, name):
        return json.loads((COLD / "specimens" / name).read_text(encoding="utf-8"))

    def test_the_recorded_run_is_still_a_failing_run(self):
        """The whole point of the specimen is that it cannot be re-argued.

        This deck passed every gate the skill had on 17 September. If a change
        to the gates ever lets its shape through again, this is what says so.
        """
        recorded = self.specimen("2026-09-17-marvel-vs-dc.json")
        self.assertFalse(recorded["planScore"]["accepted"])
        codes = set(recorded["planScore"]["countsByCode"])
        for expected in ["PLAN_TABLE_DEPTH", "PLAN_TABLE_MONOTONY", "PLAN_UNANNOTATED_CHARTS",
                         "PLAN_NO_HIGHLIGHT", "PLAN_EXHIBIT_VARIETY"]:
            self.assertIn(expected, codes)
        built = recorded["deckAsBuilt"]
        reference = recorded["referenceCorpus"]
        # The numbers that made the case, kept where they can be checked.
        self.assertLess(built["tableRowsMedian"], reference["tableRowsMedian"])
        self.assertEqual(built["tablesTreated"], 0.0)
        self.assertEqual(built["chartsAnnotated"], 0.0)
        self.assertLess(built["exhibitVarietyPerTen"], min(reference["exhibitVarietyPerTen"]))

    def test_the_baseline_is_measured_by_the_same_harness(self):
        """A harness only trusted on decks that fail it is not a harness."""
        baseline = self.specimen("example-deck-baseline.json")
        decks = baseline["decks"]
        self.assertGreaterEqual(len(decks), 3)  # one per shipped example deck
        for name, statistics in decks.items():
            with self.subTest(deck=name):
                self.assertGreater(statistics["contentPages"], 0, name)
                self.assertGreater(statistics["drawingsPerPage"], 12,
                                   f"{name}: a hand-authored page carries drawn elements")
                self.assertGreaterEqual(statistics["exhibitVarietyPerTen"],
                                        CONTRACT["plan"]["craft"]["exhibitVarietyPerTen"]["min"], name)

    def test_a_specimen_records_what_looking_at_it_found(self):
        """The part of a cold run the score does not produce.

        The rollout run cleared every plan gate and every build bar and was
        still wrong in eight places. If that pass leaves no record, the next
        person has only the numbers - which is exactly the failure this
        directory exists to catch.
        """
        recorded = self.specimen("2026-09-18-network-rollout.json")
        self.assertTrue(recorded["score"]["plan"]["accepted"], "the plan passed, which is the point")
        found = recorded["foundByLooking"]
        self.assertGreaterEqual(len(found), 8)
        for entry in found:
            with self.subTest(defect=entry.get("defect", "")[:40]):
                # What was seen, why it happened, and what was done about it.
                for field in ["defect", "why", "fix"]:
                    self.assertTrue(entry.get(field, "").strip(), field)

    def test_every_brief_says_what_it_is_there_to_catch(self):
        # A brief nobody can say the purpose of is a brief that gets run once.
        briefs = sorted((COLD / "briefs").glob("*.md"))
        self.assertGreaterEqual(len(briefs), 3)
        for brief in briefs:
            with self.subTest(brief=brief.name):
                text = brief.read_text(encoding="utf-8")
                self.assertIn("Why this brief is in the suite", text)
                self.assertIn("Audience", text)


if __name__ == "__main__":
    unittest.main()
