"""The quality eval: agent runs, a blind judge, pairwise versions, results.

No model is called here. A fake agent (evals/quality/fixtures/fake-agent.mjs)
writes a small deck the way a real run lays one out, including the author's
own files, and a fake judge logs exactly what its packet held and answers in
the envelope a CLI in JSON mode prints. What is under test is the harness: that
the judge sees the brief, the rubric and the pages and nothing the author
wrote; that a new version is compared with the last one deck against deck and
the answer is mapped back through the shuffled order; that results are keyed by
skill version, judge, brief and run and never doubled; and that the summary's
arithmetic is right.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, run_node

QUALITY = ROOT / "evals" / "quality"
RUN = QUALITY / "run.mjs"
FIXTURES = QUALITY / "fixtures"
AUTHOR_MARK = "AUTHOR-RATIONALE-7f3e"
BRIEF = "dev/network-rollout"


class Harness:
    """A temp results file, store and config pointing at the fake agent and judge."""

    def setUp(self):
        if not NODE:
            self.skipTest("Node.js is not available")
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.results = self.tmp / "results.jsonl"
        self.store = self.tmp / "store"
        self.judge_log = self.tmp / "judge.log"
        self.agent_log = self.tmp / "agent.log"
        self.config = self.tmp / "config.json"
        self.config.write_text(json.dumps({
            "defaults": {"agent": "fake", "judge": "fake", "prompt": "brief"},
            "prompts": {"brief": "{brief}"},
            "agents": {"fake": {"command": [NODE, str(FIXTURES / "fake-agent.mjs"), "{prompt}"], "timeoutMinutes": 1}},
            "judges": {"fake": {"model": "fixture", "command": [NODE, str(FIXTURES / "fake-judge.mjs"), "{prompt}", "{packet}"],
                                "timeoutMinutes": 1}},
        }))

    def run_eval(self, sha, *extra, slides=4, anchors=None, check=True):
        args = [NODE, str(RUN), "--set", "dev", "--brief", BRIEF, "--config", str(self.config),
                "--results", str(self.results), "--store", str(self.store), "--skill-sha", sha, *extra]
        if anchors is None:
            args.append("--no-anchors")
        else:
            args += ["--anchors-file", str(anchors)]
        env = {**os.environ, "FAKE_AGENT_SLIDES": str(slides), "FAKE_JUDGE_LOG": str(self.judge_log),
               "FAKE_AGENT_LOG": str(self.agent_log)}
        out = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, env=env, timeout=120)
        if check:
            self.assertEqual(out.returncode, 0, out.stderr + out.stdout)
        return out

    def rows(self):
        return [json.loads(line) for line in self.results.read_text().splitlines() if line.strip()]

    def judged(self):
        return [json.loads(line) for line in self.judge_log.read_text().splitlines() if line.strip()]


class BlindingTests(Harness, unittest.TestCase):
    def test_the_judge_sees_the_brief_the_rubric_and_the_pages_and_nothing_else(self):
        self.run_eval("aaa", "--runs", "1")
        self.run_eval("bbb", "--runs", "1", slides=8)
        packets = self.judged()
        self.assertEqual([p["mode"] for p in packets], ["deck", "deck", "pair"])
        for packet in packets:
            with self.subTest(mode=packet["mode"]):
                # The fake agent wrote a pages file, plan, deck spec, scene,
                # review, self-check, storyline review, delivery record and an
                # authoring log beside the renders; every one carries the mark.
                self.assertEqual(packet["leaks"], [])
                allowed = {"brief.md", "rubric.md"}
                for name in packet["files"]:
                    self.assertTrue(name in allowed or name.endswith(".png"), name)
                self.assertFalse([f for f in packet["files"] if f.endswith((".json", ".jsonl", ".gz"))])

    def test_the_agent_and_the_judge_get_the_request_not_the_suite_s_notes_on_it(self):
        self.run_eval("aaa", "--runs", "1")
        told = [json.loads(line) for line in self.agent_log.read_text().splitlines()]
        self.assertEqual(len(told), 1)
        self.assertIn("twelve markets", told[0]["prompt"])
        # "Why this brief is in the suite" says what the run is there to catch.
        self.assertNotIn("Why this brief is in the suite", told[0]["prompt"])
        self.assertNotIn("harvey", told[0]["prompt"])
        brief_in_packet = run_node('''
import {briefRequest} from './evals/quality/lib.mjs';
import fs from 'node:fs';
console.log(JSON.stringify(briefRequest(fs.readFileSync('./evals/cold-run/briefs/network-rollout.md','utf8'))));
''')
        self.assertNotIn("Why this brief is in the suite", brief_in_packet)

    def test_a_pair_is_shown_as_deck_1_and_deck_2_without_saying_which_is_new(self):
        self.run_eval("aaa", "--runs", "1")
        self.run_eval("bbb", "--runs", "1", slides=8)
        pair = [p for p in self.judged() if p["mode"] == "pair"][0]
        self.assertEqual(sorted({f.split("/")[0] for f in pair["files"] if "/" in f}), ["deck-1", "deck-2"])
        for word in ("current", "previous", "bbb", "aaa", "version"):
            self.assertNotIn(word, pair["prompt"])
            self.assertFalse([f for f in pair["files"] if word in f])


class PairingTests(Harness, unittest.TestCase):
    def test_a_new_version_is_judged_against_the_last_one_deck_against_deck(self):
        self.run_eval("aaa", "--runs", "2")
        first = self.rows()
        self.assertTrue(all(r["pairwise"] == {"skipped": "no previous version stored for this brief"} for r in first))
        # The fake judge prefers the deck with more sheets: 8 pages is two sheets
        # against one, whichever side of the packet the shuffle put it on.
        self.run_eval("bbb", "--runs", "3", slides=8)
        second = self.rows()[2:]
        self.assertEqual(len(second), 3)
        orders = set()
        for row in second:
            self.assertEqual(row["pairwise"]["against"], "aaa")
            self.assertEqual(row["pairwise"]["againstRun"], 2, "the most recent stored deck of that version")
            self.assertEqual(row["pairwise"]["preferred"], "current")
            orders.add(tuple(row["pairwise"]["order"]))
        # And a worse version loses, mapped back through the same shuffle.
        self.run_eval("ccc", "--runs", "1", slides=4)
        last = self.rows()[-1]["pairwise"]
        self.assertEqual((last["against"], last["preferred"]), ("bbb", "previous"))
        self.assertTrue(orders, "each comparison records the order the judge saw")

    def test_the_summary_reports_mean_spread_and_win_rate(self):
        self.run_eval("aaa", "--runs", "1")
        out = self.run_eval("bbb", "--runs", "2", slides=8)
        self.assertIn("pairwise win rate against the previous version: 1 over 2 comparisons", out.stdout)
        report = self.run_eval("bbb", "--report")
        self.assertIn(BRIEF, report.stdout)
        self.assertIn("2-0-0", report.stdout)

    def test_no_pairwise_skips_the_comparison(self):
        self.run_eval("aaa", "--runs", "1")
        self.run_eval("bbb", "--runs", "1", "--no-pairwise", slides=8)
        self.assertEqual(self.rows()[-1]["pairwise"], {"skipped": "--no-pairwise"})
        self.assertEqual([p["mode"] for p in self.judged()], ["deck", "deck"])


class ResultsTests(Harness, unittest.TestCase):
    def test_rows_are_keyed_by_version_judge_brief_and_run_and_only_appended(self):
        self.run_eval("aaa", "--runs", "2")
        before = self.results.read_text()
        self.run_eval("aaa", "--runs", "1")
        after = self.results.read_text()
        self.assertTrue(after.startswith(before), "earlier rows are never rewritten")
        keys = [(r["key"]["skillSha"], r["key"]["judge"], r["key"]["brief"], r["key"]["run"]) for r in self.rows()]
        self.assertEqual(keys, [("aaa", "fake:fixture", BRIEF, 1), ("aaa", "fake:fixture", BRIEF, 2),
                                ("aaa", "fake:fixture", BRIEF, 3)])
        row = self.rows()[0]
        self.assertEqual(row["schema"], "professional-slides.quality-result/v1")
        self.assertEqual(row["status"], "judged")
        self.assertEqual(row["judge"]["rating"], 4)
        self.assertEqual(set(row["judge"]["dimensions"]), {"argument", "evidence", "visual", "copy", "sequence"})
        # The build bars and the plan gates ran on what the agent built.
        self.assertIn("accepted", row["build"])
        self.assertIn("countsByCode", row["plan"])
        self.assertTrue(row["deck"]["delivered"])
        # Kept relative to the store, so results.jsonl carries no machine path.
        self.assertFalse(Path(row["deck"]["artifacts"]).is_absolute())
        self.assertNotIn(str(self.tmp), self.results.read_text())
        kept = self.store / row["deck"]["artifacts"]
        # The plan kept is the run's, not a review-history copy under .reviews/.
        self.assertEqual(len(json.loads((kept / "plan.json").read_text())["pages"]), 4)
        self.assertEqual(row["deckSlides"], 4)
        self.assertEqual(row["deck"]["deliveryStage"], "delivered")
        self.assertEqual(sorted(p.name for p in kept.iterdir() if p.is_file()),
                         ["agent.stderr.txt", "agent.stdout.txt", "deck.json", "delivery.json", "kept.json",
                          "pages.json", "plan.json", "scene.json.gz"])

    def test_a_run_that_leaves_no_deck_is_recorded_as_one(self):
        self.run_eval("aaa", "--runs", "1", slides=0)
        row = self.rows()[0]
        self.assertEqual(row["status"], "no-deck")
        self.assertNotIn("judge", row)
        self.assertEqual(self.judged() if self.judge_log.exists() else [], [])

    def test_a_dry_run_runs_and_writes_nothing(self):
        out = self.run_eval("aaa", "--runs", "2", "--dry-run")
        self.assertIn(f"{BRIEF} run 2", out.stdout)
        self.assertIn("fake-agent.mjs", out.stdout)
        self.assertFalse(self.results.exists())
        self.assertFalse(self.store.exists())
        self.assertFalse(self.agent_log.exists())

    def test_the_same_key_is_refused_rather_than_doubled(self):
        result = run_node('''
import {appendResult} from './evals/quality/lib.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'q-')),'r.jsonl');
const row={key:{skillSha:'a',judge:'j:m',brief:'dev/x',run:1}};
appendResult(file,row);
let refused=false; try{appendResult(file,row);}catch(e){refused=/already recorded/.test(e.message);}
appendResult(file,{...row,key:{...row.key,judge:'j:other'}});
console.log(JSON.stringify({refused,lines:fs.readFileSync(file,'utf8').trim().split('\\n').length}));
''')
        self.assertEqual(result, {"refused": True, "lines": 2})

    def test_unknown_arguments_fail_with_the_usage(self):
        out = self.run_eval("aaa", "--runs", "0", check=False)
        self.assertEqual(out.returncode, 1)
        self.assertIn("--runs must be a positive whole number", out.stderr)
        out = self.run_eval("aaa", "--bogus", check=False)
        self.assertIn("Usage: run.mjs", out.stderr)


class AnchorTests(Harness, unittest.TestCase):
    def test_judge_error_is_computed_over_scored_anchors_only(self):
        anchors = self.tmp / "anchors"
        (anchors / "images").mkdir(parents=True)
        shutil.copy(QUALITY / "anchors" / "images" / "high-page-types-21.jpg", anchors / "images" / "a.jpg")
        shutil.copy(QUALITY / "anchors" / "images" / "low-specimen-02.jpg", anchors / "images" / "b.jpg")
        shutil.copy(QUALITY / "anchors" / "images" / "low-specimen-10.jpg", anchors / "images" / "c.jpg")
        doc = {"schema": "professional-slides.quality-anchors/v1", "scale": {"min": 1, "max": 10}, "anchors": [
            {"id": "a", "tier": "high", "image": "images/a.jpg", "humanScore": 8, "provisional": False},
            {"id": "b", "tier": "low", "image": "images/b.jpg", "humanScore": 3, "provisional": False},
            {"id": "c", "tier": "low", "image": "images/c.jpg", "humanScore": None, "provisional": True}]}
        (anchors / "anchors.json").write_text(json.dumps(doc))
        out = self.run_eval("aaa", "--runs", "1", anchors=anchors / "anchors.json")
        # The fake judge scores every page 5: |5-8| and |5-3| average 2.5.
        self.assertIn("mean absolute error 2.5 over 2 scored anchors", out.stdout)
        row = [r for r in self.rows() if r.get("kind") == "anchors"][0]
        self.assertEqual([a["id"] for a in row["anchors"]], ["a", "b"])
        self.assertEqual([p["files"] for p in self.judged() if p["mode"] == "anchor"],
                         [["page.jpg", "rubric.md"], ["page.jpg", "rubric.md"]])

    def test_the_shipped_anchors_are_provisional_and_pinned(self):
        import hashlib
        doc = json.loads((QUALITY / "anchors" / "anchors.json").read_text())
        schema = json.loads((QUALITY / "anchors" / "schema.json").read_text())
        anchors = doc["anchors"]
        self.assertGreaterEqual(len(anchors), 10)
        self.assertLessEqual(len(anchors), 20)
        self.assertEqual({a["tier"] for a in anchors}, {"high", "low"})
        required = set(schema["properties"]["anchors"]["items"]["required"])
        for anchor in anchors:
            with self.subTest(anchor=anchor["id"]):
                self.assertTrue(required <= set(anchor))
                self.assertTrue(anchor["provisional"])
                self.assertIsNone(anchor["humanScore"])
                image = QUALITY / "anchors" / anchor["image"]
                self.assertEqual(hashlib.sha256(image.read_bytes()).hexdigest(), anchor["sha256"])
        out = self.run_eval("aaa", "--runs", "1", "--dry-run", anchors=QUALITY / "anchors" / "anchors.json")
        self.assertIn(f"anchors: 0 of {len(anchors)} carry a human score", out.stdout)


class ArithmeticTests(unittest.TestCase):
    def test_spread_win_rate_and_summary(self):
        result = run_node('''
import {spread,winRate,summarize,anchorError} from './evals/quality/lib.mjs';
const dims=(n)=>({argument:n,evidence:n,visual:n,copy:n,sequence:n});
const row=(sha,brief,run,rating,preferred,extra={})=>({key:{skillSha:sha,judge:'j:m',brief,run},status:'judged',
  judge:{rating,dimensions:dims(rating),majors:[]},build:{accepted:rating>6},plan:{accepted:true},deck:{delivered:true},
  pairwise:preferred?{against:'old',preferred}:{skipped:'none'},...extra});
const rows=[row('new','dev/a',1,6,'current'),row('new','dev/a',2,8,'tie'),row('new','dev/a',3,7,'previous'),
  row('new','dev/b',1,5,null),{key:{skillSha:'new',judge:'j:m',brief:'dev/b',run:2},status:'no-deck'},
  row('old','dev/a',1,2,null),row('new','dev/a',4,1,'current',{key:{skillSha:'new',judge:'j:other',brief:'dev/a',run:4}})];
const s=summarize(rows,{skillSha:'new',judge:'j:m'});
console.log(JSON.stringify({a:s.briefs['dev/a'],b:s.briefs['dev/b'],all:s.pairwise,
  one:spread([4]),none:spread([]),mae:anchorError([{humanScore:8,judgeScore:5},{humanScore:3,judgeScore:5},{humanScore:null,judgeScore:9}])}));
''')
        a = result["a"]
        self.assertEqual(a["runs"], 3, "another judge's rows and another version's rows stay out")
        self.assertEqual(a["rating"], {"n": 3, "mean": 7, "sd": 1, "min": 6, "max": 8})
        self.assertEqual(a["buildAccepted"], 2)
        self.assertEqual(a["pairwise"], {"comparisons": 3, "wins": 1, "ties": 1, "losses": 1, "rate": 0.5})
        self.assertEqual(result["b"]["noDeck"], 1)
        self.assertEqual(result["b"]["rating"]["n"], 1)
        self.assertEqual(result["all"]["comparisons"], 3, "skipped comparisons are not counted")
        self.assertEqual(result["one"]["sd"], 0)
        self.assertIsNone(result["none"]["mean"])
        self.assertEqual(result["mae"], 2.5)

    def test_judge_output_is_read_through_its_envelope(self):
        result = run_node('''
import {parseJudgeOutput,validateVerdict,validatePreference,fillTemplate} from './evals/quality/lib.mjs';
const verdict={rating:6.5,dimensions:{argument:7,evidence:6,visual:5,copy:6,sequence:5},majors:[]};
const forms=[JSON.stringify(verdict),
  JSON.stringify({type:'result',result:'Verdict:\\n```json\\n'+JSON.stringify(verdict)+'\\n```'}),
  JSON.stringify({type:'result',result:'',structured_output:verdict}),
  'Some prose first. '+JSON.stringify(verdict)+' trailing words'];
const parsed=forms.map(f=>validateVerdict(parseJudgeOutput(f)).rating);
let refused=false; try{validateVerdict({rating:11,dimensions:verdict.dimensions});}catch{refused=true;}
const pref=validatePreference({preference:'deck-2',margin:'clear'},['current','previous']).preferred;
const tie=validatePreference({preference:'tie'},['previous','current']).preferred;
console.log(JSON.stringify({parsed,refused,pref,tie,filled:fillTemplate(['x','{prompt}','--m','{model}','{keep}'],{prompt:'p q',model:'opus'})}));
''')
        self.assertEqual(result["parsed"], [6.5, 6.5, 6.5, 6.5])
        self.assertTrue(result["refused"])
        self.assertEqual(result["pref"], "previous")
        self.assertEqual(result["tie"], "tie")
        self.assertEqual(result["filled"], ["x", "p q", "--m", "opus", "{keep}"])


class BriefSetTests(unittest.TestCase):
    def test_dev_is_the_cold_run_briefs_and_heldout_is_three_new_ones(self):
        result = run_node('''
import {briefs} from './evals/quality/lib.mjs';
console.log(JSON.stringify({dev:briefs('dev').map(b=>b.id),heldout:briefs('heldout').map(b=>b.id),all:briefs('all').length}));
''')
        cold = sorted(p.stem for p in (ROOT / "evals" / "cold-run" / "briefs").glob("*.md"))
        self.assertEqual(result["dev"], [f"dev/{name}" for name in cold])
        self.assertEqual(result["heldout"], ["heldout/competitive-position", "heldout/investor-pitch", "heldout/steerco-update"])
        self.assertEqual(result["all"], len(cold) + 3)

    def test_heldout_briefs_are_written_like_the_cold_run_briefs_and_never_tuned_on(self):
        heldout = QUALITY / "briefs" / "heldout"
        readme = (heldout / "README.md").read_text()
        self.assertIn("never used to tune", readme)
        for brief in sorted(heldout.glob("*.md")):
            if brief.name == "README.md":
                continue
            with self.subTest(brief=brief.name):
                text = brief.read_text()
                for part in ("**Audience.**", "**Decision.**", "**Constraints.**", "**Length.**",
                             "Why this brief is in the suite: it is held out."):
                    self.assertIn(part, text)

    def test_the_skill_version_is_the_tree_of_skills_plus_any_uncommitted_change(self):
        result = run_node('''
import {skillSha} from './evals/quality/lib.mjs';
import {execFileSync} from 'node:child_process';
console.log(JSON.stringify({sha:skillSha(),tree:execFileSync('git',['rev-parse','HEAD:skills'],{encoding:'utf8'}).trim()}));
''')
        self.assertTrue(result["sha"].startswith(result["tree"]))
        self.assertRegex(result["sha"], r"^[0-9a-f]{40}(\+dirty\.[0-9a-f]{12})?$")


if __name__ == "__main__":
    unittest.main()
