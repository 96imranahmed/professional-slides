"""The doctor: every dependency of a build checked before any work.

A missing Python package, LibreOffice or poppler surfaced only halfway through
a build. The doctor finds a Python that imports everything the emitter and the
gates import, says which interpreter to select when it is not the runtime's
default, and prints an install line for each missing piece.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

DOCTOR = RUNTIME / "doctor.mjs"
MODULES = ["pptx", "lxml", "PIL", "numpy", "pypdf"]
SOFFICE_INSTALLS = ["/Applications/LibreOffice.app/Contents/MacOS/soffice", "/usr/lib/libreoffice/program/soffice"]


def complete_python():
    """An interpreter that imports every module the runtime needs, or None."""
    for candidate in (os.environ.get("RUNTIME_PYTHON"), "/usr/bin/python3", sys.executable, shutil.which("python3")):
        if not candidate:
            continue
        try:
            probe = subprocess.run([candidate, "-c", "import " + ", ".join(MODULES)], capture_output=True, timeout=30)
        except (OSError, subprocess.TimeoutExpired):
            continue
        if probe.returncode == 0:
            return candidate
    return None


COMPLETE = complete_python() if NODE else None


def script(folder: Path, name: str, body: str) -> Path:
    path = folder / name
    path.write_text("#!/bin/sh\n" + body + "\n")
    path.chmod(0o755)
    return path


def doctor(*args: str, env=None):
    return subprocess.run([NODE, str(DOCTOR), *args], capture_output=True, text=True, cwd=ROOT, timeout=60, env={**os.environ, **(env or {})})


class DoctorFolder:
    """A scratch folder for the stand-in interpreters and binaries a check is run against."""

    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())


# The checks are classes of their own so the parallel runner can share them out.
@unittest.skipUnless(NODE, "Node.js is not available")
class DoctorReportTests(DoctorFolder, unittest.TestCase):
    def test_the_json_report_covers_node_python_binaries_and_the_optional_canvas(self):
        result = doctor("--json")
        report = json.loads(result.stdout)
        self.assertEqual(result.returncode, 0 if report["ready"] else 2, result.stderr)
        self.assertLessEqual({"ready", "render", "node", "python", "binaries", "reviewer", "optional", "install"}, set(report))
        self.assertLessEqual({"host", "wanted", "chosen", "ok", "clis"}, set(report["reviewer"]))
        self.assertEqual(set(report["reviewer"]["clis"]), {"claude", "codex"})
        self.assertTrue(report["render"])
        self.assertEqual(report["node"]["required"], ">=20.9")
        self.assertTrue(report["node"]["ok"])
        self.assertEqual(set(report["python"]), {"chosen", "runtimePython", "export", "candidates"})
        self.assertEqual(report["python"]["runtimePython"], os.environ.get("RUNTIME_PYTHON") or "python3")
        for candidate in report["python"]["candidates"]:
            self.assertLessEqual({"command", "source", "path", "missing", "ok"}, set(candidate))
            self.assertLessEqual(set(candidate["missing"]), set(MODULES))
        paths = [c["path"] for c in report["python"]["candidates"] if c["path"]]
        self.assertEqual(len(paths), len({os.path.realpath(p) for p in paths}), "one entry per interpreter")
        self.assertEqual(set(report["binaries"]), {"soffice", "pdftoppm", "pdftotext"})
        canvas = report["optional"]["@napi-rs/canvas"]
        self.assertIs(canvas["required"], False, "the native canvas is never required")
        self.assertIsInstance(report["install"], list)

    def test_unknown_options_are_refused(self):
        self.assertEqual(doctor("--jsn").returncode, 1)


@unittest.skipUnless(NODE, "Node.js is not available")
class DoctorPythonTests(DoctorFolder, unittest.TestCase):
    def test_a_failing_runtime_python_is_reported_and_a_complete_one_is_chosen(self):
        if not COMPLETE:
            self.skipTest("needs a Python with python-pptx, lxml, Pillow, numpy and pypdf")
        without_pypdf = script(self.folder, "no-pypdf", f'exec "{COMPLETE}" -c \'import sys; sys.modules["pypdf"] = None; exec(sys.argv[-1])\' "$@"')
        broken = script(self.folder, "broken", "exit 1")
        # A complete interpreter as `python3` on PATH, so one is found whatever the machine's layout.
        bin_dir = self.folder / "bin"
        bin_dir.mkdir()
        script(bin_dir, "python3", f'exec "{COMPLETE}" "$@"')
        path = f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"
        for fake, missing in ((without_pypdf, ["pypdf"]), (broken, MODULES)):
            with self.subTest(fake=fake.name):
                env = {"RUNTIME_PYTHON": str(fake), "PATH": path}
                report = json.loads(doctor("--json", env=env).stdout)
                first = report["python"]["candidates"][0]
                self.assertEqual((first["source"], first["path"], first["ok"]), ("RUNTIME_PYTHON", str(fake), False))
                self.assertEqual(first["missing"], missing)
                if fake is broken:
                    self.assertIn("exited 1", first["error"])
                self.assertIsNotNone(report["python"]["chosen"])
                self.assertNotEqual(report["python"]["chosen"], str(fake))
                self.assertTrue(report["python"]["export"].startswith("export RUNTIME_PYTHON="))
                self.assertIn(report["python"]["chosen"], report["python"]["export"])
                self.assertIn(report["python"]["export"], report["install"])
                self.assertIn("export RUNTIME_PYTHON=", doctor(env=env).stdout, "the advice names RUNTIME_PYTHON")


@unittest.skipUnless(NODE, "Node.js is not available")
class DoctorBinaryTests(DoctorFolder, unittest.TestCase):
    def test_missing_binaries_fail_the_check_and_print_their_install_lines(self):
        bin_dir = self.folder / "bin"
        bin_dir.mkdir()
        (bin_dir / "node").symlink_to(NODE)
        # Signed-in agent CLIs, so what is missing is the binaries alone, whichever host runs the test.
        script(bin_dir, "claude", "echo '{\"loggedIn\": true}'")
        script(bin_dir, "codex", "echo 'Logged in using ChatGPT'")
        env = {"PATH": str(bin_dir)}
        if COMPLETE:
            env["RUNTIME_PYTHON"] = str(script(self.folder, "python", f'exec "{COMPLETE}" "$@"'))
        result = doctor("--json", env=env)
        self.assertEqual(result.returncode, 2, result.stderr)
        report = json.loads(result.stdout)
        self.assertFalse(report["ready"])
        self.assertFalse(report["binaries"]["pdftoppm"]["found"])
        self.assertFalse(report["binaries"]["pdftotext"]["found"])
        install = "\n".join(report["install"])
        self.assertIn("poppler", install)
        # render_pptx.py also finds LibreOffice in its install location, off PATH.
        if not any(Path(p).exists() for p in SOFFICE_INSTALLS):
            self.assertFalse(report["binaries"]["soffice"]["found"])
            self.assertIn("libreoffice", install.lower())
        human = doctor(env=env)
        self.assertEqual(human.returncode, 2)
        self.assertIn("poppler", human.stdout)
        self.assertIn("Not ready", human.stdout)
        if not COMPLETE:
            return
        relaxed = doctor("--json", "--no-render", env=env)
        self.assertEqual(relaxed.returncode, 0, relaxed.stdout)
        report = json.loads(relaxed.stdout)
        self.assertEqual((report["ready"], report["render"]), (True, False))
        self.assertIn("unrendered builds only", doctor("--no-render", env=env).stdout)


@unittest.skipUnless(NODE, "Node.js is not available")
class DoctorReviewerTests(DoctorFolder, unittest.TestCase):
    """The skill's fresh readers - the storyline critique, the deck review, the copy judgements - run through an agent CLI: the
    one the skill is called from, signed in. A first run with a CLI that was installed but not signed in found out only when
    every call failed, mid-deck."""

    def report(self, host, clis):
        bin_dir = self.folder / f"bin-{host}-{'-'.join(sorted(clis))}"
        bin_dir.mkdir()
        for name, body in clis.items():
            script(bin_dir, name, body)
        return run_node(f'''
import {{ diagnose, describe }} from './skills/professional-slides/runtime/doctor.mjs';
const report = await diagnose({{ env: {{ PATH: {json.dumps(str(bin_dir))} }}, platform: 'darwin', render: false, host: {json.dumps(host)} }});
console.log(JSON.stringify({{ reviewer: report.reviewer, install: report.install, said: describe(report).join("\\n") }}));
''')

    SIGNED_IN = {"claude": "echo '{\"loggedIn\": true}'", "codex": "echo 'Logged in using ChatGPT'"}
    SIGNED_OUT = {"claude": "echo '{\"loggedIn\": false, \"authMethod\": \"none\"}'", "codex": "echo 'Not logged in'; exit 1"}

    def test_called_from_claude_code_the_claude_cli_must_be_signed_in(self):
        out = self.report("claude", {"claude": self.SIGNED_OUT["claude"], "codex": self.SIGNED_IN["codex"]})
        self.assertFalse(out["reviewer"]["ok"], "a signed-in codex does not stand in for the host's own CLI")
        self.assertEqual(out["reviewer"]["wanted"], ["claude"])
        self.assertTrue(any(line.startswith("claude auth login") for line in out["install"]), out["install"])
        self.assertFalse(any("npm install" in line for line in out["install"]), "it is installed: only the sign-in is missing")
        self.assertIn("called from Claude Code", out["said"])
        self.assertIn("it is not signed in", out["said"])
        ready = self.report("claude", {"claude": self.SIGNED_IN["claude"]})
        self.assertEqual((ready["reviewer"]["ok"], ready["reviewer"]["chosen"]), (True, "claude"))

    def test_called_from_codex_the_codex_cli_is_installed_and_signed_in(self):
        out = self.report("codex", {"claude": self.SIGNED_IN["claude"]})
        self.assertFalse(out["reviewer"]["ok"])
        self.assertIn("npm install -g @openai/codex", out["install"])
        self.assertIn("codex login", out["install"])
        self.assertIn("it is not installed", out["said"])
        signed_out = self.report("codex", {"codex": self.SIGNED_OUT["codex"]})
        self.assertEqual(signed_out["install"][-1], "codex login")

    def test_from_a_plain_terminal_either_cli_serves(self):
        out = self.report(None, {"codex": self.SIGNED_IN["codex"], "claude": self.SIGNED_OUT["claude"]})
        self.assertEqual((out["reviewer"]["ok"], out["reviewer"]["chosen"]), (True, "codex"))
        neither = self.report(None, {})
        self.assertFalse(neither["reviewer"]["ok"])
        self.assertIn("neither is installed and signed in", neither["said"])
        self.assertIn("npm install -g @anthropic-ai/claude-code", neither["install"])


@unittest.skipUnless(NODE, "Node.js is not available")
class InstallLineTests(unittest.TestCase):
    def test_each_platform_names_its_installers(self):
        lines = run_node('''
import { installLines } from './skills/professional-slides/runtime/doctor.mjs';
const none = { found: false, path: null };
const lines = (platform) => installLines({ platform, node: { ok: false }, python: { chosen: null, export: null, candidates: [] },
  binaries: { soffice: none, pdftoppm: none, pdftotext: none } });
console.log(JSON.stringify({ darwin: lines('darwin'), linux: lines('linux'), win32: lines('win32') }));
''')
        self.assertIn("brew install --cask libreoffice", lines["darwin"])
        self.assertIn("brew install poppler", lines["darwin"])
        self.assertTrue(any(line.startswith("brew install node") for line in lines["darwin"]))
        self.assertIn("sudo apt-get install -y libreoffice-impress poppler-utils", lines["linux"])
        self.assertTrue(any(line.startswith("winget install TheDocumentFoundation.LibreOffice") for line in lines["win32"]))
        self.assertTrue(any("poppler" in line for line in lines["win32"]))
        for platform, found in lines.items():
            self.assertTrue(any(" -m pip install " in line for line in found), platform)

    def test_injected_candidates_replace_the_search(self):
        report = run_node('''
import { diagnose } from './skills/professional-slides/runtime/doctor.mjs';
const report = await diagnose({ candidates: ['/nonexistent/python3'], env: { PATH: '' }, platform: 'linux', render: false });
console.log(JSON.stringify(report));
''')
        self.assertEqual([c["command"] for c in report["python"]["candidates"]], ["/nonexistent/python3"])
        self.assertEqual(report["python"]["candidates"][0]["error"], "not found")
        self.assertIsNone(report["python"]["chosen"])
        self.assertFalse(report["ready"], "no complete Python is never ready, even without rendering")
        self.assertIn("sudo apt-get install -y python3 python3-pip", report["install"])


if __name__ == "__main__":
    unittest.main()
