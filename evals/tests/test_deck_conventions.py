"""The deck's conventions: declared once, applied by the renderer, held on each page.

The BA deck was written by sixteen section writers side by side and every gate
read one page at a time, so its cross-deck conventions were declared nowhere and
the final review was the first reader to see them broken: six charts gave the
accent to a rival or to no one (fd01's line drew Lufthansa Group in it and IAG
navy), the peer set changed from page to page, "Lufthansa" named both the group
and the airline, sterling printed as £ and as GBP, and ap05's heat table shaded
a rank dark-is-worse beside scores dark-is-better. These hold the repair:
`deck.conventions` is validated against the declared players; the composer
marks the page's subject, writes the currency's form and runs every heat column
by merit; and a per-page gate refuses what is the author's to mend, each with
its fix, so a writer meets it on their own page check.
"""
from __future__ import annotations

import unittest

from node_probe import run_node

RUNTIME = "./skills/professional-slides/runtime"
PLAYERS = '[{ name: "British Airways", short: "BA" }, "IAG", "Lufthansa Group", "Lufthansa Airlines", "Air France-KLM", "Iberia", "Ryanair"]'
CONVENTIONS = '''{ subject: "British Airways", names: { "Lufthansa Group": { not: ["Lufthansa"] }, "Lufthansa Airlines": { not: ["Lufthansa"] } },
  peerSets: { "network groups": ["IAG", "Lufthansa Group", "Air France-KLM"] }, currency: "symbols", heat: "dark-is-better" }'''


class ConventionSchemaTests(unittest.TestCase):
    def test_a_name_that_is_not_a_declared_player_is_refused_and_named(self):
        """A slip ("Lufthansa" for the group) would match nothing on every page: the compile's key check says which name, where."""
        result = run_node(f'''
import {{ deckKeyProblems }} from '{RUNTIME}/deck-keys.mjs';
const players = {PLAYERS};
const ok = deckKeyProblems({{ schema: "x", id: "d", players, conventions: {CONVENTIONS} }});
const bad = deckKeyProblems({{ schema: "x", id: "d", players, conventions: {{ subject: "Lufthansa", sectionSubjects: {{ "6a-returns": "Norwegian" }}, peerSets: {{ rivals: ["IAG", "Emirates"] }}, currency: "£", heat: "up" }} }}, {{ sections: ["6a-returns"] }});
const section = deckKeyProblems({{ schema: "x", id: "d", players, conventions: {{ sectionSubjects: {{ "returns": "IAG" }} }} }}, {{ sections: ["6a-returns", "6b-balance-fleet"] }});
console.log(JSON.stringify({{ ok, bad, section }}));
''')
        self.assertEqual(result["ok"], [])
        bad = " ".join(result["bad"])
        for named in ('"Lufthansa"', '"Norwegian"', '"Emirates"', '"£"', '"up"'):
            self.assertIn(named, bad)
        self.assertIn("6a-returns, 6b-balance-fleet", " ".join(result["section"]))


class SubjectFocusTests(unittest.TestCase):
    PASS = f'''
import {{ SLIDE_PASSES }} from '{RUNTIME}/compose-passes.mjs';
const run = SLIDE_PASSES.find(([name]) => name === "deck-conventions")[1];
const ctx = {{ conventions: {CONVENTIONS}, players: {PLAYERS} }};
'''

    def test_the_subject_takes_the_focus_wherever_a_chart_plots_it(self):
        """fd01's line drew the second series, Lufthansa Group, in the accent and IAG navy: the subject is now the focus, by name."""
        result = run_node(self.PASS + '''
const line = run({ id: "fd01", subject: "IAG", exhibit: { type: "chart.line", categories: ["2024", "2025"], series: [{ name: "Lufthansa Group adjusted EBIT margin", values: [5, 4] }, { name: "IAG operating margin", values: [13, 15] }] } }, ctx).exhibit;
const bars = run({ id: "pr02", exhibit: { type: "chart.bar", categories: ["Iberia", "BA", "Vueling"], series: [{ name: "Premium share", values: [16, 36, 10] }] } }, ctx).exhibit;
const absent = run({ id: "x", exhibit: { type: "chart.column", categories: ["2024", "2025"], series: [{ name: "Iberia", values: [1, 2] }, { name: "Vueling", values: [1, 2] }, { name: "Aer Lingus", values: [1, 2] }] } }, ctx).exhibit;
const own = run({ id: "y", exhibit: { type: "chart.bar", categories: ["Iberia", "BA", "Vueling"], series: [{ name: "s", values: [1, 2, 3] }], focus: "Iberia" } }, ctx).exhibit;
const table = run({ id: "ap03", subject: "IAG", exhibit: { type: "table", columns: ["Group", "Margin"], rows: [["Ryanair", "20"], ["IAG", "15"], ["Air France-KLM", "6"]] } }, ctx).exhibit;
console.log(JSON.stringify({ line, bars, absent, own, table }));
''')
        self.assertEqual(result["line"]["focusSeries"], "IAG operating margin")
        self.assertEqual(result["bars"]["highlights"], [{"category": "BA", "style": "bar"}])
        # Not plotted: the accent (the second series colour) is no one's.
        self.assertEqual(result["absent"]["colorIndices"], [0, 2, 3])
        self.assertNotIn("highlights", result["own"])
        self.assertEqual(result["table"]["highlightRow"], 1)

    def test_units_print_the_deck_currency_and_omits_print_as_a_note(self):
        """GBP on fd14 and on pr04's axis beside £ on six pages: the unit is written in the deck's form; a set's member left out is said."""
        result = run_node(self.PASS + '''
const slide = run({ id: "fd05", note: "Group accounts.", exhibit: { type: "chart.bar", unit: "GBP m", heading: "Operating profit, GBP m", peers: "network groups", omits: { "Air France-KLM": "reports in euros at a different year-end" },
  categories: ["IAG", "Lufthansa Group"], series: [{ name: "s", values: [1, 2] }] } }, ctx);
console.log(JSON.stringify(slide));
''')
        self.assertEqual(result["exhibit"]["unit"], "£m")
        self.assertEqual(result["exhibit"]["heading"], "Operating profit, £m")
        self.assertNotIn("peers", result["exhibit"])
        self.assertNotIn("omits", result["exhibit"])
        self.assertIn("Left out of the network groups: Air France-KLM (reports in euros", result["note"])


class OneSubjectColourTests(unittest.TestCase):
    COMPOSE = f'''
import {{ composeAll }} from '{RUNTIME}/compose-all.mjs';
const players = {PLAYERS};
const slides = [
  {{ id: "fd01", title: "IAG's margin beat Lufthansa Group's in every year outside the Covid losses", subject: "IAG", exhibit: {{ type: "chart.line", heading: "Operating margin, 2021-2025", unit: "%", categories: ["2021", "2022", "2023", "2024", "2025"],
    series: [{{ name: "IAG operating margin", values: [-10, 5, 12, 14, 15] }}, {{ name: "Lufthansa Group adjusted EBIT margin", values: [-6, 4, 6, 5, 5] }}] }} }},
  {{ id: "fd02", title: "IAG's 15.1% margin was the second highest of the four groups", subject: "IAG", exhibit: {{ type: "chart.bar", heading: "Operating margin, 2025", unit: "%", categories: ["Ryanair", "IAG", "Air France-KLM", "Lufthansa Group"], series: [{{ name: "Margin", values: [16, 15, 6, 5] }}] }} }},
  {{ id: "ap03", title: "IAG leads the network groups on margin and leverage at year-end", subject: "IAG", exhibit: {{ type: "table", columns: ["Group", "Margin, %"], rows: [["Ryanair", "15.8"], ["IAG", "15.1"], ["Air France-KLM", "6.1"]] }} }},
];
const tokens = (design, conventions) => {{
  const out = composeAll({{ schema: "professional-slides.deck/v3", id: "d", design, players, ...(conventions ? {{ conventions }} : {{}}), slides }}, ".", {{ partial: true }});
  const seen = {{}};
  const walk = (node, id) => {{ if (Array.isArray(node)) return node.forEach((n) => walk(n, id)); if (!node || typeof node !== "object") return;
    const fill = node.style?.fill?.tokenId ?? node.style?.stroke?.tokenId;
    if (node.role === "chart-line" && fill) (seen[`${{id}} line`] ??= new Set()).add(fill);
    if (node.role === "chart-mark" && node.data?.category === "IAG") (seen[`${{id}} IAG bar`] ??= new Set()).add(fill);
    if (node.role === "table-row-subject") (seen[`${{id}} row`] ??= new Set()).add(fill);
    for (const value of Object.values(node)) if (value && typeof value === "object") walk(value, id); }};
  for (const slide of out.deck.slides) walk(slide, slide.id);
  return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v].sort()]));
}};
'''

    def test_a_line_a_bar_and_a_table_row_carry_one_token_for_the_subject(self):
        """fd01 drew IAG's bar in the accent and IAG's line beside it in navy: with a declared subject all three take the accent."""
        result = run_node(self.COMPOSE + '''
console.log(JSON.stringify({ declared: tokens("consulting", { subject: "IAG" }), none: tokens("consulting", null), keynote: tokens("keynote", { subject: "IAG" }) }));
''')
        declared = result["declared"]
        self.assertEqual(declared["fd01 line"], ["color.accent", "color.chartComparator"])
        self.assertEqual(declared["fd02 IAG bar"], ["color.accent"])
        self.assertEqual(declared["ap03 row"], ["color.accent"])
        # A deck that declares no conventions draws as it did: no subject, no marker, no accent on the line.
        self.assertNotIn("ap03 row", result["none"])
        self.assertNotIn("color.accent", result["none"].get("fd01 line", []))
        # Keynote's accent reads at 2.5 to 1 on its comparator grey, under a mark's 3:1: its subject keeps the primary.
        self.assertEqual(result["keynote"]["fd01 line"], ["color.chartComparator", "color.componentPrimary"])

    def test_the_accent_clears_the_grey_on_the_designs_that_take_it(self):
        """The subject is told from its peers by colour alone: the accent it takes reads at 3:1 against their grey."""
        result = run_node(f'''
import {{ DESIGN_SYSTEMS }} from '{RUNTIME}/design-systems.mjs';
import {{ contrastRatio }} from '{RUNTIME}/color.mjs';
import {{ resolvePalette, MARK_CONTRAST }} from '{RUNTIME}/palettes.mjs';
import {{ TOKENS, THEME_SLOT_TOKENS }} from '{RUNTIME}/core.mjs';
const value = (t, k) => (typeof t[k] === "string" ? t[k] : t[k]?.value);
console.log(JSON.stringify({{ floor: MARK_CONTRAST, ratios: Object.fromEntries(Object.entries(DESIGN_SYSTEMS).map(([name, d]) => {{
  const t = resolvePalette({{ base: d.base, colors: d.colors }}, TOKENS, THEME_SLOT_TOKENS).tokens;
  return [name, contrastRatio(value(t, "color.accent"), value(t, "color.chartComparator"))]; }})) }}));
''')
        for name in ("consulting", "editorial", "journal"):
            self.assertGreaterEqual(result["ratios"][name], result["floor"], name)
        self.assertLess(result["ratios"]["keynote"], result["floor"])

    def test_a_title_replacement_is_held_to_the_title_lines_and_tiles_print_the_currency(self):
        """A title fixed by the names question is held to the title's words and lines; a tile's figure takes the deck's currency."""
        result = run_node(f'''
import {{ answerProblems }} from '{RUNTIME}/judgements.mjs';
import {{ copyLimits }} from '{RUNTIME}/limits.mjs';
import {{ SLIDE_PASSES }} from '{RUNTIME}/compose-passes.mjs';
const item = {{ key: "k", kind: "player-name-form", subject: "IAG beat Lufthansa", slot: {{ ...copyLimits().title, measure: {{ width: 300, fontFamily: "Arial", fontSize: 24 }} }} }};
const long = answerProblems(item, {{ verdict: "refused-form", reason: "It names Lufthansa alone, which is ambiguous.", quote: "Lufthansa", replacement: "IAG's margin beat Lufthansa Group's in every year of the decade outside Covid", replacementReason: "It names the group as the deck declares it." }});
const run = SLIDE_PASSES.find(([name]) => name === "deck-conventions")[1];
const slide = run({{ id: "hb06", metrics: [{{ value: "USD 120m", label: "paid by Oman Air for one slot pair" }}], kpi: {{ value: "GBP 4bn", label: "k" }} }}, {{ conventions: {{ currency: "symbols" }}, players: [] }});
console.log(JSON.stringify({{ long, metric: slide.metrics[0].value, kpi: slide.kpi.value }}));
''')
        self.assertTrue(any("lines where its slot holds" in problem for problem in result["long"]))
        self.assertEqual(result["metric"], "$120m")
        self.assertEqual(result["kpi"], "£4bn")


class HeatDirectionTests(unittest.TestCase):
    def test_a_rank_shades_darkest_at_its_best_beside_a_score(self):
        """ap05 shaded a Skytrax rank by size, so dark meant worse there and better in the score column beside it."""
        result = run_node(f'''
import {{ styleTable }} from '{RUNTIME}/compose-tables.mjs';
import {{ SLIDE_PASSES }} from '{RUNTIME}/compose-passes.mjs';
const run = SLIDE_PASSES.find(([name]) => name === "deck-conventions")[1];
const table = {{ type: "table", columns: ["Airline", {{ label: "Rank", heat: true, better: "down" }}, {{ label: "Score, %", heat: true, better: "up" }}],
  rows: [["A", "5", "80"], ["B", "40", "70"], ["C", "69", "60"]] }};
const shade = (conventions) => {{ const ex = run({{ id: "ap05", exhibit: table }}, {{ conventions, players: [] }}).exhibit; const styled = styleTable(ex);
  return styled.rows.map((row) => (Array.isArray(row) ? row : row.cells).slice(1).map((cell) => cell.value)); }};
console.log(JSON.stringify({{ merit: shade({{ heat: "dark-is-better" }}), size: shade(null) }}));
''')
        # Darkest (5) where each column is best: the lowest rank, the highest score.
        self.assertEqual([row[0] for row in result["merit"]], [5, 3, 1])
        self.assertEqual([row[1] for row in result["merit"]], [5, 3, 1])
        # A deck that declares no direction shades by size, as before.
        self.assertEqual([row[0] for row in result["size"]], [1, 3, 5])


class ConventionGateTests(unittest.TestCase):
    def test_each_rule_refuses_with_its_fix(self):
        """Each convention the renderer cannot apply is refused on its own page, its repair naming what to write."""
        result = run_node(f'''
import {{ conventionFindings }} from '{RUNTIME}/gates/convention_gates.mjs';
import {{ classOf }} from '{RUNTIME}/gates/gate_classes.mjs';
const spec = {{ players: {PLAYERS}, conventions: {CONVENTIONS}, slides: [
  {{ id: "pr02", subject: "British Airways", title: "Premium earned GBP 4bn", exhibit: {{ type: "chart.bar", categories: ["Iberia", "British Airways", "Lufthansa"], series: [{{ name: "s", values: [1, 2, 3] }}], highlights: [{{ category: "Iberia", style: "bar" }}] }} }},
  {{ id: "fd05", subject: "IAG", title: "t", exhibit: {{ type: "chart.bar", categories: ["IAG", "Lufthansa Group", "Ryanair"], series: [{{ name: "s", values: [1, 2, 3] }}] }} }},
  {{ id: "fd06", subject: "IAG", title: "t", exhibit: {{ type: "chart.bar", peers: "network groups", categories: ["IAG", "Lufthansa Group"], series: [{{ name: "s", values: [1, 2] }}] }} }},
  {{ id: "fd07", subject: "British Airways", title: "t", exhibit: {{ type: "chart.bar", peers: "network groups", omits: {{ "Air France-KLM": "no 2025 accounts" }}, categories: ["IAG", "Lufthansa Group"], series: [{{ name: "s", values: [1, 2] }}] }} }},
  {{ id: "ap05", subject: "British Airways", title: "t", exhibit: {{ type: "table", columns: ["Airline", {{ label: "Rank", heat: true, better: "down" }}, {{ label: "Score", heat: true }}], rows: [["A", "1", "2"]] }} }},
] }};
const found = conventionFindings(spec);
console.log(JSON.stringify(found.map((f) => ({{ code: f.code, id: f.id, cls: classOf(f.code), repair: f.repair }}))));
''')
        codes = {(f["id"], f["code"]) for f in result}
        self.assertIn(("pr02", "SUBJECT_NOT_ACCENTED"), codes)
        self.assertIn(("pr02", "PLAYER_NAME_REFUSED"), codes)
        self.assertIn(("pr02", "CURRENCY_FORM"), codes)
        self.assertIn(("fd05", "PEER_SET_UNDECLARED"), codes)
        self.assertIn(("fd06", "PEERS_OMITTED_UNSAID"), codes)
        self.assertNotIn(("fd07", "PEERS_OMITTED_UNSAID"), codes)
        self.assertIn(("ap05", "HEAT_DIRECTION_UNRECORDED"), codes)
        self.assertTrue(all(f["cls"] == "P" for f in result))
        repairs = {(f["id"], f["code"]): f["repair"] for f in result}
        self.assertIn('"Lufthansa Group" or "Lufthansa Airlines"', repairs[("pr02", "PLAYER_NAME_REFUSED")])
        self.assertIn('"£"', repairs[("pr02", "CURRENCY_FORM")])
        self.assertIn('omits: { "Air France-KLM"', repairs[("fd06", "PEERS_OMITTED_UNSAID")])

    def test_a_line_naming_a_refused_form_is_asked_and_its_replacement_held(self):
        """What a title names is read, not matched: one question a line, and a refused form comes back with its replacement."""
        result = run_node(f'''
import {{ conventionFindings }} from '{RUNTIME}/gates/convention_gates.mjs';
import {{ judgementSession, withJudgements, pendingRequests, answerProblems, judgementKey }} from '{RUNTIME}/judgements.mjs';
const spec = {{ players: {PLAYERS}, conventions: {CONVENTIONS}, slides: [{{ id: "fd01", title: "IAG's margin was triple Lufthansa's", points: ["IAG led every year."] }}] }};
const session = judgementSession({{}});
withJudgements(session, () => conventionFindings(spec));
const asked = pendingRequests(session).filter((q) => q.kind === "player-name-form");
const item = {{ ...asked[0], key: asked[0].key }};
const missing = answerProblems(item, {{ verdict: "refused-form", reason: "It names Lufthansa alone, which is ambiguous.", quote: "Lufthansa's" }});
console.log(JSON.stringify({{ asked: asked.map((q) => q.subject), missing }}));
''')
        self.assertEqual(sorted(result["asked"]), sorted(["IAG's margin was triple Lufthansa's", "IAG led every year."]))
        self.assertTrue(any("replacement" in problem for problem in result["missing"]))


class BriefTests(unittest.TestCase):
    def test_the_writer_brief_prints_the_conventions_and_page_subjects(self):
        """Each section writer reads the deck's conventions and their pages' subjects in their own brief, not at the review."""
        result = run_node(f'''
import {{ briefLines }} from '{RUNTIME}/brief.mjs';
const doc = {{ deck: {{ players: {PLAYERS}, conventions: {{ ...{CONVENTIONS}, sectionSubjects: {{}} }} }}, pages: [{{ id: "fd01", type: "trend", title: "t", subject: "IAG" }}, {{ id: "pr02", type: "trend", title: "t" }}] }};
const out = briefLines(doc, {{ role: "writer", file: "d.pages.json", stem: "d", limitsOf: () => ({{}}), digest: "" }});
const none = briefLines({{ deck: {{}}, pages: [] }}, {{ role: "skeleton", file: "d.pages.json", stem: "d", limitsOf: () => ({{}}), digest: "" }});
console.log(JSON.stringify({{ lines: out.lines, none: none.lines }}));
''')
        text = "\n".join(result["lines"])
        self.assertIn("subject: British Airways", text)
        self.assertIn('"Lufthansa Group", never "Lufthansa"', text)
        subjects = next(line for line in result["lines"] if "page subjects other than the deck's" in line)
        self.assertIn("fd01 IAG", subjects)
        self.assertNotIn("pr02", subjects)
        self.assertTrue(any("none declared" in line for line in result["none"]))


if __name__ == "__main__":
    unittest.main()
