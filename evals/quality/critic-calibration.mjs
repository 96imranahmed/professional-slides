#!/usr/bin/env node
/**
 * How far can the storyline critic's rating be trusted?
 *
 *   node evals/quality/critic-calibration.mjs --repeats 5              every anchor, five answers each
 *   node evals/quality/critic-calibration.mjs --repeats 3 --anchors finance,finance:declined-answer
 *   node evals/quality/critic-calibration.mjs --repeats 5 --dry-run    print the commands, call nothing
 *   node evals/quality/critic-calibration.mjs --list                   the anchors and what each plants
 *   node evals/quality/critic-calibration.mjs --repeats 3 --parallel 4 four critic calls at a time
 *   node evals/quality/critic-calibration.mjs --raw <dir>              keep every answer as the critic returned it, and each packet
 *   node evals/quality/critic-calibration.mjs --from-raw <dir>         score the answers a run kept, calling nothing
 *
 * A benchmark's storyline was rated 5, then 4, then 6.2. The three packets
 * were three different decks, so the numbers say nothing about the critic:
 * neither that it is noisy nor that the deck got better. Two measurements
 * answer the question, and this runs both on packets that do not change.
 *
 * - Repeats. One frozen packet - the prompt, the schema, the spine - is given
 *   to a fresh critic `--repeats` times. The spread of those ratings is the
 *   critic's own noise: a later change in a deck's rating smaller than it is
 *   not a result.
 * - Anchors. The fixture decks under fixtures/evidence/ as they are
 *   (clean), and each with one defect of argument planted that a critic must
 *   find: an answer that declines the request, the comparison its players need
 *   cut, an exhibit about something else kept as "context", a page that
 *   restates its neighbour. Calibration is discrimination: a critic is
 *   calibrated when every planted deck is sent back with a blocking item on
 *   the check that was planted, AND its clean twin draws no blocking item on
 *   that check - a critic that files under every check catches every plant
 *   and tells nothing apart - and it says of every deck that carries an
 *   expected verdict what its owner expects, and it does not send back every
 *   deck it is shown. Whether a planted deck is also rated below its clean
 *   deck by more than the repeat spread is reported second and decides
 *   nothing: a real critic caught every plant while its ratings did not
 *   separate, so a rating difference is not what a delivery bar can rest on.
 *   The clean fixture decks carry no expected verdict: six pages are too thin
 *   to say what a ready storyline is, so a critic that sends one back is not
 *   wrong, and the run reports their verdict as not measured. They are twins
 *   for their plants, not anchors for a rating.
 *
 * Every answer is validated as the storyline loop validates it
 * (validateStorylineRecord): an answer the loop would refuse is counted as
 * invalid, not rated - and counted apart from the calibration verdict, which
 * is read off the valid answers alone (`form` in the result: how many answers
 * failed on form, and under which rule). The critic is the judge command in
 * config.json (its `{packet}` is the staged packet directory; `{schemaJson}`
 * the packet's schema inline, `{schemaPath}` the file holding it, and
 * `{schema}` whichever the judge's `schemaAs` names - lib.mjs schemaVars);
 * this costs `anchors x repeats` critic calls, so `--dry-run` first.
 *
 * A six-page fixture cannot say what "8, ready" looks like on a fifty-page
 * storyline. Two kinds of full-size anchor can:
 *
 *   --anchor-dir <dir>   decks from outside the repo, one folder each, with
 *                        an `anchor.json` giving the verdict its owner expects
 *                        ({ "deck": "<id>.pages.json" or "<id>.deck.json",
 *                        "expect": "ready" | "revise", "about": "..." }) - a
 *                        user's own decks, good and bad, which is what a
 *                        rating can be anchored to;
 *   showcase             the repo's worked-example deck (FULL_SIZE), clean
 *                        and with the plants that apply to it. It is an anchor
 *                        for FORM at full size - do fifty pages come back
 *                        valid, how wide is the spread, are the plants caught
 *                        - and carries no expected verdict: a deck written to
 *                        show every page type proves nothing about a good
 *                        argument.
 *
 *   --review-packet <staged packet>   the same repeat measurement for a
 *                        deck-review packet deliver-deck staged (exit 3): the
 *                        packet's own prompt, `--repeats` times, each answer
 *                        validated as delivery validates a first pass.
 *
 * Results are written to runs/critic-calibration/<skill version>.json and
 * printed. Exit 0 calibrated, 2 not (or nothing valid came back). A run's
 * answers are kept where `--raw <dir>` (or CRITIC_CALIBRATION_RAW) says - each
 * as the critic returned it, with the packet it answered - so a change to
 * what is measured is scored on the answers already paid for (`--from-raw`).
 * calibration/ holds the summary of the run the README cites.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { EXIT, isMain, parseCli, runCli } from "../../skills/professional-slides/runtime/cli.mjs";
import { compileDeck, readInsights } from "../../skills/professional-slides/runtime/author-deck.mjs";
import { alternativesOf } from "../../skills/professional-slides/runtime/analysis.mjs";
import { prepareStoryline, validateStorylineRecord, storylineItems } from "../../skills/professional-slides/runtime/storyline.mjs";
import { validateReview, deckItems, groupedErrors, spineAgreement } from "../../skills/professional-slides/runtime/reviewer.mjs";
import { BLOCKING, advanceLedger } from "../../skills/professional-slides/runtime/review-passes.mjs";
import { readPagesFileSync } from "../../skills/professional-slides/runtime/pages-file.mjs";
import { readInsightLog } from "../../skills/professional-slides/runtime/measures.mjs";
import { QUALITY, ROOT, fillTemplate, parseJudgeOutput, schemaVars, skillSha, spread } from "./lib.mjs";

const FIXTURES = path.join(QUALITY, "fixtures", "evidence");
const PROMPT = "You are the storyline critic. Read prompt.md in the packet directory and follow it exactly: judge from the packet alone and return ONLY the JSON it asks for.";

/**
 * The defects of argument planted on a clean fixture deck. `plant(doc, files)`
 * mutates the pages document (and the staged files' plan, by name) and
 * `check` is the storyline check a critic must file a major or blocker under.
 */
export const PLANTED = Object.freeze({
  "declined-answer": { decks: ["finance", "product", "public-ops"], check: ["answer"],
    about: "the governing answer declines the request instead of answering it",
    plant(doc) { doc.deck.answer = "The evidence cannot rank the options, and no defensible call can be made on either question."; } },
  "comparison-cut": { decks: ["finance", "product"], check: ["missing", "shape", "answer", "pillars"],
    about: "the declared players are never set on common measures: the comparison and its page are cut",
    plant(doc, files) {
      const cut = files.analysis.analyses.filter((a) => a.op === "compare").map((a) => a.id);
      files.analysis.analyses = files.analysis.analyses.filter((a) => a.op !== "compare");
      doc.pages = doc.pages.filter((page) => !(page.evidence || []).some((id) => cut.includes(id)));
    } },
  "context-off-claim": { decks: ["finance", "public-ops", "product"], check: ["shape", "sourcing", "claim", "consequence"],
    about: "a page's chart is replaced by another page's and kept as declared context, so nothing on the exhibit proves the claim",
    plant(doc) {
      const charted = (page) => page.exhibit?.basis && Array.isArray(page.exhibit.series);
      const [target, donor] = [doc.pages.find(charted), [...doc.pages].reverse().find(charted)];
      target.exhibit = { ...structuredClone(donor.exhibit), basis: { ...donor.exhibit.basis, role: "context", relevance: "It is shown beside the claim for the reader to weigh" } };
      target.evidence = [...new Set([...(target.evidence || []), ...donor.exhibit.basis.measures.map((ref) => ref.split("/")[0])])];
    } },
  "restated-page": { decks: ["finance", "public-ops", "product", "explainer"], check: ["restatement", "cuts"],
    about: "a page repeats the claim, the evidence and the exhibit of the page before it",
    plant(doc) { const page = structuredClone(doc.pages.find((p) => p.exhibit)); page.id = `${page.id}-again`; doc.pages.splice(doc.pages.findIndex((p) => p.id + "-again" === page.id) + 1, 0, page); } },
});

/** Every anchor: each fixture deck clean, and each planted defect on the decks that take it. */
export function anchors() {
  const decks = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".pages.json")).sort().map((f) => f.replace(/\.pages\.json$/, ""));
  return [...decks.map((deck) => ({ id: deck, deck, planted: null })),
    ...Object.entries(PLANTED).flatMap(([name, p]) => p.decks.filter((deck) => decks.includes(deck)).map((deck) => ({ id: `${deck}:${name}`, deck, planted: name })))];
}

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);

/**
 * The repo's own full-size anchor: the worked-example deck, which compiles to
 * about fifty pages, clean and with each plant that applies to a deck with no
 * insight log. An anchor for form, never for the argument: it has no expected
 * verdict (`expect: null`), so a critic that sends it back is not wrong.
 */
export const FULL_SIZE = Object.freeze([{ id: "showcase", dir: path.join(ROOT, "skills", "professional-slides", "examples"), deck: "page-types", plants: ["declined-answer", "restated-page"],
  about: "the worked example of every page type: full size, for form - validity, spread and whether a plant is caught among fifty pages - not for what a good argument is rated" }]);

/** The full-size anchors of the repo: each clean, with no expected verdict, and with its plants. */
export const fullSizeAnchors = () => FULL_SIZE.flatMap((item) => [{ id: item.id, deck: item.deck, dir: item.dir, planted: null, expect: null, fullSize: true, about: item.about },
  ...item.plants.map((name) => ({ id: `${item.id}:${name}`, deck: item.deck, dir: item.dir, planted: name, pairs: item.id, fullSize: true }))]);

const EXPECTED = ["ready", "revise"];
/**
 * The anchors a user supplies (`--anchor-dir`): one folder a deck, holding
 * the deck's files as the author left them and an `anchor.json` -
 * { deck, expect, about } - with the verdict its owner expects of a careful
 * critic. A folder with no anchor.json, or one that does not say `expect`, is
 * refused: a deck with no expected verdict anchors nothing.
 */
export function externalAnchors(directory) {
  const root = path.resolve(directory);
  return fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().map((name) => {
    const dir = path.join(root, name), said = readJson(path.join(dir, "anchor.json"));
    if (!said || !EXPECTED.includes(said.expect) || typeof said.deck !== "string" || !/\.(pages|deck)\.json$/.test(said.deck) || !fs.existsSync(path.join(dir, said.deck)))
      throw new Error(`${dir}: an anchor folder holds anchor.json - { "deck": "<id>.pages.json" or "<id>.deck.json" (a file in the folder), "expect": "ready" or "revise", "about": "why" }`);
    return { id: `user/${name}`, deck: said.deck.replace(/\.(pages|deck)\.json$/, ""), dir, compiled: said.deck.endsWith(".deck.json"), planted: null, expect: said.expect, external: true, about: said.about ?? "",
      // The rating a person gave the deck, where one is on record: printed beside the critic's, never averaged into it.
      ...(Number.isFinite(said.rating) ? { human: said.rating } : {}) };
  });
}

// What of an anchor's folder is the deck's own: not an earlier critique of it, and not a build.
const NOT_THE_DECK = new Set([".reviews", "out", "anchor.json", "node_modules", ".git"]);

/** An anchor's deck (with a defect planted) staged as a task folder, and the frozen storyline packet for it. */
export async function freeze(anchor, root) {
  const dir = path.join(root, anchor.id.replace(/[^A-Za-z0-9._-]+/g, "_"));
  const out = path.join(dir, "out");
  fs.mkdirSync(out, { recursive: true });
  const source = anchor.dir ?? FIXTURES;
  const specPath = path.join(dir, `${anchor.deck}.deck.json`);
  // A user's deck travels whole - its log, its analyses, its sources - and is read where it is staged.
  if (anchor.external) for (const entry of fs.readdirSync(source)) if (!NOT_THE_DECK.has(entry)) fs.cpSync(path.join(source, entry), path.join(dir, entry), { recursive: true });
  if (!anchor.compiled) {
    const doc = readPagesFileSync(path.join(anchor.external ? dir : source, `${anchor.deck}.pages.json`));
    if (!anchor.external) {
      // The log with its parts merged (measures.mjs), staged as one file: a part's path would not resolve in the task folder.
      const log = await readInsightLog(source, anchor.deck);
      const { include: _include, parts: _parts, ...recorded } = log ?? {};
      const files = { insights: log ? recorded : null, analysis: readJson(path.join(source, `${anchor.deck}.analysis.json`)) };
      if (anchor.planted) PLANTED[anchor.planted].plant(doc, files);
      if (files.insights) fs.writeFileSync(path.join(dir, `${anchor.deck}.insights.json`), JSON.stringify(files.insights));
      if (files.analysis) fs.writeFileSync(path.join(dir, `${anchor.deck}.analysis.json`), JSON.stringify(files.analysis));
      fs.mkdirSync(path.join(dir, "sources"), { recursive: true });
      for (const item of files.insights?.insights || []) for (const file of item.sources || []) fs.writeFileSync(path.join(dir, file), "illustrative fixture data\n");
    }
    const insights = await readInsights(dir, anchor.deck, { alternatives: alternativesOf(doc.deck) });
    // The spine as a draft compiles it: the planted deck may break an authoring
    // rule - that is the point - and the critic is still shown what was written.
    // A draft is the full compile, so a planted page it refuses is not among its slides: the page's record of what its spine
    // declares (`failed[].record`) stands in its place, in page order.
    const { spec, failed } = compileDeck(doc, { insights, draft: true, partial: true });
    const place = new Map(doc.pages.map((page, index) => [String(page.id ?? (page.kind ? `${page.kind}-${index + 1}` : `page-${index + 1}`)), index]));
    const shown = [...spec.slides, ...failed.filter((f) => f.record).map((f) => f.record)].sort((a, b) => (place.get(String(a.id)) ?? 0) - (place.get(String(b.id)) ?? 0));
    fs.writeFileSync(specPath, JSON.stringify({ ...spec, slides: shown }));
  }
  const step = await prepareStoryline(specPath, out);
  if (step.status !== "packet-written") throw new Error(`${anchor.id}: no storyline packet (${step.status}: ${(step.errors || []).join("; ")})`);
  const packet = readJson(path.join(step.dir, "packet.json"));
  return { dir, staging: step.dir, packet, schema: path.join(step.dir, "schema.json") };
}

function context(packet) {
  const ids = packet.pages.map((p) => p.id);
  return { ids, contentIds: packet.pages.filter((p) => !p.kind || p.kind === "content").map((p) => p.id), mode: packet.mode,
    insightIds: packet.insights?.present ? new Set(packet.insights.items.map((i) => i.id)) : null, sources: packet.sources ?? [],
    analyses: packet.analyses ?? [], evidenceScope: packet.evidenceScope ?? null, answerStatus: packet.answerStatus ?? null };
}

/** What one frozen anchor's answers say: how many were valid, the spread of their ratings, and whether the planted defect was found. */
export function summarizeAnchor(anchor, packet, answers) {
  const valid = [], invalid = [];
  for (const answer of answers) {
    const errors = answer ? validateStorylineRecord(answer, context(packet)) : ["no JSON answer"];
    (errors.length ? invalid : valid).push({ answer, errors });
  }
  const ratings = valid.map((v) => v.answer.rating);
  const verdicts = valid.map((v) => v.answer.verdict);
  const share = (list, test) => (list.length ? Math.round(100 * list.filter(test).length / list.length) / 100 : null);
  const wanted = anchor.planted ? PLANTED[anchor.planted].check : null;
  const filesUnder = (answer, checks) => storylineItems(answer).some((item) => BLOCKING.has(item.severity) && checks.includes(item.dimension));
  const found = (answer) => filesUnder(answer, wanted);
  // A clean deck is the twin of every plant: how often it draws a blocking item on the check each plant is caught on, with nothing planted.
  const unplanted = Object.fromEntries(Object.entries(PLANTED).map(([name, plant]) => [name, share(valid.map((v) => v.answer), (answer) => filesUnder(answer, plant.check))]));
  // An anchor with an expected verdict: the share of valid answers that gave it (provisional counts as ready - it passes the gate).
  const expected = anchor.expect ? { expect: anchor.expect, agreed: share(verdicts, (v) => (v === "revise" ? "revise" : "ready") === anchor.expect) } : {};
  return { id: anchor.id, deck: anchor.deck, planted: anchor.planted, ...(anchor.pairs ? { pairs: anchor.pairs } : {}), ...(anchor.fullSize ? { fullSize: true } : {}), ...expected, ...(anchor.human !== undefined ? { human: anchor.human } : {}),
    pages: packet.pages.length, answers: answers.length, valid: valid.length, invalid: invalid.map((i) => i.errors.slice(0, 3)),
    rating: spread(ratings), verdicts: Object.fromEntries([...new Set(verdicts)].map((v) => [v, verdicts.filter((x) => x === v).length])),
    agreement: share(verdicts, (v) => v === verdicts[0]), sufficiency: Object.fromEntries([...new Set(valid.map((v) => v.answer.sufficiency.verdict))].map((s) => [s, valid.filter((v) => v.answer.sufficiency.verdict === s).length])),
    ...(wanted ? { caught: share(valid.map((v) => v.answer), found), saidRevise: share(verdicts, (v) => v === "revise") } : { saidReady: share(verdicts, (v) => v !== "revise"), unplanted }) };
}

/**
 * The calibration over every anchor: the critic's noise floor (the median
 * repeat spread), and for each planted anchor whether it was sent back and
 * caught on its check while its clean twin drew no blocking item on that
 * check (`discriminated`), and - second - whether it was rated below its
 * clean deck by more than that noise.
 *
 * `calibrated` is discrimination: every pair discriminated, every deck that
 * carries an expected verdict given it, and not every deck sent back. A
 * critic that catches every plant because it files under every check, or
 * that sends back whatever it is shown, has told nothing apart. A clean row
 * that does not say how its twin's check fared on it (`unplanted`) leaves the
 * pair not measured.
 */
export function calibration(rows) {
  const measured = rows.filter((row) => row.rating.n >= 2);
  const sds = measured.map((row) => row.rating.sd).sort((a, b) => a - b);
  const noise = sds.length ? sds[Math.floor((sds.length - 1) / 2)] : null;
  // A planted anchor is set against its clean deck: the fixture of its name, or the full-size anchor it says it pairs with.
  const clean = new Map(rows.filter((row) => !row.planted).map((row) => [row.pairs ?? row.id, row]));
  const pairs = rows.filter((row) => row.planted).map((row) => {
    const base = clean.get(row.pairs ?? row.deck);
    const gap = base?.rating.mean !== null && base?.rating.mean !== undefined && row.rating.mean !== null ? Math.round((base.rating.mean - row.rating.mean) * 100) / 100 : null;
    const widest = Math.max(base?.rating.sd ?? 0, row.rating.sd ?? 0);
    // The planted check on the clean twin: the share of its answers that file a blocking item there with nothing planted.
    const cleanFiled = base?.unplanted?.[row.planted] ?? null;
    return { anchor: row.id, clean: base?.rating.mean ?? null, planted: row.rating.mean, gap, spread: widest, ordered: gap !== null && gap > 0, separated: gap !== null && gap > widest, caught: row.caught, saidRevise: row.saidRevise,
      cleanFiled, discriminated: row.caught === 1 && row.saidRevise === 1 && cleanFiled === 0,
      // A pair one side of which returned no valid answer was not measured: that is a fact about form, not about the critic's judgement.
      measured: row.valid > 0 && (base?.valid ?? 0) > 0 && cleanFiled !== null };
  });
  // Form, apart from the verdict: how many answers the loop would refuse, and under which of its rules.
  const answers = rows.reduce((n, row) => n + row.answers, 0), invalid = rows.reduce((n, row) => n + row.invalid.length, 0);
  const rules = new Map();
  for (const row of rows) for (const errors of row.invalid) { const rule = String(errors[0] ?? "no answer").replace(/\[\d+\]|\([^)]*\)/g, "").replace(/\s+/g, " ").slice(0, 90); rules.set(rule, (rules.get(rule) ?? 0) + 1); }
  const form = { answers, invalid, valid: answers - invalid, share: answers ? Math.round(100 * invalid / answers) / 100 : null, rules: [...rules].sort((a, b) => b[1] - a[1]).map(([rule, count]) => ({ rule, count })) };
  // The anchors that carry an expected verdict: what a rating can be anchored to.
  const anchored = rows.filter((row) => row.expect).map((row) => ({ anchor: row.id, expect: row.expect, agreed: row.agreed, rating: row.rating.mean, ...(row.human !== undefined ? { human: row.human } : {}), pages: row.pages }));
  const expecting = (verdict) => spread(anchored.filter((a) => a.expect === verdict && a.rating !== null).map((a) => a.rating));
  const judged = pairs.filter((p) => p.measured);
  const unmeasured = [...pairs.filter((p) => !p.measured).map((p) => p.anchor), ...anchored.filter((a) => a.agreed === null).map((a) => a.anchor)];
  // The primary measures: did the critic say of each deck what was expected of it (a planted deck sent back, a user's deck
  // given the verdict its owner expects); did it file the planted defect under the check it was planted in; and did that check
  // stay quiet on the clean twin (`discriminated`: all three of a pair). A real critic caught every plant while its ratings
  // did not separate, so the rating is reported second and decides nothing - and a critic that caught every plant by filing
  // under every check on every deck was called calibrated, so the catch alone decides nothing either.
  const count = (list, test) => ({ met: list.filter(test).length, of: list.length });
  const primary = { verdict: count([...judged.map((p) => p.saidRevise === 1), ...anchored.filter((a) => a.agreed !== null).map((a) => a.agreed === 1)], Boolean), caught: count(judged, (p) => p.caught === 1),
    cleanQuiet: count(judged, (p) => p.cleanFiled === 0), discriminated: count(judged, (p) => p.discriminated) };
  const ratingSeparation = { ...count(judged, (p) => p.separated), ordered: judged.filter((p) => p.ordered).length };
  // A verdict that is the same for every deck is not a verdict: every valid answer on every anchor said revise.
  const verdicts = rows.filter((row) => row.valid > 0).map((row) => row.verdicts ?? {});
  const sendsEverythingBack = verdicts.length > 1 && verdicts.every((said) => Object.keys(said).length > 0 && Object.keys(said).every((verdict) => verdict === "revise"));
  // The clean fixture decks carry no expected verdict (they are twins for their plants, too thin to anchor "ready"): what the critic said of them is reported and not measured.
  const twins = rows.filter((row) => !row.planted && !row.expect);
  const cleanVerdict = { measured: false, decks: twins.length, sentBack: twins.filter((row) => row.valid > 0 && row.saidReady === 0).map((row) => row.id), passed: twins.filter((row) => row.valid > 0 && row.saidReady === 1).map((row) => row.id),
    reading: "not measured: a clean fixture deck carries no expected verdict - a critic that sends a six-page fixture back is not wrong - so what was said of it anchors nothing" };
  const why = [
    ...(judged.some((p) => p.caught !== 1 || p.saidRevise !== 1) ? [`a planted deck was not sent back with its plant caught: ${judged.filter((p) => p.caught !== 1 || p.saidRevise !== 1).map((p) => p.anchor).join(", ")}`] : []),
    ...(judged.some((p) => p.cleanFiled !== 0) ? [`the planted check fires on the clean deck too, so catching the plant tells the two apart no better than chance would: ${judged.filter((p) => p.cleanFiled !== 0).map((p) => `${p.anchor} (clean ${p.cleanFiled})`).join(", ")}`] : []),
    ...(anchored.some((a) => a.agreed !== null && a.agreed !== 1) ? [`a deck was not given the verdict its owner expects: ${anchored.filter((a) => a.agreed !== null && a.agreed !== 1).map((a) => a.anchor).join(", ")}`] : []),
    ...(sendsEverythingBack ? ["every answer on every deck said revise: a verdict that never changes tells nothing apart"] : []),
  ];
  const calibrated = judged.length + anchored.length > 0 && !unmeasured.length && !why.length && [...clean.values()].every((row) => row.valid > 0);
  return { noiseFloor: noise, primary, ratingSeparation, pairs, anchored, ratingAnchors: { ready: expecting("ready"), revise: expecting("revise") }, cleanVerdict, sendsEverythingBack, form, invalidAnswers: invalid, unmeasured, calibrated, why,
    // A pair that was measured and not told apart is a failure whatever else was not measured.
    verdict: why.length ? "not calibrated" : unmeasured.length ? "not measured" : calibrated ? "calibrated" : "not calibrated",
    reading: noise === null ? "one answer an anchor: the spread is not measured; run with --repeats 3 or more"
      : `a deck's rating must move by more than ${noise} between two critiques before the move is anything but the critic's own spread${anchored.length ? "" : "; no anchor carried an expected verdict, so nothing here says what rating a ready storyline gets - supply decks you consider good and bad with --anchor-dir"}` };
}

/**
 * The repeat measurement for a deck-review packet delivery staged: what one
 * frozen packet's answers say - how many validate as a first pass, the spread
 * of their ratings and of their finding counts, whether they agree on
 * acceptance, and how many of their blocking findings the storyline critic
 * could have decided at the spine (reviewer.mjs spineAgreement).
 */
export function summarizeReview(packet, answers) {
  const ids = (packet.slides || []).map((slide) => slide.id);
  const valid = [], invalid = [];
  for (const answer of answers) {
    const errors = answer ? validateReview(answer, ids, { waivers: packet.waivers ?? [], revision: packet.revision ?? null, floors: packet.floors ?? null }) : ["no JSON answer"];
    (errors.length ? invalid : valid).push({ answer, errors });
  }
  const ledgers = valid.map((v) => advanceLedger([], v.answer, deckItems(v.answer)));
  return { kind: "deck-review", pages: ids.length, answers: answers.length, valid: valid.length, invalid: invalid.map((i) => groupedErrors(i.errors).slice(0, 3)),
    rating: spread(valid.map((v) => v.answer.rating)), accepted: valid.filter((v) => v.answer.accepted === true).length,
    findings: spread(valid.map((v) => v.answer.findings.length)), atSpine: spread(ledgers.map((ledger) => spineAgreement(ledger).blocking)) };
}

const REVIEW_PROMPT = "You are the deck reviewer. Read prompt.md in the packet directory and follow it exactly: open the page images it lists, judge from the packet alone and return ONLY the JSON it asks for.";

const fileName = (id) => String(id).replace(/[^A-Za-z0-9._-]+/g, "_");

/**
 * One critic call, answered when the command exits. `raw`, where a run keeps
 * its answers, is the directory and the name the answer is kept under: what
 * the critic wrote to its output as it wrote it, and - once an anchor - the
 * packet, prompt and schema it answered.
 */
function ask(judge, model, frozen, env = {}, prompt = PROMPT, raw = null) {
  const command = fillTemplate(judge.command, { prompt, packet: frozen.staging, ...schemaVars(judge, { file: frozen.schema }), model });
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), { cwd: frozen.staging, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", ended = false;
    const end = (status) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      if (raw) {
        fs.mkdirSync(raw.dir, { recursive: true });
        fs.writeFileSync(path.join(raw.dir, `${raw.name}.run${raw.run}.stdout.json`), stdout);
        for (const file of ["prompt.md", "packet.json", "schema.json"]) if (raw.run === 1 && fs.existsSync(path.join(frozen.staging, file))) fs.copyFileSync(path.join(frozen.staging, file), path.join(raw.dir, `${raw.name}.${file}`));
      }
      resolve(status === 0 ? { answer: parseJudgeOutput(stdout) } : { error: `critic exited ${status}: ${String(stderr || stdout).slice(-300)}` });
    };
    const timer = setTimeout(() => { child.kill("SIGKILL"); end("timeout"); }, (judge.timeoutMinutes ?? 30) * 60 * 1000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => end(error.message));
    child.on("close", (code, signal) => end(code ?? signal));
  });
}

/** `tasks` - functions returning promises - run `limit` at a time, their results in the order given. */
async function pooled(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => { while (next < tasks.length) { const at = next; next += 1; results[at] = await tasks[at](); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
  return results;
}

/**
 * The answers a run kept (`--raw`), read back: for each of `anchors` whose
 * packet is in `directory`, the packet and every answer kept under its name,
 * parsed as the run parsed them. An anchor with no packet there was not run.
 */
function keptAnswers(directory, anchors) {
  const files = fs.readdirSync(directory);
  return anchors.map((anchor) => {
    const name = fileName(anchor.id), packet = readJson(path.join(directory, `${name}.packet.json`));
    const runs = files.filter((file) => file.startsWith(`${name}.run`) && file.endsWith(".stdout.json")).sort((a, b) => Number(a.slice(name.length + 4).split(".")[0]) - Number(b.slice(name.length + 4).split(".")[0]));
    return packet ? { anchor, packet, answers: runs.map((file) => parseJudgeOutput(fs.readFileSync(path.join(directory, file), "utf8")) ?? null) } : null;
  }).filter(Boolean);
}

const USAGE = "Usage: critic-calibration.mjs [--repeats n] [--parallel n] [--anchors a,b] [--anchor-dir dir] [--review-packet dir] [--raw dir | --from-raw dir] [--judge key] [--model m] [--config file] [--out file] [--dry-run] [--list]";

export async function main(argv, log = console.log) {
  const { values } = parseCli(argv, { repeats: { type: "string" }, anchors: { type: "string" }, judge: { type: "string" }, model: { type: "string" }, config: { type: "string" },
    out: { type: "string" }, "dry-run": { type: "boolean" }, list: { type: "boolean" }, "anchor-dir": { type: "string" }, "review-packet": { type: "string" }, parallel: { type: "string" }, raw: { type: "string" }, "from-raw": { type: "string" } }, { usage: USAGE, strict: true });
  let all;
  try { all = [...anchors(), ...fullSizeAnchors(), ...(values["anchor-dir"] ? externalAnchors(values["anchor-dir"]) : [])]; }
  catch (error) { console.error(error.message); return EXIT.error; }
  if (values.list) { for (const a of all) log(`${a.id.padEnd(34)} ${a.planted ? `plants: ${PLANTED[a.planted].about} (checks: ${PLANTED[a.planted].check.join(", ")})` : a.expect ? `expected ${a.expect}${a.about ? `: ${a.about}` : ""}` : a.fullSize ? `clean, full size, no expected verdict: ${a.about}` : "clean: the twin of its plants, no expected verdict (not an anchor for a rating)"}`); return EXIT.ok; }
  const repeats = Number(values.repeats ?? 3), parallel = Number(values.parallel ?? 1);
  if (!Number.isInteger(repeats) || repeats < 1) { console.error(`--repeats is a positive whole number\n${USAGE}`); return EXIT.error; }
  if (!Number.isInteger(parallel) || parallel < 1) { console.error(`--parallel is how many critic calls run at a time: a positive whole number\n${USAGE}`); return EXIT.error; }
  if (values.raw && values["from-raw"]) { console.error(`--raw keeps a run's answers and --from-raw scores the answers a run kept: one or the other\n${USAGE}`); return EXIT.error; }
  const chosen = values.anchors ? all.filter((a) => values.anchors.split(",").includes(a.id)) : all;
  if (!chosen.length) { console.error(`No anchor named ${values.anchors}; --list prints them`); return EXIT.error; }
  const config = readJson(path.resolve(values.config ?? path.join(QUALITY, "config.json")));
  const judgeKey = values.judge ?? config.defaults.judge, judge = config.judges[judgeKey];
  if (!judge) { console.error(`No judge "${judgeKey}" in the config`); return EXIT.error; }
  const model = values.model ?? judge.model ?? "";
  if (values["review-packet"]) return reviewRepeats(path.resolve(values["review-packet"]), { judge, judgeKey, model, repeats, dryRun: Boolean(values["dry-run"]), out: values.out }, log);
  const keep = values.raw ?? process.env.CRITIC_CALIBRATION_RAW ?? null;
  const said = (row) => log(`${row.id.padEnd(34)} valid ${row.valid}/${row.answers}  rating ${row.rating.mean ?? "-"} (sd ${row.rating.sd ?? "-"}, ${row.rating.min ?? "-"}-${row.rating.max ?? "-"})  ${JSON.stringify(row.verdicts)}${row.planted ? `  caught ${row.caught}` : ""}${row.expect ? `  expected ${row.expect}: agreed ${row.agreed}` : ""}`);
  const rows = [];
  if (values["from-raw"]) {
    // The answers of an earlier run, scored as this checkout scores them: nothing is called.
    const kept = keptAnswers(path.resolve(values["from-raw"]), chosen);
    if (!kept.length) { console.error(`${values["from-raw"]} holds no packet of ${values.anchors ? "the anchors named" : "any anchor"}: a run keeps them with --raw <dir>`); return EXIT.error; }
    for (const { anchor, packet, answers } of kept) { const row = summarizeAnchor(anchor, packet, answers); rows.push(row); said(row); }
  } else {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "critic-calibration-"));
    try {
      const frozen = [];
      for (const anchor of chosen) frozen.push({ anchor, frozen: await freeze(anchor, root) });
      if (values["dry-run"]) { for (const { anchor, frozen: f } of frozen) log(`${anchor.id}: ${repeats} x ${fillTemplate(judge.command, { prompt: "<prompt>", packet: f.staging, ...schemaVars(judge, { file: f.schema, shown: true }), model }).join(" ")}`); }
      else {
        // Every call of the run, `--parallel` at a time; each anchor's answers are read in the order of its repeats whichever returns first.
        const calls = frozen.flatMap(({ anchor, frozen: f }) => Array.from({ length: repeats }, (_, at) => async () => {
          const got = await ask(judge, model, f, { CRITIC_CALIBRATION_RUN: String(at + 1), CRITIC_CALIBRATION_ANCHOR: anchor.id }, PROMPT, keep ? { dir: path.resolve(keep), name: fileName(anchor.id), run: at + 1 } : null);
          if (got.error) log(`${anchor.id} run ${at + 1}: ${got.error}`);
          return got.answer ?? null;
        }));
        const answers = await pooled(calls, parallel);
        frozen.forEach(({ anchor, frozen: f }, at) => { const row = summarizeAnchor(anchor, f.packet, answers.slice(at * repeats, (at + 1) * repeats)); rows.push(row); said(row); });
      }
      for (const { frozen: f } of frozen) fs.rmSync(f.staging, { recursive: true, force: true });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
  if (values["dry-run"]) return EXIT.ok;
  const result = { schema: "professional-slides.critic-calibration/v2", skill: skillSha(), judge: judgeKey, model, repeats, ...(values["from-raw"] ? { scoredFrom: "the answers an earlier run kept" } : {}), anchors: rows, ...calibration(rows) };
  const out = path.resolve(values.out ?? path.join(QUALITY, "runs", "critic-calibration", `${result.skill.replace(/[^A-Za-z0-9._-]+/g, "_")}.json`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
  log(`\nnoise floor (median repeat spread): ${result.noiseFloor ?? "not measured"}\n${result.reading}`);
  for (const p of result.pairs) log(`  ${p.anchor.padEnd(34)} ${p.measured ? `${p.discriminated ? "told apart" : "NOT told apart"}: caught ${p.caught}; revise ${p.saidRevise}; the same check on the clean deck ${p.cleanFiled}  (rating: clean ${p.clean} planted ${p.planted} gap ${p.gap}, ${p.separated ? "separated" : p.ordered ? "ordered, inside the spread" : "not ordered"})` : "not measured: no valid answer on one side, or its clean twin was not run"}`);
  for (const a of result.anchored) log(`  ${a.anchor.padEnd(34)} expected ${a.expect}: agreed ${a.agreed ?? "not measured"}; rated ${a.rating ?? "-"}${a.human !== undefined ? ` against a recorded ${a.human}` : ""} (${a.pages} pages)`);
  if (result.anchored.length) log(`rating anchors: decks expected ready were rated ${result.ratingAnchors.ready.mean ?? "-"} (n ${result.ratingAnchors.ready.n}); decks expected revise ${result.ratingAnchors.revise.mean ?? "-"} (n ${result.ratingAnchors.revise.n})`);
  log(`primary - verdicts as expected: ${result.primary.verdict.met} of ${result.primary.verdict.of}; planted defects caught: ${result.primary.caught.met} of ${result.primary.caught.of}; the planted check quiet on the clean deck: ${result.primary.cleanQuiet.met} of ${result.primary.cleanQuiet.of}; planted and clean told apart: ${result.primary.discriminated.met} of ${result.primary.discriminated.of}`);
  if (result.cleanVerdict.decks) log(`clean fixture decks - verdict ${result.cleanVerdict.reading}; sent back by every answer: ${result.cleanVerdict.sentBack.join(", ") || "none"}`);
  log(`secondary - ratings separated from the clean deck by more than the spread: ${result.ratingSeparation.met} of ${result.ratingSeparation.of} (${result.ratingSeparation.ordered} ordered); this decides nothing`);
  // Form is reported beside the verdict, never inside it.
  log(`form: ${result.form.invalid} of ${result.form.answers} answers failed validation${result.form.rules.length ? ` - ${result.form.rules.slice(0, 4).map((r) => `${r.count} x ${r.rule}`).join("; ")}` : ""}`);
  const unread = result.unmeasured.length ? `${result.unmeasured.join(", ")}: no valid answer, or no clean twin` : "";
  log(`${result.verdict === "calibrated" ? "calibrated" : result.verdict === "not measured" ? `NOT MEASURED (${unread})` : `NOT calibrated - ${result.why.join("; ") || "nothing was measured"}${unread ? ` (and not measured - ${unread})` : ""}`}, on the ${result.form.valid} valid answers; written to ${out}`);
  return result.calibrated ? EXIT.ok : EXIT.refused;
}

/** `--review-packet`: one staged deck-review packet answered `repeats` times (summarizeReview). */
async function reviewRepeats(staging, { judge, judgeKey, model, repeats, dryRun, out: outFile }, log) {
  const packet = readJson(path.join(staging, "packet.json"));
  if (!packet || packet.kind !== "review") { console.error(`${staging} holds no first-pass deck-review packet: stage one with deliver-deck.mjs --reviewer packet (exit 3) and pass the directory its note names`); return EXIT.error; }
  const frozen = { staging, schema: path.join(staging, "schema.json") };
  if (dryRun) { log(`deck review, ${packet.slides.length} pages: ${repeats} x ${fillTemplate(judge.command, { prompt: "<prompt>", packet: staging, ...schemaVars(judge, { file: frozen.schema, shown: true }), model }).join(" ")}`); return EXIT.ok; }
  const answers = [];
  for (let run = 1; run <= repeats; run += 1) {
    const got = await ask(judge, model, frozen, { CRITIC_CALIBRATION_RUN: String(run) }, REVIEW_PROMPT);
    if (got.error) log(`run ${run}: ${got.error}`);
    answers.push(got.answer ?? null);
  }
  const result = { schema: "professional-slides.critic-calibration/v1", skill: skillSha(), judge: judgeKey, model, repeats, review: summarizeReview(packet, answers) };
  const out = path.resolve(outFile ?? path.join(QUALITY, "runs", "critic-calibration", `${result.skill.replace(/[^A-Za-z0-9._-]+/g, "_")}.review.json`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
  const r = result.review;
  log(`deck review, ${r.pages} pages: valid ${r.valid}/${r.answers}; rating ${r.rating.mean ?? "-"} (sd ${r.rating.sd ?? "-"}); accepted ${r.accepted}/${r.valid}; findings ${r.findings.mean ?? "-"} (sd ${r.findings.sd ?? "-"}); blocking findings the storyline critic could have decided: ${r.atSpine.mean ?? "-"} (sd ${r.atSpine.sd ?? "-"}); written to ${out}`);
  return r.valid > 0 ? EXIT.ok : EXIT.refused;
}

if (isMain(import.meta.url)) runCli(main);
