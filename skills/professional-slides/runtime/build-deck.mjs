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
// RefusalError: its message is printed, without a stack), 1 on a crash.
//
// Every check is page-local or about the saved file: a page that does not fit or
// overlaps, a chart drawn wrongly, a number that cannot be bound, text or shapes the
// saved file lost. Stages that do not read each other's output run side by side: the
// scene's gates beside the emitter, the readback beside the render, and the page gates
// beside the contact sheets on the renders.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeAll } from "./compose-all.mjs";
import { metricsBackend } from "./font-metrics.mjs";
import { runProcess, lastJson } from "./process.mjs";
import { RefusalError, registered } from "./errors.mjs";
import { EXIT, UsageError, isMain, parseCli, pythonBin, readJson, runCli, writeJson } from "./cli.mjs";

import { deckStem } from "./artifact-path.mjs";
import { assertOutputDirectory } from "./output-path.mjs";
import { staleCompile } from "./pages-file.mjs";
import { auditContent } from "./content-audit.mjs";
import { autoFillLogos } from "./fetch-logos.mjs";
import { autoFillFlags } from "./fetch-flags.mjs";
import { autoFillPictures } from "./fetch-pictures.mjs";
import { autoFillPlaces } from "./fetch-places.mjs";
import { assetReport, assetsDeclaration } from "./asset-needs.mjs";
import { auditExportText } from "./text-contract.mjs";
import { deriveContent } from "./derive-content.mjs";
import { sceneDesignFindings } from "./validate-overlap.mjs";
import { carriedCount } from "./weight.mjs";
import { ASSEMBLED_RENDERS, ASSEMBLED_SCENE, REVISION_CODES, assemblyOrder, carriedSaid, sourceDeckPath } from "./revision.mjs";

const runtime = path.dirname(fileURLToPath(import.meta.url));

/** Why the build refused its input before building: the code a RefusalError carries. */
export const REFUSAL_CODES = Object.freeze({
  CONTENT_LOST: "composition lost authored content or visual intent",
  DECK_OLDER_THAN_PAGES: "the deck.json was compiled from a pages file, or a part of it, that has changed since",
});

const refuse = (code, message, findings = []) => new RefusalError(registered(REFUSAL_CODES, code), message, findings);

/** What the build says of a deck.json older than its pages (pages-file.mjs staleCompile), and the compile that writes a current one. */
function staleMessage(stale, deckFile) {
  const what = stale.unreadable ? `${stale.pages} no longer reads (${stale.unreadable})`
    : [stale.changed.length ? `changed: ${stale.changed.join(", ")}` : null, stale.added.length ? `added: ${stale.added.join(", ")}` : null,
      stale.removed.length ? `no longer included: ${stale.removed.join(", ")}` : null].filter(Boolean).join("; ") || "its parts were reordered";
  return `${deckFile} was compiled from ${stale.pages} as it stood before the pages changed (${what}), so a build would report on pages that are no longer there. `
    + `Run node runtime/author-deck.mjs ${stale.pages} to write a current ${deckFile} (a --check writes none), then build again.`;
}
// Stages run side by side are all awaited before a failure is thrown, so no
// process is left writing into the output directory after the build has ended.
async function together(...stages) {
  const settled = await Promise.allSettled(stages);
  const failed = settled.find((s) => s.status === "rejected");
  if (failed) throw failed.reason;
  return settled.map((s) => s.value);
}
/** Whether a finding blocks: every severity a gate gives but `advisory` and `info`. */
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

/**
 * Build the deck at `specPath` into `outputDirectory`.
 *
 * `source` builds a deck held in memory instead - `{ spec, baseDir }`, the
 * compiled deck and the folder its assets resolve from - which is how the
 * author's final check runs this same pipeline before anything is written
 * (author-deck.mjs --check --render), so the check and the build cannot
 * disagree. `only` (a set of page ids) keeps those pages of the composed deck
 * for the emit, the render and the gates: a one-page check renders one page.
 * The deck is still composed whole, so each page keeps its place, its tracker
 * and its number.
 */
export async function buildDeck(specPath, outputDirectory, { preflight = false, render = true, timeoutMs = 300000, python = pythonBin(), fetchLogos = true, source = null, only = null } = {}) {
  const started = Date.now();
  const spec = source ? structuredClone(source.spec) : await readJson(specPath);
  const stem = deckStem(spec);
  const baseDir = source?.baseDir ?? path.dirname(path.resolve(specPath));
  // A deck.json stands for its pages as they were when it was compiled. One whose pages file or parts changed since is
  // refused, not built: on the BA retest the last `--check --render` wrote no deck.json, and the build read one ten
  // minutes older and reported five blockers the pages had already fixed.
  const stale = source ? null : staleCompile(spec, baseDir);
  if (stale) throw refuse("DECK_OLDER_THAN_PAGES", staleMessage(stale, path.basename(specPath)));
  // The logos of the declared players marked by one load themselves: reused
  // from assets/logos/, fetched when missing, left as placeholders only when
  // that fails. A player marked by its photograph is fetched with the deck's
  // photographs below, and a place's outline is drawn from the geography data.
  // A deck that declares it is built without the network (asset-needs.mjs) is
  // taken at its word: nothing is fetched, and what is not on disk is recorded.
  const fetchMissing = fetchLogos && assetsDeclaration(spec).fetch !== "none";
  const logos = await autoFillLogos(spec, baseDir, { hint: spec.playersHint, fetchMissing });
  // The flags the pages name come from Wikimedia Commons by the country's name, reused from assets/flags/.
  const flags = await autoFillFlags(spec, baseDir, { fetchMissing });
  // Photographs and illustrations planned as `{ alt }` come the same way, from
  // Wikimedia Commons under a free licence, credited on a generated last page;
  // map markers that name a place get its coordinates.
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

  const result = { status: "planned", outputDirectory: directory, timings, ...(logos.filled || logos.failed.length ? { logos } : {}), ...(flags.filled || flags.failed.length ? { flags } : {}), ...(pictures.filled || pictures.failed.length ? { pictures } : {}), ...(places.placed || places.failed.length ? { places } : {}), ...(assets ? { assets } : {}) };
  if (fetchedMs > 50) timings.assetsMs = fetchedMs;
  const { deck, scenePath } = await composeScene({ spec, baseDir, directory, timings, result });
  if (only) await keepPages({ deck, scenePath, result, only });
  // A revision that carries slides composes only the pages it gave a type: those are emitted and gated as a deck of their
  // own, and the deck the user receives is assembled from the source deck around them. A revision that composes no page
  // at all - text edits on carried slides, a slide dropped - has nothing to emit or gate, and is assembled alone.
  const carries = carriedCount(spec) > 0, composes = deck.slides.length > 0;
  if (composes) {
    const { gates, pptxPath, emitted, design } = await preflightScene({ preflight, stem, directory, py, result, deck, scenePath, composedOnly: carries });
    if (preflight) { result.status = result.preflight.passed ? "preflight-passed" : "preflight-findings"; return finish(result, directory, started); }
    await readBackAndRender({ render, spec, directory, py, result, deck, scenePath, gates, pptxPath, emitted, design });
  } else if (preflight) { result.preflight = { passed: true, findings: [] }; result.status = "preflight-passed"; return finish(result, directory, started); }
  if (carries && !only) await assembleRevision({ spec, stem, baseDir, directory, py, result, deck, render });
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
  // The assembled deck's scene: every slide in its place - a composed page as the scene holds it, a carried slide by its
  // title and its words, which is all the runtime knows of it.
  const said = new Map(carriedSaid(spec, inventory).map((item) => [item.id, item]));
  const text = (role, value) => ({ type: "text", role, text: value });
  await fs.writeFile(path.join(directory, ASSEMBLED_SCENE), JSON.stringify({ id: deck.id, assembled: true, source: inventory?.source?.file ?? null,
    slides: order.map((item) => (item.composed ? { ...deck.slides[item.composed - 1], composed: item.composed }
      : { id: item.id, carried: { slide: item.carry, edited: Boolean(said.get(item.id)?.edited), reworded: Boolean(said.get(item.id)?.reworded),
          ...(said.get(item.id)?.hidden !== undefined ? { hidden: said.get(item.id).hidden } : {}) }, componentInstances: [],
          nodes: (said.get(item.id)?.texts ?? []).map((value, at) => text(at === 0 ? "action-title" : "paragraph", value)) })) }));
  if (render) {
    const deckDirectory = path.join(directory, ASSEMBLED_RENDERS);
    const rendered = await py("deckRenderMs", [path.join(runtime, "emit", "render_pptx.py"), pptxPath, deckDirectory], { expect: [0, RENDERER_MISSING] });
    if (rendered.code === RENDERER_MISSING) result.renderSkipped = result.renderSkipped ?? lastJson(rendered.stdout)?.message ?? "The deck was not rendered: the renderer is not installed.";
    else { const sheets = await py("deckSheetsMs", [path.join(runtime, "emit", "render_pptx.py"), "--sheets", deckDirectory]);
      result.revision.render = { directory: deckDirectory, ...lastJson(rendered.stdout), ...(lastJson(sheets.stdout) ?? {}) };
      result.montagePath = result.revision.render.montage ?? result.montagePath; }
  }
}

/** The composed deck cut to the pages `only` names, with its scene rewritten. */
async function keepPages({ deck, scenePath, result, only }) {
  const kept = (id) => only.has(String(id));
  deck.slides = deck.slides.filter((slide) => kept(slide.sourceSlideId ?? slide.id));
  await fs.writeFile(scenePath, JSON.stringify(deck));
  Object.assign(result, { slides: deck.slides.length, partial: [...only] });
}

/** Every page composed, audited against the spec, and written as the scene and its planning record. */
async function composeScene({ spec, baseDir, directory, timings, result }) {
  // Every failing page reported in one run (compose-all.mjs).
  const planStarted = Date.now();
  const { deck, decisions } = composeAll(spec, baseDir);
  const contentAudit = auditContent(spec, deck);
  await writeJson(path.join(directory, "content-audit.json"), contentAudit);
  if (!contentAudit.accepted) throw refuse("CONTENT_LOST", `Composition lost authored content or visual intent: ${JSON.stringify(contentAudit.findings)}`, contentAudit.findings);
  const scenePath = path.join(directory, "scene.json");
  // Compact: the scene runs to megabytes and only programs read it.
  await fs.writeFile(scenePath, JSON.stringify(deck));
  await writeJson(path.join(directory, "planning.json"), decisions);
  Object.assign(result, { scenePath, slides: deck.slides.length, metrics: metricsBackend() });
  timings.planMs = Date.now() - planStarted;
  return { deck, scenePath };
}

/** The scene's page gates beside the emitter, then the scene's design findings folded into the preflight report. */
async function preflightScene({ preflight, stem, directory, py, result, deck, scenePath, composedOnly = false }) {
  // The page gates need only the scene, so they run beside the emitter, which needs only the scene too.
  const gates = path.join(runtime, "gates", "page_gates.py");
  const preflightReport = path.join(directory, "preflight-gates.json");
  // Beside carried slides the composed pages are a file of their own; the deck is assembled from it afterwards.
  const pptxPath = path.join(directory, composedOnly ? `${stem}.composed.pptx` : `${stem}.pptx`);
  const [pre, emitted] = await together(
    py("preflightMs", [gates, scenePath, "--report", preflightReport], { expect: [0, 2] }),
    preflight ? null : py("emitMs", [path.join(runtime, "emit", "emit_pptx.py"), scenePath, pptxPath]));
  result.preflight = { ...(await readReport(preflightReport)), report: preflightReport, passed: pre.code === 0 };
  delete result.preflight.judgementsNeeded;
  // The scene's design checks (validate-overlap.mjs): a label a line runs
  // through, a label on a neighbour's edge, a numeral whose descender sits on
  // its rule, a scatter with no key. They read the composed geometry, so they
  // are reported with the page gates before the render, and in gates.json after it.
  const design = sceneDesignFindings(deck);
  result.preflight = withFindings(result.preflight, design);
  await writeJson(preflightReport, result.preflight);
  return { gates, pptxPath, emitted, design };
}

/** The emitted file read back beside its render; with a renderer, the page gates and contact sheets on the renders. */
async function readBackAndRender({ render, spec, directory, py, result, deck, scenePath, gates, pptxPath, emitted, design }) {
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
      // Every text the scene drew, found on its rendered page.
      result.textCoverage = auditExportText(deriveContent(spec, deck), deck, await readReport(result.render.pageText), { deck: spec });
      await writeJson(path.join(directory, "rendered-text-coverage.json"), result.textCoverage);
      result.renderDirectory = renderDirectory;
      // The page gates and the contact sheets each read the renders and nothing else, so they run together.
      const gateReport = path.join(directory, "gates.json");
      const [gated, sheets] = await together(
        py("gatesMs", [gates, scenePath, renderDirectory, "--report", gateReport], { expect: [0, 2] }),
        py("sheetsMs", [path.join(runtime, "emit", "render_pptx.py"), "--sheets", renderDirectory]));
      result.gates = withFindings({ ...(await readReport(gateReport)), report: gateReport, passed: gated.code === 0 }, design);
      delete result.gates.judgementsNeeded;
      if (design.length) { const { report: _, passed: __, ...written } = result.gates; await writeJson(gateReport, written); }
      Object.assign(result.render, lastJson(sheets.stdout) ?? {});
      result.montagePath = result.render?.montage;
    }
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
 * The build's status, read off its blockers alone. Advisories are counted
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
  "readback.json", "gates.json", "build-result.json", "rendered-text-coverage.json",
  "assembly.json", ASSEMBLED_SCENE,
]);

async function clearReports(directory) {
  await Promise.all(BUILD_REPORTS.map((name) => fs.rm(path.join(directory, name), { force: true })));
}

async function finish(result, directory, started) {
  // Wall time, start to finish: stages that ran side by side are timed whole,
  // so their sum is not how long the build took.
  result.timings.wallMs = Date.now() - started;
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
  console.log(JSON.stringify({ status: result.status, ...(blockers ? { blockers } : {}), advisories: result.advisories, pptx: result.pptxPath, montage: result.montagePath, ...(result.renderSkipped ? { renderSkipped: result.renderSkipped } : {}), gates: result.gates ? { passed: result.gates.passed, counts: result.gates.countsByCode } : undefined, readback: result.readback?.accepted, textCoverage: result.textCoverage?.accepted, timings: result.timings }));
  if (result.renderSkipped) console.error(result.renderSkipped);
  return ["built", "built-unrendered", "preflight-passed"].includes(result.status) ? EXIT.ok : EXIT.refused;
}

// A refusal is the author's to repair: its message is the whole story. A crash
// is ours, and keeps its stack (runCli).
if (isMain(import.meta.url)) runCli(main);
