"""A table cell that names a declared player is drawn as the player's logo.

A comparison table's "Current edge" column read "OpenAI" / "Anthropic" in green
status pills: the colour said good where the cell meant who. With the players
declared, the name becomes the mark, and colour is left to mean a state.
"""
import unittest

from node_probe import run_node

AUTHOR = "./skills/professional-slides/runtime/author-deck.mjs"


class PlayerLogoCellTests(unittest.TestCase):
    def test_player_names_become_logos_and_fall_back_to_names(self):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import zlib from 'node:zlib';
import {{ authorDeck, compileDeck }} from '{AUTHOR}';
// A 40x16 PNG, written where the build looks for a fetched logo.
const png = (() => {{
  const crc = (buf) => {{ let c = ~0; for (const b of buf) {{ c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }} return ~c >>> 0; }};
  const chunk = (type, data) => {{ const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }};
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(40, 0); ihdr.writeUInt32BE(16, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((40 * 3 + 1) * 16, 60); for (let y = 0; y < 16; y++) raw[y * 121] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}})();
const S = {{ kind: 'comparison', what: 'Reach and adoption measures for both firms' }};
const page = {{ id: 'p1', type: 'lookup', form: 'table', commentary: 'none', takeaway: false, why: 'Each criterion is looked up with its current edge', settles: S,
  title: 'The commercial call is split between the two firms',
  exhibit: {{ columns: ['Criterion', 'Current edge', 'Reason'], rows: [
    ['Consumer attention', 'Northwind', 'More than a billion weekly users'],
    ['Enterprise paid adoption', 'Southgate', 'Panel and survey estimates'],
    ['Revenue quality', 'No verdict', 'Gross and net costs undisclosed']] }} }};
const deck = {{ schema: 'professional-slides.deck/v3', id: 'd', players: [{{ name: 'Northwind' }}, {{ name: 'Southgate Labs', short: 'Southgate' }}] }};
const cells = compileDeck({{ deck, pages: [page] }}).spec.slides[0].exhibit.rows.map((row) => row[1]);
const compose = async (withLogos) => {{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logos-'));
  if (withLogos) {{ fs.mkdirSync(path.join(dir, 'assets', 'logos'), {{ recursive: true }});
    for (const slug of ['northwind', 'southgate-labs']) fs.writeFileSync(path.join(dir, 'assets', 'logos', slug + '.png'), png); }}
  const out = await authorDeck({{ deck, pages: [page] }}, {{ baseDir: dir }});
  const nodes = out.deck.slides.find((s) => s.id === 'p1').nodes;
  return {{ failed: [...out.failedIds], logos: nodes.filter((n) => n.role === 'table-logo').length,
    names: nodes.filter((n) => n.type === 'text' && /^(Northwind|Southgate Labs)$/.test(String(n.text))).length }};
}};
console.log(JSON.stringify({{ cells, offline: await compose(false), fetched: await compose(true) }}));
''')
        self.assertEqual([c['type'] if isinstance(c, dict) else c for c in result['cells']], ['logo', 'logo', 'No verdict'])
        self.assertEqual(result['cells'][1]['player'], 'Southgate Labs')  # matched by its short name
        self.assertEqual(result['offline']['failed'], [])
        self.assertEqual(result['offline']['names'], 2)  # no logo on disk yet: the cell keeps the name
        self.assertEqual(result['fetched']['failed'], [])
        self.assertEqual(result['fetched']['logos'], 2)


if __name__ == '__main__':
    unittest.main()
