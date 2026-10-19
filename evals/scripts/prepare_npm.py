"""Check the shared distribution contract before npm creates its tarball.

npm packs what package.json's `files` globs match in the working tree, and a
root .npmignore does not narrow `files`. So the check expands those globs here
and holds them to the plugin's allowlist (package_plugin.shipped) over the
files git tracks: an untracked cache or a compiled example beside the sources
fails the pack instead of shipping in it.
"""
import json
import subprocess
from fnmatch import fnmatch
import sys
from pathlib import Path, PurePosixPath

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'evals' / 'scripts'))
from package_plugin import shipped, compiled_example  # noqa: E402

distribution = json.loads((root / 'distribution.json').read_text())
package = json.loads((root / 'package.json').read_text())
expected = distribution['npmFiles']
if package.get('private') or package.get('files') != expected:
    raise SystemExit('npm files must match distribution.json; package must be publishable')
for file in distribution['files'] + distribution['roots']:
    if not (root / file).exists():
        raise SystemExit(f'Missing distribution input: {file}')
for file in ('plugin.json', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json'):
    if json.loads((root / file).read_text())['version'] != package['version']:
        raise SystemExit(f'Version drift: {file}')


def matched(patterns):
    files = set()
    for pattern in patterns:
        hits = {PurePosixPath(p.relative_to(root).as_posix()) for p in root.glob(pattern.lstrip('!')) if p.is_file()}
        files = files - hits if pattern.startswith('!') else files | hits
    return {f for f in files if '__pycache__' not in f.parts}


def ignored(files):
    """What a .npmignore below the root leaves out (npm reads those, unlike the root one, against `files`)."""
    out = set(files)
    for ignore in root.glob('**/.npmignore'):
        folder = PurePosixPath(ignore.parent.relative_to(root).as_posix())
        if folder == PurePosixPath('.') or 'node_modules' in folder.parts:
            continue
        patterns = [line.strip() for line in ignore.read_text().splitlines() if line.strip() and not line.startswith('#')]
        out = {f for f in out if not (f.is_relative_to(folder) and any(fnmatch(str(f.relative_to(folder)), p) or fnmatch(f.name, p) for p in patterns))}
    return out


npm = ignored(matched(expected)) | {PurePosixPath('package.json')}
try:
    listed = subprocess.run(['git', '-C', str(root), 'ls-files', '-z'], capture_output=True, check=True).stdout
    tracked = {PurePosixPath(name.decode('utf-8')) for name in listed.split(b'\0') if name}
except (OSError, subprocess.CalledProcessError):
    tracked = None
if tracked is not None:
    plugin = {rel for rel in tracked if shipped(rel) and not compiled_example(root, rel)}
    extra, missing = sorted(map(str, npm - plugin)), sorted(map(str, plugin - npm))
    if extra or missing:
        raise SystemExit('npm and the plugin would ship different files.'
                         + (f'\n  only in npm (untracked, or outside the allowlist): {", ".join(extra[:12])}' if extra else '')
                         + (f'\n  only in the plugin: {", ".join(missing[:12])}' if missing else '')
                         + '\nPack from a clean checkout, or bring distribution.json and package_plugin.py into line.')
print(f"Distribution contract valid: {package['name']}@{package['version']}, {len(npm)} files", file=sys.stderr)
