#!/usr/bin/env node
// spec → plan → scene → editable PPTX → renders → readback → page gates.
//
//   node runtime/build-deck.mjs spec.json out/ [--preflight] [--no-render] [--python python3]
//
// A revision that carries slides from its source deck (revision.mjs) composes, emits and gates only
// the pages it gave a type - written as <id>.composed.pptx - and then assembles the deck: the source
// deck with those slides set in and its edited slides rewritten (emit/assemble_pptx.py). <id>.pptx is
// the assembled deck, rendered into deck/ for the review; every carried slide is read back from it and
// compared with the source's, byte for byte (`revision.preserved` in build-result.json).
//
// Vendor-neutral: node for layout, python-pptx to emit, LibreOffice to render. Writes
// scene.json, planning.json, deck.pptx, rendered/slide-N.png, montage.png, readback.json,
// gates.json and build-result.json into out/. Exit codes (EXIT in errors.mjs):
// 0 when nothing blocks (`built`, or `built-unrendered` with --no-render or with no
// renderer installed; advisories are counted in the result), 2 when a blocker remains
// (`built-with-blockers`, each listed in `blockers` - the deck is still written so it
// can be inspected) or when the input is refused before anything is built (a
// RefusalError: its message is printed, without a stack), 1 on a crash. A deck whose
// storyline gate is not ready builds, with a warning.
//
// Stages that do not read each other's output run side by side: the scene's gates
// beside the emitter, the readback beside the render, and the page gates, the density
// profile and the review sheets together on the renders.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeAll } from "./compose-all.mjs";
import { coverageFindings } from "./compose-deck.mjs";
import { metricsBackend } from "./font-metrics.mjs";
import { runProcess, lastJson } from "./process.mjs";
import { RefusalError, registered } from "./errors.mjs";
import { EXIT, UsageError, isMain, parseCli, pythonBin, readJson, runCli, writeJson } from "./cli.mjs";

import { deckStem } from "./artifact-path.mjs";
import { assertOutputDirectory } from "./output-path.mjs";
import { auditContent } from "./content-audit.mjs";
import { runContentGates } from "./gates/content_gates.mjs";
import { runPlanGates } from "./gates/plan_gates.mjs";
import { craftFindings } from "./gates/craft_gates.mjs";
import { varietyFindings } from "./gates/variety_gates.mjs";
import { structureOf, drawnOf } from "./page-types.mjs";
import { autoFillLogos } from "./fetch-logos.mjs";
import { autoFillPictures } from "./fetch-pictures.mjs";
import { autoFillPlaces } from "./fetch-places.mjs";
import { assetReport, assetsDeclaration, suppliedPictures } from "./asset-needs.mjs";
import { auditTextPlan, auditExportText } from "./text-contract.mjs";
import { writeLedger } from "./claims.mjs";
import { storylineWarning } from "./storyline.mjs";
import { sceneDesignFindings } from "./validate-overlap.mjs";
import { applyRulesVersion, carriedCount, notHeldOn } from "./weight.mjs";
import { ASSEMBLED_RENDERS, ASSEMBLED_SCENE, REVISION_CODES, assemblyOrder, carriedSaid, sourceDeckPath } from "./revision.mjs";
import { activeJudgements, addPending, loadJudgements, withJudgements } from "./judgements.mjs";

const runtime = path.dirname(fileURLToPath(import.meta.url));

/** Why the build refused its input before building: the code a RefusalError carries. */
export const REFUSAL_CODES = Object.freeze({
  STAGE_CONTRACT: "the spec and its content or layout plan disagree on the deck's stable pages",
  STAGE_MISSING: "a new deck arrived without the content or layout plan it is built from",
  CONTENT_REJECTED: "the content plan failed its gates",
  PLAN_REJECTED: "the layout plan failed its gates",
  VARIETY_REJECTED: "the compiled pages break the variety contract",
  TEXT_PLAN_CHANGED: "composition changed the text the content plan records",
  CONTENT_LOST: "composition lost authored content or visual intent",
});

const refuse = (code, message, findings = []) => new RefusalError(registered(REFUSAL_CODES, code), message, findings);
// Stages run side by side are all awaited before a failure is thrown, so no
// process is left writing into the output directory after the build has ended.
async function together(...stages) {
  const settled = await Promise.allSettled(stages);
  const failed = settled.find((s) => s.status === "rejected");
  if (failed) throw failed.reason;
  return settled.map((s) => s.value);
}
/**
 * Whether a finding blocks: every severity a gate gives but `advisory` and
 * `info`. A finding has the one severity its gate gave it (under the deck's
 * rules version); the build and delivery both read it through this test, so
 * neither can call blocking what the other called an advisory.
 */
export const isBlocking = (f) => !["advisory", "info"].includes(f.severity);

/** `report` (a gates report) with `findings` added: counted by code, and failed by any that blocks. */
export function withFindings(report, findings) {
  if (!findings.length) return report;
  const countsByCode = { ...(report.countsByCode || {}) };
  for (const f of findings) countsByCode[f.code] = (countsByCode[f.code] || 0) + 1;
  const blocks = findings.some(isBlocking);
  return { ...report, findings: [...(report.findings || []), ...findings], countsByCode,
    ...(blocks ? { passed: false, accepted: false } : {}) };
}

// New work must retain its approved storyline through authoring. Revisions can
// carry partial plans; they still transfer semantic fields by stable ID only.
export function validateStageContract(spec, stages) {
  if (spec.workflow !== "new_deck") return;
  const pages = [...(spec.cover ? [{...spec.cover,id:"cover",kind:"cover"}] : []), ...spec.slides, ...(spec.appendix || [])];
  if (pages.some(s => !s.id) || new Set(pages.map(s => s.id)).size !== pages.length)
    throw refuse("STAGE_CONTRACT", "New decks require unique stable slide ids before composition");
  for (const stage of ["content", "plan"]) {
    const expected = stage === "content" && stages.content?.textContract !== "complete" ? spec.slides.filter(s => !s.kind || s.kind === "content") : pages;
    const records = stages[stage]?.pages || [];
    const byId = new Map(records.map(r => [r.id, r]));
    if (records.some(r => !r.id) || byId.size !== records.length
        || records.some(r => !pages.some(s => s.id === r.id)))
      throw refuse("STAGE_CONTRACT", `${stage} plan requires unique known stable slide ids`);
    for (const slide of expected) {
      const record = byId.get(slide.id);
      if (!record || record[stage === "content" ? "claim" : "title"] !== slide.title)
        throw refuse("STAGE_CONTRACT", `${stage} plan is missing or has a changed title for ${slide.id}; reconcile the storyline before composition`);
    }
  }
  const first = spec.slides.find(s => !s.kind || s.kind === "content");
  const summary = s => s.role === "executive-summary" || s.shape === "executive-summary";
  const section = spec.slides.findIndex(s => s.kind === "section" || s.kind === "divider");
  if (!first || !summary(first) || (section >= 0 && spec.slides.indexOf(first) > section))
    throw refuse("STAGE_CONTRACT", "New decks require an opening executive summary before the first section");
}

/** The flags that tell a Python gate which rules the deck predates (weight.json rules). */
const rulesArgs = (spec) => [...(spec.workflow ? ["--workflow", String(spec.workflow)] : []),
  ...(Number.isFinite(Number(spec.rulesVersion)) && spec.rulesVersion !== null && spec.rulesVersion !== "" ? ["--rules-version", String(spec.rulesVersion)] : [])];

/**
 * The flag that gives a Python gate the build's judgements (judgements.mjs):
 * the deck's judgements file, or - for judgements held in memory, as a test's
 * are - a copy of them written with the reports.
 */
async function judgementArgs(directory) {
  const session = activeJudgements();
  if (!session) return [];
  if (session.file) return ["--judgements", session.file];
  const copy = path.join(directory, "judgements-read.json");
  await writeJson(copy, { verdicts: Object.fromEntries(session.verdicts) });
  return ["--judgements", copy];
}
/** The questions a gate report found unanswered, added to the build's pending ones by the page ids they were asked on. */
function notePending(report, deck) {
  for (const request of report?.judgementsNeeded ?? []) addPending(activeJudgements(), { ...request, where: (request.where ?? []).map((n) => deck.slides[Number(n) - 1]?.sourceSlideId ?? deck.slides[Number(n) - 1]?.id ?? n) });
}

/**
 * Build the deck at `specPath` into `outputDirectory`.
 *
 * `source` builds a deck held in memory instead - `{ spec, baseDir, content,
 * plan }`, the compiled deck, the folder its assets resolve from and its two
 * stage plans - which is how the author's final check runs this same
 * pipeline before anything is written (author-deck.mjs --check --render), so
 * the check and the build cannot disagree. `only` (a set of page ids) keeps
 * those pages of the composed deck for the emit, the render and the gates: a
 * one-page check renders one page. The deck is still composed whole, so each
 * page keeps its place, its tracker and its number; what the gates say of the
 * deck as a whole is then about a part of it, and the caller reads the page
 * findings alone.
 */
export async function buildDeck(specPath, outputDirectory, options = {}) {
  // The rules that read what copy means read the deck's recorded judgements: the compile's, when it is the compile that
  // builds (an author's check), or the file beside the deck.
  const session = activeJudgements() ?? await loadJudgements(options.source?.baseDir ?? path.dirname(path.resolve(specPath)), deckStem(options.source ? options.source.spec : await readJson(specPath)));
  return withJudgements(session, () => buildWith(specPath, outputDirectory, options));
}

async function buildWith(specPath, outputDirectory, { preflight = false, render = true, timeoutMs = 300000, python = pythonBin(), fetchLogos = true, source = null, only = null } = {}) {
  const started = Date.now();
  const spec = source ? structuredClone(source.spec) : await readJson(specPath);
  const stem = deckStem(spec);
  const baseDir = source?.baseDir ?? path.dirname(path.resolve(specPath));
  // The logos of the declared players marked by one load themselves: reused
  // from assets/logos/, fetched when missing, left as placeholders only when
  // that fails. A player marked by its photograph is fetched with the deck's
  // photographs below, and a place's outline is drawn from the geography data.
  // A deck that declares it is built without the network (asset-needs.mjs) is
  // taken at its word: nothing is fetched, and what is not on disk is recorded.
  const fetchMissing = fetchLogos && assetsDeclaration(spec).fetch !== "none";
  const logos = await autoFillLogos(spec, baseDir, { hint: spec.playersHint, fetchMissing });
  // Photographs planned as `{ alt }` come the same way, from Wikimedia Commons
  // under a free licence, credited on a generated last page; map markers that
  // name a place get its coordinates.
  const pictures = await autoFillPictures(spec, baseDir, { fetchMissing });
  const places = await autoFillPlaces(spec, baseDir, { fetchMissing });
  // What the deck still lacks once the fetch has run or been declined: read by the reviewer's packet and delivery.
  const assets = await assetReport(spec, baseDir, { fetched: fetchMissing });
  const directory = await assertOutputDirectory(outputDirectory);
  await fs.mkdir(directory, { recursive: true });
  // Every report this build is about to write, removed before anything that can
  // throw: a deck that fails to compose leaves no output of its own, and a
  // report left on disk from an earlier run would read as this deck's pass.
  await clearReports(directory);
  const timings = {};
  const fetchedMs = Date.now() - started;
  // Every subprocess is timed under its own name; stages that run side by side
  // are each timed whole, so their sum can exceed the wall time.
  const timed = async (name, work) => { const t = Date.now(); try { return await work(); } finally { timings[name] = Date.now() - t; } };
  const py = (name, args, options = {}) => timed(name, () => runProcess(python, args, { timeoutMs, ...options }));

  // The stages before this one, gated - and, when they are absent, said to be
  // absent. The build looks for the content and layout plans beside the spec,
  // runs the gates of whichever it finds, and records `absent` for whichever it
  // does not. A deck built with no content plan is allowed - not every page of a
  // rebuild needs one - but the build output says the stage did not happen.
  const result = { status: "planned", outputDirectory: directory, timings, stages: {}, ...(logos.filled || logos.failed.length ? { logos } : {}), ...(pictures.filled || pictures.failed.length ? { pictures } : {}), ...(places.placed || places.failed.length ? { places } : {}), ...(assets ? { assets } : {}) };
  if (fetchedMs > 50) timings.assetsMs = fetchedMs;
  const stages = await gateStages({ spec, stem, baseDir, directory, result, source });
  validateStageContract(spec, stages);
  await checkVariety({ spec, specPath, directory, result });
  transferHighlights(spec, stages);
  const { deck, scenePath } = await composeScene({ spec, baseDir, directory, timings, result, stages });
  if (only) await keepPages({ deck, stages, scenePath, result, only });
  // A revision that carries slides composes only the pages it gave a type: those are emitted and gated as a deck of their
  // own, and the deck the user receives is assembled from the source deck around them. A revision that composes no page
  // at all - text edits on carried slides, a slide dropped - has nothing to emit or gate, and is assembled alone.
  const carries = carriedCount(spec) > 0, composes = deck.slides.length > 0;
  if (composes) {
    const { gates, pptxPath, emitted, design } = await preflightScene({ preflight, spec, stem, baseDir, directory, py, result, deck, scenePath, composedOnly: carries });
    if (preflight) { result.status = result.preflight.passed ? "preflight-passed" : "preflight-findings"; return finish(result, directory, started); }
    await readBackAndRender({ render, spec, stem, baseDir, directory, py, result, stages, deck, scenePath, gates, pptxPath, emitted, design, fromMemory: Boolean(source) });
  } else if (preflight) { result.preflight = { passed: true, findings: [] }; result.status = "preflight-passed"; return finish(result, directory, started); }
  if (carries && !only) await assembleRevision({ spec, stem, baseDir, directory, py, result, deck, render });
  withBudget(result);
  Object.assign(result, buildOutcome(result, { render }));
  return finish(result, directory, started);
}

/**
 * The revision's deck, assembled: the source deck with the composed slides
 * set in and the edited slides rewritten (emit/assemble_pptx.py), written as
 * <id>.pptx beside the composed pages' own file, and rendered into deck/ so
 * the review reads the deck the user will open. `result.revision` records
 * the order, what was edited and what was proven kept: each carried slide's
 * parts read back from the written file and compared with the source's.
 */
async function assembleRevision({ spec, stem, baseDir, directory, py, result, deck, render }) {
  const inventoryPath = path.resolve(baseDir, String(spec.inventory));
  const inventory = await readJson(inventoryPath, { optional: true });
  // Without the inventory every carried title reads as changed, and the assembler would rewrite each one: the compile refuses this, and so does the build.
  if (!inventory) throw new RefusalError(registered(REVISION_CODES, "REVISION_SOURCE_MISSING"), `The revision's inventory is not at ${inventoryPath}: the carried slides are read against it. Put back the <id>.inventory.json the import wrote, or import the deck again`);
  const order = assemblyOrder(spec, inventory, deck.slides);
  const composedPath = deck.slides.length ? path.join(directory, `${stem}.composed.pptx`) : null;
  const planPath = path.join(directory, "assembly.json"), pptxPath = path.join(directory, `${stem}.pptx`);
  await writeJson(planPath, { source: sourceDeckPath(spec, inventory, baseDir), sha256: inventory?.source?.sha256 ?? null, composed: composedPath, slides: order });
  const assembled = await py("assembleMs", [path.join(runtime, "emit", "assemble_pptx.py"), planPath, pptxPath], { expect: [0, 2] });
  const report = lastJson(assembled.stdout) ?? {};
  if (assembled.code !== 0) throw new RefusalError(registered(REVISION_CODES, report.refused && /source deck|inventory was read/.test(report.refused) ? "REVISION_SOURCE_MISSING" : "REVISION_CARRY_INVALID"), report.refused ?? assembled.stderr.trim());
  result.pptxPath = pptxPath;
  result.revision = { source: inventory?.source?.file ?? null, order: order.map((item) => ({ id: item.id, ...(item.carry ? { carried: item.carry, ...(item.title !== undefined || item.edits || item.hidden !== undefined ? { edited: true } : {}) } : { composed: item.composed }) })),
    ...(composedPath ? { composedPptx: composedPath } : {}), carried: report.carried, edited: report.edited, composed: report.composed, dropped: report.dropped,
    // The parts only the dropped slides drew on, which left the file with them (a chart's data, its workbook, a picture).
    removed: report.removed ?? [], edits: report.edits, preserved: report.preserved };
  // A carried slide the written file does not hold byte for byte is not the user's slide: the build says so rather than deliver it.
  if (report.preserved?.drifted?.length) result.revisionFindings = report.preserved.drifted.map((index) => ({ code: registered(REVISION_CODES, "REVISION_CARRY_DRIFT"), severity: "blocker", slide: index,
    repair: `Source slide ${index} was carried, and a part it draws on in ${path.basename(pptxPath)} is not the source deck's byte for byte: the assembled file is not the user's deck. This is a fault of the assembler, not of the pages file - report it with the source deck` }));
  // The assembled deck as the review reads it (reviewer.mjs reviewedDeck): every slide in its place - a composed page as the
  // scene holds it, a carried slide by its title and its words, which is all the runtime knows of it.
  const said = new Map(carriedSaid(spec, inventory).map((item) => [item.id, item]));
  const text = (role, value) => ({ type: "text", role, text: value });
  await fs.writeFile(path.join(directory, ASSEMBLED_SCENE), JSON.stringify({ id: deck.id, assembled: true, source: inventory?.source?.file ?? null,
    slides: order.map((item) => (item.composed ? { ...deck.slides[item.composed - 1], composed: item.composed }
      : { id: item.id, carried: { slide: item.carry, edited: Boolean(said.get(item.id)?.edited) }, componentInstances: [],
          nodes: (said.get(item.id)?.texts ?? []).map((value, at) => text(at === 0 ? "action-title" : "paragraph", value)) })) }));
  // The lines the revision rewrote on carried slides join the claim ledger: a figure the revision changed is its own to reproduce.
  const rewritten = [...said.values()].filter((item) => item.rewritten.length).map((item) => ({ id: item.id, nodes: item.rewritten.map((line) => text(line.title ? "action-title" : "paragraph", line.text)) }));
  if (rewritten.length) result.claims = (await writeLedger(directory, { edited: rewritten })).counts;
  if (render) {
    const deckDirectory = path.join(directory, ASSEMBLED_RENDERS);
    const rendered = await py("deckRenderMs", [path.join(runtime, "emit", "render_pptx.py"), pptxPath, deckDirectory], { expect: [0, RENDERER_MISSING] });
    if (rendered.code === RENDERER_MISSING) result.renderSkipped = result.renderSkipped ?? lastJson(rendered.stdout)?.message ?? "The deck was not rendered: the renderer is not installed.";
    else { const sheets = await py("deckSheetsMs", [path.join(runtime, "emit", "render_pptx.py"), "--sheets", deckDirectory]);
      result.revision.render = { directory: deckDirectory, ...lastJson(rendered.stdout), ...(lastJson(sheets.stdout) ?? {}) };
      result.montagePath = result.revision.render.montage ?? result.montagePath; }
  }
}

/** Each stage plan found beside the spec, gated with its report written and refused when rejected; returns the stages that were found. */
async function gateStages({ spec, stem, baseDir, directory, result, source = null }) {
  const stages = {};
  for (const [stage, suffix, run] of [["content", ".content.json", runContentGates],
                                      ["plan", ".plan.json", runPlanGates]]) {
    const at = path.join(baseDir, `${stem}${suffix}`);
    // A deck held in memory brings its stage plans with it.
    const parsed = source ? (source[stage] ? structuredClone(source[stage]) : null) : await readJson(at, { optional: true });
    if (parsed === null && spec.workflow === "new_deck") throw refuse("STAGE_MISSING", `New decks require ${at} before composition`);
    if (parsed === null) { result.stages[stage] = { state: "absent", expectedAt: at }; continue; }
    if (stage === "content" && spec.workflow === "new_deck") parsed.textContract = "complete";
    // The deck's workflow and rules version decide which rules it predates.
    const report = run(parsed, { required: stage === "content" && spec.workflow === "new_deck", deck: spec });
    const reportAt = path.join(directory, `${stage}-gates.json`);
    await writeJson(reportAt, report);
    result.stages[stage] = { state: report.accepted ? "accepted" : "rejected", report: reportAt,
                             countsByCode: report.countsByCode ?? {} };
    if (!report.accepted) {
      throw refuse(stage === "content" ? "CONTENT_REJECTED" : "PLAN_REJECTED", `${stage} gates rejected ${path.basename(at)}: `
        + `${JSON.stringify(report.countsByCode)}. See ${reportAt}.`, (report.findings || []).filter(isBlocking));
    }
    stages[stage] = parsed;
  }
  return stages;
}

// The variety contract, before anything is composed. A deck's structure is
// chosen page by page in its pages file (author-deck.mjs); this refuses a long
// deck whose pages were never typed, whose compiled structure was edited by
// hand, or whose choices add up to one page repeated. It is the same check
// the author ran, so a deck that compiled passes it here. A rule the deck
// predates is reported beside it as an advisory.
async function checkVariety({ spec, specPath, directory, result }) {
  const variety = varietyFindings(spec, { structureOf, drawnOf });
  const varietyBlockers = variety.filter(isBlocking);
  if (variety.length) {
    const reportAt = path.join(directory, "variety-gates.json");
    await writeJson(reportAt, { accepted: !varietyBlockers.length, findings: variety });
    result.stages.variety = { state: varietyBlockers.length ? "rejected" : "accepted", report: reportAt, advisories: variety.length - varietyBlockers.length };
  } else result.stages.variety = { state: "accepted" };
  if (varietyBlockers.length) {
    throw refuse("VARIETY_REJECTED", `The variety contract rejected ${path.basename(specPath)}: ${varietyBlockers.map((f) => f.code).join(", ")}. `
      + `${varietyBlockers[0].repair} See ${result.stages.variety.report}.`, varietyBlockers);
  }
}

/** The composed deck cut to the pages `only` names, with its scene rewritten and its content plan cut to match. */
async function keepPages({ deck, stages, scenePath, result, only }) {
  const kept = (id) => only.has(String(id));
  deck.slides = deck.slides.filter((slide) => kept(slide.sourceSlideId ?? slide.id));
  if (stages.content?.pages) stages.content.pages = stages.content.pages.filter((page) => kept(page.id));
  await fs.writeFile(scenePath, JSON.stringify(deck));
  Object.assign(result, { slides: deck.slides.length, partial: [...only] });
}

// The content plan is an input as well as a checkpoint: it records one
// highlight per page, the phrase the reader should see first. A page that
// does not name its own highlight takes the one its content plan named,
// matched by stable ID so insertions cannot move emphasis to another slide.
function transferHighlights(spec, stages) {
  if (stages.content?.pages?.length) {
    const byId = new Map([...(spec.cover ? [{...spec.cover,id:"cover",kind:"cover"}] : []), ...spec.slides, ...(spec.appendix || [])].filter(s => s.id).map(s => [s.id, s]));
    const seen = new Set();
    for (const page of stages.content.pages) {
      if (!page.id) continue; // Legacy plans are audited but never transferred by position.
      if (seen.has(page.id) || !byId.has(page.id)) throw refuse("STAGE_CONTRACT", `Content plan has duplicate or unknown slide id: ${page.id}`);
      seen.add(page.id);
      const slide = byId.get(page.id);
      const phrase = String(page.highlight ?? "").trim();
      if (phrase && slide.highlight === undefined) slide.highlight = phrase;
    }
  }
}

/** Every page composed, audited against the spec and the content plan's text, and written as the scene and its planning record, with the claim ledger. */
async function composeScene({ spec, baseDir, directory, timings, result, stages }) {
  // Every failing page reported in one run (compose-all.mjs).
  const planStarted = Date.now();
  const { deck, decisions } = composeAll(spec, baseDir);
  // An evaluation of the skill is judged on a deck long enough to show its
  // rhythm, repetition and weakest page; a short one is a diagnostic.
  // The deck's length is every page it renders: the slides a revision carries are pages of it. Whether the rule is held on
  // this deck is the one decision every stage asks (weight.mjs notHeldOn): a refusal here is a refusal at the compile.
  const pages = deck.slides.length + carriedCount(spec);
  if (spec.purpose === "evaluation" && pages < EVALUATION_MIN_PAGES && !notHeldOn({ code: "EVALUATION_TOO_SHORT", measured: pages }, spec)) {
    // The page gates' code (gate_config.py COMPOSE_CODES), refused here before anything is emitted.
    throw new RefusalError("EVALUATION_TOO_SHORT", `An evaluation deck renders at least ${EVALUATION_MIN_PAGES} pages, cover and appendix included; this one composes ${pages}. Widen the evidence, not the repetition, or drop purpose: "evaluation" for a diagnostic.`);
  }
  const contentAudit = auditContent(spec, deck);
  const textAudit = auditTextPlan(stages.content || {}, deck, { deck: spec });
  await writeJson(path.join(directory, "text-coverage.json"), textAudit);
  if (!textAudit.accepted) throw refuse("TEXT_PLAN_CHANGED", `Composition changed the dot-dash text: ${JSON.stringify(textAudit.findings)}`, textAudit.findings);
  await writeJson(path.join(directory, "content-audit.json"), contentAudit);
  if (!contentAudit.accepted) throw refuse("CONTENT_LOST", `Composition lost authored content or visual intent: ${JSON.stringify(contentAudit.findings)}`, contentAudit.findings);
  const scenePath = path.join(directory, "scene.json");
  // Compact: the scene runs to megabytes and only programs read it.
  await fs.writeFile(scenePath, JSON.stringify(deck));
  await writeJson(path.join(directory, "planning.json"), decisions);
  Object.assign(result, { scenePath, slides: deck.slides.length, metrics: metricsBackend() });
  // The claim ledger the author works through before the review (references/taste-review.md#self-check).
  result.claims = (await writeLedger(directory)).counts;
  timings.planMs = Date.now() - planStarted;
  return { deck, scenePath };
}

/** The story gates beside the emitter, then the coverage, craft and design findings folded into the preflight report. */
async function preflightScene({ preflight, spec, stem, baseDir, directory, py, result, deck, scenePath, composedOnly = false }) {
  // Story gates need only the scene (titles, words, hedges, monotony), so they
  // run beside the emitter, which needs only the scene too.
  const gates = path.join(runtime, "gates", "page_gates.py");
  const preflightReport = path.join(directory, "preflight-gates.json");
  // Beside carried slides the composed pages are a file of their own; the deck is assembled from it afterwards.
  const pptxPath = path.join(directory, composedOnly ? `${stem}.composed.pptx` : `${stem}.pptx`);
  const [pre, emitted] = await together(
    py("preflightMs", [gates, scenePath, "--report", preflightReport, ...rulesArgs(spec), ...(await judgementArgs(directory))], { expect: [0, 2] }),
    preflight ? null : py("emitMs", [path.join(runtime, "emit", "emit_pptx.py"), scenePath, pptxPath]));
  result.preflight = judged({ ...(await readReport(preflightReport)), report: preflightReport, passed: pre.code === 0 }, spec);
  notePending(result.preflight, deck);
  delete result.preflight.judgementsNeeded;
  const coverage = coverageFindings(spec);
  if (coverage.length) { result.preflight.findings = [...(result.preflight.findings || []), ...coverage]; result.preflight.passed = false; result.preflight.accepted = false; result.preflight.countsByCode = { ...(result.preflight.countsByCode || {}), MISSING_EVIDENCE: coverage.length }; }
  // Deck craft floors, read off the spec and the composed scene. A blocker
  // fails the preflight, so the deck is built for inspection but never delivered.
  // The build bars are held here over the pages this build drew, as at the compile and at delivery (build-bars.mjs barOutcome).
  const craft = craftFindings(spec, deck, { picturesSupplied: await suppliedPictures(baseDir) });
  if (craft.length) {
    result.preflight.findings = [...(result.preflight.findings || []), ...craft];
    for (const f of craft) result.preflight.countsByCode = { ...(result.preflight.countsByCode || {}), [f.code]: ((result.preflight.countsByCode || {})[f.code] || 0) + 1 };
    if (craft.some(isBlocking)) { result.preflight.passed = false; result.preflight.accepted = false; }
  }
  // The scene's design checks (validate-overlap.mjs): a label a line runs
  // through, a label on a neighbour's edge, a numeral whose descender sits on
  // its rule, a scatter with no key. They read the composed geometry, so they
  // are reported with the page gates before the render, and in gates.json after it.
  const design = applyRulesVersion(sceneDesignFindings(deck), spec);
  result.preflight = withFindings(result.preflight, design);
  await writeJson(preflightReport, result.preflight);
  return { gates, pptxPath, emitted, design };
}

/**
 * A Python gate's report as this deck is held to it, by the one decision
 * every stage asks (weight.mjs notHeldOn): the gates know the rules a deck's
 * version predates, and not which rules that measure the deck a revision's
 * composed pages are too few to be read by. A report that failed only for
 * findings the deck is not held to passes; one that failed with no finding
 * to show for it still fails.
 */
export function judged(report, spec) {
  if (!Array.isArray(report.findings)) return report;
  const findings = applyRulesVersion(report.findings, spec);
  const blocked = report.findings.some(isBlocking), blocks = findings.some(isBlocking);
  return { ...report, findings, ...(blocked && !blocks ? { passed: true, accepted: true } : {}) };
}

/** The emitted file read back beside its render; with a renderer, the page gates, density profile and review sheets on the renders. */
async function readBackAndRender({ render, spec, stem, baseDir, directory, py, result, stages, deck, scenePath, gates, pptxPath, emitted, design, fromMemory = false }) {
  result.emit = lastJson(emitted.stdout);
  result.pptxPath = pptxPath;

  // The readback reads the saved file and the render converts it: neither
  // reads the other's output.
  const renderDirectory = path.join(directory, "rendered");
  const [readback, rendered] = await together(
    py("readbackMs", [path.join(runtime, "emit", "readback_pptx.py"), scenePath, pptxPath], { expect: [0, 2] }),
    render ? py("renderMs", [path.join(runtime, "emit", "render_pptx.py"), pptxPath, renderDirectory], { expect: [0, RENDERER_MISSING] }) : null);
  result.readback = lastJson(readback.stdout);
  await writeJson(path.join(directory, "readback.json"), result.readback);

  if (rendered) {
    result.render = lastJson(rendered.stdout);
    if (rendered.code === RENDERER_MISSING) {
      // No LibreOffice or poppler: the deck is written and every scene gate
      // has run; the pixel gates and the review sheets are skipped, and the
      // result says what to install. Delivery still requires a rendered build.
      result.renderSkipped = result.render?.message ?? "The deck was not rendered: the renderer is not installed.";
    } else {
      result.textCoverage = auditExportText(stages.content || {}, deck, await readReport(result.render.pageText), { deck: spec });
      await writeJson(path.join(directory, "rendered-text-coverage.json"), result.textCoverage);
      result.renderDirectory = renderDirectory;
      // The page gates, the density profile and the review sheets each read
      // the renders and nothing else, so they run together.
      const gateReport = path.join(directory, "gates.json");
      const profileReport = path.join(directory, "density-profile.json");
      // The density profile reads the content plan from a file: the one beside the spec, or, for a deck held in memory, a copy written with the reports.
      const contentAt = fromMemory ? path.join(directory, "content-plan.json") : path.join(baseDir, `${stem}.content.json`);
      if (fromMemory && stages.content) await writeJson(contentAt, stages.content);
      const withContent = result.stages.content?.state === "accepted" ? [contentAt] : [];
      const [gated, profiled, sheets] = await together(
        py("gatesMs", [gates, scenePath, renderDirectory, "--report", gateReport, ...rulesArgs(spec), ...(await judgementArgs(directory))], { expect: [0, 2] }),
        // The density profile: the rendered pages measured against the
        // skill's density targets. A page's flags are the review's density
        // pass to judge (references/taste-review.md); the deck's words a block
        // across its prose pages blocks (TEXT_FRAGMENTED).
        py("densityMs", [path.join(runtime, "gates", "density_profile.py"), result.render.pdf, scenePath, ...withContent, "--report", profileReport, ...rulesArgs(spec)]),
        py("sheetsMs", [path.join(runtime, "emit", "render_pptx.py"), "--sheets", renderDirectory]));
      result.gates = withFindings(judged({ ...(await readReport(gateReport)), report: gateReport, passed: gated.code === 0 }, spec), design);
      notePending(result.gates, deck);
      delete result.gates.judgementsNeeded;
      if (design.length) { const { report: _, passed: __, ...written } = result.gates; await writeJson(gateReport, written); }
      result.densityProfile = { report: profileReport, ...lastJson(profiled.stdout), findings: applyRulesVersion((await readReport(profileReport)).findings ?? [], spec) };
      Object.assign(result.render, lastJson(sheets.stdout) ?? {});
      result.montagePath = result.render?.montage;
    }
  }
}

// The deck's budget, in one block: what its pages carry against the
// reference targets, so a regression is a number in the build output
// rather than a screenshot somebody notices later.
function withBudget(result) {
  const density = result.gates?.density;
  if (density) {
    result.budget = {
      bodyWords: density.bodyWords?.median ?? null,
      bodyFloor: density.bodyWords?.floor ?? null,
      referenceBodyWords: density.bodyWords?.referenceMedian ?? null,
      footerWords: density.footerWords?.median ?? null,
      referenceFooterWords: density.footerWords?.referenceMedian ?? null,
      columnFill: density.columnFill?.median ?? null,
      plotSpan: density.plotSpan?.median ?? null,
    };
  }
}

// render_pptx.py's exit when LibreOffice or poppler is not installed.
const RENDERER_MISSING = 3;

// The blockers the build names when a report failed without a finding of its own.
export const BUILD_CODES = Object.freeze({
  READBACK_MISSING: "the saved file was not read back, so nothing says it matches the scene",
  PREFLIGHT_FAILED: "the scene's gates failed without naming a finding",
  GATES_FAILED: "the rendered page gates failed without naming a finding",
});

/**
 * The build's status, read off its blockers alone. Advisories - a thin page, a
 * flat mix, an unannotated plot - are the review's to judge: they are counted
 * beside the status, never in it. Every blocker is listed with its source, and
 * only a blocker makes the build exit 2.
 */
export function buildOutcome(result, { render = true } = {}) {
  const blockers = [], seen = new Set(), causes = new Map();
  const add = (source, f) => {
    // One empty band is one blocker, however many instruments measured it
    // (page_gates.py void_causes): the scene's gate and the render's report
    // the same band, and listed apiece they read as that many defects. The
    // blocker keeps every code that reported it, and where the band came from.
    if (f.cause && causes.has(f.cause)) { const first = causes.get(f.cause); if (!first.codes.includes(f.code)) first.codes.push(f.code); if (f.origin && !first.origin) first.origin = f.origin; return; }
    const key = `${source}|${f.code}|${f.slide ?? f.id ?? ""}|${JSON.stringify(f.measured ?? f.text ?? f.shape ?? "")}`;
    if (seen.has(key)) return;
    seen.add(key);
    const blocker = { source, code: f.code, ...(f.slide != null ? { slide: f.slide } : {}), ...(f.id ? { id: f.id } : {}), ...(f.text || f.shape ? { text: f.text ?? f.shape } : {}), ...(f.repair ? { repair: f.repair } : {}),
      ...(f.cause ? { cause: f.cause, codes: [f.code], ...(f.origin ? { origin: f.origin } : {}) } : {}) };
    if (f.cause) causes.set(f.cause, blocker);
    blockers.push(blocker);
  };
  const blocking = isBlocking;
  // The half-empty habit is counted on the render once there is one
  // (page_gates.py gate_deck_empty_pages): the scene's count before the render
  // is the same habit, and is not a second blocker beside the render's.
  const superseded = (f) => render && result.gates && f.code === "DECK_SCENE_VOID";
  if (result.preflight && result.preflight.passed === false) for (const f of (result.preflight.findings || []).filter(blocking).filter((f) => !superseded(f))) add("page gates", f);
  if (result.gates && result.gates.passed === false) for (const f of (result.gates.findings || []).filter(blocking)) add("page gates", f);
  // A revision that composed no page emitted no file of its own to read back: its deck is the assembled one, proven against the source.
  const assembledOnly = Boolean(result.revision) && !result.revision.composed;
  if (result.readback?.accepted !== true && !assembledOnly) {
    for (const f of result.readback?.findings || []) add("readback", f);
    if (!(result.readback?.findings || []).length) add("readback", { code: registered(BUILD_CODES, "READBACK_MISSING") });
  }
  if (result.textCoverage?.accepted === false) for (const f of (result.textCoverage.findings || []).filter(blocking)) add("rendered text", f);
  for (const f of (result.densityProfile?.findings || []).filter(blocking)) add("density profile", f);
  for (const f of result.revisionFindings || []) add("assembly", f);
  // A report that failed without naming a finding is still a blocker.
  if (result.preflight?.passed === false && !(result.preflight.findings || []).some(blocking)) add("page gates", { code: registered(BUILD_CODES, "PREFLIGHT_FAILED") });
  if (render && result.gates && result.gates.passed === false && !blockers.some((b) => b.source === "page gates")) add("page gates", { code: registered(BUILD_CODES, "GATES_FAILED") });
  // The scene's gates run twice, before the render and after it, so a code
  // counts as often as either run saw it, not the sum.
  const counts = (report) => (report?.findings || []).filter((f) => !blocking(f)).reduce((m, f) => ({ ...m, [f.code]: (m[f.code] || 0) + 1 }), {});
  const before = counts(result.preflight), after = counts(result.gates);
  const advisories = Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])].sort().map((code) => [code, Math.max(before[code] || 0, after[code] || 0)]));
  const status = blockers.length ? "built-with-blockers" : render && (result.gates || (assembledOnly && result.revision.render)) ? "built" : "built-unrendered";
  return { status, blockers, advisories };
}

// A gate that stopped before writing its report leaves none: read as empty,
// and its exit code decides.
const readReport = async (file) => (await readJson(file, { optional: true })) ?? {};

// The build's own outputs, in the order it writes them. Nothing else in the
// directory is touched: the renders keep their own folder and a spec sitting
// beside its build is the author's.
export const BUILD_REPORTS = Object.freeze([
  "scene.json", "planning.json", "preflight-gates.json", "content-audit.json",
  "readback.json", "gates.json", "build-result.json", "text-coverage.json", "rendered-text-coverage.json",
  "density-profile.json", "claims.json", "assembly.json", ASSEMBLED_SCENE,
]);

// Skill evaluations are judged on at least this many rendered pages
// (SKILL.md "Evaluation and delivery"); `purpose: "evaluation"` enforces it.
export const EVALUATION_MIN_PAGES = 50;

async function clearReports(directory) {
  await Promise.all(BUILD_REPORTS.map((name) => fs.rm(path.join(directory, name), { force: true })));
}

async function finish(result, directory, started) {
  // Wall time, start to finish: stages that ran side by side are timed whole,
  // so their sum is not how long the build took.
  result.timings.wallMs = Date.now() - started;
  // The questions the build's rules asked that no recorded judgement answers: delivery refuses the build until they are.
  const open = [...(activeJudgements()?.pending?.values() ?? [])];
  if (open.length) result.judgements = { pending: open.length, kinds: open.reduce((n, item) => ({ ...n, [item.kind]: (n[item.kind] ?? 0) + 1 }), {}) };
  await writeJson(path.join(directory, "build-result.json"), result);
  return result;
}

const USAGE = "Usage: build-deck.mjs spec.json output-directory [--preflight] [--no-render] [--no-fetch]";

async function main(argv) {
  const { values, positionals } = parseCli(argv, { preflight: { type: "boolean" }, "no-render": { type: "boolean" }, "no-fetch": { type: "boolean" },
    python: { type: "string", valueName: "an executable" } }, { usage: USAGE });
  if (positionals.length < 2) throw new UsageError(USAGE);
  const [specPath, outDirectory] = positionals.map((p) => path.resolve(p));
  const result = await buildDeck(specPath, outDirectory, { preflight: values.preflight, render: !values["no-render"], fetchLogos: !values["no-fetch"], python: values.python });
  // Blockers by name, advisories by count: the line says what stops the
  // build and, separately, what the review will read.
  const blockers = result.blockers?.length ? { count: result.blockers.length, byCode: result.blockers.reduce((m, b) => ({ ...m, [b.code]: (m[b.code] || 0) + 1 }), {}), first: result.blockers.slice(0, 8).map((b) => `${b.code}${b.id ?? b.slide ? ` [${b.id ?? b.slide}]` : ""} (${b.source})${b.text ? ` "${String(b.text).slice(0, 40)}"` : ""}`) } : undefined;
  console.log(JSON.stringify({ status: result.status, ...(blockers ? { blockers } : {}), advisories: result.advisories, stages: Object.fromEntries(Object.entries(result.stages || {}).map(([k, v]) => [k, v.state])), pptx: result.pptxPath, montage: result.montagePath, ...(result.renderSkipped ? { renderSkipped: result.renderSkipped } : {}), gates: result.gates ? { passed: result.gates.passed, counts: result.gates.countsByCode } : undefined, budget: result.budget, readback: result.readback?.accepted, textCoverage: result.textCoverage?.accepted, timings: result.timings }));
  if (result.renderSkipped) console.error(result.renderSkipped);
  // Built, but not yet through the storyline gate: said here, not enforced -
  // delivery refuses the deck until the gate is ready, and the build is how
  // the copy gets drafted and checked before then.
  const story = await storylineWarning(await readJson(specPath), outDirectory, { deckPath: specPath });
  if (story) console.error(story);
  return ["built", "built-unrendered", "preflight-passed"].includes(result.status) ? EXIT.ok : EXIT.refused;
}

// A refusal is the author's to repair: its message is the whole story. A crash
// is ours, and keeps its stack (runCli).
if (isMain(import.meta.url)) runCli(main);
