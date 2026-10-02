"""Build a clean, relocatable plugin without local artifacts or dependencies.

    python3 evals/scripts/package_plugin.py [--output DIR]
    python3 evals/scripts/package_plugin.py --verify DIR

The package is an allowlist: a file ships only when `shipped()` names it. What
a developer checkout accumulates - evals/, build outputs, node_modules, the
Node dev manifest, test-only runtime modules, authoring logs, eval fixtures -
stays out without anyone having to remember to exclude it.
"""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[2]

# The plugin root: the three manifests (portable, Codex, Claude Code), the
# README, and the Python requirements the emitter and pixel gates import.
# package.json is the checkout's dev manifest - Playwright, sharp and scripts
# into evals/ - and the runtime needs none of it, so it does not ship.
ROOT_FILES = {
    'plugin.json',
    '.codex-plugin/plugin.json',
    '.claude-plugin/plugin.json',
    'README.md',
    'requirements.txt',
}
MANIFESTS = {'plugin.json', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json'}
IMAGES = {'.png', '.jpg', '.jpeg', '.webp', '.svg'}

# Runtime modules only the eval suite imports. A shipped module that starts
# importing one of these fails test_plugin_distribution's import check, which
# is the prompt to take it off this list.
TEST_ONLY_RUNTIME = {
    'fixtures.mjs',
}
# Example files that exist to exercise the suite rather than to teach an author.
EVAL_EXAMPLES = {'gallery-acceptance.deck.json'}

# Never shipped, wherever they appear.
EXCLUDED = {'dist', 'output', 'outputs', 'tmp', 'deliverables', 'renders', 'node_modules', '__pycache__', '.git'}


def shipped(rel: PurePosixPath) -> bool:
    """Whether the file at `rel` (relative to the plugin root) is part of the plugin."""
    parts = rel.parts
    if not parts or any(part in EXCLUDED for part in parts):
        return False
    if rel.as_posix() in ROOT_FILES:
        return True
    if parts[0] == 'assets':
        return len(parts) == 2 and rel.suffix in IMAGES
    if parts[0] != 'skills' or len(parts) < 3:
        return False
    if len(parts) == 3:
        return parts[2] == 'SKILL.md'
    area, inner = parts[2], PurePosixPath(*parts[3:])
    if area == 'agents':
        return rel.suffix in {'.yaml', '.yml'}
    if area == 'references':
        return rel.suffix in {'.md', '.json'}
    if area == 'runtime':
        return rel.suffix in {'.mjs', '.py', '.json', '.md'} and inner.as_posix() not in TEST_ONLY_RUNTIME
    if area == 'examples':
        if inner.parts[0] == 'assets':
            return rel.suffix in IMAGES
        # `.json` only: an authoring log (`*.author-log.jsonl`) is a record of
        # one session, not an example.
        return len(inner.parts) == 1 and rel.suffix == '.json' and rel.name not in EVAL_EXAMPLES
    if area == 'assets':
        return rel.suffix in IMAGES | {'.json'} or rel.name.startswith('LICENSE')
    return False


def package(source: Path, destination: Path):
    source, destination = source.resolve(), destination.resolve()
    if destination == source or source.is_relative_to(destination):
        raise ValueError('Package destination cannot replace the source or its ancestors')
    if destination.is_relative_to(source) and not ((source / '.git').exists() and destination.is_relative_to(source / 'dist')):
        raise ValueError('Plugin files are read-only; stage outside the installation or under a developer checkout dist/')
    if destination.exists():
        if not (destination / 'package-manifest.json').is_file():
            raise ValueError('Refusing to replace a directory not owned by the package builder')
        shutil.rmtree(destination)
    files = []
    for p in source.rglob('*'):
        rel = p.relative_to(source)
        if p.is_relative_to(destination) or not shipped(PurePosixPath(rel.as_posix())):
            continue
        if p.is_symlink():
            raise ValueError(f'Symlinks must not enter the distributable: {rel}')
        if p.is_file():
            files.append((p, rel))
    missing = MANIFESTS - {rel.as_posix() for _, rel in files}
    if missing:
        raise ValueError(f'Source is missing plugin manifests: {", ".join(sorted(missing))}')
    manifest = {}
    for p, rel in sorted(files):
        dest = destination / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, dest)
        manifest[rel.as_posix()] = {'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(), 'bytes': dest.stat().st_size}
    (destination / 'package-manifest.json').write_text(json.dumps({'schemaVersion': 1, 'files': manifest}, indent=2)+'\n')
    return {'files': len(files), 'bytes': sum(x['bytes'] for x in manifest.values()), 'path': str(destination)}


def verify(destination: Path):
    """Files in a staged package that differ from the manifest the packager wrote.

    A staged package is a build output. A version bump applied to it by hand
    rather than to the source followed by a rebuild shows up here.
    """
    destination = Path(destination)
    recorded = json.loads((destination / 'package-manifest.json').read_text(encoding='utf-8'))['files']
    drifted = []
    for rel, entry in sorted(recorded.items()):
        path = destination / rel
        if not path.is_file():
            drifted.append(f'{rel} (missing)')
        elif hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            drifted.append(rel)
    present = {p.relative_to(destination).as_posix() for p in destination.rglob('*') if p.is_file()}
    drifted += [f'{rel} (unrecorded)' for rel in sorted(present - set(recorded) - {'package-manifest.json'})]
    return drifted


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/professional-slides')
    parser.add_argument('--verify', type=Path, default=None, help='check a staged package against its manifest')
    args = parser.parse_args()
    if args.verify:
        drifted = verify(args.verify)
        print(json.dumps({'path': str(args.verify), 'drifted': drifted}))
        raise SystemExit(1 if drifted else 0)
    print(json.dumps(package(ROOT, args.output)))
