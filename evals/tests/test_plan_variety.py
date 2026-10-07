"""`--plan` chooses each page's form for its claim, and two decks differ only where the claim leaves a choice.

Three runs of one brief converged on the same four exhibit kinds. Measured on
their own spines, the plan gave every seed and every design system the same
allocation, put ten to sixteen pages of each deck in a form that was not a
best fit for the claim (it rotated forms to meet the structure rules), and
estimated every open exhibit as a line or a bar. The plan now reads the fit
between claims and forms (runtime/claim-fit.mjs): a page gets a best-fit form
and never a weaker one, and a revision is drawn as its source deck is.

Two more decks from that brief still shared their three commonest kinds. Their
free choices sat mostly on pages of open kinds, which the plan's choice never
reached - a spine declares those exhibits by `basis` stubs, and a stub was
read as a line or a bar by its axis - and what the plan did choose it chose by
the spread of the deck's kinds, which is the same under every seed. So where
several forms fit equally the choice is now the deck's own hand: one order of
marks for each reading task, drawn by the `variation`, a page taking the mark
whose turn it is; and an untyped stub is given its kind the same way and read
as that kind by the plan and the draft alike. These hold that, on a fixed
spine that is not a benchmark deck's.
"""
from __future__ import annotations

import copy
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, SKILL, run_node

AUTHOR = SKILL / "runtime" / "author-deck.mjs"
EVAL = ROOT / "evals" / "quality" / "variability.mjs"
FIXTURE = ROOT / "evals" / "quality" / "fixtures" / "variety"
KIT = "./skills/professional-slides/runtime"
LOAD = f"""
import fs from 'node:fs';
import {{ allocateStructure, openKinds, openKindsOf, stubsOf }} from '{KIT}/deck-structure.mjs';
import {{ planOf }} from '{KIT}/author-deck.mjs';
import {{ pageFit, handOf, markRank }} from '{KIT}/claim-fit.mjs';
import {{ measureRegistry }} from '{KIT}/measures.mjs';
import {{ featuredDraw, REPERTOIRE, DESIGN_NAMES }} from '{KIT}/design-systems.mjs';
import {{ PAGE_TYPES }} from '{KIT}/page-types.mjs';
const dir = './evals/quality/fixtures/variety';
const doc = JSON.parse(fs.readFileSync(dir + '/variety.pages.json', 'utf8'));
const log = JSON.parse(fs.readFileSync(dir + '/variety.insights.json', 'utf8')).insights;
const insights = new Map(log.map((item) => [item.id, item]));
const registry = measureRegistry(insights);
const plan = (d, options = {{}}) => allocateStructure(d, {{ insights, planOf, ...options }});
const seeded = (seed, more = {{}}) => ({{ ...doc, deck: {{ ...doc.deck, variation: seed, ...more }} }});
const formOf = (p, id) => p.pages.find((page) => page.id === id);
const best = (page) => {{ const fit = pageFit(page, {{ registry, insights }}); return fit?.task ? fit.forms.equal.map((item) => item.form) : null; }};
"""


def cli(*args, script=AUTHOR, timeout=600):
    return subprocess.run([NODE, str(script), *map(str, args)], cwd=ROOT, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")})


def stage(tmp, mutate=None):
    doc = json.loads((FIXTURE / "variety.pages.json").read_text(encoding="utf-8"))
    if mutate:
        mutate(doc)
    shutil.copy(FIXTURE / "variety.insights.json", Path(tmp) / "variety.insights.json")
    file = Path(tmp) / "variety.pages.json"
    file.write_text(json.dumps(doc), encoding="utf-8")
    return file


class AllocationTests(unittest.TestCase):
    def test_a_free_choice_is_made_by_the_decks_hand_and_a_deck_with_no_draw_spreads_its_kinds(self):
        result = run_node(LOAD + """
const p = plan(seeded('s1')), bare = plan(doc);
const kindsOf = (pl) => { const tally = {}; for (const page of pl.pages) for (const kind of page.draws) tally[kind] = (tally[kind] ?? 0) + 1; return tally; };
const top3 = (tally) => { const counts = Object.values(tally).sort((a, b) => b - a), n = counts.reduce((sum, v) => sum + v, 0); return counts.slice(0, 3).reduce((sum, v) => sum + v, 0) / n; };
// The same spine drawn the way the plan drew it before the fit was read: the type's first form, a line for every series and a bar for every set.
const first = doc.pages.filter((page) => page.type).flatMap((page) => { const target = Object.values(PAGE_TYPES[page.type].forms)[0];
  return page.type === 'panels' || page.type === 'numbers' ? (page.evidence ?? []).slice(0, page.type === 'panels' ? 2 : 1).map((id) => (insights.get(id).shape === 'series' ? 'chart.line' : 'chart.bar')) : String(target).startsWith('chart.') ? [target] : []; });
const firstTally = {}; for (const kind of first) firstTally[kind] = (firstTally[kind] ?? 0) + 1;
const reasons = (pl) => [...new Set([...pl.pages.filter((page) => page.also).map((page) => page.by), ...pl.pages.flatMap((page) => (page.kinds ?? []).filter((item) => item.also.length).map((item) => item.by))])];
console.log(JSON.stringify({ seeded: reasons(p), bare: reasons(bare),
  spread: top3(kindsOf(p)), kinds: Object.keys(kindsOf(p)).length, firstSpread: top3(firstTally), firstKinds: Object.keys(firstTally).length,
  unused: p.structure.standings.find((standing) => standing.code === 'VARIETY_FIT_UNUSED').value }));
""")
        # A deck with a draw: the rules, what the draw features, one kind for every cut of a page, and its own hand. Never the spread.
        self.assertTrue(set(result["seeded"]) <= {"rules", "featured", "matched", "seed"}, result["seeded"])
        self.assertIn("seed", result["seeded"])
        # A deck with none has no hand: it spreads its kinds, and the catalogue's order breaks what is left.
        self.assertTrue(set(result["bare"]) <= {"rules", "matched", "spread", "room", "order"}, result["bare"])
        self.assertIn("spread", result["bare"])
        # The allocation draws more kinds, less concentrated, than the first form of every type would on the same spine.
        self.assertGreater(result["kinds"], result["firstKinds"])
        self.assertLess(result["spread"], result["firstSpread"])
        self.assertEqual(result["unused"], 0)

    def test_a_deck_has_one_hand_for_each_reading_task_and_a_mark_takes_its_turn_by_its_place_in_it(self):
        # The draw was made page by page, after the spread: every deck from one spine was the same mixture of all the equals, and
        # a scaffold of the same insight under another page id drew another kind.
        result = run_node(LOAD + """
const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const cut = (id) => ({ id, type: 'panels', evidence: ['i-profile'], settles: { kind: 'comparison', what: 'w', measures: ['i-profile/punctuality', 'i-profile/cost'], relation: { kind: 'separate', reason: 'each is its own ranking in its own unit' } } });
// One reading task, three kinds of equal fit: which page asks does not change the answer.
const byPage = seeds.map((seed) => new Set(['x', 'y', 'p07', 'another'].map((id) => openKinds(cut(id), insights, { seed })[0].kind)).size);
const leads = seeds.map((seed) => openKinds(cut('x'), insights, { seed })[0].kind);
// The hand: every kind that can carry a task best, in one order a seed; the leading marks of five tasks are five kinds.
const hands = seeds.map((seed) => handOf(seed));
const five = ['rank', 'trend', 'pair', 'part-of-whole', 'mix-compared'];
// Whose turn: a running count of what the deck has drawn, the lead taken until it is two to one and three to one.
const single = { ...cut('x'), settles: { kind: 'rank', what: 'w', measures: ['i-profile/punctuality'] } };
const turns = (seed) => { const tally = new Map(); const order = [];
  for (let n = 0; n < 11; n += 1) { const kind = openKinds(single, insights, { seed, fewest: (k) => tally.get(k) ?? 0 })[0].kind; tally.set(kind, (tally.get(kind) ?? 0) + 1); order.push(kind); }
  const hand = handOf(seed).get('rank'); return { counts: hand.map((kind) => tally.get(kind) ?? 0), first: order[0] === hand[0] }; };
console.log(JSON.stringify({ byPage, leads: new Set(leads).size, ranks: hands.map((hand) => [...hand.get('rank')].sort().join()), distinct: hands.map((hand) => new Set(five.map((task) => hand.get(task)[0])).size),
  again: JSON.stringify([...handOf('a')]) === JSON.stringify([...hands[0]]), order: hands.map((hand) => hand.get('rank').join()).length, orders: new Set(hands.map((hand) => hand.get('rank').join())).size,
  rank: seeds.map((seed) => handOf(seed).get('rank').map((kind) => markRank(seed, 'rank', kind)).join()), turns: seeds.slice(0, 3).map(turns) }));
""")
        self.assertEqual(result["byPage"], [1] * 8)                  # one seed, one mark, whatever the page
        self.assertGreaterEqual(result["leads"], 2)                  # and eight seeds lead with more than one
        self.assertEqual(set(result["ranks"]), {"chart.bar,chart.column,chart.lollipop"})
        self.assertEqual(result["distinct"], [5] * 8)                # no two tasks lead with one kind where the table gives them another
        self.assertTrue(result["again"])
        self.assertGreaterEqual(result["orders"], 3)
        self.assertEqual(set(result["rank"]), {"0,1,2"})
        for turn in result["turns"]:
            self.assertTrue(turn["first"])
            self.assertEqual(turn["counts"], [6, 3, 2], turn)        # eleven cuts of one task: the hand's order, six to three to two

    def test_the_draw_features_two_of_the_systems_repertoire_and_the_plan_prefers_their_forms_among_equals(self):
        result = run_node(LOAD + """
const draws = Object.fromEntries(DESIGN_NAMES.map((design) => [design, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) => featuredDraw(seed, design))]));
// Every form and kind a repertoire entry names is one the catalogue has.
const named = Object.values(REPERTOIRE).flat().flatMap((entry) => [...(entry.forms ?? []).map((key) => { const [type, form] = key.split('/'); return Object.hasOwn(PAGE_TYPES[type]?.forms ?? {}, form); }), ...(entry.kinds ?? []).map((kind) => kind.startsWith('chart.'))]);
const page = { id: 'x', type: 'panels', evidence: ['i-profile'], settles: { kind: 'comparison', what: 'w', measures: ['i-profile/punctuality', 'i-profile/cost'], relation: { kind: 'separate', reason: 'each is its own ranking in its own unit' } } };
const fewest = (kind) => (kind === 'chart.column' ? 0 : 9);
const plain = openKinds(page, insights, { seed: 's' }), featured = openKinds(page, insights, { seed: 's', featured: new Set(['chart.lollipop']) }), spread = openKinds(page, insights, { fewest }), turned = openKinds(page, insights, { seed: 's', fewest });
console.log(JSON.stringify({ said: draws.consulting.every((draw) => draw.say.length === 2), again: JSON.stringify([...featuredDraw('a', 'journal').forms]) === JSON.stringify([...draws.journal[0].forms]),
  varies: new Set(draws.journal.map((draw) => [...draw.forms].sort().join())).size, named: named.every(Boolean), unknown: [...featuredDraw('a', 'nothing').forms].length >= 0,
  plain: plain.map((item) => item.by), featured: featured.map((item) => [item.kind, item.by]), spread: spread.map((item) => [item.kind, item.by]), turned: turned.map((item) => [item.kind, item.by]) }));
""")
        self.assertTrue(result["said"] and result["again"] and result["named"])
        self.assertGreater(result["varies"], 2)
        # Among kinds that carry a cut equally: one the draw features, then the deck's hand; a deck with no draw takes the one it draws least.
        self.assertEqual(result["featured"], [["chart.lollipop", "featured"]] * 2)
        self.assertEqual(result["spread"], [["chart.column", "spread"]] * 2)
        self.assertEqual(set(result["plain"]), {"seed"})
        # A kind the deck has drawn nine times more than another has lost its turn, whatever its place in the hand: the turn is the draw's.
        self.assertEqual(result["turned"], [["chart.column", "seed"]] * 2)

    def test_a_rule_the_best_fit_forms_cannot_meet_is_reported_unmet_and_never_met_with_a_weaker_form(self):
        # Eighteen pages, three of them panels: the floor on pages of two or more exhibits wants a fourth, and the only form that
        # would give one is a strip over a chart on a page of four single figures, which a grid or a list carries and a strip does
        # not. The plan said nothing of fit and took the strip. The best-fit forms cannot meet two more: three pages of
        # figures in eighteen pass the tenth of a deck the numbers family is held to, and with points below capped they
        # cannot spread the pages' architectures; a search over every form meets all three.
        result = run_node(LOAD + """
const one = (id, type, evidence, measures, more = {}) => ({ id, type, title: `Page ${id} states a finding of its own about the operator`, why: 'the claim decides the type', evidence, settles: { kind: 'comparison', what: 'w', measures, ...more } });
const round = (n) => [
  one(`a${n}`, 'trend', ['i-journeys'], ['i-journeys/journeys']), one(`b${n}`, 'ranking', ['i-punctual'], ['i-punctual/punctuality']), one(`c${n}`, 'composition', ['i-revenue-parts'], ['i-revenue-parts/revenue']),
  one(`d${n}`, 'panels', ['i-profile'], ['i-profile/punctuality', 'i-profile/cost'], { relation: { kind: 'separate', reason: 'each is its own ranking in its own unit' } }),
  one(`e${n}`, 'lookup', ['i-operators'], ['northvale', 'coast', 'midland'].map((name) => `i-operators/${name}`)), one(`f${n}`, 'numbers', ['i-estate'], ['i-estate/stations', 'i-estate/staff', 'i-estate/depots', 'i-estate/lines'])];
const d = { deck: { ...doc.deck, variation: 's1' }, pages: [...round(1), ...round(2), ...round(3)] };
const strict = plan(d), loose = plan(d, { forms: 'any' });
const outside = (p) => p.pages.filter((page) => { const forms = best(d.pages.find((x) => x.id === page.id)); return forms && !forms.includes(page.form); }).map((page) => `${page.id} ${page.form}`);
console.log(JSON.stringify({ strict: { unsatisfied: strict.unsatisfied.map((u) => u.code), outside: outside(strict), pinned: strict.pinned.length, served: strict.pages.filter((page) => page.served).length },
  loose: { unsatisfied: loose.unsatisfied.map((u) => u.code), outside: outside(loose), served: loose.pages.filter((page) => page.served).map((page) => `${page.id} ${page.form}`), best: loose.pages.find((page) => page.served && page.form === 'metric-strip')?.served } }));
""")
        strict, loose = result["strict"], result["loose"]
        self.assertEqual(strict["unsatisfied"], ["VARIETY_PANELS", "VARIETY_EXHIBIT_MIX", "PAGE_SHAPE_FLAT"])
        self.assertEqual([strict["outside"], strict["served"]], [[], 0])
        self.assertEqual(strict["pinned"], 18)   # every page is held to fewer forms than its type has, and the plan names them
        # Asked whether any form the catalogue allows meets it - a draft's question - the search finds one, and marks the page it moved.
        self.assertEqual(loose["unsatisfied"], [])
        self.assertTrue(any(re.match(r"^f\d metric-strip$", page) for page in loose["outside"]), loose["outside"])
        self.assertEqual(loose["served"], loose["outside"])
        self.assertEqual(sorted(loose["best"]), ["fact-grid", "stat-list"])

    def test_a_declared_form_is_kept_and_never_changed_for_one_that_fits_its_claim_less(self):
        result = run_node(LOAD + """
const declared = { ...seeded('s1'), pages: doc.pages.map((page) => (page.id === 'v09' ? { ...page, form: 'column', commentary: 'below' } : page.id === 'v04' ? { ...page, form: 'bar' } : page)) };
const p = plan(declared);
console.log(JSON.stringify({ v09: formOf(p, 'v09'), v04: formOf(p, 'v04'), unused: p.structure.standings.find((standing) => standing.code === 'VARIETY_FIT_UNUSED') }));
""")
        # A column for ten members only serves a ranking, and paired bars two dates of ten: both are the author's, kept and named.
        self.assertEqual([result["v09"]["form"], result["v09"]["source"], result["v09"]["better"]], ["column", "declared", ["bar", "lollipop"]])
        self.assertEqual([result["v04"]["form"], result["v04"]["source"], result["v04"]["better"]], ["bar", "placed", ["dumbbell"]])
        self.assertEqual(sorted(result["unused"]["pages"]), ["v04", "v09"])
        self.assertFalse(result["unused"]["blocks"])


class PlanWriteTests(unittest.TestCase):
    def test_the_plan_writes_its_choices_into_the_file_each_page_is_written_in(self):
        """A hundred-page spine's allocation was copied into seven part files by a script; --write puts each
        choice where its page is written, and leaves what a page declares as it is."""
        home = Path(tempfile.mkdtemp(prefix="plan-write-"))
        try:
            def seed(doc):
                doc["deck"]["variation"] = "s1"
            file = stage(home, seed)
            doc = json.loads(file.read_text(encoding="utf-8"))
            # The second half of the pages moves to a part, written with two-space indents; one page keeps a declared form.
            half = len(doc["pages"]) // 2
            (home / "pages").mkdir()
            part = {"pages": doc["pages"][half:]}
            (home / "pages" / "back.pages.json").write_text(json.dumps(part, indent=2) + "\n", encoding="utf-8")
            doc["pages"] = doc["pages"][:half] + [{"include": "pages/back.pages.json"}]
            file.write_text(json.dumps(doc), encoding="utf-8")
            plan = cli(file, "--plan", "--write")
            printed = json.loads(plan.stdout)["plan"]
            self.assertTrue(printed["satisfied"])
            self.assertIn("written into", plan.stderr)
            chosen = {line.split()[0]: line.split()[1].split("/")[1:] for line in printed["pages"]}
            front = json.loads(file.read_text(encoding="utf-8"))["pages"][:half]
            back = json.loads((home / "pages" / "back.pages.json").read_text(encoding="utf-8"))["pages"]
            for page in front + back:
                if page.get("type") and page.get("id") in chosen:
                    with self.subTest(page=page["id"]):
                        self.assertEqual([page.get("form"), page.get("commentary")], chosen[page["id"]])
            # The part keeps its own indentation, and the include stays an include.
            self.assertTrue((home / "pages" / "back.pages.json").read_text(encoding="utf-8").startswith('{\n  "pages"'))
            self.assertEqual(json.loads(file.read_text(encoding="utf-8"))["pages"][-1], {"include": "pages/back.pages.json"})
            # Run again, nothing is left to write.
            again = cli(file, "--plan", "--write")
            self.assertIn("written into nothing", again.stderr)
        finally:
            shutil.rmtree(home, ignore_errors=True)


class PlanCommandTests(unittest.TestCase):
    """The seeded spine planned once, its allocation copied into the pages and drafted once: what each test below reads."""

    @classmethod
    def setUpClass(cls):
        cls.home = Path(tempfile.mkdtemp(prefix="plan-command-"))
        def seed(doc):
            doc["deck"]["variation"] = "s1"
        cls.file = stage(cls.home, seed)
        cls.plan = cli(cls.file, "--plan")
        cls.planned = cls.refused()
        doc = json.loads(cls.file.read_text(encoding="utf-8"))
        for line in json.loads(cls.plan.stdout)["plan"]["pages"]:
            page_id, (_, form, commentary) = line.split()[0], line.split()[1].split("/")
            next(p for p in doc["pages"] if p.get("id") == page_id).update(form=form, commentary=commentary)
        cls.allocated = doc
        cls.file.write_text(json.dumps(doc), encoding="utf-8")
        cls.draft = cli(cls.file, "--draft")
        cls.drafted = cls.refused()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.home, ignore_errors=True)

    @classmethod
    def refused(cls):
        """What the last run refused, from its line of the run log."""
        return {(f["code"], f.get("id")) for f in json.loads((cls.home / "variety.author-log.jsonl").read_text(encoding="utf-8").splitlines()[-1])["findings"]}

    def test_the_plan_prints_how_many_forms_fit_each_page_and_what_chose_and_a_draft_lists_the_choices(self):
        plan = self.plan
        printed = json.loads(plan.stdout)["plan"]
        self.assertTrue(printed["satisfied"])
        # The plan reads the spine in the forms it proposes, as the draft will once they are copied in: the opening summary of
        # this bare spine carries no answer table, and the plan says so now and not one command later. The closing summary is
        # proposed as what to keep, which asks for none.
        self.assertEqual(plan.returncode, 2, plan.stderr[-2000:])
        unlayable = [[f["code"], f["id"]] for f in json.loads(plan.stdout)["unlayable"]]
        self.assertIn(["SPINE_UNFILLED", "v01"], unlayable)
        self.assertNotIn("v31", [page for _, page in unlayable])
        fit = printed["fit"]
        # Two dates of ten members: one form fits. Ten members on one measure: two do, and the plan says what chose.
        self.assertEqual(fit["v04"], {"task": "pair"})
        self.assertEqual(sorted([fit["v09"]["also"][0], next(line.split()[1].split("/")[1] for line in printed["pages"] if line.startswith("v09 "))]), ["bar", "lollipop"])
        self.assertIn(fit["v09"]["by"], ("seed", "rules", "featured"))
        self.assertRegex(plan.stderr, r"v09 +ranking +form (bar|lollipop) +commentary \S+ +proposed - 2 forms fit equally \((bar, lollipop|lollipop, bar)\); (bar|lollipop) chosen by ")
        self.assertRegex(plan.stderr, r"v10 +panels +form row[^\n]*exhibits chart\.(\w+), chart\.\1, chart\.\1 - 3 kinds fit equally")
        self.assertIn("How each form was chosen: a page that declares no form is given one that carries its claim best", plan.stderr)
        self.assertIn("and never a form that carries it less directly", plan.stderr)
        self.assertIn("VARIETY_KIND_SHARE: exhibits drawn in the 3 commonest kinds", plan.stderr)
        self.assertIn("else the one this deck's draw takes for that reading task - one order a deck, drawn by its `variation` (s1)", plan.stderr)
        # Without a seed the deck has no hand: its kinds are spread, the catalogue's order stands, and the plan says the deck has none.
        with tempfile.TemporaryDirectory() as tmp:
            bare = cli(stage(tmp), "--plan")
        self.assertIn("chosen by the catalogue's order (the deck has no `variation`)", bare.stderr)
        self.assertIn("chosen by the spread of the deck's kinds", bare.stderr)
        self.assertIn("this deck has none, so its kinds are spread and the catalogue's order breaks what is left: give it one with `node runtime/variation.mjs`", bare.stderr)

    def test_the_plan_prints_where_the_proposal_stands_as_the_draft_of_it_will(self):
        # A plan allocates on descriptors and estimates the exhibits of a page that has none; the standings it printed from
        # those differed from the ones the draft printed of the same spine (the exhibit kinds, their share, the pages an
        # architecture counts). They are read by the draft's own compile of the proposal now: one set of lines.
        plan = cli(self.file, "--plan")
        planned = json.loads(plan.stdout)["standing"]["S"]
        said = self.draft.stderr
        stands = said[said.index("Where the deck stands"):].splitlines()
        drafted = {line.strip().split(":")[0]: line.strip() for line in stands if line.startswith("  ") and ": " in line}
        self.assertGreater(len(planned), 20)
        self.assertEqual([line for line in planned if drafted.get(line.split(":")[0]) != line], [])
        self.assertIn("read by `--draft`'s own compile of this proposal", plan.stderr)

    def test_the_plan_refuses_at_least_what_the_draft_of_its_own_proposal_refuses(self):
        # The plan proposed the closing summary as a second executive summary and refused it for the answer table that form asks
        # for; and it read the bound facts of its proposal alone, so the draft of the choices it printed refused seven things where
        # it had refused two, under a line saying the allocation satisfied every structure rule. Copied in, a plan's choices are
        # refused by the next command for nothing the plan did not refuse first.
        self.assertIn("v31 summary/takeaways/none proposed", json.loads(self.plan.stdout)["plan"]["pages"])
        self.assertEqual(self.draft.returncode, 2)
        self.assertEqual(self.drafted - self.planned, set())
        self.assertNotIn("satisfies every structure rule", self.plan.stderr)

    def test_a_draft_lists_the_forms_that_carry_each_page_with_a_choice_and_names_a_declared_form_that_only_serves(self):
        # The plan's allocation copied into the pages, and one page declared against its claim: two dates of ten operators as paired bars.
        doc = copy.deepcopy(self.allocated)
        next(p for p in doc["pages"] if p.get("id") == "v04")["form"] = "bar"
        with tempfile.TemporaryDirectory() as tmp:
            file = stage(tmp)
            file.write_text(json.dumps(doc), encoding="utf-8")
            said = cli(file, "--draft").stderr
        self.assertIn("Which forms carry each page's claim", said)
        self.assertIn("take the one `--plan` allocates", said)
        self.assertRegex(said, r"v09 ranking/(bar|lollipop): where each member of a set stands on one measure - best fit bar, lollipop")
        self.assertIn("v04 ranking/bar: two values in one unit for each member - before and after, or one measure against another - best fit dumbbell; the declared form carries it with the reader doing work", said)
        # A page whose one best-fit form is the form it has needs no line.
        self.assertNotRegex(said, r"\n  v07 bridge/waterfall: ")
        self.assertIn("VARIETY_FIT_UNUSED: pages drawn in a form that carries their claim less directly than another they could take 1; cap 0: over by 1 page - advisory", said)


class OpenKindTests(unittest.TestCase):
    """Where the kind of an exhibit is open - panels, the chart under a strip - the deck's hand reaches it however the spine declares it.

    Two decks from one brief drew nine and six of their exhibits as bars on pages of open kinds. One author's spine declared
    those exhibits by `basis` stubs, which the plan read as a bar or a line by the measure's axis and said nothing more of; the
    other typed them by hand before the plan ran, and the plan kept them without a word. Seven in ten of the free choices in
    both decks sat on such pages.
    """

    STUBBED = LOAD + """
// The spine as an author writes it before the critique: the cuts of a panels page declared by stubs, one that says it is a table, one already typed.
const stub = (measure, more = {}) => ({ basis: { measures: [measure], ...more } });
const stubbed = (seed, more = {}) => ({ ...doc, deck: { ...doc.deck, ...(seed ? { variation: seed } : {}), ...more }, pages: doc.pages.map((page) => (
  page.id === 'v10' ? { ...page, form: 'row', exhibits: ['punctuality', 'cost', 'fleet-age'].map((m) => stub(`i-profile/${m}`)) }
  : page.id === 'v24' ? { ...page, form: 'row', exhibits: [stub('i-punctual/punctuality', { as: 'table' }), { type: 'chart.donut', ...stub('i-revenue-parts/revenue') }] } : page)) });
const at = (p, id) => p.pages.find((page) => page.id === id);
"""

    def test_an_exhibit_declared_by_an_untyped_stub_is_given_its_kind_by_the_decks_hand_and_read_as_that_kind(self):
        result = run_node(self.STUBBED + """
const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const plans = seeds.map((seed) => plan(stubbed(seed)));
const cuts = pageFit(stubbed('a').pages.find((page) => page.id === 'v10'), { registry, insights }).exhibits;
console.log(JSON.stringify({ draws: plans.map((p) => at(p, 'v10').draws.join('+')), kinds: plans.map((p) => at(p, 'v10').kinds.map((item) => item.kind).join('+')), by: [...new Set(plans.flatMap((p) => at(p, 'v10').kinds.map((item) => item.by)))],
  open: cuts.map((item) => [item.written, item.kinds.equal.map((kind) => kind.kind).sort().join()]), stated: plans.map((p) => at(p, 'v24').draws.join('+')), given: plans.map((p) => (at(p, 'v24').kinds ?? []).length),
  // The draft's stand-in reads the stub as the plan does: one kind for the deck, by page.
  same: seeds.map((seed) => { const d = stubbed(seed); const given = openKindsOf(d, insights).get(d.pages.find((page) => page.id === 'v10')); return stubsOf(d.pages.find((page) => page.id === 'v10'), insights, given).kinds.join('+'); }),
  bare: at(plan(stubbed(null)), 'v10').kinds.map((item) => item.by), again: JSON.stringify(plan(stubbed('a')).pages) === JSON.stringify(plans[0].pages) }));
""")
        # The stub is a cut still to be given a kind, with the kinds that carry it: no longer a bar because its measure runs over members.
        self.assertEqual(result["open"], [[False, "chart.bar,chart.column,chart.lollipop"]] * 3)
        self.assertEqual(result["draws"], result["kinds"])
        self.assertTrue(all(len(set(kinds.split("+"))) == 1 for kinds in result["kinds"]), result["kinds"])   # the panels match
        self.assertGreater(len(set(result["kinds"])), 1, result["kinds"])                                     # and two seeds draw them two ways
        self.assertTrue(set(result["by"]) <= {"seed", "matched", "featured"}, result["by"])
        self.assertEqual(result["same"], result["kinds"])
        # A stub that says it is a table is a table and a typed one keeps its type, under every seed; nothing is proposed for either.
        self.assertEqual(set(result["stated"]), {"table+chart.donut"})
        self.assertEqual(set(result["given"]), {0})
        self.assertTrue(set(result["bare"]) <= {"spread", "matched", "order"}, result["bare"])
        self.assertTrue(result["again"])

    def test_the_plan_prints_the_kind_a_stub_is_given_and_says_what_its_draw_would_take_of_a_choice_the_author_made(self):
        with tempfile.TemporaryDirectory() as tmp:
            def spine(doc):
                doc["deck"]["variation"] = "a"
                for page in doc["pages"]:
                    if page.get("id") == "v10":
                        page.update(form="row", exhibits=[{"basis": {"measures": [f"i-profile/{name}"]}} for name in ("punctuality", "cost", "fleet-age")])
                    if page.get("id") == "v09":
                        page.update(form="bar")
                    if page.get("id") == "v24":
                        page.update(form="row", exhibits=[{"type": "chart.bar", "basis": {"measures": ["i-punctual/punctuality"]}}, {"type": "chart.donut", "basis": {"measures": ["i-revenue-parts/revenue"]}}])
            file = stage(tmp, spine)
            plan = cli(file, "--plan")
            printed = json.loads(plan.stdout)["plan"]
            line = next(l for l in plan.stderr.splitlines() if l.startswith("  v10 "))
            kinds = printed["fit"]["v10"]["kinds"]
            self.assertEqual(len(set(kinds)), 1)
            self.assertIn(f"exhibits {', '.join(kinds)} - 3 kinds fit equally", line)
            self.assertIn("chosen by this deck's draw for the reading task (its `variation`)", line)
            self.assertIn("An exhibit the spine declares by a `basis` stub with no `type` is given its kind the same way and read as that kind: write that `type` on it.", plan.stderr)
            # The draft, which reads the pages that declare a form, counts the stubs as the kind the plan gave them - not as bars.
            self.assertEqual(kinds[0], "chart.lollipop")
            share = next(l for l in cli(file, "--draft").stderr.splitlines() if "VARIETY_KIND_SHARE: exhibits drawn in the 3 commonest kinds" in l)
            self.assertIn("(chart.lollipop 3, chart.bar 2, chart.donut 1), of 6", share)
            # A form and a kind the author declared are kept, and the line says what this deck's draw takes where it is another.
            hand = json.loads(cli("a", script=SKILL / "runtime" / "variation.mjs").stdout)["plan"]["hand"]
            self.assertEqual(sorted(hand["rank"]), ["bar", "column", "lollipop"])
            v09 = next(l for l in plan.stderr.splitlines() if l.startswith("  v09 "))
            self.assertIn("form bar", v09)
            self.assertEqual([hand["rank"][0], [kind for kind in hand["part-of-whole"] if kind in ("pie", "donut", "bar")][0]], ["lollipop", "pie"])
            self.assertIn("(also fits: lollipop; this deck's draw takes lollipop)", v09)
            self.assertEqual(printed["fit"]["v09"]["hand"], "lollipop")
            v24 = next(l for l in plan.stderr.splitlines() if l.startswith("  v24 "))
            self.assertIn("exhibit 1 (bar) fits equally with lollipop; this deck's draw takes lollipop", v24)
            self.assertRegex(v24, r"exhibit 2 \(donut\) fits equally with [a-z, ]+; this deck's draw takes pie")
            self.assertEqual(printed["fit"]["v24"]["typed"], ["exhibit 1 chart.bar: this deck's draw takes chart.lollipop", "exhibit 2 chart.donut: this deck's draw takes chart.pie"])
            # Declared choices are kept as declared.
            self.assertIn("v24 panels/row/", next(l for l in printed["pages"] if l.startswith("v24 ")))

    def test_a_scaffold_draws_the_decks_mark_whatever_the_page_and_keeps_the_kinds_the_page_names(self):
        result = run_node(f"""
import fs from 'node:fs';
import {{ scaffoldReport }} from '{KIT}/author-deck.mjs';
import {{ handOf }} from '{KIT}/claim-fit.mjs';
const log = JSON.parse(fs.readFileSync('./evals/quality/fixtures/variety/variety.insights.json', 'utf8')).insights;
const insights = new Map(log.map((item) => [item.id, item]));
const kindsOf = (report) => [report.page.exhibit, ...(report.page.exhibits || [])].filter(Boolean).map((ex) => ex.type ?? null);
const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
console.log(JSON.stringify({{
  byId: seeds.map((seed) => new Set(['p00', 'p07', 'v10', 'x'].map((id) => kindsOf(scaffoldReport('panels', {{ id, insight: insights.get('i-profile'), seed }})).join('+'))).size),
  forms: seeds.map((seed) => new Set(['p00', 'p07', 'v09'].map((id) => scaffoldReport('ranking', {{ id, insight: insights.get('i-punctual'), seed }}).form)).size),
  lead: seeds.map((seed) => [kindsOf(scaffoldReport('panels', {{ id: 'p1', insight: insights.get('i-profile'), seed }}))[0], handOf(seed).get('rank').filter((kind) => kind !== 'chart.column' || true)[0]]),
  named: seeds.map((seed) => kindsOf(scaffoldReport('panels', {{ id: 'p1', insight: insights.get('i-profile'), seed, kinds: ['chart.column', 'chart.column'] }})).join('+')) }}));
""")
        # One insight, one seed: one form and one kind a cut, under whichever page id the scaffold is asked for.
        self.assertEqual(result["byId"], [1] * 8)
        self.assertEqual(result["forms"], [1] * 8)
        self.assertGreater(len({lead for lead, _ in result["lead"]}), 1)
        self.assertTrue(all(lead == hand for lead, hand in result["lead"]), result["lead"])   # the lead of the deck's hand for the task
        # The kinds the page already names - the plan's, once written on its stubs - are the kinds scaffolded.
        self.assertEqual(set(result["named"]), {"chart.column+chart.column+chart.column"})

    def test_a_page_another_type_carries_as_directly_is_told_so_where_its_evidence_can_rest_under_that_type(self):
        result = run_node(LOAD + """
const parts = (evidence) => ({ id: 'z', type: 'composition', title: 'Fares are over half of revenue and the rest is three small lines', why: 'parts of one whole', evidence, settles: { kind: 'share', what: 'w', measures: ['i-revenue-parts/revenue'] } });
const seeds = ['a', 'b', 'c', 'd', 'e', 'f'];
const of = (evidence, seed) => formOf(plan({ ...seeded(seed), pages: [...doc.pages, parts(evidence)] }), 'z');
const both = seeds.map((seed) => of(['i-revenue-parts', 'i-punctual'], seed));
console.log(JSON.stringify({ beside: both.map((page) => (page.beside ?? []).map((item) => `${item.type}/${item.form}`).join()), hands: both.map((page) => page.typeHand ? `${page.typeHand.type}/${page.typeHand.form}` : null),
  kept: both.map((page) => page.type), mix: of(['i-revenue-parts'], 'a').beside ?? null, declared: formOf(plan({ ...seeded('a'), pages: [...doc.pages, { ...parts(['i-revenue-parts', 'i-punctual']), form: 'pie' }] }), 'z').form }));
""")
        # Four parts of one whole are sorted bars as directly as a pie: said where the page also rests on a set of peers, which a ranking can rest under.
        self.assertEqual(set(result["beside"]), {"ranking/bar"})
        self.assertEqual(set(result["kept"]), {"composition"})          # the type is the author's: said, never changed
        self.assertTrue(set(result["hands"]) <= {None, "ranking/bar"})
        self.assertIn("ranking/bar", result["hands"])                   # and under some seed the deck's draw would take it
        self.assertIn(None, result["hands"])
        # A mix alone cannot rest under a ranking: nothing is offered.
        self.assertIsNone(result["mix"])
        self.assertEqual(result["declared"], "pie")


class RevisionTests(unittest.TestCase):
    """A point change to an imported deck: the plan restyles nothing, and a new page is drawn as the source deck draws its like."""

    PROBE = LOAD + """
// The imported deck: every page of the spine with the form it was drawn in - its ranking of ten operators as bars - and the slide it came from.
const base = plan(seeded('s1'));
let n = 0;
const imported = doc.pages.map((page) => { if (!page.type) return page; const given = formOf(base, page.id); n += 1; return { ...page, form: page.id === 'v09' ? 'bar' : given.form, commentary: given.commentary, sourceSlide: n }; });
const settles = (measures, more = {}) => ({ kind: 'comparison', what: 'w', measures, ...more });
// What the revision adds: a ranking, and a page of two cuts.
const ranking = { id: 'new1', type: 'ranking', title: 'Northvale is again the most punctual of the ten operators', why: 'ten members on one measure', evidence: ['i-punctual'], settles: { ...settles(['i-punctual/punctuality']), kind: 'rank' } };
const cuts = { id: 'new2', type: 'panels', title: 'Punctuality leads and the fleet is two classes deep', why: 'two cuts side by side', evidence: ['i-punctual', 'i-fleet'], settles: settles(['i-punctual/punctuality', 'i-fleet/fleet'], { relation: { kind: 'separate', reason: 'a ranking in per cent and a count of trains' } }) };
// And an imported slide mapped to a type and no form yet, whose slide drew a bullet chart.
const mapped = { ...doc.pages.find((page) => page.id === 'v25'), sourceSlide: 99 };
const revision = (seed, pages = [...imported.filter((page) => page.id !== 'v25'), mapped, ranking, cuts]) => ({ deck: { ...doc.deck, workflow: 'existing_deck_revision', variation: seed }, pages });
const sourceKinds = new Map([[99, ['chart.bullet']]]);
"""

    def test_an_imported_page_keeps_its_form_and_a_new_page_is_drawn_as_the_source_deck_draws_its_like(self):
        result = run_node(self.PROBE + """
const seeds = ['s1', 's2', 's3', 's4', 's5'];
const plans = seeds.map((seed) => plan(revision(seed), { sourceKinds }));
const fresh = seeds.map((seed) => plan({ deck: { ...doc.deck, variation: seed }, pages: [...imported.map(({ sourceSlide, ...page }) => page), ranking, cuts] }));
const share = plans[0].structure.standings.find((standing) => standing.code === 'VARIETY_KIND_SHARE');
console.log(JSON.stringify({ changed: plans.flatMap((p) => p.pages.filter((page) => page.source === 'changed').map((page) => page.id)), satisfied: plans.map((p) => p.satisfied),
  kept: plans.every((p) => imported.filter((page) => page.type && page.id !== 'v25').every((page) => formOf(p, page.id).form === page.form)),
  ranking: plans.map((p) => [formOf(p, 'new1').form, formOf(p, 'new1').by]), mapped: plans.map((p) => [formOf(p, 'v25').form, formOf(p, 'v25').by, formOf(p, 'v25').source]),
  cuts: plans.map((p) => formOf(p, 'new2').draws.join('+')), cutsBy: [...new Set(plans.flatMap((p) => formOf(p, 'new2').kinds.map((item) => item.by)))],
  // The same pages on a new deck: the spread and the seed choose, and the seeds differ.
  freshRanking: [...new Set(fresh.map((p) => formOf(p, 'new1').form))].sort(), freshBy: [...new Set(fresh.map((p) => formOf(p, 'new1').by))],
  share: { note: share.note, blocks: share.blocks }, advised: plans[0].structure.findings.filter((f) => f.code === 'VARIETY_KIND_SHARE').length }));
""")
        self.assertEqual(result["changed"], [])                       # no imported page is proposed another form, whatever the rules say
        self.assertTrue(result["kept"])
        # The source deck draws its ranking as bars, so the added ranking is bars under every seed - where a new deck, which
        # already draws bars on several pages, would spread its kinds and give the page the form it has drawn least.
        self.assertEqual(result["ranking"], [["bar", "convention"]] * 5)
        self.assertEqual(result["freshRanking"], ["lollipop"])
        self.assertTrue(set(result["freshBy"]) <= {"spread", "seed"}, result["freshBy"])
        # A slide mapped to a type and no form takes the form that draws what the slide drew, though a bar fits as well.
        self.assertEqual(result["mapped"], [["bullet", "source", "proposed"]] * 5)
        # An open exhibit takes the kind the source deck draws most among those that fit, the same under every seed.
        self.assertEqual(len(set(result["cuts"])), 1)
        self.assertTrue(set(result["cutsBy"]) <= {"convention", "matched", "only"}, result["cutsBy"])
        # The share is read of the imported deck and never advised on: a revision does not redraw it.
        self.assertIn("read of the imported deck as revised, which a revision does not redraw", result["share"]["note"])
        self.assertEqual([result["share"]["blocks"], result["advised"]], [False, 0])

    def test_a_stub_a_revision_adds_is_drawn_as_the_source_deck_draws_its_like_and_nothing_tells_it_its_draw(self):
        # The deck's own hand is for a new deck: on a revision an untyped stub takes the kind the source deck draws most among
        # those that carry it, the same under every seed, and no line says what the draw would take of a page the user drew.
        result = run_node(self.PROBE + """
const seeds = ['s1', 's2', 's3', 's4', 's5', 's6'];
const stubs = { ...cuts, id: 'new4', form: 'row', exhibits: [{ basis: { measures: ['i-punctual/punctuality'] } }, { basis: { measures: ['i-fleet/fleet'] } }] };
const plans = seeds.map((seed) => plan(revision(seed, [...imported, stubs]), { sourceKinds }));
const fresh = seeds.map((seed) => plan({ deck: { ...doc.deck, variation: seed }, pages: [...imported.map(({ sourceSlide, ...page }) => page), stubs] }));
console.log(JSON.stringify({ kinds: plans.map((p) => formOf(p, 'new4').draws.join('+')), by: [...new Set(plans.flatMap((p) => formOf(p, 'new4').kinds.map((item) => item.by)))],
  told: plans.flatMap((p) => p.pages.filter((page) => page.hand || page.typed || page.typeHand).map((page) => page.id)), changed: plans.flatMap((p) => p.pages.filter((page) => page.source === 'changed').map((page) => page.id)),
  freshBy: [...new Set(fresh.flatMap((p) => formOf(p, 'new4').kinds.map((item) => item.by)))], freshTold: fresh.some((p) => p.pages.some((page) => page.hand || page.typed)) }));
""")
        self.assertEqual(len(set(result["kinds"])), 1, result["kinds"])
        self.assertTrue(set(result["by"]) <= {"convention", "matched", "only"}, result["by"])
        self.assertEqual([result["told"], result["changed"]], [[], []])
        # The same page on a new deck is drawn by the deck's hand, and the deck's declared choices are told what its draw would take.
        self.assertTrue(set(result["freshBy"]) <= {"seed", "matched", "only"}, result["freshBy"])
        self.assertNotIn("convention", result["freshBy"])
        self.assertTrue(result["freshTold"])

    def test_a_revision_with_no_insight_log_plans_as_it_did_and_a_one_page_change_costs_one_run(self):
        # Most revisions carry typed numbers and no measures: nothing here asks for a log, and no fit is read or advised.
        result = run_node(self.PROBE + """
const bare = revision('s1', [...imported, { id: 'new3', type: 'parallel', title: 'Three conditions the order has to meet before it is placed', why: 'three parallel points' }]);
const p = allocateStructure(bare, { insights: null, planOf });
console.log(JSON.stringify({ changed: p.pages.filter((page) => page.source === 'changed').map((page) => page.id),
  kept: imported.filter((page) => page.type).every((page) => formOf(p, page.id).form === page.form), fit: p.pages.filter((page) => page.task || page.kinds).length,
  added: [formOf(p, 'new3').form, formOf(p, 'new3').by, imported.find((page) => page.id === 'v23').form],
  standings: p.structure.standings.filter((standing) => /VARIETY_(KIND_SHARE|FIT_UNUSED)/.test(standing.code)).map((standing) => standing.code), evaluations: p.evaluations > 0 }));
""")
        self.assertEqual(result["changed"], [])
        self.assertTrue(result["kept"])
        self.assertEqual(result["fit"], 0)
        self.assertEqual(result["standings"], ["VARIETY_KIND_SHARE"])   # the share is counted; nothing is judged without measures
        # The deck's own way of drawing is read from its declared forms, which needs no measure - but the rules come first: a
        # second card set would take the numbers family to its cap, so the added page of points is drawn another way, and says why.
        self.assertEqual(result["added"][1], "rules")
        self.assertNotEqual(result["added"][0], result["added"][2])

    def test_the_plan_command_reads_the_inventory_beside_a_revisions_pages_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            def revise(doc):
                doc["deck"].update(workflow="existing_deck_revision", inventory="variety.inventory.json", variation="s1")
                for at, page in enumerate([p for p in doc["pages"] if p.get("type")], 1):
                    page["sourceSlide"] = at
            file = stage(tmp, revise)
            doc = json.loads(file.read_text(encoding="utf-8"))
            typed = [p for p in doc["pages"] if p.get("type")]
            # The source deck drew its ranking of ten operators as columns, and its fleet as a pie.
            charts = {"v09": "COLUMN_CLUSTERED", "v22": "PIE"}
            inventory = {"schema": "professional-slides.inventory/v1", "id": "variety", "source": {"file": "variety.pptx", "sha256": "0" * 64}, "slideSize": {"width": 1280, "height": 720},
                         "slides": [{"index": p["sourceSlide"], "id": p["id"], "title": p["title"], "hidden": False, "paragraphs": [], "tables": [], "pictures": [],
                                     "charts": ([{"type": charts[p["id"]], "categories": [], "series": []}] if p["id"] in charts else [])} for p in typed]}
            (Path(tmp) / "variety.inventory.json").write_text(json.dumps(inventory), encoding="utf-8")
            plan = cli(file, "--plan")
            printed = json.loads(plan.stdout)["plan"]
            lines = {line.split()[0]: line for line in printed["pages"]}
            # Columns only serve a ranking of ten and five parts are the most a pie holds, and both pages are drawn as their slides were.
            self.assertIn("v09 ranking/column/", lines["v09"])
            self.assertIn("v22 composition/pie/", lines["v22"])
            self.assertEqual([printed["fit"]["v09"]["by"], printed["fit"]["v22"]["by"]], ["source", "source"])
            self.assertRegex(plan.stderr, r"v09 +ranking +form column[^\n]*chosen by what its source slide drew")
            self.assertIn("On a revision nothing is spread: an imported page keeps the form it declares", plan.stderr)
            self.assertNotIn("VARIETY_FIT_UNUSED: pages drawn in a form that carries their claim less directly than another they could take 1", plan.stderr)


class VariabilityEvalTests(unittest.TestCase):
    def test_the_eval_holds_its_four_assertions_on_the_fixed_spine_and_reports_the_distances(self):
        run = cli("--seeds", "3", "--designs", "consulting,journal", "--json", "--allocations", FIXTURE / "variety.pages.json", script=EVAL)
        self.assertEqual(run.returncode, 0, run.stderr[-1500:] + run.stdout[-1500:])
        report = json.loads(run.stdout)
        self.assertTrue(report["accepted"])
        spine = report["results"][0]
        self.assertEqual([spine["pages"], spine["free"] + spine["pinned"] + spine["unread"]], [31, 31])
        self.assertGreaterEqual(spine["free"], 10)
        self.assertGreaterEqual(spine["pinned"], 5)
        self.assertTrue(spine["freeVaried"])                                   # (a)
        self.assertGreaterEqual(len(spine["freeVaried"]), spine["free"] // 2)  # the seed reaches the pages with a choice
        self.assertEqual(spine["pinnedVaried"], [])                            # (b)
        self.assertEqual(spine["outsideBestFit"], [])                          # (c)
        self.assertTrue(spine["reproducible"])                                 # (d)
        self.assertTrue(spine["satisfied"])
        # Three seeds under each of two designs: a different deck a seed, one pair of seeds aside.
        decks = {design: len({json.dumps(a["pages"]) for a in spine["allocations"] if a["design"] == design}) for design in ("consulting", "journal")}
        self.assertGreaterEqual(sum(decks.values()), 5, decks)
        self.assertGreater(spine["betweenSeeds"]["pages"], 0.05)
        self.assertGreater(spine["betweenSeeds"]["kinds"], 0)
        self.assertLessEqual(spine["betweenSeeds"]["pages"], spine["betweenSeeds"]["free"])
        self.assertLess(spine["concentration"]["high"], 0.6)
        # What a reader sees between two seeds: the pages that draw an exhibit whose kinds differ, the two decks' top three kinds,
        # and how many chart pages another page type carries as directly - the type's own latitude, which this spine has none of.
        reader = spine["reader"]
        self.assertGreaterEqual(reader["exhibitPages"], 20)
        self.assertGreater(reader["differing"], 0.05)
        self.assertTrue(0 <= reader["topThreeShared"] <= 3)
        self.assertLess(reader["topThreeShared"], 3)                           # two seeds do not always lead with the same three kinds
        self.assertLessEqual(reader["topThree"]["low"], reader["topThree"]["high"])
        self.assertEqual([spine["spine"], spine["typeLatitude"]["pages"]], ["open", []])
        self.assertGreaterEqual(spine["typeLatitude"]["chartPages"], 10)

    def test_the_eval_reads_a_spine_whose_open_exhibits_are_declared_by_stubs_as_its_critique_does(self):
        # The spine a deck's critique reads declares the exhibits of a panels page or a strip by `basis` stubs. Planned so, every
        # seed read each as a bar or a line by its axis, and two decks from one spine shared all three of their commonest kinds.
        result = run_node("""
import fs from 'node:fs';
import { spineOf } from './evals/quality/variability.mjs';
const doc = JSON.parse(fs.readFileSync('./evals/quality/fixtures/evidence/finance.pages.json', 'utf8'));
const typed = { deck: {}, pages: [{ id: 'a', type: 'panels', form: 'row', title: 't', exhibits: [{ type: 'chart.bar', series: [{ measure: 'i-one/level', name: 'One' }], heading: 'h' }, { type: 'table', columns: ['x'], rows: [['{{i-two/count | 0}}']], basis: { measures: ['i-two/count'] } }] },
  { id: 'b', type: 'trend', form: 'line', title: 't', exhibit: { series: [{ measure: 'i-one/level' }] } }, { id: 'c', type: 'numbers', form: 'metric-strip', title: 't', exhibit: { type: 'chart.column', series: [{ measure: ['i-one/level', 'i-one/path'] }] } }] };
const kept = spineOf(typed, { stubs: true }).pages, stripped = spineOf(typed).pages;
console.log(JSON.stringify({ kept: kept.map((page) => page.exhibits ?? page.exhibit ?? null), stripped: stripped.map((page) => Object.keys(page).sort().join()), fixture: spineOf(doc, { stubs: true }).pages.filter((page) => page.exhibit || page.exhibits).length >= 0 }));
""")
        self.assertEqual(result["kept"], [[{"basis": {"measures": ["i-one/level"]}}, {"basis": {"measures": ["i-two/count"], "as": "table"}}], None, {"basis": {"measures": ["i-one/level", "i-one/path"]}}])
        self.assertEqual(result["stripped"], ["id,title,type"] * 3)
        with tempfile.TemporaryDirectory() as tmp:
            def written(doc):
                for page in doc["pages"]:
                    if page.get("id") == "v10":
                        page.update(form="row", exhibits=[{"type": "chart.bar", "series": [{"measure": f"i-profile/{name}", "name": name}]} for name in ("punctuality", "cost", "fleet-age")])
            file = stage(tmp, written)
            run = cli("--seeds", "4", "--designs", "consulting", "--stubs", "--json", "--allocations", file, script=EVAL)
            self.assertEqual(run.returncode, 0, run.stderr[-1500:] + run.stdout[-1500:])
            spine = json.loads(run.stdout)["results"][0]
            self.assertEqual(spine["spine"], "stubs")
            drawn = {next(line for line in allocation["pages"] if line.startswith("v10 ")) for allocation in spine["allocations"]}
            # The three stubs are given one kind a deck, of the kinds that carry a ranking of eight - and not the same kind under every seed.
            self.assertTrue(all(any(f"[{', '.join([kind] * 3)}]" in line for kind in ("chart.bar", "chart.column", "chart.lollipop")) for line in drawn), drawn)
            self.assertGreater(len(drawn), 1, drawn)
            self.assertGreater(spine["reader"]["differing"], 0.05)
            self.assertEqual(spine["pinnedVaried"], [])

    def test_the_eval_fails_a_plan_that_gives_a_page_a_form_outside_its_best_fit_or_moves_a_pinned_page(self):
        result = run_node("""
import { failuresOf, kindDistance } from './evals/quality/variability.mjs';
const ok = { free: 4, freeVaried: ['a'], pinnedVaried: [], outsideBestFit: [], reproducible: true, unsatisfied: [] };
console.log(JSON.stringify({ ok: failuresOf(ok, { seeds: 3 }), same: failuresOf({ ...ok, freeVaried: [] }, { seeds: 3 }).length, pinned: failuresOf({ ...ok, pinnedVaried: ['p4'] }, { seeds: 3 }),
  outside: failuresOf({ ...ok, outsideBestFit: ['p9'] }, { seeds: 3 }).length, twice: failuresOf({ ...ok, reproducible: false }, { seeds: 3 }).length,
  types: failuresOf({ ...ok, unsatisfied: [{ code: 'VARIETY_TYPE_SHARE', fixedByTypes: true }] }, { seeds: 3 }).length, rule: failuresOf({ ...ok, unsatisfied: [{ code: 'VARIETY_PANELS', fixedByTypes: false }] }, { seeds: 3 }).length,
  none: failuresOf({ ...ok, free: 0, freeVaried: [] }, { seeds: 3 }).length,
  distance: [kindDistance(new Map([['a', 2], ['b', 2]]), new Map([['a', 1], ['b', 1]])), kindDistance(new Map([['a', 3]]), new Map([['b', 3]])), kindDistance(new Map([['a', 3], ['b', 1]]), new Map([['a', 1], ['b', 3]])) > 0] }));
""")
        self.assertEqual([result["ok"], result["none"], result["types"]], [[], 0, 0])
        self.assertEqual([result["same"], result["outside"], result["twice"], result["rule"]], [1, 1, 1, 1])
        self.assertIn("(b) pages with one best-fit form were allocated differently: p4", result["pinned"][0])
        self.assertEqual(result["distance"], [0, 1, True])   # one distribution, two that share no kind, two that share some


if __name__ == "__main__":
    unittest.main()
