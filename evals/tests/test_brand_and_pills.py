"""A brand's colours dress the whole deck, and a table's pills say what they are.

`identity` reaches every colour family a page is drawn in - emphasis, tints,
secondary type, hairlines - naming them or deriving them from the colours it
does name, and a deck with no identity keeps the house's own. A palette token
no page reads is refused with the names that are. A table sets a category or a
priority in a `tag` pill in the deck's colours, a pill's word is set for
contrast on its own fill, and a bubble's `sub` line is drawn under it.
"""
import sys
import unittest

from node_probe import RUNTIME, run_node

sys.path.insert(0, str(RUNTIME / "gates"))
import page_gates  # noqa: E402

PRELUDE = '''
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { resolvePalette, contrastRatio } from './skills/professional-slides/runtime/palettes.mjs';
import { applyDesign, DESIGN_NAMES } from './skills/professional-slides/runtime/design-systems.mjs';
import { TOKENS, THEME_SLOT_TOKENS } from './skills/professional-slides/runtime/core.mjs';
import { deckKeyProblems, deckSchema } from './skills/professional-slides/runtime/deck-keys.mjs';
const BASE = './skills/professional-slides/examples';
const colours = (deck) => { const t = resolvePalette(applyDesign({ id: 'x', ...deck }).palette, TOKENS, THEME_SLOT_TOKENS).tokens; return Object.fromEntries(Object.entries(t).filter(([k]) => k.startsWith('color.') && !k.startsWith('color.heat.')).map(([k, d]) => [k.slice(6), d.value])); };
const error = (fn) => { try { fn(); return null; } catch (e) { return (e.pageErrors ?? [e.message])[0]; } };
const BRAND = { primary: '#00122E', accent: '#3E6AEF' };
const pills = { type: 'table', columns: ['Use case', { label: 'Priority', type: 'tag' }, { label: 'Stage', type: 'rag' }, { label: 'Share', bubble: true }],
  rows: [['Outbound', { text: 'High', tone: 'accent' }, { value: 'not-started', text: 'Planned' }, { text: '41%', sub: 'of calls' }],
         ['Inbound', { text: 'Medium', tone: 'primary' }, { value: 'behind' }, { text: '33%', sub: 'of calls' }],
         ['Reminders', 'Low', { value: 'neutral' }, '26%']] };
const deck = (exhibit, more = {}) => ({ schema: 'professional-slides.deck/v3', id: 't', design: 'consulting', ...more,
  slides: [{ id: 'p1', title: 'Outbound calls lead the three use cases by share', layout: 'exhibit-full', exhibit, source: 'Source: illustrative data' }] });
const scene = (spec) => composeAll(structuredClone(spec), BASE).deck;
const drawn = (spec) => scene(spec).slides[0].nodes;
const paint = (node) => node.style.fill ?? node.style.color;
'''

# The house values a brand's deck used to keep whatever it set: the grey tints, the grey rule and the yellow callout.
HOUSE = {"componentPrimaryTint": "#E6E8EA", "surfaceTint": "#DCDFE1", "surfaceMuted": "#F0F0F0", "calloutTint": "#FFF6DC",
         "rule": "#929BA3", "chartGrid": "#D4D8DC", "textSecondary": "#4D4D4D", "accent": "#2251FF"}
TINTS = ("componentPrimaryTint", "accentTint", "surfaceTint", "surfaceMuted", "calloutTint")


class IdentityTests(unittest.TestCase):
    def test_the_colours_a_brand_names_set_their_families(self):
        result = run_node(PRELUDE + '''
console.log(JSON.stringify(colours({ design: 'consulting', identity: { ...BRAND, muted: '#586478', tint: '#EEF2FF', rule: '#E6EAF0' } })));
''')
        self.assertEqual(result["accent"], "#3E6AEF")
        self.assertEqual(result["chartSeries1"], "#3E6AEF")
        self.assertEqual(result["chartSubject"], "#3E6AEF")
        self.assertEqual(result["componentPrimary"], "#00122E")
        # Two weights of ground, never one: the quiet ground (a zebra band, a label column) is the brand's tint, and the
        # ground that marks something out (a highlighted row, a callout, a figure's panel) is a clear step deeper - set
        # to one colour, a highlighted row beside a band read as two highlighted rows.
        grey = lambda c: sum(int(c[i:i + 2], 16) * w for i, w in ((1, .299), (3, .587), (5, .114)))
        for key in ("surfaceTint", "surfaceMuted"):
            self.assertEqual(result[key], "#EEF2FF", key)
        marked = {result[key] for key in ("accentTint", "componentPrimaryTint", "calloutTint")}
        self.assertEqual(len(marked), 1)
        self.assertGreater(grey("#EEF2FF") - grey(marked.pop()), 12)
        self.assertEqual((result["textSecondary"], result["chartUnit"]), ("#586478", "#586478"))
        self.assertEqual((result["rule"], result["chartGrid"]), ("#E6EAF0", "#E6EAF0"))

    def test_the_families_a_brand_does_not_name_are_derived_from_its_colours_and_read(self):
        result = run_node(PRELUDE + '''
const grey = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).reduce((s, v, i) => s + v * [.299, .587, .114][i], 0);
const spread = (c) => { const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); return Math.max(...v) - Math.min(...v); };
const out = [];
for (const design of DESIGN_NAMES) for (const identity of [BRAND, { primary: '#00122E' }, { primary: '#C8102E', accent: '#C49A6C' }, { primary: '#740001', accent: '#D3A625' }]) {
  const c = colours({ design, identity });
  out.push({ design, identity, c, weight: grey(c.canvas) - grey(c.surfaceTint), ruleWeight: grey(c.canvas) - grey(c.rule), hue: spread(c.surfaceTint),
    muted: [contrastRatio(c.textSecondary, c.canvas), contrastRatio(c.textSecondary, c.surfaceTint)], ink: contrastRatio(c.ink, c.surfaceTint),
    accent: contrastRatio(c.accent, c.canvas) });
}
console.log(JSON.stringify(out));
''')
        for row in result:
            colours, said = row["c"], (row["design"], row["identity"])
            # One tint for every tinted surface, in the brand's hue at the weight a filled surface carries; none left the house's.
            self.assertEqual(len({colours[key] for key in TINTS}), 2, said)
            for key in (*TINTS, "rule", "chartGrid", "textSecondary"):
                self.assertNotEqual(colours[key], HOUSE[key], (key, said)) if key in HOUSE else None
            self.assertGreaterEqual(row["weight"], 28, said)
            self.assertLessEqual(row["weight"], 40, said)
            self.assertGreater(row["ruleWeight"], row["weight"], said)   # a hairline still shows across a tinted panel
            self.assertLess(row["ruleWeight"], 60, said)                 # and stays a hairline, far under the house's #929BA3
            self.assertEqual(colours["rule"], colours["chartGrid"], said)
            self.assertEqual(colours["textSecondary"], colours["chartUnit"], said)
            # The contrast bars: secondary type at 4.5:1 on the page and on the tint, the ink well clear, the accent as text.
            for ratio in row["muted"]:
                self.assertGreaterEqual(ratio, 4.5, said)
            self.assertGreaterEqual(row["ink"], 7, said)
            self.assertGreaterEqual(row["accent"], 4.5, said)
        brand = next(row for row in result if row["design"] == "consulting" and row["identity"] == {"primary": "#00122E", "accent": "#3E6AEF"})
        self.assertEqual(brand["c"]["accent"], "#3E6AEF")           # the accent, not the primary, is the emphasis
        self.assertEqual(brand["c"]["chartSubject"], "#3E6AEF")
        self.assertGreater(brand["hue"], 20)                         # the tint is the accent's blue, not a grey
        alone = next(row for row in result if row["design"] == "consulting" and row["identity"] == {"primary": "#00122E"})
        self.assertEqual(alone["c"]["accent"], "#00122E")            # no accent named: the primary is still the emphasis

    def test_a_deck_with_no_identity_keeps_the_house_colours(self):
        result = run_node(PRELUDE + '''
const spec = { id: 'x', slides: [] };
console.log(JSON.stringify({ untouched: applyDesign(spec) === spec, house: colours({ design: 'consulting' }),
  same: DESIGN_NAMES.every((design) => JSON.stringify(applyDesign({ id: 'x', design }).palette.colors) === JSON.stringify(applyDesign({ id: 'x', design, identity: undefined }).palette.colors)),
  set: Object.keys(applyDesign({ id: 'x', design: 'consulting' }).palette.colors).filter((key) => key.startsWith('color.')) }));
''')
        self.assertTrue(result["untouched"])
        self.assertTrue(result["same"])
        self.assertEqual(result["set"], [], "the consulting system sets no colour of its own: the base palette's stand")
        for key, value in HOUSE.items():
            self.assertEqual(result["house"][key], value, key)

    def test_a_brand_deck_passes_the_contrast_gate_with_every_pill_on_it(self):
        for identity in ("BRAND", "{ ...BRAND, muted: '#586478', tint: '#EEF2FF', rule: '#E6EAF0' }", "{ primary: '#C8102E', accent: '#C49A6C' }"):
            built = run_node(PRELUDE + f"console.log(JSON.stringify(scene(deck(pills, {{ identity: {identity} }}))));")
            self.assertEqual(page_gates.run_gates(built, gates={"GROUND_CONTRAST"})["findings"], [], identity)

    def test_identity_and_palette_names_are_listed_and_a_wrong_one_is_refused(self):
        result = run_node(PRELUDE + '''
const schema = deckSchema().properties;
console.log(JSON.stringify({ identity: schema.identity, palette: schema.palette.description,
  bogus: error(() => scene(deck(pills, { palette: { base: 'midnight', colors: { 'color.bogus': '#112233' } } }))),
  derived: error(() => scene(deck(pills, { palette: { base: 'midnight', colors: { 'color.chartSubject': '#112233' } } }))),
  style: error(() => scene(deck(pills, { palette: { base: 'midnight', colors: { 'style.tableRow': 'zebra' } } }))),
  known: error(() => scene(deck(pills, { palette: { base: 'midnight', colors: { 'color.rule': '#C0C8D0', 'style.tableRows': 'zebra' } } }))),
  key: deckKeyProblems({ schema: 'professional-slides.deck/v3', id: 'x', identity: { primary: '#00122E', secondary: '#3E6AEF' } }),
  hex: deckKeyProblems({ schema: 'professional-slides.deck/v3', id: 'x', identity: { primary: '#00122E', tint: 'pale blue' } }),
  fine: deckKeyProblems({ schema: 'professional-slides.deck/v3', id: 'x', identity: { primary: '#00122E', accent: '#3E6AEF', muted: '#586478', tint: '#EEF2FF', rule: '#E6EAF0' } }) }));
''')
        for name in ("primary", "accent", "muted", "tint", "rule"):
            self.assertIn(name, result["identity"]["x-takes"])
            self.assertIn(f"`{name}`", result["identity"]["description"])
        for token in ("color.accent", "color.componentPrimaryTint", "color.surfaceTint", "color.calloutTint", "color.rule", "color.chartGrid", "color.textSecondary", "style.tableRows"):
            self.assertIn(token, result["palette"])
        self.assertNotIn("color.chartSubject", result["palette"])
        self.assertIn("color.bogus is not a token a page reads", result["bogus"])
        self.assertIn("color.surfaceTint", result["bogus"])          # the refusal lists the names that are read
        self.assertIn("derived", result["derived"])
        self.assertIn("color.accent", result["derived"])
        self.assertIn("style.tableRows", result["style"])
        self.assertIsNone(result["known"])
        self.assertIn("identity.secondary", result["key"][0])
        self.assertIn("#RRGGBB", result["hex"][0])
        self.assertEqual(result["fine"], [])


class PillTests(unittest.TestCase):
    def test_a_tag_is_a_pill_in_the_decks_own_colours_by_tone(self):
        result = run_node(PRELUDE + '''
const nodes = drawn(deck(pills, { identity: BRAND }));
const pill = (role) => nodes.filter((n) => n.role === role && n.data.cellType === 'tag').map((n) => ({ text: n.text, tone: n.data.tone, token: paint(n).tokenId, value: paint(n).value, frame: n.frame }));
const status = nodes.filter((n) => n.role === 'table-status-pill' && n.data.cellType === 'rag');
const tones = (cell) => error(() => drawn(deck({ ...pills, rows: [['Outbound', cell, { value: 'behind' }, '41%']] })));
console.log(JSON.stringify({ fills: pill('table-status-pill'), labels: pill('table-status-label'), ragHeight: status[0].frame.height,
  contrast: pill('table-status-pill').map((fill, i) => contrastRatio(fill.value, pill('table-status-label')[i].value)),
  badTone: tones({ text: 'High', tone: 'positive' }), empty: tones({ text: ' ' }), badState: error(() => drawn(deck({ ...pills, rows: [['Outbound', 'High', { value: 'high' }, '41%']] }))) }));
''')
        self.assertEqual([(p["tone"], p["token"]) for p in result["fills"]],
                         [("accent", "color.accent"), ("primary", "color.componentPrimary"), ("neutral", "color.componentPrimaryTint")])
        self.assertEqual([p["text"] for p in result["labels"]], ["High", "Medium", "Low"])
        self.assertEqual([p["token"] for p in result["labels"]], ["color.onPrimary", "color.onPrimary", "color.ink"])
        for ratio in result["contrast"]:
            self.assertGreaterEqual(ratio, 4.5)
        # The same pill as a status: one height, the label centred in it.
        self.assertEqual({p["frame"]["height"] for p in result["fills"]}, {result["ragHeight"]})
        for fill, label in zip(result["fills"], result["labels"]):
            self.assertAlmostEqual(fill["frame"]["y"] + fill["frame"]["height"] / 2, label["frame"]["y"] + label["frame"]["height"] / 2, places=3)
        self.assertIn("accent, primary, neutral", result["badTone"])
        self.assertIn("`rag`", result["badTone"])
        self.assertIn("needs the word", result["empty"])
        self.assertIn("`tag`", result["badState"])

    def test_a_pills_word_reads_on_its_own_fill_whatever_the_rule_colour(self):
        result = run_node(PRELUDE + '''
const states = ['on-track', 'complete', 'behind', 'at-risk', 'not-started', 'won', 'drawn', 'lost', 'neutral'];
const table = { type: 'table', columns: ['Milestone', { label: 'Status', type: 'rag' }], rows: states.map((value) => [value, { value }]) };
const read = (more) => { const nodes = drawn(deck(table, more)); const fills = nodes.filter((n) => n.role === 'table-status-pill'), labels = nodes.filter((n) => n.role === 'table-status-label');
  return fills.map((fill, i) => ({ state: fill.data.state, ratio: contrastRatio(paint(fill).value, paint(labels[i]).value), label: paint(labels[i]).tokenId })); };
const pale = deck(table, { identity: { ...BRAND, rule: '#E6EAF0' } });
console.log(JSON.stringify({ house: read({}), pale: read({ identity: { ...BRAND, rule: '#E6EAF0' } }), dark: read({ tone: 'dark' }), scene: scene(pale) }));
''')
        for ground in ("house", "pale", "dark"):
            self.assertEqual(len(result[ground]), 9)
            for pill in result[ground]:
                self.assertGreaterEqual(pill["ratio"], 4.5, (ground, pill))
        # White on the pale rule read at 1.2:1 and the build's own gate refused the page.
        self.assertEqual({p["label"] for p in result["pale"] if p["state"] in ("not-started", "neutral")}, {"color.ink"})
        self.assertEqual(page_gates.run_gates(result["scene"], gates={"GROUND_CONTRAST"})["findings"], [])

    def test_a_bubbles_sub_line_is_drawn_under_its_pill(self):
        result = run_node(PRELUDE + '''
const nodes = drawn(deck(pills));
const at = (role, row) => nodes.find((n) => n.role === role && n.data.row === row && n.data.column === 3);
const rows = [0, 1, 2].map((row) => ({ pill: at('table-bubble', row)?.frame, label: at('table-bubble-label', row)?.frame, sub: at('table-cell-sub', row), band: nodes.filter((n) => n.role === 'table-rule' && n.data.rule === 'row').map((n) => n.frame.y) }));
console.log(JSON.stringify(rows.map((r) => ({ ...r, sub: r.sub ? { text: r.sub.text, frame: r.sub.frame, align: r.sub.style.align, color: r.sub.style.color.tokenId } : null }))));
''')
        for row in result[:2]:
            pill, sub = row["pill"], row["sub"]
            self.assertEqual(sub["text"], "of calls")
            self.assertEqual((sub["align"], sub["color"]), ("center", "color.textSecondary"))
            self.assertGreaterEqual(sub["frame"]["y"], pill["y"] + pill["height"])                                   # under the pill, clear of it
            self.assertAlmostEqual(sub["frame"]["x"] + sub["frame"]["width"] / 2, pill["x"] + pill["width"] / 2, places=3)  # on its centre line
            self.assertAlmostEqual(pill["y"] + pill["height"] / 2, row["label"]["y"] + row["label"]["height"] / 2, places=3)
        self.assertIsNone(result[2]["sub"])
        # One pill down the column, with or without a line under it.
        self.assertEqual(len({(round(row["pill"]["width"], 3), row["pill"]["height"]) for row in result}), 1)

    def test_the_sub_line_stays_inside_a_tight_row(self):
        result = run_node(PRELUDE + '''
import { renderTable } from './skills/professional-slides/runtime/tables.mjs';
import { styleTable } from './evals/support/compose.mjs';
const props = styleTable({ ...pills, density: 'compact' });
const table = renderTable({ id: 't', frame: { x: 0, y: 0, width: 900, height: 400 }, props });
const cell = (row) => { const of = (role) => table.nodes.find((n) => n.role === role && n.data.row === row && n.data.column === 3)?.frame; return { pill: of('table-bubble'), sub: of('table-cell-sub') }; };
const rules = table.nodes.filter((n) => n.role === 'table-rule').map((n) => n.frame.y).sort((a, b) => a - b);
console.log(JSON.stringify({ cells: [0, 1].map(cell), rules, frame: table.frame ?? null }));
''')
        tops = [cell["pill"]["y"] for cell in result["cells"]]
        for index, cell in enumerate(result["cells"]):
            bottom = cell["sub"]["y"] + cell["sub"]["height"]
            self.assertGreater(cell["sub"]["y"], cell["pill"]["y"] + cell["pill"]["height"] - 0.01)
            if index + 1 < len(tops):
                self.assertLess(bottom, tops[index + 1], "the line under one bubble stays clear of the next row's")


if __name__ == "__main__":
    unittest.main()
