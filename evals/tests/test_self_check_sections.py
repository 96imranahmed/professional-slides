"""A section is self-checked as soon as it checks clean, and the build keeps its verdicts.

On the BA retest the self-check ran once, after the build, over all 95 pages: 64
problems on 41 of them, each rewritten after the deck was drawn and judged, and 20
more in the rewrites. Checked per section beside the judges, the same problems are
fixed before the build. The record delivery reads is bound to the build's claim
ledger, which only exists afterwards, so a verdict is recorded against the claims
its checker read and carried to the build's hash while the page says the same.
"""
import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"


def stage_fixture(tmp):
    for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
        shutil.copy(FIXTURES / name, Path(tmp) / name)
    return Path(tmp) / "finance.pages.json"


def brief(pages):
    run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(pages), "--brief", "selfcheck"], capture_output=True, text=True)
    return run


def sheets(text):
    return {m.group(1): m.group(2) for m in re.finditer(r"^(\w+)  .*\(sheet ([0-9a-f]{16})\)$", text, re.M)}


class BriefTests(unittest.TestCase):
    def test_the_selfcheck_brief_sets_each_pages_claims_beside_the_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            run = brief(stage_fixture(tmp))
            self.assertEqual(run.returncode, 0, run.stderr[-600:])
            self.assertIn("## Your pages' claims", run.stdout)
            self.assertIn("## The records they rest on", run.stdout)
            self.assertIn("calculation: net interest margin, loan growth, capital ratio and liquidity cover", run.stdout,
                          "a rank or a comparison is read against the calculation, not the page's own exhibit")
            self.assertTrue(sheets(run.stdout), "every page's claims carry the hash its verdict is recorded against")
            self.assertIn("node runtime/self-check.mjs", run.stdout)


class RecordTests(unittest.TestCase):
    def test_verdicts_carry_to_the_builds_ledger_while_a_page_says_the_same(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = stage_fixture(tmp)
            out = Path(tmp) / "out"
            (out / "self-check").mkdir(parents=True)
            read = sheets(brief(pages).stdout)
            # The build's ledger, as build-deck writes it: one hash per page that makes claims.
            ledger = {"schema": "professional-slides.claims/v1", "pageHashes": {page: f"build{n:011d}" for n, page in enumerate(read)}, "claims": [], "findings": []}
            (out / "claims.json").write_text(json.dumps(ledger), encoding="utf-8")
            (out / "self-check" / "whole.json").write_text(json.dumps({"section": "whole", "pages": {page: {"sheet": h, "verified": True} for page, h in read.items()}, "problems": []}), encoding="utf-8")
            spine = ["--spine", "The title-spine pass merged no pages: each proves a different finding about Harbour."]
            first = subprocess.run([NODE, str(RUNTIME / "self-check.mjs"), str(pages), str(out), *spine], capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            record = json.loads((out / "self-check.json").read_text(encoding="utf-8"))
            self.assertEqual({page: entry["claims"] for page, entry in record["pages"].items()}, ledger["pageHashes"])
            checked = run_node(f"""
import fs from 'node:fs';
import {{ validateSelfCheck }} from './skills/professional-slides/runtime/claims.mjs';
console.log(JSON.stringify(validateSelfCheck(JSON.parse(fs.readFileSync({json.dumps(str(out / 'self-check.json'))}, 'utf8')), JSON.parse(fs.readFileSync({json.dumps(str(out / 'claims.json'))}, 'utf8')))));
""")
            self.assertEqual(checked, [], "delivery reads the joined record as complete")
            # A page rewritten after its check, with a rebuild that moved its hash: named for another check, the rest kept.
            doc = json.loads(pages.read_text(encoding="utf-8"))
            changed = next(page for page in doc["pages"] if page.get("id") in read and page["id"] != "f0")
            changed["title"] = changed["title"] + " again"
            pages.write_text(json.dumps(doc), encoding="utf-8")
            ledger["pageHashes"][changed["id"]] = "rebuilt0000000"
            (out / "claims.json").write_text(json.dumps(ledger), encoding="utf-8")
            second = subprocess.run([NODE, str(RUNTIME / "self-check.mjs"), str(pages), str(out)], capture_output=True, text=True)
            self.assertEqual(second.returncode, 2)
            report = json.loads(second.stdout)
            self.assertEqual(report["toCheck"], {"its claims changed since it was checked": [changed["id"]]})
            self.assertEqual(report["verified"], len(read) - 1)


if __name__ == "__main__":
    unittest.main()
