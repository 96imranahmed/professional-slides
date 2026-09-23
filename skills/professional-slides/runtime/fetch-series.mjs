#!/usr/bin/env node
// Fetch a public time series into sources/, for the trend pages a deck needs.
//
//   node runtime/fetch-series.mjs worldbank <INDICATOR> <ISO3[,ISO3...]> [--from 2010] [--to 2024] [--out sources/name]
//   node runtime/fetch-series.mjs owid <grapher-slug> <Entity[,Entity...]> [--column name] [--from] [--to] [--out]
//
// Examples: `worldbank IS.AIR.PSGR SAU,ARE,QAT` (air passengers carried),
// `worldbank NY.GDP.MKTP.CD SAU` (GDP, current US$), `owid
// annual-co2-emissions-per-country "Saudi Arabia,United Arab Emirates"` (the
// slug is the last part of the chart's grapher URL).
//
// Writes <out>.csv (year, one column per entity) and <out>.json: the source
// URL, indicator name and retrieval date for the footer, each series' first
// and last year with its CAGR, and a `chart` block - categories and series -
// ready to paste into a chart.line or chart.column exhibit. A deck whose
// charts are all snapshots is missing the history that usually makes the
// case; these two sources cover most country-level questions.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UA } from "./fetch-logos.mjs";

/** Compound annual growth between two values `years` apart, as a fraction; null when undefined. */
export function cagr(first, last, years) {
  return years > 0 && first > 0 && last > 0 ? Math.pow(last / first, 1 / years) - 1 : null;
}

/** { years, entities, values: Map(entity -> Map(year -> value)) } to the CSV, the summary and the chart block. */
export function summarise(table, source) {
  const years = [...table.years].sort((a, b) => a - b);
  const entities = table.entities.filter((e) => table.values.get(e)?.size);
  const csv = [["year", ...entities].join(","), ...years.map((y) => [y, ...entities.map((e) => table.values.get(e).get(y) ?? "")].join(","))].join("\n") + "\n";
  const series = entities.map((name) => {
    const points = years.filter((y) => Number.isFinite(table.values.get(name).get(y)));
    const [a, b] = [points[0], points.at(-1)];
    const rate = cagr(table.values.get(name).get(a), table.values.get(name).get(b), b - a);
    return { name, from: a, to: b, first: table.values.get(name).get(a), last: table.values.get(name).get(b), cagr: rate === null ? null : Math.round(rate * 1000) / 10 };
  });
  // The chart keeps the years every series covers, so no line has a hole.
  const shared = years.filter((y) => entities.every((e) => Number.isFinite(table.values.get(e).get(y))));
  const chart = { categories: shared.map(String), series: entities.map((name) => ({ name, values: shared.map((y) => table.values.get(name).get(y)) })) };
  return { csv, summary: { ...source, retrieved: new Date().toISOString().slice(0, 10), series, chart } };
}

/** World Bank API rows ([meta, rows]) to a table. */
export function worldBankTable(payload) {
  const rows = Array.isArray(payload) ? payload[1] ?? [] : [];
  const values = new Map(), years = new Set(), entities = [];
  let indicator = null;
  for (const row of rows) {
    if (row.value === null || row.value === undefined) continue;
    const name = row.country?.value ?? row.countryiso3code;
    const year = Number(row.date);
    indicator = indicator ?? row.indicator?.value;
    if (!values.has(name)) { values.set(name, new Map()); entities.push(name); }
    values.get(name).set(year, Number(row.value));
    years.add(year);
  }
  return { years, entities, values, indicator };
}

function parseCsvLine(line) {
  const out = []; let cell = "", quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) { if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true; else if (ch === ",") { out.push(cell); cell = ""; } else cell += ch;
  }
  out.push(cell);
  return out;
}

/** An Our World in Data grapher CSV (entity, code, year, values...) to a table for the named entities. */
export function owidTable(text, entities, column) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = parseCsvLine(head).map((c) => c.trim());
  const lower = cols.map((c) => c.toLowerCase());
  const at = { entity: lower.indexOf("entity"), year: lower.indexOf("year") };
  const valueAt = column ? cols.indexOf(column) : cols.findIndex((c, i) => i !== at.entity && i !== at.year && c.toLowerCase() !== "code");
  if (at.entity < 0 || at.year < 0 || valueAt < 0) throw new Error(`Unexpected OWID columns: ${cols.join(", ")}${column ? `; no column "${column}"` : ""}`);
  const wanted = new Set(entities);
  const values = new Map(entities.map((e) => [e, new Map()])), years = new Set();
  for (const line of lines) {
    const cells = parseCsvLine(line);
    if (!wanted.has(cells[at.entity]) || cells[valueAt] === "") continue;
    const year = Number(cells[at.year]);
    values.get(cells[at.entity]).set(year, Number(cells[valueAt]));
    years.add(year);
  }
  return { years, entities, values, indicator: cols[valueAt] };
}

const inRange = (table, from, to) => {
  const keep = (y) => (!from || y >= from) && (!to || y <= to);
  for (const m of table.values.values()) for (const y of [...m.keys()]) if (!keep(y)) m.delete(y);
  table.years = new Set([...table.years].filter(keep));
  return table;
};

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}${res.status === 404 && url.includes("ourworldindata") ? ": use the chart's slug from its grapher URL, e.g. annual-co2-emissions-per-country" : ""}`);
  return res.text();
}

export async function fetchSeries(provider, id, entities, { from, to, column } = {}) {
  if (provider === "worldbank") {
    const url = `https://api.worldbank.org/v2/country/${entities.join(";")}/indicator/${encodeURIComponent(id)}?format=json&per_page=20000${from || to ? `&date=${from || 1960}:${to || new Date().getFullYear()}` : ""}`;
    const payload = JSON.parse(await getText(url));
    if (payload?.[0]?.message) throw new Error(payload[0].message.map((m) => m.value).join("; "));
    const table = worldBankTable(payload);
    return summarise(table, { provider: "World Bank, World Development Indicators", indicator: table.indicator ?? id, id, url });
  }
  if (provider === "owid") {
    const url = `https://ourworldindata.org/grapher/${encodeURIComponent(id)}.csv?v=1&csvType=full&useColumnShortNames=true`;
    const table = inRange(owidTable(await getText(url), entities, column), from, to);
    return summarise(table, { provider: "Our World in Data", indicator: table.indicator, id, url: `https://ourworldindata.org/grapher/${id}` });
  }
  throw new Error(`Unknown provider ${provider}; use worldbank or owid`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [provider, id, list, ...flags] = process.argv.slice(2);
  if (!provider || !id || !list) { console.error("Usage: fetch-series.mjs worldbank|owid <indicator|slug> <entities, comma-separated> [--from YYYY] [--to YYYY] [--column name] [--out sources/name]"); process.exit(1); }
  const flag = (name) => { const at = flags.indexOf(`--${name}`); return at >= 0 ? flags[at + 1] : undefined; };
  const { csv, summary } = await fetchSeries(provider, id, list.split(",").map((s) => s.trim()).filter(Boolean), { from: Number(flag("from")) || undefined, to: Number(flag("to")) || undefined, column: flag("column") });
  const out = path.resolve(flag("out") ?? path.join("sources", `${provider}-${id}`.replace(/[^A-Za-z0-9.-]+/g, "-")));
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(`${out}.csv`, csv);
  await fs.writeFile(`${out}.json`, JSON.stringify(summary, null, 1) + "\n");
  console.log(JSON.stringify({ csv: `${out}.csv`, indicator: summary.indicator, series: summary.series, years: summary.chart.categories.length }, null, 1));
}
