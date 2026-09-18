#!/usr/bin/env python3
"""Render the committed scene through the current emitter before comparing goldens."""
import gzip
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
from golden_reference import REFERENCE_DIR, check


def main():
    runs = ROOT / 'output' / 'golden' / 'runs'
    runs.mkdir(parents=True, exist_ok=True)
    run = Path(tempfile.mkdtemp(prefix='release-', dir=runs))
    scene = run / 'scene.json'
    scene.write_bytes(gzip.decompress((ROOT / 'evals/fixtures/scene-nyc.json.gz').read_bytes()))
    emit = ROOT / 'skills/professional-slides/runtime/emit'
    subprocess.run([sys.executable, str(emit / 'emit_pptx.py'), str(scene), str(run / 'deck.pptx')], check=True)
    subprocess.run([sys.executable, str(emit / 'render_pptx.py'), str(run / 'deck.pptx'), str(run / 'rendered')], check=True)
    candidates = run / 'candidates'
    candidates.mkdir()
    for reference in REFERENCE_DIR.glob('*.png'):
        rendered = run / 'rendered' / reference.name
        if rendered.exists():
            shutil.copyfile(rendered, candidates / reference.name)
    report = check(candidates, run / 'comparison.json')
    print(f"Release comparison: {run / 'comparison.json'}")
    for item in report['results']:
        print(f"  {item['id']}: {item['status']}")
    return 0 if report['accepted'] else 2


if __name__ == '__main__':
    sys.exit(main())
