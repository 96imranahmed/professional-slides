import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

function renderNames(fixtures) {
  const names = fixtures.flatMap(fixture => [fixture.htmlRender, fixture.pptxRender]);
  if (names.some(name => typeof name !== "string" || !name)) throw new Error("Every golden fixture requires both render paths");
  return [...new Set(names)].sort();
}

export async function hashRenderFiles(directory, fixtures) {
  const entries = await Promise.all(renderNames(fixtures).map(async name => {
    const file = path.resolve(directory, name), relative = path.relative(directory, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Render path escapes its artifact directory");
    return [name, createHash("sha256").update(await fs.readFile(file)).digest("hex")];
  }));
  return Object.fromEntries(entries);
}

export async function verifyRenderFiles(directory, fixtures, expected) {
  const actual = await hashRenderFiles(directory, fixtures);
  if (!expected || Object.keys(expected).sort().join("\n") !== Object.keys(actual).join("\n") || Object.entries(actual).some(([name, hash]) => expected[name] !== hash)) throw new Error("Golden render hash mismatch or incomplete render manifest");
}
