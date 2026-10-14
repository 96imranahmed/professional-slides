// What each section of a deck written side by side holds for the whole deck, settled before any skeleton is written
// (`author-deck.mjs <id>.pages.json --allocate [--write]`).
//
// Sections written in parallel each see the deck only as the others stand when they look. The rules that read the whole
// deck - the kinds of exhibit it draws, the values its median chart page plots, the peer sets its comparisons name - were met
// by no section on its own: each could assume another would draw the kind, deepen the chart or declare the set, and the
// whole-deck compile after the writers found the shortfall, when meeting it meant redrawing written pages, taking them back
// to the critique and reading their claims again. The insights were nobody's either: two skeletons built on one insight, and
// the second found it taken only at the plan, with pages short of the evidence they were budgeted for. A floor met that late
// is met by changing forms on finished pages, and a form chosen to add a kind rather than to carry a claim is one the review
// sends back. So the lead settles four things before the skeletons start, each from the records alone:
//
//   - each insight's home: the one section that builds pages on it (`evidence` in the part file), and the insights a section
//     re-reads on purpose from another (`rereads`) - an executive summary, a synthesis that closes the deck;
//   - each kind of exhibit the deck's floor needs, given to one section whose own evidence can draw it, each proven the way
//     `--scaffold <type>/<form> --evidence` binds it (`allocation.kinds` in the part file, written by `--allocate --write`);
//   - the depth each section's chart pages keep: at least half of them plot the deck's median floor of values, so the deck's
//     median holds whatever the other sections do;
//   - the peer sets the deck's comparisons will name, proposed from every measure whose members are declared players.
//
// Each section is then held to its own share - in its brief, and on its own pages' check - and the whole-deck compile confirms
// what the sections met rather than discovering what none of them did.
import { PAGE_TYPES, declaredSlide, placementsOf } from "./page-types.mjs";
import { TYPE_SHAPES } from "./evidence.mjs";
import { axisOf, measureRegistry, valuesOf } from "./measures.mjs";
import { PLAN } from "./weight.mjs";
import { VARIETY, exhibitKinds } from "./gates/variety_gates.mjs";
import { drawOf, evidenceExhibits, pageMeasures, seriesHidden, stubsOf } from "./deck-structure.mjs";
import { conventionsOf, peerSetOf, playerInLabel } from "./conventions.mjs";
import { includedParts, partHomes, partsOf } from "./pages-file.mjs";

// The section a page written in the pages file itself belongs to, beside the part files.
export const ROOT_SECTION = "(the pages file)";
// The insights a kind is proven from in one section: enough that each insight can be given one kind and the rest still placed.
const PROOFS = 3;
const partName = (part) => String(part).replace(/^.*\//, "").replace(/(\.pages)?\.json$/, "");
const pagesOf = (doc) => [...(doc?.pages || []), ...(doc?.appendix || [])].filter((page) => page && typeof page === "object" && !page.include);
const evidenceIds = (page) => (Array.isArray(page?.evidence) ? page.evidence.map(String) : []);

/**
 * Where each insight lives: `{ declared, home, rereads, twice, sections }`. `home` maps an insight to the one section whose
 * `evidence` names it; `twice` lists an insight two sections both name, with the sections; `rereads` maps a section to the
 * insights it re-reads from others on purpose. `declared` is false where no part names its evidence: a deck that has not
 * settled its homes is read as before, every insight open to every section.
 */
export function evidenceHomes(doc) {
  const homes = partHomes(doc), home = new Map(), rereads = new Map(), seen = new Map();
  for (const [part, entry] of homes) {
    for (const id of entry.evidence ?? []) (seen.get(id) ?? seen.set(id, []).get(id)).push(part);
    rereads.set(part, new Set(entry.rereads ?? []));
  }
  const twice = [];
  for (const [id, parts] of seen) { if (parts.length > 1) twice.push({ id, parts }); else home.set(id, parts[0]); }
  return { declared: [...homes.values()].some((entry) => Array.isArray(entry.evidence)), home, rereads, twice, sections: [...homes.keys()] };
}

/**
 * The findings the homes raise, at the spine and on every check after it: an insight two sections both name (a blocker - the
 * lead gives it one home, and the other section a `rereads`), an insight the log does not hold, and each page that builds on an
 * insight another section holds without re-reading it on purpose. Nothing is said of a deck that declares no homes.
 */
export function homeFindings(doc, insights) {
  const homes = evidenceHomes(doc);
  if (!homes.declared) return [];
  const out = [], parts = partsOf(doc);
  for (const { id, parts: both } of homes.twice)
    out.push({ code: "EVIDENCE_HOMED_TWICE", severity: "blocker", measured: { insight: id, sections: both.map(partName) },
      repair: `${id} is named in the \`evidence\` of ${both.map((part) => `${partName(part)} (${part})`).join(" and ")}: an insight has one home, the section that builds pages on it. Keep it in one part's \`evidence\`, and where another section re-reads it on purpose - a summary, a synthesis - list it in that part's \`rereads\`` });
  if (insights) {
    const unknown = [...homes.home.keys(), ...homes.twice.map((t) => t.id), ...[...homes.rereads.values()].flatMap((set) => [...set])].filter((id) => !insights.has(id));
    if (unknown.length) out.push({ code: "EVIDENCE_UNKNOWN", severity: "blocker", measured: { insights: [...new Set(unknown)] },
      repair: `the part files name ${[...new Set(unknown)].map((id) => `"${id}"`).join(", ")} in \`evidence\` or \`rereads\`, which the insight log does not hold: name each insight by its id in the log` });
  }
  for (const page of pagesOf(doc)) {
    const id = String(page.id ?? ""), part = parts.get(id) ?? null;
    if (!part || page.kind) continue;
    const own = homes.rereads.get(part) ?? new Set();
    const elsewhere = evidenceIds(page).filter((ref) => homes.home.has(ref) && homes.home.get(ref) !== part && !own.has(ref));
    // An insight no section holds is open to two sections at once: the one that builds on it takes it home first.
    const open = evidenceIds(page).filter((ref) => !homes.home.has(ref) && !homes.twice.some((t) => t.id === ref) && !own.has(ref) && insights?.get?.(ref) && !insights.get(ref).derived);
    if (open.length) out.push({ code: "EVIDENCE_UNHOMED", id, severity: "blocker", measured: { insights: open },
      repair: `${id} builds on ${open.join(", ")}, which no section holds: add ${open.length === 1 ? "it" : "them"} to ${partName(part)}'s \`evidence\` (its part file) so no other section builds on ${open.length === 1 ? "it" : "them"} too, or rest the page on this section's own evidence` });
    if (elsewhere.length) out.push({ code: "EVIDENCE_ELSEWHERE", id, severity: "blocker", measured: { insights: elsewhere, held: elsewhere.map((ref) => partName(homes.home.get(ref))) },
      repair: `${id} builds on ${elsewhere.map((ref) => `${ref} (held by ${partName(homes.home.get(ref))})`).join(", ")}: another section holds ${elsewhere.length === 1 ? "that insight" : "those insights"} and builds its own pages on ${elsewhere.length === 1 ? "it" : "them"}. Rest this page on this section's own evidence (its part's \`evidence\`), or, where the page re-reads it on purpose, ask the lead to list it in ${partName(part)}'s \`rereads\`` });
  }
  return out;
}

/** The values an insight can plot: across its measures, every value a chart could draw (a measure of one value plots none). */
export function plottableValues(insight) {
  const registry = measureRegistry(new Map([[String(insight?.id ?? "x"), insight]]));
  return [...registry.values()].filter((measure) => axisOf(measure).kind !== "scalar").reduce((sum, measure) => sum + valuesOf(measure).filter((value) => value !== null && value !== undefined).length, 0);
}

/** The deck's length while it is written: the parts' planned budgets, or the pages it holds where it plans none. */
export function plannedLength(doc, budgets = new Map()) {
  const parts = partsOf(doc), content = pagesOf(doc).filter((page) => !page.kind || page.kind === "content");
  const inParts = content.filter((page) => parts.has(String(page.id))).length;
  const planned = [...budgets.values()].reduce((sum, n) => sum + n, 0) + (content.length - inParts);
  return Math.max(content.length, planned);
}

/**
 * Each section's evidence as the allocation reads it: its homed insights where the deck declares homes, else the insights its
 * pages already rest on. `[{ section, insights: [id] }]`, in the deck's order, the pages file itself last where it holds pages.
 */
function sectionEvidence(doc, homes) {
  const parts = partsOf(doc), named = new Map();
  for (const page of pagesOf(doc)) {
    const section = parts.get(String(page.id)) ?? ROOT_SECTION;
    const list = named.get(section) ?? named.set(section, new Set()).get(section);
    for (const ref of evidenceIds(page)) list.add(ref);
  }
  const order = [...includedParts(doc), ...(named.has(ROOT_SECTION) ? [ROOT_SECTION] : [])];
  return order.map((section) => ({ section, insights: homes.declared && section !== ROOT_SECTION ? [...homes.home].filter(([, at]) => at === section).map(([id]) => id) : [...(named.get(section) ?? [])] }));
}

/**
 * The kinds of exhibit each section's own evidence can draw: `Map(kind -> [{ section, insight, type, form }])`, one proof a
 * section. Each insight is drawn as a page of every type its shape rests under (TYPE_SHAPES) in every form of that type,
 * estimated as a declared spine is (page-types.mjs declaredSlide); a kind counts only where the drawing shows the measures as
 * recorded (deck-structure.mjs seriesHidden) and the caller's `fills(page, type, form)` - the evidence filling the form the way
 * `--scaffold <type>/<form> --evidence` binds it - finds nothing missing. A kind already proven for a section is not proven again.
 */
export function kindReach(doc, insights, { fills = null, homes = evidenceHomes(doc) } = {}) {
  const registry = measureRegistry(insights ?? new Map()), featured = drawOf(doc.deck), players = doc.deck?.players;
  const reach = new Map();
  // A kind is proven from up to PROOFS insights a section, so the allocation can give each insight one kind at most.
  for (const { section, insights: ids } of sectionEvidence(doc, homes)) {
    const proofs = new Map();
    for (const id of ids) {
      const insight = insights?.get?.(id);
      if (!insight || !insight.shape) continue;
      for (const type of Object.keys(TYPE_SHAPES).filter((t) => PAGE_TYPES[t] && TYPE_SHAPES[t].includes(insight.shape))) for (const form of Object.keys(PAGE_TYPES[type].forms)) {
        const page = { id: `allocate-${id}`, type, form, evidence: [id] };
        let slide = null;
        try { slide = declaredSlide({ ...page, commentary: placementsOf(type, form)[0] }, 0, { exhibitType: evidenceExhibits(page, insights, featured), players, stubs: stubsOf(page, insights) }); } catch { slide = null; }
        // The kinds the deck counts are the exhibits' (VARIETY_EXHIBIT_RANGE); the form's own drawing is read only for what it hides.
        const kinds = [...new Set(slide ? exhibitKinds(slide) : [])];
        const fresh = kinds.filter((kind) => (proofs.get(kind) ?? new Set()).size < PROOFS && !(proofs.get(kind) ?? new Set()).has(id));
        if (!fresh.length) continue;
        // An insight with numbers is given only a form that draws them: one that sets them aside (people, logos, a memo) adds a
        // kind by losing the evidence, and the page is redrawn when its claim is read.
        if (Object.keys(insight.measures ?? {}).length && fills?.takesMeasures && !fills.takesMeasures(type, form)) continue;
        if (seriesHidden([...kinds, String(PAGE_TYPES[type].forms[form] ?? "")], pageMeasures(page, registry)) || fills?.(page, type, form)) continue;
        for (const kind of fresh) { (proofs.get(kind) ?? proofs.set(kind, new Set()).get(kind)).add(id); (reach.get(kind) ?? reach.set(kind, []).get(kind)).push({ section, insight: id, type, form }); }
      }
    }
  }
  return reach;
}

/**
 * The kinds of exhibit the deck's floor needs, each given to one section that can draw it: `{ floor, length, target, reachable,
 * short, bySection: Map(section -> [{ kind, insight, type, form }]) }`. The floor is the deck's (VARIETY_EXHIBIT_RANGE) over its
 * planned length, and a margin above it is given out too, so one section that cannot keep a kind leaves the deck at its floor.
 * The kinds most sections can draw are given first - they ask the least of any page - each to the section that holds the
 * fewest for its budget; a kind only one section's evidence draws is given only where the floor needs it. `short` is how far
 * the evidence as homed falls below the floor: that is a gap in the research, and the lead closes it before the skeletons.
 */
export function allocateKinds(doc, insights, { fills = null, budgets = new Map(), homes = evidenceHomes(doc) } = {}) {
  const length = plannedLength(doc, budgets), perTen = PLAN.craft.exhibitVarietyPerTen.min;
  const floor = Math.ceil((perTen * length) / 10 - 1e-9), target = floor + Math.max(1, Math.ceil(floor * 0.1));
  const reach = kindReach(doc, insights, { fills, homes });
  // Most sections first: a kind many sections draw asks least of any page. Each insight carries one given kind at most - a page
  // is one claim - and a section's load is its kinds for its budget, so the kinds spread as the pages do.
  const order = [...reach].sort((a, b) => new Set(b[1].map((p) => p.section)).size - new Set(a[1].map((p) => p.section)).size || a[0].localeCompare(b[0]));
  const bySection = new Map(sectionEvidence(doc, homes).map(({ section }) => [section, []]));
  const load = (section) => (bySection.get(section)?.length ?? 0) / Math.max(1, budgets.get(section) ?? 1);
  const used = new Set();
  let given = 0;
  for (const [kind, proofs] of order) {
    if (given >= target) break;
    const best = proofs.filter((p) => !used.has(p.insight)).sort((a, b) => load(a.section) - load(b.section) || (bySection.get(a.section)?.length ?? 0) - (bySection.get(b.section)?.length ?? 0))[0];
    if (!best) continue;
    used.add(best.insight); given += 1;
    (bySection.get(best.section) ?? bySection.set(best.section, []).get(best.section)).push({ kind, insight: best.insight, type: best.type, form: best.form });
  }
  return { floor, length, perTen, target, reachable: reach.size, placed: given, short: Math.max(0, floor - given), bySection };
}

/**
 * The peer sets the deck's comparisons will need and does not declare: every measure whose members include two players or
 * more besides the subject, grouped by the players it holds, where no declared set holds exactly them (as the convention gate
 * reads an exhibit's members, gates/convention_gates.mjs). `[{ members, measures }]`, the largest first.
 */
export function peerSetProposals(doc, insights) {
  const conventions = conventionsOf(doc.deck) ?? {}, players = doc.deck?.players, subject = conventions.subject ?? null;
  const groups = new Map();
  for (const measure of measureRegistry(insights ?? new Map()).values()) {
    const axis = axisOf(measure);
    if (axis.kind !== "members") continue;
    const members = [...new Set(axis.labels.map((label) => playerInLabel(players, label)).filter(Boolean))];
    const peers = members.filter((member) => member !== subject);
    // Held where a declared set holds every one of these players: the exhibit names that set and says what it leaves out.
    const held = (list) => { const found = peerSetOf(conventions, list); return Boolean(found.set || found.nearest); };
    if (peers.length < 2 || held(members) || held(peers)) continue;
    const key = [...members].sort().join("\u0000");
    (groups.get(key) ?? groups.set(key, { members, measures: [] }).get(key)).measures.push(measure.ref);
  }
  return [...groups.values()].sort((a, b) => b.members.length - a.members.length || b.measures.length - a.measures.length);
}

/**
 * One section's share of the deck as its pages stand: the kinds it was given that its pages do not draw yet (`owed`), and its
 * chart pages against the depth it keeps - at least half of them at the deck's median floor of values (`depth`). `slides` are
 * the section's pages as compiled or declared (each with its `pageType`); `given` the part's `allocation.kinds`.
 */
export function sectionShare(slides, given = []) {
  const drawn = new Set(slides.flatMap((slide) => exhibitKinds(slide)));
  const owed = given.filter((item) => !drawn.has(typeof item === "string" ? item : item.kind)).map((item) => (typeof item === "string" ? item : item.kind));
  const charts = slides.filter((slide) => slide.pageType?.chart && Number.isFinite(slide.pageType.values));
  const deep = charts.filter((slide) => slide.pageType.values >= VARIETY.evidenceMedianMin);
  const need = Math.ceil(charts.length / 2);
  return { owed, drawn: given.map((item) => (typeof item === "string" ? item : item.kind)).filter((kind) => drawn.has(kind)),
    depth: { floor: VARIETY.evidenceMedianMin, charts: charts.length, deep: deep.length, need, thin: charts.filter((slide) => slide.pageType.values < VARIETY.evidenceMedianMin).map((slide) => `${slide.id} (${slide.pageType.values})`) } };
}

/**
 * What a section's chart pages keep of the deck's depth, said from how many of its insights can plot the floor: at least half of
 * its chart pages plot it where some can; where none can, its thin evidence is drawn as a table or as figures, which the median
 * does not count, rather than as charts that pull it down.
 */
export function depthLine(deep) {
  const floor = VARIETY.evidenceMedianMin;
  return deep ? `${deep} able to plot ${floor}+ values: at least half its chart pages plot that many` : `none able to plot ${floor} values: draw its thin evidence as tables or figures, not as charts that pull the deck's median under ${floor}, or ask the lead for deeper evidence`;
}

/**
 * The sections that do not draw a kind the allocation gave them, read off the deck's pages as compiled or declared (`slides`,
 * each with its `id`): `[{ section, owed }]`, for routing a kinds floor the whole deck misses to the sections that owe it.
 */
export function owedKinds(doc, slides) {
  const parts = partsOf(doc), out = [];
  for (const [section, entry] of partHomes(doc)) {
    const given = entry.allocation?.kinds;
    if (!Array.isArray(given) || !given.length) continue;
    const { owed } = sectionShare(slides.filter((slide) => parts.get(String(slide.id)) === section), given);
    if (owed.length) out.push({ section: partName(section), owed });
  }
  return out;
}

/** The lines `--allocate` prints, and the part file each section's share is written to. */
export function allocationReport(doc, insights, { fills = null, budgets = new Map() } = {}) {
  const homes = evidenceHomes(doc), findings = homeFindings(doc, insights).filter((f) => !f.id);
  const kinds = allocateKinds(doc, insights, { fills, budgets, homes });
  const proposals = peerSetProposals(doc, insights);
  const homed = new Set([...homes.home.keys(), ...homes.twice.map((t) => t.id)]);
  const unhomed = homes.declared ? [...(insights?.keys?.() ?? [])].filter((id) => !homed.has(id) && !insights.get(id)?.derived) : [];
  const lines = [`# Allocation: what each section holds for the deck, before its skeleton`, "",
    `Planned length ${kinds.length} pages; the kinds floor is ${kinds.floor} (${kinds.perTen} a ten pages), and ${kinds.target} are given out so one section that cannot keep a kind leaves the deck at its floor. The evidence can draw ${kinds.reachable} kinds.`];
  if (!homes.declared) lines.push("", "Evidence homes: none declared. Give each part file an `evidence` list - the insights that section builds its pages on, each in one part - and a `rereads` list for any it re-reads on purpose from another; the allocation then reads each section's own evidence. Until then it reads the insights each section's pages already name.");
  if (findings.length) lines.push("", "## To settle first", ...findings.map((f) => `- ${f.code}: ${f.repair}`));
  if (unhomed.length) lines.push("", `## Insights no section holds (${unhomed.length}): no page may rest on them until one does`, `- ${unhomed.join(", ")}`);
  if (kinds.short) lines.push("", `## KINDS_UNREACHABLE: the evidence as homed, drawn an insight a page in forms that show its numbers, places ${kinds.placed} kinds against a floor of ${kinds.floor}`, `Short by ${kinds.short}: met after the pages are written, the floor is met by redrawing claims in forms that do not carry them. Close the gap now, before any page is written - find the evidence whose shape draws a kind no section can (a sequence of dated events for a timeline or a gantt, the parts of a whole for a waffle or a treemap, a spread of values for a range, two measures over one set of members for a scatter, places for a map), or plan fewer pages.`);
  lines.push("", "## Each section's share");
  for (const [section, given] of kinds.bySection) {
    const own = sectionEvidence(doc, homes).find((s) => s.section === section)?.insights ?? [];
    const deep = own.filter((id) => insights?.get?.(id) && plottableValues(insights.get(id)) >= VARIETY.evidenceMedianMin);
    lines.push(`- ${section === ROOT_SECTION ? section : partName(section)}${budgets.has(section) ? ` (budget ${budgets.get(section)})` : ""}: kinds ${given.length ? given.map((g) => `${g.kind} (${g.insight} as ${g.type}/${g.form})`).join(", ") : "none"}; ` +
      `${own.length} insight${own.length === 1 ? "" : "s"}, ${depthLine(deep.length)}`);
  }
  if (proposals.length) lines.push("", `## Peer sets the comparisons will need (\`deck.conventions.peerSets\`): name each and declare it, or say why a measure is no comparison`,
    ...proposals.map((p) => `- ${JSON.stringify(p.members)} - ${p.measures.slice(0, 4).join(", ")}${p.measures.length > 4 ? `, and ${p.measures.length - 4} more` : ""}`));
  // The homes are what --write cannot write past; a kinds gap is still written, each section's share being sound, and refused.
  const blocking = findings.some((f) => f.severity === "blocker");
  return { lines, blocking, short: kinds.short, kinds, homes, proposals, unhomed };
}
