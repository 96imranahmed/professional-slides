"""The reference census measures a deck and sets it beside a reference.

A one-page PDF written by hand stands in for a rendered deck, so the test needs
no renderer of ours: only PyMuPDF or poppler to read it, and numpy and Pillow.
"""
import contextlib
import importlib.util
import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "evals" / "scripts" / "reference_census.py"


def _available():
    try:
        import numpy  # noqa: F401
        import PIL  # noqa: F401
    except ImportError:
        return False
    try:
        import fitz  # noqa: F401
        return True
    except ImportError:
        return bool(shutil.which("pdftoppm") and shutil.which("pdftotext"))


def _pdf(content: bytes) -> bytes:
    """A one-page 960x540 PDF with Helvetica, xref offsets computed."""
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


PAGE = b"""BT /F1 28 Tf 72 470 Td (Revenue grew 12% in 2025) Tj ET
0 0 0 RG 2 w 72 440 m 700 440 l S
0.3 g 100 150 400 200 re f
BT /F1 14 Tf 540 300 Td (Share of 3 markets) Tj ET"""

SCENE = {"slides": [{
    "id": "p1",
    "componentInstances": [
        {"component": "chart.column", "category": "chart", "instanceId": "p1:c", "frame": {"x": 100, "y": 150, "width": 400, "height": 300}},
        {"component": "bullet-list", "category": "text", "instanceId": "p1:t", "frame": {"x": 540, "y": 150, "width": 300, "height": 300}},
    ],
    "nodes": [
        {"role": "action-title", "text": "Revenue grew 12% in\n2025", "data": {"textLayout": {"lines": ["Revenue grew 12% in", "2025"]}}},
        *({"role": "chart-mark", "data": {"componentInstance": "p1:c"}} for _ in range(3)),
    ],
}]}


@unittest.skipUnless(_available(), "needs numpy, Pillow and PyMuPDF or poppler")
class ReferenceCensusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("reference_census", SCRIPT)
        cls.census = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.census)

    def run_census(self, *extra, pages=None, reference=None):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / "deck.pdf").write_bytes(_pdf(PAGE))
            (tmp / "scene.json").write_text(json.dumps(SCENE))
            args = [str(tmp / "deck.pdf"), "--scene", str(tmp / "scene.json"), "--out", str(tmp / "out.json"), *extra]
            if pages is not None:
                (tmp / "pages.json").write_text(json.dumps(pages))
                args += ["--pages", str(tmp / "pages.json")]
            if reference is not None:
                (tmp / "ref.json").write_text(json.dumps(reference))
                args += ["--reference", str(tmp / "ref.json")]
            printed = io.StringIO()
            with contextlib.redirect_stdout(printed):
                self.census.main(args)
            return json.loads((tmp / "out.json").read_text()), printed.getvalue()

    def test_a_page_is_measured_from_its_render_and_its_scene(self):
        report, _ = self.run_census()
        page = report["perPage"][0]
        self.assertGreaterEqual(page["words"], 9)
        self.assertEqual(page["nums"], 3)  # 12%, 2025, 3
        self.assertGreater(page["ink"], 0.05)
        self.assertTrue(page["titleRule"])
        self.assertEqual(page["exhibits"], 1)
        self.assertTrue(page["exhibitBesideColumn"])
        self.assertTrue(page["shortLastLine"])
        self.assertEqual(page["plotted"], 3)  # the scene's marks, with no pages file

    def test_the_pages_file_supplies_plotted_values(self):
        pages = {"pages": [{"id": "p1", "exhibit": {"type": "chart.column", "series": [{"values": [1, 2, 3, 4]}, {"values": [5, 6, 7, 8]}]}}]}
        report, _ = self.run_census(pages=pages)
        self.assertEqual(report["summary"]["plottedPerChartPage"]["median"], 8)

    def test_a_scanned_reference_has_no_word_count_and_prints_beside_the_deck(self):
        rows = [{"page": 1, "words": 0, "nums": 0, "ink": 0.3, "occ": 0.6}, {"page": 2, "words": 0, "nums": 0, "ink": 0.2, "occ": 0.5}]
        report, printed = self.run_census(reference=rows)
        self.assertNotIn("words", report["reference"])
        self.assertEqual(report["reference"]["occ"]["median"], 0.6)
        self.assertIn("Reference", printed.splitlines()[0])
        words = next(line for line in printed.splitlines() if line.startswith("Words per page"))
        self.assertTrue(words.rstrip().endswith("-"))

    def test_the_committed_reference_is_numbers_only(self):
        data = json.loads((ROOT / "evals" / "reference_census.json").read_text())
        strings = []
        walk = lambda value: strings.append(value) if isinstance(value, str) else [walk(v) for v in (value.values() if isinstance(value, dict) else value if isinstance(value, list) else [])]  # noqa: E731
        walk(data["summary"])
        self.assertEqual(strings, [])
        self.assertNotIn("/", data.get("note", "").replace("evals/scripts/reference_census.py", ""))


if __name__ == "__main__":
    unittest.main()
