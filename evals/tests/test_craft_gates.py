"""Deck craft floors and the route map.

A 62-page deck shipped with eleven of sixteen charts plotting two numbers, no
table treated, no chart annotated, five step diagrams, no icons, six airlines
compared and never introduced, and a map whose 34px discs sat on country
centres with twelve countries filled. The floors read the built deck and
block; the map places cities, draws routes and crops to the network.
"""
import unittest

from node_probe import run_node


class CraftFloorTests(unittest.TestCase):
    def test_two_number_charts_steps_and_unintroduced_players_block(self):
        result = run_node('''
import { craftFindings, trivialChart, trendChart } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const pair = { type: 'chart.column', categories: ['A', 'B'], series: [{ name: 'Fleet', values: [30, 120] }] };
const trend = { type: 'chart.line', categories: ['2020','2021','2022','2023','2024'], series: [{ name: 'Revenue', values: [1,2,3,4,5] }] };
const page = (i, exhibit) => ({ id: 'p' + i, title: 'A finding on page ' + i, exhibit });
const slides = [...Array.from({ length: 8 }, (_, i) => page(i, pair)), ...Array.from({ length: 4 }, (_, i) => page(10 + i, { type: 'steps', steps: [] })), page(20, trend)];
const codes = (spec) => craftFindings(spec, { slides: [] }).filter(f => f.severity === 'blocker').map(f => f.code).sort();
console.log(JSON.stringify({
  pair: trivialChart(pair), trend: trivialChart(trend), isTrend: trendChart(trend),
  blocked: codes({ slides, players: ['One', 'Two', 'Three'] }),
  catalogue: codes({ slides, purpose: 'catalogue', players: ['One', 'Two', 'Three'] }),
  short: codes({ slides: slides.slice(0, 5) }) }));
''')
        self.assertTrue(result['pair'])
        self.assertFalse(result['trend'])
        self.assertTrue(result['isTrend'])
        self.assertEqual(result['blocked'], ['CRAFT_PLAYERS_UNINTRODUCED', 'CRAFT_STEP_OVERUSE', 'CRAFT_TRIVIAL_CHARTS'])
        self.assertEqual(result['catalogue'], [])
        self.assertEqual(result['short'], [])

    def test_zebra_rows_are_not_a_table_treatment(self):
        result = run_node('''
import { craftFindings } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const slides = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, title: 'Page ' + i, exhibit: { type: 'table', columns: ['A'], rows: [['x']] } }));
const scene = (role) => ({ slides: Array.from({ length: 12 }, () => ({ nodes: [{ role: 'action-title' }, { role }], componentInstances: [{ component: 'table' }] })) });
const codes = (role) => craftFindings({ slides }, scene(role)).map(f => f.code);
console.log(JSON.stringify({ zebra: codes('table-zebra-band'), harvey: codes('table-harvey-ball') }));
''')
        self.assertIn('CRAFT_TABLES_PLAIN', result['zebra'])
        self.assertNotIn('CRAFT_TABLES_PLAIN', result['harvey'])


class RouteMapTests(unittest.TestCase):
    def test_cities_routes_and_crop(self):
        result = run_node('''
import { mapNodes } from './skills/professional-slides/runtime/maps.mjs';
const frame = { x: 0, y: 0, width: 800, height: 450 };
const markers = [{ id: 'ruh', label: 'Riyadh', longitude: 46.7, latitude: 24.7, hub: true }, { id: 'lhr', label: 'London', longitude: -0.45, latitude: 51.5 }, { id: 'bom', label: 'Mumbai', longitude: 72.9, latitude: 19.1 }];
const nodes = mapNodes({ id: 'm', frame, props: { geography: 'world', crop: 'fit', markers, routes: [{ from: 'ruh', to: 'lhr' }, { from: 'ruh', to: 'bom', status: 'planned' }] } });
let refused = null;
try { mapNodes({ id: 'm', frame, props: { geography: 'world', markers: [{ country: 'IND', label: 'Mumbai' }] } }); } catch (e) { refused = e.message; }
const dot = nodes.find(n => n.role === 'map-marker' && !n.data.hub);
const routes = nodes.filter(n => n.role === 'map-route');
const land = nodes.filter(n => n.role === 'map-land');
console.log(JSON.stringify({ dot: dot.frame.width, routes: routes.length, dashes: routes[1].data.paths.length, solid: routes[0].data.paths.length,
  land: land.length, refused, labels: nodes.filter(n => n.role === 'map-label').length }));
''')
        self.assertEqual(result['dot'], 10)
        self.assertEqual(result['routes'], 2)
        self.assertEqual(result['solid'], 1)
        self.assertGreater(result['dashes'], 4)
        self.assertLess(result['land'], 120)  # cropped to the network, not every country
        self.assertIn('longitude and latitude', result['refused'])
        self.assertEqual(result['labels'], 3)



class SizeLegendAndNotesTests(unittest.TestCase):
    def test_valued_markers_need_a_legend_and_it_scales_by_area(self):
        result = run_node('''
import { mapNodes, valueDiameter } from './skills/professional-slides/runtime/maps.mjs';
const frame = { x: 0, y: 0, width: 800, height: 450 };
const markers = [{ id: 'a', label: 'Riyadh', longitude: 46.7, latitude: 24.7, hub: true }, { id: 'b', label: 'Shanghai', longitude: 121.5, latitude: 31.2, value: 25 }, { id: 'c', label: 'Warsaw', longitude: 21, latitude: 52.2, value: 2 }];
let refused = null; try { mapNodes({ id: 'm', frame, props: { geography: 'world', crop: 'fit', markers } }); } catch (e) { refused = e.message; }
const out = {};
for (const style of ['row', 'stacked']) out[style] = mapNodes({ id: 'm', frame, props: { geography: 'world', crop: 'fit', markers, sizeLegend: { label: 'City population, m', style } } }).filter(n => n.role === 'map-size-legend-circle').length;
console.log(JSON.stringify({ refused, ratio: (valueDiameter(25, 25) / valueDiameter(6.25, 25)), ...out }));
''')
        self.assertIn('sizeLegend.label', result['refused'])
        self.assertAlmostEqual(result['ratio'], 2.0, places=3)  # a quarter of the value, half the diameter
        self.assertGreaterEqual(result['row'], 2)
        self.assertEqual(result['row'], result['stacked'])

    def test_long_bar_notes_move_to_a_column_instead_of_overlapping(self):
        result = run_node('''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const cats = ['Riyadh Air','IndiGo','Akasa Air','Breeze Airways','STARLUX','Norse Atlantic','Etihad Airways','Emirates','Qatar Airways'];
const props = { categories: cats, series: [{ name: 'Orders', values: [124,100,72,60,17,0,0,0,0] }], categoryNotes: cats.map((_, i) => i % 2 ? '28 months, leased at first' : '39 months to service') };
const nodes = REGISTRY.get('chart.bar').render({ id: 'c', frame: { x: 0, y: 0, width: 1160, height: 240 }, props }).nodes;
const notes = nodes.filter(n => n.role === 'category-note'), labels = nodes.filter(n => n.role === 'category-label');
const overlap = (a, b) => a.frame.x < b.frame.x + b.frame.width && b.frame.x < a.frame.x + a.frame.width && a.frame.y < b.frame.y + b.frame.height && b.frame.y < a.frame.y + a.frame.height;
console.log(JSON.stringify({ column: notes.every(n => n.data.column), clash: notes.some(n => labels.some(l => overlap(n, l))) || notes.some((n, i) => notes.some((m, j) => i !== j && overlap(n, m))) }));
''')
        self.assertTrue(result['column'])
        self.assertFalse(result['clash'])


class LogoFetchTests(unittest.TestCase):
    def test_infobox_logo_and_placeholder_filling_offline(self):
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

    def test_logos_share_a_visual_area_instead_of_fitting_the_box(self):
        result = run_node('''
import { logoFrame } from './skills/professional-slides/runtime/charts.mjs';
const box = { x: 0, y: 0, width: 64, height: 32 }, area = 64 * 24 * 0.6;
const wide = logoFrame(box, 960, 200, { area, align: 'right' }), square = logoFrame(box, 400, 400, { area, align: 'right' }), tall = logoFrame(box, 300, 600, { area });
console.log(JSON.stringify({ wide, square, tall, ratio: (square.width * square.height) / (wide.width * wide.height) }));
''')
        self.assertLessEqual(result['wide']['width'], 64)
        self.assertAlmostEqual(result['wide']['x'] + result['wide']['width'], 64, places=3)  # hugs the bar
        self.assertGreater(result['ratio'], 0.9)  # a square mark gets as much ink as a wordmark
        self.assertLessEqual(result['tall']['height'], 32)


class PictureAndPlaceTests(unittest.TestCase):
    def test_commons_choice_keeps_free_landscape_photographs(self):
        result = run_node('''
import { chooseCommonsPhoto, picturePlaceholders } from './skills/professional-slides/runtime/fetch-pictures.mjs';
const page = (index, title, license, { mime = 'image/jpeg', width = 2400, height = 1600 } = {}) => ({ index, title, imageinfo: [{ mime, width, height, thumburl: 'u' + index, descriptionurl: 'd' + index, extmetadata: { LicenseShortName: { value: license }, Artist: { value: '<a href="x">Jo Bloggs</a>' } } }] });
const pages = [page(1, 'File:Route map.jpg', 'CC BY 4.0'), page(2, 'File:Cabin.jpg', 'CC BY-NC 2.0'), page(3, 'File:Tail.png', 'CC0', { mime: 'image/png' }),
  page(4, 'File:Tall.jpg', 'CC BY-SA 4.0', { width: 1600, height: 2400 }), page(5, 'File:Small.jpg', 'CC0', { width: 800 }), page(6, 'File:Aircraft at LHR.jpg', 'CC BY 4.0')];
const spec = { cover: { image: { alt: 'A 787 on approach', search: 'Riyadh Air 787' } }, players: [{ name: 'X', logo: { alt: 'X logo' } }], slides: [{ photo: { alt: 'Client site', fetch: false } }, { photo: { alt: 'Done', path: 'a.jpg' } }] };
console.log(JSON.stringify({ choice: chooseCommonsPhoto(pages), none: chooseCommonsPhoto(pages.slice(0, 3)), wanted: picturePlaceholders(spec).map(p => p.alt) }));
''')
        self.assertEqual(result['choice']['title'], 'File:Aircraft at LHR.jpg')  # landscape wins over the earlier portrait
        self.assertEqual(result['choice']['credit'], 'Photo: Jo Bloggs, CC BY 4.0, via Wikimedia Commons')
        self.assertIsNone(result['none'])  # a map, a non-commercial licence and a PNG are all refused
        self.assertEqual(result['wanted'], ['A 787 on approach'])

    def test_attributed_pictures_get_a_generated_credits_page(self):
        result = run_node('''
import { pictureCredits } from './skills/professional-slides/runtime/compose.mjs';
const spec = { cover: { image: { alt: 'Hub', path: 'a.jpg', credit: 'Photo: A, CC BY-SA 4.0, via Wikimedia Commons' } },
  slides: [{ id: 'fleet', photo: { alt: 'Cabin', path: 'b.jpg', credit: 'Photo: B, CC BY 4.0, via Wikimedia Commons' } }, { id: 'own', photo: { alt: 'Office', path: 'c.jpg', credit: 'Client photograph' } }] };
const pages = pictureCredits(spec);
console.log(JSON.stringify({ n: pages.length, id: pages[0]?.id, rows: pages[0]?.exhibit.rows, none: pictureCredits({ slides: [] }).length }));
''')
        self.assertEqual(result['id'], 'picture-credits')
        self.assertEqual(result['rows'], [['Cover', 'Hub', 'A, CC BY-SA 4.0, via Wikimedia Commons'], ['{{page:fleet}}', 'Cabin', 'B, CC BY 4.0, via Wikimedia Commons']])
        self.assertEqual(result['none'], 0)

    def test_named_markers_are_placed_from_the_cache_offline(self):
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

    def test_series_tables_carry_cagr_and_a_gapless_chart(self):
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


if __name__ == '__main__':
    unittest.main()
