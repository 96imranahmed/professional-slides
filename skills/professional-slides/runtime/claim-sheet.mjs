// The claims of a page set out for its writer to check against the record
// before anyone else does (`author-deck.mjs <pages> --claims <ids>`): every
// sentence the page says, as the reader meets it, with the recorded value each
// number in it states and the finding that holds each absolute word in it. A
// self-check of a hundred-page deck spent an hour and a quarter repairing
// claims that went too far; a writer who reads this sheet before handing the
// page on catches most of them in the minute it takes.
import { bindDeck } from "./bind.mjs";
import { measureRegistry } from "./measures.mjs";
import { measurementsIn } from "./printed-numbers.mjs";
import { pagePool, pageTexts, statedCells } from "./gates/dependency_gates.mjs";
import { claimWords, holds } from "./claim-words.mjs";
import { textWords } from "./text-contract.mjs";

/**
 * Each named page (all of them where `ids` is empty) as
 * `{ id, title, evidence: [{ id, finding }], claims: [{ field, text, numbers, words }] }`:
 * `numbers` each `{ shown, states }` - the cells (`ref@label = value`) the
 * number is a value of at its printed precision, empty where it is no
 * recorded value - and `words` each `{ word, family, heldBy }`, the evidence
 * insights whose finding says a word of the same family, empty where none
 * does. A sentence of fewer than three words (a label, a figure on its own) is
 * left out: it states a number, which the exhibit's binding already holds.
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
      words: claimWords(written).map(({ family, word }) => ({ word, family, heldBy: evidence.filter((e) => e.finding && holds(e.finding, family)).map((e) => e.id) })),
    }));
    return { id: page.id, title: page.title, evidence, claims };
  });
}

/** The sheet as lines to read: each page, its evidence findings, then each sentence with what checks it - and "CHECK" where nothing does. */
export function claimSheetLines(sheet) {
  return sheet.flatMap((page) => [
    `${page.id}  ${page.title}`,
    ...page.evidence.map((e) => `  evidence ${e.id}: ${e.finding ?? "(no finding recorded)"}`),
    ...page.claims.flatMap((claim) => {
      const open = claim.numbers.some((n) => !n.states.length) || claim.words.some((w) => !w.heldBy.length);
      return [`  ${open ? "CHECK" : "ok   "} ${claim.field}: ${claim.text}`,
        ...claim.numbers.map((n) => `        ${n.shown}: ${n.states.length ? n.states.slice(0, 3).join("; ") : "no recorded value at this precision"}`),
        ...claim.words.map((w) => `        "${w.word}" (${w.family}): ${w.heldBy.length ? `said by ${w.heldBy.join(", ")}` : "no evidence finding says one"}`)];
    }),
    "",
  ]);
}
