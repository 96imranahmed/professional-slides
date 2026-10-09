// The plumbing every runtime CLI shares: whether a module is the process's
// entry point, how its command line is read, how it ends, which Python it runs
// and how it reads and writes JSON.
//
//   if (isMain(import.meta.url)) runCli(async (argv) => { ...; return EXIT.ok; });
//
// A command line is read with util.parseArgs: an option missing its value, or
// a value that is itself an option (`--reason --user-approved`), is a usage
// error, never a value swallowed.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { EXIT, UsageError, isRefusal } from "./errors.mjs";

export { EXIT, UsageError };

/** Whether the module at `url` (its `import.meta.url`) is the script node was started with. */
export function isMain(url) {
  const entry = process.argv[1];
  if (!entry) return false;
  const self = fileURLToPath(url);
  if (path.resolve(entry) === self) return true;
  // Started through a symlink: node runs the real file.
  try { return fs.realpathSync(entry) === fs.realpathSync(self); } catch { return false; }
}

/**
 * `argv` read against `options` (util.parseArgs's option table):
 * `{ values, positionals }`. A string option with no value, or whose value
 * is itself an option, and a boolean option given a value, are UsageErrors
 * whose message ends with `usage`. An option the table does not name is
 * ignored, unless `strict`. A string option declared with `bare` takes that
 * value when given without one (`--run` last, or before another option, is
 * `--run=<bare>`); `valueName` names its value in the message
 * (`--python requires an executable`).
 */
export function parseCli(argv, options = {}, { usage, strict = false } = {}) {
  const table = {}, declared = new Map();
  for (const [name, { bare, valueName, ...option }] of Object.entries(options)) {
    table[name] = option;
    declared.set(name, { ...option, bare, valueName: valueName ?? "a value" });
  }
  const refuse = (message) => { throw new UsageError(usage ? `${message}\n${usage}` : message); };
  const optionLike = (arg) => /^-./.test(arg);
  const args = argv.map((arg, i) => {
    const option = arg.startsWith("--") ? declared.get(arg.slice(2)) : null;
    return option?.bare !== undefined && (i + 1 >= argv.length || optionLike(argv[i + 1])) ? `${arg}=${option.bare}` : arg;
  });
  const { values, positionals, tokens } = parseArgs({ args, options: table, allowPositionals: true, strict: false, tokens: true });
  for (const token of tokens.filter((t) => t.kind === "option")) {
    const option = declared.get(token.name);
    if (!option) { if (strict) refuse(`Unknown option ${token.rawName}`); continue; }
    if (option.type === "string" && token.value === undefined) refuse(`${token.rawName} requires ${option.valueName}`);
    if (option.type === "string" && !token.inlineValue && optionLike(token.value)) refuse(`${token.rawName} requires ${option.valueName}, not the option ${token.value}`);
    if (option.type === "boolean" && token.value !== undefined) refuse(`${token.rawName} takes no value`);
  }
  // Only declared options are returned: an ignored one is not a value.
  for (const name of Object.keys(values)) if (!declared.has(name)) delete values[name];
  return { values, positionals };
}

// Resolves once everything written to `stream` so far is flushed: output to a
// pipe is asynchronous on macOS, and process.exit() would cut it short.
const drained = (stream) => new Promise((resolve) => stream.write("", resolve));

/**
 * Runs `main(argv)` as the process and exits with the code it returns
 * (EXIT.ok when it returns nothing). A refusal prints `Refused (CODE): message`
 * and exits EXIT.refused; a usage error prints its message and exits
 * EXIT.error; anything else is a crash, printed with its stack, EXIT.error.
 */
export async function runCli(main, argv = process.argv.slice(2)) {
  let code;
  try {
    code = (await main(argv)) ?? EXIT.ok;
  } catch (error) {
    if (isRefusal(error)) {
      console.error(`Refused${error.code ? ` (${error.code})` : ""}: ${error.message}`);
      code = EXIT.refused;
    } else if (error instanceof UsageError) {
      console.error(error.message);
      code = EXIT.error;
    } else {
      console.error(error?.stack || error?.message || String(error));
      code = EXIT.error;
    }
  }
  await Promise.all([drained(process.stdout), drained(process.stderr)]);
  process.exit(code);
}

/** The Python the runtime runs its emitter and gates under: RUNTIME_PYTHON, else `python3` on PATH. */
export const pythonBin = (env = process.env) => env.RUNTIME_PYTHON || "python3";

// JSON as the runtime writes it: two-space indent, a trailing newline.
const formatJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

function parseJson(text, file) {
  try { return JSON.parse(text); } catch (error) { throw new SyntaxError(`${file}: ${error.message}`); }
}
const missing = (error) => error?.code === "ENOENT";

/**
 * The JSON at `file`. A missing file is an error, or `null` when `optional`;
 * a file that is there but does not parse is always an error, naming the file.
 */
export async function readJson(file, { optional = false } = {}) {
  let text;
  try { text = await fsp.readFile(file, "utf8"); } catch (error) { if (optional && missing(error)) return null; throw error; }
  return parseJson(text, file);
}

/**
 * The agent CLI this process runs inside, when it runs inside one: "claude"
 * under Claude Code (the CLI or the desktop app), "codex" under Codex, else
 * null. The reviews, the storyline critique and the copy judgements run
 * through that CLI (doctor.mjs checks it is installed and signed in).
 */
export function hostCli(env = process.env) {
  if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT) return "claude";
  if (env.CODEX_SANDBOX || env.CODEX_SANDBOX_NETWORK_DISABLED || env.CODEX_THREAD_ID || env.CODEX_MANAGED_BY_NPM) return "codex";
  return null;
}

/** readJson, synchronously. */
export function readJsonSync(file, { optional = false } = {}) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch (error) { if (optional && missing(error)) return null; throw error; }
  return parseJson(text, file);
}

/** Writes `value` to `file` as JSON (two-space indent, trailing newline); `options` are fs.writeFile's. */
export const writeJson = (file, value, options) => fsp.writeFile(file, formatJson(value), options);

/** writeJson, synchronously. */
export const writeJsonSync = (file, value) => fs.writeFileSync(file, formatJson(value));
