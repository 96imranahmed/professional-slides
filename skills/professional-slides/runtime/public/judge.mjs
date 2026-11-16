// The judgement loop: wherever the layout engine chose between ways of setting a page, someone looks.
//
// The engine lays out every arrangement of a page's blocks, with every way each block's content can be realised, and
// scores them (tasteful-layout). A score ranks the candidates; it does not see the page, and a rule written for one
// case would be right for that page and wrong for the next. So every arrangement the engine chose between two or more
// drawable candidates is put to a judge, not only the close ones: the best few (`SHOWN`) are drawn as the pages they
// would be, set side by side, and put to whoever called: the agent building the deck. Its choice is recorded on the
// page (`choices`), where every later build holds to it, so the judgement is made once and the build stays deterministic.
//
// The loop is bounded by construction. The judge chooses among pages already drawn; it is never asked how a page could
// be better, and a layout judgement never sends the author back to the page's words. A decision is asked once: recorded,
// it is held and not reopened. A choice can open one inside it, so a page is asked at most three times (`ROUNDS`) and
// then left as it stands.
import fs from "node:fs/promises";
import path from "node:path";
import { readJson, writeJsonWhole, pythonBin } from "../cli.mjs";
import { pagesOf, pageIn, readPagesFile } from "../pages-file.mjs";
import { runProcess } from "../process.mjs";
import { deckHtml } from "../emit/emit_html.mjs";
import { renderHtml } from "../emit/render_html.mjs";
import { compileWorkspace, complete, needed, runtime, rewritePages } from "./workspace.mjs";

// How many candidates of a decision are shown, and how many choices a page takes before it is left alone.
const SHOWN = 3, ROUNDS = 3;
/** What the judge is asked to weigh. It is said once here, and travels with every round. */
export const RUBRIC = Object.freeze([
  "The exhibit has the room its data needs: not flattened into a strip, not stood on end, not shrunk to make room for words.",
  "Text is set at a line a reader can follow, and reads as one group with space around it rather than spread to fill a column.",
  "Blocks side by side start and end together; nothing is left stranded in a corner or against an edge.",
  "One takeaway is a statement, not a list of one; several parallel points are parallel on the page.",
  "The page does not repeat the arrangement of the pages either side of it where its content allows another.",
  "Where two candidates are equally good, the simpler one.",
]);

const pageOf = (slide) => String(slide.sourceSlideId ?? slide.id);
/** A page's first decision still open: one the engine made between two or more drawable candidates that no judge has settled. */
const openDecision = (slide) => (slide.decisions || []).find((decision) => !decision.held && decision.candidates.length > 1);
const drawn = (slide) => JSON.stringify(slide.nodes.map((node) => [node.type, node.role, node.frame, node.text, node.style?.align]));
// Pages are read as the deck is built from them (pages-file.mjs `pagesOf`, `pageIn`): a page in a part, or in the
// appendix, is compiled and asked about like any other.

/** `judge WORK --choices FILE`: record a judge's choices - `{ <page id>: { <decision id>: <candidate label> } }` - on their pages. */
export async function recordChoices(work, file) {
  const chosen = await readJson(path.resolve(file));
  const source = await readPagesFile(work.file);
  const unknown = Object.keys(chosen).filter((id) => !pageIn(source, id));
  if (unknown.length) throw new Error(`No page ${unknown.join(", ")} in ${work.file} or the parts it includes`);
  // A choice is written on its page in the file that holds it - the pages file, or the part the page was included from -
  // so the includes stay as written and the parts a worker owns stay theirs.
  const owners = await rewritePages(work, Object.fromEntries(Object.entries(chosen).map(([id, choice]) => [id, (page) => ({ ...page, choices: { ...page.choices, ...choice } })])));
  // Each choice is a verdict: the candidate preferred, and the measures of every candidate it was preferred over. They are
  // what the engine's weights are checked and fitted against (evals/taste).
  const round = await readJson(path.join(work.root, "judgement", "round.json"), { optional: true }) ?? [];
  const verdicts = round.filter((asked) => chosen[asked.page]?.[asked.decision]).map((asked) => JSON.stringify({ ...asked, chosen: chosen[asked.page][asked.decision] }));
  if (verdicts.length) await fs.appendFile(path.join(work.root, "judgement", "verdicts.jsonl"), `${verdicts.join("\n")}\n`);
  return complete({ artifacts: owners, message: `Recorded on ${Object.keys(chosen).join(", ")}. Run judge again: a choice can open another inside it. When none is open, build.` });
}

/** `judge WORK --out OUT`: draw each page's open decision as its candidates and ask which stands. */
export async function judgeWorkspace(work, out) {
  const compiled = await compileWorkspace(work);
  if (compiled.held) return compiled.held;
  const { source } = compiled;
  // A recorded choice the page no longer honours - the flow it names is gone, or its candidate cannot be drawn any more -
  // is said, not kept silently: the page is drawn the engine's way meanwhile, and the choice is the author's to remove.
  const stale = pagesOf(source).flatMap((page) => Object.entries(page.choices ?? {}).filter(([id, label]) =>
    !compiled.authored.deck.slides.some((slide) => pageOf(slide) === String(page.id) && (slide.decisions || []).some((decision) => decision.id === id && decision.held && decision.chosen === label)))
    .map(([decision, label]) => ({ page: String(page.id), decision, label })));
  const staleNote = stale.length ? { stale, staleMessage: `${stale.length} recorded choice${stale.length === 1 ? " is" : "s are"} no longer honoured (${stale.map((entry) => `${entry.page}: ${entry.decision}`).join("; ")}): the page changed under ${stale.length === 1 ? "it" : "them"}. Remove ${stale.length === 1 ? "it" : "them"} from the page's \`choices\` and judge again.` } : {};
  const asked = [];
  for (const slide of compiled.authored.deck.slides) {
    const decision = openDecision(slide);
    const settled = Object.keys(pageIn(source, pageOf(slide))?.choices ?? {}).length;
    if (decision && settled < ROUNDS && !asked.some((entry) => entry.page === pageOf(slide))) asked.push({ page: pageOf(slide), decision, candidates: [{ ...decision.candidates[0], slide }] });
  }
  if (!asked.length) return complete({ stage: "judge", ...staleNote, message: "No layout decision is left open: every arrangement the engine chose between has a judge's recorded choice, or the page has had its rounds. Build." });
  // One more compile for each runner-up shown: every asked page holds its nth candidate at once.
  for (let nth = 1; nth < SHOWN; nth += 1) {
    const holding = asked.filter((entry) => entry.decision.candidates[nth]);
    if (!holding.length) break;
    const doc = structuredClone(source);
    for (const entry of holding) { const page = pageIn(doc, entry.page); page.choices = { ...page.choices, [entry.decision.id]: entry.decision.candidates[nth].label }; }
    const variant = await compileWorkspace(work, { doc });
    for (const entry of holding) {
      const slide = variant.authored?.deck.slides.find((s) => pageOf(s) === entry.page && (s.decisions || []).some((d) => d.id === entry.decision.id && d.held));
      // A candidate that cannot be drawn after all, or is drawn exactly as one already shown, is not a choice.
      if (slide && !entry.candidates.some((shown) => drawn(shown.slide) === drawn(slide))) entry.candidates.push({ ...entry.decision.candidates[nth], slide });
    }
  }
  const open = asked.filter((entry) => entry.candidates.length > 1);
  if (!open.length) return complete({ stage: "judge", ...staleNote, message: "The candidates draw the same page: nothing to choose. Build." });
  const directory = path.resolve(out);
  await fs.mkdir(directory, { recursive: true });
  const slides = open.flatMap((entry) => entry.candidates.map((candidate) => candidate.slide));
  const render = await renderHtml(deckHtml({ ...compiled.authored.deck, slides }, { actual: true }), path.join(directory, "rendered"));
  let at = 0;
  const requiredInputs = [];
  for (const entry of open) {
    const candidates = entry.candidates.map(({ slide: _slide, label, score, ...measures }) => ({ label, score, measures, ...(render.renders ? { image: render.renders[at++] } : {}) }));
    let sheet = null;
    if (render.renders) {
      sheet = path.join(directory, `${entry.page}.png`);
      const layout = path.join(directory, `${entry.page}.sheet.json`);
      await writeJsonWhole(layout, { out: sheet, title: String(pageIn(source, entry.page)?.title ?? entry.page), subtitle: `${entry.decision.id}: the same content, set ${candidates.length} ways`, header: false,
        tiles: candidates.map((candidate, nth) => ({ label: `${nth + 1}. ${candidate.label}`, note: nth ? `score ${candidate.score}` : `score ${candidate.score} (the engine's choice)`, images: [{ path: candidate.image }] })) });
      await runProcess(pythonBin(), [path.join(runtime, "emit/contact_sheet.py"), layout]);
    }
    requiredInputs.push({ kind: "judgement", page: entry.page, decision: entry.decision.id, ...(sheet ? { sheet } : {}), candidates,
      message: `Look at ${sheet ?? "the measures"} and choose the candidate that reads best for page ${entry.page}; the first is the engine's choice, and choosing it settles the decision.` });
  }
  // What was asked, kept beside the workspace: a recorded choice is filed with the measures it was chosen over (verdicts.jsonl).
  await fs.mkdir(path.join(work.root, "judgement"), { recursive: true });
  await writeJsonWhole(path.join(work.root, "judgement", "round.json"), requiredInputs.map(({ page, decision, candidates }) => ({ page, decision, density: pageIn(source, page)?.density ?? source.deck?.density ?? "executive", candidates: candidates.map(({ label, score, measures }) => ({ label, score, measures })) })));
  return needed(requiredInputs, { stage: "judge", ...staleNote, rubric: RUBRIC, artifacts: requiredInputs.map((input) => input.sheet).filter(Boolean),
    ...(render.skipped ? { message: `${render.skipped} The candidates are listed with their measures only.` } : {}),
    record: `Write { "<page id>": { "<decision id>": "<candidate label>" } } for every page judged to a file, then: judge WORK --choices FILE. Then run judge again until it reports nothing open.` });
}
