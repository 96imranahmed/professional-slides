"""Build the skills-only public upload separately from the source checkout.

    python3 evals/scripts/package_submission.py --output /tmp/submission

Preparation does not submit or publish. Publication fields not confirmed by the
publisher stay absent; no country, commerce, policy or legal identity is guessed.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import zipfile
import shutil

ROOT = Path(__file__).resolve().parents[2]

ROOT_FILES = {'plugin.json', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json',
              'README.md', 'requirements.txt'}
EXCLUDED = {'dist', 'output', 'outputs', 'tmp', 'deliverables', 'renders',
            'node_modules', '__pycache__', '.git'}
IMAGES = {'.png', '.jpg', '.jpeg', '.webp', '.svg'}


def shipped(relative):
    parts = relative.parts
    if any(part in EXCLUDED for part in parts):
        return False
    if relative.as_posix() in ROOT_FILES:
        return True
    if parts[0] == 'assets':
        return len(parts) == 2 and relative.suffix in IMAGES
    if parts[0] != 'skills' or len(parts) < 3:
        return False
    if len(parts) == 3:
        return parts[2] == 'SKILL.md'
    area = parts[2]
    if area == 'agents':
        return relative.suffix in {'.yaml', '.yml'}
    if area == 'references':
        return relative.suffix in {'.md', '.json'}
    if area == 'runtime':
        return relative.suffix in {'.mjs', '.py', '.json', '.md'}
    if area == 'examples':
        return (len(parts) > 4 and parts[3] == 'assets' and relative.suffix in IMAGES) or (
            len(parts) == 4 and relative.suffix == '.json' and relative.name != 'gallery-acceptance.deck.json')
    if area == 'assets':
        return relative.suffix in IMAGES | {'.json'} or relative.name.startswith('LICENSE')
    return False


def verify(destination):
    recorded = json.loads((destination / 'package-manifest.json').read_text())['files']
    actual = {p.relative_to(destination).as_posix(): {
        'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size}
        for p in destination.rglob('*') if p.is_file() and p.name != 'package-manifest.json'}
    return [] if actual == recorded else ['Inventory differs from recorded hashes']


def package(source, destination):
    if destination.is_relative_to(source) and not destination.is_relative_to(source / 'dist'):
        raise ValueError('Submission outputs must be external or under source dist/')
    if destination.exists():
        if not (destination / 'package-manifest.json').is_file():
            raise ValueError('Refusing to replace an unowned directory')
        shutil.rmtree(destination)
    for path in sorted(source.rglob('*')):
        if path.is_relative_to(destination):
            continue
        relative = path.relative_to(source)
        if not shipped(relative):
            continue
        if path.is_symlink():
            raise ValueError(f'Symlink cannot enter submission: {relative}')
        if path.is_file():
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)


def validate(destination):
    data = json.loads((destination / 'plugin.json').read_text())
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', data['version']):
        raise ValueError('Submission version must be strict SemVer')
    interface = data['extensions']['com.openai']['interface']
    for field, limit in [('displayName', 30), ('shortDescription', 30),
                         ('longDescription', 4000), ('developerName', 80)]:
        if not isinstance(interface.get(field), str) or not 0 < len(interface[field]) <= limit:
            raise ValueError(f'Invalid listing field: {field}')
    prompts = interface['defaultPrompt']
    prompts = [prompts] if isinstance(prompts, str) else prompts
    if not isinstance(prompts, list) or not 1 <= len(prompts) <= 3:
        raise ValueError('Provide one to three default prompts')
    normalized = []
    for prompt in prompts:
        if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 128 or '\n' in prompt or '\r' in prompt:
            raise ValueError('Invalid default prompt')
        normalized.append(' '.join(prompt.split()))
    if len(set(normalized)) != len(normalized):
        raise ValueError('Duplicate default prompts')
    for field in ['logo', 'composerIcon', 'logoDark', 'composerIconDark']:
        if field not in interface:
            continue
        icon = (destination / interface[field]).resolve()
        if not icon.is_relative_to(destination.resolve()) or not icon.is_file():
            raise ValueError(f'Missing or escaping icon: {field}')
    if not list((destination / 'skills').glob('*/SKILL.md')):
        raise ValueError('Skills-only submission needs a skill')
    for path in destination.rglob('*'):
        if path.is_symlink():
            raise ValueError(f'Symlink in submission: {path}')
        if path.name in {'.app.json', 'mcp.json', '.mcp.json'}:
            raise ValueError('This submission supports skills only')
        if path.name == 'plugin.json':
            manifest = json.loads(path.read_text())
            openai = manifest.get('extensions', {}).get('com.openai', {})
            if manifest.get('apps') is not None or openai.get('apps') is not None or manifest.get('mcpServers') is not None:
                raise ValueError('App/server bindings cannot enter this skills-only submission')
    for overlay in ['.codex-plugin/plugin.json', '.claude-plugin/plugin.json']:
        manifest = json.loads((destination / overlay).read_text())
        for key in ['name', 'version', 'description', 'author']:
            if manifest[key] != data[key]:
                raise ValueError(f'Manifest identity mismatch: {overlay}: {key}')
    codex = json.loads((destination / '.codex-plugin/plugin.json').read_text())
    if codex['interface'] != interface:
        raise ValueError('Compatibility listing differs from portable listing')
    return data


def build_submission(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output == source or source.is_relative_to(output):
        raise ValueError('Output cannot replace the source')
    destination = output / 'professional-slides'
    package(source, destination)
    # Development README links omitted test tools; the public README is source.
    (destination / 'README.md').write_bytes((source / 'submission/README-DISTRIBUTION.md').read_bytes())
    production = destination / 'skills/professional-slides/references/tools/production.md'
    text = production.read_text().replace('pip install -r requirements.txt',
                                             'pip install -r ../../requirements.txt')
    if 'pip install -r ../../requirements.txt' not in text:
        text += '\n## Install Python dependencies\n\nFrom the skill directory: `python3 -m pip install -r ../../requirements.txt`.\n'
    production.write_text(text)
    data = validate(destination)
    files = {p.relative_to(destination).as_posix(): {
        'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size}
        for p in sorted(destination.rglob('*')) if p.is_file() and p.name != 'package-manifest.json'}
    (destination / 'package-manifest.json').write_text(json.dumps({'schemaVersion': 1, 'files': files}, indent=2) + '\n')
    if verify(destination):
        raise ValueError('Submission inventory drift')
    archive = output / f"professional-slides-skills-only-{data['version']}.zip"
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in sorted(destination.rglob('*')):
            if p.is_file():
                z.write(p, Path(destination.name) / p.relative_to(destination))
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError('Archive integrity failure')
    return {'archive': str(archive), 'files': len(files) + 1,
            'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(build_submission(ROOT, args.output)))
