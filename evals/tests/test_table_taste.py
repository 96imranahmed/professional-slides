"""Taste as part of the flow: a table's figures in bubbles or bars, a ranking of companies by their marks.

The Retell investor deck set forty-odd figures across its competitor tables as plain text and drew its valuation
multiples with the four companies named in grey type, though every one of them was a declared player with a logo.
`TABLE_FIGURES_PLAIN` (table-taste.mjs) advises the bubble or bar a column of figures wants, and bars or columns whose
categories are all declared players carry their marks (page-types.mjs markPlayerCells).
"""
import unittest

from node_probe import run_node

RUNTIME = "./skills/professional-slides/runtime"


class TableTasteTests(unittest.TestCase):
    def test_figures_parse_by_kind_and_words_or_ranges_do_not(self):
        result = run_node(f"""
import {{ figureKind }} from '{RUNTIME}/table-taste.mjs';
const d = String.fromCharCode(36);
const said = [d + '4.6M', '~' + d + '270M', '>' + d + '100M', d + '0.07'].concat(['45%', '22x', '549', '-55%', '505x', 'n/d', d + '15.8B (May 2026)', d + '0.07-' + d + '0.31/min']);
console.log(JSON.stringify(said.map((t) => figureKind(t))));
""")
        self.assertEqual([k and (k["currency"], k["unit"]) for k in result],
                         [("$", ""), ("$", ""), ("$", ""), ("$", ""), ("", "%"), ("", "x"), ("", ""), ("", "%"), ("", "x"), None, None, None])

    def test_a_column_of_figures_left_plain_is_advised_its_device(self):
        result = run_node(f"""
import {{ plainFigureColumns, tableTasteFindings }} from '{RUNTIME}/table-taste.mjs';
const d = String.fromCharCode(36);
const ex = {{ type: 'table', columns: ['Company', 'Type', 'Raised', 'Last valuation', 'Multiple', {{ label: 'Share', bubble: true }}, 'Mixed'],
  rows: [['Retell', 'Developer', d + '4.6M', 'n/d', '22x', '10%', '10%'], ['Vapi', 'Developer', d + '72M', '~' + d + '0.5B (May 2026)', '45x', '5%', '3x'],
         ['Bland', 'Developer', '>' + d + '100M', 'n/d', '40x', '3%', '4%'], ['Decagon', 'Enterprise', d + '481M', d + '4.5B', '60x', '2%', '5%']] }};
const findings = tableTasteFindings({{ slides: [{{ id: 'players', exhibit: ex }}, {{ id: 'short', exhibit: {{ ...ex, rows: ex.rows.slice(0, 2) }} }}] }});
console.log(JSON.stringify({{ columns: plainFigureColumns(ex), findings }}));
""")
        self.assertEqual(result["columns"], [{"column": "Raised", "index": 2, "device": "bar"}, {"column": "Multiple", "index": 4, "device": "bubble"}])
        self.assertEqual([f["id"] for f in result["findings"]], ["players"])  # two rows are looked up, not compared
        self.assertEqual(result["findings"][0]["severity"], "advisory")
        self.assertIn("`bubble: true`", result["findings"][0]["repair"])


class CategoryMarkTests(unittest.TestCase):
    def test_bars_of_declared_players_carry_their_marks(self):
        result = run_node(f"""
import {{ compilePage }} from '{RUNTIME}/page-types.mjs';
const players = ['Parloa', 'Decagon', 'Sierra', 'ElevenLabs'].map((name) => ({{ name }}));
const page = {{ id: 'p', type: 'ranking', form: 'bar', commentary: 'on-exhibit', takeaway: false, title: 'Investors paid 22-60x ARR for voice agent leaders',
  exhibit: {{ heading: 'Valuation over ARR', unit: 'x ARR', categories: ['Parloa', 'Decagon', 'Sierra', 'ElevenLabs'], series: [{{ name: 'Multiple', values: [60, 45, 40, 22] }}] }} }};
const icons = (exhibit) => compilePage({{ ...page, exhibit: {{ ...page.exhibit, ...exhibit }} }}, 0, {{ players }}).exhibit.categoryIcons;
console.log(JSON.stringify({{ all: icons({{}}), off: icons({{ categoryIcons: false }}), mixed: icons({{ categories: ['Parloa', 'Decagon', 'Sierra', 'Peer median'] }}) ?? null }}));
""")
        self.assertEqual(result["all"]["Sierra"], {"image": {"alt": "Sierra logo"}, "player": "Sierra"})
        self.assertEqual(len(result["all"]), 4)
        self.assertFalse(result["off"])
        self.assertIsNone(result["mixed"])  # a peer median has no mark, so none is drawn


if __name__ == "__main__":
    unittest.main()
