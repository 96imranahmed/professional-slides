// `insights WORK --add BATCH.json`: one research batch filed as a part of the insight log.
//
// Research runs in batches (storylining.md "Find the data first"), each written as one file:
// { "sources": { key: { name, short, url, status } }, "insights": [ ... ] }. The log already reads parts - `include` in
// <deck>.insights.json, each part's sources registry in a `.sources.json` beside it (measures.mjs readInsightLog,
// sources-registry.mjs logSources) - so a batch is filed as one: its measures checked, any measure name the log refuses
// renamed and reported, its sources set beside it, and the part added to `include`. The A350F run merged five batches by a
// script of its own, after the compile refused measures named `777F` and `747-400F/ERF`.
import fs from "node:fs/promises";
import path from "node:path";
import { readJson, writeJsonWhole } from "../cli.mjs";
import { insightLogRefusal, readInsightLog } from "../measures.mjs";

const NAME = /^[A-Za-z][A-Za-z0-9._-]*$/;
const SOURCE_FIELDS = ["name", "short", "url", "status", "missing", "reason"];
const SHAPE = "a batch is { \"sources\": { key: { name, short, url, status } }, \"insights\": [{ id, finding, measures, cite }] }";

/** A measure name the log accepts, from the one the batch wrote: `777F` is `m777F`, `747-400F/ERF` is `m747-400F-ERF`. */
const measureName = (name, taken) => {
  let next = String(name).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "measure";
  if (!/^[A-Za-z]/.test(next)) next = `m${next}`;
  let unique = next, n = 2;
  while (taken.has(unique)) unique = `${next}-${n++}`;
  taken.add(unique);
  return unique;
};

export async function addInsights(work, file, results) {
  const batch = await readJson(path.resolve(file));
  if (!batch || typeof batch !== "object" || Array.isArray(batch) || !Array.isArray(batch.insights)) return results.blocked("INSIGHTS_BATCH_INVALID", `${file}: ${SHAPE}`);
  const renamed = [];
  const insights = batch.insights.map((item) => {
    if (!item || typeof item !== "object" || !item.measures || typeof item.measures !== "object") return item;
    const taken = new Set(Object.keys(item.measures).filter((name) => NAME.test(name)));
    const measures = Object.fromEntries(Object.entries(item.measures).map(([name, measure]) => {
      if (NAME.test(name)) return [name, measure];
      const next = measureName(name, taken);
      renamed.push(`${item.id}/${name} is ${item.id}/${next}`);
      return [next, measure];
    }));
    return { ...item, measures };
  });
  const refusal = insightLogRefusal(insights);
  if (refusal) return results.blocked("INSIGHTS_BATCH_INVALID", `${refusal}\nFix ${file} and add it again: a value nobody found is left out, never guessed.`);
  const sources = {}, problems = [];
  for (const [key, entry] of Object.entries(batch.sources ?? {})) {
    if (!entry || typeof entry !== "object" || typeof entry.name !== "string" || !entry.name.trim()) { problems.push(`source "${key}" has no \`name\``); continue; }
    sources[key] = Object.fromEntries(SOURCE_FIELDS.filter((field) => entry[field] !== undefined).map((field) => [field, entry[field]]));
  }
  if (problems.length) return results.blocked("INSIGHTS_BATCH_INVALID", `${file}: ${problems.join("; ")}. A source is { ${SOURCE_FIELDS.join(", ")} }, \`name\` required.`);
  const stem = path.basename(file, ".json").replace(/[^A-Za-z0-9_-]+/g, "-");
  const part = `insights/${stem}.json`, registry = `insights/${stem}.sources.json`;
  const logFile = path.join(work.root, `${work.doc.deck.id}.insights.json`);
  const before = await readJson(logFile, { optional: true });
  const log = before ?? { schema: "professional-slides.insights/v1", insights: [] };
  await fs.mkdir(path.join(work.root, "insights"), { recursive: true });
  await writeJsonWhole(path.join(work.root, part), { insights, ...(batch.facts ? { facts: batch.facts } : {}), ...(batch.gaps ? { gaps: batch.gaps } : {}) });
  await writeJsonWhole(path.join(work.root, registry), sources);
  await writeJsonWhole(logFile, { ...log, include: [...new Set([...(log.include ?? []), part])] });
  // The log read whole, as every command reads it: an id recorded in two batches, or a clash with the log's own, is refused
  // here, and the log is left as it was.
  try { await readInsightLog(work.root, work.doc.deck.id); } catch (error) {
    if (before) await writeJsonWhole(logFile, before); else await fs.rm(logFile, { force: true });
    await fs.rm(path.join(work.root, part), { force: true }); await fs.rm(path.join(work.root, registry), { force: true });
    return results.blocked("INSIGHTS_BATCH_INVALID", `${error.message}\nNothing was filed.`);
  }
  const cited = new Set(insights.flatMap((item) => (Array.isArray(item?.cite) ? item.cite : [])));
  const unknown = [...cited].filter((key) => !Object.hasOwn(sources, key));
  return results.complete({ message: `Filed ${insights.length} insight${insights.length === 1 ? "" : "s"} and ${Object.keys(sources).length} source${Object.keys(sources).length === 1 ? "" : "s"} as ${part}.`,
    artifacts: [path.join(work.root, part), path.join(work.root, registry)], renamed,
    ...(renamed.length || unknown.length ? { advisories: [
      ...(renamed.length ? [{ code: "MEASURE_RENAMED", severity: "advisory", repair: `measure names the log refuses were renamed: ${renamed.join("; ")}; bind pages to the new names` }] : []),
      ...(unknown.length ? [{ code: "SOURCE_NOT_IN_BATCH", severity: "advisory", repair: `cited but not in this batch's sources: ${unknown.join(", ")}; another batch must register them` }] : []),
    ] } : {}) });
}
