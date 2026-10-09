"""The fetchers, run offline: logos (fetch-logos.mjs), photographs (fetch-pictures.mjs),
places (fetch-places.mjs) and data series (fetch-series.mjs).

Each fetcher's choice and fill is tested on recorded inputs and a local cache,
so the suite never reaches the network.
"""
import unittest

from node_probe import run_node


class LogoFetchTests(unittest.TestCase):
    def test_infobox_logo_and_placeholder_filling_offline(self):
        """62-page deck: six airlines compared and never introduced; their logos are read from the infobox and filled into every placeholder."""
        result = run_node('''
import { logoFileFrom, fillLogos } from './skills/professional-slides/runtime/fetch-logos.mjs';
const infobox = "{{Infobox airline\\n| airline = Emirates\\n| logo = Emirates logo.svg\\n| image = Emirates A380.jpg\\n}}";
const spec = { players: [{ name: 'Emirates', logo: { alt: 'Emirates logo' } }], slides: [{ exhibit: { categoryIcons: { Emirates: { image: { alt: 'Emirates logo' } } } } }] };
const filled = fillLogos(spec, [{ name: 'Emirates', path: '/deck/assets/logos/emirates.png', credit: 'Emirates logo, via Wikipedia' }], '/deck');
console.log(JSON.stringify({ file: logoFileFrom(infobox), photoOnly: logoFileFrom("| image = A380.jpg"), filled, path: spec.slides[0].exhibit.categoryIcons.Emirates.image.path }));
''')
        self.assertEqual(result['file'], 'Emirates logo.svg')
        self.assertIsNone(result['photoOnly'])
        self.assertEqual(result['filled'], 2)
        self.assertEqual(result['path'], 'assets/logos/emirates.png')


# Whether a candidate shows what a picture is planned to show is looked at (picture-shows): a test's reader answers by file.
READER = """
import { judgementSession, withJudgements } from './skills/professional-slides/runtime/judgements.mjs';
const asked = [];
const reader = (byFile, fallback = 'shows') => judgementSession({ oracle: (kind, q) => { asked.push(q); return kind === 'picture-shows' ? (byFile[q.file] === undefined ? fallback : byFile[q.file]) : null; } });
"""


class PictureFetchTests(unittest.TestCase):
    def test_commons_choice_keeps_free_landscape_photographs(self):
        """62-page deck: a Commons search must keep free, landscape photographs and carry their credit."""
        result = run_node(READER + '''
import { commonsCandidates, judgedChoice, picturePlaceholders } from './skills/professional-slides/runtime/fetch-pictures.mjs';
const page = (index, title, license, { mime = 'image/jpeg', width = 2400, height = 1600 } = {}) => ({ index, title, imageinfo: [{ mime, width, height, thumburl: 'u' + index, descriptionurl: 'd' + index, extmetadata: { LicenseShortName: { value: license }, Artist: { value: '<a href="x">Jo Bloggs</a>' } } }] });
const pages = [page(1, 'File:Route map.jpg', 'CC BY 4.0'), page(2, 'File:Cabin.jpg', 'CC BY-NC 2.0'), page(3, 'File:Tail.png', 'CC0', { mime: 'image/png' }),
  page(4, 'File:Tall.jpg', 'CC BY-SA 4.0', { width: 1600, height: 2400 }), page(5, 'File:Small.jpg', 'CC0', { width: 800 }), page(6, 'File:Aircraft at LHR.jpg', 'CC BY 4.0')];
const spec = { cover: { image: { alt: 'A 787 on approach', search: 'Riyadh Air 787' } }, players: [{ name: 'X', logo: { alt: 'X logo' } }], slides: [{ photo: { alt: 'Client site', fetch: false } }, { photo: { alt: 'Done', path: 'a.jpg' } },
  { exhibit: { categoryIcons: { Emirates: { image: { alt: 'Emirates tail fin' } } } } }, { exhibit: { rows: [[{ type: 'logo', media: { alt: 'Northwind mark' } }]] } }] };
const plan = { alt: 'A 787 on approach' };
const choose = (list) => withJudgements(reader({ 'File:Route map.jpg': 'not-a-photo' }), () => judgedChoice(commonsCandidates(list), plan));
console.log(JSON.stringify({ candidates: commonsCandidates(pages).map((c) => c.title), choice: (await choose(pages)).choice, none: (await choose(pages.slice(0, 3))).choice,
  wanted: picturePlaceholders(spec).map(p => p.alt) }));
''')
        # A non-commercial licence, a PNG and a file under 1200px are never candidates; landscape before portrait.
        self.assertEqual(result['candidates'], ['File:Route map.jpg', 'File:Aircraft at LHR.jpg', 'File:Tall.jpg'])
        self.assertEqual(result['choice']['title'], 'File:Aircraft at LHR.jpg')  # the map is looked at, and is not a photograph
        self.assertEqual(result['choice']['credit'], 'Photo: Jo Bloggs, CC BY 4.0, via Wikimedia Commons: d6')  # the source page travels with the credit
        self.assertIsNone(result['none'])
        # A logo is planned where the deck plans one - a `logo` key, a logo cell, a chart's category marks - not by its alt's last word.
        self.assertEqual(result['wanted'], ['A 787 on approach'])


class PictureSubjectTests(unittest.TestCase):
    def test_a_photograph_is_taken_for_what_it_shows_not_for_its_search_rank(self):
        """A search returns what matches its words: the first free landscape for "Park Avenue towers" can be a park."""
        result = run_node(READER + '''
import { commonsCandidates, judgedChoice, PREVIEWS_AT_ONCE } from './skills/professional-slides/runtime/fetch-pictures.mjs';
const page = (index, title, description, categories) => ({ index, title, imageinfo: [{ mime: 'image/jpeg', width: 2400, height: 1600, thumburl: 'u' + index, descriptionurl: 'd' + index,
  extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'Jo Bloggs' }, ImageDescription: { value: description }, Categories: { value: categories } } }] });
const pages = [page(1, 'File:Autumn in the park.jpg', 'Leaves on a path', 'Parks in Brooklyn'),
  page(2, 'File:Seagram Building.jpg', 'The tower on Park Avenue, Midtown', 'Office buildings in Manhattan|Park Avenue'),
  page(3, 'File:Skyline.jpg', 'Office towers in Midtown Manhattan', 'Skylines of Manhattan')];
const plan = { alt: 'Office towers on Park Avenue in Midtown Manhattan' };
const candidates = commonsCandidates(pages);
const chosen = await withJudgements(reader({ 'File:Autumn in the park.jpg': 'other-subject' }), () => judgedChoice(candidates, plan));
const none = await withJudgements(reader({}, 'other-subject'), () => judgedChoice(candidates, plan));
// Unanswered, the first candidate is fetched as a preview and asked about, and none after it is taken until it is answered.
const previews = [];
const open = judgementSession({ oracle: (kind, q) => (q.file === 'File:Seagram Building.jpg' ? 'shows' : null) });
const waiting = await withJudgements(open, () => judgedChoice(candidates, plan, { preview: async (c) => { previews.push(c.title); return '/tmp/' + c.page + '.jpg'; } }));
console.log(JSON.stringify({ chosen: chosen.choice?.title, question: asked[0], none: none.choice, waiting: { choice: waiting.choice, waiting: waiting.waiting, previews,
  pending: [...open.pending.values()].map((q) => [q.kind, q.subject.file, q.image, q.where]) }, atOnce: PREVIEWS_AT_ONCE }));
''')
        self.assertEqual(result["chosen"], "File:Seagram Building.jpg")
        self.assertEqual(result["question"], {"asked": "Office towers on Park Avenue in Midtown Manhattan", "file": "File:Autumn in the park.jpg", "description": "Leaves on a path"})
        self.assertIsNone(result["none"])                                  # a candidate of something else is not taken
        self.assertIsNone(result["waiting"]["choice"])
        self.assertEqual(result["waiting"]["previews"], ["File:Autumn in the park.jpg", "File:Skyline.jpg"])
        self.assertEqual(result["waiting"]["waiting"], 2)
        self.assertEqual(result["waiting"]["pending"], [["picture-shows", "File:Autumn in the park.jpg", "/tmp/d1.jpg", ["Office towers on Park Avenue in Midtown Manhattan"]],
                                                        ["picture-shows", "File:Skyline.jpg", "/tmp/d3.jpg", ["Office towers on Park Avenue in Midtown Manhattan"]]])


class PictureChoiceTests(unittest.TestCase):
    def test_a_photograph_is_used_once_current_and_of_the_place_it_names(self):
        """Hundred-page deck: one photograph fetched for two pages, an aircraft in a livery retired years before, and an
        Istanbul lounge that was at the old airport. The dry run named other photographs than the fetch took."""
        result = run_node(READER + '''
import { commonsCandidates, choosePictures } from './skills/professional-slides/runtime/fetch-pictures.mjs';
const page = (index, title, description, date) => ({ index, title, imageinfo: [{ mime: 'image/jpeg', width: 2400, height: 1600, thumburl: 'u' + index, descriptionurl: 'd' + index,
  extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'Jo Bloggs' }, ImageDescription: { value: description }, ...(date ? { DateTimeOriginal: { value: date } } : {}) } }] });
const jets = [page(1, 'File:BA 747 Landor.jpg', 'British Airways Boeing 747 at Heathrow', '1998:06:01'), page(2, 'File:BA 787 2023.jpg', 'British Airways Boeing 787 at Heathrow', '2023-04-11'),
  page(3, 'File:BA A350.jpg', 'British Airways Airbus A350 at Heathrow')];
const lounges = [page(1, 'File:Ataturk lounge.jpg', 'Turkish Airlines lounge, Istanbul Ataturk Airport', '2016'), page(2, 'File:IST lounge.jpg', 'Turkish Airlines lounge at Istanbul Airport', '2022')];
// A search that answers every query from one result list: what choosePictures passes it is what is checked.
const searched = [];
const search = async (query, options) => { searched.push({ query, exclude: [...options.exclude] }); return commonsCandidates(jets, options); };
const plan = [{ alt: 'A British Airways jet at Heathrow' }, { alt: 'British Airways aircraft at Heathrow', search: 'British Airways Heathrow' }];
const all = reader({});
const { chosen } = await withJudgements(all, () => choosePictures(plan, { search }));
const held = await withJudgements(all, () => choosePictures([plan[1]], { search, records: new Map([['other', { alt: 'other', title: 'File:BA 787 2023.jpg' }]]) }));
console.log(JSON.stringify({
  latest: commonsCandidates(jets)[0]?.title,
  after: commonsCandidates([jets[0], jets[2]], { after: 2015 }).map((c) => c.title),
  lounge: commonsCandidates(lounges, { without: ['Ataturk'] }).map((c) => c.title),
  once: plan.map((p) => chosen.get(p)?.title), excluded: searched.slice(0, 2).map((a) => a.exclude),
  records: held.chosen.get(plan[1])?.title,
}));
''')
        self.assertEqual(result["latest"], "File:BA 787 2023.jpg", "the latest dated is looked at first")
        self.assertEqual(result["after"], ["File:BA A350.jpg"], "a photograph dated before `after` is not a candidate")
        self.assertEqual(result["lounge"], ["File:IST lounge.jpg"], "nor one naming a word in `without`")
        self.assertEqual(len(set(result["once"])), 2, "two pictures of a deck never take one file")
        self.assertEqual(result["excluded"], [[], ["File:BA 787 2023.jpg"]])
        self.assertNotEqual(result["records"], "File:BA 787 2023.jpg", "a file another picture already holds is passed over")


class PlaceFetchTests(unittest.TestCase):
    def test_named_markers_are_placed_from_the_cache_offline(self):
        """62-page deck: map discs sat on country centres; named markers are placed from the places cache."""
        result = run_node('''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { autoFillPlaces, markersToPlace } from './skills/professional-slides/runtime/fetch-places.mjs';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'places-'));
fs.mkdirSync(path.join(dir, 'assets')); fs.writeFileSync(path.join(dir, 'assets', 'places.json'), JSON.stringify({ Riyadh: { latitude: 24.63, longitude: 46.72 } }));
const spec = { slides: [{ exhibit: { type: 'map', markers: [{ label: 'Riyadh' }, { label: 'India', country: 'IND', countryLevel: true }, { label: 'Warsaw', longitude: 21, latitude: 52.2 }, { label: 'Home', place: 'Riyadh' }, { label: 'Unknown town' }] } }] };
const wanted = markersToPlace(spec).map(w => w.name);
const out = await autoFillPlaces(spec, dir, { fetchMissing: false });
console.log(JSON.stringify({ wanted, out, markers: spec.slides[0].exhibit.markers }));
''')
        self.assertEqual(result['wanted'], ['Riyadh', 'Riyadh', 'Unknown town'])
        self.assertEqual(result['out']['placed'], 2)
        self.assertEqual(result['markers'][3], {'label': 'Home', 'longitude': 46.72, 'latitude': 24.63})
        self.assertNotIn('longitude', result['markers'][4])


class SeriesFetchTests(unittest.TestCase):
    def test_series_tables_carry_cagr_and_a_gapless_chart(self):
        """62-page deck: a fetched series table carries its CAGR and charts only the years every member has."""
        result = run_node('''
import { worldBankTable, owidTable, summarise } from './skills/professional-slides/runtime/fetch-series.mjs';
const row = (country, date, value) => ({ country: { value: country }, indicator: { value: 'Passengers' }, date: String(date), value });
const wb = summarise(worldBankTable([{}, [row('A', 2020, 100), row('A', 2022, 121), row('A', 2021, null), row('B', 2020, 50), row('B', 2021, 60), row('B', 2022, 70)]]), { provider: 'WB' });
const owid = owidTable('Entity,Code,Year,value\\n"Korea, South",KOR,2020,5\\nFrance,FRA,2020,9\\n', ['Korea, South']);
console.log(JSON.stringify({ series: wb.summary.series, chart: wb.summary.chart, csv: wb.csv, korea: [...owid.values.get('Korea, South').entries()] }));
''')
        self.assertEqual(result['series'][0]['cagr'], 10.0)
        self.assertEqual(result['chart']['categories'], ['2020', '2022'])  # 2021 is missing for A
        self.assertIn('2021,,60', result['csv'])
        self.assertEqual(result['korea'], [[2020, 5]])


if __name__ == "__main__":
    unittest.main()
