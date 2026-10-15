// The pages file's `sources` registry checked on its own: what a source is
// (its name, short form, URL and status, each held to the length of what it
// is; when it was read, `retrieved`, which no citation prints) and what it may
// be declared not to name. The compile refuses a registry
// with a problem (author-deck.mjs compileDeck); the research step reads the
// same check (analysis.mjs), so a source written as a caveat is caught by the
// worker who wrote it, not at the first draft of the spine.
//
// The research records its sources beside the insight log's parts: each part
// `insights/<workstream>.json` with `insights/<workstream>.sources.json`, a
// registry of the same form. A pages file with no registry of its own reads
// theirs (logSources), so a new deck's skeleton is not refused for a registry
// the research already wrote (on the BA retest the skeleton spent its draft
// rounds on that refusal, which no section could fix from its own part file).
import fs from "node:fs/promises";
import path from "node:path";
import { parsePeriod } from "./time-axis.mjs";

/**
 * The registries the insight log's parts record beside them (`log` as
 * measures.mjs readInsightLog returns it), merged in the log's order:
 * `{ registry, files: [{ file, sources }], problems }`, or null where no part
 * has one. `problems` are the files that are not a registry and the keys two
 * files record differently (the first is kept); each file's entries are held
 * to registryProblems by the caller.
 */
export async function logSources(baseDir, log) {
  const files = [], problems = [], registry = {}, from = new Map();
  for (const { file } of Array.isArray(log?.parts) ? log.parts : []) {
    const name = file.replace(/\.json$/, ".sources.json");
    let text;
    try { text = await fs.readFile(path.resolve(baseDir, name), "utf8"); } catch { continue; }
    let sources;
    try { sources = JSON.parse(text); } catch { problems.push(`${name} is not valid JSON: it is read as the sources registry of ${file}`); continue; }
    if (!sources || typeof sources !== "object" || Array.isArray(sources)) { problems.push(`${name} is a registry - { key: { name, url, status } } - of the sources ${file} cites`); continue; }
    files.push({ file: name, sources });
    for (const [key, entry] of Object.entries(sources)) {
      if (!Object.hasOwn(registry, key)) { registry[key] = entry; from.set(key, name); }
      else if (JSON.stringify(registry[key]) !== JSON.stringify(entry)) problems.push(`source "${key}" is recorded twice with different entries: in ${from.get(key)} and in ${name}. Keep one entry for the key, or give the second source its own key`);
    }
  }
  return files.length || problems.length ? { registry, files, problems } : null;
}

// A source's `date`: when the record was published, or the day, month or year it stands as at.
const DATE = /^((?:19|20)\d{2})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/;
const MONTH_NAMES = Object.freeze(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);

/**
 * A registry entry's `date` as `{ printed, through }` - "4 Aug 2025", and the
 * end of the day, month or year it names in months from year zero (the unit
 * of time-axis.mjs parsePeriod) - or null where the entry records none. The
 * source line prints it beside the source's name: on the BA retest the
 * reviewer found that no source line gave an as-at date.
 */
export function sourceDate(entry) {
  const m = DATE.exec(String(entry?.date ?? "").trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), m[2] ? Number(m[2]) : null, m[3] ? Number(m[3]) : null];
  return { printed: d ? `${d} ${MONTH_NAMES[mo - 1]} ${y}` : mo ? `${MONTH_NAMES[mo - 1]} ${y}` : String(y), through: d ? y * 12 + mo - 1 + d / 31 : mo ? y * 12 + mo : (y + 1) * 12 };
}

/**
 * Where a period ends, in parsePeriod's months, at the earliest it can: a
 * calendar year at the end of its December; a fiscal year (FY26, 2025-26) at
 * the end of the first month of the year that names its close, since where
 * in that year it closes is the company's; a quarter, a half, a month, a day
 * or a season at the end of its span. Null for a period marked as an
 * estimate, a forecast, a plan or a budget (2026E), a count of years, a bare
 * month, or a label that is no date - none says when it could be reported.
 */
function periodEnd(label) {
  const s = String(label ?? "").trim(), p = parsePeriod(s);
  if (!p || /\d\s?[EFPB]$/i.test(s)) return null;
  if (p.kind === "year") return /^FY/i.test(s) ? p.t + 1 : /^\d{4}[-–/]\d{2}$/.test(s) ? p.t + 13 : p.t + 12;
  return Object.hasOwn(PERIOD_SPAN, p.kind) ? p.t + PERIOD_SPAN[p.kind] : null;
}
// How long each kind of period parsePeriod reads runs, in months.
const PERIOD_SPAN = Object.freeze({ quarter: 3, half: 6, month: 1, day: 1 / 31, season: 6 });
/** Where a period begins, at the latest it can: its end less its length, a year twelve months. */
const periodStart = (label) => { const end = periodEnd(label), p = parsePeriod(String(label ?? "").trim()); return end === null || !p ? null : end - (p.kind === "year" ? 12 : PERIOD_SPAN[p.kind] ?? 0); };

/** Every problem with the pages file's `sources` registry, as sentences: a source with no name, a key no source takes, a date the source line cannot print. */
export function registryProblems(sources) {
  if (sources === undefined) return [];
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return ["`sources` is a registry - { key: { name, url, status } }"];
  return Object.entries(sources).flatMap(([key, entry]) => {
    if (!entry || typeof entry !== "object" || typeof entry.name !== "string" || !entry.name.trim()) return [`source "${key}" needs its \`name\` - the publisher and title as the citation prints them`];
    // `missing` and `reason` are older declarations of what a record does not name: read past.
    const extra = Object.keys(entry).filter((k) => !["name", "short", "url", "status", "retrieved", "date", "missing", "reason"].includes(k));
    const undated = entry.date !== undefined && !DATE.test(String(entry.date).trim()) ? [`source "${key}": \`date\` is when the record was published or stands as at - "2025-08-04", "2025-08" or "2025" - which the source line prints`] : [];
    return [...(extra.length ? [`source "${key}": unknown key${extra.length === 1 ? "" : "s"} ${extra.join(", ")} - a source is { name, short, url, status, retrieved, date }`] : []), ...undated,
      ...["short", "url", "status", "retrieved", "date"].filter((k) => entry[k] !== undefined && typeof entry[k] !== "string").map((k) => `source "${key}": \`${k}\` is text`)];
  });
}

