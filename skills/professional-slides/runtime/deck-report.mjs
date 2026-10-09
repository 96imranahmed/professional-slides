// The author's report: findings in class order, and where the deck stands.
//
// A run reports its findings in the order they are best met (gates/
// gate_classes.mjs): deck structure first, since a failure there changes which
// page takes which form; then each page's own findings, grouped by page; then
// the deck's aggregates. Beside them, on every run, one line for every
// structure and aggregate rule says where the deck stands - the value, the
// bar and the room left - and which pages pull an aggregate out of its band,
// so a deck-level refusal is never the first time its rule is mentioned.
import { CLASSES, CLASS_ORDER, classOf, standingLine, standingRoom } from "./gates/gate_classes.mjs";
import { fitLines } from "./fit-search.mjs";

/** The pages a finding names, its own first: the page it is filed under, and every page its rule counted or set against it. */
export const pagesOf = (finding) => [...new Set([...(finding.id !== undefined && finding.id !== null ? [finding.id] : []),
  ...(Array.isArray(finding.slide) ? finding.slide : []), ...(Array.isArray(finding.pages) ? finding.pages : [])].filter((id) => id !== null && id !== undefined).map(String))];

/** `findings` with their class, in report order: S, then P by page in `order` (page ids in deck order), then G. */
export function inClassOrder(findings, order = []) {
  const at = new Map(order.map((id, i) => [String(id), i]));
  const rank = (f) => { const [first] = pagesOf(f); return first !== undefined && at.has(first) ? at.get(first) : order.length; };
  const classed = findings.map((f, i) => ({ f: { ...f, class: f.class ?? classOf(f.code) }, i }));
  return classed.sort((a, b) => CLASS_ORDER.indexOf(a.f.class) - CLASS_ORDER.indexOf(b.f.class) || (a.f.class === "P" ? rank(a.f) - rank(b.f) : 0) || a.i - b.i).map(({ f }) => f);
}

const findingText = (f) => `  ${f.code}${f.id || f.page ? ` [${f.id ?? f.page}${f.part ? ` in ${f.part}` : ""}]` : ""}${f.provisional ? " (provisional)" : ""}${f.measured !== undefined ? `  ${JSON.stringify(f.measured)}` : ""}\n` +
  `    ${fitLines(f.alternatives).lead}${f.repair ?? f.reason ?? ""}` +
  (f.provisional ? `\n    provisional: ${f.provisional} - read from declared choices, and read again once every page composes` : "") +
  (f.partial ? `\n    ${f.partial}: read again once every page composes` : "") +
  fitLines(f.alternatives).lines.map((line) => `\n      ${line}`).join("");

/** Findings as the report prints them: a header a class, then each finding and its repair. */
export function findingsText(findings, order = []) {
  const sorted = inClassOrder(findings, order);
  return CLASS_ORDER.filter((cls) => sorted.some((f) => f.class === cls))
    .map((cls) => `${cls}. ${CLASSES[cls]}:\n${sorted.filter((f) => f.class === cls).map(findingText).join("\n")}`).join("\n\n");
}

/**
 * Standings ready to print: each with its class, the room it leaves and its
 * line, the broken first and the comfortable last.
 */
export function readStandings(standings, { provisional = null, partial = null } = {}) {
  const urgency = { over: 0, short: 0, at: 1, ok: 2, unread: 3 };
  return standings.map((standing, i) => {
    const cls = classOf(standing.code);
    const named = { ...standing, class: cls,
      ...(standing.pages ? { pages: standing.pages.filter((id) => id !== null && id !== undefined).map(String) } : {}),
      ...(cls === "S" && provisional ? { provisional } : {}), ...(cls === "G" && partial ? { partial } : {}) };
    const room = standing.unmeasured ? { state: "unread" } : standingRoom(named);
    return { ...named, state: room.state, margin: room.margin, line: standing.unmeasured ? `${standing.code}: ${standing.what}: ${standing.unmeasured}` : standingLine(named), i };
  }).sort((a, b) => urgency[a.state] - urgency[b.state] || a.i - b.i).map(({ i: _, ...standing }) => standing);
}

/** The pages on the wrong side of an aggregate's bar: the ones pulling it out of its band. */
const pulling = (standing) => (standing.each ? Object.entries(standing.each).filter(([, value]) => (standing.side === "min" ? value < standing.bar : value > standing.bar)).map(([id]) => id) : []);

/** The standing block of the report: one line a rule, by class, with the pages that pull each aggregate. */
export function standingText(standings) {
  const lines = (cls) => standings.filter((s) => s.class === cls).map((s) => {
    const pulls = cls === "G" && s.each && s.state !== "unread" ? pulling(s) : [];
    return `  ${s.line}${s.partial ? ` (${s.partial})` : ""}${pulls.length && pulls.length <= 12 ? ` | pages ${s.side === "min" ? "under" : "over"} the bar: ${pulls.join(", ")}` : pulls.length ? ` | ${pulls.length} pages ${s.side === "min" ? "under" : "over"} the bar` : ""}` +
      (cls === "G" && !s.each && s.pages?.length && ["over", "short", "at"].includes(s.state) ? ` | counted: ${s.pages.slice(0, 12).join(", ")}` : "");
  });
  return ["S", "G"].filter((cls) => standings.some((s) => s.class === cls))
    .map((cls) => `${cls === "S" ? "Deck structure" : "Deck aggregates"} - value; bar: room\n${lines(cls).join("\n")}`).join("\n");
}

/**
 * The pages an aggregate finding is made of, beyond the ones it names: where
 * its rule reads a measure a page, the pages on the wrong side of the bar;
 * where it counts pages against a cap, the pages counted; and where it is a
 * rate over the deck's exhibits (`rates`: code -> { of, done }, the keys of
 * `parts`, each page's own counts), the pages holding one that falls short.
 */
export function contributorsOf(finding, standings, { parts = {}, rates = {} } = {}) {
  const read = standings.filter((s) => s.code === finding.code);
  const counted = read.flatMap((s) => (s.each ? pulling(s) : s.side === "max" ? s.pages ?? [] : []));
  const rate = rates[finding.code];
  const short = rate ? Object.entries(parts).filter(([, part]) => (part[rate.of] ?? 0) > (part[rate.done] ?? 0)).map(([id]) => id) : [];
  return [...new Set([...pagesOf(finding), ...counted, ...short].map(String))];
}

/**
 * What each of `ids` adds to every aggregate rule: its own measure against
 * the bar where the rule reads one a page, whether it is among the pages
 * the rule counted, and - for a rate over the deck's exhibits (`rates`, as
 * contributorsOf reads them, each with the `noun` it counts and what `done`
 * means) - how many of them the page holds and how many of those count.
 */
export function contributions(standings, ids, { parts = {}, rates = {} } = {}) {
  return Object.fromEntries(ids.map((id) => [id, standings.filter((s) => s.class === "G" && (s.each || s.pages || rates[s.code])).map((s) => {
    const name = `${s.code}${s.key ? `.${s.key}` : ""}`;
    const rate = rates[s.code];
    if (rate && !s.each && !s.pages) {
      const held = parts[id]?.[rate.of] ?? 0, done = parts[id]?.[rate.done] ?? 0;
      if (!held) return null;
      return `${name}: this page counts as ${held} ${rate.noun}${held === 1 ? "" : "s"}, ${done} ${rate.verb} (deck ${s.value} ${s.what}; floor ${s.bar})${done < held && ["over", "short", "at"].includes(s.state) ? " - pulls the deck the wrong way" : ""}`;
    }
    if (s.each) {
      if (!(id in s.each)) return null;
      const wrong = s.side === "min" ? s.each[id] < s.bar : s.each[id] > s.bar;
      return `${name}: this page ${s.each[id]} (deck ${s.value}; ${s.side === "max" ? "cap" : "floor"} ${s.bar})${wrong && s.state !== "unread" ? " - pulls the deck the wrong way" : ""}`;
    }
    return s.pages.includes(id) ? `${name}: counted (${s.value} ${s.what}; ${s.side === "max" ? "cap" : "floor"} ${s.bar})` : null;
  }).filter(Boolean)]));
}

/** A finding in a phrase, with by how much: what the fit search says is left on an alternative that fails. */
export function briefOf(finding) {
  const m = finding.measured;
  if (finding.code === "SCENE_VOID" && m && typeof m === "object") return `SCENE_VOID: an empty band of ${Math.round(m.to - m.from)}px${m.column ? ` in the ${m.column} column` : ""} (y ${m.from}-${m.to})`;
  if (["DEAD_BAND", "INTERNAL_VOID", "COLUMN_VOID"].includes(finding.code)) { const band = typeof m === "object" ? m?.band : m; return `${finding.code}: an empty band of ${Math.round(Number(band) * 720)}px`; }
  if (finding.code === "TEXT_COVERAGE_LOW") { const [, has, floor] = String(finding.reason ?? finding.repair ?? "").match(/has (\d+) words; pages doing this job carry at least ([\d.]+)/) ?? []; return has ? `TEXT_COVERAGE_LOW: ${has} body words against a floor of ${Math.round(Number(floor))}` : "TEXT_COVERAGE_LOW"; }
  if (typeof m === "number" && finding.threshold !== undefined && typeof finding.threshold !== "object") return `${finding.code}: ${m} against ${finding.threshold}`;
  return finding.code;
}
