"""The entities a deck compares are introduced by their own marks, by kind.

`players` named organisations, and every other compared entity was held to a
logo: a deck comparing countries was told to fetch France's logo from
Wikipedia, and one comparing aircraft types a manufacturer's wordmark. With no
`players` declared, the rule guessed the compared names from capitalised words
in the titles. Each entry now declares its mark by what it is - a logo for an
organisation, an outline drawn from the runtime's own geography for a place, a
photograph fetched from Wikimedia Commons for anything else with a look - the
places that draw a player's mark draw that one, the rules count a mark only in
the kind its entity declares, and only declared entities make them apply.
"""
import unittest

from node_probe import run_node

RUNTIME = "./skills/professional-slides/runtime"

PLAYERS = """
const players = [
  { name: 'France', mark: 'outline', outline: { geography: 'europe', region: 'FRA' } },
  { name: 'Germany', mark: 'outline', outline: { geography: 'europe', region: 'DEU' } },
  { name: 'Boeing 787', short: '787', mark: 'image', image: { alt: 'A Boeing 787 in flight', search: 'Boeing 787 Dreamliner' } },
];
"""

# A 40x16 PNG, for a photograph on disk: the picture reader sniffs the bytes, not the extension.
PNG = """
import zlib from 'node:zlib';
const png = (() => {
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(40, 0); ihdr.writeUInt32BE(16, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((40 * 3 + 1) * 16, 60); for (let y = 0; y < 16; y++) raw[y * 121] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();
"""


class DeclarationTests(unittest.TestCase):
    def test_an_entry_declares_its_mark_and_the_deck_keys_refuse_one_that_cannot_be_drawn(self):
        result = run_node(PLAYERS + f'''
import {{ deckKeyProblems, deckSchema }} from '{RUNTIME}/deck-keys.mjs';
import {{ compileDeck }} from '{RUNTIME}/author-deck.mjs';
import {{ playerEntries, plannedMark }} from '{RUNTIME}/players.mjs';
const base = {{ schema: 'professional-slides.deck/v3', id: 'd', request: 'Compare the markets and the aircraft for the board' }};
const problems = (list) => deckKeyProblems({{ ...base, players: list }});
const thrown = (list) => {{ try {{ compileDeck({{ deck: {{ ...base, players: list }}, pages: [] }}, {{ partial: true }}); return null; }} catch (error) {{ return error.message; }} }};
console.log(JSON.stringify({{
  clean: problems([...players, 'Emirates', {{ name: 'Qatar Airways', short: 'Qatar', wikipedia: 'Qatar Airways' }}, {{ name: 'GCC', mark: 'outline', outline: {{ geography: 'gcc' }} }}]),
  kinds: playerEntries([...players, 'Emirates']).map((p) => p.kind),
  marks: playerEntries([...players, 'Emirates']).map(plannedMark),
  region: problems([{{ name: 'Japan', mark: 'outline', outline: {{ geography: 'europe', region: 'JPN' }} }}]),
  geography: problems([{{ name: 'Atlantis', mark: 'outline', outline: {{ region: 'ATL' }} }}]),
  unsearched: problems([{{ name: 'A350', mark: 'image', image: {{ alt: 'An A350' }} }}]),
  undeclared: problems([{{ name: 'Paris', outline: {{ geography: 'europe', region: 'FRA' }} }}]),
  logoOfPlace: problems([{{ name: 'Spain', mark: 'outline', outline: {{ geography: 'europe', region: 'ESP' }}, wikipedia: 'Spain' }}]),
  unknownKind: problems([{{ name: 'Rome', mark: 'flag' }}]),
  unknownKey: problems([{{ name: 'Rome', marks: 'outline' }}]),
  described: deckSchema().properties.players.description,
  compile: thrown([{{ name: 'Japan', mark: 'outline', outline: {{ geography: 'europe', region: 'JPN' }} }}]),
}}));
''')
        self.assertEqual(result["clean"], [])
        self.assertEqual(result["kinds"], ["outline", "outline", "image", "logo"])
        # Each kind's mark, as a page plans it: an outline from the geography, the entity's own photograph, a logo by name.
        self.assertEqual(result["marks"][0], {"alt": "France outline", "mark": "outline", "player": "France", "outline": {"geography": "europe", "region": "FRA"}})
        self.assertEqual(result["marks"][2], {"alt": "A Boeing 787 in flight", "search": "Boeing 787 Dreamliner", "mark": "image", "player": "Boeing 787"})
        self.assertEqual(result["marks"][3], {"alt": "Emirates logo"})
        self.assertIn('"JPN" is not a region of the Europe geography', result["region"][0])
        self.assertIn("`outline.geography` is missing", result["geography"][0])
        self.assertIn("`image.search` names the words", result["unsearched"][0])
        self.assertIn('`outline` is read only under `mark: "outline"`', result["undeclared"][0])
        self.assertIn("`wikipedia` is read only for a logo", result["logoOfPlace"][0])
        self.assertIn('`mark` is one of "logo"', result["unknownKind"][0])
        self.assertIn("`marks` is read by nothing", result["unknownKey"][0])
        for kind in ('"logo"', '"outline"', '"image"'):
            self.assertIn(kind, result["described"])
        self.assertIn("The deck-level keys of `deck` are not valid", result["compile"])


class PlannedMarkTests(unittest.TestCase):
    def test_the_places_that_draw_a_players_mark_plan_the_one_it_declares(self):
        result = run_node(PLAYERS + f'''
import {{ markPlayerCells }} from '{RUNTIME}/page-types.mjs';
import {{ planPlayerMarks }} from '{RUNTIME}/players.mjs';
const slide = {{ exhibits: [
  {{ type: 'table', columns: [{{ label: 'Market', type: 'category' }}, 'France result', 'Edge'], rows: [['Reach', 'x', 'France'], ['Fleet', 'y', '787 leads'], ['Cost', 'z', 'Split']] }},
  {{ type: 'logos', items: [{{ name: 'France' }}, {{ name: 'Boeing 787', caption: 'Wide-body' }}, {{ name: 'Airbus A350', image: {{ alt: 'Airbus A350 logo' }} }}] }},
  {{ type: 'cards', items: [{{ title: 'Germany', logo: {{ alt: 'Germany logo' }} }}, {{ title: 'France', logo: {{ alt: 'France logo', path: 'client/france.png', credit: 'Client' }} }}] }},
  {{ type: 'chart.bar', categories: ['France', 'Germany'], categoryIcons: {{ France: {{ image: {{ alt: 'France logo' }} }} }} }},
], pictures: [{{ alt: 'Germany logo', label: 'Germany', text: 'A picture entry is not a mark' }}] }};
markPlayerCells(slide, players); planPlayerMarks(slide, players);
const [table, logos, cards, chart] = slide.exhibits;
console.log(JSON.stringify({{ header: table.columns[1].logo, cell: table.rows[0][2], verdict: table.rows[1][2], split: table.rows[2][2],
  members: logos.items.map((item) => item.image ?? null), cards: cards.items.map((item) => item.logo), icon: chart.categoryIcons.France.image, picture: slide.pictures[0] }}));
''')
        outline = {"alt": "France outline", "mark": "outline", "player": "France", "outline": {"geography": "europe", "region": "FRA"}}
        photograph = {"alt": "A Boeing 787 in flight", "search": "Boeing 787 Dreamliner", "mark": "image", "player": "Boeing 787"}
        self.assertEqual(result["header"], outline)                                  # a column headed by a place carries its outline
        self.assertEqual(result["cell"], {"type": "logo", "player": "France", "media": outline})
        self.assertEqual(result["verdict"]["media"], photograph)                     # a verdict naming a thing by its short name: its photograph
        self.assertEqual(result["verdict"]["text"], "787 leads")
        self.assertEqual(result["split"], "Split")
        self.assertEqual(result["members"][0], outline)                              # a logos member named for a player draws its mark
        self.assertEqual(result["members"][1], photograph)
        self.assertEqual(result["members"][2], {"alt": "Airbus A350 logo"})        # not a declared player: left as written
        self.assertEqual(result["cards"][0]["outline"], {"geography": "europe", "region": "DEU"})   # "<Name> logo" stands for the declared mark
        self.assertEqual(result["cards"][1]["path"], "client/france.png")          # a page that names its own picture keeps it
        self.assertEqual(result["icon"], outline)
        self.assertEqual(result["picture"], {"alt": "Germany logo", "label": "Germany", "text": "A picture entry is not a mark"})


DECK = f"""
import {{ compileDeck }} from '{RUNTIME}/author-deck.mjs';
import {{ introducedOn }} from '{RUNTIME}/gates/variety_gates.mjs';
const S = {{ kind: 'comparison', what: 'Market and fleet filings, 2025 to 2026' }};
const base = {{ takeaway: false, why: 'The page compares the players on the same terms', settles: S, adds: 'The commentary names what the exhibit cannot: the terms behind each figure' }};
const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const chart = {{ type: 'trend', form: 'line', commentary: 'on-exhibit', exhibit: {{ categories: years, series: [{{ name: 'x', values: [1, 2, 3, 4, 5, 6, 7, 8] }}, {{ name: 'y', values: [2, 3, 4, 5, 6, 7, 8, 9] }}],
  annotations: [{{ category: '2021', text: 'The turn came when grounded capacity returned to the network' }}] }} }};
const coded = {{ type: 'scorecard', form: 'harvey', commentary: 'in-exhibit', exhibit: {{ columns: ['Option', {{ label: 'Fit', type: 'harvey' }}], rows: [['A', {{ type: 'harvey', value: 2 }}], ['B', {{ type: 'harvey', value: 3 }}], ['C', {{ type: 'harvey', value: 1 }}]] }} }};
const roster = (cells) => ({{ type: 'profiles', form: 'logo-table', commentary: 'in-exhibit', exhibit: {{ columns: [{{ label: '', type: 'logo' }}, 'Player', 'Size'],
  rows: cells.map((cell, at) => [cell, ['France', 'Germany', 'Boeing 787'][at], ['68m', '84m', '1,100 built'][at]]) }} }});
const kinds = [chart, coded, chart, coded, chart, coded, chart, coded, chart, coded, chart, coded];
const make = (list) => list.map((k, i) => ({{ id: 'c' + i, ...base, title: 'Finding number ' + i + ' of the deck', ...structuredClone(k) }}));
const unmarked = (pages, deck = {{}}) => compileDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd', players, ...deck }}, pages }}).findings.filter((f) => f.code === 'PLAYERS_UNMARKED');
"""


class IntroductionTests(unittest.TestCase):
    def test_an_outline_and_a_photograph_introduce_their_entities_and_a_logo_does_not(self):
        result = run_node(PLAYERS + DECK + '''
const named = (page) => [...introducedOn(page, players)].sort();
const said = unmarked(make(kinds));
console.log(JSON.stringify({
  none: said.map((f) => [f.measured.unmarked, f.measured.marks, f.repair]),
  cells: unmarked(make([chart, roster(['France', 'Germany', 'Boeing 787'].map((player) => ({ type: 'logo', player }))), ...kinds.slice(2)])).length,
  late: unmarked(make([...kinds.slice(0, 6), roster(['France', 'Germany', 'Boeing 787'].map((player) => ({ type: 'logo', player }))), ...kinds.slice(7)])).map((f) => f.measured.unmarked),
  // The runtime's name for a logo, written where the roster's marks go, is planned as each player's own mark.
  conventional: unmarked(make([chart, roster([{ media: { alt: 'France logo' } }, { media: { alt: 'Germany logo' } }, { media: { alt: 'Boeing 787 logo' } }]), ...kinds.slice(2)])).length,
  // A logo is not a place's mark, nor a manufacturer's wordmark a thing's photograph.
  logos: named({ exhibit: { type: 'table', columns: [{ label: '', type: 'logo' }], rows: [[{ type: 'logo', media: { alt: 'France logo', path: 'flags/france.png' } }], [{ type: 'logo', media: { alt: 'Boeing logo', path: 'boeing.png' } }]] } }),
  outline: named({ exhibit: { type: 'cards', items: [{ title: 'Germany', logo: { alt: 'Germany outline', mark: 'outline', player: 'Germany', outline: { geography: 'europe', region: 'DEU' } } }] } }),
  photograph: named({ pictures: [{ alt: 'A Boeing 787 in flight', label: '787' }] }),
  otherPhoto: named({ pictures: [{ alt: 'A 787 cabin', label: '787' }] }),
  titles: compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'd' }, pages: make(kinds).map((p, i) => ({ ...p, title: (i % 2 ? 'France leads Germany on measure ' : 'Germany trails France on measure ') + i })) })
    .findings.filter((f) => f.code === 'PLAYERS_UNMARKED').length,
}));
''')
        [(unmarked, marks, repair)] = result["none"]
        self.assertEqual(unmarked, ["France", "Germany", "Boeing 787"])
        self.assertEqual(marks, {"France": "outline", "Germany": "outline", "Boeing 787": "image"})
        self.assertIn("An outline is drawn from the runtime's own geography", repair)
        self.assertIn('A photograph is the entity\'s own `image` ("A Boeing 787 in flight")', repair)
        self.assertNotIn("Wikipedia infobox", repair)                 # no player here is marked by a logo
        self.assertEqual(result["cells"], 0)                           # a cell naming each player draws, and counts, its mark
        self.assertEqual(result["late"], [["France", "Germany", "Boeing 787"]])
        self.assertEqual(result["conventional"], 0)
        self.assertEqual(result["logos"], [])
        self.assertEqual(result["outline"], ["Germany"])
        self.assertEqual(result["photograph"], ["Boeing 787"])
        self.assertEqual(result["otherPhoto"], [])
        self.assertEqual(result["titles"], 0)                          # names in the titles are not taken for players

    def test_the_craft_floor_counts_outlines_and_player_photographs_drawn(self):
        result = run_node(PLAYERS + f'''
import {{ craftFindings, sceneStatistics }} from '{RUNTIME}/gates/craft_gates.mjs';
const slides = Array.from({{ length: 12 }}, (_, i) => ({{ id: 'p' + i, title: 'A finding on page ' + i }}));
const scene = (...nodes) => ({{ slides: [{{ id: 'p0', nodes: [{{ type: 'text', role: 'action-title', text: 'The three players' }}, ...nodes] }}] }});
const outline = {{ type: 'shape', role: 'profile-mark', data: {{ geometry: 'customPolygon', mark: 'outline', player: 'France', paths: [[[0, 0], [1, 0], [1, 1]]] }} }};
const photograph = {{ type: 'image', role: 'image', data: {{ alt: 'A Boeing 787 in flight' }} }};
const another = {{ type: 'image', role: 'image', data: {{ alt: 'An airport at dusk' }} }};
const floor = (sc) => {{ const standings = []; const found = craftFindings({{ slides, players }}, sc, {{ standings }}).filter((f) => f.code === 'CRAFT_PLAYERS_UNINTRODUCED');
  return {{ found: found.map((f) => [f.severity, f.measured.kinds, f.repair]), value: standings.find((s) => s.code === 'CRAFT_PLAYERS_UNINTRODUCED')?.value }}; }};
console.log(JSON.stringify({{ none: floor(scene(another)), outline: floor(scene(outline)), photograph: floor(scene(photograph)),
  marks: sceneStatistics(scene(outline, photograph, another), players).marks, undeclared: sceneStatistics(scene(photograph)).marks }}));
''')
        [(severity, kinds, repair)] = result["none"]["found"]
        self.assertEqual(severity, "blocker")
        self.assertEqual(kinds, ["outline", "image"])
        self.assertIn("A place's outline is drawn from the runtime's own geography", repair)
        self.assertIn("A photograph is the player's own `image: { alt, search }`", repair)
        self.assertEqual(result["none"]["value"], 0)                  # another photograph is not a player's mark
        for drawn in ("outline", "photograph"):
            self.assertEqual(result[drawn]["found"], [], drawn)
            self.assertEqual(result[drawn]["value"], 1, drawn)
        self.assertEqual(result["marks"], 2)
        self.assertEqual(result["undeclared"], 0)                     # a photograph marks a player only where one declares it


class CompositionTests(unittest.TestCase):
    def test_a_cell_naming_a_place_draws_its_outline_and_one_naming_a_thing_its_photograph(self):
        result = run_node(PLAYERS + PNG + f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ authorDeck }} from '{RUNTIME}/author-deck.mjs';
import {{ slugOf }} from '{RUNTIME}/fetch-logos.mjs';
const S = {{ kind: 'comparison', what: 'Market and fleet filings, 2025 to 2026' }};
const page = {{ id: 'p1', type: 'lookup', form: 'table', commentary: 'none', takeaway: false, why: 'Each criterion is looked up with who leads on it', settles: S,
  title: 'France leads on reach while the 787 carries the long-haul fleet',
  exhibit: {{ columns: ['Criterion', 'Current edge', 'Reason'], rows: [
    ['Consumer reach', 'France', 'The larger domestic market'], ['Industrial base', 'Germany', 'More suppliers on the programme'], ['Long-haul fleet', 'Boeing 787', 'The type most operators fly']] }} }};
const deck = {{ schema: 'professional-slides.deck/v3', id: 'd', players }};
const compose = async (withPhoto) => {{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marks-'));
  if (withPhoto) {{ fs.mkdirSync(path.join(dir, 'assets', 'pictures'), {{ recursive: true }}); fs.writeFileSync(path.join(dir, 'assets', 'pictures', slugOf('A Boeing 787 in flight') + '.jpg'), png); }}
  const out = await authorDeck({{ deck, pages: [page] }}, {{ baseDir: dir }});
  const nodes = out.deck.slides.find((s) => s.id === 'p1').nodes;
  fs.rmSync(dir, {{ recursive: true, force: true }});
  return {{ failed: [...out.failedIds], marks: nodes.filter((n) => n.role === 'table-logo').map((n) => [n.type, n.data.mark ?? null, n.data.player ?? null, n.data.geometry ?? null, (n.data.paths ?? []).length > 0, n.frame.width > 0 && n.frame.height > 0]),
    names: nodes.filter((n) => n.type === 'text' && /^(France|Germany|Boeing 787)$/.test(String(n.text))).map((n) => n.text) }};
}};
console.log(JSON.stringify({{ offline: await compose(false), supplied: await compose(true) }}));
''')
        outline = lambda player: ["shape", "outline", player, "customPolygon", True, True]
        # A place's outline is drawn from the geography data with no file; a photograph not yet fetched keeps the name.
        self.assertEqual(result["offline"]["failed"], [])
        self.assertEqual(result["offline"]["marks"], [outline("France"), outline("Germany")])
        self.assertEqual(result["offline"]["names"], ["Boeing 787"])
        self.assertEqual(result["supplied"]["failed"], [])
        self.assertEqual(result["supplied"]["marks"], [outline("France"), outline("Germany"), ["image", "image", "Boeing 787", None, False, True]])
        self.assertEqual(result["supplied"]["names"], [])


class AssetTests(unittest.TestCase):
    def test_logos_are_fetched_for_logos_photographs_for_images_and_nothing_for_outlines(self):
        result = run_node(PLAYERS + f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ assetNeeds }} from '{RUNTIME}/asset-needs.mjs';
import {{ autoFillLogos }} from '{RUNTIME}/fetch-logos.mjs';
import {{ choosePictures, picturePlaceholders }} from '{RUNTIME}/fetch-pictures.mjs';
import {{ judgementSession, withJudgements }} from '{RUNTIME}/judgements.mjs';
const mixed = ['North Rail', ...players];
const photo = {{ alt: 'A Boeing 787 in flight', search: 'Boeing 787 Dreamliner', mark: 'image', player: 'Boeing 787' }};
const outline = {{ alt: 'France outline', mark: 'outline', player: 'France', outline: {{ geography: 'europe', region: 'FRA' }} }};
// The deck's own entry, a logo cell and a card each plan the photograph; the outline is planned where a logo would go.
const spec = {{ id: 'd', players: mixed, slides: [{{ id: 'p1', exhibit: {{ type: 'table', rows: [[{{ type: 'logo', player: 'Boeing 787', media: {{ ...photo }} }}, {{ type: 'logo', player: 'France', media: {{ ...outline }} }}]] }} }},
  {{ id: 'p2', exhibit: {{ type: 'cards', items: [{{ title: '787', logo: {{ ...photo }} }}] }} }}] }};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'needs-'));
const needs = await assetNeeds(spec, dir);
const logos = await autoFillLogos(structuredClone(spec), dir, {{ fetchMissing: false }});
const searched = [];
const candidate = {{ title: 'File:787.jpg', url: 'u', page: 'd', license: 'CC BY 4.0', artist: 'Jo', credit: 'Photo: Jo' }};
const search = async (query) => {{ searched.push(query); return [candidate]; }};
const placeholders = picturePlaceholders(spec);
const {{ chosen }} = await withJudgements(judgementSession({{ oracle: () => 'shows' }}), () => choosePictures(placeholders, {{ search }}));
fs.rmSync(dir, {{ recursive: true, force: true }});
console.log(JSON.stringify({{ needs, logos, placeholders: placeholders.map((p) => p.alt), searched, chosen: placeholders.map((p) => chosen.get(p)?.title ?? null) }}));
''')
        self.assertEqual([logo["name"] for logo in result["needs"]["logos"]], ["North Rail"])      # only a player marked by a logo is searched for one
        self.assertEqual([p["alt"] for p in result["needs"]["pictures"]], ["A Boeing 787 in flight"])  # one photograph, however many pages plan it
        self.assertEqual(result["needs"]["places"], [])
        self.assertEqual(result["logos"], {"filled": 0, "fetched": [], "failed": []})
        self.assertEqual(result["placeholders"], ["A Boeing 787 in flight"] * 3)   # the entry, the logo cell and the card; never the outline
        self.assertEqual(result["searched"], ["Boeing 787 Dreamliner"])             # chosen once
        self.assertEqual(result["chosen"], ["File:787.jpg"] * 3)                     # and one file for every page that plans it


if __name__ == "__main__":
    unittest.main()
