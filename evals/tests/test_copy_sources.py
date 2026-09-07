import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("copy_sources", Path(__file__).resolve().parents[1] / "scripts" / "read_copy_sources.py")
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class CopySourceTests(unittest.TestCase):
    def test_changed_source_and_wrong_page_or_slide_mapping_reject(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            path = base / "facts.md"
            path.write_text("An explicit source finding, with its qualification.")
            record = {"id": "facts", "path": "facts.md", "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "slides": [1]}
            result = reader.read_sources([record], base, 2)
            self.assertIn("qualification", result["sources"][0]["text"])
            self.assertEqual(result["sources"][0]["id"], "source:facts")
            for change in [{"sha256": "stale"}, {"slides": [3]}, {"slides": [True]}, {"pages": [1]}]:
                with self.assertRaises(ValueError):
                    reader.read_sources([{**record, **change}], base, 2)
            with self.assertRaises(ValueError):
                reader.read_sources([record, record], base, 2)

    def test_pdf_excerpt_contains_only_the_selected_source_page(self):
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            writer = PdfWriter()
            for text in ["Private unrelated context", "Material operating condition"]:
                page = writer.add_blank_page(width=400, height=300)
                font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
                page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
                stream = DecodedStreamObject()
                stream.set_data(f"BT /F1 12 Tf 20 200 Td ({text}) Tj ET".encode())
                page[NameObject("/Contents")] = stream
            path = base / "source.pdf"
            with path.open("wb") as output:
                writer.write(output)
            record = {"id": "pdf", "path": "source.pdf", "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "pages": [2], "slides": [1]}
            source = reader.read_sources([record], base, 1)["sources"][0]
            self.assertIn("Material operating condition", source["text"])
            self.assertNotIn("Private unrelated context", source["text"])
            with self.assertRaises(ValueError):
                reader.read_sources([{**record, "pages": [3]}], base, 1)


if __name__ == "__main__":
    unittest.main()
