// The deck's conventions held on each page (conventions.mjs): what the renderer cannot apply for the author.
//
// The BA deck's review was the first reader to see its conventions broken - the accent on a rival, a peer set that changed
// from page to page, "Lufthansa" for two companies, GBP beside £, a heat table shaded both ways - because every gate read
// one page alone and nothing declared what held across them. With `deck.conventions` declared, the composer draws the
// subject, the currency's units and the heat's direction itself; these rules hold what is the author's to write, each on
// its own page, so a writer meets it on their own page check rather than at the whole-deck review. Each reads structure:
// the exhibit's members against declared players and sets, its labels against the refused forms as exact strings, the
// currency forms of a closed ISO set, the direction a measure records. What a line of copy names is asked, not matched
// (player-name-form, judgement-kinds.json).
import { registered } from "../errors.mjs";
import { judged } from "../judgements.mjs";
import { authorFocused, cellsOf, conventionsOf, currencyFormsIn, exhibitPaths, exhibitsOfPage, isHeatColumn, memberLabels, peerSetOf, playerInLabel, playerNamed, refusedForms } from "../conventions.mjs";

export const CONVENTION_CODES = Object.freeze({
  SUBJECT_NOT_ACCENTED: "a chart or table that plots the page's subject marks another member, or not the subject, by an explicit focus of its own",
  PEER_SET_UNDECLARED: "an exhibit compares players that no declared peer set holds, or names a set the deck does not declare",
  PEERS_OMITTED_UNSAID: "an exhibit leaves members of its peer set out without saying which and why in `omits`",
  PLAYER_NAME_REFUSED: "a label or a line of copy names a player by a form the deck refuses (`conventions.names[...].not`)",
  CURRENCY_FORM: "typed copy prints a currency in the form the deck's `conventions.currency` does not use",
  HEAT_DIRECTION_UNRECORDED: "a heat column whose measure records no direction sits in a table whose other heat columns run by merit",
});

const text = (value) => (typeof value === "string" ? value : value && typeof value === "object" ? String(value.text ?? value.label ?? "") : "");
const pointText = (point) => (typeof point === "string" ? point : [point?.lead, point?.text].filter((part) => typeof part === "string" && part.trim()).join(" "));
const quoted = (list) => list.map((item) => `"${item}"`).join(", ");

/** The page's copy, line by line: its title, standfirst, commentary and boxed asides, and each exhibit's caption. */
function copyLines(slide) {
  return [slide.title, slide.subtitle, ...(Array.isArray(slide.points) ? slide.points.map(pointText) : []), ...(Array.isArray(slide.paragraphs) ? slide.paragraphs.map(pointText) : []),
    text(slide.soWhat), text(slide.insight), text(slide.callout), ...exhibitsOfPage(slide).map((ex) => text(ex?.caption))]
    .filter((line) => typeof line === "string" && line.trim()).map((line) => line.trim());
}

/** The marks an author's own focus names on an exhibit, as labels; `colorIndices` names the series it gives the accent's colour. */
function authorMarks(ex) {
  if (ex.type === "table") {
    const rows = memberLabels(ex).rows;
    return [Number.isInteger(ex.highlightRow) ? rows[ex.highlightRow] : ex.highlightRow].filter((label) => typeof label === "string");
  }
  if (Array.isArray(ex.colorIndices)) return (ex.series || []).filter((_, i) => ex.colorIndices[i] === 1).map((s) => String(s?.name ?? ""));
  return [...[ex.focus].flat(), ex.focusSeries, ...(Array.isArray(ex.highlights) ? ex.highlights.map((h) => h?.category) : [])].filter((label) => typeof label === "string");
}

/** The band a page's composed action title is set in, `{ width, fontFamily, fontSize, bold }`, or null where none is composed. */
function titleBand(deck, id) {
  const slide = (deck?.slides || []).find((s) => String(s?.id) === id);
  const node = (slide?.nodes || []).find((n) => n?.role === "action-title");
  const value = (style) => (style && typeof style === "object" ? style.value : style);
  return node?.frame?.width > 0 ? { width: node.frame.width, fontFamily: value(node.style?.fontFamily) ?? "Arial", fontSize: value(node.style?.fontSize) ?? 24, bold: Boolean(value(node.style?.bold)) } : null;
}

/**
 * Every convention finding on the compiled pages of `spec` (`spec.slides`, `spec.appendix`): one list, each finding on the
 * page it is mended on, with a repair that names the fix. `deck` is the composed scene, where the page's title band is read.
 */
export function conventionFindings(spec, deck = null) {
  const conventions = conventionsOf(spec), players = spec?.players;
  if (!conventions) return [];
  const out = [], refused = refusedForms(conventions), form = conventions.currency;
  const sets = conventions.peerSets && typeof conventions.peerSets === "object" ? conventions.peerSets : null;
  const askNames = [...refused.keys()].length > 0;
  // The question's context, keyed: each declared name with the forms it refuses, as `names` declares them.
  const names = Object.fromEntries([...new Set([...refused.values()].flat())].map((name) => [name, [...refused].filter(([, to]) => to.includes(name)).map(([wrote]) => wrote)]));
  for (const slide of [...(spec.slides || []), ...(spec.appendix || [])]) {
    if (!slide || slide.kind !== undefined) continue;
    const id = String(slide.id ?? ""), subject = slide.subject ?? null;
    const add = (code, repair, measured) => out.push({ code: registered(CONVENTION_CODES, code), id, severity: "blocker", ...(measured === undefined ? {} : { measured }), repair: `${id}: ${repair}` });
    exhibitsOfPage(slide).forEach((ex, at) => {
      if (!ex || typeof ex !== "object") return;
      // The exhibit by the path an edit names it with (`exhibits[1]`, `blocks[0].exhibit`), and its heading where it has one.
      const path = exhibitPaths(slide)[at] ?? `exhibits[${at}]`;
      const where = `\`${path}\`${ex.heading ? ` ("${String(ex.heading).slice(0, 60)}")` : ""}`;
      const labels = memberLabels(ex), all = [...(labels.series ?? []), ...(labels.categories ?? []), ...(labels.points ?? []), ...(labels.rows ?? [])];
      // The subject's accent, where the exhibit names its own focus (unnamed, the renderer sets it: conventions.mjs subjectFocus).
      if (subject && authorFocused(ex) && all.some((label) => playerInLabel(players, label) === subject || label === subject)) {
        const marks = authorMarks(ex), other = marks.filter((label) => playerInLabel(players, label) !== subject && label !== subject);
        if (other.length || !marks.length)
          add("SUBJECT_NOT_ACCENTED", `${where} plots ${subject}, the page's subject, and its own ${ex.type === "table" ? "`highlightRow`" : "focus (`focus`, `focusSeries`, `highlights` or `colorIndices`)"} marks ${other.length ? quoted(other) : `no member as the subject`}: the accent is ${subject}'s on every page. Drop that key and the runtime marks ${subject}; where this page is about another player, set the page's \`subject\` to that player (a declared player)`, { subject, marked: marks });
      }
      // Labels are exact strings: a refused form as the whole label is refused with the canonical name.
      for (const label of new Set(all)) if (refused.has(label))
        add("PLAYER_NAME_REFUSED", `${where} labels a member "${label}", a form the deck refuses (\`conventions.names\`): write ${refused.get(label).map((name) => `"${name}"`).join(" or ")}${refused.get(label).length > 1 ? ", whichever the label means" : ""}`, { wrote: label, write: refused.get(label) });
      // The peer set the exhibit compares: named in `peers`, or the declared set its players are exactly. The subject may
      // stand beside a set it is not in (British Airways against the network groups). A set's members are read through the
      // players' names, `short` forms and aliases as the labels are (conventions.mjs peerSetOf).
      if (sets && ex.chartData !== true) {
        const axes = [["series", labels.series], ["categories", labels.categories], ["points", labels.points], ["rows", labels.rows]].filter(([, list]) => Array.isArray(list))
          .map(([axis, list]) => [axis, [...new Set(list.map((label) => playerInLabel(players, label)).filter(Boolean))]]);
        const [axis, members] = axes.sort((a, b) => b[1].length - a[1].length)[0] ?? [null, []];
        const peers = members.filter((member) => member !== subject);
        const setOf = (named, list) => peerSetOf(conventions, list, named, { players });
        const setLines = Object.entries(sets).map(([name, list]) => `"${name}" (${list.length}: ${list.join(", ")})`).join("; ");
        // The exhibit's own fields, by the path an edit names them (author-deck.mjs --apply): `exhibits[1].peers`, `exhibit.omits`.
        const field = (key) => `\`${path}.${key}\``, axisWords = axis ?? "labels";
        // A head-to-head of the subject and one rival is no set's; an exhibit that names its set is held to it however few it shows.
        if (peers.length >= 2 || (ex.peers !== undefined && members.length >= 1)) {
          const found = ex.peers !== undefined ? setOf(String(ex.peers), members) : [setOf(undefined, members), setOf(undefined, peers)].find((f) => f.set) ?? setOf(undefined, peers);
          const outside = found.set ? found.outside.filter((member) => member !== subject) : [];
          // The declared set that holds every member the exhibit compares, the fewest left over: the set to name instead.
          const holder = setOf(undefined, peers).set ? setOf(undefined, peers) : setOf(undefined, peers).nearest;
          const omitsFor = (list) => `{ ${list.map((member) => `"${member}": "<why it is not shown>"`).join(", ")} }`;
          const asSet = `\`"<set name>": [${peers.map((member) => `"${member}"`).join(", ")}]\``;
          const declare = `or declare the set in \`deck.conventions.peerSets\` - ${asSet} - and set ${field("peers")} to its name`;
          if (ex.peers !== undefined && !found.set)
            add("PEER_SET_UNDECLARED", `${where} names ${field("peers")} "${ex.peers}", which \`deck.conventions.peerSets\` does not declare (its ${Object.keys(sets).length} set${Object.keys(sets).length === 1 ? "" : "s"}: ${setLines}). Set ${field("peers")} to ${holder ? `"${holder.set}", which holds all ${peers.length} players its ${axisWords} compare${holder.missing.length ? `, with ${field("omits")} ${omitsFor(holder.missing)}` : ""}` : `a declared set's name`}, ${declare}`, { peers: ex.peers, members: peers, field: `${path}.peers` });
          else if (!found.set) {
            add("PEER_SET_UNDECLARED", `${where} compares ${peers.length} players by its ${axisWords} - ${quoted(peers)} - and no set in \`deck.conventions.peerSets\` holds them (${setLines}): ${holder ? `"${holder.set}" holds all ${peers.length} and ${holder.missing.length} more - set ${field("peers")} to "${holder.set}"${holder.missing.length ? ` and ${field("omits")} to ${omitsFor(holder.missing)} for the ${holder.missing.length} it leaves out` : ""}, ${declare}` : `none holds all ${peers.length}, so declare the set in \`deck.conventions.peerSets\` - ${asSet} - and set ${field("peers")} to its name`}`, { members: peers, field: `${path}.peers` });
          } else if (outside.length) add("PEER_SET_UNDECLARED", `${where} names ${field("peers")} "${found.set}" (${(sets[found.set] || []).length} members) and also compares ${outside.length} ${outside.length === 1 ? "player" : "players"} by its ${axisWords} that the set does not hold, ${quoted(outside)}: take ${outside.length === 1 ? "it" : "them"} off the exhibit's ${axisWords}, add ${outside.length === 1 ? "it" : "them"} to \`deck.conventions.peerSets["${found.set}"]\`, or set ${field("peers")} to ${holder ? `"${holder.set}", which holds all ${peers.length}` : "a set that holds all of them, declaring one if none does"}`, { set: found.set, outside, field: `${path}.peers` });
          else {
            const said = ex.omits && typeof ex.omits === "object" ? ex.omits : {};
            // A reason keyed by any name of the player - its name, `short` or alias - says why that player is left out.
            const saysWhy = (member) => Object.entries(said).some(([key, why]) => (key === member || (playerNamed(players, key) ?? key) === (playerNamed(players, member) ?? member)) && typeof why === "string" && why.trim());
            // A set may name members the deck does not declare as players; only a declared one can be found on the exhibit as left out.
            const unsaid = found.missing.filter((member) => playerNamed(players, member) && !saysWhy(member));
            const stray = Object.keys(said).filter((key) => !found.missing.some((member) => (playerNamed(players, key) ?? key) === (playerNamed(players, member) ?? member)));
            const size = (sets[found.set] || []).length;
            if (unsaid.length) add("PEERS_OMITTED_UNSAID", `${where} draws on the "${found.set}" set of ${size} and shows ${size - found.missing.length}; it leaves out ${unsaid.length} without a reason - ${quoted(unsaid)}: set ${field("omits")} to ${omitsFor(unsaid)}${Object.keys(said).length ? `, beside the ${Object.keys(said).length} it gives` : ""} (it prints as a note line, "Left out of the ${found.set}: ..."), or show ${unsaid.length === 1 ? "it" : "them"}${stray.length ? `. ${field("omits")} also names ${quoted(stray)}, which the exhibit does not leave out of the set: take ${stray.length === 1 ? "it" : "them"} out` : ""}`, { set: found.set, unsaid, shown: size - found.missing.length, of: size, field: `${path}.omits` });
          }
        }
      }
      // A heat column runs by merit where the deck says so, and a table that mixes directions says each column's.
      if (conventions.heat === "dark-is-better" && Array.isArray(ex.columns)) {
        const heat = ex.columns.map((column, i) => [column, i]).filter(([column]) => isHeatColumn(column));
        if (heat.some(([column]) => column.better === "down")) for (const [column, i] of heat.filter(([c]) => c.better === undefined))
          add("HEAT_DIRECTION_UNRECORDED", `${where}'s heat column "${text(column) || `column ${i + 1}`}" prints a measure that records no direction, beside columns better lower: the deck shades dark-is-better, and this column would shade by size. Record \`better: "up"\` or \`"down"\` on the measure in the insight log, or write \`better\` on the column`, { column: text(column) || i + 1 });
      }
    });
    // Typed copy prints the deck's currency form: a code or a symbol is a closed set of ISO forms, read as formatting.
    if (form) {
      const typed = [...copyLines(slide), ...exhibitsOfPage(slide).flatMap((ex) => (Array.isArray(ex?.rows) ? ex.rows.flatMap((row) => cellsOf(row).map(text)) : [])),
        // A tile's figure is written in the deck's form by the composer (conventions.mjs applyConventions); its words are typed.
        ...(Array.isArray(slide.metrics) ? slide.metrics.flatMap((m) => (typeof m === "string" ? [] : [m?.label, m?.sublabel].map(text))) : []), ...[slide.note].flat().map(text)];
      const wrong = new Map(typed.flatMap((line) => currencyFormsIn(line, form)).map((f) => [f.wrote, f.write]));
      if (wrong.size) add("CURRENCY_FORM", `the page types ${[...wrong].map(([wrote, write]) => `"${wrote}" where the deck writes "${write}"`).join(", ")} (\`conventions.currency: "${form}"\`): write ${[...wrong.values()].map((write) => `"${write}"`).join(", ")} in the title, commentary, cells and notes; units and headings the runtime writes itself`, { wrote: [...wrong.keys()] });
    }
    // What a line of copy names is read, not matched: each line is its own question, the page's lines beside it.
    if (askNames) {
      const lines = copyLines(slide), title = typeof slide.title === "string" ? slide.title.trim() : null;
      // The title's replacement is held to the title's slot - its words and its lines, measured in the band this page sets it in.
      const band = titleBand(deck, id);
      for (const line of lines) {
        const said = judged("player-name-form", line, { names }, id, { beside: { page: lines }, ...(line === title ? { slot: { name: "title", ...(band ? { measure: band } : {}) } } : {}) });
        if (said?.verdict === "refused-form")
          add("PLAYER_NAME_REFUSED", `"${line.slice(0, 90)}" names a player by a form the deck refuses ("${said.quote ?? ""}"): ${said.replacement ? `write "${said.replacement}"` : `name the player as \`conventions.names\` declares it (${Object.keys(names).map((name) => `"${name}"`).join(", ")})`}`, { line, quote: said.quote ?? null });
      }
    }
  }
  return out;
}
