/**
 * Persistent probe worker for the eval suite.
 *
 * Spawning `node --eval` per probe costs ~105ms of process startup plus a fresh
 * import of the whole runtime. This worker is started once, keeps the runtime
 * modules warm in its module cache, and answers probes over a line-delimited
 * JSON protocol on stdin/stdout:
 *
 *   in   {"id": 1, "src": "...", "env": {"set": {...}, "unset": [...]}}
 *   out  {"id": 1, "ok": true, "out": ["...console.log lines..."]}
 *        {"id": 1, "ok": false, "err": "...stack...", "out": [...]}
 *
 * The source is evaluated as a data: module, so it cannot resolve relative
 * specifiers - node_probe.py rewrites those to absolute file:// URLs before
 * sending. The worker runs with cwd=ROOT so probes that spawn child processes
 * with repo-relative paths keep working.
 *
 * Two things a one-process-per-probe run got for free have to be done by hand:
 * the probe id is appended to the source so two byte-identical probes get
 * distinct data: URLs (otherwise the second one is an ESM cache hit and never
 * runs), and process.env is re-synced per probe because tests hand large
 * fixtures to probes through environment variables set after the worker began.
 */

import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });

for await (const line of rl) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  let id = null;
  let src = null;
  let env = null;
  try {
    ({ id, src, env } = JSON.parse(trimmed));
  } catch {
    continue;
  }

  if (env) {
    for (const key of env.unset || []) delete process.env[key];
    for (const [key, value] of Object.entries(env.set || {})) process.env[key] = value;
  }

  const out = [];
  const errOut = [];
  const log = console.log;
  const logError = console.error;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => errOut.push(a.join(' '));

  let reply;
  try {
    const unique = src + '\n//probe:' + id + '\n';
    await import('data:text/javascript;base64,' + Buffer.from(unique).toString('base64'));
    reply = { id, ok: true, out };
  } catch (e) {
    reply = {
      id,
      ok: false,
      err: String((e && e.stack) || e).slice(0, 4000),
      out,
      stderr: errOut.join('\n').slice(0, 4000),
    };
  } finally {
    console.log = log;
    console.error = logError;
  }

  process.stdout.write(JSON.stringify(reply) + '\n');
}
