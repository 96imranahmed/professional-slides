// A scripted run's reader of the copy questions (runtime/judge.mjs): it
// answers every packet the runtime stages with the verdict under which the
// question's rule refuses nothing (passing-verdicts.json), quoting the
// subject where that verdict is quoted, until judge.mjs exits 0. A scripted
// author has no model to ask; this stands in for the fresh readers a real run
// gives each packet to, so the run reaches the stages after the judgements.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JUDGEMENT_KINDS, PACKET_DIR } from "../../skills/professional-slides/runtime/judgements.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JUDGE = path.join(HERE, "..", "..", "skills", "professional-slides", "runtime", "judge.mjs");
const VERDICTS = JSON.parse(readFileSync(path.join(HERE, "passing-verdicts.json"), "utf8")).verdicts;
const words = (value) => (typeof value === "string" ? (value.trim() ? [value] : []) : Array.isArray(value) ? value.flatMap(words) : value && typeof value === "object" ? Object.values(value).flatMap(words) : []);

/** The answer to one staged question under which its rule passes. */
export function passing(item) {
  const verdict = VERDICTS[item.kind];
  if (!verdict) throw new Error(`No passing verdict for the judgement kind ${item.kind}: add it to evals/support/passing-verdicts.json`);
  const quoted = (JUDGEMENT_KINDS[item.kind].quoteFor || []).includes(verdict);
  return { key: item.key, verdict, reason: "The scripted run's reader answers each question so its rule passes.", ...(quoted ? { quote: words(item.subject)[0] } : {}) };
}

/** Run judge.mjs on `pagesFile` and answer what it stages until it exits 0 (or `rounds` run out): `{ code, rounds, answered }`. */
export function answerJudgements(pagesFile, { rounds = 6, args = [] } = {}) {
  const root = path.join(path.dirname(path.resolve(pagesFile)), PACKET_DIR);
  let answered = 0;
  for (let round = 0; round <= rounds; round += 1) {
    const done = spawnSync(process.execPath, [JUDGE, pagesFile, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (done.status !== 3 || round === rounds) return { code: done.status, rounds: round, answered, stderr: done.stderr ?? "" };
    for (const name of readdirSync(root).filter((entry) => /^packet-\d+$/.test(entry)).sort()) {
      const packet = JSON.parse(readFileSync(path.join(root, name, "packet.json"), "utf8"));
      writeFileSync(path.join(root, name, "answer.json"), JSON.stringify({ batch: packet.batch, judgements: packet.items.map(passing) }));
      answered += packet.items.length;
    }
  }
  return { code: 3, rounds, answered, stderr: "" };
}
