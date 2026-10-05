"""The design intake: asked once per user, stored outside any project, shown as
real rendered options, and carried into the deck through keys the build reads.

A new deck used to open with one sentence asking for a reference deck or a
pick from a picture of four systems, so every other choice - tracker, title
treatment, surfaces, density - defaulted silently, and was asked again (or not
at all) on the next deck.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import (HAS_PILLOW, HAS_PPTX, HAS_RENDERER, NODE, ROOT, RUNTIME, SKILL, RUNTIME_PYTHON,
                        requires_python_package, run_node)

PREFERENCES = RUNTIME / "preferences.mjs"
SHEETS = ["design-systems", "palettes", "trackers", "title-treatments", "surfaces"]


def cli(home: Path, *args: str, env_extra=None, check=True):
    env = {**os.environ, "PROFESSIONAL_SLIDES_HOME": str(home), **(env_extra or {})}
    result = subprocess.run([NODE, str(PREFERENCES), *args], capture_output=True, text=True, env=env, cwd=ROOT, timeout=60)
    if check and result.returncode != 0:
        raise AssertionError(result.stderr)
    return result


@unittest.skipUnless(NODE, "Node.js is not available")
class PreferencesFileTests(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())

    def test_answers_round_trip_with_when_and_how_they_were_chosen(self):
        missing = json.loads(cli(self.home, "show").stdout)["missing"]
        self.assertEqual(missing, ["reference", "design", "colours", "tracker", "titleRule", "surfaces", "density"])
        cli(self.home, "set", "design=editorial", "colours=brand", 'brand={"primary":"#0B6E4F","accent":"#F2A900"}', "tracker=label",
            "--reference", str(self.home / "house.pptx"))
        cli(self.home, "set", "titleRule=system", "surfaces=reference", "density=executive", "--source", "default")
        stored = json.loads((self.home / "preferences.json").read_text())
        self.assertEqual(stored["schema"], "professional-slides.preferences/v1")
        self.assertEqual(stored["answers"]["design"]["value"], "editorial")
        self.assertEqual(stored["answers"]["design"]["source"], "asked")
        self.assertEqual(stored["answers"]["density"]["source"], "default")
        # The reference deck is kept as a hash of its path, never its name or content.
        reference = stored["answers"]["reference"]["value"]
        self.assertRegex(reference["pathHash"], r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(reference["kind"], "pptx")
        self.assertNotIn("house.pptx", json.dumps(stored))
        shown = json.loads(cli(self.home, "show").stdout)
        self.assertEqual(shown["missing"], [])
        self.assertIn("Reusing your stored design preferences", shown["reuse"])
        self.assertEqual(json.loads(cli(self.home, "get", "tracker").stdout), "label")
        cli(self.home, "clear", "tracker")
        self.assertEqual(json.loads(cli(self.home, "show").stdout)["missing"], ["tracker"])

    def test_the_file_lives_in_the_user_home_and_respects_xdg(self):
        env = {k: v for k, v in os.environ.items() if k != "PROFESSIONAL_SLIDES_HOME"}
        xdg = self.home / "config"
        run = lambda extra: subprocess.run([NODE, str(PREFERENCES), "path"], capture_output=True, text=True, env={**env, **extra}, cwd=ROOT, timeout=60).stdout.strip()
        self.assertEqual(run({"XDG_CONFIG_HOME": str(xdg)}), str(xdg / "professional-slides" / "preferences.json"))
        self.assertEqual(run({"HOME": str(self.home), "XDG_CONFIG_HOME": ""}), str(self.home / ".professional-slides" / "preferences.json"))
        self.assertEqual(run({"PROFESSIONAL_SLIDES_HOME": str(self.home / "ps"), "XDG_CONFIG_HOME": str(xdg)}), str(self.home / "ps" / "preferences.json"))

    def test_an_unwritable_home_keeps_the_file_in_the_workspace_and_says_so(self):
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            self.skipTest("root writes to a read-only directory")
        home, workspace = self.home / "home", Path(tempfile.mkdtemp()).resolve()
        home.mkdir()
        home.chmod(0o555)
        self.addCleanup(home.chmod, 0o755)
        env = {**{k: v for k, v in os.environ.items() if k != "PROFESSIONAL_SLIDES_HOME"}, "HOME": str(home), "XDG_CONFIG_HOME": ""}
        run = lambda *args: subprocess.run([NODE, str(PREFERENCES), *args], capture_output=True, text=True, env=env, cwd=workspace, timeout=60)
        expected = workspace / ".professional-slides" / "preferences.json"
        located = run("path")
        self.assertEqual(located.stdout.strip(), str(expected), "path prints only the path on stdout")
        self.assertIn("workspace", located.stderr)
        self.assertIn("~/.professional-slides is not writable", located.stderr)
        stored = run("set", "design=editorial")
        self.assertEqual(stored.returncode, 0, stored.stderr)
        report = json.loads(stored.stdout)
        self.assertEqual((report["file"], report["location"]), (str(expected), "workspace"))
        self.assertIn("not writable", report["locationReason"])
        self.assertEqual(json.loads(expected.read_text())["answers"]["design"]["value"], "editorial")
        self.assertFalse((home / ".professional-slides").exists())
        self.assertEqual(json.loads(run("show").stdout)["location"], "workspace")
        # The chosen location is reported whichever it is.
        self.assertEqual(json.loads(cli(self.home, "show").stdout)["location"], "PROFESSIONAL_SLIDES_HOME")

    def test_answers_stored_in_a_read_only_home_are_still_read(self):
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            self.skipTest("root writes to a read-only directory")
        home, workspace = self.home / "home", Path(tempfile.mkdtemp()).resolve()
        stored = home / ".professional-slides"
        stored.mkdir(parents=True)
        (stored / "preferences.json").write_text(json.dumps({"schema": "professional-slides.preferences/v1", "updated": None,
            "answers": {"design": {"value": "journal", "at": "2026-09-01T00:00:00Z", "source": "asked"}}}))
        stored.chmod(0o555)
        self.addCleanup(stored.chmod, 0o755)
        env = {**{k: v for k, v in os.environ.items() if k != "PROFESSIONAL_SLIDES_HOME"}, "HOME": str(home), "XDG_CONFIG_HOME": ""}
        run = lambda *args: subprocess.run([NODE, str(PREFERENCES), *args], capture_output=True, text=True, env=env, cwd=workspace, timeout=60)
        shown = json.loads(run("show").stdout)
        self.assertEqual((shown["location"], shown["deckKeys"]["design"]), ("home", "journal"))
        self.assertIn("read-only", shown["locationReason"])
        # A new answer is written to the workspace, carrying the stored ones with it.
        report = json.loads(run("set", "tracker=label").stdout)
        self.assertEqual(report["location"], "workspace")
        copied = json.loads((workspace / ".professional-slides" / "preferences.json").read_text())["answers"]
        self.assertEqual((copied["design"]["value"], copied["tracker"]["value"]), ("journal", "label"))
        self.assertEqual(json.loads(run("show").stdout)["location"], "workspace")

    def test_nothing_unanswered_is_applied_and_each_unset_answer_names_its_default(self):
        shown = json.loads(cli(self.home, "show").stdout)
        asked = ["reference", "design", "colours", "tracker", "titleRule", "surfaces", "density"]
        self.assertEqual([u["key"] for u in shown["unset"]], asked)
        self.assertEqual({u["key"]: u["default"] for u in shown["unset"]}["design"], "consulting", "the recommendation is shown")
        self.assertEqual(shown["deckKeys"], {}, "an empty store sets no deck key")
        self.assertEqual(json.loads(cli(self.home, "deck-keys").stdout), {})
        pages = self.home / "d.pages.json"
        pages.write_text(json.dumps({"deck": {"id": "d"}, "pages": []}))
        applied = json.loads(cli(self.home, "apply", str(pages)).stdout)
        self.assertEqual(applied["set"], [])
        self.assertEqual([u["key"] for u in applied["unset"]], asked)
        self.assertEqual(json.loads(pages.read_text())["deck"], {"id": "d"}, "apply writes no default the user never chose")
        cli(self.home, "set", "design=journal", "density=pre-read")
        shown = json.loads(cli(self.home, "show").stdout)
        self.assertEqual([u["key"] for u in shown["unset"]], ["reference", "colours", "tracker", "titleRule", "surfaces"])
        self.assertEqual(shown["deckKeys"], {"design": "journal", "density": "pre-read"})

    def test_invalid_answers_and_files_are_refused(self):
        for pair in ["tracker=tabs", "design=corporate", "colours=teal", "titleRule=underline", "density=dense", "nonsense=1", 'brand={"primary":"red"}']:
            result = cli(self.home, "set", pair, check=False)
            self.assertNotEqual(result.returncode, 0, pair)
        self.assertFalse((self.home / "preferences.json").exists(), "a refused answer writes nothing")
        # Brand colours are required when the colours answer is "brand".
        self.assertNotEqual(cli(self.home, "set", "colours=brand", check=False).returncode, 0)
        (self.home / "preferences.json").write_text(json.dumps({"schema": "professional-slides.preferences/v0", "answers": {}}))
        self.assertIn("schema", cli(self.home, "show", check=False).stderr)

    def test_a_house_profile_is_stored_as_inferred_and_answers_the_frame_questions(self):
        house = {"schema": "professional-slides.house/v1", "source": "Client house.pptx", "design": "journal", "footer": "Board paper",
                 "palette": {"base": "midnight", "colors": {"color.accent": "#E1251B", "style.titleRule": "none"}},
                 "chrome": {"left": 60, "right": 60, "titleTop": 40, "bodyTop": 140, "footerTop": 670}, "density": "pre-read",
                 "observations": ["x"], "stats": {"slides": 3}}
        (self.home / "house.json").write_text(json.dumps(house))
        cli(self.home, "set", "--from-house", str(self.home / "house.json"), "--reference", str(self.home / "Client house.pptx"), "tracker=pills")
        stored = json.loads((self.home / "preferences.json").read_text())["answers"]
        self.assertEqual(stored["house"]["source"], "inferred")
        self.assertEqual(stored["design"]["source"], "inferred")
        self.assertEqual(stored["tracker"]["source"], "asked")
        # The reference deck's own words and measurements are not kept.
        self.assertNotIn("footer", stored["house"]["value"])
        self.assertNotIn("stats", stored["house"]["value"])
        self.assertNotIn("Client house", json.dumps(stored))
        shown = json.loads(cli(self.home, "show").stdout)
        self.assertEqual(shown["missing"], ["surfaces"])
        self.assertEqual(shown["deckKeys"]["design"], "journal")
        self.assertEqual(shown["deckKeys"]["chrome"]["left"], 60)
        self.assertEqual(shown["deckKeys"]["tracker"], "pills")


@unittest.skipUnless(NODE, "Node.js is not available")
class AnswersToDeckKeysTests(unittest.TestCase):
    def test_each_answer_sets_exactly_its_documented_deck_keys(self):
        result = run_node('''
import { deckKeys, applyToDeck } from './skills/professional-slides/runtime/preferences.mjs';
const out = {
  empty: deckKeys({}),
  brand: deckKeys({ design: 'editorial', colours: 'brand', brand: { primary: '#0B6E4F', accent: '#F2A900' } }),
  subject: deckKeys({ design: 'journal', colours: 'subject' }),
  paletteConsulting: deckKeys({ design: 'consulting', colours: 'crimson' }),
  paletteEditorial: deckKeys({ design: 'editorial', colours: 'crimson' }),
  paletteUnset: deckKeys({ colours: 'crimson' }),
  bar: deckKeys({ design: 'consulting', colours: 'evergreen', titleRule: 'bar' }),
  system: deckKeys({ titleRule: 'system', tracker: 'auto' }),
  none: deckKeys({ tracker: 'none', surfaces: 'open', density: 'live-pitch', footer: 'Acme | Confidential', wordmark: 'Acme', typography: { body: 'Calibri' } }),
  applied: applyToDeck({ deck: { id: 'd', tracker: 'label' }, pages: [] }, { design: 'keynote', tracker: 'pills' })
};
console.log(JSON.stringify(out));
''')
        self.assertEqual(result["empty"], {})
        self.assertEqual(result["brand"], {"design": "editorial", "identity": {"primary": "#0B6E4F", "accent": "#F2A900"}})
        self.assertEqual(result["subject"], {"design": "journal"})
        self.assertEqual(result["paletteConsulting"]["palette"], "crimson")
        editorial = result["paletteEditorial"]["palette"]
        self.assertEqual(editorial["base"], "crimson")
        self.assertTrue(all(k.startswith("color.") for k in editorial["colors"]), "a palette on another system brings colours, not its frame")
        self.assertEqual(result["bar"]["palette"], {"base": "evergreen", "colors": {"style.titleRule": "rule", "style.titleRuleLength": "short", "style.titleRuleColor": "accent", "line.titleRule": 4}})
        self.assertEqual(result["system"], {})
        # A deck with no design is built as consulting, so a palette answer is its name.
        self.assertEqual(result["paletteUnset"], {"palette": "crimson"})
        none = result["none"]
        self.assertIs(none["tracker"], False)
        self.assertEqual((none["surfaces"], none["density"], none["footer"], none["logo"]), ("open", "live-pitch", "Acme | Confidential", "Acme"))
        self.assertEqual(none["typography"]["semibold"]["family"], "Calibri")
        # A key the deck already sets is the deck's choice and is kept.
        self.assertEqual(result["applied"]["document"]["deck"]["tracker"], "label")
        self.assertEqual(result["applied"]["document"]["deck"]["design"], "keynote")
        self.assertEqual(result["applied"]["kept"], ["tracker"])

    def test_the_keys_reach_the_composed_deck(self):
        result = run_node('''
import { toDeckPlan } from './evals/support/compose.mjs';
import { optionDeck } from './skills/professional-slides/runtime/design-options.mjs';
const read = (answers) => {
  const plan = toDeckPlan(optionDeck(answers), './skills/professional-slides/runtime');
  const chart = plan.slides.find((s) => s.title?.startsWith('Demand reaches'));
  return { design: plan.design ?? null, palette: plan.palette, construction: chart?.chrome?.tracker?.construction ?? chart?.tracker?.construction ?? null, density: chart?.density ?? null };
};
console.log(JSON.stringify({
  band: read({ design: 'consulting', titleRule: 'band', tracker: 'number-strip', surfaces: 'open', density: 'pre-read' }),
  none: read({ design: 'keynote', tracker: 'none' }),
  brand: read({ design: 'journal', colours: 'brand', brand: { primary: '#0B6E4F' } })
}));
''')
        band = result["band"]
        self.assertEqual(band["palette"]["colors"]["style.titleRule"], "band")
        self.assertEqual(band["palette"]["colors"]["style.tableHeader"], "rule", "surfaces: open reaches the table header")
        self.assertEqual(band["construction"], "compact-number-strip")
        self.assertIsNone(result["none"]["construction"])
        self.assertNotEqual(result["brand"]["palette"]["colors"]["color.componentPrimary"], "#1E4D6B", "the brand replaces the journal's own primary")


@unittest.skipUnless(NODE, "Node.js is not available")
class OptionSheetTests(unittest.TestCase):
    def test_every_tile_is_labelled_with_the_value_the_author_sets(self):
        result = run_node('''
import { sheetPlan } from './skills/professional-slides/runtime/design-options.mjs';
import { deckKeys } from './skills/professional-slides/runtime/preferences.mjs';
console.log(JSON.stringify(sheetPlan({ brand: { primary: '#0B6E4F', accent: '#F2A900' } }).map((s) => ({ id: s.id, question: s.question,
  options: s.options.map((o) => ({ label: o.label, answer: o.answers[s.question], keys: deckKeys(o.answers) })) }))));
''')
        sheets = {s["id"]: s for s in result}
        self.assertEqual(list(sheets), SHEETS)
        for sheet in result:
            for option in sheet["options"]:
                answer = option["answer"]
                if sheet["question"] == "design":
                    self.assertEqual(option["keys"]["design"], answer)
                if sheet["question"] == "tracker":
                    self.assertEqual(option["keys"]["tracker"], False if answer == "none" else answer)
                if sheet["question"] == "surfaces":
                    self.assertEqual(option["keys"]["surfaces"], answer)
                label_value = "false" if sheet["question"] == "tracker" and answer == "none" else str(answer)
                if sheet["question"] != "colours":
                    self.assertIn(label_value, option["label"])
        labels = [o["label"] for o in sheets["palettes"]["options"]]
        self.assertIn('identity: { primary: "#0B6E4F", accent: "#F2A900" }', labels, "brand colours get their own tile")
        self.assertIn('palette: "crimson"', labels)
        self.assertIn('design: "keynote"', [o["label"] for o in sheets["design-systems"]["options"]])

    def test_every_option_deck_composes(self):
        result = run_node('''
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { sheetPlan, optionDeck } from './skills/professional-slides/runtime/design-options.mjs';
const failures = [];
for (const sheet of sheetPlan({ design: 'editorial', brand: { primary: '#0B6E4F' }, wordmark: 'Acme' }))
  for (const option of sheet.options) {
    try { composeAll(optionDeck(option.answers), './skills/professional-slides/runtime'); } catch (e) { failures.push(`${sheet.id} ${option.label}: ${e.message}`); }
  }
console.log(JSON.stringify(failures));
''')
        self.assertEqual(result, [])

    def test_the_prerendered_sheets_ship_and_match_the_plan(self):
        folder = SKILL / "assets" / "design-options"
        for sheet in SHEETS:
            png = folder / f"{sheet}.png"
            self.assertTrue(png.is_file(), png)
            self.assertLess(png.stat().st_size, 450_000, f"{sheet}.png is too heavy for the package")
        index = json.loads((folder / "options.json").read_text())
        plan = run_node('''
import { sheetPlan } from './skills/professional-slides/runtime/design-options.mjs';
console.log(JSON.stringify(sheetPlan().map((s) => [s.id + '.png', s.options.map((o) => o.label)])));
''')
        self.assertEqual([[s["sheet"], [o["label"] for o in s["options"]]] for s in index["sheets"]], plan,
                         "assets/design-options is stale: rerun node runtime/design-options.mjs assets/design-options")
        self.assertFalse((SKILL / "assets" / "design-systems.png").exists(), "the old single sheet is replaced")


@unittest.skipUnless(NODE and HAS_RENDERER and HAS_PPTX and HAS_PILLOW, "needs LibreOffice, pdftoppm, python-pptx and Pillow")
class OptionSheetRenderTests(unittest.TestCase):
    def test_the_cli_renders_labelled_sheets_with_brand_colours(self):
        out = Path(tempfile.mkdtemp())
        python = RUNTIME_PYTHON or sys.executable
        subprocess.run([NODE, str(RUNTIME / "design-options.mjs"), str(out), "--only", "surfaces", "--brand", "#0B6E4F,#F2A900", "--python", python],
                       check=True, capture_output=True, cwd=ROOT, timeout=600)
        self.assertTrue((out / "surfaces.png").is_file())
        self.assertFalse((out / "trackers.png").exists())
        index = json.loads((out / "options.json").read_text())
        self.assertEqual([o["label"] for o in index["sheets"][0]["options"]], ['surfaces: "reference"', 'surfaces: "open"'])
        self.assertEqual(index["sheets"][0]["options"][0]["deckKeys"]["identity"]["primary"], "#0B6E4F")
        probe = subprocess.run([python, "-c", f"from PIL import Image; im = Image.open({str(out / 'surfaces.png')!r}); print(im.size[0], im.size[1], im.mode)"],
                               capture_output=True, text=True, check=True)
        width, height, mode = probe.stdout.split()
        self.assertGreater(int(width), 1200)
        self.assertGreater(int(height), 800)
        self.assertEqual(mode, "P", "saved as a 256-colour PNG")


@requires_python_package("PIL", "numpy")
class PixelToolTests(unittest.TestCase):
    """contact_sheet.py keeps flat colours exact; infer-style.py reads a page."""

    def python(self, source: str) -> str:
        return subprocess.run([RUNTIME_PYTHON or sys.executable, "-c", source], capture_output=True, text=True, check=True, cwd=ROOT).stdout

    def test_the_256_colour_sheet_keeps_a_small_accent_exact(self):
        out = self.python(f'''
import sys; sys.path.insert(0, {str(RUNTIME / "emit")!r})
from contact_sheet import reduce
from PIL import Image, ImageDraw
im = Image.new("RGB", (800, 400), "#FFFFFF")
d = ImageDraw.Draw(im)
for i in range(300):  # a spread of greys, as anti-aliased type makes
    d.line([(0, i + 50), (800, i + 50)], fill=(i % 250, i % 250, i % 250))
d.rectangle([10, 10, 40, 20], fill="#2251FF")
d.rectangle([60, 10, 90, 20], fill="#CC0000")
r = reduce(im).convert("RGB")
print(r.getpixel((20, 15)), r.getpixel((70, 15)))
''')
        self.assertEqual(out.strip(), "(34, 81, 255) (204, 0, 0)")

    def test_a_screenshot_yields_its_colours_and_title_treatment(self):
        folder = Path(tempfile.mkdtemp())
        self.python(f'''
from PIL import Image, ImageDraw
for n in range(3):
    im = Image.new("RGB", (1280, 720), "#FFFFFF")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 1280, 110], fill="#2B2D6E")      # title block
    d.rectangle([60, 300, 400, 600], fill="#2B2D6E")    # a bar
    d.rectangle([460, 400, 800, 600], fill="#D1452B")   # the accent bar
    im.save({str(folder)!r} + f"/page{{n}}.png")
''')
        result = json.loads(subprocess.run([RUNTIME_PYTHON or sys.executable, str(RUNTIME / "infer-style.py"), *[str(folder / f"page{n}.png") for n in range(3)]],
                                           capture_output=True, text=True, check=True, cwd=ROOT).stdout)
        self.assertEqual(result["canvas"], "#FCFCFC")
        self.assertEqual(result["suggested"]["titleRule"], "block")
        primary, accent = result["suggested"]["brand"]["primary"], result["suggested"]["brand"]["accent"]
        self.assertLess(sum(abs(int(primary[i:i + 2], 16) - int("2B2D6E"[i - 1:i + 1], 16)) for i in (1, 3, 5)), 24)
        self.assertLess(sum(abs(int(accent[i:i + 2], 16) - int("D1452B"[i - 1:i + 1], 16)) for i in (1, 3, 5)), 24)
        self.assertIn("tracker", result["notInferred"])


    def test_the_title_rule_is_read_by_one_detector(self):
        # The style inference and the census each had a title-rule detector,
        # and they disagreed on what a rule under a title is. A rule under the
        # title reads as one; a rule under an exhibit heading further down,
        # with the heading between it and the title, does not.
        out = self.python(f'''
import importlib.util, sys
from PIL import Image, ImageDraw
spec = importlib.util.spec_from_file_location("infer_style", {str(RUNTIME / "infer-style.py")!r})
infer = importlib.util.module_from_spec(spec); spec.loader.exec_module(infer)
sys.path.insert(0, {str(ROOT / "evals" / "scripts")!r})
import reference_census
def page(heading):
    im = Image.new("RGB", (1280, 720), "#FFFFFF")
    d = ImageDraw.Draw(im)
    for y in (50, 80):
        d.rectangle([60, y, 900, y + 18], fill="#222222")   # two lines of title
    if heading:
        d.rectangle([60, 140, 400, 152], fill="#222222")    # an exhibit heading
    d.line([(60, 170 if heading else 112), (1220, 170 if heading else 112)], fill="#222222", width=2)
    return im
import numpy as np
census = [reference_census.title_rule(np.asarray(page(h).resize((1200, 675)).convert("L"))) for h in (False, True)]
print(infer.title_treatment(page(False).resize((640, 360)), (255, 255, 255)), infer.title_treatment(page(True).resize((640, 360)), (255, 255, 255)), *census)
''')
        self.assertEqual(out.split(), ["rule", "None", "True", "False"])


if __name__ == "__main__":
    unittest.main()
