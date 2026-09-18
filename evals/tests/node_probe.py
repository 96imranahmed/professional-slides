"""Shared Node probe for the eval suite.

A test that wants to exercise real geometry runs a small ES module against the
runtime and reads its JSON on stdout. Keeping the helper here (rather than in a
test file other tests import) means deleting a test file never breaks the rest
of the suite.

Probes are answered by a single long-lived Node worker (``probe-worker.mjs``)
rather than one ``node --eval`` process each: process startup plus re-importing
the runtime costs ~105ms per probe, a warm worker ~2ms. The worker is started
lazily, restarted once if it dies, and the original per-probe subprocess path
stays as a fallback so a sick worker degrades to "slow" rather than to a few
hundred spurious failures.
"""

from __future__ import annotations

import atexit
import json
import os
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / "skills" / "professional-slides"
RUNTIME = SKILL / "runtime"
REFERENCES = SKILL / "references"
NODE = os.environ.get("RUNTIME_NODE") or shutil.which("node")

WORKER = Path(__file__).resolve().parent / "probe-worker.mjs"

# `node --input-type=module --eval` names the anonymous module after cwd, and
# probes that build a require() off import.meta.url rely on that. A data: module
# has no such URL, so the specifier rewrite below pins the same value.
_EVAL_URL = f"{ROOT.as_uri()}/[eval1]"

# `from './x'`, `from "../x"`, `import('./x')`, and bare `import './x'`.
_RELATIVE_SPECIFIER = re.compile(
    r"(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['\"])(\.{1,2}/[^'\"]*)\2"
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _probe_env() -> dict:
    return {
        **os.environ,
        "RUNTIME_NODE_MODULES": os.environ.get("RUNTIME_NODE_MODULES", str(ROOT / "node_modules")),
    }


def _absolutise(source: str) -> str:
    """Rewrite cwd-relative module references so a data: module can resolve them.

    A data: URL has no base to resolve './x' against, so every relative
    specifier becomes the absolute file:// URL that cwd=ROOT would have given.
    """

    def replace(match: re.Match) -> str:
        prefix, quote, specifier = match.group(1), match.group(2), match.group(3)
        target = (ROOT / specifier).resolve()
        return f"{prefix}{quote}{target.as_uri()}{quote}"

    source = _RELATIVE_SPECIFIER.sub(replace, source)
    return source.replace("import.meta.url", json.dumps(_EVAL_URL))


# --- worker lifecycle -------------------------------------------------------

_worker: subprocess.Popen | None = None
_worker_disabled = False
_next_id = 0
_worker_env: dict[str, str] = {}


def _env_delta() -> dict:
    """What the worker's process.env must change to match ours right now.

    Tests hand fixtures to probes through os.environ (e.g. NICE_TICK_CASES),
    which a process-per-probe run picked up for free. The worker snapshots the
    environment at startup, so every probe carries the diff since the last one.
    """
    global _worker_env
    current = _probe_env()
    delta = {
        "set": {k: v for k, v in current.items() if _worker_env.get(k) != v},
        "unset": [k for k in _worker_env if k not in current],
    }
    _worker_env = current
    return delta


def _start_worker() -> subprocess.Popen | None:
    global _worker_env
    env = _probe_env()
    try:
        proc = subprocess.Popen(
            [NODE, str(WORKER)],
            cwd=ROOT,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            bufsize=1,
            env=env,
        )
    except OSError:
        return None
    _worker_env = env
    return proc


def _stop_worker() -> None:
    global _worker
    proc, _worker = _worker, None
    if proc is None:
        return
    try:
        if proc.stdin:
            proc.stdin.close()
    except OSError:
        pass
    try:
        proc.wait(timeout=5)
    except Exception:
        proc.kill()
        try:
            proc.wait(timeout=5)
        except Exception:
            pass
    for stream in (proc.stdout,):
        try:
            if stream:
                stream.close()
        except OSError:
            pass


atexit.register(_stop_worker)


def _ensure_worker() -> subprocess.Popen | None:
    global _worker
    if _worker is not None and _worker.poll() is None:
        return _worker
    if _worker is not None:
        _stop_worker()
    _worker = _start_worker()
    return _worker


def _exchange(proc: subprocess.Popen, request_id: int, source: str) -> dict:
    """Send one probe and read its reply, skipping any stray stdout lines."""
    assert proc.stdin is not None and proc.stdout is not None
    request = {"id": request_id, "src": source, "env": _env_delta()}
    proc.stdin.write(json.dumps(request) + "\n")
    proc.stdin.flush()
    while True:
        line = proc.stdout.readline()
        if not line:
            raise BrokenPipeError("probe worker closed stdout")
        try:
            reply = json.loads(line)
        except ValueError:
            continue  # a probe wrote to stdout directly; not our reply
        if isinstance(reply, dict) and reply.get("id") == request_id:
            return reply


def _ask_worker(source: str) -> dict | None:
    """Run a probe on the shared worker, or return None to use the fallback."""
    global _worker_disabled, _next_id
    if _worker_disabled:
        return None
    for attempt in range(2):  # one restart before giving up
        proc = _ensure_worker()
        if proc is None:
            break
        _next_id += 1
        try:
            return _exchange(proc, _next_id, source)
        except (BrokenPipeError, OSError, ValueError):
            _stop_worker()
    _worker_disabled = True
    return None


def _run_node_subprocess(source: str) -> dict:
    result = subprocess.run(
        [NODE, "--input-type=module", "--eval", source],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        env=_probe_env(),
    )
    if result.returncode:
        raise AssertionError(f"Node probe exited {result.returncode}\n{result.stderr}\n{result.stdout}")
    return json.loads(result.stdout)


def run_node(source: str) -> dict:
    if not NODE:
        raise unittest.SkipTest("Node.js is not available")
    reply = _ask_worker(_absolutise(source))
    if reply is None:
        return _run_node_subprocess(source)
    stdout = "\n".join(reply.get("out") or [])
    if not reply.get("ok"):
        stderr = "\n".join(part for part in (reply.get("err"), reply.get("stderr")) if part)
        raise AssertionError(f"Node probe exited 1\n{stderr}\n{stdout}")
    return json.loads(stdout)
