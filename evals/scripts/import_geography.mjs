#!/usr/bin/env node
import fs from "node:fs/promises";
import { importGeography } from "../../skills/professional-slides/runtime/import-geography.mjs";
const [configPath, outputPath] = process.argv.slice(2);
if (!configPath || !outputPath)
  throw new Error(
    "Usage: node evals/scripts/import_geography.mjs config.json output.json",
  );
const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const response = await fetch(config.url, {
  signal: AbortSignal.timeout(30000),
});
if (!response.ok)
  throw new Error(`Geography download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
await fs.writeFile(
  outputPath,
  JSON.stringify(importGeography(bytes, config), null, 2) + "\n",
  { flag: "wx" },
);
