// Model review behind an interface. One prompt, one schema, a visual vocabulary that
// is allowed to block, and a `repair` that has to be a sentence. Backends:
//   codex   — `codex exec --image … --output-schema`  (OpenAI Codex CLI)
//   claude  — `claude -p … --output-format json`       (Claude Code CLI; reads the PNGs itself)
//   packet  — no model call: writes review-packet/ for the calling agent to review and
//             answer with `deliver-deck.mjs … --review review.json`. This is the default
//             inside an agent session, where the agent *is* the reviewer.
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runProcess } from "./process.mjs";

export const SEVERITIES = ["none", "minor", "major", "blocker"];
export const CODES = Object.freeze({
  // facts and evidence
  FACTUAL_ERROR: "a stated number, name or date is wrong",
  UNSUPPORTED_CLAIM: "a claim the cited evidence does not support",
  MISLEADING_COMPARISON: "values compared across incompatible bases without saying so",
  MISSING_EVIDENCE: "a ranked criterion or stated requirement has no comparative evidence",
  MISSING_ARGUMENT: "the page's purpose or necessary inference is unclear from its title, evidence and commentary together",
  // legibility and geometry
  UNREADABLE: "text too small, clipped or low-contrast to read",
  OVERFLOW: "content exceeds its box or the slide",
  BROKEN_GEOMETRY: "misaligned, overlapping or orphaned elements",
  // design — these block too
  DEAD_SPACE: "a large empty band the page does nothing with",
  LAYOUT_MONOTONY: "the same page construction repeated across most of the deck",
  NO_HERO_EXHIBIT: "an analytical page with no dominant exhibit",
  OVERSIZED_TYPE: "body or chart type set larger than a reader expects on a slide",
  WALL_OF_TEXT: "prose doing the work an exhibit should do",
  BURIED_NUMBER: "a decisive number in a sentence instead of on a mark",
  HEDGED_TITLE: "an action title that does not commit to a finding",
  TITLE_TOO_LONG: "an action title over two lines",
  INCONSISTENT_ENCODING: "the same measure encoded differently across pages",
  EDITORIAL: "a wording preference"
});
const BLOCKING = new Set(Object.keys(CODES).filter((c) => c !== "EDITORIAL"));

export const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["accepted", "summary", "findings"],
  properties: {
    accepted: { type: "boolean" },
    summary: { type: "string", minLength: 20 },
    findings: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["slide", "code", "severity", "reason", "repair"],
        properties: {
          slide: { type: ["string", "null"] },
          code: { type: "string", enum: Object.keys(CODES) },
          severity: { type: "string", enum: SEVERITIES },
          reason: { type: "string", minLength: 20 },
          repair: { type: "string" }
        }
      }
    }
  }
};

export function validateReview(review, slideIds) {
  const errors = [];
  if (!review || typeof review !== "object") return ["review is not an object"];
  if (typeof review.accepted !== "boolean") errors.push("accepted must be boolean");
  if (typeof review.summary !== "string" || review.summary.trim().length < 20) errors.push("summary must be a sentence");
  if (!Array.isArray(review.findings)) return [...errors, "findings must be an array"];
  const known = new Set(slideIds);
  for (const [i, f] of review.findings.entries()) {
    const at = `findings[${i}]`;
    if (f.slide !== null && !known.has(f.slide)) errors.push(`${at}: unknown slide ${f.slide}`);
    if (!CODES[f.code]) errors.push(`${at}: unknown code ${f.code}`);
    if (!SEVERITIES.includes(f.severity)) errors.push(`${at}: unknown severity ${f.severity}`);
    if (["major", "blocker"].includes(f.severity)) {
      if (!BLOCKING.has(f.code)) errors.push(`${at}: ${f.code} cannot be ${f.severity}`);
      if (typeof f.repair !== "string" || f.repair.trim().length < 40 || !/\b(add|replace|move|merge|cut|rewrite|split|show|plot|label|reduce|enlarge|use|drop|state|cite)\b/i.test(f.repair)) errors.push(`${at}: a ${f.severity} finding needs a concrete repair sentence`);
    }
  }
  const blocking = review.findings.some((f) => ["major", "blocker"].includes(f.severity));
  if (review.accepted && blocking) errors.push("accepted cannot be true with major or blocker findings");
  return errors;
}

export function reviewOutcome(review) {
  const blocking = (review.findings || []).filter((f) => ["major", "blocker"].includes(f.severity));
  return { accepted: review.accepted === true && blocking.length === 0, blocking };
}

function textOf(slide) {
  return slide.nodes.filter((n) => n.type === "text" && !["page-number", "source-text"].includes(n.role)).map((n) => ({ role: n.role, text: (n.data?.textLayout?.source ?? n.text) }));
}

export async function buildReviewPacket({ outputDirectory, brief = "", answer = "" }) {
  const dir = path.resolve(outputDirectory);
  const scene = JSON.parse(await fs.readFile(path.join(dir, "scene.json"), "utf8"));
  const gates = await fs.readFile(path.join(dir, "gates.json"), "utf8").then(JSON.parse).catch(() => ({ findings: [] }));
  const packetDir = path.join(dir, "review-packet");
  await fs.mkdir(packetDir, { recursive: true });
  const slides = scene.slides.map((s, i) => ({
    id: s.id, index: i + 1,
    title: s.nodes.find((n) => n.role === "action-title" || n.role === "cover-title")?.text?.replace(/\n/g, " ") ?? "",
    text: textOf(s),
    exhibits: (s.componentInstances || []).filter((c) => /^(chart\.|table|image-frame|metric)/.test(c.component)).map((c) => ({ component: c.component, frame: c.frame })),
    gateFindings: (gates.findings || []).filter((f) => f.slide === s.id || f.slide === i + 1),
    image: path.join(dir, "rendered", `slide-${i + 1}.png`)
  }));
  const packet = { brief, answer, montage: path.join(dir, "rendered", "montage.png"), titles: slides.map((s) => `${s.index}. ${s.title}`), slides, codes: CODES, schema: REVIEW_SCHEMA };
  await fs.writeFile(path.join(packetDir, "packet.json"), JSON.stringify(packet, null, 2));
  await fs.writeFile(path.join(packetDir, "schema.json"), JSON.stringify(REVIEW_SCHEMA, null, 2));
  await fs.writeFile(path.join(packetDir, "prompt.md"), reviewPrompt(packet));
  return { packetDir, packet };
}

export function reviewPrompt(packet) {
  return `You are reviewing a consulting deck against the client's brief. Look at every rendered slide image and the montage; read the text. Judge it the way an engagement manager would the night before a steering committee.

BRIEF: ${packet.brief || "(not supplied)"}
GOVERNING ANSWER: ${packet.answer || "(not supplied)"}

TITLES ALONE (read as a memo — does the argument flow?):
${packet.titles.join("\n")}

For each slide, decide whether a reader gets the finding from the title and can verify it from the exhibit. A separate soWhat or closing strip is optional: the title and exhibit may already complete the argument. Two distinct insights can share a page when each is supported and clearly placed. Flag redundant propositions or competing summary boxes, not the absence of a footer conclusion or the mere presence of multiple insights. Report findings with these codes only:
${Object.entries(packet.codes).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Severity: blocker (must fix before any reader sees it), major (fix before delivery), minor (advisory), none. Design codes (DEAD_SPACE, LAYOUT_MONOTONY, NO_HERO_EXHIBIT, OVERSIZED_TYPE, WALL_OF_TEXT, BURIED_NUMBER, HEDGED_TITLE, TITLE_TOO_LONG, INCONSISTENT_ENCODING) may be major. A large empty band, one layout repeated across most pages, and prose where an exhibit belongs are defects, not preferences. Every major or blocker finding needs a repair sentence saying exactly what to add, replace, move, merge, cut, plot or rewrite.

Deterministic gate findings already computed (confirm, refine or explain why they do not matter):
${packet.slides.flatMap((s) => s.gateFindings.map((f) => `- slide ${s.index} ${f.code}: ${f.measured ?? ""} (threshold ${f.threshold ?? ""})`)).join("\n") || "- none"}

Slide images: ${packet.slides.map((s) => s.image).join(", ")}
Montage: ${packet.montage}

Return ONLY JSON matching this schema: ${JSON.stringify(packet.schema)}
Set accepted=false if any finding is major or blocker. The summary is two sentences: what the deck does well and what must change.`;
}

function hasCli(name) { return spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" }).status === 0; }

export function detectBackend(preferred = "auto") {
  if (preferred !== "auto") return preferred;
  if (process.env.PS_REVIEWER) return process.env.PS_REVIEWER;
  if (hasCli("codex")) return "codex";
  if (hasCli("claude")) return "claude";
  return "packet";
}

export async function runReview({ outputDirectory, brief, answer, backend = "auto", model, timeoutMs = 600000 }) {
  const { packetDir, packet } = await buildReviewPacket({ outputDirectory, brief, answer });
  const which = detectBackend(backend);
  const prompt = await fs.readFile(path.join(packetDir, "prompt.md"), "utf8");
  const reviewPath = path.join(path.resolve(outputDirectory), "review.json");
  let raw;
  if (which === "packet") {
    return { backend: "packet", status: "packet-written", packetDir, reviewPath, note: `Review the packet at ${packetDir} (prompt.md + images) and write ${reviewPath}, then rerun deliver-deck with --review ${reviewPath}` };
  }
  if (which === "codex") {
    const out = path.join(packetDir, "codex-last-message.json");
    const args = ["exec", ...(model ? ["--model", model] : []), "--sandbox", "read-only", "--ephemeral", "--output-schema", path.join(packetDir, "schema.json"), "--output-last-message", out, ...packet.slides.flatMap((s) => ["--image", s.image]), "--image", packet.montage, "-"];
    await runProcess("codex", args, { input: prompt, timeoutMs });
    raw = await fs.readFile(out, "utf8");
  } else if (which === "claude") {
    const res = await runProcess("claude", ["-p", "--output-format", "json", "--allowedTools", "Read", ...(model ? ["--model", model] : [])], { input: prompt, timeoutMs });
    const envelope = JSON.parse(res.stdout);
    raw = typeof envelope.result === "string" ? envelope.result : JSON.stringify(envelope.result ?? envelope);
  } else throw new Error(`Unknown reviewer backend: ${which}`);
  const match = String(raw).match(/\{[\s\S]*\}/);
  const review = JSON.parse(match ? match[0] : raw);
  review.backend = which; review.model = model || null;
  await fs.writeFile(reviewPath, JSON.stringify(review, null, 2) + "\n");
  return { backend: which, status: "reviewed", reviewPath, review };
}
