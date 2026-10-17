"""National flags named by country, and drawn illustrations beside the copy.

A device audit of sampled consulting pages found flags beside a country's bar
or table row ten times, and drawn illustrations beside the copy nine times.
The runtime drew a supplied image in either place, but had no flag source -
every flag file was found by hand - and the picture fetch found photographs
and logos only. A page now names a country (`flag: "France"`, "FR", "FRA")
wherever a mark beside a label takes an image, and plans a picture as
`kind: "illustration"`; the compile resolves and refuses, the build fetches
(test_fetch.py), and the composer draws a flag at its own proportions with a
hairline and an illustration whole in its frame.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from node_probe import run_node  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skills/professional-slides/runtime/gates"))
import page_gates  # noqa: E402

# The worked flag page and the worked illustration page, as --example prints them.
WORKED = """
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { compileDeck, composeForAuthoring, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
const EXAMPLES = './skills/professional-slides/examples';
const worked = (id) => structuredClone(workedExamples().pages.find((p) => p.id === id));
const refusal = (page) => { try { compilePage(page, 0); return null; } catch (error) { return error.message; } };
// The page composed as the only page of a deck, its pictures read from `dir` as the build reads them: its own slide's nodes.
const composed = async (page, dir = EXAMPLES) => {
  const { spec, compileErrors } = compileDeck({ deck: { ...workedExamples().deck, workflow: undefined, rulesVersion: undefined, cover: undefined }, pages: [page] }, { partial: true });
  if (compileErrors.length) throw new Error(compileErrors.join('; '));
  const out = await composeForAuthoring(spec, dir);
  if (out.error || out.pageErrors.length) throw new Error(out.error ?? out.pageErrors.join('; '));
  return out.deck.slides.find((s) => s.id === page.id).nodes;
};
const table = (rows, columns = ['Railway', 'Off-peak share']) => ({ ...worked('f-ranking-flags'), id: 't', type: 'lookup', form: 'table', commentary: 'none',
  title: 'Every railway above 40% off-peak runs a half-hourly regional timetable', exhibit: { columns, rows } });
"""


class CountryNameTests(unittest.TestCase):
    def test_a_country_is_read_by_its_name_another_name_or_its_iso_code(self):
        result = run_node('''
import { flagCountry, flagAlt, flagCommonsTitle, flagFile, unknownFlag } from './skills/professional-slides/runtime/flags.mjs';
import { NATURAL_EARTH_COUNTRIES } from './skills/professional-slides/runtime/natural-earth-map-data.mjs';
const id = (name) => flagCountry(name)?.id ?? null;
const unplaced = NATURAL_EARTH_COUNTRIES.filter((c) => !flagCountry(c.name)).map((c) => c.name).sort();
const fr = flagCountry('fr');
console.log(JSON.stringify({ ids: ['France', 'FR', 'fra', 'the Netherlands', 'Holland', "Côte d’Ivoire", 'Ivory Coast', 'UK', 'Czechia', 'Türkiye', 'Korea', 'GB-SCT', 'EU'].map(id),
  none: ['Atlantis', '', 'F', null, 7].map(id), unplaced, france: [fr.name, flagAlt(fr), flagCommonsTitle(fr), flagFile(fr)], netherlands: flagAlt(flagCountry('NLD')),
  near: ['Frnace', 'Netherland', 'Korea Rep'].map(unknownFlag) }));
''')
        self.assertEqual(result["ids"], ["FRA", "FRA", "FRA", "NLD", "NLD", "CIV", "CIV", "GBR", "CZE", "TUR", "KOR", "GB-SCT", "EU"])
        self.assertEqual(result["none"], [None] * 5)
        # Every country the maps draw has its flag, but the places with no flag of their own.
        self.assertEqual(result["unplaced"], ["Antarctica", "Falkland Islands", "French Southern and Antarctic Lands", "New Caledonia", "Northern Cyprus", "Somaliland", "Western Sahara"])
        self.assertEqual(result["france"], ["France", "Flag of France", "File:Flag of France.svg", "assets/flags/fra.png"])
        self.assertEqual(result["netherlands"], "Flag of the Netherlands")
        self.assertTrue(result["near"][0].startswith('no country is named "Frnace"; the nearest are France,'))
        self.assertTrue(result["near"][1].startswith('no country is named "Netherland"; the nearest are Netherlands,'))
        self.assertIn("the nearest are South Korea, North Korea", result["near"][2])
        self.assertIn('Write the country\'s name ("France") or its ISO code ("FR" or "FRA")', result["near"][0])


class FlagCompileTests(unittest.TestCase):
    def test_the_compile_plans_each_flag_where_a_mark_takes_an_image(self):
        result = run_node(WORKED + '''
const chart = compilePage(worked('f-ranking-flags'), 0).exhibit.categoryIcons;
const lookup = compilePage(table([[{ flag: 'Japan', text: 'Japan' }, '44%'], [{ type: 'logo', flag: 'POL' }, '26%'], [{ type: 'logo', media: { flag: 'de' } }, '35%']],
  ['Railway', { label: 'Austria', flag: 'AT' }]), 0).exhibit;
console.log(JSON.stringify({ chart: [chart.Switzerland, chart.Netherlands], cells: lookup.rows.map((row) => row[0]), column: lookup.columns[1] }));
''')
        self.assertEqual(result["chart"], [{"image": {"flag": "CHE", "alt": "Flag of Switzerland"}}, {"image": {"flag": "NLD", "alt": "Flag of the Netherlands"}}])
        self.assertEqual(result["cells"], [{"text": "Japan", "type": "logo", "media": {"flag": "JPN", "alt": "Flag of Japan"}},
                                           {"type": "logo", "media": {"flag": "POL", "alt": "Flag of Poland"}},
                                           {"type": "logo", "media": {"flag": "DEU", "alt": "Flag of Germany"}}])
        self.assertEqual(result["column"], {"label": "Austria", "logo": {"flag": "AUT", "alt": "Flag of Austria"}})

    def test_a_flag_that_cannot_be_placed_is_refused_with_what_to_write(self):
        result = run_node(WORKED + '''
const page = worked('f-ranking-flags');
const misspelt = structuredClone(page); misspelt.exhibit.categoryIcons.France = { flag: 'Frnace' };
const coded = structuredClone(page); coded.exhibit.categoryIcons.France = { flag: 250 };
const photo = { ...worked('f-picture-illustration'), pictures: [{ flag: 'France' }] };
console.log(JSON.stringify({ misspelt: refusal(misspelt), coded: refusal(coded), photo: refusal(photo),
  pill: refusal(table([[{ type: 'rag', value: 'on-track', flag: 'France', text: 'France' }, '31%']])) }));
''')
        self.assertIn('the category mark of "France" - no country is named "Frnace"; the nearest are France', result["misspelt"])
        self.assertIn("`flag` is a country's name or its ISO code, a string", result["coded"])
        self.assertIn("`flag` is not read on `0` - a flag is a mark beside a label: a chart's `categoryIcons` entry, a table cell", result["photo"])
        self.assertIn('a table cell with a `flag` is a logo cell, the flag before its `text`; this one says type "rag"', result["pill"])

    def test_a_picture_is_a_photograph_or_an_illustration_and_an_illustration_is_never_a_mark(self):
        result = run_node(WORKED + '''
const page = worked('f-picture-illustration');
const unknown = structuredClone(page); unknown.pictures[0].kind = 'drawing';
const marked = worked('f-ranking-flags'); marked.exhibit.categoryIcons.France = { image: { alt: 'A drawn train', kind: 'illustration' } };
console.log(JSON.stringify({ ok: refusal(page), photograph: refusal({ ...page, pictures: [{ ...page.pictures[0], kind: 'photograph' }] }), unknown: refusal(unknown), marked: refusal(marked) }));
''')
        self.assertIsNone(result["ok"])
        self.assertIsNone(result["photograph"])
        self.assertIn('the picture under `photo` says kind "drawing"; a picture\'s `kind` is "photograph"', result["unknown"])
        self.assertIn("an illustration is a picture beside the copy", result["marked"])


class FlagDrawingTests(unittest.TestCase):
    def test_chart_flags_stand_level_at_their_own_proportions_with_a_hairline(self):
        """A logo's 64px slot and area rule made a 2:3 flag a 24px speck far from its bar, and a white flag had no edge."""
        result = run_node(WORKED + '''
const nodes = await composed(worked('f-ranking-flags'));
const flags = nodes.filter((n) => n.role === 'category-logo');
const labels = nodes.filter((n) => n.role === 'category-label');
const bars = nodes.filter((n) => n.role === 'chart-mark');
console.log(JSON.stringify({ flags: flags.map((n) => [n.data.flag, Math.round(n.frame.height * 10) / 10, Math.round(n.frame.width / n.frame.height * 100) / 100, n.style.stroke?.tokenId ?? null, n.data.authorization]),
  rightEdge: [...new Set(flags.map((n) => Math.round(n.frame.x + n.frame.width)))], clearOfLabels: flags.every((f) => labels.every((l) => l.frame.x + l.frame.width <= f.frame.x + 0.5)),
  clearOfBars: flags.every((f) => f.frame.x + f.frame.width <= Math.min(...bars.map((b) => b.frame.x))) }));
''')
        heights = {flag[1] for flag in result["flags"]}
        self.assertEqual(len(heights), 1)  # every flag the same height
        aspects = {flag[0]: flag[2] for flag in result["flags"]}
        self.assertEqual(aspects["CHE"], 1.0)   # Switzerland square
        self.assertEqual(aspects["DEU"], 1.67)  # Germany 3:5
        self.assertEqual(aspects["FRA"], 1.5)   # France 2:3
        self.assertEqual({flag[3] for flag in result["flags"]}, {"color.rule"})  # each with its hairline
        self.assertTrue(all(flag[4] for flag in result["flags"]))  # and its credit
        self.assertEqual(len(result["rightEdge"]), 1)  # set against the bar
        self.assertTrue(result["clearOfLabels"])
        self.assertTrue(result["clearOfBars"])

    def test_a_row_led_by_its_flag_starts_its_names_level(self):
        result = run_node(WORKED + '''
const nodes = await composed(table([[{ flag: 'Switzerland', text: 'Switzerland' }, '47%'], [{ flag: 'Germany', text: 'Germany' }, '35%'], [{ flag: 'France' }, '31%']]));
const marks = nodes.filter((n) => n.role === 'table-logo'), names = nodes.filter((n) => n.role === 'table-cell-text' && /^[A-Z][a-z]/.test(n.text));
console.log(JSON.stringify({ marks: marks.map((n) => [n.data.flag, Math.round(n.frame.width), Math.round(n.frame.height), Boolean(n.style.stroke)]), starts: names.map((n) => n.frame.x) }));
''')
        che, deu, fra = result["marks"]
        self.assertEqual(che[1], che[2])        # square, at the line's height
        self.assertLess(deu[2], 21)             # a 3:5 flag narrowed to the 2:3 slot
        self.assertEqual(fra[2], 24)            # a flag alone stands the height its column shares
        self.assertTrue(all(mark[3] for mark in result["marks"]))
        self.assertEqual(len(set(result["starts"])), 1)  # the names start level

    def test_a_flag_still_to_come_keeps_a_flag_shaped_slot_the_picture_gate_holds(self):
        result = run_node(WORKED + '''
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'no-flags-'));
const chart = (await composed(worked('f-ranking-flags'), empty)).filter((n) => /logo/.test(n.role));
const cells = (await composed(table([[{ flag: 'France', text: 'France' }, '31%'], [{ flag: 'Japan' }, '44%'], [{ flag: 'Poland', text: 'Poland' }, '26%']],
  ['Railway', { label: 'Austria', flag: 'Austria' }]), empty)).filter((n) => /logo/.test(n.role));
console.log(JSON.stringify({ chart: chart.map((n) => [n.role, Math.round(n.frame.width / n.frame.height * 100) / 100, n.data.flag, Boolean(n.style.stroke)]),
  cells: cells.map((n) => [n.role, n.data.alt]), nodes: [...chart, ...cells] }));
''')
        self.assertEqual({tuple(n) for n in result["chart"]}, {("category-logo-placeholder", 1.5, flag, True) for flag in ["CHE", "JPN", "AUT", "NLD", "DNK", "DEU", "FRA", "POL"]})
        self.assertEqual(result["cells"], [["table-header-logo-placeholder", "Flag of Austria"], ["table-logo-placeholder", "Flag of France"],
                                           ["table-logo-placeholder", "Flag of Japan"], ["table-logo-placeholder", "Flag of Poland"]])
        findings = []
        page_gates.gate_unsourced_picture(1, {"nodes": result["nodes"]}, findings)
        self.assertEqual([(f["code"], f["measured"]) for f in findings], [("UNSOURCED_PICTURE", 12)])


class IllustrationDrawingTests(unittest.TestCase):
    def test_an_illustration_is_drawn_whole_where_a_photograph_is_cropped(self):
        result = run_node(WORKED + '''
const page = worked('f-picture-illustration');
const drawn = (await composed(page)).find((n) => n.type === 'image');
const photo = (await composed({ ...page, pictures: [{ ...page.pictures[0], kind: undefined }] })).find((n) => n.type === 'image');
console.log(JSON.stringify({ drawn: [drawn.data.fit ?? 'contain', Math.round(drawn.frame.width / drawn.frame.height * 100) / 100, drawn.data.width / drawn.data.height],
  photo: [photo.data.fit, Boolean(photo.data.crop)] }));
''')
        self.assertEqual(result["drawn"], ["contain", 1.25, 1.25])  # the frame takes the drawing's own proportions
        self.assertEqual(result["photo"], ["cover", True])


class OfflineNeedTests(unittest.TestCase):
    def test_an_offline_deck_is_told_which_flag_and_illustration_files_to_supply(self):
        result = run_node('''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { assetNeeds, assetFindings, assetNotice, assetsPrompt, assetReport } from './skills/professional-slides/runtime/asset-needs.mjs';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-'));
const spec = { assets: { fetch: 'none', reason: 'The build machine has no network access and nothing was supplied' }, slides: [
  { id: 'p1', exhibit: { categoryIcons: { France: { image: { flag: 'FRA', alt: 'Flag of France' } }, Japan: { image: { flag: 'JPN', alt: 'Flag of Japan' } } } } },
  { id: 'p2', exhibit: { rows: [[{ type: 'logo', media: { flag: 'FRA', alt: 'Flag of France' }, text: 'France' }]] } },
  { id: 'p3', photo: { alt: 'Passengers on a platform', kind: 'illustration' } }] };
const needs = await assetNeeds(spec, dir);
const offline = await assetFindings(spec, dir);
const online = await assetFindings({ ...spec, assets: undefined }, dir);
fs.mkdirSync(path.join(dir, 'assets', 'flags'), { recursive: true }); fs.writeFileSync(path.join(dir, 'assets', 'flags', 'jpn.png'), 'png');
const supplied = await assetNeeds(spec, dir);
console.log(JSON.stringify({ needs, repair: offline.findings[0].repair, notice: assetNotice(offline.statement), online: online.statement.choices, supplied: supplied.flags,
  prompt: assetsPrompt(await assetReport(spec, dir)) }));
''')
        self.assertEqual(result["needs"]["flags"], [{"country": "France", "file": "assets/flags/fra.png"}, {"country": "Japan", "file": "assets/flags/jpn.png"}])
        self.assertEqual(result["needs"]["illustrations"], [{"alt": "Passengers on a platform", "file": "assets/pictures/passengers-on-a-platform.png"}])
        self.assertEqual(result["needs"]["pictures"], [])
        for said in ["2 flags (France, Japan), 1 illustration will not be available", "each flag as a PNG at assets/flags/fra.png, assets/flags/jpn.png",
                     "each illustration as a PNG at assets/pictures/passengers-on-a-platform.png", "keep empty slots, which the render refuses (`UNSOURCED_PICTURE`)"]:
            self.assertIn(said, result["repair"])
        self.assertIn("flags: France, Japan | illustrations: Passengers on a platform", result["notice"])
        self.assertIn("a planned illustration stays an empty frame", result["online"][2])
        self.assertIn("a planned flag keeps an empty flag-shaped slot", result["online"][2])
        self.assertEqual(result["supplied"], [{"country": "France", "file": "assets/flags/fra.png"}])
        self.assertIn("the flags of France; 1 planned illustration", result["prompt"])


if __name__ == "__main__":
    unittest.main()
