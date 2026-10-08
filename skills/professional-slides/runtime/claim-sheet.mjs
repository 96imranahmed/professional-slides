// The claims of a page set out for its writer to check against the record
// before anyone else does (`author-deck.mjs <pages> --claims <ids>`): every
// sentence the page says, as the reader meets it, beside the findings of the
// insights it rests on, with the recorded value each number in it states. What
// a sentence asserts beyond its numbers - a rank, a universal, a cause - is the
// writer's to read against those findings, and the self-check's after them.
import { bindDeck } from "./bind.mjs";
import { measureRegistry } from "./measures.mjs";
import { measurementsIn } from "./printed-numbers.mjs";
import { pagePool, pageTexts, statedCells } from "./gates/dependency_gates.mjs";
import { textWords } from "./text-contract.mjs";

/**
 * Each named page (all of them where `ids` is empty) as
 * `{ id, title, evidence: [{ id, finding }], claims: [{ field, text, numbers }] }`:
 * `numbers` each `{ shown, states }` - the cells (`ref@label = value`) the
 * number is a value of at its printed precision, empty where it is no
 * recorded value. A sentence of fewer than three words (a label, a figure on
 * its own) is left out: it states a number, which the exhibit's binding
 * already holds.
 */
export function claimSheet(doc, insights, ids = []) {
  const registry = measureRegistry(insights);
  const { doc: bound } = bindDeck(doc, insights);
  const wanted = new Set(ids);
  return [...(bound.pages || []), ...(bound.appendix || [])].filter((page) => page?.type && (!wanted.size || wanted.has(String(page.id)))).map((page) => {
    const evidence = (Array.isArray(page.evidence) ? page.evidence : []).map((id) => ({ id, finding: insights.get?.(id)?.finding ?? null }));
    const pool = pagePool(page, registry);
    const claims = pageTexts(page).filter(({ written }) => textWords(written) >= 3).map(({ field, written }) => ({
      field, text: written,
      numbers: measurementsIn(written).map((number) => ({ shown: number.shown, states: statedCells(number, pool).map((cell) => `${cell.ref}${cell.label === null ? "" : `@${cell.label}`} = ${cell.value}`) })),
    }));
    return { id: page.id, title: page.title, evidence, claims };
  });
}

/** The sheet as lines to read: each page, its evidence findings, then each sentence with the record behind its numbers - and "CHECK" where a number has none. */
export function claimSheetLines(sheet) {
  return sheet.flatMap((page) => [
    `${page.id}  ${page.title}`,
    ...page.evidence.map((e) => `  evidence ${e.id}: ${e.finding ?? "(no finding recorded)"}`),
    ...page.claims.flatMap((claim) => [`  ${claim.numbers.some((n) => !n.states.length) ? "CHECK" : "ok   "} ${claim.field}: ${claim.text}`,
      ...claim.numbers.map((n) => `        ${n.shown}: ${n.states.length ? n.states.slice(0, 3).join("; ") : "no recorded value at this precision"}`)]),
    "",
  ]);
}
