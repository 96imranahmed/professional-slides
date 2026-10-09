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
        ("column-reads", {"header": "Current edge", "cells": ["Northfield", "Harbour", "No verdict"]}, {"headers": ["Criterion", "Current edge", "Reason"]}),
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
const { packets: [{ folder, packet }] } = await J.stageJudgements(dir, [...open.pending.values()]);
const [tiles, title] = packet.items;
const answer = async (judgements, batch = packet.batch) => { await fs.writeFile(path.join(folder, 'answer.json'), JSON.stringify({ batch, judgements })); return J.recordAnswers(dir, 'deck'); };
const good = [{ key: title.key, verdict: 'gap', reason: 'The title leads with what cannot be ranked.', quote: 'cannot be ranked' },
  { key: tiles.key, verdict: 'one-measure', reason: 'Both tiles are six-month retention at two dates.', pair: ['t1', 't2'] }];
const prompt = await fs.readFile(path.join(folder, 'prompt.md'), 'utf8');
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
const packetLeft = await fs.access(folder).then(() => true, () => false);
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ refused: Object.fromEntries(Object.entries(refused).map(([k, v]) => [k, [v.recorded, v.problems.join(' | '), v.refused.length]])), storedBefore: stored,
  recorded: recorded.recorded, read: read?.verdict, quote: read?.quote, edited, pendingAfter: replay.pending.size, packetLeft, name: path.basename(folder),
  where: packet.items.map((item) => item.where), prompt: ['## title-leads-with-gap', '## tiles-one-measure', `"batch": "${packet.batch}"`, 'copied exactly'].map((said) => prompt.includes(said)) }));
""")
        for name, needle in (("unknown", 'verdict "maybe" is none of "gap", "finding"'), ("misquoted", "quotes the words of the subject"),
                             ("stranger", 'names "t9"'), ("missing", "not answered"), ("twice", "answered twice"), ("stale", "the packet is")):
            with self.subTest(refusal=name):
                recorded, problems, refused = result["refused"][name]
                self.assertEqual((recorded, refused), (0, 1))
                self.assertIn("packet-01: ", problems)
                self.assertIn(needle, problems)
        self.assertIsNone(result["storedBefore"], "nothing is recorded from an answer with a problem")
        self.assertEqual(result["recorded"], 2)
        self.assertEqual([result["read"], result["quote"]], ["gap", "cannot be ranked"])
        self.assertIsNone(result["edited"], "a title edited since is asked again")
        self.assertEqual(result["pendingAfter"], 1)
        self.assertFalse(result["packetLeft"], "a recorded packet's folder is removed")
        self.assertEqual(result["name"], "packet-01")
        self.assertEqual(result["where"], [["p7"], ["p3"]])
        self.assertEqual(result["prompt"], [True] * 4)

    def test_a_pair_of_ids_and_a_value_for_each_cell_are_checked_against_the_subject(self):
        result = run_node(CORE + """
const claims = [{ id: 'p1', claim: 'Northfield leads on reach' }, { id: 'p2', claim: 'Reach puts Northfield first' }];
const column = { header: 'Status', cells: ['On track', 'At risk'] };
const items = [{ key: 'k1', kind: 'claims-repeat', subject: claims }, { key: 'k2', kind: 'column-reads', subject: column, context: { headers: ['Workstream', 'Status'] } }];
const reason = 'A reason given in a sentence.';
const problems = (item, answer) => J.answerProblems(item, { reason, ...answer });
const schema = J.answerSchema(items).properties.judgements.items.properties;
console.log(JSON.stringify({
  pair: problems(items[0], { verdict: 'repeats', pairs: [['p1', 'p2']] }),
  same: problems(items[0], { verdict: 'repeats', pairs: [['p1', 'p1']] }),
  stranger: problems(items[0], { verdict: 'repeats', pairs: [['p1', 'p9']] }),
  states: problems(items[1], { verdict: 'status', states: [{ cell: 'On track', value: 'positive' }, { cell: 'at risk', value: 'negative' }] }),
  unknownCell: problems(items[1], { verdict: 'status', states: [{ cell: 'Late', value: 'negative' }] }),
  unknownValue: problems(items[1], { verdict: 'status', states: [{ cell: 'On track', value: 'green' }] }),
  facts: problems(items[1], { verdict: 'facts' }),
  schema: { pairs: schema.pairs.items, states: schema.states.items.properties.value.enum },
}));
""")
        self.assertEqual(result["pair"], [])
        self.assertIn("two different ids of the subject", " ".join(result["same"]))
        self.assertIn("two different ids of the subject", " ".join(result["stranger"]))
        self.assertEqual(result["states"], [], "a cell is named in its words, read without case")
        self.assertIn('names the cell "Late"', " ".join(result["unknownCell"]))
        self.assertIn('the value "green"', " ".join(result["unknownValue"]))
        self.assertEqual(result["facts"], [])
        self.assertEqual(result["schema"], {"pairs": {"type": "array", "items": {"type": "string"}}, "states": ["positive", "caution", "negative", "neutral"]})

    def test_every_question_is_staged_at_once_and_each_packet_stands_on_its_own(self):
        result = run_node(CORE + """
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'judgements-'));
const ask = (n, from = 0) => Array.from({ length: n }, (_, i) => { const subject = `The fleet is ${i + from} aircraft`; return { key: J.judgementKey('title-count-only', subject), kind: 'title-count-only', subject }; });
const first = await J.stageJudgements(dir, ask(130));
const sizes = first.packets.map(({ packet }) => packet.items.length), names = first.packets.map(({ folder }) => path.basename(folder));
// One packet answered, one answered wrongly, one not yet: the right one is recorded alone, the wrong one stays with its answer.
const answer = async ({ folder, packet }, verdict) => fs.writeFile(path.join(folder, 'answer.json'), JSON.stringify({ batch: packet.batch,
  judgements: packet.items.map((item) => ({ key: item.key, verdict, reason: 'The title says how many and nothing more.', quote: verdict === 'count-only' ? item.subject : null })) }));
await answer(first.packets[0], 'count-only');
await answer(first.packets[1], 'maybe');
const recorded = await J.recordAnswers(dir, 'deck');
const batches = Object.fromEntries((await J.stagedPackets(dir)).map(({ folder, packet }) => [path.basename(folder), packet.batch]));
const left = (await J.stagedPackets(dir)).map(({ folder, answered }) => [path.basename(folder), answered]);
// Staged again over what is still open, plus ten new questions: the waiting packets keep their folders and batches, the new go after them.
const replay = await J.loadJudgements(dir, 'deck');
const again = await J.stageJudgements(dir, [...ask(130).filter((q) => !replay.verdicts.has(q.key)), ...ask(10, 500)]);
const kept = again.packets.filter(({ folder, packet }) => batches[path.basename(folder)] === packet.batch).map(({ folder }) => path.basename(folder));
// One question of a waiting packet answered elsewhere: that packet is no longer the open questions, and is staged afresh.
const fewer = await J.stageJudgements(dir, [...ask(130).filter((q) => !replay.verdicts.has(q.key)).slice(1), ...ask(10, 500)]);
const emptied = await J.stageJudgements(dir, []);
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ sizes, names, recorded: [recorded.recorded, recorded.refused.map((f) => path.basename(f)), recorded.waiting, recorded.problems.length > 0], left,
  again: again.packets.map(({ folder, packet }) => [path.basename(folder), packet.items.length]), fresh: again.fresh, kept,
  fewer: fewer.packets.map(({ folder, packet }) => [path.basename(folder), packet.items.length]), emptied: emptied.packets.length }));
""")
        self.assertEqual(result["sizes"], [44, 44, 42], "as few packets as hold them, of even sizes")
        self.assertEqual(result["names"], ["packet-01", "packet-02", "packet-03"])
        self.assertEqual(result["recorded"], [44, ["packet-02"], 1, True])
        self.assertEqual(result["left"], [["packet-02", True], ["packet-03", False]])
        self.assertEqual(result["again"], [["packet-02", 44], ["packet-03", 42], ["packet-04", 10]])
        self.assertEqual(result["fresh"], 1)
        self.assertEqual(result["kept"], ["packet-02", "packet-03"], "a packet a reader may be answering keeps its folder and its batch")
        self.assertEqual(result["fewer"], [["packet-03", 42], ["packet-04", 10], ["packet-05", 43]])
        self.assertEqual(result["emptied"], 0, "with nothing open, nothing stays staged")


@unittest.skipUnless(NODE, "Node.js is not available")
class DeckQuestionTests(unittest.TestCase):
    def test_a_question_about_the_whole_deck_waits_until_every_page_compiles(self):
        # A validation run asked "does a page contradict the answer?" over the 43 pages that compiled, and again over all 49
        # once the rest did: a question over part of the deck is asked twice.
        result = run_node(CORE + """
import { runContentGates } from './skills/professional-slides/runtime/gates/content_gates.mjs';
const content = { schema: 'professional-slides.content/v1', question: 'How should Northvale grow its journeys?', answer: 'Add off-peak frequency first and reform fares last.',
  pages: [{ id: 'p1', n: 1, claim: 'Off-peak frequency wins back lapsed riders first', settles: { kind: 'comparison', what: 'survey' }, adds: 'x', highlight: 'x' },
          { id: 'p2', n: 2, claim: 'Northvale should reform fares first, before adding trains', settles: { kind: 'comparison', what: 'model' }, adds: 'x', highlight: 'x' }] };
const asked = (options) => { const session = J.judgementSession(); J.withJudgements(session, () => runContentGates(content, options)); return [...session.pending.values()].filter((q) => q.kind === 'answer-contradicted').length; };
console.log(JSON.stringify({ whole: asked({}), partial: asked({ uncomposed: new Set(['p3']) }) }));
""")
        self.assertEqual(result, {"whole": 1, "partial": 0})


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


# A stand-in for the `claude` CLI judge.mjs --run calls: it reads the packet's prompt from stdin, answers every question with
# its kind's passing verdict (quoting the subject where that verdict is quoted), and logs where and when it ran. Its first
# answer is refused on purpose (a verdict no kind has), so the packet it was for must be asked again.
FAKE_CLAUDE = r"""#!/usr/bin/env node
const fs = require('node:fs');
const prompt = fs.readFileSync(0, 'utf8');
const passing = JSON.parse(fs.readFileSync(process.env.FAKE_PASSING, 'utf8'));
const first = !fs.existsSync(process.env.FAKE_LOG);
const words = (v) => (typeof v === 'string' ? (v.trim() ? [v] : []) : Array.isArray(v) ? v.flatMap(words) : v && typeof v === 'object' ? Object.values(v).flatMap(words) : []);
const judgements = []; let kind = null, key = null;
for (const line of prompt.split('\n')) {
  if (line.startsWith('## ') && line !== '## Answer') kind = line.slice(3).trim();
  else if (line.startsWith('### ')) key = line.slice(4).trim();
  else if (line.startsWith('Subject: {') || line.startsWith('Subject: [') || line.startsWith('Subject: "')) {
    if (!key) continue;
    const [verdict, quoted] = passing[kind];
    judgements.push({ key, verdict: first ? 'maybe' : verdict, reason: 'The stand-in reader answers each question so its rule passes.', quote: quoted ? words(JSON.parse(line.slice(9)))[0] : null });
    key = null;
  }
}
const batch = /"batch": "([0-9a-f]+)"/.exec(prompt)[1];
const start = Date.now();
while (Date.now() - start < 400) {}
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ start, end: Date.now(), cwd: fs.readdirSync('.').sort() }) + '\n');
process.stdout.write(JSON.stringify({ type: 'result', result: JSON.stringify({ batch, judgements }) }));
"""


@unittest.skipUnless(NODE, "Node.js is not available")
class JudgeCommandTests(unittest.TestCase):
    def deck(self, tmp):
        pages = Path(tmp, "example.pages.json")
        shutil.copy(EXAMPLE, pages)
        shutil.copytree(EXAMPLE.parent / "assets", Path(tmp, "assets"))
        return pages

    def test_the_compile_lists_what_it_asked_and_judge_records_every_packet_answered_side_by_side(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = self.deck(tmp)
            check = lambda: subprocess.run([NODE, str(AUTHOR), str(pages), "--check"], capture_output=True, text=True, timeout=600)
            before = check()
            staged = subprocess.run([NODE, str(JUDGE), str(pages)], capture_output=True, text=True, timeout=600)
            folders = sorted(p.name for p in Path(tmp, "judgements").glob("packet-*"))
            packets, done = answer_everything(NODE, pages)
            after = check()
            store = json.loads(Path(tmp, f"{json.loads(pages.read_text())['deck']['id']}.judgements.json").read_text())
            left = Path(tmp, "judgements").exists()
        self.assertIn("JUDGEMENTS_PENDING", before.stdout + before.stderr)
        self.assertEqual(staged.returncode, 3, staged.stderr)
        self.assertGreaterEqual(len(folders), 2, "every open question is staged at once, in as many packets as it takes")
        self.assertIn("side by side", staged.stderr)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertNotIn("JUDGEMENTS_PENDING", after.stdout + after.stderr)
        self.assertEqual(after.returncode, 0, after.stderr[-1500:])  # every answer the passing one: the deck holds as before
        self.assertEqual(len(store["verdicts"]), len({item["key"] for p in packets for item in p["items"]}))
        self.assertTrue(all(len(p["items"]) <= 60 for p in packets))
        self.assertIn("title-leads-with-gap", {item["kind"] for p in packets for item in p["items"]})
        self.assertFalse(left, "with every question answered, nothing is left staged")

    def test_run_asks_about_every_packet_at_once_each_in_a_clean_folder_and_asks_again_after_a_refusal(self):
        from judgement_oracle import PASSING
        with tempfile.TemporaryDirectory() as tmp:
            pages = self.deck(tmp)
            bin_dir = Path(tmp, "bin")
            bin_dir.mkdir()
            fake = bin_dir / "claude"
            fake.write_text(FAKE_CLAUDE)
            fake.chmod(0o755)
            log, table = Path(tmp, "calls.jsonl"), Path(tmp, "passing.json")
            table.write_text(json.dumps({kind: [verdict, verdict in (KINDS[kind].get("quoteFor") or [])] for kind, verdict in PASSING.items()}))
            env = {**os.environ, "PATH": f"{bin_dir}{os.pathsep}{Path(NODE).parent}{os.pathsep}{os.environ.get('PATH', '')}", "FAKE_LOG": str(log), "FAKE_PASSING": str(table)}
            done = subprocess.run([NODE, str(JUDGE), str(pages), "--run", "claude", "--parallel", "3"], capture_output=True, text=True, env=env, timeout=900)
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            store = json.loads(Path(tmp, f"{json.loads(pages.read_text())['deck']['id']}.judgements.json").read_text())
        self.assertEqual(done.returncode, 0, done.stderr[-2000:])
        self.assertIn("Answers refused, asked again", done.stderr)
        # Packets ran side by side: some call started before another had ended.
        overlapping = any(a is not b and a["start"] < b["end"] and b["start"] < a["end"] for a in calls for b in calls)
        self.assertTrue(overlapping, calls)
        # Each in a folder holding its packet's prompt and schema alone.
        self.assertTrue(all(call["cwd"] == ["prompt.md", "schema.json"] for call in calls), calls)
        self.assertTrue(store["verdicts"])
        self.assertTrue(all(v.get("by", {}).get("backend") == "claude" for v in store["verdicts"].values()))


@unittest.skipUnless(NODE, "Node.js is not available")
class BackendDownTests(unittest.TestCase):
    def test_a_backend_that_answers_nothing_is_said_in_its_own_words_and_not_asked_again(self):
        # The first real `--run claude` met a CLI that was not logged in: it exited 1 every round, its reason was hidden behind
        # "exited 1", and the deck was compiled six times for nothing.
        with tempfile.TemporaryDirectory() as tmp:
            pages = Path(tmp, "example.pages.json")
            shutil.copy(EXAMPLE, pages)
            shutil.copytree(EXAMPLE.parent / "assets", Path(tmp, "assets"))
            bin_dir = Path(tmp, "bin")
            bin_dir.mkdir()
            fake = bin_dir / "claude"
            fake.write_text('#!/bin/sh\ncat >/dev/null\necho \'{"type":"result","is_error":true,"result":"Not logged in \u00b7 Please run /login"}\'\nexit 1\n')
            fake.chmod(0o755)
            env = {**os.environ, "PATH": f"{bin_dir}{os.pathsep}{Path(NODE).parent}{os.pathsep}{os.environ.get('PATH', '')}"}
            done = subprocess.run([NODE, str(JUDGE), str(pages), "--run", "claude"], capture_output=True, text=True, env=env, timeout=600)
            staged = sorted(p.name for p in Path(tmp, "judgements").glob("packet-*"))
        self.assertEqual(done.returncode, 3, done.stderr[-1500:])
        self.assertIn("Not logged in", done.stderr)
        self.assertEqual(done.stderr.count("Round "), 1, "asked once, not round after round")
        self.assertTrue(staged, "the packets stay staged for readers")


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
