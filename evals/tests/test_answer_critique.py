"""The answer is read against the insight log before the skeleton is written.

On the BA benchmark the storyline critique's first pass came three quarters of an
hour into the run and raised four blocking or major items - a share compared
with rivals' on a basis the log's own calculation note says differs, a series
across two editions of one survey, "the best returns" where the log records a
rival higher, a recommendation the log's own series undercuts - and every one was
in the log before a page existed, two of them in the answer itself. Raised there,
each took two more critique passes and three rewrite rounds. These tests hold the
earlier reading: a packet that puts the answer beside the log's calculations, a critique
refused until it quotes the answer and names the log, a revise that holds the
storyline until the answer changes, and the items - with the log's own hazards,
the comparisons its records say they cannot support - carried to the skeleton
brief and to the storyline critique's first pass.
"""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"
SCRIPT = RUNTIME / "answer-critique.mjs"
ANSWER = ("Harbour is growing fast but not safely funded: it grows loans second-fastest of eight peers on the thinnest liquidity cover "
          "among them, 4.3 points above the regulatory minimum; its cost-to-income ratio keeps falling but its margin and capital sit "
          "mid-table, so term funding must come before further lending.")


def stage_fixture(tmp):
    for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
        shutil.copy(FIXTURES / name, Path(tmp) / name)
    return Path(tmp) / "finance.pages.json"


def run(*args):
    return subprocess.run([NODE, str(SCRIPT), *map(str, args)], capture_output=True, text=True)


def critique(verdict="revise", items=None):
    items = items if items is not None else [{
        "id": "A1", "check": "scope", "severity": "major", "claim": "the thinnest liquidity cover among them",
        "insights": ["i-peers"], "problem": "Thinnest of the eight that publish liquidity cover, not of every regional lender.",
        "remedy": "narrow", "fix": "the thinnest liquidity cover of the eight peers"}]
    return {"verdict": verdict, "summary": "The log supports the growth and the funding call; one ranking reaches past the set it was read over.", "items": items,
            "hazards": [{"insights": ["i-peers"], "problem": "Capital is ranked only among the peers that publish it.",
                         "rule": "Say 'among those that publish it' wherever capital is ranked."}]}


class PacketTests(unittest.TestCase):
    def test_a_packet_puts_the_answer_beside_each_insights_calculation_and_waits_for_a_critic(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage_fixture(tmp)
            first = run(pages, Path(tmp) / "out")
            self.assertEqual(first.returncode, 3, first.stderr)
            prompt = (Path(tmp) / "out" / "answer-critique" / "prompt.md").read_text(encoding="utf-8")
            self.assertIn(ANSWER, prompt)
            # The calculation notes are what say what a figure is a share of, and whether two figures share a basis.
            for insight in json.loads((FIXTURES / "finance.insights.json").read_text(encoding="utf-8"))["insights"]:
                self.assertIn(f"[{insight['id']}]", prompt)
                self.assertIn(f"calculation: {insight['calculation']}", prompt)
            self.assertIn("COMPUTED ANALYSES", prompt)
            self.assertIn("A-cushion", prompt, "the runtime's analyses are read with the log")
            self.assertIn("--validate", prompt, "the critic checks its answer before handing back")


class ValidationTests(unittest.TestCase):
    def test_a_critique_is_refused_until_it_quotes_the_answer_names_the_log_and_reads_its_verdict_off_its_items(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage_fixture(tmp)
            run(pages, Path(tmp) / "out")
            answer = Path(tmp) / "out" / "answer-critique" / "answer.json"
            bad = critique(verdict="ready", items=[{
                "id": "A1", "check": "basis", "severity": "major", "claim": "Harbour leads every peer on capital",
                "insights": ["i-nowhere"], "problem": "Not in the log.", "remedy": "narrow", "fix": "Drop it."}])
            bad["hazards"] = [{"insights": ["i-elsewhere"], "problem": "Two bases.", "rule": "Do not compare them."}]
            answer.write_text(json.dumps(bad), encoding="utf-8")
            checked = run(pages, Path(tmp) / "out", "--validate", answer)
            self.assertEqual(checked.returncode, 2, checked.stdout)
            errors = "\n".join(json.loads(checked.stdout)["errors"])
            self.assertIn("is not in it", errors, "a quote the answer does not hold cannot be found to narrow")
            self.assertIn("i-nowhere is not in the log", errors)
            self.assertIn("`verdict` is revise", errors)
            self.assertIn("i-elsewhere is not in the log", errors, "a hazard names the records it is read from")
            answer.write_text(json.dumps(critique()), encoding="utf-8")
            checked = run(pages, Path(tmp) / "out", "--validate", answer)
            self.assertEqual(checked.returncode, 0, checked.stdout)


class RecordTests(unittest.TestCase):
    def test_a_revise_holds_the_storyline_until_the_answer_changes_and_its_items_reach_the_first_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage_fixture(tmp)
            out = Path(tmp) / "out"
            run(pages, out)
            (out / "answer-critique" / "answer.json").write_text(json.dumps(critique()), encoding="utf-8")
            recorded = run(pages, out)
            self.assertEqual(recorded.returncode, 2, recorded.stderr)
            record = json.loads((out / "answer-critique.json").read_text(encoding="utf-8"))
            self.assertEqual((record["verdict"], [item["id"] for item in record["items"]]), ("revise", ["A1"]))
            result = run_node(f"""
import fs from 'node:fs'; import path from 'node:path';
import {{ compileDeck, readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const dir = {json.dumps(str(tmp))}, out = path.join(dir, 'out');
const doc = JSON.parse(fs.readFileSync(path.join(dir, 'finance.pages.json'), 'utf8'));
fs.mkdirSync(path.join(dir, 'sources'), {{ recursive: true }});
const insights = await readInsights(dir, 'finance', {{ alternatives: alternativesOf(doc.deck) }});
for (const item of insights.log?.insights ?? []) for (const file of item.sources ?? []) fs.writeFileSync(path.join(dir, file), 'illustrative');
const specPath = path.join(dir, 'finance.deck.json');
const write = (answer) => {{ const spec = compileDeck({{ ...doc, deck: {{ ...doc.deck, answer }} }}, {{ insights, draft: true, partial: true }}).spec; fs.writeFileSync(specPath, JSON.stringify(spec)); }};
write(doc.deck.answer);
const held = await S.prepareStoryline(specPath, out);
// Narrowed, the answer is another statement: the spine critique stages, told what was raised.
write(doc.deck.answer.replace('the thinnest liquidity cover among them', 'the thinnest liquidity cover of the eight'));
const staged = await S.prepareStoryline(specPath, out);
const prompt = staged.dir ? fs.readFileSync(path.join(staged.dir, 'prompt.md'), 'utf8') : '';
console.log(JSON.stringify({{ held: [held.status, held.errors ?? []], staged: staged.status, told: prompt.includes('RAISED ON THE ANSWER BEFORE THE SKELETON'), item: prompt.includes('A1 (major, scope, narrow)'), revised: prompt.includes('the answer has been revised since'), hazard: prompt.includes("Say 'among those that publish it'") }}));
""")
            self.assertEqual(result["held"][0], "refused")
            self.assertIn("answer critique", " ".join(result["held"][1]))
            self.assertEqual(result["staged"], "packet-written")
            self.assertTrue(result["told"] and result["item"] and result["revised"] and result["hazard"], result)

    def test_a_revised_answer_gets_a_new_packet_that_settles_the_earlier_items_and_no_stale_answer(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage_fixture(tmp)
            out = Path(tmp) / "out"
            run(pages, out)
            (out / "answer-critique" / "answer.json").write_text(json.dumps(critique()), encoding="utf-8")
            run(pages, out)
            doc = json.loads(pages.read_text(encoding="utf-8"))
            doc["deck"]["answer"] = ANSWER.replace("the thinnest liquidity cover among them", "the thinnest liquidity cover of the eight")
            pages.write_text(json.dumps(doc), encoding="utf-8")
            again = run(pages, out)
            self.assertEqual(again.returncode, 3, again.stderr)
            prompt = (out / "answer-critique" / "prompt.md").read_text(encoding="utf-8")
            self.assertIn("RAISED ON AN EARLIER ANSWER", prompt)
            self.assertFalse((out / "answer-critique" / "answer.json").exists(), "the answer to the earlier packet is not read as this one's")
            # The next critic must settle A1: a critique silent on it is refused.
            (out / "answer-critique" / "answer.json").write_text(json.dumps(critique(verdict="ready", items=[])), encoding="utf-8")
            refused = run(pages, out)
            self.assertEqual(refused.returncode, 2)
            self.assertIn("give A1 a status", refused.stderr)


class BriefTests(unittest.TestCase):
    def test_the_skeleton_brief_prints_what_the_answer_critique_left_open(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage_fixture(tmp)
            out = Path(tmp) / "out"
            run(pages, out)
            (out / "answer-critique" / "answer.json").write_text(json.dumps(critique()), encoding="utf-8")
            run(pages, out)
            brief = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(pages), "--brief", "skeleton"], capture_output=True, text=True)
            self.assertEqual(brief.returncode, 0, brief.stderr[-600:])
            self.assertIn("Raised on the answer before the skeleton", brief.stdout)
            self.assertIn('A1 (major, scope, narrow): "the thinnest liquidity cover among them"', brief.stdout)
            self.assertIn("[i-peers] Capital is ranked only among the peers that publish it.", brief.stdout, "the log's hazards reach the skeleton whatever the answer says")

    def test_a_page_resting_on_insights_a_hazard_names_together_hears_its_rule_at_the_draft_and_the_check(self):
        """A hazard names insights the log cannot compare; a page drawing on two of them is told its rule where it is
        checked, before a critique has to find the comparison on the spine. Read by ids; advisory, since drawing on both
        is not yet comparing them."""
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage_fixture(tmp)
            out = Path(tmp) / "out"
            out.mkdir()
            record = critique()
            record["hazards"].append({"insights": ["i-cash", "i-earn"], "problem": "Cash flow is reported on a calendar year and earnings on the fiscal one.",
                                      "rule": "Never set cash flow beside earnings as one year's numbers."})
            (out / "answer-critique.json").write_text(json.dumps(record), encoding="utf-8")
            reports = {mode: subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(pages), mode, "--page", "f1,f2", "--json"], capture_output=True, text=True)
                       for mode in ("--draft", "--check")}
        for mode, run_ in reports.items():
            report = json.loads(run_.stdout)
            said = {page: [f for f in report["pages"][page].get("advisories", []) if f["code"] == "COMPARISON_UNSUPPORTED"] for page in ("f1", "f2")}
            self.assertEqual(said["f1"], [], mode)
            [hazard] = said["f2"]
            self.assertEqual(hazard["class"], "P", mode)
            self.assertEqual(hazard["measured"]["insights"], ["i-cash", "i-earn"], mode)
            self.assertIn('"Never set cash flow beside earnings as one year\'s numbers."', hazard["repair"], mode)


if __name__ == "__main__":
    unittest.main()
