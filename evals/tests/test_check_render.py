"""The final check is the build: `author-deck --check --render`.

The scene's gates estimate what a page will look like; the build's render
gates measure it, and the two can disagree. A fifty-page run passed its
compile and then learned COLUMN_VOID, INTERNAL_VOID and TEXT_FRAGMENTED from
the build, five builds running. `--check --render` runs the build's own
stages on the compiled deck in a temporary folder and files what they report
with the rest, so nothing is first seen at the build.

Acceptance: on a deck, the blocking findings of the check and of the build
are the same set, and everything the build's gates say of a page the check
said first. This renders with LibreOffice, so it runs only when asked for:
`node evals/scripts/run_tests.mjs --slow`, or PS_RUN_SLOW=1.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import HAS_RENDERER, NODE, ROOT, SKILL, requires_python_package

sys.path.insert(0, str(SKILL / "runtime" / "gates"))
import density_profile  # noqa: E402

AUTHOR = SKILL / "runtime" / "author-deck.mjs"
BUILD = SKILL / "runtime" / "build-deck.mjs"
EXAMPLES = SKILL / "examples"
FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"

# Writes the deck, its plan and its content plan beside a pages file whatever the compile found: the files a
# build reads, for a deck the check refuses, so the two can be compared on a deck with blockers.
WRITE = '''
import fs from 'node:fs';
import path from 'node:path';
import { authorDeck, planOf, readInsights } from './skills/professional-slides/runtime/author-deck.mjs';
const file = process.env.PAGES_FILE, dir = path.dirname(file);
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const run = await authorDeck(doc, { baseDir: dir, insights: await readInsights(dir, doc.deck.id), fit: false });
for (const [suffix, value] of [['deck', run.spec], ['plan', planOf(run.spec)], ['content', run.content]]) fs.writeFileSync(path.join(dir, `${doc.deck.id}.${suffix}.json`), JSON.stringify(value));
console.log(JSON.stringify({ complete: run.complete }));
'''


def run(script, *args, env=None, timeout=900):
    return subprocess.run([NODE, str(script), *map(str, args)], cwd=ROOT, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "RUNTIME_NODE_MODULES": str(ROOT / "node_modules"), **(env or {})})


@unittest.skipUnless(os.environ.get("PS_RUN_SLOW") == "1", "opt-in: set PS_RUN_SLOW=1 or pass --slow")
@unittest.skipUnless(NODE and HAS_RENDERER, "needs Node.js, LibreOffice (soffice) and pdftoppm on PATH")
@requires_python_package("pptx", "PIL", "numpy")
class CheckIsTheBuildTests(unittest.TestCase):
    def compare(self, work, stem):
        """The check's blockers and the build's on the deck at `work`: `(check, build, check summary or None)`."""
        pages = work / f"{stem}.pages.json"
        scratch = work / "tmp"
        scratch.mkdir()
        checked = run(AUTHOR, pages, "--check", "--render", env={"TMPDIR": str(scratch)})
        self.assertIn(checked.returncode, (0, 2), checked.stderr[-1500:])
        self.assertIn("Rendered", checked.stderr, checked.stderr[-1500:])
        # The render is made in a temporary folder that is removed, and nothing is written beside the pages file but the log
        # and each page's image, kept as out/page-check/<id>.png for the writer checking it (page-types.md, Write in two passes)
        # (the renderer keeps its LibreOffice profile in the temporary directory; that is its own).
        self.assertEqual([entry.name for entry in scratch.iterdir() if entry.name.startswith("author-render-")], [])
        kept = sorted(entry.relative_to(work).as_posix() for entry in (work / "out").rglob("*") if entry.is_file()) if (work / "out").exists() else []
        self.assertTrue(all(name.startswith("out/page-check/") and name.endswith(".png") for name in kept), kept)
        self.assertFalse((work / f"{stem}.deck.json").exists())
        log = json.loads((work / f"{stem}.author-log.jsonl").read_text().splitlines()[-1])
        self.assertTrue(log["render"])
        check = {(f["code"], f.get("id")) for f in log["findings"]}
        written = subprocess.run([NODE, "--input-type=module", "-e", WRITE], cwd=ROOT, capture_output=True, text=True, timeout=300, env={**os.environ, "PAGES_FILE": str(pages)})
        self.assertEqual(written.returncode, 0, written.stderr[-1500:])
        built = run(BUILD, work / f"{stem}.deck.json", work / "out", "--no-fetch")
        self.assertIn(built.returncode, (0, 2), built.stderr[-1500:])
        result = json.loads((work / "out" / "build-result.json").read_text())
        scene = json.loads((work / "out" / "scene.json").read_text())
        page = lambda slide: (scene["slides"][slide - 1].get("sourceSlideId") or scene["slides"][slide - 1].get("id")) if slide else None  # noqa: E731
        build = {(b["code"], b.get("id") or page(b.get("slide"))) for b in result["blockers"]}
        said = {(f["code"], page(f.get("slide")) if isinstance(f.get("slide"), int) else f.get("id")) for f in result["gates"]["findings"]}
        return check, build, said, (json.loads(checked.stdout) if checked.returncode == 0 else None), checked

    def test_the_check_and_the_build_block_on_the_same_findings(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
                shutil.copy(FIXTURES / name, work / name)
            check, build, said, summary, checked = self.compare(work, "finance")
            self.assertEqual(check, build)
            self.assertEqual(summary["render"]["blockers"], len(build))
            # What only the render measures now stands in the report: the two aggregates the compile could only name.
            self.assertTrue(any(line.startswith("TEXT_FRAGMENTED.floor: median words a block on the prose pages") for line in summary["standing"]["G"]))
            self.assertTrue(any(line.startswith("DECK_THIN_PAGES: pages thin or leaving a band") for line in summary["standing"]["G"]))
            self.assertFalse(any("measured on the render" in line for line in summary["standing"]["G"]))
            # Everything the build's gates say of the deck, the check said first.
            advised = set(summary["advisories"])
            for code, page in said:
                self.assertTrue(any(a.startswith(f"{code} [{page}]" if page else code) for a in advised), (code, page))

    def test_they_agree_on_a_deck_with_a_blocker(self):
        # The worked example with one page set as stacked panels: a column of it stands empty. The compile blocks
        # on the scene's finding, the build on the scene's and the render's, and the final check on both as the build does.
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            shutil.copytree(EXAMPLES / "assets", work / "assets")
            doc = json.loads((EXAMPLES / "page-types.pages.json").read_text(encoding="utf-8"))
            next(p for p in doc["pages"] if p.get("id") == "p10")["form"] = "stack"
            (work / "page-types.pages.json").write_text(json.dumps(doc), encoding="utf-8")
            check, build, said, summary, checked = self.compare(work, "page-types")
            self.assertIsNone(summary)
            self.assertTrue(build, "the build blocks on this deck")
            self.assertIn("p10", {page for _, page in build})
            self.assertEqual(check, build)
            self.assertIn("the build would report", checked.stderr)
            # The layouts the fit search offers for the page were rendered too: each is called passing only as rendered, or
            # is listed as failing on what the render found. Nothing reads "verified" off the scene checks alone.
            offered = [line.strip() for line in checked.stderr.splitlines() if line.strip().startswith(("passes", "fails"))]
            self.assertTrue(any(line.startswith("passes, rendered: ") or "the render refuses it" in line for line in offered), offered)
            self.assertFalse(any(line.startswith("passes the scene checks") for line in offered), offered)
            self.assertNotIn("the render is checked by `--check --render`", checked.stderr)
            for line in checked.stderr.splitlines():
                if "verified" in line:
                    self.assertIn("rendered in this deck", line)

    def test_the_scene_estimate_of_the_words_a_block_stands_within_its_margin_of_the_render(self):
        # The unrendered compile prints the deck's median words a block as an estimate read off the scene, with the margin it
        # was calibrated to; the render measures the rule. On the worked deck the two agree inside that margin.
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            shutil.copytree(EXAMPLES / "assets", work / "assets")
            shutil.copy(EXAMPLES / "page-types.pages.json", work / "page-types.pages.json")
            value = lambda line: float(re.search(r"prose pages ([0-9.]+)", line).group(1))  # noqa: E731
            floor = lambda summary: next(line for line in summary["standing"]["G"] if line.startswith("TEXT_FRAGMENTED.floor:"))  # noqa: E731
            scene = json.loads(run(AUTHOR, work / "page-types.pages.json", "--check").stdout)
            rendered = json.loads(run(AUTHOR, work / "page-types.pages.json", "--check", "--render").stdout)
            self.assertIn("estimated from the scene", floor(scene))
            self.assertNotIn("estimated", floor(rendered))
            self.assertLessEqual(abs(value(floor(scene)) - value(floor(rendered))), density_profile.SCENE_TOLERANCE)

    def test_a_page_run_renders_only_its_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            shutil.copytree(EXAMPLES / "assets", work / "assets")
            shutil.copy(EXAMPLES / "page-types.pages.json", work / "page-types.pages.json")
            checked = run(AUTHOR, work / "page-types.pages.json", "--check", "--render", "--page", "p07,p12")
            self.assertEqual(checked.returncode, 0, checked.stderr[-1500:])
            summary = json.loads(checked.stdout)
            self.assertEqual(summary["render"]["slides"], 2)
            self.assertIn("Rendered 2 slides", checked.stderr)
            self.assertEqual(sorted(summary["pages"]), ["p07", "p12"])


if __name__ == "__main__":
    unittest.main()
