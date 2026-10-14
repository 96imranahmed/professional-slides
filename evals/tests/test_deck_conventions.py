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
// A peer set is a comparison's members, players or not (ba5: the Which? field of fifteen airlines); a refused form is refused.
const names = {{ "Lufthansa Group": {{ not: ["Lufthansa"] }} }};
const field = deckKeyProblems({{ schema: "x", id: "d", players, conventions: {{ names, peerSets: {{ "Which? field": ["British Airways", "Jet2", "Emirates"] }} }} }});
const refused = deckKeyProblems({{ schema: "x", id: "d", players, conventions: {{ names, peerSets: {{ rivals: ["IAG", "Lufthansa"] }} }} }});
console.log(JSON.stringify({{ ok, bad, section, field, refused }}));
''')
        self.assertEqual(result["ok"], [])
        bad = " ".join(result["bad"])
        for named in ('"Lufthansa"', '"Norwegian"', '"£"', '"up"'):
            self.assertIn(named, bad)
        self.assertNotIn('"Emirates"', bad)  # a peer set's member need not be a player
        self.assertEqual(result["field"], [])
        self.assertIn('names "Lufthansa", a form `names` refuses: write "Lufthansa Group"', " ".join(result["refused"]))
        self.assertIn("6a-returns, 6b-balance-fleet", " ".join(result["section"]))


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
        self.assertIn('set `exhibit.omits` to { "Air France-KLM"', repairs[("fd06", "PEERS_OMITTED_UNSAID")])

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
        # The line that holds no refused form cannot fail the question, and is not asked.
        self.assertEqual(result["asked"], ["IAG's margin was triple Lufthansa's"])
        self.assertTrue(any("replacement" in problem for problem in result["missing"]))

    def test_only_a_line_holding_a_refused_form_as_a_whole_word_is_asked(self):
        """The name question is asked of a line only where the line holds a form the deck itself refuses (`names[...].not`),
        read as a whole word in any case: a line without one cannot name a player by it. The judgement still decides."""
        result = run_node(f'''
import {{ conventionFindings }} from '{RUNTIME}/gates/convention_gates.mjs';
import {{ judgementSession, withJudgements, pendingRequests }} from '{RUNTIME}/judgements.mjs';
import {{ refusedForms, refusedFormsIn }} from '{RUNTIME}/conventions.mjs';
const conventions = {{ names: {{ "Northgate Group": {{ not: ["Northgate", "NG plc"] }} }} }};
const spec = {{ players: ["Northgate Group", "Harbour"], conventions, slides: [
  {{ id: "p1", title: "Harbour's margin trails Northgate's by two points", points: ["NORTHGATE grew lending fastest.", "Northgates of the region lag.", "Harbour held its share."] }},
  {{ id: "p2", title: "Harbour leads on cost", points: ["Its cost ratio fell every year.", "NG plc reports a year later."] }},
  {{ id: "p3", title: "Northgate Group grew faster than any peer", points: ["Harbour grew second-fastest."] }},
] }};
const session = judgementSession({{}});
withJudgements(session, () => conventionFindings(spec));
const asked = pendingRequests(session).filter((q) => q.kind === "player-name-form").map((q) => [q.where[0], q.subject]);
console.log(JSON.stringify({{ asked, held: refusedFormsIn("Northgate's lending", refusedForms(conventions)), none: refusedFormsIn("Northgates lag", refusedForms(conventions)) }}));
''')
        self.assertEqual(sorted(result["asked"]), sorted([
            ["p1", "Harbour's margin trails Northgate's by two points"],
            ["p1", "NORTHGATE grew lending fastest."],
            ["p2", "NG plc reports a year later."],
            # The declared name holds the refused form as a word: it is asked, and the reader decides.
            ["p3", "Northgate Group grew faster than any peer"],
        ]))
        self.assertEqual(result["held"], ["Northgate"])
        self.assertEqual(result["none"], [])


class PeerSetMembersTests(unittest.TestCase):
    """A peer set's members are read through the lookup a chart's labels are read through.

    A set that wrote a player by its declared `short` name held nothing a label
    resolved to: the label "Northwind" was read as the player Northwind
    Airlines, the set held the string "Northwind", and the exhibit was refused
    as comparing a set the deck does not declare. And each refusal names the
    exhibit's field to edit, the deck key, and the counts it read.
    """

    PROBE = f'''
import {{ conventionFindings }} from '{RUNTIME}/gates/convention_gates.mjs';
const players = [{{ name: "Northwind Airlines", short: "Northwind" }}, {{ name: "Harbour Air", aliases: ["Harbour"] }}, "Cobalt Jet", "Delta Shore", "Ember Air"];
const conventions = {{ peerSets: {{ "short-haul": ["Northwind", "Harbour", "Cobalt Jet", "Ember Air"], "coastal": ["Delta Shore", "Cobalt Jet"] }} }};
const bar = (categories, more = {{}}) => ({{ type: "chart.bar", heading: "Seats flown, 2025", categories, series: [{{ name: "Seats", values: categories.map((_, i) => i + 1) }}], ...more }});
const findings = (slides) => conventionFindings({{ players, conventions, slides }}).map((f) => ({{ code: f.code, id: f.id, repair: f.repair, measured: f.measured }}));
'''

    def test_a_set_member_written_by_a_short_name_or_alias_holds_the_player(self):
        result = run_node(self.PROBE + '''
console.log(JSON.stringify({
  // Labelled by the full names, the short names and the aliases alike: one set, nothing refused.
  full: findings([{ id: "p1", title: "t", exhibit: bar(["Northwind Airlines", "Harbour Air", "Cobalt Jet", "Ember Air"]) }]),
  short: findings([{ id: "p2", title: "t", exhibit: bar(["Northwind", "Harbour", "Cobalt Jet", "Ember Air"]) }]),
  named: findings([{ id: "p3", title: "t", exhibit: bar(["Northwind", "Cobalt Jet"], { peers: "short-haul", omits: { "Harbour Air": "no 2025 filing", "Ember": "x" } }) }]),
}));
''')
        self.assertEqual(result["full"], [])
        self.assertEqual(result["short"], [])
        # A reason keyed by the player's full name says why the set's "Harbour" is left out; "Ember" names no player and Ember Air is left unsaid.
        self.assertEqual([f["code"] for f in result["named"]], ["PEERS_OMITTED_UNSAID"])
        self.assertEqual(result["named"][0]["measured"]["unsaid"], ["Ember Air"])

    def test_a_short_name_inside_a_longer_proper_name_is_not_the_player(self):
        """hw03 plotted departure-tax countries and "United Kingdom" was read as the player United Airlines by its short "United"."""
        result = run_node(self.PROBE + f'''
import {{ playerInLabel }} from '{RUNTIME}/conventions.mjs';
console.log(JSON.stringify({{
  places: findings([{{ id: "p4", title: "t", exhibit: bar(["Northwind Islands", "Harbour Bay", "Delta Shore"]) }}]),
  labels: ["Northwind Islands", "Northwind operating margin", "Northwind EBIT margin", "Harbour"].map((label) => playerInLabel(players, label)),
}}));
''')
        self.assertEqual(result["places"], [])
        # A lower-case word or an acronym after the name is a descriptor of the player; a capitalised word makes a longer name.
        self.assertEqual(result["labels"], [None, "Northwind Airlines", "Northwind Airlines", "Harbour Air"])

    def test_each_peer_refusal_names_the_field_the_deck_key_and_the_counts(self):
        result = run_node(self.PROBE + '''
console.log(JSON.stringify(findings([
  { id: "u1", title: "t", exhibits: [bar(["Ember Air", "Delta Shore", "Harbour Air"]), bar(["Northwind", "Cobalt Jet", "Harbour Air"], { peers: "long-haul" })] },
  { id: "u2", title: "t", exhibit: bar(["Northwind", "Cobalt Jet", "Delta Shore"], { peers: "short-haul" }) },
  { id: "u3", title: "t", exhibit: bar(["Northwind", "Cobalt Jet"]) },
  { id: "o1", title: "t", exhibit: bar(["Northwind", "Cobalt Jet"], { peers: "short-haul" }) },
])));
''')
        repairs = {}
        for f in result:
            repairs.setdefault((f["id"], f["code"]), []).append(f["repair"])
        # No set holds the three: the field to set, the deck key, the members counted, and the set to declare.
        first = repairs[("u1", "PEER_SET_UNDECLARED")]
        self.assertIn("`exhibits[0]` (\"Seats flown, 2025\") compares 3 players by its categories", first[0])
        self.assertIn('none holds all 3, so declare the set in `deck.conventions.peerSets` - `"<set name>": ["Ember Air", "Delta Shore", "Harbour Air"]` - and set `exhibits[0].peers` to its name', first[0])
        # A set the deck does not declare: the field, the sets there are, and the one that holds the members.
        self.assertIn('names `exhibits[1].peers` "long-haul", which `deck.conventions.peerSets` does not declare (its 2 sets:', first[1])
        self.assertIn('Set `exhibits[1].peers` to "short-haul", which holds all 3 players its categories compare, with `exhibits[1].omits` { "Ember Air": "<why it is not shown>" }', first[1])
        # A member outside the named set: how many, which, and the three edits that mend it.
        outside = repairs[("u2", "PEER_SET_UNDECLARED")][0]
        self.assertIn('names `exhibit.peers` "short-haul" (4 members) and also compares 1 player by its categories that the set does not hold, "Delta Shore"', outside)
        self.assertIn('add it to `deck.conventions.peerSets["short-haul"]`', outside)
        # No set named and the members a subset of one: name it, and say why the rest are left out.
        subset = repairs[("u3", "PEER_SET_UNDECLARED")][0]
        self.assertIn('"short-haul" holds all 2 and 2 more - set `exhibit.peers` to "short-haul" and `exhibit.omits` to { "Harbour": "<why it is not shown>", "Ember Air": "<why it is not shown>" } for the 2 it leaves out', subset)
        # Left out unsaid: the set's size, how many are shown, which are left out and the field to write.
        omitted = repairs[("o1", "PEERS_OMITTED_UNSAID")][0]
        self.assertIn('draws on the "short-haul" set of 4 and shows 2; it leaves out 2 without a reason - "Harbour", "Ember Air": set `exhibit.omits` to { "Harbour": "<why it is not shown>", "Ember Air": "<why it is not shown>" }', omitted)
        measured = [f["measured"] for f in result if f["id"] == "o1"][0]
        self.assertEqual((measured["shown"], measured["of"], measured["field"]), (2, 4, "exhibit.omits"))


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
