from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SourceStructureTests(unittest.TestCase):
    def test_every_source_directory_has_an_index(self):
        source_root = ROOT / "src"
        directories = [
            source_root,
            *(path for path in source_root.rglob("*") if path.is_dir()),
        ]
        missing = [
            path.relative_to(ROOT).as_posix()
            for path in directories
            if not (path / "index.md").is_file()
        ]
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
