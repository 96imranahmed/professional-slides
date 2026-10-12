"""Desktop PDF exporters and their shared discovery policy. No third-party imports.

PowerPoint uses AppleScript on macOS and PowerShell COM on Windows. Linux and
noninteractive hosts use LibreOffice. Discovery never launches an office app.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

CHOICES = ("auto", "powerpoint", "libreoffice")
RENDERER_ENV = "PROFESSIONAL_SLIDES_RENDERER"


def requested_renderer(value: str | None = None) -> str:
    value = value if value is not None else os.environ.get(RENDERER_ENV, "auto")
    if value not in CHOICES:
        raise ValueError(f"{RENDERER_ENV} must be one of {', '.join(CHOICES)}; got {value!r}")
    return value


def soffice(platform: str | None = None) -> str | None:
    platform = platform or sys.platform
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found
    if platform == "darwin":
        paths = [Path("/Applications/LibreOffice.app/Contents/MacOS/soffice"),
                 Path.home() / "Applications/LibreOffice.app/Contents/MacOS/soffice"]
    elif platform == "win32":
        paths = [Path(os.environ.get(key, default)) / "LibreOffice/program/soffice.exe"
                 for key, default in (("ProgramFiles", "C:/Program Files"), ("ProgramFiles(x86)", "C:/Program Files (x86)"))]
    else:
        paths = [Path("/usr/lib/libreoffice/program/soffice")]
    return next((str(p) for p in paths if p.is_file()), None)


def powershell() -> str | None:
    found = shutil.which("powershell.exe") or shutil.which("pwsh.exe")
    if found:
        return found
    path = Path(os.environ.get("SystemRoot", "C:/Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    return str(path) if path.is_file() else None


def powerpoint(platform: str | None = None) -> str | None:
    platform = platform or sys.platform
    if platform == "darwin" and shutil.which("osascript"):
        return next((str(p) for p in (Path("/Applications/Microsoft PowerPoint.app"),
                                     Path.home() / "Applications/Microsoft PowerPoint.app") if p.is_dir()), None)
    if platform == "win32" and powershell():
        try:
            import winreg
            # COM registration covers Click-to-Run and both Office bitnesses.
            with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r"PowerPoint.Application\CLSID"):
                return powershell()
        except (ImportError, OSError):
            pass
    return None


def libreoffice_install(platform: str) -> str:
    if platform == "darwin":
        return "brew install --cask libreoffice"
    if platform == "win32":
        return "winget install TheDocumentFoundation.LibreOffice"
    return "sudo apt-get install -y libreoffice-impress"


def discover(requested: str | None = None, platform: str | None = None) -> dict:
    platform = platform or sys.platform
    requested = requested_renderer(requested)
    candidates = [{"id": "powerpoint", "path": powerpoint(platform)},
                  {"id": "libreoffice", "path": soffice(platform)}]
    for item in candidates:
        item["available"] = item["path"] is not None
    available = [item for item in candidates if item["available"] and (requested == "auto" or item["id"] == requested)]
    missing = {}
    if not available:
        if requested == "powerpoint":
            missing["powerpoint"] = ("PowerPoint desktop automation is unavailable on this OS; select libreoffice" if platform not in ("darwin", "win32") else
                                     "Install and activate desktop Microsoft PowerPoint and enable its automation, or select libreoffice")
        else:
            missing["soffice"] = libreoffice_install(platform)
    for tool in ("pdftoppm", "pdftotext"):
        if shutil.which(tool) is None:
            missing[tool] = ("brew install poppler" if platform == "darwin" else "choco install poppler" if platform == "win32" else
                             "sudo apt-get install -y poppler-utils")
    return {"requested": requested, "selected": available[0]["id"] if available else None,
            "platform": platform, "candidates": candidates, "available": available, "missing": missing}


MAC_SCRIPT = '''on run argv
    set inputFile to POSIX file (item 1 of argv)
    set outputFile to POSIX file (item 2 of argv)
    set appFile to POSIX file (item 3 of argv)
    set openedDeck to missing value
    using terms from application "Microsoft PowerPoint"
        tell application (appFile as text)
            try
                open inputFile
                set openedDeck to presentation (item 4 of argv)
                save openedDeck in outputFile as save as PDF
                close openedDeck saving no
            on error errorText number errorNumber
                if openedDeck is not missing value then
                    try
                        close openedDeck saving no
                    end try
                end if
                error errorText number errorNumber
            end try
        end tell
    end using terms from
end run
'''

WINDOWS_SCRIPT = r'''param([string]$InputPath, [string]$OutputPath)
$ErrorActionPreference = "Stop"
$app = $null
$deck = $null
try {
    $app = New-Object -ComObject PowerPoint.Application
    # ReadOnly=true, Untitled=false, WithWindow=false. Never save the source.
    $deck = $app.Presentations.Open($InputPath, -1, 0, 0)
    # ppSaveAsPDF=32; SaveAs supports late-bound COM without optional-argument
    # marshaling. The only saved file is the PDF; the PPTX is a scratch copy.
    $deck.SaveAs($OutputPath, 32)
} finally {
    if ($null -ne $deck) {
        try { $deck.Close() } finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($deck) }
    }
    # Do not Quit: the COM server may also own the user's open presentations.
    if ($null -ne $app) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) }
}
'''


@contextlib.contextmanager
def powerpoint_lock():
    """Office is a shared desktop app: only one of our exports may use it.

    A busy app fails this attempt promptly, permitting automatic LibreOffice
    fallback. OS file locks release even when an exporter process crashes.
    """
    user = hashlib.sha256(os.fsencode(str(Path.home()))).hexdigest()[:16]
    file = Path(tempfile.gettempdir()) / f"professional-slides-powerpoint-{user}.lock"
    with file.open("a+b") as lock:
        if sys.platform == "win32":
            import msvcrt
            if file.stat().st_size == 0:
                lock.write(b"0"); lock.flush()
            lock.seek(0)
            acquire = lambda: msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            release = lambda: (lock.seek(0), msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1))
        else:
            import fcntl
            acquire = lambda: fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            release = lambda: fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
        try:
            acquire()
        except OSError as error:
            raise RuntimeError("PowerPoint is busy with another renderer; retry or select libreoffice") from error
        try:
            yield
        finally:
            release()


def powerpoint_pdf(pptx: Path, directory: Path, backend: dict, platform: str | None = None) -> Path:
    """Mac Office may prompt for every file outside its own app sandbox.

    Both the opened PPTX and the exported PDF live inside PowerPoint's
    container; only our process copies the PDF back to the output directory.
    This avoids per-export file grants without changing security settings.
    macOS Automation permission to control PowerPoint is still required.
    """
    platform = platform or sys.platform
    if platform != "darwin":
        return _powerpoint_pdf(pptx, directory, backend, platform)
    container = Path.home() / "Library/Containers/com.microsoft.Powerpoint/Data"
    if not container.is_dir():
        raise RuntimeError("Open PowerPoint once to initialise its sandbox, then retry")
    workspace = container / "tmp/ProfessionalSlides"
    workspace.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="export-", dir=workspace) as scratch:
        pdf = _powerpoint_pdf(pptx, Path(scratch), backend, platform)
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / (pptx.stem + ".pdf")
        shutil.copyfile(pdf, target)
    return target


def _powerpoint_pdf(pptx: Path, directory: Path, backend: dict, platform: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    # Always open a unique scratch copy, including when the caller's source
    # has no hidden slides. A user may already have the source deck open.
    source = directory / f"render-{uuid.uuid4().hex}.pptx"
    shutil.copyfile(pptx, source)
    pdf = directory / (pptx.stem + ".pdf")
    if platform == "darwin":
        script = directory / "export.applescript"
        script.write_text(MAC_SCRIPT, encoding="utf-8")
        cmd = ["osascript", str(script), str(source.resolve()), str(pdf.resolve()), backend["path"], source.name]
    elif platform == "win32":
        script = directory / "export.ps1"
        # Windows PowerShell 5.1 needs a BOM to preserve Unicode script text.
        script.write_text(WINDOWS_SCRIPT, encoding="utf-8-sig")
        cmd = [backend["path"], "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", str(script),
               "-InputPath", str(source.resolve()), "-OutputPath", str(pdf.resolve())]
    else:
        raise RuntimeError("PowerPoint desktop automation requires macOS or Windows")
    try:
        with powerpoint_lock():
            subprocess.run(cmd, check=True, capture_output=True, timeout=300)
    except subprocess.CalledProcessError as error:
        detail = error.stderr.decode("utf-8", "replace").strip() if isinstance(error.stderr, bytes) else str(error.stderr or "")
        raise RuntimeError(f"PowerPoint PDF export failed: {detail}. On macOS, allow Automation access to PowerPoint; "
                           "on Windows, activate desktop Office and allow local automation.") from error
    if not pdf.is_file():
        raise RuntimeError("PowerPoint PDF export produced no PDF")
    return pdf


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Probe installed renderers without launching an office app")
    parser.add_argument("--renderer", choices=CHOICES)
    parser.add_argument("--platform", default=sys.platform)
    args = parser.parse_args()
    print(json.dumps(discover(args.renderer, args.platform)))
