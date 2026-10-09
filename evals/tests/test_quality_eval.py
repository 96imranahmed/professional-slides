"""The quality eval: agent runs, a blind judge, pairwise versions, results.

No model is called here. A fake agent (evals/quality/fixtures/fake-agent.mjs)
writes a small deck the way a real run lays one out, including the author's
own files, and a fake judge logs exactly what its packet held and answers in
the envelope a CLI in JSON mode prints. What is under test is the harness: that
the judge sees the brief, the rubric and the pages and nothing the author
wrote; that a new version is compared with the last one deck against deck and
the answer is mapped back through the shuffled order; that results are keyed by
skill version, judge, treatment (agent and prompt), brief and run and never
doubled, even by runners sharing the results file; that each run's deck is
kept in a directory of its own, and is one attempt's, scene and authoring files
alike; and that the summary's arithmetic is right.
"""
from __future__ import annotations

import json
import re
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

    def eval_command(self, sha, *extra, slides=4, env=None):
        args = [NODE, str(RUN), "--set", "dev", "--brief", BRIEF, "--config", str(self.config),
                "--results", str(self.results), "--store", str(self.store), "--skill-sha", sha, *extra]
        env = {**os.environ, "FAKE_AGENT_SLIDES": str(slides), "FAKE_JUDGE_LOG": str(self.judge_log),
               "FAKE_AGENT_LOG": str(self.agent_log), **(env or {})}
        return args, env

    def run_eval(self, sha, *extra, slides=4, check=True, env=None):
        args, env = self.eval_command(sha, *extra, slides=slides, env=env)
        out = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, env=env, timeout=120)
        if check:
            self.assertEqual(out.returncode, 0, out.stderr + out.stdout)
        return out

    def start_eval(self, sha, *extra, slides=4, env=None):
        """A runner left running, so a test can start a second beside it."""
        args, env = self.eval_command(sha, *extra, slides=slides, env=env)
        runner = subprocess.Popen(args, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
        self.addCleanup(lambda: runner.poll() is None and runner.kill())
        return runner

    def claims(self):
        claims = Path(f"{self.results}.claims")
        return sorted(p.name for p in claims.iterdir()) if claims.exists() else []

    def rows(self):
        return [json.loads(line) for line in self.results.read_text().splitlines() if line.strip()]

    def judged(self):
        return [json.loads(line) for line in self.judge_log.read_text().splitlines() if line.strip()]

    def agent_calls(self):
        return len(self.agent_log.read_text().splitlines()) if self.agent_log.exists() else 0


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
console.log(JSON.stringify(briefRequest(fs.readFileSync('./evals/quality/briefs/dev/network-rollout.md','utf8'))));
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


class TreatmentTests(Harness, unittest.TestCase):
    """The agent and the prompt it was given are part of what a row measures."""

    def setUp(self):
        super().setUp()
        config = json.loads(self.config.read_text())
        config["prompts"]["unattended"] = "{brief}\n\nNo one is available to answer questions during this run."
        config["agents"]["other"] = config["agents"]["fake"]
        self.config.write_text(json.dumps(config))

    def test_another_agent_or_prompt_is_its_own_measurement(self):
        self.run_eval("aaa", "--runs", "1")
        # Same skill, judge and brief under another prompt, then another agent:
        # each starts at run 1 under its own key, and none is refused after
        # its agent and judge have run.
        self.run_eval("aaa", "--runs", "1", "--prompt", "unattended")
        self.run_eval("aaa", "--runs", "1", "--agent", "other")
        rows = self.rows()
        self.assertEqual([(r["key"]["agent"], r["key"]["prompt"], r["key"]["run"]) for r in rows],
                         [("fake", "brief", 1), ("fake", "unattended", 1), ("other", "brief", 1)])
        self.assertEqual(self.agent_calls(), 3)
        self.assertEqual(len({r["deck"]["artifacts"] for r in rows}), 3, "each kept in its own place")

    def test_the_report_keeps_treatments_apart(self):
        self.run_eval("aaa", "--runs", "2")
        self.run_eval("aaa", "--runs", "1", "--prompt", "unattended", slides=8)
        report = self.run_eval("aaa", "--report").stdout
        brief_block, unattended_block = report.split("\n\n")
        self.assertIn("agent fake · prompt brief", brief_block)
        self.assertIn("agent fake · prompt unattended", unattended_block)
        # Two runs rated 4 under the brief alone; one rated 5 unattended.
        row = lambda block: next(line.split() for line in block.splitlines() if BRIEF in line)
        self.assertEqual(row(brief_block)[1:3], ["2", "4"])
        self.assertEqual(row(unattended_block)[1:3], ["1", "5"])
        only = self.run_eval("aaa", "--report", "--prompt", "unattended").stdout
        self.assertNotIn("prompt brief", only)

    def test_pairwise_compares_like_with_like(self):
        self.run_eval("aaa", "--runs", "1")
        self.run_eval("bbb", "--runs", "1", "--prompt", "unattended", slides=8)
        self.assertEqual(self.rows()[-1]["pairwise"], {"skipped": "no previous version stored for this brief"})
        # bbb's deck is the most recent, but it ran under another prompt.
        self.run_eval("ccc", "--runs", "1")
        pair = self.rows()[-1]["pairwise"]
        self.assertEqual((pair["against"], pair["againstRun"]), ("aaa", 1))


class ResultsTests(Harness, unittest.TestCase):
    def test_rows_are_keyed_by_version_judge_treatment_brief_and_run_and_only_appended(self):
        self.run_eval("aaa", "--runs", "2")
        before = self.results.read_text()
        self.run_eval("aaa", "--runs", "1")
        after = self.results.read_text()
        self.assertTrue(after.startswith(before), "earlier rows are never rewritten")
        keys = [tuple(r["key"][f] for f in ("skillSha", "judge", "agent", "prompt", "brief", "run")) for r in self.rows()]
        self.assertEqual(keys, [("aaa", "fake:fixture", "fake", "brief", BRIEF, 1), ("aaa", "fake:fixture", "fake", "brief", BRIEF, 2),
                                ("aaa", "fake:fixture", "fake", "brief", BRIEF, 3)])
        self.assertEqual(self.claims(), [], "each claim is let go once its row is recorded")
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
        # What the run cost is counted from the author's own log: the numbers are recorded, the log is not kept.
        self.assertEqual([row["cost"]["runs"], row["cost"]["refused"], row["cost"]["modes"]["check"]], [2, 1, {"runs": 1, "refused": 1}])
        self.assertEqual(row["cost"]["longestStreak"]["page"], "p1")
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
        self.assertFalse(Path(f"{self.results}.claims").exists(), "nothing is claimed")

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

    def test_a_key_recorded_while_the_run_was_under_way_is_passed_over_before_the_agent_runs(self):
        # A second runner sharing the results file records run 2 while this
        # runner's run 1 is under way. Run 2 is passed over before its agent
        # and judge are paid for, never doubled, and this runner's second run
        # is run 3.
        taken = {"schema": "professional-slides.quality-result/v1", "status": "judged",
                 "key": {"skillSha": "aaa", "judge": "fake:fixture", "agent": "fake", "prompt": "brief", "brief": BRIEF, "run": 2}}
        out = self.run_eval("aaa", "--runs", "2",
                            env={"FAKE_AGENT_RECORDS": json.dumps({"file": str(self.results), "row": taken})})
        self.assertIn(f"{BRIEF} run 2: already recorded; taking run 3", out.stdout)
        self.assertEqual(self.agent_calls(), 2, "the agent ran for runs 1 and 3")
        self.assertEqual([p["mode"] for p in self.judged()], ["deck", "deck"])
        runs = [r["key"]["run"] for r in self.rows()]
        self.assertEqual(sorted(runs), [1, 2, 3])
        self.assertNotIn("deck", next(r for r in self.rows() if r["key"]["run"] == 2), "run 2 is the other runner's row")

    def test_old_rows_read_as_the_default_treatment(self):
        result = run_node('''
import {DEFAULT_TREATMENT,identityOf,keyOf,nextRun} from './evals/quality/lib.mjs';
import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync('./evals/quality/config.json','utf8'));
const key={skillSha:'a',judge:'j:m',brief:'dev/x',run:1};
// Written before the treatment joined the key: beside it, or (by hand) not at all.
const beside={key,agent:'codex',prompt:'unattended'}, bare={key};
console.log(JSON.stringify({defaults:DEFAULT_TREATMENT,config:config.defaults,beside:identityOf(beside),bare:identityOf(bare),
  sameKey:keyOf(bare)===keyOf({key:{...key,...DEFAULT_TREATMENT}}),
  next:nextRun([beside,bare],{skillSha:'a',judge:'j:m',brief:'dev/x',...DEFAULT_TREATMENT}),
  nextCodex:nextRun([beside,bare],{skillSha:'a',judge:'j:m',brief:'dev/x',agent:'codex',prompt:'brief'})}));
''')
        # The defaults are config.json's, so the two cannot drift apart.
        self.assertEqual(result["defaults"], {"agent": result["config"]["agent"], "prompt": result["config"]["prompt"]})
        self.assertEqual((result["beside"]["agent"], result["beside"]["prompt"]), ("codex", "unattended"))
        self.assertEqual((result["bare"]["agent"], result["bare"]["prompt"]), ("claude", "brief"))
        self.assertTrue(result["sameKey"])
        self.assertEqual(result["next"], 2)
        self.assertEqual(result["nextCodex"], 1)

    def test_unknown_arguments_fail_with_the_usage(self):
        out = self.run_eval("aaa", "--runs", "0", check=False)
        self.assertEqual(out.returncode, 1)
        self.assertIn("--runs must be a positive whole number", out.stderr)
        out = self.run_eval("aaa", "--bogus", check=False)
        self.assertIn("Usage: run.mjs", out.stderr)


class ConcurrencyTests(Harness, unittest.TestCase):
    """Runners sharing a results file and a store never run one key, nor keep two decks in one place."""

    def test_runners_started_together_number_their_runs_apart(self):
        # Both read the results before either records anything, so both would
        # start at run 1. Each agent takes a second, so the two are under way
        # at once.
        runners = [self.start_eval("aaa", "--runs", "2", env={"FAKE_AGENT_SLEEP_MS": "1000"}) for _ in range(2)]
        for runner in runners:
            stdout, stderr = runner.communicate(timeout=120)
            self.assertEqual(runner.returncode, 0, stderr + stdout)
        rows = self.rows()
        self.assertEqual(sorted(r["key"]["run"] for r in rows), [1, 2, 3, 4], "every key once, none doubled")
        self.assertEqual(self.agent_calls(), 4, "no run was paid for twice")
        kept = {r["deck"]["artifacts"] for r in rows}
        self.assertEqual(len(kept), 4, "each run kept in its own place")
        for artifacts in kept:
            self.assertTrue((self.store / artifacts / "kept.json").exists(), artifacts)
        self.assertEqual(self.claims(), [])

    def test_a_claim_left_by_a_killed_runner_is_numbered_past(self):
        # A runner killed mid-run cannot let go of its claim; the next runner
        # passes over that number rather than stopping on it.
        key = {"skillSha": "aaa", "judge": "fake:fixture", "agent": "fake", "prompt": "brief", "brief": BRIEF, "run": 1}
        held = run_node(f'''
import {{claimRun}} from './evals/quality/lib.mjs';
console.log(JSON.stringify({{held: claimRun({json.dumps(str(self.results))}, {json.dumps(key)}).held}}));
''')
        self.assertTrue(held["held"])
        out = self.run_eval("aaa", "--runs", "1")
        self.assertRegex(out.stdout, rf"{re.escape(BRIEF)} run 1: claimed by process \d+ on .+; taking run 2")
        self.assertEqual([r["key"]["run"] for r in self.rows()], [2])
        self.assertEqual(len(self.claims()), 1, "the killed runner's claim is left for whoever knows it is gone")

    def test_a_results_file_sharing_the_store_keeps_its_runs_apart(self):
        # Two results files, one store, the same key in each: the second run's
        # deck is kept beside the first's, not written over it.
        self.run_eval("aaa", "--runs", "1", slides=4)
        other = self.tmp / "other.jsonl"
        self.run_eval("aaa", "--runs", "1", "--results", str(other), slides=8)
        first = self.rows()[0]["deck"]["artifacts"]
        second = json.loads(other.read_text())["deck"]["artifacts"]
        self.assertEqual(second, f"{first}.2")
        self.assertEqual(len(json.loads((self.store / first / "kept.json").read_text())["slides"]), 4, "the first run's deck is intact")
        self.assertEqual(len(json.loads((self.store / second / "kept.json").read_text())["slides"]), 8)

    def test_a_key_is_claimed_once_and_then_freed_or_recorded(self):
        result = run_node('''
import {appendResult,claimRun,claimsDir} from './evals/quality/lib.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'q-')),'r.jsonl');
const key={skillSha:'a',judge:'j:m',agent:'fake',prompt:'brief',brief:'dev/x',run:1};
const first=claimRun(file,key), second=claimRun(file,key), other=claimRun(file,{...key,prompt:'unattended'});
first.release();
const again=claimRun(file,key);
appendResult(file,{key});
again.release();
const recorded=claimRun(file,key);
console.log(JSON.stringify({first:first.held,second:second.held,secondWhy:second.why,pid:process.pid,other:other.held,
  again:again.held,recorded:recorded.held,recordedWhy:recorded.why,left:fs.readdirSync(claimsDir(file)).length}));
''')
        self.assertTrue(result["first"])
        self.assertFalse(result["second"], "a held key is not handed out twice")
        self.assertIn(f"claimed by process {result['pid']}", result["secondWhy"])
        self.assertTrue(result["other"], "another treatment's key is its own")
        self.assertTrue(result["again"], "a released key is free")
        self.assertFalse(result["recorded"], "a recorded key is not handed out")
        self.assertEqual(result["recordedWhy"], "already recorded")
        self.assertEqual(result["left"], 1, "only the other treatment's claim is still held")


class CollectTests(Harness, unittest.TestCase):
    """The deck kept is one attempt's: its scene, and the authoring files of that deck."""

    def test_an_abandoned_attempt_s_newer_files_are_not_kept_as_the_delivered_deck_s(self):
        self.run_eval("aaa", "--runs", "1", env={"FAKE_AGENT_RETRY": "1"})
        row = self.rows()[0]
        kept = self.store / row["deck"]["artifacts"]
        self.assertEqual(row["deckSlides"], 4, "the delivered scene is judged")
        # The plan gates and the authoring files are the delivered deck's, not
        # the newer retry's one-page plan.
        for role in ("plan", "pages", "deck"):
            with self.subTest(role=role):
                doc = json.loads((kept / f"{role}.json").read_text())
                self.assertEqual(doc.get("id", doc.get("deck", {}).get("id")), "fake")
        self.assertEqual(len(json.loads((kept / "plan.json").read_text())["pages"]), 4)
        self.assertNotIn("missing", row["deck"])

    def test_authoring_files_follow_the_selected_deck_or_are_missing_with_a_reason(self):
        result = run_node('''
import {collectArtifacts} from './evals/quality/lib.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const later=new Date(Date.now()+60000);
const workspace=(files)=>{const ws=fs.mkdtempSync(path.join(os.tmpdir(),'q-ws-'));
  for(const [rel,body] of Object.entries(files)){const f=path.join(ws,rel);fs.mkdirSync(path.dirname(f),{recursive:true});
    fs.writeFileSync(f,JSON.stringify(typeof body==='function'?body(ws):body));if(rel.startsWith('two/'))fs.utimesSync(f,later,later);}
  return ws;};
const attempt=(dir,id,built)=>({[`${dir}/${id}.pages.json`]:{deck:{id}},[`${dir}/${id}.plan.json`]:{dir},[`${dir}/${id}.deck.json`]:{id,dir},
  [`${dir}/out/scene.json`]:{slides:[]},...(built?{[`${dir}/out/build-result.json`]:(ws)=>({pptxPath:path.join(ws,dir,'out',`${id}.pptx`)})}:{})});
const rel=(a,ws)=>Object.fromEntries(['scene','plan','pages','deck'].map((r)=>[r,a[r]&&path.relative(ws,a[r])]));
// Two attempts at one deck id, each built beside its spec; the older one delivered.
const same=workspace({...attempt('one','deck',true),...attempt('two','deck',true),'one/out/delivery.json':{accepted:true}});
// Two attempts whose builds recorded no deck id: which plan is whose would be a guess.
const blind=workspace({...attempt('one','a',false),...attempt('two','b',false)});
// One attempt, its build silent: the only candidate is unambiguous.
const lone=workspace(attempt('one','a',false));
const out={};
for(const [name,ws] of Object.entries({same,blind,lone})){const a=collectArtifacts(ws);out[name]={...rel(a,ws),missing:a.missing};}
console.log(JSON.stringify(out));
''')
        self.assertEqual(result["same"], {"scene": "one/out/scene.json", "plan": "one/deck.plan.json", "pages": "one/deck.pages.json",
                                          "deck": "one/deck.deck.json", "missing": {}})
        blind = result["blind"]
        self.assertEqual(blind["scene"], "two/out/scene.json")
        self.assertEqual((blind["plan"], blind["pages"], blind["deck"]), (None, None, None))
        for role in ("plan", "pages", "deck"):
            self.assertIn("no deck id", blind["missing"][role])
            self.assertIn("2 ", blind["missing"][role])
        self.assertEqual((result["lone"]["plan"], result["lone"]["missing"]), ("one/a.plan.json", {}))


class ArithmeticTests(unittest.TestCase):
    def test_spread_win_rate_and_summary(self):
        result = run_node('''
import {spread,winRate,summarize} from './evals/quality/lib.mjs';
const dims=(n)=>({argument:n,evidence:n,visual:n,copy:n,sequence:n});
const row=(sha,brief,run,rating,preferred,extra={})=>({key:{skillSha:sha,judge:'j:m',brief,run},status:'judged',
  judge:{rating,dimensions:dims(rating),majors:[]},build:{accepted:rating>6},plan:{accepted:true},deck:{delivered:true},
  pairwise:preferred?{against:'old',preferred}:{skipped:'none'},...extra});
const rows=[row('new','dev/a',1,6,'current'),row('new','dev/a',2,8,'tie'),row('new','dev/a',3,7,'previous'),
  row('new','dev/b',1,5,null),{key:{skillSha:'new',judge:'j:m',brief:'dev/b',run:2},status:'no-deck'},
  row('old','dev/a',1,2,null),row('new','dev/a',4,1,'current',{key:{skillSha:'new',judge:'j:other',brief:'dev/a',run:4}}),
  row('new','dev/a',1,1,'previous',{key:{skillSha:'new',judge:'j:m',agent:'claude',prompt:'unattended',brief:'dev/a',run:1}}),
  row('new','dev/a',1,1,'previous',{key:{skillSha:'new',judge:'j:m',brief:'dev/a',run:1},agent:'codex'})];
const s=summarize(rows,{skillSha:'new',judge:'j:m'});
console.log(JSON.stringify({a:s.briefs['dev/a'],b:s.briefs['dev/b'],all:s.pairwise,
  one:spread([4]),none:spread([])}));
''')
        a = result["a"]
        self.assertEqual(a["runs"], 3, "another judge's, version's or treatment's rows stay out")
        self.assertEqual(a["rating"], {"n": 3, "mean": 7, "sd": 1, "min": 6, "max": 8})
        self.assertEqual(a["buildAccepted"], 2)
        self.assertEqual(a["pairwise"], {"comparisons": 3, "wins": 1, "ties": 1, "losses": 1, "rate": 0.5})
        self.assertEqual(result["b"]["noDeck"], 1)
        self.assertEqual(result["b"]["rating"]["n"], 1)
        self.assertEqual(result["all"]["comparisons"], 3, "skipped comparisons are not counted")
        self.assertEqual(result["one"]["sd"], 0)
        self.assertIsNone(result["none"]["mean"])

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
    def test_dev_is_the_development_briefs_and_heldout_is_three_new_ones(self):
        result = run_node('''
import {briefs} from './evals/quality/lib.mjs';
console.log(JSON.stringify({dev:briefs('dev').map(b=>b.id),heldout:briefs('heldout').map(b=>b.id),all:briefs('all').length}));
''')
        dev = sorted(p.stem for p in (QUALITY / "briefs" / "dev").glob("*.md"))
        self.assertEqual(result["dev"], [f"dev/{name}" for name in dev])
        self.assertEqual(result["heldout"], ["heldout/competitive-position", "heldout/investor-pitch", "heldout/steerco-update"])
        self.assertEqual(result["all"], len(dev) + 3)

    def test_heldout_briefs_are_written_like_the_dev_briefs(self):
        heldout = QUALITY / "briefs" / "heldout"
        # The fields a development brief sets out, every one of them, and a note
        # the harness keeps back from the agent.
        field = re.compile(r"^- \*\*([A-Z][\w ]+)\.\*\*", re.M)
        dev = [set(field.findall(p.read_text())) for p in sorted((QUALITY / "briefs" / "dev").glob("*.md"))]
        shared = set.intersection(*dev)
        self.assertTrue(shared)
        briefs = [p for p in sorted(heldout.glob("*.md")) if p.name != "README.md"]
        self.assertTrue(briefs)
        split = run_node(f"""
import fs from 'node:fs';
import {{briefRequest}} from './evals/quality/lib.mjs';
console.log(JSON.stringify({json.dumps([str(p) for p in briefs])}.map((f) => {{ const t = fs.readFileSync(f, 'utf8'); return t.length - briefRequest(t).trim().length; }})));
""")
        for brief, note in zip(briefs, split):
            with self.subTest(brief=brief.name):
                self.assertLessEqual(shared, set(field.findall(brief.read_text())))
                self.assertGreater(note, 1, "no note for the harness to keep back")

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
