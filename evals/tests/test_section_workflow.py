"""The runtime support for writing, critiquing and judging a deck section by section.

The BA deck was built by one agent writing all 106 pages, one critic reading
the whole spine each pass, and six copy writers each reading 540k characters of
reference docs and grepping the insight logs. Split by section - a part file,
pages/<part>.pages.json - each step can run beside the others, and each
subagent needs only its share of the context. These tests hold the three
commands that make that possible:

- `judge.mjs --page` stages only the named pages' questions, in a folder of the
  section's own, so sections judged side by side never restage each other's
  packets, and a later plain run still records and keeps them all;
- `author-deck.mjs --brief <role> [--section <part>]` prints the pack a
  section's subagent reads instead of the references and the insight log;
- `storyline.mjs --split` stages the page-level critique by section at any
  length, through the split the long-spine critique already merges and records.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

AUTHOR = RUNTIME / "author-deck.mjs"
JUDGE = RUNTIME / "judge.mjs"
STORYLINE = RUNTIME / "storyline.mjs"
EXAMPLE = ROOT / "skills" / "professional-slides" / "examples" / "page-types.pages.json"
EVIDENCE = ROOT / "evals" / "quality" / "fixtures" / "evidence"


@unittest.skipUnless(NODE, "Node.js is not available")
class PageScopedJudgingTests(unittest.TestCase):
    def test_a_page_run_stages_in_its_own_folder_and_leaves_every_other_runs_packets(self):
        # Two sections staged one after the other used to share judgements/packet-NN: the second run read the first's packet
        # as questions no longer open and removed it while its reader was answering.
        result = run_node("""
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as J from './skills/professional-slides/runtime/judgements.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'judge-scope-'));
const ask = (n, from, where) => Array.from({ length: n }, (_, i) => { const subject = `The fleet is ${i + from} aircraft`; return { key: J.judgementKey('title-count-only', subject), kind: 'title-count-only', subject, where: [where] }; });
const a = ask(3, 0, 'a1'), b = [...ask(2, 100, 'b1'), a[0]];
const first = await J.stageJudgements(dir, a, { scope: 'part-a' });
const second = await J.stageJudgements(dir, b, { scope: 'part-b' });
const names = async () => (await J.stagedPackets(dir)).map(({ folder, packet }) => [J.packetName(dir, folder), packet.items.length]);
const afterBoth = await names();
// A plain run over every open question keeps both sections' packets and stages only what neither holds.
const plain = await J.stageJudgements(dir, [...a, ...b, ...ask(4, 500, 'c1')]);
const afterPlain = await names();
// Section a's reader answers; any run records it, and the section's folder goes with its last packet.
const [{ folder, packet }] = first.packets;
await fs.writeFile(path.join(folder, 'answer.json'), JSON.stringify({ batch: packet.batch, judgements: packet.items.map((item) => ({ key: item.key, verdict: 'count-only', reason: 'The title says how many and nothing more.', quote: item.subject })) }));
const recorded = await J.recordAnswers(dir, 'deck');
const store = JSON.parse(await fs.readFile(path.join(dir, 'deck.judgements.json'), 'utf8'));
const left = await names(), partA = await fs.access(path.join(dir, 'judgements', 'part-a')).then(() => true, () => false);
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ first: first.packets.map(({ folder }) => J.packetName(dir, folder)), second: second.packets.map(({ packet }) => packet.items.length),
  elsewhere: second.elsewhere.map(({ folder }) => J.packetName(dir, folder)), afterBoth, plainFresh: plain.fresh, afterPlain, recorded: recorded.recorded, stored: Object.keys(store.verdicts).length, left, partA }));
""")
        self.assertEqual(result["first"], ["part-a/packet-01"])
        self.assertEqual(result["second"], [2], "a question section a's packet already holds is not staged twice")
        self.assertEqual(result["elsewhere"], ["part-a/packet-01"])
        self.assertEqual(result["afterBoth"], [["part-a/packet-01", 3], ["part-b/packet-01", 2]], "the second section's run left the first's packet where it was")
        self.assertEqual(result["plainFresh"], 1)
        self.assertEqual(result["afterPlain"], [["packet-01", 4], ["part-a/packet-01", 3], ["part-b/packet-01", 2]])
        self.assertEqual((result["recorded"], result["stored"]), (3, 3))
        self.assertEqual(result["left"], [["packet-01", 4], ["part-b/packet-01", 2]])
        self.assertFalse(result["partA"], "a section's folder goes with its last packet")

    def test_judge_page_stages_only_the_questions_asked_of_the_named_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = Path(tmp, "example.pages.json")
            shutil.copy(EXAMPLE, pages)
            shutil.copytree(EXAMPLE.parent / "assets", Path(tmp, "assets"))
            run = subprocess.run([NODE, str(JUDGE), str(pages), "--page", "p03,p04"], capture_output=True, text=True, timeout=600)
            folders = sorted(str(p.relative_to(Path(tmp, "judgements"))) for p in Path(tmp, "judgements").glob("*/packet-*"))
            items = [item for f in Path(tmp, "judgements").glob("*/packet-*/packet.json") for item in json.loads(f.read_text())["items"]]
            plain = sorted(p.name for p in Path(tmp, "judgements").glob("packet-*"))
            stranger = subprocess.run([NODE, str(JUDGE), str(pages), "--page", "p03,nope"], capture_output=True, text=True, timeout=60)
        self.assertEqual(run.returncode, 3, run.stderr)
        self.assertIn("of pages p03, p04", run.stderr)
        self.assertEqual(len(folders), 1, folders)
        self.assertTrue(folders[0].startswith("pages-"), folders)  # the example is one file, so its pages name the folder
        self.assertEqual(plain, [], "nothing is staged where a plain run stages")
        self.assertTrue(items and all({"p03", "p04"} & set(item["where"]) for item in items), items)
        self.assertEqual(stranger.returncode, 1)
        self.assertIn('No page "nope"', stranger.stderr)


def sectioned_finance(tmp):
    """The finance fixture deck written in two parts beside its root page, as a deck authored by section is."""
    for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
        shutil.copy(EVIDENCE / name, Path(tmp, name))
    doc = json.loads(Path(tmp, "finance.pages.json").read_text())
    by_id = {page["id"]: page for page in doc["pages"]}
    Path(tmp, "pages").mkdir()
    Path(tmp, "pages", "a.pages.json").write_text(json.dumps({"pages": [by_id["f1"], by_id["f2"]]}))
    Path(tmp, "pages", "b.pages.json").write_text(json.dumps({"pages": [by_id[i] for i in ("f3", "f4", "f5", "f6")]}))
    doc["pages"] = [by_id["f0"], {"include": "pages/a.pages.json"}, {"include": "pages/b.pages.json"}]
    Path(tmp, "finance.pages.json").write_text(json.dumps(doc))
    return Path(tmp, "finance.pages.json")


@unittest.skipUnless(NODE, "Node.js is not available")
class BriefTests(unittest.TestCase):
    def brief(self, pages, *args):
        return subprocess.run([NODE, str(AUTHOR), str(pages), *args], capture_output=True, text=True, timeout=120)

    def test_a_writers_brief_holds_its_sections_pages_limits_tokens_and_commands(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned_finance(tmp)
            writer = self.brief(pages, "--brief", "writer", "--section", "a")
            by_path = self.brief(pages, "--brief", "writer", "--section", "pages/a.pages.json")
            loans = json.loads(Path(tmp, "finance.insights.json").read_text())
        self.assertEqual(writer.returncode, 0, writer.stderr)
        self.assertEqual(writer.stdout, by_path.stdout, "a section is named by its part file or by its name")
        out = writer.stdout
        self.assertIn("# writer brief: section a (pages/a.pages.json), 2 pages", out)
        self.assertIn("Numbers by reference, never typed", out)  # the role's digest
        self.assertIn("[f1] limits: trend", out)
        self.assertNotIn("[f3]", out)
        # Every value of the evidence's measures with the token that prints it: the writer never opens the log.
        measure = next(i for i in (loans["insights"] if isinstance(loans, dict) else loans) if i["id"] == "i-loans")["measures"]["loans"]
        line = next(l for l in out.splitlines() if l.startswith("- loans "))
        self.assertIn("{{i-loans/loans@<period> | ", line)
        self.assertTrue(all(f"{period} {value}" in line for period, value in zip(measure["periods"], measure["values"])), line)
        self.assertIn("--check --page f1,f2 --json", out)
        self.assertIn("judge.mjs", out)
        self.assertIn("--page f1,f2", out)
        # Each typed page carries the words its text slots hold where the deck sets it, measured as --scaffold --id
        # measures them: the writer writes to them rather than fitting copy a check at a time.
        slots = [json.loads(l.strip()[len("slots: "):]) for l in out.splitlines() if l.strip().startswith("slots: ")]
        self.assertTrue(slots, out)
        self.assertTrue(all("note" not in s and "together" in s for s in slots), slots)

    def test_each_role_gets_its_own_share_and_a_stranger_section_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned_finance(tmp)
            skeleton = self.brief(pages, "--brief", "skeleton", "--section", "b")
            critic = self.brief(pages, "--brief", "critic")
            stranger = self.brief(pages, "--brief", "writer", "--section", "c")
            role = self.brief(pages, "--brief", "editor")
            alone = self.brief(pages, "--check", "--section", "a")
        self.assertEqual(skeleton.returncode, 0, skeleton.stderr)
        self.assertIn("A title states the answer", skeleton.stdout)
        self.assertIn("## Insights your pages rest on", skeleton.stdout)
        shown = skeleton.stdout.split("## Your pages")[1].split("## Insights")[0]
        self.assertNotIn('"exhibit"', shown, "a skeleton is shown the fields the critique reads, not the copy")
        self.assertNotIn('"points"', shown)
        self.assertIn("the whole deck, 7 pages", critic.stdout)
        self.assertIn("--split", critic.stdout)
        self.assertEqual(stranger.returncode, 1)
        self.assertIn("its sections are a, b", stranger.stderr)
        self.assertEqual(role.returncode, 1)
        self.assertIn("--brief is one of skeleton, writer, critic, judge", role.stderr)
        self.assertEqual(alone.returncode, 1)


SPLIT = """
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyline-split-'));
const specPath = path.join(dir, 'fixture.deck.json');
const section = (id, title, n, at) => [{ id, kind: 'section', title }, ...Array.from({ length: n }, (_, i) => ({ id: `q${at + i}`, title: `Title of q${at + i} states one finding` }))];
await fs.writeFile(specPath, JSON.stringify({ id: 'fixture', workflow: 'new_deck', request: 'Who leads in the short run and the long run?', answer: 'The subject leads on both horizons.',
  slides: [...section('d1', 'The short run', 6, 1), ...section('d2', 'The long run', 6, 7)] }));
"""


@unittest.skipUnless(NODE, "Node.js is not available")
class SplitCritiqueTests(unittest.TestCase):
    def test_split_stages_a_short_spine_by_section_and_nothing_else_changes(self):
        # Twelve content pages are well under the 30 at which a full critique splits by itself: --split asks for it.
        result = run_node(SPLIT + """
const plain = await S.buildStorylinePacket(specPath, path.join(dir, 'out'), { mode: 'full' });
const split = await S.buildStorylinePacket(specPath, path.join(dir, 'out'), { mode: 'full', split: true });
// Read before the next packet is staged: staging a packet clears the one before it.
const staged = (await fs.readdir(path.join(split.dir, 'sections'))).sort();
const sectionPrompt = await fs.readFile(path.join(split.dir, 'sections', 's1.md'), 'utf8');
const spine = await S.buildStorylinePacket(specPath, path.join(dir, 'out'), { mode: 'spine', split: true });
for (const d of [plain.dir, split.dir, spine.dir, dir]) await fs.rm(d, { recursive: true, force: true });
console.log(JSON.stringify({ plain: plain.packet.sections, spine: spine.packet.sections, sections: split.packet.sections.map((s) => [s.id, s.title, s.pages]), staged,
  everyTitle: sectionPrompt.includes('Title of q12 states one finding'), answer: sectionPrompt.includes('The subject leads on both horizons.') }));
""")
        self.assertIsNone(result["plain"])
        self.assertIsNone(result["spine"], "the spine critique is one reading, capped at ten items: it does not split")
        self.assertEqual(result["sections"], [["s1", "The short run", [f"q{i}" for i in range(1, 7)]], ["s2", "The long run", [f"q{i}" for i in range(7, 13)]]])
        self.assertEqual(result["staged"], ["s1.md", "s2.md", "spine.md"])
        self.assertTrue(result["everyTitle"] and result["answer"], "a section's critic reads the answer and every title for context")

    def test_the_command_asks_for_the_page_level_critique_and_refuses_split_with_spine(self):
        result = run_node(SPLIT + """
console.log(JSON.stringify({ dir, specPath }));
""")
        try:
            out = str(Path(result["dir"], "out"))
            split = subprocess.run([NODE, str(STORYLINE), result["specPath"], out, "--split"], capture_output=True, text=True, timeout=120)
            spine = subprocess.run([NODE, str(STORYLINE), result["specPath"], out, "--split", "--spine"], capture_output=True, text=True, timeout=60)
        finally:
            shutil.rmtree(result["dir"], ignore_errors=True)
        self.assertEqual(split.returncode, 3, split.stdout + split.stderr)
        step = json.loads(split.stdout)
        shutil.rmtree(step["dir"], ignore_errors=True)
        self.assertEqual((step["status"], step["mode"], step["sections"]), ("packet-written", "full", 2))
        self.assertIn("storyline.mjs merge", step["note"])
        self.assertEqual(spine.returncode, 1)
        self.assertIn("--split stages the page-level critique", spine.stderr)


if __name__ == "__main__":
    unittest.main()
