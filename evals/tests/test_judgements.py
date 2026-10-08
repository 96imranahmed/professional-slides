"""Judgements: what a rule needs read, asked of a model once and replayed.

A rule that turns on what copy means - whether a column judges its rows, a
title leads with a gap, a candidate photograph shows its subject - used to
match the copy against a list of words, and each list was a guess the next
deck's wording slipped past. It now asks a question of a kind
(runtime/judgement-kinds.json), and holds only where the deck's recorded answer
says the defect is there. These tests hold the machinery: one key for one
question in JavaScript and Python alike, an answer recorded only when it
answers every question it was staged for with a verdict of its kind and words
of its subject, an open question listed and never held, and delivery refused
while any is open.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node
from judgement_oracle import answer_everything, judgements
from test_review_delivery import FIXTURES as DELIVERY

JUDGE = RUNTIME / "judge.mjs"
AUTHOR = RUNTIME / "author-deck.mjs"
EXAMPLE = ROOT / "skills" / "professional-slides" / "examples" / "page-types.pages.json"
KINDS = json.loads((RUNTIME / "judgement-kinds.json").read_text(encoding="utf-8"))["kinds"]

CORE = """
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as J from './skills/professional-slides/runtime/judgements.mjs';
"""


class KindTests(unittest.TestCase):
    def test_every_kind_is_asked_and_every_question_asked_is_of_a_kind(self):
        import re
        asked = set()
        for path in list(RUNTIME.rglob("*.mjs")) + list((RUNTIME / "gates").glob("*.py")):
            asked |= set(re.findall(r"(?:judged|recordedJudgement)\(\s*[\"']([a-z-]+)[\"']", path.read_text(encoding="utf-8")))
        self.assertEqual(asked, set(KINDS))
        for kind, spec in KINDS.items():
            with self.subTest(kind=kind):
                self.assertTrue(spec["asks"].endswith("?") or "?" in spec["asks"], "a kind asks a question")
                self.assertGreaterEqual(len(spec["verdicts"]), 2)
                self.assertLessEqual(set(spec.get("quoteFor") or []), set(spec["verdicts"]))
                for field in (spec.get("fields") or {}).values():
                    self.assertLessEqual(set(field.get("for") or []), set(spec["verdicts"]))


@unittest.skipUnless(NODE, "Node.js is not available")
class KeyTests(unittest.TestCase):
    SUBJECTS = [
        ("column-judges", {"header": "Current edge", "cells": ["OpenAI", "Anthropic", "No verdict"]}, {"headers": ["Criterion", "Current edge", "Reason"]}),
        ("title-leads-with-gap", "Leadership cannot be ranked without matched retention", None),
        ("commentary-caveats", [{"id": "l1", "text": "Café revenue rose 12% – a record"}, {"id": "l2", "text": "“Quoted” and naïve"}], None),
        ("tiles-one-measure", [{"id": "t1", "value": "25.8%", "label": "Jan 2025 cohort"}, {"id": "t2", "value": "45%", "label": "Feb 2026 cohort"}], None),
        ("shares-in-words", {"n": 3, "whole": 4.0, "nested": {"b": [1, None, True], "a": "x"}}, {"z": 1, "a": 2}),
    ]

    def test_javascript_and_python_hash_a_question_the_same_way(self):
        result = run_node(CORE + f"""
const subjects = {json.dumps(self.SUBJECTS, ensure_ascii=False)};
console.log(JSON.stringify(subjects.map(([kind, subject, context]) => J.judgementKey(kind, subject, context))));
""")
        python = [judgements.judgement_key(kind, subject, context) for kind, subject, context in self.SUBJECTS]
        self.assertEqual(result, python)
        self.assertEqual(len(set(python)), len(python))

    def test_a_question_reworded_is_asked_again(self):
        # The key carries the kind's version: raising it re-asks every subject of the kind.
        kind, subject, context = self.SUBJECTS[1]
        before = judgements.judgement_key(kind, subject, context)
        KINDS_BEFORE = judgements.KINDS[kind]["version"]
        judgements.KINDS[kind]["version"] = KINDS_BEFORE + 1
        try:
            self.assertNotEqual(judgements.judgement_key(kind, subject, context), before)
        finally:
            judgements.KINDS[kind]["version"] = KINDS_BEFORE


@unittest.skipUnless(NODE, "Node.js is not available")
class AnswerTests(unittest.TestCase):
    def test_an_answer_is_recorded_only_whole_with_verdicts_of_its_kind_and_words_of_its_subject(self):
        result = run_node(CORE + """
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'judgements-'));
const open = J.judgementSession();
J.withJudgements(open, () => {
  J.judged('title-leads-with-gap', 'Leadership cannot be ranked on public evidence', null, 'p3');
  J.judged('tiles-one-measure', [{ id: 't1', value: '25.8%', label: 'Jan 2025 cohort retained' }, { id: 't2', value: '45%', label: 'Feb 2026 cohort retained' }], null, 'p7');
});
const { packet } = await J.stageJudgements(dir, [...open.pending.values()]);
const [tiles, title] = packet.items;
const answer = async (judgements, batch = packet.batch) => { await fs.writeFile(path.join(dir, 'judgements', 'answer.json'), JSON.stringify({ batch, judgements })); return J.recordAnswer(dir, 'deck'); };
const good = [{ key: title.key, verdict: 'gap', reason: 'The title leads with what cannot be ranked.', quote: 'cannot be ranked' },
  { key: tiles.key, verdict: 'one-measure', reason: 'Both tiles are six-month retention at two dates.', pair: ['t1', 't2'] }];
const refused = {
  unknown: await answer([{ ...good[0], verdict: 'maybe' }, good[1]]),
  misquoted: await answer([{ ...good[0], quote: 'cannot rank them' }, good[1]]),
  stranger: await answer([good[0], { ...good[1], pair: ['t1', 't9'] }]),
  missing: await answer([good[0]]),
  twice: await answer([good[0], good[0], good[1]]),
  stale: await answer(good, 'another-batch'),
};
const stored = await fs.readFile(J.judgementStorePath(dir, 'deck'), 'utf8').catch(() => null);
const recorded = await answer(good);
const replay = await J.loadJudgements(dir, 'deck');
const read = J.withJudgements(replay, () => J.judged('title-leads-with-gap', 'Leadership cannot be ranked on public evidence'));
const edited = J.withJudgements(replay, () => J.judged('title-leads-with-gap', 'Leadership cannot yet be ranked on public evidence'));
const packetLeft = await fs.access(path.join(dir, 'judgements', 'packet.json')).then(() => true, () => false);
const prompt = await fs.readFile(path.join(dir, 'judgements', 'prompt.md'), 'utf8');
const big = await J.stageJudgements(dir, Array.from({ length: 70 }, (_, i) => ({ key: `k${String(i).padStart(2, '0')}`, kind: 'title-count-only', subject: `The fleet is ${i} aircraft` })));
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ refused: Object.fromEntries(Object.entries(refused).map(([k, v]) => [k, [v.recorded, v.problems.join(' | ')]])), storedBefore: stored,
  recorded: recorded.recorded, read: read?.verdict, quote: read?.quote, edited, pendingAfter: replay.pending.size, packetLeft,
  where: packet.items.map((item) => item.where), prompt: ['## title-leads-with-gap', '## tiles-one-measure', `"batch": "${packet.batch}"`, 'copied exactly'].map((said) => prompt.includes(said)),
  big: [big.packet.items.length, big.left] }));
""")
        for name, needle in (("unknown", 'verdict "maybe" is none of "gap", "finding"'), ("misquoted", "quotes the words of the subject"),
                             ("stranger", 'names "t9"'), ("missing", "not answered"), ("twice", "answered twice"), ("stale", "the staged packet is")):
            with self.subTest(refusal=name):
                recorded, problems = result["refused"][name]
                self.assertEqual(recorded, 0)
                self.assertIn(needle, problems)
        self.assertIsNone(result["storedBefore"], "nothing is recorded from an answer with a problem")
        self.assertEqual(result["recorded"], 2)
        self.assertEqual([result["read"], result["quote"]], ["gap", "cannot be ranked"])
        self.assertIsNone(result["edited"], "a title edited since is asked again")
        self.assertEqual(result["pendingAfter"], 1)
        self.assertFalse(result["packetLeft"])
        self.assertEqual(result["where"], [["p7"], ["p3"]])
        self.assertEqual(result["prompt"], [True] * 4)
        self.assertEqual(result["big"], [60, 10])


@unittest.skipUnless(NODE, "Node.js is not available")
class PythonGateTests(unittest.TestCase):
    def test_the_page_gates_read_the_store_and_report_what_they_could_not(self):
        # A scene whose one line opens on a label: asked once with no answer, then held once the answer is in the store.
        scene = {"slides": [{"id": "p1", "readingTask": "chart-with-commentary", "nodes": [
            {"type": "text", "role": "action-title", "text": "Peak trains run full while the off-peak runs half empty"},
            {"type": "text", "role": "list-item", "text": "Takeaway: off-peak journeys grew where trains ran half-hourly."}]}]}
        with tempfile.TemporaryDirectory() as tmp:
            scene_path, report, store = Path(tmp, "scene.json"), Path(tmp, "report.json"), Path(tmp, "deck.judgements.json")
            scene_path.write_text(json.dumps(scene))
            gates = [sys.executable, str(RUNTIME / "gates" / "page_gates.py"), str(scene_path), "--only", "PLANNING_VOICE", "--report", str(report), "--judgements", str(store)]
            subprocess.run(gates, capture_output=True, text=True)
            first = json.loads(report.read_text())
            [asked] = first["judgementsNeeded"]
            key = judgements.judgement_key(asked["kind"], asked["subject"], asked["context"])
            store.write_text(json.dumps({"verdicts": {key: {"verdict": "planning-label", "quote": "Takeaway"}}}))
            subprocess.run(gates, capture_output=True, text=True)
            second = json.loads(report.read_text())
        self.assertEqual([f["code"] for f in first["findings"]], [])
        self.assertEqual((asked["kind"], asked["where"]), ("planning-label", ["1"]))
        self.assertEqual([f["code"] for f in second["findings"]], ["PLANNING_VOICE"])
        self.assertEqual(second["judgementsNeeded"], [])


@unittest.skipUnless(NODE, "Node.js is not available")
class JudgeCommandTests(unittest.TestCase):
    def test_the_compile_lists_what_it_asked_and_judge_records_the_answers_until_none_is_open(self):
        env = {**os.environ}
        with tempfile.TemporaryDirectory() as tmp:
            pages = Path(tmp, "example.pages.json")
            shutil.copy(EXAMPLE, pages)
            shutil.copytree(EXAMPLE.parent / "assets", Path(tmp, "assets"))
            check = lambda: subprocess.run([NODE, str(AUTHOR), str(pages), "--check"], capture_output=True, text=True, env=env, timeout=600)
            before = check()
            packets, staged = answer_everything(NODE, pages)
            after = check()
            store = json.loads(Path(tmp, f"{json.loads(pages.read_text())['deck']['id']}.judgements.json").read_text())
        self.assertIn("JUDGEMENTS_PENDING", before.stdout + before.stderr)
        self.assertTrue(packets, staged.stderr)
        self.assertEqual(staged.returncode, 0, staged.stderr)
        self.assertNotIn("JUDGEMENTS_PENDING", after.stdout + after.stderr)
        self.assertEqual(after.returncode, 0, after.stderr[-1500:])  # every answer the passing one: the deck holds as before
        self.assertEqual(len(store["verdicts"]), sum(len(p["items"]) for p in packets))
        self.assertTrue(all(len(p["items"]) <= 60 for p in packets))
        self.assertIn("title-leads-with-gap", {item["kind"] for p in packets for item in p["items"]})


@unittest.skipUnless(NODE, "Node.js is not available")
class DeliveryTests(unittest.TestCase):
    def test_a_deck_with_questions_open_is_not_delivered(self):
        result = run_node(DELIVERY + """
const compiled = await prebuilt({ deck: { judgements: { pending: 3, kinds: { 'title-leads-with-gap': 3 } } } });
const atCompile = await deliver(compiled, { reviewer: 'packet' });
await done(compiled);
const built = await prebuilt();
const build = JSON.parse(await fs.readFile(path.join(built.out, 'build-result.json'), 'utf8'));
await fs.writeFile(path.join(built.out, 'build-result.json'), JSON.stringify({ ...build, judgements: { pending: 2, kinds: { 'planning-label': 2 } } }));
const atBuild = await deliver(built, { reviewer: 'packet' });
const note = await fs.readFile(path.join(built.out, 'REJECTED.md'), 'utf8');
await done(built);
console.log(JSON.stringify({ compile: [atCompile.accepted, atCompile.rejectedAt, atCompile.blockers.map((b) => b.code), atCompile.blockers[0].reason],
  build: [atBuild.rejectedAt, atBuild.blockers[0].reason], note: note.includes('judge.mjs') }));
""")
        self.assertEqual(result["compile"][:3], [False, "judgements", ["JUDGEMENTS_OPEN"]])
        self.assertIn("3 at the compile", result["compile"][3])
        self.assertEqual(result["build"][0], "judgements")
        self.assertIn("2 at the build", result["build"][1])
        self.assertTrue(result["note"])


@unittest.skipUnless(NODE, "Node.js is not available")
class StorylineTests(unittest.TestCase):
    def test_the_critique_waits_for_the_spines_questions_and_only_for_them(self):
        result = run_node(DELIVERY + """
const titled = await prebuilt({ deck: { judgements: { pending: 2, kinds: { 'title-leads-with-gap': 2 } } } });
const spine = await S.prepareStoryline(titled.specPath, titled.out);
await done(titled);
const copy = await prebuilt({ deck: { judgements: { pending: 4, kinds: { 'commentary-caveats': 4 } } } });
const body = await S.prepareStoryline(copy.specPath, copy.out);
await done(copy);
console.log(JSON.stringify({ spine: [spine.status, (spine.errors || []).join(' ')], body: body.status }));
""")
        self.assertEqual(result["spine"][0], "refused")
        self.assertIn("judge.mjs <id>.pages.json --draft", result["spine"][1])
        self.assertNotEqual(result["body"], "refused")


if __name__ == "__main__":
    unittest.main()
