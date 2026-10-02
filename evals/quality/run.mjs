#!/usr/bin/env node
/**
 * The repeatable end-to-end quality eval.
 *
 *   node evals/quality/run.mjs --set dev|heldout|all [--runs 3] [--agent claude] [--judge claude] [--dry-run]
 *
 * For every brief in the set and every run: an empty workspace, a headless
 * agent given the brief and nothing else, the deck it leaves behind collected
 * and kept, a blind judge shown only the brief, the rubric and the rendered
 * pages, a pairwise judgement against the previous skill version's deck for the
 * same brief, and the build bars and plan gates on what was built. One line per
 * judged deck goes to results.jsonl, keyed by skill version, judge model, brief
 * and run; the report is the mean and spread per brief and the pairwise win rate.
 *
 * Options
 *   --set NAME            dev (the cold-run briefs), heldout, or all
 *   --brief ID            only this brief (repeatable), e.g. dev/network-rollout
 *   --runs N              agent runs per brief (default 3)
 *   --agent NAME          an entry of config.agents
 *   --judge NAME          an entry of config.judges
 *   --judge-model MODEL   override the judge's configured model
 *   --prompt NAME         an entry of config.prompts (default: the brief alone)
 *   --dry-run             print what would run; run and write nothing
 *   --report              print the summary for this skill version and judge, and stop
 *   --no-pairwise         skip the comparison with the previous version
 *   --no-anchors          skip judge calibration on scored anchors
 *   --keep-workspace      leave each agent workspace in place
 *   --config FILE         default evals/quality/config.json
 *   --results FILE        default evals/quality/results.jsonl
 *   --store DIR           where decks are kept for later comparison (default evals/quality/runs);
 *                         results.jsonl records each deck relative to it
 *   --anchors-file FILE   default evals/quality/anchors/anchors.json
 *   --skill-sha VALUE     label the version under test instead of reading it from git
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  QUALITY, ROOT, RESULT_SCHEMA, anchorError, appendResult, briefRequest, briefs, buildAnchorPacket, buildDeckPacket,
  buildPairPacket, collectArtifacts, deckPages, fillTemplate, formatSummary, nextRun, pairSwap, parseJudgeOutput,
  previousDeck, readResults, skillSha as readSkillSha, storeArtifacts, summarize, validatePreference, validateVerdict,
} from "./lib.mjs";
import { scoreRun } from "../cold-run/score.mjs";
import { isMain, pythonBin } from "../../skills/professional-slides/runtime/cli.mjs";

const USAGE = "Usage: run.mjs --set dev|heldout|all [--runs N] [--agent NAME] [--judge NAME] [--dry-run] (see the header for every option)";
const VALUE_FLAGS = new Set(["--set", "--brief", "--runs", "--agent", "--judge", "--judge-model", "--prompt", "--config",
  "--results", "--store", "--anchors-file", "--skill-sha"]);
const SWITCHES = new Set(["--dry-run", "--report", "--no-pairwise", "--no-anchors", "--keep-workspace", "--help"]);

export function parseArgs(argv) {
  const options = { brief: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value. ${USAGE}`);
      const key = arg.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
      if (key === "brief") options.brief.push(value); else options[key] = value;
      i += 1;
    } else if (SWITCHES.has(arg)) {
      options[arg.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = true;
    } else {
      throw new Error(`Unknown argument ${arg}. ${USAGE}`);
    }
  }
  options.runs = options.runs === undefined ? 3 : Number(options.runs);
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error(`--runs must be a positive whole number. ${USAGE}`);
  return options;
}

const relative = (file) => (path.resolve(file).startsWith(ROOT + path.sep) ? path.relative(ROOT, file) : path.resolve(file));
const safe = (text) => String(text).replace(/[^A-Za-z0-9._-]+/g, "_");
const shorten = (text, n = 72) => (text.length > n ? `${text.slice(0, n - 1)}…` : text).replace(/\n/g, "\\n");

function run(command, { cwd, timeoutMinutes = 60, env = {} }) {
  const started = Date.now();
  const result = spawnSync(command[0], command.slice(1), {
    cwd, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 512 * 1024 * 1024,
    timeout: timeoutMinutes * 60 * 1000,
  });
  return {
    code: result.status, signal: result.signal, error: result.error?.message ?? null,
    stdout: result.stdout ?? "", stderr: result.stderr ?? "", seconds: Math.round((Date.now() - started) / 100) / 10,
  };
}

function packagePlugin(sha) {
  const destination = path.join(os.tmpdir(), `ps-quality-plugin-${safe(sha)}`);
  const python = pythonBin();
  if (existsSync(destination) && !existsSync(path.join(destination, "package-manifest.json"))) rmSync(destination, { recursive: true, force: true });
  const out = run([python, path.join(ROOT, "evals", "scripts", "package_plugin.py"), "--output", destination], { cwd: ROOT, timeoutMinutes: 5 });
  if (out.code !== 0) throw new Error(`packaging the plugin failed: ${out.stderr || out.error}`);
  return destination;
}

function readJson(file) {
  if (!file || !existsSync(file)) return null;
  const raw = readFileSync(file);
  return JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8"));
}

/** The build bars and plan gates on what the run built, via the cold-run scorer. */
function scoreStored(dir, kept) {
  const plan = kept.plan ? readJson(path.join(dir, kept.plan)) : null;
  const scene = kept.scene ? readJson(path.join(dir, kept.scene)) : null;
  if (!plan && !scene) return { plan: null, build: null, slides: null };
  const scored = scoreRun({ plan, scene });
  return {
    slides: scene?.slides?.length ?? null,
    plan: scored.plan && { accepted: scored.plan.accepted, countsByCode: scored.plan.countsByCode },
    build: scored.build && { accepted: scored.build.accepted, findings: scored.build.findings.map((f) => ({ measure: f.measure, measured: f.measured })) },
  };
}

function judgeCall(judge, packet, model) {
  const command = fillTemplate(judge.command, { prompt: packet.prompt, packet: packet.dir, schema: packet.schema, model });
  const out = run(command, { cwd: packet.dir, timeoutMinutes: judge.timeoutMinutes ?? 30 });
  if (out.code !== 0) throw new Error(`judge exited ${out.code ?? out.signal ?? out.error}: ${(out.stderr || out.stdout).slice(-600)}`);
  return parseJudgeOutput(out.stdout);
}

function loadAnchors(file) {
  if (!existsSync(file)) return { anchors: [], dir: path.dirname(file) };
  const doc = JSON.parse(readFileSync(file, "utf8"));
  return { anchors: doc.anchors ?? [], dir: path.dirname(file) };
}

function calibrate({ judge, judgeKey, model, anchorsFile, resultsFile, dryRun, log }) {
  const { anchors, dir } = loadAnchors(anchorsFile);
  const scored = anchors.filter((a) => typeof a.humanScore === "number");
  if (!scored.length) {
    log(`anchors: 0 of ${anchors.length} carry a human score; judge error not computed`);
    return null;
  }
  if (dryRun) {
    log(`anchors: would score ${scored.length} of ${anchors.length} anchors with ${judgeKey}`);
    return null;
  }
  const results = [];
  for (const anchor of scored) {
    const image = path.join(dir, anchor.image);
    const sha = createHash("sha256").update(readFileSync(image)).digest("hex");
    if (anchor.sha256 && sha !== anchor.sha256) throw new Error(`anchor ${anchor.id}: image bytes differ from the scored image`);
    const packetDir = mkdtempSync(path.join(os.tmpdir(), "ps-quality-anchor-"));
    try {
      const verdict = judgeCall(judge, buildAnchorPacket(packetDir, { image }), model);
      const judgeScore = typeof verdict?.rating === "number" ? verdict.rating : null;
      results.push({ id: anchor.id, tier: anchor.tier, humanScore: anchor.humanScore, judgeScore });
    } catch (error) {
      results.push({ id: anchor.id, tier: anchor.tier, humanScore: anchor.humanScore, judgeScore: null, error: error.message });
    } finally {
      rmSync(packetDir, { recursive: true, force: true });
    }
  }
  const mae = anchorError(results);
  const row = { schema: RESULT_SCHEMA, kind: "anchors", recorded: new Date().toISOString(), judge: judgeKey,
                anchors: results, n: results.filter((r) => r.judgeScore !== null).length, meanAbsoluteError: mae };
  appendResult(resultsFile, row);
  log(`anchors: judge ${judgeKey} mean absolute error ${mae ?? "n/a"} over ${row.n} scored anchors`);
  return row;
}

export async function main(argv = process.argv.slice(2), log = console.log) {
  const options = parseArgs(argv);
  if (options.help) { log(USAGE); return 0; }
  const config = JSON.parse(readFileSync(options.config ?? path.join(QUALITY, "config.json"), "utf8"));
  const resultsFile = path.resolve(options.results ?? path.join(QUALITY, "results.jsonl"));
  const store = path.resolve(options.store ?? path.join(QUALITY, "runs"));
  const anchorsFile = path.resolve(options.anchorsFile ?? path.join(QUALITY, "anchors", "anchors.json"));
  const agentName = options.agent ?? config.defaults?.agent;
  const judgeName = options.judge ?? config.defaults?.judge;
  const promptName = options.prompt ?? config.defaults?.prompt ?? "brief";
  const agent = config.agents?.[agentName];
  const judge = config.judges?.[judgeName];
  const promptTemplate = config.prompts?.[promptName];
  if (!agent) throw new Error(`No agent "${agentName}" in the config (${Object.keys(config.agents ?? {}).join(", ")})`);
  if (!judge) throw new Error(`No judge "${judgeName}" in the config (${Object.keys(config.judges ?? {}).join(", ")})`);
  if (promptTemplate === undefined) throw new Error(`No prompt "${promptName}" in the config`);
  for (const [kind, entry] of [["agent", agent], ["judge", judge]]) if (entry.unverified) log(`warning: ${kind} command is unverified - ${entry.unverified}`);
  const model = options.judgeModel ?? judge.model ?? "default";
  const judgeKey = `${judgeName}:${model}`;
  const sha = options.skillSha ?? readSkillSha();
  const rows = readResults(resultsFile);

  if (options.report) {
    log(formatSummary(summarize(rows, { skillSha: sha, judge: judgeKey })));
    return 0;
  }
  if (!options.set && !options.brief.length) throw new Error(`--set is required. ${USAGE}`);
  let chosen = briefs(options.set ?? "all");
  if (options.brief.length) {
    chosen = chosen.filter((b) => options.brief.includes(b.id));
    const unknown = options.brief.filter((id) => !chosen.some((b) => b.id === id));
    if (unknown.length) throw new Error(`Unknown brief ${unknown.join(", ")}`);
  }

  log(`skill ${sha} · agent ${agentName} (${promptName}) · judge ${judgeKey} · ${chosen.length} briefs x ${options.runs} runs${options.dryRun ? " · dry run" : ""}`);
  const needsPlugin = agent.command.some((arg) => String(arg).includes("{plugin}"));
  const plugin = needsPlugin ? (options.dryRun ? "<packaged plugin>" : packagePlugin(sha)) : null;

  for (const brief of chosen) {
    const request = briefRequest(brief.text);
    const prompt = promptTemplate.replace("{brief}", request.trim());
    const first = nextRun(rows, { skillSha: sha, brief: brief.id, agent: agentName, prompt: promptName });
    for (let runNumber = first; runNumber < first + options.runs; runNumber += 1) {
      const key = { skillSha: sha, judge: judgeKey, brief: brief.id, run: runNumber };
      const keep = path.join(store, safe(sha), safe(brief.id), `${safe(agentName)}-${safe(promptName)}-run${runNumber}`);
      if (options.dryRun) {
        log(`\n${brief.id} run ${runNumber}`);
        log(`  agent  ${fillTemplate(agent.command, { prompt: shorten(prompt), workspace: "<workspace>", plugin }).join(" ")}`);
        log(`  keep   ${relative(keep)}`);
        log(`  judge  ${fillTemplate(judge.command, { prompt: "<deck prompt>", packet: "<packet>", schema: "<judge-schema.json>", model }).join(" ")}`);
        const previous = options.noPairwise ? null : previousDeck(rows, { skillSha: sha, brief: brief.id, agent: agentName, prompt: promptName }, store);
        log(`  pair   ${previous ? `against ${previous.skillSha} run ${previous.run}` : "no previous version stored"}`);
        continue;
      }

      const workspace = mkdtempSync(path.join(os.tmpdir(), "ps-quality-run-"));
      const row = { schema: RESULT_SCHEMA, key, recorded: new Date().toISOString(), set: brief.set, agent: agentName, prompt: promptName };
      try {
        const agentOut = run(fillTemplate(agent.command, { prompt, workspace, plugin: plugin ?? "" }), {
          cwd: workspace, timeoutMinutes: agent.timeoutMinutes ?? 120,
          // Stored design preferences would make runs depend on who ran them.
          env: { PROFESSIONAL_SLIDES_HOME: path.join(workspace, ".professional-slides-home") },
        });
        mkdirSync(keep, { recursive: true });
        writeFileSync(path.join(keep, "agent.stdout.txt"), agentOut.stdout);
        writeFileSync(path.join(keep, "agent.stderr.txt"), agentOut.stderr);
        row.agentRun = { exit: agentOut.code, seconds: agentOut.seconds, ...(agentOut.error ? { error: agentOut.error } : {}) };
        const artifacts = collectArtifacts(workspace);
        const kept = storeArtifacts(artifacts, keep);
        const pages = deckPages(keep);
        // Delivery takes a confirmation read after an accepted review; a deck
        // left waiting for it (or for a review packet) is judged, and recorded
        // as not delivered with the stage it stopped at.
        const delivery = kept.delivery ? readJson(path.join(keep, kept.delivery)) : null;
        row.deck = {
          artifacts: path.relative(store, keep), pages: pages.length,
          delivered: delivery ? delivery.accepted === true : null,
          ...(delivery?.stage ? { deliveryStage: delivery.stage } : {}),
        };
        Object.assign(row, (({ plan, build, slides }) => ({ plan, build, deckSlides: slides }))(scoreStored(keep, kept)));
        if (!pages.length) {
          row.status = agentOut.code === 0 ? "no-deck" : "agent-failed";
        } else {
          const packetDir = mkdtempSync(path.join(os.tmpdir(), "ps-quality-judge-"));
          try {
            row.judge = validateVerdict(judgeCall(judge, buildDeckPacket(packetDir, { briefText: brief.text, pages }), model));
            row.status = "judged";
          } catch (error) {
            row.status = "judge-failed";
            row.error = error.message;
          } finally {
            rmSync(packetDir, { recursive: true, force: true });
          }
          const previous = options.noPairwise ? null : previousDeck(rows, { skillSha: sha, brief: brief.id, agent: agentName, prompt: promptName }, store);
          if (!previous) {
            row.pairwise = { skipped: options.noPairwise ? "--no-pairwise" : "no previous version stored for this brief" };
          } else {
            const pairDir = mkdtempSync(path.join(os.tmpdir(), "ps-quality-pair-"));
            try {
              const packet = buildPairPacket(pairDir, { briefText: brief.text, current: pages, previous: deckPages(previous.dir),
                                                        swap: pairSwap(`${sha}|${previous.skillSha}|${brief.id}|${runNumber}`) });
              row.pairwise = { against: previous.skillSha, againstRun: previous.run,
                               ...validatePreference(judgeCall(judge, packet, model), packet.order) };
            } catch (error) {
              row.pairwise = { against: previous.skillSha, againstRun: previous.run, error: error.message };
            } finally {
              rmSync(pairDir, { recursive: true, force: true });
            }
          }
        }
      } finally {
        if (!options.keepWorkspace) rmSync(workspace, { recursive: true, force: true });
        else log(`workspace kept: ${workspace}`);
      }
      appendResult(resultsFile, row, rows);
      rows.push(row);
      const rating = row.judge ? `rating ${row.judge.rating}` : row.status;
      const pair = row.pairwise?.preferred ? `, preferred ${row.pairwise.preferred} over ${row.pairwise.against.slice(0, 12)}` : "";
      log(`${brief.id} run ${runNumber}: ${rating}${pair}; build ${row.build ? (row.build.accepted ? "pass" : "FAIL") : "-"}, plan ${row.plan ? (row.plan.accepted ? "pass" : "FAIL") : "-"}`);
    }
  }

  if (!options.noAnchors) calibrate({ judge, judgeKey, model, anchorsFile, resultsFile, dryRun: options.dryRun, log });
  if (!options.dryRun) log(`\n${formatSummary(summarize(rows, { skillSha: sha, judge: judgeKey }))}`);
  return 0;
}

if (isMain(import.meta.url)) {
  main().then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(1); });
}
