// Compose every probe page on its own and record which styles compose.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.resolve(here, "../../../skills/professional-slides");
const { toDeckPlan } = await import(path.join(skill, "runtime/compose.mjs"));
const { planDeck } = await import(path.join(skill, "runtime/planner.mjs"));
const spec = JSON.parse(fs.readFileSync(path.join(here, "probes.deck.json"), "utf8"));
const base = path.join(skill, "examples");
const results = {}, errors = {};
for (const slide of spec.slides) {
  const style = slide.id.replace(/^./, c => c.toUpperCase()).replace(/-(.)/, (_, c) => "-" + c);
  const key = Object.keys(JSON.parse(fs.readFileSync(path.join(here, "capability.json"), "utf8")).styles)
    .find(s => s.toLowerCase() === slide.id);
  try { planDeck(toDeckPlan({ ...spec, slides: [slide] }, base)); results[key] = true; }
  catch (error) { results[key] = false; errors[key] = error.message.split("\n")[0].slice(0, 200); }
}
fs.writeFileSync(path.join(here, "probe-results.json"), JSON.stringify(results, null, 1) + "\n");
const failed = Object.entries(errors);
console.log(`${Object.values(results).filter(Boolean).length}/${Object.keys(results).length} probes compose`);
for (const [k, e] of failed) console.log(`  ${k}: ${e}`);
