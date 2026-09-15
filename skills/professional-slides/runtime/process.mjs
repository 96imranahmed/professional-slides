import { spawn } from "node:child_process";

/**
 * Run a child process and return { code, stdout, stderr }. Never discards output:
 * a failed step's reason must be readable from the result, not reconstructed from a
 * truncated stderr tail. `expect` lists exit codes that are results rather than
 * crashes (e.g. 2 = "findings"); anything else rejects with the full output.
 */
export async function runProcess(bin, args, { input, timeoutMs = 300000, cwd, env, expect = [0] } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid process timeout");
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"], cwd, env: { ...process.env, ...(env || {}) }, detached: process.platform !== "win32" });
    let stdout = "", stderr = "", timedOut = false, killTimer;
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    const stop = (signal) => { try { if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal); else child.kill(signal); } catch (e) { if (e.code !== "ESRCH") throw e; } };
    const timer = setTimeout(() => { timedOut = true; stop("SIGTERM"); killTimer = setTimeout(() => stop("SIGKILL"), 2000); }, timeoutMs);
    const clear = () => { clearTimeout(timer); clearTimeout(killTimer); };
    child.on("error", (e) => { clear(); reject(e); });
    child.on("close", (code) => {
      clear();
      if (timedOut) return reject(Object.assign(new Error(`${bin} timed out after ${timeoutMs} ms\n${stderr.slice(-4000)}`), { stdout, stderr, timedOut: true }));
      if (!expect.includes(code)) return reject(Object.assign(new Error(`${bin} ${args[0] || ""} exited ${code}\n${stderr.slice(-4000)}\n${stdout.slice(-2000)}`), { code, stdout, stderr }));
      resolve({ code, stdout, stderr });
    });
    child.stdin.on("error", (e) => { if (e.code !== "EPIPE") child.kill("SIGTERM"); });
    child.stdin.end(input);
  });
}

/** Parse the last JSON object a process printed; tools print one JSON line as their result. */
export function lastJson(stdout) {
  const lines = String(stdout).trim().split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(lines[i]); } catch { /* keep looking */ }
  }
  try { return JSON.parse(String(stdout)); } catch { return null; }
}
