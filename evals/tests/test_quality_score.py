"""The run scorer (evals/quality/score.mjs): a plan and a build, scored apart.

The quality eval scores every deck it collects with it, and a run made by hand
is scored the same way. These tests hold the scorer to what it claims: that it
measures the deck rather than itself, that its bars are the contract's bars,
and that what a run cost is counted from the author's log and never scored.
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
SCORE = ROOT / "evals" / "quality" / "score.mjs"
CONTRACT = json.loads((ROOT / "skills" / "professional-slides" / "runtime" / "weight.json").read_text(encoding="utf-8"))

SHIPS_EMPTY_FRAMES = '''
import assert from 'node:assert/strict';
import {scoreBuild} from './evals/quality/score.mjs';
const page=(roles)=>({id:'s',nodes:[{role:'action-title',type:'text'},
  ...roles.map(r=>({role:r,type:'rect',frame:{x:0,y:0,width:400,height:300}})),
  ...Array(20).fill({role:'m',type:'rect'})],componentInstances:[{component:'slide-chrome'},{component:'image-frame'}]});
const shipped={slides:[page(['image-frame','image-frame']),page([]),page([]),page([]),page([]),page([])]};
const s=scoreBuild(shipped);
assert.equal(s.statistics.unsourcedPictures,2);
assert.ok(s.findings.some(f=>f.measure==='unsourcedPictures'&&f.ceiling===0));
assert.equal(s.accepted,false,'two grey boxes is not a deliverable deck');
const sourced={slides:[{id:'s',nodes:[{role:'action-title',type:'text'},
  {role:'image',type:'image',frame:{x:0,y:0,width:400,height:300}},...Array(20).fill({role:'m',type:'rect'})],
  componentInstances:[{component:'slide-chrome'},{component:'image-frame'}]}]};
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
import {BUILD_BARS} from './evals/quality/score.mjs';
console.log(JSON.stringify(Object.fromEntries(Object.entries(BUILD_BARS).map(([k, v]) => [k, v.min]))));
''')
        self.assertEqual(result["exhibitVarietyPerTen"], craft["exhibitVarietyPerTen"]["min"])
        self.assertEqual(result["tablesTreated"], craft["tableTreated"]["min"])
        self.assertEqual(result["chartsAnnotated"], craft["chartAnnotated"]["min"])

    def test_a_bar_about_tables_cannot_fail_a_deck_with_no_tables(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {scoreBuild} from './evals/quality/score.mjs';
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
import {scoreBuild} from './evals/quality/score.mjs';
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

    def test_a_catalogue_is_held_to_the_ceilings_only(self):
        # A catalogue shows each component plain so it can be copied; the floors
        # are rates of a deck that argues (the craft floor reads it the same way).
        # An empty frame is still an empty frame.
        result = run_node('''
import assert from 'node:assert/strict';
import {scoreBuild} from './evals/quality/score.mjs';
const page=(roles=[])=>({id:'s',nodes:[{role:'action-title',type:'text'},...roles.map(r=>({role:r,type:'rect'})),...Array(20).fill({role:'m',type:'rect'})],
  componentInstances:[{component:'table'}]});
const slides=Array.from({length:20},()=>page());
assert.equal(scoreBuild({slides}).accepted,false);
const catalogue=scoreBuild({slides},{purpose:'catalogue'});
assert.deepEqual(catalogue.findings,[]);
assert.equal(catalogue.statistics.tables,19,'the statistics are still measured (the first page is the cover)');
const framed=scoreBuild({slides:[slides[0],page(['image-frame']),...slides.slice(2)]},{purpose:'catalogue'});
assert.deepEqual(framed.findings.map(f=>f.measure),['unsourcedPictures']);
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])

    def test_the_command_line_reads_the_deck_s_purpose(self):
        # scoreBuild knew a catalogue; the command line never told it, so
        # `score.mjs` flagged the gallery's floors that delivery and the craft
        # floor hold it free of. It reads the purpose from the deck spec beside
        # the plan, or beside the build directory, as the build lays them out.
        import tempfile
        page = {"id": "s", "nodes": [{"role": "action-title", "type": "text"}] + [{"role": "m", "type": "rect"}] * 20,
                "componentInstances": [{"component": "table"}]}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "out").mkdir()
            (root / "out" / "scene.json").write_text(json.dumps({"id": "cat", "slides": [page] * 20}), encoding="utf-8")
            (root / "cat.plan.json").write_text(json.dumps({"id": "cat"}), encoding="utf-8")
            argues, code = score("-", str(root / "out"))
            self.assertFalse(argues["build"]["accepted"], "with no spec beside it the floors apply")
            self.assertEqual(code, 2)
            (root / "cat.deck.json").write_text(json.dumps({"id": "cat", "purpose": "catalogue"}), encoding="utf-8")
            alone, code = score("-", str(root / "out"))
            self.assertTrue(alone["build"]["accepted"])
            self.assertEqual(alone["build"]["purpose"], "catalogue")
            self.assertEqual(code, 0)
            (root / "out" / "scene.json").write_text(json.dumps({"id": "other", "slides": [page] * 20}), encoding="utf-8")
            planned, _ = score(str(root / "cat.plan.json"), str(root / "out"))
            self.assertTrue(planned["build"]["accepted"], "read from the spec beside the plan")

    def test_a_deck_that_ships_empty_frames_is_not_accepted(self):
        """Found by running the harness, which is the point of the harness.

        A run planned a picture-pair of two servicing centres, wrote both
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
import {scoreRun} from './evals/quality/score.mjs';
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


# Six author runs as author-deck.mjs logs them: a page refused four runs in a
# row under three codes (the form tried one at a time), then a clean run.
AUTHOR_LOG = [
    {"run": 1, "v": 2, "mode": "draft", "pages": 12, "ok": True, "findings": []},
    {"run": 2, "v": 2, "mode": "check", "pages": 12, "ok": False, "findings": [{"code": "SCENE_VOID", "id": "p4"}, {"code": "WORDS", "id": "p2"}, {"code": "PAGE_SHAPE_FLAT"}]},
    {"run": 3, "v": 2, "mode": "check", "pages": 12, "ok": False, "findings": [{"code": "SCENE_VOID", "id": "p4"}]},
    {"run": 4, "v": 2, "mode": "check", "pages": 12, "ok": False, "findings": [{"code": "PAGE_DOES_NOT_COMPOSE", "id": "p4"}]},
    {"run": 5, "v": 2, "mode": "full", "pages": 12, "ok": False, "findings": [{"code": "TEXT_COVERAGE_LOW", "id": "p4"}, {"code": "WORDS", "id": "p9"}]},
    {"run": 6, "v": 2, "mode": "full", "pages": 12, "ok": True, "findings": []},
]


class RunCostTests(unittest.TestCase):
    """What a run cost, counted from the author's log: thirty-three runs were only visible because an author kept a log by hand."""

    def write_log(self, directory, stem="t", entries=AUTHOR_LOG):
        (Path(directory) / f"{stem}.author-log.jsonl").write_text("".join(json.dumps(e) + "\n" for e in entries), encoding="utf-8")

    def test_the_cost_is_counted_from_the_log_and_nothing_is_estimated(self):
        result = run_node(f"""
import {{ runCost }} from './skills/professional-slides/runtime/run-log.mjs';
const runs = {json.dumps(AUTHOR_LOG)};
const old = runs.map(({{ v, pages, mode, ...run }}) => ({{ ...run, mode: mode === 'check' ? 'full' : mode }}));
console.log(JSON.stringify({{ cost: runCost(runs), old: runCost(old), none: runCost([]) }}));
""")
        cost = result["cost"]
        self.assertEqual([cost["runs"], cost["clean"], cost["refused"]], [6, 2, 4])
        self.assertEqual(cost["modes"], {"draft": {"runs": 1, "refused": 0}, "check": {"runs": 3, "refused": 3}, "full": {"runs": 2, "refused": 1}})
        self.assertEqual([cost["pages"], cost["runsPerPage"]], [12, 0.5])
        self.assertEqual(cost["refusalsByCode"]["SCENE_VOID"], {"findings": 2, "runs": 2})
        self.assertEqual(cost["refusalsByCode"]["WORDS"], {"findings": 2, "runs": 2})
        self.assertEqual(cost["refusalsByPage"]["p4"], {"findings": 4, "runs": 4})
        self.assertEqual(sorted(cost["refusalsByPage"]), ["p2", "p4", "p9"])  # a deck-level finding is no page's
        # One page refused in four runs in a row, each time under another code: the page fixed one finding at a time.
        self.assertEqual(cost["longestStreak"], {"page": "p4", "runs": 4, "fromRun": 2, "toRun": 5, "codes": ["SCENE_VOID", "PAGE_DOES_NOT_COMPOSE", "TEXT_COVERAGE_LOW"]})
        self.assertEqual(cost["recurring"], {"SCENE_VOID [p4]": 2})
        self.assertNotIn("note", cost)
        # A log written before checks were told apart says so, and reports no page count it was never given.
        self.assertEqual(result["old"]["modes"], {"draft": {"runs": 1, "refused": 0}, "full": {"runs": 5, "refused": 4}})
        self.assertNotIn("pages", result["old"])
        self.assertIn("6 runs were logged before a check was told apart", result["old"]["note"])
        self.assertEqual([result["none"]["runs"], result["none"]["longestStreak"]], [0, None])

    def test_author_deck_logs_each_run_s_mode_and_reports_the_cost(self):
        import tempfile
        author = ROOT / "skills" / "professional-slides" / "runtime" / "author-deck.mjs"
        fixtures = ROOT / "evals" / "quality" / "fixtures" / "evidence"
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("explainer.pages.json", "explainer.insights.json"):
                (Path(tmp) / name).write_text((fixtures / name).read_text(encoding="utf-8"), encoding="utf-8")
            pages = Path(tmp) / "explainer.pages.json"
            for flag in ("--draft", "--check"):
                subprocess.run(["node", str(author), str(pages), flag], capture_output=True, text=True, cwd=ROOT)
            entries = [json.loads(line) for line in (Path(tmp) / "explainer.author-log.jsonl").read_text(encoding="utf-8").splitlines()]
            self.assertEqual([(e["run"], e["mode"], e["v"]) for e in entries], [(1, "draft", 2), (2, "check", 2)])
            self.assertTrue(all(e["pages"] == len(json.loads(pages.read_text(encoding="utf-8"))["pages"]) for e in entries))
            out = subprocess.run(["node", str(author), str(pages), "--log"], capture_output=True, text=True, cwd=ROOT)
            cost = json.loads(out.stdout)
            self.assertEqual(cost["runs"], 2)
            self.assertEqual(sorted(cost["modes"]), ["check", "draft"])
            self.assertEqual(cost["refused"], sum(1 for e in entries if not e["ok"]))
            for key in ("refusalsByCode", "refusalsByPage", "longestStreak", "recurring"):
                self.assertIn(key, cost)

    def test_the_harness_records_the_cost_of_the_run_it_scores(self):
        import tempfile
        page = {"id": "s", "nodes": [{"role": "action-title", "type": "text"}] + [{"role": "m", "type": "rect"}] * 20, "componentInstances": [{"component": "table"}]}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "out").mkdir()
            (root / "out" / "scene.json").write_text(json.dumps({"id": "t", "purpose": "catalogue", "slides": [page] * 6}), encoding="utf-8")
            bare, _ = score("-", str(root / "out"))
            self.assertNotIn("cost", bare, "a run that kept no log has no cost recorded, not a cost of zero")
            self.write_log(root)
            scored, code = score("-", str(root / "out"))
            self.assertEqual([scored["cost"]["runs"], scored["cost"]["refused"], scored["cost"]["longestStreak"]["runs"]], [6, 4, 4])
            self.assertEqual(code, 0, "the cost is reported, never scored")
            text = subprocess.run(["node", str(SCORE), "-", str(root / "out")], capture_output=True, text=True, cwd=ROOT).stdout
            self.assertIn("6 compile runs, 4 refused, 0.5 runs a page over 12 pages", text)
            self.assertIn("longest streak on one page: p4, refused in 4 runs in a row", text)


if __name__ == "__main__":
    unittest.main()
