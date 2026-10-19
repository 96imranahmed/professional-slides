"""The fetchers, run offline: logos (fetch-logos.mjs), flags (fetch-flags.mjs),
photographs and illustrations (fetch-pictures.mjs), places (fetch-places.mjs)
and data series (fetch-series.mjs).

Each fetcher's choice and fill is tested on recorded inputs and a local cache,
so the suite never reaches the network. The flag and illustration fetchers take
the network as an argument: a test hands them one that records each request and
answers it from fixtures.
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


class PictureFetchTests(unittest.TestCase):
    def test_commons_choice_keeps_free_landscape_photographs(self):
        """62-page deck: a Commons search must keep free, landscape photographs and carry their credit."""
        result = run_node('''
import { commonsCandidates, choiceOf, picturePlaceholders } from './skills/professional-slides/runtime/fetch-pictures.mjs';
const page = (index, title, license, { mime = 'image/jpeg', width = 2400, height = 1600 } = {}) => ({ index, title, imageinfo: [{ mime, width, height, thumburl: 'u' + index, descriptionurl: 'd' + index, extmetadata: { LicenseShortName: { value: license }, Artist: { value: '<a href="x">Jo Bloggs</a>' } } }] });
const pages = [page(1, 'File:Route map.jpg', 'CC BY 4.0'), page(2, 'File:Cabin.jpg', 'CC BY-NC 2.0'), page(3, 'File:Tail.png', 'CC0', { mime: 'image/png' }),
  page(4, 'File:Tall.jpg', 'CC BY-SA 4.0', { width: 1600, height: 2400 }), page(5, 'File:Small.jpg', 'CC0', { width: 800 }), page(6, 'File:Aircraft at LHR.jpg', 'CC BY 4.0')];
const spec = { cover: { image: { alt: 'A 787 on approach', search: 'Riyadh Air 787' } }, players: [{ name: 'X', logo: { alt: 'X logo' } }], slides: [{ photo: { alt: 'Client site', fetch: false } }, { photo: { alt: 'Done', path: 'a.jpg' } },
  { exhibit: { categoryIcons: { Emirates: { image: { alt: 'Emirates tail fin' } } } } }, { exhibit: { rows: [[{ type: 'logo', media: { alt: 'Northwind mark' } }]] } }] };
console.log(JSON.stringify({ candidates: commonsCandidates(pages).map((c) => c.title), choice: choiceOf(commonsCandidates(pages)), none: choiceOf(commonsCandidates(pages.slice(1, 3))),
  wanted: picturePlaceholders(spec).map(p => p.alt) }));
''')
        # A non-commercial licence, a PNG and a file under 1200px are never candidates; landscape before portrait.
        self.assertEqual(result['candidates'], ['File:Route map.jpg', 'File:Aircraft at LHR.jpg', 'File:Tall.jpg'])
        self.assertEqual(result['choice']['title'], 'File:Route map.jpg')  # the first ranked; the writer sees on the render whether it fits
        self.assertEqual(result['choice']['credit'], 'Photo: Jo Bloggs, CC BY 4.0, via Wikimedia Commons: d1')  # the source page travels with the credit
        self.assertIsNone(result['none'])  # no free landscape photograph among them
        # A logo is planned where the deck plans one - a `logo` key, a logo cell, a chart's category marks - not by its alt's last word.
        self.assertEqual(result['wanted'], ['A 787 on approach'])


class PictureChoiceTests(unittest.TestCase):
    def test_a_photograph_is_used_once_current_and_of_the_place_it_names(self):
        """Hundred-page deck: one photograph fetched for two pages, an aircraft in a livery retired years before, and an
        Istanbul lounge that was at the old airport. The dry run named other photographs than the fetch took."""
        result = run_node('''
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
const { chosen } = await choosePictures(plan, { search });
const held = await choosePictures([plan[1]], { search, records: new Map([['other', { alt: 'other', title: 'File:BA 787 2023.jpg' }]]) });
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


# A network a test answers: every request recorded, each answered by the first rule whose text its URL contains, any
# other with a 404. A body is a parsed answer (`json`) or bytes (`arrayBuffer`).
NETWORK = """
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, arrayBuffer: async () => body });
const network = (rules, requests = []) => Object.assign(async (url) => { requests.push(String(url));
  for (const [match, answer] of rules) if (String(url).includes(match)) return answer; return reply({}, 404); }, { requests });
const PNG = fs.readFileSync('./skills/professional-slides/examples/assets/flags/fra.png');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-'));
// What Commons answers for one file, as the API's formatversion 2 sets it out.
const commonsFile = (title, { license = 'Public domain', mime = 'image/svg+xml', missing = false, index = 1, thumb = 'https://upload.wikimedia.org/thumb/330px-render.png' } = {}) =>
  missing ? { ns: 6, title, missing: true } : { ns: 6, index, title, imageinfo: [{ width: 900, height: 600, mime, thumburl: thumb, url: 'https://upload.wikimedia.org/original.svg',
    descriptionurl: 'https://commons.wikimedia.org/wiki/' + title.replace(/ /g, '_'),
    extmetadata: { ...(license ? { LicenseShortName: { value: license } } : {}), Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Drawer">A. Drawer</a>' } } }] };
const answer = (...pages) => ({ batchcomplete: true, query: { pages } });
"""


class FlagFetchTests(unittest.TestCase):
    def test_a_flag_is_the_commons_file_named_for_its_country_rendered_and_recorded(self):
        """Ten sampled pages set a flag beside a country's bar or row, and every flag file had to be found by hand."""
        result = run_node(NETWORK + '''
import { flagRequest, flagRecord, autoFillFlags, FLAG_WIDTH } from './skills/professional-slides/runtime/fetch-flags.mjs';
import { flagCountry } from './skills/professional-slides/runtime/flags.mjs';
const asked = (country) => Object.fromEntries(new URL(flagRequest(flagCountry(country))).searchParams);
const france = answer(commonsFile('File:Flag of France.svg'));
const net = network([['api.php', reply(france)], ['330px-render.png', reply(PNG)]]);
const dir = tmp();
const spec = { slides: [{ exhibit: { categoryIcons: { France: { image: { flag: 'FRA', alt: 'Flag of France' } } } } },
  { exhibit: { rows: [[{ type: 'logo', media: { flag: 'FRA', alt: 'Flag of France' }, text: 'France' }]] } }] };
const filled = await autoFillFlags(spec, dir, { fetch: net });
const saved = fs.readFileSync(path.join(dir, 'assets', 'flags', 'fra.png'));
const records = JSON.parse(fs.readFileSync(path.join(dir, 'assets', 'flags', 'sources.json'), 'utf8'));
// The file on disk is used again without the network, with the credit its record keeps.
const again = { slides: [{ exhibit: { categoryIcons: { France: { image: { flag: 'FRA', alt: 'Flag of France' } } } } }] };
const offline = network([]);
const reused = await autoFillFlags(again, dir, { fetch: offline });
console.log(JSON.stringify({ width: FLAG_WIDTH, france: asked('France'), netherlands: asked('NL').titles, china: asked('CHN').titles,
  record: flagRecord(france, flagCountry('France')), filled, requests: net.requests.length, same: saved.equals(PNG), records,
  refs: [spec.slides[0].exhibit.categoryIcons.France.image, spec.slides[1].exhibit.rows[0][0].media], reused, offline: offline.requests, again: again.slides[0].exhibit.categoryIcons.France.image }));
''')
        self.assertEqual(result["france"]["titles"], "File:Flag of France.svg")
        self.assertEqual(result["france"]["iiurlwidth"], str(result["width"]))  # rendered to a PNG at one fixed width
        self.assertEqual(result["france"]["redirects"], "1")
        self.assertIn("LicenseShortName", result["france"]["iiextmetadatafilter"])
        self.assertEqual(result["netherlands"], "File:Flag of the Netherlands.svg")
        self.assertEqual(result["china"], "File:Flag of the People's Republic of China.svg")
        credit = "Flag: A. Drawer, Public domain, via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Flag_of_France.svg"
        self.assertEqual(result["record"]["credit"], credit)
        self.assertEqual(result["record"]["source"], "https://upload.wikimedia.org/thumb/330px-render.png")
        # One country planned twice is one request for its record and one for its rendering, saved once.
        self.assertEqual(result["filled"], {"filled": 2, "fetched": ["France"], "failed": []})
        self.assertEqual(result["requests"], 2)
        self.assertTrue(result["same"])
        self.assertEqual([(r["flag"], r["license"], r["credit"], r["saved"]) for r in result["records"]], [("FRA", "Public domain", credit, "assets/flags/fra.png")])
        for ref in result["refs"]:
            self.assertEqual((ref["path"], ref["credit"]), ("assets/flags/fra.png", credit))
        self.assertEqual(result["reused"], {"filled": 1, "fetched": [], "failed": []})
        self.assertEqual(result["offline"], [])
        self.assertEqual(result["again"]["credit"], credit)

    def test_a_flag_that_cannot_be_had_is_refused_with_why_and_keeps_its_slot(self):
        result = run_node(NETWORK + '''
import { autoFillFlags } from './skills/professional-slides/runtime/fetch-flags.mjs';
const run = async (rules, flag = 'FRA', options = {}) => {
  const dir = tmp(), spec = { slides: [{ exhibit: { categoryIcons: { X: { image: { flag, alt: 'Flag' } } } } }] }, net = network(rules);
  const out = await autoFillFlags(spec, dir, { fetch: net, ...options });
  return { failed: out.failed, path: spec.slides[0].exhibit.categoryIcons.X.image.path ?? null, saved: fs.existsSync(path.join(dir, 'assets', 'flags', 'fra.png')), requests: net.requests.length };
};
const png = ['330px-render.png', reply(PNG)];
console.log(JSON.stringify({
  unlicensed: await run([['api.php', reply(answer(commonsFile('File:Flag of France.svg', { license: null })))], png]),
  nonFree: await run([['api.php', reply(answer(commonsFile('File:Flag of France.svg', { license: 'CC BY-NC-SA 4.0' })))], png]),
  missing: await run([['api.php', reply(answer(commonsFile('File:Flag of France.svg', { missing: true })))], png]),
  apiDown: await run([['api.php', reply({}, 503)]]),
  downloadFailed: await run([['api.php', reply(answer(commonsFile('File:Flag of France.svg')))]]),
  notPng: await run([['api.php', reply(answer(commonsFile('File:Flag of France.svg')))], ['330px-render.png', reply(Buffer.from('<html>error</html>'))]]),
  unknown: await run([], 'Atlantis'),
  offline: await run([['api.php', reply(answer(commonsFile('File:Flag of France.svg')))], png], 'FRA', { fetchMissing: false }),
}));
''')
        said = {key: value["failed"] for key, value in result.items()}
        self.assertEqual(said["unlicensed"], ["France: Commons records no licence for File:Flag of France.svg, so the deck cannot say it may use it"])
        self.assertEqual(said["nonFree"], ["France: File:Flag of France.svg is under CC BY-NC-SA 4.0, which is not a free licence"])
        self.assertEqual(said["missing"], ["France: Commons has no File:Flag of France.svg"])
        self.assertEqual(said["apiDown"], ["France: Commons API 503"])
        self.assertEqual(said["downloadFailed"], ["France: download 404"])
        self.assertEqual(said["notPng"], ["France: the rendering of File:Flag of France.svg is not a PNG"])
        self.assertTrue(said["unknown"][0].startswith('Atlantis: no country is named "Atlantis"'))
        # Built offline nothing is asked and nothing is said to have failed: the compile names the file to supply.
        self.assertEqual(result["offline"], {"failed": [], "path": None, "saved": False, "requests": 0})
        for key in ("unlicensed", "nonFree", "missing", "apiDown", "downloadFailed", "notPng", "unknown"):
            self.assertEqual((result[key]["path"], result[key]["saved"]), (None, False), key)


class IllustrationFetchTests(unittest.TestCase):
    def test_an_illustration_is_searched_among_commons_drawings_and_recorded_as_one(self):
        """Nine sampled pages set a drawn illustration beside the copy, and the picture fetch found photographs and logos only."""
        result = run_node(NETWORK + '''
import { commonsSearchUrl, commonsCandidates, choiceOf, autoFillPictures, picturePlaceholders } from './skills/professional-slides/runtime/fetch-pictures.mjs';
const search = (kind) => new URL(commonsSearchUrl('passengers on a railway platform', kind)).searchParams.get('gsrsearch');
const pages = [commonsFile('File:Platform scene.svg', { index: 1 }), commonsFile('File:Platform photo.jpg', { index: 2, mime: 'image/jpeg' }),
  commonsFile('File:Station NC.svg', { index: 3, license: 'CC BY-NC 4.0' }), commonsFile('File:Train drawing.svg', { index: 4, license: 'CC BY-SA 4.0' })];
const drawn = commonsCandidates(pages, { kind: 'illustration' });
const chosen = choiceOf(drawn);
const dir = tmp();
const plan = () => ({ slides: [{ id: 'p1', photo: { alt: 'Passengers on a platform', search: 'railway platform', kind: 'illustration' } }] });
const spec = plan();
const net = network([['api.php', reply(answer(...pages))], ['330px-render.png', reply(PNG)]]);
const out = await autoFillPictures(spec, dir, { fetch: net });
const records = JSON.parse(fs.readFileSync(path.join(dir, 'assets', 'pictures', 'sources.json'), 'utf8'));
// The file on disk is used again without the network.
const again = plan(), offline = network([]);
const reused = await autoFillPictures(again, dir, { fetch: offline });
console.log(JSON.stringify({ searches: [search('illustration'), search('photograph')], drawn: drawn.map((c) => [c.title, c.kind, c.credit]), chosen: chosen?.title,
  out, photo: spec.slides[0].photo, saved: fs.readFileSync(path.join(dir, 'assets', 'pictures', 'passengers-on-a-platform.png')).equals(PNG), records,
  requests: net.requests.map((u) => u.includes('api.php') ? new URL(u).searchParams.get('gsrsearch') : u), reused, offline: offline.requests, again: again.slides[0].photo,
  placeholders: picturePlaceholders({ slides: [{ photo: { alt: 'A drawing', kind: 'illustration' } }, { exhibit: { categoryIcons: { France: { image: { flag: 'FRA', alt: 'Flag of France' } } } } }] }).map((p) => p.alt) }));
''')
        self.assertEqual(result["searches"], ["passengers on a railway platform filetype:drawing", "passengers on a railway platform filetype:bitmap"])
        # Drawings only - an SVG under a free licence - in search order, each credited as an illustration.
        self.assertEqual([d[:2] for d in result["drawn"]], [["File:Platform scene.svg", "illustration"], ["File:Train drawing.svg", "illustration"]])
        self.assertEqual(result["drawn"][1][2], "Illustration: A. Drawer, CC BY-SA 4.0, via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Train_drawing.svg")
        self.assertEqual(result["chosen"], "File:Platform scene.svg")  # the first in search order
        self.assertEqual(result["out"], {"filled": 1, "failed": []})
        photo = result["photo"]
        self.assertEqual(photo["path"], "assets/pictures/passengers-on-a-platform.png")
        self.assertTrue(photo["credit"].startswith("Illustration: A. Drawer, Public domain"), photo["credit"])
        self.assertEqual(photo["kind"], "illustration")  # kept: an illustration is drawn whole
        self.assertNotIn("search", photo)
        self.assertTrue(result["saved"])
        self.assertEqual([(r["alt"], r["kind"], r["title"], r["saved"]) for r in result["records"]],
                         [("Passengers on a platform", "illustration", "File:Platform scene.svg", "assets/pictures/passengers-on-a-platform.png")])
        self.assertEqual(result["requests"], ["railway platform filetype:drawing", "https://upload.wikimedia.org/thumb/330px-render.png"])
        self.assertEqual(result["reused"], {"filled": 1, "failed": []})
        self.assertEqual(result["offline"], [])
        self.assertEqual(result["again"]["credit"], photo["credit"])
        # A flag is a mark, never a photograph or an illustration to search for.
        self.assertEqual(result["placeholders"], ["A drawing"])

    def test_an_illustration_that_cannot_be_had_is_named_with_why(self):
        result = run_node(NETWORK + '''
import { autoFillPictures } from './skills/professional-slides/runtime/fetch-pictures.mjs';
const run = async (rules) => {
  const dir = tmp(), spec = { slides: [{ photo: { alt: 'Passengers on a platform', kind: 'illustration' } }] };
  const out = await autoFillPictures(spec, dir, { fetch: network(rules) });
  return { failed: out.failed, path: spec.slides[0].photo.path ?? null };
};
console.log(JSON.stringify({
  unlicensed: await run([['api.php', reply(answer(commonsFile('File:Platform.svg', { license: null })))]]),
  searchDown: await run([['api.php', reply({}, 500)]]),
  downloadFailed: await run([['api.php', reply(answer(commonsFile('File:Platform.svg')))]]),
  notPng: await run([['api.php', reply(answer(commonsFile('File:Platform.svg')))], ['330px-render.png', reply(Buffer.from('<svg/>'))]]),
}));
''')
        # An illustration is Commons' alone; the message names what was asked, where it looked, and what to do.
        self.assertIsNone(result["unlicensed"]["path"])
        self.assertRegex(result["unlicensed"]["failed"][0], r'^PICTURE_UNMATCHED: Passengers on a platform: no freely licensed illustration that matches "Passengers on a platform" in commons - set `search` to the words a drawing of it would be filed under')
        self.assertIsNone(result["searchDown"]["path"])
        self.assertIn("in commons (Commons API 500)", result["searchDown"]["failed"][0])
        self.assertEqual(result["downloadFailed"], {"failed": ["Passengers on a platform: download 404"], "path": None})
        self.assertEqual(result["notPng"], {"failed": ["Passengers on a platform: the rendering of File:Platform.svg is not a PNG"], "path": None})


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



class PictureLibraryTests(unittest.TestCase):
    def test_a_file_is_taken_only_where_it_names_what_the_search_asks_for(self):
        result = run_node('''
import { relevance, searchTerms, namedCandidates } from './skills/professional-slides/runtime/picture-providers.mjs';
const files = [{ title: 'File:M50-900 full flight simulator cockpit.jpg' }, { title: 'File:M50-900 of Example Air.jpg' },
  { title: 'File:Example Air, Z9-ABC, Maker M50-1041 (49588621913).jpg' }];
console.log(JSON.stringify({
  terms: searchTerms('Maker M50F first flight 2026'),
  model: namedCandidates(files, 'Maker M50F').map((f) => f.title),
  registration: namedCandidates(files, 'Example Air Z9-ABC Maker M50-1041').map((f) => f.title),
  spaced: relevance('Maker 300 8X rollout', 'Maker 300-8X').named,
  generic: relevance('Warehouse Shelving (8336053)', 'warehouse shelving').named,
}));
''')
        self.assertEqual(result["terms"]["identity"], ["m50f"], "a model is identifying; a year is not")
        self.assertEqual(result["model"], [], "a sibling model is not the model asked for")
        self.assertEqual(result["registration"], ["File:Example Air, Z9-ABC, Maker M50-1041 (49588621913).jpg"])
        self.assertTrue(result["spaced"])
        self.assertTrue(result["generic"])

    def test_the_libraries_are_searched_in_order_and_the_next_only_when_the_last_named_nothing(self):
        result = run_node('''
import { searchLibraries } from './skills/professional-slides/runtime/picture-providers.mjs';
const requests = [];
const fetch = async (url) => { requests.push(new URL(url).host); return { ok: true, json: async () => ({ results: [
  { title: 'Warehouse shelving', creator: 'A. Photographer', license: 'by', license_version: '2.0', license_url: 'https://creativecommons.org/licenses/by/2.0/',
    foreign_landing_url: 'https://flickr.com/x', url: 'https://live.staticflickr.com/x.jpg', width: 2048, height: 1365, tags: [{ name: 'warehouse' }, { name: 'shelving' }], filetype: 'jpg' }] }) }; };
const commons = async () => [{ title: 'File:Office desk.jpg', text: 'Office desk' }];
const found = await searchLibraries('warehouse shelving', { commons, fetch, keys: {} });
const first = await searchLibraries('warehouse shelving', { commons: async () => [{ title: 'File:Warehouse shelving.jpg', text: 'Warehouse shelving' }], fetch, keys: {} });
console.log(JSON.stringify({ provider: found[0]?.provider, credit: found[0]?.credit, tried: found.tried, requests, firstTried: first.tried }));
''')
        self.assertEqual(result["provider"], "openverse")
        self.assertEqual(result["credit"], "Photo: A. Photographer, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/), via Openverse: https://flickr.com/x")
        self.assertEqual(result["tried"], ["commons", "openverse"])
        self.assertEqual(result["firstTried"], ["commons"], "a search Commons answers costs one request")


class PictureKeyTests(unittest.TestCase):
    def test_a_key_is_read_from_its_variable_first_and_the_keys_file_is_the_users_alone(self):
        result = run_node('''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { pictureKeys, setPictureKey, keysPath, keyStatus } from './skills/professional-slides/runtime/picture-keys.mjs';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-keys-'));
const env = { PROFESSIONAL_SLIDES_HOME: home };
setPictureKey('pexels', 'from-file', env);
setPictureKey('unsplash', 'from-file-too', env);
const both = pictureKeys({ ...env, PEXELS_API_KEY: 'from-env' });
console.log(JSON.stringify({ pexels: both.pexels, unsplash: both.unsplash.from, status: keyStatus(env), mode: (fs.statSync(keysPath(env)).mode & 0o777).toString(8) }));
''')
        self.assertEqual(result["pexels"], {"key": "from-env", "from": "environment"})
        self.assertEqual(result["unsplash"], "keys file")
        self.assertEqual(result["status"], {"pexels": "keys file", "unsplash": "keys file", "pixabay": None})
        self.assertEqual(result["mode"], "600")


if __name__ == "__main__":
    unittest.main()
