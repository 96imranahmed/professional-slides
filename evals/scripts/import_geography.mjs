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
const result = importGeography(bytes, config);
const sourcePath = `${outputPath}.source.geojson`;
// Exclusive creation keeps existing evidence intact and prevents overwrites.
const sourceFile = await fs.open(sourcePath, "wx");
try {
  await sourceFile.writeFile(bytes);
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
} catch (error) {
  await fs.unlink(sourcePath);
  throw error;
} finally {
  await sourceFile.close();
}
