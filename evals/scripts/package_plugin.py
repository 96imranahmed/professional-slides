"""Build a clean, relocatable plugin without local artifacts or dependencies."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[2]
ALLOWED_ROOTS = {'skills', 'evals'}
ASSET_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.svg'}
ALLOWED_FILES = {'.codex-plugin/plugin.json', 'README.md', 'package.json'}
EXTENSIONS = {'.md', '.mjs', '.py', '.json', '.toml', '.yaml', '.yml', '.svg'}
EXCLUDED = {'output', 'tmp', 'deliverables', 'renders', 'node_modules', '__pycache__', '.git'}


def package(source: Path, destination: Path):
    source, destination = source.resolve(), destination.resolve()
    if destination == source or source.is_relative_to(destination):
        raise ValueError('Package destination cannot replace the source or its ancestors')
    if destination.is_relative_to(source) and not ((source / '.git').exists() and destination.is_relative_to(source / 'output')):
        raise ValueError('Plugin files are read-only; stage outside the installation or under a developer checkout output/')
    if destination.exists():
        if not (destination / 'package-manifest.json').is_file():
            raise ValueError('Refusing to replace a directory not owned by the package builder')
        shutil.rmtree(destination)
    files = []
    for p in source.rglob('*'):
        rel = p.relative_to(source)
        if p.is_relative_to(destination) or any(x in EXCLUDED for x in rel.parts):
            continue
        if not (rel.as_posix() in ALLOWED_FILES
                or (rel.parts[0] in ALLOWED_ROOTS and p.suffix in EXTENSIONS)
                or (rel.parts[0] == 'assets' and p.suffix in ASSET_EXTENSIONS)):
            continue
        if p.is_symlink():
            raise ValueError(f'Symlinks must not enter the distributable: {rel}')
        if p.is_file():
            files.append((p, rel))
    if not any(str(rel) == '.codex-plugin/plugin.json' for _, rel in files):
        raise ValueError('Source has no plugin manifest')
    manifest = {}
    for p, rel in sorted(files):
        dest = destination / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, dest)
        manifest[rel.as_posix()] = {'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(), 'bytes': dest.stat().st_size}
    (destination / 'package-manifest.json').write_text(json.dumps({'schemaVersion': 1, 'files': manifest}, indent=2)+'\n')
    return {'files': len(files), 'bytes': sum(x['bytes'] for x in manifest.values()), 'path': str(destination)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'output/package/professional-slides')
    args = parser.parse_args()
    print(json.dumps(package(ROOT, args.output)))
