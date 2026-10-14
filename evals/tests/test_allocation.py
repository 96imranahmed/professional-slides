"""What each section holds for the deck, settled before its skeleton (runtime/allocation.mjs, `author-deck.mjs --allocate`).

Sections written side by side each see the deck only as the others stand when they look, so the rules that read the whole
deck - the kinds of exhibit it draws, the depth of its median chart page, the peer sets its comparisons name - were met by no
section alone and found short at the whole-deck compile, after the writers, where meeting them meant redrawing written pages.
Two skeletons could also build on one insight, and the second learned it only at the plan. These tests hold the allocation:

- each insight has one home, the part whose `evidence` names it; a page building on another section's insight, or on one no
  section holds, is refused from the spine on, and a section that re-reads one on purpose lists it in `rereads`;
- `--allocate` gives each kind the deck's floor needs to one section whose own evidence draws it, one kind an insight, and says
  how far the evidence falls short of the floor while that is still a gap in the research, not in written pages;
- `--write` records each section's share in its part file, and the section's briefs print it against its pages.
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
EVIDENCE = ROOT / "evals" / "quality" / "fixtures" / "evidence"


def sectioned(tmp, a_evidence=None, b_evidence=None, a_extra=None, b_extra=None):
    """The finance fixture deck in two parts beside its summary page, each part declaring the insights it holds."""
    for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
        shutil.copy(EVIDENCE / name, Path(tmp, name))
    doc = json.loads(Path(tmp, "finance.pages.json").read_text())
    by_id = {page["id"]: page for page in doc["pages"]}
    Path(tmp, "pages").mkdir()
    a = {"pages": [by_id["f1"], by_id["f2"]], **({"evidence": a_evidence} if a_evidence is not None else {}), **(a_extra or {})}
    b = {"pages": [by_id[i] for i in ("f3", "f4", "f5", "f6")], **({"evidence": b_evidence} if b_evidence is not None else {}), **(b_extra or {})}
    Path(tmp, "pages", "a.pages.json").write_text(json.dumps(a, indent=1) + "\n")
    Path(tmp, "pages", "b.pages.json").write_text(json.dumps(b, indent=1) + "\n")
    doc["pages"] = [by_id["f0"], {"include": "pages/a.pages.json"}, {"include": "pages/b.pages.json"}]
    Path(tmp, "finance.pages.json").write_text(json.dumps(doc))
    return Path(tmp, "finance.pages.json")


# Each insight in the part whose pages build on it: f1 and f2 are a's, f3 to f6 b's.
A_HOLDS = ["i-loans", "i-credit", "i-cash", "i-earn"]
B_HOLDS = ["i-liquidity", "i-rule", "i-efficiency", "i-peers"]


def author(pages, *args):
    return subprocess.run([NODE, str(AUTHOR), str(pages), *args], capture_output=True, text=True, timeout=180)


def codes(pages, page):
    run = author(pages, "--draft", "--page", page, "--json")
    report = json.loads(run.stdout)
    return [f["code"] for f in report["pages"][page].get("findings", [])], run


@unittest.skipUnless(NODE, "Node.js is not available")
class EvidenceHomeTests(unittest.TestCase):
    def test_an_insight_named_by_two_sections_is_refused_and_nothing_is_written(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, A_HOLDS, B_HOLDS + ["i-loans"])
            run = author(pages, "--allocate", "--write")
            part = json.loads(Path(tmp, "pages", "a.pages.json").read_text())
        self.assertEqual(run.returncode, 2, run.stdout + run.stderr)
        self.assertIn("EVIDENCE_HOMED_TWICE", run.stdout)
        self.assertIn("i-loans is named in the `evidence` of a (pages/a.pages.json) and b (pages/b.pages.json)", run.stdout)
        self.assertIn("Nothing written", run.stdout)
        self.assertNotIn("allocation", part)

    def test_a_page_building_on_another_sections_insight_is_refused_unless_its_part_rereads_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, A_HOLDS, B_HOLDS)
            doc = json.loads(Path(tmp, "pages", "b.pages.json").read_text())
            doc["pages"][1]["evidence"] = ["i-efficiency", "i-cash"]
            Path(tmp, "pages", "b.pages.json").write_text(json.dumps(doc))
            refused, run = codes(pages, "f4")
            doc["rereads"] = ["i-cash"]
            Path(tmp, "pages", "b.pages.json").write_text(json.dumps(doc))
            reread, _ = codes(pages, "f4")
        self.assertIn("EVIDENCE_ELSEWHERE", refused, run.stdout)
        self.assertIn("i-cash (held by a)", run.stdout)
        self.assertNotIn("EVIDENCE_ELSEWHERE", reread)

    def test_a_page_building_on_an_insight_no_section_holds_is_refused(self):
        # i-credit is in neither part's evidence: two sections could both take it, so the one that builds on it takes it home.
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, ["i-loans", "i-cash", "i-earn"], B_HOLDS)
            refused, run = codes(pages, "f1")
        self.assertIn("EVIDENCE_UNHOMED", refused, run.stdout)
        self.assertIn("add it to a's `evidence`", run.stdout)

    def test_a_revision_recorded_before_the_homes_hears_them_as_advice(self):
        result = run_node("""
import { applyRulesVersion } from './skills/professional-slides/runtime/weight.mjs';
const codes = ['EVIDENCE_HOMED_TWICE', 'EVIDENCE_UNKNOWN', 'EVIDENCE_ELSEWHERE', 'EVIDENCE_UNHOMED'];
const findings = codes.map((code) => ({ code, id: 'p1', severity: 'blocker' }));
const older = applyRulesVersion(findings, { workflow: 'existing_deck_revision', rulesVersion: 12 }).map((f) => f.severity);
const current = applyRulesVersion(findings, { workflow: 'existing_deck_revision', rulesVersion: 13 }).map((f) => f.severity);
console.log(JSON.stringify({ older, current }));
""")
        self.assertEqual(result["older"], ["advisory"] * 4)
        self.assertEqual(result["current"], ["blocker"] * 4)

    def test_a_deck_declaring_no_homes_is_read_as_before(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp)
            found, run = codes(pages, "f4")
        self.assertFalse([code for code in found if code.startswith("EVIDENCE_")], run.stdout)

    def test_a_part_names_its_evidence_as_a_list_of_insight_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, "i-loans", B_HOLDS)
            run = author(pages, "--allocate")
        self.assertEqual(run.returncode, 2)
        self.assertIn("`evidence` is a list of insight ids", run.stderr)


@unittest.skipUnless(NODE, "Node.js is not available")
class KindAllocationTests(unittest.TestCase):
    def test_each_kind_goes_to_one_section_that_draws_it_from_its_own_evidence_one_kind_an_insight(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, A_HOLDS, B_HOLDS, {"budget": 2}, {"budget": 4})
            run = author(pages, "--allocate", "--write")
            given = {part: json.loads(Path(tmp, "pages", f"{part}.pages.json").read_text()).get("allocation", {}).get("kinds", []) for part in ("a", "b")}
            brief = author(pages, "--brief", "skeleton", "--section", "a")
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertIn("the kinds floor is 3", run.stdout)
        kinds = [item["kind"] for part in given.values() for item in part]
        insights = [item["insight"] for part in given.values() for item in part]
        self.assertGreaterEqual(len(kinds), 3)
        self.assertEqual(len(kinds), len(set(kinds)), given)
        self.assertEqual(len(insights), len(set(insights)), given)
        self.assertTrue(all(item["insight"] in A_HOLDS for item in given["a"]), given)
        self.assertTrue(all(item["insight"] in B_HOLDS for item in given["b"]), given)
        self.assertTrue(all({"kind", "insight", "type", "form"} <= set(item) for part in given.values() for item in part))
        # The section's brief prints its share against its pages, and its own insights alone.
        self.assertEqual(brief.returncode, 0, brief.stderr)
        self.assertIn("this section's share of the deck", brief.stdout)
        self.assertIn("## The insights this section holds", brief.stdout)
        held = brief.stdout.split("## The insights this section holds")[1].split("\n## ")[0]
        self.assertTrue(all(f"- {insight}" not in held for insight in B_HOLDS), held)
        self.assertIn("- i-loans", held)

    def test_a_floor_the_evidence_cannot_reach_is_said_before_the_skeletons_and_the_shares_still_written(self):
        # Planned at 120 pages the floor is 48 kinds, far more than eight insights draw one a page: that is a research gap.
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, A_HOLDS, B_HOLDS, {"budget": 60}, {"budget": 60})
            run = author(pages, "--allocate", "--write")
            part = json.loads(Path(tmp, "pages", "a.pages.json").read_text())
        self.assertEqual(run.returncode, 2, run.stdout + run.stderr)
        self.assertIn("KINDS_UNREACHABLE", run.stdout)
        self.assertIn("against a floor of 49", run.stdout)
        self.assertIn("allocation", part)

    def test_a_form_that_sets_the_numbers_aside_is_never_given(self):
        # Logos, people and cards draw no measure: given to an insight with numbers, they add a kind by losing the evidence.
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, A_HOLDS, B_HOLDS, {"budget": 30}, {"budget": 30})
            run = author(pages, "--allocate")
        self.assertNotIn(" as profiles/", run.stdout)
        self.assertNotIn(" as argument/", run.stdout)

    def test_a_part_keeps_its_formatting_when_its_share_is_written(self):
        result = run_node("""
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { editPartSync } from './skills/professional-slides/runtime/pages-file.mjs';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'part-edit-'));
fs.mkdirSync(path.join(dir, 'pages'));
const text = '{\\n    "budget": 3,\\n    "pages": [],\\n    "evidence": ["x"]\\n}\\n';
fs.writeFileSync(path.join(dir, 'pages', 'a.pages.json'), text);
fs.writeFileSync(path.join(dir, 'd.pages.json'), JSON.stringify({ deck: {}, pages: [{ include: 'pages/a.pages.json' }] }));
const same = editPartSync(path.join(dir, 'd.pages.json'), 'pages/a.pages.json', () => {});
const wrote = editPartSync(path.join(dir, 'd.pages.json'), 'pages/a.pages.json', (part) => { part.allocation = { kinds: [] }; });
const after = fs.readFileSync(path.join(dir, 'pages', 'a.pages.json'), 'utf8');
fs.rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify({ same, wrote, after }));
""")
        out = result
        self.assertFalse(out["same"])
        self.assertTrue(out["wrote"])
        self.assertEqual(out["after"], '{\n    "budget": 3,\n    "pages": [],\n    "evidence": [\n        "x"\n    ],\n    "allocation": {\n        "kinds": []\n    }\n}\n')


@unittest.skipUnless(NODE, "Node.js is not available")
class PreflightTests(unittest.TestCase):
    def test_the_records_and_the_decks_keys_are_read_before_any_page(self):
        # A deck key the runtime does not read would first refuse the plan, with every section's skeleton waiting on the lead.
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, A_HOLDS, B_HOLDS)
            doc = json.loads(pages.read_text())
            doc["deck"]["sectionCount"] = 2
            pages.write_text(json.dumps(doc))
            run = author(pages, "--allocate")
        self.assertEqual(run.returncode, 2, run.stdout + run.stderr)
        self.assertIn("## The records and the deck's keys, before any page", run.stdout)
        self.assertIn("DECK_KEY", run.stdout)
        self.assertIn("sectionCount", run.stdout)


@unittest.skipUnless(NODE, "Node.js is not available")
class PeerSetProposalTests(unittest.TestCase):
    def test_a_measure_over_declared_players_no_set_holds_is_proposed_as_a_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = sectioned(tmp, A_HOLDS, B_HOLDS)
            doc = json.loads(pages.read_text())
            proposed = author(pages, "--allocate")
            players = doc["deck"]["players"]
            doc["deck"]["conventions"] = {"peerSets": {"the field": players}}
            pages.write_text(json.dumps(doc))
            held = author(pages, "--allocate")
        self.assertIn("## Peer sets the comparisons will need", proposed.stdout)
        self.assertNotIn("## Peer sets the comparisons will need", held.stdout)


if __name__ == "__main__":
    unittest.main()
