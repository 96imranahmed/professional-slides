"""Check the shared distribution contract before npm creates its tarball."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
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
print(f"Distribution contract valid: {package['name']}@{package['version']}", file=sys.stderr)
